import { buildTrackedInventoryGains } from './execution-progress.js';

/** 将 BetterGI/ClearScript 返回的奖励字典转换为普通对象。 */
export function normalizeRewardMap(rawRewards) {
  if (!rawRewards) return {};

  const result = {};
  if (rawRewards.Keys) {
    for (const key of rawRewards.Keys) addReward(result, key, rawRewards[key]);
    return result;
  }
  for (const [name, count] of Object.entries(rawRewards)) {
    addReward(result, name, count);
  }
  return result;
}

/**
 * 逐材料合并背包差值与任务奖励证据。
 * 背包结果可信时优先使用背包；背包漏识别时才使用任务奖励兜底。
 */
export function reconcileRewardEvidence({
  inventoryBefore,
  inventoryAfter,
  trackedMaterialIds,
  materials,
  inventoryIssueNames = [],
  taskRecognizedRewards = {},
  taskExecutionType = '',
}) {
  const adjustedInventory = { ...inventoryAfter };
  const inventoryTrackedRewards = buildTrackedInventoryGains(
    inventoryBefore,
    inventoryAfter,
    trackedMaterialIds,
    materials,
  );
  const taskTrackedRewards = taskExecutionType === 'artifactDomain'
    ? {}
    : filterTrackedRewards(taskRecognizedRewards, trackedMaterialIds, materials);
  const issueNames = new Set(inventoryIssueNames);
  const trackedRewards = {};
  const gainSources = {};
  const rewardDiscrepancies = [];

  for (const materialId of trackedMaterialIds) {
    const name = materials[materialId]?.name ?? String(materialId);
    const inventoryGain = inventoryTrackedRewards[name] ?? 0;
    const taskGain = taskTrackedRewards[name] ?? 0;
    if (!issueNames.has(name)) {
      if (inventoryGain > 0) {
        trackedRewards[name] = inventoryGain;
        gainSources[name] = 'inventory';
      }
      if (taskGain > 0 && taskGain !== inventoryGain) {
        rewardDiscrepancies.push({ name, inventoryGain, taskGain, selected: 'inventory' });
      }
      continue;
    }
    if (taskGain <= 0) continue;

    trackedRewards[name] = taskGain;
    gainSources[name] = 'task-recognition';
    const previous = inventoryBefore[materialId];
    if (Number.isInteger(previous)) adjustedInventory[materialId] = previous + taskGain;
  }

  return {
    inventory: adjustedInventory,
    inventoryTrackedRewards,
    taskTrackedRewards,
    trackedRewards,
    gainSources,
    rewardDiscrepancies,
  };
}

function filterTrackedRewards(rewards, trackedMaterialIds, materials) {
  const trackedNames = new Set(trackedMaterialIds.map((materialId) => materials[materialId]?.name ?? String(materialId)));
  return Object.fromEntries(Object.entries(rewards)
    .filter(([name, count]) => trackedNames.has(name) && Number.isInteger(count) && count > 0));
}

function addReward(target, rawName, rawCount) {
  const name = String(rawName ?? '').trim();
  const count = Number(rawCount);
  if (!name || !Number.isFinite(count) || count <= 0) return;
  target[name] = (target[name] ?? 0) + Math.floor(count);
}
