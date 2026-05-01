const REFRESH_DATA_PATH = "local/refresh_records.json";
const FALLBACK_DURATION = 120;

/**
 * 从本地文件加载刷新记录数据
 *
 * @returns {Object} 刷新记录对象，文件不存在或读取失败返回空对象
 */
function loadRefreshData() {
  try {
    const raw = file.readTextSync(REFRESH_DATA_PATH);
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * 将刷新记录数据保存到本地文件
 *
 * @param {Object} data - 刷新记录对象
 */
function saveRefreshData(data) {
  file.writeTextSync(REFRESH_DATA_PATH, JSON.stringify(data, null, 2));
}

/**
 * 清理过期路线记录，删除文件已不存在的路线对应的记录
 *
 * @param {Object} data - 刷新记录对象
 * @param {string[]} routePaths - 当前实际存在的路线文件路径数组
 * @returns {Object} 清理后的刷新记录对象
 */
function cleanupStaleRecords(data, routePaths) {
  const pathSet = new Set(routePaths);
  const keys = Object.keys(data);
  let removed = 0;
  for (const key of keys) {
    if (!pathSet.has(key)) {
      delete data[key];
      removed++;
    }
  }
  if (removed > 0) {
    log.info(`清理了 ${removed} 条过期路线记录`);
    saveRefreshData(data);
  }
  return data;
}

/**
 * 记录路线完成时间与运行时长
 * 兼容旧版纯时间戳格式，自动迁移为对象格式
 *
 * @param {string} routePath - 路线文件路径
 * @param {Object} data - 刷新记录对象
 * @param {number} duration - 本次运行时长（秒），0 或负数时不记录时长
 */
function recordRoute(routePath, data, duration) {
  const existing = data[routePath];
  if (existing && typeof existing === 'object') {
    existing.t = Date.now();
    if (duration > 0) existing.d = Math.round(duration);
  } else {
    data[routePath] = { t: Date.now(), d: duration > 0 ? Math.round(duration) : null };
  }
  saveRefreshData(data);
}

/**
 * 判断路线的矿石是否已刷新
 * 刷新规则：取上次运行时间最近的 UTC 16:00（每日重置），加上 refreshDays 天
 *
 * @param {string} routePath - 路线文件路径
 * @param {Object} data - 刷新记录对象
 * @param {number} refreshDays - 矿石刷新天数，默认 3 天
 * @returns {boolean} 矿石是否已刷新，记录不存在视为已刷新
 */
function isRouteReady(routePath, data, refreshDays = 3) {
  const record = data[routePath];
  const lastRun = record?.t || (typeof record === 'number' ? record : null);
  if (!lastRun) return true;

  const t = lastRun / 1000;
  let t0 = Math.floor(t / 86400) * 86400 + 57600;
  if (t0 > t) {
    t0 -= 86400;
  }
  const respawnTime = t0 + 86400 * refreshDays;
  return respawnTime < Date.now() / 1000;
}

/**
 * 过滤出已刷新可运行的路线
 *
 * @param {string[]} routePaths - 路线文件路径数组
 * @param {Object} data - 刷新记录对象
 * @param {number} refreshDays - 矿石刷新天数，默认 3 天
 * @returns {string[]} 已刷新的路线文件路径数组
 */
function filterRunnableRoutes(routePaths, data, refreshDays = 3) {
  const runnable = [];
  for (const routePath of routePaths) {
    if (isRouteReady(routePath, data, refreshDays)) {
      runnable.push(routePath);
    } else {
      const fileName = routePath.split('\\').pop();
      log.info(`跳过未刷新路线: ${fileName}`);
    }
  }
  return runnable;
}

/**
 * 获取路线的历史运行时长
 *
 * @param {string} routePath - 路线文件路径
 * @param {Object} data - 刷新记录对象
 * @returns {number|null} 历史运行时长（秒），无记录返回 null
 */
function getRouteDuration(routePath, data) {
  const record = data[routePath];
  if (!record) return null;
  if (typeof record === 'object' && record.d) return record.d;
  return null;
}

/**
 * 估算多条路线的总运行时长
 * 有历史记录的路线使用实际时长，无记录的按 2 分钟计算
 *
 * @param {string[]} routePaths - 路线文件路径数组
 * @param {Object} data - 刷新记录对象
 * @returns {number} 估算总时长（秒）
 */
function estimateRoutesDuration(routePaths, data) {
  let total = 0;
  for (const routePath of routePaths) {
    const d = getRouteDuration(routePath, data);
    total += d !== null ? d : FALLBACK_DURATION;
  }
  return total;
}

/**
 * 将秒数格式化为可读时长
 * 不足 1 小时显示 "xx分xx秒"，超过 1 小时显示 "xx小时xx分xx秒"
 *
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长字符串
 */
function formatDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}小时${mm}分${ss}秒`;
  return `${mm}分${ss}秒`;
}

export { loadRefreshData, saveRefreshData, cleanupStaleRecords, recordRoute, isRouteReady, filterRunnableRoutes, getRouteDuration, estimateRoutesDuration, formatDuration };
