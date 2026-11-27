/**
 * 树脂读数（OCR）—— 用途：按需读出四种树脂，给双倍额度判定与补刷判断用。
 * ① 打开秘境页 ② 读原粹/浓缩 ③ 点「+」 ④ 读须臾/脆弱 → 返回数据
 * 唯一访问游戏界面的文件：截图、OCR、点击、模板匹配都在这里
 *
 * 来源：ResinStatsOCR v6.6（提交 0a119e9）的 src/resin.js，逐行照搬，只改了这段头注释。
 * 模板 Mat 的释放、界面复位、并发排队都在 `collectResin` 内部收口，调用方只管调这一个函数。
 * 上游下次更新时本文件整体覆盖即可；契约见 docs/reference.md 模块篇 §1.1。
 */

import {
    BASE_WIDTH,
    BASE_HEIGHT,
    RESIN_LABELS,
    RATIO,
    CONFIG,
    DIGIT_MATCH_MIN,
    safeDispose,
    logDebug,
    listCount,
    isEmptyResult,
    findTextIn,
    readOriginalCount,
    pickClosestNumber,
    validateCount,
    formatCount,
    parseTransientExpireDays,
    getReplenishButtonRo,
    getCondensedIconRo,
    getCondensedDigitMats,
    getDialogDigitMats,
    getOtherResinIconMats,
    disposeResources
} from "./utils.js";

// ==================== 运行状态 ====================

// 读数开关的下标顺序，与 collectResin(flags) 的入参一致
const FLAG_KEYS = ["original", "condensed", "transient", "fragile"];

// 截图实际尺寸（captureGameRegion 返回，最大 1920×1080）
let frameWidth = BASE_WIDTH;
let frameHeight = BASE_HEIGHT;

// 把入参摊成四个布尔。不传 = 四项全读（脚本独立运行时的用法）
// 数组短了按 false 补齐：少写一位就是「不读那一项」，不猜
function parseFlags(flags) {
    const on = { original: true, condensed: true, transient: true, fragile: true };
    if (flags === undefined || flags === null) {
        return on;
    }
    if (!Array.isArray(flags)) {
        log.warn(`读数开关不是数组（收到 ${typeof flags}），按全读处理`);
        return on;
    }
    for (let i = 0; i < FLAG_KEYS.length; i++) {
        on[FLAG_KEYS[i]] = !!flags[i];
    }
    return on;
}

// ==================== 截图与坐标 ====================

// 比例 → 截图坐标系里的像素矩形
function rectFromRatio(ratio) {
    return {
        x: Math.round(ratio.x * frameWidth),
        y: Math.round(ratio.y * frameHeight),
        width: Math.max(1, Math.round(ratio.w * frameWidth)),
        height: Math.max(1, Math.round(ratio.h * frameHeight))
    };
}

// 量一次截图尺寸，作为比例换算基准
function initFrame() {
    let region = null;
    try {
        region = captureGameRegion();
        if (region && region.width > 0 && region.height > 0) {
            frameWidth = region.width;
            frameHeight = region.height;
        }
    } catch (e) {
        log.warn(`获取截图尺寸失败，按 1920×1080 处理: ${e.message}`);
    } finally {
        safeDispose(region);
    }
    logDebug(`截图基准 ${frameWidth}×${frameHeight}（比例定位，不依赖绝对坐标）`);
}

// ==================== OCR 原语 ====================

// 在指定区域内做一次 OCR，返回 [{text, x, y, width, height}]
// rect 必须是截图坐标系的像素矩形（rectFromRatio 生成）
async function ocrItems(rect, label) {
    const items = [];
    let region = null;
    try {
        region = captureGameRegion();
        const list = region.findMulti(
            RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height));
        const count = listCount(list);
        for (let i = 0; i < count; i++) {
            const item = list[i];
            if (!item || !item.text) {
                continue;
            }
            const text = String(item.text).trim();
            if (text.length === 0) {
                continue;
            }
            items.push({
                text: text,
                x: item.x,
                y: item.y,
                width: item.width || 0,
                height: item.height || 0
            });
        }
        if (items.length === 0) {
            log.warn(`${label}区域内未识别到文本`);
        }
    } catch (e) {
        log.warn(`${label} OCR 异常: ${e.message}`);
    } finally {
        safeDispose(region);
    }
    return items;
}

