import { createPlan } from './core/planner.js';
import { applyInventoryScanResult, buildInventoryScanGroups, invalidateCraftingFamilies } from './core/inventory.js';
import { applyMatchedRouteSupport, discoverAutoPathingRoutes } from './core/routes.js';
import { buildFailureRunSummary, buildRunSummary } from './core/report.js';
import { collectExecutionWarningOutcomes } from './core/preflight.js';
import { applyDomainResinPolicyToParam, buildDomainResinPolicy } from './core/resin.js';
import { compileResinPolicyV2, formatResinPolicyPreview } from './core/resin-policy-v2.js';
import { compileResinExecutionQueue, runBoundedResinQueue } from './core/resin-queue.js';
import { normalizeRewardMap, reconcileRewardEvidence } from './core/rewards.js';
import { runBossTaskWithSafeExit } from './core/boss-safety.js';
import { buildWeeklyStrategy } from './core/scheduler.js';
import { appendRunHistory, buildRunRecord, findHistoricalInventoryConflicts } from './core/history.js';
import { parseTargetText } from './core/target-input.js';
import { resolvePlanningWeekday } from './core/server-weekday.js';
import { buildCompletionEstimate } from './core/estimate.js';
import { applyFinalRouteInventoryGains, buildRouteExecutionPlan, runSubscribedRouteFile } from './core/route-executor.js';
import { appendArtifactFallbackTask } from './core/artifact-executor.js';
import { switchPartyWithRecovery } from './core/party-switch.js';
import { assertExecutionConfirmed, normalizeScriptSettings, validateBossOverrideNames } from './core/settings.js';
import {
  createExecutionOutcome,
  createRunExecution,
  combineRunExecutions,
  updatePrimaryTaskOutcome,
  updateRunOutcome,
} from './core/execution-outcome.js';
import { classifyExecutionError, withExecutionContext } from './core/error-classifier.js';
import {
  buildAutomaticProfileTargets,
  buildTargetSummary,
  isAutomaticProfileMode,
  prepareAutomaticProfileRequest,
  readCharacterProfile,
} from './core/character-profile.js';

const failureNotificationState = { settings: null, stage: '初始化' };

