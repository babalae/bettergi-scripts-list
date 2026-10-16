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
    ["reforge","重铸圣剑",{any:4},"heal",0]
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
  const countdownFamily=["countdown3","countdown2","countdown1","show"];
  const norm = (t) =>
    String(t || "")
      .replace(/[\s:：·!！。，,（）()「」『』【】\[\]“”"‘’']/g, "")
      .replace(/迴/g, "回");
  // Native choice frame 2026-10-15 17:28:31 confirms 暝视龙; both OCR paths read 视龙.
  const cardTitleAliases = {"幻戏倒计时3":"幻戏倒计时：3","幻戏倒计时2":"幻戏倒计时：2","幻戏倒计时1":"幻戏倒计时：1","逛言之核":"诳言之核","锋龙":"嵴锋龙","异色猎刀":"异色猎刀鳐","视龙":"暝视龙"};
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
  function elementReaction(element,aura=[],lunar=false) {
  const pair=(a,b)=>(element===a&&aura.includes(b))||(element===b&&aura.includes(a));
  const result=(name,bonus,consumed,extra={})=>({name,bonus,consumed,...extra});
  if(element==="Anemo"){
    const spread=["Cryo","Hydro","Pyro","Electro"].find(e=>aura.includes(e));
    if(spread)return result("swirl",0,spread,{spread});
  }
  if(pair("Hydro","Cryo"))return result("freeze",1,element==="Hydro"?"Cryo":"Hydro",{freeze:true});
  if(pair("Pyro","Hydro")||pair("Pyro","Cryo"))return result(pair("Pyro","Hydro")?"vaporize":"melt",2,
    element==="Pyro"?(aura.includes("Hydro")?"Hydro":"Cryo"):"Pyro");
  if(pair("Electro","Pyro"))return result("overload",2,element==="Electro"?"Pyro":"Electro",{forceSwitch:true});
  if(pair("Electro","Hydro")||pair("Electro","Cryo")){
    const water=pair("Electro","Hydro");
    return result(water?(lunar?"lunar-charged":"charged"):"superconduct",1,
      element==="Electro"?(water?"Hydro":"Cryo"):"Electro",water&&lunar?{lunar:true,futureUnknown:true}:{piercing:1});
  }
  if(pair("Dendro","Hydro"))return result(lunar?"lunar-bloom":"bloom",1,element==="Dendro"?"Hydro":"Dendro",
    lunar?{lunar:true}:{futureUnknown:true});
  if(pair("Dendro","Pyro")||pair("Dendro","Electro"))return result("dendro",1,
    element==="Dendro"?(aura.includes("Pyro")?"Pyro":"Electro"):"Dendro",{futureUnknown:true});
  return {name:null,bonus:0};
}
  function damageAgainst(target,amount,element,piercing=false) {
  if(!target)return {direct:amount,shieldSpent:0,guaranteed:null};
  const immune=!piercing&&target.immuneElements?.includes(element),
    shieldSpent=!piercing&&!immune&&known(target.shield)?Math.min(target.shield,amount):0,
    direct=immune?0:Math.max(0,amount-shieldSpent);
  return {direct,shieldSpent,guaranteed:target.defenseKnown===true?direct:null};
}
  function enemyDamageEvidence(before,after) {
  const beforeCount=enemyCount(before),afterCount=enemyCount(after),
    defeats=beforeCount!==null&&afterCount!==null?Math.max(0,beforeCount-afterCount):null;
  const matched=before.enemies.flatMap((e,i)=>{
    const next=e.identity?after.enemies.find(x=>x.identity===e.identity):
      beforeCount!==null&&afterCount!==null&&before.enemies.length===after.enemies.length?after.enemies[i]:null;
    return alive(e)&&next&&(next.dead===true||known(next.hp)&&next.hp<e.hp)?[i]:[];
  });
  return {any:defeats>0||matched.length>0,defeats,matched};
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
  function cardCountDecreased(before, after, id) {
    // Unrelated hand growth or sent input cannot prove this card was consumed.
    return Array.isArray(before) && Array.isArray(after) &&
      (bag(before)[id] || 0) > (bag(after)[id] || 0);
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
  const attachmentSource = h => ["native","private-rules"].includes(h.attachments?.source);
  const characterTarget = c => ["weapon","artifact","food","return","technique","heal-dice","heal"].includes(c.type);
  const lensTarget = c => ["weapon","artifact"].includes(c.type)||c.id==="canopy";
  function attachedCost(h) {
    const c=byId[h.id],a=h.attachments;
    return c&&attachmentSource(h)&&known(a.reduction)&&known(a.increase)?
      Math.max(0,size(c.cost)-a.reduction+a.increase):null;
  }
  function attachedCostAtLeast(h,n) {
    const exact=attachedCost(h);if(exact!==null)return exact>=n;
    const c=byId[h.id],a=h.attachments;
    // Temporary discounts only reduce payment. A native payment >= n proves
    // the trigger threshold without needing the exact attachment layer count.
    if(currentCost(h)!==null&&currentCost(h)>=n)return true;
    if(!c||a?.source!=="native")return null;
    // Nonnegative attachment counters give bounds without mistaking a final
    // discounted price for the cost used by research/canopy triggers.
    if(known(a.increase)&&size(c.cost)+a.increase<n)return false;
    if(known(a.reduction)&&Math.max(0,size(c.cost)-a.reduction)>=n)return true;
    return null;
  }
  const hasReduction=h=>h.attachments?.reduction>0||h.attachments?.reductionPresent===true;
  // Failed inspection is bound to the card/hand observation, not unrelated HP,
  // dice or the active role. A changed price/attachment/hand can be inspected again.
  function cardProbeKey(s,h,requirement="payment"){
    return JSON.stringify([requirement==="empowerment-row"?
      s.hand.map(c=>[c.id,currentCost(c),c.attachments]):s.hand.map(c=>c.id),
      h.index,h.id,currentCost(h),h.attachments,requirement]);
  }
  function cardFactsKnown(h,requirement="payment"){
    const a=h.attachments;
    if(a?.source!=="native")return false;
    if(requirement==="tuning")return typeof a.empowered==="boolean"&&typeof a.noTuning==="boolean";
    if(requirement==="attachment-cost")return known(a.reduction)&&known(a.increase);
    if(requirement==="attachment-kinds")return ["empowered","noTuning","effectless"].every(k=>typeof a[k]==="boolean")&&
      (known(a.reduction)||a.reductionPresent===true)&&(known(a.increase)||a.increasePresent===true);
    return currentCost(h)!==null&&typeof a.empowered==="boolean";
  }
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
    if(characterTarget(c)) {
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
    const context=cardContextError(s,a,m);if(context)return context;
    if(m.probeKeys.includes(cardProbeKey(s,s.hand[a.index])))return "该槽费用检视失败，等待相关手牌事实变化";
    return !payment(s.dice,cardCost(s,a,m),team[s.active].element)?"当前费用未知或无法合法支付":null;
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
      lunarMinimum:fact(0,"confirmed-action"),kernelLedger:null,enhancedUsed:false,passiveUsed:false,overgrowUsed:false,
      sashimi:[false,false,false],holyBlade:[false,false,false],frost:null,ripple:null,paleHymn:null,domain:null,branch:null,
      adventureMap:null,
      enemyAliveCount:null,lastActive:null,handTop:null,countdownStock:null,axis:"reaction",kernelProduced:fact(0,"unknown")};
  }
  function handVariantProof(m,pending) {
    if(!m?.countdownStock||m.supports.includes("kusava"))return null;
    const a=pending&&realAction(pending),ids=Object.keys(m.countdownStock).filter(id=>m.countdownStock[id]>0);
    // Pending disposal/foreign-card theft has not been confirmed. Do not infer
    // from the inventory that existed before that input.
    if(a?.type==="tune"&&countdownFamily.includes(a.id)||a?.type==="skill"&&["qucu","yumka"].includes(a.technique))return null;
    return {family:countdownFamily,ids,source:"initial-deck-minus-confirmed-use-plus-confirmed-discard-successor"};
  }
  function nextRound(m) {
    m.handTop=null; // Round draw consumes the known top; it may also burn at ten cards.
    m.round++;m.food=[false,false,false];m.sashimi=[false,false,false];m.uncertainActions=[];m.probeKeys=[];
    m.costEvidence=null;m.weaponDiscount=0;m.seedboxUsed=false;m.lensUsed=false;
    m.lumenCards=0;m.lumenUsed=false;m.fanUsed=false;m.foodDrawUsed=false;
    m.enhancedUsed=false;m.passiveUsed=false;m.overgrowUsed=false;m.kernelProduced=fact(0,"confirmed-round");
    if(m.frost||m.ripple){
      if(m.paleHymn)m.paleHymn.value=null;
      if(m.domain)m.domain.value=null;
    }
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
    const target=s.enemies.find(e=>e.active===true&&alive(e)),name=team[who].name,
      element=skill==="T"?"Physical":team[who].element,
      base=skill==="T"?techniques[m.techniques[who]?.id]?.damage||0:kernel?4:
        skill==="Q"?(name==="奈芙尔"?4+Math.min(2,seeds(s).length):name==="哥伦比娅"?3:0):1;
    const state=target?JSON.parse(JSON.stringify(target)):null,events=[],queue=[],
      columbina=role("哥伦比娅"),normal=skill==="NA"||kernel;
    let direct=0,lunarReactions=0,paleUsed=0,domainUsed=0,
      passive=m.passiveUsed,overgrow=m.overgrowUsed,enhancedReady=false,
      hymn=known(m.paleHymn?.value)?m.paleHymn.value:0,
      domain=name==="哥伦比娅"&&skill==="Q"?3:known(m.domain?.value)?m.domain.value:0,
      unknownReaction=!!state&&state.auraKnown!==true&&element!=="Physical",replacementRequired=false,
      handReactionUnknown=unknownReaction;
    if(base)queue.push({base,element,owner:skill==="T"?null:who,normal,source:kernel?"kernel":"skill"});
    const drain=()=>{
      while(queue.length){
        const hit=queue.shift();
        if(state&&state.hp<=0){replacementRequired=enemyCount(s)>1;handReactionUnknown ||= replacementRequired;break;}
        const r=state?.auraKnown===true?elementReaction(hit.element,state.aura,true):{name:null,bonus:0},
          weapon=hit.owner!==null&&m.weapons[hit.owner]==="fruit"?1:0,
          food=hit.normal&&m.sashimi[hit.owner]?1:0,
          shatter=state?.frozen===true&&["Pyro","Physical"].includes(hit.element)?2:0;
        let raw=hit.base+weapon+food+r.bonus+shatter;
        if(r.name==="lunar-bloom"&&hymn>0){raw++;hymn--;paleUsed++;}
        if(r.lunar&&domain>0){if(r.name==="lunar-charged")raw+=2;domain--;domainUsed++;}
        const damage=damageAgainst(state,raw,hit.element);
        direct+=damage.direct;
        events.push({...hit,reaction:r.name,direct:damage.direct,lunar:r.lunar===true});
        if(state){
          state.hp=Math.max(0,state.hp-damage.direct);
          if(known(state.shield))state.shield-=damage.shieldSpent;
          if(shatter)state.frozen=false;if(r.freeze)state.frozen=true;
          if(r.consumed)state.aura=state.aura.filter(a=>a!==r.consumed);
          else if(state.auraKnown&&!["Physical","Anemo","Geo"].includes(hit.element))state.aura=[...new Set([...state.aura,hit.element])];
        }
        if(r.lunar){
          lunarReactions++;
          if(passive===false&&alive(s.characters[columbina])){
            passive=true;queue.push({base:1,element:r.name==="lunar-bloom"?"Dendro":"Electro",owner:columbina,normal:false,source:"passive"});
          }
        }
        if(r.name&&m.supports.includes("overgrow")&&overgrow===false){
          overgrow=true;queue.push({base:1,element:"Hydro",owner:null,normal:false,source:"overgrow"});
        }
        if(r.futureUnknown)unknownReaction=true;
      }
    };
    drain();
    enhancedReady=name==="哥伦比娅"&&skill==="NA"&&m.enhancedUsed===false&&state?.hp>0&&
      m.lunarMinimum.value+lunarReactions>=3&&s.hand.some(hasReduction);
    if(enhancedReady){queue.push({base:1,element:"Dendro",owner:who,normal:true,source:"enhanced"});drain();}
    // Ordinary NA is charged when the pre-action dice count is even. A kernel
    // invokes a hidden skill after card payment; do not assume that parity here.
    if(skill==="NA"&&!kernel&&m.holyBlade?.[who]&&total(s.dice)%2===0){
      queue.push({base:5,element:team[who].element,owner:null,normal:false,source:"holy-blade"});drain();
    }
    const first=events[0],reacts=unknownReaction&&!lunarReactions?null:lunarReactions>0,
      guaranteedDirect=target?.defenseKnown===true&&!unknownReaction?direct:null;
    return {direct,guaranteedDirect,element,target,targetAfter:state,reacts,enhancedReady,events,lunarReactions,paleUsed,domainUsed,
      passiveUsed:passive,overgrowUsed:overgrow,unknownReaction,handReactionUnknown,replacementRequired,
      firstReaction:first?.reaction||null};
  }
  function cardTriggers(h,m) {
    const c=byId[h.id],canopyChecks=m.canopyPoints.map(point=>!c||!nonInitial(c)?false:
      point===null?null:attachedCostAtLeast(h,point)),threshold=attachedCostAtLeast(h,3),
      researchCheck=m.researchRemaining===0||threshold===false?false:
        m.researchRemaining===null?null:threshold,
      certain=canopyChecks.every(x=>x!==null)&&researchCheck!==null,
      canopy=canopyChecks.map((yes,i)=>yes===true?i:-1).filter(i=>i>=0);
    return {known:certain,canopy,research:researchCheck===true,
      total:certain?canopy.length+(researchCheck?1:0):null,colors:certain?"random-basic":"unknown",
      ...(!certain?{canopyChecks,researchCheck}:{})};
  }
  function knownAttachmentKinds(hand) {
    const kinds=new Set();
    for(const h of hand) {
      const a=h.attachments;
      if(a?.source!=="native")continue;
      if(hasReduction(h))kinds.add("reduction");if(a.increase>0||a.increasePresent)kinds.add("increase");
      if(a.empowered)kinds.add("empowered");if(a.noTuning)kinds.add("noTuning");if(a.effectless)kinds.add("effectless");
    }
    return Math.min(2,kinds.size);
  }
  function attachmentKinds(s) {
    const n=knownAttachmentKinds(s.hand);
    return n===2||s.hand.every(h=>cardFactsKnown(h,"attachment-kinds"))?n:null;
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
    if(m.adventureMap==="chasm")m.kernelLedger=null; // Random foreign events break the original-deck provenance.
    if(m.countdownStock&&Array.isArray(s.hand)&&s.hand.some(h=>countdownFamily.includes(h.id)&&!m.countdownStock[h.id]))
      m.countdownStock=null; // Native contradiction wins; foreign/unobserved effects require local titles.
    if(Array.isArray(s.characters))m.defeated=s.characters.map(c=>c.dead===true);
    // The original thirty contain no kernels. Track a conservative stock over
    // hand AND pile, so drawing a returned kernel cannot count as a new reaction.
    if(m.kernelLedger&&Array.isArray(s.hand)){
      const fresh=Math.max(0,seeds(s).length-m.kernelLedger.unspent);
      m.kernelLedger.created+=fresh;m.kernelLedger.unspent+=fresh;
      if(m.kernelLedger.created>m.lunarMinimum.value)
        m.lunarMinimum=fact(m.kernelLedger.created,"confirmed-kernel-stock-lower-bound");
    }
    const count=enemyCount(s);
    if(count!==null){
      if(m.enemyAliveCount!==null&&count<m.enemyAliveCount)
        m.gamblerUsed=m.gamblerUsed.map((n,i)=>m.artifactKinds[i]==="gambler"?null:n);
      m.enemyAliveCount=count;
    }
    if(known(s.active))m.lastActive=s.active;
  }
  function rejectAction(m,a) {const key=actionKey(a);if(!m.uncertainActions.includes(key))m.uncertainActions.push(key);m.costEvidence=null;}
  function deferUncertain(m,a){rejectAction(m,a);if(countdownFamily.includes(a.id)||a.type==="skill"&&["qucu","yumka"].includes(a.technique))m.countdownStock=null;
    if(a.id==="seed"||a.type==="skill"&&a.technique==="yumka")m.kernelLedger=null;}
  function changedReduction(h){
    const {reductionPresent,increasePresent,...attachments}=h.attachments||{source:"unknown",empowered:null};
    return {...h,currentCost:null,costSource:"changed-attachment",attachments:{...attachments,reduction:null,increase:null}};
  }
  function combatHandPlan(s,m,who,skill,kernelIndex=null) {
      const kernel=kernelIndex!==null,name=team[who].name,hit=damageEstimate(s,m,who,skill,kernel),
        bloomPossible=hit.handReactionUnknown||hit.events.some(e=>e.reaction==="lunar-bloom"),
        reductionPossible=h=>!known(h.attachments?.reduction)||hasReduction(h),
        generates=bloomPossible&&alive(s.characters[role("奈芙尔")])&&s.hand.length-(kernel?1:0)<10&&seeds(s).length-(kernel?1:0)<3&&
          (m.kernelProduced.source==="unknown"||m.kernelProduced.value<2),
        topdecks=name==="哥伦比娅"&&skill==="NA"&&m.enhancedUsed!==true&&s.hand.some(reductionPossible),
        draws=m.supports.includes("seelie")&&m.seelieRemaining<=1||
          kernel&&m.supports.includes("lumen")&&!m.lumenUsed&&m.lumenCards===2;
      const hand=indexedHand(s.hand).map(h=>{
        const modified=bloomPossible&&(currentCost(h)===null||currentCost(h)>0)||
          name==="菈乌玛"&&(skill==="Q"&&(currentCost(h)===null||currentCost(h)>0)||skill==="E"&&reductionPossible(h))||
          name==="奈芙尔"&&skill==="E"&&h.id==="seed";
        return modified?changedReduction(h):h;
      });
      if(generates||topdecks||draws)return {mode:"full",expectedCount:null,
        ...(!topdecks?{retainedHand:indexedHand(hand.filter((_,i)=>i!==kernelIndex)),
          ...(!draws?{retainedVariantFamilies:[countdownFamily]}:{})}:{})};
      return {mode:"unchanged",hand};
  }
  const seedDiscountKnown=(h,m)=>attachedCost(h)!==null&&known(m.sleepy)&&
    currentCost(h)===Math.max(0,attachedCost(h)-m.sleepy);
  function handPlan(a,s,m) {
    a=realAction(a);
    if(a.type==="switch" || a.type==="probe")return {mode:"unchanged",hand:indexedHand(s.hand)};
    if(a.type==="tune")return {mode:"remove",hand:indexedHand(s.hand.filter((_,i)=>i!==a.index))};
    if(a.type==="skill") {
      if(a.skill==="T")return techniques[a.technique].hand?{mode:"full",expectedCount:null,
        ...(["yumka","tepetli","rawr","blubber"].includes(a.technique)?{retainedHand:indexedHand(s.hand)}:{})}:
        {mode:"unchanged",hand:indexedHand(s.hand)};
      return combatHandPlan(s,m,a.who,a.skill);
    }
    if(a.type==="card"&&a.id==="seed"){
      const p=combatHandPlan(s,m,s.active,"NA",a.index);
      if(p.mode==="full")return p;
      const uncertain=!seedDiscountKnown(s.hand[a.index],m),
        hand=indexedHand(p.hand.filter((_,i)=>i!==a.index)).map(h=>nonInitial(h)&&(m.sleepy>0||uncertain)?
        {...h,currentCost:null,costSource:"changed-temporary-discount"}:h);
      return {mode:"remove",hand};
    }
    if(a.type==="card"&&m&&!(m.supports.includes("lumen")&&!m.lumenUsed&&m.lumenCards===2)) {
      const c=byId[a.id];
      // Drawing, generated cards, return/top-deck, choices and combat can change
      // order. Price-only effects cannot: invalidate their facts, not identity.
      const identityStable=["dice","switch","energy","status","artifact","support","food","technique","heal-dice","heal"].includes(c.type)||a.id==="gleam";
      if(identityStable&&a.id!=="nre"&&!(c.type==="food"&&m.supports.includes("nre")&&!m.foodDrawUsed)) {
        const hand=indexedHand(s.hand.filter((_,i)=>i!==a.index)).map(h=>{
          const other=byId[h.id]||h;
          if(a.id==="gleam"&&(currentCost(h)===null||currentCost(h)>0))
            return changedReduction(h);
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
    const c=a.type==="card"?byId[a.id]:null;
    return {mode:"full",expectedCount:null,
      ...(c&&!["legend","branch","adventure","choice-option","unimplemented"].includes(c.type)?
        {retainedHand:indexedHand(s.hand.filter((_,i)=>i!==a.index)).map(h=>a.id==="upgrade"&&h.attachments?.empowered!==true?
            {...h,attachments:{...h.attachments,empowered:null},canTune:false}:h),
          ...(["upgrade","meditation"].includes(c.id)&&
            !(m.supports.includes("lumen")&&!m.lumenUsed&&m.lumenCards===2)
            ?{retainedVariantFamilies:[countdownFamily]}:{})}:{})};
  }
  function damaged(before,after) {
    return Array.isArray(after.enemies)&&enemyDamageEvidence(before,after).any;
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
    const receipt=s.choiceReceipt;
    if(receipt?.origin===actionKey(a)+"/"+boardKey(b)){
      if(receipt.unresolved)return false;
      if(receipt.exited&&["meditation","sand","adventure"].includes(receipt.kind))return true;
    }
    if(byId[a.id].type==="draw")return cardCountDecreased(b.hand,s.hand,a.id);
    return (bag(b.hand)[a.id]||0)>(bag(s.hand)[a.id]||0);
  }
  const verifyResynchronized = verify;
  function commitCombatEffects(m,hit,b,s,who,skill) {
    const observed=damaged(b,s);
    if(observed)m.lunarMinimum.value+=hit.lunarReactions;
    m.passiveUsed=hit.passiveUsed;m.overgrowUsed=hit.overgrowUsed;
    if(hit.unknownReaction){
      if(m.passiveUsed===false)m.passiveUsed=null;
      if(m.supports.includes("overgrow")&&m.overgrowUsed===false)m.overgrowUsed=null;
      if(m.paleHymn)m.paleHymn.value=null;
      if(m.domain)m.domain.value=null;
    }
    for(const [key,used]of [["paleHymn",hit.paleUsed],["domain",hit.domainUsed]])
      if(known(m[key]?.value))m[key].value=Math.max(0,m[key].value-used);
    if(team[who].name==="哥伦比娅"&&skill==="NA"){
      // A lower bound below three cannot prove the native passive was locked.
      // An available reduced card may already have been returned by this NA.
      m.enhancedUsed=hit.enhancedReady?true:m.enhancedUsed===false&&b.hand.some(h=>
        h.attachments?.source!=="native"||hasReduction(h))?null:m.enhancedUsed;
      if(hit.enhancedReady)m.handTop=fact(null,"unknown");
    }
    const created=Math.max(0,seeds(s).length-seeds(b).length+(skill==="kernel"?1:0));
    if(created){
      m.kernelProduced.value=Math.min(2,m.kernelProduced.value+created);
      m.kernelProduced.source="confirmed-hand-count";
    }
  }
  function commit(m,a,b,s) {
    m.costEvidence=null;
    if(m.kernelLedger&&["card","tune"].includes(a.type)&&a.id==="seed")
      m.kernelLedger.unspent=Math.max(0,m.kernelLedger.unspent-1);
    if(a.type==="skill"&&a.technique==="yumka")m.kernelLedger=null;
    if((a.type==="skill"||a.id==="seed")&&Array.isArray(s.enemies)&&m.artifactKinds[b.active]==="gambler"&&known(m.gamblerUsed[b.active])){
      const defeats=enemyDamageEvidence(b,s).defeats;
      if(defeats>0)m.gamblerUsed[b.active]=Math.min(3,m.gamblerUsed[b.active]+defeats);
    }
    const count=enemyCount(s);if(count!==null)m.enemyAliveCount=count;
    if(a.type==="card"&&["draw","weapon","return","adventure","legend"].includes(byId[a.id]?.type))m.handTop=null;
    if(m.countdownStock&&["card","tune"].includes(a.type)&&countdownFamily.includes(a.id)){
      if(!m.countdownStock[a.id])m.countdownStock=null;
      else {
        m.countdownStock[a.id]--;
        // Playing is not discarding. Tuning advances the printed stage, never
        // the current discounted price; the successor is in the DECK, not hand.
        if(a.type==="tune"){
          const next=countdownFamily[countdownFamily.indexOf(a.id)+1];
          if(next){m.countdownStock[next]=(m.countdownStock[next]||0)+1;m.handTop=fact(next,"confirmed-discard");}
        }
      }
    }
    if(a.type==="skill"&&["qucu","yumka"].includes(a.technique))m.countdownStock=null;
    const handEffect=a.type==="skill"?handPlan(a,b,m):null;
    // Failed probes belong to these hand facts, not to unrelated HP or dice.
    // A later reaction can change hidden attachments at an unchanged count.
    if(a.type==="card"||a.type==="tune"||handEffect&&
      (handEffect.mode==="full"||handEffect.hand.some((h,i)=>h.currentCost!==b.hand[i].currentCost)))m.probeKeys=[];
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
    if(a.type==="tune")return;
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
      if(name==="菈乌玛"&&a.skill==="E")m.frost=fact({uses:2,damage:b.hand.some(hasReduction)?2:
        !estimate.unknownReaction&&!estimate.reacts&&b.hand.every(attachmentSource)?1:null},"confirmed-action");
      if(name==="菈乌玛"&&a.skill==="Q")m.paleHymn=fact(3,"confirmed-action");
      if(name==="哥伦比娅"&&a.skill==="E")m.ripple=fact(2,"confirmed-action");
      if(name==="哥伦比娅"&&a.skill==="Q")m.domain=fact(3,"confirmed-action");
      commitCombatEffects(m,estimate,b,s,a.who,a.skill);
      return;
    }
    if(a.type!=="card")return;
    const c=byId[a.id],h=b.hand[a.index],trigger=cardTriggers(h,m);
    for(const i of trigger.canopy)m.canopyPoints[i]++;
    if(trigger.research)m.researchRemaining--;
    if(!trigger.known){
      m.canopyPoints=m.canopyPoints.map((point,i)=>trigger.canopyChecks[i]===null?null:point);
      if(trigger.researchCheck===null&&m.researchRemaining>0)m.researchRemaining=null;
    }
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
    if(c.id==="reforge")m.holyBlade[a.target]=true;
    if(c.id==="seedbox")m.seedboxRemaining=2;
    if(c.id==="lens")m.lensRemaining=2;
    if(c.id==="seelie")m.seelieRemaining=3;
    if(c.type==="food"&&m.supports.includes("nre"))m.foodDrawUsed=true;
    if(m.supports.includes("lumen")&&c.id!=="lumen") {
      m.lumenCards++;
      if(m.lumenCards===3&&!m.lumenUsed){m.lumenUsed=true;if(--m.lumenRemaining===0)m.supports=m.supports.filter(id=>id!=="lumen");}
    }
    if(c.id==="lumen"){m.lumenRemaining=3;m.lumenCards=0;m.lumenUsed=false;}
    if(c.id==="seed")commitCombatEffects(m,damageEstimate(b,m,b.active,"NA",true),b,s,b.active,"kernel");
    if(c.type==="support" && attachedCost(h)>=2 && m.seedboxRemaining>0 && !m.seedboxUsed && c.id!=="seedbox") {
      m.seedboxRemaining--;m.seedboxUsed=true;if(m.seedboxRemaining===0)m.supports=m.supports.filter(id=>id!=="seedbox");
    }
    if(lensTarget(c)&&m.played.includes(c.name)&&m.lensRemaining>0&&!m.lensUsed) {
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
  const gamblerRemaining = (m,who) => known(m.gamblerUsed[who])?Math.max(0,3-m.gamblerUsed[who]):0;
  function temporaryDiscount(h,m) {
    const c=byId[h.id],n=attachedCost(h);
    if(!c)return null;
    if(c.type==="support"&&m.seedboxRemaining>0&&!m.seedboxUsed&&n===null)return null;
    return (nonInitial(c)?m.sleepy:0)+(c.type==="weapon"?m.weaponDiscount:0)+
      (c.type==="technique"?m.techniqueDiscount:0)+
      (c.type==="support"&&m.seedboxRemaining>0&&!m.seedboxUsed&&n>=2?1:0)+
      (lensTarget(c)&&m.lensRemaining>0&&!m.lensUsed&&m.played.includes(c.name)?2:0);
  }
  // Restricted resource projection, never a native observation. Both route and
  // ordinary candidates use the same cost, hand-impact and commit rules.
  function projectResources(s,m,a) {
    const cost=a.type==="skill"?skillCost(a.who,a.skill,m,s):a.type==="card"?cardCost(s,a,m):
      a.type==="switch"?{any:m.freeSwitch||m.fanSwitch?0:1}:null;
    if(m.uncertainActions.includes(actionKey(a)))return null;
    if(a.type==="skill"&&!skillLegal(s,a,m)||a.type==="card"&&!cardLegal(s,a,m)||
       a.type==="switch"&&(a.target===s.active||!alive(s.characters[a.target])||s.characters[a.target].frozen))return null;
    const pay=payment(s.dice,cost,team[a.type==="switch"?a.target:s.active].element);
    if(!pay)return null;
    const next=JSON.parse(JSON.stringify(s)),mem=JSON.parse(JSON.stringify(m)),impact=handPlan(a,s,m),
      combat=a.type==="skill"||a.id==="seed",who=a.who??s.active,
      hit=combat?damageEstimate(s,m,who,a.skill||"NA",a.id==="seed"):null;
    next.dice=pay.remaining;
    if(a.type==="switch")next.active=a.target;
    if(a.type==="card"){
      next.hand=indexedHand(next.hand.filter((_,i)=>i!==a.index));
      if(a.id==="woven")next.dice.Dendro=Math.min(16-total(next.dice)+(next.dice.Dendro||0),(next.dice.Dendro||0)+1);
      if(a.id==="calx")for(let i=0;i<3;i++)if(i!==s.active&&alive(next.characters[i])&&next.characters[i].energy>0){
        next.characters[i].energy--;next.characters[s.active].energy=Math.min(team[s.active].maxEnergy,next.characters[s.active].energy+1);
      }
      if(["countdown3","countdown2","countdown1","show"].includes(a.id))next.dice={Omni:total(next.dice)};
      if(["toy","reforge"].includes(a.id))next.characters[a.target].hp=
        Math.min(team[a.target].maxHp,next.characters[a.target].hp+(a.id==="toy"?2:12));
    }
    if(combat){
      if(hit.target)next.enemies[s.enemies.indexOf(hit.target)]=hit.targetAfter;
      if(hit.targetAfter?.hp===0){hit.targetAfter.dead=true;hit.targetAfter.active=false;}
      if(a.type==="skill"&&a.skill!=="T")next.characters[who].energy=a.skill==="Q"?0:Math.min(team[who].maxEnergy,next.characters[who].energy+1);
      // Any random reduction/creation/top-deck remains an observation boundary.
      if(impact.mode!=="full")next.hand=impact.mode==="remove"?next.hand:
        indexedHand(impact.hand);
    }
    const triggers=a.type==="card"?cardTriggers(s.hand[a.index],m):null;
    commit(mem,a,s,next);
    // Carry only deterministic changes of already observed cards. Random draws,
    // choices, reduction targets and returned colours stop the prefix below.
    next.hand=next.hand.map(h=>{
      const old=s.hand.find(c=>c.index===(a.type==="card"&&h.index>=a.index?h.index+1:h.index));
      if(!old)return h;
      const before=temporaryDiscount(old,m),after=temporaryDiscount(old,mem),n=attachedCost(old),
        kernelReduction=a.type==="skill"&&a.who===role("奈芙尔")&&a.skill==="E"&&old.id==="seed"&&!hit.unknownReaction&&!hit.reacts;
      if(before===after&&!kernelReduction)return h;
      const quote=currentCost(old),reduction=kernelReduction?1:0;
      if(quote===null||before===null||after===null||n!==null&&quote!==Math.max(0,n-before))return {...h,currentCost:null};
      const price=n!==null?Math.max(0,n-reduction-after):quote>0||after>=before?
        Math.max(0,quote+before-after-reduction):null;
      return {...h,currentCost:price,costSource:"private-rules",
        ...(kernelReduction&&n!==null?{attachments:{...old.attachments,source:"private-rules",reduction:old.attachments.reduction+1}}:{})};
    });
    const randomDice=a.id==="cleaning"?knownAttachmentKinds(next.hand):a.id==="toy"?2:0;
    return {state:next,memory:mem,cost,paid:size(cost),hit,combat,
      refund:triggers?.total===null?randomDice:randomDice+(triggers?.total||0),
      boundary:impact.mode==="full"?"hand-change":a.id==="seed"&&!seedDiscountKnown(s.hand[a.index],m)?"temporary-discount-unknown":
        hit?.unknownReaction?"reaction":hit?.replacementRequired?"replacement":
        ["gleam","overgrow","amrita"].includes(a.id)&&impact.hand?.some(h=>h.currentCost===null)?"attachment-change":
        randomDice>0?"random-refund":
        triggers&&(m.canopyPoints.length||m.researchRemaining!==0)&&(!triggers.known||triggers.total>0)?"random-refund":null};
  }
  root.TCG={team,cards,techniques,byId,initialNames,norm,identify,observedCard,handCardKnown,characterName,role,
    diceOrder,total,size,known,alive,enemyCount,bag,indexedHand,removedOne,boardKey,actionKey,fact,payment,
    cardCost,cardInputCost,cardContextError,cardInputError,cardLegal,skillCost,skillLegal,legalState,freshMemory,nextRound,
    seeds,nonInitial,currentCost,attachedCost,attachedCostAtLeast,cardFactsKnown,cardProbeKey,hasReduction,realAction,characterTarget,cardTriggers,attachmentKinds,knownAttachmentKinds,reaction,damageEstimate,openingSetting,openingContext,
    openingPlan,rerollPlan,rerollCounter,OpeningFlow,freshActionBoard,replacement,survivorIntent,intent,noteBoard,
    rejectAction,deferUncertain,handPlan,handVariantProof,verify,verifyResynchronized,commit,removalEffect,emptyHandEffect,
    nativeCardScope,combatAction,gamblerRemaining,elementReaction,damageAgainst,enemyDamageEvidence,projectResources,temporaryDiscount,
    defaultMaxMinutes:45,targetedCardTypes:["technique","heal-dice","heal"],
    targetedCardBanners:{technique:["请选择要装备特技的角色","请选择一个角色装备特技","请选择一个角色","对所选角色生效"],
      "heal-dice":["请选择一个角色","对所选角色生效"],heal:["请选择一个角色","对所选角色生效"]}};
})(globalThis);

globalThis.TCG.version = "1.2.19";
globalThis.TCG.sharedVersion = "1.4.16";
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
