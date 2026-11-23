import {recordRecognition} from "./recognitionResult.js";
import {sendText} from "./notice";
import {toMainUi} from "./tool";

// 月卡页面和 OCR 区域均以 1920×1080 游戏坐标为基准，BGI 会负责缩放。
const DAY_TEXT_REGION = {x: 378, y: 198, width: 302, height: 70};
const TAB_SEARCH_REGION = {x: 380, y: 75, width: 220, height: 100};
const SHOP_SEARCH_REGION = {x: 150, y: 330, width: 380, height: 590};
const SHOP_ROW_REGION = {minY: 430, maxY: 540};
const SHOP_NAV_REGION = {x: 0, y: 80, width: 200, height: 620};

/**
 * 检查空月祝福（月卡）剩余天数。
 *
 * 识别失败只会写入 unknown/failed 状态，不向外抛出，避免阻断活动通知脚本的其他阶段。
 * @param {number} warnDays 剩余多少天以内发送提醒
 * @param {number} ocrTimeoutSeconds OCR 轮询超时时间（秒）
 * @returns {Promise<{status: string, data: Object, reason: string|null}>}
 */
export async function monthlyCardMain(warnDays = 3, ocrTimeoutSeconds = 15) {
    let outcome = {
        status: "unknown",
        data: {
            days: null,
            claimed: null,
            text: null,
            warnDays,
            pageConfirmed: false,
            notified: false
        },
        reason: "月卡识别尚未开始"
    };

    try {
        // 先收敛到主界面，再按参考脚本流程打开派蒙菜单和商城。
        await toMainUi();
        await sleep(800);
        keyPress("ESCAPE");
        await sleep(1500);

        const shopClicked = await clickShop();
        if (!shopClicked) {
            outcome.reason = "未找到商城入口";
        } else {
            await sleep(1000);
            const pageConfirmed = await waitMonthlyCardPage(ocrTimeoutSeconds);
            const readResult = await readDayText(ocrTimeoutSeconds);
            outcome = {
                status: readResult.status,
                data: {
                    ...readResult.data,
                    warnDays,
                    pageConfirmed,
                    notified: false
                },
                reason: readResult.reason
            };

            // 只有成功解析到数字，且确实达到阈值时才发送提醒。
            if (outcome.status === "observed" && outcome.data.days <= warnDays) {
                const uid = await genshin.uid();
                const claimText = outcome.data.claimed === true
                    ? "（今日已领取）"
                    : outcome.data.claimed === false ? "（今日未领取）" : "";
                const noticeText = `月卡剩余 ${outcome.data.days} 天${claimText}`;
                try {
                    await sendText(noticeText, `UID:${uid}\n空月祝福（月卡）`);
                    outcome.data.notified = true;
                } catch (error) {
                    // 识别结果仍然有效，通知失败单独记录原因，避免误报为 OCR 失败。
                    outcome.reason = `识别成功但通知发送失败：${String(error.message || error)}`;
                    log.warn(outcome.reason);
                }
            }
        }
    } catch (error) {
        outcome = {
            status: "failed",
            data: {
                ...outcome.data,
                error: String(error.message || error)
            },
            reason: `月卡识别异常：${String(error.message || error)}`
        };
        log.warn(outcome.reason);
    } finally {
        // 无论识别成功、失败或未购买，都尽量把界面还原给后续脚本和用户。
        try {
            await toMainUi();
        } catch (error) {
            log.warn(`月卡检查后返回主界面失败：${String(error.message || error)}`);
        }
    }

    await recordRecognition("monthlyCard", outcome.data, outcome.status, outcome.reason);
    return outcome;
}

/**
 * 在派蒙菜单中精确查找并点击第一行的「商城」，避免误点「千星商城」。
 * @returns {Promise<boolean>}
 */
async function clickShop() {
    for (let attempt = 0; attempt < 3; attempt++) {
        let image = null;
        try {
            image = captureGameRegion();
            const recognition = RecognitionObject.Ocr(
                SHOP_SEARCH_REGION.x,
                SHOP_SEARCH_REGION.y,
                SHOP_SEARCH_REGION.width,
                SHOP_SEARCH_REGION.height
            );
            const results = resultsToArray(image.findMulti(recognition));
            let candidate = results.find(result => {
                const text = String(result?.text || "").replace(/\s+/g, "");
                return text === "商城"
                    && result.y >= SHOP_ROW_REGION.minY
                    && result.y <= SHOP_ROW_REGION.maxY;
            });

            // OCR 偶尔会多识别一个字，仍然只在第一行范围内进行宽松匹配。
            if (!candidate) {
                candidate = results.find(result => {
                    const text = String(result?.text || "").replace(/\s+/g, "");
                    return text.includes("商城")
                        && result.y >= SHOP_ROW_REGION.minY
                        && result.y <= SHOP_ROW_REGION.maxY;
                });
            }

            if (candidate) {
                candidate.click();
                return true;
            }
        } catch (error) {
            log.warn(`查找商城入口异常：${String(error.message || error)}`);
        } finally {
            if (image) image.dispose();
        }
        await sleep(600);
    }
    return false;
}

