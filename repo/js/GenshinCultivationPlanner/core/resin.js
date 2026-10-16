const UNLIMITED_USE_COUNT = 9999;

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
    throw new Error('当前 BetterGI 未提供 0.64.0 所需的自动秘境树脂优先级接口；请升级 BetterGI 0.64.0 或更高版本');
  }
  param.SpecifyResinUse = policy.specifyResinUse;
  param.ResinPriorityList.Clear();
  for (const name of policy.priority) param.ResinPriorityList.Add(name);
  param.OriginalResinUseCount = policy.originalResinUseCount;
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
