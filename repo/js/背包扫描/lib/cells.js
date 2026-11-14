import { CELLS, RESOLUTION, BATCH1 } from "./config.js";
import { px, sleepMs, isCancelled, readMatBgrRect, DIAG } from "./util.js";

 function scalerFor(sz) {
    const sx = sz.cols / RESOLUTION.baseW;
    const sy = sz.rows / RESOLUTION.baseH;
    return function (r) {
        return {
            x: Math.trunc(r.x * sx), y: Math.trunc(r.y * sy),
            w: Math.trunc(r.w * sx), h: Math.trunc(r.h * sy)
        };
    };
}

export function findZones(mat, sz) {
    const zones = [];
    if (!mat) return zones;
    const toPx = scalerFor(sz);
    const p = toPx({ x: CELLS.probeX, y: 0, w: 1, h: 1 });
    const x = p.x;
    if (x < 0 || x >= sz.cols) {
        return zones;
    }
    const t = CELLS.strictColor;
    const k = sz.rows / RESOLUTION.baseH;
    const yA = Math.max(0, Math.round(CELLS.scanY0 * k));
    const yB = Math.min(sz.rows - 1, Math.round(CELLS.scanY1 * k));
    if (yB < yA) {
        return zones;
    }
    let aboveStrict = false;
    if (yA > 0) {
        const chUp = px(mat, yA - 1, x);
        aboveStrict = !!chUp && chUp[0] === t[0] && chUp[1] === t[1] && chUp[2] === t[2];
    }
    const colProbe = columnProbeRows(mat, yA, yB, x, k, aboveStrict, t);
    if (colProbe) return colProbe;
    let inRun = false, startBase = 0, lastBase = 0;
    let clippedAtStart = false;
    for (let yy = yA; yy <= yB; yy += 1) {
        const ch = px(mat, yy, x);
        const hit = !!ch && ch[0] === t[0] && ch[1] === t[1] && ch[2] === t[2];
        if (hit) {
            if (!inRun) {
                inRun = true;
                startBase = Math.round(yy / k);
                clippedAtStart = (yy === yA) && aboveStrict;
            }
            lastBase = Math.round(yy / k);
        } else if (inRun) {
            inRun = false;
            pushZone(zones, startBase, lastBase, clippedAtStart);
            clippedAtStart = false;
        }
    }
    if (inRun) pushZone(zones, startBase, lastBase, clippedAtStart);
    return zones;
}

const _COL_STATS = { fast: 0, slow: 0, why: "" };

export function columnProbeStats() {
    return { fast: _COL_STATS.fast, slow: _COL_STATS.slow, why: _COL_STATS.why };
}

export function columnProbeStatsReset() {
    _COL_STATS.fast = 0; _COL_STATS.slow = 0; _COL_STATS.why = "";
}

function columnProbeRows(mat, yA, yB, x, k, aboveStrict, t) {
    try {
        if (!BATCH1 || BATCH1.USE_COLUMN_PROBE !== true) { if (DIAG.on) _COL_STATS.slow++; _COL_STATS.why = "开关关闭"; return null; }
        const base = (yA > 0) ? (yA - 1) : yA;
        const nRows = yB - base + 1;
        if (nRows <= 0) { _COL_STATS.slow++; _COL_STATS.why = "行数<=0"; return null; }
        const rd = readMatBgrRect(mat, x, base, 1, nRows);
        if (!rd || !rd.ok || !rd.bgr) {
            _COL_STATS.slow++;
            _COL_STATS.why = "readMatBgrRect 失败：" + ((rd && rd.reason) ? rd.reason : "返回 null");
            return null;
        }
        if (rd.w !== 1 || rd.h !== nRows) {
            _COL_STATS.slow++;
            _COL_STATS.why = "尺寸不符：读到 " + rd.w + "x" + rd.h + "，期望 1x" + nRows;
            return null;
        }
        if (rd.bgr.length < nRows * 3) {
            _COL_STATS.slow++;
            _COL_STATS.why = "数据不足：" + rd.bgr.length + " < " + (nRows * 3);
            return null;
        }
        const zones = [];
        const bgr = rd.bgr;
        let inRun = false, startBase = 0, lastBase = 0, clippedAtStart = false;
        for (let yy = yA; yy <= yB; yy += 1) {
            const o = (yy - base) * 3;
            const hit = bgr[o] === t[0] && bgr[o + 1] === t[1] && bgr[o + 2] === t[2];
            if (hit) {
                if (!inRun) {
                    inRun = true;
                    startBase = Math.round(yy / k);
                    clippedAtStart = (yy === yA) && aboveStrict;
                }
                lastBase = Math.round(yy / k);
            } else if (inRun) {
                inRun = false;
                pushZone(zones, startBase, lastBase, clippedAtStart);
                clippedAtStart = false;
            }
        }
        if (inRun) pushZone(zones, startBase, lastBase, clippedAtStart);
        if (DIAG.on) _COL_STATS.fast++;      
        return zones;
    } catch (e) {
        _COL_STATS.slow++;
        _COL_STATS.why = "异常：" + ((e && e.message) ? e.message : String(e));
        return null;   
    }
}

