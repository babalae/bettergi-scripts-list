// 4.1.0

/* ===== 1. 自定义配置 ===== */
let timeMoveUp;
let timeMoveDown;
let accountName;
let operationMode;
let disableJsons;
// 拾取模式：模板匹配拾取（JS自行识别，默认） / bgi原版拾取（由BetterGI AutoPick触发器拾取）
let pickupMode;
let processingIngredient = settings.processingIngredient;
let findFInterval;
let checkInterval;
// 新版运行时配置（任务与路径组均以字符串键持久化）
let runtimeConfig = { tasks: [], pathGroups: [] };
let htmlInfoRoutePaths = new Set();
let pathingRouteFiles = [];
let pathingRoutesByGroup = new Map();
let pathingRouteCacheReady = false;

/* ===== 2. 使用的模板和识别对象 ===== */
const mainUiRo = createTemplateRecognition("assets/MainUI.png", 0, 0, 150, 150);
const fullRoi = createTemplateRecognition("assets/itemFull.png", 0, 0, 1920, 1080);
const FiconRo = createTemplateRecognition("assets/F_Dialogue.png", 1102, 335, 34, 400, 0.9, true);
const frozenRo = createTemplateRecognition("assets/解除冰冻.png", 1379, 574, 1463 - 1379, 613 - 574);
const revivalRo = createTemplateRecognition("assets/复苏.png", 755, 915, 1117 - 755, 1037 - 915, 0.9, true);
const revival_2_Ro = createTemplateRecognition("assets/复苏_联机.png", 930, 1000, 100, 50, 0.9, true);
const scrollRo = createTemplateRecognition("assets/拾取滚轮.png", 1017, 496, 1093 - 581, 581 - 496);

/* ===== 3. 全局通用常量 ===== */
const targetItemPath = "assets/targetItems";
const recordFolder = "record";
const ROUTE_DESCRIPTION_INDEX_FILE = "route-index.json";
const ROUTE_DESCRIPTION_INDEX_FORMAT = "collect-cd-route-index";
const rollingDelay = 32;
const pickupDelay = 100;
const MAX_PICKUP_DAYS = 30;
const cookInterval = 95 * 60 * 1000;
const settimeInterval = 10 * 60 * 1000;
const PROGRESS_PANEL_PATH = "assets/progress.html";
const PROGRESS_PANEL_ID = "collect-cd-progress";
const PROGRESS_PANEL_INTERVAL = 200;
const STARTUP_TIMING_LOG_PREFIX = "[启动耗时]";
const GAME_REGION_CACHE_SIZE = 5;
const DEFAULT_SORT_MODE = "文件顺序，按在文件夹中位置顺序运行";
const DEFAULT_CD_TYPE = "1次0点刷新";
const HTML_CONFIG_CD_TYPES = [
    "",
    "不指定",
    "1次0点刷新",
    "2次0点刷新",
    "3次0点刷新",
    "4点刷新",
    "12小时刷新",
    "24小时刷新",
    "46小时刷新",
    "每天一次"
];
const HTML_CONFIG_SELECTS = {
    operationMode: [
        "执行任务（若不存在索引文件则自动创建）",
        "重新生成索引文件（用于强制刷新CD）"
    ],
    setTimeMode: ["不调节时间", "尽量调为白天", "尽量调为夜晚"],
    sortMode: [
        "文件顺序，按在文件夹中位置顺序运行",
        "优先最早刷新，将优先执行最早刷新的路线",
        "优先最高效率，将优先执行最高分均拾取物的路线"
    ]
};
const HTML_CONFIG_PROCESSING_OPTIONS = [
    "面粉", "兽肉", "鱼肉", "神秘的肉", "黑麦粉", "奶油", "熏禽肉",
    "黄油", "火腿", "糖", "香辛料", "酸奶油", "蟹黄", "果酱", "奶酪",
    "培根", "香肠"
];

/* ===== 4. 全局通用变量 ===== */
let currentParty = '';
let targetItems = [];
let blacklist = [];
let blacklistSet = new Set();
let gameRegion;
let state = {
    running: true,
    runPickupLog: [] // 本次路线运行中拾取/交互的物品明细
};
let pickupRecordFile;
let firstCook = true;
let firstsettime = true;
let lastCookTime = new Date();
let lastsettimeTime = new Date();
let lastSetTimeMode = "";
let lastMapName = "";
let disableArray = [];
let lastRoll = new Date();
let Foods = [];
let subFolderName;
let subFolderPath;
let recordFilePath;
let name2Other;
let alias2Names;
let progressPanelWindowId = null;
let progressPanelRunning = false;
let progressPanelTask = null;
let progressPanelContext = null;
const gameRegionManager = {
    cache: [], // 缓存队列，保存近GAME_REGION_CACHE_SIZE张截图
    lastCapture: new Date(),
    isDisposing: false,
    isCapturing: false
};
let materialCdMap = {};

(async function () {
    const startupStartedAt = beginStartupTiming("脚本启动准备");
    try {
        await sleep(1);
        const configStartedAt = beginStartupTiming("读取运行配置");
        refreshRuntimeSettings();
        refreshDisableArray();
        loadRuntimeConfig();
        finishStartupTiming("读取运行配置", configStartedAt, `任务 ${runtimeConfig.tasks.length} 个，路径组 ${runtimeConfig.pathGroups.length} 个`);
        // 用户勾选入口开关时，先打开 HTML 配置面板，再初始化运行时变量。
        if (!await openHtmlConfigPanel()) {
            return;
        }
        refreshRuntimeSettings();
        refreshDisableArray();

        try {
            dispatcher.AddTrigger(new RealtimeTimer("AutoSkip"));
        } catch (error) {
            log.warn(`启用自动跳过触发器失败，将继续执行：${error.message}`);
        }
        // ==================== 拾取模式 ====================
        // 模板匹配拾取：JS 自行识别拾取（默认，产量记录完整）
        // bgi原版拾取：由 BetterGI AutoPick 实时触发器完成拾取，JS 通过 dispatcher.getPickRecords() 取回拾取记录，
        //              记录同样写入 runPickupLog，驱动 CD 计算、历史统计、每日拾取记录与任务目标扣减
        pickupMode = settings.pickup_Mode || "模板匹配拾取";
        if (pickupMode === "bgi原版拾取") {
            try {
                dispatcher.AddTrigger(new RealtimeTimer("AutoPick"));
                log.info("拾取模式：bgi原版拾取（由 BetterGI AutoPick 触发器完成拾取）");
            } catch (error) {
                log.warn(`启用 BetterGI AutoPick 失败，将继续执行路线：${error.message}`);
            }
        }
        // ==================== 初始化设置和记录文件 ====================
        try {
            const initializeStartedAt = beginStartupTiming("初始化运行数据");
            await initializeSetup();
            finishStartupTiming("初始化运行数据", initializeStartedAt, `路线 ${pathingRouteFiles.length} 条`);
        } catch (error) {
            await sleep(1);
            log.error(`初始化采集 CD 管理失败，无法继续执行：${error.message}`);
            return;
        }
        const progressPanelStartedAt = beginStartupTiming("打开运行进度面板");
        await openProgressPanel();
        finishStartupTiming("打开运行进度面板", progressPanelStartedAt);
        finishStartupTiming("脚本启动准备", startupStartedAt);
        // ==================== 统一任务调度 ====================
        try {
            await runTaskScheduler();
        } catch (error) {
            await sleep(1);
            log.error(`任务调度异常结束：${error.message}`);
        }
    } catch (error) {
        await sleep(1);
        log.error(`采集 CD 管理异常结束：${error.message}`);
    } finally {
        await closeProgressPanel();
    }
})();

function beginStartupTiming(stage) {
    const startedAt = Date.now();
    log.info(`${STARTUP_TIMING_LOG_PREFIX} 开始：${stage}`);
    return startedAt;
}

function finishStartupTiming(stage, startedAt, details = "") {
    const elapsedMs = Math.max(0, Date.now() - Number(startedAt || Date.now()));
    const suffix = details ? `，${details}` : "";
    log.info(`${STARTUP_TIMING_LOG_PREFIX} 完成：${stage}，耗时 ${formatStartupTiming(elapsedMs)}${suffix}`);
    return elapsedMs;
}

function formatStartupTiming(elapsedMs) {
    return elapsedMs < 1000 ? `${elapsedMs} 毫秒` : `${(elapsedMs / 1000).toFixed(2)} 秒`;
}

/**
 * 加载模板识别资源。单个可选资源损坏时返回 null，由对应功能自行降级。
 */
function createTemplateRecognition(imagePath, x, y, width, height, threshold, initialize = false) {
    try {
        const recognition = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(imagePath),
            x,
            y,
            width,
            height
        );
        if (Number.isFinite(threshold)) recognition.Threshold = threshold;
        if (initialize) recognition.InitTemplate();
        return recognition;
    } catch (error) {
        log.warn(`加载识别资源失败，对应功能将停用：${imagePath}，${error.message}`);
        return null;
    }
}

/**
 * 根据 settings 重新计算运行时派生配置。
 * HTML 配置面板保存后必须调用此函数，避免继续使用启动时缓存的旧值。
 */
function refreshRuntimeSettings() {
    timeMoveUp = Math.round((settings.timeMove || 1000) * 0.45);
    timeMoveDown = Math.round((settings.timeMove || 1000) * 0.55);
    accountName = settings.infoFileName || "默认账户";
    operationMode = settings.operationMode || "执行任务（若不存在索引文件则自动创建）";
    disableJsons = settings.disableNameKeywords || settings.disableJsons || "";
    processingIngredient = settings.processingIngredient;
    findFInterval = Math.max(16, Math.min(200, parseInt(settings.findFInterval) || 100));
    checkInterval = +settings.checkInterval || 50;
}

function refreshDisableArray() {
    disableArray = [];
    if (!disableJsons) return;
    for (const item of String(disableJsons).split(/[；;,\r\n]+/)) {
        const value = item.trim();
        if (value) disableArray.push(value);
    }
}

/**
 * 识别并交互函数
 * 该函数会持续运行，识别游戏中的 F 图标并进行交互，同时处理背包满的情况
 * 
 * @returns {Promise<void>} 无返回值，函数会一直运行直到 state.running 为 false
 * 
 * @依赖全局变量：
 * - gameRegion: 游戏区域对象
 * - state: 状态对象，包含 running 标志和 runPickupLog 日志数组
 * - blacklistSet: 黑名单集合，用于过滤不需要交互的物品
 * - targetItems: 目标物品数组
 * - lastRoll: 上次滚动时间
 * - timeMoveUp: 向上移动时间
 * - timeMoveDown: 向下移动时间
 * - pickupDelay: 拾取延迟时间
 * - rollingDelay: 滚动延迟时间
 * 
 * @依赖辅助函数：
 * - findFIcon: 寻找 F 图标函数
 * - hasScroll: 检查是否存在拾取滚轮图标函数
 * - performTemplateMatch: 执行模板匹配函数
 * - checkItemFullAndOCR: 检查背包是否满并进行 OCR 识别函数
 * - sleep: 延迟函数
 */
async function recognizeAndInteract() {
    let lastcenterYF = 0, lastItemName = "", thisMoveUpTime = 0, lastMoveDown = 0;
    let lastCheckItemFull = new Date();
    let lastFreezeCheck = new Date();
    let lastRevivalCheck = new Date();
    let checkTask = null;
    let freezeTask = null;
    let revivalTask = null;

    while (state.running) {
        await sleep(1);
        gameRegion = await getGameRegion();

        // === 解除冰冻检测（每250毫秒） ===
        if (new Date() - lastFreezeCheck > 250 && !freezeTask) {
            lastFreezeCheck = new Date();
            freezeTask = checkAndBreakFreeze();
        }

        // === 复苏检测（每500毫秒） ===
        if (new Date() - lastRevivalCheck > 500 && !revivalTask) {
            lastRevivalCheck = new Date();
            revivalTask = checkAndClickRevival();
        }

        if (new Date() - lastCheckItemFull > 2500 && !checkTask) {
            lastCheckItemFull = new Date();
            checkTask = checkItemFullAndOCR();
        }

        const centerYF = await findFIcon();

        if (!centerYF) {
            if (new Date() - lastRoll >= 200) {
                lastRoll = new Date();
                if (await hasScroll()) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                }
            }
            // 处理并发的冰冻检测
            if (freezeTask) {
                try { await freezeTask; }
                catch (e) { await sleep(1); log.error('冰冻检测异常:', e); }
                finally { freezeTask = null; }
            }
            if (revivalTask) {
                try { await revivalTask; }
                catch (e) { await sleep(1); log.error('复苏检测异常:', e); }
                finally { revivalTask = null; }
            }
            if (checkTask) {
                try { await checkTask; }
                catch (e) { await sleep(1); log.error('背包满检查异常:', e); }
                finally { checkTask = null; }
            }
            continue;
        }
        let itemName = null;
        itemName = await performTemplateMatch(centerYF);
        if (itemName) {
            if (Math.abs(lastcenterYF - centerYF) <= 20 && lastItemName === itemName) {
                await sleep(160);
                lastcenterYF = -20;
                lastItemName = null;
                if (checkTask) {
                    try { await checkTask; }
                    catch (e) { await sleep(1); log.error('背包满检查异常:', e); }
                    finally { checkTask = null; }
                }
                continue;
            }
            if (!blacklistSet.has(itemName)) {
                keyPress("F");
                log.info(`交互或拾取："${itemName}"`);
                /* >>> 提到最前 begin >>> */
                const idx = targetItems.findIndex(it => it.itemName === itemName);
                if (idx > 0) {
                    const [it] = targetItems.splice(idx, 1);
                    targetItems.unshift(it);
                }
                /* <<< 提到最前 end <<< */
                state.runPickupLog.push(itemName);

                lastcenterYF = centerYF;
                lastItemName = itemName;
                await sleep(pickupDelay);
            }
        } else {
            lastItemName = "";
        }
        const currentTime = Date.now();
        if (currentTime - lastMoveDown > timeMoveUp) {
            await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            if (thisMoveUpTime === 0) thisMoveUpTime = currentTime;
            if (currentTime - thisMoveUpTime >= timeMoveDown) {
                lastMoveDown = currentTime;
                thisMoveUpTime = 0;
            }
        } else {
            await keyMouseScript.runFile(`assets/滚轮上翻.json`);
        }
        await sleep(rollingDelay);
        if (freezeTask) {
            try { await freezeTask; }
            catch (e) { await sleep(1); log.error('冰冻检测异常:', e); }
            finally { freezeTask = null; }
        }
        if (revivalTask) {
            try { await revivalTask; }
            catch (e) { await sleep(1); log.error('复苏检测异常:', e); }
            finally { revivalTask = null; }
        }
        if (checkTask) {
            try { await checkTask; }
            catch (e) { await sleep(1); log.error('背包满检查异常:', e); }
            finally { checkTask = null; }
        }
    }
}

/**
 * 启动拾取伴随任务（随路线执行并发运行，state.running 置 false 后结束）
 * 根据拾取模式选择：
 * - 模板匹配拾取：JS 自行识别拾取（recognizeAndInteract）
 * - bgi原版拾取：轮询 dispatcher.getPickRecords() 取回 BetterGI 自动拾取的记录，
 *                 并监控背包满提示以更新路线排除黑名单
 * @returns {Promise<void>} 拾取任务 Promise，应在 state.running 置 false 后 await 其结束
 */
function startPickupTask() {
    if (pickupMode === "bgi原版拾取") {
        return Promise.all([
            pollPickRecordsTask(),
            monitorItemFullTask()
        ]);
    }
    return recognizeAndInteract();
}

/**
 * 监控背包满提示（bgi原版拾取模式专用）
 * 仅识别背包满提示并更新材料黑名单，不执行模板匹配拾取或 F 交互。
 * @returns {Promise<void>} 一直运行直到 state.running 为 false
 */
async function monitorItemFullTask() {
    let lastCheckItemFull = new Date();
    while (state.running) {
        await sleep(1);
        if (new Date() - lastCheckItemFull > 2500) {
            lastCheckItemFull = new Date();
            try {
                const region = await getGameRegion();
                await checkItemFullAndOCR(region);
            } catch (e) {
                await sleep(1);
                log.error('背包满检查异常:', e);
            }
        }
        await sleep(100);
    }
}

/**
 * 轮询取回 BetterGI 莫版拾取记录（bgi原版拾取模式专用）
 * 拾取由 AutoPick 实时触发器完成，这里周期性调用 dispatcher.getPickRecords() 取回拾取历史，
 * 写入 state.runPickupLog，与模板匹配拾取共用同一数据通道：
 * 后续的 CD 计算（按材料取最晚刷新）、历史统计、每日拾取记录、优先材料扣减全部复用。
 * AutoPick 已输出拾取日志，此处只回收记录，不重复打印“交互或拾取”日志。
 * 旧版 C# 无 getPickRecords 时通过可选链 + try 安全降级（不报错、不记录）。
 * @returns {Promise<void>} 一直运行直到 state.running 为 false
 */
async function pollPickRecordsTask() {
    // 启动时先取空一次拾取历史（取出即清空），防止上次运行残留记录混入本次统计
    try {
        dispatcher.getPickRecords?.();
    } catch (e) { /* 旧版 C# 不支持 getPickRecords，忽略 */ }
    while (state.running) {
        await sleep(1);
        try {
            const records = dispatcher.getPickRecords?.() ?? [];
            for (const r of records) {
                await sleep(1);
                state.runPickupLog.push(r.Name);
            }
        } catch (e) {
            await sleep(1);
            break; // 旧版 C# 不支持 getPickRecords，降级停止轮询
        }
        await sleep(100);
    }
    // 路线结束到最后一次轮询之间仍可能产生拾取记录，退出前再取回一次。
    try {
        const records = dispatcher.getPickRecords?.() ?? [];
        for (const r of records) {
            await sleep(1);
            state.runPickupLog.push(r.Name);
        }
    } catch (e) {
        await sleep(1);
        /* 旧版 C# 不支持 getPickRecords，保持静默降级 */
    }
}

/**
 * 寻找 F 图标函数
 * 在游戏区域中查找 F 图标，并返回其中心 Y 坐标
 * 
 * @returns {Promise<number|null>} 返回 F 图标的中心 Y 坐标，如果未找到则返回 null
 * 
 * @依赖全局变量：
 * - gameRegion: 游戏区域对象
 * - FiconRo: F 图标的识别对象
 * - findFInterval: 识别间隔时间
 * 
 * @依赖辅助函数：
 * - sleep: 延迟函数
 */
async function findFIcon() {
    if (!FiconRo) {
        await sleep(findFInterval);
        return null;
    }
    try {
        const r = gameRegion.find(FiconRo);
        if (r.isExist()) return Math.round(r.y + r.height / 2);
    } catch (e) {
        log.error(`findFIcon:${e.message}`);
    }
    await sleep(findFInterval);
    return null;
}

/**
 * 执行模板匹配函数
 * 在指定的 Y 坐标位置，对不同宽度的区域进行模板匹配，识别物品名称
 * 
 * @param {number} centerYF - F 图标的中心 Y 坐标
 * @returns {Promise<string|null>} 返回识别到的物品名称，如果未识别到则返回 null
 * 
 * @依赖全局变量：
 * - gameRegion: 游戏区域对象
 * - targetItems: 目标物品数组，包含物品的名称和识别对象
 * 
 * @依赖辅助函数：
 * 无
 */
