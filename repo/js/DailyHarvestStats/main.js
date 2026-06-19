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
    var d = new Date(tsMs - 4 * 3600 * 1000);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// OCR 文本清洗成整数；失败返回 null（绝不返回 0）。
function cleanNumber(text) {
    if (text == null) return null;
    var digits = String(text).replace(/[^\d]/g, '');
    if (!digits) return null;
    var n = parseInt(digits, 10);
    return Number.isNaN(n) ? null : n;
}

function formatExp(num) {
    if (num == null) return '--';
    var neg = num < 0 ? '-' : '', a = Math.abs(num);
    if (a >= 10000) return neg + (a / 10000) + '万';
    return neg + a;
}
function formatMora(num) { return num == null ? '--' : num.toLocaleString('en-US'); }

var METRICS = ['mora', 'fodderExp'];

function freshState() {
    return { schema: 2, session: { open: false, ts: 0, mora: null, fodderExp: null },
        totalMora: 0, totalFodder: 0, firstTs: null, records: [] };
}
function cloneState(s) { return JSON.parse(JSON.stringify(s)); }

// 【采集前】记录起点，打开本次采集窗口。
// cur[k]: number=读到 / null=启用但失败 / undefined=未统计该项。
function computeStart(prev, cur, nowTs) {
    if (cur.mora === null || cur.fodderExp === null)
        return { action: 'skip', reason: 'measure-fail', state: prev || freshState() };
    var state = prev ? cloneState(prev) : freshState();
    state.session = {
        open: true, ts: nowTs,
        mora: (typeof cur.mora === 'number') ? cur.mora : null,
        fodderExp: (typeof cur.fodderExp === 'number') ? cur.fodderExp : null
    };
    return { action: 'start', state: state };
}

// 【采集后】结算：收获 = 终点 − 起点；负收获/超限不计。
// 返回 action: 'no-start' | 'skip'(reason) | 'end'
function computeEnd(prev, cur, nowTs, opts) {
    opts = opts || {};
    var max = opts.moraSanityMax || 50000000;
    if (!prev || !prev.session || !prev.session.open)
        return { action: 'no-start', state: prev || freshState() };

    var state = cloneState(prev);
    state.session.open = false; // 无论结果如何，关闭本窗口

    if (cur.mora === null || cur.fodderExp === null)
        return { action: 'skip', reason: 'measure-fail', state: state };

    var start = prev.session;
    var gains = {};
    for (var i = 0; i < METRICS.length; i++) {
        var k = METRICS[i];
        gains[k] = (typeof cur[k] === 'number' && typeof start[k] === 'number') ? (cur[k] - start[k]) : null;
    }
    // 异常：负收获（采集只增）或幅度超限（疑似 OCR 误读）→ 整窗不计
    for (var j = 0; j < METRICS.length; j++) {
        var g = gains[METRICS[j]];
        if (g != null && (g < 0 || Math.abs(g) > max))
            return { action: 'skip', reason: 'abnormal', state: state, badMetric: METRICS[j], badValue: g };
    }

    var mg = gains.mora != null ? gains.mora : 0;
    var fg = gains.fodderExp != null ? gains.fodderExp : 0;
    state.totalMora += mg;
    state.totalFodder += fg;
    var curDay = serviceDay(nowTs);
    var recs = state.records;
    if (recs.length && recs[recs.length - 1].dayKey === curDay) {
        recs[recs.length - 1].moraGain += mg;
        recs[recs.length - 1].fodderGain += fg;
        recs[recs.length - 1].ts = nowTs;
    } else {
        recs.push({ dayKey: curDay, ts: nowTs, moraGain: mg, fodderGain: fg });
        if (state.firstTs == null) state.firstTs = nowTs;
    }
    state.records = recs.slice(-90);
    return { action: 'end', state: state, moraGain: mg, fodderGain: fg };
}

