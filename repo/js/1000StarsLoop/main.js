// 主逻辑
let content = settings.content || "7108700065";
let maxAttempts = (+settings.maxAttempts) || 15;
let delay = (+settings.delay) || 250;
let attempts = 0;
let entered = false;
(async function () {

    //循环指定次数
    while (attempts < maxAttempts) {
        await genshin.returnMainUi();
        attempts++;
        log.info(`开始第${attempts}次循环`);
        await sleep(2000);
        keyPress("F6");
        await sleep(250);
        if (!await ClickPNG("全部奇域")) {
            await sleep(250);
            await genshin.returnMainUi();
            keyPress("F6");
            if (!await ClickPNG("全部奇域")) {
                continue;
            }
        }
        await sleep(250);
        if (!await ClickPNG("搜索奇域")) continue;
        await sleep(250);
        log.info(`搜索${content}`);
        await sleep(1000);
        inputText(content);
        await sleep(500);
        if (!await ClickPNG("搜索")) continue;
        await sleep(250);
        result = await ClickPNG("进入");
        await sleep(250);
        //log.info(`结果是${result}`);
        if (!result) {
            log.warn("未找到标识，尝试点击固定位置");
            click(400, 300);
        }
        await sleep(250);
        if (!entered) {
            entered = await ClickPNG("前往大厅");
            if (!await ClickPNG("开始游戏", 600)) {
                continue;
            } else {
                entered = true;
            }
        } else {
            await sleep(250);
            await ClickPNG("开始游戏")
        }
        await sleep(250);
        if (!await ClickPNG("返回大厅", 600)) continue;
        await sleep(250);
    }
    if (settings.returnGenshin) {
        log.info("勾选了返回提瓦特，开始返回");
        await genshin.returnMainUi();
        await sleep(1000);
        keyPress("F2");
        await ClickPNG("返回提瓦特");
        await ClickPNG("确认返回");
    }
})();

async function ClickPNG(png, maxAttempts = 40) {
    log.info(`尝试找到并点击${png},等待至多${maxAttempts * 50}毫秒`);
    moveMouseTo(1920, 1080);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.95;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, maxAttempts);
}

async function findAndClick(target, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { await sleep(delay); res.click(); return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(50);
    }
    return false;
}