async function performTemplateMatch(centerYF) {
    await sleep(1);
    /* 一次性切 6 种宽度（0-5 汉字） */
    const regions = [];
    try {
        for (let cn = 0; cn <= 6; cn++) {   // 0~5 共 6 档
            // 增加 20 像素，兼容化种匣的括号/种子后缀
            const w = 12 + 28 * Math.min(cn, 5) + 2 + 20;
            regions[cn] = gameRegion.DeriveCrop(1219, centerYF - 15, w, 30);
        }

        let firstMatch = null;
        for (const it of targetItems) {
            const cnLen = Math.min(
                [...it.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length,
                5
            ); // 0-5

            if (regions[cnLen].find(it.roi).isExist()) {
                firstMatch = it;
                break;
            }
        }

        if (!firstMatch) return null;

        if (!settings.disableSecondCheck) {
            const cnLen = Math.min(
                [...firstMatch.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length,
                5
            );
            if (regions[cnLen].find(firstMatch.roi).isExist()) {
                return firstMatch.itemName;
            }
            return null;
        } else {
            return firstMatch.itemName;
        }
    } catch (e) {
        log.error(`performTemplateMatch: ${e.message}`);
    } finally {
        for (const region of regions) {
            try { region?.dispose(); } catch { /* 单个裁剪区释放失败不影响其余资源 */ }
        }
    }
    return null;
}

/**
 * 检测并挣脱冰冻状态
 */
async function checkAndBreakFreeze() {
    if (!frozenRo) return;
    try {
        if (gameRegion.find(frozenRo).isExist()) {
            log.info("检测到冻结，尝试挣脱");
            for (let m = 0; m < 3; m++) {
                keyPress("VK_SPACE");
                await sleep(30);
            }
        }
    } catch (error) {
        await sleep(1);
        // 忽略识别错误
    }
}

/**
 * 检测并点击复苏按钮
 * 当角色死亡出现复苏界面时，自动点击复苏按钮
 * @returns {Promise<boolean>} 是否检测到并点击了复苏按钮
 */
async function checkAndClickRevival() {
    try {
        const rg = await getGameRegion();
        const roList = [revivalRo, revival_2_Ro].filter(Boolean);
        for (const ro of roList) {
            const res = rg.find(ro);
            if (res.isExist()) {
                log.info("检测到复苏按钮，点击");
                res.click();
                return true;
            }
        }
    } catch (error) {
        await sleep(1);
        // 忽略识别错误
    }
    return false;
}

/**
 * 检查背包是否满并进行 OCR 识别函数
 * 检查游戏背包是否已满，并通过 OCR 识别物品名称，将满的物品加入黑名单
 * 
 * @param {Object} [region=gameRegion] - 用于识别的游戏区域截图
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - gameRegion: 游戏区域对象
 * - fullRoi: 背包满的识别对象
 * - targetItems: 目标物品数组
 * - blacklist: 黑名单数组
 * - blacklistSet: 黑名单集合
 * 
 * @依赖辅助函数：
 * - loadBlacklist: 加载黑名单函数
 */
async function checkItemFullAndOCR(region = gameRegion) {
    if (!fullRoi || !region) return;
    try {
        if (!region.find(fullRoi).isExist()) return;
    } catch (e) { return; }
    const TEXT_X = 560, TEXT_Y = 450, TEXT_W = 800, TEXT_H = 170;
    let ocrText = null;
    try {
        const list = region.findMulti(RecognitionObject.ocr(TEXT_X, TEXT_Y, TEXT_W, TEXT_H));
        if (list.count) {
            let longest = list[0];
            for (let i = 1;
                i < list.count;
                i++) if (list[i].text.length > longest.text.length) longest = list[i];
            ocrText = longest.text.replace(/[^\u4e00-\u9fa5]/g, '');
        }
    } catch (e) {
        log.error(`OCR:${e.message}`);
    } if (!ocrText) return;
    log.info(`背包满OCR:${ocrText}`);

    function calcMatchRatio(cnPart, txt) {
        if (!cnPart || !txt) return 0;
        const len = cnPart.length;
        let maxMatch = 0;
        for (let i = 0; i <= txt.length - len; i++) {
            let match = 0;
            for (let j = 0; j < len; j++) {
                if (txt[i + j] === cnPart[j]) match++;
                maxMatch = Math.max(maxMatch, match);
            }
        }
        return maxMatch / len;
    }
    const ratioMap = new Map();
    for (const it of targetItems) {
        const candNames = [it.itemName, ...(it.otherName || [])];
        let maxRatioThisItem = 0;
        for (const name of candNames) {
            const ratio = calcMatchRatio(name.replace(/[^\u4e00-\u9fa5]/g, ''), ocrText);
            if (ratio > maxRatioThisItem) maxRatioThisItem = ratio;
        }
        if (maxRatioThisItem > 0.75) {
            const oldMax = ratioMap.get(it.itemName) || 0;
            if (maxRatioThisItem > oldMax) ratioMap.set(it.itemName, maxRatioThisItem);
        }
    }
    if (ratioMap.size === 0) return;
    const maxRatio = Math.max(...ratioMap.values());
    const names = [...ratioMap.entries()].filter(([, r]) => r === maxRatio).map(([n]) => n).sort();
    log.warn(`背包满，黑名单加入:${names.join('、')}（${(maxRatio * 100).toFixed(1)}%）`);
    for (const n of names) {
        blacklistSet.add(n);
        blacklist.push(n);
    }
    await loadBlacklist(true);
}

/**
 * 加载目标物品图片函数
 * 加载指定路径下的目标物品图片，解析图片名称和阈值，并创建识别对象
 * 
 * @returns {Promise<Array>} 返回加载的物品数组，每个物品包含模板、名称、识别对象等信息
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * - readFolder: 读取文件夹函数
 */
async function loadTargetItems() {
    const items = await readFolder(targetItemPath, false);

    const loadedItems = [];
    for (const it of items) {
        try {
            it.template = file.ReadImageMatSync(it.fullPath);
            it.itemName = it.fileName.replace(/\.png$/i, '');
            it.roi = RecognitionObject.TemplateMatch(it.template);

            /* ---------- 1. 解析小括号阈值 ---------- */
            const match = it.fullPath.match(/[（(](.*?)[)）]/);
            const itsThreshold = (match => {
                if (!match) return 0.9;
                const v = parseFloat(match[1]);
                return !isNaN(v) && v >= 0 && v <= 1 ? v : 0.9;
            })(match);
            it.roi.Threshold = itsThreshold;
            it.roi.InitTemplate();

            /* ---------- 2. 解析中括号内容 + 纯中文过滤 ---------- */
            const otherNames = new Set();

            // 一次性扫描完整路径里的所有 []
            for (const m of it.fullPath.matchAll(/\[(.*?)\]/g)) {
                const pure = (m[1] || '').replace(/[^\u4e00-\u9fff]/g, '').trim();
                if (pure) otherNames.add(pure);
            }

            // 若 itemName 本身含非中文，也生成纯中文别名
            const namePure = it.itemName.replace(/[^\u4e00-\u9fff]/g, '').trim();
            if (namePure && namePure !== it.itemName) otherNames.add(namePure);

            it.otherName = Array.from(otherNames);
            loadedItems.push(it);

        } catch (error) {
            log.error(`[loadTargetItems] ${it.fullPath}: ${error.message}`);
        }
    }
    return loadedItems;
}

/**
 * 加载黑名单函数
 * 仅从当前账户的本地文件加载黑名单，并将其合并到内存中的黑名单数组和集合中
 * 
 * @param {boolean} writeBack - 是否将黑名单写回文件
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - accountName: 账户名称
 * - blacklist: 黑名单数组
 * - blacklistSet: 黑名单集合
 * - disableArray: 禁用关键词数组
 * 
 * @依赖辅助函数：
 * 无
 */
async function loadBlacklist(writeBack) {
    const blacklistFolder = "blacklists";
    const blacklistPath = `${blacklistFolder}/${accountName}.json`;
    if (!file.IsFolder(blacklistFolder)) file.CreateDirectory(blacklistFolder);
    const blacklistFileExists = Array.from(file.ReadPathSync(blacklistFolder))
        .some(path => basename(path) === `${accountName}.json`);
    let canWrite = true;
    if (blacklistFileExists) {
        try {
            const raw = await file.readText(blacklistPath);
            const storedBlacklist = JSON.parse(raw);
            if (!Array.isArray(storedBlacklist)) throw new Error("文件根节点不是数组");
            blacklist = [...new Set([...blacklist, ...storedBlacklist])];
        } catch (error) {
            canWrite = false;
            log.error(`读取黑名单失败，为避免覆盖原数据已跳过回写：${error.message}`);
        }
    }
    blacklistSet = materialNamesWithAliases(blacklist);

    if (writeBack && canWrite) {
        await file.writeText(blacklistPath, JSON.stringify(blacklist, null, 2), false);
    }
    // 黑名单与路线禁用关键词分离：disableNameKeywords 仅用于路线排除。
    disableArray = String(settings.disableNameKeywords || "")
        .split(/[；;,\r\n]+/).map(s => s.trim()).filter(Boolean);
}

/**
 * 伪造日志函数
 * 用于在日志中伪造脚本或地图追踪的开始和结束信息
 * 
 * @param {string} name - 脚本或地图追踪的名称
 * @param {boolean} isJs - 是否为JS脚本
 * @param {boolean} isStart - 是否为开始信息
 * @param {number} duration - 持续时间（毫秒），仅在伪造结束信息时有效
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * - sleep: 延迟函数
 */
async function fakeLog(name, isJs, isStart, duration) {
    await sleep(1);
    const currentTime = Date.now();
    // 参数检查
    if (typeof name !== 'string') {
        log.error("参数 'name' 必须是字符串类型！");
        return;
    }
    if (typeof isJs !== 'boolean') {
        log.error("参数 'isJs' 必须是布尔型！");
        return;
    }
    if (typeof isStart !== 'boolean') {
        log.error("参数 'isStart' 必须是布尔型！");
        return;
    }
    if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
        log.error("参数 'currentTime' 必须是整数！");
        return;
    }
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
        log.error("参数 'duration' 必须是整数！");
        return;
    }

    // 将 currentTime 转换为 Date 对象并格式化为 HH:mm:ss.sss
    const date = new Date(currentTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

    // 将 duration 转换为分钟和秒，并保留三位小数
    const durationInSeconds = duration / 1000; // 转换为秒
    const durationMinutes = Math.floor(durationInSeconds / 60);
    const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数

    // 使用四个独立的 if 语句处理四种情况
    if (isJs && isStart) {
        // 处理 isJs = true 且 isStart = true 的情况
        const logMessage = `正在伪造js开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行JS脚本: "${name}"`;
        log.debug(logMessage);
    }
    if (isJs && !isStart) {
        // 处理 isJs = true 且 isStart = false 的情况
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
    if (!isJs && isStart) {
        // 处理 isJs = false 且 isStart = true 的情况
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    }
    if (!isJs && !isStart) {
        // 处理 isJs = false 且 isStart = false 的情况
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
}

/**
 * 获取文件名函数
 * 从文件路径中提取文件名
 * 
 * @param {string} filePath - 文件路径
 * @returns {string} 返回文件名
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * 无
 */
function basename(filePath) {
    return String(filePath || "").split(/\\|\//).pop();
}

function isValidFirstLevelFolderName(value) {
    const name = String(value || "").trim();
    return Boolean(name) && name !== "." && name !== ".." && !/[\\/:*?"<>|\x00-\x1f]/.test(name);
}

/**
 * 读取文件夹函数
 * 递归读取文件夹及其子文件夹中的文件
 * 
 * @param {string} folderPath - 文件夹路径
 * @param {boolean} onlyJson - 是否只读取 JSON 文件
 * @returns {Promise<Array>} 返回文件信息数组，每个元素包含文件路径、文件名等信息
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * 无
 *
 * 加载阶段不调用 sleep；正式进入任务调度后再通过运行循环检查手动终止。
 */
async function readFolder(folderPath, onlyJson) {
    if (onlyJson && normalizeRouteIndexPath(folderPath).toLowerCase() === "pathing") {
        return ensurePathingRouteCache();
    }

    const folderStack = [folderPath];
    const visitedFolders = new Set();
    const rawFiles = [];

    while (folderStack.length > 0) {
        const currentPath = folderStack.pop();
        const folderKey = normalizeRouteIndexPath(currentPath).toLowerCase();
        if (visitedFolders.has(folderKey)) continue;
        visitedFolders.add(folderKey);
        let filesInSubFolder;
        try {
            filesInSubFolder = file.ReadPathSync(currentPath); // 同步读取
        } catch (error) {
            log.warn(`读取文件夹失败，已跳过 ${currentPath}：${error.message}`);
            continue;
        }
        const subFolders = [];

        for (const filePath of filesInSubFolder) {
            try {
                if (file.IsFolder(filePath)) {
                    subFolders.push(filePath);
                    continue;
                }
            } catch (error) {
                log.warn(`检查文件类型失败，已跳过 ${filePath}：${error.message}`);
                continue;
            }

            if (filePath.endsWith('.js')) continue; // 跳过 js
            rawFiles.push(String(filePath));
        }

        // 子文件夹按原顺序入栈（深度优先）
        folderStack.push(...subFolders.reverse());
    }

    if (!onlyJson) {
        return rawFiles.map(filePath => ({
            fullPath: filePath,
            fileName: filePath.split(/\\|\//).pop(),
            folderPathArray: filePath.split(/\\|\//).slice(0, -1)
        }));
    }

    const jsonFiles = rawFiles.filter(filePath => /\.json$/i.test(filePath) && !isRouteDescriptionIndexPath(filePath));
    const result = [];
    for (const filePath of jsonFiles) {
        result.push(createRouteFileEntry(filePath, readRouteDescription(filePath)));
    }
    return result;
}

function normalizeRouteIndexPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function isRouteDescriptionIndexPath(value) {
    return /(?:^|\/)pathing\/[^/]+\/route-index\.json$/i.test(normalizeRouteIndexPath(value));
}

function pathingGroupPathInfo(filePath) {
    const normalizedPath = normalizeRouteIndexPath(filePath);
    const pathParts = normalizedPath.split('/');
    if (pathParts.length < 3 || pathParts[0].toLowerCase() !== 'pathing' || !pathParts[1]) return null;
    return {
        groupKey: pathParts[1].toLowerCase(),
        relativePath: pathParts.slice(2).join('/')
    };
}

function createRouteFileEntry(filePath, description) {
    return {
        fullPath: filePath,
        fileName: filePath.split(/\\|\//).pop(),
        folderPathArray: filePath.split(/\\|\//).slice(0, -1),
        description: description || ''
    };
}

function readRouteDescription(filePath) {
    try {
        const parsed = JSON.parse(file.readTextSync(filePath));
        return parsed?.info?.description ?? '';
    } catch {
        return '';
    }
}

function readDirectoryEntries(folderPath) {
    try {
        return Array.from(file.ReadPathSync(folderPath));
    } catch (error) {
        log.warn(`读取文件夹失败，已跳过 ${folderPath}：${error.message}`);
        return [];
    }
}

function collectUnindexedRoutePaths(folderPath, initialEntries) {
    const folderStack = [{ folderPath, entries: initialEntries }];
    const visitedFolders = new Set();
    const routePaths = [];
    while (folderStack.length > 0) {
        const current = folderStack.pop();
        const folderKey = normalizeRouteIndexPath(current.folderPath).toLowerCase();
        if (visitedFolders.has(folderKey)) continue;
        visitedFolders.add(folderKey);
        const entries = current.entries || readDirectoryEntries(current.folderPath);
        const subFolders = [];
        for (const entry of entries) {
            if (isRouteDescriptionIndexPath(entry)) continue;
            try {
                if (file.IsFolder(entry)) {
                    subFolders.push(entry);
                } else if (/\.json$/i.test(entry)) {
                    routePaths.push(String(entry));
                }
            } catch (error) {
                log.warn(`检查文件类型失败，已跳过 ${entry}：${error.message}`);
            }
        }
        folderStack.push(...subFolders.reverse().map(subFolder => ({ folderPath: subFolder, entries: null })));
    }
    return routePaths;
}

function parseRouteDescriptionIndex(indexPath, groupName) {
    try {
        const root = JSON.parse(file.readTextSync(indexPath));
        if (root?.format !== ROUTE_DESCRIPTION_INDEX_FORMAT || root?.version !== 1 || !root.routes || Array.isArray(root.routes) || typeof root.routes !== 'object') {
            log.warn(`路线声明文件格式无效，已回退读取实际路线：${indexPath}`);
            return null;
        }
        if (root.group !== undefined && String(root.group).toLowerCase() !== groupName.toLowerCase()) {
            log.warn(`路线声明文件的路径组不匹配，已回退读取实际路线：${indexPath}`);
            return null;
        }

        const declaredRoutes = new Map();
        const declaredFolders = new Set();
        for (const [relativePath, description] of Object.entries(root.routes)) {
            const normalizedRelative = normalizeRouteIndexPath(relativePath);
            const pathParts = normalizedRelative.split('/');
            if (!normalizedRelative || normalizedRelative.startsWith('/') || pathParts.some(part => !part || part === '.' || part === '..') || typeof description !== 'string') {
                log.warn(`路线声明文件包含无效路径，已回退读取实际路线：${indexPath}`);
                return null;
            }
            const routeKey = normalizedRelative.toLowerCase();
            if (declaredRoutes.has(routeKey)) {
                log.warn(`路线声明文件包含重复路径，已回退读取实际路线：${indexPath}`);
                return null;
            }
            declaredRoutes.set(routeKey, description);
            for (let depth = 1; depth < pathParts.length; depth++) {
                declaredFolders.add(pathParts.slice(0, depth).join('/').toLowerCase());
            }
        }
        return { declaredRoutes, declaredFolders };
    } catch (error) {
        log.warn(`读取路线声明文件失败，已回退读取实际路线：${indexPath}，${error.message}`);
        return null;
    }
}

function readIndexedPathingGroup(groupRoot, groupName, rootEntries, indexPath, index) {
    const folderStack = [{ folderPath: groupRoot, entries: rootEntries }];
    const visitedFolders = new Set();
    const actualRoutes = new Map();
    while (folderStack.length > 0) {
        const current = folderStack.pop();
        const folderKey = normalizeRouteIndexPath(current.folderPath).toLowerCase();
        if (visitedFolders.has(folderKey)) continue;
        visitedFolders.add(folderKey);
        const entries = current.entries || readDirectoryEntries(current.folderPath);
        const subFolders = [];
        for (const entry of entries) {
            if (normalizeRouteIndexPath(entry).toLowerCase() === normalizeRouteIndexPath(indexPath).toLowerCase()) continue;
            const pathInfo = pathingGroupPathInfo(entry);
            if (!pathInfo || pathInfo.groupKey !== groupName.toLowerCase()) continue;
            const relativeKey = pathInfo.relativePath.toLowerCase();
            if (index.declaredFolders.has(relativeKey)) {
                subFolders.push(entry);
                continue;
            }
            if (index.declaredRoutes.has(relativeKey)) {
                actualRoutes.set(relativeKey, String(entry));
                continue;
            }
            try {
                if (file.IsFolder(entry)) {
                    subFolders.push(entry);
                } else if (/\.json$/i.test(entry)) {
                    actualRoutes.set(relativeKey, String(entry));
                }
            } catch (error) {
                log.warn(`检查未声明路径失败，已跳过 ${entry}：${error.message}`);
            }
        }
        folderStack.push(...subFolders.reverse().map(subFolder => ({ folderPath: subFolder, entries: null })));
    }

    let matchedCount = 0;
    const routes = [];
    for (const [relativeKey, routePath] of actualRoutes) {
        if (index.declaredRoutes.has(relativeKey)) {
            matchedCount++;
            routes.push(createRouteFileEntry(routePath, index.declaredRoutes.get(relativeKey)));
        } else {
            routes.push(createRouteFileEntry(routePath, readRouteDescription(routePath)));
        }
    }
    if (matchedCount !== actualRoutes.size || matchedCount !== index.declaredRoutes.size) {
        log.info(`路线声明与实际文件存在差异：${indexPath}（声明 ${index.declaredRoutes.size}，实际 ${actualRoutes.size}，命中 ${matchedCount}），未命中路线将按原逻辑读取`);
    }
    return routes;
}

function readPathingRoutes() {
    const startedAt = beginStartupTiming("枚举并校验全部路线");
    const routes = [];
    let groupCount = 0;
    let indexedGroupCount = 0;
    let fallbackGroupCount = 0;
    const rootEntries = readDirectoryEntries("pathing");
    for (const entry of rootEntries) {
        let isGroupFolder = false;
        try {
            isGroupFolder = file.IsFolder(entry);
        } catch (error) {
            log.warn(`检查路径组文件夹失败，已跳过 ${entry}：${error.message}`);
        }
        if (!isGroupFolder) continue;

        groupCount++;
        const groupStartedAt = beginStartupTiming(`校验路径组：${basename(entry)}`);
        const normalizedGroupRoot = normalizeRouteIndexPath(entry);
        const groupName = normalizedGroupRoot.split('/').pop();
        const groupEntries = readDirectoryEntries(entry);
        // 先读取声明并推导已知目录/文件，避免对每条已声明路线跨运行时调用 IsFolder。
        const indexPath = groupEntries.find(item => isRouteDescriptionIndexPath(item));
        const index = indexPath ? parseRouteDescriptionIndex(indexPath, groupName) : null;
        if (indexPath && index) {
            const groupRoutes = readIndexedPathingGroup(entry, groupName, groupEntries, indexPath, index);
            routes.push(...groupRoutes);
            indexedGroupCount++;
            finishStartupTiming(`校验路径组：${groupName}`, groupStartedAt, `声明模式，路线 ${groupRoutes.length} 条`);
            continue;
        }
        const routePaths = collectUnindexedRoutePaths(entry, groupEntries);
        routes.push(...routePaths.map(routePath => createRouteFileEntry(routePath, readRouteDescription(routePath))));
        fallbackGroupCount++;
        finishStartupTiming(`校验路径组：${groupName}`, groupStartedAt, `回退读取正文，路线 ${routePaths.length} 条`);
    }
    finishStartupTiming("枚举并校验全部路线", startedAt, `路径组 ${groupCount} 个，声明模式 ${indexedGroupCount} 个，回退 ${fallbackGroupCount} 个，路线 ${routes.length} 条`);
    return routes;
}

function cachePathingRoutes(routes) {
    const groupedRoutes = new Map();
    for (const route of routes) {
        const pathInfo = pathingGroupPathInfo(route.fullPath);
        if (!pathInfo) continue;
        if (!groupedRoutes.has(pathInfo.groupKey)) groupedRoutes.set(pathInfo.groupKey, []);
        groupedRoutes.get(pathInfo.groupKey).push(route);
    }
    pathingRouteFiles = routes;
    pathingRoutesByGroup = groupedRoutes;
    pathingRouteCacheReady = true;
}

function ensurePathingRouteCache() {
    if (!pathingRouteCacheReady) {
        cachePathingRoutes(readPathingRoutes());
    }
    return pathingRouteFiles;
}

/**
 * 带缓存的配队切换函数
 * 如果目标配队与 currentParty 一致则跳过；否则真正切换并更新 currentParty。
 * 
 * @param {string} partyName - 期望切换到的配队名称
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - currentParty: 当前配队名称
 * 
 * @依赖辅助函数：
 * - genshin.returnMainUi: 返回主界面函数
 * - genshin.switchParty: 切换配队函数
 * - genshin.tpToStatueOfTheSeven: 传送到七天神像函数
 */
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {                       // 空名直接回主界面
        await genshin.returnMainUi();
        return;
    }

    if (partyName === currentParty) {       // 缓存命中，跳过切换
        await genshin.returnMainUi();
        return;
    }

    /* 真正切换 */
    try {
        log.info(`正在尝试切换至配队「${partyName}」`);
        let success = await genshin.switchParty(partyName);
        if (!success) {                     // 第一次失败，去神像再试一次
            log.info('切换失败，前往七天神像重试');
            await genshin.tpToStatueOfTheSeven();
            success = await genshin.switchParty(partyName);
        }

        if (success) {                      // 切换成功，更新缓存
            currentParty = partyName;
            log.info(`已切换至配队「${partyName}」并更新缓存`);
        } else {
            throw new Error('两次切换均失败');
        }
    } catch (e) {
        await sleep(1);
        log.error('队伍切换失败，可能处于联机模式或其他不可切换状态');
        notification.error('队伍切换失败，可能处于联机模式或其他不可切换状态');
        try {
            await genshin.returnMainUi();
        } catch (returnError) {
            await sleep(1);
            log.warn(`返回主界面失败，将继续后续任务：${returnError.message}`);
        }
    }
}

/**
 * 检查当前时间是否处于限制时间内或即将进入限制时间
 * 
 * @param {string} timeRule - 时间规则字符串，格式如 "8, 8-11, 23:11-23:55"；单值按小时或分钟，范围包含两端
 * @param {number} [threshold=5] - 接近限制时间的阈值（分钟）
 * @returns {Promise<boolean>} - 如果处于限制时间内或即将进入限制时间，则返回 true，否则返回 false
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * - genshin.tpToStatueOfTheSeven: 传送到七天神像函数
 * - sleep: 延迟函数
 */
async function isTimeRestricted(timeRule, threshold = 5) {
    if (!timeRule) return false;

    // 兼容中英文逗号、冒号
    const ruleClean = timeRule
        .replace(/，/g, ',')
        .replace(/：/g, ':');

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMinute;

    for (const seg of ruleClean.split(',').map(s => s.trim())) {
        if (!seg) continue;

        const parts = seg.split('-').map(s => s.trim());
        if (parts.length > 2 || parts.some(part => !part)) continue;

        const isSingleValue = parts.length === 1;
        const startStr = parts[0];
        const endStr = isSingleValue ? parts[0] : parts[1];
        const parseTime = (str, isEnd) => {
            const match = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(str);
            if (!match) return null;
            const h = Number(match[1]);
            const hasMinute = match[2] !== undefined;
            const m = hasMinute ? Number(match[2]) : (isEnd ? 59 : 0);
            if (h < 0 || h > 23 || m < 0 || m > 59) return null;
            return { h, m };
        };

        const start = parseTime(startStr, false);
        const end = parseTime(endStr, true);
        if (!start || !end) continue;

        const startTotal = start.h * 60 + start.m;
        const endTotal = end.h * 60 + end.m;

        const effectiveEnd = endTotal >= startTotal ? endTotal : endTotal + 24 * 60;

        if (
            (currentTotal >= startTotal && currentTotal <= effectiveEnd) ||
            (currentTotal + 24 * 60 >= startTotal && currentTotal + 24 * 60 <= effectiveEnd)
        ) {
            log.warn("处于限制时间内");
            return true;
        }

        let nextStartTotal = startTotal;
        if (nextStartTotal <= currentTotal) nextStartTotal += 24 * 60;
        const waitMin = nextStartTotal - currentTotal;
        if (waitMin > 0 && waitMin <= threshold) {
            log.warn(`接近限制时间，等待 ${waitMin} 分钟`);
            await genshin.tpToStatueOfTheSeven();
            await sleep(waitMin * 60 * 1000);
            return true;
        }
    }
    return false;
}

/**
 * 食材加工主函数，用于自动前往指定地点进行食材的加工
 * 
 * 该函数会根据 Foods 数组中的食材名称，依次查找并制作对应的料食材
 * 支持调味品类食材（直接在“食材加工”界面查找）
 * 
 * @returns {Promise<void>} 无返回值，执行完所有加工流程后退出
 * 
 * @依赖全局变量：
 * - Foods: 要加工的食材数组
 * - checkInterval: 食材加工中的识别间隔（毫秒）
 * 
 * @依赖辅助函数：
 * - findPNG: 查找图片函数
 * - clickPNG: 点击图片函数
 * - collectCraftedItems: 领取加工产物函数
 * - handleCraftingError: 处理食材加工错误函数
 * - doCraft: 执行食材加工流程函数
 * - genshin.returnMainUi: 返回主界面函数
 */
async function ingredientProcessing() {
    const targetFoods = [
        "面粉", "兽肉", "鱼肉", "神秘的肉", "黑麦粉", "奶油", "熏禽肉",
        "黄油", "火腿", "糖", "香辛料", "酸奶油", "蟹黄", "果酱",
        "奶酪", "培根", "香肠"
    ];
    if (Foods.length == 0) { log.error("未选择要加工的食材"); return; }
    const taskList = Foods.map((name) => `${name}`).join("，");
    const tasks = Foods.map((name) => ({
        name,
        done: false
    }));
    log.info(`本次加工食材：${taskList}`);
    const stove = "蒙德炉子";
    log.info(`正在前往${stove}进行食材加工`);

    try {
        let filePath = `assets/${stove}.json`;
        await pathingScript.runFile(filePath);
    } catch (error) {
        await sleep(1);
        log.error(`执行 ${stove} 路径时发生错误`);
        return;
    }

    const res1 = await findPNG("交互烹饪锅");
    if (res1) {
        keyPress("F");
    } else {
        log.warn("烹饪按钮未找到，正在寻找……");
        let attempts = 0;
        const maxAttempts = 3;
        let foundInRetry = false;
        while (attempts < maxAttempts) {
            await sleep(1);
            log.info(`第${attempts + 1}次尝试寻找烹饪按钮`);
            keyPress("W");
            const res2 = await findPNG("交互烹饪锅");
            if (res2) {
                keyPress("F");
                foundInRetry = true;
                break;
            } else {
                attempts++;
                await sleep(500);
            }
        }
        if (!foundInRetry) {
            log.error("多次未找到烹饪按钮，放弃");
            return;
        }
    }
    await clickPNG("食材加工");



    /* ===== 2. 两轮扫描 ===== */
    // 进入界面先领取一次
    await collectCraftedItems();

    let lastSuccess = true;
    for (let i = 0; i < tasks.length; i++) {
        await sleep(1);
        if (!targetFoods.includes(tasks[i].name)) continue;

        const retry = lastSuccess ? 5 : 1;
        if (await clickPNG(`${tasks[i].name}1`, retry)) {
            log.info(`${tasks[i].name}已找到`);
            await doCraft(i, tasks);
            tasks[i].done = true;
            lastSuccess = true;   // 记录成功
        } else {
            lastSuccess = false;  // 记录失败
        }
    }

    const remain1 = tasks.filter(t => !t.done).map(t => `${t.name}`).join("，") || "无";
    log.info(`剩余待加工食材：${remain1}`);

    if (remain1 === "无") {
        log.info("所有食材均已加工完毕，跳过第二轮扫描");
        await genshin.returnMainUi();
        return;
    }

    const rg = await getGameRegion();
    const foodItems = [];
    for (const flag of ['已加工0个', '已加工1个']) {
        await sleep(1);
        let mat = null;
        try {
            mat = file.ReadImageMatSync(`assets/RecognitionObject/${flag}.png`);
            const res = rg.findMulti(RecognitionObject.TemplateMatch(mat));
            for (let k = 0; k < res.count; ++k) {
                foodItems.push({ x: res[k].x, y: res[k].y });
            }
        } catch (error) {
            await sleep(1);
            log.warn(`扫描${flag}失败，已继续其他食材：${error.message}`);
        } finally {
            try { mat?.dispose(); } catch { /* 释放失败不影响后续识别 */ }
        }
    }

    log.info(`识别到${foodItems.length}个加工中食材`);

    for (const item of foodItems) {
        await sleep(1);
        click(item.x, item.y); await sleep(1 * checkInterval);
        click(item.x, item.y); await sleep(3 * checkInterval);

        for (let round = 0; round < 5; round++) {
            await sleep(1);
            const rg = await getGameRegion();
            try {
                let hit = false;

                /* 直接扫 tasks，模板已挂在 task.ro */
                for (const task of tasks) {
                    if (task.done) continue;
                    if (!targetFoods.includes(task.name)) continue;

                    /* 首次使用再加载，避免重复 IO */
                    if (!task.ro) {
                        task.ro = RecognitionObject.TemplateMatch(
                            file.ReadImageMatSync(`assets/RecognitionObject/${task.name}2.png`)
                        );
                        task.ro.Threshold = 0.9;
                        task.ro.InitTemplate();
                    }

                    if (!task.ro) {
                        log.warn(`${task.name}2.png 不存在，跳过识别`);
                        continue;
                    }
                    const res = rg.find(task.ro);
                    if (res.isExist()) {
                        log.info(`${task.name}已找到`);
                        await doCraft(tasks.indexOf(task), tasks);
                        task.done = true;
                        hit = true;
                        break;             // 一轮只处理一个
                    }
                }

                if (hit) break;            // 本轮已命中，跳出 round
            } catch (error) {
                await sleep(1);
                log.warn(`识别加工食材失败，已跳过本轮：${error.message}`);
            }
        }
    }

    const remain = tasks.filter(t => !t.done).map(t => `${t.name}`).join("，") || "无";
    log.info(`剩余待加工食材：${remain}`);



    await genshin.returnMainUi();
}

/**
 * 领取加工产物并处理相关提示
 * 
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - checkInterval: 食材加工中的识别间隔（毫秒）
 * 
 * @依赖辅助函数：
 * - clickPNG: 点击图片函数
 * - findPNG: 查找图片函数
 * - sleep: 延迟函数
 */
async function collectCraftedItems() {
    if (await clickPNG("全部领取", 3)) {
        let dowait = false;
        await sleep(4 * checkInterval);
        while (await findPNG("道具数量超过上限")) {
            await sleep(1);
            await sleep(checkInterval * 4);
            log.info("识别到道具数量超过上限，等待消失");
            dowait = true;
        }
        if (dowait) {
            await sleep(10 * checkInterval)
        }
        await clickPNG("点击空白区域继续");
        await findPNG("食材加工2");
        await sleep(100);
    }
}

/**
 * 处理食材加工中的错误情况
 * 
 * @param {string} errorType - 错误类型：队列已满、材料不足、已不能持有更多
 * @param {string} itemName - 食材名称
 * @param {boolean} removeFromList - 是否从Foods列表中移除该食材
 * @returns {boolean} - 是否发生错误
 * 
 * @依赖全局变量：
 * - Foods: 要加工的食材数组
 * 
 * @依赖辅助函数：
 * - findPNG: 查找图片函数
 * - clickPNG: 点击图片函数
 * - sleep: 延迟函数
 */
async function handleCraftingError(errorType, itemName, removeFromList) {
    if (await findPNG(errorType, 1)) {
        log.warn(`检测到${itemName}${errorType}，等待图标消失`);
        while (await findPNG(errorType, 1)) {
            await sleep(1);
            log.warn(`检测到${itemName}${errorType}，等待图标消失`);
            await sleep(300);
        }
        if (await clickPNG("全部领取", 3)) {
            await clickPNG("点击空白区域继续");
            await findPNG("食材加工2");
            await sleep(100);
        }
        if (removeFromList) {
            const index = Foods.findIndex(f => f === itemName);
            if (index !== -1) {
                Foods.splice(index, 1);
            }
        }
        return true;
    }
    return false;
}

/**
 * 执行食材加工流程
 * 
 * @param {number} index - 食材在tasks数组中的索引
 * @param {Array} tasks - 任务数组
 * @returns {boolean} - 是否加工成功
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * - clickPNG: 点击图片函数
 * - findPNG: 查找图片函数
 * - handleCraftingError: 处理食材加工错误函数
 * - collectCraftedItems: 领取加工产物函数
 * - sleep: 延迟函数
 * - inputText: 输入文本函数
 */
async function doCraft(index, tasks) {
    await clickPNG("制作");
    await sleep(300);

    /* ---------- 1. 队列已满 ---------- */
    if (await handleCraftingError("队列已满", tasks[index].name, false)) {
        return false;
    }

    /* ---------- 2. 材料不足 ---------- */
    if (await handleCraftingError("材料不足", tasks[index].name, true)) {
        return false;
    }

    /* ---------- 3. 正常加工流程 ---------- */
    await findPNG("选择加工数量");
    click(960, 460);
    await sleep(800);
    inputText(String(99));

    log.info(`尝试制作${tasks[index].name} 99个`);
    await clickPNG("确认加工");
    await sleep(500);

    /* ---------- 4. 已不能持有更多 ---------- */
    if (await handleCraftingError("已不能持有更多", tasks[index].name, true)) {
        return false;
    }

    await sleep(200);
    /* 正常完成：仅领取，不移除 */
    await collectCraftedItems();
    return true;
}

/**
 * 计算默认效率值
 * 
 * @param {Array} knownEff - 已知效率数组
 * @param {string|number} percentile - 分位值设置
 * @param {number} defaultThreshold - 默认阈值
 * @returns {number} - 计算出的默认效率值
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * 无
 */
function calculateDefaultEfficiency(knownEff, percentile, defaultThreshold) {
    if (knownEff.length === 0) {
        return defaultThreshold;
    } else {
        const parsedPercentile = Number(percentile);
        const pct = Number.isFinite(parsedPercentile) ? Math.max(0, Math.min(1, parsedPercentile)) : 0.5;
        const idx = Math.ceil(pct * knownEff.length) - 1;
        const percentileEff = knownEff[Math.max(0, idx)];
        return Math.max(percentileEff, defaultThreshold);
    }
}

/**
 * 处理水下路线的螃蟹技能检查
 * 
 * @param {string} mapName - 地图名称
 * @param {string} filePath - 路径文件路径
 * @param {string} lastMapName - 上一个地图名称
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * - findAndClick: 查找并点击函数
 * - pathingScript.runFile: 运行路径脚本函数
 */
async function handleUnderwaterRoute(mapName, filePath, lastMapName) {
    if (filePath.includes('枫丹水下')) {
        log.info("当前路线为水下路线，检查螃蟹技能");
        let skillRes = await findAndClick("assets/螃蟹技能图标.png", false, 1000);
        if (!skillRes || lastMapName != mapName) {
            log.info("识别到没有螃蟹技能或上一条路线处于其他地图，前往获取螃蟹技能");

            if (mapName === "SeaOfBygoneEras") {
                await pathingScript.runFile("assets/学习螃蟹技能2.json");
            }
            else {
                await pathingScript.runFile("assets/学习螃蟹技能1.json");
            }
        }
    }
}

/**
 * 处理时间调节
 * 
 * @param {Date} timeNow - 当前时间
 * @param {string} setTimeMode - 当前路线所属路径组的时间调节方式
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - firstsettime: 是否首次调节时间
 * - lastsettimeTime: 上次调节时间
 * - lastSetTimeMode: 上次执行的时间调节方式
 * - settimeInterval: 时间调节间隔
 * 
 * @依赖辅助函数：
 * - pathingScript.runFile: 运行路径脚本函数
 */
async function handleTimeAdjustment(timeNow, setTimeMode) {
    if (!["尽量调为白天", "尽量调为夜晚"].includes(setTimeMode)) return;
    if (((timeNow - lastsettimeTime) > settimeInterval) || firstsettime || setTimeMode !== lastSetTimeMode) {
        try {
            if (setTimeMode === "尽量调为白天") {
                await pathingScript.runFile("assets/调为白天.json");
            } else {
                await pathingScript.runFile("assets/调为夜晚.json");
            }
            firstsettime = false;
            lastsettimeTime = new Date();
            lastSetTimeMode = setTimeMode;
        } catch (error) {
            await sleep(1);
            log.warn(`调节游戏时间失败，已继续执行当前任务：${error.message}`);
        }
    }
}

/**
 * 处理食材加工触发
 * 
 * @param {Date} timeNow - 当前时间
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - Foods: 要加工的食材数组
 * - firstCook: 是否首次加工
 * - lastCookTime: 上次加工时间
 * - cookInterval: 加工间隔
 * - lastMapName: 上一个地图名称
 * 
 * @依赖辅助函数：
 * - ingredientProcessing: 食材加工主函数
 */
async function handleIngredientProcessing(timeNow) {
    if (Foods.length != 0 && (((timeNow - lastCookTime) > cookInterval) || firstCook)) {
        firstCook = false;
        try {
            await ingredientProcessing();
            lastCookTime = new Date();
            lastMapName = "Teyvat";
        } catch (error) {
            await sleep(1);
            log.warn(`食材加工失败，已继续执行当前任务：${error.message}`);
        }
    }
}

/**
 * 执行采集路线
 * 
 * @param {string} filePath - 路径文件路径
 * @param {string} fileName - 文件名
 * @param {Object} targetObj - 目标对象
 * @param {Date} startTime - 开始时间
 * @param {string} lastMapName - 上一个地图名称
 * @param {Set} priorityItemSet - 优先材料集合
 * @returns {Object} - 执行结果，包含 success、lastMapName 和 runPickupLog
 * 
 * @依赖全局变量：
 * - state: 状态对象，包含 running 标志和 runPickupLog 日志数组
 * - materialCdMap: 材料CD映射表
 * 
 * @依赖辅助函数：
 * - recognizeAndInteract: 识别并交互函数
 * - handleUnderwaterRoute: 处理水下路线函数
 * - fakeLog: 模拟日志函数
 * - isArrivedAtEndPoint: 检查是否到达终点函数
 * - calculateRouteCD: 计算路线CD函数
 */
async function executeRoute(filePath, fileName, targetObj, startTime, lastMapName, priorityItemSet) {
    state.running = true;
    let runRes;

    const raw = file.readTextSync(filePath);
    const json = JSON.parse(raw);

    // 检测是否为 schedule 文件（包含 schedule 和 tasks 字段）
    if (json.schedule && json.tasks) {
        log.info(`检测到 schedule 文件: ${fileName}，使用 schedule 模式执行`);
        const pickupTask = startPickupTask();
        let scheduleSuccess = false;
        try {
            scheduleSuccess = await executeSchedule(filePath);
        } finally {
            state.running = false;
            await pickupTask;
        }
        // 返回实际拾取日志，供任务目标扣减、历史统计和 CD 等下游逻辑使用。
        return { success: scheduleSuccess, lastMapName: "", runPickupLog: state.runPickupLog, isSchedule: true, pathRes: scheduleSuccess };
    }

    const mapName = (json.info?.map_name && json.info.map_name.trim()) ? json.info.map_name : 'Teyvat';
    await handleUnderwaterRoute(mapName, filePath, lastMapName);
    lastMapName = mapName;
    const pickupTask = startPickupTask();

    try {
        runRes = await pathingScript.runFile(filePath);
    } catch (error) {
        await sleep(1);
        // 与 AAA狗粮批发、锄地一条龙保持一致：异常时置 undefined，由下方判定统一降级到坐标校验
        log.error(`执行路线 ${filePath} 时发生错误：${error.message}`);
        runRes = undefined;
    } finally {
        state.running = false;
        await pickupTask;
    }
    await fakeLog(fileName, false, false, 0);

    /* 4-4 暂按拾取材料计算 CD；新版调度器随后会按路径组 CD 类型写入最终值。 */
    const timeDiff = new Date() - startTime;
    let pathRes;
    if (runRes !== undefined && typeof runRes.success === 'boolean') {
        // 新版本BGI：直接使用返回值判定路线是否成功
        if (runRes.success) {
            log.info("路线运行成功");
        } else {
            log.error(`路线运行失败：${runRes.message}`);
        }
        pathRes = runRes.success;
    } else {
        // 旧版本BGI（无返回值）：静默回退到坐标校验
        pathRes = isArrivedAtEndPoint(filePath);
    }

    // >>> 仅当 >10s 才记录 history；若同时 pathRes === true 再更新 CD <<<
    if (timeDiff > 10000) {
        /* ---------- 1. 先写 history（无条件） ---------- */
        const durationSec = Math.round(timeDiff / 1000);
        const itemCounter = {};
        state.runPickupLog.forEach(n => { itemCounter[n] = (itemCounter[n] || 0) + 1; });
        if (!targetObj.history) targetObj.history = [];
        targetObj.history.push({ items: itemCounter, durationSec });
        if (targetObj.history.length > 7) targetObj.history = targetObj.history.slice(-7);

        /* ---------- 2. 仅当 pathRes === true 才计算并更新 CD ---------- */
        if (pathRes) {
            targetObj.cdTime = calculatePickupBasedRouteCD(state.runPickupLog, priorityItemSet, startTime).toISOString();
        }
    }

    return { success: true, lastMapName, runPickupLog: state.runPickupLog, pathRes };
}

/**
 * 同步本次拾取到所有任务的一次性目标。
 * 任意任务执行路线所得材料都会扣减所有任务的未完成目标，
 * 单个任务全部达标后保留“已完成”状态。
 *
 * ⚠️ 注意：此功能依赖 JS 直接修改 settings 对象并持久化（settings.xxx = xxx）。
 * 若该写回失效，说明 BGI 本体改动了对 settings 的注入/持久化机制，需同步适配。
 *
 * @param {string[]} correctedLog - 本次路线修正后的拾取日志（已按声明材料补充）
 * @returns {void}
 */
function deductOneTimePriority(correctedLog) {
    syncOneTimeTargetsForAllTasks(correctedLog);
}

/**
 * 保存记录并清空日志
 * 
 * @param {Map} cdMap - CD时间映射
 * @param {string} recordFilePath - 记录文件路径
 * @param {Array} runPickupLog - 运行拾取日志
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - state: 状态对象，包含 runPickupLog 日志数组
 * - alias2Names: 别名到本名数组的映射
 * - name2Other: 本名到别名数组的映射
 * 
 * @依赖辅助函数：
 * - appendDailyPickup: 追加每日拾取量函数
 * - deductOneTimePriority: 同步所有任务一次性目标的兼容入口
 */
async function saveRecordAndClearLog(cdMap, recordFilePath, runPickupLog) {
    try {
        await file.writeText(
            recordFilePath,
            JSON.stringify(Array.from(cdMap.values()), null, 2)
        );
    } catch (error) {
        await sleep(1);
        log.error(`保存路线 CD 记录失败，将继续更新拾取目标：${error.message}`);
    }
    await appendDailyPickup(runPickupLog);
    const latestPickedToday = progressPanelContext ? await readDailyPicked() : null;
    // 任意任务拾取到的材料都会在此同步扣减所有任务的一次性目标。
    try {
        deductOneTimePriority(runPickupLog);
    } catch (error) {
        log.error(`更新一次性目标失败，将继续执行：${error.message}`);
    }
    state.runPickupLog = [];
    if (progressPanelContext && latestPickedToday) progressPanelContext.pickedToday = latestPickedToday;
}

/**
 * 根据路线路径选择合适的队伍
 * 
 * @param {string} routePath - 路线路径
 * @param {string} stage - 阶段名称
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - settings: 设置对象，包含默认队伍配置
 * - runtimeConfig: 当前任务与路径组配置
 * 
 * @依赖辅助函数：
 * - switchPartyIfNeeded: 切换队伍函数
 */
async function selectPartyByRoutePath(routePath, stage) {
    const fullPath = routePath;                            // 例：pathing/须弥/xxx.json
    const folderName = fullPath.split(/\\|\//)[1];   // 索引 1 就是第二层
    const group = runtimeConfig.pathGroups.find(g => g.folder === folderName);
    const targetParty = group?.partyName || settings.defaultParty || settings.priorityItemsPartyName || '';
    if (targetParty) {
        await switchPartyIfNeeded(targetParty);
        log.info(`${stage}选用配队：${targetParty}（文件夹：${folderName}）`);
    }
}

/**
 * 计算路线CD时间
 * 
 * @param {string} cdType - CD类型
 * @param {Date} startTime - 开始时间
 * @returns {Date} - 计算后的CD时间
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * 无
 */
function calculateRouteCD(cdType, startTime) {
    let newTimestamp = new Date(startTime);
    switch (cdType) {
        case "1次0点刷新":
            newTimestamp.setDate(newTimestamp.getDate() + 1);
            newTimestamp.setHours(0, 0, 0, 0);
            break;
        case "2次0点刷新":
            newTimestamp.setDate(newTimestamp.getDate() + 2);
            newTimestamp.setHours(0, 0, 0, 0);
            break;
        case "3次0点刷新":
            newTimestamp.setDate(newTimestamp.getDate() + 3);
            newTimestamp.setHours(0, 0, 0, 0);
            break;
        case "4点刷新":
            newTimestamp.setHours(4, 0, 0, 0);
            if (newTimestamp <= startTime) newTimestamp.setDate(newTimestamp.getDate() + 1);
            break;
        case "12小时刷新":
            newTimestamp = new Date(startTime.getTime() + 12 * 60 * 60 * 1000);
            break;
        case "24小时刷新":
            newTimestamp = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
            break;
        case "46小时刷新":
            newTimestamp = new Date(startTime.getTime() + 46 * 60 * 60 * 1000);
            break;
        case "每天一次":
            const hour = startTime.getHours();
            if (hour >= 4 && hour < 16) {
                // 在 04:00 ~ 15:59 之间采集 → 第二天 04:00
                newTimestamp.setHours(4, 0, 0, 0);
                if (newTimestamp <= startTime) newTimestamp.setDate(newTimestamp.getDate() + 1);
            } else {
                // 在 16:00 ~ 03:59 之间采集 → 当前时间 + 12 小时
                newTimestamp = new Date(startTime.getTime() + 12 * 60 * 60 * 1000);
            }
            break;
        default:
            newTimestamp = startTime;
            break;
    }
    return newTimestamp;
}

/**
 * 按旧每日优先采集规则，根据本次拾取材料计算路线 CD。
 * 命中目标材料时只取命中的目标材料，否则使用本次全部拾取材料；多个材料取最晚 CD。
 * 未识别到材料或材料不在映射表中时，按“1次0点刷新”处理。
 */
function calculatePickupBasedRouteCD(pickupLog, priorityItemSet, startTime) {
    const items = Array.isArray(pickupLog) ? pickupLog : [];
    const priorities = priorityItemSet && typeof priorityItemSet.has === "function" ? priorityItemSet : new Set();
    const hasPriority = items.some(name => priorities.has(name));
    const hitMaterials = [...new Set(hasPriority ? items.filter(name => priorities.has(name)) : items)];
    if (!hitMaterials.length) return calculateRouteCD(DEFAULT_CD_TYPE, startTime);

    let latestCD = new Date(0);
    for (const name of hitMaterials) {
        const cdType = materialCdMap[name] || DEFAULT_CD_TYPE;
        const currentCD = calculateRouteCD(cdType, startTime);
        if (currentCD > latestCD) latestCD = currentCD;
    }
    return latestCD;
}

/**
 * 计算路线效率
 * 
 * @param {Array} files - 路线文件数组
 * @param {Map} cdMap - CD时间映射
 * @param {Object} options - 配置选项
 * @param {number} options.groupIndex - 路径组索引（路径组模式使用）
 * @param {Set} options.priorityItemSet - 优先材料集合（优先采集模式使用）
 * @param {Array} options.disableArray - 禁用关键词数组（优先采集模式使用）
 * @param {boolean} options.isPriorityMode - 是否为优先采集模式
 * @returns {void} 无返回值，直接修改 files 数组中的对象
 * 
 * @依赖全局变量：
 * - settings: 设置对象，包含效率计算相关配置
 * - routeEfficiency: 路线效率对象
 * 
 * @依赖辅助函数：
 * - calculateDefaultEfficiency: 计算默认效率值函数
 */
function calculateRouteEfficiency(files, cdMap, options = {}) {
    const {
        groupIndex,
        priorityItemSet,
        disableArray,
        isPriorityMode = false,
        thresholdEfficiency,
        ignorePriorityTags = false
    } = options;

    if (isPriorityMode) {
        // 优先采集模式：只计算优先材料的效率
        const valueMap = new Map();
        String(settings.materialValue !== undefined ? settings.materialValue : (settings.weightedRule || "")).split(/[，,]/).forEach(rule => {
            const [name, value] = rule.split("*").map(s => s.trim());
            if (name && Number.isFinite(Number(value))) valueMap.set(name, Number(value));
        });
        for (const file of files) {
            const fullName = file.fileName;
            const rec = cdMap.get(fullName);

            // 禁用关键词
            let skip = false;
            for (const kw of disableArray) {
                if (file.fullPath.includes(kw)) { skip = true; break; }
            }
            if (skip) { file._priorityEff = -1; continue; }

            // 材料相关检查
            const pathHit = [...priorityItemSet].some(n => file.fullPath.includes(n));
            const histHit = rec?.history?.some(log =>
                Object.keys(log.items).some(name => priorityItemSet.has(name))
            ) ?? false;
            let descHit = false;
            if (file.description) {
                descHit = [...priorityItemSet].some(kw => file.description.includes(kw));
            }
            if (!pathHit && !histHit && !descHit) {
                file._priorityEff = -1;
                continue;
            }

            // 解析路线声明（【】格式）
            const dec = parseDeclaration(file.description);

            // 计算仅看优先材料的分均效率
            let eff = -2; // 未知标记
            if (rec?.history && rec.history.length >= 3) {
                const effList = rec.history.map(log => {
                    const mergedItems = mergeItemsWithDeclaration(log.items, dec.declaredMaterials);
                    const total = Object.entries(mergedItems)
                        .filter(([name]) => priorityItemSet.has(name))
                        .reduce((sum, [name, cnt]) => sum + cnt * (blacklistSet.has(name) ? 0 : materialValueFor(name, valueMap)), 0);
                    return (total / log.durationSec) * 60;
                });
                eff = effList.reduce((a, b) => a + b, 0) / effList.length;
            } else if (dec.declaredDuration || dec.declaredMaterials) {
                // 历史不足 3 条，但有声明：用声明时间 + 声明数量覆盖历史
                const duration = dec.declaredDuration || rec?.history?.[0]?.durationSec || 60;
                const mergedItems = mergeItemsWithDeclaration(rec?.history?.[0]?.items, dec.declaredMaterials);
                const total = Object.entries(mergedItems)
                    .filter(([name]) => priorityItemSet.has(name))
                    .reduce((sum, [name, cnt]) => sum + cnt * (blacklistSet.has(name) ? 0 : materialValueFor(name, valueMap)), 0);
                eff = (total / duration) * 60;
            }
            file._priorityEff = eff;
        }
    } else {
        // 路径组模式：计算所有材料的效率，使用加权规则
        // 0) 解析优先关键词
        const priorityKeywords = !ignorePriorityTags && settings.priorityTags
            ? settings.priorityTags.split('，').map(s => s.trim()).filter(Boolean)
            : [];

        // 1) 解析加权规则
        const weightMap = new Map();
        const materialValueRule = settings.materialValue !== undefined ? settings.materialValue : settings.weightedRule;
        if (materialValueRule) {
            materialValueRule
                .split(/[，,]/)
                .map(s => s.trim())
                .forEach(rule => {
                    const [item, wStr] = rule.split('*').map(value => value.trim());
                    if (item && wStr) {
                        const w = Number(wStr);
                        weightMap.set(item, isNaN(w) ? 1 : w);
                    }
                });
        }

        // 2) 先计算一次基础效率（未知路线先标 -1）
        files.forEach(p => {
            const fullName = basename(p.fullPath);
            const obj = cdMap.get(fullName);
            let avgEff = -1; // 先标记为"未知"
            const dec = parseDeclaration(p.description);

            if (obj && obj.history && obj.history.length >= 3) {
                // 历史 ≥3 条：用历史时间，但声明中的材料数量覆盖历史
                const effList = obj.history.map(log => {
                    const mergedItems = mergeItemsWithDeclaration(log.items, dec.declaredMaterials);
                    const total = Object.entries(mergedItems).reduce((sum, [name, cnt]) => {
                        const w = blacklistSet.has(name) ? 0 : materialValueFor(name, weightMap);
                        return sum + cnt * w;
                    }, 0);
                    return (total / log.durationSec) * 60;
                });
                avgEff = effList.reduce((a, b) => a + b, 0) / effList.length;
            } else if (dec.declaredDuration || dec.declaredMaterials) {
                // 历史不足 3 条，但有声明：用声明时间 + 声明数量覆盖历史
                const duration = dec.declaredDuration || obj?.history?.[0]?.durationSec || 60;
                const mergedItems = mergeItemsWithDeclaration(obj?.history?.[0]?.items, dec.declaredMaterials);
                const total = Object.entries(mergedItems).reduce((sum, [name, cnt]) => {
                    const w = blacklistSet.has(name) ? 0 : materialValueFor(name, weightMap);
                    return sum + cnt * w;
                }, 0);
                avgEff = (total / duration) * 60;
            }
            p._efficiency = avgEff; // 已知路线存真实效率，未知路线存 -1
        });

        // 3) 计算默认效率（分位值 & 临界值 取最大）
        const knownEff = files
            .map(p => p._efficiency)
            .filter(e => e >= 0)          // 只保留已知路线
            .sort((a, b) => a - b);

        const userThreshold = thresholdEfficiency === undefined
            ? (Number(settings[`pathGroup${groupIndex}thresholdEfficiency`]) || 0)
            : (Number(thresholdEfficiency) || 0);
        const defaultEff = calculateDefaultEfficiency(knownEff, settings.defaultEffPercentile, userThreshold);

        // 4) 把 -1 的未知路线替换成默认效率
        files.forEach(p => {
            if (p._efficiency === -1) p._efficiency = defaultEff;
        });

        // 5) 计算全局最大效率值（已含默认效率）
        const maxEff = Math.max(...files.map(p => p._efficiency), 0);

        // 6) 优先关键词加分
        files.forEach(p => {
            const fullName = basename(p.fullPath);
            const obj = cdMap.get(fullName);

            const itemHit = obj?.history?.some(log =>
                Object.keys(log.items).some(item =>
                    priorityKeywords.some(key => item.includes(key))
                )
            );
            const pathHit = priorityKeywords.some(key => p.fullPath.includes(key));
            const descHit = priorityKeywords.some(key => (p.description || '').includes(key));

            if (itemHit || pathHit || descHit) {
                p._efficiency += maxEff + 1;
            }
        });
    }
}

/**
 * 把本次路线的掉落合并到“拾取记录.json”中同一天条目（不含 durationSec）
 * @param {string[]} pickupLog  本次路线的 state.runPickupLog
 */
/**
 * 追加每日拾取记录到文件
 * 将本次路线运行的拾取物品记录追加到每日统计文件中，按 UTC+8 的 4 点划分日期
 * 
 * @param {string[]} pickupLog - 本次路线运行拾取的物品名称数组
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - pickupRecordFile: 拾取记录文件路径
 * - MAX_PICKUP_DAYS: 最大保留天数常量
 * 
 * @依赖辅助函数：无
 */
async function appendDailyPickup(pickupLog) {
    if (!pickupLog || !pickupLog.length) return;

    let oldArr = [];
    let pickupFileExists = false;
    try {
        pickupFileExists = Array.from(file.ReadPathSync(subFolderPath))
            .some(path => basename(path) === basename(pickupRecordFile));
    } catch (error) {
        await sleep(1);
        log.error(`检查每日拾取记录失败，已跳过本次写入：${error.message}`);
        return;
    }
    if (pickupFileExists) {
        try {
            const txt = await file.readText(pickupRecordFile);
            oldArr = txt ? JSON.parse(txt) : [];
            if (!Array.isArray(oldArr)) throw new Error("文件根节点不是数组");
        } catch (error) {
            await sleep(1);
            log.error(`读取每日拾取记录失败，为避免覆盖原数据已跳过本次写入：${error.message}`);
            return;
        }
    }

    // 统一按 UTC+8 的 4 点划分日期
    const utc8_4am = new Date(Date.now() + 8 * 3600_000 - 4 * 3600_000);
    const today = utc8_4am.toISOString().slice(0, 10); // "YYYY-MM-DD"

    let todayItem = oldArr.find(e => e.date === today);
    if (!todayItem) {
        todayItem = { date: today, items: {} };
        oldArr.push(todayItem);
    }
    if (!todayItem.items || typeof todayItem.items !== "object") todayItem.items = {};

    const todayItems = todayItem.items;
    pickupLog.forEach(name => {
        todayItems[name] = (todayItems[name] || 0) + 1;
    });

    // 滑动窗口：只保留最新 MAX_PICKUP_DAYS 条
    oldArr.sort((a, b) => b.date.localeCompare(a.date)); // 先排序
    if (oldArr.length > MAX_PICKUP_DAYS) oldArr = oldArr.slice(0, MAX_PICKUP_DAYS); // 再截断

    // 写盘 + 异常捕获
    try {
        await file.writeText(pickupRecordFile, JSON.stringify(oldArr, null, 2), false);
    } catch (error) {
        await sleep(1);
        log.error(`appendDailyPickup 写盘失败: ${error.message}`);
    }
}

/**
 * 点击指定名称的 PNG 模板图片
 * 从 assets/RecognitionObject/ 目录加载指定名称的图片模板，识别并点击
 * 
 * @param {string} png - 图片文件名（不含扩展名）
 * @param {number} [maxAttempts=20] - 最大重试次数
 * @returns {Promise<boolean|Region>} 返回是否成功点击或 Region 结果
 * 
 * @依赖全局变量：
 * - checkInterval: 识别间隔时间
 * 
 * @依赖辅助函数：
 * - findAndClick: 通用找图并点击函数
 */
async function clickPNG(png, maxAttempts = 20) {
    try {
        const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
        pngRo.Threshold = 0.95;
        pngRo.InitTemplate();
        return await findAndClick(pngRo, true, maxAttempts * checkInterval, checkInterval);
    } catch (error) {
        await sleep(1);
        log.warn(`加载或识别图片失败，已跳过：${png}.png，${error.message}`);
        return false;
    }
}

/**
 * 查找指定名称的 PNG 模板图片（不点击）
 * 从 assets/RecognitionObject/ 目录加载指定名称的图片模板，识别但不点击
 * 
 * @param {string} png - 图片文件名（不含扩展名）
 * @param {number} [maxAttempts=20] - 最大重试次数
 * @returns {Promise<boolean|Region>} 返回是否找到或 Region 结果
 * 
 * @依赖全局变量：
 * - checkInterval: 识别间隔时间
 * 
 * @依赖辅助函数：
 * - findAndClick: 通用找图并点击函数
 */
async function findPNG(png, maxAttempts = 20) {
    try {
        const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
        pngRo.Threshold = 0.95;
        pngRo.InitTemplate();
        return await findAndClick(pngRo, false, maxAttempts * checkInterval, checkInterval);
    } catch (error) {
        await sleep(1);
        log.warn(`加载或识别图片失败，已跳过：${png}.png，${error.message}`);
        return false;
    }
}

/**
 * 通用找图/找RO并可选点击
 * 支持单图片文件路径、单RO、图片文件路径数组、RO数组
 * 
 * @param {string|string[]|RecognitionObject|RecognitionObject[]} target - 目标图片路径或识别对象
 * @param {boolean} [doClick=true] - 是否点击
 * @param {number} [timeout=3000] - 识别时间上限（毫秒）
 * @param {number} [interval=50] - 识别间隔（毫秒）
 * @param {number} [retType=0] - 返回类型：0-返回布尔；1-返回 Region 结果
 * @param {number} [preClickDelay=50] - 点击前等待时间（毫秒）
 * @param {number} [postClickDelay=50] - 点击后等待时间（毫秒）
 * @returns {Promise<boolean|Region>} 根据 retType 返回是否成功或最终 Region
 * 
 * @依赖全局变量：无
 * 
 * @依赖辅助函数：无
 */
async function findAndClick(target,
    doClick = true,
    timeout = 3000,
    interval = 50,
    retType = 0,
    preClickDelay = 50,
    postClickDelay = 50) {
    try {
        // 1. 统一转成 RecognitionObject 数组
        let ros = [];
        if (Array.isArray(target)) {
            ros = target.map(t =>
                (typeof t === 'string')
                    ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(t))
                    : t
            );
        } else {
            ros = [(typeof target === 'string')
                ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(target))
                : target];
        }
        ros = ros.filter(Boolean);
        if (!ros.length) return retType === 0 ? false : null;

        const start = Date.now();
        let found = null;

        while (Date.now() - start <= timeout) {
            await sleep(1);
            const gameRegion = await getGameRegion();
            // 依次尝试每一个 ro
            for (const ro of ros) {
                const res = gameRegion.find(ro);
                if (!res.isEmpty()) {          // 找到
                    found = res;
                    if (doClick) {
                        await sleep(preClickDelay);
                        res.click();
                        await sleep(postClickDelay);
                    }
                    break;                     // 成功即跳出 for
                }
            }
            if (found) break;                  // 成功即跳出 while
            await sleep(interval);                 // 没找到时等待
        }

        // 3. 按需返回
        return retType === 0 ? !!found : (found || null);

    } catch (error) {
        await sleep(1);
        log.error(`执行通用识图时出现错误：${error.message}`);
        return retType === 0 ? false : null;
    }
}

/**
 * 获取游戏区域截图，根据时间间隔决定是否重新捕获
 * 
 * @param {number} [minInterval=17] - 最小截图间隔（毫秒），默认17ms（约60fps）
 * @param {boolean} [asyncDispose=false] - 是否异步释放旧截图，默认false
 * @returns {Promise<Object>} 游戏区域截图对象
 * 
 * @description
 * 使用 gameRegionManager 对象管理以下属性：
 * - cache: 缓存队列，保存近5张截图
 * - lastCapture: 上一次捕获游戏区域的时间戳
 * - isDisposing: 标记是否正在释放旧截图，用于安全锁
 * - isCapturing: 标记是否正在执行截图操作，用于全局锁
 */
async function getGameRegion(minInterval = 17, asyncDispose = false) {
    async function disposeOldGameRegion() {
        gameRegionManager.isDisposing = true;
        try {
            // 当缓存队列超过GAME_REGION_CACHE_SIZE个时，销毁最旧的截图
            while (gameRegionManager.cache.length > GAME_REGION_CACHE_SIZE) {
                const oldestRegion = gameRegionManager.cache.shift();
                if (oldestRegion) {
                    oldestRegion.dispose();
                }
            }
        } catch (error) {
            log.error(`释放旧游戏区域截图失败: ${error.message}`);
        } finally {
            gameRegionManager.isDisposing = false;
        }
    }

    // 等待其他任务完成截图
    while (gameRegionManager.isCapturing) {
        await sleep(1);
    }

    gameRegionManager.isCapturing = true;
    try {
        if (new Date() - gameRegionManager.lastCapture >= minInterval || gameRegionManager.cache.length === 0) {
            while (gameRegionManager.isDisposing) {
                await sleep(1);
            }
            gameRegionManager.lastCapture = new Date();
            const newRegion = captureGameRegion();
            gameRegionManager.cache.push(newRegion);

            // 根据参数决定是否等待释放完成
            if (asyncDispose) {
                disposeOldGameRegion();
            } else {
                await disposeOldGameRegion();
            }
        }
    } catch (error) {
        await sleep(1);
        log.error(`获取游戏区域截图失败: ${error.message}`);
    } finally {
        gameRegionManager.isCapturing = false;
    }
    return gameRegionManager.cache[gameRegionManager.cache.length - 1];
}

/**
 * 沿用旧版左上角派蒙图标模板判断当前是否处于游戏主界面。
 * @returns {Promise<boolean>} true 表示当前为主界面
 */
async function isMainUI() {
    if (!mainUiRo) return false;
    const region = await getGameRegion();
    try {
        return Boolean(region && region.find(mainUiRo).isExist());
    } catch (error) {
        log.error(`isMainUI:${error.message}`);
        return false;
    }
}

/**
 * 判断当前人物是否已到达指定路线的终点
 * 通过读取路线文件获取终点坐标，并与当前人物坐标进行曼哈顿距离比较
 * 
 * @param {string} fullPath - 路线文件完整路径（.json）
 * @returns {boolean} true = 已到达；false = 未到达/读文件失败/取坐标失败
 * 
 * @依赖全局变量：无
 * 
 * @依赖辅助函数：无
 */
function isArrivedAtEndPoint(fullPath) {
    try {
        if (settings.disableXYCheck) {
            log.info("当前禁用了坐标校验，跳过坐标检查")
            return true;
        }
        /* 1. 读路线文件，取终点坐标 */
        const raw = file.readTextSync(fullPath);
        const json = JSON.parse(raw);
        if (!Array.isArray(json.positions)) return false;

        let endX = 0, endY = 0;
        for (let i = json.positions.length - 1; i >= 0; i--) {
            const p = json.positions[i];
            if (p.type !== 'orientation' &&
                typeof p.x === 'number' &&
                typeof p.y === 'number') {
                endX = p.x;
                endY = p.y;
                break;
            }
        }
        if (endX === 0 && endY === 0) return false;   // 没找到有效点

        /* 2. 取当前人物坐标與地图匹配方法 */

        const mapName = (json.info?.map_name && json.info.map_name.trim()) ? json.info.map_name : 'Teyvat';
        const map_match_method = json.info?.map_match_method || "";

        let pos = null;

        if (map_match_method && map_match_method !== "") {
            try {
                // 尝试使用传入的方法名称获取座标
                pos = genshin.getPositionFromMapWithMatchingMethod(mapName, map_match_method, 3000);
            } catch (e) {
                // 若 map_match_method 不是合法的匹配方法，抛出例外时自动退回预设方法
                log.warn(`无法使用匹配方法 "${map_match_method}"，退回预设匹配模式`);
                pos = genshin.getPositionFromMap(mapName, 3000);
            }
        } else {
            // map_match_method 為空時直接使用預設方法
            pos = genshin.getPositionFromMap(mapName, 3000);
        }

        const curX = pos.X;
        const curY = pos.Y;

        let pathres = Math.abs(endX - curX) + Math.abs(endY - curY) <= 30;
        if (!pathres) {
            log.warn(`距离预定终点${Math.abs(endX - curX) + Math.abs(endY - curY)}`);
            log.warn(`距离异常，不记录数据`);
        }
        /* 3. 曼哈顿距离 ≤30 视为到达 */
        return pathres;
    } catch (error) {
        /* 任何异常（读盘失败、解析失败、API 异常）都算“未到达” */
        log.warn(`出现异常${error.message},不记录cd`);
        return false;
    }
}

/**
 * 判断当前是否存在拾取滚轮图标
 * 在指定时间内持续检测游戏画面中是否存在拾取滚轮图标
 * 
 * @param {number} [maxDuration=10] - 最大允许耗时（毫秒）
 * @returns {Promise<boolean>} 返回是否检测到滚轮图标
 * 
 * @依赖全局变量：
 * - gameRegion: 游戏区域对象
 * - scrollRo: 拾取滚轮识别对象
 * - findFInterval: 识别间隔时间
 * 
 * @依赖辅助函数：无
 */
async function hasScroll(maxDuration = 10) {
    if (!scrollRo) return false;
    const start = Date.now();
    while (Date.now() - start < maxDuration) {
        await sleep(1);
        gameRegion = await getGameRegion();
        try {
            const result = gameRegion.find(scrollRo);
            if (result.isExist()) return true;
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            return false;          // 一旦出现异常直接退出，不再重试
        }
        await sleep(findFInterval);   // 识别间隔
    }
    /* 超时仍未识别到，返回失败 */
    return false;
}

function htmlConfigFirstLevelFolders() {
    const folders = [];
    try {
        if (!file.IsFolder("pathing")) file.CreateDirectory("pathing");
        for (const entry of file.ReadPathSync("pathing")) {
            if (!file.IsFolder(entry)) continue;
            const name = String(entry).replace(/^pathing[\\/]/i, "").trim();
            if (name) folders.push(name);
        }
    } catch (error) {
        log.warn(`无法读取 pathing 配置目录: ${error.message}`);
    }
    return Array.from(new Set(folders)).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

async function htmlConfigMaterials() {
    try {
        const files = await readFolder(targetItemPath, false);
        const names = [];
        if (!name2Other) name2Other = new Map();
        if (!alias2Names) alias2Names = new Map();
        for (const item of files.filter(entry => /\.png$/i.test(entry.fullPath))) {
            await sleep(1);
            const itemName = String(item.fileName || item.fullPath).replace(/\.png$/i, "");
            if (!itemName) continue;
            names.push(itemName);
            const aliases = new Set();
            for (const match of String(item.fullPath).matchAll(/\[(.*?)\]/g)) {
                const pure = (match[1] || "").replace(/[^\u4e00-\u9fff]/g, "").trim();
                if (pure) aliases.add(pure);
            }
            const namePure = itemName.replace(/[^\u4e00-\u9fff]/g, "").trim();
            if (namePure && namePure !== itemName) aliases.add(namePure);
            name2Other.set(itemName, Array.from(aliases));
            for (const alias of aliases) {
                names.push(alias);
                if (!alias2Names.has(alias)) alias2Names.set(alias, []);
                if (!alias2Names.get(alias).includes(itemName)) alias2Names.get(alias).push(itemName);
            }
        }
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "zh-CN"));
    } catch (error) {
        await sleep(1);
        log.debug(`HTML 配置面板读取材料列表失败: ${error.message}`);
        return [];
    }
}

function htmlConfigMaterialExpressionValid(value) {
    const text = String(value || "").trim();
    if (!text) return true;
    return text.split("+").every(part => {
        const pieces = part.trim().split("*");
        return pieces.length === 2 && pieces[0].trim() && /^\d+(?:\.\d+)?$/.test(pieces[1].trim());
    });
}

function htmlConfigTimeRuleValid(value) {
    const text = String(value || "").replace(/，/g, ",").replace(/：/g, ":").trim();
    if (!text) return true;
    const validTime = part => {
        if (!/^\d{1,2}(?::\d{1,2})?$/.test(part)) return false;
        const [hour, minute = "0"] = part.split(":");
        return Number(hour) >= 0 && Number(hour) <= 23 && Number(minute) >= 0 && Number(minute) <= 59;
    };
    return text.split(",").every(segment => {
        const parts = segment.trim().split("-").map(part => part.trim());
        return (parts.length === 1 || parts.length === 2) && parts.every(validTime);
    });
}

/* 新版 HTML 面板模型与保存逻辑 */
function htmlInfoNormalizePath(value) {
    return String(value || "").replace(/\\/g, "/");
}

function htmlInfoRelativeRoutePath(value) {
    return htmlInfoNormalizePath(value).replace(/^.*?\/pathing\//i, "").replace(/^pathing\//i, "");
}

function htmlInfoWeightMap() {
    const map = new Map();
    const raw = settings.materialValue !== undefined ? settings.materialValue : (settings.weightedRule || "");
    String(raw || "").split(/[，,]/).forEach(rule => {
        const [name, value] = rule.split("*").map(x => x.trim());
        if (name && Number.isFinite(Number(value))) map.set(name, Number(value));
    });
    return map;
}

function htmlInfoWeightedCount(items, weights, blocked) {
    return Object.entries(items || {}).reduce((sum, [name, count]) =>
        sum + Number(count || 0) * (blocked.has(name) ? 0 : materialValueFor(name, weights)), 0);
}

async function htmlInfoRouteFiles() {
    const startedAt = beginStartupTiming("HTML 信息页：读取路线缓存");
    const result = ensurePathingRouteCache().map(route => ({
        fullPath: route.fullPath,
        fileName: route.fileName
    }));
    finishStartupTiming("HTML 信息页：读取路线缓存", startedAt, `路线 ${result.length} 条`);
    return result;
}

function htmlConfigAccountError(rawAccount) {
    const account = String(rawAccount || "").trim();
    if (!account) return "账户名称不能为空";
    if (account === "." || account === ".." || /[\\/:*?"<>|\x00-\x1f]/.test(account) || /[. ]$/.test(account) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(account)) {
        return "账户名称不能包含路径符号、控制字符或 Windows 文件名保留名称";
    }
    return "";
}

async function readAccountBlacklist(account) {
    let values = [];
    try {
        values = JSON.parse(await file.readText(`blacklists/${account}.json`));
    } catch (error) {
        log.debug(`读取账户「${account}」黑名单失败，信息页将按空列表展示：${error.message}`);
    }
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values.map(value => String(value).trim()).filter(Boolean)));
}

async function collectHtmlInformation(account) {
    const startedAt = beginStartupTiming("HTML 信息页：汇总账户与路线信息");
    let pickupHistory = [];
    let records = [];
    let stepStartedAt = beginStartupTiming("HTML 信息页：读取拾取记录");
    try {
        pickupHistory = JSON.parse(await file.readText(`record/${account}/拾取记录.json`));
    } catch (error) {
        log.debug(`读取账户「${account}」拾取记录失败，信息页将按空记录展示：${error.message}`);
    }
    finishStartupTiming("HTML 信息页：读取拾取记录", stepStartedAt, `记录 ${Array.isArray(pickupHistory) ? pickupHistory.length : 0} 天`);
    stepStartedAt = beginStartupTiming("HTML 信息页：读取路线记录");
    try {
        records = JSON.parse(await file.readText(`record/${account}/record.json`));
    } catch (error) {
        log.debug(`读取账户「${account}」路线记录失败，信息页将按空记录展示：${error.message}`);
    }
    finishStartupTiming("HTML 信息页：读取路线记录", stepStartedAt, `记录 ${Array.isArray(records) ? records.length : 0} 条`);
    stepStartedAt = beginStartupTiming("HTML 信息页：读取账户黑名单");
    const accountBlacklist = await readAccountBlacklist(account);
    finishStartupTiming("HTML 信息页：读取账户黑名单", stepStartedAt, `材料 ${accountBlacklist.length} 种`);
    if (!Array.isArray(pickupHistory)) pickupHistory = [];
    if (!Array.isArray(records)) records = [];

    const routeFiles = await htmlInfoRouteFiles();
    stepStartedAt = beginStartupTiming("HTML 信息页：整理首屏数据");
    const recordMap = new Map(records.map(item => [String(item.fileName || ""), item]));
    const now = Date.now();
    htmlInfoRoutePaths = new Set();
    const routes = routeFiles.map(route => {
        const relativePath = htmlInfoRelativeRoutePath(route.fullPath);
        const requestPath = `pathing/${relativePath}`;
        htmlInfoRoutePaths.add(requestPath.toLowerCase());
        const record = recordMap.get(route.fileName);
        const cdTime = record?.cdTime || "";
        return {
            path: requestPath,
            relativePath,
            fileName: route.fileName,
            cdTime,
            available: !cdTime || now > new Date(cdTime).getTime(),
            hasRecord: Boolean(record),
            historyCount: Array.isArray(record?.history) ? record.history.length : 0
        };
    });

    const currentNames = new Set(routes.map(route => route.fileName));
    const staleRecords = records.filter(record => !currentNames.has(String(record.fileName || ""))).length;
    const duplicateNames = routeFiles.map(route => route.fileName)
        .reduce((map, name) => map.set(name, (map.get(name) || 0) + 1), new Map());
    const duplicateRouteNames = [...duplicateNames.values()].filter(count => count > 1).length;
    const materialNames = new Set();
    pickupHistory.forEach(day => Object.keys(day.items || {}).forEach(name => materialNames.add(name)));
    const historyEntries = records.reduce((sum, record) => sum + (Array.isArray(record.history) ? record.history.length : 0), 0);

    const todayKey = new Date(Date.now() + 8 * 3600_000 - 4 * 3600_000).toISOString().slice(0, 10);
    const todayPicked = (pickupHistory.find(day => day.date === todayKey) || {}).items || {};
    const taskStatus = runtimeConfig.tasks.map(task => {
        const folders = taskAllowedFolders(task);
        const taskRoutes = routes.filter(route => folders.some(folder => route.relativePath === folder || route.relativePath.startsWith(folder + "/")));
        return {
            id: task.id,
            name: task.name,
            enabled: task.enabled,
            allowReopen: task.allowReopen,
            allowedGroups: task.allowedGroups,
            groupNames: task.allowedGroups === "*" ? ["全部已启用路径组"] : runtimeConfig.pathGroups.filter(g => g.cdType && parseIdList(task.allowedGroups).includes(g.id)).map(g => g.name),
            dailyTarget: task.dailyTarget,
            dailyRemaining: remainingTargetExpression(task.dailyTarget, todayPicked),
            oneTimeTarget: task.oneTimeTarget,
            timeRule: task.timeRule,
            durationMinutes: task.durationMinutes,
            onlyRelatedRoutes: task.onlyRelatedRoutes,
            routeCount: taskRoutes.length,
            availableCount: taskRoutes.filter(route => route.available).length
        };
    });

    const information = {
        pickupHistory: pickupHistory.sort((a, b) => String(a.date).localeCompare(String(b.date))),
        routes,
        taskStatus,
        pathGroups: runtimeConfig.pathGroups.map(group => {
            const groupRoutes = routes.filter(route => route.relativePath === group.folder || route.relativePath.startsWith(group.folder + "/"));
            return { ...group, routeCount: groupRoutes.length, availableCount: groupRoutes.filter(route => route.available).length };
        }),
        diagnostics: {
            account,
            routeFiles: routes.length,
            routeRecords: records.length,
            staleRecords,
            duplicateRouteNames,
            historyEntries,
            pickupDays: pickupHistory.length,
            materialKinds: materialNames.size,
            blacklistCount: accountBlacklist.length,
            taskCount: runtimeConfig.tasks.length,
            pathGroupCount: runtimeConfig.pathGroups.length
        }
    };
    finishStartupTiming("HTML 信息页：整理首屏数据", stepStartedAt, `路线 ${routes.length} 条，任务 ${taskStatus.length} 个`);
    finishStartupTiming("HTML 信息页：汇总账户与路线信息", startedAt);
    return information;
}

async function collectHtmlRouteDetail(requestPath, account) {
    const normalized = htmlInfoNormalizePath(requestPath);
    if (!htmlInfoRoutePaths.has(normalized.toLowerCase())) throw new Error("路线不在当前 pathing 目录中");
    const raw = file.readTextSync(normalized);
    const json = JSON.parse(raw);
    const fileName = normalized.split("/").pop();
    let records = [];
    try {
        records = JSON.parse(await file.readText(`record/${account}/record.json`));
    } catch (error) {
        log.debug(`读取账户「${account}」路线详情记录失败，将仅展示路线文件信息：${error.message}`);
    }
    let record = null;
    if (Array.isArray(records)) {
        for (let index = records.length - 1; index >= 0; index--) {
            if (records[index].fileName === fileName) { record = records[index]; break; }
        }
    }
    const accountBlacklist = await readAccountBlacklist(account);
    const blocked = materialNamesWithAliases(accountBlacklist);
    const weights = htmlInfoWeightMap();
    const declaration = parseDeclaration(json.info?.description || "");
    const rawHistory = Array.isArray(record?.history) ? record.history : [];
    const historyChronological = rawHistory.map((entry, index, all) => {
        const merged = mergeItemsWithDeclaration(entry.items, declaration.declaredMaterials);
        const weightedCount = htmlInfoWeightedCount(merged, weights, blocked);
        return { order: all.length - index, items: merged, durationSec: Number(entry.durationSec || 0), weightedCount, efficiency: entry.durationSec ? weightedCount / entry.durationSec * 60 : null };
    });
    let efficiency = null;
    if (historyChronological.length >= 3) efficiency = historyChronological.reduce((sum, item) => sum + Number(item.efficiency || 0), 0) / historyChronological.length;
    else if (declaration.declaredDuration || declaration.declaredMaterials) {
        const duration = declaration.declaredDuration || rawHistory[0]?.durationSec || 60;
        const merged = mergeItemsWithDeclaration(rawHistory[0]?.items, declaration.declaredMaterials);
        efficiency = htmlInfoWeightedCount(merged, weights, blocked) / duration * 60;
    }
    const history = historyChronological.reverse();
    const relativePath = htmlInfoRelativeRoutePath(normalized);
    const group = runtimeConfig.pathGroups.find(item => relativePath === item.folder || relativePath.startsWith(item.folder + "/"));
    const taskNames = runtimeConfig.tasks.filter(task => group && group.cdType &&
        (task.allowedGroups === "*" || parseIdList(task.allowedGroups).includes(group.id))).map(task => task.name);
    const cdTime = record?.cdTime || "";
    return {
        path: normalized,
        relativePath,
        fileName,
        info: json.info || {},
        positionCount: Array.isArray(json.positions) ? json.positions.length : 0,
        cdTime,
        available: !cdTime || Date.now() > new Date(cdTime).getTime(),
        group: group || null,
        taskNames,
        declaration,
        efficiency,
        history,
        hasRecord: Boolean(record)
    };
}

async function collectTaskHtmlModel() {
    const startedAt = beginStartupTiming("HTML 配置面板：生成首屏模型");
    let stepStartedAt = beginStartupTiming("HTML 配置面板：读取任务配置");
    const cfg = loadRuntimeConfig();
    finishStartupTiming("HTML 配置面板：读取任务配置", stepStartedAt, `任务 ${cfg.tasks.length} 个，路径组 ${cfg.pathGroups.length} 个`);
    const account = String(runtimeSetting("infoFileName", "默认账户"));
    stepStartedAt = beginStartupTiming("HTML 配置面板：读取黑名单");
    const storedBlacklist = await readAccountBlacklist(account);
    finishStartupTiming("HTML 配置面板：读取黑名单", stepStartedAt, `材料 ${storedBlacklist.length} 种`);
    stepStartedAt = beginStartupTiming("HTML 配置面板：读取材料列表");
    const materials = await htmlConfigMaterials();
    finishStartupTiming("HTML 配置面板：读取材料列表", stepStartedAt, `名称及别名 ${materials.length} 个`);
    const information = await collectHtmlInformation(account);
    stepStartedAt = beginStartupTiming("HTML 配置面板：读取一级路径组目录");
    const pathFolders = htmlConfigFirstLevelFolders();
    finishStartupTiming("HTML 配置面板：读取一级路径组目录", stepStartedAt, `目录 ${pathFolders.length} 个`);
    const model = {
        settings: {
            infoFileName: account,
            priorityItemsPartyName: String(runtimeSetting("defaultParty", runtimeSetting("priorityItemsPartyName", ""))),
            materialValue: String(runtimeSetting("materialValue", runtimeSetting("weightedRule", ""))),
            operationMode: String(runtimeSetting("operationMode", HTML_CONFIG_SELECTS.operationMode[0])),
            disableNameKeywords: String(runtimeSetting("disableNameKeywords", "")),
            pickup_Mode: String(runtimeSetting("pickup_Mode", "模板匹配拾取")),
            findFInterval: String(runtimeSetting("findFInterval", "100")),
            checkInterval: String(runtimeSetting("checkInterval", "50")),
            disableSecondCheck: parseBooleanValue(runtimeSetting("disableSecondCheck", false), false),
            disableXYCheck: parseBooleanValue(runtimeSetting("disableXYCheck", false), false),
            processingIngredient: typeof runtimeSetting("processingIngredient", []) === "string"
                ? String(runtimeSetting("processingIngredient", "")).split(/[；;,]/).map(x => x.trim()).filter(Boolean)
                : Array.from(runtimeSetting("processingIngredient", []) || []),
            blacklist: storedBlacklist.join("；")
        },
        tasks: cfg.tasks,
        pathGroups: cfg.pathGroups,
        pathFolders,
        cdTypes: HTML_CONFIG_CD_TYPES,
        timeModes: HTML_CONFIG_SELECTS.setTimeMode,
        sortModes: HTML_CONFIG_SELECTS.sortMode,
        materials,
        processingOptions: HTML_CONFIG_PROCESSING_OPTIONS,
        information
    };
    finishStartupTiming("HTML 配置面板：生成首屏模型", startedAt, `路线 ${information.routes.length} 条`);
    return model;
}

function validateTaskHtmlConfig(payload, model) {
    const errors = [];
    const data = payload && typeof payload === "object" ? payload : {};
    const s = data.settings || {};
    const account = String(s.infoFileName || "").trim();
    const accountError = htmlConfigAccountError(account);
    if (accountError) errors.push(accountError);
    if (!["模板匹配拾取", "bgi原版拾取"].includes(String(s.pickup_Mode || ""))) errors.push("拾取模式无效");
    if (!HTML_CONFIG_SELECTS.operationMode.includes(String(s.operationMode || ""))) errors.push("索引处理方式无效");
    if (!Number.isFinite(Number(s.findFInterval)) || Number(s.findFInterval) < 16 || Number(s.findFInterval) > 200) errors.push("识别间隔必须是 16 到 200 之间的数字");
    if (!Number.isFinite(Number(s.checkInterval)) || Number(s.checkInterval) <= 0) errors.push("食材加工识别间隔必须是正数");
    if (s.materialValue && !String(s.materialValue).split(/[，,]/).every(x => /^\s*[^*]+\*\s*-?\d+(?:\.\d+)?\s*$/.test(x))) errors.push("材料价值格式应为“材料*倍数，材料*倍数”");
    const groups = Array.isArray(data.pathGroups) ? data.pathGroups : [];
    const folders = model.pathFolders || [];
    const groupIds = new Set();
    const selectedFolders = new Set();
    groups.forEach(g => {
        if (!g.id || groupIds.has(g.id)) errors.push("路径组 ID 重复或为空");
        groupIds.add(g.id);
        if (!String(g.name || "").trim()) errors.push("路径组名称不能为空");
        if (g.folder && !folders.includes(g.folder)) errors.push(`路径组「${g.name || g.id}」文件夹不存在`);
        if (g.folder && selectedFolders.has(g.folder)) errors.push(`文件夹「${g.folder}」不能同时属于多个路径组`);
        if (g.folder) selectedFolders.add(g.folder);
        if (!model.cdTypes.includes(g.cdType)) errors.push(`路径组「${g.name || g.id}」CD 类型无效`);
        if (!model.timeModes.includes(g.setTimeMode)) errors.push(`路径组「${g.name || g.id}」自动调节时间方式无效`);
    });
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const ids = new Set();
    tasks.forEach(t => {
        if (!t.id || ids.has(t.id)) errors.push("任务 ID 重复或为空");
        ids.add(t.id);
        if (!String(t.name || "").trim()) errors.push("任务名称不能为空");
        if (!model.sortModes.includes(t.sortMode)) errors.push(`任务「${t.name}」排序方式无效`);
        if (t.thresholdEfficiency !== "" && !Number.isFinite(Number(t.thresholdEfficiency))) errors.push(`任务「${t.name}」效率阈值必须是数字`);
        if (!htmlConfigMaterialExpressionValid(t.dailyTarget)) errors.push(`任务「${t.name}」每日目标格式错误`);
        if (String(t.oneTimeTarget || "").trim() !== "已完成" && !htmlConfigMaterialExpressionValid(t.oneTimeTarget)) errors.push(`任务「${t.name}」一次性目标格式错误`);
        if (!htmlConfigTimeRuleValid(t.timeRule)) errors.push(`任务「${t.name}」禁止运行时间格式错误`);
        if (t.durationMinutes !== "" && (!Number.isFinite(Number(t.durationMinutes)) || Number(t.durationMinutes) < 0)) errors.push(`任务「${t.name}」运行时长必须是非负数字`);
    });
    return errors;
}

async function applyTaskHtmlConfig(payload, model) {
    const data = payload || {};
    const s = data.settings || {};
    const account = String(s.infoFileName || "默认账户").trim();
    const names = Array.from(new Set(String(s.blacklist || "").split(/[；;,\r\n]+/).map(x => x.trim()).filter(Boolean)));
    await file.writeText(`blacklists/${account}.json`, JSON.stringify(names, null, 2), false);
    settings.blacklist = names.join("；");
    settings.infoFileName = account;
    settings.priorityItemsPartyName = String(s.priorityItemsPartyName || "");
    settings.defaultParty = settings.priorityItemsPartyName;
    settings.materialValue = String(s.materialValue || "");
    settings.operationMode = String(s.operationMode || HTML_CONFIG_SELECTS.operationMode[0]);
    // 全局时间条件已经迁移到任务级，不再让旧字段影响新版调度器。
    settings.timeRule = null;
    settings.maxRuntimeMinutes = null;
    settings.disableNameKeywords = String(s.disableNameKeywords || "");
    settings.pickup_Mode = String(s.pickup_Mode || "模板匹配拾取");
    settings.findFInterval = String(s.findFInterval || "100");
    settings.checkInterval = String(s.checkInterval || "50");
    settings.disableSecondCheck = Boolean(s.disableSecondCheck);
    settings.disableXYCheck = Boolean(s.disableXYCheck);
    if (Array.isArray(s.processingIngredient)) {
        const current = settings.processingIngredient;
        if (current && typeof current.Clear === "function" && typeof current.Add === "function") { current.Clear(); s.processingIngredient.forEach(x => current.Add(x)); }
        else settings.processingIngredient = s.processingIngredient.join("；");
    }
    const groups = Array.isArray(data.pathGroups) ? data.pathGroups : [];
    const oldGroupIds = (model.pathGroups || []).map(g => g.id);
    settings.pathGroupList = groups.map(g => `${g.id}=${encodeURIComponent(g.name || g.id)}`).join("|");
    groups.forEach(g => savePathGroup(g));
    oldGroupIds.filter(id => !groups.some(g => g.id === id)).forEach(id => {
        for (const key of Object.keys(settings)) if (key.startsWith(`pathGroup-${id}-`)) settings[key] = null;
    });
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const validGroupIds = new Set(groups.map(group => group.id));
    tasks.forEach(task => {
        if (task.allowedGroups !== "*") {
            task.allowedGroups = parseIdList(task.allowedGroups).filter(id => validGroupIds.has(id)).join(",");
        }
    });
    settings.taskList = encodeTaskList(tasks);
    const oldIds = (model.tasks || []).map(t => t.id);
    tasks.forEach(saveTaskConfig);
    oldIds.filter(id => !tasks.some(t => t.id === id)).forEach(removeTaskConfig);
    clearLegacySchedulerSettings();
    loadRuntimeConfig(); refreshRuntimeSettings(); refreshDisableArray();
    return { taskCount: tasks.length, pathGroupCount: groups.length };
}

/**
 * 打开脚本级 HTML 配置面板。
 * 返回 true 表示可以继续执行，false 表示用户取消或关闭了面板。
 */
async function openHtmlConfigPanel() {
    if (!parseBooleanValue(settings.openHtmlConfig, false)) return true;
    if (typeof htmlMask === "undefined") {
        log.error("当前 BetterGI 未提供 HTML 配置面板能力，请升级到 0.62.0 或更高版本");
        return false;
    }

    await sleep(1);

    const startedAt = beginStartupTiming("HTML 配置面板：打开并发送首屏");
    let model = null;
    let panelAccount = "";
    let windowId = null;
    try {
        model = await collectTaskHtmlModel();
        panelAccount = String(model.settings.infoFileName || "").trim();
        let stepStartedAt = beginStartupTiming("HTML 配置面板：返回主界面");
        await genshin.returnMainUi();
        finishStartupTiming("HTML 配置面板：返回主界面", stepStartedAt);
        stepStartedAt = beginStartupTiming("HTML 配置面板：创建窗口");
        windowId = htmlMask.show("assets/config.html", "collect-cd-config");
        htmlMask.setClickThrough(windowId, false);
        finishStartupTiming("HTML 配置面板：创建窗口", stepStartedAt);
        model.startupDiagnostics = { hostModelReadyAt: Date.now() };
        stepStartedAt = beginStartupTiming("HTML 配置面板：序列化首屏数据");
        const serializedModel = JSON.stringify(model);
        finishStartupTiming("HTML 配置面板：序列化首屏数据", stepStartedAt, `字符 ${serializedModel.length} 个`);
        stepStartedAt = beginStartupTiming("HTML 配置面板：发送首屏数据");
        htmlMask.send(windowId, "/init", serializedModel);
        finishStartupTiming("HTML 配置面板：发送首屏数据", stepStartedAt);
        finishStartupTiming("HTML 配置面板：打开并发送首屏", startedAt);

        while (htmlMask.exists(windowId)) {
            await sleep(1);
            const raw = await htmlMask.receive(windowId, 500);
            if (!raw) continue;

            let message;
            try {
                message = JSON.parse(raw);
            } catch {
                continue;
            }

            if (message.url === "/diagnostic") {
                const diagnosticStage = String(message.data?.stage || "未知阶段");
                const elapsedMs = Math.max(0, Number(message.data?.elapsedMs) || 0);
                const details = String(message.data?.details || "").trim();
                log.info(`${STARTUP_TIMING_LOG_PREFIX} HTML 浏览器端：${diagnosticStage}，耗时 ${formatStartupTiming(elapsedMs)}${details ? `，${details}` : ""}`);
                htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: true }));
                continue;
            }
            if (message.url === "/cancel") {
                htmlMask.close(windowId);
                return false;
            }
            if (message.url === "/info/route") {
                try {
                    const detail = await collectHtmlRouteDetail(message.data?.path, panelAccount);
                    htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: true, detail }));
                } catch (error) {
                    await sleep(1);
                    htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: false, errors: [error.message] }));
                }
                continue;
            }
            if (message.url === "/info/account") {
                const account = String(message.data?.account || "").trim();
                const accountError = htmlConfigAccountError(account);
                if (accountError) {
                    htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: false, errors: [accountError] }));
                    continue;
                }
                try {
                    const accountBlacklist = await readAccountBlacklist(account);
                    const information = await collectHtmlInformation(account);
                    panelAccount = account;
                    htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: true, account, blacklist: accountBlacklist.join("；"), information }));
                } catch (error) {
                    await sleep(1);
                    htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: false, errors: [error.message] }));
                }
                continue;
            }
            if (message.url !== "/save") continue;

            const requestedAccount = String(message.data?.settings?.infoFileName || "").trim();
            if (requestedAccount !== panelAccount) {
                htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: false, errors: ["账户数据尚未加载完成，请稍后重试"] }));
                continue;
            }

            const errors = validateTaskHtmlConfig(message.data, model);
            if (errors.length > 0) {
                htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: false, errors }));
                continue;
            }

            try {
                const result = await applyTaskHtmlConfig(message.data, model);
                htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: true, result }));
                await sleep(80);
                htmlMask.close(windowId);
                log.info("HTML 配置面板已保存配置");
                return true;
            } catch (error) {
                await sleep(1);
                log.warn(`保存 HTML 配置失败: ${error.message}`);
                htmlMask.respond(windowId, message.requestId, JSON.stringify({ ok: false, errors: [`保存配置失败: ${error.message}`] }));
            }
        }
        return false;
    } catch (error) {
        if (windowId) {
            try { htmlMask.close(windowId); } catch { /* 窗口已关闭 */ }
        }
        await sleep(1);
        log.error(`打开 HTML 配置面板失败: ${error.message}`);
        return false;
    }
}

