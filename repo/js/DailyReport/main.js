/**
 * 每日日报脚本
 * 通过 OCR + 模板匹配识别每日委托、树脂、原石、历练点
 */

// OCR 检测函数
function wipOcrCheckText(roi1080, keywords, label, isDebug) {
    let ra = null;
    try {
        const s = genshin.scaleTo1080PRatio;
        const x = Math.round(roi1080[0] * s);
        const y = Math.round(roi1080[1] * s);
        const w = Math.round(roi1080[2] * s);
        const h = Math.round(roi1080[3] * s);

        ra = captureGameRegion();
        
        // 开发模式：绘制识别区域框
        if (isDebug) {
            drawDebugBox(roi1080);
        }

        const resList = ra.findMulti(RecognitionObject.ocr(x, y, w, h));
        const count = resList.length !== undefined ? resList.length : resList.count;

        if (isDebug) {
            log.info(`[DEBUG][${label}] ROI(1080P)=(${roi1080.join(',')}) 当前=(${x},${y},${w},${h}) 段数=${count}`);
            for (let i = 0; i < count; i++) {
                const r = resList[i];
                if (r) log.info(`[DEBUG][${label}] #${i+1} text="${r.text}" pos=(${r.x},${r.y},${r.width},${r.height})`);
            }
        }

        for (let i = 0; i < count; i++) {
            const r = resList[i];
            if (!r || !r.text) continue;
            for (let k = 0; k < keywords.length; k++) {
                if (r.text.includes(keywords[k])) return r;
            }
        }
        return null;
    } catch (e) {
        if (isDebug) {
            log.warn(`[DEBUG][${label}] OCR异常: ${e.message}`);
        }
        return null;
    } finally {
        if (ra) ra.dispose();
    }
}

// 绘制调试框（在游戏画面上显示识别区域）
async function drawDebugBox(roi1080, duration = 100) {
    try {
        const s = genshin.scaleTo1080PRatio;
        const drawRa = captureGameRegion();
        const box = {
            x: Math.round(roi1080[0] * s),
            y: Math.round(roi1080[1] * s),
            width: Math.round(roi1080[2] * s),
            height: Math.round(roi1080[3] * s)
        };
        const pen = new Pen(Color.Lime, 2);
        
        const drawRegion = drawRa.DeriveCrop(box.x, box.y, box.width, box.height);
        drawRegion.DrawSelf("icon", pen);
        
        await sleep(duration);
        drawRegion.Dispose();
        drawRa.dispose();
    } catch(e) {}
}

// 等待用户按下指定按键（KeyCode，如 "P"）
// 目前未在主流程中调用，保留供调试时手动打断点使用（如 await waitForKey("P")）
function waitForKey(key) {
    return new Promise((resolve) => {
        const hook = new KeyMouseHook();
        hook.onKeyDown((keyCode) => {
            if (keyCode === key) {
                hook.dispose();
                resolve();
            }
        });
    });
}

// 增强版：返回所有匹配结果（用于多关键词匹配场景）
function wipOcrCheckTextMulti(roi1080, keywords, label, isDebug, minMatchCount = 1) {
    let ra = null;
    try {
        const s = genshin.scaleTo1080PRatio;
        const x = Math.round(roi1080[0] * s);
        const y = Math.round(roi1080[1] * s);
        const w = Math.round(roi1080[2] * s);
        const h = Math.round(roi1080[3] * s);

        ra = captureGameRegion();
        
        // 开发模式：绘制识别区域框
        if (isDebug) {
            drawDebugBox(roi1080);
        }

        const resList = ra.findMulti(RecognitionObject.ocr(x, y, w, h));
        const count = resList.length !== undefined ? resList.length : resList.count;

        const matchedResults = [];
        const matchedKeywords = new Set();

        if (isDebug) {
            log.info(`[DEBUG][${label}] ROI(1080P)=(${roi1080.join(',')}) 当前=(${x},${y},${w},${h}) 段数=${count}`);
        }

        for (let i = 0; i < count; i++) {
            const r = resList[i];
            if (!r || !r.text) continue;

            if (isDebug) {
                log.info(`[DEBUG][${label}] #${i+1} text="${r.text}" pos=(${r.x},${r.y},${r.width},${r.height})`);
            }

            for (let k = 0; k < keywords.length; k++) {
                if (r.text.includes(keywords[k]) && !matchedKeywords.has(keywords[k])) {
                    matchedKeywords.add(keywords[k]);
                    matchedResults.push(r);
                    
                    if (isDebug) {
                        log.info(`[DEBUG][${label}] ✓ 匹配到关键词: "${keywords[k]}"`);
                    }
                }
            }
        }

        if (isDebug) {
            log.info(`[DEBUG][${label}] 匹配结果: ${matchedKeywords.size}/${keywords.length} 个关键词 (${Array.from(matchedKeywords).join(', ')})`);
        }

        return {
            success: matchedKeywords.size >= minMatchCount,
            matchCount: matchedKeywords.size,
            results: matchedResults,
            getKeywordResult: function(keyword) {
                return this.results.find(r => r && r.text && r.text.includes(keyword));
            }
        };
    } catch (e) {
        if (isDebug) {
            log.warn(`[DEBUG][${label}] OCR异常: ${e.message}`);
        }
        return { success: false, matchCount: 0, results: [], getKeywordResult: function() { return null; } };
    } finally {
        if (ra) ra.dispose();
    }
}

