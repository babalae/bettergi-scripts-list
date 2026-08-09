import { collectCraftingMaterialIds } from './crafting.js';

/** 将已发现路线转换为可执行配置；路径必须是 AutoPathing 根目录下的相对 JSON 路径。 */
export function buildRouteExecutionPlan(routes, settings, recipes = {}) {
  const groupedByRoute = new Map();
  for (const route of routes?.matched ?? []) {
    if (!isRouteTypeEnabled(route.type, settings)) continue;
    const partyName = route.partyName?.trim() || (route.type === 'localSpecialty'
      ? settings.gatheringTeamName?.trim()
      : settings.monsterTeamName?.trim());
    if (!partyName) {
      const label = route.type === 'localSpecialty' ? '采集队伍' : '怪物材料队伍';
      throw new Error(`路线“${route.name}”未配置${label}`);
    }
    if (!Array.isArray(route.paths) || route.paths.length === 0) {
      throw new Error(`路线“${route.name}”没有可执行的 JSON 文件`);
    }
    const pathsByNormalizedName = new Map();
    for (const path of route.paths) {
      const normalizedPath = path.replaceAll('/', '\\').toLowerCase();
      if (!pathsByNormalizedName.has(normalizedPath)) pathsByNormalizedName.set(normalizedPath, path);
    }
    const normalizedPaths = [...pathsByNormalizedName.keys()].sort();
    const key = `${route.type}\u0000${partyName}\u0000${normalizedPaths.join('\u0001')}`;
    if (!groupedByRoute.has(key)) {
      groupedByRoute.set(key, {
        type: route.type,
        partyName,
        paths: [...pathsByNormalizedName.values()],
        materialMap: new Map(),
        requiredCharacters: new Set(),
      });
    }
    const group = groupedByRoute.get(key);
    for (const name of route.requiredCharacters ?? []) group.requiredCharacters.add(name);
    group.materialMap.set(route.materialId, {
      materialId: route.materialId,
      name: route.name,
      shortage: route.shortage,
    });
  }

  return [...groupedByRoute.values()].map((group) => {
    const materials = [...group.materialMap.values()];
    const requirements = new Map(materials.map((item) => [item.materialId, 1]));
    return {
      type: group.type,
      partyName: group.partyName,
      paths: group.paths,
      materials,
      name: materials.map((item) => item.name).join('、'),
      scanMaterialIds: collectCraftingMaterialIds(requirements, recipes),
      requiredCharacters: [...group.requiredCharacters],
    };
  });
}

function isRouteTypeEnabled(routeType, settings) {
  const splitSetting = routeType === 'localSpecialty'
    ? settings.gatheringRouteExecutionEnabled
    : settings.monsterRouteExecutionEnabled;
  return splitSetting === undefined
    ? settings.routeExecutionEnabled === true
    : splitSetting === true;
}

/** 已订阅路线必须从 User/AutoPathing 根目录执行，不能按当前 JS 脚本目录解析。 */
export async function runSubscribedRouteFile(pathing, routePath) {
  if (!pathing?.isFile?.(routePath)) {
    throw new Error(`已订阅路线文件不存在：${routePath}`);
  }
  if (typeof pathing.runFileFromUser !== 'function') {
    throw new Error('当前 BetterGI 不支持从 User/AutoPathing 执行订阅路线');
  }
  await pathing.runFileFromUser(routePath);
}

/** 将整次运行结束时的背包总差值回填到路线记录。 */
export function applyFinalRouteInventoryGains(records, before, after) {
  return records.map((record) => {
    const routeMaterials = (record.materials ?? []).map((item) => {
      const previous = before[item.materialId];
      const current = after[item.materialId];
      const gained = Number.isInteger(previous) && Number.isInteger(current) && current > previous
        ? current - previous
        : 0;
      return { ...item, gained };
    });
    const gained = Object.fromEntries(routeMaterials.map((item) => [item.name, item.gained]));
    if (record.status === 'failed') return { ...record, materials: routeMaterials, gained };
    const confirmedGain = routeMaterials.some((item) => item.gained > 0);
    return {
      ...record,
      status: confirmedGain ? 'completed' : 'unconfirmed',
      reason: confirmedGain ? null : '全部任务结束后的背包复核未确认到材料增长',
      materials: routeMaterials,
      gained,
    };
  });
}
