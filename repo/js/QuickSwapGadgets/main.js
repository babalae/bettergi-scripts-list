(async function () {
    if (settings.NumberOfGadget === undefined) {
        log.error("请在'JS脚本自定义配置'中设置要切换的小道具编号");
        return;
    }
    await genshin.returnMainUi();
    log.debug("切换到{key}", settings.NumberOfGadget);
    keyDown("z");
    await sleep(1200);
    keyUp("z");
    let key = "VK_" + settings.NumberOfGadget[0];
    keyPress(key);
})();