// 全屏 OCR
async function ocrWholeScreen(label) {
    let region = null;
    const items = [];
    try {
        region = captureGameRegion();
        const list = region.findMulti(RecognitionObject.ocrThis);
        const count = listCount(list);
        for (let i = 0; i < count; i++) {
            const item = list[i];
            if (!item || !item.text) {
                continue;
            }
            const text = String(item.text).trim();
            if (text.length === 0) {
                continue;
            }
            items.push({
                text: text,
                x: item.x,
                y: item.y,
                width: item.width || 0,
                height: item.height || 0
            });
        }
        logDebug(`${label}全屏 OCR 共 ${items.length} 条文本`);
    } catch (e) {
        log.error(`${label}全屏 OCR 异常: ${e.message}`);
    } finally {
        safeDispose(region);
    }
    return items;
}

// 在指定矩形内做一次 OCR，返回 [{text, x, y, width, height}]
function ocrItemsInRect(region, rect) {
    const items = [];
    const list = region.findMulti(RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height));
    const count = listCount(list);
    for (let i = 0; i < count; i++) {
        const item = list[i];
        if (!item || !item.text) {
            continue;
        }
        items.push({ text: String(item.text), x: item.x, y: item.y, width: item.width, height: item.height });
    }
    return items;
}

// ==================== 点击 ====================

// 在区域内找到第一个命中关键字的文本并点击
// 点击走 Region.click()，坐标换算由 BGI 负责；offsetYRatio 为相对画面高度的纵向偏移
async function clickTextIn(rect, keywords, label, offsetYRatio, attempts) {
    const maxAttempts = attempts || CONFIG.RETRY;
    const offsetPx = Math.round((offsetYRatio || 0) * frameHeight);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let region = null;
        let hit = null;
        let derived = null;
        try {
            region = captureGameRegion();
            const list = region.findMulti(
                RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height));
            const count = listCount(list);
            for (let i = 0; i < count; i++) {
                const item = list[i];
                if (!item || !item.text) {
                    continue;
                }
                const text = String(item.text);
                for (const keyword of keywords) {
                    if (text.indexOf(keyword) >= 0) {
                        hit = item;
                        break;
                    }
                }
                if (hit) {
                    break;
                }
            }

            if (hit) {
                // 需要偏移时用 derive 派生一个偏移后的区域，再点它的中心
                if (offsetPx !== 0 && typeof hit.derive === "function") {
                    derived = hit.derive(0, offsetPx);
                    derived.click();
                    logDebug(`点击 "${hit.text}"（偏移 ${offsetPx}px）：${label}`);
                } else {
                    hit.click();
                    logDebug(`点击 "${hit.text}"：${label}`);
                }
                return true;
            }
        } catch (e) {
            log.warn(`${label} 识别或点击异常: ${e.message}`);
        } finally {
            safeDispose(derived);
            safeDispose(hit);
            safeDispose(region);
        }

        if (attempt < maxAttempts - 1) {
            await sleep(CONFIG.TEXT_RETRY_DELAY);
        }
    }

    log.warn(`${label} 未找到目标文本（${keywords.join("/")}）`);
    return false;
}

// 模板匹配并点击命中区域中心
async function clickTemplate(recognitionObject, label, timeout) {
    const limit = timeout || CONFIG.TEMPLATE_TIMEOUT;
    const startTime = Date.now();

    while (Date.now() - startTime < limit) {
        let region = null;
        let result = null;
        try {
            region = captureGameRegion();
            result = region.find(recognitionObject);
            if (!isEmptyResult(result)) {
                result.click();
                logDebug(`${label}已点击（匹配得分 ${result.matchScore}）`);
                return true;
            }
        } catch (e) {
            log.warn(`${label} 匹配异常: ${e.message}`);
        } finally {
            safeDispose(result);
            safeDispose(region);
        }
        await sleep(CONFIG.SLEEP_INTERVAL);
    }

    log.warn(`${label} 匹配超时（${limit}ms）`);
    return false;
}

