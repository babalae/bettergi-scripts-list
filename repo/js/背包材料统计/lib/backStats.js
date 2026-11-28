const holdX = Math.min(1920, Math.max(0, Math.floor(Number(settings.HoldX) || 1050)));
const holdY = Math.min(1080, Math.max(0, Math.floor(Number(settings.HoldY) || 750)));
const _flipCalib = (() => {
    try {
        const raw = (typeof safeReadTextSync === 'function')
            ? safeReadTextSync('user/pageFlip.json', '')
            : (typeof file !== 'undefined' && file.readTextSync ? file.readTextSync('user/pageFlip.json') : '');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
})();
// 翻页距离：设置项 PageScrollDistance 已填→用它；未填→用 user/pageFlip.json 实测；都没有→取默认 711
// 标定后可由 refreshTotalPageDistance() 重算，所以用 let
let totalPageDistance = Math.max(10, Math.floor(Number(settings.PageScrollDistance) || (_flipCalib && Number(_flipCalib.pageFlipDistance)) || 711));

// 读取 user/pageFlip.json 的标定结果（失败返回 null）
function readFlipCalib() {
    try {
        const raw = (typeof safeReadTextSync === 'function')
            ? safeReadTextSync('user/pageFlip.json', '')
            : (typeof file !== 'undefined' && file.readTextSync ? file.readTextSync('user/pageFlip.json') : '');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

// 是否需要自动标定：拖动距离未设置，且 pageFlip.json 里没有有效翻页距离
function needFlipCalib() {
    if (Number(settings.PageScrollDistance)) return false;
    const calib = readFlipCalib();
    return !(calib && Number(calib.pageFlipDistance));
}

// 标定完成后重算翻页距离（settings 优先 → pageFlip.json → 默认 711）
function refreshTotalPageDistance() {
    const calib = readFlipCalib();
    totalPageDistance = Math.max(10, Math.floor(Number(settings.PageScrollDistance) || (calib && Number(calib.pageFlipDistance)) || 711));
    log.info(`【翻页标定】翻页距离已更新为 ${totalPageDistance}px`);
    return totalPageDistance;
}
const imageDelay = Math.min(1000, Math.max(0, Math.floor(Number(settings.ImageDelay) || 0))); // 识图基准时长

// 全局图片缓存（避免重复加载）
const globalMaterialImageCache = {};

// 配置参数
const pageScrollCount = 22; // 最多滑页次数

// 材料分类映射表
const materialTypeMap = {
    "祝圣精华": "2",
    "锻造素材": "5",
    "怪物掉落素材": "3",
    "一般素材": "5",
    "周本素材": "3",
    "烹饪食材": "5",
    "角色突破素材": "3",
    "木材": "5",
    "宝石": "3",
    "鱼饵鱼类": "5",
    "角色天赋素材": "3",
    "武器突破素材": "3",
    "采集食物": "4",
    "料理": "4"
};

// 材料前位定义
const materialPriority = {
    "祝圣精华": 2, 
    "锻造素材": 1, 
    "怪物掉落素材": 1, 
    "采集食物": 1, 
    "一般素材": 2, 
    "周本素材": 2, 
    "料理": 2, 
    "烹饪食材": 3, 
    "角色突破素材": 3, 
    "木材": 4, 
    "宝石": 4, 
    "鱼饵鱼类": 5, 
    "角色天赋素材": 5, 
    "武器突破素材": 6
};

// ===== 页签总序：小分类拼接顺序 + 小分类内部顺序，均以 txt 为准 =====
// 仅涵盖两个材料页签（Materials=材料.txt / CultivationItems=养成道具.txt）
// 祝圣精华(XP页签)、采集食物/料理(食物页签) 不在这两份总序内，getSegment 返回 null → 整页全列扫描兜底
const materialOrderBlockMap = {
    "锻造素材": "材料",
    "一般素材": "材料",
    "烹饪食材": "材料",
    "木材": "材料",
    "鱼饵鱼类": "材料",
    "怪物掉落素材": "养成道具",
    "周本素材": "养成道具",
    "角色突破素材": "养成道具",
    "宝石": "养成道具",
    "角色天赋素材": "养成道具",
    "武器突破素材": "养成道具"
};

// 块名 → materialTypeMap 类型（用于将归类限制在同一页签内）
const materialOrderBlockType = { "材料": "5", "养成道具": "3" };

const materialOrder = { txtIdx: {}, category: {}, segments: {}, orderList: {} };

function loadMaterialOrder() {
    if (Object.keys(materialOrder.txtIdx).length > 0) return; // 已加载

    // 归类复用 file.js 现成的 matchImageAndGetCategory：图片所在文件夹即材料分类，
    // 只列目录文件名、不逐文件读图，不会产生 ReadImageMatSync 异常日志
    for (const block of ["材料", "养成道具"]) {
        const blockType = materialOrderBlockType[block];
        const content = safeReadTextSync(`assets/${block}.txt`);
        if (!content) {
            log.warn(`总序表缺失：assets/${block}.txt，行扫描定位不可用（将退回整页全列扫描）`);
            continue;
        }

        const lines = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const orderList = [];

        for (let i = 0; i < lines.length; i++) {
            const name = lines[i];
            const cat = matchImageAndGetCategory(name, "assets/images");

            if (!cat || materialTypeMap[cat] !== blockType) {
                orderList.push({ name, cat: null }); // 图库无图 / 不属于本页签：占位不归类
                continue;
            }

            orderList.push({ name, cat });
            if (materialOrder.txtIdx[name] === undefined) materialOrder.txtIdx[name] = i;
            if (materialOrder.category[name] === undefined) materialOrder.category[name] = cat;

            const seg = materialOrder.segments[cat];
            if (!seg) {
                materialOrder.segments[cat] = { startRow: i, endRow: i };
            } else if (seg.endRow !== i - 1) {
                if (i > seg.endRow) seg.endRow = i; // 同名材料二次出现：只放宽区间
            } else {
                seg.endRow = i;
            }
        }

        materialOrder.orderList[block] = orderList;
        log.info(`总序载入 ${block}：有效材料 ${orderList.filter(o => o.cat).length} / 共 ${lines.length} 行，小分类 ${Object.keys(materialTypeMap).filter(c => materialOrderBlockMap[c] === block).length} 个`);
    }
}

// 材料所在总序行（-1 = 总序表里没有，不可用于定位）
function lookupMaterialRow(name) {
    return materialOrder.txtIdx[name] !== undefined ? materialOrder.txtIdx[name] : -1;
}

// 目标小分类的总序区间
function getSegment(category) {
    const seg = materialOrder.segments[category];
    if (!seg) return null;
    const block = materialOrderBlockMap[category];
    return block ? { ...seg, block } : null;
}

// 相邻格子 y 间距：实测 user/pageFlip.json（m1.y=152 → m5.y=853，4 格差 701 → 单格 175）
const CELL_PITCH = 175;
const CELL_PITCH_MAX = 180; // 相邻命中 y 差超过它 → 中间有空档（有格子没命中）

// 第八列命中格 y → 行号：用固定格距换算（76 = 图标半高）
function rowFromY(y, startY) {
    return Math.max(0, Math.round((y - startY - 76) / CELL_PITCH));
}

/*
 * 由第八列命中格的实测 y 推出本次全列扫描要覆盖的 y 区间
 * hits: [{ name, y }]，seg: { startRow, endRow, block }
 * 行号由实测 y + 固定格距 175 换算；相邻命中 y 差 > CELL_PITCH_MAX 即判定中间空档
 * 有空档时从空档上沿开始扫，扫描区间一律落到实测 y，宁可多扫也不漏
 * 返回 null = 不可定，整页扫
 */
function computeScanRows(hits, seg, scroll, pageTop = 121, columnHeight = 710) {
    const orderList = materialOrder.orderList[seg.block];
    if (!orderList || hits.length === 0) return null;

    const pageBottom = pageTop + columnHeight;
    const cellH = 152; // 模板图高
    const halfCell = cellH / 2;
    const clampY = y => Math.max(pageTop, Math.min(pageBottom, y));

    const inSeg = [];
    const before = [];
    const after = [];
    for (const h of hits) {
        const r = lookupMaterialRow(h.name);
        if (r < 0) continue;
        if (r < seg.startRow) before.push(h);
        else if (r > seg.endRow) after.push(h);
        else inSeg.push(h);
    }

    // 命中按 y 排序：相邻 y 差超上限 → 中间有空档，记下空档上沿
    const sorted = [...hits].sort((a, b) => a.y - b.y);
    let gapTopY = null;
    let gapRows = 0;
    for (let i = 1; i < sorted.length; i++) {
        const d = sorted[i].y - sorted[i - 1].y;
        if (d > CELL_PITCH_MAX) {
            gapTopY = sorted[i - 1].y;
            gapRows = Math.max(1, Math.round(d / CELL_PITCH) - 1);
            break;
        }
    }
    const gapDesc = gapTopY === null ? "无空档" : `空档${gapRows}行(自y${gapTopY})`;
    // 有空档：空档及其以下都要扫；无空档：用传入的起算 y
    const pickStart = y => (gapTopY !== null ? Math.min(gapTopY + halfCell, clampY(y)) : clampY(y));

    if (inSeg.length > 0) {
        // 列8已落在目标段内：从最高命中格（或空档上沿）扫到页底
        const topY = Math.min(...inSeg.map(h => h.y));
        return { yStart: pickStart(topY), yEnd: pageBottom, reason: `列8命中目标段，${gapDesc}` };
    }

    if (before.length > 0 && after.length > 0) {
        const lastBeforeY = Math.max(...before.map(h => h.y));
        const firstAfterY = Math.min(...after.map(h => h.y));
        if (lastBeforeY + halfCell < firstAfterY) {
            return { yStart: pickStart(lastBeforeY + halfCell), yEnd: clampY(firstAfterY + cellH), reason: `列8夹住目标段，${gapDesc}` };
        }
        return { yStart: pageTop, yEnd: pageBottom, reason: "同页段前段后冲突" };
    }

    if (before.length > 0) {
        // 只探到段前材料：从下一格（或空档上沿）一直扫到页底
        const lastBeforeY = Math.max(...before.map(h => h.y));
        return { yStart: pickStart(lastBeforeY + halfCell), yEnd: pageBottom, reason: `仅列8段前命中，扫到页底，${gapDesc}` };
    }

    if (after.length > 0) {
        // 列8命中全在目标段之后：目标段已整段翻过，本页整页扫一次后结束
        return { yStart: pageTop, yEnd: pageBottom, past: true, reason: "列8已翻过目标段" };
    }

    return { yStart: pageTop, yEnd: pageBottom, reason: "列8命中不可归类" };
}

// 提前计算所有动态坐标
// 物品区左顶处物品左上角坐标(117,121)
// 物品图片大小(123,152)
// 物品间隔(24,24)
// 第一点击区位置:123/2+117=178.5; 152/2+121=197
// const menuClickX = Math.round(575 + (Number(menuOffset) - 1) * 96.25); // 背包菜单的 X 坐标

// log.info(`材料分类: ${materialsCategory}, 菜单偏移值: ${menuOffset}, 计算出的点击 X 坐标: ${menuClickX}`);

// OCR识别文本
async function recognizeText(ocrRegion, timeout = 100, retryInterval = 20, maxAttempts = 10, maxFailures = 3, ra = null) {
    let startTime = Date.now();
    let retryCount = 0;
    let failureCount = 0; // 用于记录连续失败的次数
    // const results = [];
    const frequencyMap = {}; // 用于记录每个结果的出现次数

    while (Date.now() - startTime < timeout && retryCount < maxAttempts) {
        let ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        ocrObject.threshold = 0.85; // 适当降低阈值以提高速度
        let resList = ra.findMulti(ocrObject);

        if (resList.count === 0) {
            failureCount++;
            if (failureCount >= maxFailures) {
                ocrRegion.x += 3; // 每次缩小6像素
                ocrRegion.width -= 6; // 每次缩小6像素
                retryInterval += 10;

                if (ocrRegion.width <= 12) {
                    if (debugLog) log.debug(`OCR区域过小，放弃识别: 宽度=${ocrRegion.width}`);
                    return false;
                }
            }
            retryCount++;
            await sleep(retryInterval);
            continue;
        }

        for (let res of resList) {
            let text = res.text;
            text = text.split('').map(char => numberReplaceMap[char] || char).join('');
            // results.push(text);

            if (!frequencyMap[text]) {
                frequencyMap[text] = 0;
            }
            frequencyMap[text]++;

            if (frequencyMap[text] >= 2) {
                return text;
            }
        }

        await sleep(retryInterval);
    }

    const sortedResults = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a]);
    if (sortedResults.length === 0) {
        const templateMatchResult = await recognizeNumberByTemplate(ra, ocrRegion);
        if (templateMatchResult) {
            return templateMatchResult;
        }
        if (debugLog) log.warn(`OCR识别失败 - 区域: x=${ocrRegion.x}, y=${ocrRegion.y}, 宽=${ocrRegion.width}, 高=${ocrRegion.height}`);
        saveFailedOcrRegion(ra, ocrRegion);
    } else {
        if (debugLog) log.debug(`OCR识别结果: ${sortedResults[0]} (出现${frequencyMap[sortedResults[0]]}次)`);
    }
    return sortedResults.length > 0 ? sortedResults[0] : false;
}

// 模板匹配识别数字
async function recognizeNumberByTemplate(ra, ocrRegion) {
    const regionDir = "assets/regions";
    const numberFiles = readAllFilePaths(regionDir, 0, 1, ['.png']);

    // 先把模板全部读入并按宽度降序：长数字模板优先，避免 4 位被 5 位、1~2 位被长数字抢先命中
    const templates = [];
    for (const filePath of numberFiles) {
        const num = parseInt(basename(filePath).replace('.png', ''), 10);
        if (isNaN(num)) continue;

        const templateMat = file.readImageMatSync(filePath);
        if (templateMat.empty()) continue;

        templates.push({ num, templateMat, width: templateMat.cols });
    }
    templates.sort((a, b) => b.width - a.width);

    for (const { num, templateMat } of templates) {
        const expandPx = 5;
        const matchX = ocrRegion.x;
        const matchY = ocrRegion.y - expandPx;
        const matchW = ocrRegion.width;
        const matchH = ocrRegion.height + 2 * expandPx;
        
        const matchRo = RecognitionObject.TemplateMatch(
            templateMat,
            matchX,
            matchY,
            matchW,
            matchH
        );
        matchRo.threshold = 0.8;
        
        const result = ra.find(matchRo);
        if (result.isExist()) {
            if (debugLog) log.info(`[模板匹配] ${num}.png 识别成功`);
            return String(num);
        }
    }
    
    return null;
}

// 优化后的滑动页面函数（基于通用函数）
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    await mouseDrag({
        holdMouseX: holdX, // 固定起点X
        holdMouseY: holdY, // 固定起点Y
        totalDistance: totalDistance, // 原逻辑中是向上滑动（原代码中是-moveDistance）
        stepDistance,
        stepInterval: delayMs,
        waitBefore: 50,
        waitAfter: 500, // 原逻辑中松开后等待700ms
        repeat: 1
    });
}

