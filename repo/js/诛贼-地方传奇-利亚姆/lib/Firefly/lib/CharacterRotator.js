// /* =========================================================
//  *  CharacterRotator.js
//  *  功能：根据 position 自动切换 4 号位角色（支持双模式）
//  *  用法：await CharacterRotator.run();
//  * ========================================================= */
        const option = settings.option1 || '推荐-换人';
const missingChars = (settings.firefly_missing_chars || '').trim();
const forceFixedSwap = missingChars.length === 0;
eval(file.readTextSync("lib/Online/Multiplayer.js"));



var CharacterRotator = {
    // === 角色旋转器模块 ===
        // === 常量定义 ===
        RECOMMENDED_POSITIONS: [
            [460, 538],
            [792, 538],
            [1130, 538],
            [1462, 538]
        ],

        QUICK_POSITIONS: [
            [107, 190],
            [254, 188],
            [414, 189],
            [554, 198]
        ],

        OCR_REGIONS: [
            [340, 181, 315, 330],
            [655, 181, 315, 330],
            [970, 181, 315, 330],
            [1285, 181, 315, 330]
        ],

        // === 核心函数 ===
        /**
         * 滚动页面函数
         * @param {number} totalDistance - 总滚动距离
         * @param {number} stepDistance - 每次滚动距离（默认10）
         * @param {number} delayMs - 滚动延迟（默认5ms）
         */
        scrollPage: async function(totalDistance, stepDistance = 10, delayMs = 5) {
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
        },

        /**
         * 读取别名文件
         * @returns {Object} 别名映射对象
         */
        readAliases: function() {
            const combatText = file.ReadTextSync('assets/combat_avatar.json');
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
        },

        /**
         * 打开配对界面（推荐模式）
         * @param {Object} roTeamConfig - 队伍配置识别对象
         * @returns {boolean} 是否成功打开
         */
        openRecommendedPairingInterface: async function(roTeamConfig) {
            let openPairingTries = 0;
            let totalOpenPairingTries = 0;
            
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
                return this.openRecommendedPairingInterface(roTeamConfig);
            } else {
                log.error("无法打开配对界面，任务结束");
                return false;
            }
        },

        /**
         * 打开配对界面（快速模式）
         * @param {Object} roTeamConfig - 队伍配置识别对象
         * @returns {boolean} 是否成功打开
         */
        openQuickPairingInterface: async function(roTeamConfig) {
            let openPairingTries = 0;
            let totalOpenPairingTries = 0;
            
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
                return this.openQuickPairingInterface(roTeamConfig);
            } else {
                log.error("无法打开配对界面，任务结束");
                return false;
            }
        },

        /**
         * 读取筛选配置文件
         * @returns {Object} 筛选配置对象
         */
        readFilterConfig: function() {
            const filterConfig = {};
            try {
                const filterContent = file.readTextSync('assets/attribute.txt');
                const lines = filterContent.split('\n');
                lines.forEach(line => {
                    const [name, element, weapon] = line.trim().split(/，\s*/).map(item => item || null);
                    if (name) {
                        filterConfig[name] = { element, weapon };
                    }
                });
            } catch (error) {
                log.error(`读取筛选配置失败: ${error}`);
            }
            return filterConfig;
        },

        /**
         * 执行筛选操作
         * @param {string} selectedCharacter - 选择的角色名
         * @param {Object} filterInfo - 筛选信息
         * @param {number} rolenum - 角色位置编号
         * @returns {boolean} 是否有筛选结果
         */
        performFiltering: async function(selectedCharacter, filterInfo, rolenum) {
            if (!filterInfo || !filterInfo.element && !filterInfo.weapon) {
                return true; // 无需筛选
            }

            try {
                log.info(`对角色【${selectedCharacter}】执行筛选: 元素=${filterInfo.element || '空'}, 武器=${filterInfo.weapon || '空'}`);
                
                // 点击筛选按钮
                const ro1 = captureGameRegion();
                const filterBtn = ro1.find(RecognitionObject.TemplateMatch(
                    file.readImageMatSync('assets/RecognitionObject/筛选.png'), 0, 0, 1920, 1080
                ));
                ro1.dispose();
                if (!filterBtn.isExist()) {
                    log.warn('未找到筛选图标: assets/RecognitionObject/筛选.png');
                    return true;
                }
                
                filterBtn.click();
                await sleep(200);
                
                // 元素筛选
                if (filterInfo.element) {
                    const ro2 = captureGameRegion();
                    const elementBtn = ro2.find(RecognitionObject.TemplateMatch(
                        file.readImageMatSync(`assets/RecognitionObject/${filterInfo.element}.png`), 0, 0, 1920, 1080
                    ));
                    ro2.dispose();
                    if (elementBtn.isExist()) {
                        elementBtn.click();
                        await sleep(200);
                    } else {
                        log.warn(`未找到元素筛选图标: assets/RecognitionObject/${filterInfo.element}.png`);
                    }
                }
                
                // 武器筛选
                if (filterInfo.weapon) {
                    const ro3 = captureGameRegion();
                    const weaponBtn = ro3.find(RecognitionObject.TemplateMatch(
                        file.readImageMatSync(`assets/RecognitionObject/${filterInfo.weapon}.png`), 0, 0, 1920, 1080
                    ));
                    ro3.dispose();
                    if (weaponBtn.isExist()) {
                        weaponBtn.click();
                        await sleep(200);
                    } else {
                        log.warn(`未找到武器筛选图标: assets/RecognitionObject/${filterInfo.weapon}.png`);
                    }
                }
                
                // 确认筛选
                const ro4 = captureGameRegion();
                const confirmFilterBtn = ro4.find(RecognitionObject.TemplateMatch(
                    file.readImageMatSync('assets/RecognitionObject/确认筛选.png'), 0, 0, 1920, 1080
                ));
                ro4.dispose();
                if (confirmFilterBtn.isExist()) {
                    confirmFilterBtn.click();
                    await sleep(50);
                    
                    // 检查是否有"暂无筛选结果"提示
                    const noResultTemplate = file.readImageMatSync('assets/RecognitionObject/暂无筛选结果.png');
                    const noResultRo = RecognitionObject.TemplateMatch(noResultTemplate, 0, 0, 1920, 1080);
                    const ro5 = captureGameRegion();
                    const noResult = ro5.find(noResultRo);
                    ro5.dispose();
                    if (noResult.isExist()) {
                        log.warn(`筛选后无结果，跳过${rolenum}号位角色`);
                        // 关闭筛选面板
                        keyPress("VK_ESCAPE");
                        await sleep(200);
                        keyPress("VK_ESCAPE");
                        await sleep(200);
                        keyPress("VK_ESCAPE");
                        await sleep(200);
                        return false;
                    }
                }
            } catch (error) {
                log.error(`筛选操作失败: ${error}`);
            }
            
            return true;
        },

        /**
         * 推荐模式的角色切换逻辑
         * @param {Array} positionSettings - 位置设置数组
         * @param {Object} roTeamConfig - 队伍配置识别对象
         * @param {Object} roReplace - 更换识别对象
         * @param {Object} roJoin - 加入识别对象
         * @returns {boolean} 是否切换成功
         */
        switchCharactersRecommended: async function(positionSettings, roTeamConfig, roReplace, roJoin) {
            if (!(await this.openRecommendedPairingInterface(roTeamConfig))) {
                return false;
            }

            // 读取筛选配置
            const filterConfig = this.readFilterConfig();
            
            for (let i = 0; i < positionSettings.length; i++) {
                let rolenum = i + 1;
                const selectedCharacter = positionSettings[i];
                if (!selectedCharacter) {
                    log.info(`未设置${rolenum}号位角色，跳过`);
                    continue;
                }
                
                const [x, y] = this.RECOMMENDED_POSITIONS[i];
                click(x, y);
                log.info(`开始设置${rolenum}号位角色`);
                await sleep(1000);
                
                // 执行筛选
                const filterInfo = filterConfig[selectedCharacter];
                if (filterInfo) {
                    const hasResult = await this.performFiltering(selectedCharacter, filterInfo, rolenum);
                    if (!hasResult) {
                        continue;
                    }
                }
                
                let characterFound = false;
                let pageTries = 0;
                
                // 查找角色
                while (pageTries < 3) {
                    for (let num = 1; ; num++) {
                        const paddedNum = num.toString().padStart(2, "0");
                        const characterFileName = `${selectedCharacter}${paddedNum}`;
                        try {
                            const characterRo = RecognitionObject.TemplateMatch(
                                file.ReadImageMatSync(`assets/characterimage/${characterFileName}.png`),
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
                            break;
                        }
                    }
                    
                    if (characterFound) break;
                    
                    if (pageTries < 3) {
                        log.info("当前页面没有目标角色，滚动页面");
                        await this.scrollPage(350);
                    }
                    pageTries++;
                }
                
                if (!characterFound) {
                    log.error(`未找到【${selectedCharacter}】`);
                    continue;
                }
                
                // 处理更换/加入
                const replaceResult = captureGameRegion().find(roReplace);
                const joinResult = captureGameRegion().find(roJoin);
                
                if (replaceResult.isExist() || joinResult.isExist()) {
                    await sleep(300);
                    if (replaceResult.isExist()) {
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
        },

        /**
         * 快速模式的角色切换逻辑
         * @param {Array} positionSettings - 位置设置数组
         * @param {Object} roTeamConfig - 队伍配置识别对象
         * @returns {boolean} 是否切换成功
         */
        switchCharactersQuick: async function(positionSettings, roTeamConfig) {
            if (!(await this.openQuickPairingInterface(roTeamConfig))) {
                return false;
            }

            // 统计有文字的区域数量
            let regionsWithTextCount = 0;
            let captureRegion = captureGameRegion();
            for (const [x, y, w, h] of this.OCR_REGIONS) {
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
            
            // 取消选择已有角色
            for (let i = 0; i < regionsWithTextCount; i++) {
                if (i >= this.QUICK_POSITIONS.length) break;
                const [x, y] = this.QUICK_POSITIONS[i];
                click(x, y);
                await sleep(1000);
                log.info(`取消选择${x},${y}位置的角色`);
            }
            
            for (let i = 0; i < positionSettings.length; i++) {
                let rolenum = i + 1;
                const selectedCharacter = positionSettings[i];
                const [x, y] = this.QUICK_POSITIONS[i];
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
                
                // 查找角色
                while (pageTries < 40) {
                    for (let num = 1; ; num++) {
                        const paddedNum = num.toString().padStart(2, "0");
                        const characterFileName = `${selectedCharacter}${paddedNum}`;
                        try {
                            const characterRo = RecognitionObject.TemplateMatch(
                                file.ReadImageMatSync(`assets/characterimage/${characterFileName}.png`),
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
                            break;
                        }
                    }
                    
                    if (characterFound) break;
                    
                    if (pageTries < 30) {
                        log.info(`当前页面没有目标角色【${selectedCharacter}】，滚动页面`);
                        await this.scrollPage(200);
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
            
            // 保存设置
            click(427, 1024);
            await sleep(1000);
            keyPress("VK_LBUTTON");
            await sleep(500);
            return true;
        },

        /**
         * 执行推荐模式
         */
        runRecommendedMode: async function() {
            const initialAvatars = getAvatars();
            const aliases = this.readAliases();
            
            const positionSettings = [
                settings.position1,
                settings.position2,
                settings.position3,
                settings.position4
            ].map((input, index) => {
                if (input && input.trim() !== "") {
                    const actualName = aliases[input] || input;
                    log.info(`设置对应号位为【${input}】，切换角色为【${actualName}】`);
                    initialAvatars[index] = actualName;
                    return actualName;
                }
                return null;
            });
            
            const targetAvatars = [...initialAvatars];
            log.info(`目标角色: [${targetAvatars}]`);
            
            // 识别对象定义
            const roTeamConfig = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`assets/RecognitionObject/队伍配置.png`), 0, 0, 1920, 1080
            );
            const roReplace = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`assets/RecognitionObject/更换.png`), 0, 0, 1920, 1080
            );
            const roJoin = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`assets/RecognitionObject/加入.png`), 0, 0, 1920, 1080
            );
            
            // 检查是否有角色设置
            if (positionSettings.every((item) => !item)) {
                log.info("未设置任何角色，跳过切换队伍步骤");
                await genshin.returnMainUi();
                return;
            }
            
            let retryCount = 0;
            let switchSuccess = false;
            
            while (retryCount < 2) {
                if (!await this.switchCharactersRecommended(
                    positionSettings, roTeamConfig, roReplace, roJoin
                )) {
                    log.error("角色切换过程失败");
                    return;
                }
                
                await genshin.returnMainUi();
                const finalAvatars = getAvatars();
                
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
                    await genshin.returnMainUi();
                }
            }
            
            if (!switchSuccess) {
                log.error("角色切换失败");
            }
        },

        /**
         * 执行快速模式
         */
        runQuickMode: async function() {
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
            
            const initialAvatars = getAvatars();
            const aliases = this.readAliases();
            
            const positionSettings = [
                settings.position1, 
                settings.position2, 
                settings.position3, 
                settings.position4
            ].map((input, index) => {
                if (input && input.trim() !== "") {
                    const actualName = aliases[input] || input;
                    log.info(`设置对应号位为【${input}】，切换角色为【${actualName}】`);
                    initialAvatars[index] = actualName;
                    return actualName;
                }
                return null;
            });
            
            const targetAvatars = [...initialAvatars];
            log.info(`目标角色: [${targetAvatars}]`);
            
            const roTeamConfig = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`assets/RecognitionObject/队伍配置.png`), 0, 0, 1920, 1080
            );
            
            if (positionSettings.every((item) => !item)) {
                log.info("未设置任何角色，跳过切换队伍步骤");
                await genshin.returnMainUi();
                return;
            }
            
            let retryCount = 0;
            let switchSuccess = false;
            
            while (retryCount < 2) {
                if (!await this.switchCharactersQuick(
                    positionSettings, roTeamConfig
                )) {
                    log.error("角色切换过程失败");
                    return;
                }
                
                await genshin.returnMainUi();
                const finalAvatars = getAvatars();
                
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
                    await genshin.returnMainUi();
                }
            }
            
            if (!switchSuccess) {
                log.error("角色切换失败");
            }
        },

        /**
         * 主执行函数
         */
        run: async function() {
            // 设置分辨率
            setGameMetrics(1920, 1080, 1);
            // 返回主界面
            await genshin.returnMainUi();
            
            // 切换配对
            if (settings.switchPartyName) {
                await genshin.switchParty(settings.switchPartyName);
            }

            const option = settings.option;
            if (option === '推荐-非快速配对模式 @Tool_tingsu') {
                await this.runRecommendedMode();
            } else if (option === '存在bug-快速配对模式 @兩夢三醒') {
                await this.runQuickMode();
            }
            
            // 返回主界面
            await genshin.returnMainUi();
            // 清空角色缓存
            genshin.ClearPartyCache();
        },
