/* Full product names, balanced over at most two lines, at the largest fitting size. */
window.fitCardTitle = function(el, max) {
  if (!el || !el.clientWidth) return;
  const text = el.dataset.fullTitle || el.textContent.trim();
  el.dataset.fullTitle = text;
  const style = getComputedStyle(el);
  const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (width <= 0) return;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const words = text.split(/\s+/);
  const spacing = parseFloat(style.letterSpacing) / parseFloat(style.fontSize) || 0;
  let best = [text], bestSize = 0;
  const candidates = [[text]];
  for (let i=1; i<words.length; i++) candidates.push([words.slice(0,i).join(' '),words.slice(i).join(' ')]);
  for (const lines of candidates) {
    let lo = 1, hi = max;
    for (let j=0;j<16;j++) {
      const size=(lo+hi)/2;
      ctx.font=`${style.fontWeight} ${size}px ${style.fontFamily}`;
      const fits=lines.every(line=>ctx.measureText(line).width + Math.max(0,line.length-1)*spacing*size <= width-.5);
      if(fits)lo=size;else hi=size;
    }
    if(lo>bestSize+.05){bestSize=lo;best=lines;}
    if(lines.length===1&&lo>=max-.05)break;
  }
  el.replaceChildren();
  best.forEach((line,i)=>{if(i)el.append(document.createElement('br'));el.append(document.createTextNode(line));});
  el.style.fontSize=(Math.floor(bestSize*10)/10)+'px';
  el.style.whiteSpace='nowrap';
  el.dataset.fitted='true';
};
