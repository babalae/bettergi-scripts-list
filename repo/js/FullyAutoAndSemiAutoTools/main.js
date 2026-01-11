let manifest_json = "manifest.json";
let manifest = undefined
let configSettings = undefined
let AUTO_STOP = undefined
let AUTO_SKIP = undefined
let debug = undefined
let isDebug = false
let SEMI_AUTO = false
const pathingName = "pathing"
// const pathAsMap = new Map([])
// const pathRunMap = new Map([])
const needRunMap = new Map([])
const PATHING_ALL = new Array({level: 0, name: `${pathingName}`, parent_name: "", child_names: []})
let settingsNameList = new Array()
const settingsNameAsList = new Array()
let PATH_JSON_LIST = new Array()
const config_root = 'config'
// 定义记录文件的路径
let RecordText = `${config_root}\\record.json`
let RecordList = new Array()
let RecordLast = {
    name: "",
    data: undefined,
    timestamp: 0,
    paths: new Set(), // 记录路径
    errorPaths: new Set(),
    groupPaths: new Set(),
}
const Record = {
    uid: "",
    data: undefined,
    timestamp: 0,
    paths: new Set(), // 记录路径
    errorPaths: new Set(), // 记录错误路径
    groupPaths: new Set(), // 记录分组路径
}
const config_list = {
    black: [],
    white: [],
}

const SevenElement = {
    SevenElements: ['火', '水', '风', '雷', '草', '冰', '岩'],
    SevenElementsMap: new Map([
        ['火', []],
        ['水', ['海露花']],
        ['风', ['蒲公英籽']],
        ['雷', ['琉鳞石', '绯樱绣球']],
        ['草', []],
        ['冰', []],
        ['岩', []],
    ]),
}
const team = {
    current: undefined,
    currentElementName: undefined,
    fight: false,
    SevenElements: settings.teamSevenElements.split(',').map(item => item.trim()),
}

/**
 * 保存当前记录到记录列表并同步到文件
 * 该函数在保存前会将Set类型的数据转换为数组格式，确保JSON序列化正常进行
 */
function saveRecord() {
    // 保存前将 Set 转换为数组
    // 创建一个新的记录对象，包含原始记录的所有属性
    const recordToSave = {
        // 使用展开运算符复制Record对象的所有属性
        ...Record,
        // 将paths Set转换为数组
        paths: [...Record.paths],
        // 将errorPaths Set转换为数组
        errorPaths: [...Record.errorPaths],
        // 将groupPaths Set转换为数组，并对每个元素进行特殊处理
        groupPaths: [...Record.groupPaths].map(item => ({
            // 保留name属性
            name: item.name,
            // 将item中的paths Set转换为数组
            paths: [...item.paths]
        }))
    };
    // 将处理后的记录添加到记录列表
    RecordList.push(recordToSave)
    // 将记录列表转换为JSON字符串并同步写入文件
    file.writeTextSync(RecordText, JSON.stringify(RecordList))
}

/**
 * 初始化记录函数
 * 该函数用于初始化一条新的记录，包括设置UID、时间戳和调整后的日期数据
 * 同时会检查记录列表中是否存在相同UID的最新记录，并进行更新
 */
