(async function () {
    // 1. 设置游戏分辨率
    setGameMetrics(1920, 1080, 1);
    log.info("已设置游戏分辨率：1920x1080");

    // 2. 返回主界面
    await genshin.returnMainUi();
    log.info("已返回主界面");

    // 3. 切换队伍
    if (settings.switchPartyName) {
        await genshin.switchParty(settings.switchPartyName);
    }

    // 4. 刷取循环
    const maxAttempts = settings.loopTimes || 15;
    let successCount = 0;
    let attemptCount = 0;

    // 定义识别对象（使用相对路径）
    const enterDungeonRo = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/images/华池岩岫.png")
    );

    const soloChallengeRo = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/images/单人挑战.png")
    );

    const startChallengeRo = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/images/开始挑战.png")
    );

    const leylineDisorderRo = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/images/地脉异常.png")
    );

    const activateRo = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/images/启动.png")
    );

    // OCR对象用于检测战斗文本
    const ocrRo2 = RecognitionObject.Ocr(0, 0, genshin.width, genshin.height);

    // 封装识别图片并点击的函数
    async function findAndClick(ro, maxRetries = 2, retryInterval = 1000, timeout = null) {
        let retryCount = 0;
        const startTime = Date.now();

        while (retryCount < maxRetries && (timeout === null || Date.now() - startTime < timeout)) {
            const capture = captureGameRegion();
            const result = capture.find(ro);

            if (!result.isEmpty()) {
                result.click();
                await sleep(30);
                result.click();
                return true;
            }

            retryCount++;
            await sleep(retryInterval);
        }

        return false;
    }

    while (attemptCount < maxAttempts) {
        attemptCount++;
        log.info(`开始第 ${attemptCount}/${maxAttempts} 次挑战`);

        let stepSuccess = false;

        // a. 传送至点位
        await genshin.tp("1436.2861328125", "1289.95556640625");
        log.info("已传送至目标点位");
        await sleep(2000);

        // b. 前进并检测"华池岩岫"
        keyDown("w");
        const enterDungeonTimeout = 3000;
        const enterDungeonStartTime = Date.now();
        let foundEnterDungeon = false;

        while (Date.now() - enterDungeonStartTime < enterDungeonTimeout) {
            const capture = captureGameRegion();
            const result = capture.find(enterDungeonRo);

            if (!result.isEmpty()) {
                foundEnterDungeon = true;
                break;
            }
            await sleep(100);
        }

        keyUp("w");

        if (!foundEnterDungeon) {
            log.warn("未找到'进入秘境'，重试中...");
            await genshin.returnMainUi();
            continue;
        }

        log.info("已找到'进入秘境'");
        await sleep(500);

        // c. 按F键并检测"单人挑战"
        keyPress("f");
        await sleep(5000);

        const foundSoloChallenge = await findAndClick(soloChallengeRo);
        if (!foundSoloChallenge) {
            log.error("未找到'单人挑战'，终止脚本");
            break;
        }

        log.info("已找到'单人挑战'");
        await sleep(2000);

        // d. 检测"开始挑战"
        const foundStartChallenge = await findAndClick(startChallengeRo, 2, 3000);
        if (!foundStartChallenge) {
            log.error("未找到'开始挑战'，终止脚本");
            break;
        }

        log.info("已找到'开始挑战'");
        await sleep(3000);

        // e. 检测"地脉异常"
        const leylineDisorderTimeout = 120000;
        const foundLeylineDisorder = await findAndClick(leylineDisorderRo, 999, 1000, leylineDisorderTimeout);
        if (!foundLeylineDisorder) {
            log.error("未找到'地脉异常'，超时终止");
            break;
        }

        log.info("已找到'地脉异常'");
        await sleep(1000);

        // f. 前进并检测"启动"
        keyDown("w");
        const activateTimeout = 10000;
        const foundActivate = await findAndClick(activateRo, 999, 100, activateTimeout);
        keyUp("w");

        if (!foundActivate) {
            log.error("未找到'启动'，超时终止");
            break;
        }

        log.info("已找到'启动'");
        keyPress("f");
        await sleep(1000);

        // g. 开始自动战斗
        log.info("开始自动战斗");
        const fightResult = await autoFight(120000); // 120秒战斗超时

        if (fightResult) {
            successCount++;
            log.info(`战斗成功！当前完成 ${successCount} 次`);
        } else {
            log.error("战斗失败，终止脚本");
            break;
        }
    }

    await genshin.tp("1436.2861328125", "1289.95556640625");
    log.info(`脚本结束。成功完成 ${successCount}/${attemptCount} 次挑战`);

    // 自动战斗函数
    async function autoFight(timeout) {
        const cts = new CancellationTokenSource();
        dispatcher.runTask(new SoloTask("AutoFight"), cts);

        const startTime = Date.now();
        let fightResult = false;

        while (Date.now() - startTime < timeout) {
            if (recognizeFightText(captureGameRegion())) {
                fightResult = true;
                break;
            }
            await sleep(1000);
        }

        cts.cancel();
        return fightResult;
    }

    // 战斗文本识别函数
    function recognizeFightText(captureRegion) {
        try {
            const result = captureRegion.find(ocrRo2);
            const text = result.text;
            const keywords = ["挑战成功", "达成", "挑战达成"];

            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            log.error("OCR识别出错: {0}", error);
            return false;
        }
    }
})();