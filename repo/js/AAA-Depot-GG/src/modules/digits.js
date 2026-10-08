/**
 * 数量识别：物品图标下方那行数字（剩余数量），用 0-9 的 PNG 模板匹配，不走 OCR。
 *
 * 四步：
 *   1) 拿到目标物品图标位置，取它正下方一小块作为识别区域（可用设置微调）
 *   2) 对该区域跑 0-9 十个模板，收集所有命中框
 *   3) 非极大抑制去重（x、y 两个方向重叠都超过阈值才算同一个数字）
 *   4) 按 x 排序后拼成整数返回
 *
 * OpenCV 模板匹配没有尺度不变性：模板字号和画面字号差 15~20% 分数就明显下降。
 * 所以内置一张缩放系数表（DIGIT_SCALE_LIST）：《诊断报告》第③节把每个系数都跑一遍打成表，
 * 照表把最准的系数填进设置项 digitScale。
 */
import { COUNT_MAX_BY_CATEGORY, COUNT_MAX_FALLBACK, DEFAULT_LIMITS, DIGIT_DIR, DIGIT_SCALE_LIST } from "../constants.js";
import { readInteger } from "./config.js";
import { errorText } from "../utils/common.js";
import { dbg } from "../utils/debuglog.js";
import { isDiagEnabled, printDiagReport, putDiag } from "../utils/diag.js";
import { notice } from "../utils/voice.js";

const digitMatCache = new Map(); // key: `${digit}|${scale}`
let naturalSize = null;

/** 读（按系数缩放后的）数字模板；失败返回 null 并 warn */
function getDigitMat(digit, scale) {
    const key = `${digit}|${scale}`;
    if (digitMatCache.has(key)) {
        return digitMatCache.get(key);
    }

    const path = `${DIGIT_DIR}/${digit}.png`;
    let mat = null;
    try {
        if (Math.abs(scale - 1) < 1e-6) {
            mat = file.readImageMatSync(path);
        } else {
            const base = file.readImageMatSync(path);
            const w = Math.max(1, Math.round(base.width * scale));
            const h = Math.max(1, Math.round(base.height * scale));
            mat = file.readImageMatWithResizeSync(path, w, h, 1); // 1 = 双线性
        }
    } catch (error) {
        notice(`读取数字模板失败：${path}（${errorText(error)}）`);
    }

    digitMatCache.set(key, mat);
    return mat;
}

/** 数字模板原始尺寸（用来算缩放后的目标尺寸） */
function digitNaturalSize() {
    if (naturalSize) {
        return naturalSize;
    }
    const mat = getDigitMat(0, 1);
    naturalSize = mat ? { width: mat.width, height: mat.height } : { width: 0, height: 0 };
    return naturalSize;
}

/** 在给定区域跑 0-9 十个模板，返回所有命中框 [{ digit, x, y, w, h }] */
function matchDigits(roi, scale, threshold) {
    if (typeof captureGameRegion !== "function") {
        throw new Error("当前 BetterGI 版本没有 captureGameRegion()，无法做模板匹配");
    }

    const region = captureGameRegion();
    const out = [];
    try {
        for (let digit = 0; digit <= 9; digit += 1) {
            const mat = getDigitMat(digit, scale);
            if (!mat) continue;

            const ro = RecognitionObject.TemplateMatch(mat, roi.x, roi.y, roi.w, roi.h);
            ro.threshold = threshold;
            ro.Use3Channels = false; // 数字是白色文字，灰度匹配就够，也更快

            let raw = null;
            try {
                if (typeof region.findMulti === "function") {
                    raw = region.findMulti(ro);
                } else if (typeof region.FindMulti === "function") {
                    raw = region.FindMulti(ro);
                } else {
                    throw new Error("captureGameRegion() 不支持 findMulti()");
                }
            } finally {
                if (ro && typeof ro.dispose === "function") {
                    try { ro.dispose(); } catch (error) { /* 释放失败不影响结果 */ }
                }
            }

            if (raw == null) continue;
            const count = (typeof raw.count === "number") ? raw.count
                : (typeof raw.Count === "number") ? raw.Count
                : (Array.isArray(raw) ? raw.length : 0);

            for (let i = 0; i < count; i += 1) {
                const box = raw[i];
                if (!box) continue;
                if (typeof box.isExist === "function" && !box.isExist()) continue;
                const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
                out.push({
                    digit,
                    x: num(box.x),
                    y: num(box.y),
                    w: num(box.width),
                    h: num(box.height)
                });
            }
        }
    } finally {
        if (region && typeof region.dispose === "function") {
            region.dispose();
        }
    }

    return out;
}

