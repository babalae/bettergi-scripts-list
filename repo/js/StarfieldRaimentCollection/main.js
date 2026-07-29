(async function () {
    const guidList = (settings.g_uid).split(",");
    let uidSwitch = true;
    const downRolls = "{ \"macroEvents\": [ { \"type\": 6, \"mouseX\": 0, \"mouseY\": -120, \"time\": 0 }, { \"type\": 6, \"mouseX\": 0, \"mouseY\": 0, \"time\": 5 } ], \"info\": { \"name\": \"\", \"description\": \"\", \"x\": 0, \"y\": 0, \"width\": 1920, \"height\": 1080, \"recordDpi\": 1 } }"
    const f_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F.png"), 1094, 334, 50, 426);
    /**
     * 简洁易用的OCR函数
     * @param x
     * @param y
     * @param w
     * @param h
     * @param multi 是否使用FindMulti
     * @returns {Promise<void>} 返回对应的OCR对象
     */
    async function Ocr(x, y, w, h, multi = false) {
        let OcrRo = RecognitionObject.Ocr(x, y, w, h);
        let gameRegion = captureGameRegion();
        if (multi) {
            let ocrResult = gameRegion.FindMulti(OcrRo);
            gameRegion.dispose();
            if (ocrResult.count !== 0) {
                let resultList = [];
                for (let i = 0; i < ocrResult.count; i++) {
                    resultList.push(ocrResult[i]);
                }
                return resultList;
            } else {
                log.debug(`FindMulti为空: (${x}, ${y}, ${w}, ${h})`);
                return false;
            }
        } else {
            let ocrResult = gameRegion.Find(OcrRo);
            gameRegion.dispose();
            if (ocrResult.isExist()) {
                return ocrResult;
            } else {
                log.debug(`Find为空: (${x}, ${y}, ${w}, ${h})`);
                return false;
            }
        }
    }

    /**
     * 判断当前界面
     * @returns {Promise<string>}
     */
    async function get_current_ui() {
        let capture = captureGameRegion();
        const search_page_ocr = await Ocr(126, 26, 133, 46);
        const stage_enter_ocr = await Ocr(1600, 994, 207, 50);
        const result_page_ocr = await Ocr(1309, 997, 151, 43);
        const page_close_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/close_btn.png"), 1690, 103, 55, 55);
        const base_close_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/close_btn.png"), 1803, 7, 80, 80);
        const exit_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Exit.png"), 23, 11, 69, 69);
        const mainUI_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/mainUI.png"), 19, 7, 93, 93);
        const page_close = capture.Find(page_close_pic).isExist();
        const base_close = capture.Find(base_close_pic).isExist();
        const exit = capture.Find(exit_pic).isExist();
        const mainUI = capture.Find(mainUI_pic).isExist();
        const search_page = search_page_ocr && search_page_ocr.text.includes("搜索奇域");
        const stage_enter = stage_enter_ocr && stage_enter_ocr.text.includes("开始挑战");
        const result_page = result_page_ocr && result_page_ocr.text.includes("返回大厅");
        let current_ui = "未知界面";

        if (page_close) { // 奇域界面
            current_ui = "奇域界面"
        } else if (mainUI) { // 主界面
            current_ui = "主界面";
        } else if (search_page) { // 奇域搜索界面
            current_ui = "奇域搜索界面";
        } else if (base_close) { // 奇域浏览界面
            current_ui = "奇域浏览界面";
        } else if (stage_enter) { // 奇域：配队界面
            current_ui = "奇域：配队界面";
        } else if (exit) { // 奇域：游玩界面
            current_ui = "奇域：游玩界面";
        } else if (result_page) { // 结算界面
            current_ui = "结算界面";
        }

        capture.dispose();
        return current_ui;
    }

    /**
     * 判断当前处于提瓦特还是千星奇域
     * @param re_tev 是否返回提瓦特
     * @returns {Promise<string>}
     */
    async function check_world(re_tev = false) {
        if (re_tev) {
            log.info("正在返回提瓦特...");
        }
        await genshin.returnMainUi();
        await sleep(500);
        keyPress("Escape");
        await sleep(1000);
        let ocrResult_btn = await Ocr(1663, 997, 168, 47);
        if (ocrResult_btn && ocrResult_btn.text.includes("提瓦特")) {
            if (re_tev) {
                ocrResult_btn.Click();
                await sleep(500);
                click(1168, 756);
            } else {
                keyPress("Escape");
            }
            await sleep(500);
            return "千星奇域";
        } else {
            keyPress("Escape");
            await sleep(500);
            return "提瓦特";
        }
    }

    /**
     * 检查是否完成绮衣珍赏任务
     * @returns {Promise<string>} 若已完成则返回"true",否则"false",识别错误"error"
     */
    async function check_state() {
        const finish_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Finish.png"), 1552, 352, 94, 94);
        const active0_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/active0.png"), 1552, 352, 94, 94);
        const active1_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/active1.png"), 1552, 352, 94, 94);
        const target_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/targetIcon.png"), 708, 1, 512, 86);
        finish_pic.threshold = 0.8;
        active0_pic.threshold = 0.8;
        active1_pic.threshold = 0.8;
        target_pic.threshold = 0.8;
        let capture;

        await check_world(false);
        await genshin.returnMainUi();
        await sleep(500);

        keyPress("F6");
        await sleep(1500);
        capture = captureGameRegion();
        await sleep(500);
        const targetIcon = capture.Find(target_pic);
        // 检查任务完成情况
        if (targetIcon.isExist()) {
            targetIcon.Click();
        } else {
            log.error(`未找到 绮衣珍赏 活动`);
            if (settings.notification_1) {
                notification.send("未找到 绮衣珍赏 活动");
            }
            return "error";
        }
        await sleep(1500);

        capture = captureGameRegion();
        if (capture.Find(finish_pic).isExist()) { // 已领取
            capture.dispose();
            log.info(`当日绮衣珍赏奖励状态：已领取`);
            if (settings.notification_1) {
                notification.send("当日绮衣珍赏奖励状态：已领取");
            }
            return "true";
        } else if (capture.Find(active0_pic).isExist()) { // 未完成
            capture.dispose();
            log.info(`当日绮衣珍赏奖励状态：未完成`);
            if (settings.notification_1) {
                notification.send("当日绮衣珍赏奖励状态：未完成");
            }
            return "false";
        } else if (capture.Find(active1_pic).isExist()) { // 待领取
            capture.dispose();
            log.info(`当日绮衣珍赏奖励状态：待领取`);
            click(1598, 398);
            await sleep(500);
            click(1869, 623);
            await sleep(500);
            if (settings.notification_1) {
                notification.send("当日绮衣珍赏奖励状态：已领取");
            }
            return "true";
        } else {
            capture.dispose();
            const ocrResult = await Ocr(954, 334, 147, 33);
            if (ocrResult && ocrResult.text.includes("已完成所有任务")) {
                log.info(`当日绮衣珍赏奖励状态：已领取`);
                if (settings.notification_1) {
                    notification.send("当日绮衣珍赏奖励状态：已领取");
                }
                return "true";
            } else {
                log.error(`当日绮衣珍赏奖励状态：未识别`);
                if (settings.notification_1) {
                    notification.send("当日绮衣珍赏奖励状态：未识别");
                }
                return "error";
            }
        }
    }

    /**
     * 查找并奇域
     * @returns {Promise<boolean>} false 从千星进入 true 从提瓦特进入（奇域界面需要再次点击进入）
     */
    async function enter_stage() {
        // 回到主界面
        await genshin.returnMainUi();
        await sleep(500);

        // 进入奇域选择界面
        keyPress("F6");
        await sleep(1500);

        // 查找关卡
        click(1703, 48);
        await sleep(1500);
        click(1088, 143);
        await sleep(1000);
        if (uidSwitch) {
            inputText(`${guidList[0]}`);
            uidSwitch = false;
        } else {
            inputText(`${guidList[1]}`);
            uidSwitch = true;
        }
        await sleep(1000);
        keyPress("RETURN");
        await sleep(1000);
        // 点开奇域界面
        click(413, 396);
        await sleep(2000);
        // 进入奇域
        const ocrResult = await Ocr(1110, 889, 637, 91, true);
        if (ocrResult) {
            for (let i = 0; i < ocrResult.length; i++) {
                if (ocrResult[i].text.includes("开始游戏") || ocrResult[i].text.includes("单人挑战")) {
                    ocrResult[i].Click();
                    await sleep(5000);
                    return false;
                } else if (ocrResult[i].text.includes("前往大厅")) {
                    ocrResult[i].Click();
                    await sleep(5000);
                    return true;
                }
            }
        }

        click(1233, 935);
        await sleep(500);
        click(1590, 934);
        await sleep(5000);
        return false;
    }

    async function main() {
        if (!settings.EULA) {
            log.error("请阅读README后在JS脚本配置启用脚本");
            return null;
        }

        let extra_count = false;
        if (settings.extra_count !== "0") {
            extra_count = Number(settings.extra_count);
        }

        // 进入奇域并检查完成状态
        let state_result = await check_state();
        if (state_result === "true" && settings.extra_count === "0") {
            log.info("已完成...");
            await check_world(true);
            return null;
        } else if (state_result === "error") {
            await check_world(true);
            return null;
        }

        let enter_flag = false;

        while (true) {

            let current_ui = await get_current_ui();
            log.info(`当前界面：${current_ui}`);

            switch (current_ui) {
                case "未知界面":
                    click(973, 545); // 点击屏幕中间（防止月卡卡死）
                    await sleep(1000);
                    break;
                case "主界面":
                    if (state_result === "false") {
                        enter_flag = await enter_stage();
                    } else if (state_result === "error") {
                        break;
                    } else if (extra_count) {
                        log.info(`额外刷取剩余 ${extra_count} 次...`)
                        enter_flag = await enter_stage();
                    } else if (!extra_count) {
                        break;
                    }
                    break;
                case "奇域界面":
                    if (enter_flag) {
                        click(1233, 935);
                        await sleep(500);
                        click(1590, 934);
                        await sleep(5000);
                        enter_flag = false;
                        break;
                    }
                    if (extra_count) {
                        log.info(`额外刷取剩余 ${extra_count} 次...`)
                        click(1233, 935);
                        await sleep(500);
                        click(1590, 934);
                        await sleep(5000);
                        break;
                    }
                    await genshin.returnMainUi();
                    break;
                case "奇域搜索界面":
                    await genshin.returnMainUi();
                    break;
                case "奇域浏览界面":
                    await genshin.returnMainUi();
                    break;
                case "奇域：配队界面":
                    let c1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/c1.png"), 134, 93, 46, 51);
                    let filterRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/filterIcon.png"), 20, 16, 70, 70);
                    click(1695, 1021);
                    await sleep(3000);
                    let capture = captureGameRegion();
                    if (capture.Find(filterRo).isExist()) {
                        capture.dispose();
                        await sleep(500);
                        while (true) {
                            await sleep(500);
                            capture = captureGameRegion();
                            if (capture.Find(filterRo).isExist() && capture.Find(c1Ro).isExist()) {
                                capture.dispose();
                                break;
                            } else {
                                click(99, 183);
                            }
                            capture.dispose();
                        }
                        let ocrResult = await Ocr(352, 997, 146, 46);
                        if (ocrResult && ocrResult.text.includes("保存配置")) {
                            ocrResult.Click();
                        }
                        await sleep(500);
                        click(1695, 1021);
                        await sleep(500);
                        click(1695, 1021);
                        await sleep(5000);
                    }
                    break;
                case "奇域：游玩界面":
                    log.info("开始等待...")
                    if (uidSwitch) {
                        await sleep(41000); // 等待40s
                        keyDown("D");
                        await sleep(700);
                        keyUp("D");
                        for (let i = 0; i < 5; i++) {
                            await sleep(100);
                            const capture = captureGameRegion();
                            if (capture.Find(f_pic).isExist()) {
                                keyPress("F");
                                capture.dispose();
                                break;
                            }
                            capture.dispose();
                        }
                    } else {
                        await sleep(61000); // 等待60s
                        keyPress("Escape");
                        await sleep(1000);
                        click(978, 601);
                        await sleep(1000);
                    }
                    break;
                case "结算界面":
                    if (state_result === "true") {
                        extra_count--;
                    }
                    // click(1378, 1018);  // 返回大厅
                    click(1729, 1025);  // 返回奇域界面
                    await sleep(3000);
                    if (state_result !== "true") {
                        state_result = await check_state();
                    }
                    break;
            }

            if (state_result === "true" && extra_count <= 0) {
                break;
            }

            await sleep(500);
        }

        log.info(`正在返回提瓦特`);
        await check_world(true);
    }

    await main();
})();