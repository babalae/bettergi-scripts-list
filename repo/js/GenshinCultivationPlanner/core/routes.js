/**
 * 从 BetterGI 已订阅的 AutoPathing 目录中查找路线。
 * 此模块只做发现和计划，不执行路径。
 */
export function discoverAutoPathingRoutes({ shortages, sourceCandidates = {}, pathing, routeOverrides = {} }) {
  const matched = [];
  const missing = [];
  for (const shortage of shortages) {
    if (!shortage.shortage || shortage.shortage <= 0) continue;
    const candidate = sourceCandidates[shortage.materialId] ?? inferLocalSpecialtyCandidate(shortage);
    if (!candidate || !['localSpecialty', 'monster'].includes(candidate.type)) continue;

    const override = normalizeOverride(routeOverrides[shortage.materialId], candidate, pathing);
    if (override.disabled) {
      missing.push({
        materialId: shortage.materialId, name: candidate.name, type: candidate.type,
        shortage: shortage.shortage, paths: [], source: 'manualOverride', reason: '用户已在路线覆盖中单独禁用',
      });
      continue;
    }
    const paths = override.provided ? override.paths : findSubscribedPaths(candidate, pathing);
    const item = {
      materialId: shortage.materialId,
      name: candidate.name,
      type: candidate.type,
      shortage: shortage.shortage,
      paths,
      source: override.provided ? 'manualOverride' : 'autoDiscovered',
      partyName: override.partyName,
      requiredCharacters: override.requiredCharacters,
    };
    if (paths.length > 0) matched.push(item);
    else missing.push({
      ...item,
      reason: override.error || (override.provided
        ? '用户路线覆盖中没有可读取的 JSON 文件'
        : '未在已订阅的 AutoPathing 路线中找到同名目录'),
    });
  }
  return { matched, missing };
}

/**
 * 已匹配的路线属于可自动执行来源，不应继续在计划和邮件中标记为“手动材料”。
 * 路线不进入树脂周计划，只更新材料状态并从人工待办中移除。
 */
export function applyMatchedRouteSupport(plan, routes) {
  const matchedById = new Map((routes?.matched ?? []).map((route) => [String(route.materialId), route]));
  if (matchedById.size === 0) return plan;

  const markItem = (item) => {
    const route = matchedById.get(String(item.materialId));
    if (!route || !(item.shortage > 0)) return item;
    const reason = route.source === 'manualOverride'
      ? '已匹配用户覆盖的订阅路线'
      : '已自动匹配 BetterGI 订阅路线';
    return {
      ...item,
      status: 'supported',
      reason,
      material: {
        ...item.material,
        status: 'supported',
        executionType: 'route',
        routeType: route.type,
        reason,
      },
    };
  };

  plan.shortages = (plan.shortages ?? []).map(markItem);
  plan.displayShortages = (plan.displayShortages ?? []).map(markItem);
  plan.manualItems = (plan.manualItems ?? []).filter((item) => !matchedById.has(String(item.materialId)));
  return plan;
}

function inferLocalSpecialtyCandidate(shortage) {
  const materialId = String(shortage.materialId);
  const name = shortage.material?.name;
  if (!/^(100|101)/.test(materialId) || !name) return null;
  return {
    materialId,
    name,
    type: 'localSpecialty',
    routeNames: [name],
  };
}

function findSubscribedPaths(candidate, pathing) {
  if (!pathing?.readPaths || !pathing?.isFolder || !pathing?.isFile) return [];
  if (candidate.type === 'localSpecialty') {
    return candidate.routeNames.flatMap((name) => findLocalSpecialtyPaths(name, pathing));
  }
  return unique(candidate.routeNames.flatMap((name) => findFiles(`${'敌人与魔物'}/${name}`, pathing)));
}

function findLocalSpecialtyPaths(name, pathing) {
  return unique(pathing.readPaths('地方特产')
    .filter((path) => pathing.isFolder(path))
    .flatMap((country) => findFiles(`${country}/${name}`, pathing)));
}

function findFiles(folder, pathing, visited = new Set()) {
  // 订阅路线常按“材料/作者/路线.json”分层保存，不能只读取第一层目录。
  if (!pathing.isFolder(folder) || visited.has(folder)) return [];
  visited.add(folder);
  return pathing.readPaths(folder).flatMap((path) => {
    if (pathing.isFile(path) && path.toLowerCase().endsWith('.json')) return [path];
    if (pathing.isFolder(path)) return findFiles(path, pathing, visited);
    return [];
  });
}

function normalizeOverride(override, candidate, pathing) {
  if (override === undefined || override === null) return { provided: false, paths: [], requiredCharacters: [] };
  const config = typeof override === 'object' && !Array.isArray(override)
    ? override
    : { paths: override };
  if (config.type && config.type !== candidate.type) {
    return {
      provided: true, paths: [], requiredCharacters: [],
      error: `路线覆盖类型“${config.type}”与材料类型“${candidate.type}”不一致`,
    };
  }
  const inputs = typeof config.paths === 'string' ? [config.paths] : config.paths;
  const invalid = [];
  const paths = unique((Array.isArray(inputs) ? inputs : []).flatMap((value) => {
    const entry = typeof value === 'string' ? value.trim() : '';
    if (!entry) return [];
    if (pathing?.isFile?.(entry)) {
      if (entry.toLowerCase().endsWith('.json')) return [entry];
      invalid.push(entry);
      return [];
    }
    if (pathing?.isFolder?.(entry)) return findFiles(entry, pathing);
    invalid.push(entry);
    return [];
  }));
  return {
    provided: true,
    paths,
    partyName: typeof config.partyName === 'string' ? config.partyName.trim() : '',
    requiredCharacters: Array.isArray(config.requiredCharacters)
      ? config.requiredCharacters.map((name) => String(name).trim()).filter(Boolean)
      : [],
    disabled: config.enabled === false,
    error: invalid.length > 0 ? `以下覆盖路径不存在或不是 JSON：${invalid.join('、')}` : '',
  };
}

function unique(values) {
  return [...new Set(values)];
}