/** 非极大抑制：x、y 两个方向重叠都超过 maxOverlap 才算同一个数字 */
function suppress(candidates, maxOverlap) {
    const adopted = [];
    for (const c of candidates) {
        let duplicated = false;
        for (const a of adopted) {
            const xOverlap = Math.max(0, Math.min(c.x + c.w, a.x + a.w) - Math.max(c.x, a.x));
            const yOverlap = Math.max(0, Math.min(c.y + c.h, a.y + a.h) - Math.max(c.y, a.y));
            if (xOverlap > maxOverlap && yOverlap > maxOverlap) {
                duplicated = true;
                break;
            }
        }
        if (!duplicated) {
            adopted.push(c);
        }
    }
    return adopted;
}

/**
 * 高度一致性过滤：只保留"高度差不多"的命中。
 *
 * 识别区域比数字本身大，边上会框进别的东西（图标边框的竖线、分隔线、角标背景…），
 * 那些常被认成一个数字：区域往左扩 10px，图标左边缘一条竖线被认成 "1"，
 * **1667 就拼成了 11667** —— 多一个前导 1，超过合理上限判成误识别，数量直接废掉。
 * 真正的数字是同一行、同一字号，**高度一致**；杂框高度明显不同，据此丢掉。
 */
function keepSameHeight(candidates, tolPct) {
    if (!candidates || candidates.length < 3 || tolPct <= 0) {
        return candidates;
    }

    const hs = candidates.map((c) => c.h).sort((a, b) => a - b);
    const median = hs[Math.floor(hs.length / 2)];
    if (median <= 0) {
        return candidates;
    }

    const kept = candidates.filter((c) => Math.abs(c.h - median) <= median * tolPct / 100);
    if (kept.length === 0 || kept.length === candidates.length) {
        return candidates;
    }
    // 排障数据：只落盘，窗口不占版面
    dbg(`[数量] 按高度一致性丢弃 ${candidates.length - kept.length} 个杂框（保留高度 ≈ ${median.toFixed(0)}px 的 ${kept.length} 个）`);
    return kept;
}

/** 非极大抑制 + 高度一致性过滤 → 最终数字列表 */
function cleanup(candidates, maxOverlap, heightTol) {
    return keepSameHeight(suppress(candidates, maxOverlap), heightTol);
}

/** 按 x 从左到右拼成整数 */
function assemble(adopted) {
    if (adopted.length === 0) {
        return null;
    }
    const sorted = adopted.slice().sort((a, b) => a.x - b.x);
    return sorted.reduce((num, item) => num * 10 + item.digit, 0);
}

/**
 * 数量识别区域 = 目标物品图标正下方的一块。
 * 三个设置项微调：左右各扩 countRegionPadX、往下偏移 countRegionOffsetY、高度 countRegionHeight。
 */
export function countRoiOf(foodBox, screen, offsetYOverride) {
    const padX = readInteger("countRegionPadX", DEFAULT_LIMITS.countRegionPadX, 0, 400);
    const offsetY = (typeof offsetYOverride === "number")
        ? offsetYOverride
        : readInteger("countRegionOffsetY", DEFAULT_LIMITS.countRegionOffsetY, -400, 400);
    const height = readInteger("countRegionHeight", DEFAULT_LIMITS.countRegionHeight, 8, 400);

    const x = Math.max(0, Math.round(foodBox.x - padX));
    const y = Math.max(0, Math.round(foodBox.y + foodBox.h + offsetY));
    const w = Math.max(4, Math.min(screen.width - x, Math.round(foodBox.w + padX * 2)));
    const h = Math.max(4, Math.min(screen.height - y, height));
    return { x, y, w, h };
}

/** 这个值认到了几位（字形数优先，其次按数值位数——前导 0 会被拼丢） */
function widthOf(r) {
    return Math.max(Number(r.kept) || 0, String(r.value).length);
}

/**
 * 扫描里挑一个"最像对的"结果。**先比位数，再比票数**。
 *
 * 只比票数会输给噪声：扫描 11 个系数时，真值 1666 只在 2 个系数下出现，
 * 而噪声「1」（区域边上的竖线被当成数字 1）在 3 个系数下都出现
 * → 纯按票数 3 > 2，噪声赢，脚本拿 1 当上限就只存了 1 个。
 * 位数是最硬的信号："读到一串数字"和"只蹭到一个孤零零的字形"，本就不是一个量级。
 *
 * 排序：位数降序 → 出现次数降序 → 缩放系数最接近 1.00 的那个。
 */
