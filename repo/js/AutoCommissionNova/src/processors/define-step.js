/**
 * 步骤处理器声明式包装
 *
 * 提供：
 *   - 统一 try/catch 兜底：swallow=true 时调 logCaughtError（message→error / stack→debug）；
 *     swallow=false 时静默 throw 让上层最终处理点统一打日志，避免冒泡链双重日志
 *   - 取消异常透传（rethrowIfCancellation）：取消信号始终一路向上到顶层，不会被任何 step 吞掉
 *   - 必填 dataSpec 校验（声明式校验 step.data 字段，省去重复手写 typeof/range 检查）
 *   - step 级重试（retry/retryOn）：失败先重试 N 次再走 swallow/throw 路径，
 *     避免瞬时 OCR / 网络 / 模板匹配抖动直接拖累整个委托
 *   - swallow 选项：默认抛出错误让上层 executor 计数重试；某些处理器（auto-fight、user-branch-select）
 *     现行就是吞错继续，传 swallow: true 即可保留行为
 *
 * dataSpec 支持 none / string / number / object / custom，object 默认拒绝未知字段。
 *
 * Retry 语义：
 *   - retry: number — 重试次数（不含首次）。step.retry 优先于 defineStep 默认值。
 *   - retryOn:
 *       "throw"        — 仅 run 抛错时重试（默认）
 *       "return-false" — 仅 run 返回 false 时重试；抛错立即向上
 *       "all"          — throw 或 return false 都重试
 *   - dataSpec 校验失败不重试（属配置错误）；swallow 在重试全部用尽后才生效
 *   - **注意**：重试假设 step 幂等。`按键` / 业务有副作用的 step 启用 retry 需谨慎
 */
import { logCaughtError, rethrowIfCancellation } from "../utils/error-utils.js";

const TYPE_CHECKS = {
    string: v => typeof v === "string",
    number: v => typeof v === "number",
    boolean: v => typeof v === "boolean",
    object: v => typeof v === "object" && v !== null && !Array.isArray(v),
    array: v => Array.isArray(v),
    any: () => true,
};

const STEP_CATEGORIES = new Set([
    "路径与定位",
    "交互方法",
    "战斗与队伍",
    "流程控制",
    "自动化与道具",
    "特定委托对策",
    "成就分支",
]);

function valueType(value) {
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    return typeof value;
}

function validateValue(value, spec, label) {
    const type = spec.type || spec.kind;
    if (value === undefined) {
        if (Object.prototype.hasOwnProperty.call(spec, "default")) {
            return { ok: true, value: spec.default };
        }
        if (spec.required) return { ok: false, error: label + "必填" };
        return { ok: true, value: undefined };
    }
    if (value === null) return { ok: false, error: label + "不能为 null" };

    const checker = TYPE_CHECKS[type];
    if (!checker || !checker(value)) {
        return { ok: false, error: label + "应为 " + type + "，收到 " + valueType(value) };
    }
    if (type === "string") {
        if (spec.nonEmpty && !value.trim()) return { ok: false, error: label + "不能为空" };
        if (Array.isArray(spec.options) && !spec.options.map(item => typeof item === "object" ? item.value : item).includes(value)) {
            return { ok: false, error: label + "只能是 " + spec.options.map(item => typeof item === "object" ? item.value : item).join("、") };
        }
    } else if (type === "number") {
        if (!Number.isFinite(value)) return { ok: false, error: label + "必须是有限数字" };
        if (spec.integer && !Number.isInteger(value)) return { ok: false, error: label + "必须是整数" };
        if (spec.min !== undefined && value < spec.min) return { ok: false, error: label + "不能小于 " + spec.min };
        if (spec.exclusiveMin !== undefined && value <= spec.exclusiveMin) return { ok: false, error: label + "必须大于 " + spec.exclusiveMin };
    } else if (type === "array") {
        if (spec.minItems !== undefined && value.length < spec.minItems) {
            return { ok: false, error: label + "至少需要 " + spec.minItems + " 项" };
        }
        if (spec.items) {
            for (let index = 0; index < value.length; index++) {
                const itemResult = validateValue(value[index], Object.assign({ required: true }, spec.items), label + "第 " + (index + 1) + " 项");
                if (!itemResult.ok) return itemResult;
            }
        }
    } else if (type === "object") {
        const fields = spec.fields || {};
        if (spec.additionalProperties !== true) {
            const unknown = Object.keys(value).filter(name => !Object.prototype.hasOwnProperty.call(fields, name));
            if (unknown.length) return { ok: false, error: label + "包含不支持的字段: " + unknown.join("、") };
        }
        const result = {};
        for (const [name, fieldSpec] of Object.entries(fields)) {
            const fieldResult = validateValue(value[name], fieldSpec, label + "." + name + " ");
            if (!fieldResult.ok) return fieldResult;
            if (fieldResult.value !== undefined) result[name] = fieldResult.value;
        }
        if (spec.additionalProperties === true) {
            for (const [name, fieldValue] of Object.entries(value)) {
                if (!Object.prototype.hasOwnProperty.call(result, name)) result[name] = fieldValue;
            }
        }
        return { ok: true, value: result };
    }
    return { ok: true, value };
}

