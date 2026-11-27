import { GRID, PAGER, CELLS, TWIN, SPECIAL, FILTER } from "./config.js";
import {
    capture, srcMatOf, matSize, disposeRegion, checkResolution,
    initPixelReader, pixelReady, isCancelled, writeText,
    settingBool, settingList, settingText,
    readText, readMatBgr, px, cropBase, ocrText,
    bulkStatsSnapshot, toBytesStatsSnapshot,
    hostCropStats, hostCropReset, DIAG
} from "./util.js";
import { openBagAndSwitchTab, listTabs, RESULT } from "./bag-open.js";
import { scrollRowsVerified, prepareScrollTarget } from "./pager.js";
import { thumbState } from "./slider.js";
import { findZones, findZonesSettled, rowOccupancy } from "./cells.js";
import { parseRoster, buildIndex, ROSTER_PATH } from "./roster.js";
import { applyOwnedFilter, twinClickSet, parseOwnedSetting } from "./roster-filter.js";

const RETIRED_PATH = "assets/背包扫描/名单/绝版料理.json";
import { parseFeatures, FEATURE_PATH } from "./templates.js";
import { recognizeScreen } from "./recognize.js";
import { loadDigitTemplates, readCount } from "./digits.js";
import { decideTwin } from "./identify.js";
import { cellRects } from "./recognize.js";
import { buildOutput, buildApiOutput, buildTextReport, buildHistoryEntry, mergeHistory, formatLocalTime } from "./goodout.js";
import { makeRunDir, makeDebugDir, makeJsonlWriter, savePageShot, resultFile, historyFile, setAccount } from "./out.js";
import { isSpecialTab, specialTabOf, listSpecialAliases, loadSpecialFeatures, buildSpecialScan, dragToBottom, readCurrency, SPECIAL_TABS } from "./special.js";

async function waitForCellsSettled(opts) {
    const res = await findZonesSettled(sampleZonesOnce, opts || {});
    return res;
}

function sampleZonesOnce() {
    let frame = null;
    try {
        frame = capture();
        const mat = srcMatOf(frame);
        const sz = matSize(mat);
        if (!pixelReady()) initPixelReader(mat);
        const zones = findZones(mat, sz);
        return { zones: zones, sz: sz };
    } finally {
        disposeRegion(frame);
    }
}

const SCAN_PAGES = ["养成道具", "食物", "材料"];
const VALID_PAGES = SCAN_PAGES.concat(listSpecialAliases(), SPECIAL_TABS);

function logError(text) {
    try {
        if (typeof log !== "undefined" && log && typeof log.Error === "function") log.Error(text);
    } catch (e) { }
}

function snapshotIdent(ctx) {
    if (!ctx || !ctx.ok) return null;
    const f = ctx.stats ? ctx.stats.filter : null;
    if (!f) return null;
    return {
        ownedCount: f.ownedCount,
        removedCount: f.removedCount,
        twinClickCount: f.twinClickCount
    };
}

function emitDiagnostics(title, list, apiMode, problems) {
    const arr = Array.isArray(list) ? list : [];
    for (const x of arr) {
        const line = title + "：" + x;
        if (apiMode) logError(line);
        else problems.push(line);
    }
}

function allRetiredNames() {
    const out = [];
    try {
        const text = readText(RETIRED_PATH);
        if (!text) return out;
        const spec = JSON.parse(text);
        for (const k of ["单件", "三变体族", "孪生变体"]) {
            const arr = spec[k];
            if (!Array.isArray(arr)) continue;
            for (const n of arr) {
                if (typeof n === "string" && n && out.indexOf(n) < 0) out.push(n);
            }
        }
    } catch (e) { }
    return out;
}

export function initIdentify(pages, ownedList) {
    const owned = Array.isArray(ownedList) ? ownedList : [];
    const out = { ok: false, roster: null, index: null, byTab: {}, stats: {}, problems: [],
        filter: null, twinClick: null };
    const text = readText(ROSTER_PATH);
    if (!text) { out.problems.push("名单读取失败：" + ROSTER_PATH); return out; }
    const rs = parseRoster(text);
    if (!rs.ok) {
        for (const p of rs.problems) out.problems.push("名单：" + p);
        return out;
    }
    out.roster = rs;
    out.index = buildIndex(rs);
    const featText = readText(FEATURE_PATH);
    if (!featText) {
        out.problems.push("特征文件读取失败：" + FEATURE_PATH + "（请先跑 node tools/生成模板特征.js）");
        return out;
    }
    const feats = parseFeatures(featText, { featSize: 30, hueBins: 18 });
    if (!feats.ok) {
        for (const p of feats.problems.slice(0, 5)) out.problems.push("特征：" + p);
        return out;
    }
    for (const tab of pages) {
        const arr = feats.byTab[tab];
        if (!arr || !arr.length) {
            out.problems.push("特征里没有页签 " + tab);
            continue;
        }
        out.byTab[tab] = arr;
        out.stats[tab] = {
            templates: arr.length,
            keptBgr: arr.filter(function (e) { return !!e.bgr; }).length,
            featSize: feats.meta.featSize
        };
    }
    if (Object.keys(out.byTab).length !== pages.length) {
        out.problems.push("有页签的模板特征没加载成功（" + pages.join("、") + "）");
        return out;
    }
    const decoySet = (function () {
        const set = new Set();
        const tv = (rs.food && rs.food.threeVariant) ? rs.food.threeVariant : [];
        for (const fam of tv) {
            const v = fam.variants;
            if (!Array.isArray(v) || v.length < 3) continue;
            set.add(v[0]);
            set.add(v[2]);
        }
        return set;
    })();
    out.isVariantDecoy = function (n) { return decoySet.has(n); };
    out.filter = { removed: [], families: [], problems: [], specLoaded: false };
    let retiredSpec = null;
    try {
        const specText = readText(RETIRED_PATH);
        if (specText) { retiredSpec = JSON.parse(specText); out.filter.specLoaded = true; }
        else out.filter.problems.push("绝版料理清单读取失败（" + RETIRED_PATH + "）—— 将不剔除任何物品");
    } catch (e) {
        out.filter.problems.push("绝版料理清单解析失败：" + ((e && e.message) ? e.message : e) + " —— 将不剔除任何物品");
    }
    if (retiredSpec) {
        const ps = parseOwnedSetting(owned, retiredSpec);
        for (const p of ps.problems) out.filter.problems.push(p);
        for (const tab of pages) {
            const f = applyOwnedFilter(out.byTab[tab], rs, ps.owned, retiredSpec, tab);
            out.byTab[tab] = f.templates;
            for (const n of f.removed) out.filter.removed.push(tab + "/" + n);
            for (const fam of f.families) out.filter.families.push(fam);
            for (const p of f.problems) out.filter.problems.push(tab + "：" + p);
        }
        out.twinClick = twinClickSet(rs, ps.owned, retiredSpec);
    } else {
        out.twinClick = null;
    }
    const seenFam = new Set();
    out.filter.families = out.filter.families.filter(function (f) {
        if (seenFam.has(f.kind + "|" + f.base)) return false;
        seenFam.add(f.kind + "|" + f.base); return true;
    });
    out.stats.filter = {
        ownedCount: owned.length,
        removedCount: out.filter.removed.length,
        twinClickCount: out.twinClick === null ? -1 : out.twinClick.size
    };
    out.featureMeta = { total: feats.meta.total, withBgr: feats.meta.withBgr, sizeMB: Math.round(featText.length / 1048576 * 100) / 100 };
    const ds = loadDigitTemplates();
    if (!ds || !ds.ok) {
        out.problems.push("数字模板缺失（" + (ds ? ds.missing.join(",") : "?") +
            "）—— 数量识别不可靠");
        return out;
    }
    out.digitStatus = ds;
    out.ok = (out.problems.length === 0);
    return out;
}

