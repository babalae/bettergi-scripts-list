/**
 * 奖励领取相关工具函数
 * 注意：本文件使用 main.js 中定义的全局变量 doubleSurgeCounter（双倍剩余次数计数器）
 */

/**
 * 截图并提取OCR文本
 * @returns {Promise<Array<{text: string, x: number, y: number, width: number, height: number}>>}
 */
async function captureAllTexts() {
    const captureRegion = captureGameRegion();
    try {
        const ocrRo = RecognitionObject.Ocr(0, 0, captureRegion.width, captureRegion.height);
        const textList = captureRegion.findMulti(ocrRo);
        if (!textList || textList.count === 0) {
            return [];
        }
        const result = [];
        for (let i = 0; i < textList.count; i++) {
            result.push({
                text: textList[i].text,
                x: textList[i].x,
                y: textList[i].y,
                width: textList[i].width,
                height: textList[i].height
            });
        }
        return result;
    } finally {
        captureRegion.dispose();
    }
}

/**
 * 检测是否包含双倍产出关键词
 * @param {Array<{text: string}>} texts
 * @returns {boolean}
 */
function checkDoubleReward(texts) {
    return texts.some(t =>
        t.text.includes("双倍") ||
        t.text.includes("2倍产出") ||
        t.text.includes("2倍")
    );
}

/**
 * 从OCR文本中解析双倍剩余次数
 * @param {Array<{text: string}>} texts
 * @returns {{found: boolean, count: number}}
 */
function parseDoubleRemainingTimes(texts) {
    for (let i = 0; i < texts.length; i++) {
        const match = texts[i].text.match(/2倍产出次数[：:]\s*(\d+)/);
        if (match) {
            return { found: true, count: parseInt(match[1]) };
        }
    }
    return { found: false, count: 0 };
}

/**
 * 带重试的双倍检测（检测双倍 + 解析次数）
 * @param {Array<{text: string}>} initialTexts - 首次OCR结果
 * @returns {Promise<{hasDoubleReward: boolean, doubleRemainingTimes: number, doubleTimesParsed: boolean}>}
 */
const DOUBLE_TIMES_OCR_REGION = { x: 1191, y: 433, width: 158, height: 39 };

async function detectDoubleRewardWithRetry(initialTexts) {
    let hasDoubleReward = checkDoubleReward(initialTexts);
    let { found: doubleTimesParsed, count: doubleRemainingTimes } = parseDoubleRemainingTimes(initialTexts);

    if (doubleTimesParsed) {
        log.info(`[双倍检测] 剩余双倍次数: ${doubleRemainingTimes}`);
    }

    async function retryParseDoubleTimes() {
        const captureRegion = captureGameRegion();
        try {
            const ocrRo = RecognitionObject.Ocr(
                DOUBLE_TIMES_OCR_REGION.x,
                DOUBLE_TIMES_OCR_REGION.y,
                DOUBLE_TIMES_OCR_REGION.width,
                DOUBLE_TIMES_OCR_REGION.height
            );
            const areaTexts = captureRegion.findMulti(ocrRo);
            if (areaTexts.length > 0) {
                const result = parseDoubleRemainingTimes(areaTexts);
                if (result.found) {
                    doubleTimesParsed = true;
                    doubleRemainingTimes = result.count;
                    log.info(`[双倍检测] 剩余双倍次数: ${doubleRemainingTimes}`);
                    return true;
                }
            }
            return false;
        } finally {
            captureRegion.dispose();
        }
    }

    if (!hasDoubleReward) {
        log.info("[双倍检测] 首次未识别到双倍，300ms后重试...");
        await sleep(300);
        const retryTexts = await captureAllTexts();
        if (retryTexts.length > 0) {
            hasDoubleReward = checkDoubleReward(retryTexts);
            if (!doubleTimesParsed) {
                await retryParseDoubleTimes();
            }
        }
    }

    if (hasDoubleReward && !doubleTimesParsed) {
        log.warn("[双倍检测] 检测到双倍但未能解析剩余次数，500ms后重试...");
        await sleep(500);
        const success = await retryParseDoubleTimes();
        if (!success) {
            log.warn("[双倍检测] 仍未能解析剩余次数，将正常领取");
        }
    }

    return { hasDoubleReward, doubleRemainingTimes, doubleTimesParsed };
}

/**
 * 带验证的单击函数
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {string} targetText - 需要验证消失的目标文字
 * @param {number} maxRetries - 最大重试次数，默认为10
 * @returns {Promise<boolean>} 是否成功
 */
this.clickWithVerification = async function(x, y, targetText, maxRetries = 20) {
    for (let i = 0; i < maxRetries; i++) {
        keyUp("LBUTTON");
        click(x, y);
        await sleep(400);

        // 验证目标文字是否消失
        let captureRegion = captureGameRegion();
        let resList = captureRegion.findMulti(ocrRoThis);
        captureRegion.dispose();
        let textFound = false;

        if (resList && resList.count > 0) {
            for (let j = 0; j < resList.count; j++) {
                if (resList[j].text.includes(targetText)) {
                    textFound = true;
                    break;
                }
            }
        }

        // 如果文字消失了，说明点击成功
        if (!textFound) {
            return true;
        }
    }
    
    log.warn(`经过${maxRetries}次点击，文字"${targetText}"仍未消失`);
    return false;
}