async function initRecord() {
    // 设置记录的唯一标识符，通过OCR技术获取
    Record.uid = await uidUtil.ocrUID()
    // 设置记录的时间戳为当前时间
    Record.timestamp = Date.now()
    // 获取并设置调整后的日期数据
    Record.data = getAdjustedDate()

    try {
        // 尝试读取记录文件
        // 读取后将数组转换回 Set，处理特殊的数据结构
        RecordList = JSON.parse(file.readTextSync(RecordText), (key, value) => {
            // 处理普通路径集合
            if (key === 'paths' || key === 'errorPaths') {
                return new Set(value);
            }
            // 处理分组路径集合，保持嵌套的Set结构
            if (key === 'groupPaths') {
                return new Set(value.map(item => ({
                    name: item.name,
                    paths: new Set(item.paths)
                })));
            }
            return value;
        });
    } catch (e) {
        // 如果读取文件出错，则忽略错误（可能是文件不存在或格式错误）
    }

    // 如果记录列表不为空，则查找最新记录
    if (RecordList.length > 0) {
        // 最优解：一次遍历找到最新的记录
        let latestRecord = undefined;
        // 遍历记录列表，查找相同UID且时间戳最大的记录
        for (const item of RecordList) {
            // 检查当前记录项的UID是否匹配，并且是最新记录
            if (item.uid === Record.uid &&
                // 如果还没有找到记录，或者当前记录的时间戳比已找到的记录更新
                (!latestRecord || item.timestamp > latestRecord.timestamp)) {
                // 更新最新记录为当前项
                latestRecord = item;
            }
        }
        // 如果找到最新记录，则更新RecordLast；否则保持原有RecordLast的值
        RecordLast = latestRecord ? latestRecord : RecordLast;
    }
    if (RecordLast.uid === Record.uid && Record.data === RecordLast.data) {
        // 判断是否为同一天 合并跑过的数据
        // 确保 RecordLast 的 Set 属性存在
        if (!RecordLast.paths || !(RecordLast.paths instanceof Set)) {
            RecordLast.paths = new Set();
        }
        if (!RecordLast.groupPaths || !(RecordLast.groupPaths instanceof Set)) {
            RecordLast.groupPaths = new Set();
        }

        // 判断是否为同一天 合并跑过的数据
        Record.paths = new Set([...Record.paths, ...RecordLast.paths])
        Record.groupPaths = new Set([...Record.groupPaths, ...RecordLast.groupPaths])
        // 删除RecordLast
        const index = RecordList.indexOf(RecordLast);
        if (index > -1) {
            RecordList.splice(index, 1);
        }
    }
}

function getAdjustedDate() {
    const now = new Date();
    // 减去4小时（4 * 60 * 60 * 1000 毫秒）
    now.setHours(now.getHours() - 4);

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// 解析日期字符串
function parseDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month - 1 因为月份从0开始
}

// Record.groupPaths.add({
//     name: "",
//     paths:new Set()
// })
// const pathingALLSize = []
// 使用函数来添加唯一元素
// 优化后的函数
function addUniquePath(obj) {
    const existingIndex = PATHING_ALL.findIndex(item =>
        item.level === obj.level && item.name === obj.name
    );

    if (existingIndex === -1) {
        PATHING_ALL.push(obj);
    } else {
        // 合并 child_names 数组，避免重复元素
        const existingItem = PATHING_ALL[existingIndex];
        const newChildren = obj.child_names || [];

        // 使用 Set 去重并合并数组
        const combinedChildren = [...new Set([
            ...(existingItem.child_names || []),
            ...newChildren
        ])];

        existingItem.child_names = combinedChildren;
    }
}

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
        manifest = manifest ? manifest : JSON.parse(file.readTextSync(manifest_json));
        // 调试日志：输出manifest内容
        // log.debug("manifest={key}", manifest);
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
        // multiCheckboxMap.set(name, options);
        multiCheckboxMap.set(name, {label: label, options: options});
    })
    // 返回包含多复选框配置的Map
    return multiCheckboxMap
}

/**
 * 根据多选框名称获取对应的JSON数据
 * 该函数是一个异步函数，用于从复选框映射表中获取指定名称的值
 * @param {string} name - 多选框的名称，用于在映射表中查找对应的值
 * @returns {Promise<any>} 返回一个Promise，解析后为找到的值，如果未找到则返回undefined
 */
async function getJsonByMultiCheckboxName(name) {
    // 获取复选框映射表，这是一个异步操作
    let multiCheckboxMap = await getMultiCheckboxMap()
    // 从映射表中获取并返回指定名称对应的值
    return multiCheckboxMap.get(name)
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
    // 从映射表中获取并返回指定名称对应的值
    return multiCheckboxMap.get(name).options
}

