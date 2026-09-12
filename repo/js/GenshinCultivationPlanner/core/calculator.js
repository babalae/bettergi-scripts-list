/**
 * 将已展开的材料需求合并为总需求。
 * 角色、武器等级与天赋的具体展开逻辑将在规则库接入后实现。
 *
 * @param {Array<{id: string, requirements: Array<{materialId: string, count: number}>}>} targets
 * @returns {Map<string, number>}
 */
export function mergeRequirements(targets) {
  const totals = new Map();

  for (const target of targets) {
    for (const requirement of target.requirements ?? []) {
      validateCount(requirement.count, `目标 ${target.id} 的材料数量`);
      totals.set(
        requirement.materialId,
        (totals.get(requirement.materialId) ?? 0) + requirement.count,
      );
    }
  }

  return totals;
}

/**
 * 根据总需求、库存与材料定义生成缺口表。
 * 未确认库存不会被当作零库存，也不会被调度器视为已完成。
 *
 * @param {Map<string, number>} requirements
 * @param {Record<string, number>} inventory
 * @param {Record<string, object>} materials
 * @returns {Array<object>}
 */
export function calculateShortages(requirements, inventory, materials) {
  return [...requirements.entries()]
    .map(([materialId, required]) => {
      const material = materials[materialId];
      if (!material) {
        return {
          materialId,
          required,
          owned: null,
          shortage: null,
          status: 'unknown',
          reason: '材料规则库缺少定义',
        };
      }

      if (material.status === 'excluded') {
        return {
          materialId,
          required,
          owned: inventory[materialId] ?? null,
          shortage: null,
          status: 'excluded',
          reason: material.reason ?? '不在自动刷取范围内',
          material,
        };
      }

      const owned = inventory[materialId];
      if (owned === undefined || owned === null) {
        return {
          materialId,
          required,
          owned: null,
          shortage: null,
          status: 'unknown',
          reason: '尚未确认背包库存',
          material,
        };
      }

      validateCount(owned, `材料 ${materialId} 的库存数量`);
      const shortage = Math.max(0, required - owned);
      return {
        materialId,
        required,
        owned,
        shortage,
        status: shortage === 0 ? 'complete' : material.status,
        reason: shortage === 0 ? '库存已满足需求' : material.reason ?? null,
        material,
      };
    })
    .sort((left, right) => left.materialId.localeCompare(right.materialId, 'zh-Hans-CN'));
}

function validateCount(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}必须是非负整数`);
  }
}
