const folderA = 'assets/狗粮A线@Yang-z/';
const folderB = 'assets/狗粮B线@Yang-z/';
const folderE = 'assets/狗粮额外@Yang-z/';

const pathingA = [
    "狗粮-蒙德-龙脊雪山-西-3个-f.json",
    "狗粮-璃月-碧水源-盐中之地-3个-f.json",
    "狗粮-璃月-珉林-东北-9个-f.json",
    "狗粮-璃月-珉林-北-5个.json",
    "狗粮-璃月-珉林-奥藏山南-2个／3个-f.json",
    "狗粮-璃月-珉林-绝云间-3个-m.json",
    "（恢复）狗粮-璃月-琼玑野.json",
    "狗粮-璃月-琼玑野-绿华池-3个-f.json",
    "狗粮-须弥-须弥城-4个.json",
    "狗粮-须弥-二净甸-七天神像-4个／8个.json",
    "狗粮-须弥-二净甸-觉王之殿南-6个／7个-f.json",
    "（恢复）狗粮-须弥-失落的苗圃.json",
    "狗粮-须弥-失落的苗圃-南-8个-f.json",
    "狗粮-纳塔-万火之瓯-竞技场东-2个／4个-f.json",
    "狗粮-纳塔-涌流地-流泉之众-4个.json",
    "（恢复）狗粮-纳塔-涌流地.json",
    "狗粮-纳塔-镜璧山-南-9个-f.json",
    "狗粮-纳塔-镜璧山-七天神像下-3个-f.json",
    "狗粮-纳塔-翘枝崖-北-6个-f.json",
    "狗粮-纳塔-奥奇卡纳塔-七天神像-14个.json",
    "狗粮-纳塔-奥奇卡纳塔-流灰之街-4个-f.json",
    "狗粮-纳塔-奥奇卡纳塔-托佐兹之岛-6个-f.json",
    "（恢复）狗粮-稻妻-神无冢.json",
    "【收尾】狗粮-稻妻-神无冢-踏鞴砂①-6个／21个-f.json",
    "【收尾】狗粮-稻妻-神无冢-踏鞴砂②-7个／21个-f.json",
    "【收尾】狗粮-稻妻-神无冢-踏鞴砂③-8个／21个-f.json"
];

const pathingB = [
    "狗粮-枫丹-枫丹庭区-3个.json",
    "狗粮-枫丹-白露区-秋分山东侧-2个-f~m.json",
    "狗粮-枫丹-伊黎耶林区-欧庇克莱歌剧院东南-2个-f.json",
    "（恢复）狗粮-枫丹-研究院区.json",
    "狗粮-枫丹-研究院区-学术会堂-1个／2个-f.json",
    "狗粮-枫丹-研究院区-中央实验室遗址-北侧屋内-4个.json",
    "狗粮-枫丹-研究院区-新枫丹科学院-东南侧-8个-f.json",
    "狗粮-枫丹-研究院区-西南偏南-6个-m-f.json",
    "狗粮-枫丹-研究院区-西南偏西-4个-f.json",
    "狗粮-枫丹-研究院区-西北-6个／7个.json",
    "狗粮-枫丹-研究院区-中部塔内-9个.json",
    "（恢复）狗粮-枫丹-黎翡区.json",
    "狗粮-枫丹-黎翡区-七天神像-3个／5个.json",
    "狗粮-枫丹-黎翡区-芒索斯山东-3个-f.json",
    "狗粮-稻妻-神无冢-堇色之庭-4个.json",
    "狗粮-稻妻-神无冢-九条阵屋-2个／3个-f.json",
    "狗粮-稻妻-神无冢-东-5个／6个-f.json",
    "（恢复）狗粮-稻妻-神无冢.json",
    "狗粮-稻妻-海祇岛-东方小岛-2个-f.json",
    "狗粮-稻妻-海祇岛-珊瑚宫东北-6个-f.json",
    "狗粮-稻妻-海祇岛-望泷村西南-4个-f.json",
    "狗粮-稻妻-清籁岛-浅濑神社-3个-f.json",
    "狗粮-稻妻-清籁岛-越石村-8个-f.json",
    "狗粮-稻妻-清籁岛-平海砦西-8个-f.json",
    "狗粮-稻妻-鹤观-东偏中-2个-f.json",
    "狗粮-稻妻-鹤观-南-2个-f.json",
    "（恢复）狗粮-稻妻-清籁岛.json",
    "【收尾】狗粮-稻妻-清籁岛-清籁丸-20个-f.json"
];

