import {config, initConfig, initSettings, LoadType} from './config/config';
import {ocrUid} from './utils/uid';
import {getDayOfWeek, outDomainUI, throwError} from './utils/tool';
import {pullJsonConfig, pushAllJsonConfig} from './utils/bgi_tools';
import {ocrPhysical} from "./utils/physical";

/**
 * 自动执行秘境任务的异步函数
 * @param {Object} autoFight - 包含秘境自动配置参数的对象
 * @returns {Promise<void>} - 执行完成后返回的Promise
 */
async function autoDomain(autoFight) {
    //定死做预留冗余 先不实现 不能指定次数 只能指定启用
    let physical_domain = autoFight?.physical
    //     || [
    //     {order: 0, name: "原粹树脂", count: 1, open: true},
    //     {order: 1, name: "浓缩树脂", count: 0, open: false},
    //     {order: 2, name: "须臾树脂", count: 0, open: false},
    //     {order: 3, name: "脆弱树脂", count: 0, open: false},
    // ]

    if ((!physical_domain) || physical_domain.filter(item => item.open).length === 0) {
        const names = config.user.physical.names;
        physical_domain = []
        names.forEach((name, index) => {
            physical_domain.push({order: index, name: name, open: index === 0})
        })
    }

    physical_domain.sort((a, b) => a.order - b.order)
    // 不包含原粹树脂的和
    const noOriginalSum = physical_domain.filter(item => item.name.trim() !== "原粹树脂")
        .filter(item => item.open).length;//求和
    // 只包含原粹树脂的和
    const originalSum = physical_domain.filter(item => item.name?.trim() === "原粹树脂")
        .filter(item => item.open).length;
    const resinPriorityList = physical_domain.filter(item => item.open).map(item => item.name?.trim())
    //  /** 树脂使用优先级列表 */
    //   resinPriorityList: string[];
    //   /** 使用原粹树脂次数 */
    //   originalResinUseCount: number;
    //   /** 使用浓缩树脂次数 */
    //   condensedResinUseCount: number;
    //   /** 使用须臾树脂次数 */
    //   transientResinUseCount: number;
    //   /** 使用脆弱树脂次数 */
    //   fragileResinUseCount: number;
    await sleep(1000)
    //流程->返回主页 打开地图 返回主页
    const physicalOcr = await ocrPhysical(true, true)
    config.user.physical.current = physicalOcr.current
    config.user.physical.min = physicalOcr.min
    const physical = config.user.physical
    if (physical.current < physical.min && noOriginalSum <= 0 && originalSum > 0) {
        throwError(`体力不足，当前体力${physical.current}，最低体力${physical.min}，请手动补充体力后重试`)
    }
    // 创建秘境参数对象，初始化值为0
    let domainParam = new AutoDomainParam();
    //关闭分解
    domainParam.autoArtifactSalvage = false
    //关闭榨干原粹树脂
    domainParam.specifyResinUse = true
    //配置树脂使用优先级
    if (resinPriorityList.length > 0) {
        domainParam.SetResinPriorityList(...resinPriorityList)
    }
    // log.debug(`开始执行秘境任务`)
    //秘境名称
    domainParam.DomainName = autoFight.domainName || domainParam.DomainName;
    log.debug(`秘境名称:${domainParam.DomainName}`)

    //队伍名称
    domainParam.PartyName = autoFight.partyName || domainParam.PartyName;
    log.debug(`队伍名称:${domainParam.PartyName}`)

    if (autoFight.sundaySelectedValue) {
        //周日|限时选择的值
        domainParam.SundaySelectedValue = "" + (autoFight.sundaySelectedValue || domainParam.SundaySelectedValue);
    }
    log.debug(`周日|限时选择的值:${domainParam.SundaySelectedValue}`)
    //副本轮数
    try {
        domainParam.domainRoundNum = parseInt((autoFight.DomainRoundNum || domainParam.DomainRoundNum) + "");
    } catch (e) {
        throwError(e.message)
        log.debug(`副本轮数:${autoFight.domainRoundNum}`)
    }
    log.debug(`副本轮数:${domainParam.domainRoundNum}`)
    await dispatcher.RunAutoDomainTask(domainParam);
}


/**
 * 自动执行秘境任务列表处理函数
 * @param {Array} autoDomainOrderList - 包含秘境自动配置的数组
 */
async function autoRunList(autoDomainOrderList) {
    //计划执行
    for (const item of autoDomainOrderList) {
        if (item.runType===config.user.runTypes[0]){
            await autoDomain(item.autoFight);
        }else if (item.runType===config.user.runTypes[1]){
            //todo :地脉花
        }
    }
}

