'use strict';
/* NutriDeck — cœur : utilitaires, état, Open Food Facts, carte, moteur de drag (« boards »), table, découvrir. */

/* ───────────── Utilitaires ───────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch { } };
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter(k => k != null && k !== false));
  return n;
}
const ICON = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  spread: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="8" height="12" rx="2"/><rect x="13" y="6" width="8" height="12" rx="2"/></svg>',
  dots: '<svg viewBox="0 0 24 24" style="fill:currentColor;stroke:none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  grid: n => `<svg viewBox="0 0 24 24">${{
    s: '<rect x="3.5" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="9.8" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="16" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="3.5" y="9.8" width="4.5" height="4.5" rx="1"/><rect x="9.8" y="9.8" width="4.5" height="4.5" rx="1"/><rect x="16" y="9.8" width="4.5" height="4.5" rx="1"/><rect x="3.5" y="16" width="4.5" height="4.5" rx="1"/><rect x="9.8" y="16" width="4.5" height="4.5" rx="1"/><rect x="16" y="16" width="4.5" height="4.5" rx="1"/>',
    m: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
    l: '<rect x="6" y="3.5" width="12" height="17" rx="2.4"/>'
  }[n]}</svg>`
};

/* ───────────── État & persistance (la table du joueur) ───────────── */
const LS_KEY = 'nutrideck.v1';
const ZONE_EMOJIS = ['🃏', '🏆', '❤️', '🚫', '🥇', '🥗', '🍫', '🧪', '🛒', '⭐', '🔥', '🌱'];
let state = loadState();

function defaultState() {
  return {
    v: 2, seeded: false, onlyScored: true, products: {},
    zones: [
      { id: 'main', kind: 'main', title: 'Ma pioche', emoji: '🃏', items: [] },
      { id: uid(), kind: 'rank', title: 'Classement', emoji: '🏆', items: [] },
      { id: uid(), kind: 'box', title: 'Coups de cœur', emoji: '❤️', items: [] },
    ],
  };
}
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.zones && s.products) return s; } catch { }
  return defaultState();
}
function save() {
  const used = new Set(state.zones.flatMap(z => z.items.flatMap(i => i.codes)));
  for (const c of Object.keys(state.products)) if (!used.has(c)) delete state.products[c];
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { }
  updateBadge();
}
const allCodes = () => state.zones.flatMap(z => z.items.flatMap(i => i.codes));
const inTable = code => allCodes().includes(code);
const snapshot = () => JSON.stringify(state);
function restore(s) { state = JSON.parse(s); save(); renderAll(); }

/* ───────────── Boards : une « surface de cartes » (table, jeux) pilotée par le même moteur ───────────── */
const boards = {};
const tableBoard = boards.table = {
  name: 'table', trash: true, stack: true, flipped: new Set(),
  get zones() { return state.zones; }, get products() { return state.products; },
  root: () => $('#zones'), changed: () => save(),
};
let cur = tableBoard;                         // board actif pendant un drag
const zoneById = (id, b = cur) => b.zones.find(z => z.id === id);
function findItem(id, b = cur) {
  for (const zone of b.zones) {
    const idx = zone.items.findIndex(i => i && i.id === id);
    if (idx >= 0) return { zone, idx, item: zone.items[idx] };
  }
  return null;
}
const boardOf = el => boards[el.closest('[data-board]')?.dataset.board];

/* ───────────── Open Food Facts ───────────── */
const OFF = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,generic_name,brands,quantity,image_front_url,image_front_small_url,nutriscore_grade,nova_group,ecoscore_grade,nutriments,ingredients_text_fr,ingredients_text,allergens_tags,additives_n,additives_tags';
const num = v => { const n = Number(v); return v === '' || v == null || !isFinite(n) ? null : n; };
const grade = g => { g = String(g || '').toLowerCase().replace('-plus', ''); return 'abcde'.includes(g) && g.length === 1 ? g : null; };

