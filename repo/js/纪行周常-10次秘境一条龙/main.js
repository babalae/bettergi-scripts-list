(async function () {
    // 1. 基础设置
    setGameMetrics(1920, 1080, 1);
    
    // 定义全局变量以便在 finally 中释放
    let mats = {}; 
    let fightOcrRo = null; // 用于战斗判断的OCR对象

    try {
        // --- 资源加载阶段 ---
        log.info("正在加载图片资源...");
        
        mats = {
            enter: file.readImageMatSync("assets/images/华池岩岫.png"),
            solo: file.readImageMatSync("assets/images/单人挑战.png"),
            start: file.readImageMatSync("assets/images/开始挑战.png"),
            leyline: file.readImageMatSync("assets/images/地脉异常.png"),
            activate: file.readImageMatSync("assets/images/启动.png")
        };

        // 模版匹配对象
        const ro = {
            enter: RecognitionObject.TemplateMatch(mats.enter),
            solo: RecognitionObject.TemplateMatch(mats.solo),
            start: RecognitionObject.TemplateMatch(mats.start),
            leyline: RecognitionObject.TemplateMatch(mats.leyline),
            activate: RecognitionObject.TemplateMatch(mats.activate)
        };

        // 识别全屏范围
        fightOcrRo = RecognitionObject.ocr(0, 0, 1920, 1080);

        log.info("资源加载完成");

        // 2. 准备工作
        await genshin.returnMainUi();
        if (settings.partyName) {
            await genshin.switchParty(settings.partyName);
        }

        // 3. 循环逻辑
        const maxAttempts = settings.loopTimes || 10;
        let successCount = 0;

        for (let i = 0; i < maxAttempts; i++) {
            log.info(`=== 开始第 ${i + 1}/${maxAttempts} 次循环 ===`);

            // a. 传送
            await genshin.tp("1436.2861328125", "1289.95556640625");
            await sleep(2500);

            // b. 寻找秘境入口
            log.info("寻找秘境入口...");
            keyDown("w");
            const foundEnter = await waitFindTemplate(ro.enter, 3000); 
            keyUp("w");

            if (!foundEnter) {
                log.warn("未找到秘境入口，重置位置");
                await genshin.returnMainUi();
                continue;
            }

            log.info("找到入口");
            keyPress("f");
            await sleep(1500);

            // c. 点击单人挑战
            if (!await waitAndClickTemplate(ro.solo, 5000)) {
                log.error("未找到'单人挑战'，重试");
                continue;
            }
            await sleep(1000);

            // d. 点击开始挑战
            if (!await waitAndClickTemplate(ro.start, 5000)) {
                log.error("未找到'开始挑战'");
                continue;
            }
            log.info("进入加载...");
            await sleep(5000); // 强制等待读条开始

            // e. 确认进入副本并点击 (检测地脉异常)
            // 123.js 原逻辑是找到就点，这里保持一致，作为判断进本的依据
            if (await waitAndClickTemplate(ro.leyline, 120000)) {
                log.info("已确认进入副本");
                await sleep(1500);
            } else {
                log.error("进入副本超时");
                break;
            }

            // f. 走向钥匙并启动
            log.info("走向启动钥匙...");
            keyDown("w");
            const foundActivate = await waitFindTemplate(ro.activate, 10000);
            keyUp("w");

            if (foundActivate) {
                log.info("找到启动，开始战斗");
                keyPress("f");
                await sleep(1000);

                // g. === 自动战斗 ===
                // 使用 SoloTask("AutoFight") + CancellationToken + 循环OCR检测
                const fightResult = await autoFightLike123js(fightOcrRo, 120000); 
                
                if (fightResult) {
                    successCount++;
                    log.info(`战斗成功！当前完成 ${successCount} 次`);
                    await sleep(2000);
                } else {
                    log.error("战斗失败，终止脚本");
                    break;
                }
                
            } else {
                log.error("未找到启动钥匙");
            }
        }
        
        await genshin.tp("1436.2861328125", "1289.95556640625");
        log.info(`脚本结束。成功完成 ${successCount}/${maxAttempts} 次挑战`);

    } catch (e) {
        log.error("脚本运行出错: " + e.message);
    } finally {
        // --- 资源释放 (保持内存安全) ---
        for (let key in mats) {
            if (mats[key]) mats[key].Dispose();
        }
        if (fightOcrRo && fightOcrRo.Dispose) {
            fightOcrRo.Dispose();
        }
        log.info("资源已释放");
    }

    // ================= 辅助函数 =================

    /**
     * 1. 启动 AutoFight 任务
     * 2. 循环截图 OCR
     * 3. 识别关键字 ["挑战成功", "达成", "挑战达成"]
     * 4. 识别成功后取消任务
     */
    async function autoFightLike123js(ocrRo, timeout) {
        const cts = new CancellationTokenSource();
        // 启动后台战斗任务
        dispatcher.runTask(new SoloTask("AutoFight"), cts);

        const startTime = Date.now();
        let fightResult = false;
        
        log.info("战斗开始");

        while (Date.now() - startTime < timeout) {
            // 获取截图 (注意：这里增加了Dispose以防止内存溢出)
            let capture = captureGameRegion();
            try {
                // 使用传入的 ocrRo 进行查找
                let result = capture.find(ocrRo);
                let text = result.text;
                
                // 判断关键字
                const keywords = ["挑战成功", "达成", "挑战达成"];
                let found = false;
                
                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    fightResult = true;
                    break;
                }
            } catch (err) {
                log.error(`OCR识别出错: ${err}`);
            } finally {
                capture.Dispose();
            }
            
            await sleep(1000);
        }

        // 停止战斗
        cts.cancel();
        return fightResult;
    }

    // 模版点击辅助函数 (内存安全版)
    async function waitAndClickTemplate(ro, timeoutMs) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            let capture = captureGameRegion();
            try {
                let res = capture.find(ro);
                if (!res.isEmpty()) {
                    res.click();
                    await sleep(30); 
                    res.click(); 
                    return true;
                }
            } finally {
                capture.Dispose();
            }
            await sleep(1000);
        }
        return false;
    }

    // 模版查找辅助函数 (内存安全版)
    async function waitFindTemplate(ro, timeoutMs, intervalMs = 200) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            let capture = captureGameRegion();
            try {
                let res = capture.find(ro);
                if (!res.isEmpty()) return true;
            } finally {
                capture.Dispose();
            }
            await sleep(intervalMs);
        }
        return false;
    }


})();
