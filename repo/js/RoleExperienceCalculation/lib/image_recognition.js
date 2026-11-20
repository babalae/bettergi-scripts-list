var ImageRecognition = {
    /** 
     * 识别角色
     * @param Role
     * @return {Promise<boolean>}
     */
    roleRecognition: async function (Role) {
        let currentPage = 0;
        let allPaths = file.readPathSync('assets/characterimage');
        allPaths = Array.from(allPaths);

        // 提取allPaths中的所有文件名（不包含路径）
        const allFileNames = allPaths.map(path => {
            // 处理正斜杠或反斜杠分隔符，取最后一个部分作为文件名
            const parts = path.split(/[\\\/]/);
            return parts[parts.length - 1];
        });

        while (currentPage < 5) {
            // 遍历该角色的所有模板
            for (let num = 1; ; num++) {
                const paddedNum = num.toString().padStart(2, "0");
                const characterFileName = `${Role}${paddedNum}`;
                const templateFileName = `${characterFileName}.png`;  // 模板文件名
                const templatePath = `assets/characterimage/${templateFileName}`;  // 完整模板路径

                // 检查模板文件是否存在 - 通过比较文件名
                if (!allFileNames.includes(templateFileName)) {
                    break;  // 文件不存在，跳出循环
                }

                try {
                    const templateMat = file.readImageMatSync(templatePath);
                    const template = RecognitionObject.TemplateMatch(templateMat, 0, 0, 1920, 1080);

                    // 捕获当前屏幕
                    const screenRO = captureGameRegion();
                    const result = screenRO.find(template);
                    screenRO.dispose(); // 释放屏幕捕获资源

                    if (result.isExist()) {
                        log.info(`找到角色【${Role}】`);
                        templateMat.dispose(); // 释放模板资源
                        result.click();
                        return true;
                    }

                    templateMat.dispose(); // 释放模板资源
                } catch (error) {
                    log.error(`处理模板 ${templatePath} 时出错: ${error}`);
                    break;
                }
            }

            // 如果没找到，滚动到下一页
            log.info("当前页面没有目标角色，滚动页面");
            await UI.scrollPageFlexible(Math.ceil(genshin.height / 5));
            await sleep(800); // 等待页面稳定

            currentPage++;
        }

        log.error(`未找到角色【${Role}】`);
        return false;
    },
    
    /**
     * OCR识别函数
     * @param {number} timeout - 超时时间（毫秒）
     * @param {Object} Region - 识别区域（包含X/Y/Width/Height）
     * @returns {string | null}  - 返回清理后的识别文字（无特殊符号，仅保留/）
     */
    ocrRecognize: function (timeout = 5000, Region) {
        let startTime = Date.now();
        let attemptCount = 0;

        while (Date.now() - startTime < timeout) {
            attemptCount++;
            try {
                // 捕获整个游戏区域
                const gameCaptureRegion = captureGameRegion();

                // 裁剪出识别区域
                const croppedRegion = gameCaptureRegion.deriveCrop(
                    Region.X,
                    Region.Y,
                    Region.Width,
                    Region.Height
                );

                let results = croppedRegion.findMulti(RecognitionObject.ocrThis);

                // 释放资源
                gameCaptureRegion.dispose();
                croppedRegion.dispose();

                if (results && results.count > 0) {
                    let text = "";
                    for (let i = 0; i < results.count; i++) {
                        if (results[i].text && results[i].text.trim()) {
                            text += results[i].text + " ";
                        }
                    }

                    // 清理特殊字符后再返回
                    const cleanedText = ImageRecognition.cleanOcrText(text);
                    if (cleanedText) {
                        return cleanedText;
                    }
                } else {
                    // 每100次重试输出日志
                    if (attemptCount % 100 === 0) {
                        log.debug(`OCR识别第${attemptCount}次重试：未识别到文本`);
                    }
                }

            } catch (error) {
                if (attemptCount % 100 === 0) {
                    log.warn(`OCR识别发生错误: ${error.message}`);
                }
            }
        }
        // 超时未识别到有效内容，返回null
        return null;
    },

    /**
     * 清理Ocr识别文本：仅保留中文、数字、字母、白名单符号（/），去除所有其他标点/特殊符号
     * @param {string} text - 原始识别文本
     * @returns {string} 清理后的文本
     */
    cleanOcrText: function (text) {
        if (!text || typeof text !== 'string') return '';
        // 正则说明：
        // [\u4e00-\u9fa5] 匹配中文
        // [0-9a-zA-Z] 匹配数字、大小写字母
        // \/ 匹配白名单符号 /（需转义）
        // + 匹配1个及以上符合规则的字符
        const validCharRegex = /[\u4e00-\u9fa50-9a-zA-Z\/]+/g;
        // 提取所有有效字符片段，拼接后去重空格（避免多个/连续）
        const validParts = text.match(validCharRegex) || [];
        return validParts.join('').replace(/\s+/g, ' ').trim();
    },

    /**
     * 识别背包内经验书数量
     * @return {Promise<{[key: string]: number}|null>} 返回经验书名称和数量的对象，失败返回null
     */
    IdentifyExperienceBook: async function() {
        let screenRO = null;
        let result = null;

        try {
            // 定义经验书模板
            const EXP_BOOKS_TEMPLATE = {
                '大英雄的经验': RecognitionObject.TemplateMatch(
                    file.ReadImageMatSync("assets/RecognitionObject/大英雄的经验.png"),
                    0, 0, 1920, 1080
                ),
                '冒险家的经验': RecognitionObject.TemplateMatch(
                    file.ReadImageMatSync("assets/RecognitionObject/冒险家的经验.png"),
                    0, 0, 1920, 1080
                ),
                '流浪者的经验': RecognitionObject.TemplateMatch(
                    file.ReadImageMatSync("assets/RecognitionObject/流浪者的经验.png"),
                    0, 0, 1920, 1080
                )
            };

            // 预定义划动条模板
            const DownSwipeBarIcon = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync('assets/RecognitionObject/SwipeBarIcon.png'),
                1270, 900, 30, 100
            )
            
            let ExpBookInformation = {};

            // 导航到背包界面
            await genshin.returnMainUi();
            await UiNavigation.BackpackUiNavigation();

            if (!UI.UIUtils.isInBackpack()) {
                // 可能存在过期物品
                if (UI.UIUtils.isExpiredItem()) {
                    log.info("检测到过期物品，点击确认")
                    click(810,755)
                }else {
                    throw new Error("未成功进入背包界面");
                }
            }

            log.info("进入背包成功，开始扫描经验书");
            
            // 遍历每种经验书模板
            for (const [bookName, templateMat] of Object.entries(EXP_BOOKS_TEMPLATE)) {
                log.info(`正在扫描【${bookName}】的数量`);
                
                // 扫描前页面点至最上
                click(1285, 122)
                await sleep(50)
                click(1285, 122)
                await sleep(50)
                click(1285, 122)
                await sleep(50) // 受不了了，多点它几次
                click(1285, 122)
                await sleep(50) // 受不了了，多点它几次
                click(1285, 122)
                await sleep(50) // 受不了了，多点它几次
                
                let found = false;
                let currentPage = 0;
                const MAX_PAGE_TRIES = 20; // 最多划动20次
                
                // 扫描当前页并翻页查找
                while (!found && currentPage < MAX_PAGE_TRIES) {
                    screenRO = captureGameRegion();
                    result = screenRO.find(templateMat);

                    if (result && result.isExist()) {
                        log.info(`找到道具【${bookName}】，开始识别数量`);

                        // 扩展识别区域
                        const croppedRegion = screenRO.deriveCrop(
                            result.X - 30,
                            result.Y + result.Height - 20,
                            result.Width + 30,
                            result.Height + 70
                        );

                        // OCR识别数字
                        let ocrResult = ImageRecognition.ocrRecognize(2000, croppedRegion);

                        // 数字校正
                        ocrResult = OcrNumberCorrector.correct(ocrResult);

                        log.info(`识别结果：【${bookName}】数量为 ${ocrResult}`);
                        ExpBookInformation[bookName] = ocrResult;

                        // 清理资源
                        croppedRegion.dispose();
                        found = true;
                    }

                    if (found) {
                        break;
                    }
                    
                    if (!found && currentPage < MAX_PAGE_TRIES) {
                        // 识别到划动条停止划动（已划至最下）
                        const ro = captureGameRegion()
                        const res = ro.find(DownSwipeBarIcon);
                        if (res.isExist()) {
                            await UI.scrollPageFlexible(Math.ceil(genshin.height / 5)); // 以防过早识别
                            currentPage = MAX_PAGE_TRIES
                        }
                        
                        log.info("当前页面未找到，尝试翻页");
                        await UI.scrollPageFlexible(Math.ceil(genshin.height / 5));
                        await sleep(800); // 等待页面稳定
                        
                        currentPage++;
                    }

                    // 清理当前循环的资源
                    if (result) {
                        result.dispose();
                        result = null;
                    }
                    if (screenRO) {
                        screenRO.dispose();
                        screenRO = null;
                    }
                }

                if (!found) {
                    log.warn(`未找到【${bookName}】，可能已遍历所有页面或背包中不存在`);
                    ExpBookInformation[bookName] = 0;
                }
            }

            return ExpBookInformation;

        } catch (error) {
            log.error(`识别经验书失败：${error.message}`);
            return null;

        } finally {
            // 确保资源被释放
            if (result) result.dispose();
            if (screenRO) screenRO.dispose();
        }
    },

    /**
     * 识别世界等级
     * @return {Promise<boolean|string>}
     * @constructor
     */
    WorldLevelRecognition: async function(){
        await genshin.returnMainUi();
        await sleep(800);
        keyPress("VK_ESCAPE")
        await sleep(800);
        click(720,260)
        await sleep(800);
        click(980,830)
        await sleep(800);

        let worldLevel = this.ocrRecognize(2000,{X:680, Y:400, Width:150, Height:100})
        if (worldLevel){
            worldLevel = OcrNumberCorrector.correct(worldLevel);
            log.info(`识别到世界等级为：${worldLevel}`);
            return worldLevel;
        } else {return false}
    }
}

