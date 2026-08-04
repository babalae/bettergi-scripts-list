/**
 * 自动每日委托检查脚本
 * 通过 OCR 识别每日委托是否已领取
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

// 识别每日委托流程
async function checkDailyCommissionFlow(isNotification, isDebug) {
    log.info("========== 开始检查每日委托 ==========");
    
    let ocrSuccess = true;
    
    try {
        // 第一步：返回主界面
        log.info("[每日委托] 第一步: 返回主界面");
        try { await genshin.returnMainUi(); } catch(e) { log.warn(`[每日委托] 返回主界面失败: ${e.message}`); }
        await sleep(100);

        // 第二步：ESC打开菜单 → OCR识别冒险之证 → 点击
        log.info("[每日委托] 第二步: ESC打开菜单");
        keyPress("VK_ESCAPE");
        await sleep(2000);

        let bookHit = null;
        const smallRoi = [149, 861, 94, 41], largeRoi = [98, 346, 651, 708];

        bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "每日委托-冒险之证", isDebug);
        if (!bookHit) { log.info('[每日委托] 冒险之证识别失败，重试1...'); await sleep(2500); bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "每日委托-冒险之证-r1", isDebug); }
        if (!bookHit) { log.info('[每日委托] 冒险之证识别失败，重试2...'); await sleep(2500); bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "每日委托-冒险之证-r2", isDebug); }
        if (!bookHit) { log.info('[每日委托] 小范围失败，尝试大范围...'); bookHit = wipOcrCheckText(largeRoi, ["冒险之证"], "每日委托-冒险之证-large", isDebug); }
        if (!bookHit) { log.info('[每日委托] 大范围失败，重新打开ESC...'); try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {} keyPress("VK_ESCAPE"); await sleep(2000); bookHit = wipOcrCheckText(largeRoi, ["冒险之证"], "每日委托-冒险之证-esc", isDebug); }

        if (bookHit) {
            const s = genshin.scaleTo1080PRatio;
            const bookX = Math.round(bookHit.x / s + bookHit.width / s / 2);
            const bookY = Math.round(bookHit.y / s + bookHit.height / s / 2) - 50;
            log.info(`[每日委托] 点击冒险之证: (${bookX}, ${bookY})`);
            GameCaptureRegion.gameRegion1080PPosClick(bookX, bookY);
            await sleep(2500);
        } else {
            log.warn('[每日委托] 冒险之证识别失败，尝试F1快捷键');
            ocrSuccess = false;
            try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {}
            keyPress("VK_F1");
            await sleep(2000);
        }

        // 第三步：识别"委托"
        log.info("[每日委托] 第三步: 识别委托");
        const commissionSmall = [249, 300, 110, 84], commissionLarge = [98, 346, 651, 708];
        
        let commissionHit = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-委托", isDebug);
        if (!commissionHit) { log.info('[每日委托] 委托识别失败，重试1...'); await sleep(1500); commissionHit = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-委托-r1", isDebug); }
        if (!commissionHit) { log.info('[每日委托] 委托识别失败，重试2...'); await sleep(1500); commissionHit = wipOcrCheckText(commissionSmall, ["委托"], "每日委托-委托-r2", isDebug); }
        if (!commissionHit) { log.info('[每日委托] 小范围失败，尝试大范围...'); commissionHit = wipOcrCheckText(commissionLarge, ["委托"], "每日委托-委托-large", isDebug); }
        if (!commissionHit) { log.info('[每日委托] 大范围失败，重试...'); await sleep(1500); commissionHit = wipOcrCheckText(commissionLarge, ["委托"], "每日委托-委托-large2", isDebug); }

        if (commissionHit) {
            const s = genshin.scaleTo1080PRatio;
            log.info(`[每日委托] 点击委托: (${Math.round(commissionHit.x/s+commissionHit.width/s/2)}, ${Math.round(commissionHit.y/s+commissionHit.height/s/2)})`);
            GameCaptureRegion.gameRegion1080PPosClick(Math.round(commissionHit.x/s+commissionHit.width/s/2), Math.round(commissionHit.y/s+commissionHit.height/s/2));
            await sleep(1500);
        } else {
            log.warn('[每日委托] 委托识别失败，点击默认位置');
            ocrSuccess = false;
            GameCaptureRegion.gameRegion1080PPosClick(304, 342);
            await sleep(1500);
        }

        // 第四步：识别奖励状态
        log.info("[每日委托] 第四步: 识别奖励状态");
        const rewardRoi = [438, 827, 231, 49];
        const progressRoi = [667, 340, 66, 50];
        
        // 先获取原始文本
        const rawText = wipOcrGetRawText(rewardRoi, "每日委托-奖励状态-原始文本", isDebug);
        if (isDebug) {
            log.info(`[每日委托] 原始识别文本: "${rawText}"`);
        }

        // 判断逻辑
        let resultText = "";
        if (rawText.includes("今日奖励已领取")) {
            resultText = "每日委托奖励已领取";
        } else if (rawText.includes("领取奖励")) {
            // 未领取时，额外识别进度
            const progressText = wipOcrGetRawText(progressRoi, "每日委托-进度-原始文本", isDebug);
            if (isDebug) {
                log.info(`[每日委托] 进度识别文本: "${progressText}"`);
            }
            // 提取 x/y 格式（如 "2/4"）
            const progressMatch = progressText.match(/(\d+)\s*\/\s*(\d+)/);
            if (progressMatch) {
                resultText = `每日委托奖励未领取 (${progressMatch[1]}/${progressMatch[2]})`;
            } else {
                resultText = "每日委托奖励未领取";
            }
        } else {
            // 都没识别到，重试
            log.info('[每日委托] 奖励状态识别失败，重试1...');
            await sleep(1000);
            const rawText2 = wipOcrGetRawText(rewardRoi, "每日委托-奖励状态-原始文本-r1", isDebug);
            if (isDebug) {
                log.info(`[每日委托] 原始识别文本: "${rawText2}"`);
            }
            
            if (rawText2.includes("今日奖励已领取")) {
                resultText = "每日委托奖励已领取";
            } else if (rawText2.includes("领取奖励")) {
                // 未领取时，额外识别进度
                const progressText = wipOcrGetRawText(progressRoi, "每日委托-进度-原始文本-r1", isDebug);
                if (isDebug) {
                    log.info(`[每日委托] 进度识别文本: "${progressText}"`);
                }
                const progressMatch = progressText.match(/(\d+)\s*\/\s*(\d+)/);
                if (progressMatch) {
                    resultText = `每日委托奖励未领取 (${progressMatch[1]}/${progressMatch[2]})`;
                } else {
                    resultText = "每日委托奖励未领取";
                }
            } else {
                log.info('[每日委托] 奖励状态识别失败，重试2...');
                await sleep(1000);
                const rawText3 = wipOcrGetRawText(rewardRoi, "每日委托-奖励状态-原始文本-r2", isDebug);
                if (isDebug) {
                    log.info(`[每日委托] 原始识别文本: "${rawText3}"`);
                }
                
                if (rawText3.includes("今日奖励已领取")) {
                    resultText = "每日委托奖励已领取";
                } else if (rawText3.includes("领取奖励")) {
                    // 未领取时，额外识别进度
                    const progressText = wipOcrGetRawText(progressRoi, "每日委托-进度-原始文本-r2", isDebug);
                    if (isDebug) {
                        log.info(`[每日委托] 进度识别文本: "${progressText}"`);
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
        
        log.info(`[每日委托] 识别结果: ${resultText}`);
        if (isNotification) {
            notification.Send(resultText);
        }

        try { await genshin.returnMainUi(); } catch(e) { log.warn(`[每日委托] 还原主界面失败: ${e.message}`); }
        await sleep(500);

    } catch (ex) {
        log.warn(`[每日委托] 检测异常: ${ex.message}`);
        if (isNotification) {
            notification.Send("错误：每日委托检查失败");
        }
        try { await genshin.returnMainUi(); } catch(e2) { log.warn(`[每日委托] 异常后还原主界面失败: ${e2.message}`); }
        await sleep(500);
    }
}

(async function () {
    try {
        log.info("========== 自动每日委托检查脚本启动 ==========");

        const isNotification = settings.isNotification;
        const isDebug = settings.isDebug;

        await checkDailyCommissionFlow(isNotification, isDebug);

        log.info("========== 自动每日委托检查脚本完成 ==========");
    } catch (error) {
        log.error("脚本执行出错: {error}", error.message);
        if (settings.isNotification) {
            notification.Error(`自动每日委托检查脚本出错: ${error.message}`);
        }
    }
})();