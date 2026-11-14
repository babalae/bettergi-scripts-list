import {
    ncc, mae, desatBgr, toFloatBgr, satMean, downBgr,
    hueHistogram, l1, probeSparkle
} from "./features.js";
import { FAMILY_TRUST, RISK_FLAG, GARBAGE_MAE_FLOOR } from "./config.js";

 const DESAT_K = 0.50;

 const DESAT_UNCERTAIN_MARGIN = 2.0;

 const DEGRADED_NCC_MARGIN = 0.01;

 const MAE3_UNCERTAIN_MARGIN = 2.0;

const MS_SIZE = 60;

 const MS_OFFSETS = [[0, 0]];

 export const MS_OFFSET_COUNT = MS_OFFSETS.length;

 const SAT_MARGIN_MIN = 0.02;

 const HUE_UNCERTAIN_MARGIN = 0.25;

export function pickThreeVariant(cropBgr, w, h, colL, y0, tplSet, opts) {
    const o = opts || {};
    const res = {
        name: null, method: null, uncertain: false,
        riskFlag: null,   
        sparkle: null, dDesat: null, dDirect: null, margin: null,
        dB: null, note: ""
    };
    const sp = o.sparkleOverride
        ? o.sparkleOverride
        : probeSparkle(cropBgr === null ? null : o.fullBgr, o.fullW, o.fullH, colL, y0);
    res.sparkle = sp;
    if (sp && sp.hit) {
        res.name = tplSet.deli ? tplSet.deli.name : null;
        res.method = "sparkle";
        if (!res.name) { res.uncertain = true; res.note = "亮星命中但族内没有「美味」模板"; }
        return res;
    }
    if (sp && sp.reason) {
        res.uncertain = true;
        res.note = "亮星探针不可用：" + sp.reason;
        return res;
    }
    const r2 = function (v) { return Math.round(v * 100) / 100; };
    const cand3 = [];
    const shifted = (typeof o.shiftFn === "function") ? o.shiftFn : null;
    const rg = o.region || null;
    function cropToRegion(bgr, w, h, reg) {
        if (!reg || !(reg.size > 0)) return bgr;
        const n = reg.size;
        if (reg.down) {
            if (n >= w) return bgr;
            const out = new Uint8Array(n * n * 3);
            const k = w / n;
            for (let y = 0; y < n; y++) {
                const ys = Math.floor(y * k);
                const ye = Math.min(h, Math.ceil((y + 1) * k));
                for (let x = 0; x < n; x++) {
                    const xs = Math.floor(x * k);
                    const xe = Math.min(w, Math.ceil((x + 1) * k));
                    let r = 0, g = 0, b = 0, c = 0;
                    for (let yy = ys; yy < ye; yy++) {
                        let i = (yy * w + xs) * 3;
                        for (let xx = xs; xx < xe; xx++) {
                            b += bgr[i]; g += bgr[i + 1]; r += bgr[i + 2];
                            i += 3; c++;
                        }
                    }
                    if (!c) continue;
                    const o = (y * n + x) * 3;
                    out[o] = (b / c) | 0; out[o + 1] = (g / c) | 0; out[o + 2] = (r / c) | 0;
                }
            }
            return out;
        }
        const ox = reg.x, oy = reg.y;
        if (ox < 0 || oy < 0 || ox + n > w || oy + n > h) return bgr;
        if (n === w && n === h) return bgr;
        const out = new Uint8Array(n * n * 3);
        for (let y = 0; y < n; y++) {
            const src = ((oy + y) * w + ox) * 3;
            const dst = y * n * 3;
            for (let i = 0; i < n * 3; i++) out[dst + i] = bgr[src + i];
        }
        return out;
    }
    if (shifted) {
        const keys = ["odd", "normal"];
        const slots = [];
        for (const k of keys) {
            const t = tplSet[k];
            if (!t || !t.bgr) continue;
        const tplSide = Math.round(Math.sqrt(t.bgr.length / 3));
        if (rg && rg.down && tplSide === rg.size) {
            slots.push({ k: k, name: t.name, F: toFloatBgr(t.bgr) });
        } else if (!rg || rg.down === undefined) {
            slots.push({ k: k, name: t.name, F: toFloatBgr(t.bgr) });
        }
        }
        if (slots.length === 2) {
            const offs = MS_OFFSETS;
            const regSize = (rg && rg.size > 0) ? rg.size : MS_SIZE;
            const want = regSize * regSize * 3;
            let bestSet = null;
            for (let oi = 0; oi < offs.length; oi++) {
                const oc = shifted(offs[oi][0], offs[oi][1]);
                if (!oc || oc.length !== want) continue;
                const of = toFloatBgr(oc);
                const cur = [];
                let minD = Infinity;
                for (let si = 0; si < slots.length; si++) {
                    const d = mae(of, slots[si].F);
                    cur.push({ k: slots[si].k, name: slots[si].name, d: d });
                    if (d < minD) minD = d;
                }
                if (!bestSet || minD < bestSet.minD) {
                    bestSet = { minD: minD, cells: cur, ox: offs[oi][0], oy: offs[oi][1] };
                }
            }
            if (bestSet) {
                for (const c of bestSet.cells) cand3.push(c);
                o.__maeShift = bestSet.ox + "," + bestSet.oy;
            }
        }
    }
    if (!cand3.length) {
        const cropF0 = toFloatBgr(cropBgr);
        for (const k of ["odd", "normal"]) {
            const t = tplSet[k];
            if (t && t.bgr && t.bgr.length === cropBgr.length) {
                cand3.push({ k: k, name: t.name, d: mae(cropF0, toFloatBgr(t.bgr)) });
            }
        }
    }
    if (cand3.length === 2) {
        const sorted3 = cand3.slice().sort(function (a, b) { return a.d - b.d; });
        const margin3 = sorted3[1].d - sorted3[0].d;
        const byK = {};
        for (const c of cand3) byK[c.k] = r2(c.d);
        res.ok = true;
        res.method = "variant-mae2";
        res.name = sorted3[0].name;
        res.dOdd = byK.odd;
        res.dNormal = byK.normal;
        res.margin = r2(margin3);
        res.note = "双模板直比（美味已由亮星判定）：奇怪 " + byK.odd + " / 普通 " + byK.normal +
            "，领先 " + r2(margin3);

        if (RISK_FLAG && RISK_FLAG.enabled) {
            const _minDV = Math.min(byK.odd, byK.normal);
            if (margin3 < RISK_FLAG.M1_MARGIN_BELOW && _minDV > RISK_FLAG.M2_MIN_DIST_ABOVE) {
                res.riskFlag = "both-far";
                res.riskMinD = r2(_minDV);
                res.note += "｜⚠ riskFlag=both-far（margin " + r2(margin3) + " < " +
                    RISK_FLAG.M1_MARGIN_BELOW + " 且 min " + r2(_minDV) + " > " +
                    RISK_FLAG.M2_MIN_DIST_ABOVE + "：双模板都不像，相对差可能是噪声排序）";
            }
        }
        const thr3 = (typeof o.mae3Margin === "number") ? o.mae3Margin : MAE3_UNCERTAIN_MARGIN;
        const allD = [byK.odd, byK.normal];
        const minD = Math.min.apply(null, allD);
        if (minD > GARBAGE_MAE_FLOOR) {
            res.uncertain = true;
            res.garbage = true;
            res.note += "（★废格★ 双模板 MAE 全 > " + GARBAGE_MAE_FLOOR +
                "（最小 " + r2(minD) + "），这格不像族内任何变体，需人工核对）";
            return res;
        }
        if (margin3 < thr3) {
            const sat = satMean(cropBgr);
            const satOdd = satMean(tplSet.odd.bgr);
            const satNor = satMean(tplSet.normal.bgr);
            if (sat !== null && satOdd !== null && satNor !== null) {
                const dOdd = Math.abs(sat - satOdd);
                const dNor = Math.abs(sat - satNor);
                const satMargin = Math.abs(dOdd - dNor);
                const r3 = function (v) { return Math.round(v * 1000) / 1000; };
                res.satCrop = r3(sat);
                res.satOdd = r3(satOdd);
                res.satNormal = r3(satNor);
                res.satMargin = r3(satMargin);
                if (satMargin >= SAT_MARGIN_MIN) {
                    const pickOdd = dOdd < dNor;
                    const picked = pickOdd ? tplSet.odd : tplSet.normal;
                    res.name = picked ? picked.name : null;
                    res.method = "variant-sat";
                    res.uncertain = !res.name;
                    res.note += " ⇒ MAE 打平，改判饱和度：裁片 " + res.satCrop +
                        " / 奇怪 " + res.satOdd + " / 普通 " + res.satNormal +
                        "（到奇怪 " + r3(dOdd) + "，到普通 " + r3(dNor) + "，分离 " + res.satMargin +
                        " ≥ " + SAT_MARGIN_MIN + "）⇒ " + (pickOdd ? "奇怪" : "普通");
                    if (!res.name) res.note += "；族内缺对应变体模板";
                    return res;
                }
                res.note += "（裕度 " + r2(margin3) + " < " + thr3 + "；饱和度也分不开 " +
                    res.satMargin + " < " + SAT_MARGIN_MIN + "，不硬猜）";
                res.uncertain = true;
                return res;
            }
            res.uncertain = true;
            res.note += "（裕度 " + r2(margin3) + " < " + thr3 + "，不硬猜）";
        }
        return res;
    }
    const nor = tplSet.normal, odd = tplSet.odd;
    if (!nor || !nor.bgr) {
        res.uncertain = true;
        res.note = "族内缺「普通」模板，无法做去饱和判定";
        return res;
    }
    const cb = cropBgr.length;
    const cbN = Math.round(Math.sqrt(cb / 3));
    const cropF = toFloatBgr(cropBgr);
    const norRaw = nor.bgr;
    const desRaw = desatBgr(nor.bgr, (typeof o.k === "number") ? o.k : DESAT_K);
    const tplN = Math.round(Math.sqrt(norRaw.length / 3));
    const tplOk = (tplN > 0 && tplN * tplN * 3 === norRaw.length);
    const norF = (norRaw.length === cb) ? (tplSet.__norF || toFloatBgr(norRaw))
        : (tplOk && cbN % tplN === 0 ? downBgr(norRaw, tplN, tplN) : null);
    const desF = (norRaw.length === cb) ? (tplSet.__desF || toFloatBgr(desRaw))
        : (tplOk && cbN % tplN === 0 ? downBgr(desRaw, tplN, tplN) : null);
    if (!norF || !desF) {
        res.uncertain = true;
        res.note = "模板 bgr 尺寸 " + norRaw.length + " 与裁片 " + cb + " 不可整除对齐 ⇒ 不硬猜";
        return res;
    }
    const dDesat = mae(cropF, desF);
    const dDirect = mae(cropF, norF);
    res.dDesat = Math.round(dDesat * 100) / 100;
    res.dDirect = Math.round(dDirect * 100) / 100;
    res.margin = Math.round(Math.abs(dDirect - dDesat) * 100) / 100;
    if (o.compareB) {
        const cropDes = desatBgr(cropBgr, (typeof o.k === "number") ? o.k : DESAT_K);
        res.dB = Math.round(Math.abs(mae(cropDes, norF) - dDirect) * 100) / 100;
    }
    const isOdd = dDesat < dDirect;
    const picked = isOdd ? odd : nor;
    res.name = picked ? picked.name : null;
    res.method = "desat";
    const thr = (typeof o.uncertainMargin === "number") ? o.uncertainMargin : DESAT_UNCERTAIN_MARGIN;
    if (res.margin < thr) {
        res.uncertain = true;
        res.note = "裕度 " + res.margin + " < " + thr + "，不硬猜";
    }
    if (!res.name) { res.uncertain = true; res.note = res.note || "族内缺对应变体模板"; }
    return res;
}