// 重置材料滑条到顶端（复用扫描里长按滑条顶部的动作）
async function resetMaterialSlider() {
    await moveMouseTo(1288, 124);
    await sleep(200);
    leftButtonDown();
    await sleep(300);
    leftButtonUp();
    await sleep(300);
}

// 载入“养成道具”页（materialTypeMap 值="3" 的 6 类）全部材料模板到 globalMaterialImageCache，返回 [{name, mat}]
function loadCultivationTemplates() {
    const cats = Object.keys(materialTypeMap).filter(c => materialTypeMap[c] === '3');
    const list = [];
    const seen = new Set();
    for (const cat of cats) {
        let paths = [];
        try { paths = file.ReadPathSync(`assets/images/${cat}`); } catch (e) { continue; }
        for (const fp of paths) {
            const name = basename(fp).replace('.png', '');
            if (seen.has(name)) continue;
            if (!globalMaterialImageCache[name]) {
                const mat = getCachedImageMat(fp);
                if (!mat || mat.empty()) continue;
                globalMaterialImageCache[name] = mat;
            }
            seen.add(name);
            list.push({ name, mat: globalMaterialImageCache[name] });
        }
    }
    return list;
}

// 扫列 1 并按 y 升序返回 [{name, x, y}]（region: x=startX, y=startY, w=columnWidth, 底到 y=950）
async function scanColumn1(ra, templates, x, y, w, bottom) {
    const res = await parallelTemplateMatch(ra, templates, x, y, w, bottom - y, 0.8);
    return res.filter(r => r.result).map(r => ({ name: r.name, x: r.result.x, y: r.result.y })).sort((a, b) => a.y - b.y);
}