async function main() {
  let scriptSettings;
  try {
    scriptSettings = normalizeScriptSettings(settings);
    scriptSettings.resinPolicyV2 = compileResinPolicyV2(scriptSettings);
    assertExecutionConfirmed(scriptSettings);
  } catch (error) {
    log.error('[配置] {message}', error?.message ?? String(error));
    throw withExecutionContext(error, { code: 'config_invalid', stage: 'preflight' });
  }
  const executionEnabled = true;
  failureNotificationState.settings = scriptSettings;
  log.info('[模式] 已确认配置，进入实际执行模式');

  failureNotificationState.stage = '读取培养目标';
  const materials = JSON.parse(file.readTextSync('data/materials.json'));
  const recipes = JSON.parse(file.readTextSync('data/crafting-recipes.json'));
  const rulebook = JSON.parse(file.readTextSync('data/rulebook.json'));
  const bossCatalog = JSON.parse(file.readTextSync('data/bettergi-boss-catalog.json'));
  let history = [];
  try {
    history = JSON.parse(file.readTextSync('record/history.json'));
  } catch {
    // 首次运行没有历史文件属于正常情况。
  }
  validateBossOverrideNames(scriptSettings, bossCatalog);
  let targetData;
  let profileRecord = null;
  if (isAutomaticProfileMode(scriptSettings)) {
    try {
      const request = prepareAutomaticProfileRequest(scriptSettings, rulebook);
      const service = typeof characterDevelopmentTask === 'undefined' ? null : characterDevelopmentTask;
      let profile = null;
      let profileError = null;
      if (request.requiresProfile) {
        try {
          profile = await readCharacterProfile(service, request);
        } catch (error) {
          if (request.cultivationMode !== '培养角色和指定武器') throw error;
          profileError = error;
          log.warn('[自动档案] 角色档案读取失败；本次仍继续处理独立的指定武器目标：{message}', error?.message ?? String(error));
        }
      }
      const generated = buildAutomaticProfileTargets(profile, scriptSettings, rulebook, request, profileError);
      const failedOutcomes = generated.targetOutcomes.filter((outcome) => outcome.status === 'failed');
      if (generated.targets.length === 0 && failedOutcomes.length > 0) {
        throw new Error(`没有可继续处理的培养目标：${failedOutcomes.map((outcome) => outcome.message).join('；')}`);
      }
      targetData = { targets: generated.targets, inventory: {} };
      profileRecord = {
        mode: scriptSettings.targetInputMode,
        cultivationMode: request.cultivationMode,
        previewOnly: request.previewOnly,
        profile,
        targets: generated.targets,
        targetOutcomes: generated.targetOutcomes,
        targetSummary: generated.summary,
        ignoredWeaponReason: generated.ignoredWeaponReason,
      };
      await file.writeText('record/latest-profile.json', JSON.stringify(profileRecord, null, 2), false);
      if (profile) {
        log.info('[自动档案] 已识别角色“{name}”；原始规范化结果：{profile}', profile.characterName, JSON.stringify(profile.raw));
      } else if (!request.requiresProfile) {
        log.info('[自动档案] 当前为仅培养指定武器，不读取角色档案');
      }
      for (const line of generated.summary) log.info('[自动档案] {summary}', line);
      for (const outcome of failedOutcomes) {
        log.warn('[自动档案] {kind}目标未能生成，但不影响其他有效目标：{message}', outcome.kind, outcome.message);
      }
      log.info('[自动档案] 已保存识别记录：record/latest-profile.json');
      if (request.previewOnly) {
        log.info('[自动档案] 仅预览模式已完成；未读取背包、未执行刷取任务、未发送通知');
        return;
      }
    } catch (error) {
      const code = /未提供 characterDevelopmentTask\.GetCharacter/.test(error?.message ?? '')
        ? 'capability_missing'
        : 'profile_invalid';
      log.error('[自动档案] {message}', error?.message ?? String(error));
      throw withExecutionContext(error, { code, stage: 'profile' });
    }
  } else {
    targetData = loadTargets(scriptSettings, rulebook);
  }
  const targetSummary = profileRecord?.targetSummary ?? buildTargetSummary(targetData.targets ?? []);
  const sourceCandidates = JSON.parse(file.readTextSync('data/source-candidates.json'));
  const routeOverrides = JSON.parse(file.readTextSync('data/route-overrides.json'));
  const today = resolvePlanningWeekday({
    automatic: scriptSettings.useServerWeekday !== false,
    manualWeekday: scriptSettings.weekday,
    nowMs: Date.now(),
    serverOffsetMs: ServerTime.GetServerTimeZoneOffset(),
  });
  log.info('[初始化] 目标数量：{count}；计划日：{day}（{source}）', (targetData.targets ?? []).length, today,
    scriptSettings.useServerWeekday !== false ? '服务器时间 04:00 刷新规则' : '手动指定');
  for (const target of targetData.targets ?? []) {
    log.info('[目标] {kind}：{name}', target.kind, target.name);
  }
  const allTargetsSatisfied = profileRecord != null
    && (targetData.targets ?? []).length === 0
    && !(profileRecord.targetOutcomes ?? []).some((outcome) => outcome.status === 'failed');
  if (allTargetsSatisfied) {
    log.info('[目标] 所选培养目标均已达到，本次不读取背包、不检查路线且不执行刷取任务');
  }

  let inventory = targetData.inventory ?? {};
  let inventoryBeforeIssueNames = [];
  let inventoryBeforeNotFoundNames = [];
  let historicalInventoryConflicts = [];
  const runWarnings = [];
  let plan = createPlan({
    targets: targetData.targets ?? [],
    inventory,
    materials,
    recipes,
    rulebook,
    today,
  });
  attachTargetContext(plan, profileRecord, targetSummary);

  // 兼容 BetterGI 已保存的旧设置：字段不存在时也默认开启读取。
  if (!allTargetsSatisfied && scriptSettings.scanInventory !== false) {
    failureNotificationState.stage = '执行前读取背包';
    const initialInventoryScan = await scanInventoryMaterials(plan, inventory, materials, '执行前');
    inventory = initialInventoryScan.inventory;
    inventoryBeforeNotFoundNames = initialInventoryScan.notFoundNames;
    inventoryBeforeIssueNames = [...new Set([
      ...initialInventoryScan.issueNames,
      ...initialInventoryScan.notFoundNames,
    ])];
    historicalInventoryConflicts = findHistoricalInventoryConflicts(
      history,
      initialInventoryScan.notFoundNames,
      materials,
      targetSummary,
    );
    if (historicalInventoryConflicts.length > 0) {
      const invalidated = invalidateCraftingFamilies(
        inventory,
        historicalInventoryConflicts.map((item) => item.materialId),
        recipes,
      );
      inventory = invalidated.inventory;
      for (const conflict of historicalInventoryConflicts) {
        const message = `执行前未找到“${conflict.name}”，但同一培养目标的历史最近一次确认数量为 ${conflict.lastCount}；材料可能已消耗，也可能漏识别。为避免重复刷取，已暂停相关合成链任务；若材料已用于升级，请先更新当前等级`;
        log.warn('[背包] {message}', message);
        runWarnings.push(createExecutionOutcome({
          taskId: `inventory:history-conflict:${conflict.materialId}`,
          taskType: 'inventory',
          targetName: conflict.name,
          status: 'unconfirmed', code: 'inventory_history_conflict', stage: 'inventory', severity: 'warning',
          message,
          evidence: { ...conflict, invalidatedMaterialIds: invalidated.invalidatedIds },
        }));
      }
    }
    if (initialInventoryScan.issueNames.length > 0) {
      runWarnings.push(createExecutionOutcome({
        taskId: 'inventory:before', taskType: 'inventory', targetName: '执行前背包读取',
        status: 'unconfirmed', code: 'inventory_scan_failed', stage: 'inventory', severity: 'warning',
        message: `执行前未能确认部分材料：${initialInventoryScan.issueNames.join('、')}`,
        evidence: { phase: 'before', issueNames: initialInventoryScan.issueNames },
      }));
    }

    plan = createPlan({
      targets: targetData.targets ?? [],
      inventory,
      materials,
      recipes,
      rulebook,
      today,
    });
    attachTargetContext(plan, profileRecord, targetSummary);
    plan.inventoryUncertainties = historicalInventoryConflicts;
  } else if (!allTargetsSatisfied) {
    log.info('[背包] 已关闭自动读取，库存仅使用目标文件中的 inventory 字段');
  }

  if (allTargetsSatisfied) {
    plan.routes = { matched: [], missing: [] };
  } else if (scriptSettings.discoverRoutes !== false) {
    try {
      plan.routes = discoverAutoPathingRoutes({
        shortages: plan.displayShortages,
        sourceCandidates,
        routeOverrides,
        pathing: {
          readPaths: (path) => Array.from(pathingScript.ReadPathSync(path)),
          isFolder: (path) => pathingScript.IsFolder(path),
          isFile: (path) => pathingScript.IsFile(path),
        },
      });
      for (const item of plan.routes.matched) {
        log.info('[路线] 已匹配 {type}“{name}”：{count} 条；{source}', item.type, item.name, item.paths.length, item.source);
      }
      for (const item of plan.routes.missing) {
        log.warn('[路线] 未匹配 {type}“{name}”：{reason}', item.type, item.name, item.reason);
      }
      applyMatchedRouteSupport(plan, plan.routes);
    } catch (error) {
      plan.routes = { matched: [], missing: [], error: error.message ?? String(error) };
      log.error('[路线] 自动检查已订阅路线失败：{error}', plan.routes.error);
    }
  } else {
    log.info('[路线] 已关闭已订阅路线检查');
  }

  const domainResinPolicy = buildDomainResinPolicy(scriptSettings);
  const resinPolicyV2 = scriptSettings.resinPolicyV2;
  if (!allTargetsSatisfied) appendArtifactFallbackTask(plan, scriptSettings, resinPolicyV2);
  let compiledQueue;
  try {
    compiledQueue = compileResinExecutionQueue({
      plan,
      settings: scriptSettings,
      policy: resinPolicyV2,
      domainResinPolicy,
    });
  } catch (error) {
    throw withExecutionContext(error, { code: 'config_invalid', stage: 'preflight' });
  }
  plan.executionQueue = compiledQueue.entries.map(({ queueId, category, task, maxClaims, config }) => ({
    queueId,
    category,
    executionType: task.executionType,
    targetName: task.bossName ?? task.domainName ?? task.materialName,
    maxClaims,
    boundedResinType: config.resinPolicy?.boundedResinType ?? null,
  }));
  plan.executionQueueOmitted = compiledQueue.omitted;
  const executionWarnings = collectExecutionWarningOutcomes(plan, scriptSettings);
  runWarnings.push(...executionWarnings);
  for (const warning of executionWarnings) {
    log.warn('[执行前检查] {warning}', warning.message);
  }
  const resinPolicyPreview = formatResinPolicyPreview(resinPolicyV2);
  plan.weeklyStrategy = buildWeeklyStrategy(plan.weeklyPlan, today);
  const discoveredRoutes = plan.routes;
  log.info('[树脂] 秘境策略：指定使用={specified}；BetterGI 实际顺序={priority}；原粹/浓缩/须臾/脆弱上限={original}/{condensed}/{transient}/{fragile}',
    domainResinPolicy.specifyResinUse,
    domainResinPolicy.priority.join('、') || '无',
    domainResinPolicy.originalResinUseCount,
    domainResinPolicy.condensedResinUseCount,
    domainResinPolicy.transientResinUseCount,
    domainResinPolicy.fragileResinUseCount);
  log.info('[树脂规则 V2] 模式={mode}；任务顺序={order}；允许树脂={resins}；路线时机={routeTiming}',
    resinPolicyPreview.mode, resinPolicyPreview.order, resinPolicyPreview.resinTypes, resinPolicyPreview.routeTiming);
  for (const [index, entry] of compiledQueue.entries.entries()) {
    const target = entry.task.bossName ?? entry.task.domainName ?? entry.task.materialName;
    const limit = entry.maxClaims == null ? '使用该任务可用的剩余预算' : `最多领奖 ${entry.maxClaims} 次`;
    const boundedResin = entry.config.resinPolicy?.boundedResinType
      ? `；有限预算仅使用${entry.config.resinPolicy.boundedResinType}` : '';
    log.info('[执行队列] {index}. {type}“{target}”：{limit}{boundedResin}',
      index + 1, entry.category, target, limit, boundedResin);
  }
  for (const omitted of compiledQueue.omitted) {
    const target = omitted.task.bossName ?? omitted.task.domainName ?? omitted.task.materialName;
    log.warn('[执行队列] 暂缓同类任务“{target}”：{reason}', target, omitted.reason);
  }
  plan.domainResinPolicy = domainResinPolicy;
  plan.resinPolicyV2 = resinPolicyV2;
  const inventoryBeforeExecution = { ...inventory };
  const trackedMaterialIds = [...plan.crafting.scanMaterialIds];

  {
    failureNotificationState.stage = '执行刷取任务';
    const partySwitchState = { initialized: false };
    let execution = createRunExecution({
      status: 'skipped', code: allTargetsSatisfied ? 'targets_satisfied' : 'no_candidate', stage: 'preflight',
      message: allTargetsSatisfied ? '培养目标已全部完成' : '今日没有已启用的树脂任务',
    });
    let routeRecords = [];
    if (!allTargetsSatisfied && resinPolicyV2.routeTiming === 'beforeResin' && scriptSettings.routeExecutionEnabled === true) {
      routeRecords = await executeRoutesSafely(discoveredRoutes, scriptSettings, materials, recipes, partySwitchState);
      if (routeRecords.some((route) => route.status === 'failed')) {
        execution = createRunExecution({
          status: 'failed', code: 'route_prerequisite_failed', stage: 'task',
          message: '树脂任务前的路线执行失败，已停止后续自动任务',
        });
      }
    }
    if (execution.status !== 'failed' && !allTargetsSatisfied) {
      execution = await executeResinQueue(
        compiledQueue.entries,
        scriptSettings,
        partySwitchState,
        historicalInventoryConflicts.length > 0
          ? '执行前背包识别与历史确认记录冲突，已暂停相关任务'
          : null,
      );
    }
    execution.warnings = [...runWarnings, ...(execution.warnings ?? [])];
    plan.execution = execution;
    if (!allTargetsSatisfied && resinPolicyV2.routeTiming === 'afterResin'
      && execution.status !== 'failed'
      && scriptSettings.routeExecutionEnabled === true) {
      routeRecords = await executeRoutesSafely(discoveredRoutes, scriptSettings, materials, recipes, partySwitchState);
    }
    execution.routes = routeRecords;
    execution.inventoryBeforeNotFoundNames = inventoryBeforeNotFoundNames;

    const hasExecutionAttempt = execution.status !== 'skipped'
      || (execution.tasks?.length ?? 0) > 0
      || (execution.routes?.length ?? 0) > 0;
    if (hasExecutionAttempt && scriptSettings.scanInventory !== false && trackedMaterialIds.length > 0) {
      const finalInventoryScan = await scanInventoryItemIds(
        trackedMaterialIds,
        inventory,
        materials,
        '全部任务结束后',
        { preserveDecreases: true, notFoundAsUnknown: true },
      );
      const rewardEvidence = reconcileRewardEvidence({
        inventoryBefore: inventoryBeforeExecution,
        inventoryAfter: finalInventoryScan.inventory,
        trackedMaterialIds,
        materials,
        inventoryBeforeIssueNames,
        inventoryAfterIssueNames: finalInventoryScan.issueNames,
        taskRecognizedRewards: execution.taskRecognizedRewards,
        taskExecutionType: hasOnlyArtifactTasks(execution) ? 'artifactDomain' : 'mixed',
      });
      execution.inventoryObservedAfter = finalInventoryScan.inventory;
      inventory = rewardEvidence.inventory;
      execution.inventoryTrackedRewards = rewardEvidence.inventoryTrackedRewards;
      execution.taskTrackedRewards = rewardEvidence.taskTrackedRewards;
      execution.trackedRewards = rewardEvidence.trackedRewards;
      execution.gainSources = rewardEvidence.gainSources;
      execution.rewardDiscrepancies = rewardEvidence.rewardDiscrepancies;
      execution.inventoryChecked = true;
      execution.inventoryRecognitionFailed = finalInventoryScan.issueNames.length > 0;
      execution.inventoryUnrecognizedNames = finalInventoryScan.issueNames;
      execution.inventoryAfterNotFoundNames = finalInventoryScan.notFoundNames;
      execution.appliedGains = Object.keys(execution.trackedRewards).length > 0;
      if (finalInventoryScan.issueNames.length > 0) {
        execution.warnings.push(createExecutionOutcome({
          taskId: 'inventory:after', taskType: 'inventory', targetName: '结束背包复核',
          status: 'unconfirmed', code: 'inventory_scan_failed', stage: 'inventory', severity: 'warning',
          message: `结束背包未能确认部分材料：${finalInventoryScan.issueNames.join('、')}`,
          evidence: { phase: 'after', issueNames: finalInventoryScan.issueNames },
          endedAt: new Date().toISOString(),
        }));
      }
      if ((execution.tasks?.length ?? 0) > 0 && execution.status !== 'failed' && execution.code !== 'no_resin') {
        const evidence = {
          taskRecognizedRewards: execution.taskRecognizedRewards,
          inventoryTrackedRewards: execution.inventoryTrackedRewards,
          taskTrackedRewards: execution.taskTrackedRewards,
          trackedRewards: execution.trackedRewards,
          gainSources: execution.gainSources,
          rewardDiscrepancies: execution.rewardDiscrepancies,
          inventoryRecognitionFailed: execution.inventoryRecognitionFailed,
          inventoryUnrecognizedNames: execution.inventoryUnrecognizedNames,
          inventoryBeforeNotFoundNames: execution.inventoryBeforeNotFoundNames,
          inventoryAfterNotFoundNames: execution.inventoryAfterNotFoundNames,
        };
        const updater = execution.tasks.length === 1 ? updatePrimaryTaskOutcome : updateRunOutcome;
        if (hasOnlyArtifactTasks(execution) && !(execution.routes?.length > 0)) {
          updater(execution, {
            status: 'completed', code: 'task_completed_untracked', stage: 'reward',
            message: '圣遗物任务调用结束；收益不纳入培养材料统计', evidence, endedAt: new Date().toISOString(),
          });
        } else if (execution.appliedGains) {
          updater(execution, {
            status: 'completed', code: 'reward_confirmed', stage: 'reward',
            message: '已确认目标材料收益', evidence, endedAt: new Date().toISOString(),
          });
        } else {
          updater(execution, {
            status: 'unconfirmed', code: 'reward_unconfirmed', stage: 'reward', severity: 'warning',
            message: '未确认领取到目标材料', evidence, endedAt: new Date().toISOString(),
          });
        }
      }
      const taskFallbackNames = Object.entries(execution.gainSources)
        .filter(([, source]) => source === 'task-recognition')
        .map(([name]) => name);
      if (execution.rewardDiscrepancies.length > 0) {
        for (const item of execution.rewardDiscrepancies) {
          log.warn('[奖励] “{name}”的背包差值为 {inventory}，任务奖励识别为 {task}；按规则采用背包差值',
            item.name, item.inventoryGain, item.taskGain);
        }
      }
      if (execution.routes?.length > 0) {
        execution.routes = applyFinalRouteInventoryGains(
          execution.routes,
          inventoryBeforeExecution,
          inventory,
          {
            unreliableMaterialIds: trackedMaterialIds.filter((materialId) => {
              const name = materials[materialId]?.name ?? String(materialId);
              return inventoryBeforeIssueNames.includes(name) || finalInventoryScan.issueNames.includes(name);
            }),
          },
        );
        for (const route of execution.routes.filter((item) => item.status === 'unconfirmed')) {
          log.warn('[路线执行] “{name}”在全部任务结束后的背包复核中未确认到材料增长', route.name);
        }
      }
      if (taskFallbackNames.length > 0) {
        log.info('[执行] 结束背包未识别到部分材料，已使用 BetterGI 任务奖励确认收益：{rewards}',
          JSON.stringify(Object.fromEntries(taskFallbackNames.map((name) => [name, execution.trackedRewards[name]]))));
      } else if (execution.appliedGains && execution.inventoryRecognitionFailed) {
        log.warn('[执行] 已确认部分目标材料收益，但以下材料未能完成背包复核：{names}。请查看前述 ItemV2 图标或数量 OCR 日志',
          execution.inventoryUnrecognizedNames.join('、'));
      } else if (execution.appliedGains) {
        log.info('[执行] 已按整次运行的背包前后差值确认目标材料收益：{rewards}', JSON.stringify(execution.trackedRewards));
      } else if (hasOnlyArtifactTasks(execution) && !(execution.routes?.length > 0)) {
        log.info('[执行] 圣遗物填充不按目标培养材料的背包差值统计收益');
      } else if (execution.inventoryRecognitionFailed) {
        log.warn('[执行] 任务已调用，但以下材料未能完成结束背包复核，奖励结果未知：{names}。请查看前述 ItemV2 图标或数量 OCR 日志',
          execution.inventoryUnrecognizedNames.join('、'));
      } else if (execution.routes?.length > 0) {
        log.warn('[执行] 全部任务结束后未确认到目标材料增长，可能是路线未获得材料或背包 OCR 失败');
      } else {
        log.warn('[执行] 树脂任务调用结束，但任务奖励识别为空且最终背包未确认到目标材料增长；可能未领奖或奖励识别失败');
      }
    }

    if (hasExecutionAttempt) {
      plan = createPlan({
        targets: targetData.targets ?? [],
        inventory,
        materials,
        recipes,
        rulebook,
        today,
      });
      attachTargetContext(plan, profileRecord, targetSummary);
      plan.routes = discoveredRoutes;
      applyMatchedRouteSupport(plan, discoveredRoutes);
      plan.weeklyStrategy = buildWeeklyStrategy(plan.weeklyPlan, today);
      plan.domainResinPolicy = domainResinPolicy;
      plan.resinPolicyV2 = resinPolicyV2;
      plan.executionQueue = compiledQueue.entries.map(({ queueId, category, task, maxClaims, config }) => ({
        queueId, category, executionType: task.executionType,
        targetName: task.bossName ?? task.domainName ?? task.materialName,
        maxClaims, boundedResinType: config.resinPolicy?.boundedResinType ?? null,
      }));
      plan.executionQueueOmitted = compiledQueue.omitted;
      plan.execution = execution;
    }
  }

  log.info('[计算] 已生成 {count} 项实际刷取缺口', plan.displayShortages.length);
  for (const craft of plan.crafting.craftPlan) {
    const name = materials[craft.materialId]?.name ?? craft.materialId;
    const inputs = craft.inputs.map((input) => `${materials[input.id]?.name ?? input.id} ×${input.count * craft.craftCount}`).join('、');
    log.info('[合成] {name} ×{count}（消耗：{inputs}）', name, craft.craftCount, inputs);
  }
  for (const item of plan.displayShortages) {
    const name = item.material?.name ?? item.materialId;
    const owned = item.owned ?? '未确认';
    const shortage = item.shortage ?? '不计算';
    log.info('[材料] {name} | 实际需刷={required} | 当前库存={owned} | 缺口={shortage} | 状态={status} | 原因={reason}',
      name, item.required, owned, shortage, item.status, item.reason ?? '无');
  }
  for (const task of plan.todayQueue) {
    const name = task.materials?.length
      ? task.materials.map((item) => `${item.materialName}×${item.shortage}`).join('、')
      : task.executionType === 'artifactDomain'
        ? `${task.domainName}（圣遗物填充）`
        : materials[task.materialId]?.name ?? task.materialName ?? task.materialId;
    const domainName = task.domainName ?? task.bossName ?? materials[task.materialId]?.domainName;
    log.info('[候选任务] {name} | 类型={type} | 目标={target} | 缺口={shortage} | 状态={status}',
      name, task.executionType, domainName ?? '未配置', task.shortage, task.status);
  }
  log.info('[调度] 今日可执行队列：{queue}', JSON.stringify(plan.todayQueue));
  for (const day of plan.weeklyStrategy) {
    log.info('[周循环] {day}：{tasks}', day.label, day.tasks.map((task) => task.domainName ?? task.materialName).join('、'));
  }
  log.info('[调度] 人工待办：{manual}', JSON.stringify(plan.manualItems));
  const estimate = buildCompletionEstimate({ plan, history, materials, recipes, today, dailyResinBudget: scriptSettings.estimateDailyResin });
  plan.estimate = estimate;
  log.info('[预估] {message}', Number.isFinite(estimate.days)
    ? `约 ${estimate.days} 天；${estimate.reason}`
    : `暂无法估算；${estimate.reason}`);
  await file.writeText('record/latest-plan.json', JSON.stringify(plan, null, 2), false);
  const runRecord = buildRunRecord({
    executionEnabled,
    plan,
    inventoryBefore: inventoryBeforeExecution,
    inventoryAfter: inventory,
    execution: plan.execution,
    domainResinPolicy,
    resinPolicyV2,
  });
  const updatedHistory = appendRunHistory(history, runRecord);
  await file.writeText('record/history.json', JSON.stringify(updatedHistory, null, 2), false);
  log.info('[记录] 已保存本次运行记录；历史保留 {count} 条', updatedHistory.length);
  if (scriptSettings.sendRunSummary === true) {
    failureNotificationState.stage = '发送运行摘要';
    const summary = buildRunSummary(plan, materials, {
      executionEnabled,
      execution: plan.execution,
      estimateDays: estimate.days,
      estimateReason: estimate.reason,
      estimateDetails: estimate.details,
    });
    notification.Send(summary);
    log.info('[通知] 已请求 BetterGI 发送运行摘要；请在 BetterGI 通知设置中启用 JS 通知与邮件通知');
  }
  const routeCount = plan.execution?.routes?.length ?? 0;
  const resinTaskCount = plan.execution?.tasks?.length ?? 0;
  const finalResult = !executionEnabled
    ? '本次未执行培养或刷取任务'
    : plan.execution?.status === 'failed'
      ? `本次执行失败：${plan.execution.reason}`
      : resinTaskCount > 0 && routeCount > 0
        ? `本次已调用 ${resinTaskCount} 个树脂任务并执行 ${routeCount} 组路线任务`
        : resinTaskCount > 0
          ? `本次已调用 ${resinTaskCount} 个树脂任务；实际领奖结果以执行证据为准`
          : routeCount > 0
            ? `本次已执行 ${routeCount} 组路线任务`
            : `本次未执行：${plan.execution?.reason || '没有可执行任务'}`;
  log.info('[完成] 已保存计划记录：record/latest-plan.json；{result}', finalResult);
}

