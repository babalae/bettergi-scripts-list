const STATUS_SUPPORTED = 'supported';
const STATUS_WAITING_OPEN = 'waiting_open';

/**
 * 生成七天计划和当天队列。输入中的 shortage 必须来自 calculateShortages。
 *
 * @param {Array<object>} shortages
 * @param {number} today 0=周日，1=周一，…，6=周六
 * @returns {{weeklyPlan: Array<Array<object>>, todayQueue: Array<object>, manualItems: Array<object>}}
 */
export function buildPlan(shortages, today) {
  if (!Number.isInteger(today) || today < 0 || today > 6) {
    throw new Error('星期必须为 0 到 6 的整数');
  }

  const weeklyPlan = Array.from({ length: 7 }, () => []);
  const manualItems = [];

  for (const item of shortages) {
    if (item.status === 'unknown' || item.status === 'manual' || item.status === 'excluded') {
      manualItems.push(item);
      continue;
    }

    if (item.material?.executionType === 'weeklyBoss') {
      manualItems.push({
        ...item,
        status: 'manual',
        reason: '周本材料当前版本需手动获取',
      });
      continue;
    }

    if (!item.shortage || item.shortage <= 0) {
      continue;
    }

    const openDays = item.material?.openDays ?? [0, 1, 2, 3, 4, 5, 6];
    const task = toTask(item);
    for (const day of openDays) {
      weeklyPlan[day].push({ ...task, day });
    }
  }

  for (let day = 0; day < weeklyPlan.length; day += 1) {
    weeklyPlan[day] = mergeDomainTasks(weeklyPlan[day]);
    weeklyPlan[day].sort(compareTasks);
  }

  const todayQueue = weeklyPlan[today].map((task) => ({
    ...task,
    status: task.status === STATUS_SUPPORTED ? STATUS_SUPPORTED : STATUS_WAITING_OPEN,
  }));

  return { weeklyPlan, todayQueue, manualItems };
}

/**
 * 从今天开始按自然周顺序展示可刷取策略。仅输出已进入周计划的树脂任务，
 * 让用户能看到“今天做什么、下次开放日做什么”。
 */
export function buildWeeklyStrategy(weeklyPlan, today) {
  if (!Array.isArray(weeklyPlan) || weeklyPlan.length !== 7) return [];
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return Array.from({ length: 7 }, (_, offset) => (today + offset) % 7)
    .map((day) => ({
      day,
      label: offsetLabel(day, weekdayNames[day], today),
      tasks: weeklyPlan[day] ?? [],
    }))
    .filter((item) => item.tasks.length > 0);
}

/**
 * 世界 Boss 只能消耗原粹树脂。只要当天仍有可执行任务，秘境不得抢占执行顺序。
 */
export function hasPendingOriginalResinTask(tasks) {
  return tasks.some((task) => (
    task.status === STATUS_SUPPORTED
    && task.executionType === 'boss'
  ));
}

function toTask(item) {
  const material = item.material;
  return {
    materialId: item.materialId,
    shortage: item.shortage,
    executionType: material.executionType,
    domainName: material.domainName,
    bossName: material.bossName,
    sundaySelectedValue: material.sundaySelectedValue,
    materialName: material.name,
    priority: material.priority ?? 0,
    status: material.status,
    limited: Boolean(material.limited),
    reason: item.reason,
  };
}

/**
 * 同一秘境同日掉落多个阶级时，只保留一条进入秘境的任务。
 * 各材料缺口附在 materials 字段中，供执行后按实际奖励统一复盘。
 */
function mergeDomainTasks(tasks) {
  const grouped = new Map();
  for (const task of tasks) {
    const targetName = task.executionType === 'boss' ? task.bossName : task.domainName;
    if (!['domain', 'boss'].includes(task.executionType) || !targetName) {
      grouped.set(`single:${task.materialId}`, task);
      continue;
    }
    const key = `${task.executionType}:${targetName}`;
    const existing = grouped.get(key);
    const material = { materialId: task.materialId, materialName: task.materialName, shortage: task.shortage };
    if (existing) {
      existing.materials.push(material);
      existing.priority = Math.max(existing.priority, task.priority);
      existing.sundaySelectedValue ??= task.sundaySelectedValue;
      continue;
    }
    grouped.set(key, {
      ...task,
      materialId: key,
      materialName: targetName,
      materials: [material],
    });
  }
  return [...grouped.values()];
}

function compareTasks(left, right) {
  const typePriority = {
    boss: 3,
    domain: 2,
    artifactDomain: 1,
  };
  const leftTypePriority = typePriority[left.executionType] ?? 0;
  const rightTypePriority = typePriority[right.executionType] ?? 0;
  if (leftTypePriority !== rightTypePriority) {
    return rightTypePriority - leftTypePriority;
  }
  if (left.executionType === 'domain' && left.limited !== right.limited) {
    return left.limited ? -1 : 1;
  }
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }
  return left.materialId.localeCompare(right.materialId, 'zh-Hans-CN');
}

function offsetLabel(day, weekdayName, today) {
  if (day === today) return `今天（${weekdayName}）`;
  return weekdayName;
}
