eval(file.readTextSync(`utils/uid.js`));
let checkInterval = +settings.checkInterval || 50;
let waitTime = 40;

function getAdjustedDate() {
    const now = new Date();
    // 减去4小时（4 * 60 * 60 * 1000 毫秒）
    now.setHours(now.getHours() - 4);

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}


// 更新json文件
async function updateFile(settingsArray, path) {
    let json = JSON.stringify(settingsArray, null, 2)
        .replaceAll(']"', ']')
        .replaceAll('"[', '[')
        .replaceAll('\\"', '"')
        .replaceAll('\\\\n', '\\n')
    // warn("settings==>"+json, true)
    // 写入更新后的设置
    const success = file.writeTextSync(path, json);
    if (!success) {
        throw new Error("写入设置文件失败");
    }
}

(async function () {
    //启用自动剧情
    //dispatcher.addTimer(new RealtimeTimer("AutoSkip"));
    let attempts = 0;
    let success = false;
    if (genshin.width !== 1920 || genshin.height !== 1080) {
        log.warn("游戏窗口非 1920×1080，可能导致图像识别失败，如果执意使用可能造成异常，后果自负");
        await sleep(5000);
    }

    let executeJson = "execute.json"
    let execute = JSON.parse(file.readTextSync(executeJson));
    let uid = await uidUtil.ocrUID();
    let currentDate = getAdjustedDate();
    for (const uidElement of execute) {
        if (uidElement.uid === uid && uidElement.date === currentDate) {
            log.info("UID:{uid} 今天已经立本过了", uid);
            return
        }
    }
    let executeList = execute ? execute : new Array()
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

    executeList.push({
        uid: uid,
        success: success,//冗余
        date: currentDate
    })
    await updateFile(executeList, executeJson)

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
            if (res.isExist()) {
                await sleep(checkInterval * 2 + 50);
                if (doClick) {
                    res.click();
                }
                return true;
            }
        } finally {
            rg.dispose();
        }
        if (i < maxAttempts - 1) await sleep(checkInterval);
    }
    return false;
}