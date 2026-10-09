"use strict";
// Synthetic UI/host replay, NOT screenshot recognition or a complete game simulator.
// The real main/core/adapter are loaded unchanged; only host observations/inputs are faked.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
module.exports = async function replay(base, variant = 0, options = {}) {
  const events = [], inputs = [], messages = [];
  let time = 0, frames = 0, disposed = 0, crops = 0, croppedDisposed = 0, scaled = 0, scaledDisposed = 0;
  const epoch = Date.UTC(2026,9,8,8,36,54);
  class ReplayDate extends Date {
    constructor(...args) { super(...(args.length ? args : [epoch + time])); }
    static now() { return epoch + time; }
  }
  const world = { phase: "opening", turn: "none", active: 0, round: 0,
    characters: [{hp:8,energy:0},{hp:11,energy:0},{hp:10,energy:0}],
    enemies: [4,8,4], hand: ["woven","voltage","sweet","shift","sword"],
    dice: {}, title: null, titleReads: 0, transition: null, ticks: 0,
    rollItems: [], selectedDice: new Set(), pendingSkill: null, pendingSwitch: false,
    pendingEnd: false, mouse: [0,0], dragging: null, effects: [], handFan:false, togglesClosed:0 };
  if([31,35].includes(variant))world.hand=["toss","exile","exile","penance","talent"];
  if([32,37].includes(variant))world.hand=["exile","sword","sweet","shift","提米"];
  if([33,36].includes(variant)){world.hand=["gambler","sweet","shift","sword","提米"];world.enemies=[2,8,40];}
  if(variant===38){world.hand=["tassel","sweet","shift","提米","提米"];world.enemies=[8,8,40];}
  if(variant===34){world.hand=["gambler","sweet","shift","sword","提米"];world.enemies=[2,8,40,10];}
  if(variant===8 || variant===9)world.hand.pop(); // Reach 1-4-card scans in the production main loop.
  const rollFirst=[13,15].includes(variant),actionEntry=[16,17,21,22,23,24,25,27].includes(variant),
    rejectedEntry=variant>=20&&variant<=25;
  if(variant>=13)world.characters[0].hp=10;
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(base,"lib/core.js"),"utf8"),context);
  // Loaded core is used for costs only, not to alter the production decision methods.
  const T = context.TCG;
  const names = ["雷电将军","柯莱","刻晴"];
  function input(x,y) {
    if(variant===17 && !world.entryUserReached) {
      assert.equal(world.phase,"board");assert.equal(world.turn,"user","action-board enemy-first entry must not input before actual user turn");
      world.entryUserReached=true;
    }
    assert.ok(Number.isInteger(x)&&Number.isInteger(y),"host requires Int32 coordinates");
    assert.ok(x>=0&&x<1920&&y>=0&&y<1080,"host requires native bounds");
    inputs.push([x,y]);
  }
  function name(id) { return T.byId[id]?.name || id; }
  function setTitle(type,id) { world.title={type,id};world.titleReads=0; }
  function readTitle() {
    if(!world.title)return "";
    const {type,id}=world.title;
    const reading=world.titleReads++;
    if(type==="character"&&variant===4&&id===0&&world.phase!=="pick"&&world.effects.length===0)return "刻睛";
    if(type==="character"&&variant===3&&id===2)return "刻静";
    if(type==="character"&&id===2) {
      if(variant===1&&reading===0)return "";
      return reading%2 ? "刻晴" : "刻睛";
    }
    if(type==="card"&&variant===2&&reading===0)return "";
    return type==="character"?names[id]:name(id);
  }
  function transition(phase,turn,ticks=4) {
    world.phase="unknown";world.turn="none";world.transition={phase,turn};world.ticks=ticks;
  }
  function nextRoll() {
    const types=world.round===0?Array(5).fill("Electro").concat(Array(3).fill("Pyro")):
      Array(5).fill("Electro").concat(Array(3).fill("Dendro"));
    world.rollItems=types.map((element,i)=>({element,x:606+224*(i%4),y:386+246*Math.floor(i/4),width:41,height:41}));
    world.selectedDice.clear();world.phase="roll";world.turn="none";world.handFan=false;
  }
  if([14,28].includes(variant))world.phase="pick";
  if([15,18,26].includes(variant))nextRoll();
  if(actionEntry || [19,29].includes(variant) || rejectedEntry) {
    world.round=1;world.dice={Electro:5,Pyro:3};world.hand.push("companion","提米");
    world.phase=[19,29].includes(variant)?"pick":"board";world.turn=[19,29].includes(variant)?"none":variant===17?"enemy":"user";world.ticks=20;
    if(variant===21)world.characters[0].hp=9;
    if(variant===22)world.characters[0].energy=1;
    if(variant===23)world.dice={Electro:4,Pyro:3};
    if(variant===24)world.characters[0].frozen=true;
    if(variant===25)world.dice={};
    if(variant===27)world.hand.pop();
  }
  if([28,29].includes(variant)){world.selectedHero=0;setTitle("character",0);}
  function spend(cost) {
    const payment=T.payment(world.dice,cost,T.team[world.active].element);
    assert.ok(payment,"simulated execution must be payable");world.dice={...payment.remaining};
  }
  function combatFinished() {
    world.phase="board";world.turn="enemy";world.ticks=4;world.title=null;world.handFan=false;
  }
  function useCard(index,target) {
    const id=world.hand[index],card=T.byId[id];assert.ok(card,"never execute an unsupported card");
    spend(card.cost);world.hand.splice(index,1);world.title=null;world.handFan=false;
    if(variant===6&&id==="woven") {
      // Synthetic external same-count reorder. The next exact target check must
      // invalidate the projected cache BEFORE another drag, then resynchronize.
      [world.hand[0],world.hand[1]]=[world.hand[1],world.hand[0]];
    }
    world.effects.push({type:"card",id,target});
    if(id==="woven")world.dice.Electro=(world.dice.Electro||0)+1;
    else if(id==="companion")world.dice.Omni=(world.dice.Omni||0)+2;
    else if(id==="voltage") {
      world.characters[world.active].energy=Math.min(T.team[world.active].maxEnergy,world.characters[world.active].energy+1);
      const standby=world.characters.findIndex((c,i)=>i!==world.active&&c.energy<T.team[i].maxEnergy);
      if(standby>=0)world.characters[standby].energy++;
    }
    else if(id==="sweet")world.characters[target].hp=Math.min(T.team[target].maxHp,world.characters[target].hp+1);
    else if(id==="shift")world.freeSwitch=true;
    else if(id==="exile" || id==="gambler") {
      assert.equal(target,world.active,"artifact must land on the intended active character");
      if(!world.artifacts)world.artifacts=[null,null,null];world.artifacts[target]=id;
    }
    else if(id==="toss") {
      world.actionReroll={remaining:2,confirms:0,pending:null,lag:0,selected:new Set(),dieClicks:[],handScans:events.filter(e=>e.event==="hand-scan").length,round:world.round};
      const types=Object.entries(world.dice).flatMap(([element,count])=>Array(count).fill(element));
      world.rollItems=types.map((element,i)=>({element,x:713+230*(i%3),y:387+245*Math.floor(i/3),width:40,height:40}));
      world.phase="roll";world.turn="none";
    }
    else if(card.type==="weapon")assert.equal(target,card.weaponTarget);
    else if(["penance","talent"].includes(id)) {
      assert.equal(target,id==="penance"?2:1);assert.equal(world.active,target);
      skill("E",true);return;
    }
    else if(id==="wedge") {world.active=2;world.characters[2].energy=Math.min(3,world.characters[2].energy+1);combatFinished();}
    else if(id==="shatterbolt" || id==="sharpkernel")world.blessing=id;
    else throw new Error("replay effect not implemented: "+id);
    if(variant===7&&id==="sweet") {
      // Generic state disagreement: an external draw and die, no named support
      // rule. Full stable observation must replace both prediction baselines.
      world.hand.unshift("额外行动牌");world.dice.Electro=(world.dice.Electro||0)+1;
    }
  }
  function skill(skillName,paid=false) {
    const who=world.active;
    if(!paid)spend(skillName==="NA"?{element:T.team[who].element,n:1,any:2}:
      {element:T.team[who].element,n:skillName==="Q"&&who===2?4:3});
    const c=world.characters[who];
    if(skillName==="Q") {
      assert.equal(c.energy,T.team[who].maxEnergy);c.energy=0;
      if(who===0)for(let i=1;i<3;i++)world.characters[i].energy=Math.min(T.team[i].maxEnergy,world.characters[i].energy+2);
      if(world.artifacts?.[who]==="exile" && world.exileRound!==world.round) {
        const old=world.characters.map(c=>c.energy);world.exileRound=world.round;
        for(let i=0;i<3;i++)if(i!==who)world.characters[i].energy=Math.min(T.team[i].maxEnergy,world.characters[i].energy+1);
        world.effects.push({type:"artifact-trigger",id:"exile",who,before:old,after:world.characters.map(c=>c.energy)});
      }
    } else c.energy=Math.min(T.team[who].maxEnergy,c.energy+1);
    const enemy=world.enemies.findIndex(hp=>hp>0);
    if(enemy>=0)world.enemies[enemy]=Math.max(0,world.enemies[enemy]-(skillName==="NA"?2:3));
    if(enemy>=0 && world.enemies[enemy]===0 && world.artifacts?.[who]==="gambler" && (world.gamblerUsed||0)<3) {
      world.gamblerUsed=(world.gamblerUsed||0)+1;world.dice.Omni=(world.dice.Omni||0)+2;
      world.effects.push({type:"artifact-trigger",id:"gambler",who,refund:2,used:world.gamblerUsed});
    }
    if([31,35].includes(variant) && who===0 && skillName==="Q") {
      const n=T.total(world.dice);assert.equal(n,5,"reproduce the native five-dice failure");world.dice={Dendro:1,Cryo:2,Anemo:2};
      // Independent synthetic opponent hand-discard for the scarce-hand case.
      // Keep the original rich-hand fixture separately (35): deterministic
      // tuning is now preferred there, and must not be forced into random rolls.
      if(variant===31)world.hand=["toss"];
    }
    if(who===2&&skillName==="E") {
      const wedge=world.hand.indexOf("wedge");if(wedge>=0)world.hand.splice(wedge,1);else if(world.hand.length<10)world.hand.push("wedge");
    }
    world.effects.push({type:"skill",who,skill:skillName});
    // Synthetic checkpoint only; this is NOT a proof of winning a full real match.
    if(variant===39 && world.nativeTalentCheckpoint && world.enemies.every(hp=>hp===0)) {
      world.phase="result";world.turn="none";world.title=null;
    } else if(who===2&&skillName==="Q") {world.phase="result";world.turn="none";world.title=null;}
    else if([10,12].includes(variant) && who===1 && skillName==="Q" && !world.choiceDone) {
      world.phase="choice";world.turn="none";world.title=null;world.handFan=false;
    } else combatFinished();
  }
  const api={Date:ReplayDate,settings:{mode:variant===26?"识别诊断":"自动试验",enemyCount:"3",mulligan:"优先充能与调骰",maxMinutes:"20",
    actionEntry:actionEntry?"确认新开局未行动":"禁止从行动页启动"},
    log:{info:text=>messages.push({level:"info",text}),warn:text=>messages.push({level:"warn",text}),error:text=>messages.push({level:"error",text})},
    setGameMetrics:(w,h)=>assert.deepEqual([w,h],[1920,1080]),
    file:{createDirectory:()=>true,readTextSync:p=>fs.readFileSync(path.join(base,p),"utf8"),
      writeTextSync:(p,text)=>{assert.equal(path.extname(p),".log");const entry=JSON.parse(text);events.push(entry);
        if(variant===11 && entry.event==="confirmed" && entry.data.action.type==="skill" && entry.data.action.who===0 &&
            entry.data.action.skill==="Q" && !world.executionRaceInjected){world.executionRaceFrames=2;world.executionRaceInjected=true;}
        return true;},
      readImageMatSync:p=>({p,empty:()=>false,dispose:()=>{}}),writeImageSync:()=>true},
    RecognitionObject:{Ocr:(...roi)=>({roi}),TemplateMatch:(mat,...roi)=>({mat,roi})},
    OpenCvSharp:{OpenCvSharp:{Size:class Size {constructor(width,height){assert.ok(Number.isInteger(width)&&Number.isInteger(height));this.width=width;this.height=height;}}}},
    ImageRegion:class ImageRegion {
      constructor(mat,x,y){assert.deepEqual([x,y],[0,0]);this.mat=mat;}
      Find(ro){assert.equal(this.mat.released,false);
        if(this.mat.roi[2]===36){assert.deepEqual(ro.roi,[0,0,144,140]);
          const [x,y]=this.mat.roi;assert.equal(y,1010);
          assert.equal(x,world.pendingSkill==="Q"?1780:1698);
          const text=String(world.pendingSkill==="Q"&&world.active===2?4:3);
          return {text,isExist:()=>true};}
        assert.deepEqual(ro.roi,[0,0,132,120]);
        const [x,y]=this.mat.roi,who=[654,864,1074].indexOf(x);
        let text="";
        if([600,640].includes(y)){assert.ok(who>=0);if(y===(who===world.active?600:640))text=String(world.characters[who].hp);}
        if([170,212].includes(y)) {
          const survivors=world.enemies.filter(hp=>hp>0),count=survivors.length;
          const xs=count===4?[549,759,969,1179]:count===1?[864]:count===2?[759,970]:[654,864,1074];
          const i=xs.indexOf(x);
          if(i>=0 && y===(i===0?212:170))text=String(survivors[i]);
        }
        return {text,isExist:()=>!!text};}
      dispose(){this.mat.dispose();}
    },
    sleep:async ms=>{assert.ok(Number.isInteger(ms)&&ms>=0);time+=ms;assert.ok(time<1200000,"bounded replay");},
    moveMouseTo:(x,y)=>{input(x,y);world.mouse=[x,y];},
    leftButtonDown:()=>{assert.equal(world.dragging,null);world.dragging=world.title?.type==="card"?{index:world.hand.indexOf(world.title.id)}:null;assert.ok(world.dragging);},
    leftButtonUp:()=>{
      assert.ok(world.dragging);const {index}=world.dragging;world.dragging=null;
      const [x,y]=world.mouse;
      if(x===1867&&y===518) {
        assert.ok(world.hand[index],"tuning must select an existing identified card");
        world.pendingTune=index;world.title=null;return;
      }
      const target=y===720?[750,960,1175].indexOf(x):null;
      if(variant===39 && ["talent","penance"].includes(world.hand[index])) {
        world.pendingCard={index,target,id:world.hand[index],selected:true,talent:true};
        world.title=null;world.handFan=false;world.phase="unknown";world.turn="none";return;
      }
      if([36,37,38].includes(variant) && ["artifact","weapon"].includes(T.byId[world.hand[index]]?.type)) {
        world.pendingCard={index,target,id:world.hand[index],selected:false};
        world.title=null;world.handFan=false;world.phase="unknown";world.turn="none";return;
      }
      useCard(index,target);
    },
    click:(x,y)=>{
      input(x,y);
      if(world.pendingCard) {
        const pending=world.pendingCard;
        if(y===720 && [750,960,1175].includes(x)) {
          assert.equal([750,960,1175].indexOf(x),pending.target,"equipment must select the planned target");
          assert.equal(pending.selected,false,"equipment target must not be clicked twice");pending.selected=true;return;
        }
        assert.deepEqual([x,y],[pending.talent?977:975,948],"card must confirm its observed central button, not a skill");
        assert.equal(pending.selected,true,"equipment confirmation requires actual selection");
        world.pendingCard=null;world.phase="board";world.turn="user";useCard(pending.index,pending.target);return;
      }
      if(x===1190&&y===545){world.title=null;world.handFan=false;return;}
      if(x===967&&y===1041){if(world.handFan)world.togglesClosed++;world.handFan=!world.handFan;world.title=null;return;}
      if(world.phase==="opening"&&x===975&&y===948){if(rollFirst)nextRoll();else if(variant===30)transition("pick","none",26);else world.phase="pick";return;}
      // Intentionally inert right-side control: only official same-card input
      // selects/confirms. Already selected cards confirm on the first input.
      if(world.phase==="pick"&&x===1824&&y===960)return;
      if(world.phase==="pick"&&y===720&&[750,960,1175].includes(x)) {
        const who=[750,960,1175].indexOf(x);
        if(world.selectedHero===who){world.title=null;world.active=who;
          if(world.round>0)transition("board","user",9);else{nextRoll();transition("roll","none",variant?9:4);}}
        else{world.selectedHero=who;setTitle("character",who);}return;
      }
      if(world.phase==="choice"&&y>=535&&y<=550&&(x>=660&&x<=680||x>=1240&&x<=1260)) {
        const id=x<900?"shatterbolt":"sharpkernel";
        if(variant===12){assert.equal(world.choiceSelected,undefined,"never repeat selection");world.choiceSelected=id;return;}
        world.hand.unshift(id);world.choiceDone=true;
        world.effects.push({type:"generated-choice",id});transition("board","enemy",5);return;
      }
      if(world.phase==="choice"&&variant===12&&x===975&&y===948){
        assert.ok(world.choiceSelected,"confirm requires selected card");const id=world.choiceSelected;
        world.hand.unshift(id);world.choiceDone=true;world.effects.push({type:"generated-choice",id});transition("board","enemy",5);return;
      }
      if(y===720&&[750,960,1175].includes(x)){const who=[750,960,1175].indexOf(x);setTitle("character",who);world.handFan=false;world.selectedHero=who;return;}
      if(world.phase==="roll") {
        if(world.actionReroll) {
          const r=world.actionReroll;
          if(x===975&&y===948) {
            assert.equal(events.filter(e=>e.event==="hand-scan").length,r.handScans,"no hand inspection during either reroll");
            assert.equal(world.round,r.round,"action reroll must not start a new round or draw cards");
            assert.equal(r.pending,null,"never confirm a stale counter twice");r.confirms++;
            for(const i of r.selected)world.rollItems[i].element="Dendro";
            r.selected.clear();r.pending=r.remaining-1;r.lag=4;return;
          }
          const i=world.rollItems.findIndex(d=>Math.round(d.x+d.width/2)===x&&Math.round(d.y+d.height/2)===y);
          assert.ok(i>=0);assert.equal(r.selected.has(i),false,"never toggle selected dice off");
          assert.notEqual(world.rollItems[i].element,"Dendro","keep Collei dice after Raiden Q");
          assert.notEqual(world.rollItems[i].element,"Omni");r.selected.add(i);r.dieClicks.push([r.remaining,i]);return;
        }
        if(x===975&&y===948) {
          world.dice={};for(let i=0;i<world.rollItems.length;i++){
            const element=world.selectedDice.has(i)?(variant===32 && world.round===1?"Omni":"Electro"):world.rollItems[i].element;
            world.dice[element]=(world.dice[element]||0)+1;
          }
          world.round++;
          const drawn=world.round===1?([31,35].includes(variant)?["shift","sweet"]:["companion","提米"]):["甜甜花酿鸡","提米"];
          if(variant===5&&world.round>1)world.hand=[drawn[0],...world.hand,drawn[1]];
          else world.hand.push(...drawn);
          // The first string is a supported title only when normalized by observedCard;
          // model hand identities must remain explicit IDs for effect execution.
          world.hand=world.hand.map(id=>id==="甜甜花酿鸡"?"sweet":id);
          world.title=null;transition(rollFirst&&world.round===1?"pick":"board",rollFirst&&world.round===1?"none":"user",variant?12:4);return;
        }
        const i=world.rollItems.findIndex(d=>Math.round(d.x+d.width/2)===x&&Math.round(d.y+d.height/2)===y);
        assert.ok(i>=0,"reroll input must hit an observed die");world.selectedDice.add(i);return;
      }
      if(world.phase!=="board")return;
      if(y===945||y===920) {
        const xs=host.TCGBetterGI.handX[world.hand.length]||[];
        const index=world.handFan?xs.findIndex(cx=>Math.abs(cx-x)<90):-1;
        world.title=index<0?null:{type:"card",id:world.hand[index]};world.titleReads=0;
        if(index<0&&variant!==9)world.handFan=false;return;
      }
      if(y===957&&[1608,1716,1824].includes(x)) {
        const selected={1608:"NA",1716:"E",1824:"Q"}[x];
        if(world.pendingSkill===selected){world.pendingSkill=null;skill(selected);}else world.pendingSkill=selected;
        return;
      }
      if(x===1820&&y===958) {
        if(world.pendingSwitch){world.pendingSwitch=false;spend({any:world.freeSwitch?0:1});world.freeSwitch=false;
          world.active=world.selectedHero;world.effects.push({type:"switch",target:world.active});
          if(variant===39 && world.active===2 && !world.nativeTalentCheckpoint) {
            // Synthetic external resource/hand update supplies the saved native
            // penance failure shape after a genuine in-session switch. This is
            // not cold midgame startup and does not override the planner.
            world.nativeTalentCheckpoint=true;world.characters[2].energy=2;
            world.dice={Electro:2,Omni:2,Anemo:1,Geo:2};world.enemies=[2];
            const oldCount=world.hand.length;
            world.hand=["penance","exile","运筹帷"];
            if(world.hand.length===oldCount)world.hand.push("提米");
            // Make the synthetic hand mutation independently observable. A
            // resource mismatch alone must not stand in for card evidence.
            world.handBadgeVisible=true;
          }
          combatFinished();}
        else world.pendingSwitch=true;return;
      }
      if(x===83&&y===538) {
        if(world.pendingEnd){world.pendingEnd=false;world.phase="settlement";world.turn="none";world.ticks=3;world.effects.push({type:"end"});}
        else world.pendingEnd=true;return;
      }
      if(x===1600&&y===900&&world.pendingTune!==undefined) {
        const element=T.team[world.active].element;
        const from=Object.keys(world.dice).find(e=>e!==element&&e!=="Omni"&&world.dice[e]>0);
        assert.ok(from,"tune requires an off-element die");world.dice[from]--;world.dice[element]=(world.dice[element]||0)+1;
        const id=world.hand.splice(world.pendingTune,1)[0];delete world.pendingTune;world.title=null;world.handFan=false;
        world.effects.push({type:"tune",id,element});return;
      }
    },
    captureGameRegion:()=>{
      frames++;let released=false;
      if(world.actionReroll?.pending!==null && world.actionReroll?.pending!==undefined && --world.actionReroll.lag<=0) {
        const r=world.actionReroll;r.remaining=r.pending;r.pending=null;
        if(r.remaining===0) {
          assert.equal(r.confirms,2);world.dice={};for(const d of world.rollItems)world.dice[d.element]=(world.dice[d.element]||0)+1;
          world.rerollEvidence={confirms:r.confirms,dieClicks:r.dieClicks,round:r.round,handScans:r.handScans};
          world.actionReroll=null;transition("board","user",4);
        }
      }
      if(Number.isInteger(world.executionRaceFrames)) {
        if(world.executionRaceFrames--===0){delete world.executionRaceFrames;world.phase="board";world.turn="enemy";world.ticks=5;}
      }
      if(world.transition&&--world.ticks<=0){Object.assign(world,world.transition);world.transition=null;}
      else if(world.phase==="board"&&world.turn==="enemy"&&--world.ticks<=0){world.turn="user";world.characters[world.active].hp--;}
      else if(world.phase==="settlement"&&--world.ticks<=0)nextRoll();
      return {width:1920,height:1080,dispose:()=>{assert.equal(released,false);released=true;disposed++;},
        DeriveCrop:(...roi)=>{assert.equal(released,false);
          const fee=roi[2]===36;assert.equal(roi[2],fee?36:44);assert.equal(roi[3],fee?35:40);
          if(fee)assert.ok(["1698,1010,36,35","1780,1010,36,35"].includes(roi.join(",")));
          crops++;let cropReleased=false;return {
            SrcMat:{Resize:size=>{assert.equal(released,false);assert.equal(cropReleased,false);
              assert.deepEqual([size.width,size.height],fee?[144,140]:[132,120]);scaled++;
              const mat={roi,released:false,dispose:()=>{assert.equal(mat.released,false);mat.released=true;scaledDisposed++;}};return mat;}},
            dispose:()=>{assert.equal(cropReleased,false);cropReleased=true;croppedDisposed++;}};},
        Find:ro=>{
          assert.equal(released,false);let text="";const [x,y]=ro.roi,key=ro.roi.join(",");
          if(["763,101,394,381","763,101,394,600"].includes(key)&&world.phase==="result")text="对局胜利";
          else if(key==="844,167,232,65")text=world.phase==="opening"?"初始手牌":world.phase==="roll"?"重投骰子":world.phase==="choice"?"挑选卡牌":"";
          else if(key==="700,155,520,130"&&world.phase==="choice")text="挑选卡牌\n请选择一张卡牌";
          else if(key==="700,835,520,65"&&world.phase==="roll"&&world.actionReroll)text="还可重投"+world.actionReroll.remaining+"轮";
          if(options.counterless && world.phase==="roll" && world.actionReroll?.remaining===1){
            if(key==="700,835,520,65")text="";
            if(key==="700,230,520,50")text="请选择要重投的骰子";
          }
          else if(key==="45,115,360,50"&&world.phase==="choice"&&world.choiceSelected)text=name(world.choiceSelected);
          else if(key==="311,115,341,50")text=readTitle();
          else if(key==="770,900,380,90" && world.pendingCard?.talent)text="打出手牌";
          else if(key==="740,510,450,65" && world.pendingCard)text=T.byId[world.pendingCard.id].type==="artifact"?
            "请选择要装备圣遗物的角色":world.pendingCard.talent?"装备给出战中的"+names[world.active]:"请选择要装备武器的角色";
          else if(key==="135,122,238,42"&&world.pendingSkill)text=[
            {NA:"源流",E:"神变·恶曜开眼",Q:"奥义·梦想真说"},
            {NA:"祈颂射艺",E:"拂花偈叶",Q:"猫猫秘宝"},
            {NA:"云来剑法",E:"星斗归位",Q:"天街巡游"}][world.active][world.pendingSkill];
          else if(key==="70,210,320,85"&&world.pendingSkill)text={NA:"普通攻击",E:"元素战技",Q:"元素爆发"}[world.pendingSkill];
          else if(key==="700,508,580,65"&&world.pendingSwitch)text="将所选角色切换为出战角色";
          else if(key==="1720,835,195,75"&&world.pendingSwitch)text="切换角色";
          else if(key==="850,972,260,60"&&world.pendingSwitch)text="";
          else if(key==="1730,700,170,124"&&(world.handBadgeVisible||world.handFan&&!(variant>=8&&world.hand.length<=4)))text=String(world.hand.length);
          // Native-sized HP crops deliberately return nothing, reproducing the
          // saved-frame detector failure instead of supplying idealized digits.
          return {text,isExist:()=>!!text};
        },
        FindMulti:ro=>{
          assert.equal(released,false);const asset=ro.mat?.p,[x,y]=ro.roi;let rows=[];
          if(asset==="assets/hand_rim.png"&&world.handFan) {
            assert.equal(ro.Use3Channels,false);assert.equal(ro.threshold,.85);
            assert.equal(ro.roi.join(","),"500,900,1260,135");
            rows=(api.TCGBetterGI.handX[world.hand.length]||[]).map(cx=>({x:cx+95,y:930,width:6,height:90}));
          }
          if(ro.roi.join(",")==="450,705,1030,90"&&world.phase==="choice")rows=[
            {text:"雷草祝佑·碎霆",x:585,y:729,width:171,height:27},{text:"雷草祝佑·锐核",x:1165,y:729,width:171,height:27}];
          if(ro.roi.join(",")==="770,900,380,90"&&world.pendingCard?.talent)rows=[{text:"打出手牌",x:919,y:931,width:116,height:34}];
          if(asset==="assets/core/出战角色.png"&&world.phase==="pick")rows=[{x:1771,y:857,width:106,height:26}];
          if(asset==="assets/core/确定.png"&&["opening","roll"].includes(world.phase))rows=[{x:943,y:932,width:64,height:31}];
          if(asset==="assets/core/确定.png"&&world.phase==="choice"&&world.choiceSelected)rows=[{x:943,y:932,width:64,height:31}];
          if(asset==="assets/core/确定.png"&&world.pendingCard?.selected)rows=[{x:943,y:932,width:64,height:31}];
          if(asset==="assets/core/回合结算阶段.png"&&world.phase==="settlement")rows=[{x:10,y:300,width:100,height:25}];
          if(asset==="assets/core/回合结束.png"&&world.phase==="board")rows=[{x:70,y:521,width:25,height:34}];
          if(asset==="assets/core/元素调和.png"&&world.pendingTune!==undefined)rows=[{x:1560,y:880,width:80,height:40}];
          if(asset===`assets/${world.turn}_turn.png`&&world.phase==="board"&&!world.pendingSkill&&!world.pendingSwitch)rows=[{x:64,y:518,width:33,height:42}];
          const roll=/assets\/dice\/NativeRoll(\w+)\.png/.exec(asset||"");
          if(roll){assert.equal(ro.Use3Channels,true);assert.equal(ro.threshold,.73);}
          if(roll&&world.phase==="roll")rows=world.rollItems.filter(d=>d.element===roll[1]);
          const main=/assets\/dice\/NativeMain(\w+)\.png/.exec(asset||"");
          if(main){assert.equal(ro.Use3Channels,true);assert.equal(ro.threshold,.7);}
          if(main&&world.phase==="board") {
            let slot=0;for(const [element,count] of Object.entries(world.dice))for(let i=0;i<count;i++,slot++)if(element===main[1])rows.push({x:1850,y:190+44*slot,width:31,height:31});
          }
          if(["assets/charge.png","assets/uncharge.png"].includes(asset)) {
            const who=[812,1022,1233].indexOf(x);if(who>=0){
              const count=asset==="assets/charge.png"?world.characters[who].energy:T.team[who].maxEnergy-world.characters[who].energy;
              rows=Array.from({length:count},(_,i)=>({x,y:620+30*i,width:10,height:10}));
            }
          }
          if(asset==="assets/disable.png"&&y===105&&variant<31){const who=[663,873,1083].indexOf(x);if(who>=0&&world.enemies[who]===0)rows=[{x,y,width:20,height:20}];}
          if(asset==="assets/state/StateFreeze.png"&&y===545){const who=[663,873,1083].indexOf(x);if(who>=0&&world.characters[who].frozen)rows=[{x,y,width:20,height:20}];}
          return {count:rows.length,...rows};
        }};
    }};
  const host=vm.createContext(api);
  if(variant===27) {
    await assert.rejects(vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),host),/7张未使用的初始手牌/);
    assert.equal(frames,disposed);assert.equal(crops,croppedDisposed);assert.equal(scaled,scaledDisposed);
    assert.equal(world.effects.length,0);assert.equal(events.some(e=>e.event==="decision"||e.event==="fresh-action-hand-verified"),false);
    assert.equal(events.filter(e=>e.event==="hand-scan").length,1,"reuse only the first complete hand scan to reject wrong opening count");
    return {variant,rejected:true,frames,disposed,gameplayActions:0,scope:"production-main rejects consumed starting hand before gameplay; only observation inputs, synthetic host"};
  }
  if(rejectedEntry) {
    await assert.rejects(vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),host),/新开局未行动|不接管中途对局/);
    assert.equal(frames,disposed);assert.equal(crops,croppedDisposed);assert.equal(scaled,scaledDisposed);
    assert.equal(inputs.length,0,"invalid action-page entry rejected before any mouse or hand input");
    assert.equal(world.effects.length,0);assert.equal(events.some(e=>e.event==="fresh-action-entry-accepted"||e.event==="decision"||e.event==="opening-ready"),false);
    assert.equal(messages.filter(m=>m.level==="error").length,1);
    assert.ok(messages.find(m=>m.level==="error").text.startsWith("牌手停止："));
    assert.equal(messages.some(m=>/不支持中途|未执行动作|请保留|逐行JSON|不要直接/.test(m.text)),false);
    return {variant,rejected:true,frames,disposed,inputs:0,scope:"production-main and production adapter fresh-entry rejection, synthetic host only"};
  }
  if(variant===26) {
    await vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),host);
    assert.equal(frames,disposed);assert.equal(inputs.length,0);assert.equal(world.effects.length,0);
    assert.equal(events.filter(e=>e.event==="roll-diagnostic").length,1);assert.equal(events.some(e=>e.event==="round"||e.event==="stop"),false);
    assert.deepEqual(messages,[{level:"info",text:"诊断完成：掷骰"}]);
    return {variant,frames,disposed,inputs:0,scope:"production diagnostic roll entry, no reroll or confirmation, synthetic host only"};
  }
  if(variant===3) {
    await assert.rejects(vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),host),/切换目标角色标题未核实/);
    assert.equal(frames,disposed);assert.ok(world.effects.length>0);assert.ok(world.round>0);
    assert.equal(events.some(e=>e.event==="team-member"),false);
    assert.equal(world.effects.some(e=>e.type==="switch"&&e.target===2),false);
    return {variant,frames,disposed,rejected:true,scope:"fixed team assumed at startup; unknown actual switch-target title is rejected before switch confirmation"};
  }
  try {await vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),host);}
  catch(e){console.error("REPLAY_FAILURE "+JSON.stringify({variant,world,events:events.slice(-15)}));throw e;}
  assert.equal(frames,disposed);assert.equal(world.dragging,null);
  assert.equal(crops,croppedDisposed);assert.equal(scaled,scaledDisposed);assert.ok(crops>0);
  if(variant===39) {
    assert.ok(world.nativeTalentCheckpoint);
    if(!world.effects.some(e=>e.type==="card"&&e.id==="penance"))console.error("TALENT_CHECKPOINT_MISSED "+JSON.stringify({effects:world.effects.slice(-6),decisions:events.filter(e=>e.event==="decision").slice(-3)}));
    assert.equal(world.effects.filter(e=>e.type==="card"&&e.id==="penance").length,1);
    assert.equal(events.filter(e=>e.event==="card-target-clicked"&&e.data.id==="penance").length,0);
    assert.equal(events.filter(e=>e.event==="card-confirm-clicked"&&e.data.id==="penance").length,1);
    assert.equal(events.filter(e=>e.event==="card-payment-preview"&&e.data.id==="penance"&&e.data.matched).length,1);
    assert.equal(events.some(e=>e.event==="stop"||e.event==="action-uncertain"),false);
    assert.equal(world.pendingCard,null);assert.equal(messages.at(-1).text,"对局胜利");
    return {variant,frames,disposed,crops,croppedDisposed,scaled,scaledDisposed,virtual_ms:time,
      penance_card_inputs:1,extra_target_inputs:0,cards:world.effects.filter(e=>e.type==="card").map(e=>e.id),
      scope:"synthetic production-main replay with saved native penance resource shape; penance final-hit checkpoint, not native win"};
  }
  assert.equal(events.some(e=>e.event==="stop"),false);
  assert.equal(world.togglesClosed,0,"expanded fan must never be blindly toggled closed");
  assert.equal(events.some(e=>e.event==="team-member"||e.event==="team"),false);
  assert.ok(events.some(e=>e.event==="team-assumed"));
  if(variant>=13 && variant<=30) {
    const ready=events.filter(e=>e.event==="opening-ready");assert.equal(ready.length,1,"opening initialized exactly once");
    assert.equal(ready[0].data.round,1);assert.equal(ready[0].data.midgameRestore,false);
    const expectedRoute={13:["opening","roll","pick","board"],14:["pick","roll","board"],15:["roll","pick","board"],
      16:["board"],17:["board"],18:["roll","board"],19:["pick","board"],
      28:["pick","roll","board"],29:["pick","board"],30:["opening","pick","roll","board"]}[variant];
    assert.deepEqual(ready[0].data.route,expectedRoute);
    const firstDecision=events.findIndex(e=>e.event==="decision");
    assert.equal(events.slice(0,firstDecision).some(e=>e.event.startsWith("forced-pick")||e.event==="replacement-plan"),false);
    assert.equal(events.filter(e=>e.event==="fresh-action-entry-accepted").length,actionEntry?1:0);
    assert.equal(events.filter(e=>e.event==="fresh-action-hand-verified").length,actionEntry?1:0);
    assert.equal(inputs.filter(([x,y])=>x===1824&&y===960).length,0);
    const picked=events.find(e=>e.event==="pick-confirmed");
    if(picked){assert.equal(picked.data.characterInputs,[28,29].includes(variant)?1:2);
      assert.equal(events.filter(e=>e.event==="pick-target-clicked").length,1);
      assert.equal(events.filter(e=>e.event==="pick-confirm-clicked").length,[28,29].includes(variant)?0:1);}
  }
  if(variant===6)assert.ok(events.some(e=>e.event==="execution-deferred"&&e.data.code==="TCG_HAND_REFRESH"));
  if(variant===7)assert.ok(events.some(e=>e.event==="state-resynced"&&e.data.confirmed===true));
  if(typeof host.TCGBetterGI.handLayoutCount==="function") {
    if(variant===8 || variant===9)assert.ok(events.some(e=>e.event==="hand-count"&&e.data.count<=4),"low-count replay must actually resolve count without badge");
    assert.equal(events.some(e=>e.event==="hand-count-probed"||e.event==="title-read"&&e.data.kind==="boundary"),false);
  } else if(variant===8 || variant===9)assert.ok(events.some(e=>e.event==="hand-count-probed"),"legacy baseline must actually exercise its boundary path");
  if([10,12].includes(variant)) {
    assert.equal(events.filter(e=>e.event==="choice-selected").length,1);assert.equal(events.filter(e=>e.event==="choice-resolved").length,1);
    assert.equal(events.filter(e=>e.event==="choice-card-verified").length,1);
    assert.ok(world.effects.some(e=>e.type==="card"&&e.id==="shatterbolt"),"selected card must be actually paid and played, not merely added to hand");
    assert.equal(events.filter(e=>e.event==="choice-confirm-clicked").length,variant===12?1:0);
  }
  if(variant===11)assert.ok(events.some(e=>e.event==="execution-deferred"&&e.data.code==="TCG_OBSERVATION_INTERRUPTED"));
  assert.ok(events.some(e=>e.event==="team-member"&&e.data.raw==="刻睛"||e.event==="title-read"&&e.data.reads.includes("刻睛")));
  // Choice variants may preserve or tune voltage when actual standby charge is
  // already full. Its independent effect is checked by the other replays.
  for(const id of [...(variant<31?["woven",...([10,12].includes(variant)?[]:["voltage"])]:[]),"sweet","shift"])
    assert.ok(world.effects.some(e=>e.type==="card"&&e.id===id),"missing card "+id);
  for(const who of [0,1,2])assert.ok(world.effects.some(e=>e.type==="skill"&&e.who===who&&e.skill==="Q"),"missing burst "+who);
  assert.ok(world.effects.some(e=>e.type==="switch"));assert.ok(world.effects.some(e=>e.type==="end"));
  assert.ok(events.filter(e=>e.event==="round").length>=(variant===7?2:3),"resynchronized extra resources may reach the checkpoint in round two");
  const confirmed=events.filter(e=>e.event==="confirmed");assert.equal(confirmed.length,world.effects.filter(e=>!["generated-choice","artifact-trigger"].includes(e.type)).length);
  if(variant===31) {
    assert.ok(world.effects.some(e=>e.type==="card"&&e.id==="toss"));
    assert.equal(world.rerollEvidence.confirms,2);assert.equal(world.rerollEvidence.dieClicks.length,4);
    const rerolls=events.filter(e=>e.event==="action-reroll-confirmed");
    assert.deepEqual(rerolls.map(e=>[e.data.remaining,e.data.selected,e.data.count,e.data.wanted]),
      [[2,4,5,"Dendro"],[options.counterless?null:1,0,5,"Dendro"]]);
    const resolved=events.findIndex(e=>e.event==="action-reroll-resolved");assert.ok(resolved>0);
    assert.ok(events.slice(resolved).some(e=>e.event==="confirmed"&&e.data.action.who===1&&e.data.action.skill==="Q"),"reroll must continue to the intended Collei Q");
    const toss=confirmed.find(e=>e.data.action.id==="toss");assert.ok(toss);
    assert.equal(toss.data.after.hand.length,0,"last-card reroll consumes the identified toss, proven by both actual confirmations");
    assert.equal(events.slice(resolved).some(e=>e.event==="hand-scan"&&e.data.count===0),false,"empty hand must not be expanded after the resolved rerolls");
  }
  if(variant===35) {
    assert.ok(world.effects.some(e=>e.type==="card"&&e.id==="exile"));
    assert.ok(world.effects.some(e=>e.type==="tune"&&e.id==="toss"));
    assert.equal(world.effects.some(e=>e.type==="card"&&e.id==="toss"),false,"rich known hand has a deterministic Q route; do not require random dice");
    assert.ok(confirmed.some(e=>e.data.action.who===1&&e.data.action.skill==="Q"));
  }
  if(variant===32) {
    const trigger=world.effects.find(e=>e.type==="artifact-trigger"&&e.id==="exile");assert.ok(trigger);
    assert.ok(trigger.after.some((n,i)=>n>trigger.before[i]),"exile must actually gain standby energy");
    assert.ok(confirmed.some(e=>e.data.action.id==="exile"));
  }
  if(variant===33) {
    const triggers=world.effects.filter(e=>e.type==="artifact-trigger"&&e.id==="gambler");assert.ok(triggers.length>0);assert.ok(triggers.length<=3);
    const observableTriggers=world.effects.filter(e=>e.type==="artifact-trigger"&&e.id==="gambler"&&e.who===0);
    const lastKnown=confirmed.filter(e=>e.data.after.enemies).at(-1).data.memory.gamblerUsed[0];
    assert.equal(lastKnown,observableTriggers.length,"confirmed memory matches independent observed wearer defeats");
    assert.ok(confirmed.some(e=>e.data.action.id==="gambler"));
  }
  if(variant===34) {
    assert.equal(events.find(e=>e.event==="start").data.options.enemyCount,3);
    const board=events.find(e=>e.event==="state").data.state;
    assert.deepEqual(board.enemies.map(e=>e.hp),[2,8,40,10]);
    assert.equal(events.find(e=>e.event==="state").data.memory.enemyAliveCount,4);
    assert.ok(world.effects.some(e=>e.type==="card"&&e.id==="gambler"));
  }
  assert.equal(messages.some(m=>/牌手决策|未重复|停止保护|逐行JSON|请保留|没有执行|识别结果|比较出牌/.test(m.text)),false);
  assert.equal(messages.filter(m=>m.text.startsWith("行动：")).length,
    confirmed.length+events.filter(e=>e.event==="skill-fee-probed").length,"deferred pre-input decisions do not produce action messages");
  assert.ok(messages.some(m=>m.text==="行动：雷电将军·爆发"));
  assert.ok(messages.some(m=>m.text==="行动：切换：柯莱"));
  assert.ok(messages.some(m=>m.text.startsWith("行动：出牌：")));
  assert.ok(messages.some(m=>m.text==="行动：结束回合"));
  assert.equal(messages.at(-1).text,"对局胜利");
  assert.ok(events.some(e=>e.event==="decision"&&e.data.reason),"detailed reasons remain in file traces");
  assert.ok(events.some(e=>e.event==="decision-state-reused"),"immediately verified state is reused, not scanned twice");
  assert.ok(world.hand.includes("提米"),"unsupported readable cards remain unplayed and untuned");
  if([36,37,38].includes(variant)) {
    const id={36:"gambler",37:"exile",38:"tassel"}[variant];
    const equipped=world.effects.filter(e=>e.type==="card"&&e.id===id);
    assert.ok(equipped.length>0,"the native-style target-page branch must actually execute, not be skipped");
    assert.equal(events.filter(e=>e.event==="card-target-clicked"&&e.data.id===id).length,equipped.length);
    assert.equal(events.filter(e=>e.event==="card-confirm-clicked"&&e.data.id===id).length,equipped.length);
    assert.equal(world.pendingCard,null);
  }
  return {variant,frames,disposed,crops,croppedDisposed,scaled,scaledDisposed,virtual_ms:time,confirmed_actions:confirmed.length,
    cards:world.effects.filter(e=>e.type==="card").map(e=>e.id),
    rounds:world.round,hand_scans:events.filter(e=>e.event==="hand-scan").length,
    hand_cache_reuses:events.filter(e=>e.event==="hand-cache-reused").length,
    hand_incremental_updates:events.filter(e=>e.event==="hand-incremental").length,
    decision_reuses:events.filter(e=>e.event==="decision-state-reused").length,
    state_resyncs:events.filter(e=>e.event==="state-resynced").length,
    fan_expansions:events.filter(e=>e.event==="hand-expanded").length,
    board_resets:events.filter(e=>e.event==="hand-reset").length,
    title_operations:events.filter(e=>e.event==="title-read").length,
    toggles_closed:world.togglesClosed,
    choice_selections:events.filter(e=>e.event==="choice-selected").length,
    opening_route:events.find(e=>e.event==="opening-ready")?.data.route,
    execution_deferrals:events.filter(e=>e.event==="execution-deferred").length,
    action_reroll:world.rerollEvidence||null,artifact_triggers:world.effects.filter(e=>e.type==="artifact-trigger"),
    scope:"synthetic host only; terminal is a Keqing-Q checkpoint, not a real win"};
};
