/**
 * Basic委托执行模块
 * 采用流程步骤驱动方式执行Basic委托
 */
import { COMMISSION_TYPE } from "../config/index.js";
import { findNearestBasicProcess } from "./basic-process-matcher.js";
import { loadBasicProcess } from "../loaders/index.js";
import { trackCommission } from "../navigation/index.js";
import { createCommissionContext, runStepsWithContext } from "./commission-context.js";
import { prepareCommissionBattleParty } from "./commission-party-switcher.js";

/**
 * 执行Basic委托
 * @param {Object} commission - 委托对象
 * @param {Object} stepRegistry - 步骤处理器注册表
 * @returns {Promise<Object>} 包含 success 和 context 的对象
 */
export async function executeBasicCommission(commission, stepRegistry, accountUid) {
    try {
        const matched = await findNearestBasicProcess(
            commission.name,
            commission.location,
            commission.commissionPosition,
            commission.country || "蒙德"
        );

        if (!matched) {
            log.warn("未找到委托 {name} 在 {location} 的流程", commission.name, commission.location);
            return { success: false, context: null };
        }

        const normalizedProcessPath = matched.processPath.replace(/\\/g, "/");
        const locationDir = matched.processDir.replace(/\\/g, "/").split("/").filter(Boolean).pop() || commission.location;
        log.info(`匹配到流程：${commission.country || "蒙德"}/${locationDir}/${commission.name}`);
        log.debug("流程匹配详情: {path} (距离: {distance})", normalizedProcessPath, Math.round(matched.distance));

        const processSteps = await loadBasicProcess(matched.processPath);
        if (!processSteps || processSteps.length === 0) {
            log.warn("流程文件为空或解析失败: {path}", matched.processPath);
            return { success: false, context: null };
        }

        await trackCommission(commission.name);

        const context = createCommissionContext({
            type: COMMISSION_TYPE.BASIC,
            country: commission.country || "蒙德",
            accountUid,
            commissionName: commission.name,
            location: commission.location,
            processSteps,
            stepRegistry,
            processDir: matched.processDir,
        });

        try {
            await prepareCommissionBattleParty(context);
            const success = await runStepsWithContext(context, { sleepMs: 1000, stopOnError: true });
            if (success) {
                log.debug("Basic委托流程执行完成: {name}", commission.name);
            }
            return { success, context };
        } finally {
            dispatcher.ClearAllTriggers();
        }
    } catch (error) {
        log.error("执行Basic委托时出错: {error}", error.message);
        return { success: false, context: null };
    }
}
