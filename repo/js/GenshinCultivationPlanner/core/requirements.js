import { ASCENSION_LEVELS } from './level-state.js';

const TALENT_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * 将角色和武器目标展开为逐项材料需求。
 * 手动目标可用突破标记区分临界等级；未标记的当前等级、目标等级均按突破前解释。
 * 自动档案则使用 BetterGI 识别到的等级上限判断当前突破状态。
 */
export function expandTargets(targets, rulebook) {
  return targets.map((target) => {
    if (target.requirements) return target;
    if (target.kind === 'character') return expandCharacterTarget(target, rulebook.characters ?? {});
    if (target.kind === 'weapon') return expandWeaponTarget(target, rulebook.weapons ?? {});
    throw new Error(`未知目标类型：${target.kind}`);
  });
}

/** 单个目标先完整展开验证，失败时不保留任何部分成本，也不阻断其他目标。 */
export function validateCalculationTargets(targets, rulebook) {
  const validTargets = [];
  const failures = [];
  for (const target of targets) {
    try {
      expandTargets([target], rulebook);
      validTargets.push(target);
    } catch (error) {
      failures.push({ kind: target.kind, name: target.name, component: 'calculation',
        status: 'failed', message: error?.message ?? String(error) });
    }
  }
  return { targets: validTargets, failures };
}

/** 等级上限来自武器星级规则，不用缺失的突破成本反推上限。 */
export function validateWeaponProgress(name, weapon, progress) {
  const maxLevel = [1, 2].includes(weapon.rarity) ? 70 : 90;
  if ([progress.current, progress.target, progress.currentLimit, progress.targetLimit]
    .some((value) => Number.isFinite(value) && value > maxLevel)
    || progress.target === maxLevel && progress.targetAscended === true
    || progress.current === maxLevel && progress.currentAscended === true) {
    throw new Error(`武器“${name}”最高${maxLevel}级，当前或目标等级超出上限；请检查武器识别或手动指定武器`);
  }
}

/** 单独展开突破需求；先合并所有目标，再扣同一份库存，避免共享材料重复抵扣。 */
export function expandLevelTargets(targets, rulebook) {
  return expandTargets(targets.filter((target) => target.requirements || target.level != null)
    .map((target) => ({ ...target, talents: undefined })), rulebook);
}

function expandCharacterTarget(target, characters) {
  const character = characters[target.name];
  if (!character) throw new Error(`规则库中没有角色：${target.name}`);
  const costs = [];
  if (target.level != null) {
    validateLevels(target.level.current, target.level.target, `角色 ${target.name} 等级`);
    appendAscensionCosts(costs, character.ascensionCosts, target.level);
  }
  for (const talentName of ['normal', 'skill', 'burst']) {
    const talent = target.talents?.[talentName];
    if (!talent) continue;
    validateTalentLevels(talent.current, talent.target, `角色 ${target.name} 的${talentName}天赋`);
    appendTalentCosts(costs, character.talentCosts, talent.current, talent.target);
  }
  if (target.level == null && costs.length === 0) throw new Error(`角色 ${target.name} 没有可计算的培养项目`);
  return { id: target.id ?? `character:${target.name}`, requirements: mergeCostItems(costs) };
}

function expandWeaponTarget(target, weapons) {
  const weapon = weapons[target.name];
  if (!weapon) throw new Error(`规则库中没有武器：${target.name}`);
  validateLevels(target.level?.current, target.level?.target, `武器 ${target.name} 等级`);
  validateWeaponProgress(target.name, weapon, target.level);
  const costs = [];
  appendAscensionCosts(costs, weapon.ascensionCosts, target.level);
  return { id: target.id ?? `weapon:${target.name}`, requirements: mergeCostItems(costs) };
}

function appendAscensionCosts(output, costs, progress) {
  const { current: currentLevel, target: targetLevel, currentLimit, targetLimit } = progress;
  const currentAscended = progress.currentAscended === true
    || (Number.isInteger(currentLimit) && currentLimit > currentLevel);
  const targetAscended = progress.targetAscended === true
    || (Number.isInteger(targetLimit) && targetLimit > targetLevel);
  ASCENSION_LEVELS.forEach((level, index) => {
    const currentAlreadyAscended = level === currentLevel && currentAscended;
    const targetIncludesAscension = level < targetLevel
      || (level === targetLevel && targetAscended);
    if (level >= currentLevel && !currentAlreadyAscended && targetIncludesAscension) {
      output.push(...requireCostStage(costs, `ascend${index + 1}`));
    }
  });
}

function appendTalentCosts(output, costs, currentLevel, targetLevel) {
  TALENT_LEVELS.forEach((level) => {
    if (level > currentLevel && level <= targetLevel) output.push(...requireCostStage(costs, `lvl${level}`));
  });
}

function mergeCostItems(costs) {
  const totals = new Map();
  for (const cost of costs) totals.set(String(cost.id), (totals.get(String(cost.id)) ?? 0) + cost.count);
  return [...totals.entries()].map(([materialId, count]) => ({ materialId, count }));
}

function requireCostStage(costs, stage) {
  const items = costs?.[stage];
  if (!Array.isArray(items) || items.length === 0 || items.some((item) => (
    !/^\d+$/.test(String(item?.id)) || !Number.isSafeInteger(item?.count) || item.count <= 0
  ))) throw new Error(`材料映射缺少有效的 ${stage} 阶段成本，不能按零需求计算`);
  return items;
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