function pushZone(zones, startBase, lastBase, clippedAtStart) {
    const len = lastBase - startBase + 1;
    if (len < CELLS.minZoneLen) return;
    if (clippedAtStart) {
        return;
    }
    zones.push({ y0: startBase, y1: lastBase, len: len });
}

export async function findZonesSettled(sampleFn, opts) {
    const o = opts || {};
    const timeoutMs = (typeof o.timeoutMs === "number") ? o.timeoutMs : CELLS.settle.timeoutMs;
    const pollMs = (typeof o.pollMs === "number" && o.pollMs > 0) ? o.pollMs : CELLS.settle.pollMs;
    const minZones = (typeof o.minZones === "number" && o.minZones >= 1) ? o.minZones : 1;
    const t0 = Date.now();
    let tries = 0;
    let best = [];
    const mk = function (zones, settled, timedOut, cancelled) {
        return {
            zones: zones, tries: tries, elapsedMs: Date.now() - t0,
            settled: settled, timedOut: timedOut, cancelled: cancelled,
            bestZones: best.length
        };
    };
    for (;;) {
        if (isCancelled()) return mk([], false, false, true);
        tries++;
        const got = sampleFn();
        const zones = (got && Array.isArray(got.zones)) ? got.zones : [];
        if (zones.length > best.length) best = zones;
        if (zones.length >= minZones) return mk(zones, true, false, false);
        const used = Date.now() - t0;
        if (used >= timeoutMs) {
            return mk(best, false, true, false);
        }
        await sleepMs(Math.min(pollMs, timeoutMs - used));
    }
}

export function rowOccupancy(mat, sz, y0) {
    const C = CELLS;
    const toPx = scalerFor(sz);
    const t = C.strictColor;
    const off = C.occupyXOffset;
    const py = toPx({ x: 0, y: y0, w: 1, h: 1 }).y;
    const out = [];
    for (let i = 0; i < C.columns.length; i++) {
        const p = toPx({ x: C.columns[i].l + off, y: 0, w: 1, h: 1 });
        const ch = px(mat, py, p.x);
        const occupied = !!ch && ch[0] === t[0] && ch[1] === t[1] && ch[2] === t[2];
        out.push({ col: i + 1, occupied: occupied, bgr: ch ? [ch[0], ch[1], ch[2]] : null });
    }
    return out;
}

export function sampleProbeColumn(mat, sz, stride) {
    const st = (typeof stride === "number" && stride > 0) ? stride : 4;
    const t = CELLS.strictColor;
    const p = scalerFor(sz)({ x: CELLS.probeX, y: 0, w: 1, h: 1 });
    const x = p.x;
    if (x < 0 || x >= sz.cols) return null;
    const k = sz.rows / RESOLUTION.baseH;
    const yA = Math.max(0, Math.round(CELLS.scanY0 * k));
    const yB = Math.min(sz.rows - 1, Math.round(CELLS.scanY1 * k));
    const out = [];
    for (let y = yA; y <= yB; y += st) {
        const ch = px(mat, y, x);
        if (ch && ch[0] === t[0] && ch[1] === t[1] && ch[2] === t[2]) {
            out.push(t[0], t[1], t[2]);
        } else {
            out.push(0, 0, 0);
        }
    }
    return out;
}

export function probeColumnSame(a, b) {
    if (!a || !b || a.length !== b.length || a.length === 0) return null;
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    return true;
}
