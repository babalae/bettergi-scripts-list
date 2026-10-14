(function(root){
  "use strict";
  const roster = [
    {name:"菈乌玛",element:"Dendro",maxHp:11,maxEnergy:2,skills:{NA:"林麓旅踏",E:"圣言述咏·终宵永眠",Q:"圣言述咏·众心为月"}},
    {name:"哥伦比娅",element:"Hydro",maxHp:10,maxEnergy:3,skills:{NA:"月露泼降",E:"万古潮汐",Q:"她的乡愁"}},
    // Native 2026-10-14 11:06 preview: OCR drops the rare 虵 in all six reads.
    {name:"奈芙尔",element:"Dendro",maxHp:10,maxEnergy:2,skills:{NA:"游虵吐信",E:"弈术·千夜一舞",Q:"圣约·真眸幻戏"},skillAliases:{NA:["游吐信"]}}
  ];
  const team = roster.slice();
  const cards = [
    ["fruit","盈满之实",{any:3},"weapon",2],
    ["gambler","赌徒的耳环",{aligned:1},"artifact",1],
    ["canopy","「悬木人」",{},"support",2],
    ["sand","「沙中遗事」",{},"legend",1],
    ["bloom","元素幻变：绽放祝佑",{aligned:2},"support",1],
    ["woven","元素共鸣：交织之草",{},"dice",2],
    ["gleam","月兆·满辉",{},"attachment",2],
    ["shift","换班时间",{},"switch",1],
    ["draw","运筹帷幄",{aligned:1},"draw",2],
    ["calx","白垩之术",{aligned:1},"energy",1],
    ["razor","藏锋何处",{},"return",2],
    ["countdown3","幻戏倒计时：3",{aligned:3},"draw",2],
    ["meditation","困困冥想术",{aligned:1},"choice",2],
    ["adventure","水仙十字大冒险",{aligned:1},"adventure",2],
    ["upgrade","天才的改造法",{},"attachment",2],
    ["cleaning","清扫时间",{},"dice",2],
    ["research","科研的动力",{aligned:1},"status",2],
    ["sashimi","刺身拼盘",{aligned:1},"food",1],
    ["seed","诳言之核",{element:"Dendro",n:5},"kernel",0],
    ["overgrow","绽放祝佑·蔓生",{element:"Dendro",n:2},"support",0],
    ["amrita","绽放祝佑·甘露",{element:"Hydro",n:2},"support",0],
    ["countdown2","幻戏倒计时：2",{aligned:2},"draw",0],
    ["countdown1","幻戏倒计时：1",{aligned:1},"draw",0],
    ["show","幻戏开始！",{},"draw",0],
    ["disperse","驱逐灾厄",{},"branch",0],
    ["sanctify","肃净污染",{},"branch",0],
    ["transformer","参量质变仪",{any:2},"support",0],
    ["nre","便携营养袋",{aligned:1},"support",0],
    ["fan","红羽团扇",{aligned:2},"support",0],
    ["seelie","寻宝仙灵",{aligned:1},"support",0],
    ["seedbox","化种匣",{},"support",0],
    ["lens","留念镜",{aligned:1},"support",0],
    ["lumen","流明石触媒",{any:3},"support",0],
    ["kusava","苦舍桓",{aligned:1},"support",0],
    ["ray","异色猎刀鳐",{},"technique",0],
    ["yumka","匿叶龙",{aligned:1},"technique",0],
    ["kohola","鳍游龙",{aligned:2},"technique",0],
    ["tepetli","嵴锋龙",{aligned:2},"technique",0],
    ["ikto","暝视龙",{aligned:2},"technique",0],
    ["qucu","绒翼龙",{aligned:1},"technique",0],
    ["boat","浪船",{aligned:5},"technique",0],
    ["tatanka","突角龙",{any:4},"technique",0],
    ["rawr","呀！呀！",{aligned:2},"technique",0],
    ["blubber","膨膨兽",{aligned:1},"technique",0],
    ["toy","木质玩具剑",{aligned:1},"heal-dice",0],
    ["tea","沉玉茶露",{},"food",0],
    ["chenyu","沉玉谷",{},"choice-option",0],
    ["tower","自体自身之塔",{},"choice-option",0],
    ["tonatiuh","天蛇船",{},"choice-option",0],
    ["chasm","层岩巨渊",{},"choice-option",0],
    ["reforge","重铸圣剑",{},"unimplemented",0]
  ].map(([id,name,cost,type,copies])=>({id,name,cost,type,copies}));
  // Names/costs are independently transcribed card rules, not game-state facts.
  // Unsupported target/prepare pages are excluded from active skill candidates.
  const techniques = {
    ray:{name:"原海水刃",cost:{any:2},damage:2,active:true},
    yumka:{name:"钩物巧技",cost:{aligned:2},damage:1,hand:true,active:true},
    kohola:{name:"游隙灵道",cost:{aligned:1},active:false,reason:"需要实际召唤物及目标页，霜林和涟漪不是召唤物"},
    tepetli:{name:"掘进突击",cost:{any:2},hand:true,active:true},
    ikto:{name:"灵性援护",cost:{aligned:1},active:false,reason:"任意场地/道具/料理二次选择页尚未验收"},
    qucu:{name:"迅疾滑翔",cost:{aligned:1},hand:true,switches:true,active:true},
    boat:{name:"浪船·迅击炮",cost:{aligned:1},damage:2,active:true},
    tatanka:{name:"昂扬状态",cost:{any:3},active:false,reason:"两次准备普攻的原生会话尚未验收"},
    rawr:{name:"呀！呀！",cost:{any:2},hand:true,active:true},
    blubber:{name:"膨膨音波",cost:{aligned:1},hand:true,switches:true,active:true}
  };
  const byId = Object.fromEntries(cards.map(c=>[c.id,c]));
  const initialNames = new Set(cards.filter(c=>c.copies>0).map(c=>c.name));
  root.TCGMoonCatalog={roster,cards,techniques,shareCode:"JUBC+WwQJGGQBn0YB6HQipcdG7GR27khIeLSHkMjDoKwOOskJHJSR0UlD+IgXvQRDyAA"};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.TCGMoonCatalog;
})(globalThis);

