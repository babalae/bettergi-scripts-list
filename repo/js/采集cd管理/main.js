/* ===== 1. 自定义配置 ===== */
const timeMoveUp = Math.round((settings.timeMove || 1000) * 0.45);
const timeMoveDown = Math.round((settings.timeMove || 1000) * 0.55);
const accountName = settings.infoFileName || "默认账户";
const operationMode = settings.operationMode || "执行任务（若不存在索引文件则自动创建）";
const disableJsons = settings.disableJsons || "";
let processingIngredient = settings.processingIngredient;
let findFInterval = Math.max(16, Math.min(200, parseInt(settings.findFInterval) || 100));
let checkInterval = +settings.checkInterval || 50;
let groupCount;
/* ===== 2. 使用的模板和识别对象 ===== */
const mainUiRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/MainUI.png"), 0, 0, 150, 150);
const fullRoi = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/itemFull.png"), 0, 0, 1920, 1080);
const FiconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F_Dialogue.png"), 1102, 335, 34, 400);
FiconRo.Threshold = 0.9;
FiconRo.InitTemplate();
const scrollRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/拾取滚轮.png"), 1017, 496, 1093 - 581, 581 - 496);

/* ===== 3. 全局通用常量 ===== */
const targetItemPath = "assets/targetItems";
const recordFolder = "record";
const rollingDelay = 32;
const pickupDelay = 100;
const MAX_PICKUP_DAYS = 30;
const cookInterval = 95 * 60 * 1000;
const settimeInterval = 10 * 60 * 1000;

/* ===== 4. 全局通用变量 ===== */
let currentParty = '';
let targetItems = [];
let blacklist = [];
let blacklistSet = new Set();
let gameRegion;
let state = { running: true };
state.runPickupLog = [];   // 本次路线运行中拾取/交互的物品明细
let pickupRecordFile;
let firstCook = true;
let firstsettime = true;
let lastCookTime = new Date();
let lastsettimeTime = new Date();
let lastMapName = "";
let disableArray = [];
if (disableJsons) {
    let tmp = disableJsons.split('；');
    for (let k = 0; k < tmp.length; k++) {
        let s = tmp[k].trim();
        if (s) disableArray[disableArray.length] = s;
    }
}
let lastRoll = new Date();
let Foods = [];
let folderNames;
let partyNames;
let subFolderName;
let subFolderPath;
let recordFilePath;
let name2Other;
let alias2Names;

/* ===== 5. 待定分区（后续手动分类） ===== */
let materialCdMap = {};

(async function () {
    dispatcher.AddTrigger(new RealtimeTimer("AutoSkip"));
    // ==================== 构建 settings.json ====================
    if (!await buildSettingsJson()) {
        return;
    }
    // ==================== 初始化设置和记录文件 ====================
    await initializeSetup();

    // ==================== 优先级材料前置采集 ====================
    await processPriorityItems();

    // ==================== 路径组循环 ====================
    await processPathGroups();

})();

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
    gameRegion = captureGameRegion();
    let lastCheckItemFull = new Date();
    let checkTask = null;

    while (state.running) {
        gameRegion.dispose();
        gameRegion = captureGameRegion();

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
            if (checkTask) {
                try { await checkTask; }
                catch (e) { log.error('背包满检查异常:', e); }
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
                    catch (e) { log.error('背包满检查异常:', e); }
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
        if (checkTask) {
            try { await checkTask; }
            catch (e) { log.error('背包满检查异常:', e); }
            finally { checkTask = null; }
        }
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
    /* 一次性切 6 种宽度（0-5 汉字） */
    const regions = [];
    for (let cn = 0; cn <= 6; cn++) {   // 0~5 共 6 档
        const w = 12 + 28 * Math.min(cn, 5) + 2;
        regions[cn] = gameRegion.DeriveCrop(1219, centerYF - 15, w, 30);
    }

    try {
        for (const it of targetItems) {
            const cnLen = Math.min(
                [...it.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length,
                5
            ); // 0-5

            if (regions[cnLen].find(it.roi).isExist()) {
                return it.itemName;
            }
        }
    } catch (e) {
        log.error(`performTemplateMatch: ${e.message}`);
    } finally {
        regions.forEach(r => r.dispose());
    }
    return null;
}

/**
 * 检查是否为主界面函数
 * 检查游戏是否处于主界面状态
 * 
 * @returns {Promise<boolean>} 返回是否为主界面，true 表示是主界面，false 表示不是
 * 
 * @依赖全局变量：
 * - gameRegion: 游戏区域对象
 * - mainUiRo: 主界面的识别对象
 * - state: 状态对象，包含 running 标志
 * - findFInterval: 识别间隔时间
 * 
 * @依赖辅助函数：
 * - sleep: 延迟函数
 */
async function isMainUI() {
    for (let i = 0; i < 1 && state.running; i++) {
        if (!gameRegion) gameRegion = captureGameRegion();
        try {
            if (gameRegion.find(mainUiRo).isExist()) {
                return true;
            }
        } catch (e) {
            log.error(`isMainUI:${e.message}`);
        }
        await sleep(findFInterval);
    }
    return false;
}

/**
 * 检查背包是否满并进行 OCR 识别函数
 * 检查游戏背包是否已满，并通过 OCR 识别物品名称，将满的物品加入黑名单
 * 
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
async function checkItemFullAndOCR() {
    try {
        if (!gameRegion.find(fullRoi).isExist()) return;
    } catch (e) { return; }
    const TEXT_X = 560, TEXT_Y = 450, TEXT_W = 800, TEXT_H = 170;
    let ocrText = null;
    try {
        const list = gameRegion.findMulti(RecognitionObject.ocr(TEXT_X, TEXT_Y, TEXT_W, TEXT_H));
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
    const targetItemPath = "assets/targetItems/";

    const items = await readFolder(targetItemPath, false);

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

        } catch (error) {
            log.error(`[loadTargetItems] ${it.fullPath}: ${error.message}`);
        }
    }
    return items;
}

/**
 * 加载黑名单函数
 * 从文件中加载黑名单，并将其合并到内存中的黑名单数组和集合中
 * 
 * @param {boolean} writeBack - 是否将黑名单写回文件
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - accountName: 账户名称
 * - blacklist: 黑名单数组
 * - blacklistSet: 黑名单集合
 * - settings: 设置对象
 * - disableArray: 禁用关键词数组
 * 
 * @依赖辅助函数：
 * 无
 */
async function loadBlacklist(writeBack) {
    try {
        const raw = await file.readText(`blacklists/${accountName}.json`);
        blacklist = [...new Set([...blacklist, ...JSON.parse(raw)])];
    } catch { /* 文件不存在就跳过 */ }
    blacklistSet = new Set(blacklist);

    // 仅把 blacklist 中的中文部分合并到内存中的 settings.disableJsons
    const chineseParts = blacklist
        .map(name => name.replace(/[^\u4e00-\u9fa5]/g, ''))
        .filter(Boolean);

    const existing = settings.disableJsons
        ? settings.disableJsons.split('；').map(s => s.trim()).filter(Boolean)
        : [];

    const merged = [...new Set([...existing, ...chineseParts])].sort().join('；');
    settings.disableJsons = merged;

    if (writeBack) {
        await file.writeText(`blacklists/${accountName}.json`, JSON.stringify(blacklist, null, 2), false);
    }
    // 实时同步禁用关键词数组
    disableArray = settings.disableJsons.split('；').map(s => s.trim()).filter(Boolean);
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
    const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
    return filePath.substring(lastSlashIndex + 1);
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
 */
async function readFolder(folderPath, onlyJson) {
    const folderStack = [folderPath];
    const files = [];

    while (folderStack.length > 0) {
        const currentPath = folderStack.pop();
        const filesInSubFolder = file.ReadPathSync(currentPath); // 同步读取
        const subFolders = [];

        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                subFolders.push(filePath);
                continue;
            }

            if (filePath.endsWith('.js')) continue; // 跳过 js

            // 仅 json 模式
            if (onlyJson) {
                if (!filePath.endsWith('.json')) continue;

                let description = '';
                try {
                    // 同步读文本，避免 async 传染
                    const txt = file.readTextSync(filePath);
                    const parsed = JSON.parse(txt);
                    description = parsed?.info?.description ?? '';
                } catch {
                    /* 读盘或解析失败就留空串 */
                }

                const fileName = filePath.split('\\').pop();
                const folderPathArray = filePath.split('\\').slice(0, -1);

                files.push({
                    fullPath: filePath,
                    fileName,
                    folderPathArray,
                    description
                });
                continue;
            }

            const fileName = filePath.split('\\').pop();
            const folderPathArray = filePath.split('\\').slice(0, -1);
            files.push({ fullPath: filePath, fileName, folderPathArray });
        }

        // 子文件夹按原顺序入栈（深度优先）
        folderStack.push(...subFolders.reverse());
    }

    return files;
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
        log.error('队伍切换失败，可能处于联机模式或其他不可切换状态');
        notification.error('队伍切换失败，可能处于联机模式或其他不可切换状态');
        await genshin.returnMainUi();
    }
}

