// Shared direct opening reader. Deck policies and input proofs are reused.
(function(root){
  "use strict";
  const xs=[383,665,960,1248,1535];
  // Click targets are not art centres. Slot 1 was six pixels left of its art.
  const artXs=[383,671,960,1248,1535];
  function rank(bank,score){
    return artXs.map((x,index)=>{
      const ranks=bank.entries.map(e=>{
        const scores=bank.patches.map((p,k)=>score(x,p,e.patches[k]));
        return {id:e.id,scores,value:scores.every(Number.isFinite)?Math.min(...scores):-1};
      }).sort((a,b)=>b.value-a.value);
      const best=ranks[0],gap=ranks.length>1?best.value-ranks[1].value:0;
      const winners=bank.patches.map((_,k)=>ranks.filter(r=>Number.isFinite(r.scores[k]))
        .sort((a,b)=>b.scores[k]-a.scores[k])[0]?.id);
      const id=best&&winners.every(id=>id===best.id)&&best.value>=bank.scoreFloor&&gap>=bank.runnerUpGap?best.id:null;
      return {index,id,score:best?.value??-1,gap};
    });
  }
  async function read(host,bank,env,score,peak){
    if(!bank)return null;
    let patches=[];
    const clean=f=>Number(f.width??f.Width)===1920&&Number(f.height??f.Height)===1080&&
      host.phaseIn(f).phase==="opening"&&!env.TCG.norm(host.ocr(f,[58,112,339,53]))&&
      xs.every(x=>!env.TCG.norm(host.ocr(f,[x-100,730,200,60])));
    const sample=first=>host.frame(f=>{
      if(!clean(f))return null;
      try{
        const ids=rank(bank,(x,p,file)=>score(host,env,f,x+p[0],p[1],p[2],p[3],file,3));
        const src=f.srcMat??f.SrcMat;
        if(first){
          // The capture backend can reuse its buffer after frame() returns.
          // Retain immutable small patches, never borrowed frame views.
          for(const x of artXs)for(const [dx,y,w,h]of bank.patches){
            let crop=null;
            try{crop=src.SubMat(y,y+h,x+dx,x+dx+w);patches.push(crop.Clone());}
            finally{if(crop)crop.dispose();}
          }
        }else{
          for(let i=0;i<artXs.length;i++)for(let k=0;k<bank.patches.length;k++){
            const [dx,y,w,h]=bank.patches[k],x=artXs[i]+dx;
            let crop=null;
            try{
              crop=src.SubMat(y-3,y+h+3,x-3,x+w+3);
              if(peak(crop,patches[i*bank.patches.length+k],env.OpenCvSharp.OpenCvSharp)<bank.stableScore)ids[i].id=null;
            }finally{if(crop)crop.dispose();}
          }
        }
        return ids;
      }catch(error){
        try{host.trace("opening-art-unavailable",{reason:String(error.message||error)});}catch{}
        return null;
      }
    });
    try{
      const a=sample(true);if(!a||!a.some(s=>s.id))return null;
      await env.sleep(120);
      const b=sample(false);if(!b)return null;
      return b.map((s,i)=>s.id&&s.id===a[i].id?s.id:null);
    }finally{for(const p of patches)p.dispose();}
  }
  async function opening(host,T,sleep,ids){
    const original=await host.openingSelections(xs);
    let selected=original.slice();
    const cards=ids.map((id,index)=>id&&T.byId[id]?T.observedCard(T.byId[id].name,index):null);
    const verify=async index=>{
      const actual=await host.openingSelections(xs);
      if(actual.some((v,i)=>v!==(i===index?!selected[i]:selected[i])))
        throw Error("起手置换标记未证实，不重复点击第"+(index+1)+"张牌");
      selected=actual;
    };
    const toggle=async index=>{
      if(host.phase().phase!=="opening")throw Error("起手置换前页面已改变");
      host.clickAt(xs[index]+70,540);await sleep(350);await verify(index);
    };
    try{
      for(let i=0;i<cards.length;i++)if(!cards[i]){
        if(host.phase().phase!=="opening")throw Error("起手补读前页面已改变");
        const raw=await host.titleAt(xs[i]+70,540,true,false);
        await verify(i);cards[i]=T.observedCard(raw,i);
        if(!cards[i])throw Error("第"+(i+1)+"张初始牌标题未读清，不自动确认开局");
        host.trace("opening-title-method",{index:i,method:"unknown-only",selectionChanged:true});
      }
    }catch(error){
      selected=await host.openingSelections(xs);
      for(let i=0;i<5;i++)if(selected[i]!==original[i])await toggle(i);
      throw error;
    }
    const context=T.openingContext({}),plan=T.openingPlan(cards,original,context);
    host.openingCards=plan.keep;
    host.trace("opening",cards);
    host.trace("opening-plan",{cards,keep:plan.keep.map(c=>c.id),
      replace:cards.filter(c=>plan.replace[c.index]).map(c=>c.id),
      replaceIndices:plan.replace.flatMap((v,i)=>v?[i]:[]),duplicateWeaponIndices:plan.duplicateWeapons,context});
    for(let i=0;i<5;i++)if(selected[i]!==plan.replace[i])await toggle(i);
    host.trace("opening-selection-verified",{original,selected,proof:"two-stable-native-replace-labels-per-input"});
    return host.confirmOpening({policy:"known-priority",recognition:"direct-art-unknown-title-fallback",
      selectedByScript:selected.flatMap((v,i)=>v?[i]:[])});
  }
  root.TCGOpeningHand={xs,artXs,rank,read,opening};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.TCGOpeningHand;
})(globalThis);
