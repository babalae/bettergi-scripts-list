/* Bounded, deterministic planning for the fixed team. No network or LLM.
 * Simulations are planning estimates, NEVER native state or action evidence. */
(function(root){
  "use strict";
  const T=root.TCG,copy=x=>JSON.parse(JSON.stringify(x));
  const legacyChoose=T.choose;
  const skillAction=a=>a.type==="skill" || a.type==="card" && ["talent","penance","wedge"].includes(a.id);
  function cardSkill(a,s){
    if(a.type==="skill")return a;
    if(a.type!=="card")return null; // Burning a combat card is not casting it.
    return a.id==="talent"?{who:1,skill:"E"}:
      ["penance","wedge"].includes(a.id)?{who:2,skill:"E"}:null;
  }
  function actionCost(a,s,m){return a.type==="skill"?T.skillCost(a.who,a.skill,m,s):
    a.type==="switch"?{any:m.freeSwitch?0:1}:a.type==="card"?T.byId[a.id].cost:{};}
  function eligible(s,m){
    const out=[],a=s.active,c=s.characters[a],n=T.total(s.dice);
    const add=x=>{if(!(m.uncertainActions||[]).includes(T.actionKey(x)))out.push(x);};
    for(const skill of ["Q","E","NA"])if(T.skillLegal(s,{who:a,skill},m))add({type:"skill",who:a,skill});
    for(let target=0;target<3;target++)if(target!==a && T.alive(s.characters[target]) &&
      T.payment(s.dice,{any:m.freeSwitch?0:1},T.team[target].element)) {
      if(["Q","E","NA"].some(skill=>T.followupReachable(s,m,{who:target,skill})))add({type:"switch",target});
    }
    for(const h of s.hand){
      const def=T.byId[h.id];if(!def || !T.payment(s.dice,def.cost,T.team[a].element))continue;
      const action={type:"card",id:h.id,index:h.index,target:null};
      if(h.id==="woven" && n<16)add(action);
      else if(h.id==="companion"){
        const goal=T.actionRerollGoal(s,m),pay=T.payment(s.dice,def.cost,T.team[a].element);
        // Repair the intended skill's elemental shortfall (including switch
        // budget); do not exchange the already payable next wearer's dice.
        if(goal && !goal.payable && goal.needed>0 &&
          (pay.remaining[goal.element]||0)+(pay.remaining.Omni||0)+2>
          (s.dice[goal.element]||0)+(s.dice.Omni||0))add(action);
      }
      else if(h.id==="voltage" && s.characters.some((x,i)=>T.alive(x)&&x.energy<T.team[i].maxEnergy))add(action);
      else if(h.id==="stars" && c.energy<T.team[a].maxEnergy && !c.frozen)add(action);
      else if(h.id==="calx" && c.energy<T.team[a].maxEnergy && !c.frozen &&
        s.characters.some((x,i)=>i!==a&&T.alive(x)&&x.energy>0) && (m.raidenBurst||m.defeated[0]))add(action);
      else if(h.id==="shift" && !m.freeSwitch && s.characters.some((x,i)=>i!==a&&T.alive(x)))add(action);
      else if(h.id==="fast" && !m.fastSwitch && s.characters.some((x,i)=>i!==a&&T.alive(x)))add(action);
      else if(h.id==="lost" && m.defeatRound===m.round && m.lostUsedRound!==m.round && n<16)add(action);
      else if(h.id==="edict" && !m.legendUsed){
        for(let target=0;target<3;target++)if(T.alive(s.characters[target]) &&
          (s.characters[target].hp<=T.team[target].maxHp-2 || s.characters[target].frozen ||
           target===a && m.immuneUntil[target]<m.round))add({...action,target});
      } else if(def.type==="support" && m.thundergrassSupport!==h.id &&
        (!m.thundergrassSupport || m.thundergrassSupport==="thundergrass"))add(action);
      else if(def.type==="food" && !m.food[a] && !c.frozen){
        if(["sweet","hashbrown"].includes(h.id) && c.hp<T.team[a].maxHp || h.id==="lotus" && c.hp<=5 ||
          h.id==="smoked" && m.normalDiscount[a]===0 || h.id==="mint" && a===2 && m.keqingInfusedRound+1>=m.round)
          add({...action,target:a});
      } else if(h.id==="exile"){
        if(m.artifactKinds[a]!=="exile" && !c.frozen && exileSetup(s,m))add({...action,target:a});
      } else if(h.id==="gambler" && !c.frozen && m.artifactKinds[a]!=="gambler" && T.gamblerRemaining(m,a)>0) {
        const pay=T.payment(s.dice,def.cost,T.team[a].element),after={...s,dice:pay.remaining};
        if(["Q","E","NA"].some(skill=>T.skillLegal(after,{who:a,skill},m)&&
          knownDefeats(after,m,a,skill)>0))add({...action,target:a});
      }
      else if(def.type==="weapon" && def.weaponTarget===a && !m.weapons[a] && !c.frozen)add({...action,target:a});
      else if(h.id==="talent" && a===1 && !m.talent && !c.frozen)add({...action,target:1});
      else if(h.id==="penance" && a===2 && !m.penance && !c.frozen)add({...action,target:2});
      else if(h.id==="wedge" && T.alive(s.characters[2]) && !s.characters[2].frozen && a!==2)add({...action,target:2});
      else if(h.id==="draw" && s.hand.length<=8)add(action);
      else if(h.id==="toss" && n>0){
        const goal=T.actionRerollGoal(s,m);
        if(goal && goal.bad>0 && goal.needed>0 && !goal.payable)add(action);
      }
    }
    // Only tune toward a WHOLE reachable action, including the actual fee.
    for(const skill of ["Q","E","NA"]){const p=T.tuningPlan(s,m,{who:a,skill});
      if(p)add({type:"tune",index:p.card.index,id:p.card.id,element:T.team[a].element});}
    return out;
  }
  function exileSetup(s,m) {
    const who=s.active,c=s.characters[who];
    if(m.exileUsedRound[who]===m.round)return false;
    // Raiden's own +2 resolves first; capped/full standby gains are worthless.
    const ownGain=who===0?2:0;
    if(!s.characters.some((x,i)=>i!==who&&T.alive(x)&&x.energy+ownGain<T.team[i].maxEnergy))return false;
    const pay=T.payment(s.dice,T.byId.exile.cost,T.team[who].element);if(!pay)return false;
    if(c.energy===T.team[who].maxEnergy)return !!T.payment(pay.remaining,T.skillCost(who,"Q",m,s),T.team[who].element);
    if(c.energy!==T.team[who].maxEnergy-1)return false;
    return ["NA","E"].some(skill=>{
      const next=T.payment(pay.remaining,T.skillCost(who,skill,m,s),T.team[who].element);
      return next && T.payment(next.remaining,T.skillCost(who,"Q",m,s),T.team[who].element);
    });
  }
  function damageEstimate(s,m,who,skill){
    const enemies=s.enemies||[],target=enemies.find(e=>e.active===true && T.alive(e));
    const infused=who===2&&m.keqingInfusedRound+(m.penance?2:1)>=m.round;
    let direct=skill==="NA"?2:who===0?(skill==="E"?0:3):skill==="E"?3:who===1?2:4;
    const elemental=skill!=="NA"&&!(who===0&&skill==="E") || infused;
    if(direct>0 && m.weapons[who])direct++; // Weapons also buff physical NA, not Raiden E's zero direct hit.
    if(who===2&&elemental&&m.penance&&infused)direct++;
    if(skill==="Q" && m.eyeRound+2>=m.round)direct++;
    const element=T.team[who].element;
    const reaction=elemental && target?.aura?.includes(element==="Electro"?"Dendro":"Electro");
    if(reaction)direct++;
    if(elemental && s.quicken?.known && s.quicken.charges>0)direct++;
    const splash=who===2&&skill==="Q"?3*enemies.filter(e=>T.alive(e)&&e!==target).length:0;
    return {direct,splash,reaction,elemental,target};
  }
  function knownDefeats(s,m,who,skill) {
    if(T.enemyCount(s)===null)return 0;
    const d=damageEstimate(s,m,who,skill);if(!d.target)return 0;
    return (d.target.hp<=d.direct?1:0)+(d.splash?s.enemies.filter(e=>e!==d.target&&T.alive(e)&&e.hp<=3).length:0);
  }
  function projected(s,m,a){
    const next=copy(s),mem=copy(m),cost=actionCost(a,s,m),pay=T.payment(s.dice,cost,T.team[s.active].element);
    if(!pay)return null;
    next.dice=pay.remaining;let benefit=0,combat=false,leaf=false;
    const active=next.characters[s.active];
    function gain(who,amount){const x=next.characters[who];if(T.alive(x))x.energy=Math.min(T.team[who].maxEnergy,x.energy+amount);}
    if(a.type==="switch") {
      next.active=a.target;benefit-=.7;const target=next.characters[a.target];
      // A low-HP wearer is not a reward for EVERY switch. Only actual relief
      // qualifies; two 1-HP characters must not bounce back and forth.
      if(active.frozen&&!target.frozen)benefit+=1.3;
      else if(active.hp<=3)benefit+=Math.min(1.3,Math.max(0,target.hp-active.hp)*.25);
    }
    else if(a.type==="tune") {
      const bad=T.diceOrder.find(e=>e!==a.element&&e!=="Omni"&&(next.dice[e]||0)>0);if(!bad)return null;
      next.dice[bad]--;next.dice[a.element]=(next.dice[a.element]||0)+1;
      const value={woven:1.9,voltage:1.4,edict:1.3,exile:1.1,penance:1.2,wedge:.8,shatterbolt:1.8,sharpkernel:1.5};
      benefit-=.3+(value[a.id]||.35);
    } else if(a.type==="card") {
      if(a.id==="woven")next.dice.Electro=(next.dice.Electro||0)+1;
      else if(a.id==="companion")next.dice.Omni=(next.dice.Omni||0)+2;
      else if(a.id==="voltage") {gain(s.active,1);const target=next.characters.findIndex((x,i)=>i!==s.active&&T.alive(x)&&x.energy<T.team[i].maxEnergy);if(target>=0)gain(target,1);}
      else if(a.id==="stars")gain(s.active,1);
      else if(a.id==="calx") {for(let i=0;i<3;i++)if(i!==s.active&&T.alive(next.characters[i])&&next.characters[i].energy>0){next.characters[i].energy--;gain(s.active,1);}}
      else if(a.id==="lost"){next.dice.Omni=(next.dice.Omni||0)+1;gain(s.active,1);benefit+=1;}
      else if(["sweet","hashbrown","edict"].includes(a.id)){
        const c=next.characters[a.target],heal=Math.min(T.team[a.target].maxHp-c.hp,a.id==="sweet"?1:2);
        c.hp+=heal;benefit+=heal*(s.characters[a.target].hp<=3?1.1:.45);
        // Protection is not a cure for an existing Frozen status.
        if(a.id==="edict")benefit+=a.target===s.active?1.2:.3;
      } else if(a.id==="lotus")benefit+=active.hp<=3?3:1.5;
      else if(a.id==="fast")benefit+=.25;
      else if(a.id==="exile" || a.id==="gambler")benefit-=.2;
      else if(T.byId[a.id].type==="support")benefit+=a.id==="shatterbolt"?1.2:.8;
      else if(a.id==="draw"){benefit+=s.hand.length<=2?2.1:1.1;leaf=true;}
      else if(a.id==="toss"){
        const bad=T.actionRerollGoal(s,m)?.bad||0;
        const scarce=T.burnableHand(s,m).filter(h=>!["toss","lost","woven"].includes(h.id)).length<2;
        benefit+=bad*(1-Math.pow(6/8,2))*(scarce?2:1.2);leaf=true;
      }
    }
    if(a.type==="card" || a.type==="tune")next.hand=T.indexedHand(next.hand.filter((_,i)=>i!==a.index));
    const cast=cardSkill(a,s);
    if(cast){
      combat=true;const who=cast.who,skill=cast.skill;next.active=who;
      const d=damageEstimate(s,m,who,skill);benefit+=d.direct*.95+d.splash*.6;
      if(skill==="Q")benefit+=1.4; // Convert stored energy into pressure, not hoard it indefinitely.
      if(d.target){
        const target=next.enemies[s.enemies.indexOf(d.target)];
        if(d.direct>=target.hp){benefit+=3;target.hp=0;target.dead=true;target.active=false;}
        else target.hp-=d.direct;
        if(d.splash)for(let i=0;i<next.enemies.length;i++)if(next.enemies[i]!==target&&T.alive(next.enemies[i])){
          if(next.enemies[i].hp<=3)benefit+=2;next.enemies[i].hp=Math.max(0,next.enemies[i].hp-3);next.enemies[i].dead=next.enemies[i].hp===0;
        }
      }
      if(m.artifactKinds[who]==="gambler") {
        const triggers=Math.min(T.gamblerRemaining(m,who),knownDefeats(s,m,who,skill));
        next.dice.Omni=Math.min(16-T.total(next.dice)+(next.dice.Omni||0),(next.dice.Omni||0)+2*triggers);
      }
      if(who===0 && skill==="E")benefit+=m.eyeRound+2<m.round?3.8:.4;
      if(who===1 && skill==="Q")benefit+=m.dendroRound+1<m.round?2.1:.7;
      const wanted=T.intent(s,m);
      if(wanted?.who===who && wanted.skill===skill)benefit+=1.3;
      if(skill==="Q"){
        next.characters[who].energy=0;
        if(who===0)for(let i=0;i<3;i++)if(i!==who)gain(i,2);
        if(m.artifactKinds[who]==="exile"&&m.exileUsedRound[who]!==m.round)for(let i=0;i<3;i++)if(i!==who) {
          const old=next.characters[i].energy;gain(i,1);
          if(next.characters[i].energy>old)benefit+=.3+(next.characters[i].energy===T.team[i].maxEnergy?.8:0);
        }
      } else gain(who,1);
      if(who===2&&skill==="E"){
        const has=next.hand.some(h=>h.id==="wedge");
        if(has||a.id==="wedge")next.hand=T.indexedHand(next.hand.filter(h=>h.id!=="wedge"));
        else if(next.hand.length<10)next.hand.push({index:next.hand.length,id:"wedge",name:T.byId.wedge.name,supported:true});
      }
      if(s.characters[who].hp<=3)benefit-=1.4; // no invented enemy damage or certain survival.
      if(d.elemental&&next.quicken?.known&&next.quicken.charges>0)next.quicken.charges--;
      if(d.reaction)next.quicken={known:true,charges:2};
    }
    T.commit(mem,a,s,next);
    if(a.type!=="probe")mem.costEvidence=null; // one-board evidence never predicts future reductions.
    return {state:next,memory:mem,benefit,combat,leaf,
      passesTurn:combat || a.type==="switch"&&!m.fastSwitch};
  }
  function evaluation(s,m,baseline){
    let value=0;
    for(let i=0;i<3;i++)if(T.alive(s.characters[i])){
      value+=s.characters[i].energy*(i===0?.45:.35);
      if(s.characters[i].energy===T.team[i].maxEnergy)value+=.2;
    }
    value+=T.total(s.dice)*.16+(s.dice.Omni||0)*.15+(s.dice.Electro||0)*.08+(s.dice.Dendro||0)*.05;
    value+=m.freeSwitch?.45:0;
    for(let i=0;i<3;i++)if(T.alive(s.characters[i])&&!s.characters[i].frozen) {
      if(m.artifactKinds[i]==="exile" && s.characters.some((c,j)=>j!==i&&T.alive(c)&&c.energy<T.team[j].maxEnergy))value+=.5;
    }
    return value-baseline;
  }
  function plan(s,m,options={}){
    const depth=options.depth||6,width=options.width||20;
    const baseline=evaluation(s,m,0);let frontier=[{state:s,memory:m,score:0,path:[],casts:0,turns:0}],best=null,expanded=0;
    for(let step=0;step<depth;step++){
      const next=[],seen=new Map();
      for(const node of frontier)for(const a of eligible(node.state,node.memory)){
        // No bounce cycle, repeated useless protection, or future unknown draw.
        if(a.type==="switch" && node.path[node.path.length-1]?.type==="switch")continue;
        const projectedState=projected(node.state,node.memory,a);if(!projectedState)continue;expanded++;
        const child={...projectedState,path:node.path.concat(a),casts:node.casts+(projectedState.combat?1:0),
          turns:node.turns+(projectedState.passesTurn?1:0),
          // Fast cards/tuning do not give the opponent a response opportunity.
          // Keep a small input cost, but discount future value by real turn passes.
          score:node.score+projectedState.benefit*Math.pow(.9,node.turns)-.06};
        child.value=child.score+evaluation(child.state,child.memory,baseline);
        const signature=T.boardKey(child.state)+JSON.stringify([child.memory.freeSwitch,child.memory.fastSwitch,
          child.memory.thundergrassSupport,child.memory.artifactKinds,child.memory.gamblerUsed,child.memory.exileUsedRound,
          child.memory.weapons,child.memory.penance,child.memory.food]);
        if(!seen.has(signature)||seen.get(signature).value<child.value)seen.set(signature,child);
        if((child.casts>0||child.path[0].type==="card") && (!best||child.value>best.value))best=child;
      }
      next.push(...seen.values());next.sort((x,y)=>y.value-x.value);
      frontier=next.filter(x=>!x.leaf).slice(0,width);if(!frontier.length)break;
    }
    if(!best || best.value<=.08)return {action:null,expanded};
    return {action:best.path[0],sequence:best.path,value:best.value,expanded};
  }
  function needProbe(s,m){
    if(!["shatterbolt","sharpkernel"].includes(m.thundergrassSupport) || s.quicken?.known)return null;
    const skill=m.thundergrassSupport==="shatterbolt"?"Q":"E",who=s.active;
    if(s.characters[who].frozen || skill==="Q"&&s.characters[who].energy!==T.team[who].maxEnergy)return null;
    const key=T.boardKey(s)+":"+skill;
    if((m.probeKeys||[]).includes(key) || m.costEvidence?.key===T.boardKey(s))return null;
    const nominal=T.size(T.skillCost(who,skill,m)),minimum=nominal-(skill==="Q"?2:1);
    // Query at the meaningful window; not every decision or every hand read.
    if(T.total(s.dice)>=minimum && T.total(s.dice)<nominal)return {type:"probe",who,skill,key,
      reason:"雷草减费可能解锁技能，先读取当前真实技能费用，不确认施放"};
    return null;
  }
  T.strategyEligible=eligible;T.projectedAction=projected;T.plan=plan;T.actionCost=actionCost;T.damageEstimate=damageEstimate;
  T.choose=function(s,m){
    if(!T.legalState(s))return legacyChoose(s,m);
    const probe=needProbe(s,m);if(probe)return probe;
    const p=plan(s,m);
    if(p.action)return {...p.action,score:Math.round(p.value*10),planning:{depth:6,expanded:p.expanded,
      value:Number(p.value.toFixed(3)),sequence:p.sequence.map(a=>T.actionKey(a))},
      reason:"比较出牌/调和/切人/技能组合，选择当前可核实收益最高的首步"};
    return legacyChoose(s,m);
  };
  T.blessingChoice=function(s,m){
    if(!s || !Array.isArray(s.characters))return "shatterbolt";
    const living=s.characters.map((c,i)=>T.alive(c)?i:-1).filter(i=>i>=0);
    if(!living.length)return "shatterbolt";
    const bursts=living.reduce((n,i)=>n+(s.characters[i].energy===T.team[i].maxEnergy?3:
      s.characters[i].energy>=T.team[i].maxEnergy-1?1.5:.4),0)+(living.includes(0)?1.5:0);
    const skills=living.reduce((n,i)=>n+(i===1&&s.characters[i].energy<2?2:.7),0);
    return skills>bursts && living.length===1?"sharpkernel":"shatterbolt";
  };
})(globalThis);
