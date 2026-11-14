import { readText, settingList } from "./util.js";
import { parseFeatures } from "./templates.js";
import { scanPage, initIdentify } from "./scan.js";
import { isSpecialTab, loadSpecialFeatures, buildSpecialScan } from "./special.js";

let nameIndexCache = null;

function buildNameIndex() {
    if (nameIndexCache) return nameIndexCache;
    const out = { map: new Map(), problems: [] };

    const mainText = readText("assets/背包扫描/名单/模板特征.json");
    if (!mainText) {
        out.problems.push("模板特征读取失败：assets/背包扫描/名单/模板特征.json");
    } else {
        const f = parseFeatures(mainText, { featSize: 30 });
        if (!f.ok) {
            for (const p of f.problems.slice(0, 3)) out.problems.push("模板特征：" + p);
        } else {
            for (const tab of Object.keys(f.byTab)) {
                for (const t of f.byTab[tab]) {
                    if (!out.map.has(t.name)) out.map.set(t.name, tab);
                }
            }
        }
    }

    const sf = loadSpecialFeatures();
    if (!sf.ok) {
        for (const p of sf.problems) out.problems.push(p);
    } else {
        for (const tab of Object.keys(sf.byTab)) {
            for (const t of sf.byTab[tab]) {
                if (!out.map.has(t.name)) out.map.set(t.name, tab);
            }
        }
    }

    nameIndexCache = out;
    return out;
}

export function resolveItemTab(name) {
    const idx = buildNameIndex();
    return idx.map.has(name) ? idx.map.get(name) : null;
}

function normalizeItems(list) {
    const out = { items: [], problems: [] };
    if (!Array.isArray(list)) { out.problems.push("items 必须是数组"); return out; }
    const seen = new Set();
    for (const raw of list) {
        const n = String(raw === undefined || raw === null ? "" : raw).trim();
        if (!n) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.items.push(n);
    }
    if (!out.items.length) out.problems.push("items 为空");
    return out;
}

function makeStopChecker(doneNames) {
    return function (pageItems) {
        if (!Array.isArray(pageItems)) return false;
        if (!doneNames.size) return false;
        const have = new Set();
        for (const c of pageItems) {
            if (c && c.name && doneNames.has(c.name)) have.add(c.name);
            if (have.size === doneNames.size) return true;
        }
        return have.size === doneNames.size;
    };
}

export async function runTargetScan(opts) {
    const o = opts || {};
    const t0 = Date.now();
    const res = {
        ok: false,
        items: [],
        problems: [],
        elapsedMs: 0
    };

    const norm = normalizeItems(o.items);
    for (const p of norm.problems) res.problems.push(p);
    if (!norm.items.length) { res.elapsedMs = Date.now() - t0; return res; }

    const wanted = norm.items;
    const byTab = new Map();
    for (const name of wanted) {
        const tab = resolveItemTab(name);
        if (!tab) {
            res.problems.push("名单里没有这个物品（可能拼错，或不在已收录模板中）：" + name);
            continue;
        }
        if (!byTab.has(tab)) byTab.set(tab, []);
        byTab.get(tab).push(name);
    }
    if (!byTab.size) { res.elapsedMs = Date.now() - t0; return res; }

    const normales = [];
    const specials = [];
    for (const [tab, names] of byTab) {
        if (isSpecialTab(tab)) specials.push({ tab: tab, names: names });
        else normales.push({ tab: tab, names: names });
    }

    let identCtx = null;
    if (normales.length) {
        try {
            const ownedList = settingList("ownedFoods", null, { distinguishEmpty: true }) || [];
            identCtx = initIdentify(normales.map(function (x) { return x.tab; }), ownedList);
            if (!identCtx.ok) {
                for (const p of identCtx.problems.slice(0, 5)) {
                    res.problems.push("识别层初始化失败：" + p);
                }
                identCtx = null;
            }
        } catch (e) {
            res.problems.push("识别层初始化异常：" + ((e && e.message) ? e.message : e));
            identCtx = null;
        }
    }

    const found = new Map();
    let reuseBag = false;

    function recordHit(map, c) {
        const cur = map.get(c.name);
        if (cur) {
            cur.hits++;
            return;
        }
        map.set(c.name, {
            screen: c.screen, row: c.row, col: c.col,
            count: (typeof c.count === "number" && c.count > 0) ? c.count : null,
            hits: 1
        });
    }

    for (const grp of normales) {
        if (!identCtx) {
            res.problems.push("页签「" + grp.tab + "」跳过：识别层不可用");
            continue;
        }
        const doneNames = new Set(grp.names);
        try {
            const st = await scanPage(grp.tab, identCtx, {
                maxScreens: 60,
                debugDir: null,
                dbgJsonl: null,
                reuseBag: reuseBag,
                partial: null,
                stopWhen: makeStopChecker(doneNames)
            });
            reuseBag = true;
            for (const c of (st.items || [])) {
                if (!c || !c.name) continue;
                if (!doneNames.has(c.name)) continue;
                recordHit(found, c);
            }
        } catch (e) {
            res.problems.push("页签「" + grp.tab + "」扫描异常：" + ((e && e.message) ? e.message : e));
        }
    }

    for (const grp of specials) {
        const doneNames = new Set(grp.names);
        try {
            const built = buildSpecialScan(grp.tab, grp.names);
            if (!built.ok) {
                for (const x of built.problems) res.problems.push(grp.tab + "：" + x);
                continue;
            }
            const st = await scanPage(grp.tab, null, {
                maxScreens: 60,
                reuseBag: reuseBag,
                recognize: built.recognize,
                stopWhen: built.stopWhen,
                skipNav: false
            });
            reuseBag = true;
            for (const c of (st.items || [])) {
                if (!c || !c.name) continue;
                if (!doneNames.has(c.name)) continue;
                recordHit(found, c);
            }
            for (const n of (st.notes || [])) {
                if (/失败|异常|缺失|不可用|不是特殊页签/.test(n)) res.problems.push(grp.tab + "：" + n);
            }
        } catch (e) {
            res.problems.push("页签「" + grp.tab + "」扫描异常：" + ((e && e.message) ? e.message : e));
        }
    }

    for (const name of wanted) {
        const tab = resolveItemTab(name);
        if (!tab) continue;
        const hit = found.get(name);
        const dup = !!(hit && hit.hits >= 2);
        res.items.push({
            "名称": name,
            "数量": (hit && !dup) ? hit.count : 0,
            "已找到": !!hit && !dup,
            "分类": tab
        });
        if (dup) res.problems.push("物品「" + name + "」在背包内出现 " + hit.hits + " 次（疑似误识别），按未找到处理");
    }
    res.ok = res.problems.length === 0;
    res.elapsedMs = Date.now() - t0;
    return res;
}
