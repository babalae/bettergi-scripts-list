// lib/routes.js —— 纯逻辑：地图追踪路线索引、材料→路线匹配、CD 记录
// 输入是路径字符串数组（由 main.js 用 BGI 的 file API 递归枚举后传入），本模块不碰文件系统。

export const GATHER_CATEGORIES = ['地方特产', '矿物', '食材与炼金'];
export const ENEMY_CATEGORIES = ['敌人与魔物', '锄地专区'];

/** 统一成 / 分隔、去掉 BGI 根目录前缀之前的无关部分 */
export function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/');
}

/** 拆出 AutoPathing 之后的分段，例如 ['地方特产','璃月','霓裳花','作者','x.json'] */
export function segmentsAfterAutoPathing(p) {
  const s = normalizePath(p);
  const i = s.lastIndexOf('/AutoPathing/');
  if (i >= 0) return s.slice(i + '/AutoPathing/'.length).split('/').filter(Boolean);
  // 兼容相对路径 用户目录/AutoPathing/... 或直接 地方特产/璃月/...
  const parts = s.split('/').filter(Boolean);
  const j = parts.indexOf('AutoPathing');
  return j >= 0 ? parts.slice(j + 1) : parts;
}

const isJson = (p) => /\.json$/i.test(p);

/**
 * 建立路线索引
 * @param {string[]} paths AutoPathing 下所有 .json 路径
 * @param {object} opts {excludeKeywords:string[]}
 */
export function indexRoutes(paths, opts = {}) {
  const exclude = opts.excludeKeywords || [];
  const specialty = new Map();   // material -> {region, paths[]}
  const enemies = new Map();     // enemy -> paths[]
  const gatherOther = new Map(); // material -> paths[]（矿物/食材）
  const all = [];

  for (const raw of paths || []) {
    if (!isJson(raw)) continue;
    const seg = segmentsAfterAutoPathing(raw);
    if (seg.length < 3) continue;
    const cat = seg[0];
    if (exclude.some((k) => k && normalizePath(raw).includes(k))) continue;

    if (cat === '地方特产' && seg.length >= 4) {
      const [, region, material] = seg;
      if (!specialty.has(material)) specialty.set(material, { region, paths: [] });
      specialty.get(material).paths.push(normalizePath(raw));
      all.push(raw);
    } else if (ENEMY_CATEGORIES.includes(cat) && seg.length >= 3) {
      const [, enemy] = seg;
      if (!enemies.has(enemy)) enemies.set(enemy, []);
      enemies.get(enemy).push(normalizePath(raw));
      all.push(raw);
    } else if (GATHER_CATEGORIES.includes(cat) && seg.length >= 3) {
      const [, material] = seg;
      if (!gatherOther.has(material)) gatherOther.set(material, []);
      gatherOther.get(material).push(normalizePath(raw));
      all.push(raw);
    }
  }
  return { specialty, enemies, gatherOther, allCount: all.length, fileCount: (paths || []).length };
}

/**
 * 材料 → 路线
 * @param {object} index indexRoutes 的返回
 * @param {string} material
 * @param {object} materialMeta data/materials.json 的条目（含 kind/region）
 * @param {Map|object} monsterMap data/monster-map.json 的 map
 * @returns {{matched:boolean, kind:'specialty'|'monster'|'gather'|'none', paths:string[], enemy?:string, reason?:string}}
 */
export function routesForMaterial(index, material, materialMeta, monsterMap) {
  if (index.specialty.has(material)) {
    const e = index.specialty.get(material);
    return { matched: true, kind: 'specialty', paths: e.paths, region: e.region };
  }
  if (index.gatherOther.has(material)) {
    return { matched: true, kind: 'gather', paths: index.gatherOther.get(material) };
  }
  const meta = materialMeta || {};
  if (meta.kind === 'monster') {
    const entry = monsterMap ? monsterMap[material] : null;
    if (!entry || !entry.enemy) {
      return { matched: false, kind: 'monster', paths: [], reason: '缺少「材料→敌人」映射，请在 data/monster-map.json 补上或配置覆盖' };
    }
    const paths = index.enemies.get(entry.enemy) || [];
    if (!paths.length) {
      return { matched: false, kind: 'monster', paths: [], enemy: entry.enemy, reason: `未订阅敌人「${entry.enemy}」的任何路线` };
    }
    return { matched: true, kind: 'monster', paths, enemy: entry.enemy, confidence: entry.confidence };
  }
  return { matched: false, kind: 'none', paths: [], reason: '没有对应的地图追踪路线' };
}

/** djb2：与「背包材料统计」的路径检测码同源，用于路径改名后仍能匹配历史记录 */
export function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** 路线内容指纹：位置坐标 + 传送点，2 位小数。没有任何坐标时返回 null（不能用空指纹，否则所有路线撞同一个 key） */
export function routeFingerprint(routeObject) {
  const positions = routeObject?.positions || routeObject?.Positions || [];
  if (!Array.isArray(positions) || positions.length === 0) return null;
  const parts = [];
  for (const p of positions) {
    if (!p) continue;
    const x = Number(p.x ?? p.X ?? 0).toFixed(2);
    const y = Number(p.y ?? p.Y ?? 0).toFixed(2);
    parts.push(`${p.type ?? p.Type ?? 0},${x},${y}`);
  }
  if (!parts.length) return null;
  const info = routeObject?.info || routeObject?.Info || {};
  return djb2(parts.join(';') + '|' + (info.name || info.Name || ''));
}

