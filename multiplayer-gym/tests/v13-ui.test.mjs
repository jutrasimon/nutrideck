import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('public/multiplayer.js','utf8');
const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const strip={innerHTML:''};
const players=Array.from({length:8},(_,i)=>({id:String(i),name:'Joueur '+i,avatar:'🐸',score:i*100,award:i?100:0,ready:i%2===0,voted:true,stats:{exact:2,answered:7,bestStreak:2}}));
const context={room:{phase:'results',me:'0',landed:true,players,gameId:'test',lastFinal:{gameId:'test',history:Array(7).fill({}),players}},document:{querySelectorAll:()=>[strip]},fmt:String,esc:String};
vm.createContext(context);vm.runInContext(extract('function playerStrip()','function gameShell()')+extract('function trophyData(','function trophies('),context);
context.playerStrip();assert.equal((strip.innerHTML.match(/class="strip-avatar"/g)||[]).length,8);assert(strip.innerHTML.indexOf('Joueur 7')<strip.innerHTML.indexOf('Joueur 0'));assert(strip.innerHTML.includes('strip-crown'));assert(strip.innerHTML.includes('+100'));assert(!strip.innerHTML.includes('4/7'));assert.equal(context.trophyData(players).length,0,'8-way trophies hidden');
players[0].stats.bestStreak=5;players[1].stats.bestStreak=5;const awards=context.trophyData(players);assert(awards.some(x=>x.title==='Ça chauffe !'&&x.names.length===2));assert(awards.every(x=>x.names.length<=2));
assert(source.includes('data-inspect'));assert(source.includes('inspection-vote'));assert(source.includes('inspection-flip'));
console.log('PASS 8-player strip ordered by points, latest awards, crown and trophies limited to 2 recipients.');
const server=readFileSync('worker/index.js','utf8').replace('export default','const worker =');const env={crypto,Response,TextEncoder};vm.createContext(env);vm.runInContext(server+';globalThis.mask=compareProduct;',env);
for(const metric of ['salt','sugars','fat','fiber','proteins']){const n={[metric+'_100g']:5,[metric+'_serving']:2,[metric+'_value']:5,sodium_100g:2,'saturated-fat_100g':3,energy_100g:200};const masked=env.mask({code:'1234',nutriments:n,nutriscore_grade:'a'},metric,false);assert(!Object.keys(masked.nutriments).some(k=>k.startsWith(metric+'_')));assert.equal(masked.nutriments.energy_100g,200);if(metric==='salt')assert(!('sodium_100g' in masked.nutriments));if(metric==='fat')assert(!('saturated-fat_100g' in masked.nutriments));assert.equal(env.mask({nutriments:n},metric,true).nutriments[metric+'_100g'],5);}
console.log('PASS all five comparison metrics redact variants and derived aliases until reveal.');