/**
 * 检查当前时间是否处于限制时间内或即将进入限制时间
 * 
 * @param {string} timeRule - 时间规则字符串，格式如 "8, 8-11, 23:11-23:55"
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

        let startStr, endStr;
        if (seg.includes('-')) {
            [startStr, endStr] = seg.split('-').map(s => s.trim());
        } else {
            startStr = endStr = seg.trim();
        }

        const parseTime = (str, isEnd) => {
            if (str.includes(':')) {
                const [h, m] = str.split(':').map(Number);
                return { h, m };
            }
            // 单独小时：start 8→8:00，end 8→8:59
            const h = Number(str);
            return { h, m: isEnd ? 59 : 0 };
        };

        const start = parseTime(startStr, false);
        const end = parseTime(endStr, true);

        const startTotal = start.h * 60 + start.m;
        const endTotal = end.h * 60 + end.m;

        const effectiveEnd = endTotal >= startTotal ? endTotal : endTotal + 24 * 60;

        if (
            (currentTotal >= startTotal && currentTotal < effectiveEnd) ||
            (currentTotal + 24 * 60 >= startTotal && currentTotal + 24 * 60 < effectiveEnd)
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

    const rg = captureGameRegion();
    const foodItems = [];
    try {
        for (const flag of ['已加工0个', '已加工1个']) {
            const mat = file.ReadImageMatSync(`assets/RecognitionObject/${flag}.png`);
            const res = rg.findMulti(RecognitionObject.TemplateMatch(mat));
            for (let k = 0; k < res.count; ++k) {
                foodItems.push({ x: res[k].x, y: res[k].y });
            }
            mat.dispose();
        }
    } finally { rg.dispose(); }

    log.info(`识别到${foodItems.length}个加工中食材`);

    for (const item of foodItems) {
        click(item.x, item.y); await sleep(1 * checkInterval);
        click(item.x, item.y); await sleep(3 * checkInterval);

        for (let round = 0; round < 5; round++) {
            const rg = captureGameRegion();
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
            } finally {
                rg.dispose();
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
        const pct = Math.max(0, Math.min(1, percentile === "" ? 0.5 : Number(percentile)));
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
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - settings: 设置对象
 * - firstsettime: 是否首次调节时间
 * - lastsettimeTime: 上次调节时间
 * - settimeInterval: 时间调节间隔
 * 
 * @依赖辅助函数：
 * - pathingScript.runFile: 运行路径脚本函数
 */
