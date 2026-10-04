'use strict';
/* Serveur NutriDeck : fichiers statiques + relais vers Open Food Facts + lobbys multijoueur (WebSocket).
   npm install   puis   npm start   →  http://localhost:5177
   - Le relais OFF existe parce que l'API de recherche moderne (Search-a-licious) n'autorise pas les appels
     directs depuis un navigateur (pas de CORS), et que OFF demande un User-Agent identifiable.
   - Le multijoueur est un simple relais : l'hôte (un navigateur) fait tourner la partie, le serveur ne fait
     que transmettre les messages entre l'hôte et les joueurs de son lobby. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 5177;
const UA = 'NutriDeck/0.1' + (process.env.OFF_CONTACT ? ` (${process.env.OFF_CONTACT})` : '');
const FIELDS = 'code,product_name,generic_name,brands,quantity,image_front_url,image_front_small_url,nutriscore_grade,nova_group,ecoscore_grade,nutriments,ingredients_text,allergens_tags,additives_n,additives_tags';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'styles.css', 'app.js', 'settings.js', 'games.js', 'online.js', 'main.js', 'card-gym.html', 'card-gym.css', 'card-gym.js', 'gym-products.json', 'gym-assets/3017620422003.jpg', 'gym-assets/5449000000996.jpg', 'gym-assets/3175680011480.jpg', 'gym-assets/3228857000906.jpg', 'gym-assets/3274080005003.jpg', 'gym-assets/7622210449283.jpg', 'gym-assets/8000500310427.jpg']);

/* ───────────── Relais Open Food Facts ───────────── */
const cache = new Map();                       // clé → { t, data }
const TTL = 10 * 60 * 1000;
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const data = await fn();
  cache.set(key, { t: Date.now(), data });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return data;
}
async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Object.assign(new Error('OFF ' + r.status), { status: r.status });
  return r.json();
}
const fixBrands = p => ({ ...p, brands: Array.isArray(p.brands) ? p.brands.join(', ') : p.brands });

async function search(q, page) {
  const u = new URL('https://search.openfoodfacts.org/search');
  Object.entries({ q, page, page_size: 36, langs: 'fr', fields: FIELDS, sort_by: '-unique_scans_n' }).forEach(([k, v]) => u.searchParams.set(k, v));
  const d = await getJSON(u);
  return { products: (d.hits || []).map(fixBrands), page_count: Math.min(d.page_count || 0, 50) };
}
async function product(code) {
  const d = await getJSON(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS},product_name_fr,ingredients_text_fr,ecoscore_data,labels_tags,origins_tags,manufacturing_places,packaging_materials_tags,ingredients_analysis_tags`);
  return d.status === 1 ? { product: d.product } : { product: null };
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
      const page = Math.max(1, Math.min(50, +url.searchParams.get('page') || 1));
      if (!q) return send(res, 400, { error: 'q manquant' });
      return send(res, 200, await cached(`s|${q.toLowerCase()}|${page}`, () => search(q, page)));
    }
    const m = url.pathname.match(/^\/api\/product\/(\d{6,14})$/);
    if (m) return send(res, 200, await cached('p|' + m[1], () => product(m[1])));
    if (url.pathname === '/health') return send(res, 200, { ok: true, rooms: rooms.size });

    // statique : uniquement les fichiers de l'app
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!PUBLIC.has(name)) return send(res, 404, 'Not found', 'text/plain');
    fs.readFile(path.join(__dirname, name), (err, buf) => err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, buf, MIME[path.extname(name)]));
  } catch (e) {
    send(res, e.status === 429 || e.status === 503 ? 503 : 502, { error: e.message });
  }
});

/* ───────────── Lobbys multijoueur ─────────────
   Messages (JSON, champ t) :
   joueur → serveur : create | join {code} | to-host {data} | broadcast {data} (hôte) | to {id, data} (hôte) | ping
   serveur → joueur : created {code, you} | joined {code, you} | error {msg} | from {id, data} (vers l'hôte)
                      peer-join {id} | peer-left {id} (vers l'hôte) | msg {data} (vers les joueurs) | closed */
const rooms = new Map();                       // code → { host: ws, peers: Map(id → ws) }
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); } while (rooms.has(c)); return c; };
const rid = () => Math.random().toString(36).slice(2, 9);
const out = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 * 1024 });
wss.on('connection', ws => {
  ws.id = rid(); ws.alive = true; ws.room = null; ws.isHost = false;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    ws.alive = true;
    const room = ws.room && rooms.get(ws.room);
    switch (m.t) {
      case 'create': {
        const code = newCode();
        rooms.set(code, { host: ws, peers: new Map() });
        ws.room = code; ws.isHost = true;
        out(ws, { t: 'created', code, you: ws.id });
        break;
      }
      case 'join': {
        const code = String(m.code || '').toUpperCase().slice(0, 4), r = rooms.get(code);
        if (!r) return out(ws, { t: 'error', msg: 'Partie introuvable ou terminée.' });
        r.peers.set(ws.id, ws); ws.room = code;
        out(ws, { t: 'joined', code, you: ws.id });
        out(r.host, { t: 'peer-join', id: ws.id });
        break;
      }
      case 'to-host': if (room && !ws.isHost) out(room.host, { t: 'from', id: ws.id, data: m.data }); break;
      case 'broadcast': if (room && ws.isHost) for (const p of room.peers.values()) out(p, { t: 'msg', data: m.data }); break;
      case 'to': if (room && ws.isHost) { const p = room.peers.get(m.id); if (p) out(p, { t: 'msg', data: m.data }); } break;
      case 'ping': out(ws, { t: 'pong' }); break;
    }
  });
  ws.on('close', () => {
    const room = ws.room && rooms.get(ws.room);
    if (!room) return;
    if (ws.isHost) {                            // l'hôte part : le lobby ferme
      for (const p of room.peers.values()) { out(p, { t: 'closed' }); p.room = null; }
      rooms.delete(ws.room);
    } else {
      room.peers.delete(ws.id);
      out(room.host, { t: 'peer-left', id: ws.id });
    }
  });
});
// battement de cœur : on coupe les connexions mortes (onglet fermé, réseau perdu)
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch { } } }, 30000);

server.listen(PORT, () => console.log(`NutriDeck → http://localhost:${PORT}`));
