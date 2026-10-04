'use strict';
/* NutriDeck — mini-jeux solo : Tier List Battle, Rangez-vous !, Devine le score, Le juste prix.
   Les jeux réutilisent la carte et le moteur de drag (boards). Chaque verdict est mis en scène :
   suspense → révélation carte par carte → sons, confettis, compteurs. Le multijoueur viendra ensuite. */

const SCORES_KEY = 'nutrideck.scores';
const SRC_KEY = 'nutrideck.gamesrc';
const MUTE_KEY = 'nutrideck.mute';
const bests = (() => { try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || {}; } catch { return {}; } })();
const saveBest = (id, pts) => { const isNew = pts > (bests[id] || 0); if (isNew) { bests[id] = pts; try { localStorage.setItem(SCORES_KEY, JSON.stringify(bests)); } catch { } } return isNew; };
const pick = a => a[Math.floor(Math.random() * a.length)];
let gameSource = (() => { try { return localStorage.getItem(SRC_KEY) || 'random'; } catch { return 'random'; } })();

/* ───────────── Son (WebAudio, synthétique) ───────────── */
const sfx = (() => {
  let ctx, muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
  const tone = (f, t = .08, type = 'sine', v = .1, when = 0) => {
    if (muted) return;
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + when;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + t);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + t + .03);
    } catch { }
  };
  return {
    tick: (i = 0) => tone(380 + i * 38, .05, 'square', .035),
    ok: () => { tone(660, .1, 'triangle', .11); tone(990, .2, 'triangle', .12, .09); },
    bad: () => { tone(200, .28, 'sawtooth', .07); tone(150, .3, 'sawtooth', .06, .08); },
    pop: () => tone(520, .07, 'sine', .09),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .24, 'triangle', .11, i * .09)),
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { } return muted; },
  };
})();

/* ───────────── Effets ───────────── */
function confetti(target, n = 26) {
  const r = target.getBoundingClientRect ? target.getBoundingClientRect() : target;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const vars = ['--accent', '--ok', '--g-c', '--g-d', '--accent-2'];
  for (let i = 0; i < n; i++) {
    const d = h('i', { class: 'confetti' });
    d.style.left = cx + 'px'; d.style.top = cy + 'px'; d.style.background = `var(${pick(vars)})`;
    document.body.append(d);
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
    d.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * s}px,${Math.sin(a) * s + 60}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }],
      { duration: 800 + Math.random() * 600, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => d.remove();
  }
}
const shake = el => el?.animate([{ translate: '0' }, { translate: '-8px' }, { translate: '8px' }, { translate: '-5px' }, { translate: '4px' }, { translate: '0' }], { duration: 380 });
function countUp(el, to, { dur = 900, fmtv = v => String(Math.round(v)), suffix = '', tick = true, onFrame } = {}) {
  return new Promise(res => {
    const t0 = performance.now(); let last = -1;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - p, 3));
      el.textContent = fmtv(v) + suffix; onFrame?.(v);
      const b = Math.floor(p * 12);
      if (tick && b !== last) { last = b; sfx.tick(b); }
      p < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}
const dots = (i, n) => h('div', { class: 'dots' }, Array.from({ length: n }, (_, k) => h('i', { class: k < i ? 'done' : k === i ? 'cur' : '' })));

/* ───────────── Catalogue ───────────── */
const GAMES = [
  { id: 'tier', e: '🏅', t: 'Tier List Battle', d: 'Classe 8 produits de S à D, puis affronte le bot sur la vraie note.', cls: 'g1', run: () => playTier(), max: 24 },
  { id: 'timeline', e: '🔢', t: 'Rangez-vous !', d: 'Remets 5 produits dans l’ordre : du moins sucré au plus sucré, par exemple.', cls: 'g2', run: () => playTimeline(), max: 100 },
  { id: 'guess', e: '🎯', t: 'Devine le score', d: 'Nutri-Score, Eco-Score ou NOVA : plus tu es proche, plus tu marques.', cls: 'g3', run: () => playGuess(), max: 500 },
  { id: 'price', e: '💶', t: 'Le juste prix', d: 'Combien de sucre, de sel, de calories pour 100 g ? Approche-toi au plus près.', cls: 'g4', run: () => playPrice(), max: 500 },
];

function renderGameList() {
  const root = $('#game-list');
  const seg = h('div', { class: 'seg', role: 'tablist' },
    [['random', '🎲 Produits au hasard'], ['mine', '🃏 Ma collection']].map(([k, l]) => h('button', {
      class: gameSource === k ? 'on' : '', onclick: () => { gameSource = k; try { localStorage.setItem(SRC_KEY, k); } catch { } renderGameList(); }
    }, l)));
  root.replaceChildren(
    h('div', { class: 'src-card' }, h('small', {}, 'Source des cartes'), seg,
      h('p', {}, gameSource === 'mine' ? 'On pioche d’abord dans ta table, puis on complète avec Open Food Facts.' : 'Des produits Open Food Facts tirés au sort à chaque partie.')),
    ...GAMES.map(g => h('article', { class: 'game', onclick: () => g.run() },
      h('div', { class: 'game-art ' + g.cls }, g.e),
      h('div', {}, h('h3', {}, g.t), h('p', {}, g.d), bests[g.id] != null ? h('em', { class: 'best' }, `Record : ${bests[g.id]} / ${g.max}`) : null),
      h('span', { class: 'play' }, 'Jouer ▸'))),
    h('article', { class: 'game online' }, h('div', { class: 'game-art g5' }, '👥'),
      h('div', {}, h('h3', {}, 'En ligne · Devine le score'), h('p', {}, 'Crée un lobby, envoie le lien à tes amis : tout le monde vote sur le même produit.')),
      h('div', { class: 'online-btns' },
        h('button', { class: 'play', onclick: e => { e.stopPropagation(); hostOnline(); } }, 'Créer ▸'),
        h('button', { class: 'play alt', onclick: e => { e.stopPropagation(); askJoinCode(); } }, 'Rejoindre'))));
}