async function handleTimeAdjustment(timeNow) {
    if (settings.setTimeMode && settings.setTimeMode != "不调节时间" && (((timeNow - lastsettimeTime) > settimeInterval) || firstsettime)) {
        firstsettime = false;
        if (settings.setTimeMode === "尽量调为白天") {
            await pathingScript.runFile("assets/调为白天.json");
        } else {
            await pathingScript.runFile("assets/调为夜晚.json");
        }
        lastsettimeTime = new Date();
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
        await ingredientProcessing();
        lastCookTime = new Date();
        lastMapName = "Teyvat";
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

    const raw = file.readTextSync(filePath);
    const json = JSON.parse(raw);
    const mapName = (json.info?.map_name && json.info.map_name.trim()) ? json.info.map_name : 'Teyvat';
    await handleUnderwaterRoute(mapName, filePath, lastMapName);
    lastMapName = mapName;
    const pickupTask = recognizeAndInteract();

    try {
        await pathingScript.runFile(filePath);
    } catch (e) {
        log.error(`路线执行失败: ${filePath}`);
        state.running = false;
        await pickupTask;
        return { success: false, lastMapName };
    }
    state.running = false;
    await pickupTask;
    await fakeLog(fileName, false, false, 0);

    /* 4-4 计算CD（掉落材料决定）*/
    const timeDiff = new Date() - startTime;
    let pathRes = isArrivedAtEndPoint(filePath);

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
            /* 2-1 判定本次有没有优先材料 */
            const hasPriority = state.runPickupLog.some(name => priorityItemSet.has(name));
            let hitMaterials;
            if (hasPriority) {
                hitMaterials = [...new Set(state.runPickupLog.filter(n => priorityItemSet.has(n)))];
            } else {
                hitMaterials = [...new Set(state.runPickupLog)];
            }

            /* 2-2 按材料表取最晚 CD */
            let latestCD = new Date(0);
            hitMaterials.forEach(name => {
                const cdType = materialCdMap[name] || "1次0点刷新";
                const tmpDate = calculateRouteCD(cdType, startTime);
                if (tmpDate > latestCD) latestCD = tmpDate;
            });

            /* 兜底：没有任何材料被识别到，按1次0点刷新 */
            if (hitMaterials.length === 0) {
                latestCD = calculateRouteCD("1次0点刷新", startTime);
            }

            targetObj.cdTime = latestCD.toISOString();
        }
    }

    return { success: true, lastMapName, runPickupLog: state.runPickupLog };
}

/**
 * 优先历史拾取物排序
 * 
 * @param {Array} targetItems - 目标物品数组
 * @param {Map} cdMap - CD时间映射
 * @param {string} fullName - 文件名
 * @returns {Array} - 排序后的物品数组，历史上出现过的物品放在前面
 * 
 * @依赖全局变量：
 * 无
 * 
 * @依赖辅助函数：
 * 无
 */
function prioritizeHistoricalItems(targetItems, cdMap, fullName) {
    // 0) 只有 history 里出现过的物品才需要前置
    const historyItemSet = new Set();
    const routeRec = cdMap.get(fullName);
    if (routeRec?.history) {
        routeRec.history.forEach(log => {
            Object.keys(log.items).forEach(name => historyItemSet.add(name));
        });
    }

    // 1) 把 targetItems 拆成「历史出现」+「未出现」两部分
    const frontPart = [];
    const backPart = [];
    for (const it of targetItems) {
        (historyItemSet.has(it.itemName) ? frontPart : backPart).push(it);
    }

    // 2) 合并后重新赋值，完成前置
    return [...frontPart, ...backPart];
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
 * 
 * @依赖辅助函数：
 * - appendDailyPickup: 追加每日拾取量函数
 */
async function saveRecordAndClearLog(cdMap, recordFilePath, runPickupLog) {
    await file.writeText(
        recordFilePath,
        JSON.stringify(Array.from(cdMap.values()), null, 2)
    );
    await appendDailyPickup(runPickupLog);
    state.runPickupLog = [];
}

/**
 * 根据路线路径选择合适的队伍
 * 
 * @param {string} routePath - 路线路径
 * @param {string} stage - 阶段名称
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - settings: 设置对象，包含路径组和队伍配置
 * - groupCount: 路径组数量
 * 
 * @依赖辅助函数：
 * - switchPartyIfNeeded: 切换队伍函数
 */
async function selectPartyByRoutePath(routePath, stage) {
    const fullPath = routePath;                            // 例：pathing/须弥/xxx.json
    const folderName = fullPath.split(/\\|\//)[1];   // 索引 1 就是第二层
    let targetParty = '';                                           // 最终要用的队伍名

    for (let g = 1; g <= groupCount; g++) {                         // 遍历路径组
        if (settings[`pathGroup${g}FolderName`] === folderName) {   // 找到归属组
            targetParty = settings[`pathGroup${g}PartyName`] || '';
            break;                                                  // 命中即停
        }
    }
    if (!targetParty) targetParty = settings.priorityItemsPartyName || ''; // 回退
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
        default:
            newTimestamp = startTime;
            break;
    }
    return newTimestamp;
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
    const { groupIndex, priorityItemSet, disableArray, isPriorityMode = false } = options;

    if (isPriorityMode) {
        // 优先采集模式：只计算优先材料的效率
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

            // 计算仅看优先材料的分均效率
            let eff = -2; // 未知标记
            if (rec?.history && rec.history.length >= 3) {
                const effList = rec.history.map(log => {
                    const total = Object.entries(log.items)
                        .filter(([name]) => priorityItemSet.has(name))
                        .reduce((sum, [, cnt]) => sum + cnt, 0);
                    return (total / log.durationSec) * 60;
                });
                eff = effList.reduce((a, b) => a + b, 0) / effList.length;
            }
            file._priorityEff = eff;
        }
    } else {
        // 路径组模式：计算所有材料的效率，使用加权规则
        // 0) 解析优先关键词
        const priorityKeywords = settings.priorityTags
            ? settings.priorityTags.split('，').map(s => s.trim()).filter(Boolean)
            : [];

        // 1) 解析加权规则
        const weightMap = new Map();
        if (settings.weightedRule) {
            settings.weightedRule
                .split('，')
                .map(s => s.trim())
                .forEach(rule => {
                    const [item, wStr] = rule.split('*');
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

            if (obj && obj.history && obj.history.length >= 3) {
                const effList = obj.history.map(log => {
                    const total = Object.entries(log.items).reduce((sum, [name, cnt]) => {
                        const w = blacklistSet.has(name) ? 0 : (weightMap.get(name) ?? 1);
                        return sum + cnt * w;
                    }, 0);
                    return (total / log.durationSec) * 60;
                });
                avgEff = effList.reduce((a, b) => a + b, 0) / effList.length;
            }
            p._efficiency = avgEff; // 已知路线存真实效率，未知路线存 -1
        });

        // 3) 计算默认效率（分位值 & 临界值 取最大）
        const knownEff = files
            .map(p => p._efficiency)
            .filter(e => e >= 0)          // 只保留已知路线
            .sort((a, b) => a - b);

        const userThreshold = Number(settings[`pathGroup${groupIndex}thresholdEfficiency`]) || 0;
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
    try {
        const txt = await file.readText(pickupRecordFile);
        if (txt) oldArr = JSON.parse(txt);
    } catch (_) { /* 文件不存在或解析失败 */ }

    // 统一按 UTC+8 的 4 点划分日期
    const utc8_4am = new Date(Date.now() + 8 * 3600_000 - 4 * 3600_000);
    const today = utc8_4am.toISOString().slice(0, 10); // "YYYY-MM-DD"

    let todayItem = oldArr.find(e => e.date === today);
    if (!todayItem) {
        todayItem = { date: today, items: {} };
        oldArr.push(todayItem);
    }

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
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.95;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, true, maxAttempts * checkInterval, checkInterval);
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
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.95;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, false, maxAttempts * checkInterval, checkInterval);
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

        const start = Date.now();
        let found = null;

        while (Date.now() - start <= timeout) {
            const gameRegion = captureGameRegion();
            try {
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
            } finally {
                gameRegion.dispose();
            }
            await sleep(interval);                 // 没找到时等待
        }

        // 3. 按需返回
        return retType === 0 ? !!found : (found || null);

    } catch (error) {
        log.error(`执行通用识图时出现错误：${error.message}`);
        return retType === 0 ? false : null;
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

        /* 2. 取当前人物坐标 */

        const mapName = (json.info?.map_name && json.info.map_name.trim()) ? json.info.map_name : 'Teyvat';
        const pos = genshin.getPositionFromMap(mapName, 3000);
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
    const start = Date.now();
    let dodispose = false;
    while (Date.now() - start < maxDuration) {
        if (!gameRegion) {
            gameRegion = captureGameRegion();
            dodispose = true;
        }
        try {
            const result = gameRegion.find(scrollRo);
            if (result.isExist()) return true;
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            return false;          // 一旦出现异常直接退出，不再重试
        }
        await sleep(findFInterval);   // 识别间隔
        if (dodispose) {
            gameRegion.dispose();
            dodispose = false;     // 已经释放，标记避免重复 dispose
        }
    }
    /* 超时仍未识别到，返回失败 */
    return false;
}

