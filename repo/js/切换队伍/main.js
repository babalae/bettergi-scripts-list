(async function () {

    if (!settings.enable) {
        log.error(`请打开「JS脚本自定义配置」，然后阅读并勾选第一个复选框。`);
        return
    }

    // 切换队伍
    if (settings.team) {
        log.info(`切换至队伍 ${settings.team}`);
        try {
            log.info("正在尝试切换至" + settings.team);
            if (!await genshin.switchParty(settings.team)) {
                log.info("切换队伍失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                await genshin.switchParty(settings.team);
            }
        } catch {
            log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
            notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
            await genshin.returnMainUi();
        }
    }

})();
