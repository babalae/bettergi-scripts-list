function cellScoreText(c) {
    return (typeof c.score === "number") ? ("一级得分 " + c.score) : "无一级得分";
}

function isWeakCell(c) {
    return !!(c && c.weak === true);
}

function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

export function formatLocalTime(d) {
    const dt = d || new Date();
    return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()) +
        " " + pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()) + ":" + pad2(dt.getSeconds());
}

function rowKey(rows, sc, rw) {
    const arr = rows.get(sc + "|" + rw);
    if (!arr || arr.length < 2) return null;
    const seq = arr.slice().sort(function (a, b) { return a.col - b.col; });
    return seq.map(function (c) { return c.col + ":" + c.name; }).join("\u0001");
}

function findOverlapRows(list) {
    const rows = new Map();
    let maxScreen = -1;
    for (const c of list) {
        if (!c || !c.name || typeof c.screen !== "number" || typeof c.row !== "number") continue;
        if (c.screen > maxScreen) maxScreen = c.screen;
        const k = c.screen + "|" + c.row;
        if (!rows.has(k)) rows.set(k, []);
        rows.get(k).push(c);
    }
    const drop = new Set();
    if (maxScreen < 1) return drop;
    for (let sc = 1; sc <= maxScreen; sc++) {
        const usedPrev = new Set();
        for (let rw = 0; rw < 4; rw++) {
            const cur = rowKey(rows, sc, rw);
            if (cur === null) continue;
            for (let rwPrev = 0; rwPrev < 4; rwPrev++) {
                if (usedPrev.has(rwPrev)) continue;
                const prev = rowKey(rows, sc - 1, rwPrev);
                if (prev === null || prev !== cur) continue;
                usedPrev.add(rwPrev);
                for (const c of rows.get(sc + "|" + rw)) {
                    drop.add(c.screen + "|" + c.row + "|" + c.col);
                }
                break;
            }
        }
    }
    return drop;
}

function scanNeighbors(list, idx) {
    const prev = (idx > 0 && list[idx - 1] && list[idx - 1].name) ? list[idx - 1].name : null;
    const next = (idx + 1 < list.length && list[idx + 1] && list[idx + 1].name) ? list[idx + 1].name : null;
    return { prev: prev, next: next };
}

function namedNeighbors(list, idx) {
    let prev = null;
    for (let i = idx - 1; i >= 0; i--) {
        if (list[i] && list[i].name) { prev = list[i].name; break; }
    }
    let next = null;
    for (let i = idx + 1; i < list.length; i++) {
        if (list[i] && list[i].name) { next = list[i].name; break; }
    }
    return { prev: prev, next: next };
}

function reasonCodeOf(c) {
    if (!c) return "NO_CANDIDATE";
    if (c.uncertainReason) return c.uncertainReason;
    if (c.garbage) return "GARBAGE_CELL";
    if (c.decidedBy === "family" || c.stage2) return "FAMILY_UNDECIDED";
    return "NO_CANDIDATE";
}

export function summarizeCells(cells) {
    const unknown = [];
    const plain = Array.isArray(cells) ? cells : [];
    const drop = findOverlapRows(plain);
    const list = [];
    for (const c of plain) {
        if (!c) { list.push(c); continue; }
        if (drop.has(c.screen + "|" + c.row + "|" + c.col)) continue;
        list.push(c);
    }
    const byName = new Map();
    const occ = new Map();
    let seq = 0;
    let weak = 0;
    for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!c || c.method === "empty") continue;

        if (c.uncertain === true) {
            const nbU = namedNeighbors(list, i);
            unknown.push({
                screen: c.screen, row: c.row, col: c.col, y0: c.y0,
                prevName: nbU.prev, nextName: nbU.next,
                weakType: "不确定",
                weakName: c.name || "",
                weakScore: (typeof c.score === "number") ? c.score : null,
                count: (typeof c.count === "number" && c.count > 0) ? c.count : null,
                reasonCode: reasonCodeOf(c),
                coarseScore: (typeof c.coarseScore === "number") ? c.coarseScore : null,
                margin: (typeof c.margin === "number") ? c.margin : null,
                decidedBy: c.decidedBy || null,
                familyId: c.familyId || null,
                note: c.note || ("不确定（" + reasonCodeOf(c) + "）")
            });
            continue;
        }

        if (isWeakCell(c)) {
            weak++;
            const nb = namedNeighbors(list, i);
            unknown.push({ screen: c.screen, row: c.row, col: c.col, y0: c.y0,
                prevName: nb.prev, nextName: nb.next,
                weakType: "弱匹配", weakName: c.weakName || c.name || "", weakScore: c.score,
                count: (typeof c.count === "number" && c.count > 0) ? c.count : null,
                note: "弱匹配（" + cellScoreText(c) + "），原判 " + (c.weakName || c.name) + " 不采信" });
            continue;
        }
        if (!c.name) {
            const nb = namedNeighbors(list, i);
            unknown.push({ screen: c.screen, row: c.row, col: c.col, y0: c.y0,
                prevName: nb.prev, nextName: nb.next,
                weakType: "无候选", weakName: "", weakScore: null,
                count: (typeof c.count === "number" && c.count > 0) ? c.count : null,
                note: "一级无候选" });
            continue;
        }
        const cnt = (typeof c.count === "number" && c.count > 0) ? c.count : null;
        if (!occ.has(c.name)) occ.set(c.name, []);
        occ.get(c.name).push({ index: i, count: cnt });
        const cur = byName.get(c.name) || {
            "材料": c.name,
            "数量": cnt,
            "本次识别到": true,
            "首次序号": seq++
        };
        if (cur["数量"] === null && cnt !== null) cur["数量"] = cnt;
        byName.set(c.name, cur);
    }
    const out = [];
    for (const v of byName.values()) out.push(v);
    out.sort(function (a, b) { return a["首次序号"] - b["首次序号"]; });
    return { items: out, unknown: unknown, occ: occ, list: list, weak: weak };
}

