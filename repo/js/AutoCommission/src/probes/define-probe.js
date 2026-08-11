/**
 * 探针声明式包装
 *
 * 探针 = 分支条件的具体探测方式。conditions[branchKey].type 对应一个探针类型，
 * 探针提供以下可选钩子，由不同调度点触发：
 *
 *   validate(cond)              — 启动期 schema 校验。返回 { ok, error }；可选，默认通过
 *   onDialogOcr(ctx, results)   — 对话 step OCR 结果就绪时触发；适合关键词扫描类
 *   onCommissionComplete(ctx)   — 委托完成检测通过、写 completed 之前触发；适合
 *                                  "委托能跑完即视为达成" 类
 *   runExplicit(ctx, stepData)  — 由专用 step（如 成就检测）显式触发；适合需要
 *                                  打开 UI / 调用 OCR 等重操作的探针
 *
 * 探针只需实现自己用得到的钩子。Dispatch 函数在调度时按 hook 是否存在静默跳过。
 *
 * 注意：项目不支持 import()，新增探针必须：
 *   (1) 单独写一份 src/probes/xxx-probe.js
 *   (2) 在 src/probes/index.js 顶部 import + 加进 probes 数组
 * 与 src/processors 的扩展方式完全对称。
 */

/**
 * @typedef {Object} ProbeDefinition
 * @property {string}                                       type
 * @property {string}                                       [label]
 * @property {(cond: Object) => {ok: boolean, error?: string}} [validate]
 * @property {(ctx: Object, ocrResults: any) => void}       [onDialogOcr]
 * @property {(ctx: Object) => void}                        [onCommissionComplete]
 * @property {(ctx: Object, stepData?: Object) => Promise<void>} [runExplicit]
 */

/**
 * 占位包装函数；当前仅做身份返回，后续若要给所有 hook 加统一 try/catch、
 * 性能统计等，可在此集中处理（dispatch 端已有 try/catch，无需重复）
 * @param {ProbeDefinition} definition
 * @returns {ProbeDefinition}
 */
export function defineProbe(definition) {
    if (!definition || !definition.type) {
        throw new Error("defineProbe 必须提供 type 字段");
    }
    return definition;
}
