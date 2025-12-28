// =========================================================================
//                          OCR.js - 图像识别模块
// =========================================================================
// 此模块包含所有图像识别和文字识别相关函数
// 依赖：Utils.js

var OCR = {
    // === 常量定义 ===
    // 根据实际文件结构修正路径
    PAIMON_MENU_IMAGE: 'assets/Recognition/paimon_menu.png',
    SOU_IMAGE: 'assets/sou.png',
    F2_2P_IMAGE: 'assets/2p.png',
    COOP_MODE_PAGE_IMAGE: 'assets/Co-Op Mode Page.png',
    SLIDER_BOTTOM_IMAGE: 'assets/Slider Bottom.png',
    CHARACTER_MENU_IMAGE: 'assets/Recognition/Friends Button.png',
    SLIDER_TOP_IMAGE: 'assets/Slider Top.png',
    LV_IMAGE: 'assets/Lv.png',
    PEOPLE1_IMAGE: 'assets/People1.png',
    MAIN_UI_IMAGE: 'assets/MainUI.png',
    F_DIALOGUE_IMAGE: 'assets/F_Dialogue.png',
    CONFIRM_IMAGE: 'assets/confirm.png',
    
    // 玩家标识图片
    PLAYER_SIGN_IMAGES: {
        "1P": "assets/1P.png",
        "2P": "assets/2P.png",
        "3P": "assets/3P.png",
        "4P": "assets/4P.png"
    },
    
    // 对话框图片
    DIALOG_IMAGES: {
        "0P": "assets/dialog01.png",
        "2P": "assets/dialog02.png",
        "4P": "assets/dialog04.png"
    },
    
    // 队伍配置相关图片（位于RecognitionObject目录）
    TEAM_CONFIG_IMAGE: 'assets/RecognitionObject/队伍配置.png',
    JOIN_BUTTON_IMAGE: 'assets/RecognitionObject/加入.png',
    REPLACE_BUTTON_IMAGE: 'assets/RecognitionObject/更换.png',
    
    // === 识别对象 ===
    // 这些对象将在初始化时创建
    paimonMenuRo: null,
    souRo: null,
    f2_2pRo: null,
    opModePageRo: null,
    SliderBottomRo: null,
    CharacterMenuRo: null,
    LeftSliderTopRo: null,
    LeftSliderBottomRo: null,
    MiddleSliderTopRo: null,
    MiddleSliderBottomRo: null,
    RightSliderTopRo: null,
    RightSliderBottomRo: null,
    LvRo1: null,
    LvRo2: null,
    LvRo3: null,
    LvRo4: null,
    LvRo5: null,
    LvRo6: null,
    TeamConfigRo: null,
    JoinButtonRo: null,
    ReplaceButtonRo: null,
    PlayerSignRo1: null,
    PlayerSignRo2: null,
    PlayerSignRo3: null,
    PlayerSignRo4: null,
    DialogRo0: null,
    DialogRo2: null,
    DialogRo4: null,
    
    // === 初始化函数 ===
    
    /**
     * 初始化所有识别对象
     */
    init: function() {
        log.info('初始化OCR识别对象...');
        
        // 派蒙菜单相关
        this.paimonMenuRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.PAIMON_MENU_IMAGE), 
            0, 0, genshin.width / 3.0, genshin.width / 5.0
        );
        
        this.souRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SOU_IMAGE),
            1611, 92, 150, 55
        );
        
        this.f2_2pRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.F2_2P_IMAGE), 
            0, 0, genshin.width / 3.0, genshin.width / 5.0
        );
        
        this.opModePageRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.COOP_MODE_PAGE_IMAGE), 
            0, 0, genshin.width / 3.0, genshin.width / 5.0
        );
        
        this.SliderBottomRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE), 
            1800, 100, 10, 900
        );
        
        this.CharacterMenuRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.CHARACTER_MENU_IMAGE)
        );
        
        // 滑块识别对象
        this.LeftSliderTopRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SLIDER_TOP_IMAGE), 
            650, 50, 100, 100
        );
        
        this.LeftSliderBottomRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE), 
            650, 100, 100, 900
        );
        
        this.MiddleSliderTopRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SLIDER_TOP_IMAGE), 
            1250, 50, 100, 200
        );
        
        this.MiddleSliderBottomRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE), 
            1250, 100, 100, 900
        );
        
        this.RightSliderTopRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SLIDER_TOP_IMAGE), 
            1750, 100, 100, 100
        );
        
        this.RightSliderBottomRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE), 
            1750, 100, 100, 900
        );
        
        // 等级识别对象
        this.LvRo1 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.LV_IMAGE), 
            310, 170 + 130 * 0, 222, 130
        );
        
        this.LvRo2 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.LV_IMAGE), 
            310, 170 + 130 * 1, 222, 130
        );
        
        this.LvRo3 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.LV_IMAGE), 
            310, 170 + 130 * 2, 222, 130
        );
        
        this.LvRo4 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.LV_IMAGE), 
            310, 170 + 130 * 3, 222, 130
        );
        
        this.LvRo5 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.LV_IMAGE), 
            310, 170 + 130 * 4, 222, 130
        );
        
        this.LvRo6 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.LV_IMAGE), 
            310, 170 + 130 * 5, 222, 130
        );
        
        // 队伍配置识别对象
        this.TeamConfigRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.TEAM_CONFIG_IMAGE), 
            0, 0, genshin.width, genshin.height
        );
        
        this.JoinButtonRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.JOIN_BUTTON_IMAGE), 
            0, 0, genshin.width, genshin.height
        );
        
        this.ReplaceButtonRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.REPLACE_BUTTON_IMAGE), 
            0, 0, genshin.width, genshin.height
        );
        
        // 玩家标识识别对象
        this.PlayerSignRo1 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.PLAYER_SIGN_IMAGES["1P"]),
            344, 22, 45, 45
        );
        
        this.PlayerSignRo2 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.PLAYER_SIGN_IMAGES["2P"]),
            344, 22, 45, 45
        );
        
        this.PlayerSignRo3 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.PLAYER_SIGN_IMAGES["3P"]),
            344, 22, 45, 45
        );
        
        this.PlayerSignRo4 = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(this.PLAYER_SIGN_IMAGES["4P"]),
            344, 22, 45, 45
        );
        
        log.info('OCR识别对象初始化完成');
    },
    
    // === 基础图像识别函数 ===
    
    /**
     * 识别图像
     * @param {Object} recognitionObject - 识别对象
     * @param {number} timeout - 超时时间(毫秒)
     * @returns {Object} 识别结果 {success: boolean, x: number, y: number}
     */
    recognizeImage: async function(recognitionObject, timeout = 5000) {
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 使用安全执行
                const result = await Utils.safeExecute(() => {
                    const imageResult = captureGameRegion().find(recognitionObject);
                    return imageResult;
                }, 'recognizeImage');
                
                if (result && result.x !== undefined && result.y !== undefined) {
                    return { success: true, x: result.x, y: result.y };
                }
            } catch (error) {
                // 非取消异常，记录错误
                if (!Utils.isTaskCanceledError(error)) {
                    log.error(`识别图像时发生异常: ${error.message}`);
                }
            }
            await sleep(500);
        }
        log.warn(`经过多次尝试，仍然无法识别图像`);
        return { success: false };
    },
    
    /**
     * 识别文字并点击
     * @param {string} targetText - 目标文字
     * @param {Object} ocrRegion - OCR区域 {x, y, width, height}
     * @param {number} timeout - 超时时间(毫秒)
     * @returns {Object} 结果 {success: boolean, x: number, y: number}
     */
    recognizeTextAndClick: async function(targetText, ocrRegion, timeout = 300) {
        let startTime = Date.now();
        let retryCount = 0; // 重试计数
        
        while (Date.now() - startTime < timeout) {
            try {
                // 使用安全执行
                const resList = await Utils.safeExecute(() => {
                    return captureGameRegion().findMulti(
                        RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
                    );
                }, 'recognizeTextAndClick-OCR');
                
                if (resList) {
                    for (let res of resList) {
                        let correctedText = res.text;
                        if (correctedText.includes(targetText)) {
                            let centerX = Math.round(res.x + res.width / 2);
                            let centerY = Math.round(res.y + res.height / 2);
                            
                            // 点击也使用安全执行
                            await Utils.safeExecute(async () => {
                                await click(centerX, centerY);
                                await sleep(500);
                            }, 'recognizeTextAndClick-click');
                            
                            return { success: true, x: centerX, y: centerY };
                        }
                    }
                }
            } catch (error) {
                if (!Utils.isTaskCanceledError(error)) {
                    retryCount++;
                    log.warn(`页面标志识别失败，正在进行第 ${retryCount} 次重试...`);
                }
            }
            await sleep(100);
        }
        
        log.warn(`经过多次尝试，仍然无法识别文字: ${targetText},尝试点击默认中心位置`);
        let centerX = Math.round(ocrRegion.x + ocrRegion.width / 2);
        let centerY = Math.round(ocrRegion.y + ocrRegion.height / 2);
        
        try {
            await Utils.safeExecute(async () => {
                await click(centerX, centerY);
                await sleep(1000);
            }, 'recognizeTextAndClick-defaultClick');
        } catch (error) {
            // 忽略取消异常
        }
        
        return { success: false };
    },
    
    /**
     * 在指定区域进行OCR识别
     * @param {Object} ocrRegion - OCR区域 {x, y, width, height}
     * @param {number} timeout - 超时时间(毫秒)
     * @returns {string|null} 识别到的文字内容
     */
    recognizeTextInRegion: async function(ocrRegion, timeout = 5000) {
        let startTime = Date.now();
        let retryCount = 0; // 重试计数
        while (Date.now() - startTime < timeout) {
            try {
                // 在指定区域进行 OCR 识别
                const ocrResult = await Utils.safeExecute(() => {
                    return captureGameRegion().find(
                        RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
                    );
                }, 'recognizeTextInRegion');
                
                if (ocrResult) {
                    let correctedText = ocrResult.text;
                    return correctedText; // 返回识别到的内容
                } else {
                    log.warn(`OCR 识别区域未找到内容`);
                    return null; // 如果 OCR 未识别到内容，返回 null
                }
            } catch (error) {
                if (!Utils.isTaskCanceledError(error)) {
                    retryCount++; // 增加重试计数
                    log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
                }
            }
            await sleep(100); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
        return null; // 如果未识别到文字，返回 null
    },
    
    // === 新增OCR函数 ===
    
    /**
     * OCR 识别固定矩形区域（无关键词过滤，最快 200 ms 超时）
     * @param {{x:number, y:number, width:number, height:number}} rect  识别区域（像素）
     * @param {number} [timeout=300]  最长等待时间（毫秒，默认 300）
     * @returns {string}  识别到的全部文字（未识别到返回空字符串）
     */
    ocrFixedRect: async function(rect, timeout = 300) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const roi = await Utils.safeExecute(() => captureGameRegion(), 'ocrFixedRect-capture');
                if (!roi) return '';
                
                const ocrObj = RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height);
                const resList = await Utils.safeExecute(() => Array.from(roi.findMulti(ocrObj) || []), 'ocrFixedRect-find');
                const text = resList.map(r => r.text).join('');
                if (text.length) return text;
            } catch (e) {
                if (!Utils.isTaskCanceledError(e)) {
                    log.error(`[ocrFixedRect] ${e.message}`);
                }
            }
            await sleep(50); // 短间隔快速重试
        }
        return '';
    },
    
    /**
     * 在游戏区域中查找模板图片并返回其中心点
     * @param {string} imgVar  模板图片变量名（需提前在函数外初始化）
     * @returns {{x:number, y:number}|null}  找到返回中心点坐标，未找到返回 null
     */
    findImageCenter: function(imgVar) {
        try {
            const region = captureGameRegion();
            const found = region.find(imgVar);

            if (found && found.x !== 0 && found.y !== 0) {
                // 计算中心点
                const cx = found.x + imgVar.TemplateMat.cols / 2;
                const cy = found.y + imgVar.TemplateMat.rows / 2;
                log.info(`[findImageCenter] 找到 ${imgVar.Name || '图片'}，中心 (${cx}, ${cy})`);
                return { x: cx, y: cy };
            }
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[findImageCenter] 异常: ${error.message}`);
            }
        }
        return null;
    },
    
    /**
     * 获取联机世界当前玩家数
     * @param {boolean} [openF2IfFail=false]  若当前界面未识别到人数，是否再按 F2 重新识别一次
     * @returns {[number, number]}  [快速识别结果, 最终确认结果]（0 表示未识别到）
     */
    getPlayerSign: async function(openF2IfFail = false) {
        // 1. 快速识别
        await genshin.returnMainUi();
        await sleep(500);
        const [p1Ro, p2Ro, p3Ro, p4Ro] = [this.PlayerSignRo1, this.PlayerSignRo2, this.PlayerSignRo3, this.PlayerSignRo4];
        moveMouseTo(1555, 860);
        
        try {
            const region = await Utils.safeExecute(() => captureGameRegion(), 'getPlayerSign-capture');
            if (!region) return [0, 0];
            
            const a = [region.Find(p1Ro), region.Find(p2Ro), region.Find(p3Ro), region.Find(p4Ro)]
                .findIndex(r => r.isExist()) + 1 || 0;
            region.dispose();

            // 2. 若允许二次识别且快速结果为 2
            if (openF2IfFail && a === 2) {
                keyPress('VK_F2');
                await sleep(700);
                click(1, 1);
                await sleep(500);
                const text = await this.ocrFixedRect({ x: 830, y: 90, width: 260, height: 40 }, 200);
                const m = text.match(/当前游戏进度内人数([1-4])\/4/);
                await genshin.returnMainUi();
                return [a, m ? Number(m[1]) : 0];
            }
            return [a, 0];
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[getPlayerSign] 异常: ${error.message}`);
            }
            return [0, 0];
        }
    },
    
    /**
     * 检测最靠下对话框所属玩家（0P|2P|4P），0=未检测到{不打开！}
     * 逻辑不变：
     *  1. 先固定位置检测 dialogP0（零号素材）
     *  2. 若0号存在，直接返回0
     *  3. 若0号不存在，纵向扫描2P/4P，谁在最下返回谁
     * @returns {number} 0 | 2 | 4 | 0(都未检测到)
     */
    getLowerDialog: async function() {
        setGameMetrics(1920, 1080, 1.0);
        await genshin.returnMainUi(); 
        await sleep(200);

        try {
            // 0️⃣ 固定位置检 dialogP0（33×26  @ 47,870）
            const mat0 = file.ReadImageMatSync(this.DIALOG_IMAGES["0P"]);
            const roi0 = RecognitionObject.TemplateMatch(mat0, 33, 1020, 53, 36);
            const found0 = await Utils.safeExecute(() => captureGameRegion().Find(roi0), 'getLowerDialog-find0');
            
            if (found0 && found0.isExist()) {
                log.info('对话框未更新');
                await genshin.returnMainUi();
                return 0;
            }

            // 1️⃣ 共用竖带 30-80（50宽） 880-1025
            const stepY   = 8;
            const iconH   = 17;
            const maxY    = 1025;
            const stripX  = 30;
            const stripW  = 50;
            let best      = { player: 0, y: -1, x: -1 };

            // 先扫2P
            const mat2 = file.ReadImageMatSync(this.DIALOG_IMAGES["2P"]);
            for (let y = 880; y <= maxY - iconH; y += stepY) {
                const roi = RecognitionObject.TemplateMatch(mat2, stripX, y, stripW, maxY - y);
                const f = await Utils.safeExecute(() => captureGameRegion().Find(roi), `getLowerDialog-find2-${y}`);
                if (f && f.isExist() && f.y > best.y) best = {player: 2, y: f.y, x: f.x};
            }

            // 再扫4P
            const mat4 = file.ReadImageMatSync(this.DIALOG_IMAGES["4P"]);
            for (let y = 880; y <= maxY - iconH; y += stepY) {
                const roi = RecognitionObject.TemplateMatch(mat4, stripX, y, stripW, maxY - y);
                const f = await Utils.safeExecute(() => captureGameRegion().Find(roi), `getLowerDialog-find4-${y}`);
                if (f && f.isExist() && f.y > best.y) best = {player: 4, y: f.y, x: f.x};
            }

            // 最终结果日志
            if (best.player === 0) {
                log.info('未检测到2P/4P对话框');
            } else {
                log.info(`最下方对话框玩家=${best.player}P  坐标(${best.x}, ${best.y})`);
            }
            return best.player;
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[getLowerDialog] 异常: ${error.message}`);
            }
            return 0;
        }
    },
    
    // === 界面检测函数 ===
    
    /**
     * 检测派蒙菜单或联机页面
     * @returns {Promise<boolean>} 是否找到派蒙菜单或联机页面
     */
    checkPaimonOrCoop: async function() {
        try {
            const region = await Utils.safeExecute(() => captureGameRegion(), 'checkPaimonOrCoop-capture');
            if (!region) return false;

            const pFound = region.find(this.paimonMenuRo);
            if (pFound && pFound.x !== 0 && pFound.y !== 0) {
                log.info(`[checkPaimonOrCoop] 找到 paimonMenuRo，坐标 (${pFound.x}, ${pFound.y})`);
                await Utils.drawAndClearRedBox(pFound, 500);
                return true;
            }

            const oFound = region.find(this.opModePageRo);
            if (oFound && oFound.x !== 0 && oFound.y !== 0) {
                log.info(`[checkPaimonOrCoop] 找到 opModePage，坐标 (${oFound.x}, ${oFound.y})`);
                await Utils.drawAndClearRedBox(oFound, 500);
                return true;
            }
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[checkPaimonOrCoop] 异常: ${error.message}`);
            }
        }
        return false;
    },
    

    /**
     * 检测滑块底部位置是否在 y < 400
     * @returns {Promise<boolean>} 滑块是否在顶部位置
     */
    checkSliderBottom: async function() {
        try {
            const region = await Utils.safeExecute(() => captureGameRegion(), 'checkSliderBottom-capture');
            if (!region) return false;
            
            const found = region.find(this.SliderBottomRo);
            if (found && found.y < 400) {
                log.info(`[checkSliderBottom] 找到 SliderBottom，坐标 (${found.x}, ${found.y})`);
                await Utils.drawAndClearRedBox(found, 500);
                return true;
            }
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[checkSliderBottom] 异常: ${error.message}`);
            }
        }
        return false;
    },
    
    /**
     * 判断是否处于游戏主界面
     * @returns {Promise<boolean>} 是否在主界面
     */
    isMainUI: async function() {
        const SCAN_REGION = { x: 0, y: 0, width: 150, height: 150 };
        const MAX_ATTEMPTS = 2;
        
        let attempts = 0;
        
        try {
            const template = file.ReadImageMatSync(this.MAIN_UI_IMAGE);
            
            while (attempts < MAX_ATTEMPTS) {
                try {
                    const recognizer = RecognitionObject.TemplateMatch(
                        template,
                        SCAN_REGION.x,
                        SCAN_REGION.y,
                        SCAN_REGION.width,
                        SCAN_REGION.height
                    );
                    
                    // 在游戏区域查找匹配项
                    const result = await Utils.safeExecute(() => captureGameRegion().find(recognizer), 'isMainUI-find');
                    if (result && result.isExist()) return true;
                    
                    attempts++;
                    await sleep(2); // 短暂等待后重试
                } catch (error) {
                    // 检查是否是任务取消错误
                    if (Utils.isTaskCanceledError(error)) {
                        log.debug(`主界面识别任务被取消`);
                        return false;
                    }
                    log.error(`主界面识别异常: ${error.message}`);
                    return false;
                }
            }
        } catch (error) {
            // 文件读取失败或其他错误
            if (Utils.isTaskCanceledError(error)) {
                log.debug(`主界面识别任务被取消`);
                return false;
            }
            log.error(`主界面识别初始化异常: ${error.message}`);
        }
        return false;
    },
    

    
    // === 通用图像匹配函数 ===
    
    /**
     * 检测队伍配置界面
     * @returns {boolean} 是否找到队伍配置界面
     */
    checkTeamConfig: function() {
        try {
            const region = captureGameRegion();
            const found = region.find(this.TeamConfigRo);
            return found && found.isExist();
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[checkTeamConfig] 异常: ${error.message}`);
            }
            return false;
        }
    },
    
    /**
     * 检测加入按钮
     * @returns {boolean} 是否找到加入按钮
     */
    checkJoinButton: function() {
        try {
            const region = captureGameRegion();
            const found = region.find(this.JoinButtonRo);
            return found && found.isExist();
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[checkJoinButton] 异常: ${error.message}`);
            }
            return false;
        }
    },
    
    /**
     * 检测更换按钮
     * @returns {boolean} 是否找到更换按钮
     */
    checkReplaceButton: function() {
        try {
            const region = captureGameRegion();
            const found = region.find(this.ReplaceButtonRo);
            return found && found.isExist();
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`[checkReplaceButton] 异常: ${error.message}`);
            }
            return false;
        }
    }
};

// 如果独立运行，自动初始化
if (typeof genshin !== 'undefined' && genshin.width) {
    OCR.init();
}