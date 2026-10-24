/**
 * 委托完成识别探针
 *
 * conditions[branchKey] 形如 { type: "completion" }
 * 适用于"只要委托能跑完就视为分支条件达成"的场景，例如某分支无可识别的对话关键词、
 * 也没有对应成就，但其执行成功本身即可作为成就的判定信号
 *
 * 调度时机：commission-executor 已在 isCompleted=true 后才调度本探针，
 * 进入 onCommissionComplete 时委托一定是"被 BGI 识别为已完成"状态，
 * 因此直接置 branchConditionMet = true 即可，无需任何额外判定
 */
import { defineProbe } from "./define-probe.js";

export default defineProbe({
    type: "completion",
    label: "委托完成即达成",
    validate() {
        // 本类型无额外字段
        return { ok: true };
    },
    onCommissionComplete(context) {
        context.branchConditionMet = true;
        log.info("completion 探针：委托 {commission} 已完成，分支 {branch} 视为达成",
            context.commissionName, context.activeBranch);
    },
});