// 背包翻页标定：开背包→养成页→扫列1取第1/第5材料→迭代拖动标定“1页”距离
//   （第五个材料落到原第一个位置、绝不过冲）→写 user/pageFlip.json
async function runBagFlipCalib() {
    const COL_X = 117, COL_Y = 121, COL_W = 123, COL_BOTTOM = 950; // 列1几何(同 scanMaterials)
    const TOL = 6;        // 命中容差(px)
    const MAX_TRIES = 10; // 最多迭代次数

    log.info('【翻页标定】开始：进入背包→养成道具页…');
    await genshin.returnMainUi();
    await sleep(600);
    keyPress('B');
    await sleep(900);
    let ra = captureGameRegion();
    const bag = await recognizeImage(BagpackRo, ra, 2000, 500, true, '背包');
    ra?.dispose();
    if (!bag.isDetected) { log.error('【翻页标定】未识别到背包图标，终止'); return; }

    click(Math.round(575 + (3 - 1) * 96.25), 75);  // 养成道具页(offset=3)
    await sleep(600);
    await resetMaterialSlider();                    // 重置滑条

    ra = captureGameRegion();
    const templates = loadCultivationTemplates();
    if (!templates.length) { ra?.dispose(); log.error('【翻页标定】养成类材料模板为空，终止'); return; }
    const base = await scanColumn1(ra, templates, COL_X, COL_Y, COL_W, COL_BOTTOM);
    ra?.dispose();
    log.info(`【翻页标定】列1命中 ${base.length} 个材料`);
    if (base.length < 5) { log.error('【翻页标定】列1不足 5 个材料，无法标定（请确认已在有≥5个材料的养成页）'); return; }

    const m1 = base[0], m5 = base[base.length - 1]; // m5=列1命中里 y 最大(最底)那个，非写死下标
    const baseY = m1.y;          // 原第一个材料位置（目标落点）
    const gap = m5.y - m1.y;     // 理论 1 页滚动量
    const m5mat = templates.find(t => t.name === m5.name);
    log.info(`【翻页标定】m1=${m1.name}@y${m1.y}  m5=${m5.name}@y${m5.y}  gap=${gap}`);

    // 初始拖动距离：设置项已填→用它；否则用 gap
    let D = Math.max(10, Math.floor(Number(settings.PageScrollDistance) || gap));
    const attempts = [];
    let best = null;             // 未过冲里最接近 0 的 {D, delta}
    let overFloor = Infinity;    // 最小“过冲”D 作为硬上界：最终 D 必须 < 它

    for (let i = 0; i < MAX_TRIES; i++) {
        await resetMaterialSlider();
        await scrollPage(-D, 10, 5);   // 上滑 D
        await sleep(400);
        let r = captureGameRegion();
        const res = m5mat ? await parallelTemplateMatch(r, [m5mat], COL_X, COL_Y - 60, COL_W, COL_BOTTOM - (COL_Y - 60), 0.8) : [];
        r?.dispose();
        const hit = res.find(x => x.result);
        let outcome, delta;
        if (!hit) { outcome = 'notfound'; delta = null; }   // 顶出可视区＝已过冲
        else {
            delta = hit.result.y - baseY;
            outcome = (Math.abs(delta) <= TOL) ? 'hit' : (delta > TOL ? 'under' : 'over');
        }
        attempts.push({ try: i + 1, D, outcome, delta });
        log.info(`【翻页标定】第${i + 1}次 D=${D} → ${outcome}${delta === null ? '' : ` (Δ=${delta})`}`);

        if (outcome === 'over' || outcome === 'notfound') {
            if (D < overFloor) overFloor = D;   // 记录过冲下界
            const reduce = delta === null ? 20 : Math.abs(delta);
            D = Math.max(10, Math.min(D - reduce, overFloor - 1));
            continue;
        }
        if (outcome === 'hit') {
            if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { D, delta };
            break;
        }
        // under：不足→按比例增 D（滚动≈拖动，delta 即还差多少）；绝不越过上界
        let nd = D + delta;
        if (overFloor !== Infinity && nd >= overFloor) nd = overFloor - 1;
        D = Math.max(10, Math.floor(nd));
    }

    let result = best;
    if (!result) {
        const unders = attempts.filter(a => a.outcome === 'under');
        if (unders.length) { const last = unders[unders.length - 1]; result = { D: last.D, delta: last.delta }; }
    }
    if (!result) { log.error('【翻页标定】未能得到有效距离（全部过冲？），不写文件'); return; }

    const payload = {
        pageFlipDistance: result.D, gap, holdX, holdY, baseY, tol: TOL,
        m1: { name: m1.name, y: m1.y }, m5: { name: m5.name, y: m5.y },
        attempts, time: new Date().toString()
    };
    try {
        writeFile('user/pageFlip.json', JSON.stringify(payload, null, 2), false);
        log.info(`【翻页标定】完成：1页距离=${result.D}px（gap=${gap}）已写 user/pageFlip.json`);
    } catch (e) { log.error('【翻页标定】写文件失败: ' + e.message); }

    await resetMaterialSlider(); // 收尾复位
}

// 回退翻页函数（用于后续优先级材料扫描）
async function scrollBackPage(totalDistance, stepDistance = 10, delayMs = 5) {
    const backHoldY = 1080 - holdY; // 回退翻页的Y值
    await mouseDrag({
        holdMouseX: holdX, // 固定起点X
        holdMouseY: backHoldY, // 回退翻页的Y值
        totalDistance: totalDistance, // 向下滑动（正值）
        stepDistance,
        stepInterval: delayMs,
        waitBefore: 50,
        waitAfter: 500,
        repeat: 1
    });
}

// 并行模板匹配函数
async function parallelTemplateMatch(ra, materials, x, y, width, height, threshold = 0.8, enableMouseMove = true, enableColorCheck = true) {
    const matchPromises = materials.map(({ name, mat }) => {
        return new Promise((resolve) => {
            try {
                const recognitionObject = RecognitionObject.TemplateMatch(mat, x, y, width, height);
                recognitionObject.threshold = threshold;
                // recognitionObject.Use3Channels = true;
                
                const result = ra.find(recognitionObject);
                if (result.isExist() && result.x !== 0 && result.y !== 0) {
                    if (enableColorCheck && typeof compareColor === 'function') {
                        const colorCheck = compareColor(mat, ra, result);
                        if (!colorCheck.isMatch) {
                            if (debugLog) log.debug(`颜色验证失败 [${name}]: avgDiff=${JSON.stringify(colorCheck.avgDiff)}, stdDiff=${JSON.stringify(colorCheck.stdDiff)}`);
                            resolve({ name, result: null, failureReason: '颜色验证失败' });
                            return;
                        }
                    }
                    if (enableMouseMove) {
                        moveMouseTo(result.x, result.y);
                    }
                    resolve({ name, result, failureReason: null });
                } else {
                    resolve({ name, result: null, failureReason: '模板匹配未找到' });
                }
            } catch (error) {
                log.error(`并行模板匹配错误: ${name} - ${error.message}`);
                resolve({ name, result: null, failureReason: `异常: ${error.message}` });
            }
        });
    });
    
    return await Promise.all(matchPromises);
}

// 智能OCR识别函数
async function smartRecognizeText(ocrRegion, ra, quickMode = true) {
    if (quickMode) {
        // 快速模式：超时50ms，只尝试1次
        return await recognizeText(ocrRegion, 50, 10, 1, 1, ra);
    } else {
        // 正常模式：超时100ms，尝试3次
        return await recognizeText(ocrRegion, 100, 20, 3, 2, ra);
    }
}