/**
 * 轮询确认已经进入商城页面。
 * 未确认时仍会继续读取一次 OCR，给页面加载较慢的设备留下机会。
 * @param {number} timeoutSeconds 超时时间（秒）
 * @returns {Promise<boolean>}
 */
async function waitMonthlyCardPage(timeoutSeconds) {
    const startedAt = Date.now();
    const timeoutMs = Math.max(3, timeoutSeconds) * 1000;

    while (Date.now() - startedAt < timeoutMs) {
        let image = null;
        try {
            image = captureGameRegion();
            const tabResults = resultsToArray(image.findMulti(RecognitionObject.Ocr(
                TAB_SEARCH_REGION.x,
                TAB_SEARCH_REGION.y,
                TAB_SEARCH_REGION.width,
                TAB_SEARCH_REGION.height
            )));
            if (tabResults.some(result => String(result?.text || "").includes("空月祝福"))) {
                return true;
            }

            // 未购买月卡时天数区域可能为空，用商城左侧导航作为兜底页面标识。
            const navResults = resultsToArray(image.findMulti(RecognitionObject.Ocr(
                SHOP_NAV_REGION.x,
                SHOP_NAV_REGION.y,
                SHOP_NAV_REGION.width,
                SHOP_NAV_REGION.height
            )));
            if (navResults.some(result => {
                const text = String(result?.text || "");
                return text.includes("推荐商品") || text.includes("礼包商城") || text.includes("角色装扮");
            })) {
                return true;
            }
        } catch (error) {
            log.debug(`等待月卡页面确认异常：${String(error.message || error)}`);
        } finally {
            if (image) image.dispose();
        }
        await sleep(300);
    }

    return false;
}

/**
 * OCR 轮询读取「剩余 N 天」文本。
 * @param {number} timeoutSeconds 超时时间（秒）
 * @returns {Promise<{status: string, data: Object, reason: string}>}
 */
async function readDayText(timeoutSeconds) {
    const startedAt = Date.now();
    const timeoutMs = Math.max(3, timeoutSeconds) * 1000;
    let lastText = "";
    let sawRemainKeyword = false;

    while (Date.now() - startedAt < timeoutMs) {
        let image = null;
        try {
            image = captureGameRegion();
            const results = resultsToArray(image.findMulti(RecognitionObject.Ocr(
                DAY_TEXT_REGION.x,
                DAY_TEXT_REGION.y,
                DAY_TEXT_REGION.width,
                DAY_TEXT_REGION.height
            )));

            for (const result of results) {
                const text = String(result?.text || "").trim();
                if (!text) continue;
                lastText = text;
                if (text.includes("剩余")) sawRemainKeyword = true;

                const parsed = parseDayText(text);
                if (parsed) {
                    return {
                        status: "observed",
                        data: {days: parsed.days, claimed: parsed.claimed, text},
                        reason: null
                    };
                }
            }
        } catch (error) {
            log.debug(`读取月卡天数 OCR 异常：${String(error.message || error)}`);
        } finally {
            if (image) image.dispose();
        }
        await sleep(400);
    }

    return {
        status: "unknown",
        data: {days: null, claimed: null, text: lastText || null},
        reason: sawRemainKeyword
            ? "识别到月卡文字但无法解析剩余天数"
            : "未识别到剩余天数，可能未购买月卡或页面未加载完成"
    };
}

/**
 * 从 OCR 文本解析月卡剩余天数，并兼容常见数字误识别。
 * @param {string} text OCR 原文
 * @returns {?{days: number, claimed: boolean}}
 */
function parseDayText(text) {
    if (!text) return null;

    const normalized = String(text)
        .replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/\s+/g, "");
    let match = normalized.match(/剩余(?:时间)?[^\d]{0,4}([0-9lI|!OoSsBb]{1,3})[^\d]{0,4}天/);
    if (!match) match = normalized.match(/([0-9lI|!OoSsBb]{1,3})天/);
    if (!match) return null;

    let digits = normalizeDigits(match[1]);
    if (!/^\d+$/.test(digits)) return null;

    // 使用「天」前更完整的数字串，避免三位正则截断较长 OCR 结果。
    const fullMatch = normalized.match(/([0-9lI|!OoSsBb]+)天/);
    if (fullMatch) {
        const fullDigits = normalizeDigits(fullMatch[1]);
        if (/^\d+$/.test(fullDigits)) {
            const fullNumber = parseInt(fullDigits, 10);
            if (fullNumber > 999) return null;
            if (fullDigits.length >= digits.length) digits = fullDigits;
        }
    }

    const days = parseInt(digits, 10);
    if (!Number.isInteger(days) || days < 0 || days > 999) return null;

    return {
        days,
        claimed: /本日已领取|今日已领取|已领取/.test(normalized)
    };
}

function normalizeDigits(value) {
    return String(value)
        .replace(/[lI|!]/g, "1")
        .replace(/[Oo]/g, "0")
        .replace(/[Ss]/g, "5")
        .replace(/[Bb]/g, "8");
}

function resultsToArray(results) {
    if (!results) return [];
    if (Array.isArray(results)) return results;
    const count = Number.isInteger(results.count) ? results.count : (results.length || 0);
    const array = [];
    for (let index = 0; index < count; index++) {
        array.push(results[index]);
    }
    return array;
}
