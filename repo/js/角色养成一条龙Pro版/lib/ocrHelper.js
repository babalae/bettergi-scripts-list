// OCR识别辅助模块
var OcrHelper = {
    // OCR识别角色名称（支持精确匹配、别名匹配、模糊匹配、部分包含匹配）
    recognizeText: async function(text, region, aliasMap, timeout, retry, max) {
        timeout = timeout || 100;
        retry = retry || 20;
        max = max || 5;
        
        const start = Date.now();
        let count = 0;
        const formalName = aliasMap[text] || text;
        const candidateNames = Object.values(aliasMap);
        let capture = null;
        
        const cleanText = function(str) {
            return str.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\u3400-\u4dbf]/g, '').trim();
        };
        
        try {
            capture = captureGameRegion();
            const ocr = RecognitionObject.Ocr(region.x, region.y, region.width, region.height);
            ocr.threshold = 0.8;
            
            while (Date.now() - start < timeout && count < max) {
                try {
                    const resList = capture.findMulti(ocr);
                    for (const res of resList) {
                        let corrText = res.text;
                        for (const [wrong, correct] of Object.entries(Constants.replacementMap)) {
                            corrText = corrText.replace(new RegExp(wrong, 'g'), correct);
                        }
                        
                        // 清理OCR结果中的符号
                        const cleanedText = cleanText(corrText);
                        
                        // 第一步：精确匹配（清理后）
                        if (cleanedText === formalName) {
                            return { text: formalName, x: res.x, y: res.y };
                        }
                        
                        // 第二步：别名匹配（清理后）
                        const aliasMatch = aliasMap[cleanedText];
                        if (aliasMatch === formalName) {
                            log.info(`识别到[ ${cleanedText} ] 别名匹配为 [ ${aliasMatch} ]`);
                            return { text: aliasMatch, x: res.x, y: res.y };
                        }
                        
                        // 第三步：模糊匹配（清理后）
                        const fuzzyResult = Utils.fuzzyMatch(cleanedText, candidateNames, 0.6);
                        if (fuzzyResult && fuzzyResult.match === formalName) {
                            log.info(`识别到[ ${cleanedText} ] 模糊匹配为 [ ${fuzzyResult.match} ]（分数：${fuzzyResult.score.toFixed(2)}）`);
                            return { text: fuzzyResult.match, x: res.x, y: res.y };
                        }
                        
                        // 第四步：部分包含匹配（清理后）
                        if (formalName.includes(cleanedText) && cleanedText.length >= 2) {
                            log.info(`识别到[ ${cleanedText} ] 部分匹配为 [ ${formalName} ]`);
                            return { text: formalName, x: res.x, y: res.y };
                        }
                        
                        // 第五步：反向包含匹配（清理后）
                        for (const cand of candidateNames) {
                            const cleanedCand = cleanText(cand);
                            if (cleanedCand === formalName && cleanedText.includes(cleanedCand.substring(0, Math.ceil(cleanedCand.length / 2))) && cleanedText.length >= 2) {
                                log.info(`识别到[ ${cleanedText} ] 反向部分匹配为 [ ${formalName} ]`);
                                return { text: formalName, x: res.x, y: res.y };
                            }
                        }
                        
                        log.info(`识别到[ ${cleanedText} ]，未匹配目标 [ ${formalName} ]`);
                    }
                } catch (e) { 
                    count++; 
                    log.warn(`OCR重试${count}/${max}：${e.message}`); 
                }
                await sleep(retry);
            }
        } finally { 
            if (capture) capture.dispose(); 
        }
        return false;
    },
    
    // 识别多段文字OCR
    recognizeMultiText: async function(region, name) {
        return await Utils.retryTask(function() {
            const ocr = RecognitionObject.ocr(region.x, region.y, region.width, region.height);
            const capture = captureGameRegion();
            const resList = capture.findMulti(ocr);
            const textList = [];
            
            for (let i = 0; i < resList.Count; i++) {
                const res = resList[i];
                let text = res.text ? res.text.trim() : "";
                for (const [wrong, correct] of Object.entries(Constants.replacementMap)) {
                    text = text.replace(new RegExp(wrong, 'g'), correct);
                }
                if (text) textList.push(text);
                if (res.Dispose) res.Dispose();
            }
            
            capture.dispose();
            return textList;
        }, name);
    },
    
    // 识别单个天赋等级
    getTalentLevel: async function(ocrRegion, talentName) {
        try {
            log.info(`${talentName}等级，OCR区域：x=${ocrRegion.x}, y=${ocrRegion.y}, w=${ocrRegion.width}, h=${ocrRegion.height}`);
            
            const allTexts = await Utils.ocrRecognizeWithRetry(
                ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height,
                `${talentName}等级识别`
            );
            
            const lvRegex = /Lv\.(\d+)/;
            const pureNumRegex = /\d+/;
            
            let level = null;
            
            if (allTexts && allTexts.length > 0) {
                for (const text of allTexts) {
                    const match = text.match(lvRegex);
                    if (match) {
                        level = parseInt(match[1], 10);
                        log.info(`${talentName}匹配到等级：${level} 级  文本：${text}`);
                        break;
                    }
                }
                
                if (!level) {
                    for (const text of allTexts) {
                        const numMatch = text.match(pureNumRegex);
                        if (numMatch) {
                            const num = parseInt(numMatch[0], 10);
                            if (!isNaN(num)) {
                                level = num;
                                log.info(`${talentName}从文本中提取数字作为等级：${level}（文本：${text}）`);
                                break;
                            }
                        }
                    }
                }
            } else {
                log.warn(`${talentName}未识别到任何文本`);
            }
            
            return !isNaN(level) ? level : null;
        } catch (e) {
            log.error(`识别${talentName}等级出错：${e.message || e}`);
            return null;
        }
    },
    
    // 查找图片并OCR识别
    findImageAndOCR: async function(imagePath, ocrWidth, ocrHeight, offsetX, offsetY) {
        try {
            const templateMat = file.ReadImageMatSync(imagePath);
            const templateRo = RecognitionObject.TemplateMatch(templateMat);
            
            const captureRegion = captureGameRegion();
            const foundRegion = captureRegion.Find(templateRo);
            
            if (foundRegion.isEmpty()) {
                log.info(`未找到模板图片: ${imagePath}`);
                captureRegion.dispose();
                return false;
            }
            
            log.info("找到模板图片，位置({x},{y})", foundRegion.x, foundRegion.y);
            
            const ocrX = foundRegion.x + offsetX;
            const ocrY = foundRegion.y + offsetY;
            
            const ocrRo = RecognitionObject.Ocr(ocrX, ocrY, ocrWidth, ocrHeight);
            const ocrResult = captureRegion.Find(ocrRo);
            captureRegion.dispose();
            
            if (ocrResult.isEmpty() || !ocrResult.text || ocrResult.text.trim() === "") {
                log.info("OCR未识别到内容");
                return false;
            }
            
            log.info("OCR识别结果: {text}", ocrResult.text);
            return ocrResult.text.trim();
            
        } catch (error) {
            log.error("识别过程中出错: {error}", error);
            return false;
        }
    },
    
    // 等待图片出现并点击
    waitAndClickImage: async function(imageName, extraWidth, extraHeight, ifClick, timeout, checkInterval, threshold) {
        extraWidth = extraWidth || 0;
        extraHeight = extraHeight || 0;
        ifClick = ifClick !== false;
        timeout = timeout || 10000;
        checkInterval = checkInterval || 500;
        threshold = threshold || 0.8;
        
        const startTime = Date.now();
        const imagePath = `assets/${imageName}.png`;
        
        const templateMat = file.ReadImageMatSync(imagePath);
        const recognitionObj = RecognitionObject.TemplateMatch(templateMat, 0, 0, 1920, 1080);
        recognitionObj.threshold = threshold;
        
        while (Date.now() - startTime < timeout) {
            const captureRegion = captureGameRegion();
            const result = captureRegion.Find(recognitionObj);
            captureRegion.dispose();
            
            if (!result.isEmpty()) {
                log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
                if (ifClick) click(result.x + extraWidth, result.y + extraHeight);
                await sleep(300);
                return true;
            }
            
            await sleep(checkInterval);
        }
        
        throw new Error(`等待图片 ${imageName} 超时`);
    },
    
    // 重复操作直到找到文字（支持多段文字识别并点击）
    repeatOperationUntilTextFound: async function(options) {
        const {
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
            returnText = false
        } = options || {};

        const escapeRegExp = function(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        const textPattern = typeof targetText === 'string' 
            ? new RegExp(escapeRegExp(targetText)) 
            : targetText;

        let stepsTaken = 0;
        let foundText = null;
        
        while (stepsTaken <= maxSteps) {
            const captureRegion = captureGameRegion();
            const textArea = captureRegion.DeriveCrop(x, y, width, height);
            
            const ocr = RecognitionObject.ocrThis;
            const resList = textArea.findMulti(ocr);
            
            let foundX = null;
            let foundY = null;
            
            for (const res of resList) {
                let corrText = res.text;
                for (const [wrong, correct] of Object.entries(Constants.replacementMap)) {
                    corrText = corrText.replace(new RegExp(wrong, 'g'), correct);
                }
                
                const matchesTarget = targetText === null 
                    ? corrText.trim().length > 0
                    : textPattern.test(corrText);
                
                if (matchesTarget) {
                    foundText = corrText;
                    foundX = res.x;
                    foundY = res.y;
                    break;
                }
            }
            
            captureRegion.dispose();
            textArea.dispose();
            
            if (foundText !== null) {
                log.info(`检测到${targetText === null ? '文字' : '目标文字'}: ${foundText}`);
                await sleep(500);
                if (ifClick && foundX !== null && foundY !== null) {
                    click(x + foundX, y + foundY);
                }
                return returnText ? foundText : true;
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
};
