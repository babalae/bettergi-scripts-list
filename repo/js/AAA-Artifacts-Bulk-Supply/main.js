// 初始化自定义配置并赋予默认值
let artifactPartyName = settings.artifactPartyName || "狗粮";//狗粮队伍名称
let combatPartyName = settings.combatPartyName;//清怪队伍名称
let minIntervalTime = settings.minIntervalTime || 1;//最短间隔时间（分钟）
let maxWaitingTime = settings.maxWaitingTime || 0;//最大额外等待时间（分钟）
let forceAlternate = settings.forceAlternate;//强制交替
let onlyActivate = settings.onlyActivate;//只运行激活额外和收尾
let decomposeMode = settings.decomposeMode || "保留";//狗粮分解模式
let keep4Star = settings.keep4Star;//保留四星
let autoSalvage = settings.autoSalvage;//启用自动分解
let notify = settings.notify;//启用通知
let accountName = settings.accountName || "默认账户";//账户名

//文件路径
const ArtifactsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/ArtifactsButton.png"));
const DeleteButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/DeleteButton.png"));
const AutoAddButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/AutoAddButton.png"));
const ConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/ConfirmButton.png"));
const DestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/DestoryButton.png"));
const MidDestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/DestoryButton.png"), 900, 600, 500, 300);
const CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/CharacterMenu.png"), 60, 991, 38, 38);

const decomposeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/decompose.png"));
const quickChooseRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/quickChoose.png"));
const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirm.png"));
const doDecomposeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/doDecompose.png"));
const doDecompose2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/doDecompose2.png"));

const normalPathA = "assets/ArtifactsPath/普通A";
const normalPathB = "assets/ArtifactsPath/普通B";
const normalPathC = "assets/ArtifactsPath/普通C";
const extraPath = "assets/ArtifactsPath/额外";

//初始化变量
let artifactExperienceDiff = 0;
let moraDiff = 0;
let state = {};
let record = {};
let CDInfo = [];
let failcount = 0;
let autoSalvageCount = 0;

