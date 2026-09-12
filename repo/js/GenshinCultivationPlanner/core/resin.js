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
  // BetterGI 当前指定树脂模式的内部顺序固定为：浓缩 → 原粹 → 须臾 → 脆弱。
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
