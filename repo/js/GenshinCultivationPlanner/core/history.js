const MAX_HISTORY_ENTRIES = 100;

/** 保存精简运行记录，避免历史文件无限增长。 */
export function appendRunHistory(history, record) {
  const previous = Array.isArray(history) ? history : [];
  return [...previous, record].slice(-MAX_HISTORY_ENTRIES);
}

/** 将本次运行中与复盘有关的数据固定为可持久化的 JSON。 */
export function buildRunRecord({ executionEnabled, plan, inventoryBefore, inventoryAfter, execution, domainResinPolicy, executionPolicy = null }) {
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
      tasks: (execution.tasks ?? []).map((item) => ({
        status: item.status,
        reason: item.reason ?? null,
        continueResinQueue: item.continueResinQueue,
        evidence: item.evidence ?? {},
        task: item.task ? {
          executionType: item.task.executionType,
          domainName: item.task.domainName ?? null,
          bossName: item.task.bossName ?? null,
          materialName: item.task.materialName,
          materials: item.task.materials ?? [],
        } : null,
      })),
      trackedRewards: execution.trackedRewards ?? {},
      routes: execution.routes ?? [],
      appliedGains: execution.appliedGains === true,
      result: classifyExecutionResult(execution),
      evidence: buildExecutionEvidence(execution),
    } : null,
    domainResinPolicy,
    executionPolicy,
    profileSnapshot: plan.profileSnapshot ?? null,
    inventoryBefore,
    inventoryAfter,
    remainingShortages: (plan.displayShortages ?? [])
      .filter((item) => item.shortage > 0)
      .map((item) => ({ materialId: item.materialId, shortage: item.shortage })),
  };
}

function buildExecutionEvidence(execution) {
  const materialTrackingApplicable = execution.task != null && execution.task.executionType !== 'artifactDomain';
  return {
    inventoryChecked: execution.inventoryChecked === true,
    inventoryGainConfirmed: execution.inventoryChecked === true && execution.appliedGains === true,
    materialTrackingApplicable,
  };
}

function classifyExecutionResult(execution) {
  if (execution.status === 'failed') return 'failed';
  if (execution.status === 'skipped') return 'skipped';
  if (execution.status === 'unconfirmed') return 'unconfirmed';
  if (execution.task?.executionType === 'artifactDomain') return 'completed-untracked';
  if (execution.inventoryChecked === true && execution.appliedGains === true) return 'completed-inventory-confirmed';
  return 'completed-unconfirmed';
}
