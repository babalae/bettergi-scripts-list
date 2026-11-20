import { reconcileRewardEvidence } from './rewards.js';
import { createExecutionOutcome, updateRunOutcome } from './execution-outcome.js';

/** 获取单个已尝试任务关联的材料，沿合成配方补齐同系列各阶。 */
function collectTaskMaterialIds(outcome, execution, materials, recipes, trackedIds) {
  if (outcome.status === 'skipped' || ['party', 'preflight'].includes(outcome.stage)
    || outcome.taskType === 'artifactDomain') return [];
  const allowed = new Set(trackedIds.map(String));
  const task = outcome.evidence?.task ?? ((execution.task?.bossName ?? execution.task?.domainName) === outcome.targetName
    ? execution.task : null);
  let seeds = outcome.evidence?.materialIds ?? task?.materials?.map((item) => String(item.materialId)) ?? [];
  seeds = seeds.filter((id) => allowed.has(String(id)));
  if (seeds.length === 0) {
    seeds = trackedIds.filter((id) => {
      const material = materials[id];
      return material?.executionType === outcome.taskType
        && (material.bossName ?? material.domainName) === outcome.targetName
        && (outcome.evidence?.sundaySelectedValue == null
          || String(material.sundaySelectedValue) === String(outcome.evidence.sundaySelectedValue));
    });
  }
  return expandMaterialFamily(seeds, recipes, allowed);
}

/** 秘境和怪物路线均包含同系列各阶，不能只统计计划中显示的等级。 */
function expandMaterialFamily(seeds, recipes, allowed) {
  const ids = new Set(seeds.map(String).filter((id) => allowed.has(id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [output, recipe] of Object.entries(recipes)) {
      for (const input of recipe.inputs ?? []) {
        const source = String(input.id);
        if (!allowed.has(output) || !allowed.has(source) || (!ids.has(output) && !ids.has(source))) continue;
        if (!ids.has(output) || !ids.has(source)) changed = true;
        ids.add(output);
        ids.add(source);
      }
    }
  }
  return [...ids];
}

/** 未执行的周本、被跳过的 Boss 以及切队前失败的路线不参与本次收益判断。 */
export function collectAttemptedMaterialIds(execution, materials, recipes = {}, trackedIds = Object.keys(materials)) {
  const ids = new Set();
  for (const outcome of execution.tasks ?? []) {
    for (const id of collectTaskMaterialIds(outcome, execution, materials, recipes, trackedIds)) ids.add(id);
  }
  for (const route of execution.routes ?? []) {
    if (['party', 'preflight'].includes(route.stage) || route.status === 'skipped') continue;
    if (!(route.paths?.length || route.attemptedPaths?.length)) continue;
    for (const item of route.materials ?? []) ids.add(String(item.materialId));
  }
  const tracked = new Set(trackedIds.map(String));
  return expandMaterialFamily([...ids], recipes, tracked);
}

/** 将收益范围和各项任务状态分别复核，整次路线增量不能覆盖 Boss 的失败状态。 */
export function applyRunRewardEvidence(execution, {
  materials, recipes = {}, trackedMaterialIds,
  inventoryBefore, inventoryAfter,
  inventoryBeforeIssueNames = [], inventoryAfterIssueNames = [],
  inventoryAfterDecreasedNames = [],
}) {
  const attemptedIds = collectAttemptedMaterialIds(execution, materials, recipes, trackedMaterialIds);
  const attemptedNames = new Set(attemptedIds.map((id) => materials[id]?.name ?? id));
  const allIssues = [...new Set([...inventoryBeforeIssueNames, ...inventoryAfterIssueNames])];
  const relevantIssues = allIssues.filter((name) => attemptedNames.has(name));
  const rewards = reconcileRewardEvidence({
    inventoryBefore, inventoryAfter, trackedMaterialIds: attemptedIds, materials,
    inventoryBeforeIssueNames, inventoryAfterIssueNames,
    taskRecognizedRewards: execution.taskRecognizedRewards,
  });
  Object.assign(execution, {
    inventoryObservedAfter: inventoryAfter,
    inventoryBeforeIssueNames: [...inventoryBeforeIssueNames],
    inventoryAfterIssueNames: [...inventoryAfterIssueNames],
    inventoryTrackedRewards: rewards.inventoryTrackedRewards,
    taskTrackedRewards: rewards.taskTrackedRewards,
    trackedRewards: rewards.trackedRewards,
    gainSources: rewards.gainSources,
    rewardDiscrepancies: rewards.rewardDiscrepancies,
    attemptedMaterialIds: attemptedIds,
    inventoryChecked: true,
    inventoryRecognitionFailed: relevantIssues.length > 0,
    inventoryUnrecognizedNames: relevantIssues,
    inventoryGainIssues: relevantIssues.map((name) => ({
      name,
      beforeUnknown: inventoryBeforeIssueNames.includes(name),
      afterUnknown: inventoryAfterIssueNames.includes(name) && !inventoryAfterDecreasedNames.includes(name),
      decreased: inventoryAfterDecreasedNames.includes(name),
    })),
    inventoryBackgroundIssueNames: allIssues.filter((name) => !attemptedNames.has(name)),
    appliedGains: Object.keys(rewards.trackedRewards).length > 0,
  });
  execution.tasks = (execution.tasks ?? []).map((outcome) => {
    if (outcome.status === 'skipped' || outcome.taskType === 'artifactDomain') return outcome;
    const ids = collectTaskMaterialIds(outcome, execution, materials, recipes, trackedMaterialIds);
    const names = new Set(ids.map((id) => materials[id]?.name ?? id));
    const gains = Object.fromEntries(Object.entries(rewards.trackedRewards).filter(([name]) => names.has(name)));
    const issues = relevantIssues.filter((name) => names.has(name));
    if (outcome.status === 'failed') return {
      ...outcome, evidence: { ...outcome.evidence, trackedRewards: gains, inventoryIssueNames: issues },
    };
    const confirmed = Object.keys(gains).length > 0;
    return createExecutionOutcome({
      ...outcome,
      status: confirmed ? 'completed' : 'unconfirmed',
      code: confirmed ? 'reward_confirmed' : 'reward_unconfirmed',
      stage: 'reward', severity: confirmed ? 'info' : 'warning',
      message: confirmed ? '已确认该任务目标材料收益'
        : issues.length > 0 ? '该任务材料数量无法确认' : '未确认领取到该任务目标材料',
      evidence: { ...outcome.evidence, trackedRewards: gains, inventoryIssueNames: issues },
    });
  });
  // 运行收益结论可更新，原始失败和取消结论不能被后续采集收益覆盖。
  if (execution.status !== 'failed' && execution.code !== 'cancelled') {
    const relevantTasks = execution.tasks.filter((task) => task.status !== 'skipped' && task.taskType !== 'artifactDomain');
    const applicable = relevantTasks.length > 0 || attemptedIds.length > 0;
    if (applicable) {
      updateRunOutcome(execution, {
        status: execution.appliedGains ? 'completed' : 'unconfirmed',
        code: execution.appliedGains ? 'reward_confirmed' : 'reward_unconfirmed', stage: 'reward',
        message: execution.appliedGains ? '已确认本次目标材料收益'
          : relevantIssues.length > 0 ? '本次材料数量无法确认' : '未确认获得目标材料',
      });
    }
  }
  return rewards.inventory;
}