const pathingE = [
    "【额外】狗粮-纳塔-鸡屁股+8个／9个-f.json",
];

const pathingE_A = [
    "【额外】狗粮-须弥-水天丛林+7个-f.json",
    "【额外】狗粮-枫丹-研究院区-新枫丹科学院周边+3个-f.json",
];

const pathingE_B = [
    "【额外】狗粮-纳塔-灵谜纹+13个.json"
];

// 读取用户设置
let path = settings.path != undefined ? settings.path : '';
let swapPath = settings.swapPath != undefined && settings.swapPath != '否' ? true : false;
let extra = settings.extra != undefined && settings.extra != '是' ? false : true;
let extraAB = settings.extraAB != undefined && settings.extraAB != '是' ? false : true;
let autoSalvage = settings.autoSalvage != undefined && settings.autoSalvage != '是' ? false : true;
let autoSalvageSpan = settings.autoSalvageSpan != undefined && ~~settings.autoSalvageSpan > 0 ? ~~settings.autoSalvageSpan : 10;
let activeRestore = settings.activeRestore != undefined && settings.activeRestore != '是' ? false : true;
const activeProgress = settings.activeProgress != undefined && settings.activeProgress != '否' ? true : false;
const notify = settings.notify || false;

// 分解记录变量
let totalSalvageExp = 0; // 累计EXP（不含首次分解）
const salvageRecords = [];
const salvageLogFile = "狗粮分解日志.txt";
let pendingPaths = []; // 仅包含已执行的路径
let count = 0; // 计数已执行的非恢复路径

// 确定路径
function determinePath() {
    if (path != 'A' && path != 'B') {
        const benchmark = new Date("2024-11-20T04:00:00");
        const now = new Date();
        const delta = now - benchmark;
        const days = delta / (1000 * 60 * 60 * 24);
        path = days % 2 < 1 ? 'A' : 'B';
        if (swapPath) path = path == 'A' ? 'B' : 'A';
    }
    if (progress.path !== path) {
        progress.completedTasks = [];
        progress.path = path;
        saveProgress();
    }
}

// 初始化函数
async function init(shouldRestore = true, shouldResizeMap = false) {
    dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
    if (shouldRestore) {
        await genshin.tp("4747.68505859375", "2632.9970703125");
        await sleep(3000);
    }
    if (shouldResizeMap) {
        await resizeMap();
    }
}

// 调整地图
async function resizeMap(level = 1) {
    await genshin.returnMainUi();
    keyPress("M"); await sleep(1000);
    for (let i = 5; i > 0; --i) {
        click(46, 436); await sleep(500);
    }
    for (let i = 0; i < level; ++i) {
        click(46, 630); await sleep(500);
    }
}

// 拖拽地图
async function dragMap(byX, byY) {
    await genshin.returnMainUi();
    let byL = Math.sqrt(byX * byX + byY * byY);
    let d = 5;
    let dx = Math.round(d * byX / byL);
    let dy = Math.round(d * byY / byL);
    let times = Math.round(byX / dx * genshin.screenDpiScale);
    log.debug(`byL: ${byL}; dx: ${dx}; dy: ${dy}; times: ${times};`);
    keyPress("M"); await sleep(1000);
    moveMouseBy(-byX, -byY); await sleep(300);
    leftButtonDown(); await sleep(300);
    for (let i = 0; i < times; ++i) {
        moveMouseBy(dx, dy); await sleep(30);
    }
    leftButtonUp(); await sleep(300);
}

// 就近传送
async function tpNearby(filePath) {
    const raw = file.ReadTextSync(filePath);
    const data = JSON.parse(raw);
    await genshin.tp(data['positions'][0]['x'], data['positions'][0]['y']);
}

// OCR圣遗物分解配置
const AUTO_SALVAGE_CONFIG = {
    autoSalvage3: settings.autoSalvage3 || "否",
    autoSalvage4: settings.autoSalvage4 || "否"
};
const OCR_REGIONS = {
    expStorage: { x: 1472, y: 883, width: 170, height: 34 },
    expCount: { x: 1472, y: 895, width: 170, height: 34 }
};

