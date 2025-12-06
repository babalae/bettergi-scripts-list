const oneStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/一星.png`), 46, 209, 1338 - 46, 831 - 209);
oneStarRo.Threshold = +settings.Threshold1 || 0.97;
//oneStarRo.Use3Channels = true;
oneStarRo.InitTemplate();

const twoStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/二星.png`), 46, 209, 1338 - 46, 831 - 209);
twoStarRo.Threshold = +settings.Threshold1 || 0.97;
//twoStarRo.Use3Channels = true;
twoStarRo.InitTemplate();

const threeStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/三星.png`), 46, 209, 1338 - 46, 831 - 209);
threeStarRo.Threshold = +settings.Threshold1 || 0.97;
//threeStarRo.Use3Channels = true;
threeStarRo.InitTemplate();

const fourStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/四星.png`), 46, 209, 1338 - 46, 831 - 209);
fourStarRo.Threshold = +settings.Threshold1 || 0.97;
//fourStarRo.Use3Channels = true;
fourStarRo.InitTemplate();

let pngRo1;
let pngRo2;

let bigBottleCount = 0;
let smallBottleCount = 0;
let oneStarCount = 0;
let twoStarCount = 0;
let threeStarCount = 0;
let fourStarCount = 0;
let temponeStarCount = 0;
let temptwoStarCount = 0;
let tempthreeStarCount = 0;
let tempfourStarCount = 0;

// 全局：记录上次点击的星级索引（0-3 对应 1-4 星）
let lastStarIndex = 0;

let rg;

