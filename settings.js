'use strict';
/* NutriDeck — réglages & Atelier : valeurs, couleurs, thèmes, contenu des faces de carte. */

const SKEY = 'nutrideck.settings.v2';

/* [clé, libellé, variable CSS, groupe] */
const COLOR_DEFS = [
  ['bg', 'Fond de l’app', '--bg', 'Interface'],
  ['surface', 'Surfaces', '--surface', 'Interface'],
  ['surface2', 'Surfaces claires', '--surface-2', 'Interface'],
  ['text', 'Texte', '--text', 'Interface'],
  ['muted', 'Texte discret', '--muted', 'Interface'],
  ['accent', 'Accent', '--accent', 'Interface'],
  ['accent2', 'Accent 2', '--accent-2', 'Interface'],
  ['accentEnd', 'Accent · fin de dégradé', '--accent-end', 'Interface'],
  ['ok', 'Succès / ajouter', '--ok', 'Interface'],
  ['danger', 'Danger', '--danger', 'Interface'],
  ['cardBg', 'Carte · fond recto', '--card-bg', 'Carte'],
  ['cardText', 'Carte · texte', '--card-text', 'Carte'],
  ['artBg', 'Carte · fond de la photo', '--art-bg', 'Carte'],
  ['backBg', 'Carte · fond verso', '--back-bg', 'Carte'],
  ['gA', 'Nutri / Eco · A', '--g-a', 'Scores'],
  ['gB', 'Nutri / Eco · B', '--g-b', 'Scores'],
  ['gC', 'Nutri / Eco · C', '--g-c', 'Scores'],
  ['gD', 'Nutri / Eco · D', '--g-d', 'Scores'],
  ['gE', 'Nutri / Eco · E', '--g-e', 'Scores'],
  ['nova1', 'NOVA 1', '--nova-1', 'Scores'],
  ['nova2', 'NOVA 2', '--nova-2', 'Scores'],
  ['nova3', 'NOVA 3', '--nova-3', 'Scores'],
  ['nova4', 'NOVA 4', '--nova-4', 'Scores'],
];
const GRADES = { gA: '#038141', gB: '#85bb2f', gC: '#fecb02', gD: '#ee8100', gE: '#e63e11', nova1: '#2fb35a', nova2: '#f0c419', nova3: '#f08a1c', nova4: '#e3452b' };
const THEMES = {
  off: { name: '🟠 Open Food Facts', colors: { ...GRADES, bg: '#f2e9e4', surface: '#ffffff', surface2: '#ede0db', text: '#341100', muted: '#8b6b5d', accent: '#ee7a00', accentEnd: '#ff9f33', accent2: '#0064c8', ok: '#4fa125', danger: '#d93a1c', cardBg: '#ffffff', cardText: '#341100', artBg: '#fbf6f3', backBg: '#fbf6f3' } },
  offnuit: { name: '🌰 Open Food Facts · Nuit', colors: { ...GRADES, bg: '#201a17', surface: '#2c2320', surface2: '#3a2e29', text: '#f2e9e4', muted: '#b39a8e', accent: '#ff8714', accentEnd: '#ffb04d', accent2: '#5aa9ff', ok: '#6cc24a', danger: '#ff6a4d', cardBg: '#2a211d', cardText: '#f2e9e4', artBg: '#fffaf7', backBg: '#33271f' } },
  nuit: { name: '🌙 Nuit', colors: { ...GRADES, bg: '#0b0d12', surface: '#141822', surface2: '#1c2230', text: '#eef1f7', muted: '#8f9ab0', accent: '#7c5cff', accent2: '#22d3ee', ok: '#22d3a0', danger: '#ff5d6c', cardBg: '#121623', cardText: '#eef1f7', artBg: '#eef1f8', backBg: '#1b2236' } },
  clair: { name: '☀️ Clair', colors: { ...GRADES, bg: '#f2f4f9', surface: '#ffffff', surface2: '#e7eaf3', text: '#1a2030', muted: '#5f6b82', accent: '#5b3df5', accent2: '#0a9fbd', ok: '#10a577', danger: '#e5334a', cardBg: '#ffffff', cardText: '#1a2030', artBg: '#f0f3fa', backBg: '#f6f7fc' } },
  neon: { name: '⚡ Néon', colors: { gA: '#00ff9c', gB: '#b6ff00', gC: '#fff200', gD: '#ff9100', gE: '#ff2a55', nova1: '#00ff9c', nova2: '#fff200', nova3: '#ff9100', nova4: '#ff2a55', bg: '#05020d', surface: '#120a24', surface2: '#1d1038', text: '#f4eaff', muted: '#a58bd1', accent: '#ff2fd6', accent2: '#00f0ff', ok: '#39ff88', danger: '#ff3860', cardBg: '#0f0820', cardText: '#f4eaff', artBg: '#f6efff', backBg: '#170b30' } },
  papier: { name: '📜 Papier', colors: { ...GRADES, bg: '#f6efe2', surface: '#fffaf0', surface2: '#efe4cf', text: '#3a2e1f', muted: '#8a7860', accent: '#c4552d', accent2: '#2f7d6b', ok: '#3f8f4e', danger: '#c23b3b', cardBg: '#fffaf0', cardText: '#3a2e1f', artBg: '#fbf6ea', backBg: '#f9f1de' } },
  foret: { name: '🌲 Forêt', colors: { ...GRADES, bg: '#07130e', surface: '#0e211a', surface2: '#153027', text: '#e6f4ea', muted: '#86a897', accent: '#34d399', accent2: '#a3e635', ok: '#4ade80', danger: '#fb7185', cardBg: '#0c1d16', cardText: '#e6f4ea', artBg: '#eaf3ec', backBg: '#12291f' } },
  sunset: { name: '🌇 Sunset', colors: { ...GRADES, bg: '#150a14', surface: '#241024', surface2: '#34173a', text: '#ffeef0', muted: '#c79bb0', accent: '#ff5e7e', accent2: '#ffb84d', ok: '#4be0a8', danger: '#ff4d6a', cardBg: '#1f0d1f', cardText: '#ffeef0', artBg: '#fff3ee', backBg: '#2a1230' } },
};
const mixHex = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
for (const t of Object.values(THEMES)) t.colors.accentEnd ??= mixHex(t.colors.accent, t.colors.accent2, .55);
const SLIDERS = [
  ['cardW', 'Largeur des cartes', 90, 340, 2, 'px'],
  ['gap', 'Espace entre cartes', 4, 32, 1, 'px'],
  ['radius', 'Arrondi des angles', 0, 36, 1, 'px'],
  ['ratio', 'Hauteur (ratio)', 1.2, 1.9, .02, '×'],
  ['artH', 'Hauteur de la photo', 30, 75, 1, '%'],
  ['font', 'Taille du texte', 70, 150, 1, '%'],
  ['frame', 'Épaisseur du cadre', 0, 6, .5, 'px'],
  ['shadow', 'Ombre & lueur', 0, 100, 1, '%'],
  ['foil', 'Reflet holographique', 0, 100, 1, '%'],
  ['flip', 'Durée du flip', 150, 1400, 10, 'ms'],
];
const FRONT_DEFS = [['art', 'Photo'], ['brand', 'Marque'], ['name', 'Nom'], ['qty', 'Quantité'], ['nutri', 'Nutri-Score'], ['nova', 'NOVA'], ['eco', 'Eco-Score'], ['kcal', 'Calories']];
const BACK_DEFS = [['title', 'Titre'], ['scores', 'Scores (Nutri / NOVA / Eco)'], ['novaText', 'Texte du NOVA'], ['kcal', 'Énergie'], ['fat', 'Graisses'], ['sat', 'Graisses saturées'], ['sugars', 'Sucres'], ['salt', 'Sel'], ['fiber', 'Fibres'], ['prot', 'Protéines'], ['per', 'Mention « pour 100 g »'], ['ingredients', 'Ingrédients'], ['allergens', 'Allergènes'], ['additives', 'Additifs'], ['link', 'Lien Open Food Facts']];