// 批量OCR处理函数
async function batchRecognizeText(ocrRegions, ra, timeout = 200, retryInterval = 10, maxAttempts = 5, maxFailures = 2, quickMode = true) {
    const ocrPromises = ocrRegions.map(({ region, name }) => {
        return new Promise((resolve) => {
            smartRecognizeText(region, ra, quickMode)
                .then(result => {
                    if (result === false && debugLog) {
                        log.debug(`批量OCR失败: ${name} - 区域: x=${region.x}, y=${region.y}`);
                    }
                    resolve({ name, result });
                })
                .catch(error => {
                    log.error(`批量OCR错误: ${name} - ${error.message}`);
                    resolve({ name, result: false });
                });
        });
    });
    
    return await Promise.all(ocrPromises);
}

// 合并OCR区域函数（用于密集区域的批量处理）
function mergeOcrRegions(regions) {
    if (regions.length === 0) return [];
    
    // 按y坐标排序
    regions.sort((a, b) => a.region.y - b.region.y);
    
    const merged = [];
    let currentMerge = { ...regions[0] };
    
    for (let i = 1; i < regions.length; i++) {
        const region = regions[i];
        // 检查是否可以合并（垂直距离小于阈值）
        if (region.region.y - (currentMerge.region.y + currentMerge.region.height) < 20) {
            // 合并区域
            currentMerge.region.width = Math.max(currentMerge.region.width, region.region.width);
            currentMerge.region.height = region.region.y + region.region.height - currentMerge.region.y;
            currentMerge.name += `,${region.name}`;
        } else {
            merged.push(currentMerge);
            currentMerge = { ...region };
        }
    }
    merged.push(currentMerge);
    
    return merged;
}

// 通用鼠标拖动函数（提取重复逻辑）
/**
 * 通用鼠标拖动工具函数
 * @param {Object} options 拖动参数
 * @param {number} [options.holdX] 拖动起点X坐标（默认当前鼠标位置）
 * @param {number} [options.holdY] 拖动起点Y坐标（默认当前鼠标位置）
 * @param {number} options.totalDistance 总拖动距离（垂直方向，正数向下，负数向上）
 * @param {number} [options.stepDistance=10] 每步拖动距离
 * @param {number} [options.stepInterval=20] 步间隔时间(ms)
 * @param {number} [options.waitBefore=50] 按下左键前的等待时间(ms)
 * @param {number} [options.waitAfter=100] 拖动结束后的等待时间(ms)
 * @param {number} [options.repeat=1] 重复拖动次数
 * @param {Object} [options.state] 状态对象（用于外部控制中断）
 */
async function mouseDrag({
    holdMouseX,
    holdMouseY,
    totalDistance,
    stepDistance = 10,
    stepInterval = 20,
    waitBefore = 50,
    waitAfter = 100,
    repeat = 1,
    state = { isRunning: true }
}) {
    try {
        // 移动到起点（如果指定了起点）
        if (holdMouseX !== undefined && holdMouseY !== undefined) {
            moveMouseTo(holdMouseX, holdMouseY);
            await sleep(waitBefore);
        }

        leftButtonDown();
        await sleep(waitBefore); // 按下后短暂等待

        for (let r = 0; r < repeat; r++) {
            if (!state.isRunning) break;

            const steps = Math.ceil(Math.abs(totalDistance) / stepDistance);
            const direction = totalDistance > 0 ? 1 : -1; // 方向：正向下，负向上

            for (let s = 0; s < steps; s++) {
                if (!state.isRunning) break;
                // 计算当前步实际移动距离（最后一步可能不足stepDistance）
                const remaining = Math.abs(totalDistance) - s * stepDistance;
                const move = Math.min(stepDistance, remaining) * direction;
                moveMouseBy(0, move); // 垂直拖动
                await sleep(stepInterval);
            }

            // 更新进度（如果有状态对象）
            if (state) {
                state.progress = Math.min(100, Math.round((r + 1) / repeat * 100));
            }
            await sleep(waitAfter);
        }

        leftButtonUp();
        await sleep(waitBefore); // 松开后等待稳定
    } catch (e) {
        log.error(`拖动出错: ${e.message}`);
        leftButtonUp(); // 确保鼠标抬起，避免卡死
    }
}

function filterMaterialsByPriority(materialsCategory) {
    const currentPriority = materialPriority[materialsCategory];
    if (currentPriority === undefined) {
        throw new Error(`Invalid materialsCategory: ${materialsCategory}`);
    }

    const currentType = materialTypeMap[materialsCategory];
    if (currentType === undefined) {
        throw new Error(`Invalid materialTypeMap for: ${materialsCategory}`);
    }

    const allSameTypeMaterials = Object.keys(materialPriority)
        .filter(mat => materialTypeMap[mat] === currentType);

    const finalFilteredMaterials = allSameTypeMaterials.sort((a, b) => materialPriority[a] - materialPriority[b]);
    return finalFilteredMaterials
}

    // 扫描材料
async function performFullColumnScan(ra, materialCategories, materialImages, recognizedMaterials, startX, startY, columnWidth, columnHeight, maxColumns, OffsetWidth, tolerance, unmatchedReasons, yStart = null, yEnd = null) {
    const ocrRegions = [];
    const cellHeight = 152;
    const pageBottom = startY + columnHeight;
    // 扫描区间一律用第八列实测 y（yStart/yEnd），不按行号乘行距
    const scanYStart = Math.max(startY, Math.min(pageBottom, yStart === null ? startY : yStart));
    const scanYEnd = Math.max(scanYStart, Math.min(pageBottom, yEnd === null ? pageBottom : yEnd));
    
    for (let column = 0; column < maxColumns; column++) {
        const scanX0 = startX + column * OffsetWidth;
        const scanX = Math.round(scanX0);
        
        const materialsToMatch = materialCategories
            .filter(({ name }) => !recognizedMaterials.has(name))
            .map(({ name }) => {
                const mat = materialImages[name];
                return mat ? { name, mat } : null;
            })
            .filter(Boolean);
        
        if (materialsToMatch.length > 0) {
            // 按实测 y 裁剪：只在已定位的区间内匹配
            const yTop = scanYStart;
            const matchHeight = Math.max(cellHeight, scanYEnd - scanYStart);
            const matchResults = await parallelTemplateMatch(ra, materialsToMatch, scanX, yTop, columnWidth, matchHeight, 0.8);
            
            const positionGroups = new Map();
            for (const { name, result, failureReason } of matchResults) {
                if (result) {
                    const positionKey = `${Math.floor(result.x / 10)},${Math.floor(result.y / 10)}`;
                    if (!positionGroups.has(positionKey)) {
                        positionGroups.set(positionKey, []);
                    }
                    positionGroups.get(positionKey).push({ name, result, failureReason });
                }
            }
            
            for (const group of positionGroups.values()) {
                if (group.length > 1) {
                    if (debugLog) log.debug(`位置冲突: ${group.map(g => g.name).join(', ')}, 只保留 ${group[0].name}`);
                }
                const { name, result, failureReason } = group[0];
                recognizedMaterials.add(name);
                const ocrRegion = {
                    x: result.x - tolerance,
                    y: result.y + 97 - tolerance,
                    width: 66 + 2 * tolerance,
                    height: 22 + 2 * tolerance
                };
                ocrRegions.push({ region: ocrRegion, name });
            }
            
            for (const { name, result, failureReason } of matchResults) {
                if (!result && failureReason && !unmatchedReasons.has(name)) {
                    unmatchedReasons.set(name, failureReason);
                }
            }
        }
    }
    
    return ocrRegions;
}

