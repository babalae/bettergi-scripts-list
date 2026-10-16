// Generated from 牌手共享. Edit layered source, not this standalone output.
(function(root){
  "use strict";
  const T=root.TCG;
  const BOARD_RETRIES = ["TCG_BOARD_RETRY", "TCG_DICE_RETRY"];
  const INPUT_REFRESHES = ["TCG_OBSERVATION_INTERRUPTED", "TCG_HAND_REFRESH", "TCG_STATE_REFRESH"];
  const BUDGET_FIELDS = [
    "expectedDice",
    "emptyHandProven",
    "gamblerBudget",
  ];
  function playerOptions(settings = {}) {
  const supplied=settings||{};
  const defaultMinutes=TCG.defaultMaxMinutes||15;
  const options={enemyCount:3,maxMinutes:Number(supplied.maxMinutes||defaultMinutes),
    mulligan:TCG.openingSetting(supplied.mulligan),
    actionEntry:supplied.actionEntry||"禁止从行动页启动"};
  if(![10,15,20,defaultMinutes].includes(options.maxMinutes)||
    !["全部保留","优先装备与启动牌"].includes(options.mulligan)||
    !["禁止从行动页启动","确认新开局未行动"].includes(options.actionEntry))throw new Error("设置值无效");
  return options;
}
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
      if (Date.now() >= this.deadline) throw new Error("达到单局时间上限，仍有未恢复的状态");
      if (Date.now() - this.lastProgress > 60000)
        this.notice("recovery:" + message, "[等待恢复] " + message.replace(/超时（60秒）/, "暂未读清") + "，继续核对，不重复输入。");
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
    async replacement() {
      const host = this.host,
        memory = this.memory;
      this.readyState = null;
      try {
        if (host.forcedPickSession) {
          const after = await host.pick(host.forcedPickSession.target, false);
          if (after) T.noteBoard(memory, after);
          this.progress();
          return;
        }
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
        await this.defer(e, [...BOARD_RETRIES, "TCG_HAND_RETRY"], "observation-deferred", "牌桌识别超时（60秒）");
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
    async execute(action, state) {
      const budget = Object.fromEntries(BUDGET_FIELDS.map(key => [key, this.host[key]]));
      try { return { sent: true, result: await this.host.execute(action, state, this.memory) }; }
      catch (e) { await this.recoverBeforeConfirmation(e, action, state, budget); return { sent: false }; }
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
      if (error.code === "TCG_INPUT_REJECTED") T.rejectAction(this.memory, action);
      const after = await this.awaitObservation({ mode: "full" });
      if (tune && error.code === "TCG_TUNE_UNCONFIRMED") {
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
        this.notice("input-rejected", tune
          ? "[调和] 当前牌未被游戏接受，改用其他牌或行动。"
          : "[调整] 当前行动未被游戏接受，重新同步后换一种选择。");
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
    async awaitConfirmation(action, before, memory = this.memory) {
      while (Date.now() < this.deadline) {
        try { return await this.host.confirm(action, before, memory); }
        catch (e) {
          if (!["TCG_CONFIRMATION_RETRY", "TCG_BOARD_RETRY", "TCG_DICE_RETRY", "TCG_HAND_RETRY"].includes(e.code)) throw e;
          this.notice("pending:" + T.actionKey(action), "[等待恢复] 动作已经提交，继续核对结果，不重复输入。");
          this.host.trace("confirmation-pending", { action, code: e.code, missing: e.missing,
            phase: e.phase?.phase, turn: e.phase?.turn, elapsedMs: e.elapsedMs, reason: e.message });
          await sleep(400);
        }
      }
      throw new Error("达到单局时间上限，待确认动作未能安全恢复");
    }
    async awaitObservation(plan) {
      while (Date.now() < this.deadline) {
        try { return await this.host.observe(true, plan); }
        catch (e) {
          await this.defer(e, [...BOARD_RETRIES, "TCG_HAND_RETRY"], "recovery-read-deferred", "牌桌重新同步超时（60秒）");
        }
      }
      throw new Error("达到单局时间上限，实际牌面仍未读清");
    }
    async recoverBeforeConfirmation(error, action, state, previousBudget) {
      const host = this.host;
      this.readyState = null;
      if (await this.recoverRejectedInput(error, action, state, previousBudget)) return;
      if (!INPUT_REFRESHES.includes(error.code)) throw error;
      Object.assign(host, previousBudget);
      host.trace("execution-deferred", { action, phase: error.phase?.phase, turn: error.phase?.turn,
        code: error.code, reason: String(error.message || error) });
      if (error.code !== "TCG_OBSERVATION_INTERRUPTED") {
        this.notice("resync", "[调整] 牌面发生变化，重新同步后继续。");
          let refreshed;
          try { refreshed = await host.observe(true, error.code === "TCG_HAND_REFRESH"
            ? { mode: "full" } : { mode: "unchanged", hand: state.hand });
          } catch (e) {
            await this.defer(e, [...BOARD_RETRIES, "TCG_HAND_RETRY"], "execution-resync-deferred", "牌桌重新同步超时（60秒）");
            return;
          }
          if (refreshed.phase === "board" && refreshed.turn === "user" && T.legalState(refreshed)) {
            host.adoptObservedState(refreshed, "before-input-resync"); this.readyState = refreshed;
          }
      }
      await sleep(300);
    }
    async run() {
      try {
        if (await this.enter() === false) return;
        while (Date.now() < this.deadline && this.actions < 180) {
          const sampledAt = Date.now();
          const p = this.host.phase();
          if (p.phase !== "board" || p.turn !== "user") this.readyState = null;
          if (p.result) {
            this.host.trace("result", p);
            this.reportResult(p);
            return;
          }
          if (this.host.forcedPickSession) await this.replacement();
          else if (this.host.choiceSession || p.phase === "choice") await this.choice();
          else if (p.phase === "opening") await this.opening();
          else if (p.phase === "pick") await this.pick();
          else if (p.phase === "roll") await this.roll();
          else if (p.turn === "user") await this.act();
          else {
            this.checkStalled("对局等待超时（60秒）");
            const remaining = 500 - (Date.now() - sampledAt);
            if (remaining > 0) await sleep(remaining);
          }
        }
        throw new Error("达到单局时间或动作上限");
      } catch (e) {
        const reason = String(e.message || e);
        this.host.reportStop(reason);
        log.error("牌手停止：" + reason);
        throw e;
      } finally {
        this.host.dispose();
      }
    }
    reportResult(p){log.info(p.result==="win"?"对局胜利":"对局失败");}
    planOpening(stage){const target=T.role("菈乌玛");this.memory.openingTarget=target;
      if(this.memory.round===0){this.memory.countdownStock={countdown3:2};this.memory.kernelLedger={created:0,unspent:0};}
      this.host.trace("opening-character-plan",{target,stage:stage||"initial-pick",source:"configured-team-order"});return {target};}
    async act() {
      const state = await this.observe();
      if (!state) return;
      const host = this.host, memory = this.memory, started = Date.now(),
        metrics = host.metricSnapshot?.(), action = T.choose(state, memory),
        planningMs = Date.now() - started;
      host.trace("decision", action);
      if (action.type === "stop") throw new Error(action.reason);
      const execution = await this.execute(action, state);
      if (!execution.sent) return;
      log.info("[第" + memory.round + "回合] " + actionCommentary(action, state, memory));
      if (action.type === "probe" && execution.result?.probed) {
        this.readyState = execution.result; this.progress(); return;
      }
      const inputFinished = Date.now(), after = await this.awaitConfirmation(action, state, memory);
      host.trace("action-timing", { action: T.actionKey(action), planningMs,
        inputMs: inputFinished - started - planningMs, settlementMs: Date.now() - inputFinished,
        totalMs: Date.now() - started, recognition: host.metricDelta?.(metrics),
        confirmed: !!after.confirmed, scope: "actual-runtime-not-offline-estimate" });
      if (after.confirmed) {
        T.commit(memory, action, state, after);
        host.trace("confirmed", { action, after, memory });
      } else if (!(after.handRead === "full" && this.rejectUnchangedTune(action, state, after))) {
        T.deferUncertain(memory, action);
        host.trace("action-uncertain", { action, after, memory });
        log.warn("动作效果未确认，已重新同步，不重复输入。");
      }
      T.noteBoard(memory, after);
      if (after.confirmed && action.type === "card" && T.byId[action.id]?.type === "draw" &&
          Array.isArray(after.hand) && after.hand.length <= state.hand.length) {
        // Consumption can precede card insertion (native draw 3 -> 2). Do not
        // plan from that partial hand. Read once afresh, without guessing deck
        // size/draw outcome, waiting for a predicted count, or replaying the card.
        host.invalidateHand("consumed-draw-needs-fresh-hand");
        this.readyState = null;
        host.trace("draw-hand-refresh-required", { id: action.id, beforeCount: state.hand.length,
          observedCount: after.hand.length, consumptionConfirmed: true, effectsComplete: false });
      } else if (after.phase === "board" && after.turn === "user" && T.legalState(after)) this.readyState = after;
      this.actions++; this.progress();
    }
  }
  const axisNames={burst:"爆发兑现",fallback:"低组件保底",reaction:"补反应铺垫",relay:"少女接力",sustain:"持续输出",cleanup:"残局收尾"};
  const skillNames={NA:"普攻",E:"战技",Q:"爆发",T:"特技"};
  function plannedActionLabel(key){
    const [type,id,name,technique]=key.split(":");
    if(type==="skill")return T.team[Number(id)].name+(name==="T"?"的「"+T.techniques[technique].name+"」":skillNames[name]);
    if(type==="switch")return "切换"+T.team[Number(id)].name;
    if(type==="card")return "使用「"+T.byId[id].name+"」";
    return "调和「"+T.byId[id].name+"」";
  }
  function actionCommentary(a,s,m){
    const prefix="【"+axisNames[a.axis||T.axis(s,m)]+"】";
    let text;
    if(a.type==="probe")text=a.scope==="card"?"仅核实「"+T.byId[a.id].name+"」所需的手牌信息，补齐后重新决策，不提交出牌":
      "核实"+T.team[a.who].name+"的"+skillNames[a.skill]+"费用，再决定后续行动";
    else if(a.type==="skill"){
      const hit=T.damageEstimate(s,m,a.who,a.skill);
      text=T.team[a.who].name+"准备使用"+(a.skill==="T"?"特技「"+T.techniques[a.technique].name+"」":skillNames[a.skill]);
      if(hit.direct>0)text+="，模型预计本次直伤"+hit.direct+"点，实际以结算为准";
      else text+="，优先为后续反应与资源转换铺垫";
    }else if(a.type==="switch")text="准备切换"+T.team[a.target].name+"接手，交接出战位置后按实际牌面重算";
    else if(a.type==="tune")text="调和「"+T.byId[a.id].name+"」"+(a.funding?"，为"+plannedActionLabel(a.funding.goal)+"筹集有效骰":"，将无效骰转换为当前角色所需元素");
    else if(a.type==="card"){
      const c=T.byId[a.id],purpose={weapon:"准备武器与后续输出",artifact:"准备后续资源收益",support:"铺设后续资源转换",legend:"按当前资源选择生成牌",
        attachment:"调整手牌附着与费用，生效后重算",switch:"准备免费切换",draw:"补充手牌，按实际抽牌结果重算",energy:"转移充能，为爆发创造条件",
        return:"回收武器并重新利用减费",choice:"按当前可支付性选择生成牌",adventure:"准备后续回合资源",dice:"补充可用骰子，颜色以实际结果为准",
        status:"准备后续行动的资源收益",food:"准备当前增益或续航",kernel:"兑现核的幻戏攻击，不按普通技能记充能",branch:"处理祝佑分支效果",
        technique:"装备特技，再按实际资源决定是否使用","heal-dice":"兼顾续航与骰子资源",heal:"恢复生命，保留后续接力"}[c.type];
      text="准备使用「"+c.name+"」"+(T.characterTarget(c)?"，目标"+T.team[a.target].name:"")+"，"+purpose;
    }else text="当前没有可支付且有收益的动作，结束回合";
    if(a.planning?.sequence.length>1)text+="；预计后续："+a.planning.sequence.slice(1,4).map(plannedActionLabel).join(" → ")+"（每步确认后重算）";
    if(a.planning?.terminal)text+="；当前估算有收尾机会，并非已确认获胜";
    return prefix+text+"。";
  }
  root.TCGPlayer={Player,playerOptions,actionCommentary};
})(globalThis);