/**
 * 验证是否在奖励界面
 * 使用OCR识别"地脉之花"或"激活地脉之花"文字，不受分辨率影响
 * @returns {Promise<boolean>}
 */
this.verifyRewardPage = async function() {
    let captureRegion = null;
    
    try {
        captureRegion = captureGameRegion();
        
        // 使用OCR识别上半区域
        let ocrRo = RecognitionObject.Ocr(0, 0, captureRegion.width, captureRegion.height / 2);
        let textList = captureRegion.findMulti(ocrRo);

        let isValid = false;
        if (textList && textList.count > 0) {
            for (let i = 0; i < textList.count; i++) {
                let text = textList[i].text;
                // 识别关键文字
                if (text.includes("激活地脉之花") ||
                    text.includes("选择激活方式")) {
                    isValid = true;
                    log.info(`奖励界面验证: 成功（识别到文字: "${text}"）`);
                    break;
                }
            }
        }
        
        // 已注释：减少日志输出
        // if (!isValid) {
        //     log.info(`奖励界面验证: 失败（未识别到关键文字）`);
        // }
        
        return isValid;
    } catch (error) {
        log.error(`验证奖励界面失败: ${error.message}`);
        return false;
    } finally {
        if (captureRegion) {
            captureRegion.dispose();
        }
    }
}

/**
 * 检查原粹树脂是否耗尽（通过OCR识别"补充"文字）
 * 如果原粹树脂耗尽，第一个按钮会变成"补充"按钮
 * @returns {Promise<boolean>}
 */
async function checkOriginalResinEmpty() {
    try {
        const textList = await captureAllTexts();
        const hasSupplement = textList.some(t => t.text.includes("补充"));
        if (hasSupplement) {
            log.warn("检测到补充文字，原粹树脂已耗尽");
        }
        return hasSupplement;
    } catch (error) {
        log.error(`检查原粹树脂状态失败: ${error.message}`);
        return false;
    }
}

/**
 * 查找并排序所有使用按钮（通过OCR识别"使用"文字）
 * 注意：如果原粹树脂耗尽，第一个位置是"补充"按钮，不会被识别为"使用"按钮
 * @returns {Promise<Array>}
 */
async function findAndSortUseButtons() {
    try {
        const textList = await captureAllTexts();
        if (textList.length === 0) {
            log.warn("未找到任何文本");
            return [];
        }
        
        // 查找只包含"使用"两个字的文本（真正的按钮）
        let buttons = [];
        for (let i = 0; i < textList.length; i++) {
            let textRegion = textList[i];
            let text = textRegion.text.trim();
            
            if (text === "使用") {
                let buttonX = Math.round(textRegion.x + textRegion.width / 2);
                let buttonY = Math.round(textRegion.y + textRegion.height / 2);
                let textY = textRegion.y;
                let textContent = textRegion.text;
                
                let virtualButton = {
                    index: buttons.length,
                    region: {
                        x: buttonX,
                        y: buttonY,
                        click: function() {
                            click(buttonX, buttonY);
                        }
                    },
                    x: buttonX,
                    y: textY,
                    text: textContent
                };
                
                buttons.push(virtualButton);
            }
        }
        
        if (buttons.length === 0) {
            log.warn("未找到包含'使用'的文本");
            return [];
        }
        
        // 按Y坐标排序
        buttons.sort((a, b) => a.y - b.y);
        
        log.info(`找到 ${buttons.length} 个使用按钮`);
        
        return buttons;
    } catch (error) {
        log.error(`查找使用按钮失败: ${error.message}`);
        return [];
    }
}

/**
 * 分析树脂选项并决定使用哪个
 * @param {Array} sortedButtons - 排序后的使用按钮数组
 * @param {boolean} isOriginalResinEmpty - 原粹树脂是否耗尽
 * @returns {Promise<Object|null>}
 */
