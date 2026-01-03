/**
 * 检查是否需要更新版本
 * @param {string} currentVersion 当前版本号 (如 "1.2.3")
 * @param {string} latestVersion 最新版本号 (如 "1.2.4")
 * @returns {boolean} 返回是否需要更新: true表示需要更新, false表示不需要更新
 */
var needUpdate = function (currentVersion, latestVersion) {
  // 将版本号字符串分割成数字数组
  const currentParts = currentVersion.split('.').map(Number);
  const latestParts = latestVersion.split('.').map(Number);

  // 获取较长的版本号长度
  const maxLength = Math.max(currentParts.length, latestParts.length);

  // 逐位比较版本号
  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0; // 如果不存在则默认为0
    const latestPart = latestParts[i] || 0; // 如果不存在则默认为0

    if (currentPart < latestPart) {
      return true; // 当前版本小于最新版本，需要更新
    } else if (currentPart > latestPart) {
      return false; // 当前版本大于最新版本，不需要更新
    }
  }

  return false; // 两个版本号相等，不需要更新
};

var printVersion = async function () {
  try {
    let currentVersion = JSON.parse(file.readTextSync("manifest.json")).version;
    log.info(`当前版本为：{x}`, currentVersion);

    let response = await http.request(
      "GET",
      "https://cnb.cool/bettergi/bettergi-scripts-list/-/git/raw/release/repo/js/AutoCommission/manifest.json"
    );

    let latestVersion = JSON.parse(response.body).version;

    if (needUpdate(currentVersion, latestVersion)) {
      log.info("=".repeat(20));
      log.info(" ");
      log.info("{text}:{v}", "发现新版本！", latestVersion);
      log.info(" ");
      log.info("=".repeat(20));
      log.info(`更新方式：软件左侧菜单 -> 全自动 -> JS脚本  -> 脚本仓库 -> 更新仓库`);
      log.info(`更新完毕后 {text1} 在左侧找到 {txt2} -> 上方点击 {txt3} -> 找到本脚本并点击 -> 右侧点击{txt4}`,
        "打开仓库",
        "Javascript 脚本",
        "已订阅",
        "再次订阅"
      );
      await sleep(10000);
    }
  } catch (error) {
    if (error.message.includes("不允许使用HTTP请求")) {
      log.warn("获取版本号失败，请在调度器中右键本脚本 -> 修改通用设置 -> JS HTTP权限-> 禁用改为启用")
      log.info(`==== 不影响脚本正常运行 ====`);
    } else if (error.message.includes("A task was canceled")) {
      // pass
    } else {
      log.error(`获取新版本号出错:${error}`);
      log.info(`==== 不影响脚本正常运行 ====`);
    }
    await sleep(5000);
  }
}
