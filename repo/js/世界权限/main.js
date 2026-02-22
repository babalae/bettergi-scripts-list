let checkInterval = +settings.checkInterval || 50;
(async function () {
    let currentState = "";
    let targetState = settings.targetState;

    if (!settings.forceCheck) {
        log.info(`当前未启用强化确认模式，设置目标为${targetState}`);
        while (true) {
            await genshin.returnMainUi();
            await keyPress("F2");
            let attempts = 0;
            while (attempts < 20) {
                attempts++;
                if (await findPNG("确认后可加入", 1)) {
                    currentState = "确认后可加入";
                    break;
                }
                if (await findPNG("直接加入", 1)) {
                    currentState = "直接加入";
                    break;
                }
                if (await findPNG("不允许加入", 1)) {
                    currentState = "不允许加入";
                    break;
                }
            }
            if (currentState) {
                log.info(`当前世界权限为${currentState}`);
                break;
            }
        }

        if (currentState != targetState) {
            await clickPNG(currentState);
            await clickPNG("设置" + targetState);
        }
    } else {
        log.info(`当前已启用强化确认模式，设置目标为${targetState}`);
        let checkCount = 0;
        while (checkCount < 2) {
            await pathingScript.runFile(`assets/前往道成林并重新登录.json`);
            while (true) {
                await genshin.returnMainUi();
                await keyPress("F2");
                let attempts = 0;
                while (attempts < 20) {
                    attempts++;
                    if (await findPNG("确认后可加入", 1)) {
                        currentState = "确认后可加入";
                        break;
                    }
                    if (await findPNG("直接加入", 1)) {
                        currentState = "直接加入";
                        break;
                    }
                    if (await findPNG("不允许加入", 1)) {
                        currentState = "不允许加入";
                        break;
                    }
                }
                if (currentState) {
                    log.info(`当前世界权限为${currentState}`);
                    break;
                }
            }

            if (currentState != targetState) {
                await clickPNG(currentState);
                await clickPNG("设置" + targetState);
                checkCount = 0;
            } else {
                checkCount++;
            }
        }
    }
    await genshin.returnMainUi();
})();

async function clickPNG(png, maxAttempts = 20) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    return await findAndClick(pngRo, true, maxAttempts);
}

async function findPNG(png, maxAttempts = 20) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    return await findAndClick(pngRo, false, maxAttempts);
}

async function findAndClick(target, doClick = true, maxAttempts = 20) {
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