export function pickByHue(cropBgr, w, h, famHists, opts) {
    const o = opts || {};
    const res = { name: null, method: "hue", uncertain: false, bestL1: null, margin: null, ok: false, note: "" };
    const hh = hueHistogram(cropBgr, w, h, o);
    if (!hh.ok) {
        const fb = o.fallback;
        if (fb && fb.cropGray && Array.isArray(fb.famGray) && fb.famGray.length >= 2) {
            const grayCrop = fb.cropGray;
            const scored = [];
            for (const t of fb.famGray) {
                if (!t || !t.gray || t.gray.length !== grayCrop.length) continue;
                scored.push({ name: t.name, s: ncc(grayCrop, t.gray) });
            }
            if (scored.length >= 2) {
                scored.sort(function (a, b) { return b.s - a.s; });
                const marginG = scored[0].s - scored[1].s;
                res.ok = true;
                res.name = scored[0].name;
                res.method = "hue-degraded-gray";
                res.bestL1 = null;
                res.margin = Math.round(marginG * 10000) / 10000;
                res.note = "色相退化（" + hh.reason + "）→ 族内灰度 NCC 取 " +
                    scored[0].name + "（" + scored[0].s.toFixed(4) + "，领先 " +
                    marginG.toFixed(4) + "）";
                const thrG = (typeof o.degradedMargin === "number") ? o.degradedMargin : DEGRADED_NCC_MARGIN;
                if (marginG < thrG) {
                    res.uncertain = true;
                    res.note += "；裕度 " + marginG.toFixed(4) + " < " + thrG + "，不硬猜";
                }
                return res;
            }
        }
        res.note = "色相退化：" + hh.reason + "（族内灰度特征不可用 ⇒ 退回全库）";
        res.uncertain = true;
        return res;
    }
    const scored = [];
    for (const t of famHists) {
        if (!t || !Array.isArray(t.hist)) continue;
        scored.push({ name: t.name, d: l1(hh.hist, t.hist) });
    }
    if (!scored.length) { res.note = "族内没有可用色相特征"; res.uncertain = true; return res; }
    scored.sort(function (a, b) { return a.d - b.d; });
    res.ok = true;
    res.name = scored[0].name;
    res.bestL1 = Math.round(scored[0].d * 1000) / 1000;
    res.margin = (scored.length > 1) ? Math.round((scored[1].d - scored[0].d) * 1000) / 1000 : null;
    const thr = (typeof o.uncertainMargin === "number") ? o.uncertainMargin : HUE_UNCERTAIN_MARGIN;
    if (res.margin !== null && res.margin < thr) {
        const secondD = (scored.length > 1) ? scored[1].d : null;
        const bestD = scored[0].d;
        const ft = FAMILY_TRUST || {};
        const relFloor = (typeof ft.HUE_REL_FLOOR === "number") ? ft.HUE_REL_FLOOR : 0.15;
        const relRatio = (typeof ft.HUE_REL_RATIO === "number") ? ft.HUE_REL_RATIO : 2.0;
        const trustOn = (ft.enabled !== false);
        const ratioOk = (secondD !== null) && (bestD <= 1e-9 || (secondD / bestD) > relRatio);
        const smallEnough = bestD < relFloor;
        const confident = trustOn && secondD !== null && smallEnough && ratioOk;
        if (!confident) {
            res.uncertain = true;
            res.note = "色相裕度 " + res.margin + " < " + thr + "（" +
                scored[0].name + " " + res.bestL1 +
                " / " + scored[1].name + " " + Math.round(scored[1].d * 1000) / 1000 + "）";
        } else {
            const r4 = function (v) { return Math.round(v * 10000) / 10000; };
            res.highConfidence = true;
            res.relRatio = r4(secondD / bestD);
            res.bestL1Raw = r4(bestD);
            res.note = "色相裕度 " + res.margin + " < " + thr + "，但相对裕度达标：" +
                scored[0].name + " " + r4(bestD) + "（< " + relFloor + "）领先 " +
                scored[1].name + " " + r4(secondD) + " 达 " + res.relRatio + "×（> " + relRatio + "）⇒ 采信";
        }
    }
    return res;
}