// ==================== 界面导航 ====================

// 冒险手册是否已打开：左侧竖排标签至少命中 2 个
async function isHandbookOpen() {
    const items = await ocrItems(rectFromRatio(RATIO.HANDBOOK_TABS), "冒险手册左侧标签");
    const hitNames = [];
    for (const keyword of CONFIG.KEYWORDS.HANDBOOK) {
        if (findTextIn(items, [keyword])) {
            hitNames.push(keyword);
        }
    }
    if (hitNames.length >= 2) {
        logDebug(`冒险手册已打开（左侧标签命中 ${hitNames.length} 个：${hitNames.join("、")}）`);
        return true;
    }
    logDebug(`冒险手册未打开（左侧标签仅命中 ${hitNames.length} 个：${hitNames.join("、") || "无"}）`);
    return false;
}

// ① 打开「秘境」页：先开冒险手册，再点左侧「秘境」标签
async function openSecretPage() {
    log.info("① 打开「秘境」页");
    if (!await ensureHandbookOpen()) {
        log.error("冒险手册未能打开（F1 与 ESC 两条路都失败）");
        return false;
    }
    return await clickSecretDomainTab();
}

// ①-1 打开冒险手册：先按 F1，失败退到 ESC → 点击「冒险之证」
async function ensureHandbookOpen() {
    logDebug("  ├─ 打开冒险手册");
    try {
        await genshin.returnMainUi();
    } catch (e) {
        log.warn(`返回主界面失败: ${e.message}`);
    }
    await sleep(CONFIG.UI_DELAY);

    keyPress("F1");
    await sleep(CONFIG.BOOK_OPEN_DELAY);
    if (await isHandbookOpen()) {
        logDebug("  │  F1 打开冒险手册成功");
        return true;
    }

    log.warn("  │  F1 未打开冒险手册，改用 ESC → 冒险之证");
    keyPress("ESCAPE");
    await sleep(1800);
    const clicked = await clickTextIn(
        rectFromRatio(RATIO.BOOK_ITEM_IN_ESC),
        CONFIG.KEYWORDS.BOOK_ITEM,
        "ESC菜单-冒险之证",
        RATIO.BOOK_ITEM_OFFSET_Y,
        2);

    if (clicked) {
        await sleep(CONFIG.BOOK_OPEN_DELAY);
        if (await isHandbookOpen()) {
            logDebug("  │  ESC → 冒险之证 打开成功");
            return true;
        }
    } else {
        log.warn("  │  ESC 菜单里没找到「冒险之证」");
    }

    log.warn("  │  再试一次 F1");
    try {
        await genshin.returnMainUi();
    } catch (e) {
        // 忽略
    }
    await sleep(800);
    keyPress("F1");
    await sleep(CONFIG.BOOK_OPEN_DELAY);
    return await isHandbookOpen();
}

// ①-2 点击左侧「秘境」标签
async function clickSecretDomainTab() {
    logDebug("  └─ 点击「秘境」");
    const clicked = await clickTextIn(
        rectFromRatio(RATIO.HANDBOOK_TABS),
        CONFIG.KEYWORDS.SECRET_TAB,
        "秘境标签",
        0,
        CONFIG.RETRY);

    if (!clicked) {
        log.error("没找到左侧「秘境」标签，可能界面未就绪");
        return false;
    }
    await sleep(CONFIG.UI_DELAY);
    return true;
}

// ③ 点击原粹树脂旁的「+」，匹配到加号即说明秘境页已就绪
async function clickReplenishButton() {
    log.info("③ 点击原粹树脂旁的「+」");
    const clicked = await clickTemplate(getReplenishButtonRo(), "补充树脂加号", CONFIG.TEMPLATE_TIMEOUT);
    if (!clicked) {
        return false;
    }
    await sleep(CONFIG.DIALOG_DELAY);
    return true;
}