const DEFAULT_THEME = matchMedia('(prefers-color-scheme: dark)').matches ? 'offnuit' : 'off';
const DEFAULTS = () => ({
  v: 3, theme: DEFAULT_THEME,
  vars: { cardW: 140, gap: 12, radius: 10, ratio: 1.48, artH: 57, font: 100, frame: 1, shadow: 45, foil: 35, flip: 600, tilt: true },
  colors: { ...THEMES[DEFAULT_THEME].colors },
  front: { art: true, brand: true, name: true, qty: true, nutri: true, nova: true, eco: true, kcal: false },
  back: { title: true, scores: true, novaText: true, kcal: true, fat: true, sat: true, sugars: true, salt: true, fiber: true, prot: true, per: true, ingredients: true, allergens: true, additives: true, link: true },
});
let settings = loadSettings();
function loadSettings() {
  const d = DEFAULTS();
  try {
    const s = JSON.parse(localStorage.getItem(SKEY));
    if (s && (s.v || 0) < 3) { s.v = 3; s.vars = { ...s.vars, radius: d.vars.radius }; }
    if (s) return { ...d, ...s, vars: { ...d.vars, ...s.vars }, colors: { ...d.colors, ...s.colors }, front: { ...d.front, ...s.front }, back: { ...d.back, ...s.back } };
  } catch { }
  return d;
}
function persistSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { } }

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 140;
}
function applySettings() {
  const root = document.documentElement.style, v = settings.vars;
  for (const [key, , cssVar] of COLOR_DEFS) root.setProperty(cssVar, settings.colors[key]);
  root.setProperty('--card-w', `calc(${v.cardW}px * var(--vs))`);
  root.setProperty('--gap', v.gap + 'px');
  root.setProperty('--card-r', v.radius + 'px');
  root.setProperty('--ar', (1 / v.ratio).toFixed(4));
  root.setProperty('--art-h', v.artH + '%');
  root.setProperty('--fs', (v.font / 100).toFixed(3));
  root.setProperty('--frame', v.frame + 'px');
  root.setProperty('--shadow', v.shadow / 100);
  root.setProperty('--foil', v.foil / 100);
  root.setProperty('--flip', v.flip + 'ms');
  const dark = isDark(settings.colors.bg);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.dataset.mode = dark ? 'dark' : 'light';
  $('meta[name=theme-color]')?.setAttribute('content', settings.colors.bg);
  const mb = $('#btn-mode'); if (mb) mb.innerHTML = dark ? MODE_ICON.sun : MODE_ICON.moon;
}

