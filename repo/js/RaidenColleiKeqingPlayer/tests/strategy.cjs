"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const base=path.resolve(__dirname,".."),ctx=vm.createContext({});
for(const name of ["core","strategy"])vm.runInContext(fs.readFileSync(path.join(base,"lib",name+".js"),"utf8"),ctx);
const T=ctx.TCG,clone=x=>JSON.parse(JSON.stringify(x));let passed=0;
function test(name,fn){try{fn();passed++;console.log("PASS "+name);}catch(e){console.error("FAIL "+name+"\n"+e.stack);process.exitCode=1;}}
const hand=(...ids)=>ids.map((id,index)=>({id,index,name:T.byId[id].name}));
function state(p={}){return {phase:"board",turn:"user",active:0,diceKnown:true,dice:{Electro:8},hand:[],
  characters:[10,11,10].map(hp=>({hp,energy:0,dead:false,frozen:false})),
  enemies:[{hp:10,dead:false,active:true},{hp:10,dead:false,active:false}],...p};}
const has=(s,m,id)=>T.strategyEligible(s,m).some(a=>a.id===id);
test("新增精确原生别名不扩展到近似未知牌",()=>{assert.equal(T.identify("救免宣告").id,"edict");assert.equal(T.identify("飞叶斜").id,"talent");assert.equal(T.identify("赦免XX"),null);});
test("本大爷仅本轮阵亡、每轮一次；跨轮不继续合法",()=>{
 const s=state({hand:hand("lost")}),m=T.freshMemory();m.round=2;assert.equal(has(s,m,"lost"),false);
 s.characters[1]={hp:0,energy:0,dead:true,frozen:false};T.noteBoard(m,s);assert.equal(m.defeatRound,2);assert.equal(has(s,m,"lost"),true);
 T.commit(m,{type:"card",id:"lost",target:null},s);assert.equal(has(s,m,"lost"),false);T.nextRound(m);T.noteBoard(m,s);assert.equal(has(s,m,"lost"),false);
});
test("赦免与料理饱腹无关、秘传只一次、不治疗死人",()=>{
 const s=state({hand:hand("edict")}),m=T.freshMemory();s.characters[0].hp=3;m.food[0]=true;
 assert.equal(has(s,m,"edict"),true);const a={type:"card",id:"edict",index:0,target:0};T.commit(m,a,s);assert.equal(m.legendUsed,true);assert.equal(m.food[0],true);assert.equal(has(s,m,"edict"),false);
});
test("赦免规划不虚构清除冻结",()=>{const s=state({hand:hand("edict")});s.characters[0].frozen=true;s.characters[0].hp=8;
 const p=T.projectedAction(s,T.freshMemory(),{type:"card",id:"edict",index:0,target:0});assert.equal(p.state.characters[0].frozen,true);});