/**
         * 完整版推荐模式 - 包含打开配对界面、切换角色所有步骤
         * @param {Object} params - 配置参数对象
         * @returns {boolean} 切换是否成功
         */
        _normalMode: async function(params = {}) {
            // 默认参数
            const config = {
                position1: params.position1 || "",
                position2: params.position2 || "",
                position3: params.position3 || "",
                position4: params.position4 || "",
                switchPartyName: params.switchPartyName || null,
                teamConfigImg: params.teamConfigImg || "Assets/RecognitionObject/队伍配置.png",
                checkResult: params.checkResult !== false,
                maxRetries: params.maxRetries || 3,
                ...params
            };
            const pc = await Multiplayer.detectPlayerCount();
        if (!pc || pc.status === false) {
            log.error('智能换人：玩家状态检测失败');
            return 'error';
        }
        const count = pc.count;
            log.info("开始_normalMode完整版角色切换");
            
            // === 1. 读取别名 ===
            const aliases = this.readAliases();
            
            // === 2. 构建位置设置数组 ===
            const positionSettings = [
                config.position1,
                config.position2,
                config.position3,
                config.position4
            ].map((input, index) => {
                if (input && input.trim() !== "") {
                    const actualName = aliases[input] || input;
                    log.info(`[完整模式] 设置${index+1}号位为: ${actualName}`);
                    return actualName;
                }
                return null;
            });
            
            // === 3. 初始化识别对象 ===
            log.info("[完整模式] 初始化识别对象...");
            const roTeamConfig = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(config.teamConfigImg), 0, 0, 1920, 1080
            );
            const roReplace = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`Assets/RecognitionObject/更换.png`), 0, 0, 1920, 1080
            );
            const roJoin = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`Assets/RecognitionObject/加入.png`), 0, 0, 1920, 1080
            );
            
            // === 4. 记录当前角色状态（用于回滚）===
            const originalAvatars = getAvatars();
            
            // === 5. 切换队伍（如果需要）===
            if (config.switchPartyName) {
                log.info(`[完整模式] 切换队伍到: ${config.switchPartyName}`);
                try {
                    await genshin.switchParty(config.switchPartyName);
                    await sleep(1500);
                } catch (error) {
                    log.warn(`队伍切换失败: ${error.message}`);
                    // 如果切换失败，尝试使用七天神像
                    await genshin.tpToStatueOfTheSeven();
                    await sleep(1000);
                    await genshin.switchParty(config.switchPartyName);
                    await sleep(1500);
                }
            }
            
            // === 6. 打开配对界面 ===
            log.info("[完整模式] 正在打开配对界面...");
            let pairingOpened = false;
            let retryCount = 0;
            
            while (retryCount < config.maxRetries && !pairingOpened) {
                // 按L键打开配对界面
                keyPress("l");
                await sleep(3500);
                
                // 检测是否成功打开
                try {
                    const capture = captureGameRegion();
                    const teamConfigResult = capture.find(roTeamConfig);
                    capture.dispose();
                    
                    if (teamConfigResult.isExist()) {
                        pairingOpened = true;
                        log.info("[完整模式] 配对界面打开成功");
                        break;
                    } else {
                        log.warn(`[完整模式] 第${retryCount+1}次尝试打开配对界面失败`);
                        retryCount++;
                        
                        // 如果连续失败，尝试传送并重试
                        if (retryCount >= 2 && retryCount < config.maxRetries) {
                            log.info("[完整模式] 尝试传送并重试...");
                            await genshin.tp("2297.630859375", "-824.5517578125");
                            await sleep(2000);
                        }
                    }
                } catch (error) {
                    log.error(`[完整模式] 检测配对界面出错: ${error.message}`);
                    retryCount++;
                }
            }
            
            if (!pairingOpened) {
                log.error("[完整模式] 无法打开配对界面，任务失败");
                await genshin.returnMainUi();
                return false;
            }
            
            // === 7. 执行角色切换 ===
            log.info("[完整模式] 开始切换角色...");
            const positionCoordinates = [
                [460, 538],
                [792, 538],
                [1130, 538],
                [1462, 538]
            ];
            
            for (let i = 0; i < positionSettings.length; i++) {
                const selectedCharacter = positionSettings[i];
                if (!selectedCharacter) {
                    log.info(`[完整模式] 跳过${i+1}号位（未设置角色）`);
                    continue;
                }
                
                const [x, y] = positionCoordinates[i];
                const rolenum = i + 1;
                
                // 点击角色位置
                click(x, y);
                await sleep(1200);
                
                log.info(`[完整模式] 正在切换${rolenum}号位角色: ${selectedCharacter}`);
                
                // 查找角色
                let characterFound = false;
                let pageTries = 0;
                
                while (pageTries < 3 && !characterFound) {
                    // 尝试识别所有可能的角色图片
                    for (let num = 1; num <= 99; num++) {
                        const paddedNum = num.toString().padStart(2, "0");
                        const characterFileName = `${selectedCharacter}${paddedNum}`;
                        try {
                            const characterRo = RecognitionObject.TemplateMatch(
                                file.ReadImageMatSync(`Assets/characterimage/${characterFileName}.png`),
                                0, 0, 1920, 1080
                            );
                            const capture = captureGameRegion();
                            const characterResult = capture.find(characterRo);
                            capture.dispose();
                            
                            if (characterResult.isExist()) {
                                log.info(`[完整模式] 已找到角色【${selectedCharacter}】`);
                                characterResult.click();
                                await sleep(500);
                                characterFound = true;
                                break;
                            }
                        } catch (error) {
                            // 文件不存在，继续尝试下一个编号
                            if (num >= 5) break; // 最多尝试5个编号
                        }
                    }
                    
                    // 如果没找到，滚动页面继续查找
                    if (!characterFound && pageTries < 2) {
                        log.info(`[完整模式] 当前页面未找到【${selectedCharacter}】，滚动页面`);
                        await this.scrollPage(350);
                        pageTries++;
                        await sleep(800);
                    } else if (!characterFound) {
                        break;
                    }
                }
                
                if (!characterFound) {
                    log.error(`[完整模式] 未找到角色【${selectedCharacter}】`);
                    
                    // 检查角色是否已在队伍中
                    keyPress("VK_ESCAPE");
                    await sleep(800);
                    continue;
                }
                
                // === 8. 处理更换或加入按钮 ===
                log.info(`[完整模式] 处理更换/加入操作...`);
                await sleep(800);
                
                // 同时检测更换和加入按钮
                const captureReplace = captureGameRegion();
                const replaceResult = captureReplace.find(roReplace);
                captureReplace.dispose();
                
                const captureJoin = captureGameRegion();
                const joinResult = captureJoin.find(roJoin);
                captureJoin.dispose();
                
                if (replaceResult.isExist()) {
                    log.info(`[完整模式] 点击更换按钮`);
                    replaceResult.click();
                    await sleep(500);
                } else if (joinResult.isExist()) {
                    log.info(`[完整模式] 点击加入按钮`);
                    joinResult.click();
                    await sleep(500);
                } else {
                    log.info(`[完整模式] 角色【${selectedCharacter}】已在队伍中，跳过`);
                    keyPress("VK_ESCAPE");
                    await sleep(500);
                    continue;
                }
                
                // 点击确认（模拟鼠标左键点击）
                        
        if (count === 0) {
                // keyPress("VK_LBUTTON");
        }

                await sleep(1200);
                
                // 等待界面稳定
                await sleep(1000);
            }
            
            // === 9. 关闭配对界面 ===
            log.info("[完整模式] 角色切换完成，关闭配对界面...");
            keyPress("VK_ESCAPE");
            await sleep(1500);
            
            // === 10. 返回主界面 ===
            log.info("[完整模式] 返回主界面...");
            await genshin.returnMainUi();
            await sleep(2000);
            
            // === 11. 验证结果 ===
            // if (config.checkResult) {
            //     log.info("[完整模式] 验证切换结果...");
            //     const finalAvatars = getAvatars();
                
            //     let success = true;
            //     let successCount = 0;
            //     let totalSet = 0;
                
            //     for (let i = 0; i < positionSettings.length; i++) {
            //         const expected = positionSettings[i];
            //         if (expected) {
            //             totalSet++;
            //             const actual = finalAvatars[i];
                        
            //             if (expected === actual) {
            //                 log.info(`[完整模式] ✓ ${i+1}号位成功: ${expected}`);
            //                 successCount++;
            //             } else {
            //                 log.error(`[完整模式] ✗ ${i+1}号位失败: 期望 ${expected}, 实际 ${actual}`);
            //                 success = false;
            //             }
            //         }
            //     }
                
            //     if (success) {
            //         log.info(`[完整模式] 所有角色切换成功 (${successCount}/${totalSet})`);
            //     } else {
            //         log.warn(`[完整模式] 角色切换部分失败 (${successCount}/${totalSet} 成功)`);
                    
            //         // 自动重试机制（可选）
            //         if (params.autoRetry && successCount < totalSet) {
            //             log.info("[完整模式] 尝试自动重试...");
            //             // 可以添加重试逻辑
            //         }
            //     }
                
            //     // 清空角色缓存
            //     genshin.ClearPartyCache();
                
            //     return success;
            // }
            
            log.info("[完整模式] 角色切换流程完成（未验证结果）");
            genshin.ClearPartyCache();
            return true;
        },
        
        /**
         * 快速切换版本（不检查结果，用于快速操作）
         * @param {Object} params - 配置参数
         * @returns {boolean} 执行是否成功
         */
        quickNormalMode: async function(params = {}) {
            return await this._normalMode({
                ...params,
                checkResult: false,
                maxRetries: 2
            });
        },
        
        /**
         * 安全切换版本（带备份和恢复）
         * @param {Object} params - 配置参数
         * @returns {boolean} 执行是否成功
         */
        safeNormalMode: async function(params = {}) {
            // 备份当前队伍
            const backupAvatars = getAvatars();
            log.info("[安全模式] 备份当前队伍配置");
            
            try {
                // 执行切换
                const result = await this._normalMode(params);
                
                if (!result && params.restoreOnFail !== false) {
                    log.info("[安全模式] 切换失败，恢复原队伍配置");
                    // 恢复原队伍
                    await this._normalMode({
                        position1: backupAvatars[0] || "",
                        position2: backupAvatars[1] || "",
                        position3: backupAvatars[2] || "",
                        position4: backupAvatars[3] || "",
                        checkResult: false
                    });
                }
                
                return result;
            } catch (error) {
                log.error(`[安全模式] 执行出错: ${error.message}`);
                
                // 尝试恢复
                if (params.restoreOnFail !== false) {
                    log.info("[安全模式] 尝试恢复原队伍...");
                    await this._normalMode({
                        position1: backupAvatars[0] || "",
                        position2: backupAvatars[1] || "",
                        position3: backupAvatars[2] || "",
                        position4: backupAvatars[3] || "",
                        checkResult: false
                    });
                }
                
                return false;
            }
        },
            /* ============== 智能换人（弓箭手+盾）前台函数 ============== */
    swapArcherShield: async function () {
        /* 0. 检测玩家数量 → 决定操作位 */
        await genshin.returnMainUi();
        const pc = await Multiplayer.detectPlayerCount();
        if (!pc || pc.status === false) {
            log.error('智能换人：玩家状态检测失败');
            return 'error';
        }
        const count = pc.count;

        /* 0.5 直接获取当前角色列表，不依赖角色编号检测 */
        const rawAvatars = Array.from(getAvatars());
        log.info(`当前队伍角色: ${rawAvatars.join(', ')}`);
        
        // 根据玩家数量构建当前队伍数组
        const current = ['', '', '', ''];
        if (rawAvatars.length > 0) {
            if (count <= 1) {
                // 单人模式：角色在前两个位置
                for (let i = 0; i < Math.min(rawAvatars.length, 4); i++) {
                    current[i] = rawAvatars[i];
                }
            } else {
                // 多人模式：角色在后两个位置
                for (let i = 0; i < Math.min(rawAvatars.length, 2); i++) {
                    current[i + 2] = rawAvatars[i];
                }
            }
        }
        log.info(`当前队伍数组: [${current.join(', ')}]`);

        /* 1. 强制固定换？ */
        if (forceFixedSwap) {
            const archerIdx = count <= 1 ? 0 : 2;
            const shieldIdx = count <= 1 ? 1 : 3;
            
            // 检查是否已经是正确的芙宁娜和雷电将军
            const isAlready = current[archerIdx] === '芙宁娜' && current[shieldIdx] === '雷电将军';
            if (isAlready) {
                log.info(`[强制] ${count}人队伍 目标位已是芙宁娜+雷电将军，跳过换人`);
                return 'ok';
            }
            
            // 检查是否错位（芙宁娜在盾位，雷电将军在弓箭手位）
            const isWrongPosition = current[archerIdx] === '雷电将军' && current[shieldIdx] === '芙宁娜';
            
            if (isWrongPosition) {
                log.info(`[强制] ${count}人队伍 检测到错位：弓箭手位是雷电将军，盾位是芙宁娜，进行中转互换`);
                
                // 第一步：先把两个位置换成临时角色（凯亚，芭芭拉）
                const tempPosition = [...current];
                tempPosition[archerIdx] = '凯亚';
                tempPosition[shieldIdx] = '芭芭拉';
                
                // 将数组转换为对象格式
                await this._normalMode({
                    position1: tempPosition[0],
                    position2: tempPosition[1],
                    position3: tempPosition[2],
                    position4: tempPosition[3]
                });
                
                // 等待换人动画完成
                await sleep(200);
                
                // 第二步：再换回正确的角色（芙宁娜和雷电将军）
                const finalPosition = [...tempPosition];
                finalPosition[archerIdx] = '芙宁娜';
                finalPosition[shieldIdx] = '雷电将军';
                
                // 将数组转换为对象格式
                await this._normalMode({
                    position1: finalPosition[0],
                    position2: finalPosition[1],
                    position3: finalPosition[2],
                    position4: finalPosition[3]
                });
                
                log.info(`[强制] ${count}人队伍 已完成错位修正 芙宁娜→${archerIdx + 1}号位 雷电将军→${shieldIdx + 1}号位`);
                return 'ok';
            }
            
            // 普通强制替换（既不是正确位置也不是错位情况）
            const position = [...current]; // 保持其他位置不变
            position[archerIdx] = '芙宁娜';
            position[shieldIdx] = '雷电将军';
            
            // 将数组转换为对象格式
            await this._normalMode({
                position1: position[0],
                position2: position[1],
                position3: position[2],
                position4: position[3]
            });
            log.info(`[强制] ${count}人队伍 已固定换 芙宁娜→${archerIdx + 1}号位 雷电将军→${shieldIdx + 1}号位`);
            return 'ok';
        }

        /* 2. 池子匹配 + 是否已符合 */
        const archers = [
            '茜特菈莉', '伊涅芙', '爱可菲', '玛薇卡', '芙宁娜', '艾梅莉埃', '纳西妲',
            '多莉', '菈乌玛', '八重神子', '瑶瑶', '菲谢尔', '千织',
            '雷电将军', '白术', '茜特菈莉',  '莱依拉', '北斗'
        ];
        const shields = [
            '茜特菈莉', '伊涅芙', '爱可菲', '玛薇卡', '芙宁娜', '艾梅莉埃', '纳西妲',
            '多莉', '菈乌玛', '八重神子', '瑶瑶', '菲谢尔', '千织',
            '雷电将军', '白术', '茜特菈莉',  '莱依拉', '北斗'
        ];

        const archerIdx = count <= 1 ? 0 : 2;   
        const shieldIdx = count <= 1 ? 1 : 3;   

        // const currentArcher = current[archerIdx];
        // const currentShield = current[shieldIdx];

        // const isOrderOk = archers.includes(currentArcher) && shields.includes(currentShield);
        // if (isOrderOk) {
        //     log.info(`智能换人：${archerIdx + 1}号位已是后台、${shieldIdx + 1}号位已是伤害，无需操作`);
        //     return 'ok';
        // }

        /* 3. 检查是否需要两人互换的特殊处理 */
        // const archerInShieldPos = archers.includes(current[shieldIdx]);  // 弓箭手是否在盾位
        // const shieldInArcherPos = shields.includes(current[archerIdx]);  // 盾是否在弓箭手位
        
        // 如果是两人互换的情况
        // if (archerInShieldPos && shieldInArcherPos) {
        //     log.info(`检测到两人互换`);
            
        //     // 固定使用凯亚，芭芭拉作为临时角色
        //     const tempArcher = '凯亚';
        //     const tempShield = '芭芭拉';
            
        //     log.info(`临时替换：${archerIdx + 1}号位→${tempArcher}，${shieldIdx + 1}号位→${tempShield}`);
            
        //     // 第一步：先把两个位置换成临时角色
        //     const tempPosition = [...current];
        //     tempPosition[archerIdx] = tempArcher;
        //     tempPosition[shieldIdx] = tempShield;
            
        //     // 将数组转换为对象格式
        //     await this._normalMode({
        //         position1: tempPosition[0],
        //         position2: tempPosition[1],
        //         position3: tempPosition[2],
        //         position4: tempPosition[3]
        //     });
            
        //     // 等待换人动画完成
        //     await sleep(200);
            
        //     // 第二步：再换回正确的角色（互换位置）
        //     const finalPosition = [...tempPosition];
        //     finalPosition[archerIdx] = current[shieldIdx];  // 原盾位的弓箭手放到弓箭手位
        //     finalPosition[shieldIdx] = current[archerIdx];  // 原弓箭手位的盾放到盾位
            
        //     // 将数组转换为对象格式
        //     await this._normalMode({
        //         position1: finalPosition[0],
        //         position2: finalPosition[1],
        //         position3: finalPosition[2],
        //         position4: finalPosition[3]
        //     });
            
        //     log.info(`智能换人：已完成互换 ${archerIdx + 1}号位→${finalPosition[archerIdx]}，${shieldIdx + 1}号位→${finalPosition[shieldIdx]}`);
        //     return 'ok';
        // }

        const backupChars = missingChars.length ? missingChars.split(/\s+/) : [];

        // 决定最终补位角色
        const [subDps, subHealer] = backupChars.length >= 2  ? backupChars : ['凯亚', '芭芭拉'];   


        /* 4. 普通情况：不符合 → 直接用凯亚，芭芭拉 */
        const positionFinal = [...current];
        positionFinal[archerIdx] = subDps;
        positionFinal[shieldIdx] = subHealer;

        // 将数组转换为对象格式
        await this._normalMode({
            position1: positionFinal[0],
            position2: positionFinal[1],
            position3: positionFinal[2],
            position4: positionFinal[3]
        });
        log.info(`智能换人：已换为 ${archerIdx + 1}号位凯亚、${shieldIdx + 1}号位芭芭拉`);
        return 'ok';
    }


    
};