/* ───────────── Atelier (onglet) ───────────── */
let pvFlipped = false;
const previewProduct = () => {
  const p = Object.values(state.products)[0];
  return p || DEMO[2];
};
function renderPreview() {
  const box = $('#pv-card'); if (!box) return;
  const card = cardEl(previewProduct());
  if (pvFlipped) card.classList.add('flipped');
  card.addEventListener('click', () => { pvFlipped = card.classList.toggle('flipped'); });
  box.replaceChildren(card);
}
const rerenderCards = () => { renderPreview(); if (typeof renderAll === 'function') renderAll(); };

function sliderRow([key, label, min, max, step, unit]) {
  const fmtv = x => (step < 1 ? (+x).toFixed(2) : Math.round(x)) + (unit === '×' ? '' : ' ') + unit;
  const out = h('output', {}, fmtv(settings.vars[key]));
  const inp = h('input', { type: 'range', min, max, step, value: settings.vars[key], 'data-key': key });
  inp.addEventListener('input', () => { settings.vars[key] = +inp.value; out.textContent = fmtv(inp.value); applySettings(); persistSettings(); if (key === 'cardW') densityIcon(); });
  return h('label', { class: 'ctl' }, h('span', {}, label), out, inp);
}
function colorRow([key, label]) {
  const inp = h('input', { type: 'color', value: settings.colors[key], 'data-ckey': key });
  inp.addEventListener('input', () => { settings.colors[key] = inp.value; settings.theme = 'perso'; applySettings(); persistSettings(); markTheme(); });
  return h('label', { class: 'cctl' }, inp, h('span', {}, label));
}
function checkRow(group, [key, label]) {
  const inp = h('input', { type: 'checkbox' });
  inp.checked = !!settings[group][key];
  inp.addEventListener('change', () => { settings[group][key] = inp.checked; persistSettings(); rerenderCards(); });
  return h('label', { class: 'chk' }, inp, h('span', { class: 'box' }), h('span', {}, label));
}
function markTheme() { $$('#view-lab .theme-btn').forEach(b => b.classList.toggle('on', b.dataset.theme === settings.theme)); }
function setTheme(name) {
  settings.theme = name; settings.colors = { ...THEMES[name].colors };
  applySettings(); persistSettings(); syncLab();
}
function section(title, sub, ...kids) {
  return h('details', { class: 'lab-sec', open: true }, h('summary', {}, h('b', {}, title), h('small', {}, sub)), h('div', { class: 'lab-body' }, ...kids));
}
function buildLab() {
  const root = $('#view-lab');
  const groups = [...new Set(COLOR_DEFS.map(c => c[3]))];
  root.replaceChildren(
    h('div', { class: 'lab-preview' },
      h('div', { id: 'pv-card', class: 'pv-card' }),
      h('div', { class: 'pv-side' },
        h('h1', {}, 'Atelier'),
        h('p', {}, 'Règle la carte à ton goût : tout s’applique en direct sur la table et dans les jeux.'),
        h('div', { class: 'pv-btns' },
          h('button', { class: 'ghost-btn', onclick: () => { pvFlipped = !pvFlipped; $('#pv-card .card')?.classList.toggle('flipped', pvFlipped); } }, '↻ Retourner'),
          h('button', { class: 'ghost-btn', onclick: shareSheet }, '⇅ Partager')))),
    section('Thèmes', 'Un point de départ', h('div', { class: 'theme-row' }, Object.entries(THEMES).map(([k, t]) => h('button', { class: 'theme-btn', 'data-theme': k, onclick: () => setTheme(k) },
      h('span', { class: 'sw' }, [t.colors.bg, t.colors.accent, t.colors.accent2, t.colors.gA, t.colors.gE].map(c => h('i', { style: `background:${c}` }))), t.name)))),
    section('Taille & forme', 'Valeurs', ...SLIDERS.map(sliderRow),
      h('label', { class: 'chk' }, (() => { const i = h('input', { type: 'checkbox' }); i.checked = settings.vars.tilt; i.addEventListener('change', () => { settings.vars.tilt = i.checked; persistSettings(); }); return i; })(), h('span', { class: 'box' }), h('span', {}, 'Inclinaison de la carte au survol (souris)'))),
    section('Face avant', 'Ce qui s’affiche au recto', h('div', { class: 'chk-grid' }, FRONT_DEFS.map(d => checkRow('front', d)))),
    section('Face arrière', 'Ce qui s’affiche au verso', h('div', { class: 'chk-grid' }, BACK_DEFS.map(d => checkRow('back', d)))),
    ...groups.map(g => section('Couleurs · ' + g, '', h('div', { class: 'color-grid' }, COLOR_DEFS.filter(c => c[3] === g).map(colorRow)))),
    h('div', { class: 'lab-foot' },
      h('button', { class: 'btn danger', onclick: () => { if (confirm('Remettre tous les réglages par défaut ?')) { settings = DEFAULTS(); applySettings(); persistSettings(); buildLab(); rerenderCards(); densityIcon(); } } }, 'Réinitialiser l’atelier')));
  markTheme(); renderPreview();
}
function syncLab() {          // met à jour les contrôles quand un réglage change ailleurs (bouton de taille, thème)
  if (!$('#view-lab')) return;
  $$('#view-lab input[type=range]').forEach(i => { i.value = settings.vars[i.dataset.key]; i.dispatchEvent(new Event('_sync')); const o = i.previousElementSibling; const def = SLIDERS.find(s => s[0] === i.dataset.key); if (o && def) o.textContent = (def[4] < 1 ? (+i.value).toFixed(2) : Math.round(i.value)) + (def[5] === '×' ? '' : ' ') + def[5]; });
  $$('#view-lab input[type=color]').forEach(i => { i.value = settings.colors[i.dataset.ckey]; });
  markTheme();
}
function shareSheet() {
  const json = JSON.stringify({ theme: settings.theme, vars: settings.vars, colors: settings.colors, front: settings.front, back: settings.back });
  const ta = h('textarea', { class: 'field', style: 'height:150px;padding:10px;font:12px monospace' }); ta.value = json;
  const s = openSheet('Partager ton style', h('div', {},
    h('p', { style: 'color:var(--muted);margin-bottom:10px;font-size:14px' }, 'Copie ce texte pour garder ou envoyer ton style. Colle un style ici pour l’importer.'), ta,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(ta.value); toast('Copié'); } catch { ta.select(); } } }, 'Copier'),
      h('button', { class: 'btn primary', onclick: () => {
        try { const j = JSON.parse(ta.value); settings = { ...DEFAULTS(), ...j, vars: { ...DEFAULTS().vars, ...j.vars }, colors: { ...DEFAULTS().colors, ...j.colors }, front: { ...DEFAULTS().front, ...j.front }, back: { ...DEFAULTS().back, ...j.back } }; applySettings(); persistSettings(); buildLab(); rerenderCards(); densityIcon(); s.close(); toast('Style importé ✨'); }
        catch { toast('Texte invalide'); }
      } }, 'Importer'))));
}

/* bascule jour / nuit aux couleurs Open Food Facts */
const MODE_ICON = {
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
};
$('#btn-mode').addEventListener('click', () => {
  setTheme(isDark(settings.colors.bg) ? 'off' : 'offnuit');
  rerenderCards(); vibrate(6);
});
