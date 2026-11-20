import { hostResolution } from "./util.js";

export const TABS = [
    "武器", "圣遗物", "养成道具", "食物", "材料",
    "小道具", "任务", "贵重道具", "摆设"
];

const PATHS = {
    dir: "assets/背包页签切换",
    bag: "assets/背包页签切换/backpack.png",
    tab1: "assets/背包页签切换/页签1/",
    tab2: "assets/背包页签切换/页签2/",
    expire: "assets/背包页签切换/过期.png"
};

const RECT = {
    bag: { x0: 45, y0: 20, x1: 107, y1: 76 },
    tabStrip1: { x0: 140, y0: 33, x1: 242, y1: 61 },
    tabStrip2: { x0: 550, y0: 10, x1: 1379, y1: 85 },
    expire: { x0: 789, y0: 735, x1: 832, y1: 778 }
};

const TIMING = {
    afterReturnMainMs: 500,
    afterKeyPressBMs: 500,
    bagPollMs: 100,
    bagPollMax: 15,
    bagOpenRounds: 2,
    afterBagConfirmedMs: 50,
    afterExpireClickMs: 300,

    tabDetectTimeoutMs: 1500,
    tabDetectPollMs: 100,

    afterClickMs: 50,
    afterFailedVerifySettleMs: 200,
    afterWalkStepMs: 50,

    tab2MatchMs: 100,
    verifyMs: 200,
    verifyPollMs: 50,
    switchAttempts: 2
};

const MATCH_MODE = {
    tab1: "CCorrNormed",
    tab2: null,
    bag: null,
    expire: null
};

const THRESH = {
    tab2: 0.8,
    bag: 0.90,
    tab1: 0.90,
    expire: 0.90
};

export const RESULT = {
    OK: "页签切换成功",
    BAG_OPEN_FAILED: "背包打开失败",
    TAB_DETECT_FAILED: "页签识别失败",
    TAB_SWITCH_FAILED: "页签切换失败",
    BAD_PARAM: "参数非法",
    BAD_RESOLUTION: "分辨率不符",
    HOST_UNAVAILABLE: "宿主不可用"
};

const BASE_W = 1920;
const BASE_H = 1080;

function hostMissing() {
    const miss = [];
    if (typeof captureGameRegion !== "function") miss.push("captureGameRegion");
    if (typeof RecognitionObject === "undefined" || !RecognitionObject) miss.push("RecognitionObject");
    if (typeof file === "undefined" || !file) miss.push("file");
    if (typeof keyPress !== "function") miss.push("keyPress");
    if (typeof click !== "function") miss.push("click");
    if (typeof moveMouseTo !== "function") miss.push("moveMouseTo");
    if (typeof sleep !== "function") miss.push("sleep");
    return miss;
}

function num(obj, keys, def) {
    if (!obj) return def;
    for (let i = 0; i < keys.length; i++) {
        try {
            const v = obj[keys[i]];
            if (typeof v === "number" && isFinite(v)) return v;
        } catch (e) {  }
    }
    return def;
}

function dispose(obj) {
    if (!obj) return;
    try { if (typeof obj.dispose === "function") { obj.dispose(); return; } } catch (e) {  }
    try { if (typeof obj.Dispose === "function") obj.Dispose(); } catch (e) {  }
}

function validRegion(rg) {
    if (!rg) return false;
    let existed = true;
    try { if (typeof rg.isExist === "function") existed = !!rg.isExist(); } catch (e) { return false; }
    if (existed) {
        try { if (typeof rg.IsExist === "function") existed = !!rg.IsExist(); } catch (e) {  }
    }
    if (!existed) return false;
    return !(num(rg, ["x", "X"], 0) === 0 && num(rg, ["y", "Y"], 0) === 0);
}

function rectW(r) { return r.x1 - r.x0; }
function rectH(r) { return r.y1 - r.y0; }

function sleepMs(ms) {
    if (typeof sleep !== "function") return Promise.resolve();
    return sleep(ms);
}

function captureOnce() {
    return captureGameRegion();
}

function measure(frame) {
    const out = { w: 0, h: 0 };
    try {
        const m = frame && (frame.srcMat || frame.SrcMat);
        if (m) {
            out.w = num(m, ["cols", "Cols"], 0);
            out.h = num(m, ["rows", "Rows"], 0);
        }
    } catch (e) {  }
    if (!out.w || !out.h) {
        out.w = num(frame, ["width", "Width"], 0);
        out.h = num(frame, ["height", "Height"], 0);
    }
    return out;
}