test("流放者装备槽覆盖赌徒、爆发后台补能每轮一次",()=>{
 const s=state({hand:hand("exile")}),m=T.freshMemory();s.characters[0].energy=2;m.round=1;m.artifacts[0]=true;m.artifactKinds[0]="gambler";
 const a={type:"card",id:"exile",index:0,target:0};assert.equal(has(s,m,"exile"),true);const p=T.projectedAction(s,m,a);
 assert.equal(p.memory.artifacts[0],false);assert.equal(p.memory.artifactKinds[0],"exile");
 // Use Collei to distinguish exile from Raiden's own +2 backstage energy.
 const b=state({active:1,dice:{Dendro:6}});b.characters[1].energy=2;p.memory.artifactKinds[1]="exile";
 const q=T.projectedAction(b,p.memory,{type:"skill",who:1,skill:"Q"});assert.equal(q.state.characters[0].energy,1);assert.equal(q.state.characters[2].energy,1);
 b.characters[1].energy=2;const again=T.projectedAction(b,q.memory,{type:"skill",who:1,skill:"Q"});assert.equal(again.state.characters[0].energy,0);
});
test("抵天只能出战刻晴使用，生成雷楔、已有雷楔消耗并增强附魔",()=>{
 const s=state({active:2,hand:hand("penance"),dice:{Electro:6}}),m=T.freshMemory();assert.equal(has(s,m,"penance"),true);
 const a={type:"card",id:"penance",index:0,target:2},p=T.projectedAction(s,m,a);assert.equal(p.state.hand[0].id,"wedge");assert.equal(p.memory.penance,true);
 s.hand=hand("penance","wedge");const q=T.projectedAction(s,m,a);assert.equal(q.state.hand.length,0);assert.equal(q.memory.keqingInfusedRound,m.round);
 s.active=0;assert.equal(has(s,m,"penance"),false);
});
test("雷楔后台返场但前台不浪费成重复战技",()=>{const s=state({hand:hand("wedge")}),m=T.freshMemory();assert.equal(has(s,m,"wedge"),true);s.active=2;assert.equal(has(s,m,"wedge"),false);});
test("强雷可为未满后台补能，不能重复填已满前台",()=>{
 const s=state({hand:hand("voltage")});s.characters[0].energy=2;const m=T.freshMemory();assert.equal(has(s,m,"voltage"),true);
 const p=T.projectedAction(s,m,{type:"card",id:"voltage",index:0,target:null});assert.equal(p.state.characters[0].energy,2);assert.equal(p.state.characters[1].energy,1);
});
test("投骰与战中重投是未知结果叶节点，不虚构幸运骰或新回合",()=>{
 const s=state({hand:hand("toss"),dice:{Electro:1,Pyro:3}}),m=T.freshMemory();m.round=3;m.used[0]=1;s.characters[0].energy=1;assert.equal(has(s,m,"toss"),true);
 const p=T.projectedAction(s,m,{type:"card",id:"toss",index:0,target:null});assert.equal(p.leaf,true);assert.equal(p.memory.round,3);assert.deepEqual(clone(p.state.dice),s.dice);
 s.dice={};assert.equal(has(s,m,"toss"),false);
});
test("减费仅来自匹配当前局面的原生费用或明确领域，过时证据无效",()=>{
 const s=state({dice:{Electro:1}}),m=T.freshMemory();s.characters[0].energy=2;m.thundergrassSupport="shatterbolt";
 assert.equal(T.skillLegal(s,{who:0,skill:"Q"},m),false);const a=T.choose(s,m);assert.equal(a.type,"probe");
 m.costEvidence={key:T.boardKey(s),who:0,skill:"Q",n:1,source:"native-skill-preview"};assert.equal(T.skillLegal(s,{who:0,skill:"Q"},m),true);
 s.characters[0].hp=9;assert.equal(T.skillLegal(s,{who:0,skill:"Q"},m),false);
 m.probeKeys.push(T.boardKey(s)+":Q");assert.notEqual(T.choose(s,m).type,"probe");
});
test("碎霆与锐核领域次数分别1与2，母牌本身不减费",()=>{
 const s=state({quicken:{known:true,charges:2}}),m=T.freshMemory();m.thundergrassSupport="thundergrass";assert.equal(T.size(T.skillCost(0,"Q",m,s)),3);
 m.thundergrassSupport="shatterbolt";assert.equal(T.size(T.skillCost(0,"Q",m,s)),1);m.blessingUsed=1;assert.equal(T.size(T.skillCost(0,"Q",m,s)),3);
 m.thundergrassSupport="sharpkernel";assert.equal(T.size(T.skillCost(1,"E",m,s)),2);m.blessingUsed=2;assert.equal(T.size(T.skillCost(1,"E",m,s)),3);
});
test("满能刻晴实际爆发优先于无尽储能战技",()=>{const s=state({active:2,dice:{Electro:8}});s.characters[2].energy=3;const m=T.freshMemory();m.raidenBurst=true;m.colleiBurst=true;assert.equal(T.choose(s,m).skill,"Q");});
test("有限搜索不修改真实状态或记忆且同输入结果确定",()=>{const s=state({hand:hand("woven","stars","edict")}),m=T.freshMemory(),before=JSON.stringify([s,m]);const a=T.choose(s,m),b=T.choose(s,m);assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify([s,m]),before);assert.ok(a.planning.expanded<=1500);});
test("战中重投跟随雷神Q后柯莱目标，包含切换预算、死亡与冻结回退",()=>{
 const s=state({dice:{Dendro:1,Cryo:2,Anemo:2},hand:hand("toss")}),m=T.freshMemory();
 m.raidenBurst=true;m.freeSwitch=true;s.characters[1].energy=2;s.characters[2].energy=2;
 let g=T.actionRerollGoal(s,m);assert.equal(g.who,1);assert.equal(g.element,"Dendro");assert.equal(g.bad,4);assert.equal(has(s,m,"toss"),true);
 s.dice={Cryo:3};m.freeSwitch=false;g=T.actionRerollGoal(s,m);assert.equal(g.who,0,"unaffordable switch+Q cannot be the reroll goal");
 s.dice={Cryo:5};s.characters[1].frozen=true;assert.notEqual(T.actionRerollGoal(s,m).who,1);
 s.characters[1]={hp:0,energy:0,dead:true,frozen:false};assert.notEqual(T.actionRerollGoal(s,m).who,1);
 s.dice={Electro:3};m.used[0]=1;assert.equal(has(s,m,"toss"),false,"do not reroll payable intended action");
});
test("重投次数只接受完整明确计数，不把提示任意数字当次数",()=>{
 for(const [text,n] of [["还可重投2轮",2],["还可重投1轮",1],["剩余重投次数：2",2],["可重投次数:1",1]])assert.equal(T.rerollCounter(text),n);
 for(const text of ["请选择要重投的骰子","2","还可重投0轮","还可重投3轮","还可重投2轮还可重投1轮",""])assert.equal(T.rerollCounter(text),null);
});
test("赌徒不限定刻晴，已知击倒返2万能，投影与真实计数不混用",()=>{
 const s=state({dice:{Electro:5},hand:hand("gambler"),enemies:[{hp:2,dead:false,active:true},{hp:10,dead:false,active:false}]}),m=T.freshMemory();m.round=1;
 assert.equal(has(s,m,"gambler"),true);const a={type:"card",id:"gambler",index:0,target:0};
 const p=T.projectedAction(s,m,a),q=T.projectedAction(p.state,p.memory,{type:"skill",who:0,skill:"NA"});
 assert.equal(q.state.dice.Omni,2);assert.equal(q.memory.gamblerUsed[0],1);assert.equal(m.gamblerUsed[0],0);
 const plan=T.choose(s,m);assert.equal(plan.id,"gambler");assert.ok(plan.planning.sequence.includes("skill:0:NA"));
});
test("赌徒多目标穿透击倒按剩余次数返骰，跨回合不重置，未知HP不虚构",()=>{
 const s=state({active:2,dice:{Electro:4},enemies:[{hp:4,dead:false,active:true},{hp:3,dead:false,active:false},{hp:2,dead:false,active:false}]}),m=T.freshMemory();s.characters[2].energy=3;m.artifactKinds[2]="gambler";m.artifacts[2]=true;
 for(const [used,refund] of [[0,6],[1,4],[2,2],[3,0]]){m.gamblerUsed[2]=used;const p=T.projectedAction(s,m,{type:"skill",who:2,skill:"Q"});assert.equal(p.state.dice.Omni||0,refund);assert.equal(p.memory.gamblerUsed[2],3);}
 m.gamblerUsed[2]=2;T.nextRound(m);assert.equal(m.gamblerUsed[2],2);
 s.enemies[1].hp=null;const p=T.projectedAction(s,m,{type:"skill",who:2,skill:"Q"});assert.equal(p.state.dice.Omni||0,0);assert.equal(p.memory.gamblerUsed[2],2);
});
test("赌徒实测账本适配敌方卡面缩减，不重复记死者、不根据骰数猜击倒",()=>{
 const before=state({enemies:[{hp:2,dead:false,active:true},{hp:9,dead:false,active:false}]}),after=clone(before),m=T.freshMemory();m.artifactKinds[0]="gambler";m.artifacts[0]=true;
 T.noteBoard(m,before);after.enemies=[{hp:9,dead:false,active:true}];T.commit(m,{type:"skill",who:0,skill:"NA"},before,after);T.noteBoard(m,after);T.noteBoard(m,after);assert.equal(m.gamblerUsed[0],1);
 after.dice.Omni=6;T.noteBoard(m,after);assert.equal(m.gamblerUsed[0],1);
 const other=clone(after);other.enemies[0].hp=null;T.noteBoard(m,other);assert.equal(m.gamblerUsed[0],1);
 // Conservatively do not replenish match charges by replacing the artifact.
 T.commit(m,{type:"card",id:"exile",target:0},after);T.commit(m,{type:"card",id:"gambler",target:0},after);assert.equal(m.gamblerUsed[0],1);
});
test("流放者优先实际补满后台，不能抢掉爆发费用或给已满者空补能",()=>{
 const s=state({active:1,dice:{Dendro:3,Pyro:2},hand:hand("exile")}),m=T.freshMemory();m.raidenBurst=true;s.characters[1].energy=2;s.characters[0].energy=1;s.characters[2].energy=2;
 assert.equal(T.choose(s,m).id,"exile");const p=T.projectedAction(s,m,{type:"card",id:"exile",index:0,target:1}),q=T.projectedAction(p.state,p.memory,{type:"skill",who:1,skill:"Q"});
 assert.equal(q.state.characters[0].energy,2);assert.equal(q.state.characters[2].energy,3);
 s.dice={Dendro:3};assert.equal(has(s,m,"exile"),false);assert.equal(T.choose(s,m).skill,"Q");
 s.dice={Dendro:3,Pyro:2};s.characters[0].energy=2;s.characters[2].energy=3;assert.equal(has(s,m,"exile"),false);
 s.characters[0].energy=0;s.characters[1].frozen=true;assert.equal(has(s,m,"exile"),false);
});
test("流放者可提前一技能装配，但仅本轮能接爆发且后台有增益",()=>{
 const s=state({active:1,dice:{Dendro:6,Pyro:2},hand:hand("exile")}),m=T.freshMemory();s.characters[1].energy=1;assert.equal(has(s,m,"exile"),true);
 s.dice={Dendro:5,Pyro:2};assert.equal(has(s,m,"exile"),false);s.dice={Dendro:6,Pyro:2};s.characters[1].energy=0;assert.equal(has(s,m,"exile"),false);
});
test("基础武器增益包括物理普攻，不虚构雷神E零直伤",()=>{
 const s=state(),m=T.freshMemory();m.weapons[0]=true;
 assert.equal(T.damageEstimate(s,m,0,"NA").direct,3);assert.equal(T.damageEstimate(s,m,0,"E").direct,0);assert.equal(T.damageEstimate(s,m,0,"Q").direct,4);
});
test("双1血角色互切没有虚构生存奖励，冻结脱身或真正高血替补才有收益",()=>{
 const s=state({dice:{Omni:1,Pyro:2,Anemo:1,Geo:1}}),m=T.freshMemory();m.round=5;m.raidenBurst=true;m.colleiBurst=true;
 s.characters=[{hp:1,energy:1,dead:false,frozen:false},{hp:0,energy:0,dead:true,frozen:false},{hp:1,energy:1,dead:false,frozen:false}];
 assert.equal(T.projectedAction(s,m,{type:"switch",target:2}).benefit,-.7);
 assert.notEqual(T.choose(s,m).type,"switch");
 s.characters[2].hp=8;assert.ok(T.projectedAction(s,m,{type:"switch",target:2}).benefit>0);
 s.characters[2].hp=1;s.characters[0].frozen=true;assert.ok(T.projectedAction(s,m,{type:"switch",target:2}).benefit>0);
});
test("首轮实战两个真实双1血残局不再反向互切，不改变记录的手牌与骰子",()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,"low-hp-native-states.json"),"utf8"));
 for(const row of fixture.cases){const before=JSON.stringify(row);assert.notEqual(T.choose(row.state,row.memory).type,"switch");assert.equal(JSON.stringify(row),before);}
});
test("雷神满能仅剩草骰时用伙伴修正当前费用，不把后台元素当作前台可用",()=>{
 // Native run04-44-03 at04:45:38: three Dendro dice; old planner tuned
 // three cards including companion and edict instead of converting two dice.
 const s=state({dice:{Dendro:3},hand:hand("talent","edict","voltage","companion")}),m=T.freshMemory();
 s.hand.push({index:4,id:"unsupported:镀金旅团的茶歇",name:"镀金旅团的茶歇",supported:false});
 s.characters[0].hp=6;s.characters[0].energy=2;m.round=1;m.eyeRound=1;m.used[0]=2;
 assert.equal(has(s,m,"companion"),true);const a=T.choose(s,m);assert.equal(a.id,"companion");
 assert.ok(a.planning.sequence.includes("skill:0:Q"));assert.ok(!a.planning.sequence.includes("tune:edict"));
 const p=T.projectedAction(s,m,a);assert.equal(T.total(p.state.dice),3);assert.equal(p.state.dice.Omni,2);
 assert.equal(p.state.dice.Dendro,1);assert.equal(p.state.hand.length,4);
});
test("伙伴判断随当前角色变化，不转换已全为本元素或万能的骰子",()=>{
 const s=state({active:1,dice:{Electro:2,Dendro:1},hand:hand("companion")}),m=T.freshMemory();
 s.characters[1].energy=2;m.raidenBurst=true;m.round=2;assert.equal(has(s,m,"companion"),true);
 assert.equal(T.choose(s,m).id,"companion");const p=T.projectedAction(s,m,{type:"card",id:"companion",index:0,target:null});
 assert.equal(p.state.dice.Omni,2);assert.equal(p.state.dice.Dendro,1);assert.equal(T.total(p.state.dice),3);
 for(const dice of [{Dendro:3},{Omni:3},{Dendro:1,Omni:2}]){s.dice=dice;assert.equal(has(s,m,"companion"),false);}
 s.dice={Electro:1};assert.equal(has(s,m,"companion"),false,"two dice fee still required");
});
test("调和雷楔和天赋牌不是释放技能，不改出战、充能、敌方血量或召唤记忆",()=>{
 for(const id of ["talent","penance","wedge"]){
   const s=state({active:1,dice:{Dendro:1,Cryo:2},hand:hand(id)}),m=T.freshMemory();
   s.characters[2]={hp:0,energy:0,dead:true,frozen:false};m.defeated[2]=true;T.noteBoard(m,s);
   const before=JSON.stringify([s,m]),p=T.projectedAction(s,m,{type:"tune",id,index:0,element:"Dendro"});
   assert.equal(p.state.active,1);assert.deepEqual(clone(p.state.characters),s.characters);
   assert.deepEqual(clone(p.state.enemies),s.enemies);assert.equal(p.state.hand.length,0);
   assert.equal(p.state.dice.Dendro,2);assert.equal(p.state.dice.Cryo,1);assert.equal(p.combat,false);
   assert.deepEqual(clone(p.memory),clone(m));assert.equal(JSON.stringify([s,m]),before);
 }
});
test("所有27种支持牌调和都不触发牌文、技能、装备、补能与使用次数",()=>{
 for(const def of T.cards){const s=state({hand:hand(def.id,"sweet"),dice:{Electro:1,Pyro:3}}),m=T.freshMemory();
   m.round=2;m.defeatRound=2;T.noteBoard(m,s);const before=JSON.stringify([s,m]);
   const p=T.projectedAction(s,m,{type:"tune",id:def.id,index:0,element:"Electro"});
   assert.equal(T.total(p.state.dice),4,def.id);assert.equal(p.state.dice.Electro,2,def.id);assert.equal(p.state.dice.Pyro,2,def.id);
   assert.deepEqual(clone(p.state.characters),s.characters,def.id);assert.deepEqual(clone(p.state.enemies),s.enemies,def.id);
   assert.deepEqual(clone(p.memory),clone(m),def.id);assert.equal(p.state.active,s.active,def.id);
   assert.equal(p.combat,false,def.id);assert.equal(p.passesTurn,false,def.id);assert.equal(p.state.hand.length,1,def.id);
   assert.equal(JSON.stringify([s,m]),before,def.id);
 }
});
test("快速牌和调和不交行动权，普通切换和技能才增加对手回应次数",()=>{
 const s=state({hand:hand("stars","shift","wedge"),dice:{Electro:5,Pyro:3}}),m=T.freshMemory();
 assert.equal(T.projectedAction(s,m,{type:"card",id:"stars",index:0,target:null}).passesTurn,false);
 assert.equal(T.projectedAction(s,m,{type:"tune",id:"wedge",index:2,element:"Electro"}).passesTurn,false);
 assert.equal(T.projectedAction(s,m,{type:"switch",target:1}).passesTurn,true);
 m.fastSwitch=true;assert.equal(T.projectedAction(s,m,{type:"switch",target:1}).passesTurn,false);
 assert.equal(T.projectedAction(s,m,{type:"skill",who:0,skill:"E"}).passesTurn,true);
 assert.equal(T.projectedAction(s,m,{type:"card",id:"wedge",index:2,target:2}).passesTurn,true);
});
test("第三轮真实起手资源可用星天与伙伴首轮开大，不把快速准备折扣成敌方回合",()=>{
 const s=state({dice:{Electro:2,Dendro:3,Omni:3},hand:hand("gambler","edict","companion","stars","calx"),
   enemies:[8,8,8,10].map((hp,i)=>({hp,dead:false,active:i===0}))}),m=T.freshMemory();m.round=1;
 s.hand.push({index:5,id:"unsupported:镀金旅团的茶歇",name:"镀金旅团的茶歇",supported:false});
 const p=T.choose(s,m);assert.ok(p.planning.sequence.includes("card:stars"));
 assert.ok(p.planning.sequence.includes("skill:0:Q"));assert.ok(!p.planning.sequence.includes("skill:0:NA"));
});
test("第三轮雷神Q后五骰能走完整转骰补能爆发链，不为眼前普攻耗尽后续费用",()=>{
 const s=state({dice:{Hydro:1,Geo:2,Omni:2},hand:hand("gambler","voltage","companion","shift","stars","calx"),
   enemies:[8,4,8,10].map((hp,i)=>({hp,dead:false,active:i===1}))}),m=T.freshMemory();
 s.characters[0].hp=6;s.characters[1].energy=2;s.characters[2].energy=2;
 for(let i=0;i<2;i++)s.hand.push({index:s.hand.length,id:"unsupported:镀金旅团的茶歇",name:"镀金旅团的茶歇",supported:false});
 m.round=2;m.raidenBurst=true;m.eyeRound=1;m.used[0]=3;m.legendUsed=true;m.immuneUntil[0]=2;
 const before=JSON.stringify([s,m]),p=T.choose(s,m);assert.equal(p.type,"card");
 assert.ok(p.planning.sequence.some(k=>/^skill:\d:Q$/.test(k)));assert.equal(JSON.stringify([s,m]),before);
 assert.ok(p.planning.expanded<=1500);
});
test("512种缺牌组合均选择合法支付动作或正常结束，不要求固定30张",()=>{
 const ids=["woven","voltage","shift","companion","lost","edict","exile","penance","toss"];
 for(let mask=0;mask<512;mask++){const s=state({hand:hand(...ids.filter((_,i)=>mask&(1<<i))),dice:{Electro:3,Dendro:2,Pyro:2}}),m=T.freshMemory();
   const a=T.choose(s,m);assert.notEqual(a.type,"stop");assert.notEqual(a.type,"probe");if(a.type!=="end")assert.ok(T.payment(s.dice,T.actionCost(a,s,m)));if(a.id)assert.ok(s.hand.some(h=>h.index===a.index&&h.id===a.id));}
});
console.log(JSON.stringify({passed,failed:process.exitCode?1:0,scope:"rule and bounded planning only, not native UI or win rate"}));