(async function () {
    setGameMetrics(1920, 1080, 1);
    {
        //校验自定义配置,从未打开过自定义配置时进行警告
        if (!settings.accountName) {
            for (let i = 0; i < 15; i++) {
                log.warn("你从来没有打开过自定义配置，请仔细阅读readme后使用");
                await sleep(1000);
            }
        }
    }

    //预处理
    await readRecord(accountName);//读取记录文件
    const epochTime = new Date('1970-01-01T20:00:00.000Z');
    const now = new Date();
    state.runningRoute = Math.floor((now - epochTime) / (24 * 60 * 60 * 1000)) % 2 === 0 ? 'A' : 'B';//根据日期奇偶数确定普通路线
    if (new Date() - record.lastActivateTime < 12 * 60 * 60) {
        //距离上次激活不足12小时时启用备用C路线
        //state.runningRoute = `C`;
    }
    state.currentParty = "";
    state.cancel = false;
    log.info(`今日运行普通${state.runningRoute}路线`);
    if (state.runnedToday) {
        await readCDInfo(accountName);
    } else {
        await readCDInfo("重置cd信息");
    }
    await writeCDInfo(accountName);
    //更新日期信息
    record.lastRunDate = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}`;
    await writeRecord(accountName);

    //运行前按自定义配置清理狗粮
    if (settings.decomposeMode === "分解（经验瓶）") {
        await processArtifacts(21);
    } else {
        artifactExperienceDiff -= await processArtifacts(21);
    }

    moraDiff -= await mora();

    //执行普通路线，直到预定激活开始时间
    log.info("开始执行普通路线");
    await runNormalPath(true);
    if (state.cancel) return;

    //执行激活路线
    log.info("开始执行激活路线");
    await runActivatePath();
    if (state.cancel) return;

    //执行剩余普通路线
    log.info("开始执行剩余普通路线");
    await runNormalPath(false);
    if (state.cancel) return;

    //执行收尾和额外路线
    await runEndingAndExtraPath();
    if (state.cancel) return;

    //切回黑芙
    if (settings.furina) {
        await pathingScript.runFile('assets/furina/强制黑芙.json');
    }

    //运行后按自定义配置清理狗粮
    artifactExperienceDiff += await processArtifacts(21);
    moraDiff += await mora();
    log.info(`狗粮路线获取摩拉: ${moraDiff}`);
    log.info(`狗粮路线获取狗粮经验: ${artifactExperienceDiff}`);
    //修改records
    for (let i = record.records.length - 1; i > 0; i--) {
        record.records[i] = record.records[i - 1];
    }
    record.records[0] = `日期:${record.lastRunDate}，运行收尾路线${record.lastRunEndingRoute}，狗粮经验${artifactExperienceDiff}，摩拉${moraDiff}`;
    if (settings.notify) {
        notification.Send(`日期:${record.lastRunDate}，运行收尾路线${record.lastRunEndingRoute}，狗粮经验${artifactExperienceDiff}，摩拉${moraDiff}`);
    }
    await writeRecord(accountName);//修改记录文件

})();

async function readRecord(accountName) {
    /* ---------- 文件名合法性校验 ---------- */
    const illegalCharacters = /[\\/:*?"<>|]/;
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    let finalAccountName = accountName;

    if (accountName === "" ||
        accountName.startsWith(" ") ||
        accountName.endsWith(" ") ||
        illegalCharacters.test(accountName) ||
        reservedNames.includes(accountName.toUpperCase()) ||
        accountName.length > 255
    ) {
        log.error(`账户名 "${accountName}" 不合法，将使用默认值`);
        finalAccountName = "默认账户";
        await sleep(5000);
    } else {
        log.info(`账户名 "${accountName}" 合法`);
    }

    /* ---------- 读取记录文件 ---------- */
    const recordFolderPath = "records/";
    const recordFilePath = `records/${finalAccountName}.txt`;

    const filesInSubFolder = file.ReadPathSync(recordFolderPath);
    let fileExists = false;
    for (const filePath of filesInSubFolder) {
        if (filePath === `records\\${accountName}.txt`) {
            fileExists = true;
            break;
        }
    }



    /* ---------- 初始化记录对象 ---------- */
    record = {
        lastRunDate: "1970/01/01",
        lastActivateTime: new Date("1970-01-01T20:00:00.000Z"),
        lastRunEndingRoute: "收尾额外A",
        records: new Array(14).fill(""),
        version: ""
    };

    let recordIndex = 0;

    if (fileExists) {
        log.info(`记录文件 ${recordFilePath} 存在`);
    } else {
        log.warn(`无记录文件，将使用默认数据`);
        return;
    }

    const content = await file.readText(recordFilePath);
    const lines = content.split("\n");



    /* ---------- 逐行解析 ---------- */
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        /* 运行完成日期 */
        if (line.startsWith("上次运行日期:")) {
            record.lastRunDate = line.slice("上次运行日期:".length).trim();
        }

        /* 结束时间 / 激活收尾额外A时间（视为同一含义） */
        let timeStr = null;
        if (line.startsWith("上次结束时间:")) {
            timeStr = line.slice("上次结束时间:".length).trim();
        } else if (line.startsWith("上次激活收尾路线时间:")) {
            timeStr = line.slice("上次激活收尾路线时间:".length).trim();
        }

        if (timeStr) {
            const d = new Date(timeStr);
            if (!isNaN(d.getTime())) {
                record.lastActivateTime = d;   // 保持 Date 对象
            }
        }

        /* 收尾路线 */
        if (line.startsWith("上次运行收尾路线:")) {
            record.lastRunEndingRoute = line.slice("上次运行收尾路线:".length).trim();
        }
        if (record.lastRunEndingRoute !== "收尾额外B") {
            record.lastRunEndingRoute = "收尾额外A";
        }

        if (line.startsWith("日期") && recordIndex < record.records.length) {
            record.records[recordIndex++] = line;
        }
    }

    log.info(`上次运行日期: ${record.lastRunDate}`);
    log.info(`上次激活路线开始时间: ${record.lastActivateTime.toLocaleString()}`);

    /* ---------- 读取 manifest 版本 ---------- */
    try {
        const manifest = JSON.parse(await file.readText("manifest.json"));
        record.version = manifest.version;
        log.info(`当前版本为${record.version}`);
    } catch (err) {
        log.error("读取或解析 manifest.json 失败:", err);
    }

    /* ---------- 判断今日是否运行 ---------- */
    if (record.lastRunDate) {
        const [y, m, d] = record.lastRunDate.split("/").map(Number);
        const lastRun4AM = new Date(y, m - 1, d, 4, 0, 0);
        const now = new Date();

        if (now - lastRun4AM < 24 * 60 * 60 * 1000) {
            log.info("今日已经运行过狗粮");
            state.runnedToday = true;
        } else {
            state.runnedToday = false;
        }

        if (record.lastActivateTime - lastRun4AM > 0 && state.runnedToday) {
            log.info("今日已经运行过激活路线");
            state.activatedToday = true;
        } else {
            state.activatedToday = false;
        }
    }

    /* ---------- 计算下次可激活时间 ---------- */
    if (record.lastRunEndingRoute === "收尾额外B") {
        state.aimActivateTime = record.lastActivateTime;
        log.info("上次运行的是收尾额外B，可直接开始激活路线");
    } else if (!state.activatedToday) {
        state.aimActivateTime = new Date(
            record.lastActivateTime.getTime() +
            24 * 60 * 60 * 1000 +
            minIntervalTime * 60 * 1000
        );
        log.info(`上次运行的是收尾额外A，预计在 ${state.aimActivateTime.toLocaleString()} 开始激活路线`);
    } else {
        state.aimActivateTime = record.lastActivateTime;
        log.info(` 今日已经开始过激活路线，直接开始激活路线`);
    }
}

async function writeRecord(accountName) {
    if (state.cancel) return;
    const recordFilePath = `records/${accountName}.txt`;

    const lines = [
        `上次运行日期: ${record.lastRunDate}`,
        `上次激活收尾路线时间: ${record.lastActivateTime.toISOString()}`,
        `上次运行收尾路线: ${record.lastRunEndingRoute}`,
        ...record.records.filter(Boolean)
    ];

    const content = lines.join('\n');

    try {
        await file.writeText(recordFilePath, content, false);
        log.info(`记录已写入 ${recordFilePath}`);
    } catch (e) {
        log.error(`写入 ${recordFilePath} 失败:`, e);
    }
}

async function processArtifacts(times = 1) {
    await genshin.returnMainUi();
    await sleep(500);
    let result = 0;
    try {
        if (settings.decomposeMode === "销毁（摩拉）") {
            result = await destroyArtifacts(times);
        } else {
            result = await decomposeArtifacts();
        }
    } catch (error) {
        log.error(`处理狗粮分解时发生异常: ${error.message}`);
    }
    await genshin.returnMainUi();
    return result;

    async function decomposeArtifacts() {
        keyPress("B");
        await sleep(1000);
        await click(670, 45);
        await sleep(500);
        await findAndClick(decomposeRo);
        await sleep(1000);

        //识别已储存经验（1570-880-1650-930）
        let regionToCheck1 = { x: 1570, y: 880, width: 80, height: 50 };
        let initialNum = await recognizeTextInRegion(regionToCheck1);
        let initialValue = 0;

        if (initialNum && !isNaN(parseInt(initialNum, 10))) {
            initialValue = parseInt(initialNum, 10);
            log.info(`已储存经验识别成功: ${initialValue}`);
        } else {
            log.warn(`在指定区域未识别到有效数字: ${initialValue}`);
        }
        let regionToCheck3 = { x: 100, y: 885, width: 170, height: 50 };
        let decomposedNum = 0;
        let firstNumber = 0;
        let firstNumber2 = 0;

        if (settings.keep4Star) {
            await findAndClick(quickChooseRo);
            moveMouseTo(960, 540);
            await sleep(1000);

            await findAndClick(confirmRo);// 点击“确认选择”按钮
            await sleep(1000);

            decomposedNum = await recognizeTextInRegion(regionToCheck3);

            // 使用正则表达式提取第一个数字
            const match = decomposedNum.match(/已选(\d+)/);

            // 检查是否匹配成功
            if (match) {
                // 将匹配到的第一个数字转换为数字类型并存储在变量中
                firstNumber = Number(match[1]);
                log.info(`1-4星总数量: ${firstNumber}`);
            } else {
                log.info("识别失败");
            }
            keyPress("VK_ESCAPE");


            await findAndClick(decomposeRo);
            await sleep(1000);
        }
        await findAndClick(quickChooseRo);
        moveMouseTo(960, 540);
        await sleep(1000);

        if (settings.keep4Star) {
            await click(370, 370);//取消选择四星
            await sleep(1000);
        }
        await findAndClick(confirmRo);// 点击“确认选择”按钮
        await sleep(1500);

        let decomposedNum2 = await recognizeTextInRegion(regionToCheck3);

        // 使用正则表达式提取第一个数字
        const match2 = decomposedNum2.match(/已选(\d+)/);

        // 检查是否匹配成功
        if (match2) {
            // 将匹配到的第一个数字转换为数字类型并存储在变量中
            firstNumber2 = Number(match2[1]);
            log.info(`分解总数是: ${firstNumber2}`);
        } else {
            log.info("识别失败");
        }
        //识别当前总经验
        let regionToCheck2 = { x: 1470, y: 880, width: 205, height: 70 };
        let newNum = await recognizeTextInRegion(regionToCheck2);
        let newValue = 0;

        if (newNum && !isNaN(parseInt(newNum, 10))) {
            newValue = parseInt(newNum, 10);
            log.info(`当前总经验识别成功: ${newValue}`);
        } else {
            log.warn(`在指定区域未识别到有效数字: ${newValue}`);
        }

        if (settings.notify) {
            notification.Send(`当前总经验: ${newValue}`);
        }

        if (settings.decomposeMode === "分解（经验瓶）") {
            log.info(`用户选择了分解，执行分解`);
            // 根据用户配置，分解狗粮
            await sleep(500);

            await findAndClick(doDecomposeRo); // 点击分解按钮
            await sleep(500);

            // 4. "进行分解"按钮
            await findAndClick(doDecompose2Ro); // 点击进行分解按钮
            await sleep(1000);

            // 5. 关闭确认界面
            await click(1340, 755);
            await sleep(1000);
        }
        else {
            log.info(`用户未选择分解，不执行分解`);
        }

        // 7. 计算分解获得经验=总经验-上次剩余
        const resinExperience = Math.max(newValue - initialValue, 0);
        log.info(`分解可获得经验: ${resinExperience}`);
        let fourStarNum = firstNumber - firstNumber2;
        if (settings.keep4Star) {
            log.info(`保留的四星数量: ${fourStarNum}`);
        }
        let resultExperience = resinExperience;
        if (resultExperience === 0) {
            resultExperience = initialValue;
        }
        const result = resultExperience;
        await genshin.returnMainUi();
        return result;
    }

    async function findAndClick(target, maxAttempts = 3) {
        let attempts = 0;
        while (attempts < maxAttempts) {
            gameRegion = captureGameRegion();
            let result = gameRegion.find(target);
            gameRegion.dispose();
            if (result.isExist) {
                result.click();
                break;
            }
            attempts++;
            await sleep(250 * attempts);
        }
    }

    async function destroyArtifacts(times = 1) {
        await genshin.returnMainUi();
        await sleep(250);
        keyPress("B");
        await sleep(250);
        await findAndClick(ArtifactsButtonRo, 5);
        try {
            for (let i = 0; i < times; i++) {
                await findAndClick(DeleteButtonRo);// 点击摧毁
                await sleep(600);
                await findAndClick(AutoAddButtonRo);// 点击自动添加
                await sleep(900);
                click(150, 150);
                await sleep(300);
                click(150, 220);
                await sleep(300);
                click(150, 300);
                if (!settings.keep4Star) {
                    await sleep(300);
                    click(150, 370);
                }
                await findAndClick(ConfirmButtonRo);// 点击快捷放入
                await sleep(600);
                await findAndClick(DestoryButtonRo);// 点击摧毁
                await sleep(600);
                await findAndClick(MidDestoryButtonRo);// 弹出页面点击摧毁
                await sleep(600);
                click(960, 1000);// 点击空白处
                await sleep(1000);
            }
        } catch (ex) {
            log.info("背包里的圣遗物已摧毁完毕，提前结束")
        } finally {
            await genshin.returnMainUi();
        }

    }
}

async function mora() {
    // 定义一个函数用于识别图像
    async function recognizeImage(recognitionObject, timeout = 5000) {
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 尝试识别图像
                const gameRegion = captureGameRegion();
                let imageResult = gameRegion.find(recognitionObject);
                gameRegion.dispose;
                if (imageResult) {
                    // log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
                    // log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
                    return { success: true, x: imageResult.x, y: imageResult.y };
                }
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
            }
            await sleep(500); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法识别图像`);
        return { success: false };
    }
    let result = 0;
    let tryTimes = 0;
    while (result === 0 && tryTimes < 3) {
        await genshin.returnMainUi();
        await sleep(100);
        log.info("开始尝试识别摩拉");
        // 按下 C 键
        keyPress("C");
        await sleep(1500);
        let recognized = false;
        // 识别“角色菜单”图标或“天赋”文字
        let startTime = Date.now();
        while (Date.now() - startTime < 5000) {
            // 尝试识别“角色菜单”图标
            let characterMenuResult = await recognizeImage(CharacterMenuRo, 5000);
            if (characterMenuResult.success) {
                await click(177, 433);
                await sleep(500);
                recognized = true;
                break;
            }

            // 尝试识别“天赋”文字
            let targetText = "天赋";
            let ocrRegion = { x: 133, y: 395, width: 115, height: 70 }; // 设置对应的识别区域
            let talentResult = await recognizeTextAndClick(targetText, ocrRegion);
            if (talentResult.success) {
                log.info(`点击天赋文字，坐标: x=${talentResult.x}, y=${talentResult.y}`);
                recognized = true;
                break;
            }

            await sleep(1000); // 短暂延迟，避免过快循环
        }

        let recognizedText = "";

        // 如果识别到了“角色菜单”或“天赋”，则识别“摩拉数值”
        if (recognized) {
            let ocrRegionMora = { x: 1620, y: 25, width: 152, height: 46 }; // 设置对应的识别区域
            recognizedText = await recognizeTextInRegion(ocrRegionMora);
            if (recognizedText) {
                log.info(`成功识别到摩拉数值: ${recognizedText}`);
                result = recognizedText;
            } else {
                log.warn("未能识别到摩拉数值。");
            }
        } else {
            log.warn("未能识别到角色菜单或天赋");
        }
        await sleep(500);
        tryTimes++;
        if (settings.notify) {
            notification.Send(`当前摩拉: ${Number(result)}`);
        }
        await genshin.returnMainUi();
    }
    return Number(result);
}