(async function () {
    //先回到主界面
    await genshin.returnMainUi();
    //await genshin.tpToStatueOfTheSeven();
    keyPress("B");
    //切换到圣遗物界面

    await clickPNG("狗粮界面");

    if (settings.autoSwitchCount) {
        log.info(`填写了临界小瓶数量为${(+settings.autoSwitchCount)},开始识别`);

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
        {
            const smallBottleRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/背包小瓶.png`));
            smallBottleRo.InitTemplate();
            for (let i = 0; i < 5; i++) {
                const rg = captureGameRegion();
                try {
                    const res = rg.find(smallBottleRo);
                    if (res.isExist()) {
                        const regionToCheck = { x: res.x, y: res.y + 110, width: 122, height: 30 };
                        const raw = await recognizeTextInRegion(regionToCheck);

                        // 只保留数字
                        const digits = (raw || '').replace(/\D/g, '');
                        log.info(`识别到小瓶数量为${digits}`);
                        if ((+digits) > settings.autoSwitchCount) {
                            settings.bottleType = "只要大瓶";
                        } else {
                            settings.bottleType = "只要小瓶";
                        }
                        log.info(`当前分解模式为${settings.bottleType}`);
                        break;
                    }
                } finally { rg.dispose(); }
                if (i < 5 - 1) await sleep(50);
            }
        }
    }

    if (settings.bottleType != "只要小瓶") {
        pngRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo1.Threshold = 0.995;
        pngRo1.Use3Channels = true;
        pngRo1.InitTemplate();

        pngRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶和小瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo2.Threshold = 0.995;
        pngRo2.Use3Channels = true;
        pngRo2.InitTemplate();
    } else {
        pngRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/三个小瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo1.Threshold = 0.995;
        pngRo1.Use3Channels = true;
        pngRo1.InitTemplate();

        pngRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo2.Threshold = 0.995;
        pngRo2.Use3Channels = true;
        pngRo2.InitTemplate();
    }

    //点击分解
    await clickPNG("分解");
    await sleep(500);
    await clickPNG("分解筛选");
    await sleep(200);
    await clickPNG("分解未锁定");
    await clickPNG("分解确认");
    //点击倒序
    await clickPNG("倒序");
    rg = captureGameRegion();
    while (true) {
        let foundBigBottle = false;
        while (true) {
            try {
                await sleep(1)
            } catch (error) {
                log.info(`分解时出现错误${error.message}`);
                break;
            }
            rg.dispose();
            rg = captureGameRegion();
            try {

                const bigRes = rg.find(pngRo1);
                if (bigRes.isExist()) {
                    foundBigBottle = true;
                    if (settings.bottleType === "只要大瓶") {
                        bigBottleCount++;
                    } else {
                        smallBottleCount += 3;
                    }
                    break;
                }

                const smallRes = rg.find(pngRo2);
                if (smallRes.isExist()) {
                    foundBigBottle = true;
                    if (settings.bottleType === "只要大瓶") {
                        bigBottleCount++;
                        smallBottleCount++;
                    } else {
                        bigBottleCount++;
                    }
                    break;
                }
            } finally {
            }
            let time1 = new Date();
            if (!await selectOneAritfact()) {
                log.info("所有指定星级选择后不足以分解出大瓶");
                break;
            }
            //log.info(`调试-用时${new Date() - time1}`);
        }
        if (foundBigBottle) {
            log.info("成功选出分解所需狗粮");
        } else {
            log.info("结束分解");
            break;
        }
        oneStarCount += temponeStarCount;
        temponeStarCount = 0;
        twoStarCount += temptwoStarCount;
        temptwoStarCount = 0;
        threeStarCount += tempthreeStarCount;
        tempthreeStarCount = 0;
        fourStarCount += tempfourStarCount;
        tempfourStarCount = 0;

        await clickPNG("执行分解");
        await clickPNG("进行分解");
        await sleep(700);
        click(30, 30);
        await sleep(300);
    }

    await genshin.returnMainUi();

    const parts = ['分解了'];
    if (oneStarCount > 0) parts.push(`${oneStarCount}个一星，`);
    if (twoStarCount > 0) parts.push(`${twoStarCount}个二星，`);
    if (threeStarCount > 0) parts.push(`${threeStarCount}个三星，`);
    if (fourStarCount > 0) parts.push(`${fourStarCount}个四星，`);

    parts.push('获得');
    if (bigBottleCount > 0) parts.push(`${bigBottleCount}个大瓶`);
    if (smallBottleCount > 0) {
        if (bigBottleCount > 0) parts.push('，');
        parts.push(`${smallBottleCount}个小瓶`);
    }

    if (parts.length > 2) {
        log.info(parts.join(''));
    } else {
        log.info('没有分解任何物品。');
    }


})();

async function selectOneAritfact() {
    // 顺序数组，从上次索引开始循环
    const order = [0, 1, 2, 3].map(i => (i + lastStarIndex) % 4);

    for (const idx of order) {
        let res;
        switch (idx) {
            case 0:
                if (+settings.maxStar >= 1) {
                    res = rg.find(oneStarRo);
                    if (res.isExist()) {
                        log.info("点击一星");
                        temponeStarCount++;
                        res.click();
                        lastStarIndex = 0;   // 下次从一星开始
                        return true;
                    }
                }
                break;
            case 1:
                if (+settings.maxStar >= 2) {
                    res = rg.find(twoStarRo);
                    if (res.isExist()) {
                        log.info("点击二星");
                        temptwoStarCount++;
                        res.click();
                        lastStarIndex = 1;
                        return true;
                    }
                }
                break;
            case 2:
                if (+settings.maxStar >= 3) {
                    res = rg.find(threeStarRo);
                    if (res.isExist()) {
                        log.info("点击三星");
                        tempthreeStarCount++;
                        res.click();
                        lastStarIndex = 2;
                        return true;
                    }
                }
                break;
            case 3:
                if (+settings.maxStar >= 4) {
                    res = rg.find(fourStarRo);
                    if (res.isExist()) {
                        log.info("点击四星");
                        tempfourStarCount++;
                        res.click();
                        lastStarIndex = 3;   // 下次从四星开始
                        return true;
                    }
                }
                break;
        }
    }
    return false;
}

async function clickPNG(png, maxAttempts = 40, Threshold = 0.9) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = Threshold;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, maxAttempts);
}

async function findAndClick(target, maxAttempts = 20) {
    //log.info("调试-开始检查");
    for (let i = 0; i < maxAttempts; i++) {
        //log.info("调试-检查一次");
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { await sleep(16); res.click(); return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(50);
    }
    return false;
}

async function findPNG(png, maxAttempts = 20) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.9;
    pngRo.InitTemplate();
    return await findWithoutClick(pngRo, maxAttempts);
}

async function findWithoutClick(target, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(50);
    }
    return false;
}

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
        await sleep(200);
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}