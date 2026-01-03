// 初始化相关变量
let gameRegion;  // 游戏截图区域
const dialogZone = { x: { min: 900, max: 1700 }, y: { min: 450, max: 880 } };   // 对话识别区域
let record = {}; // record 记录内容
let recordsNum = 0; // 写入内容次数
let sticksTime = false; // 判定是否可以上香
//六龙蛋位置
const coordinates = [
    [565, 150],
    [568, 723],
    [1088, 161],
    [874, 335],
    [468, 574],
    [1339, 358]
];

// 通用方法区域
//切换队伍
async function switchPartyIfNeeded() {
    if (!settings.partyName) {
        await genshin.returnMainUi();
        return;
    };
    try {
        log.info("正在尝试切换至" + settings.partyName);
        if (!await genshin.switchParty(settings.partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(settings.partyName);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    };
};

// 文字识别/点击,并返回结果
async function performOcr(keyWords, xRange, yRange, judge, timeout = 500) {
    let startTime = new Date();
    let retryCount = 0;
    while (Date.now() - startTime < timeout) {
        gameRegion = captureGameRegion();
        try {
            if (judge) {
                // 识别相关区域内容，返回结果
                let ocrResult = gameRegion.find(RecognitionObject.ocr(
                    xRange.min, yRange.min,
                    xRange.max - xRange.min, yRange.max - yRange.min
                ));
                gameRegion.dispose();
                if (ocrResult) {
                    return { success: true, text: ocrResult.text};
                };
            } else {
                // 比对相关内容并点击
                let resList = gameRegion.findMulti(RecognitionObject.ocr(
                    xRange.min, yRange.min,
                    xRange.max - xRange.min, yRange.max - yRange.min    
                ));
                gameRegion.dispose();
                for (let res of resList) {
                    let correctedText = res.text;
                    if (correctedText.includes(keyWords)) {
                        let centerX = Math.round(res.x + res.width / 2);
                        let centerY = Math.round(res.y + res.height / 2);      
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(centerX, centerY);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        leftButtonClick();
                        return { success: true, text: correctedText};
                    };
                };
            };
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(50);
    };
    // log.warn(`经过多次尝试，仍然无法识别`);
    return { success: false};
};

// 图像识别/点击,并返回结果
async function findImgIcon(imagePath, xRange, yRange, judge, threshold = 0.8, timeout = 500) {
    let startTime = new Date();
    let retryCount = 0;
    let template = file.ReadImageMatSync(imagePath);
    let recognitionObject = RecognitionObject.TemplateMatch(template, xRange.min, yRange.min,
        xRange.max - xRange.min, yRange.max - yRange.min);
    recognitionObject.Threshold = threshold;
    // recognitionObject.Use3Channels = true;
    recognitionObject.InitTemplate();
    while (Date.now() - startTime < timeout) {
        gameRegion = captureGameRegion();
        let result = gameRegion.find(recognitionObject);
        gameRegion.dispose();
        try {
            if (judge) {
                if (result.isExist()) {
                    let centerX = Math.round(result.x + result.width / 2);
                    let centerY = Math.round(result.y + result.height / 2);      
                    keyDown("VK_MENU");
                    await sleep(500);
                    moveMouseTo(centerX, centerY);
                    leftButtonClick();
                    await sleep(800);
                    keyUp("VK_MENU");
                    await sleep(1000);
                    leftButtonClick();
                    return { success: true, coordinates:[centerX, centerY]};
                };
            } else {
                if (result.isExist()) {
                    return { success: true, coordinates:[0, 0]};
                };
            };
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`模板匹配失败，正在进行第 ${retryCount} 次重试...`);
        };
        await sleep(50);
    };
    // log.warn(`经过多次尝试，仍然无法识别`);
    return { success: false};
};

// 长对话点击
async function clickLongTalk() {
    // 识别是不是主界面
    let isMainUi = { success: false, coordinates:[0, 0]};
    do {
        leftButtonClick();
        isMainUi = await findImgIcon("assets/RecognitionObject/PaiMonMenu.png", { min: 15, max: 112 }, { min: 0, max: 84 }, false, 0.8, 500);
        // log.info(`你看嘛: ${isMainUi.success}`);
    } while (!isMainUi.success);    
};

// 滚动页面
// totalDistance: 需要滚动的总距离
// stepDistance: 每次滚动的距离
// delayMs: 两次滚动之间的延迟
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    // 移动鼠标到(999, 750)并按下左键
    moveMouseTo(999, 750);
    await sleep(50);
    leftButtonDown();

    // 估算需要滚动的步数
    const steps = Math.ceil(totalDistance / stepDistance);
    // 依次滚动
    for (let j = 0; j < steps; j++) {
        // 计算本次滚动剩余的距离
        const remainingDistance = totalDistance - j * stepDistance;
        // 如果剩余距离小于 stepDistance，则滚动剩余的距离
        // 否则滚动 stepDistance
        const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        // 滚动
        moveMouseBy(0, -moveDistance);
        // 等待 delayMs ms
        await sleep(delayMs);
    }
    // 等待700ms
    await sleep(700);
    // 释放左键
    leftButtonUp();
    // 等待100ms
    await sleep(100);
}

//fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看
async function fakeLog(name, isJs, isStart, duration) {
    await sleep(10);
    const currentTime = Date.now();
    // 参数检查
    if (typeof name !== 'string') {
        log.error("参数 'name' 必须是字符串类型！");
        return;
    };
    if (typeof isJs !== 'boolean') {
        log.error("参数 'isJs' 必须是布尔型！");
        return;
    };
    if (typeof isStart !== 'boolean') {
        log.error("参数 'isStart' 必须是布尔型！");
        return;
    };
    if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
        log.error("参数 'currentTime' 必须是整数！");
        return;
    };
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
        log.error("参数 'duration' 必须是整数！");
        return;
    };

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
    };
    if (isJs && !isStart) {
        // 处理 isJs = true 且 isStart = false 的情况
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    };
    if (!isJs && isStart) {
        // 处理 isJs = false 且 isStart = true 的情况
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    };
    if (!isJs && !isStart) {
        // 处理 isJs = false 且 isStart = false 的情况
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    };
};