// 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 在指定区域进行 OCR 识别
            const gameRegion = captureGameRegion();
            let ocrResult = gameRegion.find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            gameRegion.dispose();
            if (ocrResult) {
                let correctedText = ocrResult.text;
                return correctedText; // 返回识别到的内容
            } else {
                log.warn(`OCR 识别区域未找到内容`);
                return null; // 如果 OCR 未识别到内容，返回 null
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}

// 定义一个函数用于识别文字并点击
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 3000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试 OCR 识别
            const gameRegion = captureGameRegion();
            let resList = gameRegion.findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)); // 指定识别区域
            gameRegion.dispose();
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                let correctedText = res.text;
                if (correctedText.includes(targetText)) {
                    // 如果找到目标文本，计算并点击文字的中心坐标
                    let centerX = Math.round(res.x + res.width / 2);
                    let centerY = Math.round(res.y + res.height / 2);
                    await click(centerX, centerY);
                    await sleep(500); // 确保点击后有足够的时间等待
                    return { success: true, x: centerX, y: centerY };
                }
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`页面标志识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(1000); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别文字: ${targetText},尝试点击默认中心位置`);
    let centerX = Math.round(ocrRegion.x + ocrRegion.width / 2);
    let centerY = Math.round(ocrRegion.y + ocrRegion.height / 2);
    await click(centerX, centerY);
    await sleep(1000);
    return { success: false };
}

