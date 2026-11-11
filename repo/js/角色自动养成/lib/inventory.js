// lib/inventory.js —— 背包数量读取（BGI 内置 CountInventoryItem）
// 原则：只跑一次，不重试、不回退；识别不到就记「未知」，交给上层跳过（不存在无限识别）
import { warn } from './env.js';

export const COUNT_MISSING = -1;
export const COUNT_FAILED = -2;

function runCountTask(config) {
  return dispatcher.runTask(new SoloTask('CountInventoryItem', config));
}

function toCounts(requested, dict) {
  const counts = {};
  const unknown = [];
  for (const name of requested) {
    const raw = dict ? dict[name] : undefined;
    // BGI 只返回找到的物品：字典里没有 = 背包里没有 = 0（不是识别失败）
    if (raw === undefined || raw === null) { counts[name] = 0; continue; }
    const v = Number(raw);
    if (v === COUNT_FAILED || Number.isNaN(v)) { unknown.push(name); counts[name] = null; }
    else if (v === COUNT_MISSING) counts[name] = 0;
    else counts[name] = v;
  }
  return { counts, unknown };
}

/**
 * 读一批材料数量。**只执行一次**，不做重试、不做页签回退。
 * @param {string[]} itemNames 材料全名
 * @param {object} opts { gridScreenName: 'CharacterDevelopmentItems'|'Materials' }
 */
export async function countItems(itemNames, opts = {}) {
  const names = [...new Set((itemNames || []).filter(Boolean))];
  if (!names.length) return { counts: {}, unknown: [], source: 'empty' };
  const config = { itemNames: names, stopByItemSort: true };
  if (opts.gridScreenName) config.gridScreenName = opts.gridScreenName;
  try {
    const dict = await runCountTask(config);
    const { counts, unknown } = toCounts(names, dict);
    return { counts, unknown, source: opts.gridScreenName || 'auto' };
  } catch (e) {
    const msg = String(e?.message || e);
    if (/截图器未初始化|未初始化/.test(msg)) throw new Error('BGI 截图器未初始化（游戏窗口丢了？）：' + msg);
    warn(`背包统计失败（${opts.gridScreenName || 'auto'}）：${msg}`);
    const counts = {};
    for (const n of names) counts[n] = null;
    return { counts, unknown: names, source: 'failed' };
  }
}