// 读写信息
async function recordForFile(judge) {
    /* ---------- 文件名合法性校验 ---------- */
    const illegalCharacters = /[\\/:*?"<>|]/;
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    let accountName = settings.accountName || "默认账户";

    if (accountName === "" ||
        accountName.startsWith(" ") ||
        accountName.endsWith(" ") ||
        illegalCharacters.test(accountName) ||
        reservedNames.includes(accountName.toUpperCase()) ||
        accountName.length > 255
    ) {
        log.error(`账户名 "${accountName}" 不合法，将使用默认值`);
        accountName = "默认账户";
        await sleep(5000);
    } else {
        log.info(`账户名 "${accountName}" 合法`);
    };

    if (judge) {
        /* ---------- 读取记录文件 ---------- */
        const recordFolderPath = "records/";
        let recordFilePath = `records/${accountName}.txt`;

        const filesInSubFolder = file.ReadPathSync(recordFolderPath);
        let fileExists = false;
        for (const filePath of filesInSubFolder) {
            if (filePath === `records\\${accountName}.txt`) {
                fileExists = true;
                break;
            };
        };

        /* ---------- 初始化记录对象 ---------- */
        record = {
            lastRunDate: "1970/01/01",
            lastActivateTime: new Date("1970-01-01T20:00:00.000Z"),
            lastDragonEggsNum: "【山之血：0，飞澜鲨鲨：0，圣龙君临：0，太阳的轰鸣：0，献给小酒杯：0，菲耶蒂娜：0】",
            records: new Array(51).fill(""),
            version: ""
        };

        let recordIndex = 0;

        if (fileExists) {
            log.info(`记录文件 ${recordFilePath} 存在`);
        } else {
            log.warn(`无记录文件，将使用默认数据`);
            return;
        };

        let content = await file.readText(recordFilePath);
        let lines = content.split("\n");

        /* ---------- 逐行解析 ---------- */
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            /* 运行完成日期 */
            if (line.startsWith("上次运行日期:")) {
                record.lastRunDate = line.slice("上次运行日期:".length).trim();
            };

            /* 上次上香时间 */
            let timeStr = null;
            if (line.startsWith("上次上香时间:")) {
                timeStr = line.slice("上次上香时间:".length).trim();
            };
            if (timeStr) {
                const d = new Date(timeStr);
                if (!isNaN(d.getTime())) {
                    record.lastActivateTime = d;   // 保持 Date 对象
                };
            };

            /* 背包龙蛋数目 */
            if (line.startsWith("背包龙蛋数目:")) {
                record.lastDragonEggsNum = line.slice("背包龙蛋数目:".length).trim();
            };
            
            /* 相关信息保存 */
            if (line.startsWith(">>>>>>>>>> ") && recordIndex < record.records.length) {
                record.records[recordIndex++] = line;
            } else if (line.startsWith("抽签的结果: ") && recordIndex < record.records.length) {
                record.records[recordIndex++] = line;
            } else if (line.startsWith("获得的食物: ") && recordIndex < record.records.length) {
                record.records[recordIndex++] = line;
            } else if (line.startsWith("幸运签内容: ") && recordIndex < record.records.length) {
                record.records[recordIndex++] = line;
            } else if (line.startsWith("获得的龙蛋: ") && recordIndex < record.records.length) {
                record.records[recordIndex++] = line;
            } else if (line.startsWith("转盘的运势: ") && recordIndex < record.records.length)  {
                record.records[recordIndex++] = line;
            };

        };

        log.info(`上次运行日期: ${record.lastRunDate}`);
        log.info(`上次上香开始时间: ${record.lastActivateTime.toLocaleString()}`);

        /* ---------- 读取 manifest 版本 ---------- */
        try {
            const manifest = JSON.parse(await file.readText("manifest.json"));
            record.version = manifest.version;
            log.info(`当前版本为${record.version}`);
        } catch (err) {
            log.error("读取或解析 manifest.json 失败:", err);
        };

        /* ---------- 判断上香时间 ---------- */
        if (settings.sticks) {
            const now = Date.now();        // 当前毫秒时间戳
            const aimActivateTime = new Date(record.lastActivateTime.getTime() + 24 * 60 * 60 * 1000).getTime();
            /* ---------- 计算下次可上香时间 ---------- */
            if (aimActivateTime - now > 0) {
                log.info(`上香时间还未到！！！`);
                sticksTime = false;
            } else {
                log.info(`上香时间已到，请准备上香！`);
                sticksTime = true;
            };
        };
    } else {
        let recordFilePath = `records/${accountName}.txt`;
        let lines = [
            `上次运行日期: ${record.lastRunDate}`,
            `上次上香时间: ${record.lastActivateTime.toISOString()}`,
            `背包龙蛋数目: ${record.lastDragonEggsNum}`,
            ...record.records.filter(Boolean)
        ];

        let content = lines.join('\n');

        try {
            await file.writeText(recordFilePath, content, false);
            log.info(`记录已写入 ${recordFilePath}`);
        } catch (e) {
            log.error(`写入 ${recordFilePath} 失败:`, e);
        };
    };
};

