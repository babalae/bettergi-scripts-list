(async function () {
    setGameMetrics(2560, 1440, 1.5)
    let delay = settings.delay || 5000;
    genshin.returnMainUi()
    log.warn("请勿操作鼠标和键盘！")

    await pathingScript.runFile("assets/进入蒙德天使的馈赠.json")
    await sleep(delay)
    log.info("看到这条消息时如果加载还没有完成，请修改JS脚本自定义配置，延长传送加载时间！")
    await keyMouseScript.runFile("assets/游逸旅闻-罗莎莉亚2-蒙德天使的馈赠内.json")
    await sleep(1000)
    keyPress("VK_F")
})();
