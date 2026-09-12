/**
 * 委托描述识别公共工具
 */
import { OCR_REGIONS, THRESHOLDS } from "../config/index.js";
import { bvPageOcrRegionText } from "../vision/index.js";
import { standardizeCommissionName, calculateSimilarity } from "../recognition/index.js";
import { cleanText } from "../utils/text-utils.js";
import { isCancellationError } from "../utils/error-utils.js";

/**
 * 比较 OCR 识别的描述文本与期望描述
 * @param {string} ocrText - OCR 原始识别文本
 * @param {string} expected - 期望描述（用户配置）
 * @param {boolean} useKeyword - true 表示清理后的子串包含，false 表示整段相似度匹配
 * @returns {boolean}
 */
export function matchesDescription(ocrText, expected, useKeyword) {
    const cleanedOcr = cleanText(ocrText);
    const cleanedExpected = cleanText(expected);
    if (!cleanedExpected) return false;
    if (useKeyword) {
        return cleanedOcr.includes(cleanedExpected);
    }
    return calculateSimilarity(cleanedOcr, cleanedExpected) >= THRESHOLDS.COMMISSION_DESC;
}

function isCommissionNameText(ocrText, commissionName) {
    const cleanedOcr = cleanText(ocrText);
    const cleanedCommissionName = cleanText(commissionName);
    if (!cleanedOcr || !cleanedCommissionName) return false;

    return cleanText(standardizeCommissionName(cleanedOcr)) === cleanedCommissionName;
}

export function readTrackedDescriptionText(context) {
    const firstLine = bvPageOcrRegionText(OCR_REGIONS.COMMISSION_DETAIL);
    const secondLine = bvPageOcrRegionText(OCR_REGIONS.COMMISSION_DETAIL_SECOND_LINE);

    if (isCommissionNameText(firstLine, context.commissionName)) {
        log.debug("第一行仍为委托名称，使用第二行描述: {result}", secondLine);
        return secondLine;
    }
    return firstLine;
}

/**
 * 读取当前追踪委托的描述文本。
 * OCR 可能先读到委托名称或空文本，此时等待刷新后重试。
 * @param {Object} context - 委托执行上下文
 * @returns {Promise<string>} 识别到的委托描述；失败返回空字符串
 */
export async function readCommissionDescription(context) {
    keyPress("v");
    await sleep(300);

    let lastOcrResult = "";
    for (let c = 0; c < 13; c++) {
        try {
            const ocrResult = readTrackedDescriptionText(context);
            // OCR 可能识别出与委托名一致（说明详情还没刷新出来）或空文本 → 继续等
            // 使用标准化后等值比较，容忍 OCR 抖动，但不做包含匹配
            if (ocrResult === "" || isCommissionNameText(ocrResult, context.commissionName)) {
                keyPress("v"); // 识别到委托名按V追踪
                await sleep(1000);
                log.debug("检测到委托名称或空文本，继续等待...");
            } else if (ocrResult === lastOcrResult) {
                // 连续两次 OCR 结果相同，认为描述已稳定加载
                log.debug("OCR结果稳定: {result}", ocrResult);
                return ocrResult;
            } else {
                // 第一次识别或结果不一致，记录并继续等待
                log.debug("OCR结果: {result}，等待确认...", ocrResult);
                lastOcrResult = ocrResult;
            }
        } catch (ocrError) {
            if (isCancellationError(ocrError)) { throw ocrError; }
            log.error("委托描述OCR识别出错: {error}", ocrError.message);
            return "";
        }
        await sleep(200);
    }
    return "";
}

/**
 * 判断带 desc 的 step 是否应执行。
 * desc 采用固定包含匹配：cleanText(ocrText).includes(cleanText(desc))。
 * @param {Object} step
 * @param {Object} context
 * @returns {Promise<boolean>}
 */
export async function shouldExecuteStepByDesc(step, context) {
    const expectedDesc = typeof step.desc === "string" ? step.desc.trim() : "";
    if (!expectedDesc) return true;

    log.info("检查委托描述是否包含 : {desc}", expectedDesc);
    const ocrText = await readCommissionDescription(context);
    const matched = matchesDescription(ocrText, expectedDesc, true);
    if (!matched) {
        log.info("步骤 desc 不匹配，跳过步骤。识别：{actual}, 期望包含：{expected}", ocrText, expectedDesc);
    }
    return matched;
}