// Generated from 牌手共享. Edit layered source, not this standalone output.
(function (root) {
  "use strict";
  const {roster:team,cards,techniques}=root.TCGMoonCatalog;
  const byId=Object.fromEntries(cards.map(c=>[c.id,c]));
  const initialNames=new Set(cards.filter(c=>c.copies>0).map(c=>c.name));
  const norm = (t) =>
    String(t || "")
      .replace(/[\s:：·!！。，,（）()「」『』【】\[\]“”"‘’']/g, "")
      .replace(/迴/g, "回");
  const cardTitleAliases = {"幻戏倒计时3":"幻戏倒计时：3","幻戏倒计时2":"幻戏倒计时：2","幻戏倒计时1":"幻戏倒计时：1","逛言之核":"诳言之核","锋龙":"嵴锋龙","异色猎刀":"异色猎刀鳐"};
  const characterAliases = {"拉乌玛":"菈乌玛","乌玛":"菈乌玛"};
  function identify(text) {
  const title = norm(text);
  // User-approved two-glyph anchor. Other titles remain exact aliases only.
  if (title.includes("运筹") && byId.draw) return byId.draw;
  const canonical = cardTitleAliases[title] || title;
  return cards.find(c => norm(c.name) === norm(canonical)) || null;
}
  function observedCard(text, index) {
    const name = String(text || "").trim(), t = norm(name), c = identify(name);
    if (c) return { index, id: c.id, name: c.name, supported: true };
    if (t.length < 2 || t.length > 24 || !/[\u3400-\u9fffA-Za-z]/.test(t) ||
        !/^[\u3400-\u9fffA-Za-z0-9「」『』\-—]+$/.test(t) ||
        /^(初始手牌|请选择要替换的手牌|确定|取消|出战角色|回合结束|元素调和)$/.test(t)) return null;
    return { index, id: "unsupported:" + t, name, supported: false };
  }
  function handCardKnown(h) {
    if (!h || typeof h.id !== "string") return false;
    if (byId[h.id]) return h.supported !== false;
    const parsed = observedCard(h.name, h.index);
    return h.supported === false && parsed && parsed.supported === false && parsed.id === h.id;
  }
  function characterName(text) {
  const title=norm(text),canonical=characterAliases[title]||title;
  return team.findIndex(c=>norm(c.name)===norm(canonical));
}
  const diceOrder = ["Pyro","Hydro","Anemo","Electro","Dendro","Cryo","Geo","Omni"];
  const total = dice => Object.values(dice || {}).reduce((sum, n) => sum + n, 0);
  const size = cost => (cost.n || 0) + (cost.any || 0) + (cost.aligned || 0);
  const known = n => Number.isInteger(n) && n >= 0;
  const alive = (c) => !!c && c.dead === false && known(c.hp) && c.hp > 0;
  function enemyCount(s) {
    const es=s?.enemies;
    if(!Array.isArray(es) || !es.length || !es.every(e=>e.dead===true || alive(e)))return null;
    return es.filter(alive).length;
  }
  function realAction(a){return a.cardAction||a;}
  function actionKey(action){
    const a=realAction(action);return a.type+":"+(a.id||(["skill","probe"].includes(a.type)?a.who+":"+a.skill+(a.technique?":"+a.technique:""):a.target));
  }
  function bag(hand) {
    const out = {};
    for (const h of hand || []) out[h.id] = (out[h.id] || 0) + 1;
    return out;
  }
  function indexedHand(hand) {
    if (!Array.isArray(hand) || !hand.every(handCardKnown)) throw new Error("手牌缓存身份不完整");
    return hand.map((h, index) => ({ ...h, index }));
  }
  function removedOne(before, after, id) {
    const b = bag(before), a = bag(after);
    return before.length === after.length + 1 && Object.keys({ ...b, ...a }).every(k => (b[k] || 0) - (a[k] || 0) === (k === id ? 1 : 0));
  }
  class OpeningFlow {
    constructor(entry) {
      if (!["opening", "pick", "roll", "board"].includes(entry)) throw new Error("请在起手、首次选人、首次掷骰或未行动的新开局牌桌启动");
      this.entry = entry;
      this.route = [entry];
      this.opened = false;
      this.picked = false;
      this.rolled = false;
      this.complete = false;
    }
    record(stage) {
      const property = { opening: "opened", pick: "picked", roll: "rolled" }[stage];
      if (!property || this.complete || this[property]) throw new Error("开局阶段已确认或已结束，不重复执行：" + stage);
      this[property] = true;
      if (this.route[this.route.length - 1] !== stage) this.route.push(stage);
    }
    enterBoard(memory) {
      if (this.complete) return null;
      if (!known(memory.round) || memory.round > 1) throw new Error("开局回合状态不一致，不接管中途对局");
      const seeded = memory.round === 0;
      if (seeded) nextRound(memory);
      this.complete = true;
      if (this.route[this.route.length - 1] !== "board") this.route.push("board");
      return { entry: this.entry, route: this.route.slice(), round: memory.round, roundSeeded: seeded, midgameRestore: false };
    }
  }
  function freshActionBoard(s) {
    // Visible checks reject obvious midgame positions, but cannot prove that
    // a zero-cost hidden status was never played. An explicit user declaration
    // is additionally required by main before admitting a board entry.
    return !!s && s.phase === "board" && ["user", "enemy"].includes(s.turn) &&
      legalState({ ...s, turn: "user", hand: [] }) && total(s.dice) === 8 &&
      s.characters.every((c, i) => c.hp === team[i].maxHp && c.energy === 0 && c.dead === false && c.frozen === false);
  }
  function rerollCounter(text) {
    const t=norm(text),values=[];
    for(const match of t.matchAll(/(?:还可重投([12])轮|(?:可重投次数|剩余重投次数|剩余次数)([12]))/g))
      values.push(Number(match[1]||match[2]));
    return values.length===1?values[0]:null;
  }
  const fact = (value,source) => ({value,source});
  const role = name => team.findIndex(c=>c.name===name);
  const seeds = s => (s.hand||[]).filter(h=>h.id==="seed");
  const nonInitial = card => !initialNames.has(card.name);
  const currentCost = h => known(h?.currentCost) ? h.currentCost : null;
  function attachedCost(h) {
    const c=byId[h.id],a=h.attachments;
    return c&&a?.source==="native"&&known(a.reduction)&&known(a.increase)?
      Math.max(0,size(c.cost)-a.reduction+a.increase):null;
  }
  const hasReduction=h=>h.attachments?.reduction>0||h.attachments?.reductionPresent===true;
  // Failed inspection is bound to the card/hand observation, not unrelated HP,
  // dice or the active role. A changed price/attachment/hand can be inspected again.
  function cardProbeKey(s,h){return JSON.stringify([s.hand.map(c=>c.id),h.index,h.id,currentCost(h),h.attachments]);}
  function cardFactsKnown(h){return currentCost(h)!==null&&h.attachments?.source==="native"&&typeof h.attachments.empowered==="boolean";}
  function payment(dice,cost,preserve="Dendro") {
    if(!cost)return null;
    const list=Object.entries(dice).flatMap(([element,n])=>Array(n).fill(element)),selected=[];
    const available=e=>list.map((value,index)=>value===e && !selected.includes(index)?index:-1).filter(i=>i>=0);
    const take=(e,n)=>{const choices=available(e).slice(0,n);selected.push(...choices);return choices.length;};
    if(cost.n) {
      const missing=cost.n-take(cost.element,cost.n);
      if(take("Omni",missing)!==missing)return null;
    }
    if(cost.aligned) {
      const candidates=diceOrder.filter(e=>e!=="Omni").map(e=>({e,real:available(e).length}));
      const color=candidates.filter(c=>c.real+available("Omni").length>=cost.aligned)
        .sort((a,b)=>Math.min(b.real,cost.aligned)-Math.min(a.real,cost.aligned) || (a.e===preserve)-(b.e===preserve))[0];
      if(!color)return null;
      const missing=cost.aligned-take(color.e,cost.aligned);take("Omni",missing);
    }
    const any=cost.any||0,rest=list.map((e,index)=>({e,index}))
      .filter(c=>!selected.includes(c.index)).sort((a,b)=>weight(a.e,preserve)-weight(b.e,preserve));
    if(rest.length<any)return null;
    selected.push(...rest.slice(0,any).map(c=>c.index));
    const remaining={...dice};for(const i of selected)remaining[list[i]]--;
    return {indices:selected.sort((a,b)=>a-b),remaining};
  }
  function weight(element,preserve) {return element==="Omni"?10:element===preserve?6:["Dendro","Hydro"].includes(element)?3:1;}
  function fee(base,n,empowered=false) {
    if(empowered || base.any!==undefined)return {any:n};
    return base.aligned!==undefined?{aligned:n}:base.element?{element:base.element,n}:n===0?{}:null;
  }
  function cardCost(s,a,m) {
    const c=byId[a.id],h=s.hand[a.index],n=currentCost(h);
    if(!c || h?.id!==a.id || n===null)return null;
    // The native hand digit already includes temporary discounts. Never subtract
    // sleepy/weapon/support memory a second time. Trigger cost is separate below.
    return fee(c.cost,n,h.attachments?.empowered===true);
  }
  const cardInputCost = (s,a,m) => cardCost(s,a,m);
  function cardContextError(s,a,m) {
    const c=byId[a.id],h=s.hand[a.index];
    if(!c || h?.id!==a.id || !handCardKnown(h))return "卡牌身份未核实";
    if(["branch","choice-option","unimplemented"].includes(c.type) || a.id==="bloom")return "自动母牌或未支持的分支不能作为普通手牌打出";
    if(h.attachments?.effectless===true)return "卡牌已无效化";
    if(c.type==="kernel" && (s.active!==role("奈芙尔") || s.characters[s.active].frozen!==false))return "核需要可行动的奈芙尔出战";
    if(["weapon","artifact","food","return","technique","heal-dice"].includes(c.type)) {
      if(!alive(s.characters[a.target]))return "目标未核实存活";
      if(c.type==="food" && m.food[a.target])return "目标本轮已食用料理";
      if(c.type==="return" && !m.weapons[a.target])return "目标没有已确认武器";
    } else if(a.target!==null)return "此牌没有角色目标";
    if(a.id==="sand" && m.legendUsed)return "秘传已使用";
    if(a.id==="calx" && (s.characters[s.active].energy>=team[s.active].maxEnergy ||
      !s.characters.some((c,i)=>i!==s.active && alive(c) && c.energy>0)))return "白垩充能条件不满足";
    if((c.type==="support" || c.type==="adventure"&&!m.adventureMap) &&
      m.supports.length>=(m.bloomResolved?4:3))return "支援空位未证明，不盲目进入替换页";
    return null;
  }
  function cardInputError(s,a,m) {
    return cardContextError(s,a,m)||(!payment(s.dice,cardCost(s,a,m),team[s.active].element)?"当前费用未知或无法合法支付":null);
  }
  const cardLegal = (s,a,m) => a.type==="card" && cardInputError(s,a,m)===null;
  function skillCost(who,skill,m,s) {
    if(skill==="T") {
      const equipped=m.techniques[who],def=techniques[equipped?.id];
      if(!def)return null;
      const n=m.costEvidence;
      if(s&&n?.key===boardKey(s)&&n.who===who&&n.technique===equipped.id&&known(n.n))return fee(def.cost,n.n);
      return equipped.id==="yumka"&&s.hand.length<=2?{aligned:1}:def.cost;
    }
    const base=skill==="NA"?{element:team[who].element,n:1,any:2}:{element:team[who].element,n:3};
    const e=m.costEvidence;
    if(s && e?.key===boardKey(s) && e.who===who && e.skill===skill && known(e.n))
      return skill==="NA"?{element:base.element,n:Math.min(1,e.n),any:Math.max(0,e.n-1)}:{element:base.element,n:e.n};
    return base;
  }
  function skillLegal(s,a,m) {
    return a.who===s.active && alive(s.characters[a.who]) && s.characters[a.who].frozen===false &&
      (a.skill==="T"?techniques[a.technique]?.active===true&&m.techniques[a.who]?.id===a.technique&&m.techniques[a.who].uses>0:["NA","E","Q"].includes(a.skill)) &&
      (a.skill!=="Q" || s.characters[a.who].energy>=team[a.who].maxEnergy) &&
      !!payment(s.dice,skillCost(a.who,a.skill,m,s),team[a.who].element);
  }
  function legalState(s) {
    return s.phase==="board" && s.turn==="user" && known(s.active) && s.active<3 && s.diceKnown===true &&
      Object.entries(s.dice).every(([e,n])=>diceOrder.includes(e)&&known(n)) && total(s.dice)<=16 &&
      s.characters.length===3 && s.characters.every(c=>c.dead===true || alive(c)&&known(c.energy)&&typeof c.frozen==="boolean") &&
      alive(s.characters[s.active]) && Array.isArray(s.hand) && s.hand.length<=10 && s.hand.every(handCardKnown);
  }
  function boardKey(s) {
    return JSON.stringify([s.active,diceOrder.map(e=>s.dice?.[e]||0),s.characters,
      (s.hand||[]).map(h=>[h.id,h.currentCost,h.attachments]),s.enemies]);
  }
  function freshMemory() {
    return {round:0,openingTarget:null,used:[0,0,0],defeated:[false,false,false],food:[false,false,false],
      weapons:[null,null,null],artifacts:[false,false,false],artifactKinds:[null,null,null],gamblerUsed:[0,0,0],
      techniques:[null,null,null],techniqueDiscount:0,
      freeSwitch:false,fastSwitch:false,legendUsed:false,bloomResolved:false,uncertainActions:[],costEvidence:null,probeKeys:[],
      sleepy:0,weaponDiscount:0,supports:[],canopyPoints:[],researchRemaining:0,played:[],
      seedboxRemaining:0,seedboxUsed:false,lensRemaining:0,lensUsed:false,seelieRemaining:0,
      lumenRemaining:0,lumenCards:0,lumenUsed:false,fanUsed:false,fanSwitch:false,foodDrawUsed:false,
      lunarMinimum:fact(0,"confirmed-action"),enhancedUsed:false,passiveUsed:false,overgrowUsed:false,
      sashimi:[false,false,false],frost:null,ripple:null,paleHymn:null,domain:null,branch:null,
      adventureMap:null,
      enemyAliveCount:null,lastActive:null,handTop:null,axis:"reaction",kernelProduced:fact(0,"unknown")};
  }
  function nextRound(m) {
    m.round++;m.food=[false,false,false];m.sashimi=[false,false,false];m.uncertainActions=[];m.probeKeys=[];
    m.costEvidence=null;m.weaponDiscount=0;m.seedboxUsed=false;m.lensUsed=false;
    m.lumenCards=0;m.lumenUsed=false;m.fanUsed=false;m.foodDrawUsed=false;
    m.enhancedUsed=false;m.passiveUsed=false;m.overgrowUsed=false;m.kernelProduced= fact(0,"unknown");
    // These two battle statuses act once at each round end. Recasting refreshes
    // their two uses; an old cast must not suppress setup for the whole duel.
    if(m.frost&&--m.frost.value.uses<=0)m.frost=null;
    if(m.ripple&&--m.ripple.value<=0)m.ripple=null;
    // Confirmed manual-switch and sleepy discounts do not have one-round durations.
  }
  function reaction(s,element) {
    const enemy=s.enemies.find(e=>e.active===true&&alive(e));
    if(enemy?.auraKnown!==true)return null;
    const incompatible=element==="Dendro"?["Pyro","Electro"]:["Pyro","Cryo","Electro"];
    if(enemy.aura.some(e=>incompatible.includes(e)))return false;
    return enemy.aura.includes(element==="Dendro"?"Hydro":"Dendro");
  }
  function damageEstimate(s,m,who,skill,kernel=false) {
    if(skill==="T") {
      const id=m.techniques[who]?.id,target=s.enemies.find(e=>e.active===true&&alive(e));
      let direct=techniques[id]?.damage||0;
      if(target?.immuneElements?.includes("Physical"))direct=0;
      if(known(target?.shield))direct=Math.max(0,direct-target.shield);
      return {direct,element:"Physical",target,reacts:false,enhancedReady:false};
    }
    const name=team[who].name,element=team[who].element;
    let direct=kernel?4:skill==="Q"?(name==="奈芙尔"?4+Math.min(2,seeds(s).length):name==="哥伦比娅"?3:0):1;
    if(direct>0 && m.weapons[who]==="fruit")direct++;
    if(direct>0 && (skill==="NA" || kernel) && m.sashimi[who])direct++;
    const target=s.enemies.find(e=>e.active===true&&alive(e)),reacts=direct>0?reaction(s,element):false;
    if(reacts===true)direct++;
    // Extra random placement/reaction chains never enter the damage lower bound.
    if(target?.immuneElements?.includes(element))direct=0;
    if(known(target?.shield))direct=Math.max(0,direct-target.shield);
    return {direct,element,target,reacts,enhancedReady:name==="哥伦比娅" && skill==="NA" &&
      m.lunarMinimum.value>=3 && !m.enhancedUsed && s.hand.some(hasReduction)};
  }
  function cardTriggers(h,m) {
    const c=byId[h.id],n=attachedCost(h);
    if(!c || n===null || m.canopyPoints.some(p=>p===null) || m.researchRemaining===null)
      return {known:false,canopy:[],research:false,total:null,colors:"unknown"};
    const triggered=m.canopyPoints.map((point,index)=>nonInitial(c)&&n>=point?index:-1).filter(i=>i>=0);
    return {known:true,canopy:triggered,research:n>=3&&m.researchRemaining>0,
      total:triggered.length+(n>=3&&m.researchRemaining>0?1:0),colors:"random-basic"};
  }
  function attachmentKinds(s) {
    if(s.hand.some(h=>h.attachments?.source!=="native"))return null;
    const kinds=new Set();
    for(const h of s.hand) {
      const a=h.attachments;
      if(hasReduction(h))kinds.add("reduction");if(a.increase>0||a.increasePresent)kinds.add("increase");
      if(a.empowered)kinds.add("empowered");if(a.noTuning)kinds.add("noTuning");if(a.effectless)kinds.add("effectless");
    }
    return Math.min(2,kinds.size);
  }
  function openingSetting() {return "优先装备与启动牌";}
  function openingContext() {return {};}
  function openingPlan(hand) {
    const priority=new Set(["sand","fruit","draw","countdown3","upgrade","canopy"]),seen=new Set();
    const replace=hand.map(h=>!priority.has(h.id) || seen.has(h.id) && h.id!=="draw" || !seen.add(h.id));
    return {replace,keep:hand.filter((h,i)=>!replace[i]),duplicateWeapons:[]};
  }
  function rerollPlan(items,m) {
    const aliveElements=[...new Set(team.filter((_,i)=>!m.defeated[i]).map(c=>c.element))];
    const primary=aliveElements.includes("Dendro")?"Dendro":"Hydro",secondary=aliveElements.find(e=>e!==primary)||null;
    return {primary,secondary,elements:[...aliveElements,"Omni"],indices:items.map((d,i)=>aliveElements.includes(d.element)||d.element==="Omni"?i:-1).filter(i=>i>=0)};
  }
  function survivorIntent(s,m) {
    const choices=s.characters.map((c,who)=>({c,who})).filter(x=>alive(x.c));
    return choices.sort((a,b)=>survivorScore(s,m,b.who)-survivorScore(s,m,a.who))[0]?.who;
  }
  function survivorScore(s,m,who) {
    const c=s.characters[who],name=team[who].name;
    const payable=payment(s.dice||{},skillCost(who,"NA",m,s),team[who].element);
    return c.hp+(c.frozen? -20:3)+(payable?3:0)+(name==="奈芙尔"&&seeds(s).length?3:0)+(name==="哥伦比娅"?1:0);
  }
  function replacement(s,m) {
    const who=survivorIntent(s,m);
    return who===undefined?null:{who};
  }
  const intent = (s,m) => ({target:survivorIntent(s,m)});
  function noteBoard(m,s) {
    if(Array.isArray(s.characters))m.defeated=s.characters.map(c=>c.dead===true);
    const count=enemyCount(s);if(count!==null)m.enemyAliveCount=count;
    if(known(s.active))m.lastActive=s.active;
  }
  function rejectAction(m,a) {const key=actionKey(a);if(!m.uncertainActions.includes(key))m.uncertainActions.push(key);m.costEvidence=null;}
  const deferUncertain = rejectAction;
  function handPlan(a,s,m) {
    a=realAction(a);
    if(a.type==="switch" || a.type==="probe")return {mode:"unchanged",hand:indexedHand(s.hand)};
    if(a.type==="tune")return {mode:"remove",hand:indexedHand(s.hand.filter((_,i)=>i!==a.index))};
    if(a.type==="skill") {
      if(a.skill==="T")return techniques[a.technique].hand?{mode:"full",expectedCount:null}:
        {mode:"unchanged",hand:indexedHand(s.hand)};
      const name=team[a.who].name,hit=damageEstimate(s,m,a.who,a.skill),
        bloomPossible=hit.reacts!==false,
        reductionPossible=h=>h.attachments?.source!=="native"||hasReduction(h),
        generates=bloomPossible&&alive(s.characters[role("奈芙尔")])&&s.hand.length<10&&seeds(s).length<3,
        topdecks=name==="哥伦比娅"&&a.skill==="NA"&&!m.enhancedUsed&&s.hand.some(reductionPossible),
        draws=m.supports.includes("seelie")&&m.seelieRemaining<=1;
      // Unknown reaction/counter facts cannot prove that generation or random
      // top-deck is absent. Price-only effects never erase card identities.
      if(generates||topdecks||draws)return {mode:"full",expectedCount:null};
      const hand=indexedHand(s.hand).map(h=>{
        const modified=bloomPossible&&(currentCost(h)===null||currentCost(h)>0)||
          name==="菈乌玛"&&(a.skill==="Q"&&(currentCost(h)===null||currentCost(h)>0)||a.skill==="E"&&reductionPossible(h))||
          name==="奈芙尔"&&a.skill==="E"&&h.id==="seed";
        return modified?{...h,currentCost:null,costSource:"changed-attachment",attachments:{source:"unknown",empowered:null},canTune:false}:h;
      });
      return {mode:"unchanged",hand};
    }
    if(a.type==="card"&&m&&!(m.supports.includes("lumen")&&!m.lumenUsed&&m.lumenCards===2)) {
      const c=byId[a.id];
      // Drawing, generated cards, return/top-deck, choices and combat can change
      // order. Price-only effects cannot: invalidate their facts, not identity.
      const identityStable=["dice","switch","energy","status","artifact","support","food","technique","heal-dice"].includes(c.type)||a.id==="gleam";
      if(identityStable&&a.id!=="nre"&&!(c.type==="food"&&m.supports.includes("nre")&&!m.foodDrawUsed)) {
        const hand=indexedHand(s.hand.filter((_,i)=>i!==a.index)).map(h=>{
          const other=byId[h.id];
          if(a.id==="gleam"&&(currentCost(h)===null||currentCost(h)>0))
            return {...h,currentCost:null,costSource:"changed-attachment",attachments:{source:"unknown",empowered:null},canTune:false};
          const discountChanged=nonInitial(c)&&m.sleepy>0&&nonInitial(other)||
            a.id==="seedbox"&&other.type==="support"||a.id==="lens"&&["weapon","artifact","support"].includes(other.type)||
            c.type==="support"&&m.seedboxRemaining>0&&!m.seedboxUsed&&other.type==="support"||
            m.lensRemaining>0&&!m.lensUsed&&m.played.includes(c.name)&&["weapon","artifact","support"].includes(other.type)||
            c.type==="technique"&&m.techniqueDiscount>0&&other.type==="technique";
          return discountChanged?{...h,currentCost:null,costSource:"changed-temporary-discount"}:h;
        });
        return {mode:"remove",hand};
      }
    }
    // Reactions, top-deck and generated cards can change identities without changing count.
    return {mode:"full",expectedCount:null};
  }
  function damaged(before,after) {
    return Array.isArray(after.enemies) && before.enemies.some((e,i)=>alive(e) &&
      (after.enemies[i]?.dead===true || known(after.enemies[i]?.hp)&&after.enemies[i].hp<e.hp));
  }
  function verify(a,b,s,transition=false) {
    a=realAction(a);
    if(s.result)return true;
    if(a.type==="end")return s.turn==="enemy" || ["roll","settlement"].includes(s.phase);
    if(a.type==="switch")return s.active===a.target && s.active!==b.active;
    if(a.type==="skill") {
      const old=b.characters[a.who],now=s.characters?.[a.who];
      if(a.skill==="T")return transition || damaged(b,s) ||
        s.diceKnown===true&&total(s.dice)<total(b.dice) ||
        Array.isArray(s.hand)&&JSON.stringify(bag(b.hand))!==JSON.stringify(bag(s.hand)) ||
        techniques[a.technique].switches===true&&known(s.active)&&s.active!==b.active;
      return transition || damaged(b,s) || alive(now) && known(now.energy) &&
        (a.skill==="Q"?now.energy<old.energy:now.energy>old.energy);
    }
    if(!Array.isArray(s.hand))return false;
    if(a.type==="tune")return removedOne(b.hand,s.hand,a.id) && total(s.dice)===total(b.dice) &&
      (s.dice[a.element]||0)===(b.dice[a.element]||0)+1;
    if(a.type!=="card")return false;
    if(a.id==="seed" && (transition || damaged(b,s)))return true;
    if(s.choiceReceipt?.origin===actionKey(a)+"/"+boardKey(b) && s.choiceReceipt.exited &&
      ["meditation","sand","adventure"].includes(s.choiceReceipt.kind))return true;
    return (bag(b.hand)[a.id]||0)>(bag(s.hand)[a.id]||0) ||
      byId[a.id].type==="draw" && s.hand.length>b.hand.length;
  }
  const verifyResynchronized = verify;
  function commit(m,a,b,s) {
    m.costEvidence=null;
    // Card consumption/replacement can put an identical new card in the old slot.
    // Ordinary skills/switches do not by themselves justify re-inspecting it.
    if(a.type==="card"||a.type==="tune")m.probeKeys=[];
    if((a.type==="skill"&&a.skill!=="T"||a.type==="card"&&a.id==="seed")&&m.supports.includes("seelie")){
      if(--m.seelieRemaining<=0){m.supports=m.supports.filter(id=>id!=="seelie");m.seelieRemaining=0;}
    }
    // Equipment follows its wearer. Only confirmed switches grant fan/boat effects.
    if(known(s.active)&&s.active!==b.active) {
      const previous=m.techniques[b.active];if(previous?.id==="boat")previous.uses++;
      if(a.type==="switch"){m.freeSwitch=false;m.fastSwitch=false;m.fanSwitch=false;}
      if(m.supports.includes("fan")&&!m.fanUsed){m.fanUsed=true;m.fanSwitch=true;m.fastSwitch=true;}
    }
    if(a.type==="switch")return;
    if(a.type==="tune") {if(a.id.startsWith("countdown"))m.handTop=fact("countdown-successor","confirmed-action");return;}
    if(a.type==="skill") {
      if(a.skill==="T") {
        if(--m.techniques[a.who].uses===0)m.techniques[a.who]=null;
        if(a.technique==="rawr")m.techniqueDiscount=2;
        if(techniques[a.technique].hand)m.probeKeys=[];
        return; // Techniques do not charge, activate weapon/NA bonuses, or advance lunar count.
      }
      const estimate=damageEstimate(b,m,a.who,a.skill),enhanced=estimate.enhancedReady;
      m.used[a.who]++;
      const name=team[a.who].name;
      // These skills can modify an unread attachment without changing card count.
      if(estimate.reacts===true||enhanced||name==="菈乌玛"&&["E","Q"].includes(a.skill)||
        name==="奈芙尔"&&a.skill==="E")m.probeKeys=[];
      if(name==="菈乌玛"&&a.skill==="E")m.frost=fact({uses:2,damage:null},"confirmed-action");
      if(name==="菈乌玛"&&a.skill==="Q")m.paleHymn=fact(3,"confirmed-action");
      if(name==="哥伦比娅"&&a.skill==="E")m.ripple=fact(2,"confirmed-action");
      if(name==="哥伦比娅"&&a.skill==="Q")m.domain=fact(3,"confirmed-action");
      // Only a proven reaction of the confirmed hit advances the conservative unlock lower bound.
      if(estimate.reacts===true && damaged(b,s))m.lunarMinimum.value++;
      if(enhanced) {m.enhancedUsed=true;m.handTop=fact(null,"unknown");}
      return;
    }
    if(a.type!=="card")return;
    const c=byId[a.id],h=b.hand[a.index],trigger=cardTriggers(h,m);
    if(trigger.known) {for(const i of trigger.canopy)m.canopyPoints[i]++;if(trigger.research)m.researchRemaining--;}
    else {if(nonInitial(c))m.canopyPoints=m.canopyPoints.map(()=>null);
      if(m.researchRemaining>0)m.researchRemaining=null;}
    if(nonInitial(c))m.sleepy=0;
    if(c.type==="weapon") {m.weapons[a.target]=a.id;m.weaponDiscount=0;}
    if(c.type==="technique") {m.techniques[a.target]={id:c.id,uses:2};m.techniqueDiscount=0;}
    if(c.type==="artifact") {m.artifacts[a.target]=true;m.artifactKinds[a.target]=a.id;}
    if(c.type==="food") {m.food[a.target]=true;if(a.id==="sashimi")m.sashimi[a.target]=true;}
    if(c.type==="support")m.supports.push(c.id);
    if(c.id==="canopy")m.canopyPoints.push(1);
    if(c.id==="research")m.researchRemaining=3;
    if(c.id==="meditation")m.sleepy+=2;
    if(c.id==="shift")m.freeSwitch=true;
    if(c.id==="sand")m.legendUsed=true;
    if(c.id==="razor") {m.weapons[a.target]=null;m.weaponDiscount=2;}
    if(c.id==="seedbox")m.seedboxRemaining=2;
    if(c.id==="lens")m.lensRemaining=2;
    if(c.id==="seelie")m.seelieRemaining=3;
    if(c.type==="food"&&m.supports.includes("nre"))m.foodDrawUsed=true;
    if(m.supports.includes("lumen")&&c.id!=="lumen") {
      m.lumenCards++;
      if(m.lumenCards===3&&!m.lumenUsed){m.lumenUsed=true;if(--m.lumenRemaining===0)m.supports=m.supports.filter(id=>id!=="lumen");}
    }
    if(c.id==="lumen"){m.lumenRemaining=3;m.lumenCards=0;m.lumenUsed=false;}
    if(c.id==="seed" && damageEstimate(b,m,b.active,"NA",true).reacts===true && damaged(b,s))m.lunarMinimum.value++;
    if(c.type==="support" && attachedCost(h)>=2 && m.seedboxRemaining>0 && !m.seedboxUsed && c.id!=="seedbox") {
      m.seedboxRemaining--;m.seedboxUsed=true;if(m.seedboxRemaining===0)m.supports=m.supports.filter(id=>id!=="seedbox");
    }
    if(["weapon","artifact"].includes(c.type)&&m.played.includes(c.name)&&m.lensRemaining>0&&!m.lensUsed) {
      m.lensRemaining--;m.lensUsed=true;if(m.lensRemaining===0)m.supports=m.supports.filter(id=>id!=="lens");
    }
    if(!m.played.includes(c.name))m.played.push(c.name);
  }
  function removalEffect(a,b,s) {
    if(a.type==="tune")return (s.dice[a.element]||0)===(b.dice[a.element]||0)+1;
    if(a.type!=="card")return false;
    if(a.id==="woven")return (s.dice.Dendro||0)>(b.dice.Dendro||0);
    if(a.id==="calx")return s.characters[b.active].energy>b.characters[b.active].energy;
    return false;
  }
  function emptyHandEffect(a,b,s,transition) {
    return b.hand.length===1 && (s.handEvidence?.kind==="native-empty-fan" || removalEffect(a,b,s) || transition&&a.id==="seed");
  }
  function nativeCardScope(a,banner,b) {
    const name=banner.startsWith("打出手牌")?banner.slice(4):banner.endsWith("打出手牌")?banner.slice(0,-4):"";
    const named=identify(name)?.id===a.id;
    if(a.id==="seed")return b?.active===role("奈芙尔") &&
      (banner===norm("对我方出战角色生效") || banner===norm("对我方的奈芙尔生效") || banner===norm("奈芙尔使用技能：幻戏") ||
       named);
    return a.target===null && (banner===norm("对我方出战角色生效") ||
      named);
  }
  const combatAction = a => a.type==="card"&&a.id==="seed";
  const gamblerRemaining = (m,who) => Math.max(0,3-m.gamblerUsed[who]);
  root.TCG={team,cards,techniques,byId,initialNames,norm,identify,observedCard,handCardKnown,characterName,role,
    diceOrder,total,size,known,alive,enemyCount,bag,indexedHand,removedOne,boardKey,actionKey,fact,payment,
    cardCost,cardInputCost,cardContextError,cardInputError,cardLegal,skillCost,skillLegal,legalState,freshMemory,nextRound,
    seeds,nonInitial,currentCost,attachedCost,cardFactsKnown,cardProbeKey,hasReduction,realAction,cardTriggers,attachmentKinds,reaction,damageEstimate,openingSetting,openingContext,
    openingPlan,rerollPlan,rerollCounter,OpeningFlow,freshActionBoard,replacement,survivorIntent,intent,noteBoard,
    rejectAction,deferUncertain,handPlan,verify,verifyResynchronized,commit,removalEffect,emptyHandEffect,
    nativeCardScope,combatAction,gamblerRemaining,
    defaultMaxMinutes:45,targetedCardTypes:["technique","heal-dice"],
    targetedCardBanners:{technique:["请选择一个角色装备特技","请选择一个角色","对所选角色生效"],
      "heal-dice":["请选择一个角色","对所选角色生效"]}};
})(globalThis);

globalThis.TCG.version = "1.1.1";
globalThis.TCG.sharedVersion = "1.3.2";
globalThis.TCG.defaultStrategy = "default";
(function (T) {
  const strategies = new Map();
  T.registerStrategy = function (id, choose) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || typeof choose !== "function" || strategies.has(id))
      throw new Error("策略标识无效、重复或缺少决策函数：" + id);
    strategies.set(id, choose);
  };
  T.selectStrategy = function (id) {
    if (!strategies.has(id)) throw new Error("未注册策略：" + id);
    T.choose = strategies.get(id);
    T.activeStrategy = id;
  };
  T.availableStrategies = function () { return [...strategies.keys()]; };
})(globalThis.TCG);
