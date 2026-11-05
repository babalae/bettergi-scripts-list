// 入口编排（design §2）：判日子 → 打双倍 → 重读树脂 → 打日常 → 收尾兜底。
//
// 边界：判断只在 `plan.js`，BGI 参数只在 `tasks.js`，识别只在 `resinReader/`，本文件不碰它们内部；
// 通知只在结束或失败时发一条（§2.8），中间过程只进日志。
// 整链包在 `run()` 外一层 try/catch 里：任何一处意外抛出也发一条 error 通知，不让 BGI 红字静默结束（§2.8）。

import { CONFIG_DIR, GLOBAL_FILE, loadConfig, loadGlobal, loadState, markPlayed, saveState, toSegments } from "./src/config.js";
import { judgeDay } from "./src/gameclock.js";
import { planDaily, planDouble, planFallback, planFirstStage, planSalvage, planStygian, spendable } from "./src/plan.js";
import { collectResin } from "./src/resinReader/resin.js";
import { quota, summary, underQuotaMsg } from "./src/doubleQuota.js";
import { runStep } from "./src/tasks.js";
import { salvageArtifacts } from "./src/salvage.js";
import { createCtx, notify, render } from "./src/report.js";
import { openPanel } from "./src/panel.js";

const MODE_PANEL = "打开配置面板";
const WEEK_CN = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/**
 * 读数开关，下标顺序 `[原粹, 浓缩, 须臾, 脆弱]`（见 `collectResin` 的 JSDoc）。
 * 须臾 / 脆弱在本脚本里只进通知（`ctx.resin.full`），没有别的消费方；所以只有两处全读四项
 * （地脉后那次、最终读数那次，reference §2.6.1），其余按判据要什么读什么。
 */
const READ_ORIGINAL = [true, false, false, false];

let ctx = null;