//切换队伍
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }
    try {
        log.info("正在尝试切换至" + partyName);
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(partyName);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}

// 定义 readFolder 函数
async function readFolder(folderPath, onlyJson) {
    // 新增一个堆栈，初始时包含 folderPath
    const folderStack = [folderPath];

    // 新增一个数组，用于存储文件信息对象
    const files = [];

    // 当堆栈不为空时，继续处理
    while (folderStack.length > 0) {
        // 从堆栈中弹出一个路径
        const currentPath = folderStack.pop();

        // 读取当前路径下的所有文件和子文件夹路径
        const filesInSubFolder = file.ReadPathSync(currentPath);

        // 临时数组，用于存储子文件夹路径
        const subFolders = [];
        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                // 如果是文件夹，先存储到临时数组中
                subFolders.push(filePath);
            } else {
                // 如果是文件，根据 onlyJson 判断是否存储
                if (onlyJson) {
                    if (filePath.endsWith(".json")) {
                        const fileName = filePath.split('\\').pop(); // 提取文件名
                        const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                        files.push({
                            fullPath: filePath,
                            fileName: fileName,
                            folderPathArray: folderPathArray
                        });
                        //log.info(`找到 JSON 文件：${filePath}`);
                    }
                } else {
                    const fileName = filePath.split('\\').pop(); // 提取文件名
                    const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                    files.push({
                        fullPath: filePath,
                        fileName: fileName,
                        folderPathArray: folderPathArray
                    });
                    //log.info(`找到文件：${filePath}`);
                }
            }
        }
        // 将临时数组中的子文件夹路径按原顺序压入堆栈
        folderStack.push(...subFolders.reverse()); // 反转子文件夹路径
    }

    return files;
}