// 检查背包龙蛋数目
async function chcekDragonEggs() {
    await genshin.returnMainUi();
    //打开背包    
    await keyPress("B");
    await checkExpire();
    await sleep(1500);
    await click(1250,50); 
    let DragonEggs = [0, 0, 0, 0, 0, 0];
    let judgeEgg = 0;
    // 判定是不是只有一页
    let sliderTop = await findImgIcon("assets/RecognitionObject/SliderTop.png", { min: 1277, max: 1300 }, { min: 120, max: 160 }, false);
    if (!sliderTop.success) {
        for (let index = 0; index < 6; index++) {
            let DragonEgg = await findImgIcon(`assets/RecognitionObject/DragonEgg${index}.png`, { min: 99, max: 1295 }, { min: 104, max: 967 }, true, 0.95);
            if (DragonEgg.success) {
                let ocrEggNum = await performOcr("", 
                    { min: DragonEgg.coordinates[0]-46, max: DragonEgg.coordinates[0]+34 }, { min: DragonEgg.coordinates[1]+56, max: DragonEgg.coordinates[1]+83 }, true);
                // log.info(`第一次识别到的数字：${ocrEggNum.text}`);
                if (ocrEggNum.text == "") {
                    await sleep(700);
                    ocrEggNum = await performOcr("", 
                        { min: DragonEgg.coordinates[0]-46, max: DragonEgg.coordinates[0]+34 }, { min: DragonEgg.coordinates[1]+56, max: DragonEgg.coordinates[1]+83 }, true);
                    // log.info(`第二次识别到的数字：${ocrEggNum.text}`);
                };
                DragonEggs[index] = Number(ocrEggNum.text);
            }else{
                DragonEggs[index] = 0;
            };

        };
    }else{
        for (let scroll = 0; scroll <= 10; scroll++) {
            for (let index = 0; index < 6; index++) {
                let DragonEgg = await findImgIcon(`assets/RecognitionObject/DragonEgg${index}.png`, { min: 99, max: 1295 }, { min: 104, max: 967 }, true, 0.95);
                if (DragonEgg.success) {
                    let ocrEggNum = await performOcr("", 
                        { min: DragonEgg.coordinates[0]-46, max: DragonEgg.coordinates[0]+34 }, { min: DragonEgg.coordinates[1]+56, max: DragonEgg.coordinates[1]+83 }, true);
                    // log.info(`第一次识别到的数字：${ocrEggNum.text}`);
                    if (ocrEggNum.text == "") {
                        await sleep(700);
                        ocrEggNum = await performOcr("", 
                            { min: DragonEgg.coordinates[0]-46, max: DragonEgg.coordinates[0]+34 }, { min: DragonEgg.coordinates[1]+56, max: DragonEgg.coordinates[1]+83 }, true);
                        // log.info(`第二次识别到的数字：${ocrEggNum.text}`);
                    };
                    if (ocrEggNum.text == "") {
                        ocrEggNum.text = 1;
                    };
                    DragonEggs[index] = ocrEggNum.text;
                }else{
                    DragonEggs[index] = 0;
                };
            };
            if (judgeEgg == 1) {
              break;  
            };
            if (DragonEggs.every(item => item == 0)) {
                // 都为空就滑动背包 滑动大点
                await sleep(1000);
                await scrollPage(680, 10, 5);
                await sleep(1000);
                continue;
            } else if (DragonEggs.some(item => item != 0) && judgeEgg == 0) {
                // 露出最后一排数字
                // await scrollPage(50, 5, 5);
                // 不为空就滑动背包 滑动小点
                await sleep(1000);
                await scrollPage(300, 10, 5);
                await sleep(1000);
                judgeEgg = 1;
                // 判断是否为最后一页
                let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                if (sliderBottom.success) {
                    log.info("孤零零的龙蛋在最后一页！");
                    continue;
                };
            };

            // 判断是否到底
            let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
            if (sliderBottom.success) {
                log.info("已到达最后一页！");
                break;
            };
        };
    };

    log.info(`背包龙蛋数目: 【山之血：${DragonEggs[0]}，飞澜鲨鲨：${DragonEggs[1]}，圣龙君临：${DragonEggs[2]}，太阳的轰鸣：${DragonEggs[3]}，献给小酒杯：${DragonEggs[4]}，菲耶蒂娜：${DragonEggs[5]}】`);
    if (settings.notify) {
        notification.Send(`背包龙蛋数目: 【山之血：${DragonEggs[0]}，飞澜鲨鲨：${DragonEggs[1]}，圣龙君临：${DragonEggs[2]}，太阳的轰鸣：${DragonEggs[3]}，献给小酒杯：${DragonEggs[4]}，菲耶蒂娜：${DragonEggs[5]}】`);
    };
    // 更新记录
    record.lastDragonEggsNum = `【山之血：${DragonEggs[0]}，飞澜鲨鲨：${DragonEggs[1]}，圣龙君临：${DragonEggs[2]}，太阳的轰鸣：${DragonEggs[3]}，献给小酒杯：${DragonEggs[4]}，菲耶蒂娜：${DragonEggs[5]}】`;
    await recordForFile(false);
    return `【山之血：${DragonEggs[0]}，飞澜鲨鲨：${DragonEggs[1]}，圣龙君临：${DragonEggs[2]}，太阳的轰鸣：${DragonEggs[3]}，献给小酒杯：${DragonEggs[4]}，菲耶蒂娜：${DragonEggs[5]}】`;;
};