export function decideTwin(fam, ocrText) {
    const res = { name: null, method: "detail", ocrRaw: (ocrText === undefined || ocrText === null) ? "" : String(ocrText), rule: "", uncertain: false, note: "" };
    if (!fam || !fam.detail) { res.uncertain = true; res.note = "族缺详情规则"; return res; }
    const dt = fam.detail;
    const txt = res.ocrRaw.replace(/\s+/g, "");
    res.rule = dt.mode;
    if (dt.mode === "contains") {
        const hit = dt.keyword && txt.indexOf(dt.keyword) >= 0;
        res.name = hit ? dt.positive : dt.negative;
        if (!txt) {
            res.uncertain = true;
            res.note = "OCR 空结果 —— 按反向落到「" + dt.negative + "」，需人工复核";
        }
        return res;
    }
    if (dt.mode === "containsAny") {
        const kws = Array.isArray(dt.keyword) ? dt.keyword : (dt.keyword ? [dt.keyword] : []);
        let hitKw = null;
        for (const k of kws) {
            if (k && txt.indexOf(String(k)) >= 0) { hitKw = String(k); break; }
        }
        res.name = hitKw ? dt.positive : dt.negative;
        if (!txt) {
            res.uncertain = true;
            res.note = "OCR 空结果 —— 按反向落到「" + dt.negative + "」，需人工复核";
        } else {
            res.note = "详情 OCR「" + txt + "」" + (hitKw ? "含「" + hitKw + "」" : "不含关键词") +
                " ⇒ " + res.name;
        }
        return res;
    }
    if (dt.mode === "notEqual") {
        const equal = dt.keyword && txt === dt.keyword;
        res.name = equal ? dt.negative : dt.positive;
        if (!txt) {
            res.uncertain = true;
            res.note = "OCR 空结果 ⇒ 反向判据落到「" + dt.positive + "」（已知缺陷，v5 §7.2）";
        }
        return res;
    }
    res.uncertain = true;
    res.note = "未知详情判据：" + dt.mode;
    return res;
}

