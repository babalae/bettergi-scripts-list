// 滚动页面函数
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    moveMouseTo(400, 750);
    await sleep(50);
    leftButtonDown();
    const steps = Math.ceil(totalDistance / stepDistance);
    for (let j = 0; j < steps; j++) {
        const remainingDistance = totalDistance - j * stepDistance;
        const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        moveMouseBy(0, -moveDistance);
        await sleep(delayMs);
    }
    await sleep(700);
    leftButtonUp();
    await sleep(100);
}

(async function () {
    // 设置分辨率
    setGameMetrics(1920, 1080, 1);
    // 返回主界面
    await genshin.returnMainUi();

    const positionCoordinates = [
        [460, 538],
        [792, 538],
        [1130, 538],
        [1462, 538],
    ];

    const positionSettings = [settings.position1, settings.position2, settings.position3, settings.position4];

    // 识别对象定义
    const roTeamConfig = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/队伍配置.png`), 0, 0, 1920, 1080);
    const roReplace = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/更换.png`), 0, 0, 1920, 1080);
    const roJoin = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/加入.png`), 0, 0, 1920, 1080);

    let openPairingTries = 0;
    let totalOpenPairingTries = 0;

    // 在进入角色切换逻辑前进行检测，如果所有角色设置均为空则直接退出
    if (positionSettings.every((item) => !item || item.trim() === "")) {
        log.info("未设置任何角色，跳过切换队伍步骤");
        await genshin.returnMainUi();
        return;
    }

    async function openPairingInterface() {
        while (openPairingTries < 3) {
            keyPress("l");
            await sleep(3500);
            const teamConfigResult = captureGameRegion().find(roTeamConfig);
            if (teamConfigResult.isExist()) {
                openPairingTries = 0;
                return true;
            }
            openPairingTries++;
            totalOpenPairingTries++;
        }
        if (totalOpenPairingTries < 6) {
            await genshin.tp("2297.630859375", "-824.5517578125");
            openPairingTries = 0;
            return openPairingInterface();
        } else {
            log.error("无法打开配对界面，任务结束");
            return false;
        }
    }

    if (!(await openPairingInterface())) {
        return;
    }

    // 角色切换逻辑
    for (let i = 0; i < positionSettings.length; i++) {
        let rolenum = i + 1;
        const selectedCharacter = positionSettings[i];
        if (!selectedCharacter || selectedCharacter.trim() === "") {
            log.info(`未设置${rolenum}号位角色，跳过`);
            continue;
        }
        const [x, y] = positionCoordinates[i];
        click(x, y);
        log.info(`开始设置${rolenum}号位角色`);

        await sleep(1000);

        let characterFound = false;
        let pageTries = 0;

        // 最多尝试滚动页面20次
        while (pageTries < 20) {
            // 尝试识别所有可能的角色文件名
            for (let num = 1; ; num++) {
                const paddedNum = num.toString().padStart(2, "0");
                const characterFileName = `${selectedCharacter}${paddedNum}`;
                try {
                    const characterRo = RecognitionObject.TemplateMatch(
                        file.ReadImageMatSync(`Assets/characterimage/${characterFileName}.png`),
                        0,
                        0,
                        1920,
                        1080
                    );
                    const characterResult = captureGameRegion().find(characterRo);
                    if (characterResult.isExist()) {
                        log.info(`已找到角色${selectedCharacter}`);
                        // 计算向右偏移70像素、向下偏移70像素的位置
                        const targetX = characterResult.x + 35;
                        const targetY = characterResult.y + 35;

                        // 边界检查，确保坐标在屏幕范围内
                        const safeX = Math.min(Math.max(targetX, 0), 1920);
                        const safeY = Math.min(Math.max(targetY, 0), 1080);

                        click(safeX, safeY);
                        await sleep(500); // 点击角色后等待0.5秒
                        characterFound = true;
                        break;
                    }
                } catch (error) {
                    // 如果文件不存在，跳出循环
                    break;
                }
            }

            if (characterFound) {
                break;
            }

            // 如果不是最后一次尝试，尝试滚动页面
            if (pageTries < 15) {
                log.info("当前页面没有目标角色，滚动页面");
                await scrollPage(200); // 滚动距离可根据实际情况调整
            }
            pageTries++;
        }

        if (!characterFound) {
            log.error(`未找到【${selectedCharacter}】`);
            continue;
        }

        // 识别"更换"或"加入"按钮
        const replaceResult = captureGameRegion().find(roReplace);
        const joinResult = captureGameRegion().find(roJoin);

        if (replaceResult.isExist() || joinResult.isExist()) {
            await sleep(300);
            click(68, 1020);
            keyPress("VK_LBUTTON");
            await sleep(500);
        } else {
            log.error(`该角色已在队伍中，无需切换`);
        }
        await sleep(500);
    }

    // 返回主界面
    await genshin.returnMainUi();
})();
