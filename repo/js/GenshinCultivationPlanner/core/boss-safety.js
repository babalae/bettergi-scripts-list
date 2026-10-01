/**
 * 自动首领结束后离开战斗区域，避免树脂不足时停在已刷新的首领面前。
 * 清理失败只记录警告，不覆盖原始任务结果或异常。
 */
export async function runBossTaskWithSafeExit({ runTask, teleportToStatue, logger, onCleanupFailure = null }) {
  try {
    return await runTask();
  } finally {
    try {
      logger.info('[Boss] 任务调用结束，传送七天神像恢复队伍并离开战斗区域');
      await teleportToStatue();
      logger.info('[Boss] 已安全离开首领区域');
    } catch (error) {
      logger.warn('[Boss] 自动首领结束后传送七天神像失败，后续一条龙任务可能受战斗状态影响：{error}', formatError(error));
      try {
        onCleanupFailure?.(error);
      } catch (callbackError) {
        logger.warn('[Boss] 记录安全退场失败证据时出现异常，已忽略且不覆盖原任务结果：{error}', formatError(callbackError));
      }
    }
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
