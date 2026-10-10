/* GPL-3.0. Generic accounting adapted from 雷柯刻0.4.6; new team rules.
 * Memory records confirmed own actions, not OCR of invisible statuses.
 * Projected resources/damage are search estimates; never publish them as observations. */
(function (root) {
  "use strict";
  const team = [
    {
      name: "伊安珊",
      element: "Electro",
      maxHp: 11,
      maxEnergy: 2,
      weapon: "pole",
      skills: { NA: "负重锥击", E: "电掣雷驰", Q: "力的三原理" },
    },
    {
      name: "嘉明",
      element: "Pyro",
      maxHp: 10,
      maxEnergy: 3,
      weapon: "claymore",
      skills: { NA: "刃爪悬星", E: "瑞兽登高楼", Q: "璨焰金猊舞" },
    },
    {
      name: "早柚",
      element: "Anemo",
      maxHp: 10,
      maxEnergy: 2,
      weapon: "claymore",
      skills: { NA: "忍刀·终末番", E: "呜呼流·风隐急进", Q: "呜呼流·影貉缭乱" },
    },
  ];
  const cards = [
    ["talent", "偷懒的新方法", { element: "Anemo", n: 3 }, "talent", 2],
    ["wolf", "狼的末路", { aligned: 3 }, "weapon", 2],
    ["moon", "贯月矢", { aligned: 3 }, "weapon", 2],
    ["gambler", "赌徒的耳环", { aligned: 1 }, "artifact", 2],
    ["gilded", "饰金之梦", { aligned: 3 }, "artifact", 2],
    ["troupe", "黄金剧团的奖赏", {}, "artifact", 2],
    ["heart", "灵光明烁之心", {}, "artifact", 1],
    ["opera", "欧庇克莱歌剧院", { aligned: 1 }, "support", 2],
    ["house", "黄金屋", {}, "support", 2],
    ["draw", "运筹帷幄", { aligned: 1 }, "draw", 2],
    ["lyre", "琴音之诗", {}, "recycle", 2],
    ["boar", "野猪公主", {}, "event", 2],
    ["garden", "旧时庭园", {}, "legend", 1],
    ["revel", "「狂欢节奏」", { any: 2 }, "draw", 2],
    ["shift", "换班时间", {}, "switch", 2],
    ["soup", "奇瑰之汤", { aligned: 1 }, "food", 1],
    ["sing", "纵声欢唱", { any: 3 }, "food", 1],
    // Optional starter-account substitutes, not required by the 30-card deck.
    ["sweet", "甜甜花酿鸡", {}, "food", 0],
    ["hashbrown", "蒙德土豆饼", { aligned: 1 }, "food", 0],
    ["lotus", "莲花酥", { aligned: 1 }, "food", 0],
    ["companion", "最好的伙伴！", { any: 2 }, "dice", 0],
    ["fast", "交给我吧！", {}, "switch", 0],
    ["lost", "本大爷还没有输！", {}, "recovery", 0],
    ["stars", "星天之兆", { any: 2 }, "energy", 0],
    ["tassel", "白缨枪", { aligned: 2 }, "weapon", 0],
    ["greatsword", "铁影阔剑", { aligned: 2 }, "weapon", 0],
  ].map(([id, name, cost, type, copies]) => ({ id, name, cost, type, copies }));
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const soupOptions = {
    "奇瑰之汤·疗愈": "healing",
    "奇瑰之汤·助佑": "discount",
    "奇瑰之汤·激愤": "fury",
    "奇瑰之汤·宁静": "shield",
    "奇瑰之汤·安神": "soothing",
    "奇瑰之汤·鼓舞": "maxhp",
  };
  // Native OCR may mix corner/square quotation marks (e.g. 狂欢节奏】).
  // These are typography, not card/skill identity. Never alter Hanzi or digits.
  const norm = (t) =>
    String(t || "")
      .replace(/[\s:：·!！。，,（）()「」『』【】\[\]“”"‘’']/g, "")
      .replace(/迴/g, "回");
  // User-confirmed native OCR spelling. Match the whole card title only;
  // do not replace Hanzi globally or accept arbitrary shortened names.
  const cardTitleAliases = { 运筹惟: "运筹帷幄" };
  function identify(t) {
    const title = norm(t),
      canonical = cardTitleAliases[title] || title;
    return cards.find((c) => norm(c.name) === canonical) || null;
  }
  function observedCard(text, index) {
    const name = String(text || "").trim(),
      t = norm(name),
      c = identify(name);
    if (c) return { index, id: c.id, name: c.name, supported: true };
    if (
      t.length < 2 ||
      t.length > 24 ||
      !/[\u3400-\u9fffA-Za-z]/.test(t) ||
      !/^[\u3400-\u9fffA-Za-z0-9「」『』\-—]+$/.test(t) ||
      /^(初始手牌|请选择要替换的手牌|确定|取消|出战角色|回合结束|元素调和)$/.test(t)
    )
      return null;
    return { index, id: "unsupported:" + t, name, supported: false };
  }
  function handCardKnown(h) {
    if (!h || typeof h.id !== "string") return false;
    if (byId[h.id]) return h.supported !== false;
    const p = observedCard(h.name, h.index);
    return h.supported === false && p?.id === h.id;
  }
  function indexedHand(h) {
    if (!Array.isArray(h) || !h.every(handCardKnown)) throw new Error("手牌缓存身份不完整");
    return h.map((c, index) => ({ ...c, index }));
  }
  const characterName = (t) => team.findIndex((c) => norm(c.name) === norm(t));
  const diceOrder = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo", "Omni"];
  const known = (n) => Number.isInteger(n) && n >= 0;
  const alive = (c) => !!c && c.dead === false && known(c.hp) && c.hp > 0;
  const total = (d) => Object.values(d || {}).reduce((a, b) => a + b, 0);
  const size = (c) => (c.n || 0) + (c.any || 0) + (c.aligned || 0);
  function payment(dice, cost, preserve = "Electro") {
    const list = Object.entries(dice || {}).flatMap(([e, n]) => Array(n).fill(e)),
      need = size(cost);
    if (need > list.length || list.length > 16) return null;
    if (!need) return { indices: [], remaining: { ...dice }, weight: 0 };
    let best = null;
    function visit(start, ids) {
      if (ids.length === need) {
        const selected = ids.map((i) => list[i]);
        if (cost.n && selected.filter((e) => e === cost.element || e === "Omni").length < cost.n)
          return;
        if (cost.aligned && new Set(selected.filter((e) => e !== "Omni")).size > 1) return;
        const weight = selected.reduce(
          (v, e) => v + (e === "Omni" ? 10 : e === preserve ? 6 : 1),
          0,
        );
        if (best && best.weight <= weight) return;
        const remaining = { ...dice };
        for (const e of selected) remaining[e]--;
        best = { indices: ids.slice(), remaining, weight };
        return;
      }
      for (let i = start; i <= list.length - need + ids.length; i++) visit(i + 1, ids.concat(i));
    }
    visit(0, []);
    return best;
  }
  const boardKey = (s) =>
    JSON.stringify([
      s.active,
      diceOrder.map((e) => s.dice?.[e] || 0),
      s.characters,
      (s.hand || []).map((h) => h.id),
      s.enemies,
    ]);
  const actionKey = (a) =>
    a.type +
    ":" +
    (a.id || (["skill", "probe"].includes(a.type) ? a.who + ":" + a.skill : a.target));
  function freshMemory() {
    return {
      round: 0,
      used: [0, 0, 0],
      food: [false, false, false],
      freeSwitch: false,
      fastSwitch: false,
      fastCharges: 0,
      singCharges: 0,
      weapons: [false, false, false],
      weaponKinds: [null, null, null],
      artifacts: [false, false, false],
      artifactKinds: [null, null, null],
      troupe: [0, 0, 0],
      moonRound: [-1, -1, -1],
      talent: false,
      legendUsed: false,
      openingDraws: 0,
      garden: false,
      lyre: 0,
      boar: 0,
      firstCard: true,
      houses: [],
      operas: [],
      supportSlots: 0,
      defeated: [false, false, false],
      defeatRound: -1,
      lostUsedRound: -1,
      gamblerUsed: [0, 0, 0],
      enemyAliveCount: null,
      enemyLastActive: null,
      lastActive: 0,
      iansanBurst: false,
      kineticEstimate: 0,
      nightsoulEstimate: 0,
      nightsoulPassive: 0,
      switchEstimate: 0,
      passiveHealEvidence: null,
      manchai: 0,
      gamingReturn: false,
      sayuSummon: 0,
      soupDiscount: [0, 0, 0],
      soupDamage: [0, 0, 0],
      extraMaxHp: [0, 0, 0],
      uncertainActions: [],
      costEvidence: null,
      probeKeys: [],
      thundergrassSupport: null,
      route: "接力轴",
      openingTarget: null,
    };
  }
  function nextRound(m) {
    // Only the last confirmed active slot is used for our own equipment estimate.
    for (let i = 0; i < 3; i++)
      if (m.artifactKinds[i] === "troupe" && !m.defeated[i] && m.lastActive !== i)
        m.troupe[i] = Math.min(2, m.troupe[i] + 1);
    m.round++;
    m.food = [false, false, false];
    m.soupDiscount = [0, 0, 0];
    m.soupDamage = [0, 0, 0];
    m.garden = false;
    m.lyre = 0;
    m.boar = 0;
    m.firstCard = true;
    m.uncertainActions = [];
    m.costEvidence = null;
    m.probeKeys = [];
    m.nightsoulPassive = 0;
    if (m.sayuSummon > 0) m.sayuSummon--;
  }
  class OpeningFlow {
    constructor(entry) {
      if (!["opening", "pick", "roll", "board"].includes(entry))
        throw new Error("请在起手、首次选人、首次掷骰或未行动的新开局牌桌启动");
      this.entry = entry;
      this.route = [entry];
      this.opened = false;
      this.picked = false;
      this.rolled = false;
      this.complete = false;
    }
    record(stage) {
      const p = { opening: "opened", pick: "picked", roll: "rolled" }[stage];
      if (!p || this.complete || this[p])
        throw new Error("开局阶段已确认或已结束，不重复执行：" + stage);
      this[p] = true;
      if (this.route[this.route.length - 1] !== stage) this.route.push(stage);
    }
    enterBoard(m) {
      if (this.complete) return null;
      if (!known(m.round) || m.round > 1) throw new Error("不接管中途对局");
      const seeded = m.round === 0;
      if (seeded) nextRound(m);
      this.complete = true;
      this.route.push("board");
      return {
        entry: this.entry,
        route: this.route.slice(),
        round: m.round,
        roundSeeded: seeded,
        midgameRestore: false,
      };
    }
  }
  function legalState(s) {
    return (
      !!s &&
      s.phase === "board" &&
      s.turn === "user" &&
      Array.isArray(s.characters) &&
      s.characters.length === 3 &&
      known(s.active) &&
      s.active < 3 &&
      alive(s.characters[s.active]) &&
      s.diceKnown === true &&
      s.dice &&
      Object.keys(s.dice).every((e) => diceOrder.includes(e)) &&
      Object.values(s.dice).every(known) &&
      total(s.dice) <= 16 &&
      Array.isArray(s.hand) &&
      s.hand.every(handCardKnown) &&
      s.characters.every(
        (c, i) =>
          c &&
          (c.dead === true ||
            (alive(c) &&
              typeof c.frozen === "boolean" &&
              known(c.energy) &&
              c.energy <= team[i].maxEnergy)),
      )
    );
  }
  function freshActionBoard(s) {
    return (
      !!s &&
      ["user", "enemy"].includes(s.turn) &&
      legalState({ ...s, turn: "user", hand: [] }) &&
      total(s.dice) === 8 &&
      s.characters.every(
        (c, i) =>
          c.hp === team[i].maxHp && c.energy === 0 && c.dead === false && c.frozen === false,
      )
    );
  }
  function switchCost(m) {
    return { any: m.freeSwitch || m.singCharges > 0 ? 0 : 1 };
  }
  function skillCost(who, skill, m, s = null) {
    const base =
      skill === "NA"
        ? { element: team[who].element, n: 1, any: 2 }
        : { element: team[who].element, n: 3 };
    let reduction = m.soupDiscount[who] || 0;
    if (skill === "E")
      reduction +=
        (m.moonRound[who] === m.round ? 2 : 0) +
        (m.troupe[who] || 0) +
        (who === 1 && m.manchai > 0 ? 1 : 0);
    // Deduct generic portions first. A discount cannot generate dice.
    if (base.any) {
      const n = Math.min(base.any, reduction);
      base.any -= n;
      reduction -= n;
    }
    base.n = Math.max(0, base.n - reduction);
    const e = m.costEvidence;
    if (
      s &&
      e?.source === "native-skill-preview" &&
      e.key === boardKey(s) &&
      e.who === who &&
      e.skill === skill &&
      known(e.n) &&
      e.n <= 3
    ) {
      return skill === "NA"
        ? { element: base.element, n: Math.min(1, e.n), any: Math.max(0, e.n - 1) }
        : { element: base.element, n: e.n };
    }
    return base;
  }
  function skillLegal(s, a, m) {
    const c = s.characters[a.who];
    return (
      s.active === a.who &&
      alive(c) &&
      c.frozen === false &&
      ["NA", "E", "Q"].includes(a.skill) &&
      (a.skill !== "Q" || c.energy >= team[a.who].maxEnergy) &&
      !!payment(s.dice, skillCost(a.who, a.skill, m, s), team[a.who].element)
    );
  }
  function weaponCompatible(id, who) {
    return ["moon", "tassel"].includes(id)
      ? who === 0
      : ["wolf", "greatsword"].includes(id)
        ? [1, 2].includes(who)
        : false;
  }
  function cardCost(id, target, m, s) {
    if (id === "talent") return skillCost(2, "E", m, s);
    const c = byId[id],
      base = { ...c.cost };
    let n = size(base),
      reduction = 0;
    // Golden House checks CURRENT cost, not the printed cost. Apply only
    // guaranteed eligibility: pending garden/lyre can make the condition false.
    if (["weapon", "artifact"].includes(c.type)) {
      reduction = (m.garden ? 2 : 0) + (c.type === "artifact" ? m.lyre : 0);
      n = Math.max(0, n - reduction);
      for (const h of m.houses) if (h.left > 0 && h.round !== m.round && n >= 3) n--;
      if (base.aligned !== undefined) base.aligned = n;
    }
    return base;
  }
  function cardLegal(s, a, m) {
    const c = byId[a.id];
    if (!c || s.hand[a.index]?.id !== a.id) return false;
    if (a.target !== null && (!known(a.target) || a.target > 2 || !alive(s.characters[a.target])))
      return false;
    if (c.type === "weapon" && !weaponCompatible(a.id, a.target)) return false;
    if (a.id === "talent" && (a.target !== 2 || s.active !== 2 || s.characters[2].frozen))
      return false;
    if (a.id === "lyre" && !m.artifactKinds[a.target]) return false;
    if (
      a.id === "garden" &&
      (m.legendUsed || (!m.weapons.some(Boolean) && !m.artifacts.some(Boolean)))
    )
      return false;
    if (c.type === "support" && m.supportSlots >= 4) return false; // no blind support-overwrite choice
    if (
      c.type === "food" &&
      (a.id === "sing" ? s.characters.some((x, i) => alive(x) && m.food[i]) : m.food[a.target])
    )
      return false;
    if (a.id === "lost" && (m.defeatRound !== m.round || m.lostUsedRound === m.round)) return false;
    return !!payment(s.dice, cardCost(a.id, a.target, m, s), team[s.active].element);
  }
  function cardRefund(a, m) {
    if (a.type !== "card" || !byId[a.id]) return {};
    const c = byId[a.id],
      refund = {};
    if (a.id === "gilded" && team[a.target]) refund[team[a.target].element] = 2;
    if (a.id === "companion") refund.Omni = 2;
    if (a.id === "lost") refund.Omni = 1;
    if (
      ["weapon", "artifact"].includes(c.type) &&
      m.boar > 0 &&
      (c.type === "weapon" ? m.weapons[a.target] : m.artifacts[a.target])
    )
      refund.Omni = (refund.Omni || 0) + 1;
    return refund;
  }
  const enemyCount = (s) =>
    Array.isArray(s?.enemies) &&
    s.enemies.length &&
    s.enemies.every((c) => c.dead === true || alive(c))
      ? s.enemies.filter(alive).length
      : null;
  const gamblerRemaining = (m, who) => Math.max(0, 3 - (m.gamblerUsed[who] || 0));
  function noteBoard(m, s) {
    if (!Array.isArray(s?.characters)) return;
    s.characters.forEach((c, i) => {
      if (c.dead === true && !m.defeated[i]) {
        m.defeated[i] = true;
        m.defeatRound = m.round;
        m.boar = Math.max(0, m.boar - (m.weapons[i] ? 1 : 0) - (m.artifacts[i] ? 1 : 0));
        m.weaponKinds[i] = null;
        m.weapons[i] = false;
        m.artifactKinds[i] = null;
        m.artifacts[i] = false;
        m.troupe[i] = 0;
        if (i === 0) m.nightsoulEstimate = 0;
        if (i === 1) m.gamingReturn = false;
      }
    });
    const n = enemyCount(s),
      owner = m.enemyLastActive;
    if (n !== null) {
      const lost = m.enemyAliveCount === null ? 0 : Math.max(0, m.enemyAliveCount - n);
      if (lost && m.artifactKinds[owner] === "gambler")
        m.gamblerUsed[owner] = Math.min(3, m.gamblerUsed[owner] + lost);
      m.enemyAliveCount = n;
    }
    if (known(s.active)) {
      m.lastActive = s.active;
      m.enemyLastActive = s.active;
    }
  }
  function passiveHealingEstimate(s, m, a) {
    // Pinned 7590c11 Iansan listens to samePlayer for preparing/switches.
    // Hidden night, usage and switch parity are not native observations. Even
    // a compatible HP gain is not proof that the passive caused that gain.
    const trigger =
      a?.type === "switch" ||
      (a?.type === "skill" && a.who === 2 && a.skill === "E") ||
      (a?.type === "card" && a.id === "talent");
    const none = { amount: 0, target: null, confidence: 0 };
    if (
      !trigger ||
      !alive(s?.characters?.[0]) ||
      m.nightsoulEstimate !== 2 ||
      m.nightsoulPassive >= 3
    )
      return none;
    const injured = s.characters
      .map((c, i) => ({ c, i, missing: team[i].maxHp + (m.extraMaxHp[i] || 0) - c.hp }))
      .filter((x) => alive(x.c) && x.missing > 0)
      .sort((a, b) => b.missing - a.missing)[0];
    if (!injured) return none;
    const status = m.passiveHealEvidence?.status;
    return {
      amount: 1,
      target: injured.i,
      confidence:
        status === "not-observed" || status === "uncertain"
          ? 0
          : status === "compatible"
            ? 0.25
            : 0.15,
    };
  }
  function confirmPassiveHealing(m, a, b, after) {
    const potential = passiveHealingEstimate(b, m, a),
      i = potential.target;
    if (
      !potential.amount ||
      !Array.isArray(after?.characters) ||
      after.characters.length !== 3 ||
      !after.characters.every(
        (c, j) => c.dead === true || (alive(c) && c.hp <= team[j].maxHp + (m.extraMaxHp[j] || 0)),
      )
    )
      return;
    const observedDelta = after.characters[i].hp - b.characters[i].hp;
    m.passiveHealEvidence = {
      status: observedDelta === 1 ? "compatible" : "not-observed",
      target: i,
      expectedUpperBound: 1,
      observedDelta,
      round: m.round,
      action: actionKey(a),
    };
  }
  function commit(m, a, b, after, options = {}) {
    // Search projections must never validate their own hidden-state estimates.
    if (!options.projected) confirmPassiveHealing(m, a, b, after);
    // A card ID alone never authorizes its effect: tuning the talent is NOT
    // playing it and must not advance Sayu's skill/passive/buff accounting.
    const target = a.target,
      who = a.type === "skill" ? a.who : a.type === "card" && a.id === "talent" ? 2 : null;
    function passiveEstimate() {
      if (m.nightsoulEstimate > 0 && m.nightsoulPassive < 3) {
        m.nightsoulPassive++;
        m.nightsoulEstimate = Math.min(2, m.nightsoulEstimate + 1);
      }
    }
    function hitEstimate() {
      if (m.kineticEstimate > 0) {
        if (m.nightsoulEstimate > 0) m.nightsoulEstimate--;
        else m.kineticEstimate--;
      }
    }
    function switchedEstimate() {
      if (m.nightsoulEstimate > 0) {
        m.switchEstimate++;
        if (m.switchEstimate % 2 === 0) passiveEstimate();
      }
    }
    if (a.type === "switch") {
      m.freeSwitch = false;
      if (m.singCharges > 0) m.singCharges--;
      if (m.fastCharges > 0) m.fastCharges--;
      m.fastSwitch = m.fastCharges > 0;
      switchedEstimate();
      if (target === 1 && m.gamingReturn) {
        hitEstimate();
        m.gamingReturn = false;
      }
    }
    if (who !== null) {
      const skill = a.id === "talent" ? "E" : a.skill;
      // Only the reduction still payable after other known discounts is spent.
      // These counters remain estimates; native payment is independently read.
      const other =
        (m.moonRound[who] === m.round ? 2 : 0) +
        (who === 1 && m.manchai > 0 ? 1 : 0) +
        (m.soupDiscount[who] || 0);
      const troupeSpent = skill === "E" ? Math.min(m.troupe[who] || 0, Math.max(0, 3 - other)) : 0;
      m.used[who]++;
      m.soupDiscount[who] = 0;
      if (who === 2 && skill === "E") passiveEstimate();
      hitEstimate();
      if (who === 2 && skill === "E") hitEstimate();
      if (m.soupDamage[who] > 0)
        m.soupDamage[who] = Math.max(0, m.soupDamage[who] - (who === 2 && skill === "E" ? 2 : 1));
      if (skill === "E") {
        m.moonRound[who] = -1;
        m.troupe[who] = Math.max(0, m.troupe[who] - troupeSpent);
        if (who === 0) {
          m.fastCharges++;
          m.fastSwitch = true;
          m.nightsoulEstimate = Math.min(2, m.nightsoulEstimate + 1);
        }
        if (who === 1) {
          m.gamingReturn = true;
          switchedEstimate();
          if (m.manchai > 0 && b.characters[1].hp < 5) m.manchai--;
        }
      }
      if (skill === "Q") {
        if (who === 0) {
          m.iansanBurst = true;
          m.kineticEstimate = 2;
          m.nightsoulEstimate = Math.min(2, m.nightsoulEstimate + 1);
        }
        if (who === 1) m.manchai = 2;
        if (who === 2) m.sayuSummon = 2;
      }
    }
    if (a.type === "card") {
      const c = byId[a.id],
        cost = cardCost(a.id, target, m, b),
        first = m.firstCard;
      m.firstCard = false;
      if (m.round === 1 && m.used.every((n) => n === 0) && ["sing", "draw", "revel"].includes(a.id))
        m.openingDraws = (m.openingDraws || 0) + 1;
      if (c.type === "weapon" || c.type === "artifact") {
        if (m.boar > 0 && (c.type === "weapon" ? m.weapons[target] : m.artifacts[target])) m.boar--;
        let n = Math.max(
          0,
          size(c.cost) - (m.garden ? 2 : 0) - (c.type === "artifact" ? m.lyre : 0),
        );
        for (const h of m.houses)
          if (h.left > 0 && h.round !== m.round && n >= 3) {
            h.left--;
            h.round = m.round;
            n--;
          }
        m.garden = false;
        if (c.type === "artifact") m.lyre = 0;
        if (c.type === "weapon") {
          m.weaponKinds[target] = a.id;
          m.weapons[target] = true;
          if (a.id === "moon") m.moonRound[target] = m.round;
        } else {
          m.artifactKinds[target] = a.id;
          m.artifacts[target] = true;
          m.troupe[target] = 0;
          // A new equipment instance receives its own usage pool.
          if (a.id === "gambler") m.gamblerUsed[target] = 0;
        }
      }
      if (a.id === "talent") m.talent = true;
      if (a.id === "house") {
        m.houses.push({ left: 2, round: -1 });
        m.supportSlots++;
      }
      if (a.id === "opera") {
        m.operas.push({ left: 3, round: -1 });
        m.supportSlots++;
      }
      if (a.id === "garden") {
        m.legendUsed = true;
        m.garden = true;
      }
      if (a.id === "lyre") {
        m.artifacts[target] = false;
        m.artifactKinds[target] = null;
        m.troupe[target] = 0;
        m.lyre = first ? 2 : 1;
      }
      if (a.id === "boar") m.boar = 2;
      if (a.id === "shift") m.freeSwitch = true;
      if (a.id === "fast") {
        m.fastCharges++;
        m.fastSwitch = true;
      }
      if (c.type === "food") {
        if (a.id === "sing") {
          m.food = safeFood(b);
          m.singCharges = 2;
        } else m.food[target] = true;
      }
      if (a.id === "lost") m.lostUsedRound = m.round;
      // Native selected soup effect is carried by the adapter, not random prediction.
      if (a.id === "soup" && after?.selectedSoup) {
        if (after.selectedSoup === "discount") m.soupDiscount[target] = 2;
        if (after.selectedSoup === "fury") m.soupDamage[target] = 2;
        if (after.selectedSoup === "maxhp") m.extraMaxHp[target]++;
      }
      void cost;
    }
    // Automatic combat can add draws, dice or switch again. Trust the reread.
    if (after?.characters) {
      if (who === 1 && a.skill === "E" && after.active === 1) m.gamingReturn = false;
      noteBoard(m, after);
    }
    m.costEvidence = null;
  }
  const safeFood = (b) => b.characters.map((c) => alive(c));
  function deferUncertain(m, a) {
    const k = actionKey(a);
    if (!m.uncertainActions.includes(k)) m.uncertainActions.push(k);
    m.passiveHealEvidence = { status: "uncertain" };
    if (a.type === "card") m.firstCard = false;
    if (a.type === "card" && a.id === "garden") m.legendUsed = true;
    if (a.type === "card" && byId[a.id]?.type === "food") {
      if (a.id === "sing") m.food = [true, true, true];
      else m.food[a.target] = true;
    }
    // Unknown resolution must not authorize cost cuts / equipment recovery.
    m.costEvidence = null;
    m.moonRound = [-1, -1, -1];
    m.troupe = [0, 0, 0];
    m.soupDiscount = [0, 0, 0];
    m.garden = false;
    m.lyre = 0;
    m.freeSwitch = false;
    m.singCharges = 0;
    m.manchai = 0;
    m.kineticEstimate = 0;
    m.nightsoulEstimate = 0;
    if (a.type === "card" && ["weapon", "artifact", "recycle"].includes(byId[a.id]?.type)) {
      m.weaponKinds[a.target] = null;
      m.weapons[a.target] = false;
      m.artifactKinds[a.target] = null;
      m.artifacts[a.target] = false;
    }
  }
  function rejectAction(m, a) {
    // Unlike an unknown outcome, a positive native rejection does not consume
    // food or remove an already confirmed equipment. Drop unproven fee cuts.
    const k = actionKey(a);
    if (!m.uncertainActions.includes(k)) m.uncertainActions.push(k);
    m.passiveHealEvidence = { status: "uncertain" };
    m.costEvidence = null;
    m.moonRound = [-1, -1, -1];
    m.troupe = [0, 0, 0];
    m.soupDiscount = [0, 0, 0];
    m.garden = false;
    m.lyre = 0;
    m.freeSwitch = false;
    m.singCharges = 0;
    m.manchai = 0;
  }
  const bag = (h) => {
    const r = {};
    for (const c of h || []) r[c.id] = (r[c.id] || 0) + 1;
    return r;
  };
  function removedOne(b, a, id) {
    const x = bag(b),
      y = bag(a);
    return (
      b.length === a.length + 1 &&
      Object.keys({ ...x, ...y }).every((k) => (x[k] || 0) - (y[k] || 0) === (k === id ? 1 : 0))
    );
  }
  function handPlan(a, b) {
    const h = indexedHand(b.hand);
    if (["switch", "skill", "probe"].includes(a.type)) return { mode: "unchanged", hand: h };
    if (a.type === "card" && ["draw", "revel", "sing", "lyre", "talent"].includes(a.id))
      return { mode: "full", expectedCount: null };
    if (a.type === "card" || a.type === "tune") {
      if (h[a.index]?.id !== a.id) throw new Error("手牌增量计划的目标索引/身份不一致");
      return { mode: "remove", hand: indexedHand(h.filter((_, i) => i !== a.index)) };
    }
    return { mode: "full", expectedCount: null };
  }
  function verify(a, b, after, transition = false) {
    if (!a || !b || !after) return false;
    if (after.result) return true;
    if (a.type === "end")
      return after.turn === "enemy" || ["roll", "settlement"].includes(after.phase);
    if (a.type === "switch")
      return (
        (after.active === a.target && after.active !== b.active) ||
        (a.target === 1 && transition && after.characters?.[1]?.energy !== b.characters[1].energy)
      );
    if (a.type === "skill")
      return (
        transition ||
        after.turn === "enemy" ||
        (!!after.dice &&
          Array.isArray(after.characters) &&
          (total(after.dice) < total(b.dice) ||
            (known(after.characters?.[a.who]?.energy) &&
              after.characters[a.who].energy !== b.characters[a.who].energy) ||
            (enemyCount(after) !== null &&
              enemyCount(b) !== null &&
              JSON.stringify(after.enemies.map((e) => e.hp)) !==
                JSON.stringify(b.enemies.map((e) => e.hp))) ||
            (a.who === 1 && a.skill === "E" && known(after.active) && after.active !== b.active)))
      );
    if (a.type === "tune")
      return (
        after.turn === "user" &&
        removedOne(b.hand, after.hand, a.id) &&
        total(b.dice) === total(after.dice) &&
        (after.dice[a.element] || 0) === (b.dice[a.element] || 0) + 1
      );
    if (a.type !== "card" || !byId[a.id] || !after.hand) return false;
    const consumed = (bag(b.hand)[a.id] || 0) > (bag(after.hand)[a.id] || 0);
    if (["draw", "revel", "sing"].includes(a.id))
      return consumed && after.hand.length === Math.min(10, b.hand.length + 1);
    if (a.id === "lyre") return consumed && after.hand.length === b.hand.length;
    if (a.id === "talent")
      return (
        consumed &&
        (transition ||
          total(after.dice) < total(b.dice) ||
          JSON.stringify(after.enemies) !== JSON.stringify(b.enemies))
      );
    return removedOne(b.hand, after.hand, a.id);
  }
  const verifyResynchronized = (a, b, c, t) => legalState(c) && verify(a, b, c, t);
  function removalEffect(a, b, c) {
    if (!b.hand?.length || c.turn !== "user") return false;
    if (a.type === "tune")
      return (
        total(c.dice) === total(b.dice) && (c.dice[a.element] || 0) === (b.dice[a.element] || 0) + 1
      );
    if (a.id === "sweet" || a.id === "hashbrown")
      return c.characters?.[a.target]?.hp > b.characters[a.target].hp;
    // Native artwork count proves a new support even if its die expense is
    // refunded in the same resolution. Never infer this from intended input.
    if (a.type === "card" && a.id === "opera") {
      const x = b.supportCounts?.opera,
        y = c.supportCounts?.opera;
      return Number.isInteger(x) && x >= 0 && x < 4 && Number.isInteger(y) && y === x + 1;
    }
    return false;
  }
  function emptyHandEffect(a, b, c, t) {
    if (b.hand.length !== 1 || c.turn !== "user") return false;
    // Positive native empty-fan evidence is scoped to this exact single-card
    // input, not zero guessed from an OCR failure or unchanged net expense.
    const proof = c.handEvidence;
    if (
      c.phase === "board" &&
      (!Array.isArray(c.hand) || c.hand.length === 0) &&
      proof?.kind === "native-empty-fan" &&
      proof.stableReads >= 2 &&
      proof.inputSent === true &&
      proof.sourceCount === 1 &&
      proof.id === a.id &&
      proof.index === a.index &&
      proof.target === (a.target ?? null) &&
      proof.beforeKey === boardKey(b) &&
      b.hand[a.index]?.id === a.id &&
      ["card", "tune"].includes(a.type) &&
      handPlan(a, b).mode === "remove"
    )
      return true;
    if (removalEffect(a, b, c)) return true;
    if (a.type !== "card" || ["draw", "revel", "lyre", "sing", "talent"].includes(a.id))
      return false;
    // A visible expense or soup selection can prove zero; a zero-cost status cannot.
    return total(c.dice) < total(b.dice) || (a.id === "soup" && !!c.selectedSoup);
  }
  function openingContext(context = {}) {
    const observed = enemyCount({ enemies: context?.enemies }),
      declared = context?.enemyCount;
    const n =
      observed !== null && observed > 0
        ? observed
        : known(declared) && declared > 0 && declared <= 6
          ? declared
          : null;
    const source =
      observed !== null && observed > 0 ? "observed" : n !== null ? "declared" : "unknown";
    const routes = ["伊嘉轴", "伊早轴", "狼末轴", "欢唱轴", "接力轴"];
    return {
      enemyCount: n,
      source,
      route:
        n !== null && n <= 2 ? "伊嘉轴" : routes.includes(context?.route) ? context.route : null,
    };
  }
  function keepOpening(id, hand = [], index = null, context = {}) {
    const ids = hand.map((h) => h.id);
    if (
      index !== null &&
      (byId[id]?.type === "weapon" ||
        ["talent", "troupe", "heart", "opera", "garden", "sing", "revel"].includes(id)) &&
      Math.min(...hand.filter((h) => h.id === id).map((h) => h.index)) !== index
    )
      return false;
    const n = openingContext(context).enemyCount;
    if (id === "talent" && n !== null && n <= 2) return false;
    if (["wolf", "moon", "talent", "troupe", "heart", "garden", "draw", "opera"].includes(id))
      return true;
    if (id === "house") return ids.some((x) => ["wolf", "moon", "gilded"].includes(x));
    if (id === "lyre") return ids.some((x) => ["troupe", "gilded"].includes(x));
    if (id === "sing" || id === "revel") return ids.includes("sing") && ids.includes("revel");
    return false;
  }
  function openingPlan(hand, original, context = {}) {
    if (
      !Array.isArray(hand) ||
      hand.length !== 5 ||
      !hand.every(handCardKnown) ||
      !hand.every((h, i) => h.index === i) ||
      !Array.isArray(original) ||
      original.length !== 5 ||
      !original.every((x) => typeof x === "boolean")
    )
      throw new Error("初始五张手牌或置换索引不完整");
    const replace = hand.map((h) =>
        h.supported ? !keepOpening(h.id, hand, h.index, context) : original[h.index],
      ),
      duplicateWeapons = hand
        .filter(
          (h) => byId[h.id]?.type === "weapon" && hand.find((x) => x.id === h.id).index !== h.index,
        )
        .map((h) => h.index);
    // Independent final-plan invariant, not a title-only duplicate check.
    if (duplicateWeapons.some((i) => !replace[i])) throw new Error("起手方案仍保留重复武器");
    return { replace, keep: hand.filter((h) => !replace[h.index]), duplicateWeapons };
  }
  function rerollPlan(items, m, context = m.openingContext || {}) {
    const opening = openingContext(context),
      planningRoute =
        opening.enemyCount !== null
          ? opening.enemyCount <= 2
            ? "伊嘉轴"
            : "接力轴"
          : opening.route || m.route;
    const living = [0, 1, 2].filter((i) => !m.defeated[i]);
    const firstTarget = living.includes(m.openingTarget) ? m.openingTarget : 0;
    const primary =
      m.round === 0
        ? team[firstTarget].element
        : team[living.includes(m.lastActive) ? m.lastActive : living[0] || 0].element;
    const secondary =
      m.round === 0 && firstTarget === 2
        ? null
        : primary === "Electro"
          ? planningRoute === "伊嘉轴" && living.includes(1)
            ? "Pyro"
            : living.includes(2)
              ? "Anemo"
              : living.includes(1)
                ? "Pyro"
                : null
          : living.includes(0) && !m.iansanBurst
            ? "Electro"
            : null;
    const primaryLimit =
      m.round === 0 && firstTarget === 0 && !(m.openingIds || []).includes("moon") ? 3 : 8;
    const indices = items.map((d, i) => (d.element === "Omni" ? i : -1)).filter((i) => i >= 0);
    indices.push(
      ...items
        .map((d, i) => (d.element === primary ? i : -1))
        .filter((i) => i >= 0)
        .slice(0, primaryLimit),
    );
    if (secondary)
      indices.push(
        ...items
          .map((d, i) => (d.element === secondary ? i : -1))
          .filter((i) => i >= 0)
          .slice(0, 3),
      );
    return {
      primary,
      secondary,
      elements: [primary, secondary, "Omni"].filter(Boolean),
      indices: indices.sort((a, b) => a - b),
    };
  }
  function rerollCounter(text) {
    const values = [];
    for (const x of norm(text).matchAll(
      /(?:还可重投([12])轮|(?:可重投次数|剩余重投次数|剩余次数)([12]))/g,
    ))
      values.push(Number(x[1] || x[2]));
    return values.length === 1 ? values[0] : null;
  }
  root.TCG = {
    team,
    cards,
    byId,
    soupOptions,
    norm,
    identify,
    observedCard,
    handCardKnown,
    indexedHand,
    characterName,
    diceOrder,
    known,
    alive,
    total,
    size,
    payment,
    boardKey,
    actionKey,
    freshMemory,
    nextRound,
    OpeningFlow,
    legalState,
    freshActionBoard,
    skillCost,
    skillLegal,
    switchCost,
    cardCost,
    cardLegal,
    cardRefund,
    weaponCompatible,
    enemyCount,
    gamblerRemaining,
    noteBoard,
    commit,
    passiveHealingEstimate,
    deferUncertain,
    rejectAction,
    handPlan,
    verify,
    verifyResynchronized,
    removalEffect,
    emptyHandEffect,
    openingContext,
    keepOpening,
    openingPlan,
    rerollPlan,
    rerollCounter,
  };
})(globalThis);