// 退出「补充树脂」弹窗：ESC 一下，退出后再发通知
async function closeReplenishDialog() {
    keyPress("ESCAPE");
    await sleep(CONFIG.TEXT_RETRY_DELAY + 300);
    logDebug("已退出「补充树脂」界面");
}

// ==================== 读数 ====================

// 带重试的读数：校验不通过就重读，最多 COUNT_RETRY 次
// readOnce(attempt) 每次都要重新截图，返回原始数值或 null
async function readWithRetry(kind, readOnce) {
    const label = RESIN_LABELS[kind];
    for (let attempt = 1; attempt <= CONFIG.COUNT_RETRY; attempt++) {
        let raw = null;
        try {
            raw = await readOnce(attempt);
        } catch (e) {
            log.warn(`${label}第 ${attempt} 次读取异常: ${e.message}`);
        }

        const value = validateCount(kind, raw, attempt);
        if (value !== null) {
            if (attempt > 1) {
                logDebug(`${label}第 ${attempt} 次读数通过校验: ${value}`);
            }
            return value;
        }

        if (attempt < CONFIG.COUNT_RETRY) {
            log.warn(`${label}第 ${attempt} 次读数无效（原始值 ${formatCount(raw)}），重试`);
            await sleep(CONFIG.COUNT_RETRY_DELAY);
        } else {
            log.warn(`${label}连续 ${CONFIG.COUNT_RETRY} 次读数无效，按未知处理`);
        }
    }
    return null;
}

// 在数字区内用一组数字模板找最像的那个，返回 { value, score }，都不达标返回 null
function matchDigitTemplates(region, rect, mats, label) {
    if (!mats || mats.length === 0) {
        return null;
    }

    let best = null;
    const detail = [];
    for (const item of mats) {
        let res = null;
        try {
            const ro = RecognitionObject.templateMatch(item.mat, rect.x, rect.y, rect.width, rect.height);
            ro.threshold = 0.5;   // 门槛放宽，得分自己比，才能看到全部候选
            res = region.find(ro);
            const score = res && typeof res.matchScore === "number" ? res.matchScore : -1;
            detail.push(`${item.value}:${score >= 0 ? score.toFixed(2) : "无"}`);
            if (!best || score > best.score) {
                best = { value: item.value, score: score };
            }
        } catch (e) {
            log.warn(`数字模板 ${item.value} 匹配异常: ${e.message}`);
        } finally {
            safeDispose(res);
        }
    }

    logDebug(`  ${label || ""}数字模板得分 ${detail.join(" ")}`);
    if (!best || best.score < DIGIT_MATCH_MIN) {
        return null;
    }
    return best;
}

function matchCondensedDigit(region, rect) {
    return matchDigitTemplates(region, rect, getCondensedDigitMats(), "浓缩");
}

// ②-1 浓缩树脂：图标模板定位 → 读图标右侧数字（该页浓缩没有文字标签）
async function readCondensedByIcon() {
    let region = null;
    let icon = null;
    try {
        region = captureGameRegion();
        icon = region.find(getCondensedIconRo());
        if (isEmptyResult(icon) || !(icon.width > 0) || !(icon.height > 0)) {
            log.warn("秘境页没匹配到浓缩树脂图标");
            return null;
        }
        if (icon.x > region.width || icon.y > region.height) {
            log.warn(`浓缩图标坐标 ${icon.x},${icon.y} 超出截图 ${region.width}×${region.height}，判定非截图坐标系，放弃读数`);
            return null;
        }

        // 数字区 = 图标右侧紧邻的同尺寸框（图标是第一个口，数字在第二个口）
        const iconCx = icon.x + icon.width / 2;
        const iconCy = icon.y + icon.height / 2;
        const boxW = Math.round(icon.width * RATIO.CONDENSED_NUM_WIDTH_SCALE);
        const boxH = Math.round(icon.height * RATIO.CONDENSED_NUM_HEIGHT_SCALE);
        const rect = {
            x: Math.max(0, Math.round(icon.x + icon.width)),
            y: Math.max(0, Math.round(iconCy - boxH / 2)),
            width: boxW,
            height: boxH
        };
        logDebug(`  浓缩图标 @${icon.x},${icon.y} ${icon.width}×${icon.height}（得分 ${icon.matchScore}）` +
            ` 中心 ${Math.round(iconCx)},${Math.round(iconCy)}` +
            ` → 数字区（第二个口）${rect.width}×${rect.height}@${rect.x},${rect.y}`);

        // 先用数字模板认字，未命中再走 OCR
        const byDigit = matchCondensedDigit(region, rect);
        if (byDigit) {
            logDebug(`  数字模板命中 ${byDigit.value}（得分 ${byDigit.score.toFixed(2)}）`);
            return byDigit.value;
        }
        logDebug("  数字模板没命中，退回 OCR");

        // 模板没命中，退回 OCR
        const byOcr = readCondensedByOcr(region, rect);
        if (byOcr !== null) {
            logDebug(`  OCR 读到 ${byOcr}`);
            return byOcr;
        }
        log.warn("  浓缩数字没读到（模板与 OCR 均未命中）");
    } catch (e) {
        log.warn(`浓缩树脂图标识别异常: ${e.message}`);
    } finally {
        safeDispose(icon);
        safeDispose(region);
    }
    return null;
}