const tmplCache = {};

function loadTemplate(path) {
    if (Object.prototype.hasOwnProperty.call(tmplCache, path)) return tmplCache[path];
    let mat = null;
    try {
        let exists = true;
        try { if (typeof file.isExists === "function") exists = !!file.isExists(path); } catch (e) {  }
        if (exists) {
            mat = file.readImageMatSync(path);
            if (mat) {
                try { if (typeof mat.empty === "function" && mat.empty()) mat = null; } catch (e) {  }
            }
        }
    } catch (e) {
        mat = null;
    }
    tmplCache[path] = mat;
    return mat;
}

export function clearTemplateCache() {
    for (const k in tmplCache) delete tmplCache[k];
}

export function listTabs() {
    return TABS.slice();
}

function tab1Path(name) { return PATHS.tab1 + name + ".png"; }
function tab2Path(name) { return PATHS.tab2 + name + ".png"; }

function setRoThreshold(ro, v) {
    if (!ro || typeof v !== "number" || !isFinite(v)) return ro;
    try { ro.threshold = v; } catch (e) {  }
    try { ro.Threshold = v; } catch (e) {  }
    return ro;
}

function setRoMatchMode(ro, mode) {
    if (!ro || !mode) return false;
    const keys = ["templateMatchMode", "TemplateMatchMode"];
    let done = false;
    for (let i = 0; i < keys.length; i++) {
        try {
            ro[keys[i]] = mode;
            const back = ro[keys[i]];
            if (back !== undefined && back !== null && back !== "") done = true;
        } catch (e) {  }
    }
    return done;
}

function initRo(ro) {
    try { if (typeof ro.initTemplate === "function") { ro.initTemplate(); return ro; } } catch (e) {  }
    try { if (typeof ro.InitTemplate === "function") { ro.InitTemplate(); return ro; } } catch (e) {  }
    return ro;
}

function makeRo(mat, rect, threshold, matchMode) {
    if (!mat) return null;
    let ro = null;
    try {
        ro = RecognitionObject.TemplateMatch(mat, rect.x0, rect.y0, rectW(rect), rectH(rect));
    } catch (e) {
        try { ro = RecognitionObject.templateMatch(mat, rect.x0, rect.y0, rectW(rect), rectH(rect)); } catch (e2) { ro = null; }
    }
    if (!ro) return null;
    if (matchMode) setRoMatchMode(ro, matchMode);
    setRoThreshold(ro, threshold);
    return initRo(ro);
}

function matchIn(frame, ro) {
    if (!frame || !ro) return null;
    try {
        const res = frame.find(ro);
        if (!validRegion(res)) return null;
        return {
            x: num(res, ["x", "X"], 0),
            y: num(res, ["y", "Y"], 0),
            w: num(res, ["width", "Width", "w"], 0),
            h: num(res, ["height", "Height", "h"], 0),
            score: num(res, ["matchScore", "MatchScore", "score", "Score"], null)
        };
    } catch (e) {
        return null;
    }
}

async function pollOne(mat, rect, threshold, budgetMs, pollMs, matchMode, maxAttempts) {
    const t0 = Date.now();
    let ro = null;
    let frame = null;
    let last = null;
    const cap = (typeof maxAttempts === "number" && maxAttempts > 0) ? maxAttempts : Infinity;
    let tries = 0;
    try {
        ro = makeRo(mat, rect, threshold, matchMode);
        if (!ro) return null;
        for (;;) {
            tries++;
            dispose(frame);
            frame = captureOnce();
            last = matchIn(frame, ro);
            if (last) return last;
            const used = Date.now() - t0;
            if (tries >= cap) break;
            if (used >= budgetMs) break;
            await sleepMs(Math.min(pollMs, budgetMs - used));
        }
        return null;
    } finally {
        dispose(ro);
        dispose(frame);
    }
}

export function cyclicDistance(fromIdx, toIdx) {
    const n = TABS.length;
    const right = ((toIdx - fromIdx) % n + n) % n;
    const left = ((fromIdx - toIdx) % n + n) % n;
    return (right <= left) ? { steps: right, dir: "right" } : { steps: left, dir: "left" };
}