/* indices environnementaux (pour les questions Eco-Score) */
const COUNTRY_FR = { france: 'France', spain: 'Espagne', italy: 'Italie', germany: 'Allemagne', belgium: 'Belgique', netherlands: 'Pays-Bas', 'united-kingdom': 'Royaume-Uni', 'united-states': 'États-Unis', canada: 'Canada', switzerland: 'Suisse', portugal: 'Portugal', poland: 'Pologne', greece: 'Grèce', morocco: 'Maroc', turkey: 'Turquie', china: 'Chine', india: 'Inde', brazil: 'Brésil', argentina: 'Argentine', 'ivory-coast': 'Côte d’Ivoire', ghana: 'Ghana', ecuador: 'Équateur', peru: 'Pérou', chile: 'Chili', mexico: 'Mexique', thailand: 'Thaïlande', vietnam: 'Viêt Nam', indonesia: 'Indonésie', 'european-union': 'Union européenne', 'atlantic-ocean': 'océan Atlantique', 'north-east-atlantic-ocean': 'Atlantique Nord-Est', 'northeast-atlantic-ocean': 'Atlantique Nord-Est', 'northwest-atlantic-ocean': 'Atlantique Nord-Ouest', 'north-west-atlantic-ocean': 'Atlantique Nord-Ouest', 'pacific-ocean': 'océan Pacifique', 'indian-ocean': 'océan Indien', 'mediterranean-sea': 'Méditerranée', 'baltic-sea': 'mer Baltique', 'north-sea': 'mer du Nord', 'non-european-union': 'Hors UE', world: 'Monde' };
const MAT_FR = { glass: 'verre', 'clear-glass': 'verre', 'green-glass': 'verre', 'brown-glass': 'verre', plastic: 'plastique', 'pet-1-polyethylene-terephthalate': 'plastique PET', 'hdpe-2-high-density-polyethylene': 'plastique PEHD', 'pp-5-polypropylene': 'plastique PP', 'ps-6-polystyrene': 'polystyrène', 'ldpe-4-low-density-polyethylene': 'plastique PEBD', cardboard: 'carton', 'corrugated-cardboard': 'carton', 'non-corrugated-cardboard': 'carton', paper: 'papier', 'paper-and-fibers': 'papier', metal: 'métal', steel: 'acier', aluminium: 'aluminium', 'heavy-aluminium': 'aluminium', 'light-aluminium': 'aluminium', 'aluminium-and-alloys': 'aluminium', tetra: 'brique', 'tetra-pak': 'brique (Tetra Pak)', 'paper-and-cardboard': 'carton', wood: 'bois' };
const LABEL_FR = { organic: 'Bio', 'eu-organic': 'Bio européen', 'fr:ab-agriculture-biologique': 'AB', 'ab-agriculture-biologique': 'AB', 'fair-trade': 'Équitable', fairtrade: 'Fairtrade', 'fairtrade-international': 'Fairtrade', 'max-havelaar': 'Max Havelaar', 'rainforest-alliance': 'Rainforest Alliance', 'sustainable-seafood-msc': 'MSC pêche durable', msc: 'MSC', asc: 'ASC', 'label-rouge': 'Label Rouge', demeter: 'Demeter', 'nature-et-progres': 'Nature & Progrès', 'bleu-blanc-coeur': 'Bleu-Blanc-Cœur', fsc: 'FSC', pefc: 'PEFC', 'utz-certified': 'UTZ', 'roundtable-on-sustainable-palm-oil': 'RSPO (palme durable)', 'high-environmental-value': 'HVE' };
const prettyTag = t => { t = t.replace(/^\w\w:/, '').replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
function ecoFacts(p) {
  if (!p.ecoscore_data && !p.labels_tags && !p.packaging_materials_tags) return null;
  const adj = (p.ecoscore_data || {}).adjustments || {}, ag = (p.ecoscore_data || {}).agribalyse || {};
  const key = t => t.replace(/^\w\w:/, '');
  let origins = (adj.origins_of_ingredients?.aggregated_origins || []).filter(o => o.origin && o.origin !== 'en:unknown').map(o => [COUNTRY_FR[key(o.origin)] || prettyTag(o.origin), Math.round(o.percent)]);
  if (!origins.length) origins = (p.origins_tags || []).map(t => [COUNTRY_FR[key(t)] || prettyTag(t), 0]);
  const mats = (adj.packaging?.packagings || []).map(x => x.material).filter(m => m && m !== 'en:unknown');
  const packaging = [...new Set((mats.length ? mats : p.packaging_materials_tags || []).map(t => MAT_FR[key(t)] || prettyTag(t).toLowerCase()))];
  const labels = [...new Set((p.labels_tags || []).map(t => LABEL_FR[t] || LABEL_FR[key(t)]).filter(Boolean))];
  const ia = p.ingredients_analysis_tags || [];
  return {
    origins, packaging, labels,
    palm: ia.includes('en:palm-oil') ? true : ia.includes('en:palm-oil-free') ? false : null,
    co2: num(ag.co2_total), cat: ag.name_fr || null, made: (p.manufacturing_places || '').trim(),
  };
}
function normalize(p) {
  const nu = p.nutriments || {};
  const kcal = num(nu['energy-kcal_100g']) ?? (num(nu['energy_100g']) != null ? Math.round(num(nu['energy_100g']) / 4.184) : null);
  const nova = num(p.nova_group);
  const big = p.image_front_url || p.image_front_small_url || '';
  return {
    code: String(p.code),
    name: (p.product_name_fr || p.product_name || p.generic_name || '').trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    qty: (p.quantity || '').trim(),
    img: big,                                  // 400 px : net même sur écran dense
    imgL: big,
    nutri: grade(p.nutriscore_grade),
    eco: grade(p.ecoscore_grade),
    nova: nova >= 1 && nova <= 4 ? nova : null,
    n: {
      kcal, fat: num(nu.fat_100g), sat: num(nu['saturated-fat_100g']), sugars: num(nu.sugars_100g),
      salt: num(nu.salt_100g), fiber: num(nu.fiber_100g), prot: num(nu.proteins_100g),
    },
    ingredients: (p.ingredients_text_fr || p.ingredients_text || '').trim(),
    allergens: (p.allergens_tags || []).map(a => a.replace(/^\w\w:/, '').replace(/-/g, ' ')),
    additives: num(p.additives_n) ?? (p.additives_tags ? p.additives_tags.length : null),
    adds: (p.additives_tags || []).map(t => t.replace(/^\w\w:/, '').toUpperCase()),
    url: `https://world.openfoodfacts.org/product/${p.code}`,
    ecoInfo: ecoFacts(p),
  };
}
async function getJSON(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const searchCache = new Map();
async function searchOFF(q, page = 1) {
  const key = q.toLowerCase() + '|' + page;
  if (searchCache.has(key)) return searchCache.get(key);
  let d;
  try { d = await getJSON(`/api/search?q=${encodeURIComponent(q)}&page=${page}`); }      // relais NutriDeck (Search-a-licious + cache)
  catch (e) {
    if (e.message === 'HTTP 503') throw e;
    const u = new URL(OFF + '/cgi/search.pl');                                          // repli : API historique (très limitée)
    Object.entries({ search_terms: q, search_simple: 1, action: 'process', json: 1, page_size: 36, page, fields: FIELDS }).forEach(([k, v]) => u.searchParams.set(k, v));
    d = await getJSON(u);
  }
  const out = { list: (d.products || []).map(normalize), pageCount: d.page_count || 0 };
  searchCache.set(key, out);
  return out;
}
async function lookupBarcode(code) {
  let d;
  try { d = await getJSON(`/api/product/${encodeURIComponent(code)}`); if (d.product) d.status = 1; }
  catch { d = await getJSON(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`); }
  return d.status === 1 && d.product ? normalize({ ...d.product, code: d.product.code || code }) : null;
}
const usable = (p, scored) => p.name && p.img && (!scored || p.nutri);

/* ───────────── La carte ───────────── */
const NS = ['a', 'b', 'c', 'd', 'e'];
const NOVA_TXT = ['', 'Non transformé', 'Peu transformé', 'Transformé', 'Ultra-transformé'];
const ROWS = [
  { k: 'kcal', l: 'Énergie', u: ' kcal', max: 600, t: 'neutral' },
  { k: 'fat', l: 'Graisses', u: ' g', max: 40, lo: 3, hi: 17.5 },
  { k: 'sat', l: 'Sat.', u: ' g', max: 15, lo: 1.5, hi: 5 },
  { k: 'sugars', l: 'Sucres', u: ' g', max: 50, lo: 5, hi: 22.5 },
  { k: 'salt', l: 'Sel', u: ' g', max: 3, lo: .3, hi: 1.5 },
  { k: 'fiber', l: 'Fibres', u: ' g', max: 12, t: 'good' },
  { k: 'prot', l: 'Protéines', u: ' g', max: 30, t: 'good' },
];
const fmt = v => v == null ? '—' : (v >= 100 ? Math.round(v) : +v.toFixed(1)).toString().replace('.', ',');
const nutriScale = (g, hide) => `<div class="ns ${g && !hide ? '' : 'none'}" data-guide="nutri">${NS.map(l => `<span class="${l === g && !hide ? 'on' : ''}">${l.toUpperCase()}</span>`).join('')}</div>`;
const novaPill = (n, hide) => `<span class="pill ${n && !hide ? 'nova-' + n : 'none'}" data-guide="nova"><i>NOVA</i><b>${n && !hide ? n : '?'}</b></span>`;
const ecoPill = (g, hide) => `<span class="pill ${g && !hide ? 'eco-' + g : 'none'}" data-guide="eco"><i>ECO</i><b>${g && !hide ? g.toUpperCase() : '?'}</b></span>`;
const kcalPill = (p, hide) => `<span class="pill kcal"><i>KCAL</i><b>${hide ? '?' : fmt(p.n.kcal)}</b></span>`;

function barRow(r, p) {
  const v = p.n[r.k];
  const cls = r.t || (v == null ? 'neutral' : v <= r.lo ? 'lo' : v > r.hi ? 'hi' : 'mid');
  const w = v == null ? 0 : Math.max(3, Math.min(100, v / r.max * 100));
  return `<div class="bar ${cls}"><label>${r.l}</label><div class="track"><span class="fill" style="width:${w}%"></span></div><output>${fmt(v)}${v == null ? '' : r.u}</output></div>`;
}

/* additifs courants : code E → nom en clair */
const ADD_NAMES = {
  E100: 'curcumine', E120: 'cochenille', E150A: 'caramel', E150D: 'caramel au sulfite d’ammonium', E160A: 'carotènes', E160C: 'paprika', E162: 'rouge de betterave', E170: 'carbonate de calcium', E171: 'dioxyde de titane',
  E202: 'sorbate de potassium', E211: 'benzoate de sodium', E220: 'sulfites', E250: 'nitrite de sodium', E252: 'nitrate de potassium', E270: 'acide lactique', E290: 'dioxyde de carbone', E296: 'acide malique',
  E300: 'acide ascorbique', E301: 'ascorbate de sodium', E306: 'tocophérols', E316: 'érythorbate de sodium', E322: 'lécithines', E322I: 'lécithine', E325: 'lactate de sodium', E330: 'acide citrique', E331: 'citrates de sodium', E332: 'citrates de potassium', E334: 'acide tartrique', E385: 'EDTA calcique disodique', E392: 'extrait de romarin', E330I: 'acide citrique', E500II: 'bicarbonate de sodium', E503II: 'bicarbonate d’ammonium', E202I: 'sorbate de potassium', E338: 'acide phosphorique', E339: 'phosphates de sodium', E340: 'phosphates de potassium', E341: 'phosphates de calcium',
  E401: 'alginate de sodium', E407: 'carraghénanes', E410: 'farine de caroube', E412: 'gomme guar', E414: 'gomme arabique', E415: 'gomme xanthane', E418: 'gomme gellane', E420: 'sorbitol', E422: 'glycérol', E440: 'pectines', E450: 'diphosphates', E451: 'triphosphates', E452: 'polyphosphates',
  E460: 'cellulose', E466: 'carboxyméthylcellulose', E471: 'mono- et diglycérides', E472E: 'esters DATEM', E475: 'esters polyglycériques', E476: 'PGPR', E481: 'stéaroyl-lactylate de sodium', E500: 'carbonates de sodium', E501: 'carbonates de potassium', E503: 'carbonates d’ammonium', E508: 'chlorure de potassium', E509: 'chlorure de calcium',
  E621: 'glutamate monosodique', E627: 'guanylate disodique', E631: 'inosinate disodique', E635: 'ribonucléotides', E901: 'cire d’abeille', E903: 'cire de carnauba', E920: 'L-cystéine', E941: 'azote', E950: 'acésulfame K', E951: 'aspartame', E955: 'sucralose', E960: 'stévia', E965: 'maltitol', E1400: 'dextrine', E1404: 'amidon oxydé', E1414: 'amidon modifié', E1420: 'amidon modifié', E1422: 'amidon modifié', E1442: 'amidon modifié', E1450: 'amidon modifié', E1520: 'propylène glycol',
};
/* allergènes : les étiquettes OFF sont en anglais (en:milk…) → français */
const ALLERGENS_FR = { gluten: 'gluten', crustaceans: 'crustacés', eggs: 'œufs', fish: 'poisson', peanuts: 'arachides', soybeans: 'soja', milk: 'lait', nuts: 'fruits à coque', celery: 'céleri', mustard: 'moutarde', 'sesame seeds': 'sésame', 'sulphur dioxide and sulphites': 'sulfites', lupin: 'lupin', molluscs: 'mollusques' };
const allergensFr = list => [...new Set(list.map(a => (ALLERGENS_FR[a.toLowerCase()] || a).toLowerCase()))];
const addName = code => ADD_NAMES[code] || ADD_NAMES[code.replace(/[A-Z]+$/, '')] || '';
function addsBlock(p) {
  const list = p.adds || [];
  if (!list.length) return p.additives === 0 ? '<div class="adds"><b>Additifs</b> <span class="none">aucun détecté</span></div>' : '';
  return `<div class="adds"><b>Additifs (${list.length})</b><div class="add-list">${list.map(c => `<span class="addv" title="${esc(addName(c))}">${esc(c)}${addName(c) ? `<i> · ${esc(addName(c))}</i>` : ''}</span>`).join('')}</div></div>`;
}

/* opts : big (focus), hide (scores cachés — jeux) */
function ecoBack(p) {
  const E = p.ecoInfo;
  const row = (label, val) => `<div class="eco-row"><small>${label}</small><b>${val || '<em>non renseigné</em>'}</b></div>`;
  return `<div class="eco-facts">
    ${row('Origine des ingrédients', E?.origins?.length ? esc(E.origins.map(([n, pc]) => pc > 0 && pc < 100 ? `${n} ${pc} %` : n).join(' · ')) : '')}
    ${row('Emballage', E?.packaging?.length ? esc(E.packaging.join(', ')) : '')}
    ${row('Labels', E ? (E.labels.length ? esc(E.labels.join(', ')) : 'aucun label') : '')}
    ${row('Huile de palme', E?.palm === true ? 'oui' : E?.palm === false ? 'non' : '')}
    ${E?.co2 != null ? row('Empreinte carbone', `${fmt(E.co2)} kg CO₂e par kg`) : ''}
  </div>`;
}
function cardEl(p, { big = false, hide = false, mini = false, focus = null } = {}) {
  const F = settings.front, B = settings.back;
  const g = hide ? 'u' : (p.nutri || 'u');
  const d = h('div', { class: 'card' + (mini ? ' cmini' : '') });
  d.style.setProperty('--g', `var(--g-${g})`);
  const frontScores = hide ? '' : [F.nutri && nutriScale(p.nutri, hide), F.nova && novaPill(p.nova, hide), F.eco && ecoPill(p.eco, hide), F.kcal && kcalPill(p, hide)].filter(Boolean).join('');
  const backScores = B.scores && !hide ? [nutriScale(p.nutri, hide), novaPill(p.nova, hide), ecoPill(p.eco, hide)].join('') : '';
  const bars = focus === 'eco' || focus === 'nova' ? '' : ROWS.filter(r => B[r.k]).map(r => barRow(r, p)).join('');
  const meta = [B.allergens && p.allergens.length ? `<b>Allergènes</b> · ${esc(allergensFr(p.allergens).join(', '))}` : '', ''].filter(Boolean).join('<br>');
  d.innerHTML = `<div class="card-inner">
    ${F.art && F.brand && p.brand ? `<span class="brand">${esc(p.brand)}</span>` : ''}
    <div class="face front${F.art ? '' : ' noart'}">
      ${F.art ? `<div class="art">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="ph">🥫</span>`}${mini && !hide && p.nutri ? `<span class="mini-grade" style="--c:var(--g-${p.nutri})">${p.nutri.toUpperCase()}</span>` : ''}</div>` : ''}
      <div class="info">${F.name ? `<h3>${esc(p.name)}</h3>` : ''}${F.qty ? `<p>${esc(p.qty)}</p>` : ''}${!F.art && F.brand ? `<p class="b2">${esc(p.brand)}</p>` : ''}
        ${frontScores ? `<div class="scores">${frontScores}</div>` : ''}</div>
      <span class="sheen"></span>
    </div>
    <div class="face back">
      ${B.title ? `<h4>${esc(p.name)}</h4>` : ''}
      ${backScores ? `<div class="chips-row">${backScores}</div>` : ''}
      ${B.scores && B.novaText && p.nova && !hide ? `<div class="nova-text"><b>NOVA ${p.nova}</b> · ${NOVA_TXT[p.nova]}</div>` : ''}
      ${focus === 'eco' ? `<div class="focus-tag eco">Indices environnementaux</div>${ecoBack(p)}` : focus === 'nova' ? '<div class="focus-tag nova">Indices de transformation</div>' : ''}
      ${bars ? `<div class="bars">${bars}</div>` : ''}
      ${bars && B.per ? '<div class="per">pour 100 g</div>' : ''}
      ${focus === 'eco' ? (B.ingredients && p.ingredients ? `<div class="extras"><div class="meta ing wide"><b>Ingrédients</b> · ${esc(p.ingredients)}</div></div>` : '') : `<div class="extras">
        ${B.ingredients && p.ingredients ? `<div class="meta ing${focus ? ' wide' : ''}"><b>Ingrédients</b> · ${esc(p.ingredients)}</div>` : ''}
        ${meta && focus !== 'nova' ? `<div class="meta">${meta}</div>` : ''}
        ${B.additives || focus === 'nova' ? addsBlock(p) : ''}
        ${B.link && !hide ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">Voir sur Open Food Facts ↗</a>` : ''}
      </div>`}
      <span class="sheen"></span>
    </div>
  </div>`;
  const img = d.querySelector('img');
  if (img) img.addEventListener('error', () => img.replaceWith(h('span', { class: 'ph' }, '🥫')));
  return d;
}

/* ───────────── Tri ───────────── */
const CRITERIA = [
  { id: 'nutri', l: 'Nutri-Score', e: '🅰️', v: p => p.nutri ? NS.indexOf(p.nutri) : null },
  { id: 'eco', l: 'Eco-Score', e: '🌍', v: p => p.eco ? NS.indexOf(p.eco) : null },
  { id: 'nova', l: 'Transformation (NOVA)', e: '🏭', v: p => p.nova },
  { id: 'sugars', l: 'Sucres', e: '🍬', v: p => p.n.sugars },
  { id: 'salt', l: 'Sel', e: '🧂', v: p => p.n.salt },
  { id: 'sat', l: 'Graisses saturées', e: '🧈', v: p => p.n.sat },
  { id: 'kcal', l: 'Calories', e: '🔥', v: p => p.n.kcal },
  { id: 'fiber', l: 'Fibres', e: '🌾', v: p => p.n.fiber, higher: true },
  { id: 'prot', l: 'Protéines', e: '💪', v: p => p.n.prot, higher: true },
  { id: 'additives', l: 'Additifs', e: '🧪', v: p => p.additives },
];
function sortZone(zone, crit, bestFirst, products = state.products) {
  const dir = (crit.higher ? -1 : 1) * (bestFirst ? 1 : -1);
  const key = i => crit.v(products[i.codes[0]]);
  zone.items.sort((a, b) => {
    const x = key(a), y = key(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * dir;
  });
}

/* ───────────── Rendu d'un board ───────────── */
function slotEl(item, zone, idx, board) {
  const p = board.products[item.codes[0]];
  const s = h('div', { class: 'slot' + (item.codes.length > 1 ? ' stack' : ''), 'data-item': item.id, 'data-zone': zone.id });
  const card = cardEl(p, { hide: !!board.hide, mini: !!(board.mini || zone.mini) });
  if (board.flipped.has(item.id)) card.classList.add('flipped');
  s.append(card, h('span', { class: 'ind' }));
  const ui = h('div', { class: 'slot-ui' });
  const mark = board.mark?.(item, zone, idx);
  if (mark) ui.append(h('span', { class: 'mark ' + mark.cls }, mark.text));
  else if (zone.kind === 'rank' || zone.kind === 'order') ui.append(h('span', { class: 'rank' + (idx < 3 && zone.kind === 'rank' ? ' r' + (idx + 1) : '') }, String(idx + 1)));
  if (!board.noExpand) ui.append(h('button', { class: 'mini tr', 'data-act': 'expand', 'aria-label': 'Agrandir', html: ICON.expand }));
  if (item.codes.length > 1) {
    const gs = item.codes.slice(1, 3).map(c => board.products[c]?.nutri || 'u');
    s.style.setProperty('--l1', `var(--g-${gs[0]})`); s.style.setProperty('--l2', `var(--g-${gs[1] || gs[0]})`);
    ui.append(h('div', { class: 'stackbar' },
      h('button', { class: 'sb-count', 'data-act': 'stack', 'aria-label': 'Voir la pile' }, '×' + item.codes.length),
      h('button', { class: 'sb-split', 'data-act': 'spread', 'aria-label': 'Défaire la pile', html: ICON.spread })));
  }
  s.append(ui);
  return s;
}
function zoneEl(zone, board) {
  const n = zone.items.reduce((a, i) => a + (i ? i.codes.length : 0), 0);
  const z = h('section', { class: `zone zone-${zone.kind}`, 'data-zone': zone.id });
  const grid = h('div', { class: 'grid' });
  if (zone.n) for (let i = 0; i < zone.n; i++) {                 // cases numérotées : chaque position est une vraie case de dépôt
    const it = zone.items[i];
    const first = zone.items.findIndex(x => !x), end = i === 0 ? 0 : i === zone.n - 1 ? 1 : -1;
    const cell = it ? slotEl(it, zone, i, board) : h('div', { class: 'slot-ph' + (i === first ? ' next' : ''), style: `--i:${(i / (zone.n - 1)).toFixed(2)}` },
      h('b', {}, String(i + 1)), zone.ends && end >= 0 ? h('small', {}, zone.ends[end]) : null);
    cell.dataset.pos = i; grid.append(cell);
  }
  else zone.items.forEach((it, i) => grid.append(slotEl(it, zone, i, board)));

  if (zone.kind === 'tier') {
    z.style.setProperty('--tc', zone.color);
    z.append(h('div', { class: 'tier-label' }, h('b', {}, zone.label), zone.sub ? h('small', {}, zone.sub) : null), grid);
    return z;
  }
  if (zone.kind === 'deck' || zone.kind === 'order') {
    if (zone.title) z.append(h('div', { class: 'zone-sub' }, h('b', {}, zone.title + (zone.count ? ` · ${zone.items.length} restante${zone.items.length > 1 ? 's' : ''}` : '')), zone.hint ? h('span', {}, zone.hint) : null));
    if (!zone.n && !zone.items.length) grid.append(h('div', { class: 'hint', html: zone.empty || 'Glisse des cartes ici.' }));
    z.append(grid);
    return z;
  }
  z.style.setProperty('--h', zone.kind === 'main' ? 262 : zone.kind === 'rank' ? 45 : hue(zone.id));
  z.append(h('div', { class: 'zone-head' },
    h('div', { class: 'zone-emoji' }, zone.emoji),
    h('button', { class: 'zone-title', 'data-act': 'zone-rename' },
      h('h2', {}, zone.title), h('small', {}, `${n} carte${n > 1 ? 's' : ''}${zone.kind === 'rank' ? ' · classement' : zone.kind === 'main' ? ' · à trier' : ''}`)),
    h('button', { class: 'icon-btn', 'data-act': 'zone-menu', 'aria-label': 'Options de la zone', html: ICON.dots })));
  if (zone.kind === 'rank') z.append(h('div', { class: 'legend' }, h('span', {}, 'Meilleur'), h('span', {}, 'Pire')));
  if (!zone.items.length) grid.append(h('div', { class: 'hint', html: `<b>${zone.kind === 'rank' ? '🏁' : '📥'}</b>${zone.kind === 'main' ? 'Ta pioche est vide.<br>Va dans <em>Découvrir</em> pour ajouter des cartes.' : 'Glisse des cartes ici.'}` }));
  z.append(grid);
  return z;
}
function rects(root) {
  const m = new Map();
  $$('.slot', root).forEach(s => m.set(s.dataset.item, s.getBoundingClientRect()));
  return m;
}
function renderBoard(board, animate = true) {
  const root = board.root(); if (!root) return;
  root.dataset.board = board.name;
  const prev = animate ? rects(root) : null;
  root.replaceChildren(...board.zones.map(z => zoneEl(z, board)));
  if (!prev) return;
  $$('.slot', root).forEach(s => {
    const o = prev.get(s.dataset.item);
    if (!o) { s.classList.add('pop'); return; }
    const n = s.getBoundingClientRect();
    const dx = o.left - n.left, dy = o.top - n.top;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    s.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}
const renderTable = (animate = true) => renderBoard(tableBoard, animate);
function updateBadge() {
  const n = allCodes().length;
  const b = $('#count-badge');
  b.textContent = n; b.hidden = !n;
}

/* ───────────── Ajout / retrait (table) ───────────── */
function addProduct(p) {
  if (inTable(p.code)) return false;
  state.products[p.code] = p;
  let main = state.zones.find(z => z.kind === 'main');
  if (!main) { main = { id: 'main', kind: 'main', title: 'Ma pioche', emoji: '🃏', items: [] }; state.zones.unshift(main); }
  main.items.unshift({ id: uid(), codes: [p.code] });
  save();
  return true;
}
function removeItem(id) {
  const f = findItem(id, tableBoard); if (!f) return;
  const snap = snapshot();
  f.zone.items.splice(f.idx, 1);
  tableBoard.flipped.delete(id);
  save(); renderTable();
  toast('Carte retirée', { action: 'Annuler', onAction: () => restore(snap) });
}
function moveItemToZone(id, zoneId) {
  const f = findItem(id, tableBoard), dest = zoneById(zoneId, tableBoard);
  if (!f || !dest || f.zone === dest) return;
  f.zone.items.splice(f.idx, 1);
  dest.items.push(f.item);
  save(); renderTable();
}

/* ───────────── Drag & drop (souris + tactile) ───────────── */
let drag = null, justDragged = false, rafScroll = 0;

document.addEventListener('mousedown', e => { if (e.target.closest('.slot[data-item]')) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (drag?.active || e.target.closest?.('.slot, .stage, .board')) e.preventDefault(); });
document.addEventListener('contextmenu', e => { if (e.target.closest('.slot[data-item]')) e.preventDefault(); });
document.addEventListener('pointerdown', e => {
  const slot = e.target.closest('.slot[data-item]');
  if (!slot || e.target.closest('button,a')) return;
  const board = boardOf(slot);
  if (!board || board.locked) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  cur = board;
  const r = slot.getBoundingClientRect();
  drag = { slot, id: slot.dataset.item, pid: e.pointerId, type: e.pointerType, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, active: false, target: null, timer: 0 };
  if (e.pointerType !== 'mouse') drag.timer = setTimeout(beginDrag, 280);
});
window.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pid) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.active) {
    const dist = Math.hypot(drag.x - drag.sx, drag.y - drag.sy);
    if (drag.type === 'mouse') { if (dist > 6) beginDrag(); }
    else if (dist > 10) { clearTimeout(drag.timer); drag = null; }   // c'est un scroll
    return;
  }
  e.preventDefault();
  moveGhost();
}, { passive: false });
document.addEventListener('touchmove', e => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
window.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pid) endDrag(true); });
window.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) endDrag(false); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && drag?.active) endDrag(false); });

