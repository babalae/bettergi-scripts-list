import { formatProfileEntry } from './profile.js';

const MAX_SUMMARY_LENGTH = 500;

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
  const manualWeekly = (plan.manualItems ?? [])
    .filter((item) => item.material?.executionType === 'weeklyBoss' && item.shortage > 0)
    .map((item) => `${materials[item.materialId]?.name ?? item.material?.name ?? item.materialId}×${item.shortage}`);
  const estimate = formatEstimate(estimateDays, estimateReason, estimateDetails);
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
  const profileItems = (plan.profileSnapshot?.entries ?? []).map(formatProfileEntry);
  const action = !executionEnabled
    ? '本次未执行'
    : execution?.status === 'failed'
      ? `执行失败：${execution.reason || '未提供失败原因'}`
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
      : execution?.status === 'skipped'
        ? `未执行：${execution.reason || '没有可执行任务'}`
        : taskResult.status;
  const confirmedGainFallback = execution?.task?.executionType === 'artifactDomain'
    ? '圣遗物收益不纳入培养材料计数'
    : execution?.task
      ? '未确认目标材料增长'
      : '无';
  const sections = [
    '<b>养成材料调度摘要</b>',
    `<br><b>本次状态</b>：${action}`,
    buildProfileSection(profileItems),
    `<br><br><b>本次任务</b>${formatItems(taskResult.tasks, '无树脂任务')}`,
    `<br><br><b>确认收益</b>${formatItems(gains, confirmedGainFallback)}`,
    `<br><br><b>路线结果</b>${formatItems(routeResults, '本次无路线任务')}`,
    manualWeekly.length > 0
      ? `<br><br><b>需手动获取的周本材料</b>${formatItems(manualWeekly, '无')}`
      : '',
    `<br><br><b>仍缺材料</b>${formatItems(missing, '无')}`,
    `<br><br><b>下一步候选</b>${formatItems(planned, '无')}`,
    `<br><br><b>本周循环策略</b>${formatItems(weekly, '本周无可执行树脂任务')}`,
    `<br><br><b>${estimate}</b>`,
  ];
  let summary = '';
  for (const section of sections) {
    if (!section) continue;
    if (summary.length + section.length > MAX_SUMMARY_LENGTH) {
      const suffix = '<br>…其余详见运行记录';
      return summary.length + suffix.length <= MAX_SUMMARY_LENGTH ? `${summary}${suffix}` : summary;
    }
    summary += section;
  }
  return summary;
}

/** 档案按完整条目截断，绝不切断一条角色/武器信息或 HTML 标签。 */
function buildProfileSection(items) {
  if (items.length === 0) return '<br><br><b>当前养成状态</b><br>• 未提供档案';
  const prefix = '<br><br><b>当前养成状态</b>';
  const lines = [];
  for (let count = 0; count < items.length; count += 1) {
    const line = `<br>• ${items[count]}`;
    const remaining = items.length - count - 1;
    const marker = remaining > 0 ? `<br>• 另 ${remaining} 项见运行记录` : '';
    // 为标题、状态和后续省略提示预留空间；超长档案也只按完整条目加入。
    if (prefix.length + lines.join('').length + line.length + marker.length > 320) {
      if (remaining + 1 > 0) lines.push(`<br>• 另 ${remaining + 1} 项见运行记录`);
      break;
    }
    lines.push(line);
  }
  return `${prefix}${lines.join('')}`;
}

function formatTaskResult(execution) {
  const taskResults = execution?.tasks?.length > 0
    ? execution.tasks.filter((item) => item.evidence?.taskInvoked === true)
    : execution?.task ? [{ task: execution.task, status: execution.status }] : [];
  const tasks = taskResults.map((item) => `${formatTask(item.task)}（${formatStatus(item.status)}）`);
  if (taskResults.length === 0) return { status: '没有调用树脂任务', tasks };
  if (execution?.status === 'failed') return { status: `任务失败：${execution.reason || '未知原因'}`, tasks };
  if (execution?.status === 'unconfirmed') return { status: '任务调用结束；背包未确认材料增长', tasks };
  if (taskResults.every((item) => item.task.executionType === 'artifactDomain')) {
    return { status: '圣遗物任务调用结束；收益不纳入培养材料统计', tasks };
  }
  if (execution.inventoryChecked === true && execution.appliedGains === true) {
    return { status: '已完成并由背包差值确认收益', tasks };
  }
  return { status: '任务调用结束；未确认是否成功领奖', tasks };
}

function formatStatus(status) {
  const labels = { completed: '完成', skipped: '跳过', failed: '失败', unconfirmed: '收益未确认' };
  return labels[status] ?? status ?? '未知';
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
  if (!Number.isFinite(days)) return `预计完成：${reason || '等待累计实际掉落数据'}`;
  if (details.length === 1) {
    const detail = details[0];
    const calendar = days === 0 ? '最早今天' : `从现在起最早约${days}个自然日`;
    return `预计完成：约${detail.estimatedClaims}次领奖、${detail.estimatedResin}树脂、${detail.requiredOpenDays}个开放日；${calendar}（${reason || '按掉落期望估算'}）`;
  }
  return days === 0
    ? `预计完成：最早今天（${reason || '按掉落期望估算'}）`
    : `预计完成：从现在起最早约${days}个自然日（${reason || '按掉落期望估算'}）`;
}

function formatItems(items, emptyText) {
  if (!items.length) return `<br>• ${emptyText}`;
  return items.map((item) => `<br>• ${item}`).join('');
}
