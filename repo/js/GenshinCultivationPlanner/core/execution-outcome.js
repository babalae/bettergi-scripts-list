const VALID_STATUSES = new Set(['completed', 'unconfirmed', 'skipped', 'failed']);
const VALID_STAGES = new Set(['preflight', 'profile', 'inventory', 'party', 'task', 'reward', 'cleanup']);
const VALID_SEVERITIES = new Set(['info', 'warning', 'fatal']);

const DEFAULT_SEVERITY = {
  completed: 'info',
  unconfirmed: 'warning',
  skipped: 'info',
  failed: 'fatal',
};

/** 构造稳定、可序列化的单项执行结果。 */
export function createExecutionOutcome({
  taskId = null,
  taskType = null,
  targetName = null,
  status,
  code,
  stage = 'task',
  severity = null,
  retryable = false,
  message = '',
  evidence = {},
  startedAt = null,
  endedAt = null,
} = {}) {
  if (!VALID_STATUSES.has(status)) throw new Error(`未知执行状态：“${status}”`);
  if (!code?.trim()) throw new Error('执行结果必须包含稳定状态码');
  if (!VALID_STAGES.has(stage)) throw new Error(`未知执行阶段：“${stage}”`);
  const resolvedSeverity = severity ?? DEFAULT_SEVERITY[status];
  if (!VALID_SEVERITIES.has(resolvedSeverity)) throw new Error(`未知严重程度：“${resolvedSeverity}”`);

  return {
    taskId,
    taskType,
    targetName,
    status,
    code: code.trim(),
    stage,
    severity: resolvedSeverity,
    retryable: retryable === true,
    message: String(message || ''),
    evidence: isPlainObject(evidence) ? evidence : {},
    startedAt,
    endedAt,
  };
}

/**
 * 创建整次运行结果，同时保留旧版 execution.task/status/reason 字段。
 * 后续多任务调度只需向 tasks 追加结果，旧报告仍可读取第一项任务。
 */
export function createRunExecution({
  task = null,
  status = 'skipped',
  code = status === 'skipped' ? 'no_candidate' : 'task_completed',
  stage = 'task',
  severity = null,
  retryable = false,
  message = '',
  evidence = {},
  startedAt = null,
  endedAt = null,
  rewards = {},
  taskRecognizedRewards = {},
  warnings = [],
} = {}) {
  const taskType = task?.executionType ?? null;
  const targetName = resolveTaskTargetName(task);
  const includeTaskOutcome = task != null || taskType != null || targetName != null;
  const outcome = includeTaskOutcome
    ? createExecutionOutcome({
      taskId: resolveTaskId(task),
      taskType,
      targetName,
      status,
      code,
      stage,
      severity,
      retryable,
      message,
      evidence,
      startedAt,
      endedAt,
    })
    : null;
  return {
    status,
    code,
    stage,
    severity: severity ?? DEFAULT_SEVERITY[status],
    retryable: retryable === true,
    reason: message || null,
    message: message || '',
    task,
    tasks: outcome ? [outcome] : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    rewards,
    taskRecognizedRewards,
    trackedRewards: {},
    appliedGains: false,
  };
}

/** 更新首个任务及整次运行的最终状态，并把过程证据合并到任务结果。 */
export function updatePrimaryTaskOutcome(execution, patch = {}) {
  if (!execution) return execution;
  const current = execution.tasks?.[0];
  const status = patch.status ?? current?.status ?? execution.status;
  const code = patch.code ?? current?.code ?? execution.code;
  const stage = patch.stage ?? current?.stage ?? execution.stage ?? 'task';
  const severity = patch.severity ?? current?.severity ?? DEFAULT_SEVERITY[status];
  const message = patch.message ?? current?.message ?? execution.message ?? execution.reason ?? '';
  const evidence = {
    ...(current?.evidence ?? {}),
    ...(isPlainObject(patch.evidence) ? patch.evidence : {}),
  };

  execution.status = status;
  execution.code = code;
  execution.stage = stage;
  execution.severity = severity;
  execution.retryable = patch.retryable ?? current?.retryable ?? execution.retryable ?? false;
  execution.message = message;
  execution.reason = message || null;
  if (current) {
    execution.tasks[0] = createExecutionOutcome({
      ...current,
      status,
      code,
      stage,
      severity,
      retryable: execution.retryable,
      message,
      evidence,
      endedAt: patch.endedAt ?? current.endedAt,
    });
  }
  return execution;
}