async function analyzeResinOptions(sortedButtons, isOriginalResinEmpty) {
    let captureRegion = null;
    
    try {
        // OCR识别整个界面的文本
        let allTexts = await captureAllTexts();
        if (allTexts.length === 0) {
            log.warn("OCR未识别到任何文本");
            return null;
        }

        // 检测双倍产出（首次快速检测，用于判断是否有双倍）
        let hasDoubleReward = false;
        let doubleRemainingTimes = 0;
        let doubleTimesParsed = false;

        if (settings.onlySurgeMode) {
            const detectResult = await detectDoubleRewardWithRetry(allTexts);
            hasDoubleReward = detectResult.hasDoubleReward;
            doubleRemainingTimes = detectResult.doubleRemainingTimes;
            doubleTimesParsed = detectResult.doubleTimesParsed;
        } else {
            hasDoubleReward = checkDoubleReward(allTexts);
        }

        if (hasDoubleReward) {
            log.info("检测到双倍产出");
        } else {
            log.info("未检测到双倍产出");
        }

        // 识别树脂类型（注意：如果原粹树脂耗尽，应该忽略这些识别）
        let hasOriginalResin20 = !isOriginalResinEmpty && allTexts.some(t => 
            (t.text.includes("20") && t.text.includes("原粹树脂")) ||
            (t.text.includes("20个") && t.text.includes("原粹树脂"))
        );
        
        let hasOriginalResin40 = !isOriginalResinEmpty && allTexts.some(t => 
            (t.text.includes("40") && t.text.includes("原粹树脂")) ||
            (t.text.includes("40个") && t.text.includes("原粹树脂"))
        );
        
        let hasCondensedResin = allTexts.some(t => 
            t.text.includes("浓缩树脂") || t.text.includes("浓缩")
        );
        
        let hasTransientResin = allTexts.some(t => 
            t.text.includes("须臾树脂") || t.text.includes("须臾")
        );
        
        let hasFragileResin = allTexts.some(t => 
            t.text.includes("脆弱树脂") || t.text.includes("脆弱")
        );
        
        let hasPrimogems = allTexts.some(t => 
            t.text.includes("原石") && t.text.includes("3次")
        );
        
        // 输出识别到的树脂类型（调试用）
        log.info(`识别到的树脂类型 - 原粹20:${hasOriginalResin20}, 原粹40:${hasOriginalResin40}, 浓缩:${hasCondensedResin}, 须臾:${hasTransientResin}, 脆弱:${hasFragileResin}, 原石:${hasPrimogems}, 双倍:${hasDoubleReward}`);

        // 双倍检测兜底：如果开启了双倍模式但没检测到双倍，记录状态但继续执行
        // 正常流程下，开书检测已拦截无双倍情况，能到这里说明是异常
        // 报错将在拾取完成后进行
        let shouldExitForSurge = settings.onlySurgeMode && !hasDoubleReward;

        // 20树脂模式：尝试将40树脂切换成20树脂
        let monsterMaterialSwitched = false;
        if (settings.monsterMaterialMode) {
            if (hasOriginalResin20 && !hasOriginalResin40) {
                // 界面已经是20树脂，直接使用
                monsterMaterialSwitched = true;
                log.info("20树脂模式：界面已是20树脂，无需切换");
            } else if (hasOriginalResin40) {
                let switchSuccess = await trySwitch40To20Resin();
                if (switchSuccess) {
                    log.info("20树脂模式：成功切换到20个原粹树脂");
                    monsterMaterialSwitched = true;
                    // 重新识别树脂类型
                    allTexts = await captureAllTexts();
                    hasOriginalResin20 = allTexts.some(t =>
                        (t.text.includes("20") && t.text.includes("原粹树脂")) ||
                        (t.text.includes("20个") && t.text.includes("原粹树脂"))
                    );
                    hasOriginalResin40 = allTexts.some(t =>
                        (t.text.includes("40") && t.text.includes("原粹树脂")) ||
                        (t.text.includes("40个") && t.text.includes("原粹树脂"))
                    );
                } else {
                    log.warn("20树脂模式：未能切换到20个原粹树脂，将使用40个");
                }
            }
        }

        // 决策逻辑（根据原粹树脂是否耗尽，决策不同）
        let choice = null;

        if (isOriginalResinEmpty) {
            // ===== 原粹树脂耗尽的情况 =====
            // 此时第一个"使用"按钮对应的是浓缩/须臾/脆弱树脂
            log.warn("原粹树脂已耗尽，检测是否有其他可用树脂");
            
            if (hasCondensedResin && sortedButtons.length >= 1) {
                choice = {
                    type: "使用1个浓缩树脂（原粹耗尽）",
                    resinAmount: 40,
                    button: sortedButtons[0],
                    buttonIndex: 0
                };
            } else if (hasTransientResin && sortedButtons.length >= 1 && settings.useTransientResin) {
                choice = {
                    type: "使用1个须臾树脂（原粹耗尽）",
                    resinAmount: 40,
                    button: sortedButtons[0],
                    buttonIndex: 0
                };
            } else if (hasFragileResin && sortedButtons.length >= 1 && settings.useFragileResin) {
                choice = {
                    type: "使用1个脆弱树脂（原粹耗尽）",
                    resinAmount: 40,
                    button: sortedButtons[0],
                    buttonIndex: 0
                };
            } else {
                // 输出详细的调试信息
                if (hasTransientResin && !settings.useTransientResin) {
                    log.warn(`原粹树脂耗尽，检测到须臾树脂但配置禁止使用（settings.useTransientResin=${settings.useTransientResin}）`);
                } else if (hasFragileResin && !settings.useFragileResin) {
                    log.warn(`原粹树脂耗尽，检测到脆弱树脂但配置禁止使用（settings.useFragileResin=${settings.useFragileResin}）`);
                } else {
                    log.warn(`原粹树脂耗尽且无其他可用树脂（浓缩:${hasCondensedResin}, 须臾:${hasTransientResin}, 脆弱:${hasFragileResin}, 原石:${hasPrimogems}）`);
                }
                return null;
            }
        } else {
            // ===== 原粹树脂充足的情况 =====
            // 第一个"使用"按钮对应原粹树脂
            // 第二个"使用"按钮对应浓缩/须臾/脆弱树脂
            
            // 优先级1: 如果有双倍产出，优先使用原粹树脂
            if (hasDoubleReward && (hasOriginalResin20 || hasOriginalResin40)) {
                if (settings.monsterMaterialMode) {
                    // ===== 20树脂模式：使用20树脂 =====
                    if (!monsterMaterialSwitched && hasOriginalResin40) {
                        let switchSuccess = await trySwitch40To20Resin();
                        if (switchSuccess) {
                            log.info("20树脂模式（双倍）：成功切换到20个原粹树脂");
                            monsterMaterialSwitched = true;
                        } else {
                            log.warn("20树脂模式（双倍）：未能切换到20，将使用40个");
                        }
                    }
                    choice = {
                        type: monsterMaterialSwitched || hasOriginalResin20 ? "使用20个原粹树脂（20树脂模式，双倍产出）" : "使用40个原粹树脂（20树脂模式，双倍产出）",
                        resinAmount: monsterMaterialSwitched || hasOriginalResin20 ? 20 : 40,
                        button: sortedButtons[0],
                        buttonIndex: 0
                    };
                } else {
                    // ===== 默认模式：智能优化 =====
                    let isNow40Resin = hasOriginalResin40;

                    if (hasOriginalResin20 && !hasOriginalResin40) {
                        let switchSuccess = await trySwitch20To40Resin();
                        if (switchSuccess) {
                            isNow40Resin = true;
                            log.info("默认模式（双倍）：已从20切换到40个原粹树脂");
                        } else {
                            log.warn("默认模式（双倍）：无法切换到40，保持20树脂");
                        }
                    }

                    if (settings.onlySurgeMode && isNow40Resin) {
                        log.info(`[双倍检测] 在40树脂界面下精确识别双倍消耗次数（仅只刷双倍模式）...`);
                        allTexts = await captureAllTexts();
                        const reDetectResult = await detectDoubleRewardWithRetry(allTexts);
                        doubleRemainingTimes = reDetectResult.doubleRemainingTimes;
                        doubleTimesParsed = reDetectResult.doubleTimesParsed;

                        if (doubleTimesParsed) {
                            log.info(`[双倍检测] 精确识别结果: 本次将消耗${doubleRemainingTimes}次`);
                        } else {
                            log.warn("[双倍检测] 未能解析消耗次数，将使用默认值");
                        }
                    }

                    let forceUse20ForLastSurge = false;
                    if (settings.onlySurgeMode && isNow40Resin && doubleRemainingTimes === 1) {
                        log.info("[双倍优化] 检测到仅剩1次双倍，尝试切换回20树脂以节省体力");
                        let switchBackSuccess = await trySwitch40To20Resin();
                        if (switchBackSuccess) {
                            forceUse20ForLastSurge = true;
                            log.info("[双倍优化] 成功切回20树脂，将用20体力完成最后一次双倍");
                        } else {
                            log.warn("[双倍优化] 无法切回20，继续使用40树脂");
                        }
                    }

                    if ((isNow40Resin || hasOriginalResin40) && !forceUse20ForLastSurge) {
                        choice = {
                            type: "使用40个原粹树脂（双倍产出）",
                            resinAmount: 40,
                            button: sortedButtons[0],
                            buttonIndex: 0
                        };
                    } else {
                        choice = {
                            type: forceUse20ForLastSurge ? "使用20个原粹树脂（最后1次双倍优化）" : "使用20个原粹树脂（双倍产出）",
                            resinAmount: 20,
                            button: sortedButtons[0],
                            buttonIndex: 0
                        };
                    }
                }
            }
            // 优先级2: 优先使用浓缩树脂
            else if (hasCondensedResin && sortedButtons.length >= 2) {
                choice = {
                    type: "使用1个浓缩树脂",
                    resinAmount: 40,
                    button: sortedButtons[1],
                    buttonIndex: 1
                };
            }
            // 优先级3: 使用须臾树脂
            else if (hasTransientResin && settings.useTransientResin && sortedButtons.length >= 2) {
                choice = {
                    type: "使用1个须臾树脂",
                    resinAmount: 40,
                    button: sortedButtons[1],
                    buttonIndex: 1
                };
            }
            // 优先级4: 使用原粹树脂
            else if (hasOriginalResin20 || hasOriginalResin40) {
                if (settings.monsterMaterialMode) {
                    // ===== 20树脂模式：简单粗暴方案 =====
                    // 不需要切到40识别，直接设置计数器=3，跑完就收工
                    // 如果实际次数不足3次，最多多跑一个节点，会被兜底逻辑捕获
                    choice = {
                        type: hasOriginalResin20 ? "使用20个原粹树脂（20树脂模式）" : "使用40个原粹树脂（20树脂模式）",
                        resinAmount: hasOriginalResin20 ? 20 : 40,
                        button: sortedButtons[0],
                        buttonIndex: 0
                    };

                    // 20模式下如果当前是40，切回20
                    if (!hasOriginalResin20 && hasOriginalResin40) {
                        let switchSuccess = await trySwitch40To20Resin();
                        if (switchSuccess) {
                            choice.type = "使用20个原粹树脂（20树脂模式）";
                            choice.resinAmount = 20;  // 更新树脂量
                            log.info("20树脂模式：已切换到20个原粹树脂");
                        } else {
                            log.warn("20树脂模式：无法切换到20，继续使用40");
                        }
                    }

                    log.info(`[20树脂模式] 双倍计数器将重置为3，按每次消耗1次计算`);
                } else {
                    // ===== 默认模式：先让原有逻辑处理切换，再统一识别 =====

                    // 步骤1: 让原有逻辑处理切换（如果是20就切到40）
                    let isNow40Resin = hasOriginalResin40;  // 当前是否已经是40
                    if (hasOriginalResin20 && !hasOriginalResin40) {
                        let switchSuccess = await trySwitch20To40Resin();
                        if (switchSuccess) {
                            isNow40Resin = true;
                            log.info("默认模式：已从20切换到40个原粹树脂");
                        } else {
                            log.warn("默认模式：无法切换到40（可能体力不足），保持20树脂");
                        }
                    } else if (hasOriginalResin40) {
                        log.info("默认模式：界面已经是40个原粹树脂，无需切换");
                    }

                    // 步骤2: 【关键】不管有没有切换，都重新OCR精确识别双倍消耗次数
                    // 因为"有无双倍"和"消耗几次"是两个不同区域，首次识别可能不准
                    if (isNow40Resin || settings.onlySurgeMode) {
                        log.info(`[双倍检测] 在${isNow40Resin ? '40' : '当前'}树脂界面下精确识别双倍消耗次数...`);
                        allTexts = await captureAllTexts();
                        const reDetectResult = await detectDoubleRewardWithRetry(allTexts);
                        doubleRemainingTimes = reDetectResult.doubleRemainingTimes;
                        doubleTimesParsed = reDetectResult.doubleTimesParsed;

                        if (doubleTimesParsed) {
                            log.info(`[双倍检测] 精确识别结果: 本次将消耗${doubleRemainingTimes}次`);
                        } else {
                            log.warn("[双倍检测] 未能解析消耗次数，将使用默认值");
                        }
                    }

                    // 步骤3: 根据识别结果决定是否优化（只剩1次且是40时，可选切回20省体力）
                    let forceUse20ForLastSurge = false;
                    if (isNow40Resin && settings.onlySurgeMode && doubleRemainingTimes === 1) {
                        log.info("[双倍优化] 检测到仅剩1次双倍，尝试切换回20树脂以节省体力");
                        let switchBackSuccess = await trySwitch40To20Resin();
                        if (switchBackSuccess) {
                            forceUse20ForLastSurge = true;
                            log.info("[双倍优化] 成功切回20树脂，将用20体力完成最后一次双倍");
                        } else {
                            log.warn("[双倍优化] 无法切回20，继续使用40树脂");
                        }
                    }

                    // 步骤4: 最终选择
                    if ((isNow40Resin || hasOriginalResin40) && !forceUse20ForLastSurge) {
                        choice = {
                            type: "使用40个原粹树脂（默认模式）",
                            resinAmount: 40,
                            button: sortedButtons[0],
                            buttonIndex: 0
                        };
                    } else {
                        choice = {
                            type: forceUse20ForLastSurge ? "使用20个原粹树脂（最后1次双倍优化）" : "使用20个原粹树脂（默认模式）",
                            resinAmount: 20,
                            button: sortedButtons[0],
                            buttonIndex: 0
                        };
                    }
                }
            }
            // 优先级5: 如果配置允许，使用脆弱树脂
            else if (hasFragileResin && settings.useFragileResin && sortedButtons.length >= 2) {
                choice = {
                    type: "使用1个脆弱树脂",
                    resinAmount: 40,
                    button: sortedButtons[1],
                    buttonIndex: 1
                };
            }
            // 默认: 点击第一个按钮（原粹树脂）
            else if (sortedButtons.length >= 1) {
                // 尝试切换到40个原粹树脂（如果当前是20个）
                if (hasOriginalResin20 && !hasOriginalResin40) {
                    let switchSuccess = await trySwitch20To40Resin();
                    choice = {
                        type: switchSuccess ? "默认使用40个原粹树脂（从20切换）" : "默认使用20个原粹树脂",
                        resinAmount: switchSuccess ? 40 : 20,
                        button: sortedButtons[0],
                        buttonIndex: 0
                    };
                } else {
                    choice = {
                        type: "默认使用原粹树脂",
                        resinAmount: hasOriginalResin40 ? 40 : (hasOriginalResin20 ? 20 : 40),
                        button: sortedButtons[0],
                        buttonIndex: 0
                    };
                }
            }
        }

        // 根据树脂选择和双倍次数判断是否会刷完双倍（使用计数器方案）
        let willFinishDoubleTimes = false;
        let actualRemainingTimes = doubleRemainingTimes; // 实际剩余次数（用于返回）

        if (settings.onlySurgeMode) {
            // 判断本次消耗多少双倍次数（20树脂=1次，40树脂=2次）
        // 使用显式的 resinAmount 数值字段，避免字符串匹配的歧义问题
        let consumeTimes = 0;
        if (choice && choice.resinAmount === 40) {
            consumeTimes = 2;
        } else if (choice && choice.resinAmount === 20) {
            consumeTimes = 1;
        }

            if (consumeTimes > 0) {
                // 初始化或更新计数器
                if (doubleSurgeCounter === 0) {
                    if (settings.monsterMaterialMode) {
                        // ===== 20树脂模式：简单粗暴方案 =====
                        // 直接重置为3次，不管实际多少次
                        // 跑完就收工，如果实际不足3次最多多跑一个节点
                        doubleSurgeCounter = 3;
                        log.info(`[双倍计数器] 20树脂模式: 直接设置计数器=3（简单粗暴）`);
                    } else {
                        // ===== 默认模式：基于40界面识别结果 =====
                        // 此时应该已经在40树脂模式下（前面有切换逻辑）
                        // 40树脂界面的显示规则：
                        // - 显示"消耗1次" → 确实只剩1次（准确）
                        // - 显示"消耗2次" → 剩余可能是2次或3次（无法区分）
                        if (doubleRemainingTimes === 1) {
                            doubleSurgeCounter = 1;
                            log.info(`[双倍计数器] 默认模式: 40界面显示消耗1次，确认剩余1次，设置计数器=${doubleSurgeCounter}`);
                        } else if (doubleRemainingTimes >= 2) {
                            // 保守估计为3次（正常情况都是3次，只有自己手动刷过才会不足）
                            doubleSurgeCounter = 3;
                            log.info(`[双倍计数器] 默认模式: 40界面显示消耗${doubleRemainingTimes}次，保守设置计数器=${doubleSurgeCounter}（可能剩2或3次）`);
                        } else {
                            // 未识别到次数，保守设为3
                            doubleSurgeCounter = 3;
                            log.warn(`[双倍计数器] 默认模式: 未能解析次数，保守设置计数器=3`);
                        }
                    }
                }

                // 递减计数器
                if (doubleSurgeCounter > 0) {
                    doubleSurgeCounter -= consumeTimes;
                    actualRemainingTimes = Math.max(0, doubleSurgeCounter);
                    log.info(`[双倍计数器] 本次消耗${consumeTimes}次，剩余=${actualRemainingTimes}（计数器=${doubleSurgeCounter}）`);

                    // 判断是否将刷完双倍
                    if (doubleSurgeCounter <= 0) {
                        willFinishDoubleTimes = true;
                        log.info(`[双倍计数器] 双倍次数已刷完`);
                    }
                }
            }
        }

        return { choice, shouldExitForSurge, willFinishDoubleTimes, doubleRemainingTimes: actualRemainingTimes };

    } catch (error) {
        log.error(`分析树脂选项失败: ${error.message}`);
        return { choice: null, shouldExitForSurge: false, willFinishDoubleTimes: false, doubleRemainingTimes: 0 };
    } finally {
        if (captureRegion) {
            captureRegion.dispose();
        }
    }
}

