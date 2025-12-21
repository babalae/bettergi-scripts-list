eval(file.readTextSync("lib.js"));

const CHAR_X = get_config_int("char_x", 0);
const CHAR_Y = get_config_int("char_y", 0);

const global_region = captureGameRegion();

const btn_details = template("assets/button1.png", 0.77, 0.75, 0.04, 0.08, true);
const btn_startmatch = template("assets/button2.png", 0.832, 0.95, 0.04, 0.08, true);
const btn_acceptmatch = template("assets/button1.png", 0.528, 0.68, 0.04, 0.08, true);
const btn_closetip = template("assets/button3.png", 0.978, 0.35, 0.043, 0.075, true);
const buff_icon = template("assets/buff.png", 0.068, 0.204, 0.03, 0.05, true);
const btn_confirm = template("assets/button1.png", 0.832, 0.95, 0.04, 0.08, true);
const goal_icon = template("assets/goal.png", 0.031, 0.3125 + 0.035 * 1, 0.012, 0.018 + 0.035 * 2);
const btn_finish1 = template("assets/finish1.png", 0.5, 0.805, 0.042, 0.026, true);
const btn_finish2 = template("assets/finish2.png", 0.5, 0.805, 0.029, 0.026, true);

const score = template_ocr(0.162, 0.415, 0.1, 0.06, false);
const matching_tip = template_ocr(0.35, 0.77, 0.12, 0.08, false);

const ACT_KEYS = ["W", "S", "A", "D"];

/// Press F5 and click on Details button
async function F5_and_click() {
    await keyPress("F5");
    await sleep(1000);

    for (let i = 0; i < 3; i++) {
        clickf(0.182, 0.255);
        await sleep(500);
    }

    await match_click(btn_details, "活动详情按钮");
    await sleep(2000);
}

async function start_minigame() {
    let should_retry = false;
    while (true) {
        // 点击开始匹配按钮
        try {
            await match_click(btn_startmatch, "开始匹配", true, 10000);
            await sleep(2000);
        } catch (e) {
            log.warn("点击匹配按钮失败，暂时跳过");
        }

        // 匹配中，准备点击接受按钮
        should_retry = false;
        while (true) {
            let screen = captureGameRegion();
            await sleep(800);

            // 确保还在匹配状态
            let tip = screen.Find(matching_tip);
            if (tip.isExist() && tip.text.startsWith("匹配中")) {
            } else {
                log.warn("匹配状态异常，即将重试");
                should_retry = true;
                break;
            }

            let btn = screen.Find(btn_acceptmatch);
            if (btn.isExist()) {
                log.info("匹配成功，接受");
                await sleep(500);
                btn.click();
                break;
            }

            await sleep(1000);
        }
        if (should_retry) {
            await sleep(5000);
            continue;
        }

        await sleep(8000);

        // 可能进入战斗准备界面，或匹配失败退回
        should_retry = false;
        log.info("等待进入选择角色界面")
        while (true) {
            await sleep(1000);
            let screen = captureGameRegion();
            draw_obj(btn_startmatch, "start");
            draw_obj(btn_closetip, "close");
            await sleep(800);

            if (screen.Find(btn_startmatch).isExist()) {
                log.warn("匹配失败，即将重试");
                await sleep(3000);
                should_retry = true;
                break;
            }

            let close = screen.Find(btn_closetip);
            if (close.isExist()) {
                close.drawSelf("close_found");
                log.info("已经进入选择角色界面");
                await sleep(500);
                close.click();
                return;
            }
        }
        if (should_retry) {
            await sleep(5000);
            continue;
        }
    }

    throw new Error("Unreachable");
}

function click_char(x, y) {
    movetof(0.057 + x * 0.073, 0.169 + y * 0.157);
    clickf(0.057 + x * 0.073, 0.169 + y * 0.157);
}

async function play(times) {
    for (let ii = 0; ii < times; ii++) {
        keyPress("Q");
        await sleep(500);
        keyPress("E");
        await sleep(500);
        let act = Math.floor(Math.random() * 8);
        let act_key = ACT_KEYS[act % 4];
        switch (act) {
            case 0: case 1: case 2: case 3:
                keyDown("SHIFT");
                keyDown(act_key);
                await sleep(1000);
                keyUp(act_key);
                keyUp("SHIFT");
                break;
            case 4:
                // 空格跳跃1秒
                keyDown("SPACE");
                await sleep(1000);
                keyUp("SPACE");
                break;
            case 5: case 6: case 7:
                // 左键连续普攻
                for (let i = 0; i < 5; i++) {
                    leftButtonDown();
                    await sleep(100);
                    leftButtonUp();
                    await sleep(100);
                }
                middleButtonClick();
                break;
            default:
                break;
        }
        await sleep(500);
    }
}



async function one_shot() {
    await sleep(1000);
    log.info("任务开始");
    await genshin.returnMainUi();
    await sleep(1000);

    log.info("进入活动界面");
    await F5_and_click();

    log.info("读取当前分数");
    let score_obj = await ocr_click(score, "活动分数", false);
    let score_re = score_obj.text.match(/(\d+)\s*\/\s*(\d+)/);
    let cur_score = -1, max_score = -1;
    if (score_re && score_re.length >= 3) {
        cur_score = Number(score_re[1]);
        max_score = Number(score_re[2]);
        log.info(`当前分数：${cur_score}/${max_score}`);
    } else {
        throw new Error(`分数解析失败：${score_obj.text}`);
    }

    if (cur_score >= max_score) {
        log.info("活动完成");
        return false;
    }

    log.info("尝试匹配并进入小游戏");
    await start_minigame();
    await sleep(3000);

    log.info("选择角色");
    await sleep(500);
    click_char(CHAR_X, CHAR_Y);
    await sleep(500);
    await match_click(btn_confirm, "确认角色选择");
    await sleep(500);

    log.info("等待buff选择界面");
    while (true) {
        if (captureGameRegion().Find(buff_icon).isExist()) {
            break;
        }
        await sleep(5000);
    }
    await sleep(1000);

    log.info("选择buff");
    clickf(0.25, 0.26);
    await sleep(500);
    await match_click(btn_confirm, "确认buff选择");
    await sleep(500);

    log.info("等待游戏开始");
    await sleep(5000);
    log.info("等待游戏提示出现");
    while (true) {
        draw_obj(goal_icon);
        let result = captureGameRegion().FindMulti(goal_icon);
        await sleep(500);
        if (result.count != 3) { await sleep(5000); continue; }
        await sleep(1000);
        break;
    }

    log.info("随机行动");
    while (true) {
        await play(15);
        let result = captureGameRegion().Find(btn_finish1);
        if (result.isExist()) {
            log.info("完成，点击结算按钮1");
            result.click();
            break;
        }
        await sleep(1000);
    }
    await sleep(1000);
    await match_click(btn_finish2, "退出活动");
    await sleep(10000);

    return true;
}

(async function () {
    let count = 0;
    while (true) {
        count++;
        if (!await one_shot()) break;
        await genshin.returnMainUi();
        await sleep(2000);
        await genshin.returnMainUi();
        await sleep(2000);
        log.info("第${count}次游戏结束，重新开始");
    }
    log.info("结束运行，可能是分数已满");

    return;
})();