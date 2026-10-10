(function (root) {
  "use strict";
  const T = root.TCG;
  const VERSION = "0.1.9";
  const BOARD_RETRIES = ["TCG_BOARD_RETRY", "TCG_DICE_RETRY"];
  const INPUT_REFRESHES = ["TCG_OBSERVATION_INTERRUPTED", "TCG_HAND_REFRESH", "TCG_STATE_REFRESH"];
  const BUDGET_FIELDS = [
    "expectedDice",
    "zeroDiceAllowed",
    "emptyHandProven",
    "gamblerMayAddDice",
    "gamblerBudget",
  ];

  function playerOptions(settings = {}) {
    const supplied = settings || {};
    // Read only public settings. Retired diagnostic/scheduler keys have no effect.
    const options = {
      mulligan: supplied.mulligan || "优先装备与启动牌",
      maxMinutes: Number(supplied.maxMinutes || 15),
    };
    if (
      ![10, 15, 20].includes(options.maxMinutes) ||
      !["全部保留", "优先装备与启动牌"].includes(options.mulligan)
    )
      throw new Error("设置值无效");
    return options;
  }

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
    garden: "为后续装备减费",
    house: "为后续装备减费",
    shift: "为接下来的切换减费",
    fast: "准备快速切换",
    draw: "补充手牌，抽牌后重新规划",
    revel: "补充手牌，抽牌后重新规划",
    boar: "为装备替换准备返骰",
    sing: "为后续减费与抽牌组合做准备",
    opera: "布置满足装备条件时的返骰支援",
    companion: "将骰子转为万能骰",
    lost: "补充万能骰与出战角色充能",
    stars: "补充出战角色充能",
    sweet: "恢复目标角色生命",
    hashbrown: "恢复目标角色生命",
    lotus: "为下一次受伤提供减伤",
    soup: "挑选适合当前牌面的料理效果",
  };
  const REACTION_NAMES = {
    swirl: "扩散",
    overload: "超载",
    vaporize: "蒸发",
    melt: "融化",
    charged: "感电",
    superconduct: "超导",
    freeze: "冻结",
  };

  function attackPurpose(state, memory, who, skill) {
    const enemy = state.enemies?.find((e) => e.active === true && T.alive(e));
    const estimate = T.damageEstimate(state, memory, who, skill);
    const reaction = REACTION_NAMES[estimate.reaction.name];
    const aura =
      enemy?.auraKnown === true
        ? (enemy.aura || [])
            .map((e) => ELEMENT_NAMES[e])
            .filter(Boolean)
            .join("、")
        : "";
    const reasons = [];
    // Direct damage only: prepared/end-phase hits cannot justify this attack's
    // kill. The opponent's shields/reply and estimated own buffs remain unknown.
    if (enemy && Number.isFinite(enemy.hp) && estimate.direct >= enemy.hp)
      reasons.push(`敌方出战剩${enemy.hp}点生命，按当前伤害估计尝试主动补刀`);
    if (reaction && aura) reasons.push(`敌方已有${aura}附着，尝试${reaction}`);
    if (skill === "NA" && !reasons.length) {
      reasons.push("用普攻压低血线");
      if (state.characters[who]?.energy < T.team[who].maxEnergy) reasons.push("积累充能");
    }
    if (who === 0 && skill === "E") reasons.push("尝试挂雷，为快速切换接力做准备");
    if (who === 1 && skill === "E") reasons.push("战技后自动切走，再回场接踏云献瑞");
    if (who === 2 && skill === "E") reasons.push("接续准备技能风风轮舞踢");
    if (skill === "Q")
      reasons.push(
        [
          "建立动能增伤，为后续接力做准备",
          "召唤文仔，为后续战技减费",
          "布置不倒貉貉，等待结束阶段伤害与治疗",
        ][who],
      );
    return reasons.join("，");
  }

  function switchPurpose(action, state, memory) {
    if (action.target === 1 && memory.gamingReturn) {
      const purpose = attackPurpose({ ...state, active: 1 }, memory, 1, "P");
      return "接续踏云献瑞" + (purpose ? "，" + purpose : "");
    }
    const sequence = action.search?.sequence?.slice(1) || [];
    const boundary = sequence.findIndex((a) => a.type === "switch");
    const next = boundary < 0 ? sequence : sequence.slice(0, boundary);
    const skill =
      next.find((a) => a.type === "skill" && a.who === action.target) ||
      (action.target === 2 && next.some((a) => a.type === "card" && a.id === "talent")
        ? { who: 2, skill: "E" }
        : null);
    if (skill) {
      const tuned = next.some((a) => a.type === "tune");
      const name = { NA: "普攻", E: "战技", Q: "大招" }[skill.skill];
      const repeated =
        next.filter((a) => a.type === "skill" && a.who === skill.who && a.skill === skill.skill)
          .length > 1;
      return (
        `计划${tuned ? "补" + ELEMENT_NAMES[T.team[action.target].element] + "骰后" : ""}${repeated ? "连续" : ""}接${name}，` +
        attackPurpose(state, memory, action.target, skill.skill).replace("尝试扩散", "接续扩散")
      );
    }
    const weapon = T.byId[memory.weaponKinds[action.target]]?.name;
    return weapon
      ? `让持有「${weapon}」的角色接力，后续按实际牌面重算`
      : "转交出战位置，后续按实际牌面重算";
  }

  // Separate observed facts, selected intentions and explicitly labelled estimates.
  // This formatter performs no recognition and does not modify the plan.
  function actionCommentary(action, state, memory) {
    const who = T.team[action.who]?.name || "角色";
    const target = T.team[action.target]?.name || "角色";
    const skill = { NA: "普通攻击", E: "元素战技", Q: "元素爆发" }[action.skill];
    const card =
      T.byId[action.id]?.name || state.hand?.find((h) => h.id === action.id)?.name || "手牌";
    const finish = action.search?.terminal === true ? "，按所选后续计划尝试收尾" : "";
    switch (action.type) {
      case "skill": {
        const intent = `${who}准备${action.skill === "NA" ? "进行普通攻击" : "释放" + skill}`;
        const ready =
          action.skill === "Q" && T.skillLegal(state, action, memory) ? "骰子与充能满足，" : "";
        return `${ready}${intent}，${attackPurpose(state, memory, action.who, action.skill)}${finish}。`;
      }
      case "probe":
        return `确认${who}的${skill}费用，再决定后续行动。`;
      case "switch": {
        const current = state.characters[state.active];
        const fragile =
          T.alive(current) && current.hp <= 3
            ? `${T.team[state.active].name}仅剩${current.hp}点生命，`
            : "";
        return `${fragile}准备切换${target}，${switchPurpose(action, state, memory)}${finish}。`;
      }
      case "card":
        if (action.id === "talent")
          return `准备打出「${card}」，装备早柚天赋并发动战技，${attackPurpose(state, memory, 2, "E")}${finish}。`;
        if (action.id === "lyre")
          return `准备使用「${card}」，回收${target}的圣遗物，为下张圣遗物减费${finish}。`;
        if (["weapon", "artifact"].includes(T.byId[action.id]?.type))
          return `准备为${target}装备「${card}」，${
            T.byId[action.id].type === "weapon"
              ? "提升后续技能伤害"
              : {
                  gambler: "为击倒后的返骰做准备",
                  gilded: "补充角色元素骰并准备反应过牌",
                  troupe: "利用后台积蓄为战技减费",
                  heart: "准备出战受伤时过牌",
                }[action.id]
          }${finish}。`;
        return `准备使用「${card}」${CARD_PURPOSES[action.id] ? "，" + CARD_PURPOSES[action.id] : ""}${finish}。`;
      case "tune": {
        const element = ELEMENT_NAMES[action.element];
        const goal = { NA: "普攻", E: "战技", Q: "大招" }[action.goal];
        const purpose =
          element && goal
            ? `为${T.team[state.active]?.name || "出战角色"}${goal}补${element}骰：`
            : "";
        return `${purpose}调和「${card}」${!purpose && element ? "，补充" + element + "骰" : ""}${finish}。`;
      }
      case "end":
        return "结束回合，等待下一轮。";
      default:
        return "按当前牌面继续行动。";
    }
  }

  // One session owns lifecycle/progress. The host owns recognition and input;
  // strategy owns the next action. No recovery below replays a submitted action.
  class Player {
    constructor(host, options) {
      this.host = host;
      this.options = options;
      this.memory = T.freshMemory();
      this.memory.openingContext = T.openingContext({});
      host.memory = this.memory;
      this.deadline = Date.now() + options.maxMinutes * 60000;
      this.actions = 0;
      this.lastProgress = Date.now();
      this.readyState = null;
      this.openingFlow = null;
      this.lastNotice = null;
    }

    progress() {
      this.lastProgress = Date.now();
      this.lastNotice = null;
    }

    notice(key, message) {
      if (this.lastNotice === key) return;
      this.lastNotice = key;
      log.info(message);
    }

    checkStalled(message) {
      if (Date.now() - this.lastProgress > 60000) throw new Error(message);
    }

    async defer(error, codes, event, timeoutMessage) {
      if (!codes.includes(error.code)) throw error;
      this.checkStalled(timeoutMessage);
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

    planOpening(stage) {
      const enemies = this.host.openingEnemies();
      const choice = T.openingCharacter(enemies, this.memory);
      this.memory.openingContext = T.openingContext({ enemies });
      if (this.memory.openingContext.route) this.memory.route = this.memory.openingContext.route;
      this.memory.openingTarget = choice.target;
      this.host.trace("opening-character-plan", {
        ...choice,
        enemies,
        context: this.memory.openingContext,
        openingIds: this.memory.openingIds || [],
        ...(stage ? { stage } : {}),
      });
      log.info(
        "[开局] " +
          (choice.target === 2
            ? "敌方已有可扩散附着，早柚直接首发，省去一次切换。"
            : (this.memory.openingIds || []).includes("moon")
              ? "保留了「贯月矢」，伊安珊先行动，为后续爆发做准备。"
              : "伊安珊先行动，尝试挂雷后再接力。"),
      );
      return choice;
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
      } catch (error) {
        await this.defer(
          error,
          ["TCG_CHOICE_RETRY"],
          "choice-deferred",
          "挑选卡牌等待超时（60秒）",
        );
      }
      this.readyState = null;
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

    async observeTurn() {
      try {
        const state = this.readyState || (await this.host.observe());
        if (this.readyState)
          this.host.trace("decision-state-reused", { handCount: state.hand.length });
        this.readyState = null;
        if (state.phase === "board" && state.turn === "user") return state;
        this.host.trace("decision-deferred", { phase: state.phase, turn: state.turn });
        await sleep(300);
      } catch (error) {
        this.readyState = null;
        await this.defer(error, BOARD_RETRIES, "observation-deferred", "牌桌识别超时（60秒）");
      }
      return null;
    }

    async recoverBeforeConfirmation(error, action, state, previousBudget) {
      const host = this.host;
      this.readyState = null;
      if (error.code === "TCG_INPUT_REJECTED") {
        this.notice("input-rejected", "[调整] 当前行动未被游戏接受，重新同步后换一种选择。");
        T.rejectAction(this.memory, action);
        host.trace("native-input-rejected", { action, reason: error.message });
        host.expectedDice = T.total(state.dice);
        host.zeroDiceAllowed = host.expectedDice === 0;
        const refreshed = await host.observe(true, { mode: "full" });
        if (T.legalState(refreshed)) {
          host.adoptObservedState(refreshed, "native-rejection-resync");
          this.readyState = refreshed;
        }
        this.actions++;
        this.progress();
        return;
      }
      if (!INPUT_REFRESHES.includes(error.code)) throw error;
      if (error.code === "TCG_HAND_REFRESH")
        this.notice("hand-refresh", "[调整] 手牌发生变化，重新同步后继续。");
      else if (error.code === "TCG_STATE_REFRESH")
        this.notice("state-refresh", "[调整] 牌面发生变化，按当前局势重新选择行动。");
      Object.assign(host, previousBudget);
      host.trace("execution-deferred", {
        action,
        phase: error.phase?.phase,
        turn: error.phase?.turn,
        code: error.code,
        reason: String(error.message || error),
      });
      // These codes are raised by pre-input guards, before drag/confirmation.
      if (error.code !== "TCG_OBSERVATION_INTERRUPTED") {
        const plan =
          error.code === "TCG_HAND_REFRESH"
            ? { mode: "full" }
            : { mode: "unchanged", hand: state.hand };
        const refreshed = await host.observe(true, plan);
        if (refreshed.phase === "board" && refreshed.turn === "user") {
          host.adoptObservedState(refreshed, "before-input-resync");
          this.readyState = refreshed;
        }
      }
      await sleep(300);
    }

    async playTurn() {
      const state = await this.observeTurn();
      if (!state) return;
      if (!this.openingFlow.complete) this.finishOpening();
      const host = this.host,
        memory = this.memory;
      T.noteBoard(memory, state);
      host.trace("state", { round: memory.round, state, memory });
      const started = Date.now(),
        metricsBefore = host.metricSnapshot?.();
      const action = T.choose(state, memory),
        planningMs = Date.now() - started;
      host.trace("decision", action);
      if (action.type === "stop") throw new Error(action.reason);
      const commentary = actionCommentary(action, state, memory);
      const previousBudget = Object.fromEntries(BUDGET_FIELDS.map((key) => [key, host[key]]));
      let execution;
      try {
        execution = await host.execute(action, state, memory);
      } catch (error) {
        await this.recoverBeforeConfirmation(error, action, state, previousBudget);
        return;
      }
      log.info(`[第${memory.round}回合] ${commentary}`);
      if (action.type === "probe" && execution?.probed) {
        this.readyState = execution;
        this.progress();
        return;
      }
      const inputFinished = Date.now();
      const after = await host.confirm(action, state, memory);
      host.trace("action-timing", {
        action: T.actionKey(action),
        planningMs,
        inputMs: inputFinished - started - planningMs,
        settlementMs: Date.now() - inputFinished,
        totalMs: Date.now() - started,
        recognition: host.metricDelta?.(metricsBefore),
        confirmed: !!after.confirmed,
        scope: "actual-runtime-not-offline-estimate",
      });
      if (after.confirmed) {
        T.commit(memory, action, state, after);
        host.selectedSoup = null;
        host.trace("confirmed", { action, after, memory });
      } else {
        T.deferUncertain(memory, action);
        host.trace("action-uncertain", { action, after, memory });
        log.warn("[调整] 动作效果尚未确认，按实际牌面继续，不重复输入。");
      }
      T.noteBoard(memory, after);
      if (after.phase === "board" && after.turn === "user" && T.legalState(after))
        this.readyState = after;
      this.actions++;
      this.progress();
    }

    async step(phase) {
      if (phase.phase !== "board" || phase.turn !== "user") this.readyState = null;
      switch (phase.phase) {
        case "opening":
          return this.opening();
        case "choice":
          return this.choice();
        case "pick":
          return this.pick();
        case "roll":
          return this.roll();
        default:
          if (phase.turn === "user") return this.playTurn();
          this.checkStalled("对局等待超时（60秒）");
          await sleep(500);
      }
    }

    async run() {
      const host = this.host;
      try {
        host.trace("start", {
          version: VERSION,
          referenceVersion: "雷柯刻0.4.6",
          options: this.options,
          validationScope: "limited-pve",
        });
        log.info("伊嘉早自动牌手 " + VERSION + " 启动");
        host.trace("team-assumed", {
          names: T.team.map((c) => c.name),
          order: "left-to-right",
          userConfirmed: true,
        });
        await host.waitForCapture();
        const initial = host.phase();
        if (initial.phase === "result") {
          log.info("当前对局已结束，请重新开始对局");
          return;
        }
        if (initial.phase === "board")
          throw new Error("请从新对局的初始手牌、首次选人或首次掷骰页启动；不支持中局接管");
        this.openingFlow = new T.OpeningFlow(initial.phase);
        host.trace("opening-entry", { entry: initial.phase, midgameRestore: false });
        while (Date.now() < this.deadline && this.actions < 180) {
          const phase = host.phase();
          if (phase.result) {
            host.trace("result", phase);
            log.info(
              "[结束] " +
                (phase.result === "win" ? "对局胜利" : "对局失败") +
                "，共进行" +
                this.memory.round +
                "个回合。",
            );
            return;
          }
          await this.step(phase);
        }
        throw new Error("达到单局时间或动作上限");
      } catch (error) {
        const reason = String(error.message || error);
        host.snapshot(reason);
        log.error("牌手停止：" + reason);
        throw error;
      } finally {
        host.dispose();
      }
    }
  }
  Object.assign(T, { Player, playerOptions, actionCommentary, version: VERSION });
})(globalThis);