/**
 * 初始化设置和记录文件
 * 读取用户设置，初始化全局变量，加载目标物品和黑名单，创建或更新索引文件
 * 
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - settings: 用户设置对象
 * - accountName: 账户名称
 * - recordFolder: 记录文件夹路径
 * - subFolderName: 子文件夹名称
 * - subFolderPath: 子文件夹路径
 * - pickupRecordFile: 拾取记录文件路径
 * - operationMode: 操作模式
 * - targetItems: 目标物品数组
 * - name2Other: 本名到别名数组的映射
 * - alias2Names: 别名到本名数组的映射
 * - state: 状态对象
 * - recordFilePath: 记录文件路径
 * - processingIngredient: 食材加工列表
 * - Foods: 食材数组
 * - materialCdMap: 材料CD映射表
 * 
 * @依赖辅助函数：
 * - loadTargetItems: 加载目标物品函数
 * - loadBlacklist: 加载黑名单函数
 * - fakeLog: 模拟日志函数
 * - readFolder: 读取文件夹函数
 * - basename: 获取文件基本名函数
 */
function runtimeSetting(name, fallback = "") {
    const value = settings[name];
    return value === undefined || value === null ? fallback : value;
}

function parseTaskListValue(raw) {
    return String(raw || "").split("|").map(s => s.trim()).filter(Boolean).map(part => {
        const i = part.indexOf("=");
        if (i < 0) return { id: part, name: part };
        const encodedName = part.slice(i + 1) || part.slice(0, i);
        let name = encodedName;
        try {
            name = decodeURIComponent(encodedName);
        } catch { /* 旧配置可能不是 URI 编码，保留原名称 */ }
        return { id: part.slice(0, i), name };
    }).filter(t => t.id);
}

