/**
 * 委托地址识别公共工具
 */
import { calculateDistance, findCommissionTarget } from "../navigation/index.js";

const DEFAULT_LOC_TOLERANCE = 15;

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function parseLocTarget(target, indexLabel = "") {
    if (!Array.isArray(target)) {
        return { ok: false, error: `loc${indexLabel} 必须是数组格式 [x, y] 或 [x, y, tolerance]` };
    }
    if (target.length !== 2 && target.length !== 3) {
        return { ok: false, error: `loc${indexLabel} 必须包含 2 或 3 个元素：[x, y] 或 [x, y, tolerance]` };
    }
    if (!isFiniteNumber(target[0]) || !isFiniteNumber(target[1])) {
        return { ok: false, error: `loc${indexLabel} 前两个元素必须是数字坐标 x 和 y` };
    }

    const tolerance = target.length === 3 ? target[2] : DEFAULT_LOC_TOLERANCE;
    if (!isFiniteNumber(tolerance)) {
        return { ok: false, error: `loc${indexLabel} 第三个元素 tolerance 必须是数字` };
    }
    if (tolerance <= 0) {
        return { ok: false, error: `loc${indexLabel} 第三个元素 tolerance 必须大于 0` };
    }

    return {
        ok: true,
        value: { x: target[0], y: target[1], tolerance },
    };
}

/**
 * 解析 step.loc 通用条件字段。
 * loc 格式：[x, y]、[x, y, tolerance] 或 [[x, y], [x, y, tolerance]]，tolerance 默认 15。
 * @param {any} loc
 * @returns {{present: false, ok: true} | {present: true, ok: true, value: {targets: Array<{x: number, y: number, tolerance: number}>}} | {present: true, ok: false, error: string}}
 */
export function parseStepLoc(loc) {
    if (loc === undefined) {
        return { present: false, ok: true };
    }
    if (!Array.isArray(loc)) {
        return { present: true, ok: false, error: "loc 必须是数组格式 [x, y]、[x, y, tolerance] 或 [[x, y], ...]" };
    }

    if (loc.length === 0) {
        return { present: true, ok: false, error: "loc 不能为空" };
    }

    if (Array.isArray(loc[0])) {
        const targets = [];
        for (let i = 0; i < loc.length; i++) {
            const parsed = parseLocTarget(loc[i], `[${i}]`);
            if (!parsed.ok) {
                return { present: true, ok: false, error: parsed.error };
            }
            targets.push(parsed.value);
        }
        return { present: true, ok: true, value: { targets } };
    }

    const parsed = parseLocTarget(loc);
    if (!parsed.ok) {
        return { present: true, ok: false, error: parsed.error };
    }
    return { present: true, ok: true, value: { targets: [parsed.value] } };
}

/**
 * 检测当前委托目标位置是否命中任意指定坐标。
 * @param {Array<{x: number, y: number, tolerance: number}>} targets
 * @param {Object} context
 * @param {string} label - 日志标签
 * @returns {Promise<boolean>}
 */
export async function detectCommissionLocations(targets, context, label = "地址检测") {
    if (targets.length === 1) {
        const target = targets[0];
        log.info(label + ": 目标({x}, {y}), 容差: {tolerance}",
            Math.round(target.x), Math.round(target.y), Math.round(target.tolerance));
    } else {
        log.info(label + ": {count} 个候选目标", targets.length);
    }

    const commissionTarget = await findCommissionTarget(context.commissionName);
    if (!commissionTarget) {
        log.warn("无法获取委托目标位置，" + label + "失败");
        context.locationDetected = false;
        return false;
    }

    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const distance = calculateDistance(commissionTarget, { x: target.x, y: target.y });
        const targetLabel = targets.length === 1 ? label : `${label} #${i + 1}`;
        log.info(targetLabel + " - 委托位置: ({x}, {y}), 目标位置: ({tx}, {ty}), 距离: {d}, 容差: {tolerance}",
            Math.round(commissionTarget.x),
            Math.round(commissionTarget.y),
            Math.round(target.x),
            Math.round(target.y),
            Math.round(distance),
            Math.round(target.tolerance));

        if (distance < target.tolerance) {
            log.info(targetLabel + "成功，距离在容差范围内");
            context.locationDetected = true;
            context.detectedPosition = commissionTarget;
            return true;
        }
    }

    log.info(label + "失败，所有候选目标距离过远");
    context.locationDetected = false;
    return false;
}

/**
 * 判断带 loc 的 step 是否应执行。
 * loc 采用坐标距离匹配：[x, y]、[x, y, tolerance] 或 [[x, y], ...]，容差默认 15。
 * @param {Object} step
 * @param {Object} context
 * @returns {Promise<boolean>}
 */
export async function shouldExecuteStepByLoc(step, context) {
    const parsed = parseStepLoc(step.loc);
    if (!parsed.present) return true;

    if (!parsed.ok) {
        log.error("步骤 loc 配置错误，跳过步骤: {error}", parsed.error);
        context.locationDetected = false;
        return false;
    }

    const matched = await detectCommissionLocations(parsed.value.targets, context, "步骤 loc 地址检测");
    if (!matched) {
        log.info("步骤 loc 不匹配，跳过步骤");
    }
    return matched;
}
