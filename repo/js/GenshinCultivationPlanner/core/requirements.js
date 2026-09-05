const ASCENSION_LEVELS = [20, 40, 50, 60, 70, 80];
const TALENT_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * 将角色和武器目标展开为逐项材料需求。
 * 当前等级按游戏中显示的等级解释；若正好位于突破等级，默认尚未完成该档突破。
 * 例如 70 → 90 会计入 70、80 级突破，达到 90 本身不再需要额外突破。
 */
export function expandTargets(targets, rulebook) {
  return targets.map((target) => {
    if (target.requirements) return target;
    if (target.kind === 'character') return expandCharacterTarget(target, rulebook.characters ?? {});
    if (target.kind === 'weapon') return expandWeaponTarget(target, rulebook.weapons ?? {});
    throw new Error(`未知目标类型：${target.kind}`);
  });
}

function expandCharacterTarget(target, characters) {
  const character = characters[target.name];
  if (!character) throw new Error(`规则库中没有角色：${target.name}`);
  validateLevels(target.level?.current, target.level?.target, `角色 ${target.name} 等级`);
  const costs = [];
  appendAscensionCosts(costs, character.ascensionCosts, target.level.current, target.level.target);
  for (const talentName of ['normal', 'skill', 'burst']) {
    const talent = target.talents?.[talentName];
    if (!talent) continue;
    validateTalentLevels(talent.current, talent.target, `角色 ${target.name} 的${talentName}天赋`);
    appendTalentCosts(costs, character.talentCosts, talent.current, talent.target);
  }
  return { id: target.id ?? `character:${target.name}`, requirements: mergeCostItems(costs) };
}

function expandWeaponTarget(target, weapons) {
  const weapon = weapons[target.name];
  if (!weapon) throw new Error(`规则库中没有武器：${target.name}`);
  validateLevels(target.level?.current, target.level?.target, `武器 ${target.name} 等级`);
  const costs = [];
  appendAscensionCosts(costs, weapon.ascensionCosts, target.level.current, target.level.target);
  return { id: target.id ?? `weapon:${target.name}`, requirements: mergeCostItems(costs) };
}

function appendAscensionCosts(output, costs, currentLevel, targetLevel) {
  ASCENSION_LEVELS.forEach((level, index) => {
    if (level >= currentLevel && level < targetLevel) output.push(...(costs[`ascend${index + 1}`] ?? []));
  });
}

function appendTalentCosts(output, costs, currentLevel, targetLevel) {
  TALENT_LEVELS.forEach((level) => {
    if (level > currentLevel && level <= targetLevel) output.push(...(costs[`lvl${level}`] ?? []));
  });
}

function mergeCostItems(costs) {
  const totals = new Map();
  for (const cost of costs) totals.set(String(cost.id), (totals.get(String(cost.id)) ?? 0) + cost.count);
  return [...totals.entries()].map(([materialId, count]) => ({ materialId, count }));
}

function validateLevels(current, target, label) {
  if (!Number.isInteger(current) || !Number.isInteger(target) || current < 1 || target > 90 || current > target) {
    throw new Error(`${label}无效`);
  }
}

function validateTalentLevels(current, target, label) {
  if (!Number.isInteger(current) || !Number.isInteger(target) || current < 1 || target > 10 || current > target) {
    throw new Error(`${label}无效`);
  }
}