const numberReplaceMap = {
    "O": "0", "o": "0", "Q": "0", "０": "0",
    "I": "1", "l": "1", "i": "1", "１": "1", "一": "1",
    "Z": "2", "z": "2", "２": "2", "二": "2",
    "E": "3", "e": "3", "３": "3", "三": "3",
    "A": "4", "a": "4", "４": "4",
    "S": "5", "s": "5", "５": "5",
    "G": "6", "b": "6", "６": "6",
    "T": "7", "t": "7", "７": "7",
    "B": "8", "θ": "8", "８": "8",
    "g": "9", "q": "9", "９": "9",
};

function processExpText(text) {
    let correctedText = text || "";
    let removedSymbols = [];
    for (const [wrong, correct] of Object.entries(numberReplaceMap)) {
        correctedText = correctedText.replace(new RegExp(wrong, 'g'), correct);
    }
    let finalText = '';
    for (const char of correctedText) {
        if (/[0-9]/.test(char)) finalText += char;
        else if (char.trim() !== '') removedSymbols.push(char);
    }
    return { processedText: finalText, removedSymbols: [...new Set(removedSymbols)] };
}

async function recognizeExpRegion(regionName, ra = null, timeout = 2000) {
    const ocrRegion = OCR_REGIONS[regionName];
    if (!ocrRegion) {
        log.error(`[狗粮OCR] 无效区域：${regionName}`);
        return { success: false, expCount: 0 };
    }
    log.info(`[狗粮OCR] 识别${regionName}（x=${ocrRegion.x}, y=${ocrRegion.y}）`);
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const ocrResult = ra.find(RecognitionObject.ocr(
                ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height
            ));
            log.info(`[狗粮OCR] 原始文本：${ocrResult.text}`);
            if (ocrResult?.text) {
                const { processedText } = processExpText(ocrResult.text);
                const expCount = processedText ? parseInt(processedText, 10) : 0;
                log.info(`[狗粮OCR] ${regionName}结果：${expCount}`);
                return { success: true, expCount };
            }
        } catch (error) {
            log.warn(`[狗粮OCR] 识别失败：${error.message}`);
        }
        await sleep(500);
    }
    log.error(`[狗粮OCR] ${regionName}超时未识别`);
    return { success: false, expCount: 0 };
}