/** 失败通知自身不能覆盖原始异常。 */
function sendFailureSummarySafely(error) {
  const scriptSettings = failureNotificationState.settings;
  if (scriptSettings?.sendRunSummary !== true) return;
  try {
    const summary = buildFailureRunSummary({
      stage: failureNotificationState.stage,
      targets: scriptSettings.targetsText ? [scriptSettings.targetsText] : [],
      reason: error?.message ?? String(error),
    });
    notification.Send(summary);
    log.info('[通知] 已请求 BetterGI 发送失败摘要；原始异常仍会继续抛出');
  } catch (notificationError) {
    log.error('[通知] 发送失败摘要时再次出错：{error}', notificationError?.message ?? String(notificationError));
  }
}

function loadTargets(scriptSettings, rulebook) {
  if (scriptSettings.targetsText?.trim()) {
    const targets = parseTargetText(scriptSettings.targetsText, rulebook);
    log.info('[初始化] 使用设置页目标文本，共解析 {count} 项', targets.length);
    return { targets, inventory: {} };
  }
  const targetFile = scriptSettings.targetFile || 'data/user-targets.json';
  log.info('[初始化] 读取高级目标文件：{path}', targetFile);
  return JSON.parse(file.readTextSync(targetFile));
}

function attachTargetContext(plan, profile, targetSummary) {
  plan.profile = profile;
  plan.targetSummary = targetSummary;
  plan.targetOutcomes = profile?.targetOutcomes ?? [];
}

