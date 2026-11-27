(async function () {
    setGameMetrics(1920, 1080, 1);
    await canCanNeed();
})();

async function canCanNeed() {
    let tryTimes = 0;
    let moraRes = -1;
    let primogemRes = -1;
    let pinkRes = -1;
    let blueRes = -1;
    while ((tryTimes < 2) && ((moraRes < 0) || (primogemRes < 0) || (pinkRes <= 0 && settings.pink) || (blueRes <= 0 && settings.blue))) {
        await genshin.returnMainUi();
        await sleep(100);
        keyPress("B");

        await sleep(1000);
        //切换到贵重物品
        const gzwpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/贵重物品.png"));
        const gzwpRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/贵重物品2.png"));
        let trys = 0;
        while (trys < 10) {
            trys++
            let res1 = await findAndClick(gzwpRo, 1);
            let res2 = await findAndClick(gzwpRo2, 2);
            if (res1 || res2) {
                break;
            }
        }
        await sleep(1000);
        if (moraRes < 0) {
            const moraRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/mora.png"), 0, 970, 600, 1080 - 970);
            const gameRegion = captureGameRegion();
            let moraX = 336;
            let moraY = 1004;
            try {
                const result = gameRegion.find(moraRo);
                if (result.isExist()) {
                    moraX = result.x;
                    moraY = result.y;
                }
            } catch (err) {
            } finally {
                gameRegion.dispose();
            }
            let attempts = 0;
            while (moraRes < 0 && attempts < 5) {
                attempts++;
                moraRes = await numberTemplateMatch("assets/背包摩拉数字", moraX, moraY, 300, 40, 0.95, 0.85, 10);
            }
            if (moraRes >= 0) {
                log.info(`成功识别到摩拉数值: ${moraRes}`);
            } else {
                log.warn("未能识别到摩拉数值。");
            }
        }
        if (primogemRes < 0) {
            const primogemRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/原石.png"), 0, 970, 600, 1080 - 970);
            const plusRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/加号.png"), 0, 970, 600, 1080 - 970);
            const gameRegion = captureGameRegion();
            let primogemX = 152;
            let primogemY = 1007;
            let plusX = 262;
            let plusY = 1007;
            try {
                const result = gameRegion.find(primogemRo);
                if (result.isExist()) {
                    primogemX = result.x;
                    primogemY = result.y;
                }
            } catch (err) { }

            try {
                const result = gameRegion.find(plusRo);
                if (result.isExist()) {
                    plusX = result.x;
                    plusY = result.y;
                }
            } catch (err) {
            } finally {
                gameRegion.dispose();
            }

            let attempts = 0;
            while (primogemRes < 0 && attempts < 5) {
                attempts++;
                primogemRes = await numberTemplateMatch("assets/背包摩拉数字", primogemX + 28, primogemY, plusX - primogemX, 40, 0.95, 0.85, 10);
            }
            if (primogemRes >= 0) {
                log.info(`成功识别到原石数值: ${primogemRes}`);

            } else {
                log.warn("未能识别到原石数值。");
            }
        }
        if (pinkRes <= 0 && settings.pink) {
            const pinkRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/纠缠之缘.png"));
            pinkRo.Use3Channels = true;
            pinkRo.Threshold = 0.85;
            pinkRo.InitTemplate();
            const gameRegion = captureGameRegion();
            let pinkX = 0;
            let pinkY = 0;
            try {
                const result = gameRegion.find(pinkRo);
                if (result.isExist()) {
                    pinkX = result.x;
                    pinkY = result.y;
                    log.info(`在${pinkX},${pinkY}找到了纠缠之缘`);
                    let attempts = 0;
                    while (pinkRes < 0 && attempts < 3) {
                        attempts++;
                        pinkRes = await numberTemplateMatch("assets/背包物品数字", pinkX, pinkY + 97, 124, 26, 0.95, 0.8, 5);
                    }
                    if (pinkRes >= 0) {
                        log.info(`成功识别到纠缠之缘数量: ${pinkRes}`);
                    } else {
                        log.warn("未能识别到纠缠之缘数量。");
                    }
                } else {
                    pinkRes = 0;
                    log.info("未找到纠缠之缘");
                }
            } catch (err) {
            } finally {
                gameRegion.dispose();
            }

        }
        if (blueRes <= 0 && settings.blue) {
            const blueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/相遇之缘.png"));
            blueRo.Use3Channels = true;
            blueRo.Threshold = 0.85;
            blueRo.InitTemplate();
            const gameRegion = captureGameRegion();
            let blueX = 0;
            let blueY = 0;
            try {
                const result = gameRegion.find(blueRo);
                if (result.isExist()) {
                    blueX = result.x;
                    blueY = result.y;
                    log.info(`在${blueX},${blueY}找到了相遇之缘`);
                    let attempts = 0;
                    while (blueRes < 0 && attempts < 5) {
                        attempts++;
                        blueRes = await numberTemplateMatch("assets/背包物品数字", blueX, blueY + 97, 124, 26, 0.95, 0.8, 5);
                    }
                    if (blueRes >= 0) {
                        log.info(`成功识别到相遇之缘数量: ${blueRes}`);
                    } else {
                        log.warn("未能识别到相遇之缘数量。");
                    }
                } else {
                    blueRes = 0;
                    log.info("未找到相遇之缘");
                }
            } catch (err) {
            } finally {
                gameRegion.dispose();
            }

        }
        await sleep(500);
        tryTimes++;
    }
    let logInfo = `当前贵重物品如图识别结果为:\n摩拉：${moraRes}\n原石：${primogemRes}`;
    if (settings.pink) {
        logInfo += `\n纠缠之缘：${pinkRes}`;
    }
    if (settings.blue) {
        logInfo += `\n相遇之缘：${blueRes}`;
    }
    if (settings.accountName) {
        logInfo = `当前账户：${settings.accountName}\n` + logInfo;
    }
    log.info(logInfo)
    notification.Send(logInfo);
    return;
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

async function findAndClick(target, maxAttempts = 20) {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const gameRegion = captureGameRegion();
        try {
            const result = gameRegion.find(target);
            if (result.isExist) {
                await sleep(50);
                result.click();
                await sleep(50);
                return true;                 // 成功立刻返回
            }
            log.warn(`识别失败，第 ${attempts + 1} 次重试`);
        } catch (err) {
        } finally {
            gameRegion.dispose();
        }
        if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
            await sleep(250);
        }
    }
    return false;
}
