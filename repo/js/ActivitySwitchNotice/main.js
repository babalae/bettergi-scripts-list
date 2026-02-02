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
/**
 * 获取多复选框的映射表
 * 该函数会从初始化的设置中提取所有类型为"multi-checkbox"的条目，
 * 并将这些条目的名称和对应的选项值存储在一个Map对象中返回
 * @returns {Promise<Map>} 返回一个Promise对象，解析为包含多复选框配置的Map
 */
async function getMultiCheckboxMap() {
    // 如果configSettings存在则使用它，否则调用initSettings()函数获取
    const settingsJson = configSettings ? configSettings : await initSettings();
    // 创建一个新的Map对象用于存储多复选框的配置
    // Map结构为: {名称: 选项数组}
    let multiCheckboxMap = new Map();
    // 遍历设置JSON中的每个条目
    settingsJson.forEach((entry) => {
        // 如果条目没有name属性或者类型不是"multi-checkbox"，则跳过该条目
        if (!entry.name || entry.type !== "multi-checkbox") return;
        // 解构条目中的name和label属性，便于后续使用
        const {name, label} = entry;
        // 获取当前name对应的设置值，如果存在则转换为数组，否则使用空数组
        const options = settings[name] ? Array.from(settings[name]) : [];
        // 记录调试信息，包含名称、标签、选项和选项数量
        log.debug("name={key1},label={key2},options={key3},length={key4}", name, label, JSON.stringify(options), options.length);
        // 将名称和对应的选项数组存入Map
        multiCheckboxMap.set(name, options);
    })
    // 返回包含多复选框配置的Map
    return multiCheckboxMap
}

/**
 * 根据复选框组名称获取对应的值
 * 这是一个异步函数，用于从复选框映射中获取指定名称的值
 * @param {string} name - 复选框组的名称
 * @returns {Promise<any>} 返回一个Promise，解析为复选框组对应的值
 */
async function getValueByMultiCheckboxName(name) {
    // 获取复选框映射表，这是一个异步操作
    let multiCheckboxMap = await getMultiCheckboxMap()
    // log.debug("multiCheckboxMap={key}", JSON.stringify(multiCheckboxMap))
    // multiCheckboxMap.entries().forEach(([name, options]) => {
    //     log.debug("name={key1},options={key2}", name, JSON.stringify(options))
    // })
    // 从映射表中获取并返回指定名称对应的值
    let values = multiCheckboxMap.get(name);
    log.debug("values={key}", JSON.stringify(values))
    return values
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
    const mapList = await getValueByMultiCheckboxName('mapMissionKeys')|| []
    // log.info(`mapList=>{0}`,JSON.stringify(mapList))
    if (mapList.length > 0) {
        try {
            log.info(`开始识别地图任务`)
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
    await activityUtil.activityMain(settings.newActivityNotice)
}