export function pickByMae6(variants, crop, byName, maeRegion) {
    if (!variants || !crop || !byName) return null;
    const M = maeRegion || {};
    const n = (M.mode === "down" && M.size > 0) ? M.size : 6;
    const want = n * n * 3;
    if (crop.length !== want) return null;   

    const cands = [];
    for (let i = 0; i < variants.length; i++) {
        const e = byName.get(variants[i]);
        if (e && e.bgr) cands.push({ name: variants[i], bgr: e.bgr });
    }
    if (cands.length < 2) return null;

    const q = toFloatBgr(crop);
    let best = null, bestD = Infinity, secondD = Infinity;
    for (let i = 0; i < cands.length; i++) {
        const t = cands[i];
        const raw = bgrDecoded(t.bgr);
        if (!raw) return null;
        const srcN = Math.round(Math.sqrt(raw.length / 3));
        const tb = (srcN > 0 && srcN * srcN * 3 === raw.length) ? downSampleBgr(raw, srcN, n) : null;
        if (!tb || tb.length !== want) return null;
        const d = mae(q, toFloatBgr(tb));
        if (d < bestD) { secondD = bestD; bestD = d; best = t.name; }
        else if (d < secondD) { secondD = d; }
    }
    if (!best) return null;

    const r2 = function (v) { return Math.round(v * 100) / 100; };
    const margin = (secondD === Infinity) ? null : (secondD - bestD);
    return {
        method: "mae6",
        name: best,
        uncertain: false,
        dBest: r2(bestD),
        dSecond: (secondD === Infinity) ? null : r2(secondD),
        margin: (margin === null) ? null : r2(margin),
        note: "同形族 6×6 MAE 裁决（替代色相）：最近 " + r2(bestD) +
            (margin === null ? "" : "，领先 " + r2(margin))
    };
}

