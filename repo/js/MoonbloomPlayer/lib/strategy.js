(function (T) {
  "use strict";
  const skill = (who,name) => ({type:"skill",who,skill:name});
  const switchFee=m=>m.freeSwitch||m.fanSwitch?0:1;
  function card(s,h,target=null) {return {type:"card",id:h.id,index:h.index,target};}
  function blocked(m,a) {return m.uncertainActions.includes(T.actionKey(a));}
  function payableSeed(s,m) {
    return T.seeds(s).some(h=>T.payment(s.dice,T.cardCost(s,card(s,h),m),"Dendro"));
  }
  function axis(s,m) {
    const nefer=T.role("奈芙尔"),columbina=T.role("哥伦比娅"),enemy=s.enemies.find(e=>e.active&&T.alive(e));
    if(s.characters.filter(T.alive).length===1 || enemy?.hp<=4)return "cleanup";
    if(!T.alive(s.characters[nefer]) || s.characters[nefer].frozen || s.active===nefer&&s.characters[nefer].hp<=3)
      return T.alive(s.characters[columbina])?"relay":"cleanup";
    if(T.seeds(s).length) {
      const ready=s.characters[nefer].energy>=2;
      if(ready&&m.weapons[nefer]==="fruit"&&payableSeed(s,m))return "burst";
      return enemy?.hp>=16&&s.characters[nefer].hp>=5?"sustain":"fallback";
    }
    return "reaction";
  }
  function hitScore(s,m,who,name,kernel=false) {
    if(name==="T")return techniqueScore(s,m,who);
    const e=T.damageEstimate(s,m,who,name,kernel),c=s.characters[who],role=T.team[who].name;
    let score=e.direct*10;
    if(e.target && e.direct>=e.target.hp && e.direct>0)score+=100-Math.max(0,e.direct-e.target.hp)*2;
    if(e.reacts===true)score+=14;
    if(e.enhancedReady)score+=12;
    if(!kernel&&name!=="Q"&&c.energy<T.team[who].maxEnergy)score+=5;
    if(role==="菈乌玛"&&name==="E")score+=m.frost?0:20;
    if(role==="哥伦比娅"&&name==="E")score+=m.ripple?0:18;
    if(role==="奈芙尔"&&name==="E")score+=T.seeds(s).length?12:4;
    if(role==="菈乌玛"&&name==="Q")score+=s.hand.filter(h=>T.currentCost(h)>0).length>=3?18:0;
    if(role==="奈芙尔"&&name==="Q"&&T.seeds(s).length)score+=15;
    if(e.direct===0 && role!=="菈乌玛")score-=100;
    if(c.hp<=3 && !(e.target&&e.direct>=e.target.hp))score-=15;
    return score;
  }
  function nextLiving(s,who) {
    for(let step=1;step<3;step++){const i=(who+step)%3;if(T.alive(s.characters[i]))return i;}
    return who;
  }
  function discardable(s) {
    if(!s.hand.length||s.hand.some(h=>T.attachedCost(h)===null))return false;
    const max=Math.max(...s.hand.map(T.attachedCost));
    // Equal-highest random selection must be safe for EVERY candidate.
    return s.hand.filter(h=>T.attachedCost(h)===max).every(h=>
      h.id.startsWith("countdown")||h.id==="seed"&&!T.alive(s.characters[T.role("奈芙尔")])||
      ["kohola","ikto","tatanka","kusava"].includes(h.id));
  }
  function techniqueScore(s,m,who=s.active) {
    const equipped=m.techniques[who],id=equipped?.id,def=T.techniques[id];
    if(!def?.active||equipped.uses<=0)return 0;
    const a={type:"skill",who,skill:"T",technique:id};
    if(!T.skillLegal(s,a,m)||blocked(m,a))return 0;
    const cost=T.skillCost(who,"T",m,s),left=afterPayment(s,cost),hit=T.damageEstimate(s,m,who,"T");
    let value=hit.direct*10;
    if(hit.direct>0&&hit.target&&hit.direct>=hit.target.hp)value+=100;
    if(id==="tepetli") {
      const draw=s.deckCount!==0&&s.hand.length<=8,
        shield=s.hand.some(h=>T.byId[h.id]&&T.nonInitial(T.byId[h.id]));
      value=(draw?20:0)+(shield&&s.characters[who].hp<=5?22:0);
      if(payableSeed(s,m)&&!payableSeed(left,m)&&s.characters[who].hp>3)value=0;
    }
    if(def.switches) {
      const target=nextLiving(s,who),next={...left,active:target},old=s.characters[who];
      if(target===who||s.characters[target].frozen||id==="qucu"&&!discardable(s))return 0;
      const hits=attackCandidates(next,m),follow=hits[0]?.score||0;
      const retreat=old.hp<=3&&s.characters[target].hp>=old.hp+2;
      if(!follow&&!retreat)return 0;
      value=Math.max(0,follow-14)+(retreat?28:0)+(id==="blubber"&&drawUseful(s)?8:0);
    }
    if(id==="rawr") {
      // Initial thirty contain no techniques. Never claim a guaranteed draw.
      const recipients=s.hand.filter(h=>T.byId[h.id]?.type==="technique"&&T.currentCost(h)>=2);
      value=recipients.length&&m.techniqueDiscount===0&&!T.seeds(s).length&&T.total(left.dice)>=1?12:0;
    }
    return Math.max(0,value-T.size(cost)*2);
  }
  function attackCandidates(s,m,includeMovement=false) {
    const names=["NA","E","Q"],equipped=m.techniques[s.active];
    if(equipped&&(includeMovement||!T.techniques[equipped.id].switches))names.push("T");
    return names.map(name=>({...skill(s.active,name),...(name==="T"?{technique:equipped.id}:{}),
      score:T.skillLegal(s,{...skill(s.active,name),technique:equipped?.id},m)?
        hitScore(s,m,s.active,name)-(name==="T"?0:T.size(T.skillCost(s.active,name,m,s))*2):0}))
      .filter(a=>a.score>0&&!blocked(m,a)).sort((a,b)=>b.score-a.score);
  }
  function techniquePlan(s,m,h,target,cost,projectedTriggerCost=null) {
    const left=afterPayment(s,cost);if(!left)return {value:0,reason:"装备后没有合法支付"};
    const paid=T.size(cost),refund=projectedTriggerCost===null?T.cardTriggers(h,m).total||0:
      m.canopyPoints.filter(p=>p!==null&&p<=projectedTriggerCost).length+(m.researchRemaining>0&&projectedTriggerCost>=3?1:0),old=m.techniques[target];
    const nextMemory={...m,techniques:m.techniques.slice()};nextMemory.techniques[target]={id:h.id,uses:2};
    const hand=T.indexedHand(left.hand.filter(x=>x.index!==h.index));
    const next={...left,hand,active:target};
    if(target!==s.active){const p=T.payment(next.dice,{any:switchFee(m)},T.team[target].element);if(!p)return {value:0,reason:"转交后台后无法接手"};next.dice=p.remaining;}
    const use=techniqueScore(next,nextMemory,target),previous=old?techniqueScore({...next,active:target},m,target):0;
    const conversion=refund>paid?30+(refund-paid)*5:0;
    const shield=h.id==="boat"&&s.characters[target].hp<=3&&paid<=1?38:0;
    let value=Math.max(use>0?use-5-paid*2:0,conversion,shield);
    if(old?.uses>0&&previous>=use&&!shield)value=conversion>previous?conversion:0;
    if(target!==s.active)value-=8;
    return {value:Math.max(0,value),reason:shield?"低费浪船护盾保活":use>0?"装备后可支付"+T.techniques[h.id].name:
      conversion?"按已知附着费用触发悬木人，返色待观察":T.techniques[h.id].reason||"保留到特技有实际收益时"};
  }
  function itemScore(s,m,a,left,paid,refund) {
    if(m.supports.includes(a.id))return 0;
    const empty=(m.bloomResolved?4:3)-m.supports.length;
    // Leave a support slot for the guide's bloom engine, not a low-payoff item.
    if(empty===1&&s.hand.some(h=>h.id==="overgrow")&&!m.supports.includes("overgrow"))return 0;
    const conversion=refund>paid?40+(refund-paid)*3:0;
    let use=0;
    switch(a.id){
      case "transformer":use=s.enemies.some(e=>T.alive(e)&&e.hp>=8)&&T.total(left.dice)>=3?20:0;break;
      case "seelie":use=drawUseful(s)&&s.enemies.some(e=>T.alive(e)&&e.hp>=8)&&T.total(left.dice)>=3?24:0;break;
      case "nre":use=drawUseful(s)&&!m.played.includes(T.byId.sashimi.name)?18:0;break;
      case "seedbox":use=empty>=2&&s.hand.some(h=>h.index!==a.index&&T.byId[h.id]?.type==="support"&&T.attachedCost(h)>=2)?40:0;break;
      case "lens":use=drawUseful(s)&&(s.hand.some(h=>["weapon","artifact"].includes(T.byId[h.id]?.type)&&m.played.includes(T.byId[h.id].name))||
        s.hand.some(h=>h.id==="razor")&&m.weapons.includes("fruit"))?40:0;break;
      case "lumen":{
        if(s.hand.some(h=>h.id==="overgrow")&&!m.supports.includes("overgrow"))return 0;
        // Three individually affordable future cards; no invented draws/refund colours.
        let dice=left.dice,count=0;
        for(const h of s.hand.filter(h=>h.id!=="lumen"&&T.currentCost(h)!==null).sort((a,b)=>T.currentCost(a)-T.currentCost(b))){
          const target=["weapon","artifact","food","return","technique","heal-dice"].includes(T.byId[h.id]?.type)?s.active:null;
          const action=card(s,h,target),p=T.payment(dice,T.cardCost(s,action,m));
          if(p&&!blocked(m,action)&&T.cardContextError(s,action,m)===null&&
            cardScore({...s,dice},m,action,axis(s,m))>0){dice=p.remaining;count++;}
        }
        use=count>=3&&drawUseful(s)?46:0;break;
      }
      case "fan":use=s.characters.filter(T.alive).length>1&&s.characters[s.active].hp<=5&&T.total(left.dice)>=4?18:0;break;
      case "kusava":return 0; // Round-start random discard can eat discounted kernels.
    }
    return Math.max(use,conversion);
  }
  function generatedChoices(options,s,m,origin=null) {
    if(!s)return options.map(o=>({id:o.id,score:0,reason:"无已观察牌桌，保留候选顺序而不假定资源"}));
    let view=s,mem=m;
    if(origin?.type==="card"){
      const pay=T.payment(s.dice,T.cardCost(s,origin,m));
      if(pay)view={...s,dice:pay.remaining,hand:T.indexedHand(s.hand.filter((_,i)=>i!==origin.index))};
      if(origin.id==="meditation")mem={...m,sleepy:m.sleepy+2};
    }
    const protectedHand=T.seeds(view).length||view.hand.some(h=>["fruit","calx"].includes(h.id));
    return options.map(o=>{
      let score=0,reason="当前不宜使用，保留或调和",target=null;
      if(o.id==="sanctify"||o.id==="disperse"){
        const recycle=!protectedHand&&view.deckCount!==0&&view.hand.length<=8;
        score=(o.id==="sanctify")===recycle?50:0;reason=recycle?"缺启动件，重洗补一张":"保留核与关键组件，不重洗现有手牌";
      }else if(o.id==="overgrow"||o.id==="amrita"){
        const heal=view.characters.some(T.alive)&&view.characters.filter(T.alive).some(c=>c.hp<=3)&&!T.seeds(view).length&&
          view.hand.filter(h=>T.currentCost(h)===0).length>=2;
        score=o.id==="overgrow"?50:heal?55:10;reason=o.id==="overgrow"?"维持水草反应与后续核来源":"两张后续牌可触发增血时保活";
      }else if(T.byId[o.id]?.type==="choice-option"){
        const wounded=view.characters.filter(T.alive).some(c=>c.hp<=4),room=view.hand.length<=7;
        score={tonatiuh:45,chenyu:wounded&&room?50:30,tower:view.characters.filter(T.alive).every(c=>c.hp>4)?20:-20,chasm:5}[o.id];
        reason={tonatiuh:"改善实际骰色并逐步过牌",chenyu:"预留两张茶露空间，后续冒险与结末治疗",tower:"承受入场穿透换长期返骰",chasm:"随机事件扩大未适配范围，优先确定资源"}[o.id];
      }else if(T.techniques[o.id]){
        // This forecast ranks a choice only. It is never installed as hand evidence.
        // When kernels need sleepy, evaluate equipment AFTER that discount is consumed.
        const reserve=T.seeds(view).length>0,base=T.size(T.byId[o.id].cost),n=Math.max(0,base-mem.techniqueDiscount-(reserve?0:mem.sleepy));
        const h={id:o.id,index:view.hand.length,currentCost:n,attachments:{source:"choice-projection",empowered:false}};
        const imagined={...view,hand:[...view.hand,h]};
        for(let who=0;who<3;who++)if(T.alive(view.characters[who])){
          const cost=T.cardCost(imagined,card(imagined,h,who),mem),p=techniquePlan(imagined,mem,h,who,cost,base);
          if(p.value>score){score=p.value;target=who;reason=p.reason;}
        }
        if(score===0){
          const future={ray:8,yumka:5,boat:3,tepetli:drawUseful(view)?6:0,
            blubber:nextLiving(view,view.active)!==view.active?4:0,qucu:discardable(view)?4:0,
            rawr:view.hand.some(h=>T.byId[h.id]?.type==="technique"&&T.currentCost(h)>=2)?4:0}[o.id]||0;
          score=future;
          reason=future?"本次不抢核优惠，留作后续"+T.techniques[o.id].name:
            T.techniques[o.id].reason||"当前没有有效后续，仅保留作返骰材料或调和";
        }
        if(reserve)reason+="；困困优惠留核，入手后重新看真实费用";
      }
      return {id:o.id,score,target,reason};
    }).sort((a,b)=>b.score-a.score);
  }
  function drawUseful(s) {return s.hand.length<=7 && s.deckCount!==0;}
  function afterPayment(s,cost) {
    const p=T.payment(s.dice,cost,T.team[s.active].element);
    return p?{...s,dice:p.remaining}:null;
  }
  function setupPlan(s,m) {
    // Reserve the actual grass -> switch -> water payments, not a turn-number
    // script. A confirmed summon satisfies its half until it really expires.
    // Once kernels are available, ordinary output/relay scoring takes over.
    if(T.seeds(s).length||s.characters[s.active].hp<=3)return null;
    const pending=[T.role("菈乌玛"),T.role("哥伦比娅")].filter(who=>
      T.alive(s.characters[who])&&s.characters[who].hp>3&&!s.characters[who].frozen&&
      !(T.team[who].name==="菈乌玛"?m.frost:m.ripple));
    if(!pending.length)return null;
    pending.sort((a,b)=>(b===s.active)-(a===s.active));
    let next=s,free=switchFee(m)===0;const actions=[];
    for(const who of pending){
      if(who!==next.active){
        const change={type:"switch",target:who};
        if(blocked(m,change))return null;
        const pay=T.payment(next.dice,{any:free?0:1},T.team[who].element);
        if(!pay)return null;
        actions.push(change);next={...next,active:who,dice:pay.remaining};free=false;
      }
      const a=skill(who,"E");
      if(!T.skillLegal(next,a,m)||blocked(m,a))return null;
      const pay=T.payment(next.dice,T.skillCost(who,"E",m,next),T.team[who].element);
      actions.push(a);next={...next,dice:pay.remaining};
    }
    return {actions,remaining:next.dice};
  }
  function cardResources(s,m,a,cost) {
    const next=afterPayment(s,cost);if(!next)return null;
    // Only deterministic conversion enters a budget. Draws, random refunds and
    // attachment targets remain unknown until the submitted action is confirmed.
    if(a.id.startsWith("countdown")||a.id==="show")next.dice={Omni:T.total(next.dice)};
    if(a.id==="woven")next.dice={...next.dice,Dendro:(next.dice.Dendro||0)+1};
    return next;
  }
  function cardScore(s,m,a,currentAxis,cost=T.cardCost(s,a,m)) {
    const h=s.hand[a.index],c=T.byId[a.id],paid=T.size(cost),left=cardResources(s,m,a,cost);
    const triggers=T.cardTriggers(h,m),refund=triggers.total||0,nefer=T.role("奈芙尔");
    let value=-1000;
    switch(a.id) {
      case "seed":
        value=hitScore(s,m,s.active,"NA",true);
        if(s.characters[nefer].energy>=2 && T.skillLegal(s,skill(nefer,"Q"),m) &&
          T.damageEstimate(s,m,nefer,"Q").direct<T.damageEstimate(s,m,nefer,"Q").target?.hp)value-=18;
        break;
      case "woven":value=T.total(s.dice)<16&&s.characters.some((ch,i)=>T.alive(ch)&&T.team[i].element==="Dendro")?60:0;break;
      case "gleam":value=s.hand.some(x=>T.currentCost(x)>0)?38:0;break;
      case "upgrade":value=s.hand.length<=8 && s.hand.some(x=>T.currentCost(x)>=2)?42:0;break;
      case "cleaning": {
        const kinds=T.attachmentKinds(s);
        const some=s.hand.some(x=>x.attachments?.source==="native"&&(x.attachments.reduction>0||x.attachments.empowered));
        value=(kinds>0||some)&&T.total(s.dice)<16?50:0;break;
      }
      case "fruit": {
        const wearer=s.characters[a.target],switchPay=a.target===s.active?{remaining:left.dice}:T.payment(left.dice,{any:switchFee(m)},T.team[a.target].element),
          wielding=switchPay?{...left,active:a.target,dice:switchPay.remaining}:null,
          future=wielding&&(["NA","E","Q"].some(name=>T.skillLegal(wielding,skill(a.target,name),m))||a.target===nefer&&payableSeed(wielding,m));
        value=wearer.hp>=4&&future?(m.weapons[a.target]!=="fruit"?46:drawUseful(s)?18:0)+(a.target===nefer&&T.seeds(s).length?12:0):0;
        if(a.target!==s.active)value-=7;break;
      }
      case "gambler": {
        const hits=a.target===s.active?attackCandidates(left,m):[];
        const lethal=hits.some(a=>{const h=T.damageEstimate(left,m,left.active,a.skill);return h.target&&h.direct>=h.target.hp;})||
          a.target===s.active&&s.active===nefer&&payableSeed(left,m)&&(()=>{const h=T.damageEstimate(left,m,nefer,"NA",true);return h.target&&h.direct>=h.target.hp;})();
        value=!m.artifacts[a.target]&&T.enemyCount(s)>1&&lethal?70:0;break;
      }
      case "calx": {
        const donors=s.characters.filter((ch,i)=>i!==s.active&&T.alive(ch)&&ch.energy>0).length;
        value=s.active===nefer&&s.characters[nefer].energy+donors>=2&&
          T.payment(left.dice,{element:"Dendro",n:3},"Dendro")?65:0;break;
      }
      case "meditation": {
        const seeds=T.seeds(s),budget=T.total(left.dice),switches=s.active===nefer?0:switchFee(m);
        value=T.alive(s.characters[nefer])&&!s.characters[nefer].frozen&&seeds.some(x=>T.currentCost(x)>=2&&
          T.payment(left.dice,{any:switches+Math.max(0,T.currentCost(x)-2)}))&&m.sleepy===0&&s.hand.length<=8?58:0;
        // Play bloom before granting the one-shot noninitial discount when affordable.
        if(value&&s.hand.some(x=>x.id==="overgrow"&&T.cardLegal(s,card(s,x),m))&&!m.supports.includes("overgrow")&&budget>=2)value=30;
        break;
      }
      case "canopy":value=m.canopyPoints.length<2&&s.hand.some(x=>T.byId[x.id]&&T.nonInitial(T.byId[x.id])&&T.currentCost(x)>=1)?44:drawUseful(s)&&m.canopyPoints.length<2?20:0;break;
      case "research":value=m.researchRemaining===0&&s.hand.filter(x=>T.attachedCost(x)>=3).length>=2?48:0;break;
      case "draw":value=drawUseful(s)&&left&&T.total(left.dice)>=3?34:drawUseful(s)&&T.seeds(s).length===0?18:0;break;
      case "countdown3":case "countdown2":case "countdown1":case "show":
        value=drawUseful(s)&&left&&T.total(left.dice)>=3?42:T.total(left.dice)>=1&&T.seeds(s).length===0&&drawUseful(s)?20:0;break;
      case "adventure":value=s.hand.length<=8||s.characters.some((ch,i)=>T.alive(ch)&&ch.hp<T.team[i].maxHp)?32:0;break;
      case "sashimi": {
        let kernelHits=0,dice=left.dice;
        if(a.target===nefer)for(const h of T.seeds(s)){
          const p=T.payment(dice,T.cardCost(s,card(s,h),m),"Dendro");if(p){kernelHits++;dice=p.remaining;}
        }
        const enhanced=T.damageEstimate(s,m,a.target,"NA").enhancedReady;
        value=a.target===s.active&&(kernelHits>=2||enhanced)&&
          (kernelHits||T.payment(left.dice,T.skillCost(a.target,"NA",m,left),T.team[a.target].element))?55:0;break;
      }
      case "tea":value=s.characters[a.target].hp<T.team[a.target].maxHp?26:0;break;
      case "overgrow":value=m.supports.includes("overgrow")?0:T.alive(s.characters[T.role("哥伦比娅")])?42:12;break;
      case "amrita":value=m.supports.includes("amrita")?0:s.characters.some(ch=>T.alive(ch)&&ch.hp<=5)&&s.hand.length>=3?36:10;break;
      case "razor":value=m.weapons[a.target]==="fruit"&&drawUseful(s)&&
        (s.characters[a.target].hp<=3||paid===0&&T.total(s.dice)>=1)?24:0;break;
      case "sand": {
        const otherDraw=s.hand.some(x=>x.index!==h.index&&["draw","show","countdown1","countdown2"].includes(x.id));
        value=!otherDraw&&T.seeds(s).length===0&&s.hand.length>=3&&s.hand.length<=8&&currentAxis!=="burst"?12:0;break;
      }
      case "shift":value=switchFee(m)>0&&T.total(s.dice)>0&&s.characters.some((ch,i)=>i!==s.active&&T.alive(ch)&&!ch.frozen)&&
        (s.characters[s.active].hp<=3||s.characters[s.active].frozen||s.active!==nefer&&T.seeds(s).length>0)?55:0;break;
      case "toy":value=s.characters[a.target].hp<T.team[a.target].maxHp&&T.total(s.dice)<15?38:10;break;
      default:
        if(c.type==="support")value=itemScore(s,m,a,left,paid,refund);
        else if(c.type==="technique")value=techniquePlan(s,m,h,a.target,cost).value;
    }
    if(a.id!=="seed"&&T.nonInitial(c)&&m.sleepy>0&&T.seeds(s).some(h=>T.attachedCost(h)===null||T.attachedCost(h)>0)&&T.alive(s.characters[nefer]))return 0;
    // Missing canopy first; then low trigger cost before high cost. Only use
    // known costs: an unread attachment is not a promised random refund.
    if(a.id!=="canopy"&&T.nonInitial(c)&&value>0&&s.hand.some(h=>h.id==="canopy"&&T.cardLegal(s,card(s,h),m))&&m.canopyPoints.length<2)
      value=Math.min(value,25);
    // Do not spend a currently complete setup line on speculative extra draws.
    // Outside setup, do not turn the last payable hit into an empty end-turn.
    if(a.id!=="seed"&&paid>0&&left){
      if(setupPlan(s,m)&&!setupPlan(left,m))return 0;
      const hasHit=(state,mem)=>attackCandidates(state,mem).some(a=>T.damageEstimate(state,mem,state.active,a.skill).direct>0)||
        T.team[state.active].name==="奈芙尔"&&payableSeed(state,mem);
      const nextMemory=c.type==="technique"?{...m,techniques:m.techniques.map((v,i)=>i===a.target?{id:a.id,uses:2}:v)}:m;
      if(hasHit(s,m)&&!hasHit(left,nextMemory)&&!["calx","meditation","toy"].includes(a.id)&&
        !(a.id==="boat"&&s.characters[a.target].hp<=3))return 0;
    }
    return value>0?value+refund*4-paid*2:value;
  }
  function candidates(s,m,currentAxis) {
    const out=[],push=(a,score)=>{if(score>0&&!blocked(m,a))out.push({...a,score,axis:currentAxis});};
    for(const a of attackCandidates(s,m,true))push(a,a.score);
    for(const h of s.hand) {
      const c=T.byId[h.id];if(!c)continue;
      const targets=["weapon","artifact","food","return","technique","heal-dice"].includes(c.type)?
        s.characters.map((ch,i)=>T.alive(ch)?i:-1).filter(i=>i>=0):[null];
      for(const target of targets) {
        const a=card(s,h,target);
        if(T.currentCost(h)!==null&&T.cardLegal(s,a,m)){
          // A readable digit plus affordable ordinary-colour payment is enough
          // to select a card. Its normal pre-drag title read supplies details.
          push(a,cardScore(s,m,a,currentAxis));
        }else if(!T.cardFactsKnown(h)){
          if(T.cardContextError(s,a,m)!==null||m.probeKeys.includes(T.cardProbeKey(s,h)))continue;
          // This is an upper bound for the VALUE OF READING, never a payment or
          // an observed fact: unknown empowerment may relax colour, not price.
          // A missing digit may still be zero. Re-evaluate after the actual read.
          const cost={any:T.currentCost(h)??0};
          if(!T.payment(s.dice,cost))continue;
          const score=cardScore(s,m,a,currentAxis,cost);
          push({type:"probe",scope:"card",id:h.id,index:h.index,target,key:T.cardProbeKey(s,h)},score);
        }
      }
    }
    const fee=switchFee(m),active=s.characters[s.active];
    const safeTargets=s.characters.map((ch,i)=>({ch,i})).filter(({ch,i})=>i!==s.active&&T.alive(ch)&&!ch.frozen);
    const safest=safeTargets.sort((a,b)=>b.ch.hp-a.ch.hp||a.i-b.i)[0];
    const directFinish=out.some(a=>{
      if(a.type!=="skill"&&!(a.type==="card"&&a.id==="seed"))return false;
      const hit=T.damageEstimate(s,m,s.active,a.skill||"NA",a.type==="card");
      return hit.target&&hit.direct>0&&hit.direct>=hit.target.hp;
    });
    // A payable finishing hit already on field must not lose priority to the
    // same hypothetical hit plus a retreat reward after an extra combat turn.
    if(!directFinish&&T.total(s.dice)>=fee)for(let who=0;who<3;who++) {
      if(who===s.active || !T.alive(s.characters[who]) || s.characters[who].frozen)continue;
      const p=T.payment(s.dice,{any:fee},T.team[who].element),next={...s,active:who,dice:p.remaining};
      const attacks=attackCandidates(next,m).map(a=>a.score);
      if(T.team[who].name==="奈芙尔")for(const h of T.seeds(next))if(T.cardLegal(next,card(next,h),m))attacks.push(hitScore(next,m,who,"NA",true));
      const retreat=safest?.i===who&&(active.frozen||active.hp<=3&&safest.ch.hp>=active.hp+2);
      // Rank the payable next hit against current actions, not a difference of scores
      // against the same current actions a second time (which trapped the first role).
      let score=attacks.length?Math.max(...attacks)-14-fee*2:0;
      if(retreat)score+=28;
      if(attacks.length&&currentAxis==="relay"&&T.team[who].name==="哥伦比娅"&&T.damageEstimate(next,m,who,"NA").enhancedReady)score+=10;
      push({type:"switch",target:who},score);
    }
    const setup=setupPlan(s,m);
    if(setup&&!directFinish){
      const first=setup.actions[0],existing=out.find(a=>T.actionKey(a)===T.actionKey(first));
      if(existing){existing.score=Math.max(existing.score,50);existing.reason="按已确认状态补齐草水铺垫，保留后续真实支付";}
    }
    return out.sort((a,b)=>b.score-a.score || T.actionKey(a).localeCompare(T.actionKey(b)));
  }
  function tuning(s,m) {
    const desired=T.team[s.active].element,wrong=T.diceOrder.some(e=>e!==desired&&e!=="Omni"&&(s.dice[e]||0)>0);
    if(!wrong||s.characters[s.active].frozen)return null;
    const useful=["seed","fruit","calx","overgrow","meditation","draw","countdown1","show"];
    const choices=s.hand.filter(h=>h.canTune===true&&!h.attachments?.noTuning).map(h=>{
      const element=h.attachments?.empowered===true?"Omni":desired;
      const a={type:"tune",id:h.id,index:h.index,target:null,element};
      const neferDead=!T.alive(s.characters[T.role("奈芙尔")]);
      const c=T.byId[h.id],target=["weapon","artifact","food","return","technique","heal-dice"].includes(c?.type)?s.active:null;
      const playable=c&&T.cardLegal(s,card(s,h,target),m)?cardScore(s,m,card(s,h,target),axis(s,m)):0;
      return {a,cost:Math.max(playable,useful.includes(h.id)?30:h.supported===false?0:10),deadSeed:h.id==="seed"&&neferDead};
    }).filter(x=>!blocked(m,x.a)).sort((a,b)=>(a.deadSeed?-10:a.cost)-(b.deadSeed?-10:b.cost));
    if(!choices.length)return null;
    const a=choices[0].a,source=T.diceOrder.find(e=>e!==a.element&&e!=="Omni"&&(s.dice[e]||0)>0);
    if(!source)return null;
    const after={...s,dice:{...s.dice,[source]:s.dice[source]-1,[a.element]:(s.dice[a.element]||0)+1},hand:s.hand.filter((_,i)=>i!==a.index)};
    return attackCandidates(after,m).length ||
      T.team[s.active].name==="奈芙尔"&&payableSeed(after,m)?{...a,axis:axis(s,m),reason:"补足一个实际可支付动作"}:null;
  }
  function choose(s,m) {
    if(!T.legalState(s))return {type:"stop",reason:"决策前牌桌基础字段不完整"};
    const currentAxis=axis(s,m),ranked=candidates(s,m,currentAxis);
    if(ranked.length) {const {score,...a}=ranked[0];
      const purpose=a.type==="card"&&T.byId[a.id].type==="technique"?techniquePlan(s,m,s.hand[a.index],a.target,T.cardCost(s,a,m)).reason:
        a.skill==="T"?"按当前资源使用"+T.techniques[a.technique].name:null;
      return {...a,reason:a.reason||purpose||currentAxis+"：根据当前资源重新决策"};}
    return tuning(s,m)||{type:"end",axis:currentAxis,reason:"没有可支付且有收益的动作"};
  }
  Object.assign(T,{choose,axis,candidates,cardScore,tuningPlan:tuning,setupPlan,techniqueScore,techniquePlan,generatedChoices,
    chooseGenerated:(options,s,m,origin)=>generatedChoices(options,s,m,origin)[0]?.id});
})(globalThis.TCG);

globalThis.TCG.registerStrategy("default", globalThis.TCG.choose);

globalThis.TCG.selectStrategy(globalThis.TCG.defaultStrategy);
