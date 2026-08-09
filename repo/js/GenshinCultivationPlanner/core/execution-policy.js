const DEFAULT_TASK_PRIORITY = ['boss', 'limitedDomain', 'domain', 'artifactDomain'];
const UNLIMITED_COUNT = 9999;
const TASK_LABELS = {
  boss: '世界 Boss',
  limitedDomain: '限时培养秘境',
  domain: '普通培养秘境',
  artifactDomain: '圣遗物填充',
};
const TASK_ALIASES = new Map(Object.entries(TASK_LABELS).flatMap(([key, label]) => [[key.toLowerCase(), key], [label.replaceAll(' ', '').toLowerCase(), key]]));

/** 解析并校验可预览的执行规则。 */
export function buildExecutionPolicy(settings = {}) {
  const taskPriority = parseTaskPriority(settings.taskPriorityText);
  const originalResinBudget = parseNonNegativeInteger(settings.originalResinBudget ?? 200, '本次原粹树脂预算', 200);
  const originalResinReserve = parseNonNegativeInteger(settings.originalResinReserve ?? 0, '原粹树脂保留量', 200);
  if (originalResinReserve > originalResinBudget) throw new Error('原粹树脂保留量不能大于本次原粹树脂预算');
  const taskLimits = parseTaskLimits(settings.taskLimitsText);
  const routeTiming = settings.routeTiming || '树脂任务后';
  if (!['树脂任务前', '树脂任务后'].includes(routeTiming)) throw new Error(`未知的路线执行时机：“${routeTiming}”`);
  const artifactFillCondition = settings.artifactFillCondition || '仅无培养任务';
  if (!['仅无培养任务', '始终放在队列末尾'].includes(artifactFillCondition)) {
    throw new Error(`未知的圣遗物填充条件：“${artifactFillCondition}”`);
  }
  const resinPriority = buildResinPriority(settings);
  const policy = {
    taskPriority,
    taskLimits,
    resinPriority,
    originalResinBudget,
    originalResinReserve,
    usableOriginalResin: originalResinBudget - originalResinReserve,
    routeTiming,
    artifactFillCondition,
  };
  return { ...policy, previewLines: buildPolicyPreviewLines(policy) };
}

export function applyExecutionPolicyToTasks(tasks, policy) {
  const positions = new Map(policy.taskPriority.map((type, index) => [type, index]));
  return [...(tasks ?? [])].sort((left, right) => {
    const difference = (positions.get(taskTypeKey(left)) ?? 999) - (positions.get(taskTypeKey(right)) ?? 999);
    if (difference !== 0) return difference;
    return (right.priority ?? 0) - (left.priority ?? 0);
  });
}

export function createOriginalResinBudget(policy) {
  return { remaining: policy.usableOriginalResin, reserved: policy.originalResinReserve };
}

/** 对秘境四种树脂分别应用次数上限，并保守预留原粹树脂预算。 */
export function limitDomainResinPolicy(basePolicy, task, executionPolicy, budget) {
  const cap = executionPolicy.taskLimits[taskTypeKey(task)];
  const maxCount = cap;
  const originalBudgetCount = Math.floor(Math.max(0, budget.remaining) / 20);
  const result = {
    ...basePolicy,
    budgetEnforced: true,
    originalResinUseCount: Math.min(basePolicy.originalResinUseCount, maxCount, originalBudgetCount),
    condensedResinUseCount: Math.min(basePolicy.condensedResinUseCount, maxCount),
    transientResinUseCount: Math.min(basePolicy.transientResinUseCount, maxCount),
    fragileResinUseCount: Math.min(basePolicy.fragileResinUseCount, maxCount),
  };
  budget.remaining -= result.originalResinUseCount * 20;
  result.priority = basePolicy.priority.filter((name) => countByResinName(result, name) > 0);
  return result;
}

export function limitBossRunCount(task, executionPolicy, budget, requestedCount) {
  const cap = executionPolicy.taskLimits.boss;
  const budgetCount = Math.floor(Math.max(0, budget.remaining) / 40);
  const count = Math.min(requestedCount, cap, budgetCount);
  budget.remaining -= count * 40;
  return count;
}