/**
 * 从OCR文本中识别当前原粹树脂数量
 * @param {Array<{text: string}>} texts
 * @returns {number|null} 20、40 或 null
 */
function parseCurrentResinAmount(texts) {
    for (let i = 0; i < texts.length; i++) {
        const text = texts[i].text;
        if ((text.includes("20") || text.includes("20个")) && text.includes("原粹树脂")) {
            return 20;
        }
        if ((text.includes("40") || text.includes("40个")) && text.includes("原粹树脂")) {
            return 40;
        }
    }
    return null;
}

/**
 * 验证OCR文本中是否包含目标树脂数量
 * @param {Array<{text: string}>} texts
 * @param {number} targetAmount
 * @returns {boolean}
 */
function verifyResinAmount(texts, targetAmount) {
    return texts.some(t =>
        (t.text.includes(targetAmount.toString()) && t.text.includes("原粹")) ||
        (t.text.includes(`${targetAmount}个`) && t.text.includes("树脂"))
    );
}

/**
 * 尝试切换原粹树脂数量到目标值
 * @param {number} targetAmount - 目标树脂数量（20或40）
 * @returns {Promise<boolean>} 是否成功切换到目标值
 */
async function trySwitchResin(targetAmount) {
    let switchButtonIcon = null;
    let switchButtonRo = null;
    let currentCaptureRegion = null;
    let newCaptureRegion = null;
    const otherAmount = targetAmount === 20 ? 40 : 20;
    
    try {
        // 步骤1: 先检查当前是否已经是目标值
        currentCaptureRegion = captureGameRegion();
        let textList = await captureAllTexts();
        let currentAmount = parseCurrentResinAmount(textList);
        
        // 如果已经是目标值，直接返回成功
        if (currentAmount === targetAmount) {
            log.info(`当前已是${targetAmount}个原粹树脂，无需切换`);
            return true;
        }
        
        // 如果识别失败，继续尝试切换（兼容旧逻辑）
        if (currentAmount === null) {
            log.warn(`未能识别当前树脂数量，尝试切换到${targetAmount}个`);
        } else {
            log.info(`当前是${currentAmount}个原粹树脂，尝试切换到${targetAmount}个`);
        }
        
        // 步骤2: 检测切换按钮
        switchButtonIcon = file.ReadImageMatSync("assets/icon/switch_button.png");
        switchButtonRo = RecognitionObject.TemplateMatch(switchButtonIcon);
        switchButtonRo.threshold = 0.7;
        
        let switchButtonPos = currentCaptureRegion.find(switchButtonRo);
        
        if (!switchButtonPos || switchButtonPos.isEmpty()) {
            log.info(`未找到切换按钮（树脂不足${targetAmount}），保持使用${currentAmount || otherAmount}个原粹树脂`);
            return false;
        }
        
        // 步骤3: 点击切换按钮
        log.info(`找到切换按钮，点击切换到${targetAmount}个原粹树脂`);
        switchButtonPos.click();
        await sleep(800); // 等待UI更新
        
        // 步骤4: 验证是否切换成功（带重试）
        let switchSuccess = false;
        for (let retry = 0; retry < 2; retry++) {
            newCaptureRegion = captureGameRegion();
            let verifyTextList = await captureAllTexts();
            
            if (verifyTextList.length > 0 && verifyResinAmount(verifyTextList, targetAmount)) {
                log.info(`成功切换到${targetAmount}个原粹树脂`);
                switchSuccess = true;
                break;
            }
            
            if (retry === 0) {
                log.info(`[切换验证] 首次未识别到${targetAmount}，500ms后重试...`);
                await sleep(500);
            }
            
            if (newCaptureRegion) {
                newCaptureRegion.dispose();
                newCaptureRegion = null;
            }
        }
        
        if (!switchSuccess) {
            log.warn(`点击切换按钮后，未能确认切换到${targetAmount}个原粹树脂`);
            return false;
        }
        
        return true;
        
    } catch (error) {
        log.error(`切换树脂数量失败: ${error.message}`);
        return false;
    } finally {
        if (currentCaptureRegion) {
            currentCaptureRegion.dispose();
        }
        if (newCaptureRegion) {
            newCaptureRegion.dispose();
        }
        if (switchButtonIcon) {
            switchButtonIcon.dispose();
        }
        switchButtonRo = null;
    }
}

