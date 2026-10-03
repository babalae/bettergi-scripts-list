/**
 * 错误处理工具
 *
 * ============================================================================
 * 项目异常处理统一约定（务必遵守，避免日志混乱与重复）
 * ============================================================================
 *
 * BGI 日志去向：
 *   - log.error / log.warn / log.info  → 前端遮罩 + 日志文件
 *   - log.debug                        → 仅日志文件（遮罩不显示）
 *
 * 因此本工具把 message 走 log.error（用户可见），stack 走 log.debug（仅排查用），
 * 既不污染遮罩，又能在文件里查到完整堆栈。
 *
 * --- 调用方两种姿态，二选一，禁止"先 log 再 throw" ---
 *
 * 姿态 A：当前层吞错继续（swallow，最终处理点）
 *   try {
 *       ...
 *   } catch (error) {
 *       rethrowIfCancellation(error);
 *       logCaughtError("processor:auto-fight", "执行 战斗 步骤", error);
 *       return false;
 *   }
 *
 * 姿态 B：当前层透传给上层（中间层）
 *   try {
 *       ...
 *   } catch (error) {
 *       rethrowIfCancellation(error);   // 取消可写也可不写，反正会冒上去
 *       throw error;                    // 或加上下文 wrap，但不 log
 *   }
 *   实际上中间层连 try/catch 都不该有 —— 让 error 自然冒泡到最终处理点即可。
 *   只有需要释放资源（try/finally）或需要给 error 加业务上下文时才包一层。
 *
 * --- 最终处理点（允许调用 logCaughtError 的地方） ---
 *
 *   - defineStep wrapper 在 swallow=true 时
 *   - probes dispatch（探针错误一律不该影响主流程）
 *   - commission-context.runStepsWithContext 接住 step 抛错时
 *   - commission-executor 外层 catch（委托级隔离边界）
 *   - main.js 最外层 catch（脚本级隔离边界）
 *
 * 其它任何 catch 出现 log.error/warn 都视为不规范，应改成 throw 让最终处理点统一处理。
 * ============================================================================
 */

/**
 * 判断异常是否为取消相关的异常
 * @description BGI 取消任务时会以多种形式抛出异常,统一在此识别;
 *              "尝试多次后,截图失败!" 通常也意味着任务被中断,一并视为取消
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isCancellationError(error) {
    if (!error) return false;
    const msg = (error.message || error.toString() || "").toLowerCase();
    return msg.includes("取消自动任务")
        || msg.includes("task was canceled")
        || msg.includes("operationcanceledexception")
        || msg.includes("normalendexception")
        || msg.includes("尝试多次后,截图失败!");
}

/**
 * 若 error 是取消异常则透传，否则什么也不做
 *
 * 任何 catch 块的第一句都应该调用本函数，确保用户取消信号能一路向上传到顶层 executor
 * 被静默吞掉将导致脚本无法正常停止。
 *
 * @param {Error} error
 * @throws 原 error（当 error 为取消异常时）
 */
export function rethrowIfCancellation(error) {
    if (isCancellationError(error)) throw error;
}

/**
 * 记录"当前层捕获并吞下的错误"
 *
 * - message 走 log.error → 前端遮罩 + 文件，用户能看到出了什么事
 * - stack 走 log.debug   → 仅文件，排查时按 scope/action 关键字 grep
 *
 * **使用前提**：error 已经判过取消（用 rethrowIfCancellation），不会是 cancellation。
 * 本函数不再二次判断，避免与上层职责重叠。
 *
 * @param {string} scope  - 模块/层标识，如 "processor:auto-fight" / "probe:dialog" / "executor:NPC"
 *                         习惯写作 `<类型>:<具体模块>`，便于日志检索
 * @param {string} action - 动作描述，如 "执行 对话 步骤" / "调度 onDialogOcr"
 * @param {Error}  error  - 捕获到的异常
 */
export function logCaughtError(scope, action, error) {
    if (!error) return;
    const message = (error && error.message) ? error.message : String(error);
    log.error("[{scope}] {action} 失败: {msg}", scope, action, message);
    const stack = (error && error.stack) ? error.stack : "(无堆栈)";
    log.debug("[{scope}] {action} 堆栈:\n{stack}", scope, action, stack);
}