function beginDrag() {
  if (!drag || drag.active) return;
  clearTimeout(drag.timer);
  const f = findItem(drag.id); if (!f) { drag = null; return; }
  drag.active = true;
  const ghost = h('div', { class: 'ghost' });
  ghost.style.width = drag.w + 'px';
  ghost.append(cardEl(cur.products[f.item.codes[0]], { hide: !!cur.hide, mini: !!cur.mini }));
  if (cur.flipped.has(drag.id)) ghost.firstChild.classList.add('flipped');
  document.body.append(ghost);
  drag.ghost = ghost;
  drag.slot.classList.add('dragging');
  document.body.classList.add('dragging');
  document.body.classList.toggle('no-trash', !cur.trash);
  try { drag.slot.setPointerCapture?.(drag.pid); } catch { }
  vibrate(14);
  moveGhost();
  const loop = () => {
    if (!drag?.active) return;
    const sc = cur.scroller?.();
    const top = sc ? sc.getBoundingClientRect().top : 56, bot = sc ? sc.getBoundingClientRect().bottom : innerHeight;
    const m = 80;
    const v = drag.y < top + m ? -(top + m - drag.y) / 5 : drag.y > bot - m - 30 ? (drag.y - (bot - m - 30)) / 5 : 0;
    if (v) { const dv = Math.max(-22, Math.min(22, v)); sc ? sc.scrollBy(0, dv) : scrollBy(0, dv); hitTest(); }
    rafScroll = requestAnimationFrame(loop);
  };
  rafScroll = requestAnimationFrame(loop);
}
function moveGhost() {
  const tilt = Math.max(-8, Math.min(8, (drag.x - drag.sx) / 14));
  drag.ghost.style.transform = `translate(${drag.x - drag.ox}px,${drag.y - drag.oy}px) rotate(${tilt}deg) scale(1.06)`;
  hitTest();
}
function clearMarks() {
  $$('.drop-before,.drop-after,.drop-stack,.drop-into').forEach(n => n.classList.remove('drop-before', 'drop-after', 'drop-stack', 'drop-into'));
  $$('.drop-target').forEach(n => n.classList.remove('drop-target'));
  $('#trash').classList.remove('hot');
}
function hitTest() {
  clearMarks();
  drag.target = null;
  const under = document.elementFromPoint(drag.x, drag.y);
  if (!under) return;
  if (cur.trash && under.closest('#trash')) { $('#trash').classList.add('hot'); drag.target = { type: 'trash' }; return; }
  const zoneNode = under.closest('.zone');
  if (!zoneNode || boardOf(zoneNode) !== cur || !cur.zones.some(z => z.id === zoneNode.dataset.zone)) return;
  const zone = zoneById(zoneNode.dataset.zone);
  if (zone.n) {                                                    // zone à cases : on vise la case sous le doigt (ou la plus proche)
    let cell = under.closest('[data-pos]');
    if (!cell || !zoneNode.contains(cell)) {
      let bd = Infinity;
      for (const c of $$('[data-pos]', zoneNode)) { const r = c.getBoundingClientRect(); const d = Math.hypot(drag.x - (r.left + r.width / 2), drag.y - (r.top + r.height / 2)); if (d < bd) { bd = d; cell = c; } }
    }
    if (!cell || cell.dataset.item === drag.id) return;
    cell.classList.add('drop-into'); zoneNode.classList.add('drop-target');
    drag.target = { type: 'cell', zoneId: zone.id, pos: +cell.dataset.pos };
    return;
  }
  const slots = $$('.slot', zoneNode).filter(s => s.dataset.item !== drag.id);
  if (!slots.length) { zoneNode.classList.add('drop-target'); drag.target = { type: 'insert', zoneId: zone.id }; return; }
  const direct = under.closest('.slot');
  if (cur.stack && (zone.kind === 'main' || zone.kind === 'box') && direct && direct.dataset.item !== drag.id) {
    const r = direct.getBoundingClientRect(), rx = (drag.x - r.left) / r.width, ry = (drag.y - r.top) / r.height;
    if (rx > .28 && rx < .72 && ry > .15 && ry < .85) {
      direct.classList.add('drop-stack'); zoneNode.classList.add('drop-target');
      drag.target = { type: 'stack', itemId: direct.dataset.item }; return;
    }
  }
  let best = null, bd = Infinity;
  for (const s of slots) {
    const r = s.getBoundingClientRect();
    const d = Math.hypot(drag.x - (r.left + r.width / 2), (drag.y - (r.top + r.height / 2)) * .8);
    if (d < bd) { bd = d; best = s; }
  }
  const r = best.getBoundingClientRect();
  const after = drag.x > r.left + r.width / 2;
  best.classList.add(after ? 'drop-after' : 'drop-before');
  zoneNode.classList.add('drop-target');
  drag.target = { type: 'insert', zoneId: zone.id, itemId: best.dataset.item, after };
}
function endDrag(commit) {
  const d = drag; drag = null;
  clearTimeout(d.timer);
  if (!d.active) return;
  cancelAnimationFrame(rafScroll);
  d.ghost.remove();
  d.slot.classList.remove('dragging');
  document.body.classList.remove('dragging', 'no-trash');
  clearMarks();
  justDragged = true; setTimeout(() => justDragged = false, 60);
  if (commit && d.target) applyDrop(d.id, d.target);
}
const takeOut = src => { if (src.zone.n) src.zone.items[src.idx] = null; else src.zone.items.splice(src.idx, 1); };
function applyDrop(id, t) {
  const src = findItem(id); if (!src) return;
  if (t.type === 'cell') {
    const dest = zoneById(t.zoneId), occupant = dest.items[t.pos];
    if (occupant === src.item) return;
    takeOut(src);
    if (occupant) {                                                // échange : l'occupant prend la place d'où venait la carte
      if (src.zone.n) src.zone.items[src.idx] = occupant;
      else src.zone.items.splice(src.idx, 0, occupant);
    }
    dest.items[t.pos] = src.item;
    vibrate(8);
    cur.changed(); renderBoard(cur); cur.onMove?.();
    return;
  }
  const snap = cur === tableBoard ? snapshot() : null;
  if (t.type === 'trash') {
    src.zone.items.splice(src.idx, 1); cur.flipped.delete(id);
    cur.changed(); renderBoard(cur); vibrate(10);
    toast('Carte retirée', { action: 'Annuler', onAction: () => restore(snap) });
    return;
  }
  if (t.type === 'stack') {
    const tgt = findItem(t.itemId);
    if (!tgt || tgt.item === src.item) return;
    src.zone.items.splice(src.idx, 1);
    tgt.item.codes = src.item.codes.concat(tgt.item.codes);
    cur.flipped.delete(id); vibrate([8, 30, 8]);
    cur.changed(); renderBoard(cur);
    toast(`Pile de ${tgt.item.codes.length} cartes`, { action: 'Défaire', onAction: () => restore(snap) });
    return;
  }
  const dest = zoneById(t.zoneId);
  const tgtItem = t.itemId ? findItem(t.itemId)?.item : null;
  if (tgtItem === src.item) return;
  takeOut(src);
  const idx = tgtItem ? dest.items.indexOf(tgtItem) + (t.after ? 1 : 0) : dest.items.length;
  dest.items.splice(idx, 0, src.item);
  vibrate(8);
  cur.changed(); renderBoard(cur);
  cur.onMove?.();
}

