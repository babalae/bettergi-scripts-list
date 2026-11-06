/**
 * 步骤处理器注册表
 * 管理所有步骤处理器的注册、查找和执行
 */
import { shouldExecuteStepByDesc } from "./commission-desc-utils.js";
import { shouldExecuteStepByLoc } from "./commission-loc-utils.js";

export class StepProcessorRegistry {
    constructor() {
        // type → { handler, category, dataSpec, validateData }
        this.processors = {};
    }

    /**
     * 注册步骤处理器
     * @param {string} stepType - 步骤类型名称
     * @param {Function} handler - 异步处理函数 (step, context) => Promise<void>
     * @param {Function} validateData - 与运行时共用的 data 校验器
     * @param {string} category - 编辑器中的步骤分类
     * @param {Object} dataSpec - 严格 data 声明
     */
    register(stepType, handler, validateData, category, dataSpec) {
        if (typeof stepType !== "string" || !stepType.trim()) throw new Error("步骤类型名不能为空");
        if (typeof handler !== "function") throw new Error(stepType + " 步骤缺少 handler");
        if (typeof validateData !== "function") throw new Error(stepType + " 步骤缺少 validateData");
        if (typeof category !== "string" || !category.trim()) throw new Error(stepType + " 步骤缺少 category");
        if (!dataSpec || typeof dataSpec !== "object") throw new Error(stepType + " 步骤缺少 dataSpec");
        if (this.has(stepType)) throw new Error("步骤类型重复注册: " + stepType);
        this.processors[stepType] = { handler, validateData, category, dataSpec };
    }

    /**
     * 处理步骤
     * @param {Object} step - 步骤定义 { type, data?, note?, desc?, loc?, retry?, retryOn? }
     * @param {Object} context - 执行上下文
     */
    async process(step, context) {
        if (!step || typeof step !== "object" || Array.isArray(step)) {
            log.warn("流程步骤必须是对象格式，收到: {value}", step);
            return;
        }
        const entry = this.processors[step.type];
        if (entry) {
            if (!(await shouldExecuteStepByDesc(step, context))) {
                return;
            }
            if (!(await shouldExecuteStepByLoc(step, context))) {
                return;
            }
            await entry.handler(step, context);
        } else {
            log.warn("未知的流程类型: {type}", step.type);
        }
    }

    /**
     * 检查指定 type 是否已注册
     * @param {string} stepType
     * @returns {boolean}
     */
    has(stepType) {
        return Object.prototype.hasOwnProperty.call(this.processors, stepType);
    }

    getDefinition(stepType) {
        const entry = this.processors[stepType];
        if (!entry) return undefined;
        return {
            type: stepType,
            category: entry.category,
            dataSpec: entry.dataSpec,
        };
    }

    getDefinitions() {
        return Object.keys(this.processors).map(type => this.getDefinition(type));
    }

    /**
     * 使用处理器声明的完整规则校验并规范化 data。
     */
    validateData(stepType, data) {
        const entry = this.processors[stepType];
        if (!entry) return { ok: false, error: "未知步骤类型: " + stepType };
        if (typeof entry.validateData !== "function") return { ok: false, error: stepType + " 步骤缺少 data 校验器" };
        return entry.validateData(data);
    }

    /**
     * 获取所有已注册的处理器类型
     * @returns {string[]} 已注册的类型名称列表
     */
    getRegisteredTypes() {
        return Object.keys(this.processors);
    }
}

export const stepRegistry = new StepProcessorRegistry();