// 在数字区里跑一次 OCR，按位置取最接近的数字
function readCondensedByOcr(region, rect) {
    const items = ocrItemsInRect(region, rect);
    if (items.length === 0) {
        log.warn("  数字区 OCR 没返回任何文本（框内可能真的没字）");
        return null;
    }
    logDebug(`  数字区 OCR 原文: ${items.map(it => `"${it.text}"`).join(" | ")}`);

    // 「最接近的匹配」：按与图标的位置契合度排序，只认纯数字
    const candidates = pickClosestNumber(items, rect);
    if (candidates.length === 0) {
        log.warn("  数字区没有可用候选");
        return null;
    }
    logDebug("  候选: " + candidates
        .map(c => `"${c.text}"→${c.value}(契合${c.score.toFixed(2)})`)
        .join(" | "));

    const best = candidates[0];
    if (best.score < 0.5) {
        log.warn(`  最接近的候选也太虚（"${best.text}" 契合 ${best.score.toFixed(2)}），按未读到处理`);
        return null;
    }
    logDebug(`  选中 "${best.text}" → ${best.value}（契合 ${best.score.toFixed(2)}）`);
    return best.value;
}

// ② 第一次识别：同一屏读原粹 / 浓缩，各按开关
// 返回 { original, condensed }，未请求或没读到都是 null
async function readSecretPageResin(want) {
    log.info("② 第一次识别：原粹树脂 / 浓缩树脂");

    const out = { original: null, condensed: null };

    if (want.original) {
        out.original = await readWithRetry("original", async () =>
            readOriginalCount(await ocrWholeScreen("秘境页")));
        log.info(`  ${RESIN_LABELS.original}: ${formatCount(out.original)}`);
    } else {
        log.info(`  ${RESIN_LABELS.original}: 未请求，跳过`);
    }

    if (want.condensed) {
        out.condensed = await readWithRetry("condensed", () => readCondensedByIcon());
        log.info(`  ${RESIN_LABELS.condensed}: ${formatCount(out.condensed)}`);
    } else {
        log.info(`  ${RESIN_LABELS.condensed}: 未请求，跳过`);
    }

    return out;
}

