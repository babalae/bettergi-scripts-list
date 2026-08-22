const MAX_HISTORY_ENTRIES = 100;

/** 保存精简运行记录，避免历史文件无限增长。 */
export function appendRunHistory(history, record) {
  const previous = Array.isArray(history) ? history : [];
  return [...previous, record].slice(-MAX_HISTORY_ENTRIES);
}

/** 将本次运行中与复盘有关的数据固定为可持久化的 JSON。 */
export function buildRunRecord({ executionEnabled, plan, inventoryBefore, inventoryAfter, execution, domainResinPolicy }) {
  return {
    timestamp: new Date().toISOString(),
    executionEnabled,
    execution: execution ? {
      status: execution.status,
      reason: execution.reason ?? null,
      task: execution.task ? {
        executionType: execution.task.executionType,
        domainName: execution.task.domainName ?? null,
        bossName: execution.task.bossName ?? null,
        materialName: execution.task.materialName,
        materials: execution.task.materials ?? [],
      } : null,
      taskRecognizedRewards: execution.taskRecognizedRewards ?? {},
      inventoryObservedAfter: execution.inventoryObservedAfter ?? null,
      inventoryTrackedRewards: execution.inventoryTrackedRewards ?? {},
      taskTrackedRewards: execution.taskTrackedRewards ?? {},
      trackedRewards: execution.trackedRewards ?? {},
      gainSources: execution.gainSources ?? {},
      rewardDiscrepancies: execution.rewardDiscrepancies ?? [],
      routes: execution.routes ?? [],
      appliedGains: execution.appliedGains === true,
      inventoryRecognitionFailed: execution.inventoryRecognitionFailed === true,
      inventoryUnrecognizedNames: execution.inventoryUnrecognizedNames ?? [],
      result: classifyExecutionResult(execution),
      evidence: buildExecutionEvidence(execution),
    } : null,
    domainResinPolicy,
    inventoryBefore,
    inventoryAfter,
    remainingShortages: (plan.displayShortages ?? [])
      .filter((item) => item.shortage > 0)
      .map((item) => ({ materialId: item.materialId, shortage: item.shortage })),
  };
}

function buildExecutionEvidence(execution) {
  const materialTrackingApplicable = execution.task != null && execution.task.executionType !== 'artifactDomain';
  const gainSources = Object.values(execution.gainSources ?? {});
  const hasLegacyConfirmedGain = gainSources.length === 0
    && execution.inventoryChecked === true
    && execution.appliedGains === true;
  return {
    inventoryChecked: execution.inventoryChecked === true,
    inventoryGainConfirmed: gainSources.includes('inventory') || hasLegacyConfirmedGain,
    taskRecognitionGainConfirmed: gainSources.includes('task-recognition'),
    inventoryRecognitionFailed: execution.inventoryRecognitionFailed === true,
    inventoryUnrecognizedNames: execution.inventoryUnrecognizedNames ?? [],
    materialTrackingApplicable,
  };
}

function classifyExecutionResult(execution) {
  if (execution.status === 'failed') return 'failed';
  if (execution.status === 'skipped') return 'skipped';
  if (execution.task?.executionType === 'artifactDomain') return 'completed-untracked';
  if (Object.values(execution.gainSources ?? {}).includes('task-recognition')) return 'completed-task-recognition-confirmed';
  if (execution.inventoryRecognitionFailed === true) return 'completed-inventory-unrecognized';
  if (execution.inventoryChecked === true && execution.appliedGains === true) return 'completed-inventory-confirmed';
  return 'completed-unconfirmed';
}
