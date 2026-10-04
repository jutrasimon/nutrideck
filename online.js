'use strict';
/* NutriDeck — multijoueur en ligne (Devine le score).
   Un hôte (navigateur) fait tourner la partie et envoie l'état complet à chaque changement ;
   les joueurs affichent cet état et renvoient leur réponse. Le serveur ne fait que relayer.
   Ultra casual : un joueur qui part disparaît de la liste, l'hôte qui part ferme le lobby. */

const NAME_KEY = 'nutrideck.player';
const AVATARS = ['😀', '🦊', '🐼', '🐸', '🦁', '🐙', '🐵', '🐯', '🐨', '🐧', '🦄', '🐻', '🐮', '🐷', '🐹', '🐰'];
const ROUNDS = 5, ANSWER_MS = 30000;

/* ───────────── Connexion ───────────── */
const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
function connect() {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl());
    const t = setTimeout(() => { ws.close(); rej(new Error('timeout')); }, 60000);   // Render gratuit : réveil ≈ 50 s
    ws.onopen = () => { clearTimeout(t); res(ws); };
    ws.onerror = () => { clearTimeout(t); rej(new Error('ws')); };
  });
}
function makeNet(ws) {
  const handlers = {};
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } handlers[m.t]?.(m); };
  ws.onclose = () => handlers.__close?.();
  const send = o => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  const ping = setInterval(() => send({ t: 'ping' }), 25000);
  return { on: (t, f) => { handlers[t] = f; }, send, close: () => { clearInterval(ping); handlers.__close = null; ws.close(); } };
}

/* ───────────── Pseudo ───────────── */
const loadMe = () => { try { return JSON.parse(localStorage.getItem(NAME_KEY)) || null; } catch { return null; } };
function askName(title = 'Ton pseudo') {
  return new Promise(res => {
    const saved = loadMe() || { name: '', av: pick(AVATARS) };
    let av = saved.av, done = false;
    const input = h('input', { class: 'field', value: saved.name, placeholder: 'Ex. : Simon', maxlength: 16, enterkeyhint: 'go' });
    const row = h('div', { class: 'emoji-row' }, AVATARS.map(a => h('button', { class: a === av ? 'on' : '', onclick: ev => { av = a; $$('button', row).forEach(b => b.classList.remove('on')); ev.currentTarget.classList.add('on'); } }, a)));
    const finish = v => { if (done) return; done = true; s.close(); res(v); };
    const ok = () => { const name = input.value.trim(); if (!name) return input.focus(); const me = { name, av }; try { localStorage.setItem(NAME_KEY, JSON.stringify(me)); } catch { } finish(me); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    const s = openSheet(title, h('div', {}, input, h('p', { class: 'scan-hint', style: 'text-align:left;padding:0 0 8px' }, 'Ton avatar'), row,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => finish(null) }, 'Annuler'), h('button', { class: 'btn primary', onclick: ok }, 'C’est parti'))), { onClose: () => finish(null) });
    setTimeout(() => input.focus(), 80);
  });
}
function askJoinCode() {
  const input = h('input', { class: 'field code-field', placeholder: 'ABCD', maxlength: 4, autocapitalize: 'characters', enterkeyhint: 'go' });
  const go = () => { const c = input.value.trim().toUpperCase(); if (c.length === 4) { s.close(); joinOnline(c); } };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  const s = openSheet('Rejoindre une partie', h('div', {}, h('p', { class: 'scan-hint', style: 'text-align:left;padding:0 0 10px' }, 'Entre le code à 4 lettres donné par l’hôte, ou ouvre directement son lien.'), input,
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => s.close() }, 'Annuler'), h('button', { class: 'btn primary', onclick: go }, 'Rejoindre'))));
  setTimeout(() => input.focus(), 80);
}
const shareLink = code => `${location.origin}${location.pathname}#join/${code}`;

