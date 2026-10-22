// 沿用项目已确认的世界等级 9：每次领奖至少获得 3 个首领专属突破材料。
const BOSS_MIN_ASCENSION_YIELD = 3;

/** 构造世界 Boss 执行配置：只耗原粹树脂，不主动使用须臾或脆弱树脂。 */
export function buildBossExecutionConfig(task, settings, maxClaims = null) {
  if (task?.executionType !== 'boss' || !task.bossName) {
    throw new Error('世界 Boss 任务缺少 BetterGI 已支持的首领名称');
  }
  const override = settings.bossOverrides?.[task.bossName] ?? {};
  if (override.enabled === false) throw new Error(`世界 Boss“${task.bossName}”已被单独禁用`);
  const partyName = override.partyName?.trim() || settings.bossTeamName?.trim();
  if (!partyName) throw new Error(`世界 Boss“${task.bossName}”未配置 Boss 队伍`);
  const testSingleRun = settings.bossTestSingleRun === true;
  const bounded = Number.isInteger(maxClaims) && maxClaims > 0;
  const trackedMaterials = task.materials?.length > 0 ? task.materials
    : [{ materialId: task.materialId, materialName: task.materialName, shortage: task.shortage }];
  if (trackedMaterials.some((material) => !Number.isSafeInteger(material.shortage) || material.shortage <= 0)) {
    throw new Error(`世界 Boss“${task.bossName}”的材料缺口无效，无法确定领奖上限`);
  }
  // 同一个 Boss 同时掉落多个目标材料时取最大需求次数，不能重复相加。
  const shortageRunCount = Math.max(...trackedMaterials.map((material) => (
    Math.ceil(material.shortage / BOSS_MIN_ASCENSION_YIELD)
  )));
  return {
    bossName: task.bossName,
    partyName,
    // 留空时由 BetterGI 自动首领配置决定实际战斗策略。
    strategyName: override.strategyName?.trim() || settings.bossCombatStrategyName?.trim() || '',
    specifyRunCount: true,
    runCount: testSingleRun ? 1 : bounded ? Math.min(maxClaims, shortageRunCount) : shortageRunCount,
    shortageRunCount,
    reviveRetryCount: 3,
    trackedMaterials,
  };
}

export function isBossTaskEnabled(task, settings) {
  return settings.bossExecutionEnabled === true && settings.bossOverrides?.[task.bossName]?.enabled !== false;
}