function bgrOf(v) {
    if (!v) return null;
    if (typeof v === "string") return b64ToBytes(v);
    if (v instanceof Uint8Array) return v;
    if (v && typeof v.length === "number") return v;
    return null;
}

const _B64_LUT = (function () {
    const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const m = new Int16Array(128).fill(-1);
    for (let i = 0; i < s.length; i++) m[s.charCodeAt(i)] = i;
    return m;
})();

function b64ToBytes(str) {
    const n = str.length;
    if (n === 0) return null;
    let pad = 0;
    if (str.charCodeAt(n - 1) === 61) pad++;
    if (n > 1 && str.charCodeAt(n - 2) === 61) pad++;
    const outLen = ((n >> 2) * 3) - pad;
    if (outLen <= 0) return null;
    const out = new Uint8Array(outLen);
    let o = 0;
    for (let i = 0; i < n; i += 4) {
        const c0 = _B64_LUT[str.charCodeAt(i)] | 0;
        const c1 = _B64_LUT[str.charCodeAt(i + 1)] | 0;
        const c2 = (i + 2 < n) ? (_B64_LUT[str.charCodeAt(i + 2)] | 0) : -1;
        const c3 = (i + 3 < n) ? (_B64_LUT[str.charCodeAt(i + 3)] | 0) : -1;
        if (c0 < 0 || c1 < 0) break;
        out[o++] = ((c0 << 2) | (c1 >> 4)) & 0xFF;
        if (c2 >= 0 && o < outLen) out[o++] = ((c1 << 4) | (c2 >> 2)) & 0xFF;
        if (c3 >= 0 && o < outLen) out[o++] = ((c2 << 6) | c3) & 0xFF;
    }
    return (o === outLen) ? out : null;
}

const _BGR_CACHE = new Map();

function bgrDecoded(v) {
    if (!v) return null;
    if (typeof v !== "string") return bgrOf(v);
    const hit = _BGR_CACHE.get(v);
    if (hit) return hit;
    const b = b64ToBytes(v);
    if (b) _BGR_CACHE.set(v, b);
    return b;
}

function downSampleBgr(bgr, srcN, n) {
    if (!bgr || bgr.length !== srcN * srcN * 3) return null;
    if (n === srcN) return bgr;
    if (srcN % n !== 0) return null;         
    const out = new Uint8Array(n * n * 3);
    const k = srcN / n;
    for (let y = 0; y < n; y++) {
        const ys = y * k, ye = ys + k;
        for (let x = 0; x < n; x++) {
            const xs = x * k, xe = xs + k;
            let b = 0, g = 0, r = 0, c = 0;
            for (let yy = ys; yy < ye; yy++) {
                let i = (yy * srcN + xs) * 3;
                for (let xx = xs; xx < xe; xx++) {
                    b += bgr[i]; g += bgr[i + 1]; r += bgr[i + 2];
                    i += 3; c++;
                }
            }
            const o = (y * n + x) * 3;
            out[o] = (b / c) | 0;
            out[o + 1] = (g / c) | 0;
            out[o + 2] = (r / c) | 0;
        }
    }
    return out;
}
