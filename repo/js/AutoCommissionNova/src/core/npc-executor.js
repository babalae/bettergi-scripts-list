/**
 * NPC委托执行模块
 * 负责NPC委托的流程加载和执行
 */
import { COMMISSION_TYPE } from "../config/index.js";
import { trackCommission } from "../navigation/index.js";
import { loadNpcProcessFile } from "../loaders/index.js";
import { createCommissionContext, runStepsWithContext } from "./commission-context.js";
import { prepareCommissionBattleParty } from "./commission-party-switcher.js";

/**
 * 执行NPC委托
 * @param {Object} commission - 委托对象
 * @param {Object} stepRegistry - 步骤处理器注册表
 * @returns {Promise<Object>} 包含 success 和 context 的对象
 */
export async function executeNpcCommission(commission, stepRegistry, accountUid) {
    try {
        const processSteps = await loadNpcProcessFile(
            commission.name,
            commission.location,
            "process.json",
            commission.country || "蒙德"
        );
        if (!processSteps || processSteps.length === 0) {
            log.error("没有找到有效的流程步骤");
            return { success: false, context: null };
        }

        log.debug("执行统一NPC委托流程: {name}", commission.name);
        await trackCommission(commission.name);

        const context = createCommissionContext({
            type: COMMISSION_TYPE.NPC,
            country: commission.country || "蒙德",
            accountUid,
            commissionName: commission.name,
            location: commission.location,
            processSteps,
            stepRegistry,
        });

        await prepareCommissionBattleParty(context);
        const success = await runStepsWithContext(context, { sleepMs: 250, stopOnError: true });
        if (success) {
            log.debug("NPC委托流程执行完成: {name}", commission.name);
        }
        return { success, context };
    } catch (error) {
        log.error("执行NPC委托时出错: {error}", error.message);
        return { success: false, context: null };
    }
}
