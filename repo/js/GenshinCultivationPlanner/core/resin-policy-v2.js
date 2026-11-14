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
const SINGLE_MODE_LABEL = '等级优先（推荐）';
const UNLIMITED_CLAIM_LABEL = '用完可用树脂';
const ROUTE_TIMING_BY_LABEL = Object.freeze({
  '树脂任务前': 'beforeResin',
  '树脂任务后': 'afterResin',
});

/**
 * 把设置页中的树脂规则编译为不可变策略。
 * 默认等级优先；高级字段只在自定义模式下生效，有限额度统一按树脂点数。
 */
export function compileResinPolicyV2(settings = {}) {
  const modeLabel = String(settings.resinRuleMode ?? SINGLE_MODE_LABEL).trim();
  if (![SINGLE_MODE_LABEL, CUSTOM_MODE_LABEL].includes(modeLabel)) {
    throw new Error(`未知的树脂规则模式：“${modeLabel}”`);
  }

  const custom = modeLabel === CUSTOM_MODE_LABEL;
  const taskRules = custom
    ? parseTaskRules(settings)
    : DEFAULT_TASK_ORDER.map((category) => ({ category, maxResin: null }));
  const taskOrder = taskRules.map((rule) => rule.category);
  const taskLimits = Object.fromEntries(taskRules.map((rule) => [
    rule.category,
    { maxResin: rule.maxResin },
  ]));
  const routeTiming = custom ? parseRouteTiming(settings.routeTiming) : 'afterResin';

  return deepFreeze({
    schemaVersion: 2,
    mode: custom ? 'custom' : 'single',
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
    const rule = policy.taskLimits[category];
    const limit = rule?.maxResin != null ? `最多 ${rule.maxResin} 点` : UNLIMITED_CLAIM_LABEL;
    return `${TASK_CATEGORY_LABELS[category]}（${limit}）`;
  }).join(' → ');
  const resinNames = [
    ['condensed', '浓缩'],
    ['original', '原粹'],
    ['transient', '须臾'],
    ['fragile', '脆弱'],
  ].filter(([key]) => policy.resinTypes[key]).map(([, name]) => name);
  return {
    mode: policy.mode === 'custom' ? CUSTOM_MODE_LABEL : SINGLE_MODE_LABEL,
    order: policy.mode === 'custom' ? order : '角色突破 Boss → 武器突破秘境 → 天赋秘境 → 圣遗物填充（只执行首个可用任务）',
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
    return { category, maxResin: inlineLimit === UNLIMITED_CLAIM_LABEL ? null
      : parseResinBudget(inlineLimit, category, taskLabel) };
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

function parseResinBudget(value, category, label) {
  const match = /^(?:最多\s*)?(\d+)\s*点$/.exec(value);
  const points = match ? Number(match[1]) : NaN;
  const unit = category === 'boss' ? 40 : 20;
  if (!Number.isSafeInteger(points) || points < unit || points > 60000 || points % unit !== 0) {
    throw new Error(`${label}树脂上限必须是${unit}到60000之间的${unit}点整数倍`);
  }
  return points;
}

function splitTaskAndLimit(value) {
  const match = value.match(/^(.+?)\s*[｜|]\s*(.+)$/);
  return match ? [match[1].trim(), match[2].trim()] : [value, null];
}

function parseRouteTiming(value) {
  const label = String(value ?? '树脂任务后').trim();
  const timing = ROUTE_TIMING_BY_LABEL[label];
  if (!timing) throw new Error(`未知的路线执行时机：“${label}”`);
  return timing;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