// OCR 获取原始文本（返回区域内所有识别到的文本拼接）
function wipOcrGetRawText(roi1080, label, isDebug) {
    let ra = null;
    try {
        const s = genshin.scaleTo1080PRatio;
        const x = Math.round(roi1080[0] * s);
        const y = Math.round(roi1080[1] * s);
        const w = Math.round(roi1080[2] * s);
        const h = Math.round(roi1080[3] * s);

        ra = captureGameRegion();
        
        // 开发模式：绘制识别区域框
        if (isDebug) {
            drawDebugBox(roi1080, 400);
        }

        const resList = ra.findMulti(RecognitionObject.ocr(x, y, w, h));
        const count = resList.length !== undefined ? resList.length : resList.count;

        if (isDebug) {
            log.info(`[DEBUG][${label}] ROI(1080P)=(${roi1080.join(',')}) 当前=(${x},${y},${w},${h}) 段数=${count}`);
        }
        let allText = "";
        for (let i = 0; i < count; i++) {
            const r = resList[i];
            if (r && r.text) {
                if (isDebug) {
                    log.info(`[DEBUG][${label}] #${i+1} text="${r.text}" pos=(${r.x},${r.y},${r.width},${r.height})`);
                }
                allText += r.text;
            }
        }
        return allText;
    } catch (e) {
        if (isDebug) {
            log.warn(`[DEBUG][${label}] OCR异常: ${e.message}`);
        }
        return "";
    } finally {
        if (ra) ra.dispose();
    }
}

// 计算字符串相似度（编辑距离）
function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const maxLen = Math.max(len1, len2);
    const distance = matrix[len1][len2];
    return 1 - (distance / maxLen);
}

// UID匹配判定：相似度 >= 8/9 视为匹配，容忍OCR一位数字误识
function isUidMatch(currentUid, expectedUid) {
    if (!currentUid || !expectedUid) {
        return false;
    }

    const currentUidStr = currentUid.toString();
    const expectedUidStr = expectedUid.toString();
    const similarity = calculateSimilarity(currentUidStr, expectedUidStr);

    log.info(`UID相似度：${(similarity * 100).toFixed(2)}% (${currentUidStr} vs ${expectedUidStr})`);

    return similarity >= 8 / 9;
}

// 从屏幕右下角识别UID，未识别到返回null
function readUidFromScreen(isDebug, tag = "") {
    const uidRoi = [1676, 1043, 190, 36];
    const raw = wipOcrGetRawText(uidRoi, `每日委托-UID${tag}`, isDebug);
    if (isDebug) {
        log.info(`UID OCR${tag}: "${raw}"`);
    }

    const match = raw.match(/UID[:：]?\s*(\d{6,})/) || raw.match(/(\d{6,})/);
    if (match) {
        log.info(`UID${tag}: ${match[1]}`);
        return match[1];
    }

    log.warn(`UID识别未匹配到有效值${tag}: "${raw}"`);
    return null;
}