/**
 * 尝试将20个原粹树脂切换到40个原粹树脂
 * @returns {Promise<boolean>} 是否成功切换
 */
async function trySwitch20To40Resin() {
    return await trySwitchResin(40);
}

/**
 * 尝试将40个原粹树脂切换到20个原粹树脂（20树脂模式）
 * @returns {Promise<boolean>} 是否成功切换
 */
async function trySwitch40To20Resin() {
    return await trySwitchResin(20);
}

/**
 * 切换回战斗队伍
 * @returns {Promise<void>}
 */
async function switchBackToCombatTeam() {
    try {
        log.info("切换回战斗队伍");
        await sleep(500);
        const switchSuccess = await switchTeam(settings.team);
        if (!switchSuccess) {
            log.warn("切换队伍可能失败");
        }
    } catch (error) {
        log.error(`切换队伍失败: ${error.message}`);
    }
}

/**
 * 确保退出奖励界面
 * 循环检测并退出，直到确认不在奖励界面
 * @returns {Promise<void>}
 */
this.ensureExitRewardPage = async function() {
    const MAX_ATTEMPTS = 5;  // 最多尝试5次
    let attempts = 0;
    
    try {
        log.info("检查是否需要退出奖励界面");
        
        while (attempts < MAX_ATTEMPTS) {
            attempts++;
            
            // 检测是否在奖励界面
            let isInRewardPage = await this.verifyRewardPage();
            
            if (!isInRewardPage) {
                log.info("已确认不在奖励界面");
                return;
            }
            
            // 还在奖励界面，按ESC退出
            log.info(`检测到仍在奖励界面，按ESC退出 (第${attempts}次)`);
            keyPress("VK_ESCAPE");
            await sleep(800);  // 等待界面关闭动画
        }
        
        // 超过最大尝试次数
        log.warn(`已尝试${MAX_ATTEMPTS}次退出奖励界面，可能仍在界面中`);
        
    } catch (error) {
        log.error(`退出奖励界面时出错: ${error.message}`);
    }
}

