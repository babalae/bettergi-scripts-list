import {ocrUid} from "../utils/uid";

const config = {
    //setting设置放在这个json
    run: {
        loop_plan: false,//启用循环体力计划
        retry_count: 3,//复活重试次数
        config: '',
        // load_uid_config: false,
        loads: [],//加载方式list
    },
    bgi_tools: {
        //授权token
        token: {
            name: 'Authorization',
            value: ''
        },
        api: {
            httpPullJsonConfig: undefined,
            httpPushAllJsonConfig: undefined,
            httpPushAllCountryConfig: undefined,
        },
        open: {open_push: false}
    },
    info: {
        key: undefined,//密钥
        manifest: {},
        settings: undefined
    },
    user: {
        uid: undefined,
        physical: {
            min: 20,//最小体力
            current: 0,//当前体力
            names: ["原粹树脂", "浓缩树脂", "须臾树脂", "脆弱树脂"]
        },
        runTypes: ['秘境', '地脉']
    },
    //
    path: {
        manifest: "manifest.json",
        domain: "config/domain.json",
        runConfig: "config/run_config.json",
        countryList: "config/countryList.json"
    },
    //所有秘境信息
    domainList: [],
    //所有秘境名称
    domainNames: new Set(),
    //物品名称(只记录顶级的名称->金色物品名称)
    itemNames: new Set(),
    //秘境名称映射物品列表
    domainMap: new Map(),
    //秘境名称映射秘境列表顺序
    domainOrderMap: new Map(),
    //物品名称映射秘境名称
    domainItemsMap: new Map(),
}

const LoadType = Object.freeze({
    uid: 'uid',//uid加载
    input: 'input',//input加载
    bgi_tools: 'bgi_tools',//bgi_tools加载
    fromValue(value) {
        return Object.keys(this).find(key => this[key] === value);
    }
})
const LoadMap = new Map([
    ['UID加载', LoadType.uid],
    ['输入加载', LoadType.input],
    ['bgi_tools加载', LoadType.bgi_tools],
])

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
        config.info.manifest = JSON.parse(file.readTextSync(config.path.manifest));
        // 调试日志：输出manifest内容
        log.debug("manifest={key}", config.info.manifest);
        // 调试日志：输出manifest中的settings_ui配置
        log.debug("settings_ui={key}", config.info.manifest.settings_ui);
        log.info(`|脚本名称:{name},版本:{version}`, config.info.manifest.name, config.info.manifest.version);
        if (config.info.manifest.bgi_version) {
            log.info(`|最小可执行BGI版本:{bgi_version}`, config.info.manifest.bgi_version);
        }
        log.info(`|脚本作者:{authors}\n`, config.info.manifest.authors.map(a => a.name).join(","));
        // 更新settings_ui变量为manifest中指定的路径
        settings_ui = config.info.manifest.settings_ui
    } catch (error) {
        // 捕获并记录可能的错误
        log.warn("{error}", error.message);
    }
    // 读取并解析设置文件
    const settingsJson = JSON.parse(file.readTextSync(settings_ui));
    // 如果configSettings未定义，则将其设置为解析后的设置对象
    if (!config.info.settings) {
        config.info.settings = settingsJson
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
    const settingsJson = config.info.settings ? config.info.settings : await initSettings();
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

/**
 * 检查密钥是否正确
 */
async function checkKey(key = "") {
    if (config?.info?.manifest?.key !== key?.trim()) {
        throw new Error("密钥错误");
    }
}

/**
 * 初始化秘境配置
 * @returns {Promise<void>}
 */
async function initConfig() {
    config.info.key = settings.key || config.info.key
    await checkKey(config.info.key)
    // //流程->返回主页 打开地图 返回主页
    // const physical = await ocrPhysical(true, true)
    // config.user.physical.current = physical.current
    // config.user.physical.min = physical.min
    // 初始化uid
    config.user.uid = await ocrUid()
    // config.run.retry_count = (settings.retry_count ? parseInt(settings.retry_count) : config.run.retry_count)

    const retryCount = Number.parseInt(String(settings.retry_count ?? ""), 10);
    config.run.retry_count = Number.isFinite(retryCount) && retryCount > 0
        ? retryCount
        : config.run.retry_count;

    config.run.loop_plan = settings.loop_plan !== undefined ? settings.loop_plan : config.run.loop_plan
    const bgi_tools_token = settings.bgi_tools_token || "Authorization= "
    // const list = Array.from(bgi_tools_token.split("=")).map(item => item.trim());
    // config.bgi_tools.token.name = list[0]
    // config.bgi_tools.token.value = list[1]

    const separatorIndex = bgi_tools_token.indexOf("=");
    if (separatorIndex !== -1) {
        config.bgi_tools.token.name = bgi_tools_token.substring(0, separatorIndex).trim();
        config.bgi_tools.token.value = bgi_tools_token.substring(separatorIndex + 1).trim();
    } else {
        config.bgi_tools.token.name = bgi_tools_token.trim();
        config.bgi_tools.token.value = "";
    }


    config.bgi_tools.api.httpPullJsonConfig = settings.bgi_tools_http_pull_json_config
    config.bgi_tools.api.httpPushAllJsonConfig = settings.bgi_tools_http_push_all_json_config
    config.bgi_tools.api.httpPushAllCountryConfig = settings.bgi_tools_http_push_all_country_config
    config.bgi_tools.open.open_push = settings.bgi_tools_open_push
    log.debug(`|bgi_tools:{1}`, JSON.stringify(config.bgi_tools))
    // const text = file.readTextSync(config.path.domain);
    // log.info("config.path.domain:{1}",config.path.domain)
    // log.info("text:{2}",text)
    // const list = JSON.parse(text);
    // log.info("list:{3}",[...list])
    const domainList = JSON.parse(file.readTextSync(config.path.domain)) || [{
        name: undefined,
        type: undefined,
        hasOrder: false,
        list: []
    }]

    config.domainList.push(...domainList)

    config.domainList.forEach(item => {
        if (!config.domainNames.has(item.name)) {
            config.domainNames.add(item.name)
        }
        config.domainMap.set(item.name, item.list);
        if (item?.hasOrder) {
            let index = 1
            //设置顺序
            item.list.forEach(item2 => {
                if (!config.itemNames.has(item2)) {
                    config.itemNames.add(item2)
                }
                config.domainOrderMap.set(item2, index)
                config.domainItemsMap.set(item2, item.name)
                index++
            })
        }

    })
    config.run.config = settings.run_config || config.run.config
    if (config.domainList.length <= 0) {
        throw new Error("配置文件缺失或读取异常!")
    }
    let loadList = await getValueByMultiCheckboxName('auto_load') || []
    const loads = loadList.map(item => {
        const load = LoadMap.get(item);
        if (!load) {
            throw new Error(`无效加载方式: ${item}`);
        }
        let order = 1
        switch (load) {
            case LoadType.input:
                order = 1;
                break;
            case LoadType.uid:
                order = 2;
                break;
            case LoadType.bgi_tools:
                order = 3;
                break;
        }
        return {load: load, order: order}
    })
    loads.sort((a, b) => a.order - b.order)
    config.run.loads = loads
}


export {
    config, LoadType, LoadMap,
    checkKey,
    initSettings,
    getMultiCheckboxMap,
    getValueByMultiCheckboxName,
    initConfig
}