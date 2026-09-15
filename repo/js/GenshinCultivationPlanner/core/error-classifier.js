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
  const explicitNoResin = /(?:树脂不足|没有足够的树脂|insufficient resin)/i.test(contextual.message);
  return {
    status: explicitNoResin ? 'skipped' : 'failed',
    code: explicitNoResin ? 'no_resin' : contextual.code,
    stage: contextual.stage,
    severity: explicitNoResin ? 'info' : contextual.severity,
    retryable: explicitNoResin ? false : contextual.retryable,
    message: contextual.message,
    evidence: contextual.evidence,
    startedAt: contextual.startedAt,
    endedAt: contextual.endedAt ?? new Date().toISOString(),
  };
}
