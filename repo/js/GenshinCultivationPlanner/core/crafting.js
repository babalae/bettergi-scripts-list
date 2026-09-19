/**
 * 收集目标材料及其所有可合成的低阶材料，供背包读取使用。
 */
export function collectCraftingMaterialIds(requirements, recipes) {
  const ids = new Set();
  const visit = (materialId) => {
    const id = String(materialId);
    if (ids.has(id)) return;
    ids.add(id);
    for (const input of recipes[id]?.inputs ?? []) visit(input.id);
  };
  for (const materialId of requirements.keys()) visit(materialId);
  return [...ids];
}

/**
 * 将高阶目标按基础配方逐级展开，仅采用确定的 3:1 等消耗。
 * 角色天赋带来的概率返还或额外产出不提前计入，实际收益由下一次背包读取反映。
 * 仅在整条合成链库存都已确认时使用合成结果；否则保留原始需求，避免凭空假定库存为零。
 */
export function buildCraftingPlan(requirements, inventory, recipes) {
  const scanMaterialIds = collectCraftingMaterialIds(requirements, recipes);
  const unknownMaterialIds = scanMaterialIds.filter((id) => inventory[id] === undefined || inventory[id] === null);
  if (unknownMaterialIds.length > 0) {
    return {
      scanMaterialIds,
      unknownMaterialIds,
      craftPlan: [],
      farmRequirements: new Map(requirements),
    };
  }

  const needs = new Map(requirements);
  const available = new Map(Object.entries(inventory).map(([id, count]) => [String(id), count]));
  const craftPlan = [];
  const orderedIds = [...scanMaterialIds].sort((left, right) => getRecipeDepth(right, recipes) - getRecipeDepth(left, recipes));

  for (const materialId of orderedIds) {
    const required = needs.get(materialId) ?? 0;
    if (required <= 0) continue;
    const owned = available.get(materialId) ?? 0;
    const remaining = Math.max(0, required - owned);
    needs.set(materialId, 0);
    const recipe = recipes[materialId];
    if (!recipe || remaining === 0) {
      // 基础材料交由缺口计算器扣除库存，避免在此处与后续计算重复扣除。
      needs.set(materialId, recipe ? 0 : required);
      continue;
    }

    const craftCount = Math.ceil(remaining / recipe.resultCount);
    craftPlan.push({ materialId, craftCount, produced: craftCount * recipe.resultCount, inputs: recipe.inputs });
    for (const input of recipe.inputs) {
      needs.set(String(input.id), (needs.get(String(input.id)) ?? 0) + input.count * craftCount);
    }
  }

  return { scanMaterialIds, unknownMaterialIds: [], craftPlan, farmRequirements: needs };
}

function getRecipeDepth(materialId, recipes, seen = new Set()) {
  if (seen.has(materialId)) return 0;
  const recipe = recipes[materialId];
  if (!recipe) return 0;
  const nextSeen = new Set(seen).add(materialId);
  return 1 + Math.max(0, ...recipe.inputs.map((input) => getRecipeDepth(String(input.id), recipes, nextSeen)));
}