// 分解函数
async function executeSalvageWithOCR(pathGroup, isPreRun = false) {
    if (!autoSalvage) {
        log.info("[狗粮分解] 未开启自动分解，跳过");
        return { success: false, totalExp: 0 };
    }
    
    const runType = isPreRun ? "首次（路径前）" : "常规";
    const actualPathGroup = isPreRun ? [] : pathGroup;
    log.info(`[狗粮分解] 开始${runType}分解（关联路径组：共${actualPathGroup.length}个，均为已执行路径）`);

    let storageExp = 0;
    let countExp = 0;
    let cachedFrame = null;

    try {
        await genshin.returnMainUi();
        keyPress("B"); await sleep(1000);
        const coords = [
            [670, 40],                  // 打开背包
            [660, 1010],    // 打开分解
            [300, 1020],    // 分解选项页面
            [200, 300, 500, AUTO_SALVAGE_CONFIG.autoSalvage3 !== '是'], // 3星配置
            [200, 380, 500, AUTO_SALVAGE_CONFIG.autoSalvage4 !== '是'], // 4星配置
            [340, 1000],    // 确认选择
            [1720, 1015],   // 分解按钮
            [1320, 756],     // 确认分解
            [1840, 45, 1500],     // 退出
            [1840, 45],     // 退出
            [1840, 45],     // 退出
        ];

        for (const coord of coords) {
            const [x, y, delay = 1000, condition = true] = coord;
            if (condition) {
                click(x, y);
                await sleep(delay);
                if (x === 660 && y === 1010) {
                    cachedFrame?.dispose();
                    cachedFrame = captureGameRegion();
                    const { expCount } = await recognizeExpRegion("expStorage", cachedFrame, 1000);
                    storageExp = expCount;
                }
                if (x === 340 && y === 1000) {
                    cachedFrame?.dispose();
                    cachedFrame = captureGameRegion();
                    const { expCount } = await recognizeExpRegion("expCount", cachedFrame, 1000);
                    countExp = expCount;
                }
            }
        }

        const totalExp = countExp - storageExp;
        const actualExp = Math.max(totalExp, 0);
        log.info(`[狗粮分解] ${runType}分解完成，获得EXP：${actualExp}`);

        // 记录逻辑
        const recordTime = new Date().toLocaleString();
        const pathGroupStr = actualPathGroup.map((p, i) => `${i+1}. ${p}`).join('\n  ');
        const record = { time: recordTime, pathGroup: actualPathGroup, exp: actualExp, type: runType };
        salvageRecords.push(record);
        
        if (!isPreRun) {
            totalSalvageExp += actualExp;
        }

        // 日志与通知
        const logContent = `[${recordTime}] ${runType}分解 - 关联路径组（共${actualPathGroup.length}个）：\n  ${pathGroupStr}\n本次分解EXP：${actualExp}${!isPreRun ? `\n累计分解EXP：${totalSalvageExp}` : ''}`;
        await writeFile(salvageLogFile, logContent, true);
        
        if (notify) {
            notification.send(`${runType}分解完成！\n关联已执行路径：${actualPathGroup.length}个\n本次EXP：${actualExp}${!isPreRun ? `\n累计EXP：${totalSalvageExp}` : ''}`);
        }

        return { success: true, totalExp: actualExp };
    } catch (error) {
        log.error(`[狗粮分解] ${runType}分解失败：${error.message}`);
        return { success: false, totalExp: 0 };
    } finally {
        cachedFrame?.dispose();
        await genshin.returnMainUi();
    }
}

// 进度管理
const progressFile = "progress.json";
let progress = { path: null, completedTasks: [], lastRunDate: null };

function getLocalDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function loadProgress() {
    try {
        const content = await file.readText(progressFile);
        const loadedProgress = JSON.parse(content);
        const today = getLocalDate();
        if (loadedProgress.lastRunDate === today) {
            progress.path = loadedProgress.path;
            progress.completedTasks = Array.isArray(loadedProgress.completedTasks) ? loadedProgress.completedTasks : [];
        } else {
            progress.path = null;
            progress.completedTasks = [];
        }
        progress.lastRunDate = today;
        log.info(`加载进度成功: ${JSON.stringify(progress)}`);
    } catch (error) {
        log.error("加载进度失败:", error);
    }
}

async function saveProgress() {
    try {
        progress.lastRunDate = getLocalDate();
        await file.writeText(progressFile, JSON.stringify(progress));
        log.info(`进度已保存，当前日期: ${progress.lastRunDate}`);
    } catch (error) {
        log.error("保存进度失败:", error);
    }
}

// 核心执行函数（关键修正：先执行路径，再加入分解组并判断）
async function runFile(filePath, times = 2) {
    try {
        if (progress.completedTasks.includes(filePath)) {
            log.info(`任务已跳过: ${filePath}`);
            return;
        }

        const startTime = Date.now();
        log.info(`开始执行任务: ${filePath}`);

        let isToRestore = filePath.search("（恢复）") != -1;
        if (isToRestore && !activeRestore) {
            log.info(`跳过恢复任务: ${filePath}`);
            return;
        }

        // 步骤1：先执行路径（确保路径已完成）
        let forceInteraction = filePath.search("-f") != -1;
        if (!isToRestore) dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": forceInteraction }));
        
        await pathingScript.runFile(filePath); // 执行路径
        await sleep(1000);
        dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));

        // 步骤2：路径执行完成后，再加入待分解组
        if (!isToRestore) {
            pendingPaths.push(filePath);
            log.debug(`路径已执行完成，加入待分解组：${filePath}，当前组含${pendingPaths.length}个已执行路径`);
        }

        // 步骤3：判断是否触发分解（仅针对已执行的路径）
        if (!isToRestore && ++count % autoSalvageSpan == 0) {
            log.debug(`已执行${count}个路径，达到分解间隔（${autoSalvageSpan}个），触发常规分解`);
            await executeSalvageWithOCR([...pendingPaths], false);
            pendingPaths = []; // 清空组，准备收集下一批已执行路径
        }

        // 保存进度
        const endTime = Date.now();
        if (endTime - startTime < 5000) {
            log.info(`任务时长过短，不保存进度: ${filePath}`);
            return;
        }

        progress.completedTasks.push(filePath);
        await saveProgress();
        log.info(`任务完成并保存进度: ${filePath}`);

        if (filePath.search("~m") != -1) {
            await dragMap(-50, 50);
            await tpNearby(filePath);
        }

    } catch (error) {
        log.error(`任务执行失败: ${filePath}`, error);
        await sleep(3000);
        if (times > 0) {
            log.info(`重试任务: ${filePath}`);
            await runFile(filePath, times - 1);
        } else {
            log.info(`任务不再重试: ${filePath}`);
        }
    }
}

