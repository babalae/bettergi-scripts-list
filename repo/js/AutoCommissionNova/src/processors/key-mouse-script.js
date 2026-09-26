/**
 * 键鼠脚本步骤处理器
 * 路径通过 context.resolveResource 解析，自动适配 NPC / Basic 委托
 */
import { defineStep } from "./define-step.js";

export default defineStep({
    type: "键鼠脚本",
    category: "流程控制",
    dataSpec: { kind: "string", label: "键鼠脚本文件", nonEmpty: true, resource: "macro" },
    run: async (step, context) => {
        log.info("执行键鼠脚本: {path}", step.data);
        const fullPath = context.resolveResource(step.data);
        await keyMouseScript.runFile(fullPath);
        log.info("键鼠脚本执行完成");
    },
});
