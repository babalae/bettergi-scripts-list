/** 校验已知版本拒绝记录，防止名称或版本写错后静默失效。 */
export function validateBossCatalogCompatibility(catalog) {
  const names = new Set(catalog.bosses ?? []);
  for (const [name, record] of Object.entries(catalog.compatibility ?? {})) {
    if (!names.has(name) || !Array.isArray(record.unsupportedVersions)
      || record.unsupportedVersions.length === 0
      || record.unsupportedVersions.some((version) => !/^\d+\.\d+\.\d+$/.test(version))
      || !record.reason?.trim()) {
      throw new Error(`Boss 兼容记录无效：“${name}”`);
    }
  }
}

/** 保留掉落来源映射，仅将当前版本明确不支持的首领改为手动获取。 */
export function applyBossCompatibility(materials, catalog, version, rejectedBossNames = []) {
  validateBossCatalogCompatibility(catalog);
  const normalizedVersion = String(version ?? '').trim().replace(/^v/, '');
  const rejected = new Set(rejectedBossNames);
  const result = { ...materials };
  for (const [id, material] of Object.entries(materials)) {
    if (material.executionType !== 'boss') continue;
    const record = catalog.compatibility?.[material.bossName];
    const blocked = record?.unsupportedVersions.includes(normalizedVersion);
    if (!blocked && !rejected.has(material.bossName)) continue;
    result[id] = {
      ...material,
      status: 'manual',
      reason: `BetterGI ${normalizedVersion || '当前版本'}暂不支持“${material.bossName}”，该材料需手动获取；升级后重新判断`,
    };
  }
  return result;
}