export function taskTypeKey(task) {
  if (task.executionType === 'domain') return task.limited ? 'limitedDomain' : 'domain';
  return task.executionType;
}

function parseTaskPriority(text) {
  if (text === undefined || text === null || String(text).trim() === '') return [...DEFAULT_TASK_PRIORITY];
  const values = String(text).split(/[>＞→,，;；\r\n]+/).map((item) => item.trim()).filter(Boolean)
    .map((value) => TASK_ALIASES.get(value.replaceAll(' ', '').toLowerCase()));
  if (values.some((value) => !value)) throw new Error('任务优先级包含未知类型');
  if (new Set(values).size !== values.length) throw new Error('任务优先级不能包含重复类型');
  if (values.length !== DEFAULT_TASK_PRIORITY.length || DEFAULT_TASK_PRIORITY.some((type) => !values.includes(type))) {
    throw new Error(`任务优先级必须完整包含：${DEFAULT_TASK_PRIORITY.map((type) => TASK_LABELS[type]).join('、')}`);
  }
  return values;
}

function parseTaskLimits(text) {
  const defaults = Object.fromEntries(DEFAULT_TASK_PRIORITY.map((type) => [type, UNLIMITED_COUNT]));
  if (text === undefined || text === null || String(text).trim() === '') return defaults;
  const result = {};
  for (const entry of String(text).split(/[；;\r\n]+/).map((item) => item.trim()).filter(Boolean)) {
    const match = entry.match(/^([^=：:]+?)\s*[=：:]\s*(无限|\d+)$/);
    if (!match) throw new Error(`任务上限格式错误：“${entry}”`);
    const type = TASK_ALIASES.get(match[1].replaceAll(' ', '').toLowerCase());
    if (!type) throw new Error(`任务上限包含未知类型：“${match[1].trim()}”`);
    if (result[type] !== undefined) throw new Error(`任务上限重复：“${match[1].trim()}”`);
    const value = match[2] === '无限' ? UNLIMITED_COUNT : Number(match[2]);
    if (value > UNLIMITED_COUNT) throw new Error(`任务上限不能超过 ${UNLIMITED_COUNT}：“${entry}”`);
    result[type] = value;
  }
  return { ...defaults, ...result };
}

function buildResinPriority(settings) {
  const enabled = [
    ['浓缩树脂', settings.domainUseCondensedResin !== false],
    ['原粹树脂', settings.domainUseOriginalResin !== false],
    ['须臾树脂', settings.domainUseTransientResin === true],
    ['脆弱树脂', settings.domainUseFragileResin === true],
  ].filter(([, value]) => value).map(([name]) => name);
  if (enabled.length === 0) throw new Error('至少需要启用一种秘境树脂类型');
  return enabled;
}

function buildPolicyPreviewLines(policy) {
  const limitText = policy.taskPriority.map((type) => `${TASK_LABELS[type]}=${formatLimit(policy.taskLimits[type])}`).join('；');
  return [
    `任务顺序：${policy.taskPriority.map((type) => TASK_LABELS[type]).join(' → ')}`,
    `秘境树脂顺序：${policy.resinPriority.join(' → ')}（BetterGI 固定顺序的安全子集）`,
    `原粹树脂：预算 ${policy.originalResinBudget}，保留 ${policy.originalResinReserve}，最多授权 ${policy.usableOriginalResin}`,
    `每类任务单种树脂/运行次数上限：${limitText}`,
    `路线执行：${policy.routeTiming}；圣遗物：${policy.artifactFillCondition}`,
  ];
}

function formatLimit(value) {
  return value === UNLIMITED_COUNT ? '无限' : `${value} 次`;
}

function parseNonNegativeInteger(value, label, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) throw new Error(`${label}必须是 0 到 ${max} 的整数`);
  return parsed;
}

function countByResinName(policy, name) {
  return {
    原粹树脂: policy.originalResinUseCount,
    浓缩树脂: policy.condensedResinUseCount,
    须臾树脂: policy.transientResinUseCount,
    脆弱树脂: policy.fragileResinUseCount,
  }[name] ?? 0;
}
