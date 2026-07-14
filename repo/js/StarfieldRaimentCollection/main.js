(async function () { // activate0图片缺失，后续需补全1920x1080状态下图片
    const downRolls = "{ \"macroEvents\": [ { \"type\": 6, \"mouseX\": 0, \"mouseY\": -120, \"time\": 0 }, { \"type\": 6, \"mouseX\": 0, \"mouseY\": 0, \"time\": 5 } ], \"info\": { \"name\": \"\", \"description\": \"\", \"x\": 0, \"y\": 0, \"width\": 1920, \"height\": 1080, \"recordDpi\": 1 } }"

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
        let ocrResult_top = await Ocr(825, 17, 259, 85);
        let ocrResult_result = await Ocr(459, 290, 284, 91);
        const close_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/close_btn.png"), 1659, 82, 119, 105);
        // log.info(`${ocrResult_top.text}`);
        if (ocrResult_top && ocrResult_top.text.includes("能力")) {
            return "能力";
        } else if (ocrResult_top && ocrResult_top.text.includes("关")) {
            let current_room_num = Number(ocrResult_top.text.match(/\d+/));
            if (current_room_num % 5 === 4 || current_room_num % 5 === 0) {
                return "奖励";
            } else {
                return "挑战";
            }
        } else if (ocrResult_top && ocrResult_top.text.includes("弓箭传说")) {
            return "结算界面";
        } else if (captureGameRegion().Find(close_pic).isExist()) {
            return "奇域界面";
        } else {
            const exit_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Exit.png"), 23, 11, 69, 69);
            if (captureGameRegion().Find(exit_pic).isExist() && !(ocrResult_result && ocrResult_result.text.includes("挑战"))) {
                return "主界面";
            } else {
                return "未知界面";
            }
        }
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
     * 进入奇域，并检查是否完成绮衣珍赏任务
     * @returns {Promise<boolean>} 若已完成则返回true,否则false
     */
    async function enter_stage_check_state() {
        const finish_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Finish.png"), 1552, 352, 94, 94);
        // const active0_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/active0.png"), 1552, 352, 94, 94);
        const active1_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/active1.png"), 1552, 352, 94, 94);
        finish_pic.threshold = 0.8;
        // active0_pic.threshold = 0.8;
        active1_pic.threshold = 0.8;

        await check_world(false);
        await genshin.returnMainUi();
        await sleep(500);

        keyPress("F6");
        await sleep(1500);
        // 检查任务完成情况
        click(1051, 48);
        await sleep(1500);
        let capture = captureGameRegion();
        if (capture.Find(finish_pic).isExist()) { // 已领取
            capture.dispose();
            log.info(`当日绮衣珍赏奖励状态：已领取`);
            return false;
        }
        // else if (capture.Find(active0_pic).isExist()) { // 未完成
        //     capture.dispose();
        //     log.info(`当日绮衣珍赏奖励状态：未完成`);
        // }
        else if (capture.Find(active1_pic).isExist()) { // 待领取
            capture.dispose();
            log.info(`当日绮衣珍赏奖励状态：待领取`);
            click(1598, 398);
            await sleep(500);
            click(1869, 623);
            await sleep(500);
            return false;
        } else {
            capture.dispose();
            log.info(`当日绮衣珍赏奖励状态：未完成`);
        }

        // 查找关卡
        click(1703, 48);
        await sleep(1500);
        click(1088, 143);
        await sleep(600);
        inputText(`${settings.g_uid}`);
        await sleep(800);
        keyPress("RETURN");
        await sleep(1000);
        // 点开奇域界面
        click(413, 396);
        await sleep(1000);

        return true;
    }

    /**
     * 自动选择能力
     * @returns {Promise<void>}
     */
    async function choose_skill() {
        let skill_list = [
            "穿心箭", "斜向箭", "受击无敌", "嗜血", "边跑边射",
            "雷元素箭",
            "水精灵", "雷精灵", "冰精灵", "火精灵", "旋风", "陨石",
            "猛弓", "聪明", "移速提升", "愤怒",
            "冰回旋镖", "火回旋镖", "水回旋镖", "雷回旋镖",
            "草领域", "减速领域",
            "回复生命", "冰元素箭", "水元素箭", "火元素箭", "射手之息", "强壮之血"
        ]
        let skill_1 = await Ocr(578, 437, 193, 48);
        let skill_2 = await Ocr(870, 437, 193, 48);
        let skill_3 = await Ocr(1164, 437, 193, 48);
        let skills = [skill_1.text, skill_2.text, skill_3.text];
        let skill_id_list = [-1, -1, -1];

        for (let i = 0; i < skills.length; i++) {
            if (skill_id_list[i] === -1) {
                for (let j = 0; j < skill_list.length; j++) {
                    if (skill_list[j] === skills[i]) {
                        skill_id_list[i] = j;
                        break;
                    }
                }
            }
        }

        if (skill_id_list[0] <= skill_id_list[1] && skill_id_list[0] <= skill_id_list[2]) {
            click(672, 620);
            log.info(`选择能力：${skills[0]}[*] - ${skills[1]} - ${skills[2]}`);
        } else if (skill_id_list[1] <= skill_id_list[0] && skill_id_list[1] <= skill_id_list[2]) {
            click(964, 620);
            log.info(`选择能力：${skills[0]} - ${skills[1]}[*] - ${skills[2]}`);
        } else {
            click(1249, 620);
            log.info(`选择能力：${skills[0]} - ${skills[1]} - ${skills[2]}[*]`);
        }

        await sleep(200);
        click(967, 1021);
        await sleep(500);
    }

    async function main() {
        // 进入奇域并检查完成状态
        let state_result = await enter_stage_check_state();
        if (!state_result) {
            log.info("已完成...");
            await check_world(true);
            return null;
        }

        const f_pic = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F.png"), 1094, 334, 50, 426);
        let check_flag_page = false;
        let check_flag_win = false;

        while (true) {

            let current_ui = await get_current_ui();
            log.info(`当前界面：${current_ui}`);
            if (current_ui === "挑战") {
                keyDown("D");
                await sleep(7000);
                keyUp("D");
                if (await get_current_ui() !== "挑战") continue;
                keyDown("S");
                await sleep(4000);
                keyUp("S");
                if (await get_current_ui() !== "挑战") continue;
                keyDown("A");
                await sleep(7000);
                keyUp("A");
                if (await get_current_ui() !== "挑战") continue;
                keyDown("W");
                await sleep(4000);
                keyUp("W");
            } else if (current_ui === "奖励") {
                keyDown("D");
                await sleep(1000);
                keyUp("D");
                if (await get_current_ui() !== "奖励") continue;
                keyDown("Shift");
                keyDown("S");
                await sleep(2000);
                keyUp("S");
                keyUp("Shift");
                if (await get_current_ui() !== "奖励") continue;
                keyDown("Shift");
                keyDown("A");
                await sleep(5000);
                keyUp("A");
                keyUp("Shift");
                if (await get_current_ui() !== "奖励") continue;
                keyDown("W");
                keyDown("D");
                await sleep(2000);
                keyUp("W");
                keyUp("D");
                if (await get_current_ui() !== "奖励") continue;
                await sleep(100);
                for (let i = 0; i < 5; i++) {
                    keyDown("D");
                    await sleep(200);
                    keyUp("D");
                    await sleep(100);
                    if (captureGameRegion().Find(f_pic).isExist()) {
                        break;
                    }
                }
                await sleep(1000);
                await keyMouseScript.run(downRolls);
                keyPress("F");
                await sleep(1000);
            } else if (current_ui === "能力") {
                await choose_skill();
            } else if (current_ui === "主界面") {
                if (check_flag_win) {
                    log.info("挑战失败，进入结算...");
                    keyPress("Escape");
                    await sleep(1000);
                    click(968, 460);
                    await sleep(1000);
                    check_flag_win = false;
                    continue;
                }
                keyDown("W");
                await sleep(3000);
                keyUp("W");
                await sleep(500);
                for (let i = 0; i < 10; i++) {
                    keyDown("W");
                    await sleep(100);
                    keyUp("W");
                    await sleep(100);
                    if (captureGameRegion().Find(f_pic).isExist()) {
                        break;
                    }
                }
                for (let i = 0; i < Number(settings.difficulty); i++) { // 2困难 3无尽
                    await keyMouseScript.run(downRolls);
                    await sleep(100);
                }
                keyPress("F");
                await sleep(3000);
                check_flag_win = true;
            } else if (current_ui === "结算界面") {
                await sleep(1000);
                click(1723, 1023);
                check_flag_page = true;
            } else if (current_ui === "奇域界面") {
                if (check_flag_page) {
                    check_flag_page = false;
                    let state_result = await enter_stage_check_state();
                    if (!state_result) {
                        log.info("已完成...");
                        break;
                    }
                }
                await sleep(1000);
                click(1578, 934);
            } else if (current_ui === "未知界面") {
                await sleep(1000);
            }
            await sleep(100);
        }

        await check_world(true);
    }

    await main();
})();