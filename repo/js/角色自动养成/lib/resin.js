// lib/resin.js —— 树脂参数构造（纯逻辑，可单测，不碰 BGI 全局）
//
// BGI 的两种模式（源码 AutoDomainTask.cs / AutoDomainParam.cs，0.66.0 核对）：
//   1) specifyResinUse = false  → 「用尽所有浓缩树脂和原粹树脂后结束」：
//      每轮现场识别树脂，先浓缩后原粹，见底就停。轮数只是个上限，配多了不会报错。
//   2) specifyResinUse = true   → 按 resinPriorityList 指定的各类型次数领取；
//      若一个可用选项都没有，会直接退出秘境并提示「设置的刷取次数过多」。
//
// 所以默认走 1)：既不猜树脂存量（读不到），又自动吃到浓缩树脂；
// 只有要动用须臾 / 脆弱树脂时才切到 2)。
export const RESIN_CONDENSED = '浓缩树脂';
export const RESIN_ORIGINAL = '原粹树脂';
export const RESIN_TRANSIENT = '须臾树脂';
export const RESIN_FRAGILE = '脆弱树脂';

/**
 * 秘境树脂字段
 * @param {number} runs 本轮计划刷几次（作为轮数上限）
 * @param {{allowFragileResin?:boolean, useTransientResin?:boolean}} cfg
 * @returns {object} 可直接 setProp 到 AutoDomainParam 的字段
 */
export function domainResinFields(runs, cfg = {}) {
  const n = Math.max(0, Math.floor(Number(runs) || 0));
  const useFragile = !!cfg.allowFragileResin;
  const useTransient = !!cfg.useTransientResin;
  if (!useFragile && !useTransient) {
    // 自动模式：BGI 先浓缩后原粹，树脂没了自己停
    return { specifyResinUse: false };
  }
  const priority = [RESIN_CONDENSED, RESIN_ORIGINAL];
  const fields = {
    specifyResinUse: true,
    resinPriorityList: priority,
    originalResinUseCount: n,
    condensedResinUseCount: n,
  };
  if (useTransient) {
    priority.push(RESIN_TRANSIENT);
    fields.transientResinUseCount = n;
  }
  if (useFragile) {
    priority.push(RESIN_FRAGILE);
    fields.fragileResinUseCount = n;
  }
  return fields;
}

/**
 * 地脉花树脂字段（BGI 的 AutoLeyLineOutcropParam 没有优先级列表，只有两个开关）
 * @param {number} runs
 * @param {{allowFragileResin?:boolean, useTransientResin?:boolean}} cfg
 */
export function leylineResinFields(runs, cfg = {}) {
  return {
    count: Math.max(0, Math.floor(Number(runs) || 0)),
    useFragileResin: !!cfg.allowFragileResin,
    useTransientResin: !!cfg.useTransientResin,
    isResinExhaustionMode: false,
  };
}

/** 说明本轮树脂策略，写进日志，方便回看为什么刷了 N 次 */
export function describeResinPolicy(cfg = {}) {
  const useFragile = !!cfg.allowFragileResin;
  const useTransient = !!cfg.useTransientResin;
  if (!useFragile && !useTransient) return '自动：浓缩→原粹，树脂见底即停';
  const list = ['浓缩', '原粹'];
  if (useTransient) list.push('须臾');
  if (useFragile) list.push('脆弱');
  return `指定优先级：${list.join(' → ')}（每种上限=本次轮数）`;
}