function pickBest(results) {
    const valid = results.filter((r) => r.value != null && r.value > 0);
    if (valid.length === 0) {
        return null;
    }

    const counter = new Map();
    for (const r of valid) {
        counter.set(r.value, (counter.get(r.value) || 0) + 1);
    }

    return valid.slice().sort((a, b) => {
        const ca = counter.get(a.value);
        const cb = counter.get(b.value);
        return (widthOf(b) - widthOf(a))
            || (cb - ca)
            || (Math.abs(a.scale - 1) - Math.abs(b.scale - 1));
    })[0];
}

/** 解析"0,16,32"这类逗号分隔的整数列表；解析不出来就用兜底值 */
function parseOffsets(raw, fallback) {
    const out = [];
    for (const part of String(raw == null ? "" : raw).split(/[,，\s]+/)) {
        const v = Number(part);
        if (Number.isFinite(v)) {
            out.push(Math.round(v));
        }
    }
    return out.length > 0 ? out : fallback;
}

/**
 * ② 的结果里挑一个"最像对的"偏移：规则同 pickBest（**先比位数再比票数**），
 * 并列时取离图标最近的那个偏移。
 */
function pickBestOffset(results) {
    const valid = results.filter((r) => r.value != null && r.value > 0);
    if (valid.length === 0) {
        return null;
    }

    const counter = new Map();
    for (const r of valid) {
        counter.set(r.value, (counter.get(r.value) || 0) + 1);
    }

    return valid.slice().sort((a, b) => {
        const ca = counter.get(a.value);
        const cb = counter.get(b.value);
        return (widthOf(b) - widthOf(a))
            || (cb - ca)
            || (Math.abs(a.offset) - Math.abs(b.offset));
    })[0];
}

/**
 * 合理性上限：背包里一个物品的数量不可能超过它，**按分类取**：
 *   材料 9999 / 料理 2000（游戏写死的单格上限）。
 *
 * 不能统一成一个数：
 *   统一 9999 → 料理那档完全没防御（认出 9995 也放行，点击上限被抬到容量 32，会误存别的东西）；
 *   统一 2000 → 材料真实剩 9995 会被当成误识别杀掉（"真值被误杀"更难排查）。
 *
 * 识别区域里混进别的文字（按钮上的数字、金币数…）拼出来会是个离谱的大数
 * （出现过 11667 / 1277），拿它当"点击上限"只会一路点到容量上限，毫无意义。
 * 超过就判为"没识别到"，退回靠「容量已满」停止。
 */
function plausible(value, maxPlausible) {
    if (value == null) {
        return null;
    }
    if (value > maxPlausible) {
        // 只落盘：一次扫描要跑 11 个系数 × 多个偏移，逐条提示会把日志刷爆。
        // 常规模式下"数量没认出来"由 clickFoodUntilFull 统一提示一次。
        dbg(`[数量] 识别出 ${value}，超过合理上限 ${maxPlausible} —— 多半是识别区域里混进了别的数字，判定为未识别到`);
        return null;
    }
    return value;
}

/** 该分类的数量上限（推断不出分类时取宽松那档，宁可放过也别误杀真值） */
function countMaxOf(category) {
    return COUNT_MAX_BY_CATEGORY[category] || COUNT_MAX_FALLBACK;
}

/**
 * 跑一次完整扫描（② 区域 × ③ 系数），两张表**攒进《诊断报告》**。
 *
 * ② 数字在图标下方（或内部）多少 —— 用当前系数扫几个偏移
 * ③ 模板该缩放多少 —— 用 ② 里最好的那个区域扫全部系数
 * 区域没对准时 ③ 会整片"未识别到"，拿它定系数毫无意义，所以 ③ 必须跟着 ② 走。
 *
 * 这里不自己打日志：两张表统一进报告，由 diag.js 一次排版输出，免得和正文打架。
 *
 * 返回 { best, rawBest, regionBest, scanOffset, roi }；best 为 null 表示整轮都没认到
 * （或可信度不足）。
 */