export function buildOutput(ctx) {
    const o = ctx || {};
    const pages = Array.isArray(o.pages) ? o.pages : [];
    const 分类 = {};
    const 未识别 = [];
    const 摘要 = [];
    const 异常重复 = [];
    for (const p of pages) {
        const s = summarizeCells(p.items);
        分类[p.page] = s.items;
        if (Array.isArray(p.currency) && p.currency.length) {
            let seq = s.items.length;
            for (const c of p.currency) {
                s.items.push({
                    "材料": c.name,
                    "数量": (c.value === null || c.value === undefined) ? null : c.value,
                    "本次识别到": true,
                    "首次序号": Number.MAX_SAFE_INTEGER - 1000 + (seq++)
                });
            }
        }
        for (const [nm, hits] of s.occ) {
            if (hits.length < 2) continue;
            const spots = [];
            for (const h of hits) {
                const nb = scanNeighbors(s.list, h.index);
                spots.push({
                    "页签": p.page,
                    "数量": h.count,
                    "位于": (nb.prev ? "「" + nb.prev + "」后" : "最前") +
                            (nb.next ? "，「" + nb.next + "」前" : "，最后")
                });
            }
            异常重复.push({ "物品": nm, "出现次数": hits.length, "位置": spots });
        }
        if (!p.sparse && Array.isArray(p.candidates) && p.candidates.length) {
            const got = new Set(s.items.map(function (it) { return it["材料"]; }));
            const seenZ = new Set();
            for (const name of p.candidates) {
                if (typeof name !== "string" || !name) continue;
                if (got.has(name) || seenZ.has(name)) continue;
                seenZ.add(name);
                s.items.push({
                    "材料": name,
                    "数量": 0,
                    "本次识别到": false,
                    "首次序号": Number.MAX_SAFE_INTEGER
                });
            }
        }
        let 扫到 = 0;
        let 条目数 = 0;
        for (const it of s.items) {
            条目数++;
            if (it["本次识别到"]) 扫到++;
        }
        const totalN = (typeof p.targetTotal === "number" && p.targetTotal > 0)
            ? p.targetTotal
            : 条目数;
        摘要.push({
            page: p.page, count: 扫到, total: totalN
        });
        if (!p.sparse) {
            for (const u of s.unknown) {
                const weakOne = !!(u && u.weakType === "弱匹配");
                未识别.push({
                    "分类": p.page,
                    "屏": (u && typeof u.screen === "number") ? u.screen : null,
                    "行": u ? u.row : null,
                    "列": u ? u.col : null,
                    "y0": u ? u.y0 : null,
                    "前一物品": (u && u.prevName) ? u.prevName : null,
                    "后一物品": (u && u.nextName) ? u.nextName : null,
                    "数量": (u && typeof u.count === "number") ? u.count : null,
                    "类型": (u && u.reasonCode) ? "不确定" : (weakOne ? "弱匹配" : "无候选"),
                    "原判": weakOne ? (u.weakName || "") : "",
                    "得分": weakOne ? u.weakScore : null,
                    "原因码": (u && u.reasonCode) ? u.reasonCode : null,
                    "一级得分": (u && typeof u.coarseScore === "number") ? u.coarseScore : null,
                    "裕度": (u && typeof u.margin === "number") ? u.margin : null,
                    "判定层": (u && u.decidedBy) ? u.decidedBy : null,
                    "族": (u && u.familyId) ? u.familyId : null,
                    "备注": u ? (u.note || "一级无候选") : "空记录"
                });
            }
        }
    }
    return {
        扫描时间: o.startedAt || formatLocalTime(new Date()),
        耗时秒: Math.round((o.elapsedMs || 0) / 100) / 10,
        摘要: 摘要,
        异常重复: 异常重复,
        异常未识别: 未识别,
        分类: 分类,
        未识别: 未识别,
        问题: (o.problems && o.problems.length) ? o.problems : []
    };
}