async function scanMaterials(materialsCategory, materialCategoryMap, isPostPriority = false, pathingMode = null) {
    // 使用全局图片缓存
    const materialImages = globalMaterialImageCache;

    // 如果没有传入pathingMode，使用全局变量（向后兼容）
    const mode = pathingMode || globalThis.pathingMode;

    const currentType = materialTypeMap[materialsCategory];
    const currentPriority = materialPriority[materialsCategory];
    
    const priorityMaterialNames = [];
    const finalFilteredMaterials = await filterMaterialsByPriority(materialsCategory);
    
    const currentTypeMaterials = finalFilteredMaterials.filter(category => materialTypeMap[category] === currentType);
    
    for (const category of currentTypeMaterials) {
        const materialIconDir = `assets/images/${category}`;
        const materialIconFilePaths = file.ReadPathSync(materialIconDir);
        for (const filePath of materialIconFilePaths) {
            const name = basename(filePath).replace(".png", "");
            priorityMaterialNames.push({ category, name });
            
            if (!materialImages[name]) {
                const mat = getCachedImageMat(filePath);
                if (!mat.empty()) {
                    materialImages[name] = mat;
                }
            }
        }
    }

    // 根据材料分类获取对应的材料图片文件夹路径
    const materialIconDir = `assets/images/${materialsCategory}`;

    // 使用 ReadPathSync 读取所有材料图片路径
    const materialIconFilePaths = file.ReadPathSync(materialIconDir);

    // 创建材料种类集合
    const materialCategories = [];
    const allMaterials = new Set(); // 用于记录所有需要扫描的材料名称

    // 检查 materialCategoryMap 中当前分类的数组是否为空
    const categoryMaterials = materialCategoryMap[materialsCategory] || [];
    const shouldScanAllMaterials = categoryMaterials.length === 0; // 如果为空，则扫描所有材料

    for (const filePath of materialIconFilePaths) {
        const name = basename(filePath).replace(".png", ""); // 去掉文件扩展名

        // 如果 materialCategoryMap 中当前分类的数组不为空
        // 且当前材料名称不在指定的材料列表中，则跳过加载
        if (mode.onlyPathing && !shouldScanAllMaterials && !categoryMaterials.includes(name)) {
            continue;
        }

        const mat = getCachedImageMat(filePath);
        if (mat.empty()) {
            log.error(`加载图标失败：${filePath}`);
            continue; // 跳过当前文件
        }

        materialCategories.push({ name, filePath });
        allMaterials.add(name); // 将材料名称添加到集合中
        materialImages[name] = mat; // 缓存图片
    }

    // 已识别的材料集合，避免重复扫描
    const recognizedMaterials = new Set();
    const unmatchedMaterialNames = new Set(); // 未匹配的材料名称
    const materialInfo = []; // 存储材料名称和数量
    const unmatchedReasons = new Map(); // 记录未匹配材料的原因

    // 扫描参数
    const tolerance = 1;
    const startX = 117;
    const startY = 121;
    const OffsetWidth = 146.428; // 146.428
    const columnWidth = 123;
    const columnHeight = 710;
    const maxColumns = 8;

    // 载入页签总序，并取目标小分类在总序中的连续区间
    loadMaterialOrder();
    const targetSegment = getSegment(materialsCategory);
    if (!targetSegment) {
        log.warn(`总序中未能定位分类 ${materialsCategory} 的区间，全列扫描将保持整页范围`);
    }
    // 跟踪已截图的区域（避免重复）
    const capturedRegions = new Set(); 

    // 扫描状态
    let hasFoundFirstMaterial = false;
    let lastFoundTime = null;
    let shouldEndScan = false;
    let foundPriorityMaterial = false;
    let isEighthColumnScan = false; // 当前是否为第八列扫描（用于跳过5秒超时终止）
    let hasStartedFullColumnScan = false; // 是否已经开始过全列扫描（用于开启5秒翻页终止检测）

    // 俏皮话逻辑
    const scanPhrases = [
        "... 太好啦，有这么多素材！",
        "... 不错的珍宝！",
        "... 侦查骑士，发现目标！",
        "... 嗯哼，意外之喜！",
        "... 嗯？",
        "... 很好，没有放过任何角落！",
        "... 会有烟花材料嘛？",
        "... 嗯，这是什么？",
        "... 这些宝藏积灰了，先清洗一下",
        "... 哇！都是好东西！",
        "... 不虚此行！",
        "... 瑰丽的珍宝，令人欣喜。",
        "... 是对长高有帮助的东西吗？",
        "... 嗯！品相卓越！",
        "... 虽无法比拟黄金，但终有价值。",
        "... 收获不少，可以拿去换几瓶好酒啦。",
        "... 房租和伙食费，都有着落啦！",
        "... 还不赖。",
        "... 荒芜的世界，竟藏有这等瑰宝。",
        "... 运气还不错。",
    ];

    let tempPhrases = [...scanPhrases];
    tempPhrases.sort(() => Math.random() - 0.5); // 打乱数组顺序，确保随机性
    let phrasesStartTime = Date.now();
    let previousScreenshot = null; // 用于存储上一次翻页前的截图
    
    // 后续优先级材料扫描：滑条重置后先检查第八列是否有前位材料
    if (isPostPriority) {
        if (debugLog) log.info(`后续优先级材料扫描 - 检查第八列前位材料`);
        
        let backPageCount = 0;
        let foundLowerPriority = false;
        
        while (backPageCount < pageScrollCount && !foundLowerPriority) {
            const ra = captureGameRegion();
            
            const lowerPriorityMaterials = currentTypeMaterials.filter(category => materialPriority[category] < currentPriority);
            if (debugLog) log.info(`检查前位材料分类: ${lowerPriorityMaterials.map(c => `${c}(优先级${materialPriority[c]})`).join(', ')}`);
            const lowerPriorityMatches = [];
            
            for (const category of lowerPriorityMaterials) {
                const categoryMaterials = priorityMaterialNames
                    .filter(({ name, category: cat }) => cat === category && !recognizedMaterials.has(name))
                    .map(({ name }) => {
                        const mat = materialImages[name];
                        return mat ? { name, mat } : null;
                    })
                    .filter(Boolean);
            
                if (categoryMaterials.length > 0) {
                    const matchResults = await parallelTemplateMatch(ra, categoryMaterials, 1142, startY, columnWidth, columnHeight, 0.8);
                    const foundMaterials = matchResults.filter(r => r.result).map(r => r.name);
                    if (foundMaterials.length > 0) {
                        if (debugLog) log.info(`第八列识别到前位材料 [${category}]: ${foundMaterials.join(', ')}`);
                    }
                    lowerPriorityMatches.push(...matchResults.filter(r => r.result));
                }
            }
            
            if (lowerPriorityMatches.length > 0) {
                foundLowerPriority = true;
                if (debugLog) log.info(`发现前位材料，照常继续扫描`);
            } else {
                backPageCount++;
                if (backPageCount < pageScrollCount) {
                    if (debugLog) log.info(`未发现前位材料，回退一页 (${backPageCount}/${pageScrollCount})`);
                    await scrollBackPage(totalPageDistance, 10, 5);
                    await sleep(500);
                } else {
                    if (debugLog) log.info(`已回退${pageScrollCount}页，仍未发现前位材料，继续扫描`);
                }
            }
        }
    }
    
    // 扫描背包中的材料
    for (let scroll = 0; scroll <= pageScrollCount; scroll++) {

        const ra = captureGameRegion();
        foundPriorityMaterial = false;
        
        const finalFilteredMaterials = await filterMaterialsByPriority(materialsCategory);
        
        const currentTypeMaterials = finalFilteredMaterials.filter(category => materialTypeMap[category] === currentType);
        
        if (debugLog) log.info(`第八列扫描 - 当前分类: ${materialsCategory}, 优先级: ${currentPriority}`);
        isEighthColumnScan = true; // 标记当前为第八列扫描
        const eighthHits = []; // 第八列命中格（带 y），用于推出目标段所在行
        
        if (currentPriority <= 2) {
            const lowerPriorityMaterials = currentTypeMaterials.filter(category => materialPriority[category] < currentPriority);
            if (debugLog) log.info(`检查前位材料分类: ${lowerPriorityMaterials.map(c => `${c}(优先级${materialPriority[c]})`).join(', ')}`);
            const lowerPriorityMatches = [];
            
            for (const category of lowerPriorityMaterials) {
                const categoryMaterials = priorityMaterialNames
                    .filter(({ name, category: cat }) => cat === category && !recognizedMaterials.has(name))
                    .map(({ name }) => {
                        const mat = materialImages[name];
                        return mat ? { name, mat } : null;
                    })
                    .filter(Boolean);
                
                if (categoryMaterials.length > 0) {
                    const matchResults = await parallelTemplateMatch(ra, categoryMaterials, 1142, startY, columnWidth, columnHeight, 0.8);
                    const foundMaterials = matchResults.filter(r => r.result).map(r => r.name);
                    if (foundMaterials.length > 0 && debugLog) {
                        if (debugLog) log.info(`第八列识别到前位材料 [${category}]: ${foundMaterials.join(', ')}`);
                    }
                    const hits = matchResults.filter(r => r.result);
                    lowerPriorityMatches.push(...hits);
                    eighthHits.push(...hits.map(r => ({ name: r.name, y: r.result.y, row: rowFromY(r.result.y, startY), result: r.result })));
                }
            }

            // 已进入全列扫描后，追加同页签后位材料命中，用于判断是否已翻过目标段（提前结束）
            if (hasStartedFullColumnScan) {
                const higherPriorityMaterials = currentTypeMaterials.filter(c => materialPriority[c] > currentPriority);
                for (const category of higherPriorityMaterials) {
                    const categoryMaterials = priorityMaterialNames
                        .filter(({ name, category: cat }) => cat === category && !recognizedMaterials.has(name))
                        .map(({ name }) => {
                            const mat = materialImages[name];
                            return mat ? { name, mat } : null;
                        })
                        .filter(Boolean);
                    if (categoryMaterials.length > 0) {
                        const matchResults = await parallelTemplateMatch(ra, categoryMaterials, 1142, startY, columnWidth, columnHeight, 0.8);
                        const hits = matchResults.filter(r => r.result);
                        eighthHits.push(...hits.map(r => ({ name: r.name, y: r.result.y, row: rowFromY(r.result.y, startY), result: r.result })));
                    }
                }
            }

            if (debugLog) log.info(`第八列前位材料总数: ${lowerPriorityMatches.length}`);
            if (lowerPriorityMatches.length < 4) {
                if (debugLog) log.info(`前位材料少于4张，触发全列扫描`);
                foundPriorityMaterial = true;
            } else {
                if (debugLog) log.info(`4张都是前位材料，继续翻页`);
            }
        } else {
            const currentOrHigherPriorityMaterials = currentTypeMaterials.filter(category => materialPriority[category] >= currentPriority);
            if (debugLog) log.info(`检查同位/后位材料分类: ${currentOrHigherPriorityMaterials.map(c => `${c}(优先级${materialPriority[c]})`).join(', ')}`);
            const currentOrHigherMatches = [];
            
            for (const category of currentOrHigherPriorityMaterials) {
                const categoryMaterials = priorityMaterialNames
                    .filter(({ name, category: cat }) => cat === category && !recognizedMaterials.has(name))
                    .map(({ name }) => {
                        const mat = materialImages[name];
                        return mat ? { name, mat } : null;
                    })
                    .filter(Boolean);
                
                if (categoryMaterials.length > 0) {
                    const matchResults = await parallelTemplateMatch(ra, categoryMaterials, 1142, startY, columnWidth, columnHeight, 0.8);
                    const foundMaterials = matchResults.filter(r => r.result).map(r => r.name);
                    if (foundMaterials.length > 0 && debugLog) {
                        if (debugLog) log.info(`第八列识别到同位/后位材料 [${category}]: ${foundMaterials.join(', ')}`);
                    }
                    const hits = matchResults.filter(r => r.result);
                    currentOrHigherMatches.push(...hits);
                    eighthHits.push(...hits.map(r => ({ name: r.name, y: r.result.y, row: rowFromY(r.result.y, startY), result: r.result })));
                }
            }
            
            if (debugLog) log.info(`第八列同位/后位材料总数: ${currentOrHigherMatches.length}`);
            if (currentOrHigherMatches.length > 0) {
                if (debugLog) log.info(`发现同位/后位材料，触发全列扫描`);
                foundPriorityMaterial = true;
            } else {
                if (debugLog) log.info(`未发现同位/后位材料，继续翻页`);
            }
        }
    
    // 只有发现目标材料时，才执行全列扫描
    let scanRows = null;
    if (foundPriorityMaterial) {
        // 用第八列命中格的实测 y + 总序，推出本次要扫的 y 区间
        if (targetSegment && eighthHits.length > 0) {
            scanRows = computeScanRows(eighthHits, targetSegment, scroll, startY, columnHeight);
        }

        if (scanRows && scanRows.yEnd <= scanRows.yStart) {
            // 区间为空，本页无需扫描
            if (debugLog) log.info(`扫描区间为空（y ${scanRows.yStart}~${scanRows.yEnd}），本页跳过`);
        } else {
            const scanYStart = scanRows ? scanRows.yStart : null;
            const scanYEnd = scanRows ? scanRows.yEnd : null;
            if (debugLog) {
                const hitDesc = eighthHits.map(h => `${h.name}@y${h.y}(第${rowFromY(h.y, startY) + 1}行)`).join(', ');
                log.info(`列8命中 ${eighthHits.length} 格 [${hitDesc}] -> ${scanRows ? `扫描 y ${scanYStart}-${scanYEnd} (${scanRows.reason})` : `扫描整页 (总序不可定)`}`);
            }
            if (debugLog) log.info(`开始全列扫描`);
            hasStartedFullColumnScan = true; // 标记已经开始全列扫描（后续所有翻页都执行终止检测）
            const ocrRegions = await performFullColumnScan(ra, materialCategories, materialImages, recognizedMaterials, startX, startY, columnWidth, columnHeight, maxColumns, OffsetWidth, tolerance, unmatchedReasons, scanYStart, scanYEnd);

            // 批量处理OCR
            if (ocrRegions.length > 0) {
                const ocrResults = await batchRecognizeText(ocrRegions, ra);

                // 处理OCR结果
                for (const { name, result } of ocrResults) {
                    materialInfo.push({ name, count: result || "?" });
                }

                // 更新最后发现材料的时间
                hasFoundFirstMaterial = true;
                lastFoundTime = Date.now();
            }
        }
    } else {
        if (debugLog) log.info(`未发现目标材料，跳过`);
    }

    // 列8已出现后位材料（目标段整段翻过）→ 本页扫完立即结束，省去后续翻页与5秒超时等待
    if (scanRows && scanRows.past) {
        log.info(`列8已翻过目标段，提前结束扫描`);
        shouldEndScan = true;
        break;
    }

        // 每5秒输出一句俏皮话
        const phrasesTime = Date.now();
        if (phrasesTime - phrasesStartTime >= 5000) {
            const selectedPhrase = tempPhrases.shift();
            log.info(selectedPhrase);
            if (tempPhrases.length === 0) {
                tempPhrases = [...scanPhrases];
                tempPhrases.sort(() => Math.random() - 0.5);
            }
            phrasesStartTime = phrasesTime;
        }

        // 检查是否结束扫描
        if (recognizedMaterials.size === allMaterials.size) {
            log.info("所有材料均已识别！");
            shouldEndScan = true;
            break;
        }

        // 检查是否需要启动画面比较兜底逻辑
        let useScreenComparison = false;
        if (!shouldEndScan && scroll < pageScrollCount && previousScreenshot) {
            // 检查是否满足兜底条件：
            // 1. 已找到至少一个材料，但长时间未发现新材料
            // 2. 或连续多次未发现任何材料
            // 注意：第八列扫描时不触发兜底逻辑
            if (recognizedMaterials.size > 0) {
                const noNewMaterialTime = Date.now() - lastFoundTime;
                if (noNewMaterialTime > 5000 && !isEighthColumnScan) { // 5秒未发现新材料，且不是第八列扫描
                    useScreenComparison = true;
                    log.info(`5秒未发现新材料，启动画面比较兜底逻辑`);
                }
            } else if (scroll > 2 && !isEighthColumnScan) { // 连续翻页2次以上仍未发现任何材料，且不是第八列扫描
                useScreenComparison = true;
                log.info(`连续翻页${scroll}次未发现任何材料，启动画面比较兜底逻辑`);
            }
        }

        isEighthColumnScan = false; // 第八列扫描结束，重置标志

        // 5秒未发现新材料时结束扫描，只有开始全列扫描后才允许执行此检测
        if (hasStartedFullColumnScan && hasFoundFirstMaterial && Date.now() - lastFoundTime > 5000) {
            log.info("全列扫描模式下未发现新的材料，结束扫描");
            shouldEndScan = true;
            break;
        }

        // 检查是否到达最后一页（使用画面比较替代滑条检测）
        // 注：画面比较逻辑已集成到翻页操作中


        // 捕获当前翻页前的截图（用于与下一次翻页前的截图比较）
        const currentScreenshot = {
            region: { x: 400, y: 400, width: 600, height: 100 }, // 长条形状比较区域
            mat: ra.DeriveCrop(400, 400, 600, 100).SrcMat // 外扩1像素
        };
        
        // 滑动到下一页
        if (scroll < pageScrollCount && !shouldEndScan) {
            if (useScreenComparison && previousScreenshot) {
                // 使用模板匹配比较两次翻页前的截图（兜底机制）
                const matchRo = RecognitionObject.TemplateMatch(
                    previousScreenshot.mat,
                    previousScreenshot.region.x - 1,
                    previousScreenshot.region.y - 1,
                    previousScreenshot.region.width + 2,
                    previousScreenshot.region.height + 2
                );
                matchRo.threshold = 0.85; // 高阈值，确保区域变化足够明显
                // matchRo.Use3Channels = true;
                
                const matchResult = ra.find(matchRo);
                if (matchResult.isExist()) {
                    log.info("连续翻页画面无明显变化，执行最后一次全列扫描");
                    
                    const ocrRegions = await performFullColumnScan(ra, materialCategories, materialImages, recognizedMaterials, startX, startY, columnWidth, columnHeight, maxColumns, OffsetWidth, tolerance, unmatchedReasons);
                    
                    if (ocrRegions.length > 0) {
                        const ocrResults = await batchRecognizeText(ocrRegions, ra);
                        for (const { name, result } of ocrResults) {
                            materialInfo.push({ name, count: result || "?" });
                        }
                        
                        // 更新最后发现材料的时间
                        hasFoundFirstMaterial = true;
                        lastFoundTime = Date.now();
                    }
                    
                    log.info("最后一次全列扫描完成，结束扫描");
                    shouldEndScan = true;
                    break;
                } else {
                    log.info("连续翻页画面有变化，继续扫描");
                }
            }
            
            // 执行翻页
            await scrollPage(-totalPageDistance, 10, 5);
            // 兜底逻辑启动时增加等待时间，确保画面稳定
            const scrollDelay = useScreenComparison ? 500 : 50;
            await sleep(scrollDelay);
        }
        
        // 更新上一次的截图
        previousScreenshot = currentScreenshot;
    }

    // 处理未匹配的材料
    for (const name of allMaterials) {
        if (!recognizedMaterials.has(name)) {
            unmatchedMaterialNames.add(name);
            if (!unmatchedReasons.has(name)) {
                unmatchedReasons.set(name, '未在扫描区域发现');
            }
        }
    }

    // 将未匹配的材料添加到结果中，数量设为0
    for (const name of unmatchedMaterialNames) {
        materialInfo.push({ name, count: 0 });
    }

    // 统计未匹配原因（只统计最终未匹配的材料）
    const failureReasonStats = {};
    for (const name of unmatchedMaterialNames) {
        const reason = unmatchedReasons.get(name) || '未在扫描区域发现';
        if (!failureReasonStats[reason]) {
            failureReasonStats[reason] = [];
        }
        failureReasonStats[reason].push(name);
    }

    // 日志记录
    const now = new Date();
    const formattedTime = now.toLocaleString();
    const scanMode = shouldScanAllMaterials ? "全材料扫描" : "指定材料扫描";
    
    // 构建未匹配原因详细日志
    let failureReasonLog = "";
    if (unmatchedMaterialNames.size > 0) {
        failureReasonLog = "\n未匹配原因分析:\n";
        for (const [reason, materials] of Object.entries(failureReasonStats)) {
            failureReasonLog += `  ${reason}: ${materials.length}个 (${materials.slice(0, 5).join(', ')}${materials.length > 5 ? '...' : ''})\n`;
        }
    }
    
    const logContent = `
${formattedTime}
${scanMode} - ${materialsCategory} 种类: ${recognizedMaterials.size} 数量: 
${materialInfo.map(item => `${item.name}: ${item.count}`).join(",")}
未匹配的材料 种类: ${unmatchedMaterialNames.size} 数量: 
${Array.from(unmatchedMaterialNames).join(",")}
${failureReasonLog}
`;

    const categoryFilePath = `history_record/${materialsCategory}.txt`; // 勾选【材料分类】的历史记录
    const overwriteFilePath = `overwrite_record/${materialsCategory}.txt`; // 所有的历史记录分类储存
    const latestFilePath = "latest_record.txt"; // 所有的历史记录集集合
    if (pathingMode.onlyCategory) {
    writeFile(categoryFilePath, logContent);
    }
    writeFile(overwriteFilePath, logContent);
    writeFile(latestFilePath, logContent); // 覆盖模式？

    // 控制台输出未匹配原因摘要
    if (unmatchedMaterialNames.size > 0) {
        log.info(`未匹配材料统计 - 总计: ${unmatchedMaterialNames.size}个`);
        for (const [reason, materials] of Object.entries(failureReasonStats)) {
            log.warn(`  ${reason}: ${materials.length}个材料`);
            const displayMaterials = materials.slice(0, 10);
            const materialList = displayMaterials.join(', ') + (materials.length > 10 ? `... 等${materials.length}个` : '');
            log.warn(`    材料: ${materialList}`);
        }
    }

    // 返回结果
    return materialInfo;
}

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
const BagpackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Bagpack.png"), 58, 31, 38, 38);
const XPRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/XP.png"), 653, 29, 38, 38);
const MaterialsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Materials.png"), 941, 29, 38, 38);
const CultivationItemsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CultivationItems.png"), 749, 30, 38, 38);
const FoodRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Food.png"), 845, 31, 38, 38);

