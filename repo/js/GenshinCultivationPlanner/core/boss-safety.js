/**
 * 自动首领结束后离开战斗区域，避免树脂不足时停在已刷新的首领面前。
 * 清理失败只记录警告，不覆盖原始任务结果或异常。
 */
import { isCancellationError } from './error-classifier.js';

export async function runBossTaskWithSafeExit({ runTask, teleportToStatue, logger, onCleanupFailure = null, cleanupState = {} }) {
  let rejectedBeforeStart = false;
  let cancelled = false;
  cleanupState.status = 'not-required';
  try {
    return await runTask();
  } catch (error) {
    rejectedBeforeStart = error?.code === 'native_unsupported';
    cancelled = isCancellationError(error);
    if (cancelled) cleanupState.status = 'cancelled';
    throw error;
  } finally {
    if (!rejectedBeforeStart && !cancelled) {
      try {
        logger.info('[Boss] 任务调用结束，传送七天神像恢复队伍并离开战斗区域');
        await teleportToStatue();
        cleanupState.status = 'succeeded';
        logger.info('[Boss] 已安全离开首领区域');
      } catch (error) {
        cleanupState.status = isCancellationError(error) ? 'cancelled' : 'failed';
        cleanupState.reason = formatError(error);
        logger.warn('[Boss] 自动首领结束后传送七天神像失败，后续一条龙任务可能受战斗状态影响：{error}', formatError(error));
        try {
          onCleanupFailure?.(error);
        } catch (callbackError) {
          logger.warn('[Boss] 记录安全退场失败证据时出现异常，已忽略且不覆盖原任务结果：{error}', formatError(callbackError));
        }
      }
    }
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