/* ───────────── Interactions des boards ───────────── */
function flipSlot(slot, board) {
  const card = slot.querySelector('.card');
  const on = card.classList.toggle('flipped');
  const id = slot.dataset.item;
  if (id) on ? board.flipped.add(id) : board.flipped.delete(id);
}
document.addEventListener('click', e => {
  if (justDragged) return;
  const root = e.target.closest('[data-board]'); if (!root) return;
  const board = boards[root.dataset.board]; if (!board) return;
  const act = e.target.closest('[data-act]');
  const slot = e.target.closest('.slot[data-item]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'expand') return focusItem(board, slot.dataset.item);
    if (a === 'stack') return openStack(slot.dataset.item);
    if (a === 'spread') { spreadStack(slot.dataset.item); return toast('Pile défaite'); }
    const zn = act.closest('.zone');
    if (a === 'zone-rename') return renameZone(zn.dataset.zone);
    if (a === 'zone-menu') return zoneMenu(zn.dataset.zone);
    return;
  }
  if (slot && !board.noFlip && !e.target.closest('a')) flipSlot(slot, board);
});

function focusItem(board, id) {
  const f = findItem(id, board); if (!f) return;
  const p = board.products[f.item.codes[0]];
  openFocus(p, {
    flipped: board.flipped.has(id), hide: !!board.hide,
    actions: board === tableBoard ? [
      { l: 'Déplacer', fn: () => moveSheet(id) },
      { l: 'Retirer', cls: 'danger', fn: () => removeItem(id) },
    ] : [],
    onFlip: on => on ? board.flipped.add(id) : board.flipped.delete(id),
    onClose: () => renderBoard(board, false),
  });
}
function moveSheet(id) {
  const f = findItem(id, tableBoard); if (!f) return;
  openMenu('Déplacer vers…', state.zones.filter(z => z !== f.zone).map(z => ({
    e: z.emoji, l: z.title, fn: () => { moveItemToZone(id, z.id); toast(`Déplacée vers ${z.title}`); }
  })));
}
function openStack(id) {
  const f = findItem(id, tableBoard); if (!f) return;
  const body = h('div');
  const rebuild = () => {
    const cur_ = findItem(id, tableBoard);
    if (!cur_) return sheet.close();
    body.replaceChildren(
      h('div', { class: 'stack-grid' }, cur_.item.codes.map((code, i) => {
        const p = state.products[code];
        const cell = h('div', { class: 'cell' }, i === 0 ? h('span', { class: 'top-tag' }, 'Dessus') : null, cardEl(p));
        cell.querySelector('.card').addEventListener('click', ev => ev.currentTarget.classList.toggle('flipped'));
        cell.append(h('div', { class: 'btn-row' },
          cur_.item.codes.length > 1 ? h('button', { class: 'btn', onclick: () => { splitFromStack(id, code); rebuild(); } }, 'Sortir') : null,
          h('button', { class: 'btn danger', onclick: () => { removeFromStack(id, code); rebuild(); } }, 'Retirer')));
        return cell;
      })),
      h('div', { class: 'btn-row', style: 'margin-top:16px' },
        h('button', { class: 'btn primary', onclick: () => { spreadStack(id); sheet.close(); } }, 'Défaire toute la pile')));
  };
  const sheet = openSheet(`Pile de ${f.item.codes.length} cartes`, body);
  rebuild();
}
function splitFromStack(id, code) {
  const f = findItem(id, tableBoard); if (!f || f.item.codes.length < 2) return;
  f.item.codes = f.item.codes.filter(c => c !== code);
  f.zone.items.splice(f.idx + 1, 0, { id: uid(), codes: [code] });
  save(); renderTable();
}
function removeFromStack(id, code) {
  const f = findItem(id, tableBoard); if (!f) return;
  f.item.codes = f.item.codes.filter(c => c !== code);
  if (!f.item.codes.length) f.zone.items.splice(f.idx, 1);
  save(); renderTable();
}
function spreadStack(id) {
  const f = findItem(id, tableBoard); if (!f) return;
  const [first, ...rest] = f.item.codes;
  f.item.codes = [first];
  f.zone.items.splice(f.idx + 1, 0, ...rest.map(c => ({ id: uid(), codes: [c] })));
  save(); renderTable();
}

