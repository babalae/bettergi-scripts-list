// 自动秘境执行：同一行可能包含多个材料系列，按系列逐个刷。
// 每批在提升指南页 OCR 树脂，按当前系列缺口选 3/2/1 刷一查；树脂不够时用耗尽模式
import { getS } from "../core/common.js";
import { buildPlan, checkPlan } from "./solver.js";
import { ensureGuidePage, refreshPlanFromGuide, readResin } from "./guide.js";

export async function runDomainPhase(entries, rowY) {
  let current = entries.filter(e => Number(e.rowY) === rowY);
  if (current.length === 0) {
    return { stopScript: false, rowGone: false };
  }

  let plan = buildPlan(current);
  let zeroCounts = plan.flat.map(() => 0);

  // 行内可能有多个系列：只有所有系列都满足时才整行跳过
  const fullStatus = checkPlan(plan, zeroCounts);
  if (fullStatus.ok) {
    const firstDomain = current.find(e => e.domainName);
    log.info("库存已满足需求（剩余 {s}），跳过刷取", fullStatus.surplusLowUnits);
    try { notification.send("材料已齐，无需刷取：" + (firstDomain ? firstDomain.domainName : "")); } catch (e) { }
    return { stopScript: false, rowGone: false };
  }

  const singleStatus = (group) =>
    checkPlan({ groups: [group], flat: group.items }, zeroCounts);
  const pickUnsatisfied = () => {
    for (const g of plan.groups) {
      const st = singleStatus(g);
      if (!st.ok) return { group: g, status: st };
    }
    return null;
  };
  const pickItem = (group) =>
    group.items.find(i => i.entry && i.entry.domainName) || group.items[0];

  let picked = pickUnsatisfied();
  if (!picked) {
    // 正常不会走到这里，按整行完成处理
    return { stopScript: false, rowGone: false };
  }
  let targetGroup = picked.group;
  let item = pickItem(targetGroup);
  if (!item || !item.entry.domainName) {
    log.warn("未记录到秘境名，跳过自动秘境");
    return { stopScript: false, rowGone: false };
  }

  // 已从配置移除：固定最大秘境轮数不受限（沿用原默认 9999）
  const maxRounds = 9999;

  let stopScript = false;
  // 该行是否已经消失（下方行会上移；main 用这个值触发完全重扫）
  let rowGone = false;

  const param = new AutoDomainParam();
  param.DomainName = item.entry.domainName;
  // 不设置 DomainRoundNum：默认 9999，由指定树脂计数/树脂耗尽判定退出时机
  param.RewardRecognitionEnabled = false;
  // AutoDomainParam 会继承 BGI 本体配置：显式清零，只允许本插件显式指定的树脂档
  param.CondensedResinUseCount = 0;
  param.OriginalResin20UseCount = 0;
  param.OriginalResin40UseCount = 0;
  param.OriginalResinUseCount = 0;
  param.TransientResinUseCount = 0;
  param.FragileResinUseCount = 0;
  // 不执行 BGI 本体的圣遗物分解
  param.AutoArtifactSalvage = false;

  // 周日/限时全开奖励序号：图标位置优先，其次 sundaySelectedValue，最后保持 BGI 本体配置
  // 切换系列时重设，避免沿用上一系列的档位
  const bgiSundayDefault = String(param.SundaySelectedValue || "");
  const updateRewardSelection = () => {
    const pos = item.entry.sundayPos;
    if (pos === 1 || pos === 2 || pos === 3) {
      param.SundaySelectedValue = String(pos);
      log.info("[奖励序号] 按图标位置: {v}", pos);
    } else {
      const setting = String(getS("sundaySelectedValue", ""));
      if (setting === "1" || setting === "2" || setting === "3") {
        param.SundaySelectedValue = setting;
        log.info("[奖励序号] 使用设置值: {v}", setting);
      } else {
        param.SundaySelectedValue = bgiSundayDefault;
      }
    }
  };
  updateRewardSelection();

  const party = String(getS("partyName", ""));
  if (party) param.PartyName = party;

  log.info("[自动秘境] {name}", item.entry.domainName);

  let totalRounds = 0;
  for (let batchIndex = 1; totalRounds < maxRounds; batchIndex++) {
    // 缺口只按当前系列算
    await ensureGuidePage();
    const d = singleStatus(targetGroup).deficitLowUnits;
    log.info("[缺口] 当前系列 {g}，缺口 {d}（低品质单位）", targetGroup.base, d);

    let modeName;
    let exhaust = false;
    let roundsThisBatch;
    let resin = null;
    let original40Use = 0;
    let original20Use = 0;

    if (d > 160) {
      // 当前系列缺口 >160：直接耗尽模式，一把刷完并结束整体流程
      modeName = "树脂耗尽模式";
      exhaust = true;
      roundsThisBatch = maxRounds - totalRounds;
      param.SpecifyResinUse = false;
      param.CondensedResinUseCount = 0;
      param.OriginalResin40UseCount = 0;
      param.OriginalResin20UseCount = 0;
      param.OriginalResinUseCount = 0;
    } else {
      resin = await readResin();
      if (resin.rounds <= 0) {
        log.info("树脂不足，自动停止刷取");
        try { notification.send("树脂不足，停止刷取：" + item.entry.domainName); } catch (e) { }
        stopScript = true;
        break;
      }
      const need = d >= 120 ? 3 : (d >= 50 ? 2 : 1);
      if (need >= 2 && resin.rounds < need) {
        // 树脂不够 2/3 刷：也走耗尽模式
        modeName = "树脂耗尽模式";
        exhaust = true;
        roundsThisBatch = maxRounds - totalRounds;
        param.SpecifyResinUse = false;
        param.CondensedResinUseCount = 0;
        param.OriginalResin40UseCount = 0;
        param.OriginalResin20UseCount = 0;
        param.OriginalResinUseCount = 0;
      } else {
        // 浓缩优先：1 个浓缩 = 1 次；剩余轮数用原粹树脂，
        // 先按 40/次分配，40 不够的轮次用 20/次补（原粹剩余 20-39 时）
        const condensedUse = Math.min(resin.condensed, need);
        const originalUse = need - condensedUse;
        original40Use = Math.min(originalUse, Math.floor(resin.original / 40));
        original20Use = Math.max(0, originalUse - original40Use);
        modeName = need >= 3 ? "三刷一查" : (need >= 2 ? "两刷一查" : "一刷一查");
        roundsThisBatch = need;
        param.SpecifyResinUse = true;
        param.CondensedResinUseCount = condensedUse;
        param.OriginalResin40UseCount = original40Use;
        param.OriginalResin20UseCount = original20Use;
        param.OriginalResinUseCount = 0;
      }
    }

    totalRounds += roundsThisBatch;
    if (exhaust) {
      log.info("[批次] {batch}：{mode}（刷到树脂耗尽），当前系列缺口 {d}",
        batchIndex, modeName, d);
    } else {
      log.info("[批次] {batch}：{mode}，当前系列缺口 {d}，树脂 浓缩{c}/原粹{o}，本批 {n} 轮（原粹40x{f}/20x{t}），累计 {total}/{max}",
        batchIndex, modeName, d, resin.condensed, resin.original, roundsThisBatch, original40Use, original20Use, totalRounds, maxRounds);
    }

    // 回主界面交给 BGI（传送、进本、战斗、领奖都由 BGI 负责）
    await genshin.returnMainUi();
    await sleep(1000);

    try {
      await dispatcher.runAutoDomainTask(param);

      // 仅树脂耗尽模式：刷取结束即整体流程完成
      if (exhaust) {
        log.info("[树脂耗尽模式] 刷取结束，流程完成");
        try { notification.send("树脂耗尽模式刷取结束，停止刷取：" + item.entry.domainName); } catch (e) { }
        stopScript = true;
        break;
      }

      // 批后完整重扫该行（与重开脚本第一次运行完全一致）
      const refreshed = await refreshPlanFromGuide(entries, rowY, item.entry.domainName);
      if (!refreshed) {
        log.warn("[刷新] 重扫失败，停止流程");
        stopScript = true;
        break;
      }

      current = entries.filter(e => Number(e.rowY) === rowY);
      if (current.length === 0) {
        // 该行已无标注（已消失）：通知 main 完全重扫剩余行
        log.info("该行已无待刷材料");
        rowGone = true;
        break;
      }

      // 重建当前行计划，继续挑“还有缺口”的系列；都满足才算该行完成
      plan = buildPlan(current);
      zeroCounts = plan.flat.map(() => 0);
      const nextPicked = pickUnsatisfied();
      if (!nextPicked) {
        const afterStatus = checkPlan(plan, zeroCounts);
        log.info("材料已集齐，停止刷取（剩余 {s}）", afterStatus.surplusLowUnits);
        try { notification.send("材料已集齐，停止刷取：" + item.entry.domainName); } catch (e) { }
        break;
      }

      targetGroup = nextPicked.group;
      item = pickItem(targetGroup);
      if (!item.entry.domainName) {
        // 与首次运行一致：该系列秘境名识别不到就不刷，继续下一行
        log.warn("重扫后未识别到可刷秘境，停止该行刷取");
        break;
      }
      param.DomainName = item.entry.domainName;
      updateRewardSelection();

      const missing = [].concat(...nextPicked.status.groups.map(g => g.missing || []));
      log.info("[缺口] 第 {batch} 批后，下一系列缺口 {d}，各档 {missing}",
        batchIndex, nextPicked.status.deficitLowUnits, JSON.stringify(missing));
    } catch (e) {
      if (String(e.message).includes("树脂不足") || String(e.message).includes("未找到可用的树脂")) {
        log.info("树脂耗尽，自动停止刷取");
        try { notification.send("树脂耗尽，停止刷取：" + item.entry.domainName); } catch (e2) { }
        // 无论是否耗尽模式：树脂类错误都结束整体流程，避免逐行空转
        stopScript = true;
      } else {
        log.error("第 {batch} 批自动秘境失败: {err}", batchIndex, e.message);
        try { notification.error("自动秘境失败：" + e.message); } catch (e2) { }
        // 树脂耗尽模式下无论以何种方式结束，都不再继续后续流程
        if (exhaust) {
          stopScript = true;
        }
      }
      break;
    }
  }

  return { stopScript, rowGone };
}
