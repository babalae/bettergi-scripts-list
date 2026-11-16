import { DIGIT } from "./config.js";
import {
    loadMat, makeTemplateRo, makeOcrRo, findAll, disposeRo
} from "./util.js";

let digitMats = null;

let loadStatus = null;

export function loadDigitTemplates() {
    if (digitMats) return loadStatus;
    digitMats = new Array(10).fill(null);
    const missing = [];
    for (let d = 0; d <= 9; d++) {
        const p = DIGIT.dir + "/" + d + ".png";
        const m = loadMat(p);
        if (!m) { missing.push(d); continue; }
        digitMats[d] = m;
    }
    loadStatus = { ok: missing.length === 0, missing: missing, count: 10 - missing.length };
    return loadStatus;
}

 function overlaps(a, b, maxOverlap) {
    const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return xOverlap > maxOverlap && yOverlap > maxOverlap;
}

 function reduceCandidates(all, opts) {
    const o = opts || {};
    const maxDigits = (typeof o.maxDigits === "number") ? o.maxDigits : DIGIT.maxDigits;
    const overlapPx = (typeof o.nmsOverlapPx === "number") ? o.nmsOverlapPx : DIGIT.nmsOverlapPx;
    const out = { value: null, adopted: [], ambiguous: false, reason: "", digits: "" };
    if (!all || !all.length) { out.reason = "无候选"; return out; }
    const adopted = [], rejected = [];
    for (let c = 0; c < all.length; c++) {
        const cand = all[c];
        let dup = false;
        for (let a = 0; a < adopted.length; a++) {
            if (overlaps(cand, adopted[a], overlapPx)) { dup = true; break; }
        }
        if (dup) rejected.push(cand); else adopted.push(cand);
    }
    for (let r = 0; r < rejected.length && !out.ambiguous; r++) {
        for (let a2 = 0; a2 < adopted.length; a2++) {
            if (overlaps(rejected[r], adopted[a2], overlapPx) &&
                rejected[r].digit !== adopted[a2].digit) {
                out.ambiguous = true;
                break;
            }
        }
    }
    if (adopted.length === 0) { out.reason = "全部被去重"; return out; }
    adopted.sort(function (p, q) { return p.x - q.x; });
    if (adopted.length > maxDigits) {
        out.reason = "切出 " + adopted.length + " 个字符，超过 " + maxDigits + " 位上限";
        return out;
    }
    let value = 0;
    const ds = [];
    for (let j = 0; j < adopted.length; j++) {
        value = value * 10 + adopted[j].digit;
        ds.push(String(adopted[j].digit));
    }
    out.value = value;
    out.digits = ds.join("");
    out.adopted = adopted.map(function (it) { return { d: it.digit, x: it.x, thr: it.thr }; });
    return out;
}

 function matchDigits(frame, roi, opts) {
    const o = opts || {};
    loadDigitTemplates();
    const out = {
        value: null, adopted: [], candidates: 0, ambiguous: false,
        reason: "", thresholds: []
    };
    if (!frame || !roi) { out.reason = "传参为空"; return out; }
    if (!(roi.w >= 6) || !(roi.h >= 8)) { out.reason = "roi 过小（" + roi.w + "×" + roi.h + "）"; return out; }
    if (!(roi.x >= 0) || !(roi.y >= 0)) { out.reason = "roi 坐标非法（" + roi.x + "," + roi.y + "）"; return out; }
    const rounds = Math.max(1, o.rounds || DIGIT.rounds);
    const maxT = (typeof o.maxThreshold === "number") ? o.maxThreshold : DIGIT.maxThreshold;
    const minT = (typeof o.minThreshold === "number") ? o.minThreshold : DIGIT.minThreshold;
    const thrs = [];
    for (let k = 0; k < rounds; k++) {
        thrs.push(maxT - (maxT - minT) * k / Math.max(rounds - 1, 1));
    }
    for (let k = 0; k < thrs.length; k++) out.thresholds.push(Math.round(thrs[k] * 1000) / 1000);
    const lowest = thrs[thrs.length - 1];
    const ros = [];
    for (let d = 0; d <= 9; d++) {
        if (!digitMats[d]) continue;
        const ro = makeTemplateRo(digitMats[d], roi.x, roi.y, roi.w, roi.h, lowest);
        if (ro) ros.push({ digit: d, ro: ro });
    }
    if (ros.length === 0) { out.reason = "没有可用数字模板"; return out; }
    const all = [];
    const perDigit = [];
    try {
        for (let i = 0; i < ros.length; i++) {
            const hits = findAll(frame, ros[i].ro);
            const row = [];
            for (let h = 0; h < hits.length; h++) {
                row.push({
                    digit: ros[i].digit,
                    x: hits[h].x, y: hits[h].y, w: hits[h].w, h: hits[h].h,
                    score: hits[h].score
                });
            }
            perDigit.push(row);
        }
    } finally {
        for (let i = 0; i < ros.length; i++) disposeRo(ros[i].ro);
    }
    for (let k = 0; k < thrs.length; k++) {
        const thr = thrs[k];
        for (let i = 0; i < perDigit.length; i++) {
            const row = perDigit[i];
            for (let h = 0; h < row.length; h++) {
                if (!(row[h].score >= thr)) continue;
                all.push({
                    digit: row[h].digit,
                    x: row[h].x, y: row[h].y, w: row[h].w, h: row[h].h,
                    score: row[h].score,
                    thr: Math.round(thr * 1000) / 1000
                });
            }
        }
    }
    out.candidates = all.length;
    const red = reduceCandidates(all, o);
    out.ambiguous = red.ambiguous;
    out.value = red.value;
    out.adopted = red.adopted;
    out.reason = red.reason;
    return out;
}

 function ocrValue(frame, roi, opts) {
    const o = opts || {};
    const res = { value: null, text: "", raw: [], region: null };
    if (!frame || !roi) return res;
    const thr = (typeof o.ocrThreshold === "number") ? o.ocrThreshold : DIGIT.ocrThreshold;
    const tries = [
        { x: roi.x, y: roi.y, w: roi.w, h: roi.h },
        { x: roi.x + 3, y: roi.y, w: Math.max(10, roi.w - 6), h: roi.h }
    ];
    for (let t = 0; t < tries.length; t++) {
        const r = tries[t];
        const ro = makeOcrRo(r.x, r.y, r.w, r.h, thr);
        if (!ro) continue;
        let hits = [];
        try {
            hits = findAll(frame, ro);
        } catch {
            hits = [];
        } finally {
            disposeRo(ro);
        }
        const counter = {};
        let best = "", bestN = 0;
        for (let i = 0; i < hits.length; i++) {
            const txt = String(hits[i].text === undefined || hits[i].text === null ? "" : hits[i].text).trim();
            if (!txt) continue;
            res.raw.push(txt);
            counter[txt] = (counter[txt] || 0) + 1;
            if (counter[txt] > bestN) { bestN = counter[txt]; best = txt; }
        }
        const digits = best.replace(/[^0-9]/g, "");
        if (digits.length > 0) {
            const v = parseInt(digits, 10);
            if (isFinite(v)) {
                res.value = v;
                res.text = best;
                res.region = r;
                return res;
            }
        }
    }
    return res;
}