async function executeResinQueue(entries, settings, partySwitchState, emptyReason = null) {
  if (entries.length === 0) {
    const reason = emptyReason || '今日没有已启用的树脂任务';
    log.info('[执行] {reason}，本次不执行', reason);
    return createRunExecution({
      status: 'skipped', code: 'no_candidate', stage: 'preflight',
      message: reason,
    });
  }
  const executions = await runBoundedResinQueue(entries, async (entry, index) => {
    const target = entry.task.bossName ?? entry.task.domainName ?? entry.task.materialName;
    log.info('[执行队列] 开始第 {index}/{total} 项：{target}', index + 1, entries.length, target);
    let execution;
    try {
      if (entry.task.executionType === 'boss') {
        execution = await executeBossTask(entry, partySwitchState);
      } else if (entry.task.executionType === 'artifactDomain') {
        execution = await executeArtifactDomainTask(entry, partySwitchState);
      } else {
        execution = await executeDomainTask(entry, partySwitchState);
      }
    } catch (error) {
      const failure = classifyExecutionError(error);
      execution = createRunExecution({ task: entry.task, ...failure });
      log.error('[执行队列] “{target}”未完成：{error}', target, execution.reason);
    }
    const stopReason = entry.maxClaims == null && execution.status === 'completed'
      ? '该任务使用“全部”预算，已把剩余可用树脂交给当前任务'
      : execution.status === 'failed' || execution.status === 'unconfirmed' || execution.code === 'no_resin'
        ? `结果为 ${execution.status}/${execution.code}`
        : '';
    if (stopReason) {
      log.warn('[执行队列] “{target}”后停止后续树脂任务：{reason}', target, stopReason);
    }
    return execution;
  });
  return combineRunExecutions(executions);
}