/**
 * 获取材料分类对应的CategoryObject
 * @param {string} materialsCategory - 材料分类名称
 * @returns {Object|null} 对应的CategoryObject或null
 */
function getCategoryObject(materialsCategory) {
    switch (materialsCategory) {
        case "祝圣精华":
            return XPRo;
        case "锻造素材":
        case "一般素材":
        case "烹饪食材":
        case "木材":
        case "鱼饵鱼类":
            return MaterialsRo;
        case "采集食物":
        case "料理":
            return FoodRo;
        case "怪物掉落素材":
        case "周本素材":
        case "角色突破素材":
        case "宝石":
        case "角色天赋素材":
        case "武器突破素材":
            return CultivationItemsRo;
        default:
            return null;
    }
}

function dynamicMaterialGrouping(materialCategoryMap) {
    // 初始化动态分组对象
    const dynamicMaterialGroups = {};

    // 遍历 materialCategoryMap 的 entries
    for (const category in materialCategoryMap) {
        const type = materialTypeMap[category]; // 获取材料分类对应的组编号（3、4、5）
        if (!dynamicMaterialGroups[type]) {
            dynamicMaterialGroups[type] = []; // 初始化组
        }
        dynamicMaterialGroups[type].push(category); // 将分类加入对应组
    }

    // 对每组内的材料分类按照 materialPriority 排序
    for (const type in dynamicMaterialGroups) {
        dynamicMaterialGroups[type].sort((a, b) => materialPriority[a] - materialPriority[b]);
    }

    // 将分组结果转换为数组并按类型排序（3, 4, 5）
    const sortedGroups = Object.entries(dynamicMaterialGroups)
        .map(([type, categories]) => ({ type: parseInt(type), categories }))
        .sort((a, b) => a.type - b.type);

    // 返回分组结果
    return sortedGroups;
}

