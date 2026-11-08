/** 只读取当前共享模板格式；不再携带旧版重复费用表的兼容分支。 */
export function readRulebook(data) {
  if (data?.schemaVersion !== 2 || !Array.isArray(data.costTemplates)) {
    throw new Error('规则库格式不匹配，请完整更新脚本与数据文件');
  }
  function readCosts(reference, label) {
    const template = data.costTemplates[reference?.template];
    if (!Number.isInteger(reference?.template) || reference.template < 0 || !template
      || !Array.isArray(reference.materials)) throw new Error(`规则库${label}缺少有效费用模板`);
    return Object.fromEntries(Object.entries(template).map(([stage, rows]) => {
      if (!Array.isArray(rows) || rows.length === 0) throw new Error(`规则库${label}的${stage}费用无效`);
      return [stage, rows.map((row) => {
        if (!Array.isArray(row) || row.length !== 2 || !Number.isInteger(row[0]) || row[0] < 0
          || !Number.isSafeInteger(row[1]) || row[1] < 0) throw new Error(`规则库${label}的${stage}费用无效`);
        const id = reference.materials[row[0]];
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`规则库${label}的${stage}材料引用无效`);
        return { id, count: row[1] };
      })];
    }));
  }
  const characters = Object.fromEntries(Object.entries(data.characters).map(([name, entry]) => [name, {
    id: entry.id, ascensionCosts: readCosts(entry.ascensionCosts, name),
    talentCosts: readCosts(entry.talentCosts, name),
  }]));
  const weapons = Object.fromEntries(Object.entries(data.weapons).map(([name, entry]) => [name, {
    id: entry.id, rarity: entry.rarity, ascensionCosts: readCosts(entry.ascensionCosts, name),
  }]));
  return { characters, weapons };
}
