// =========================================================================
//                          Team.js - 队伍管理模块
// =========================================================================
// 此模块包含队伍切换、角色切换、角色旋转等功能
// 依赖：Utils.js, OCR.js

var Team = {
    // === 常量定义 ===
    // 角色图片路径
    CHARACTER_IMAGE_DIR: 'assets/characterimage/',
    COMBAT_AVATAR_FILE: 'assets/combat_avatar.json',
    
    // 队伍配置相关图片
    TEAM_CONFIG_IMAGE: 'assets/Recognition/队伍配置.png',
    JOIN_BUTTON_IMAGE: 'assets/RecognitionObject/加入.png',
    REPLACE_BUTTON_IMAGE: 'assets/RecognitionObject/更换.png',
    QUICK_SETUP_BUTTON_IMAGE: 'assets/Recognition/Quick Setup Button.png',
    CONFIGURE_TEAM_BUTTON_IMAGE: 'assets/Recognition/Configure Team Button.png',
    CONFIRM_DEPLOY_BUTTON_IMAGE: 'assets/Recognition/Confirm Deploy Button.png',
    
    // === 初始化函数 ===
    
    /**
     * 初始化队伍模块
     */
    init: function() {
        log.info('初始化队伍模块...');
        // 这里可以放置初始化代码
    },
    
    // === 角色旋转器（新增功能） ===
    
    /**
     * 根据 position 自动切换 4 号位角色（支持双模式）
     * @param {Object} position - 位置配置对象
     */
    characterRotator: {
        run: async function (position) {
            setGameMetrics(1920, 1080, 1);
            await genshin.returnMainUi();
            const option = '推荐-换人';
            if (option === '推荐-换人') {
                await this._normalMode(position);
            } else if (option === '换队') {
                await this._quickMode(position);
            } else {
                log.warn(`[CharacterRotator] 未知模式: ${option}`);
            }
            await genshin.returnMainUi();
            genshin.ClearPartyCache();
            log.info('[CharacterRotator] 全部完成');
        },

        /* ---------- 底层工具 ---------- */
        _scrollPage: async function (dist, step = 10, delay = 5) {
            moveMouseTo(400, 750); await sleep(50);
            leftButtonDown();
            const steps = Math.ceil(dist / step);
            for (let j = 0; j < steps; j++) {
                const rem = dist - j * step, mv = rem < step ? rem : step;
                moveMouseBy(0, -mv); await sleep(delay);
            }
            await sleep(700); leftButtonUp(); await sleep(100);
        },
        _readAliases: function () {
            const combat = JSON.parse(file.ReadTextSync(Team.COMBAT_AVATAR_FILE));
            const map = {};
            for (const c of combat) if (c.alias && c.name) for (const a of c.alias) map[a] = c.name;
            return map;
        },
        _loadMat: function (path) {
            try { return file.ReadImageMatSync(path); } catch (e) { return null; }
        },

        /* ---------- 模式 1：非快速配对 ---------- */
        _normalMode: async function (position) {
            const initialAvatars = getAvatars();
            const aliases = this._readAliases();
            const positionposition = [position.position1, position.position2, position.position3, position.position4]
                .map((input, idx) => {
                    if (input && input.trim()) {
                        const real = aliases[input] || input;
                        log.info(`[非快速] ${idx + 1}号位设置【${input}】→ 实际【${real}】`);
                        initialAvatars[idx] = real; return real;
                    } return null;
                });
            const targetAvatars = [...initialAvatars];
            if (positionposition.every(v => !v)) { log.info('[非快速] 未设置任何角色，跳过'); return; }

            /* 预加载所有固定模板 */
            const roTeamConfig = RecognitionObject.TemplateMatch(this._loadMat(Team.TEAM_CONFIG_IMAGE), 0, 0, 1920, 1080);
            const roReplace    = RecognitionObject.TemplateMatch(this._loadMat(Team.REPLACE_BUTTON_IMAGE), 0, 0, 1920, 1080);
            const roJoin       = RecognitionObject.TemplateMatch(this._loadMat(Team.JOIN_BUTTON_IMAGE), 0, 0, 1920, 1080);

            const posCoords = [[460, 538], [792, 538], [1130, 538], [1462, 538]];

            const openPairing = async () => {
                let tries = 0, total = 0;
                while (tries < 3) {
                    keyPress('l'); await sleep(3500);
                    if (captureGameRegion().find(roTeamConfig).isExist()) { tries = 0; return true; }
                    tries++; total++;
                }
                if (total < 6) { await genshin.tp('2297.630859375', '-824.5517578125'); return openPairing(); }
                log.error('[非快速] 无法打开配对界面'); return false;
            };

            const doSwitch = async () => {
                if (!await openPairing()) return false;
                for (let i = 0; i < 4; i++) {
                    const name = positionposition[i];
                    if (!name) { log.info(`[非快速] ${i + 1}号位未设置，跳过`); continue; }
                    const [x, y] = posCoords[i]; click(x, y); await sleep(1000);
                    let found = false, page = 0;
                    while (page < 20 && !found) {
                        for (let num = 1; ; num++) {
                            const file = `${Team.CHARACTER_IMAGE_DIR}/${name}${String(num).padStart(2, '0')}.png`;
                            const mat = this._loadMat(file);
                            if (!mat) break;
                            const ro  = RecognitionObject.TemplateMatch(mat, 0, 0, 1920, 1080);
                            const hit = captureGameRegion().find(ro);
                            if (hit.isExist()) { hit.click(); await sleep(500); found = true; break; }
                        }
                        if (!found) { await this._scrollPage(200); page++; }
                    }
                    if (!found) { log.error(`[非快速] 未找到【${name}】`); continue; }

                    const r1 = captureGameRegion().find(roReplace);
                    const r2 = captureGameRegion().find(roJoin);
                    if (r1.isExist() || r2.isExist()) {
                        await sleep(300); (r1.isExist() ? r1 : r2).click();
                        keyPress('VK_LBUTTON'); await sleep(500);
                    } else { log.info('[非快速] 角色已在队'); keyPress('VK_ESCAPE'); await sleep(500); }
                }
                return true;
            };

            let retry = 0;
            while (retry < 2) {
                if (!await doSwitch()) return;
                await genshin.returnMainUi();
                const final = getAvatars();
                const ok = targetAvatars.length === final.length && targetAvatars.every((v, i) => v === final[i]);
                if (ok) { log.info('[非快速] 角色切换成功'); return; }
                retry++;
            }
            log.error('[非快速] 角色切换失败');
        },
        
        /* ---------- 模式 2：快速配对（仅换队，默认去神像） ---------- */
        _quickMode: async function (position) {
            if (!position.partyName) {
                log.error('[快速] 未指定队伍名称，跳过');
                return;
            }

            /* 1. 强制传送七天神像再换队 */
            log.info('[快速] 传送七天神像切换队伍');
            await genshin.tpToStatueOfTheSeven();

            /* 2. 队伍切换核心逻辑（照搬你提供的 SwitchParty 精简版） */
            const QuickSetupButtonRo   = RecognitionObject.TemplateMatch(this._loadMat(Team.QUICK_SETUP_BUTTON_IMAGE),   1100, 900, 400, 180);

            const ConfigureTeamButtonRo = RecognitionObject.TemplateMatch(
                this._loadMat(Team.CONFIGURE_TEAM_BUTTON_IMAGE), 0, 900, 200, 180);
            const ConfirmDeployButtonRo = RecognitionObject.TemplateMatch(
                this._loadMat(Team.CONFIRM_DEPLOY_BUTTON_IMAGE), 0, 900, 1920, 180);
            const LeftSliderTopRo   = RecognitionObject.TemplateMatch(
                this._loadMat('assets/Recognition/Slider Top.png'), 650, 50, 100, 100);
            const LeftSliderBottomRo= RecognitionObject.TemplateMatch(
                this._loadMat('assets/Recognition/Slider Bottom.png'), 650, 100, 100, 900);

            const partyName = position.partyName;
            let configureStatue = false;

            /* 2.1 进入队伍配置页 */
            let found = false;
            for (let j = 0; j < 2; j++) {
                keyPress('VK_L'); await sleep(2000);
                for (let i = 0; i < 2; i++) {
                    if (captureGameRegion().find(QuickSetupButtonRo).isExist()) {
                        found = true; break;
                    }
                    await sleep(1000);
                }
                if (found) break;
            }
            if (!found) {
                log.error('[快速] 两次尝试都未能进入队伍配置页面');
                return;
            }

            /* 2.2 当前队伍即目标？ */
            const captureRegion = captureGameRegion();
            const resList = captureRegion.findMulti(RecognitionObject.ocr(100, 900, 300, 180));
            for (let i = 0; i < resList.count; i++) {
                if (resList[i].text.includes(partyName)) {
                    log.info('[快速] 当前队伍即为目标队伍，无需切换');
                    keyPress('VK_ESCAPE'); await sleep(500);
                    configureStatue = true; break;
                }
            }

            /* 2.3 真正换队流程 */
            if (!configureStatue) {
                await sleep(1000);
                const cfgBtn = captureGameRegion().find(ConfigureTeamButtonRo);
                if (!cfgBtn.isExist()) {
                    log.error('[快速] 未找到配置队伍按钮');
                    throw new Error('未找到配置队伍按钮');
                }
                cfgBtn.click(); await sleep(500);
                await this._pageTop(LeftSliderTopRo);   // 滑到最顶端

                for (let p = 0; p < 4; p++) {           // 最多翻 4 页
                    const region = captureGameRegion();
                    const list   = region.findMulti(RecognitionObject.ocr(0, 100, 400, 900));
                    for (let i = 0; i < list.count; i++) {
                        const res = list[i];
                        if (res.text.includes(partyName)) {
                            click(Math.ceil(res.x + 360), res.y + Math.ceil(res.Height / 2));
                            await sleep(1500);

                            // 确定 → 部署
                            let confirm = captureGameRegion().find(ConfirmDeployButtonRo);
                            if (confirm.isExist()) { confirm.click(); await sleep(1500); }
                            let deploy  = captureGameRegion().find(ConfirmDeployButtonRo);
                            if (deploy.isExist())  { deploy.click(); configureStatue = true; }
                            break;
                        }
                    }
                    if (configureStatue) break;
                    await this._pageDown(LeftSliderBottomRo);
                }

                if (!configureStatue) {
                    log.error(`[快速] 未找到指定队伍：${partyName}`);
                    throw new Error(`未找到指定队伍：${partyName}`);
                }
            }

            /* 3. 善后 */
            await genshin.returnMainUi();
            log.info('[快速] 队伍切换完成');
        },

        /* 翻页工具 */
        _pageDown: async function (SliderBottomRo) {
            const sb = captureGameRegion().find(SliderBottomRo);
            if (sb.isExist()) {
                click(Math.ceil(sb.x + sb.Width / 2), Math.ceil(sb.y + sb.Height * 2));
                await moveMouseTo(0, 0); await sleep(100);
            }
        },
        _pageTop: async function (SliderTopRo) {
            const st = captureGameRegion().find(SliderTopRo);
            if (st.isExist()) {
                await moveMouseTo(Math.ceil(st.x + st.Width / 2), Math.ceil(st.y + st.Height));
                leftButtonDown(); await sleep(1000); leftButtonUp();
                await moveMouseTo(0, 0); await sleep(100);
            }
        }
    },
    
    // === 原代码中的角色切换函数 ===
    
    /**
     * 切换角色（原switchRoles函数）
     */
    switchRoles: async function() {
        // 设置分辨率
        setGameMetrics(1920, 1080, 1);
        // 返回主界面
        await genshin.returnMainUi();
       //切换配对
       if (settings.switchPartyName) {
         await genshin.switchParty(settings.switchPartyName);
       }

        const option = '推荐-非快速配对模式 @Tool_tingsu';
        if (option === '推荐-非快速配对模式 @Tool_tingsu') {
            await this._normalSwitchMode();
        } else if (option === '存在bug-快速配对模式 @兩夢三醒') {
            await this._quickSwitchMode();
        }
        // 返回主界面
        await genshin.returnMainUi();
        await sleep(1000); // 给引擎收尾时间
    },
    
    /**
     * 模式1：推荐-非快速配对模式
     */
    _normalSwitchMode: async function() {
        const positionCoordinates = [
            [460, 538],
            [792, 538],
            [1130, 538],
            [1462, 538]
        ];

        // 读取别名
        const aliases = this._readAliases();

        const positionSettings = [
            settings.position1,
            settings.position2,
            settings.position3,
            settings.position4
        ].map(input => {
            if (input && input.trim()!== "") {
                const actualName = aliases[input] || input;
                log.info(`设置对应号位为【${input}】，切换角色为【${actualName}】`);
                return actualName;
            }
            return null;
        });

        // 识别对象定义
        const roTeamConfig = RecognitionObject.TemplateMatch(file.ReadImageMatSync(this.TEAM_CONFIG_IMAGE), 0, 0, 1920, 1080);
        const roReplace = RecognitionObject.TemplateMatch(file.ReadImageMatSync(this.REPLACE_BUTTON_IMAGE), 0, 0, 1920, 1080);
        const roJoin = RecognitionObject.TemplateMatch(file.ReadImageMatSync(this.JOIN_BUTTON_IMAGE), 0, 0, 1920, 1080);

        let openPairingTries = 0;
        let totalOpenPairingTries = 0;

        // 在进入角色切换逻辑前进行检测，如果所有角色设置均为空则直接退出
        if (positionSettings.every((item) =>!item)) {
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

            // 最多尝试滚动页面20次
            while (pageTries < 20) {
                // 尝试识别所有可能的角色文件名
                for (let num = 1; ; num++) {
                    const paddedNum = num.toString().padStart(2, "0");
                    const characterFileName = `${selectedCharacter}${paddedNum}`;
                    try {
                        const characterRo = RecognitionObject.TemplateMatch(
                            file.ReadImageMatSync(`${this.CHARACTER_IMAGE_DIR}/${characterFileName}.png`),
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
                    await Utils.scrollPage(200); // 滚动距离可根据实际情况调整
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
                await sleep(300);
                keyPress("VK_ESCAPE");
                await sleep(500);
            }
            await sleep(500);
        }
    },
    
    /**
     * 模式2：存在bug-快速配对模式
     */
    _quickSwitchMode: async function() {
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

        // 角色位置坐标
        const positionCoordinates = [
            [107, 190],
            [254, 188],
            [414, 189],
            [554, 198],
        ];

        // 读取别名
        const aliases = this._readAliases();

        // 获取需要切换的角色，并进行别名替换
        const positionSettings = [settings.position1, settings.position2, settings.position3, settings.position4].map(input => {
            if (input && input.trim()!== "") {
                const actualName = aliases[input] || input;
                log.info(`设置对应号位为【${input}】，切换角色为【${actualName}】`);
                return actualName;
            }
            return null;
        });

        // 识别对象定义
        const roTeamConfig = RecognitionObject.TemplateMatch(file.ReadImageMatSync(this.TEAM_CONFIG_IMAGE), 0, 0, 1920, 1080);

        let openPairingTries = 0;
        let totalOpenPairingTries = 0;

        // 在进入角色切换逻辑前进行检测，如果所有角色设置均为空则直接退出
        if (positionSettings.every((item) =>!item)) {
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
                            file.ReadImageMatSync(`${this.CHARACTER_IMAGE_DIR}/${characterFileName}.png`),
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
                    await Utils.scrollPage(200); // 滚动距离可根据实际情况调整
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
    },
    
    // === 工具函数 ===
    
    /**
     * 读取角色别名文件
     * @returns {Object} 别名映射对象
     */
    _readAliases: function() {
        const combatText = file.ReadTextSync(this.COMBAT_AVATAR_FILE);
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
    
    // === 简单接口函数 ===
    
    /**
     * 切换到指定队伍
     * @param {string} partyName - 队伍名称
     * @returns {Promise<boolean>} 是否成功
     */
    switchToParty: async function(partyName) {
        try {
            log.info(`正在尝试切换至队伍: ${partyName}`);
            const success = await genshin.switchParty(partyName);
            if (!success) {
                log.warn("切换队伍失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                return await genshin.switchParty(partyName);
            }
            return success;
        } catch (error) {
            log.error(`队伍切换失败: ${error.message}`);
            notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
            return false;
        }
    },
    
    /**
     * 获取当前队伍角色
     * @returns {Array<string>} 角色名称数组
     */
    getCurrentTeam: function() {
        return getAvatars();
    }
};

// 自动初始化
if (typeof genshin !== 'undefined') {
    Team.init();
}