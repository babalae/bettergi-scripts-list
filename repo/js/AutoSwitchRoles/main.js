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
    await sleep(500);
}

// 读取别名文件
function readAliases() {
    const combatText = file.ReadTextSync('combat_avatar.json');
    const combatData = JSON.parse(combatText);
    const aliases = {};
    for (const character of combatData) {
        if (character.alias && character.name) {
            for (const alias of character.alias) {
                aliases[alias] = character.name;
            }
        }
    }
    return aliases;
}

(async function () {
    // 设置分辨率
    setGameMetrics(1920, 1080, 1);
    // 返回主界面
    await genshin.returnMainUi();
    //切换配对
    if (settings.switchPartyName) {
        await genshin.switchParty(settings.switchPartyName);
    }

    const option = settings.option;
    if (option === '推荐-非快速配对模式 @Tool_tingsu') {
        // main.js 的逻辑
        const positionCoordinates = [
            [460, 538],
            [792, 538],
            [1130, 538],
            [1462, 538]
        ];

        // 获取初始角色数组
        const initialAvatars = getAvatars();

        // 读取别名
        const aliases = readAliases();

        const positionSettings = [
            settings.position1,
            settings.position2,
            settings.position3,
            settings.position4
        ].map((input, index) => {
            if (input && input.trim() !== "") {
                const actualName = aliases[input] || input;
                log.info(`设置对应号位为【${input}】，切换角色为【${actualName}】`);
                // 替换初始数组对应位置
                initialAvatars[index] = actualName;
                return actualName;
            }
            return null;
        });

        // 目标角色数组（替换后的初始数组）
        const targetAvatars = [...initialAvatars];
        log.info(`目标角色: [${targetAvatars}]`);

        // 识别对象定义
        const roTeamConfig = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/队伍配置.png`), 0, 0, 1920, 1080);
        const roReplace = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/更换.png`), 0, 0, 1920, 1080);
        const roJoin = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/加入.png`), 0, 0, 1920, 1080);

        let openPairingTries = 0;
        let totalOpenPairingTries = 0;
        let retryCount = 0; // 重试计数器
        let switchSuccess = false;

        // 在进入角色切换逻辑前进行检测，如果所有角色设置均为空则直接退出
        if (positionSettings.every((item) => !item)) {
            log.info("未设置任何角色，跳过切换队伍步骤");
            await genshin.returnMainUi();
            return;
        }

        async function openPairingInterface() {
            while (openPairingTries < 3) {
                keyPress("l");
                await sleep(3200);
                const ro = captureGameRegion();
                const teamConfigResult = ro.find(roTeamConfig);
                    ro.dispose();
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

        // 角色切换逻辑封装
        async function switchCharacters() {
            if (!(await openPairingInterface())) {
                return false;
            }

    // 读取筛选配置文件（中文逗号分隔）
    const filterConfig = {};
    try {
        const filterContent = file.readTextSync('attribute.txt');
        const lines = filterContent.split('\n');
        lines.forEach(line => {
            // 使用中文逗号分割，并去除可能的空格
            const [name, element, weapon] = line.trim().split(/，\s*/).map(item => item || null);
            if (name) { // 只要角色名存在就记录，元素和武器可为空
                filterConfig[name] = { element, weapon };
            }
        });
    } catch (error) {
        log.error(`读取筛选配置失败: ${error}`);
    }

    // 预加载"暂无筛选结果"模板
    let noResultTemplate;
    try {
        noResultTemplate = file.readImageMatSync('Assets/RecognitionObject/暂无筛选结果.png');
    } catch (error) {
        log.error(`加载"暂无筛选结果"模板失败: ${error}`);
    }

    for (let i = 0; i < positionSettings.length; i++) {
        let rolenum = i + 1;
        const selectedCharacter = positionSettings[i];
        if (!selectedCharacter) {
            log.info(`未设置${rolenum}号位角色，跳过`);
            continue;
        }
        const [x, y] = positionCoordinates[i];
        click(x, y);
        log.info(`开始设置${rolenum}号位角色`);
        await sleep(1000);
        let characterFound = false;
        let pageTries = 0;

        // 执行筛选操作
        const filterInfo = filterConfig[selectedCharacter];
        let hasNoFilterResult = false; // 标记是否存在无筛选结果状态
        if (filterInfo && noResultTemplate) {
            try {
                log.info(`对角色【${selectedCharacter}】执行筛选: 元素=${filterInfo.element || '空'}, 武器=${filterInfo.weapon || '空'}`);
                
                // 点击筛选按钮
                const ro1 = captureGameRegion();
                const filterBtn = ro1.find(RecognitionObject.TemplateMatch(
                    file.readImageMatSync('Assets/RecognitionObject/筛选.png'), 0, 0, 1920, 1080
                ));
                ro1.dispose();
                if (filterBtn.isExist()) {
                    filterBtn.click();
                    await sleep(200);
                    
                    // 元素不为空才执行元素筛选
                    if (filterInfo.element) {
                        const ro2 = captureGameRegion();
                        const elementBtn = ro2.find(RecognitionObject.TemplateMatch(
                            file.readImageMatSync(`Assets/RecognitionObject/${filterInfo.element}.png`), 0, 0, 1920, 1080
                        ));
                        ro2.dispose();
                        if (elementBtn.isExist()) {
                            elementBtn.click();
                            await sleep(200);
                        } else {
                            log.warn(`未找到元素筛选图标: Assets/RecognitionObject/${filterInfo.element}.png`);
                        }
                    } else {
                        log.info(`元素为空，跳过元素筛选`);
                    }
                    
                    // 武器不为空才执行武器筛选
                    if (filterInfo.weapon) {
                        const ro3 = captureGameRegion();
                        const weaponBtn = ro3.find(RecognitionObject.TemplateMatch(
                            file.readImageMatSync(`Assets/RecognitionObject/${filterInfo.weapon}.png`), 0, 0, 1920, 1080
                        ));
                        ro3.dispose();
                        if (weaponBtn.isExist()) {
                            weaponBtn.click();
                            await sleep(200);
                        } else {
                            log.warn(`未找到武器筛选图标: Assets/RecognitionObject/${filterInfo.weapon}.png`);
                        }
                    } else {
                        log.info(`武器为空，跳过武器筛选`);
                    }
                    
                    // 点击确认筛选（无论元素/武器是否为空都需要确认）
                    const ro4 = captureGameRegion();
                    const confirmFilterBtn = ro4.find(RecognitionObject.TemplateMatch(
                        file.readImageMatSync('Assets/RecognitionObject/确认筛选.png'), 0, 0, 1920, 1080
                    ));
                    ro4.dispose();
                    if (confirmFilterBtn.isExist()) {
                        confirmFilterBtn.click();
                        await sleep(50); // 等待筛选结果显示
                        
                        // 识别是否有"暂无筛选结果"提示
                        const noResultRo = RecognitionObject.TemplateMatch(noResultTemplate, 0, 0, 1920, 1080);
                        const ro5 = captureGameRegion();
                        const noResult = ro5.find(noResultRo);
                        ro5.dispose();
                        if (noResult.isExist()) {
                            log.warn(`筛选后无结果，跳过${rolenum}号位角色`);
                            hasNoFilterResult = true;
                            // 关闭筛选面板（如果需要）
                            keyPress("VK_ESCAPE");
                            await sleep(200);
                            keyPress("VK_ESCAPE");
                            await sleep(200);
                            keyPress("VK_ESCAPE");
                            await sleep(200);
                        }
                    } else {
                        log.warn('未找到确认筛选图标: Assets/RecognitionObject/确认筛选.png');
                    }
                } else {
                    log.warn('未找到筛选图标: Assets/RecognitionObject/筛选.png');
                }
            } catch (error) {
                log.error(`筛选操作失败: ${error}`);
            }
        }

        // 如果筛选无结果，直接跳过当前号位
        if (hasNoFilterResult) {
            continue;
        }

                // 最多尝试滚动页面320次
                while (pageTries < 3) {
                    // 尝试识别所有可能的角色文件名
                    for (let num = 1; ; num++) {
                        const paddedNum = num.toString().padStart(2, "0");
                        const characterFileName = `${selectedCharacter}${paddedNum}`;
                        try {
                            const characterRo = RecognitionObject.TemplateMatch(
                                file.ReadImageMatSync(`Assets/characterimage/${characterFileName}.png`),
                                0, 0, 1920, 1080
                            );
                            const ro = captureGameRegion();
                            const characterResult = ro.find(characterRo);
                            ro.dispose();
                            if (characterResult.isExist()) {
                                log.info(`已找到角色【${selectedCharacter}】`);
                                characterResult.click();
                                await sleep(200);
                                characterFound = true;
                                break;
                            }
                        } catch (error) {
                            // 文件不存在，跳出循环
                            break;
                        }
                    }

                    if (characterFound) {
                        break;
                    }

                    // 滚动页面
                    if (pageTries < 3) {
                        log.info("当前页面没有目标角色，滚动页面");
                        await scrollPage(350);
                        
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
                    if (replaceResult.isExist()){
                        replaceResult.click();
                    } else {
                        joinResult.click();
                    }
                    keyPress("VK_LBUTTON");
                    await sleep(500);
                } else {
                    log.error(`该角色已在队伍中，无需切换`);
                    await sleep(300);
                    keyPress("VK_ESCAPE");
                    await sleep(500);
                }
                await sleep(500);
            }
            return true;
        }

        // 执行切换并检查结果
        while (retryCount < 2) { // 最多尝试2次（初始1次+重试1次）
            if (!await switchCharacters()) {
                log.error("角色切换过程失败");
                return;
            }

            // 返回主界面后获取最终角色数组
            await genshin.returnMainUi();
            const finalAvatars = getAvatars();

            // 比较数组是否完全一致
            const arraysEqual = targetAvatars.length === finalAvatars.length &&
                targetAvatars.every((val, idx) => val === finalAvatars[idx]);

            if (arraysEqual) {
                log.info("角色切换成功");
                switchSuccess = true;
                break;
            } else {
                log.warn("角色不匹配，准备重试...");
                retryCount++;
                if (retryCount >= 2) {
                    log.error("角色切换失败");
                    return;
                }
                // 重新打开配对界面准备重试
                await genshin.returnMainUi();
            }
        }

        if (!switchSuccess) {
            log.error("角色切换失败");
            return;
        }

    } else if (option === '存在bug-快速配对模式 @兩夢三醒') {
        // 切换队伍
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

        // 获取初始角色数组
        const initialAvatars = getAvatars();

        // 角色位置坐标
        const positionCoordinates = [
            [107, 190],
            [254, 188],
            [414, 189],
            [554, 198],
        ];

        // 读取别名
        const aliases = readAliases();

        // 获取需要切换的角色，并进行别名替换
        const positionSettings = [settings.position1, settings.position2, settings.position3, settings.position4].map((input, index) => {
            if (input && input.trim() !== "") {
                const actualName = aliases[input] || input;
                log.info(`设置对应号位为【${input}】，切换角色为【${actualName}】`);
                // 替换初始数组对应位置
                initialAvatars[index] = actualName;
                return actualName;
            }
            return null;
        });

        // 目标角色数组（替换后的初始数组）
        const targetAvatars = [...initialAvatars];
        log.info(`目标角色: [${targetAvatars}]`);

        // 识别对象定义
        const roTeamConfig = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/队伍配置.png`), 0, 0, 1920, 1080);

        let openPairingTries = 0;
        let totalOpenPairingTries = 0;
        let retryCount = 0; // 重试计数器
        let switchSuccess = false;

        // 在进入角色切换逻辑前进行检测，如果所有角色设置均为空则直接退出
        if (positionSettings.every((item) => !item)) {
            log.info("未设置任何角色，跳过切换队伍步骤");
            await genshin.returnMainUi();
            return;
        }

        // 打开配对界面
        async function openPairingInterface() {
            while (openPairingTries < 3) {
                keyPress("l");
                await sleep(3500);
                const ro6 = captureGameRegion();
                const teamConfigResult = ro6.find(roTeamConfig);
                ro6.dispose();
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

        // 角色切换逻辑封装
        async function switchCharacters() {
            if (!(await openPairingInterface())) {
                return false;
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
            captureRegion.dispose();

            // 角色切换逻辑
            click(1212, 1020); // 点击快速编队
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
                if (!selectedCharacter) {
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
                                0, 0, 1920, 1080
                            );
                            const ro2 = captureGameRegion();
                            const characterResult = ro2.find(characterRo);
                            ro2.dispose();
                            if (characterResult.isExist()) {
                                log.info(`已找到角色【${selectedCharacter}】`);
                                characterResult.click();
                                await sleep(500);
                                characterFound = true;
                                break;
                            }
                        } catch (error) {
                            // 文件不存在，跳出循环
                            break;
                        }
                    }

                    if (characterFound) {
                        break;
                    }

                    // 滚动页面
                    if (pageTries < 30) {
                        log.info(`当前页面没有目标角色【${selectedCharacter}】，滚动页面`);
                        await scrollPage(200);
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
            }

            // 点击保存
            click(427, 1024);
            await sleep(1000);
            keyPress("VK_LBUTTON");
            await sleep(500);
            return true;
        }

        // 执行切换并检查结果
        while (retryCount < 2) { // 最多尝试2次（初始1次+重试1次）
            if (!await switchCharacters()) {
                log.error("角色切换过程失败");
                return;
            }

            // 返回主界面后获取最终角色数组
            await genshin.returnMainUi();
            const finalAvatars = getAvatars();

            // 比较数组是否完全一致
            const arraysEqual = targetAvatars.length === finalAvatars.length &&
                targetAvatars.every((val, idx) => val === finalAvatars[idx]);

            if (arraysEqual) {
                log.info("角色切换成功");
                switchSuccess = true;
                break;
            } else {
                log.warn("角色不匹配，准备重试...");
                retryCount++;
                if (retryCount >= 2) {
                    log.error("角色切换失败");
                    return;
                }
                // 重新打开配对界面准备重试
                await genshin.returnMainUi();
            }
        }

        if (!switchSuccess) {
            log.error("角色切换失败");
            return;
        }
    }

    // 返回主界面
    await genshin.returnMainUi();
    // 清空角色缓存
    genshin.ClearPartyCache();
})();
