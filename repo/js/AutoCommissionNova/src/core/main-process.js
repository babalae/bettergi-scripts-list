/**
 * 主流程模块
 * 脚本的主入口逻辑
 */
import { loadSupportedCommissions, saveCommissionsData } from "../data/index.js";
import { recognizeCommissions, initCommissionReferenceData } from "../recognition/index.js";
import { executeCommissionTracking } from "./commission-executor.js";
import { enterCommissionScreen } from "../vision/index.js";
import { loadGlobalConfig } from "../loaders/global-config.js";
import { scanCommissionScopes } from "../loaders/process-scope.js";

/**
 * 委托识别主函数
 * @param {Array} [commissionScopes] - 可复用的流程范围快照；不传时扫描一次流程目录
 * @returns {Promise<Array>} 识别到的委托列表；失败时返回 []
 */
export async function identification(commissionScopes) {
    try {
        log.info("开始执行委托识别");

        await genshin.returnMainUi();

        const scopes = commissionScopes ?? scanCommissionScopes().list;

        const supportedCommissions = await loadSupportedCommissions(scopes);

        await initCommissionReferenceData(supportedCommissions, scopes);

        await enterCommissionScreen();

        const commissions = await recognizeCommissions(supportedCommissions);

        if (commissions && commissions.length > 0) {
            await saveCommissionsData(commissions);
            log.info("委托识别完成，共识别到 {total} 个委托，其中 {supported} 个受支持",
                commissions.length, commissions.filter(function (c) { return c.supported; }).length);
        } else {
            throw new Error("委托识别失败或未识别到任何委托");
        }
        return commissions;
    } catch (error) {
        log.error("识别委托时出错: {error}", error.message);
        log.debug("错误详情: {error}", error);
        return [];
    }
}

/**
 * 委托前准备工作：前往七天神像
 */
export async function prepareForCommission() {
    log.info("开始执行委托前准备");
    try {
        await genshin.returnMainUi();
        const globalConfig = loadGlobalConfig();
        if (!globalConfig.skipSafeTeleport) {
            await genshin.tpToStatueOfTheSeven();
        }
    } catch (error) {
        log.error("执行委托前准备时出错: {error}", error.message);
    }
}

/**
 * 主流程执行函数
 * @param {Object} stepRegistry - 步骤处理器注册表
 * @param {Array} [commissionScopes] - 启动阶段生成的流程范围快照
 */
export async function executeMainProcess(stepRegistry, commissionScopes) {
    try {
        await identification(commissionScopes);

        await prepareForCommission();

        await executeCommissionTracking(stepRegistry);

        const globalConfig = loadGlobalConfig();
        if (!globalConfig.skipSafeTeleport) {
            log.info("前往安全地点");
            await genshin.tpToStatueOfTheSeven();
        }
        log.info("每日委托执行完成");

    } catch (error) {
        log.error("执行主流程时出错: {error}", error.message);
    }
}

