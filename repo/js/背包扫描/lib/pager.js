import { GRID, PAGER, CELLS } from "./config.js";
import { disposeRegion, isCancelled, srcMatOf, matSize, capture, initPixelReader, pixelReady } from "./util.js";
import { thumbState } from "./slider.js";
import { sampleProbeColumn, probeColumnSame } from "./cells.js";

function captureProbeOnce() {
    let frame = null;
    try {
        frame = capture();
        const mat = srcMatOf(frame);
        const sz = matSize(mat);
        if (!sz.rows || !sz.cols) return { ok: false, error: "无法读取图像尺寸" };
        if (!pixelReady()) {
            const pr = initPixelReader(mat);
            if (!pr.ok) return { ok: false, error: "取色 API 不可用：" + pr.report.join(" ") };
        }
        const samples = sampleProbeColumn(mat, sz, 4);
        if (!samples) return { ok: false, error: "探针列越界" };
        return { ok: true, samples: samples };
    } catch (e) {
        return { ok: false, error: (e && e.message) ? e.message : String(e) };
    } finally {
        disposeRegion(frame);
    }
}

export async function prepareScrollTarget(opts) {
    const o = opts || {};
    let hx = PAGER.hoverX;
    const col = o.col;
    if (typeof PAGER.hoverAltX === "number" && typeof col === "number") {
        const last = CELLS.columns.length;
        if (col <= 2) hx = PAGER.hoverX;
        else if (col >= last - 1) hx = PAGER.hoverAltX;
    }
    const cx = Math.round(hx);
    const cy = Math.round(GRID.cellOrigin.y + PAGER.hoverRow * GRID.cellPitch.y);
    if (typeof moveMouseTo === "function") {
        try { moveMouseTo(cx, cy); } catch { }
    }
    await sleep(PAGER.preScrollHoverMs);
    return { x: cx, y: cy };
}

 function ticksForRows(rowCount, completedPages) {
    const base = PAGER.ticksPerRow * rowCount;
    let ticks = Math.round(base);
    const at = PAGER.correctionAtPage > 0 ? PAGER.correctionAtPage : PAGER.correctionInterval;
    if (rowCount === GRID.rows && PAGER.correctionInterval > 0 &&
        (completedPages + 1) % PAGER.correctionInterval === at % PAGER.correctionInterval) {
        ticks -= 1;
    }
    ticks = Math.max(1, ticks);
    return Math.min(ticks, PAGER.maxTicksPerTurn);
}

 const SCROLL_DOWN = -1;

 async function sendTicks(ticks, dir) {
    if (typeof verticalScroll !== "function") {
        throw new Error("宿主 verticalScroll 不可用");
    }
    const d = (dir === undefined || dir === null) ? SCROLL_DOWN : dir;
    for (let i = 0; i < ticks; i++) {
        if (isCancelled()) return false;
        verticalScroll(d);
        if ((i + 1) % PAGER.tickBatchForSleep === 0) await sleep(PAGER.tickIntervalMs);
    }
    await sleep(PAGER.minSettleMs);
    return true;
}

export async function scrollRowsVerified(requestedRows, completedPages, opts) {
    const o = opts || {};
    if (!(requestedRows >= 1) || requestedRows > GRID.rows) {
        return { outcome: "unconfirmed", error: "无效的翻页行数：" + requestedRows };
    }
    const retryMax = (typeof o.retryCount === "number") ? o.retryCount : PAGER.turnRetryCount;
    const itemsSeen = (typeof o.itemsSeen === "number") ? o.itemsSeen : 0;
    for (let attempt = 0; attempt <= retryMax; attempt++) {
        await prepareScrollTarget();
        const preThumb = await thumbState({ band: "bottom" });
        if (preThumb.atBottom) {
            return {
                outcome: "endOfList", requestedRows: requestedRows, advancedRows: 0,
                endAuthoritative: true, itemsSeen: itemsSeen, via: "把手 BOTTOM"
            };
        }
        const beforeProbe = await captureProbeOnce();
        if (!beforeProbe.ok) {
            return { outcome: "unconfirmed", requestedRows: requestedRows,
                advancedRows: 0, retried: attempt > 0,
                error: "翻页前探针采样失败：" + (beforeProbe.error || "未知") };
        }
        const ticks = ticksForRows(requestedRows, completedPages);
        const sent = await sendTicks(ticks);
        if (!sent) return { outcome: "cancelled", requestedRows: requestedRows };
        const afterProbe = await captureProbeOnce();
        if (!afterProbe.ok) {
            return { outcome: "unconfirmed", requestedRows: requestedRows,
                advancedRows: 0, retried: attempt > 0,
                error: "翻页后探针采样失败：" + (afterProbe.error || "未知") };
        }
        const same = probeColumnSame(beforeProbe.samples, afterProbe.samples);
        const moved = (same === null) ? null : !same;

        if (moved === null) {
            return {
                outcome: "unconfirmed", requestedRows: requestedRows,
                advancedRows: 0, retried: attempt > 0,
                error: "无法判定位移（探针采样形状不一致）"
            };
        }
        if (moved) {
            return {
                outcome: "advanced",
                requestedRows: requestedRows,
                advancedRows: requestedRows,
                retried: attempt > 0
            };
        }
    }
    const finalThumb = await thumbState({ band: "bottom" });
    if (finalThumb.atBottom) {
        return {
            outcome: "endOfList",
            requestedRows: requestedRows,
            advancedRows: 0,
            retried: retryMax > 0,
            endAuthoritative: true,
            itemsSeen: itemsSeen,
            via: "把手 BOTTOM"
        };
    }
    const reason = (finalThumb.state === "UNKNOWN")
        ? "把手读数不可用（" + (finalThumb.evidence.reason || "未知") + "）且无位移"
        : "把手未达底部（" + finalThumb.evidence.hit + "/" + finalThumb.evidence.total +
          " 命中，需 " + finalThumb.evidence.minHit + "）却无位移 ⇒ 疑似输入丢失/卡死";
    return {
        outcome: "unconfirmed",
        requestedRows: requestedRows,
        advancedRows: 0,
        retried: retryMax > 0,
        endAuthoritative: false,
        itemsSeen: itemsSeen,
        via: "把手 " + finalThumb.state,
        error: reason
    };
}