async function run() {
  const opt = typeof settings !== "undefined" && settings ? settings : {};
  const uid = String(opt.uid || "").trim();
  // 空 settings（未进配置组）按面板走：首次拿到脚本先配置，不误开打
  const mode = String(opt.mode || MODE_PANEL);

  // ---- 配置面板模式 ----
  // 不要求先有账号（面板就是用来建账号的）；解析出的 uid 只作默认选中项带过去。
  if (mode === MODE_PANEL) {
    try {
      await openPanel(uid);
    } catch (e) {
      log.error(`配置面板异常：${e && e.message ? e.message : e}`);
    }
    return;
  }

  // ---- 直接运行模式 ----
  // 首行账号名只用 uid：此刻还没读到配置里的 name，别用「旅行者，xxx」这类占位说法进通知
  ctx = createCtx({ account: { uid, name: uid } });

  /** 早退：只终止当日，发一条 error 通知（§2.8 早退那一行） */
  const abort = (reason) => {
    log.error(reason);
    ctx.aborted = reason;
    const text = render(ctx);
    log.info(text);
    notify(ctx);
  };

  if (!/^\d+$/.test(uid)) {
    return abort("未填写账号 UID（settings.uid）。请在配置组「账号 UID」中选择账号；若无账号，请先切换为「打开配置面板」新建。");
  }

  // ---- 1. 日型：只判一次（§1.9），之后全程用这个结果 ----
  let cal;
  let day;
  try {
    const g = loadGlobal();
    cal = toSegments(g, (m) => log.warn(m));
    day = judgeDay(new Date(), cal.segments, cal.dayStart);
  } catch (e) {
    return abort(`日型判定失败：${e && e.message ? e.message : e}`);
  }

  // ---- 2. 账户 ----
  let account;
  try {
    account = loadConfig(uid);
  } catch (e) {
    return abort(`${e && e.message ? e.message : e}\n请把运行模式切成「${MODE_PANEL}」生成 ${CONFIG_DIR}/${uid}.json。全局配置见 ${GLOBAL_FILE}。`);
  }

  ctx.account = { uid, name: account.name || uid };
  ctx.day = { kind: day.kind, gameDay: day.gameDay, weekday: day.weekday, reason: day.reason };

  const week = WEEK_CN[day.weekday] || "";
  log.info(`===== 自动战斗计划 · ${ctx.account.name} · 游戏日 ${day.gameDay}（${week}）· ${day.reason} =====`);

  // ---- 3. 决策用的上下文（每次现算，`now` 固定为开跑那一刻） ----
  const now = new Date();
  const played = loadState(uid);
  // 队伍与策略都在 `teams.global` 下（`accountOut` 读盘时已把老形状搬过来）
  const g = (account.teams && account.teams.global) || {};
  const opts = {
    combatTeam: String(g.combat || ""),
    friendshipTeam: String(g.friendship || ""),
    strategy: String(g.strategy || "")
  };
  const planCtx = () => ({ now, today: day, cal, account, played });

  /** 打一次步骤，成功记 runs、失败记 failed（不重试、不换下一条，§2.7） */
  async function exec(step) {
    log.info(`▶ ${step.label}（${step.reason}）`);
    const r = await runStep(step, opts);
    if (r.ok) {
      // cat 进 runs：planSalvage 靠它判「本日打过圣遗物本」（幽境看 tag）。
      // 只在成功时记，失败的场次不进分解判据。
      ctx.runs.push({ label: step.label, rounds: roundsOfStep(step), tag: step.tag, cat: (step.params && step.params.cat) || "" });
      const rw = r.rewards ? `，奖励 ${JSON.stringify(r.rewards)}` : "";
      log.info(`✓ ${step.label} 完成${rw}`);
    } else {
      ctx.failed.push({ label: step.label, error: r.error });
      log.error(`✗ ${step.label} 失败：${r.error}`);
    }
    return r;
  }

  /** 描述符 → 通知里那个「×N」；耗尽与世界 Boss 没有轮数 */
  function roundsOfStep(step) {
    const p = step.params || {};
    if (p.exhaust === true) return null;
    if (p.roundNum !== undefined) return p.roundNum;
    if (p.count !== undefined) return p.count;
    return null;
  }

  /** 读数 → 数字，读不到统一成 null（通知里写「未知」，不写 NaN） */
  const asCount = (v) => (v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

  const originalOf = (snap) => asCount(snap && snap.ok && snap.resin ? snap.resin.original : null);

  // ---- 4. 阶段起点（§2.1） ----
  let first;
  try {
    first = planFirstStage(planCtx());
  } catch (e) {
    return abort(`阶段判定异常：${e && e.message ? e.message : e}`);
  }
  log.info(`阶段起点：${first.stage}（${first.reason}）`);

  let snapA = null;
  try {
    // 双倍额度要用它做基准；普通日也读一次，通知里「树脂 x→y」才有起点。
    // 只读原粹：`quota` 按原粹差折算，通知的 x 也只用它
    snapA = await collectResin(READ_ORIGINAL);
    ctx.resin.before = originalOf(snapA);
    if (!snapA || snapA.ok !== true) {
      log.warn(`树脂读数失败${snapA && snapA.error ? `：${snapA.error}` : ""}（不中止，按 §2.6 照常跑）`);
    }
  } catch (e) {
    log.warn(`树脂读数异常：${e && e.message ? e.message : e}（不中止）`);
  }

  // ---- 5. 双倍 / 幽境阶段 ----
  if (first.stage === "double") {
    const d = planDouble(planCtx());
    if (!d.step) {
      log.info(`双倍阶段跳过：${d.skip}`);
    } else {
      const r = await exec(d.step);
      if (!r.ok) {
        log.warn("双倍阶段失败，仍然进日常分析（§2.7：吃不到是损失，不该连累当天）");
      } else {
        // 事后校验（§2.2）：只在真的执行过且成功时做——跳过/失败时没有「吃到几次」可言，
        // 强行校验会拿差 0 的读数造出「双倍 0/3」这种误导性通知
        // 这次快照只喂 quota，不写 ctx.resin.after——通知里的 y 只认终点那次读数（最终读数或地脉后，§2.6.1）
        let snapB = null;
        try {
          snapB = await collectResin(READ_ORIGINAL);
        } catch (e) {
          log.warn(`双倍后重读树脂失败：${e && e.message ? e.message : e}`);
        }
        const rounds = roundsOfStep(d.step);
        const q = quota(snapA, snapB, rounds === null || rounds === undefined ? 3 : rounds);
        ctx.doubles = { total: q.total, done: q.used };
        log.info(summary(q));
        const miss = underQuotaMsg(q);
        if (miss) {
          log.warn(`双倍没吃满（${miss}）：中途有次数没吃到加倍。脚本不重试，直接进日常（§1）`);
        }
      }
    }
  } else if (first.stage === "stygian") {
    const st = planStygian(planCtx());
    if (!st.step) {
      log.info(`幽境跳过：${st.skip}`);
    } else {
      await exec(st.step);
    }
    // 幽境后不再重读：通知里的 y 只认终点那次读数（最终读数或地脉后，§2.6.1），中途值一概不进通知
  }

  // ---- 6. 日常分析（§2.4：阶段 1 → 轮换 → 兜底） ----
  // 地脉后那次全读若已是终点（后面没再打任何一场），最终读数就不重复读——afterLeyline 里置位
  let resinEndDone = false;
  try {
    const d = planDaily(planCtx());
    if (!d.step) {
      log.info(`日常阶段没有目标：${d.skip}`);
    } else {
      const r = await exec(d.step);
      if (!r.ok) {
        log.error("日常阶段失败，当日结束（§2.7：不换下一个条目，否则「只打第一个」会变成隐式轮换）");
      } else if (d.source === "rotation" && d.rotate) {
        // 成功打完才写盘（§4.4）：没打成不该算用掉一次
        const next = markPlayed(d.rotate.basePlayed, d.rotate.target);
        saveState(uid, next, account.rotation);
        log.info(`轮换已记录：${d.rotate.target.material || d.rotate.target.domain || d.rotate.target.type || ""}`);

        // 只有「轮换取到地脉」这条路要兜底：地脉不保证把树脂打干净（reusable §4）
        if (d.step.type === "leyline") resinEndDone = await afterLeyline();
      }
    }
  } catch (e) {
    ctx.failed.push({ label: "日常阶段", error: e && e.message ? e.message : String(e) });
    log.error(`日常阶段异常：${e && e.message ? e.message : e}`);
  }

  /** 把一次全读快照写成终点（`ctx.resin.after` + `full` + 一行日志）。开关关着整段不写，通知口径不变（§2.6.1） */
  function recordEndResin(snapEnd, label) {
    if (account.resinAfterRun === false) return;
    ctx.resin.after = originalOf(snapEnd);
    if (snapEnd && snapEnd.ok === true) {
      ctx.resin.full = {
        original: asCount(snapEnd.resin.original),
        condensed: asCount(snapEnd.resin.condensed),
        transient: asCount(snapEnd.resin.transient),
        fragile: asCount(snapEnd.resin.fragile),
        days: snapEnd.transientDays === undefined ? null : snapEnd.transientDays
      };
    }
    log.info(`${label}：原粹 ${ctx.resin.before === null ? "?" : ctx.resin.before}→${ctx.resin.after === null ? "?" : ctx.resin.after}`);
  }

  /**
   * 地脉之后：全读四项，还打得动就用兜底本补尾（§2.5）。
   * 这次读数兼任终点：原粹+浓缩喂 `spendable`（按「浓缩先于原粹」的顺位判，两项都得读），
   * 反正都要开弹窗，须臾/脆弱顺带读齐——后面没再打任何一场的话，它就是终点，最终读数不再读（§2.6.1）。
   * @returns true = 已有终点（最终读数可跳过）；false = 之后还有战斗或快照残缺，最终读数照旧读
   */
  async function afterLeyline() {
    let snap = null;
    try {
      snap = await collectResin();
    } catch (e) {
      log.warn(`地脉后重读树脂失败：${e && e.message ? e.message : e}`);
    }

    const can = spendable(snap);
    if (can === false) {
      // 已耗尽，后面没有战斗了：这次读数就是终点
      recordEndResin(snap, "地脉后读数");
      log.info("地脉完成后树脂已耗尽，跳过补刷");
      return true;
    }
    if (can === null) log.warn("树脂读数不完整，按「仍有剩余」处理，照常补刷（§2.6：以清空为先，可接受一次空传送）");

    const fb = planFallback(planCtx());
    if (!fb.step) {
      log.info(`补刷跳过：${fb.skip}`);
      // 判得动、又没兜底可打：同样没有后续战斗，这次读数就是终点。
      // 判不了（can===null）时快照可能残缺，交给最终读数再补一次全读，别拿残缺值当终点
      if (can === true) {
        recordEndResin(snap, "地脉后读数");
        return true;
      }
      return false;
    }
    await exec(fb.step);
    return false; // 兜底又打了一场，树脂变了，终点由最终读数给
  }

  // ---- 6.5 最终读数：所有战斗结束后读一次真值（§2.6.1） ----
  // 这是 ctx.resin.after 的默认来源；地脉后那次全读若已是终点（resinEndDone），这里不再读。
  // 开关取账户 json 的 resinAfterRun（界面「结束后树脂通知」勾选框）；一次都没打成功就不白跑这一趟。
  if (resinEndDone) {
    log.info("跳过最终读数：地脉后那次已是终点");
  } else if (ctx.runs.length > 0 && account.resinAfterRun !== false) {
    try {
      // 全读四项（不传 flags）：reference §2.6.1 的成文约定
      const snapEnd = await collectResin();
      recordEndResin(snapEnd, "最终读数");
    } catch (e) {
      log.warn(`最终读数失败：${e && e.message ? e.message : e}（通知里树脂一栏显示 x→?）`);
    }
  } else if (ctx.runs.length === 0) {
    log.info("跳过最终读数：本次未完成任何战斗");
  }

  // ---- 回过主界面：与「读不读树脂」无关 ----
  // 下面还有分解任务，且脚本随时可能被下一次运行接上，所以尝试过战斗就得回到干净界面。
  // 原先这一步挂在最终读数的分支里，关掉「结束后树脂通知」又打过战斗时会一路停在本体的秘境结算页。
  // 失败也算：`tasks` 侧只在成功路径上调 `backToMainUi`，抛错时界面留在秘境页或错误弹窗。
  // 用本体的 `genshin.returnMainUi()`（打开面板时用的也是它），失败只记日志，不影响结果。
  if (ctx.runs.length > 0 || ctx.failed.length > 0) {
    try {
      await genshin.returnMainUi();
    } catch (e) {
      log.warn(`回主界面失败（不影响结果）：${e && e.message ? e.message : e}`);
    }
  }

  // ---- 6.6 圣遗物分解：本日只跑一次，独立模块（§3.7） ----
  // 秘境 / 幽境任务里一律关掉本体自带的分解，所有分解都收在这一个点上。
  // 开关与星级上限只在 planSalvage 里判，这里不重复判。
  const sv = planSalvage(ctx.runs, account);
  if (!sv.on) {
    log.info(`圣遗物分解跳过：${sv.reason}`);
  } else {
    log.info(`▶ 圣遗物分解（≤${sv.star} 星）`);
    const r = await salvageArtifacts({ star: sv.star });
    if (!r.ok) {
      ctx.failed.push({ label: "圣遗物分解", error: r.error });
      log.error(`✗ 圣遗物分解失败：${r.error}`);
    } else if (r.action === "done") {
      log.info(`✓ 圣遗物分解完成（≤${r.star} 星）`);
      // 黑窗确认没点到时不判失败（本体同款），但这句要露出来——真卡住时别让人以为一定拆完了
      if (r.warning) log.warn(`圣遗物分解：${r.warning}`);
    } else {
      log.info("圣遗物分解：无可分解的圣遗物");
    }
  }

  // ---- 7. 收尾：一份文本，日志与通知共用（§2.8） ----
  log.info("----- 汇总 -----");
  log.info(render(ctx));
  notify(ctx);
}

(async function () {
  try {
    await run();
  } catch (e) {
    // §2.8 兜底：未捕获异常也发一条 error 通知。ctx 还没建（早段就炸）就补一块空的
    const msg = e && e.message ? e.message : String(e);
    log.error(`运行异常：${msg}`);
    if (!ctx) ctx = createCtx({ account: null });
    ctx.failed.push({ label: "运行异常", error: msg });
    log.info(render(ctx));
    notify(ctx);
  } finally {
    // 树脂模板 Mat 不在这里放：`collectResin` 每次调用自己收尾（v6.5 起内收），
    // 本文件多放一次只会和下一轮加载抢同一份缓存。`salvage.js` 仍是自管自放。
  }
})();