/**
 * 零基构建 settings.json 配置文件
 * 扫描 pathing 目录下的文件夹，动态生成包含路径组配置的 settings.json 文件
 * 
 * @returns {Promise<boolean>} 返回是否继续运行，仅刷新模式返回 false，否则返回 true
 * 
 * @依赖全局变量：
 * - settings: 用户设置对象
 * - groupCount: 路径组数量
 * 
 * @依赖辅助函数：无
 */
async function buildSettingsJson() {
    const SETTINGS_FILE = `settings.json`;
    const PATHINGS_ROOT = `pathing`;

    /* 1. 扫描 pathing 下第一层目录 */
    const filesInFolder = file.ReadPathSync(PATHINGS_ROOT);
    const subFolders = []; // 用于存储第一层文件夹路径
    for (const filePath of filesInFolder) {
        if (file.IsFolder(filePath)) {
            // 如果是文件夹，先存储到临时数组中
            subFolders.push(filePath);
        }
    }

    /* 2. 提取文件夹名称 */
    const firstLevelDirs = subFolders
        .map(folderPath => folderPath.replace(`${PATHINGS_ROOT}/`, '').replace(`${PATHINGS_ROOT}\\`, '')) // 去掉前缀 `pathing/` 或 `pathing\`
        .filter(Boolean); // 去掉空字符串

    let uniqueDirs = Array.from(new Set(firstLevelDirs)); // 去重

    /* 4. 路径组数量 */
    groupCount = Math.min(99, Math.max(1, parseInt(settings.groupCount || '3')));

    /* 5. 硬编码构建全新 JSON */
    const newSettings = [];

    /* 5.1 最前端：onlyRefresh + groupCount */
    newSettings.push(
        {
            name: "onlyRefresh",
            type: "checkbox",
            label: "勾选后仅刷新自定义配置，不运行"
        },
        {
            name: "groupCount",
            type: "input-text",
            label: "需要生成几个路径组配置（1-99）",
            default: "3"
        },
        {
            name: "enableMoreSettings",
            type: "checkbox",
            label: "勾选后下次运行展开高级设置\n用于进行路线筛选和排序"
        }
    );

    /* 5.2 操作模式 */
    newSettings.push({
        name: "operationMode",
        type: "select",
        label: "选择操作模式",
        options: [
            "执行任务（若不存在索引文件则自动创建）",
            "重新生成索引文件（用于强制刷新CD）"
        ]
    });

    /* 5.3 固定尾部节点（原样照搬） */
    newSettings.push(
        {
            "name": "timeRule",
            "type": "input-text",
            "label": "本地时间-不运行时段\n示例写法：\n  单个小时：8\n  连续区间：8-11 或 23:11-23:55（可省略分钟）\n  多项分隔：用中文逗号【，】\n规则：\n  只写小时：开始=整点，结束=59分；跨天自动识别\n  含分钟：按实际时分计算\n  提前10分钟结束并等待到限制时段开始\n留空=全天可运行"
        },
        {
            "name": "infoFileName",
            "type": "input-text",
            "label": "输入用于存储信息的文件名，只在不同账号分别管理CD时填写"
        },
        {
            "name": "priorityItems",
            "type": "input-text",
            "label": "优先采集材料，每天会尝试优先采集指定数量的目标物品，随后才执行路径组\n格式：材料名*数量，由加号+连接\n如萃凝晶*160+甜甜花*10"
        },
        {
            "name": "priorityItemsPartyName",
            "type": "input-text",
            "label": "优先采集材料使用的备用配队名称\n在指定路线不存在对应文件夹指定的配队时使用"
        },
        {
            "name": "disableJsons",
            "type": "input-text",
            "label": "填写需要禁用的路线的关键词，使用中文分号分隔\n文件路径含有相关关键词的路线会被禁用"
        },
        {
            "name": "disableXYCheck",
            "type": "checkbox",
            "label": "勾选后跳过路线完成后的坐标校验\n【警告】运行卡死等未成功到达终点的路线也将进入cd"
        },
        {
            "name": "findFInterval",
            "type": "input-text",
            "label": "识别间隔(毫秒)\n两次检测f图标之间等待时间",
            "default": "100"
        },
        {
            "name": "processingIngredient",
            "type": "multi-checkbox",
            "label": "要加工的食材种类",
            "default": [],
            "options": [
                "面粉",
                "兽肉",
                "鱼肉",
                "神秘的肉",
                "黑麦粉",
                "奶油",
                "熏禽肉",
                "黄油",
                "火腿",
                "糖",
                "香辛料",
                "酸奶油",
                "蟹黄",
                "果酱",
                "奶酪",
                "培根",
                "香肠"
            ]
        },
        {
            "name": "checkInterval",
            "type": "input-text",
            "label": "食材加工中的识别间隔(毫秒)，设备反应较慢出现识别错误时适当调大",
            "default": "50"
        },
        {
            "name": "setTimeMode",
            "type": "select",
            "label": "尝试调节时间来获得移速加成\n队伍中含迪希雅、嘉明或塔利雅时选择白天\n队伍中含罗莎莉亚时选择夜晚",
            "options": [
                "不调节时间",
                "尽量调为白天",
                "尽量调为夜晚"
            ],
            "default": "不调节时间"
        }
    );

    if (settings.enableMoreSettings) {
        newSettings.push(
            {
                "name": "priorityTags",
                "type": "input-text",
                "label": "优先关键词，文件名或拾取材料含关键词的路线会被视为最高效率\n不同关键词使用【中文逗号】分隔"
            },
            {
                "name": "sortMode",
                "type": "select",
                "label": "选择同组路线排序模式",
                "options": [
                    "文件顺序，按在文件夹中位置顺序运行",
                    "优先最早刷新，将优先执行最早刷新的路线",
                    "优先最高效率，将优先执行最高分均拾取物的路线"
                ],
                "default": "文件顺序，按在文件夹中位置顺序运行"
            },
            {
                "name": "defaultEffPercentile",
                "type": "input-text",
                "label": "默认效率指数，范围0-1\n数值越大时，未知效率的路线被视作的默认效率越高",
                "default": "0.5"
            },
            {
                "name": "weightedRule",
                "type": "input-text",
                "label": "加权规则，允许将特定物品视为多倍计算效率\n黑名单物品将自动视为0\n格式如下：\n物品名称*权重\n使用【中文逗号】分隔\n如：甜甜花*2，树莓*0"
            }
        );
    }

    /* 5.4 路径组节点（整体移到最后） */
    for (let g = 1; g <= groupCount; g++) {
        /* 文件夹 */
        newSettings.push({
            name: `pathGroup${g}FolderName`,
            type: "select",
            label: `#############################################\n选择路径组${g}文件夹（pathing下第一层）`,
            options: ["", ...uniqueDirs]
        });

        /* CD类型 */
        newSettings.push({
            name: `pathGroup${g}CdType`,
            type: "select",
            label: `选择路径组${g}CD类型，不选不运行该路径组`,
            options: [
                "",
                "1次0点刷新",
                "2次0点刷新",
                "3次0点刷新",
                "4点刷新",
                "12小时刷新",
                "24小时刷新",
                "46小时刷新"
            ]
        });

        /* 队伍名 */
        newSettings.push({
            name: `pathGroup${g}PartyName`,
            type: "input-text",
            label: `输入路径组${g}使用配队名称`
        });

        if (settings.enableMoreSettings) {
            newSettings.push({
                "name": `pathGroup${g}thresholdEfficiency`,
                "type": "input-text",
                "label": `路径组${g}临界效率\n分均拾取个数效率低于临界效率的路线会被排除`,
                "default": "0"
            });
        }
    }

    /* 6. 一次性写入 & 日志 */
    await file.writeText(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), false);
    log.info(`已全新生成 settings.json，共 ${groupCount} 个路径组配置。`);
    log.info(`扫描到可供选择的文件夹：${uniqueDirs.join(' | ')}`);

    // 仅刷新模式检查
    if (settings.onlyRefresh) {
        settings.onlyRefresh = false;
        return false;
    }
    return true;
}

