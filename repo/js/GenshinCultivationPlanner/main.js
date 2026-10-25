import { createPlan } from './core/planner.js';
import { validateCalculationTargets } from './core/requirements.js';
import { applyInventoryScanResult, buildInventoryScanGroups, normalizeInventoryCountMap } from './core/inventory.js';
import { applyMatchedRouteSupport, discoverAutoPathingRoutes } from './core/routes.js';
import {
  buildFailureRunSummary,
  buildNotificationMessages,
  buildRunSummary,
  formatInventoryGainIssues,
  sendNotificationPages,
  shouldSendRunNotifications,
} from './core/report.js';
import { collectExecutionWarningOutcomes } from './core/preflight.js';
import { applyDomainResinPolicyToParam, buildDomainResinPolicy } from './core/resin.js';
import { compileResinPolicyV2, formatResinPolicyPreview } from './core/resin-policy-v2.js';
import { buildResinQueueRecord, compileResinExecutionQueue, formatResinExecutionLimit, runBoundedResinQueue } from './core/resin-queue.js';
import { normalizeRewardMap } from './core/rewards.js';
import { applyRunRewardEvidence } from './core/task-evidence.js';
import { applyBossCompatibility } from './core/boss-compatibility.js';
import { runBossTaskWithSafeExit } from './core/boss-safety.js';
import { buildWeeklyStrategy } from './core/scheduler.js';
import { appendRunHistory, buildRunRecord, findHistoricalInventoryConflicts } from './core/history.js';
import { parseTargetText } from './core/target-input.js';
import { resolvePlanningWeekday } from './core/server-weekday.js';
import { buildCompletionEstimate } from './core/estimate.js';
import { applyFinalRouteInventoryGains, buildRouteExecutionPlan, runSubscribedRouteFile } from './core/route-executor.js';
import { appendArtifactFallbackTask, shouldReadRoleArtifactFallback } from './core/artifact-executor.js';
import { buildRoleArtifactSummary, buildRoleArtifactTask, resolveArtifactGuideRecommendation } from './core/artifact-recommendation.js';
import { switchPartyWithRecovery } from './core/party-switch.js';
import {
  assertExecutionConfirmed,
  normalizeScriptSettings,
  normalizeRoleArtifactSettings,
  resolveRunPurpose,
  validateBossOverrideNames,
} from './core/settings.js';
import { readTrainingGuideArtifactSample } from './guide-reader/index.js';
import { classifyResolvedTargetState } from './core/target-state.js';
import { assertRuntimeCapabilities } from './core/capabilities.js';
import {
  createExecutionOutcome,
  createRunExecution,
  combineRunExecutions,
} from './core/execution-outcome.js';
import { canContinueRoutesAfterResin, classifyBossTaskError, classifyExecutionError, isCancellationError, isUnsupportedNativeTask, withExecutionContext } from './core/error-classifier.js';
import {
  buildAutomaticProfileTargets,
  buildTargetSummary,
  isAutomaticProfileMode,
  isUnownedProfileError,
  prepareAutomaticProfileRequest,
  readCharacterProfile,
} from './core/character-profile.js';

const failureNotificationState = { enabled: false, settings: null, stage: '初始化', targets: [] };

