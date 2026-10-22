/** 携带稳定状态码和执行阶段的脚本错误。 */
export class ExecutionError extends Error {
  constructor(message, {
    code = 'external_task_error',
    stage = 'task',
    severity = 'fatal',
    retryable = false,
    evidence = {},
    cause = null,
    startedAt = null,
    endedAt = null,
  } = {}) {
    super(message);
    this.name = 'ExecutionError';
    this.code = code;
    this.stage = stage;
    this.severity = severity;
    this.retryable = retryable === true;
    this.evidence = evidence;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    if (cause) this.cause = cause;
  }
}

/** 为调用位置已知的异常补充上下文，避免仅靠错误文本猜测。 */
export function withExecutionContext(error, context = {}) {
  if (error instanceof ExecutionError) return error;
  const message = error?.message ?? String(error);
  return new ExecutionError(message, { ...context, cause: error });
}

/** 将异常转换为统一失败字段；只在 BetterGI 明确写出树脂不足时细分。 */
export function classifyExecutionError(error, fallback = {}) {
  const contextual = error instanceof ExecutionError
    ? error
    : withExecutionContext(error, fallback);
  // 只接受明确结论；不能把“可能不足”“不足或识别失败”等推测当作树脂已耗尽。
  const explicitNoResin = /^(?:(?:当前)?(?:原粹|浓缩|须臾|脆弱)?树脂不足|没有足够的树脂|insufficient resin)[。.!！]?$/i
    .test(contextual.message.trim());
  const unsupported = contextual.code === 'native_unsupported';
  const cancelled = isCancellationError(contextual);
  return {
    status: !cancelled && (explicitNoResin || unsupported) ? 'skipped' : 'failed',
    code: cancelled ? 'cancelled' : explicitNoResin ? 'no_resin' : contextual.code,
    stage: contextual.stage,
    severity: !cancelled && (explicitNoResin || unsupported) ? 'info' : contextual.severity,
    retryable: cancelled ? false : unsupported || (explicitNoResin ? false : contextual.retryable),
    message: contextual.message,
    evidence: contextual.evidence,
    startedAt: contextual.startedAt,
    endedAt: contextual.endedAt ?? new Date().toISOString(),
  };
}

/** 仅识别开战、领奖前的明确原生拒绝，不能从普通失败推断不支持。 */
export function isUnsupportedNativeTask(error, task) {
  const expected = task.executionType === 'boss'
    ? `暂不支持首领：${task.bossName}`
    : task.executionType === 'domain'
      ? `未找到对应的秘境${task.domainName}的传送点`
      : null;
  if (!expected) return false;
  for (let cause = error, depth = 0; cause != null && depth < 4; cause = cause.cause, depth++) {
    if (String(cause?.message ?? cause).trim() === expected) return true;
  }
  return false;
}

/** 识别明确取消信号；不把一般失败或文字中提到“取消”当作取消请求。 */
export function isCancellationError(error) {
  for (let cause = error, depth = 0; cause != null && depth < 4; cause = cause.cause, depth++) {
    if (cause?.code === 'cancelled' || /^(?:OperationCanceledException|TaskCanceledException|AbortError)$/.test(cause?.name ?? '')) return true;
    if (/^(?:The operation was canceled\.|A task was canceled\.|操作已取消[。.]?|任务已取消[。.]?)$/.test(String(cause?.message ?? cause).trim())) return true;
  }
  return false;
}

/** 只细分日志已确认的 Boss 原生错误；未知异常仍采用严格停止策略。 */
export function classifyBossTaskError(error, task, cleanup, startedAt = null) {
  const message = String(error?.message ?? error).trim();
  const code = isCancellationError(error) ? 'cancelled'
    : isUnsupportedNativeTask(error, task) ? 'native_unsupported'
      : message === '超时未找到征讨之花领奖界面' ? 'reward_ui_timeout'
        : message === '点击传送点后未出现交互面板，可能是传送点未激活' ? 'teleport_failed'
          : message === '检测到复苏界面，存在角色被击败，前往七天神像复活' ? 'boss_battle_failed'
            : error?.code ?? 'external_task_error';
  return new ExecutionError(message, {
    code, stage: error?.stage ?? 'task', cause: error, startedAt,
    evidence: { ...(error?.evidence ?? {}), task, cleanup: { ...cleanup } },
  });
}

/** 成功退场后仅允许已知可恢复的 Boss 失败继续路线，取消和未知异常必须停止。 */
export function canContinueRoutesAfterResin(execution) {
  const tasks = execution?.tasks ?? [];
  if ((execution?.routes ?? []).some((route) => route.status === 'failed' && route.stage !== 'party')) return false;
  if (tasks.some((task) => task.code === 'cancelled' || ['failed', 'cancelled'].includes(task.evidence?.cleanup?.status))) return false;
  if ((execution?.warnings ?? []).some((warning) => warning.code === 'cleanup_failed')) return false;
  if (execution?.status !== 'failed') return true;
  const failures = tasks.filter((task) => task.status === 'failed');
  return failures.length > 0 && failures.every((task) => task.taskType === 'boss'
    && ['reward_ui_timeout', 'teleport_failed', 'boss_battle_failed'].includes(task.code)
    && task.evidence?.cleanup?.status === 'succeeded');
}
