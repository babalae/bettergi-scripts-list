/**
 * 地图追踪步骤处理器
 * 路径通过 context.resolveResource 解析，自动适配 NPC / Basic 委托
 */
import { defineStep } from "./define-step.js";

export default defineStep({
    type: "地图追踪",
    category: "路径与定位",
    dataSpec: { kind: "string", label: "路径文件", nonEmpty: true, resource: "path" },
    run: async (step, context) => {
        const scriptName = step.data;
        const fullPath = context.resolveResource(scriptName);
        const normalizedPath = fullPath.replace(/\\/g, "/");
        const fileName = normalizedPath.split("/").pop() || scriptName;

        log.info("执行地图追踪: {file}", fileName);
        log.debug("地图追踪完整路径: {path}", normalizedPath);
        await pathingScript.runFile(fullPath);
        log.debug("地图追踪执行完成");
    },
});
