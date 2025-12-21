// 主逻辑
(async function () {
    let scrollTimes = (+settings.scrollTimes) || 0;
    let scrollLoops = (+settings.scrollLoops) || 37;
    //先回到主界面
    await genshin.returnMainUi();
    keyPress("B");
    //切换到圣遗物界面
    await ClickPNG("Artifacts");
    //点击关闭“按时间排序”
    await ClickPNG("sequence", 2);
    //点击筛选
    await ClickPNG("filter");
    //重置条件
    await ClickPNG("reset");
    //筛选套装
    await ClickPNG("filterSet");
    moveMouseTo(400, 750);
    //开始寻找教官
    let attempts = 0;
    while (attempts < 100) {
        attempts++;
        if (await ClickPNG("instructor", 1)) {
            //找到教官，终止循环
            break;
        }
        //没找到教官，尝试向下翻页
        await keyMouseScript.runFile(`assets/滚轮下翻.json`);
    }
    if (attempts >= 100) {
        log.warn("未找到教官");
    } else {
        log.info("成功找到教官");
        //确认筛选
        await ClickPNG("confirmFilter");
        //筛选未满级
        await ClickPNG("notFullLevel");
        //筛选未锁定
        await ClickPNG("notLocked");
        //确认
        await ClickPNG("confirm");
        //开始锁定四星教官
        for (let n = 1; n <= scrollTimes + 1; n++) {
            if (n != 1) {
                //当不是第一次循环时，进行翻页
                await sleep(200);
                log.info("执行翻页");
                moveMouseTo(960, 540);
                for (let k = 1; k <= scrollLoops; k++) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                }
            }
            for (let j = 1; j <= 4; j++) {
                let dobreak = false;
                for (let i = 1; i <= 8; i++) {
                    const fourStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/fourStar.png`), 120 + 145 * (i - 1), 200 + (j - 1) * 176, 150, 180);
                    if (await findAndClick(fourStarRo)) {
                        //成功找到并点击四星教官，根据自定义配置决定是否锁定
                        let dolock = true;
                        await sleep(50);
                        if (settings.chargeOnly) {
                            let hasCharge1 = await ClickPNG("chargeE1", 1);
                            let hasCharge2 = await ClickPNG("chargeE2", 1);
                            if (!hasCharge1 && !hasCharge2) {
                                log.info("不含充能词条，不锁定");
                                dolock = false;
                            }
                        }
                        if (settings.thressStartONly) {
                            const threeStartRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/threeStart.png`), 1330, 590, 70, 35);
                            let threeStart = await findAndClick(threeStartRo, 1);
                            if (!threeStart) {
                                log.info("不是初始三，不锁定");
                                dolock = false;
                            }
                        }
                        if (dolock) {
                            log.info("满足锁定条件，点击锁定");
                            await ClickPNG("lock", 5);
                        }
                    } else {
                        //已经没有四星教官，终止
                        dobreak = true;
                        break;
                    }
                }
                if (dobreak) {
                    break;
                }
            }
        }
    }
})();

async function ClickPNG(png, maxAttempts = 20) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    return await findAndClick(pngRo, maxAttempts);
}

async function findAndClick(target, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { await sleep(50); res.click(); return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(50);
    }
    return false;
}