// 识别每日委托流程
async function checkDailyCommissionFlow(isDebug) {
    let ocrSuccess = true;

    try {
        // 第一步：返回主界面
        log.info("第一步: 返回主界面");
        try { await genshin.returnMainUi(); } catch(e) { log.warn(`返回主界面失败: ${e.message}`); }
        await sleep(300);

        // 第二步：打开冒险手册（优先F1高效方式，失败后回退ESC菜单路线）
        log.info("第二步: 打开冒险手册");
        
        const smallRoi = [149, 861, 94, 41], largeRoi = [202, 77, 152, 783];
        const commissionSmall = [249, 300, 110, 84], commissionLarge = [98, 346, 651, 708];

        // 策略：先尝试F1快捷键2次，如果都失败则走ESC菜单路线
        let openedByEsc = false;

        // F1 第一次尝试：初始等待1.5秒 + 轮询检测（兼容卡顿情况）
        keyPress("VK_F1");
        await sleep(1500);

        let quickCheck = null;
        const maxWaitTime = 5000, pollInterval = 400;
        const startTime = Date.now();
        
        // 冒险手册特征关键词（任意2个匹配即认为界面已打开）
        const handbookKeywords = ["见闻", "委托", "秘境", "讨伐", "向导", "备战"];
        
        while (Date.now() - startTime < maxWaitTime) {
            quickCheck = wipOcrCheckTextMulti(largeRoi, handbookKeywords, "每日委托-F1轮询检测", isDebug, 2);
            if (quickCheck.success) break;
            
            const elapsed = Date.now() - startTime;
            if (elapsed + pollInterval <= maxWaitTime) {
                await sleep(pollInterval);
            }
        }

        if (!quickCheck || !quickCheck.success) {
            log.info('F1第一次未在5秒内打开冒险手册，重试...');

            // F1 第二次尝试：先回主界面，等待300ms确保状态稳定
            try { await genshin.returnMainUi(); await sleep(300); } catch(e) {}
            keyPress("VK_F1");
            await sleep(2000);

            quickCheck = wipOcrCheckTextMulti(largeRoi, handbookKeywords, "每日委托-F1快速验证-r1", isDebug, 2);
        }

        // F1 成功：切换到"委托"标签（利用页面记忆特性）
        if (quickCheck && quickCheck.success) {
            log.info(`F1快捷键成功打开冒险手册 (匹配${quickCheck.matchCount}个关键词)`);

            // 优先使用OCR识别到的"委托"坐标点击（精确），没有则用固定位置
            const commissionHit = quickCheck.getKeywordResult("委托");
            if (commissionHit) {
                const s = genshin.scaleTo1080PRatio;
                const clickX = Math.round(commissionHit.x / s + commissionHit.width / s / 2);
                const clickY = Math.round(commissionHit.y / s + commissionHit.height / s / 2);
                GameCaptureRegion.gameRegion1080PPosClick(clickX, clickY);
            } else {
                GameCaptureRegion.gameRegion1080PPosClick(304, 342);
            }
            await sleep(1000);
        }

        // F1 两次都失败，使用 ESC 菜单路线
        if (!quickCheck || !quickCheck.success) {
            log.info('F1快捷键无效，使用ESC菜单路线');
            openedByEsc = true;
            ocrSuccess = false;

            try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {}
            keyPress("VK_ESCAPE");
            await sleep(2000);

            let bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "每日委托-冒险之证", isDebug);
            if (!bookHit) { log.info('冒险之证识别失败，重试1...'); await sleep(2500); bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "每日委托-冒险之证-r1", isDebug); }
            if (!bookHit) { log.info('冒险之证识别失败，重试2...'); await sleep(2500); bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "每日委托-冒险之证-r2", isDebug); }
            if (!bookHit) { log.info('小范围失败，尝试大范围...'); bookHit = wipOcrCheckText(largeRoi, ["冒险之证"], "每日委托-冒险之证-large", isDebug); }
            if (!bookHit) { log.info('大范围失败，重新打开ESC...'); try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {} keyPress("VK_ESCAPE"); await sleep(2000); bookHit = wipOcrCheckText(largeRoi, ["冒险之证"], "每日委托-冒险之证-esc", isDebug); }

            if (bookHit) {
                const s = genshin.scaleTo1080PRatio;
                const bookX = Math.round(bookHit.x / s + bookHit.width / s / 2);
                const bookY = Math.round(bookHit.y / s + bookHit.height / s / 2) - 50;
                GameCaptureRegion.gameRegion1080PPosClick(bookX, bookY);
                await sleep(2500);
            }
        }

        // 第三步：确保在"委托"标签页
        // F1路线：第二步已点击委托标签，跳过此步骤
        // ESC路线：需要识别并点击委托标签
        if (!openedByEsc) {
            log.info("第三步: F1已确保在委托标签，跳过");
        } else {
            log.info("第三步: ESC路线，识别并点击委托");

            let commissionHit = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-委托", isDebug);
            if (!commissionHit) {
                log.info('委托识别失败，验证上一步是否生效...');

                // 【回退验证】检查是否还在菜单界面
                const menuCheck = wipOcrCheckText(smallRoi, ["冒险之证"], "每日委托-验证冒险之证", isDebug);
                if (menuCheck) {
                    log.info('检测到仍在菜单界面，重新点击冒险之证...');
                    const reBookX = Math.round(menuCheck.x / genshin.scaleTo1080PRatio + menuCheck.width / genshin.scaleTo1080PRatio / 2);
                    const reBookY = Math.round(menuCheck.y / genshin.scaleTo1080PRatio + menuCheck.height / genshin.scaleTo1080PRatio / 2) - 50;
                    GameCaptureRegion.gameRegion1080PPosClick(reBookX, reBookY);
                    await sleep(2500);
                    commissionHit = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-委托-retry", isDebug);
                }

                // 如果还是找不到，继续原有重试逻辑
                if (!commissionHit) { log.info('委托识别失败，重试1...'); await sleep(1500); commissionHit = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-委托-r1", isDebug); }
                if (!commissionHit) { log.info('委托识别失败，重试2...'); await sleep(1500); commissionHit = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-委托-r2", isDebug); }
                if (!commissionHit) { log.info('小范围失败，尝试大范围...'); commissionHit = wipOcrCheckText(commissionLarge, ["委托"], "每日委托-委托-large", isDebug); }
                if (!commissionHit) { log.info('大范围失败，重试...'); await sleep(1500); commissionHit = wipOcrCheckText(commissionLarge, ["委托"], "每日委托-委托-large2", isDebug); }
            }

            if (commissionHit) {
                const s = genshin.scaleTo1080PRatio;
                GameCaptureRegion.gameRegion1080PPosClick(Math.round(commissionHit.x/s+commissionHit.width/s/2), Math.round(commissionHit.y/s+commissionHit.height/s/2));
                await sleep(1500);
            } else {
                log.warn('委托识别失败，点击默认位置');
                ocrSuccess = false;
                GameCaptureRegion.gameRegion1080PPosClick(304, 342);
                await sleep(1500);
            }
        }

        // 第四步：识别奖励状态
        log.info("第四步: 识别奖励状态");
        const rewardRoi = [438, 827, 231, 49];
        const progressRoi = [667, 340, 66, 50];

        // 先获取原始文本
        let rawText = wipOcrGetRawText(rewardRoi, "每日委托-奖励状态-原始文本", isDebug);
        if (isDebug) {
            log.info(`原始识别文本: "${rawText}"`);
        }

        // 【回退验证】如果首次识别不到奖励相关文字，检查是否还在冒险之证界面（说明点击委托没生效）
        if (!rawText.includes("今日奖励已领取") && !rawText.includes("领取奖励")) {
            log.info('奖励状态识别失败，验证上一步是否生效...');

            const bookPageCheck = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-验证委托标签", isDebug);
            if (bookPageCheck) {
                log.info('检测到仍在冒险之证界面，重新点击委托...');
                const reCommissionX = Math.round(bookPageCheck.x / genshin.scaleTo1080PRatio + bookPageCheck.width / genshin.scaleTo1080PRatio / 2);
                const reCommissionY = Math.round(bookPageCheck.y / genshin.scaleTo1080PRatio + bookPageCheck.height / genshin.scaleTo1080PRatio / 2);
                GameCaptureRegion.gameRegion1080PPosClick(reCommissionX, reCommissionY);
                await sleep(1500);
                rawText = wipOcrGetRawText(rewardRoi, "每日委托-奖励状态-原始文本-retry", isDebug);
                if (isDebug) {
                    log.info(`重试后识别文本: "${rawText}"`);
                }
            }
        }

        // 判断逻辑
        let resultText = "";
        if (rawText.includes("今日奖励已领取")) {
            resultText = "每日委托奖励已领取";
        } else if (rawText.includes("领取奖励")) {
            // 未领取时，额外识别进度
            const progressText = wipOcrGetRawText(progressRoi, "每日委托-进度-原始文本", isDebug);
            if (isDebug) {
                log.info(`进度识别文本: "${progressText}"`);
            }
            // 提取 x/y 格式（如 "2/4"）
            const progressMatch = progressText.match(/(\d+)\s*\/\s*(\d+)/);
            if (progressMatch) {
                resultText = `每日委托奖励未领取 (${progressMatch[1]}/${progressMatch[2]})`;
            } else {
                resultText = "每日委托奖励未领取";
            }
        } else {
            // 都没识别到，重试（原有逻辑）
            log.info('奖励状态识别失败，重试1...');
            await sleep(1000);
            const rawText2 = wipOcrGetRawText(rewardRoi, "每日委托-奖励状态-原始文本-r1", isDebug);
            if (isDebug) {
                log.info(`原始识别文本: "${rawText2}"`);
            }

            if (rawText2.includes("今日奖励已领取")) {
                resultText = "每日委托奖励已领取";
            } else if (rawText2.includes("领取奖励")) {
                // 未领取时，额外识别进度
                const progressText = wipOcrGetRawText(progressRoi, "每日委托-进度-原始文本-r1", isDebug);
                if (isDebug) {
                    log.info(`进度识别文本: "${progressText}"`);
                }
                const progressMatch = progressText.match(/(\d+)\s*\/\s*(\d+)/);
                if (progressMatch) {
                    resultText = `每日委托奖励未领取 (${progressMatch[1]}/${progressMatch[2]})`;
                } else {
                    resultText = "每日委托奖励未领取";
                }
            } else {
                log.info('奖励状态识别失败，重试2...');
                await sleep(1000);
                const rawText3 = wipOcrGetRawText(rewardRoi, "每日委托-奖励状态-原始文本-r2", isDebug);
                if (isDebug) {
                    log.info(`原始识别文本: "${rawText3}"`);
                }

                if (rawText3.includes("今日奖励已领取")) {
                    resultText = "每日委托奖励已领取";
                } else if (rawText3.includes("领取奖励")) {
                    // 未领取时，额外识别进度
                    const progressText = wipOcrGetRawText(progressRoi, "每日委托-进度-原始文本-r2", isDebug);
                    if (isDebug) {
                        log.info(`进度识别文本: "${progressText}"`);
                    }
                    const progressMatch = progressText.match(/(\d+)\s*\/\s*(\d+)/);
                    if (progressMatch) {
                        resultText = `每日委托奖励未领取 (${progressMatch[1]}/${progressMatch[2]})`;
                    } else {
                        resultText = "每日委托奖励未领取";
                    }
                } else {
                    resultText = "每日委托奖励状态识别失败";
                }
            }
        }

        notification.Send(resultText);

        // 4.5 识别历练点（与委托同屏，无需切换）
        let encounterPointsText = null;
        {
            const encounterRoi = [752, 814, 257, 50];
            const raw = wipOcrGetRawText(encounterRoi, "每日委托-历练点", isDebug);
            if (isDebug) {
                log.info(`历练点OCR: "${raw}"`);
            }
            const match = raw.match(/长效历练点\s*([\d.]+)/);
            if (match) {
                encounterPointsText = `历练点:${match[1]}`;
                log.info(`${encounterPointsText}`);
            } else {
                log.warn(`历练点识别未匹配到有效值: "${raw}"`);
            }
        }

        // 4.6 识别UID（需账号备注名+开关双重开启）
        let uidText = null;
        if (typeof settings.accountName === "string" && settings.accountName.trim() !== "" && settings.checkUid) {
            uidText = readUidFromScreen(isDebug);
        }

        // 第五步：识别树脂（实验性功能，需在冒险之证关闭前执行）
        let resinSummary = null;
        let primogemCount = null;
        if (settings.checkResin) {
            log.info("第五步: 识别树脂（实验性）");
            let iconMats = null;
            try {
                const resinTabRoi = [202, 77, 152, 783];
                const secretHit = wipOcrCheckText(resinTabRoi, ["秘境"], "每日委托-秘境标签", isDebug);

                if (secretHit) {
                    const s = genshin.scaleTo1080PRatio;
                    const secretX = Math.round(secretHit.x / s + secretHit.width / s / 2);
                    const secretY = Math.round(secretHit.y / s + secretHit.height / s / 2);
                    GameCaptureRegion.gameRegion1080PPosClick(secretX, secretY);
                    await sleep(2000);

                    // ========== 树脂识别主逻辑（图标模板确认界面 + OCR读数字） ==========
                    const resinRoi = [1200, 188, 340, 67];
                    const origDigitRoi = [1336, 193, 141, 50], condDigitRoi = [1188, 194, 138, 55];

                    // 模板匹配辅助：在指定1080P区域内搜索，返回全屏坐标
                    async function tmFindInRoi(ro, roi1080, isDebug, timeout = 2000) {
                        const scale = genshin.scaleTo1080PRatio;
                        const cx = Math.round(roi1080[0] * scale), cy = Math.round(roi1080[1] * scale);
                        const cw = Math.round(roi1080[2] * scale), ch = Math.round(roi1080[3] * scale);
                        if (isDebug) { drawDebugBox(roi1080, 600); }
                        const start = Date.now();
                        while (Date.now() - start < timeout) {
                            const fullRa = captureGameRegion();
                            const cropRa = fullRa.DeriveCrop(cx, cy, cw, ch);
                            const result = cropRa.find(ro);
                            if (result.isExist()) {
                                // result.x/y 是相对 crop 的坐标，转成全屏坐标
                                result.x += cx;
                                result.y += cy;
                                cropRa.dispose();
                                fullRa.dispose();
                                return result;
                            }
                            cropRa.dispose();
                            fullRa.dispose();
                            await sleep(500);
                        }
                        return null;
                    }

                    // 加载图标模板（仅用于确认界面已打开 + 点击补充按钮）
                    iconMats = {
                        original: file.ReadImageMatSync("assets/icon/original_resin.png"),
                        condensed: file.ReadImageMatSync("assets/icon/condensed_resin.png"),
                        replenish: file.ReadImageMatSync("assets/icon/replenish_resin_button.png"),
                        transient: file.ReadImageMatSync("assets/icon/transient_resin.png"),
                        fragile: file.ReadImageMatSync("assets/icon/fragile_resin.png"),
                        primogem: file.ReadImageMatSync("assets/icon/primogem.png")
                    };
                    const iconTm = {
                        original: RecognitionObject.TemplateMatch(iconMats.original),
                        condensed: RecognitionObject.TemplateMatch(iconMats.condensed),
                        replenish: RecognitionObject.TemplateMatch(iconMats.replenish),
                        transient: RecognitionObject.TemplateMatch(iconMats.transient),
                        fragile: RecognitionObject.TemplateMatch(iconMats.fragile),
                        primogem: RecognitionObject.TemplateMatch(iconMats.primogem)
                    };

                    let resinResult = [];

                    // 树脂数量上限（维护时在此调整；原石不设上限）
                    const RESIN_LIMITS = { original: 200, condensed: 5, transient: 9, fragile: 999 };

                    // 校验数量：非负整数且不超过上限；原粹允许临时溢出（吃脆弱/须臾后可超200）；原石不设上限
                    function validateResinCount(value, type) {
                        const n = parseInt(value, 10);
                        if (isNaN(n) || n < 0) return false;
                        if (type === "primogem") return true;
                        if (type === "original") return n < 999;
                        return n <= RESIN_LIMITS[type];
                    }

                    // OCR 读数字并校验，失败重试（maxRetry 次）
                    async function readResinNumber(digitRoi, type, label, regex, maxRetry = 2) {
                        for (let attempt = 0; attempt <= maxRetry; attempt++) {
                            const raw = wipOcrGetRawText(digitRoi, `每日委托-${label}`, isDebug);
                            if (isDebug) { log.info(`${label}OCR: "${raw}"`); }
                            const match = raw.match(regex);
                            if (match) {
                                const value = match[1] !== undefined ? match[1] : match[0];
                                if (validateResinCount(value, type)) return value;
                            }
                            if (attempt < maxRetry) await sleep(300);
                        }
                        return null;
                    }

                    // 数字模板匹配：在指定1080P区域内匹配数字模板，返回 {value, score} 或 null
                    // customTemplates 可选，格式 [{value, path}]；不传则用 0~maxDigit 的 ${d}.png
                    function matchDigitTemplate(digitRoi1080, maxDigit, customTemplates) {
                        const s = genshin.scaleTo1080PRatio;
                        const rx = Math.round(digitRoi1080[0] * s);
                        const ry = Math.round(digitRoi1080[1] * s);
                        const rw = Math.round(digitRoi1080[2] * s);
                        const rh = Math.round(digitRoi1080[3] * s);

                        const templates = customTemplates || [];
                        if (!customTemplates) {
                            for (let d = 0; d <= maxDigit; d++) {
                                templates.push({ value: d, path: `assets/icon/${d}.png` });
                            }
                        }

                        let best = { value: -1, score: -1 };
                        let ra = null;
                        try {
                            ra = captureGameRegion();
                            for (const t of templates) {
                                const mat = file.ReadImageMatSync(t.path);
                                try {
                                    const ro = RecognitionObject.TemplateMatch(mat, rx, ry, rw, rh);
                                    ro.threshold = 0.5;
                                    const res = ra.find(ro);
                                    const score = res && typeof res.matchScore === "number" ? res.matchScore : -1;
                                    if (isDebug) {
                                        log.info(`模板${t.value}得分: ${score >= 0 ? score.toFixed(3) : "无"}`);
                                    }
                                    if (score > best.score) {
                                        best = { value: t.value, score: score };
                                    }
                                    if (res) res.dispose();
                                } finally {
                                    mat.dispose();
                                }
                            }
                        } catch (e) {
                            log.warn(`数字模板匹配异常: ${e.message}`);
                        } finally {
                            if (ra) ra.dispose();
                        }

                        if (best.score >= 0.78) {
                            return best;
                        }
                        return null;
                    }

                    // 多位数模板匹配：在指定区域内匹配所有数字，按x坐标排序拼接，返回 {value, score} 或 null
                    // 用于原粹树脂（格式如 "122/200"，取斜杠前的部分）
                    function matchMultiDigitTemplate(digitRoi1080, maxDigit) {
                        const s = genshin.scaleTo1080PRatio;
                        const rx = Math.round(digitRoi1080[0] * s);
                        const ry = Math.round(digitRoi1080[1] * s);
                        const rw = Math.round(digitRoi1080[2] * s);
                        const rh = Math.round(digitRoi1080[3] * s);

                        const hits = [];
                        let ra = null;
                        try {
                            ra = captureGameRegion();
                            for (let d = 0; d <= maxDigit; d++) {
                                const mat = file.ReadImageMatSync(`assets/icon/${d}.png`);
                                try {
                                    const ro = RecognitionObject.TemplateMatch(mat, rx, ry, rw, rh);
                                    ro.threshold = 0.85;
                                    const resList = ra.findMulti(ro);
                                    const count = resList.length !== undefined ? resList.length : resList.count;
                                    for (let i = 0; i < count; i++) {
                                        const res = resList[i];
                                        if (res) {
                                            hits.push({ digit: d, x: res.x, score: res.matchScore });
                                        }
                                    }
                                } finally {
                                    mat.dispose();
                                }
                            }
                        } catch (e) {
                            log.warn(`多位数模板匹配异常: ${e.message}`);
                        } finally {
                            if (ra) ra.dispose();
                        }

                        if (hits.length === 0) return null;

                        hits.sort((a, b) => a.x - b.x);

                        if (isDebug) {
                            log.info(`多位数模板命中: ${hits.map(h => `${h.digit}@${h.x}(${h.score.toFixed(2)})`).join(" ")}`);
                        }

                        // 拼接所有命中数字，优先按固定上限"200"砍尾，否则用最大间距断开
                        const allDigits = hits.map(h => h.digit).join("");
                        let result = allDigits;
                        if (allDigits.length >= 3 && allDigits.endsWith("200")) {
                            result = allDigits.slice(0, -3);
                        } else if (hits.length > 1) {
                            let maxGap = 0;
                            let splitAt = hits.length;
                            for (let i = 1; i < hits.length; i++) {
                                const gap = hits[i].x - hits[i - 1].x;
                                if (gap > maxGap) {
                                    maxGap = gap;
                                    splitAt = i;
                                }
                            }
                            result = allDigits.slice(0, splitAt);
                        }

                        if (result === "") return null;
                        const minScore = Math.min(...hits.slice(0, result.length).map(h => h.score));
                        return { value: result, score: minScore };
                    }

                    // 模板识别优先，失败则OCR兜底
                    async function readResinByTemplateOrOcr(digitRoi, type, label, regex, maxDigit, multiDigit = false) {
                        const tmResult = multiDigit ? matchMultiDigitTemplate(digitRoi, maxDigit) : matchDigitTemplate(digitRoi, maxDigit);
                        if (tmResult) {
                            const v = String(tmResult.value);
                            if (validateResinCount(v, type)) return v;
                        }
                        return await readResinNumber(digitRoi, type, label, regex);
                    }

                    // 1. 确认原粹树脂图标存在 → 多位数模板优先，OCR兜底
                    const origHit = await tmFindInRoi(iconTm.original, resinRoi, isDebug);
                    if (origHit) {
                        const value = await readResinByTemplateOrOcr(origDigitRoi, "original", "原粹树脂", /(\d+)[\/／]\d+/, 9, true);
                        if (value !== null) {
                            resinResult.push(`原粹:${value}`);
                            log.info(`原粹树脂: ${value}`);
                        } else {
                            log.warn("原粹树脂数量识别失败或超限");
                        }
                    } else {
                        log.warn("未找到原粹树脂图标");
                    }

                    // 2. 确认浓缩树脂图标存在 → 模板优先（0~5），OCR兜底
                    const condHit = await tmFindInRoi(iconTm.condensed, resinRoi, isDebug);
                    if (condHit) {
                        const value = await readResinByTemplateOrOcr(condDigitRoi, "condensed", "浓缩树脂", /\d+/, 5);
                        if (value !== null) {
                            resinResult.push(`浓缩:${value}`);
                            log.info(`浓缩树脂: ${value}`);
                        } else {
                            log.warn("浓缩树脂数量识别失败或超限");
                        }
                    } else {
                        log.warn("未找到浓缩树脂图标");
                    }

                    // 3. 模板匹配补充按钮并点击
                    log.info("查找补充树脂按钮（限制在树脂区域内）...");
                    const btnHit = await tmFindInRoi(iconTm.replenish, resinRoi, isDebug);
                    if (btnHit) {
                        log.info("找到补充树脂按钮，点击");
                        btnHit.click();
                    } else {
                        log.warn("未找到补充按钮，使用固定位置点击");
                        GameCaptureRegion.gameRegion1080PPosClick(resinRoi[0] + resinRoi[2] / 2, resinRoi[1] + resinRoi[3] / 2);
                    }
                    await sleep(1500);

                    // 4. 补充界面：模板匹配图标 + OCR 读数字（限定在补充面板区域内）
                    {
                        const supplementRoi = [501, 309, 898, 418];
                        const s = genshin.scaleTo1080PRatio;

                        const tranHit = await tmFindInRoi(iconTm.transient, supplementRoi, isDebug);
                        if (tranHit) {
                            const tranDigitRoi = [tranHit.x / s, (tranHit.y + tranHit.height) / s, tranHit.width / s, 60 / s];
                            if (isDebug) await drawDebugBox(tranDigitRoi, 600);
                            let value = await readResinNumber(tranDigitRoi, "transient", "须臾树脂", /\d+/);
                            if (value === null) {
                                const tmRes = matchDigitTemplate(tranDigitRoi, 4, [
                                    { value: 1, path: "assets/icon/num1.png" },
                                    { value: 2, path: "assets/icon/num2.png" },
                                    { value: 3, path: "assets/icon/num3.png" },
                                    { value: 4, path: "assets/icon/num4.png" }
                                ]);
                                if (tmRes) {
                                    value = String(tmRes.value);
                                    log.info(`须臾树脂模板命中: ${value}（得分 ${tmRes.score.toFixed(2)}）`);
                                }
                            }
                            if (value !== null) {
                                resinResult.push(`须臾:${value}`);
                                log.info(`须臾树脂: ${value}`);
                            } else {
                                log.warn("须臾树脂数量识别失败或超限");
                            }
                        }

                        const fragHit = await tmFindInRoi(iconTm.fragile, supplementRoi, isDebug);
                        if (fragHit) {
                            const fragDigitRoi = [fragHit.x / s, (fragHit.y + fragHit.height) / s, fragHit.width / s, 60 / s];
                            if (isDebug) await drawDebugBox(fragDigitRoi, 600);
                            const value = await readResinNumber(fragDigitRoi, "fragile", "脆弱树脂", /\d+/);
                            if (value !== null) {
                                resinResult.push(`脆弱:${value}`);
                                log.info(`脆弱树脂: ${value}`);
                            } else {
                                log.warn("脆弱树脂数量识别失败或超限");
                            }
                        }

                        const gemHit = await tmFindInRoi(iconTm.primogem, supplementRoi, isDebug);
                        if (gemHit) {
                            const gemDigitRoi = [gemHit.x / s, (gemHit.y + gemHit.height) / s, gemHit.width / s, 60 / s];
                            if (isDebug) await drawDebugBox(gemDigitRoi, 600);
                            const value = await readResinNumber(gemDigitRoi, "primogem", "原石", /\d+/);
                            if (value !== null) {
                                primogemCount = value;
                                log.info(`原石: ${value}`);
                            } else {
                                log.warn("原石数量识别失败或超限");
                            }
                        }

                        // 须臾剩余天数：整面板OCR，匹配「N天后过期」
                        const panelText = wipOcrGetRawText(supplementRoi, "补充面板", isDebug);
                        const dayMatch = panelText.replace(/\s/g, "").match(/(\d{1,3})天后过期/);
                        if (dayMatch) {
                            const days = parseInt(dayMatch[1], 10);
                            log.info(`须臾树脂剩余 ${days} 天`);
                            const idx = resinResult.findIndex(r => r.startsWith("须臾:"));
                            if (idx >= 0) {
                                resinResult[idx] += `(${days}天)`;
                            }
                        }
                    }

                    // 关闭补充界面
                    keyPress("VK_ESCAPE");
                    await sleep(800);

                    if (resinResult.length > 0) {
                        resinSummary = resinResult.join(" ");
                        const msg = `树脂: ${resinSummary}` + (primogemCount ? ` 原石:${primogemCount}` : "");
                        notification.Send(msg);
                    }
                } else {
                    log.warn('未找到"秘境"标签，跳过树脂识别');
                }
            } catch (resinError) {
                log.warn(`树脂识别异常: ${resinError.message}`);
            } finally {
                if (iconMats) {
                    for (const k of Object.keys(iconMats)) {
                        try { iconMats[k].dispose(); } catch (_) {}
                    }
                }
            }
        }

        // 账号缓存：如果配置了账号名且识别结果有效，写入缓存文件
        const accountName = settings.accountName;
        const isCommissionValid = resultText && resultText !== "每日委托奖励状态识别失败";

        // UID校验：识别UID(checkUid)为前置条件，未开启识别时校验功能视为未启用
        const accountNameValid = typeof accountName === "string" && accountName.trim() !== "";
        const uidRecognitionEnabled = settings.checkUid && accountNameValid;
        const expectedUid = typeof settings.expectedUid === "string" ? settings.expectedUid.trim() : "";

        let uidVerificationPassed = true;
        let uidVerificationReason = "";

        if (settings.verifyUid && !uidRecognitionEnabled) {
            if (!settings.checkUid) {
                log.warn("已开启UID校验但未开启识别UID，本次校验跳过");
            } else {
                log.warn("已开启UID校验但未填写账号备注名，本次校验跳过");
            }
        }

        if (settings.verifyUid && uidRecognitionEnabled) {
            if (expectedUid === "") {
                log.warn("已开启UID校验但未填写期望UID，本次校验跳过");
            } else {
                let matched = isUidMatch(uidText, expectedUid);

                if (!matched) {
                    log.warn(`UID校验未通过（当前: ${uidText || "未识别"}），同区域重新识别一次`);
                    await sleep(800);
                    const retryUid = readUidFromScreen(isDebug, "-重试");
                    if (retryUid) {
                        uidText = retryUid;
                        matched = isUidMatch(uidText, expectedUid);
                    }
                }

                if (!matched) {
                    uidVerificationPassed = false;
                    if (!uidText) {
                        uidVerificationReason = `已开启UID校验，但未能识别到当前账号UID（期望UID: ${expectedUid}）`;
                    } else {
                        uidVerificationReason = `UID校验不通过：当前账号UID ${uidText} 与期望UID ${expectedUid} 不一致`;
                    }
                }
            }
        }

        if (!uidVerificationPassed) {
            notification.Error(`${uidVerificationReason}，本次结果未写入缓存，请检查账号切换是否正常`);
        }

        if (typeof accountName === "string" && accountName.trim() !== "" && isCommissionValid && uidVerificationPassed) {
            const cachePath = "account_cache.json";
            let cache = {};
            try {
                const raw = file.ReadTextSync(cachePath);
                if (raw) { cache = JSON.parse(raw); }
            } catch (_) { cache = {}; }

            cache[accountName.trim()] = {
                commission: resultText,
                resin: resinSummary || "未识别",
                primogem: primogemCount || null,
                encounter: encounterPointsText || "未识别",
                uid: uidText || null,
                time: getBeijingTimeStr()
            };

            file.WriteTextSync(cachePath, JSON.stringify(cache, null, 2));
            const cacheInfo = `${resultText}` + (resinSummary ? ` | ${resinSummary}` : "") + (primogemCount ? ` | 原石:${primogemCount}` : "");
            log.info(`已缓存账号"${accountName.trim()}": ${cacheInfo}`);
        }

        try { await genshin.returnMainUi(); } catch(e) { log.warn(`还原主界面失败: ${e.message}`); }
        await sleep(500);

    } catch (ex) {
        notification.Error(`每日委托检查失败: ${ex.message}`);
        try { await genshin.returnMainUi(); } catch(e2) { log.warn(`异常后还原主界面失败: ${e2.message}`); }
        await sleep(500);
    }
}

