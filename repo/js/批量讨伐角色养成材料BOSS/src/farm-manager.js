import { openStatusPanel,updateStatusPanel, closeStatusPanel } from "./status-panel.js";
import { runAutoFight } from "./auto-fight.js";
import { autoNavigateToReward, takeReward } from "./reward.js";
import { navigateToBoss, repositionAfterFight } from "./boss-pathing.js";
import { saveConfig } from "./config.js";
import { isToday, getToday, isCancellationError } from "./utils.js";

/**
 * 刷取模式枚举
 * @description 定义 Boss 刷取的三种模式：
 * - ONCE: 一次性刷取，完成后不再重复
 * - DAILY_LIMIT: 每日限量刷取，达到每日上限后停止，剩余次数保留
 * - DAILY: 每日重置刷取，每天重置后恢复满额次数
 * @readonly
 * @type {{ ONCE: '一次性', DAILY_LIMIT: '一次性-每日限量', DAILY: '每日重置' }}
 */
const FARM_MODES = {
    ONCE: "一次性",
    DAILY_LIMIT: "一次性-每日限量",
    DAILY: "每日重置"
};

/**
 * Boss 配置对象
 * @typedef {Object} BossConfig
 * @property {string} name - Boss 名称
 * @property {string} team - 使用的队伍名称，"不切换" 表示不切换队伍
 * @property {string} farmMode - 刷取模式，值为 FARM_MODES.ONCE / FARM_MODES.DAILY_LIMIT / FARM_MODES.DAILY
 * @property {number} totalCount - 总讨伐次数（一次性模式）
 * @property {number} remainingCount - 剩余讨伐次数
 * @property {number} dailyLimitCount - 每日刷取上限次数
 * @property {number} dailyRemainingCount - 每日剩余次数
 * @property {boolean} returnToStatueAfterEachRound - 是否每轮讨伐后返回七天神像
 * @property {Object} fightParam - 战斗参数对象
 * @property {string} fightParam.strategyName - 战斗策略名称
 * @property {number} fightParam.timeout - 战斗超时时间（秒）
 * @property {string} [lastFarmTime] - 上次刷取日期（YYYYMMDD格式），为空时表示从未刷取过
 */

/**
 * 执行单次 Boss 讨伐（包含前往、战斗、领取奖励）
 * @description 尝试最多2次讨伐当前 Boss，包含导航到 Boss、执行战斗、导航到奖励点、领取奖励
 * @param {BossConfig} boss - Boss 配置对象
 * @param {number} round - 当前是第几轮
 * @param {boolean} goToBoss - 是否需要导航到 Boss
 * @returns {Object} 返回结果 { battleSuccess: boolean, goToBoss: boolean, isInsufficientResin: boolean }
 * @async
 */
async function executeBossRound(boss, round, goToBoss) {
    let battleSuccess = false;
    let isInsufficientResin = false;

    for (let attempt = 1; attempt <= 2; attempt++) {
        //体力不足和战斗成功后无需重试
        if (isInsufficientResin || battleSuccess) {
            break;
        }

        if (goToBoss) {
            log.info(`🏃前往『{name}』`, boss.name);
            await navigateToBoss(boss.name);
        }

        try {
            log.info(`⚔️开始第 {round} 次讨伐的第 {attempt} 尝试`, round, attempt);
            await runAutoFight(boss.fightParam);
            await autoNavigateToReward();
            isInsufficientResin = await takeReward(isInsufficientResin);
            battleSuccess = true;
            goToBoss = false;
            // === 更新次数 ===
            if (!isInsufficientResin) {
                if (boss.farmMode === FARM_MODES.DAILY_LIMIT || boss.farmMode === FARM_MODES.ONCE) {
                    boss.remainingCount--;
                }
                if (boss.farmMode === FARM_MODES.DAILY_LIMIT || boss.farmMode === FARM_MODES.DAILY) {
                    boss.dailyRemainingCount--;
                }
            }
            break;
        } catch (error) {
            // 区分取消异常和真正错误
            if (isCancellationError(error)) {
                throw error; // 取消异常直接向上抛出，由调用方处理
            }
            log.error(`❌讨伐『${boss.name}』失败: ${error}`);
            battleSuccess = false;
            continue;
        }
    }

    return { battleSuccess, goToBoss, isInsufficientResin };
}

/**
 * 获取 Boss 当前剩余可讨伐次数
 * @description 根据刷取模式计算当前可讨伐次数：
 * - 每日重置：新一天重置为每日上限，否则返回当前每日剩余次数
 * - 一次性-每日限量：新一天重置为 min(每日上限, 总剩余)，非新一天也受总剩余限制
 * - 一次性：返回总剩余次数，已完成则返回 -1
 * @param {BossConfig} boss - Boss 配置对象
 * @returns {number} 剩余可讨伐次数，返回 -1 表示需要跳过
 */
