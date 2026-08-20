// 自动秘境执行：每批在提升指南页 OCR 树脂，按缺口选 3/2/1 刷一查；树脂不够时用耗尽模式
import { getS } from "../core/common.js";
import { buildPlan, checkPlan } from "./solver.js";
import { ensureGuidePage, refreshPlanFromGuide, readResin } from "./guide.js";

export async function runDomainPhase(entries, rowY) {
  let current = entries.filter(e => Number(e.rowY) === rowY);
  let item = current.find(e => e.domainName) || current[0];
  if (!item || !item.domainName) {
    log.warn("未记录到秘境名，跳过自动秘境");
    return;
  }

  const autoStop = getS("autoStopWhenEnough", true) !== false;

  // 只以“选中的第一个系列”作为停止条件
  let plan = buildPlan(current);
  let targetGroup = plan.groups.find(g => g.items.some(i => i.entry === item)) || plan.groups[0];
  let stopPlan = { groups: [targetGroup], flat: targetGroup.items };
  let zeroCounts = plan.flat.map(() => 0);

  // 先用本次扫描到的背包库存判断一次，材料已齐就直接跳过
  const initialStatus = checkPlan(stopPlan, zeroCounts);
  if (autoStop && initialStatus.ok) {
    log.info("库存已满足需求（剩余 {s}），跳过刷取", initialStatus.surplusLowUnits);
    try { notification.send("材料已齐，无需刷取：" + item.domainName); } catch (e) { }
    return;
  }
  if (!initialStatus.ok) {
    log.info("当前缺口（低品质单位）: {d}", initialStatus.deficitLowUnits);
  }

  const roundSetting = parseInt(getS("domainRoundNum", "9999"), 10);
  const maxRounds = (!Number.isFinite(roundSetting) || roundSetting <= 0) ? 9999 : roundSetting;

  let stopScript = false;

  const param = new AutoDomainParam();
  param.DomainName = item.domainName;
  // 不设置 DomainRoundNum：默认 9999，由指定树脂计数/树脂耗尽判定退出时机
  param.RewardRecognitionEnabled = false;

  // 周日/限时全开奖励序号：优先用图标x位置判断出的序号，其次用界面设置
  let sundayValue = "";
  if (item.sundayPos === 1 || item.sundayPos === 2 || item.sundayPos === 3) {
    sundayValue = String(item.sundayPos);
    log.info("[奖励序号] 按图标位置: {v}", sundayValue);
  } else {
    sundayValue = String(getS("sundaySelectedValue", ""));
  }
  if (sundayValue === "1" || sundayValue === "2" || sundayValue === "3") {
    param.SundaySelectedValue = sundayValue;
    log.info("[奖励序号] 使用设置值: {v}", sundayValue);
  }

  const party = String(getS("partyName", ""));
  if (party) param.PartyName = party;

  log.info("[自动秘境] {name}", item.domainName);

  let totalRounds = 0;
  for (let batchIndex = 1; totalRounds < maxRounds; batchIndex++) {
    // 缺口 >160 直接耗尽模式，不检查树脂；其余先 OCR 树脂再决定本批
    await ensureGuidePage();
    const d = checkPlan(stopPlan, zeroCounts).deficitLowUnits;

    let modeName;
    let exhaust = false;
    let roundsThisBatch;
    let resin = null;

    if (d > 160) {
      // 缺口 >160：直接耗尽模式，一把刷完并结束整体流程
      modeName = "树脂耗尽模式";
      exhaust = true;
      roundsThisBatch = maxRounds - totalRounds;
      param.SpecifyResinUse = false;
      param.CondensedResinUseCount = 0;
      param.OriginalResin40UseCount = 0;
      param.OriginalResinUseCount = 0;
    } else {
      resin = await readResin();
      if (resin.rounds <= 0) {
        log.info("树脂不足，自动停止刷取");
        try { notification.send("树脂不足，停止刷取：" + item.domainName); } catch (e) { }
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
        param.OriginalResinUseCount = 0;
      } else {
        // 浓缩优先：1 个浓缩 = 1 次；剩余轮数用原粹树脂，40 树脂/次
        const condensedUse = Math.min(resin.condensed, need);
        const originalUse = need - condensedUse;
        modeName = need >= 3 ? "三刷一查" : (need >= 2 ? "两刷一查" : "一刷一查");
        roundsThisBatch = need;
        param.SpecifyResinUse = true;
        param.CondensedResinUseCount = condensedUse;
        param.OriginalResin40UseCount = originalUse;
        param.OriginalResinUseCount = 0;
      }
    }

    totalRounds += roundsThisBatch;
    if (exhaust) {
      log.info("[批次] {batch}：{mode}（刷到树脂耗尽），缺口 {d}",
        batchIndex, d);
    } else {
      log.info("[批次] {batch}：{mode}，缺口 {d}，树脂 浓缩{c}/原粹{o}，本批 {n} 轮，累计 {total}/{max}",
        batchIndex, modeName, d, resin.condensed, resin.original, roundsThisBatch, totalRounds, maxRounds);
    }

    // 回主界面交给 BGI（传送、进本、战斗、领奖都由 BGI 负责）
    await genshin.returnMainUi();
    await sleep(1000);

    try {
      await dispatcher.runAutoDomainTask(param);

      // 仅树脂耗尽模式：刷取结束即整体流程完成
      if (exhaust) {
        log.info("[树脂耗尽模式] 刷取结束，流程完成");
        try { notification.send("树脂耗尽模式刷取结束，停止刷取：" + item.domainName); } catch (e) { }
        stopScript = true;
        break;
      }

      // 批后完整重扫该行（与重开脚本第一次运行完全一致）
      const refreshed = await refreshPlanFromGuide(entries, rowY);
      if (!refreshed) {
        log.warn("[刷新] 重扫失败，停止流程");
        stopScript = true;
        break;
      }

      current = entries.filter(e => Number(e.rowY) === rowY);
      if (current.length === 0) {
        // 该行已无标注：交给主流程扫下一行；没有下一行则脚本自然结束
        log.info("该行已无待刷材料");
        break;
      }

      item = current.find(e => e.domainName) || current[0];
      if (!item.domainName) {
        // 与首次运行一致：该行秘境名识别不到就不刷，继续下一行
        log.warn("重扫后未识别到可刷秘境，停止该行刷取");
        break;
      }
      param.DomainName = item.domainName;
      if (item.sundayPos === 1 || item.sundayPos === 2 || item.sundayPos === 3) {
        param.SundaySelectedValue = String(item.sundayPos);
        log.info("[奖励序号] 重扫后按图标位置: {v}", item.sundayPos);
      }

      // 用重扫结果重建计划（等价于重开脚本重新判断）
      plan = buildPlan(current);
      targetGroup = plan.groups.find(g => g.items.some(i => i.entry === item)) || plan.groups[0];
      stopPlan = { groups: [targetGroup], flat: targetGroup.items };
      zeroCounts = plan.flat.map(() => 0);

      const status = checkPlan(stopPlan, zeroCounts);
      if (autoStop && status.ok) {
        log.info("材料已集齐，停止刷取（剩余 {s}）", status.surplusLowUnits);
        try { notification.send("材料已集齐，停止刷取：" + item.domainName); } catch (e) { }
        break;
      }

      const missing = [].concat(...status.groups.map(g => g.missing || []));
      log.info("[缺口] 第 {batch} 批后 {d}，各档 {missing}", batchIndex, status.deficitLowUnits, JSON.stringify(missing));
    } catch (e) {
      if (String(e.message).includes("树脂不足") || String(e.message).includes("未找到可用的树脂")) {
        log.info("树脂耗尽，自动停止刷取");
        try { notification.send("树脂耗尽，停止刷取：" + item.domainName); } catch (e2) { }
        if (exhaust) {
          stopScript = true;
        }
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

  return { stopScript };
}
