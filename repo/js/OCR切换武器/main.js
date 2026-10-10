(async function () {
    // 初始化游戏窗口大小和返回主界面
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();

    // 获取角色、元素、武器等设置信息
    const Character = settings.Character || "纳西妲"; // 默认角色
    const Element = settings.Element || "物"; // 默认元素
    const Weapon = settings.Weapon || "试作金珀"; // 默认武器
    const pageScrollCount = Math.min(99, Math.max(0, Math.floor(Number(settings.pageScrollCount) || 2))); // 页面滚动次数
    const ocrRegion = { x: 1463, y: 135, width: 256, height: 32 }; // OCR识别区域
    const replacementMap = { "卵": "卯", "姐": "妲", "去": "云", "日": "甘", "螨": "螭", "知": "矢", "钱": "钺", "础": "咄", "厘": "匣", "排": "绯", "朦": "曚", "矿": "斫", "镰": "簾", "廉": "簾", "救": "赦", "塑": "槊", "雍": "薙" }; // OCR替换映射表
    const elements = [ "火", "水", "草", "雷", "风", "冰", "岩", "物"]; // 元素列表
    const weaponTypeMap = {
        "1": "单手剑",
        "11": "双手剑",
        "12": "弓箭",
        "10": "法器",
        "13": "长枪"
    }; // 武器类型映射表

    // 加载角色数据
    const filePath = "assets/combat_avatar.json";
    const { aliasToNameMap, nameToWeaponMap } = await loadCombatAvatarData(filePath);
    if (!aliasToNameMap || !nameToWeaponMap) {
        log.error("无法加载角色数据，OCR 识别无法进行。");
        return;
    }

    // 加载武器名称数据
    const weaponNamesMap = await loadWeaponNames("assets/weaponName.json");
    if (!weaponNamesMap) {
        log.error("无法加载武器名称数据");
        return;
    }

    // 开始执行角色路径
    await CharacterPath();

    // 加载角色数据
    async function loadCombatAvatarData(filePath) {
        try {
            const jsonData = file.readTextSync(filePath);
            const combatAvatarData = JSON.parse(jsonData);
            const aliasToNameMap = {}; // 用于存储别名到正式名称的映射
            const nameToWeaponMap = {}; // 用于存储正式名称到武器属性的映射

            combatAvatarData.forEach(character => {
                aliasToNameMap[character.name] = character.name; // 存储正式名称
                nameToWeaponMap[character.name] = character.weapon; // 存储武器属性
                character.alias.forEach(alias => {
                    aliasToNameMap[alias] = character.name; // 存储别名到正式名称的映射
                });
            });

            return { aliasToNameMap, nameToWeaponMap };
        } catch (error) {
            log.error(`加载或解析 JSON 文件失败: ${error}`);
            return null;
        }
    }

    // 加载武器名称数据
    async function loadWeaponNames(filePath) {
        try {
            const jsonData = file.readTextSync(filePath);
            const weaponNamesData = JSON.parse(jsonData);
            const weaponNamesMap = {};

            // 将武器名称数据存储到一个对象中，键为武器类型，值为武器名称数组
            weaponNamesData.forEach(item => {
                for (const [weaponType, weaponNames] of Object.entries(item)) {
                    weaponNamesMap[weaponType] = weaponNames;
                }
            });

            // log.info(`角色别名映射表: ${JSON.stringify(aliasToNameMap)}`);
            // log.info(`角色武器映射表: ${JSON.stringify(nameToWeaponMap)}`);

            return weaponNamesMap;
        } catch (error) {
            log.error(`加载武器名称文件失败: ${error}`);
            return null;
        }
    }

    // OCR识别文本
    async function recognizeText(targetText, ocrRegion, aliasToNameMap, timeout = 100, retryInterval = 20, maxAttempts = 5, captureRegion = null) {
        let startTime = Date.now();
        let retryCount = 0;
        const targetFormalName = aliasToNameMap ? aliasToNameMap[targetText] || targetText : targetText;

        captureRegion?.dispose();
        captureRegion = captureGameRegion();
        const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        ocrObject.threshold = 0.8;
        while (Date.now() - startTime < timeout && retryCount < maxAttempts) {
            try {
                let resList = captureRegion.findMulti(ocrObject);

                for (let res of resList) {
                    let correctedText = res.text;
                    for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                        correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                    }
                    // log.info(`识别结果: ${correctedText}, 原始坐标: x=${res.x}, y=${res.y}`);

                    let recognizedFormalName = aliasToNameMap ? aliasToNameMap[correctedText] || correctedText : correctedText;
                    recognizedFormalName = fuzzyMatch(correctedText, Object.values(aliasToNameMap)) || recognizedFormalName;

                    if (recognizedFormalName === targetFormalName) {
                        return { text: recognizedFormalName, x: res.x, y: res.y };
                    }
                }
            } catch (error) {
                retryCount++;
                log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
            }
            await sleep(retryInterval);
        }
        captureRegion?.dispose();
        return false;
    }

    // 模糊匹配文本
    function fuzzyMatch(target, candidates, weightThreshold = 0.6) {
        function levenshteinDistance(a, b) {
            const m = a.length + 1;
            const n = b.length + 1;
            const d = Array(m).fill(null).map(() => Array(n).fill(0));
            for (let i = 0; i < m; i++) d[i][0] = i;
            for (let j = 0; j < n; j++) d[0][j] = j;
            for (let i = 1; i < m; i++) {
                for (let j = 1; j < n; j++) {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
                }
            }
            return d[m - 1][n - 1];
        }

        let bestMatch = null;
        let bestWeight = 0;

        for (const candidate of candidates) {
            const distance = levenshteinDistance(target, candidate);
            const keywordWeight = 0.8;
            const lengthWeight = 0.2;
            const keywordMatch = candidate.includes(target);
            const weight = (keywordMatch ? keywordWeight : 0) + (1 - distance / Math.max(target.length, candidate.length)) * lengthWeight;

            if (weight >= weightThreshold) {
                return candidate;
            }

            if (weight > bestWeight) {
                bestWeight = weight;
                bestMatch = candidate;
            }
        }
        return bestMatch;
    }

    // 合并OCR识别结果
    function combineResults(results) {
        const frequencyMap = {};
        results.forEach(result => {
            if (!frequencyMap[result]) {
                frequencyMap[result] = 0;
            }
            frequencyMap[result]++;
        });

        const sortedResults = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a]);

        for (let result of sortedResults) {
            if (result.length === 2) {
                return result;
            }
        }

        if (sortedResults.length >= 2) {
            return sortedResults[0] + sortedResults[1];
        }

        return sortedResults[0] || "";
    }

    // 滚动页面
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

    // 选择角色
    async function selectCharacter(characterName) {
        const SwitchingSteps = 99; // 最大切换次数
        for (let i = 0; i < SwitchingSteps; i++) {
            let result = await recognizeText(characterName, ocrRegion, aliasToNameMap, 100);
            if (result) {
                // log.info(`找到 ${characterName}，识别结果: ${result.text}，坐标: x=${result.x}, y=${result.y}`);
                return true;
            }
            await click(1840, 540); // 点击切换角色
            await sleep(200);
        }
        log.warn(`扫描完成，未找到 ${characterName}`);
        return false;
    }

    // 选择元素
    async function selectElement(element) {
        if (element === "物") return; // 如果是物理属性，无需切换
        const ElementClickX = Math.round(787 + elements.indexOf(element) * 57.5); // 计算点击位置
        await click(960, 45); // 点击元素切换按钮
        await sleep(100);
        leftButtonDown();
        const steps = 10;
        const stepDistance = 15;
        for (let j = 0; j < steps; j++) {
            moveMouseBy(stepDistance, 0); // 拖动鼠标选择元素
            await sleep(10);
        }
        await sleep(500);
        leftButtonUp();
        await sleep(500);
        await click(ElementClickX, 130); // 点击选择元素
        await sleep(500);
        await click(540, 45); // 点击确认
        await sleep(200);
    }

    // 识别并组合武器名称
    async function recognizeAndCombineWeaponName(ocrRegion, maxAttempts = 5, captureRegion = null) {
        const allResults = [];
        captureRegion?.dispose();
        captureRegion = captureGameRegion();
        const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        ocrObject.threshold = 0.9;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                let resList = captureRegion.findMulti(ocrObject);
                for (let res of resList) {
                    let correctedText = res.text;
                    for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                        correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                    }
                    // log.info(`OCR 识别结果: ${correctedText}, 原始坐标: x=${res.x}, y=${res.y}`);
                    allResults.push(correctedText);
                }
            } catch (error) {
                log.warn(`OCR 识别失败，正在进行第 ${i + 1} 次重试...`);
            }
            await sleep(20);
        }

        captureRegion?.dispose();
        const combinedResult = combineResults(allResults);
        // log.info(`组合后的识别结果: ${combinedResult}`);
        return combinedResult;
    }

    // 扫描武器
    async function scanWeapons(settingsWeapon) {
    // 获取角色的正式名称
    const characterName = aliasToNameMap[Character] || Character;
    log.info(`寻找到角色 ${Character} 正式名称 ${characterName}`);
    if (!characterName) {
        log.error(`未找到角色 ${Character} 的正式名称`);
        return false;
    }

    // 获取角色的武器类型
    const characterWeaponType = nameToWeaponMap[characterName];
    log.info(`寻找到角色 ${Character} 的武器类型为 ${characterWeaponType}`);
    if (!characterWeaponType) {
        log.warn(`未找到角色 ${characterName} 的武器类型，将直接匹配 目标武器名 和 当前武器名 `);
    }

    // 获取对应的武器名称列表
    const weaponType = weaponTypeMap[characterWeaponType];
    const weaponNames = weaponNamesMap[weaponType] || [];

    // 如果武器名称列表为空，则将 settingsWeapon 添加到列表中，以便后续匹配
    if (!weaponNames.length) {
        log.warn(`未找到武器类型 ${weaponType} 的武器名称列表，将使用原始武器名 ${settingsWeapon}`);
        weaponNames.push(settingsWeapon);
    }

    let weaponName1 = fuzzyMatch(settingsWeapon, weaponNames, 0.9);
    log.info(`寻找到 目标武器 正式名称 ${weaponName1}`);

    if (!weaponName1) {
        log.warn(`未找到与 ${settingsWeapon} 匹配的武器名，使用原始名称作为 目标武器名`);
        weaponName1 = settingsWeapon;
    }

    const startX = 99.5;
    const startY = 213.5;
    const rowHeight = 167;
    const columnWidth = 141;
    const maxRows = 4;
    const maxColumns = 4;

    for (let scroll = 0; scroll <= pageScrollCount; scroll++) {
            // ======================================
            // 【新增】前置武器识别：行列循环前先识别一次
            // ======================================
            log.info(`第 ${scroll + 1} 页 - 开始前置武器识别`);
            const preRecognized = await recognizeAndCombineWeaponName(ocrRegion);
            let isPreMatched = false;

            if (preRecognized) {
                // 前置识别结果匹配目标武器
                let preWeaponName2 = fuzzyMatch(preRecognized, weaponNames, 1);
                if (!preWeaponName2) {
                    log.warn(`前置识别：未匹配已知武器，使用原始识别结果 ${preRecognized} 匹配`);
                    preWeaponName2 = preRecognized;
                }

                // 计算匹配占比（排除干扰词）
                const preMatchRatio = calculateMatchRatio(weaponName1, preWeaponName2);
                if (preMatchRatio >= 0.8) {
                    log.info(`✅ 前置识别成功！目标武器(${weaponName1}) 与 当前武器(${preWeaponName2}) 匹配，占比 ${preMatchRatio.toFixed(2)}`);
                    // 执行确认逻辑
                    await click(1600, 1005); // 点击确认
                    await sleep(1000);
                    await click(1320, 755); // 点击确认
                    await sleep(1000);
                    return true; // 匹配成功，直接返回，跳过后续行列循环
                } else {
                    log.info(`❌ 前置识别不匹配：目标(${weaponName1}) vs 当前(${preWeaponName2})，占比 ${preMatchRatio.toFixed(2)}`);
                }
            } else {
                log.info(`❌ 前置识别未读取到任何武器名称`);
            }

            // ======================================
            // 前置识别失败：执行原有的行列循环（逐个格子检查）
            // ======================================
        for (let row = 0; row < maxRows; row++) {
            for (let column = 0; column < maxColumns; column++) {
                const clickX = Math.round(startX + column * columnWidth);
                const clickY = Math.round(startY + row * rowHeight);
                await click(clickX, clickY); // 点击武器
                await sleep(50);

                const combinedWeaponName2 = await recognizeAndCombineWeaponName(ocrRegion);

                if (!combinedWeaponName2) {
                        log.warn(`格子(${row},${column})：未识别到武器名称`);
                    continue;
                }

                // 尝试模糊匹配武器名称
                let weaponName2 = fuzzyMatch(combinedWeaponName2, weaponNames, 1);

                // 如果未匹配到已知武器名称，则将 OCR 识别结果直接作为武器名称使用
                if (!weaponName2) {
                    log.warn(`未找到与 ${combinedWeaponName2} 匹配的已知武器名，将使用 OCR 识别结果作为 当前武器名`);
                    weaponName2 = combinedWeaponName2;
                }

                // 计算匹配占比，排除干扰词
                const matchRatio = calculateMatchRatio(weaponName1, weaponName2);
                if (matchRatio >= 0.8) { // 如果匹配占比大于等于 80%，则认为匹配成功
                        log.info(`✅ 格子(${row},${column}) 匹配成功：目标(${weaponName1}) vs 当前(${weaponName2})，占比 ${matchRatio.toFixed(2)}`);
                    await click(1600, 1005); // 点击确认
                    await sleep(1000);
                    await click(1320, 755); // 点击确认
                    await sleep(1000);
                    return true;
                } else {
                    log.warn(` 目标武器名 (${weaponName1}) 和 当前武器名 (${weaponName2}) 不匹配，匹配占比 ${matchRatio.toFixed(2)}`);
                }
            }
        }

        if (scroll < pageScrollCount) {
            await scrollPage(673, 10, 10); // 滚动页面
        }
    }

    log.warn(`扫描完成，未找到 ${settingsWeapon}`);
    return false;
}