export function tabIndex(name) {
    return TABS.indexOf(name);
}

function truthy(v, def) {
    if (v === undefined || v === null) return def;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "是" || s === "yes") return true;
        if (s === "false" || s === "0" || s === "否" || s === "no" || s === "") return false;
    }
    return def;
}

function pick(obj, keys) {
    if (!obj) return undefined;
    for (let i = 0; i < keys.length; i++) {
        try {
            if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) return obj[keys[i]];
        } catch (e) {  }
    }
    return undefined;
}

export function normalizeParams(params) {
    const p = (params && typeof params === "object") ? params : {};
    const openRaw = pick(p, ["openBag", "openbag", "open", "open_bag"]);
    const targetRaw = pick(p, ["targetTab", "targettab", "tab", "target", "target_tab"]);
    let targetTab = null;
    if (typeof targetRaw === "string" && targetRaw.trim() !== "") targetTab = targetRaw.trim();
    else if (typeof targetRaw === "number" && isFinite(targetRaw)) targetTab = String(targetRaw);
    return {
        openBag: truthy(openRaw, true),
        targetTab: targetTab
    };
}

function assetExists(path) {
    try {
        if (typeof file.isExists === "function") return !!file.isExists(path);
    } catch (e) {  }
    return true;
}

export function checkAssets() {
    const missingTab1 = [];
    const missingTab2 = [];
    const bagOk = assetExists(PATHS.bag);
    for (let i = 0; i < TABS.length; i++) {
        if (!assetExists(tab1Path(TABS[i]))) missingTab1.push(TABS[i]);
        if (!assetExists(tab2Path(TABS[i]))) missingTab2.push(TABS[i]);
    }
    const expireOk = assetExists(PATHS.expire);
    return { bagOk: bagOk, expireOk: expireOk, missingTab1: missingTab1, missingTab2: missingTab2 };
}

export async function openBag(params) {
    const t0 = Date.now();
    const p = normalizeParams(params);

    if (!p.openBag) {
        return { ok: true, skipped: true, attempts: 0, elapsedMs: 0 };
    }

    const bagMat = loadTemplate(PATHS.bag);
    if (!bagMat) {
        return { ok: false, skipped: false, attempts: 0, elapsedMs: Date.now() - t0 };
    }

    const rounds = TIMING.bagOpenRounds;
    for (let round = 1; round <= rounds; round++) {
        let returned = false;
        try {
            if (typeof genshin !== "undefined" && genshin && typeof genshin.returnMainUi === "function") {
                await genshin.returnMainUi();
                returned = true;
            }
        } catch (e) {  }
        if (returned) await sleepMs(TIMING.afterReturnMainMs);

        keyPress("B");
        await sleepMs(TIMING.afterKeyPressBMs);

        const expire = await clearExpirePopup();

        const hit = await pollOne(bagMat, RECT.bag, THRESH.bag, TIMING.bagPollMs * TIMING.bagPollMax,
            TIMING.bagPollMs, MATCH_MODE.bag, TIMING.bagPollMax);
        if (hit) {
            await sleepMs(TIMING.afterBagConfirmedMs);
            return {
                ok: true, skipped: false, attempts: round, hit: hit,
                expireFound: expire.found, expireClicked: expire.clicked,
                elapsedMs: Date.now() - t0
            };
        }
    }

    return { ok: false, skipped: false, attempts: rounds, elapsedMs: Date.now() - t0 };
}

function detectTabOnce(frame) {
    let best = null;
    let ro = null;
    try {
        for (let i = 0; i < TABS.length; i++) {
            const mat = loadTemplate(tab1Path(TABS[i]));
            if (!mat) continue;
            dispose(ro);
            ro = makeRo(mat, RECT.tabStrip1, THRESH.tab1, MATCH_MODE.tab1);
            const hit = matchIn(frame, ro);
            if (!hit) continue;
            if (hit.score !== null && hit.score < THRESH.tab1) continue;
            if (best === null || (hit.score !== null && best.hit.score !== null && hit.score > best.hit.score)) {
                best = { name: TABS[i], index: i, hit: hit };
            }
        }
    } finally {
        dispose(ro);
    }
    return best;
}

