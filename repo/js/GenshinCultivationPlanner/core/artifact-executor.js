/**
 * 当天没有培养树脂任务时，构造用户主动启用的圣遗物秘境填充任务。
 * 不根据角色自动推断圣遗物套装，避免替用户做配装决策。
 */
export function appendArtifactFallbackTask(plan, settings) {
  if (settings.artifactDomainEnabled !== true || !settings.artifactDomainName?.trim()) return plan;
  if (plan.todayQueue.some((task) => task.status === 'supported' && task.executionType !== 'artifactDomain')) return plan;
  if (plan.todayQueue.some((task) => task.executionType === 'artifactDomain')) return plan;
  plan.todayQueue.push({
    materialId: `artifact:${settings.artifactDomainName.trim()}`,
    materialName: settings.artifactDomainName.trim(),
    executionType: 'artifactDomain',
    domainName: settings.artifactDomainName.trim(),
    materials: [],
    shortage: 0,
    priority: -1,
    status: 'supported',
    limited: false,
    reason: '当天没有可执行培养树脂任务，使用用户启用的圣遗物秘境填充',
  });
  return plan;
}

/** 构造圣遗物秘境执行配置，沿用普通秘境树脂规则且默认不自动分解。 */
export function buildArtifactDomainExecutionConfig(task, settings, resinPolicy) {
  if (task?.executionType !== 'artifactDomain' || !task.domainName) {
    throw new Error('任务不是已配置的圣遗物秘境');
  }
  if (settings.artifactDomainEnabled !== true) throw new Error('未启用圣遗物秘境填充');
  const partyName = settings.artifactTeamName?.trim();
  if (!partyName) throw new Error('未配置圣遗物秘境队伍名称，已拒绝执行');
  if (resinPolicy.priority.length === 0) throw new Error('未启用任何圣遗物秘境可用树脂类型，已拒绝执行');
  const testSingleRun = settings.artifactTestSingleRun === true;
  const effectiveResinPolicy = testSingleRun
    ? {
      ...resinPolicy,
      priority: ['原粹树脂'],
      originalResinUseCount: 1,
      condensedResinUseCount: 0,
      transientResinUseCount: 0,
      fragileResinUseCount: 0,
    }
    : resinPolicy;
  return {
    domainName: task.domainName,
    partyName,
    strategyName: settings.artifactCombatStrategyName?.trim() || '',
    resinPolicy: effectiveResinPolicy,
    autoArtifactSalvage: false,
    maxArtifactStar: '4',
    testSingleRun,
  };
}
