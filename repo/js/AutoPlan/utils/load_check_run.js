import {config, LoadType} from "../config/config";
import {countAllResin} from "./physical";
import {getDayOfWeek, outDomainUI, outStygianOnslaughtUI, parseInteger, throwError,toMainUi} from "./tool";
import {findStygianOnslaught} from "./activity";
import {pullJsonConfig} from "./bgi_tools";

/*===========================================[check]===========================================*/
/**
 * 检查并过滤幽境危战紊乱爆发期的任务列表
 * @param {Array} list - 任务列表
 * @returns {Promise<Array>} - 处理后的任务列表
 */
export async function checkAndFilterStygianOnslaught(list) {
    // 检查列表中是否存在幽境危战任务
    const hasStygianOnslaught = list.some(item => item.runType === config.user.runTypes[2]);
    if (hasStygianOnslaught) {
        // 记录日志：检查幽境危战紊乱爆发期开放
        log.info(`{0}`, `检查幽境危战紊乱爆发期开放`)
        try {
            // 切换到主界面
            await toMainUi()
            // 查找当前是否有幽境危战
            const isStygianOnslaught = await findStygianOnslaught();
            if (isStygianOnslaught) {
                // 获取所有没有排序的圣遗物秘境名称
                //圣遗物秘境名称
                const holyRelicDomainNames = config.domainList.filter(item => !item.hasOrder).map(item => item.name);
                const filter = list.find(item => item.runType === config.user.runTypes[0] && holyRelicDomainNames.includes(item.autoFight?.domainName));
                if (filter) {
                    // 幽境危战添加秘境顺序前
                    list.forEach(item => {
                        if (item.runType === config.user.runTypes[2]) {
                            item.order = Math.max(filter.order + 1, item.order)
                        }
                    })
                    list.sort((item1, item2) => item2.order - item1.order)
                }
                log.info(`{0}`, `幽境危战紊乱爆发期已开启`)
            } else {
                log.info(`{0}`, `幽境危战紊乱爆发期已结束`)
                list = list.filter(item => item.runType !== config.user.runTypes[2])
            }
            return list
        } finally {
            await toMainUi()
        }
    }
}

/*===========================================[load]===========================================*/
/**
 * 根据不同的加载方式加载秘境配置
 * @param {string} Load - 加载方式类型，如uid或input
 * @param {Set} autoOrderSet - 用于存储秘境顺序的Set集合
 * @param {string} runConfig - 输入的配置字符串，仅在Load为input时使用
 */
export async function loadMode(Load, autoOrderSet, runConfig) {
    switch (Load) {
        case LoadType.input:
            // 通过输入字符串方式加载配置
            if (runConfig) {
                // 处理输入字符串：去除首尾空格，将中文逗号替换为英文逗号，然后按逗号分割
                runConfig.trim().replaceAll('，', ',').split(",").forEach(
                    item => {
                        let {arr, index, runType, autoOrder} = buildOrder(item);

                        if (!config.user.runTypes.includes(runType)) {
                            throwError(`运行类型${runType}输入错误`)
                        } else if (config.user.runTypes[0] === runType) {
                            const __ret = buildDomain(arr, index);
                            let autoFight = __ret.autoFight;
                            index = __ret.index;
                            autoOrder.autoFight = autoFight // 将秘境信息对象添加到秘境顺序对象中
                        } else if (config.user.runTypes[1] === runType) {
                            const __ret = buildLeyLineOutcrop(arr, index);
                            let autoLeyLineOutcrop = __ret.autoLeyLineOutcrop;
                            index = __ret.index;

                            autoOrder.autoLeyLineOutcrop = autoLeyLineOutcrop // 将地脉信息对象添加到顺序对象中
                        } else if (config.user.runTypes[2] === runType) {
                            const __ret = buildStygianOnslaught(arr,index);
                            let autoStygianOnslaught = __ret.autoStygianOnslaught;
                            index = __ret.index;
                            autoOrder.autoStygianOnslaught = autoStygianOnslaught
                        }

                        // 将秘境顺序对象添加到列表中
                        autoOrderSet.add(autoOrder)
                    }
                )
            }
            break

        case LoadType.uid:
            await toMainUi()
            // 通过UID方式加载配置
            const uid = config.user.uid || (await genshin.uid()) // 获取用户UID，如果未配置则通过OCR识别获取
            // const configAutoFightOrderMap = JSON.parse(file.readTextSync(config.path.runConfig)) || new Map() // 读取本地配置文件并转换为Map对象
            // const uidConfigList = configAutoFightOrderMap.get(uid + "") || []; // 获取当前UID对应的配置列表

            const configAutoFightOrderMap = JSON.parse(file.readTextSync(config.path.runConfig)) || {} // 读取本地配置文件
            const uidConfigList = configAutoFightOrderMap[uid + ""] || []; // 获取当前UID对应的配置列表
            if (uidConfigList?.length > 0) {
                // 如果配置列表不为空，遍历并添加到结果集合中
                uidConfigList.forEach(item => {
                    // 将秘境顺序对象添加到列表中
                    // 主逻辑优化
                    // if (item.day !== undefined) {
                    //     item.day = parseInteger(item.day);
                    // }
                    if (item.days && item.days.length > 0) {
                        item.days = item.days.map(day => parseInteger(day))
                        // item.day = parseInteger(item.day);
                    }
                    autoOrderSet.add(item)
                })
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
                        item.days = item.days.map(day => parseInteger(day))
                        // item.day = parseInteger(item.day);
                    }
                    autoOrderSet.add(item)
                })
            }
            break
        default:
            throw new Error("请先配置加载方式");
        // break;
    }
}

