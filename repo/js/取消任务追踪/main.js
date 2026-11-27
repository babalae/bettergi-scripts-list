(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    keyPress("J");
    log.info("已按下 J 键，等待 1 秒...");
    await sleep(1000);

    // 只加载一次模板
    const templateMat = file.ReadImageMatSync("assets/任务追踪.png");
    const taskRo = RecognitionObject.TemplateMatch(templateMat);

    while (true) {
        const screen = captureGameRegion();
        const target = screen.Find(taskRo);

        if (!target.IsEmpty()) {
            log.info("检测到任务追踪，点击中...");
            target.Click();
            await sleep(700);
        } else {
            log.info("未检测到任务追踪，结束循环");
        }
        target.Dispose();
        screen.Dispose();

        // 没找到就跳出循环
        if (target.IsEmpty()) {
            break;
        }
    }

    // 最后释放全局模板
    templateMat.Dispose();

    await genshin.returnMainUi();
    log.info("执行完成，已返回主界面");
})();