function encodeTaskList(tasks) {
    return tasks.map(t => `${t.id}=${encodeURIComponent(t.name || t.id)}`).join("|");
}

function parseIdList(raw) {
    return String(raw || "").split(",").map(s => s.trim()).filter(Boolean);
}

function parseBooleanValue(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "string") return !["false", "0", "否", "禁用"].includes(value.trim().toLowerCase());
    return Boolean(value);
}

function loadTaskConfig(id, name = id) {
    const p = `task-${id}-`;
    const read = (key, fallback = "") => runtimeSetting(p + key, fallback);
    let exitConditions = [];
    try { exitConditions = JSON.parse(read("exitConditions", "[]")); } catch { exitConditions = []; }
    if (!Array.isArray(exitConditions)) exitConditions = [];
    return {
        id, name,
        enabled: parseBooleanValue(read("enabled", true), true),
        allowedGroups: String(read("allowedGroups", "*")),
        allowReopen: parseBooleanValue(read("allowReopen", true), true),
        exitConditions,
        dailyTarget: String(read("dailyTarget", "")),
        oneTimeTarget: String(read("oneTimeTarget", "")),
        sortMode: String(read("sortMode", DEFAULT_SORT_MODE)),
        thresholdEfficiency: String(read("thresholdEfficiency", "0")),
        onlyRelatedRoutes: parseBooleanValue(read("onlyRelatedRoutes", true), true),
        timeRule: String(read("timeRule", "")),
        durationMinutes: String(read("durationMinutes", "0")),
        elapsedMs: 0,
        activeStartedAt: 0
    };
}