/* ───────────── Zones de la table ───────────── */
async function renameZone(zid) {
  const z = zoneById(zid, tableBoard);
  const r = await zoneForm('Renommer la zone', z.title, z.emoji);
  if (!r) return;
  z.title = r.title; z.emoji = r.emoji; save(); renderTable(false);
}
function zoneMenu(zid) {
  const z = zoneById(zid, tableBoard), i = state.zones.indexOf(z), fl = tableBoard.flipped;
  const items = [
    { e: '↕️', l: 'Trier les cartes', s: 'Par Nutri-Score, sucres, sel…', fn: () => sortSheet(zid) },
    { e: '✏️', l: 'Renommer', fn: () => renameZone(zid) },
    { e: '🔄', l: 'Retourner toutes les cartes', fn: () => { const ids = z.items.map(x => x.id); const up = ids.every(x => fl.has(x)); ids.forEach(x => up ? fl.delete(x) : fl.add(x)); renderTable(false); } },
  ];
  if (z.items.some(it => it.codes.length > 1)) items.push({ e: '🗂️', l: 'Défaire toutes les piles', fn: () => { z.items.filter(it => it.codes.length > 1).forEach(it => spreadStack(it.id)); } });
  if (i > 0) items.push({ e: '⬆️', l: 'Monter la zone', fn: () => { state.zones.splice(i, 1); state.zones.splice(i - 1, 0, z); save(); renderTable(false); } });
  if (i < state.zones.length - 1) items.push({ e: '⬇️', l: 'Descendre la zone', fn: () => { state.zones.splice(i, 1); state.zones.splice(i + 1, 0, z); save(); renderTable(false); } });
  if (z.items.length) items.push({ e: '🧹', l: 'Vider la zone', cls: 'danger', fn: () => { const snap = snapshot(); z.items = []; save(); renderTable(); toast('Zone vidée', { action: 'Annuler', onAction: () => restore(snap) }); } });
  if (z.kind !== 'main') items.push({ e: '🗑️', l: 'Supprimer la zone', cls: 'danger', fn: () => { const snap = snapshot(); state.zones.splice(i, 1); save(); renderTable(); toast('Zone supprimée', { action: 'Annuler', onAction: () => restore(snap) }); } });
  openMenu(`${z.emoji} ${z.title}`, items);
}
function sortSheet(zid) {
  const z = zoneById(zid, tableBoard);
  const body = h('div', { class: 'menu' }, CRITERIA.map(c => {
    const go = best => { sortZone(z, c, best); save(); renderTable(); sheet.close(); toast(`Trié par ${c.l.toLowerCase()}`); };
    return h('div', { class: 'sort-row' }, h('span', { class: 'em' }, c.e), h('span', { class: 'lbl' }, c.l),
      h('button', { onclick: () => go(true) }, 'Meilleur ▸ pire'), h('button', { onclick: () => go(false) }, 'Pire ▸ meilleur'));
  }));
  const sheet = openSheet('Trier par', body);
}
$('#btn-add-zone').addEventListener('click', () => openMenu('Nouvelle zone', [
  { e: '🏆', l: 'Classement', s: 'Cartes numérotées, du meilleur au moins bon', fn: () => newZone('rank') },
  { e: '📦', l: 'Boîte', s: 'Un bac libre : favoris, à éviter, validé…', fn: () => newZone('box') },
]));
async function newZone(kind) {
  const r = await zoneForm(kind === 'rank' ? 'Nouveau classement' : 'Nouvelle boîte', kind === 'rank' ? 'Mon classement' : '', kind === 'rank' ? '🏆' : '📦');
  if (!r) return;
  state.zones.push({ id: uid(), kind, title: r.title || (kind === 'rank' ? 'Classement' : 'Boîte'), emoji: r.emoji, items: [] });
  save(); renderTable();
  setTimeout(() => $('#zones .zone:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
}

/* ───────────── Sheets, menus, focus, toasts ───────────── */
function openSheet(title, body, { onClose, cls = '' } = {}) {
  const scrim = h('div', { class: 'scrim' });
  const sheet = h('div', { class: 'sheet ' + cls, role: 'dialog', 'aria-label': title }, h('div', { class: 'grab' }), title ? h('h2', {}, title) : null, body);
  scrim.append(sheet);
  document.body.append(scrim);
  document.body.classList.add('modal-open');
  const close = () => {
    if (!scrim.isConnected) return;
    scrim.remove(); removeEventListener('keydown', esc_);
    if (!$('.scrim') && !$('.stage')) document.body.classList.remove('modal-open');
    onClose?.();
  };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', esc_);
  scrim.addEventListener('pointerdown', e => { if (e.target === scrim) close(); });
  return { close, sheet, scrim };
}
function openMenu(title, items) {
  const m = h('div', { class: 'menu' }, items.map(it => h('button', {
    class: it.cls || '', onclick: () => { s.close(); it.fn?.(); }
  }, h('span', { class: 'em' }, it.e || ''), h('span', {}, it.l, it.s ? h('small', {}, it.s) : null))));
  const s = openSheet(title, m);
  return s;
}
function zoneForm(title, name = '', emoji = '📦') {
  return new Promise(res => {
    let chosen = emoji, done = false;
    const input = h('input', { class: 'field', value: name, placeholder: 'Nom de la zone', maxlength: 28, enterkeyhint: 'done' });
    const row = h('div', { class: 'emoji-row' }, [...new Set([emoji, ...ZONE_EMOJIS])].map(e => h('button', {
      class: e === emoji ? 'on' : '', onclick: ev => { chosen = e; $$('button', row).forEach(b => b.classList.remove('on')); ev.currentTarget.classList.add('on'); }
    }, e)));
    const finish = v => { if (done) return; done = true; s.close(); res(v); };
    const ok = () => finish({ title: input.value.trim() || name || 'Sans titre', emoji: chosen });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    const s = openSheet(title, h('div', {}, input, row, h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => finish(null) }, 'Annuler'),
      h('button', { class: 'btn primary', onclick: ok }, 'Valider'))), { onClose: () => finish(null) });
    setTimeout(() => input.focus(), 80);
  });
}
function openFocus(p, { flipped: startFlipped = false, hide = false, actions = [], onFlip, onClose } = {}) {
  const wrap = h('div', { class: 'focus-card' });
  const card = cardEl(p, { big: true, hide });
  if (startFlipped) card.classList.add('flipped');
  wrap.append(card);
  const bar = h('div', { class: 'focus-actions' });
  const s = openSheet('', h('div'), { onClose });
  s.scrim.classList.add('focus');
  s.scrim.replaceChildren(wrap, h('div', { class: 'focus-tip' }, 'Touche la carte pour la retourner · touche un score pour comprendre'), bar);
  const flip = () => { const on = card.classList.toggle('flipped'); onFlip?.(on); };
  card.addEventListener('click', e => {
    const gd = e.target.closest('[data-guide]');
    if (gd) return openGuide(gd.dataset.guide);
    if (!e.target.closest('a')) flip();
  });
  bar.append(h('button', { class: 'btn', onclick: flip }, '↻ Retourner'),
    ...actions.map(a => h('button', { class: 'btn ' + (a.cls || ''), onclick: () => { s.close(); a.fn(); } }, a.l)),
    h('button', { class: 'btn', onclick: s.close }, 'Fermer'));
  const tilt = e => {
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < -.3 || x > 1.3 || y < -.3 || y > 1.3) return reset();
    wrap.classList.add('live', 'tilting');
    wrap.style.setProperty('--ry', ((x - .5) * 16).toFixed(1) + 'deg');
    wrap.style.setProperty('--rx', ((.5 - y) * 16).toFixed(1) + 'deg');
    wrap.style.setProperty('--gx', (x * 100).toFixed(0) + '%'); wrap.style.setProperty('--gy', (y * 100).toFixed(0) + '%');
  };
  const reset = () => { wrap.classList.remove('live', 'tilting'); wrap.style.setProperty('--rx', '0deg'); wrap.style.setProperty('--ry', '0deg'); };
  s.scrim.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) tilt(e); });
  s.scrim.addEventListener('pointerleave', reset);
  s.scrim.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') reset(); });
  return s;
}
function toast(msg, { action, onAction, ms = 4500 } = {}) {
  const t = h('div', { class: 'toast' }, h('span', {}, msg));
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  if (action) t.append(h('button', { onclick: () => { onAction?.(); kill(); } }, action));
  $('#toasts').append(t);
  setTimeout(kill, ms);
}

