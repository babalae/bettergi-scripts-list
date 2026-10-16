/**
 * 翻页到底检测：判断列表是否已拉到底，避免滚满 scrollMax（50 次 × 600ms ≈ 30s）。
 *
 * 每次翻页前取一帧右侧列表区域，与上一帧比对；连续 scrollBottomHits(3) 次"未变化"
 * 即判定到底，由调用方抛错终止。调用点：actions.js 的 findFoodWithScroll。
 *
 * 两条比对路径：
 *   ① 逐像素采样（主）：`region.DeriveCrop(x,y,w,h).SrcMat` 取 Mat，
 *      `mat.Get(OpenCvSharp.OpenCvSharp.Vec3b, row, col)` 取像素，Item0/1/2 = B/G/R。
 *      20×20 网格采样，单点差值 > scrollProbePixelTol 记为变化点，
 *      变化点占比 < scrollProbeChangedPct 记为"未变化"。
 *   ② 模板匹配（兜底，仅在取不到 OpenCvSharp 时）：上一帧作模板，在略外扩的
 *      同一区域 find，阈值 0.85。同 JsScript/背包材料统计/lib/backStats.js。
 *
 * 两条都不可用 → 返回"已变化"，退回滚满 scrollMax（宁可多滚，不可误判到底漏掉目标）。
 *
 * 注意：`DeriveCrop` 返回的 Mat 与原 region 共用数据，释放 region 前必须先用完/释放。
 * 故每轮只保留一帧，比对后立即 releaseProbe()。
 */
import { DEFAULT_LIMITS } from "../constants.js";
import { readInteger } from "../modules/config.js";
import { dbg } from "./debuglog.js";

/** 探测区域（屏幕比例）。物品列表在画面右侧 */
const PROBE = DEFAULT_LIMITS.scrollProbeRegion;

/** 取 OpenCvSharp 的 Vec3b 类型；拿不到就返回 null（走模板匹配兜底） */
function vec3bType() {
    try {
        if (typeof OpenCvSharp === "undefined" || !OpenCvSharp) {
            return null;
        }
        const inner = OpenCvSharp.OpenCvSharp;
        return (inner && inner.Vec3b) ? inner.Vec3b : null;
    } catch (error) {
        return null;
    }
}

/** 探测区域的绝对像素矩形 */
export function probeRect(screen) {
    const w = (screen && screen.width) || 0;
    const h = (screen && screen.height) || 0;
    return {
        x: Math.max(0, Math.round(PROBE.x * w)),
        y: Math.max(0, Math.round(PROBE.y * h)),
        w: Math.max(8, Math.round(PROBE.w * w)),
        h: Math.max(8, Math.round(PROBE.h * h))
    };
}

/**
 * 抓一帧探测区域。
 *
 * 不在此处 dispose region —— `DeriveCrop` 出来的 Mat 与原图共用数据，
 * 释放 region 则 Mat 失效。用完调 `releaseProbe()` 收尾。
 *
 * @returns {{rect: object, mat: object, region: object}|null} 取不到返回 null
 */
export function grabProbe(screen) {
    if (typeof captureGameRegion !== "function") {
        return null;
    }
    const rect = probeRect(screen);
    try {
        const region = captureGameRegion();
        if (typeof region.DeriveCrop === "function") {
            const sub = region.DeriveCrop(rect.x, rect.y, rect.w, rect.h);
            if (sub && sub.SrcMat) {
                return { rect, mat: sub.SrcMat, region, sub };
            }
        }
        // 没有 DeriveCrop 就退回整屏的 Mat（精度差点，但还能用）
        if (region.SrcMat) {
            return { rect, mat: region.SrcMat, region, sub: null };
        }
        return null;
    } catch (error) {
        dbg(`[Probe] 抓帧失败：${error && error.message ? error.message : error}`);
        return null;
    }
}