function runScan(foodBox, screen, threshold, maxOverlap, maxPlausible, fixed, natural, heightTol) {
    const offsets = parseOffsets(DEFAULT_LIMITS.digitScanOffsets, [0]);

    // ② 区域扫描
    const regionRows = [];
    const regionResults = [];
    for (const off of offsets) {
        const r = countRoiOf(foodBox, screen, off);
        const adopted = cleanup(matchDigits(r, fixed, threshold), maxOverlap, heightTol);
        const value = plausible(assemble(adopted), maxPlausible);
        regionResults.push({ offset: off, value, kept: adopted.length });
        regionRows.push(`下移 ${String(off).padStart(3)}px｜区域 ${r.x},${r.y},${r.w},${r.h}｜去重 ${String(adopted.length).padStart(2)}｜${value == null ? "未识别到" : value}`);
    }
    putDiag("region", [
        `物品图标：${Math.round(foodBox.x)},${Math.round(foodBox.y)} ${Math.round(foodBox.w)}x${Math.round(foodBox.h)}`,
        `系数固定 ${fixed.toFixed(2)}，扫描偏移：${offsets.join(" / ")}`,
        ""
    ].concat(regionRows));

    // ③ 系数扫描（用 ② 里最好的那个区域）
    const regionBest = pickBestOffset(regionResults);
    const scanOffset = regionBest
        ? regionBest.offset
        : readInteger("countRegionOffsetY", DEFAULT_LIMITS.countRegionOffsetY, -400, 400);
    const roi = countRoiOf(foodBox, screen, scanOffset);
    const results = [];
    const rows = [];
    for (const scale of DIGIT_SCALE_LIST) {
        const candidates = matchDigits(roi, scale, threshold);
        const adopted = cleanup(candidates, maxOverlap, heightTol);
        const value = plausible(assemble(adopted), maxPlausible);
        results.push({ scale, value, hits: candidates.length, kept: adopted.length });
        rows.push(`${scale.toFixed(2)}  |  命中 ${String(candidates.length).padStart(2)}  |  去重 ${String(adopted.length).padStart(2)}  |  ${value == null ? "未识别到" : value}`);
    }

    const best = pickBest(results);
    const agree = best ? results.filter((r) => r.value === best.value).length : 0;
    // 可信度：**要求至少认到 2 位**。只认到 1 个字形的"1"基本都是噪声
    // （区域里根本没有数字，却扫描认出 1，照它点就只存 1 个）。
    const credible = !!best && widthOf(best) >= 2;
    putDiag("scale", [
        regionBest
            ? `识别区域：${roi.x},${roi.y},${roi.w},${roi.h}（采用②里最好的偏移 ${scanOffset}px，该偏移认出 ${regionBest.value}）`
            : `识别区域：${roi.x},${roi.y},${roi.w},${roi.h}（②没认到任何数，退回默认偏移 ${scanOffset}px）`,
        `数字模板原始尺寸：${natural.width}x${natural.height}（${DIGIT_DIR}）`,
        `匹配阈值：${threshold.toFixed(2)}`,
        "",
        " 系数  |  命中  |  去重  |  识别结果",
        " ------|--------|--------|-----------"
    ].concat(rows).concat([
        "",
        best
            ? `自动取值：${best.value}（系数 ${best.scale.toFixed(2)}，认到 ${widthOf(best)} 位，${agree} 个系数下一致）`
            : "自动取值：失败 —— 所有系数都没识别到数字，请先看②区域扫描的结果，把区域对准数字"
    ]));

    return { best: credible ? best : null, rawBest: best, credible, agree, regionBest, scanOffset, roi };
}

/** ④ 最终采用值与理由，攒进报告 */
function putVerdict(lines) {
    putDiag("verdict", lines);
}

/**
 * 识别物品下方的剩余数量。
 *
 * @param {{x:number,y:number,w:number,h:number}} foodBox 目标物品图标的位置
 * @param {{width:number,height:number}} screen
 * @returns {number|null} 识别到的数量；识别不到返回 null
 */