async function init() {
    let settingsConfig = await initSettings();
    let utils = [
        "uid",
    ]
    for (let util of utils) {
        eval(file.readTextSync(`utils/${util}.js`));
    }
    if (manifest.key !== settings.key) {
        throw new Error("密钥不匹配")
    }
    AUTO_STOP = (AUTO_STOP) ? AUTO_STOP : settings.autoStop
    AUTO_SKIP = (AUTO_SKIP) ? AUTO_SKIP : settings.autoSkip
    debug = (debug) ? debug : settings.debug
    isDebug = settings.isDebug
    SEMI_AUTO = settings.mode === settings.mode
    config_list.black = settings.config_black_list ? settings.config_black_list.split(",") : []
    config_list.white = settings.config_white_list ? settings.config_white_list.split(",") : []
    if (SEMI_AUTO && !AUTO_STOP) {
        throw new Error("半自动模式下必须开启自动停止")
    }

    if (!file.IsFolder(`${pathingName}`)) {
        let batFile = "SymLink.bat";
        log.error("{0}文件夹不存在，请在BetterGI中右键点击本脚本，选择{1}。然后双击脚本目录下的{2}文件以创建文件夹链接", `${pathingName}`, "打开所在目录", batFile);
        return false;
    }
    //记录初始化
    await initRecord();

    // 读取现有配置并合并
    let uidSettingsMap = new Map()
    const uidSettingsJson = `${config_root}/uid_settings.json`;
    try {
        const existingData = JSON.parse(file.readTextSync(uidSettingsJson))
        uidSettingsMap = new Map(existingData)
    } catch (e) {
        // 文件不存在时使用空Map
        log.debug("配置文件不存在，将创建新的");
    }
    let levelName = "treeLevel"

    async function refreshALL() {
        let level = 0

        // 获取当前路径下的所有文件/文件夹
        let pathSyncList = file.readPathSync(`${PATHING_ALL[level].name}`);
        log.debug("{0}文件夹下有{1}个文件/文件夹", `${pathingName}`, pathSyncList.length);
        let settingsList = settingsConfig
        let parentJson = {
            name: `${levelName}_${level}_${level}`,
            type: "multi-checkbox",
            label: `选择要执行的${level + 1}级路径`,
            options: []
        }
        for (const element of pathSyncList) {
            // log.warn("element={0}", element)
            parentJson.options.push(element.replace(`${pathingName}\\`, ""))
        }
        await addUniquePath({level: level, name: `${pathingName}`, parent_name: '', child_names: parentJson.options})

        let treePathList = await readPaths(`${pathingName}`)
        await debugKey('log-treePathList.json', JSON.stringify(treePathList))
        let pathJsonList = await treeToList(treePathList)
        PATH_JSON_LIST = pathJsonList

        // 预处理黑白名单数组，移除空字符串并trim
        const processedBlackList = config_list.black
            .map(item => item.trim())
            .filter(item => item !== "");

        const processedWhiteList = config_list.white
            .map(item => item.trim())
            .filter(item => item !== "");

        for (const element of pathJsonList) {
            const pathRun = element.path

            // 检查路径是否被允许
            const isBlacklisted = processedBlackList.some(item => pathRun.includes(item));
            const isWhitelisted = processedWhiteList.some(item => pathRun.includes(item));

            if (isBlacklisted && !isWhitelisted) {
                continue;
            }


            const level_parent_name = getChildFolderNameFromRoot(pathRun, level + 1);
            const level1_name = getChildFolderNameFromRoot(pathRun, level + 1 + 1);
            let level2_name = getChildFolderNameFromRoot(pathRun, level + 2 + 1);
            let level3_name = getChildFolderNameFromRoot(pathRun, level + 3 + 1);
            if (level2_name.endsWith(".json")) {
                level2_name = undefined
            }
            if (level3_name.endsWith(".json")) {
                level3_name = undefined
            }
            //存储 2 级
            await addUniquePath({
                level: level + 1,
                name: level1_name,
                parent_name: level_parent_name,
                child_names: level2_name ? [level2_name] : []
            })
            await addUniquePath({
                level: level + 2,
                name: level2_name,
                parent_name: level1_name,
                child_names: level3_name ? [level3_name] : []
            })
        }
        // 正确的排序方式
        PATHING_ALL.sort((a, b) => {
            // 首先按 level 排序
            if (a.level !== b.level) {
                return a.level - b.level;
            }
            if (a.parent_name !== b.parent_name) {
                return a.parent_name.localeCompare(b.parent_name);
            }
            // level 相同时按 name 排序
            return a.name.localeCompare(b.name);
        });

        await debugKey('log-PATHING_ALL.json', JSON.stringify(PATHING_ALL))
        const groupLevel = groupByLevel(PATHING_ALL);
        const initLength = settingsList.length
        let parentNameLast = undefined
        // let parentNameNow = undefined
        const line = 30
        const br = `${"=".repeat(line)}\n`
        let idx = 0
        groupLevel.filter(list => list.length > 0).forEach(
            (list) => {
                let i = 0
                list.filter(item => item && item.child_names && item.child_names.length > 0).forEach(item => {
                    const name = `${levelName}_${item.level}_${i}`
                    let prefix = ''
                    if (item.parent_name !== parentNameLast) {
                        parentNameLast = item.parent_name;
                        let b = (line - item.parent_name.length) % 2 === 0;
                        const localLine = b ? ((line - item.parent_name.length) / 2) : (Math.ceil((line - item.parent_name.length) / 2))
                        prefix = br + `${"=".repeat(localLine)}${item.parent_name}${"=".repeat(localLine)}\n` + br
                    }
                    // const p = idx === 0 ? "【地图追踪】\n" : `${prefix}[${item.parent_name}-${item.name}]\n`
                    const p = `${prefix}[${item.name}]\n`
                    idx++
                    let leveJson = {
                        name: `${name}`,
                        type: "multi-checkbox",
                        label: `${p}选择要执行的${item.level + 1}级路径`,
                        options: []
                    }
                    // leveJson.options = leveJson.options.concat(item.child_names)
                    leveJson.options = [...item.child_names]
                    if (leveJson.options && leveJson.options.length > 0) {
                        settingsNameAsList.push({
                            settings_name: name,
                            settings_as_name: item.name
                        })
                        settingsNameList.push(name)
                        const existingIndex = settingsList.findIndex(item => item.name === leveJson.name);
                        if (existingIndex !== -1) {
                            // 替换已存在的配置项
                            settingsList[existingIndex] = leveJson;
                        } else {
                            if (item.parent_name !== parentNameLast) {
                                settingsList.push({type: "separator"})
                            }
                            // 添加新的配置项
                            settingsList.push(leveJson);
                        }
                        i++
                    }
                })
            }
        )
        level++

        settingsList.filter(
            item => item.name === 'key'
        ).forEach(item => {
            // 刷新settings自动设置密钥
            item.default = manifest.key
        })
        // 更新当前用户的配置
        uidSettingsMap.set(Record.uid, settingsList)
        // 安全写入配置文件
        try {
            file.writeTextSync(uidSettingsJson, JSON.stringify([...uidSettingsMap]))
            log.debug("用户配置已保存: {uid}", Record.uid)
        } catch (error) {
            log.error("保存用户配置失败: {error}", error.message)
        }
        file.writeTextSync(manifest.settings_ui, JSON.stringify(settingsList))
    }

//刷新settings
    if (settings.config_run === "刷新") {
        await refreshALL();
    } else if (true) {
        //直接从配置文件中加载对应账号的配置
        let uidSettings = uidSettingsMap.get(Record.uid);
        if (uidSettings) {
            try {
                file.writeTextSync(manifest.settings_ui, JSON.stringify(uidSettings))
            } catch (e) {
                log.error("加载用户配置失败: {error}", e.message)
            }
        }
        configSettings = await initSettings()
        settingsNameList = settingsNameList.concat(await getMultiCheckboxMap().then(map => {
            return map.keys().filter(key => key.startsWith(levelName))
        }))
    }
    // 初始化needRunMap
    if (true) {
        // for (let key of pathAsMap.keys()) {
        //     const multiCheckbox = await getValueByMultiCheckboxName(pathAsMap.get(key));
        //     needRunMap.set(key, multiCheckbox)
        // }
        for (const settingsName of settingsNameList) {
            // let multi = await getValueByMultiCheckboxName(settingsName);
            const multiJson = await getJsonByMultiCheckboxName(settingsName)
            const label = getBracketContent(multiJson.label)
            let multi = multiJson.options
            const settingsAsName = settingsNameAsList.find(item => item.settings_name === settingsName)
            let list = PATH_JSON_LIST.filter(item =>
                multi.some(element => item.path.includes(`\\${element}\\`) && item.path.includes(`\\${label}\\`))
            ).map(item => {
                // 找到匹配的元素并填充到 selected 字段
                const matchedElement = multi.find(element => item.path.includes(`\\${element}\\`) && item.path.includes(`\\${label}\\`));
                return {name: item.name, parent_name: item.parent_name, selected: matchedElement || "", path: item.path}
            });
            if (list.length <= 0) {
                continue
            }
            needRunMap.set(settingsAsName.settings_as_name, {
                paths: list,
                as_name: settingsAsName.settings_as_name,
                name: settingsAsName.settings_name
            })
        }
    }
    // 启用自动拾取的实时任务，并配置成启用急速拾取模式
    dispatcher.addTrigger(new RealtimeTimer("AutoPick", {"forceInteraction": true}));
    return true
}