/**
 * 初始化执行顺序列表
 * @param {string} domainConfig - 输入的字符串，包含秘境顺序信息
 * @returns {Array} 返回处理后的秘境顺序列表
 */
export async function initRunOrderList(domainConfig) {
    const autoFightOrderSet = new Set() // 存储秘境顺序列表的数组
    /*    let te = {
            order: 1,      // 顺序值
            day: 0,// 执行日期
            autoFight: {
                domainName: undefined,//秘境名称
                partyName: undefined,//队伍名称
                sundaySelectedValue: undefined,//周日|限时选择的值
                domainRoundNum: undefined,//副本轮数
            } // 秘境信息对象
        }*/
    // let Load = LoadType.uid

    for (const Load of config.run.loads) {
        await loadMode(Load.load, autoFightOrderSet, domainConfig);
    }

    // 检查是否已配置秘境
    if (!autoFightOrderSet || autoFightOrderSet.size <= 0) {
        throw new Error("请先配置体力配置");
    }
    // 返回处理后的秘境顺序列表
    let from = Array.from(autoFightOrderSet);
    let dayOfWeek = await getDayOfWeek();
    log.debug(`old-from:{0}`, JSON.stringify(from))
    from = from
        //过滤掉不执行的秘境
        .filter(item => config.user.runTypes.includes(item.runType))
        .filter(item => {
            // if (item.day) {
            //     return item.day === dayOfWeek.day
            // }
            log.debug(`[{1}]item.days.length:{0}`, dayOfWeek.day, item?.days?.length || 0)
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
/*===========================================[build]===========================================*/
export function buildOrder(item) {
    // 将当前项按"|"分割成数组
    let arr = item.split("|")
    // 类型|执行日期|执行顺序
    let index = 0
    let runType = arr[index]; // 解析运行类型
    index++
    const rawDays = arr[index];
    let days = (rawDays != null && String(rawDays).trim() !== "")
        ? String(rawDays).split('/').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d))
        : [];
    // let days = arr[index].trim() !== ""
    //     ? arr[index].split('/').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
    //     : [];
    index++
    // 解析顺序值，处理可能的无效值
    let order = (() => {
        const rawOrder = arr[index]; // 获取原始值
        if (rawOrder == null || String(rawOrder).trim() === "") {
            return 0; // 若为空或无效值，默认返回 0
        }
        const parsedOrder = parseInt(String(rawOrder).trim(), 10); // 转换为整数
        return isNaN(parsedOrder) ? 0 : parsedOrder; // 若转换失败，返回默认值 0
    })();
    index++

    // 创建秘境顺序对象
    let autoOrder = {
        order: order,      // 顺序值
        // day: day,// 执行日期
        runType: runType,  // 运行类型
        days: days,        // 执行日期（数组）
        autoFight: undefined, // 秘境信息对象
        autoLeyLineOutcrop: undefined, // 地脉信息对象
        autoStygianOnslaught: undefined // 幽境信息对象
    }
    return {arr, index, runType, autoOrder};
}
export function buildDomain(arr, index) {
    return Domain.build(arr, index)
}
export function buildLeyLineOutcrop(arr, index) {
   return LeyLineOutcrop.build(arr, index)
}
export function buildStygianOnslaught(arr,index) {
    return StygianOnslaught.build(arr, index)
}
/*===========================================[run]===========================================*/
/**
 * 自动执行秘境任务的异步函数
 * @param {Object} autoFight - 包含秘境自动配置参数的对象
 * @returns {Promise<void>} - 执行完成后返回的Promise
 */
export async function autoDomain(autoFight) {
   await Domain.run(autoFight);
}

/**
 * 自动执行地脉花任务的异步函数
 * @param autoLeyLineOutcrop
 * @returns {Promise<void>}
 */
export async function autoLeyLineOutcrop(autoLeyLineOutcrop) {
    await LeyLineOutcrop.run(autoLeyLineOutcrop);
}

/**
 * 自动执行幽境危战任务的异步函数
 * @param autoStygianOnslaught
 * @returns {Promise<void>}
 */
export async function autoStygianOnslaught(autoStygianOnslaught) {
    await StygianOnslaught.run(autoStygianOnslaught);
}

/**
 * 自动执行列表处理函数
 * @param {Array} autoRunOrderList - 包含自动配置的数组
 */
export async function autoRunList(autoRunOrderList) {
    //计划执行
    for (const item of autoRunOrderList) {
        await sleep(3000)
        if (item.runType === config.user.runTypes[0]) {
            await autoDomain(item.autoFight);
        } else if (item.runType === config.user.runTypes[1]) {
            await autoLeyLineOutcrop(item.autoLeyLineOutcrop);
        } else if (item.runType === config.user.runTypes[2]) {
            await autoStygianOnslaught(item.autoStygianOnslaught);
        }
    }
}
/*===========================================[class]===========================================*/
class Base{
    static build(arr, index) {
        throw new Error("未实现build方法");
    }

    static async run(object) {
        throw new Error("未实现run方法");
    }
}
/**
 * Domain类，用于处理秘境相关的操作
 */
class Domain extends Base{
    /**
     * 构建秘境信息对象
     * @param {Array} arr - 包含秘境信息的数组
     * @param {number} index - 当前解析的位置索引
     * @returns {Object} 返回包含秘境信息对象和更新后的索引
     */
   static build(arr, index) {
        // 创建秘境信息对象，初始化默认值
        let autoFight = {
            domainName: undefined,//秘境名称
            partyName: undefined,//队伍名称
            sundaySelectedValue: 1,//周日|限时选择的值，默认为1
            domainRoundNum: 0,//副本轮数，默认为0
        }

        //"|队伍名称|秘境名称/刷取物品名称|刷几轮|限时/周日,..."
        let partyName = arr[index]; // 解析队伍名称
        index++
        let domainName = arr[index]; // 解析秘境名称
        index++
        let domainRoundNum = arr[index]; // 解析副本轮数
        index++
        let sundaySelectedValue = "1"
        if (index <= arr.length - 1)
            sundaySelectedValue = arr[index]; // 解析周日|限时选择的值

        // 检查秘境名称是否有效
        if (!config.domainNames.has(domainName)) {
            //秘境名称没有记录 查询是否是物品名称
            if (config.itemNames.has(domainName)) {
                const domainNameTemp = config.domainItemsMap.get(domainName);
                if (!domainNameTemp) {
                    throw new Error(`${domainName} 输入错误`);
                }
                if (index <= arr.length - 1) {
                    const domainSelectedValue = parseInt(config.domainOrderMap.get(domainName) + "");
                    sundaySelectedValue = domainSelectedValue
                }
                domainName = domainNameTemp
            } else {
                throw new Error(`${domainName} 输入错误`);
            }
        }

        // 设置秘境信息的各个属性
        autoFight.partyName = partyName       // 队伍名称
        autoFight.domainName = domainName      // 秘境名称
        autoFight.domainRoundNum = domainRoundNum  // 副本轮数
        autoFight.sundaySelectedValue = sundaySelectedValue // 周日|限时选择的值
        return {autoFight, index};
    }
    /**
     * 执行秘境任务
     * @param {Object} autoFight - 包含秘境信息的对象
     */
    static async run(autoFight) {
        log.info(`{0}`, "开始执行秘境任务")
        log.warn(`{0}`, "非体力耗尽情况下(受本体限制),等待退出秘境时间较长")
        // 创建秘境参数对象，初始化值为0
        let domainParam = new AutoDomainParam();
        //关闭榨干原粹树脂
        domainParam.specifyResinUse = true
        //定死做预留冗余 先不实现 不能指定次数 只能指定启用
        let physical_domain = autoFight?.physical
        //     || [
        //     {order: 0, name: config.user.physical.names[0], count: 1, open: true},
        //     {order: 1, name: config.user.physical.names[1], count: 0, open: false},
        //     {order: 2, name: config.user.physical.names[2], count: 0, open: false},
        //     {order: 3, name: config.user.physical.names[3], count: 0, open: false},
        // ]

        if ((!physical_domain) || physical_domain.filter(item => item?.open).length === 0) {
            const names = config.user.physical.names;
            physical_domain = []
            names.forEach((name, index) => {
                physical_domain.push({order: index, name: name, open: index === 0})
            })
        }

        physical_domain.sort((a, b) => a.order - b.order)
        // 不包含原粹树脂的和
        const noOriginalSum = physical_domain.filter(item => item?.name.trim() !== config.user.physical.names[0])
            .filter(item => item?.open).length;//求和
        // 只包含原粹树脂的和
        const originalSum = physical_domain.filter(item => item?.name?.trim() === config.user.physical.names[0])
            .filter(item => item?.open).length;
        const resinPriorityList = physical_domain.filter(item => item?.open).map(item => item?.name?.trim())
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
        // const physicalOcr = await ocrPhysical(true, true)
        // config.user.physical.current = physicalOcr.current
        // config.user.physical.min = physicalOcr.min

        const currentPhysical = await countAllResin()
        config.user.physical.current = currentPhysical.originalResinCount;

        const physical = config.user.physical
        if (domainParam.specifyResinUse && physical.current < physical.min && noOriginalSum <= 0 && originalSum > 0) {
            throwError(`体力不足，当前体力${physical.current}，最低体力${physical.min}，请手动补充体力后重试`)
        }

        //关闭分解
        domainParam.autoArtifactSalvage = false

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
            domainParam.DomainRoundNum = parseInt((autoFight.domainRoundNum || domainParam.DomainRoundNum) + "");
        } catch (e) {
            log.debug(`副本轮数:${autoFight.domainRoundNum}`)
            throwError(e.message)
        }
        log.debug(`副本轮数:${domainParam.DomainRoundNum}`)
        try {
            // 复活重试
            for (let i = 0; i < config.run.retry_count; i++) {
                try {
                    await dispatcher.RunAutoDomainTask(domainParam);
                    // 其他场景不重试
                    break;
                } catch (e) {
                    const errorMessage = e.message
                    // 只有选择了秘境的时候才会重试
                    if (errorMessage.includes("复活") && domainParam.DomainName) {
                        continue;
                    }
                    if (!config.run.exclude_run_exception || config.run.loop_plan) {//排除异常 与循环计划互斥
                        throw e;
                    }
                }
            }
        } finally {
            log.info(`{0}`, "执行完成")
            // 退出秘境
            await outDomainUI()
        }
    }
}

