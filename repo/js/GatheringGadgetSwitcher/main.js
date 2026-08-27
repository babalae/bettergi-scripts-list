(async function () {
    const gadgetName = settings.gadgetName;
    const gadgetAssets = {
        "化种匣": "assets/RecognitionObject/化种匣.png",
        "王树瑞佑": "assets/RecognitionObject/王树瑞佑.png"
    };
    const gadgetRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync(gadgetAssets[gadgetName]),
        106,
        110,
        1171,
        845
    );

    function readActionText() {
        const frame = captureGameRegion();
        const result = frame.find(RecognitionObject.ocr(1600, 965, 260, 90));
        const text = result.text || "";
        frame.dispose();
        return text;
    }

    async function waitForActionText() {
        let actionText = "";
        for (let attempt = 0; attempt < 6; attempt++) {
            actionText = readActionText();
            if (actionText.includes("替换") || actionText.includes("装备") || actionText.includes("卸下")) {
                return actionText;
            }
            await sleep(300);
        }
        return actionText;
    }

    async function scrollToNextPage() {
        for (let round = 0; round < 3; round++) {
            verticalScroll(-2);
            await sleep(40);
        }
        await sleep(300);
        for (let round = 0; round < 32; round++) {
            verticalScroll(-2);
            await sleep(40);
        }
        await sleep(300);
    }

    async function findAndEquip() {
        const frame = captureGameRegion();
        const result = frame.find(gadgetRo);
        const found = result.isExist();
        if (found) {
            result.click();
        }
        frame.dispose();
        if (!found) {
            return false;
        }

        log.info(`找到小道具：${gadgetName}`);
        await sleep(500);
        const actionText = await waitForActionText();
        if (actionText.includes("卸下")) {
            log.info(`小道具已经装备：${gadgetName}`);
            return true;
        }
        if (actionText.includes("替换") || actionText.includes("装备")) {
            log.info(`小道具按钮状态：${actionText}`);
            click(1730, 1010);
            await sleep(500);
            return true;
        }
        log.warn(`无法确认小道具按钮：${actionText}`);
        return false;
    }

    await genshin.returnMainUi();
    keyPress("B");
    await sleep(1500);
    click(1067, 57);
    await sleep(1000);
    moveMouseTo(1100, 800);
    verticalScroll(70);
    await sleep(500);

    let equipped = false;
    for (let page = 0; page < 6 && !equipped; page++) {
        equipped = await findAndEquip();
        if (!equipped) {
            await scrollToNextPage();
        }
    }

    await genshin.returnMainUi();
    if (!equipped) {
        throw new Error(`背包小道具中未找到：${gadgetName}`);
    }
    log.info(`已装备小道具：${gadgetName}`);
})();