function saveTaskConfig(task) {
    const p = `task-${task.id}-`;
    settings[p + "enabled"] = Boolean(task.enabled);
    settings[p + "allowedGroups"] = String(task.allowedGroups === undefined || task.allowedGroups === null ? "*" : task.allowedGroups);
    settings[p + "allowReopen"] = Boolean(task.allowReopen);
    settings[p + "exitConditions"] = JSON.stringify(Array.isArray(task.exitConditions) ? task.exitConditions : []);
    settings[p + "dailyTarget"] = String(task.dailyTarget || "").trim();
    settings[p + "oneTimeTarget"] = String(task.oneTimeTarget || "").trim();
    settings[p + "sortMode"] = String(task.sortMode || DEFAULT_SORT_MODE);
    settings[p + "thresholdEfficiency"] = String(task.thresholdEfficiency ?? "0").trim();
    settings[p + "onlyRelatedRoutes"] = Boolean(task.onlyRelatedRoutes);
    settings[p + "timeRule"] = String(task.timeRule || "").trim();
    settings[p + "durationMinutes"] = String(task.durationMinutes || "0").trim();
}

function savePathGroup(group) {
    const p = `pathGroup-${group.id}-`;
    settings[p + "name"] = String(group.name || group.id);
    settings[p + "folder"] = String(group.folder || "");
    settings[p + "cdType"] = String(group.cdType === undefined || group.cdType === null ? DEFAULT_CD_TYPE : group.cdType);
    settings[p + "partyName"] = String(group.partyName || "");
    settings[p + "setTimeMode"] = HTML_CONFIG_SELECTS.setTimeMode.includes(String(group.setTimeMode || "")) ? String(group.setTimeMode) : HTML_CONFIG_SELECTS.setTimeMode[0];
}

