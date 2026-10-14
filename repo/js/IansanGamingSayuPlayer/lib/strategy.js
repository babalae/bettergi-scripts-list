/* Bounded look-ahead, not an opponent simulator. All branches are estimates.
 * Replan after every actual action; random draws / choices terminate a branch. */
(function (root) {
  "use strict";
  const T = root.TCG,
    copy = (x) => JSON.parse(JSON.stringify(x));
  const enemy = (s) => (s.enemies || []).find((e) => T.alive(e) && e.active === true);
  const SEARCH_LIMITS = Object.freeze({
    depth: 5,
    width: 14,
    nodes: 1800,
    equipment: 450,
    funding: 450,
    boundary: 120,
  });
  const INPUT_EFFORT = Object.freeze({ end: 0, card: 0.1, tune: 0.08, switch: 0.12, skill: 0.035 });
  // Compare combat resolutions, not input depth. Sayu E occupies two slots
  // (initial hit + prepared hit); fast equipment/tuning occupies none.
  const PAYOFF_WINDOW = 3;
  // The played card leaves the hand before two draws enter (maximum ten).
  const drawBenefit = (count) => 0.325 * Math.max(0, Math.min(2, 11 - count));
  const openingDrawLimit = (m) => m.singCharges > 0 ? 3 : 2;

  function uniqueGoals(goals) {
    const seen = new Set();
    return goals.filter((goal) => {
      if (!goal || goal.who === undefined) return false;
      const key = goal.who + ":" + goal.skill;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function route(s, m) {
    const n = T.enemyCount(s),
      ids = s.hand.map((h) => h.id);
    if (n !== null && n <= 2 && T.alive(s.characters[1])) return "伊嘉轴";
    if (m.weaponKinds[2] === "wolf" || (ids.includes("wolf") && T.alive(s.characters[2])))
      return "狼末轴";
    if (m.weaponKinds[0] === "moon" || (ids.includes("moon") && T.alive(s.characters[0])))
      return "伊早轴";
    if (ids.includes("sing") && !m.food.some(Boolean)) return "欢唱轴";
    return "接力轴";
  }
  function outputRole(s, m) {
    const n = T.enemyCount(s);
    if (n !== null && n <= 2 && T.alive(s.characters[1]) && !s.characters[1].frozen) return 1;
    if (T.alive(s.characters[2]) && !s.characters[2].frozen) return 2;
    if (T.alive(s.characters[1]) && !s.characters[1].frozen) return 1;
    return 0;
  }
  function battleObjective(s, m) {
    const carry = outputRole(s, m), target = enemy(s), support = s.characters[0];
    // The five openings develop into the same role contract. A weapon drawn
    // after the handoff is not permission to restart the opening from scratch.
    const phase = m.used[1] + m.used[2] > 0 ? "output" : "develop";
    const supportReady = T.alive(support) && !support.frozen;
    return {
      phase,
      carry,
      developSupport: supportReady && !m.iansanBurst &&
        (phase === "develop" || carry === 0 || support.energy === 2 || supportDevelopmentReachable(s, m)),
      refreshAura: supportReady && target?.auraKnown === true && target.aura.length === 0,
      task: s.active !== 1 && m.gamingReturn ? "native-return" :
        phase === "develop" ? "setup-and-handoff" : "sustain-output",
    };
  }
  function openingCharacter(enemies, m) {
    // The guide's ordinary default is Iansan E -> fast Sayu relay. An
    // independently observed existing swirlable aura can make the setup
    // unnecessary; choose Sayu for FREE here, not after the paid-action start.
    const target = (enemies || []).find((e) => T.alive(e) && e.active === true);
    const count = T.enemyCount({ enemies });
    if (
      !(m.openingIds || []).includes("moon") &&
      count !== null &&
      count >= 3 &&
      target?.auraKnown === true &&
      ["Cryo", "Hydro", "Pyro", "Electro"].some((e) => target.aura?.includes(e))
    )
      return {
        target: 2,
        reason:
          "敌方开场已有正匹配的可扩散附着且未保留贯月矢，直接早柚首发，省去无行动伊安珊的付费切换",
      };
    return {
      target: 0,
      reason: (m.openingIds || []).includes("moon")
        ? "保留贯月矢，伊安珊先行动蓄爆"
        : "没有已确认的直接扩散开场，按攻略伊安珊首发挂元素再接力",
    };
  }
  function intent(s, m) {
    const a = s.active,
      c = s.characters[a],
      objective = battleObjective(s, m),
      carry = objective.carry;
    // Start with confirmed Electro application. Afterwards a charged support
    // can burst, but low HP is not a mandate to tank three actions.
    if (T.alive(s.characters[0]) && !s.characters[0].frozen) {
      if (m.used[0] === 0 && !(m.openingTarget === 2 && m.round === 1))
        return { type: "skill", who: 0, skill: "E" };
      if (
        objective.developSupport &&
        s.characters[0].hp >= 5 &&
        (m.weaponKinds[0] === "moon" || s.characters[0].energy === 2)
      )
        return { type: "skill", who: 0, skill: s.characters[0].energy === 2 ? "Q" : "E" };
      if (
        carry !== 0 &&
        objective.refreshAura &&
        m.round > 1 &&
        s.characters[0].hp >= 4
      )
        return {
          type: "skill",
          who: 0,
          skill: s.characters[0].energy === 2 && !m.iansanBurst ? "Q" : "E",
        };
    }
    if (a === 1 && m.gamingReturn && !c.frozen)
      return { type: "wait", reason: "等嘉明原生踏云献瑞结算" };
    return {
      type: "skill",
      who: carry,
      skill:
        carry === 1 && s.characters[1].energy === 3 && m.manchai === 0
          ? "Q"
          : carry === 2 &&
              s.characters.some((x) => T.alive(x) && x.hp <= 4) &&
              s.characters[2].energy === 2 &&
              m.sayuSummon === 0
            ? "Q"
            : "E",
    };
  }
  function pressureEstimate(m) {
    const e = m.hpLossEvidence;
    // An ordinary exposure floor, raised by recent measured loss. Neither
    // value claims to identify the next opponent action.
    return Math.max(3, e && m.round - e.round >= 0 && m.round - e.round <= 1
      ? Math.min(6, e.loss) : 0);
  }
  function coverTargets(s, m) {
    const current = s.characters[s.active], pressure = pressureEstimate(m);
    return s.characters.flatMap((c, i) =>
      i !== s.active && T.alive(c) && !c.frozen &&
      c.hp >= current.hp + 3 && c.hp > pressure ? [i] : []);
  }
  function exposureRisk(s, m, prior = 0) {
    if (!T.enemyCount(s) || !coverTargets(s, m).length) return 0;
    const who = s.active, pressure = pressureEstimate(m),
      hp = s.characters[who].hp - prior * pressure,
      risk = Math.max(0, Math.min(1, (pressure + 2 - hp) / 2)),
      value = 2.5 + (m.weaponKinds[who] === "wolf" ? 3 : m.weapons[who] ? 1 : 0) +
        (who === 2 && m.talent ? 1 : 0) + (who === 0 && m.nightsoulEstimate > 0 ? 1.5 : 0);
    // Preserve equipped output/support when a healthy cover exists. With no
    // cover, the guide's sacrifice/last-character relay remains available.
    return risk * value;
  }
  function preparedReliability(s, m, prior = 0) {
    // One opponent reply precedes the prepared hit. This allowance is only
    // a scoring heuristic; never write imagined damage into observed HP.
    const reserve = s.characters[s.active].hp - (prior + 1) * pressureEstimate(m);
    return reserve > pressureEstimate(m) ? 0.65 : reserve > 0 ? 0.35 : 0.15;
  }
  const DAMAGE_VALUE = 0.7, DEFEAT_VALUE = 1.8, DIE_VALUE = 0.18;
  const enemyHealth = s => (s.enemies || []).filter(T.alive).reduce((n, e) => n + e.hp, 0);
  function summonValue(s, m) {
    if (!m.sayuSummon || !T.enemyCount(s)) return 0;
    const injured = s.characters.flatMap((c, i) => T.alive(c) ? [{
      missing: Math.max(0, T.team[i].maxHp + (m.extraMaxHp[i] || 0) - c.hp),
      // A threatened active role may not reach the end phase. A healthy
      // injured teammate still benefits; no hypothetical switch is required.
      confidence: i === s.active && c.hp <= pressureEstimate(m) ? 0.25 : 1,
    }] : []).sort((a, b) => b.missing - a.missing);
    let value = 0;
    const shadow = copy(s);
    for (let i = 0; i < m.sayuSummon; i++) {
      if (!T.enemyCount(shadow)) break;
      const target = injured[0], heal = Math.min(2, target?.missing || 0);
      // First end phase and next round are different horizons. Neither can
      // prove an immediate kill/heal/refund or sustain a current continuation.
      // Only the first phase can use the currently known aura. Later opponent
      // actions may change it; don't multiply today's swirl by both usages.
      const r = reaction("Anemo", i === 0 && enemy(shadow)?.auraKnown ? enemy(shadow).aura : []),
        hit = applyDamage(shadow, { direct: 1 + r.bonus,
          reaction: r, element: "Anemo", elemental: true });
      value += (hit.dealt * DAMAGE_VALUE + hit.kills * DEFEAT_VALUE +
        heal * (target?.confidence || 0) * 0.65) * (i === 0 ? 0.55 : 0.3);
      if (target) target.missing -= heal;
      injured.sort((a, b) => b.missing - a.missing);
    }
    return value;
  }
  function summonBenefit(s, m) {
    // Replacing one existing usage adds the later phase, not another first heal.
    return summonValue(s, { ...m, sayuSummon: 2 }) - summonValue(s, m);
  }
  function effectValue(s, m, exposures = [0, 0, 0]) {
    const hp = enemyHealth(s), support = s.characters[0];
    if (!hp) return 0;
    // Kinetic: +2 for two usages. Night points extend these usages, but are
    // hidden estimates, so only a quarter of their potential is banked.
    const night = T.alive(support) ? (m.nightsoulEstimate || 0) * 0.25 : 0,
      kinetic = Math.min(hp, 2 * (m.kineticEstimate + (m.kineticEstimate ? night : 0))) *
        DAMAGE_VALUE * 0.55;
    let readyBurst = 0;
    if (m.weaponKinds[0] === "moon" && m.used[1] + m.used[2] === 0 &&
        T.alive(support) && !support.frozen && support.energy === 2 && !m.iansanBurst) {
      const reserve = support.hp - exposures[0] * pressureEstimate(m),
        confidence = reserve > pressureEstimate(m) ? 0.55 : reserve > 0 ? 0.25 : 0,
        activation = 3 * DIE_VALUE + 0.15 + INPUT_EFFORT.skill +
          (s.active === 0 ? 0 : T.size(T.switchCost(m)) * DIE_VALUE + 0.15 + INPUT_EFFORT.switch);
      // Ready energy unlocks a future Q. Value only its guaranteed two +2
      // usages, less its activation cost; future dice are NOT made available.
      readyBurst = Math.max(0, Math.min(hp, 4) * DAMAGE_VALUE - activation) * confidence;
    }
    return kinetic + readyBurst + summonValue(s, m);
  }
  function outputProtectionValue(s, m, who = s.active) {
    const local = { ...m, kineticEstimate: 0 }, e = damageEstimate(s, local, who, "E"),
      second = e.prepared || damageEstimate(s, local, who, "NA").direct;
    return Math.min(enemyHealth(s), e.direct + second) * DAMAGE_VALUE +
      (who === 2 && m.talent ? 0.65 : 0);
  }
  function roundBoundaryRisk(s, m) {
    if (!T.enemyCount(s) || activeOutputReachable(s, m)) return 0;
    const c = s.characters[s.active], pressure = pressureEstimate(m),
      reserve = c.hp - 2 * pressure,
      risk = Math.max(0, Math.min(1, (pressure + 2 - reserve) / 2));
    // End phase + next opener, not a claimed damage amount. Existing equipment
    // determines how much output is at stake; no simulated HP is published.
    return risk * outputProtectionValue(s, m) * 0.35;
  }
  function endCoverTargets(s, m) {
    if (!T.payment(s.dice, T.switchCost(m)) ||
        activeOutputReachable(s, m) || roundBoundaryRisk(s, m) === 0) return [];
    return s.characters.flatMap((c, i) => i !== s.active && T.alive(c) && !c.frozen &&
      c.hp > s.characters[s.active].hp && c.hp > pressureEstimate(m) ? [i] : []);
  }
  function followupReachable(s, m, g) {
    if (!g || !T.alive(s.characters[g.who]) || s.characters[g.who].frozen ||
        m.uncertainActions.includes(T.actionKey({ type: "skill", ...g }))) return false;
    let dice = s.dice;
    if (g.who !== s.active) {
      // Use the same estimated switch payment as simulate. A different
      // preserved element can invent a followup that loses its only die.
      const p = T.payment(dice, T.switchCost(m), T.team[s.active].element);
      if (!p) return false;
      dice = p.remaining;
    }
    const local = { ...s, active: g.who, dice };
    return T.skillLegal(local, g, m) || !!tuningPlan(local, m, g);
  }
  function activeOutputReachable(s, m) {
    return ["E", "Q", "NA"].some((skill) => followupReachable(s, m, { who: s.active, skill }));
  }
  function retreatNeeded(s, m, target) {
    // Cover is a task only at critical exposure or after usable output is
    // exhausted. More HP alone must not interrupt a funded on-field action.
    return exposureRisk(s, m) > 0 && coverTargets(s, m).includes(target) &&
      (s.characters[s.active].hp <= pressureEstimate(m) || !activeOutputReachable(s, m));
  }
  function burnableHand(s, m) {
    const carry = outputRole(s, m),
      values = {
        wolf: m.weaponKinds[carry] === "wolf" ? 15 : 95,
        moon: m.weaponKinds[0] ? 25 : 85,
        talent: m.talent ? 35 : 90,
        gambler: 70,
        gilded: 60,
        troupe: 45,
        heart: 30,
        opera: 55,
        house: 40,
        garden: m.legendUsed ? 0 : 95,
        lyre: 60,
        boar: 35,
        revel: 50,
        draw: 45,
        shift: 25,
        sing: 40,
        soup: s.characters[s.active].hp <= 4 ? 90 : 40,
      };
    return s.hand
      .filter(T.handCardKnown)
      .filter((h) => !m.uncertainActions.includes(T.actionKey({ type: "tune", id: h.id })))
      .slice()
      .sort((a, b) => (values[a.id] ?? 15) - (values[b.id] ?? 15));
  }
  function tuningPlan(s, m, g) {
    if (
      !g ||
      g.who !== s.active ||
      s.characters[g.who].frozen ||
      (g.skill === "Q" && s.characters[g.who].energy < T.team[g.who].maxEnergy)
    )
      return null;
    const cost = T.skillCost(g.who, g.skill, m, s),
      element = T.team[g.who].element;
    if (T.total(s.dice) < T.size(cost) || T.payment(s.dice, cost, element)) return null;
    const needed = Math.max(0, (cost.n || 0) - (s.dice[element] || 0) - (s.dice.Omni || 0)),
      cards = burnableHand(s, m),
      bad = T.total(s.dice) - (s.dice[element] || 0) - (s.dice.Omni || 0);
    if (!needed || needed > bad || needed > cards.length) return null;
    return { card: cards[0], needed, goal: g };
  }
  function reaction(element, aura = []) {
    const pair = (a, b) =>
      (element === a && aura.includes(b)) || (element === b && aura.includes(a));
    const swirled =
      element === "Anemo"
        ? ["Cryo", "Hydro", "Pyro", "Electro"].find((e) => aura.includes(e))
        : null;
    if (swirled) return { name: "swirl", bonus: 0, spread: swirled, consumed: swirled };
    if (pair("Pyro", "Hydro") || pair("Pyro", "Cryo"))
      return {
        name: pair("Pyro", "Hydro") ? "vaporize" : "melt",
        bonus: 2,
        consumed: element === "Pyro" ? (aura.includes("Hydro") ? "Hydro" : "Cryo") : "Pyro",
      };
    if (pair("Electro", "Pyro"))
      return {
        name: "overload",
        bonus: 2,
        consumed: element === "Electro" ? "Pyro" : "Electro",
        forceSwitch: true,
      };
    if (pair("Electro", "Hydro") || pair("Electro", "Cryo"))
      return {
        name: pair("Electro", "Hydro") ? "charged" : "superconduct",
        bonus: 1,
        piercing: 1,
        consumed: element === "Electro" ? (aura.includes("Hydro") ? "Hydro" : "Cryo") : "Electro",
      };
    if (pair("Hydro", "Cryo"))
      return { name: "freeze", bonus: 1, consumed: element === "Hydro" ? "Cryo" : "Hydro" };
    if (aura.includes("Dendro") && ["Pyro", "Hydro", "Electro"].includes(element))
      return { name: "dendro", bonus: 1, consumed: "Dendro", futureUnknown: true };
    return { name: null, bonus: 0 };
  }
  function damageEstimate(s, m, who, skill) {
    const e = enemy(s),
      element = skill === "NA" ? "Physical" : T.team[who].element,
      wolf = m.weaponKinds[who] === "wolf";
    // Pinned 7590c11 Q base is 2. Both native 7 -> 4 samples equipped
    // Wolf: base 2 + weapon 1, not naked base 3 plus another weapon bonus.
    // The native return is a separate 2-Pyro plunge, never another burst.
    const base = who === 0 ? 2 : who === 1 ? (skill === "E" ? 1 : 2) : skill === "NA" ? 2 : 1;
    const r = reaction(element, e?.auraKnown === true ? e.aura : []),
      elemental = element !== "Physical";
    const weapon = m.weapons[who] ? (wolf && e?.hp <= 6 ? 3 : 1) : 0,
      skillBonus = who === 1 && skill === "E" && m.manchai > 0 ? 1 : 0,
      buff = m.kineticEstimate > 0 ? 2 : 0,
      preparedBuff = m.kineticEstimate > 1 ||
        (m.kineticEstimate > 0 && m.nightsoulEstimate > 0) ? 2 : 0,
      soup = m.soupDamage[who] > 0 ? 1 : 0;
    const direct = base + weapon + skillBonus + buff + soup + r.bonus;
    const preparedElement = r.spread || "Anemo";
    const prepared =
      who === 2 && skill === "E"
        ? 2 +
          (m.weapons[who] ? (wolf && e?.hp - direct <= 6 ? 3 : 1) : 0) +
          preparedBuff +
          (m.soupDamage[who] > 1 ? 1 : 0)
        : 0;
    const splash =
      r.spread || r.piercing ? (s.enemies || []).filter((x) => T.alive(x) && x !== e).length : 0;
    return {
      base,
      weapon,
      skillBonus,
      buff,
      soup,
      direct,
      prepared,
      preparedBuff,
      preparedElement,
      splash,
      swirl: !!r.spread,
      overload: !!r.forceSwitch,
      elemental,
      element,
      reaction: r,
      target: e,
    };
  }
  function applyDamage(next, d) {
    const e = enemy(next);
    if (!e) return { dealt: d.direct * 0.5, kills: 0 };
    let dealt = Math.min(e.hp, d.direct);
    e.hp = Math.max(0, e.hp - d.direct);
    const backgrounds = next.enemies.filter((x) => x !== e && T.alive(x));
    for (const x of backgrounds) {
      if (d.reaction.piercing) {
        dealt += Math.min(x.hp, 1);
        x.hp = Math.max(0, x.hp - 1);
      }
      if (d.reaction.spread) {
        const r = reaction(d.reaction.spread, x.auraKnown ? x.aura : []),
          hit = 1 + r.bonus;
        dealt += Math.min(x.hp, hit);
        x.hp = Math.max(0, x.hp - hit);
        // A background secondary reaction can affect other cards. Stop the
        // branch rather than pretend it is a full recursive reaction engine.
        if (r.name) x.auraKnown = false;
        else {
          x.aura = [d.reaction.spread];
          x.auraKnown = true;
        }
      }
    }
    if (d.elemental) {
      if (d.reaction.consumed) {
        e.aura = (e.aura || []).filter((x) => x !== d.reaction.consumed);
        e.auraKnown = true;
      } else if (d.element !== "Anemo" && e.auraKnown) {
        e.aura = [d.element];
        e.auraKnown = true;
      }
    }
    let kills = 0;
    for (const x of next.enemies)
      if (x.hp === 0 && x.dead === false) {
        x.dead = true;
        kills++;
      }
    const currentIndex = next.enemies.indexOf(e);
    if (e.dead || d.reaction.forceSwitch) {
      const survivor = next.enemies
        .slice(currentIndex + 1)
        .concat(next.enemies.slice(0, currentIndex + 1))
        .find(T.alive);
      if (survivor) {
        next.enemies.forEach((x) => (x.active = false));
        survivor.active = true;
      }
    }
    return { dealt, kills };
  }
  function passiveHealing(s, m, a) {
    const potential = T.passiveHealingEstimate(s, m, a);
    // Potential value only. Replanning always uses actual reread HP; hidden
    // global switch parity must not manufacture survival or pay for a branch.
    return potential.amount * potential.confidence;
  }
  function soupDiscountReachable(s, m, target = s?.active) {
    if (!s || target !== s.active || !T.alive(s.characters[target]) || s.characters[target].frozen)
      return false;
    const future = copy(m);
    future.soupDiscount[target] = 2;
    return ["NA", "E", "Q"].some(
      (skill) =>
        T.skillLegal(s, { who: target, skill }, future) ||
        !!tuningPlan(s, future, { who: target, skill }),
    );
  }
  function actionCost(a, s, m) {
    return a.type === "skill"
      ? T.skillCost(a.who, a.skill, m, s)
      : a.type === "switch"
        ? T.switchCost(m)
        : a.type === "card"
          ? T.cardCost(a.id, a.target, m, s)
          : {};
  }
  function equipmentWanted(s, m, id, target) {
    const def = T.byId[id],
      carry = outputRole(s, m);
    if (!T.alive(s.characters[target])) return false;
    if (def?.type === "weapon") {
      return (
        T.weaponCompatible(id, target) &&
        m.weaponKinds[target] !== id &&
        s.characters[target].hp >= 4 &&
        (target === 0 || target === carry) &&
        !(id === "moon" && (m.weapons[0] ||
          (!battleObjective(s, m).developSupport && carry !== 0)))
      );
    }
    if (def?.type !== "artifact") return false;
    if (m.artifactKinds[target] === id && id !== "gilded") return false;
    if (id === "troupe" && target === s.active && m.artifacts[target]) return false;
    if (id === "gambler" && (target !== s.active || !enemy(s) || enemy(s).hp > 8)) return false;
    if ((id === "heart" && target !== s.active) || (id === "gilded" && target !== carry))
      return false;
    return true;
  }
  function setupEquipmentReachable(s, m, setup) {
    const future = copy(m);
    if (setup === "house") future.houses.push({ left: 2, round: -1 });
    if (setup === "garden") future.garden = true;
    for (const h of s.hand)
      for (let target = 0; target < 3; target++) {
        if (!equipmentWanted(s, m, h.id, target)) continue;
        const before = T.size(T.cardCost(h.id, target, m, s)),
          after = T.size(T.cardCost(h.id, target, future, s));
        if (
          after < before &&
          T.cardLegal(s, { type: "card", id: h.id, index: h.index, target }, future)
        )
          return true;
      }
    return false;
  }
  function enumerate(s, m) {
    const out = [],
      a = s.active,
      c = s.characters[a],
      wanted = intent(s, m),
      carry = outputRole(s, m),
      n = T.total(s.dice);
    const covers = coverTargets(s, m).filter((target) => retreatNeeded(s, m, target))
      .concat(endCoverTargets(s, m));
    const add = (x) => {
      if (!m.uncertainActions.includes(T.actionKey(x))) out.push(x);
    };
    for (const skill of ["E", "Q", "NA"])
      if (T.skillLegal(s, { who: a, skill }, m)) add({ type: "skill", who: a, skill });
    for (let target = 0; target < 3; target++)
      if (
        target !== a &&
        T.alive(s.characters[target]) &&
        !s.characters[target].frozen &&
        T.payment(s.dice, T.switchCost(m), T.team[target].element) &&
        (["E", "Q", "NA"].some((skill) => followupReachable(s, m, { who: target, skill })) ||
          (target === 1 && m.gamingReturn) || covers.includes(target))
      )
        add({ type: "switch", target });
    for (const h of s.hand) {
      const def = T.byId[h.id];
      if (!def) continue;
      let targets = [null];
      if (def.type === "weapon" || def.type === "artifact" || h.id === "lyre") targets = [0, 1, 2];
      if (def.type === "talent") targets = [2];
      if (def.type === "food" && h.id !== "sing") targets = [a];
      for (const target of targets) {
        const x = { type: "card", id: h.id, index: h.index, target };
        if (!T.cardLegal(s, x, m)) continue;
        if (["weapon", "artifact"].includes(def.type) && !equipmentWanted(s, m, h.id, target))
          continue;
        if (
          h.id === "lyre" &&
          (!T.byId[m.artifactKinds[target]] ||
            (m.artifactKinds[target] === "gambler" &&
              T.gamblerRemaining(m, target) > 0 &&
              enemy(s)?.hp <= 6))
        )
          continue;
        if (
          h.id === "boar" &&
          (m.boar > 0 ||
            !s.hand.some(
              (y) =>
                ["weapon", "artifact"].includes(T.byId[y.id]?.type) &&
                [0, 1, 2].some(
                  (target) =>
                    equipmentWanted(s, m, y.id, target) &&
                    (T.byId[y.id].type === "weapon" ? m.weapons[target] : m.artifacts[target]),
                ),
            ))
        )
          continue;
        if (h.id === "garden" && (m.garden || !setupEquipmentReachable(s, m, "garden"))) continue;
        if (h.id === "shift" && (m.freeSwitch || !out.some((y) => y.type === "switch"))) continue;
        if (h.id === "fast" && (m.fastSwitch || !out.some((y) => y.type === "switch"))) continue;
        if (h.id === "sing" && (m.singCharges > 0 || n < 6 || s.hand.length > 7)) continue;
        if (
          ["sing", "draw", "revel"].includes(h.id) &&
          m.round === 1 &&
          m.used.every((n) => n === 0) &&
          (m.openingRevel || (m.openingDraws || 0) >= openingDrawLimit(m))
        )
          continue;
        if (h.id === "revel" && s.hand.length > 8)
          continue;
        if (h.id === "opera" && (m.operas.length >= 2 || n < 2 || m.round > 4)) continue;
        if (h.id === "house" && (m.houses.length >= 2 || !setupEquipmentReachable(s, m, "house")))
          continue;
        if (
          (h.id === "sweet" && c.hp >= T.team[a].maxHp) ||
          (h.id === "hashbrown" && c.hp > T.team[a].maxHp - 2) ||
          (h.id === "lotus" && c.hp > 5)
        )
          continue;
        if (h.id === "soup" && c.hp > T.team[a].maxHp - 2) {
          const p = T.payment(s.dice, T.cardCost("soup", a, m, s), T.team[a].element);
          if (!p || !soupDiscountReachable({ ...s, dice: p.remaining }, m, a)) continue;
        }
        if (h.id === "stars" && (c.energy >= T.team[a].maxEnergy || n < 5)) continue;
        if (
          h.id === "companion" &&
          ["E", "Q"].some((skill) => T.skillLegal(s, { who: a, skill }, m))
        )
          continue;
        add(x);
      }
    }
    for (const g of [wanted, ...["Q", "E", "NA"].map((skill) => ({ who: a, skill }))]) {
      const p = tuningPlan(s, m, g);
      if (p) {
        add({
          type: "tune",
          id: p.card.id,
          index: p.card.index,
          element: T.team[a].element,
          goal: g.skill,
        });
        break;
      }
    }
    add({ type: "end" });
    return out;
  }
  function simulate(s, m, a) {
    const next = copy(s),
      mem = copy(m),
      pay = T.payment(s.dice, actionCost(a, s, m), T.team[s.active].element);
    if (!pay) return null;
    next.dice = pay.remaining;
    let benefit = 0,
      prepared = 0,
      deferred = 0,
      boundary = null,
      unknownDraw = false,
      combat = false,
      leaf = false;
    if (a.type === "end") {
      // End-phase is delayed. Value the existing summon without fabricating
      // healing/HP/defeats now or using it to pay for another action.
      // The new summon was already valued at its burst node. Do not reward
      // ending again for the same future heal; existing summon value is common
      // to every candidate and cannot fund a hypothetical current action.
      return {
        state: next,
        memory: mem,
        benefit: 0,
        leaf: true,
        combat: false,
        delayed: "end-phase-summon",
      };
    }
    const active = next.characters[s.active];
    if (a.type === "tune") {
      const bad = T.diceOrder.find((e) => e !== a.element && e !== "Omni" && next.dice[e] > 0);
      if (!bad) return null;
      next.dice[bad]--;
      next.dice[a.element] = (next.dice[a.element] || 0) + 1;
      benefit = -0.45;
    }
    if (a.type === "switch") {
      next.active = a.target;
      combat = !m.fastSwitch;
      benefit = -0.15 + (retreatNeeded(s, m, a.target) ? 0.8 : 0);
      if (endCoverTargets(s, m).includes(a.target))
        benefit += Math.max(0, roundBoundaryRisk(s, m) - roundBoundaryRisk(next, mem));
      benefit += passiveHealing(s, m, a) * 0.65;
      if (a.target === 1 && m.gamingReturn) {
        const d = damageEstimate(next, m, 1, "P");
        const hit = applyDamage(next, d);
        benefit += hit.dealt * 0.7 + hit.kills * 1.8;
        next.characters[1].energy = Math.min(3, next.characters[1].energy + 1);
        leaf = true; // Native automatic plunge owns the next combat timing.
      }
    }
    if (a.type === "card") {
      const c = T.byId[a.id];
      next.hand = T.indexedHand(next.hand.filter((_, i) => i !== a.index));
      // Equipment is paid for and credited through realised subsequent damage,
      // payment or refund. Do not reward the same weapon once at entry and
      // again on every attack, nor credit moving a free Heart as engine profit.
      if (a.id === "gilded")
        next.dice[T.team[a.target].element] = (next.dice[T.team[a.target].element] || 0) + 2;
      if (
        ["weapon", "artifact"].includes(c.type) &&
        m.boar > 0 &&
        (c.type === "weapon" ? m.weapons[a.target] : m.artifacts[a.target])
      ) {
        next.dice.Omni = (next.dice.Omni || 0) + 1;
      }
      if (a.id === "lyre") {
        const returned = T.byId[m.artifactKinds[a.target]];
        next.hand.push({
          index: next.hand.length,
          id: returned.id,
          name: returned.name,
          supported: true,
        });
      }
      if (a.id === "companion") next.dice.Omni = (next.dice.Omni || 0) + 2;
      if (a.id === "lost") {
        next.dice.Omni = (next.dice.Omni || 0) + 1;
        active.energy = Math.min(T.team[s.active].maxEnergy, active.energy + 1);
        benefit = 0.5;
      }
      if (a.id === "stars") {
        active.energy++;
        benefit = 0.2;
      }
      if (a.id === "sweet" || a.id === "hashbrown") {
        const heal = Math.min(
          T.team[a.target].maxHp - next.characters[a.target].hp,
          a.id === "sweet" ? 1 : 2,
        );
        next.characters[a.target].hp += heal;
        benefit = heal * (active.hp <= 4 ? 1 : 0.25);
      }
      if (a.id === "lotus") benefit = active.hp <= 3 ? 1.4 : 0.6;
      if (["draw", "revel", "sing", "soup"].includes(a.id)) {
        // Do not plan with unknown future cards or a favourable random soup.
        // Capacity is real; unknown identities cannot finance a later action.
        leaf = true;
        benefit =
          a.id === "draw"
            ? drawBenefit(s.hand.length)
            : a.id === "sing"
              ? 1.1
              : a.id === "soup"
                ? active.hp <= 4
                  ? 1
                  : 0.25
                : 0.55;
        if (a.id === "revel") {
          const counts = next.hand.reduce((r, h) => {
            const type = T.byId[h.id]?.type;
            if (type) r[type] = (r[type] || 0) + 1;
            return r;
          }, {});
          const refund = (counts.weapon > 1 ? 1 : 0) + (counts.artifact > 1 ? 1 : 0);
          next.dice.Omni = (next.dice.Omni || 0) + refund;
        }
      }
    }
    if (a.type === "skill" || (a.type === "card" && a.id === "talent")) {
      const who = a.id === "talent" ? 2 : a.who,
        skill = a.id === "talent" ? "E" : a.skill,
        d = damageEstimate(s, m, who, skill),
        e = enemy(next);
      const original = enemy(s),
        n = T.enemyCount(s),
        carry = outputRole(s, m);
      combat = true;
      const healing = who === 2 && skill === "E" ? passiveHealing(s, m, a) : 0;
      const { dealt, kills } = applyDamage(next, d);
      if (d.prepared) {
        const future = enemy(next),
          r = reaction(d.preparedElement, future?.auraKnown ? future.aura : []);
        // Opponent gets an action between hits. No instant prepared kill,
        // Gambler refund or subsequent free manual E in this projected node.
        const shadow = copy(next),
          weapon = m.weapons[who] ? (m.weaponKinds[who] === "wolf" && future?.hp <= 6 ? 3 : 1) : 0,
          direct = 2 + weapon + d.preparedBuff + (m.soupDamage[who] > 1 ? 1 : 0) + r.bonus,
          hit = future ? applyDamage(shadow, { direct, reaction: r,
            element: d.preparedElement, elemental: true }) : { dealt: 0, kills: 0 };
        prepared = hit.dealt * DAMAGE_VALUE + hit.kills * DEFEAT_VALUE;
        boundary = { kind: "prepared", state: shadow };
        leaf = true;
      }
      if (kills && m.artifactKinds[who] === "gambler")
        next.dice.Omni = (next.dice.Omni || 0) + 2 * Math.min(kills, T.gamblerRemaining(m, who));
      benefit =
        dealt * 0.7 +
        kills * 1.8 +
        healing * 0.65 +
        (who === carry && skill === "E" ? 0.4 : 0);
      if (a.id === "talent") benefit += m.talent ? 0.25 : 1.1;
      if (
        (d.swirl && (m.talent || a.id === "talent")) ||
        (m.artifactKinds[who] === "gilded" && (d.swirl || d.overload))
      ) {
        // Unknown draw identities must not become future playable cards.
        leaf = true;
        unknownDraw = true;
        benefit += 0.6;
      }
      if (who === 0 && skill === "E" && m.used[0] === 0) benefit += 2;
      // Iansan Q is valued through the remaining Kinetic effect ledger, not
      // an entry bonus counted again when the subsequent skills deal damage.
      if (who === 1 && skill === "Q" && m.manchai === 0) benefit += 2;
      if (who === 2 && skill === "Q") deferred = summonBenefit(s, m);
      if (who === 2 && skill === "E" && original?.auraKnown && original.aura.length === 0 && n >= 3)
        benefit -= 0.9;
      next.characters[who].energy =
        skill === "Q" ? 0 : Math.min(T.team[who].maxEnergy, next.characters[who].energy + 1);
      if (who === 1 && skill === "E") {
        if (m.manchai > 0 && next.characters[1].hp >= 5) next.characters[1].hp--;
        const nextRole = [(who + 1) % 3, (who + 2) % 3, who].find((i) =>
          T.alive(next.characters[i]),
        );
        next.active = nextRole;
      }
      if (d.reaction.futureUnknown) leaf = true;
      // Any actual opponent reply can change aura/health. Penalize exposed
      // fragile roles instead of pretending this is a complete minimax model.
    }
    if (a.type === "tune") next.hand = T.indexedHand(next.hand.filter((_, i) => i !== a.index));
    T.commit(mem, a, s, next, { projected: true });
    // Combat gives the opponent an opportunity; delayed Q healing cannot
    // cancel exposure now. Do not write imagined damage into character HP.
    const payoff = { immediate: benefit, prepared, deferred };
    benefit += prepared * preparedReliability(s, m) * 0.91 + deferred;
    if (combat && T.enemyCount(next) > 0) benefit -= exposureRisk(next, mem);
    // A threatened frontline may not get the next input. Keep its immediate
    // payoff in the comparison, but do not finance it with a later retreat,
    // return or delayed heal that assumes it survived the opponent's reply.
    if (combat && exposureRisk(next, mem) > 0 &&
        next.characters[next.active].hp <= pressureEstimate(mem)) leaf = true;
    if (T.total(next.dice) > 16) return null;
    if (T.enemyCount(s) > 0 && T.enemyCount(next) === 0) leaf = true;
    if (!boundary && unknownDraw && T.enemyCount(next) > 0 &&
        !(exposureRisk(next, mem) > 0 && next.characters[next.active].hp <= pressureEstimate(mem)))
      boundary = { kind: "unknown-draw", state: next };
    return { state: next, memory: mem, benefit, combat, leaf, payoff, boundary };
  }
  function terminalFinisher(s, m) {
    if (!T.legalState(s) || !(T.enemyCount(s) > 0)) return null;
    // Only currently legal immediate damage, including the native return
    // after a paid/fast Gaming switch. Prepared/end-phase estimates cannot
    // prove a terminal state; simulate never applies those delayed hits.
    const candidates = enumerate(s, m).filter(
        (a) => a.type === "skill" || (a.type === "switch" && a.target === 1 && m.gamingReturn),
      ),
      hits = [];
    for (const a of candidates) {
      const p = simulate(s, m, a);
      if (p && T.enemyCount(p.state) === 0) hits.push({ action: a, projection: p });
    }
    const order = (a) => (a.type === "skill" ? ["NA", "E", "Q"].indexOf(a.skill) : 3);
    hits.sort(
      (a, b) =>
        // Once the game ends, unused dice have no value. Prefer a ready
        // active-role hit over another character's native return animation.
        Number(a.action.type !== "skill") - Number(b.action.type !== "skill") ||
        Number(a.projection.combat) - Number(b.projection.combat) ||
        order(a.action) - order(b.action),
    );
    return hits[0] || null;
  }
  function evaluation(s, m, exposures) {
    // Exposure is charged at the combat opportunity in simulate, not again
    // as an endpoint rebate for switching to a healthy role.
    let value = T.total(s.dice) * 0.18;
    for (let i = 0; i < 3; i++)
      if (T.alive(s.characters[i])) value += s.characters[i].energy * 0.18;
    if (m.garden) value += 0.05;
    if (m.lyre) value += 0.05;
    return value + effectValue(s, m, exposures);
  }
  function fundedSkill(s, m, g, step) {
    if (
      !g ||
      !["E", "Q", "NA"].includes(g.skill) ||
      !T.alive(s.characters[g.who]) ||
      s.characters[g.who].frozen ||
      m.uncertainActions.includes(T.actionKey({ type: "skill", ...g })) ||
      (g.skill === "Q" && s.characters[g.who].energy < T.team[g.who].maxEnergy)
    )
      return null;
    let local = copy(s),
      mem = copy(m),
      path = [],
      parts = [];
    const apply = (a) => {
      const p = step(local, mem, a);
      if (!p) return null;
      path.push(a);
      parts.push(p);
      local = p.state;
      mem = p.memory;
      return p;
    };
    if (g.who !== local.active) {
      const a = { type: "switch", target: g.who };
      if (
        mem.uncertainActions.includes(T.actionKey(a)) ||
        !T.payment(local.dice, T.switchCost(mem))
      )
        return null;
      const p = apply(a);
      if (!p) return null;
      if (p.leaf) return { path, parts, state: local, memory: mem }; // Gaming's native plunge is already a payoff.
    }
    for (let i = 0; i < 3 && !T.skillLegal(local, g, mem); i++) {
      const funding = tuningPlan(local, mem, g);
      if (!funding) return null;
      if (
        !apply({
          type: "tune",
          id: funding.card.id,
          index: funding.card.index,
          element: T.team[g.who].element,
          goal: g.skill,
        })
      )
        return null;
    }
    if (!T.skillLegal(local, g, mem) || !apply({ type: "skill", who: g.who, skill: g.skill }))
      return null;
    return { path, parts, state: local, memory: mem };
  }
  function supportDevelopmentReachable(s, m) {
    const skills = s.characters[0].energy === 1 ? ["E", "Q"] : ["E", "NA", "Q"],
      exposures = skills.length + (s.active !== 0 && !m.fastSwitch ? 1 : 0);
    if (s.characters[0].hp <= pressureEstimate(m) * exposures) return false;
    const variants = [null], moon = s.hand.find((h) => h.id === "moon");
    if (moon && !m.weapons[0]) variants.push({ type: "card", id: "moon", index: moon.index, target: 0 });
    // A late investment may still be good, but must reach the actual burst
    // with existing resources and withstand the whole relay/E(A)Q chain.
    // This small certificate cannot borrow a next-round die or unknown draw.
    for (const gear of variants) {
      let local = s, mem = m;
      if (gear) {
        if (!T.cardLegal(local, gear, mem) || mem.uncertainActions.includes("card:moon")) continue;
        const p = simulate(local, mem, gear);
        if (!p) continue;
        local = p.state; mem = p.memory;
      }
      let complete = true;
      for (const skill of skills) {
        const p = fundedSkill(local, mem, { who: 0, skill }, simulate);
        if (!p || (p.parts[p.parts.length - 1].leaf && skill !== "Q")) { complete = false; break; }
        local = p.state; mem = p.memory;
      }
      if (complete && mem.iansanBurst) return true;
    }
    return false;
  }
  function discountPreparation(s, m, a) {
    if (a.type !== "card" || !["weapon", "artifact"].includes(T.byId[a.id]?.type)) return null;
    const original = T.size(T.cardCost(a.id, a.target, m, s));
    for (const id of ["garden", "house"]) {
      const h = s.hand.find((x) => x.id === id);
      if (!h || m.uncertainActions.includes("card:" + id)) continue;
      const setup = { type: "card", id, index: h.index, target: null };
      if (
        !T.cardLegal(s, setup, m) ||
        (id === "garden" && m.garden) ||
        (id === "house" && m.houses.length >= 2)
      )
        continue;
      const p = simulate(s, m, setup);
      if (!p) continue;
      const lowered = T.size(T.cardCost(a.id, a.target, p.memory, p.state));
      if (
        lowered < original &&
        T.cardLegal(
          p.state,
          { ...a, index: p.state.hand.findIndex((x) => x.id === a.id) },
          p.memory,
        )
      )
        return setup;
    }
    return null;
  }
  function replaySequence(s, m, sequence) {
    let local = copy(s),
      mem = copy(m);
    const path = [],
      parts = [];
    for (const input of sequence) {
      const a = { ...input };
      // Same-name copies are interchangeable, but numeric indices are NOT:
      // an inserted/removed preparation card shifts every subsequent slot.
      if (["card", "tune"].includes(a.type)) a.index = local.hand.findIndex((h) => h.id === a.id);
      if (
        (["card", "tune"].includes(a.type) && a.index < 0) ||
        (a.type === "switch" &&
          (a.target === local.active || !T.alive(local.characters[a.target]))) ||
        (a.type === "tune" &&
          (a.element !== T.team[local.active].element ||
            !T.diceOrder.some((e) => e !== a.element && e !== "Omni" && local.dice[e] > 0)))
      )
        return null;
      if (
        mem.uncertainActions.includes(T.actionKey(a)) ||
        (a.type === "card" && !T.cardLegal(local, a, mem)) ||
        (a.type === "skill" && !T.skillLegal(local, a, mem))
      )
        return null;
      const p = simulate(local, mem, a);
      if (!p) return null;
      path.push(a);
      parts.push(p);
      local = p.state;
      mem = p.memory;
      if (p.leaf && path.length !== sequence.length) return null;
    }
    return { path, parts, state: local, memory: mem };
  }
  function singOpening(s, m) {
    if (
      m.round !== 1 ||
      !m.used.every((n) => n === 0) ||
      s.active !== 0 ||
      !T.alive(s.characters[0]) ||
      s.characters[0].frozen ||
      s.characters[0].hp < 8 ||
      m.openingRevel || (m.openingDraws || 0) >= openingDrawLimit(m)
    )
      return null;
    const sing = s.hand.find((h) => h.id === "sing"),
      draw = s.hand.find((h) => h.id === "draw"),
      revel = s.hand.find((h) => h.id === "revel");
    const entering = !!sing && m.singCharges === 0 && (m.openingDraws || 0) === 0,
      continuing = m.singCharges === 2 && [1, 2].includes(m.openingDraws);
    if (!entering && !continuing) return null;
    const counts = s.hand.reduce((r, h) => {
        const type = T.byId[h.id]?.type;
        if (type) r[type] = (r[type] || 0) + 1;
        return r;
      }, {}),
      floor = (counts.weapon >= 2 ? 1 : 0) + (counts.artifact >= 2 ? 1 : 0),
      gear = (counts.weapon || 0) + (counts.artifact || 0),
      candidates = entering ? [sing] : [
        ...(m.openingDraws === 1 && draw ? [draw] : []),
        ...(revel && gear >= 2 ? [revel] : []),
      ];
    for (const h of candidates) {
      if (!h || s.hand.length > (h.id === "sing" ? 7 : 9)) continue;
      const a = { type: "card", id: h.id, index: h.index, target: null };
      if (!T.cardLegal(s, a, m) || m.uncertainActions.includes(T.actionKey(a))) continue;
      const p = simulate(s, m, a);
      // Only this ONE draw is chosen. Pay first, then reserve a known-funded
      // Iansan E. Never borrow identities/refunds from its unknown new cards.
      if (!p || !fundedSkill(p.state, p.memory, { who: 0, skill: "E" }, simulate)) continue;
      return {
        ...a, route: "欢唱轴",
        reason: h.id === "sing"
          ? "先欢唱过牌并保留已知启动预算，不要求狂欢或装备对提前齐全；抽到什么再重算"
          : h.id === "draw"
            ? "欢唱后先用现有运筹铺垫，仍保留战技预算；不猜抽牌和狂欢返骰"
            : "至少两张实际装备允许狂欢搏上限；只用已知返骰下界保留战技预算，随后转输出",
        search: { nodes: 0, value: 0, sequence: [a],
          knownRefundFloor: h.id === "revel" ? floor : 0, unknownDraws: true },
      };
    }
    return null;
  }
  function plan(s, m, options = {}) {
    const direct = terminalFinisher(s, m);
    if (direct)
      return {
        action: direct.action,
        sequence: [direct.action],
        terminal: true,
        value: 0,
        expanded: 0,
        completionNodes: 0,
        equipmentNodes: 0,
      };
    const depth = options.depth || SEARCH_LIMITS.depth,
      width = options.width || SEARCH_LIMITS.width,
      maxNodes = SEARCH_LIMITS.nodes;
    let frontier = [{ state: s, memory: m, path: [], score: 0, combat: 0,
        relay: pendingRelay(s, m), exposures: [0, 0, 0], risk: 0 }],
      best = null,
      expanded = 0,
      completionNodes = 0,
      equipmentNodes = 0,
      boundaryNodes = 0;
    const boundaryCache = new Map();
    const start = evaluation(s, m), objective = battleObjective(s, m),
      window = PAYOFF_WINDOW,
      seen = new Map();
    const effort = (path) =>
      path.reduce((total, action) => total + (INPUT_EFFORT[action.type] ?? 0.035), 0);
    const outputDelay = (path) => {
      if (objective.phase !== "output" || s.active !== objective.carry) return 0;
      const first = path.findIndex((a) =>
        (a.type === "skill" && a.who === objective.carry) ||
        (a.type === "card" && a.id === "talent" && objective.carry === 2) ||
        (a.type === "switch" && a.target === 1 && m.gamingReturn));
      // Once the carry is already working, credit a detour only AFTER its
      // entire restart overhead. Native confirmed inputs take roughly 9-16s;
      // tiny speculative gains must not postpone the funded damage chain.
      // This is a soft objective, not a switch ban or a forced action queue.
      return 0.06 * (first < 0 ? path.length : first);
    };
    const valueOf = (node) =>
      node.score +
      evaluation(node.state, node.memory, node.exposures) -
      start -
      0.15 * node.combat -
      effort(node.path) -
      outputDelay(node.path) + (node.boundaryValue || 0) -
      0.02 *
        Math.max(
          0,
          node.path.findIndex(
            (a) => a.type === "skill" || (a.type === "card" && a.id === "talent"),
          ),
        );
    const consider = (node) => {
      const terminal = T.enemyCount(s) > 0 && T.enemyCount(node.state) === 0;
      // Keep unfinished relay prefixes in the beam, but never select them as
      // payoff. Bare NA must actually reach E/Q, finish a target, add damage,
      // or unlock output that the former active role could not afford.
      if (node.combat > window || node.idleRelay || node.unsurvivable || (!terminal && node.fragileContinuation) ||
          (node.relay && !node.relay.cover)) return -Infinity;
      const supportActions = node.path.filter((a) => a.type === "skill" && a.who === 0).length;
      if (
        !terminal &&
        supportActions > 1 &&
        (s.characters[0].hp <= pressureEstimate(m) * supportActions ||
          (m.round === 1 && s.characters[0].hp < 8 && m.used[0] + supportActions >= 3))
      )
        return -Infinity;
      const value = valueOf(node), actions = node.path.length;
      // Lethal beats setup/survival points. Among the same complete outcome,
      // minimise inputs first, then combat opportunities and input effort.
      let better = !best;
      if (best) {
        if (terminal !== best.terminal) better = terminal;
        else if (terminal)
          better =
            actions < best.sequence.length ||
            (actions === best.sequence.length &&
              (node.combat < best.combat ||
                (node.combat === best.combat &&
                  effort(node.path) < effort(best.sequence))));
        else {
          // A negligible heuristic gain cannot justify another threatened
          // combat opportunity. This margin applies to any action type.
          const close = Math.abs(value - best.value) <= 0.1 && node.combat !== best.combat &&
            (node.risk > 0 || best.risk > 0);
          better = close ? node.combat < best.combat : value > best.value;
        }
      }
      if ((terminal || value > 0) && better)
        best = {
          action: node.path[0],
          sequence: node.path,
          value,
          terminal,
          combat: node.combat,
          risk: node.risk || 0,
          window,
          boundaryPayoff: node.boundaryPayoff || null,
        };
      return value;
    };
    const append = (node, a, p) => {
      let relay = node.relay || null;
      const idleRelay = node.idleRelay ||
        (a.type === "switch" && relay !== null && !relay.cover);
      if (a.type === "switch")
        relay = a.target === 1 && node.memory.gamingReturn ? null : {
          target: a.target,
          // Replan end cover on the exhausted observed board. Do not fund a
          // speculative cover now by spending cards before available damage.
          cover: retreatNeeded(node.state, node.memory, a.target) ||
            (!activeOutputReachable(s, m) && endCoverTargets(node.state, node.memory).includes(a.target)),
          allowNA: !activeOutputReachable(node.state, node.memory),
        };
      const who = a.type === "skill" ? a.who : a.type === "card" && a.id === "talent" ? 2 : null;
      if (relay && who === relay.target) {
        const d = damageEstimate(node.state, node.memory, who, a.skill || "E");
        if (a.skill !== "NA" || relay.allowNA || d.weapon + d.buff + d.soup > 0 ||
            T.enemyCount(p.state) < T.enemyCount(node.state)) relay = null;
      }
      if (!relay && a.type === "skill" && a.skill === "NA" &&
          who !== outputRole(node.state, node.memory) && node.memory.gamingReturn) {
        const d = damageEstimate(node.state, node.memory, who, "NA");
        if (d.weapon + d.buff + d.soup === 0 &&
            T.enemyCount(p.state) === T.enemyCount(node.state) &&
            ["E", "Q"].some((skill) => followupReachable(node.state, node.memory,
              { who: outputRole(node.state, node.memory), skill })))
          // Gaming's automatic exit still owes its native return. Ordinary
          // incumbents may attack: the full-budget comparison, not a nominal
          // carry assignment, decides whether paying for a handoff is better.
          relay = { target: who, cover: false, allowNA: false };
      }
      const exposures = node.exposures.slice(),
        acting = a.type === "switch" ? a.target : who,
        prior = acting === null ? 0 : exposures[acting],
        allowance = acting === null ? Infinity :
          node.state.characters[acting].hp - prior * pressureEstimate(node.memory),
        guarded = prior > 0 && node.state.characters.some((c, i) =>
          i !== acting && T.alive(c) && !c.frozen && c.hp >= allowance + 3 &&
          c.hp > pressureEstimate(node.memory));
      // Count opponent opportunities across the ENTIRE proposed chain, not
      // just support skills. These are risk allowances, never observed HP.
      // In particular, a paid switch also spends one exposure before its task.
      const prepared = p.payoff?.prepared > 0 && node.combat + 1 < window;
      if (p.combat && T.enemyCount(p.state) > 0)
        exposures[p.state.active] += prepared ? 2 : 1;
      // Do not reward empty preparations for merely making room for a random
      // draw. Useful refunds/damage still count, and a fresh real state can
      // reassess its new capacity after those actions actually happen.
      let benefit = p.payoff?.immediate ?? p.benefit;
      if (a.type === "card" && a.id === "draw") benefit = Math.min(benefit, drawBenefit(s.hand.length));
      if (prepared) {
        const confidence = preparedReliability(node.state, node.memory, node.exposures[node.state.active]);
        // The conditional hit can consume the enemy health/defeat that an
        // outstanding summon also values. Share that health on the shadow
        // board instead of banking both outcomes for the same target.
        const effects = effectValue(p.boundary.state, p.memory, exposures) -
          effectValue(p.state, p.memory, exposures);
        benefit += (p.payoff.prepared + effects) * confidence * 0.91;
      }
      // Outstanding Q/summon effects are credited once in endpoint evaluation.
      // Their realised damage removes the corresponding potential value.
      const risk = p.combat && T.enemyCount(p.state) > 0
        ? exposureRisk(p.state, p.memory, node.exposures[p.state.active]) : 0;
      benefit -= risk;
      const child = {
        state: p.state,
        memory: p.memory,
        path: node.path.concat(a),
        score: node.score + benefit * 0.91 ** node.combat,
        combat: node.combat + (p.combat ? 1 : 0) + (prepared ? 1 : 0),
        risk: (node.risk || 0) + risk,
        relay,
        idleRelay,
        exposures,
        unsurvivable: node.unsurvivable || (p.combat && prior > 0 && allowance <= 0),
        fragileContinuation: node.fragileContinuation ||
          (p.combat && guarded && allowance <= pressureEstimate(node.memory)),
      };
      if (p.boundary && child.combat < window) valueBoundary(child, p.boundary);
      return child;
    };
    function valueBoundary(node, boundary) {
      // Value-only continuation, never an executable sequence across a draw or
      // automatic skill. Only existing cards/dice can pay; no delayed refunds.
      const local = copy(boundary.state), mem = copy(node.memory),
        prior = Math.max(0, node.exposures[local.active] - 1),
        confidence = preparedReliability(local, mem, prior),
        slots = window - node.combat;
      for (const e of local.enemies || []) e.auraKnown = false;
      const base = evaluation(local, mem, node.exposures);
      const key = T.boardKey(local) + JSON.stringify(mem) +
        JSON.stringify([node.exposures, slots, boundary.kind]);
      if (boundaryCache.has(key)) {
        node.boundaryPayoff = boundaryCache.get(key);
        node.boundaryValue = node.boundaryPayoff.value;
        return;
      }
      let bestValue = 0, sequence = [];
      for (const skill of ["NA", "E", "Q"]) {
        const p = fundedSkill(local, mem, { who: local.active, skill }, (s, m, a) => {
          if (boundaryNodes >= SEARCH_LIMITS.boundary || expanded >= maxNodes) return null;
          boundaryNodes++; expanded++;
          return simulate(s, m, a);
        });
        if (!p) continue;
        let benefit = 0;
        for (let i = 0; i < p.path.length; i++) {
          const q = p.parts[i], before = i ? p.parts[i-1].memory : mem;
          benefit += (q.payoff?.immediate ?? q.benefit) - INPUT_EFFORT[p.path[i].type];
          if (q.combat) benefit -= 0.15 + exposureRisk(q.state, q.memory, node.exposures[local.active]);
          if (slots > 1 && q.payoff?.prepared) benefit += q.payoff.prepared *
            preparedReliability(local, before, node.exposures[local.active]) * 0.91;
        }
        const exposures = node.exposures.slice(); exposures[local.active]++;
        const value = (benefit + evaluation(p.state, p.memory, exposures) - base) *
          confidence * 0.91 ** node.combat;
        if (value > bestValue) { bestValue = value; sequence = p.path; }
      }
      node.boundaryValue = bestValue;
      node.boundaryPayoff = { kind: boundary.kind, confidence, slots, value: bestValue,
        knownOnly: true, sequence };
      boundaryCache.set(key, node.boundaryPayoff);
    }
    const equipmentStep = (local, mem, a) => {
      if (equipmentNodes >= SEARCH_LIMITS.equipment || expanded >= maxNodes) return null;
      equipmentNodes++;
      expanded++;
      return simulate(local, mem, a);
    };
    function equipmentPayoff(node, equippedTarget) {
      if (node.combat >= window) return;
      const who = node.state.active,
        carry = outputRole(node.state, node.memory),
        goals = [
          { who: equippedTarget, skill: "E" },
          intent(node.state, node.memory),
          { who: carry, skill: "E" },
          { who, skill: "Q" },
          { who, skill: "NA" },
        ];
      for (const g of uniqueGoals(goals)) {
        const p = fundedSkill(node.state, node.memory, g, equipmentStep);
        if (!p) continue;
        let paid = node;
        for (let i = 0; i < p.path.length; i++) paid = append(paid, p.path[i], p.parts[i]);
        consider(paid);
        if (p.parts[p.parts.length - 1].leaf || paid.combat >= window) continue;
        // Iansan's setup may fund a carry relay or the legal EAQ burst.
        for (const follow of [
          { who: carry, skill: "E" },
          { who: 0, skill: "Q" },
          { who: 0, skill: "NA" },
        ]) {
          const q = fundedSkill(paid.state, paid.memory, follow, equipmentStep);
          if (!q) continue;
          let done = paid;
          for (let i = 0; i < q.path.length; i++) done = append(done, q.path[i], q.parts[i]);
          consider(done);
          if (
            done.combat < window && !q.parts[q.parts.length - 1].leaf &&
            done.state.active === 0 &&
            T.skillLegal(done.state, { who: 0, skill: "Q" }, done.memory) &&
            !done.memory.uncertainActions.includes("skill:0:Q")
          ) {
            const a = { type: "skill", who: 0, skill: "Q" },
              hit = equipmentStep(done.state, done.memory, a);
            if (hit) consider(append(done, a, hit));
          }
        }
      }
    }
    // Small deterministic equipment bundles, not hard-coded five opening
    // queues. At most two zero-cost setup cards then the chosen equipment;
    // compare their ACTUAL funded skill/relay before pruning the setup prefix.
    function equipmentBundles(seed) {
      const visited = new Set();
      function visit(node, level) {
        if (node.combat >= window || equipmentNodes >= SEARCH_LIMITS.equipment) return;
        const key = T.boardKey(node.state) + JSON.stringify(node.memory) +
          JSON.stringify([node.relay, node.exposures]) + level;
        if (visited.has(key)) return;
        visited.add(key);
        const actions = enumerate(node.state, node.memory);
        // Discount/recycle before another irrelevant zero artifact target.
        const setups =
          level >= 2
            ? []
            : actions.filter(
                (a) =>
                  a.type === "card" &&
                  T.size(T.cardCost(a.id, a.target, node.memory, node.state)) === 0 &&
                  (["garden", "house", "lyre", "boar"].includes(a.id) ||
                    T.byId[a.id]?.type === "artifact"),
              );
        setups.sort(
          (a, b) =>
            (T.byId[a.id].type === "artifact" ? 1 : 0) - (T.byId[b.id].type === "artifact" ? 1 : 0),
        );
        for (const a of setups) {
          const hit = equipmentStep(node.state, node.memory, a);
          if (hit && !hit.leaf) visit(append(node, a, hit), level + 1);
        }
        for (const a of actions.filter(
          (a) => a.type === "card" && ["weapon", "artifact"].includes(T.byId[a.id]?.type),
        )) {
          const hit = equipmentStep(node.state, node.memory, a);
          if (hit) equipmentPayoff(append(node, a, hit), a.target);
        }
      }
      visit(seed, 0);
    }
    if (
      m.used[0] === 0 &&
      T.skillLegal(s, { who: 0, skill: "E" }, m) &&
      !m.uncertainActions.includes("skill:0:E")
    ) {
      const a = { type: "skill", who: 0, skill: "E" },
        p = equipmentStep(s, m, a);
      if (p) equipmentBundles(append(frontier[0], a, p));
    }
    equipmentBundles(frontier[0]);
    const completionCache = new Map();
    function complete(node) {
      if (node.combat >= window) return valueOf(node);
      const cacheKey = T.boardKey(node.state) + JSON.stringify(node.memory);
      let completions = completionCache.get(cacheKey);
      if (!completions) {
        completions = [];
        const wanted = intent(node.state, node.memory),
          carry = outputRole(node.state, node.memory);
        const goals = [
          wanted,
          { who: carry, skill: "E" },
          ...(node.path.length === 0
            ? ["Q", "NA"].map((skill) => ({ who: node.state.active, skill }))
            : []),
        ];
        for (const g of uniqueGoals(goals)) {
          const p = fundedSkill(node.state, node.memory, g, (local, mem, a) => {
            if (completionNodes >= SEARCH_LIMITS.funding || expanded >= maxNodes) return null;
            completionNodes++;
            expanded++;
            return simulate(local, mem, a);
          });
          if (p) completions.push(p);
        }
        completionCache.set(cacheKey, completions);
      }
      let priority = valueOf(node);
      for (const p of completions) {
        let closed = node;
        for (let i = 0; i < p.path.length; i++) closed = append(closed, p.path[i], p.parts[i]);
        const value = consider(closed);
        priority = Math.max(priority, value);
      }
      return priority;
    }
    // Close switch/tune/gear prefixes to a real skill BEFORE ranking the beam.
    // Five primitive levels remain bounded; completion can add <=5 legal
    // inputs, and shares the SAME 1800 node budget. Value-only leaf work has
    // its own small cap; it cannot starve the equipment/funded relay quotas.
    complete(frontier[0]);
    for (let d = 0; d < depth && frontier.length; d++) {
      const next = [];
      for (const node of frontier)
        for (const a of enumerate(node.state, node.memory)) {
          if (node.path.length >= depth || node.combat >= window) continue;
          if (
            a.type === "switch" &&
            node.path[node.path.length - 1]?.type === "switch" &&
            !(a.target === 1 && node.memory.gamingReturn)
          )
            continue;
          if (expanded >= maxNodes) break;
          expanded++;
          const p = simulate(node.state, node.memory, a);
          if (!p) continue;
          // Fast actions do not hand priority to the opponent. Discount by
          // combat opportunities, not card-click count: otherwise free Garden
          // unfairly delays the same Wolf+E and loses to paying full price.
          const child = append(node, a, p),
            value = valueOf(child);
          if (child.idleRelay) continue;
          // Resource/discount by itself is not an action payoff. Random draw is
          // a labelled leaf, not a licence to invent future cards.
          if (p.combat || (p.leaf && a.type !== "end") || p.benefit > 0) consider(child);
          if (!p.leaf && child.combat < window) {
            // The same board can arrive with a completed or still-unpaid
            // relay. Do not let one prefix prune the other's task status.
            const key = T.boardKey(p.state) + JSON.stringify(p.memory) +
              JSON.stringify([child.relay, child.exposures, !!child.fragileContinuation]);
            if ((seen.get(key) ?? -Infinity) >= value) continue;
            seen.set(key, value);
            const priority = complete(child);
            // A ready Iansan Q is a short terminal payoff, not a long funding
            // completion. Don't lose EAQ just because the shared completion
            // quota was spent inspecting earlier equipment targets.
            if (
              child.state.active === 0 &&
              !child.memory.iansanBurst &&
              T.skillLegal(child.state, { who: 0, skill: "Q" }, child.memory) &&
              !child.memory.uncertainActions.includes("skill:0:Q") &&
              expanded < maxNodes
            ) {
              expanded++;
              const q = { type: "skill", who: 0, skill: "Q" },
                hit = simulate(child.state, child.memory, q);
              if (hit) consider(append(child, q, hit));
            }
            if (child.path.length < depth) next.push({ ...child, value: priority });
          }
        }
      if (expanded >= maxNodes) break;
      next.sort((a, b) => b.value - a.value);
      frontier = next.slice(0, width);
    }
    return best
      ? { ...best, expanded, completionNodes, equipmentNodes }
      : {
          action: { type: "end" },
          sequence: [],
          value: 0,
          expanded,
          completionNodes,
          equipmentNodes,
        };
  }
  function choose(s, m) {
    if (!T.legalState(s))
      return { type: "stop", reason: "行动页的回合、手牌、血量、状态或充能未读清" };
    m.route = route(s, m);
    if (m.relayTask && !pendingRelay(s, m)) m.relayTask = null;
    const direct = terminalFinisher(s, m);
    if (direct)
      return {
        ...direct.action,
        route: m.route,
        reason: "优先现成合法技能收尾，无此技能再考虑原生返场；原生结算后复核",
        search: { nodes: 0, value: 0, terminal: true, sequence: [direct.action] },
      };
    const opening = singOpening(s, m);
    if (opening) return opening;
    const p = plan(s, m),
      setup = p.terminal ? null : discountPreparation(s, m, p.action),
      prepared = setup ? replaySequence(s, m, [setup, ...p.sequence]) : null,
      sequence = prepared ? prepared.path : p.sequence,
      a = sequence[0] || p.action,
      endCover = a.type === "switch" && endCoverTargets(s, m).includes(a.target),
      retreat = a.type === "switch" && (retreatNeeded(s, m, a.target) || endCover),
      objective = battleObjective(s, m),
      followup = a.type === "switch" ? sequence.slice(1).find((x) =>
        x.type === "skill" || x.type === "switch" || (x.type === "card" && x.id === "talent")) : null,
      // Retreat can also hand off a funded skill. Keep that realised intention,
      // but do not invent one for bare cover or a branch ending in random draws.
      relayTask = a.type === "switch" && !(a.target === 1 && m.gamingReturn) &&
        ((followup?.type === "skill" && followup.who === a.target) ||
          (followup?.id === "talent" && a.target === 2))
        ? { target: a.target, origin: s.active, round: m.round,
            allowNA: !activeOutputReachable(s, m),
            goal: followup.skill || "E" }
        : null;
    if (a.type === "tune") {
      const next = sequence.find((x) => x.type === "skill" || x.type === "switch" ||
        (x.type === "card" && x.id === "talent"));
      if (next?.type === "skill" && next.who === s.active) a.goal = next.skill;
      if (next?.id === "talent" && s.active === 2) a.goal = "E";
    }
    return {
      ...a,
      route: m.route,
      reason: prepared
        ? "同一已选装备先兑现可验证的零费减费；全段索引和支付已重算"
        : endCover ? "本回合已无可支付输出，回合末交接保护站场输出位；下轮按真实骰子重算"
          : m.relayTask ? "优先兑现已确认交接的输出任务；后续仍按真实牌面重算"
          : "按展开、交接、持续输出目标规划；伤害与承伤风险为估计",
      search: { nodes: p.expanded, value: p.value, terminal: !!p.terminal, sequence,
        payoffWindow: p.window || PAYOFF_WINDOW,
        ...(p.boundaryPayoff ? { boundaryPayoff: p.boundaryPayoff } : {}),
        objective, ...(relayTask ? { relayTask } : {}),
        ...(retreat ? { retreat: true, pressureEstimate: pressureEstimate(m) } : {}) },
    };
  }
  function pendingRelay(s, m) {
    const task = m.relayTask;
    if (!task || task.round !== m.round || s.active !== task.target ||
        !T.alive(s.characters[task.target]) || s.characters[task.target].frozen ||
        coverTargets(s, m).some((target) => retreatNeeded(s, m, target))) return null;
    // Keep a role's promised payoff through gear/tuning and ordinary HP
    // changes, but release it when no funded task remains. Never lock a queue.
    const funded = ["E", "Q"].some((skill) =>
      followupReachable(s, m, { who: task.target, skill }));
    let usefulNA = false;
    if (!funded && followupReachable(s, m, { who: task.target, skill: "NA" })) {
      const d = damageEstimate(s, m, task.target, "NA"),
        hit = T.skillLegal(s, { who: task.target, skill: "NA" }, m)
          ? simulate(s, m, { type: "skill", who: task.target, skill: "NA" }) : null;
      usefulNA = task.allowNA || d.weapon + d.buff + d.soup > 0 ||
        (enemy(s) && d.direct >= enemy(s).hp) ||
        (hit && !hit.leaf && followupReachable(hit.state, hit.memory,
          { who: task.target, skill: "Q" }));
    }
    if (!funded && !usefulNA) return null;
    return { ...task, cover: false };
  }
  function advanceBattleTask(m, a, before, after) {
    if (a.type === "switch") {
      m.relayTask = a.search?.relayTask && after?.active === a.target
        ? { ...a.search.relayTask } : null;
      return;
    }
    const task = m.relayTask;
    if (!task) return;
    const who = a.type === "skill" ? a.who : a.type === "card" && a.id === "talent" ? 2 : null;
    const d = who === task.target ? damageEstimate(before, m, who, a.skill || "E") : null;
    if (a.type === "end" || after?.active !== task.target ||
        (d && (a.skill !== "NA" || task.allowNA || d.weapon + d.buff + d.soup > 0 ||
          T.enemyCount(after) < T.enemyCount(before)))) m.relayTask = null;
  }
  function replacement(s, m) {
    if (
      !Array.isArray(s?.characters) ||
      s.characters.length !== 3 ||
      s.characters.some((c) => c.dead !== true && !T.alive(c))
    )
      return null;
    const options = [];
    for (let who = 0; who < 3; who++)
      if (T.alive(s.characters[who])) {
        const c = s.characters[who],
          local = {
            ...s,
            phase: "board",
            turn: "user",
            active: who,
            hand: [],
            diceKnown: true,
            dice: s.dice || {},
          };
        const ready = ["Q", "E", "NA"].some((skill) => T.skillLegal(local, { who, skill }, m));
        options.push({
          who,
          score:
            (c.frozen ? -50 : 20) +
            c.hp +
            (ready ? 12 : 0) +
            (who === outputRole(local, m) ? 6 : 0) +
            (who === 1 && m.gamingReturn ? 5 : 0),
        });
      }
    options.sort((a, b) => b.score - a.score);
    return options[0] ? { who: options[0].who } : null;
  }
  function soupChoice(options, s, target, m = T.freshMemory()) {
    const c = s?.characters?.[target],
      rank =
        c?.hp <= 4
          ? { healing: 100, shield: 90, soothing: 85, discount: 75, fury: 50, maxhp: 40 }
          : {
              discount: 100,
              fury: 85,
              healing: c?.hp <= 8 ? 75 : 10,
              soothing: 65,
              shield: 55,
              maxhp: 30,
            };
    if (!soupDiscountReachable(s, m, target)) rank.discount = -1;
    if (c && c.hp >= T.team[target].maxHp + (m.extraMaxHp[target] || 0)) rank.healing = 0;
    return options.slice().sort((a, b) => (rank[b.effect] || 0) - (rank[a.effect] || 0))[0] || null;
  }
  Object.assign(T, {
    route,
    intent,
    outputRole,
    battleObjective,
    supportDevelopmentReachable,
    pendingRelay,
    advanceBattleTask,
    pressureEstimate,
    exposureRisk,
    preparedReliability,
    summonBenefit,
    summonValue,
    effectValue,
    outputProtectionValue,
    roundBoundaryRisk,
    endCoverTargets,
    retreatNeeded,
    openingCharacter,
    followupReachable,
    tuningPlan,
    burnableHand,
    damageEstimate,
    actionCost,
    equipmentWanted,
    setupEquipmentReachable,
    enumerate,
    simulate,
    plan,
    choose,
    replacement,
    soupChoice,
    reaction,
    applyDamage,
    passiveHealing,
    soupDiscountReachable,
    discountPreparation,
    replaySequence,
    singOpening,
    terminalFinisher,
    actionRerollGoal: (s, m) => ({ ...intent(s, m), element: T.team[s.active].element }),
    switchPreparationReachable: followupReachable,
  });
})(globalThis);

globalThis.TCG.registerStrategy("default", globalThis.TCG.choose);

globalThis.TCG.selectStrategy(globalThis.TCG.defaultStrategy);
