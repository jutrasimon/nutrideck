'use strict';
(() => {
  const rendererOnly=document.currentScript?.hasAttribute('data-renderer-only');
  const $ = s => document.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = x => structuredClone(x);
  const key = 'nutrideck.cardgym.v2', playKey = 'nutrideck.cardgym.play.v1';
  const defaults = () => ({v:2,design:'editorial',accent:'#ee7a00',paper:'#fffdf8',ink:'#341f16',radius:11,font:1.15,photo:.95,shadow:28,ratio:1.4,size:240,metric:'sugars',flip:520,squash:0,tilt:true,speedlines:false,scatter:true,fields:{brand:true,nutri:true,nova:true,eco:true,metric:true}});
  const bounds = {ratio:[1.25,1.55],size:[140,300],radius:[0,30],font:[.85,1.25],photo:[.7,1.35],shadow:[0,60],flip:[250,1100],squash:[0,12]};
  function validate(x) {
    if (!x || typeof x !== 'object' || ![1,2].includes(x.v)) throw Error('Format de style non reconnu.');
    const d = defaults();
    for (const k of ['accent','paper','ink']) { if (!/^#[a-f\d]{6}$/i.test(x[k] || '')) throw Error('Couleur invalide.'); d[k] = x[k]; }
    for (const [k,[lo,hi]] of Object.entries(bounds)) { if (x.v===1 && ['flip','squash'].includes(k)) continue; if (!Number.isFinite(x[k]) || x[k]<lo || x[k]>hi) throw Error('Valeur hors limites : '+k); d[k]=x[k]; }
    if (!['sugars','kcal','prot','salt','fiber'].includes(x.metric)) throw Error('Statistique inconnue.');
    d.metric=x.metric;
    for (const k of Object.keys(d.fields)) { if (typeof x.fields?.[k]!=='boolean') throw Error('Champ invalide.'); d.fields[k]=x.fields[k]; }
    for (const k of ['tilt','scatter']) if (x.v===2) { if(typeof x[k]!=='boolean')throw Error('Effet invalide.');d[k]=x[k]; }
    d.squash=0;d.speedlines=false;
    return d;
  }
  let cfg=defaults(); try { const old=JSON.parse(localStorage.getItem(key)); if(old)cfg=validate(old); } catch {}
  // v2 intentionally starts from the user's chosen reference, not obsolete alternate skins.
  let play={favorites:[],slots:[null,null,null]}, undo=null, armed=null;
  try { const p=JSON.parse(localStorage.getItem(playKey)); if(p){ play.favorites=Array.isArray(p.favorites)?p.favorites.filter(x=>typeof x==='string'):[]; if(Array.isArray(p.slots)&&p.slots.length===3){const seen=new Set();play.slots=p.slots.map(x=>typeof x==='string'&&!seen.has(x)?(seen.add(x),x):null);}} } catch {}
  let view='solo', face='front', stress='normal', help=false, current=0, favoritesOnly=false, pinned=null;
  let products=[{code:'demo-avoine',name:'Flocons d’avoine',brand:'Exemple',qty:'500 g',img:'',nutri:'a',nova:1,eco:'b',n:{sugars:1.1,kcal:372,prot:13,salt:.01,fiber:10,fat:7,sat:1.3},ingredients:'Avoine. Données de démonstration du prototype.',allergens:['Gluten'],traces:[],adds:[],additives:null,demo:true}];
  const stats={kcal:['Énergie','kcal'],fat:['Lipides','g'],sat:['Saturés','g'],sugars:['Sucres','g'],salt:['Sel','g'],fiber:['Fibres','g'],prot:['Protéines','g']};
  const allFr={milk:'Lait',gluten:'Gluten',nuts:'Fruits à coque',soybeans:'Soja',eggs:'Œufs',peanuts:'Arachides',sesame:'Sésame','sesame-seeds':'Sésame',fish:'Poisson',celery:'Céleri',mustard:'Moutarde','sulphur-dioxide-and-sulphites':'Sulfites',crustaceans:'Crustacés',lupin:'Lupin',molluscs:'Mollusques'};
  const additiveNames={E150D:'Caramel au sulfite d’ammonium',E322:'Lécithines',E322I:'Lécithines',E336:'Tartrates de potassium',E338:'Acide phosphorique',E450:'Diphosphates',E450I:'Diphosphate disodique',E500:'Carbonates de sodium',E500II:'Bicarbonate de sodium',E503:'Carbonates d’ammonium',E503II:'Bicarbonate d’ammonium',E330:'Acide citrique'};
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fmt = v => v==null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('fr-CA',{maximumFractionDigits:2});
  const grade = g => /^[a-e]$/i.test(g || '') ? g.toUpperCase() : '—';
  let noticeTimer;
  function notice(text){if(!$('#notice'))return;$('#notice').textContent=text;$('#notice').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').style.display='none',3500);}
  function save(){try{localStorage.setItem(key,JSON.stringify(cfg));}catch{notice('Sauvegarde locale indisponible. Exporte ton style.');}}
  function savePlay(){try{localStorage.setItem(playKey,JSON.stringify({favorites:play.favorites.filter(c=>!c.startsWith('local-')),slots:play.slots.map(c=>c?.startsWith('local-')?null:c)}));}catch{notice('Favoris et emplacements conservés pour cette session seulement.');}}
  function product(p=products[current]||products[0]){p=clone(p);if(stress==='long')p.name='Granola croustillant aux amandes, chocolat noir et petits fruits du Québec';if(stress==='noimage')p.img='';if(stress==='broken')p.img='gym-assets/image-inaccessible.jpg';if(stress==='missing'){p.n={};p.nutri=null;p.eco=null;p.nova=null;p.ingredients='';p.allergens=[];p.traces=[];p.adds=[];p.additives=null;}return p;}
  const localURLs = new Set();
  function safeImage(url){if(!url)return '';if(localURLs.has(url))return url;try{const u=new URL(url,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  const heartIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
  function updateFavorites(){
    if($('#fav-count'))$('#fav-count').textContent=play.favorites.length;
    $$('.favorite').forEach(b=>{const on=play.favorites.includes(b.dataset.code);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',on?'Retirer des favoris':'Ajouter aux favoris');b.title=on?'Retirer des favoris':'Ajouter aux favoris';b.classList.toggle('on',on);b.innerHTML=heartIcon;});
    $('#favorites-filter')?.setAttribute('aria-pressed',favoritesOnly);
  }
  function favorite(code){const i=play.favorites.indexOf(code);if(i<0)play.favorites.push(code);else play.favorites.splice(i,1);savePlay();updateFavorites();if(!rendererOnly&&favoritesOnly)render();}
  // Measure the actual title at its rendered width. No line-clamp and no ellipsis.
  function fitTitle(el){
    const card=el.closest('.nd-card');const width=card?.clientWidth;if(!width||!el.clientWidth)return;
    window.fitCardTitle(el,width*.12*(Number(card.style.getPropertyValue('--font'))||1));
  }
  const ro=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{for(const e of entries)$$('.nd-title',e.target).forEach(fitTitle);}):null;
  function fitAll(){ $$('.nd-title').forEach(fitTitle); }
  // Open Food Facts SVG assets: html/images/attributes/src/{nova-group-*,ecoscore-*}.svg
  const novaColors={1:'#00aa00',2:'#ffcc00',3:'#ff6600',4:'#ff0000'};
  const ecoColors={A:'#1e8f4e',B:'#2ecc71',C:'#f5c100',D:'#ef7e1a',E:'#de4523'};
  function frontHTML(p,c){
    const f=c.fields,m=stats[c.metric],n=p.n?.[c.metric],img=safeImage(p.img);
    return `<div class="nd-face nd-front"><div class="nd-top"><span class="nd-brand">${f.brand?esc(p.brand||'Marque non renseignée'):''}</span></div><h3 class="nd-title">${esc(p.name)}</h3><div class="nd-photo">${img?`<img src="${esc(img)}" alt="${esc(p.name)}" draggable="false">`:'<div class="nd-placeholder"><span>▧</span>Photo non disponible</div>'}</div><div class="nd-data">${f.metric?`<div class="nd-metric ${p.masked?'masked':''}"><span>${m[0]}</span><b>${p.masked?'Masqué':fmt(n)}${n!=null?`<em>${m[1]}</em>`:''}</b></div>`:''}<div class="nd-scores">${f.nutri?`<span class="nd-score grade ${p.masked?'masked':''}">Nutri<b>${p.masked?'••':grade(p.nutri)}</b></span>`:''}${f.nova?`<span class="nd-score ${p.masked?'masked':novaColors[p.nova]?'colored':''}" style="--score-color:${novaColors[p.nova]||'transparent'}">NOVA<b>${p.masked?'••':([1,2,3,4].includes(Number(p.nova))?Number(p.nova):'—')}</b></span>`:''}${f.eco?`<span class="nd-score ${p.masked?'masked':ecoColors[grade(p.eco)]?'colored':''}" style="--score-color:${ecoColors[grade(p.eco)]||'transparent'}">Éco<b>${p.masked?'••':grade(p.eco)}</b></span>`:''}</div><div class="nd-foot">${p.demo?'Données de démonstration':'Pour 100 g / 100 ml'}</div></div></div>`;
  }
  function additiveHTML(p){
    const adds=p.adds||[];
    const flagged=adds.filter(a=>/^E(338|339|340|341|343|450|451|452)/.test(a));
    return `<section class="nd-section additives"><h4>Additifs à surveiller <span>${flagged.length?flagged.length+' signalé'+(flagged.length>1?'s':''):'—'}</span></h4>${flagged.length?`<div class="vigilance"><b>${flagged.map(esc).join(' · ')} — phosphates</b><p>L’EFSA signale une vigilance liée aux apports cumulés et à une fonction rénale diminuée. La dose dans ce produit n’est pas renseignée.</p><a href="https://www.efsa.europa.eu/fr/press/news/190612" target="_blank" rel="noopener">Source : EFSA · 2019</a></div>`:'<p class="nd-muted">Aucun signal documenté dans le référentiel limité de ce gym. Cela ne signifie pas « sans risque ».</p>'}<h5>Additifs repérés</h5>${adds.length?`<div class="add-list">${adds.map(a=>`<div><b>${esc(a)}</b><span>${esc(additiveNames[a]||'Nom non renseigné')}</span></div>`).join('')}</div>`:`<p class="nd-muted">${p.additives===0?'Aucun additif repéré par Open Food Facts.':'Données non renseignées.'}</p>`}</section>`;
  }
  function backHTML(p){
    const chips=a=>(a||[]).map(x=>`<span>${esc(x)}</span>`).join('');
    return `<div class="nd-face nd-back"><div class="nd-scroll" tabindex="0" aria-label="Détails du produit, faire défiler"><h3 class="nd-title">${esc(p.name)}</h3>${p.masked?'<p class="nd-mask-note">Valeurs nutritionnelles et scores dévoilés après le vote.</p>':''}<div class="nd-table">${Object.entries(stats).map(([k,[n,u]])=>`<div class="nd-row ${p.masked?'masked':''}"><span>${n}</span><b>${p.masked?'Masqué':fmt(p.n?.[k])}${p.n?.[k]!=null?' '+u:''}</b></div>`).join('')}</div><div class="nd-foot">Pour 100 g / 100 ml · selon la source</div><section class="nd-section ingredients"><h4>Ingrédients</h4><p>${esc(p.ingredients||'Non renseignés')}</p></section><section class="nd-section allergens"><h4>Allergènes <span>${p.allergens?.length||'—'}</span></h4>${p.allergens?.length?`<div class="allergen-chips">${chips(p.allergens)}</div>`:'<p class="nd-muted">Non renseignés. Vérifier l’emballage.</p>'}${p.traces?.length?`<h5>Traces possibles</h5><div class="allergen-chips traces">${chips(p.traces)}</div>`:''}</section>${additiveHTML(p)}<div class="nd-source">${p.local?'IMAGE LOCALE · TEST VISUEL':p.demo?'DÉMONSTRATION':p.masked?'Open Food Facts · fiche masquée':`<a href="https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}" target="_blank" rel="noopener">Open Food Facts</a> · ${esc(p.code)}`}${p.qty?`<span>${esc(p.qty)}</span>`:''}</div></div><div class="scroll-cue" aria-hidden="true">Détails en dessous ↓</div></div>`;
  }
  const mysteryHTML=()=>'<div class="nd-face nd-mystery"><span class="seal">N</span><b>NutriDeck</b><small>À VOUS DE JOUER</small></div>';
  let drag=null;
  function makeCard(p,c,{width=240,initialFace=face,slot=null}={}){
    const d=document.createElement('article');d.className='nd-card';d.dataset.code=p.code;d.dataset.design='editorial';d.dataset.face=initialFace;
    d.setAttribute('aria-label',initialFace==='mystery'?'Carte mystère':p.name);
    const color={A:'#23724a',B:'#577f1b',C:'#846b00',D:'#ae5a16',E:'#b8392c'}[grade(p.nutri)]||'#667365';
    for(const[k,v]of Object.entries({'--width':width+'px','--ratio':c.ratio,'--radius':c.radius+'px','--font':c.font,'--image-scale':c.photo,'--shadow':c.shadow/100,'--paper':c.paper,'--ink':c.ink,'--accent':c.accent,'--flip':c.flip+'ms','--grade':initialFace==='mystery'?'#766354':color}))d.style.setProperty(k,v);
    d.innerHTML='<div class="nd-tilt"><div class="nd-motion"><div class="nd-inner"></div></div></div><div class="nd-actions"><button class="favorite" type="button"></button><button class="grip" type="button" title="Glisser vers un emplacement, ou cliquer puis choisir l’emplacement" aria-label="Prendre la carte">⠿</button><button class="flip-button" type="button" aria-label="Retourner la carte" title="Retourner la carte">↻</button></div>';
    const inner=$$('.nd-inner',d)[0];let isMystery=initialFace==='mystery';
    function populate(){inner.innerHTML=isMystery?mysteryHTML().replace('nd-face nd-mystery','nd-face nd-mystery nd-front')+mysteryHTML().replace('nd-face nd-mystery','nd-face nd-mystery nd-back'):frontHTML(p,c)+backHTML(p);$$('img',d).forEach(img=>{img.addEventListener('error',()=>img.replaceWith(Object.assign(document.createElement('div'),{className:'nd-placeholder',textContent:'Photo non disponible'})));});const sc=d.querySelector('.nd-scroll');if(sc)sc.onscroll=()=>{d._suppressClick=Date.now()+160;const cue=d.querySelector('.scroll-cue');cue.hidden=sc.scrollTop>12||sc.scrollHeight<=sc.clientHeight+2;};requestAnimationFrame(()=>{$$('.nd-title',d).forEach(fitTitle);if(sc)sc.dispatchEvent(new Event('scroll'));});}
    populate();
    function accessible(next){d.dataset.face=next;d.querySelector('.favorite').hidden=next==='mystery';for(const [cls,shown]of [['.nd-front',next==='front'],['.nd-back',next==='back'||next==='mystery']]){const el=d.querySelector(cls);if(el){el.inert=!shown;el.setAttribute('aria-hidden',!shown);}}d.setAttribute('aria-label',next==='mystery'?'Carte mystère':p.name+' — '+(next==='back'?'verso':'recto'));}
    d.setFace=(next,animate=true)=>{
      if(!['front','back','mystery'].includes(next))return;
      const old=d.dataset.face;
      if((next==='mystery')!==isMystery){isMystery=next==='mystery';populate();}
      d.classList.toggle('is-back',next==='back'||next==='mystery');accessible(next);
      clearTimeout(d._turnTimer);
      d.style.setProperty('--rx','0deg');d.style.setProperty('--ry','0deg');
      if(animate&&old!==next&&!reduced()){
        d.classList.add('is-turning');
        d._turnTimer=setTimeout(()=>d.classList.remove('is-turning'),c.flip);
      }else d.classList.remove('is-turning');
      requestAnimationFrame(()=>$$('.nd-title',d).forEach(fitTitle));
    };
    d.setFace(initialFace,false);
    d.querySelector('.favorite').dataset.code=p.code;d.querySelector('.favorite').onclick=e=>{e.stopPropagation();favorite(p.code);};
    d.querySelector('.flip-button').onclick=e=>{e.stopPropagation();d.setFace(d.dataset.face==='front'?'back':'front');};
    d.querySelector('.grip').hidden=rendererOnly;d.querySelector('.grip').onclick=e=>{e.stopPropagation();if(drag?.moved||Date.now()<(d._suppressClick||0))return;armed={code:p.code,slot};if(view!=='slots')view='slots';render();$('.slot-board')?.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'nearest'});$('.empty-slot,.drop-choose')?.focus({preventScroll:true});notice('Choisis un emplacement pour déposer la carte.');};
    d.addEventListener('click',e=>{if(e.target.closest('button,a')||Date.now()<(d._suppressClick||0))return;const sel=window.getSelection();if(sel?.type==='Range'&&d.contains(sel.anchorNode))return;d.setFace(d.dataset.face==='front'?'back':'front');});
    let press=null;
    d.addEventListener('pointerdown',e=>{press={x:e.clientX,y:e.clientY,scroll:d.querySelector('.nd-scroll')?.scrollTop||0};});
    d.addEventListener('pointerup',e=>{if(press&&(Math.hypot(e.clientX-press.x,e.clientY-press.y)>6||Math.abs((d.querySelector('.nd-scroll')?.scrollTop||0)-press.scroll)>2))d._suppressClick=Date.now()+350;press=null;});
    d.addEventListener('pointercancel',()=>{press=null;d._suppressClick=Date.now()+350;});
    d.addEventListener('pointermove',e=>{if(!c.tilt||reduced()||drag||d.classList.contains('is-turning')||e.pointerType!=='mouse')return;const r=d.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;d.style.setProperty('--rx',-y*7+'deg');d.style.setProperty('--ry',x*9+'deg');d.style.setProperty('--shine-x',(x+.5)*100+'%');});
    d.addEventListener('pointerleave',()=>{d.style.setProperty('--rx','0deg');d.style.setProperty('--ry','0deg');});
    d.addEventListener('pointerdown',e=>{if(!rendererOnly)startDrag(e,d,p,slot);});ro?.observe(d);return d;
  }
  window.NutriDeckCards={
    create(raw,{masked=false}={}){
      const p=normalize(raw);if(masked){p.n={};p.nutri=null;p.nova=null;p.eco=null;p.masked=true;}
      const card=makeCard(p,{...cfg,size:240,tilt:false,scatter:false},{width:240,initialFace:'front'});
      updateFavorites();requestAnimationFrame(updateFavorites);return card;
    },
    dispose(card){if(card){ro?.unobserve(card);clearTimeout(card._turnTimer);}},
    fit:fitAll
  };
  if(rendererOnly){document.fonts?.ready.then(fitAll);window.addEventListener('resize',fitAll);return;}
  function startDrag(e,d,p,slot){
    if(e.button!==0||drag||e.target.closest('a,.favorite,.flip-button')||((e.pointerType==='touch'||d.dataset.face==='back')&&!e.target.closest('.grip')))return;
    if(d.dataset.face==='back'&&!e.target.closest('.grip'))return;
    drag={code:p.code,slot,card:d,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,ghost:null,target:null};
    // Capture only after drag threshold, preserving native button clicks.
  }
  function moveDrag(e){
    if(!drag||drag.id!==e.pointerId)return;
    if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;
    if(!drag.moved){drag.moved=true;try{drag.card.setPointerCapture(e.pointerId);}catch{}const r=drag.card.getBoundingClientRect();drag.ghost=drag.card.cloneNode(true);drag.ghost.classList.add('drag-ghost');drag.ghost.classList.remove('flipping');drag.ghost.setAttribute('aria-hidden','true');drag.ghost.inert=true;drag.ghost.style.width=drag.card.offsetWidth+'px';drag.ghost.style.height=drag.card.offsetHeight+'px';drag.ox=drag.x-r.left;drag.oy=drag.y-r.top;document.body.append(drag.ghost);drag.card.classList.add('dragging');document.body.classList.add('is-dragging');}
    e.preventDefault();drag.ghost.style.left=e.clientX-drag.ox+'px';drag.ghost.style.top=e.clientY-drag.oy+'px';
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]');$$('.drop-active').forEach(x=>x.classList.remove('drop-active'));if(target){target.classList.add('drop-active');drag.target=Number(target.dataset.drop);}else drag.target=null;
    const pane=$('.workarea'),rect=pane.getBoundingClientRect();if(e.clientY>rect.bottom-65)pane.scrollTop+=15;else if(e.clientY<rect.top+65)pane.scrollTop-=15;
  }
  function finishDrag(e,cancel=false){if(!drag||e.pointerId!==drag.id)return;const d=drag;if(d.moved)d.card._suppressClick=Date.now()+400;d.ghost?.remove();d.card.classList.remove('dragging');document.body.classList.remove('is-dragging');$$('.drop-active').forEach(x=>x.classList.remove('drop-active'));try{d.card.releasePointerCapture(d.id);}catch{}drag=null;if(!cancel&&d.moved&&d.target!==null)place(d.code,d.target);}
  document.addEventListener('pointermove',moveDrag,{passive:false});document.addEventListener('pointerup',e=>finishDrag(e));document.addEventListener('pointercancel',e=>finishDrag(e,true));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(drag)finishDrag({pointerId:drag.id},true);armed=null;render();}});
  function place(code,index){
    if(!products.some(p=>p.code===code)||!Number.isInteger(index)||index<0||index>2)throw Error('Emplacement ou carte invalide.');
    const from=play.slots.indexOf(code);if(from===index){armed=null;render();return;}
    undo=clone(play.slots);const replaced=play.slots[index];play.slots[index]=code;if(from>=0)play.slots[from]=replaced;armed=null;savePlay();render();const landed=$(`[data-drop="${index}"] .nd-card`);landed?.classList.add('landed');notice(replaced?(from>=0?'Cartes échangées.':'Carte remplacée; elle reste dans la galerie.'):'Carte déposée.');
  }
  function wrap(p,c,width,label,options={}){const w=document.createElement('div');w.className='card-wrap';if(label){const l=document.createElement('div');l.className='card-label';l.textContent=label;w.append(l);}w.append(makeCard(p,c,{width,...options}));return w;}
  function visibleProducts(){return products.filter(p=>!favoritesOnly||play.favorites.includes(p.code));}
  function render(){
    ro?.disconnect();const s=$('#stage');s.replaceChildren();s.dataset.view=view;s.classList.toggle('show-guides',help);const p=product();
    $$('[data-view]').forEach(b=>b.tagName==='BUTTON'&&b.setAttribute('aria-pressed',b.dataset.view===view));$$('[data-face]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.face===face));
    if(view==='solo'){s.append(wrap(p,cfg,Math.min(330,window.innerWidth-60),'APERÇU DE TRAVAIL'));if(window.innerWidth>850)s.append(wrap(p,cfg,cfg.size,'EN JEU · '+cfg.size+' PX'));}
    if(view==='compare'){if(pinned)s.append(wrap(p,pinned,cfg.size,'RÉGLAGE ÉPINGLÉ'));for(const [ratio,name]of [[1.25,'COMPACT'],[1.4,'POKER'],[1.55,'ÉLANCÉ']])s.append(wrap(p,{...cfg,ratio},cfg.size,name));}
    if(view==='hand'||view==='grid'){const list=visibleProducts();if(!list.length)s.innerHTML='<p class="empty">Aucun favori pour le moment. Ajoute un cœur à une carte.</p>';else{const target=view==='hand'?Object.assign(document.createElement('div'),{className:'hand'}):s;const shown=view==='hand'?list.slice(0,6):list;shown.forEach((item,i)=>{const w=wrap(product(item),cfg,cfg.size,'');w.style.setProperty('--angle',(cfg.scatter?(i-(shown.length-1)/2)*3:0)+'deg');w.style.setProperty('--lift',(cfg.scatter?Math.abs(i-(shown.length-1)/2)*6:0)+'px');if(view==='grid')w.style.setProperty('--rest-angle',(cfg.scatter?[-1.1,.7,-.5,1][i%4]:0)+'deg');target.append(w);});if(view==='hand')s.append(target);}}
    if(view==='slots')renderSlots(s);
    $('#caption').textContent={solo:'Clique pour retourner · cœur pour garder',compare:'Un seul style. Trois formats à la même largeur.',hand:'Survole · retourne · attrape par la poignée ⠿',grid:'Toutes les photos, sans découpe. Cœur = favori.',slots:armed?'Choisis un emplacement. Échap pour annuler.':'Glisse une carte par sa poignée ⠿, ou clique la poignée puis un emplacement.'}[view];
    $('#size-out').textContent=cfg.size+' px';$('#undo').hidden=!undo;updateFavorites();checks();imageInfo();requestAnimationFrame(fitAll);
  }
  function renderSlots(stage){
    const board=document.createElement('div');board.className='slot-board';
    play.slots.forEach((code,i)=>{const p=products.find(p=>p.code===code);const slot=document.createElement('section');slot.className='drop-slot'+(armed?' ready':'');slot.dataset.drop=i;slot.style.setProperty('--slot-width',cfg.size+'px');slot.style.setProperty('--slot-height',cfg.size*cfg.ratio+'px');slot.innerHTML=`<div class="slot-head"><span>EMPLACEMENT 0${i+1}</span>${p?'<button class="release" aria-label="Retirer la carte de cet emplacement">×</button>':''}</div>`;if(p)slot.append(wrap(product(p),cfg,cfg.size,'',{slot:i}));const drop=document.createElement('button');drop.className=p?'drop-choose':'empty-slot';drop.textContent=armed?(p?'Échanger ici':'Déposer ici'):(p?'Choisir une carte pour remplacer':'＋ Déposer une carte');drop.setAttribute('aria-label','Déposer dans l’emplacement '+(i+1));drop.onclick=()=>{if(armed)place(armed.code,i);else notice('Prends d’abord une carte avec sa poignée ⠿.');};slot.append(drop);slot.querySelector('.release')?.addEventListener('click',()=>{undo=clone(play.slots);play.slots[i]=null;savePlay();render();});board.append(slot);});stage.append(board);
    const tray=document.createElement('div');tray.className='card-tray';const list=visibleProducts().filter(p=>!play.slots.includes(p.code));if(!list.length)tray.innerHTML='<p class="empty">Aucune autre carte dans cette sélection.</p>';list.forEach(p=>tray.append(wrap(product(p),cfg,cfg.size,'')));stage.append(tray);
  }
  function luminance(hex){const a=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
  function checks(){const a=luminance(cfg.paper.slice(1)),b=luminance(cfg.ink.slice(1));const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);$('#checks').innerHTML=`<span class="${contrast>=4.5?'ok':'warn'}">Contraste ${contrast.toFixed(1)}:1</span><span class="ok">Titre complet · 2 lignes max.</span><span>Image contenue · sans découpe</span>`;}
  function imageInfo(){const p=products[current];const el=$('#image-info');el.textContent=p.local?'Image locale · session seulement':'';if(!p.img)return;const im=new Image();im.onload=()=>{if(products[current]?.code===p.code)el.textContent=`${im.naturalWidth} × ${im.naturalHeight} px · ${im.naturalWidth/im.naturalHeight>.95?(im.naturalWidth/im.naturalHeight>1.1?'horizontal':'carré'):'vertical'}${p.local?' · local':''}`;};im.src=safeImage(p.img);}
  function sync(){for(const id of ['ratio','metric','size','accent','paper','ink'])$('#'+id).value=cfg[id];for(const k of ['radius','font','photo','shadow','flip']){const i=$('#'+k);i.value=cfg[k];i.previousElementSibling.textContent=['font','photo'].includes(k)?Math.round(cfg[k]*100)+' %':cfg[k]+(k==='radius'?' px':k==='flip'?' ms':' %');}for(const k of Object.keys(cfg.fields))$('#field-'+k).checked=cfg.fields[k];for(const k of ['tilt','scatter'])$('#'+k).checked=cfg[k];render();}
  const sliders=defs=>defs.map(([id,label,min,max,step])=>`<label>${label}<output></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"></label>`).join('');
  $('#sliders').innerHTML=sliders([['radius','Angles',0,30,1],['font','Typographie',.85,1.25,.05],['photo','Échelle de la photo',.7,1.35,.05],['shadow','Ombre',0,60,5]]);
  $('#motion-controls').innerHTML=sliders([['flip','Durée du flip',250,1100,10]]);
  $('#fields').innerHTML=Object.entries({brand:'Marque',metric:'Valeur forte',nutri:'Nutri-Score',nova:'NOVA',eco:'Éco-Score'}).map(([id,l])=>`<label><input type="checkbox" id="field-${id}">${l}</label>`).join('');
  for(const k of ['ratio','metric','size','accent','paper','ink','radius','font','photo','shadow','flip'])$('#'+k).addEventListener('input',e=>{cfg[k]=Object.hasOwn(bounds,k)?Number(e.target.value):e.target.value;save();sync();});
  for(const k of Object.keys(cfg.fields))$('#field-'+k).onchange=e=>{cfg.fields[k]=e.target.checked;save();render();};
  for(const k of ['tilt','scatter'])$('#'+k).onchange=e=>{cfg[k]=e.target.checked;save();render();};
  $('#views').onclick=e=>{if(e.target.dataset.view){view=e.target.dataset.view;render();}};
  $('#faces').onclick=e=>{if(e.target.dataset.face){face=e.target.dataset.face;$$('.nd-card', $('#stage')).forEach(d=>d.setFace(face));$$('[data-face]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.face===face));}};
  $('#stress').onchange=e=>{stress=e.target.value;render();};$('#help').onclick=()=>{help=!help;$('#help').setAttribute('aria-pressed',help);render();};$('#pin').onclick=()=>{pinned=clone(cfg);view='compare';render();notice('Réglage épinglé pour cette session.');};
  $('#favorites-filter').onclick=()=>{favoritesOnly=!favoritesOnly;if(favoritesOnly&&!['grid','hand','slots'].includes(view))view='grid';render();};
  $('#undo').onclick=()=>{if(undo){play.slots=undo;undo=null;armed=null;savePlay();render();notice('Déplacement annulé.');}};
  $('#reset').onclick=()=>{cfg=defaults();save();sync();notice('Réglages Éditorial restaurés.');};
  $('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(validate(cfg),null,2)],{type:'application/json'}));a.download='nutrideck-editorial-v031.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  $('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>50000)throw Error('Fichier trop volumineux.');cfg=validate(JSON.parse(await f.text()));save();sync();notice('Style importé.');}catch(err){notice(err.message||'Fichier invalide.');}e.target.value='';};
  $('#local-image').onclick=()=>$('#image-file').click();$('#image-file').onchange=async e=>{let count=0;for(const f of [...e.target.files].slice(0,12)){if(!['image/png','image/jpeg','image/webp','image/avif'].includes(f.type)||f.size>15000000){notice('PNG, JPG, WebP ou AVIF · 15 Mo maximum.');continue;}const url=URL.createObjectURL(f);try{const im=new Image();im.src=url;await im.decode();localURLs.add(url);products.push({code:'local-'+crypto.randomUUID(),name:f.name.replace(/\.[^.]+$/,''),brand:'Image de test',img:url,n:{},qty:'',ingredients:'',allergens:[],traces:[],adds:[],local:true});current=products.length-1;count++;}catch{URL.revokeObjectURL(url);notice('Cette image ne peut pas être lue.');}}e.target.value='';if(count){updateProducts();view='grid';favoritesOnly=false;render();notice(count+' image(s) ajoutée(s) pour cette session.');}};
  function updateProducts(){const select=$('#product');select.replaceChildren(...products.map((p,i)=>new Option(p.name+(p.demo?' · démo':''),i)));select.value=current;render();}
  $('#product').onchange=e=>{current=Number(e.target.value);render();};
  function normalize(p){const n=p.nutriments||{};const fr=list=>(list||[]).map(x=>{x=x.replace(/^\w\w:/,'');return allFr[x]||x.replace(/-/g,' ');});let adds=(p.additives_tags||[]).map(a=>a.replace(/^\w\w:/,'').toUpperCase());adds=adds.filter(a=>!adds.some(b=>b!==a&&b.startsWith(a)&&/^E\d+$/.test(a)));return{code:p.code,name:p.product_name_fr||p.product_name||'Produit sans nom',brand:(p.brands||'').split(',')[0],qty:p.quantity||'',img:p.localImage||p.image_front_url||'',nutri:p.nutriscore_grade,nova:p.nova_group,eco:p.ecoscore_grade,n:{sugars:n.sugars_100g,kcal:n['energy-kcal_100g'],prot:n.proteins_100g,salt:n.salt_100g,fiber:n.fiber_100g,fat:n.fat_100g,sat:n['saturated-fat_100g']},ingredients:p.ingredients_text_fr||p.ingredients_text||'',allergens:fr(p.allergens_tags),traces:fr(p.traces_tags),adds,additives:p.additives_n??null};}
  sync();updateProducts();fetch('gym-products.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{const real=data.map(normalize);let saved=[];try{saved=Object.values(JSON.parse(localStorage.getItem('nutrideck.v1'))?.products||{}).filter(p=>p.name&&p.n);}catch{}products=[...real,...saved.filter(p=>!real.some(r=>r.code===p.code)),...products];updateProducts();}).catch(()=>notice('Exemples hors ligne affichés.'));
  document.fonts?.ready.then(fitAll);let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});
  window.addEventListener('pagehide',()=>{ro?.disconnect();for(const url of localURLs)URL.revokeObjectURL(url);},{once:true});
  window.NutriCardGym={makeCard,validate,fitTitle,getStyle:()=>clone(cfg),getPlay:()=>clone(play)};
  if(document.modelContext?.registerTool){const life=new AbortController();const tool={name:'configure_card_style',description:'Régler la largeur des cartes Éditorial du gym.',inputSchema:{type:'object',properties:{size:{type:'number',minimum:140,maximum:300}},required:['size'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||!Number.isFinite(input.size)||input.size<140||input.size>300)throw Error('Taille invalide');cfg.size=input.size;save();sync();return{style:clone(cfg)};}};try{Promise.resolve(document.modelContext.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>life.abort(),{once:true});}
})();
