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

const bigPngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
bigPngRo.Threshold = 0.995;
bigPngRo.Use3Channels = true;
bigPngRo.InitTemplate();

const smallPngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶和小瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
smallPngRo.Threshold = 0.995;
smallPngRo.Use3Channels = true;
smallPngRo.InitTemplate();

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

    //点击分解
    await clickPNG("分解");
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

                const bigRes = rg.find(bigPngRo);
                if (bigRes.isExist()) {
                    foundBigBottle = true;
                    bigBottleCount++;
                    break;
                }

                const smallRes = rg.find(smallPngRo);
                if (smallRes.isExist()) {
                    foundBigBottle = true;
                    bigBottleCount++;
                    smallBottleCount++;
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
            log.info("成功选出分解大瓶所需狗粮");
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

async function clickPNG(png, maxAttempts = 20, Threshold = 0.9) {
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
            if (res.isExist()) { res.click(); return true; }
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