/* ───────────── Hôte ───────────── */
async function hostOnline() {
  const me = await askName('Créer une partie');
  if (!me) return;
  const st = openStage('Devine le score · en ligne');
  st.body.replaceChildren(loading('Connexion au serveur…'));
  let ws;
  try { ws = await connect(); } catch { toast('Serveur multijoueur injoignable'); return st.close(); }
  const net = makeNet(ws);
  net.send({ t: 'create' });
  net.on('created', m => runHost(st, net, m.code, m.you, me));
  net.on('__close', () => { if (stageOpen === st) { toast('Connexion perdue'); st.close(); } });
}

function runHost(st, net, code, myId, me) {
  const S = { code, hostId: myId, phase: 'lobby', round: 0, total: ROUNDS, q: null, rev: null, players: [{ id: myId, name: me.name, av: me.av, score: 0, played: 0, last: null, ans: null, host: true }] };
  let deck = [], timer = 0;
  const view = makeView(st, myId, true, {
    start: () => startGame(), answer: k => onAnswer(myId, k), next: () => nextRound(), again: () => backToLobby(),
  });
  st.onClose = () => { clearTimeout(timer); net.close(); };

  const publicState = () => ({
    ...S,
    q: S.q && { ...S.q, left: Math.max(0, S.q.deadline - Date.now()) },
    players: S.players.map(p => ({ ...p, ans: S.phase === 'question' ? (p.ans != null ? 'ok' : null) : p.ans })),  // pendant la question, on ne montre pas les réponses des autres
  });
  const push = () => { const s = publicState(); net.send({ t: 'broadcast', data: { kind: 'state', s } }); view.render({ ...s, players: S.players.map(p => ({ ...p, ans: p.id === myId ? p.ans : s.players.find(x => x.id === p.id).ans })) }); };

  net.on('peer-join', () => { });
  net.on('peer-left', m => {
    S.players = S.players.filter(p => p.id !== m.id);
    if (S.phase === 'question' && S.players.every(p => p.ans != null)) reveal(); else push();
  });
  net.on('from', m => {
    const d = m.data || {};
    if (d.kind === 'hello') {
      if (!S.players.some(p => p.id === m.id)) S.players.push({ id: m.id, name: String(d.name || 'Joueur').slice(0, 16), av: AVATARS.includes(d.av) ? d.av : '😀', score: 0, played: 0, last: null, ans: null });
      push();
    } else if (d.kind === 'answer') onAnswer(m.id, d.k, d.round);
  });

  async function startGame() {
    S.phase = 'loading'; push();
    try { deck = await buildDeck(ROUNDS, p => p.nutri && (p.eco || p.nova)); }
    catch { toast('Open Food Facts ne répond pas, réessaie'); S.phase = 'lobby'; return push(); }
    S.players.forEach(p => { p.score = 0; p.played = 0; p.last = null; p.ans = null; });
    S.round = 0; ask();
  }
  function ask() {
    const p = deck[S.round];
    const type = pick(['nutri', ...(p.eco ? ['eco'] : []), ...(p.nova ? ['nova'] : [])]);
    S.q = { type, product: { ...p, nutri: null, eco: null, nova: null }, deadline: Date.now() + ANSWER_MS };
    S.rev = null; S.players.forEach(p => { p.ans = null; });
    S.phase = 'question';
    clearTimeout(timer); timer = setTimeout(reveal, ANSWER_MS + 300);
    push();
  }
  function onAnswer(id, k, round = S.round) {
    if (S.phase !== 'question' || round !== S.round) return;
    const pl = S.players.find(p => p.id === id); if (!pl || pl.ans != null) return;
    const n = GUESS_TYPES[S.q.type].opts.length;
    if (!(k >= 0 && k < n)) return;
    pl.ans = k;
    if (S.players.every(p => p.ans != null)) reveal(); else push();
  }
  function reveal() {
    if (S.phase !== 'question') return;
    clearTimeout(timer);
    const p = deck[S.round], T = GUESS_TYPES[S.q.type], truth = T.get(p);
    S.players.forEach(pl => { const pts = pl.ans == null ? 0 : closePts(Math.abs(pl.ans - truth)); pl.score += pts; pl.played++; pl.last = pts; });
    S.rev = { truth, product: p };
    S.phase = 'reveal'; push();
  }
  function nextRound() {
    if (S.phase !== 'reveal') return;
    S.round++;
    if (S.round >= ROUNDS) { S.phase = 'end'; return push(); }
    ask();
  }
  function backToLobby() { S.phase = 'lobby'; S.q = S.rev = null; S.players.forEach(p => { p.score = 0; p.played = 0; p.last = null; p.ans = null; }); push(); }
  push();
}

