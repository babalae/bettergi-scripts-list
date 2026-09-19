/**
 * 成就检测步骤处理器
 *
 * 把"打开成就界面 → 搜索成就名 → 判断解锁"的实际逻辑下沉到 src/probes/achievement-probe.js，
 * 此 step 仅做调度：
 *   - 校验当前分支 condition.type === "achievement"（防止流程作者把本 step 放到非成就分支里）
 *   - 把 step.data 透传给 probe.runExplicit，由探针决定如何使用
 *
 * data: { name?: string }  — 可选；缺省时探针回退到 context.branchCondition.name
 *
 * 失败处理：swallow=true，探针抛错由 dispatch 层统一兜底 log.error，不影响后续 step
 */
import { defineStep } from "./define-step.js";
import { dispatchExplicit } from "../probes/index.js";

export default defineStep({
    type: "成就检测",
    category: "成就分支",
    dataSpec: {
        kind: "object",
        optional: true,
        fields: {
            name: { type: "string", label: "成就名称", nonEmpty: true },
        },
    },
    swallow: true,
    run: async (step, context) => {
        await dispatchExplicit(context, "achievement", step.data);
    },
});