// 计算匹配占比
function calculateMatchRatio(target, candidate) {
    const ignoreWords = ["剑", "之", "弓", "枪", "长", "大", "典", "章"]; // 需要排除的干扰词
    const targetClean = target.split('').filter(char => !ignoreWords.includes(char)).join('');
    const candidateClean = candidate.split('').filter(char => !ignoreWords.includes(char)).join('');

    const commonChars = targetClean.split('').filter(char => candidateClean.includes(char)).length;
    const totalChars = targetClean.length;

    return commonChars / totalChars;
}

    // 执行角色路径
    async function CharacterPath() {
        log.info("开始寻找");

        await genshin.returnMainUi(); // 返回主界面
        keyPress("1"); // 按键操作
        await sleep(500);
        keyPress("C"); // 打开角色界面
        await sleep(1000);

        await selectElement(Element); // 选择元素属性

        if (!await selectCharacter(Character)) { // 选择角色
            log.error("角色筛选失败，退出脚本");
            return;
        }

        await click(125, 225); // 点击武器详情
        await sleep(1000);
        await click(1600, 1005); // 点击替换武器
        await sleep(1000);
        await click(500, 1005); // 点击武器排序
        await sleep(200);
        await click(500, 905); // 点击排序类型
        await sleep(200);
        await click(605, 137); // 点击武器排序
        await moveMouseTo(605, 140); // 移动鼠标至滑条顶端
        await sleep(200);
        leftButtonDown(); // 长按左键重置武器滑条
        await sleep(300);
        leftButtonUp();
        await sleep(200);

        if (!await scanWeapons(Weapon)) { // 未找到指定武器
            log.warn(` ${pageScrollCount+1} 页扫描完，未找到 ${Weapon}`);
        }

        await genshin.returnMainUi(); // 返回主界面
    }
})();
