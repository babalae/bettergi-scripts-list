function isVersionSupported(version, minVersion = '0.60.2') {
  const normalizeVersion = (v) => {
    const match = String(v).match(/^(\d+\.\d+\.\d+)/)
    return match ? match[1] : '0.0.0'
  }

  const currentParts = normalizeVersion(version).split('.').map(Number)
  const minParts = normalizeVersion(minVersion).split('.').map(Number)

  const maxLength = Math.max(currentParts.length, minParts.length)

  while (currentParts.length < maxLength) currentParts.push(0)
  while (minParts.length < maxLength) minParts.push(0)

  for (let i = 0; i < maxLength; i++) {
    if (currentParts[i] > minParts[i]) return true
    if (currentParts[i] < minParts[i]) return false
  }

  return true
}

(async function () {
  const version = getVersion()
  let isSupported = isVersionSupported(version)
  if (!isSupported) {
    log.error(`当前 BetterGI 版本(${version})低于最低要求(0.60.2)，无法运行此脚本`)
    return
  }

  log.warn('当前最新测试版bgi暂未发布，算法逻辑不是最新版，出现异常为正常情况')

  setGameMetrics(1920, 1080, 1);

  const partyName = settings.partyName || "";

  // 检测队伍是否包含莉奈娅
  function checkLinneaInParty() {
    const avatars = getAvatars();
    if (!avatars || avatars.length < 1) return false;
    for (let i = 0; i < avatars.length; i++) {
      if (avatars[i] === "莉奈娅") return true;
    }
    log.error("队伍角色检查失败 - 未找到莉奈娅");
    return false;
  }

  // 切换队伍
  async function switchParty(partyName) {
    partyName = partyName.trim();
    if (!partyName) {
      await genshin.returnMainUi();
      return;
    }
    try {
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

  // 读取文件夹中的json文件
  async function readRouteFiles(folderPath) {
    const folderStack = [folderPath];
    const files = [];

    while (folderStack.length > 0) {
      const currentPath = folderStack.pop();
      const filesInFolder = file.ReadPathSync(currentPath);
      const subFolders = [];

      for (const filePath of filesInFolder) {
        if (file.IsFolder(filePath)) {
          subFolders.push(filePath);
        } else if (filePath.endsWith(".json")) {
          files.push({
            fullPath: filePath,
            fileName: filePath.split('\\').pop(),
          });
        }
      }

      for (let i = subFolders.length - 1; i >= 0; i--) {
        folderStack.push(subFolders[i]);
      }
    }

    return files;
  }

  // 获取路线文件列表
  async function getRoutes() {
    try {
      const pathings = await readRouteFiles("paths");
      return pathings.map(p => p.fullPath);
    } catch (err) {
      log.error("获取路线文件时出错:", err);
      return [];
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

  if (!checkLinneaInParty()) {
    log.error("队伍角色检查失败，脚本终止");
    return;
  }

  const routes = await getRoutes();
  if (routes.length === 0) {
    log.error("未找到任何路线文件！请确保paths目录下存在路线文件。");
    return;
  }

  log.info(`将运行 ${routes.length} 条路线`);

  dispatcher.addTimer(new RealtimeTimer("AutoPick"));

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    log.info(`路线 ${i + 1}/${routes.length}: ${route.split('\\').pop()}`);
    await runRoute(route);

    if (i < routes.length - 1) {
      await sleep(2000);
    }
  }

  log.info("所有路线运行完成");
})();