// 辅助函数：安全地解析 day 字段
function parseDay(day) {
    if (day == null || String(day).trim() === "") {
        return undefined; // 空值或无效值返回 undefined
    }
    const parsedDay = parseInt(String(day).trim(), 10);
    return isNaN(parsedDay) ? undefined : parsedDay; // 非法数字返回 undefined
}

/**
 * 根据不同的加载方式加载秘境配置
 * @param {string} Load - 加载方式类型，如uid或input
 * @param {Set} autoFightOrderSet - 用于存储秘境顺序的Set集合
 * @param {string} runConfig - 输入的配置字符串，仅在Load为input时使用
 */
async function loadMode(Load, autoFightOrderSet, runConfig) {
    switch (Load) {
        case LoadType.uid:

            // 通过UID方式加载配置
            const uid = config.user.uid || (await ocrUid()) // 获取用户UID，如果未配置则通过OCR识别获取
            const configAutoFightOrderMap = JSON.parse(file.readTextSync(config.path.runConfig)) || new Map() // 读取本地配置文件并转换为Map对象
            const uidConfigList = configAutoFightOrderMap.get(uid) || []; // 获取当前UID对应的配置列表
            if (uidConfigList?.length > 0) {
                // 如果配置列表不为空，遍历并添加到结果集合中
                uidConfigList.forEach(item => {
                    // 将秘境顺序对象添加到列表中
                    // 主逻辑优化
                    // if (item.day !== undefined) {
                    //     item.day = parseDay(item.day);
                    // }
                    if (item.days && item.days.length > 0) {
                        item.days = item.days.map(day => parseDay(day))
                        // item.day = parseDay(item.day);
                    }
                    autoFightOrderSet.add(item)
                })
            }
            break
        case LoadType.input:
            // 通过输入字符串方式加载配置
            if (runConfig) {
                // 处理输入字符串：去除首尾空格，将中文逗号替换为英文逗号，然后按逗号分割
                runConfig.trim().replaceAll('，', ',').split(",").forEach(
                    item => {
                        // 将当前项按"|"分割成数组
                        let arr = item.split("|")
                        // 创建秘境信息对象
                        let autoFight = {
                            domainName: undefined,//秘境名称
                            partyName: undefined,//队伍名称
                            sundaySelectedValue: undefined,//周日|限时选择的值
                            DomainRoundNum: undefined,//副本轮数
                        }
                        let runType = arr[0]; // 解析运行类型
                        if (!config.user.runTypes.includes(runType)) {
                            throwError(`运行类型${runType}输入错误`)
                        }
                        let partyName = arr[1]; // 解析队伍名称
                        let domainName = arr[2]; // 解析秘境名称
                        let domainRoundNum = arr[3]; // 解析副本轮数
                        let sundaySelectedValue = arr[4]; // 解析周日|限时选择的值
                        // let day = arr[4].trim() != "" ? parseInt(arr[4]) : undefined;
                        let days = arr[5].trim() !== ""
                            ? arr[4].split('/').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
                            : [];
                        // 解析顺序值，处理可能的无效值
                        let order = (() => {
                            const rawOrder = arr[6]; // 获取原始值
                            if (rawOrder == null || String(rawOrder).trim() === "") {
                                return 0; // 若为空或无效值，默认返回 0
                            }
                            const parsedOrder = parseInt(String(rawOrder).trim(), 10); // 转换为整数
                            return isNaN(parsedOrder) ? 0 : parsedOrder; // 若转换失败，返回默认值 0
                        })();


                        // 检查秘境名称是否有效
                        if (!config.domainNames.has(domainName)) {
                            //秘境名称没有记录 查询是否是物品名称
                            if (config.itemNames.has(domainName)) {
                                const domainNameTemp = config.domainItemsMap.get(domainName);
                                if (!domainNameTemp) {
                                    throw new Error(`${domainName} 输入错误`);
                                }
                                const domainSelectedValue = parseInt(config.domainOrderMap.get(domainName) + "");
                                sundaySelectedValue = domainSelectedValue
                                domainName = domainNameTemp
                            } else {
                                throw new Error(`${domainName} 输入错误`);
                            }
                        }

                        // 设置秘境信息的各个属性
                        autoFight.partyName = partyName       // 队伍名称
                        autoFight.domainName = domainName      // 秘境名称
                        autoFight.DomainRoundNum = domainRoundNum  // 副本轮数
                        autoFight.sundaySelectedValue = sundaySelectedValue // 周日|限时选择的值
                        // 创建秘境顺序对象
                        let autoFightOrder = {
                            order: order,      // 顺序值
                            // day: day,// 执行日期
                            days: days,        // 执行日期（数组）
                            autoFight: autoFight // 秘境信息对象
                        }
                        // 将秘境顺序对象添加到列表中
                        autoFightOrderSet.add(autoFightOrder)
                        // autoFightOrderSet.push(autoFightOrder)
                    }
                )
            }
            break
        case LoadType.bgi_tools:
            // 通过bgi_tools方式加载配置
            log.info(`开始拉取bgi_tools配置`)
            const uidConfigListBgiTools = await pullJsonConfig(config.user.uid + '', config.bgi_tools.api.httpPullJsonConfig) || []
            if (uidConfigListBgiTools?.length > 0) {
                // 如果配置列表不为空，遍历并添加到结果集合中
                uidConfigListBgiTools.forEach(item => {
                    // 将秘境顺序对象添加到列表中
                    // 主逻辑优化
                    if (item.days && item.days.length > 0) {
                        item.days = item.days.map(day => parseDay(day))
                        // item.day = parseDay(item.day);
                    }
                    autoFightOrderSet.add(item)
                })
            }
            break
        default:
            throw new Error("请先配置加载方式");
            break;
    }
}