/**
 * 地脉刷取任务类
 * 用于处理地脉刷取任务的构建和执行
 */
class LeyLineOutcrop extends Base{
    /**
     * 构建地脉刷取任务参数
     * @param {Array} arr - 输入参数数组，包含队伍名称、国家、刷取轮数等信息
     * @param {number} index - 当前处理的参数索引
     * @returns {Object} 返回包含构建好的参数对象和新的索引
     */
    static build(arr, index) {
        // 注释解释了输入参数的格式
        //"|队伍名称|国家|刷几轮|花类型|好感队|是否使用脆弱树脂|是否使用须臾树脂|是否前往合成台合成浓缩树脂|是否使用冒险之证|发送详细通知|战斗超时时间,..."
        // 初始化地脉刷取任务参数对象
        let autoLeyLineOutcrop = {
            count: 0,                        // 刷几次（0=自动/无限）
            country: undefined,                     // 国家地区
            leyLineOutcropType: undefined, // 需映射为经验/摩拉
            useAdventurerHandbook: false,    // 是否使用冒险之证
            friendshipTeam: "",              // 好感队伍ID
            team: "",                        // 主队伍ID
            timeout: 120,                      // 超时时间（秒）
            isGoToSynthesizer: false,        // 是否前往合成台
            useFragileResin: false,          // 使用脆弱树脂
            useTransientResin: false,        // 使用须臾树脂（须臾=Transient）
            isNotification: false            // 是否通知
        }
        autoLeyLineOutcrop.team = arr[index]
        index++
        autoLeyLineOutcrop.country = arr[index]
        index++
        autoLeyLineOutcrop.count = arr[index]
        index++
        autoLeyLineOutcrop.leyLineOutcropType = arr[index]
        index++
        if (index <= arr.length - 1)
            autoLeyLineOutcrop.friendshipTeam = arr[index]
        index++

        if (index <= arr.length - 1)
            autoLeyLineOutcrop.useFragileResin = (arr[index] != null && arr[index].trim() !== "")
        index++
        if (index <= arr.length - 1)
            autoLeyLineOutcrop.useTransientResin = (arr[index] != null && arr[index].trim() !== "")
        index++
        if (index <= arr.length - 1)
            autoLeyLineOutcrop.isGoToSynthesizer = (arr[index] != null && arr[index].trim() !== "")
        index++
        if (index <= arr.length - 1)
            autoLeyLineOutcrop.useAdventurerHandbook = (arr[index] != null && arr[index].trim() !== "")
        index++
        if (index <= arr.length - 1)
            autoLeyLineOutcrop.isNotification = (arr[index] != null && arr[index].trim() !== "")

        index++
        if (index <= arr.length - 1)
            autoLeyLineOutcrop.timeout = parseInteger(arr[index])
        return {autoLeyLineOutcrop, index};
    }
    static async run(autoLeyLineOutcrop) {
        // autoLeyLineOutcrop = {
        //     "count": 0,
        //     "country": "country_cb3d792be8db",
        //     "leyLineOutcropType": "leyLineOutcropType_f259b77fabcb",
        //     // "isResinExhaustionMode": true,
        //     // "openModeCountMin": true,
        //     "useAdventurerHandbook": false,
        //     "friendshipTeam": "friendshipTeam_7122cab56b16",
        //     "team": "team_d0798ca3aa27",
        //     "timeout": 0,
        //     "isGoToSynthesizer": false,
        //     "useFragileResin": false,
        //     "useTransientResin": false,
        //     "isNotification": false
        // }


        log.info(`{0}`, "开始执行地脉任务")
        // if (true) {
        //     log.warn("地脉 暂不支持")
        //     return
        // }
        let param = new AutoLeyLineOutcropParam(parseInteger(autoLeyLineOutcrop.count + ""), autoLeyLineOutcrop.country, autoLeyLineOutcrop.leyLineOutcropType);
        // let param = new AutoLeyLineOutcropParam();
        // param.count = parseInteger(autoLeyLineOutcrop.count+"");
        // param.country = autoLeyLineOutcrop.country;
        // param.leyLineOutcropType = autoLeyLineOutcrop.leyLineOutcropType;
        //和本体保持一致
        param.useAdventurerHandbook = !autoLeyLineOutcrop.useAdventurerHandbook;
        param.friendshipTeam = autoLeyLineOutcrop.friendshipTeam;
        param.team = autoLeyLineOutcrop.team;
        param.timeout = autoLeyLineOutcrop.timeout;
        param.isGoToSynthesizer = autoLeyLineOutcrop.isGoToSynthesizer;
        param.useFragileResin = autoLeyLineOutcrop.useFragileResin;
        param.useTransientResin = autoLeyLineOutcrop.useTransientResin;
        param.isNotification = autoLeyLineOutcrop.isNotification;

        param.isResinExhaustionMode = true;
        param.openModeCountMin = true;
        await sleep(1000)
        // 复活重试
        for (let i = 0; i < config.run.retry_count; i++) {
            try {
                await dispatcher.RunAutoLeyLineOutcropTask(param);
                // 其他场景不重试
                break;
            } catch (e) {
                const errorMessage = e.message
                // 只有选择了秘境的时候才会重试
                if (errorMessage.includes("复活")) {
                    continue;
                }
                if (!config.run.exclude_run_exception || config.run.loop_plan) {//排除异常 与循环计划互斥
                    throw e;
                }
            }
        }
    }
}

