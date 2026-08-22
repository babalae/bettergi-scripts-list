function getRecordAccountName() {
    const value = String(settings.userName || "默认账户").trim();
    if (/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(value)) {
        return value;
    }
    log.warn(`账户名“${value}”无效，记录将写入默认账户`);
    return "默认账户";
}

const recordAccountName = getRecordAccountName();
const unifiedRecordPath = `record/${recordAccountName}.txt`;
const localRecordOptionMap = {
    recordPrimogems: ["wishRecordItems", "原石"],
    recordIntertwinedFate: ["wishRecordItems", "纠缠之缘"],
    recordWishTotalValue: ["wishRecordItems", "抽卡资源总价值"],
    recordAvailablePulls: ["wishRecordItems", "可用抽数"],
    recordMora: ["moraRecordItems", "摩拉"],
    recordWanderersAdvice: ["characterExpRecordItems", "流浪者的经验数量"],
    recordAdventurersExperience: ["characterExpRecordItems", "冒险家的经验数量"],
    recordHerosWit: ["characterExpRecordItems", "大英雄的经验数量"],
    recordCharacterExpTotal: ["characterExpRecordItems", "经验书总经验"],
    recordSmallArtifactBottle: ["artifactRecordItems", "小经验瓶数量"],
    recordBigArtifactBottle: ["artifactRecordItems", "大经验瓶数量"],
    recordArtifactTotalExp: ["artifactRecordItems", "圣遗物总经验"]
};

function getSelectedRecordItems(groupName) {
    const value = settings[groupName];
    if (!value) {
        return [];
    }
    try {
        return Array.from(value);
    } catch (error) {
        return [];
    }
}

function shouldWriteLocalRecord(settingName) {
    const mapping = localRecordOptionMap[settingName];
    if (!mapping) {
        return false;
    }
    const [groupName, optionName] = mapping;
    return getSelectedRecordItems(groupName).includes(optionName);
}

function getLocalRecordSelectionCount() {
    return Object.keys(localRecordOptionMap).filter(shouldWriteLocalRecord).length;
}

function hasSelectedRecordItems(groupName) {
    return getSelectedRecordItems(groupName).length > 0;
}

function sendNotebookNotification(message) {
    if (settings.notify === false) {
        return;
    }

    try {
        notification.send(String(message).replace(/\r?\n/g, " | "));
        log.info("通知已发送");
    } catch (error) {
        const detail = error && error.message ? error.message : String(error);
        log.error(`通知发送失败：${detail}`);
    }
}

async function beginRecordBatch() {
    const now = new Date();
    const recordTime =
        `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ` +
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    let existingContent = "";
    try {
        existingContent = await file.readText(unifiedRecordPath);
    } catch (error) {
        // 首次运行时记录文件尚不存在。
    }

    const separator = existingContent.trim() ? "\n" : "";
    await file.writeText(
        unifiedRecordPath,
        `${existingContent.replace(/\s*$/, "")}${separator}${recordTime}\n`
    );
}

