function pickLists(spec) {
    const s = spec || {};
    return {
        singles: Array.isArray(s["单件"]) ? s["单件"].slice() : [],
        families: Array.isArray(s["三变体族"]) ? s["三变体族"].slice() : [],
        twinVariants: Array.isArray(s["孪生变体"]) ? s["孪生变体"].slice() : []
    };
}

const FOOD_TAB = "食物";

export function applyOwnedFilter(templates, roster, owned, spec, tabName) {
    const list = Array.isArray(templates) ? templates : [];
    const rs = roster || {};
    const own = Array.isArray(owned) ? owned : [];
    const L = pickLists(spec);
    const out = {
        templates: list.slice(),
        removed: [],
        families: [],
        twinClick: null,
        problems: []
    };
    if (!own.length) return out;
    const threeOf = new Map();
    for (const f of (rs.food && rs.food.threeVariant) || []) threeOf.set(f.base, f);
    const twinOf = new Map();
    for (const f of (rs.food && rs.food.twin) || []) twinOf.set(f.base, f);
    {
        const ownedSet0 = new Set(own);
        const retired0 = (spec && Array.isArray(spec["孪生变体"])) ? spec["孪生变体"] : [];
        const retiredSet0 = new Set(retired0);
        const click = new Set();
        for (const f of (rs.food && rs.food.twin) || []) {
            const isRetired = f.variants.some(function (v) { return retiredSet0.has(v); });
            if (!isRetired) { click.add(f.base); continue; }
            const hit = f.variants.some(function (v) { return ownedSet0.has(v) && v !== f.base; });
            if (hit) click.add(f.base);
        }
        out.twinClick = click;
    }
    const ownedSet2 = new Set(own);
    for (const base of L.families) {
        const fam = threeOf.get(base);
        if (!fam) { out.problems.push("绝版清单里的族「" + base + "」不在变体族名单中"); continue; }
        const has = ownedSet2.has(base);
        out.families.push({ base: base, kept: has });
        if (!has) {
            for (const v of fam.variants) out.removed.push(v);
        }
    }
    for (const name of L.singles) {
        let inThree = false;
        for (const f of threeOf.values()) if (f.variants.indexOf(name) >= 0) inThree = true;
        if (inThree) continue;
        if (!ownedSet2.has(name)) out.removed.push(name);
    }
    const rm = new Set(out.removed);
    const kept = [];
    for (const t of list) {
        if (t && typeof t.name === "string" && rm.has(t.name)) continue;
        kept.push(t);
    }
    out.templates = kept;
    if (tabName === FOOD_TAB) {
        const allNames = new Set();
        for (const t of list) if (t && typeof t.name === "string") allNames.add(t.name);
        for (const base of L.families) {
            const fam = threeOf.get(base);
            if (!fam) continue;
            if (ownedSet2.has(base) && !fam.variants.every(function (v) { return allNames.has(v); })) {
                out.problems.push("族「" + base + "」的变体在本页签模板库里不全");
            }
        }
    }
    return out;
}

export function twinClickSet(roster, owned, retiredSpec) {
    const rs = roster || {};
    const own = Array.isArray(owned) ? owned : [];
    const ownedSet = new Set(own);
    const retired = (retiredSpec && Array.isArray(retiredSpec["孪生变体"])) ? retiredSpec["孪生变体"] : [];
    const retiredSet = new Set(retired);
    const set = new Set();
    for (const f of (rs.food && rs.food.twin) || []) {
        const isRetired = f.variants.some(function (v) { return retiredSet.has(v); });
        if (!isRetired) { set.add(f.base); continue; }
        const hit = f.variants.some(function (v) { return ownedSet.has(v) && v !== f.base; });
        if (hit) set.add(f.base);
    }
    return set;
}

export function parseOwnedSetting(settingValue, spec) {
    const L = pickLists(spec);
    const valid = new Set();
    for (const n of L.singles) valid.add(n);
    for (const n of L.families) valid.add(n);
    for (const n of L.twinVariants) valid.add(n);
    const arr = Array.isArray(settingValue) ? settingValue : [];
    const owned = [];
    const problems = [];
    for (const raw of arr) {
        const n = String(raw === undefined || raw === null ? "" : raw).trim();
        if (!n) continue;
        if (!valid.has(n)) { problems.push("设置里有清单外的名字，已忽略：" + n); continue; }
        if (owned.indexOf(n) < 0) owned.push(n);
    }
    return { owned: owned, problems: problems };
}
