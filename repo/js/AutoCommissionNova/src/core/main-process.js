/**
 * 主流程模块
 * 脚本的主入口逻辑
 */
import { loadSupportedCommissions, saveCommissionsData } from "../data/index.js";
import { recognizeCommissions, initCommissionReferenceData, readDailyCommissionRewardCount } from "../recognition/index.js";
import { executeCommissionTracking } from "./commission-executor.js";
import { enterCommissionScreen } from "../vision/index.js";
import { loadGlobalConfig } from "../loaders/global-config.js";
import { scanCommissionScopes } from "../loaders/process-scope.js";
import { isCancellationError } from "../utils/error-utils.js";

/**
 * 委托识别主函数
 * @param {Array} [commissionScopes] - 可复用的流程范围快照；不传时扫描一次流程目录
 * @returns {Promise<{commissions: Array, requiredSuccesses: number|null}>}
 */
export async function identification(commissionScopes) {
    try {
        log.info("开始执行委托识别");

        await genshin.returnMainUi();

        const scopes = commissionScopes ?? scanCommissionScopes().list;

        const supportedCommissions = await loadSupportedCommissions(scopes);

        await initCommissionReferenceData(supportedCommissions, scopes);

        const globalConfig = loadGlobalConfig();
        if (globalConfig.checkEncounterPoints) {
            try {
                await genshin.claimEncounterPointsRewards();
            } catch (error) {
                if (isCancellationError(error)) { throw error; }
                log.warn("领取历练点奖励失败，将以每日委托奖励进度决定后续执行: {error}", error.message);
            }
        }

        if (!await enterCommissionScreen()) {
            return { commissions: [], requiredSuccesses: null };
        }

        let requiredSuccesses = null;
        if (globalConfig.checkEncounterPoints) {
            const rewardCount = readDailyCommissionRewardCount();
            if (rewardCount === 4) {
                log.info("每日委托奖励已完成 4/4，跳过本次委托");
                return { commissions: [], requiredSuccesses: 0 };
            }
            if (rewardCount !== null) {
                requiredSuccesses = 4 - rewardCount;
                log.info("还需完成 {count} 个委托以满足每日奖励额度", requiredSuccesses);
            }
        }

        const commissions = await recognizeCommissions(supportedCommissions);

        if (commissions && commissions.length > 0) {
            const savedCommissions = await saveCommissionsData(commissions);
            log.info("委托识别完成，共识别到 {total} 个委托，其中 {supported} 个受支持",
                commissions.length, commissions.filter(function (c) { return c.supported; }).length);
            if (savedCommissions.length === 0) {
                throw new Error("没有成功保存可执行的委托");
            }
            return { commissions: savedCommissions, requiredSuccesses };
        } else {
            throw new Error("委托识别失败或未识别到任何委托");
        }
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("识别委托时出错: {error}", error.message);
        log.debug("错误详情: {error}", error);
        return { commissions: [], requiredSuccesses: null };
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
        const identificationResult = await identification(commissionScopes);
        if (identificationResult.requiredSuccesses === 0) {
            await genshin.returnMainUi();
            return;
        }
        if (identificationResult.commissions.length === 0) {
            log.warn("未获得本次有效委托识别结果，停止执行以避免复用旧数据");
            await genshin.returnMainUi();
            return;
        }

        await prepareForCommission();

        await executeCommissionTracking(stepRegistry, identificationResult.requiredSuccesses);

        const globalConfig = loadGlobalConfig();
        if (!globalConfig.skipSafeTeleport) {
            log.info("前往安全地点");
            await genshin.tpToStatueOfTheSeven();
        }
        log.info("每日委托执行完成");

    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("执行主流程时出错: {error}", error.message);
    }
}
