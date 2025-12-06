async function autoNavigateToReward() {
    try {
        // 定义识别对象
        const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/box.png"));

        let advanceNum = 0;//前进次数
        //调整为俯视视野
        middleButtonClick();
        await sleep(800);
        moveMouseBy(0, 1030);
        await sleep(400);
        moveMouseBy(0, 920);
        await sleep(400);
        moveMouseBy(0, 710);
        log.info("开始领奖");
        while (true) {
            // 1. 优先检查是否已到达领奖点
            let captureRegion = captureGameRegion();
            let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
            let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
            captureRegion.dispose();
            rewardTextArea.Dispose();
            // 检测到特点文字则结束！！！
            if (rewardResult.text == "接触征讨之花") {
                log.info("已到达领奖点，检测到文字: " + rewardResult.text);
                return;
            }
            else if (advanceNum > 40) {
                throw new Error('前进时间超时');
            }
            // 2. 未到达领奖点，则调整视野
            for (let i = 0; i < 100; i++) {
                captureRegion = captureGameRegion();
                let iconRes = captureRegion.Find(boxIconRo);
                let climbTextArea = captureRegion.DeriveCrop(1686, 1030, 60, 23);
                let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
                captureRegion.dispose();
                climbTextArea.Dispose();
                // 检查是否处于攀爬状态
                if (climbResult.text.toLowerCase() === "space") {
                    log.info("检侧进入攀爬状态，尝试脱离");
                    keyPress("x");
                    await sleep(1000);
                    keyDown("a");
                    await sleep(800);
                    keyUp("a");
                    keyDown("w");
                    await sleep(800);
                    keyUp("w");
                }
                if (iconRes.isEmpty()) {
                    log.warn("未找到宝箱图标，重试");
                    moveMouseBy(200, 0);
                    await sleep(500);
                    continue;
                }
                else if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {
                    advanceNum++;
                    log.info(`视野已调正，前进第${advanceNum}次`);
                    break;
                } else {
                    // 小幅度调整
                    if (iconRes.y >= 520) moveMouseBy(0, 920);
                    let adjustAmount = iconRes.x < 920 ? -20 : 20;
                    let distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
                    let scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
                    let adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
                    moveMouseBy(adjustAmount * adjustAmount2, 0);
                    await sleep(100);
                }
                if (i > 50) throw new Error('视野调整超时');
            }
            // 3. 前进一小步
            keyDown("w");
            await sleep(500);
            keyUp("w");
            await sleep(200); // 等待角色移动稳定
        }
    } catch (error) {
        log.error(`自动寻路到奖励失败，error: ${error}`);
        throw error;
    }
}

async function takeReward(isInsufficientResin) {
    try {
        const mainUiRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/mainUi.png"));
        for (let attempt = 1; attempt <= 100; attempt++) {
            log.debug(`尝试领取奖励，第${attempt}次`);
            let captureRegion = captureGameRegion();

            // 点击F领取Boss地脉花
            log.debug("尝试接触征讨之花");
            let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
            let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
            rewardTextArea.dispose();
            if (rewardResult.text === "接触征讨之花" && isInsufficientResin == false) {
                keyPress("F");
                await sleep(1000);
                captureRegion.dispose();
                captureRegion = captureGameRegion();
            }

            // 使用脆弱树脂领取奖励
            let useTextArea = captureRegion.DeriveCrop(850, 740, 250, 35);
            let useResult = useTextArea.find(RecognitionObject.ocrThis);
            useTextArea.dispose();
            log.debug("领取奖励检测到文字: " + useResult.text);
            if (useResult.text.includes("补充")) {
                log.info("脆弱树脂不足，跳过领取");
                click(1345, 300);
                await sleep(1000);
                captureRegion.dispose();
                captureRegion = captureGameRegion();
                isInsufficientResin = true;
            }
            else if (useResult.text.includes("使用"))  {
                log.info("使用脆弱树脂领取奖励");
                click(useResult.x, useResult.y);
                captureRegion.dispose();
                captureRegion = captureGameRegion();
                await sleep(3000);
            }

            // 关闭奖励界面
            let closeRewardUi = captureRegion.DeriveCrop(860, 970, 200, 28);
            let closeResult = closeRewardUi.find(RecognitionObject.ocrThis);
            closeRewardUi.dispose();
            log.debug("底部检测到文字: " + closeResult.text);
            if (closeResult.text.includes("点击")){
                click(975, 1000);//点击空白区域
                await sleep(1000);
                captureRegion.dispose();
                captureRegion = captureGameRegion();
            }

            // 检查是否回到主界面
            let inMainUi = captureRegion.Find(mainUiRo);
            if (inMainUi.x > 0 && !useResult.text.includes("树脂")) {
                log.debug("回到主界面");
                captureRegion.dispose();
                return isInsufficientResin;
            }
            captureRegion.dispose();
            rewardTextArea.Dispose();
            useTextArea.Dispose();
            closeRewardUi.Dispose();
            await sleep(500);

        }
        throw new Error('领取奖励超时');
    } catch (error) {
        log.error(`领取奖励失败: ${error}`);
    }

}