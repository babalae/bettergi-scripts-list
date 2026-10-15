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
    for(const entry of bank.entries){
      if(!entry.name||!T.byId[entry.id]||T.norm(entry.name)!==T.norm(T.byId[entry.id].name))
        throw Error("手牌识别库与牌组身份不匹配："+entry.id);
      checkedThreshold(entry,"scoreFloor");
      checkedThreshold(entry,"stableScore");
      if(entry.titleCandidates!==undefined&&(!Array.isArray(entry.titleCandidates)||
        entry.titleCandidates.length<2||!entry.titleCandidates.includes(entry.id)||
        new Set(entry.titleCandidates).size!==entry.titleCandidates.length||entry.titleCandidates.some(id=>!T.byId[id])))
        throw Error("牌面变体身份不正确："+entry.id);
      if(entry.animated!==undefined&&typeof entry.animated!=="boolean")
        throw Error("动态牌面标记不正确："+entry.id);
      const views=entry.views??[{patches:entry.patches}];
      if(!views.length||views.some(view=>!Array.isArray(view.patches)||
        view.patches.length!==bank.patches.length||view.patches.some(file=>typeof file!=="string")))
        throw Error("牌面完整视图不正确："+entry.id);
    }
    return bank;
  }
  function checkedThreshold(entry,field){
    const value=entry[field];
    if(value!==undefined&&(!Number.isFinite(value)||value<=0||value>1))
      throw Error("单牌识别门槛不正确："+entry.id);
  }
  function classes(env,bank,openingBank=null){
    const T=env.TCG;
    checkedBank(T,bank);
    if(bank.expanded)checkedBank(T,bank.expanded);
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
          this.handCostMarkersIn(f,C.ROI)));
      }
      raisedHandIn(f){
        const roi=[450,750,1310,200];
        return !!env.TCGBetterGI.costMarkerLayout(this.handCostMarkersIn(f,roi));
      }
      collapsedIn(f){
        return this.memoFrame(f,"collapsed/identities",()=>{
          const read=C.identify(this.collapsedLayoutIn(f),bank,(slot,p,filename)=>{
          const [dx,dy,w,h]=p;
          return score(this,env,f,slot.marker.x+dx,slot.marker.y+dy,w,h,filename,2);
          });
          // Report native rejection once per row; external diagnostics own images.
          const missing=read.slots.filter(s=>!s.id&&!s.titleCandidates);
          if(read.status!=="readable"&&!this.diagnosticKeys.has("hand-layout-miss")){
            this.diagnosticKeys.add("hand-layout-miss");
            this.trace("hand-layout-miss",{reason:read.reason,inputs:0});
          }
          const key="hand-art-miss:"+JSON.stringify(read.slots.map(s=>s.id||s.candidate||null));
          if(missing.length&&!this.diagnosticKeys.has(key)){
            this.diagnosticKeys.add(key);
            this.trace("hand-art-miss",{count:read.count,slots:read.slots,inputs:0});
          }
          return read;
        });
      }
      readSelectedCardFacts(f,card,x){
        super.readSelectedCardFacts?.(f,card,x);
        const key="hand-unlisted:"+card.id;
        if(!bank.entries.some(e=>e.id===card.id)&&!this.diagnosticKeys.has(key)){
          this.diagnosticKeys.add(key);
          this.trace("hand-unlisted",{id:card.id,name:card.name,point:[x,945],inputs:0});
        }
      }
      expandedHandIn(f,count){
        this.requireHandObservation(this.phaseIn(f),"expanded-hand-artwork");
        const native=this.nativeHandCountIn(f);
        if(native!==null&&native!==count){
          const error=Error("展开手牌数量已变化");error.code="TCG_HAND_RETRY";throw error;
        }
        const roi=[450,750,1310,200],marks=this.handCostMarkersIn(f,roi);
        const layout=env.TCGBetterGI.costMarkerLayout(marks,count);
        if(!layout)return null;
        const read=C.identify({status:"readable",count,slots:layout.markers.map((marker,index)=>({index,marker}))},
          bank.expanded,(slot,p,filename)=>score(this,env,f,Math.round(slot.marker.x)+p[0],
            Math.round(slot.marker.y)+p[1],p[2],p[3],filename,2));
        if(read.slots.every(s=>!s.id)&&!this.diagnosticKeys.has("expanded-art-miss")){
          this.diagnosticKeys.add("expanded-art-miss");
          this.trace("expanded-art-miss",{count,slots:read.slots,inputs:0});
        }
        return read;
      }
      async fillHandArtwork(cards,scan){
        if(!bank.expanded||!cards.length||cards.every(Boolean))return;
        const read=this.frame(f=>this.expandedHandIn(f,cards.length));
        if(!read)return;
        scan.titleCandidates??=[];
        for(const slot of read.slots)if(!cards[slot.index]){
          if(slot.id)cards[slot.index]=T.observedCard(T.byId[slot.id].name,slot.index);
          else if(slot.titleCandidates)scan.titleCandidates[slot.index]=slot.titleCandidates;
        }
        this.fillHandVariants(cards,read.slots,scan.retainedHand,scan.retainedVariantFamilies);
        this.trace("expanded-hand-artwork",{count:cards.length,known:cards.filter(Boolean).length,
          unknown:cards.flatMap((c,i)=>c?[]:[i]),inputs:0});
      }
      fillHandVariants(cards,slots,retainedHand,retainedFamilies=[]){
        // The deck owns variant rules; this layer only intersects a rule proof
        // with the observed artwork family. Prices never identify a variant.
        const proof=T.handVariantProof?.(this.memory,this.confirmationSession?.plan?.action);
        if(proof)for(const slot of slots)if(!cards[slot.index]&&slot.titleCandidates){
          const possible=slot.titleCandidates.filter(id=>proof.ids.includes(id));
          if(possible.length===1&&slot.titleCandidates.every(id=>proof.family.includes(id))){
            cards[slot.index]=T.observedCard(T.byId[possible[0]].name,slot.index);
            this.trace("hand-variant-inferred",{id:possible[0],index:slot.index,proof:proof.source,inputs:0});
          }
        }
        // Only an explicit rule guarantee can retain old identities across a
        // full sync. Artwork must classify all members of the current family.
        // Equal counts and one old identity resolve membership without guessing
        // order, a printed stage, a current price or a newly drawn family card.
        if(!retainedHand)return;
        const complete=slots.every(s=>s.id||s.titleCandidates);
        const done=new Set();
        for(const slot of slots)if(!slot.id&&slot.titleCandidates){
          const family=slot.titleCandidates,key=family.slice().sort().join("/");
          if(done.has(key))continue;done.add(key);
          // A rule-proven no-new-member action (e.g. kernel generation) keeps
          // the family count exact even if an unrelated card needs a title.
          const unchangedFamily=retainedFamilies.some(ids=>ids.length===family.length&&ids.every(id=>family.includes(id)));
          if(!complete&&!unchangedFamily)continue;
          const prior=retainedHand.filter(c=>family.includes(c.id)),ids=new Set(prior.map(c=>c.id));
          const current=slots.filter(s=>s.id?family.includes(s.id):
            s.titleCandidates?.length===family.length&&s.titleCandidates.every(id=>family.includes(id)));
          if(ids.size!==1||prior.length!==current.length)continue;
          const id=prior[0].id;
          if(current.some(s=>s.id&&s.id!==id))continue;
          const indices=[];
          for(const s of current)if(!cards[s.index]){
            cards[s.index]=T.observedCard(T.byId[id].name,s.index);indices.push(s.index);
          }
          if(indices.length)this.trace("hand-variants-reused",{id,indices,
            proof:unchangedFamily?"rule-proven-unchanged-family-and-native-family-count":
              "retained-native-identities-and-complete-current-family-count",inputs:0});
        }
      }
      async folded(mode,settling=false){
        if(this.handFanReady||this.handNeedsReset)return null;
        const started=Date.now(),revision=this.inputRevision;
        const sample=()=>this.frame(f=>{
          const phase=this.phaseIn(f);
          if(phase.result||this.inputRevision!==revision||(mode==="pick"
            ?phase.phase!=="pick":phase.phase!=="board"||phase.turn!=="user"))return null;
          const read=this.collapsedIn(f);
          if(mode==="board"&&read.status!=="readable"&&this.raisedHandIn(f)){
            // Generation can raise the fan after our last reset. Trust this
            // native view, not the stale flag; the caller folds it once.
            this.handFanReady=true;this.handNeedsReset=true;
            return {read:{status:"raised",count:null,slots:[]},nativeCount:this.nativeHandCountIn(f)};
          }
          return {read,nativeCount:mode==="board"?this.nativeHandCountIn(f):5};
        });
        let read=null,unavailableReason="first-frame-unavailable";
        try{
          const a=sample();if(!a)return null;
          if(a.read.status==="raised"){
            read={...a.read,nativeCount:a.nativeCount,stableReads:1};return read;
          }
          if(a.read.status==="readable"&&(a.nativeCount===null||a.nativeCount===a.read.count)&&a.read.slots.every(slot=>slot.id||slot.titleCandidates)){
            read={...a.read,nativeCount:a.nativeCount,countConflict:false,stableReads:1};
            return read;
          }
          unavailableReason="second-frame-unavailable";
          await env.sleep(120);
          let b=sample(),reads=2;
          // A known draw/generation can outlast the board animation. Wait only
          // for missing/moving geometry, without input or mandatory extra reads
          // on a complete row. A phase/input change ends the wait immediately.
          while(settling&&b&&b.read.status!=="readable"&&b.read.status!=="raised"&&reads<6){
            await env.sleep(240);b=sample();reads++;
          }
          if(b?.read.status==="raised"){
            read={...b.read,nativeCount:b.nativeCount,stableReads:reads};return read;
          }
          if(b?.read.status!=="readable"){
            unavailableReason="second-frame-"+(b?.read.reason||"unavailable");return null;
          }
          // Supplement a conflict with the latest observation, not cached facts
          // or an obligatory agreement with the incomplete first capture.
          read={...b.read,nativeCount:b.nativeCount,
            countConflict:b.nativeCount!==null&&b.nativeCount!==b.read.count,stableReads:reads};
          // No input occurred between these captures. Keep a first-frame
          // identity only when the same slot still ranks that identity first
          // and only its animated score fell below the floor. A moved row,
          // count conflict or positive identity change uses the latest frame.
          const sameRow=reads===2&&a.read.status==="readable"&&a.read.count===read.count&&
            (a.nativeCount===null||a.nativeCount===read.count)&&!read.countConflict&&
            read.slots.every((s,i)=>{
              const old=a.read.slots[i];
              return Math.abs(s.marker.x-old.marker.x)<=2&&Math.abs(s.marker.y-old.marker.y)<=2&&
                !(s.id&&old.id&&s.id!==old.id);
            });
          if(sameRow)read.slots=read.slots.map((s,i)=>{
            const old=a.read.slots[i];
            return !s.id&&old.id&&s.candidate===old.id&&s.rejectionReason==="score-floor"
              ?{...old,marker:s.marker,identityFrame:1}:s;
          });
          return read;
        }finally{
          // Best-effort diagnostics must not replace an OCR/cancellation error.
          try{this.trace("folded-hand",{mode,count:read?.count??null,nativeCount:read?.nativeCount??null,
            reason:!read?"unavailable":read.status==="raised"?"raised-fan":read.countConflict?"count-conflict":read.slots.every(s=>s.id)?"full":"partial",
            ...(!read?{unavailableReason}:{}),
            ids:read?.slots.map(s=>s.id)??[],
            reads:read?.stableReads??0,
            rejected:read?.slots.filter(s=>!s.id).map(s=>({index:s.index,candidate:s.candidate??null,
              score:Number.isFinite(s.score)?Number(s.score.toFixed(4)):null,
              gap:Number.isFinite(s.gap)?Number(s.gap.toFixed(4)):null,view:s.view??null,
              reason:s.rejectionReason??null}))??[],
            elapsedMs:Date.now()-started,inputs:0});}catch{}
        }
      }
      async readHand(expected=this.handCountHint,evidence=null,scan={titles:0}){
        const started=Date.now(),titlesBefore=scan.titles;let route="expanded-artwork-fallback",hand=null;
        try{
          if(scan.cards)
            return hand=await super.readHand(expected,evidence,scan);
          // Full synchronization always tries the native artwork bank first.
          // A raised fan is a view state, not evidence that every identity failed.
          if(this.handFanReady||this.handNeedsReset){
            this.requireHandObservation(this.phase(),"before-hand-artwork");
            if(this.handFanReady){
              const count=this.frame(f=>this.nativeHandCountIn(f));
              if(count!==null)evidence={count};
            }
            await this.reset();
          }
          let read=await this.folded("board",scan.settling===true);
          if(read?.status==="raised"){
            this.requireHandObservation(this.phase(),"raised-hand-before-folded-read");
            if(read.nativeCount!==null)evidence={count:read.nativeCount};
            await this.reset();
            read=await this.folded("board",scan.settling===true);
          }
          const cards=read?.slots.map(s=>s.id?T.observedCard(T.byId[s.id].name,s.index):null);
          if(!read||read.status==="raised"||read.countConflict||(evidence&&evidence.count!==read.count))
            return hand=await super.readHand(expected,evidence,scan);
          // Resolve missing count from native evidence without discarding the
          // artwork identities merely because an older count hint disagrees.
          let count=evidence?evidence.count:read.nativeCount;
          // A complete calibrated native row measures count and slots together.
          // Only an actual disagreement requires another measurement; a missing
          // expanded badge alone is not a reason to toggle an already folded fan.
          if(count===null && expected!==null && expected!==read.count){
            this.requireHandObservation(this.phase(),"before-local-hand-count");
            count=await this.handCount(expected);
          }
          count??=read.count;
          if(count!==read.count)return hand=await super.readHand(null,{count},scan);
          // Kept opening cards are already observed identities. Before the
          // first action/read, reuse that evidence through the same complete
          // family/count checks; never infer a countdown stage from its price.
          const retained=scan.retainedHand??(this.handScanSerial===0&&!this.currentAction&&read.count===5
            ?this.openingCards:null);
          this.fillHandVariants(cards,read.slots,retained,scan.retainedVariantFamilies);
          scan.cards=cards;
          this.handScanSerial++;
          if(cards.every(Boolean)){
            route=this.handFanReady?"folded-identities-native-count":"folded-full";
            await this.prepareHandObservation?.(count);
          }else{
            route="local-title-fallback";
            this.requireHandObservation(this.phase(),"before-local-hand-fallback");
            if(!this.handFanReady)await this.expand();
            const points=this.handPoints(count);
            await this.prepareHandObservation?.(count);
            scan.titleCandidates=read.slots.map(s=>s.titleCandidates);
            await this.fillHandArtwork(cards,scan);
            await this.readHandTitles(cards,points,scan);
          }
          hand=this.finishHandObservation?this.finishHandObservation(cards,scan):cards;
          if(this.handFanReady||this.handNeedsReset){
            this.requireHandObservation(this.phase(),"before-hand-reset");
            await this.reset();
          }
          this.handCountHint=null;return hand;
        }finally{
          try{this.trace("hand-read-completed",{route,count:hand?.length??null,
            titleSlots:scan.titles-titlesBefore,elapsedMs:Date.now()-started});}catch{}
        }
      }
      async opening(){
        if(!openingBank||T.openingSetting(this.options.mulligan)==="全部保留")return super.opening();
        const ids=await env.TCGOpeningHand.read(this,openingBank,env,score);
        if(!ids||!ids.some(Boolean))return super.opening();
        this.trace("opening-art",{ids,known:ids.filter(Boolean).length,inputs:0});
        return env.TCGOpeningHand.opening(this,T,env.sleep,ids);
      }
    }
    class Player extends env.TCGPlayer.Player{
      async pick(){
        if(!this.openingFlow.complete&&!this.openingFlow.picked&&this.actions===0){
          const read=await this.host.folded("pick"),slots=read?.count===5?read.slots:[];
          const complete=!read?.countConflict&&slots.length===5&&slots.every(s=>s.id);
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