export function readCount(frame, roi, opts) {
    const o = opts || {};
    let tpl = null;
    try {
        tpl = matchDigits(frame, roi, o);
    } catch (e) {
        tpl = {
            value: null, reason: "异常：" + ((e && e.message) ? e.message : e),
            candidates: 0, ambiguous: false, adopted: [], thresholds: []
        };
    }
    if (tpl.value !== null && !tpl.ambiguous) {
        return {
            value: tpl.value, via: "digit-template", template: tpl, ocr: null,
            ambiguous: false, candidates: tpl.candidates, note: ""
        };
    }
    let ocr = null;
    try {
        ocr = ocrValue(frame, roi, o);
    } catch (e) {
        ocr = { value: null, text: "", raw: [], error: (e && e.message) ? e.message : String(e) };
    }
    if (ocr && ocr.value !== null) {
        return {
            value: ocr.value, via: "ocr", template: tpl, ocr: ocr,
            ambiguous: false, candidates: tpl.candidates,
            note: (tpl.value !== null)
                ? ("模板歧义 → OCR 复核出 " + ocr.value)
                : ("模板无候选 → OCR 出 " + ocr.value)
        };
    }
    if (tpl.value !== null) {
        return {
            value: tpl.value, via: "digit-template(歧义)", template: tpl, ocr: ocr,
            ambiguous: true, candidates: tpl.candidates,
            note: "多候选歧义且 OCR 未复核成功（" + tpl.reason + "）"
        };
    }
    return {
        value: null, via: null, template: tpl, ocr: ocr,
        ambiguous: false, candidates: tpl.candidates,
        note: "模板与 OCR 均未识别（" + (tpl.reason || "?") + "）"
    };
}
