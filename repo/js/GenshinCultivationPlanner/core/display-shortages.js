/**
 * 为日志、调度和执行生成“实际刷取缺口”。
 *
 * 先保留低阶需求，再把新增的高阶等价缺口拆开；高阶库存不能抵扣低阶需求。
 */
export function buildDisplayShortages(requirements, inventory, recipes, materials) {
  const result = [];
  const visited = new Set();
  const orderedIds = [...requirements.keys()]
    .sort((left, right) => getBaseUnits(right, recipes) - getBaseUnits(left, recipes));

  for (const materialId of orderedIds) {
    const id = String(materialId);
    if (visited.has(id)) continue;
    const familyIds = collectFamilyIds(id, recipes);
    familyIds.forEach((familyId) => visited.add(familyId));
    const familyRequirements = familyIds.filter((familyId) => requirements.has(familyId));
    const hasExcluded = familyIds.some((familyId) => materials[familyId]?.status === 'excluded');
    const hasUnknownInventory = familyIds.some((familyId) => inventory[familyId] === undefined || inventory[familyId] === null);

    if (hasExcluded || hasUnknownInventory) {
      for (const familyId of familyRequirements) {
        const required = requirements.get(familyId) ?? 0;
        if (required <= 0) continue;
        const item = buildDirectItem(familyId, required, inventory, materials);
        if (item.status === 'excluded' || item.status === 'unknown' || item.shortage > 0) result.push(item);
      }
      continue;
    }

    const lowToHigh = [...familyIds].sort((left, right) => getBaseUnits(left, recipes) - getBaseUnits(right, recipes));
    const familyShortages = new Map();
    let requiredValue = 0;
    let ownedValue = 0;
    let missingValue = 0;
    for (const [index, familyId] of lowToHigh.entries()) {
      const unit = getBaseUnits(familyId, recipes);
      requiredValue += (requirements.get(familyId) ?? 0) * unit;
      ownedValue += inventory[familyId] * unit;
      // 低阶已经缺少的部分不能被后面出现的高阶库存抹掉。
      let additional = Math.max(0, requiredValue - ownedValue - missingValue);
      missingValue += additional;
      for (let tier = index; tier >= 0; tier--) {
        const id = lowToHigh[tier];
        const value = getBaseUnits(id, recipes);
        const count = Math.floor(additional / value);
        if (count > 0) familyShortages.set(id, (familyShortages.get(id) ?? 0) + count);
        additional -= count * value;
      }
    }
    for (const [id, count] of familyShortages) result.push(buildShortageItem(id, count, inventory, materials));
  }

  return result.sort((left, right) => left.materialId.localeCompare(right.materialId, 'zh-Hans-CN'));
}

function collectFamilyIds(materialId, recipes, ids = new Set()) {
  const id = String(materialId);
  if (ids.has(id)) return [...ids];
  ids.add(id);
  for (const input of recipes[id]?.inputs ?? []) collectFamilyIds(input.id, recipes, ids);
  return [...ids];
}

function getBaseUnits(materialId, recipes, seen = new Set()) {
  const id = String(materialId);
  if (seen.has(id)) return 1;
  const recipe = recipes[id];
  if (!recipe || recipe.inputs?.length !== 1 || recipe.resultCount !== 1) return 1;
  const input = recipe.inputs[0];
  return input.count * getBaseUnits(input.id, recipes, new Set(seen).add(id));
}

function buildShortageItem(materialId, shortage, inventory, materials) {
  const material = materials[materialId];
  return {
    materialId,
    required: shortage,
    owned: inventory[materialId] ?? 0,
    shortage,
    status: material?.status ?? 'unknown',
    reason: material?.reason ?? '尚未配置已验证的执行适配',
    material,
  };
}

function buildDirectItem(materialId, required, inventory, materials) {
  const material = materials[materialId];
  if (material?.status === 'excluded') {
    return { materialId, required, owned: inventory[materialId] ?? null, shortage: null, status: 'excluded', reason: material.reason, material };
  }
  if (inventory[materialId] === undefined || inventory[materialId] === null) {
    return { materialId, required, owned: null, shortage: null, status: 'unknown', reason: '尚未确认背包库存', material };
  }
  return buildShortageItem(materialId, Math.max(0, required - inventory[materialId]), inventory, materials);
}