async function main() {
  if (resolveRunPurpose(settings) === '仅刷角色圣遗物') {
    await runRoleArtifactFarming();
    return;
  }
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
  failureNotificationState.enabled = shouldSendRunNotifications(scriptSettings);
  checkRuntimeCapabilities(scriptSettings);
  failureNotificationState.targets = [scriptSettings.selectedCharacter, scriptSettings.selectedWeapon]
    .filter((name) => name && !/^不选择/.test(name));
  log.info('[模式] 已确认配置，进入实际执行模式');

  failureNotificationState.stage = '读取培养目标';
  let materials = JSON.parse(file.readTextSync('data/materials.json'));
  const recipes = JSON.parse(file.readTextSync('data/crafting-recipes.json'));
  const rulebook = JSON.parse(file.readTextSync('data/rulebook.json'));
  const observedPath = 'record/prefarm-observed.json';
  let observedCharacters = null;
  const bossCatalog = JSON.parse(file.readTextSync('data/bettergi-boss-catalog.json'));
  const bettergiVersion = typeof getVersion === 'undefined' ? '' : String(getVersion());
  let history = [];
  try {
    history = JSON.parse(file.readTextSync('record/history.json'));
  } catch {
    // 首次运行没有历史文件属于正常情况。
  }
  validateBossOverrideNames(scriptSettings, bossCatalog, materials);
  let targetData;
  let profileRecord = null;
  const guideRecord = null;
  if (isAutomaticProfileMode(scriptSettings)) {
    try {
      const request = prepareAutomaticProfileRequest(scriptSettings, rulebook);
      if (request.requiresProfile) observedCharacters = loadObservedCharacters(observedPath);
      const service = typeof characterDevelopmentTask === 'undefined' ? null : characterDevelopmentTask;
      let profile = null;
      let profileError = null;
      let initialProgress = false;
      if (request.requiresProfile) {
        try {
          profile = await readCharacterProfile(service, request);
        } catch (error) {
          if (scriptSettings.allowUnowned === true && observedCharacters[request.characterName] !== true
            && isUnownedProfileError(error, request.characterName)) {
            initialProgress = true;
            log.warn('[预刷] 角色“{name}”档案未确认，按 1/20、天赋 1/1/1 计算；以后每次仍会尝试读取真实档案', request.characterName);
          } else {
            if (request.cultivationMode !== '培养角色和指定武器') throw error;
            profileError = error;
            log.warn('[自动档案] 角色档案读取失败；本次仍继续处理独立的指定武器目标：{message}', error?.message ?? String(error));
          }
        }
      }
      if (profile && observedCharacters && observedCharacters[profile.characterName] !== true) {
        observedCharacters[profile.characterName] = true;
        await persistObservedCharacters(observedPath, observedCharacters);
      }
      const generated = buildAutomaticProfileTargets(profile, scriptSettings, rulebook, request, profileError, initialProgress);
      failureNotificationState.targets = generated.summary;
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
        ...(initialProgress ? { progressSource: 'initial-prefarm' } : {}),
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
  let targetSummary = profileRecord?.targetSummary ?? buildTargetSummary(targetData.targets ?? []);
  let targetOutcomes = profileRecord?.targetOutcomes ?? [];
  failureNotificationState.stage = '校验培养材料';
  failureNotificationState.targets = targetSummary;
  const calculation = validateCalculationTargets(targetData.targets ?? [], rulebook);
  if (calculation.failures.length > 0) {
    targetData = { ...targetData, targets: calculation.targets };
    targetOutcomes = targetOutcomes.filter((outcome) => outcome.status !== 'pending'
      || !calculation.failures.some((failure) => failure.kind === outcome.kind && failure.name === outcome.name));
    targetOutcomes.push(...calculation.failures);
    targetSummary = targetSummary.map((line) => calculation.failures.some((failure) =>
      line.startsWith(`${failure.kind === 'weapon' ? '武器' : '角色'} ${failure.name}：`)
      || line.startsWith(`指定武器 ${failure.name}：`)) ? line.replace(/：.*$/, '：材料计算失败') : line);
    if (profileRecord) {
      Object.assign(profileRecord, { targets: calculation.targets, targetOutcomes, targetSummary });
      await file.writeText('record/latest-profile.json', JSON.stringify(profileRecord, null, 2), false);
    }
    for (const failure of calculation.failures) {
      log.warn('[目标] “{name}”材料计算失败，跳过该目标并继续其他有效目标：{message}', failure.name, failure.message);
    }
    if (calculation.targets.length === 0) {
      throw new Error(`没有可继续处理的培养目标：${calculation.failures.map((item) => `${item.name}：${item.message}`).join('；')}`);
    }
  }
  const sourceCandidates = JSON.parse(file.readTextSync('data/source-candidates.json'));
  const routeOverrides = JSON.parse(file.readTextSync('data/route-overrides.json'));
  const today = resolvePlanningWeekday({
    automatic: scriptSettings.useServerWeekday !== false,
    manualWeekday: scriptSettings.weekday,
    nowMs: Date.now(),
    serverOffsetMs: ServerTime.GetServerTimeZoneOffset(),
  });
  materials = applyBossCompatibility(materials, bossCatalog, bettergiVersion);
  log.info('[初始化] 目标数量：{count}；计划日：{day}（{source}）', (targetData.targets ?? []).length, today,
    scriptSettings.useServerWeekday !== false ? '服务器时间 04:00 刷新规则' : '手动指定');
  for (const target of targetData.targets ?? []) {
    log.info('[目标] {kind}：{name}', target.kind, target.name);
  }
  const resolvedTargetState = classifyResolvedTargetState({
    targets: targetData.targets,
    profileRecord,
    guideRecord,
    targetOutcomes,
  });
  const { allSatisfied: allTargetsSatisfied, suppressExecution } = resolvedTargetState;
  if (allTargetsSatisfied) {
    log.info('[目标] 所选培养目标均已达到，不执行培养任务；主动启用的角色圣遗物填充仍可执行');
  } else if (resolvedTargetState.incomplete) {
    log.warn('[目标] 没有可安全执行的培养目标，且部分目标解析失败；本次不读取背包、不检查路线且不执行兜底任务');
  }

  let inventory = targetData.inventory ?? {};
  let inventoryBeforeIssueNames = [];
  let inventoryBeforeNotFoundNames = [];
  let historicalInventoryConflicts = [];
  const runWarnings = targetOutcomes.filter((outcome) => outcome.status === 'failed')
    .map((outcome) => createExecutionOutcome({
      taskId: `target:${outcome.kind}:${outcome.name}:${outcome.component}`, taskType: 'target', targetName: outcome.name,
      status: 'skipped', code: 'target_invalid', stage: 'profile', severity: 'warning',
      message: outcome.message,
    }));
  let plan = createPlan({
    levelFirst: scriptSettings.resinPolicyV2.mode !== 'custom',
    targets: targetData.targets ?? [],
    inventory,
    materials,
    recipes,
    rulebook,
    today,
  });
  attachTargetContext(plan, profileRecord, targetSummary, guideRecord, targetOutcomes);

  // 兼容 BetterGI 已保存的旧设置：字段不存在时也默认开启读取。
  if (!suppressExecution && scriptSettings.scanInventory !== false) {
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
      for (const conflict of historicalInventoryConflicts) {
        const message = `执行前未找到“${conflict.name}”，历史最近确认库存为 ${conflict.lastCount}；本次按 0 继续刷取，可能重复获取`;
        log.warn('[背包] {message}', message);
        runWarnings.push(createExecutionOutcome({
          taskId: `inventory:history-conflict:${conflict.materialId}`,
          taskType: 'inventory',
          targetName: conflict.name,
          status: 'unconfirmed', code: 'inventory_history_conflict', stage: 'inventory', severity: 'warning',
          message,
          evidence: { ...conflict, assumedCount: 0, continuedExecution: true },
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
      levelFirst: scriptSettings.resinPolicyV2.mode !== 'custom',
      targets: targetData.targets ?? [],
      inventory,
      materials,
      recipes,
      rulebook,
      today,
    });
    attachTargetContext(plan, profileRecord, targetSummary, guideRecord, targetOutcomes);
    plan.inventoryUncertainties = historicalInventoryConflicts;
  } else if (!suppressExecution) {
    log.info('[背包] 已关闭自动读取，库存仅使用目标文件中的 inventory 字段');
  }

  plan.domainOpenings = [];
  if (suppressExecution) {
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
  let resinPolicyV2 = scriptSettings.resinPolicyV2;
  let roleArtifactFill = null;
  if (scriptSettings.roleArtifactFillEnabled === true) {
    // 主动选用角色填充时，不静默回退到旧的手动秘境；旧配置仍保留在用户设置中。
    scriptSettings.artifactDomainEnabled = false;
    if (shouldReadRoleArtifactFallback(plan, scriptSettings, resolvedTargetState)) {
      failureNotificationState.stage = '读取角色圣遗物填充推荐';
      try {
        const prepared = await prepareRoleArtifactEntry({ ...scriptSettings, roleArtifactRunMode: '按树脂规则' });
        Object.assign(scriptSettings, { artifactDomainEnabled: true, artifactTestSingleRun: false,
          artifactDomainName: prepared.task.domainName });
        plan.todayQueue.push(prepared.task);
        roleArtifactFill = { status: 'ready', recommendation: prepared.recommendation,
          domainName: prepared.task.domainName };
        log.info('[圣遗物填充] {character}：{set} → {domain}；本次没有可执行培养树脂任务',
          prepared.recommendation.characterName, prepared.recommendation.setName, prepared.task.domainName);
      } catch (error) {
        // 读不清但已安全返回时只跳过填充；取消或退场状态未知则不继续操作游戏。
        if (isCancellationError(error) || error.code === 'cleanup_failed') throw error;
        const reason = error.message ?? String(error);
        roleArtifactFill = { status: 'skipped', characterName: scriptSettings.selectedCharacter, reason };
        runWarnings.push(createExecutionOutcome({ taskType: 'artifactDomain', targetName: '角色圣遗物填充',
          status: 'skipped', code: 'artifact_recommendation_unavailable', stage: 'preflight', severity: 'warning',
          message: `已跳过角色圣遗物填充：${reason}` }));
        log.warn('[圣遗物填充] 已跳过，培养与路线不受影响：{reason}', reason);
      }
    } else {
      roleArtifactFill = { status: 'deferred', reason: resolvedTargetState.incomplete
        ? '培养目标未可靠解析，不执行兜底任务' : '已有可执行培养树脂任务，材料优先' };
    }
    resinPolicyV2 = compileResinPolicyV2(scriptSettings);
    scriptSettings.resinPolicyV2 = resinPolicyV2;
  } else if (!suppressExecution) {
    appendArtifactFallbackTask(plan, scriptSettings, resinPolicyV2);
  }
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
  plan.executionQueue = compiledQueue.entries.map(buildResinQueueRecord);
  plan.executionQueueOmitted = compiledQueue.omitted;
  const executionWarnings = collectExecutionWarningOutcomes(plan, scriptSettings);
  runWarnings.push(...executionWarnings);
  for (const warning of executionWarnings) {
    log.warn('[执行前检查] {warning}', warning.message);
  }
  const resinPolicyPreview = formatResinPolicyPreview(resinPolicyV2);
  plan.weeklyStrategy = buildWeeklyStrategy(plan.weeklyPlan, today);
  const discoveredRoutes = plan.routes;
  log.info('[树脂] 默认授权模板（每项实际配置见执行队列）：指定使用={specified}；顺序={priority}；原粹/浓缩/须臾/脆弱上限={original}/{condensed}/{transient}/{fragile}',
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
    log.info('[执行队列] {index}. {type}“{target}”：{limit}',
      index + 1, entry.category, target, formatResinExecutionLimit(entry));
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
      status: 'skipped',
      code: allTargetsSatisfied ? 'targets_satisfied'
        : resolvedTargetState.incomplete ? 'target_resolution_incomplete' : 'no_candidate',
      stage: 'preflight',
      message: allTargetsSatisfied ? '培养目标已全部完成'
        : resolvedTargetState.incomplete ? '没有可安全执行的培养目标，且部分目标解析失败' : '今日没有已启用的树脂任务',
    });
    let routeRecords = [];
    if (!suppressExecution && resinPolicyV2.routeTiming === 'beforeResin' && scriptSettings.routeExecutionEnabled === true) {
      routeRecords = await executeRoutesSafely(discoveredRoutes, scriptSettings, materials, recipes, partySwitchState);
      if (routeRecords.some((route) => route.status === 'failed')) {
        execution = createRunExecution({
          status: 'failed', code: 'route_prerequisite_failed', stage: 'task',
          message: '树脂任务前的路线执行失败，已停止后续自动任务',
        });
      }
    }
    if (execution.status !== 'failed' && (!suppressExecution || compiledQueue.entries.length > 0)) {
      execution = await executeResinQueue(compiledQueue.entries, scriptSettings, partySwitchState);
    }
    execution.warnings = [...runWarnings, ...(execution.warnings ?? [])];
    plan.execution = execution;
    if (!suppressExecution && resinPolicyV2.routeTiming === 'afterResin'
      && canContinueRoutesAfterResin(execution)
      && scriptSettings.routeExecutionEnabled === true) {
      routeRecords = await executeRoutesSafely(discoveredRoutes, scriptSettings, materials, recipes, partySwitchState);
    } else if (!suppressExecution && resinPolicyV2.routeTiming === 'afterResin'
      && scriptSettings.routeExecutionEnabled === true && !canContinueRoutesAfterResin(execution)) {
      const reason = '前序任务未安全恢复或异常无法可靠分类，后续路线未执行';
      execution.warnings.push(createExecutionOutcome({
        taskId: 'routes:blocked', taskType: 'route', targetName: '后续路线',
        status: 'skipped', code: 'routes_blocked', stage: 'cleanup', severity: 'warning', message: reason,
      }));
      log.warn('[路线执行] {reason}', reason);
    }
    execution.routes = routeRecords;
    execution.inventoryBeforeNotFoundNames = inventoryBeforeNotFoundNames;

    const hasExecutionAttempt = execution.status !== 'skipped'
      || (execution.tasks?.length ?? 0) > 0
      || (execution.routes?.length ?? 0) > 0;
    const safeToReadInventory = canContinueRoutesAfterResin(execution);
    if (hasExecutionAttempt && safeToReadInventory && scriptSettings.scanInventory !== false && trackedMaterialIds.length > 0) {
      const finalInventoryScan = await scanInventoryItemIds(
        trackedMaterialIds,
        inventory,
        materials,
        '全部任务结束后',
        { preserveDecreases: true, notFoundAsUnknown: true },
      );
      inventory = applyRunRewardEvidence(execution, {
        inventoryBefore: inventoryBeforeExecution,
        inventoryAfter: finalInventoryScan.inventory,
        trackedMaterialIds,
        materials,
        recipes,
        inventoryBeforeIssueNames,
        inventoryAfterIssueNames: finalInventoryScan.issueNames,
        inventoryAfterDecreasedNames: finalInventoryScan.decreasedNames,
      });
      execution.inventoryAfterNotFoundNames = finalInventoryScan.notFoundNames;
      if (finalInventoryScan.issueNames.length > 0) {
        execution.warnings.push(createExecutionOutcome({
          taskId: 'inventory:after', taskType: 'inventory', targetName: '结束背包复核',
          status: 'unconfirmed', code: 'inventory_scan_failed', stage: 'inventory', severity: 'warning',
          message: `结束库存未确认：${finalInventoryScan.issueNames.join('、')}`,
          evidence: { phase: 'after', issueNames: finalInventoryScan.issueNames },
          endedAt: new Date().toISOString(),
        }));
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
          log.warn('[路线执行] “{name}”：{reason}', route.name, route.reason);
        }
      }
      if (taskFallbackNames.length > 0) {
        log.info('[执行] 部分材料的背包差值不可信，已使用 BetterGI 任务奖励确认收益：{rewards}',
          JSON.stringify(Object.fromEntries(taskFallbackNames.map((name) => [name, execution.trackedRewards[name]]))));
      } else if (execution.appliedGains) {
        log.info('[执行] 已按整次运行的背包前后差值确认目标材料收益：{rewards}', JSON.stringify(execution.trackedRewards));
      } else if (hasOnlyArtifactTasks(execution) && !(execution.routes?.length > 0)) {
        log.info('[执行] 圣遗物填充不按目标培养材料的背包差值统计收益');
      } else if (execution.inventoryRecognitionFailed) {
        log.warn('[执行] 本次刷取相关材料的前后数量无法确认：{names}；不将未知数量当作零收益',
          execution.inventoryUnrecognizedNames.join('、'));
      } else if (execution.routes?.length > 0) {
        log.warn('[执行] 全部任务结束后未确认获得目标材料');
      } else {
        log.warn('[执行] 任务未确认获得目标材料；具体失败或跳过原因请查看单项结果');
      }
      for (const notice of formatInventoryGainIssues(execution)) {
        log.warn('[收益识别] {notice}', notice);
      }
    } else if (hasExecutionAttempt && !safeToReadInventory) {
      // 不安全时禁止继续操作游戏；原生任务已返回的奖励仍可离线计入。
      const fallbackInventory = applyRunRewardEvidence(execution, {
        materials, recipes, trackedMaterialIds, inventoryBefore: inventoryBeforeExecution, inventoryAfter: inventory,
        inventoryBeforeIssueNames,
        inventoryAfterIssueNames: trackedMaterialIds.map((id) => materials[id]?.name ?? id),
      });
      inventory = fallbackInventory;
      execution.inventoryChecked = false;
      execution.warnings.push(createExecutionOutcome({
        taskId: 'inventory:blocked', taskType: 'inventory', targetName: '结束背包复核',
        status: 'skipped', code: 'inventory_read_blocked', stage: 'cleanup', severity: 'warning',
        message: '前序任务未安全恢复，未打开背包；仅保留已有任务奖励证据',
      }));
    }

    if (hasExecutionAttempt) {
      materials = applyBossCompatibility(materials, bossCatalog, bettergiVersion,
        execution.tasks.filter((task) => task.taskType === 'boss' && task.code === 'native_unsupported')
          .map((task) => task.targetName));
      plan = createPlan({
        levelFirst: scriptSettings.resinPolicyV2.mode !== 'custom',
        targets: targetData.targets ?? [],
        inventory,
        materials,
        recipes,
        rulebook,
        today,
      });
      attachTargetContext(plan, profileRecord, targetSummary, guideRecord, targetOutcomes);
      plan.routes = discoveredRoutes;
      applyMatchedRouteSupport(plan, discoveredRoutes);
      plan.weeklyStrategy = buildWeeklyStrategy(plan.weeklyPlan, today);
      plan.domainResinPolicy = domainResinPolicy;
      plan.resinPolicyV2 = resinPolicyV2;
      plan.executionQueue = compiledQueue.entries.map(buildResinQueueRecord);
      plan.executionQueueOmitted = compiledQueue.omitted;
      plan.execution = execution;
    }
  }

  if (roleArtifactFill?.status === 'ready') {
    const outcome = plan.execution?.tasks?.find(task => task.taskType === 'artifactDomain'
      && task.targetName === roleArtifactFill.domainName);
    roleArtifactFill.status = outcome?.status ?? 'skipped';
    roleArtifactFill.reason = outcome?.message ?? '前序任务未完成，填充未执行';
  }
  if (roleArtifactFill) plan.roleArtifactFill = roleArtifactFill;
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
  const estimateHistory = plan.execution?.routes?.length > 0
    ? [...history, {
      timestamp: new Date().toISOString(),
      execution: plan.execution,
      inventoryBefore: inventoryBeforeExecution,
      inventoryAfter: inventory,
    }]
    : history;
  const estimate = buildCompletionEstimate({ plan, history: estimateHistory, materials, recipes, today,
    dailyResinBudget: scriptSettings.estimateDailyResin,
    routeExecutionEnabled: scriptSettings.routeExecutionEnabled === true,
    gatheringRouteExecutionEnabled: scriptSettings.gatheringRouteExecutionEnabled,
    monsterRouteExecutionEnabled: scriptSettings.monsterRouteExecutionEnabled });
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
  if (failureNotificationState.enabled) {
    failureNotificationState.stage = '发送运行摘要';
    await sendNotificationSafely(() => buildRunSummary(plan, materials, {
      executionEnabled,
      execution: plan.execution,
      estimateDays: estimate.days,
      estimateReason: estimate.reason,
      estimateDetails: estimate.details,
      recipes,
    }), '运行摘要');
  }
}

/** 独立刷取入口：先确认推荐与执行配置，再复用现有原生秘境执行链路。 */
async function runRoleArtifactFarming() {
  assertExecutionConfirmed(settings);
  failureNotificationState.settings = settings;
  failureNotificationState.enabled = settings.sendRunSummary === true;
  failureNotificationState.stage = '角色圣遗物配置校验';
  failureNotificationState.targets = [settings.selectedCharacter].filter(Boolean);
  checkRuntimeCapabilities(settings, true);
  const { recommendation, task, compiled, scriptSettings } = await prepareRoleArtifactEntry(settings);
  const startedAt = new Date().toISOString();
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const reportPath = `record/artifact-runs/${runId}.json`;
  const record = { schemaVersion: 1, startedAt, runPurpose: '仅刷角色圣遗物',
    recommendation, task, reportPath, execution: null, targetVerified: true,
    recommendationVerified: recommendation.source === '提升指南第一项推荐',
    resinPolicy: compiled.entries[0].config.resinPolicy, maxClaims: compiled.entries[0].maxClaims,
    maxResin: compiled.entries[0].maxResin, resinBudget: compiled.entries[0].resinBudget };
  file.CreateDirectory('record/artifact-runs');
  await file.writeText(reportPath, JSON.stringify(record, null, 2), false);
  log.info('[角色圣遗物] 角色：{character}；套装：{set}；秘境：{domain}；来源：{source}',
    recommendation.characterName, recommendation.setName, task.domainName, recommendation.source);
  log.info('[角色圣遗物] {limit}', formatResinExecutionLimit(compiled.entries[0]));
  failureNotificationState.stage = '执行角色圣遗物秘境';
  record.execution = await executeResinQueue(compiled.entries, scriptSettings, { initialized: false });
  record.endedAt = new Date().toISOString();
  await file.writeText(reportPath, JSON.stringify(record, null, 2), false);
  await file.writeText('record/latest-artifact-run.json', JSON.stringify(record, null, 2), false);
  if ((record.execution.tasks ?? []).some(outcome => outcome.code === 'cancelled')) {
    throw Object.assign(new Error('角色圣遗物刷取已取消'), { code: 'cancelled' });
  }
  log.info('[角色圣遗物] 本次结束：{status}；记录：{path}', record.execution.status, reportPath);
  if (failureNotificationState.enabled) {
    await sendNotificationSafely(() => buildRoleArtifactSummary(record), '圣遗物结束摘要');
  }
}

/** ClearScript宿主类型不保证typeof为function，仅检查类型和实际方法是否存在。 */
function checkRuntimeCapabilities(scriptSettings, artifactOnly = false) {
  const required = {};
  const preview = isAutomaticProfileMode(scriptSettings) && scriptSettings.targetInputMode === '自动档案仅预览';
  if (!artifactOnly && !preview && scriptSettings.scanInventory !== false) {
    required.CountInventoryItemParam = typeof CountInventoryItemParam !== 'undefined';
    required['ItemIconRecognitionMode.Item'] = typeof ItemIconRecognitionMode !== 'undefined' && ItemIconRecognitionMode.Item != null;
    required.GridScreenName = typeof GridScreenName !== 'undefined';
    required['dispatcher.RunCountInventoryItemTask'] = typeof dispatcher !== 'undefined' && typeof dispatcher.RunCountInventoryItemTask === 'function';
  }
  if (artifactOnly || !preview && (scriptSettings.domainExecutionEnabled !== false || scriptSettings.artifactDomainEnabled === true || scriptSettings.roleArtifactFillEnabled === true)) {
    required.AutoDomainParam = typeof AutoDomainParam !== 'undefined';
    required['dispatcher.RunAutoDomainTask'] = typeof dispatcher !== 'undefined' && typeof dispatcher.RunAutoDomainTask === 'function';
  }
  if (!artifactOnly && !preview && scriptSettings.bossExecutionEnabled === true) {
    required.AutoBossParam = typeof AutoBossParam !== 'undefined';
    required['dispatcher.RunAutoBossTask'] = typeof dispatcher !== 'undefined' && typeof dispatcher.RunAutoBossTask === 'function';
  }
  if (!artifactOnly && !preview && scriptSettings.discoverRoutes !== false) {
    for (const method of ['ReadPathSync', 'IsFolder', 'IsFile']) {
      required[`pathingScript.${method}`] = typeof pathingScript !== 'undefined' && typeof pathingScript[method] === 'function';
    }
  }
  assertRuntimeCapabilities({ version: typeof getVersion === 'undefined' ? '' : getVersion(), required });
}

/** 独立用途和正常培养共用推荐校验及参数编译，不复用任何旧缓存。 */
async function prepareRoleArtifactEntry(rawSettings) {
  const scriptSettings = normalizeRoleArtifactSettings(rawSettings);
  const identities = JSON.parse(file.readTextSync('guide-reader/data/guide-identities.json'));
  if (!Object.hasOwn(identities.characters, scriptSettings.selectedCharacter)) {
    throw new Error('请从角色下拉列表选择有效角色');
  }
  const catalog = JSON.parse(file.readTextSync('data/artifact-set-domains.json'));
  const nativeCatalog = JSON.parse(file.readTextSync('data/bettergi-artifact-domain-catalog.json'));
  const policy = compileResinPolicyV2(scriptSettings);
  const domainResinPolicy = buildDomainResinPolicy(scriptSettings);
  // 使用临时任务只编译队伍/树脂，尚不操作游戏；推荐未知时不能调用任务。
  compileResinExecutionQueue({ plan: { todayQueue: [{ executionType: 'artifactDomain',
    domainName: '待匹配', status: 'supported' }] }, settings: scriptSettings, policy, domainResinPolicy });
  let recommendation;
  if (scriptSettings.roleArtifactSource === '手动指定套装') {
    recommendation = { characterName: scriptSettings.selectedCharacter, setName: scriptSettings.roleArtifactSet,
      source: '手动指定套装', pieces: 4 };
  } else {
    let report;
    try {
      report = await readTrainingGuideArtifactSample(scriptSettings.selectedCharacter);
    } catch (error) {
      if (isCancellationError(error)) throw error;
      throw withExecutionContext(error, { code: 'cleanup_failed', stage: 'cleanup' });
    }
    if (report.cleanup?.status !== 'succeeded') {
      throw withExecutionContext(new Error(report.error?.message ?? '推荐读取未能确认安全返回'),
        { code: 'cleanup_failed', stage: 'cleanup' });
    }
    recommendation = resolveArtifactGuideRecommendation(report, scriptSettings.selectedCharacter, catalog);
  }
  const task = buildRoleArtifactTask(recommendation, catalog, nativeCatalog);
  const compiled = compileResinExecutionQueue({ plan: { todayQueue: [task] },
    settings: scriptSettings, policy, domainResinPolicy });
  if (compiled.entries.length !== 1) throw new Error('角色圣遗物任务未进入执行队列，已停止');
  return { recommendation, task, compiled, scriptSettings };
}

/** 通知失败不能中断培养流程。 */
async function sendNotificationSafely(buildMessage, label) {
  if (!failureNotificationState.enabled) return;
  try {
    const messages = buildNotificationMessages(buildMessage(), {
      label: label === '运行摘要' ? '结束摘要' : label,
    });
    if (messages.length > 1) log.info('[通知] 完整{label}超出单条限制，将分为 {count} 封发送', label, messages.length);
    await sendNotificationPages(messages, {
      send: (message) => notification.Send(message),
      wait: (milliseconds) => sleep(milliseconds),
    });
    log.info('[通知] 已请求 BetterGI 发送{label}，共 {count} 封', label, messages.length);
  } catch (error) {
    log.error('[通知] 发送{label}失败，已继续原流程：{error}', label, error?.message ?? String(error));
  }
}

/** 失败通知自身不能覆盖原始异常。 */
async function sendFailureSummarySafely(error) {
  const scriptSettings = failureNotificationState.settings;
  if (!failureNotificationState.enabled || scriptSettings?.sendRunSummary !== true) return;
  await sendNotificationSafely(() => buildFailureRunSummary({
    stage: failureNotificationState.stage,
    targets: failureNotificationState.targets.length > 0 ? failureNotificationState.targets
      : scriptSettings.targetsText ? [scriptSettings.targetsText] : [],
    reason: error?.message ?? String(error),
  }), '失败摘要');
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

function loadObservedCharacters(path) {
  if (!file.IsFile(path)) return {};
  let observed;
  try {
    observed = JSON.parse(file.readTextSync(path));
  } catch {
    throw new Error('预培养实读记录损坏，拒绝回退到初始进度');
  }
  if (!observed || typeof observed !== 'object' || Array.isArray(observed)) {
    throw new Error('预培养实读记录损坏，拒绝回退到初始进度');
  }
  for (const [name, value] of Object.entries(observed)) {
    if (!name.trim() || ['__proto__', 'constructor', 'prototype'].includes(name) || value !== true) {
      throw new Error('预培养实读记录损坏，拒绝回退到初始进度');
    }
  }
  return observed;
}

async function persistObservedCharacters(path, observedCharacters) {
  const text = JSON.stringify(observedCharacters);
  try {
    await file.writeText(path, text, false);
    if (file.readTextSync(path) !== text) throw new Error('写入后校验不一致');
  } catch (error) {
    throw new Error(`无法保存预培养实读记录，已停止执行：${error?.message ?? String(error)}`);
  }
}

function attachTargetContext(plan, profile, targetSummary, guide = null, targetOutcomes = null) {
  plan.profile = profile;
  plan.targetSummary = targetSummary;
  plan.targetOutcomes = targetOutcomes ?? profile?.targetOutcomes ?? [];
  if (guide) plan.guide = guide;
}

async function executeResinQueue(entries, settings, partySwitchState) {
  if (entries.length === 0) {
    const reason = '今日没有已启用的树脂任务';
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
      if (execution.code === 'native_unsupported') {
        log.warn('[执行队列] BetterGI 暂不支持“{target}”，本轮跳过并尝试其他候选：{error}', target, execution.reason);
      } else {
        log.error('[执行队列] “{target}”未完成：{error}', target, execution.reason);
      }
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
  const combined = combineRunExecutions(executions);
  if (combined.status === 'failed' || !canContinueRoutesAfterResin(combined)) {
    const attempted = new Set(combined.tasks.map((task) => `${task.taskType}:${task.targetName}:${task.evidence?.sundaySelectedValue ?? ''}`));
    const blocked = [...new Set(entries.flatMap((entry) => [entry, ...(entry.unsupportedFallbacks ?? [])])
      .filter((entry) => !attempted.has(`${entry.task.executionType}:${entry.task.bossName ?? entry.task.domainName}:${entry.task.sundaySelectedValue ?? ''}`))
      .map((entry) => entry.task.bossName ?? entry.task.domainName))];
    if (blocked.length > 0) combined.warnings.push(createExecutionOutcome({
      taskId: 'resin:blocked', taskType: 'task', targetName: '后续树脂任务',
      status: 'skipped', code: 'resin_queue_stopped', stage: 'task', severity: 'warning',
      message: `因前序任务结果停止，未执行：${blocked.join('、')}`,
    }));
  }
  return combined;
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
      code: isCancellationError(error) ? 'cancelled'
        : isUnsupportedNativeTask(error, task) ? 'native_unsupported' : 'external_task_error',
      stage: 'task', evidence: { task }, startedAt,
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
    evidence: { taskRecognizedRewards, maxClaims: entry.maxClaims, maxResin: entry.maxResin,
      resinBudget: entry.resinBudget, category: entry.category },
    startedAt,
    endedAt: new Date().toISOString(),
  });
}

async function executeArtifactDomainTask(entry, partySwitchState) {
  const { task, config } = entry;
  const startedAt = new Date().toISOString();
  log.info('[圣遗物] 准备刷取“{domain}”，用途：{purpose}', config.domainName,
    task.roleArtifact ? '所选角色圣遗物' : '培养树脂任务后的填充');
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
    evidence: { taskRecognizedRewards, maxClaims: entry.maxClaims, maxResin: entry.maxResin,
      resinBudget: entry.resinBudget, category: entry.category },
    startedAt, endedAt: new Date().toISOString(),
  });
}

