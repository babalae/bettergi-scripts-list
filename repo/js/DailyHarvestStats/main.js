// ============================================================================
// 每日收获统计 DailyHarvestStats（两阶段：采集前记起点 / 采集后结算）
//
// 只统计「采集脚本运行期间」的收获：采集前读一次起点，采集后读一次终点，
// 收获 = 终点 − 起点。中间你手动花费/分解狗粮的部分天然被排除。
// 负收获（采集只会增，出现负值=读数异常）不计入。
//
// 结构：顶部纯逻辑（不引用 BGI 全局，可 Node 单测）；底部 IIFE 负责测量/持久化。
// ============================================================================

// ---------- 纯逻辑（可单元测试） ----------

// 原神「服务日」编号：当天 04:00 之前算前一服务日。本地时间回退 4h 取年月日，时区正确。
function serviceDay(tsMs) {
    let d = new Date(tsMs - 4 * 3600 * 1000);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// OCR 文本清洗成整数；失败返回 null（绝不返回 0）。
function cleanNumber(text) {
    if (text == null) return null;
    const digits = String(text).replace(/[^\d]/g, '');
    if (!digits) return null;
    const n = parseInt(digits, 10);
    return Number.isNaN(n) ? null : n;
}

function formatExp(num) {
    if (num == null) return '--';
    let neg = num < 0 ? '-' : '', a = Math.abs(num);
    if (a >= 10000) return neg + (Math.round(a / 1000) / 10) + '万'; // 保留1位小数，如 74.7万
    return neg + a;
}
function formatMora(num) { return num == null ? '--' : num.toLocaleString('en-US'); }

const METRICS = ['mora', 'fodderExp']; // 窗口关键指标（任一异常→整窗跳过）；原石为软指标，单独处理、绝不拖累整窗

function freshState() {
    return { schema: 5, session: { open: false, ts: 0, mora: null, fodderExp: null, primogem: null },
        totalMora: 0, totalFodder: 0, totalPrimogem: 0,
        // 全时计数器（不受 records 的近 90 天上限影响）：totalDays=去重采集天数，dayCounts=各指标真正测得的天数
        totalDays: 0, dayCounts: { mora: 0, fodderExp: 0, primogem: 0 },
        firstTs: null, records: [] };
}
function cloneState(s) { return JSON.parse(JSON.stringify(s)); }

// 把旧存档升级到 schema 5：补全时计数器。脚本刚发布、目前无人超 90 天，故从可见记录推导即精确；
// 此后所有计数都按天累加、不再受 records 截断影响。幂等、可对 null 调用。
function migrate(state) {
    if (!state) return freshState();
    const s = cloneState(state); // 始终返回克隆，绝不改动入参（computeStart/End/Report 都依赖此点）
    if (s.schema >= 5 && s.dayCounts && typeof s.totalDays === 'number') return s;
    const recs = s.records || [];
    if (typeof s.totalMora !== 'number') s.totalMora = 0;
    if (typeof s.totalFodder !== 'number') s.totalFodder = 0;
    if (typeof s.totalPrimogem !== 'number') s.totalPrimogem = 0;
    function cnt(field) { let d = 0; for (let i = 0; i < recs.length; i++) if (typeof recs[i][field] === 'number') d++; return d; }
    s.dayCounts = { mora: cnt('moraGain'), fodderExp: cnt('fodderGain'), primogem: cnt('primogemGain') };
    s.totalDays = recs.length;
    s.records = recs;
    s.schema = 5;
    return s;
}

function weekKey(dayKey) { return Math.floor((dayKey + 3) / 7); }      // 按「周一」对齐分桶（epoch 是周四，+3 让周一成为桶首；契合原神周一 04:00 周常重置）
function monthKey(ts) { let d = new Date(ts); return d.getFullYear() * 12 + d.getMonth(); }

// 连续采集天数：从最近一条往前数 dayKey 连续(相差1)的天数
function computeStreak(records) {
    if (!records || !records.length) return 0;
    let s = 1;
    for (let i = records.length - 1; i > 0; i--) {
        if (records[i].dayKey - records[i - 1].dayKey === 1) s++; else break;
    }
    return s;
}

// 【采集前】记录起点，打开本次采集窗口。
// cur[k]: number=读到 / null=启用但失败 / undefined=未统计该项。
function computeStart(prev, cur, nowTs) {
    if (cur.mora === null || cur.fodderExp === null)
        return { action: 'skip', reason: 'measure-fail', state: prev || freshState() };
    const state = migrate(prev); // 克隆并升级到 schema 5（补全时计数器）
    state.session = {
        open: true, ts: nowTs,
        mora: (typeof cur.mora === 'number') ? cur.mora : null,
        fodderExp: (typeof cur.fodderExp === 'number') ? cur.fodderExp : null,
        primogem: (typeof cur.primogem === 'number') ? cur.primogem : null // 软指标，失败不阻止 start
    };
    return { action: 'start', state: state };
}

// 【采集后】结算：收获 = 终点 − 起点；摩拉/狗粮负收获/超限→整窗不计；原石为软指标单独处理。
// 返回 action: 'no-start' | 'skip'(reason) | 'end'
function computeEnd(prev, cur, nowTs, opts) {
    opts = opts || {};
    const max = opts.moraSanityMax || 50000000;
    const pgMax = opts.primogemSanityMax || 100000;
    if (!prev || !prev.session || !prev.session.open)
        return { action: 'no-start', state: prev || freshState() };

    const state = migrate(prev); // 克隆并升级到 schema 5
    state.session.open = false; // 无论结果如何，关闭本窗口

    if (cur.mora === null || cur.fodderExp === null)
        return { action: 'skip', reason: 'measure-fail', state: state };

    const start = prev.session;
    const gains = {};
    for (let i = 0; i < METRICS.length; i++) {
        let k = METRICS[i];
        gains[k] = (typeof cur[k] === 'number' && typeof start[k] === 'number') ? (cur[k] - start[k]) : null;
    }
    for (let j = 0; j < METRICS.length; j++) {
        const g = gains[METRICS[j]];
        if (g != null && (g < 0 || Math.abs(g) > max))
            return { action: 'skip', reason: 'abnormal', state: state, badMetric: METRICS[j], badValue: g };
    }

    const mg = gains.mora != null ? gains.mora : 0;
    const fg = gains.fodderExp != null ? gains.fodderExp : 0;
    // 原石（软指标）：仅在「本窗真正测得有效值」时才计；未测得/异常 → 不写该天字段、不累加。
    // 关键约定：记录里「有没有这个字段」== 那天到底统计没统计这个指标。后加入的指标在旧天数里没有该字段，
    // 因此不会被当成「0 的有效一天」拉低日均（分母见 computeReport 的 dayCount）。今后新增物品指标一律照此办理。
    let pg = 0, pgMeasured = false;
    if (typeof cur.primogem === 'number' && typeof start.primogem === 'number') {
        let p = cur.primogem - start.primogem;
        if (p >= 0 && p <= pgMax) { pg = p; pgMeasured = true; }
    }
    state.totalMora += mg; state.totalFodder += fg;
    if (pgMeasured) state.totalPrimogem += pg;
    const curDay = serviceDay(nowTs);
    const recs = state.records;
    const last = (recs.length && recs[recs.length - 1].dayKey === curDay) ? recs[recs.length - 1] : null;
    const rec = last || { dayKey: curDay, ts: nowTs };
    if (!last) { recs.push(rec); state.totalDays += 1; if (state.firstTs == null) state.firstTs = nowTs; }
    rec.ts = nowTs;
    // 各指标按天计数：仅在该指标当天「首次」写入记录时 +1（同日多窗合并不重复计数；缺字段=那天没统计该指标）
    if (!('moraGain' in rec)) state.dayCounts.mora += 1;
    rec.moraGain = (rec.moraGain || 0) + mg;
    if (!('fodderGain' in rec)) state.dayCounts.fodderExp += 1;
    rec.fodderGain = (rec.fodderGain || 0) + fg;
    if (pgMeasured) {
        if (!('primogemGain' in rec)) state.dayCounts.primogem += 1;
        rec.primogemGain = (rec.primogemGain || 0) + pg;
    }
    state.records = recs; // 保留全部历史（每个服务日至多 1 条、体量极小）；累计/天数另由全时计数器维护
    state.schema = 5;
    return { action: 'end', state: state, moraGain: mg, fodderGain: fg, primogemGain: pg };
}

// 报告：累计/日均/今天 + 原石 + 连续天数 + 本周/本月 + 今天vs昨天 + 周环比。
function computeReport(state, nowTs) {
    const out = { days: 0, mora: null, fodder: null, primogem: null, today: { mora: 0, fodder: 0, primogem: 0 },
        streak: 0, week: null, month: null, dod: null, wow: null };
    state = migrate(state);
    const recs = state.records;
    if (!recs.length) return out;
    // 日均按「全时计数器」算：累计 ÷ 该指标真正测得的天数（dayCounts），与总采集天数（totalDays）一样
    // 不受 records 近 90 天上限影响。后加入的指标在旧天数里没测过，其 dayCounts 不含那些天，自然不被「0」拉低。
    out.days = state.totalDays;
    const dc = state.dayCounts;
    if (dc.mora > 0) out.mora = { total: state.totalMora, avg: Math.round(state.totalMora / dc.mora), days: dc.mora };
    if (dc.fodderExp > 0) out.fodder = { total: state.totalFodder, avg: Math.round(state.totalFodder / dc.fodderExp), days: dc.fodderExp };
    if (dc.primogem > 0) out.primogem = { total: state.totalPrimogem, avg: Math.round(state.totalPrimogem / dc.primogem), days: dc.primogem };
    const curDay = serviceDay(nowTs);
    const last = recs[recs.length - 1];
    if (last && last.dayKey === curDay) {
        out.today.mora = last.moraGain; out.today.fodder = last.fodderGain; out.today.primogem = last.primogemGain || 0;
    }
    out.streak = computeStreak(recs);
    const cw = weekKey(curDay), cm = monthKey(nowTs);
    function agg(fn) {
        let m = 0, f = 0, p = 0, d = 0;
        for (let i = 0; i < recs.length; i++) if (fn(recs[i])) { m += recs[i].moraGain; f += recs[i].fodderGain; p += (recs[i].primogemGain || 0); d++; }
        return d ? { moraTotal: m, fodderTotal: f, primogemTotal: p, days: d, moraAvg: Math.round(m / d), fodderAvg: Math.round(f / d) } : null;
    }
    out.week = agg(function (r) { return weekKey(r.dayKey) === cw; });
    out.month = agg(function (r) { return monthKey(r.ts) === cm; });
    let ytd = null;
    for (let y = 0; y < recs.length; y++) if (recs[y].dayKey === curDay - 1) ytd = recs[y];
    if (last && last.dayKey === curDay && ytd && ytd.moraGain) out.dod = (last.moraGain - ytd.moraGain) / ytd.moraGain * 100;
    const lw = agg(function (r) { return weekKey(r.dayKey) === cw - 1; });
    if (out.week && lw && lw.moraTotal) out.wow = (out.week.moraTotal - lw.moraTotal) / lw.moraTotal * 100;
    return out;
}

const HARVEST_CSS = `
:root{--bg:#14120d;--surface:#1c1a14;--surface-2:#231f17;--hover:#262218;--inset:#17150f;--tip-bg:#2a261c;--border:rgba(236,231,214,.08);--border-2:rgba(236,231,214,.14);--ink:#ece7da;--ink-2:#a7a08d;--ink-3:#736c5b;--gold:#e2bd6b;--gold-2:#caa44f;--gold-ink:#e6c578;--green:#9bae7e;--green-2:#7e9263;--primo:#8ab4e0;--up:#9bae7e;--down:#8a8170;--gold-soft:rgba(226,189,107,.10);--seg-ink:#14120d;--radius:12px;--ease:cubic-bezier(.2,.7,.3,1)}
body[data-theme="teal"]{--bg:#0f1c1b;--surface:#163029;--surface-2:#1b3a32;--hover:#204239;--inset:#0e1a19;--tip-bg:#1c3a33;--border:rgba(200,230,220,.08);--border-2:rgba(200,230,220,.16);--ink:#e9f0ea;--ink-2:#9fb4ac;--ink-3:#6e837b;--gold:#e7c477;--gold-2:#cda855;--gold-ink:#edcb82;--green:#7fcaa2;--green-2:#63a982;--primo:#86c5e0;--up:#7fcaa2;--down:#7e938a;--gold-soft:rgba(231,196,119,.10);--seg-ink:#0f1c1b}
body[data-theme="parchment"]{--bg:#ece2cd;--surface:#fbf6ea;--surface-2:#fffdf7;--hover:#f4ecd9;--inset:#ece3d0;--tip-bg:#fffdf7;--border:rgba(120,95,45,.16);--border-2:rgba(120,95,45,.28);--ink:#352d20;--ink-2:#6e6147;--ink-3:#988a6e;--gold:#9a7416;--gold-2:#7e5d0d;--gold-ink:#7e5d0d;--green:#3f6b29;--green-2:#2f5320;--primo:#2f6090;--up:#3f6b29;--down:#988a6e;--gold-soft:rgba(154,116,22,.12);--seg-ink:#fffdf7}
*{box-sizing:border-box;margin:0;padding:0}html{-webkit-text-size-adjust:100%}
body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;line-height:1.5;font-variant-numeric:tabular-nums lining-nums;-webkit-font-smoothing:antialiased;padding:clamp(14px,2.6vw,28px);transition:background .25s,color .25s}
.num{font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.012em}
.app{max-width:1080px;margin:0 auto}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid var(--border)}
.brand{font-size:17px;font-weight:700;letter-spacing:.2px}.brand .dot{color:var(--gold-ink)}
.tb-right{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.tb-right .meta{font-size:12px;color:var(--ink-3)}.tb-right .meta b{color:var(--ink-2);font-weight:500}
.themes{display:inline-flex;gap:6px}.themes button{width:22px;height:22px;border-radius:50%;border:1px solid var(--border-2);cursor:pointer;padding:0;transition:transform .15s}.themes button:hover{transform:scale(1.12)}.themes button[aria-pressed="true"]{box-shadow:0 0 0 2px var(--gold)}.themes button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.sw-dark{background:linear-gradient(135deg,#2a2418,#e2bd6b)}.sw-teal{background:linear-gradient(135deg,#163029,#e7c477)}.sw-parch{background:linear-gradient(135deg,#ece2cd,#9a7416)}
.block{margin-bottom:26px}.block-head{font-size:12.5px;color:var(--ink-3);margin-bottom:12px}.block-head b{color:var(--ink-2);font-weight:600}
.empty{text-align:center;color:var(--ink-3);padding:64px 20px;font-size:14px}
.layout{display:grid;grid-template-columns:minmax(290px,330px) 1fr;gap:16px;align-items:start}
.rail{display:flex;flex-direction:column;gap:12px;position:sticky;top:18px}
.ns{position:relative;background:linear-gradient(165deg,var(--gold-soft),var(--surface) 62%);border:1px solid var(--border-2);border-radius:var(--radius);padding:20px}
.ns-cap{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:14px;letter-spacing:.3px}.ns-cap .sw{width:7px;height:7px;border-radius:50%;background:var(--gold)}
.ns-label{font-size:11.5px;color:var(--ink-3);margin-bottom:4px}.ns-num{font-size:clamp(30px,4.6vw,40px);font-weight:800;color:var(--gold-ink);line-height:1}.ns-sub{font-size:11.5px;color:var(--ink-3);margin-top:6px}
.ns-row{display:flex;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}.ns-row>div{flex:1}.ns-row span{display:block;font-size:11px;color:var(--ink-3)}.ns-row b{display:block;font-size:15px;font-weight:700;margin-top:2px}
.sec{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px}.sec-cap{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:8px}.sec-cap .sw{width:7px;height:7px;border-radius:50%;background:var(--green)}
.sec-num{font-size:24px;font-weight:800;color:var(--green);line-height:1}.sec-p .sec-num{color:var(--primo)}.sec-row{display:flex;gap:16px;margin-top:9px;font-size:12px;color:var(--ink-3)}.sec-row b{color:var(--ink-2);font-weight:600}.sec-row .basis{font-style:normal;font-weight:400;font-size:11px;color:var(--ink-3);opacity:.8;margin-left:2px}
.facts{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:6px 20px}.fact{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid var(--border)}.fact:last-child{border-bottom:none}.fact span{font-size:12.5px;color:var(--ink-3)}.fact b{font-size:14px;font-weight:700}.fact b.up{color:var(--up)}.fact b.down{color:var(--down)}.fact b.gold{color:var(--gold-ink)}.fact b em{font-style:normal;color:var(--ink-3);font-weight:500;font-size:11.5px;margin-left:5px}.facts-cap{font-size:11px;font-weight:600;color:var(--ink-3);letter-spacing:.4px;padding:9px 0 3px}
.pager{display:flex;align-items:center;justify-content:center;gap:14px;padding:13px 12px 4px;border-top:1px solid var(--border);margin-top:4px}.pager:empty{display:none}.pager button{font:inherit;font-size:12px;color:var(--ink-2);background:var(--inset);border:1px solid var(--border);border-radius:8px;padding:5px 13px;cursor:pointer;transition:color .15s,border-color .15s}.pager button:hover:not(:disabled){color:var(--ink);border-color:var(--gold)}.pager button:disabled{opacity:.38;cursor:default}.pager .pinfo{font-size:12px;color:var(--ink-3)}
.main{display:flex;flex-direction:column;gap:16px;min-width:0}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);transition:border-color .2s}.panel:hover{border-color:var(--border-2)}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 20px 0}.panel-head h2{font-size:13.5px;font-weight:700}.panel-head .hint{font-size:11.5px;color:var(--ink-3)}
.seg{display:inline-flex;background:var(--inset);border:1px solid var(--border);border-radius:999px;padding:3px}.seg-btn{font:inherit;font-size:12px;font-weight:600;color:var(--ink-2);background:none;border:none;padding:5px 14px;border-radius:999px;cursor:pointer;transition:all .18s var(--ease)}.seg-btn:hover{color:var(--ink)}.seg-btn.active{color:var(--seg-ink);background:var(--gold)}.seg-btn.active.food{background:var(--green)}.seg-btn.active.primo{background:var(--primo)}.seg-btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}.seg-btn:active{transform:translateY(1px)}
.panel-head .ctrls{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.seg.range .seg-btn{padding:5px 11px}.seg.range .seg-btn.active{background:var(--ink-3);color:var(--surface)}
.chart{padding:6px 14px 8px;position:relative}.chart-svg{width:100%;height:auto;display:block;overflow:visible}.chart-svg .axis{fill:var(--ink-3);font-size:10px;font-weight:500}.chart-svg .xlab{fill:var(--ink-3);font-size:10px}.chart-svg .pt{cursor:pointer;transition:r .12s var(--ease)}.chart-svg .pt.hl{r:5.5}
table{width:100%;border-collapse:collapse;margin-top:8px}thead th{font-size:11.5px;font-weight:600;color:var(--ink-3);letter-spacing:.2px;text-align:left;padding:10px 20px;cursor:pointer;user-select:none;border-bottom:1px solid var(--border);transition:color .15s;white-space:nowrap}thead th:hover{color:var(--ink)}thead th:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}thead th.n{text-align:center}thead th .ar{opacity:0;font-size:9px;margin-left:4px}thead th.sorted .ar{opacity:.8}
tbody td{font-size:13.5px;padding:11px 20px;border-bottom:1px solid var(--border);white-space:nowrap}tbody tr:last-child td{border-bottom:none}tbody tr{transition:background .12s}tbody tr:hover,tbody tr.hl{background:var(--hover)}
.n{text-align:center}td.date{color:var(--ink-2);font-weight:600}td.mora{color:var(--gold-ink);font-weight:700}td.food{color:var(--green);font-weight:700}td.primo{color:var(--primo);font-weight:700}td.primo.na{color:var(--ink-3);font-weight:400;opacity:.6}td.delta{font-weight:700;color:var(--up)}td.delta.neg{color:var(--down)}
.tag{margin-left:8px;font-size:10px;font-weight:700;color:var(--gold-ink);background:var(--gold-soft);padding:1px 7px;border-radius:5px}tbody tr.peak{box-shadow:inset 2px 0 0 var(--gold)}
.tooltip{position:fixed;z-index:20;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .12s,transform .12s;background:var(--tip-bg);border:1px solid var(--border-2);border-radius:8px;padding:7px 11px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.4);white-space:nowrap;color:var(--ink)}.tooltip.show{opacity:1;transform:none}.tooltip .t-date{color:var(--ink-3);font-size:11px;margin-bottom:2px}.tooltip .t-val{font-weight:700}
footer{margin-top:20px;text-align:center;font-size:11.5px;color:var(--ink-3);line-height:1.7}
@media (max-width:840px){.layout{grid-template-columns:1fr}.rail{position:static}}
@media (max-width:560px){thead th,tbody td{padding:10px 14px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const HARVEST_JS = `(function(){"use strict";
const tip=document.getElementById("tip");
function cssVar(n){return getComputedStyle(document.body).getPropertyValue(n).trim();}
function fmt(n){return n.toLocaleString("en-US");}
function moveTip(e){tip.style.left=Math.min(e.clientX+14,window.innerWidth-170)+"px";tip.style.top=(e.clientY+14)+"px";}
const blocks=[];
Array.prototype.forEach.call(document.querySelectorAll(".block"),function(blk){blocks.push(initBlock(blk));});
function initBlock(blk){
 const data=REPORTS[+blk.getAttribute("data-idx")];if(!data)return{render:function(){}};
 const chartEl=blk.querySelector(".chart"),tbody=blk.querySelector("tbody"),segMetric=blk.querySelector(".seg.metric"),segRange=blk.querySelector(".seg.range");
 let curMetric="mora",curRange=30,sortKey="idx",sortAsc=false,page=0,PAGE=12,pager=blk.querySelector(".pager");
 function val(p,m){return m==="mora"?p.m:m==="food"?p.f:p.p;}
 function buildChart(metric){
  const full=data.series,total=full.length;if(!total){chartEl.innerHTML="";return;}
  const start=curRange>0?Math.max(0,total-curRange):0,s=full.slice(start),n=s.length; // 按所选范围截取，data-i 用原始下标以便与明细表联动
  const vals=s.map(function(p){return val(p,metric);}),avg=metric==="mora"?data.avg.mora:metric==="food"?data.avg.food:data.avg.primogem;
  const min=Math.min.apply(null,vals),max=Math.max.apply(null,vals),range=(max-min)||(max||1);
  let lo=Math.min(min-range*0.5,avg-range*0.2),hi=Math.max(max+range*0.5,avg+range*0.2);if(hi<=lo)hi=lo+1;
  const W=640,H=210,padL=12,padR=14,padT=16,padB=30,pw=W-padL-padR,ph=H-padT-padB;
  const X=function(i){return padL+(n===1?pw/2:i*pw/(n-1));},Y=function(v){return padT+(1-(v-lo)/(hi-lo))*ph;};
  const c=metric==="mora"?cssVar("--gold"):metric==="food"?cssVar("--green"):cssVar("--primo"),surf=cssVar("--surface");
  const lp=s.map(function(p,i){return X(i).toFixed(1)+","+Y(val(p,metric)).toFixed(1);});
  const line="M"+lp.join(" L"),area="M"+X(0).toFixed(1)+","+(padT+ph)+" L"+lp.join(" L")+" L"+X(n-1).toFixed(1)+","+(padT+ph)+" Z";
  const ay=Y(avg).toFixed(1),gid="g"+blk.getAttribute("data-idx")+metric,dots=n<=60,lblEvery=Math.max(1,Math.ceil(n/8)); // 点多(>60)只画线、X轴标签取约8个，避免拥挤
  let svg='<svg viewBox="0 0 '+W+' '+H+'" class="chart-svg" role="img" aria-label="每日趋势">';
  svg+='<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c+'" stop-opacity=".16"></stop><stop offset="1" stop-color="'+c+'" stop-opacity="0"></stop></linearGradient></defs>';
  svg+='<line x1="'+padL+'" y1="'+ay+'" x2="'+(W-padR)+'" y2="'+ay+'" stroke="'+c+'" stroke-opacity=".3" stroke-width="1" stroke-dasharray="4 4"></line>';
  svg+='<text class="axis" x="'+(W-padR)+'" y="'+(ay-5)+'" text-anchor="end">日均 '+fmt(avg)+'</text>';
  svg+='<path d="'+area+'" fill="url(#'+gid+')"></path><path d="'+line+'" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>';
  s.forEach(function(p,i){const cx=X(i).toFixed(1),cy=Y(val(p,metric)).toFixed(1);
   if(dots)svg+='<circle class="pt" data-i="'+(start+i)+'" cx="'+cx+'" cy="'+cy+'" r="3.2" fill="'+surf+'" stroke="'+c+'" stroke-width="2"></circle>';
   if(i%lblEvery===0||i===n-1)svg+='<text class="xlab" x="'+cx+'" y="'+(H-9)+'" text-anchor="middle">'+p.d+'</text>';});
  svg+='</svg>';chartEl.innerHTML=svg;
  if(dots)Array.prototype.forEach.call(chartEl.querySelectorAll(".pt"),function(pt){const i=+pt.getAttribute("data-i");
   pt.addEventListener("mouseenter",function(){hoverIn(i,metric);});pt.addEventListener("mousemove",moveTip);pt.addEventListener("mouseleave",function(){hoverOut(i);});});
 }
 function hoverIn(i,metric){const p=data.series[i],col=metric==="mora"?cssVar("--gold-ink"):metric==="food"?cssVar("--green"):cssVar("--primo");
  tip.innerHTML='<div class="t-date">'+p.d+(i===data.series.length-1?" · 最新":"")+'</div><div class="t-val" style="color:'+col+'">'+fmt(val(p,metric))+'</div>';tip.classList.add("show");
  const pt=chartEl.querySelector('.pt[data-i="'+i+'"]');if(pt)pt.classList.add("hl");const tr=tbody.querySelector('tr[data-i="'+i+'"]');if(tr)tr.classList.add("hl");}
 function hoverOut(i){tip.classList.remove("show");const pt=chartEl.querySelector('.pt[data-i="'+i+'"]');if(pt)pt.classList.remove("hl");const tr=tbody.querySelector('tr[data-i="'+i+'"]');if(tr)tr.classList.remove("hl");}
 Array.prototype.forEach.call(tbody.querySelectorAll("tr"),function(tr){const i=+tr.getAttribute("data-i");
  tr.addEventListener("mouseenter",function(){const pt=chartEl.querySelector('.pt[data-i="'+i+'"]');if(pt)pt.classList.add("hl");});
  tr.addEventListener("mouseleave",function(){const pt=chartEl.querySelector('.pt[data-i="'+i+'"]');if(pt)pt.classList.remove("hl");});});
 function sortRows(){const trs=Array.prototype.slice.call(tbody.querySelectorAll("tr"));
  trs.sort(function(a,b){let va,vb;if(sortKey==="idx"){va=+a.getAttribute("data-i");vb=+b.getAttribute("data-i");}else{va=parseFloat(a.getAttribute("data-"+sortKey));vb=parseFloat(b.getAttribute("data-"+sortKey));}return sortAsc?va-vb:vb-va;});
  trs.forEach(function(tr){tbody.appendChild(tr);});
  Array.prototype.forEach.call(blk.querySelectorAll("thead th"),function(th){th.classList.toggle("sorted",th.getAttribute("data-key")===sortKey);const ar=th.querySelector(".ar");if(ar)ar.textContent=sortAsc?"▴":"▾";});page=0;paginate();}
 function paginate(){const trs=tbody.querySelectorAll("tr"),N=trs.length,pages=Math.ceil(N/PAGE)||1;if(page>=pages)page=pages-1;if(page<0)page=0;
  Array.prototype.forEach.call(trs,function(tr,i){tr.style.display=(i>=page*PAGE&&i<(page+1)*PAGE)?"":"none";});
  if(!pager)return;if(N<=PAGE){pager.innerHTML="";return;}
  pager.innerHTML='<button class="pp"'+(page===0?" disabled":"")+'>‹ 上一页</button><span class="pinfo">第 '+(page+1)+' / '+pages+' 页 · 共 '+N+' 天</span><button class="pn"'+(page>=pages-1?" disabled":"")+'>下一页 ›</button>';
  const pp=pager.querySelector(".pp"),pn=pager.querySelector(".pn");
  if(pp)pp.addEventListener("click",function(){if(page>0){page--;paginate();}});
  if(pn)pn.addEventListener("click",function(){if(page<pages-1){page++;paginate();}});}
 Array.prototype.forEach.call(blk.querySelectorAll("thead th"),function(th){const k=th.getAttribute("data-key");
  function go(){if(sortKey===k){sortAsc=!sortAsc;}else{sortKey=k;sortAsc=false;}sortRows();}
  th.addEventListener("click",go);th.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});});
 segMetric.addEventListener("click",function(e){const b=e.target.closest(".seg-btn");if(!b)return;const m=b.getAttribute("data-metric");if(m===curMetric)return;curMetric=m;
  Array.prototype.forEach.call(segMetric.querySelectorAll(".seg-btn"),function(x){x.classList.toggle("active",x===b);});buildChart(curMetric);});
 if(segRange)segRange.addEventListener("click",function(e){const b=e.target.closest(".seg-btn");if(!b)return;const r=+b.getAttribute("data-range");if(r===curRange)return;curRange=r;
  Array.prototype.forEach.call(segRange.querySelectorAll(".seg-btn"),function(x){x.classList.toggle("active",x===b);});buildChart(curMetric);});
 buildChart(curMetric);paginate();
 return{render:function(){buildChart(curMetric);}};
}
const themes=document.querySelector(".themes");
if(themes)themes.addEventListener("click",function(e){const b=e.target.closest("button");if(!b)return;
 document.body.setAttribute("data-theme",b.getAttribute("data-theme"));
 Array.prototype.forEach.call(this.querySelectorAll("button"),function(x){x.setAttribute("aria-pressed",x===b?"true":"false");});
 blocks.forEach(function(bl){bl.render();});});
})();`;

// 生成网页报告（纯函数：服务端渲染数字/表格，客户端 JS 仅画图表+交互；可 Node 测试）。
// 主题：暖金墨(深)默认，另带深青/羊皮纸两套，右上角圆点切换。
function buildHtmlReport(store, nowTs) {
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmt(n) { return (n == null) ? '--' : Math.round(n).toLocaleString('en-US'); }
    function wan(n) { if (n == null) return ''; let a = Math.abs(n); return a >= 10000 ? ('约 ' + (Math.round(a / 1000) / 10) + ' 万') : (a + ''); }
    function md(dayKey) { const d = new Date(dayKey * 86400000); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); } // 按服务日(dayKey)标日期，与 04:00 重置一致；不用 ts 以免跨午夜错位
    function pct(v) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1) + '%'; }

    let blocks = '', reportsJs = [], keys = Object.keys(store), bi = 0;
    for (let ki = 0; ki < keys.length; ki++) {
        const st = store[keys[ki]];
        if (!st || !st.records || !st.records.length) continue;
        const rep = computeReport(st, nowTs);
        const recs = st.records, idx = bi;
        // 衍生统计
        let peakM = -1, peakDate = '';
        for (let pi = 0; pi < recs.length; pi++) { if (recs[pi].moraGain > peakM) { peakM = recs[pi].moraGain; peakDate = md(recs[pi].dayKey); } }
        const tvAvg = (rep.mora && rep.mora.avg) ? (rep.today.mora - rep.mora.avg) / rep.mora.avg * 100 : 0;
        const ratio = (rep.fodder && rep.fodder.total > 0) ? ('≈ ' + Math.round((rep.mora ? rep.mora.total : 0) / rep.fodder.total) + ' : 1') : '—';
        const firstDate = st.firstTs ? new Date(st.firstTs).toLocaleDateString() : '—';
        const mTot = rep.mora ? rep.mora.total : 0, mToday = rep.today.mora, mAvg = rep.mora ? rep.mora.avg : 0;
        const fTot = rep.fodder ? rep.fodder.total : 0, fToday = rep.today.fodder, fAvg = rep.fodder ? rep.fodder.avg : 0;
        const hasP = !!rep.primogem;
        const pTot = hasP ? rep.primogem.total : 0, pToday = rep.today.primogem || 0, pAvg = hasP ? rep.primogem.avg : 0;
        const wk = rep.week, mo = rep.month;

        // 日均口径提示：仅当某指标「真正统计的天数」≠ 总采集天数时显示「· 按 N 天」（如后加入的原石），否则不显示
        const basis = function (m) { return (m && m.days && m.days !== rep.days) ? ' <em class="basis">· 按 ' + m.days + ' 天</em>' : ''; };

        // 侧栏
        const rail = '<aside class="rail">'
            + '<div class="ns"><div class="ns-cap"><span class="sw"></span>摩拉 · ' + esc(keys[ki]) + '</div>'
            + '<div class="ns-label">累计收获</div><div class="ns-num num">' + fmt(mTot) + '</div><div class="ns-sub">' + wan(mTot) + '</div>'
            + '<div class="ns-row"><div><span>今天</span><b class="num">' + fmt(mToday) + '</b></div><div><span>日均</span><b class="num">' + fmt(mAvg) + '</b></div></div></div>'
            + '<div class="sec"><div class="sec-cap"><span class="sw"></span>狗粮经验 · 累计</div><div class="sec-num num">' + fmt(fTot) + '</div>'
            + '<div class="sec-row"><span>今天 <b class="num">' + fmt(fToday) + '</b></span><span>日均 <b class="num">' + fmt(fAvg) + '</b>' + basis(rep.fodder) + '</span></div></div>'
            + (hasP ? ('<div class="sec sec-p"><div class="sec-cap"><span class="sw"></span>原石 · 累计</div><div class="sec-num num">' + fmt(pTot) + '</div>'
                + '<div class="sec-row"><span>今天 <b class="num">' + fmt(pToday) + '</b></span><span>日均 <b class="num">' + fmt(pAvg) + '</b>' + basis(rep.primogem) + '</span></div></div>') : '')
            + '<div class="facts">'
            + '<div class="fact"><span>连续采集</span><b class="gold num">' + rep.streak + ' <em>天</em></b></div>'
            + '<div class="fact"><span>总采集天数</span><b class="num">' + rep.days + ' <em>天</em></b></div>'
            + '<div class="fact"><span>峰值单日 · 摩拉</span><b class="gold num">' + fmt(peakM) + ' <em>' + peakDate + '</em></b></div>'
            + '<div class="fact"><span>今天 vs 日均</span><b class="' + (tvAvg < 0 ? 'down' : 'up') + ' num">' + pct(tvAvg) + '</b></div>'
            + (rep.dod != null ? ('<div class="fact"><span>今天 vs 昨天</span><b class="' + (rep.dod < 0 ? 'down' : 'up') + ' num">' + pct(rep.dod) + '</b></div>') : '')
            + '<div class="fact"><span>摩拉 : 狗粮经验</span><b class="num">' + ratio + '</b></div></div>'
            + '<div class="facts"><div class="facts-cap">周期汇总 · 摩拉</div>'
            + '<div class="fact"><span>本周</span><b class="num">' + (wk ? fmt(wk.moraTotal) : '—') + (wk ? ' <em>日均 ' + fmt(wk.moraAvg) + '</em>' : '') + '</b></div>'
            + (rep.wow != null ? ('<div class="fact"><span>本周 vs 上周</span><b class="' + (rep.wow < 0 ? 'down' : 'up') + ' num">' + pct(rep.wow) + '</b></div>') : '')
            + '<div class="fact"><span>本月</span><b class="num">' + (mo ? fmt(mo.moraTotal) : '—') + (mo ? ' <em>日均 ' + fmt(mo.moraAvg) + '</em>' : '') + '</b></div></div>'
            + '</aside>';

        // 明细表（最新在上）。原石列仅在有原石数据时出现；上线前的旧天数显示「—」而非 0（与日均口径一致）
        let rows = '';
        for (let r2 = recs.length - 1; r2 >= 0; r2--) {
            const rr = recs[r2], dv = (mAvg ? (rr.moraGain - mAvg) / mAvg * 100 : 0), isPk = rr.moraGain === peakM;
            const hasPg = typeof rr.primogemGain === 'number';
            const pCell = hasP ? ('<td class="n primo' + (hasPg ? '' : ' na') + '">' + (hasPg ? fmt(rr.primogemGain) : '—') + '</td>') : '';
            const pAttr = hasP ? (' data-p="' + (hasPg ? rr.primogemGain : -1) + '"') : '';
            rows += '<tr data-i="' + r2 + '" data-m="' + rr.moraGain + '" data-f="' + rr.fodderGain + '"' + pAttr + ' data-d="' + dv.toFixed(2) + '"' + (isPk ? ' class="peak"' : '') + '>'
                + '<td class="date">' + md(rr.dayKey) + (isPk ? '<span class="tag">峰值</span>' : '') + '</td>'
                + '<td class="n mora">' + fmt(rr.moraGain) + '</td><td class="n food">' + fmt(rr.fodderGain) + '</td>'
                + pCell
                + '<td class="n delta' + (dv < 0 ? ' neg' : '') + '">' + pct(dv) + '</td></tr>';
        }
        const main = '<main class="main">'
            + '<section class="panel"><div class="panel-head"><h2>每日趋势</h2><div class="ctrls"><div class="seg range"><button class="seg-btn" data-range="7">7天</button><button class="seg-btn active" data-range="30">30天</button><button class="seg-btn" data-range="180">180天</button><button class="seg-btn" data-range="0">全部</button></div><div class="seg metric"><button class="seg-btn active" data-metric="mora">摩拉</button><button class="seg-btn food" data-metric="food">狗粮经验</button>' + (hasP ? '<button class="seg-btn primo" data-metric="primogem">原石</button>' : '') + '</div></div></div><div class="chart"></div></section>'
            + '<section class="panel"><div class="panel-head"><h2>每日明细</h2><span class="hint">点击表头排序</span></div>'
            + '<table><thead><tr><th data-key="idx" tabindex="0" class="sorted">日期<span class="ar">▾</span></th><th data-key="m" tabindex="0" class="n">当天摩拉<span class="ar">▾</span></th><th data-key="f" tabindex="0" class="n">当天狗粮经验<span class="ar">▾</span></th>' + (hasP ? '<th data-key="p" tabindex="0" class="n">当天原石<span class="ar">▾</span></th>' : '') + '<th data-key="d" tabindex="0" class="n">较日均<span class="ar">▾</span></th></tr></thead><tbody>' + rows + '</tbody></table><div class="pager"></div></section></main>';

        blocks += '<div class="block" data-idx="' + idx + '"><div class="block-head">账户 <b>' + esc(keys[ki]) + '</b> · 起算 ' + esc(firstDate) + ' · ' + rep.days + ' 个采集日</div><div class="layout">' + rail + main + '</div></div>';

        const sj = [];
        for (let sj2 = 0; sj2 < recs.length; sj2++) sj.push('{d:"' + md(recs[sj2].dayKey) + '",m:' + recs[sj2].moraGain + ',f:' + recs[sj2].fodderGain + ',p:' + (recs[sj2].primogemGain || 0) + '}');
        reportsJs.push('{avg:{mora:' + mAvg + ',food:' + fAvg + ',primogem:' + pAvg + '},hasP:' + (hasP ? 'true' : 'false') + ',series:[' + sj.join(',') + ']}');
        bi++;
    }
    if (bi === 0) blocks = '<div class="empty">还没有统计数据。请先完整跑一轮「采集前 → 采集后」。</div>';

    const updated = new Date(nowTs).toLocaleString();
    const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>每日收获统计</title><style>'
        + HARVEST_CSS + '</style></head><body data-theme="dark"><div class="app">'
        + '<div class="topbar"><div class="brand">每日<span class="dot">收获</span>统计</div><div class="tb-right"><div class="meta">更新于 <b>' + esc(updated) + '</b></div>'
        + '<div class="themes" role="group" aria-label="主题"><button class="sw-dark" data-theme="dark" aria-pressed="true" title="暖金墨"></button><button class="sw-teal" data-theme="teal" aria-pressed="false" title="深青鎏金"></button><button class="sw-parch" data-theme="parchment" aria-pressed="false" title="羊皮纸金"></button></div></div></div>'
        + blocks
        + '<footer>数据来自本地统计，仅供参考 · 摩拉以原值计、狗粮经验为折算可用经验<br>本报告由「每日收获统计」脚本自动生成</footer>'
        + '</div><div class="tooltip" id="tip"></div>'
        + '<script>const REPORTS=[' + reportsJs.join(',') + '];' + HARVEST_JS + '</script></body></html>';
    return html;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        serviceDay: serviceDay, cleanNumber: cleanNumber, formatExp: formatExp, formatMora: formatMora,
        freshState: freshState, computeStart: computeStart, computeEnd: computeEnd, computeReport: computeReport,
        computeStreak: computeStreak, buildHtmlReport: buildHtmlReport, weekKey: weekKey
    };
}

// ---------- BGI 运行入口（Node 测试时 module 已定义，整段跳过） ----------
if (typeof module === 'undefined') (async function () {
    setGameMetrics(1920, 1080, 1);

    const profileId = (settings.profile_id != undefined ? String(settings.profile_id).trim() : '');
    const profileKey = profileId ? ('profile-' + profileId) : 'default-profile';
    const phase = settings.phase != undefined ? settings.phase : '采集后(结算)';
    const isStart = phase.indexOf('采集前') === 0;
    const countMora = (settings.countMora != undefined ? settings.countMora : '是') !== '否';
    const countFodder = (settings.countFodder != undefined ? settings.countFodder : '是') !== '否';
    const doReset = (settings.reset != undefined ? settings.reset : '否') === '是';
    const notify = (settings.notify != undefined ? settings.notify : '是') !== '否';

    const MAIN = 'local/harvest_stats.json';
    const BAK = 'local/harvest_stats.bak.json';

    if (!countMora && !countFodder) { log.warn('摩拉和狗粮经验都未启用，脚本结束。'); return; }

    const store = loadStore();
    if (doReset) { store[profileKey] = freshState(); saveStore(store); announce('🧹 已清空账户【' + profileKey + '】的统计，从本次重新开始。'); }
    const prev = store[profileKey] || null;

    await genshin.returnMainUi();
    const cur = { ts: Date.now() };
    if (countMora) { const v = await measureValuables(); cur.mora = v.mora; cur.primogem = v.primogem; } // 同一「贵重物品」页顺带读原石（软指标）
    cur.fodderExp = countFodder ? await measureFodderExp() : undefined;
    await genshin.returnMainUi();
    log.info('本次读数：摩拉=' + fmtRead(cur.mora) + '，原石=' + fmtRead(cur.primogem) + '，狗粮经验=' + fmtRead(cur.fodderExp));

    if (isStart) {
        // ===== 采集前：记起点 =====
        const rs = computeStart(prev, cur, cur.ts);
        if (rs.action === 'skip') { announce('⚠️ 采集前测量失败，未记录起点；本轮收获将无法结算。'); return; }
        store[profileKey] = rs.state;
        if (saveStore(store)) announce('▶️ 已记录采集起点（摩拉 ' + fmtMoney(cur.mora) + ' / 狗粮经验 ' + fmtFodder(cur.fodderExp) + '）。');
    } else {
        // ===== 采集后：结算 =====
        const re = computeEnd(prev, cur, cur.ts, {});
        if (re.action === 'no-start') { announce('⚠️ 未找到采集起点，请把「采集前」的统计任务排在采集任务之前先运行。本次未结算。'); return; }
        if (re.action === 'skip') {
            store[profileKey] = re.state; saveStore(store); // 关闭窗口状态也要落盘
            if (re.reason === 'abnormal') announce('⚠️ 检测到异常收获（' + re.badMetric + '=' + re.badValue + '，疑似读数错误或非采集变动），本段不计。');
            else announce('⚠️ 采集后测量失败，本段不计。');
            return;
        }
        store[profileKey] = re.state;
        if (!saveStore(store)) { announce('⚠️ 写盘校验失败，本段未记录（旧记录已保留在备份）。'); return; }
        const rpt = computeReport(re.state, cur.ts);
        report(rpt, re.state);
    }

    // ===================== 辅助 =====================
    function fmtRead(v) { return v === null ? '失败' : (v === undefined ? '未统计' : v); }
    function fmtMoney(v) { return (typeof v === 'number') ? formatMora(v) : '--'; }
    function fmtFodder(v) { return (typeof v === 'number') ? formatExp(v) : '--'; }

    function report(rpt, state) {
        const firstDate = state.firstTs ? new Date(state.firstTs).toLocaleDateString() : '--';
        let msg = '📊 每日收获统计 [账户: ' + profileKey + ']\n';
        msg += '⏱ 起算 ' + firstDate + '，已统计 ' + rpt.days + ' 个采集日 · 连续 ' + rpt.streak + ' 天\n';
        if (countMora && rpt.mora) msg += '── 摩拉 ──\n已累计 ' + formatMora(rpt.mora.total) + ' / 今天 ' + formatMora(rpt.today.mora) + ' / 日均 ' + formatMora(rpt.mora.avg) + '\n';
        if (countFodder && rpt.fodder) msg += '── 狗粮经验 ──\n已累计 ' + formatExp(rpt.fodder.total) + ' / 今天 ' + formatExp(rpt.today.fodder) + ' / 日均 ' + formatExp(rpt.fodder.avg) + '\n';
        if (countMora && rpt.primogem && rpt.primogem.total > 0) msg += '── 原石 ──\n已累计 ' + formatMora(rpt.primogem.total) + ' / 今天 ' + formatMora(rpt.today.primogem) + ' / 日均 ' + formatMora(rpt.primogem.avg) + '\n';
        if (rpt.week) { msg += '本周摩拉 ' + formatMora(rpt.week.moraTotal) + '（日均 ' + formatMora(rpt.week.moraAvg) + '）'; if (rpt.dod != null) msg += ' · 今天较昨天 ' + (rpt.dod < 0 ? '−' : '+') + Math.abs(rpt.dod).toFixed(1) + '%'; msg += '\n'; }
        announce(msg);
    }

    function announce(text) {
        log.info(text);
        if (notify) { try { if (typeof notification !== 'undefined' && notification.send) notification.send(text); } catch (e) { } }
    }

    function loadStore() {
        let raw = null;
        try { raw = file.readTextSync(MAIN); } catch (e) { raw = null; }
        if (raw) { try { return JSON.parse(raw); } catch (e) { log.warn('主记录损坏，尝试备份恢复'); } }
        try { let b = file.readTextSync(BAK); if (b) return JSON.parse(b); } catch (e) { }
        return {};
    }
    function saveStore(obj) {
        const json = JSON.stringify(obj);
        try { const old = file.readTextSync(MAIN); if (old) file.writeTextSync(BAK, old, false); } catch (e) { }
        try { file.writeTextSync(MAIN, json, false); } catch (e) { log.error('写盘失败：' + e); return false; }
        try { JSON.parse(file.readTextSync(MAIN)); } catch (e) { log.error('写盘回读校验失败：' + e); return false; }
        try { writeReadableReport(obj); } catch (e) { log.warn('生成 txt 报告失败：' + e); } // 方便小白阅读的 txt
        try { writeHtmlReport(obj); } catch (e) { log.warn('生成 html 报告失败：' + e); }   // 浏览器打开更直观
        return true;
    }

    // 生成方便小白阅读的报告 local/harvest_report.txt（json 是给程序用的）
    function writeReadableReport(store) {
        const L = [];
        L.push('========== 每日收获统计 ==========');
        L.push('（本报告方便小白阅读，会自动刷新；harvest_stats.json 是程序用的，请勿手动改）');
        const keys = Object.keys(store);
        for (let ki = 0; ki < keys.length; ki++) {
            const st = store[keys[ki]];
            if (!st || !st.records) continue;
            const rep = computeReport(st, Date.now());
            const firstDate = st.firstTs ? new Date(st.firstTs).toLocaleDateString() : '（尚无）';
            L.push('');
            L.push('【账户】' + keys[ki]);
            L.push('  起算 ' + firstDate + '，已统计 ' + rep.days + ' 个采集日（连续 ' + rep.streak + ' 天）');
            if (rep.mora) L.push('  摩拉：    累计 ' + formatMora(rep.mora.total) + '  |  今天 ' + formatMora(rep.today.mora) + '  |  日均 ' + formatMora(rep.mora.avg));
            if (rep.fodder) L.push('  狗粮经验：累计 ' + formatExp(rep.fodder.total) + '  |  今天 ' + formatExp(rep.today.fodder) + '  |  日均 ' + formatExp(rep.fodder.avg));
            if (rep.primogem && rep.primogem.total > 0) { const pb = (rep.primogem.days && rep.primogem.days !== rep.days) ? '（按 ' + rep.primogem.days + ' 天）' : ''; L.push('  原石：    累计 ' + formatMora(rep.primogem.total) + '  |  今天 ' + formatMora(rep.today.primogem) + '  |  日均 ' + formatMora(rep.primogem.avg) + pb); }
            if (rep.week) { let wl = '  本周：    摩拉 ' + formatMora(rep.week.moraTotal) + '（日均 ' + formatMora(rep.week.moraAvg) + '）'; if (rep.dod != null) wl += '  |  今天较昨天 ' + (rep.dod < 0 ? '−' : '+') + Math.abs(rep.dod).toFixed(1) + '%'; L.push(wl); }
            if (rep.month) L.push('  本月：    摩拉 ' + formatMora(rep.month.moraTotal) + '（日均 ' + formatMora(rep.month.moraAvg) + '）');
            const recs = st.records.slice(-10).reverse();
            if (recs.length) {
                L.push('  近期明细（最新在上）：');
                for (let ri = 0; ri < recs.length; ri++) {
                    let r = recs[ri], d = new Date(r.dayKey * 86400000);
                    let line = '    ' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '   摩拉 +' + formatMora(r.moraGain) + '   狗粮 +' + formatExp(r.fodderGain);
                    if (r.primogemGain) line += '   原石 +' + formatMora(r.primogemGain);
                    L.push(line);
                }
            }
        }
        L.push('');
        L.push('（更新于 ' + new Date().toLocaleString() + '）');
        file.writeTextSync('local/harvest_report.txt', L.join('\n'), false);
    }

    // 生成网页版报告 local/harvest_report.html（双击用浏览器打开，更直观；自包含、无外部依赖）
    function writeHtmlReport(store) {
        file.writeTextSync('local/harvest_report.html', buildHtmlReport(store, Date.now()), false);
    }

    // ===================== 摩拉测量（复刻 OcrFreeMora&Primogem：背包贵重物品页 + 模板数字） =====================
    // 在「贵重物品」页一次性读 摩拉 + 原石。返回 {mora, primogem}。
    // 摩拉读不到 → mora=null（关键指标，会触发整窗跳过）；原石读不到 → primogem=undefined（软指标，不影响）。
    // 连读取数兜底：同一画面连读多次，要求「连续 2 次完全一致」才采信；中间不一致就重读，
    // 始终凑不齐就返回 -1（判为读数失败 → 跳过本窗，绝不把一次性误读写进统计，例如 1148万/114万 这种立刻被否）。
    async function readStable(label, reader) {
        let prev = null, agree = 0;
        for (let i = 0; i < 6; i++) {
            const v = await reader();
            if (v >= 0 && v === prev) { agree++; if (agree >= 2) return v; }
            else { agree = v >= 0 ? 1 : 0; prev = v >= 0 ? v : null; }
            await sleep(150);
        }
        log.warn(label + '：多次读数对不上或失败，本次放弃以免污染统计');
        return -1;
    }

    async function measureValuables() {
        const out = { mora: null, primogem: undefined };
        try {
            await genshin.returnMainUi(); await sleep(200);
            keyPress('B'); await sleep(1000);
            const gzwp = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/valuables.png'));
            const gzwp2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/valuables2.png'));
            let switched = false;
            for (let t = 0; t < 10 && !switched; t++) {
                if (await findAndClick(gzwp, 1, true)) switched = true;
                else if (await findAndClick(gzwp2, 2, true)) switched = true;
            }
            await sleep(1000);
            // 摩拉：mora 图标锚定 + 模板数字
            const moraRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/mora.png'), 0, 970, 600, 110);
            let moraX = 336, moraY = 1004;
            const rg = captureGameRegion();
            try { const r = rg.find(moraRo); if (r.isExist()) { moraX = r.x; moraY = r.y; } } catch (e) { } finally { rg.dispose(); }
            // 连读校验：框宽 300→420 适配千万级 8~9 位数；连续 2 次读到同值才采信，对不上就重读，凑不齐返回 -1 判失败
            const moraRes = await readStable('摩拉', function () { return numberTemplateMatch('assets/bag_mora_digits', moraX, moraY, 420, 40, 0.95, 0.85, 10); });
            out.mora = moraRes < 0 ? null : moraRes;
            if (out.mora === null) log.warn('摩拉识别失败');
            // 原石（软）：原石图标 + 加号 框定数值区，同字体数字模板；失败设 undefined 不影响窗口
            try {
                const pgRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/primogem.png'), 0, 970, 600, 110);
                const plusRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/add.png'), 0, 970, 600, 110);
                let pgX = 152, pgY = 1007, plusX = 262;
                const rg2 = captureGameRegion();
                try {
                    const pr = rg2.find(pgRo); if (pr.isExist()) { pgX = pr.x; pgY = pr.y; }
                    const plr = rg2.find(plusRo); if (plr.isExist()) { plusX = plr.x; }
                } catch (e) { } finally { rg2.dispose(); }
                const w = Math.max(60, plusX - pgX);
                const pgRes = await readStable('原石', function () { return numberTemplateMatch('assets/bag_mora_digits', pgX + 28, pgY, w, 40, 0.95, 0.85, 10); });
                if (pgRes >= 0) out.primogem = pgRes;
            } catch (e) { log.warn('原石识别异常(忽略)：' + e); }
            return out;
        } catch (e) { log.warn('贵重物品测量异常：' + e); return { mora: null, primogem: undefined }; }
    }

    // ===================== 狗粮经验测量（复刻 ArtifactExpCount） =====================
    async function measureFodderExp() {
        try {
            await genshin.returnMainUi(); await sleep(200);
            keyPress('B'); await sleep(1000);
            await close_expired_stuff_popup_window();
            let ok = false;
            for (let i = 0; i < 10 && !ok; i++) {
                await click(642, 36);
                ok = await clickPNG('dissolve', false);
                if (!ok) { await sleep(750); await genshin.returnMainUi(); await sleep(100); keyPress('B'); await sleep(1000); }
            }
            if (!ok) { log.warn('未进入圣遗物分解界面，狗粮测量失败'); return null; }
            await clickPNG('time_order', true, 1); await sleep(200);
            await clickPNG('filter'); await sleep(200); click(30, 30); await sleep(100);
            await clickPNG('reset'); await sleep(200); await clickPNG('sanctify_def'); await sleep(200);
            await clickPNG('unequipped'); await sleep(200); await clickPNG('unlocked'); await sleep(200);
            await clickPNG('confirm'); await sleep(200); click(30, 30); await sleep(100);
            const smallBottle = await getBottleCount('背包小瓶', 'assets/RecognitionObject/star3.png');
            const bigBottle = await getBottleCount('背包大瓶', 'assets/RecognitionObject/star4.png');
            await clickPNG('filter'); await sleep(200); click(30, 30); await sleep(100);
            await clickPNG('reset'); await sleep(200); await clickPNG('confirm'); click(30, 30); await sleep(100);
            await clickPNG('dissolve'); await sleep(1000);
            const storedRaw = await numberTemplateMatch('assets/stored_exp_digits', 1573, 885, 74, 36);
            const stored = storedRaw >= 0 ? storedRaw : 0;
            await clickPNG('quick_select'); await sleep(500);
            const ys = [{ s: 1, y: 130 }, { s: 2, y: 200 }, { s: 3, y: 270 }, { s: 4, y: 340 }], c = {};
            for (let p = 0; p < ys.length; p++) { const n = await numberTemplateMatch('assets/selected_fodder_digits', 570, ys[p].y, 60, 50); c[ys[p].s] = n < 0 ? 0 : n; }
            const total = c[1] * 420 + c[2] * 840 + c[3] * 1260 + c[4] * 2520 + parseInt(smallBottle || 0) * 2500 + parseInt(bigBottle || 0) * 10000 + stored;
            log.info('狗粮明细：1★' + c[1] + ' 2★' + c[2] + ' 3★' + c[3] + ' 4★' + c[4] + ' 小瓶' + (smallBottle || 0) + ' 大瓶' + (bigBottle || 0) + ' 储存' + stored + ' → 折合' + total);
            return total;
        } catch (e) { log.warn('狗粮测量异常：' + e); return null; }
    }

    async function numberTemplateMatch(numberPngFilePath, x, y, w, h, maxThreshold, minThreshold, splitCount, maxOverlap) {
        x = x || 0; y = y || 0; w = w || 1920; h = h || 1080;
        maxThreshold = maxThreshold || 0.95; minThreshold = minThreshold || 0.8; splitCount = splitCount || 3; maxOverlap = maxOverlap || 2;
        const ros = [];
        for (let i = 0; i <= 9; i++) ros[i] = RecognitionObject.TemplateMatch(file.ReadImageMatSync(numberPngFilePath + '/' + i + '.png'), x, y, w, h);
        function setThreshold(arr, t) { for (let i = 0; i < arr.length; i++) { arr[i].Threshold = t; arr[i].InitTemplate(); } }
        const gameRegion = captureGameRegion(), all = [];
        try {
            for (let k = 0; k < splitCount; k++) {
                const thr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
                setThreshold(ros, thr);
                for (let d = 0; d <= 9; d++) { const res = gameRegion.findMulti(ros[d]); if (res.count === 0) continue; for (let m = 0; m < res.count; m++) all.push({ digit: d, x: res[m].x, y: res[m].y, w: res[m].width, h: res[m].height }); }
            }
        } catch (e) { } finally { gameRegion.dispose(); }
        if (all.length === 0) return -1;
        const adopted = [];
        for (let ci = 0; ci < all.length; ci++) {
            let cc = all[ci], overlap = false;
            for (let ai = 0; ai < adopted.length; ai++) { let a = adopted[ai]; const xo = Math.max(0, Math.min(cc.x + cc.w, a.x + a.w) - Math.max(cc.x, a.x)); const yo = Math.max(0, Math.min(cc.y + cc.h, a.y + a.h) - Math.max(cc.y, a.y)); if (xo > maxOverlap && yo > maxOverlap) { overlap = true; break; } }
            if (!overlap) adopted.push(cc);
        }
        if (adopted.length === 0) return -1;
        adopted.sort(function (a, b) { return a.x - b.x; });
        return adopted.reduce(function (num, it) { return num * 10 + it.digit; }, 0);
    }
    async function clickPNG(png, doClick, maxAttempts, Threshold) {
        if (doClick === undefined) doClick = true; maxAttempts = maxAttempts || 40; Threshold = Threshold || 0.9;
        const ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/' + png + '.png'));
        ro.Threshold = Threshold; ro.InitTemplate();
        return await findAndClick(ro, maxAttempts, doClick);
    }
    async function findAndClick(target, maxAttempts, doClick) {
        maxAttempts = maxAttempts || 20;
        for (let i = 0; i < maxAttempts; i++) {
            const rg = captureGameRegion();
            try { const res = rg.find(target); if (res.isExist()) { if (doClick) { await sleep(16); res.click(); await sleep(50); } return true; } } finally { rg.dispose(); }
            if (i < maxAttempts - 1) await sleep(50);
        }
        return false;
    }
    async function close_expired_stuff_popup_window() {
        const rg = captureGameRegion();
        const res = rg.find(RecognitionObject.ocr(850, 273, 225, 51));
        if (res && res.text && res.text.includes('物品过期')) { log.info('检测到物品过期'); click(1000, 750); await sleep(1000); }
        rg.dispose();
    }
    async function getBottleCount(itemName, templatePath) {
        const ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(templatePath)); ro.InitTemplate();
        for (let i = 0; i < 5; i++) {
            const rg = captureGameRegion();
            try { const res = rg.find(ro); if (res.isExist()) { const count = await numberTemplateMatch('assets/bag_digits', res.x, res.y + 20, 70, 20); const digits = count === -1 ? '' : count.toString(); log.info('识别到' + itemName + '数量为' + digits); return digits; } } finally { rg.dispose(); }
            if (i < 4) await sleep(50);
        }
        return '';
    }
})();
