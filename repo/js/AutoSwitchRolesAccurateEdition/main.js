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

    //  切换队伍
	if (!!settings.partyName) {
		try {
			log.info("正在尝试切换至" + settings.partyName);
			if (!await genshin.switchParty(settings.partyName)) {
				log.info("切换队伍失败，前往七天神像重试");
				await genshin.tpToStatueOfTheSeven();
				await genshin.switchParty(settings.partyName);
			}
		} catch {
			log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
			notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
			await genshin.returnMainUi();
		}
	} else {
		await genshin.returnMainUi();
	}


    // 角色位置坐标
    const positionCoordinates = [
        [107, 190],
        [254, 188],
        [414, 189],
        [554, 198],
    ];

    // 获取需要切换的角色
    const positionSettings = [settings.position1, settings.position2, settings.position3, settings.position4];
    
    // 识别对象定义
    const roTeamConfig = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/队伍配置.png`), 0, 0, 1920, 1080);
    // const roReplace = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/更换.png`), 0, 0, 1920, 1080);
    // const roJoin = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/加入.png`), 0, 0, 1920, 1080);

    let openPairingTries = 0;
    let totalOpenPairingTries = 0;

    // 在进入角色切换逻辑前进行检测，如果所有角色设置均为空则直接退出
    if (positionSettings.every((item) => !item || item.trim() === "")) {
        log.info("未设置任何角色，跳过切换队伍步骤");
        await genshin.returnMainUi();
        return;
    }

    // 打开配对界面
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

    // 需要取消选择的数量

    const ocrRegions = [
        [340, 181, 315, 330],
        [655, 181, 315, 330],
        [970, 181, 315, 330],
        [1285, 181, 315, 330],
    ];
    let regionsWithTextCount = 0;
    let captureRegion = captureGameRegion();
    for (const [x, y, w, h] of ocrRegions) {
        const regionOcrResult = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));
        if (regionOcrResult.count > 0) {
            regionsWithTextCount++;
        }
    }
    log.info(`有文字的区域数量为: ${regionsWithTextCount}`);

    // 角色切换逻辑
    click(1212, 1020) // 点击快速编队
    await sleep(1000);
    log.info(`点击快速编队`);
    for (let i = 0; i < regionsWithTextCount; i++) {
        if (i >= positionCoordinates.length) {
            break;
        }
        const [x, y] = positionCoordinates[i];
        click(x, y);
        await sleep(1000);
        log.info(`取消选择${x},${y}位置的角色`);
    }

    for (let i = 0; i < positionSettings.length; i++) {
        let rolenum = i + 1;
        const selectedCharacter = positionSettings[i];
        const [x, y] = positionCoordinates[i];
        click(800, 123);
        await sleep(1000);
        if (!selectedCharacter || selectedCharacter.trim() === "") {
            log.info(`未设置${rolenum}号位角色，保持原来的选择，可能存在未知bug`);
            click(x, y);
            await sleep(1000);
            continue;
        }
        log.info(`开始设置${rolenum}号位角色`);
        log.info(`目标角色为：【${selectedCharacter}】`);


        let characterFound = false;
        let pageTries = 0;

        // 最多尝试滚动页面20×2次
        while (pageTries < 40) {
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
                        log.info(`已找到角色【${selectedCharacter}】`);
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
            if (pageTries < 30) {
                log.info(`当前页面没有目标角色【${selectedCharacter}】，滚动页面`);
                await scrollPage(200); // 滚动距离可根据实际情况调整
            }
            if (pageTries == 15) {
                log.info("滚动完毕，重置位置，再试一次");
                click(800, 123);
                await sleep(1000);
            }
            pageTries++;
        }

        if (!characterFound) {
            log.error(`未找到【${selectedCharacter}】，尝试选择原来的角色`);
            click(800, 123);
            await sleep(1000);
            click(x, y);
            await sleep(1000);
            continue;
        }
        

        // 识别"更换"或"加入"按钮
        // const replaceResult = captureGameRegion().find(roReplace);
        // const joinResult = captureGameRegion().find(roJoin);

        // if (replaceResult.isExist() || joinResult.isExist()) {
        //     await sleep(300);
        //     click(68, 1020);
        //     keyPress("VK_LBUTTON");
        //     await sleep(500);
        // } else {
        //     log.error(`该角色已在队伍中，无需切换`);
        // }
        // await sleep(500);
    }

    // 点击保存
    click(427, 1024);
    await sleep(1000);
    keyPress("VK_LBUTTON");
    await sleep(500);

    // 返回主界面
    await genshin.returnMainUi();
})();