/* guide des scores */
function openGuide(focus) {
  const scale = (cls, letters, labels) => h('div', { class: 'g-scale' }, letters.map((l, i) => h('div', { class: 'g-step ' + cls(i) }, h('b', {}, l), h('span', {}, labels[i]))));
  const body = h('div', { class: 'guide' },
    h('section', { id: 'g-nutri' }, h('h3', {}, '🅰️ Nutri-Score'),
      h('p', {}, 'Note de A à E sur la qualité nutritionnelle, calculée pour 100 g : les calories, le sucre, le sel et les graisses saturées font baisser la note ; les fibres, les protéines et les fruits-légumes la font monter.'),
      scale(i => 'ns-' + 'abcde'[i], ['A', 'B', 'C', 'D', 'E'], ['Excellent', 'Bon', 'Moyen', 'Médiocre', 'À limiter'])),
    h('section', { id: 'g-nova' }, h('h3', {}, '🏭 NOVA'),
      h('p', {}, 'Classement de 1 à 4 selon le degré de transformation industrielle, pas selon la composition nutritionnelle. Un produit peut être « sain » sur le papier et pourtant très ultra-transformé.'),
      scale(i => 'nv-' + (i + 1), ['1', '2', '3', '4'], ['Brut ou peu transformé', 'Ingrédient culinaire', 'Transformé', 'Ultra-transformé'])),
    h('section', { id: 'g-eco' }, h('h3', {}, '🌍 Eco-Score (Green-Score)'),
      h('p', {}, 'Impact environnemental de A à E : analyse du cycle de vie du produit, puis bonus ou malus pour l’origine, l’emballage et le mode de production.'),
      scale(i => 'ns-' + 'abcde'[i], ['A', 'B', 'C', 'D', 'E'], ['Très faible', 'Faible', 'Modéré', 'Élevé', 'Très élevé'])));
  openSheet('Comprendre les scores', body);
  if (focus) setTimeout(() => $('#g-' + focus, body)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
}

/* ───────────── Découvrir ───────────── */
const CHIPS = [
  ['🥣 Céréales', 'céréales petit déjeuner'], ['🍫 Chocolat', 'chocolat'], ['🍪 Biscuits', 'biscuits'], ['🥤 Sodas', 'soda'],
  ['🧃 Jus', 'jus de fruits'], ['🥛 Yaourts', 'yaourt'], ['🧀 Fromages', 'fromage'], ['🍕 Pizzas', 'pizza surgelée'],
  ['🍝 Pâtes', 'pâtes'], ['🥔 Chips', 'chips'], ['🍞 Pains', 'pain de mie'], ['🥫 Soupes', 'soupe'], ['🍯 Pâtes à tartiner', 'pâte à tartiner'],
  ['🍦 Glaces', 'glace'], ['🥓 Charcuterie', 'jambon'], ['🍅 Sauces', 'sauce tomate'],
];
const disc = { q: '', page: 0, pageCount: 0, items: [], loading: false, seq: 0 };

function buildChips() {
  $('#chips').replaceChildren(...CHIPS.map(([l, q]) => h('button', { class: 'chip-btn', role: 'listitem', 'data-q': q, onclick: () => { $('#q').value = ''; runSearch(q); } }, l)));
}
function markChip(q) { $$('.chip-btn').forEach(c => c.classList.toggle('on', c.dataset.q === q)); }

async function runSearch(q, { page = 1, append = false } = {}) {
  q = q.trim(); if (!q) return;
  const seq = ++disc.seq;
  disc.q = q; disc.loading = true; markChip(q);
  const res = $('#results'), status = $('#status');
  if (!append) {
    disc.items = []; disc.page = 0;
    res.replaceChildren(...Array.from({ length: 6 }, () => h('div', { class: 'skel' })));
    status.textContent = 'Recherche en cours…';
    $('#btn-more').hidden = true;
  }
  $('#btn-more').disabled = true;
  try {
    let list, pageCount = 1;
    if (/^\d{8,14}$/.test(q)) { const p = await lookupBarcode(q); list = p ? [p] : []; }
    else { const r = await searchOFF(q, page); list = r.list; pageCount = r.pageCount; }
    if (seq !== disc.seq) return;
    const scored = $('#only-scored').checked;
    const seen = new Set(disc.items.map(p => p.code));
    list = list.filter(p => (usable(p, scored) || /^\d{8,14}$/.test(q)) && !seen.has(p.code));
    disc.items.push(...list); disc.page = page; disc.pageCount = pageCount;
    renderResults();
  } catch (err) {
    if (seq !== disc.seq) return;
    res.replaceChildren(h('div', { class: 'empty', html: `<big>📡</big><h3>Open Food Facts ne répond pas</h3>La recherche est limitée à quelques requêtes par minute. Patiente un instant puis réessaie (la recherche par code-barres reste disponible).` },
      h('p', { style: 'margin-top:16px' }, h('button', { class: 'primary-btn', onclick: () => runSearch(q) }, 'Réessayer'))));
    status.textContent = '';
  } finally { if (seq === disc.seq) { disc.loading = false; $('#btn-more').disabled = false; } }
}
function renderResults() {
  const res = $('#results'), status = $('#status');
  if (!disc.items.length) {
    res.replaceChildren(h('div', { class: 'empty', html: '<big>🔍</big><h3>Rien de sélectionnable</h3>Essaie un autre mot, ou désactive « Avec Nutri-Score ».' }));
    status.textContent = '';
  } else {
    res.replaceChildren(...disc.items.map(discoverSlot));
    status.innerHTML = `<b>${disc.items.length}</b> produit${disc.items.length > 1 ? 's' : ''} · « ${esc(disc.q)} » · Open Food Facts`;
  }
  $('#btn-more').hidden = !(disc.items.length && disc.page < disc.pageCount && !/^\d{8,14}$/.test(disc.q));
}
function discoverSlot(p) {
  const s = h('div', { class: 'slot pop', 'data-code': p.code });
  s.append(cardEl(p));
  const ui = h('div', { class: 'slot-ui' });
  ui.append(h('button', { class: 'mini tr', 'data-act': 'expand', 'aria-label': 'Agrandir', html: ICON.expand }));
  const added = inTable(p.code);
  ui.append(h('button', { class: 'mini add' + (added ? ' done' : ''), 'data-act': 'add', 'aria-label': added ? 'Déjà dans la table' : 'Ajouter à la table', html: added ? ICON.check : ICON.plus }));
  s.append(ui);
  return s;
}
$('#results').addEventListener('click', e => {
  const slot = e.target.closest('.slot'); if (!slot) return;
  const p = disc.items.find(x => x.code === slot.dataset.code); if (!p) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'add') return addFromDiscover(p, slot);
  if (act === 'expand') {
    return openFocus(p, { actions: [inTable(p.code) ? { l: 'Dans ta table ✓', fn: () => { } } : { l: '＋ Ajouter', cls: 'primary', fn: () => addFromDiscover(p, slot) }] });
  }
  if (!e.target.closest('a')) slot.querySelector('.card').classList.toggle('flipped');
});
function addFromDiscover(p, slot) {
  if (!addProduct(p)) return toast('Déjà dans ta table');
  vibrate(10);
  const b = slot?.querySelector('.mini.add');
  if (b) { b.classList.add('done'); b.innerHTML = ICON.check; }
  toast(`${p.name.slice(0, 32)} ajouté`, { action: 'Voir la table', onAction: () => location.hash = '#table' });
}
$('#search-form').addEventListener('submit', e => { e.preventDefault(); $('#q').blur(); runSearch($('#q').value); });
$('#btn-more').addEventListener('click', () => runSearch(disc.q, { page: disc.page + 1, append: true }));
$('#only-scored').addEventListener('change', e => { state.onlyScored = e.target.checked; save(); if (disc.q) runSearch(disc.q); });
$('#btn-random').addEventListener('click', () => {
  const [, q] = CHIPS[Math.floor(Math.random() * CHIPS.length)];
  $('#q').value = ''; runSearch(q, { page: 1 }); vibrate(8);
});

