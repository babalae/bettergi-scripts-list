import { checkVersion } from "./utils/version.js";
import { checkAvatar } from "./utils/avatar.js";
import { getRoutes } from "./utils/routes.js";
import { loadRefreshData, cleanupStaleRecords, recordRoute, filterRunnableRoutes } from "./utils/refresh.js";

(async function () {
  const version = getVersion()

  if (!checkVersion(version)) {
    log.warn(`当前 BetterGI 版本(${version})低于最低要求(${minBgiVersion})，内部算法缺少优化，出现异常为正常情况`)
  }

  setGameMetrics(1920, 1080, 1);
  await genshin.returnMainUi();

  const partyName = settings.partyName || "";

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

  const refreshData = loadRefreshData();
  cleanupStaleRecords(refreshData, allRoutes);

  const routes = filterRunnableRoutes(allRoutes, refreshData);
  if (routes.length === 0) {
    log.info("所有路线均未刷新，无需运行");
    return;
  }

  log.info(`将运行 ${routes.length}/${allRoutes.length} 条路线（${allRoutes.length - routes.length} 条未刷新已跳过）`);

  dispatcher.addTimer(new RealtimeTimer("AutoPick"));

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    log.info(`路线 ${i + 1}/${routes.length}: ${route.split('\\').pop()}`);
    await runRoute(route);
    await sleep(10);
    recordRoute(route, refreshData);

    if (i < routes.length - 1) {
      await sleep(2000);
    }
  }

  log.info("所有路线运行完成");
})();