/**
 * 初始化设置和记录文件
 * 读取用户设置，初始化全局变量，加载目标物品和黑名单，创建或更新索引文件
 * 
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - settings: 用户设置对象
 * - groupCount: 路径组数量
 * - folderNames: 文件夹名称数组
 * - partyNames: 配队名称数组
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
async function initializeSetup() {
    /* ===== 读取新 settings ===== */
    groupCount = Math.min(99, Math.max(1, parseInt(settings.groupCount || '3')));
    folderNames = [];
    partyNames = [];
    for (let g = 1; g <= groupCount; g++) {
        folderNames.push(settings[`pathGroup${g}FolderName`] || '');
        partyNames.push(settings[`pathGroup${g}PartyName`] || '');
    }

    // 获取子文件夹路径
    subFolderName = accountName;
    subFolderPath = `${recordFolder}/${subFolderName}`;
    pickupRecordFile = `${recordFolder}/${subFolderName}/拾取记录.json`;

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

    if (operationMode === "重新生成索引文件（用于强制刷新CD）") {
        log.info("重新生成索引文件模式，将覆盖现有索引文件");
    }
    if (!indexDoExist) {
        log.info("文件不存在，将尝试生成索引文件");
    }

    /* 禁用BGI原生拾取，强制模板匹配 */
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

    await loadBlacklist(true);
    state.running = true;

    await fakeLog("采集cd管理", true, false, 1000);

    // 统一的 record.json 文件路径
    recordFilePath = `${subFolderPath}/record.json`;

    // 读取 pathing 文件夹下的所有 .json 文件
    const pathingFolder = "pathing";
    const files = await readFolder(pathingFolder, true);
    const filePaths = files.map(file => file.fullPath);

    // ① 先加载已有记录（整对象）
    let recordArray = [];
    if (indexDoExist && useJson) {
        try { recordArray = JSON.parse(await file.readText(recordFilePath)); } catch (e) { }
    } else if (indexDoExist && !useJson) {
        try {
            const txt = await file.readText(`${subFolderPath}/record.txt`);
            txt.trim().split('\n').forEach(line => {
                const [n, t] = line.trim().split('::');
                if (n && t) recordArray.push({ fileName: n + '.json', cdTime: t });
            });
        } catch (e) { }
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
        const newCd = (indexDoExist &&
            operationMode !== "重新生成索引文件（用于强制刷新CD）" &&
            old.cdTime)
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
    } else {
        log.error(`写入文件失败: ${recordFilePath}`);
    }

    // 初始化食材加工列表
    try {
        Foods = Array.from(processingIngredient);
    } catch (e) { Foods = []; }

    // 加载材料CD映射表
    try {
        const cdMapText = await file.readText('assets/materialCdMap.json');
        const cdMapObj = JSON.parse(cdMapText);
        materialCdMap = { ...cdMapObj['46h特产'], ...cdMapObj['12h素材'], ...cdMapObj['4点刷新'], ...cdMapObj['0点刷新'] };
        log.info(`材料CD映射表加载完成，共 ${Object.keys(materialCdMap).length} 条记录`);
    } catch (e) {
        log.error(`加载材料CD映射表失败: ${e.message}`);
        materialCdMap = {};
    }
}