/** CD 记录键：优先用内容指纹（改名不丢），退化到「相对路径」 */
export function routeKey(path, routeObject) {
  try {
    const fp = routeFingerprint(routeObject);
    if (fp !== null && fp !== undefined) return `fp_${fp.toString(16)}`;
  } catch { /* ignore */ }
  const seg = segmentsAfterAutoPathing(path).join('/');
  const s = seg.replace(/\.json$/i, '');
  return `path_${djb2(s).toString(16)}_${s.split('/').pop()}`;
}

export const DEFAULT_CD_HOURS = { specialty: 48, monster: 12, mineral: 72, gather: 24 };

/** 该路线现在能不能跑 */
export function isReady(recordMap, key, cdHours, nowMs = Date.now()) {
  const rec = recordMap?.[key];
  if (!rec || !rec.at) return { ready: true };
  const hours = cdHours ?? 48;
  const next = Number(rec.at) + hours * 3600 * 1000;
  if (nowMs >= next) return { ready: true };
  return { ready: false, nextAt: next, remainMs: next - nowMs };
}

/** 从路线文件名/描述里抠「这一次大概能采多少个」（社区路线普遍写成 -14个 / _12 / （3个）） */
export function parseRouteYield(pathOrName, description) {
  const sources = [String(pathOrName || '').split('/').pop() || '', String(description || '')];
  for (const s of sources) {
    let m = s.match(/(\d{1,3})\s*[个個]/);
    if (m) { const n = Number(m[1]); if (n > 0 && n < 500) return n; }
    m = s.match(/[-_](\d{1,3})(?=\.json$)/);
    if (m) { const n = Number(m[1]); if (n > 0 && n < 500) return n; }
    m = s.match(/[×xX](\d{1,3})/);
    if (m) { const n = Number(m[1]); if (n > 0 && n < 500) return n; }
  }
  return null;
}

/** 从候选路线里挑出可跑的（未在 CD 内），并按「上次执行时间早的优先」排序 */
export function pickRunnable(paths, recordMap, routeLoader, cdHours, limit, nowMs = Date.now(), opts = {}) {
  const out = [];
  const deferred = [];
  const stuckSkipped = [];
  const skipStuckDays = opts.skipStuckDays ?? 3;
  for (const p of paths || []) {
    let obj = null;
    try { obj = routeLoader ? routeLoader(p) : null; } catch { obj = null; }
    const key = routeKey(p, obj);
    const rec = recordMap?.[key];
    // 「卡过/失败过」的路线先关 3 天小黑屋（这是 BGI 不能掐断卡死的替代方案）
    if (rec && rec.stuckAt && skipStuckDays > 0) {
      const until = Number(rec.stuckAt) + skipStuckDays * 86400000;
      if (nowMs < until) { stuckSkipped.push({ path: p, key, until }); continue; }
    }
    const st = isReady(recordMap, key, cdHours, nowMs);
    const yield_ = parseRouteYield(p, obj?.info?.description || obj?.Info?.Description);
    if (st.ready) out.push({ path: p, key, yield: yield_ });
    else deferred.push({ path: p, key, nextAt: st.nextAt, remainMs: st.remainMs });
  }
  const byYield = opts.byYield !== false;
  out.sort((a, b) => {
    if (byYield && (a.yield || 0) !== (b.yield || 0)) return (b.yield || 0) - (a.yield || 0);
    const ta = recordMap?.[a.key]?.at || 0;
    const tb = recordMap?.[b.key]?.at || 0;
    return ta - tb;
  });
  const picked = limit && limit > 0 ? out.slice(0, limit) : out;
  const pickedYield = picked.reduce((s, x) => s + (x.yield || 0), 0);
  const totalYield = out.reduce((s, x) => s + (x.yield || 0), 0);
  return {
    picked, deferred, stuckSkipped,
    remaining: Math.max(0, out.length - picked.length),
    pickedYield, totalYield, runnable: out.length,
  };
}

/** 记录一次「这条路线卡住/失败」：标记 stuckAt，往后 N 天不再排它 */
export function markStuck(recordMap, key, path, costMs) {
  if (!recordMap || !key) return null;
  const prev = recordMap[key] || {};
  recordMap[key] = {
    ...prev,
    at: prev.at || Date.now(),
    path: path || prev.path,
    stuckAt: Date.now(),
    stuckCount: (prev.stuckCount || 0) + 1,
    lastCostMs: costMs || null,
  };
  return recordMap[key];
}

/** 记录一次「这条路线成功跑完」，同时清掉卡死标记 */
export function markDone(recordMap, key, path, costMs, extra = {}) {
  if (!recordMap || !key) return null;
  const prev = recordMap[key] || {};
  recordMap[key] = {
    ...prev,
    at: Date.now(),
    path: path || prev.path,
    costMs: costMs || prev.costMs || null,
    stuckAt: null,
    ...extra,
  };
  return recordMap[key];
}