/**
 * 获取字符串中第一个方括号内的内容
 * @param {string} str - 输入的字符串
 * @returns {string} 返回第一个方括号内的内容，如果没有找到则返回空字符串
 */
function getBracketContent(str) {
    // 使用正则表达式匹配第一个方括号及其中的内容
    const match = str.match(/\[(.*?)\]/);
    // 如果找到匹配项，返回第一个捕获组（即方括号内的内容），否则返回空字符串
    return match ? match[1] : '';  // 找不到就回空字串
}

/**
 * 调试按键函数，用于在开发者模式下暂停程序执行并等待特定按键
 * @param {string} key - 需要按下的键
 * @param {string} path - 调试信息保存的文件路径，默认为"debug.json"
 * @param {string} json - 需要写入调试文件的内容，默认为空数组
 * @returns {Promise<void>} - 异步函数，没有返回值
 */
async function debugKey(path = "debug.json", json = "", key = debug) {
    const p = "debug\\"
    // 检查是否处于调试模式
    if (isDebug) {
        log.warn("[{0}]正在写出{1}日志", '开发者模式', path)
        // 将调试信息同步写入指定文件
        file.writeTextSync(`${p}${path}`, json)
        log.warn("[{0}]写出完成", '开发者模式')
        // 输出等待按键的提示信息
        log.warn("[{0}]请按下{1}继续执行", '开发者模式', key)
        // 等待用户按下指定按键
        await keyMousePress(key)
    }
}