export function readItemCount(foodBox, screen, category) {
    if (!foodBox) {
        notice("没有目标物品的位置，跳过数量识别");
        return null;
    }

    const threshold = readInteger("digitThreshold", 80, 50, 100) / 100;
    const maxOverlap = readInteger("digitMaxOverlap", DEFAULT_LIMITS.digitMaxOverlap, 0, 20);
    const maxPlausible = readInteger("countMax", countMaxOf(category), 1, 99999);
    const heightTol = readInteger("digitHeightTol", DEFAULT_LIMITS.digitHeightTol, 0, 200);
    const fixed = readInteger("digitScale", 100, 40, 250) / 100;
    const natural = digitNaturalSize();

    // ---- 常规模式：固定系数、固定区域，认一次 ----
    const roi = countRoiOf(foodBox, screen);
    const adopted = cleanup(matchDigits(roi, fixed, threshold), maxOverlap, heightTol);
    const normal = plausible(assemble(adopted), maxPlausible);
    // 完整数据串（区域/系数/阈值/去重/结果）是排查"数量认错"的唯一现场证据 —— 只落盘
    dbg(`[数量] 区域 ${roi.x},${roi.y},${roi.w},${roi.h}｜系数 ${fixed.toFixed(2)}｜阈值 ${threshold.toFixed(2)}｜去重 ${adopted.length}｜结果 ${normal == null ? "未识别到" : normal}（上限 ${maxPlausible}）`);

    // ---- 诊断报告：不管常规成不成，都把 ②③ 两张表扫出来 ----
    // 报告由 task.js 在每轮结束统一打出，这里只攒数据。
    if (isDiagEnabled()) {
        const out = runScan(foodBox, screen, threshold, maxOverlap, maxPlausible, fixed, natural, heightTol);
        const scanValue = out.best ? out.best.value : null;
        const picked = (scanValue != null) ? scanValue : normal;
        putVerdict([
            `常规识别：${normal == null ? "未识别到" : `${normal}（区域偏移 ${DEFAULT_LIMITS.countRegionOffsetY}px、系数 ${fixed.toFixed(2)}）`}`,
            out.best
                ? `扫描取值：${out.best.value}（区域偏移 ${out.scanOffset}px、系数 ${out.best.scale.toFixed(2)}，认到 ${widthOf(out.best)} 位）`
                : (out.rawBest
                    ? `扫描取值：未采用 —— 只认到 ${widthOf(out.rawBest)} 位（${out.rawBest.value}），可信度不足（要求 ≥2 位）`
                    : "扫描取值：未采用 —— 所有区域 × 系数组合都没识别到数字"),
            `最终采用：${picked == null ? "未识别到" : picked}`,
            picked == null
                ? "理由：常规与扫描都没拿到可信结果，点击上限将退回容量上限，靠「容量已满」停止"
                : (scanValue != null && normal != null && scanValue !== normal)
                    ? `理由：两者不一致，扫描认到的位数更多（${widthOf(out.best)} 位），采信扫描值`
                    : "理由：常规识别即为可信结果（扫描结果一致或未给出可信值）"
        ]);
        if (picked != null && picked !== normal && normal != null) {
            // 两值不一致 = 点击次数可能差几个。报告里已有完整理由 → 只落盘
            dbg(`[数量] 常规 ${normal} 与扫描 ${picked} 不一致，采信扫描值`);
        }
        return picked;
    }

    if (normal != null) {
        return normal;
    }

    // ---- 常规没认到 → 自动补跑一次扫描，并把报告写进排障文件 ----
    // 区域/系数没调好时这是唯一能拿到诊断数据的途径。
    const out = runScan(foodBox, screen, threshold, maxOverlap, maxPlausible, fixed, natural, heightTol);
    putVerdict([
        `常规识别：未识别到（区域 ${roi.x},${roi.y},${roi.w},${roi.h}、系数 ${fixed.toFixed(2)}）`,
        `扫描取值：${out.best ? `${out.best.value}（区域偏移 ${out.scanOffset}px、系数 ${out.best.scale.toFixed(2)}）` : "未采用"}`,
        `最终采用：${out.best ? out.best.value : "未识别到"}`,
        out.best
            ? "理由：扫描拿到了可信结果（至少 2 位），直接采用"
            : (out.rawBest
                ? `理由：扫描只认到 ${widthOf(out.rawBest)} 位（${out.rawBest.value}），可信度不足（要求 ≥2 位）→ 不采用`
                : "理由：所有区域 × 系数组合都没识别到数字，区域多半没对准")
    ]);
    const saved = printDiagReport("数量识别 · 诊断报告（数量没认到，自动补打）");
    if (out.best) {
        // 扫描拿到了值 = 本次数量识别成功，不影响结果 → 只落盘
        dbg(`[数量] 常规未认到，扫描取到 ${out.best.value}（区域偏移 ${out.scanOffset}px、系数 ${out.best.scale.toFixed(2)}）`);
        return out.best.value;
    }
    // 报告本身只落盘（不占窗口），这里把落点说清楚，方便照着它调区域
    notice(saved
        ? `数量没认出来，自动扫描也没拿到可信结果 —— 《诊断报告》已收进 ${saved}，照它把区域对准`
        : "数量没认出来，自动扫描也没拿到可信结果 —— 排障日志未能落盘（debug/ 目录不可写）");
    return null;
}

/** 释放缓存的数字模板（脚本结束时调用） */
export function disposeDigits() {
    for (const mat of digitMatCache.values()) {
        if (mat && typeof mat.dispose === "function") {
            try {
                mat.dispose();
            } catch (error) {
                // 释放失败只影响内存回收，与运行结果无关 → 只落盘
                dbg(`[数量] 释放数字模板失败：${errorText(error)}`);
            }
        }
    }
    digitMatCache.clear();
    naturalSize = null;
}
