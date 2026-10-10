/**
 * 委托执行调度模块
 * 遍历当前 UID 账号槽中的委托列表，按类型调度执行，支持重试
 *
 * 执行流程：
 * 1. 解析当前 UID，并加载该 UID 对应的委托数据
 * 2. 预统计已完成数量（用于后续完成状态判断）
 * 3. 遍历委托列表，过滤已完成、缺少地点、不支持的委托
 * 4. 按委托类型（NPC/Basic）通过 executorMap 调度执行
 * 5. 执行后检查完成状态，支持重试机制
 * 6. 成功完成后把委托状态和分支进度写回当前 UID 的数据槽
 */
import { COMMISSION_TYPE, COMMISSION_STATUS, MAX_COMMISSION_RETRY_COUNT } from "../config/index.js";
import { isCompleted } from "../recognition/index.js";
import { executeNpcCommission } from "./npc-executor.js";
import { executeBasicCommission } from "./basic-executor.js";
import { isCancellationError } from "../utils/error-utils.js";
import { dispatchOnCommissionComplete } from "../probes/index.js";
import { appendBranchCompletion, loadCurrentCommissionsData, updateCommissionStatus } from "../data/index.js";

/**
 * 委托类型 → 执行器映射
 * 新增委托类型时只需追加一行，无需改 executeCommissionTracking 主循环
 *
 * @param {Object} comm - 委托对象
 * @param {Object} stepRegistry - 步骤处理器注册表
 * @param {string} accountUid - 当前账号 UID
 */
const executorMap = {
    [COMMISSION_TYPE.NPC]: (comm, stepRegistry, accountUid) => executeNpcCommission(comm, stepRegistry, accountUid),
    [COMMISSION_TYPE.BASIC]: (comm, stepRegistry, accountUid) => executeBasicCommission(comm, stepRegistry, accountUid),
};

/**
 * 更新当前 UID 的分支完成进度
 * 委托任务成功完成后调用
 *
 * 仅当满足以下全部条件时把 context.activeBranch 写入 completedByUid[accountUid]：
 *   - context.accountUid 非空（确保进度写入当前账号槽）
 *   - context.branchCondition 非空（即 activeBranch 是带条件的成就分支，不是 default 兜底的偏好分支）
 *   - context.branchConditionMet === true（探针 step 检测到本次条件已达成）
 *
 * 偏好分支（branchCondition === null）永远不进 completedByUid，每次都可重新跑
 *
 * @param {string} commissionName - 委托名称
 * @param {Object} context - 执行上下文
 */
async function updateBranchCompletion(commissionName, context) {
    try {
        if (!context) {
            return;
        }

        const accountUid = context.accountUid;
        if (!accountUid) {
            log.warn("无法确认当前UID，跳过分支完成进度更新: {name}", commissionName);
            return;
        }

        const config = context.branchConfigCache;
        if (!config) {
            return;
        }

        const commissionConfig = config[commissionName];
        if (!commissionConfig) {
            return;
        }

        const activeBranch = context.activeBranch;
        if (!activeBranch || !context.branchCondition || !context.branchConditionMet) {
            return;
        }

        if (appendBranchCompletion(accountUid, commissionName, activeBranch)) {
            if (!commissionConfig.completedByUid) commissionConfig.completedByUid = {};
            const completed = commissionConfig.completedByUid[accountUid] || [];
            commissionConfig.completedByUid[accountUid] = [...completed, activeBranch];
            log.info("已更新分支完成进度: {branch}, UID: {uid}", activeBranch, accountUid);
        }
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("更新分支完成进度时出错: {error}", error.message);
    }
}

/**
 * 执行委托追踪（遍历+重试）
 *
 * 遍历当前 UID 识别到的委托列表，按类型（NPC/Basic）执行对应流程。
 * 每个委托支持重试机制，执行完成后检查状态。
 *
 * @param {Object} stepRegistry - 步骤处理器注册表
 * @returns {Promise<boolean>} 是否有委托执行成功
 */
export async function executeCommissionTracking(stepRegistry) {
    try {
        log.debug("开始执行委托追踪");
        await genshin.returnMainUi();

        let successCount = 0;

        const currentData = await loadCurrentCommissionsData();
        if (!currentData) {
            return false;
        }

        const { uid, account } = currentData;
        const allCommissions = account.commissions;
        const commissions = allCommissions.filter((c) => c.supported && c.status === COMMISSION_STATUS.UNCOMPLETED);
        const completedCount = allCommissions.filter((c) => c.status === COMMISSION_STATUS.COMPLETED).length;

        if (commissions.length === 0) {
            log.info("UID {uid} 已完成委托数量: {count}，剩余可执行的委托为空", uid, completedCount);
            return false;
        }

        for (const comm of commissions) {
            const executor = executorMap[comm.type];
            if (!executor) {
                log.warn("未知委托类型 {type}，跳过委托 {name}", comm.type, comm.name);
                continue;
            }

            // tryCount 0 是首次尝试，1..MAX 是重试；总尝试数 = MAX+1
            const totalAttempts = MAX_COMMISSION_RETRY_COUNT + 1;
            const typeLabel = comm.type === COMMISSION_TYPE.BASIC ? "Basic" : "NPC";
            let success = false;
            for (let tryCount = 0; tryCount <= MAX_COMMISSION_RETRY_COUNT && !success; tryCount++) {
                log.info(`执行委托：${comm.name} | ${comm.country || "-"}/${comm.location || "-"} | ${typeLabel} | 第 ${tryCount + 1}/${totalAttempts} 次`);

                const result = await executor(comm, stepRegistry, uid);
                dispatcher.ClearAllTriggers();

                if (result.success) {
                    const completed = await isCompleted(comm.name);
                    if (completed) {
                        success = true;
                        successCount++;
                        // 持久化已完成状态到当前 UID 的账户状态槽，避免复用已有数据时重跑。
                        await updateCommissionStatus(comm, COMMISSION_STATUS.COMPLETED, uid);
                        if (result.context) {
                            // 给完成型探针（type: "completion" 等）一个写 branchConditionMet 的机会
                            // 必须在 updateBranchCompletion 之前，否则进度永远不会被写入 completedByUid
                            dispatchOnCommissionComplete(result.context);
                            await updateBranchCompletion(comm.name, result.context);
                        }
                    } else {
                        log.warn("委托 {name} 执行后检查未完成（第 {attempt}/{total} 次）", comm.name, tryCount + 1, totalAttempts);
                    }
                } else {
                    log.warn("委托 {name} 执行失败（第 {attempt}/{total} 次）", comm.name, tryCount + 1, totalAttempts);
                }

                if (!success && tryCount < MAX_COMMISSION_RETRY_COUNT) {
                    await sleep(1000);
                }
            }

            if (!success) {
                log.warn("委托 {name} 共 {total} 次尝试后仍未完成，跳过该委托", comm.name, totalAttempts);
            } else {
                log.info(`委托执行成功：${comm.name}`);
            }
            await sleep(1);
        }

        log.info("委托追踪全部执行完成，共执行 {count}/{total} 个委托", successCount, commissions.length);
        return successCount > 0;
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("执行委托追踪时出错: {error}", error.message);
        return false;
    }
}