/**
 * 检测指定按键是否被按下并释放
 * @param {string} key - 需要检测的按键代码
 * @returns {Promise<boolean>} 返回一个Promise，解析为布尔值，表示按键是否被按下并释放
 */
async function keyMousePressSkip(key, ms = 5000) {
    let press = false
    // 需手动初始化 keyMouseHook
    const keyMouseHook = new KeyMouseHook()
    let keyDown = false  // 标记按键是否被按下
    let keyUp = false    // 标记按键是否被释放
    try {
        // 注册按键按下事件处理函数
        keyMouseHook.OnKeyDown(function (keyCode) {
            log.debug("{keyCode}被按下", keyCode)
            keyDown = (key === keyCode)  // 检查按下的键是否与目标键匹配
        });
        // 注册按键释放事件处理函数
        keyMouseHook.OnKeyUp(function (keyCode) {
            log.debug("{keyCode}被释放", keyCode)
            keyUp = (key === keyCode)    // 检查释放的键是否与目标键匹配
        });

        // 循环检测按键状态，直到按键被按下并释放
        press = keyDown && keyUp  // 只有当按键既被按下又被释放时，press才为true
        await sleep(ms)  // 每次循环间隔200毫秒

        return press
    } finally {
        //脚本结束前，记得释放资源！
        keyMouseHook.dispose()
    }  // 释放按键钩子资源

}

/**
 * 异步函数，用于检测特定按键的按下和释放事件
 * @param {string|number} key - 需要检测的按键代码
 * @returns {Promise<boolean>} 返回一个Promise，解析为布尔值，表示是否检测到按键的完整按下和释放过程
 */
async function keyMousePress(key) {
    let press = false
    // 需手动初始化 keyMouseHook
    const keyMouseHook = new KeyMouseHook()
    let keyDown = false  // 标记按键是否被按下
    let keyUp = false    // 标记按键是否被释放
    try {
        // 注册按键按下事件处理函数
        keyMouseHook.OnKeyDown(function (keyCode) {
            log.debug("{keyCode}被按下", keyCode)
            keyDown = (key === keyCode)  // 检查按下的键是否与目标键匹配
        });
        // 注册按键释放事件处理函数
        keyMouseHook.OnKeyUp(function (keyCode) {
            log.debug("{keyCode}被释放", keyCode)
            keyUp = (key === keyCode)    // 检查释放的键是否与目标键匹配
        });

        // 循环检测按键状态，直到按键被按下并释放
        while (!press) {
            press = keyDown && keyUp  // 只有当按键既被按下又被释放时，press才为true
            await sleep(200)  // 每次循环间隔200毫秒
        }

        return press
    } finally {
        //脚本结束前，记得释放资源！
        keyMouseHook.dispose()
    }  // 释放按键钩子资源

}

