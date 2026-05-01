const REFRESH_DATA_PATH = "local/refresh_records.json";

function loadRefreshData() {
  try {
    const raw = file.readTextSync(REFRESH_DATA_PATH);
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveRefreshData(data) {
  file.writeTextSync(REFRESH_DATA_PATH, JSON.stringify(data, null, 2));
}

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

function recordRoute(routePath, data) {
  data[routePath] = Date.now();
  saveRefreshData(data);
}

function isRouteReady(routePath, data, refreshDays = 3) {
  const lastRun = data[routePath];
  if (!lastRun) return true;

  const t = lastRun / 1000;
  let t0 = Math.floor(t / 86400) * 86400 + 57600;
  if (t0 > t) {
    t0 -= 86400;
  }
  const respawnTime = t0 + 86400 * refreshDays;
  return respawnTime < Date.now() / 1000;
}

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

export { loadRefreshData, saveRefreshData, cleanupStaleRecords, recordRoute, isRouteReady, filterRunnableRoutes };
