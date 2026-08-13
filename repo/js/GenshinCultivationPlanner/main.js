import { createPlan } from './core/planner.js';
import { applyInventoryScanResult, buildInventoryScanGroups } from './core/inventory.js';
import { applyMatchedRouteSupport, discoverAutoPathingRoutes } from './core/routes.js';
import { buildRunSummary } from './core/report.js';
import { collectExecutionWarnings } from './core/preflight.js';
import { buildDomainResinPolicy } from './core/resin.js';
import { buildDomainExecutionConfig } from './core/domain-executor.js';
import { buildTrackedInventoryGains } from './core/execution-progress.js';
import { buildWeeklyStrategy } from './core/scheduler.js';
import { appendRunHistory, buildRunRecord } from './core/history.js';
import { parseTargetText } from './core/target-input.js';
import { resolvePlanningWeekday } from './core/server-weekday.js';
import { buildCompletionEstimate } from './core/estimate.js';
import { applyFinalRouteInventoryGains, buildRouteExecutionPlan, runSubscribedRouteFile } from './core/route-executor.js';
import { buildBossExecutionConfig, isBossTaskEnabled } from './core/boss-executor.js';
import { appendArtifactFallbackTask, buildArtifactDomainExecutionConfig } from './core/artifact-executor.js';
import { switchPartyWithRecovery } from './core/party-switch.js';
import { assertExecutionConfirmed, normalizeScriptSettings } from './core/settings.js';

