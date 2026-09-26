/**
 * 以执行前后背包差值作为实际收益的最终依据。
 * 数量未确认时不猜测为零，也不记录虚假的收益。
 */
export function buildTrackedInventoryGains(before, after, trackedMaterialIds, materials) {
  const gains = {};
  for (const materialId of trackedMaterialIds) {
    const previous = before[materialId];
    const current = after[materialId];
    if (!Number.isInteger(previous) || !Number.isInteger(current) || current <= previous) continue;
    const name = materials[materialId]?.name ?? materialId;
    gains[name] = current - previous;
  }
  return gains;
}