// 检查过期物品
async function checkExpire() {
    await sleep(1000);
    let ocrExpire = await performOcr("",{ min: 870, max: 1040 }, { min: 280, max: 320 }, true);
    if (ocrExpire.text == "物品过期") {
        log.info(`处理中=========`);
       await click(980, 750); 
    };
};

// 执行区
(async function() {
    await fakeLog("AutoPickLitter脚本", true, true, 0);

    // 判定你是不是新人
    if(!settings.water && !settings.sticks && !settings.lots && !settings.conchs && !settings.meal && !settings.eggs && !settings.turntable && !settings.todayLuck && !settings.sweetStatue){
        log.error(`亲，这面请您点击【打开脚本目录】找到AutoPickLitter文件并打开然后去阅读README！！！`);
        log.error(`亲，这面请您点击【打开脚本目录】找到AutoPickLitter文件并打开然后去阅读README！！！`);
        log.error(`亲，这面请您点击【打开脚本目录】找到AutoPickLitter文件并打开然后去阅读README！！！`);
        await fakeLog("AutoPickLitter脚本", true, false, 2333);
        return 0;
    };
    await setGameMetrics(1920,1080,1);
    // 判定文件名的合法性，以及初始化相关文件
    await recordForFile(true);
    // 更新日期信息
    record.lastRunDate = new Date(Date.now() - 4 * 60 * 60 * 1000)
        .toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\//g, '/');
    await recordForFile(false);
    // 蒙德清泉镇圣水
    if (settings.water) {
        await fakeLog("蒙德清泉镇圣水", false, true, 0);
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/霍普金斯.json");
        await genshin.returnMainUi();
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/蒙德清泉镇路线.json");

        // await genshin.setTime(8,0); // 等下个BGI版本再用


        //识别对话位置，并点击
        let ocrResults = await performOcr("神奇的", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            await sleep(700);
            await performOcr("如何才", dialogZone.x, dialogZone.y, false);
            await sleep(700);
            let ocrOver = await performOcr("已",{ min: 1482, max: 1630 }, { min: 912, max: 957 }, false);
            if (ocrOver.success) {
                log.info("已售罄！！！");
            } else {
                let ocrMora = await performOcr("", { min: 1600, max: 1780 }, { min: 30, max: 60 }, true);
                if (ocrMora == "") {
                    await sleep(700);
                    ocrMora = await performOcr("", { min: 1600, max: 1780 }, { min: 30, max: 60 }, true);
                };
                // 处理得到的数据
                let onlyNumber = ocrMora.text.replace(/[^0-9]/g, "");
                if (BigInt(onlyNumber) >= 300) {
                    await sleep(800);
                    await click(1636,1019);
                    await sleep(1000);
                    await click(1168,785);
                    await sleep(1000);
                } else {
                    log.info("不是哥们，你怎么比我还穷！！！");
                };
            };
        };
        await genshin.returnMainUi();
        await fakeLog("蒙德清泉镇圣水", false, false, 0);
    };

    // 璃月璃沙娇上香
    if (sticksTime) {
        await fakeLog("璃月璃沙娇上香", false, true, 0);
        await genshin.returnMainUi();
        // 更新上香时间
        record.lastActivateTime = new Date();
        await recordForFile(false);
        await pathingScript.runFile("assets/璃月璃沙娇路线.json");
        await sleep(1000);
        // 识别区域
        let ocrResults = await performOcr("王平安", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            await sleep(700);
            await genshin.chooseTalkOption("能给我几支香吗");
            await sleep(700);
            leftButtonClick();
            await sleep(700);
            leftButtonClick();
            await sleep(2000);
            let ocrResults1 = await performOcr("敬香", dialogZone.x, dialogZone.y, false);
            if(ocrResults1.success){
                await click(1168,785);
                await sleep(700);
            } else {
                log.error("未识别到对话，可能角色移速太快加上有开盾打断识别了");
                await genshin.returnMainUi();
            };
        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
        await fakeLog("璃月璃沙娇上香", false, false, 0);
    };

    // 稻妻鸣神大社抽签
    if (settings.lots) {
        await fakeLog("稻妻鸣神大社抽签", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/稻妻鸣神大社路线.json");
        await sleep(1000);
        // 识别对话位置，并点击
        let ocrResults = await performOcr("御神签箱", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            await sleep(700);
            leftButtonClick();
            await sleep(2000);
            let ocrResults1 = await performOcr("求签吧", dialogZone.x, dialogZone.y, false);
            if (ocrResults1.success) {
                await sleep(2000);
                leftButtonClick();
                await sleep(4000);
                leftButtonClick();
                await sleep(3500);
            };
            let ocrResults2 = await performOcr("玄冬林", dialogZone.x, dialogZone.y, false);
            let results = "";
            if (ocrResults2.success) {
                await sleep(1000);
                leftButtonClick();
                await sleep(700);
                let ocrResults3 = await performOcr("我要", dialogZone.x, dialogZone.y, false);
                if (ocrResults3.success) {
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                    // 交互道具，直接选择位置点击
                    await click(111,184);
                    await sleep(1000);
                    await click(1250,817);
                    await sleep(1000);
                    await click(1603,1013);
                    await sleep(1500);
                    await genshin.returnMainUi();
                    // 打开背包找签
                    await keyPress("B");
                    await checkExpire();
                    await sleep(1000);
                    await click(1150,50);
                    await sleep(700);
                    for(let scroll = 0; scroll <= 22; scroll++){
                        // 识别御神签
                        let yuShenQian = await findImgIcon("assets/RecognitionObject/YuShenQianHalf.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                        if (yuShenQian.success) {
                            break;
                        };
                        if ( scroll != 0) {
                            // 判断是否到底
                            let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                            if (sliderBottom.success) {
                                log.info("已到达最后一页！");
                                break;
                            };
                        };
                        //滑动背包
                        await scrollPage(680, 10, 5);
                        await sleep(100);
                    };
                    await sleep(2000);
                    await click(1670,1025);
                    await sleep(3000);
                    // 通过图片识别
                    // 大凶or凶
                    let bigBad = await findImgIcon("assets/RecognitionObject/BigBad.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let bad = await findImgIcon("assets/RecognitionObject/Bad.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    // 大吉、中吉、吉、末吉
                    let bigLuck = await findImgIcon("assets/RecognitionObject/BigLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let midLuck = await findImgIcon("assets/RecognitionObject/MidLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let endLuck = await findImgIcon("assets/RecognitionObject/EndLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let luck = await findImgIcon("assets/RecognitionObject/Luck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    await genshin.returnMainUi();
                    if (bigBad.success) {
                        log.info("抽签的结果:大凶");
                        results = "大凶";
                        await pathingScript.runFile("assets/挂签路线.json");
                        await performOcr("御签挂", { min: 900, max: 1700 }, { min: 380, max: 880 }, false);
                        await genshin.chooseTalkOption("挂起来吧");
                        await sleep(700);
                        await click(111,184);
                        await sleep(1000);
                        await click(1250,817);
                        await sleep(1000);
                        await click(1603,1013);
                        await sleep(1500);
                        await genshin.returnMainUi();
                        log.info("事事顺利");
                    } else if (bad.success) {
                        log.info("抽签的结果:凶");
                        results = "凶";  
                        await pathingScript.runFile("assets/挂签路线.json");
                        await performOcr("御签挂", { min: 900, max: 1700 }, { min: 380, max: 880 }, false);
                        await sleep(700);
                        await genshin.chooseTalkOption("挂起来吧");
                        await click(111,184);
                        await sleep(1000);
                        await click(1250,817);
                        await sleep(1000);
                        await click(1603,1013);
                        await sleep(1500);
                        await genshin.returnMainUi();
                        log.info("事事顺利");
                    } else if (bigLuck.success) {
                        log.info("抽签的结果:大吉");
                        results = "大吉";
                    } else if (midLuck.success) {
                        log.info("抽签的结果:中吉");
                        results = "中吉";
                    } else if (endLuck.success) {
                        log.info("抽签的结果:末吉");
                        results = "末吉";
                    } else if (luck.success) {
                        log.info("抽签的结果:吉");
                        results = "吉";
                    } else {
                        log.warn("嘘，快踢作者屁股，修bug！！！");
                    };  
                } else {
                    await sleep(700);
                    await genshin.chooseTalkOption("再见");
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                    log.info("对话出现再见，默认解签完毕以及查看签操作！！！");
                }; 

                for (let i = record.records.length - 1; i > 0; i--) {
                    record.records[i] = record.records[i - 1];
                }
                record.records[0] = `抽签的结果: ${results}`;
                if (settings.notify) {
                    notification.Send(`抽签的结果: ${results}`);
                }
                await recordForFile(false);//修改记录文件
            };
        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
            // await genshin.returnMainUi();
        };
        await genshin.returnMainUi();
        await fakeLog("稻妻鸣神大社抽签", false, true, 0)
    };

    // 稻妻踏鞴砂海螺
    if (settings.conchs) {
        await fakeLog("稻妻踏鞴砂海螺", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/稻妻踏鞴砂路线.json");
        await sleep(1000);
        if (settings.doYouOpen) {
            await pathingScript.runFile("assets/阿敬.json");
            let figure = parseInt(settings.pickupTreasure);
            let ocrResults = await performOcr("阿敬", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                await sleep(1000);
                let ocrResults1 = await performOcr("想要", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                    //交互道具，直接选择位置点击
                    await click(111,184);
                    await sleep(1000);
                    await click(1250,817);
                    await sleep(1000);
                    await click(1603,1013);
                    await sleep(1500);
                    await genshin.returnMainUi();
                    if (figure != 0) {
                        await pathingScript.runFile(`assets/宝箱${figure}.json`);
                        log.info(`你即将开启${figure}号宝箱`);
                    } else {
                        figure = Math.floor(Math.random() * 3) + 1;
                        log.info(`你即将开启${figure}号宝箱`);
                        await pathingScript.runFile(`assets/宝箱${figure}.json`);
                    };
                } else {
                    log.info("你开过了？look my eyes,回答我！！！");
                    await genshin.chooseTalkOption("再见");
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
        };
        await genshin.returnMainUi();
        await fakeLog("稻妻踏鞴砂海螺", false, false, 0)
    };

    //枫丹梅洛彼得堡福利餐
    if(settings.meal){
        await fakeLog("枫丹梅洛彼得堡福利餐", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/枫丹梅洛彼得堡路线.json");
        await sleep(1000);
        let ocrResults = await performOcr("布兰", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            await sleep(700);
            let ocrResults1 = await performOcr("没什么", dialogZone.x, dialogZone.y, false);
            if(ocrResults1.success){
                log.info("对话出现没什么，默认领取和使用过！！！");
            } else{
                // await genshin.chooseTalkOption("给我一份福利餐");
                await performOcr("给我一份福利餐", dialogZone.x, dialogZone.y, false);
                await sleep(1000);
                leftButtonClick();
                await sleep(1000);
                leftButtonClick();
                await sleep(1500);
                //打开背包找签
                log.info("打开背包");
                await keyPress("B");
                await checkExpire();
                await sleep(1500);
                await click(1250,50); 
                await sleep(700);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let welffareMeal = await findImgIcon("assets/RecognitionObject/WelffareMealHalf.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (welffareMeal.success) {
                        break;
                    }
                    //滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);

                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                //这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(3000);
                //识别获得的食物名称
                let ocrText = await performOcr("", { min: 813, max: 985 }, { min: 585, max: 619 }, true);
                if (ocrText.text == "") {
                    await sleep(700);
                    ocrText = await performOcr("", { min: 813, max: 985 }, { min: 585, max: 619 }, true);
                };
                log.info(`获得:${ocrText.text}`);
                for (let i = record.records.length - 1; i > 0; i--) {
                    record.records[i] = record.records[i - 1];
                }
                record.records[0] = `获得的食物: ${ocrText.text}`;
                if (settings.notify) {
                    notification.Send(`获得的食物: ${ocrText.text}`);
                };
                await recordForFile(false);// 修改记录文件

                //点击幸运签，并识别内容
                await sleep(1000);
                await click(1000,520);
                await sleep(3000);
                let ocrText1 = await performOcr("", { min: 716, max: 1200 }, { min: 631, max: 710 }, true);
                if (ocrText.text == "") {
                    await sleep(700);
                    ocrText1 = await performOcr("", { min: 716, max: 1200 }, { min: 631, max: 710 }, true);
                };
                let text = ocrText1.text.replace(/\r\n|\n|\r/g, "");

                log.info(`幸运签内容:${text}`);

                for (let i = record.records.length - 1; i > 0; i--) {
                    record.records[i] = record.records[i - 1];
                }
                record.records[0] = `幸运签内容: ${text}`;
                if (settings.notify) {
                    notification.Send(`幸运签内容: ${text}`);
                }
                await recordForFile(false);// 修改记录文件
                
            };

        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
        await fakeLog("枫丹梅洛彼得堡福利餐", false, false, 0)
    };

    // 纳塔悠悠集市龙蛋
    if(settings.eggs){
        let nowDragonEggsNum = record.lastDragonEggsNum;
        if (record.lastDragonEggsNum == "【山之血：0，飞澜鲨鲨：0，圣龙君临：0，太阳的轰鸣：0，献给小酒杯：0，菲耶蒂娜：0】" || settings.updateEggs) {
            nowDragonEggsNum = await chcekDragonEggs();
            settings.updateEggs = "false";
        };
        let nowDragonEggs = nowDragonEggsNum.match(/\d+/g).map(Number);
        await fakeLog("纳塔悠悠集市龙蛋", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/纳塔悠悠集市路线.json");
        let ocrResults = await performOcr("察尔瓦", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            await sleep(700);
            leftButtonClick();
            await sleep(2000);
            let ocrResults1 = await performOcr("让我挑一枚", dialogZone.x, dialogZone.y, false);
            if (ocrResults1.success) {
                await sleep(5000);
                let figure = 0;
                if (settings.selectDragonEggModel == "随机模式") {
                    figure = Math.floor((Math.random() + Date.now() % 1) * 6);
                    nowDragonEggs[figure]++;
                } else if (settings.selectDragonEggModel == "指定模式") {
                    switch (settings.pickupDragonEgg) {
                        case "闪闪礼蛋·山之血":
                            figure = 0;
                            break;
                        case "闪闪礼蛋·飞澜鲨鲨":
                            figure = 1;
                            break;
                        case "闪闪礼蛋·圣龙君临":
                            figure = 2;
                            break;
                        case "闪闪礼蛋·太阳的轰鸣":
                            figure = 3;
                            break;
                        case "闪闪礼蛋·献给小酒杯":
                            figure = 4;
                            break;
                        case "闪闪礼蛋·菲耶蒂娜":
                            figure = 5;
                            break;
                        default:
                            log.warn("嘘，快踢作者屁股，修bug！！！");
                            break;
                    };
                    nowDragonEggs[figure]++;
                }else {
                    // 平均模式
                    const now = new Date();
                    const weekNumber = now.getDay()
                    if (nowDragonEggs.every(num => num === nowDragonEggs[0])) {
                        // 所有元素相同时，按星期规则处理
                        if (weekNumber === 0) { // 周日：随机一个元素+1
                            figure = Math.floor(Math.random() * 6);
                            nowDragonEggs[figure]++;
                        } else { // 周一到周六：第n个元素 +n（1-6）
                            const index = weekNumber - 1; // 周一对应索引0，...，周六对应索引5
                            nowDragonEggs[index]++;
                        };
                    } else {
                        // 元素不同时：给低于平均数且最小的元素+1，直到趋于平均
                        const sum = nowDragonEggs.reduce((a, b) => a + b, 0);
                        const avg = sum / 6;
                        // 筛选低于平均数的元素
                        const belowAvg = nowDragonEggs.map((num, i) => ({ num, i })).filter(item => item.num < avg);
                        
                        if (belowAvg.length > 0) {
                            // 找到低于平均数中的最小值
                            const minVal = Math.min(...belowAvg.map(item => item.num));
                            // 筛选出等于最小值的元素索引
                            const minIndices = belowAvg.filter(item => item.num === minVal).map(item => item.i);
                            figure = minIndices[0];
                            // 给第一个最小值元素+1（若多个最小值，可改为随机选一个）
                            nowDragonEggs[minIndices[0]]++;
                        };
                    };
                };
                // 日志输出会去点击那个龙蛋
                switch (figure) {
                    case 0:
                        log.info("获得的龙蛋:闪闪礼蛋·山之血");
                        break;
                    case 1:
                        log.info("获得的龙蛋:闪闪礼蛋·飞澜鲨鲨");
                        break;
                    case 2:
                        log.info("获得的龙蛋:闪闪礼蛋·圣龙君临");
                        break;
                    case 3:
                        log.info("获得的龙蛋:闪闪礼蛋·太阳的轰鸣");
                        break;
                    case 4:
                        log.info("获得的龙蛋:闪闪礼蛋·献给小酒杯");
                        break;
                    case 5:
                        log.info("获得的龙蛋:闪闪礼蛋·菲耶蒂娜");
                        break;
                    default:
                        log.warn("嘘，快踢作者屁股，修bug！！！");
                        break;
                };
                if (settings.notify) {
                    notification.Send(`背包龙蛋数目: 【山之血：${nowDragonEggs[0]}，飞澜鲨鲨：${nowDragonEggs[1]}，圣龙君临：${nowDragonEggs[2]}，太阳的轰鸣：${nowDragonEggs[3]}，献给小酒杯：${nowDragonEggs[4]}，菲耶蒂娜：${nowDragonEggs[5]}】`);
                };
                // 更新记录
                record.lastDragonEggsNum = `【山之血：${nowDragonEggs[0]}，飞澜鲨鲨：${nowDragonEggs[1]}，圣龙君临：${nowDragonEggs[2]}，太阳的轰鸣：${nowDragonEggs[3]}，献给小酒杯：${nowDragonEggs[4]}，菲耶蒂娜：${nowDragonEggs[5]}】`;
                await recordForFile(false);
                moveMouseTo(coordinates[figure][0],coordinates[figure][1]);
                await sleep(100);
                leftButtonClick();
                await sleep(3000);
            } else {
                log.info("你今天已经领取过了");
            };
        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };

        await genshin.returnMainUi();
        await fakeLog("纳塔悠悠集市龙蛋", false, false, 0)
    };

    //挪德卡莱那夏镇好运转盘
    if (settings.turntable) {
        await fakeLog("挪德卡莱那夏镇好运转盘", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/挪德卡莱那夏镇好运转盘路线.json");
        await sleep(1000);
        let ocrResults = await performOcr("好运速转", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            await sleep(3000);
            leftButtonClick();
            await sleep(1000);
            let ocrResults1 = await performOcr("拨动转盘", dialogZone.x, dialogZone.y, false);
            if (ocrResults1.success) {
                await sleep(6000);
                let ocrText = await performOcr("", { min: 555, max: 1365 }, { min: 902, max: 1000 }, true);
                if (ocrText.text == "") {
                    await sleep(700);
                    ocrText = await performOcr("", { min: 555, max: 1365 }, { min: 902, max: 1000 }, true);
                };
                log.info(`转盘运势:${ocrText.text}`);
                // writeContentToFile(`转盘的运势:${recognizedText}\n`, false);
                let text = ocrText.text.replace(/\r\n|\n|\r/g, "");


                for (let i = record.records.length - 1; i > 0; i--) {
                    record.records[i] = record.records[i - 1];
                }
                record.records[0] = `转盘的运势: ${text}`;
                if (settings.notify) {
                    notification.Send(`转盘的运势: ${text}`);
                }
                await recordForFile(false);// 修改记录文件

                await sleep(2000);
                leftButtonClick();
                await sleep(700);
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };  
        await genshin.returnMainUi();
        await fakeLog("挪德卡莱那夏镇好运转盘", false, false, 0)
    };

    // 挪德卡莱那夏镇今日收获
    if (settings.todayLuck) {
        await fakeLog("挪德卡莱那夏镇美味的今日收获", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/挪德卡莱那夏镇美味的今日收获路线.json");
        await sleep(1000);
            let ocrResults = await performOcr("莉莉希", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                await sleep(700);
                leftButtonClick();
                let ocrResults1 = await performOcr("可以领", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                } else {
                    log.warn("情况一，你根本没仔细看提示");
                    log.warn("情况二，你把它残忍放进背包了");
                    await sleep(1000);
                    await genshin.chooseTalkOption("其实");
                    await sleep(1000);
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
        await genshin.returnMainUi();
        await fakeLog("挪德卡莱那夏镇美味的今日收获", false, false, 0)
    };

    // 挪德卡莱那夏镇糖雕
    if (settings.sweetStatue) {
        await fakeLog("挪德卡莱那夏镇糖雕", false, true, 0)
        await pathingScript.runFile("assets/挪德卡莱那夏镇糖雕路线.json");
        await sleep(1000);
        if (settings.partyName == "") {
            let ocrResults = await performOcr("乌娜亚塔", dialogZone.x, dialogZone.y, false);
            // log.info(`识别的东西${ocrResults.text}`);
            if (ocrResults.success) {
                await sleep(700);
                await performOcr("来一份", dialogZone.x, dialogZone.y, false);
                await clickLongTalk();
                // 打开背包找糖
                await keyPress("B");
                await checkExpire();
                await sleep(1000);
                await click(864,52);
                await sleep(800);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let welffareMeal = await findImgIcon("assets/RecognitionObject/sugar.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (welffareMeal.success) {
                        break;
                    }
                    //滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);
                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                //这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(700);
                await click(1145, 765);
                await sleep(700);
                let ocrResults1 = await performOcr("是否", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(800);
                    await click(1012, 765);
                    await click(1012, 765);
                };
            };
        } else {
            await switchPartyIfNeeded(); // 切换队伍
            let ocrResults = await performOcr("乌娜亚塔", dialogZone.x, dialogZone.y, false);
            log.info(`识别的东西${ocrResults.text}`);
            if (ocrResults.success) {
                await sleep(700);
                await performOcr(settings.selectGiveWho, dialogZone.x, dialogZone.y, false);
                await clickLongTalk();
                // 打开背包找糖
                await keyPress("B");
                await checkExpire();
                await sleep(1000);
                await click(864,52);
                await sleep(800);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let welffareMeal = await findImgIcon("assets/RecognitionObject/sugar.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (welffareMeal.success) {
                        break;
                    }
                    //滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);
                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                //这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(700);
                await findImgIcon(`assets/RecognitionObject/${settings.selectGiveWho}.png`, { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                await sleep(700);
                await click(1145, 765);
                await sleep(700);
                let ocrResults1 = await performOcr("是否", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(800);
                    await click(1012, 765);
                    await click(1012, 765);
                };
            };
        };
        await genshin.returnMainUi();
        await fakeLog("挪德卡莱那夏镇糖雕", false, false, 0)
    };

    for (let i = record.records.length - 1; i > 0; i--) {
        record.records[i] = record.records[i - 1];
    }
    record.records[0] = `>>>>>>>>>> ${new Date().getFullYear()}年${String(new Date().getMonth() + 1).padStart(2, '0')}月${String(new Date().getDate()).padStart(2, '0')}日`;
    await recordForFile(false);// 修改记录文件

    await fakeLog("AutoPickLitter脚本", true, false, 2333);


})();