async function executeDomainTask(entry, partySwitchState) {
  const { task, config } = entry;
  const startedAt = new Date().toISOString();
  log.info('[执行] 准备刷取秘境“{domain}”，材料目标：{materials}', config.domainName,
    config.trackedMaterials.map((item) => `${item.materialName}×${item.shortage}`).join('、'));

  if (config.testSingleRun) {
    log.info('[执行] 培养秘境单次测试已开启：仅使用一次原粹树脂领奖，不使用浓缩、须臾或脆弱树脂');
  } else {
    log.info('[执行] 不合成树脂，按已配置顺序领取奖励：{priority}', config.resinPolicy.priority.join(' → '));
  }

  const switched = await switchTaskParty(config.partyName, '秘境', partySwitchState);
  if (!switched) {
    throw withExecutionContext(new Error(`切换秘境队伍失败：${config.partyName}`), {
      code: 'party_switch_failed', stage: 'party', retryable: true, evidence: { task },
      startedAt,
    });
  }

  const param = new AutoDomainParam(0);
  param.DomainName = config.domainName;
  param.PartyName = config.partyName;
  if (config.sundaySelectedValue) param.SundaySelectedValue = config.sundaySelectedValue;
  if (config.strategyName) param.CombatStrategyPath = param.SetCombatStrategyPath(config.strategyName);
  applyDomainResinPolicyToParam(param, config.resinPolicy);
  param.RewardRecognitionEnabled = true;

  let rawRewards;
  try {
    rawRewards = await dispatcher.RunAutoDomainTask(param);
  } catch (error) {
    throw withExecutionContext(error, {
      code: 'external_task_error', stage: 'task', evidence: { task }, startedAt,
    });
  }
  const taskRecognizedRewards = normalizeRewardMap(rawRewards);
  logTaskRecognizedRewards('执行', taskRecognizedRewards);
  log.info('[执行] 秘境“{domain}”任务调用结束；已启用 BetterGI 奖励识别，最终收益仍以全部任务结束后的背包复核为准', config.domainName);
  const rewardConfirmed = Object.keys(taskRecognizedRewards).length > 0;
  return createRunExecution({
    task,
    status: rewardConfirmed ? 'completed' : 'unconfirmed',
    code: rewardConfirmed ? 'task_completed' : 'reward_unconfirmed',
    stage: rewardConfirmed ? 'task' : 'reward',
    severity: rewardConfirmed ? 'info' : 'warning',
    message: rewardConfirmed
      ? `培养秘境“${config.domainName}”任务调用结束`
      : `培养秘境“${config.domainName}”未返回奖励识别结果`,
    rewards: taskRecognizedRewards,
    taskRecognizedRewards,
    evidence: { taskRecognizedRewards, maxClaims: entry.maxClaims, category: entry.category },
    startedAt,
    endedAt: new Date().toISOString(),
  });
}

