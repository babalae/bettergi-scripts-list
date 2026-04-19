(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    keyPress("J");
    log.info("已按下 J 键，等待 1 秒...");
    await sleep(1000);

    // 从 assets 目录加载模板
    const taskRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/任务追踪.png"));

    while (true) {
        const screen = captureGameRegion();
        const target = screen.Find(taskRo);

        if (!target.IsEmpty()) {
            log.info("检测到任务追踪，点击中...");
            target.Click();
            await sleep(700);
        } else {
            log.info("未检测到任务追踪，结束循环");
            screen.Dispose();
            break;
        }
    }

    log.info("返回主界面");
    await genshin.returnMainUi();
})();