/* scanner de code-barres (Chrome/Android & co) */
if ('BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia) {
  const btn = $('#btn-scan'); btn.hidden = false;
  btn.addEventListener('click', async () => {
    let stream, stop = false;
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    const s = openSheet('Scanner un code-barres', h('div', {}, h('div', { class: 'scan-box' }, video), h('p', { class: 'scan-hint' }, 'Cadre le code-barres du produit')), {
      onClose: () => { stop = true; stream?.getTracks().forEach(t => t.stop()); }
    });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream; await video.play();
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const tick = async () => {
        if (stop) return;
        try { const r = await det.detect(video); if (r[0]) { vibrate(20); s.close(); $('#q').value = r[0].rawValue; runSearch(r[0].rawValue); return; } } catch { }
        setTimeout(tick, 250);
      };
      tick();
    } catch { s.close(); toast('Caméra inaccessible'); }
  });
}

/* inclinaison + reflet au survol (souris seulement) */
document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || drag?.active || !settings.vars.tilt) return;
  const card = e.target.closest?.('.slot .card');
  const prev = document.querySelector('.card.tilting');
  if (prev && prev !== card) { prev.classList.remove('tilting'); prev.style.removeProperty('--rx'); prev.style.removeProperty('--ry'); }
  if (!card) return;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  card.classList.add('tilting');
  card.style.setProperty('--ry', ((x - .5) * 14).toFixed(1) + 'deg');
  card.style.setProperty('--rx', ((.5 - y) * 14).toFixed(1) + 'deg');
  card.style.setProperty('--gx', (x * 100).toFixed(0) + '%'); card.style.setProperty('--gy', (y * 100).toFixed(0) + '%');
});

