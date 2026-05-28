import {
    buildInitConfigSettings,
    config,
    initConfig,
    initSettings,
} from './config/config';
import {outDomainUI} from './utils/tool';
import {pullJsonConfig, pushAllCountryConfig, pushAllJsonConfig} from './utils/bgi_tools';
import {countAllResin, Physical} from "./utils/physical";
import {
    autoRunList,
    initRunOrderList,
    checkAndFilterStygianOnslaught
} from './utils/load_check_run'

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
        await pushAllJsonConfig(JSON.parse(file.readTextSync(config.path.domain)), config.bgi_tools.api.httpPushAllJsonConfig, config.bgi_tools.token)
        await pushAllCountryConfig(JSON.parse(file.readTextSync(config.path.countryList)), config.bgi_tools.api.httpPushAllCountryConfig, config.bgi_tools.token)
    }
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
    let list = autoRunOrderList.filter(item =>
        (item.runType === config.user.runTypes[0] && parseInt(item?.autoFight.domainRoundNum || "0") > 0)
        || (item.runType === config.user.runTypes[1] && parseInt(item?.autoLeyLineOutcrop.count || "0") > 0) 
        || (item.runType === config.user.runTypes[2])
    )
    log.info("|test1==>list:{1}", JSON.stringify(list))
    list = await checkAndFilterStygianOnslaught(list)
    log.info("|test2==>list:{1}", JSON.stringify(list))
    log.info("|test3==>list?.length:{1}", list?.length)
    if (list?.length > 0) {
        //循环跑
        while (true) {
            await autoRunList(list);
            if (config.run.loop_plan) {
                // 重新获取当前体力值
                // const physicalOcr = await ocrPhysical(true, true);
                const currentPhysical = await Physical.countAllResin()
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

async function test2() {
    await init();
    await outDomainUI();
}