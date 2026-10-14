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
    // Interior artwork can match the edge template. Choose the complete native
    // grid, not the number of raw peaks; never accept a subset hiding outer edges.
    const candidates=[];
    for(let n=1;n<=10;n++){
      const first=CENTER-(n-1)*STEP/2;
      // The existing locator allows up to4px whole-row drift plus5px local
      // jitter. Candidate collection must not narrow that accepted envelope;
      // the median-row checks below still enforce each bound separately.
      const selected=Array.from({length:n},(_,i)=>groups.filter(g=>g.some(m=>Math.abs(m.x-first-i*STEP)<=9)));
      if(selected.some(g=>g.length!==1)||new Set(selected.map(g=>g[0])).size!==n)continue;
      if(groups.some(g=>g.every(m=>m.x<first-9||m.x>first+(n-1)*STEP+9)))continue;
      candidates.push(selected.map(g=>g[0]));
    }
    if(candidates.length!==1)return {status:groups.length?"unknown":"unavailable",reason:groups.length?"incomplete-or-moved-row":"no-visible-cost-row",count:null,slots:[]};
    const selected=candidates[0],firstExpected=CENTER-(selected.length-1)*STEP/2;
    const distance=(m,i)=>Math.abs(m.x-firstExpected-i*STEP)+Math.abs(m.y-983);
    const marks=selected.map((g,i)=>g.slice().sort((a,b)=>distance(a,i)-distance(b,i)||Math.abs(a.y-983)-Math.abs(b.y-983))[0]);
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
  function scoreFloor(entry,bank) {
    if(entry&&entry.scoreFloor!==undefined)return entry.scoreFloor;
    return bank.scoreFloor;
  }
  function identify(layout,bank,score) {
    if(layout.status!=="readable")return layout;
    const views=bank.entries.flatMap(entry=>(entry.views??[{name:"original",patches:entry.patches}]).map(view=>({
      id:entry.id,name:view.name??"original",scoreFloor:scoreFloor(entry,bank),titleCandidates:entry.titleCandidates,
      patches:Array.isArray(view.patches)&&view.patches.length===bank.patches.length
        ?Array.from(view.patches,file=>typeof file==="string"?file:null):[]
    })));
    return {...layout,slots:layout.slots.map(slot=>{
      // A view owns a complete pair. Never splice the best individual patches
      // of different views; runner-up is another identity, not the same card.
      const identities=new Map();
      for(const view of views){
          const scores=view.patches.map((file,k)=>file===null?NaN:score(slot,bank.patches[k],file));
          const rank={id:view.id,view:view.name,scores,scoreFloor:view.scoreFloor,titleCandidates:view.titleCandidates,
            score:scores.length===bank.patches.length&&scores.length>0&&scores.every(Number.isFinite)?Math.min(...scores):-1};
          if(!identities.has(view.id)||rank.score>identities.get(view.id).score)identities.set(view.id,rank);
      }
      const ranks=[...identities.values()].sort((a,b)=>b.score-a.score);
      const best=ranks[0],gap=best&&ranks[1]?best.score-ranks[1].score:0;
      const floor=scoreFloor(best,bank);
      const accepted=best&&best.score>=floor&&gap>=bank.runnerUpGap;
      const titleCandidates=accepted?best.titleCandidates:null;
      const id=accepted&&!titleCandidates?best.id:null;
      let rejectionReason=null;
      if(!id){
        if(titleCandidates)rejectionReason="variant-title";
        else if(!best)rejectionReason="no-candidate";
        else if(best.score<floor)rejectionReason="score-floor";
        else rejectionReason="runner-up-gap";
      }
      return {...slot,id,rejectionReason,score:best?.score??-1,gap,view:best?.view??null,
        ...(titleCandidates?{titleCandidates}:{}),
        candidate:best?.id??null,patchScores:best?.scores??[],
        runnerUp:ranks[1]?{id:ranks[1].id,score:ranks[1].score}:null};
    })};
  }
  function readCollapsedHand(frame,bank) {
    return identify(locate(frame.width,frame.height,frame.matches()),bank,frame.score);
  }
  const api={ROI,locate,locateRow,identify,readCollapsedHand};
  root.TCGCollapsedHand=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(globalThis);
