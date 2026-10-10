// Generated from 牌手共享. Edit layered source, not this standalone output.
(function (root) {
  "use strict";
  const T = root.TCG;
  const BOARD_RETRIES = ["TCG_BOARD_RETRY", "TCG_DICE_RETRY"];
  const INPUT_REFRESHES = ["TCG_OBSERVATION_INTERRUPTED", "TCG_HAND_REFRESH", "TCG_STATE_REFRESH"];
  const BUDGET_FIELDS = [
    "expectedDice",
    "zeroDiceAllowed",
    "emptyHandProven",
    "gamblerMayAddDice",
    "gamblerBudget",
  ];
  const ELEMENT_NAMES = {
    Pyro: "火",
    Hydro: "水",
    Anemo: "风",
    Electro: "雷",
    Dendro: "草",
    Cryo: "冰",
    Geo: "岩",
    Omni: "万能",
  };
  const CARD_PURPOSES = {
    woven: "补充雷骰",
    voltage: "补充未满的角色充能",
    stars: "补充出战角色充能",
    calx: "转移后台充能",
    draw: "补充手牌，抽牌后重新规划",
    thundergrass: "选择后续使用的雷草祝佑",
    shatterbolt: "为后续元素爆发准备减费",
    sharpkernel: "为后续元素战技准备减费",
    lost: "接续本轮阵亡后的行动",
    toss: "重新投掷不合用的骰子",
    companion: "将骰子转为万能骰",
    sweet: "恢复目标角色生命",
    hashbrown: "恢复目标角色生命",
    lotus: "为下一次受伤提供减伤",
    smoked: "为下一次普通攻击减费",
    mint: "为本回合普通攻击减费",
  };

  const OPENING_DEFAULT = "全部保留";
  function playerOptions(settings = {}) {
  const supplied=settings||{};
  const options={enemyCount:3,maxMinutes:Number(supplied.maxMinutes||15),
    mulligan:TCG.openingSetting(supplied.mulligan),
    actionEntry:supplied.actionEntry||"禁止从行动页启动"};
  if(![10,15,20].includes(options.maxMinutes)||
    !["全部保留","优先装备与启动牌"].includes(options.mulligan)||
    !["禁止从行动页启动","确认新开局未行动"].includes(options.actionEntry))throw new Error("设置值无效");
  return options;
}

  function planSteps(action) {
    return (action.planning?.sequence || []).flatMap((key) => {
      if (typeof key !== "string") return [];
      let match = /^skill:([0-2]):(NA|E|Q)$/.exec(key);
      if (match) return [{ type: "skill", who: Number(match[1]), skill: match[2] }];
      match = /^switch:([0-2])$/.exec(key);
      if (match) return [{ type: "switch", target: Number(match[1]) }];
      match = /^(card|tune):(.+)$/.exec(key);
      return match ? [{ type: match[1], id: match[2] }] : [];
    });
  }
  // Reuse the strategy's existing estimate; no extra search, OCR or mutation.
  // This hit's direct damage and the selected whole plan are different claims.
  function attackPurpose(state, memory, who, skill) {
    const estimate = T.damageEstimate(state, memory, who, skill),
      enemy = estimate.target,
      reasons = [];
    if (enemy && estimate.direct > 0 && Number.isFinite(enemy.hp) && estimate.direct >= enemy.hp)
      reasons.push(`敌方出战剩${enemy.hp}点生命，按当前伤害估计尝试主动补刀`);
    if (enemy?.auraKnown === true && estimate.consumed) {
      const reaction =
        estimate.element === "Electro"
          ? { Pyro: "超载", Cryo: "超导", Hydro: "感电", Dendro: "激化" }[estimate.consumed]
          : { Electro: "激化", Pyro: "燃烧", Hydro: "绽放" }[estimate.consumed];
      if (reaction)
        reasons.push(`敌方已有${ELEMENT_NAMES[estimate.consumed]}附着，尝试${reaction}`);
    }
    if (skill === "NA" && !reasons.length) {
      reasons.push("用普攻压低血线");
      if (state.characters[who]?.energy < T.team[who].maxEnergy) reasons.push("积累充能");
    }
    if (skill === "E") {
      if (who === 0) reasons.push("召唤恶曜之眼，为后续结束阶段伤害与大招增伤做准备");
      else if (who === 1) reasons.push("尝试挂草并积累充能");
      else
        reasons.push(
          state.hand?.some((h) => h.id === "wedge")
            ? "消耗雷楔获得雷附魔"
            : "生成雷楔，为后续切回刻晴做准备",
        );
    }
    if (skill === "Q")
      reasons.push(
        [
          "为存活后台角色补充充能，准备接力大招",
          "召唤柯里安巴，准备结束阶段草伤",
          "同时压低敌方出战和后台血线",
        ][who],
      );
    return reasons.join("，");
  }
  function switchPurpose(action, state, memory) {
    const sequence = planSteps(action).slice(1),
      boundary = sequence.findIndex((a) => a.type === "switch");
    const next = boundary < 0 ? sequence : sequence.slice(0, boundary);
    const skill =
      next.find((a) => a.type === "skill" && a.who === action.target) ||
      next
        .filter((a) => a.type === "card")
        .map((a) =>
          a.id === "talent"
            ? { who: 1, skill: "E" }
            : ["penance", "wedge"].includes(a.id)
              ? { who: 2, skill: "E" }
              : null,
        )
        .find((a) => a?.who === action.target);
    if (skill) {
      const tuned = next.some((a) => a.type === "tune"),
        name = { NA: "普攻", E: "战技", Q: "大招" }[skill.skill];
      const repeated =
        next.filter((a) => a.type === "skill" && a.who === skill.who && a.skill === skill.skill)
          .length > 1;
      return (
        `计划${tuned ? "补" + ELEMENT_NAMES[T.team[action.target].element] + "骰后" : ""}${repeated ? "连续" : ""}接${name}，` +
        attackPurpose(state, memory, action.target, skill.skill)
      );
    }
    const weapon = T.cards.find(
      (card) => card.type === "weapon" && card.weaponTarget === action.target,
    );
    return memory.weapons[action.target] && weapon
      ? `让持有「${weapon.name}」的角色接力，后续按实际牌面重算`
      : "转交出战位置，后续按实际牌面重算";
  }

  // Formatter adapted from Iansan/Gaming/Sayu 0.1.9. Estimates are labelled;
  // observed facts, selected intentions and successful effects stay separate.
  function actionCommentary(action, state, memory) {
    const who = T.team[action.who]?.name || "角色",
      target = T.team[action.target]?.name || "角色";
    const skill = { NA: "普通攻击", E: "元素战技", Q: "元素爆发" }[action.skill] || "技能";
    const card =
      T.byId[action.id]?.name || state.hand?.find((h) => h.id === action.id)?.name || "手牌";
    const sequence = planSteps(action),
      boundary = sequence.slice(1).findIndex((a) => a.type === "switch");
    const next = boundary < 0 ? sequence.slice(1) : sequence.slice(1, 1 + boundary);
    const followup = next.find((a) => a.type === "skill");
    const finish = action.planning?.terminal === true ? "，按所选后续计划尝试收尾" : "";
    switch (action.type) {
      case "skill": {
        const ready =
          action.skill === "Q" && T.skillLegal(state, action, memory) ? "骰子与充能满足，" : "";
        const purpose = attackPurpose(state, memory, action.who, action.skill);
        return (
          ready +
          who +
          "准备" +
          (action.skill === "NA" ? "进行" : "释放") +
          skill +
          (purpose ? "，" + purpose : "") +
          finish +
          "。"
        );
      }
      case "probe":
        return "确认" + who + "的" + skill + "费用，再决定后续行动。";
      case "switch": {
        const current = state.characters[state.active],
          fragile =
            T.alive(current) && current.hp <= 3
              ? `${T.team[state.active].name}仅剩${current.hp}点生命，`
              : "";
        return (
          fragile +
          "准备切换" +
          target +
          "，" +
          switchPurpose(action, state, memory) +
          finish +
          "。"
        );
      }
      case "card":
        if (action.id === "wedge")
          return (
            "准备使用「雷楔」，切换刻晴并发动战技，" +
            attackPurpose(state, memory, 2, "E") +
            finish +
            "。"
          );
        if (["talent", "penance"].includes(action.id))
          return (
            "准备为" +
            target +
            "装备「" +
            card +
            "」并发动战技，" +
            attackPurpose(state, memory, action.id === "talent" ? 1 : 2, "E") +
            finish +
            "。"
          );
        if (["weapon", "artifact"].includes(T.byId[action.id]?.type))
          return (
            "准备为" +
            target +
            "装备「" +
            card +
            "」，" +
            (T.byId[action.id].type === "weapon"
              ? "提升后续技能伤害"
              : action.id === "gambler"
                ? "为击倒后的返骰做准备"
                : "为大招后补充后台充能做准备") +
            finish +
            "。"
          );
        if (["shift", "fast"].includes(action.id)) {
          const nextSwitch = sequence.slice(1).some((a) => a.type === "switch");
          return (
            "准备使用「" +
            card +
            "」" +
            (nextSwitch
              ? action.id === "shift"
                ? "，为接下来的切换减费"
                : "，准备快速切换"
              : "") +
            finish +
            "。"
          );
        }
        return (
          "准备使用「" +
          card +
          "」" +
          (CARD_PURPOSES[action.id] ? "，" + CARD_PURPOSES[action.id] : "") +
          finish +
          "。"
        );
      case "tune": {
        const element = ELEMENT_NAMES[action.element],
          goal =
            followup &&
            followup.who === state.active &&
            T.team[state.active]?.element === action.element
              ? { NA: "普攻", E: "战技", Q: "大招" }[followup.skill]
              : null;
        return (
          (element && goal
            ? "为" + T.team[state.active].name + goal + "补" + element + "骰："
            : "") +
          "调和「" +
          card +
          "」" +
          (!goal && element ? "，补充" + element + "骰" : "") +
          finish +
          "。"
        );
      }
      case "end":
        return "结束回合，等待下一轮。";
      default:
        return "按当前牌面继续行动。";
    }
  }

  // One owner for lifecycle/progress. Host owns native evidence and input;
  // strategy owns the next plan. Recovery never replays a submitted action.
  class Player {
    constructor(host, options) {
      this.host = host;
      this.options = options;
      this.memory = T.freshMemory();
      if(T.openingContext)this.memory.openingContext=T.openingContext({});
      host.memory=this.memory;
      this.deadline = Date.now() + options.maxMinutes * 60000;
      this.actions = 0;
      this.lastProgress = Date.now();
      this.readyState = null;
      this.openingFlow = null;
      this.actionEntryHandPending = false;
      this.lastNotice = null;
    }
    progress() {
      this.lastProgress = Date.now();
      this.lastNotice = null;
    }
    notice(key, text) {
      if (this.lastNotice !== key) {
        this.lastNotice = key;
        log.info(text);
      }
    }
    checkStalled(message) {
      if (Date.now() - this.lastProgress > 60000) throw new Error(message);
    }
    async defer(error, codes, event, message) {
      if (!codes.includes(error.code)) throw error;
      this.checkStalled(message);
      this.host.trace(event, { code: error.code, reason: String(error.message || error) });
      await sleep(400);
    }
    finishOpening() {
      const accepted = this.openingFlow.enterBoard(this.memory);
      if (!accepted) return;
      if (accepted.roundSeeded)
        this.host.trace("round", {
          round: this.memory.round,
          source: "verified-opening-board",
          keep: null,
        });
      this.host.trace("opening-ready", accepted);
    }
    reportResult(p) { log.info(p.result === "win" ? "对局胜利" : "对局失败"); }
    admitActionHand(state) {
      if (!this.actionEntryHandPending) return;
      if (state.hand?.length !== 7)
        throw new Error("新开局手牌数量不符：应有7张未使用的初始手牌，当前" + state.hand?.length + "张");
      this.host.trace("fresh-action-hand-verified", { count: state.hand.length, reusedFirstRead: true });
      this.actionEntryHandPending = false;
    }
    async enter() {
      const host = this.host;
      host.trace("start", {
        version: JSON.parse(file.readTextSync("manifest.json")).version,
        sharedVersion: T.sharedVersion,
        options: this.options,
      });
      host.trace("team-assumed", {
        names: T.team.map((c) => c.name),
        order: "left-to-right",
        userConfirmed: true,
      });
      await host.waitForCapture();
      const initial = host.phase();
      if (initial.phase === "result") {
        host.trace("terminal-entry", initial);
        log.info("当前对局已结束，请进入新对局后再启动。");
        return false;
      }
      this.openingFlow = new T.OpeningFlow(initial.phase);
      host.trace("opening-entry", {
        entry: initial.phase,
        actionEntry: this.options.actionEntry,
        midgameRestore: false,
      });
      if (initial.phase === "board") {
        if (this.options.actionEntry !== "确认新开局未行动")
          throw new Error("行动页启动需要选择“确认新开局未行动”");
        const board = await host.admitFreshActionBoard();
        host.expectedDice = T.total(board.dice);
        host.zeroDiceAllowed = false;
        this.actionEntryHandPending = true;
        this.finishOpening();
      }
      return true;
    }
    async opening() {
      const flow = this.openingFlow;
      if (flow.opened || flow.picked || flow.rolled || flow.complete)
        throw new Error("开局阶段异常：再次出现初始手牌");
      await this.host.opening();
      const kept = this.host.openingCards;
      if (this.options.mulligan === "全部保留") log.info("[起手] 按设置确认当前手牌，不主动置换。");
      else if (Array.isArray(kept))
        log.info(
          "[起手] " +
            (kept.length === 5
              ? "保留全部五张手牌，不置换。"
              : kept.length
                ? `保留${kept.map((c) => `「${c.name}」`).join("、")}，其余${5 - kept.length}张置换，寻找更合适的启动牌。`
                : "置换全部五张手牌，重新寻找启动牌。"),
        );
      this.memory.openingIds = (this.host.openingCards || []).map((c) => c.id);
      flow.record("opening");
      this.progress();
    }
    async choice() {
      try {
        await this.host.resolveChoice(null, this.memory);
        this.progress();
      } catch (e) {
        await this.defer(e, ["TCG_CHOICE_RETRY"], "choice-deferred", "挑选卡牌等待超时（60秒）");
      }
      this.readyState = null;
    }
    planOpening(stage) {
      this.memory.openingTarget=0;
      this.host.trace("opening-character-plan",{target:0,stage:stage||"initial-pick",openingIds:this.memory.openingIds||[]});
      return {target:0};
    }
    async replacement() {
      const host = this.host,
        memory = this.memory;
      try {
        const board = host.board();
        T.noteBoard(memory, board);
        const wanted = T.replacement(board, memory);
        if (!wanted) {
          const error = new Error("阵亡后的存活角色未读清");
          error.code = "TCG_PICK_RETRY";
          throw error;
        }
        host.trace("replacement-plan", {
          target: wanted.who,
          characters: board.characters,
          dice: board.dice,
        });
        host.trace("replacement-hand-policy", {
          mode: host.handCache === null ? "full-read-required" : "reuse-with-visible-count-check",
        });
        const defeated = board.characters.flatMap((c, i) =>
          c.dead === true ? [T.team[i].name] : [],
        );
        this.notice(
          "replacement:" + defeated.join(",") + ":" + wanted.who,
          "[接力] " +
            (defeated.length ? defeated.join("、") + "已阵亡，" : "") +
            "准备切换" +
            T.team[wanted.who].name +
            "继续作战。",
        );
        const after = await host.pick(wanted.who, false);
        if (after) T.noteBoard(memory, after);
        this.progress();
      } catch (error) {
        await this.defer(
          error,
          ["TCG_PICK_RETRY", ...BOARD_RETRIES],
          "replacement-deferred",
          "阵亡换人识别超时（60秒）",
        );
      }
    }
    async pick() {
      if (this.openingFlow.complete || this.actions > 0) return this.replacement();
      if (this.openingFlow.picked) throw new Error("开局阶段异常：首次出战后再次出现选人页");
      const choice = this.planOpening();
      const after = await this.host.pick(choice.target, true);
      this.memory.lastActive = choice.target;
      this.openingFlow.record("pick");
      if (after?.phase === "board") this.finishOpening();
      this.progress();
    }
    async roll() {
      const flow = this.openingFlow;
      if (!flow.complete && flow.rolled) throw new Error("开局阶段异常：首次掷骰后再次出现重投页");
      if (!flow.complete && !flow.picked && this.memory.openingTarget === null)
        this.planOpening("before-initial-roll");
      const after = await this.host.roll(this.memory, {
        allowInitialPick: !flow.complete && !flow.picked,
      });
      if (!flow.complete) {
        flow.record("roll");
        if (after?.phase === "board") this.finishOpening();
      }
      this.progress();
    }
    async observe() {
      const host = this.host,
        start = Date.now(),
        metrics = host.metricSnapshot?.(),
        reused = !!this.readyState;
      let state;
      try {
        state = this.readyState || (await host.observe());
      } catch (e) {
        this.readyState = null;
        await this.defer(e, BOARD_RETRIES, "observation-deferred", "牌桌识别超时（60秒）");
        return null;
      }
      if (this.readyState)
        host.trace("decision-state-reused", { handCount: this.readyState.hand.length });
      host.trace("observation-timing", {
        ms: Date.now() - start,
        reused,
        handRead: state.handRead,
        recognition: host.metricDelta?.(metrics),
      });
      this.readyState = null;
      if (state.phase !== "board" || state.turn !== "user") {
        host.trace("decision-deferred", { phase: state.phase, turn: state.turn });
        await sleep(300);
        return null;
      }
      this.admitActionHand(state);
      if (!this.openingFlow.complete) this.finishOpening();
      T.noteBoard(this.memory, state);
      host.trace("state", { round: this.memory.round, state, memory: this.memory });
      return state;
    }
    rejectUnchangedTune(action, before, after) {
      if (action.type !== "tune" || !T.legalState(after) || T.boardKey(before) !== T.boardKey(after))
        return false;
      T.rejectAction(this.memory, action);
      this.host.trace("tuning-retry-alternative", { action, proof: "full-hand-and-board-unchanged" });
      const card = before.hand[action.index]?.name || "这张牌";
      this.notice("tune-rejected:" + action.id, `[调和] 「${card}」未调和成功，手牌与骰子未变，改用其他牌或行动。`);
      return true;
    }
    async recoverRejectedInput(error, action, state, previousBudget) {
      const tune = action.type === "tune";
      if (error.code !== "TCG_INPUT_REJECTED" && !(tune && error.code === "TCG_TUNE_UNCONFIRMED")) return false;
      const host = this.host;
      this.readyState = null;
      Object.assign(host, previousBudget);
      const after = await host.observe(true, { mode: "full" });
      if (tune) {
        if (T.verifyResynchronized(action, state, after, false)) {
          T.commit(this.memory, action, state, after);
          host.trace("confirmed", { action, after, memory: this.memory, source: "tuning-recovery" });
          log.info("[调和] 已核实手牌消耗与元素骰变化，继续后续行动。");
        } else if (!this.rejectUnchangedTune(action, state, after)) {
          T.deferUncertain(this.memory, action);
          host.trace("action-uncertain", { action, after, memory: this.memory });
          log.warn("[调整] 调和结果未能确认，按实际牌面继续，不重复烧牌。");
        }
      } else {
        T.rejectAction(this.memory, action);
        this.notice("input-rejected", "[调整] 当前行动未被游戏接受，重新同步后换一种选择。");
        host.trace("native-input-rejected", { action, reason: error.message });
      }
      if (T.legalState(after)) {
        host.adoptObservedState(after, tune ? "tuning-recovery-resync" : "native-rejection-resync");
        this.readyState = after;
      }
      T.noteBoard(this.memory, after);
      this.actions++;
      this.progress();
      return true;
    }
    async execute(action, state) {
      const host = this.host,
        budget = Object.fromEntries(BUDGET_FIELDS.map((k) => [k, host[k]]));
      try {
        return { sent: true, result: await host.execute(action, state, this.memory) };
      } catch (e) {
        if (await this.recoverRejectedInput(e, action, state, budget)) return { sent: false };
        if (!INPUT_REFRESHES.includes(e.code)) throw e;
        Object.assign(host, budget);
        this.readyState = null;
        host.trace("execution-deferred", {
          action,
          phase: e.phase?.phase,
          turn: e.phase?.turn,
          code: e.code,
          reason: String(e.message || e),
        });
        if (e.code !== "TCG_OBSERVATION_INTERRUPTED") {
          this.notice("resync", "[调整] 牌面发生变化，重新同步后继续。");
          try {
            const refreshed = await host.observe(
              true,
              e.code === "TCG_HAND_REFRESH"
                ? { mode: "full" }
                : { mode: "unchanged", hand: state.hand },
            );
            if (refreshed.phase === "board" && refreshed.turn === "user") {
              host.adoptObservedState(refreshed, "before-input-resync");
              this.readyState = refreshed;
            }
          } catch (unsettled) {
            // A pre-input refresh may cross another incomplete native frame.
            // Keep the rolled-back budget; the main loop observes again, never
            // resubmits the stale plan or publishes an unfinished hand.
            await this.defer(
              unsettled,
              BOARD_RETRIES,
              "execution-resync-deferred",
              "牌桌重新同步超时（60秒）",
            );
          }
        }
        await sleep(300);
        return { sent: false };
      }
    }
    async act() {
      const state = await this.observe();
      if (!state) return;
      const host = this.host,
        start = Date.now(),
        metrics = host.metricSnapshot?.(),
        action = T.choose(state, this.memory),
        planningMs = Date.now() - start;
      host.trace("decision", action);
      if (action.type === "stop") throw new Error(action.reason);
      const execution = await this.execute(action, state);
      if (!execution.sent) return;
      // The input was sent, not necessarily accepted. Commentary states intention.
      log.info("[第" + this.memory.round + "回合] " + actionCommentary(action, state, this.memory));
      if (action.type === "probe" && execution.result?.probed) {
        this.readyState = execution.result;
        this.progress();
        return;
      }
      const inputFinished = Date.now(),
        after = await host.confirm(action, state, this.memory);
      host.trace("action-timing", {
        action: T.actionKey(action),
        planningMs,
        inputMs: inputFinished - start - planningMs,
        settlementMs: Date.now() - inputFinished,
        totalMs: Date.now() - start,
        recognition: host.metricDelta?.(metrics),
        confirmed: !!after.confirmed,
      });
      if (after.confirmed) {
        T.commit(this.memory, action, state, after);
        host.trace("confirmed", { action, after, memory: this.memory });
      } else {
        T.deferUncertain(this.memory, action);
        host.trace("action-uncertain", { action, after, memory: this.memory });
        log.warn("动作效果未确认，已重新同步");
      }
      T.noteBoard(this.memory, after);
      if (after.phase === "board" && after.turn === "user" && T.legalState(after))
        this.readyState = after;
      this.actions++;
      this.progress();
    }
    async run() {
      try {
        if (await this.enter() === false) return;
        while (Date.now() < this.deadline && this.actions < 180) {
          const p = this.host.phase();
          if (p.phase !== "board" || p.turn !== "user") this.readyState = null;
          if (p.result) {
            this.host.trace("result", p);
            this.reportResult(p);
            return;
          }
          if (p.phase === "opening") await this.opening();
          else if (p.phase === "choice") await this.choice();
          else if (p.phase === "pick") await this.pick();
          else if (p.phase === "roll") await this.roll();
          else if (p.turn === "user") await this.act();
          else {
            this.checkStalled("对局等待超时（60秒）");
            await sleep(500);
          }
        }
        throw new Error("达到单局时间或动作上限");
      } catch (e) {
        const reason = String(e.message || e);
        this.host.snapshot(reason);
        log.error("牌手停止：" + reason);
        throw e;
      } finally {
        this.host.dispose();
      }
    }
  }
  root.TCGPlayer = { Player, playerOptions, actionCommentary };
})(globalThis);
