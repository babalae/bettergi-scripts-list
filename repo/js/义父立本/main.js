let checkInterval = +settings.checkInterval || 50;
let waitTime = 40;
(async function () {
    //启用自动剧情
    //dispatcher.addTimer(new RealtimeTimer("AutoSkip"));
    let attempts = 0;
    let success = false;
    if (genshin.width !== 1920 || genshin.height !== 1080) {
        log.warn("游戏窗口非 1920×1080，可能导致图像识别失败，如果执意使用可能造成异常，后果自负");
        await sleep(5000);
    }
    while (attempts < 3) {
        attempts++;
        await pathingScript.runFile(`assets/前往立本.json`);
        keyPress("F");
        await sleep(2000);
        while (true) {
            let res1 = await findPNG("剧情图标", 1);
            if (!res1) {
                break;
            }
            keyPress("VK_SPACE");
            let res2 = await findPNG("F图标", 1);
            if (res2) {
                keyPress("F");
            }
            await sleep(100);
        }
        await sleep(2000);
        if (await clickPNG("确认兑换", waitTime)) {
            log.info("成功进入立本");
            await sleep(1000);
            click(960, 840);
            success = true;
            break;
        }
    }

    if (!success) {
        log.error("3次重试均失败");
    }
})();

async function clickPNG(png, maxAttempts = 20) {
    //log.info(`调试-点击目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.9;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, true, maxAttempts);
}

async function findPNG(png, maxAttempts = 20) {
    //log.info(`调试-识别目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.9;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, false, maxAttempts);
}

async function findAndClick(target, doClick = true, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { await sleep(checkInterval * 2 + 50); if (doClick) { res.click(); } return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(checkInterval);
    }
    return false;
}