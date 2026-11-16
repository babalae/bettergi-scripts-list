import { SPECIAL } from "./config.js";
import { parseFeatures } from "./templates.js";
import {
    srcMatOf, disposeRegion,
    readText, readMatBgr, cropBase, loadMat, makeTemplateRo, hostGrayArea30,
    findAll, setRoThreshold, disposeRo
} from "./util.js";
import { rowOccupancy } from "./cells.js";
import { cellRects } from "./recognize.js";
import { ncc } from "./features.js";
import { readCount } from "./digits.js";
import { thumbState, thumbHoverState } from "./slider.js";

export const SPECIAL_TABS = ["武器", "圣遗物", "贵重道具"];

export const TAB_ALIAS = {
    "锻造矿": "武器",
    "狗粮经验": "圣遗物",
    "抽卡资源&摩拉": "贵重道具"
};

export function specialTabOf(name) {
    if (SPECIAL_TABS.indexOf(name) >= 0) return name;
    return Object.prototype.hasOwnProperty.call(TAB_ALIAS, name) ? TAB_ALIAS[name] : null;
}

export function isSpecialTab(name) { return specialTabOf(name) !== null; }

export function listSpecialAliases() { return Object.keys(TAB_ALIAS); }

let featCache = null;

export function loadSpecialFeatures() {
    if (featCache) return featCache;
    const out = { ok: false, byTab: {}, meta: null, problems: [] };
    const text = readText(SPECIAL.featurePath);
    if (!text) {
        out.problems.push("特殊物品特征读取失败：" + SPECIAL.featurePath);
        featCache = out;
        return out;
    }
    const f = parseFeatures(text, { featSize: SPECIAL.featSize });
    if (!f.ok) {
        for (const p of f.problems.slice(0, 5)) out.problems.push("特殊物品特征：" + p);
        featCache = out;
        return out;
    }
    for (const tab of SPECIAL_TABS) {
        const arr = f.byTab[tab];
        if (!arr || !arr.length) { out.problems.push("特殊物品特征里没有页签 " + tab); continue; }
        out.byTab[tab] = arr;
    }
    out.meta = f.meta;
    out.ok = (out.problems.length === 0);
    featCache = out;
    return out;
}

function quantDown(bgr, w, h, n) {
    const out = new Uint8Array(n * n);
    const cw = w / n, ch = h / n;
    for (let by = 0; by < n; by++) {
        const y0 = Math.floor(by * ch), y1 = Math.max(y0 + 1, Math.floor((by + 1) * ch));
        for (let bx = 0; bx < n; bx++) {
            const x0 = Math.floor(bx * cw), x1 = Math.max(x0 + 1, Math.floor((bx + 1) * cw));
            let s = 0, c = 0;
            for (let y = y0; y < y1; y++) {
                const base = y * w;
                for (let x = x0; x < x1; x++) {
                    const i = (base + x) * 3;
                    s += 0.114 * bgr[i] + 0.587 * bgr[i + 1] + 0.299 * bgr[i + 2];
                    c++;
                }
            }
            out[by * n + bx] = c ? Math.max(0, Math.min(255, Math.round(s / c))) : 0;
        }
    }
    return out;
}

