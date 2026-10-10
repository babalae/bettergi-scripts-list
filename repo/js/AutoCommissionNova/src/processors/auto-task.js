/**
 * 自动任务步骤处理器
 */
import { defineStep } from "./define-step.js";

export default defineStep({
    type: "自动任务",
    category: "自动化与道具",
    dataSpec: {
        kind: "object",
        fields: {
            action: {
                type: "string",
                label: "操作",
                required: true,
                options: [
                    { value: "enable", label: "启用" },
                    { value: "disable", label: "禁用全部" },
                ],
            },
            taskType: {
                type: "string",
                label: "任务类型",
                options: ["AutoSkip", "AutoPick"],
            },
            config: {
                type: "object",
                label: "自动拾取配置",
                fields: {
                    TextList: {
                        type: "array",
                        minItems: 1,
                        items: { type: "string", nonEmpty: true },
                    },
                    ForceInteraction: { type: "boolean" },
                },
            },
        },
        validate: data => {
            if (data.action === "disable") {
                if (data.taskType !== undefined || data.config !== undefined) return "禁用自动任务时不能设置 taskType 或 config";
                return "";
            }
            if (!data.taskType) return "启用自动任务时必须设置 taskType";
            if (data.taskType === "AutoSkip" && data.config !== undefined) return "AutoSkip 不支持 JS 对象 config";
            return "";
        },
    },
    swallow: true,
    run: async (step) => {
        const action = step.data && step.data.action;
        const taskType = (step.data && step.data.taskType) || "default";
        const config = step.data && step.data.config;

        if (!action) {
            log.error("自动任务参数不完整，需要 action 参数");
            return false;
        }
        log.info("执行自动任务操作: {action}", action);

        if (action === "enable") {
            if (taskType === "AutoSkip") {
                log.info("启用自动剧情", taskType);
                dispatcher.addTimer(new RealtimeTimer(taskType));
            } else if (config && typeof config === "object" && Object.keys(config).length > 0) {
                log.info("启用自动任务: {type}，配置: {config}", taskType, JSON.stringify(config));
                dispatcher.addTimer(new RealtimeTimer(taskType, config));
            } else {
                log.info("启用自动任务: {type}", taskType);
                dispatcher.addTimer(new RealtimeTimer(taskType));
            }
        } else if (action === "disable") {
            log.info("取消所有自动任务");
            dispatcher.ClearAllTriggers();
        } else {
            log.error("未知的自动任务操作: {action}", action);
            return false;
        }
        return true;
    },
});
