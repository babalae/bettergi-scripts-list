import { normalizeLegacyExecution } from './execution-outcome.js';

export function shouldSendRunNotifications(settings = {}) {
  return settings.sendRunSummary === true && settings.targetInputMode !== '自动档案仅预览';
}

/** 日志与邮件共用逐材料说明；已由任务奖励确认的材料不再宣称增长未知。 */
export function formatInventoryGainIssues(execution = {}, context = null) {
  const details = new Map((execution.inventoryGainIssues ?? []).map((item) => [item.name, item]));
  return [...new Set(execution.inventoryUnrecognizedNames ?? [])].map((name) => {
    const item = details.get(name);
    if (context) {
      const id = Object.keys(context.materials).find((key) => context.materials[key]?.name === name);
      const source = execution.gainSources?.[name];
      const shortages = (context.plan.displayShortages ?? context.plan.shortages ?? []);
      const progressKnown = id && (Object.hasOwn(context.plan.requirements ?? {}, id)
        || context.plan.crafting?.scanMaterialIds?.includes(id)
        || shortages.some((row) => String(row.materialId) === id))
        && !context.uncertainIds.has(id)
        && Number.isInteger(execution.inventoryObservedAfter?.[id]);
      const shortage = shortages.find((row) => String(row.materialId) === id)?.shortage ?? 0;
      const progress = progressKnown ? shortage > 0 ? `还缺×${shortage}` : '已足够' : '剩余缺口未确认';
      const reason = item?.beforeUnknown && !item.afterUnknown && !item.decreased
        ? '开始识别失败' : item?.decreased ? '结束数量异常' : item?.afterUnknown ? '结束识别失败' : '背包识别失败';
      return `${name}：${progress}；${reason}，${source === 'task-recognition' ? '增长已由奖励确认' : '本次增长未知'}`;
    }
    const reasons = [];
    if (item?.beforeUnknown) reasons.push('开始数量未知');
    if (item?.afterUnknown) reasons.push('结束数量未确认');
    if (item?.decreased) reasons.push('结束数量异常下降');
    if (reasons.length === 0) reasons.push('前后数量不可信');
    const result = execution.gainSources?.[name] === 'task-recognition'
      ? '已用任务奖励确认收益' : '本次增长无法确认';
    return `${name}：${reasons.join('、')}，${result}`;
  });
}

export function limitNotificationMessage(message, limit = 500) {
  const text = String(message ?? '');
  if (text.length <= limit) return text;
  let result = '';
  for (const character of text) {
    if (result.length + character.length + 1 > limit) break;
    result += character;
  }
  return `${result}…`;
}

/** BetterGI 邮件使用 HTML；保留所有内容，长度限制由分封处理。 */
export function formatEmailNotification(message) {
  return String(message ?? '').split(/\r?\n/).map(escapeHtml).join('<br>');
}

/** 短摘要只发一封；超限时带编号分封，不截断材料名称、数量或 HTML 实体。 */
export function buildNotificationMessages(message, { limit = 500, label = '结束摘要' } = {}) {
  const formatted = formatEmailNotification(message);
  if (formatted.length <= limit) return [formatted];
  let pageCount = 2;
  while (true) {
    const headerLength = `${escapeHtml(label)} ${pageCount}/${pageCount}<br>`.length;
    const budget = limit - headerLength;
    if (budget < 6) throw new Error('通知长度限制不足以容纳分封标题');
    const pages = [];
    let current = '';
    const append = (token) => {
      if (current.length + token.length > budget) {
        pages.push(current);
        current = '';
      }
      current += token;
    };
    for (const [index, line] of String(message ?? '').split(/\r?\n/).entries()) {
      const prefix = index > 0 ? '<br>' : '';
      const formattedLine = `${prefix}${escapeHtml(line)}`;
      if (formattedLine.length <= budget) append(formattedLine);
      else {
        if (prefix) append(prefix);
        for (const character of line) append(escapeHtml(character));
      }
    }
    if (current) pages.push(current);
    if (String(pages.length).length === String(pageCount).length) {
      return pages.map((page, index) => `${escapeHtml(label)} ${index + 1}/${pages.length}<br>${page}`);
    }
    pageCount = pages.length;
  }
}

