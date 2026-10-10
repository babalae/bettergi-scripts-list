const TASK_CATEGORY_LABELS = Object.freeze({
  boss: '世界 Boss',
  limitedDomain: '限时培养秘境',
  domain: '普通培养秘境',
  artifactDomain: '圣遗物填充',
});

const TASK_CATEGORY_BY_LABEL = Object.freeze(Object.fromEntries(
  Object.entries(TASK_CATEGORY_LABELS).map(([key, label]) => [label, key]),
));

const DEFAULT_TASK_ORDER = Object.freeze(['boss', 'limitedDomain', 'domain', 'artifactDomain']);
const CUSTOM_MODE_LABEL = '按顺序刷多类';
const LEGACY_MODE_LABEL = '一次只刷一类（推荐）';
const LEGACY_CUSTOM_MODE_LABEL = '自定义顺序与上限';
const LEGACY_SINGLE_MODE_LABEL = '兼容当前规则';
const UNLIMITED_CLAIM_LABEL = '用完可用树脂';
const LEGACY_UNLIMITED_CLAIM_LABEL = '全部';
const ROUTE_TIMING_BY_LABEL = Object.freeze({
  '树脂任务前': 'beforeResin',
  '树脂任务后': 'afterResin',
});
const MAX_CLAIM_LIMIT = 9999;

/**
 * 把设置页中的树脂规则编译为不可变策略。
 * 兼容模式完全复现 0.9.0 行为；高级字段只在自定义模式下生效。
 */
export function compileResinPolicyV2(settings = {}) {
  const modeLabel = String(settings.resinRuleMode ?? LEGACY_MODE_LABEL).trim();
  if (![LEGACY_MODE_LABEL, CUSTOM_MODE_LABEL, LEGACY_SINGLE_MODE_LABEL, LEGACY_CUSTOM_MODE_LABEL].includes(modeLabel)) {
    throw new Error(`未知的树脂规则模式：“${modeLabel}”`);
  }

  const custom = modeLabel === CUSTOM_MODE_LABEL || modeLabel === LEGACY_CUSTOM_MODE_LABEL;
  const taskRules = custom
    ? parseTaskRules(settings)
    : DEFAULT_TASK_ORDER.map((category) => ({ category, maxClaims: null }));
  const taskOrder = taskRules.map((rule) => rule.category);
  const taskLimits = Object.fromEntries(taskRules.map((rule) => [
    rule.category,
    { maxClaims: rule.maxClaims },
  ]));
  const routeTiming = custom ? parseRouteTiming(settings.routeTiming) : 'afterResin';

  return deepFreeze({
    schemaVersion: 2,
    mode: custom ? 'custom' : 'legacy',
    taskOrder,
    taskLimits,
    resinTypes: {
      original: settings.domainUseOriginalResin !== false,
      condensed: settings.domainUseCondensedResin !== false,
      transient: settings.domainUseTransientResin === true,
      fragile: settings.domainUseFragileResin === true,
    },
    routeTiming,
    artifactFallbackEnabled: settings.artifactDomainEnabled === true,
  });
}

/** 根据候选任务返回其 V2 调度类别。 */
export function getTaskPolicyType(task = {}) {
  if (task.executionType === 'boss') return 'boss';
  if (task.executionType === 'artifactDomain') return 'artifactDomain';
  if (task.executionType === 'domain') return task.limited === true ? 'limitedDomain' : 'domain';
  return null;
}

/** 生成设置解析后的可读摘要，日志和配置预览共用同一结果。 */
export function formatResinPolicyPreview(policy) {
  const order = policy.taskOrder.map((category) => {
    const limit = policy.taskLimits[category]?.maxClaims;
    return `${TASK_CATEGORY_LABELS[category]}（${limit == null ? UNLIMITED_CLAIM_LABEL : `最多 ${limit} 次`}）`;
  }).join(' → ');
  const resinNames = [
    ['condensed', '浓缩'],
    ['original', '原粹'],
    ['transient', '须臾'],
    ['fragile', '脆弱'],
  ].filter(([key]) => policy.resinTypes[key]).map(([, name]) => name);
  return {
    mode: policy.mode === 'custom' ? CUSTOM_MODE_LABEL : LEGACY_MODE_LABEL,
    order,
    resinTypes: resinNames.join(' → ') || '未允许任何秘境树脂',
    routeTiming: policy.routeTiming === 'beforeResin' ? '树脂任务前' : '树脂任务后',
  };
}

function parseTaskRules(settings) {
  const rules = [1, 2, 3, 4].map((index) => {
    const value = String(settings[`resinTaskPriority${index}`] ?? '').trim();
    const [taskLabel, inlineLimit] = splitTaskAndLimit(value);
    const category = TASK_CATEGORY_BY_LABEL[taskLabel];
    if (!category) throw new Error(`树脂任务 ${index} 无效：“${taskLabel || '未选择'}”`);
    const maxClaims = inlineLimit == null
      ? parseClaimLimit(settings[claimLimitField(category)], TASK_CATEGORY_LABELS[category])
      : parseClaimLimit(inlineLimit.replace(/\s*次$/, ''), TASK_CATEGORY_LABELS[category]);
    return { category, maxClaims };
  });
  const categories = rules.map((rule) => rule.category);
  const duplicates = categories.filter((value, index) => categories.indexOf(value) !== index);
  if (duplicates.length > 0) {
    const names = [...new Set(duplicates)].map((value) => TASK_CATEGORY_LABELS[value]);
    throw new Error(`树脂任务存在重复项：${names.join('、')}`);
  }
  const missing = DEFAULT_TASK_ORDER.filter((value) => !categories.includes(value));
  if (missing.length > 0) {
    throw new Error(`树脂任务缺少：${missing.map((value) => TASK_CATEGORY_LABELS[value]).join('、')}`);
  }
  return rules;
}

function splitTaskAndLimit(value) {
  const match = value.match(/^(.+?)\s*[｜|]\s*(.+)$/);
  return match ? [match[1].trim(), match[2].trim()] : [value, null];
}

function parseClaimLimit(value, label) {
  const text = String(value ?? UNLIMITED_CLAIM_LABEL).trim();
  if ([UNLIMITED_CLAIM_LABEL, LEGACY_UNLIMITED_CLAIM_LABEL].includes(text)) return null;
  if (!/^\d+$/.test(text)) throw new Error(`${label}领奖上限必须是正整数或“${UNLIMITED_CLAIM_LABEL}”：“${text}”`);
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count <= 0 || count > MAX_CLAIM_LIMIT) {
    throw new Error(`${label}领奖上限必须在 1 到 ${MAX_CLAIM_LIMIT} 之间：“${text}”`);
  }
  return count;
}

function parseRouteTiming(value) {
  const label = String(value ?? '树脂任务后').trim();
  const timing = ROUTE_TIMING_BY_LABEL[label];
  if (!timing) throw new Error(`未知的路线执行时机：“${label}”`);
  return timing;
}

function claimLimitField(category) {
  return {
    boss: 'bossMaxClaims',
    limitedDomain: 'limitedDomainMaxClaims',
    domain: 'domainMaxClaims',
    artifactDomain: 'artifactDomainMaxClaims',
  }[category];
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