/**
 * 尝试领取地脉花奖励（图像识别+OCR混合版本）
 * @param {number} retryCount - 重试次数
 * @returns {Promise<boolean>}
 */
this.attemptReward = async function (retryCount = 0) {
    const MAX_RETRY = 3;
    if (retryCount >= MAX_RETRY) {
        throw new Error("超过最大重试次数，领取奖励失败");
    }

    log.info("开始领取地脉奖励");
    keyPress("F");
    await sleep(800);

    // 步骤1: 验证是否在奖励界面
    if (!await this.verifyRewardPage()) {
        log.warn("当前不在奖励界面，尝试重试");
        await genshin.returnMainUi();
        await sleep(1000);
        await autoNavigateToReward();
        return await this.attemptReward(++retryCount);
    }

    let isOriginalResinEmpty = false;
    let sortedButtons = [];
    let resinChoice = null;
    let shouldExitForSurge = false; // 提前声明
    let rewardError = null; // 存储奖励领取阶段的错误（仅拾取模式启用时延迟抛出）
    let doubleRemainingTimes = 0; // 双倍剩余次数
    let willFinishDoubleTimes = false; // 是否会刷完双倍

    try {
        // 步骤2: 检查原粹树脂是否耗尽（通过"补充"按钮）
        isOriginalResinEmpty = await checkOriginalResinEmpty();
        
        // 步骤3: 识别所有使用按钮并排序
        sortedButtons = await findAndSortUseButtons();
        
        if (sortedButtons.length === 0) {
            log.error("未找到任何使用按钮");
            keyPress("VK_ESCAPE");
            await sleep(500);
            await this.ensureExitRewardPage();
            return false;
        }

        // 步骤4: 根据原粹树脂状态调整决策逻辑
        const result = await analyzeResinOptions(sortedButtons, isOriginalResinEmpty);
        
        if (!result) {
            // analyzeResinOptions 返回 null（树脂耗尽且无可用树脂）
            keyPress("VK_ESCAPE");
            await sleep(500);
            await this.ensureExitRewardPage();
            return false;
        }
        
        resinChoice = result.choice;
        shouldExitForSurge = result.shouldExitForSurge;
        doubleRemainingTimes = result.doubleRemainingTimes || 0;
        willFinishDoubleTimes = result.willFinishDoubleTimes || false;
        
        if (!resinChoice) {
            // 已在 analyzeResinOptions 中输出详细错误信息，这里不再重复
            keyPress("VK_ESCAPE");
            await sleep(500);
            await this.ensureExitRewardPage();
            return false;
        }

    } catch (error) {
        log.error(`处理奖励界面时出错: ${error.message}`);
        keyPress("VK_ESCAPE");
        await sleep(500);
        await this.ensureExitRewardPage();
        
        // 未开启拾取模式时直接返回，不开启延迟报错
        if (!settings.pickDropsAfterReward) {
            return false;
        }
        
        // 开启拾取模式时存储错误，延迟到拾取后抛出
        rewardError = error;
    }

    // 步骤5: 点击对应的使用按钮（或无双倍时按ESC退出）
    if (shouldExitForSurge) {
        // 双倍检测兜底：未检测到双倍产出，用ESC代替领取奖励
        log.warn("[双倍兜底] 未检测到双倍产出，使用ESC关闭界面（不领取奖励）");
        keyPress("VK_ESCAPE");
        await sleep(800);
    } else if (resinChoice) {
        // 正常流程：点击使用按钮领取奖励
        log.info(`选择: ${resinChoice.type}，点击按钮 (X=${resinChoice.button.x}, Y=${resinChoice.button.y})`);

        // 点击使用按钮
        resinChoice.button.region.click();

        await sleep(1000);
    }

    // 步骤6: 如果需要切换回战斗队伍
    if (settings.friendshipTeam) {
        await switchBackToCombatTeam();
    }

    // 等待领奖动画/道具到账
    await sleep(1200);

    // 确保完全退出奖励界面
    await this.ensureExitRewardPage();
    
    if (settings.pickDropsAfterReward) {
        log.info(`[拾取材料] 开始执行自动拾取掉落物，拾取时间 ${settings.pickDropsSecondsValue} 秒...`);
        try {
            // TODO: 如果框架有专门的拾取API，建议替换此处的 AutoFightParam 实现
            // 因为没找到能单独调用寻找掉落物光柱的这个功能，所以拉起一个超时时间极短的战斗，但1秒钟会不可避免的放几个技能，这个也没办法
            const fightParam = new AutoFightParam();
            fightParam.timeout = 1; // 最低1秒超时（仅用于触发拾取逻辑，不进行实际战斗）
            fightParam.pickDropsAfterFightEnabled = true; // 启用战后拾取模式
            fightParam.pickDropsAfterFightSeconds = settings.pickDropsSecondsValue; // 拾取持续时间

            await dispatcher.runAutoFightTask(fightParam); // 执行拾取任务（复用战斗任务的拾取功能）
            log.info("[拾取材料] 拾取完成");
        } catch (error) {
            log.warn(`[拾取材料] 拾取过程结束: ${error.message}`);
        }
    }

    // 延迟抛出奖励领取阶段的错误
    if (rewardError) {
        throw rewardError;
    }

    // 双倍检测兜底延迟报错：所有正常流程（切换队伍、拾取材料等）执行完毕后才抛出
    if (shouldExitForSurge) {
        throw new Error("[双倍兜底] 开启了双倍检测但未检测到双倍产出，脚本终止");
    }

    return { success: true, doubleRemainingTimes, willFinishDoubleTimes };
}