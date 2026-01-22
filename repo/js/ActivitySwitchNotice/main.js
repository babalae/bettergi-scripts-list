let manifest = {};
let manifest_json = "manifest.json";
let configSettings = undefined

/**
 * 初始化设置函数
 * 从配置文件中读取设置信息并返回
 * @returns {Object} 返回解析后的JSON设置对象
 */
async function initSettings() {
    // 默认设置文件路径
    let settings_ui = "settings.json";
    try {
        // 读取并解析manifest.json文件
        manifest = JSON.parse(file.readTextSync(manifest_json));
        // 调试日志：输出manifest内容
        log.debug("manifest={key}", manifest);
        // 调试日志：输出manifest中的settings_ui配置
        log.debug("settings_ui={key}", manifest.settings_ui);
        log.info(`|脚本名称:{name},版本:{version}`, manifest.name, manifest.version);
        if (manifest.bgi_version) {
            log.info(`|最小可执行BGI版本:{bgi_version}`, manifest.bgi_version);
        }
        log.info(`|脚本作者:{authors}\n`, manifest.authors.map(a => a.name).join(","));
        // 更新settings_ui变量为manifest中指定的路径
        settings_ui = manifest.settings_ui
    } catch (error) {
        // 捕获并记录可能的错误
        log.warn("{error}", error.message);
    }
    // 读取并解析设置文件
    const settingsJson = JSON.parse(file.readTextSync(settings_ui));
    // 如果configSettings未定义，则将其设置为解析后的设置对象
    if (!configSettings) {
        configSettings = settingsJson
    }
    // 调试日志：输出最终解析的设置对象
    log.debug("settingsJson={key}", settingsJson);
    // 返回设置对象
    return settingsJson
}

async function init() {
    let utils = [
        "uid",
        "ws",
        "notice",
        "campaignArea",
        "activity",
        "mapMission",
    ]
    for (let util of utils) {
        eval(file.readTextSync(`utils/${util}.js`));
    }
    // manifest = JSON.parse(file.readTextSync("manifest.json"));
    await initSettings();
    log.debug("main 初始化完成");
}

// 判断是否在主界面的函数
const isInMainUI = () => {
    let captureRegion = captureGameRegion();
    let res = captureRegion.Find(RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/paimon_menu.png"),
        0,
        0,
        640,
        216
    ));
    captureRegion.dispose();
    return !res.isEmpty();
};

async function toMainUi() {
    let ms = 300
    let index = 1
    await sleep(ms);
    while (!isInMainUI()) {
        await sleep(ms);
        await genshin.returnMainUi(); // 如果未启用，则返回游戏主界面
        await sleep(ms);
        if (index > 3) {
            throw new Error(`多次尝试返回主界面失败`);
        }
        index += 1
    }
}

(async function () {
    await init();
    log.info(`版本:{version}`, manifest.version)
    if (settings.toMainUi) {
        await toMainUi();
    }
    await main();
    await toMainUi();
})();

/**
 * @returns {Promise<void>}
 */
async function main() {
    let ms = 600
    const mapList = settings.mapMissionKeys || []
    if (mapList.length > 0) {
        try {
            await mapUtil.mapMission(mapList)
        } finally {
            await toMainUi()
        }
    }

    let openKey = true

    try {
        await campaignAreaUtil.dailyCommissionMain(openKey)
        await sleep(ms * 2);
        openKey = false
    } catch (e) {
        await toMainUi()
        throw e
    }
    await campaignAreaUtil.campaignAreaMain(openKey)
    await sleep(ms * 2);
    await toMainUi()
    await activityUtil.activityMain()
}