/* ───────────── Joueur ───────────── */
async function joinOnline(code) {
  const me = await askName('Rejoindre la partie ' + code);
  if (!me) return;
  const st = openStage('Devine le score · en ligne');
  st.body.replaceChildren(loading('Connexion au lobby ' + code + '…'));
  let ws;
  try { ws = await connect(); } catch { toast('Serveur multijoueur injoignable'); return st.close(); }
  const net = makeNet(ws);
  let myId = null, view = null, lastS = null;
  st.onClose = () => net.close();
  net.send({ t: 'join', code });
  net.on('error', m => { toast(m.msg || 'Impossible de rejoindre'); st.close(); });
  net.on('joined', m => {
    myId = m.you;
    view = makeView(st, myId, false, { answer: k => { net.send({ t: 'to-host', data: { kind: 'answer', k, round: lastS?.round } }); view.localAnswer(k); } });
    net.send({ t: 'to-host', data: { kind: 'hello', name: me.name, av: me.av } });
  });
  net.on('msg', m => { if (m.data?.kind === 'state' && view) { lastS = m.data.s; view.render(lastS); } });
  net.on('closed', () => { toast('L’hôte a fermé la partie'); st.close(); });
  net.on('__close', () => { if (stageOpen === st) { toast('Connexion perdue'); st.close(); } });
}

