/**
 * 探针注册表 + 调度助手
 *
 * 与 src/processors/index.js 同构：
 *   - 每个探针文件 default export 一个 ProbeDefinition
 *   - 在此文件顶部 import + 加进 probes 数组
 *   - registerAllProbes() 在 main.js 启动期调用一次
 *
 * 业务侧不要直接拿 probeRegistry，统一走下面三个 dispatch 函数：
 *   - dispatchOnDialogOcr(context, ocrResults)  → 对话 step 的 OCR 钩子
 *   - dispatchOnCommissionComplete(context)     → 委托完成检测后的钩子
 *   - dispatchExplicit(context, expectedType, stepData) → 专用 step 显式触发
 *
 * dispatch 内部统一兜底 try/catch，探针实现里无需重复包裹
 */
import dialogProbe from "./dialog-probe.js";
import achievementProbe from "./achievement-probe.js";
import completionProbe from "./completion-probe.js";
import { logCaughtError, rethrowIfCancellation } from "../utils/error-utils.js";

const probes = [
    dialogProbe,
    achievementProbe,
    completionProbe,
];

class ProbeRegistry {
    constructor() { this.map = new Map(); }
    register(probe) {
        if (!probe || !probe.type) {
            log.warn("无效的探针定义，跳过注册");
            return;
        }
        if (this.map.has(probe.type)) {
            log.warn("探针类型 {t} 已存在，将被覆盖", probe.type);
        }
        this.map.set(probe.type, probe);
    }
    get(type) { return this.map.get(type); }
    has(type) { return this.map.has(type); }
    list() { return Array.from(this.map.values()); }
    types() { return Array.from(this.map.keys()); }
}

export const probeRegistry = new ProbeRegistry();

export function registerAllProbes() {
    for (const probe of probes) {
        probeRegistry.register(probe);
    }
    log.debug("已注册探针类型: {list}", probeRegistry.types().join(", "));
}

/**
 * 调度对话探针：对话 step 每轮 OCR 结果就绪时调用
 * 探针类型未声明 onDialogOcr 钩子 / 当前分支无 condition / 已达成 → 静默跳过
 */
export function dispatchOnDialogOcr(context, ocrResults) {
    const cond = context && context.branchCondition;
    if (!cond || context.branchConditionMet) return;
    const probe = probeRegistry.get(cond.type);
    if (!probe || !probe.onDialogOcr) return;
    try {
        probe.onDialogOcr(context, ocrResults);
    } catch (error) {
        rethrowIfCancellation(error);
        logCaughtError("probe:" + cond.type, "调度 onDialogOcr", error);
    }
}

/**
 * 调度委托完成探针：commission-executor 在 isCompleted=true 后、写 completed 前调用
 * 探针类型未声明 onCommissionComplete 钩子 / 当前分支无 condition / 已达成 → 静默跳过
 */
export function dispatchOnCommissionComplete(context) {
    const cond = context && context.branchCondition;
    if (!cond || context.branchConditionMet) return;
    const probe = probeRegistry.get(cond.type);
    if (!probe || !probe.onCommissionComplete) return;
    try {
        probe.onCommissionComplete(context);
    } catch (error) {
        rethrowIfCancellation(error);
        logCaughtError("probe:" + cond.type, "调度 onCommissionComplete", error);
    }
}

/**
 * 调度显式探针：由专用 step（如 成就检测）调用
 *
 * @param {Object} context
 * @param {string} [expectedType] - 期望的 condition.type；不匹配则跳过（防止 step 放错分支）
 * @param {Object} [stepData] - step.data，透传给 probe.runExplicit
 */
export async function dispatchExplicit(context, expectedType, stepData) {
    const cond = context && context.branchCondition;
    if (!cond) {
        log.warn("当前分支无 condition，跳过显式探针调用");
        return;
    }
    if (expectedType && cond.type !== expectedType) {
        log.warn("当前 condition.type 为 {a}，与期望的 {b} 不匹配，跳过", cond.type, expectedType);
        return;
    }
    const probe = probeRegistry.get(cond.type);
    if (!probe || !probe.runExplicit) {
        log.warn("探针 {t} 未实现 runExplicit 钩子", cond.type);
        return;
    }
    try {
        await probe.runExplicit(context, stepData);
    } catch (error) {
        rethrowIfCancellation(error);
        logCaughtError("probe:" + cond.type, "调度 runExplicit", error);
    }
}
