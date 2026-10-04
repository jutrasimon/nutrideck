import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import worker from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_deep_wraith.sql','utf8'));
const DB={prepare(sql){return {bind(...params){return{async first(){return sqlite.prepare(sql).get(...params)||null},async run(){const r=sqlite.prepare(sql).run(...params);return{meta:{changes:r.changes}}}}}}}};
let clock=Date.now();Date.now=()=>clock;const tokens=['a','b','c','d'].map(x=>x.repeat(64));
async function req(path,who=0,data,status=200){const r=await worker.fetch(new Request('https://nutri.test/api/rooms'+path,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+tokens[who],'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),{DB},{});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const raw=JSON.parse(readFileSync('public/gym-products.json'))[0];const fixture=Array.from({length:18},(_,i)=>({...raw,code:String(4000000000000+i),countries_tags:i<12?['en:canada']:['en:france'],image_front_url:'https://images.openfoodfacts.org/test.jpg',nutriscore_grade:'c',nova_group:4,ecoscore_grade:'b',nutriscore_version:'2023',nutriscore:{'2023':{grade:'c',data:{negative_points:8,positive_points:1,components:{negative:[{id:'sugars',value:25,unit:'g',points:6}],positive:[{id:'fiber',value:2,unit:'g',points:1}]}}}}}));
const urls=[];globalThis.fetch=async (url,options)=>{urls.push(String(url));if(options?.method==='HEAD')return new Response(null,{headers:{'Content-Type':'image/jpeg'}});return Response.json({products:fixture,hits:fixture})};
let s=await req('',0,{name:'Simon',avatar:'🦊',count:2,novaCount:1,ecoCount:1,country:'canada',readySeconds:15,seconds:20,operation:'f'.repeat(32)}),id=s.id;
await Promise.all([req('/'+id+'/join',1,{name:'Paul',avatar:'🐼'}),req('/'+id+'/join',2,{name:'Kattie',avatar:'🐸'})]);
s=await req('/'+id+'/start',0,{});assert.equal(s.phase,'intro');assert.equal(s.mode,'nutri');assert.equal(s.product,null);assert(new URL(urls[0]).searchParams.get('q').includes('countries_tags:"en:canada"'),'country query');const saved=()=>JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE id=?').get(id).state);assert(saved().deck.every(p=>p.countries_tags.includes('en:canada')),'never broadens country');assert.equal(new Set(saved().deck.map(p=>p.code)).size,4,'no repeated products across phases');
async function ready(who){return req('/'+id+'/ready',who,{gameId:s.gameId,step:s.step,ready:true});}
const introStep=s.step;s=await ready(0);assert.equal(s.phase,'intro');await ready(1);s=await ready(2);assert.equal(s.phase,'vote');await req('/'+id+'/ready',0,{gameId:s.gameId,step:introStep},409);
async function cast(who,choice){return req('/'+id+'/vote',who,{gameId:s.gameId,round:s.round,choice});}
assert(!s.product.nutriscore_grade&&!s.product.nutriscore&&!s.product.nova_group&&!s.product.ecoscore_data);s=await cast(0,'A');s=await cast(0,'C');assert.equal(s.players[0].vote,'C');assert((await req('/'+id,1)).players[0].vote===null);await cast(1,'E');s=await cast(2,'C');assert.equal(s.phase,'reveal');assert.equal(s.revealPlan.at(-1).value,'C');assert(!s.insights&&!s.product.nutriscore_grade);clock=s.landAt+100;s=await req('/'+id);assert(s.insights.points.some(x=>x.text.includes('6 points défavorables')));assert.equal(s.players[0].stats.bestStreak,1);const score=s.players[0].score;
clock=s.resultAt+1;s=await req('/'+id);assert.equal(s.phase,'results');const gate=s.step;await ready(0);await ready(1);s=await ready(2);assert.equal(s.phase,'vote');assert.equal(s.round,2);assert.equal(s.mode,'nutri');assert.equal(s.players[0].base,score);
s=await cast(0,'C');clock=s.deadline+1;s=await req('/'+id);assert.equal(s.phase,'reveal','vote clock expires offline');assert.equal(s.players[0].stats,null,'stats masked during roll');clock=s.resultAt+1;s=await req('/'+id);assert.equal(s.players[0].stats.bestStreak,2);assert.equal(s.players[1].award,0);clock=s.readyDeadline+1;s=await req('/'+id);assert.equal(s.phase,'intro');assert.equal(s.mode,'nova');const oldGame=s.gameId;
clock=s.readyDeadline+1;s=await req('/'+id);assert.equal(s.phase,'vote');await req('/'+id+'/vote',0,{gameId:s.gameId,round:s.round,choice:'A'},400);await cast(0,'4');await cast(1,'1');s=await cast(2,'4');assert.equal(s.revealPlan.at(-1).value,'4');clock=s.resultAt+1;s=await req('/'+id);assert.equal(s.players[0].stats.bestStreak,3);assert.equal(s.players[1].stats.worst.mode,'nova');clock=s.readyDeadline+1;s=await req('/'+id);assert.equal(s.phase,'intro');assert.equal(s.mode,'eco');await ready(0);await ready(1);s=await ready(2);await cast(0,'B');await cast(1,'D');s=await cast(2,'B');clock=s.resultAt+1;s=await req('/'+id);assert.equal(s.phase,'finished');assert.equal(s.readyDeadline,null);assert.equal(s.lastFinal.players[0].stats.bestStreak,4);assert.equal(s.lastFinal.history.length,4);const finals=JSON.stringify(s.lastFinal);clock+=86400000;s=await req('/'+id);assert.equal(s.phase,'finished');assert.equal(JSON.stringify(s.lastFinal),finals,'final has no timer');
s=await req('/'+id+'/lobby',0,{});assert.equal(JSON.stringify(s.lastFinal),finals,'host preparation preserves everyone’s podium');s=await req('/'+id+'/settings',0,{count:1,novaCount:0,ecoCount:0,seconds:20,readySeconds:30,country:'canada'});assert.equal(s.total,1);s=await req('/'+id+'/start',0,{});assert.notEqual(s.gameId,oldGame);assert.equal(s.phase,'intro');assert.equal(s.players[0].stats.exact,0);await ready(0);await ready(1);s=await ready(2);await req('/'+id+'/vote',0,{gameId:oldGame,round:1,choice:'A'},409);s=await req('/'+id+'/skip',0,{gameId:s.gameId,round:1});clock=s.resultAt+1;s=await req('/'+id);assert.equal(s.phase,'finished','zero bonuses skipped');const totals=s.players.map(p=>p.score);await Promise.all(Array.from({length:8},()=>req('/'+id)));assert.deepEqual((await req('/'+id)).players.map(p=>p.score),totals,'no double awards');s=await req('/'+id+'/leave',1,{});assert.equal(s.me,null);assert.equal(s.players.length,2);assert.equal((await req('/'+id)).lastFinal.players.length,3,'leaving preserves historical ranking');
// Existing v0.6 rooms still open correctly after this deployment.
const old={id:'9'.repeat(32),host:'old',phase:'finished',count:1,seconds:20,round:0,deck:[raw],players:[{id:'old',name:'Old',avatar:'🦊',token:saved().players[0].token,score:1000,base:0,vote:'A',award:1000}],createdAt:clock};sqlite.prepare('INSERT INTO rooms VALUES(?,?,0,?)').run(old.id,JSON.stringify(old),clock);const legacy=await req('/'+old.id);assert.equal(legacy.lastFinal.players[0].score,1000);assert.equal(legacy.lastFinal.statsAvailable,false);
console.log('PASS country filter, unique deck, 3 phases, ready all/timers, stale gate/game protection, varied roll endpoint, verified insights, stats/streaks, durable independent final, leave, zero bonuses and v0.6 compatibility.');

// A host can test the real game alone, including readiness, reveal and scoring.
clock+=21000;
let solo=await req('',3,{name:'Solo',avatar:'🦊',count:1,novaCount:0,ecoCount:0,country:'canada',readySeconds:15,seconds:20,operation:'e'.repeat(32)});
const soloPath='/'+solo.id;
solo=await req(soloPath+'/start',3,{});assert.equal(solo.phase,'intro');assert.equal(solo.players.length,1);
solo=await req(soloPath+'/ready',3,{gameId:solo.gameId,step:solo.step,ready:true});assert.equal(solo.phase,'vote');
solo=await req(soloPath+'/vote',3,{gameId:solo.gameId,round:solo.round,choice:'C'});assert.equal(solo.phase,'reveal','the only vote completes the ballot');
clock=solo.resultAt+1;solo=await req(soloPath,3);assert.equal(solo.phase,'finished');assert.equal(solo.players[0].score,1000);
console.log('PASS solo start, ready, immediate vote lock, reveal and final score.');

// Missing scores/names and dead photos cannot enter a drawn deck.
clock+=21000;
const bad=fixture.slice(0,5).map((p,i)=>({...p,code:String(5000000000000+i)}));
bad[0].product_name=bad[0].product_name_fr='Non renseigné';bad[1].nutriscore_grade='unknown';bad[2].image_front_url='';bad[3].image_front_url='https://images.openfoodfacts.org/dead.jpg';bad[4].image_front_url='https://images.openfoodfacts.org/html.jpg';
const candidates=[...bad,...fixture.slice(0,8)];
sqlite.exec('DELETE FROM off_cache');
globalThis.fetch=async(url,options)=>{if(options?.method==='HEAD')return new Response(null,{status:String(url).includes('dead')?404:200,headers:{'Content-Type':String(url).includes('html')?'text/html':'image/jpeg'}});return Response.json({products:candidates,hits:candidates});};
let filtered=await req('',3,{name:'Filter',avatar:'🦊',count:8,novaCount:0,ecoCount:0,country:'canada',seconds:20,readySeconds:30,operation:'d'.repeat(32)});filtered=await req('/'+filtered.id+'/start',3,{});
const filteredDeck=JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE id=?').get(filtered.id).state).deck;
assert.equal(filteredDeck.length,8);assert(filteredDeck.every(p=>p.code.startsWith('4')),'bad records replaced by valid candidates');
console.log('PASS missing name/score/photo, 404 and non-image responses excluded; replacement deck complete.');

sqlite.exec('DELETE FROM off_cache');
globalThis.fetch=async(url,options)=>options?.method==='HEAD'?new Response(null,{status:404}):Response.json({products:fixture,hits:fixture});
await req('/'+filtered.id+'/skip',3,{},409);
let unavailable=await req('',3,{name:'Unavailable',avatar:'🦊',count:1,novaCount:0,ecoCount:0,country:'canada',seconds:20,readySeconds:30,operation:'c'.repeat(32)});
await req('/'+unavailable.id+'/start',3,{},503);assert.equal((await req('/'+unavailable.id,3)).phase,'lobby','failed photo verification preserves room');
console.log('PASS all photos unavailable: no incomplete game starts and room survives.');
// Short draws automatically start with verified products and coherent phase counts.
for(const sparse of [true,false]){
 sqlite.exec('DELETE FROM off_cache');
 const one={...fixture[0],image_front_url:'https://images.openfoodfacts.org/available.jpg',nova_group:null,ecoscore_grade:'unknown'};
 globalThis.fetch=async(url,options)=>options?.method==='HEAD'?new Response(null,{status:String(url).includes('available.jpg')?200:404,headers:{'Content-Type':'image/jpeg'}}):Response.json({products:sparse?[one]:[one,...fixture.slice(1)],hits:sparse?[one]:[one,...fixture.slice(1)]});
 let short=await req('',3,{name:'Short',avatar:'🦊',count:4,novaCount:1,ecoCount:1,country:'canada',seconds:20,readySeconds:30,operation:(sparse?'1':'2').repeat(32)});
 short=await req('/'+short.id+'/start',3,{});assert.equal(short.phase,'intro');assert.equal(short.requestedTotal,6);assert.equal(short.total,1);assert.equal(short.count,1);assert.equal(short.novaCount,0);assert.equal(short.ecoCount,0);
 short=await req('/'+short.id+'/ready',3,{gameId:short.gameId,step:short.step,ready:true});assert.equal(short.phase,'vote');assert.equal(short.phaseTotal,1);
 short=await req('/'+short.id+'/vote',3,{gameId:short.gameId,round:short.round,choice:'C'});clock=short.resultAt+1;short=await req('/'+short.id,3);assert.equal(short.phase,'finished');assert.equal(short.lastFinal.total,1);
}
console.log('PASS 6 requested -> 1 valid: short search pool and failed photos, absent bonuses skipped, correct final.');
// Service errors are not reported as a shortage; HEAD rejection gets a GET retry.
for(const scenario of ['head-rejected','image-outage','search-outage']){
 sqlite.exec('DELETE FROM off_cache');const calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push([String(url),opts?.method||'GET']);if(String(url).includes('images.openfoodfacts.org'))return scenario==='head-rejected'?new Response(null,{status:opts?.method==='HEAD'?405:200,headers:{'Content-Type':'image/jpeg'}}):new Response(null,{status:503});if(scenario==='search-outage')return new Response(null,{status:503});return Response.json({products:fixture,hits:fixture});};
 let test=await req('',3,{name:'Network',avatar:'🦊',count:6,novaCount:0,ecoCount:0,country:'canada',seconds:20,readySeconds:30,operation:({ 'head-rejected':'3','image-outage':'4','search-outage':'5'}[scenario]).repeat(32)});
 const result=await req('/'+test.id+'/start',3,{},scenario==='head-rejected'?200:503);
 if(scenario==='head-rejected'){assert.equal(result.total,6);assert(calls.some(([url,method])=>url.includes('images.')&&method==='GET'));assert(!calls.some(([url])=>url.includes('/api/v2/search')),'working search never calls legacy search');}
 else assert(result.error.includes(scenario==='image-outage'?'Vérification des photos indisponible':'Open Food Facts est indisponible'));
}
console.log('PASS preferred search, HEAD-to-GET fallback, distinct search and photo outages.');