// 须臾 / 脆弱：匹配图标后读图标正下方的数字，先 OCR，useDigitFallback 为真时再用数字模板兜底
// state 可选，读一次就往里记：sawIcon 本次是否匹配到图标，lastReason 本次结果类型
//   lastReason: "no-icon" 明确没有这一行 | "icon" 匹配到 | "incomplete" 匹配到但尺寸异常
//               | "no-mat" 模板资源缺失 | "error" 异常
// 外层据此区分「界面上没有该物品（0）」与「有但读不出（未知）」
async function readOtherResinByIcon(kind, useDigitFallback, state) {
    const mats = getOtherResinIconMats();
    const mat = mats[kind];
    if (!mat) {
        log.warn(`  ${RESIN_LABELS[kind]}图标模板缺失，按未知处理`);
        if (state) {
            state.lastReason = "no-mat";
        }
        return null;
    }

    let region = null;
    let icon = null;
    try {
        region = captureGameRegion();
        icon = region.find(RecognitionObject.templateMatch(mat));
        if (isEmptyResult(icon)) {
            log.warn(`  ${RESIN_LABELS[kind]}图标没匹配到`);
            if (state) {
                state.lastReason = "no-icon";
            }
            return null;
        }
        if (!(icon.width > 0) || !(icon.height > 0)) {
            // 匹配到了但尺寸异常：属于半成品结果，不能当作「界面上没有」
            log.warn(`  ${RESIN_LABELS[kind]}图标匹配结果尺寸异常（${icon.width}×${icon.height}），按未知处理`);
            if (state) {
                state.lastReason = "incomplete";
            }
            return null;
        }
        if (state) {
            state.sawIcon = true;
            state.lastReason = "icon";
        }

        const rect = {
            x: Math.max(0, Math.round(icon.x)),
            y: Math.max(0, Math.round(icon.y + icon.height)),
            width: Math.round(icon.width),
            height: Math.round(icon.height * RATIO.OTHER_NUM_HEIGHT_SCALE)
        };
        logDebug(`  ${RESIN_LABELS[kind]}图标 @${icon.x},${icon.y} ${icon.width}×${icon.height}（得分 ${icon.matchScore}）` +
            ` → 数字区 ${rect.width}×${rect.height}@${rect.x},${rect.y}`);

        const items = ocrItemsInRect(region, rect);
        const candidates = pickClosestNumber(items, rect);
        if (candidates.length > 0 && candidates[0].score >= 0.5) {
            const best = candidates[0];
            logDebug(`  ${RESIN_LABELS[kind]} OCR 读到 ${best.value}（原文 "${best.text}"，契合 ${best.score.toFixed(2)}）`);
            return best.value;
        }
        logDebug(`  ${RESIN_LABELS[kind]} OCR 没读到（原文: ${items.length > 0 ? items.map(it => `"${it.text}"`).join(" | ") : "空"}）` +
            (useDigitFallback ? "，改用数字模板" : "，该项按未知处理"));

        if (!useDigitFallback) {
            // 数字模板一个框只给一位数，两位数（脆弱常见）会被读成其中一位，宁可不猜
            return null;
        }

        const byDigit = matchDigitTemplates(region, rect, getDialogDigitMats(), RESIN_LABELS[kind]);
        if (byDigit) {
            logDebug(`  ${RESIN_LABELS[kind]} 数字模板命中 ${byDigit.value}（得分 ${byDigit.score.toFixed(2)}）`);
            return byDigit.value;
        }
        return null;
    } catch (e) {
        log.warn(`${RESIN_LABELS[kind]}图标识别异常: ${e.message}`);
        if (state) {
            state.lastReason = "error";
        }
        return null;
    } finally {
        safeDispose(icon);
        safeDispose(region);
    }
}

// 图标整轮都没见到 → 界面上没有这一行 → 0
// 见过图标却读不出数字、或中途异常/半成品 → 未知（null）
// 依据：须臾 / 脆弱为 0 时整行不渲染（图标与名称一起消失），所以「没图标」等价于「没有」
function missingAsZero(kind, raw, state) {
    if (raw !== null) {
        return raw;
    }
    if (state.sawIcon) {
        return null;
    }
    if (state.lastReason === "no-icon") {
        log.warn(`  ${RESIN_LABELS[kind]}连续 ${CONFIG.COUNT_RETRY} 次未匹配到图标，界面上没有该行，按 0 处理` +
            `（若持续为 0，请检查图标模板是否需维护）`);
        return 0;
    }
    return null;
}