export async function detectTab() {
    const t0 = Date.now();
    const budget = TIMING.tabDetectTimeoutMs;
    const maxRounds = Math.max(1, Math.round(TIMING.tabDetectTimeoutMs / TIMING.tabDetectPollMs));
    let frame = null;
    let round = 0;
    try {
        for (;;) {
            round++;
            dispose(frame);
            frame = captureOnce();
            const best = detectTabOnce(frame);
            if (best) {
                return { name: best.name, index: best.index, hit: best.hit, elapsedMs: Date.now() - t0 };
            }
            if (round >= maxRounds) break;
            const used = Date.now() - t0;
            if (used >= budget) break;
            await sleepMs(Math.min(TIMING.tabDetectPollMs, budget - used));
        }
    } finally {
        dispose(frame);
    }
    return null;
}

async function verifyTarget(targetTab, budgetMs) {
    if (!loadTemplate(tab1Path(targetTab))) return null;
    const cap = Math.max(1, Math.ceil(budgetMs / TIMING.verifyPollMs));
    const t0 = Date.now();
    let frame = null;
    let round = 0;
    try {
        for (;;) {
            round++;
            dispose(frame);
            frame = captureOnce();
            const best = detectTabOnce(frame);
            if (best && best.name === targetTab) return best.hit;
            const used = Date.now() - t0;
            if (round >= cap || used >= budgetMs) break;
            await sleepMs(Math.min(TIMING.verifyPollMs, budgetMs - used));
        }
    } finally {
        dispose(frame);
    }
    return null;
}

async function clearExpirePopup() {
    const mat = loadTemplate(PATHS.expire);
    if (!mat) return { found: false, clicked: false };
    let frame = null;
    let ro = null;
    try {
        frame = captureOnce();
        ro = makeRo(mat, RECT.expire, THRESH.expire, MATCH_MODE.expire);
        if (!ro) return { found: false, clicked: false };
        const hit = matchIn(frame, ro);
        if (!hit) return { found: false, clicked: false };
        const cx = Math.round(hit.x + hit.w / 2);
        const cy = Math.round(hit.y + hit.h / 2);
        try { moveMouseTo(cx, cy); } catch (e) {  }
        click(cx, cy);
        await sleepMs(TIMING.afterExpireClickMs);
        return { found: true, clicked: true, x: cx, y: cy, score: hit.score };
    } catch (e) {
        return { found: false, clicked: false };
    } finally {
        dispose(ro);
        dispose(frame);
    }
}

async function clickPath(targetTab) {
    const mat = loadTemplate(tab2Path(targetTab));
    if (!mat) return null;
    const hit = await pollOne(mat, RECT.tabStrip2, THRESH.tab2, TIMING.tab2MatchMs, TIMING.verifyPollMs,
        MATCH_MODE.tab2, 2);
    if (!hit) return null;

    const cx = Math.round(hit.x + hit.w / 2);
    const cy = Math.round(hit.y + hit.h / 2);
    try {
        moveMouseTo(cx, cy);
    } catch (e) {  }
    click(cx, cy);
    await sleepMs(TIMING.afterClickMs);
    return { x: cx, y: cy, score: hit.score };
}

async function walkPath(currentTab, targetTab) {
    const from = tabIndex(currentTab);
    const to = tabIndex(targetTab);
    if (from < 0 || to < 0) return null;
    const d = cyclicDistance(from, to);
    const key = (d.dir === "right") ? "E" : "Q";
    if (d.steps === 0) {
        return { steps: 0, dir: d.dir, key: key };
    }
    for (let i = 1; i <= d.steps; i++) {
        keyPress(key);
        if (i < d.steps) await sleepMs(TIMING.afterWalkStepMs);
    }
    await sleepMs(TIMING.afterWalkStepMs);
    return { steps: d.steps, dir: d.dir, key: key };
}

