/* Shared client rules: integer sliders always preserve a total of 100. */
(()=>{
const keys=['nutri','eco','nova','compare'],defaults={nutri:75,eco:10,nova:5,compare:10};
function rebalance(weights,key,value){if(!keys.includes(key))return {...weights};value=Math.max(0,Math.min(100,Math.round(Number(value)||0)));const others=keys.filter(k=>k!==key),total=others.reduce((n,k)=>n+weights[k],0),remaining=100-value,out={[key]:value},parts=others.map((k,i)=>{const exact=total?remaining*weights[k]/total:remaining/others.length;return{k,i,base:Math.floor(exact),fraction:exact%1};});let spare=remaining-parts.reduce((n,p)=>n+p.base,0);parts.sort((a,b)=>b.fraction-a.fraction||a.i-b.i).forEach(p=>out[p.k]=p.base+(spare-->0?1:0));return Object.fromEntries(keys.map(k=>[k,out[k]]));}
function slotMode(slot,w=defaults){let end=0;for(const key of keys){end+=w[key];if(slot<end)return key;}return keys.at(-1);}
function urgency(seconds,total){const left=Math.max(0,seconds),ratio=Math.max(0,Math.min(1,left/total)),level=left<=3?3:left<=5?2:left<=10?1:0;return{ratio,level,interval:[1600,1100,650,350][level],pulse:[15,25,40,65][level]};}
globalThis.NutriRules={keys,defaults,rebalance,slotMode,urgency};
})();
