/**
 * 等待返回主界面步骤处理器
 */
import { isInMainUI } from "../vision/index.js";
import { defineStep } from "./define-step.js";

const run = async (step) => {
    log.info("等待返回主界面");
    let maxWaitTime = 120000;
    let checkInterval = 1000;

    if (step.data && typeof step.data === "object") {
        maxWaitTime = step.data.maxWaitTime || maxWaitTime;
        checkInterval = step.data.checkInterval || checkInterval;
    } else if (typeof step.data === "number") {
        maxWaitTime = step.data;
    }

    for (let i = 0; i < Math.floor(maxWaitTime / checkInterval); i++) {
        if (isInMainUI()) {
            log.info("检测到已返回主界面，结束等待");
            return;
        }
        await sleep(checkInterval);
    }
    if (!isInMainUI()) {
        log.info("等待返回主界面超时，尝试继续执行后续步骤");
    }
};

export default defineStep({
    type: "等待返回主界面",
    category: "流程控制",
    dataSpec: {
        kind: "object",
        optional: true,
        fields: {
            maxWaitTime: { type: "number", label: "最大等待时间（毫秒）", integer: true, exclusiveMin: 0 },
            checkInterval: { type: "number", label: "检查间隔（毫秒）", integer: true, exclusiveMin: 0 },
        },
        validate: data => data.maxWaitTime !== undefined && data.checkInterval !== undefined && data.maxWaitTime < data.checkInterval
            ? "maxWaitTime 不能小于 checkInterval"
            : "",
    },
    run,
});
