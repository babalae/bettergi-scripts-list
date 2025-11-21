eval(file.readTextSync("lib.js"));

const CHAR_X = get_config_int("char_x", 0);
const CHAR_Y = get_config_int("char_y", 0);

const global_region = captureGameRegion();

const btn_startmatch = template("assets/next1-r.png", 0.891, 0.942, 0.07, 0.035, true);
const matching_tip = template_ocr(0.6757, 0.864, 0.06, 0.035, true);
const btn_acceptmatch = template("assets/button1.png", 0.528, 0.68, 0.04, 0.08, true);
const ingame_icon = template("assets/ingame-r.png", 0.923, 0.044, 0.023, 0.028, true);
const full_tip = template("assets/full1-r.png", 0.5, 0.274, 0.5, 0.5, true);

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

async function prepare() {
    await pathingScript.runFile("assets/path1.json");
    for (let i = 0; i < 10; i++) {
        await sleep(500);
        keyPress("F");
    }
}

async function start_minigame() {
    let should_retry = false;
    while (true) {
        // 点击开始匹配按钮
        try {
            await match_click(btn_startmatch, "开始匹配", true, 10000);
            await sleep(2000);
            if (captureGameRegion().Find(full_tip).isExist()) {
                log.info("检测到积分已满提示，退出");
                return false;
            }
            await sleep(1000);
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

        // 可能进入游戏界面，或匹配失败退回
        should_retry = false;
        log.info("等待进入游戏界面");
        let wait_start = Date.now();
        let last_wait_report = Date.now() + 15000000;
        while (true) {
            await sleep(1000);

            let now = Date.now();
            if (now > last_wait_report) {
                log.info(`等待中：${(now - wait_start) / 1000000}s`);
                last_wait_report = now + 15000000;
            }

            let screen = captureGameRegion();
            draw_obj(btn_startmatch, "start");
            draw_obj(ingame_icon, "ingame");
            await sleep(800);

            if (screen.Find(btn_startmatch).isExist()) {
                log.warn("匹配失败，即将重试");
                await sleep(3000);
                should_retry = true;
                break;
            }

            let ingame = screen.Find(ingame_icon);
            if (ingame.isExist()) {
                ingame.drawSelf("ingame_found");
                log.info("已经进入游戏界面");
                await sleep(500);
                ingame.click();
                return true;
            }
        }
        if (should_retry) {
            await sleep(5000);
            continue;
        }
    }

    throw new Error("Unreachable");
}

async function play(times) {
    for (let ii = 0; ii < times; ii++) {
        let act_key = ACT_KEYS[Math.floor(Math.random() * 4)];
        keyPress(act_key);
        await sleep(50);
        keyPress("SPACE");
        await sleep(50);
    }
}

async function one_shot() {
    await sleep(1000);
    log.info("任务开始");
    await genshin.returnMainUi();
    await sleep(1000);

    log.info("进入活动界面");
    await prepare();

    log.info("尝试匹配并进入小游戏");
    if (!await start_minigame()) {
        return false;
    }
    await sleep(3000);

    log.info("随机抽搐");

    while (true) {
        await play(50);
        if (!captureGameRegion().Find(ingame_icon).isExist()) {
            log.info("已经不在游戏中，停止操作");
            break;
        }
    }

    await sleep(1000);
    log.info("等待回到主界面");
    await genshin.returnMainUi();
    await sleep(10000);

    log.info("完成");
    return true;
}

async function main() {
    dispatcher.clearAllTriggers();

    let count = 0;
    while (true) {
        count++;
        if (!await one_shot()) break;
        await genshin.returnMainUi();
        await sleep(2000);
        await genshin.returnMainUi();
        await sleep(2000);
        log.info(`第${count}次游戏结束，重新开始`);
    }
    log.info("结束运行，可能是分数已满");

    return;
}



(async function () {
    await main();
})();