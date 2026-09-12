
const pick = settings.liam_pick_dogfood || "节约时间，不拿了";

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
        const CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Recognition/DENG.png"));
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
     * 3. 主流程（射击 → 下落 → 摩拉校验）
     * ------------------------------------------------------ */
    executeMainProcess: async function () {
        log.info('[Core] >>>>>> 核心主流程启动 >>>>>>');
        try {
            eval(file.readTextSync("lib/Laim/lib/MobPuller.js"));
            eval(file.readTextSync("lib/Laim/lib/MobFallAttack.js"));
            await this.recognizeOnePopup();
            await this.Run01();
            const moraBefore = await this.mora();
            log.info(`[Core] 开始前摩拉: ${moraBefore}`);

            const shootOK = await MobPuller.executeMainProcess();
            if (!shootOK) return false;
            await sleep(5200);
            await this.recognizeOnePopup();

            const fallOK = await MobFallAttack.executeMainProcess();
            if (!fallOK) return false;

            await sleep(10000);
            await this.recognizeOnePopup();
            const moraAfter = await this.mora();
            const delta = moraAfter - moraBefore;
            log.info(`[Core] 摩拉增长: ${delta}`);
            if ((delta >= 2000) && pick === "我全都要！") {
                await MobFallAttack.pickUp();
            }
            await genshin.tpToStatueOfTheSeven();
            await this.recognizeOnePopup();
            return delta >= 2000;
        } catch (err) {
            log.error(`[Core] 主流程异常: ${err.message}`);
            throw err;
        }
    },

    /**
     * 识别并处理多人复活
     */
    recognizeOnePopup: async function () {
        /* ---------- 1. 拼路径 ---------- */
        const iconFiles = `assets/ui/a.png`;
        const tplMat = RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconFiles), 0, 0, 1920, 1080);

        const joinResult = captureGameRegion().find(tplMat);
        if (joinResult.isExist()) {
            joinResult.click();
            await sleep(6666);
        }
    }
};