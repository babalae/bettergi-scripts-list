/**
 * 自动战斗步骤处理器
 * 使用 BGI 原生 RunAutoFightTask，策略从队伍配置读取。
 */
import { defineStep } from "./define-step.js";
import { DEFAULT_BATTLE_STRATEGY, loadPartyConfigForContext, resolveBattleStrategy } from "../loaders/party-config.js";

function resolveTimeout(stepData) {
    if (!stepData || typeof stepData !== "object" || Array.isArray(stepData)) {
        return null;
    }
    return typeof stepData.timeout === "number" && stepData.timeout > 0
        ? Math.round(stepData.timeout)
        : null;
}

export default defineStep({
    type: "自动战斗",
    category: "战斗与队伍",
    dataSpec: {
        kind: "object",
        optional: true,
        fields: {
            timeout: { type: "number", label: "超时时间（秒）", integer: true, exclusiveMin: 0 },
        },
    },
    swallow: true,
    run: async (step, context) => {
        const configBundle = loadPartyConfigForContext(context);
        const strategyName = resolveBattleStrategy(configBundle) || DEFAULT_BATTLE_STRATEGY;
        const timeout = resolveTimeout(step.data);

        log.info("开始执行自动战斗，策略: {strategy}", strategyName);

        const param = new AutoFightParam(strategyName);
        if (timeout) {
            param.Timeout = timeout;
            log.info("自动战斗超时时间: {timeout} 秒", timeout);
        }

        await dispatcher.RunAutoFightTask(param);
        log.info("自动战斗执行完成");
        return true;
    },
});