/**
 * 处理优先级材料采集
 * 解析用户设置的优先采集材料，计算路线效率，循环执行最高效率路线直到达标
 * 
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - settings: 用户设置对象
 * - pickupRecordFile: 拾取记录文件路径
 * - alias2Names: 别名到本名数组的映射
 * - name2Other: 本名到别名数组的映射
 * - subFolderName: 子文件夹名称
 * - lastMapName: 上次地图名称
 * - targetItems: 目标物品数组
 * - disableArray: 禁用关键词数组
 * - materialCdMap: 材料CD映射表
 * 
 * @依赖辅助函数：
 * - readFolder: 读取文件夹函数
 * - isTimeRestricted: 判断时间是否受限函数
 * - calculateRouteEfficiency: 计算路线效率函数
 * - calculateDefaultEfficiency: 计算默认效率函数
 * - selectPartyByRoutePath: 根据路线路径选择配队函数
 * - handleIngredientProcessing: 处理食材加工函数
 * - handleTimeAdjustment: 处理时间调整函数
 * - fakeLog: 模拟日志函数
 * - prioritizeHistoricalItems: 历史拾取物优先排序函数
 * - executeRoute: 执行路线函数
 * - saveRecordAndClearLog: 保存记录并清空日志函数
 * - basename: 获取文件基本名函数
 */
