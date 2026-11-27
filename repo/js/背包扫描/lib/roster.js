
export const ROSTER_PATH = "assets/背包扫描/名单/变体族.json";

const EXPECT = {
    threeVariant: 3,
    twin: 2,
    starTier: 3
};

export function parseRoster(text) {
    const out = {
        ok: false, problems: [],
        food: { threeVariant: [], twin: [] },
        material: { sameShape: [] },
        charTalent: { starTier: [] },
        gemTalent: { pointColor: [] },
        foodPoint: { potionColor: [] },
        stats: {}
    };
    let j = null;
    try { j = JSON.parse(text); } catch (e) {
        out.problems.push("JSON 解析失败：" + ((e && e.message) ? e.message : e));
        return out;
    }
    if (!j || typeof j !== "object") { out.problems.push("名单不是对象"); return out; }
    const addProblem = function (m) { out.problems.push(m); };

    const a = (j["食物"] && Array.isArray(j["食物"]["三变体"])) ? j["食物"]["三变体"] : [];
    if (!a.length) addProblem("食物.三变体 缺失或为空");
    for (const fam of a) {
        if (!fam || typeof fam["族"] !== "string" || !Array.isArray(fam["变体"])) {
            addProblem("食物.三变体 有格式不对的族：" + JSON.stringify(fam).slice(0, 60));
            continue;
        }
        if (fam["变体"].length !== EXPECT.threeVariant) {
            addProblem("三变体族「" + fam["族"] + "」成员数 " + fam["变体"].length + " ≠ " + EXPECT.threeVariant + "（拒绝启用）");
            continue;
        }
        const [w, n, d] = fam["变体"];
        if (w !== "奇怪的" + n || d !== "美味的" + n || n !== fam["族"]) {
            addProblem("三变体族「" + fam["族"] + "」不满足 [奇怪的X, X, 美味的X] 模式（拒绝启用）");
            continue;
        }
        out.food.threeVariant.push({ base: fam["族"], variants: [w, n, d] });
    }

    const b = (j["食物"] && Array.isArray(j["食物"]["孪生"])) ? j["食物"]["孪生"] : [];
    let twinRegionPending = 0;
    for (const fam of b) {
        if (!fam || !Array.isArray(fam["变体"]) || fam["变体"].length !== EXPECT.twin) {
            addProblem("孪生族「" + (fam && fam["族"]) + "」成员数 ≠ " + EXPECT.twin + "（**拒绝启用**：省点击会静默给错名字）");
            continue;
        }
        const dt = fam["详情"] || {};
        const rg = dt["区域"];
        const regionUnset = (rg === null || rg === undefined) ||
            (Array.isArray(rg) && rg.length === 0) ||
            (Array.isArray(rg) && rg.length === 4 && rg.every(function (v) { return v === 0 || v === null; }));
        const regionOk = Array.isArray(rg) && rg.length === 4 &&
            rg.every(function (v) { return typeof v === "number" && isFinite(v); }) &&
            rg[2] > 0 && rg[3] > 0;
        if (!regionOk && !regionUnset) {
            addProblem("孪生族「" + fam["族"] + "」详情区域不合法（长度≠4 或宽高≤0，拒绝启用）");
            continue;
        }
        out.food.twin.push({
            base: fam["族"],
            variants: fam["变体"].slice(),
            detail: regionOk ? {
                x: rg[0], y: rg[1], w: rg[2], h: rg[3],
                mode: dt["判据"], keyword: dt["关键词"],
                positive: dt["正例"], negative: dt["反例"],
                regionReady: true
            } : {
                x: null, y: null, w: null, h: null,
                mode: dt["判据"], keyword: dt["关键词"],
                positive: dt["正例"], negative: dt["反例"],
                regionReady: false
            }
        });
        if (!regionOk) twinRegionPending++;
    }

    const c = (j["材料"] && Array.isArray(j["材料"]["同形不同色"])) ? j["材料"]["同形不同色"] : [];
    for (const fam of c) {
        if (!fam || !Array.isArray(fam["族"]) || fam["族"].length < 2) {
            addProblem("材料族格式不对或成员 < 2：" + JSON.stringify(fam).slice(0, 60));
            continue;
        }
        out.material.sameShape.push({ variants: fam["族"].slice() });
    }

    const d = (j["养成道具"] && Array.isArray(j["养成道具"]["星级三档"])) ? j["养成道具"]["星级三档"] : [];
    for (const fam of d) {
        if (!fam || !Array.isArray(fam["变体"]) || fam["变体"].length !== EXPECT.starTier) {
            addProblem("星级三档族「" + (fam && fam["族"]) + "」成员数 ≠ " + EXPECT.starTier + "（拒绝启用）");
            continue;
        }
        out.charTalent.starTier.push({ base: fam["族"], variants: fam["变体"].slice() });
    }

    const pc = (j["养成道具"] && j["养成道具"]["单点色"]) ? j["养成道具"]["单点色"] : null;
    if (pc && Array.isArray(pc["族"])) {
        const samp = pc["采样"] || {};
        const dy = (typeof samp["dy"] === "number") ? samp["dy"] : -70;
        const tol = (typeof pc["色相容差"] === "number") ? pc["色相容差"] : 20;
        for (const fam of pc["族"]) {
            if (!fam || !Array.isArray(fam["变体"]) || fam["变体"].length < 2) {
                addProblem("单点色族「" + (fam && fam["族"]) + "」格式不对或成员 < 2（拒绝启用）");
                continue;
            }
            const hues = fam["色相"] || {};
            const variants = [];
            for (const v of fam["变体"]) {
                if (typeof v !== "string") continue;
                const hv = hues[v];
                if (typeof hv !== "number" || !isFinite(hv)) {
                    addProblem("单点色族「" + fam["族"] + "」的「" + v + "」缺色相参考值（拒绝启用）");
                    variants.length = 0;
                    break;
                }
                variants.push({ name: v, hue: hv });
            }
            if (!variants.length) continue;
            out.gemTalent.pointColor.push({
                base: fam["族"], variants: variants, dy: dy, tol: tol
            });
        }
    }

    const fpc = (j["食物"] && j["食物"]["单点色"]) ? j["食物"]["单点色"] : null;
    if (fpc && Array.isArray(fpc["族"])) {
        const samp = fpc["采样"] || {};
        const dy = (typeof samp["dy"] === "number") ? samp["dy"] : -55;
        const maxDist = (typeof fpc["最大距离"] === "number") ? fpc["最大距离"] : 30;
        for (const fam of fpc["族"]) {
            if (!fam || !Array.isArray(fam["变体"]) || fam["变体"].length < 2) {
                addProblem("食物单点色族「" + (fam && fam["族"]) + "」格式不对或成员 < 2（拒绝启用）");
                continue;
            }
            const refs = fam["参考"] || {};
            const variants = [];
            for (const v of fam["变体"]) {
                if (typeof v !== "string") continue;
                const rf = refs[v];
                if (!rf || typeof rf["色相"] !== "number" || typeof rf["饱和"] !== "number") {
                    addProblem("食物单点色族「" + fam["族"] + "」的「" + v + "」缺 色相/饱和 参考值（拒绝启用）");
                    variants.length = 0;
                    break;
                }
                variants.push({ name: v, hue: rf["色相"], sat: rf["饱和"] });
            }
            if (!variants.length) continue;
            out.foodPoint.potionColor.push({
                base: fam["族"], variants: variants, dy: dy, maxDist: maxDist
            });
        }
    }

    out.stats = {
        threeVariant: out.food.threeVariant.length,
        twin: out.food.twin.length,
        sameShape: out.material.sameShape.length,
        starTier: out.charTalent.starTier.length,
        pointColor: out.gemTalent.pointColor.length,
        potionColor: out.foodPoint.potionColor.length,
        twinRegionPending: twinRegionPending
    };
    out.ok = (out.problems.length === 0);
    return out;
}

