import { THUMB } from "./config.js";
import { capture, srcMatOf, matSize, disposeRegion, px, pixelReady, initPixelReader } from "./util.js";

const L = (c) => 0.299 * c[2] + 0.587 * c[1] + 0.114 * c[0];

function pickBand(tab) {
    return (tab === THUMB.artifactTab) ? THUMB.topArtifact : THUMB.top;
}

function scanBand(mat, sz, band) {
    const vals = [];
    for (let y = band.y0; y <= band.y1; y += THUMB.step) {
        const a = px(mat, y, THUMB.xBright);
        const b = px(mat, y, THUMB.xDark);
        if (!a || !b) continue;
        vals.push(Math.round((L(a) - L(b)) * 10) / 10);
    }
    let hit = 0;
    for (let i = 0; i < vals.length; i++) if (vals[i] >= THUMB.thr) hit++;
    return { hit: hit, total: vals.length, vals: vals };
}

function bandResult(band, s) {
    const has = s.total > 0 && s.hit >= band.minHit;
    return {
        has: has, hit: s.hit, total: s.total, vals: s.vals,
        y0: band.y0, y1: band.y1, minHit: band.minHit
    };
}

export async function thumbHoverState(opts) {
    const o = opts || {};
    const H = THUMB.hover;
    const out = {
        ok: false, kind: "hover", hit: 0, total: 0,
        hasThumb: false, vals: [], reason: ""
    };
    const ys = [];
    for (let y = H.y0; y <= H.y1; y += H.step) ys.push(y);
    out.total = ys.length;
    if (!ys.length) { out.reason = "悬停取样区间为空"; return out; }
    if (!pixelReady()) { out.reason = "取色不可用"; return out; }
    let frame = null;
    try {
        frame = capture();
        const mat = srcMatOf(frame);
        if (!mat) { out.reason = "无图像"; return out; }
        const sz = matSize(mat);
        if (!sz.rows || !sz.cols) { out.reason = "无法读取图像尺寸"; return out; }
        if (!pixelReady()) {
            const pr = initPixelReader(mat);
            if (!pr.ok) { out.reason = "取色 API 不可用：" + pr.report.join(" "); return out; }
        }
        let hit = 0;
        for (let i = 0; i < ys.length; i++) {
            const v = px(mat, ys[i], H.x);
            if (!v) { out.vals.push(null); continue; }
            out.vals.push([v[0], v[1], v[2]]);
            if (v[0] === H.color[0] && v[1] === H.color[1] && v[2] === H.color[2]) hit++;
        }
        out.hit = hit;
        out.ok = true;
        out.hasThumb = (hit === ys.length);
        out.reason = out.hasThumb ? "底部区命中悬停把手" : ("底部区未见悬停把手（" + hit + "/" + ys.length + "）");
        return out;
    } catch (e) {
        out.reason = "截图/读数异常：" + ((e && e.message) ? e.message : e);
        return out;
    } finally {
        disposeRegion(frame);
    }
}

export async function thumbState(opts) {
    const o = opts || {};
    const which = (o.band === "top") ? "top" : "bottom";
    const tab = (typeof o.tab === "string") ? o.tab : "";
    const out = {
        ok: false, band: which, state: "UNKNOWN",
        hasThumb: false, atBottom: false, evidence: {}
    };

    if (!pixelReady()) out.evidence.reason = "取色不可用";

    let frame = null;
    try {
        frame = capture();
        const mat = srcMatOf(frame);
        if (!mat) { out.evidence.reason = "无图像"; return out; }
        const sz = matSize(mat);
        if (!sz.rows || !sz.cols) { out.evidence.reason = "无法读取图像尺寸"; return out; }
        if (!pixelReady()) {
            const pr = initPixelReader(mat);
            if (!pr.ok) { out.evidence.reason = "取色 API 不可用：" + pr.report.join(" "); return out; }
        }

        if (which === "top") {
            const band = pickBand(tab);
            const s = scanBand(mat, sz, band);
            const r = bandResult(band, s);
            out.ok = true;
            out.hasThumb = r.has;
            out.state = r.has ? "TOP_HAS_THUMB" : "TOP_NO_THUMB";
            out.evidence = {
                seg: { y0: band.y0, y1: band.y1 },
                hit: r.hit, total: r.total, minHit: r.minHit,
                vals: r.vals, tab: tab
            };
            return out;
        }

        const band = THUMB.bottom;
        const s = scanBand(mat, sz, band);
        const r = bandResult(band, s);
        out.ok = true;
        out.hasThumb = r.has;
        out.atBottom = r.has;
        out.state = r.has ? "BOTTOM" : "NO_HANDLE";
        out.evidence = {
            seg: { y0: band.y0, y1: band.y1 },
            hit: r.hit, total: r.total, minHit: r.minHit,
            vals: r.vals,
            reason: r.has ? "底部区命中把手" : "底部区未见把手"
        };
        return out;
    } catch (e) {
        out.evidence.reason = "截图/读数异常：" + ((e && e.message) ? e.message : e);
        out.state = "UNKNOWN";
        return out;
    } finally {
        disposeRegion(frame);
    }
}