async function executeArtifactDomainTask(entry, partySwitchState) {
  const { task, config } = entry;
  const startedAt = new Date().toISOString();
  log.info('[圣遗物] 准备刷取“{domain}”，仅作为当天无培养树脂任务时的填充', config.domainName);
  const switched = await switchTaskParty(config.partyName, '圣遗物秘境', partySwitchState);
  if (!switched) {
    throw withExecutionContext(new Error(`切换圣遗物秘境队伍失败：${config.partyName}`), {
      code: 'party_switch_failed', stage: 'party', retryable: true, evidence: { task },
      startedAt,
    });
  }
  const param = new AutoDomainParam(0);
  param.DomainName = config.domainName;
  param.PartyName = config.partyName;
  if (config.strategyName) param.CombatStrategyPath = param.SetCombatStrategyPath(config.strategyName);
  applyDomainResinPolicyToParam(param, config.resinPolicy);
  param.AutoArtifactSalvage = config.autoArtifactSalvage;
  param.MaxArtifactStar = config.maxArtifactStar;
  param.RewardRecognitionEnabled = true;
  let rawRewards;
  try {
    rawRewards = await dispatcher.RunAutoDomainTask(param);
  } catch (error) {
    throw withExecutionContext(error, {
      code: 'external_task_error', stage: 'task', evidence: { task }, startedAt,
    });
  }
  const taskRecognizedRewards = normalizeRewardMap(rawRewards);
  logTaskRecognizedRewards('圣遗物', taskRecognizedRewards);
  log.info('[圣遗物] 任务调用结束；已启用 BetterGI 奖励识别，圣遗物收益不纳入培养材料计数');
  const rewardConfirmed = Object.keys(taskRecognizedRewards).length > 0;
  return createRunExecution({
    task,
    status: rewardConfirmed ? 'completed' : 'unconfirmed',
    code: rewardConfirmed ? 'task_completed_untracked' : 'reward_unconfirmed',
    stage: rewardConfirmed ? 'task' : 'reward',
    severity: rewardConfirmed ? 'info' : 'warning',
    message: rewardConfirmed
      ? `圣遗物秘境“${config.domainName}”任务调用结束`
      : `圣遗物秘境“${config.domainName}”未返回奖励识别结果`,
    rewards: taskRecognizedRewards, taskRecognizedRewards,
    evidence: { taskRecognizedRewards, maxClaims: entry.maxClaims, category: entry.category },
    startedAt, endedAt: new Date().toISOString(),
  });
}

