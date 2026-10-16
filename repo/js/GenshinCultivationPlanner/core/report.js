import { normalizeLegacyExecution } from './execution-outcome.js';

/** 生成未处理异常的简短通知；只在用户已确认执行后调用。 */
export function buildFailureRunSummary({ stage = '运行过程中', targets = [], reason = '未知错误' } = {}) {
  const targetText = Array.isArray(targets) && targets.length > 0 ? targets.join('、') : '未确认';
  const prefix = '<b>角色一键养成运行失败</b>'
    + `<br><br><b>培养目标</b>：${escapeHtml(targetText).slice(0, 80)}`
    + `<br><b>失败阶段</b>：${escapeHtml(stage).slice(0, 40)}`
    + '<br><b>失败原因</b>：';
  const suffix = '<br><br>请查看 BetterGI 日志。';
  const reasonLimit = Math.max(1, 500 - prefix.length - suffix.length);
  return `${prefix}${escapeHtml(reason).slice(0, reasonLimit)}${suffix}`;
}

/**
 * 生成 BetterGI 通知摘要。通知接口限制为 500 字符，详细数据仍写入 latest-plan.json。
 */
export function buildRunSummary(plan, materials, {
  executionEnabled = false,
  estimateDays = null,
  estimateReason = '',
  estimateDetails = [],
  execution = null,
} = {}) {
  execution = normalizeLegacyExecution(execution);
  const planned = plan.todayQueue
    .map((task) => task.materials?.length
      ? `${task.domainName ?? task.bossName ?? task.materialName}：${task.materials.map((item) => `${item.materialName}×${item.shortage}`).join('/')}`
      : task.executionType === 'artifactDomain'
        ? `${task.domainName}（圣遗物填充）`
        : `${materials[task.materialId]?.name ?? task.materialName ?? task.materialId}(${task.shortage})`)
    || [];
  const missing = (plan.displayShortages ?? plan.shortages)
    .filter((item) => item.shortage > 0)
    .map((item) => `${materials[item.materialId]?.name ?? item.materialId}×${item.shortage}`)
    || [];
  const unknownMaterials = (plan.displayShortages ?? plan.shortages ?? [])
    .filter((item) => item.status === 'unknown')
    .map((item) => `${materials[item.materialId]?.name ?? item.material?.name ?? item.materialId}（库存未确认）`);
  const remaining = [...missing, ...unknownMaterials];
  const manualWeekly = (plan.manualItems ?? [])
    .filter((item) => item.material?.executionType === 'weeklyBoss' && item.shortage > 0)
    .map((item) => `${materials[item.materialId]?.name ?? item.material?.name ?? item.materialId}×${item.shortage}`);
  const estimate = formatEstimate(estimateDays, estimateReason, estimateDetails);
  const hasUnknownMaterial = unknownMaterials.length > 0;
  const materialsSatisfied = missing.length === 0 && manualWeekly.length === 0 && !hasUnknownMaterial;
  const gains = execution?.trackedRewards && Object.keys(execution.trackedRewards).length > 0
    ? Object.entries(execution.trackedRewards).map(([name, count]) => `${name}×${count}`)
    : [];
  const weekly = (plan.weeklyStrategy ?? []).map((item) => `${item.label}：${item.tasks
    .map((task) => task.domainName ?? task.materialName ?? task.materialId).join('、')}`);
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
    if (route.statuses.includes('failed')) return `${name}：失败（${route.reasons[0] || '未知原因'}）`;
    const routeGains = Object.entries(route.gained)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => `${name}×${count}`)
      .join('、');
    if (!routeGains && route.statuses.includes('unconfirmed')) return `${name}：未确认增长`;
    return `${name}：${routeGains || '已完成'}`;
  });
  const hasRouteFailure = (execution?.routes ?? []).some((route) => route.status === 'failed');
  const hasUnconfirmedRoute = (execution?.routes ?? []).some((route) => route.status === 'unconfirmed');
  const hasRouteExecution = (execution?.routes ?? []).length > 0;
  const taskResult = formatTaskResult(execution);
  const warnings = (execution?.warnings ?? []).map((warning) => (
    `${warning.targetName ? `${warning.targetName}：` : ''}${warning.message || warning.code}`
  ));
  const action = !executionEnabled
    ? '本次未执行'
    : execution?.status === 'failed'
      ? `执行失败：${execution.reason || '未提供失败原因'}`
      : execution?.status === 'unconfirmed'
        ? taskResult.status
      : hasRouteFailure
        ? taskResult.tasks.length > 0
          ? `${taskResult.status}；存在路线执行错误`
          : '部分执行失败：存在路线执行错误'
        : hasUnconfirmedRoute
          ? taskResult.tasks.length > 0
            ? `${taskResult.status}；部分路线未确认材料增长`
            : '已执行路线任务；部分路线未确认材料增长'
          : execution?.status === 'skipped' && hasRouteExecution
            ? '已执行路线任务'
      : execution?.status === 'skipped' && materialsSatisfied
        ? '无需执行：培养材料已满足'
      : execution?.status === 'skipped'
        ? `未执行：${execution.reason || '没有可执行任务'}`
        : taskResult.status;
  const inventoryIssueNames = execution?.inventoryUnrecognizedNames ?? [];
  const hasTaskRecognitionGain = Object.values(execution?.gainSources ?? {}).includes('task-recognition');
  const onlyArtifactTasks = (execution?.tasks?.length ?? 0) > 0
    && execution.tasks.every((task) => task.taskType === 'artifactDomain');
  const confirmedGainFallback = onlyArtifactTasks
    ? '圣遗物收益不纳入培养材料计数'
    : execution?.inventoryRecognitionFailed === true && !hasTaskRecognitionGain
      ? `奖励结果未知（背包未识别：${inventoryIssueNames.join('、') || '目标材料'}）`
    : execution?.task
      ? '未确认领取到目标材料，可能是树脂不足或奖励识别为空'
      : '无';
  const sections = [
    '<b>养成材料调度摘要</b>',
    `<br><b>本次状态</b>：${action}`,
    (plan.targetSummary ?? []).length > 0
      ? `<br><br><b>培养档案</b>${formatItems(plan.targetSummary, '无')}`
      : '',
    `<br><br><b>本次任务</b>${formatItems(taskResult.tasks, '无树脂任务')}`,
    `<br><br><b>确认收益</b>${formatItems(gains, confirmedGainFallback)}`,
    `<br><br><b>路线结果</b>${formatItems(routeResults, '本次无路线任务')}`,
    warnings.length > 0 ? `<br><br><b>运行警告</b>${formatItems(warnings, '无')}` : '',
    manualWeekly.length > 0
      ? `<br><br><b>需手动获取的周本材料</b>${formatItems(manualWeekly, '无')}`
      : '',
    `<br><br><b>仍缺材料</b>${formatItems(remaining, '无')}`,
    `<br><br><b>${estimate}</b>`,
    `<br><br><b>今日可执行任务</b>${formatItems(planned, '无')}`,
    `<br><br><b>本周循环策略</b>${formatItems(weekly, '本周无可执行树脂任务')}`,
  ];
  let summary = '';
  for (const section of sections) {
    if (!section) continue;
    if (summary.length + section.length > 500) return `${summary}<br>…`;
    summary += section;
  }
  return summary;
}

