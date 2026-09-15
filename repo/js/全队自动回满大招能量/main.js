(async function () {

    //检测传送结束  await tpEndDetection();
    async function tpEndDetection() {
        const region1 = RecognitionObject.ocr(1690, 230, 75, 350);// 队伍名称区域
        const region2 = RecognitionObject.ocr(872, 681, 180, 30);// 点击任意处关闭
        let tpTime = 0;
        await sleep(1500);//点击传送后等待一段时间避免误判
        //最多30秒传送时间
        while (tpTime < 300) {
            let capture = captureGameRegion();
            let res1 = capture.find(region1);
            let res2 = capture.find(region2);
            capture.dispose();
            if (!res1.isEmpty() || !res2.isEmpty()) {
                log.info("传送完成");
                await sleep(1000);//传送结束后有僵直
                click(960, 810);//点击任意处
                await sleep(500);
                return;
            }
            tpTime++;
            await sleep(100);
        }
        throw new Error('传送时间超时');
    }

    /**
     * 自动导航直到检测到指定文字
     * @param {Object} options 配置选项
     * @param {number} [options.x=1210] 检测区域左上角x坐标
     * @param {number} [options.y=515] 检测区域左上角y坐标
     * @param {number} [options.width=200] 检测区域宽度
     * @param {number} [options.height=50] 检测区域高度
     * @param {string|RegExp} [options.targetText="奖励"] 要检测的目标文字
     * @param {number} [options.maxSteps=100] 最大检查次数
     * @param {number} [options.stepDuration=200] 每步前进持续时间(ms)
     * @param {number} [options.waitTime=10] 单次等待时间(ms)
     * @param {string} [options.moveKey="w"] 前进按键
     * @param {boolean} [options.ifClick=false] 是否点击
     * @returns {Promise<void>}
     * await repeatOperationUntilTextFound();  默认F区域检测到任何文字即停止前进
     * await repeatOperationUntilTextFound({targetText: "日落果"});  F区域检测到指定文字
     */
    const repeatOperationUntilTextFound = async ({
        x = 1210,
        y = 515,
        width = 200,
        height = 50,
        targetText = null,
        maxSteps = 100,
        stepDuration = 200,
        waitTime = 10,
        moveKey = "w",
        ifClick = false,
    } = {}) => {
        const escapeRegExp = (string) => {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        const textPattern = typeof targetText === 'string'
            ? new RegExp(escapeRegExp(targetText))
            : targetText;

        let stepsTaken = 0;

        while (stepsTaken <= maxSteps) {
            const captureRegion = captureGameRegion();
            const textArea = captureRegion.DeriveCrop(x, y, width, height);
            const ocrResult = textArea.find(RecognitionObject.ocrThis);
            captureRegion.dispose();
            textArea.dispose();

            const hasAnyText = ocrResult.text.trim().length > 0;
            const matchesTarget = targetText === null
                ? hasAnyText
                : textPattern.test(ocrResult.text);

            if (matchesTarget) {
                log.info(`检测到${targetText === null ? '文字' : '目标文字'}: ${ocrResult.text}`);
                await sleep(1000);
                if (ifClick) click(Math.round(x + width / 2), Math.round(y + height / 2));
                return true;
            }

            if (stepsTaken >= maxSteps) {
                throw new Error(`检查次数超过最大限制: ${maxSteps}，未查询到文字"${targetText}"`);
            }

            if (stepDuration != 0) {
                keyDown(moveKey);
                await sleep(stepDuration);
                keyUp(moveKey);
            }
            await sleep(waitTime);
            stepsTaken++;
        }
    }

    //执行战斗并检测结束																		
    async function restoredEnergyAutoFightAndEndDetection() {
        await genshin.tp(178.55, 384.4);
        await repeatOperationUntilTextFound();
        keyPress("F");
        await repeatOperationUntilTextFound({ x: 1650, y: 1000, width: 160, height: 45, targetText: "单人挑战", stepDuration: 0, waitTime: 100, ifClick: true });
        await sleep(200);
        click(1180, 760);
        await repeatOperationUntilTextFound({ x: 1650, y: 1000, width: 160, height: 45, targetText: "开始挑战", stepDuration: 0, waitTime: 100, ifClick: true });
        await sleep(2000);
        await tpEndDetection();
        keyDown("w");
        await sleep(200);
        keyDown("SHIFT");
        await sleep(300);
        keyUp("SHIFT");
        await sleep(500);
        keyDown("SHIFT");
        await sleep(300);
        keyUp("SHIFT");
        await sleep(1000);
        keyDown("SHIFT");
        await sleep(300);
        keyUp("SHIFT");
        await sleep(500);
        keyUp("w");
        let challengeTime = 0;
        while (challengeTime < 5000) {
            for (let i = 1; i < 5; i++) {
                keyPress(i.toString());
                await sleep(300);
                leftButtonClick();
                await sleep(400);
                keyDown("e");
                await sleep(400);
                keyUp("e");
                await sleep(500);
                leftButtonClick();
                await sleep(100);
                const ro = captureGameRegion();
                let res = ro.find(RecognitionObject.ocr(840, 935, 230, 40));
                ro.dispose();
                if (res.text.includes("自动退出")) {
                    log.info("检测到挑战成功");
                    return;
                }
            }
            challengeTime = challengeTime + 200;
            await sleep(100);
        }
        log.info("挑战超时，可能充能失败");
    }

    // 回七天神像
    async function backToStatue() {
        log.info("前往七天神像...");
        await genshin.tp(2297.6201171875, -824.5869140625);
        await sleep(1500);
    }

    async function restoredEnergy() {
        await genshin.returnMainUi();

        // 开关1
        if (settings.healBeforeSwitchTeam) {
            await backToStatue();
        }

        // 切换队伍
        if (settings.teamName) {
            await genshin.switchParty(settings.teamName);
            await sleep(1000);
        }

        // 充能战斗
        await restoredEnergyAutoFightAndEndDetection();

        // 开关2
        if (settings.enableSecondFight) {
            log.info("开启第二次充能战斗...");
            await restoredEnergyAutoFightAndEndDetection();
        }

        log.info("充能完成");

        // 开关3：回血
        if (settings.backToStatueAfterCharge) {
            await backToStatue();
            log.info("已返回七天神像回血");
        }

        // 开关4：充能结束后传送到利亚姆传送点
        if (settings.teleportToLiam) {
            await genshin.tp(3035.6297000135746, 3727.409085358373);
            await sleep(1500);
            log.info("已传送到 利亚姆 传送点");
        }

        log.info("任务结束");
    }

    await restoredEnergy();
})();