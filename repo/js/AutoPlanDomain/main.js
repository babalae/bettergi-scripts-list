import {config, initConfig, initSettings, LoadType} from './config/config';
import {ocrUid} from './utils/uid';
import {pullJsonConfig, pushAllJsonConfig} from './utils/bgi_tools';

/**
 * 自动执行秘境任务的异步函数
 * @param {Object} autoFight - 包含秘境自动配置参数的对象
 * @returns {Promise<void>} - 执行完成后返回的Promise
 */
async function autoDomain(autoFight) {
    // 创建秘境参数对象，初始化值为0
    let domainParam = new AutoDomainParam(autoFight.DomainRoundNum);
    //秘境名称
    domainParam.DomainName = autoFight.domainName || domainParam.DomainName;
    //队伍名称
    domainParam.PartyName = autoFight.partyName || domainParam.PartyName;
    //周日|限时选择的值
    domainParam.SundaySelectedValue = autoFight.sundaySelectedValue || domainParam.SundaySelectedValue;
    //副本轮数
    // domainParam.domainRoundNum = autoFight.DomainRoundNum || domainParam.DomainRoundNum;
    await dispatcher.RunAutoDomainTask(domainParam);
}

/**
 * 自动执行秘境任务列表处理函数
 * @param {Array} autoDomainOrderList - 包含秘境自动配置的数组
 */
async function autoDomainList(autoDomainOrderList) {
    //计划执行
    for (const item of autoDomainOrderList) {
        await autoDomain(item.autoFight);
    }
}

/**
 * 根据不同的加载方式加载秘境配置
 * @param {string} Load - 加载方式类型，如uid或input
 * @param {Set} autoFightOrderSet - 用于存储秘境顺序的Set集合
 * @param {string} domainConfig - 输入的配置字符串，仅在Load为input时使用
 */
async function loadMode(Load, autoFightOrderSet, domainConfig) {
    switch (Load) {
        case LoadType.uid:

            // 通过UID方式加载配置
            const uid = config.user.uid || (await ocrUid()) // 获取用户UID，如果未配置则通过OCR识别获取
            const configAutoFightOrderMap = JSON.parse(file.readTextSync(config.path.domainConfig)) || new Map() // 读取本地配置文件并转换为Map对象
            const uidConfigList = configAutoFightOrderMap.get(uid) || []; // 获取当前UID对应的配置列表
            if (uidConfigList?.length > 0) {
                // 如果配置列表不为空，遍历并添加到结果集合中
                uidConfigList.forEach(item => {
                    // 将秘境顺序对象添加到列表中
                    autoFightOrderSet.add(item)
                })
            }
            break
        case LoadType.input:
            // 通过输入字符串方式加载配置
            if (domainConfig) {
                // 处理输入字符串：去除首尾空格，将中文逗号替换为英文逗号，然后按逗号分割
                domainConfig.trim().replaceAll('，', ',').split(",").forEach(
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
                        let partyName = arr[0]; // 解析队伍名称
                        let domainName = arr[1]; // 解析秘境名称
                        let domainRoundNum = arr[2]; // 解析副本轮数
                        let sundaySelectedValue = arr[3]; // 解析周日|限时选择的值
                        // 解析顺序值，处理可能的无效值
                        let order = (() => {
                            const rawOrder = arr[4]; // 获取原始值
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
            const uidConfigListBgiTools = await pullJsonConfig(config.user.uid+'')||[]
            if (uidConfigListBgiTools?.length > 0) {
                // 如果配置列表不为空，遍历并添加到结果集合中
                uidConfigListBgiTools.forEach(item => {
                    // 将秘境顺序对象添加到列表中
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
 * 初始化秘境顺序列表
 * @param {string} domainConfig - 输入的字符串，包含秘境顺序信息
 * @returns {Array} 返回处理后的秘境顺序列表
 */
async function initDomainOrderList(domainConfig) {
    const autoFightOrderSet = new Set() // 存储秘境顺序列表的数组
    /*    let te = {
            order: 1,      // 顺序值
            autoFight: {
                domainName: undefined,//秘境名称
                partyName: undefined,//队伍名称
                sundaySelectedValue: undefined,//周日|限时选择的值
                DomainRoundNum: undefined,//副本轮数
            } // 秘境信息对象
        }*/
    // let Load = LoadType.uid

    for (const Load of config.domain.loads) {
        await loadMode(Load.load, autoFightOrderSet, domainConfig);
    }

    // 检查是否已配置秘境
    if (autoFightOrderSet.length <= 0) {
        throw new Error("请先配置秘境配置");
    }
    // 返回处理后的秘境顺序列表
    return Array.from(autoFightOrderSet);
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


    // 获取秘境配置
    let domainConfig = config.domain.config;

    //"队伍名称|秘境名称/刷取物品名称|刷几轮|限时/周日|执行顺序,..."
    const autoFightOrderList = initDomainOrderList(domainConfig);

    autoFightOrderList.sort((a, b) => b.order - a.order)
    await autoDomainList(autoFightOrderList);
}

await main()