/* ───────────── Affichage (commun hôte / joueurs) ───────────── */
function makeView(st, myId, isHost, act) {
  let key = '', ui = {}, myAns = null, localDeadline = 0, tick = 0;
  st.onClose = st.onClose || null;

  function roster(s) {
    st.setPlayers(s.players.map(p => {
      let status = null, statusCls = '';
      if (s.phase === 'question') { status = p.ans != null ? '✓ a répondu' : 'réfléchit…'; statusCls = p.ans != null ? 'st-ok' : 'st-wait'; }
      else if (s.phase === 'reveal' && s.q) { status = p.ans == null ? 'pas de réponse' : `${GUESS_TYPES[s.q.type].lab(p.ans)} · ${p.last > 0 ? '+' + p.last : '0'}`; }
      else if (s.phase === 'lobby') status = p.host ? 'hôte' : 'prêt';
      return { id: p.id, name: p.name + (p.id === myId ? ' (toi)' : ''), av: p.av, points: p.score, played: p.played, last: s.phase === 'lobby' ? null : p.last, me: p.id === myId, status, statusCls };
    }));
    const mine = s.players.find(p => p.id === myId); if (mine) st.setScore(mine.score);
    st.roundLabel = s.phase === 'lobby' ? `${s.players.length} en ligne` : s.phase === 'end' ? 'Partie terminée' : null;
    st.setRound(Math.min(s.round, s.total - 1), s.total);
  }

  function lobby(s) {
    const link = shareLink(s.code);
    const copy = h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(link); toast('Lien copié, envoie-le à tes amis'); } catch { linkInput.select(); } } }, 'Copier le lien');
    const linkInput = h('input', { class: 'field selectable', value: link, readonly: true, onclick: e => e.currentTarget.select() });
    const n = s.players.length;
    st.body.replaceChildren(h('div', { class: 'lobby fade-in' },
      h('small', {}, 'Code de la partie'), h('div', { class: 'lobby-code' }, s.code),
      isHost ? h('div', { class: 'lobby-share' }, linkInput, h('div', { class: 'btn-row' }, copy,
        navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ title: 'NutriDeck', text: 'Viens jouer à Devine le score !', url: link }).catch(() => { }) }, 'Partager') : null)) : null,
      h('p', { class: 'lobby-count' }, `${n} joueur${n > 1 ? 's' : ''} dans le lobby`),
      h('ul', { class: 'lobby-list' }, s.players.map(p => h('li', {}, h('span', {}, p.av), p.name, p.host ? h('em', {}, 'hôte') : null))),
      isHost ? h('button', { class: 'btn primary big', onclick: act.start }, n > 1 ? `Lancer la partie (${ROUNDS} manches)` : 'Lancer quand même (seul)')
        : h('p', { class: 'wait-t' }, 'En attente que l’hôte lance la partie…')));
    st.clearSide();
  }

  function question(s, fresh) {
    const T = GUESS_TYPES[s.q.type], p = s.q.product;
    if (fresh) {
      myAns = null; localDeadline = Date.now() + s.q.left;
      const card = cardEl(p, { hide: true, focus: s.q.type });
      card.addEventListener('click', e => { if (!e.target.closest('a')) card.classList.toggle('flipped'); });
      ui.cw = h('div', { class: 'single-card' }, card);
      ui.btns = T.opts.map((_, k) => h('button', { class: 'ans', style: `--c:${T.col(k)}`, onclick: () => { if (myAns != null) return; myAns = k; act.answer(k); sync(); } }, h('b', {}, T.lab(k)), h('small', {}, T.subs[k])));
      ui.timer = h('div', { class: 'qtimer' }, h('i'));
      ui.status = h('p', { class: 'tip' });
      ui.fb = h('div', { class: 'feedback' }, ui.status);
      st.body.replaceChildren(h('div', { class: 'single fit' },
        dots(s.round, s.total), catTheme(st, s.q.type),
        h('div', { class: 'brief' }, h('b', {}, T.q), h('span', {}, `Touche la carte pour lire ${s.q.type === 'eco' ? 'les indices environnementaux' : s.q.type === 'nova' ? 'les ingrédients et additifs' : 'les nutriments'}`)),
        ui.cw, h('div', { class: 'answers n' + T.opts.length }, ui.btns), ui.timer, ui.fb));
      st.setInfo(s.q.type); st.setProduct(p);
      const bar = ui.timer.firstChild;
      bar.style.transition = 'none'; bar.style.width = (s.q.left / ANSWER_MS * 100) + '%';
      requestAnimationFrame(() => { bar.style.transition = `width ${s.q.left}ms linear`; bar.style.width = '0%'; });
      clearInterval(tick); tick = setInterval(sync, 500);
    }
    const mine = s.players.find(x => x.id === myId);
    if (mine && mine.ans != null && myAns == null && isHost) myAns = mine.ans;
    ui.s = s; sync();
  }
  function sync() {
    const s = ui.s; if (!s || s.phase !== 'question') return;
    const answered = s.players.filter(p => p.ans != null).length, left = Math.max(0, Math.ceil((localDeadline - Date.now()) / 1000));
    ui.btns.forEach((b, j) => { b.disabled = myAns != null; b.classList.toggle('picked', j === myAns); });
    ui.status.textContent = myAns != null ? `Réponse envoyée · ${answered}/${s.players.length} ont répondu · ${left} s` : `Choisis ta réponse · ${left} s`;
    ui.timer.classList.toggle('urgent', left <= 5);
  }

  async function reveal(s) {
    clearInterval(tick);
    const T = GUESS_TYPES[s.q.type], p = s.rev.product, truth = s.rev.truth;
    const mine = s.players.find(x => x.id === myId), k = mine?.ans;
    if (!ui.cw) question({ ...s, phase: 'question', q: { ...s.q, left: 0 } }, true);
    ui.btns.forEach(b => { b.disabled = true; });
    const reel = h('div', { class: 'reel spin' }, h('b', {}, '?'));
    ui.fb.replaceChildren(reel, h('div', { class: 'fb-txt' }, h('b', { class: 'wait-t' }, 'Et la réponse est…')));
    ui.timer.remove();
    for (let n = 0; n < 14; n++) { if (key !== 'r' + s.round) return; reel.firstChild.textContent = n < 13 ? T.lab(Math.floor(Math.random() * T.opts.length)) : T.lab(truth); sfx.tick(n); await sleep(55 + n * 16); }
    reel.classList.remove('spin'); reel.classList.add('land'); reel.style.setProperty('--c', T.col(truth));
    ui.btns.forEach((b, j) => { b.classList.toggle('right', j === truth); b.classList.toggle('wrong', j === k && j !== truth); b.classList.remove('picked'); });
    const real = cardEl(p, { focus: s.q.type }); real.classList.add('reveal-pop');
    real.addEventListener('click', e => { if (!e.target.closest('a')) real.classList.toggle('flipped'); });
    ui.cw.replaceChildren(real);
    const pts = mine?.last || 0, d = k == null ? 9 : Math.abs(k - truth);
    if (d === 0) { sfx.ok(); vibrate([15, 30, 15]); confetti(reel, 34); } else if (d === 1) sfx.ok(); else { sfx.bad(); shake(reel); }
    const ptsEl = h('div', { class: 'pts ' + (pts ? 'up' : 'zero') }, '0');
    const ranked = [...s.players].sort((a, b) => b.last - a.last);
    const best = ranked[0];
    ui.fb.replaceChildren(reel,
      h('div', { class: 'fb-txt' }, ptsEl, h('span', { class: 'fade-in' }, k == null ? 'Pas de réponse à temps.' : d === 0 ? 'En plein dans le mille !' : d === 1 ? 'Tout près.' : d === 2 ? 'Un peu loin…' : 'Complètement à côté.'),
        best && best.last > 0 && s.players.length > 1 ? h('span', { class: 'fade-in' }, `Meilleure manche : ${best.av} ${best.name}`) : null),
      isHost ? h('button', { class: 'btn primary fade-in', onclick: act.next }, s.round + 1 < s.total ? 'Manche suivante' : 'Voir le classement')
        : h('span', { class: 'wait-t fade-in small' }, 'L’hôte lance la suite…'));
    countUp(ptsEl, pts, { dur: 600, fmtv: v => (pts ? '+' : '') + Math.round(v), tick: false });
    st.setExplain(explainScore(s.q.type, p));
  }

  function end(s) {
    clearInterval(tick); st.clearSide();
    const ranked = [...s.players].sort((a, b) => b.score - a.score);
    const meRank = ranked.findIndex(p => p.id === myId) + 1;
    st.body.replaceChildren();
    const panel = h('div', { class: 'result' + (meRank === 1 ? ' win' : '') },
      h('h3', {}, meRank === 1 ? '🏆 Victoire !' : `Tu finis ${meRank}e sur ${ranked.length}`),
      h('ol', { class: 'podium' }, ranked.map((p, i) => h('li', { class: p.id === myId ? 'me' : '' }, h('span', { class: 'pos' }, ['🥇', '🥈', '🥉'][i] || String(i + 1)), h('span', { class: 'av' }, p.av), h('b', {}, p.name), h('em', {}, `${p.score} pts`)))),
      h('div', { class: 'btn-row', style: 'margin-top:16px' },
        h('button', { class: 'btn', onclick: () => stageOpen?.close() }, 'Quitter'),
        isHost ? h('button', { class: 'btn primary', onclick: act.again }, 'Rejouer avec le groupe') : h('span', { class: 'wait-t small' }, 'L’hôte peut relancer une partie')));
    st.body.classList.add('has-result');
    st.body.append(h('div', { class: 'result-overlay clear' }, panel));
    if (meRank === 1) { sfx.win(); setTimeout(() => confetti(panel, 50), 300); }
  }

  return {
    localAnswer(k) { myAns = k; sync(); },
    render(s) {
      roster(s);
      const k = s.phase === 'question' ? 'q' + s.round : s.phase === 'reveal' ? 'r' + s.round : s.phase;
      const fresh = k !== key;
      if (fresh && s.phase !== 'reveal') st.body.classList.remove('has-result');
      if (s.phase === 'lobby') { key = k; delete st.el.dataset.theme; return lobby(s); }
      if (s.phase === 'loading') { if (fresh) { key = k; st.body.classList.remove('has-result'); st.body.replaceChildren(loading('L’hôte pioche les cartes…')); } return; }
      if (s.phase === 'question') { const was = key; key = k; return question(s, was !== k); }
      if (s.phase === 'reveal') { if (fresh) { key = k; reveal(s); } return; }
      if (s.phase === 'end') { if (fresh) { key = k; end(s); } }
    },
  };
}