/**
 * 执行指定路径的脚本文件
 * @param {string} path - 要执行的脚本路径
 * @param {string} [stopKey=AUTO_STOP] - 用于暂停执行的按键，默认为AUTO_STOP
 */
async function runPath(path, stopKey = AUTO_STOP) {
    // 参数验证
    if (!path || typeof path !== 'string') {
        log.warn('无效的路径参数: {path}', path)
        return
    }

    // 检查该路径是否已经在执行中
    if (Record.paths.has(path)) {
        log.info(`[{mode}] 路径已执行: {path}，跳过执行`, settings.mode, path)
        return
    }
    try {
        const one = JSON.parse(file.readTextSync(path))
        if (one.info && one.info.description.includes("请配置好战斗策略")) {
            log.warn(`[{mode}] 路径需要配置好战斗策略: {path}，如已配置请忽略`, settings.mode, path)
        }
    } catch (error) {
        // log.error("路径执行失败: {path}, 错误: {error}", path, error.message)
        // return
    }

    try {
        log.debug("开始执行路径: {path}", path)
        await pathingScript.runFile(path)
        log.debug("路径执行完成: {path}", path)
        Record.paths.add(path)
        Record.errorPaths.delete(path)
    } catch (error) {
        Record.errorPaths.add(path)
        log.error("路径执行失败: {path}, 错误: {error}", path, error.message)
    }

    if (SEMI_AUTO) {
        log.warn(`[{mode}] 路径执行完成: {path}, 请按{key}继续`, settings.mode, path, stopKey)
        await keyMousePress(stopKey)
    }
}


/**
 * 执行给定的路径列表
 * @param {Array} list - 要执行的路径列表，默认为空数组
 * @param {string} stopKey - 停止标识，默认为AUTO_STOP
 * @returns {Promise<void>}
 */
async function runList(list = [], stopKey = AUTO_STOP) {
    // 参数验证
    if (!Array.isArray(list)) {
        log.warn('无效的路径列表参数: {list}', list);
        return;
    }

    if (list.length === 0) {
        log.debug('路径列表为空，跳过执行');
        return;
    }
    log.debug(`[{mode}] 开始执行路径列表，共{count}个路径`, settings.mode, list.length);
    // 遍历路径列表
    for (let i = 0; i < list.length; i++) {
        const onePath = list[i];
        const path = onePath.path;
        if (i === 0) {
            log.info(`[{mode}] 开始执行[{1}-{2}]列表`, settings.mode, onePath.selected, onePath.parent_name);
        }
        log.debug('正在执行第{index}/{total}个路径: {path}', i + 1, list.length, path);
        // if (await keyMousePressSkip(AUTO_SKIP)) {
        //     log.warn(`[{mode}] 按下{key}跳过{0}执行`, settings.mode, AUTO_SKIP, path);
        //     continue
        // }
        try {
            // 执行单个路径，并传入停止标识
            await runPath(path, stopKey);
        } catch (error) {
            log.error('执行路径列表中的路径失败: {path}, 错误: {error}', path, error.message);
            continue; // 继续执行列表中的下一个路径
        }
    }

    log.debug(`[{mode}] 路径列表执行完成`, settings.mode);
}


/**
 * 遍历并执行Map中的任务
 * @param {Map} map - 包含任务信息的Map对象，默认为新的Map实例
 * @param {string} stopKey - 自动停止的标识键，默认为AUTO_STOP
 * @returns {Promise<void>} - 异步执行，没有返回值
 */