export async function switchTab(params, currentTab) {
    const p = normalizeParams(params);
    const targetTab = p.targetTab;

    if (targetTab === null) {
        return {
            ok: true, switched: false, method: "none",
            attempts: 0, steps: null, direction: null,
            currentTab: (currentTab && currentTab.name) || null
        };
    }
    if (TABS.indexOf(targetTab) < 0) {
        return { ok: false, code: "BAD_PARAM", attempts: 0 };
    }

    let cur = currentTab || null;
    const maxAttempts = TIMING.switchAttempts;
    let prevClickMatched = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt > 1) {
            cur = await detectTab();
            if (!cur) {
                return { ok: false, code: "TAB_DETECT_FAILED", attempts: attempt };
            }
        }
        if (!cur) {
            return { ok: false, code: "TAB_DETECT_FAILED", attempts: attempt };
        }

        if (cur.name === targetTab) {
            return {
                ok: true, switched: false, method: "already",
                attempts: attempt, steps: 0, direction: null,
                currentTab: cur.name
            };
        }

        const clicked = prevClickMatched ? null : await clickPath(targetTab);
        let steps = null;
        let direction = null;

        if (clicked) {
            const v = await verifyTarget(targetTab, TIMING.verifyMs);
            if (v) {
                return {
                    ok: true, switched: true, method: "click",
                    attempts: attempt, steps: 0, direction: null,
                    currentTab: targetTab
                };
            }
            prevClickMatched = true;
            if (attempt < maxAttempts) {
                await sleepMs(TIMING.afterFailedVerifySettleMs);
            }
            continue;
        }

        const walk = await walkPath(cur.name, targetTab);
        if (walk) {
            steps = walk.steps;
            direction = walk.dir;
        }

        const v2 = await verifyTarget(targetTab, TIMING.verifyMs);
        if (v2) {
            return {
                ok: true, switched: true, method: "walk",
                attempts: attempt, steps: steps, direction: direction,
                currentTab: targetTab
            };
        }
    }

    return { ok: false, code: "TAB_SWITCH_FAILED", attempts: maxAttempts, targetTab: targetTab };
}

function checkResolution() {
    const host = hostResolution();
    if (host) {
        return { ok: true, matched: (host.w === BASE_W && host.h === BASE_H),
                 w: host.w, h: host.h, src: host.src };
    }
    let frame = null;
    try {
        frame = captureOnce();
        const sz = measure(frame);
        if (sz.w && sz.h) {
            return { ok: true, matched: (sz.w === BASE_W && sz.h === BASE_H),
                     w: sz.w, h: sz.h, src: "mat" };
        }
        return { ok: false, matched: false, w: sz.w, h: sz.h, src: "mat" };
    } finally {
        dispose(frame);
    }
}

function warnResolution() {
    try {
        if (typeof log === "undefined" || !log) return;
        const text = "当前运行分辨率不为 " + BASE_W + "×" + BASE_H + "，无法正常识别，结果不可靠！";
        if (typeof log.Error === "function") log.Error(text);
        else if (typeof log.error === "function") log.error(text);
    } catch (e) { }
}

export async function openBagAndSwitchTab(params) {
    const p = normalizeParams(params);

    if (p.targetTab !== null && TABS.indexOf(p.targetTab) < 0) {
        return RESULT.BAD_PARAM;
    }

    if (hostMissing().length) {
        return RESULT.HOST_UNAVAILABLE;
    }

    const res = checkResolution();
    if (!res.ok) {
        return RESULT.BAD_RESOLUTION;
    }
    if (!res.matched) {
        warnResolution();
    }

    const assets = checkAssets();
    if (!assets.bagOk) {
        return RESULT.BAG_OPEN_FAILED;
    }

    const bag = await openBag(p);
    if (!bag.ok) {
        return RESULT.BAG_OPEN_FAILED;
    }

    const cur = await detectTab();
    if (!cur) {
        return RESULT.TAB_DETECT_FAILED;
    }

    const sw = await switchTab(p, cur);
    if (!sw.ok) {
        if (sw.code === "BAD_PARAM") return RESULT.BAD_PARAM;
        if (sw.code === "TAB_DETECT_FAILED") return RESULT.TAB_DETECT_FAILED;
        return RESULT.TAB_SWITCH_FAILED;
    }

    return RESULT.OK;
}

export default {
    openBagAndSwitchTab: openBagAndSwitchTab,
    clearExpirePopup: clearExpirePopup,
    openBag: openBag,
    detectTab: detectTab,
    switchTab: switchTab,
    cyclicDistance: cyclicDistance,
    normalizeParams: normalizeParams,
    checkAssets: checkAssets,
    listTabs: listTabs,
    clearTemplateCache: clearTemplateCache,
    TABS: TABS
};