// 生成当前北京时间（UTC+8）的带时区信息字符串，如 "2026-10-31T02:16:31+08:00"
// 无论运行机器在哪个时区，new Date() 都能正确解析，不受本地时区影响
function getBeijingTimeStr() {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    });
    const parts = fmt.formatToParts(now);
    const get = (t) => parts.find(p => p.type === t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`;
}

// 解析缓存记录时间，返回 Date（缓存使用带 +08:00 的北京时间字符串，任何时区解析一致）
function parseCacheTime(timeStr) {
    if (!timeStr) return null;
    const t = new Date(timeStr);
    return isNaN(t.getTime()) ? null : t;
}

// 计算当前原神每日周期的起止时间（每日 4:00 刷新，按北京时间）
function getCurrentCycle() {
    // 直接取北京当前的 年/月/日/时，不依赖运行机器本地时区
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", hour12: false
    });
    const parts = fmt.formatToParts(new Date());
    const get = (t) => parts.find(p => p.type === t)?.value;
    const hour = Number(get('hour')) % 24; // 防御 hour12:false 可能的 "24" 情形
    // 北京 4:00 的绝对时刻作为周期起点；现在早于 4:00 则属于前一天开始的周期
    const todayStart = new Date(`${get('year')}-${get('month')}-${get('day')}T04:00:00+08:00`);
    const start = hour < 4 ? new Date(todayStart.getTime() - 86400000) : todayStart;
    const end = new Date(start.getTime() + 86400000);
    return { start, end };
}

// 总览模式：仅读取 account_cache.json 汇总结果，不进行任何游戏操作
function runOverviewMode() {
    const cachePath = "account_cache.json";
    let cache = {};
    try {
        const raw = file.ReadTextSync(cachePath);
        if (raw) { cache = JSON.parse(raw); }
    } catch (e) {
        log.warn(`读取缓存失败: ${e.message}`);
        notification.Send("每日总览：缓存文件读取失败，请先运行各账号的委托检查");
        return;
    }

    const cycle = getCurrentCycle();

    // 参数校验：标记每条记录是否在当前周期内，过期数据按未完成处理并明确提示
    const records = [];
    for (const name in cache) {
        const rec = cache[name];
        if (!rec || !rec.time) {
            records.push({ name, ...rec, expired: true });
            continue;
        }
        const recTime = parseCacheTime(rec.time);
        if (!recTime) {
            records.push({ name, ...rec, expired: true });
            continue;
        }
        const expired = !(recTime >= cycle.start && recTime < cycle.end);
        records.push({ name, ...rec, expired });
    }

    if (records.length === 0) {
        const msg = "每日总览：当前周期内无有效账号缓存记录（请先运行各账号的委托检查）";
        notification.Send(msg);
        return;
    }

    // 解析委托状态（过期数据不计入已领取）
    const claimed = [];
    const unclaimedDone = [];
    const unclaimedNotDone = [];
    const commissionUnknown = [];
    const expiredCommission = [];

    for (const r of records) {
        if (r.expired) {
            expiredCommission.push(r.name);
            continue;
        }
        const c = r.commission || "";
        if (c.includes("已领取")) {
            claimed.push(r.name);
        } else if (c.includes("未领取")) {
            const m = c.match(/(\d+)\s*\/\s*(\d+)/);
            if (m) {
                const done = parseInt(m[1], 10);
                const total = parseInt(m[2], 10);
                if (done >= total) {
                    unclaimedDone.push({ name: r.name, done, total });
                } else {
                    unclaimedNotDone.push({ name: r.name, done, total });
                }
            } else {
                unclaimedNotDone.push({ name: r.name, done: null, total: null });
            }
        } else {
            commissionUnknown.push(r.name);
        }
    }

    const allClaimed = claimed.length === records.length;

    // 解析原粹树脂（不计算浓缩/脆弱，过期数据不可信）
    const RESIN_THRESHOLD = 20;
    const exhausted = [];
    const remaining = [];
    const resinUnknown = [];
    const expiredResin = [];

    for (const r of records) {
        if (r.expired) {
            expiredResin.push(r.name);
            continue;
        }
        let original = null;
        if (r.resin) {
            const m = r.resin.match(/原粹:(\d+)/);
            if (m) original = parseInt(m[1], 10);
        }
        if (original === null) {
            resinUnknown.push(r.name);
        } else if (original < RESIN_THRESHOLD) {
            exhausted.push(r.name);
        } else {
            remaining.push({ name: r.name, original });
        }
    }

    const allExhausted = remaining.length === 0 && resinUnknown.length === 0 && expiredResin.length === 0;

    // 解析历练点（>12 不提醒；<4 提示不足以完成每日委托）
    const ENCOUNTER_THRESHOLD = 12;
    const ENCOUNTER_MIN = 4;
    const encounterLow = [];

    for (const r of records) {
        if (!r.encounter) continue;
        const m = r.encounter.match(/历练点:(\d+(?:\.\d+)?)/);
        if (!m) continue;
        const val = parseFloat(m[1]);
        if (val > ENCOUNTER_THRESHOLD) continue;
        const rounded = Math.floor(val);
        const note = val < ENCOUNTER_MIN ? "，不足以完成每日委托" : "";
        encounterLow.push(`${r.name}历练点剩余${rounded}${note}`);
    }

    // 组装总览文本
    const lines = [];

    if (allClaimed) {
        lines.push("每日总览：所有账号的委托均已完成");
    } else {
        lines.push("每日总览：有部分账号委托未完成");
    }

    if (allExhausted) {
        lines.push("体力总览：所有账号的体力已用尽");
    } else {
        lines.push("体力总览：有部分账号体力未用尽");
    }

    if (!allClaimed) {
        lines.push("每日详细：");
        for (const r of unclaimedDone) {
            lines.push(`${r.name}每日委托未领取，进度${r.done}/${r.total}`);
        }
        for (const r of unclaimedNotDone) {
            if (r.done !== null) {
                lines.push(`${r.name}每日委托未完成，进度${r.done}/${r.total}`);
            } else {
                lines.push(`${r.name}每日委托未完成`);
            }
        }
        for (const n of expiredCommission) {
            lines.push(`${n}为过期数据，数据不可信`);
        }
        for (const n of commissionUnknown) {
            lines.push(`${n}委托状态未知`);
        }
        if (claimed.length > 0) {
            lines.push(`${claimed.join("，")}每日委托已领取`);
        }
    }

    if (!allExhausted) {
        lines.push("体力详细：");
        for (const r of remaining) {
            lines.push(`${r.name}体力剩余${r.original}`);
        }
        for (const n of expiredResin) {
            lines.push(`${n}为过期数据，数据不可信`);
        }
        for (const n of resinUnknown) {
            lines.push(`${n}体力未识别`);
        }
        if (exhausted.length > 0) {
            lines.push(`${exhausted.join("，")}体力已用尽`);
        }
    }

    if (encounterLow.length > 0) {
        for (const line of encounterLow) {
            lines.push(line);
        }
    }

    const summary = lines.join("\n");
    notification.Send(summary);
}

(async function () {
    try {
        const isDebug = settings.isDebug;

        if (settings.isOverviewMode) {
            runOverviewMode();
        } else {
            await checkDailyCommissionFlow(isDebug);
        }
    } catch (error) {
        notification.Error(`自动每日委托检查脚本出错: ${error.message}`);
    }
})();