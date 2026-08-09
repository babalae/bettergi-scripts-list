const UNLIMITED_RUN_COUNT = 9999;

/** 构造世界 Boss 执行配置：只耗原粹树脂，不主动使用须臾或脆弱树脂。 */
export function buildBossExecutionConfig(task, settings) {
  if (task?.executionType !== 'boss' || !task.bossName) {
    throw new Error('世界 Boss 任务缺少 BetterGI 已支持的首领名称');
  }
  const override = settings.bossOverrides?.[task.bossName] ?? {};
  if (override.enabled === false) throw new Error(`世界 Boss“${task.bossName}”已被单独禁用`);
  const partyName = override.partyName?.trim() || settings.bossTeamName?.trim();
  if (!partyName) throw new Error(`世界 Boss“${task.bossName}”未配置 Boss 队伍`);
  return {
    bossName: task.bossName,
    partyName,
    // 留空时由 BetterGI 自动首领配置决定实际战斗策略。
    strategyName: override.strategyName?.trim() || settings.bossCombatStrategyName?.trim() || '',
    specifyRunCount: settings.bossTestSingleRun === true,
    runCount: settings.bossTestSingleRun === true ? 1 : UNLIMITED_RUN_COUNT,
    reviveRetryCount: 3,
    trackedMaterials: task.materials ?? [{ materialId: task.materialId, materialName: task.materialName, shortage: task.shortage }],
  };
}

export function isBossTaskEnabled(task, settings) {
  return settings.bossExecutionEnabled === true && settings.bossOverrides?.[task.bossName]?.enabled !== false;
}
