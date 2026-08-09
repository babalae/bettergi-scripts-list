const DEFAULT_MIN_SAMPLES = 2;

/** 根据同一路线文件集合的历史背包正增长，估计还需完整运行多少轮。 */
export function buildRouteYieldEstimate({ route, materialId, shortage, history, minSamples = DEFAULT_MIN_SAMPLES }) {
  const signature = buildRouteSignature(route);
  if (!signature) return unavailable('当前路线没有可用于匹配历史的 JSON 文件集合');
  const samples = [];
  for (const run of history ?? []) {
    for (const record of run.execution?.routes ?? []) {
      if (record.status !== 'completed' || buildRouteSignature(record) !== signature) continue;
      const material = (record.materials ?? []).find((item) => String(item.materialId) === String(materialId));
      if (Number.isFinite(material?.gained) && material.gained > 0) samples.push(material.gained);
    }
  }
  if (samples.length < minSamples) {
    return unavailable(`相同路线仅有 ${samples.length} 个有效收益样本，至少需要 ${minSamples} 个`, { signature, sampleCount: samples.length });
  }
  const averageYield = samples.reduce((total, value) => total + value, 0) / samples.length;
  if (!(averageYield > 0)) return unavailable('相同路线历史收益为零，无法估算', { signature, sampleCount: samples.length });
  return {
    available: true,
    signature,
    sampleCount: samples.length,
    averageYield,
    estimatedRuns: Math.ceil(shortage / averageYield),
    shortage,
    reason: '按相同 JSON 路线集合的历史背包实际增长均值估算',
  };
}

export function buildRouteSignature(route) {
  const paths = (route?.paths ?? []).map((item) => typeof item === 'string' ? item : item?.path)
    .filter(Boolean)
    .map((item) => String(item).replaceAll('/', '\\').toLowerCase())
    .sort();
  if (paths.length === 0) return '';
  return `${route.type ?? 'route'}:${[...new Set(paths)].join('|')}`;
}

function unavailable(reason, details = {}) {
  return { available: false, reason, sampleCount: 0, ...details };
}
