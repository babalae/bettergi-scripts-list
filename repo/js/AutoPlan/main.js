import {
    buildInitConfigSettings,
    config,
    initConfig,
    initSettings,
} from './config/config';
import {outDomainUI,toMainUi} from './utils/tool';
import {BgiTools} from './utils/bgi_tools';
import {Physical} from "./utils/physical";
import {
    autoRunList,
    initRunOrderList,
    checkAndFilterStygianOnslaught
} from './utils/load_check_run'
import {Record} from "../ActivitySwitchNotice/utils/tool";
import {checkHolyRelicsKey} from "./utils/HolyRelics";

/**
 * 初始化函数
 * 该函数用于执行初始化操作，使用async/await处理异步操作
 */
async function init() {
    await buildInitConfigSettings()
    // 调用initConfig函数并等待其完成
    // 这是一个异步初始化配置的步骤
    await initSettings()
    await initConfig();

    if (config.bgi_tools.open.open_push) {
        log.info(`开始推送bgi_tools配置`)

        if (config.bgi_tools.api.httpPushAllJsonConfig?.trim())
            await BgiTools.pushAllDomainConfig(JSON.parse(file.readTextSync(config.path.domain)), config.bgi_tools.api.httpPushAllJsonConfig, config.bgi_tools.token)
        if (config.bgi_tools.api.httpPushAllCountryConfig?.trim())
            await BgiTools.pushAllCountryConfig(JSON.parse(file.readTextSync(config.path.countryList)), config.bgi_tools.api.httpPushAllCountryConfig, config.bgi_tools.token)
        if (config.bgi_tools.api.httpPushAllBossConfig?.trim())
            await BgiTools.pushAllBossConfig(JSON.parse(file.readTextSync(config.path.bossList)), config.bgi_tools.api.httpPushAllBossConfig, config.bgi_tools.token)
    }
}

/**
 * 检查并过滤掉不需要的任务
 * @param list
 * @returns {Promise<Array>}
 */
async function checkFilterMain(list = []) {
    const auto_check = Array.from(settings.auto_check)
    const runTypes = config.user.runTypes
    
    // 通用过滤函数
    const filterList = (items, excludeDomains = []) => items.filter(item =>
        (item.runType === runTypes[0] && parseInt(item?.autoFight.domainRoundNum || "0") > 0 && !excludeDomains.includes(item?.autoFight.domainName))
        || (item.runType === runTypes[1] && parseInt(item?.autoLeyLineOutcrop.count || "0") > 0)
        || (item.runType === runTypes[2]) || (item.runType === runTypes[3])
    )
    
    let checkList = filterList(list)
    log.debug("auto_check:{1}", JSON.stringify(auto_check))
    // 1.秘境圣遗物过滤(检查圣遗物背包中剩余空间是否达到阈值)
    if (auto_check.includes("圣遗物空间检查")) {
        log.info(`开始检查圣遗物背包剩余空间`)
        const domainList = (Record.read(config.path.domain) || [])
            .filter(item => !item.hasOrder)
            .map(item => item.name)
        // log.debug("domainList:{1}", JSON.stringify(domainList))
        const hasHolyRelicDomain = checkList.some(item =>
            item.runType === runTypes[0] && item.autoFight.domainName && domainList.includes(item.autoFight.domainName)
        )
        log.debug("hasHolyRelicDomain:{1}", hasHolyRelicDomain)
        if (hasHolyRelicDomain) {
            const threshold = parseInt((settings.holy_relic_threshold || '').replace(/[^\d]/g, '') || '100')
            await toMainUi()
            if (await checkHolyRelicsKey(threshold)) {
                log.info(`圣遗物背包剩余空间不足{1}，已过滤掉秘境圣遗物任务`,threshold)
                checkList = filterList(list, domainList)
                log.debug("checkList:{1}", JSON.stringify(checkList))
            }
            await toMainUi()
        }
    }
    
    // 2.幽境过滤
    if (auto_check.includes("幽境检查")) {
        log.info(`开始检查幽境`)
        checkList = await checkAndFilterStygianOnslaught(checkList)
    }
    
    return checkList
}

/**
 * 主函数，用于执行秘境自动刷取任务
 * @async
 */
async function main() {
    // 初始化配置
    await init();
    // 获取配置
    let runConfig = config.run.config;
    //"队伍名称|秘境名称/刷取物品名称|刷几轮|限时/周日|周几执行(0-6)不填默认执行|执行顺序,..."
    const autoRunOrderList = await initRunOrderList(runConfig);
    let list = await checkFilterMain(autoRunOrderList)
    if (list?.length > 0) {
        //循环跑
        while (true) {
            await autoRunList(list);
            if (config.run.loop_plan) {
                // 重新获取当前体力值
                // const physicalOcr = await ocrPhysical(true, true);
                const currentPhysical = await Physical.countAllResin()
                config.user.physical.currentJson = currentPhysical;
                config.user.physical.current = currentPhysical.originalResinCount;
                //循环
                if (config.user.physical.current < config.user.physical.min) {
                    //体力耗尽
                    break
                }
            } else {
                //不循环
                break
            }

        }
    } else {
        log.info(`本日无计划`)
    }

}

(async function () {
    // await test()
    // await test1()
    // await test2()
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
    await BgiTools.pushAllDomainConfig(list, config.bgi_tools.api.httpPushAllJsonConfig)
}


async function test1() {
    await init();
    // log.info("text:{1}",text)
    // log.info("list:{1}",list)
    log.info("httpPullJsonConfig:{1}", config.bgi_tools.api.httpPullJsonConfig)
    log.info("|test==>config.bgi_tools:{1}", JSON.stringify(config.bgi_tools))
    const list = await BgiTools.pullJsonConfig(config.bgi_tools.api.httpPullJsonConfig, config.user.uid + '')
    log.info("list:{1}", JSON.stringify(list))
}

async function test2() {
    await init();
    await outDomainUI();
}