import { checkVersion } from "./utils/version.js";
import { checkAvatar } from "./utils/avatar.js";
import { getRoutes, filterByTags, filterByRegion } from "./utils/routes.js";
import { loadRefreshData, cleanupStaleRecords, recordRoute, filterRunnableRoutes, getRouteDuration, estimateRoutesDuration, formatDuration } from "./utils/refresh.js";

(async function () {
  const version = getVersion()
  const minVersion = '0.60.2'

  if (!checkVersion(version, minVersion)) {
    log.warn(`当前 BetterGI 版本(${version})低于最低要求(${minVersion})，内部算法缺少优化，出现异常为正常情况`)
  }

  setGameMetrics(1920, 1080, 1);
  await genshin.returnMainUi();

  const partyName = settings.partyName || "";
  const excludeOreTypes = Array.from(settings.excludeOreTypes || []);
  const excludeRegions = Array.from(settings.excludeRegions || []);
  const skipBattleRoutes = settings.skipBattleRoutes === true;

  // 切换队伍
  async function switchParty(partyName) {
    if (!partyName) {
      return;
    }
    try {
      partyName = partyName.trim();
      log.info("切换队伍: " + partyName);
      if (!await genshin.switchParty(partyName)) {
        log.info("切换失败，前往七天神像重试");
        await genshin.tpToStatueOfTheSeven();
        await genshin.switchParty(partyName);
      }
    } catch {
      log.error("队伍切换失败");
      notification.error(`队伍切换失败`);
      await genshin.returnMainUi();
    }
  }

  // 运行单条路线
  async function runRoute(routePath) {
    try {
      await pathingScript.runFile(routePath);
    } catch (err) {
      log.error(`路线运行失败 ${routePath}:`, err);
    }
  }

  // 主逻辑
  await switchParty(partyName);

  if (!checkAvatar("莉奈娅")) {
    log.error("队伍角色检查失败 - 未找到莉奈娅，脚本终止");
    return;
  }

  const allRoutes = await getRoutes();
  if (allRoutes.length === 0) {
    log.error("未找到任何路线文件！请确保paths目录下存在路线文件。");
    return;
  }

  let routes = allRoutes;

  routes = filterByRegion(routes, excludeRegions);
  if (excludeRegions.length > 0 && routes.length < allRoutes.length) {
    log.info(`地区筛选：排除 ${allRoutes.length - routes.length} 条路线`);
  }

  routes = filterByTags(routes, excludeOreTypes);
  if (excludeOreTypes.length > 0 && routes.length < allRoutes.length) {
    log.info(`矿物筛选：排除 ${allRoutes.length - routes.length} 条路线`);
  }

  if (skipBattleRoutes) {
    routes = filterByTags(routes, ["战斗"]);
    if (routes.length < allRoutes.length) {
      log.info(`跳过战斗路线：排除 ${allRoutes.length - routes.length} 条路线`);
    }
  }

  const refreshData = loadRefreshData();
  cleanupStaleRecords(refreshData, routes);

  const runnableRoutes = filterRunnableRoutes(routes, refreshData);
  if (runnableRoutes.length === 0) {
    log.info("所有路线均未刷新，无需运行");
    return;
  }

  log.info(`将运行 ${runnableRoutes.length}/${allRoutes.length} 条路线`);

  dispatcher.addTimer(new RealtimeTimer("AutoPick"));

  for (let i = 0; i < runnableRoutes.length; i++) {
    const route = runnableRoutes[i];
    const fileName = route.split('\\').pop();

    const remaining = runnableRoutes.slice(i);
    const remainingEst = estimateRoutesDuration(remaining, refreshData);
    const thisRouteEst = getRouteDuration(route, refreshData);

    if (thisRouteEst !== null) {
      log.info(`路线 ${i + 1}/${runnableRoutes.length}: ${fileName}（预计 ${formatDuration(thisRouteEst)}，剩余 ${formatDuration(remainingEst)}）`);
    } else {
      log.info(`路线 ${i + 1}/${runnableRoutes.length}: ${fileName}（预计 ${formatDuration(remainingEst)}）`);
    }

    const startTime = Date.now();
    await runRoute(route);
    await sleep(10);
    const duration = (Date.now() - startTime) / 1000;
    recordRoute(route, refreshData, duration);

    if (i < runnableRoutes.length - 1) {
      await sleep(2000);
    }
  }

  log.info("所有路线运行完成");
})();
