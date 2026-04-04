var printVersion = async function () {
  try {
    let currentVersion = JSON.parse(file.readTextSync("manifest.json")).version;
    log.info(`当前版本为：{x}`, currentVersion);

    let checkVersionEnabled = true;
    try {
      let settingsContent = file.readTextSync("settings.json");
      let settingsData = JSON.parse(settingsContent);
      if (settingsData.checkVersionEnabled !== undefined) {
        checkVersionEnabled = settingsData.checkVersionEnabled;
      }
    } catch (e) {
    }

    if (!checkVersionEnabled) {
      log.info("版本检查已禁用，跳过检查");
      return;
    }

    log.info("正在检查远程版本...");
    let response = await http.request(
      "GET",
      "https://raw.githubusercontent.com/dcvsd24/Character-Cultivation-Pro-Test/main/manifest.json"
    );

    let remoteData = JSON.parse(response.body);
    let latestVersion = remoteData.version;

    if (!latestVersion) {
      log.warn("远程版本号获取失败，跳过版本检查");
      log.info(`==== 不影响脚本正常运行 ====`);
      return;
    }

    if (needUpdate(currentVersion, latestVersion)) {
      log.info("=".repeat(20));
      log.info(" ");
      log.info("{text}:{v}", "发现新版本！", latestVersion);
      Utils.addNotification("发现新版本！", latestVersion);
      log.info(" ");
      log.info("=".repeat(20));
      log.info(`更新方式：软件左侧菜单 -> 全自动 -> JS脚本  -> 脚本仓库 -> 更新仓库`);
      log.info(`更新完毕后 {text1} 在左侧找到 {txt2} -> 上方点击 {txt3} -> 找到本脚本并点击 -> 右侧点击{txt4}`,
        "打开仓库",
        "Javascript 脚本",
        "已订阅",
        "再次订阅"
      );
      await sleep(7000);
    } else {
      log.info("当前已是最新版本");
    }
  } catch (error) {
    if (error.message.includes("不允许使用HTTP请求")) {
      log.warn("获取版本号失败，请在调度器中右键本脚本 -> 修改通用设置 -> JS HTTP权限-> 禁用改为启用");
      log.info(`==== 不影响脚本正常运行 ====`);
    } else if (error.message.includes("A task was canceled")) {
    } else {
      log.warn(`获取新版本号出错，跳过检查: ${error.message}`);
      log.info(`==== 不影响脚本正常运行 ====`);
    }
  }
};

var needUpdate = function (currentVersion, latestVersion) {
  const currentParts = currentVersion.split('.').map(Number);
  const latestParts = latestVersion.split('.').map(Number);

  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (currentPart < latestPart) {
      return true;
    } else if (currentPart > latestPart) {
      return false;
    }
  }

  return false;
};