//读取cd信息
async function readCDInfo(accountName) {
    const CDInfoFolderPath = 'CDInfo/';
    const CDInfoFilePath = `CDInfo/${accountName}.json`;

    const filesInSubFolder = file.ReadPathSync(CDInfoFolderPath);
    let fileExists = false;
    for (const filePath of filesInSubFolder) {
        if (filePath === `CDInfo\\${accountName}.json`) {
            fileExists = true;
            break;
        }
    }

    if (fileExists) {
        try {
            const raw = await file.readText(CDInfoFilePath);
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                CDInfo = parsed;
            } else {
                log.warn('文件内容异常，使用默认状态');
                CDInfo = [];
            }
        } catch (e) {
            log.error(`读取或解析 ${CDInfoFilePath} 失败：`, e);
            CDInfo = [];
        }
    } else {
        CDInfo = [];
    }
}

//更新cd信息
async function writeCDInfo(accountName) {
    if (state.cancel) return;
    const CDInfoFilePath = `CDInfo/${accountName}.json`;
    await file.writeText(CDInfoFilePath, JSON.stringify(CDInfo), false);
}

//运行普通路线
async function runNormalPath(doStop) {
    //关闭拾取
    dispatcher.ClearAllTriggers();
    if (state.cancel) return;
    const routeMap = { A: normalPathA, B: normalPathB, C: normalPathC };
    const normalPath = routeMap[state.runningRoute];
    const normalCombatPath = normalPath + "/清怪";
    const normalExecutePath = normalPath + "/执行";
    if (combatPartyName) {
        log.info("填写了清怪队伍，执行清怪路线");
        await runPaths(normalCombatPath, combatPartyName, doStop);
    }
    // 启用自动拾取的实时任务
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    await runPaths(normalExecutePath, artifactPartyName, doStop);
}