// ④ 读取补充树脂界面：须臾 / 脆弱走图标定位，各按开关
// needOriginalFallback 由调用方算好（请求了原粹、但第 ② 步没读到）
// 返回 { transient, fragile, original, items }，items 是弹窗整屏 OCR 结果，交给调用方解析有效期
// 数字模板只给须臾兜底（只认一位数），脆弱两位数不适用
async function readReplenishDialog(want, needOriginalFallback) {
    log.info("④ 读取补充树脂界面（须臾 / 脆弱）");

    const out = { transient: null, fragile: null, original: null, items: [] };

    // 须臾：图标定位 → 读图标正下方数字，读不到用数字模板兜底（上限 9，永远一位数）
    if (want.transient) {
        const state = {};
        const raw = await readWithRetry("transient", () => readOtherResinByIcon("transient", true, state));
        out.transient = missingAsZero("transient", raw, state);
        log.info(`  ${RESIN_LABELS.transient}: ${formatCount(out.transient)}`);
    } else {
        log.info(`  ${RESIN_LABELS.transient}: 未请求，跳过`);
    }

    // 脆弱：同样走图标，但不启用数字模板——脆弱常见两位数，一位数模板只会给出其中一位
    if (want.fragile) {
        const state = {};
        const raw = await readWithRetry("fragile", () => readOtherResinByIcon("fragile", false, state));
        out.fragile = missingAsZero("fragile", raw, state);
        log.info(`  ${RESIN_LABELS.fragile}: ${formatCount(out.fragile)}`);
    } else {
        log.info(`  ${RESIN_LABELS.fragile}: 未请求，跳过`);
    }

    // 整屏 OCR 只为两件事：解析须臾的「N天后过期」、给第 ② 步没读到的原粹补一次
    // 两件都用不上就不拍，省一次全屏识别
    if (!want.transient && !needOriginalFallback) {
        logDebug("  弹窗整屏 OCR 无需执行（未请求须臾，原粹也已读到）");
        return out;
    }

    out.items = await ocrWholeScreen("补充树脂界面");
    if (out.items.length === 0) {
        log.error("补充树脂界面没有识别到任何文本，请确认「+」是否点开了弹窗");
    }

    if (needOriginalFallback) {
        const fallback = await readWithRetry("original", async () =>
            readOriginalCount(await ocrWholeScreen("补充树脂界面")));
        if (fallback !== null) {
            log.info(`  ${RESIN_LABELS.original}第 ② 步未读到，改用弹窗结果 ${fallback}`);
            out.original = fallback;
        }
    }

    return out;
}

// ==================== 账号信息 ====================

// 读取当前 UID，失败返回 null
async function readUid() {
    try {
        const uid = await genshin.uid();
        if (uid && Number(uid) > 0) {
            logDebug(`当前 UID: ${uid}`);
            return String(uid);
        }
        log.warn("UID 识别失败（返回 0）");
    } catch (e) {
        log.warn(`UID 识别异常: ${e.message}`);
    }
    return null;
}

// ==================== 工具1：执行流程并返回数据 ====================

// 排队用：界面与模板 Mat 都是共享的，重叠调用会互相踩，这里让每次实际执行串行
let collectTail = Promise.resolve();

/**
 * 按开关跑完 ①→④ 并返回采集结果，不抛异常
 *
 * 模板 Mat 由本函数自己释放，界面复位也由收尾负责；调用方只需要调这一个函数。
 * 同一上下文里的多次调用串行排队，避免并发时后一路用到已释放的资源。
 * 代价是每次调用都重新读一遍图标，量级是十几张 PNG，相对整个流程可忽略。
 *
 * @param {boolean[]} [flags] 读数开关，下标顺序固定 `[原粹, 浓缩, 须臾, 脆弱]`。
 *   不传 = 四项全读（脚本独立运行时的用法）。例：只读原粹 → `[true, false, false, false]`
 * @returns {Promise<{ok: boolean, uid: string|null, requested: object, resin: object,
 *   transientDays: number|null, steps: object, error?: string}>}
 *   `resin` 四项为 number 或 null；未请求的项与读不到的一样是 null，靠 `requested` 区分；
 *   `steps` 各项为 true（走通）/ false（试过失败）/ "skip"（按开关没走）；
 *   ok=false 时 resin 里仍保留已读到的项，error 为失败原因
 */