/** 更新整次运行结论，但不把最终背包总差值错误归属给某一个子任务。 */
export function updateRunOutcome(execution, patch = {}) {
  if (!execution) return execution;
  const status = patch.status ?? execution.status;
  execution.status = status;
  execution.code = patch.code ?? execution.code;
  execution.stage = patch.stage ?? execution.stage ?? 'task';
  execution.severity = patch.severity ?? DEFAULT_SEVERITY[status];
  execution.retryable = patch.retryable ?? execution.retryable ?? false;
  execution.message = patch.message ?? execution.message ?? execution.reason ?? '';
  execution.reason = execution.message || null;
  execution.evidence = {
    ...(isPlainObject(execution.evidence) ? execution.evidence : {}),
    ...(isPlainObject(patch.evidence) ? patch.evidence : {}),
  };
  return execution;
}

/** 合并连续树脂任务的过程结果，并保留旧版首任务字段。 */
export function combineRunExecutions(executions = []) {
  const items = executions.filter(Boolean);
  if (items.length === 0) {
    return createRunExecution({
      status: 'skipped', code: 'no_candidate', stage: 'preflight',
      message: '今日没有已启用的树脂任务',
    });
  }
  const terminal = items.find((item) => item.status === 'failed')
    ?? items.find((item) => item.status === 'unconfirmed')
    ?? items.at(-1);
  const first = items[0];
  return {
    ...first,
    status: terminal.status,
    code: terminal.code,
    stage: terminal.stage,
    severity: terminal.severity,
    retryable: terminal.retryable === true,
    reason: terminal.reason,
    message: terminal.message,
    tasks: items.flatMap((item) => item.tasks ?? []),
    warnings: items.flatMap((item) => item.warnings ?? []),
    rewards: mergeRewardMaps(items.map((item) => item.rewards)),
    taskRecognizedRewards: mergeRewardMaps(items.map((item) => item.taskRecognizedRewards)),
    taskCount: items.length,
  };
}

/** 把清理等非主结果告警加入运行记录，不覆盖原任务结论。 */
export function appendExecutionWarning(execution, warning) {
  if (!execution) return execution;
  const normalized = createExecutionOutcome({
    status: 'unconfirmed',
    code: 'cleanup_failed',
    stage: 'cleanup',
    severity: 'warning',
    ...warning,
  });
  execution.warnings ??= [];
  execution.warnings.push(normalized);
  return execution;
}

/** 将旧历史或旧测试中的 execution 结构补成新结构。 */
export function normalizeLegacyExecution(execution) {
  if (!execution) return null;
  if (Array.isArray(execution.tasks) && execution.code) return execution;
  const status = VALID_STATUSES.has(execution.status) ? execution.status : 'unconfirmed';
  const code = execution.code ?? legacyCode(status, execution);
  const migrated = createRunExecution({
    task: execution.task ?? null,
    status,
    code,
    stage: execution.stage ?? (status === 'unconfirmed' ? 'reward' : 'task'),
    severity: execution.severity ?? null,
    retryable: execution.retryable === true,
    message: execution.message ?? execution.reason ?? '',
    evidence: execution.evidence ?? {},
    rewards: execution.rewards ?? {},
    taskRecognizedRewards: execution.taskRecognizedRewards ?? {},
    warnings: execution.warnings ?? [],
  });
  return {
    ...migrated,
    ...execution,
    status: migrated.status,
    code: migrated.code,
    stage: migrated.stage,
    severity: migrated.severity,
    retryable: migrated.retryable,
    reason: migrated.reason,
    message: migrated.message,
    tasks: migrated.tasks,
    warnings: migrated.warnings,
  };
}

export function resolveTaskTargetName(task) {
  return task?.domainName ?? task?.bossName ?? task?.materialName ?? null;
}

function resolveTaskId(task) {
  if (!task) return null;
  return task.taskId ?? task.materialId ?? `${task.executionType ?? 'task'}:${resolveTaskTargetName(task) ?? 'unknown'}`;
}

function legacyCode(status, execution) {
  if (status === 'failed') return 'external_task_error';
  if (status === 'skipped') return 'no_candidate';
  if (status === 'unconfirmed') return 'reward_unconfirmed';
  if (execution?.appliedGains === true) return 'reward_confirmed';
  return 'task_completed';
}

function mergeRewardMaps(maps) {
  const result = {};
  for (const rewards of maps) {
    for (const [name, count] of Object.entries(rewards ?? {})) {
      if (!Number.isFinite(Number(count)) || Number(count) <= 0) continue;
      result[name] = (result[name] ?? 0) + Number(count);
    }
  }
  return result;
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