function preflightResolution() {
    let frame = null;
    try {
        frame = capture();
        const chk = checkResolution(frame);
        if (!chk.ok) return { ok: false, msg: chk.msg || "无法读取画面尺寸" };
        if (!chk.matched) logError(chk.msg);
        const mat = srcMatOf(frame);
        if (!mat) return { ok: false, msg: "无 SrcMat" };
        if (!pixelReady()) {
            const pr = initPixelReader(mat);
            if (!pr.ok) return { ok: false, msg: "取色 API 全部不可用：" + pr.report.join(" ") };
        }
        return { ok: true, w: chk.w, h: chk.h, matched: chk.matched };
    } catch (e) {
        return { ok: false, msg: "预检异常：" + (e && e.message ? e.message : e) };
    } finally {
        disposeRegion(frame);
    }
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        let cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[n];
}

function pickNearestVariant(text, variants) {
    const res = { name: null, rule: "levenshtein", uncertain: false, note: "" };
    const txt = String(text === undefined || text === null ? "" : text).replace(/\s+/g, "");
    if (!txt) { res.uncertain = true; res.note = "OCR 空结果，无法判定孪生"; return res; }
    const scored = variants.map(function (v) { return { v: v, d: levenshtein(txt, v) }; });
    scored.sort(function (x, y) { return x.d - y.d; });
    const best = scored[0], second = scored[1];
    if (!best) { res.uncertain = true; res.note = "族内无变体"; return res; }
    if (second && second.d - best.d <= 1) {
        res.uncertain = true;
        res.note = "孪生判定打平（" + best.v + "=" + best.d + " / " + second.v + "=" + second.d + "），不硬猜";
        return res;
    }
    res.name = best.v;
    res.note = "详情 OCR「" + txt + "」最近 ⇒ " + best.v + "（距离 " + best.d + "）";
    return res;
}

const FOREIGN_LCS_RATIO = 0.25;

function lcsLen(a, b) {
    const m = a.length, n = b.length;
    if (!m || !n) return 0;
    let prev = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
        const cur = new Array(n + 1).fill(0);
        for (let j = 1; j <= n; j++) {
            cur[j] = (a[i - 1] === b[j - 1])
                ? prev[j - 1] + 1
                : Math.max(prev[j], cur[j - 1]);
        }
        prev = cur;
    }
    return prev[n];
}

