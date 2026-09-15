import { normalizeLegacyExecution } from './execution-outcome.js';

const MAX_HISTORY_ENTRIES = 100;

/** 保存精简运行记录，避免历史文件无限增长。 */
export function appendRunHistory(history, record) {
  const previous = Array.isArray(history) ? history : [];
  return [...previous, record].slice(-MAX_HISTORY_ENTRIES);
}

/**
 * 找出“历史最近一次确认有库存，但本次 ItemV2 未找到”的材料。
 * 历史数量可能已被用户消耗，因此这里只返回冲突证据，不能直接恢复为当前库存。
 */
export function findHistoricalInventoryConflicts(history, notFoundNames, materials, currentTargetSummary = []) {
  const records = Array.isArray(history) ? history : [];
  const targetKey = normalizeTargetSummary(currentTargetSummary);
  if (!targetKey) return [];
  const materialIdByName = new Map(Object.entries(materials ?? {})
    .map(([materialId, material]) => [material?.name, String(materialId)]));
  const conflicts = [];

  for (const name of new Set(notFoundNames ?? [])) {
    const materialId = materialIdByName.get(name);
    if (!materialId) continue;
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index];
      if (normalizeTargetSummary(record?.targetSummary) !== targetKey) continue;
      if (!Object.prototype.hasOwnProperty.call(record?.inventoryAfter ?? {}, materialId)) continue;
      const lastCount = record.inventoryAfter[materialId];
      if (Number.isInteger(lastCount) && lastCount > 0) {
        conflicts.push({
          materialId,
          name,
          lastCount,
          timestamp: record.timestamp ?? null,
          source: record.execution?.gainSources?.[name] ?? 'inventory-history',
        });
      }
      break;
    }
  }
  return conflicts;
}

function normalizeTargetSummary(summary) {
  return Array.isArray(summary) ? summary.map((item) => String(item).trim()).filter(Boolean).join('\n') : '';
}

/** 将本次运行中与复盘有关的数据固定为可持久化的 JSON。 */
export function buildRunRecord({ executionEnabled, plan, inventoryBefore, inventoryAfter, execution, domainResinPolicy, resinPolicyV2 }) {
  const normalizedExecution = normalizeLegacyExecution(execution);
  return {
    timestamp: new Date().toISOString(),
    executionEnabled,
    profile: plan?.profile ?? null,
    targetSummary: plan?.targetSummary ?? [],
    targetOutcomes: plan?.targetOutcomes ?? [],
    execution: normalizedExecution ? {
      status: normalizedExecution.status,
      code: normalizedExecution.code,
      stage: normalizedExecution.stage,
      severity: normalizedExecution.severity,
      retryable: normalizedExecution.retryable === true,
      reason: normalizedExecution.reason ?? null,
      message: normalizedExecution.message ?? '',
      task: normalizedExecution.task ? {
        executionType: normalizedExecution.task.executionType,
        domainName: normalizedExecution.task.domainName ?? null,
        bossName: normalizedExecution.task.bossName ?? null,
        materialName: normalizedExecution.task.materialName,
        materials: normalizedExecution.task.materials ?? [],
      } : null,
      tasks: normalizedExecution.tasks ?? [],
      warnings: normalizedExecution.warnings ?? [],
      taskRecognizedRewards: normalizedExecution.taskRecognizedRewards ?? {},
      inventoryObservedAfter: normalizedExecution.inventoryObservedAfter ?? null,
      inventoryTrackedRewards: normalizedExecution.inventoryTrackedRewards ?? {},
      taskTrackedRewards: normalizedExecution.taskTrackedRewards ?? {},
      trackedRewards: normalizedExecution.trackedRewards ?? {},
      gainSources: normalizedExecution.gainSources ?? {},
      rewardDiscrepancies: normalizedExecution.rewardDiscrepancies ?? [],
      routes: normalizedExecution.routes ?? [],
      appliedGains: normalizedExecution.appliedGains === true,
      inventoryRecognitionFailed: normalizedExecution.inventoryRecognitionFailed === true,
      inventoryUnrecognizedNames: normalizedExecution.inventoryUnrecognizedNames ?? [],
      inventoryBeforeNotFoundNames: normalizedExecution.inventoryBeforeNotFoundNames ?? [],
      inventoryAfterNotFoundNames: normalizedExecution.inventoryAfterNotFoundNames ?? [],
      result: classifyExecutionResult(normalizedExecution),
      evidence: buildExecutionEvidence(normalizedExecution),
    } : null,
    domainResinPolicy,
    resinPolicyV2: resinPolicyV2 ?? plan?.resinPolicyV2 ?? null,
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
    inventoryBeforeNotFoundNames: execution.inventoryBeforeNotFoundNames ?? [],
    inventoryAfterNotFoundNames: execution.inventoryAfterNotFoundNames ?? [],
    materialTrackingApplicable,
  };
}

function classifyExecutionResult(execution) {
  if (execution.status === 'failed') return 'failed';
  if (execution.status === 'skipped') return 'skipped';
  if (execution.status === 'unconfirmed') return 'completed-unconfirmed';
  if (execution.task?.executionType === 'artifactDomain') return 'completed-untracked';
  if (Object.values(execution.gainSources ?? {}).includes('task-recognition')) return 'completed-task-recognition-confirmed';
  if (execution.inventoryRecognitionFailed === true) return 'completed-inventory-unrecognized';
  if (execution.inventoryChecked === true && execution.appliedGains === true) return 'completed-inventory-confirmed';
  return 'completed-unconfirmed';
}