/** BetterGI 同一脚本每分钟最多五条通知，长摘要分批发送。 */
export async function sendNotificationPages(messages, { send, wait }) {
  for (let index = 0; index < messages.length; index++) {
    if (index > 0 && index % 5 === 0) await wait(61000);
    await send(messages[index]);
  }
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** 缺口需要可信的结束库存；合成系列中有未知数量时，不展示精确折算结果。 */
function collectUncertainInventoryIds(execution, materials, recipes) {
  if (!execution) return new Set();
  const names = new Set(Array.isArray(execution.inventoryAfterIssueNames)
    ? execution.inventoryAfterIssueNames
    : [
      ...(execution.inventoryGainIssues ?? []).filter((item) => item.afterUnknown || item.decreased).map((item) => item.name),
      ...(execution.inventoryBackgroundIssueNames ?? []),
      ...(execution.inventoryGainIssues ? [] : execution.inventoryUnrecognizedNames ?? []),
    ]);
  if (execution.inventoryChecked !== true) {
    for (const name of execution.inventoryBeforeIssueNames ?? []) names.add(name);
    for (const warning of execution.warnings ?? []) {
      if (warning.code === 'inventory_history_conflict') names.add(warning.targetName);
      if (warning.code === 'inventory_scan_failed') {
        for (const name of warning.evidence?.issueNames ?? []) names.add(name);
      }
    }
  }
  const ids = new Set(Object.keys(materials).filter((id) => names.has(materials[id]?.name)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [output, recipe] of Object.entries(recipes)) {
      for (const input of recipe.inputs ?? []) {
        const source = String(input.id);
        if (!ids.has(output) && !ids.has(source)) continue;
        if (!ids.has(output) || !ids.has(source)) changed = true;
        ids.add(output);
        ids.add(source);
      }
    }
  }
  return ids;
}

/** 生成未处理异常通知；只在用户已确认执行后调用。 */
export function buildFailureRunSummary({ stage = '运行过程中', targets = [], reason = '未知错误' } = {}) {
  const targetText = Array.isArray(targets) && targets.length > 0 ? targets.join('、') : '未确认';
  return '角色一键养成运行失败'
    + `\n\n培养目标：${targetText}`
    + `\n失败阶段：${stage}`
    + `\n失败原因：${reason}`;
}

/**
 * 生成完整运行摘要；使用简明说明，不省略材料明细，超限由发送层分封。
 */
export function buildRunSummary(plan, materials, {
  executionEnabled = false,
  estimateDays = null,
  estimateReason = '',
  estimateDetails = [],
  execution = null,
  recipes = {},
} = {}) {
  execution = normalizeLegacyExecution(execution);
  const planned = [...new Set((plan.todayQueue ?? []).map((task) => task.bossName ?? task.domainName
    ?? task.materialName ?? materials[task.materialId]?.name ?? task.materialId))];
  const uncertainIds = collectUncertainInventoryIds(execution, materials, recipes);
  const progressContext = { plan, materials, uncertainIds };
  const gainIssues = formatInventoryGainIssues(execution ?? {}, progressContext);
  const manualWeeklyIds = new Set((plan.manualItems ?? [])
    .filter((item) => item.material?.executionType === 'weeklyBoss')
    .map((item) => item.materialId));
  const missing = (plan.displayShortages ?? plan.shortages ?? [])
    .filter((item) => item.shortage > 0 && !manualWeeklyIds.has(item.materialId)
      && !uncertainIds.has(String(item.materialId)))
    .map((item) => `${materials[item.materialId]?.name ?? item.materialId}×${item.shortage}`)
    || [];
  const unknownMaterials = (plan.displayShortages ?? plan.shortages ?? [])
    .filter((item) => item.status === 'unknown' && !manualWeeklyIds.has(item.materialId)
      && !uncertainIds.has(String(item.materialId)))
    .map((item) => `${materials[item.materialId]?.name ?? item.material?.name ?? item.materialId}（库存未确认）`);
  const uncertainRemaining = [...new Set([
    ...Object.keys(plan.requirements ?? {}),
    ...(plan.displayShortages ?? plan.shortages ?? []).map((item) => String(item.materialId)),
  ])].filter((id) => uncertainIds.has(id) && !manualWeeklyIds.has(id) && materials[id]?.status !== 'excluded')
    .map((id) => `${materials[id]?.name ?? id}：缺口未确认`);
  const remaining = [...missing, ...unknownMaterials, ...uncertainRemaining];
  const manualWeekly = (plan.manualItems ?? [])
    .filter((item) => item.material?.executionType === 'weeklyBoss' && (item.shortage > 0 || uncertainIds.has(String(item.materialId))))
    .map((item) => uncertainIds.has(String(item.materialId))
      ? `${materials[item.materialId]?.name ?? item.material?.name ?? item.materialId}：缺口未确认`
      : `${materials[item.materialId]?.name ?? item.material?.name ?? item.materialId}×${item.shortage}`);
  const manualBoss = (plan.manualItems ?? [])
    .filter((item) => item.material?.executionType === 'boss' && (item.shortage > 0 || uncertainIds.has(String(item.materialId))))
    .map((item) => `${item.material?.bossName}：${uncertainIds.has(String(item.materialId))
      ? '缺口未确认' : `${materials[item.materialId]?.name ?? item.material?.name ?? item.materialId}×${item.shortage}`}；${item.reason ?? item.material?.reason ?? '需手动获取'}`);
  const uncertainNames = new Set([...uncertainIds].map((id) => materials[id]?.name));
  const reliableEstimates = estimateDetails.filter((item) => !(item.materialNames ?? []).some((name) => uncertainNames.has(name)));
  const estimate = estimateDetails.length > 0 && reliableEstimates.length === 0
    ? '预计：库存未确认，暂不估算'
    : formatEstimate(reliableEstimates.length !== estimateDetails.length
      ? Math.max(...reliableEstimates.map((item) => item.estimatedDays)) : estimateDays, estimateReason, reliableEstimates);
  const hasUnknownMaterial = unknownMaterials.length > 0 || uncertainRemaining.length > 0;
  const materialsSatisfied = missing.length === 0 && manualWeekly.length === 0 && !hasUnknownMaterial;
  const excludedPending = (plan.displayShortages ?? plan.shortages ?? []).filter((item) => item.status === 'excluded'
    && (item.owned == null || item.owned < item.required));
  const excludedNote = excludedPending.length === 0 ? ''
    : excludedPending.some((item) => item.owned == null) ? '范围外材料未核对' : '范围外材料仍不足';
  const gains = execution?.trackedRewards && Object.keys(execution.trackedRewards).length > 0
    ? Object.entries(execution.trackedRewards).map(([name, count]) => `${name}×${count}`)
    : [];
  const weeklyGroups = new Map();
  for (const item of plan.weeklyStrategy ?? []) {
    const tasks = item.tasks.map((task) => task.domainName ?? task.materialName ?? task.materialId).join('、');
    if (!weeklyGroups.has(tasks)) weeklyGroups.set(tasks, []);
    weeklyGroups.get(tasks).push(item.label);
  }
  const weekly = [...weeklyGroups.entries()].map(([tasks, labels]) => `${labels.join('、')}：${tasks}`);
  const routeGroups = new Map();
  for (const route of execution?.routes ?? []) {
    if (!routeGroups.has(route.name)) routeGroups.set(route.name, { statuses: [], reasons: [], gained: {} });
    const group = routeGroups.get(route.name);
    group.statuses.push(route.status);
    if (route.reason) group.reasons.push(route.reason);
    for (const [name, count] of Object.entries(route.gained ?? {})) {
      group.gained[name] = (group.gained[name] ?? 0) + count;
    }
  }
  const routeResults = [...routeGroups.entries()].map(([name, route]) => {
    const status = route.statuses.includes('failed')
      ? `失败（${[...new Set(route.reasons)].join('；') || '未知原因'}）`
      : route.statuses.includes('unconfirmed')
        ? route.reasons.some((reason) => reason.includes('数量无法确认')) ? '已执行' : '未确认增长'
        : '已完成';
    // 收益总表已列明的相同数量不重复展示；独立路线证据仍完整保留。
    const routeGains = Object.entries(route.gained)
      .filter(([materialName, count]) => count > 0 && execution?.trackedRewards?.[materialName] !== count)
      .map(([materialName, count]) => `${materialName}×${count}`);
    return `${name}：${status}${routeGains.length > 0 ? `；${routeGains.join('、')}` : ''}`;
  });
  const hasRouteFailure = (execution?.routes ?? []).some((route) => route.status === 'failed');
  const hasUnconfirmedRoute = (execution?.routes ?? []).some((route) => route.status === 'unconfirmed');
  const hasRouteExecution = (execution?.routes ?? []).length > 0;
  const taskResult = formatTaskResult(execution);
  const issueNames = new Set(execution?.inventoryUnrecognizedNames ?? []);
  const warnings = [...new Set((execution?.warnings ?? []).map((warning) => {
    if (warning.code === 'inventory_scan_failed') return '';
    if (warning.code === 'inventory_history_conflict') {
      return issueNames.has(warning.targetName) ? '' : `${warning.targetName}：开始未识别，可能重复刷取`;
    }
    return `${warning.targetName ? `${warning.targetName}：` : ''}${warning.message || warning.code}`;
  }).filter(Boolean))];
  // 多任务下保留单项未领奖提醒，不能让路线收益掩盖 Boss 的结果。
  if ((execution?.tasks?.length ?? 0) > 1 || hasRouteExecution) {
    for (const task of execution?.tasks ?? []) {
      if (task.status === 'unconfirmed' && task.taskType !== 'artifactDomain') {
        warnings.push(`${task.targetName}：${(task.evidence?.inventoryIssueNames?.length ?? 0) > 0 ? '数量无法确认' : '未确认获得目标材料'}`);
      }
    }
  }
  const action = !executionEnabled
    ? '本次未执行'
    : execution?.status === 'failed'
      ? `${gains.length > 0 ? '任务失败，但已确认部分收益' : '执行失败'}：${execution.reason || '未提供失败原因'}`
      : execution?.status === 'unconfirmed'
        ? taskResult.status
      : hasRouteFailure
        ? taskResult.tasks.length > 0
          ? `${taskResult.status}；存在路线执行错误`
          : '部分执行失败：存在路线执行错误'
        : hasUnconfirmedRoute && execution?.inventoryRecognitionFailed !== true
          ? taskResult.tasks.length > 0
            ? `${taskResult.status}；部分路线未确认材料增长`
            : '已执行路线任务；部分路线未确认材料增长'
          : execution?.status === 'skipped' && hasRouteExecution
            ? '已执行路线任务'
      : execution?.status === 'skipped' && materialsSatisfied
        ? excludedNote ? `无需执行：可刷材料已齐；${excludedNote}` : '无需执行：培养材料已满足'
      : execution?.status === 'skipped'
        ? `未执行：${execution.reason || '没有可执行任务'}`
        : taskResult.status;
  const onlyArtifactTasks = (execution?.tasks?.length ?? 0) > 0
    && execution.tasks.every((task) => task.taskType === 'artifactDomain');
  const artifactFill = plan.roleArtifactFill;
  const artifactOutcome = artifactFill?.recommendation
    ? execution?.tasks?.find(task => task.taskType === 'artifactDomain' && task.targetName === artifactFill.domainName)
    : null;
  const artifactLines = artifactFill?.recommendation ? [
    `${artifactFill.recommendation.characterName}：${artifactFill.recommendation.setName} → ${artifactFill.domainName}`,
    ...(artifactOutcome?.status === 'completed' ? []
      : [artifactOutcome?.status === 'unconfirmed' ? '领奖未确认'
        : artifactFill.reason ?? '未执行']),
  ] : [];
  const artifactRewards = Object.entries(artifactOutcome?.evidence?.taskRecognizedRewards ?? {})
    .map(([name, count]) => `${name}×${count}`);
  const sections = [
    '角色一键养成摘要',
    `\n本次结果：${action}`,
    (plan.targetSummary ?? []).length > 0
      ? `\n\n培养进度${formatItems(plan.targetSummary.map((line) => line.replace(/：未能生成目标（.*）$/, '：目标无效')), '无')}`
      : '',
    taskResult.tasks.length > 0 ? `\n\n本次任务${formatItems(taskResult.tasks, '无')}` : '',
    artifactLines.length > 0 ? `\n\n角色圣遗物填充${formatItems(artifactLines, '无')}` : '',
    artifactRewards.length > 0 ? `\n\n圣遗物任务奖励（BetterGI识别）${formatItems(artifactRewards, '无')}` : '',
    gains.length > 0 ? `\n\n确认收益${formatItems(gains, '无')}`
      : onlyArtifactTasks ? '\n\n圣遗物收益不纳入培养材料计数' : '',
    gainIssues.length > 0 ? `\n\n材料进度提醒${formatItems(gainIssues, '无')}` : '',
    `\n\n仍缺材料${formatItems(remaining, excludedNote ? `可刷范围内无缺口；${excludedNote}` : '无')}`,
    estimate ? `\n\n${estimate}` : '',
    manualWeekly.length > 0
      ? `\n\n周本需手动获取${formatItems(manualWeekly, '无')}`
      : '',
    manualBoss.length > 0 ? `\n\nBoss 需手动处理${formatItems(manualBoss, '无')}` : '',
    warnings.length > 0 ? `\n\n需注意${formatItems(warnings, '无')}` : '',
    routeResults.length > 0 ? `\n\n路线结果${formatItems(routeResults, '无')}` : '',
    planned.length > 0 ? `\n\n今日可刷${formatItems(planned, '无')}` : '',
    weekly.length > 0 ? `\n\n本周循环策略${formatItems(weekly, '无')}` : '',
  ];
  return sections.filter(Boolean).join('');
}

function formatTaskResult(execution) {
  const task = execution?.task;
  const tasks = execution?.tasks?.length > 0
    ? execution.tasks.map(formatOutcomeTask)
    : task ? [formatTask(task)] : [];
  if (!task) return {
    status: execution?.appliedGains ? execution?.inventoryRecognitionFailed
      ? '已确认部分路线收益；部分材料需查看识别提醒' : '已确认路线材料收益'
      : execution?.inventoryRecognitionFailed ? '路线材料数量无法确认'
        : execution?.status === 'skipped' ? '本次无树脂任务' : '未确认获得目标材料',
    tasks,
  };
  if (execution?.status === 'failed') return { status: `任务失败：${execution.message || execution.reason || '未知原因'}`, tasks };
  if (execution?.status === 'skipped') return { status: `任务已跳过：${execution.message || execution.reason || '未提供原因'}`, tasks };
  const unconfirmedTasks = (execution.tasks ?? []).filter((outcome) => outcome.status === 'unconfirmed');
  if (unconfirmedTasks.length > 0 && unconfirmedTasks.every((outcome) => outcome.taskType === 'artifactDomain')) {
    return {
      status: `${execution.appliedGains ? '已确认部分培养材料收益；' : ''}${execution.inventoryRecognitionFailed ? '部分材料增长无法确认；' : ''}圣遗物领奖未确认`, tasks,
    };
  }
  if (execution?.status === 'unconfirmed') {
    return { status: execution.inventoryRecognitionFailed ? '数量无法确认' : '未确认获得目标材料', tasks };
  }
  if (task.executionType === 'artifactDomain') {
    return { status: '圣遗物任务调用结束；收益不纳入培养材料统计', tasks };
  }
  if (Object.values(execution.gainSources ?? {}).includes('task-recognition')) {
    const unconfirmedTasks = (execution.tasks ?? []).some((outcome) => outcome.status === 'unconfirmed');
    return { status: `已确认收益（含奖励识别）${unconfirmedTasks ? '；部分任务未确认收益' : ''}`, tasks };
  }
  if (execution.inventoryRecognitionFailed === true) {
    return {
      status: execution.appliedGains === true
        ? '已确认部分收益；部分材料增长未知'
        : '数量无法确认',
      tasks,
    };
  }
  if (execution.inventoryChecked === true && execution.appliedGains === true) {
    const unconfirmedTasks = (execution.tasks ?? []).some((outcome) => outcome.status === 'unconfirmed');
    return { status: `已确认收益${unconfirmedTasks ? '；部分任务未确认收益' : ''}`, tasks };
  }
  return { status: '未确认获得目标材料', tasks };
}

function formatOutcomeTask(outcome) {
  const labels = {
    domain: '培养秘境',
    artifactDomain: '圣遗物秘境',
    boss: '世界 Boss',
    route: '路线',
  };
  const gains = Object.entries(outcome.evidence?.trackedRewards ?? {}).map(([name, count]) => `${name}×${count}`);
  const detail = ['failed', 'skipped'].includes(outcome.status)
    ? `；${outcome.status === 'failed' ? '失败' : '跳过'}：${outcome.message || '未提供原因'}` : '';
  const confirmed = outcome.status === 'failed' && gains.length > 0 ? `；已确认获得${gains.join('、')}` : '';
  return `${labels[outcome.taskType] ?? '树脂任务'}：${outcome.targetName ?? '未命名任务'}${detail}${confirmed}`;
}

function formatTask(task) {
  const name = task.domainName ?? task.bossName ?? task.materialName ?? '未命名任务';
  const labels = {
    domain: '培养秘境',
    artifactDomain: '圣遗物秘境',
    boss: '世界 Boss',
  };
  return `${labels[task.executionType] ?? '树脂任务'}：${name}`;
}

function formatEstimate(days, reason, details) {
  if (reason.startsWith('可刷材料已齐；')) return '';
  if (days === 0 && reason === '材料已满足') return '';
  if (!Number.isFinite(days)) {
    if (/库存未确认/.test(reason)) return '预计：库存未确认，暂不估算';
    // 周本、圣遗物的边界已在对应栏目说明，不在预计栏目重复。
    return /周本|圣遗物/.test(reason) ? '' : '预计：暂无可靠估算';
  }
  if (details.length === 1) {
    const detail = details[0];
    if (detail.sourceType === 'route') {
      return `路线预计：${detail.sourceName}约${detail.estimatedRuns}次／${days}天`;
    }
    if (detail.sourceType === 'boss') {
      return `Boss预计：约${detail.requiredOpenDays}天，${detail.estimatedClaims}次／${detail.estimatedResin}树脂`;
    }
    return `秘境预计：约${detail.estimatedClaims}次／${detail.estimatedResin}树脂，${days > 0 ? `最早${days}天` : `${detail.requiredOpenDays}个开放日`}`;
  }
  const scope = details.length > 0 && details.every((detail) => detail.sourceType !== 'route') ? '树脂任务' : '可执行任务';
  return days === 0 ? `${scope}预计：本开放日可刷完，树脂不足则顺延` : `${scope}预计：约${days}天`;
}

function formatItems(items, emptyText) {
  if (!items.length) return `\n• ${emptyText}`;
  return items.map((item) => `\n• ${item}`).join('');
}