async function runMap(map = new Map(), stopKey = AUTO_STOP) {
    // 参数验证
    if (!(map instanceof Map)) {
        log.warn('无效的Map参数: {map}', map);
        return;
    }

    if (map.size === 0) {
        log.debug('任务Map为空，跳过执行');
        return;
    }

    log.info(`[{mode}] 开始执行任务Map，共{count}个任务`, settings.mode, map.size);

    // 遍历Map中的所有键
    for (const [key, one] of map.entries()) {
        if (one.paths.size <= 0) {
            continue
        }
        try {
            // 记录开始执行任务的日志信息
            log.info(`[{0}] 开始执行[{1}]...`, settings.mode, one.as_name);
            // 执行当前任务关联的路径列表

            await runList(one.paths, stopKey);
            Record.groupPaths.add({
                name: one.as_name,
                paths: new Set(one.paths)
            })
            log.debug(`[{0}] 任务[{1}]执行完成`, settings.mode, one.as_name);
        } catch (error) {
            log.error(`[{0}] 任务[{1}]执行失败: {error}`, settings.mode, one.as_name, error.message);
            continue; // 继续执行下一个任务
        }
    }

    log.debug(`[{mode}] 任务Map执行完成`, settings.mode);
}

/**
 * 获取上级文件夹名称（支持多级查找）
 * @param {string} path - 完整路径
 * @param {number} level - 向上查找的层级，默认为1（即直接上级）
 * @returns {string} 指定层级的文件夹名称，如果不存在则返回空字符串
 */
function getParentFolderName(path, level = 1) {
    if (!path || typeof path !== 'string' || level < 1) {
        return undefined;
    }

    // 统一处理路径分隔符
    const normalizedPath = path.replace(/\\/g, '/');

    // 移除末尾的斜杠
    const trimmedPath = normalizedPath.replace(/\/$/, '');

    // 按斜杠分割路径
    const pathParts = trimmedPath.split('/').filter(part => part !== '');

    // 检查是否有足够的层级
    if (level >= pathParts.length) {
        return undefined;
    }

    // 返回指定层级的上级目录名称
    return pathParts[pathParts.length - level - 1];
}

/**
 * 从根目录开始获取指定位置的文件夹名称（支持多级查找）
 * @param {string} path - 完整路径
 * @param {number} level - 从根开始向下的层级，默认为1（即第一个子目录）
 * @returns {string} 指定层级的文件夹名称，如果不存在则返回undefined
 */
function getChildFolderNameFromRoot(path, level = 1) {
    if (!path || typeof path !== 'string' || level < 1) {
        return undefined;
    }

    // 统一处理路径分隔符
    const normalizedPath = path.replace(/\\/g, '/');

    // 移除开头的斜杠（如果有）
    const trimmedPath = normalizedPath.replace(/^\/+/, '');

    // 按斜杠分割路径
    const pathParts = trimmedPath.split('/').filter(part => part !== '');

    // 检查是否有足够的层级
    if (level > pathParts.length) {
        return undefined;
    }

    // 返回从根开始指定层级的目录名称（level - 1 是因为数组索引从0开始）
    return pathParts[level - 1];
}

/**
 * 按层级对列表项进行分组
 * @param {Array} list - 包含层级信息的列表项数组
 * @returns {Array} 返回一个嵌套数组，每个子数组包含对应层级的所有项
 */
function groupByLevel(list) {
    // 找出最大层级数
    const maxLevel = Math.max(...list.map(item => item.level));

    // 创建嵌套数组结构
    const result = [];

    // 按层级分组
    for (let level = 0; level <= maxLevel; level++) {
        const levelItems = list.filter(item => item.level === level);
        result.push(levelItems);
    }

    return result;
}


/**
 * 递归读取指定路径下的文件和文件夹，构建树形结构
 * @param {string} path - 要读取的初始路径
 * @param {number} index - 当前层级的索引，默认为0
 * @param {string} isFileKey - 目标文件类型的后缀名，默认为".json"
 * @param {boolean} treeStructure - 是否使用树状结构返回，默认为true
 * @returns {Promise<Array>} 返回包含文件和文件夹结构的数组
 */