async function executeBossTask(entry, partySwitchState) {
  const { task, config } = entry;
  const startedAt = new Date().toISOString();
  log.info('[Boss] 准备刷取“{boss}”，材料目标：{materials}', config.bossName,
    config.trackedMaterials.map((item) => `${item.materialName}×${item.shortage}`).join('、'));
  const switched = await switchTaskParty(config.partyName, 'Boss', partySwitchState);
  if (!switched) {
    throw withExecutionContext(new Error(`切换 Boss 队伍失败：${config.partyName}`), {
      code: 'party_switch_failed', stage: 'party', retryable: true, evidence: { task },
      startedAt,
    });
  }
  const param = new AutoBossParam();
  param.BossName = config.bossName;
  param.TeamName = config.partyName;
  if (config.strategyName) param.StrategyName = config.strategyName;
  param.SpecifyRunCount = config.specifyRunCount;
  param.RunCount = config.runCount;
  param.UseTransientResin = false;
  param.UseFragileResin = false;
  param.ReviveRetryCount = config.reviveRetryCount;
  param.ReturnToStatueAfterEachRound = false;
  param.RewardRecognitionEnabled = true;
  const cleanupWarnings = [];
  let rawRewards;
  try {
    rawRewards = await runBossTaskWithSafeExit({
      runTask: () => dispatcher.RunAutoBossTask(param),
      teleportToStatue: () => genshin.TpToStatueOfTheSeven(),
      logger: log,
      onCleanupFailure: (error) => cleanupWarnings.push(createExecutionOutcome({
        taskId: task.materialId, taskType: 'boss', targetName: config.bossName,
        status: 'unconfirmed', code: 'cleanup_failed', stage: 'cleanup', severity: 'warning',
        message: error?.message ?? String(error), evidence: { task }, endedAt: new Date().toISOString(),
      })),
    });
  } catch (error) {
    throw withExecutionContext(error, {
      code: 'external_task_error', stage: 'task', evidence: { task }, startedAt,
    });
  }
  const taskRecognizedRewards = normalizeRewardMap(rawRewards);
  logTaskRecognizedRewards('Boss', taskRecognizedRewards);
  log.info('[Boss] 任务调用结束；已启用 BetterGI 奖励识别，最终收益仍以全部任务结束后的背包复核为准');
  const rewardConfirmed = Object.keys(taskRecognizedRewards).length > 0;
  return createRunExecution({
    task,
    status: rewardConfirmed ? 'completed' : 'unconfirmed',
    code: rewardConfirmed ? 'task_completed' : 'reward_unconfirmed',
    stage: rewardConfirmed ? 'task' : 'reward',
    severity: rewardConfirmed ? 'info' : 'warning',
    message: rewardConfirmed
      ? `世界 Boss“${config.bossName}”任务调用结束`
      : `世界 Boss“${config.bossName}”未返回奖励识别结果`,
    rewards: taskRecognizedRewards, taskRecognizedRewards, warnings: cleanupWarnings,
    evidence: { taskRecognizedRewards, maxClaims: entry.maxClaims, category: entry.category },
    startedAt, endedAt: new Date().toISOString(),
  });
}

async function executeRoutesSafely(routes, settings, materials, recipes, partySwitchState) {
  try {
    const routeExecution = await executeMatchedRoutes(routes, settings, materials, recipes, partySwitchState);
    return routeExecution.records;
  } catch (error) {
    const failure = classifyExecutionError(error, { code: 'external_task_error', stage: 'task' });
    const reason = failure.message;
    log.error('[路线执行] 初始化或收尾失败，已停止路线并继续保存报告：{reason}', reason);
    return [{
      ...createExecutionOutcome({
        taskId: 'route:initialization', taskType: 'route', targetName: '路线任务', ...failure,
      }),
      name: '路线任务', type: 'route', reason, paths: [], materials: [], gained: {},
    }];
  }
}

function hasOnlyArtifactTasks(execution) {
  const tasks = execution?.tasks ?? [];
  return tasks.length > 0 && tasks.every((task) => task.taskType === 'artifactDomain');
}

async function executeMatchedRoutes(routes, scriptSettings, materials, recipes, partySwitchState) {
  const routePlan = buildRouteExecutionPlan(routes, scriptSettings, recipes);
  if (routePlan.length > 0) {
    // 调度器原生 Pathing 项目会在执行前自动挂载拾取触发器；
    // JS 调用 pathingScript 时需要显式补齐，否则路线能行走但不会可靠拾取材料。
    dispatcher.AddTrigger(new RealtimeTimer('AutoPick'));
    log.info('[路线执行] 已启用 BetterGI 原生自动拾取');
  }
  let currentParty = '';
  const records = [];
  const unavailablePartyReasons = new Map();
  for (const route of routePlan) {
    if (unavailablePartyReasons.has(route.partyName)) {
      const reason = unavailablePartyReasons.get(route.partyName);
      log.warn('[路线执行] 跳过“{name}”：队伍“{party}”本次已确认不可用', route.name, route.partyName);
      records.push(buildSkippedRouteRecord(route, materials, reason));
      continue;
    }
    const startedAt = new Date().toISOString();
    const routeRecord = { name: route.name, type: route.type, materials: [], paths: [], gained: {}, startedAt };
    try {
      if (currentParty !== route.partyName) {
        const switched = await switchTaskParty(route.partyName, route.type === 'localSpecialty' ? '采集' : '怪物材料', partySwitchState);
        if (!switched) {
          const reason = `切换路线队伍失败：${route.partyName}`;
          unavailablePartyReasons.set(route.partyName, reason);
          throw withExecutionContext(new Error(reason), {
            code: 'party_switch_failed', stage: 'party', retryable: true,
            startedAt,
          });
        }
        currentParty = route.partyName;
        log.info('[路线执行] 已切换{type}队伍：{party}', route.type === 'localSpecialty' ? '采集' : '怪物材料', currentParty);
      }
      for (const routePath of route.paths) {
        log.info('[路线执行] 开始“{name}”：{path}', route.name, routePath);
        try {
          await runSubscribedRouteFile({
            isFile: (path) => pathingScript.IsFile(path),
            runFileFromUser: (path) => pathingScript.RunFileFromUser(path),
          }, routePath);
        } catch (error) {
          throw withExecutionContext(error, { code: 'external_task_error', stage: 'task', startedAt });
        }
        routeRecord.paths.push({ path: routePath });
        log.info('[路线执行] “{name}”路线文件执行完成；收益将在全部任务结束后统一复核', route.name);
      }
    } catch (error) {
      const failure = classifyExecutionError(error, { code: 'external_task_error', stage: 'task' });
      Object.assign(routeRecord, createExecutionOutcome({
        taskId: `route:${route.type}:${route.name}`,
        taskType: 'route',
        targetName: route.name,
        ...failure,
        endedAt: new Date().toISOString(),
      }));
      routeRecord.reason = failure.message;
      log.error('[路线执行] “{name}”执行失败：{reason}', route.name, routeRecord.reason);
    }
    routeRecord.materials = route.scanMaterialIds.map((materialId) => ({
      materialId,
      name: materials[materialId]?.name ?? materialId,
      shortage: route.materials.find((item) => item.materialId === materialId)?.shortage ?? 0,
      gained: 0,
    }));
    routeRecord.gained = Object.fromEntries(routeRecord.materials.map((item) => [item.name, item.gained]));
    if (routeRecord.status !== 'failed') {
      Object.assign(routeRecord, createExecutionOutcome({
        taskId: `route:${route.type}:${route.name}`,
        taskType: 'route',
        targetName: route.name,
        status: 'unconfirmed',
        code: 'reward_unconfirmed',
        stage: 'reward',
        severity: 'warning',
        message: '等待全部任务结束后的统一背包复核',
        evidence: { paths: routeRecord.paths.map((item) => item.path) },
        startedAt,
      }));
      routeRecord.reason = '等待全部任务结束后的统一背包复核';
    }
    records.push(routeRecord);
  }
  return { records };
}