function getRemainingCount(boss) {
    const isNewDay = !boss.lastFarmTime || !isToday(boss.lastFarmTime);

    switch (boss.farmMode) {
        case FARM_MODES.DAILY:
            if (isNewDay) {
                boss.dailyRemainingCount = boss.dailyLimitCount;
                boss.lastFarmTime = getToday();
                log.info(`今天还未刷取此配置的{name}，重置今日刷取次数`, boss.name);
            }
            if (boss.dailyRemainingCount < 1) {
                log.info(`今日刷取此配置的{name}达到上限，跳过`, boss.name);
                return -1;
            }
            return boss.dailyRemainingCount;

        case FARM_MODES.DAILY_LIMIT:
            if (isNewDay) {
                boss.dailyRemainingCount = Math.min(boss.dailyLimitCount, boss.remainingCount);
                boss.lastFarmTime = getToday();
                log.info(`今天还未刷取此配置的{name}，重置今日刷取次数`, boss.name);
            } else {
                boss.dailyRemainingCount = Math.min(boss.dailyRemainingCount, boss.remainingCount);
            }
            if (boss.dailyRemainingCount < 1) {
                log.info(`今日刷取此配置的{name}达到上限，跳过`, boss.name);
                return -1;
            }
            return boss.dailyRemainingCount;

        case FARM_MODES.ONCE:
        default:
            if (boss.remainingCount <= 0) {
                log.info(`Boss "{name}" 已完成全部{totalCount}次讨伐。跳过`, boss.name, boss.totalCount);
                return -1;
            }
            return boss.remainingCount;
    }
}

/**
 * 遍历整个 Boss 讨伐列表，按照讨伐次数自动讨伐并领取奖励
 * @description 核心讨伐循环，包含：体力检查、每日限制、队伍切换、战斗执行、奖励领取、重定位
 * @param {BossConfig[]} config - Boss 配置数组
 * @async
 * @variables
 * - {boolean} isInsufficientResin - 标记树脂是否不足，不足时终止讨伐
 * - {boolean} goToBoss - 标记是否需要重新导航到 Boss 位置
 * - {boolean} returnToStatueAfterEachRound - 是否每轮讨伐后返回七天神像
 * - {number} remainingCount - 根据刷取模式计算的当前剩余讨伐次数
 */
async function runFarm(config) {
    const cancelToken = dispatcher.getLinkedCancellationToken();

    try {
        /** 标记树脂是否不足，不足时终止讨伐 */
        let isInsufficientResin = false;

        // --- 遍历Boss列表 ---
        for (let boss of config) {

            /** 标记是否需要重新导航到 Boss 位置 */
            let goToBoss = true;

            if (isInsufficientResin) {
                log.info(`体力不足，结束刷取BOSS材料`);
                break;
            }

            // 检查取消状态
            if (cancelToken.isCancellationRequested) {
                break;
            }

            /** 当前剩余可讨伐次数 */
            const remainingCount = getRemainingCount(boss);
            if (remainingCount < 0) {
                continue;
            }

            // --- 切换队伍 ---
            if (boss.team !== "不切换") {
                log.info(`切换队伍『{team}』`, boss.team);
                await genshin.switchParty(boss.team);
            }

            // --- 根据剩余次数循环讨伐 ---
            for (let round = 1; round <= remainingCount; round++) {
                // 每次循环开始检查取消状态
                if (cancelToken.isCancellationRequested) {
                    break;
                }

                //打开状态面板
                openStatusPanel();
                updateStatusPanel(boss, round - 1, remainingCount);

                if (isInsufficientResin) {
                    break; 
                }

                const result = await executeBossRound(boss, round, goToBoss);
                updateStatusPanel(boss, round, remainingCount);

                if (!result.battleSuccess) {
                    log.error(`💀战斗失败，跳过当前BOSS {name}`, boss.name);
                    break;
                }

                isInsufficientResin = result.isInsufficientResin;
                goToBoss = result.goToBoss;

                // 检查是否需要在每次讨伐后回七天神像 or 树脂不足返回安全地点
                if (boss.returnToStatueAfterEachRound || isInsufficientResin) {
                    await genshin.tp(2297.630859375, -824.5517578125);
                    await sleep(3000);
                    goToBoss = true;
                }

                await repositionAfterFight(boss, goToBoss);
            }
        }
    } catch (error) {
        // 区分取消异常和真正错误
        if (!isCancellationError(error)) {
            log.error(`执行讨伐时发生异常: ${error.message}`);
        }
    } finally {
        closeStatusPanel();
        log.info("📢脚本执行完毕,保存配置");
        saveConfig(config);
    }
}

export { runFarm, executeBossRound };