export function buildIndex(roster) {
    const idx = {
        threeVariantOf: new Map(),
        twinOf: new Map(),
        sameShapeOf: new Map(),
        starTierOf: new Map(),
        twinNestedIn: new Map(),
        twinAttachedTo: new Map()
    };
    if (!roster || !roster.ok) return idx;
    for (const fam of roster.food.threeVariant) {
        for (const v of fam.variants) idx.threeVariantOf.set(v, fam);
    }
    for (const fam of roster.food.twin) {
        for (const v of fam.variants) idx.twinOf.set(v, fam);
    }
    for (const fam of roster.food.twin) {
        const baseName = fam.variants[0];
        const tv = idx.threeVariantOf.get(baseName);
        if (!tv || tv.variants[2] !== baseName) continue;
        for (const v of fam.variants) {
            idx.twinOf.delete(v);
            if (v === baseName) continue;
            idx.twinNestedIn.set(v, { kind: "threeVariant", fam: tv });
        }
        idx.twinAttachedTo.set(tv.base, fam);
    }
    for (const fam of roster.material.sameShape) {
        for (const v of fam.variants) idx.sameShapeOf.set(v, fam);
    }
    for (const fam of roster.charTalent.starTier) {
        for (const v of fam.variants) idx.starTierOf.set(v, fam);
    }
    idx.pointColorOf = new Map();
    for (const fam of (roster.gemTalent ? roster.gemTalent.pointColor : [])) {
        for (const v of fam.variants) idx.pointColorOf.set(v.name, fam);
    }
    idx.potionColorOf = new Map();
    for (const fam of (roster.foodPoint ? roster.foodPoint.potionColor : [])) {
        for (const v of fam.variants) idx.potionColorOf.set(v.name, fam);
    }
    return idx;
}

export function familyOf(idx, name) {
    if (!idx || typeof name !== "string") return { kind: null, fam: null };
    if (idx.twinNestedIn && idx.twinNestedIn.has(name)) {
        const e = idx.twinNestedIn.get(name);
        return { kind: e.kind, fam: e.fam, nestedTwin: idx.twinAttachedTo.get(e.fam.base) || null };
    }
    if (idx.twinOf.has(name)) return { kind: "twin", fam: idx.twinOf.get(name) };
    if (idx.threeVariantOf.has(name)) {
        const tv = idx.threeVariantOf.get(name);
        const attached = idx.twinAttachedTo ? idx.twinAttachedTo.get(tv.base) : null;
        return { kind: "threeVariant", fam: tv, nestedTwin: attached || null };
    }
    if (idx.potionColorOf && idx.potionColorOf.has(name)) {
        return { kind: "potionColor", fam: idx.potionColorOf.get(name) };
    }
    if (idx.pointColorOf && idx.pointColorOf.has(name)) {
        return { kind: "pointColor", fam: idx.pointColorOf.get(name) };
    }
    if (idx.sameShapeOf.has(name)) return { kind: "sameShape", fam: idx.sameShapeOf.get(name) };
    if (idx.starTierOf.has(name)) return { kind: "starTier", fam: idx.starTierOf.get(name) };
    return { kind: null, fam: null };
}
