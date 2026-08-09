import { calculateShortages, mergeRequirements } from './calculator.js';
import { buildCraftingPlan } from './crafting.js';
import { buildDisplayShortages } from './display-shortages.js';
import { expandTargets } from './requirements.js';
import { buildPlan } from './scheduler.js';

/**
 * 纯函数入口，供 BetterGI 脚本与 Node 测试共同使用。
 */
export function createPlan({ targets, inventory, materials, recipes = {}, rulebook, today, profileSnapshot = null }) {
  const requirements = mergeRequirements(expandTargets(targets, rulebook ?? {}));
  const normalizedInventory = normalizeInventory(inventory, materials);
  const craftableRequirements = new Map([...requirements].filter(([materialId]) => materials[materialId]?.status !== 'excluded'));
  const crafting = buildCraftingPlan(craftableRequirements, normalizedInventory, recipes);
  const farmRequirements = new Map(crafting.farmRequirements);
  for (const [materialId, count] of requirements) {
    if (materials[materialId]?.status === 'excluded') farmRequirements.set(materialId, count);
  }
  const shortages = calculateShortages(farmRequirements, normalizedInventory, materials);
  const displayShortages = buildDisplayShortages(requirements, normalizedInventory, recipes, materials);
  return {
    today,
    targets,
    profileSnapshot,
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