export function buildApiOutput(out) {
    const src = (out && out.分类 && typeof out.分类 === "object") ? out.分类 : {};
    const 分类 = {};
    for (const page of Object.keys(src)) {
        const arr = Array.isArray(src[page]) ? src[page] : [];
        const list = [];
        for (const it of arr) {
            const name = (it && typeof it["材料"] === "string") ? it["材料"] : "";
            if (!name) continue;
            const n = (typeof it["数量"] === "number" && isFinite(it["数量"])) ? it["数量"] : 0;
            list.push(name + " " + n);
        }
        分类[page] = list;
    }
    return { 分类: 分类 };
}

export function buildTextReport(out, watched) {
    const L = [];
    L.push("背包扫描结果");
    L.push("==============");
    L.push("时间：" + out.扫描时间 + "   耗时：" + out.耗时秒 + "s");
    L.push("");
    const wl = watchedLines(watched);
    if (wl.length) {
        L.push("关注材料：");
        for (const x of wl) L.push(x);
        L.push("");
    }
    pushAnomalies(L, out);
    L.push("统计：");
    for (const s of (out.摘要 || [])) {
        L.push("  " + s.page + "  " + s.count + " 种");
    }
    L.push("");
    if (out.问题 && out.问题.length) {
        L.push("【问题】" + out.问题.length + " 条");
        for (const x of out.问题.slice(0, 30)) L.push("  · " + x);
        L.push("");
    }
    for (const page of Object.keys(out.分类)) {
        const arr = out.分类[page];
        const sum = (out.摘要 || []).filter(function (x) { return x.page === page; })[0];
        const gotN = sum ? sum.count : arr.length;
        const totN = (sum && sum.total !== undefined) ? sum.total : arr.length;
        L.push("【" + page + "】" + gotN + "/" + totN + " 种");
        for (const it of arr) {
            L.push("  " + it["材料"] + " ×" + (it["数量"] === null ? "?" : it["数量"]));
        }
        L.push("");
    }

    return L.join("\n");
}

function spotText(u) {
    const prev = u["前一物品"];
    const next = u["后一物品"];
    const pos = (prev ? "「" + prev + "」后" : "最前") +
        (next ? "，「" + next + "」前" : "，最后");
    const n = u["数量"];
    return u["分类"] + "：" + pos + " ×" + ((typeof n === "number") ? n : "?");
}

function anomalyLines(out) {
    const L = [];
    if (out.异常未识别 && out.异常未识别.length) {
        L.push("这些格子物品未能成功识别，可能是模板库尚未包含它们，请更新脚本或等待作者更新：");
        L.push("  「未识别」");
        for (const u of out.异常未识别) L.push("      " + spotText(u));
        L.push("");
    }
    if (out.异常重复 && out.异常重复.length) {
        L.push("【异常重复】" + out.异常重复.length + " 组，同一物品在背包内出现多次，可能存在脚本未收录物品导致误识别，请更新脚本或等待作者更新：");
        for (const d of out.异常重复) {
            L.push("  " + d["物品"] + " ×" + d["出现次数"]);
            for (const sp of d["位置"]) {
                const n0 = (typeof sp["数量"] === "number") ? (" ×" + sp["数量"]) : "";
                L.push("      " + sp["页签"] + "：" + sp["位于"] + n0);
            }
        }
        L.push("");
    }
    return L;
}

function pushAnomalies(L, out) {
    const add = anomalyLines(out);
    if (!add.length) return;
    for (const x of add) L.push(x);
}

function watchedLines(watched) {
    const L = [];
    if (!Array.isArray(watched)) return L;
    for (const w of watched) {
        const name = (w && typeof w.name === "string") ? w.name : "";
        if (!name) continue;
        let qty;
        if (w.found === false) qty = "未扫到";
        else qty = ((typeof w.count === "number" && isFinite(w.count)) ? String(w.count) : "?");
        L.push("  " + name + " ×" + qty);
    }
    return L;
}

const HISTORY_MAX = 30;
const HISTORY_HEAD = /^===== 第 (\d+) 次 · (.*) · 耗时 ([\d.]+)s =====$/;

export function buildHistoryEntry(out) {
    return { time: out.扫描时间, cost: out.耗时秒, body: buildTextReport(out) };
}

export function mergeHistory(oldText, entry) {
    const entries = [];
    const lines = String(oldText || "").split("\n");
    let cur = null;
    for (const ln of lines) {
        const m = ln.match(HISTORY_HEAD);
        if (m) {
            if (cur) entries.push(cur);
            cur = { time: m[2], cost: m[3], body: [] };
        } else if (cur) {
            cur.body.push(ln);
        }
    }
    if (cur) entries.push(cur);
    const all = [entry];
    for (let i = 0; i < entries.length && all.length < HISTORY_MAX; i++) all.push(entries[i]);
    const parts = [];
    const total = all.length;
    for (let i = 0; i < total; i++) {
        const e = all[i];
        const bodyText = Array.isArray(e.body) ? e.body.join("\n").replace(/\n+$/, "") : String(e.body);
        const head = "===== 第 " + (total - i) + " 次 · " + e.time + " · 耗时 " + e.cost + "s =====";
        parts.push(head + "\n" + bodyText);
    }
    return parts.join("\n\n") + "\n";
}