async function runWishResourceStats() {
// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
//let CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Wish.png"), 0, 0, 1920, 1080);

// 定义一个函数用于识别图像
async function recognizeImage(recognitionObject, timeout = 5000) {
    let startTime = Date.now();
    await sleep(500); // 短暂延迟，避免过快
    try {
        // 尝试识别图像
        const ro = captureGameRegion();
        let imageResult = ro.find(recognitionObject);
        ro.dispose();
        if (imageResult && imageResult.x != 0 && imageResult.y != 0) {
            log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
            log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
            return { success: true, x: imageResult.x, y: imageResult.y };
        }
    } catch (error) {
        log.error(`识别图像时发生异常: ${error.message}`);
    }
    log.warn(`无法识别图像`);
    return { success: false };
}


// 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        const ro = captureGameRegion();
        try {
            const ocrResult = ro.find(
                RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
            );
            const recognizedText = typeof ocrResult?.text === "string" ? ocrResult.text.trim() : "";
            if (recognizedText) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = recognizedText;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }
                if (correctedText) {
                    return correctedText;
                }
            }
            retryCount++;
            log.warn(`OCR 识别区域未找到有效内容，正在进行第 ${retryCount} 次重试...`);
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 数识别失败，正在进行第 ${retryCount} 次重试...`);
        } finally {
            ro.dispose();
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}

async function recognizeWishResourceValue(resourceName, templatePath, valueOffsetX, valueWidth) {
    const template = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync(templatePath),
        0, 0, 1920, 1080
    );
    template.Threshold = 0.72;
    template.InitTemplate();

    function matchWishNumber(gameRegion, x, y, width, height) {
        const digitTemplates = [];
        for (let digit = 0; digit <= 9; digit++) {
            digitTemplates[digit] = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`assets/祈愿资源数字含背景/${digit}.png`), x, y, width, height
            );
            // 数字模板保留了资源栏的彩色背景，使用三通道可减少灰度下 1/7、1/8 等误匹配。
            digitTemplates[digit].Use3Channels = true;
        }

        const candidates = [];
        // 使用保留资源栏背景的模板；从较严格阈值逐步放宽以适配不同场景。
        // 5、8 与 3 的轮廓容易互相误匹配，5/8 仅接受较高置信度的结果。
        for (const threshold of [0.9, 0.85, 0.8, 0.75, 0.7]) {
            for (let digit = 0; digit <= 9; digit++) {
                if ((digit === 5 || digit === 8) && threshold < 0.85) {
                    continue;
                }
                digitTemplates[digit].Threshold = threshold;
                digitTemplates[digit].InitTemplate();
                const matches = gameRegion.findMulti(digitTemplates[digit]);
                for (let i = 0; i < matches.count; i++) {
                    const box = matches[i];
                    candidates.push({
                        digit,
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height,
                        threshold
                    });
                }
            }
        }

        // 同一位置可能同时命中多个数字模板（例如 8 的局部轮廓命中 1）。
        // 去重前优先高阈值结果；阈值相同时优先保留更完整的大框。
        candidates.sort((a, b) => {
            const thresholdDiff = b.threshold - a.threshold;
            if (thresholdDiff !== 0) return thresholdDiff;
            return (b.width * b.height) - (a.width * a.height);
        });
        const adopted = [];
        for (const candidate of candidates) {
            const isDuplicate = adopted.some((item) => {
                const xOverlap = Math.max(0, Math.min(candidate.x + candidate.width, item.x + item.width) - Math.max(candidate.x, item.x));
                const yOverlap = Math.max(0, Math.min(candidate.y + candidate.height, item.y + item.height) - Math.max(candidate.y, item.y));
                const xOverlapRatio = xOverlap / Math.min(candidate.width, item.width);
                const yOverlapRatio = yOverlap / Math.min(candidate.height, item.height);
                // 含背景模板的相邻字符框会轻微重叠；只有主体区域高度重合才视为同一字符。
                return xOverlapRatio >= 0.5 && yOverlapRatio >= 0.6;
            });
            if (!isDuplicate) {
                adopted.push(candidate);
            }
        }
        adopted.sort((a, b) => a.x - b.x);
        return adopted.length > 0
            ? adopted.reduce((value, item) => value * 10 + item.digit, 0)
            : -1;
    }

    const readings = [];
    for (let attempt = 0; attempt < 3; attempt++) {
        const gameRegion = captureGameRegion();
        try {
            const iconResult = gameRegion.find(template);
            if (iconResult && iconResult.isExist()) {
                const value = matchWishNumber(
                    gameRegion,
                    iconResult.x + valueOffsetX,
                    Math.max(0, iconResult.y - 8),
                    valueWidth,
                    50
                );
                if (value >= 0) {
                    readings.push(value);
                }
            }
        } finally {
            gameRegion.dispose();
        }
        if (attempt < 2) await sleep(100);
    }

    for (const value of readings) {
        if (readings.filter(candidate => candidate === value).length >= 2) {
            if (!readings.every(candidate => candidate === value)) {
                log.warn(`${resourceName}多帧识别结果为 [${readings.join(', ')}]，采用多数结果 ${value}`);
            }
            return String(value);
        }
    }

    log.warn(`${resourceName}多帧识别未形成一致结果：[${readings.join(', ')}]`);
    return null;
}


    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    // 按下 F3 键
    keyPress("F3");
    await sleep(1500);

    let recognized = true;

    // 识别“常驻祈愿”图标
    let startTime = Date.now();
    let targetText = "奔行世间";
    let ocrRegion = { x: 349, y: 300, width: 326, height: 88 }; // 设置对应的识别区域
    let retryCount = 0; // 重试计数
    //先判断是否为常驻卡池
    try {

        let recognizedText = await recognizeTextInRegion(ocrRegion);
        if (!recognizedText) {
            log.warn("未能识别祈愿标题，已取消本次抽卡资源统计。");
            await genshin.returnMainUi();
            return;
        }
        log.info(`识别到的卡池为符为：${recognizedText}`);
        recognizedText = recognizedText.replace(/[^\u4e00-\u9fa5]/g, '')// 使用正则表达式匹配并保留中文字符
        if (targetText === recognizedText) {
            await sleep(100); // 短暂延迟，避免过快
            recognized = false;                ;
            await click(1845, 540);//尝试切换卡池
            await sleep(500); // 短暂延迟，避免过快
        } 
    } catch (error) {
        log.warn(`页面标志识别失败`);
    }
    //检验是否切换成功
    while (Date.now() - startTime < 6000 && !recognized) {
        try {
   
            let recognizedText = await recognizeTextInRegion(ocrRegion);
            log.info(`识别到的卡池为符为：${recognizedText}`);
            recognizedText = recognizedText.replace(/[^\u4e00-\u9fa5]/g, '')// 使用正则表达式匹配并保留中文字符
            if (targetText === recognizedText) {
                await click(1845, 540);//继续尝试切换卡池
            } else {
                log.info(`切换卡池成功`);
                recognized = true;
                break;
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`切换失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(1000); // 短暂延迟，避免过快循环
    }



    // 如果识别到了“常驻祈愿”图标，则识别“原石以及纠缠之缘到数值”
    if (recognized) {
        // 先定位资源图标，再按图标的相对位置读取数值，适配资源栏位置变化。
        let recognizedText1 = await recognizeWishResourceValue(
            "原石",
            "assets/WishResources/原石图标.png",
            40,
            78
        );
        let recognizedText2 = await recognizeWishResourceValue(
            "纠缠之缘",
            "assets/WishResources/纠缠之缘图标.png",
            42,
            65
        );

        const primogemsText = recognizedText1 ? recognizedText1.replace(/\D/g, '') : '';
        const intertwinedFateText = recognizedText2 ? recognizedText2.replace(/\D/g, '') : '';
        const primogems = /^\d+$/.test(primogemsText) ? Number(primogemsText) : null;
        const intertwinedFate = /^\d+$/.test(intertwinedFateText) ? Number(intertwinedFateText) : null;
        const records = [];
        const notificationParts = [];

        if (primogems !== null) {
            log.info(`提瓦特记事本-原石-${primogems}`);
            notificationParts.push(`原石-${primogems}`);
            if (shouldWriteLocalRecord("recordPrimogems")) {
                records.push(`提瓦特记事本-原石-${primogems}`);
            }
        } else {
            log.warn("未能识别原石数值。");
        }

        if (intertwinedFate !== null) {
            log.info(`提瓦特记事本-纠缠之缘-${intertwinedFate}`);
            notificationParts.push(`纠缠之缘-${intertwinedFate}`);
            if (shouldWriteLocalRecord("recordIntertwinedFate")) {
                records.push(`提瓦特记事本-纠缠之缘-${intertwinedFate}`);
            }
        } else {
            log.warn("未能识别纠缠之缘数值。");
        }

        if (primogems !== null && intertwinedFate !== null) {
            const wishTotalValue = intertwinedFate * 160 + primogems;
            const availablePulls = Math.floor(intertwinedFate + (primogems / 160));
            log.info(`提瓦特记事本-抽卡资源总价值-${wishTotalValue}`);
            log.info(`提瓦特记事本-可用抽数-${availablePulls}`);
            notificationParts.push(`可用抽数-${availablePulls}`);
            if (shouldWriteLocalRecord("recordWishTotalValue")) {
                records.push(`提瓦特记事本-抽卡资源总价值-${wishTotalValue}`);
            }
            if (shouldWriteLocalRecord("recordAvailablePulls")) {
                records.push(`提瓦特记事本-可用抽数-${availablePulls}`);
            }
        } else {
            log.warn("原石或纠缠之缘未识别，跳过抽卡资源总价值和可用抽数计算。");
        }

        if (notificationParts.length > 0) {
            sendNotebookNotification(notificationParts.join(" | "));
        }
        if (records.length > 0) {
            const result = file.WriteTextSync(unifiedRecordPath, `${records.join("\n")}\n`, true);
            if (result) {
                log.info("成功写入已选择的抽卡资源记录");
            } else {
                log.error("写入日志文件失败");
            }
        }
    } else {
        log.warn("未能识别到了“常驻祈愿”图标，跳过识别“原石以及纠缠之缘到数值”。");
    }
    await sleep(500); 
    await genshin.returnMainUi();

}

