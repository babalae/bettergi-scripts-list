const UNLIMITED_USE_COUNT = 9999;

// 表示领奖的树脂等价值，不表示此时还要额外扣除同等数量的原粹树脂。
export const RESIN_POINTS = Object.freeze({ original20: 20, original40: 40, condensed: 60, transient: 60, fragile: 60 });

/**
 * 将脚本设置转换为 AutoDomainParam 可直接使用的树脂策略。
 * 指定次数使用 9999 作为“本次尽量用完该类型”的上限；BetterGI 在树脂不足时会自行退出。
 */
export function buildDomainResinPolicy(settings) {
  const enabled = {
    // 不合成树脂；默认优先消耗当前已有的浓缩树脂，再使用原粹树脂。
    original: settings.domainUseOriginalResin !== false,
    condensed: settings.domainUseCondensedResin !== false,
    transient: settings.domainUseTransientResin === true,
    fragile: settings.domainUseFragileResin === true,
  };
  const names = {
    original: '原粹树脂',
    condensed: '浓缩树脂',
    transient: '须臾树脂',
    fragile: '脆弱树脂',
  };
  // 设置页当前提供的顺序组合以浓缩 → 原粹 → 须臾 → 脆弱为基础，并显式传给 BetterGI 0.64。
  const priority = ['condensed', 'original', 'transient', 'fragile']
    .filter((key) => enabled[key]).map((key) => names[key]);
  return {
    specifyResinUse: true,
    priority,
    originalResinUseCount: enabled.original ? UNLIMITED_USE_COUNT : 0,
    // BetterGI 0.64 also inherits separate 20/40-resin counters from its global config.
    // This script uses the generic counter in normal mode, so always clear both split counters.
    originalResin20UseCount: 0,
    originalResin40UseCount: 0,
    condensedResinUseCount: enabled.condensed ? UNLIMITED_USE_COUNT : 0,
    transientResinUseCount: enabled.transient ? UNLIMITED_USE_COUNT : 0,
    fragileResinUseCount: enabled.fragile ? UNLIMITED_USE_COUNT : 0,
  };
}

/**
 * 将脚本编译出的树脂规则写入 BetterGI 0.64 的自动秘境参数。
 * 显式写入优先级，避免继承全局“自动秘境”配置后改变脚本设置页展示的顺序。
 */
export function applyDomainResinPolicyToParam(param, policy) {
  if (!param?.ResinPriorityList
    || typeof param.ResinPriorityList.Clear !== 'function'
    || typeof param.ResinPriorityList.Add !== 'function') {
    throw new Error('当前 BetterGI 未提供自动秘境树脂优先级接口；请升级 BetterGI 0.66.0 或更高版本');
  }
  param.SpecifyResinUse = policy.specifyResinUse;
  param.ResinPriorityList.Clear();
  for (const name of policy.priority) param.ResinPriorityList.Add(name);
  param.OriginalResinUseCount = policy.originalResinUseCount;
  param.OriginalResin20UseCount = policy.originalResin20UseCount ?? 0;
  param.OriginalResin40UseCount = policy.originalResin40UseCount ?? 0;
  param.CondensedResinUseCount = policy.condensedResinUseCount;
  param.TransientResinUseCount = policy.transientResinUseCount;
  param.FragileResinUseCount = policy.fragileResinUseCount;
}

/**
 * 把任务总领取上限安全地转换为 BetterGI 的“单一树脂类型次数”。
 * BetterGI 的四个次数是分别累计而非总上限，因此有限预算只能选择一种已授权树脂，
 * 否则每种树脂各刷 N 次会突破用户设置的总次数。
 */
export function limitDomainResinPolicy(policy, maxClaims) {
  if (maxClaims == null) return { ...policy };
  if (!Number.isInteger(maxClaims) || maxClaims <= 0) throw new Error('秘境领取上限必须是正整数');
  const fieldByName = {
    '原粹树脂': 'originalResinUseCount',
    '浓缩树脂': 'condensedResinUseCount',
    '须臾树脂': 'transientResinUseCount',
    '脆弱树脂': 'fragileResinUseCount',
  };
  const selectedName = policy.priority[0];
  const selectedField = fieldByName[selectedName];
  if (!selectedField) throw new Error('有限领取模式下没有可用的秘境树脂类型');
  return {
    ...policy,
    priority: [selectedName],
    originalResinUseCount: 0,
    condensedResinUseCount: 0,
    transientResinUseCount: 0,
    fragileResinUseCount: 0,
    [selectedField]: maxClaims,
    maxClaims,
    boundedResinType: selectedName,
  };
}

/**
 * 把点数上限预分配成原生接口分别计数的额度，各项之和不超过总预算。
 * 不知道实际库存与消耗时，不将某一类型未用完的额度再次分给另一类型。
 */
export function limitDomainResinPolicyByPoints(policy, maxResin) {
  if (!Number.isSafeInteger(maxResin) || maxResin < 20 || maxResin % 20 !== 0 || maxResin > 60000) {
    throw new Error('秘境树脂上限必须是20到60000之间的20点整数倍');
  }
  const bounded = { ...policy, priority: [], originalResinUseCount: 0,
    originalResin20UseCount: 0, originalResin40UseCount: 0,
    condensedResinUseCount: 0, transientResinUseCount: 0, fragileResinUseCount: 0 };
  const choices = {
    浓缩树脂: [['condensed', 'condensedResinUseCount', '浓缩']],
    原粹树脂: [['original40', 'originalResin40UseCount', '40点原粹'], ['original20', 'originalResin20UseCount', '20点原粹']],
    须臾树脂: [['transient', 'transientResinUseCount', '须臾']],
    脆弱树脂: [['fragile', 'fragileResinUseCount', '脆弱']],
  };
  const allocations = [];
  let remaining = maxResin;
  for (const name of new Set(policy.priority)) {
    if (!choices[name]) throw new Error(`未知的秘境树脂类型：“${name}”`);
    let used = false;
    for (const [type, field, label] of choices[name]) {
      // 顺序只是优先级，不代表授权；还必须检查对应的原次数配置。
      const enabled = type.startsWith('original')
        ? policy.originalResinUseCount > 0 || policy[field] > 0 : policy[field] > 0;
      if (!enabled) continue;
      const pointsPerUse = RESIN_POINTS[type];
      const count = Math.floor(remaining / pointsPerUse);
      if (count === 0) continue;
      bounded[field] = count;
      remaining -= count * pointsPerUse;
      allocations.push({ type, label, count, pointsPerUse });
      used = true;
    }
    if (used) bounded.priority.push(name);
  }
  if (allocations.length === 0) {
    throw new Error(`所选秘境树脂无法执行${maxResin}点预算；请增加上限或允许使用原粹树脂`);
  }
  return { ...bounded, maxClaims: allocations.reduce((sum, item) => sum + item.count, 0),
    resinBudget: { maxResin, plannedResin: maxResin - remaining, unallocatedResin: remaining, allocations } };
}
