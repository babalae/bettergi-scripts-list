/**
 * 自动地脉花脚本 - API 版本
 * 使用 BetterGI JsAPI 的 dispatcher.runAutoLeyLineOutcropTask 实现
 */

// OCR 检测函数
function wipOcrCheckText(roi1080, keywords, label) {
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

        if (typeof enableDebug !== "undefined" && enableDebug) {
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
        log.warn(`[DEBUG][${label}] OCR异常: ${e.message}`);
        return null;
    } finally {
        if (ra) ra.dispose();
    }
}

// 识别地脉移涌流程，返回是否检测到双倍
async function detectLeyLineSurgeFlow() {
    log.info("========== 开始识别地脉移涌 ==========");
    
    let ocrSuccess = true; // 追踪 OCR 是否成功走到最后一步
    
    try {
        // 第一步：返回主界面
        log.info("[地脉移涌] 第一步: 返回主界面");
        try { await genshin.returnMainUi(); } catch(e) { log.warn(`[地脉移涌] 返回主界面失败: ${e.message}`); }
        await sleep(100);

        // 第二步：ESC打开菜单 → OCR识别冒险之证 → 点击
        log.info("[地脉移涌] 第二步: ESC打开菜单");
        keyPress("VK_ESCAPE");
        await sleep(2000);

        let bookHit = null;
        const smallRoi = [149, 861, 94, 41], largeRoi = [98, 346, 651, 708];

        bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "地脉移涌-冒险之证");
        if (!bookHit) { log.info('[地脉移涌] 冒险之证识别失败，重试1...'); await sleep(2500); bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "地脉移涌-冒险之证-r1"); }
        if (!bookHit) { log.info('[地脉移涌] 冒险之证识别失败，重试2...'); await sleep(2500); bookHit = wipOcrCheckText(smallRoi, ["冒险之证"], "地脉移涌-冒险之证-r2"); }
        if (!bookHit) { log.info('[地脉移涌] 小范围失败，尝试大范围...'); bookHit = wipOcrCheckText(largeRoi, ["冒险之证"], "地脉移涌-冒险之证-large"); }
        if (!bookHit) { log.info('[地脉移涌] 大范围失败，重新打开ESC...'); try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {} keyPress("VK_ESCAPE"); await sleep(2000); bookHit = wipOcrCheckText(largeRoi, ["冒险之证"], "地脉移涌-冒险之证-esc"); }

        if (bookHit) {
            const s = genshin.scaleTo1080PRatio;
            const bookX = Math.round(bookHit.x / s + bookHit.width / s / 2);
            const bookY = Math.round(bookHit.y / s + bookHit.height / s / 2) - 50;
            log.info(`[地脉移涌] 点击冒险之证: (${bookX}, ${bookY})`);
            GameCaptureRegion.gameRegion1080PPosClick(bookX, bookY);
            await sleep(2500);
        } else {
            log.warn('[地脉移涌] 冒险之证识别失败，尝试F1快捷键');
            ocrSuccess = false;
            try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {}
            keyPress("VK_F1");
            await sleep(2000);
        }

        // 第三步：识别"讨伐"
        log.info("[地脉移涌] 第三步: 识别讨伐");
        const tSmall = [253, 505, 100, 76], tLarge = [214, 38, 127, 982];
        
        let targetHit = wipOcrCheckText(tSmall, ["讨伐"], "地脉移涌-讨伐");
        if (!targetHit) { log.info('[地脉移涌] 讨伐识别失败，重试1...'); await sleep(2500); targetHit = wipOcrCheckText(tSmall, ["讨伐"], "地脉移涌-讨伐-r1"); }
        if (!targetHit) { log.info('[地脉移涌] 讨伐识别失败，重试2...'); await sleep(2500); targetHit = wipOcrCheckText(tSmall, ["讨伐"], "地脉移涌-讨伐-r2"); }
        if (!targetHit) { log.info('[地脉移涌] 小范围失败，尝试大范围...'); targetHit = wipOcrCheckText(tLarge, ["讨伐"], "地脉移涌-讨伐-large"); }
        if (!targetHit) { log.info('[地脉移涌] 大范围失败，重试...'); await sleep(2500); targetHit = wipOcrCheckText(tLarge, ["讨伐"], "地脉移涌-讨伐-large2"); }

        if (targetHit) {
            const s = genshin.scaleTo1080PRatio;
            log.info(`[地脉移涌] 点击讨伐: (${Math.round(targetHit.x/s+targetHit.width/s/2)}, ${Math.round(targetHit.y/s+targetHit.height/s/2)})`);
            GameCaptureRegion.gameRegion1080PPosClick(Math.round(targetHit.x/s+targetHit.width/s/2), Math.round(targetHit.y/s+targetHit.height/s/2));
            await sleep(1500);
        } else {
            log.warn('[地脉移涌] 讨伐识别失败，点击默认位置');
            ocrSuccess = false;
            GameCaptureRegion.gameRegion1080PPosClick(303, 543);
            await sleep(1500);
        }

        // 第四步：识别"全部"并点击（展开列表）
        log.info("[地脉移涌] 第四步: 识别全部");
        const allSmall = [391, 175, 83, 59];
        
        let allHit = wipOcrCheckText(allSmall, ["全部"], "地脉移涌-全部");
        if (!allHit) { log.info('[地脉移涌] 全部识别失败，重试1...'); await sleep(1500); allHit = wipOcrCheckText(allSmall, ["全部"], "地脉移涌-全部-r1"); }
        if (!allHit) { log.info('[地脉移涌] 全部识别失败，重试2...'); await sleep(1500); allHit = wipOcrCheckText(allSmall, ["全部"], "地脉移涌-全部-r2"); }

        if (allHit) {
            const s = genshin.scaleTo1080PRatio;
            log.info(`[地脉移涌] 点击全部: (${Math.round(allHit.x/s+allHit.width/s/2)}, ${Math.round(allHit.y/s+allHit.height/s/2)})`);
            GameCaptureRegion.gameRegion1080PPosClick(Math.round(allHit.x/s+allHit.width/s/2), Math.round(allHit.y/s+allHit.height/s/2));
            await sleep(1500);
        } else {
            log.warn('[地脉移涌] 全部识别失败，点击默认位置');
            ocrSuccess = false;
            GameCaptureRegion.gameRegion1080PPosClick(433, 205);
            await sleep(1500);
        }

        // 第五步：识别"其他"并点击
        log.info("[地脉移涌] 第五步: 识别其他");
        const otherSmall = [388, 455, 86, 61], otherLarge = [382, 238, 343, 268];
        
        let otherHit = wipOcrCheckText(otherSmall, ["其他"], "地脉移涌-其他");
        if (!otherHit) { log.info('[地脉移涌] 其他识别失败，重试1...'); await sleep(1500); otherHit = wipOcrCheckText(otherSmall, ["其他"], "地脉移涌-其他-r1"); }
        if (!otherHit) { log.info('[地脉移涌] 小范围失败，尝试大范围...'); otherHit = wipOcrCheckText(otherLarge, ["其他"], "地脉移涌-其他-large"); }
        if (!otherHit) { log.info('[地脉移涌] 大范围失败，重试...'); await sleep(1500); otherHit = wipOcrCheckText(otherLarge, ["其他"], "地脉移涌-其他-large2"); }

        if (otherHit) {
            const s = genshin.scaleTo1080PRatio;
            log.info(`[地脉移涌] 点击其他: (${Math.round(otherHit.x/s+otherHit.width/s/2)}, ${Math.round(otherHit.y/s+otherHit.height/s/2)})`);
            GameCaptureRegion.gameRegion1080PPosClick(Math.round(otherHit.x/s+otherHit.width/s/2), Math.round(otherHit.y/s+otherHit.height/s/2));
            await sleep(1500);
        } else {
            log.warn('[地脉移涌] 其他识别失败，点击默认位置');
            ocrSuccess = false;
            GameCaptureRegion.gameRegion1080PPosClick(431, 486);
            await sleep(1500);
        }

        // 第六步：识别"两倍产出"
        // 这里没使用图片进行比对，筛选其他后会默认选中藏金花，反正双倍都是两个一起双倍的，偷个懒直接识别，如果因为板更失效，把这一个缺失的图片识别补上应该就可以了
        log.info("[地脉移涌] 第六步: 识别两倍产出");
        const doubleLarge = [1041, 496, 170, 37];
        
        let doubleHit = wipOcrCheckText(doubleLarge, ["2倍", "两倍", "双倍"], "地脉移涌-两倍产出");
        if (!doubleHit) { log.info('[地脉移涌] 两倍产出识别失败，重试1...'); await sleep(1500); doubleHit = wipOcrCheckText(doubleLarge, ["2倍", "两倍", "双倍"], "地脉移涌-两倍产出-r1"); }

        // 最终结果输出（使用持久化通知）
        let hasSurge = false;
        if (ocrSuccess) {
            if (doubleHit) {
                notification.Send("识别到两倍产出");
                hasSurge = true;
            } else {
                notification.Send("未识别到两倍产出");
            }
        } else {
            notification.Send("错误：OCR失败，两倍产出状态未知");
        }

        try { await genshin.returnMainUi(); } catch(e) { log.warn(`[地脉移涌] 还原主界面失败: ${e.message}`); }
        await sleep(500);

        return hasSurge;

    } catch (ex) {
        log.warn(`[地脉移涌] 检测异常: ${ex.message}`);
        notification.Send("错误：OCR失败，两倍产出状态未知");
        try { await genshin.returnMainUi(); } catch(e2) { log.warn(`[地脉移涌] 异常后还原主界面失败: ${e2.message}`); }
        await sleep(500);
        return false;
    }
}

