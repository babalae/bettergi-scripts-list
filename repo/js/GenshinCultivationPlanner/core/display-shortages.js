/**
 * 为日志、调度和执行生成“实际刷取缺口”。
 *
 * 合成可行性仍由 crafting.farmRequirements 负责；这里把同一条 3:1 链的
 * 总等价值缺口从高阶到低阶拆开，以符合秘境会掉落各阶材料的实际情况。
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

    const requiredValue = sumValue(familyIds, (familyId) => requirements.get(familyId) ?? 0, recipes);
    const ownedValue = sumValue(familyIds, (familyId) => inventory[familyId] ?? 0, recipes);
    let remainingValue = Math.max(0, requiredValue - ownedValue);
    if (remainingValue === 0) continue;

    const highToLow = [...familyIds].sort((left, right) => getBaseUnits(right, recipes) - getBaseUnits(left, recipes));
    for (const familyId of highToLow) {
      const unit = getBaseUnits(familyId, recipes);
      const shortage = Math.floor(remainingValue / unit);
      if (shortage <= 0) continue;
      remainingValue -= shortage * unit;
      result.push(buildShortageItem(familyId, shortage, inventory, materials));
    }
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

function sumValue(ids, getCount, recipes) {
  return ids.reduce((total, id) => total + getCount(id) * getBaseUnits(id, recipes), 0);
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
