/**
 * 等待步骤处理器
 */
import { defineStep } from "./define-step.js";

export default defineStep({
    type: "等待",
    category: "流程控制",
    dataSpec: {
        kind: "number",
        label: "等待时间（毫秒）",
        integer: true,
        min: 0,
    },
    run: async (step) => {
        const waitTime = step.data;
        log.info("等待 {time}ms", waitTime);
        await sleep(waitTime);
    },
});
