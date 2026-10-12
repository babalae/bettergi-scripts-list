// Shared no-input folded-hand layout and identity reader.
(function(root) {
  "use strict";
  const ROI=[430,977,1050,42], STEP=85.3, CENTER=862.7;
  const median=xs=>{const s=xs.slice().sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
  function locateRow(matches) {
    const groups=[];
    for(const m of matches.filter(m=>Number.isFinite(m.x)&&Number.isFinite(m.y)&&m.y>=978&&m.y<=989).sort((a,b)=>a.x-b.x)){
      const last=groups[groups.length-1];
      if(last&&m.x-last[last.length-1].x<=12)last.push(m);else groups.push([m]);
    }
    // BetterGI FindMulti need not expose correlation values: use the central
    // native row, not an off-row art peak. Entire row, not an equal-spaced subset.
    const firstExpected=CENTER-(groups.length-1)*STEP/2;
    const distance=(m,i)=>Math.abs(m.x-firstExpected-i*STEP)+Math.abs(m.y-983);
    const marks=groups.map((g,i)=>g.slice().sort((a,b)=>distance(a,i)-distance(b,i)||Math.abs(a.y-983)-Math.abs(b.y-983))[0]);
    const n=marks.length;
    if(!n)return {status:"unavailable",reason:"no-visible-cost-row",count:null,slots:[]};
    if(n>10)return {status:"unknown",reason:"extra-markers",count:null,slots:[]};
    const first=median(marks.map((m,i)=>m.x-i*STEP)),yy=median(marks.map(m=>m.y));
    if(Math.abs(first+(n-1)*STEP/2-CENTER)>4||Math.abs(yy-983)>4||
      marks.some((m,i)=>Math.abs(m.x-first-i*STEP)>5||Math.abs(m.y-yy)>4))
      return {status:"unknown",reason:"incomplete-or-moved-row",count:null,slots:[]};
    return {status:"readable",reason:"whole-cost-row",count:n,slots:marks.map((m,index)=>({
      index,marker:{x:Math.round(first+index*STEP),y:Math.round(yy)},id:null,
      // Two visible interior patches; never a digit, gold border, or next slot.
      rect:[Math.round(first+index*STEP)+34,Math.round(yy)+48,46,48],
      visibleMask:[[0,0,46,22],[0,26,46,22]]
    }))};
  }
  function locate(width,height,matches) {
    if(width!==1920||height!==1080)return {status:"unavailable",reason:"capture-size",count:null,slots:[]};
    return locateRow(matches);
  }
  function identify(layout,bank,score) {
    if(layout.status!=="readable")return layout;
    return {...layout,slots:layout.slots.map(slot=>{
      // A view owns a complete pair. Never splice the best individual patches
      // of different views; runner-up is another identity, not the same card.
      const identities=new Map();
      for(const entry of bank.entries){
        for(const view of entry.views??[{name:"original",patches:entry.patches}]){
          const scores=Array.isArray(view.patches)&&view.patches.length===bank.patches.length
            ?bank.patches.map((patch,k)=>typeof view.patches[k]==="string"?score(slot,patch,view.patches[k]):NaN):[];
          const rank={id:entry.id,view:view.name??"original",scores,
            score:scores.length===bank.patches.length&&scores.length>0&&scores.every(Number.isFinite)?Math.min(...scores):-1};
          if(!identities.has(entry.id)||rank.score>identities.get(entry.id).score)identities.set(entry.id,rank);
        }
      }
      const ranks=[...identities.values()].sort((a,b)=>b.score-a.score);
      const best=ranks[0],gap=best&&ranks[1]?best.score-ranks[1].score:0;
      const id=best&&best.score>=bank.scoreFloor&&gap>=bank.runnerUpGap?best.id:null;
      return {...slot,id,score:best?.score??-1,gap,view:best?.view??null,
        candidate:best?.id??null,patchScores:best?.scores??[],
        runnerUp:ranks[1]?{id:ranks[1].id,score:ranks[1].score}:null};
    })};
  }
  function readCollapsedHand(frame,bank) {
    return identify(locate(frame.width,frame.height,frame.matches()),bank,frame.score);
  }
  function stable(a,b) {
    if(a.status!=="readable"||b.status!=="readable"||a.count!==b.count)return null;
    if(a.slots.some((s,i)=>Math.abs(s.marker.x-b.slots[i].marker.x)>2||Math.abs(s.marker.y-b.slots[i].marker.y)>2))return null;
    return {...b,slots:b.slots.map((s,i)=>({...s,id:s.id&&s.id===a.slots[i].id?s.id:null})),stableReads:2};
  }
  const api={ROI,locate,locateRow,identify,readCollapsedHand,stable};
  root.TCGCollapsedHand=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(globalThis);