async function executeBossTask(entry, partySwitchState) {
  const { task, config } = entry;
  const startedAt = new Date().toISOString();
  log.info('[Boss] 准备刷取“{boss}”，材料目标：{materials}', config.bossName,
    config.trackedMaterials.map((item) => `${item.materialName}×${item.shortage}`).join('、'));
  log.info('[Boss] 按世界等级9的突破材料保底计算需 {needed} 次，本次最多领奖 {limit} 次；仍由 BetterGI 判断树脂是否可用',
    config.shortageRunCount, config.runCount);
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
  const cleanup = {};
  let rawRewards;
  try {
    rawRewards = await runBossTaskWithSafeExit({
      runTask: async () => {
        try {
          return await dispatcher.RunAutoBossTask(param);
        } catch (error) {
          if (isUnsupportedNativeTask(error, task)) {
            throw withExecutionContext(error, { code: 'native_unsupported', stage: 'task', evidence: { task }, startedAt });
          }
          throw error;
        }
      },
      teleportToStatue: () => genshin.TpToStatueOfTheSeven(),
      logger: log,
      cleanupState: cleanup,
      onCleanupFailure: (error) => cleanupWarnings.push(createExecutionOutcome({
        taskId: task.materialId, taskType: 'boss', targetName: config.bossName,
        status: 'unconfirmed', code: 'cleanup_failed', stage: 'cleanup', severity: 'warning',
        message: error?.message ?? String(error), evidence: { task }, endedAt: new Date().toISOString(),
      })),
    });
  } catch (error) {
    throw classifyBossTaskError(error, task, cleanup, startedAt);
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
    evidence: { taskRecognizedRewards, maxClaims: entry.maxClaims, maxResin: entry.maxResin,
      resinBudget: entry.resinBudget, category: entry.category, cleanup },
    startedAt, endedAt: new Date().toISOString(),
  });
}