function normText(t) {
    return String(t === undefined || t === null ? "" : t)
        .replace(/\s+/g, "")
        .replace(/[「」『』·・.。,，:：;；!！?？'"()（）\[\]]/g, "");
}

function ratioTo(txt, name) {
    const a = normText(txt), b = normText(name);
    if (!a || !b) return 0;
    return lcsLen(a, b) / Math.max(1, Math.min(a.length, b.length));
}

export function ocrOkButForeign(text, second, detail) {
    const txt = normText(text);
    if (!txt) return false;
    if (!second) return false;
    const names = [];
    if (Array.isArray(second.variants)) {
        for (const v of second.variants) if (v) names.push(v);
    }
    if (second.provisional) names.push(second.provisional);
    if (second.family) names.push(second.family);
    if (!names.length) return false;

    const isDescribe = !!(detail && (detail.mode === "contains" || detail.mode === "containsAny"));

    if (!isDescribe) {
        let best = 0;
        for (const nm of names) { const r = ratioTo(txt, nm); if (r > best) best = r; }
        return best < FOREIGN_LCS_RATIO;
    }

    if (!/[·・]/.test(String(text))) return false;
    const pos = detail && detail.positive ? [detail.positive] : [];
    const neg = detail && detail.negative ? [detail.negative] : [];
    let best = 0;
    for (const nm of pos.concat(neg)) { const r = ratioTo(txt, nm); if (r > best) best = r; }
    return best < FOREIGN_LCS_RATIO;
}

async function resolveTwins(cells, stats) {
    if (!TWIN.enabled) return;
    const pending = cells.filter(function (c) {
        return c.stage2 && c.stage2.needsClick && !c.stage2.regionReady;
    });
    if (pending.length) {
        stats.twinRegionPending = (stats.twinRegionPending || 0) + pending.length;
        stats.notes.push(pending.length + " 格孪生待判定，但名单里这些孪生族的详情区域缺失或为全零" +
            "（孪生族的详情区域本应都已填好，请检查 assets/背包扫描/名单/变体族.json 的「详情.区域」）⇒ 已跳过点击");
    }
    const todo = cells.filter(function (c) {
        return c.stage2 && c.stage2.needsClick && c.stage2.regionReady;
    });
    if (!todo.length) return;
    let lastClickCol = null;
    for (const c of todo) {
        if (isCancelled()) { stats.notes.push("孪生点击被取消"); break; }
        const colDef = CELLS.columns[c.col - 1];
        const cx = Math.round((colDef.l + colDef.r) / 2);
        const cy = Math.round(c.y0 - CELLS.tplBottomUp - CELLS.tplSize / 2);
        let frame = null;
        try {
            click(cx, cy);
            lastClickCol = c.col;
            await sleep(TWIN.clickSettleMs);
            frame = capture();
            const dt = c.stage2.detail;
            const ocr = ocrText(frame, { x: dt.x, y: dt.y, w: dt.w, h: dt.h }, TWIN.ocrThreshold);
            c.stage2.ocrRaw = ocr.text;
            const vars = (c.stage2.variants && c.stage2.variants.length >= 2) ? c.stage2.variants : null;
            let r2 = null;
            if (ocrOkButForeign(ocr.text, c.stage2, dt)) {
                c.name = null;
                c.method = "detail-foreign";
                c.uncertain = true;
                c.note = "详情 OCR「" + ocr.text + "」与本族「" +
                    ((c.stage2.family || "?") ) + "」的任何变体名都不相似 ⇒ " +
                    "判定不采信（这一格很可能不是本族物品）";
                stats.notes.push("r" + c.row + "c" + c.col +
                    " 详情 OCR 与族内改名都不像，已按未识别处理：" + ocr.text);
                stats.twinRejected = (stats.twinRejected || 0) + 1;
                continue;
            }
            const isDescribeRule = dt && (dt.mode === "contains" || dt.mode === "containsAny");
            if (isDescribeRule) {
                r2 = decideTwin({ detail: dt }, ocr.text);
            } else if (vars) {
                r2 = pickNearestVariant(ocr.text, vars);
                if (!r2.name && dt && dt.mode) {
                    const fb = decideTwin({ detail: dt }, ocr.text);
                    fb.note = "编辑距离打平，退回关键词规则；" + (fb.note || "");
                    r2 = fb;
                }
            } else if (dt && dt.mode) {
                r2 = decideTwin({ detail: dt }, ocr.text);
            } else {
                r2 = { name: null, uncertain: true, note: "族既无变体列表也无判据", rule: "" };
            }
            c.stage2.rule = r2.rule || "";
            const provisional = (typeof c.stage2.provisional === "string") ? c.stage2.provisional : null;
            if (r2.name) {
                c.name = r2.name;
                c.method = "detail";
                c.uncertain = !!r2.uncertain;
                c.note = r2.note || ("详情 OCR ⇒ " + r2.name);
            } else if (provisional) {
                c.name = provisional;
                c.method = "detail";
                c.uncertain = true;
                c.note = (r2.note || ("孪生详情 OCR 判不出（原文：" + (ocr.text || "空") + "）")) +
                    "；已确认属美味版这一档，暂按「" + provisional + "」输出";
            } else {
                c.uncertain = true;
                c.note = r2.note || "孪生详情 OCR 判不出（原文：" + (ocr.text || "空") + "）";
            }
            stats.twinClicked = (stats.twinClicked || 0) + 1;
        } catch (e) {
            c.uncertain = true;
            c.note = "孪生点击/OCR 异常：" + ((e && e.message) ? e.message : e);
            stats.notes.push("孪生格 r" + c.row + "c" + c.col + " 点击异常：" + c.note);
        } finally {
            disposeRegion(frame);
        }
    }
    try {
        const hp = await prepareScrollTarget({ col: lastClickCol });
        stats.hoverUsed = { x: hp.x, y: hp.y, fromCol: lastClickCol };
        try { click(hp.x, hp.y); } catch (e2) {
            stats.notes.push("孪生判定后悬停点左键失败：" + ((e2 && e2.message) ? e2.message : e2));
        }
    } catch {                             }
}

function readBulkDiag() {
    const def = { fast: 0, slow: 0, shape: "", form: "", tried: [], fail: null };
    try {
        const b = (typeof bulkStatsSnapshot === "function") ? bulkStatsSnapshot() : null;
        const t = (typeof toBytesStatsSnapshot === "function") ? toBytesStatsSnapshot() : null;
        const out = {
            fast: (b && typeof b.fast === "number") ? b.fast : 0,
            slow: (b && typeof b.slow === "number") ? b.slow : 0,
            shape: (b && typeof b.shape === "string") ? b.shape : "",
            form: (t && typeof t.form === "string") ? t.form : "",
            tried: (t && Array.isArray(t.tried)) ? t.tried.slice() : [],
            fail: (t && t.fail) ? String(t.fail) : null
        };
        if (b && b.shapeHits && typeof b.shapeHits === "object") out.shapeHits = Object.assign({}, b.shapeHits);
        return out;
    } catch (e) {
        def.err = (e && e.message) ? String(e.message).slice(0, 120) : "readBulkDiag 异常";
        return def;
    }
}

function bulkDelta(cur, prev) {
    if (!cur) return null;
    const p = prev || { fast: 0, slow: 0 };
    const dF = (cur.fast || 0) - (p.fast || 0);
    const dS = (cur.slow || 0) - (p.slow || 0);
    return {
        fast: dF > 0 ? dF : 0,
        slow: dS > 0 ? dS : 0,
        shape: cur.shape || "",
        form: cur.form || "",
        tried: cur.tried || [],
        fail: cur.fail || null,
        cum: { fast: cur.fast || 0, slow: cur.slow || 0 }
    };
}

function writeDebugScreen(jsonl, pageName, screenIdx, shot, ident, zones, reshoot, tms, thumb, screenNotes, bulkDiag, cropMs, cropN, pxMs, pxN) {
    const rec = {
        page: pageName,
        screen: screenIdx,
        zones: (zones && zones.length) ? zones.length : 0,
        cells: (ident && ident.cells) ? ident.cells.length : 0,
        shot: shot
    };
    if (reshoot) rec.reshoot = true;
    if (thumb) rec.thumb = thumb;
    if (tms) {
        rec.tms = tms;
        rec.cropMs = cropMs; rec.cropN = cropN;
        rec.pxMs = pxMs; rec.pxN = pxN;
    }
    rec.bulk = bulkDiag || { fast: 0, slow: 0, shape: "", form: "", tried: [], fail: null };
    if (Array.isArray(screenNotes) && screenNotes.length) rec.notes = screenNotes;
    if (!ident) rec.identNull = true;
    if (ident && Array.isArray(ident.cellErrors) && ident.cellErrors.length) {
        rec.cellErrors = ident.cellErrors;
    }
    if (ident && ident.screen) {
        rec.plausible = !!ident.screen.plausible;
        rec.screenMean = ident.screen.meanScore;
        rec.screenReason = ident.screen.reason || "";
    }
    if (typeof ident === "object" && ident && typeof ident.candTotal === "number") {
        rec.candTotal = ident.candTotal;
    }
    if (ident && ident.cells) {
        rec.cellsIdent = ident.cells.map(function (c) {
            const o = {
                r: c.row, c: c.col, y0: c.y0,
                name: c.name, m: c.method, s: c.score,
                u: c.uncertain ? 1 : 0,
                n: c.note || "",
                q: c.count, qv: c.countVia || "", qa: c.countAmbiguous ? 1 : 0,
                qr: c.countReason || ""
            };
            if (c.weak) { o.weak = 1; o.weakName = c.weakName || ""; }
            if (typeof c.margin === "number")      o.margin = c.margin;
            if (typeof c.coarseScore === "number") o.cs = c.coarseScore;
            if (typeof c.secondScore === "number") o.ss = c.secondScore;
            if (c.secondName)                      o.sn = c.secondName;
            if (c.decidedBy)                       o.dby = c.decidedBy;
            if (c.decidedBy2)                      o.by2 = c.decidedBy2;
            if (c.uncertainReason)                 o.ur = c.uncertainReason;
            if (c.garbage)                         o.garbage = 1;
            if (c.riskFlag)                        o.rflag = c.riskFlag;
            const sec = c.stage2;
            if (sec) {
                if (sec.dOdd !== undefined) {
                    o.dOdd = sec.dOdd; o.dNormal = sec.dNormal; o.dDeli = sec.dDeli;
                }
                if (sec.rule) o.rule = sec.rule;
                if (sec.ocrRaw !== undefined) o.ocrRaw = sec.ocrRaw;
                if (sec.garbage) o.garbage = 1;
            }
            return o;
        });
    }
    jsonl.write(rec);
}

async function readFilterPoints(mat) {
    let hit = 0;
    for (let i = 0; i < FILTER.px.length; i++) {
        const p = FILTER.px[i];
        const c = px(mat, p.y, p.x);
        if (c && c[0] === FILTER.color[0] && c[1] === FILTER.color[1] && c[2] === FILTER.color[2]) hit++;
    }
    return { hit: hit, total: FILTER.px.length, on: hit === FILTER.px.length };
}

async function ensureFilterOff(pageName, stats) {
    const out = { checked: false, on: false, hit: 0, total: 0 };
    if (!FILTER.enabled || pageName !== FILTER.tab) return out;
    let frame = null;
    let mat = null;
    try {
        frame = capture();
        mat = srcMatOf(frame);
        if (mat && !pixelReady()) initPixelReader(mat);
    } catch (e) {
        stats.notes.push("筛选检测截图失败：" + ((e && e.message) ? e.message : e));
        return out;
    }
    try {
        if (!mat) return out;
        const r = await readFilterPoints(mat);
        out.checked = true;
        out.on = r.on;
        out.hit = r.hit;
        out.total = r.total;
    } finally {
        disposeRegion(frame);
    }
    stats.filterState = { on: out.on, hit: out.hit, total: out.total };
    if (!out.on) return out;
    stats.notes.push("检测到食物页筛选开启（" + out.hit + "/" + out.total + "）⇒ 取消筛选");
    for (let i = 0; i < FILTER.clearBtn.times; i++) {
        try { click(FILTER.clearBtn.x, FILTER.clearBtn.y); } catch (e) { break; }
        await sleep(FILTER.clearBtn.gapMs);
    }
    for (let i = 0; i < FILTER.blankClick.times; i++) {
        try { click(FILTER.blankClick.x, FILTER.blankClick.y); } catch (e) { break; }
        await sleep(FILTER.blankClick.gapMs);
    }
    return out;
}

export async function scanPage(pageName, identCtx, opts) {
    const t0 = Date.now();
    const candTotalOfPage = mergeTwinCandidates(
        ((identCtx && identCtx.byTab && identCtx.byTab[pageName]) || []).map(function (t) { return t.name; }),
        (pageName === "食物") ? twinExtraNames(identCtx) : null).length;
    const stats = {
        page: pageName,
        screens: 0,
        turns: 0,
        rowsAdvanced: 0,
        endOfList: 0,
        unconfirmed: 0,
        cancelled: 0,
        fullPage: false,
        falseEnd: 0,
        eqOk: false,
        elapsedMs: 0,
        notes: []
    };
    const dbgDir = (opts && opts.debugDir) || null;
    const dbgJsonl = (opts && opts.dbgJsonl) || null;
    const reuseBag = !!(opts && opts.reuseBag === true);
    if (opts && opts.skipNav === true) {
        stats.bagReused = reuseBag;
        stats.navSkipped = true;
    } else {
        const navText = await openBagAndSwitchTab({
            openBag: !reuseBag,
            targetTab: pageName
        });
        const navOk = (navText === RESULT.OK);
        if (!navOk) {
            stats.notes.push("未能进入页签：" + navText);
            stats.elapsedMs = Date.now() - t0;
            return stats;
        }
        stats.bagReused = reuseBag;
    }
    await ensureFilterOff(pageName, stats);
    try {
        const hp0 = await prepareScrollTarget();
        stats.hoverPoint = { x: hp0.x, y: hp0.y };
    } catch (e) {
        stats.notes.push("导航后归位失败：" + ((e && e.message) ? e.message : e));
    }
    const settle = await waitForCellsSettled({ minZones: GRID.rows });
    if (settle.timedOut) {
        stats.notes.push("等加载取色超时（" + settle.elapsedMs + "ms / " + settle.tries +
            " 次）仍未见有效严色带 —— 可能是空页签，也可能是加载更慢，后续如报无格子请先看这条");
    }
    const maxScreens = opts.maxScreens || 60;
    let completedPages = 0;
    const perScreenRows = GRID.rows;
    let cellsSeen = 0;
    const partial = (opts && opts.partial) ? opts.partial : null;
    const pageItems = [];
    let bulkPrev = dbgJsonl ? { fast: readBulkDiag().fast, slow: readBulkDiag().slow } : { fast: 0, slow: 0 };

    for (let s = 0; s < maxScreens; s++) {
        if (isCancelled()) { stats.cancelled++; stats.notes.push("用户取消于第 " + s + " 屏"); break; }

        let frame = null;
        let ident = null;
        let zonesI = null;
        let szI = null;
        let pageItemsStart = -1;
        let dbgShot = null;
        const notesBase = stats.notes.length;
        const tms = dbgJsonl ? { capture: 0, zones: 0, recognize: 0, crop: 0, cropN: 0, pixel: 0, pixelN: 0, count: 0, total: 0 } : null;
        const tStart = tms ? Date.now() : 0;
        let tMark = tStart;
        let cropMs = 0, cropN = 0, pxMs = 0, pxN = 0;
        const mark = tms ? function (k) { const n = Date.now(); tms[k] = n - tMark; tMark = n; } : function () { };

        try {
            frame = capture();
            mark("capture");
        } catch (e) {
            stats.notes.push("第 " + s + " 屏截图失败：" + ((e && e.message) ? e.message : e));
            break;
        }

        let reachedBottom = false;
        let fullPage = false;
        const knownTop = (opts && s === 0 && typeof opts.knownTopHasThumb === "boolean")
            ? opts.knownTopHasThumb : null;
        try {
            if (knownTop !== null) {
                fullPage = !knownTop;
                stats.thumbProbe = {
                    band: "top", hit: null, total: null, minHit: null,
                    state: knownTop ? "TOP_HAS_THUMB(from dragToBottom)" : "TOP_NO_THUMB(from dragToBottom)",
                    reused: true
                };
            } else {
                const sl = (s === 0)
                    ? await thumbState({ band: "top", tab: pageName })
                    : await thumbState({ band: "bottom", tab: pageName });
                if (s === 0) {
                    fullPage = !(sl && sl.hasThumb);
                } else {
                    reachedBottom = !!(sl && sl.atBottom);
                }
                stats.thumbProbe = {
                    band: (s === 0) ? "top" : "bottom",
                    hit: sl ? sl.evidence.hit : null,
                    total: sl ? sl.evidence.total : null,
                    minHit: sl ? sl.evidence.minHit : null,
                    state: sl ? sl.state : "?"
                };
            }
        } catch (e) {
            stats.notes.push("第 " + s + " 屏把手读数失败（按未到底处理）：" +
                ((e && e.message) ? e.message : e));
        }
        if (reachedBottom && !(opts && opts.alreadyAtBottom === true)) {
            await sleep(CELLS.bottomSettleMs);
            let frame2 = null;
            try {
                frame2 = capture();
                if (frame2) {
                    disposeRegion(frame);
                    frame = frame2;
                    frame2 = null;
                    stats.bottomReshoot = true;
                }
            } catch (e) {
                stats.notes.push("到底屏重截失败（沿用原帧）：" + ((e && e.message) ? e.message : e));
            } finally {
                disposeRegion(frame2);
            }
        }
        try {
            const mat = srcMatOf(frame);
            const sz = matSize(mat);
            if (!sz.rows || !sz.cols) throw new Error("无法读取图像尺寸");
            szI = sz;
            zonesI = findZones(mat, szI);
            mark("zones");
            cellsSeen += zonesI.length * GRID.cols;
        } catch (e) {
            stats.notes.push("第 " + s + " 屏找格子失败：" + ((e && e.message) ? e.message : e));
            disposeRegion(frame);
            break;
        }
        try {
            const m = srcMatOf(frame);
            const szn = matSize(m);
            if (opts && typeof opts.recognize === "function") {
                ident = await opts.recognize({
                    frame: frame, mat: m, sz: szn, zones: zonesI,
                    screenIndex: s, readCount: readCount, cellRects: cellRects
                });
            } else if (identCtx && identCtx.byTab[pageName]) {
                const getCrop = function (x, y, cw, chh) {
                    const tc = tms ? Date.now() : 0;
                    let cr = null;
                    try {
                        cr = cropBase(frame, { x: x, y: y, w: cw, h: chh });
                        if (!cr) return null;
                        const cm = srcMatOf(cr);
                        const rd = readMatBgr(cm);
                        return rd.ok ? rd.bgr : null;
                    } catch { return null; }
                    finally { if (cr) disposeRegion(cr); if (tms) { cropMs += Date.now() - tc; cropN++; } }
                };
                const getPixel = function (x, y) {
                    const tp = tms ? Date.now() : 0;
                    const v = px(m, y, x);
                    if (tms) { pxMs += Date.now() - tp; pxN++; }
                    return v;
                };
                const getOccupancy = function (y0o) { return rowOccupancy(m, szn, y0o); };
                ident = recognizeScreen(null, szn.cols, szn.rows, zonesI, {
                    tab: pageName,
                    templates: identCtx.byTab[pageName],
                    candTotal: candTotalOfPage,
                    rosterIndex: identCtx.index,
                    screenIndex: s,
                    twinClick: identCtx.twinClick,
                    isVariantDecoy: identCtx.isVariantDecoy,
                    getCrop: getCrop,
                    getPixel: getPixel,
                    getOccupancy: getOccupancy,
                    srcMat: m
                });
            }
            if (ident) {
                const _tCount = tms ? Date.now() : 0;
                for (let ci = 0; ci < ident.cells.length; ci++) {
                    const c = ident.cells[ci];
                    const rc = cellRects(c.y0)[c.col - 1];
                    if (!rc) { c.countReason = "取不到数字区矩形"; continue; }
                    try {
                        const cnt = readCount(frame, rc.digit, (identCtx && identCtx.digitOpts) || {});
                        c.count = (cnt.value === null || cnt.value === undefined) ? null : cnt.value;
                        c.countOk = (c.count !== null) && !cnt.ambiguous;
                        c.countVia = cnt.via || "";
                        c.countAmbiguous = !!cnt.ambiguous;
                        c.countText = (cnt.template && cnt.template.adopted)
                            ? cnt.template.adopted.map(function (a) { return a.d; }).join("") : "";
                        c.countScore = null;
                        c.countReason = cnt.note || "";
                    } catch (e) {
                        c.count = null; c.countOk = false;
                        c.countReason = "数量识别异常：" + ((e && e.message) ? e.message : e);
                    }
                }
                if (tms) tms.count = Date.now() - _tCount;
            }
        } catch (e) {
            stats.notes.push("第 " + s + " 屏识别异常：" + ((e && e.message) ? e.message : e));
        }
        mark("recognize");
        if (tms) {
            tms.crop = cropMs; tms.cropN = cropN;
            tms.pixel = pxMs; tms.pixelN = pxN;
            tms.total = Date.now() - tStart;
            const hs = hostCropStats();
            tms.hcMs = hs.ms; tms.hcCalls = hs.calls;
            tms.hcFast = hs.fast; tms.hcSlow = hs.slow;
            tms.hcForm = hs.form; tms.hcFail = hs.fail;
            hostCropReset();
        }
        if (dbgJsonl) dbgShot = savePageShot(frame, dbgDir, pageName, s);
        disposeRegion(frame);
        frame = null;
        if (ident && TWIN.enabled) await resolveTwins(ident.cells, stats);
        if (ident) {
            pageItemsStart = pageItems.length;
            pageItems.push.apply(pageItems, ident.cells);
            if (partial) { partial.items = pageItems; partial.screens = stats.screens; }
            if (ident.screen && !ident.screen.plausible) {
                stats.notes.push("第 " + s + " 屏判为异常屏：" + ident.screen.reason);
            }
        }
        if (dbgJsonl) {
            const bNow = readBulkDiag();
            const bDelta = bulkDelta(bNow, bulkPrev);
            bulkPrev = { fast: bNow.fast, slow: bNow.slow };
            writeDebugScreen(dbgJsonl, pageName, s, dbgShot, ident, zonesI, reachedBottom, tms, stats.thumbProbe, stats.notes.slice(notesBase), bDelta, cropMs, cropN, pxMs, pxN);
        }
        stats.screens++;
        if (opts && typeof opts.stopWhen === "function" && opts.stopWhen(pageItems)) {
            stats.earlyStop = true;
            stats.notes.push((opts.stopReason || "目标物品已全部找到") +
                " ⇒ 第 " + s + " 屏后停止本页签");
            break;
        }
        if (fullPage) {
            stats.endOfList++;
            stats.fullPage = true;
            if (stats.thumbProbe) {
                stats.thumbProbe.fullPage = true;
                stats.thumbProbe.fullPageNote = "顶部区未见把手 ⇒ 物品不满一页，无需翻页";
            }
            break;
        }
        if (reachedBottom) {
            stats.endOfList++;
            if (s === 0) {
                stats.falseEnd++;
                stats.notes.push("第 0 屏即判定到底 —— 若该页签应为空则正常，否则需人工复核");
            }
            break;
        }
        const scrollRes = await scrollRowsVerified(perScreenRows, completedPages, {
            retryCount: PAGER.turnRetryCount,
            itemsSeen: cellsSeen
        });
        stats.turns++;
        if (scrollRes.outcome === "advanced") {
            stats.rowsAdvanced += scrollRes.advancedRows;
            completedPages++;
            continue;
        }
        if (scrollRes.outcome === "endOfList") {
            stats.endOfList++;
            break;
        }
        if (scrollRes.outcome === "cancelled") {
            stats.cancelled++;
            stats.notes.push("翻页被取消于第 " + s + " 屏后");
            break;
        }
        stats.unconfirmed++;
        stats.notes.push("第 " + s + " 屏后位移无法判定：" + (scrollRes.error || "未知") +
            " —— 已停止本页签以免漏扫");
        break;
    }

    try {
        const _rf = [];
        for (const c of pageItems) {
            if (c && c.riskFlag) _rf.push(c);
        }
        stats.riskFlagCount = _rf.length;
        if (_rf.length) {
            stats.notes.push("⚠ 风险观测旗 " + _rf.length + " 格（" + pageName +
                "）：双模板都不像且领先<阈值，当前判定可能随图像质量翻转，建议人工抽查 —— " +
                _rf.slice(0, 8).map(function (c) {
                    return "r" + c.row + "c" + c.col + " " + (c.name || "?");
                }).join("、") + (_rf.length > 8 ? " 等" : ""));
        }
    } catch (e) {
        stats.notes.push("风险旗统计异常：" + ((e && e.message) ? e.message : e));
    }

    const expected = (stats.turns - stats.endOfList - stats.unconfirmed - stats.cancelled) * perScreenRows;
    stats.eqOk = (expected === stats.rowsAdvanced);
    stats.expectedRows = expected;
    stats.elapsedMs = Date.now() - t0;
    stats.items = pageItems;
    return stats;
}

const BENIGN_NOTES = [
    /^已到列表底部$/,
    /⇒ 第 \d+ 屏后停止本页签$/,
    /^滚轮兜底已翻到列表底部/,
    /^第 \d+ 次尝试成功$/,
    /第 \d+ 屏即判定到底/,
    /顶部区未见把手/,
    /物品不满一页/,
    /本页签无需翻页/,
    /检测到食物页筛选开启/
];

function isBenignNote(note) {
    const n = String(note || "");
    for (const re of BENIGN_NOTES) if (re.test(n)) return true;
    return false;
}

const SPECIAL_NAMES = {
    "武器": ["精锻用魔矿", "精锻用良矿", "精锻用杂矿"],
    "圣遗物": ["祝圣精华", "祝圣油膏"],
    "贵重道具": ["无主的星辉", "无主的星尘", "纠缠之缘", "相遇之缘"]
};

async function runSpecialPage(alias, o) {
    const t0 = Date.now();
    const tab = specialTabOf(alias);
    const stats = {
        page: alias, tab: tab,
        screens: 0, rowsAdvanced: 0, endOfList: 0,
        cells: 0, hits: 0, items: [], currency: [],
        notes: [], earlyStop: false, dragged: false, dragFallback: false,
        elapsedMs: 0
    };
    if (!tab) {
        stats.notes.push("不是特殊页签：" + alias);
        stats.elapsedMs = Date.now() - t0;
        return stats;
    }
    const built = buildSpecialScan(tab, SPECIAL_NAMES[tab] || []);
    if (!built.ok) {
        for (const x of built.problems) stats.notes.push(x);
        stats.elapsedMs = Date.now() - t0;
        return stats;
    }

    const navText = await openBagAndSwitchTab({
        openBag: !o.reuseBag,
        targetTab: tab
    });
    if (navText !== RESULT.OK) {
        stats.notes.push("未能进入页签：" + navText);
        stats.elapsedMs = Date.now() - t0;
        return stats;
    }

    const isStatic = (tab === "武器" || tab === "圣遗物");
    let alreadyAtBottom = false;
    if (isStatic) {
        const dr = await dragToBottom(tab);
        stats.dragTraces = dr.traces || [];
        stats.dragNeed = dr.needDrag;
        if (dr.needDrag === false) {
            stats.dragged = false;
            stats.noDragNeeded = true;
            stats.notes.push("顶部区未见把手 ⇒ 物品不满一页，无需拖拽");
        } else if (dr.ok) {
            stats.dragged = true;
            alreadyAtBottom = true;
        } else {
            stats.dragFallback = true;
            stats.notes.push("拖拽到底失败（" + dr.reason + "）⇒ 退回滚轮翻页兜底");
        }
    }

    let st = null;
    try {
        st = await scanPage(tab, null, {
            maxScreens: o.maxScreens,
            debugDir: o.debugDir,
            dbgJsonl: o.dbgJsonl,
            reuseBag: o.reuseBag,
            partial: o.partial,
            recognize: built.recognize,
            stopWhen: built.stopWhen,
            skipNav: true,
            alreadyAtBottom: alreadyAtBottom,
            knownTopHasThumb: (stats.dragNeed === true) ? true
                : ((stats.dragNeed === false) ? false : null)
        });
    } catch (e) {
        stats.notes.push("扫描异常：" + ((e && e.message) ? e.message : e));
        stats.elapsedMs = Date.now() - t0;
        return stats;
    }

    for (const k of ["screens", "rowsAdvanced", "endOfList", "elapsedMs"]) {
        if (typeof st[k] === "number") stats[k] = st[k];
    }
    stats.earlyStop = !!st.earlyStop;
    stats.items = st.items || [];
    stats.hits = stats.items.length;
    for (const n of (st.notes || [])) stats.notes.push(n);

    if (tab === "贵重道具" && SPECIAL.currency && SPECIAL.currency.enabled) {
        let fr = null;
        try {
            fr = capture();
            const cur = readCurrency(fr);
            stats.currency = cur.items;
            for (const x of cur.problems) stats.notes.push(x);
        } catch (e) {
            stats.notes.push("原石/摩拉读取异常：" + ((e && e.message) ? e.message : e));
        } finally {
            disposeRegion(fr);
        }
    }
    stats.elapsedMs = Date.now() - t0;
    return stats;
}

export async function run(opts) {
    const apiMode = (opts !== undefined && opts !== null);
    const o0 = apiMode ? opts : {};
    const outputOn = (apiMode && typeof o0.output === "boolean") ? o0.output : true;
    const acct = apiMode
        ? ((typeof o0.account === "string") ? o0.account : "")
        : settingText("account", "");
    setAccount(acct);
    try {
        return await runCore(opts, apiMode, outputOn);
    } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        if (outputOn) {
            try {
                makeRunDir();
                const out = {
                    扫描时间: formatLocalTime(new Date()),
                    耗时秒: 0,
                    摘要: [],
                    异常重复: [],
                    异常未识别: [],
                    分类: {},
                    未识别: [],
                    问题: ["扫描异常终止：" + msg]
                };
                writeTextSafe(resultFile(), buildTextReport(out));
                writeTextSafe(historyFile(), mergeHistory(readTextSafe(historyFile()), buildHistoryEntry(out)));
            } catch { }
        }
        throw e;
    }
}

async function runCore(opts, apiMode, outputOn) {
    const o = opts || {};
    if (apiMode && o.pages !== undefined) {
        if (!Array.isArray(o.pages)) {
            throw new Error("pages 必须是数组，合法值：" + VALID_PAGES.join("、"));
        }
        if (!o.pages.length) throw new Error("pages 不能是空数组");
        const bad = o.pages.filter(function (p) { return typeof p !== "string" || VALID_PAGES.indexOf(p) < 0; });
        if (bad.length) {
            throw new Error("pages 含非法值：" + bad.join("、") + "，合法值：" + VALID_PAGES.join("、"));
        }
        const seenTab = new Map();
        for (const p of o.pages) {
            const t = isSpecialTab(p) ? specialTabOf(p) : p;
            if (seenTab.has(t)) {
                throw new Error("pages 含重复页签：「" + seenTab.get(t) + "」与「" + p + "」指向同一个页签「" + t + "」");
            }
            seenTab.set(t, p);
        }
    }
    const pre = preflightResolution();
    if (!pre.ok) throw new Error("分辨率/画面预检失败：" + pre.msg);
    const runDir = outputOn ? makeRunDir() : null;
    const allPages = listTabs().filter(function (n) { return SCAN_PAGES.indexOf(n) >= 0; });
    const specialAliases = listSpecialAliases();
    const selectable = allPages.concat(specialAliases);
    let pages;
    if (apiMode) {
        pages = Array.isArray(o.pages) ? o.pages.slice() : allPages;
    } else {
        const fromSettings = settingList("pages", null);
        pages = fromSettings ? fromSettings.filter(function (p) { return selectable.indexOf(p) >= 0; }) : allPages;
        if (!pages.length) pages = allPages;
    }

    const allStats = [];
    const problems = [];
    const normalPages = pages.filter(function (p) { return !isSpecialTab(p); });
    const specialPages = pages.filter(function (p) { return isSpecialTab(p); });
    if (specialPages.length) {
        const sf = loadSpecialFeatures();
        if (!sf.ok) {
            for (const x of sf.problems) problems.push(x);
        }
    }
    const maxScreens = (typeof o.maxScreens === "number" && o.maxScreens > 0)
        ? o.maxScreens
        : 60;
    const debugOn = (typeof o.debug === "boolean") ? o.debug : (apiMode ? false : settingBool("debug", false));
    const debugDir = debugOn ? makeDebugDir() : null;
    const dbgJsonl = debugDir ? makeJsonlWriter(debugDir + "/records.json") : null;
    DIAG.on = !!dbgJsonl;
    let identCtx = null;
    let identInfo = null;
    try {
        const ownedList = apiMode
            ? allRetiredNames()
            : (settingList("ownedFoods", null, { distinguishEmpty: true }) || []);
        if (normalPages.length) {
            identCtx = initIdentify(normalPages, ownedList);
            identInfo = snapshotIdent(identCtx);
            if (!identCtx.ok) {
                const probs = identCtx.problems.slice();
                const flt = (identCtx.filter && identCtx.filter.problems) ? identCtx.filter.problems.slice() : [];
                for (const x of flt) probs.push(x);
                emitDiagnostics("识别层初始化失败", probs, apiMode, problems);
                identCtx = null;
            } else if (identCtx.filter && identCtx.filter.problems && identCtx.filter.problems.length) {
                emitDiagnostics("绝版清单处理异常", identCtx.filter.problems.slice(), apiMode, problems);
            }
        } else {
            identCtx = null;
        }
    } catch (e) {
        identCtx = null;
        identInfo = null;
        emitDiagnostics("识别层初始化异常", [((e && e.message) ? e.message : String(e))], apiMode, problems);
    }
    let partial0 = null;
    let firstPageDone = false;
    const pageAttempts = (typeof o.pageAttempts === "number" && o.pageAttempts > 0)
        ? o.pageAttempts : 2;
    for (const p of pages) {
        if (isCancelled()) {
            const msg = "用户取消，页签「" + p + "」及之后未扫描";
            problems.push(msg);
            if (apiMode) logError(msg);
            break;
        }
        let pageStat = null;
        let lastErr = "";
        for (let attempt = 1; attempt <= pageAttempts; attempt++) {
            const reuseBag = (attempt === 1) ? firstPageDone : false;
            try {
                partial0 = { page: p, items: [], screens: 0, t0: Date.now() };
                const isSp = isSpecialTab(p);
                pageStat = isSp
                    ? await runSpecialPage(p, {
                        maxScreens: maxScreens, reuseBag: reuseBag,
                        debugDir: debugDir, dbgJsonl: dbgJsonl, partial: partial0
                    })
                    : await scanPage(p, identCtx, {
                        maxScreens: maxScreens,
                        debugDir: debugDir,
                        dbgJsonl: dbgJsonl,
                        reuseBag: reuseBag,
                        partial: partial0
                    });
                firstPageDone = true;
                if (attempt > 1) problems.push("页签「" + p + "」第 " + attempt + " 次尝试成功");
                break;
            } catch (e) {
                lastErr = (e && e.message) ? e.message : String(e);
                pageStat = null;
                firstPageDone = false;
                if (attempt < pageAttempts) {
                    problems.push("页签「" + p + "」第 " + attempt + " 次异常（" + lastErr + "）⇒ 本页重开背包重试");
                }
            }
        }
        if (pageStat) {
            allStats.push(pageStat);
            firstPageDone = true;
        } else {
            const partial = (partial0 && partial0.page === p) ? partial0 : null;
            allStats.push({
                page: p, screens: partial ? partial.screens : 0,
                turns: 0, rowsAdvanced: 0, eqOk: false,
                notes: ["异常：" + lastErr],
                elapsedMs: (partial && partial.t0) ? (Date.now() - partial.t0) : 0,
                endOfList: 0, unconfirmed: 0, falseEnd: 0,
                items: partial ? (partial.items || []) : []
            });
            const giveUp = "页签「" + p + "」连续 " + pageAttempts + " 次异常，已放弃：" + lastErr;
            problems.push(giveUp);
            if (apiMode) logError(giveUp);
            firstPageDone = false;
        }
    }
    for (const st of allStats) {
        for (const n of (st.notes || [])) {
            if (isBenignNote(n)) continue;
            const line = st.page + "：" + n;
            problems.push(line);
            if (apiMode) logError(line);
        }
    }
    const _twinExtra = twinExtraNames(identCtx);

    let watchText = "";
    try {
        watchText = settingText("watchMaterials", "");
    } catch (e) {
        problems.push("关注材料读取异常：" + ((e && e.message) ? e.message : e));
    }

    let scanOut = null;
    {
        scanOut = buildOutput({
            pages: allStats.map(function (s) {
                const sp = isSpecialTab(s.page);
                return {
                    page: s.page, items: s.items || [],
                    screens: s.screens, rowsAdvanced: s.rowsAdvanced || 0,
                    endOfList: s.endOfList || 0,
                    special: sp,
                    sparse: sp,
                    targetTotal: sp
                        ? (((SPECIAL_NAMES[specialTabOf(s.page)] || []).length) +
                           ((s.page === "抽卡资源&摩拉" && SPECIAL.currency && SPECIAL.currency.enabled)
                                ? SPECIAL.currency.regions.length : 0))
                        : undefined,
                    cells: s.cells,
                    hits: s.hits,
                    currency: s.currency || [],
                    candidates: sp ? [] : mergeTwinCandidates(
                        ((identCtx && identCtx.byTab[s.page]) || []).map(function (t) { return t.name; }),
                        (s.page === "食物") ? _twinExtra : null)
                };
            }),
            elapsedMs: allStats.reduce(function (a, s) { return a + (s.elapsedMs || 0); }, 0),
            resolution: pre.w + "x" + pre.h,
            startedAt: formatLocalTime(new Date()),
            problems: problems
        });
        const watchList = parseWatchList(watchText);
        const watched = watchList.length ? collectWatched(scanOut, watchList) : [];
        if (outputOn) {
            if (!writeTextSafe(resultFile(), buildTextReport(scanOut, watched))) {
                problems.push("扫描结果落盘失败：" + resultFile() + "（宿主文件白名单可能不含该扩展名）");
            }
            const oldHistory = readTextSafe(historyFile());
            if (!writeTextSafe(historyFile(), mergeHistory(oldHistory, buildHistoryEntry(scanOut)))) {
                problems.push("历史记录落盘失败：" + historyFile());
            }
        }
        const statsText = logSummary(scanOut);
        if (outputOn) logResultPath(resultFile());
        if (!apiMode) {
            try {
                const nr = notifyScanResult(scanOut, statsText, watchText);
                if (nr.sent) {
                    if (typeof log !== "undefined" && log && typeof log.Info === "function") {
                        log.Info("已发送扫描结果通知" + (nr.count ? "（含关注材料 " + nr.count + " 项）" : ""));
                    }
                } else if (nr.reason) {
                    problems.push("扫描结果通知未发送：" + nr.reason);
                    if (typeof log !== "undefined" && log && typeof log.Warn === "function") {
                        log.Warn("扫描结果通知未发送：" + nr.reason);
                    }
                }
            } catch (e) {
                problems.push("扫描结果通知异常：" + ((e && e.message) ? e.message : e));
            }
        }
    }
    const output = apiMode ? buildApiOutput(scanOut) : scanOut;
    return { runDir: runDir, output: output, outputWritten: outputOn, ident: identInfo };
}

function twinExtraNames(identCtx) {
    const m = {};
    const rs = identCtx && identCtx.roster;
    const click = identCtx && identCtx.twinClick;
    if (!rs || !rs.ok || !click || !click.size) return m;
    for (const fam of ((rs.food && rs.food.twin) || [])) {
        if (!click.has(fam.base)) continue;
        for (const v of fam.variants) m[v] = true;
    }
    return m;
}

function mergeTwinCandidates(baseNames, extra) {
    const out = baseNames.slice();
    if (!extra) return out;
    const seen = new Set(out);
    for (const n of Object.keys(extra)) {
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

function logSummary(out) {
    try {
        const text = buildStatsText(out);
        if (!text) return null;
        if (typeof log === "undefined" || !log) return text;
        if (typeof log.Info === "function") log.Info(text);
        else if (typeof log.info === "function") log.info(text);
        return text;
    } catch (e) { return null; }
}

function buildStatsText(out) {
    const lines = [];
    for (const s of (out.摘要 || [])) {
        const tot = (s.total === undefined) ? s.count : s.total;
        lines.push(s.page + " " + s.count + "/" + tot + " 种");
    }
    if (!lines.length) return null;
    return "统计：" + lines.join("；");
}

function logResultPath(p) {
    try {
        if (typeof log === "undefined" || !log) return;
        const text = "扫描结果路径：" + p;
        if (typeof log.Info === "function") log.Info(text);
        else if (typeof log.info === "function") log.info(text);
    } catch (e) { }
}

const NOTIFY_MAX_CHARS = 480;

export function parseWatchList(text) {
    const out = [];
    const seen = new Set();
    const raw = String(text === undefined || text === null ? "" : text);
    const parts = raw.split(/[，,、;；\n\r]+/);
    for (const p of parts) {
        const n = p.trim();
        if (!n) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

export function collectWatched(out, watchList) {
    const res = [];
    if (!watchList || !watchList.length) return res;
    const qty = new Map();
    for (const page of Object.keys(out.分类 || {})) {
        for (const it of (out.分类[page] || [])) {
            const nm = it["材料"];
            if (typeof nm !== "string") continue;
            if (qty.has(nm)) continue;
            qty.set(nm, (typeof it["数量"] === "number") ? it["数量"] : null);
        }
    }
    for (const name of watchList) {
        res.push({
            name: name,
            count: qty.has(name) ? qty.get(name) : null,
            found: qty.has(name)
        });
    }
    return res;
}

export function buildNotifyMessage(statsText, watched) {
    if (!statsText) return null;
    const lines = [statsText];
    let used = statsText.length;
    if (watched && watched.length) {
        lines.push("扫描到关注物品数量如下：");
        used += lines[1].length + 1;
        const rest = [];
        for (const w of watched) {
            let line;
            if (!w.found) line = w.name + "×未扫到";
            else if (w.count === null) line = w.name + "×?";
            else line = w.name + "×" + w.count;
            if (used + line.length + 1 > NOTIFY_MAX_CHARS) { rest.push(line); continue; }
            lines.push(line);
            used += line.length + 1;
        }
        if (rest.length) lines.push("（还有 " + rest.length + " 项未显示）");
    }
    return lines.join("\n");
}

export function notifyScanResult(out, statsText, watchText) {
    const list = parseWatchList(watchText);
    const watched = list.length ? collectWatched(out, list) : [];
    const msg = buildNotifyMessage(statsText, watched);
    if (!msg) return { sent: false, reason: "无统计行可发" };
    try {
        if (typeof notification !== "undefined" && notification &&
            typeof notification.send === "function") {
            notification.send(msg);
            return { sent: true, message: msg, count: watched.length };
        }
        return { sent: false, reason: "宿主未提供 notification.send（manifest 需 allow_js_notification）" };
    } catch (e) {
        return { sent: false, reason: "发送失败：" + ((e && e.message) ? e.message : e) };
    }
}

function writeTextSafe(path, content) {
    return writeText(path, content, false);
}

function readTextSafe(path) {
    try { return readText(path); } catch { return null; }
}
