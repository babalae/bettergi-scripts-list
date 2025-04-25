(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();

    const Character = settings.Character || "纳西妲";
    const Element = settings.Element || "物";
    const Weapon = settings.Weapon || "试作金珀";
    const pageScrollCount = Math.min(99, Math.max(0, Math.floor(Number(settings.pageScrollCount) || 2)));
    const ocrRegion = { x: 1463, y: 135, width: 256, height: 32 };
    const replacementMap = { "监": "盐", "卵": "卯" };
    const elements = ["火", "水", "草", "雷", "风", "冰", "岩", "物"];

    // OCR 识别函数
    async function recognizeText(targetText, ocrRegion, timeout = 5000, retryInterval = 20) {
        let startTime = Date.now();
        let retryCount = 0;

        while (Date.now() - startTime < timeout) {
            try {
                let resList = captureGameRegion().findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
                for (let res of resList) {
                    let correctedText = res.text;
                    for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                        correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                    }
                    if (correctedText.includes(targetText)) {
                        return { success: true, text: correctedText, x: res.x, y: res.y };
                    }
                }
            } catch (error) {
                retryCount++;
                log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
            }
            await sleep(retryInterval);
        }
        return { success: false };
    }

    // 滑动页面函数
    async function scrollPage(totalDistance, stepDistance = 10, delayMs = 10) {
        moveMouseTo(525, 920);
        await sleep(500);
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

    // 角色选择函数
    async function selectCharacter(characterName) {
        if (!/^[\u4e00-\u9fa5]+$/.test(characterName)) {
            log.error(`Character 设置值无效，必须为纯中文字符。当前值: ${characterName}`);
            return false;
        }

        const SwitchingSteps = 99;
        for (let i = 0; i < SwitchingSteps; i++) {
            let result = await recognizeText(characterName, ocrRegion, 100);
            if (result.success) {
                log.info(`找到 ${characterName}，识别结果: ${result.text}，坐标: x=${result.x}, y=${result.y}`);
                return true;
            }
            await click(1840, 540); // 点击切换角色
            await sleep(200);
        }

        log.warn(`扫描完成，未找到 ${characterName}`);
        return false;
    }

    // 元素选择函数
    async function selectElement(element) {
        if (element === "物") return; // 如果元素是“物”，不需要切换

        const ElementClickX = Math.round(787 + elements.indexOf(element) * 57.5); // 计算点击的X坐标
        await click(960, 45); // 移动鼠标到元素选择区域
        await sleep(100);
        leftButtonDown(); // 按住鼠标左键
        const steps = 10; // 分成若干步移动
        const stepDistance = 15; // 每步移动的距离

        for (let j = 0; j < steps; j++) {
            moveMouseBy(stepDistance, 0); // 每次移动 stepDistance 像素
            await sleep(10); // 每次移动后延迟10毫秒
        }

        await sleep(500);
        leftButtonUp(); // 释放鼠标左键
        await sleep(500);
        await click(ElementClickX, 130); // 点击目标元素
        await sleep(500);
        // 执行一系列鼠标点击操作
        await click(540, 45);
        await sleep(200);

    }

    // 武器扫描函数
    async function scanWeapons(weaponName) {
        const startX = 99.5;
        const startY = 213.5;
        const rowHeight = 167;
        const columnWidth = 141;
        const maxRows = 4;
        const maxColumns = 4;

        for (let scroll = 0; scroll <= pageScrollCount; scroll++) {
            for (let row = 0; row < maxRows; row++) {
                for (let column = 0; column < maxColumns; column++) {
                    const clickX = Math.round(startX + column * columnWidth);
                    const clickY = Math.round(startY + row * rowHeight);
                    await click(clickX, clickY);
                    await sleep(50);

                    let result = await recognizeText(weaponName, ocrRegion, 100);
                    if (result.success) {
                        log.info(`找到 ${weaponName}，识别结果: ${result.text}，坐标: x=${clickX}, y=${clickY}`);
                        await click(1600, 1005);
                        await sleep(1000);
                        await click(1320, 755);
                        await sleep(1000);
                        return true;
                    }
                }
            }

            if (scroll < pageScrollCount) {
                await scrollPage(673, 10, 10);
            }
        }

        return false;
    }

    // 主流程函数
    async function CharacterPath() {
        log.info("开始寻找");

        await genshin.returnMainUi();
        keyPress("1");
        await sleep(500);
        keyPress("C");
        await sleep(1000);

        await selectElement(Element);

        if (!await selectCharacter(Character)) {
            log.error("角色筛选失败，退出脚本");
            return;
        }

        await click(125, 225); // 点击武器选项
        await sleep(1000);
        await click(1600, 1005); // 点击替换当前武器
        await sleep(1000);
        await click(500, 1005); // 使用等级顺序排列
        await sleep(200);
        await click(500, 905); // 使用等级顺序排列
        await sleep(200);
        await click(605, 137); // 初始化滑条
        await moveMouseTo(605, 140);
        await sleep(200); // 初始化滑条
        leftButtonDown();
        await sleep(500);
        leftButtonUp();
        await sleep(200);

        if (!await scanWeapons(Weapon)) {
            log.warn(`扫描完成，未找到 ${Weapon}`);
        }

        await genshin.returnMainUi();
    }

    // 调用主流程
    await CharacterPath();
})();
