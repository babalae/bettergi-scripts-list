const DAILY_RESIN_BUDGET = 180;

// 最高难度培养秘境的社区统计均值，统一折算为最低阶材料等价值。
const DOMAIN_EXPECTED_BASE_YIELD = {
  talentBook: 2.2 + 1.98 * 3 + 0.22 * 9,
  weaponMaterial: 2.2 + 2.418 * 3 + 0.62 * 9 + 0.062 * 27,
};

/**
 * 按用户确认的世界等级 9 机制估算自动培养材料完成时间。
 * Boss 按 3 个保底加 10% 概率第 4 个，即 3.1 个/40 树脂；
 * 培养秘境按最高难度的公开统计均值；周本和圣遗物不显示预计天数。
 */
export function buildCompletionEstimate({ plan, materials, recipes = {}, today, dailyResinBudget = DAILY_RESIN_BUDGET }) {
  const shortages = (plan.displayShortages ?? []).filter((item) => item.shortage > 0);
  if (shortages.length === 0) return { days: 0, reason: '材料已满足', details: [] };

  const groups = new Map();
  for (const shortage of shortages) {
    // 路线发现会为本次计划补充 executionType=route；优先使用计划内的动态来源信息。
    const material = shortage.material ?? materials[shortage.materialId];
    const policy = resolvePolicy(shortage.materialId, material);
    if (!policy) return { days: null, reason: buildUnsupportedReason(material), details: [] };
    const baseMaterialId = getBaseMaterialId(shortage.materialId, recipes);
    const key = `${policy.sourceType}:${policy.sourceName}:${baseMaterialId}`;
    const group = groups.get(key) ?? {
      ...policy,
      baseMaterialId,
      baseShortage: 0,
      materialNames: [],
    };
    group.baseShortage += shortage.shortage * getBaseUnits(shortage.materialId, recipes);
    group.materialNames.push(material.name);
    groups.set(key, group);
  }

  const resinBudget = normalizeDailyResinBudget(dailyResinBudget);
  const details = [...groups.values()].map((group) => buildDetail(group, resinBudget, today));
  return {
    days: Math.max(...details.map((item) => item.estimatedDays)),
    reason: '按世界等级 9 与最高难度秘境掉落期望估算；不考虑双倍掉落',
    details,
  };
}

function resolvePolicy(materialId, material) {
  if (material?.status !== 'supported') return null;
  if (material.executionType === 'boss' && material.bossName) {
    return { sourceType: 'boss', sourceName: material.bossName, expectedBaseYield: 3.1, resinPerClaim: 40, openDays: material.openDays ?? [] };
  }
  if (material.executionType === 'domain' && material.domainName) {
    const materialKind = String(materialId).startsWith('114') ? 'weaponMaterial' : 'talentBook';
    return {
      sourceType: 'domain',
      sourceName: material.domainName,
      expectedBaseYield: DOMAIN_EXPECTED_BASE_YIELD[materialKind],
      resinPerClaim: 20,
      openDays: material.openDays ?? [],
    };
  }
  return null;
}

function buildUnsupportedReason(material) {
  if (material?.executionType === 'weeklyBoss') return '周本材料不显示预计天数';
  if (material?.executionType === 'artifactDomain') return '圣遗物秘境不显示预计天数';
  if (material?.executionType === 'route') return '路线材料完成时间预估尚未接入，暂不显示预计天数';
  return '含未自动执行材料，无法估算全部完成时间';
}

function buildDetail(group, dailyResinBudget, today) {
  const estimatedClaims = Math.ceil(group.baseShortage / group.expectedBaseYield);
  const claimsPerOpenDay = Math.max(1, Math.floor(dailyResinBudget / group.resinPerClaim));
  const requiredOpenDays = Math.ceil(estimatedClaims / claimsPerOpenDay);
  return {
    sourceType: group.sourceType,
    sourceName: group.sourceName,
    materialNames: [...new Set(group.materialNames)],
    baseShortage: group.baseShortage,
    expectedBaseYield: group.expectedBaseYield,
    resinPerClaim: group.resinPerClaim,
    estimatedClaims,
    estimatedResin: estimatedClaims * group.resinPerClaim,
    claimsPerOpenDay,
    requiredOpenDays,
    estimatedDays: daysUntilRuns(group.openDays, today, requiredOpenDays),
  };
}

function normalizeDailyResinBudget(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 20 ? Math.floor(parsed / 20) * 20 : DAILY_RESIN_BUDGET;
}

function getBaseMaterialId(materialId, recipes, seen = new Set()) {
  const id = String(materialId);
  if (seen.has(id)) return id;
  const recipe = recipes[id];
  if (!recipe || recipe.inputs?.length !== 1 || recipe.resultCount !== 1) return id;
  return getBaseMaterialId(recipe.inputs[0].id, recipes, new Set(seen).add(id));
}

function getBaseUnits(materialId, recipes, seen = new Set()) {
  const id = String(materialId);
  if (seen.has(id)) return 1;
  const recipe = recipes[id];
  if (!recipe || recipe.inputs?.length !== 1 || recipe.resultCount !== 1) return 1;
  return recipe.inputs[0].count * getBaseUnits(recipe.inputs[0].id, recipes, new Set(seen).add(id));
}

function daysUntilRuns(openDays, today, requiredRuns) {
  const allowed = new Set(openDays);
  let completedRuns = 0;
  for (let offset = 0; offset < 366; offset += 1) {
    if (!allowed.has((today + offset) % 7)) continue;
    completedRuns += 1;
    if (completedRuns >= requiredRuns) return offset;
  }
  return 365;
}