async function runMoraStats() {
// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
let CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CharacterMenu.png"), 60, 991, 38, 38);

// 定义一个函数用于识别图像
async function recognizeImage(recognitionObject, timeout = 5000) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const ro = captureGameRegion();
        try {
            const imageResult = ro.find(recognitionObject);
            if (imageResult && imageResult.isExist()) {
                // log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
                // log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
                return { success: true, x: imageResult.x, y: imageResult.y };
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        } finally {
            ro.dispose();
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别图像`);
    return { success: false };
}

// 定义一个函数用于识别文字并点击
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试 OCR 识别
            const ro = captureGameRegion();
            let resList = ro.findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)); // 指定识别区域
            ro.dispose();
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = res.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }

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
    log.warn(`经过多次尝试，仍然无法识别文字: ${targetText}`);
    return { success: false };
}

// 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 在指定区域进行 OCR 识别
            const ro = captureGameRegion();
            let ocrResult = ro.find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            ro.dispose();
            if (ocrResult) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = ocrResult.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }
                return correctedText; // 返回识别到的内容
            } else {
                log.warn(`OCR 识别区域未找到内容`);
                return null; // 如果 OCR 未识别到内容，返回 null
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 摩拉数识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}


    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
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

    // 如果识别到了“角色菜单”或“天赋”，则识别“摩拉数值”
    if (recognized) {
        let ocrRegionMora = { x: 1606, y: 28, width: 164, height: 40 }; // 设置对应的识别区域
        let recognizedText = await recognizeTextInRegion(ocrRegionMora);
        if (recognizedText) {
            const moraValue = recognizedText.replace(/\D/g, '');
            if (/^\d+$/.test(moraValue)) {
                log.info(`提瓦特记事本-摩拉-${moraValue}`);
                sendNotebookNotification(`摩拉-${moraValue}`);

                // 写入本地文件
                if (shouldWriteLocalRecord("recordMora")) {
                    const filePath = unifiedRecordPath;
                    const logContent = `提瓦特记事本-摩拉-${moraValue}\n`;
                    const result = file.WriteTextSync(filePath, logContent, true);
                    if (result) {
                        log.info("成功将摩拉数值写入日志文件");
                    } else {
                        log.error("写入日志文件失败");
                    }
                }
            } else {
                log.warn(`摩拉 OCR 结果不包含有效数字，已跳过通知和记录。原始结果：${recognizedText}`);
            }
        } else {
            log.warn("未能识别到摩拉数值。");
        }
    } else {
        log.warn("未能识别到角色菜单或天赋，跳过摩拉数值识别。");
    }
    await sleep(500); 
    await genshin.returnMainUi();

}

async function runCharacterExpBookStats() {
    const books = [
        { name: "大英雄的经验", templatePath: "assets/CharacterExpBooks/大英雄的经验.png", expPerBook: 20000 },
        { name: "冒险家的经验", templatePath: "assets/CharacterExpBooks/冒险家的经验.png", expPerBook: 5000 },
        { name: "流浪者的经验", templatePath: "assets/CharacterExpBooks/流浪者的经验.png", expPerBook: 1000 }
    ];

    async function closeExpiredItemPopup() {
        const gameRegion = captureGameRegion();
        try {
            const result = gameRegion.find(RecognitionObject.ocr(850, 273, 225, 51));
            if (typeof result?.text === "string" && result.text.includes("物品过期")) {
                log.info("检测到物品过期弹窗，正在关闭");
                await click(1000, 750);
                await sleep(1000);
            }
        } finally {
            gameRegion.dispose();
        }
    }

    function matchBookCountWithTemplates(gameRegion, x, y, width = 125, height = 35) {
        const templates = [];
        for (let digit = 0; digit <= 9; digit++) {
            templates[digit] = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`assets/背包数字/${digit}.png`), x, y, width, height
            );
        }

        const candidates = [];
        for (const threshold of [0.95, 0.9, 0.85, 0.8]) {
            for (let digit = 0; digit <= 9; digit++) {
                // “1”模板只有 5px 宽，对不同物品格的亚像素渲染较敏感；
                // 仅为“1”增加一档较低阈值，避免 310 被拼成 30。
                if (threshold < 0.85 && digit !== 1) {
                    continue;
                }
                templates[digit].Threshold = threshold;
                templates[digit].InitTemplate();
                const matches = gameRegion.findMulti(templates[digit]);
                for (let i = 0; i < matches.count; i++) {
                    const box = matches[i];
                    candidates.push({ digit, x: box.x, y: box.y, width: box.width, height: box.height });
                }
            }
        }

        candidates.sort((a, b) => a.x - b.x);
        const adopted = [];
        for (const candidate of candidates) {
            const isDuplicate = adopted.some((item) => {
                const xOverlap = Math.max(0, Math.min(candidate.x + candidate.width, item.x + item.width) - Math.max(candidate.x, item.x));
                const yOverlap = Math.max(0, Math.min(candidate.y + candidate.height, item.y + item.height) - Math.max(candidate.y, item.y));
                return xOverlap > 2 && yOverlap > 2;
            });
            if (!isDuplicate) {
                adopted.push(candidate);
            }
        }
        return adopted.length > 0
            ? adopted.reduce((value, item) => value * 10 + item.digit, 0)
            : -1;
    }

    async function recognizeBookCount(book) {
        const template = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(book.templatePath),
            0, 0, 1920, 1080
        );
        template.Threshold = 0.75;
        template.InitTemplate();
        let iconFound = false;

        for (let attempt = 0; attempt < 10; attempt++) {
            const gameRegion = captureGameRegion();
            try {
                const result = gameRegion.find(template);
                if (result && result.isExist()) {
                    iconFound = true;
                    const count = matchBookCountWithTemplates(
                        gameRegion,
                        Math.max(0, result.x - 15),
                        result.y + 112
                    );
                    if (count >= 0) {
                        log.info(`提瓦特记事本-${book.name}-${count}`);
                        return count;
                    }
                    log.warn(`${book.name}图标已找到，但数量模板匹配失败，正在重试...`);
                }
            } finally {
                gameRegion.dispose();
            }
            await sleep(100);
        }

        if (!iconFound) {
            log.info(`背包中没有${book.name}，数量按0统计。`);
            return 0;
        }

        log.error(`无法识别${book.name}数量，已取消本次经验书统计。`);
        return null;
    }

    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    keyPress("B");
    await sleep(1200);
    await closeExpiredItemPopup();
    await click(768, 45); // “养成道具”分页
    await sleep(1000);

    const bookCounts = {};
    let totalExp = 0;
    for (const book of books) {
        const count = await recognizeBookCount(book);
        if (count === null) {
            await genshin.returnMainUi();
            return;
        }
        bookCounts[book.name] = count;
        totalExp += count * book.expPerBook;
    }

    const records = [];
    if (shouldWriteLocalRecord("recordWanderersAdvice")) {
        records.push(`提瓦特记事本-流浪者的经验-${bookCounts["流浪者的经验"]}`);
    }
    if (shouldWriteLocalRecord("recordAdventurersExperience")) {
        records.push(`提瓦特记事本-冒险家的经验-${bookCounts["冒险家的经验"]}`);
    }
    if (shouldWriteLocalRecord("recordHerosWit")) {
        records.push(`提瓦特记事本-大英雄的经验-${bookCounts["大英雄的经验"]}`);
    }
    if (shouldWriteLocalRecord("recordCharacterExpTotal")) {
        records.push(`提瓦特记事本-经验书总经验-${totalExp}`);
    }

    if (records.length > 0) {
        const result = file.WriteTextSync(
            unifiedRecordPath,
            `${records.join("\n")}\n`,
            true
        );
        if (!result) {
            throw new Error("经验书统计写入记录失败");
        }
    }
    log.info(`提瓦特记事本-经验书总经验-${totalExp}`);
}

async function runArtifactExpStats() {
let notify = settings.notify
let account = settings.userName || "默认账户";
// 固定记录类型，仅用于写入圣遗物历史文件，不参与数据对比。
let countTimePoint = "提瓦特记事本";
    const shouldRecordSmallBottle = shouldWriteLocalRecord("recordSmallArtifactBottle");
    const shouldRecordBigBottle = shouldWriteLocalRecord("recordBigArtifactBottle");
    const shouldRecordTotalExp = shouldWriteLocalRecord("recordArtifactTotalExp");

    // 设置分辨率和缩放
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    keyPress("B");//打开背包
    await sleep(1000);
    // 关闭弹窗
    await close_expired_stuff_popup_window();
    let enterAttempts = 0;
    let enteredArtifactInventory = false;
    while (enterAttempts < 10) {
        await click(642,36);
        const foundDisassemble = await clickPNG("分解", false);
        if (foundDisassemble) {
            enteredArtifactInventory = true;
            break;
        }
        await sleep(750);
        enterAttempts++;
        await genshin.returnMainUi();
        await sleep(100);
        keyPress("B");
        await sleep(1000);
    }
    if (!enteredArtifactInventory) {
        log.error("无法进入圣遗物背包页面，已取消本次圣遗物经验统计，未写入记录。");
        await genshin.returnMainUi();
        return;
    }
    await clickPNG("时间顺序",true,1);
    await sleep(200);
    await clickPNG("筛选");
    await sleep(200);
    click(30, 30);
    await sleep(100);
    await clickPNG("重置");
    await sleep(200);
    await clickPNG("祝圣之霜定义");
    await sleep(200);
    await clickPNG("未装备");
    await sleep(200);
    await clickPNG("未锁定");
    await sleep(200);
    await clickPNG("确认");
    await sleep(200);
    click(30, 30);
    await sleep(100);
    const smallBottle = await getBottleCount('背包小瓶', 'assets/RecognitionObject/三星.png');
    const bigBottle = await getBottleCount('背包大瓶', 'assets/RecognitionObject/四星.png');
    await clickPNG("筛选");
    await sleep(200);
    click(30, 30);
    await sleep(100);
    await clickPNG("重置");
    await sleep(200);
    await clickPNG("确认");
    click(30, 30);
    await sleep(100);
    //点击分解
    await clickPNG("分解");
    await sleep(1000);
    // 识别已储存经验（1570-880-1650-930）
    const digits = await numberTemplateMatch("assets/已储存经验数字", 1573, 885, 74, 36);
    let initialValue = null;
    if (digits >= 0) {
        initialValue = digits;
        log.info(`已储存经验识别成功: ${initialValue}`);
    } else {
        log.warn(`已储存经验值识别失败`);
    }
    await clickPNG("快速选择");
    await sleep(500);
    // 识别不同星级狗粮数量
    const starPositions = [
        { star: 1, y: 130 },
        { star: 2, y: 200 },
        { star: 3, y: 270 },
        { star: 4, y: 340 }
    ];
    const starCounts = {};
    let starCountRecognitionFailed = false;
    for (const { star, y } of starPositions) {
        const count = await numberTemplateMatch("assets/选中狗粮数字", 570, y, 60, 50);
        if (count < 0) {
            log.warn(`在${star}星狗粮位置未识别到有效数字`);
            starCountRecognitionFailed = true;
        }else{
            starCounts[`star${star}`] = count;
            log.info(`${star}星狗粮识别到${count}个`);
        }
    }

    const failedComponents = [];
    if ((shouldRecordSmallBottle || shouldRecordTotalExp) && smallBottle === '') {
        failedComponents.push("小经验瓶");
    }
    if ((shouldRecordBigBottle || shouldRecordTotalExp) && bigBottle === '') {
        failedComponents.push("大经验瓶");
    }
    if (shouldRecordTotalExp && initialValue === null) failedComponents.push("已储存经验");
    if (shouldRecordTotalExp && starCountRecognitionFailed) failedComponents.push("狗粮星级数量");
    if (failedComponents.length > 0) {
        log.error(`圣遗物经验识别不完整（${failedComponents.join('、')}），已跳过本次聚合、记录和通知`);
        await genshin.returnMainUi();
        return;
    }
    const smallBottleCount = smallBottle === '' ? null : parseInt(smallBottle, 10);
    const bigBottleCount = bigBottle === '' ? null : parseInt(bigBottle, 10);
    let totalExp = null;
    if (shouldRecordTotalExp) {
        const expStars =
            starCounts.star1 * 420 +
            starCounts.star2 * 840 +
            starCounts.star3 * 1260 +
            starCounts.star4 * 2520;
        const expStock = smallBottleCount * 2500 + bigBottleCount * 10000 + initialValue;
        totalExp = expStars + expStock;
    }

    // 记录保存功能
    const userName = await getUserName();
    const recordPath = unifiedRecordPath;
    
    // 圣遗物数据合并为一条通知，避免通知数量过多。
    const messageParts = [];
    if (shouldRecordSmallBottle) messageParts.push(`小经验瓶-${smallBottleCount}`);
    if (shouldRecordBigBottle) messageParts.push(`大经验瓶-${bigBottleCount}`);
    if (shouldRecordTotalExp) messageParts.push(`圣遗物总经验-${await formatExp(totalExp)}`);
    
    // 只追加本次统计记录，不读取或对比历史数据
    const recordWritten = await updateRecord(
        recordPath,
        smallBottleCount,
        bigBottleCount,
        totalExp
    );
    if (!recordWritten) {
        throw new Error("圣遗物经验统计写入记录失败");
    }
    
    sendNotebookNotification(messageParts.join(' | '));
    if (shouldRecordSmallBottle) log.info(`提瓦特记事本-小经验瓶-${smallBottleCount}`);
    if (shouldRecordBigBottle) log.info(`提瓦特记事本-大经验瓶-${bigBottleCount}`);
    if (shouldRecordTotalExp) log.info(`提瓦特记事本-圣遗物总经验-${totalExp}`);
    await genshin.returnMainUi();

    // 格式化经验值显示
    async function formatExp(num) {
        if (num >= 10000) {
            // 直接除法并转换为字符串，保留所有有效小数
            return `${(num / 10000).toString()}万`;
        } else {
            return `${num}`;
        }
    }
     /**
     * 在指定区域内，用 0-9 的 PNG 模板做「多阈值 + 非极大抑制」数字识别，
     * 最终把检测到的数字按左右顺序拼成一个整数返回。
     *
     * @param {string}  numberPngFilePath - 存放 0.png ~ 9.png 的文件夹路径（不含文件名）
     * @param {number}  x                 - 待识别区域的左上角 x 坐标，默认 0
     * @param {number}  y                 - 待识别区域的左上角 y 坐标，默认 0
     * @param {number}  w                 - 待识别区域的宽度，默认 1920
     * @param {number}  h                 - 待识别区域的高度，默认 1080
     * @param {number}  maxThreshold      - 模板匹配起始阈值，默认 0.95（最高可信度）
     * @param {number}  minThreshold      - 模板匹配最低阈值，默认 0.8（最低可信度）
     * @param {number}  splitCount        - 在 maxThreshold 与 minThreshold 之间做几次等间隔阈值递减，默认 3
     * @param {number}  maxOverlap        - 非极大抑制时允许的最大重叠像素，默认 2；只要 x 或 y 方向重叠大于该值即视为重复框
     *
     * @returns {number} 识别出的整数；若没有任何有效数字框则返回 -1
     *
     * @example
     * const mora = await numberTemplateMatch('摩拉数字', 860, 70, 200, 40);
     * if (mora >= 0) console.log(`当前摩拉：${mora}`);
     */
    async function numberTemplateMatch(
        numberPngFilePath,
        x = 0, y = 0, w = 1920, h = 1080,
        maxThreshold = 0.95,
        minThreshold = 0.8,
        splitCount = 3,
        maxOverlap = 2
    ) {
        let ros = [];
        for (let i = 0; i <= 9; i++) {
            ros[i] = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`${numberPngFilePath}/${i}.png`), x, y, w, h);
        }

        function setThreshold(roArr, newThreshold) {
            for (let i = 0; i < roArr.length; i++) {
                roArr[i].Threshold = newThreshold;
                roArr[i].InitTemplate();
            }
        }

        const gameRegion = captureGameRegion();
        const allCandidates = [];

        try{
            /* 1. splitCount 次等间隔阈值递减 */
            for (let k = 0; k < splitCount; k++) {
                const curThr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
                setThreshold(ros, curThr);

                /* 2. 0-9 每个模板跑一遍，所有框都收 */
                for (let digit = 0; digit <= 9; digit++) {
                    const res = gameRegion.findMulti(ros[digit]);
                    if (res.count === 0) continue;

                    for (let i = 0; i < res.count; i++) {
                        const box = res[i];
                        allCandidates.push({
                            digit: digit,
                            x: box.x,
                            y: box.y,
                            w: box.width,
                            h: box.height,
                            thr: curThr
                        });
                    }
                }
            }
        } finally {
            gameRegion.dispose();
        }
        /* 3. 无结果提前返回 -1 */
        if (allCandidates.length === 0) {
            return -1;
        }

        /* 4. 非极大抑制（必须 x、y 两个方向重叠都 > maxOverlap 才视为重复） */
        const adopted = [];
        for (const c of allCandidates) {
            let overlap = false;
            for (const a of adopted) {
                const xOverlap = Math.max(0, Math.min(c.x + c.w, a.x + a.w) - Math.max(c.x, a.x));
                const yOverlap = Math.max(0, Math.min(c.y + c.h, a.y + a.h) - Math.max(c.y, a.y));
                if (xOverlap > maxOverlap && yOverlap > maxOverlap) {
                    overlap = true;
                    break;
                }
            }
            if (!overlap) {
                adopted.push(c);
                //log.info(`在 [${c.x},${c.y},${c.w},${c.h}] 找到数字 ${c.digit}，匹配阈值=${c.thr}`);
            }
        }

        /* 5. 按 x 排序，拼整数；仍无有效框时返回 -1 */
        if (adopted.length === 0) return -1;
        adopted.sort((a, b) => a.x - b.x);

        return adopted.reduce((num, item) => num * 10 + item.digit, 0);
    }

    async function clickPNG(png, doClick = true, maxAttempts = 40, Threshold = 0.9) {
        const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
        pngRo.Threshold = Threshold;
        pngRo.InitTemplate();
        return await findAndClick(pngRo, maxAttempts, doClick);
    }

    async function findAndClick(target, maxAttempts = 20, doClick) {
        //log.info("调试-开始检查");
        for (let i = 0; i < maxAttempts; i++) {
            //log.info("调试-检查一次");
            const rg = captureGameRegion();
            try {
                const res = rg.find(target);
                if (res.isExist()) { if (doClick) await sleep(16), res.click(), await sleep(50); return true; }
            } finally { rg.dispose(); }
            if (i < maxAttempts - 1) await sleep(50);
        }
        return false;
    }

    async function close_expired_stuff_popup_window() {
        const game_region = captureGameRegion();
        const text_x = 850;
        const text_y = 273;
        const text_w = 225;
        const text_h = 51;
        const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));
        if (ocr_res) {
            if (ocr_res.text.includes("物品过期")) {
                log.info("检测到物品过期");
                click(1000, 750);
                await sleep(1000);
            }
        }
        game_region.dispose();
    }
    /**
     * 识别背包中指定物品的数量
     * @param {string} itemName - 物品名称（仅用于日志）
     * @param {string} templatePath - 模板图片路径
     * @returns {Promise<string>} 识别到的数字字符串（可能为空）
     */
    async function getBottleCount(itemName, templatePath) {
        const ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(templatePath));
        ro.InitTemplate();
        for (let i = 0; i < 5; i++) {
            const rg = captureGameRegion();
            try {
                const res = rg.find(ro);
                if (res.isExist()) {
                    const regionToCheck = { x: res.x, y: res.y + 20, width: 70, height: 20 };
                    // 使用numberTemplateMatch函数识别数字
                    const count = await numberTemplateMatch(
                        'assets/背包数字', // 数字模板文件夹路径
                        regionToCheck.x, regionToCheck.y, regionToCheck.width, regionToCheck.height
                    );
                    const digits = count === -1 ? '' : count.toString();
                    log.info(`识别到${itemName}数量为${digits}`);
                    //log.info(`识别到${itemName}识别区域为${regionToCheck.x}, ${regionToCheck.y}, ${regionToCheck.width}, ${regionToCheck.height}`)
                    return digits; // 成功识别即返回
                }
            } finally {
                rg.dispose();
            }
            if (i < 5 - 1) await sleep(50);
        }
        log.info(`未找到${itemName}图标，确认库存数量为0`);
        return '0';
    }

    // 检验账户名
    async function getUserName() {
        account = account.trim();
        // 账户名规则：数字、中英文，长度1-20字符
        if (!account || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(account)) {
            log.error(`账户名${account}违规，暂时使用默认账户名，请查看readme后修改`)
            account = "默认账户";
        }
        return account;
    }

    /**
     * 获取本地记录中最新的一组数据
     * @param {string} filePath - 记录文件路径
     * @returns {Promise<object>} 包含经验数据的对象
     */
    async function getLocalData(filePath) {
        // 初始化返回结果
        const result = {
            initialValue: null,
            smallBottle: null,
            bigBottle: null,
            starCounts: {
                star1: null,
                star2: null,
                star3: null,
                star4: null
            },
            totalExp: null,
            countTimePoint: null,
            initialized: {
                initialValue: false,
                smallBottle: false,
                bigBottle: false,
                star1: false,
                star2: false,
                star3: false,
                star4: false,
                totalExp: false,
                countTimePoint: false
            }
        };

        try {
            // 尝试读取文件，不存在则直接返回空结果
            const content = await file.readText(filePath);
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) return result;

            // 数据匹配正则
            const initialValueRegex = /已储存经验-(\d+)/;
            const smallBottleRegex = /小经验瓶-(\d+)/;
            const bigBottleRegex = /大经验瓶-(\d+)/;
            const star1Regex = /1星狗粮-(\d+)/;
            const star2Regex = /2星狗粮-(\d+)/;
            const star3Regex = /3星狗粮-(\d+)/;
            const star4Regex = /4星狗粮-(\d+)/;
            const totalExpRegex = /总经验-(\d+)/;
            const countTimePointRegex = /统计时间点-(.+)/;

            // 遍历前几条记录，寻找最新的一组完整数据
            for (const line of lines) {
                // 匹配已储存经验
                if (!result.initialized.initialValue) {
                    const match = line.match(initialValueRegex);
                    if (match) {
                        result.initialValue = parseInt(match[1]);
                        result.initialized.initialValue = true;
                    }
                }

                // 匹配小经验瓶
                if (!result.initialized.smallBottle) {
                    const match = line.match(smallBottleRegex);
                    if (match) {
                        result.smallBottle = parseInt(match[1]);
                        result.initialized.smallBottle = true;
                    }
                }

                // 匹配大经验瓶
                if (!result.initialized.bigBottle) {
                    const match = line.match(bigBottleRegex);
                    if (match) {
                        result.bigBottle = parseInt(match[1]);
                        result.initialized.bigBottle = true;
                    }
                }

                // 匹配1星狗粮
                if (!result.initialized.star1) {
                    const match = line.match(star1Regex);
                    if (match) {
                        result.starCounts.star1 = parseInt(match[1]);
                        result.initialized.star1 = true;
                    }
                }

                // 匹配2星狗粮
                if (!result.initialized.star2) {
                    const match = line.match(star2Regex);
                    if (match) {
                        result.starCounts.star2 = parseInt(match[1]);
                        result.initialized.star2 = true;
                    }
                }

                // 匹配3星狗粮
                if (!result.initialized.star3) {
                    const match = line.match(star3Regex);
                    if (match) {
                        result.starCounts.star3 = parseInt(match[1]);
                        result.initialized.star3 = true;
                    }
                }

                // 匹配4星狗粮
                if (!result.initialized.star4) {
                    const match = line.match(star4Regex);
                    if (match) {
                        result.starCounts.star4 = parseInt(match[1]);
                        result.initialized.star4 = true;
                    }
                }

                // 匹配总经验
                if (!result.initialized.totalExp) {
                    const match = line.match(totalExpRegex);
                    if (match) {
                        result.totalExp = parseInt(match[1]);
                        result.initialized.totalExp = true;
                    }
                }

                // 匹配统计时间点
                if (!result.initialized.countTimePoint) {
                    const match = line.match(countTimePointRegex);
                    if (match) {
                        result.countTimePoint = match[1];
                        result.initialized.countTimePoint = true;
                    }
                }

                // 所有数据都找到，提前终止遍历
                if (result.initialized.initialValue && 
                    result.initialized.smallBottle && 
                    result.initialized.bigBottle && 
                    result.initialized.star1 && 
                    result.initialized.star2 && 
                    result.initialized.star3 && 
                    result.initialized.star4 &&
                    result.initialized.totalExp) {
                    break;
                }
            }
            
            // 兼容旧记录，没有统计时间点时默认设置为"未知"
            if (result.countTimePoint === null) {
                result.countTimePoint = "未知";
            }
            
            return result;
        } catch (error) {
            // 文件不存在或读取错误时返回空结果
            // 兼容旧记录，没有统计时间点时默认设置为"未知"
            if (result.countTimePoint === null) {
                result.countTimePoint = "未知";
            }
            return result;
        }
    }

    /**
     * 更新记录文件
     * @param {string} filePath - 记录文件路径
     * @param {number} smallBottle - 小经验瓶数量
     * @param {number} bigBottle - 大经验瓶数量
     * @param {number} totalExp - 总经验值
     */
    async function updateRecord(filePath, smallBottle, bigBottle, totalExp) {
        // 生成统一格式的记录
        const records = [];
        if (shouldWriteLocalRecord("recordSmallArtifactBottle")) {
            records.push(`提瓦特记事本-小经验瓶-${smallBottle}`);
        }
        if (shouldWriteLocalRecord("recordBigArtifactBottle")) {
            records.push(`提瓦特记事本-大经验瓶-${bigBottle}`);
        }
        if (shouldWriteLocalRecord("recordArtifactTotalExp")) {
            records.push(`提瓦特记事本-圣遗物总经验-${totalExp}`);
        }

        if (records.length === 0) {
            return true;
        }
        return file.WriteTextSync(filePath, `${records.join('\n')}\n`, true);
    }

}

function isCancellationError(error) {
    if (!error) {
        return false;
    }

    const detail = [error.name, error.message, String(error)]
        .filter(Boolean)
        .join(" ");
    return /TaskCanceledException|OperationCanceledException|AbortError|a task was canceled|operation (?:was )?cancel(?:l)?ed|操作已取消|任务已取消/i.test(detail);
}

async function runStatItem(name, enabled, task) {
    if (!enabled) {
        log.info(`已跳过：${name}`);
        return;
    }

    try {
        log.info(`开始：${name}`);
        await genshin.returnMainUi();
        await task();
        log.info(`完成：${name}`);
    } catch (error) {
        if (isCancellationError(error)) {
            throw error;
        }
        const detail = error && (error.stack || error.message)
            ? (error.stack || error.message)
            : String(error);
        log.error(`${name}失败：${detail}`);
    } finally {
        await genshin.returnMainUi();
        await sleep(500);
    }
}

(async function main() {
    setGameMetrics(1920, 1080, 1);
    if (getLocalRecordSelectionCount() > 0) {
        await beginRecordBatch();
    }

    await runStatItem(
        "抽卡资源",
        hasSelectedRecordItems("wishRecordItems"),
        runWishResourceStats
    );
    await runStatItem(
        "摩拉",
        hasSelectedRecordItems("moraRecordItems"),
        runMoraStats
    );
    await runStatItem(
        "角色经验书",
        hasSelectedRecordItems("characterExpRecordItems"),
        runCharacterExpBookStats
    );
    await runStatItem(
        "圣遗物经验",
        hasSelectedRecordItems("artifactRecordItems"),
        runArtifactExpStats
    );

    log.info("全部启用项目执行完毕");
})();