function assertFieldSpec(spec, label) {
    if (!spec || typeof spec !== "object") throw new Error(label + " 必须是字段声明对象");
    const type = spec.type || spec.kind;
    if (!TYPE_CHECKS[type]) throw new Error(label + " 包含未知类型: " + type);
    if (type === "array") {
        if (!spec.items) throw new Error(label + " 数组必须声明 items");
        assertFieldSpec(spec.items, label + ".items");
    }
    if (type === "object" && spec.fields) {
        if (typeof spec.fields !== "object" || Array.isArray(spec.fields)) throw new Error(label + ".fields 必须是对象");
        for (const [name, fieldSpec] of Object.entries(spec.fields)) assertFieldSpec(fieldSpec, label + "." + name);
    }
}

function assertDataSpec(dataSpec, stepType) {
    if (!dataSpec || typeof dataSpec !== "object" || Array.isArray(dataSpec)) {
        throw new Error(stepType + " 步骤必须声明 dataSpec");
    }
    if (dataSpec.kind === "none") return;
    if (dataSpec.kind === "custom") {
        if (typeof dataSpec.validate !== "function") throw new Error(stepType + " 的自定义 dataSpec 缺少 validate");
        return;
    }
    if (dataSpec.kind === "object") {
        if (dataSpec.fields !== undefined && (!dataSpec.fields || typeof dataSpec.fields !== "object" || Array.isArray(dataSpec.fields))) {
            throw new Error(stepType + " dataSpec.fields 必须是对象");
        }
        for (const [name, fieldSpec] of Object.entries(dataSpec.fields || {})) {
            assertFieldSpec(fieldSpec, stepType + ".data." + name);
        }
        return;
    }
    assertFieldSpec(dataSpec, stepType + ".data");
}

/**
 * 校验处理器声明的 dataSpec。对象默认拒绝未声明字段。
 */
export function validateDataSpec(data, dataSpec, stepType) {
    if (!dataSpec || typeof dataSpec !== "object") {
        return { ok: false, error: stepType + " 未声明 dataSpec" };
    }
    if (dataSpec.kind === "none") {
        return data === undefined
            ? { ok: true, value: undefined }
            : { ok: false, error: stepType + " 步骤不支持 data" };
    }
    if (dataSpec.kind === "custom") {
        if (typeof dataSpec.validate !== "function") {
            return { ok: false, error: stepType + " 的自定义 dataSpec 缺少 validate" };
        }
        const result = dataSpec.validate(data);
        if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
            return { ok: false, error: stepType + " 的自定义 data 校验器返回格式无效" };
        }
        return result;
    }
    if (dataSpec.kind !== "object") {
        return validateValue(data, Object.assign({}, dataSpec, {
            type: dataSpec.kind,
            required: !dataSpec.optional,
        }), stepType + " data");
    }

    if (data === undefined && dataSpec.optional) return { ok: true, value: undefined };
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: stepType + " 步骤需要对象格式的 data" };
    }
    const fields = dataSpec.fields || {};
    if (dataSpec.additionalProperties !== true) {
        const unknown = Object.keys(data).filter(name => !Object.prototype.hasOwnProperty.call(fields, name));
        if (unknown.length) return { ok: false, error: stepType + " data 包含不支持的字段: " + unknown.join("、") };
    }

    const result = {};
    for (const [name, fieldSpec] of Object.entries(fields)) {
        const fieldResult = validateValue(data[name], fieldSpec, "字段 " + name + " ");
        if (!fieldResult.ok) return fieldResult;
        if (fieldResult.value !== undefined) result[name] = fieldResult.value;
    }
    if (dataSpec.additionalProperties === true) {
        for (const [name, value] of Object.entries(data)) {
            if (!Object.prototype.hasOwnProperty.call(result, name)) result[name] = value;
        }
    }
    if (typeof dataSpec.validate === "function") {
        const error = dataSpec.validate(result);
        if (error) return { ok: false, error: String(error) };
    }
    return { ok: true, value: result };
}

