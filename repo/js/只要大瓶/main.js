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

    await findAndClick(["assets/RecognitionObject/狗粮界面1.png", "assets/RecognitionObject/狗粮界面2.png"]);

    if (settings.autoSwitchCount) {
        log.info(`填写了临界小瓶数量为${(+settings.autoSwitchCount)},开始识别`);

        await findAndClick("assets/RecognitionObject/筛选.png");
        await sleep(200);
        click(30, 30);
        await sleep(100);
        await findAndClick("assets/RecognitionObject/重置.png");
        await sleep(200);
        await findAndClick("assets/RecognitionObject/祝圣之霜定义.png");
        await sleep(200);
        await findAndClick("assets/RecognitionObject/未装备.png");
        await sleep(200);
        await findAndClick("assets/RecognitionObject/未锁定.png");
        await sleep(200);
        await findAndClick("assets/RecognitionObject/确认.png");
        await sleep(200);
        click(30, 30);
        await sleep(100);
        {
            const smallBottleRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/背包小瓶.png`));
            const bigBottleRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/背包大瓶.png`));
            smallBottleRo.InitTemplate();
            let digitsSmall = -1;
            let digitsBig = -1;
            for (let i = 0; i < 5; i++) {
                if (digitsSmall >= 0) {
                    break;
                }
                const rg = captureGameRegion();
                try {
                    const res = rg.find(smallBottleRo);

                    if (res.isExist()) {
                        digitsSmall = await numberTemplateMatch("assets/背包物品数字", res.x, res.y + 110, 122, 30);
                        log.info(`识别到小瓶数量为${digitsSmall}`);
                    }

                } finally { rg.dispose(); }
                if (i < 5 - 1) await sleep(50);
            }
            if (digitsSmall < 0) {
                log.info(`未识别到小瓶数量，视为0`);
                digitsSmall = 0;
            }
            if (digitsSmall >= settings.autoSwitchCount) {
                settings.bottleType = "只要大瓶";
            } else {
                settings.bottleType = "只要小瓶";
            }
            log.info(`当前分解模式为${settings.bottleType}`);
            if (settings.recognizeBig) {
                //点击小瓶防止大瓶图标闪烁
                await findAndClick("assets/RecognitionObject/背包小瓶.png");
                await sleep(300);

                for (let i = 0; i < 5; i++) {
                    if (digitsBig >= 0) {
                        break;
                    }
                    const rg = captureGameRegion();
                    try {
                        const res = rg.find(bigBottleRo);

                        if (res.isExist()) {
                            digitsBig = await numberTemplateMatch("assets/背包物品数字", res.x, res.y + 110, 122, 30);
                            log.info(`识别到大瓶，数量为${digitsBig}`);
                        }

                    } finally { rg.dispose(); }
                    if (i < 5 - 1) await sleep(50);
                }
                if (digitsBig < 0) {
                    log.info(`未识别到大瓶数量，视为0`);
                    digitsBig = 0;
                }
                notification.send(`当前背包大瓶数量为${digitsBig}，小瓶数量为${digitsSmall}`);
            }
        }
    }

    if (settings.bottleType != "只要小瓶") {
        pngRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo1.Threshold = +settings.Threshold2 || 0.99;
        pngRo1.Use3Channels = true;
        pngRo1.InitTemplate();

        pngRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶和小瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo2.Threshold = +settings.Threshold2 || 0.99;
        pngRo2.Use3Channels = true;
        pngRo2.InitTemplate();
    } else {
        pngRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/三个小瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo1.Threshold = +settings.Threshold2 || 0.99;
        pngRo1.Use3Channels = true;
        pngRo1.InitTemplate();

        pngRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/大瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo2.Threshold = +settings.Threshold2 || 0.99;
        pngRo2.Use3Channels = true;
        pngRo2.InitTemplate();
    }

    //点击分解
    await findAndClick("assets/RecognitionObject/分解.png");
    await sleep(500);
    await findAndClick("assets/RecognitionObject/分解筛选.png");
    await sleep(200);
    await findAndClick("assets/RecognitionObject/分解未锁定.png");
    await findAndClick("assets/RecognitionObject/分解确认.png");
    //点击倒序
    await findAndClick("assets/RecognitionObject/倒序.png");
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
            if (!await selectOneAritfact()) {
                log.info("所有指定星级选择后不足以分解出目标");
                break;
            }
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

        await findAndClick("assets/RecognitionObject/执行分解.png");
        await findAndClick("assets/RecognitionObject/进行分解.png");
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
        notification.send(parts.join(''));
    } else {
        log.info('没有分解任何物品。');
        notification.send('没有分解任何物品。');
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

/**
 * 通用找图/找RO并可选点击（支持单图片文件路径、单RO、图片文件路径数组、RO数组）
 * @param {string|string[]|RecognitionObject|RecognitionObject[]} target
 * @param {boolean}  [doClick=true]                是否点击
 * @param {number}   [timeout=3000]                识别时间上限（ms）
 * @param {number}   [interval=50]                 识别间隔（ms）
 * @param {number}   [retType=0]                   0-返回布尔；1-返回 Region 结果
 * @param {number}   [preClickDelay=50]            点击前等待
 * @param {number}   [postClickDelay=50]           点击后等待
 * @returns {boolean|Region}  根据 retType 返回是否成功或最终 Region
 */
async function findAndClick(target,
    doClick = true,
    timeout = 3000,
    interval = 50,
    retType = 0,
    preClickDelay = 16,
    postClickDelay = 16) {
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
    minThreshold = 0.87,
    splitCount = 10,
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
    gameRegion.dispose();

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