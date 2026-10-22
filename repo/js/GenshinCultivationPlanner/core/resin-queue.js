import { buildArtifactDomainExecutionConfig } from './artifact-executor.js';
import { buildBossExecutionConfig, isBossTaskEnabled } from './boss-executor.js';
import { buildDomainExecutionConfig } from './domain-executor.js';
import { getTaskPolicyType } from './resin-policy-v2.js';
import { limitDomainResinPolicy } from './resin.js';

export const MAX_RESIN_QUEUE_TASKS = 4;

/**
 * 根据 V2 策略构造有界队列，并在任何游戏操作前编译每一项执行配置。
 * 第一版每个任务类别最多选择一个具体目标，避免在同类多个秘境之间伪造精确分配。
 */
export function compileResinExecutionQueue({ plan, settings, policy, domainResinPolicy }) {
  const candidates = (plan.todayQueue ?? []).filter((task) => (
    task.status === 'supported' && isTaskEnabled(task, settings)
  )).filter((task, index, items) => items.findIndex((other) => (
    other.executionType === task.executionType && resolveTarget(other) === resolveTarget(task)
    && String(other.sundaySelectedValue ?? '') === String(task.sundaySelectedValue ?? '')
  )) === index);
  if (policy.mode === 'legacy') {
    const task = candidates[0];
    const entry = task ? compileEntry(task, policy, settings, domainResinPolicy) : null;
    if (entry) {
      return {
        entries: [{ ...entry, unsupportedFallbacks: candidates.slice(1)
          .map((candidate) => compileEntry(candidate, policy, settings, domainResinPolicy)) }],
        omitted: [],
      };
    }
    return {
      entries: entry ? [entry] : [],
      omitted: [],
    };
  }

  const entries = [];
  const omitted = [];
  for (const category of policy.taskOrder) {
    const categoryTasks = candidates.filter((task) => getTaskPolicyType(task) === category);
    if (categoryTasks.length === 0) continue;
    const entry = compileEntry(categoryTasks[0], policy, settings, domainResinPolicy);
    entries.push({
      ...entry,
      unsupportedFallbacks: categoryTasks.slice(1)
        .map((task) => compileEntry(task, policy, settings, domainResinPolicy)),
    });
    for (const task of categoryTasks.slice(1)) {
      omitted.push({
        task,
        category,
        code: 'same_category_deferred',
        reason: '同一类别只执行首个可用目标；仅在原生接口明确拒绝、尚未消耗树脂时替补',
      });
    }
  }
  if (entries.length > MAX_RESIN_QUEUE_TASKS) {
    throw new Error(`树脂任务队列超过安全上限 ${MAX_RESIN_QUEUE_TASKS} 项`);
  }
  return { entries, omitted };
}

/** 没有可靠剩余树脂证据时，用任务结果决定是否继续下一项。 */
export function shouldStopResinQueue(execution, entry = null) {
  if (!execution) return true;
  if ((execution.tasks ?? []).some((task) => ['failed', 'cancelled'].includes(task.evidence?.cleanup?.status))) return true;
  if ((execution.warnings ?? []).some((warning) => warning.code === 'cleanup_failed')) return true;
  if (execution.status === 'skipped' && execution.code === 'native_unsupported') return false;
  if (execution.status === 'failed' || execution.status === 'unconfirmed') return true;
  if (execution.code === 'no_resin') return true;
  // “用完可用树脂”表示把剩余预算交给当前任务；后续任务没有可靠的剩余树脂证据，不再探测调用。
  return entry != null && entry.maxClaims == null;
}

/** 顺序运行有界队列；调用方负责把异常转换为统一任务结果。 */
export async function runBoundedResinQueue(entries, executeEntry) {
  const results = [];
  const attemptedIds = new Set();
  for (const [index, entry] of entries.entries()) {
    let result;
    let attempted = entry;
    for (const candidate of [entry, ...(entry.unsupportedFallbacks ?? [])]) {
      const id = candidate.queueId ?? `${candidate.task?.executionType}:${resolveTarget(candidate.task ?? {})}:${candidate.task?.sundaySelectedValue ?? ''}`;
      if (attemptedIds.has(id)) continue;
      attemptedIds.add(id);
      attempted = candidate;
      result = await executeEntry(candidate, index);
      results.push(result);
      if (result?.status !== 'skipped' || result.code !== 'native_unsupported') break;
    }
    if (result && shouldStopResinQueue(result, attempted)) break;
  }
  return results;
}

function compileEntry(task, policy, settings, domainResinPolicy) {
  const category = getTaskPolicyType(task);
  if (!category) throw new Error(`暂不支持执行任务类型：“${task.executionType ?? '未知'}”`);
  let maxClaims = task.executionType === 'artifactDomain' && settings.artifactTestSingleRun === true
    ? 1 : policy.taskLimits[category]?.maxClaims ?? null;
  const boundedDomainPolicy = limitDomainResinPolicy(domainResinPolicy, maxClaims);
  let config;
  if (task.executionType === 'boss') {
    config = buildBossExecutionConfig(task, settings, maxClaims);
    maxClaims = config.runCount;
  } else if (task.executionType === 'domain') {
    config = buildDomainExecutionConfig(task, settings, boundedDomainPolicy);
  } else if (task.executionType === 'artifactDomain') {
    config = buildArtifactDomainExecutionConfig(task, settings, boundedDomainPolicy);
  } else {
    throw new Error(`暂不支持执行任务类型：“${task.executionType}”`);
  }
  return Object.freeze({
    queueId: `${category}:${resolveTarget(task)}:${task.sundaySelectedValue ?? ''}`,
    category,
    task,
    maxClaims,
    config,
  });
}

function isTaskEnabled(task, settings) {
  if (task.executionType === 'boss') return isBossTaskEnabled(task, settings);
  if (task.executionType === 'artifactDomain') return settings.artifactDomainEnabled === true;
  return task.executionType === 'domain';
}

function resolveTarget(task) {
  return task.bossName ?? task.domainName ?? task.materialName ?? task.materialId ?? 'unknown';
}
