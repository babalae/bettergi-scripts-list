"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const base = path.resolve(__dirname, "..");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(base, "lib/core.js"), "utf8"), context);
const T = context.TCG;
const clone = o => JSON.parse(JSON.stringify(o));
let passed = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); passed++; results.push({ name, pass: true }); console.log("PASS " + name); }
  catch (e) { results.push({ name, pass: false }); console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
}
function state(overrides = {}) {
  return { phase: "board", turn: "user", active: 0, diceKnown: true,
    dice: { Electro: 8, Omni: 0 }, hand: [],
    characters: [{ hp: 10, energy: 0, dead: false, frozen: false }, { hp: 10, energy: 0, dead: false, frozen: false }, { hp: 10, energy: 0, dead: false, frozen: false }],
    enemies: [{ hp: 10, dead: false }, { hp: 10, dead: false }, { hp: 10, dead: false }], ...overrides };
}
function hand(...ids) { return ids.map((id, index) => ({ id, index, name: T.byId[id].name })); }
function rollItems(elements = Array(8).fill("Electro")) {
  return elements.map((element,slot)=>({element,slot,x:627+224*(slot%4),y:407+246*Math.floor(slot/4)}));
}
async function main() {
  await test("可选参考构筑30张，雷楔与额外基础武器不计入参考牌表", () => {
    assert.equal(T.cards.reduce((n, c) => n + c.copies, 0), 30);
    assert.equal(T.byId.wedge.copies, 0);
    assert.equal(T.byId.talent.cost.n, 3);
  });
  await test("卡名容错只处理标点与迴/回，不猜未知卡", () => {
    assert.equal(T.identify("元素共鸣·交织之雷").id, "woven");
    assert.equal(T.identify("飞叶回斜").id, "talent");
    assert.equal(T.identify("飞叶XX"), null);
    assert.equal(T.characterName("雷电将军"), 0);
  });
  await test("原生刻睛误读仅在角色域映射刻晴，不做任意近似匹配", () => {
    assert.equal(T.characterName("刻睛"),2);assert.equal(T.characterName(" 刻晴 "),2);
    for(const text of ["刻静","刻情","刻晴天街巡游","睛","玛薇卡",""])assert.equal(T.characterName(text),-1);
    assert.equal(T.identify("刻睛"),null);
  });
  await test("残缺牌桌数据安全停止，不能因缺characters/dice抛出TypeError", () => {
    for(const patch of [{characters:null},{characters:[]},{dice:null},{dice:{Electro:-1}},{active:undefined}]) {
      assert.equal(T.choose(state(patch),T.freshMemory()).type,"stop");
    }
  });
  await test("未支持但可读的牌拥有稳定身份，不等同于已支持牌", () => {
    const first = T.observedCard("提米", 0), second = T.observedCard(" 提米 ", 4);
    assert.equal(first.supported, false); assert.equal(first.id, second.id);
    assert.equal(T.handCardKnown(first), true); assert.equal(T.identify("提米"), null);
    assert.equal(T.observedCard("星天之兆", 1).supported, true);
    for (const raw of ["", " ", "123", "确定", "初始手牌", "???"]) assert.equal(T.observedCard(raw, 0), null);
    assert.equal(T.handCardKnown({ id: "unsupported:提米", name: "派蒙", supported: false }), false);
  });
  await test("混合手牌照常使用已支持牌，未支持规则的稳定卡名可调和但不可出牌", () => {
    const unknown = T.observedCard("提米", 0), m = T.freshMemory();
    const s = state({ hand: [unknown, ...hand("woven").map(c => ({ ...c, index: 1 }))] });
    assert.equal(T.choose(s, m).id, "woven");
    s.hand = [unknown]; assert.equal(T.choose(s, m).skill, "NA");
    s.dice = { Pyro: 3 }; assert.equal(T.choose(s, m).type, "tune");
    s.hand = [{ id: "unreadable" }]; assert.equal(T.choose(s, m).type, "stop");
  });
  await test("混合手牌的多重集合验证不会把未知牌消失当成已知牌使用", () => {
    const u = T.observedCard("提米", 0);
    const b = state({ hand: [u, ...hand("woven")] }), a = clone(b);
    a.hand = [clone(u)]; a.dice.Electro++;
    assert.equal(T.verify({ type: "card", id: "woven" }, b, a), true);
    a.hand = hand("woven"); assert.equal(T.verify({ type: "card", id: "woven" }, b, a), false);
    assert.equal(T.verify({ type: "card", id: u.id }, b, a), false);
  });
  await test("新手基础武器只装备适配角色，必须保留可支付技能的骰子", () => {
    const m = T.freshMemory(), s = state({ hand: hand("tassel"), dice: { Electro: 6, Pyro: 2 } });
    const act = T.choose(s, m); assert.equal(act.id, "tassel"); assert.equal(act.target, 0);
    T.commit(m, act, s); assert.equal(m.weapons[0], true); assert.notEqual(T.choose(s, m).id, "tassel");
    const fresh = T.freshMemory(); s.hand = hand("sword"); assert.notEqual(T.choose(s, fresh).id, "sword");
    s.hand = hand("tassel"); s.dice = { Electro: 1, Pyro: 2, Hydro: 2 }; fresh.used[0] = 1;
    const unaffordable = T.choose(s, fresh);
    assert.equal(unaffordable.type === "card" && unaffordable.id === "tassel", false);
    s.dice = { Electro: 8 }; s.characters[0].energy = 2; assert.equal(T.choose(s, fresh).skill, "Q");
    fresh.raidenBurst = true; fresh.colleiBurst = true; fresh.dendroRound = 0; s.active = 2; s.hand = hand("sword");
    assert.equal(T.choose(s,fresh).type,"switch");assert.equal(T.choose(s,fresh).target,0);
    s.characters[0].energy=0;
    assert.equal(T.choose(s, fresh).target, 2);
  });
  await test("万能骰不能重复支付指定元素和无色费用", () => {
    assert.equal(T.payment({ Omni: 2, Pyro: 0 }, { element: "Electro", n: 1, any: 2 }), null);
    assert.ok(T.payment({ Omni: 1, Pyro: 2 }, { element: "Electro", n: 1, any: 2 }));
    assert.equal(T.payment({ Electro: 1, Dendro: 1 }, { aligned: 2 }), null);
  });
  await test("枚举支付规则与独立数学判定一致（1536组）", () => {
    let checked = 0;
    for (let e = 0; e <= 3; e++) for (let o = 0; o <= 3; o++) for (let p = 0; p <= 3; p++) {
      for (let n = 0; n <= 3; n++) for (let any = 0; any <= 5; any++) {
        const d = { Electro: e, Omni: o, Pyro: p };
        const pay = T.payment(d, { element: "Electro", n, any });
        assert.equal(!!pay, e + o >= n && e + o + p >= n + any);
        if (pay) assert.equal(T.total(pay.remaining), T.total(d) - n - any);
        checked++;
      }
    }
    assert.equal(checked, 1536);
  });
  await test("充能0/1禁止大招，充能2才允许雷神Q", () => {
    const s = state(), m = T.freshMemory();
    for (const energy of [0, 1]) { s.characters[0].energy = energy; assert.equal(T.skillLegal(s, { who: 0, skill: "Q" }, m), false); }
    s.characters[0].energy = 2;
    assert.equal(T.choose(s, m).skill, "Q");
  });
  await test("未知HP、充能、主动角色、负骰子均停止，不变成死亡/0", () => {
    const s = state(), m = T.freshMemory();
    s.characters[1].hp = null;
    assert.equal(T.choose(s, m).type, "stop");
    s.characters[1].hp = 10; s.characters[2].energy = null;
    assert.equal(T.choose(s, m).type, "stop");
    s.characters[2].energy = 0; s.active = null;
    assert.equal(T.choose(s, m).type, "stop");
    s.active = 0; s.dice.Electro = -1;
    assert.equal(T.choose(s, m).type, "stop");
  });
  await test("雷神NA→E→有能Q；只有确认后推进记忆", () => {
    const s = state(), m = T.freshMemory();
    const first = T.choose(s, m);
    assert.equal(first.skill, "NA");
    assert.equal(m.used[0], 0);
    T.commit(m, first, s); s.characters[0].energy = 1;
    const second = T.choose(s, m);
    assert.equal(second.skill, "E");
    T.commit(m, second, s); s.characters[0].energy = 2;
    assert.equal(T.choose(s, m).skill, "Q");
  });
  await test("双雷共鸣补能，已满能不会浪费", () => {
    const s = state({ hand: hand("voltage") }), m = T.freshMemory();
    assert.equal(T.choose(s, m).id, "voltage");
    s.characters[0].energy = 2;
    assert.equal(T.choose(s, m).skill, "Q");
  });
  await test("最好的伙伴不是净增两骰，只在能修正当前费用时出", () => {
    const m = T.freshMemory(), s = state({ hand: hand("companion"), dice: { Pyro: 3, Hydro: 2 } });
    assert.equal(T.choose(s, m).id, "companion");
    s.dice = { Electro: 5 };
    assert.notEqual(T.choose(s, m).id, "companion");
    s.dice = { Pyro: 1 };
    assert.notEqual(T.choose(s, m).id, "companion");
  });
  await test("星天补能必须保留可支付大招的骰子", () => {
    const m = T.freshMemory(), s = state({ hand: hand("stars"), dice: { Electro: 3, Pyro: 2 } });
    s.characters[0].energy = 1;
    assert.equal(T.choose(s, m).id, "stars");
    s.dice = { Electro: 2, Pyro: 2 };
    assert.notEqual(T.choose(s, m).id, "stars");
  });
  await test("白垩需要后台充能，并且不抢雷神启动阶段的充能", () => {
    const m = T.freshMemory(), s = state({ active: 2, hand: hand("calx"), dice: { Electro: 5 } });
    m.raidenBurst = true; m.colleiBurst = true; m.dendroRound = 0;
    s.characters[2].energy = 2;
    assert.notEqual(T.choose(s, m).id, "calx");
    s.characters[0].energy = 1;
    assert.equal(T.choose(s, m).id, "calx");
  });
  await test("快切与减费不重复出，同一次切换确认后清除", () => {
    const m = T.freshMemory(), s = state({ hand: hand("shift", "fast", "sweet"), dice: { Dendro: 3 } });
    m.raidenBurst = true; s.characters[1].energy = 2;
    const shift = T.choose(s, m); assert.equal(shift.id, "shift");
    T.commit(m, shift, s); s.hand = hand("fast", "sweet");
    const fast = T.choose(s, m); assert.equal(fast.id, "fast");
    T.commit(m, fast, s); s.hand = [];
    assert.equal(T.choose(s, m).type, "switch");
    T.commit(m, { type: "switch", target: 1 }, s);
    assert.equal(m.freeSwitch, false); assert.equal(m.fastSwitch, false);
  });
  await test("料理每人每轮一次，减普攻費使用后消耗，换轮恢复", () => {
    const m = T.freshMemory(), s = state({ hand: hand("smoked", "draw"), dice: { Electro: 2 } });
    const food = T.choose(s, m); assert.equal(food.id, "smoked");
    T.commit(m, food, s);
    assert.equal(T.skillCost(0, "NA", m).any, 1);
    assert.notEqual(T.choose(s, m).id, "smoked");
    T.commit(m, { type: "skill", who: 0, skill: "NA" }, s);
    assert.equal(m.normalDiscount[0], 0);
    T.nextRound(m); assert.equal(m.food[0], false);
  });
  await test("低血治疗、防伤；未知敌方血量不算可击倒", () => {
    const m = T.freshMemory(), s = state({ hand: hand("lotus", "sweet") });
    s.characters[0].hp = 3;
    assert.equal(T.choose(s, m).id, "lotus");
    s.hand = hand("sweet"); assert.equal(T.choose(s, m).id, "sweet");
    s.active = 2; m.raidenBurst = true; m.colleiBurst = true; m.dendroRound = 0;
    s.hand = hand("gambler"); s.enemies.forEach(e => { e.hp = null; e.dead = null; });
    assert.notEqual(T.choose(s, m).id, "gambler");
  });
  await test("柯莱天赋按三草骰执行并指定柯莱", () => {
    const m = T.freshMemory(), s = state({ active: 1, hand: hand("talent"), dice: { Dendro: 3 } });
    m.raidenBurst = true;
    const action = T.choose(s, m);
    assert.equal(action.id, "talent"); assert.equal(action.target, 1);
  });
  await test("雷楔代替付费切刻晴；满能但Q付不起可用雷楔，Q可达时保留大招", () => {
    const m = T.freshMemory(), s = state({ active: 1, hand: hand("wedge"), dice: { Electro: 3 } });
    m.raidenBurst = true; m.colleiBurst = true; m.dendroRound = 0;
    assert.equal(T.choose(s, m).id, "wedge");
    s.characters[2].energy = 3;
    assert.equal(T.choose(s,m).id,"wedge");
    s.dice={Electro:5};
    assert.notEqual(T.choose(s, m).id, "wedge");
  });
  await test("冻结角色不释放技能；已经倒下的雷神不继续启动", () => {
    const m = T.freshMemory(), s = state();
    s.characters[0].frozen = true;
    assert.notEqual(T.choose(s, m).who, 0);
    s.characters[0] = { hp: 0, energy: 0, dead: true, frozen: false };
    assert.equal(T.intent(s, m).who, 2); // Eight Electro makes Keqing E payable; no dead startup queue.
  });
  await test("仅点击按钮不等于成功；快速行动不依赖换回合", () => {
    const b = state({ hand: hand("woven", "draw") }), a = clone(b);
    const action = { type: "card", id: "woven", index: 0 };
    assert.equal(T.verify(action, b, a), false);
    a.hand = hand("draw"); a.dice.Electro++;
    assert.equal(T.verify(action, b, a), true);
    assert.equal(a.turn, "user");
  });
  await test("同名重复牌按多重集合验证，替换别的牌不算出牌成功", () => {
    const b = state({ hand: hand("smoked", "smoked", "draw") }), a = clone(b);
    a.hand = hand("smoked", "draw");
    assert.equal(T.verify({ type: "card", id: "smoked" }, b, a), true);
    a.hand = hand("smoked", "smoked");
    assert.equal(T.verify({ type: "card", id: "smoked" }, b, a), false);
  });
  await test("调和必须同时减少正确手牌且实际转换一个元素骰", () => {
    const b = state({ hand: hand("mint"), dice: { Pyro: 3 } }), a = clone(b);
    a.hand = []; a.dice = { Pyro: 2, Electro: 1 };
    const action = { type: "tune", id: "mint", element: "Electro" };
    assert.equal(T.verify(action, b, a), true);
    a.dice = { Pyro: 3 };
    assert.equal(T.verify(action, b, a), false);
  });
  await test("过牌后实际手牌数量增加，而不是假设净增两牌", () => {
    const b = state({ hand: hand("draw", "sweet") }), a = clone(b);
    assert.equal(T.verify({ type: "card", id: "draw" }, b, a), false);
    a.hand = hand("sweet", "voltage", "shift");
    assert.equal(T.verify({ type: "card", id: "draw" }, b, a), true);
  });
  await test("两轮启动/出牌/切人/柯莱Q/雷楔/刻晴Q的合成状态回放", () => {
    const m = T.freshMemory(); T.nextRound(m);
    const s = state({ hand: hand("woven", "voltage", "shift", "sweet"), dice: { Electro: 6, Pyro: 2 } });
    const ids = [];
    function step(mutator) {
      const action = T.choose(s, m); ids.push(action.id || action.skill || action.type);
      const before = clone(s); mutator(action); assert.equal(T.verify(action, before, s), true); T.commit(m, action, before);
      return action;
    }
    step(() => { s.hand = hand("voltage", "shift", "sweet"); s.dice.Electro++; });
    step(() => { s.hand = hand("shift", "sweet"); s.dice.Electro--; s.characters[0].energy++; s.characters[1].energy++; });
    step(() => { s.dice.Pyro = 0; s.dice.Electro--; s.characters[0].energy++; });
    step(() => { s.dice.Electro -= 3; s.characters[0].energy = 0; s.characters[1].energy = 2; s.characters[2].energy = 2; });
    T.nextRound(m); s.dice = { Dendro: 3, Electro: 5 };
    step(() => { s.hand = hand("sweet"); });
    step(() => { s.active = 1; });
    step(() => { s.dice.Dendro = 0; s.characters[1].energy = 0; });
    s.hand = hand("wedge", "sweet");
    step(() => { s.hand = hand("sweet"); s.dice.Electro -= 3; s.characters[2].energy = 3; s.active = 2; });
    T.nextRound(m); s.dice = { Electro: 8 };
    step(() => { s.dice.Electro -= 4; s.characters[2].energy = 0; });
    assert.deepEqual(ids, ["woven", "voltage", "NA", "Q", "shift", "switch", "Q", "wedge", "Q"]);
  });
  await test("最后一张无资源变化的零费状态牌暂留，空手需独立效果证据", () => {
    const m = T.freshMemory(), s = state({ hand: hand("smoked"), dice: { Electro: 2 } });
    assert.notEqual(T.choose(s, m).id, "smoked");
    const after = clone(s);
    assert.equal(T.emptyHandEffect({ type: "card", id: "smoked" }, s, after, false), false);
    s.hand = hand("woven"); after.dice.Electro++;
    assert.equal(T.emptyHandEffect({ type: "card", id: "woven" }, s, after, false), true);
  });
  await test("食物/装备丢失但骰子未支付不能误认成成功", () => {
    const before = state({ hand: hand("lotus", "sweet") }), after = clone(before);
    after.hand = hand("sweet");
    assert.equal(T.verify({ type: "card", id: "lotus", target: 0 }, before, after), false);
    after.dice.Electro--;
    assert.equal(T.verify({ type: "card", id: "lotus", target: 0 }, before, after), true);
  });
  await test("雷楔的强制切人不消耗手动切换的减费/快切状态", () => {
    const m = T.freshMemory(); m.freeSwitch = true; m.fastSwitch = true;
    T.commit(m, { type: "card", id: "wedge", target: 2 }, state());
    assert.equal(m.freeSwitch, true); assert.equal(m.fastSwitch, true);
  });
  // A fake host checks adapter lifetime/cancellation behavior. It is NOT screenshot/OCR accuracy evidence.
  const counters = { frames: 0, disposed: 0, gray: 0, mats: 0 };
  // Mirrors LimitedFile's extension whitelist; an unconditional true mock missed the startup bug.
  const allowedWriteExtensions = new Set([".txt", ".json", ".log", ".csv", ".xml", ".html", ".css", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"]);
  // GlobalMethod.Click/MoveMouseTo are Action<int,int>, not unrestricted JS functions.
  function hostInput(name, x, y) {
    for (const [i, value] of [x, y].entries()) {
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
        throw new Error("Invalid argument specified for parameter 'arg" + (i + 1) + "' (" + name + ")");
      }
    }
    if (x < 0 || x > 1920 || y < 0 || y > 1080) throw new Error("鼠标坐标超出游戏窗口范围");
  }
  const mock = {
    TCG: T, console, settings: {}, Date, Set, Map,
    file: { createDirectory: () => true, writeTextSync: p => allowedWriteExtensions.has(path.extname(p).toLowerCase()),
      readImageMatSync: p => ({ p, empty: () => false, dispose: () => { counters.mats++; } }) },
    RecognitionObject: { Ocr: (...roi) => ({ roi }), TemplateMatch: (mat, ...roi) => ({ mat, roi,
      templateImageGreyMat: { dispose: () => { counters.gray++; } } }) },
    sleep: async ms => { assert.ok(Number.isInteger(ms) && ms >= 0 && ms <= 2147483647, "Sleep(int) requires nonnegative Int32"); },
    click: (x,y) => hostInput("click",x,y), moveMouseTo: (x,y) => hostInput("moveMouseTo",x,y),
    leftButtonDown: () => {}, leftButtonUp: () => {}, log: { warn: () => {}, info: () => {} },
    captureGameRegion: () => {
      counters.frames++; let disposed = false;
      return { width: 1920, height: 1080, dispose: () => { disposed = true; counters.disposed++; },
        Find: () => ({ isExist: () => { assert.equal(disposed, false); return false; } }),
        FindMulti: () => ({ get count() { assert.equal(disposed, false); return 0; } }) };
    }
  };
  const hostContext = vm.createContext(mock);
  vm.runInContext(fs.readFileSync(process.env.TCG_TEST_BGI || path.join(base, "lib/bgi.js"), "utf8"), hostContext);
  const Host = hostContext.TCGBetterGI.BetterGIHost;
  await test("敌方四人布局不被默认三人截断，三人与一人、四人与两人重叠以完整布局为准",()=>{
    for(const count of [1,2,3,4])for(let active=0;active<count;active++){
      const h=new Host({enemyCount:3}),xs={1:[856],2:[751,962],3:[646,856,1066],4:[541,751,961,1171]},hp=xs[count].map((_,i)=>7+i);
      h.hpAt=(_,x,y)=>{const i=xs[count].findIndex(v=>Math.abs(v-x)<=1);return i>=0&&y===(i===active?212:170)?String(hp[i]):"";};h.has=()=>false;
      const es=h.enemiesIn({});assert.equal(es.length,count);assert.deepEqual(clone(es.map(e=>e.hp)),hp);assert.equal(es.findIndex(e=>e.active),active);h.dispose();
    }
  });
  await test("部分外侧敌方HP仍可见时不误认内侧两人；完整布局矛盾仍返回未知",()=>{
    const h=new Host({enemyCount:3});h.characterIn=(_,who,enemy,count)=>{
      if(count===4)return [{hp:7,dead:false,active:false},{hp:8,dead:false,active:true},{hp:9,dead:false,active:false},{hp:null,dead:null,active:null}][who];
      if(count===2)return {hp:who===0?8:9,dead:false,active:who===0};return {hp:null,dead:null,active:null};};
    assert.ok(h.enemiesIn({}).every(e=>e.hp===null));h.characterIn=(_,who)=>({hp:4,dead:false,active:who===0});assert.ok(h.enemiesIn({}).every(e=>e.hp===null));h.dispose();
  });
  function rerollFixture(options={}) {
    const h=new Host({enemyCount:3}),clicks=[],events=[];
    const before=state({dice:{Dendro:1,Cryo:2,Anemo:2},hand:hand("toss","exile")}),memory=T.freshMemory();
    memory.raidenBurst=true;memory.freeSwitch=true;before.characters[1].energy=2;
    let remaining=2,pending=null,lag=0,reads=0,confirms=0,selectedDrop=false;
    let items=["Dendro","Cryo","Anemo","Cryo","Anemo"].map((element,i)=>({element,x:730+(i%3)*230,y:407+245*Math.floor(i/3)}));
    h.frame=fn=>{reads++;
      if(pending!==null && --lag<=0){remaining=pending;pending=null;
        if(!options.staleBlank)items=items.map((d,i)=>({...d,element:!options.noBad&&i===1&&remaining===1?"Cryo":"Dendro"}));}
      return fn({});};
    h.phaseIn=()=>options.transition&&pending!==null ? {phase:"unknown",turn:"none"} :
      remaining===0?{phase:"board",turn:"user"}:{phase:"roll",turn:"none"};
    h.ocr=(_,roi)=>{if(roi[1]===167)return "重投骰子";
      if(roi[1]===230)return options.wrongSubtitle?"未知页面":"请选择要重投的骰子";
      assert.deepEqual(clone(roi),[700,835,520,65]);
      if(options.counterless && remaining===1 && (!options.ack || confirms===1))return "";
      if(options.missing || options.transient && reads===1)return "";
      if(options.transient && clicks.length>0 && !selectedDrop){selectedDrop=true;return "";}
      return "还可重投"+remaining+"轮";};
    h.matches=(_,asset,roi)=>{
      if(asset==="core/确定"){assert.deepEqual(clone(roi),[500,900,920,150]);return options.badControl?[]:[{x:943,y:932,w:64,h:31}];}
      const element=asset.split("NativeRoll")[1];return items.filter(d=>d.element===element).map(d=>({x:d.x-20,y:d.y-20,w:40,h:40}));};
    h.clickAt=(x,y)=>{clicks.push([x,y]);if(x===975&&y===947.5){confirms++;pending=options.ack&&confirms===2?1:remaining-1;lag=4;}
      else assert.ok(items.some(d=>d.x===x&&d.y===y&&d.element!=="Dendro"),"only off-goal dice are selected");};
    h.trace=(event,data)=>events.push({event,data});h.captureEvidence=()=>{};
    if(options.noBad)items=items.map(d=>({...d,element:"Dendro"}));
    return {h,before,memory,clicks,events,stats:()=>({reads,confirms,selectedDrop})};
  }
  await test("战中五骰两轮重投：底部原生计数、柯莱保草、迟到旧计数不重复确认",async()=>{
    const r=rerollFixture();await r.h.actionReroll(r.before,r.memory);
    assert.equal(r.stats().confirms,2);assert.equal(r.clicks.length,7);assert.equal(r.h.tossSession,null);
    assert.deepEqual(r.events.filter(e=>e.event==="action-reroll-confirmed").map(e=>[e.data.remaining,e.data.selected,e.data.wanted]),[[2,4,"Dendro"],[1,1,"Dendro"]]);
    assert.equal(r.memory.round,0);r.h.dispose();
  });
  await test("战中重投短暂OCR缺失仅重读，选骰之后不会再点击相同骰子",async()=>{
    const r=rerollFixture({transient:true});await r.h.actionReroll(r.before,r.memory);assert.equal(r.stats().confirms,2);assert.equal(r.clicks.length,7);assert.equal(r.stats().selectedDrop,true);r.h.dispose();
  });
  await test("战中重投全为目标骰时只确认两轮，不点击骰子或检视手牌",async()=>{
    const r=rerollFixture({noBad:true});r.h.readHand=()=>{throw new Error("rerolls must not read hand");};
    await r.h.actionReroll(r.before,r.memory);assert.equal(r.clicks.length,2);assert.equal(r.stats().confirms,2);r.h.dispose();
  });
  for(const option of ["missing","badControl"])await test("战中重投持续"+option+"有界等待，零确认零重复选择",async()=>{
    const r=rerollFixture({[option]:true});await assert.rejects(r.h.actionReroll(r.before,r.memory),/重投等待超时/);
    assert.equal(r.stats().reads,60);assert.equal(r.clicks.length,0);r.h.dispose();
  });
  await test("一掷乾坤第二页无计数但骰子已变化：保目标骰，两次确认后回牌桌",async()=>{
    const r=rerollFixture({counterless:true});await r.h.actionReroll(r.before,r.memory);
    assert.equal(r.stats().confirms,2);assert.equal(r.clicks.length,7);
    assert.equal(r.events.filter(e=>e.event==="action-reroll-confirmed")[1].data.remaining,null);r.h.dispose();
  });
  for(const option of ["staleBlank","wrongSubtitle"])await test("无计数后续页拒绝"+option+"，不重选或重确认",async()=>{
    const r=rerollFixture({counterless:true,[option]:true});await assert.rejects(r.h.actionReroll(r.before,r.memory),/重投等待超时/);
    assert.equal(r.stats().confirms,1);assert.equal(r.clicks.length,5);r.h.dispose();
  });
  await test("无计数后续页骰面相同，仅已观察到本次确认后的转场才放行",async()=>{
    const r=rerollFixture({counterless:true,noBad:true,transition:true});
    await r.h.actionReroll(r.before,r.memory);assert.equal(r.stats().confirms,2);assert.equal(r.clicks.length,2);r.h.dispose();
  });
  await test("无计数后续确认后若明确再显示1轮，允许有界第三确认而非假定已结束",async()=>{
    const r=rerollFixture({counterless:true,ack:true});const proof=await r.h.actionReroll(r.before,r.memory);
    assert.equal(r.stats().confirms,3);assert.equal(proof.confirmations,2);assert.equal(proof.inputConfirmations,3);r.h.dispose();
  });
  await test("战中1/5/8/16骰全部按行动布局，不误套开局4乘2槽",()=>{
    for(const count of [1,5,8,16]){
      const h=new Host({enemyCount:3});h.matches=(_,asset,roi,threshold,color)=>{
        assert.deepEqual(clone(roi),[320,280,1280,560]);assert.equal(threshold,.73);assert.equal(color,true);
        return asset.endsWith("Dendro")?Array.from({length:count},(_,i)=>({x:450+(i%8)*140,y:380+250*Math.floor(i/8),w:40,h:40})):[];};
      const d=h.diceIn({},true,count,true);assert.equal(d.items.length,count);assert.equal(d.dice.Dendro,count);h.dispose();
    }
  });
  await test("实际用到的39张模板均随包存在，16张官方骰子模板保留彩色", () => {
    const names=["user_turn","enemy_turn","charge","uncharge","disable","state/StateFreeze","hand_rim",
      ...[5,6,7,8,9,10].map(n=>"num/Hand"+n),
      ...["出战角色","对方行动中","回合结束","回合结算阶段","角色状态_冻结","角色状态_冻结2","角色状态_水泡","确定","元素调和","元素骰子不足"].map(n=>"core/"+n),
      ...["Roll","Main"].flatMap(mode=>["Pyro","Hydro","Anemo","Electro","Dendro","Cryo","Geo","Omni"].map(e=>"dice/Native"+mode+e))];
    assert.equal(names.length,39);
    for(const name of names){const bytes=fs.readFileSync(path.join(base,"assets",name+".png"));
      assert.equal(bytes.subarray(1,4).toString("ascii"),"PNG");
      if(name==="hand_rim"){assert.equal(bytes.readUInt32BE(16),6);assert.equal(bytes.readUInt32BE(20),90);}
      if(name.startsWith("dice/Native"))assert.ok([2,6].includes(bytes[25]),"official dice PNG should not be grayscale: "+name);
    }
  });
  await test("原生草骰0.829/风骰0.716按跨模板分差复核而非遍历顺序", () => {
    const h=new Host({enemyCount:3});
    h.matches=(_,asset,roi,threshold)=>{
      if(asset.endsWith("Dendro")&&threshold<=.829)return [{x:1854,y:370,w:26,h:22}];
      if(asset.endsWith("Anemo")&&threshold<=.716)return [{x:1856,y:370,w:23,h:24},...(threshold===.7?[{x:1856,y:507,w:23,h:24}]:[])];
      return [];
    };
    const result=h.frame(f=>h.diceIn(f));assert.equal(T.total(result.dice),2);
    assert.equal(result.dice.Dendro,1);assert.equal(result.dice.Anemo,1);
    h.matches=(_,asset)=>/Dendro|Anemo/.test(asset)?[{x:1855,y:370,w:24,h:24}]:[];
    assert.throws(()=>h.frame(f=>h.diceIn(f)),/仍不唯一/);h.dispose();
  });
  await test("原生0.783及0.759草骰保留，官方0.7门槛不提高但近似分数拒绝", () => {
    const h=new Host({enemyCount:3});let scores={Dendro:.782828,Anemo:.706169};
    h.matches=(_,asset,roi,threshold)=>{
      const e=asset.split("NativeMain")[1];return scores[e]>=threshold?[{x:1854,y:233,w:26,h:22}]:[];
    };
    try{assert.equal(h.frame(f=>h.diceIn(f)).dice.Dendro,1);
      scores={Dendro:.78,Anemo:.75};assert.throws(()=>h.frame(f=>h.diceIn(f)),/分差不足/);
      scores={Dendro:.759,Anemo:.707};assert.equal(h.frame(f=>h.diceIn(f)).dice.Dendro,1);
      scores={Dendro:.728,Anemo:.701};assert.throws(()=>h.frame(f=>h.diceIn(f)),/分差不足/);
    }finally{h.dispose();}
  });
  await test("执行前一帧漏冰骰恢复后需连续两帧匹配，持续变化不放行", async () => {
    const h=new Host({enemyCount:3});const before={phase:"board",turn:"user",active:0,dice:{Electro:1,Cryo:2},characters:[]};
    let i=0;h.board=()=>++i===1?{...before,dice:{Electro:1,Cryo:1}}:before;
    try{assert.equal(await h.requireUnchangedBoard(before),before);assert.equal(i,3);
      i=0;h.board=()=>{i++;return {...before,dice:{Electro:1,Cryo:1}};};
      await assert.rejects(h.requireUnchangedBoard(before),e=>e.code==="TCG_STATE_REFRESH");assert.equal(i,6);
      h.board=()=>{throw new Error("host failure");};await assert.rejects(h.requireUnchangedBoard(before),/host failure/);
    }finally{h.dispose();}
  });
  // Locations measured by OpenCV on saved native frames, not a live-host result.
  const nativeRollSample = [
    {element:"Omni",x:595,y:381,w:51,h:43},
    {element:"Anemo",x:824,y:383,w:44,h:43},
    {element:"Anemo",x:1049,y:383,w:44,h:43},
    {element:"Hydro",x:1275,y:381,w:44,h:43},
    {element:"Omni",x:599,y:628,w:51,h:43},
    {element:"Anemo",x:825,y:629,w:44,h:43},
    {element:"Cryo",x:1050,y:631,w:45,h:41},
    {element:"Pyro",x:1275,y:625,w:42,h:45}
  ];
  const nativeMainSample = [
    {element:"Omni",x:1855,y:188,w:24,h:23},
    {element:"Omni",x:1855,y:233,w:24,h:23},
    {element:"Electro",x:1855,y:279,w:23,h:24},
    {element:"Electro",x:1855,y:325,w:23,h:24},
    {element:"Hydro",x:1854,y:371,w:26,h:23},
    {element:"Hydro",x:1854,y:416,w:26,h:23},
    {element:"Geo",x:1856,y:462,w:23,h:22},
    {element:"Anemo",x:1856,y:507,w:23,h:24}
  ];
  function diceFixture(candidates, roll = true) {
    let disposed = false;
    return {width:1920,height:1080,
      dispose:()=>{assert.equal(disposed,false);disposed=true;},
      FindMulti:ro=>{
        assert.equal(disposed,false);
        assert.equal(ro.Use3Channels,true,"native dice must not fall back to grayscale");
        assert.equal(ro.threshold,roll?.73:.7);
        assert.deepEqual(ro.roi,roll?[553,330,819,411]:[1848,177,38,737]);
        const name = /^assets\/dice\/Native(Roll|Main)(\w+)\.png$/.exec(ro.mat.p);
        assert.ok(name,"official dice assets must be used together with color matching");
        assert.equal(name[1],roll?"Roll":"Main");
        const found=candidates.filter(c=>c.element===name[2]).map(({x,y,w,h})=>({x,y,width:w,height:h}));
        found.count=found.length;return found;
      }
    };
  }
  await test("17点26真实骰子采样经实际matches与diceIn按官方彩色参数读全八格", () => {
    const h=new Host({enemyCount:3}),f=diceFixture(nativeRollSample);
    try {const result=h.diceIn(f,true);
      assert.deepEqual(clone(result.items.map(d=>d.slot)),[0,1,2,3,4,5,6,7]);
      assert.deepEqual(clone(result.items.map(d=>d.element)),["Omni","Anemo","Anemo","Hydro","Omni","Anemo","Cryo","Pyro"]);
      assert.deepEqual(clone(result.dice),{Pyro:1,Hydro:1,Anemo:3,Electro:0,Dendro:0,Cryo:1,Geo:0,Omni:2});
      assert.ok(result.items.every(d=>Number.isInteger(d.x)&&Number.isInteger(d.y)));
      assert.equal(h.templates.size,8);
    }finally{f.dispose();h.dispose();}
  });
  await test("17点06行动页骰子采样按官方彩色0.7读出8骰，不改变费用预算", () => {
    const h=new Host({enemyCount:3}),f=diceFixture(nativeMainSample,false);
    try {const result=h.diceIn(f,false);assert.equal(result.items.length,8);
      assert.deepEqual(clone(result.dice),{Pyro:0,Hydro:2,Anemo:1,Electro:2,Dendro:0,Cryo:0,Geo:1,Omni:2});
    }finally{f.dispose();h.dispose();}
  });
  await test("模板缓存区分彩色和灰度识别对象，同一个Mat不重复加载", () => {
    const h=new Host({enemyCount:3}),objects=[];
    const f={FindMulti:ro=>{objects.push(ro);return {count:0};}};
    try {h.matches(f,"dice/NativeRollPyro",[553,330,819,411],.73,false);
      h.matches(f,"dice/NativeRollPyro",[553,330,819,411],.73,true);
      h.matches(f,"dice/NativeRollPyro",[553,330,819,411],.73,true);
      assert.notEqual(objects[0],objects[1]);assert.equal(objects[1],objects[2]);
      assert.equal(objects[0].Use3Channels,false);assert.equal(objects[1].Use3Channels,true);
      assert.equal(h.templates.size,1);assert.equal(h.roCache.size,2);
    }finally{h.dispose();}
  });
  await test("重投只认出七颗时给出可复读错误，绝不补猜缺失的火骰", () => {
    const h=new Host({enemyCount:3}),f=diceFixture(nativeRollSample.slice(0,7)),events=[];
    h.trace=(event,data)=>events.push({event,data});
    try {assert.throws(()=>h.diceIn(f,true),e=>e.code==="TCG_DICE_RETRY"&&/数量异常：7/.test(e.message));
      assert.equal(events.length,1);assert.equal(events[0].data.items.length,7);
    }finally{f.dispose();h.dispose();}
  });
  await test("总计八个命中但同格重复时拒绝，不能掩盖另一格缺骰", () => {
    const h=new Host({enemyCount:3}),candidates=clone(nativeRollSample);
    candidates[7]={element:"Pyro",x:1100,y:625,w:42,h:45};
    const f=diceFixture(candidates);
    try {assert.throws(()=>h.diceIn(f,true),e=>e.code==="TCG_DICE_RETRY"&&/位置重复/.test(e.message));}
    finally{f.dispose();h.dispose();}
  });
  await test("同一颗被不同元素模板命中时拒绝分类，不能双计万能骰", () => {
    const h=new Host({enemyCount:3}),candidates=clone(nativeRollSample);
    candidates.push({...candidates[0],element:"Geo"});const f=diceFixture(candidates);
    try {assert.throws(()=>h.diceIn(f,true),e=>e.code==="TCG_DICE_RETRY"&&/多模板/.test(e.message));}
    finally{f.dispose();h.dispose();}
  });
  await test("实际重投方法遇到7到8到8恢复后才选骰并只确认一次", async () => {
    const h=new Host({enemyCount:3}),m=T.freshMemory(),old={capture:mock.captureGameRegion,click:mock.click,sleep:mock.sleep};
    let reads=0,disposed=0,confirms=0;const inputs=[],delays=[];
    mock.captureGameRegion=()=>{const f=diceFixture(reads++===0?nativeRollSample.slice(0,7):nativeRollSample),release=f.dispose;
      f.dispose=()=>{release();disposed++;};return f;};
    mock.click=(x,y)=>{assert.ok(reads>=3,"no dice selection before two complete equal classifications");hostInput("click",x,y);inputs.push([x,y]);};
    mock.sleep=async ms=>delays.push(ms);
    h.phase=()=>({phase:confirms?"board":"roll",turn:confirms?"user":"none"});
    h.clickButton=async()=>{assert.equal(reads,3);assert.equal(inputs.length,6);confirms++;};
    try {await h.roll(m);assert.equal(reads,3);assert.equal(disposed,3);assert.equal(confirms,1);assert.equal(m.round,1);
      assert.equal(delays.filter(ms=>ms===500).length,3);
      assert.equal(inputs.length,6);assert.ok(!inputs.some(([x,y])=>x===621&&y===403||x===625&&y===650));
    }finally{mock.captureGameRegion=old.capture;mock.click=old.click;mock.sleep=old.sleep;h.dispose();}
  });
  for(const instability of ["missing","alternating"]) {
    await test("骰子持续"+instability+"时12次有界停止且不选骰、不确认、不记新轮", async () => {
      const h=new Host({enemyCount:3}),m=T.freshMemory(),old={capture:mock.captureGameRegion,click:mock.click,sleep:mock.sleep};
      let reads=0,disposed=0,inputs=0,confirms=0,waits=0;
      mock.captureGameRegion=()=>{const candidates=clone(nativeRollSample);
        if(instability==="missing")candidates.pop();else candidates[7].element=reads%2?"Pyro":"Electro";
        reads++;const f=diceFixture(candidates),release=f.dispose;f.dispose=()=>{release();disposed++;};return f;};
      mock.click=()=>inputs++;mock.sleep=async ms=>{assert.equal(ms,500);waits++;};
      h.phase=()=>({phase:"roll",turn:"none"});h.clickButton=async()=>confirms++;
      try {await assert.rejects(h.roll(m),/12次未稳定/);assert.equal(reads,12);assert.equal(disposed,12);
        assert.equal(waits,11);assert.equal(inputs,0);assert.equal(confirms,0);assert.equal(m.round,0);
      }finally{mock.captureGameRegion=old.capture;mock.click=old.click;mock.sleep=old.sleep;h.dispose();}
    });
  }
  await test("unknown页会清掉骰子稳定证据，必须重新取得两次完整读取", async () => {
    const h=new Host({enemyCount:3}),old=mock.captureGameRegion;let phaseReads=0,reads=0;
    h.phase=()=>({phase:["roll","unknown","roll","roll"][phaseReads++]});
    mock.captureGameRegion=()=>{reads++;return diceFixture(nativeRollSample);};
    try {const result=await h.readRollDice();assert.equal(result.items.length,8);assert.equal(phaseReads,4);assert.equal(reads,3);}
    finally{mock.captureGameRegion=old;h.dispose();}
  });
  await test("读骰等待中离开投骰页就停止，不确认旧页面", async () => {
    const h=new Host({enemyCount:3}),old=mock.captureGameRegion;let phaseReads=0,reads=0,inputs=0;
    h.phase=()=>({phase:phaseReads++===0?"roll":"board",turn:"user"});h.clickAt=()=>inputs++;
    mock.captureGameRegion=()=>{reads++;return diceFixture(nativeRollSample);};
    try {await assert.rejects(h.readRollDice(),/离开投骰页/);assert.equal(reads,1);assert.equal(inputs,0);}
    finally{mock.captureGameRegion=old;h.dispose();}
  });
  for(const failure of ["missing-asset","host-api"]) {
    await test("骰子"+failure+"错误不伪装成识别不稳定而吞掉重试", async () => {
      const h=new Host({enemyCount:3}),old={capture:mock.captureGameRegion,read:mock.file.readImageMatSync,sleep:mock.sleep};
      let reads=0,disposed=0,waits=0;
      h.phase=()=>({phase:"roll",turn:"none"});
      mock.captureGameRegion=()=>{reads++;return {width:1920,height:1080,dispose:()=>disposed++,FindMulti:()=>{throw new Error("native-host-canary");}};};
      mock.sleep=async()=>waits++;
      if(failure==="missing-asset")mock.file.readImageMatSync=()=>({empty:()=>true,dispose:()=>{}});
      try {await assert.rejects(h.readRollDice(),failure==="missing-asset"?/缺少模板/:/native-host-canary/);
        assert.equal(reads,1);assert.equal(disposed,1);assert.equal(waits,0);
      }finally{mock.captureGameRegion=old.capture;mock.file.readImageMatSync=old.read;mock.sleep=old.sleep;h.dispose();}
    });
  }
  function hpFixture(textAt, failAt = "", precision = false) {
    const previous = {cv:mock.OpenCvSharp,region:mock.ImageRegion};
    const counts = {crops:0,cropDisposed:0,mats:0,matDisposed:0,regions:0,regionDisposed:0,frameDisposed:0};
    mock.OpenCvSharp = {OpenCvSharp:{Size:class Size {
      constructor(width,height){assert.ok(Number.isInteger(width)&&Number.isInteger(height));
        if(failAt==="size")throw new Error("fixture size failure");this.width=width;this.height=height;}
    }}};
    mock.ImageRegion = class ImageRegion {
      constructor(mat,x,y){assert.deepEqual([x,y],[0,0]);
        if(failAt==="wrap")throw new Error("fixture wrap failure");counts.regions++;this.mat=mat;this.released=false;}
      Find(ro){assert.equal(this.released,false);assert.equal(this.mat.released,false);
        assert.deepEqual(ro.roi,precision?[0,0,224,160]:[0,0,132,120]);if(failAt==="ocr")throw new Error("fixture ocr failure");
        const text=textAt(this.mat.roi);return {text,isExist:()=>!!text};}
      dispose(){assert.equal(this.released,false);this.released=true;counts.regionDisposed++;this.mat.dispose();}
    };
    const f = {width:1920,height:1080,released:false,
      Find:()=>({text:"",isExist:()=>false}),
      DeriveCrop:(...roi)=>{assert.equal(f.released,false);assert.deepEqual(roi.slice(2),precision?[56,40]:[44,40]);
        if(failAt==="crop")throw new Error("fixture crop failure");counts.crops++;let cropReleased=false;
        return {SrcMat:{Resize:size=>{assert.equal(cropReleased,false);assert.equal(f.released,false);
          assert.deepEqual([size.width,size.height],precision?[224,160]:[132,120]);if(failAt==="resize")throw new Error("fixture resize failure");
          counts.mats++;const mat={roi,released:false,dispose:()=>{assert.equal(mat.released,false);mat.released=true;counts.matDisposed++;}};return mat;}},
          dispose:()=>{assert.equal(cropReleased,false);cropReleased=true;counts.cropDisposed++;}};},
      dispose:()=>{assert.equal(f.released,false);f.released=true;counts.frameDisposed++;}};
    return {f,counts,restore:()=>{mock.OpenCvSharp=previous.cv;mock.ImageRegion=previous.region;},
      check:()=>{assert.equal(counts.crops,counts.cropDisposed);assert.equal(counts.mats,counts.matDisposed);assert.equal(counts.regions,counts.regionDisposed);}};
  }
  await test("原生小血量ROI无文本时仅放大44乘40数字裁剪，保持1080P帧与坐标", () => {
    const sample=hpFixture(roi=>roi.join(",")==="654,600,44,40"?"10":""),h=new Host({enemyCount:3});
    try {assert.equal(h.hpAt(sample.f,646,600),"10");assert.equal(sample.f.width,1920);assert.equal(sample.f.height,1080);
      assert.equal(sample.counts.crops,1);assert.equal(sample.counts.mats,1);sample.check();}
    finally {sample.restore();h.dispose();}
  });
  for(const failAt of ["crop","size","resize","wrap","ocr"]) {
    await test("血量局部处理异常仍释放已创建资源且不双重释放："+failAt, () => {
      const sample=hpFixture(()=>"10",failAt),h=new Host({enemyCount:3});
      try {assert.throws(()=>h.hpAt(sample.f,646,600),new RegExp("fixture "+failAt+" failure"));sample.check();}
      finally {sample.restore();h.dispose();}
    });
  }
  await test("17点06真实截图的采样OCR经实际board读取10/11/10与4/8/4及雷神出战", () => {
    // These strings are outputs from CPU evaluation of the installed V4 models
    // on the native screenshot. This host fixture is not the live .NET engine.
    const readings={"654,600,44,40":"10","864,640,44,40":"11","1074,640,44,40":"10",
      "654,212,44,40":"4","864,170,44,40":"8","1074,170,44,40":"4"};
    const sample=hpFixture(roi=>readings[roi.join(",")]||""),h=new Host({enemyCount:3}),oldCapture=mock.captureGameRegion;
    const events=[];h.trace=(event,data)=>events.push({event,data});h.has=()=>false;
    h.phaseIn=()=>({phase:"board",turn:"user"});
    h.matches=(f,asset,roi)=>asset==="uncharge"?Array([2,2,3][[812,1022,1233].indexOf(roi[0])]).fill({}):[];
    h.diceIn=()=>({dice:{Hydro:2,Anemo:1,Electro:2,Geo:1,Omni:2},items:[]});
    mock.captureGameRegion=()=>sample.f;
    try {const board=h.board();assert.deepEqual(clone(board.characters.map(c=>c.hp)),[10,11,10]);
      assert.deepEqual(clone(board.enemies.map(c=>c.hp)),[4,8,4]);assert.equal(board.active,0);
      assert.deepEqual(clone(board.characters.map(c=>c.energy)),[0,0,0]);assert.equal(T.legalState({...board,hand:[]}),true);
      assert.equal(events.filter(e=>e.event==="hp-read").length,13);assert.equal(sample.counts.crops,26);
      assert.equal(sample.counts.frameDisposed,1);sample.check();}
    finally {mock.captureGameRegion=oldCapture;sample.restore();h.dispose();}
  });
  await test("血量OCR不接受A作4、混合文字、拼接数字或越过角色上限", () => {
    const h=new Host({enemyCount:3});h.has=()=>false;h.matches=()=>[];
    try {for(const raw of ["A","10HP","1 0","101","12","","0"]) {
      h.hpAt=(f,x,y)=>y===600?raw:"";const c=h.characterIn({},0);assert.equal(c.hp,null);assert.equal(c.raised,false);
    }}finally {h.dispose();}
  });
  await test("血量上下两个位置都有合法数字时不偏选上方或伪造出战角色", () => {
    const h=new Host({enemyCount:3});h.has=()=>false;h.matches=()=>[];h.hpAt=()=>"10";
    try {const c=h.characterIn({},0);assert.equal(c.hp,null);assert.equal(c.raised,false);assert.equal(c.dead,null);}
    finally {h.dispose();}
  });
  await test("相同血量诊断不重复刷屏，读取变化保留原始OCR和位置证据", () => {
    const h=new Host({enemyCount:3}),events=[];let hp="10";h.has=()=>false;h.matches=()=>[];
    h.hpAt=(f,x,y)=>y===600?hp:"";h.trace=(event,data)=>events.push({event,data});
    try {h.characterIn({},0);h.characterIn({},0);hp="9";h.characterIn({},0);
      assert.equal(events.length,2);assert.deepEqual(clone(events[0].data.raw),["10",""]);assert.equal(events[1].data.hp,9);}
    finally {h.dispose();}
  });
  await test("角色标题刻睛和刻晴交替仍需两次同身份，原始OCR写日志", async () => {
    const h=new Host({enemyCount:3}),samples=["刻睛","刻晴"],events=[];let reads=0;
    h.ocr=()=>samples[reads++];h.trace=(event,data)=>events.push({event,data});
    try {assert.equal(T.characterName(await h.titleAt(1175,720,false,false,"character",2)),2);
      assert.equal(reads,2);assert.deepEqual(clone(events.find(e=>e.event==="title-read").data.reads),samples);}
    finally {h.dispose();}
  });
  await test("标题出现暂空或旧角色后有界读取新标题，不重新点角色", async () => {
    const h=new Host({enemyCount:3}),oldClick=mock.click,inputs=[],samples=["","柯莱","柯莱","刻睛","刻晴"];let reads=0;
    mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};h.ocr=()=>samples[reads++];
    try {assert.equal(T.characterName(await h.titleAt(1175,720,false,false,"character",2)),2);
      assert.equal(reads,5);assert.deepEqual(inputs,[[1175,720]]);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("标题六次不稳定或始终空时退出，不能无限复读或拼出卡名", async () => {
    const h=new Host({enemyCount:3});let reads=0;h.ocr=()=>++reads%2?"星天之兆":"甜甜花酿鸡";
    try {assert.equal(await h.titleAt(719,945),"");assert.equal(reads,6);
      reads=0;h.ocr=()=>{reads++;return "";};assert.equal(await h.titleAt(719,945),"");assert.equal(reads,6);}
    finally {h.dispose();}
  });
  await test("手牌标题暂时空后可稳定读取，但不同卡名不会按相似字放行", async () => {
    const h=new Host({enemyCount:3});let reads=0;h.ocr=()=>["","星天之兆","星天之兆"][reads++];
    try {assert.equal(await h.titleAt(719,945),"星天之兆");assert.equal(reads,3);}
    finally {h.dispose();}
  });
  await test("核队接受日志中的刻睛且输出规范队名，真错序仍拒绝", async () => {
    const h=new Host({enemyCount:3}),events=[];h.reset=async()=>{};h.trace=(event,data)=>events.push({event,data});
    let reads=0;h.titleAt=async()=>["雷电将军","柯莱","刻睛"][reads++];
    try {await h.validateTeam();assert.deepEqual(clone(events.find(e=>e.event==="team").data),["雷电将军","柯莱","刻晴"]);
      reads=0;h.titleAt=async()=>["刻睛","柯莱","雷电将军"][reads++];await assert.rejects(h.validateTeam(),/第 1 位/);}
    finally {h.dispose();}
  });
  await test("重投必须在投骰页，错误页面不选择骰子也不推进轮次", async () => {
    const h=new Host({enemyCount:3}),oldClick=mock.click;let inputs=0;mock.click=()=>{inputs++;};
    h.phase=()=>({phase:"board",turn:"user"});h.frame=()=>({items:[],dice:{}});
    const m=T.freshMemory();try {await assert.rejects(h.roll(m),/投骰页/);assert.equal(inputs,0);assert.equal(m.round,0);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("重投确认等待动画后两帧明确牌桌，只确认一次再推进轮次", async () => {
    const h=new Host({enemyCount:3}),m=T.freshMemory();let checks=0,confirms=0;
    const phases=["roll","roll","roll","roll","roll","roll","unknown","roll","board","board"];
    h.phase=()=>({phase:phases[Math.min(checks++,phases.length-1)],turn:checks>=9?"enemy":"none"});
    h.frame=()=>({items:rollItems(),dice:{Electro:8}});
    h.clickButton=async()=>{confirms++;};
    try {await h.roll(m);assert.equal(confirms,1);assert.equal(m.round,1);assert.equal(checks,10);}
    finally {h.dispose();}
  });
  await test("重投无确认进展不推进轮次或重复选骰", async () => {
    const h=new Host({enemyCount:3}),m=T.freshMemory();let confirms=0;
    h.phase=()=>({phase:"roll",turn:"none"});h.frame=()=>({items:rollItems(),dice:{Electro:8}});h.clickButton=async()=>{confirms++;};
    try {await assert.rejects(h.roll(m),/重投确认未生效/);assert.equal(confirms,1);assert.equal(m.round,0);}
    finally {h.dispose();}
  });
  await test("读牌桌容忍一次动画或HP空值，仍必须取得连续两帧有效状态", async () => {
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven")});h.phase=()=>({phase:"board",turn:"user"});h.readHand=async()=>clone(s.hand);
    let reads=0;const invalid=clone(s);invalid.characters[0].hp=null;const frames=[invalid,s,s];h.board=()=>clone(frames[Math.min(reads++,2)]);
    try {const result=await h.observe();assert.equal(result.characters[0].hp,10);assert.equal(reads,5);}
    finally {h.dispose();}
  });
  await test("读手牌期间回合已改变时返回中断，不继续旧局面决策", async () => {
    const h=new Host({enemyCount:3});h.phase=()=>({phase:"board",turn:"user"});h.readHand=async()=>hand("woven");
    h.board=()=>state({turn:"enemy"});
    try {const result=await h.observe();assert.equal(result.turn,"enemy");assert.equal(result.hand,null);}
    finally {h.dispose();}
  });
  await test("行动观察暂时漏骰复读；稳定预算偏差整手同步继续；冲突及宿主错误不吞", async () => {
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven")});let reads=0;
    h.phase=()=>({phase:"board",turn:"user"});h.readHand=async()=>clone(s.hand);h.expectedDice=T.total(s.dice);
    h.board=()=>{reads++;if(reads===1){const e=new Error("ambiguous");e.code="TCG_DICE_RETRY";throw e;}
      if(reads===2){const bad=clone(s);bad.dice.Electro--;return bad;}return clone(s);};
    try{assert.equal(T.total((await h.observe()).dice),h.expectedDice);assert.equal(reads,7);
      h.board=()=>{const bad=clone(s);bad.dice.Electro--;return bad;};const recovered=await h.observe();
      assert.equal(h.expectedDice,T.total(recovered.dice));assert.equal(recovered.dice.Electro,s.dice.Electro-1);
      h.board=()=>{const e=new Error("ambiguous");e.code="TCG_DICE_RETRY";throw e;};await assert.rejects(h.observe(),/12次读取未稳定/);
      h.board=()=>{throw new Error("native failure");};await assert.rejects(h.observe(),/native failure/);
    }finally{h.dispose();}
  });
  await test("11血数字恢复使用水平加宽4倍裁剪，不跨上下槽或把1硬改11，资源完整释放",()=>{
    const sample=hpFixture(roi=>roi.join(",")==="858,600,56,40"?"11":"", "", true),h=new Host({enemyCount:3});
    h.precisionBoard=true;
    try{assert.equal(h.hpAt(sample.f,856,600),"11");assert.equal(h.hpAt(sample.f,856,640),"");sample.check();
      h.numericAt=()=>"1";assert.equal(h.hpAt(sample.f,856,600),"1");}
    finally{sample.restore();h.dispose();}
  });
  await test("12次不稳前自动改数字读法，必须重新取得两帧完整一致，绝不选最大血量或拼帧",async()=>{
    const h=new Host({enemyCount:3}),s=state(),events=[];let reads=0,inputs=0;
    s.characters[1].hp=11;h.phase=()=>({phase:"board",turn:"user"});h.trace=(event,data)=>events.push({event,data});h.clickAt=()=>inputs++;
    h.board=()=>{reads++;const v=clone(s);if(!h.precisionBoard)v.characters[1].hp=[11,1,null][(reads-1)%3];return v;};
    try{assert.equal((await h.settledBoard()).characters[1].hp,11);assert.equal(reads,5);assert.equal(inputs,0);
      assert.equal(events.filter(e=>e.event==="board-recovery").length,1);}
    finally{h.dispose();}
  });
  await test("稳健牌桌徽标4但元素模板3时可复读拒绝，不允许两次同样漏骰变有效",()=>{
    const h=new Host({enemyCount:3});h.precisionBoard=true;h.phaseIn=()=>({phase:"board",turn:"user"});
    h.characterIn=(_,i)=>({...state().characters[i],raised:i===0});h.enemiesIn=()=>state().enemies;
    h.diceIn=()=>({dice:{Omni:1,Anemo:2},items:[]});h.diceCountIn=()=>4;
    try{assert.throws(()=>h.board(),e=>e.code==="TCG_DICE_RETRY");
      h.diceIn=()=>({dice:{Omni:1,Anemo:2,Dendro:1},items:[]});assert.equal(T.total(h.board().dice),4);
      h.diceCountIn=()=>null;assert.equal(T.total(h.board().dice),4);}
    finally{h.dispose();}
  });
  await test("动作结果读取不稳定只观察重试，不重放调和，不丢手牌与历史",async()=>{
    const h=new Host({enemyCount:3}),before=state({hand:hand("sweet","woven"),dice:{Cryo:1,Electro:2}}),after=clone(before),events=[];
    after.hand=hand("woven");after.dice.Cryo--;after.dice.Electro++;let observations=0,executions=0;
    h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(after);h.expectedDice=3;
    h.execute=async()=>executions++;h.trace=(event,data)=>events.push({event,data});h.acceptHand(before.hand,"fixture");
    h.observe=async()=>{if(++observations===1){const e=new Error("temporary board");e.code="TCG_BOARD_RETRY";throw e;}return clone(after);};
    try{const result=await h.confirm({type:"tune",id:"sweet",index:0,element:"Electro"},before);
      assert.equal(result.confirmed,true);assert.equal(observations,2);assert.equal(executions,0);assert.equal(h.handCache.length,1);
      assert.equal(events.filter(e=>e.event==="confirmation-read-deferred").length,1);}
    finally{h.dispose();}
  });
  await test("读完手牌后的牌桌不稳只恢复牌桌，不能触发重复整手扫描",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("sweet","woven")});let scans=0,reads=0;
    h.phase=()=>({phase:"board",turn:"user"});h.readHand=async()=>{scans++;return clone(s.hand);};
    h.settledBoard=async()=>clone(s);h.board=()=>{const v=clone(s);v.characters[0].hp=++reads%2?9:10;return v;};
    try{const after=await h.observe();assert.equal(after.characters[0].hp,10);assert.equal(after.hand.length,2);
      assert.equal(scans,1);assert.equal(reads,6);assert.equal(h.precisionBoard,true);}
    finally{h.dispose();}
  });
  await test("动作确认可复读暂未变化的状态，不重放动作，预算在确认后校验", async () => {
    const h=new Host({enemyCount:3}),before=state({hand:hand("woven","sweet")}),after=clone(before);
    after.hand=hand("sweet");after.dice.Electro++;
    h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(before);
    let reads=0,executions=0;h.execute=async()=>{executions++;};h.observe=async()=>clone(++reads===1?before:after);
    h.expectedDice=9;
    try {const result=await h.confirm({type:"card",id:"woven",index:0},before);assert.equal(result.confirmed,true);
      assert.equal(reads,2);assert.equal(executions,0);}
    finally {h.dispose();}
  });
  await test("手牌计数暂读为零后必须两帧一致，不能丢弃已有手牌", async () => {
    const h=new Host({enemyCount:3});h.expand=async()=>{};let reads=0;h.ocr=()=>["0","5","5"][reads++];
    h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});
    try {assert.equal(await h.handCount(),5);assert.equal(reads,3);}
    finally {h.dispose();}
  });
  await test("手牌计数四次冲突不猜数量、不转入盲探卡位", async () => {
    const h=new Host({enemyCount:3});h.expand=async()=>{};let reads=0;h.ocr=()=>["2","3","2","3"][reads++];
    h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});
    h.titleAt=async()=>{throw new Error("blind-fallback-forbidden");};
    try {await assert.rejects(h.handCount(),/手牌计数复读不稳定/);assert.equal(reads,4);}
    finally {h.dispose();}
  });
  await test("显式零张手牌也要连续两帧计数证据，不使用识别失败替代", async () => {
    const h=new Host({enemyCount:3});h.expand=async()=>{};let reads=0;h.ocr=()=>{reads++;return "0";};
    h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});
    try {assert.equal(await h.handCount(),0);assert.equal(reads,2);}
    finally {h.dispose();}
  });
  await test("补能效果与真实弃牌已确认时，预算偏差只同步资源不重读手牌", async () => {
    const h=new Host({enemyCount:3}),before=state({hand:hand("voltage","sweet")}),after=clone(before);
    after.hand=hand("sweet");after.characters[0].energy=1;
    h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(before);h.observe=async()=>clone(after);h.expectedDice=7;
    let fullReads=0;h.observe=async(pending,plan)=>{if(plan.mode==="full")fullReads++;return clone(after);};
    try {const result=await h.confirm({type:"card",id:"voltage",index:0},before);
      assert.equal(result.confirmed,true);assert.equal(result.resynchronized,true);assert.equal(fullReads,0);assert.equal(h.expectedDice,T.total(after.dice));}
    finally {h.dispose();}
  });
  await test("所有鼠标输入只有两个受保护宿主入口，业务路径不能绕过取整校验", () => {
    const source=fs.readFileSync(path.join(base,"lib/bgi.js"),"utf8");
    assert.equal((source.match(/\bclick\(/g)||[]).length,1);
    assert.equal((source.match(/\bmoveMouseTo\(/g)||[]).length,1);
    assert.match(source,/click\(point\[0\], point\[1\]\)/);
    assert.match(source,/moveMouseTo\(point\[0\], point\[1\]\)/);
  });
  await test("宿主Int32契约重现947.5导致arg2异常，不能再用空输入模拟", () => {
    assert.throws(() => mock.click(975,947.5), /parameter 'arg2'/);
    assert.throws(() => mock.moveMouseTo(975.5,948), /parameter 'arg1'/);
    for (const bad of [NaN,Infinity,undefined,null,"948",2147483648]) {
      assert.throws(() => mock.click(975,bad), /parameter 'arg2'/);
    }
    mock.click(975,948);
  });
  await test("实际确定模板64乘31的中心必须变成975和948两个整数", async () => {
    const h=new Host({enemyCount:3}),inputs=[],oldClick=mock.click;
    mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};
    h.button=()=>({x:943,y:932,w:64,h:31});
    try {await h.clickButton("确定");assert.deepEqual(inputs,[[975,948]]);
      h.button=()=>({x:943,y:932,w:65,h:31});await h.clickButton("确定");
      assert.deepEqual(inputs[1],[976,948]);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("空起手OCR到真实按钮调用完整链路不再跳过整数参数检查", async () => {
    const h=new Host({enemyCount:3,mulligan:"优先充能与调骰"}),inputs=[],events=[],oldClick=mock.click;
    mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};
    h.titleAt=async()=>"";h.button=()=>({x:943,y:932,w:64,h:31});
    h.phase=()=>({phase:inputs.length?"pick":"opening"});h.trace=(event,data)=>events.push({event,data});
    try {await h.opening(false);assert.deepEqual(inputs,[[975,948]]);
      assert.ok(events.some(e=>e.event==="opening-confirmed"));}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("八颗奇数尺寸重投骰子与确认按钮都遵守整数输入契约", async () => {
    const h=new Host({enemyCount:3}),inputs=[],oldClick=mock.click;
    mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};
    h.matches=(f,asset)=>asset==="dice/NativeRollPyro"?Array.from({length:8},(_,i)=>({x:606+224*(i%4),y:386+246*Math.floor(i/4),w:41,h:41})):[];
    h.button=()=>({x:943,y:932,w:64,h:31});
    h.phase=()=>inputs.length<9?{phase:"roll",turn:"none"}:{phase:"board",turn:"user"};
    try {const observed=h.frame(f=>h.diceIn(f,true));
      assert.ok(observed.items.every(d=>Number.isInteger(d.x)&&Number.isInteger(d.y)));
      const m=T.freshMemory();await h.roll(m);assert.equal(inputs.length,9);
      assert.deepEqual(inputs[0],[627,407]);assert.deepEqual(inputs[8],[975,948]);assert.equal(m.round,1);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("OCR出牌确认的奇数文字矩形中心同样取整数", async () => {
    const h=new Host({enemyCount:3}),inputs=[],oldClick=mock.click;
    mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};
    h.requireNoWarning=async()=>{};h.ocr=()=>"确认";
    h.frame=fn=>fn({FindMulti:()=>({count:1,0:{text:"确认",x:1700,y:900,width:65,height:31}})});
    try {await h.cardConfirm({id:"woven",target:null});assert.deepEqual(inputs,[[1733,916]]);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("非法或越界鼠标坐标在任何宿主输入前停止，不转换成零或钳位", () => {
    const h=new Host({enemyCount:3}),oldClick=mock.click,oldMove=mock.moveMouseTo;let inputs=0;
    mock.click=mock.moveMouseTo=()=>{inputs++;};
    const badPoints=[[NaN,100],[100,Infinity],[undefined,100],[null,100],["100",100],[-0.1,100],[100,1080],[1920,100],[1e20,100]];
    try {for(const p of badPoints){assert.throws(()=>h.clickAt(...p),/鼠标坐标/);assert.throws(()=>h.moveTo(...p),/鼠标坐标/);}
      assert.equal(inputs,0);}
    finally {mock.click=oldClick;mock.moveMouseTo=oldMove;h.dispose();}
  });
  await test("分数拖动起点终点及所有中间点均为整数，正常结束抬鼠标", async () => {
    const h=new Host({enemyCount:3}),moves=[],oldMove=mock.moveMouseTo,oldDown=mock.leftButtonDown,oldUp=mock.leftButtonUp;
    let downs=0,ups=0;mock.moveMouseTo=(x,y)=>{hostInput("moveMouseTo",x,y);moves.push([x,y]);};
    mock.leftButtonDown=()=>{downs++;};mock.leftButtonUp=()=>{ups++;};
    try {await h.drag(100.5,100.5,500.5,500.5);assert.equal(downs,1);assert.equal(ups,1);
      assert.equal(moves.length,16);assert.deepEqual(moves[0],[101,101]);assert.deepEqual(moves[15],[501,501]);}
    finally {mock.moveMouseTo=oldMove;mock.leftButtonDown=oldDown;mock.leftButtonUp=oldUp;h.dispose();}
  });
  await test("拖动目的坐标非法时提前拒绝，不能先按下鼠标", async () => {
    const h=new Host({enemyCount:3}),oldMove=mock.moveMouseTo,oldDown=mock.leftButtonDown;let moves=0,downs=0;
    mock.moveMouseTo=()=>{moves++;};mock.leftButtonDown=()=>{downs++;};
    try {await assert.rejects(h.drag(100,100,NaN,500),/鼠标坐标/);assert.equal(moves,0);assert.equal(downs,0);}
    finally {mock.moveMouseTo=oldMove;mock.leftButtonDown=oldDown;h.dispose();}
  });
  await test("出战角色模板是文字提示，禁止通用按钮点击其1824和870中心", async () => {
    const h=new Host({enemyCount:3}),oldClick=mock.click;let inputs=0;
    mock.click=()=>{inputs++;};h.button=()=>({x:1771,y:857,w:106,h:26});
    try {await assert.rejects(h.clickButton("出战角色"),/提示文字/);assert.equal(inputs,0);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("首次出战按官方同角色牌路径确认；右侧控件不生效也能继续，两帧转场才成功", async () => {
    const h=new Host({enemyCount:3}),oldClick=mock.click,inputs=[],events=[];
    mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};
    h.matches=(f,asset)=>asset==="core/出战角色"?[{x:1771,y:857,w:106,h:26}]:[];
    let checks=0;const phases=["pick","pick","unknown","pick","unknown","roll","roll"];
    h.phase=()=>({phase:"pick",turn:"none"});
    h.firstPickObservation=()=>({phase:phases[Math.min(checks++,phases.length-1)],selectedTarget:0,turn:"none"});
    h.trace=(event,data)=>events.push({event,data});
    try {await h.pick(0,true);assert.deepEqual(inputs,[[750,720],[750,720]]);assert.equal(checks,7);
      assert.ok(events.some(e=>e.event==="pick-confirmed"&&e.data.phase==="roll"&&e.data.characterInputs===2));}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("角色未证明选中时只选择一次，不用重复点击或右侧按钮猜确认", async () => {
    const oldClick=mock.click;
    try {for(const selectedTarget of [null,1,2]){
      const h=new Host({enemyCount:3}),inputs=[];mock.click=(x,y)=>inputs.push([x,y]);h.phase=()=>({phase:"pick"});
      h.firstPickObservation=()=>({phase:"pick",selectedTarget});
      try {await assert.rejects(h.pick(0,true),/确认未生效/);assert.deepEqual(inputs,[[750,720]]);}finally {h.dispose();}
    }}finally {mock.click=oldClick;}
  });
  await test("不在出战页或角色索引非法时不能选人确认", async () => {
    const h=new Host({enemyCount:3}),oldClick=mock.click;let inputs=0;mock.click=()=>{inputs++;};
    try {h.phase=()=>({phase:"roll"});await assert.rejects(h.pick(0,true),/出战页/);
      h.phase=()=>({phase:"pick"});for(const bad of [-1,3,NaN,undefined])await assert.rejects(h.pick(bad,true),/出战角色索引/);
      assert.equal(inputs,0);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("已选角色一次点击进入重投是成功，不补确认也不误报页面改变", async () => {
    const oldClick=mock.click;
    try {for(const route of [["roll","roll"],["unknown","transition","roll","roll"]]){
      const h=new Host({enemyCount:3}),inputs=[],events=[];let reads=0;
      mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};h.phase=()=>({phase:"pick"});
      h.firstPickObservation=()=>({phase:route[Math.min(reads++,route.length-1)],turn:"none"});
      h.trace=(event,data)=>events.push({event,data});
      try {const after=await h.pick(0,true);assert.equal(after.phase,"roll");assert.deepEqual(inputs,[[750,720]]);
        assert.equal(events.find(e=>e.event==="pick-confirmed").data.characterInputs,1);
        assert.equal(events.some(e=>e.event==="pick-confirm-clicked"),false);}
      finally {h.dispose();}
    }}finally {mock.click=oldClick;}
  });
  await test("首次选人相位和已打开的目标标题从同帧读取，无额外详情点击",()=>{
    const h=new Host({enemyCount:3}),f={};let captures=0,inputs=0;
    h.frame=fn=>{captures++;return fn(f);};h.phaseIn=frame=>{assert.equal(frame,f);return {phase:"pick",turn:"none"};};
    h.ocr=(frame,roi)=>{assert.equal(frame,f);assert.deepEqual(Array.from(roi),[311,115,341,50]);return "雷电将军";};
    h.clickAt=h.moveTo=()=>inputs++;
    try {assert.equal(h.firstPickObservation().selectedTarget,0);assert.equal(captures,1);assert.equal(inputs,0);
      h.phaseIn=()=>({phase:"roll"});h.ocr=()=>{throw new Error("must not read old role title on roll");};
      assert.equal(h.firstPickObservation().selectedTarget,null);assert.equal(captures,2);}
    finally {h.dispose();}
  });
  await test("角色选中标题短时不明或断续时只观察，连续两帧目标正确后才确认一次",async()=>{
    const h=new Host({enemyCount:3}),oldClick=mock.click,inputs=[];let reads=0;
    mock.click=(x,y)=>inputs.push([x,y]);h.phase=()=>({phase:"pick"});
    const proof=[null,0,null,1,0,0];
    h.firstPickObservation=()=>inputs.length>=2?{phase:"roll"}:{phase:"pick",selectedTarget:proof[Math.min(reads++,proof.length-1)]};
    try {await h.pick(0,true);assert.deepEqual(inputs,[[750,720],[750,720]]);assert.equal(reads,6);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("选角色后进入意外起手或结算页，不能补点击旧角色",async()=>{
    const oldClick=mock.click;
    try {for(const phase of ["opening","settlement","choice"]){
      const h=new Host({enemyCount:3}),inputs=[];mock.click=(x,y)=>inputs.push([x,y]);h.phase=()=>({phase:"pick"});
      h.firstPickObservation=()=>({phase});
      try {await assert.rejects(h.pick(0,true),/意外页面/);assert.deepEqual(inputs,[[750,720]]);}finally {h.dispose();}
    }}finally {mock.click=oldClick;}
  });
  await test("出战确认后一直原页或unknown有界停止，不重复点击也不伪称成功", async () => {
    const oldClick=mock.click;
    try {for(const waitingPhase of ["pick","unknown"]){
      const h=new Host({enemyCount:3}),inputs=[],events=[];let checks=0;
      mock.click=(x,y)=>{hostInput("click",x,y);inputs.push([x,y]);};
      h.phase=()=>({phase:"pick"});h.firstPickObservation=()=>({phase:++checks<=2?"pick":waitingPhase,selectedTarget:0});
      h.trace=(event,data)=>events.push({event,data});
      try {await assert.rejects(h.pick(0,true),/出战角色确认未生效/);assert.equal(checks,60);
        assert.deepEqual(inputs,[[750,720],[750,720]]);assert.equal(events.some(e=>e.event==="pick-confirmed"),false);}
      finally {h.dispose();}
    }}finally {mock.click=oldClick;}
  });
  await test("首次和阵亡选人均允许完整稳定牌桌，首次不再强制先观察投骰", async () => {
    const oldClick=mock.click;
    try {for(const first of [false,true]){
      const h=new Host({enemyCount:3});let inputs=0;mock.click=(x,y)=>{hostInput("click",x,y);inputs++;};
      h.matches=()=>[{x:1771,y:857,w:106,h:26}];h.phase=()=>inputs<2?{phase:"pick",turn:"none"}:{phase:"board",turn:"enemy"};
      h.firstPickObservation=()=>({...h.phase(),selectedTarget:1});
      h.board=()=>state({phase:inputs<2?"pick":"board",turn:inputs<2?"none":"enemy",active:1,
        characters:[{hp:0,dead:true,energy:0},{hp:8,dead:false,energy:2,frozen:false,raised:inputs>=1},{hp:10,dead:false,energy:0,frozen:false,raised:false}]});
      try {const after=await h.pick(1,first);assert.equal(after.phase,"board");assert.equal(after.active,1);assert.equal(inputs,2);}
      finally {h.dispose();}
    }}finally {mock.click=oldClick;}
  });
  await test("首次出战的行动页必须读到目标活着出战、充能与骰子，不仅接受阶段图标", async () => {
    const oldClick=mock.click;
    try {for(const patch of [{active:2},{diceKnown:false},{dice:{}},{characters:state().characters.map((c,i)=>i===0?{...c,energy:null}:c)}]) {
      const h=new Host({enemyCount:3}),inputs=[];
      mock.click=(x,y)=>{inputs.push([x,y]);};h.matches=()=>[{x:1771,y:857,w:106,h:26}];
      h.phase=()=>({phase:inputs.length<2?"pick":"board",turn:inputs.length<2?"none":"user"});
      h.firstPickObservation=()=>({...h.phase(),selectedTarget:0});
      h.board=()=>state(patch);
      try {await assert.rejects(h.pick(0,true),/完整稳定牌桌/);assert.deepEqual(inputs,[[750,720],[750,720]]);}
      finally {h.dispose();}
    }}finally {mock.click=oldClick;}
  });
  await test("预选角色一次确认可直接进入先掷骰后的完整牌桌；短暂不完整只重读不补点",async()=>{
    const h=new Host({enemyCount:3}),oldClick=mock.click,inputs=[];let reads=0;
    mock.click=(x,y)=>inputs.push([x,y]);h.phase=()=>({phase:"pick"});h.firstPickObservation=()=>({phase:"board",turn:"user"});
    h.board=()=>state(++reads<3?{active:null}:{});
    try {const after=await h.pick(0,true);assert.equal(after.active,0);assert.equal(reads,4);assert.deepEqual(inputs,[[750,720]]);}
    finally {mock.click=oldClick;h.dispose();}
  });
  for(const entry of ["opening","pick","roll","board"])await test("开局生命周期独立于回合计数且只初始化一次："+entry,()=>{
    const flow=new T.OpeningFlow(entry),m=T.freshMemory();
    if(entry!=="board") {
      if(entry==="opening")flow.record("opening");
      if(entry!=="roll")flow.record("pick");
      T.nextRound(m);flow.record("roll");
      if(entry==="roll")flow.record("pick");
    }
    const ready=flow.enterBoard(m);assert.equal(m.round,1);assert.equal(ready.entry,entry);assert.equal(ready.midgameRestore,false);
    assert.equal(flow.enterBoard(m),null);assert.equal(m.round,1);
    assert.throws(()=>flow.record("pick"),/不重复执行/);
  });
  await test("先掷骰后选人不会因round等于1误判阵亡，已完成开局才允许后续阵亡流程",()=>{
    const f=new T.OpeningFlow("opening"),m=T.freshMemory();f.record("opening");T.nextRound(m);f.record("roll");
    assert.equal(f.complete,false);assert.equal(m.round,1);f.record("pick");
    const accepted=f.enterBoard(m);assert.deepEqual(clone(accepted.route),["opening","roll","pick","board"]);assert.equal(m.round,1);
    assert.throws(()=>f.record("roll"),/不重复执行/);
  });
  await test("开局生命周期不接受菜单动画或回合二的历史冒充新局",()=>{
    for(const phase of ["unknown","transition","choice","settlement","result"])assert.throws(()=>new T.OpeningFlow(phase),/未行动的新开局/);
    const f=new T.OpeningFlow("board"),m=T.freshMemory();m.round=2;assert.throws(()=>f.enterBoard(m),/中途对局/);
    assert.equal(f.complete,false);assert.equal(m.round,2);
  });
  function freshBoard(patch={}) {
    return state({characters:T.team.map(c=>({hp:c.maxHp,energy:0,dead:false,frozen:false})),...patch});
  }
  await test("新行动页开局可见条件允许双方行动标记与已选好的任意活角色，不打开角色详情",()=>{
    for(const turn of ["user","enemy"])for(const active of [0,1,2])assert.equal(T.freshActionBoard(freshBoard({turn,active})),true);
  });
  await test("新行动页开局可见条件拒绝消耗骰、受伤、充能、阵亡、冻结或未知，不假装能识别隐藏历史",()=>{
    for(const patch of [{dice:{Electro:7}},{dice:{Electro:9}},{diceKnown:false},{active:null},{phase:"pick"},{turn:"none"},
      ...["hp","energy","dead","frozen"].map(k=>({characters:freshBoard().characters.map((c,i)=>i?c:{...c,[k]:{hp:9,energy:1,dead:true,frozen:true}[k]})})),
      {characters:freshBoard().characters.map((c,i)=>i?c:{...c,energy:null})}])assert.equal(T.freshActionBoard(freshBoard(patch)),false);
  });
  await test("行动页准入两帧语义一致、元素键顺序无关，检查期间零游戏输入",async()=>{
    const h=new Host({enemyCount:3}),events=[];let reads=0,inputs=0;
    h.board=()=>freshBoard({dice:++reads%2?{Electro:5,Omni:3}:{Omni:3,Electro:5}});
    h.trace=(event,data)=>events.push({event,data});h.clickAt=h.moveTo=()=>{inputs++;};
    try {const admitted=await h.admitFreshActionBoard();assert.equal(T.total(admitted.dice),8);assert.equal(reads,2);assert.equal(inputs,0);
      assert.equal(events[0].event,"fresh-action-entry-accepted");assert.equal(events[0].data.historyRestored,false);}
    finally {h.dispose();}
  });
  await test("行动页可见条件不符有界拒绝，无出牌、展开、归位或鼠标输入",async()=>{
    const h=new Host({enemyCount:3});let reads=0,inputs=0;
    h.board=()=>{reads++;return freshBoard({dice:{Electro:7}});};h.clickAt=h.moveTo=()=>{inputs++;};
    try {await assert.rejects(h.admitFreshActionBoard(),/不符合新开局未行动条件/);assert.equal(reads,8);assert.equal(inputs,0);}
    finally {h.dispose();}
  });
  await test("行动页准入只重读可恢复错误，不吞真实宿主错误或对局页面变化",async()=>{
    for(const fatal of [false,true]) {
      const h=new Host({enemyCount:3});let reads=0;
      h.board=()=>{if(++reads===1){const e=new Error("host read failure");if(!fatal)e.code="TCG_DICE_RETRY";throw e;}return freshBoard();};
      try {if(fatal){await assert.rejects(h.admitFreshActionBoard(),/host read failure/);assert.equal(reads,1);}else{await h.admitFreshActionBoard();assert.equal(reads,3);}
        h.board=()=>({phase:"pick"});await assert.rejects(h.admitFreshActionBoard(),/页面改变/);}
      finally {h.dispose();}
    }
  });
  await test("首次重投允许稳定首次选人页，只确认一次并只计一个回合",async()=>{
    const h=new Host({enemyCount:3}),m=T.freshMemory();let confirms=0;
    h.phase=()=>({phase:confirms?"pick":"roll",turn:"none"});h.readRollDice=async()=>({items:rollItems(),dice:{Electro:8}});
    h.clickButton=async()=>{confirms++;};
    try {const after=await h.roll(m,{allowInitialPick:true});assert.equal(after.phase,"pick");assert.equal(confirms,1);assert.equal(m.round,1);}
    finally {h.dispose();}
  });
  await test("后续回合或未允许的重投不接受首次选人分支，不重放重投、不误加回合",async()=>{
    for(const [round,allowed] of [[0,false],[1,true]]) {
      const h=new Host({enemyCount:3}),m=T.freshMemory();m.round=round;let confirms=0;
      h.phase=()=>({phase:confirms?"pick":"roll",turn:"none"});h.readRollDice=async()=>({items:rollItems(),dice:{Electro:8}});
      h.clickButton=async()=>{confirms++;};
      try {await assert.rejects(h.roll(m,{allowInitialPick:allowed}),/意外页面/);assert.equal(confirms,1);assert.equal(m.round,round);}
      finally {h.dispose();}
    }
  });
  await test("起手确认后同时接受先选人和先掷骰，短时unknown不导致二次确认",async()=>{
    for(const next of ["pick","roll"]) {
      const h=new Host({enemyCount:3});let confirms=0,reads=0;
      h.phase=()=>({phase:confirms?++reads===1?"unknown":next:"opening",turn:"none"});h.clickButton=async()=>{confirms++;};
      try {const after=await h.confirmOpening({});assert.equal(after.phase,next);assert.equal(confirms,1);assert.equal(reads,3);}
      finally {h.dispose();}
    }
  });
  await test("起手转场超过旧12次等待仍能接受，不重新点击确定",async()=>{
    for(const next of ["pick","roll"]){
      const h=new Host({enemyCount:3});let confirms=0,reads=0;
      h.phase=()=>({phase:confirms?++reads<=20?"unknown":next:"opening"});h.clickButton=async()=>confirms++;h.trace=()=>{};
      try {const after=await h.confirmOpening({});assert.equal(after.phase,next);assert.equal(confirms,1);assert.equal(reads,22);}
      finally {h.dispose();}
    }
  });
  await test("起手转场始终不明仍有界停止，40次只读等待不重复确定",async()=>{
    const h=new Host({enemyCount:3});let confirms=0,reads=0;
    h.phase=()=>({phase:confirms?(reads++,"unknown"):"opening"});h.clickButton=async()=>confirms++;h.trace=()=>{};
    try {await assert.rejects(h.confirmOpening({}),/初始手牌确认未生效/);assert.equal(confirms,1);assert.equal(reads,40);}
    finally {h.dispose();}
  });
  await test("11血柯莱按自身上限识别；其他角色及超上限数值仍不放宽", () => {
    assert.equal(T.team[1].maxHp,11);
    const h=new Host({enemyCount:3});h.has=()=>false;h.matches=()=>[];
    h.hpAt=(f,x,y)=>y===640?"11":"";
    try {assert.equal(h.characterIn({},1).hp,11);assert.equal(h.characterIn({},0).hp,null);
      h.hpAt=(f,x,y)=>y===600?"11":"";assert.equal(h.characterIn({},1).raised,true);
      h.hpAt=(f,x,y)=>y===640?"12":"";assert.equal(h.characterIn({},1).hp,null);}
    finally {h.dispose();}
  });
  await test("实际main入口固定配队免核队，起手到选人到重投不替换业务方法", async () => {
    // Uses the native screenshots' rectangles, but synthetic OCR/phase changes.
    // This tests orchestration, not game input effectiveness or a real match.
    const events=[],inputs=[],world={phase:"opening",title:"",waitingFrames:0};
    let frames=0,disposed=0;
    const replay={settings:{mode:"自动试验",enemyCount:"3",mulligan:"优先充能与调骰",maxMinutes:"15"},
      file:{createDirectory:()=>true,readTextSync:p=>fs.readFileSync(path.join(base,p),"utf8"),
        writeTextSync:(p,text)=>{assert.equal(path.extname(p),".log");events.push(JSON.parse(text));return true;},
        readImageMatSync:p=>({p,empty:()=>false,dispose:()=>{}}),writeImageSync:()=>true},
      RecognitionObject:{Ocr:(...roi)=>({roi}),TemplateMatch:(mat,...roi)=>({mat,roi})},
      setGameMetrics:(w,h)=>assert.deepEqual([w,h],[1920,1080]),
      sleep:async ms=>assert.ok(Number.isInteger(ms)&&ms>=0),
      moveMouseTo:(x,y)=>hostInput("moveMouseTo",x,y),leftButtonDown:()=>{},leftButtonUp:()=>{},
      log:{info:()=>{},warn:()=>{},error:()=>{}},
      click:(x,y)=>{
        hostInput("click",x,y);inputs.push([x,y]);
        if(world.phase==="opening"&&x===975&&y===948)world.phase="pick";
        else if(world.phase==="pick"&&y===720){const title=T.team[[750,960,1175].indexOf(x)]?.name||"";
          if(world.title===title){world.phase="unknown";world.waitingFrames=0;}else world.title=title;}
        // The separate right-side control intentionally has no effect.
        else if(world.phase==="roll"&&x===975&&y===948)world.phase="result";
        else if(x===1190&&y===545)world.title="";
      },
      captureGameRegion:()=>{
        frames++;let released=false;
        if(world.phase==="unknown"&&++world.waitingFrames>=5)world.phase="roll";
        return {width:1920,height:1080,dispose:()=>{released=true;disposed++;},
          Find:ro=>{
            assert.equal(released,false);let text="";const roi=ro.roi.join(",");
            if(["763,101,394,381","763,101,394,600"].includes(roi)&&world.phase==="result")text="对局胜利";
            if(roi==="844,167,232,65")text=world.phase==="opening"?"初始手牌":world.phase==="roll"?"重投骰子":"";
            if(roi==="311,115,341,50")text=world.title;
            return {text,isExist:()=>!!text};
          },
          FindMulti:ro=>{
            assert.equal(released,false);let rows=[];const asset=ro.mat?.p;
            if(asset==="assets/core/确定.png"&&["opening","roll"].includes(world.phase))rows=[{x:943,y:932,width:64,height:31}];
            if(asset==="assets/core/出战角色.png"&&world.phase==="pick")rows=[{x:1771,y:857,width:106,height:26}];
            if(asset==="assets/dice/NativeRollPyro.png"&&world.phase==="roll") {
              assert.equal(ro.Use3Channels,true);assert.equal(ro.threshold,.73);
              rows=Array.from({length:8},(_,i)=>({x:606+224*(i%4),y:386+246*Math.floor(i/4),width:41,height:41}));
            }
            return {count:rows.length,...rows};
          }};
      }};
    await vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),vm.createContext(replay));
    assert.equal(frames,disposed);
    assert.ok(events.some(e=>e.event==="opening-confirmed"));
    assert.deepEqual(events.find(e=>e.event==="team-assumed").data.names,["雷电将军","柯莱","刻晴"]);
    assert.equal(events.some(e=>e.event==="team-member"||e.event==="team"),false);
    assert.equal(inputs.filter(([x,y])=>y===720).length,2,"select and confirm same starting Raiden; do not inspect three roles");
    assert.equal(events.find(e=>e.event==="pick-confirmed").data.phase,"roll");
    assert.equal(events.find(e=>e.event==="round").data.round,1);
    assert.equal(inputs.filter(([x,y])=>x===1824&&y===960).length,0);
    assert.equal(inputs.some(([x,y])=>x===1824&&y===870),false);
    assert.equal(events.some(e=>e.event==="stop"),false);
  });
  await test("启动先等连续两帧1080P，窗口切换期间不识牌不输入", async () => {
    const oldCapture = mock.captureGameRegion, oldClick = mock.click, oldMove = mock.moveMouseTo;
    const sizes = [[1280,720],[1920,1080],[1280,720],[1920,1080],[1920,1080]];
    let reads = 0, disposed = 0, inputs = 0; const events = [];
    mock.captureGameRegion = () => { const [width,height] = sizes[Math.min(reads++, sizes.length-1)];
      return { width, height, dispose: () => { disposed++; } }; };
    mock.click = mock.moveMouseTo = () => { inputs++; };
    const h = new Host({ enemyCount: 3 }); h.trace = (event,data) => events.push({event,data});
    try { await h.waitForCapture(); assert.equal(reads,5); assert.equal(disposed,reads); assert.equal(inputs,0);
      assert.ok(events.some(e => e.event === "capture-ready" && e.data.width === 1920)); }
    finally { mock.captureGameRegion = oldCapture; mock.click = oldClick; mock.moveMouseTo = oldMove; h.dispose(); }
  });
  await test("固定720P启动有界退出，错误包含实际尺寸，不默默缩放", async () => {
    const oldCapture = mock.captureGameRegion; let reads = 0, disposed = 0;
    mock.captureGameRegion = () => { reads++; return { width:1280,height:720,dispose:()=>{disposed++;} }; };
    const h = new Host({ enemyCount:3 });
    try { await assert.rejects(h.waitForCapture(), /实际读取 1280×720/); assert.equal(reads,20); assert.equal(disposed,20); }
    finally { mock.captureGameRegion=oldCapture; h.dispose(); }
  });
  await test("错误截图不受识别分辨率门槛限制，720P也保存停止原因", () => {
    const oldCapture=mock.captureGameRegion, oldWrite=mock.file.writeImageSync;
    let disposed=0; const writes=[], events=[];
    mock.captureGameRegion=()=>({Width:1280,Height:720,SrcMat:{marker:"native"},dispose:()=>{disposed++;}});
    mock.file.writeImageSync=(p,mat)=>{writes.push({p,marker:mat.marker});return true;};
    const h=new Host({enemyCount:3});h.trace=(event,data)=>events.push({event,data});
    try { h.snapshot("尺寸不支持"); assert.equal(writes.length,1); assert.equal(writes[0].marker,"native");
      assert.equal(disposed,1); assert.equal(events[0].event,"stop"); assert.equal(events[0].data.reason,"尺寸不支持");
      assert.equal(events[0].data.capture.width,1280); }
    finally {mock.captureGameRegion=oldCapture;mock.file.writeImageSync=oldWrite;h.dispose();}
  });
  await test("捕获截图失败仍记录原始停止原因，不让二次错误覆盖它", () => {
    const oldCapture=mock.captureGameRegion, events=[];
    mock.captureGameRegion=()=>{throw new Error("capture-canary");};
    const h=new Host({enemyCount:3});h.trace=(event,data)=>events.push({event,data});
    try {h.snapshot("original-canary");assert.equal(events.length,1);assert.equal(events[0].data.reason,"original-canary");
      assert.match(events[0].data.snapshotError,/capture-canary/);}
    finally {mock.captureGameRegion=oldCapture;h.dispose();}
  });
  await test("通过1080P预检后如果尺寸再变化，识别仍会停止", () => {
    const oldCapture=mock.captureGameRegion; let calls=0,disposed=0;
    mock.captureGameRegion=()=>({width:2560,height:1440,dispose:()=>{disposed++;}});
    const h=new Host({enemyCount:3});
    try { assert.throws(()=>h.frame(()=>{calls++;}),/实际读取 2560×1440/);assert.equal(calls,0);assert.equal(disposed,1); }
    finally {mock.captureGameRegion=oldCapture;h.dispose();}
  });
  await test("起手换牌保留未支持牌，只替换已知非优先牌", async () => {
    const h = new Host({ enemyCount: 3, mulligan: "优先充能与调骰" }), clicks = [];
    const old = mock.click; mock.click = (...xy) => clicks.push(xy);
    const names = ["提米", "星天之兆", "甜甜花酿鸡", "旅行剑", "最好的伙伴！"];
    let i = 0, confirmed = false;
    h.titleAt = async () => names[i++]; h.clickButton = async () => { confirmed = true; };
    let phases = 0; h.phase = () => ({ phase: ++phases === 1 ? "opening" : "pick" });
    try { await h.opening(false); assert.equal(confirmed, true); assert.deepEqual(clicks, [[960,540],[1248,540]]); }
    finally { mock.click = old; h.dispose(); }
  });
  await test("起手第一张OCR为空时不选择换牌，只确认一次当前起手", async () => {
    const h=new Host({enemyCount:3,mulligan:"优先充能与调骰"}),events=[],clicks=[];
    const oldClick=mock.click;mock.click=(...xy)=>clicks.push(xy);
    h.titleAt=async()=>"";h.trace=(event,data)=>events.push({event,data});
    let phases=0,confirms=0;h.phase=()=>({phase:++phases===1?"opening":"pick"});
    h.clickButton=async()=>{confirms++;};
    try {await h.opening(false);assert.equal(clicks.length,0);assert.equal(confirms,1);
      assert.ok(events.some(e=>e.event==="opening-unreadable"));assert.ok(events.some(e=>e.event==="opening-confirmed"));}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("起手读到部分卡后失败不会先换掉已读卡，保留原选择", async () => {
    const h=new Host({enemyCount:3,mulligan:"优先充能与调骰"}),clicks=[];
    const oldClick=mock.click;mock.click=(...xy)=>clicks.push(xy);
    let reads=0,phases=0,confirms=0;
    h.titleAt=async()=>["旅行剑","提米",""][reads++];
    h.phase=()=>({phase:++phases===1?"opening":"pick"});h.clickButton=async()=>{confirms++;};
    try {await h.opening(false);assert.equal(reads,3);assert.equal(clicks.length,0);assert.equal(confirms,1);}
    finally {mock.click=oldClick;h.dispose();}
  });
  await test("识别诊断起手OCR为空只记录不支持，绝不确认或换牌", async () => {
    const h=new Host({enemyCount:3}),events=[];
    h.titleAt=async()=>"";h.trace=(event,data)=>events.push({event,data});
    h.clickButton=async()=>{throw new Error("diagnostic-input-forbidden");};
    try {await h.opening(true);assert.ok(events.some(e=>e.event==="opening-unreadable"));
      assert.equal(events.some(e=>e.event==="opening-confirmed"),false);}
    finally {h.dispose();}
  });
  await test("起手确认按钮没识别到时不使用猜测坐标，也不重复确认", async () => {
    const h=new Host({enemyCount:3,mulligan:"全部保留"});h.phase=()=>({phase:"opening"});
    let calls=0;h.clickButton=async()=>{calls++;throw new Error("没有识别到按钮：确定");};
    try {await assert.rejects(h.opening(false),/没有识别到按钮/);assert.equal(calls,1);}
    finally {h.dispose();}
  });
  await test("起手确认无效会有界停止，不能重复点击或伪称已到出战页", async () => {
    const h=new Host({enemyCount:3,mulligan:"全部保留"}),events=[];
    let checks=0,confirms=0;h.phase=()=>{checks++;return {phase:"opening"};};
    h.clickButton=async()=>{confirms++;};h.trace=(event,data)=>events.push({event,data});
    try {await assert.rejects(h.opening(false),/初始手牌确认未生效/);assert.equal(confirms,1);assert.equal(checks,41);
      assert.equal(events.some(e=>e.event==="opening-confirmed"),false);}
    finally {h.dispose();}
  });
  await test("低张数原生取证每数量只存一次，不增加手牌输入或采样",()=>{
    const h=new Host({enemyCount:3}),saved=[];
    h.captureEvidence=label=>saved.push(label);h.clickAt=()=>{throw new Error("evidence must not input");};
    h.frame=()=>{throw new Error("evidence routing must not sample counts");};
    try{for(const n of [null,0,1,1,2,3,4,4,5,10])h.recordHandLayout(n);
      assert.deepEqual(saved,["hand-layout-1","hand-layout-2","hand-layout-3","hand-layout-4"]);}
    finally{h.dispose();}
  });
  await test("低张数从完整牌框布局读取，计数阶段不点击卡名或空位", async () => {
    const h = new Host({ enemyCount: 3 }); h.expand = async () => {h.handFanReady=true;};
    h.phase=()=>({phase:"board",turn:"user"});h.ocr=()=>"";
    h.matches=(_,asset)=>asset==="hand_rim"?[812,1013,1216,1424].map(x=>({x:x+95})):[];
    h.titleAt=async()=>{throw new Error("count must not input");};
    try { assert.equal(await h.handCount(1), 4); } finally { h.dispose(); }
  });
  await test("宿主手牌读取保留未支持牌，但空OCR仍报错", async () => {
    const h = new Host({ enemyCount: 3 }); h.handCount = async () => 2; h.expand = async () => {}; h.reset = async () => {};
    let i = 0; h.titleAt = async () => ["提米", "星天之兆"][i++];
    try { const hs = await h.readHand(); assert.equal(hs[0].supported, false); assert.equal(hs[1].id, "stars");
      h.titleAt = async () => ""; await assert.rejects(h.readHand(), /无法可靠读取/); }
    finally { h.dispose(); }
  });
  await test("执行器拒绝未支持牌出牌调和与错误武器目标，且不注入输入", async () => {
    const h = new Host({ enemyCount: 3 }), u = T.observedCard("提米", 0), clicks = [];
    const old = mock.click; mock.click = (...xy) => clicks.push(xy);
    try {
      await assert.rejects(h.execute({ type:"card", id: u.id, index: 0 }, state(), T.freshMemory()), /未支持/);
      await assert.rejects(h.execute({ type:"tune", id: u.id, index: 0 }, state(), T.freshMemory()), /未核实/);
      await assert.rejects(h.execute({ type: "card", id: "sword", target: 0 }, state(), T.freshMemory()), /武器目标/);
      assert.equal(clicks.length, 0);
    } finally { mock.click = old; h.dispose(); }
  });
  await test("启动日志使用宿主允许的扩展名，逐行JSON能够追加与解析", () => {
    const h = new Host({ enemyCount: 3 });
    assert.equal(path.extname(h.path), ".log");
    assert.equal(mock.file.writeTextSync("logs/unsupported.jsonl", "{}\n", true), false);
    const oldWrite = mock.file.writeTextSync, entries = [];
    mock.file.writeTextSync = (p, text, append) => {
      if (!allowedWriteExtensions.has(path.extname(p))) return false;
      entries.push({ p, text, append }); return true;
    };
    try {
      h.trace("start", { version: "0.1.1" }); h.trace("state", { active: 0 });
      assert.equal(entries.length, 2);
      assert.equal(entries[0].append, true);
      assert.equal(JSON.parse(entries[0].text).event, "start");
      assert.equal(JSON.parse(entries[1].text).data.active, 0);
      assert.ok(entries.every(e => e.text.endsWith("\n")));
    } finally { mock.file.writeTextSync = oldWrite; h.dispose(); }
  });
  await test("停止截图与新日志共享运行前缀，不把日志扩展名当图片文件名", () => {
    const h = new Host({ enemyCount: 3 }), writes = [];
    const oldImageWrite = mock.file.writeImageSync;
    mock.file.writeImageSync = p => { writes.push(p); return true; };
    try {
      h.snapshot("regression-canary");
      assert.equal(writes.length, 1);
      assert.equal(writes[0], h.path.replace(/\.log$/, "-stop-0.png"));
      assert.equal(path.extname(writes[0]), ".png");
    } finally { mock.file.writeImageSync = oldImageWrite; h.dispose(); }
  });
  await test("捕获异常也释放帧，模板缓存而非每轮重复加载", () => {
    const beforeGray = counters.gray, beforeMats = counters.mats;
    const h = new Host({ enemyCount: 3 });
    assert.throws(() => h.frame(() => { throw new Error("canary"); }), /canary/);
    h.frame(f => h.matches(f, "charge", [0, 0, 100, 100]));
    h.frame(f => h.matches(f, "charge", [0, 0, 100, 100]));
    assert.equal(h.templates.size, 1); h.dispose();
    assert.equal(counters.frames, counters.disposed);
    assert.equal(counters.gray - beforeGray, 1); assert.equal(counters.mats - beforeMats, 1);
  });
  await test("手牌数量连续识别失败不会返回0张", async () => {
    const h = new Host({ enemyCount: 3 });
    await assert.rejects(h.handCount(), /无法确认手牌数量/); h.dispose();
    assert.equal(counters.frames, counters.disposed);
  });
  await test("10张手牌位置严格单调，无参考脚本的重叠坐标", () => {
    const x = hostContext.TCGBetterGI.handX[10];
    assert.equal(x.length, 10);
    for (let i = 1; i < 10; i++) assert.equal(x[i] - x[i - 1], 120);
  });
  await test("非1920×1080捕获区必须停止且释放图像", () => {
    const old = mock.captureGameRegion;
    mock.captureGameRegion = () => ({ width: 1280, height: 720, dispose: () => { counters.disposed++; } });
    const h = new Host({ enemyCount: 3 }); assert.throws(() => h.phase(), /1920/); h.dispose(); mock.captureGameRegion = old;
  });
  await test("执行器独立阻止无充能的大招，没有点击大招按钮", async () => {
    const h = new Host({ enemyCount: 3 });
    h.phase = () => ({ phase:"board",turn: "user" }); h.reset = async () => {}; h.board = () => state();
    const presses = []; const oldClick = mock.click; mock.click = (...xy) => presses.push(xy);
    await assert.rejects(h.execute({ type: "skill", who: 0, skill: "Q" }, state(), T.freshMemory()), /技能资源/);
    assert.equal(presses.length, 0); mock.click = oldClick; h.dispose();
  });
  await test("原生技能预览隐藏回合标识但连续核实源流后只确认一次", async () => {
    const h = new Host({ enemyCount: 3 }), s = state();
    h.phase = () => ({ phase:"board",turn:"user" }); h.reset = async () => {}; h.board = () => clone(s);
    h.phaseIn = () => ({ phase:"unknown",turn:"none" });
    h.ocr = (_,roi) => roi[0]===135 ? "源流" : roi[0]===70 ? "普通攻击造成2点物理伤害。" : "";
    h.requireNoWarning = async () => {};
    const presses = []; const oldClick = mock.click; mock.click = (...xy) => presses.push(xy);
    try { await h.execute({type:"skill",who:0,skill:"NA"},s,T.freshMemory());
      assert.deepEqual(presses,[[1608,957],[1608,957]]);
    } finally {mock.click=oldClick;h.dispose();}
  });
  await test("未知页、错误技能名或类型、对方回合不能放行技能确认", async () => {
    for(const [name,detail,turn] of [["","","none"],["云来剑法","普通攻击","none"],["源流","元素战技","none"],["源流","普通攻击","enemy"]]) {
      const h = new Host({enemyCount:3});
      h.phaseIn=()=>({phase:turn==="enemy"?"board":"unknown",turn});
      h.ocr=(_,roi)=>roi[1]===122?name:detail;
      h.requireNoWarning=async()=>{};
      await assert.rejects(h.requireSkillPreview({who:0,skill:"NA"}),/技能确认页未核实/);h.dispose();
    }
  });
  await test("本次技能预览连续实际费用修正雷草预算，不增加取消或重新打开技能",async()=>{
    const h=new Host({enemyCount:3}),s=state({active:1,dice:{Dendro:7}}),m=T.freshMemory();
    s.characters[1].energy=2;m.thundergrassSupport="shatterbolt";
    h.phase=()=>({phase:"board",turn:"user"});h.board=()=>clone(s);h.reset=async()=>{};
    h.phaseIn=()=>({phase:"unknown",turn:"none"});h.skillPreviewIn=()=>({identity:{who:1,skill:"Q"},name:"猫猫秘宝"});
    h.skillFeeIn=()=>1;h.requireNoWarning=async()=>{};h.captureEvidence=()=>{};
    const clicks=[];h.clickAt=(...p)=>clicks.push(p);
    try{await h.execute({type:"skill",who:1,skill:"Q"},s,m);
      assert.equal(h.expectedDice,6);assert.deepEqual(clicks,[[1824,957],[1824,957]]);assert.equal(m.costEvidence,null);}
    finally{h.dispose();}
  });
  await test("技能预览费用缺失或两帧不同不修改名义预算，错误身份不能借费用放行",async()=>{
    for(const values of [[null,null],[1,2]]){
      const h=new Host({enemyCount:3});let i=0;h.phaseIn=()=>({phase:"unknown",turn:"none"});
      h.skillPreviewIn=()=>({identity:{who:1,skill:"Q"},name:"猫猫秘宝"});h.skillFeeIn=()=>values[i++];
      h.requireNoWarning=async()=>{};h.captureEvidence=()=>{};
      try{assert.equal((await h.requireSkillPreview({who:1,skill:"Q"},false,true)).fee,null);}
      finally{h.dispose();}
    }
    const h=new Host({enemyCount:3});h.phaseIn=()=>({phase:"unknown",turn:"none"});
    h.skillPreviewIn=()=>({identity:{who:0,skill:"Q"},name:"奥义·梦想真说"});h.skillFeeIn=()=>1;
    try{await assert.rejects(h.requireSkillPreview({who:1,skill:"Q"},false,true),/未核实/);}finally{h.dispose();}
  });
  await test("刻晴E后阵亡仍废弃手牌缓存，不能保留未观察到的雷楔变化",async()=>{
    const h=new Host({enemyCount:3}),s=state({active:2,hand:hand("sweet")});let n=0;
    h.acceptHand(s.hand,"fixture");h.phase=()=>++n===1?{phase:"board",turn:"enemy"}:{phase:"pick",turn:"none"};
    try{await h.confirm({type:"skill",who:2,skill:"E"},s);assert.equal(h.handCache,null);}finally{h.dispose();}
  });
  await test("战技标题框排除费用行，不对原始标题任意删字", async () => {
    const h=new Host({enemyCount:3});h.ocr=(_,roi)=>{
      const key=roi.join(",");
      if(key==="135,122,238,42")return "神变·恶曜开眼";
      if(key==="70,210,320,85")return "元素战技\n召唤雷罚恶曜之眼。";
      return "神变·恶曜开眼\n3";
    };
    assert.deepEqual(JSON.parse(JSON.stringify(h.frame(f=>h.skillPreviewIn(f)).identity)),{who:0,skill:"E"});
    h.ocr=()=>"神变·恶曜开眼3";assert.equal(h.frame(f=>h.skillPreviewIn(f)).identity,null);h.dispose();
  });
  await test("星天之兆原生中央打出手牌页仅点识别按钮一次", async () => {
    const h=new Host({enemyCount:3});h.requireNoWarning=async()=>{};
    h.phaseIn=()=>({phase:"unknown",turn:"none"});
    h.ocr=(_,roi)=>roi[0]===770?"打出手牌":roi[0]===740?"对我方出战角色生效":"";
    h.frame=fn=>fn({FindMulti:()=>({count:1,0:{text:"打出手牌",x:919,y:931,width:116,height:34}})});
    const oldClick=mock.click,presses=[];mock.click=(...xy)=>presses.push(xy);
    try{await h.cardConfirm({type:"card",id:"stars",target:null});assert.deepEqual(presses,[[977,948]]);
      for(const id of ["sweet","draw"])await assert.rejects(h.cardConfirm({type:"card",id,target:null}),/作用范围未核实/);
      assert.equal(presses.length,1);
    }finally{mock.click=oldClick;h.dispose();}
  });
  await test("料理原生选择页仅选目标一次，再匹配中央确定一次", async () => {
    const h=new Host({enemyCount:3});h.requireNoWarning=async()=>{};
    h.phaseIn=()=>({phase:"unknown",turn:"none"});h.ocr=()=>"请选择一个角色食用料理";
    h.matches=()=>[{x:943,y:932,w:64,h:31}];
    const oldClick=mock.click,presses=[];mock.click=(...xy)=>presses.push(xy);
    try{await h.cardConfirm({type:"card",id:"sweet",target:0});assert.deepEqual(presses,[[750,720],[975,948]]);
      h.matches=()=>[];await assert.rejects(h.cardConfirm({type:"card",id:"sweet",target:1}),/唯一中央确定/);
      assert.deepEqual(presses[2],[960,720]);assert.equal(presses.length,3);
    }finally{mock.click=oldClick;h.dispose();}
  });
  await test("赦免实际横幅选人一次，连续确认控件证据后仅确认一次",async()=>{
    const h=new Host({enemyCount:3}),presses=[];h.requireNoWarning=async()=>{};
    h.phaseIn=()=>({phase:"unknown",turn:"none"});h.ocr=()=>"对所选角色生效";
    h.matches=()=>[];h.ocrRows=()=>[{text:"打出手牌",x:919,y:931,w:116,h:34}];
    const oldClick=mock.click;mock.click=(...xy)=>presses.push(xy);
    try{await h.cardConfirm({type:"card",id:"edict",target:0});assert.deepEqual(presses,[[750,720],[977,948]]);}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("原生装备措辞按卡牌类型选目标一次、等待唯一中央确认一次",async()=>{
    for(const [id,banner] of [["gambler","请选择要装备圣遗物的角色"],["exile","请选择要装备圣遗物的角色"],
      ["sword","请选择要装备武器的角色"],["gambler","请选择一个角色装备圣遗物"]]) {
      const h=new Host({enemyCount:3}),presses=[];h.requireNoWarning=async()=>{};
      h.phaseIn=()=>({phase:"unknown",turn:"none"});h.ocr=()=>banner;
      h.matches=()=>presses.length?[{x:943,y:932,w:64,h:31}]:[];h.ocrRows=()=>[];
      const oldClick=mock.click;mock.click=(...xy)=>presses.push(xy);
      try{await h.cardConfirm({type:"card",id,target:id==="sword"?2:0});
        assert.deepEqual(presses,[[id==="sword"?1175:750,720],[975,948]]);}
      finally{mock.click=oldClick;h.dispose();}
    }
  });
  await test("目标卡原生直接生效时不再点击确认，退出页面不冒充效果证明",async()=>{
    const h=new Host({enemyCount:3}),presses=[];h.requireNoWarning=async()=>{};
    h.phaseIn=()=>presses.length?{phase:"board",turn:"user"}:{phase:"unknown",turn:"none"};
    h.ocr=()=>"对所选角色生效";h.matches=h.ocrRows=()=>[];
    const oldClick=mock.click;mock.click=(...xy)=>presses.push(xy);
    try{await h.cardConfirm({type:"card",id:"edict",target:1});assert.deepEqual(presses,[[960,720]]);}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("目标选人后的未知横幅或重复确认按钮拒绝，不重复点角色",async()=>{
    for(const duplicate of [true,false]){
      const h=new Host({enemyCount:3}),presses=[];h.requireNoWarning=async()=>{};
      h.phaseIn=()=>({phase:"unknown",turn:"none"});h.ocr=()=>presses.length&&!duplicate?"未知页面":"对所选角色生效";
      h.matches=()=>duplicate?[{x:943,y:932,w:64,h:31},{x:1000,y:932,w:64,h:31}]:[];h.ocrRows=()=>[];h.captureEvidence=()=>{};
      const oldClick=mock.click;mock.click=(...xy)=>presses.push(xy);
      try{await assert.rejects(h.cardConfirm({type:"card",id:"edict",target:0}),/未核实/);assert.deepEqual(presses,[[750,720]]);}
      finally{mock.click=oldClick;h.dispose();}
    }
  });
  await test("赦免1到0的真实治疗和骰子消费允许空手证明，无效果不放行",()=>{
    const b=state({hand:hand("edict"),dice:{Electro:2}}),a=clone(b),act={type:"card",id:"edict",index:0,target:0};
    b.characters[0].hp=8;a.characters[0].hp=10;a.dice.Electro=1;
    assert.equal(T.emptyHandEffect(act,b,a,false),true);assert.equal(T.emptyHandEffect(act,b,b,false),false);
  });
  await test("敌方11血是原生有效数字，不因我方基础血量限制使整排未知",()=>{
    const h=new Host({enemyCount:3});h.hpAt=(_,x,y)=>y===170?"11":"";h.has=()=>false;
    try{assert.equal(h.characterIn({},2,true,3).hp,11);h.hpAt=()=>"111";assert.equal(h.characterIn({},2,true,3).hp,null);}
    finally{h.dispose();}
  });
  await test("费用检视允许看到骰子不足，但不施放；正常技能仍拒绝不足警告",async()=>{
    const h=new Host({enemyCount:3});h.frame=fn=>fn({});h.skillPreviewIn=()=>({identity:{who:0,skill:"Q"},name:"奥义·梦想真说"});
    h.phaseIn=()=>({phase:"unknown",turn:"none"});h.captureEvidence=()=>{};
    h.requireNoWarning=async()=>{throw new Error("游戏拒绝动作：元素骰子不足");};
    try{await h.requireSkillPreview({who:0,skill:"Q"},true);await assert.rejects(h.requireSkillPreview({who:0,skill:"Q"}),/骰子不足/);}
    finally{h.dispose();}
  });
  await test("中央付款页仅按本次精确牌名匹配普通事件，不限三张补能牌", async () => {
    const h=new Host({enemyCount:3});h.requireNoWarning=async()=>{};
    h.phaseIn=()=>({phase:"unknown",turn:"none"});let banner="";
    h.ocr=(_,roi)=>roi[0]===770?"打出手牌":roi[0]===740?banner:"";
    h.frame=fn=>fn({FindMulti:()=>({count:1,0:{text:"打出手牌",x:919,y:931,width:116,height:34}})});
    const oldClick=mock.click,presses=[];mock.click=(...xy)=>presses.push(xy);
    try{for(const id of ["companion","draw","woven","shift","fast","stars","voltage","calx"]){
      banner="打出手牌："+T.byId[id].name;await h.cardConfirm({type:"card",id,target:null});
    }assert.equal(presses.length,8);assert.ok(presses.every(p=>p[0]===977&&p[1]===948));
      for(const bannerValue of ["","打出手牌：星天之兆","请选择一个角色食用料理"]){banner=bannerValue;
        await assert.rejects(h.cardConfirm({type:"card",id:"companion",target:null}),/作用范围未核实/);
      }assert.equal(presses.length,8);
    }finally{mock.click=oldClick;h.dispose();}
  });
  await test("抵天雷罚与飞叶迴斜只确认已选出战角色的中央付款，不补点角色或技能",async()=>{
    for(const [id,who] of [["penance",2],["talent",1]]) {
      const h=new Host({enemyCount:3}),presses=[],s=state({active:who});h.requireNoWarning=async()=>{};
      h.phaseIn=()=>({phase:"unknown",turn:"none"});
      h.ocr=(_,roi)=>roi[0]===770?"打出手牌":roi[0]===740?"装备给出战中的"+T.team[who].name:"";
      h.frame=fn=>fn({FindMulti:()=>({count:1,0:{text:"打出手牌",x:919,y:931,width:116,height:34}})});
      const oldClick=mock.click;mock.click=(...xy)=>presses.push(xy);
      try{await h.cardConfirm({type:"card",id,target:who},s);assert.deepEqual(presses,[[977,948]]);}
      finally{mock.click=oldClick;h.dispose();}
    }
  });
  await test("天赋中央付款拒绝错角色、后台目标、冻结、阵亡和无基线，不发送输入",async()=>{
    for(const fault of ["wrong-name","wrong-active","wrong-target","frozen","dead","no-baseline"]) {
      const h=new Host({enemyCount:3}),presses=[],s=state({active:2});h.requireNoWarning=async()=>{};
      if(fault==="wrong-active")s.active=1;
      if(fault==="frozen")s.characters[2].frozen=true;
      if(fault==="dead"){s.characters[2].dead=true;s.characters[2].hp=0;}
      h.phaseIn=()=>({phase:"unknown",turn:"none"});
      h.ocr=(_,roi)=>roi[0]===770?"打出手牌":roi[0]===740?"装备给出战中的"+(fault==="wrong-name"?"柯莱":"刻晴"):"";
      h.frame=fn=>fn({FindMulti:()=>({count:1,0:{text:"打出手牌",x:919,y:931,width:116,height:34}})});
      const oldClick=mock.click;mock.click=(...xy)=>presses.push(xy);
      try{await assert.rejects(h.cardConfirm({type:"card",id:"penance",target:fault==="wrong-target"?1:2},
        fault==="no-baseline"?null:s),/作用范围未核实/);assert.deepEqual(presses,[]);}
      finally{mock.click=oldClick;h.dispose();}
    }
  });
  await test("中央出牌控件短暂缺失仅只读复核，连续稳定才确认，持续重复按钮不点击",async()=>{
    for(const duplicate of [false,true]) {
      const h=new Host({enemyCount:3}),presses=[];h.requireNoWarning=async()=>{};let reads=0;
      h.phaseIn=()=>({phase:"unknown",turn:"none"});
      h.ocr=(_,roi)=>roi[0]===770?"打出手牌":roi[0]===740?"对我方出战角色生效":"";
      h.frame=fn=>fn({FindMulti:()=>({count:1,0:{text:"打出手牌",x:919,y:931,width:116,height:34}})});
      h.ocrRows=()=>{reads++;return duplicate?[{text:"打出手牌",x:919,y:931,w:116,h:34},{text:"打出手牌",x:1000,y:931,w:116,h:34}]:
        reads===1?[]:[{text:"打出手牌",x:919,y:931,w:116,h:34}];};
      const oldClick=mock.click;mock.click=(...xy)=>presses.push(xy);
      try{if(duplicate){await assert.rejects(h.cardConfirm({type:"card",id:"stars",target:null}),/控件未连续核实/);
          assert.deepEqual(presses,[]);assert.equal(reads,6);}
        else{await h.cardConfirm({type:"card",id:"stars",target:null});assert.deepEqual(presses,[[977,948]]);assert.equal(reads,3);}}
      finally{mock.click=oldClick;h.dispose();}
    }
  });
  await test("拖牌前手牌变化时停止，禁止复用旧索引", async () => {
    const h = new Host({ enemyCount: 3 }), s = state({ hand: hand("woven", "sweet") });
    h.phase = () => ({ phase:"board",turn: "user" }); h.reset = async () => {}; h.board = () => clone(s);
    h.handCount = async () => 2; h.expand=async()=>{};h.titleAt=async()=>"甜甜花酿鸡";
    const presses = []; const oldClick = mock.click; mock.click = (...xy) => presses.push(xy);
    await assert.rejects(h.execute({ type: "card", id: "woven", index: 0, target: null }, s, T.freshMemory()), /卡名校验失败/);
    assert.equal(presses.length, 0); mock.click = oldClick; h.dispose();
  });
  await test("手牌一次展开顺序读取，末尾一次收起，不逐牌点空白", async () => {
    const h=new Host({enemyCount:3});let expands=0,resets=0;const points=[];
    h.handCount=async()=>5;h.expand=async()=>{expands++;};h.reset=async()=>{resets++;};
    h.titleAt=async(x,y)=>{points.push([x,y]);return T.cards[points.length-1].name;};
    try{const hs=await h.readHand();assert.equal(hs.length,5);assert.equal(expands,1);assert.equal(resets,1);
      assert.deepEqual(points,[[719,945],[913,945],[1115,945],[1319,945],[1528,945]]);
      h.handCount=async()=>0;expands=resets=0;assert.equal((await h.readHand()).length,0);assert.equal(expands,0);assert.equal(resets,1);
    }finally{h.dispose();}
  });
  await test("计数已留下展开手牌时直接顺序读，不重复点空白/展开", async () => {
    const h=new Host({enemyCount:3});let expands=0,resets=0,reads=0;
    h.handCount=async()=>{h.handFanReady=true;return 5;};h.expand=async()=>expands++;
    h.reset=async()=>resets++;h.titleAt=async()=>T.cards[reads++].name;
    try{assert.equal((await h.readHand()).length,5);assert.equal(expands,0);assert.equal(resets,1);assert.equal(reads,5);}
    finally{h.dispose();}
  });
  await test("动画和无效血量不能开始点手牌，必须先两帧相同有效局面",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven")});let phases=0,boards=0,scans=0;
    h.phase=()=>++phases<3?{phase:"transition",turn:"none"}:{phase:"board",turn:"user"};
    h.board=()=>{boards++;const b=clone(s);if(boards===1)b.characters[0].hp=null;return b;};
    h.readHand=async()=>{assert.ok(phases>=3);assert.ok(boards>=3);scans++;return clone(s.hand);};
    try{assert.equal((await h.settledBoard()).active,0);assert.equal(scans,0);
      assert.equal((await h.observe()).hand.length,1);assert.equal(scans,1);}
    finally{h.dispose();}
  });
  await test("稳定前进入敌方/重投/阵亡页返回阶段信息，不点手牌",async()=>{
    for(const phase of [{phase:"board",turn:"enemy"},{phase:"roll",turn:"none"},{phase:"pick",turn:"none"}]){
      const h=new Host({enemyCount:3});h.phase=()=>({phase:"board",turn:"user"});h.board=()=>({...state(),...phase});
      h.readHand=async()=>{throw new Error("must-not-read");};
      try{assert.equal((await h.observe()).phase,phase.phase);}finally{h.dispose();}
    }
  });
  await test("4到5张生成牌计数暂缺只能有界重新观察，不猜5也不吞宿主错误",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("wedge","woven","sweet","shift","draw")});let scans=0;
    h.phase=()=>({phase:"board",turn:"user"});h.board=()=>clone(s);
    h.readHand=async()=>{if(++scans===1){const e=new Error("count not ready");e.code="TCG_HAND_RETRY";throw e;}return clone(s.hand);};
    try{assert.equal((await h.observe(true)).hand.length,5);assert.equal(scans,2);
      scans=0;h.readHand=async()=>{scans++;const e=new Error("persistent missing");e.code="TCG_HAND_RETRY";throw e;};
      await assert.rejects(h.observe(true),/persistent missing/);assert.equal(scans,3);
      scans=0;h.readHand=async()=>{scans++;throw new Error("native failure");};await assert.rejects(h.observe(true),/native failure/);assert.equal(scans,1);
    }finally{h.dispose();}
  });
  await test("终局在第三张标题前出现：observe返回真实胜利，不再点牌或收起手牌",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("wedge","woven","sweet","shift","draw")});
    let reads=0,resets=0;const oldClick=mock.click,clicks=[];mock.click=(...xy)=>clicks.push(xy);
    const phase=()=>reads>=4?{phase:"result",result:"win",turn:"none"}:{phase:"board",turn:"user"};
    h.phase=h.phaseIn=phase;h.settledBoard=async()=>clone(s);h.handCount=async()=>5;
    h.expand=async()=>{};h.reset=async()=>resets++;h.ocr=()=>reads++<2?"雷楔":reads<=4?"万千的愿望":"";
    try{const after=await h.observe(true);assert.equal(after.result,"win");assert.equal(after.hand,null);
      assert.equal(reads,4);assert.equal(clicks.length,2);assert.equal(resets,0);}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("胜利或失败在同一张牌的两次标题之间出现，不能把空OCR误报为牌名故障",async()=>{
    for(const result of ["win","lose"]){
      const h=new Host({enemyCount:3}),s=state({hand:hand("woven")});let reads=0;
      h.phase=h.phaseIn=()=>reads?{phase:"result",result,turn:"none"}:{phase:"board",turn:"user"};
      h.settledBoard=async()=>clone(s);h.handCount=async()=>1;h.expand=async()=>{};h.ocr=()=>{reads++;return "交织之雷";};
      h.reset=async()=>{throw new Error("must-not-reset-result");};
      try{const after=await h.observe(true);assert.equal(after.result,result);assert.equal(reads,1);assert.equal(after.hand,null);}
      finally{h.dispose();}
    }
  });
  await test("手数采样期间进入胜利/敌方/选人/重投/结算/行动横幅，优先交回阶段不盲探",async()=>{
    for(const phase of [{phase:"result",result:"win",turn:"none"},{phase:"board",turn:"enemy"},
      {phase:"pick",turn:"none"},{phase:"roll",turn:"none"},{phase:"settlement",turn:"none"},{phase:"transition",turn:"none"}]){
      const h=new Host({enemyCount:3}),s=state();let expands=0,ocr=0,phaseReads=0;
      h.phase=()=>++phaseReads>2?phase:{phase:"board",turn:"user"};h.phaseIn=()=>phase;h.settledBoard=async()=>clone(s);
      h.expand=async()=>expands++;h.ocr=()=>{ocr++;return "0";};h.reset=async()=>{throw new Error("no-reset");};
      try{const after=await h.observe(true);assert.equal(after.phase,phase.phase);assert.equal(after.turn,phase.turn);
        assert.equal(expands,1);assert.equal(ocr,2);assert.equal(after.hand,null);}
      finally{h.dispose();}
    }
  });
  await test("稳定牌桌空标题仍是实错，宿主OCR异常也不能被阶段中断吞掉",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven")});
    h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});h.settledBoard=async()=>clone(s);
    h.handCount=async()=>1;h.expand=async()=>{};h.reset=async()=>{};h.ocr=()=>"";
    try{await assert.rejects(h.observe(true),/卡名无法可靠读取/);
      h.ocr=()=>{throw new Error("native OCR failure");};await assert.rejects(h.observe(true),/native OCR failure/);}
    finally{h.dispose();}
  });
  await test("短暂计数5后空白仅有界重新观察，不能接受单帧或盲探；恢复后再正式读牌",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven","sweet","shift","draw","wedge")});let reads=0,expands=0;
    h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});h.settledBoard=async()=>clone(s);h.board=()=>clone(s);
    h.expand=async()=>{expands++;h.handFanReady=true;};h.reset=async()=>{};
    h.ocr=()=>["5","","",""][reads++];h.titleAt=async()=>{throw new Error("no-boundary-probing");};
    try{await assert.rejects(h.handCount(),e=>e.code==="TCG_HAND_RETRY");assert.equal(reads,4);assert.equal(expands,1);
      reads=expands=0;h.ocr=()=>["5","","","","5","5"][reads++];let titles=0;h.titleAt=async()=>s.hand[titles++].name;
      assert.equal((await h.observe(true)).hand.length,5);assert.equal(reads,6);assert.equal(expands,0);assert.equal(titles,5);}
    finally{h.dispose();}
  });
  await test("连续计数采样之间不插入慢阶段OCR，返回前必须再次核实阶段",async()=>{
    const h=new Host({enemyCount:3});let badgeReads=0,phases=0;
    h.expand=async()=>{};h.phase=()=>{phases++;assert.notEqual(badgeReads,1,"slow phase OCR interleaved");return {phase:"board",turn:"user"};};
    h.has=(_,asset)=>{if(asset==="num/Hand5"){badgeReads++;return true;}return false;};
    h.ocr=()=>{throw new Error("no-unnecessary-OCR");};
    try{assert.equal(await h.handCount(),5);assert.equal(badgeReads,2);assert.equal(phases,2);}
    finally{h.dispose();}
  });
  await test("终局board短路，不在不存在的牌桌上读HP或骰子",()=>{
    const h=new Host({enemyCount:3});h.phaseIn=()=>({phase:"result",result:"win",turn:"none"});
    h.characterIn=()=>{throw new Error("no-terminal-HP");};h.diceIn=()=>{throw new Error("no-terminal-dice");};
    try{assert.equal(h.board().result,"win");}finally{h.dispose();}
  });
  await test("终局标题在原生动画中部和最终上方共用完整识别框，回合图标不能抢先放行",()=>{
    const h=new Host({enemyCount:3});let text="对局胜利\n湖边奇遇";
    h.ocr=(_,roi)=>roi.join(",")==="763,101,394,600"?text:"";
    h.has=(_,asset)=>asset==="user_turn";
    try{assert.equal(h.phaseIn({}).result,"win");text="对局失败";assert.equal(h.phaseIn({}).result,"lose");
      text="";assert.equal(h.phaseIn({}).turn,"user");}
    finally{h.dispose();}
  });
  await test("confirm读牌途中的终局直接完成确认，无重新执行或错误提交资源",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven","sweet","shift","draw","wedge")});let reads=0;
    h.phase=h.phaseIn=()=>reads>=4?{phase:"result",result:"win",turn:"none"}:{phase:"board",turn:"user"};
    h.settledBoard=async()=>clone(s);h.board=()=>clone(s);h.handCount=async()=>5;h.expand=async()=>{};h.reset=async()=>{};
    h.ocr=()=>++reads<=4?"雷楔":"";h.execute=async()=>{throw new Error("must-not-reexecute");};
    try{const after=await h.confirm({type:"skill",who:2,skill:"E"},s);assert.equal(after.result,"win");assert.equal(after.confirmed,true);assert.equal(reads,4);}
    finally{h.dispose();}
  });
  await test("main执行前阶段中断不提交或重放旧动作，预算恢复；普通宿主异常仍停止",async()=>{
    for(const fatal of [false,true]){
      const events=[];let phase="pick",observations=0,executions=0,confirmations=0;
      class DeferredHost {
        constructor(){this.expectedDice=8;this.zeroDiceAllowed=false;this.emptyHandProven=false;this.gamblerMayAddDice=false;this.gamblerBudget=null;}
        trace(event,data){events.push({event,data});}async waitForCapture(){}
        phase(){return phase==="result"?{phase,result:"win",turn:"none"}:{phase,turn:phase==="board"?"user":"none"};}
        async validateTeam(){}async pick(){phase="board";}
        async observe(){observations++;assert.equal(this.expectedDice,8);assert.equal(this.zeroDiceAllowed,false);
          assert.equal(this.emptyHandProven,false);assert.equal(this.gamblerMayAddDice,false);assert.equal(this.gamblerBudget,null);return state({hand:hand("woven")});}
        async execute(){executions++;if(executions===1){this.expectedDice=9;this.zeroDiceAllowed=true;this.emptyHandProven=true;this.gamblerMayAddDice=true;this.gamblerBudget={owner:2,remaining:3,enemies:3};
          const e=new Error(fatal?"host failure":"phase changed");if(!fatal){e.code="TCG_OBSERVATION_INTERRUPTED";e.phase={phase:"board",turn:"enemy"};}throw e;}}
        async confirm(){confirmations++;phase="result";return {phase,result:"win",turn:"none",confirmed:true};}
        snapshot(reason){events.push({event:"stop",data:{reason}});}dispose(){}
      }
      const replay={settings:{mode:"自动试验"},TCGBetterGI:{BetterGIHost:DeferredHost},setGameMetrics:()=>{},sleep:async()=>{},
        log:{info:()=>{},warn:()=>{},error:()=>{}},file:{readTextSync:p=>p==="lib/core.js"?
          fs.readFileSync(path.join(base,p),"utf8")+"\nTCG.choose=()=>({type:'card',id:'woven',index:0,target:null});":""}};
      const run=vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),vm.createContext(replay));
      if(fatal){await assert.rejects(run,/host failure/);assert.equal(executions,1);assert.equal(confirmations,0);assert.ok(events.some(e=>e.event==="stop"));}
      else{await run;assert.equal(observations,2);assert.equal(executions,2);assert.equal(confirmations,1);
        assert.equal(events.filter(e=>e.event==="confirmed").length,1);assert.equal(events.filter(e=>e.event==="execution-deferred").length,1);assert.ok(events.some(e=>e.event==="result"));}
    }
  });
  await test("出牌前仅被动检查数量与一次目标标题，无数量边界探测；未知规则牌可核名调和",async()=>{
    const h=new Host({enemyCount:3}),u=T.observedCard("护法之誓",0),s=state({hand:[u,...hand("woven","sweet").map((c,i)=>({...c,index:i+1}))]});
    let scans=0,counts=0,titles=0,drags=0,confirms=0;
    h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(s);h.requireNoWarning=async()=>{};
    h.handCount=async()=>{counts++;throw new Error("redundant boundary count");};h.handCountIn=()=>s.hand.length;h.expand=async()=>{h.handFanReady=true;};
    h.readHand=async()=>{scans++;throw new Error("redundant scan");};h.titleAt=async()=>{titles++;return u.name;};
    h.drag=async()=>drags++;h.clickButton=async asset=>{assert.equal(asset,"元素调和");confirms++;};
    try{await h.execute({type:"tune",id:u.id,index:0,element:"Electro"},s,T.freshMemory());
      assert.equal(scans,0);assert.equal(counts,0);assert.equal(titles,1);assert.equal(drags,1);assert.equal(confirms,1);
      h.handCountIn=()=>2;await assert.rejects(h.execute({type:"tune",id:u.id,index:0,element:"Electro"},s,T.freshMemory()),/张数已变化/);assert.equal(drags,1);
      h.handCountIn=()=>3;h.titleAt=async()=>"提米";await assert.rejects(h.execute({type:"tune",id:u.id,index:0,element:"Electro"},s,T.freshMemory()),/卡名校验失败/);assert.equal(drags,1);
      h.titleAt=async()=>u.name;let p=0;h.phase=()=>++p>1?{phase:"board",turn:"enemy"}:{phase:"board",turn:"user"};
      await assert.rejects(h.execute({type:"tune",id:u.id,index:0,element:"Electro"},s,T.freshMemory()),e=>e.code==="TCG_OBSERVATION_INTERRUPTED");assert.equal(drags,1);
    }finally{h.dispose();}
  });
  await test("满能有总骰可逐张烧已识别牌开大，未知规则不阻止调和且每步效果核实",()=>{
    const m=T.freshMemory();m.raidenBurst=m.colleiBurst=true;m.dendroRound=1;m.round=2;
    const s=state({active:2,dice:{Electro:2,Cryo:2,Omni:0},hand:[T.observedCard("护法之誓",0),T.observedCard("万千的愿望",1)]});s.characters[2].energy=3;
    for(let i=0;i<2;i++){
      const action=T.choose(s,m);assert.equal(action.type,"tune");assert.equal(action.element,"Electro");
      const after=clone(s);after.hand.splice(action.index,1);after.hand.forEach((h,index)=>h.index=index);after.dice.Cryo--;after.dice.Electro++;
      assert.equal(T.verify(action,s,after),true);Object.assign(s,after);
    }
    assert.equal(T.choose(s,m).skill,"Q");
    s.characters[2].energy=2;assert.notEqual(T.choose(s,m).skill,"Q");
  });
  await test("总骰不足刻晴大招时不烧牌冒充加骰，但合法战技/普攻不会被白白浪费",()=>{
    const m=T.freshMemory();m.raidenBurst=m.colleiBurst=true;m.round=2;m.dendroRound=2;
    const s=state({active:2,dice:{Electro:3},hand:hand("sweet")});s.characters[2].energy=3;s.characters[2].hp=10;
    assert.equal(T.choose(s,m).skill,"E");s.dice={Electro:1,Pyro:2};assert.equal(T.choose(s,m).skill,"NA");
    s.dice={Electro:2};assert.equal(T.choose(s,m).type,"end");
  });
  await test("重投按启动阶段保留有限元素预算，不能留五雷饿死柯莱",()=>{
    const items=[...Array(5).fill({element:"Electro"}),{element:"Dendro"},{element:"Omni"},{element:"Pyro"}],m=T.freshMemory();
    let plan=T.rerollPlan(items,m);assert.equal(plan.primary,"Electro");assert.deepEqual(clone(plan.indices),[0,1,2,3,4,6]);
    m.raidenBurst=true;plan=T.rerollPlan(items,m);assert.equal(plan.primary,"Dendro");assert.deepEqual(clone(plan.indices),[0,1,2,5,6]);
    m.colleiBurst=true;m.round=m.dendroRound=2;plan=T.rerollPlan(items,m);assert.equal(plan.primary,"Electro");assert.deepEqual(clone(plan.indices),[0,1,2,3,4,6]);
    m.round=4;assert.equal(T.rerollPlan(items,m).secondary,"Dendro");
  });
  await test("敌方三到二到一张重居中，必须完整HP和唯一出战，未知/冲突不猜死亡",()=>{
    const h=new Host({enemyCount:3});h.has=()=>false;let layout=3;
    h.hpAt=(_,x,y)=>{const xs=layout===3?[646,856,1066]:layout===2?[751,962]:[856];const i=xs.indexOf(x);return i>=0 && y===(i===0?212:170)?String([4,8,3][i]):"";};
    try{for(layout of [3,2,1]){const enemies=h.enemiesIn({});assert.equal(enemies.length,layout);assert.equal(enemies.filter(c=>c.active).length,1);assert.ok(enemies.every(c=>c.dead===false));}
      h.hpAt=()=>"";assert.ok(h.enemiesIn({}).every(c=>c.hp===null&&c.dead===null));
      h.characterIn=(_,who,enemy,count)=>({hp:4,dead:false,active:who===0});assert.ok(h.enemiesIn({}).every(c=>c.hp===null));
    }finally{h.dispose();}
  });
  await test("原生我方行动横幅覆盖回合图标，不能把过渡画面当可执行牌桌",()=>{
    const h=new Host({enemyCount:3});h.has=(_,asset)=>asset==="user_turn";
    h.ocr=(_,roi)=>roi[0]===700?"我方行动":"";
    try{assert.equal(h.phaseIn({}).phase,"transition");h.ocr=()=>"";assert.equal(h.phaseIn({}).turn,"user");}
    finally{h.dispose();}
  });
  await test("切人预览无回合图标，核实目标标题和连续两帧后仅确认一次", async () => {
    for(const [predictedFast,fast] of [[false,false],[true,true],[false,true],[true,false]]) {
      const h=new Host({enemyCount:3}),s=state(),m=T.freshMemory();m.fastSwitch=predictedFast;
      h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(s);
      h.titleAt=async(x,y,opening,hover,kind,expected)=>{assert.equal(x,960);assert.equal(kind,"character");assert.equal(expected,1);return "柯莱";};
      h.phaseIn=()=>({phase:"unknown",turn:"none"});h.requireNoWarning=async()=>{};
      h.ocr=(_,roi)=>roi[0]===700?"将所选角色切换为出战角色":roi[0]===1720?"切换角色":fast?"快速行动":"";
      const oldClick=mock.click,presses=[];mock.click=(...xy)=>presses.push(xy);
      try{await h.execute({type:"switch",target:1},s,m);assert.deepEqual(presses,[[1820,958],[1820,958]]);}
      finally{mock.click=oldClick;h.dispose();}
    }
  });
  await test("切人未知横幅、错误类型或敌方回合不能放行", async () => {
    for(const [banner,control,speed,turn] of [["","切换角色","战斗行动","none"],["将所选角色切换为出战角色","确定","战斗行动","none"],["将所选角色切换为出战角色","切换角色","未知行动","none"],["将所选角色切换为出战角色","切换角色","战斗行动","enemy"]]) {
      const h=new Host({enemyCount:3});h.phaseIn=()=>({phase:turn==="enemy"?"board":"unknown",turn});h.requireNoWarning=async()=>{};
      h.ocr=(_,roi)=>roi[0]===700?banner:roi[0]===1720?control:speed;
      await assert.rejects(h.requireSwitchPreview({target:1},T.freshMemory()),/切换确认页未核实/);h.dispose();
    }
  });
  await test("行动速度需连续稳定，普通和快速交替不能放行切人", async () => {
    const h=new Host({enemyCount:3}),m=T.freshMemory();m.fastSwitch=true;
    h.phaseIn=()=>({phase:"unknown",turn:"none"});h.requireNoWarning=async()=>{};
    let reads=0;h.ocr=(_,roi)=>roi[0]===700?"将所选角色切换为出战角色":roi[0]===1720?"切换角色":++reads%2?"":"快速行动";
    await assert.rejects(h.requireSwitchPreview({target:1},m),/切换确认页未核实/);h.dispose();
  });
  await test("动作未证实时完整重同步一次继续，明确未确认且不重新执行", async () => {
    const h = new Host({ enemyCount: 3 }), s = state({ hand: hand("woven", "sweet") });
    h.phase = () => ({ turn: "user" }); h.reset = async () => {}; h.board = () => clone(s); h.observe = async () => clone(s);
    let reads=0;h.observe=async()=>{reads++;return clone(s);};
    const result=await h.confirm({ type: "card", id: "woven", index: 0 }, s);
    assert.equal(result.confirmed,false);assert.equal(result.resynchronized,true);assert.equal(reads,2);
    h.dispose();
  });
  await test("技能结果的阶段信息无characters时不抛TypeError，unknown不算成功", () => {
    const before=state(),action={type:"skill",who:0,skill:"E"};
    assert.equal(T.verify(action,before,{phase:"unknown",turn:"none"}),false);
    assert.equal(T.verify(action,before,{phase:"board",turn:"enemy"}),true);
    assert.equal(T.verify(action,before,{phase:"board",turn:"user"}),false);
    assert.equal(T.verify(action,before,null),false);
  });
  await test("技能确认读牌期间换到敌方先暂缓，再取得完整结果且仅观察", async () => {
    const h=new Host({enemyCount:3}),before=state(),after=clone(before);let reads=0;const events=[];
    after.characters[0].energy=1;after.dice.Electro-=3;h.expectedDice=T.total(after.dice);
    h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(before);
    h.observe=async()=>++reads===1?{phase:"board",turn:"enemy",hand:null}:clone(after);
    h.trace=(event,data)=>events.push({event,data});
    try{assert.equal((await h.confirm({type:"skill",who:0,skill:"E"},before)).confirmed,true);
      assert.equal(reads,2);assert.equal(events.filter(e=>e.event==="confirmation-deferred").length,1);
    }finally{h.dispose();}
  });
  await test("拖动中取消仍抬起鼠标，避免按钮卡在按下状态", async () => {
    const h = new Host({ enemyCount: 3 });
    const oldSleep = mock.sleep, oldDown = mock.leftButtonDown, oldUp = mock.leftButtonUp;
    let sleeps = 0, downs = 0, ups = 0;
    mock.sleep = async () => { if (++sleeps === 3) throw new Error("cancel-canary"); };
    mock.leftButtonDown = () => { downs++; }; mock.leftButtonUp = () => { ups++; };
    await assert.rejects(h.drag(100, 100, 500, 500), /cancel-canary/);
    assert.equal(downs, 1); assert.equal(ups, 1);
    mock.sleep = oldSleep; mock.leftButtonDown = oldDown; mock.leftButtonUp = oldUp; h.dispose();
  });
  await test("增量计划删除精确索引，重复同名牌不重排，原手牌不被修改",()=>{
    const before=state({hand:hand("sweet","woven","sweet","shift")}), original=clone(before.hand);
    const p=T.handPlan({type:"card",id:"sweet",index:2},before);
    assert.equal(p.mode,"remove");assert.deepEqual(clone(p.hand).map(h=>h.id),["sweet","woven","shift"]);
    assert.deepEqual(clone(p.hand).map(h=>h.index),[0,1,2]);assert.deepEqual(clone(before.hand),original);
    assert.throws(()=>T.handPlan({type:"tune",id:"sweet",index:1},before),/索引\/身份/);
  });
  await test("普通技能和切人保留手牌；过牌、刻晴E和战斗牌生成/替换不猜新牌位置",()=>{
    const before=state({hand:hand("sweet","wedge","draw")});
    for(const action of [{type:"skill",who:0,skill:"Q"},{type:"skill",who:1,skill:"E"},{type:"switch",target:2}]) {
      const p=T.handPlan(action,before);assert.equal(p.mode,"unchanged");assert.deepEqual(clone(p.hand),clone(before.hand));
    }
    for(const action of [{type:"skill",who:2,skill:"E"},...['draw','talent','wedge'].map(id=>({type:"card",id,index:0}))]) {
      const p=T.handPlan(action,before);assert.equal(p.mode,"full");assert.equal(p.hand,null);
    }
  });
  await test("稳定手牌缓存普通观察不展开不点击，返回副本防止索引被外部改写",async()=>{
    const h=new Host({enemyCount:3}),before=state({hand:hand("sweet","woven")});
    h.acceptHand(before.hand,"fixture");h.handCountIn=()=>null;h.readHand=async()=>{throw new Error("redundant full scan");};
    h.phase=()=>({phase:"board",turn:"user"});h.settledBoard=async()=>clone(before);h.board=()=>clone(before);
    h.expand=async()=>{throw new Error("must not expand");};
    try{const after=await h.observe();assert.deepEqual(clone(after.hand),clone(before.hand));
      after.hand[0].index=9;assert.equal(h.handCache[0].index,0);}
    finally{h.dispose();}
  });
  await test("被动读到意外数量即清缓存整手同步，不把缓存张数强行当成实际张数",async()=>{
    const h=new Host({enemyCount:3});h.acceptHand(hand("sweet"),"fixture");h.handCountIn=()=>3;let scans=0;
    h.readHand=async()=>{scans++;return hand("draw","sweet","woven");};
    try{const hs=await h.observedHand();assert.equal(hs.length,3);assert.equal(scans,1);assert.equal(h.handCache,null);}
    finally{h.dispose();}
  });
  await test("资源不符发生在读牌前、读牌后或牌桌恢复时，均保留已确认手牌且零展开",async()=>{
    for(const stage of ["before","after","recovery"]) {
      const h=new Host({enemyCount:3}),s=state({hand:hand("sweet","woven"),dice:{Electro:5}}),late=clone(s);
      late.dice.Electro=4;h.expectedDice=stage==="before"?4:5;h.acceptHand(s.hand,"fixture");
      h.phase=()=>({phase:"board",turn:"user"});h.handCountIn=()=>null;
      h.readHand=h.expand=async()=>{throw new Error("resource-only change must not touch hand");};
      let settled=0,boards=0;h.settledBoard=async()=>clone(stage==="recovery"&&++settled>1?late:s);
      h.board=()=>stage==="after"?clone(late):stage==="recovery"?{...clone(s),dice:{Electro:++boards%2?3:4}}:clone(s);
      try{const after=await h.observe();assert.deepEqual(clone(after.hand),clone(s.hand));
        assert.equal(h.handScanSerial,0);assert.equal(h.expectedDice,stage==="before"?5:4);}
      finally{h.dispose();}
    }
  });
  await test("出牌后增量删除先有实际计数证据，计划本身不能发布或证明出牌",async()=>{
    const h=new Host({enemyCount:3}),before=state({hand:hand("sweet","woven")}),p=T.handPlan({type:"card",id:"sweet",index:0},before);
    h.acceptHand(before.hand,"fixture");h.handCount=async n=>{assert.equal(n,1);return 1;};h.reset=async()=>{};
    h.phase=()=>({phase:"board",turn:"user"});h.readHand=async()=>{throw new Error("unnecessary scan");};
    try{const hs=await h.observedHand(p);assert.deepEqual(clone(hs).map(c=>c.id),["woven"]);
      assert.equal(h.handCache.length,2,"not committed before effect verification");
      h.handCount=async()=>2;h.readHand=async()=>clone(before.hand);
      assert.deepEqual(clone(await h.observedHand(p)),clone(before.hand));assert.equal(h.handCache,null);}
    finally{h.dispose();}
  });
  await test("已确认零手牌仅独立效果证明允许免扫描，未证明时仍读取实际数量",async()=>{
    const h=new Host({enemyCount:3});const p=T.handPlan({type:"tune",id:"sweet",index:0},state({hand:hand("sweet")}));let counts=0;
    h.handCount=async()=>{counts++;return 1;};h.readHand=async()=>hand("sweet");
    try{assert.equal((await h.observedHand(p)).length,1);assert.equal(counts,1);
      h.emptyHandProven=true;assert.equal((await h.observedHand(p)).length,0);assert.equal(counts,1);}
    finally{h.dispose();}
  });
  await test("低张数历史候选不是证据：无只读数量时有界重读，不探测候选卡位",async()=>{
    const h=new Host({enemyCount:3});let expands=0,reads=0;
    h.phase=()=>({phase:"board",turn:"user"});h.expand=async()=>{expands++;h.handFanReady=true;};h.handCountIn=()=>{reads++;return null;};
    h.titleAt=async()=>{throw new Error("candidate click forbidden");};
    try{await assert.rejects(h.handCount(2),e=>e.code==="TCG_HAND_RETRY");assert.equal(reads,4);assert.equal(expands,1);assert.equal(h.probeHandCount,undefined);}
    finally{h.dispose();}
  });
  await test("不再存在允许空标题通过的边界分支，卡名空白仍不得通过",async()=>{
    const h=new Host({enemyCount:3}),events=[];let reads=0;
    h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});h.ocr=()=>{reads++;return "";};h.trace=(event,data)=>events.push({event,data});
    try{assert.equal(await h.titleAt(812,945,false,false,"card",null,true),"");assert.equal(reads,6);
      assert.equal(events[0].data.stable,false);}
    finally{h.dispose();}
  });
  await test("连续4到3到2到1调和每步仅一次目标标题，前后零边界探测，真实效果后才提交缓存",async()=>{
    const h=new Host({enemyCount:3}),m=T.freshMemory(),events=[];
    let current=state({hand:hand("sweet","fast","calx","woven"),dice:{Electro:0,Cryo:4}}),titles=0,expands=0,probes=0,drags=0;
    h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});h.board=()=>clone(current);h.settledBoard=async()=>clone(current);
    h.reset=async()=>{h.handFanReady=false;};h.expand=async()=>{expands++;h.handFanReady=true;};h.handCountIn=()=>null;
    h.handCount=async()=>{probes++;throw new Error("redundant count probe");};h.readHand=async()=>{throw new Error("redundant scan");};
    h.titleAt=async()=>{titles++;return current.hand[0].name;};h.requireNoWarning=async()=>{};h.clickButton=async()=>{};
    h.trace=(event,data)=>events.push({event,data});h.acceptHand(current.hand,"fixture");
    h.drag=async()=>{drags++;current.hand=T.indexedHand(current.hand.slice(1));current.dice.Electro++;current.dice.Cryo--;};
    try{for(let n=4;n>1;n--){const before=clone(current),action={type:"tune",id:before.hand[0].id,index:0,element:"Electro"};
        await h.execute(action,before,m);assert.equal(h.handCache.length,n,"no projected commit");
        const after=await h.confirm(action,before);assert.equal(after.confirmed,true);assert.equal(h.handCache.length,n-1);}
      assert.equal(titles,3);assert.equal(expands,3);assert.equal(probes,0);assert.equal(drags,3);
      assert.equal(events.filter(e=>e.event==="hand-input-check").length,3);
      assert.equal(events.filter(e=>e.event==="hand-incremental"&&e.data.proof==="independent-native-effect").length,3);}
    finally{h.dispose();}
  });
  await test("独立消耗效果只支持真实调和补能回血生骰，不凭预测支付证明零费状态",()=>{
    const before=state({hand:hand("fast","sweet","woven","stars"),dice:{Electro:3,Cryo:2}}),after=clone(before);
    for(const id of ["fast","shift","smoked","gambler","lotus","draw"]){assert.equal(T.removalEffect({type:"card",id,target:0},before,after),false);}
    after.characters[0].energy++;assert.equal(T.removalEffect({type:"card",id:"stars"},before,after),true);
    after.characters[0].hp++;assert.equal(T.removalEffect({type:"card",id:"sweet",target:0},before,after),true);
    after.dice.Electro++;assert.equal(T.removalEffect({type:"card",id:"woven"},before,after),true);
    assert.equal(T.removalEffect({type:"tune",element:"Electro"},before,after),false);
    after.dice.Cryo--;assert.equal(T.removalEffect({type:"tune",element:"Electro"},before,after),true);
    after.active=1;assert.equal(T.removalEffect({type:"tune",element:"Electro"},before,after),false);
  });
  await test("独立效果不覆盖实际额外抽牌数量，有偏差一次完整重读且不发布预测",async()=>{
    const h=new Host({enemyCount:3}),before=state({hand:hand("sweet","woven","stars")});let scans=0;
    const p={...T.handPlan({type:"card",id:"sweet",index:0},before),effectProven:true};h.acceptHand(before.hand,"fixture");
    h.handCountIn=()=>3;h.readHand=async()=>{scans++;return hand("woven","stars","lotus");};
    try{assert.equal((await h.observedHand(p)).length,3);assert.equal(scans,1);assert.equal(h.handCache,null);}
    finally{h.dispose();}
  });
  await test("未建模快速切人实际预览确认后依真实出战和骰子核实，不读取支援或重复切人",async()=>{
    const h=new Host({enemyCount:3}),before=state(),after=clone(before),m=T.freshMemory(),events=[];
    h.phase=()=>({phase:"board",turn:"user"});h.phaseIn=()=>({phase:"unknown",turn:"none"});
    h.reset=async()=>{};h.board=()=>clone(before);h.titleAt=async()=>"柯莱";h.requireNoWarning=async()=>{};
    h.ocr=(_,roi)=>roi[0]===700?"将所选角色切换为出战角色":roi[0]===1720?"切换角色":"快速行动";
    h.trace=(event,data)=>events.push({event,data});h.observe=async()=>clone(after);after.active=1;after.dice.Electro--;
    try{await h.execute({type:"switch",target:1},before,m);assert.equal(m.fastSwitch,false);
      assert.equal((await h.confirm({type:"switch",target:1},before)).confirmed,true);
      const confirmed=events.filter(e=>e.event==="switch-confirm-clicked");assert.equal(confirmed.length,1);
      assert.equal(confirmed[0].data.fast,true);assert.equal(confirmed[0].data.predictedFast,false);}
    finally{h.dispose();}
  });
  await test("资源效果失败不假记成功；缓存只能采用完整真实回读而非投影",async()=>{
    const h=new Host({enemyCount:3}),before=state({hand:hand("woven","sweet")}),after=clone(before);
    after.hand=hand("sweet");h.acceptHand(before.hand,"fixture");h.phase=()=>({phase:"board",turn:"user"});
    h.reset=async()=>{};h.board=()=>clone(before);h.observe=async()=>clone(after);
    try{const result=await h.confirm({type:"card",id:"woven",index:0},before);assert.equal(result.confirmed,false);
      assert.deepEqual(clone(h.handCache),clone(after.hand));}
    finally{h.dispose();}
  });
  await test("生成牌强制整手同步允许插入任意位置，同数量替换也不复用旧手牌",async()=>{
    const h=new Host({enemyCount:3});h.acceptHand(hand("wedge","sweet"),"fixture");let scans=0;
    h.readHand=async()=>{scans++;return hand("draw","sweet");};
    try{const hs=await h.observedHand(T.handPlan({type:"skill",who:2,skill:"E"},state({hand:hand("wedge","sweet")})));
      assert.deepEqual(clone(hs).map(c=>c.id),["draw","sweet"]);assert.equal(scans,1);assert.equal(h.handCache,null);}
    finally{h.dispose();}
  });
  await test("目标身份不符在拖动前抛特定刷新信号，清缓存而不吞真正宿主异常",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven","sweet")});h.acceptHand(s.hand,"fixture");let drags=0;
    h.phase=()=>({phase:"board",turn:"user"});h.requireUnchangedBoard=async()=>clone(s);h.reset=h.expand=async()=>{};
    h.handCount=async()=>2;h.titleAt=async()=>"甜甜花酿鸡";h.drag=async()=>drags++;
    try{await assert.rejects(h.execute({type:"card",id:"woven",index:0,target:null},s,T.freshMemory()),e=>e.code==="TCG_HAND_REFRESH");
      assert.equal(drags,0);assert.equal(h.handCache,null);
      h.titleAt=async()=>{throw new Error("native OCR failed");};
      await assert.rejects(h.execute({type:"card",id:"woven",index:0,target:null},s,T.freshMemory()),/native OCR failed/);assert.equal(drags,0);}
    finally{h.dispose();}
  });
  await test("通用重同步证明允许额外牌与骰，不需要特殊支援规则",()=>{
    const before=state({hand:hand("woven","hashbrown","sweet")}),after=clone(before);
    before.characters[0].hp=5;after.characters[0].hp=7;after.hand=hand("sweet","woven","lotus");
    const action={type:"card",id:"hashbrown",index:1,target:0};
    assert.equal(T.verify(action,before,after),false);assert.equal(T.verifyResynchronized(action,before,after),true);
    after.characters[0].hp=5;assert.equal(T.verifyResynchronized(action,before,after),false);
    after.characters[0].hp=7;after.hand=clone(before.hand);assert.equal(T.verifyResynchronized(action,before,after),false);
    after.hand=hand("sweet","woven","lotus");after.characters[0].hp=null;assert.equal(T.verifyResynchronized(action,before,after),false);
  });
  await test("张数异常已整手读完时确认复用完整读数，不能再读三遍",async()=>{
    const h=new Host({enemyCount:3}),before=state({hand:hand("hashbrown","woven")}),after=clone(before);
    before.characters[0].hp=5;after.characters[0].hp=7;after.hand=hand("sweet","woven");after.handRead="full";
    h.expectedDice=T.total(before.dice)-1;h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(before);
    let reads=0;h.observe=async()=>{reads++;return clone(after);};
    try{const result=await h.confirm({type:"card",id:"hashbrown",index:0,target:0},before);
      assert.equal(result.confirmed,true);assert.equal(reads,1);assert.equal(h.expectedDice,T.total(after.dice));assert.equal(h.handCache[0].id,"sweet");}
    finally{h.dispose();}
  });
  await test("调和后真实弃牌与元素增长证明动作，重同步可以保留新增牌",()=>{
    const before=state({hand:hand("sweet","woven")}),after=clone(before);
    after.hand=hand("lotus","woven");after.dice.Electro++;after.dice.Cryo=Math.max(0,(after.dice.Cryo||0)-1);
    const action={type:"tune",id:"sweet",index:0,element:"Electro"};
    assert.equal(T.verifyResynchronized(action,before,after),true);
    after.dice.Electro=before.dice.Electro;assert.equal(T.verifyResynchronized(action,before,after),false);
  });
  await test("不确定动作本轮禁止重放、料理保守占位；新轮清除，不伪造技能历史",()=>{
    const m=T.freshMemory(),s=state({hand:hand("woven","woven","sweet")}),a=T.choose(s,m);
    assert.equal(a.id,"woven");T.deferUncertain(m,a);T.deferUncertain(m,a);
    assert.equal(m.uncertainActions.length,1);assert.notEqual(T.choose(s,m).id,"woven");
    T.deferUncertain(m,{type:"skill",who:0,skill:"Q"});assert.equal(m.raidenBurst,false);assert.equal(m.used[0],0);
    T.deferUncertain(m,{type:"card",id:"sweet",target:0});assert.equal(m.food[0],true);
    T.nextRound(m);assert.equal(m.uncertainActions.length,0);assert.equal(m.food[0],false);assert.equal(T.choose(s,m).id,"woven");
  });
  await test("重同步仍需完整有效局面，真实OCR异常不吞或改预算",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("woven","sweet")});h.expectedDice=9;
    h.phase=()=>({phase:"board",turn:"user"});h.reset=async()=>{};h.board=()=>clone(s);
    h.observe=async(_,plan)=>{if(plan.mode==="full")throw new Error("native resync failure");return clone(s);};
    try{await assert.rejects(h.confirm({type:"card",id:"woven",index:0},s),/native resync failure/);assert.equal(h.expectedDice,9);
      const invalid=clone(s);invalid.characters[0].energy=null;assert.throws(()=>h.adoptObservedState(invalid,"test"),/状态无效/);assert.equal(h.expectedDice,9);}
    finally{h.dispose();}
  });
  await test("真实新增牌覆盖历史空手牌证明，不把数量冲突当终止理由",async()=>{
    const h=new Host({enemyCount:3});h.emptyHandProven=true;h.expand=async()=>{};h.phase=()=>({phase:"board",turn:"user"});h.handCountIn=()=>5;
    try{assert.equal(await h.handCount(),5);assert.equal(h.emptyHandProven,false);}
    finally{h.dispose();}
  });
  await test("实际main未确认动作不commit且不重放，仍用稳定状态选择下一动作",async()=>{
    const events=[];let phase="pick",executions=0;const s=state({hand:hand("woven","sweet")});
    class UncertainHost {
      trace(event,data){events.push({event,data});}async waitForCapture(){}async pick(){phase="board";}
      phase(){return phase==="result"?{phase,result:"win",turn:"none"}:{phase,turn:phase==="board"?"user":"none"};}
      async observe(){return clone(s);}
      async execute(action){executions++;if(executions===1)assert.equal(action.id,"woven");else assert.notEqual(action.id,"woven");}
      async confirm(){if(executions===1)return {...clone(s),confirmed:false,resynchronized:true};phase="result";return {phase,result:"win",confirmed:true};}
      snapshot(reason){events.push({event:"stop",reason});}dispose(){}
    }
    const replay={settings:{mode:"自动试验"},TCGBetterGI:{BetterGIHost:UncertainHost},setGameMetrics:()=>{},sleep:async()=>{},
      log:{info:()=>{},warn:()=>{},error:()=>{}},file:{readTextSync:p=>p==="lib/core.js"?fs.readFileSync(path.join(base,p),"utf8"):""}};
    await vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),vm.createContext(replay));
    assert.equal(executions,2);assert.equal(events.filter(e=>e.event==="confirmed").length,1);
    assert.equal(events.filter(e=>e.event==="action-uncertain").length,1);assert.equal(events.some(e=>e.event==="stop"),false);
  });
  await test("实际main读取暂时不稳定保留会话并只观察，真实宿主错误立即上报",async()=>{
    for(const fatal of [false,true]) {
      const events=[];let phase="pick",observations=0,executions=0;
      class ReadRetryHost {
        trace(event,data){events.push({event,data});}async waitForCapture(){}async pick(){phase="board";}
        phase(){return phase==="result"?{phase,result:"win",turn:"none"}:{phase,turn:phase==="board"?"user":"none"};}
        async observe(){if(++observations===1){const e=new Error(fatal?"native host error":"unsettled board");if(!fatal)e.code="TCG_BOARD_RETRY";throw e;}
          return state({hand:hand("woven")});}
        async execute(){executions++;}
        async confirm(){phase="result";return {phase,result:"win",turn:"none",confirmed:true};}
        snapshot(reason){events.push({event:"stop",reason});}dispose(){}
      }
      const replay={settings:{mode:"自动试验"},TCGBetterGI:{BetterGIHost:ReadRetryHost},setGameMetrics:()=>{},sleep:async()=>{},
        log:{info:()=>{},warn:()=>{},error:()=>{}},file:{readTextSync:p=>p==="lib/core.js"?fs.readFileSync(path.join(base,p),"utf8"):""}};
      const run=vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),vm.createContext(replay));
      if(fatal){await assert.rejects(run,/native host error/);assert.equal(observations,1);assert.equal(executions,0);}
      else{await run;assert.equal(observations,2);assert.equal(executions,1);assert.equal(events.filter(e=>e.event==="observation-deferred").length,1);
        assert.equal(events.filter(e=>e.event==="confirmed").length,1);assert.equal(events.some(e=>e.event==="stop"),false);}
    }
  });
  await test("技能已经跨敌方回合后遇到阵亡换人页，确认一次并转交阶段处理",async()=>{
    const h=new Host({enemyCount:3}),s=state();let phases=0,reads=0;
    h.acceptHand(s.hand,"fixture");h.phase=()=>++phases===1?{phase:"board",turn:"enemy"}:{phase:"pick",turn:"none"};
    h.observe=async()=>{reads++;throw new Error("must not read hand on pick page");};
    try{const result=await h.confirm({type:"skill",who:0,skill:"Q"},s);assert.equal(result.confirmed,true);
      assert.equal(result.phase,"pick");assert.equal(reads,0);assert.deepEqual(clone(h.handCache),s.hand);}
    finally{h.dispose();}
  });
  await test("没有行动效果证据的换人页不假记成功，但不因阶段变化停止",async()=>{
    const h=new Host({enemyCount:3}),s=state();h.phase=()=>({phase:"pick",turn:"none"});
    try{const result=await h.confirm({type:"skill",who:0,skill:"Q"},s);assert.equal(result.confirmed,false);assert.equal(result.phase,"pick");}
    finally{h.dispose();}
  });
  await test("料理与快速牌不能仅凭出现阵亡换人页就假记已使用",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("sweet","fast")});let phases=0;
    h.phase=()=>++phases===1?{phase:"board",turn:"enemy"}:{phase:"pick",turn:"none"};
    try{assert.equal((await h.confirm({type:"card",id:"sweet",index:0,target:0},s)).confirmed,false);}
    finally{h.dispose();}
  });
  await test("实际main雷神大招后阵亡，保持战斗历史、强制选柯莱并继续，不重放大招",async()=>{
    const events=[],picks=[],executed=[];let phase="pick";const s=state({hand:[],dice:{Electro:5,Dendro:3}});s.characters[0].energy=2;
    class DefeatHost {
      trace(event,data){events.push({event,data});}async waitForCapture(){}invalidateHand(reason){events.push({event:"invalidate",reason});}
      phase(){return phase==="result"?{phase,result:"win",turn:"none"}:{phase,turn:phase==="board"?"user":"none"};}
      async pick(target,first){picks.push({target,first});s.active=target;phase="board";}
      board(){return clone(s);}async observe(){return clone(s);}
      async execute(action){executed.push(clone(action));}
      async confirm(){if(executed.length===1){s.dice.Electro-=3;s.characters[0].dead=true;s.characters[0].hp=0;s.characters[0].energy=0;s.characters[1].energy=2;
        phase="pick";return {phase,turn:"none",confirmed:true};}phase="result";return {phase,result:"win",confirmed:true};}
      snapshot(reason){events.push({event:"stop",reason});}dispose(){}
    }
    const replay={settings:{mode:"自动试验"},TCGBetterGI:{BetterGIHost:DefeatHost},setGameMetrics:()=>{},sleep:async()=>{},
      log:{info:()=>{},warn:()=>{},error:()=>{}},file:{readTextSync:p=>p==="lib/core.js"?fs.readFileSync(path.join(base,p),"utf8"):""}};
    await vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),vm.createContext(replay));
    assert.deepEqual(picks,[{target:0,first:true},{target:1,first:false}]);assert.deepEqual(executed.map(a=>[a.who,a.skill]),[[0,"Q"],[1,"Q"]]);
    assert.equal(events.some(e=>e.event==="stop"),false);assert.equal(events.filter(e=>e.event==="confirmed").length,2);
  });
  await test("原生22:49雷楔局面：普攻已可支付且Q/E都不可达，不再无收益烧雷楔",()=>{
    const m=T.freshMemory();Object.assign(m,{round:3,raidenBurst:true,colleiBurst:true,dendroRound:2});
    const s=state({active:2,hand:hand("wedge"),dice:{Electro:1,Dendro:1,Cryo:2,Geo:1}});s.characters[2].energy=3;
    const a=T.choose(s,m);assert.equal(a.type,"skill");assert.equal(a.skill,"NA");assert.equal(T.tuningPlan(s,m,{who:2,skill:"Q"}),null);
  });
  await test("烧牌可达性枚举：三雷战技缺口超过可烧手牌数时不发布调和计划",()=>{
    let cases=0;const m=T.freshMemory();
    for(let e=0;e<=3;e++)for(let omni=0;omni<=2;omni++)for(let other=0;other<=5;other++)for(let n=0;n<=4;n++){
      const s=state({dice:{Electro:e,Omni:omni,Pyro:other},hand:hand(...Array(n).fill("sweet"))});
      const plan=T.tuningPlan(s,m,{who:0,skill:"E"});
      assert.equal(!!plan,e+omni<3 && e+omni+other>=3 && 3-e-omni<=n);cases++;
    }assert.equal(cases,360);
  });
  await test("可烧两张但大招还缺三雷时，保留雷楔；另一张可烧至合法普攻",()=>{
    const m=T.freshMemory();Object.assign(m,{raidenBurst:true,colleiBurst:true,dendroRound:0});
    const s=state({active:2,dice:{Pyro:5},hand:hand("sweet","wedge")});s.characters[2].energy=3;
    assert.equal(T.choose(s,m).id,"sweet");s.dice={Electro:1,Pyro:4};s.hand=hand("wedge");
    assert.equal(T.choose(s,m).skill,"NA");
  });
  await test("刻晴已在前台有三雷和雷楔时直接E消耗雷楔并登记附魔，不多走出牌",()=>{
    const m=T.freshMemory();Object.assign(m,{round:3,raidenBurst:true,colleiBurst:true,dendroRound:2});
    const s=state({active:2,dice:{Electro:3},hand:hand("wedge")});s.characters[2].energy=1;
    const a=T.choose(s,m);assert.equal(a.type,"skill");assert.equal(a.skill,"E");T.commit(m,a,s);
    assert.equal(m.keqingInfusedRound,3);
  });
  await test("后台刻晴滿能但只有三雷，可雷楔返场；够切人加Q则不改成雷楔",()=>{
    const m=T.freshMemory();Object.assign(m,{raidenBurst:true,colleiBurst:true,dendroRound:0});
    const s=state({active:1,dice:{Electro:3},hand:hand("wedge")});s.characters[2].energy=3;
    assert.equal(T.choose(s,m).id,"wedge");s.dice={Electro:4,Pyro:1};assert.equal(T.choose(s,m).type,"switch");
  });
  await test("雷神未Q就阵亡：按可支付存活角色技能继续，不要求完成雷神启动",()=>{
    const m=T.freshMemory(),s=state({active:1,dice:{Dendro:3,Electro:1}});
    s.characters[0]={hp:0,dead:true,energy:0,frozen:false};T.noteBoard(m,s);
    assert.equal(T.intent(s,m).who,1);assert.equal(T.choose(s,m).skill,"E");
    assert.equal(m.raidenBurst,false);assert.equal(T.rerollPlan(rollItems(),m).primary,"Dendro");
  });
  await test("刻晴阵亡后雷神可开大则继续Q；两雷角色均阵亡只保留草骰",()=>{
    const m=T.freshMemory(),s=state({active:0,dice:{Electro:3,Dendro:3}});
    s.characters[2]={hp:0,dead:true,energy:0,frozen:false};s.characters[0].energy=2;T.noteBoard(m,s);
    assert.equal(T.choose(s,m).skill,"Q");s.characters[0].dead=true;s.characters[0].hp=0;T.noteBoard(m,s);
    const p=T.rerollPlan(rollItems(),m);assert.equal(p.primary,"Dendro");assert.equal(p.secondary,null);
  });
  await test("强制换人优先未冻结且有可支付技能者；仅剩冻结角色仍能选人后结束轮次",()=>{
    const m=T.freshMemory(),s=state({active:null,dice:{Electro:1,Geo:4}});
    s.characters[2]={hp:0,dead:true,energy:0};s.characters[1].frozen=true;
    assert.equal(T.replacement(s,m).who,0);s.characters[0].dead=true;s.characters[0].hp=0;
    assert.equal(T.replacement(s,m).who,1);s.active=1;assert.equal(T.choose(s,m).type,"end");
  });
  await test("未知存活标志不能当成阵亡，强制选人只重读；已确认死亡不因动画读空丢历史",()=>{
    const m=T.freshMemory(),s=state();s.characters[0]={hp:null,dead:null,energy:null};
    assert.equal(T.replacement(s,m),null);s.characters[0]={hp:0,dead:true};T.noteBoard(m,s);
    s.characters[0]={hp:null,dead:null};T.noteBoard(m,s);assert.equal(m.defeated[0],true);
  });
  await test("阵亡强制换人提示不依赖右下悬浮标签，优先于敌方行动图标",()=>{
    const h=new Host({enemyCount:3});h.ocr=(f,roi)=>roi.join(",")==="138,1020,280,48"?"选择出战角色…":"";
    h.has=(f,asset)=>asset==="enemy_turn";
    try{assert.equal(h.phaseIn({}).phase,"pick");h.ocr=()=>"";assert.equal(h.phaseIn({}).turn,"enemy");}
    finally{h.dispose();}
  });
  await test("原生阵亡页选角色后标签消失/短时unknown：只确认一次同一角色卡再继续",async()=>{
    const h=new Host({enemyCount:3}),oldClick=mock.click,inputs=[],events=[];let n=0;
    mock.click=(x,y)=>inputs.push([x,y]);h.trace=(event,data)=>events.push({event,data});
    h.board=()=>{n++;const p=n===2?"unknown":inputs.length>=2?"board":"pick";
      return state({phase:p,turn:p==="board"?"enemy":"none",active:p==="board"?0:null,
        characters:[{hp:6,dead:false,energy:0,frozen:false,raised:inputs.length>0},{hp:7,dead:false,energy:0,frozen:true,raised:false},{hp:0,dead:true,energy:0,raised:false}]});};
    try{await h.pick(0,false);assert.deepEqual(inputs,[[750,720],[750,720]]);
      assert.equal(events.filter(e=>e.event==="forced-pick-confirm-clicked").length,1);
      assert.equal(events.filter(e=>e.event==="forced-pick-confirmed").length,1);assert.equal(h.forcedPickSession,null);}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("强制换人确认后暂时漏骰仅复读，不能再次点选或确认",async()=>{
    const h=new Host({enemyCount:3}),oldClick=mock.click,inputs=[];let failed=false;
    mock.click=(x,y)=>inputs.push([x,y]);
    h.board=()=>{if(inputs.length===2 && !failed){failed=true;const e=new Error("dice missing");e.code="TCG_DICE_RETRY";throw e;}
      return state({phase:inputs.length>=2?"board":"pick",turn:inputs.length>=2?"user":"none",active:1,
        characters:[{hp:0,dead:true},{hp:8,dead:false,energy:2,frozen:false,raised:inputs.length>0},{hp:10,dead:false,energy:0,frozen:false,raised:false}]});};
    try{await h.pick(1,false);assert.equal(failed,true);assert.deepEqual(inputs,[[960,720],[960,720]]);}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("强制换人未知/阵亡目标拒绝输入，真正宿主OCR异常不吞",async()=>{
    const oldClick=mock.click;let inputs=0;mock.click=()=>inputs++;
    try{for(const c of [{hp:0,dead:true},{hp:null,dead:null}]){const h=new Host({enemyCount:3});h.board=()=>state({phase:"pick",characters:[c,{},{}]});
      try{await assert.rejects(h.pick(0,false),e=>e.code==="TCG_PICK_RETRY");}finally{h.dispose();}}
      const h=new Host({enemyCount:3});h.board=()=>{throw new Error("native OCR failure");};
      try{await assert.rejects(h.pick(0,false),/native OCR failure/);}finally{h.dispose();}assert.equal(inputs,0);}
    finally{mock.click=oldClick;}
  });
  await test("强制换人确认后再次阵亡转交新选人，不重复确认旧死者",async()=>{
    const h=new Host({enemyCount:3}),oldClick=mock.click;let inputs=0;mock.click=()=>inputs++;
    h.board=()=>state({phase:"pick",characters:[{hp:inputs>=2?0:6,dead:inputs>=2,raised:inputs>0},
      {hp:8,dead:false},{hp:0,dead:true}]});
    try{const p=await h.pick(0,false);assert.equal(p.phase,"pick");assert.equal(inputs,2);assert.equal(h.forcedPickSession,null);}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("强制确认后一直未知有界保护但从不重复输入",async()=>{
    const h=new Host({enemyCount:3}),oldClick=mock.click;let inputs=0;mock.click=()=>inputs++;
    h.board=()=>state({phase:inputs>=2?"unknown":"pick",turn:"none",characters:[{hp:6,dead:false,raised:inputs>0},{hp:8,dead:false},{hp:0,dead:true}]});
    try{await assert.rejects(h.pick(0,false),/长时间.*完整出战/);assert.equal(inputs,2);assert.equal(h.forcedPickSession.confirmed,true);}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("实际main+生产confirm/pickForced联合回放：Q后阵亡保留记忆，双击同卡后接存活者Q",async()=>{
    const events=[],inputs=[],executed=[];let phase="pick",stage=0,selected=false,selectionReads=0;
    const s=state({dice:{Electro:3,Dendro:3}});s.characters[0].energy=2;
    const replay={...mock,settings:{mode:"自动试验"},setGameMetrics:()=>{},
      log:{info:()=>{},warn:()=>{},error:()=>{}},
      click:(x,y)=>{assert.equal(stage,1);assert.deepEqual([x,y],[960,720]);inputs.push([x,y]);
        if(inputs.length===1)selected=true;else{phase="board";s.active=1;}},
      sleep:async()=>{if(phase==="board" && stage===0 && executed.length===1){phase="pick";stage=1;
        s.characters[0]={hp:0,dead:true,energy:0,frozen:false};s.characters[1].energy=2;s.active=null;}
      },file:{...mock.file,readTextSync:()=>""}};
    const ctx=vm.createContext(replay);vm.runInContext(fs.readFileSync(path.join(base,"lib/core.js"),"utf8"),ctx);
    vm.runInContext(fs.readFileSync(path.join(base,"lib/bgi.js"),"utf8"),ctx);
    const P=ctx.TCGBetterGI.BetterGIHost.prototype,originalPick=P.pick;
    P.trace=function(event,data){events.push({event,data:clone(data)});};P.snapshot=function(reason){events.push({event:"stop",reason});};
    P.waitForCapture=async()=>{};
    P.phase=()=>phase==="result"?{phase,result:"win",turn:"none"}:{phase,turn:phase==="board"?(stage===0&&executed.length===1?"enemy":"user"):"none"};
    P.board=()=>{const b=clone(s);Object.assign(b,P.phase());b.characters.forEach((c,i)=>c.raised=phase!=="pick"&&i===s.active);
      b.pickSelection=phase==="pick"&&selected?{who:1,banner:"请选择一位角色出战"}:null;
      if(selected&&inputs.length===1&&selectionReads++===0)b.phase="unknown";return b;};
    P.observe=async()=>P.board();
    P.pick=async function(target,first){if(first){assert.equal(target,0);phase="board";return P.board();}return originalPick.call(this,target,false);};
    P.execute=async function(action){executed.push(clone(action));if(executed.length===1)s.dice.Electro=0;else phase="result";};
    await vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),ctx);
    assert.deepEqual(executed.map(a=>[a.who,a.skill]),[[0,"Q"],[1,"Q"]]);assert.deepEqual(inputs,[[960,720],[960,720]]);
    assert.equal(events.filter(e=>e.event==="forced-pick-confirm-clicked").length,1);
    assert.equal(events.filter(e=>e.event==="forced-pick-confirmed").length,1);
    assert.equal(events.filter(e=>e.event==="confirmed").length,2);
    assert.equal(events.find(e=>e.event==="state"&&e.data.state.active===1).data.memory.raidenBurst,true);
    assert.equal(events.some(e=>e.event==="stop"),false);
  });
  await test("缺牌不依赖参考构筑：空手/只有未知规则牌，仍按实际骰子完成启动与残局",()=>{
    for(const hh of [[],[T.observedCard("提米",0)],hand("lotus"),hand("sweet","smoked")]) {
      const m=T.freshMemory(),s=state({hand:clone(hh)});
      for(const [energy,expected] of [[0,"NA"],[1,"E"],[2,"Q"]]){
        s.characters[0].energy=energy;let a=T.choose(s,m);
        if(a.type==="card")assert.equal(a.id,"smoked");
        if(a.type==="card"){T.commit(m,a,s);s.hand.splice(a.index,1);s.hand.forEach((h,i)=>h.index=i);a=T.choose(s,m);}
        assert.equal(a.type,"skill");assert.equal(a.skill,expected);T.commit(m,a,s);
      }
      s.characters[0]={hp:0,energy:0,dead:true,frozen:false};s.active=1;s.dice={Dendro:3};s.characters[1].energy=2;
      assert.equal(T.choose(s,m).skill,"Q");
      s.characters[1]={hp:0,energy:0,dead:true,frozen:false};s.active=2;s.dice={Electro:4};s.characters[2].energy=3;
      assert.equal(T.choose(s,m).skill,"Q");
      s.dice={Geo:2};assert.equal(T.choose(s,m).type,"end");
    }
  });
  await test("参考牌缺失组合512组：从不发布不存在的牌、不可支付技能或无法补齐的调和",()=>{
    const ids=["woven","voltage","shift","companion","draw","stars","calx","sweet","wedge"];
    for(let mask=0;mask<512;mask++){
      const s=state({active:2,dice:{Electro:1,Pyro:3},hand:hand(...ids.filter((_,i)=>mask&(1<<i)))}),m=T.freshMemory();
      Object.assign(m,{raidenBurst:true,colleiBurst:true,dendroRound:0});s.characters[2].energy=3;
      const a=T.choose(s,m);assert.notEqual(a.type,"stop");
      if(a.type==="card"||a.type==="tune")assert.equal(s.hand[a.index].id,a.id);
      if(a.type==="skill")assert.equal(T.skillLegal(s,a,m),true);
      if(a.type==="tune")assert.ok(T.tuningPlan(s,m,T.intent(s,m))||T.tuningPlan(s,m,{who:2,skill:"E"})||T.tuningPlan(s,m,{who:2,skill:"NA"}));
    }
  });
  await test("关键配合牌不是硬锁：缺其他烧牌时也可用共鸣/失效天赋补齐可达大招",()=>{
    const m=T.freshMemory(),s=state({dice:{Electro:2,Pyro:1},hand:hand("voltage")});s.characters[0].energy=2;
    const a=T.choose(s,m);assert.equal(a.type,"tune");assert.equal(a.id,"voltage");
    s.characters[1]={hp:0,dead:true,energy:0,frozen:false};s.hand=hand("talent");assert.equal(T.choose(s,m).id,"talent");
    s.dice={Electro:3};assert.equal(T.choose(s,m).skill,"Q");
  });
  await test("原生00:14阵亡布局：全员卡面未抬高，真实board的目标标题/横幅两帧允许同卡确认",async()=>{
    const h=new Host({enemyCount:3}),oldClick=mock.click,inputs=[],events=[];
    mock.click=(x,y)=>inputs.push([x,y]);h.trace=(event,data)=>events.push({event,data});
    h.phaseIn=()=>({phase:inputs.length>=2?"board":"pick",turn:inputs.length>=2?"user":"none"});
    h.characterIn=(f,i)=>({hp:i===2?0:7,dead:i===2,energy:0,frozen:false,raised:inputs.length>=2&&i===1});
    h.diceIn=()=>({dice:{Dendro:3,Electro:4,Pyro:1}});h.enemiesIn=()=>[{hp:1,dead:false,active:true}];
    h.ocr=(f,roi)=>!inputs.length?"":roi[0]===311?"柯莱":roi[0]===700?"请选择一位角色出战":"";
    try{const b=await h.pick(1,false);assert.equal(b.active,1);assert.deepEqual(inputs,[[960,720],[960,720]]);
      assert.equal(events.find(e=>e.event==="forced-pick-confirm-clicked").data.proof,"exact-target-title-and-pick-banner");}
    finally{mock.click=oldClick;h.dispose();}
  });
  await test("强制选中证据必须同时是实际目标标题和专属横幅，普通详情或错人不能确认",async()=>{
    const oldClick=mock.click;
    try{for(const [who,banner] of [[0,"请选择一位角色出战"],[1,"将所选角色切换为出战角色"],[-1,"请选择一位角色出战"]]){
      const h=new Host({enemyCount:3});let inputs=0;mock.click=()=>inputs++;
      h.board=()=>state({phase:"pick",active:null,pickSelection:{who,banner},characters:[{hp:6,dead:false,raised:false},{hp:7,dead:false,raised:false},{hp:0,dead:true}]});
      try{await assert.rejects(h.pick(1,false),/长时间/);assert.equal(inputs,1);}finally{h.dispose();}
    }}finally{mock.click=oldClick;}
  });
  await test("缺草骰且无手牌不空切柯莱，仍可用当前雷神技能；减费/伙伴能解锁时不提前烧掉",()=>{
    const m=T.freshMemory();m.raidenBurst=true;
    const s=state({dice:{Electro:4},hand:[]});s.characters[1].energy=2;
    const a=T.choose(s,m);assert.equal(a.type,"skill");assert.equal(a.who,0);assert.equal(a.skill,"E");
    s.dice={Dendro:3};s.hand=hand("shift","fast");assert.equal(T.choose(s,m).type,"card");assert.equal(T.choose(s,m).id,"shift");
    s.dice={Dendro:1,Pyro:3};s.hand=hand("companion");assert.equal(T.choose(s,m).id,"companion");
  });
  await test("只剩柯莱时保留全部可用草骰，不套开局三草上限",()=>{
    const m=T.freshMemory();m.defeated=[true,false,true];
    assert.equal(T.rerollPlan(rollItems(Array(8).fill("Dendro")),m).indices.length,8);
  });
  await test("刻晴阶段不是固定终点：后台雷神满能或刻晴冻结/低血时可回切，并计入后续技能",()=>{
    const m=T.freshMemory();Object.assign(m,{round:3,raidenBurst:true,colleiBurst:true,dendroRound:3});
    const s=state({active:2,dice:{Electro:5}});s.characters[0].energy=2;s.characters[2].energy=1;
    assert.equal(T.choose(s,m).type,"switch");assert.equal(T.choose(s,m).target,0);
    s.characters[0].energy=0;s.characters[2].frozen=true;assert.equal(T.choose(s,m).target,0);
    s.characters[2].frozen=false;s.characters[2].hp=2;assert.equal(T.choose(s,m).target,0);
    s.dice={Electro:3};s.hand=[];assert.notEqual(T.choose(s,m).type,"switch");
    s.characters[2].hp=10;s.characters[2].energy=3;s.dice={Electro:4};assert.equal(T.choose(s,m).skill,"Q");
  });
  await test("已确认干净牌桌连续调和：生产execute/confirm每张一展开、一归位，无前置空白点击和整手扫描",async()=>{
    const h=new Host({enemyCount:3}),u=T.observedCard("提米",0),before=state({hand:[u,...hand("sweet","draw").map((c,i)=>({...c,index:i+1}))],dice:{Pyro:3}});
    let world=clone(before),resets=0,expands=0,titles=0,scans=0;
    h.boardReady=true;h.phase=()=>({phase:"board",turn:"user"});h.board=()=>clone(world);
    h.reset=async()=>{resets++;h.boardReady=true;h.handFanReady=false;};
    h.expand=async()=>{expands++;h.boardReady=false;h.handFanReady=true;};
    h.titleAt=async()=>{titles++;return u.name;};h.handCountIn=()=>null;h.requireNoWarning=async()=>{};
    h.readHand=async()=>{scans++;throw new Error("redundant scan");};
    h.drag=async()=>{world.dice={Pyro:2,Electro:1};};h.clickButton=async()=>{};
    const a={type:"tune",id:u.id,index:0,element:"Electro"};
    try{await h.execute(a,before,T.freshMemory());const after=await h.confirm(a,before);
      assert.equal(after.confirmed,true);assert.equal(expands,1);assert.equal(resets,1);assert.equal(titles,1);assert.equal(scans,0);assert.equal(h.boardReady,true);}
    finally{h.dispose();}
  });
  for(const def of T.cards)await test("调和功能隔离："+def.name+"只转一骰，不执行原牌效果或触发整手重读",async()=>{
    const h=new Host({enemyCount:3}),m=T.freshMemory(),before=state({hand:hand(def.id,"sweet","draw","shift"),dice:{Electro:1,Pyro:3}});
    let world=clone(before),scans=0,titles=0,expands=0,resets=0;const events=[];
    T.noteBoard(m,before);const originalMemory=clone(m);
    h.boardReady=true;h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});h.board=()=>clone(world);
    h.reset=async()=>{resets++;h.boardReady=true;h.handFanReady=false;};
    h.expand=async()=>{expands++;h.boardReady=false;h.handFanReady=true;};
    h.titleAt=async()=>{titles++;return def.name;};h.handCountIn=()=>null;h.requireNoWarning=async()=>{};
    h.readHand=async()=>{scans++;throw new Error("burning a card must not force a full scan");};h.clickButton=async()=>{};
    h.trace=(event,data)=>events.push({event,data});h.acceptHand(before.hand,"fixture");
    h.drag=async()=>{world.hand=T.indexedHand(world.hand.slice(1));world.dice.Pyro--;world.dice.Electro++;};
    const action={type:"tune",id:def.id,index:0,element:"Electro"};
    try{await h.execute(action,before,m);assert.equal(h.expectedDice,4);assert.equal(h.zeroDiceAllowed,false);
      const after=await h.confirm(action,before,m);assert.equal(after.confirmed,true);assert.equal(!!after.resynchronized,false);
      assert.equal(T.verify(action,before,after),true);T.commit(m,action,before,after);
      assert.deepEqual(clone(m),originalMemory);assert.deepEqual(clone(after.characters),before.characters);
      assert.deepEqual(clone(after.enemies),before.enemies);assert.equal(after.active,before.active);
      assert.equal(scans,0);assert.equal(titles,1);assert.equal(expands,1);assert.equal(resets,1);
      assert.equal(events.some(e=>e.event==="state-resync"),false);assert.equal(h.handCache.length,3);}
    finally{h.dispose();}
  });
  for(const id of ["woven","lost","companion"])await test("实际出牌预算仍保留原效果："+T.byId[id].name,async()=>{
    const h=new Host({enemyCount:3}),m=T.freshMemory(),before=state({hand:hand(id,"sweet","draw","shift"),dice:{Electro:1,Pyro:3}});
    m.round=2;m.defeatRound=2;let world=clone(before),scans=0;
    h.boardReady=true;h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});h.board=()=>clone(world);
    h.reset=async()=>{h.boardReady=true;h.handFanReady=false;};h.expand=async()=>{h.handFanReady=true;};
    h.titleAt=async()=>T.byId[id].name;h.handCountIn=()=>null;h.requireNoWarning=async()=>{};
    h.readHand=async()=>{scans++;throw new Error("resource effect already proves selected-card consumption");};
    h.drag=async()=>{};h.cardConfirm=async()=>{
      world.hand=T.indexedHand(world.hand.slice(1));
      if(id==="woven")world.dice.Electro++;
      if(id==="lost"){world.dice.Omni=1;world.characters[0].energy=1;}
      if(id==="companion")world.dice={...T.payment(before.dice,T.byId[id].cost,"Electro").remaining,Omni:2};
    };
    const action={type:"card",id,index:0,target:null};
    try{await h.execute(action,before,m);assert.equal(h.expectedDice,id==="companion"?4:5);
      const after=await h.confirm(action,before,m);assert.equal(after.confirmed,true);assert.equal(!!after.resynchronized,false);
      assert.equal(T.total(after.dice),h.expectedDice);assert.equal(scans,0);}
    finally{h.dispose();}
  });
  await test("赌徒返骰预算要求真实击倒、当前装备者及剩余次数，不按任意偶数增骰放行",()=>{
    const h=new Host({enemyCount:3}),s=state({active:2,dice:{Electro:4}});
    h.expectedDice=2;h.gamblerMayAddDice=true;h.gamblerBudget={owner:2,remaining:1,enemies:3};
    try{assert.throws(()=>h.requireDiceBudget(s),/预算不符/);
      s.enemies[0]={hp:0,dead:true};h.requireDiceBudget(s);
      s.dice.Electro=6;s.enemies[1]={hp:0,dead:true};assert.throws(()=>h.requireDiceBudget(s),/预算不符/);
      h.gamblerBudget.remaining=2;h.requireDiceBudget(s);
      s.active=0;assert.throws(()=>h.requireDiceBudget(s),/预算不符/);
      s.active=2;s.enemies[2].hp=null;assert.throws(()=>h.requireDiceBudget(s),/预算不符/);
      h.adoptObservedState(state(),"fixture");assert.equal(h.gamblerMayAddDice,false);assert.equal(h.gamblerBudget,null);}
    finally{h.dispose();}
  });
  await test("雷楔返场预算跟随刻晴赌徒，不沿用此前出战雷神的圣遗物",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("wedge","sweet"),dice:{Electro:5}}),m=T.freshMemory();
    m.artifactKinds[0]="exile";m.artifactKinds[2]="gambler";m.artifacts[2]=true;m.gamblerUsed[2]=2;
    h.boardReady=true;h.phase=()=>({phase:"board",turn:"user"});h.board=()=>clone(s);h.reset=async()=>{};
    h.expand=async()=>{h.handFanReady=true;};h.handCountIn=()=>null;h.titleAt=async()=>T.byId.wedge.name;
    h.drag=async()=>{};h.cardConfirm=async()=>{};
    try{await h.execute({type:"card",id:"wedge",index:0,target:2},s,m);
      assert.equal(h.gamblerMayAddDice,true);assert.deepEqual(clone(h.gamblerBudget),{owner:2,remaining:1,enemies:3});
      m.artifactKinds[2]="exile";await h.execute({type:"card",id:"wedge",index:0,target:2},s,m);
      assert.equal(h.gamblerMayAddDice,false);assert.equal(h.gamblerBudget,null);}
    finally{h.dispose();}
  });
  await test("已确认调和独立效果和手牌后，资源重同步不二次整手读取且不重放",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("lost","sweet","draw","shift"),dice:{Electro:1,Pyro:3}}),a=clone(s);
    a.hand=hand("sweet","draw","shift");a.dice={Electro:2,Pyro:2};let scans=0;
    h.expectedDice=5;h.phase=()=>({phase:"board",turn:"user"});h.board=()=>clone(a);h.reset=async()=>{};
    h.observe=async(_,plan)=>{if(plan.mode==="full"){scans++;assert.equal(plan.expectedCount,3);}return clone(a);};
    try{const r=await h.confirm({type:"tune",id:"lost",index:0,element:"Electro"},s);
      assert.equal(r.confirmed,true);assert.equal(r.resynchronized,true);assert.equal(scans,0);assert.equal(h.expectedDice,4);}
    finally{h.dispose();}
  });
  await test("完整牌框几何拒绝缺边、额外牌、五张子集与歧义，容许内部装饰重复命中",()=>{
    const count=mock.TCGBetterGI.handLayoutCount,xs=mock.TCGBetterGI.handX;
    for(let n=1;n<=4;n++) {
      const edges=xs[n].map(x=>x+95);
      assert.equal(count(edges),n);assert.equal(count([...edges,...edges.map(x=>x-30)]),n);
      assert.equal(count([...edges,1800]),null);assert.equal(count(edges.slice(1)),null);
    }
    assert.equal(count(xs[5].map(x=>x+95)),null);assert.equal(count([]),null);
  });
  // Model the actual expand control as a toggle, not the old no-op stub.
  // Blanks may collapse the fan, but the new path must never click one.
  function handToggleFixture(ids, blankCloses = true) {
    const h=new Host({enemyCount:3}),ui={fan:false,title:"",clicks:[],togglesClosed:0};
    h.boardReady=true;h.phase=h.phaseIn=()=>({phase:"board",turn:"user"});
    const nativeCount=h.handCountIn.bind(h);
    h.handCountIn=f=>ids.length>=5?ids.length:nativeCount(f);
    h.ocr=(_,roi)=>roi[0]===1730?"":ui.title;
    h.matches=(_,asset)=>asset==="hand_rim"&&ui.fan&&ids.length>0?
      mock.TCGBetterGI.handX[ids.length].map(x=>({x:x+95,y:930,w:6,h:90})):[];
    const clickAt=h.clickAt.bind(h);
    h.clickAt=(x,y)=>{
      ui.clicks.push([x,y]);clickAt(x,y);
      if(x===1190&&y===545){ui.fan=false;ui.title="";return;}
      if(x===967&&y===1041){if(ui.fan)ui.togglesClosed++;ui.fan=!ui.fan;ui.title="";return;}
      if(y===945||y===920){
        const xs=mock.TCGBetterGI.handX[ids.length]||[],i=ui.fan?xs.findIndex(cx=>Math.abs(cx-x)<90):-1;
        ui.title=i<0?"":T.byId[ids[i]]?.name||ids[i];
        if(i<0&&blankCloses)ui.fan=false;
      }
    };
    return {h,ui,count:(x,y)=>ui.clicks.filter(p=>p[0]===x&&p[1]===y).length};
  }
  await test("已展开牌扇的生产expand幂等，不把第二次展开变成折叠",async()=>{
    const f=handToggleFixture(["sweet","draw"]);
    try{await f.h.expand();await f.h.expand();assert.equal(f.count(967,1041),1);assert.equal(f.count(1190,545),0);
      assert.equal(f.ui.fan,true);assert.equal(f.ui.togglesClosed,0);}
    finally{f.h.dispose();}
  });
  await test("连续检视卡名保留牌扇，标题空白才进入有界归位而不盲切toggle",async()=>{
    const f=handToggleFixture(["sweet","draw"]);
    try{await f.h.expand();assert.equal(await f.h.titleAt(1019,945,false,false,"card",null,true),"甜甜花酿鸡");
      assert.equal(f.h.handFanReady,true);await f.h.expand();assert.equal(f.count(967,1041),1);
      assert.equal(await f.h.titleAt(1222,945,false,false,"card",null,true),"运筹帷幄");assert.equal(f.ui.togglesClosed,0);}
    finally{f.h.dispose();}
  });
  await test("08:21雷楔生成复现：实际2张一次展开顺序读牌，无空位输入",async()=>{
    for(const closes of [true,false]){
      const f=handToggleFixture(["wedge","draw"],closes),before=state({hand:hand("draw")});
      try{const plan=T.handPlan({type:"skill",who:2,skill:"E"},before),hs=await f.h.observedHand(plan);
        assert.deepEqual(clone(hs).map(c=>c.id),["wedge","draw"]);
        assert.equal(f.count(967,1041),1);assert.equal(f.count(1190,545),1);assert.equal(f.count(1019,945),1);assert.equal(f.count(812,945),0);
        assert.equal(f.count(914,945),0);assert.equal(f.ui.togglesClosed,0);assert.equal(f.h.handScanSerial,1);}
      finally{f.h.dispose();}
    }
  });
  await test("1至5张均一次展开一次归位；历史张数错误也只点真实卡位",async()=>{
    for(const ids of [["sweet"],["sweet","draw"],["sweet","draw","wedge"],["sweet","draw","wedge","woven"],
        ["sweet","draw","wedge","woven","lotus"]])for(const closes of [true,false]){
      const f=handToggleFixture(ids,closes);
      try{const hs=await f.h.readHand(ids.length===3?2:ids.length);
        assert.deepEqual(clone(hs).map(c=>c.id),ids);assert.equal(f.ui.togglesClosed,0);
        assert.equal(f.h.handScanSerial,1);assert.equal(f.count(967,1041),1);assert.equal(f.count(1190,545),1);
        assert.equal(f.ui.clicks.filter(p=>p[1]===920).length,0);
        assert.deepEqual(f.ui.clicks.filter(p=>p[1]===945).map(p=>p[0]),clone(mock.TCGBetterGI.handX[ids.length]));}
      finally{f.h.dispose();}
    }
  });
  await test("增量计数不符的同次真实计数交给完整读取，不二次展开计数",async()=>{
    const f=handToggleFixture(["sweet","draw","wedge"]),before=state({hand:hand("lotus","sweet","draw")});
    let counts=0;const count=f.h.handCount.bind(f.h);f.h.handCount=async(...args)=>{counts++;return await count(...args);};
    try{const hs=await f.h.observedHand(T.handPlan({type:"card",id:"lotus",index:0},before));
      assert.deepEqual(clone(hs).map(c=>c.id),["sweet","draw","wedge"]);assert.equal(counts,1);
      assert.equal(f.count(914,945),1);assert.equal(f.ui.togglesClosed,0);}
    finally{f.h.dispose();}
  });
  await test("常规新增牌的数量仅作候选：刻晴E生成或消耗、运筹与新回合上限",()=>{
    assert.equal(T.handPlan({type:"skill",who:2,skill:"E"},state({hand:hand("sweet")})).expectedCount,2);
    assert.equal(T.handPlan({type:"skill",who:2,skill:"E"},state({hand:hand("sweet","wedge")})).expectedCount,1);
    assert.equal(T.handPlan({type:"card",id:"draw",index:0},state({hand:hand("draw","sweet")})).expectedCount,3);
    assert.equal(T.handPlan({type:"skill",who:2,skill:"E"},state({hand:Array.from({length:10},()=>hand("sweet")[0])})).expectedCount,10);
  });
  await test("新回合+2数量候选传到实际readHand，仍真实核实且不沿用旧牌序",async()=>{
    const f=handToggleFixture(["wedge","draw","sweet"]),m=T.freshMemory();
    let rolls=0,phaseReads=0;f.h.acceptHand(hand("draw"),"fixture");
    f.h.phase=()=>++phaseReads<=3?{phase:"roll",turn:"none"}:{phase:"board",turn:"user"};
    f.h.readRollDice=async()=>{rolls++;return {items:rollItems()};};f.h.clickButton=async()=>{};
    try{await f.h.roll(m);assert.equal(m.round,1);assert.equal(f.h.handCountHint,3);assert.equal(f.h.handCache,null);
      f.h.phase=f.h.phaseIn=()=>({phase:"board",turn:"user"});const hs=await f.h.observedHand();
      assert.deepEqual(clone(hs).map(c=>c.id),["wedge","draw","sweet"]);assert.equal(f.h.handCountHint,null);
      assert.equal(f.count(812,945),0);assert.equal(f.count(914,945),1);assert.equal(f.ui.togglesClosed,0);assert.ok(rolls>0);}
    finally{f.h.dispose();}
  });
  await test("运筹净增1整手读取允许前后插入，雷楔消耗整手读取保留顺序证据",async()=>{
    for(const [ids,action,beforeIds] of [
      [["wedge","sweet","woven"],{type:"card",id:"draw",index:0},["draw","sweet"]],
      [["sweet"],{type:"skill",who:2,skill:"E"},["wedge","sweet"]]]){
      const f=handToggleFixture(ids);try{
        const hs=await f.h.observedHand(T.handPlan(action,state({hand:hand(...beforeIds)})));
        assert.deepEqual(clone(hs).map(c=>c.id),ids);assert.equal(f.ui.togglesClosed,0);
        assert.equal(f.count(mock.TCGBetterGI.handX[ids.length][0],945),1);}
      finally{f.h.dispose();}
    }
  });
  await test("低张数检视被敌方回合打断，丢弃半次证据后重新同步，不复用陈旧首牌",async()=>{
    const f=handToggleFixture(["wedge","draw"]);let interrupted=false;
    f.h.phaseIn=()=>f.ui.title==="雷楔"&&!interrupted?(interrupted=true,{phase:"board",turn:"enemy"}):{phase:"board",turn:"user"};
    try{await assert.rejects(f.h.readHand(2),e=>e.code==="TCG_OBSERVATION_INTERRUPTED");
      assert.equal(f.h.handFanReady,false);
      f.h.phaseIn=()=>({phase:"board",turn:"user"});const hs=await f.h.readHand(2);
      assert.deepEqual(clone(hs).map(c=>c.id),["wedge","draw"]);assert.equal(f.count(1019,945),2);
      assert.equal(f.ui.togglesClosed,0);}
    finally{f.h.dispose();}
  });
  await test("生产confirm生成雷楔只一次展开一次归位，仍核实技能资源",async()=>{
    const f=handToggleFixture(["wedge","draw"]),before=state({active:2,hand:hand("draw"),dice:{Electro:4}}),after=clone(before);
    after.hand=null;after.dice.Electro=1;after.characters[2].energy=1;
    f.h.boardReady=false;f.h.board=()=>clone(after);f.h.expectedDice=1;f.h.acceptHand(before.hand,"fixture");
    try{const actual=await f.h.confirm({type:"skill",who:2,skill:"E"},before);
      assert.equal(actual.confirmed,true);assert.equal(f.count(967,1041),1);assert.equal(f.count(1190,545),1);
      assert.equal(f.count(1019,945),1);assert.equal(f.ui.togglesClosed,0);assert.equal(f.h.boardReady,true);}
    finally{f.h.dispose();}
  });
  await test("未知0张和读不到标题不虚构手牌；同数量替换必须从实际标题重新建序",async()=>{
    const empty=handToggleFixture([]),f=handToggleFixture(["sweet","woven"]);
    try{await assert.rejects(empty.h.readHand(2),e=>e.code==="TCG_HAND_RETRY");assert.equal(empty.ui.togglesClosed,0);
      f.h.acceptHand(hand("draw","wedge"),"fixture");const hs=await f.h.observedHand({mode:"full",expectedCount:2});
      assert.deepEqual(clone(hs).map(c=>c.id),["sweet","woven"]);assert.equal(f.h.handCache,null);assert.equal(f.ui.togglesClosed,0);}
    finally{empty.h.dispose();f.h.dispose();}
  });
  await test("08:42大招后前置复核跨敌方/转场/选择页，仅撤销未输入动作，不作为致命停止",async()=>{
    for(const p of [{phase:"board",turn:"enemy"},{phase:"transition",turn:"none"},{phase:"choice",turn:"none"},{phase:"unknown",turn:"none"}]){
      const h=new Host({enemyCount:3}),before=state({hand:hand("sweet"),dice:{Pyro:3}});let reads=0,inputs=0;
      h.phase=()=>({phase:"board",turn:"user"});h.boardReady=true;h.board=()=>++reads===1?clone(before):{...clone(before),...p};
      h.drag=async()=>inputs++;h.clickAt=()=>inputs++;
      try{await assert.rejects(h.execute({type:"tune",id:"sweet",index:0,element:"Electro"},before,T.freshMemory()),
        e=>["TCG_OBSERVATION_INTERRUPTED","TCG_STATE_REFRESH"].includes(e.code));assert.equal(inputs,0);}
      finally{h.dispose();}
    }
  });
  await test("执行入口已经不是我方回合也走可恢复信号，不点空白、不执行旧决策",async()=>{
    const h=new Host({enemyCount:3});let clicks=0;h.phase=()=>({phase:"board",turn:"enemy"});h.clickAt=()=>clicks++;
    try{await assert.rejects(h.execute({type:"skill",who:0,skill:"E"},state(),T.freshMemory()),e=>e.code==="TCG_OBSERVATION_INTERRUPTED");
      assert.equal(clicks,0);}
    finally{h.dispose();}
  });
  await test("雷草祝佑母牌与两种衍生牌精确识别，费用符合当前规则，不扩展原30张参考表",()=>{
    assert.equal(T.identify("元素幻变：雷草祝佑")?.id,"thundergrass");
    assert.equal(T.identify("雷草祝佑·碎霆")?.id,"shatterbolt");assert.equal(T.identify("雷草祝佑·锐核")?.id,"sharpkernel");
    assert.deepEqual(clone(T.byId.shatterbolt.cost),{element:"Electro",n:1});
    assert.deepEqual(clone(T.byId.sharpkernel.cost),{element:"Dendro",n:2});
    assert.equal(T.cards.reduce((n,c)=>n+c.copies,0),30);
  });
  function choiceFixture(swapped=false) {
    const h=new Host({enemyCount:3});let selected=false,confirmed=false;const inputs=[];
    const rows=[{text:"雷草祝佑·碎霆",x:585,y:729,width:171,height:27},{text:"雷草祝佑·锐核",x:1165,y:729,width:171,height:27}];
    if(swapped)[rows[0].text,rows[1].text]=[rows[1].text,rows[0].text];
    h.ocr=(_,roi)=>roi.join(",")==="700,155,520,130"?"挑选卡牌\n请选择一张卡牌":
      roi.join(",")==="45,115,360,50"&&selected?"雷草祝佑·碎霆":"";
    h.frame=fn=>fn({FindMulti:()=>({count:rows.length,...rows})});
    h.clickAt=(x,y)=>{inputs.push([x,y]);if(y<600)selected=true;else confirmed=true;};
    return {h,rows,inputs,selected:()=>selected,confirmed:()=>confirmed};
  }
  await test("提供的挑选页标题和精确牌名框才识别choice，普通手牌详情/缺失牌名不盲选",()=>{
    const f=choiceFixture();try{
      const p=f.h.choiceIn({FindMulti:()=>({count:2,...f.rows})});assert.equal(p.phase,"choice");assert.equal(p.recognized,true);
      assert.deepEqual(clone(p.options).map(c=>c.point),[[671,543],[1251,543]]);
      f.rows[1].text="雷草祝佑·碎霆";assert.equal(f.h.choiceIn({FindMulti:()=>({count:2,...f.rows})}).recognized,false);
      f.h.ocr=()=>"雷草祝佑·碎霆";assert.equal(f.h.choiceIn({}),null);assert.equal(f.inputs.length,0);}
    finally{f.h.dispose();}
  });
  await test("选择按牌名而不是固定左右，直接返回页仅点一次；不把生成牌当已经装备支援",async()=>{
    for(const swapped of [false,true]){
      const f=choiceFixture(swapped),m=T.freshMemory(),before=state({hand:hand("sweet")});
      f.h.phase=()=>f.selected()?{phase:"board",turn:"enemy"}:f.h.choiceIn({FindMulti:()=>({count:2,...f.rows})});
      f.h.acceptHand(before.hand,"fixture");
      try{const p=await f.h.resolveChoice(before,m);assert.equal(p.turn,"enemy");assert.equal(f.inputs.length,1);
        assert.equal(f.inputs[0][0],swapped?1251:671);assert.equal(f.h.handCache,null);assert.equal(f.h.handCountHint,2);
        assert.equal(f.h.pendingChoiceCard.id,"shatterbolt");assert.equal(m.thundergrassSupport,null);}
      finally{f.h.dispose();}
    }
  });
  await test("挑选后显式确认需连续正确标题和唯一按钮，只选一次/确认一次",async()=>{
    const f=choiceFixture();f.h.phase=()=>f.confirmed()?{phase:"board",turn:"user"}:
      f.h.choiceIn({FindMulti:()=>({count:2,...f.rows})});f.h.matches=()=>[{x:940,y:900,w:40,h:40}];
    try{assert.equal((await f.h.resolveChoice(state({hand:hand("sweet")}))).turn,"user");
      assert.deepEqual(f.inputs,[[671,543],[960,920]]);assert.equal(f.h.choiceSession,null);}
    finally{f.h.dispose();}
  });
  await test("选牌确认不能用普通手牌详情ROI或错误衍生牌标题放行",async()=>{
    for(const bad of ["","雷草祝佑·锐核"]){
      const f=choiceFixture(),ocr=f.h.ocr;f.h.ocr=(frame,roi)=>roi.join(",")==="45,115,360,50"?bad:ocr(frame,roi);
      f.h.phase=()=>f.h.choiceIn({FindMulti:()=>({count:2,...f.rows})});f.h.matches=()=>[{x:943,y:932,w:64,h:31}];
      try{await assert.rejects(f.h.resolveChoice(state()),e=>e.code==="TCG_CHOICE_RETRY");assert.equal(f.inputs.length,1);
        assert.equal(f.confirmed(),false);}
      finally{f.h.dispose();}
    }
  });
  await test("选择未生效/没有确认按钮/候选重名有界恢复不重复点击，不推断游戏已退出选择页",async()=>{
    const f=choiceFixture();f.h.phase=()=>f.h.choiceIn({FindMulti:()=>({count:2,...f.rows})});f.h.matches=()=>[];
    try{await assert.rejects(f.h.resolveChoice(state()),e=>e.code==="TCG_CHOICE_RETRY");assert.equal(f.inputs.length,1);
      await assert.rejects(f.h.resolveChoice(state()),e=>e.code==="TCG_CHOICE_RETRY");assert.equal(f.inputs.length,1);
      const g=choiceFixture();g.rows[1].text=g.rows[0].text;g.h.phase=()=>g.h.choiceIn({FindMulti:()=>({count:2,...g.rows})});
      try{await assert.rejects(g.h.resolveChoice(state()),e=>e.code==="TCG_CHOICE_RETRY");assert.equal(g.inputs.length,0);}
      finally{g.h.dispose();}}
    finally{f.h.dispose();}
  });
  await test("雷草分支按存活者选，支援实际确认后才入记忆；没有领域证据不假设大招减费",()=>{
    const s=state({hand:hand("shatterbolt","sweet"),dice:{Electro:8}}),m=T.freshMemory();
    assert.equal(T.blessingChoice(s,m),"shatterbolt");s.characters[0].dead=s.characters[2].dead=true;
    assert.equal(T.blessingChoice(s,m),"sharpkernel");s.characters[1].energy=2;assert.equal(T.blessingChoice(s,m),"shatterbolt");
    s.characters[0].dead=s.characters[2].dead=false;const a=T.choose(s,m);assert.equal(a.id,"shatterbolt");
    assert.equal(m.thundergrassSupport,null);T.commit(m,a,s);assert.equal(m.thundergrassSupport,"shatterbolt");
    assert.equal(T.skillCost(2,"Q",m).n,4);assert.equal(T.choose(s,m).type,"skill");
  });
  await test("选择产生的新牌必须在真实完整手牌中出现，旧同数量缓存不能发布；缺牌有界恢复",async()=>{
    const f=handToggleFixture(["shatterbolt","sweet"]),before=state({hand:hand("sweet"),dice:{Electro:8}});
    f.h.board=()=>clone(before);f.h.pendingChoiceCard={id:"shatterbolt",oldCount:1};f.h.handCountHint=2;
    try{const after=await f.h.observe(true);assert.deepEqual(clone(after.hand).map(c=>c.id),["shatterbolt","sweet"]);
      assert.equal(f.h.pendingChoiceCard,null);assert.equal(f.count(1019,945),1);assert.equal(f.ui.togglesClosed,0);
      f.h.pendingChoiceCard={id:"sharpkernel",oldCount:2};f.h.handCache=null;
      await assert.rejects(f.h.observe(true),e=>e.code==="TCG_HAND_RETRY");}
    finally{f.h.dispose();}
  });
  await test("中途选择页优先于动作确认，原技能不重放，生成后full而非unchanged旧牌序",async()=>{
    const h=new Host({enemyCount:3}),before=state({hand:hand("sweet"),dice:{Electro:8}}),after=clone(before);let selected=false,reads=0;
    after.hand=hand("shatterbolt","sweet");after.dice.Electro=5;after.handRead="full";
    h.phase=()=>selected?{phase:"board",turn:"user"}:{phase:"choice",turn:"none"};h.reset=async()=>{};h.board=()=>clone(after);
    h.resolveChoice=async()=>{selected=true;h.handCountHint=2;};h.execute=async()=>{throw new Error("action replay forbidden");};
    h.observe=async(_,plan)=>{reads++;assert.equal(plan.mode,"full");assert.equal(plan.expectedCount,2);return clone(after);};h.expectedDice=5;
    try{assert.equal((await h.confirm({type:"skill",who:0,skill:"E"},before)).confirmed,true);assert.equal(reads,1);}
    finally{h.dispose();}
  });
  await test("执行前骰子字典顺序或省略零键不产生伪变化，真实资源变化仍撤销旧动作",async()=>{
    const h=new Host({enemyCount:3}),s=state({dice:{Electro:5,Dendro:3}}),b=clone(s);let inputs=0;
    b.dice={Dendro:3,Electro:5,Pyro:0};h.board=()=>clone(b);h.clickAt=()=>inputs++;
    try{await h.requireUnchangedBoard(s);assert.equal(inputs,0);b.dice.Dendro=2;
      await assert.rejects(h.requireUnchangedBoard(s),e=>e.code==="TCG_STATE_REFRESH");assert.equal(inputs,0);}
    finally{h.dispose();}
  });
  await test("支援使大招少付两骰时只同步实际资源，不扫手牌不重放动作",async()=>{
    const h=new Host({enemyCount:3}),s=state({hand:hand("sweet"),dice:{Electro:8}}),a=clone(s);let reads=0;
    s.characters[0].energy=2;a.characters[0].energy=0;a.characters[1].energy=2;a.characters[2].energy=2;a.dice.Electro=7;
    h.phase=()=>({phase:"board",turn:"user"});h.board=()=>clone(a);h.reset=async()=>{};
    h.observe=async(_,plan)=>{if(plan.mode==="full")reads++;return clone(a);};h.expectedDice=5;
    h.execute=async()=>{throw new Error("discount must not replay action");};
    try{const r=await h.confirm({type:"skill",who:0,skill:"Q"},s);
      assert.equal(r.confirmed,true);assert.equal(r.resynchronized,true);assert.equal(reads,0);assert.equal(h.expectedDice,7);}
    finally{h.dispose();}
  });
  await test("预设计19种30张逐项核对，五种新增卡均有明确身份和独立费用",()=>{
    const proposed=[["元素幻变：雷草祝佑",1],["赦免宣告",1],["元素共鸣：交织之雷",2],["元素共鸣：强能之雷",2],
      ["换班时间",2],["交给我吧！",2],["最好的伙伴！",2],["一掷乾坤",2],["运筹帷幄",2],["星天之兆",1],["白垩之术",1],
      ["本大爷还没有输！",2],["流放者头冠",2],["赌徒的耳环",2],["莲花酥",2],["北地烟熏鸡",1],["蒙德土豆饼",1],["飞叶迴斜",1],["抵天雷罚",1]];
    assert.equal(proposed.reduce((n,[_,c])=>n+c,0),30);assert.equal(proposed.filter(([name])=>T.identify(name)).length,19);
    const missing=proposed.filter(([name])=>!T.identify(name)).map(([name])=>name);
    assert.deepEqual(missing,[]);
    assert.deepEqual(clone(T.byId.edict.cost),{aligned:1});assert.deepEqual(clone(T.byId.exile.cost),{any:2});
    assert.deepEqual(clone(T.byId.penance.cost),{element:"Electro",n:3});
  });
  async function loggingExample(action, config={}) {
    const messages=[],events=[],s=state({hand:[{id:"beginner-card",name:"白铁大剑",index:0}]});
    let phase="pick",executions=0;
    class LogHost {
      trace(event,data){events.push({event,data});}async waitForCapture(){}async pick(){phase="board";}
      phase(){return phase==="result"?{phase,result:"win",turn:"none"}:{phase,turn:phase==="board"?"user":"none"};}
      async observe(){return clone(s);}
      async execute(){executions++;if(config.error)throw new Error(config.error);phase="result";
        if(action.type==="probe")return {...clone(s),probed:true};}
      async confirm(){return {phase:"result",result:"win",confirmed:!config.uncertain};}
      snapshot(reason){events.push({event:"stop",data:{reason}});}dispose(){}
    }
    const replay={settings:{mode:config.diagnostic?"识别诊断":"自动试验"},TCGBetterGI:{BetterGIHost:LogHost},
      setGameMetrics:()=>{},sleep:async()=>{},
      log:{info:text=>messages.push({level:"info",text}),warn:text=>messages.push({level:"warn",text}),error:text=>messages.push({level:"error",text})},
      file:{readTextSync:p=>p==="lib/core.js"?fs.readFileSync(path.join(base,p),"utf8")+
        "\nTCG.choose=()=>("+JSON.stringify({...action,reason:"完整策略理由；未重复点击；不接管中途对局"})+");":""}};
    // Diagnostic pick exits before choosing; admit its board as diagnostic entry.
    if(config.diagnostic)phase="board";
    const run=vm.runInContext(fs.readFileSync(path.join(base,"main.js"),"utf8"),vm.createContext(replay));
    if(config.error)await assert.rejects(run,new RegExp(config.error));else await run;
    return {messages,events,executions};
  }
  await test("窗口行动名称覆盖普攻战技爆发切人出牌调和费用检视与结束，不输出策略理由",async()=>{
    for(const [action,label] of [
      [{type:"skill",who:0,skill:"NA"},"雷电将军·普攻"],
      [{type:"skill",who:1,skill:"E"},"柯莱·战技"],
      [{type:"skill",who:2,skill:"Q"},"刻晴·爆发"],
      [{type:"switch",target:1},"切换：柯莱"],
      [{type:"card",id:"woven"},"出牌：元素共鸣：交织之雷"],
      [{type:"tune",id:"beginner-card"},"调和：白铁大剑"],
      [{type:"probe",who:2,skill:"Q"},"检视费用：刻晴·爆发"],
      [{type:"end"},"结束回合"]]) {
      const r=await loggingExample(action);assert.equal(r.executions,1);
      assert.deepEqual(r.messages,[{level:"info",text:"行动："+label},{level:"info",text:"对局胜利"}]);
      assert.ok(r.events.some(e=>e.event==="decision"&&e.data.reason.includes("完整策略理由")));
    }
  });
  await test("停止日志只输出具体错误，截图与文件stop原因保留，错误继续抛给宿主",async()=>{
    const reason="技能确认页未核实目标技能：空标题";
    const r=await loggingExample({type:"skill",who:0,skill:"E"},{error:reason});
    assert.deepEqual(r.messages,[{level:"error",text:"牌手停止："+reason}]);
    assert.equal(r.executions,1);assert.equal(r.events.find(e=>e.event==="stop").data.reason,reason);
    assert.ok(r.events.some(e=>e.event==="decision"));
  });
  await test("牌桌诊断只给一条短建议，详细决策留文件且零执行",async()=>{
    const r=await loggingExample({type:"skill",who:0,skill:"E"},{diagnostic:true});
    assert.deepEqual(r.messages,[{level:"info",text:"诊断完成：建议雷电将军·战技"}]);
    assert.equal(r.executions,0);assert.ok(r.events.some(e=>e.event==="decision"&&e.data.reason));
  });
  await test("动作不确定时保留短警告与诊断事件，不输出边界声明或误报确认",async()=>{
    const r=await loggingExample({type:"card",id:"woven"},{uncertain:true});
    assert.equal(r.executions,1);assert.deepEqual(r.messages,[{level:"info",text:"行动：出牌：元素共鸣：交织之雷"},
      {level:"warn",text:"动作效果未确认，已重新同步"},{level:"info",text:"对局胜利"}]);
    assert.equal(r.events.some(e=>e.event==="confirmed"),false);assert.ok(r.events.some(e=>e.event==="action-uncertain"));
  });
  for (const name of ["manifest.json", "settings.json"]) JSON.parse(fs.readFileSync(path.join(base, name), "utf8"));
  await test("生产main重投无计数后续页：空手收尾继续柯莱Q，不检视空手或增加回合",async()=>{
    const evidence=await require("./adapter-replay.cjs")(base,31,{counterless:true});
    assert.equal(evidence.action_reroll.confirms,2);console.log("REPLAY "+JSON.stringify(evidence));
  });
  for(const variant of [0,1,2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,28,29,30,31,32,33,34,35,36,37,38,39])await test("实际main固定配队与增量手牌多回合回放：快速牌/料理/三人大招/切人/结束，变体"+variant,async()=>{
    const evidence=await require("./adapter-replay.cjs")(base,variant);
    console.log("REPLAY "+JSON.stringify(evidence));
  });
  for(const variant of [3])await test("固定配队免开局核队，但实际切换的未知角色标题仍拒绝，变体"+variant,async()=>{
    const evidence=await require("./adapter-replay.cjs")(base,variant);assert.equal(evidence.rejected,true);
    console.log("REPLAY "+JSON.stringify(evidence));
  });
  for(const variant of [20,21,22,23,24,25])await test("实际main与生产适配器拒绝未确认或非新开局行动页，任何输入前停止，变体"+variant,async()=>{
    const evidence=await require("./adapter-replay.cjs")(base,variant);assert.equal(evidence.rejected,true);assert.equal(evidence.inputs,0);
    console.log("REPLAY "+JSON.stringify(evidence));
  });
  await test("实际main首次掷骰诊断入口仅读骰，不重投不确认也不推进回合",async()=>{
    const evidence=await require("./adapter-replay.cjs")(base,26);assert.equal(evidence.inputs,0);console.log("REPLAY "+JSON.stringify(evidence));
  });
  await test("实际main行动页满血零充能8骰仍拒绝已使用的6张手牌，不重复扫描也不出牌",async()=>{
    const evidence=await require("./adapter-replay.cjs")(base,27);assert.equal(evidence.rejected,true);assert.equal(evidence.gameplayActions,0);
    console.log("REPLAY "+JSON.stringify(evidence));
  });
  console.log(JSON.stringify({ passed, failed: results.length - passed, note: "纯规则/合成回放/模拟宿主；不是游戏实战", results }, null, 2));
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