function hueHist(bgr, w, h) {
    const bins = 18;
    const hist = new Array(bins).fill(0);
    let total = 0;
    for (let p = 0, i = 0; p < w * h; p++, i += 3) {
        const b = bgr[i], g = bgr[i + 1], r = bgr[i + 2];
        const mx = (r > g) ? (r > b ? r : b) : (g > b ? g : b);
        const mn = (r < g) ? (r < b ? r : b) : (g < b ? g : b);
        const d = mx - mn;
        if (mx === 0) continue;
        if ((d / mx) <= 0.20) continue;
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
    if (!total) return null;
    for (let i = 0; i < bins; i++) hist[i] /= total;
    return hist;
}

function l1(a, b) {
    if (!a || !b) return 2;
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s;
}

function r3(v) { return Math.round(v * 1000) / 1000; }

export function matchCell(cropBgr, w, h, tpls, opts) {
    const o = opts || {};
    const out = { name: null, score: null, margin: null, method: "", note: "" };
    if (!cropBgr || !tpls || !tpls.length) { out.note = "无模板"; return out; }

    const g = o.isGray ? cropBgr : quantDown(cropBgr, w, h, SPECIAL.featSize);
    const scored = [];
    for (const t of tpls) {
        if (!t || !t.gray || t.gray.length !== g.length) continue;
        scored.push({ name: t.name, s: ncc(g, t.gray), hist: t.hist });
    }
    if (!scored.length) { out.note = "模板长度不符"; return out; }
    scored.sort(function (a, b) { return b.s - a.s; });
    const best = scored[0];
    out.score = Math.round(best.s * 10000) / 10000;
    out.margin = (scored.length > 1) ? Math.round((best.s - scored[1].s) * 10000) / 10000 : null;
    if (best.s < SPECIAL.minScore) {
        out.method = "below-threshold";
        out.note = "最高分 " + out.score + " < " + SPECIAL.minScore + " ⇒ 非目标物品";
        return out;
    }
    if (scored.length > 1 && (best.s - scored[1].s) < SPECIAL.tieMargin) {
        const second = scored[1];
        let bgrForHue = cropBgr;
        if (o.isGray) {
            if (typeof o.getBgr === "function") {
                try { bgrForHue = o.getBgr(); } catch (e) { bgrForHue = null; }
            } else {
                bgrForHue = null;
            }
        }
        const hc = bgrForHue ? hueHist(bgrForHue, w, h) : null;
        if (hc && best.hist && second.hist) {
            const d1 = l1(hc, best.hist);
            const d2 = l1(hc, second.hist);
            if (Math.abs(d2 - d1) >= SPECIAL.tieHueL1) {
                const pick = (d1 < d2) ? best : second;
                out.name = pick.name;
                out.method = "hue-tiebreak";
                out.note = "NCC 打平（" + r3(best.s) + " / " + r3(second.s) + "）⇒ 色相判 " +
                    pick.name + "（L1 " + r3(d1) + " vs " + r3(d2) + "）";
                return out;
            }
            out.method = "tie-uncertain";
            out.note = "NCC 打平且色相也分不开（" + r3(best.s) + "/" + r3(second.s) +
                "，L1 差 " + r3(Math.abs(d2 - d1)) + " < " + SPECIAL.tieHueL1 + "）⇒ 不硬猜";
            return out;
        }
        out.method = "tie-no-hue";
        out.note = "NCC 打平（" + r3(best.s) + "/" + r3(second.s) + "）且无可用色相特征 ⇒ 不硬猜";
        return out;
    }
    out.name = best.name;
    out.method = "ncc";
    out.note = "NCC " + out.score + (out.margin === null ? "" : "（领先 " + out.margin + "）");
    return out;
}

function delayMs(ms) {
    if (!(ms > 0)) return;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {  }
}

async function pressAndDrag() {
    const D = SPECIAL.drag;
    if (typeof moveMouseTo !== "function" || typeof leftButtonDown !== "function" ||
        typeof leftButtonUp !== "function") {
        return { ok: false, reason: "宿主缺少 moveMouseTo/leftButtonDown/leftButtonUp" };
    }

    const steps = Array.isArray(D.steps) ? D.steps : [{ dy: 10 }, { dy: 10 }];
    let y = D.startY;
    try {
        moveMouseTo(D.x, y);
        if (D.hoverDelayMs > 0) await sleep(D.hoverDelayMs);
        leftButtonDown();
        if (D.pressDelayMs > 0) await sleep(D.pressDelayMs);
        try {
            for (let i = 0; i < steps.length; i++) {
                const dy = (steps[i] && typeof steps[i].dy === "number") ? steps[i].dy : 10;
                y += dy;
                moveMouseTo(D.x, y);
                if (i < steps.length - 1) delayMs(D.stepGapMs);
            }
        } finally {
            leftButtonUp();
        }
        delayMs(D.settleMs);
        return { ok: true, reason: "", fromY: D.startY, toY: y, steps: steps.length };
    } catch (e) {
        return { ok: false, reason: (e && e.message) ? e.message : String(e) };
    }
}

export async function dragToBottom(tab) {
    const D = SPECIAL.drag;
    const traces = [];
    if (D.preCheckDelayMs > 0) await sleep(D.preCheckDelayMs);
    const first = await thumbState({ band: "top", tab: tab });
    if (first.state === "UNKNOWN") {
        return { ok: false, needDrag: null, reason: "顶部区把手读数不可用（" +
            ((first.evidence && first.evidence.reason) || "未知") + "）", attempted: 0, traces: traces };
    }
    traces.push({
        phase: "pre", state: first.state, hasThumb: first.hasThumb,
        hit: first.evidence.hit, total: first.evidence.total, minHit: first.evidence.minHit
    });
    if (!first.hasThumb) {
        return { ok: true, needDrag: false, attempted: 0, atBottom: false, via: first.state, traces: traces };
    }
    let lastHover = null;
    for (let attempt = 0; attempt <= D.verifyRetry; attempt++) {
        const pr = await pressAndDrag();
        if (!pr.ok) {
            return { ok: false, needDrag: true, reason: "拖拽输入失败：" + pr.reason,
                attempted: attempt + 1, traces: traces };
        }
        const hv = await thumbHoverState();
        lastHover = hv;
        traces.push({
            phase: "drag", attempt: attempt + 1, hit: hv.hit, total: hv.total,
            hasThumb: hv.hasThumb, reason: hv.reason
        });
        if (hv.hasThumb) {
            return { ok: true, needDrag: true, attempted: attempt + 1, atBottom: true,
                via: "hover", traces: traces };
        }
    }
    return {
        ok: false, needDrag: true, attempted: D.verifyRetry + 1,
        reason: "连续 " + (D.verifyRetry + 1) + " 次拖拽后底部区仍无悬停把手（" +
            (lastHover ? lastHover.hit + "/" + lastHover.total : "?") +
            " 命中，需 " + (lastHover ? lastHover.total : "?") + "）⇒ 疑似单次拖拽幅度不足",
        via: "hover", traces: traces
    };
}

let currencyMats = null;

function loadCurrencyDigits() {
    if (currencyMats) return currencyMats;
    const arr = [];
    const miss = [];
    for (let d = 0; d <= 9; d++) {
        const m = loadMat(SPECIAL.currency.digitDir + "/" + d + ".png");
        if (!m) { miss.push(d); continue; }
        arr.push({ digit: d, mat: m });
    }
    currencyMats = { ok: miss.length === 0, mats: arr, missing: miss };
    return currencyMats;
}

let plusMat = null;

function loadPlusTemplate() {
    if (plusMat !== null) return plusMat;
    plusMat = loadMat(SPECIAL.currency.plusTpl) || false;
    return plusMat;
}

export function findPlusAnchor(frame) {
    const out = { ok: false, x: 0, y: 0, score: null, reason: "" };
    const C = SPECIAL.currency;
    const tpl = loadPlusTemplate();
    if (!tpl) { out.reason = "原石加号模板缺失：" + C.plusTpl; return out; }
    const R = C.searchRect;
    const thr = (typeof C.plusThreshold === "number") ? C.plusThreshold : 0.85;
    let ro = null;
    try {
        ro = makeTemplateRo(tpl, R.x, R.y, R.w, R.h, thr);
        if (!ro) { out.reason = "无法构造加号识别对象"; return out; }
        setRoThreshold(ro, thr);
        const hits = findAll(frame, ro);
        if (!hits.length) { out.reason = "搜索区内未见原石加号（阈值 " + thr + "）"; return out; }
        let best = null;
        for (const h of hits) {
            if (h.score !== null && h.score < thr) continue;
            if (!best || (h.score !== null && (best.score === null || h.score > best.score))) best = h;
        }
        if (!best) { out.reason = "加号候选均低于阈值 " + thr; return out; }
        out.ok = true;
        out.x = best.x;
        out.y = best.y;
        out.score = best.score;
        return out;
    } catch (e) {
        out.reason = "加号匹配异常：" + ((e && e.message) ? e.message : e);
        return out;
    } finally {
        if (ro) disposeRo(ro);
    }
}

export function decodeDigits(frame, rect, digitMats, opts) {
    const o = opts || {};
    const thr = (typeof o.threshold === "number") ? o.threshold : SPECIAL.currency.threshold;
    const maxGap = (typeof o.maxGapPx === "number") ? o.maxGapPx : SPECIAL.currency.maxGapPx;
    const out = { ok: false, value: null, text: "", digits: [], reason: "" };
    if (!frame || !rect) { out.reason = "传参为空"; return out; }
    if (!digitMats || !digitMats.length) { out.reason = "无数字模板"; return out; }
    const cands = [];
    for (const m of digitMats) {
        if (!m || !m.mat) continue;
        let ro = null;
        try {
            ro = makeTemplateRo(m.mat, rect.x, rect.y, rect.w, rect.h, thr);
            if (!ro) continue;
            setRoThreshold(ro, thr);
            const hits = findAll(frame, ro);
            for (const h of hits) {
                if (h.score !== null && h.score < thr) continue;
                cands.push({ d: m.digit, x: h.x, y: h.y, w: h.w, h: h.h, s: h.score });
            }
        } finally {
            if (ro) disposeRo(ro);
        }
    }
    if (!cands.length) { out.reason = "阈值 " + thr + " 下无数字候选"; return out; }
    cands.sort(function (a, b) { return b.s - a.s; });
    const kept = [];
    for (const c of cands) {
        let dup = false;
        for (const k of kept) {
            if (Math.abs(c.x - k.x) < Math.min(c.w, k.w) * 0.5 && Math.abs(c.y - k.y) < 6) { dup = true; break; }
        }
        if (!dup) kept.push(c);
        if (kept.length > 12) break;
    }
    kept.sort(function (a, b) { return a.x - b.x; });
    out.digits = kept.map(function (k) { return k.d; });
    for (let i = 1; i < kept.length; i++) {
        const g = kept[i].x - (kept[i - 1].x + kept[i - 1].w);
        if (g > maxGap) {
            out.reason = "第 " + i + " 位后出现 " + g + "px 断口（> " + maxGap + "）⇒ 不拼接";
            return out;
        }
    }
    let text = "";
    for (const k of kept) text += String(k.d);
    const v = parseInt(text, 10);
    out.text = text;
    out.value = isFinite(v) ? v : null;
    out.ok = out.value !== null;
    if (!out.ok) out.reason = "拼接结果无法转数字：" + text;
    return out;
}

export function readCurrency(frame) {
    const res = { items: [], problems: [], anchor: null };
    if (!SPECIAL.currency.enabled) return res;
    const dm = loadCurrencyDigits();
    if (!dm.ok) {
        res.problems.push("摩拉数字模板缺失：" + dm.missing.join(",") + " ⇒ 原石/摩拉不读取");
        return res;
    }
    const anchor = findPlusAnchor(frame);
    res.anchor = { ok: anchor.ok, x: anchor.x, y: anchor.y, score: anchor.score, reason: anchor.reason };
    if (!anchor.ok) {
        res.problems.push("原石/摩拉定位失败：" + anchor.reason);
        return res;
    }
    const Lx = anchor.x;
    for (const rg of SPECIAL.currency.regions) {
        const x0 = Lx + rg.dx0;
        const x1 = Lx + rg.dx1;
        const rect = { x: x0, y: rg.y, w: x1 - x0 + 1, h: rg.h };
        const r = decodeDigits(frame, rect, dm.mats, {});
        if (r.ok) res.items.push({ name: rg.name, value: r.value, text: r.text, rect: rect });
        else {
            res.problems.push(rg.name + " 读取失败：" + r.reason +
                "（区域 x=" + x0 + "~" + x1 + "）" +
                (r.digits && r.digits.length ? "（已识别 " + r.digits.join("") + "）" : ""));
        }
    }
    return res;
}

function makeRecognize(tab, tpls, stopCtx) {
    return async function recognize(io) {
        const frame = io.frame;
        const mat = io.mat;
        const sz = io.sz;
        const zones = Array.isArray(io.zones) ? io.zones : [];
        const out = { ok: true, cells: [], screen: { plausible: true, meanScore: null, reason: "" } };
        const occRows = zones.map(function (z) {
            const yy = (z && typeof z === "object") ? z.y0 : z;
            if (typeof yy !== "number" || !isFinite(yy)) return null;
            const occ = rowOccupancy(mat, sz, yy);
            let n = 0;
            for (let i = 0; i < occ.length; i++) if (occ[i].occupied) n++;
            return { y0: yy, occ: occ, occupied: n };
        });
        const tailOnly = (tab === "武器" || tab === "圣遗物");
        let wantRows = null;
        if (tailOnly) {
            const used = [];
            for (let i = 0; i < occRows.length; i++) {
                if (occRows[i] && occRows[i].occupied > 0) used.push(i);
            }
            wantRows = new Set(used.slice(Math.max(0, used.length - 2)));
        }
        for (let zi = 0; zi < zones.length; zi++) {
            if (wantRows && !wantRows.has(zi)) continue;
            const y0 = zones[zi].y0;
            if (typeof y0 !== "number" || !isFinite(y0)) continue;
            const rects = io.cellRects(y0);
            const occ = occRows[zi] ? occRows[zi].occ : null;
            for (const R of rects) {
                if (occ && occ[R.col - 1] && occ[R.col - 1].occupied === false) {
                    out.cells.push({
                        screen: io.screenIndex, row: zi, col: R.col, y0: y0,
                        name: null, method: "empty", score: null,
                        count: null, countOk: false, countText: "", countReason: ""
                    });
                    continue;
                }
                let crop = null;
                try {
                    crop = cropBase(frame, { x: R.tpl.x, y: R.tpl.y, w: R.tpl.w, h: R.tpl.h });
                    if (!crop) continue;
                    const _cropMat = srcMatOf(crop);
                    let m = null;
                    let g30 = null;
                    try {
                        g30 = hostGrayArea30(_cropMat, R.tpl.w, R.tpl.h, SPECIAL.featSize);
                    } catch (_e) { g30 = null; }
                    if (g30 && g30.length === SPECIAL.featSize * SPECIAL.featSize) {
                        m = matchCell(g30, R.tpl.w, R.tpl.h, tpls, {
                            isGray: true,
                            getBgr: function () {
                                const rd2 = readMatBgr(_cropMat);
                                return rd2 && rd2.ok ? rd2.bgr : null;
                            }
                        });
                    } else {
                        const rd = readMatBgr(_cropMat);
                        if (!rd.ok) continue;
                        m = matchCell(rd.bgr, R.tpl.w, R.tpl.h, tpls);
                    }
                    if (!m || !m.name) continue;
                    const cnt = io.readCount(frame, R.digit, {});
                    const cell = {
                        screen: io.screenIndex, row: zi, col: R.col, y0: y0,
                        name: m.name,
                        count: (cnt.value === null || cnt.value === undefined) ? null : cnt.value,
                        countOk: (cnt.value !== null) && !cnt.ambiguous,
                        countText: "", countReason: cnt.note || "",
                        score: m.score, margin: m.margin, method: m.method, note: m.note
                    };
                    out.cells.push(cell);
                    if (stopCtx) stopCtx.add(m.name);
                } catch (e) {
                } finally {
                    if (crop) disposeRegion(crop);
                }
            }
        }
        return out;
    };
}

export function makeStopChecker(names) {
    const want = new Set(names);
    return function (pageItems) {
        if (!want.size) return false;
        const have = new Set();
        for (const c of (pageItems || [])) {
            if (c && c.name && want.has(c.name)) have.add(c.name);
            if (have.size === want.size) return true;
        }
        return have.size === want.size;
    };
}

export function buildSpecialScan(tab, names) {
    const feats = loadSpecialFeatures();
    if (!feats.ok) return { ok: false, problems: feats.problems, recognize: null, stopWhen: null };
    const tpls = feats.byTab[tab] || [];
    const stopCtx = new Set();
    return {
        ok: true,
        problems: [],
        tab: tab,
        names: names,
        templates: tpls,
        recognize: makeRecognize(tab, tpls, stopCtx),
        stopWhen: names && names.length ? makeStopChecker(names) : null
    };
}