function buildSkippedRouteRecord(route, materials, reason) {
  const routeMaterials = route.scanMaterialIds.map((materialId) => ({
    materialId,
    name: materials[materialId]?.name ?? materialId,
    shortage: route.materials.find((item) => item.materialId === materialId)?.shortage ?? 0,
    gained: 0,
  }));
  return {
    ...createExecutionOutcome({
      taskId: `route:${route.type}:${route.name}`,
      taskType: 'route',
      targetName: route.name,
      status: 'failed',
      code: 'party_switch_failed',
      stage: 'party',
      severity: 'fatal',
      retryable: true,
      message: reason,
      endedAt: new Date().toISOString(),
    }),
    name: route.name,
    type: route.type,
    reason,
    paths: [],
    materials: routeMaterials,
    gained: Object.fromEntries(routeMaterials.map((item) => [item.name, 0])),
  };
}

async function switchTaskParty(partyName, taskLabel, partySwitchState) {
  return switchPartyWithRecovery({
    partyName,
    taskLabel,
    state: partySwitchState,
    switchParty: (name) => genshin.SwitchParty(name),
    teleportToStatue: () => genshin.TpToStatueOfTheSeven(),
    logger: log,
  });
}

async function scanInventoryMaterials(plan, inventory, materials, phase) {
  return scanInventoryItemIds(plan.crafting.scanMaterialIds, inventory, materials, phase);
}

function logTaskRecognizedRewards(scope, rewards) {
  if (Object.keys(rewards).length > 0) {
    log.info('[{scope}] BetterGI 累计奖励识别结果：{rewards}', scope, JSON.stringify(rewards));
  } else {
    log.warn('[{scope}] BetterGI 奖励识别结果为空；可能未领奖或奖励识别失败', scope);
  }
}

async function scanInventoryItemIds(materialIds, inventory, materials, phase, options = {}) {
  const scanGroups = buildInventoryScanGroups(materialIds, materials);
  const scanCount = Object.values(scanGroups).reduce((total, items) => total + items.length, 0);
  let updatedInventory = inventory;
  const issueNames = new Set();
  const notFoundNames = new Set();
  log.info('[背包] {phase}读取 {count} 个本次目标材料及可合成低阶材料', phase, scanCount);
  for (const [tabName, scanItems] of Object.entries(scanGroups)) {
    const param = new CountInventoryItemParam();
    param.IconRecognitionMode = ItemIconRecognitionMode.Item;
    param.GridScreenName = tabName === 'CharacterDevelopmentItems'
      ? GridScreenName.CharacterDevelopmentItems
      : GridScreenName.Materials;
    for (const item of scanItems) param.ItemNames.Add(item.name);
    try {
      log.info('[背包] {phase}读取“{tab}”页：{names}', phase, tabName, scanItems.map((item) => item.name).join('、'));
      const counts = await dispatcher.RunCountInventoryItemTask(param);
      const applied = applyInventoryScanResult(updatedInventory, scanItems, counts, options);
      updatedInventory = applied.inventory;
      for (const name of applied.notFoundNames) notFoundNames.add(name);
      if (applied.failedNames.length > 0) {
        for (const name of applied.failedNames) issueNames.add(name);
        log.warn('[背包] {phase}以下材料的数量 OCR 失败，将不用于收益统计：{names}。请确认 BetterGI 已切换到 OCR V6 后重试',
          phase, applied.failedNames.join('、'));
      }
      if (applied.unrecognizedNames.length > 0) {
        for (const name of applied.unrecognizedNames) issueNames.add(name);
        log.warn('[背包] {phase}的 ItemV2 图标模型未匹配到以下材料，已保留执行前数量且不会据此判断为零收益：{names}',
          phase, applied.unrecognizedNames.join('、'));
      }
      if (applied.decreasedNames.length > 0) {
        for (const name of applied.decreasedNames) issueNames.add(name);
        log.warn('[背包] {phase}以下材料返回值低于执行前；本脚本不会消耗培养材料，已保留原库存：{names}',
          phase, applied.decreasedNames.join('、'));
      }
    } catch (error) {
      for (const item of scanItems) issueNames.add(item.name);
      log.error('[背包] {phase}读取“{tab}”页失败，相关材料将保留原值：{error}。请检查背包界面、BetterGI 版本；若是数量文字异常，再确认 OCR V6',
        phase, tabName, error.message ?? String(error));
    }
  }
  return { inventory: updatedInventory, issueNames: [...issueNames], notFoundNames: [...notFoundNames] };
}

try {
  await main();
} catch (error) {
  sendFailureSummarySafely(error);
  throw error;
}