// 批量执行
async function batch(folder, files) {
    for (let file of files) {
        await runFile(folder + file);
    }
}

// 文件写入函数
async function writeFile(filePath, content, isAppend = false, maxRecords = 36500) {
    try {
        if (isAppend) {
            let existingContent = "";
            try { existingContent = await file.readTextSync(filePath); } catch (err) {}
            const records = existingContent.split("\n\n").filter(Boolean);
            const allRecords = [content, ...records];
            const finalContent = allRecords.slice(0, maxRecords).join("\n\n");
            return file.WriteTextSync(filePath, finalContent, false);
        } else {
            return file.WriteTextSync(filePath, content, false);
        }
    } catch (error) {
        const result = file.WriteTextSync(filePath, content, false);
        log.info(result ? `[日志] 处理成功: ${filePath}` : `[日志] 处理失败: ${filePath}`);
        return result;
    }
}

// 主函数
(async function () {
    totalSalvageExp = 0;
    salvageRecords.length = 0;
    pendingPaths = [];
    count = 0;

    if (!activeProgress) {
        const result = await file.writeText(progressFile, JSON.stringify({}));
        log.info(result ? "进度文件已重置" : "进度文件重置失败");
    } else {
        await loadProgress();
    }

    determinePath();
    await init();

    // 路径前首次分解（无关联路径）
    if (autoSalvage) {
        log.info("路径前执行首次分解（不计入累计）");
        await executeSalvageWithOCR([], true);
    }

    // 执行主路径（按顺序执行，每个路径完成后加入分解组）
    log.info(`开始执行${progress.path}线路`);
    if (progress.path == 'A') {
        await batch(folderA, pathingA);
    } else {
        await batch(folderB, pathingB);
    }

    // 执行额外路径
    if (extra) {
        await init();
        log.info("开始执行额外线路");
        await batch(folderE, pathingE);
        if (path == 'A' || !extraAB) await batch(folderE, pathingE_A);
        if (path == 'B' || !extraAB) await batch(folderE, pathingE_B);
    }

    // 最终分解剩余已执行路径
    if (pendingPaths.length > 0 && autoSalvage) {
        log.info(`任务结束，分解剩余${pendingPaths.length}个已执行路径`);
        await executeSalvageWithOCR([...pendingPaths], false);
        pendingPaths = [];
    }

    await init();
    log.info(`今日狗粮任务完成，路线：${progress.path}${extra ? '+E' : ''}`);
    await sleep(1000);
    // 最终汇总
    const summaryTime = new Date().toLocaleString();
    const summaryContent = `[${summaryTime}] 今日分解总览：
总次数：${salvageRecords.length}次
有效累计EXP（不含首次分解）：${totalSalvageExp}
分解明细：
${salvageRecords.map((r, i) => `${i+1}. [${r.time}] ${r.type}分解：${r.exp} EXP`).join('\n')}`;
    
    await writeFile(salvageLogFile, `\n===== 今日汇总 =====\n${summaryContent}\n====================\n`, true);
    log.info("\n===== 今日分解汇总 =====");
    log.info(summaryContent);
    log.info("=======================");

    if (notify) {
        notification.send(`今日任务完成！\n总分解次数：${salvageRecords.length}次\n累计EXP（不含首次）：${totalSalvageExp}\n路线：${progress.path}${extra ? '+额外' : ''}`);
    }

})();
