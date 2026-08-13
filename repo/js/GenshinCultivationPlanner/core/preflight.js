import { isBossTaskEnabled } from './boss-executor.js';

/** 实际执行前的配置检查。 */
export function collectExecutionWarnings(plan, settings) {
  const warnings = [];
  const types = new Set(plan.todayQueue.map((task) => task.executionType));
  if (types.has('domain') && !settings.domainTeamName?.trim()) {
    warnings.push('今日有秘境候选任务，但尚未配置秘境队伍名称');
  }
  if (types.has('domain') && settings.domainUseOriginalResin === false
    && settings.domainUseCondensedResin !== true
    && settings.domainUseTransientResin !== true
    && settings.domainUseFragileResin !== true
    && settings.domainTestSingleRun !== true) {
    warnings.push('今日有秘境候选任务，但所有允许使用的树脂类型均已关闭');
  }
  const enabledBossTasks = plan.todayQueue.filter((task) => (
    task.executionType === 'boss'
    && task.status === 'supported'
    && isBossTaskEnabled(task, settings)
  ));
  const bossWithoutParty = enabledBossTasks.filter((task) => (
    !settings.bossOverrides?.[task.bossName]?.partyName?.trim() && !settings.bossTeamName?.trim()
  ));
  if (bossWithoutParty.length > 0) {
    warnings.push(`今日有 Boss 候选任务，但尚未配置可用队伍：${bossWithoutParty.map((task) => task.bossName).join('、')}`);
  }
  if (types.has('boss') && settings.bossExecutionEnabled !== true) {
    warnings.push('今日有世界 Boss 候选任务；Boss 自动执行默认关闭，确认首领机制与队伍后再手动开启');
  }
  if (types.has('artifactDomain') && !settings.artifactTeamName?.trim()) {
    warnings.push('已启用圣遗物秘境填充，但尚未配置圣遗物秘境队伍名称');
  }
  const matchedRoutes = plan.routes?.matched ?? [];
  const missingRoutes = plan.routes?.missing ?? [];
  if (settings.gatheringRouteExecutionEnabled === true
    && matchedRoutes.some((item) => item.type === 'localSpecialty')
    && !settings.gatheringTeamName?.trim()) {
    warnings.push('已匹配地方特产路线，但尚未配置采集队伍名称');
  }
  if (settings.monsterRouteExecutionEnabled === true
    && matchedRoutes.some((item) => item.type === 'monster')
    && !settings.monsterTeamName?.trim()) {
    warnings.push('已匹配怪物材料路线，但尚未配置怪物材料队伍名称');
  }
  if (settings.gatheringRouteExecutionEnabled === true
    && missingRoutes.some((item) => item.type === 'localSpecialty')) {
    warnings.push(`地方特产仍有缺口，但未找到可执行路线：${formatRouteNames(missingRoutes, 'localSpecialty')}`);
  }
  if (settings.monsterRouteExecutionEnabled === true
    && missingRoutes.some((item) => item.type === 'monster')) {
    warnings.push(`怪物材料仍有缺口，但未找到可执行路线：${formatRouteNames(missingRoutes, 'monster')}`);
  }
  return warnings;
}

function formatRouteNames(routes, type) {
  return [...new Set(routes.filter((item) => item.type === type).map((item) => item.name))].join('、');
}
