eval(file.readTextSync("lib/core.js"));
eval(file.readTextSync("lib/strategy.js"));
eval(file.readTextSync("lib/bgi.js"));

(async function () {
  "use strict";
  const options = {
    mode: settings.mode || "识别诊断",
    enemyCount: Number(settings.enemyCount || 3),
    mulligan: settings.mulligan || "全部保留",
    maxMinutes: Number(settings.maxMinutes || 15),
    actionEntry: settings.actionEntry || "禁止从行动页启动"
  };
  if (![2, 3, 4].includes(options.enemyCount) || ![10, 15, 20].includes(options.maxMinutes) ||
      !["禁止从行动页启动", "确认新开局未行动"].includes(options.actionEntry)) throw new Error("设置值无效");
  setGameMetrics(1920, 1080);
  const host = new TCGBetterGI.BetterGIHost(options);
  const memory = TCG.freshMemory();
  const deadline = Date.now() + options.maxMinutes * 60000;
  let actions = 0, lastProgress = Date.now(), readyState = null, openingFlow = null, actionEntryHandPending = false, openingEvidenceTaken=false;
  function actionLabel(action, state) {
    const who = TCG.team[action.who]?.name || "角色";
    const skill = { NA:"普攻", E:"战技", Q:"爆发" }[action.skill] || action.skill;
    const card = TCG.byId[action.id]?.name || state.hand?.find(h=>h.id===action.id)?.name || action.id;
    if (action.type === "skill") return who + "·" + skill;
    if (action.type === "probe") return "检视费用：" + who + "·" + skill;
    if (action.type === "switch") return "切换：" + (TCG.team[action.target]?.name || "角色");
    if (action.type === "card") return "出牌：" + card;
    if (action.type === "tune") return "调和：" + card;
    if (action.type === "end") return "结束回合";
    return action.type;
  }
  function finishOpening() {
    const accepted = openingFlow.enterBoard(memory);
    if (!accepted) return;
    if (accepted.roundSeeded) host.trace("round", { round: memory.round, source: "verified-opening-board", keep: null });
    host.trace("opening-ready", accepted);
  }
  try {
    host.trace("start", { version: "0.4.6", options, realCombatValidated: false });
    // User-confirmed fixed team: no startup character-detail clicks/OCR.
    host.trace("team-assumed", { names:TCG.team.map(c=>c.name), order:"left-to-right", userConfirmed:true });
    await host.waitForCapture();
    const initial = host.phase();
    openingFlow = new TCG.OpeningFlow(initial.phase);
    host.trace("opening-entry", { entry: initial.phase, actionEntry: options.actionEntry, midgameRestore: false });
    // No history restore. The action-page entry requires an explicit fresh-game
    // declaration plus two stable visible opening boards, before ANY input.
    if (initial.phase === "board" && options.mode !== "识别诊断") {
      if (options.actionEntry !== "确认新开局未行动") throw new Error("行动页启动需要选择“确认新开局未行动”");
      const entryBoard = await host.admitFreshActionBoard();
      host.expectedDice = TCG.total(entryBoard.dice);
      host.zeroDiceAllowed = false;
      actionEntryHandPending = true;
      finishOpening();
    }
    while (Date.now() < deadline && actions < 180) {
      const p = host.phase();
      // Only the immediately preceding complete, verified user board can be
      // reused. Any observed turn/page transition invalidates it.
      if (p.phase !== "board" || p.turn !== "user") readyState = null;
      if (p.result) { host.trace("result", p); log.info(p.result === "win" ? "对局胜利" : "对局失败"); return; }
      if (p.phase === "opening") {
        if (openingFlow.opened || openingFlow.picked || openingFlow.rolled || openingFlow.complete) throw new Error("开局阶段异常：再次出现初始手牌");
        await host.opening(options.mode === "识别诊断");
        if (options.mode === "识别诊断") { log.info("诊断完成：初始手牌"); return; }
        openingFlow.record("opening");
        lastProgress = Date.now();
      } else if(p.phase === "choice") {
        if(options.mode === "识别诊断") {host.trace("choice-diagnostic",p);log.info("诊断完成：挑选卡牌");return;}
        try{await host.resolveChoice(null,memory);lastProgress=Date.now();}
        catch(e){if(e.code!=="TCG_CHOICE_RETRY")throw e;
          if(Date.now()-lastProgress>60000)throw new Error("挑选卡牌等待超时（60秒）");
          host.trace("choice-deferred",{reason:e.message});await sleep(400);}
        readyState=null;
      } else if (p.phase === "pick") {
        if (options.mode === "识别诊断") { log.info("诊断完成：出战页"); return; }
        if (openingFlow.complete || actions > 0) {
          try {
            const board = host.board();
            TCG.noteBoard(memory,board);
            const wanted = TCG.replacement(board, memory);
            if (!wanted) {const e=new Error("阵亡后的存活角色未读清");e.code="TCG_PICK_RETRY";throw e;}
            host.trace("replacement-plan",{target:wanted.who,characters:board.characters,dice:board.dice});
            host.trace("replacement-hand-policy",{mode:host.handCache===null?"full-read-required":"reuse-with-visible-count-check"});
            const afterPick=await host.pick(wanted.who, false);
            if(afterPick)TCG.noteBoard(memory,afterPick);
          } catch(e) {
            if(!["TCG_PICK_RETRY","TCG_BOARD_RETRY","TCG_DICE_RETRY"].includes(e.code))throw e;
            if(Date.now()-lastProgress>60000)throw new Error("阵亡换人识别超时（60秒）");
            host.trace("replacement-deferred",{code:e.code,reason:String(e.message||e)});await sleep(400);continue;
          }
        } else {
          if (openingFlow.picked) throw new Error("开局阶段异常：首次出战后再次出现选人页");
          const afterPick = await host.pick(0, true);
          openingFlow.record("pick");
          if (afterPick?.phase === "board") finishOpening();
        }
        lastProgress = Date.now();
      } else if (p.phase === "roll") {
        if (options.mode === "识别诊断") {
          const dice = await host.readRollDice();
          host.trace("roll-diagnostic", dice);
          log.info("诊断完成：掷骰"); return;
        }
        if (!openingFlow.complete && openingFlow.rolled) throw new Error("开局阶段异常：首次掷骰后再次出现重投页");
        const afterRoll = await host.roll(memory, { allowInitialPick: !openingFlow.complete && !openingFlow.picked });
        if (!openingFlow.complete) {
          openingFlow.record("roll");
          if (afterRoll?.phase === "board") finishOpening();
        }
        lastProgress = Date.now();
      } else if (p.turn === "user") {
        let state;
        try{state=readyState || await host.observe();}catch(e){
          if(!["TCG_BOARD_RETRY","TCG_DICE_RETRY"].includes(e.code))throw e;
          if(Date.now()-lastProgress>60000)throw new Error("牌桌识别超时（60秒）");
          readyState=null;
          host.trace("observation-deferred",{code:e.code,reason:String(e.message||e)});
          await sleep(400);continue;
        }
        if (readyState) host.trace("decision-state-reused", { handCount: readyState.hand.length });
        readyState = null;
        if (state.phase !== "board" || state.turn !== "user") {
          host.trace("decision-deferred", { phase: state.phase, turn: state.turn });
          await sleep(300);
          continue;
        }
        if (actionEntryHandPending) {
          // Common initial hand: five kept/drawn cards plus first-round draw
          // of two. Reuse this first required hand read; never scan it again.
          if (state.hand?.length !== 7) throw new Error("新开局手牌数量不符：应有7张未使用的初始手牌，当前" + state.hand?.length + "张");
          host.trace("fresh-action-hand-verified", { count: state.hand.length, reusedFirstRead: true });
          actionEntryHandPending = false;
        }
        if (!openingFlow.complete) finishOpening();
        if(!openingEvidenceTaken && options.mode!=="识别诊断" && host.captureEvidence) {
          host.captureEvidence("opening-board");openingEvidenceTaken=true;
        }
        TCG.noteBoard(memory,state);
        host.trace("state", { round: memory.round, state, memory });
        const action = TCG.choose(state, memory);
        host.trace("decision", action);
        if (action.type === "stop") throw new Error(action.reason);
        if (options.mode === "识别诊断") { log.info("诊断完成：建议" + actionLabel(action, state)); return; }
        const previousBudget = { expectedDice: host.expectedDice, zeroDiceAllowed: host.zeroDiceAllowed,
          emptyHandProven: host.emptyHandProven, gamblerMayAddDice: host.gamblerMayAddDice,
          gamblerBudget: host.gamblerBudget };
        let execution;
        try { execution=await host.execute(action, state, memory); } catch (e) {
          // Phase interrupts in execute occur only during pre-action hand
          // checks, before drag/confirmation. No applied action is replayed.
          if (!["TCG_OBSERVATION_INTERRUPTED","TCG_HAND_REFRESH","TCG_STATE_REFRESH"].includes(e.code)) throw e;
          Object.assign(host, previousBudget);
          readyState = null;
          host.trace("execution-deferred", { action, phase: e.phase?.phase, turn: e.phase?.turn, code:e.code, reason:String(e.message||e) });
          if (e.code !== "TCG_OBSERVATION_INTERRUPTED") {
            const refreshed = await host.observe(true, e.code==="TCG_HAND_REFRESH" ? {mode:"full"} :
              {mode:"unchanged",hand:state.hand});
            if (refreshed.phase === "board" && refreshed.turn === "user") {
              host.adoptObservedState(refreshed, "before-input-resync");
              readyState = refreshed;
            }
          }
          await sleep(300);
          continue;
        }
        log.info("行动：" + actionLabel(action, state));
        if(action.type==="probe" && execution?.probed){readyState=execution;lastProgress=Date.now();continue;}
        const after = await host.confirm(action, state, memory);
        if (after.confirmed) {
          TCG.commit(memory, action, state,after);
          host.trace("confirmed", { action, after, memory });
        } else {
          TCG.deferUncertain(memory, action);
          host.trace("action-uncertain", { action, after, memory });
          log.warn("动作效果未确认，已重新同步");
        }
        TCG.noteBoard(memory,after);
        if (after.phase === "board" && after.turn === "user" && TCG.legalState(after)) readyState = after;
        actions++;
        lastProgress = Date.now();
      } else {
        if (Date.now() - lastProgress > 60000) throw new Error("对局等待超时（60秒）");
        await sleep(500);
      }
    }
    throw new Error("达到单局时间或动作上限");
  } catch (e) {
    const reason = String(e.message || e);
    host.snapshot(reason);
    log.error("牌手停止：" + reason);
    throw e;
  } finally { host.dispose(); }
})();
