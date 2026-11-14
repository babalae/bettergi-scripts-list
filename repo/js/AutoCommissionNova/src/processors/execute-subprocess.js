/**
 * 执行子流程步骤处理器
 *
 * 加载子流程文件，把其中的 step 依次插入到当前 step 之后执行
 *   - 与条件命中后的 splice 机制一致
 *   - 区别是无任何前置判断 —— 永远执行，等价于纯粹的 "include 子流程"
 *
 * data: { path: string }
 *   path — 子流程文件相对路径，由 context.resolveResource 解析为绝对路径
 *          NPC 委托：相对 process/蒙德/NPC/{commissionName}/{location}/
 *          Basic 委托：相对 {processDir}
 */
import { defineStep } from "./define-step.js";

export default defineStep({
    type: "执行子流程",
    category: "流程控制",
    dataSpec: {
        kind: "object",
        fields: {
            path: { type: "string", label: "子流程文件", required: true, nonEmpty: true, resource: "process" },
        },
    },
    run: async (step, context) => {
        const fullPath = context.resolveResource(step.data.path);
        log.info("加载子流程: {path}", fullPath);

        let subSteps;
        try {
            const content = file.readTextSync(fullPath);
            subSteps = JSON.parse(content);
        } catch (error) {
            log.error("子流程文件读取/解析失败: {path}, {error}", fullPath, error.message);
            return false;
        }

        if (!Array.isArray(subSteps)) {
            log.error("子流程文件格式错误（应为数组）: {path}", fullPath);
            return false;
        }

        context.insertSubSteps(subSteps);
        log.info("已插入 {count} 个子流程步骤", subSteps.length);
    },
});