/** 释放一帧。比对完立即调用，不要攒着 */
export function releaseProbe(probe) {
    if (!probe) {
        return;
    }
    try {
        if (probe.sub && typeof probe.sub.dispose === "function") probe.sub.dispose();
    } catch (error) { /* 释放失败不影响主流程 */ }
    try {
        if (probe.region && typeof probe.region.dispose === "function") probe.region.dispose();
    } catch (error) { /* 同上 */ }
}

/** 网格采样比对，返回变化点占比（0~1）。取不到像素时返回 1（当作已变化） */
function changedRatio(a, b, type) {
    const cols = Math.min(Number(a.cols) || 0, Number(b.cols) || 0);
    const rows = Math.min(Number(a.rows) || 0, Number(b.rows) || 0);
    if (cols <= 0 || rows <= 0) {
        return 1;
    }
    const grid = readInteger("scrollProbeGrid", DEFAULT_LIMITS.scrollProbeGrid, 4, 64);
    const tol = readInteger("scrollProbePixelTol", DEFAULT_LIMITS.scrollProbePixelTol, 0, 255);

    let changed = 0;
    let total = 0;
    for (let gy = 0; gy < grid; gy += 1) {
        const y = Math.min(rows - 1, Math.round((gy + 0.5) * rows / grid));
        for (let gx = 0; gx < grid; gx += 1) {
            const x = Math.min(cols - 1, Math.round((gx + 0.5) * cols / grid));
            let pa = null;
            let pb = null;
            try {
                pa = a.Get(type, y, x);
                pb = b.Get(type, y, x);
            } catch (error) {
                dbg(`[Probe] 取像素失败（${x},${y}）：${error && error.message ? error.message : error}`);
                return 1;
            }
            if (!pa || !pb) {
                return 1;
            }
            total += 1;
            const d = Math.max(
                Math.abs(pa.Item0 - pb.Item0),
                Math.abs(pa.Item1 - pb.Item1),
                Math.abs(pa.Item2 - pb.Item2)
            );
            if (d > tol) {
                changed += 1;
            }
        }
    }
    return total > 0 ? changed / total : 1;
}

/** 兜底比对：上一帧作模板，在略外扩的同一区域匹配，命中即未变化 */
function sameByTemplate(prev, cur) {
    if (typeof RecognitionObject === "undefined"
        || typeof RecognitionObject.TemplateMatch !== "function") {
        return false;
    }
    if (!cur || !cur.region || typeof cur.region.find !== "function") {
        return false;
    }
    const r = prev.rect;
    let ro = null;
    try {
        ro = RecognitionObject.TemplateMatch(
            prev.mat,
            Math.max(0, r.x - 1),
            Math.max(0, r.y - 1),
            r.w + 2,
            r.h + 2
        );
        ro.threshold = 0.85;
        const hit = cur.region.find(ro);
        return !!(hit && typeof hit.isExist === "function" && hit.isExist());
    } catch (error) {
        dbg(`[Probe] 模板兜底比对失败：${error && error.message ? error.message : error}`);
        return false;
    } finally {
        try {
            if (ro && typeof ro.dispose === "function") ro.dispose();
        } catch (error) { /* 同上 */ }
    }
}

/**
 * 前后两帧比一遍。
 *
 * @returns {boolean} true = **没变**（列表拉不动了）；false = 变了 / 比不了（当"变了"处理）
 */
export function probeSame(prev, cur) {
    if (!prev || !cur || !prev.mat || !cur.mat) {
        return false;
    }
    const minPct = readInteger(
        "scrollProbeChangedPct", DEFAULT_LIMITS.scrollProbeChangedPct, 0, 100
    ) / 100;

    const type = vec3bType();
    if (type) {
        const ratio = changedRatio(prev.mat, cur.mat, type);
        dbg(`[Probe] 采样比对：变化 ${(ratio * 100).toFixed(1)}%（判定阈值 ${minPct * 100}%）→ ${ratio < minPct ? "没变" : "变了"}`);
        return ratio < minPct;
    }

    // 拿不到 OpenCvSharp → 退回模板匹配
    const same = sameByTemplate(prev, cur);
    dbg(`[Probe] 逐像素不可用，改用模板兜底比对 → ${same ? "没变" : "变了"}`);
    return same;
}
