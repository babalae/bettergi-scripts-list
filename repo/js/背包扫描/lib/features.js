export function satMean(bgr) {
    if (!bgr || bgr.length < 3) return null;
    let s = 0, n = 0;
    for (let i = 0; i < bgr.length; i += 3) {
        const B = bgr[i], G = bgr[i + 1], R = bgr[i + 2];
        const mx = B > G ? (B > R ? B : R) : (G > R ? G : R);
        const mn = B < G ? (B < R ? B : R) : (G < R ? G : R);
        s += mx ? (mx - mn) / mx : 0;
        n++;
    }
    return n ? s / n : null;
}

export function ncc(a, b) {
    const n = a.length;
    if (n !== b.length || n === 0) return 0;
    let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
        const x = a[i] - ma, y = b[i] - mb;
        num += x * y; da += x * x; db += y * y;
    }
    if (da <= 1e-9 || db <= 1e-9) return 0;
    return num / Math.sqrt(da * db);
}

export function mae(a, b) {
    const n = a.length;
    if (n !== b.length || n === 0) return 255;
    let s = 0;
    for (let i = 0; i < n; i++) { const d = a[i] - b[i]; s += d < 0 ? -d : d; }
    return s / n;
}

export function desatBgr(bgr, k) {
    const kk = (typeof k === "number" && k >= 0 && k <= 1) ? k : 0.50;
    const n = bgr.length;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 3) {
        const b = bgr[i], g = bgr[i + 1], r = bgr[i + 2];
        const L = 0.114 * b + 0.587 * g + 0.299 * r;
        out[i] = (1 - kk) * b + kk * L;
        out[i + 1] = (1 - kk) * g + kk * L;
        out[i + 2] = (1 - kk) * r + kk * L;
    }
    return out;
}

export function toFloatBgr(bgr) {
    const n = bgr.length;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = bgr[i];
    return out;
}

 export const HUE_BINS = 18;
 export const HUE_MIN_SAT = 0.40;

 const HUE_MIN_VALID = 8;

export function hueHistogram(bgr, w, h, opts) {
    const o = opts || {};
    const bins = (typeof o.bins === "number" && o.bins > 0) ? o.bins : HUE_BINS;
    const minSat = (typeof o.minSat === "number") ? o.minSat : HUE_MIN_SAT;
    const minValid = (typeof o.minValid === "number") ? o.minValid : HUE_MIN_VALID;
    const bad = function (reason, total) {
        return { ok: false, hist: null, total: (typeof total === "number" ? total : 0), reason: reason };
    };
    if (!bgr || bgr.length !== w * h * 3) return bad("bgr 长度 " + (bgr ? bgr.length : 0) + " ≠ " + w + "*" + h + "*3");
    const hist = new Array(bins).fill(0);
    let total = 0;
    const n = w * h;
    for (let p = 0, i = 0; p < n; p++, i += 3) {
        const b = bgr[i], g = bgr[i + 1], r = bgr[i + 2];
        const mx = (r > g) ? (r > b ? r : b) : (g > b ? g : b);
        const mn = (r < g) ? (r < b ? r : b) : (g < b ? g : b);
        const d = mx - mn;
        if (mx === 0) continue;
        const s = d / mx;
        if (s <= minSat) continue;
        let hue;
        if (mx === r) hue = ((g - b) / d) % 6;
        else if (mx === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
        let bin = Math.floor(hue / 360 * bins);
        if (bin < 0) bin = 0;
        if (bin >= bins) bin = bins - 1;
        hist[bin]++;
        total++;
    }
    if (total < minValid) return bad("饱和像素过少（" + total + " < " + minValid + "）", total);
    const norm = new Array(bins);
    for (let i = 0; i < bins; i++) norm[i] = hist[i] / total;
    return { ok: true, hist: norm, total: total, reason: "" };
}

export function l1(a, b) {
    if (!a || !b || a.length !== b.length) return 2;
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s;
}

 const STAR_STEP = 19.2;

export function starLevel(count) {
    if (typeof count !== "number") return null;
    return Math.round((count - 1) / STAR_STEP);
}
 export const SPARKLE_MIN_HITS = 6;

 const SPARK_DX0 = 19, SPARK_DX1 = 21;

 const SPARK_DY0 = -77, SPARK_DY1 = -75;

export function probeSparkle(bgr, w, h, colL, y0) {
    if (!bgr) return { hit: false, rSum: 0, count: 0, reason: "无数据" };
    let count = 0;
    const pts = [];
    for (let dy = SPARK_DY0; dy <= SPARK_DY1; dy++) {
        const y = y0 + dy;
        if (y < 0 || y >= h) return { hit: false, rSum: 0, count: 0, reason: "y 越界：" + y };
        for (let dx = SPARK_DX0; dx <= SPARK_DX1; dx++) {
            const x = colL + dx;
            if (x < 0 || x >= w) return { hit: false, rSum: 0, count: 0, reason: "x 越界：" + x };
            const r = bgr[(y * w + x) * 3 + 2];
            pts.push(r);
            if (r === 255) count++;
        }
    }
    return { hit: count >= SPARKLE_MIN_HITS, rSum: pts.reduce(function (a, v) { return a + v; }, 0), count: count, reason: "" };
}

export function downBgr(bgr, src, dst) {
    if (!bgr || src === dst) {
        const n = bgr.length;
        const o = new Float32Array(n);
        for (let i = 0; i < n; i++) o[i] = bgr[i];
        return o;
    }
    const step = src / dst;
    const out = new Float32Array(dst * dst * 3);
    for (let by = 0; by < dst; by++) {
        const y0 = Math.floor(by * step);
        const y1 = Math.max(y0 + 1, Math.floor((by + 1) * step));
        for (let bx = 0; bx < dst; bx++) {
            const x0 = Math.floor(bx * step);
            const x1 = Math.max(x0 + 1, Math.floor((bx + 1) * step));
            for (let ch = 0; ch < 3; ch++) {
                let s = 0, c = 0;
                for (let y = y0; y < y1; y++) {
                    const base = (y * src + x0) * 3 + ch;
                    for (let x = x0; x < x1; x++) s += bgr[base + (x - x0) * 3];
                    c += (x1 - x0);
                }
                out[(by * dst + bx) * 3 + ch] = c ? s / c : 0;
            }
        }
    }
    return out;
}
