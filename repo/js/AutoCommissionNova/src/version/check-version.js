/**
 * 版本检查模块
 * 检查远程仓库是否有新版本
 */

/**
 * 比较版本号是否需要更新
 * @param {string} currentVersion - 当前版本号
 * @param {string} latestVersion - 最新版本号
 * @returns {boolean}
 */
function needUpdate(currentVersion, latestVersion) {
    const currentParts = currentVersion.split(".").map(Number);
    const latestParts = latestVersion.split(".").map(Number);
    const maxLength = Math.max(currentParts.length, latestParts.length);
    for (let i = 0; i < maxLength; i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;
        if (currentPart < latestPart) return true;
        if (currentPart > latestPart) return false;
    }
    return false;
}

/**
 * 检查并打印版本信息
 */
export async function checkVersion() {
    try {
        const currentVersion = JSON.parse(file.readTextSync("manifest.json")).version;
        log.info("当前版本为：{x}", currentVersion);

        const response = await http.request(
            "GET",
            "https://cnb.cool/bettergi/bettergi-scripts-list/-/git/raw/release/repo/js/AutoCommissionNova/manifest.json"
        );
        const latestVersion = JSON.parse(response.body).version;

        if (needUpdate(currentVersion, latestVersion)) {
            log.info("=".repeat(20));
            log.info(" ");
            log.info("{text}:{v}", "发现新版本！", latestVersion);
            log.info(" ");
            log.info("=".repeat(20));
            log.info("更新方式：软件左侧菜单 -> 全自动 -> JS脚本 -> 脚本仓库 -> 更新仓库");
            log.info("更新完毕后 {text1} 在左侧找到 {txt2} -> 上方点击 {txt3} -> 找到本脚本并点击 -> 右侧点击{txt4}",
                "打开仓库", "Javascript 脚本", "已订阅", "再次订阅");
            await sleep(10000);
        }
    } catch (error) {
        if (error.message.includes("不允许使用HTTP请求")) {
            log.warn("获取版本号失败，请在调度器中右键本脚本 -> 修改通用设置 -> JS HTTP权限-> 禁用改为启用");
            log.info("==== 不影响脚本正常运行 ====");
        } else if (error.message.includes("A task was canceled")) {
            // pass
        } else {
            log.error("获取新版本号出错:" + error);
            log.info("==== 不影响脚本正常运行 ====");
        }
        await sleep(5000);
    }
}