/**
 * StygianOnslaught 类，用于处理幽境任务的相关操作
 */
class StygianOnslaught extends Base{
    /**
     * 构建幽境任务参数
     * @param {Array} arr - 输入参数数组
     * @param {number} index - 当前处理的参数索引
     * @returns {Object} 包含构建的参数和更新后的索引
     */
    static build(arr,index) {
        // 初始化幽境任务配置对象
        let autoStygianOnslaught = {
            bossNum: undefined,//boss1-3
            fightTeamName: "",//队伍名称
            specifyResinUse: undefined,//自定义树脂使用
            physical: [
                {order: 0, name: config.user.physical.names[1], open: true, count: 1},
                {order: 1, name: config.user.physical.names[0], open: true, count: 1},
                {order: 2, name: config.user.physical.names[2], open: false, count: 1},
                {order: 3, name: config.user.physical.names[3], open: false, count: 1}
            ],//副本轮数
        }
        if (index <= arr.length - 1) {
            const bossNum = parseInteger(arr[index]);
            if (bossNum && bossNum > 0 && bossNum <= 3) {
                autoStygianOnslaught.bossNum = bossNum
            }
        }
        index++
        if (index <= arr.length - 1) {
            const fightTeamName = arr[index];
            if (fightTeamName && fightTeamName.trim() !== "") {
                autoStygianOnslaught.fightTeamName = fightTeamName
            }
        }
        index++
        if (index <= arr.length - 1) {
            autoStygianOnslaught.specifyResinUse = arr[index].trim() !== ""
        }
        if (autoStygianOnslaught.specifyResinUse) {
            index++
            let line = 0
            if (index <= arr.length - 1) {
                if (arr[index]?.trim() !== "") {
                    const physical = []
                    const physicals = arr[index].trim().split("/");
                    for (let i = 0; i < physicals.length; i++) {
                        const item = physicals[i];
                        physical.push({order: i, name: item, open: true, count: 1})
                    }
                    line = physical.length
                    autoStygianOnslaught.physical = physical
                }
            }
            index++
            if (index <= arr.length - 1) {
                if (line > 0 && arr[index]?.trim() !== "") {
                    const counts = arr[index].trim().split("/")
                        .map(item => {
                            let count = parseInteger(item) || 1;
                            return count
                        });
                    autoStygianOnslaught.physical.forEach((item, index) => {
                        try {
                            item.count = counts[index] || 1;
                        } catch (e) {
                            log.warn(`解析${item.name}数量失败`)
                            throwError(`解析${item.name}数量失败`)
                        }
                    });
                }
            }
        }
        return {autoStygianOnslaught, index};
    }
    static async run(autoStygianOnslaught) {
        // autoStygianOnslaught = {
        //     /**boss 名字 1~3 */
        //     bossNum: 1,
        //     /**结束后是否自动分解圣遗物*/
        //     autoArtifactSalvage: false,
        //     /**指定树脂的使用次数*/
        //     specifyResinUse: false,
        //     /**自定义使用树脂优先级*/
        //     resinPriorityList: [""],
        //     /** 使用原粹树脂刷取副本次数*/
        //     originalResinUseCount: 0,
        //     /** 使用浓缩树脂刷取副本次数*/
        //     condensedResinUseCount: 0,
        //     /** 使用须臾树脂刷取副本次数*/
        //     transientResinUseCount: 0,
        //     /** 使用脆弱树脂刷取副本次数*/
        //     fragileResinUseCount: 0,
        //     /**指定战斗队伍*/
        //     fightTeamName: undefined
        // }
        log.debug(`autoStygianOnslaught ={0}`, JSON.stringify(autoStygianOnslaught))
        log.info(`{0}`, "开始执行幽境任务")
        let param = new AutoStygianOnslaughtParam()
        param.specifyResinUse = autoStygianOnslaught?.specifyResinUse || param.specifyResinUse

        //定死做预留冗余 先不实现 不能指定次数 只能指定启用
        let physical_domain = autoStygianOnslaught?.physical || []
        //     || [
        //     {order: 0, name: config.user.physical.names[0], count: 1, open: true},
        //     {order: 1, name: config.user.physical.names[1], count: 0, open: false},
        //     {order: 2, name: config.user.physical.names[2], count: 0, open: false},
        //     {order: 3, name: config.user.physical.names[3], count: 0, open: false},
        // ]

        if (param.specifyResinUse && ((!physical_domain) || physical_domain.filter(item => item?.open).length === 0)) {
            const names = config.user.physical.names;
            physical_domain = []
            names.forEach((name, index) => {
                physical_domain.push({order: index, name: name, open: index === 0, count: 1})
            })
        }

        physical_domain?.sort((a, b) => a.order - b.order)
        // 不包含原粹树脂的和
        const noOriginalSum = physical_domain.filter(item => item?.name.trim() !== config.user.physical.names[0])
            .filter(item => item?.open).length;//求和
        // 只包含原粹树脂的和
        const originalSum = physical_domain.filter(item => item?.name?.trim() === config.user.physical.names[0])
            .filter(item => item?.open).length;
        const physical_domain_filter = physical_domain.filter(item => item?.open);
        const resinPriorityList = physical_domain_filter.map(item => item?.name?.trim())
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
        // const physicalOcr = await ocrPhysical(true, true)
        // config.user.physical.current = physicalOcr.current
        // config.user.physical.min = physicalOcr.min
        const currentPhysical = await countAllResin()
        config.user.physical.current = currentPhysical.originalResinCount;

        const physical = config.user.physical
        if (physical.current < physical.min && noOriginalSum <= 0 && originalSum > 0) {
            throwError(`体力不足，当前体力${physical.current}，最低体力${physical.min}，请手动补充体力后重试`)
        }


        param.bossNum = autoStygianOnslaught?.bossNum > 0 && autoStygianOnslaught?.bossNum <= 3 ? autoStygianOnslaught.bossNum : param.bossNum
        param.fightTeamName = autoStygianOnslaught?.fightTeamName?.trim() !== "" ? autoStygianOnslaught.fightTeamName.trim() : param.fightTeamName
        if (resinPriorityList.length > 0) {
            param.SetResinPriorityList(...resinPriorityList)
            param.originalResinUseCount = physical_domain_filter.find(item => item?.name?.trim() === config.user.physical.names[0] && item?.open)?.count || 0
            param.condensedResinUseCount = physical_domain_filter.find(item => item?.name?.trim() === config.user.physical.names[1] && item?.open)?.count || 0
            param.transientResinUseCount = physical_domain_filter.find(item => item?.name?.trim() === config.user.physical.names[2] && item?.open)?.count || 0
            param.fragileResinUseCount = physical_domain_filter.find(item => item?.name?.trim() === config.user.physical.names[3] && item?.open)?.count || 0
        }

        await sleep(1000)
        try {
            // 复活重试
            for (let i = 0; i < config.run.retry_count; i++) {
                try {
                    await dispatcher.RunAutoStygianOnslaughtTask(param)
                    // 其他场景不重试
                    break;
                } catch (e) {
                    const errorMessage = e.message
                    if (errorMessage.includes("复活")) {
                        continue;
                    }
                    if (!config.run.exclude_run_exception || config.run.loop_plan) {//排除异常 与循环计划互斥
                        throw e;
                    }
                }
            }
        } finally {
            log.info(`{0}`, "执行完成")
            // 退出危战
            await outStygianOnslaughtUI()
        }
    }

}