function migrateLegacyConfig() {
    if (!runtimeSetting("disableNameKeywords", "") && runtimeSetting("disableJsons", "")) settings.disableNameKeywords = String(runtimeSetting("disableJsons", ""));
    const legacyTimeRule = String(runtimeSetting("timeRule", ""));
    const oldSetTimeMode = String(runtimeSetting("setTimeMode", HTML_CONFIG_SELECTS.setTimeMode[0]));
    const legacySetTimeMode = HTML_CONFIG_SELECTS.setTimeMode.includes(oldSetTimeMode) ? oldSetTimeMode : HTML_CONFIG_SELECTS.setTimeMode[0];
    // 旧版全局总时长不再参与新版调度；后续由各任务的 durationMinutes 独立配置。
    settings.maxRuntimeMinutes = null;
    if (settings.materialValue === undefined && settings.weightedRule !== undefined) settings.materialValue = String(settings.weightedRule || "");
    const pathGroups = [];
    const hasLegacyGroupConfig = settings.groupCount !== undefined && settings.groupCount !== null;
    const oldCount = Math.min(99, Math.max(0, parseInt(runtimeSetting("groupCount", "0")) || 0));
    for (let i = 1; i <= oldCount; i++) {
        const folder = String(runtimeSetting(`pathGroup${i}FolderName`, ""));
        if (!folder) continue;
        const id = `pg${i}`;
        pathGroups.push({ id, name: `路径组${i}`, folder, cdType: String(runtimeSetting(`pathGroup${i}CdType`, "")), partyName: String(runtimeSetting(`pathGroup${i}PartyName`, "")), setTimeMode: legacySetTimeMode, legacyIndex: i });
        savePathGroup(pathGroups[pathGroups.length - 1]);
    }
    if (!pathGroups.length && !hasLegacyGroupConfig) {
        const folders = htmlConfigFirstLevelFolders();
        folders.forEach((folder, i) => { const g = { id: `pg${i + 1}`, name: folder, folder, cdType: DEFAULT_CD_TYPE, partyName: "", setTimeMode: legacySetTimeMode }; pathGroups.push(g); savePathGroup(g); });
    }
    settings.pathGroupList = pathGroups.map(g => `${g.id}=${encodeURIComponent(g.name)}`).join("|");

    const tasks = [];
    const addTask = (id, name, patch = {}) => { const t = { id, name, enabled: true, allowedGroups: "*", allowReopen: true, exitConditions: [], dailyTarget: "", oneTimeTarget: "", sortMode: String(runtimeSetting("sortMode", DEFAULT_SORT_MODE) || DEFAULT_SORT_MODE), thresholdEfficiency: "0", onlyRelatedRoutes: true, timeRule: legacyTimeRule, durationMinutes: "0", ...patch }; tasks.push(t); saveTaskConfig(t); };
    const daily = String(runtimeSetting("priorityItems", "")).trim();
    const oneTime = String(runtimeSetting("oneTimePriorityItems", "")).trim();
    addTask("daily", "每日采集", { dailyTarget: daily, onlyRelatedRoutes: true, allowReopen: true, enabled: Boolean(daily), sortMode: HTML_CONFIG_SELECTS.sortMode[2] });
    addTask("once", "一次性采集", { oneTimeTarget: oneTime, onlyRelatedRoutes: true, allowReopen: false, enabled: Boolean(oneTime), sortMode: HTML_CONFIG_SELECTS.sortMode[2] });
    const legacyLoopMode = String(runtimeSetting("loopMode", runtimeSetting("loopCollect", "不循环")));
    const legacyAllowReopen = !["", "false", "0", "不循环"].includes(legacyLoopMode);
    pathGroups.forEach((g, i) => addTask(`route${i + 1}`, g.name, { allowedGroups: g.id, allowReopen: legacyAllowReopen, thresholdEfficiency: String(runtimeSetting(`pathGroup${g.legacyIndex ?? (i + 1)}thresholdEfficiency`, "0")) }));
    if (!tasks.length && pathGroups.length) pathGroups.forEach((g, i) => addTask(`route${i + 1}`, g.name, { allowedGroups: g.id }));
    settings.taskList = encodeTaskList(tasks);
    clearLegacySchedulerSettings();
}

function loadRuntimeConfig() {
    if (settings.pathGroupList === undefined || settings.taskList === undefined) migrateLegacyConfig();
    const oldSetTimeMode = String(runtimeSetting("setTimeMode", HTML_CONFIG_SELECTS.setTimeMode[0]));
    const legacySetTimeMode = HTML_CONFIG_SELECTS.setTimeMode.includes(oldSetTimeMode) ? oldSetTimeMode : HTML_CONFIG_SELECTS.setTimeMode[0];
    const groups = parseTaskListValue(runtimeSetting("pathGroupList", "")).map(g => {
        const settingName = `pathGroup-${g.id}-setTimeMode`;
        const setTimeMode = String(runtimeSetting(settingName, legacySetTimeMode));
        if (settings[settingName] === undefined || settings[settingName] === null) settings[settingName] = setTimeMode;
        return { id: g.id, name: g.name, folder: String(runtimeSetting(`pathGroup-${g.id}-folder`, "")), cdType: String(runtimeSetting(`pathGroup-${g.id}-cdType`, DEFAULT_CD_TYPE)), partyName: String(runtimeSetting(`pathGroup-${g.id}-partyName`, "")), setTimeMode };
    });
    settings.setTimeMode = null;
    const tasks = parseTaskListValue(runtimeSetting("taskList", "")).map(t => loadTaskConfig(t.id, t.name));
    const legacyTimeRule = String(runtimeSetting("timeRule", ""));
    if (legacyTimeRule) {
        for (const task of tasks) {
            if (!task.timeRule) { task.timeRule = legacyTimeRule; saveTaskConfig(task); }
        }
        settings.timeRule = null;
    }
    runtimeConfig = { pathGroups: groups, tasks };
    return runtimeConfig;
}

function removeTaskConfig(id) {
    const prefix = `task-${id}-`;
    for (const key of Object.keys(settings)) if (key.startsWith(prefix)) settings[key] = null;
}

function clearLegacySchedulerSettings() {
    for (const name of [
        "priorityItems", "oneTimePriorityItems", "maxRuntimeMinutes", "timeRule",
        "loopMode", "loopCollect", "sortMode", "groupCount", "weightedRule", "setTimeMode",
        "disableJsons", "priorityTags", "enableMoreSettings", "onlyRefresh"
    ]) settings[name] = null;
    for (const key of Object.keys(settings)) {
        if (/^pathGroup\d+(FolderName|CdType|PartyName|thresholdEfficiency)$/.test(key)) settings[key] = null;
    }
}

function parseMaterialTarget(raw) {
    if (!raw || raw === "已完成") return [];
    return String(raw).split("+").map(s => s.trim()).map(seg => { const [name, count] = seg.split("*").map(x => x.trim()); return { name, count: Number(count) }; }).filter(x => x.name && Number.isFinite(x.count) && x.count > 0);
}

async function readDailyPicked() {
    let arr = [];
    try { arr = JSON.parse(await file.readText(pickupRecordFile)); } catch { return {}; }
    if (!Array.isArray(arr)) return {};
    const key = new Date(Date.now() + 8 * 3600_000 - 4 * 3600_000).toISOString().slice(0, 10);
    return (arr.find(x => x.date === key) || {}).items || {};
}

function materialNamesForTarget(targets) {
    const set = new Set();
    for (const item of parseMaterialTarget(targets)) {
        set.add(item.name); (name2Other?.get(item.name) || []).forEach(x => set.add(x)); (alias2Names?.get(item.name) || []).forEach(x => set.add(x));
    }
    return set;
}

function pickedCountForTarget(itemName, picked) {
    let count = picked[itemName] || 0;
    (name2Other?.get(itemName) || []).forEach(alias => count += picked[alias] || 0);
    (alias2Names?.get(itemName) || []).forEach(name => count += picked[name] || 0);
    return count;
}

function targetSatisfied(raw, picked) {
    const list = parseMaterialTarget(raw);
    if (raw === "已完成") return true;
    if (!list.length) return false;
    return list.every(item => pickedCountForTarget(item.name, picked) >= item.count);
}

function remainingTargetExpression(raw, picked) {
    if (!raw || raw === "已完成") return "";
    return parseMaterialTarget(raw).map(item => {
        const got = pickedCountForTarget(item.name, picked);
        return `${item.name}*${Math.max(0, item.count - got)}`;
    }).filter(x => Number(x.split("*").pop()) > 0).join("+");
}

