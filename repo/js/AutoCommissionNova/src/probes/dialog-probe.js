/**
 * 对话关键词探针
 *
 * conditions[branchKey] 形如 { type: "dialog", keywords: ["..."] }
 * 对话 step (auto-skip) 在 OCR 结果就绪时调度此探针，扫描关键词命中即视为达成
 */
import { defineProbe } from "./define-probe.js";

export default defineProbe({
    type: "dialog",
    label: "对话关键词",
    validate(cond) {
        if (!Array.isArray(cond.keywords) || cond.keywords.length === 0) {
            return { ok: false, error: "需要非空 keywords: string[]" };
        }
        if (!cond.keywords.every(k => typeof k === "string" && k.length > 0)) {
            return { ok: false, error: "keywords 每项必须是非空字符串" };
        }
        return { ok: true };
    },
    onDialogOcr(context, ocrResults) {
        const keywords = (context.branchCondition && context.branchCondition.keywords) || [];
        if (keywords.length === 0 || !ocrResults || ocrResults.count === 0) return;
        for (let i = 0; i < ocrResults.count; i++) {
            const text = ocrResults[i].text;
            const hit = keywords.find(k => text.includes(k));
            if (hit) {
                context.branchConditionMet = true;
                log.info("分支条件命中关键词 {kw}（OCR 文本: {text}）", hit, text);
                return;
            }
        }
    },
});
