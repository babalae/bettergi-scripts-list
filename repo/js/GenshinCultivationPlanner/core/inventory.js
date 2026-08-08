/**
 * 为背包计数任务划分目标物品所在的背包页。
 * 角色地方特产（100xxx、101xxx）位于“材料”；其余培养材料，
 * 包括怪物掉落、天赋书、首领/周本掉落和武器突破材料，位于“养成道具”。
 */
export function getInventoryTab(materialId) {
  const id = String(materialId);
  return /^(100|101)/.test(id) ? 'Materials' : 'CharacterDevelopmentItems';
}

/**
 * 仅选择本次培养真正需要、且不在排除范围内的材料。
 */
export function buildInventoryScanGroups(materialIds, materials) {
  const groups = {
    CharacterDevelopmentItems: [],
    Materials: [],
  };

  for (const materialId of materialIds) {
    const material = materials[materialId];
    if (!material || material.status === 'excluded') continue;
    const tab = getInventoryTab(materialId);
    groups[tab].push({ materialId: String(materialId), name: material.name });
  }

  return Object.fromEntries(Object.entries(groups).filter(([, items]) => items.length > 0));
}

/**
 * 将 BetterGI 返回的名称->数量映射合入库存。
 * BetterGI 批量任务会直接省略未找到的名称；本项目将其视为库存 0。
 * -2 表示已找到图标但数量 OCR 失败，此时保留未确认状态。
 */
export function applyInventoryScanResult(inventory, scanItems, counts, options = {}) {
  const nextInventory = { ...inventory };
  const scanByName = new Map(scanItems.map((item) => [item.name, item]));
  const failedNames = [];
  const decreasedNames = [];

  for (const [name, item] of scanByName) {
    const count = counts?.[name];
    if (count === -2) {
      failedNames.push(name);
      continue;
    }
    const scannedCount = count === undefined || count === -1 ? 0 : count;
    const previousCount = nextInventory[item.materialId];
    if (options.preserveDecreases === true
      && Number.isInteger(previousCount)
      && scannedCount < previousCount) {
      decreasedNames.push(name);
      continue;
    }
    nextInventory[item.materialId] = scannedCount;
  }

  return { inventory: nextInventory, failedNames, decreasedNames };
}
