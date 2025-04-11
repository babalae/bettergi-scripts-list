(async function () {
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();
        renderingPrecision=settings.Rendering || "0.6"
    if (renderingPrecision === "0.6") {
        keyPress("Escape");
        await sleep(1500);
        click(45, 820);
        await sleep(1500);
        click(165, 290);
        await sleep(500);
        click(1625, 605);
        await sleep(500);
        click(1625, 635);
        await sleep(500);
        log.info("已切换0.6");
    } else if (renderingPrecision === "1.0") {
        keyPress("Escape");
        await sleep(1500);
        click(45, 820);
        await sleep(1500);
        click(165, 290);
        await sleep(500);
        click(1625, 605);
        await sleep(500);
        click(1625, 800);
        await sleep(500);
        log.info("已切换至1.0");
    } else {
        log.error("未知的渲染精度值");
    }
        await genshin.returnMainUi();
})();
