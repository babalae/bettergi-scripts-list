/** 已达到与解析失败分开，防止空目标误触发培养或填充。 */
export function classifyResolvedTargetState({ targets = [], profileRecord = null, targetOutcomes = [] } = {}) {
  const noPendingTargets = profileRecord != null && Array.isArray(targets) && targets.length === 0;
  const hasFailures = targetOutcomes.some(outcome => outcome?.status === 'failed');
  return { suppressExecution: noPendingTargets, allSatisfied: noPendingTargets && !hasFailures,
    incomplete: noPendingTargets && hasFailures };
}