// 报告：累计=总和；日均=总和 ÷ 采集天数(records 条数)；今天=当前服务日那条。
function computeReport(state, nowTs) {
    var out = { days: 0, mora: null, fodder: null, today: { mora: 0, fodder: 0 } };
    if (!state || !state.records) return out;
    out.days = state.records.length;
    if (out.days > 0) {
        out.mora = { total: state.totalMora, avg: Math.round(state.totalMora / out.days) };
        out.fodder = { total: state.totalFodder, avg: Math.round(state.totalFodder / out.days) };
    }
    var curDay = serviceDay(nowTs);
    var recs = state.records;
    if (recs.length && recs[recs.length - 1].dayKey === curDay) {
        out.today.mora = recs[recs.length - 1].moraGain;
        out.today.fodder = recs[recs.length - 1].fodderGain;
    }
    return out;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        serviceDay: serviceDay, cleanNumber: cleanNumber, formatExp: formatExp, formatMora: formatMora,
        freshState: freshState, computeStart: computeStart, computeEnd: computeEnd, computeReport: computeReport
    };
}

// ---------- BGI 运行入口（Node 测试时 module 已定义，整段跳过） ----------
if (typeof module === 'undefined') (async function () {
    setGameMetrics(1920, 1080, 1);

    var profileId = (settings.profile_id != undefined ? String(settings.profile_id).trim() : '');
    var profileKey = profileId ? ('profile-' + profileId) : 'default-profile';
    var phase = settings.phase != undefined ? settings.phase : '采集后(结算)';
    var isStart = phase.indexOf('采集前') === 0;
    var countMora = (settings.countMora != undefined ? settings.countMora : '是') !== '否';
    var countFodder = (settings.countFodder != undefined ? settings.countFodder : '是') !== '否';
    var doReset = (settings.reset != undefined ? settings.reset : '否') === '是';
    var notify = (settings.notify != undefined ? settings.notify : '是') !== '否';

    var MAIN = 'local/harvest_stats.json';
    var BAK = 'local/harvest_stats.bak.json';

    if (!countMora && !countFodder) { log.warn('摩拉和狗粮经验都未启用，脚本结束。'); return; }

    var store = loadStore();
    if (doReset) { store[profileKey] = freshState(); saveStore(store); announce('🧹 已清空账户【' + profileKey + '】的统计，从本次重新开始。'); }
    var prev = store[profileKey] || null;

    await genshin.returnMainUi();
    var cur = { ts: Date.now() };
    cur.mora = countMora ? await measureMora() : undefined;
    cur.fodderExp = countFodder ? await measureFodderExp() : undefined;
    await genshin.returnMainUi();
    log.info('本次读数：摩拉=' + fmtRead(cur.mora) + '，狗粮经验=' + fmtRead(cur.fodderExp));

    if (isStart) {
        // ===== 采集前：记起点 =====
        var rs = computeStart(prev, cur, cur.ts);
        if (rs.action === 'skip') { announce('⚠️ 采集前测量失败，未记录起点；本轮收获将无法结算。'); return; }
        store[profileKey] = rs.state;
        if (saveStore(store)) announce('▶️ 已记录采集起点（摩拉 ' + fmtMoney(cur.mora) + ' / 狗粮经验 ' + fmtFodder(cur.fodderExp) + '）。');
    } else {
        // ===== 采集后：结算 =====
        var re = computeEnd(prev, cur, cur.ts, {});
        if (re.action === 'no-start') { announce('⚠️ 未找到采集起点，请把「采集前」的统计任务排在采集任务之前先运行。本次未结算。'); return; }
        if (re.action === 'skip') {
            store[profileKey] = re.state; saveStore(store); // 关闭窗口状态也要落盘
            if (re.reason === 'abnormal') announce('⚠️ 检测到异常收获（' + re.badMetric + '=' + re.badValue + '，疑似读数错误或非采集变动），本段不计。');
            else announce('⚠️ 采集后测量失败，本段不计。');
            return;
        }
        store[profileKey] = re.state;
        if (!saveStore(store)) { announce('⚠️ 写盘校验失败，本段未记录（旧记录已保留在备份）。'); return; }
        var rpt = computeReport(re.state, cur.ts);
        report(rpt, re.state);
    }

    // ===================== 辅助 =====================
    function fmtRead(v) { return v === null ? '失败' : (v === undefined ? '未统计' : v); }
    function fmtMoney(v) { return (typeof v === 'number') ? formatMora(v) : '--'; }
    function fmtFodder(v) { return (typeof v === 'number') ? formatExp(v) : '--'; }

    function report(rpt, state) {
        var firstDate = state.firstTs ? new Date(state.firstTs).toLocaleDateString() : '--';
        var msg = '📊 每日收获统计 [账户: ' + profileKey + ']\n';
        msg += '⏱ 起算 ' + firstDate + '，已统计 ' + rpt.days + ' 个采集日\n';
        if (countMora && rpt.mora) msg += '── 摩拉 ──\n已累计 ' + formatMora(rpt.mora.total) + ' / 今天 ' + formatMora(rpt.today.mora) + ' / 日均 ' + formatMora(rpt.mora.avg) + '\n';
        if (countFodder && rpt.fodder) msg += '── 狗粮经验 ──\n已累计 ' + formatExp(rpt.fodder.total) + ' / 今天 ' + formatExp(rpt.today.fodder) + ' / 日均 ' + formatExp(rpt.fodder.avg) + '\n';
        announce(msg);
    }

    function announce(text) {
        log.info(text);
        if (notify) { try { if (typeof notification !== 'undefined' && notification.send) notification.send(text); } catch (e) { } }
    }

    function loadStore() {
        var raw = null;
        try { raw = file.readTextSync(MAIN); } catch (e) { raw = null; }
        if (raw) { try { return JSON.parse(raw); } catch (e) { log.warn('主记录损坏，尝试备份恢复'); } }
        try { var b = file.readTextSync(BAK); if (b) return JSON.parse(b); } catch (e) { }
        return {};
    }
    function saveStore(obj) {
        var json = JSON.stringify(obj);
        try { var old = file.readTextSync(MAIN); if (old) file.writeTextSync(BAK, old, false); } catch (e) { }
        try { file.writeTextSync(MAIN, json, false); } catch (e) { log.error('写盘失败：' + e); return false; }
        try { JSON.parse(file.readTextSync(MAIN)); } catch (e) { log.error('写盘回读校验失败：' + e); return false; }
        try { writeReadableReport(obj); } catch (e) { log.warn('生成可读报告失败：' + e); } // 给人看的 txt
        return true;
    }

    // 生成「给人看」的可读报告 local/harvest_report.txt（json 是给程序用的）
    function writeReadableReport(store) {
        var L = [];
        L.push('========== 每日收获统计 ==========');
        L.push('（本文件是给人看的报告，会自动刷新；harvest_stats.json 是程序用的，请勿手动改）');
        var keys = Object.keys(store);
        for (var ki = 0; ki < keys.length; ki++) {
            var st = store[keys[ki]];
            if (!st || !st.records) continue;
            var rep = computeReport(st, Date.now());
            var firstDate = st.firstTs ? new Date(st.firstTs).toLocaleDateString() : '（尚无）';
            L.push('');
            L.push('【账户】' + keys[ki]);
            L.push('  起算 ' + firstDate + '，已统计 ' + rep.days + ' 个采集日');
            if (rep.mora) L.push('  摩拉：    累计 ' + formatMora(rep.mora.total) + '  |  今天 ' + formatMora(rep.today.mora) + '  |  日均 ' + formatMora(rep.mora.avg));
            if (rep.fodder) L.push('  狗粮经验：累计 ' + formatExp(rep.fodder.total) + '  |  今天 ' + formatExp(rep.today.fodder) + '  |  日均 ' + formatExp(rep.fodder.avg));
            var recs = st.records.slice(-10).reverse();
            if (recs.length) {
                L.push('  近期明细（最新在上）：');
                for (var ri = 0; ri < recs.length; ri++) {
                    var r = recs[ri], d = new Date(r.ts);
                    L.push('    ' + (d.getMonth() + 1) + '/' + d.getDate() + '   摩拉 +' + formatMora(r.moraGain) + '   狗粮 +' + formatExp(r.fodderGain));
                }
            }
        }
        L.push('');
        L.push('（更新于 ' + new Date().toLocaleString() + '）');
        file.writeTextSync('local/harvest_report.txt', L.join('\n'), false);
    }

    // ===================== 摩拉测量（复刻 OcrFreeMora&Primogem：背包贵重物品页 + 模板数字） =====================
    async function measureMora() {
        try {
            await genshin.returnMainUi(); await sleep(200);
            keyPress('B'); await sleep(1000);
            // 切到「贵重物品」页
            var gzwp = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/valuables.png'));
            var gzwp2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/valuables2.png'));
            var switched = false;
            for (var t = 0; t < 10 && !switched; t++) {
                if (await findAndClick(gzwp, 1, true)) switched = true;
                else if (await findAndClick(gzwp2, 2, true)) switched = true;
            }
            await sleep(1000);
            // 用 mora 图标锚定数值位置，再用模板数字读（对千分位逗号免疫）
            var moraRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/mora.png'), 0, 970, 600, 110);
            var moraX = 336, moraY = 1004;
            var rg = captureGameRegion();
            try { var r = rg.find(moraRo); if (r.isExist()) { moraX = r.x; moraY = r.y; } } catch (e) { } finally { rg.dispose(); }
            var moraRes = -1, attempts = 0;
            while (moraRes < 0 && attempts < 5) { attempts++; moraRes = await numberTemplateMatch('assets/bag_mora_digits', moraX, moraY, 300, 40, 0.95, 0.85, 10); }
            if (moraRes < 0) { log.warn('摩拉识别失败'); return null; }
            return moraRes;
        } catch (e) { log.warn('摩拉测量异常：' + e); return null; }
    }

    // ===================== 狗粮经验测量（复刻 ArtifactExpCount） =====================
    async function measureFodderExp() {
        try {
            await genshin.returnMainUi(); await sleep(200);
            keyPress('B'); await sleep(1000);
            await close_expired_stuff_popup_window();
            var ok = false;
            for (var i = 0; i < 10 && !ok; i++) {
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
            var smallBottle = await getBottleCount('背包小瓶', 'assets/RecognitionObject/star3.png');
            var bigBottle = await getBottleCount('背包大瓶', 'assets/RecognitionObject/star4.png');
            await clickPNG('filter'); await sleep(200); click(30, 30); await sleep(100);
            await clickPNG('reset'); await sleep(200); await clickPNG('confirm'); click(30, 30); await sleep(100);
            await clickPNG('dissolve'); await sleep(1000);
            var storedRaw = await numberTemplateMatch('assets/stored_exp_digits', 1573, 885, 74, 36);
            var stored = storedRaw >= 0 ? storedRaw : 0;
            await clickPNG('quick_select'); await sleep(500);
            var ys = [{ s: 1, y: 130 }, { s: 2, y: 200 }, { s: 3, y: 270 }, { s: 4, y: 340 }], c = {};
            for (var p = 0; p < ys.length; p++) { var n = await numberTemplateMatch('assets/selected_fodder_digits', 570, ys[p].y, 60, 50); c[ys[p].s] = n < 0 ? 0 : n; }
            var total = c[1] * 420 + c[2] * 840 + c[3] * 1260 + c[4] * 2520 + parseInt(smallBottle || 0) * 2500 + parseInt(bigBottle || 0) * 10000 + stored;
            log.info('狗粮明细：1★' + c[1] + ' 2★' + c[2] + ' 3★' + c[3] + ' 4★' + c[4] + ' 小瓶' + (smallBottle || 0) + ' 大瓶' + (bigBottle || 0) + ' 储存' + stored + ' → 折合' + total);
            return total;
        } catch (e) { log.warn('狗粮测量异常：' + e); return null; }
    }

    async function numberTemplateMatch(numberPngFilePath, x, y, w, h, maxThreshold, minThreshold, splitCount, maxOverlap) {
        x = x || 0; y = y || 0; w = w || 1920; h = h || 1080;
        maxThreshold = maxThreshold || 0.95; minThreshold = minThreshold || 0.8; splitCount = splitCount || 3; maxOverlap = maxOverlap || 2;
        var ros = [];
        for (var i = 0; i <= 9; i++) ros[i] = RecognitionObject.TemplateMatch(file.ReadImageMatSync(numberPngFilePath + '/' + i + '.png'), x, y, w, h);
        function setThreshold(arr, t) { for (var i = 0; i < arr.length; i++) { arr[i].Threshold = t; arr[i].InitTemplate(); } }
        var gameRegion = captureGameRegion(), all = [];
        try {
            for (var k = 0; k < splitCount; k++) {
                var thr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
                setThreshold(ros, thr);
                for (var d = 0; d <= 9; d++) { var res = gameRegion.findMulti(ros[d]); if (res.count === 0) continue; for (var m = 0; m < res.count; m++) all.push({ digit: d, x: res[m].x, y: res[m].y, w: res[m].width, h: res[m].height }); }
            }
        } catch (e) { } finally { gameRegion.dispose(); }
        if (all.length === 0) return -1;
        var adopted = [];
        for (var ci = 0; ci < all.length; ci++) {
            var cc = all[ci], overlap = false;
            for (var ai = 0; ai < adopted.length; ai++) { var a = adopted[ai]; var xo = Math.max(0, Math.min(cc.x + cc.w, a.x + a.w) - Math.max(cc.x, a.x)); var yo = Math.max(0, Math.min(cc.y + cc.h, a.y + a.h) - Math.max(cc.y, a.y)); if (xo > maxOverlap && yo > maxOverlap) { overlap = true; break; } }
            if (!overlap) adopted.push(cc);
        }
        if (adopted.length === 0) return -1;
        adopted.sort(function (a, b) { return a.x - b.x; });
        return adopted.reduce(function (num, it) { return num * 10 + it.digit; }, 0);
    }
    async function clickPNG(png, doClick, maxAttempts, Threshold) {
        if (doClick === undefined) doClick = true; maxAttempts = maxAttempts || 40; Threshold = Threshold || 0.9;
        var ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/RecognitionObject/' + png + '.png'));
        ro.Threshold = Threshold; ro.InitTemplate();
        return await findAndClick(ro, maxAttempts, doClick);
    }
    async function findAndClick(target, maxAttempts, doClick) {
        maxAttempts = maxAttempts || 20;
        for (var i = 0; i < maxAttempts; i++) {
            var rg = captureGameRegion();
            try { var res = rg.find(target); if (res.isExist()) { if (doClick) { await sleep(16); res.click(); await sleep(50); } return true; } } finally { rg.dispose(); }
            if (i < maxAttempts - 1) await sleep(50);
        }
        return false;
    }
    async function close_expired_stuff_popup_window() {
        var rg = captureGameRegion();
        var res = rg.find(RecognitionObject.ocr(850, 273, 225, 51));
        if (res && res.text && res.text.includes('物品过期')) { log.info('检测到物品过期'); click(1000, 750); await sleep(1000); }
        rg.dispose();
    }
    async function getBottleCount(itemName, templatePath) {
        var ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(templatePath)); ro.InitTemplate();
        for (var i = 0; i < 5; i++) {
            var rg = captureGameRegion();
            try { var res = rg.find(ro); if (res.isExist()) { var count = await numberTemplateMatch('assets/bag_digits', res.x, res.y + 20, 70, 20); var digits = count === -1 ? '' : count.toString(); log.info('识别到' + itemName + '数量为' + digits); return digits; } } finally { rg.dispose(); }
            if (i < 4) await sleep(50);
        }
        return '';
    }
})();
