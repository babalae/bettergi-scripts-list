export const EXECUTION_STATUS = Object.freeze({
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  UNCONFIRMED: 'unconfirmed',
});

/** 构造统一任务结果，并固定是否允许继续后续树脂任务。 */
export function createTaskResult({ status, task = null, reason = '', evidence = {}, details = {} }) {
  if (!Object.values(EXECUTION_STATUS).includes(status)) throw new Error(`未知任务状态：${status}`);
  return {
    status,
    task,
    reason: reason || null,
    evidence,
    details,
    continueResinQueue: status !== EXECUTION_STATUS.FAILED,
  };
}

export function failedTaskResult(error, task = null) {
  return createTaskResult({
    status: EXECUTION_STATUS.FAILED,
    task,
    reason: error?.message ?? String(error),
    evidence: { taskInvoked: false },
  });
}

/**
 * 顺序执行多个树脂候选。跳过和待统一复核可以继续；安全失败立即停止。
 * 本层不按多个秘境精确分配树脂，只负责顺序和停止规则。
 */
export async function runResinTaskQueue({ tasks, isEnabled = () => true, executeTask }) {
  const results = [];
  for (const task of tasks ?? []) {
    if (task.status !== 'supported') continue;
    if (!isEnabled(task)) {
      results.push(createTaskResult({
        status: EXECUTION_STATUS.SKIPPED,
        task,
        reason: `${taskLabel(task)}未启用`,
        evidence: { taskInvoked: false },
      }));
      continue;
    }
    let result;
    try {
      result = normalizeTaskResult(await executeTask(task), task);
    } catch (error) {
      result = failedTaskResult(error, task);
    }
    results.push(result);
    if (!result.continueResinQueue) break;
  }
  return summarizeQueueResults(results);
}

export function summarizeQueueResults(results) {
  const failed = results.find((item) => item.status === EXECUTION_STATUS.FAILED);
  const completed = results.filter((item) => item.status === EXECUTION_STATUS.COMPLETED);
  const unconfirmed = results.filter((item) => item.status === EXECUTION_STATUS.UNCONFIRMED);
  const invoked = results.filter((item) => item.evidence?.taskInvoked === true);
  const status = failed
    ? EXECUTION_STATUS.FAILED
    : unconfirmed.length > 0
      ? EXECUTION_STATUS.UNCONFIRMED
      : completed.length > 0
        ? EXECUTION_STATUS.COMPLETED
        : EXECUTION_STATUS.SKIPPED;
  return {
    status,
    reason: failed?.reason
      ?? (status === EXECUTION_STATUS.SKIPPED ? '今日没有已启用的树脂任务' : null),
    tasks: results,
    // 兼容既有报告字段：指向首个真正调用的树脂任务。
    task: invoked[0]?.task ?? null,
    rewards: {},
    trackedRewards: {},
    appliedGains: false,
  };
}

function normalizeTaskResult(result, task) {
  if (!result || typeof result !== 'object') {
    return createTaskResult({ status: EXECUTION_STATUS.UNCONFIRMED, task, reason: '任务调用未返回执行证据' });
  }
  return createTaskResult({
    status: result.status,
    task: result.task ?? task,
    reason: result.reason,
    evidence: result.evidence ?? {},
    details: result.details ?? {},
  });
}

function taskLabel(task) {
  return task.bossName ?? task.domainName ?? task.materialName ?? '树脂任务';
}
