
eval(file.readTextSync("lib/Online/Multiplayer.js"));
eval(file.readTextSync("lib/chat/ChatClick.js"));

var core = {

    /* ------------------------------------------------------
     * 1. 前置准备（模板、别名、分辨率等）
     * ------------------------------------------------------ */
    Run01: async function () {
        log.info('[Core] 开始执行前准备');
        log.info('[Core] 模板加载完成');
                await genshin.tpToStatueOfTheSeven();
        // TODO: 吃药、换队、Buff 等
        log.info('[Core] 前准备完成');
    },

    /* ------------------------------------------------------
     * 2. 识别摩拉（依赖三个工具函数）
     * ------------------------------------------------------ */
    mora: async function () {
        const CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Firefly/Recognition/Friends Button.png"));
        let result = 0, tryTimes = 0;
        while (result === 0 && tryTimes < 3) {
            await genshin.returnMainUi();
            log.info('[Core] 开始识别摩拉');
            keyPress('C');
            await sleep(1500);

            let recognized = false, startTime = Date.now();
            while (Date.now() - startTime < 5000) {
                /* ---- 角色菜单图标 ---- */
                const charRes = await this.recognizeImage(CharacterMenuRo, 5000);
                if (charRes.success) {
                    await click(177, 433);
                    await sleep(500);
                    recognized = true;
                    break;
                }
                /* ---- 天赋文字 ---- */
                const talentRes = await this.recognizeTextAndClick('天赋', { x: 133, y: 395, width: 115, height: 70 });
                if (talentRes.success) {
                    log.info(`[Core] 点击天赋文字 @ ${talentRes.x}, ${talentRes.y}`);
                    recognized = true;
                    break;
                }
                await sleep(1000);
            }

            if (recognized) {
                const moraText = await this.recognizeTextInRegion({ x: 1620, y: 25, width: 152, height: 46 });
                if (moraText) {
                    log.info(`[Core] 识别到摩拉: ${moraText}`);
                    result = Number(moraText) || 0;
                }
            }
            tryTimes++;
            await genshin.returnMainUi();
            await sleep(500);
        }
        return result;
    },


    recognizeImage: async function (recognitionObject, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const r = captureGameRegion().find(recognitionObject);
                if (r) return { success: true, x: r.x, y: r.y };
            } catch (e) { log.error(`[Core] 识别图像异常: ${e.message}`); }
            await sleep(500);
        }
        log.warn('[Core] 识别图像超时');
        return { success: false };
    },

    recognizeTextAndClick: async function (targetText, ocrRegion, timeout = 3000) {
        const start = Date.now();
        let retry = 0;
        while (Date.now() - start < timeout) {
            try {
                const list = captureGameRegion()
                    .findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
                for (const res of list) {
                    if (res.text.includes(targetText)) {
                        const cx = Math.round(res.x + res.width / 2);
                        const cy = Math.round(res.y + res.height / 2);
                        await click(cx, cy);
                        await sleep(500);
                        return { success: true, x: cx, y: cy };
                    }
                }
            } catch (e) {
                retry++;
                log.warn(`[Core] 文字识别失败，第${retry}次重试...`);
            }
            await sleep(1000);
        }
        /* 超时点默认中心 */
        const cx = Math.round(ocrRegion.x + ocrRegion.width / 2);
        const cy = Math.round(ocrRegion.y + ocrRegion.height / 2);
        await click(cx, cy);
        await sleep(1000);
        return { success: false };
    },

    recognizeTextInRegion: async function (ocrRegion, timeout = 5000) {
        const start = Date.now();
        let retry = 0;
        while (Date.now() - start < timeout) {
            try {
                const ocrResult = captureGameRegion()
                    .find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
                if (ocrResult) return ocrResult.text;
            } catch (e) {
                retry++;
                log.warn(`[Core] OCR 识别失败，第${retry}次重试...`);
            }
            await sleep(500);
        }
        log.warn('[Core] 指定区域未识别到文字');
        return null;
    },

    /* ------------------------------------------------------
     * 3. 主流程（路线 → 对话 → 摩拉校验） 平均耗时: 8分钟10秒
     * ------------------------------------------------------ */
    executeMainProcess: async function () {
        log.info('[Core] >>>>>> 核心主流程启动 >>>>>>');
        try {
            eval(file.readTextSync("lib/Firefly/lib/CharacterRotator.js"));
            // await this.Run01();
            const moraBefore = await this.mora();
            log.info(`[Core] 飞萤开始前摩拉: ${moraBefore}`);

            await genshin.tp(978.70, -353.56);

            keyDown(`S`);
            await sleep(2200);
            keyUp(`S`);
            await sleep(2300);
            await CharacterRotator.swapArcherShield();
            await ChatClick.run(true);        // 说话！！！

            await this.pathingfiy('2501璃月遁玉陵_5');
            await this.recognizeOnePopup();

            await ChatClick.run();

            await this.pathingfiy('B05璃月琼玑野归离原_2');
            // await this.pathingfiy('2304璃月琼玑野渌华池_2');
            await this.recognizeOnePopup();

            await genshin.tp(-254.77, 630.39);
            await ChatClick.run();
            await sleep(3300);
            await this.pathingfiy('2402璃月云來海孤云阁_3');
            await this.recognizeOnePopup();

            await genshin.tp(-254.77, 630.39);
            await ChatClick.run();
            await sleep(3300);
            await this.pathingfiy('2201璃月明蕴镇西北_3');
            await this.recognizeOnePopup();

            await genshin.tp(-3232.95, -3533.84);
            await ChatClick.run();
            keyDown(`S`);
            await sleep(1500);
            keyUp(`S`);
            await sleep(3300);
            await this.pathingfiy('3210稻妻公义飞萤_6');
            await this.recognizeOnePopup();

            await genshin.tpToStatueOfTheSeven(); // 可以到近的神像！待定
            await ChatClick.run();

            const moraAfter = await this.mora();
            const delta = moraAfter - moraBefore;
            log.info(`[Core] 摩拉增长: ${delta}`);

            if (delta <= 1600) { // 补一条
                log.info(`[Core] 摩拉增长: ${delta},,多打一点点吧！`);
                await this.pathingfiy('2101璃月无妄坡西南_5');
                await this.recognizeOnePopup();
                await genshin.tpToStatueOfTheSeven();
                await ChatClick.run();
            }

            const moraAfter1 = await this.mora();
            const delta1 = moraAfter1 - moraBefore;
            log.info(`[Core] 摩拉增长: ${delta1}，结束`);
            await genshin.tpToStatueOfTheSeven();
            return delta1 >= 1;
        } catch (err) {
            log.error(`[Core] 主流程异常: ${err.message}`);
            throw err;
        }
    },


        /**
     * 根据地点名称执行预设的路线脚本（跑图路线）
     * @param {string} locationName - 地点名称（不含扩展名）
     * @returns {Promise<void>}
     */
    pathingfiy: async function(locationName) {
        log.info('[MobPuller] 前往路线: {name}', locationName);
        const filePath = `lib/Firefly/pathing/0_飞萤/${locationName}.json`;
        await pathingScript.RunFile(filePath);
    },
 
/**
 * 识别并处理多人复活
 */
recognizeOnePopup: async function() {
        /* ---------- 1. 拼路径 ---------- */
    // const root    = `assets/imageClick/${popupName}`;
    // const iconDir = `${root}/icon`;

    // const iconFiles = `/${iconDir}/a.png`;
    const iconFiles = `lib/Firefly/assets/a.png`;

    const tplMat = RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconFiles), 0, 0, 1920, 1080);
    
            const joinResult = captureGameRegion().find(tplMat);
            if (joinResult.isExist()) {
                joinResult.click();
                    await sleep(6666);
}
}
};