/**
 * 初始化执行顺序列表
 * @param {string} domainConfig - 输入的字符串，包含秘境顺序信息
 * @returns {Array} 返回处理后的秘境顺序列表
 */
async function initRunOrderList(domainConfig) {
    const autoFightOrderSet = new Set() // 存储秘境顺序列表的数组
    /*    let te = {
            order: 1,      // 顺序值
            day: 0,// 执行日期
            autoFight: {
                domainName: undefined,//秘境名称
                partyName: undefined,//队伍名称
                sundaySelectedValue: undefined,//周日|限时选择的值
                DomainRoundNum: undefined,//副本轮数
            } // 秘境信息对象
        }*/
    // let Load = LoadType.uid

    for (const Load of config.run.loads) {
        await loadMode(Load.load, autoFightOrderSet, domainConfig);
    }

    // 检查是否已配置秘境
    if (autoFightOrderSet.length <= 0) {
        throw new Error("请先配置体力配置");
    }
    // 返回处理后的秘境顺序列表
    let from = Array.from(autoFightOrderSet);
    let dayOfWeek = await getDayOfWeek();
    log.debug(`old-from:{0}`, JSON.stringify(from))
    from = from.filter(item => {
        // if (item.day) {
        //     return item.day === dayOfWeek.day
        // }
        if (item.days && item.days.length > 0) {
            const includes = item.days.includes(dayOfWeek.day);
            log.debug(`[{1}]item.days:{0}`, dayOfWeek.day, JSON.stringify(item.days))
            return includes;
        }
        return true
    })
    from.sort((a, b) => b.order - a.order)
    log.debug(`from:{0}`, JSON.stringify(from))
    return from;
}

/**
 * 初始化函数
 * 该函数用于执行初始化操作，使用async/await处理异步操作
 */
async function init() {
    // 调用initConfig函数并等待其完成
    // 这是一个异步初始化配置的步骤
    await initSettings()
    await initConfig();
}

/**
 * 主函数，用于执行秘境自动刷取任务
 * @async
 */
async function main() {
    // 初始化配置
    await init();
    if (config.bgi_tools.open.open_push) {
        log.info(`开始推送bgi_tools配置`)
        await pushAllJsonConfig(JSON.parse(file.readTextSync(config.path.domain)), config.bgi_tools.api.httpPushAllJsonConfig, config.bgi_tools.token)
    }
    // 获取配置
    let runConfig = config.run.config;
    //"队伍名称|秘境名称/刷取物品名称|刷几轮|限时/周日|周几执行(0-6)不填默认执行|执行顺序,..."
    const autoRunOrderList = await initRunOrderList(runConfig);
    const list = autoRunOrderList.filter(item => item.runType===config.user.runTypes[0]&&item.autoFight.DomainRoundNum > 0)
    if (list?.length > 0) {
        await autoRunList(list);
    } else {
        log.info(`本日无计划`)
    }

}

(async function () {
    // await test()
    // await test1()
    await main()
})()

async function test() {
    await init();
    const text = file.readTextSync(config.path.domain);
    // log.info("settings:{1}",config.info.settings)
    // log.info("text:{1}",text)
    const list = JSON.parse(text);
    // log.info("list:{1}",list)
    log.info("httpPullJsonConfig:{1}", config.bgi_tools.api.httpPushAllJsonConfig)
    log.info("|test==>config.bgi_tools:{1}", JSON.stringify(config.bgi_tools))
    await pushAllJsonConfig(list, config.bgi_tools.api.httpPushAllJsonConfig)
}


async function test1() {
    await init();
    // log.info("text:{1}",text)
    // log.info("list:{1}",list)
    log.info("httpPullJsonConfig:{1}", config.bgi_tools.api.httpPullJsonConfig)
    log.info("|test==>config.bgi_tools:{1}", JSON.stringify(config.bgi_tools))
    const list = await pullJsonConfig(config.user.uid, config.bgi_tools.api.httpPullJsonConfig)
    log.info("list:{1}", JSON.stringify(list))
}