async function main() {
  let scriptSettings;
  try {
    scriptSettings = normalizeScriptSettings(settings);
    assertExecutionConfirmed(scriptSettings);
  } catch (error) {
    log.error('[配置] {message}', error?.message ?? String(error));
    throw error;
  }
  const executionEnabled = true;
  log.info('[模式] 已确认配置，进入实际执行模式');

  const materials = JSON.parse(file.readTextSync('data/materials.json'));
  const recipes = JSON.parse(file.readTextSync('data/crafting-recipes.json'));
  const rulebook = JSON.parse(file.readTextSync('data/rulebook.json'));
  const targetData = loadTargets(scriptSettings, rulebook);
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

  let inventory = targetData.inventory ?? {};
  let plan = createPlan({
    targets: targetData.targets ?? [],
    inventory,
    materials,
    recipes,
    rulebook,
    today,
  });

  // 兼容 BetterGI 已保存的旧设置：字段不存在时也默认开启读取。
  if (scriptSettings.scanInventory !== false) {
    inventory = await scanInventoryMaterials(plan, inventory, materials, '执行前');

    plan = createPlan({
      targets: targetData.targets ?? [],
      inventory,
      materials,
      recipes,
      rulebook,
      today,
    });
  } else {
    log.info('[背包] 已关闭自动读取，库存仅使用目标文件中的 inventory 字段');
  }

  if (scriptSettings.discoverRoutes !== false) {
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

  appendArtifactFallbackTask(plan, scriptSettings);

  const executionWarnings = collectExecutionWarnings(plan, scriptSettings);
  for (const warning of executionWarnings) {
    log.warn('[执行前检查] {warning}', warning);
  }
  const domainResinPolicy = buildDomainResinPolicy(scriptSettings);
  plan.weeklyStrategy = buildWeeklyStrategy(plan.weeklyPlan, today);
  const discoveredRoutes = plan.routes;
  log.info('[树脂] 秘境策略：指定使用={specified}；BetterGI 实际顺序={priority}；原粹/浓缩/须臾/脆弱上限={original}/{condensed}/{transient}/{fragile}',
    domainResinPolicy.specifyResinUse,
    domainResinPolicy.priority.join('、') || '无',
    domainResinPolicy.originalResinUseCount,
    domainResinPolicy.condensedResinUseCount,
    domainResinPolicy.transientResinUseCount,
    domainResinPolicy.fragileResinUseCount);
  plan.domainResinPolicy = domainResinPolicy;
  const inventoryBeforeExecution = { ...inventory };
  const trackedMaterialIds = [...plan.crafting.scanMaterialIds];

  {
    let execution;
    const partySwitchState = { initialized: false };
    try {
      execution = await executeFirstResinTask(plan, scriptSettings, domainResinPolicy, materials, inventory, partySwitchState);
    } catch (error) {
      execution = {
        status: 'failed',
        reason: error.message ?? String(error),
        rewards: {},
        appliedGains: false,
      };
      log.error('[执行] 未开始或未完成秘境刷取：{error}', execution.reason);
    }
    plan.execution = execution;
    if (execution.status !== 'failed' && scriptSettings.routeExecutionEnabled === true) {
      try {
        const routeExecution = await executeMatchedRoutes(discoveredRoutes, scriptSettings, materials, recipes, partySwitchState);
        execution.routes = routeExecution.records;
      } catch (error) {
        const reason = error.message ?? String(error);
        execution.routes = [{ name: '路线任务', type: 'route', status: 'failed', reason, paths: [], materials: [], gained: {} }];
        log.error('[路线执行] 初始化或收尾失败，已停止路线并继续保存报告：{reason}', reason);
      }
    }

    const hasExecutionAttempt = execution.status !== 'skipped' || (execution.routes?.length ?? 0) > 0;
    if (hasExecutionAttempt && scriptSettings.scanInventory !== false && trackedMaterialIds.length > 0) {
      const finalInventoryScan = await scanInventoryItemIds(
        trackedMaterialIds,
        inventory,
        materials,
        '全部任务结束后',
        { preserveDecreases: true, notFoundAsUnknown: true },
      );
      inventory = finalInventoryScan.inventory;
      execution.trackedRewards = buildTrackedInventoryGains(
        inventoryBeforeExecution,
        inventory,
        trackedMaterialIds,
        materials,
      );
      execution.inventoryChecked = true;
      execution.inventoryRecognitionFailed = finalInventoryScan.issueNames.length > 0;
      execution.inventoryUnrecognizedNames = finalInventoryScan.issueNames;
      execution.appliedGains = Object.keys(execution.trackedRewards).length > 0;
      if (execution.routes?.length > 0) {
        execution.routes = applyFinalRouteInventoryGains(
          execution.routes,
          inventoryBeforeExecution,
          inventory,
        );
        for (const route of execution.routes.filter((item) => item.status === 'unconfirmed')) {
          log.warn('[路线执行] “{name}”在全部任务结束后的背包复核中未确认到材料增长', route.name);
        }
      }
      if (execution.appliedGains && execution.inventoryRecognitionFailed) {
        log.warn('[执行] 已确认部分目标材料收益，但以下材料未能完成背包复核：{names}。请确认 BetterGI 已切换到 OCR V6 后重试',
          execution.inventoryUnrecognizedNames.join('、'));
      } else if (execution.appliedGains) {
        log.info('[执行] 已按整次运行的背包前后差值确认目标材料收益：{rewards}', JSON.stringify(execution.trackedRewards));
      } else if (execution.task?.executionType === 'artifactDomain' && !(execution.routes?.length > 0)) {
        log.info('[执行] 圣遗物填充不按目标培养材料的背包差值统计收益');
      } else if (execution.inventoryRecognitionFailed) {
        log.warn('[执行] 任务已调用，但以下材料未能完成结束背包复核，奖励结果未知：{names}。请确认 BetterGI 已切换到 OCR V6 后重试',
          execution.inventoryUnrecognizedNames.join('、'));
      } else if (execution.routes?.length > 0) {
        log.warn('[执行] 全部任务结束后未确认到目标材料增长，可能是路线未获得材料或背包 OCR 失败');
      } else {
        log.warn('[执行] 树脂任务调用结束，但最终背包差值未确认到目标材料增长');
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
      plan.routes = discoveredRoutes;
      applyMatchedRouteSupport(plan, discoveredRoutes);
      plan.weeklyStrategy = buildWeeklyStrategy(plan.weeklyPlan, today);
      plan.domainResinPolicy = domainResinPolicy;
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
  let history = [];
  try {
    history = JSON.parse(file.readTextSync('record/history.json'));
  } catch {
    // 首次运行没有历史文件属于正常情况。
  }
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
  });
  const updatedHistory = appendRunHistory(history, runRecord);
  await file.writeText('record/history.json', JSON.stringify(updatedHistory, null, 2), false);
  log.info('[记录] 已保存本次运行记录；历史保留 {count} 条', updatedHistory.length);
  if (scriptSettings.sendRunSummary === true) {
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
  const finalResult = !executionEnabled
    ? '本次未执行培养或刷取任务'
    : plan.execution?.status === 'failed'
      ? `本次执行失败：${plan.execution.reason}`
      : plan.execution?.task && routeCount > 0
        ? `本次已调用 1 个树脂任务并执行 ${routeCount} 组路线任务`
        : plan.execution?.task
          ? '本次已调用 1 个树脂任务；实际领奖结果以执行证据为准'
          : routeCount > 0
            ? `本次已执行 ${routeCount} 组路线任务`
            : `本次未执行：${plan.execution?.reason || '没有可执行任务'}`;
  log.info('[完成] 已保存计划记录：record/latest-plan.json；{result}', finalResult);
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

async function executeFirstResinTask(plan, settings, resinPolicy, materials, inventory, partySwitchState) {
  const task = plan.todayQueue.find((item) => (
    item.status === 'supported' && isTaskExecutionEnabled(item, settings)
  ));
  if (!task) {
    log.info('[执行] 今日没有已启用的树脂任务，本次不执行');
    return { status: 'skipped', reason: '今日没有已启用的树脂任务', rewards: {}, appliedGains: false };
  }
  if (task.executionType === 'boss') return executeBossTask(task, settings, inventory, partySwitchState);
  if (task.executionType === 'artifactDomain') return executeArtifactDomainTask(task, settings, resinPolicy, inventory, partySwitchState);
  if (task.executionType !== 'domain') {
    return { status: 'skipped', reason: `暂不支持执行任务类型：${task.executionType}`, rewards: {}, appliedGains: false };
  }

  const config = buildDomainExecutionConfig(task, settings, resinPolicy);
  log.info('[执行] 准备刷取秘境“{domain}”，材料目标：{materials}', config.domainName,
    config.trackedMaterials.map((item) => `${item.materialName}×${item.shortage}`).join('、'));

  if (config.testSingleRun) {
    log.info('[执行] 培养秘境单次测试已开启：仅使用一次原粹树脂领奖，不使用浓缩、须臾或脆弱树脂');
  } else {
    log.info('[执行] 不合成树脂，按已配置顺序领取奖励：{priority}', config.resinPolicy.priority.join(' → '));
  }

  const switched = await switchTaskParty(config.partyName, '秘境', partySwitchState);
  if (!switched) {
    throw new Error(`切换秘境队伍失败：${config.partyName}`);
  }

  const param = new AutoDomainParam(0);
  param.DomainName = config.domainName;
  param.PartyName = config.partyName;
  if (config.sundaySelectedValue) param.SundaySelectedValue = config.sundaySelectedValue;
  if (config.strategyName) param.CombatStrategyPath = param.SetCombatStrategyPath(config.strategyName);
  param.SpecifyResinUse = config.resinPolicy.specifyResinUse;
  param.OriginalResinUseCount = config.resinPolicy.originalResinUseCount;
  param.CondensedResinUseCount = config.resinPolicy.condensedResinUseCount;
  param.TransientResinUseCount = config.resinPolicy.transientResinUseCount;
  param.FragileResinUseCount = config.resinPolicy.fragileResinUseCount;
  param.RewardRecognitionEnabled = true;

  await dispatcher.RunAutoDomainTask(param);
  log.info('[执行] 秘境“{domain}”任务调用结束；已启用 BetterGI 奖励识别，最终收益仍以全部任务结束后的背包复核为准', config.domainName);
  return {
    status: 'completed',
    task,
    rewards: {},
    trackedRewards: {},
    appliedGains: false,
    inventoryBefore: inventory,
  };
}

/** 世界 Boss 机制与队伍需求差异大，必须由用户显式开启后才允许自动执行。 */
function isTaskExecutionEnabled(task, scriptSettings) {
  if (task.executionType === 'boss') return isBossTaskEnabled(task, scriptSettings);
  return true;
}

async function executeArtifactDomainTask(task, scriptSettings, resinPolicy, inventory, partySwitchState) {
  const config = buildArtifactDomainExecutionConfig(task, scriptSettings, resinPolicy);
  log.info('[圣遗物] 准备刷取“{domain}”，仅作为当天无培养树脂任务时的填充', config.domainName);
  const switched = await switchTaskParty(config.partyName, '圣遗物秘境', partySwitchState);
  if (!switched) throw new Error(`切换圣遗物秘境队伍失败：${config.partyName}`);
  const param = new AutoDomainParam(0);
  param.DomainName = config.domainName;
  param.PartyName = config.partyName;
  if (config.strategyName) param.CombatStrategyPath = param.SetCombatStrategyPath(config.strategyName);
  param.SpecifyResinUse = config.resinPolicy.specifyResinUse;
  param.OriginalResinUseCount = config.resinPolicy.originalResinUseCount;
  param.CondensedResinUseCount = config.resinPolicy.condensedResinUseCount;
  param.TransientResinUseCount = config.resinPolicy.transientResinUseCount;
  param.FragileResinUseCount = config.resinPolicy.fragileResinUseCount;
  param.AutoArtifactSalvage = config.autoArtifactSalvage;
  param.MaxArtifactStar = config.maxArtifactStar;
  param.RewardRecognitionEnabled = true;
  await dispatcher.RunAutoDomainTask(param);
  log.info('[圣遗物] 任务调用结束；已启用 BetterGI 奖励识别，圣遗物收益不纳入培养材料计数');
  return {
    status: 'completed', task, rewards: {}, trackedRewards: {},
    appliedGains: false,
    inventoryBefore: inventory,
  };
}

async function executeBossTask(task, scriptSettings, inventory, partySwitchState) {
  const config = buildBossExecutionConfig(task, scriptSettings);
  log.info('[Boss] 准备刷取“{boss}”，材料目标：{materials}', config.bossName,
    config.trackedMaterials.map((item) => `${item.materialName}×${item.shortage}`).join('、'));
  const switched = await switchTaskParty(config.partyName, 'Boss', partySwitchState);
  if (!switched) throw new Error(`切换 Boss 队伍失败：${config.partyName}`);
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
  await dispatcher.RunAutoBossTask(param);
  log.info('[Boss] 任务调用结束；已启用 BetterGI 奖励识别，最终收益仍以全部任务结束后的背包复核为准');
  return {
    status: 'completed', task, rewards: {}, trackedRewards: {},
    appliedGains: false,
    inventoryBefore: inventory,
  };
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
    const routeRecord = { name: route.name, type: route.type, materials: [], paths: [], gained: {} };
    try {
      if (currentParty !== route.partyName) {
        const switched = await switchTaskParty(route.partyName, route.type === 'localSpecialty' ? '采集' : '怪物材料', partySwitchState);
        if (!switched) {
          const reason = `切换路线队伍失败：${route.partyName}`;
          unavailablePartyReasons.set(route.partyName, reason);
          throw new Error(reason);
        }
        currentParty = route.partyName;
        log.info('[路线执行] 已切换{type}队伍：{party}', route.type === 'localSpecialty' ? '采集' : '怪物材料', currentParty);
      }
      for (const routePath of route.paths) {
        log.info('[路线执行] 开始“{name}”：{path}', route.name, routePath);
        await runSubscribedRouteFile({
          isFile: (path) => pathingScript.IsFile(path),
          runFileFromUser: (path) => pathingScript.RunFileFromUser(path),
        }, routePath);
        routeRecord.paths.push({ path: routePath });
        log.info('[路线执行] “{name}”路线文件执行完成；收益将在全部任务结束后统一复核', route.name);
      }
    } catch (error) {
      routeRecord.status = 'failed';
      routeRecord.reason = error.message ?? String(error);
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
      routeRecord.status = 'pendingInventoryCheck';
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
    name: route.name,
    type: route.type,
    status: 'failed',
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
  const result = await scanInventoryItemIds(plan.crafting.scanMaterialIds, inventory, materials, phase);
  return result.inventory;
}

async function scanInventoryItemIds(materialIds, inventory, materials, phase, options = {}) {
  const scanGroups = buildInventoryScanGroups(materialIds, materials);
  const scanCount = Object.values(scanGroups).reduce((total, items) => total + items.length, 0);
  let updatedInventory = inventory;
  const issueNames = new Set();
  log.info('[背包] {phase}读取 {count} 个本次目标材料及可合成低阶材料', phase, scanCount);
  for (const [tabName, scanItems] of Object.entries(scanGroups)) {
    const param = new CountInventoryItemParam();
    param.GridScreenName = tabName === 'CharacterDevelopmentItems'
      ? GridScreenName.CharacterDevelopmentItems
      : GridScreenName.Materials;
    for (const item of scanItems) param.ItemNames.Add(item.name);
    try {
      log.info('[背包] {phase}读取“{tab}”页：{names}', phase, tabName, scanItems.map((item) => item.name).join('、'));
      const counts = await dispatcher.RunCountInventoryItemTask(param);
      const applied = applyInventoryScanResult(updatedInventory, scanItems, counts, options);
      updatedInventory = applied.inventory;
      if (applied.failedNames.length > 0) {
        for (const name of applied.failedNames) issueNames.add(name);
        log.warn('[背包] {phase}以下材料 OCR 失败，将不用于收益统计：{names}。请确认 BetterGI 已切换到 OCR V6 后重试',
          phase, applied.failedNames.join('、'));
      }
      if (applied.unrecognizedNames.length > 0) {
        for (const name of applied.unrecognizedNames) issueNames.add(name);
        log.warn('[背包] {phase}未识别到以下材料，已保留执行前数量且不会据此判断为零收益：{names}。请确认 BetterGI 已切换到 OCR V6 后重试',
          phase, applied.unrecognizedNames.join('、'));
      }
      if (applied.decreasedNames.length > 0) {
        for (const name of applied.decreasedNames) issueNames.add(name);
        log.warn('[背包] {phase}以下材料返回值低于执行前；本脚本不会消耗培养材料，已保留原库存：{names}',
          phase, applied.decreasedNames.join('、'));
      }
    } catch (error) {
      for (const item of scanItems) issueNames.add(item.name);
      log.error('[背包] {phase}读取“{tab}”页失败，相关材料将保留原值：{error}。请确认 BetterGI 已切换到 OCR V6 后重试',
        phase, tabName, error.message ?? String(error));
    }
  }
  return { inventory: updatedInventory, issueNames: [...issueNames] };
}

await main();