(async function () {
    try {
        log.info("========== 自动地脉花脚本启动 ==========");

        // 1. 加载设置（BetterGI 会自动处理 settings.json 中的 default 值）
        const timesValue = parseInt(settings.timesValue);
        let country = settings.country;
        const leyLineOutcropType = settings.leyLineOutcropType;
        const isResinExhaustionMode = settings.isResinExhaustionMode;
        const openModeCountMin = settings.openModeCountMin;
        // 注意：API 的 useAdventurerHandbook 逻辑是反的，需要反转
        const useAdventurerHandbook = !settings.useAdventurerHandbook;
        const team = settings.team;
        const friendshipTeam = settings.friendshipTeam;
        const timeout = parseInt(settings.timeout);
        const isGoToSynthesizer = settings.isGoToSynthesizer;
        const useFragileResin = settings.useFragileResin;
        const useTransientResin = settings.useTransientResin;
        const isNotification = settings.isNotification;
        const onlySurgeMode = settings.onlySurgeMode;

        // 处理至冬地区：将"至冬（暂未更新）"转换为"至冬"
        if (country === "至冬（暂未更新）") {
            country = "至冬";
        }

        // 2. 输出精简配置信息
        log.info("国家地区：{country}", country);
        
        if (isResinExhaustionMode) {
            log.info("树脂耗尽模式已开启");
        }

        // 构建树脂使用信息
        let resinInfo = "使用体力";
        if (useFragileResin) resinInfo += "+脆弱树脂";
        if (useTransientResin) resinInfo += "+须臾树脂";
        resinInfo += `刷取${timesValue}次${leyLineOutcropType}`;
        log.info(resinInfo);

        // 3. 如果开启"仅有双倍时刷取地脉花"，先检测双倍
        if (onlySurgeMode) {
            log.info("开启仅有双倍时刷取模式，开始检测地脉移涌...");
            const hasSurge = await detectLeyLineSurgeFlow();
            
            if (!hasSurge) {
                log.info("未检测到双倍产出，脚本退出");
                return;
            }
            
            log.info("检测到双倍产出，继续执行地脉花任务...");
        }

        // 4. 创建地脉花任务参数
        const param = new AutoLeyLineOutcropParam(timesValue, country, leyLineOutcropType);
        
        // 5. 设置可选参数
        param.isResinExhaustionMode = isResinExhaustionMode;
        param.openModeCountMin = openModeCountMin;
        param.useAdventurerHandbook = useAdventurerHandbook;
        param.team = team;
        param.friendshipTeam = friendshipTeam;
        param.timeout = timeout;
        param.isGoToSynthesizer = isGoToSynthesizer;
        param.useFragileResin = useFragileResin;
        param.useTransientResin = useTransientResin;
        param.isNotification = isNotification;

        // 6. 执行地脉花任务
        log.info("开始执行地脉花任务...");
        await dispatcher.runAutoLeyLineOutcropTask(param);

        log.info("========== 自动地脉花脚本完成 ==========");
    } catch (error) {
        log.error("脚本执行出错: {error}", error.message);
        if (settings.isNotification) {
            notification.Error(`自动地脉花脚本出错: ${error.message}`);
        }
    }
})();