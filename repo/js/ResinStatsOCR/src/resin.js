/**
 * 树脂统计（OCR）· 流程与识别（工具1）
 * ① 打开秘境页 ② 读原粹/浓缩 ③ 点「+」 ④ 读须臾/脆弱 → 返回数据
 * 唯一访问游戏界面的文件：截图、OCR、点击、模板匹配都在这里
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
    getOtherResinIconMats
} from "./utils.js";

// ==================== 运行状态 ====================

// 树脂数量存储，null 表示识别失败
let resinCounts = {
    original: null,
    condensed: null,
    transient: null,
    fragile: null
};

// 须臾树脂剩余天数（弹窗文案「9天后过期」里读到的），读不到保持 null
let transientExpireDays = null;

// 截图实际尺寸（captureGameRegion 返回，最大 1920×1080）
let frameWidth = BASE_WIDTH;
let frameHeight = BASE_HEIGHT;

function resetState() {
    resinCounts = {
        original: null,
        condensed: null,
        transient: null,
        fragile: null
    };
    transientExpireDays = null;
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

// ② 第一次识别：同一屏读原粹 / 浓缩
async function readSecretPageResin() {
    log.info("② 第一次识别：原粹树脂 / 浓缩树脂");

    resinCounts.original = await readWithRetry("original", async () =>
        readOriginalCount(await ocrWholeScreen("秘境页")));
    log.info(`  ${RESIN_LABELS.original}: ${formatCount(resinCounts.original)}`);

    resinCounts.condensed = await readWithRetry("condensed", () => readCondensedByIcon());
    log.info(`  ${RESIN_LABELS.condensed}: ${formatCount(resinCounts.condensed)}`);
}

// 须臾 / 脆弱：匹配图标后读图标正下方的数字，先 OCR，useDigitFallback 为真时再用数字模板兜底
async function readOtherResinByIcon(kind, useDigitFallback) {
    const mats = getOtherResinIconMats();
    const mat = mats[kind];
    if (!mat) {
        return null;
    }

    let region = null;
    let icon = null;
    try {
        region = captureGameRegion();
        icon = region.find(RecognitionObject.templateMatch(mat));
        if (isEmptyResult(icon) || !(icon.width > 0) || !(icon.height > 0)) {
            log.warn(`  ${RESIN_LABELS[kind]}图标没匹配到`);
            return null;
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
        return null;
    } finally {
        safeDispose(icon);
        safeDispose(region);
    }
}

// ④ 读取补充树脂界面：须臾 / 脆弱走图标定位，整屏 OCR 顺带解析有效期
// 数字模板只给须臾兜底（只认一位数），脆弱两位数不适用
async function readReplenishDialog() {
    log.info("④ 读取补充树脂界面（须臾 / 脆弱）");

    // 须臾：图标定位 → 读图标正下方数字，读不到用数字模板兜底（上限 9，永远一位数）
    resinCounts.transient = await readWithRetry("transient", () => readOtherResinByIcon("transient", true));
    log.info(`  ${RESIN_LABELS.transient}: ${formatCount(resinCounts.transient)}`);

    // 脆弱：同样走图标，但不启用数字模板——脆弱常见两位数，一位数模板只会给出其中一位
    resinCounts.fragile = await readWithRetry("fragile", () => readOtherResinByIcon("fragile", false));
    log.info(`  ${RESIN_LABELS.fragile}: ${formatCount(resinCounts.fragile)}`);

    // 整屏 OCR 只为两件事：解析须臾的「N天后过期」、给第 ② 步没读到的原粹补一次
    let lastItems = await ocrWholeScreen("补充树脂界面");
    if (lastItems.length === 0) {
        log.error("补充树脂界面没有识别到任何文本，请确认「+」是否点开了弹窗");
    }

    transientExpireDays = parseTransientExpireDays(lastItems);
    if (transientExpireDays !== null) {
        logDebug(`须臾树脂剩余 ${transientExpireDays} 天`);
    }

    if (resinCounts.original === null) {
        const fallback = await readWithRetry("original", async () => {
            lastItems = await ocrWholeScreen("补充树脂界面");
            return readOriginalCount(lastItems);
        });
        if (fallback !== null) {
            log.info(`  ${RESIN_LABELS.original}第 ② 步未读到，改用弹窗结果 ${fallback}`);
            resinCounts.original = fallback;
        }
    }
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

/**
 * 跑完 ①→④ 并返回采集结果，不抛异常
 * @returns {Promise<{ok: boolean, uid: string|null, resin: object,
 *   transientDays: number|null, steps: object, error?: string}>}
 *   ok=false 时 resin 里仍保留已读到的项，error 为失败原因
 */
export async function collectResin() {
    setGameMetrics(BASE_WIDTH, BASE_HEIGHT, 1);
    resetState();

    log.info("开始统计树脂数量（① 秘境 → ② 原粹/浓缩 → ③「+」→ ④ 弹窗）");

    const steps = {
        openSecret: false,
        clickPlus: false,
        dialogClosed: false
    };
    let uid = null;
    let error = null;

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

        // ② 第一次识别：原粹树脂 + 浓缩树脂
        await readSecretPageResin();

        // ③ 点击原粹树脂旁的「+」
        if (!await clickReplenishButton()) {
            throw new Error("没找到原粹树脂旁的「+」按钮，可能没进入秘境页");
        }
        steps.clickPlus = true;

        // ④ 读取补充树脂界面（须臾 / 脆弱）
        await readReplenishDialog();

        // 先退出弹窗，退出后再发通知（通知由入口统一发）
        await closeReplenishDialog();
        steps.dialogClosed = true;
    } catch (e) {
        error = e;
    }

    const result = {
        ok: error === null,
        uid: uid,
        resin: {
            original: resinCounts.original,
            condensed: resinCounts.condensed,
            transient: resinCounts.transient,
            fragile: resinCounts.fragile
        },
        transientDays: transientExpireDays,
        steps: steps
    };
    if (error) {
        result.error = error.message;
        result.errorStack = error.stack;
    }
    return result;
}