async function processPriorityItems() {
    if (settings.priorityItems) {
        /* ---------- 1. 解析 ---------- */
        const priorityList = [];
        const segments = settings.priorityItems.split('+').map(s => s.trim());
        for (const seg of segments) {
            const [itemName, countStr] = seg.split('*').map(s => s.trim());
            if (itemName && countStr && !isNaN(Number(countStr))) {
                priorityList.push({ itemName, count: Number(countStr) });
            }
        }
        log.info(`优先级材料解析完成: ${priorityList.map(e => `${e.itemName}*${e.count}`).join(', ')}`);
        /* ===== 追加：扣除今日已拾取（UTC+8 0 点分界） ===== */
        const utc8 = new Date(Date.now() + 8 * 3600_000);   // 手动+8小时
        const today = utc8.toISOString().slice(0, 10);      // "YYYY-MM-DD"
        let todayPicked = {};                                // 今日已拾取数量
        try {
            const txt = await file.readText(pickupRecordFile);
            if (txt) {
                const arr = JSON.parse(txt);
                const todayItem = arr.find(it => it.date === today);
                if (todayItem) todayPicked = todayItem.items || {};
            }
        } catch (_) { /* 文件不存在或解析失败 */ }

        /* 扣除今日已拾取：双向扣除 */
        for (let i = priorityList.length - 1; i >= 0; i--) {
            const task = priorityList[i];
            let got = 0;

            /* 1. 字面名（可能是别名）直接扣 */
            got += todayPicked[task.itemName] || 0;
            /* 2. 如果字面名是别名，把对应本名也扣一遍 */
            const realNames = alias2Names.get(task.itemName) || [];   // 现在是数组

            for (const n of realNames) got += todayPicked[n] || 0;

            /* 3. 如果字面名是本名，把所有别名再扣一遍 */
            const others = name2Other.get(task.itemName) || [];
            for (const a of others) got += todayPicked[a] || 0;

            task.count -= got;
            if (task.count <= 0) priorityList.splice(i, 1);
        }

        if (priorityList.length === 0) {
            log.info("今日优先材料已达标，跳过优先采集阶段");
            notification.send("今日优先材料已达标，跳过优先采集阶段");
        }
        /* ================================= */

        const runOnce = [];
        /* ---------- 3. 主循环 ---------- */
        while (priorityList.length > 0) {

            /* 1. 先把用户填的字面名（可能是别名）全部弄进来 */
            const priorityItemSet = new Set(priorityList.map(p => p.itemName));

            /* 2. 双向扩：本名↔别名 */
            for (const a of [...priorityItemSet]) {          // 复制一份避免遍历过程中增长
                // 2.1 如果 a 是“本名”，把它的所有别名加进来（原来就有的逻辑）
                const others = name2Other.get(a) || [];
                for (const o of others) priorityItemSet.add(o);

                // 2.2 如果 a 是“别名”，把对应的本名加进来（新增反向）
                const realName = alias2Names.get(a) || [];
                for (const r of realName) priorityItemSet.add(r);
            }

            const pickedCounter = {};
            priorityItemSet.forEach(n => pickedCounter[n] = 0);
            /* ===== 剩余物品 ===== */
            let remaining = priorityList.map(t => `${t.itemName}*${t.count}`).join(', ');
            /* 4-1 扫描 + 读 record + 前置过滤（禁用/时间/材料相关）+ 计算效率 + CD后置排除 */
            const allFiles = await readFolder('pathing', true);
            const rawRecord = await file.readText(`record/${subFolderName}/record.json`);
            let recordArray = [];
            try { recordArray = JSON.parse(rawRecord); } catch { /* 空记录 */ }
            const cdMap = new Map(recordArray.map(it => [it.fileName, it]));
            const now = new Date();
            /* 时间管制 */
            if (await isTimeRestricted(settings.timeRule, 10)) { priorityList.length = 0; break; }

            /* ---- 先算效率（不判CD）---- */
            calculateRouteEfficiency(allFiles, cdMap, {
                priorityItemSet,
                disableArray,
                isPriorityMode: true
            });

            /* ---- 用可运行路线算分位默认值 ---- */
            const knownEff = allFiles
                .filter(f => {
                    const rec = cdMap.get(f.fileName);
                    const nextCD = rec ? new Date(rec.cdTime) : new Date(0);
                    return f._priorityEff >= 0 && now > nextCD;
                })
                .map(f => f._priorityEff)
                .sort((a, b) => a - b);
            const defaultEff = calculateDefaultEfficiency(knownEff, settings.defaultEffPercentile, 1);
            /* 回填未知 + 排除CD */
            allFiles.forEach(f => {
                if (f._priorityEff === -2) f._priorityEff = defaultEff;
                const rec = cdMap.get(f.fileName);
                const nextCD = rec ? new Date(rec.cdTime) : new Date(0);
                if (now <= nextCD) f._priorityEff = -1;
            });

            if (priorityList.length === 0) break;

            /* 4-2 只跑最高效率路线 */
            const candidateRoutes = allFiles
                .filter(f => {
                    return f._priorityEff >= 0 &&
                        !runOnce.includes(f.fileName);     // 本轮没跑过
                })
                .sort((a, b) => b._priorityEff - a._priorityEff);
            if (candidateRoutes.length === 0 && priorityList.length > 0) {
                log.info('已无可用优先路线（可能全部在CD），退出优先采集阶段');
                notification.send('已无可用优先路线（可能全部在CD），退出优先采集阶段');
                break;
            }
            const bestRoute = candidateRoutes[0];
            const filePath = bestRoute.fullPath;
            const fileName = basename(filePath).replace('.json', '');
            const fullName = fileName + '.json';
            const targetObj = cdMap.get(fullName);
            const startTime = new Date();

            /* ---------- 智能选队：按路线所在文件夹反查路径组 ---------- */
            await selectPartyByRoutePath(bestRoute.fullPath, "优先采集阶段");

            log.info(`当前进度：执行路线 ${fileName}，剩余优先材料：${remaining}`);

            let timeNow = new Date();
            await handleIngredientProcessing(timeNow);

            await handleTimeAdjustment(timeNow);
            await fakeLog(fileName, false, true, 0);
            runOnce.push(fullName);

            /* ========== 历史拾取物前置排序 ========== */
            targetItems = prioritizeHistoricalItems(targetItems, cdMap, fullName);
            /* ================================= */

            /* ================================= */
            const routeResult = await executeRoute(filePath, fileName, targetObj, startTime, lastMapName, priorityItemSet);
            if (!routeResult.success) {
                continue;
            }
            lastMapName = routeResult.lastMapName;
            routeResult.runPickupLog.forEach(name => {
                /* 就地展开：别名→本名数组，再把所有相关名称都计数 */
                const realNames = alias2Names.get(name) || [name]; // 可能是多个本名
                for (const rn of realNames) {
                    if (priorityItemSet.has(name) || priorityItemSet.has(rn)) {
                        pickedCounter[rn] = (pickedCounter[rn] || 0) + 1;
                    }
                }
            });

            /* ===== 追加：立即把 pickedCounter 回写到 priorityList（双向扣减）===== */
            for (const task of priorityList) {
                let picked = 0;

                /* 1. 字面名（可能是别名）直接扣 */
                picked += pickedCounter[task.itemName] || 0;

                /* 2. 别名→本名反向扣（多对一） */
                const realNames = alias2Names.get(task.itemName) || [];
                for (const rn of realNames) picked += pickedCounter[rn] || 0;

                /* 3. 本名→别名顺向扣 */
                const others = name2Other.get(task.itemName) || [];
                for (const a of others) picked += pickedCounter[a] || 0;

                task.count = Math.max(0, task.count - picked);
            }

            /* 倒序删除已达标项 */
            for (let i = priorityList.length - 1; i >= 0; i--) {
                if (priorityList[i].count <= 0) {
                    log.info(`优先材料已达标: ${priorityList[i].itemName}`);
                    priorityList.splice(i, 1);
                }
            }

            /* ================================================ */

            /* ---------- 3. 统一写文件 & 清空日志 ---------- */
            await saveRecordAndClearLog(cdMap, recordFilePath, routeResult.runPickupLog);
            if (priorityList.length <= 0) {
                log.info('每日优先材料已达标，退出优先采集阶段');
                notification.send('每日优先材料已达标，退出优先采集阶段');
            }
        }
        await sleep(1000);
    }
}

/**
 * 处理路径组循环执行
 * 按照用户设置的路径组配置，依次执行各路径组中的路线，支持多种排序模式和CD管理
 * 
 * @returns {Promise<void>} 无返回值
 * 
 * @依赖全局变量：
 * - settings: 用户设置对象
 * - groupCount: 路径组数量
 * - folderNames: 文件夹名称数组
 * - partyNames: 配队名称数组
 * - recordFilePath: 记录文件路径
 * - operationMode: 操作模式
 * - lastMapName: 上次地图名称
 * - disableArray: 禁用关键词数组
 * 
 * @依赖辅助函数：
 * - isTimeRestricted: 判断时间是否受限函数
 * - readFolder: 读取文件夹函数
 * - calculateRouteEfficiency: 计算路线效率函数
 * - basename: 获取文件基本名函数
 * - handleIngredientProcessing: 处理食材加工函数
 * - handleTimeAdjustment: 处理时间调整函数
 * - switchPartyIfNeeded: 按需切换配队函数
 * - fakeLog: 模拟日志函数
 * - executeRoute: 执行路线函数
 * - isArrivedAtEndPoint: 判断是否到达终点函数
 * - calculateRouteCD: 计算路线CD函数
 * - saveRecordAndClearLog: 保存记录并清空日志函数
 */