/* ───────────── Scène plein écran ───────────── */
let stageOpen = null;
/* joueurs de la partie : toi + bots (en attendant le multijoueur, ils occupent la même liste) */
const BOTS = [
  { id: 'chef', name: 'Chef Gourmand', av: '🤖', skill: .55 },
  { id: 'mamie', name: 'Mamie Bio', av: '🧓', skill: .72 },
  { id: 'ado', name: 'Ado Snack', av: '🧢', skill: .38 },
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const botIdx = (truth, n, skill) => Math.random() < skill ? truth : clamp(truth + (Math.random() < .5 ? -1 : 1) * (Math.random() < .75 ? 1 : 2), 0, n - 1);
const botValue = (truth, max, skill) => clamp(truth * (1 + (Math.random() * 2 - 1) * (1 - skill) * .9) + (Math.random() * 2 - 1) * max * .05 * (1 - skill), 0, max);

function openStage(title) {
  stageOpen?.close();
  const score = h('div', { class: 'stage-score' }, '0');
  const body = h('div', { class: 'stage-body' });
  const roster = h('aside', { class: 'players', 'aria-label': 'Joueurs' });
  const side = h('aside', { class: 'side-info', 'aria-label': 'Explication' });
  const soundIcon = () => sfx.muted
    ? '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const snd = h('button', { class: 'icon-btn sound', 'aria-label': 'Son', html: soundIcon(), onclick: () => { sfx.toggle(); snd.innerHTML = soundIcon(); sfx.pop(); } });
  const infoBtn = h('button', { class: 'icon-btn info-btn', 'aria-label': 'Explication', hidden: true, onclick: () => st.info && openSheet('', h('div', { class: 'sheet-stack' }, st.explain ? explainClone() : null, infoBox(st.info, true), st.product ? productBox(st.product) : null)) }, 'i');
  const explainClone = () => st.explain.cloneNode(true);
  const el = h('div', { class: 'stage', role: 'dialog', 'aria-label': title },
    h('header', { class: 'stage-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Quitter', onclick: () => st.close(), html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>' }),
      h('h2', {}, title), infoBtn, snd, score),
    h('div', { class: 'stage-main' }, roster, body, side));
  document.body.append(el);
  document.body.classList.add('modal-open');
  const onKey = e => { if (e.key === 'Escape' && !$('.scrim')) st.close(); };
  addEventListener('keydown', onKey);
  const st = {
    el, body, info: null, round: 0, rounds: 1,
    players: [{ id: 'me', name: 'Toi', av: '😀', me: true }, ...BOTS].map(p => ({ ...p, points: 0, played: 0, last: null })),
    setScore(n) { score.textContent = n; score.classList.remove('bump'); void score.offsetWidth; score.classList.add('bump'); },
    setInfo(kind) { st.info = kind; st.explain = null; st.product = null; side.replaceChildren(infoBox(kind, true)); infoBtn.hidden = false; },
    setExplain(node) { st.explain = node; side.querySelector('.info-box:not(.prod)')?.remove(); side.prepend(node); },
    clearSide() { side.replaceChildren(); infoBtn.hidden = true; st.info = st.explain = st.product = null; },
    setProduct(p) { st.product = p; side.append(productBox(p)); },
    setRound(i, n) { st.round = i; st.rounds = n; renderRoster(); },
    award(id, pts) { const p = st.players.find(x => x.id === id); p.points += pts; p.played++; p.last = pts; if (p.me) st.setScore(p.points); renderRoster(); },
    awardBots(fn, gap = 300) { BOTS.forEach((bot, k) => setTimeout(() => { if (stageOpen === st) st.award(bot.id, fn(bot)); }, (k + 1) * gap)); },
    setPlayers(list) { st.players = list; renderRoster(); },
    onClose: null,
    rankOf(id) { return [...st.players].sort((a, b) => b.points - a.points || (a.me ? -1 : 1)).findIndex(p => p.id === id) + 1; },
    close() { st.onClose?.(); el.remove(); removeEventListener('keydown', onKey); delete boards.game; delete boards.bot; stageOpen = null; if (!$('.scrim')) document.body.classList.remove('modal-open'); renderGameList(); },
  };
  const renderRoster = () => {
    const prev = new Map([...roster.querySelectorAll('.pl')].map(n => [n.dataset.id, n.getBoundingClientRect()]));
    const sorted = [...st.players].sort((a, b) => b.points - a.points || (a.me ? -1 : 1));
    roster.replaceChildren(
      h('div', { class: 'pl-head' }, h('b', {}, 'Joueurs'), h('span', {}, st.roundLabel ?? (st.rounds > 1 ? `Manche ${Math.min(st.round + 1, st.rounds)} / ${st.rounds}` : 'Manche unique'))),
      h('ol', { class: 'pl-list' }, sorted.map((p, i) => h('li', { class: 'pl' + (p.me ? ' me' : ''), 'data-id': p.id },
        h('span', { class: 'pos' + (i === 0 && p.points ? ' first' : '') }, String(i + 1)),
        h('span', { class: 'av' }, p.av),
        h('div', { class: 'who' }, h('b', {}, p.name), h('small', { class: p.statusCls || '' }, p.status ?? (p.played ? `${p.played} manche${p.played > 1 ? 's' : ''} · moy. ${Math.round(p.points / p.played)}` : 'pas encore joué'))),
        h('div', { class: 'pt' }, h('b', {}, String(p.points)), p.last != null ? h('em', { class: p.last > 0 ? 'up' : '' }, (p.last > 0 ? '+' : '') + p.last) : null)))));
    roster.querySelectorAll('.pl').forEach(n => {
      const o = prev.get(n.dataset.id); if (!o) return;
      const r = n.getBoundingClientRect(), dx = o.left - r.left, dy = o.top - r.top;
      if (Math.abs(dx) + Math.abs(dy) > 1) n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  };
  renderRoster();
  stageOpen = st;
  return st;
}
const loading = txt => h('div', { class: 'g-loading' }, h('div', { class: 'spin' }), h('p', {}, txt));

/* ───────────── Pioche de cartes pour une partie ───────────── */
async function buildDeck(n, pred) {
  const pool = [], seen = new Set();
  const add = p => { if (usable(p, true) && pred(p) && !seen.has(p.code)) { seen.add(p.code); pool.push(p); return true; } return false; };
  if (gameSource === 'mine') shuffle(Object.values(state.products)).forEach(p => { if (pool.length < n) add(p); });
  const queries = shuffle(CHIPS.map(c => c[1]));
  let tries = 0;
  while (pool.length < n && tries < 4) {
    const q = queries[tries++];
    const want = Math.min(n - pool.length, Math.ceil(n / 2));
    const { list } = await searchOFF(q, 1 + Math.floor(Math.random() * 2));
    let got = 0;
    for (const p of shuffle(list)) { if (got >= want) break; if (add(p)) got++; }
  }
  if (pool.length < n) throw new Error('deck');
  const deck = shuffle(pool).slice(0, n);
  // la recherche ne renvoie pas les additifs : on complète chaque carte avec la fiche produit (en cache côté serveur)
  await Promise.all(deck.map(async p => {
    if (p.adds?.length) return;
    try { const full = await lookupBarcode(p.code); if (full) Object.assign(p, { ecoInfo: full.ecoInfo, adds: full.adds, additives: full.additives ?? p.additives, ingredients: full.ingredients || p.ingredients, allergens: full.allergens.length ? full.allergens : p.allergens }); } catch { }
  }));
  return deck;
}
async function prepare(st, n, pred) {
  st.body.replaceChildren(loading('On pioche les cartes…'));
  try { return await buildDeck(n, pred); }
  catch { toast('Open Food Facts ne répond pas, réessaie dans un instant'); st.close(); return null; }
}
function gameBoard(st, zones, products, opts = {}) {
  const root = h('div', { class: 'board ' + (opts.cls || '') });
  root.dataset.board = 'game';
  const b = boards.game = {
    name: 'game', root: () => root, zones, products, flipped: new Set(), hide: true, stack: false, trash: false, mini: !!opts.mini,
    noFlip: !!opts.noFlip, noExpand: !!opts.noExpand, scroller: () => st.body, changed: () => { }, onMove: opts.onMove, mark: null, locked: false,
  };
  return { board: b, root };
}
const itemsOf = list => list.map(p => ({ id: uid(), codes: [p.code] }));
const productMap = list => Object.fromEntries(list.map(p => [p.code, p]));
const actionBar = (...kids) => h('div', { class: 'stage-actions' }, ...kids);
const slotOf = (root, id) => root.querySelector(`.slot[data-item="${id}"]`);
const addMark = (slot, text, cls = 'wait') => { const m = h('span', { class: 'mark val ' + cls }, text); slot.querySelector('.slot-ui').append(m); return m; };
const spot = async slot => { slot.classList.add('spot'); slot.scrollIntoView({ block: 'center', behavior: 'smooth' }); await sleep(260); };

function resultPanel({ big, title, sub, extra, again, id, max, noBig, win }) {
  const isNew = id != null && saveBest(id, big);
  const num = h('span', {}, noBig ? String(big) : '0');
  const panel = h('div', { class: 'result' + (win === true ? ' win' : win === false ? ' lose' : '') },
    noBig ? null : h('div', { class: 'res-big' }, num, max ? h('small', {}, ` / ${max}`) : null),
    h('h3', {}, title), sub ? h('p', {}, sub) : null, isNew ? h('span', { class: 'newbest' }, '🏆 Nouveau record !') : null, extra || null,
    h('div', { class: 'btn-row', style: 'margin-top:16px' },
      h('button', { class: 'btn', onclick: () => stageOpen?.close() }, 'Quitter'),
      h('button', { class: 'btn primary', onclick: again }, 'Rejouer')));
  if (!noBig) setTimeout(() => countUp(num, big, { dur: 900 }), 250);
  return panel;
}
const finishPanel = (st, panel, celebrate) => {
  const r = st.rankOf('me'), n = st.players.length;
  panel.insertBefore(h('p', { class: 'rank-line' }, r === 1 ? `🥇 Tu finis 1er sur ${n}` : `Tu finis ${r}e sur ${n}`), panel.querySelector('.btn-row'));
  st.body.scrollTo(0, 0);
  const hasBoard = !!st.body.querySelector('.board');
  const ov = h('div', { class: 'result-overlay' + (hasBoard ? '' : ' clear') }, panel);
  const reopen = h('button', { class: 'btn primary reopen', hidden: true, onclick: () => { ov.hidden = false; reopen.hidden = true; st.body.classList.add('has-result'); } }, 'Revoir le résultat');
  if (hasBoard) panel.querySelector('.btn-row').prepend(h('button', { class: 'btn', onclick: () => { ov.hidden = true; reopen.hidden = false; st.body.classList.remove('has-result'); } }, 'Voir le plateau'));
  st.body.classList.add('has-result');
  st.body.append(ov, reopen);
  if (celebrate) { sfx.win(); setTimeout(() => { confetti(panel, 40); confetti({ left: innerWidth * .2, top: 200, width: 0, height: 0 }, 24); confetti({ left: innerWidth * .8, top: 200, width: 0, height: 0 }, 24); }, 500); }
};


/* ───────────── « C'est quoi ? » : la valeur en jeu, expliquée sur l'écran ───────────── */
const SCORE_INFO = {
  nutri: { t: 'C’est quoi le Nutri-Score ?', p: 'Une note de A à E sur la qualité nutritionnelle pour 100 g. Calories, sucres, sel et graisses saturées font baisser la note ; fibres, protéines, fruits et légumes la font monter.',
    scale: [['A', 'Excellent', 'ns-a'], ['B', 'Bon', 'ns-b'], ['C', 'Moyen', 'ns-c'], ['D', 'Médiocre', 'ns-d'], ['E', 'À limiter', 'ns-e']] },
  eco: { t: 'C’est quoi l’Eco-Score ?', p: 'L’impact environnemental de A à E : tout le cycle de vie du produit (agriculture, transformation, transport), avec bonus ou malus pour l’origine, l’emballage et le mode de production.',
    scale: [['A', 'Très faible', 'ns-a'], ['B', 'Faible', 'ns-b'], ['C', 'Modéré', 'ns-c'], ['D', 'Élevé', 'ns-d'], ['E', 'Très élevé', 'ns-e']] },
  nova: { t: 'C’est quoi le groupe NOVA ?', p: 'Le degré de transformation industrielle, de 1 à 4. Ça ne mesure pas les calories ni le sucre : un produit léger peut être ultra-transformé.',
    scale: [['1', 'Brut', 'nv-1', 'fruits, lait, œufs'], ['2', 'Culinaire', 'nv-2', 'huile, beurre, sucre'], ['3', 'Transformé', 'nv-3', 'fromage, pain, conserves'], ['4', 'Ultra-transformé', 'nv-4', 'arômes, additifs']] },
};
const NUT_INFO = {
  sugars: { t: 'Les sucres', p: 'Tous les sucres du produit (naturels et ajoutés), pour 100 g.', refs: [['Faible', '≤ 5 g', 'ns-a'], ['Élevé', '> 22,5 g', 'ns-e']], ex: 'Yaourt nature ≈ 4 g · soda ≈ 10 g · pâte à tartiner ≈ 55 g' },
  salt: { t: 'Le sel', p: 'La quantité de sel pour 100 g. L’OMS recommande moins de 5 g par jour.', refs: [['Faible', '≤ 0,3 g', 'ns-a'], ['Élevé', '> 1,5 g', 'ns-e']], ex: 'Céréales ≈ 0,5 g · chips ≈ 1,3 g · jambon ≈ 2 g' },
  kcal: { t: 'L’énergie (calories)', p: 'Les kilocalories apportées par 100 g de produit.', refs: [['Léger', '< 100 kcal', 'ns-a'], ['Dense', '> 400 kcal', 'ns-e']], ex: 'Soda ≈ 40 · pain ≈ 250 · chocolat ≈ 550 · huile ≈ 900' },
  fat: { t: 'Les graisses', p: 'Toutes les matières grasses pour 100 g.', refs: [['Faible', '≤ 3 g', 'ns-a'], ['Élevé', '> 17,5 g', 'ns-e']], ex: 'Yaourt nature ≈ 1,5 g · fromage ≈ 25 g · beurre ≈ 82 g' },
  sat: { t: 'Les graisses saturées', p: 'La part des graisses à limiter, surtout dans le beurre, le fromage, la crème et l’huile de palme.', refs: [['Faible', '≤ 1,5 g', 'ns-a'], ['Élevé', '> 5 g', 'ns-e']], ex: 'Lait demi-écrémé ≈ 1 g · fromage ≈ 17 g · beurre ≈ 52 g' },
};
let infoOpen = true;
function infoBox(kind, fixed = false) {
  const S = SCORE_INFO[kind], N = NUT_INFO[kind], I = S || N;
  const body = S
    ? h('div', { class: 'g-scale row n' + S.scale.length }, S.scale.map(([l, txt, c, ex]) => h('div', { class: 'g-step ' + c }, h('b', {}, l), h('span', {}, txt), ex ? h('em', {}, ex) : null)))
    : h('div', {}, h('div', { class: 'refs' }, N.refs.map(([l, v, c]) => h('div', { class: 'g-step ' + c }, h('b', {}, l === 'Faible' || l === 'Léger' ? '↓' : '↑'), h('span', {}, `${l} : ${v}`)))), h('p', { class: 'ex' }, N.ex));
  const title = S ? I.t : `${I.t} : c’est quoi ?`;
  if (fixed) return h('div', { class: 'info-box fixed' }, h('h4', {}, h('span', { class: 'i' }, 'i'), title), h('p', {}, I.p), body);
  const d = h('details', { class: 'info-box' }, h('summary', {}, h('span', { class: 'i' }, 'i'), title), h('p', {}, I.p), body);
  d.open = infoOpen;
  d.addEventListener('toggle', () => { infoOpen = d.open; });
  return d;
}

/* ───────────── « Pourquoi cette note ? » après la révélation ───────────── */
function explainScore(type, p) {
  const n = p.n, fv = v => fmt(v), items = [];
  const add = (cls, label, value = '') => items.push([cls, label, value]);
  const lvl = (v, lo, hi) => v > hi ? 'bad' : v <= lo ? 'good' : 'mid';
  let letter, color, title, lead;
  if (type === 'nutri') {
    letter = p.nutri.toUpperCase(); color = `var(--g-${p.nutri})`;
    title = `Nutri-Score ${letter}`; lead = SCORE_INFO.nutri.scale['abcde'.indexOf(p.nutri)][1];
    const word = { bad: ['élevée', 'élevés', 'élevées', 'élevé'], good: ['faible', 'faibles', 'faibles', 'faible'], mid: ['moyenne', 'modérés', 'modérées', 'modéré'] };
    if (n.kcal != null) { const c = n.kcal > 400 ? 'bad' : n.kcal < 150 ? 'good' : 'mid'; add(c, `Énergie ${word[c][0]}`, `${Math.round(n.kcal)} kcal`); }
    if (n.sugars != null) { const c = lvl(n.sugars, 5, 22.5); add(c, `Sucres ${word[c][1]}`, `${fv(n.sugars)} g`); }
    if (n.sat != null) { const c = lvl(n.sat, 1.5, 5); add(c, `Graisses saturées ${word[c][2]}`, `${fv(n.sat)} g`); }
    if (n.salt != null) { const c = lvl(n.salt, .3, 1.5); add(c, `Sel ${word[c][3]}`, `${fv(n.salt)} g`); }
    if (n.fiber != null && n.fiber >= 3) add('good', 'Riche en fibres', `${fv(n.fiber)} g`);
    if (n.prot != null && n.prot >= 8) add('good', 'Riche en protéines', `${fv(n.prot)} g`);
  } else if (type === 'nova') {
    letter = String(p.nova); color = `var(--nova-${p.nova})`;
    title = `NOVA ${p.nova}`; lead = ['', 'Brut ou à peine transformé', 'Ingrédient culinaire', 'Transformé', 'Ultra-transformé'][p.nova];
    const adds = p.adds || [];
    if (p.nova === 4) adds.length ? adds.slice(0, 5).forEach(c => add('bad', addName(c) ? addName(c)[0].toUpperCase() + addName(c).slice(1) : 'Additif', c))
      : add('bad', 'Ingrédients industriels', 'arômes, sirops…');
    else if (adds.length) adds.slice(0, 4).forEach(c => add('mid', addName(c) || 'Additif', c));
    else add('good', 'Aucun additif détecté');
    if (p.nova === 1) add('good', 'Aliment brut, simplement conservé');
    if (p.nova === 3) add('mid', 'Recette « maison » : sel, sucre, huile, fermentation');
  } else {
    letter = p.eco.toUpperCase(); color = `var(--g-${p.eco})`;
    title = `Eco-Score ${letter}`; lead = `Impact ${SCORE_INFO.eco.scale['abcde'.indexOf(p.eco)][1].toLowerCase()}`;
    add(p.eco <= 'b' ? 'good' : p.eco >= 'd' ? 'bad' : 'mid', 'Cycle de vie : agriculture et fabrication');
    add('mid', 'Emballage et transport : bonus ou malus');
    add('mid', 'Labels bio, équitable… : bonus');
  }
  const nb = items.filter(i => i[0] === 'bad').length, ng = items.filter(i => i[0] === 'good').length;
  return h('div', { class: 'explain fade-in', style: `--c:${color}` },
    h('div', { class: 'ex-head' }, h('span', { class: 'ex-badge' }, letter),
      h('div', {}, h('small', {}, 'Pourquoi ?'), h('h4', {}, title), h('span', {}, lead))),
    h('div', { class: 'ex-sum' }, nb ? h('span', { class: 'bad' }, `▼ ${nb} point${nb > 1 ? 's' : ''} faible${nb > 1 ? 's' : ''}`) : null, ng ? h('span', { class: 'good' }, `▲ ${ng} point${ng > 1 ? 's' : ''} fort${ng > 1 ? 's' : ''}`) : null),
    h('ul', {}, items.map(([cls, label, value]) => h('li', { class: cls }, h('i', {}, cls === 'bad' ? '▼' : cls === 'good' ? '▲' : '●'), h('span', {}, label), value ? h('b', {}, value) : null))));
}

/* fiche produit (colonne de droite) : tout lire sans faire défiler la carte */
function productBox(p) {
  const al = allergensFr(p.allergens), adds = p.adds || [];
  const long = (p.ingredients || '').length > 260;
  return h('div', { class: 'info-box fixed prod' },
    h('h4', {}, h('span', { class: 'i' }, '≡'), 'Fiche du produit'),
    p.ingredients ? h('p', { class: 'ing-clamp' }, h('b', {}, 'Ingrédients · '), p.ingredients) : null,
    long ? h('button', { class: 'why-btn read-all', onclick: () => openSheet('Ingrédients', h('p', { class: 'selectable', style: 'line-height:1.5' }, p.ingredients)) }, 'Tout lire') : null,
    h('p', {}, h('b', {}, 'Allergènes · '), al.length ? al.join(', ') : 'aucun déclaré'),
    h('div', { class: 'prod-adds' }, h('b', {}, `Additifs${adds.length ? ` (${adds.length})` : ''}`),
      adds.length ? h('div', { class: 'add-list' }, adds.map(c => h('span', { class: 'addv' }, c, addName(c) ? h('i', {}, ' · ' + addName(c)) : null))) : h('span', { class: 'none' }, ' aucun détecté par Open Food Facts')));
}

/* ───────────── 1. Rangez-vous ! ───────────── */
const TL_CRIT = [
  { k: 'sugars', q: 'du moins au plus sucré', lo: 'Moins sucré', hi: 'Plus sucré', u: 'g' },
  { k: 'salt', q: 'du moins au plus salé', lo: 'Moins salé', hi: 'Plus salé', u: 'g' },
  { k: 'kcal', q: 'du moins au plus calorique', lo: 'Moins calorique', hi: 'Plus calorique', u: 'kcal' },
  { k: 'fat', q: 'du moins au plus gras', lo: 'Moins gras', hi: 'Plus gras', u: 'g' },
  { k: 'sat', q: 'du moins au plus riche en graisses saturées', lo: 'Moins de sat.', hi: 'Plus de sat.', u: 'g' },
];
async function playTimeline() {
  const st = openStage('Rangez-vous !');
  const c = pick(TL_CRIT);
  const deck = await prepare(st, 5, p => p.n[c.k] != null);
  if (!deck) return;
  const zones = [
    { id: 'order', kind: 'order', n: 5, ends: [c.lo, c.hi], items: Array(5).fill(null) },
    { id: 'deck', kind: 'deck', title: 'Pioche', hint: 'Glisse chaque carte dans une case', empty: '✓ Tout est placé, tu peux valider', items: itemsOf(deck) },
  ];
  const btn = h('button', { class: 'btn primary', disabled: true, onclick: validate }, 'Valider mon classement');
  const { board, root } = gameBoard(st, zones, productMap(deck), { noFlip: true, noExpand: true, cls: 'board-order', onMove: () => { btn.disabled = zones[1].items.length > 0; } });
  const head = h('div', { class: 'brief' }, h('b', {}, `Range-les ${c.q}`), h('span', {}, 'pour 100 g · fie-toi à ton instinct'));
  const axis = h('div', { class: 'axis' }, h('span', { class: 'ax-end' }, h('b', {}, '−'), c.lo), h('div', { class: 'ax-bar' }), h('span', { class: 'ax-end r' }, h('b', {}, '+'), c.hi));
  st.setInfo(c.k);
  st.body.replaceChildren(head, axis, root, actionBar(btn));
  renderBoard(board, false);

  async function validate() {
    board.locked = true; root.classList.add('done'); $('.stage-actions', st.body)?.remove();
    const items = [...zones[0].items];
    const val = it => board.products[it.codes[0]].n[c.k];
    const fv = v => fmt(c.k === 'kcal' ? Math.round(v) : v);
    const sorted = items.map(val).sort((a, b) => a - b);
    const ok = new Map(items.map((it, i) => [it.id, val(it) === sorted[i]]));
    board.hide = false; renderBoard(board, false);
    head.replaceChildren(h('div', { class: 'verdict pulse' }, h('b', {}, 'Vérification…'), h('span', {}, 'Carte par carte, de la première à la dernière')));
    axis.remove();
    root.classList.add('dim');
    let good = 0;
    for (const it of items) {
      const slot = slotOf(root, it.id); await spot(slot);
      const m = addMark(slot, '0');
      await countUp(m, val(it), { dur: 600, fmtv: fv, suffix: ' ' + c.u });
      await sleep(220);
      m.classList.remove('wait');
      if (ok.get(it.id)) { m.classList.add('ok'); good++; st.setScore(good * 20); sfx.ok(); vibrate(15); confetti(slot, 18); }
      else { m.classList.add('bad'); sfx.bad(); vibrate([30, 40, 30]); shake(slot.querySelector('.card')); }
      await sleep(380); slot.classList.remove('spot');
    }
    root.classList.remove('dim');
    head.replaceChildren(h('div', { class: 'verdict' }, h('b', {}, 'Voici le vrai ordre'), h('span', {}, c.q)));
    sfx.pop(); await sleep(450);
    board.mark = it => ({ cls: 'val ' + (ok.get(it.id) ? 'ok' : 'bad'), text: `${fv(val(it))} ${c.u}` });
    zones[0].items.sort((a, b) => val(a) - val(b));
    renderBoard(board, true);
    st.award('me', good * 20);
    st.awardBots(bot => { let k = 0; for (let j = 0; j < 5; j++) if (Math.random() < bot.skill * .75) k++; return k * 20; });
    await sleep(1400);
    const msg = good === 5 ? 'Parfait ! Tu les connais par cœur.' : good >= 3 ? 'Pas mal du tout.' : 'Aïe, les apparences sont trompeuses…';
    finishPanel(st, resultPanel({ big: good * 20, max: 100, id: 'timeline', title: `${good}/5 bien placées`, sub: msg, again: playTimeline, win: good >= 3 ? true : undefined }), good === 5);
  }
}

/* ───────────── 2. Devine le score ───────────── */
const GUESS_TYPES = {
  nutri: { subs: ['Excellent', 'Bon', 'Moyen', 'Médiocre', 'À limiter'], q: 'Quel est le Nutri-Score ?', l: 'Nutri-Score', opts: ['a', 'b', 'c', 'd', 'e'], get: p => p.nutri ? 'abcde'.indexOf(p.nutri) : null, lab: i => 'ABCDE'[i], col: i => `var(--g-${'abcde'[i]})` },
  eco: { subs: ['Très faible', 'Faible', 'Modéré', 'Élevé', 'Très élevé'], q: 'Quel est l’Eco-Score ?', l: 'Eco-Score', opts: ['a', 'b', 'c', 'd', 'e'], get: p => p.eco ? 'abcde'.indexOf(p.eco) : null, lab: i => 'ABCDE'[i], col: i => `var(--g-${'abcde'[i]})` },
  nova: { subs: ['Brut', 'Culinaire', 'Transformé', 'Ultra'], q: 'Quel est le groupe NOVA ?', l: 'groupe NOVA', opts: [1, 2, 3, 4], get: p => p.nova ? p.nova - 1 : null, lab: i => String(i + 1), col: i => `var(--nova-${i + 1})` },
};
const CATS = {
  nutri: { ic: '🍎', l: 'Santé', s: 'Nutri-Score', c: '#1f9d55' },
  eco: { ic: '🌍', l: 'Planète', s: 'Eco-Score', c: '#0e8fb0' },
  nova: { ic: '🏭', l: 'Transformation', s: 'NOVA', c: '#7c4dff' },
};
function catTheme(st, kind) {
  const K = CATS[kind]; if (!K) return null;
  const changed = st.el.dataset.theme && st.el.dataset.theme !== kind;
  st.el.dataset.theme = kind; st.el.style.setProperty('--th', K.c);
  return h('div', { class: 'cat-banner' + (changed ? ' cat-new' : '') }, h('div', {}, h('small', {}, changed ? 'Nouvelle catégorie' : 'Catégorie'), h('b', {}, K.l), h('span', {}, ' · ' + K.s)));
}
const closePts = d => d === 0 ? 100 : d === 1 ? 60 : d === 2 ? 25 : 0;
async function playGuess() {
  const st = openStage('Devine le score');
  const deck = await prepare(st, 5, p => p.nutri && (p.eco || p.nova));
  if (!deck) return;
  let i = 0, total = 0;
  const round = () => {
    const p = deck[i];
    const type = pick(['nutri', ...(p.eco ? ['eco'] : []), ...(p.nova ? ['nova'] : [])]);
    const T = GUESS_TYPES[type];
    const card = cardEl(p, { hide: true, focus: type });
    card.addEventListener('click', e => { if (!e.target.closest('a')) card.classList.toggle('flipped'); });
    const cw = h('div', { class: 'single-card' }, card);
    const btns = T.opts.map((_, k) => h('button', { class: 'ans', style: `--c:${T.col(k)}`, onclick: () => answer(k) }, h('b', {}, T.lab(k)), h('small', {}, T.subs[k])));
    const answers = h('div', { class: 'answers n' + T.opts.length }, btns);
    const fb = h('div', { class: 'feedback' });
    st.setInfo(type); st.setProduct(p); st.setRound(i, deck.length);
    fb.append(h('p', { class: 'tip' }, 'Choisis ta réponse'));
    st.body.replaceChildren(h('div', { class: 'single fit' },
      dots(i, deck.length), catTheme(st, type),
      h('div', { class: 'brief' }, h('b', {}, T.q), h('span', {}, `Touche la carte pour lire ${type === 'eco' ? 'les indices environnementaux' : type === 'nova' ? 'les ingrédients et additifs' : 'les nutriments'}`)),
      cw, answers, fb));

    async function answer(k) {
      btns.forEach(b => b.disabled = true); btns[k].classList.add('picked');
      const truth = T.get(p), d = Math.abs(k - truth), pts = closePts(d);
      const reel = h('div', { class: 'reel spin' }, h('b', {}, '?'));
      fb.replaceChildren(reel, h('div', { class: 'fb-txt' }, h('b', { class: 'wait-t' }, 'Et la réponse est…')));
      for (let n = 0; n < 14; n++) {                             // la machine à sous ralentit avant de s'arrêter
        reel.firstChild.textContent = n < 13 ? T.lab(Math.floor(Math.random() * T.opts.length)) : T.lab(truth);
        sfx.tick(n); await sleep(55 + n * 16);
      }
      reel.classList.remove('spin'); reel.classList.add('land'); reel.style.setProperty('--c', T.col(truth));
      btns.forEach((b, j) => { b.classList.toggle('right', j === truth); b.classList.toggle('wrong', j === k && j !== truth); b.classList.remove('picked'); });
      const real = cardEl(p, { focus: type }); real.classList.add('reveal-pop');
      real.addEventListener('click', e => { if (!e.target.closest('a')) real.classList.toggle('flipped'); });
      cw.replaceChildren(real);
      total += pts; st.award('me', pts);
      st.awardBots(bot => closePts(Math.abs(botIdx(truth, T.opts.length, bot.skill) - truth)));
      if (d === 0) { sfx.ok(); vibrate([15, 30, 15]); confetti(reel, 34); } else if (d === 1) { sfx.ok(); vibrate(15); } else { sfx.bad(); vibrate([30, 40, 30]); shake(reel); }
      const ptsEl = h('div', { class: 'pts ' + (pts ? 'up' : 'zero') }, '0');
      fb.replaceChildren(reel,
        h('div', { class: 'fb-txt' }, ptsEl, h('span', { class: 'fade-in' }, d === 0 ? 'En plein dans le mille !' : d === 1 ? 'Tout près.' : d === 2 ? 'Un peu loin…' : 'Complètement à côté.')),
        h('button', { class: 'btn primary fade-in', onclick: next }, i + 1 < deck.length ? 'Manche suivante' : 'Voir le résultat'));
      countUp(ptsEl, pts, { dur: 600, fmtv: v => (pts ? '+' : '') + Math.round(v), tick: false });
      const ex = explainScore(type, p);
      st.setExplain(ex);
      fb.insertBefore(h('button', { class: 'why-btn fade-in', onclick: () => openSheet('', ex.cloneNode(true)) }, 'Pourquoi ?'), fb.lastChild);
    }
  };
  const next = () => {
    i++;
    if (i < deck.length) return round();
    st.setRound(deck.length - 1, deck.length); st.clearSide();
    st.body.replaceChildren();
    finishPanel(st, resultPanel({ big: total, max: 500, id: 'guess', title: total >= 400 ? 'Nutritionniste !' : total >= 250 ? 'Bon flair' : 'On s’entraîne ?', sub: `${deck.length} manches jouées`, again: playGuess, win: total >= 250 ? true : undefined }), total >= 400);
  };
  round();
}

/* ───────────── 3. Le juste prix ───────────── */
const PRICE_N = [
  { k: 'sugars', l: 'de sucre', u: 'g', max: 80, step: .5 },
  { k: 'salt', l: 'de sel', u: 'g', max: 5, step: .05 },
  { k: 'kcal', l: 'd’énergie', u: 'kcal', max: 900, step: 5 },
  { k: 'fat', l: 'de graisses', u: 'g', max: 100, step: .5 },
  { k: 'sat', l: 'de graisses saturées', u: 'g', max: 50, step: .5 },
];
async function playPrice() {
  const st = openStage('Le juste prix');
  const deck = await prepare(st, 5, p => PRICE_N.some(n => p.n[n.k] != null));
  if (!deck) return;
  let i = 0, total = 0;
  const round = () => {
    const p = deck[i];
    const N = pick(PRICE_N.filter(n => p.n[n.k] != null));
    const truth = p.n[N.k];
    const f = v => (N.step < 1 ? (+v).toFixed(N.step < .1 ? 2 : 1) : Math.round(v)).toString().replace('.', ',');
    const out = h('div', { class: 'big-val' }, h('b', {}, f(N.max / 4)), h('span', {}, N.u));
    const slider = h('input', { type: 'range', class: 'price-range', min: 0, max: N.max, step: N.step, value: N.max / 4, 'aria-label': 'Ton estimation' });
    const paint = () => { out.firstChild.textContent = f(slider.value); slider.style.setProperty('--p', (slider.value / N.max * 100) + '%'); };
    slider.addEventListener('input', () => { paint(); sfx.tick(Math.round(slider.value / N.max * 14)); }); paint();
    const cw = h('div', { class: 'single-card' }, cardEl(p, { hide: true }));
    const go = h('button', { class: 'btn primary', onclick: submit }, 'Verrouiller ma réponse');
    const area = h('div', { class: 'price-area' }, out, slider, h('div', { class: 'range-lab' }, h('span', {}, '0'), h('span', {}, `${N.max} ${N.u}`)), go);
    st.setInfo(N.k); st.setRound(i, deck.length);
    st.body.replaceChildren(h('div', { class: 'single fit' },
      dots(i, deck.length),
      h('div', { class: 'brief' }, h('b', {}, `Combien ${N.l} pour 100 g ?`), h('span', {}, 'Glisse le curseur, le plus proche gagne')), cw, area));

    async function submit() {
      const g = +slider.value, err = Math.abs(g - truth), tol = N.max * .25;
      const pts = Math.max(0, Math.round(100 * (1 - err / tol)));
      slider.disabled = true; vibrate(10); sfx.pop();
      const pct = v => Math.min(100, v / N.max * 100) + '%';
      const tv = h('b', {}, `0 ${N.u}`), real = h('i', { class: 'm real', style: 'left:0%' });
      const ptsEl = h('div', { class: 'pts' }, ''), tag = h('span', { class: 'verdict-tag' }, '');
      const truthBox = h('div', { class: 'truth live' }, h('small', {}, 'Réalité'), tv);
      area.replaceChildren(
        h('div', { class: 'compare' }, h('div', {}, h('small', {}, 'Ton estimation'), h('b', {}, `${f(g)} ${N.u}`)), truthBox),
        h('div', { class: 'track-cmp' }, h('i', { class: 'm guess', style: `left:${pct(g)}` }), real),
        h('div', { class: 'res-row' }, tag, ptsEl));
      await sleep(400);
      await countUp(tv, truth, { dur: 1700, fmtv: v => f(v), suffix: ' ' + N.u, onFrame: v => { real.style.left = pct(v); } });
      truthBox.classList.remove('live');
      const exact = err <= tol * .06;
      tag.className = 'verdict-tag fade-in ' + (exact ? 'ok' : g > truth ? 'hi' : 'lo');
      tag.textContent = exact ? 'Pile dessus !' : g > truth ? `Trop haut ↑ (+${f(err)} ${N.u})` : `Trop bas ↓ (−${f(err)} ${N.u})`;
      total += pts; st.award('me', pts);
      st.awardBots(bot => { const bg = botValue(truth, N.max, bot.skill); return Math.max(0, Math.round(100 * (1 - Math.abs(bg - truth) / tol))); });
      ptsEl.className = 'pts ' + (pts ? 'up' : 'zero');
      pts >= 80 ? (sfx.ok(), vibrate([15, 30, 15])) : pts >= 40 ? sfx.ok() : (sfx.bad(), vibrate([30, 40, 30]));
      if (pts >= 85) confetti(tv, 34); else if (pts < 25) shake(tv);
      await countUp(ptsEl, pts, { dur: 650, fmtv: v => (pts ? '+' : '') + Math.round(v), tick: false });
      const real_ = cardEl(p); real_.classList.add('reveal-pop', 'flipped');
      real_.addEventListener('click', e => { if (!e.target.closest('a')) real_.classList.toggle('flipped'); });
      cw.replaceChildren(real_);
      area.append(h('button', { class: 'btn primary fade-in', onclick: next }, i + 1 < deck.length ? 'Manche suivante' : 'Voir le résultat'));
    }
  };
  const next = () => {
    i++;
    if (i < deck.length) return round();
    st.setRound(deck.length - 1, deck.length); st.clearSide();
    st.body.replaceChildren();
    finishPanel(st, resultPanel({ big: total, max: 500, id: 'price', title: total >= 400 ? 'Balance de précision' : total >= 250 ? 'Pas loin du compte' : 'Le compte n’y est pas', sub: 'Plus tu es proche de la valeur réelle, plus tu marques.', again: playPrice, win: total >= 250 ? true : undefined }), total >= 400);
  };
  round();
}

/* ───────────── 4. Tier List Battle ───────────── */
const TIERS = [
  { label: 'S', sub: 'Top', color: '#ff6b6b' }, { label: 'A', sub: 'Très bien', color: '#ffa94d' }, { label: 'B', sub: 'Correct', color: '#ffe066' },
  { label: 'C', sub: 'Bof', color: '#8ce99a' }, { label: 'D', sub: 'À éviter', color: '#74c0fc' },
];
const TIER_CRIT = {
  nutri: { l: 'Nutri-Score', e: '🅰️', ok: p => !!p.nutri, tier: p => 'abcde'.indexOf(p.nutri) },
  eco: { l: 'Eco-Score', e: '🌍', ok: p => !!p.eco && !!p.nutri, tier: p => 'abcde'.indexOf(p.eco) },
  nova: { l: 'NOVA', e: '🏭', ok: p => !!p.nova && !!p.nutri, tier: p => [0, 1, 3, 4][p.nova - 1] },
};
/* le bot ne connaît pas la note : il devine à partir des nutriments (et se trompe parfois) */
function botTiers(deck) {
  const risk = p => (p.n.sugars ?? 5) * 1.1 + (p.n.sat ?? 2) * 2.2 + (p.n.salt ?? .5) * 7 + (p.n.kcal ?? 200) / 45 - (p.n.fiber ?? 1) * 2 - (p.n.prot ?? 4) * .4 + (p.additives ?? 0) * 1.2 + Math.random() * 3;
  const ranked = [...deck].sort((a, b) => risk(a) - risk(b));
  const out = {};
  ranked.forEach((p, r) => { out[p.code] = Math.min(4, Math.floor(r * 5 / deck.length)); });
  return out;
}
const tierPts = d => d === 0 ? 3 : d === 1 ? 1 : 0;
function playTier() {
  const st = openStage('Tier List Battle');
  const intro = h('div', { class: 'intro' },
    h('h3', {}, 'Sur quelle note te bats-tu ?'),
    h('p', {}, 'Tu places 8 produits de S (le meilleur) à D (le pire). Le bot gourmand joue aussi, mais sans connaître la note.'),
    h('div', { class: 'crit-row' }, Object.entries(TIER_CRIT).map(([k, c]) => h('button', { class: 'crit', onclick: () => start(k) }, h('span', {}, c.e), h('b', {}, c.l)))));
  st.body.replaceChildren(intro);

  async function start(key) {
    const C = TIER_CRIT[key];
    const deck = await prepare(st, 8, C.ok);
    if (!deck) return;
    const zones = [
      ...TIERS.map((t, i) => ({ id: 't' + i, kind: 'tier', mini: true, label: t.label, sub: t.sub, color: t.color, items: [] })),
      { id: 'deck', kind: 'deck', title: 'Pioche', count: true, hint: 'Glisse la carte du dessus', empty: '✓ Tout est placé, tu peux valider', items: itemsOf(deck) },
    ];
    const btn = h('button', { class: 'btn primary', disabled: true, onclick: validate }, 'Valider ma tier list');
    const { board, root } = gameBoard(st, zones, productMap(deck), { cls: 'board-tier', onMove: () => { btn.disabled = zones[5].items.length > 0; } });
    const head = h('div', { class: 'brief' }, h('b', {}, `Classe selon le ${C.l}`), h('span', {}, 'S = le meilleur · D = le pire · tape une carte pour la retourner'));
    st.setInfo(key);
    st.body.replaceChildren(h('div', { class: 'tier-head' }, catTheme(st, key), head), h('div', { class: 'legend' }, h('span', {}, 'Meilleur'), h('span', {}, 'Pire')), root, actionBar(btn));
    renderBoard(board, false);

    async function validate() {
      board.locked = true; root.classList.add('done'); $('.stage-actions', st.body)?.remove(); $('.legend', st.body)?.remove();
      board.hide = false; board.flipped.clear(); renderBoard(board, false);
      const placed = [];
      zones.slice(0, 5).forEach((z, ti) => z.items.forEach(it => placed.push({ it, ti })));
      const truth = it => C.tier(board.products[it.codes[0]]);
      head.replaceChildren(h('div', { class: 'verdict pulse' }, h('b', {}, 'Vérification…'), h('span', {}, 'On compare avec la vraie note')));
      root.classList.add('dim');
      let you = 0; const res = new Map();
      for (const { it, ti } of placed) {
        const slot = slotOf(root, it.id); await spot(slot);
        const m = addMark(slot, '?'); await sleep(380);
        const t = truth(it), d = Math.abs(ti - t); res.set(it.id, { ti, t, d });
        m.classList.remove('wait');
        if (d === 0) { m.classList.add('ok'); m.textContent = '✓'; you += 3; sfx.ok(); vibrate(15); confetti(slot, 16); }
        else if (d === 1) { m.classList.add('near'); m.textContent = '→ ' + TIERS[t].label; you += 1; sfx.ok(); }
        else { m.classList.add('bad'); m.textContent = '→ ' + TIERS[t].label; sfx.bad(); vibrate([30, 40, 30]); shake(slot.querySelector('.card')); }
        st.setScore(you); await sleep(340); slot.classList.remove('spot');
      }
      root.classList.remove('dim');
      head.replaceChildren(h('div', { class: 'verdict' }, h('b', {}, 'La vraie tier list'), h('span', {}, 'Chaque carte retourne à sa place')));
      sfx.pop(); await sleep(500);
      placed.forEach(({ it, ti }) => { const t = truth(it); if (t !== ti) { zones[ti].items.splice(zones[ti].items.indexOf(it), 1); zones[t].items.push(it); } });
      board.mark = it => { const r = res.get(it.id); return r.d === 0 ? { cls: 'val ok', text: '✓' } : { cls: 'val ' + (r.d === 1 ? 'near' : 'bad'), text: '✗ ' + TIERS[r.ti].label }; };
      renderBoard(board, true);
      await sleep(1100);

      // le duel contre le bot
      const bot = botTiers(deck); let botPts = 0;
      deck.forEach(p => { botPts += tierPts(Math.abs(bot[p.code] - C.tier(p))); });
      st.award('me', you);
      st.awardBots(b => b.id === 'chef' ? botPts : deck.reduce((s, p) => { const t = C.tier(p); return s + tierPts(Math.abs(botIdx(t, 5, b.skill) - t)); }, 0));
      await sleep(1200);
      const youWin = you > botPts, draw = you === botPts;
      const youNum = h('b', {}, '0'), botNum = h('b', {}, '0');
      const youBar = h('i', {}), botBar = h('i', {});
      const side = (lbl, num, bar, cls, win) => h('div', { class: 'side ' + cls + (win ? ' win' : '') }, win ? h('span', { class: 'crown' }, '👑') : null, h('small', {}, lbl), num, h('div', { class: 'vs-bar' }, bar));
      const vs = h('div', { class: 'vs' }, side('Toi', youNum, youBar, 'me', youWin), h('div', { class: 'mid' }, 'VS'), side('🤖 Bot gourmand', botNum, botBar, 'bot', !youWin && !draw));
      const botZones = TIERS.map((t, i) => ({ id: 'b' + i, kind: 'tier', mini: true, label: t.label, sub: t.sub, color: t.color, items: itemsOf(deck.filter(p => bot[p.code] === i)) }));
      const botRoot = h('div', { class: 'board board-tier board-static' });
      botRoot.dataset.board = 'bot';
      boards.bot = { name: 'bot', root: () => botRoot, zones: botZones, products: board.products, flipped: new Set(), hide: false, noFlip: true, noExpand: true, locked: true, changed: () => { },
        mark: it => { const p = board.products[it.codes[0]]; const d = Math.abs(bot[p.code] - C.tier(p)); return d === 0 ? { cls: 'val ok', text: '✓' } : { cls: 'val ' + (d === 1 ? 'near' : 'bad'), text: '✗' }; } };
      renderBoard(boards.bot, false);
      const verdict = youWin ? ['Victoire !', 'Tu bats le bot gourmand.'] : draw ? ['Égalité', 'Match nul contre le bot.'] : ['Défaite…', 'Le bot a eu plus de flair cette fois.'];
      const panel = resultPanel({ big: you, max: 24, id: 'tier', noBig: true, title: verdict[0], sub: verdict[1], win: youWin ? true : draw ? undefined : false, again: playTier,
        extra: h('div', { style: 'width:100%' }, vs) });
      finishPanel(st, panel, youWin);
      setTimeout(() => { youBar.style.height = (you / 24 * 100) + '%'; botBar.style.height = (botPts / 24 * 100) + '%'; countUp(youNum, you, { dur: 1200 }); countUp(botNum, botPts, { dur: 1200, tick: false }); }, 350);
    }
  }
}