async function executeRoutesSafely(routes, settings, materials, recipes, partySwitchState) {
  try {
    const routeExecution = await executeMatchedRoutes(routes, settings, materials, recipes, partySwitchState);
    return routeExecution.records;
  } catch (error) {
    if (isCancellationError(error)) throw error;
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
  for (const [routeIndex, route] of routePlan.entries()) {
    if (unavailablePartyReasons.has(route.partyName)) {
      const reason = unavailablePartyReasons.get(route.partyName);
      log.warn('[路线执行] 跳过“{name}”：队伍“{party}”本次已确认不可用', route.name, route.partyName);
      records.push(buildSkippedRouteRecord(route, materials, reason));
      continue;
    }
    const startedAt = new Date().toISOString();
    const routeRecord = { name: route.name, type: route.type, materials: [], paths: [], attemptedPaths: [], gained: {}, startedAt };
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
        routeRecord.attemptedPaths.push(routePath);
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
      if (isCancellationError(error)) throw error;
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
    if (routeRecord.status === 'failed' && routeRecord.stage !== 'party') {
      const blockedRoutes = routePlan.slice(routeIndex + 1).map((item) => item.name);
      routeRecord.evidence.blockedRoutes = blockedRoutes;
      if (blockedRoutes.length > 0) routeRecord.reason += `；安全原因未执行：${blockedRoutes.join('、')}`;
      log.warn('[路线执行] 路线异常无法确认已恢复，停止剩余路线；不继续操作游戏');
      break;
    }
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
    if (scope === '圣遗物') log.info('[圣遗物] BetterGI未返回奖励，领奖未确认；不读取圣遗物背包或推断套装质量');
    else log.info('[{scope}] BetterGI 未返回奖励；这不代表已领奖，最终按相关背包差值复核', scope);
  }
}

async function scanInventoryItemIds(materialIds, inventory, materials, phase, options = {}) {
  const scanGroups = buildInventoryScanGroups(materialIds, materials);
  const scanCount = Object.values(scanGroups).reduce((total, items) => total + items.length, 0);
  let updatedInventory = inventory;
  const issueNames = new Set();
  const decreasedNames = new Set();
  const notFoundNames = new Set();
  log.info('[背包] {phase}读取 {count} 个本次目标材料及可合成低阶材料', phase, scanCount);
  const automaticItems = Object.values(scanGroups).flat();
  const scanJobs = automaticItems.length > 0
    ? [{ tabName: '自动分页', scanItems: automaticItems, automatic: true }]
    : [];
  for (let index = 0; index < scanJobs.length; index += 1) {
    const { tabName, scanItems, automatic } = scanJobs[index];
    const param = new CountInventoryItemParam();
    param.IconRecognitionMode = ItemIconRecognitionMode.Item;
    param.StopByItemSort = false;
    if (!automatic) {
      param.GridScreenName = tabName === 'CharacterDevelopmentItems'
        ? GridScreenName.CharacterDevelopmentItems
        : GridScreenName.Materials;
    }
    for (const item of scanItems) param.ItemNames.Add(item.name);
    try {
      log.info('[背包] {phase}{method}：{names}', phase,
        automatic ? '按物品所属页面自动读取' : `读取“${tabName}”页`,
        scanItems.map((item) => item.name).join('、'));
      const counts = normalizeInventoryCountMap(await dispatcher.RunCountInventoryItemTask(param), scanItems);
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
        log.warn('[背包] {phase}未找到或未识别以下材料，可能无库存、图标未匹配或页面切换失败；保留原值，不据此判断零收益：{names}',
          phase, applied.unrecognizedNames.join('、'));
      }
      if (applied.decreasedNames.length > 0) {
        for (const name of applied.decreasedNames) decreasedNames.add(name);
        for (const name of applied.decreasedNames) issueNames.add(name);
        log.warn('[背包] {phase}以下材料返回值低于执行前；本脚本不会消耗培养材料，已保留原库存：{names}',
          phase, applied.decreasedNames.join('、'));
      }
    } catch (error) {
      if (isCancellationError(error)) throw error;
      if (automatic) {
        log.warn('[背包] {phase}自动分页失败，改用原有分栏扫描：{error}', phase, error.message ?? String(error));
        scanJobs.push(...Object.entries(scanGroups).map(([name, items]) => ({ tabName: name, scanItems: items, automatic: false })));
        continue;
      }
      for (const item of scanItems) issueNames.add(item.name);
      log.error('[背包] {phase}读取“{tab}”页失败，相关材料将保留原值：{error}。请检查背包界面、BetterGI 版本；若是数量文字异常，再确认 OCR V6',
        phase, tabName, error.message ?? String(error));
    }
  }
  return { inventory: updatedInventory, issueNames: [...issueNames], notFoundNames: [...notFoundNames], decreasedNames: [...decreasedNames] };
}

try {
  await main();
} catch (error) {
  if (!isCancellationError(error)) await sendFailureSummarySafely(error);
  throw error;
}