export async function collectResin(flags) {
    const run = collectTail.then(() => collectOnce(flags), () => collectOnce(flags));
    collectTail = run.catch(() => {});   // 单次失败不卡住后续调用
    return run;
}

async function collectOnce(flags) {
    // 每次都从默认基准起算，避免上一轮 initFrame 失败后沿用旧尺寸
    frameWidth = BASE_WIDTH;
    frameHeight = BASE_HEIGHT;
    setGameMetrics(BASE_WIDTH, BASE_HEIGHT, 1);

    const want = parseFlags(flags);
    const needDialog = want.transient || want.fragile;
    const needPage = want.original || want.condensed || needDialog;

    try {
        const steps = {
            openSecret: needPage ? false : "skip",
            clickPlus: needDialog ? false : "skip",
            dialogClosed: needDialog ? false : "skip"
        };
        const resin = { original: null, condensed: null, transient: null, fragile: null };
        let uid = null;
        let transientDays = null;
        let error = null;

        // 一项都没请求：不碰界面，直接交差（UID 也就没得读）
        if (!needPage) {
            log.info("四项树脂都未请求读数，不进入游戏界面");
            return {
                ok: true,
                uid: null,
                requested: want,
                resin: resin,
                transientDays: null,
                steps: steps
            };
        }

        const wanted = FLAG_KEYS.filter(k => want[k]).map(k => RESIN_LABELS[k]);
        log.info(`开始统计树脂数量（需读：${wanted.join("、")}）`);

        try {
            await genshin.returnMainUi();
            await sleep(CONFIG.UI_DELAY);

            initFrame();

            // 账号信息趁主界面读取（UID 在主界面右下角）
            uid = await readUid();

            // ① 打开「秘境」页（开手册 + 点秘境标签，合并在这一步内）
            if (!await openSecretPage()) {
                throw new Error("未能打开「秘境」页（冒险手册或秘境标签失败）");
            }
            steps.openSecret = true;

            // ② 第一次识别：原粹树脂 + 浓缩树脂，各按开关
            const page = await readSecretPageResin(want);
            resin.original = page.original;
            resin.condensed = page.condensed;

            if (needDialog) {
                // ③ 点击原粹树脂旁的「+」
                if (!await clickReplenishButton()) {
                    throw new Error("没找到原粹树脂旁的「+」按钮，可能没进入秘境页");
                }
                steps.clickPlus = true;

                // ④ 读取补充树脂界面（须臾 / 脆弱），请求了原粹却没读到就顺手补一次
                const dialog = await readReplenishDialog(want, want.original && resin.original === null);
                resin.transient = dialog.transient;
                resin.fragile = dialog.fragile;
                if (dialog.original !== null) {
                    resin.original = dialog.original;
                }

                // 有效期文案与须臾同屏，只有请求了须臾才有意义
                // 须臾为 0 时该行不渲染，天数必然为空；万一整屏 OCR 误抓到别处文字也不采用
                if (want.transient && dialog.items.length > 0) {
                    transientDays = parseTransientExpireDays(dialog.items);
                    if (resin.transient === 0) {
                        transientDays = null;
                    }
                    if (transientDays !== null) {
                        logDebug(`须臾树脂剩余 ${transientDays} 天`);
                    }
                }

                // 先退出弹窗，退出后再发通知（通知由入口统一发）
                await closeReplenishDialog();
                steps.dialogClosed = true;
            } else {
                log.info("③④ 未请求须臾 / 脆弱，跳过「补充树脂」弹窗");
            }
        } catch (e) {
            error = e;
        }

        const result = {
            ok: error === null,
            uid: uid,
            requested: want,
            resin: resin,
            transientDays: want.transient ? transientDays : null,
            steps: steps
        };
        if (error) {
            result.error = error.message;
            result.errorStack = error.stack;
        }
        return result;
    } finally {
        disposeResources();
        // 库调用方只调本函数，界面复位也在这里做；没进过界面就别动游戏
        if (needPage) {
            try {
                await genshin.returnMainUi();
            } catch (e) {
                log.warn(`返回主界面失败: ${e.message}`);
            }
        }
    }
}
