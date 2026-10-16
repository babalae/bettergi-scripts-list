// Shared direct opening reader. Deck policies and input proofs are reused.
(function(root){
  "use strict";
  const xs=[383,665,960,1248,1535];
  // Click targets are not art centres. Slot 1 was six pixels left of its art.
  const artXs=[383,671,960,1248,1535];
  function rank(bank,score){
    return artXs.map((x,index)=>{
      const ranks=bank.entries.map(entry=>{
        const views=entry.views??[{patches:entry.patches}];
        return views.map(view=>{
          const scores=bank.patches.map((patch,k)=>score(x,patch,view.patches[k]));
          return {id:entry.id,view:view.name??"original",scores,
            value:scores.every(Number.isFinite)?Math.min(...scores):-1};
        }).sort((a,b)=>b.value-a.value)[0];
      }).sort((a,b)=>b.value-a.value);
      const best=ranks[0],gap=ranks.length>1?best.value-ranks[1].value:0;
      const winners=bank.patches.map((_,k)=>ranks.filter(r=>Number.isFinite(r.scores[k]))
        .sort((a,b)=>b.scores[k]-a.scores[k])[0]?.id);
      const floor=bank.entries.find(entry=>entry.id===best?.id)?.scoreFloor??bank.scoreFloor;
      const id=best&&winners.every(id=>id===best.id)&&best.value>=floor&&gap>=bank.runnerUpGap?best.id:null;
      return {index,id,score:best?.value??-1,gap,view:best?.view??null};
    });
  }
  async function read(host,bank,env,score){
    if(!bank)return null;
    const clean=f=>Number(f.width??f.Width)===1920&&Number(f.height??f.Height)===1080&&
      host.phaseIn(f).phase==="opening"&&!env.TCG.norm(host.ocr(f,[58,112,339,53]))&&
      xs.every(x=>!env.TCG.norm(host.ocr(f,[x-100,730,200,60])));
    const sample=()=>host.frame(f=>{
      if(!clean(f))return null;
      return rank(bank,(x,p,file)=>score(host,env,f,x+p[0],p[1],p[2],p[3],file,3));
    });
    const sampledAt=Date.now(),first=sample();if(!first)return null;
    if(first.every(slot=>slot.id))return first.map(slot=>slot.id);
    const remaining=120-(Date.now()-sampledAt);
    if(remaining>0)await env.sleep(remaining);
    const second=sample();return second?second.map(slot=>slot.id):null;
  }
  async function opening(host,T,sleep,ids){
    const original=await host.openingSelections(xs);
    let selected=original.slice(),pendingInspection=null;
    const cards=ids.map((id,index)=>id&&T.byId[id]?T.observedCard(T.byId[id].name,index):null);
    const recordInput=(index,purpose,actual)=>{
      const verified=!!actual&&actual.every((v,i)=>v===(i===index?!selected[i]:selected[i]));
      host.trace("opening-card-input",{index,purpose,before:selected[index],after:actual?.[index]??null,verified});
      return verified;
    };
    const verify=async(index,purpose)=>{
      let actual;
      try{actual=await host.openingSelections(xs);}
      catch(error){recordInput(index,purpose,null);pendingInspection=null;throw error;}
      const verified=recordInput(index,purpose,actual);pendingInspection=null;
      if(!verified)
        throw Error("起手置换标记未证实，不重复点击第"+(index+1)+"张牌");
      selected=actual;
    };
    const toggle=async(index,purpose)=>{
      if(host.phase().phase!=="opening")throw Error("起手置换前页面已改变");
      host.clickAt(xs[index]+70,540);await sleep(350);await verify(index,purpose);
    };
    try{
      for(let i=0;i<cards.length;i++)if(!cards[i]){
        if(host.phase().phase!=="opening")throw Error("起手补读前页面已改变");
        pendingInspection=i;
        const raw=await host.titleAt(xs[i]+70,540,true,false);
        await verify(i,"inspect-unknown");cards[i]=T.observedCard(raw,i);
        if(!cards[i])throw Error("第"+(i+1)+"张初始牌标题未读清，不自动确认开局");
        host.trace("opening-title-method",{index:i,method:"unknown-only",selectionChanged:true});
      }
    }catch(error){
      let actual;
      try{actual=await host.openingSelections(xs);}
      catch(failure){if(pendingInspection!==null)recordInput(pendingInspection,"inspect-unknown",null);throw failure;}
      if(pendingInspection!==null)recordInput(pendingInspection,"inspect-unknown",actual);
      selected=actual;
      for(let i=0;i<5;i++)if(selected[i]!==original[i])await toggle(i,"rollback");
      throw error;
    }
    const context=T.openingContext({}),plan=T.openingPlan(cards,original,context);
    host.openingCards=plan.keep;
    host.trace("opening",cards);
    host.trace("opening-plan",{cards,keep:plan.keep.map(c=>c.id),
      replace:cards.filter(c=>plan.replace[c.index]).map(c=>c.id),
      replaceIndices:plan.replace.flatMap((v,i)=>v?[i]:[]),duplicateWeaponIndices:plan.duplicateWeapons,context});
    // Restore kept inspection marks before starting final replacements.
    // Each mismatch still receives exactly one proven single-bit toggle.
    for(let i=0;i<5;i++)if(selected[i]&&!plan.replace[i])await toggle(i,"reconcile");
    for(let i=0;i<5;i++)if(!selected[i]&&plan.replace[i])await toggle(i,"reconcile");
    host.trace("opening-selection-verified",{original,selected,proof:"two-stable-native-replace-labels-per-input"});
    return host.confirmOpening({policy:"known-priority",recognition:"direct-art-unknown-title-fallback",
      selectedByScript:selected.flatMap((v,i)=>v?[i]:[])});
  }
  root.TCGOpeningHand={xs,artXs,rank,read,opening};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.TCGOpeningHand;
})(globalThis);
