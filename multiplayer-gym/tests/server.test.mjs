import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import worker from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_deep_wraith.sql','utf8'));
const DB={prepare(sql){return {bind(...params){return{async first(){return sqlite.prepare(sql).get(...params)||null},async run(){const r=sqlite.prepare(sql).run(...params);return{meta:{changes:r.changes}}}}}}}};
let clock=Date.now();Date.now=()=>clock;const tokens=['a','b','c','d'].map(x=>x.repeat(64));
async function req(path,who=0,data,status=200){const r=await worker.fetch(new Request('https://nutri.test/api/rooms'+path,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+tokens[who],'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),{DB},{});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const raw=JSON.parse(readFileSync('public/gym-products.json'))[0];const fixture=Array.from({length:18},(_,i)=>({...raw,code:String(4000000000000+i),quantity:'250 g',nutriments:{...raw.nutriments,sugars_100g:i+1,salt_100g:(i+1)/10,fat_100g:i+2,fiber_100g:i+3,proteins_100g:i+4},countries_tags:i<12?['en:canada']:['en:france'],image_front_url:'https://images.openfoodfacts.org/test.jpg',nutriscore_grade:'c',nova_group:4,ecoscore_grade:'b',nutriscore_version:'2023',nutriscore:{'2023':{grade:'c',data:{negative_points:8,positive_points:1,components:{negative:[{id:'sugars',value:25,unit:'g',points:6}],positive:[{id:'fiber',value:2,unit:'g',points:1}]}}}}}));
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
clock=solo.resultAt+1;solo=await req(soloPath,3);assert.equal(solo.phase,'finished');assert.equal(solo.players[0].score,120);
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
// New roulette loop: deterministic boundary slots exercise the exact 75/10/5/10 mapping.
sqlite.exec('DELETE FROM off_cache');globalThis.fetch=async(url,opts)=>opts?.method==='HEAD'?new Response(null,{headers:{'Content-Type':'image/jpeg'}}):Response.json({products:fixture,hits:fixture});
const originalRandom=crypto.getRandomValues.bind(crypto),testSlots=[0,74,75,84,85,89,42];let remainingSlots=[...testSlots];crypto.getRandomValues=arr=>{if(remainingSlots.length){arr[0]=remainingSlots.shift();return arr;}return originalRandom(arr);};
let wheelRoom=await req('',3,{name:'Roulette',avatar:'🦊',roulette:true,questionCount:7,seconds:17,readySeconds:11,readyEnabled:false,country:'canada',operation:'6'.repeat(32)});
const wheelPath='/'+wheelRoom.id;wheelRoom=await req(wheelPath+'/start',3,{});crypto.getRandomValues=originalRandom;
assert.equal(wheelRoom.phase,'wheel');assert.equal(wheelRoom.total,7);assert.equal(wheelRoom.product,null);assert.equal(wheelRoom.readyEnabled,false);
const expected=['nutri','nutri','eco','eco','nova','nova','nutri'];
for(let round=0;round<7;round++){
 assert.equal(wheelRoom.phase,'wheel');assert.equal(wheelRoom.mode,expected[round]);assert.equal(wheelRoom.wheelSlot,testSlots[round]);
 clock=wheelRoom.wheelEndAt+1;wheelRoom=await req(wheelPath,3);assert.equal(wheelRoom.phase,'intro');assert.equal(wheelRoom.product,null);
 clock=wheelRoom.introEndAt+1;wheelRoom=await req(wheelPath,3);assert.equal(wheelRoom.phase,'vote');assert(!wheelRoom.product.nutriscore_grade);
 wheelRoom=await req(wheelPath+'/vote',3,{gameId:wheelRoom.gameId,round:wheelRoom.round,choice:expected[round]==='nova'?'4':expected[round]==='eco'?'B':'C'});assert.equal(wheelRoom.phase,'reveal');assert.equal(wheelRoom.readyDeadline,wheelRoom.landAt+11000);assert.equal(wheelRoom.insights,null);
 const before=await req(wheelPath,3);assert.equal(before.wheelSlot,null,'no future category leaked');
 clock=wheelRoom.landAt;wheelRoom=await req(wheelPath,3);assert.equal(wheelRoom.phase,'results');assert(wheelRoom.insights);assert.equal(wheelRoom.players[0].score,(round+1)*120);
 await req(wheelPath+'/ready',3,{gameId:wheelRoom.gameId,step:wheelRoom.step,ready:true},409);
 clock=wheelRoom.readyDeadline;wheelRoom=await req(wheelPath,3);assert.equal(wheelRoom.phase,round===6?'finished':'standings');assert.equal(wheelRoom.readyDeadline,null);
 if(round<6){clock=wheelRoom.standingsEndAt;wheelRoom=await req(wheelPath,3);}
}
assert.equal(wheelRoom.phase,'finished');assert.equal(wheelRoom.lastFinal.history.length,7);assert.equal(wheelRoom.lastFinal.players[0].score,840);clock+=999999;assert.equal((await req(wheelPath,3)).phase,'finished');
// Ready is optional but shared; every player must be ready to shorten the result pause.
let gated=await req('',0,{name:'Host',avatar:'🦊',roulette:true,questionCount:1,seconds:23,readySeconds:37,readyEnabled:true,country:'canada',operation:'7'.repeat(32)});await req('/'+gated.id+'/join',1,{name:'Guest',avatar:'🐼'});gated=await req('/'+gated.id+'/start',0,{});clock=gated.introEndAt+1;gated=await req('/'+gated.id);gated=await req('/'+gated.id+'/vote',0,{gameId:gated.gameId,round:gated.round,choice:gated.mode==='nova'?'4':'B'});assert.equal(gated.deadline,clock+23000);gated=await req('/'+gated.id+'/vote',1,{gameId:gated.gameId,round:gated.round,choice:gated.mode==='nova'?'4':'B'});clock=gated.landAt+3300;gated=await req('/'+gated.id);const gateId=gated.step;gated=await req('/'+gated.id+'/ready',0,{gameId:gated.gameId,step:gateId,ready:true});assert.equal(gated.phase,'results');gated=await req('/'+gated.id+'/ready',1,{gameId:gated.gameId,step:gateId,ready:true});assert.equal(gated.phase,'finished');await req('/'+gated.id+'/ready',0,{gameId:gated.gameId,step:gateId,ready:true},409);
console.log('PASS 7-question roulette, 75/10/5/10 boundaries, synchronized wheel/reconnect, answer+timer simultaneous, auto-only, shared ready, arbitrary seconds, final persistence.');
// Energy components displayed as Calories must convert kJ rather than relabel the number.
sqlite.exec('DELETE FROM off_cache');const caloric={...fixture[0],nutriscore:{'2023':{grade:'c',data:{components:{negative:[{id:'energy',value:418.4,unit:'kJ',points:2}],positive:[]}}}}};globalThis.fetch=async(url,opts)=>opts?.method==='HEAD'?new Response(null,{headers:{'Content-Type':'image/jpeg'}}):Response.json({products:[caloric],hits:[caloric]});let cal=await req('',3,{name:'Calories',avatar:'🦊',count:1,seconds:20,readySeconds:15,country:'canada',operation:'8'.repeat(32)});cal=await req('/'+cal.id+'/start',3,{});cal=await req('/'+cal.id+'/ready',3,{gameId:cal.gameId,step:cal.step,ready:true});cal=await req('/'+cal.id+'/vote',3,{gameId:cal.gameId,round:cal.round,choice:'C'});clock=cal.landAt+1;cal=await req('/'+cal.id,3);assert.equal(cal.insights.points[0].label,'Calories');assert(cal.insights.points[0].text.startsWith('100 kcal'));console.log('PASS 418.4 kJ displayed as 100 kcal, without altering score points.');
// New games use hundreds, with evidence filtered to the revealed grade.
for(const [i,grade] of ['a','d','e'].entries()){
 sqlite.exec('DELETE FROM off_cache');const product={...fixture[0],nutriscore_grade:grade,nutriscore:{'2023':{...fixture[0].nutriscore['2023'],grade}}};
 globalThis.fetch=async(url,opts)=>opts?.method==='HEAD'?new Response(null,{headers:{'Content-Type':'image/jpeg'}}):Response.json({products:[product],hits:[product]});
 let r=await req('',0,{name:'Exact',avatar:'🦊',count:1,seconds:20,readySeconds:15,country:'canada',operation:String(i+1).repeat(32)});const path='/'+r.id;
 await req(path+'/join',1,{name:'Proche',avatar:'🐼'});await req(path+'/join',2,{name:'Deux crans',avatar:'🐸'});r=await req(path+'/start',0,{});
 for(let j=0;j<3;j++)r=await req(path+'/ready',j,{gameId:r.gameId,step:r.step,ready:true});
 const target='ABCDE'.indexOf(grade.toUpperCase()),direction=target<2?1:-1;
 for(let j=0;j<3;j++)r=await req(path+'/vote',j,{gameId:r.gameId,round:r.round,choice:'ABCDE'[target+j*direction]});
 clock=r.landAt+1;r=await req(path);assert.deepEqual(r.players.map(p=>p.award),[120,60,25]);assert.equal(r.players[1].stats.near,1);
 assert(r.insights.points.length);assert(r.insights.points.every(p=>p.tone!==(grade==='a'?'warm':'good')));
}
console.log('PASS 120/60/25 awards (including speed), near-answer stats, A excludes negative and D/E exclude positive stickers.');

// Production start returns before OFF, and waitUntil owns work after the browser leaves.
sqlite.exec('DELETE FROM off_cache');
let releaseSearch;const searchGate=new Promise(resolve=>releaseSearch=resolve);
globalThis.fetch=async(url,opts)=>{if(opts?.method==='HEAD')return new Response(null,{headers:{'Content-Type':'image/jpeg'}});await searchGate;return Response.json({products:fixture,hits:fixture});};
let background=await req('',0,{name:'Background',avatar:'🐧',roulette:true,questionCount:7,seconds:20,readySeconds:15,country:'canada',operation:'ab'.repeat(16)});
const tasks=[];
const response=await worker.fetch(new Request('https://nutri.test/api/rooms/'+background.id+'/start',{method:'POST',headers:{Authorization:'Bearer '+tokens[0],'Content-Type':'application/json'},body:'{}'}),{DB},{waitUntil(task){tasks.push(task);}});
assert.equal(response.status,202);assert.equal((await response.json()).phase,'loading');assert.equal(tasks.length,1);
assert.equal((await req('/'+background.id)).phase,'loading');
await req('/'+background.id+'/start',0,{},409);
releaseSearch();await Promise.all(tasks);
background=await req('/'+background.id);assert.equal(background.phase,'wheel');assert.equal(background.total,7);
console.log('PASS start acknowledged immediately, detached loading survives client departure, duplicate start rejected, polling recovers complete game.');

// Even a terminated worker cannot leave a durable loading lock forever.
const stranded=JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE id=?').get(background.id).state);
stranded.phase='loading';stranded.loadingAt=clock-35001;stranded.loadingJob='interrupted';
sqlite.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(stranded),background.id);
const recovered=await req('/'+background.id);assert.equal(recovered.phase,'lobby');assert.match(recovered.error,/interrompu/);assert.equal(recovered.players[0].name,'Background');
assert.equal(JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE id=?').get(background.id).state).phase,'lobby');
console.log('PASS abandoned loading lease expires, recovery is persisted and players remain in their room.');

// A hung upstream has a hard budget and releases the room, including in waitUntil.
sqlite.exec('DELETE FROM off_cache');
let expire;const originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;
globalThis.setTimeout=(fn,ms,...args)=>ms===24000?(expire=fn,123456789):originalSetTimeout(fn,ms,...args);
globalThis.clearTimeout=id=>id===123456789?undefined:originalClearTimeout(id);
globalThis.fetch=async(url,opts)=>new Promise((_,reject)=>{opts.signal.addEventListener('abort',()=>reject(opts.signal.reason),{once:true});if(opts.signal.aborted)reject(opts.signal.reason);});
const timeoutTasks=[];
const pending=await worker.fetch(new Request('https://nutri.test/api/rooms/'+background.id+'/start',{method:'POST',headers:{Authorization:'Bearer '+tokens[0],'Content-Type':'application/json'},body:'{}'}),{DB},{waitUntil(task){timeoutTasks.push(task);}});
assert.equal(pending.status,202);
while(!expire)await Promise.resolve();expire();await Promise.all(timeoutTasks);
globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;
const timedOut=await req('/'+background.id);assert.equal(timedOut.phase,'lobby');assert.match(timedOut.error,/trop de temps/);
console.log('PASS upstream timeout aborts work and makes start available again without losing the room.');
// v1.3: two-product comparison, private seat recovery and host removal.
sqlite.exec('DELETE FROM off_cache');
const compareFixtures=fixture.slice(0,12).map((p,i)=>({...p,quantity:'250 g',nutriments:{...p.nutriments,salt_100g:i+1,salt_serving:i+2,sodium_100g:i/2,sugars_100g:i+2,fat_100g:i+3,fiber_100g:i+4,proteins_100g:i+5}}));
globalThis.fetch=async(url,opts)=>opts?.method==='HEAD'?new Response(null,{headers:{'Content-Type':'image/jpeg'}}):Response.json({products:compareFixtures,hits:compareFixtures});
let duel=await req('',0,{name:'Duel host',avatar:'🦊',roulette:true,questionCount:1,seconds:19,country:'canada',operation:'ac'.repeat(16)});const dp='/'+duel.id;
assert.equal(duel.readySeconds,10);assert.match(duel.recoveryCode,/^[a-f0-9]{16}$/);const hostCode=duel.recoveryCode;
let guest=await req(dp+'/join',1,{name:'Duel guest',avatar:'🐼'});const guestCode=guest.recoveryCode,guestId=guest.me;
await req(dp+'/join',2,{name:'Absent',avatar:'🐸'});
assert(!JSON.stringify((await req(dp,3)).players).includes(hostCode));assert.equal((await req(dp,3)).recoveryCode,null);
remainingSlots=[90];crypto.getRandomValues=arr=>{if(remainingSlots.length){arr[0]=remainingSlots.shift();return arr;}return originalRandom(arr);};
duel=await req(dp+'/start',0,{});crypto.getRandomValues=originalRandom;
assert.equal(duel.mode,'compare');assert.equal(duel.rouletteVersion,3);clock=duel.introEndAt+1;duel=await req(dp);
assert.equal(duel.phase,'vote');assert.equal(duel.comparison.products.length,2);assert.equal(duel.comparison.values,null);assert.equal(duel.product,null);assert.notEqual(duel.comparison.products[0].code,duel.comparison.products[1].code);
const metric=duel.comparison.metric;assert(duel.comparison.products.every(p=>!Object.keys(p.nutriments).some(k=>k===metric||k.startsWith(metric+'_'))),'target removed from API');assert(duel.comparison.products.every(p=>p.nutriscore_grade==='c'),'other scores remain available');
const state=()=>JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE id=?').get(duel.id).state);const question=state().deck[0],correct=question.products[0].nutriments[metric+'_100g']>question.products[1].nutriments[metric+'_100g']?'A':'B',wrong=correct==='A'?'B':'A';
duel=await req(dp+'/vote',0,{gameId:duel.gameId,round:1,choice:wrong});const firstDeadline=duel.deadline;
duel=await req(dp+'/vote',0,{gameId:duel.gameId,round:1,choice:correct});assert.equal(duel.deadline,firstDeadline);
await req(dp+'/vote',1,{gameId:duel.gameId,round:1,choice:wrong});
await req(dp+'/remove',1,{playerId:duel.me},403);await req(dp+'/remove',0,{playerId:duel.me},409);
const absent=duel.players.find(p=>p.name==='Absent');duel=await req(dp+'/remove',0,{playerId:absent.id});assert.equal(duel.phase,'reveal','removal unblocks all-voted');assert.equal(duel.revealTarget,correct);assert.equal(duel.comparison.values,null,'hidden during shuffle');
await req(dp+'/recover',3,{code:'0'.repeat(16)},403);
const restored=await req(dp+'/recover',3,{code:guestCode});assert.equal(restored.me,guestId);assert.equal(restored.players.length,2);assert.notEqual(restored.recoveryCode,guestCode);assert.equal((await req(dp,1)).me,null,'old browser loses ownership');assert.equal(restored.players.find(p=>p.id===guestId).vote,wrong);await req(dp+'/recover',1,{code:guestCode},403);
clock=duel.landAt+3300;duel=await req(dp);assert.deepEqual(duel.players.map(p=>p.award),[120,0]);assert.equal(duel.players[1].stats.near,0);assert.equal(duel.players[1].stats.worst,null);assert(duel.comparison.values.every(Number.isFinite));
duel=await req(dp+'/ready',0,{gameId:duel.gameId,step:duel.step});assert.equal(duel.phase,'results');duel=await req(dp+'/remove',0,{playerId:guestId});assert.equal(duel.phase,'finished','removal unblocks readiness');await req(dp+'/recover',1,{code:restored.recoveryCode},403);
assert.equal(duel.lastFinal.players[0].score,120);assert.equal(duel.lastFinal.history[0].insights.points.length,2);
console.log('PASS comparison masking, editable votes, 120/0 points (including speed), recover across browsers, private rotated codes, host-only removal, vote/ready unblock.');
// Equal values and mismatched nutrition bases are never paired.
for(const invalid of ['equal','basis']){sqlite.exec('DELETE FROM off_cache');const two=compareFixtures.slice(0,2).map((p,i)=>({...p,quantity:invalid==='basis'&&i?'250 ml':'250 g',nutriments:Object.fromEntries(['salt','sugars','fat','fiber','proteins'].map(k=>[k+'_100g',invalid==='equal'?3:i+2]))}));globalThis.fetch=async(url,opts)=>opts?.method==='HEAD'?new Response(null,{headers:{'Content-Type':'image/jpeg'}}):Response.json({products:two,hits:two});let r=await req('',0,{name:'Invalid',avatar:'🦊',roulette:true,questionCount:1,seconds:20,country:'canada',operation:(invalid==='equal'?'ad':'ae').repeat(16)});remainingSlots=[90];crypto.getRandomValues=arr=>{if(remainingSlots.length){arr[0]=remainingSlots.shift();return arr;}return originalRandom(arr);};await req('/'+r.id+'/start',0,{},503);crypto.getRandomValues=originalRandom;assert.equal((await req('/'+r.id)).phase,'lobby');}
console.log('PASS comparison excludes ties and mixed g/ml bases.');
// v1.4: connected weights are enforced server-side and speed uses the last changed answer.
sqlite.exec('DELETE FROM off_cache');globalThis.fetch=async(url,opts)=>opts?.method==='HEAD'?new Response(null,{headers:{'Content-Type':'image/jpeg'}}):Response.json({products:fixture,hits:fixture});
const onlyNutri={nutri:100,eco:0,nova:0,compare:0};
let fast=await req('',0,{name:'Départ',avatar:'🦊',roulette:true,questionCount:1,seconds:20,country:'canada',categoryWeights:onlyNutri,operation:'af'.repeat(16)});const fp='/'+fast.id;
await req(fp+'/join',1,{name:'Deuxième',avatar:'🐼'});await req(fp+'/join',2,{name:'Troisième',avatar:'🐸'});
await req(fp+'/settings',1,{roulette:true,questionCount:1,seconds:20,categoryWeights:onlyNutri},403);
for(const weights of [{nutri:99,eco:0,nova:0,compare:0},{nutri:100,eco:-1,nova:1,compare:0},{nutri:99.5,eco:.5,nova:0,compare:0},{nutri:100}])await req(fp+'/settings',0,{roulette:true,questionCount:1,seconds:20,categoryWeights:weights},400);
fast=await req(fp+'/start',0,{});assert.equal(fast.mode,'nutri');assert.deepEqual(fast.wheelWeights,onlyNutri);assert.equal(fast.scoreVersion,2);
clock=fast.introEndAt+1;fast=await req(fp);const initialTime=clock;
fast=await req(fp+'/vote',0,{gameId:fast.gameId,round:1,choice:'A',voteAt:0});assert.equal(fast.voteStartedAt,initialTime);assert.equal(fast.voteStarter.name,'Départ');const deadline=fast.deadline;
clock+=5000;fast=await req(fp+'/vote',0,{gameId:fast.gameId,round:1,choice:'A'});let fsaved=JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE id=?').get(fast.id).state);assert.equal(fsaved.players[0].voteAt,initialTime,'duplicate same choice is idempotent');
clock+=5000;fast=await req(fp+'/vote',0,{gameId:fast.gameId,round:1,choice:'C'});assert.equal(fast.deadline,deadline);assert.equal(fast.players[0].speedBonus,0,'bonus hidden before landing');
clock+=5000;fast=await req(fp+'/vote',1,{gameId:fast.gameId,round:1,choice:'C'});clock+=4000;fast=await req(fp+'/vote',2,{gameId:fast.gameId,round:1,choice:'B'});assert.equal(fast.phase,'reveal');assert.equal(fast.voteStarter.name,'Départ','trigger preserved through lock');
clock=fast.landAt+1;fast=await req(fp);assert.deepEqual(fast.players.map(p=>p.speedBonus),[10,5,0]);assert.deepEqual(fast.players.map(p=>p.baseAward),[100,100,60]);assert.deepEqual(fast.players.map(p=>p.award),[110,105,60]);
const scored=fast.players.map(p=>p.score);for(let i=0;i<3;i++)assert.deepEqual((await req(fp)).players.map(p=>p.score),scored);
let ecoOnly=await req('',0,{name:'Éco',avatar:'🦊',roulette:true,questionCount:2,seconds:20,country:'canada',categoryWeights:{nutri:0,eco:100,nova:0,compare:0},operation:'ba'.repeat(16)});ecoOnly=await req('/'+ecoOnly.id+'/start',0,{});const ecoState=JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE id=?').get(ecoOnly.id).state);assert.deepEqual(ecoState.schedule,['eco','eco']);
console.log('PASS custom 100/0 weights, invalid totals rejected, host-only settings, first voter identity, latest changed vote timestamp, speed 10/5/0, no double awards.');
