
import { HOST_CROP, MAE_REGION } from "./config.js";

export const FEATURE_PATH = "assets/背包扫描/名单/模板特征.json";

function b64ToU8(b64) {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const map = new Map();
    for (let i = 0; i < A.length; i++) map.set(A.charAt(i), i);
    let clean = String(b64).replace(/[^A-Za-z0-9+/]/g, "");
    const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let o = 0, acc = 0, bits = 0;
    for (let i = 0; i < clean.length; i++) {
        const v = map.get(clean.charAt(i));
        if (v === undefined) continue;
        acc = (acc << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out[o++] = (acc >> bits) & 0xFF;
        }
    }
    return out.subarray(0, o);
}

export function assertBgrSizeConsistent(meta, hasBgr) {
    if (!hasBgr) {
        return { ok: true, skipped: true, reason: "该特征文件不含 bgr 数据，无需校验" };
    }
    const bgrN = (HOST_CROP && typeof HOST_CROP.bgrN === "number") ? HOST_CROP.bgrN : null;
    const maeSize = (MAE_REGION && typeof MAE_REGION.size === "number") ? MAE_REGION.size : null;
    const fileSize = (meta && typeof meta.bgrSize === "number") ? meta.bgrSize : null;
    const got = { HOST_CROP_bgrN: bgrN, MAE_REGION_size: maeSize, meta_bgrSize: fileSize };
    const vals = [bgrN, maeSize, fileSize];
    const missing = vals.some(function (v) { return v === null; });
    if (missing) {
        throw new Error("[启动断言] bgr 尺寸缺失，无法确认一致性：" + JSON.stringify(got) +
            "。请检查 config.js 的 HOST_CROP.bgrN / MAE_REGION.size 与特征文件 meta.bgrSize。");
    }
    if (!(bgrN === maeSize && maeSize === fileSize)) {
        throw new Error("[启动断言] bgr 尺寸不一致：" + JSON.stringify(got) +
            "。三者必须相等，否则族内 MAE 恒失败（crop 与模板尺寸对不上）" +
            " 或 bgr 全量 null（跨版本混配）。" +
            " 修法：改 config.js 的 HOST_CROP.bgrN 与 MAE_REGION.size，并重新生成特征文件。");
    }
    if (bgrN <= 0 || bgrN * bgrN * 3 > 60 * 60 * 3) {
        throw new Error("[启动断言] bgrN=" + bgrN + " 非法（必须 >0 且不超过源尺寸 60）。");
    }
    return { ok: true, bgrN: bgrN };
}

export function parseFeatures(text, expect) {
    const out = { ok: false, byTab: {}, meta: null, problems: [] };
    let j = null;
    try { j = JSON.parse(text); } catch (e) {
        out.problems.push("特征 JSON 解析失败：" + ((e && e.message) ? e.message : e));
        return out;
    }
    if (!j || !j.meta || !j.tabs) { out.problems.push("特征文件结构不对（缺 meta/tabs）"); return out; }
    out.meta = j.meta;
    let hasBgrData = false;
    try {
        const tabNames = Object.keys(j.tabs);
        outer:
        for (let ti = 0; ti < tabNames.length; ti++) {
            const arr = j.tabs[tabNames[ti]];
            if (!Array.isArray(arr)) continue;
            for (let ri = 0; ri < arr.length; ri++) {
                if (arr[ri] && arr[ri].bgr) { hasBgrData = true; break outer; }
            }
        }
    } catch (e) { hasBgrData = false; }
    try {
        const ar = assertBgrSizeConsistent(j.meta, hasBgrData);
        out.bgrChecked = !ar.skipped;
    } catch (e) {
        out.problems.push((e && e.message) ? e.message : String(e));
        return out;   
    }
    const exp = expect || {};
    if (exp.featSize && j.meta.featSize !== exp.featSize) {
        out.problems.push("特征 featSize=" + j.meta.featSize + " 与期望 " + exp.featSize + " 不符（须重新生成）");
        return out;
    }
    if (exp.hueBins && j.meta.hueBins !== exp.hueBins) {
        out.problems.push("特征 hueBins=" + j.meta.hueBins + " 与期望 " + exp.hueBins + " 不符");
        return out;
    }
    const FS = j.meta.featSize;
    for (const tab of Object.keys(j.tabs)) {
        const arr = [];
        for (const r of j.tabs[tab]) {
            const gray = b64ToU8(r.gray);
            if (gray.length !== FS * FS) {
                out.problems.push(tab + "/" + r.name + " gray 长度 " + gray.length + " ≠ " + (FS * FS));
                continue;
            }
            let bgr = null;
            if (r.bgr) {
                bgr = b64ToU8(r.bgr);
                const bs = (j.meta && typeof j.meta.bgrSize === "number" && j.meta.bgrSize > 0) ? j.meta.bgrSize : 6;
                const expect = bs * bs * 3;
                if (bgr.length !== expect) {
                    out.problems.push(tab + "/" + r.name + " bgr 长度 " + bgr.length + " ≠ " + expect);
                    bgr = null;
                }
            }
            arr.push({
                name: r.name, no: r.no,
                gray: gray, hist: r.hist || null, bgr: bgr,
                bgrSize: (j.meta && typeof j.meta.bgrSize === "number") ? j.meta.bgrSize : 6,
                featSize: FS
            });
        }
        arr.sort(function (a, b) { return a.no - b.no; });
        out.byTab[tab] = arr;
    }
    out.ok = (out.problems.length === 0);
    return out;
}
