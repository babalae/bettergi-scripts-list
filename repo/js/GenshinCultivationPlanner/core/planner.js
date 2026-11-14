import { calculateShortages, mergeRequirements } from './calculator.js';
import { buildCraftingPlan, collectCraftingMaterialIds } from './crafting.js';
import { buildDisplayShortages } from './display-shortages.js';
import { expandTargets, expandLevelTargets } from './requirements.js';
import { buildPlan } from './scheduler.js';

/**
 * 纯函数入口，供 BetterGI 脚本与 Node 测试共同使用。
 */
export function createPlan({ targets, inventory, materials, recipes = {}, rulebook, today, levelFirst = true }) {
  const requirements = mergeRequirements(expandTargets(targets, rulebook ?? {}));
  const normalizedInventory = normalizeInventory(inventory, materials);
  const craftableRequirements = new Map([...requirements].filter(([materialId]) => materials[materialId]?.status !== 'excluded'));
  const crafting = buildCraftingPlan(craftableRequirements, normalizedInventory, recipes);
  const farmRequirements = new Map(crafting.farmRequirements);
  for (const [materialId, count] of requirements) {
    if (materials[materialId]?.status === 'excluded') farmRequirements.set(materialId, count);
  }
  const shortages = calculateShortages(farmRequirements, normalizedInventory, materials);
  const levelRequirements = mergeRequirements(expandLevelTargets(targets, rulebook ?? {}));
  const levelCrafting = buildCraftingPlan(new Map([...levelRequirements]
    .filter(([id]) => materials[id]?.status !== 'excluded')), normalizedInventory, recipes);
  const levelMissingIds = new Set(calculateShortages(levelCrafting.farmRequirements, normalizedInventory, materials)
    .filter((item) => item.shortage > 0 || item.status === 'unknown').map((item) => item.materialId));
  // 展示缺口可能换成同系列的其他等级；整条合成系列继承仍未满足的突破用途。
  const familyHasLevelShortage = (id) => collectCraftingMaterialIds(new Map([[id, 1]]), recipes)
    .some((member) => levelMissingIds.has(member))
    || [...levelMissingIds].some((member) => collectCraftingMaterialIds(new Map([[member, 1]]), recipes).includes(id));
  const displayShortages = buildDisplayShortages(requirements, normalizedInventory, recipes, materials)
    .map((item) => ({ ...item, cultivationPriority: levelFirst && !familyHasLevelShortage(item.materialId) ? 1 : 0 }));
  return {
    today,
    levelFirst,
    levelRequirements: Object.fromEntries(levelRequirements),
    requirements: Object.fromEntries(requirements),
    farmRequirements: Object.fromEntries(farmRequirements),
    crafting,
    shortages,
    displayShortages,
    ...buildPlan(displayShortages, today),
  };
}

function normalizeInventory(inventory, materials) {
  const idByName = new Map(Object.entries(materials).map(([id, material]) => [material.name, id]));
  const normalized = {};
  for (const [key, count] of Object.entries(inventory)) {
    const materialId = materials[key] ? key : idByName.get(key);
    if (!materialId) continue;
    normalized[materialId] = count;
  }
  return normalized;
}