/* ───────────── Jeu de démarrage ───────────── */
const SEED_CODES = ['3017620422003', '5449000000996', '8000500310427', '7622210449283', '3175680011480', '3228857000906'];
const DEMO = [
  { code: 'demo1', name: 'Flocons d’avoine', brand: 'Démo', qty: '500 g', nutri: 'a', eco: 'b', nova: 1, n: { kcal: 372, fat: 7, sat: 1.3, sugars: 1.1, salt: .01, fiber: 10, prot: 13 } },
  { code: 'demo2', name: 'Soda cola', brand: 'Démo', qty: '1,5 L', nutri: 'e', eco: 'd', nova: 4, n: { kcal: 42, fat: 0, sat: 0, sugars: 10.6, salt: 0, fiber: 0, prot: 0 } },
  { code: 'demo3', name: 'Pâte à tartiner', brand: 'Démo', qty: '400 g', nutri: 'e', eco: 'd', nova: 4, n: { kcal: 539, fat: 30.9, sat: 10.6, sugars: 56.3, salt: .11, fiber: 3.4, prot: 6.3 } },
  { code: 'demo4', name: 'Yaourt nature', brand: 'Démo', qty: '125 g', nutri: 'a', eco: 'a', nova: 3, n: { kcal: 56, fat: 1.5, sat: 1, sugars: 4.5, salt: .1, fiber: 0, prot: 4.5 } },
].map(p => ({ img: '', imgL: '', ingredients: '', allergens: [], additives: 0, url: 'https://world.openfoodfacts.org', ...p }));

async function seedFirstRun() {
  state.seeded = true; save();
  const got = (await Promise.allSettled(SEED_CODES.map(lookupBarcode))).map(r => r.status === 'fulfilled' ? r.value : null).filter(p => p && p.name);
  (got.length >= 3 ? got : DEMO).slice().reverse().forEach(addProduct);
  renderTable();
  toast(got.length >= 3 ? 'Quelques cartes pour démarrer ✨' : 'Cartes de démo (hors-ligne)');
}

/* ───────────── Navigation ───────────── */
const TABS = ['discover', 'table', 'games', 'lab'];
function route() {
  const mj = location.hash.match(/^#join\/([a-z]{4})$/i);   // lien d'invitation multijoueur
  if (mj) { history.replaceState(null, '', '#games'); route(); joinOnline(mj[1].toUpperCase()); return; }
  const t = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'table';
  TABS.forEach(n => { $('#view-' + n).hidden = n !== t; });
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === t));
  $('#btn-density').hidden = t === 'games' || t === 'lab';
  if (t === 'table') renderTable(false);
  if (t === 'discover' && !disc.q && !disc.items.length) runSearch(CHIPS[Math.floor(Math.random() * CHIPS.length)][1]);
  else if (t === 'discover') renderResults();
  if (t === 'lab') renderPreview();
  if (t === 'games') renderGameList();
  scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

const SIZES = [100, 140, 300];
function densityIcon() {
  const w = settings.vars.cardW;
  $('#btn-density').innerHTML = ICON.grid(w < 125 ? 's' : w < 220 ? 'm' : 'l');
}
$('#btn-density').addEventListener('click', () => {
  const w = settings.vars.cardW;
  const i = SIZES.findIndex(s => Math.abs(s - w) < 25);
  settings.vars.cardW = SIZES[(i + 1) % SIZES.length];
  applySettings(); persistSettings(); densityIcon(); syncLab(); vibrate(6);
});
$('#btn-guide').addEventListener('click', () => openGuide());

function renderAll() { renderTable(false); if (!$('#view-discover').hidden) renderResults(); updateBadge(); }