function formatTaskResult(execution) {
  const task = execution?.task;
  const tasks = execution?.tasks?.length > 0
    ? execution.tasks.map(formatOutcomeTask)
    : task ? [formatTask(task)] : [];
  if (!task) return { status: execution?.status === 'skipped' ? '本次无树脂任务' : '任务未完成', tasks };
  if (execution?.status === 'failed') return { status: `任务失败：${execution.message || execution.reason || '未知原因'}`, tasks };
  if (execution?.status === 'skipped') return { status: `任务已跳过：${execution.message || execution.reason || '未提供原因'}`, tasks };
  if (execution?.status === 'unconfirmed') return { status: `任务结果未确认：${execution.message || execution.reason || '未确认领取奖励'}`, tasks };
  if (task.executionType === 'artifactDomain') {
    return { status: '圣遗物任务调用结束；收益不纳入培养材料统计', tasks };
  }
  if (Object.values(execution.gainSources ?? {}).includes('task-recognition')) {
    return { status: '已确认收益；部分材料由 BetterGI 奖励识别补充确认', tasks };
  }
  if (execution.inventoryRecognitionFailed === true) {
    const names = (execution.inventoryUnrecognizedNames ?? []).join('、') || '目标材料';
    return {
      status: execution.appliedGains === true
        ? `已确认部分收益；部分材料背包识别失败（${names}）`
        : `任务调用结束；奖励结果未知（背包未识别：${names}）`,
      tasks,
    };
  }
  if (execution.inventoryChecked === true && execution.appliedGains === true) {
    return { status: '已由背包差值确认收益', tasks };
  }
  return { status: '未确认领取到目标材料，可能是树脂不足或奖励识别为空', tasks };
}

function formatOutcomeTask(outcome) {
  const labels = {
    domain: '培养秘境',
    artifactDomain: '圣遗物秘境',
    boss: '世界 Boss',
    route: '路线',
  };
  const statuses = {
    completed: '已完成',
    unconfirmed: '未确认',
    skipped: '已跳过',
    failed: '失败',
  };
  return `${labels[outcome.taskType] ?? '树脂任务'}：${outcome.targetName ?? '未命名任务'}（${statuses[outcome.status] ?? outcome.status}）`;
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
  if (days === 0 && reason === '材料已满足') return '预计完成：培养材料已满足';
  if (!Number.isFinite(days)) return `预计完成：${reason || '等待累计实际掉落数据'}`;
  if (details.length === 1) {
    const detail = details[0];
    if (detail.sourceType === 'boss') {
      return `预计完成：约${detail.estimatedClaims}次领奖、${detail.estimatedResin}树脂；按每日树脂预算约${detail.requiredOpenDays}天（${reason || '按掉落期望估算'}）`;
    }
    const calendar = days === 0
      ? '当前开放日可刷；若本次树脂已用完则等待下一个开放日'
      : `从现在起最早约${days}个自然日`;
    return `预计完成：约${detail.estimatedClaims}次领奖、${detail.estimatedResin}树脂、${detail.requiredOpenDays}个开放日；${calendar}（${reason || '按掉落期望估算'}）`;
  }
  return days === 0
    ? `预计完成：当前开放日可刷；实际完成时间取决于剩余树脂（${reason || '按掉落期望估算'}）`
    : `预计完成：从现在起最早约${days}个自然日（${reason || '按掉落期望估算'}）`;
}

function formatItems(items, emptyText) {
  if (!items.length) return `<br>• ${emptyText}`;
  return items.map((item) => `<br>• ${item}`).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
