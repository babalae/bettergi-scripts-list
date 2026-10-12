// Shared recognition adapter. Combat input and deck policies remain unchanged.
(function(root){
  "use strict";
  const C=root.TCGCollapsedHand;
  function peak(search,template,cv){
    let input=null,response=null,columns=null,maximum=null;
    try{
      input=cv.InputArray.Create(template);
      response=search.MatchTemplate(input,cv.TemplateMatchModes.CCoeffNormed,null);
      columns=response.Reduce(cv.ReduceDimension.Row,cv.ReduceTypes.Max,-1);
      maximum=columns.Reduce(cv.ReduceDimension.Column,cv.ReduceTypes.Max,-1);
      const value=Number(maximum.Mean(null).Val0);
      if(!Number.isFinite(value)||value < -1.0001||value > 1.0001)throw Error("无效的牌面相关分数");
      return value;
    }finally{
      for(const mat of new Set([maximum,columns,response]))if(mat)mat.dispose();
      if(input)input.Dispose();
    }
  }
  function score(host,env,f,x,y,w,h,filename,pad){
    if(!host.templates.has(filename)){
      const mat=env.file.readImageMatSync(filename);
      if(mat.empty()){mat.dispose();throw Error("缺少牌面模板："+filename);}
      host.templates.set(filename,mat);
    }
    let crop=null;
    try{
      const src=f.srcMat??f.SrcMat;
      crop=src.SubMat(y-pad,Math.min(1080,y+h+pad),x-pad,x+w+pad);
      return peak(crop,host.templates.get(filename),env.OpenCvSharp.OpenCvSharp);
    }finally{if(crop)crop.dispose();}
  }
  function checkedBank(T,bank){
    if(!bank||bank.scoreFloor!==.95||bank.runnerUpGap!==.20||!Array.isArray(bank.entries))
      throw Error("手牌识别库格式不正确");
    for(const entry of bank.entries)
      if(!entry.name||!T.byId[entry.id]||T.norm(entry.name)!==T.norm(T.byId[entry.id].name))
        throw Error("手牌识别库与牌组身份不匹配："+entry.id);
    return bank;
  }
  function classes(env,bank,openingBank=null){
    const T=env.TCG;
    checkedBank(T,bank);
    if(openingBank)checkedBank(T,openingBank);
    class Host extends env.TCGBetterGI.BetterGIHost{
      nativeHandCountIn(f){
        return this.memoFrame(f,"collapsed/native-count",()=>super.handCountIn(f));
      }
      handCountIn(f){
        const native=this.nativeHandCountIn(f);
        if(native!==null||this.handFanReady||this.handNeedsReset||!Array.isArray(this.handCache))return native;
        const phase=this.phaseIn(f);
        if(phase.phase!=="board"||phase.turn!=="user")return null;
        const row=this.collapsedLayoutIn(f);
        if(row.status!=="readable"||row.count<this.handCache.length)return null;
        this.lastHandCountSource="full-folded-layout";
        return row.count;
      }
      collapsedLayoutIn(f){
        return this.memoFrame(f,"collapsed/layout",()=>C.locate(
          Number(f.width??f.Width),Number(f.height??f.Height),
          [...this.matches(f,"hand_cost_neutral",C.ROI,.9,false),...this.matches(f,"hand_cost_element",C.ROI,.9,false)]));
      }
      collapsedIn(f){
        return this.memoFrame(f,"collapsed/identities",()=>C.identify(this.collapsedLayoutIn(f),bank,(slot,p,filename)=>{
          const [dx,dy,w,h]=p;
          return score(this,env,f,slot.marker.x+dx,slot.marker.y+dy,w,h,filename,2);
        }));
      }
      async folded(mode){
        if(this.handFanReady||this.handNeedsReset)return null;
        const started=Date.now(),revision=this.inputRevision;
        const sample=()=>this.frame(f=>{
          const phase=this.phaseIn(f);
          if(phase.result||this.inputRevision!==revision||(mode==="pick"
            ?phase.phase!=="pick":phase.phase!=="board"||phase.turn!=="user"))return null;
          try{return {read:this.collapsedIn(f),nativeCount:mode==="board"?this.nativeHandCountIn(f):5};}
          catch(error){
            if(error.code==="TCG_HAND_RETRY")throw error;
            this.trace("hand-art-unavailable",{reason:String(error.message||error)});
            return null;
          }
        });
        let read=null;
        try{
          const a=sample();if(a?.read.status!=="readable")return null;
          await env.sleep(120);
          const b=sample();if(b?.read.status!=="readable")return null;
          read=C.stable(a.read,b.read);
          if(!read)return null;
          // Marker count is not independent count evidence. Both native frames
          // must agree before a completely folded observation may be published.
          read.nativeCount=a.nativeCount!==null&&a.nativeCount===b.nativeCount?b.nativeCount:null;
          read.countConflict=[a.nativeCount,b.nativeCount].some(n=>n!==null&&n!==read.count);
          return read;
        }finally{
          try{this.trace("folded-hand",{mode,count:read?.count??null,nativeCount:read?.nativeCount??null,
            reason:!read?"unavailable":read.countConflict?"count-conflict":read.slots.every(s=>s.id)?"full":"partial",
            ids:read?.slots.map(s=>s.id)??[],
            rejected:read?.slots.filter(s=>!s.id).map(s=>({index:s.index,candidate:s.candidate??null,
              score:Number.isFinite(s.score)?Number(s.score.toFixed(4)):null,
              gap:Number.isFinite(s.gap)?Number(s.gap.toFixed(4)):null,view:s.view??null}))??[],
            elapsedMs:Date.now()-started,inputs:0});}catch{}
        }
      }
      async readHand(expected=this.handCountHint,evidence=null){
        const started=Date.now();let route="stable-fallback",titleSlots=0,hand=null;
        try{
          const read=await this.folded("board");
          const cards=read?.slots.map(s=>s.id&&T.byId[s.id]?T.observedCard(T.byId[s.id].name,s.index):null);
          if(!read||read.countConflict||!cards.some(Boolean)||(evidence&&evidence.count!==read.count))
            return hand=await super.readHand(expected,evidence);
          // Hints/cache are vetoes, never measurements. Unknown native count
          // uses the existing single expansion; known identity slots stay useful.
          const constraints=[expected,this.handCountHint,this.handCache?.length].filter(Number.isInteger);
          if(read.nativeCount===null&&constraints.some(n=>n!==read.count))
            return hand=await super.readHand(expected,evidence);
          let count=evidence?evidence.count:read.nativeCount;
          if(count===null){
            this.requireHandObservation(this.phase(),"before-local-hand-count");
            count=await this.handCount(expected);
          }
          if(count!==read.count)return hand=await super.readHand(null,{count});
          this.handScanSerial++;
          if(cards.every(Boolean)){
            route=this.handFanReady?"folded-identities-native-count":"folded-full";
          }else{
            route="local-title-fallback";
            this.requireHandObservation(this.phase(),"before-local-hand-fallback");
            if(!this.handFanReady)await this.expand();
            const points=this.handPoints(count);
            for(let i=0;i<count;i++)if(!cards[i]){
              titleSlots++;
              const raw=await this.titleAt(points[i],945,false,false,"card",null,true);
              cards[i]=T.observedCard(raw,i);
              if(!cards[i]){
                const error=Error("第 "+(i+1)+" 张手牌卡名无法可靠读取："+(raw||"OCR为空"));
                error.code="TCG_HAND_RETRY";throw error;
              }
            }
          }
          if(this.handFanReady||this.handNeedsReset){
            this.requireHandObservation(this.phase(),"before-hand-reset");
            await this.reset();
          }
          this.handCountHint=null;return hand=cards;
        }finally{
          try{this.trace("hand-read-completed",{route,count:hand?.length??null,
            ...(route!=="stable-fallback"?{titleSlots}:{}),elapsedMs:Date.now()-started});}catch{}
        }
      }
      async opening(){
        if(!openingBank||T.openingSetting(this.options.mulligan)==="全部保留")return super.opening();
        const ids=await env.TCGOpeningHand.read(this,openingBank,env,score,peak);
        if(!ids||!ids.some(id=>id&&T.byId[id]))return super.opening();
        this.trace("opening-art",{ids,known:ids.filter(id=>id&&T.byId[id]).length,inputs:0});
        return env.TCGOpeningHand.opening(this,T,env.sleep,ids);
      }
    }
    class Player extends env.TCGPlayer.Player{
      async pick(){
        if(!this.openingFlow.complete&&!this.openingFlow.picked&&this.actions===0){
          const read=await this.host.folded("pick"),slots=read?.count===5?read.slots:[];
          const complete=!read?.countConflict&&slots.length===5&&slots.every(s=>s.id&&T.byId[s.id]);
          if(complete)this.memory.openingIds=slots.map(s=>s.id);
          this.memory.openingObservation={source:complete?"folded-post-mulligan":"stable-kept-cards",count:read?.count??null,complete};
          this.host.trace("folded-opening",{...this.memory.openingObservation,ids:this.memory.openingIds||[],inputs:0});
        }
        return super.pick();
      }
    }
    return {Host,Player};
  }
  root.TCGHandRecognition={classes,peak,checkedBank};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.TCGHandRecognition;
})(globalThis);
