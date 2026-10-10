/* Local rules, not an omniscient simulator. No host API, network, or LLM here. */
(function (root) {
  "use strict";
  const team = [
    { name: "雷电将军", element: "Electro", maxEnergy: 2, maxHp: 10 },
    { name: "柯莱", element: "Dendro", maxEnergy: 2, maxHp: 11 },
    { name: "刻晴", element: "Electro", maxEnergy: 3, maxHp: 10 }
  ];
  const cards = [
    ["woven", "元素共鸣：交织之雷", {}, "dice"],
    ["voltage", "元素共鸣：强能之雷", { element: "Electro", n: 1 }, "energy"],
    ["shift", "换班时间", {}, "switch"],
    ["fast", "交给我吧！", {}, "switch"],
    ["companion", "最好的伙伴！", { any: 2 }, "dice"],
    ["draw", "运筹帷幄", { aligned: 1 }, "draw"],
    ["stars", "星天之兆", { any: 2 }, "energy"],
    ["calx", "白垩之术", { aligned: 1 }, "energy"],
    ["lotus", "莲花酥", { aligned: 1 }, "food"],
    ["hashbrown", "蒙德土豆饼", { aligned: 1 }, "food"],
    ["sweet", "甜甜花酿鸡", {}, "food"],
    ["smoked", "北地烟熏鸡", {}, "food"],
    ["mint", "兽肉薄荷卷", { aligned: 1 }, "food"],
    ["gambler", "赌徒的耳环", { aligned: 1 }, "artifact"],
    ["talent", "飞叶迴斜", { element: "Dendro", n: 3 }, "talent"],
    ["wedge", "雷楔", { element: "Electro", n: 3 }, "wedge"],
    ["tassel", "白缨枪", { aligned: 2 }, "weapon", 0],
    ["raven", "鸦羽弓", { aligned: 2 }, "weapon", 1],
    ["sword", "旅行剑", { aligned: 2 }, "weapon", 2],
    ["thundergrass", "元素幻变：雷草祝佑", { aligned: 2 }, "support"],
    ["shatterbolt", "雷草祝佑·碎霆", { element: "Electro", n: 1 }, "support"],
    ["sharpkernel", "雷草祝佑·锐核", { element: "Dendro", n: 2 }, "support"],
    ["edict", "赦免宣告", { aligned: 1 }, "legend"],
    ["toss", "一掷乾坤", {}, "reroll"],
    ["lost", "本大爷还没有输！", {}, "recovery"],
    ["exile", "流放者头冠", { any: 2 }, "artifact"],
    ["penance", "抵天雷罚", { element: "Electro", n: 3 }, "talent"]
  ].map(([id, name, cost, type, weaponTarget]) => ({ id, name, cost, type, weaponTarget,
    copies: id === "wedge" || type === "weapon" || type === "support" ||
      ["edict","toss","lost","exile","penance"].includes(id) ? 0 : 2 }));
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const norm = text => String(text || "").replace(/[\s:：·!！。，,（）()]/g, "").replace(/迴/g, "回");
  // The user accepts the two-glyph 运筹 anchor; other cards keep exact titles/aliases.
  const cardTitleAliases = { "救免宣告":"赦免宣告", "飞叶斜":"飞叶迴斜" };
  function identify(text) {
    const t = norm(text);
    if (t.includes("运筹")) return byId.draw;
    const canonical = cardTitleAliases[t] || t;
    return cards.find(c => norm(c.name) === norm(canonical)) || null;
  }
  // A readable title is not permission to play the card. Unsupported cards have
  // stable identities for hand accounting only; empty/invalid OCR is still fatal.
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
    const t = norm(text);
    // Exact, native-observed OCR alias only; never fuzzy-match an arbitrary hero.
    if (t === "刻睛") return 2;
    return team.findIndex(c => norm(c.name) === t || (c.name === "雷电将军" && t === "雷神"));
  }
  const diceOrder = ["Pyro","Hydro","Anemo","Electro","Dendro","Cryo","Geo","Omni"];
  const total = dice => Object.values(dice || {}).reduce((sum, n) => sum + n, 0);
  const size = cost => (cost.n || 0) + (cost.any || 0) + (cost.aligned || 0);
  const known = n => Number.isInteger(n) && n >= 0;
  const alive = c => c && c.dead === false && known(c.hp) && c.hp > 0;
  function freshMemory() {
    return { round: 0, raidenBurst: false, colleiBurst: false, used: [0, 0, 0],
      eyeRound: -10, dendroRound: -10, keqingInfusedRound: -10,
      food: [false, false, false], normalDiscount: [0, 0, 0],
      freeSwitch: false, fastSwitch: false, artifacts: [false, false, false],
      weapons: [false, false, false], talent: false, uncertainActions: [], defeated: [false,false,false], thundergrassSupport:null,
      artifactKinds:[null,null,null],exileUsedRound:[-1,-1,-1],gamblerUsed:[0,0,0],
      enemyAliveCount:null,enemyLastActive:null,penance:false,legendUsed:false,
      immuneUntil:[-1,-1,-1],defeatRound:-1,lostUsedRound:-1,blessingUsed:0,costEvidence:null,probeKeys:[] };
  }
  function nextRound(m) {
    m.round++;
    m.food = [false, false, false];
    m.normalDiscount = [0, 0, 0];
    m.uncertainActions = [];
    m.blessingUsed=0;m.costEvidence=null;m.probeKeys=[];
    // Switch discounts survive round boundaries (they are not oneDuration).
  }
  // Opening lifecycle is independent of round counters: a first roll may
  // precede the first character pick. This is NOT a midgame restore record.
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
  function rerollPlan(items, m) {
    const dead=m.defeated || [false,false,false];
    const primary = dead[0] && dead[2] ? "Dendro" : dead[1] ? "Electro" :
      dead[2] || dead[0] && !m.colleiBurst ? "Dendro" : !m.raidenBurst || m.colleiBurst ? "Electro" : "Dendro";
    const secondary = primary === "Dendro" ? (!dead[0] || !dead[2] ? "Electro" : null) :
      !dead[1] && m.raidenBurst && m.round + 1 > m.dendroRound + 1 ? "Dendro" : null;
    // Raiden/Keqing can use several Electro skills in one round. Do not reroll
    // usable primary dice merely because one skill costs three or four.
    // Collei's opening is one three-Dendro burst followed by an Electro switch.
    const primaryLimit = primary === "Dendro" && !(dead[0] && dead[2]) ? 3 : 8;
    const indices = items.map((d,i)=>d.element==="Omni"?i:-1).filter(i=>i>=0);
    // Prioritize the next stage, keeping at most a second skill's elemental
    // budget. Keeping every Electro after Raiden Q starves Collei's launch.
    for(const [element,limit] of [[primary,primaryLimit],[secondary,3]]) {
      if(!element)continue;
      indices.push(...items.map((d,i)=>d.element===element?i:-1).filter(i=>i>=0).slice(0,limit));
    }
    return {primary,secondary,elements:[primary,...(secondary?[secondary]:[]),"Omni"],indices:indices.sort((a,b)=>a-b)};
  }
  // Payment feasibility includes Omni exactly once; energy is a separate resource.
  // The host uses the game's default legal auto-payment, not these suggested indices.
  function payment(dice, cost, preserve = "Electro") {
    const list = Object.entries(dice || {}).flatMap(([e, n]) => Array(n).fill(e));
    const need = size(cost);
    if (need > list.length || list.length > 16) return null;
    if (!need) return { indices: [], remaining: { ...dice } };
    let best = null;
    function visit(start, selected) {
      if (selected.length === need) {
        const chosen = selected.map(i => list[i]);
        if (cost.n && chosen.filter(e => e === cost.element || e === "Omni").length < cost.n) return;
        if (cost.aligned) {
          const unique = [...new Set(chosen.filter(e => e !== "Omni"))];
          if (unique.length > 1) return;
        }
        const weight = chosen.reduce((v, e) => v + (e === "Omni" ? 10 : e === preserve ? 6 : e === "Dendro" ? 3 : 1), 0);
        if (best && best.weight <= weight) return;
        const remaining = { ...dice };
        for (const e of chosen) remaining[e]--;
        best = { indices: selected.slice(), remaining, weight };
        return;
      }
      for (let i = start; i <= list.length - need + selected.length; i++) visit(i + 1, selected.concat(i));
    }
    visit(0, []);
    return best;
  }
  function boardKey(s) {
    return JSON.stringify([s.active,diceOrder.map(e=>s.dice?.[e]||0),s.characters,
      (s.hand||[]).map(h=>h.id),s.enemies,s.quicken||null]);
  }
  function skillCost(who, skill, m, s=null) {
    const base=skill === "Q" ? { element:team[who].element,n:who===2?4:3 } :
      skill === "E" ? {element:team[who].element,n:3} :
      {element:team[who].element,n:1,any:m.normalDiscount[who]>0?1:2};
    const evidence=m.costEvidence;
    if(s && evidence?.key===boardKey(s) && evidence.who===who && evidence.skill===skill &&
        known(evidence.n) && evidence.n<=size(base) && evidence.source==="native-skill-preview") {
      return skill==="NA" ? {element:base.element,n:Math.min(1,evidence.n),any:Math.max(0,evidence.n-1)} :
        {element:base.element,n:evidence.n};
    }
    // Only explicitly observed current field state can authorize a discount.
    // A generated blessing card alone is not field or usage evidence.
    if(s?.quicken?.known===true && known(s.quicken.charges) && s.quicken.charges>0) {
      const reduction=m.thundergrassSupport==="shatterbolt" && skill==="Q" && m.blessingUsed<1?2:
        m.thundergrassSupport==="sharpkernel" && skill==="E" && m.blessingUsed<2?1:0;
      base.n=Math.max(0,(base.n||0)-reduction);
    }
    return base;
  }
  function skillLegal(s, action, m) {
    const who = action.who;
    if (s.active !== who || !alive(s.characters[who]) || s.characters[who].frozen !== false) return false;
    if (action.skill === "Q" && (!known(s.characters[who].energy) || s.characters[who].energy < team[who].maxEnergy)) return false;
    return !!payment(s.dice, skillCost(who, action.skill, m,s), team[who].element);
  }
  function intent(s, m) {
    const cs = s.characters;
    if(cs.some(c=>c.dead===true))return survivorIntent(s,m);
    if (!m.raidenBurst && alive(cs[0]) && cs[0].frozen === false) {
      return { type: "skill", who: 0, skill: cs[0].energy === 2 ? "Q" : m.used[0] === 0 ? "NA" : m.eyeRound < m.round ? "E" : "NA" };
    }
    if (!m.colleiBurst && alive(cs[1]) && cs[1].frozen === false) {
      return { type: "skill", who: 1, skill: cs[1].energy === 2 ? "Q" : "E" };
    }
    // The opener is not a permanent lock onto Keqing. Evaluate other charged
    // survivors every action, including actual switch+skill/tuning budgets.
    const ready=survivorIntent(s,m);
    if(ready?.skill==="Q" && followupReachable(s,m,ready))return ready;
    if(alive(cs[s.active]) && (cs[s.active].frozen || cs[s.active].hp<=3)) {
      const safer=survivorIntent(s,m);
      if(safer && safer.who!==s.active && followupReachable(s,m,safer))return safer;
    }
    if (alive(cs[2]) && cs[2].frozen === false) {
      // Reapply Dendro when possible after the opening; no assumed permanent summon.
      if (alive(cs[1]) && cs[1].frozen === false && m.round > m.dendroRound + 1 &&
          payment(s.dice, { element: "Dendro", n: 3, any: s.active === 1 || m.freeSwitch ? 0 : 1 }, "Dendro")) {
        return { type: "skill", who: 1, skill: cs[1].energy === 2 ? "Q" : "E" };
      }
      return { type: "skill", who: 2, skill: cs[2].energy === 3 ? "Q" : m.keqingInfusedRound + (m.penance?2:1) >= m.round ? "NA" : "E" };
    }
    const who = cs.findIndex(c => alive(c) && c.frozen === false);
    return who < 0 ? null : { type: "skill", who, skill: cs[who].energy === team[who].maxEnergy ? "Q" : "E" };
  }
  function noteBoard(m,s) {
    if(!Array.isArray(s?.characters))return;
    if(!m.defeated)m.defeated=[false,false,false];
    s.characters.forEach((c,i)=>{if(i<3 && c?.dead===true){if(!m.defeated[i])m.defeatRound=m.round;m.defeated[i]=true;}});
    noteEnemyDefeats(m,s,m.enemyLastActive);
  }
  function enemyCount(s) {
    const es=s?.enemies;
    if(!Array.isArray(es) || !es.length || !es.every(e=>e.dead===true || alive(e)))return null;
    return es.filter(alive).length;
  }
  function gamblerRemaining(m,who) { return Math.max(0,3-(m.gamblerUsed?.[who]||0)); }
  function noteEnemyDefeats(m,s,owner) {
    const count=enemyCount(s);if(count===null)return;
    const lost=m.enemyAliveCount===null || m.enemyAliveCount===undefined?0:Math.max(0,m.enemyAliveCount-count);
    if(lost && m.artifactKinds?.[owner]==="gambler") {
      if(!m.gamblerUsed)m.gamblerUsed=[0,0,0];
      m.gamblerUsed[owner]=Math.min(3,(m.gamblerUsed[owner]||0)+lost);
    }
    m.enemyAliveCount=count;m.enemyLastActive=s.active;
  }
  // A reroll repairs colors, not the total budget. Include the switch fee and
  // use the same target for planning and native selection. No lucky result is
  // published as a board; random outcomes terminate the search branch.
  function actionRerollGoal(s,m) {
    const preferred=intent(s,m),goals=[preferred];
    for(const who of [s.active,0,1,2])for(const skill of ["Q","E","NA"])goals.push({who,skill});
    for(const goal of goals) {
      if(!goal || !alive(s.characters[goal.who]) || s.characters[goal.who].frozen!==false ||
          goal.skill==="Q" && s.characters[goal.who].energy!==team[goal.who].maxEnergy)continue;
      const switching=goal.who!==s.active&&!m.freeSwitch?1:0,cost=skillCost(goal.who,goal.skill,m,s);
      if(total(s.dice)<size(cost)+switching)continue;
      const element=team[goal.who].element,bad=total(s.dice)-(s.dice[element]||0)-(s.dice.Omni||0);
      return {...goal,element,switching,bad,needed:Math.max(0,(cost.n||0)-(s.dice[element]||0)-(s.dice.Omni||0)),
        payable:!!payment(s.dice,{...cost,any:(cost.any||0)+switching},element)};
    }
    return null;
  }
  function rerollCounter(text) {
    const t=norm(text),values=[];
    for(const match of t.matchAll(/(?:还可重投([12])轮|(?:可重投次数|剩余重投次数|剩余次数)([12]))/g))
      values.push(Number(match[1]||match[2]));
    return values.length===1?values[0]:null;
  }
  function burnableHand(s,m) {
    const a=s.active,active=s.characters[a];
    const values={woven:100,voltage:95,shift:20,fast:30,companion:60,draw:55,stars:40,calx:35,
      lotus:active?.hp<=4?90:25,hashbrown:active?.hp<=5?80:20,sweet:25,smoked:15,
      mint:20,gambler:30,talent:alive(s.characters[1])&&!m.talent?75:0,wedge:alive(s.characters[2])?80:0,tassel:25,raven:25,sword:25,
      thundergrass:75,shatterbolt:93,sharpkernel:85,edict:m.legendUsed?0:70,
      exile:45,penance:alive(s.characters[2])&&!m.penance?75:0,
      lost:m.defeatRound===m.round&&m.lostUsedRound!==m.round?95:25,toss:30};
    // High-value cards are preferred, not permanent blockers. Playable zero-
    // cost dice/energy/talent actions already outrank tuning. If missing other
    // cards, even a valuable card may unlock a fully reachable burst/skill.
    return s.hand.filter(h=>handCardKnown(h) &&
      !(m.uncertainActions||[]).includes(actionKey({type:"tune",id:h.id})))
      .sort((x,y)=>(values[x.id]??50)-(values[y.id]??50));
  }
  function tuningPlan(s,m,goal) {
    if(!goal || goal.who!==s.active || s.characters[s.active].frozen!==false)return null;
    if(goal.skill==="Q" && s.characters[goal.who].energy!==team[goal.who].maxEnergy)return null;
    const cost=skillCost(goal.who,goal.skill,m,s),element=team[goal.who].element;
    if(total(s.dice)<size(cost) || payment(s.dice,cost,element))return null;
    const needed=Math.max(0,(cost.n||0)-(s.dice[element]||0)-(s.dice.Omni||0));
    const burnable=burnableHand(s,m),bad=total(s.dice)-(s.dice[element]||0)-(s.dice.Omni||0);
    if(!needed || needed>bad || needed>burnable.length)return null;
    const projected={...s.dice,[element]:(s.dice[element]||0)+needed};
    let rest=needed;
    for(const el of Object.keys(projected))if(el!==element && el!=="Omni") {
      const n=Math.min(rest,projected[el]);projected[el]-=n;rest-=n;
    }
    if(rest || !payment(projected,cost,element))return null;
    return {card:burnable[0],needed,goal};
  }
  function survivorIntent(s,m) {
    const choices=[];
    for(let who=0;who<3;who++) {
      const c=s.characters[who];if(!alive(c) || c.frozen!==false)continue;
      const switching=who!==s.active && !m.freeSwitch?1:0;
      for(const skill of ["Q","E","NA"]) {
        if(skill==="Q" && c.energy!==team[who].maxEnergy)continue;
        const goal={type:"skill",who,skill},cost={...skillCost(who,skill,m,s)};
        cost.any=(cost.any||0)+switching;
        const canPay=!!payment(s.dice,cost,team[who].element);
        const canTune=Array.isArray(s.hand) && followupReachable(s,m,goal);
        if(canPay || canTune)choices.push({...goal,rank:(skill==="Q"?100:skill==="E"?70:50)+
          (who===s.active?5:0)+(canPay?3:0)-switching*8+(c.hp<=3?-35:0)});
      }
    }
    choices.sort((x,y)=>y.rank-x.rank);
    if(choices.length){const {rank,...goal}=choices[0];return goal;}
    const who=alive(s.characters[s.active]) && s.characters[s.active].frozen===false?s.active:
      s.characters.findIndex(c=>alive(c) && c.frozen===false);
    return who<0?null:{type:"skill",who,skill:s.characters[who].energy===team[who].maxEnergy?"Q":"E"};
  }
  function followupReachable(s,m,goal) {
    if(!goal || !alive(s.characters[goal.who]) || s.characters[goal.who].frozen!==false)return false;
    let dice=s.dice;
    if(goal.who!==s.active && !m.freeSwitch) {
      const p=payment(dice,{any:1},team[goal.who].element);if(!p)return false;dice=p.remaining;
    }
    const local={...s,active:goal.who,dice};
    return skillLegal(local,goal,m) || Array.isArray(local.hand) && !!tuningPlan(local,m,goal);
  }
  function switchPreparationReachable(s,m,goal) {
    const goals=[goal,{who:goal.who,skill:"E"},{who:goal.who,skill:"NA"}];
    if(goals.some(g=>followupReachable(s,m,g)))return true;
    const hh=s.hand||[],uncertain=m.uncertainActions||[];
    const shift=hh.find(h=>h.id==="shift");
    if(!m.freeSwitch && shift && hh.length>1 && !uncertain.includes(actionKey({type:"card",id:"shift"}))) {
      const local={...s,hand:hh.filter(h=>h!==shift)};
      if(goals.some(g=>followupReachable(local,{...m,freeSwitch:true},g)))return true;
    }
    const companion=hh.find(h=>h.id==="companion"),pay=companion&&payment(s.dice,byId.companion.cost,team[s.active].element);
    if(pay && !uncertain.includes(actionKey({type:"card",id:"companion"}))) {
      const local={...s,hand:hh.filter(h=>h!==companion),dice:{...pay.remaining,Omni:(pay.remaining.Omni||0)+2}};
      if(goals.some(g=>followupReachable(local,m,g)))return true;
    }
    return false;
  }
  function replacement(s,m) {
    if(!Array.isArray(s?.characters) || s.characters.length!==3 ||
      s.characters.some(c=>!c || c.dead!==true && !alive(c)))return null;
    const choices=[];
    for(let who=0;who<3;who++) {
      const c=s.characters[who];if(!alive(c))continue;
      const local={...s,active:who,hand:[],dice:s.dice||{}},goal=survivorIntent(local,m);
      const payable=goal?.who===who && c.frozen===false &&
        !!payment(local.dice,skillCost(who,goal.skill,m,local),team[who].element);
      choices.push({who,score:(c.frozen===false?100:0)+(payable?(goal.skill==="Q"?50:goal.skill==="E"?30:20):0)+
        (known(c.energy)?c.energy:0)*3+Math.min(c.hp,10)});
    }
    choices.sort((x,y)=>y.score-x.score);
    return choices.length?{who:choices[0].who}:null;
  }
  function legalState(s) {
    return !!s && Array.isArray(s.characters) && s.characters.length === 3 &&
      !!s.dice && typeof s.dice === "object" && !Array.isArray(s.dice) &&
      s.turn === "user" && Number.isInteger(s.active) && s.active >= 0 && s.active < 3 &&
      alive(s.characters[s.active]) &&
      Array.isArray(s.hand) && s.hand.every(handCardKnown) && s.diceKnown === true &&
      Object.values(s.dice).every(known) && total(s.dice) <= 16 && s.characters.every((c, i) =>
        c && (c.dead === true || (alive(c) && typeof c.frozen === "boolean" && known(c.energy) && c.energy <= team[i].maxEnergy)));
  }
  function choose(s, m) {
    if (!legalState(s)) return { type: "stop", reason: "回合、手牌、血量、状态或充能存在未知值，禁止猜测执行" };
    let wanted = intent(s, m);
    if(wanted && wanted.who!==s.active && !switchPreparationReachable(s,m,wanted)) {
      wanted=survivorIntent(s,m);
    }
    const a = s.active, active = s.characters[a], diceCount = total(s.dice);
    const wantSwitch = wanted && wanted.who !== a;
    const skill = wanted && wanted.who === a ? wanted.skill : null;
    const candidates = [];
    function offer(action, score, reason) {
      if (!(m.uncertainActions || []).includes(actionKey(action))) candidates.push({ ...action, score, reason });
    }
    const desiredCost = wanted ? skillCost(wanted.who, wanted.skill, m,s) : { any: 3 };
    const reserve = size(desiredCost) + (wantSwitch && !m.freeSwitch ? 1 : 0);
    for (const h of s.hand) {
      const c = byId[h.id];
      if (!c) continue; // Unknown rules still forbid playing; tuning only needs verified identity.
      const pay = payment(s.dice, c.cost, team[a].element);
      if (!pay) continue;
      const remaining = total(pay.remaining);
      const action = { type: "card", id: c.id, index: h.index, target: null };
      if(c.type === "support" && m.thundergrassSupport !== c.id && s.characters.some(alive)) {
        // CatalyzingField is not currently read. Selecting/playing a blessing
        // never proves its conditional skill discount. Keep nominal reserves.
        if(remaining>=reserve)offer(action,c.id==="shatterbolt"?91:65,
          "雷草支援先付实际费用，保留后续技能预算；减费是否生效以真实回读为准");
        else if(remaining>=1 && m.round<=3)offer(action,35,"用闲置资源建立下轮雷草骰支援，不假设激化领域永久存在");
      }
      // These zero-cost statuses have no independent visible resource effect.
      // Keep a final copy until the next draw, instead of pretending failed count OCR proves zero cards.
      if (s.hand.length === 1 && ["shift", "fast", "smoked"].includes(c.id)) continue;
      if (c.id === "woven" && diceCount < 16) offer(action, 100, "零费雷骰，扩充本轮行动资源");
      if (c.id === "voltage" && known(active.energy) && active.energy < team[a].maxEnergy &&
          !wantSwitch && active.frozen === false && remaining >= 3) offer(action, 94, "优先充能；不假设只能给一人充能");
      if (c.id === "shift" && wantSwitch && !m.freeSwitch) offer(action, 96, "下一次切换减一骰");
      if (c.id === "fast" && wantSwitch && !m.fastSwitch && diceCount >= reserve) offer(action, 92, "快切后仍有资源打出目标技能");
      if (c.id === "companion" && wanted) {
        const d = { ...pay.remaining, Omni: (pay.remaining.Omni || 0) + 2 };
        if (!payment(s.dice, { ...desiredCost, any: (desiredCost.any || 0) + (wantSwitch && !m.freeSwitch ? 1 : 0) }, team[wanted.who].element) &&
            payment(d, { ...desiredCost, any: (desiredCost.any || 0) + (wantSwitch && !m.freeSwitch ? 1 : 0) }, team[wanted.who].element)) {
          offer(action, 89, "用两枚骰子换两枚万能骰；并非凭空增加两骰");
        }
      }
      if ((c.id === "stars" || c.id === "calx") && !wantSwitch && skill && skill !== "Q" &&
          active.energy < team[a].maxEnergy && active.frozen === false) {
        const donors = s.characters.filter((x, i) => i !== a && alive(x) && x.energy > 0).length;
        const gain = c.id === "stars" ? 1 : Math.min(2, donors);
        if (gain && active.energy + gain >= team[a].maxEnergy &&
            payment(pay.remaining, skillCost(a, "Q", m,s), team[a].element) &&
            (c.id !== "calx" || m.raidenBurst || s.characters[0].dead===true)) offer(action, c.id === "calx" ? 93 : 87, "本次补能能直接接可支付的大招");
      }
      if (c.type === "food" && !m.food[a] && active.frozen === false) {
        action.target = a;
        if (c.id === "lotus" && active.hp <= 4 && remaining >= reserve) offer(action, 98, "低血量出战角色先防致命伤");
        if (c.id === "hashbrown" && active.hp <= 7 && remaining >= reserve) offer(action, 85, "有后续行动预算时治疗两点");
        if (c.id === "sweet" && active.hp <= 8) offer(action, active.hp <= 3 ? 97 : 70, "零费治疗；遵守每人每轮一次料理");
        if (c.id === "smoked" && !wantSwitch && skill === "NA" && diceCount >= 2) offer(action, 91, "即将普攻，先减一无色骰");
        if (c.id === "mint" && !wantSwitch && skill === "NA" && a === 2 && m.keqingInfusedRound + 1 >= m.round && remaining >= 4) offer(action, 80, "预计连续两次附魔普攻，薄荷卷才划算");
      }
      if (c.id === "gambler" && a === 2 && gamblerRemaining(m,a)>0 && !wantSwitch && !m.artifacts[a] &&
          remaining >= reserve && s.enemies.some(e => alive(e) && e.hp <= 4)) {
        offer({ ...action, target: a }, 82, "可能击倒敌人前装备赌徒，不空耗启动骰");
      }
      if (c.type === "weapon" && c.weaponTarget === a && !wantSwitch && !m.weapons[a] &&
          active.hp >= 5 && active.frozen === false && skill !== "Q" &&
          payment(pay.remaining, desiredCost, team[a].element)) {
        offer({ ...action, target: a }, 66, "仅给适配的出战角色装备基础武器，且保留下一技能的元素骰");
      }
      if (c.id === "talent" && a === 1 && !wantSwitch && skill === "E" && !m.talent && active.frozen === false) {
        offer({ ...action, target: 1 }, 84, "三草骰天赋直接释放战技，而不是额外四费");
      }
      if (c.id === "wedge" && alive(s.characters[2]) && s.characters[2].frozen === false && wanted && wanted.who === 2 &&
          (wanted.skill!=="Q" || !payment(s.dice,{...skillCost(2,"Q",m,s),any:a===2 || m.freeSwitch?0:1},"Electro"))) {
        if(a!==2)offer({ ...action, target: 2 },83,"雷楔返场并放战技/附魔，不另付普通切换骰");
        else if(wanted.skill!=="Q")offer({type:"skill",who:2,skill:"E"},83,"刻晴已出战，直接战技消耗雷楔获得附魔，省去出牌操作");
      }
      if (c.id === "draw" && s.hand.length <= 8 &&
          (remaining >= reserve || (s.hand.length <= 2 && diceCount < reserve))) offer(action, 62, "有预算或缺乏可行动资源时过牌");
    }
    if (wanted) {
      if (wantSwitch && alive(s.characters[wanted.who]) && diceCount >= (m.freeSwitch ? 0 : 1)) {
        // Do not pay for a hopeless switch. Zero-cost switch also requires a follow-up budget.
        if (diceCount >= reserve && [wanted,{who:wanted.who,skill:"E"},{who:wanted.who,skill:"NA"}]
            .some(g=>followupReachable(s,m,g))) offer({ type: "switch", target: wanted.who }, 60, "存活者有可达后续技能，按充能/草伤/生存预算换人");
      } else if (!wantSwitch && skillLegal(s, wanted, m)) {
        offer(wanted, skill === "Q" ? 86 : 59, skill === "Q" ? "充能和骰子均已核实，释放大招" : "执行当前阶段的合法技能");
      }
      // A cheaper normal attack is preferable to ending with usable dice.
      if (!wantSwitch && skill === "Q" && !skillLegal(s,wanted,m) && skillLegal(s,{who:a,skill:"E"},m)) {
        offer({type:"skill",who:a,skill:"E"},43,"大招费用不足，保留已满充能并用可支付战技输出");
      }
      if (!wantSwitch && skill !== "NA" && !skillLegal(s,wanted,m) && skillLegal(s, { who: a, skill: "NA" }, m)) {
        offer({ type: "skill", who: a, skill: "NA" }, 40, "战技无法支付时用合法普攻续能");
      }
      if(!wantSwitch && !skillLegal(s,wanted,m)) {
        const goals=[wanted,...(skill==="Q"?[{type:"skill",who:a,skill:"E"}]:[]),
          ...(skill!=="NA"?[{type:"skill",who:a,skill:"NA"}]:[])];
        for(const [i,goal] of goals.entries()) {
          // Never burn towards an unreachable goal. Lower-score fallback tuning
          // cannot override a legal E/NA merely to convert an extra die.
          const plan=tuningPlan(s,m,goal);
          if(plan)offer({type:"tune",index:plan.card.index,id:plan.card.id,element:team[a].element},i===0?45:goal.skill==="E"?42:39,
            "目标"+goal.skill+"可达，还缺"+plan.needed+"枚元素骰；只调和一张后重新观察");
        }
      }
    }
    candidates.sort((x, y) => y.score - x.score);
    return candidates[0] || { type: "end", reason: "没有可支付且值得执行的动作，结束本轮" };
  }
  function bag(hand) {
    const out = {};
    for (const h of hand || []) out[h.id] = (out[h.id] || 0) + 1;
    return out;
  }
  function removedOne(before, after, id) {
    const b = bag(before), a = bag(after);
    return before.length === after.length + 1 && Object.keys({ ...b, ...a }).every(k => (b[k] || 0) - (a[k] || 0) === (k === id ? 1 : 0));
  }
  function indexedHand(hand) {
    if (!Array.isArray(hand) || !hand.every(handCardKnown)) throw new Error("手牌缓存身份不完整");
    return hand.map((h, index) => ({ ...h, index }));
  }
  // This is a plan, NOT evidence that an action happened. The host must prove
  // the count/effect before publishing a removal. New cards can insert anywhere.
  function handPlan(action, before) {
    const hand = indexedHand(before.hand);
    if (action.type === "probe" || action.type === "switch" || action.type === "skill" && !(action.who === 2 && action.skill === "E")) {
      return { mode: "unchanged", hand };
    }
    if (action.type === "tune" || action.type === "card" && byId[action.id] &&
        !["draw", "talent", "wedge","penance"].includes(action.id)) {
      if (!Number.isInteger(action.index) || hand[action.index]?.id !== action.id) throw new Error("手牌增量计划的目标索引/身份不一致");
      return { mode: "remove", hand: indexedHand(hand.filter((_, i) => i !== action.index)) };
    }
    // Candidate ordering only, never observed-count evidence. Actual boundary,
    // titles and action outcome still decide what can enter the hand cache.
    const expectedCount = action.type === "skill" && action.who === 2 && action.skill === "E" ?
      Math.min(10, hand.length + (hand.some(c => c.id === "wedge") ? -1 : 1)) :
      action.type === "card" && action.id === "draw" ? Math.min(10, hand.length + 1) :
      action.type === "card" && action.id === "penance" ? Math.max(0,Math.min(10,hand.length-(hand.some(h=>h.id==="wedge")?2:0))) :
      action.type === "card" && ["talent", "wedge"].includes(action.id) ? Math.max(0, hand.length - 1) : null;
    return { mode: "full", hand: null, expectedCount };
  }
  function verify(action, before, after, transition = false) {
    if(!action || !before || !after)return false;
    if (after.result) return true;
    if (singleConsumptionEvidence(action, before, after)) return true;
    if (action.type === "end") return after.turn === "enemy" || after.phase === "roll" || after.phase === "settlement";
    if (action.type === "switch") return after.active === action.target && after.active !== before.active;
    if (action.type === "skill") {
      if(transition || after.turn === "enemy")return true;
      const bc = before.characters?.[action.who], ac = after.characters?.[action.who];
      return !!bc && !!ac && !!after.dice && after.turn === "user" &&
        (total(after.dice) < total(before.dice) || known(ac.energy) && ac.energy !== bc.energy);
    }
    if (action.type === "tune") return after.turn === "user" && removedOne(before.hand, after.hand, action.id) &&
      total(before.dice) === total(after.dice) && (after.dice[action.element] || 0) === (before.dice[action.element] || 0) + 1;
    if (action.type === "card") {
      if (!byId[action.id]) return false;
      if (!after.hand) return false;
      if (action.id === "draw") return after.hand.length === Math.min(10, before.hand.length + 1);
      // Combat cards may generate/discard another card: require the selected card's count drop,
      // and a real combat effect, rather than assuming a drag succeeded.
      if (["talent","wedge","penance"].includes(action.id)) {
        return (bag(before.hand)[action.id] || 0) > (bag(after.hand)[action.id] || 0) &&
          (transition || total(after.dice) < total(before.dice));
      }
      if (!removedOne(before.hand, after.hand, action.id)) return false;
      if (action.id === "woven") return total(after.dice) === total(before.dice) + 1;
      if (action.id === "companion") return total(after.dice) === total(before.dice) && (after.dice.Omni || 0) > (before.dice.Omni || 0);
      if (action.id==="voltage")return after.characters.some((c,i)=>known(c.energy) && c.energy>before.characters[i].energy);
      if (["stars", "calx"].includes(action.id)) return after.characters[before.active].energy > before.characters[before.active].energy;
      if(action.id==="lost")return total(after.dice)===total(before.dice)+1 &&
        (after.dice.Omni||0)===(before.dice.Omni||0)+1 &&
        (after.characters[before.active].energy>before.characters[before.active].energy ||
          before.characters[before.active].energy===team[before.active].maxEnergy);
      if(action.id==="toss")return total(after.dice)===total(before.dice);
      if (["sweet", "hashbrown"].includes(action.id)) return after.characters[action.target].hp > before.characters[action.target].hp;
      return total(after.dice) === total(before.dice) - size(byId[action.id].cost);
    }
    return false;
  }
  // ONLY for a complete, stable native reread, never the projected removal list.
  // Learn the resulting resources without inventing a rule for their source.
  function verifyResynchronized(action, before, after, transition = false) {
    if (!legalState(after) || !before || !action) return false;
    if (verify(action, before, after, transition)) return true;
    const consumed = (bag(before.hand)[action.id] || 0) > (bag(after.hand)[action.id] || 0);
    if (!consumed) return false;
    if (action.type === "tune") return (after.dice[action.element] || 0) > (before.dice[action.element] || 0);
    if (action.type !== "card" || !byId[action.id]) return false;
    if(action.id==="voltage")return after.characters.some((c,i)=>known(c.energy) && c.energy>before.characters[i].energy);
    if (["stars", "calx"].includes(action.id)) return after.characters[before.active].energy > before.characters[before.active].energy;
    if(action.id==="lost" || action.id==="toss")return verify(action,before,after,transition);
    if (["sweet", "hashbrown"].includes(action.id)) return after.characters[action.target]?.hp > before.characters[action.target]?.hp;
    if (action.id === "woven") return (after.dice.Electro || 0) > (before.dice.Electro || 0);
    if (action.id === "companion") return (after.dice.Omni || 0) > (before.dice.Omni || 0);
    if (["talent", "wedge","penance"].includes(action.id)) return transition || total(after.dice) < total(before.dice);
    // Other supported cards have no independent visible status indicator.
    // Exact selected-card consumption is their proof, not a predicted dice cost.
    return true;
  }
  function actionKey(action) {
    return action.type + ":" + (action.id || (["skill","probe"].includes(action.type) ? action.who + ":" + action.skill : action.target));
  }
  function deferUncertain(m, action) {
    // Do not replay an outcome-unknown action in the same round. A food might
    // already have resolved, so conservatively reserve that target's food slot.
    const key = actionKey(action);
    if (!m.uncertainActions) m.uncertainActions = [];
    if (!m.uncertainActions.includes(key)) m.uncertainActions.push(key);
    if (action.type === "card" && byId[action.id]?.type === "food") m.food[action.target] = true;
  }
  function commit(m, action, before, after=null) {
    // Board layouts shrink after defeats. Count only complete known enemy
    // observations, and attribute a forced-card cast to its actual wearer.
    if(m.enemyAliveCount===null || m.enemyAliveCount===undefined)m.enemyAliveCount=enemyCount(before);
    const owner=action.type==="skill"?action.who:action.type==="card"&&["wedge","penance"].includes(action.id)?2:before.active;
    m.enemyLastActive=owner;
    if(after)noteEnemyDefeats(m,after,owner);
    if (action.type === "switch") { m.freeSwitch = false; m.fastSwitch = false; }
    if (action.type === "skill") {
      const who = action.who;
      m.used[who]++;
      if (who === 0 && action.skill === "Q") m.raidenBurst = true;
      if (who === 0 && action.skill === "E") m.eyeRound = m.round;
      if (who === 1 && action.skill === "Q") { m.colleiBurst = true; m.dendroRound = m.round; }
      if (who === 1 && action.skill === "E") m.dendroRound = m.round;
      if (who === 2 && action.skill === "E" && before.hand.some(h => h.id === "wedge")) m.keqingInfusedRound = m.round;
      if (action.skill === "NA" && m.normalDiscount[who] > 0) m.normalDiscount[who]--;
      if(action.skill==="Q" && m.artifactKinds?.[who]==="exile")m.exileUsedRound[who]=m.round;
      const base=action.skill==="Q"?(who===2?4:3):action.skill==="E"?3:null;
      if(base!==null && size(skillCost(who,action.skill,m,before))<base)m.blessingUsed++;
    }
    if (action.type !== "card" || !byId[action.id]) return;
    const a = before.active;
    if (action.id === "shift") m.freeSwitch = true;
    if (action.id === "fast") m.fastSwitch = true;
    if (byId[action.id].type === "food") m.food[action.target] = true;
    if (action.id === "smoked") m.normalDiscount[action.target] = 1;
    if (action.id === "mint") m.normalDiscount[action.target] = 3;
    if (["gambler","exile"].includes(action.id)) {
      m.artifacts[action.target]=action.id==="gambler";
      m.artifactKinds[action.target]=action.id;
    }
    if (byId[action.id].type === "weapon") m.weapons[action.target] = true;
    if (action.id === "talent") { m.talent = true; m.dendroRound = m.round; m.used[a]++; }
    if(action.id==="penance"){m.penance=true;m.used[2]++;if(before.hand.some(h=>h.id==="wedge"))m.keqingInfusedRound=m.round;}
    if(action.id==="edict"){m.legendUsed=true;m.immuneUntil[action.target]=m.round+1;}
    if(action.id==="lost")m.lostUsedRound=m.round;
    if (byId[action.id].type === "support") m.thundergrassSupport=action.id;
    // A forced switch from a card is not the manual switch action that consumes these discounts.
    if (action.id === "wedge") { m.keqingInfusedRound = m.round; m.used[2]++; }
  }
  function removalEffect(action, before, after) {
    // Independent native effect, not projected card consumption. Only common
    // observable effects qualify; a free status or mere cost prediction does not.
    if (!before.hand.length || after.turn !== "user" || after.active !== before.active) return false;
    if (action.type === "tune") return total(after.dice) === total(before.dice) &&
      (after.dice[action.element] || 0) === (before.dice[action.element] || 0) + 1;
    if (action.type !== "card" || !byId[action.id]) return false;
    if(action.id==="voltage")return after.characters.some((c,i)=>known(c.energy) && c.energy>before.characters[i].energy);
    if (["stars", "calx"].includes(action.id)) return after.characters[before.active].energy > before.characters[before.active].energy;
    if(action.id==="lost")return verify(action,before,{...after,hand:indexedHand(before.hand.filter(h=>h.index!==action.index))});
    if (["sweet", "hashbrown","edict"].includes(action.id)) return after.characters[action.target]?.hp > before.characters[action.target]?.hp;
    if (action.id === "woven") return total(after.dice) === total(before.dice) + 1 &&
      (after.dice.Electro || 0) === (before.dice.Electro || 0) + 1;
    if (action.id === "companion") return total(after.dice) === total(before.dice) && (after.dice.Omni || 0) > (before.dice.Omni || 0);
    return false;
  }
  function emptyHandEffect(action, before, after, transition) {
    if (before.hand.length !== 1 || after.turn !== "user") return false;
    if (singleConsumptionEvidence(action, before, after)) return true;
    if (removalEffect(action, before, after)) return true;
    if (action.type === "tune") return false;
    if (action.type === "skill" && action.who === 2 && action.skill === "E" && before.hand[0].id === "wedge") {
      return transition || total(after.dice) < total(before.dice);
    }
    if (action.type !== "card" || !byId[action.id] || action.id === "draw" || ["shift", "fast", "smoked"].includes(action.id)) return false;
    if (["voltage", "stars", "calx"].includes(action.id)) return after.characters[before.active].energy > before.characters[before.active].energy;
    if (["sweet", "hashbrown"].includes(action.id)) return after.characters[action.target].hp > before.characters[action.target].hp;
    if (action.id === "woven") return total(after.dice) === total(before.dice) + 1;
    if (action.id === "companion") return total(after.dice) === total(before.dice) && (after.dice.Omni || 0) > (before.dice.Omni || 0);
    return transition || total(after.dice) < total(before.dice);
  }
  function singleConsumptionEvidence(action, before, after) {
    const proof = after.handEvidence;
    if (after.phase !== "board" || after.turn !== "user" || before.hand?.length !== 1 ||
        Array.isArray(after.hand) && after.hand.length !== 0 || !["card","tune"].includes(action.type) ||
        !Number.isInteger(action.index) || before.hand[action.index]?.id !== action.id) return false;
    return proof?.kind === "native-empty-fan" && proof.stableReads >= 2 && proof.inputSent === true &&
      proof.sourceCount === 1 && proof.id === action.id && proof.index === action.index &&
      proof.target === (action.target ?? null) && proof.beforeKey === boardKey(before) &&
      handPlan(action, before).mode === "remove";
  }
  function blessingChoice(s,m) {
    const cs=s?.characters;
    // Normally choose the cheaper burst-chain support. Collei-only without
    // ready burst favours the two-elemental-skill branch instead.
    if(Array.isArray(cs) && alive(cs[1]) && !alive(cs[0]) && !alive(cs[2]) && cs[1].energy<2)return "sharpkernel";
    return "shatterbolt";
  }
  root.TCG = { team, cards, byId, norm, identify, observedCard, handCardKnown, characterName, total, size, payment, rerollPlan,
    known, alive, freshMemory, nextRound, OpeningFlow, freshActionBoard, skillCost, skillLegal, intent, survivorIntent, followupReachable, switchPreparationReachable, replacement, noteBoard, tuningPlan, legalState, choose, verify, commit, emptyHandEffect, diceOrder,
    indexedHand, handPlan, verifyResynchronized, actionKey, deferUncertain, removalEffect, blessingChoice,boardKey,burnableHand,
    actionRerollGoal,rerollCounter,enemyCount,gamblerRemaining };
})(globalThis);
