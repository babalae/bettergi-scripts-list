// lib/store.js —— 数据加载、文件读写、路线枚举、状态持久化
import { info, warn } from './env.js';

export function readText(path, fallback = null) {
  try { return file.readTextSync(path); } catch { return fallback; }
}
export function writeText(path, text) {
  try { file.writeTextSync(path, text); return true; } catch (e) { warn(`写文件失败 ${path}: ${e?.message || e}`); return false; }
}
export function readJson(path, fallback = null) {
  const t = readText(path, null);
  if (t === null || t === undefined) return fallback;
  try { return JSON.parse(t); } catch (e) { warn(`JSON 解析失败 ${path}: ${e?.message || e}`); return fallback; }
}
export function writeJson(path, obj) { return writeText(path, JSON.stringify(obj, null, 1)); }

export function isFolder(p) { try { return !!file.isFolder(p); } catch { return false; } }

export function listDir(p) {
  try { if (typeof file.readPathSync === 'function') return file.readPathSync(p) || []; } catch { /* next */ }
  try { if (typeof file.ReadPathSync === 'function') return file.ReadPathSync(p) || []; } catch { /* next */ }
  return [];
}

/** 递归枚举目录下所有 .json（带上限，防呆） */
export function listJsonRecursive(root, limit = 20000) {
  const out = [];
  const stack = [root];
  while (stack.length && out.length < limit) {
    const dir = stack.pop();
    let entries = [];
    try { entries = listDir(dir); } catch { entries = []; }
    for (const e of entries) {
      const p = typeof e === 'string' ? e : e?.path || e?.Path || '';
      if (!p) continue;
      let folder = false;
      try { folder = !!file.isFolder(p); } catch { folder = !/\.json$/i.test(p); }
      if (folder) stack.push(p);
      else if (/\.json$/i.test(p)) out.push(p.replace(/\\/g, '/'));
    }
  }
  return out;
}

/** 地图追踪根目录：真机上 file API 被限制在脚本目录内，优先用 pathingScript 专用接口 */
export function findAutoPathingRoot() {
  try { if (typeof pathingScript !== 'undefined' && pathingScript && typeof pathingScript.readPathSync === 'function') return '(pathingScript)'; } catch { /* noop */ }
  for (const c of ['User/AutoPathing', '../../AutoPathing', 'AutoPathing']) {
    if (isFolder(c)) return c;
  }
  return null;
}

/** 用 pathingScript 递归枚举地图追踪下的 json（返回相对 AutoPathing 的路径） */
export function listAutoPathingJson(limit = 20000) {
  const out = [];
  const walk = (dir) => {
    if (out.length >= limit) return;
    let entries = [];
    try { entries = pathingScript.readPathSync(dir) || []; } catch { return; }
    for (const e of entries) {
      const p = (typeof e === 'string' ? e : e?.path || '').replace(/\\/g, '/');
      if (!p) continue;
      let isDir = false;
      try { isDir = !!pathingScript.isFolder(p); } catch { isDir = !/\.json$/i.test(p); }
      if (isDir) walk(p);
      else if (/\.json$/i.test(p)) out.push(p);
    }
  };
  walk('./');
  return out;
}

/** 读地图追踪下的 json（相对路径） */
export function readAutoPathingText(p) {
  try { return pathingScript.readTextSync(p); } catch { return null; }
}

export function loadData() {
  const characters = readJson('data/characters.json', null);
  const weapons = readJson('data/weapons.json', null);
  const materials = readJson('data/materials.json', null);
  const monsterMap = readJson('data/monster-map.json', { map: {} });
  const bossMap = readJson('data/boss-map.json', { map: {} });
  if (!characters || !weapons || !materials) throw new Error('data/*.json 缺失，脚本目录不完整');
  const monster = (monsterMap && monsterMap.map) || {};
  const boss = (bossMap && bossMap.map) || {};

  // 用户覆盖表（优先级最高）：record/boss-map-extra.json / record/monster-map-extra.json
  const bossExtra = readJson('record/boss-map-extra.json', null) || {};
  for (const [k, v] of Object.entries(bossExtra.map || {})) {
    if (v && typeof v === 'string') boss[k] = { boss: v, confidence: 'user' };
    else if (v && v.boss) boss[k] = { boss: v.boss, confidence: 'user' };
  }
  const monsterExtra = readJson('record/monster-map-extra.json', null) || {};
  for (const [k, v] of Object.entries(monsterExtra.map || {})) {
    const enemy = typeof v === 'string' ? v : v?.enemy;
    if (enemy) monster[k] = { enemy, confidence: 'user' };
  }

  return {
    characters: characters.characters || {},
    weapons: weapons.weapons || {},
    materials: materials.materials || {},
    monsterMap: monster,
    bossMap: boss,
  };
}

const STATE = 'record/state.json';

export function loadState() {
  return readJson(STATE, { routes: {}, history: [], lastRun: null }) || { routes: {}, history: [], lastRun: null };
}

// ===== CD 记录分片（照 CD-Aware-AutoGather 的做法：一条路线跑完立刻写、按材料分文件）=====
const CD_DIR = 'record/cd';
const SAFE = (s) => String(s || 'misc').replace(/[\\/:*?"<>|\s]/g, '_').slice(0, 40);

/** 从路线路径推断分片名：地方特产/璃月/霓裳花 → 霓裳花；敌人与魔物/骗骗花 → 骗骗花 */
export function shardNameForPath(p) {
  const seg = String(p || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const i = seg.indexOf('AutoPathing');
  const rest = i >= 0 ? seg.slice(i + 1) : seg;
  if (rest[0] === '地方特产') return SAFE(rest[2] || 'misc');
  if (rest[0] === '敌人与魔物') return SAFE(rest[1] || 'misc');
  if (rest.length >= 2) return SAFE(rest[1]);
  return 'misc';
}

/** 读所有分片并合并（分片缺失/损坏只丢那一片） */
export function loadRouteShards() {
  const merged = {};
  const files = listDir(CD_DIR);
  let shards = 0;
  for (const f of files) {
    const p = typeof f === 'string' ? f : f?.path || '';
    if (!/\.json$/i.test(p)) continue;
    const o = readJson(p, null);
    if (o && typeof o === 'object') { Object.assign(merged, o); shards++; }
  }
  return { routes: merged, shards };
}

/** 只写某个 key 所属的分片（崩溃最多丢这一片） */
export function saveRouteShard(routes, key, routePath) {
  const shard = shardNameForPath(routePath);
  const sub = {};
  for (const [k, v] of Object.entries(routes || {})) {
    if (!v) continue;
    if (v.shard === shard || k === key) sub[k] = { ...v, shard };
  }
  return writeJson(`${CD_DIR}/${shard}.json`, sub);
}

/** 全量重写所有分片（迁移/校准后用） */
export function saveAllRouteShards(routes) {
  const groups = {};
  for (const [k, v] of Object.entries(routes || {})) {
    if (!v) continue;
    const shard = v.shard || shardNameForPath(v.path || '');
    (groups[shard] = groups[shard] || {})[k] = { ...v, shard };
  }
  let n = 0;
  for (const [shard, sub] of Object.entries(groups)) { writeJson(`${CD_DIR}/${shard}.json`, sub); n++; }
  return n;
}

export function saveState(s) {
  // routes 单独分片存放，state.json 只留轻量元数据（避免整份丢/整份重写）
  const { routes, ...meta } = s || {};
  return writeJson(STATE, meta);
}

export function readPlanFile() {
  const t = readText('record/plan.txt', '');
  return t || '';
}