var OcrNumberCorrector = {
    // OCR识别错误映射表：覆盖大小写形似字符
    errorMap: new Map([
    ['o', '0'], ['O', '0'],
    ['l', '1'], ['I', '1'], ['|', '1'], ['i', '1'],
    ['z', '2'], ['Z', '2'],
    ['s', '5'], ['S', '5'],
    ['B', '8'],
    ['g', '9'], ['G', '9'], ['q', '9'], ['Q', '9'],
    ['b', '6'], ['B', '8'], ['p', '9'],
    ['d', '0'], ['D', '0'],
    ['e', '3'], ['E', '3'],
    ['f', '7'], ['F', '7'],
    ['t', '7'], ['T', '7'],
    ['y', '4'], ['Y', '4']
]),

    // 白名单字符集合：数字 + /
    whitelist : new Set(['/', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']),

    /**
     * 校正OCR识别的字符串
     * @param {string} rawStr - OCR识别的原始字符串
     * @returns {string} 校正后的结果（仅含数字和/）
     */
    correct: function(rawStr) {
    if (typeof rawStr !== 'string') return '';

    return rawStr.split('')
        .map(char => {
            return this.errorMap.has(char) ? this.errorMap.get(char) : char;
        })
        .filter(char => {
            return this.whitelist.has(char);
        })
        .join('');
    }
}