async function processPathGroups() {
    let loopattempts = 0;
    while (loopattempts < 2) {
        loopattempts++;
        if (await isTimeRestricted(settings.timeRule, 10)) break;
        for (let i = 1; i <= groupCount; i++) {
            if (await isTimeRestricted(settings.timeRule, 10)) break;
            const currentCdType = settings[`pathGroup${i}CdType`] || "";
            if (!currentCdType) continue;

            const folder = folderNames[i - 1] || `路径组${i}`;
            const targetFolder = `pathing/${folder} `;

            log.info(`开始执行路径组${i} 文件夹：${folder}`);
            notification.send(`开始执行路径组${i} 文件夹：${folder}`);

            /* 运行期同样用 Map<fileName, 原对象> 只改 cdTime */
            const rawRecord = await file.readText(recordFilePath);
            let recordArray = JSON.parse(rawRecord);
            const cdMap = new Map(recordArray.map(it => [it.fileName, it]));

            const groupFiles = await readFolder(targetFolder, true);

            if (operationMode === "执行任务（若不存在索引文件则自动创建）") {
                const groupNumber = i;
                await genshin.returnMainUi();

                try {
                    /* ================== 提前计算分均效率（所有模式通用） ================== */
                    calculateRouteEfficiency(groupFiles, cdMap, { groupIndex: i });
                    switch (settings.sortMode) {
                        case "优先最早刷新，将优先执行最早刷新的路线":
                            groupFiles.sort((a, b) => {
                                const nameA = basename(a.fullPath);
                                const nameB = basename(b.fullPath);
                                const timeA = cdMap.has(nameA) ? new Date(cdMap.get(nameA).cdTime) : new Date(0);
                                const timeB = cdMap.has(nameB) ? new Date(cdMap.get(nameB).cdTime) : new Date(0);
                                return timeA - timeB;   // 越早刷新越靠前
                            });
                            break;

                        case "优先最高效率，将优先执行最高分均拾取物的路线":
                            // 直接复用提前算好的 _efficiency
                            groupFiles.sort((a, b) => (b._efficiency || 0) - (a._efficiency || 0));
                            break;

                        default:
                            // 保持原有顺序，不做任何排序
                            break;
                    }

                    for (const filePath of groupFiles) {
                        const fileName = basename(filePath.fullPath).replace('.json', '');
                        const fullName = fileName + '.json';
                        const targetObj = cdMap.get(fullName);
                        const nextCD = targetObj ? new Date(targetObj.cdTime) : new Date(0);

                        const startTime = new Date();
                        if (startTime <= nextCD) {
                            log.info(`当前任务 ${fileName} 未刷新，跳过任务`);
                            continue;   // 跳过，不写回
                        }
                        if (await isTimeRestricted(settings.timeRule, 10)) break;

                        let doSkip = false;
                        for (const kw of disableArray) {
                            if (filePath.fullPath.includes(kw)) {
                                log.info(`路径文件 ${filePath.fullPath} 包含禁用关键词 "${kw}"，跳过任务 ${fileName}`);
                                doSkip = true; break;
                            }
                        }
                        if (doSkip) continue;

                        // ===== 临界效率过滤 =====
                        const routeEff = filePath._efficiency ?? 0;          // 提前算好的分均效率
                        const threshold = Number(settings[`pathGroup${i}thresholdEfficiency`]) || 0;
                        if (routeEff < threshold) {
                            log.info(`路线 ${fileName} 分均效率为 ${routeEff.toFixed(2)}，低于设定的临界值 ${threshold}，跳过`);
                            continue;
                        }

                        let timeNow = new Date();
                        await handleIngredientProcessing(timeNow);

                        await handleTimeAdjustment(timeNow);

                        await switchPartyIfNeeded(partyNames[groupNumber - 1]);

                        await fakeLog(fileName, false, true, 0);

                        /* ========== 历史拾取物前置排序 ========== */
                        targetItems = prioritizeHistoricalItems(targetItems, cdMap, fullName);
                        /* ======================================= */

                        log.info(`当前进度：执行路线 ${fileName}，路径组${i} ${folder} 第 ${groupFiles.indexOf(filePath) + 1}/${groupFiles.length} 个`);
                        log.info(`当前路线分均效率为 ${(filePath._efficiency ?? 0).toFixed(2)}`);

                        state.runPickupLog = [];          // 新路线开始前清空
                        // 路径组模式下，传入空的 priorityItemSet
                        const routeResult = await executeRoute(filePath.fullPath, fileName, targetObj, startTime, lastMapName, new Set());
                        if (!routeResult.success) {
                            continue;
                        }
                        lastMapName = routeResult.lastMapName;

                        try { await sleep(1); }
                        catch (error) { log.error(`发生错误: ${error}`); break; }

                        // >>> 仅当 >10s 才记录 history；若同时 pathRes === true 再更新 CD <<<
                        const endTime = new Date();
                        const timeDiff = endTime.getTime() - startTime.getTime();
                        if (timeDiff > 10000) {
                            /* ---------- 2. 仅当 pathRes === true 才计算并更新 CD ---------- */
                            let pathRes = isArrivedAtEndPoint(filePath.fullPath);
                            if (pathRes) {
                                const newTimestamp = calculateRouteCD(currentCdType, startTime);
                                targetObj.cdTime = newTimestamp.toISOString();
                                log.info(`本任务cd信息已更新，下一次可用时间为 ${newTimestamp.toLocaleString()}`);
                            }

                            /* ---------- 3. 统一写文件 & 清空日志 ---------- */
                            await saveRecordAndClearLog(cdMap, recordFilePath, routeResult.runPickupLog);
                        }
                    }
                    log.info(`路径组${groupNumber} 的所有任务运行完成`);
                } catch (error) {
                    log.error(`读取路径组文件时出错: ${error}`);
                }
            }
        }
        await sleep(1000);
    }
}