/**
 * 执行 run 函数，按 retry 配置自动重试
 *
 * 取消异常（isCancellationError）任何时候都立即透传，不计入重试 —— 用户已经主动停止，
 * 没必要再 retry。
 *
 * @returns {{ok: true, value: any} | {ok: false, error: Error}}
 */
async function callWithRetry({ type, run, step, context, maxRetry, retryMode }) {
    for (let attempt = 0; attempt <= maxRetry; attempt++) {
        if (attempt > 0) {
            log.warn("{type} 步骤第 {n}/{max} 次重试", type, attempt, maxRetry);
        }
        try {
            const result = await run(step, context);
            // run 显式返回 false 视作软失败，按 retryMode 决定是否重试
            if (result === false && (retryMode === "return-false" || retryMode === "all") && attempt < maxRetry) {
                continue;
            }
            return { ok: true, value: result };
        } catch (error) {
            rethrowIfCancellation(error);
            // return-false 模式：仅返回 false 重试，抛错立即向上
            if (retryMode === "return-false") return { ok: false, error };
            // throw / all 模式：用尽后向上
            if (attempt >= maxRetry) return { ok: false, error };
        }
    }
    // 走到这表示 retryMode 包含 return-false 且重试用尽
    return { ok: true, value: false };
}

function buildHandler({ type, validateData, run, swallow, retry, retryOn }) {
    return async function(step, context) {
        // 1. dataSpec 校验
        const validated = validateData(step.data);
        if (!validated.ok) {
            // 配置错误，非运行时异常 —— 无 stack 可言，直接 log.error 即可
            log.error("[processor:{type}] step.data 校验失败: {error}", type, validated.error);
            return;
        }
        const processedStep = Object.assign({}, step, { data: validated.value });

        // 2. 解析重试配置：step 级覆盖 defineStep 默认
        const maxRetry = typeof step.retry === "number" && step.retry >= 0 ? step.retry : (retry || 0);
        const retryMode = step.retryOn || retryOn || "throw";

        // 3. 执行（含重试）
        const outcome = await callWithRetry({ type, run, step: processedStep, context, maxRetry, retryMode });
        if (outcome.ok) return outcome.value;

        // 4. 最终失败处理
        //   swallow=true  → 本层就是最终处理点，message+stack 都打全（stack 走 debug 不污染遮罩）
        //   swallow=false → 中间层静默 throw，由 commission-context.runStepsWithContext 等最终
        //                   处理点统一记录，避免冒泡链双重日志
        if (swallow) {
            logCaughtError("processor:" + type, "执行 " + type + " 步骤", outcome.error);
            return;
        }
        throw outcome.error;
    };
}

/**
 * 定义步骤处理器
 * @param {Object} options
 * @param {string} options.type - 唯一步骤类型名
 * @param {Object} options.dataSpec - data 类型、字段和编辑器声明
 * @param {string} options.category - 编辑器中的步骤分类
 * @param {(data: Object) => string|void} [options.validate] - dataSpec 通过后的附加校验（可选）
 * @param {Function} options.run - 业务逻辑 (step, context) => any
 * @param {boolean} [options.swallow=false] - 是否吞掉异常（默认 throw 由上层 executor 处理）
 * @param {number} [options.retry=0] - 失败时的默认重试次数（step.retry 可覆盖）
 * @param {"throw"|"return-false"|"all"} [options.retryOn="throw"] - 触发重试的条件（step.retryOn 可覆盖）
 * @returns {{type, category, dataSpec, handler, validateData}} 注册条目
 */
export function defineStep({ type, category, dataSpec, validate, run, swallow = false, retry = 0, retryOn = "throw" }) {
    if (typeof type !== "string" || !type.trim()) throw new Error("defineStep.type 必填");
    if (typeof category !== "string" || !category.trim()) throw new Error(type + " 步骤必须声明 category");
    if (!STEP_CATEGORIES.has(category)) throw new Error(type + " 步骤使用了未知 category: " + category);
    assertDataSpec(dataSpec, type);
    const validateData = data => {
        const dataResult = validateDataSpec(data, dataSpec, type);
        if (!dataResult.ok || !validate) return dataResult;
        const error = validate(dataResult.value);
        return error ? { ok: false, error: String(error) } : dataResult;
    };
    return {
        type,
        category,
        dataSpec,
        handler: buildHandler({ type, validateData, run, swallow, retry, retryOn }),
        validateData,
    };
}