async function runActivatePath() {
    //关闭拾取
    dispatcher.ClearAllTriggers();
    if (state.cancel) return;
    if (!state.activatedToday) {
        log.info("今日未执行过激活路线");
        //判断收尾路线并更新record
        if (new Date() >= state.aimActivateTime || record.lastRunEndingRoute === "收尾额外B") {
            state.runningEndingAndExtraRoute = "收尾额外A";
        } else {
            state.runningEndingAndExtraRoute = "收尾额外B";
        }
        record.lastRunEndingRoute = state.runningEndingAndExtraRoute;
        record.lastActivateTime = new Date();
        await writeRecord(accountName);
    } else {
        log.info("今日执行过激活路线");
        state.runningEndingAndExtraRoute = record.lastRunEndingRoute;
    }
    let endingPath = state.runningEndingAndExtraRoute === "收尾额外A"
        ? "assets/ArtifactsPath/优先收尾路线"
        : "assets/ArtifactsPath/替补收尾路线";
    if (forceAlternate) {
        endingPath = state.runningRoute === "A"
            ? "assets/ArtifactsPath/优先收尾路线"
            : "assets/ArtifactsPath/替补收尾路线";
    }
    const endingActivatePath = endingPath + "/激活";
    const endingCombatPath = endingPath + "/清怪";
    const endingPreparePath = endingPath + "/准备";
    let extraPath = state.runningEndingAndExtraRoute === "收尾额外A"
        ? "assets/ArtifactsPath/额外/所有额外"
        : "assets/ArtifactsPath/额外/仅12h额外";
    const extraActivatePath = extraPath + "/激活";
    const extraCombatPath = extraPath + "/清怪";
    const extraPreparePath = extraPath + "/准备";
    if (!forceAlternate && state.runningEndingAndExtraRoute === "收尾额外A") {
        await runPaths(endingActivatePath, "", false);
    }
    await runPaths(extraActivatePath, "", false);

    if (combatPartyName) {
        log.info("填写了清怪队伍，执行清怪路线");
        await runPaths(extraCombatPath, combatPartyName, false);
        await runPaths(endingCombatPath, combatPartyName, false);
    }

    await runPaths(endingPreparePath, "", false);
    await runPaths(extraPreparePath, "", false);
}