async function readPaths(path, index = 0, isFileKey = ".json", treeStructure = true) {
    let treeList = []; // 用于存储当前层级的文件和文件夹结构

    // 获取当前路径下的所有文件/文件夹
    let pathSyncList = file.readPathSync(path);

    // 遍历当前路径下的所有文件和文件夹
    for (const pathSync of pathSyncList) {
        // 如果是目标文件类型（默认为.json）
        if (pathSync.endsWith(isFileKey)) {
            // 如果是目标文件类型，添加到列表
            let name = undefined;
            let parentName = undefined;
            // let path_let = pathSync;
            let parentFolder = getParentFolderName(pathSync)
            if (!parentFolder) {
                throw new Error(`${pathSync}没有上级目录`)
            }
            // 获取父级目录路径（去除文件名）
            if (parentFolder.includes("@")) {
                // 包含@符号的情况：取@符号前的上级目录名
                // let first = path_let.split("@")[0];
                // first = first.substring(0, first.lastIndexOf("\\"));
                name = getParentFolderName(pathSync, 2);
                parentName = getParentFolderName(pathSync, 3);
            }
                // else if (pathSync.includes("挪德卡莱锄地小怪")) {
                //     // 特殊处理
                //     let first_te = path_let.split("挪德卡莱锄地小怪")[0];
                //     first_te = first_te.substring(0, first_te.lastIndexOf("\\"));
                //     name = first_te.substring(first_te.lastIndexOf("\\"), first_te.length);
            // }
            else {
                name = parentFolder;
                parentName = getParentFolderName(pathSync, 2);
            }

            // 根据 treeStructure 参数决定是否创建完整对象
            if (treeStructure) {
                treeList.push({
                    name: name,
                    parentName: parentName,
                    path: pathSync,
                    index: index + 1,
                    isRoot: false,
                    isFile: true,
                    child: []
                });
            } else {
                // 如果不需要树状结构，只添加基本文件信息
                treeList.push({
                    name: name,
                    path: pathSync,
                    isFile: true
                });
            }
        } else if (file.IsFolder(pathSync)) {
            // 如果是文件夹，根据 treeStructure 参数决定如何处理
            if (treeStructure) {
                // 如果需要树状结构，递归处理并保留文件夹信息
                const childTreeList = await readPaths(pathSync, index + 1, isFileKey, treeStructure);

                treeList.push({
                    name: undefined,
                    parentName: undefined,
                    path: pathSync,
                    index: index + 1,
                    isRoot: false,
                    isFile: false,
                    child: childTreeList
                });
            } else {
                // 如果不需要树状结构，直接递归遍历子文件夹，只收集文件
                const childTreeList = await readPaths(pathSync, index + 1, isFileKey, treeStructure);
                treeList = treeList.concat(childTreeList); // 将子文件夹中的文件直接合并到当前列表
            }
        }
    }

    return treeList;
}


async function treeToList(treeList = []) {
    let list = []
    for (const element of treeList) {
        const child = element.child
        if (child && child.length > 0) {
            list = list.concat(await treeToList(child))
        }
        // 如果是文件，添加到结果列表
        if (element.isFile) {
            list.push(element);
        }
    }
    return list
}

(async function () {
    try {
        if (await init()) {
            await main()
        }
    } finally {
        saveRecord();
    }

})()

async function main() {
    let lastRunMap = new Map()

    function chooseBestRun() {
        if (settings.choose_best && RecordLast.paths.size > 0) {
            // 由于在迭代过程中删除元素会影响迭代，先收集要删除的键
            const keysToDelete = [];
            // 优先跑上次没跑过的路径
            // 使用 Set 提高性能
            const lastListSet = new Set([...RecordLast.paths]);

            for (const [key, one] of needRunMap.entries()) {
                // 检查当前任务的路径是否都不在上次执行的路径中
                const allPathsInLast = one.paths.every(pathObj => lastListSet.has(pathObj.path));

                if (!allPathsInLast) {
                    lastRunMap.set(key, one);
                    keysToDelete.push(key);
                }
            }
            // 然后批量删除
            for (const key of keysToDelete) {
                needRunMap.delete(key);
            }
        }
    }

    chooseBestRun();

    if (needRunMap.size > 0) {
        await runMap(needRunMap)
    }
    if (lastRunMap.size > 0) {
        await runMap(lastRunMap)
    }

    if (needRunMap.size <= 0 && lastRunMap.size <= 0) {
        log.info(`设置目录{0}完成`, "刷新")
    }
    // log.info(`[{mode}] path==>{path},请按下{key}以继续执行[${manifest.name} JS]`, settings.mode, "path", AUTO_STOP)
    // await keyMousePress(AUTO_STOP);
    // log.info(`[{mode}] path==>{path},请按下{key}以继续执行[${manifest.name} JS]`, settings.mode, "path", AUTO_STOP)
}