function formatTaskElapsed(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}时${String(minutes).padStart(2, "0")}分${String(seconds).padStart(2, "0")}秒`;
    return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
}

function taskElapsedMilliseconds(task) {
    if (!task) return 0;
    const activeElapsed = task.activeStartedAt ? Date.now() - task.activeStartedAt : 0;
    return Math.max(0, Number(task.elapsedMs) || 0) + Math.max(0, activeElapsed);
}

function startTaskExecutionTimer(task) {
    if (task && !task.activeStartedAt) task.activeStartedAt = Date.now();
}

function stopTaskExecutionTimer(task) {
    if (!task || !task.activeStartedAt) return;
    task.elapsedMs = taskElapsedMilliseconds(task);
    task.activeStartedAt = 0;
}

function formatTaskProgress(task, pickedToday, routeCount, cdRouteCount) {
    const parts = [];
    const dailyTargets = parseMaterialTarget(task.dailyTarget);
    const oneTimeTargets = parseMaterialTarget(task.oneTimeTarget);
    if (dailyTargets.length) {
        const progress = dailyTargets.map(item => `${item.name} ${pickedCountForTarget(item.name, pickedToday)}/${item.count}`).join("、");
        parts.push(`每日目标：${progress}`);
    }
    if (oneTimeTargets.length) {
        parts.push(`一次性目标剩余：${oneTimeTargets.map(item => `${item.name}*${item.count}`).join("+")}`);
    }
    if (!parts.length) parts.push(`路线共 ${routeCount} 条，CD中 ${cdRouteCount} 条`);
    parts.push(`任务累计执行时长：${formatTaskElapsed(taskElapsedMilliseconds(task))}`);
    return parts.join("；");
}

function setProgressPanelContext(task, routeName, pickedToday, routeCount, cdRouteCount) {
    progressPanelContext = {
        task,
        routeName: String(routeName || ""),
        pickedToday: { ...(pickedToday || {}) },
        routeCount,
        cdRouteCount,
        status: "运行中"
    };
}

function markProgressPanelTaskCompleted(task, exitCondition) {
    if (!progressPanelContext || progressPanelContext.task?.id !== task.id) return;
    progressPanelContext.status = `已完成：${exitCondition}`;
}

function livePickedToday() {
    const picked = { ...(progressPanelContext?.pickedToday || {}) };
    for (const name of state.runPickupLog || []) picked[name] = (picked[name] || 0) + 1;
    return picked;
}

function liveOneTimeTargets(task) {
    const targets = parseMaterialTarget(task?.oneTimeTarget).map(item => ({ ...item }));
    for (const name of state.runPickupLog || []) {
        for (const target of targets) {
            if (target.count > 0 && materialNamesEquivalent(name, target.name)) target.count--;
        }
    }
    return targets.filter(item => item.count > 0);
}

function buildProgressPanelPayload(visible) {
    const context = progressPanelContext;
    if (!context?.task) return { visible: false };
    const task = context.task;
    const picked = livePickedToday();
    const dailyTargets = parseMaterialTarget(task.dailyTarget).map(item => ({
        name: item.name,
        current: pickedCountForTarget(item.name, picked),
        target: item.count
    }));
    const oneTimeTargets = liveOneTimeTargets(task);
    const hasOneTimeTarget = Boolean(String(task.oneTimeTarget || "").trim());
    return {
        visible: Boolean(visible),
        taskName: task.name,
        routeName: context.routeName,
        status: context.status,
        active: Boolean(task.activeStartedAt),
        elapsed: formatTaskElapsed(taskElapsedMilliseconds(task)),
        dailyTargets,
        oneTimeTargets,
        hasOneTimeTarget,
        routeCount: context.routeCount,
        cdRouteCount: context.cdRouteCount,
        showRouteSummary: dailyTargets.length === 0 && !hasOneTimeTarget
    };
}

function progressPanelExists() {
    if (!progressPanelWindowId) return false;
    try {
        return htmlMask.exists(progressPanelWindowId);
    } catch {
        return false;
    }
}

async function runProgressPanelLoop() {
    try {
        while (progressPanelRunning && progressPanelExists()) {
            await sleep(1);
            const visible = Boolean(progressPanelContext) && await isMainUI();
            htmlMask.send(progressPanelWindowId, "/progress", JSON.stringify(buildProgressPanelPayload(visible)));
            await sleep(PROGRESS_PANEL_INTERVAL);
        }
    } catch (error) {
        await sleep(1);
        if (progressPanelRunning) {
            log.warn(`运行进度面板已停止更新：${error.message}`);
        }
    } finally {
        progressPanelRunning = false;
    }
}

async function openProgressPanel() {
    if (typeof htmlMask === "undefined") {
        log.warn("当前 BetterGI 未提供 HTML 遮罩能力，跳过运行进度面板");
        return;
    }
    try {
        progressPanelWindowId = htmlMask.show(PROGRESS_PANEL_PATH, PROGRESS_PANEL_ID);
        if (!progressPanelWindowId) throw new Error("无法创建窗口");
        htmlMask.setClickThrough(progressPanelWindowId, true);
        progressPanelRunning = true;
        progressPanelTask = runProgressPanelLoop();
    } catch (error) {
        if (progressPanelWindowId) {
            try { htmlMask.close(progressPanelWindowId); } catch { /* 创建未完成时无需处理 */ }
        }
        progressPanelWindowId = null;
        log.warn(`打开运行进度面板失败：${error.message}`);
    }
}

async function closeProgressPanel() {
    progressPanelRunning = false;
    let updateError = null;
    if (progressPanelTask) {
        try {
            await progressPanelTask;
        } catch (error) {
            updateError = error;
        }
        progressPanelTask = null;
    }
    const windowId = progressPanelWindowId;
    progressPanelWindowId = null;
    progressPanelContext = null;
    if (windowId) {
        try {
            if (htmlMask.exists(windowId)) htmlMask.close(windowId);
        } catch { /* 窗口可能已被用户或宿主关闭 */ }
    }
    if (updateError) {
        await sleep(1);
        log.warn(`等待运行进度面板结束时发生错误：${updateError.message}`);
    }
}

function routeExcluded(route) {
    // 声明材料（【材料*数量】）不属于普通描述，黑名单仅检查路径、文件名及去除声明后的描述。
    const description = String(route.description || "").replace(/【[^】]*】/g, "").replace(/\d+个[^；\s]+[；]?/g, "");
    const text = `${route.fullPath || ""} ${route.fileName || ""} ${description}`;
    return blacklist.some(x => x && text.includes(x)) || disableArray.some(x => x && text.includes(x));
}

function taskAllowedFolders(task) {
    if (task.allowedGroups === "*") return runtimeConfig.pathGroups.filter(g => g.cdType).map(g => g.folder).filter(Boolean);
    const ids = parseIdList(task.allowedGroups);
    return runtimeConfig.pathGroups.filter(g => g.cdType && ids.includes(g.id)).map(g => g.folder).filter(Boolean);
}

function pathGroupForRoute(routePath) {
    const folder = String(routePath).split(/\\|\//)[1] || "";
    return runtimeConfig.pathGroups.find(g => g.folder === folder) || null;
}

async function evaluateTaskExitConditions(task) {
    // 兼容面板之外写入的条件数组，条件之间同样采用 OR。
    for (const condition of Array.isArray(task.exitConditions) ? task.exitConditions : []) {
        await sleep(1);
        if (!condition || !condition.type) continue;
        if (condition.type === "timeRule" && condition.value && await isTimeRestricted(String(condition.value), 0)) return `进入禁止运行时间：${condition.value}`;
        if (condition.type === "dailyTarget" && targetSatisfied(String(condition.value || ""), await readDailyPicked())) return `每日目标已完成：${condition.value}`;
        if (condition.type === "oneTimeTarget" && String(condition.value || "") === "已完成") return "一次性目标已完成";
        if (condition.type === "durationMinutes" && Number(condition.value) > 0 && taskElapsedMilliseconds(task) >= Number(condition.value) * 60000) return `运行时长达到 ${condition.value} 分钟`;
    }
    if (task.timeRule && await isTimeRestricted(task.timeRule, 0)) return `进入禁止运行时间：${task.timeRule}`;
    const picked = await readDailyPicked();
    if (targetSatisfied(task.dailyTarget, picked)) return `每日目标已完成：${task.dailyTarget}`;
    if (task.oneTimeTarget === "已完成") return "一次性目标已完成";
    const duration = Number(task.durationMinutes) || 0;
    if (duration > 0 && taskElapsedMilliseconds(task) >= duration * 60000) return `运行时长达到 ${task.durationMinutes} 分钟`;
    return "";
}

function syncOneTimeTargetsForAllTasks(correctedLog) {
    if (!correctedLog || !correctedLog.length) return;
    for (const task of runtimeConfig.tasks) {
        if (task.oneTimeTarget === "已完成") continue;
        const list = parseMaterialTarget(task.oneTimeTarget);
        if (!list.length) continue;
        for (const item of list) {
            let matchedCount = 0;
            for (const name of correctedLog) {
                if (materialNamesEquivalent(name, item.name)) matchedCount++;
            }
            item.count = Math.max(0, item.count - matchedCount);
        }
        if (list.every(x => x.count <= 0)) task.oneTimeTarget = "已完成";
        else task.oneTimeTarget = list.filter(x => x.count > 0).map(x => `${x.name}*${x.count}`).join("+");
        saveTaskConfig(task);
    }
}

async function runTaskScheduler() {
    const runtimeDisabledTasks = new Set();
    const notifiedTasks = new Set();
    const tasksWithExecutedRoutes = new Set();
    const completeTask = (task, exitCondition) => {
        markProgressPanelTaskCompleted(task, exitCondition);
        if (tasksWithExecutedRoutes.has(task.id) && !notifiedTasks.has(task.id)) {
            const message = `${task.name}任务已完成，退出条件：${exitCondition}`;
            log.info(message);
            try {
                notification.send(message);
            } catch (error) {
                log.warn(`发送任务完成通知失败，将继续调度：${error.message}`);
            }
            notifiedTasks.add(task.id);
        }
        if (!task.allowReopen) runtimeDisabledTasks.add(task.id);
    };
    const routeCache = new Map();
    const failedRoutes = new Set();
    for (const group of runtimeConfig.pathGroups) {
        await sleep(1);
        if (!group.folder || !group.cdType || routeCache.has(group.folder)) continue;
        if (!isValidFirstLevelFolderName(group.folder)) {
            log.error(`路径组「${group.name}」的文件夹名称无效，已跳过：${group.folder}`);
            routeCache.set(group.folder, []);
            continue;
        }
        routeCache.set(group.folder, pathingRoutesByGroup.get(group.folder.toLowerCase()) || []);
    }

    while (true) {
        await sleep(1);
        let executed = false;
        for (const task of runtimeConfig.tasks) {
            await sleep(1);
            try {
                if (!task.enabled || runtimeDisabledTasks.has(task.id)) continue;
                const exitCondition = await evaluateTaskExitConditions(task);
                if (exitCondition) {
                    completeTask(task, exitCondition);
                    continue;
                }

                const folders = taskAllowedFolders(task);
                let routes = [];
                for (const folder of folders) {
                    await sleep(1);
                    routes.push(...(routeCache.get(folder) || []));
                }
                if (routes.length > 1) {
                    const seenPaths = new Set();
                    routes = routes.filter(route => !seenPaths.has(route.fullPath) && seenPaths.add(route.fullPath));
                }

                const taskRouteCount = routes.length;
                const taskRoutes = routes.slice();
                routes = routes.filter(route => !failedRoutes.has(route.fullPath));
                if (!routes.length) {
                    completeTask(task, folders.length ? "没有可用路线" : "没有可用路径组");
                    continue;
                }

                let recordArray;
                try {
                    recordArray = JSON.parse(await file.readText(recordFilePath));
                } catch (error) {
                    log.error(`读取路线 CD 记录失败，已跳过任务「${task.name}」：${error.message}`);
                    continue;
                }
                if (!Array.isArray(recordArray)) {
                    log.error(`路线 CD 记录格式无效，已跳过任务「${task.name}」`);
                    continue;
                }

                const cdMap = new Map(recordArray.map(item => [item.fileName, item]));
                const pickedToday = await readDailyPicked();
                const related = materialNamesForTarget(`${remainingTargetExpression(task.dailyTarget, pickedToday)}+${task.oneTimeTarget}`);
                routes = routes.filter(route => !routeExcluded(route));
                if (!routes.length) {
                    completeTask(task, "路线均被排除");
                    continue;
                }
                if (task.onlyRelatedRoutes && related.size) {
                    routes = routes.filter(route => {
                        const record = cdMap.get(basename(route.fullPath));
                        const historyHit = record?.history?.some(history =>
                            Object.keys(history.items || {}).some(name => related.has(name))
                        );
                        const declarationHit = [...related].some(name =>
                            (route.fullPath || "").includes(name) || (route.description || "").includes(name)
                        );
                        return declarationHit || historyHit;
                    });
                }
                if (!routes.length) {
                    completeTask(task, "没有与目标相关的可用路线");
                    continue;
                }

                const now = new Date();
                const taskCdRouteCount = taskRoutes.filter(route => {
                    const record = cdMap.get(basename(route.fullPath));
                    return record && now <= new Date(record.cdTime);
                }).length;
                routes = routes.filter(route => {
                    const record = cdMap.get(basename(route.fullPath));
                    return !record || now > new Date(record.cdTime);
                });
                if (!routes.length) {
                    completeTask(task, "所有候选路线均在CD中");
                    continue;
                }

                const threshold = Number(task.thresholdEfficiency) || 0;
                const isPriorityMode = Boolean(task.onlyRelatedRoutes && related.size);
                routes.forEach(route => {
                    delete route._priorityEff;
                    delete route._efficiency;
                });
                calculateRouteEfficiency(routes, cdMap, {
                    groupIndex: 0,
                    priorityItemSet: related,
                    disableArray,
                    isPriorityMode,
                    thresholdEfficiency: threshold,
                    ignorePriorityTags: true
                });
                if (isPriorityMode) {
                    const known = routes.map(route => route._priorityEff).filter(value => value >= 0).sort((a, b) => a - b);
                    const fallback = calculateDefaultEfficiency(known, runtimeSetting("defaultEffPercentile", "0.5"), threshold);
                    routes.forEach(route => {
                        if (route._priorityEff === -2) route._priorityEff = fallback;
                    });
                }

                const efficiencyOf = route => isPriorityMode ? (route._priorityEff ?? 0) : (route._efficiency ?? 0);
                routes = routes.filter(route => efficiencyOf(route) >= threshold);
                if (!routes.length) {
                    completeTask(task, `所有候选路线均低于最低效率 ${threshold}`);
                    continue;
                }
                if (task.sortMode === "优先最高效率，将优先执行最高分均拾取物的路线") {
                    routes.sort((a, b) => efficiencyOf(b) - efficiencyOf(a));
                } else if (task.sortMode === "优先最早刷新，将优先执行最早刷新的路线") {
                    routes.sort((a, b) =>
                        new Date(cdMap.get(basename(a.fullPath))?.cdTime || 0) -
                        new Date(cdMap.get(basename(b.fullPath))?.cdTime || 0)
                    );
                }

                const route = routes[0];
                const fullName = basename(route.fullPath);
                const targetObj = cdMap.get(fullName) || {
                    fileName: fullName,
                    cdTime: new Date(0).toISOString(),
                    history: []
                };
                if (!cdMap.has(fullName)) cdMap.set(fullName, targetObj);
                const group = pathGroupForRoute(route.fullPath);
                state.runPickupLog = [];
                const routeDisplayName = fullName.replace(/\.json$/i, "");
                startTaskExecutionTimer(task);
                setProgressPanelContext(task, routeDisplayName, pickedToday, taskRouteCount, taskCdRouteCount);
                try {
                    await selectPartyByRoutePath(route.fullPath, `任务「${task.name}」`);
                    await handleIngredientProcessing(new Date());
                    await handleTimeAdjustment(new Date(), group?.setTimeMode);
                    log.info(`当前进度：任务「${task.name}」，执行路线「${routeDisplayName}」；${formatTaskProgress(task, pickedToday, taskRouteCount, taskCdRouteCount)}`);
                    await fakeLog(routeDisplayName, false, true, 0);
                    const routeStartTime = new Date();
                    let result;
                    try {
                        result = await executeRoute(route.fullPath, routeDisplayName, targetObj, routeStartTime, lastMapName, related);
                        tasksWithExecutedRoutes.add(task.id);
                    } catch (error) {
                        await sleep(1);
                        state.running = false;
                        failedRoutes.add(route.fullPath);
                        log.error(`任务「${task.name}」执行路线 ${route.fullPath} 失败: ${error.message}`);
                        continue;
                    }

                    lastMapName = result.lastMapName;
                    const corrected = correctPickupLogByDeclaration(result.runPickupLog, route.fullPath);
                    if (!result.success) {
                        failedRoutes.add(route.fullPath);
                        await saveRecordAndClearLog(cdMap, recordFilePath, corrected);
                        continue;
                    }
                    if (result.pathRes && group) {
                        const nextCD = group.cdType === "不指定"
                            ? calculatePickupBasedRouteCD(result.runPickupLog, related, routeStartTime)
                            : calculateRouteCD(group.cdType || DEFAULT_CD_TYPE, routeStartTime);
                        targetObj.cdTime = nextCD.toISOString();
                    } else if (result.pathRes === false) {
                        failedRoutes.add(route.fullPath);
                    }
                    await saveRecordAndClearLog(cdMap, recordFilePath, corrected);
                    executed = true;
                    break;
                } finally {
                    stopTaskExecutionTimer(task);
                    if (progressPanelContext?.task?.id === task.id && progressPanelContext.status === "运行中") {
                        progressPanelContext.status = "等待调度";
                    }
                }
            } catch (error) {
                await sleep(1);
                state.running = false;
                stopTaskExecutionTimer(task);
                log.error(`任务「${task.name}」处理失败，已跳过并继续其他任务：${error.message}`);
            }
        }
        if (!executed) break;
    }
}

async function initializeSetup() {
    let stepStartedAt = beginStartupTiming("运行初始化：准备账户记录目录");
    loadRuntimeConfig();
    /* ===== 新版路径组已由 loadRuntimeConfig 载入 ===== */
    const accountError = htmlConfigAccountError(accountName);
    if (accountError) throw new Error(`账户名称无效：${accountError}`);

    // 获取子文件夹路径
    subFolderName = accountName;
    subFolderPath = `${recordFolder}/${subFolderName}`;
    pickupRecordFile = `${recordFolder}/${subFolderName}/拾取记录.json`;

    if (!file.IsFolder(recordFolder)) file.CreateDirectory(recordFolder);
    if (!file.IsFolder(subFolderPath)) file.CreateDirectory(subFolderPath);

    // 读取子文件夹中的所有文件路径
    const filesInSubFolder = file.ReadPathSync(subFolderPath);

    // 检查优先顺序：record.json > record.txt
    let indexDoExist = false;
    let useJson = false;
    for (const filePath of filesInSubFolder) {
        const fileName = basename(filePath);
        if (fileName === "record.json") {
            indexDoExist = true;
            useJson = true;
            break;
        }
        if (fileName === "record.txt") {
            indexDoExist = true;
            useJson = false;
        }
    }
    finishStartupTiming("运行初始化：准备账户记录目录", stepStartedAt, `已有索引 ${indexDoExist ? (useJson ? "record.json" : "record.txt") : "无"}`);

    const shouldRebuildIndex = operationMode === "重新生成索引文件（用于强制刷新CD）";
    if (shouldRebuildIndex) {
        log.info("重新生成索引文件模式，将覆盖现有索引文件");
    }
    if (!indexDoExist) {
        log.info("文件不存在，将尝试生成索引文件");
    }

    /* 加载材料模板并建立名称/别名索引；实际拾取方式由 pickupMode 决定。 */
    stepStartedAt = beginStartupTiming("运行初始化：加载材料识别模板");
    targetItems = await loadTargetItems();
    /* ===== 别名索引 ===== */
    name2Other = new Map();      // 本名 → 别名数组
    alias2Names = new Map();     // 别名 → 本名数组（支持多对一）
    for (const it of targetItems) {
        const aliases = it.otherName || [];
        name2Other.set(it.itemName, aliases);
        for (const a of aliases) {
            if (!alias2Names.has(a)) alias2Names.set(a, []);
            alias2Names.get(a).push(it.itemName);   // 一个别名可指向多个本名
        }
    }
    finishStartupTiming("运行初始化：加载材料识别模板", stepStartedAt, `模板 ${targetItems.length} 个`);

    stepStartedAt = beginStartupTiming("运行初始化：加载黑名单");
    await loadBlacklist(true);
    finishStartupTiming("运行初始化：加载黑名单", stepStartedAt, `材料 ${blacklist.length} 种`);
    state.running = true;

    stepStartedAt = beginStartupTiming("运行初始化：写入脚本开始记录");
    await fakeLog("采集cd管理", true, false, 1000);
    finishStartupTiming("运行初始化：写入脚本开始记录", stepStartedAt);

    // 统一的 record.json 文件路径
    recordFilePath = `${subFolderPath}/record.json`;

    // 启动时仅遍历一次 pathing；初始化与后续调度共用同一份路线快照。
    stepStartedAt = beginStartupTiming("运行初始化：加载路线索引");
    const cacheWasReady = pathingRouteCacheReady;
    const files = ensurePathingRouteCache();
    const filePaths = files.map(file => file.fullPath);
    finishStartupTiming("运行初始化：加载路线索引", stepStartedAt, `${cacheWasReady ? "复用缓存" : "首次加载"}，路线 ${filePaths.length} 条，路径组缓存 ${pathingRoutesByGroup.size} 个`);

    // ① 先加载已有记录（整对象）
    stepStartedAt = beginStartupTiming("运行初始化：合并并写回路线记录");
    let recordArray = [];
    if (indexDoExist && useJson) {
        try {
            recordArray = JSON.parse(await file.readText(recordFilePath));
        } catch (error) {
            throw new Error(`读取现有路线记录失败，为避免覆盖原记录已停止初始化：${error.message}`);
        }
    } else if (indexDoExist && !useJson) {
        try {
            const txt = await file.readText(`${subFolderPath}/record.txt`);
            txt.trim().split('\n').forEach(line => {
                const [n, t] = line.trim().split('::');
                if (n && t) recordArray.push({ fileName: n + '.json', cdTime: t });
            });
        } catch (error) {
            throw new Error(`读取旧版路线记录失败，为避免生成错误索引已停止初始化：${error.message}`);
        }
    }
    if (!Array.isArray(recordArray)) {
        throw new Error("现有路线记录不是数组，为避免覆盖原记录已停止初始化");
    }

    // ② 建 Map<fileName, 原对象>  确保 history 存在
    const existMap = new Map(recordArray.map(it => [it.fileName, {
        ...it,
        history: it.history || []   // 补空数组
    }]));

    // ③ 对 pathing 里存在的路线：只更新 cdTime，其余保留
    const defaultTime = "1970/1/1 08:00:00";
    for (const filePath of filePaths) {
        const fileName = basename(filePath);
        if (!fileName.endsWith('.json')) continue;

        const old = existMap.get(fileName) || {};
        const newCd = (indexDoExist && !shouldRebuildIndex && old.cdTime)
            ? old.cdTime
            : defaultTime;

        existMap.set(fileName, {
            ...old,          // 保留所有旧字段
            fileName,
            cdTime: newCd,
            history: old.history || []   // 确保有 history
        });
    }

    // ④ 写回（含已消失的路线）
    const writeResult = file.writeTextSync(recordFilePath,
        JSON.stringify(Array.from(existMap.values()), null, 2));

    if (writeResult) {
        log.info(`信息已成功写入: ${recordFilePath}`);
        if (shouldRebuildIndex) {
            settings.operationMode = HTML_CONFIG_SELECTS.operationMode[0];
            operationMode = settings.operationMode;
            log.info("索引文件已重新生成，索引处理方式已自动恢复为普通执行模式");
        }
    } else {
        log.error(`写入文件失败: ${recordFilePath}`);
    }
    finishStartupTiming("运行初始化：合并并写回路线记录", stepStartedAt, `记录 ${existMap.size} 条`);

    // 初始化食材加工列表
    try {
        Foods = typeof processingIngredient === "string"
            ? processingIngredient.split(/[；;,]/).map(x => x.trim()).filter(Boolean)
            : Array.from(processingIngredient || []);
    } catch (error) {
        Foods = [];
        log.warn(`解析食材加工配置失败，已停用本次食材加工：${error.message}`);
    }

    // 加载材料CD映射表
    stepStartedAt = beginStartupTiming("运行初始化：加载材料 CD 映射");
    try {
        const cdMapText = await file.readText('assets/materialCdMap.json');
        const cdMapObj = JSON.parse(cdMapText);
        materialCdMap = { ...cdMapObj['46h特产'], ...cdMapObj['12h素材'], ...cdMapObj['4点刷新'], ...cdMapObj['0点刷新'] };
        log.info(`材料CD映射表加载完成，共 ${Object.keys(materialCdMap).length} 条记录`);
    } catch (e) {
        await sleep(1);
        log.error(`加载材料CD映射表失败: ${e.message}`);
        materialCdMap = {};
    }
    finishStartupTiming("运行初始化：加载材料 CD 映射", stepStartedAt, `记录 ${Object.keys(materialCdMap).length} 条`);
}

/**
 * 加载并处理子JS脚本，返回处理后的代码（不执行）
 * @param {string} jsFilePath - 子脚本所在文件夹路径
 * @returns {Object} { code: 处理后的代码字符串, basePath: 标准化后的基础路径, scriptName: 脚本名称 }
 */
function loadSubJS(jsFilePath) {
    // ========== 1. 基础配置 ==========
    const normalizedBasePath = jsFilePath
        .replace(/[\\/]+/g, '/')
        .replace(/\/+$/, '') + '/';

    try {
        // ========== 1.1 读取 manifest.json ==========
        const manifestPath = `${normalizedBasePath}manifest.json`;
        const manifestContent = file.readTextSync(manifestPath);
        const manifest = JSON.parse(manifestContent);

        // 获取入口文件名
        const mainFileName = manifest.main || 'main.js';
        const filePath = `${normalizedBasePath}${mainFileName}`;

        // ========== 2. 读取子JS ==========
        let rawCode = file.readTextSync(filePath);

        // ========== 3. 替换API名称 ==========
        const apiReplaceMap = {
            'file.ReadPathSync': '_file_ReadPathSync',
            'file.readTextSync': '_file_readTextSync',
            'file.readText': '_file_readText',
            'file.ReadImageMatSync': '_file_ReadImageMatSync',
            'file.writeTextSync': '_file_writeTextSync',
            'file.writeText': '_file_writeText',
            'file.WriteImageSync': '_file_WriteImageSync',
            'file.IsFolder': '_file_IsFolder',
            'pathingScript.runFile': '_pathingScript_runFile',
            'keyMouseScript.runFile': '_keyMouseScript_runFile'
        };
        Object.keys(apiReplaceMap).sort((a, b) => b.length - a.length).forEach(originalApi => {
            const customApi = apiReplaceMap[originalApi];
            // 构建大小写不敏感的正则表达式
            // 将每个字符转换为可选大小写的形式，例如 "file" 变为 "[fF][iI][lL][eE]"
            const caseInsensitiveApi = originalApi.split('').map(char => {
                if (char.match(/[a-zA-Z]/)) {
                    return `[${char.toLowerCase()}${char.toUpperCase()}]`;
                }
                return char === '.' ? '\\.' : char;
            }).join('');
            const regex = new RegExp(`\\b(${caseInsensitiveApi})\\b`, 'g');
            rawCode = rawCode.replace(regex, customApi);
        });

        // ========== 4. 处理脚本执行模式 ==========
        // 将子脚本中的唯一外层 async IIFE 改为命名函数，并在最后 await 它
        const trimmedCode = rawCode.trim();
        const asyncIifeCount = (trimmedCode.match(/\(async function\s*\(/g) || []).length;

        if (asyncIifeCount === 1) {
            // 找到唯一的 async IIFE
            const asyncIifeStart = trimmedCode.indexOf('(async function');

            // 找到这个 IIFE 的结束位置（需要匹配括号）
            let braceCount = 0;
            let foundFirstBrace = false;
            let iifeEnd = -1;
            for (let i = asyncIifeStart; i < trimmedCode.length; i++) {
                if (trimmedCode[i] === '{') {
                    braceCount++;
                    foundFirstBrace = true;
                } else if (trimmedCode[i] === '}') {
                    braceCount--;
                }
                // 当找到配对的 } 后，再往后找 })();
                if (foundFirstBrace && braceCount === 0) {
                    const nextChars = trimmedCode.substring(i, i + 5);
                    if (nextChars === '})();') {
                        iifeEnd = i + 5;
                        break;
                    }
                }
            }

            if (asyncIifeStart >= 0 && iifeEnd > asyncIifeStart) {
                const beforeIife = trimmedCode.substring(0, asyncIifeStart).trim();
                const iifeCode = trimmedCode.substring(asyncIifeStart, iifeEnd);
                const firstBrace = iifeCode.indexOf('{');
                const lastBrace = iifeCode.lastIndexOf('}');
                const iifeBody = iifeCode.substring(firstBrace + 1, lastBrace).trim();
                const afterIife = trimmedCode.substring(iifeEnd).trim();

                rawCode = `return (async function() {\n${beforeIife}\n${afterIife}\nasync function __subJsMain__() {\n${iifeBody}\n}\nawait __subJsMain__();\n})();`;
            } else {
                rawCode = `return (async function() {\n${rawCode}\n})();`;
            }
        } else {
            // 没有或有多个 async IIFE，直接包裹整个脚本
            rawCode = `return (async function() {\n${rawCode}\n})();`;
        }

        // ========== 5. 构建自定义API代码 ==========
        const customApiLines = [
            '"use strict";',
            `const basePath = ${JSON.stringify(normalizedBasePath)};`,
            '',
            'function _joinPath(pathArg) {',
            '    if (typeof pathArg !== "string") return pathArg;',
            '    // 确保不会重复添加 basePath（大小写不敏感）',
            '    if (pathArg.toLowerCase().startsWith(basePath.toLowerCase())) return pathArg;',
            '    // 确保路径格式正确',
            '    const joined = basePath + pathArg.replace(/^[\\/]?/, "");',
            '    return joined.replace(/[\\/]+/g, "/");',
            '}',
            '',
            'function _file_ReadPathSync(...args) {',
            '    try {',
            '        // 对输入路径参数添加 basePath 前缀',
            '        const processedArgs = args.map(arg => _joinPath(arg));',
            '        const results = file.ReadPathSync(...processedArgs);',
            '        const newResults = [];',
            '        if (results) {',
            '            for (const res of results) {',
            '                // 按正反斜杠划分路径，去空，去除base的部分，再重新构建',
            '                const pathParts = res.split(/[\\\\/]/).filter(part => part !== "");',
            '                const baseParts = basePath.split(/[\\\\/]/).filter(part => part !== "");',
            '                let processedParts = [];',
            '                let inBasePath = true;',
            '                ',
            '                for (const part of pathParts) {',
            '                    if (inBasePath && baseParts.length > 0) {',
            '                        if (part.toLowerCase() === baseParts[0].toLowerCase()) {',
            '                            baseParts.shift();',
            '                        } else {',
            '                            inBasePath = false;',
            '                            processedParts.push(part);',
            '                        }',
            '                    } else {',
            '                        processedParts.push(part);',
            '                    }',
            '                }',
            '                ',
            '                const processedRes = processedParts.join("\\\\");',
            '                newResults.push(processedRes);',
            '            }',
            '        }',
            '        return newResults;',
            '    } catch (e) {',
            '        log.error(`_file_ReadPathSync 执行失败：${e.message}`);',
            '        return [];',
            '    }',
            '}',
            '',
            'async function _file_readText(...args) { return await file.readText(...args.map(arg => _joinPath(arg))); }',
            'function _file_readTextSync(...args) { return file.readTextSync(...args.map(arg => _joinPath(arg))); }',
            'function _file_WriteImageSync(...args) { return file.WriteImageSync(...args.map(arg => _joinPath(arg))); }',
            'function _file_IsFolder(...args) { return file.IsFolder(...args.map(arg => _joinPath(arg))); }',
            'function _pathingScript_runFile(...args) { return pathingScript.runFile(...args.map(arg => _joinPath(arg))); }',
            'function _keyMouseScript_runFile(...args) { return keyMouseScript.runFile(...args.map(arg => _joinPath(arg))); }',
            '',
            'function _file_ReadImageMatSync(...args) {',
            '    try {',
            '        const processedArgs = args.map(arg => {',
            '            const j = _joinPath(arg);',
            '            return typeof j === "string" && !j.match(/\.(png|jpg|jpeg|bmp)$/i) ? j + ".png" : j;',
            '        });',
            '        const result = file.ReadImageMatSync(...processedArgs);',
            '        return result;',
            '    } catch (e) {',
            '        log.error(`_file_ReadImageMatSync 执行失败：${e.message}`);',
            '        throw e;',
            '    }',
            '}',
            '',
            'function _file_writeText(filePath, content, append) { file.writeText(_joinPath(filePath), content, append); return true; }',
            'function _file_writeTextSync(filePath, content, append = false) { file.writeTextSync(_joinPath(filePath), content, append); return true; }',
            ''
        ];

        // ========== 6. 组合代码 ==========
        let fullCode = [...customApiLines, ...rawCode.split('\n')].join('\n');

        // ========== 7. 返回处理后的代码、路径信息和原始路径 ==========
        return {
            code: fullCode,
            basePath: normalizedBasePath,
            jsFilePath: jsFilePath
        };

    } catch (e) {
        log.error(`loadSubJS执行失败：${e.message}\n错误堆栈：${e.stack}`);
        throw e;
    }
}

/**
 * 在正确上下文中执行处理后的子脚本代码
 * 使用 new Function 创建独立作用域，避免全局变量污染
 * @param {Object} subJS - loadSubJS 返回的对象 { code, basePath, jsFilePath }
 * @param {Object} settings - 传入的配置对象
 * @returns {Promise<boolean>} 执行结果，true=成功，false=失败
 */
async function executeSubJS(subJS, settings) {
    const logName = subJS.jsFilePath.split(/[\\/]/).filter(p => p).pop() || subJS.jsFilePath;

    try {
        log.info(`子js：${logName} 开始执行`);

        // JavaScript 内置对象列表（需要排除）
        const builtInSet = new Set([
            'Object', 'Function', 'Array', 'String', 'Boolean', 'Number', 'Symbol', 'BigInt',
            'Math', 'Date', 'RegExp', 'Error', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet',
            'Promise', 'Proxy', 'Reflect', 'ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array',
            'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
            'BigInt64Array', 'BigUint64Array', 'globalThis', 'console', 'setTimeout', 'setInterval',
            'clearTimeout', 'clearInterval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
            'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent', 'eval',
            'Infinity', 'NaN', 'undefined', 'settings'
        ]);

        // 自动获取所有全局 API（排除内置对象，同时排除 settings 避免重复）
        const apis = Object.keys(globalThis).filter(key => !builtInSet.has(key));
        const values = apis.map(api => globalThis[api]);

        // 创建隔离作用域的执行函数，将 settings 作为第一个参数注入
        const execFunc = new Function('settings', ...apis, subJS.code);

        const result = execFunc(settings, ...values);

        // 如果返回的是 Promise，等待它完成
        if (result && typeof result.then === 'function') {
            await result;
        }

        log.info(`子js：${logName} 执行结束`);
        return true;
    } catch (e) {
        await sleep(1);
        log.error(`子js：${logName} 执行异常: ${e.message}`);
        return false;
    }
}

/**
 * 执行 schedule 文件
 * @param {string} schedulePath - schedule JSON 文件路径
 * @returns {Promise<boolean>} 执行结果，true=全部成功，false=有任务失败
 */
async function executeSchedule(schedulePath) {
    try {
        log.info(`===== 开始执行 Schedule: ${schedulePath} =====`);

        // 读取并解析 schedule 文件
        let scheduleContent;
        try {
            scheduleContent = file.readTextSync(schedulePath);
        } catch (e) {
            log.error(`读取 schedule 文件失败: ${schedulePath}`);
            log.error(`错误信息: ${e.message}`);
            return false;
        }

        let scheduleData;
        try {
            scheduleData = JSON.parse(scheduleContent);
        } catch (e) {
            log.error(`解析 schedule 文件失败: ${schedulePath}`);
            log.error(`错误信息: ${e.message}`);
            return false;
        }

        const { schedule: actions, tasks } = scheduleData;

        // 防御性检查
        if (!actions || !Array.isArray(actions)) {
            log.error('schedule 文件缺少 schedule 数组或格式不正确');
            return false;
        }
        if (!tasks || !Array.isArray(tasks)) {
            log.error('schedule 文件缺少 tasks 数组或格式不正确');
            return false;
        }

        // 预加载所有任务
        log.info(`预加载 ${tasks.length} 个任务...`);
        const taskMap = new Map();
        for (const task of tasks) {
            await sleep(1);
            // 检查任务配置完整性
            if (!task.name || !task.filePath) {
                log.error(`任务配置不完整，缺少 name 或 filePath: ${JSON.stringify(task)}`);
                return false;
            }

            // 根据 type 字段判断任务类型（大小写不敏感）
            const taskTypeRaw = (task.type || 'js').toLowerCase();
            let taskType;
            if (taskTypeRaw === 'js') {
                taskType = 'subJS';
            } else if (taskTypeRaw === 'autopathing') {
                taskType = 'pathing';
            } else if (taskTypeRaw === 'keymousescript') {
                taskType = 'keyMouse';
            } else {
                log.error(`未知的任务类型: ${task.type}`);
                return false;
            }

            const filePath = task.filePath;
            log.info(`加载任务: ${task.name} (${filePath}, 类型: ${taskType})`);

            let taskInfo;
            if (taskType === 'subJS') {
                taskInfo = loadSubJS(filePath);
            } else {
                taskInfo = { filePath: filePath, type: taskType };
            }

            taskMap.set(task.name, {
                ...task,
                taskType: taskType,
                taskInfo: taskInfo
            });
        }
        log.info('所有任务加载完成');

        // 存储正在运行的异步任务
        const runningTasks = new Map();

        // 按顺序执行 schedule 中的每个动作
        for (const action of actions) {
            await sleep(1);

            const { action: actionType, task: taskName, count = 1 } = action;

            if (actionType === 'start') {
                // 查找任务配置
                const taskConfig = taskMap.get(taskName);
                if (!taskConfig) {
                    log.error(`未找到任务: ${taskName}`);
                    return false;
                }

                const { taskType, taskInfo, async: isAsync, settings } = taskConfig;

                // 检查异步任务是否已在运行
                if (isAsync && runningTasks.has(taskName)) {
                    log.warn(`任务 ${taskName} 正在执行中，不要重复启动`);
                    continue;
                }

                // 执行指定次数
                for (let i = 0; i < count; i++) {
                    await sleep(1);
                    log.info(`执行任务: ${taskName} (第 ${i + 1}/${count} 次)`);

                    let executionPromise;

                    if (taskType === 'subJS') {
                        executionPromise = executeSubJS(taskInfo, settings);
                    } else if (taskType === 'pathing') {
                        executionPromise = pathingScript.runFile(taskInfo.filePath);
                    } else if (taskType === 'keyMouse') {
                        executionPromise = keyMouseScript.runFile(taskInfo.filePath);
                    } else {
                        log.error(`未知的任务类型: ${taskType}`);
                        return false;
                    }

                    if (isAsync) {
                        // 异步执行，不等待完成
                        runningTasks.set(taskName, executionPromise);
                        log.info(`任务 ${taskName} 已异步启动`);
                    } else {
                        // 同步执行，等待完成
                        const result = await executionPromise;
                        if (taskType === 'subJS' && !result) {
                            log.error(`任务 ${taskName} 执行失败`);
                            return false;
                        }
                    }
                }
            } else if (actionType === 'wait') {
                // 等待指定任务完成
                if (runningTasks.has(taskName)) {
                    log.info(`等待任务完成: ${taskName}`);
                    const result = await runningTasks.get(taskName);
                    runningTasks.delete(taskName);
                    const taskConfig = taskMap.get(taskName);
                    if (taskConfig && taskConfig.taskType === 'subJS' && !result) {
                        log.error(`任务 ${taskName} 执行失败`);
                        return false;
                    }
                    log.info(`任务 ${taskName} 已完成`);
                } else {
                    log.warn(`任务 ${taskName} 未在运行中，无需等待`);
                }
            } else {
                log.error(`未知的 action 类型: ${actionType}`);
                return false;
            }
        }

        // 等待所有剩余的异步任务完成
        if (runningTasks.size > 0) {
            log.info(`等待 ${runningTasks.size} 个异步任务完成...`);
            const taskEntries = Array.from(runningTasks.entries());
            const promises = taskEntries.map(([_, promise]) => promise);
            const results = await Promise.all(promises);
            for (let i = 0; i < taskEntries.length; i++) {
                await sleep(1);
                const [name, _] = taskEntries[i];
                if (!results[i]) {
                    log.error(`异步任务 ${name} 执行失败`);
                    return false;
                }
            }
        }

        log.info(`===== Schedule 执行完成: ${schedulePath} =====`);
        return true;
    } catch (e) {
        await sleep(1);
        log.error(`执行 Schedule 失败: ${e.message}`);
        log.error(`错误堆栈: ${e.stack}`);
        return false;
    }
}

/**
 * 判断两个材料名称是否为同一材料或互为已知别名。
 */
function materialNamesEquivalent(left, right) {
    if (left === right) return true;
    if ((alias2Names?.get(left) || []).includes(right)) return true;
    if ((alias2Names?.get(right) || []).includes(left)) return true;
    if ((name2Other?.get(left) || []).includes(right)) return true;
    if ((name2Other?.get(right) || []).includes(left)) return true;
    return false;
}

function materialNamesWithAliases(names) {
    const result = new Set();
    for (const name of names || []) {
        if (!name) continue;
        result.add(name);
        for (const alias of name2Other?.get(name) || []) result.add(alias);
        for (const realName of alias2Names?.get(name) || []) result.add(realName);
    }
    return result;
}

function materialValueFor(name, valueMap) {
    if (valueMap.has(name)) return valueMap.get(name);
    for (const [configuredName, value] of valueMap) {
        if (materialNamesEquivalent(name, configuredName)) return value;
    }
    return 1;
}

/**
 * 用声明数量覆盖历史中的同名材料及别名，避免实际识别值与声明值重复计数。
 */
function mergeItemsWithDeclaration(items, declaredMaterials) {
    const merged = { ...(items || {}) };
    if (!declaredMaterials) return merged;
    for (const declaredName of Object.keys(declaredMaterials)) {
        for (const historyName of Object.keys(merged)) {
            if (materialNamesEquivalent(historyName, declaredName)) delete merged[historyName];
        }
        merged[declaredName] = declaredMaterials[declaredName];
    }
    return merged;
}

/**
 * 从路线 description 中解析材料数量和时间
 * 支持两种格式：
 *   1. 【用时60秒，甜甜花*12，枫木*5】
 *   2. 2个薄荷；3个日落果；11个蘑菇；（老格式，无时间）
 * @param {string} description 路线 info.description
 * @returns {{ declaredMaterials: Object|null, declaredDuration: number|null }}
 */
function parseDeclaration(description) {
    try {
        if (!description) return { declaredMaterials: null, declaredDuration: null };

        let declaredDuration = null;
        const declaredMaterials = {};

        // 格式1: 【用时60秒，甜甜花*12】
        const m = description.match(/【([^】]+)】/);
        if (m) {
            m[1].split('，').forEach(part => {
                part = part.trim();
                if (!part) return;
                const tm = part.match(/^用时(\d+)秒$/);
                if (tm) { declaredDuration = parseInt(tm[1]); return; }
                const im = part.match(/^(.+)\*(\d+)$/);
                if (im) { declaredMaterials[im[1].trim()] = parseInt(im[2]); }
            });
        } else {
            // 格式2: 2个薄荷；3个日落果；（老格式，无时间信息）
            const oldRe = /(\d+)个([^；\s]+)/g;
            let match;
            while ((match = oldRe.exec(description)) !== null) {
                declaredMaterials[match[2].trim()] = parseInt(match[1]);
            }
        }

        return { declaredMaterials: Object.keys(declaredMaterials).length > 0 ? declaredMaterials : null, declaredDuration };
    } catch (e) {
        return { declaredMaterials: null, declaredDuration: null };
    }
}

/**
 * 用路线声明材料数量修正拾取日志
 * 声明中涉及的材料，其出现次数替换为声明值；未涉及的材料保留实际检测值
 * 用于保证每日记录和优先扣减使用完整的产量，而非模板匹配漏检后的不完整数据
 * 
 * @param {string[]} pickupLog - 原始拾取日志（模板匹配实际命中的结果）
 * @param {string} routeFilePath - 路线 json 文件完整路径
 * @returns {string[]} 修正后的拾取日志（声明材料按声明值，其余保留原始值）
 */
function correctPickupLogByDeclaration(pickupLog, routeFilePath) {
    try {
        const raw = file.readTextSync(routeFilePath);
        const json = JSON.parse(raw);
        const dec = parseDeclaration(json.info?.description || '');
        if (!dec.declaredMaterials) return pickupLog;

        const declaredNames = Object.keys(dec.declaredMaterials);
        // 未在声明中涉及的材料，保留原始拾取值；同一材料的别名也视为已声明。
        const nonDeclared = pickupLog.filter(name => !declaredNames.some(declared => materialNamesEquivalent(name, declared)));

        // 声明材料用声明值
        const corrected = [...nonDeclared];
        for (const [name, count] of Object.entries(dec.declaredMaterials)) {
            for (let i = 0; i < count; i++) {
                corrected.push(name);
            }
        }
        return corrected;
    } catch (e) {
        return pickupLog; // 任何异常都回退到原始日志
    }
}