async function runEndingAndExtraPath() {
    // 启用自动拾取的实时任务
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    if (state.cancel) return;
    let endingPath = state.runningEndingAndExtraRoute === "收尾额外A"
        ? "assets/ArtifactsPath/优先收尾路线"
        : "assets/ArtifactsPath/替补收尾路线";
    if (forceAlternate) {
        endingPath = state.runningRoute === "A"
            ? "assets/ArtifactsPath/优先收尾路线"
            : "assets/ArtifactsPath/替补收尾路线";
    }
    let extraPath = state.runningEndingAndExtraRoute === "收尾额外A"
        ? "assets/ArtifactsPath/额外/所有额外"
        : "assets/ArtifactsPath/额外/仅12h额外";
    endingPath = endingPath + "/执行";
    await runPaths(endingPath, artifactPartyName, false);
    extraPath = extraPath + "/执行";
    await runPaths(extraPath, artifactPartyName, false);
}

async function runPaths(folderFilePath, PartyName, doStop) {
    if (settings.autoSalvage && autoSalvageCount >= 4) {
        autoSalvageCount = 0;
        if (settings.decomposeMode === "分解（经验瓶）") {
            artifactExperienceDiff += await processArtifacts(1);
        } else {
            await processArtifacts(1);
        }
    } else {
        autoSalvageCount++;
    }
    if (state.cancel) return;
    let Paths = await readFolder(folderFilePath, true);
    for (let i = 0; i < Paths.length; i++) {
        let skiprecord = false;
        if (state.cancel) return;
        if (new Date() >= state.aimActivateTime && doStop) {
            log.info("已经到达预定时间");
            break;
        } else if ((new Date() >= (state.aimActivateTime - minIntervalTime * 60)) && doStop) {
            log.info(`即将到达预定时间，等待${state.aimActivateTime - new Date()}毫秒`);
            await sleep(state.aimActivateTime - new Date())
            break;
        }

        const Path = Paths[i];
        let success = true;
        // 如果 CDInfo 数组中已存在该文件名，则跳过
        if (CDInfo.includes(Path.fullPath)) {
            log.info(`路线${Path.fullPath}今日已运行，跳过`);
            continue;
        }

        if (PartyName != state.currentParty && PartyName) {
            //如果与当前队伍不同，尝试切换队伍，并更新队伍
            await switchPartyIfNeeded(PartyName);
            state.currentParty = PartyName;
            if (settings.furina) {
                if (state.currentParty === artifactPartyName) {
                    await pathingScript.runFile('assets/furina/强制白芙.json');
                } else {
                    await pathingScript.runFile('assets/furina/强制黑芙.json');
                }
            }
        }
        await fakeLog(Path.fileName, false, true, 0);
        try {
            log.info(`当前进度：${Path.fileName}为${folderFilePath}第${i + 1}/${Paths.length}个`);
            await pathingScript.runFile(Path.fullPath);
            await sleep(1);
        } catch (error) {
            skiprecord = true;
            log.error(`执行路径文件时发生错误：${error.message}`);
            if (error.message === "A task was canceled.") {
                log.warn("任务取消");
                state.cancel = true;
            }
            success = false;
            break;
        }
        await fakeLog(Path.fileName, false, false, 0);
        const pathInfo = await parsePathing(Path.fullPath);
        if (pathInfo.ok) {
            //回到主界面
            await genshin.returnMainUi();
            await sleep(100);
            try {
                // 获取当前人物在指定地图上的坐标
                const currentPosition = await genshin.getPositionFromMap(pathInfo.map_name);

                // 计算与最后一个非 orientation 点的距离
                const distToLast = Math.hypot(
                    currentPosition.x - pathInfo.x,
                    currentPosition.y - pathInfo.y
                );

                // 距离超过 100 认为路线没有正常完成（卡死或未开图等）
                if (distToLast >= 100) {
                    failcount++;
                    skiprecord = true;
                    log.warn(`路线${Path.fileName}，没有正常完成，请检查是否开图`);
                    await sleep(5000);
                }
            } catch (error) {
                log.error(`发生错误：${error.message}`);
                skiprecord = true;
            }
        }
        if (!skiprecord) {
            CDInfo = [...new Set([...CDInfo, Path.fullPath])];
            await writeCDInfo(accountName);
        }
    }
}

async function parsePathing(pathFilePath) {
    try {
        const raw = await file.readText(pathFilePath);
        const json = JSON.parse(raw);

        if (!Array.isArray(json.positions) || typeof json.map_name !== 'string') {
            return { ok: false };
        }

        // 从后往前找第一个 type !== "orientation" 的点
        for (let i = json.positions.length - 1; i >= 0; i--) {
            const p = json.positions[i];
            if (p.type !== 'orientation' &&
                typeof p.x === 'number' &&
                typeof p.y === 'number') {
                return {
                    ok: true,
                    x: p.x,
                    y: p.y,
                    map_name: json.map_name
                };
            }
        }
        return { ok: false };
    } catch (err) {
        log.error(`解析路径文件失败: ${err.message}`);
        return { ok: false };
    }
}

// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
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