// 主逻辑函数
async function MaterialPath(materialCategoryMap, cachedFrame = null, pathingMode = null) {
    try {
    // 如果没有传入pathingMode，使用全局变量（向后兼容）
    const mode = pathingMode || globalThis.pathingMode;
    
    // 1. 先记录原始名称与别名的映射关系（用于最后反向转换）
    const nameMap = new Map();
    Object.values(materialCategoryMap).flat().forEach(originalName => {
        const aliasName = MATERIAL_ALIAS[originalName] || originalName;
        nameMap.set(aliasName, originalName); // 存储：别名→原始名
    });

    // 2. 转换materialCategoryMap为别名（用于内部处理）
    const processedMap = {};
    Object.entries(materialCategoryMap).forEach(([category, names]) => {
        processedMap[category] = names.map(name => MATERIAL_ALIAS[name] || name);
    });
    materialCategoryMap = processedMap;

    const maxStage = 4; // 最大阶段数
    let stage = 0; // 当前阶段
    let currentGroupIndex = 0; // 当前处理的分组索引
    let currentCategoryIndex = 0; // 当前处理的分类索引
    let materialsCategory = ""; // 当前处理的材料分类名称
    const allLowCountMaterials = []; // 用于存储所有识别到的低数量材料信息
    
    // 添加状态变量，记录上一个分类的信息
    let prevCategory = null;
    let prevCategoryObject = null;
    let prevPriority = null;
    let prevGroup = null;
    let skipSliderReset = false; // 是否跳过滑条重置
    
    const sortedGroups = dynamicMaterialGrouping(materialCategoryMap);
// log.info("材料 动态[分组]结果:");
    sortedGroups.forEach(group => {
    log.info(`类型 ${group.type} | 包含分类: ${group.categories.join(', ')}`);
});

    let loopCount = 0;
    const maxLoopCount = 200; // 合理阈值，正常流程约50-100次循环

    while (stage <= maxStage && loopCount <= maxLoopCount) { // ===== 补充优化：加入循环次数限制 =====
        loopCount++;
        switch (stage) {
            case 0: // 返回主界面
                // log.info("返回主界面");
                await genshin.returnMainUi();
                await sleep(500);
                stage = 1; // 进入下一阶段
                break;

            case 1: // 打开背包界面
                // log.info("打开背包界面");
                keyPress("B"); // 打开背包界面
                // 暂时注释掉OCR暂停逻辑
                // state.ocrPaused = true;
                // log.info("背包扫描开始，已暂停OCR拾取任务");
                await sleep(800); // 减少等待时间

                cachedFrame?.dispose();
                cachedFrame = captureGameRegion();

                const backpackResult = await recognizeImage(BagpackRo, cachedFrame, 2000, 500, true, "背包");
                if (backpackResult.isDetected) {
                    // log.info("成功识别背包图标");
                    stage = 2; // 进入下一阶段
                } else {
                    log.warn("未识别到背包图标，重新尝试");
                    // ===== 补充优化：连续回退时释放资源 =====
                    cachedFrame?.dispose();
                    stage = 0; // 回退
                }
                break;

            case 2: // 按分组处理材料分类
                if (currentGroupIndex < sortedGroups.length) {
                    const group = sortedGroups[currentGroupIndex];

                    if (currentCategoryIndex < group.categories.length) {
                        materialsCategory = group.categories[currentCategoryIndex];
                        const offset = materialTypeMap[materialsCategory];
                        const menuClickX = Math.round(575 + (offset - 1) * 96.25);
                        // log.info(`点击坐标 (${menuClickX},75)`);
                        click(menuClickX, 75);

                        await sleep(500);

                        cachedFrame?.dispose();
                        cachedFrame = captureGameRegion();

                        stage = 3; // 进入下一阶段
                    } else {
                        currentGroupIndex++;
                        currentCategoryIndex = 0; // 重置分类索引
                        stage = 2; // 继续处理下一组
                    }
                } else {
                    stage = 5; // 跳出循环
                }
                break;

            case 3: // 识别材料分类
                let CategoryObject = getCategoryObject(materialsCategory);
                if (!CategoryObject) {
                    log.error("未知的材料分类");
                    // ===== 补充优化：异常时释放资源并退出 =====
                    cachedFrame?.dispose();
                    stage = 0; // 回退到阶段0
                    return;
                }

                const CategoryResult = await recognizeImage(CategoryObject, cachedFrame, 2000, 500, true, materialsCategory);
                if (CategoryResult.isDetected) {
                    log.info(`识别到${materialsCategory} 所在分类。`);
                    stage = 4; // 进入下一阶段
                } else {
                    log.warn("未识别到材料分类图标，重新尝试");
                    // log.warn(`识别结果：${JSON.stringify(CategoryResult)}`);
                    // ===== 补充优化：连续回退时释放资源 =====
                    cachedFrame?.dispose();
                    stage = 2; // 回退到阶段2
                }
                break;

            case 4: // 扫描材料
                log.info("芭芭拉，冲鸭！");
                
                // 判断是否需要重置滑条
                if (!skipSliderReset) {
                    await moveMouseTo(1288, 124); // 移动鼠标至滑条顶端
                    await sleep(200);
                    leftButtonDown(); // 长按左键重置材料滑条
                    await sleep(300);
                    leftButtonUp();
                    await sleep(200);
                } else {
                    log.info("同一大类且为后位材料，跳过滑条重置");
                    // 不重置滑条，直接从当前位置开始检查第八列
                }

                // 判断是否是后续优先级材料（优先级高于前一个分类）
                const currentPriority = materialPriority[materialsCategory];
                const isPostPriority = prevPriority !== null && currentPriority > prevPriority;
                if (isPostPriority) {
                    log.info(`后续优先级材料扫描 - 当前优先级: ${currentPriority}, 前位优先级: ${prevPriority}`);
                }

                // 扫描材料并获取低于目标数量的材料
                const lowCountMaterials = await scanMaterials(materialsCategory, materialCategoryMap, isPostPriority, mode);
                allLowCountMaterials.push(lowCountMaterials);

                // 保存当前分类信息，用于下一个分类的判断
                prevCategory = materialsCategory;
                prevPriority = materialPriority[materialsCategory];
                
                // 获取当前分类的CategoryObject
                const currentCategoryObject = getCategoryObject(materialsCategory);
                prevCategoryObject = currentCategoryObject;
                prevGroup = sortedGroups[currentGroupIndex];

                currentCategoryIndex++;
                
                // 判断下一个分类是否是同一个大类CategoryObject下的后位材料
                let nextCategory = null;
                let nextCategoryObject = null;
                let nextPriority = null;
                
                // 检查是否还有下一个分类
                if (currentGroupIndex < sortedGroups.length) {
                    const group = sortedGroups[currentGroupIndex];
                    if (currentCategoryIndex < group.categories.length) {
                        nextCategory = group.categories[currentCategoryIndex];
                        
                        // 获取下一个分类的CategoryObject
                        nextCategoryObject = getCategoryObject(nextCategory);
                        
                        // 获取下一个分类的优先级
                        nextPriority = materialPriority[nextCategory];
                    }
                }
                
                // 判断是否跳过滑条重置：同一大类且为后位材料
                if (nextCategory && 
                    nextCategoryObject === prevCategoryObject && 
                    nextPriority > prevPriority) {
                    skipSliderReset = true;
                } else {
                    skipSliderReset = false;
                }
                
                stage = 2; // 返回阶段2处理下一个分类
                break;

            case 5: // 所有分组处理完毕
                log.info("所有分组处理完毕，返回主界面");
                await genshin.returnMainUi();
                stage = maxStage + 1; // 确保退出循环
                break;
        }
    }

    // ===== 补充优化：循环超限处理，防止卡死 =====
    if (loopCount > maxLoopCount) {
        log.error(`主循环次数超限（${maxLoopCount}次），强制退出`);
        cachedFrame?.dispose();
        await genshin.returnMainUi();
        return [];
    }

    await genshin.returnMainUi(); // 返回主界面
    log.info("扫描流程结束");


    // 3. 处理完成后，将输出结果转换回原始名称
    const finalResult = allLowCountMaterials.map(categoryMaterials => {
        return categoryMaterials.map(material => {
            // 假设material包含name属性，将别名转回原始名
            return {
                ...material,
                name: nameMap.get(material.name) || material.name // 反向映射
            };
        });
    });

    cachedFrame?.dispose();
    return finalResult; // 返回转换后的结果（如"晶蝶"）
    } finally {
        // 暂时注释掉OCR恢复逻辑
        // state.ocrPaused = false;
        // log.info("背包扫描结束，已恢复OCR拾取任务");
    }
}


