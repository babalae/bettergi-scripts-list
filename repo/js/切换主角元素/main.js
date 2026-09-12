(async function () {
    //处理自定义配置
    const partyName = settings.partyName || "";
    const element = settings.element || "风";
    const fullPath = `assets/switchElement/${element}.json`;
    //切换到用户指定的含有主角的配队
    await switchPartyIfNeeded(partyName);
    //导航至对应的七天神像
    await pathingScript.runFile(fullPath);
    //点击与某元素共鸣
    log.info(`旅行者正在汲取${element}元素力`);
    for (let i = 0; i < 5; i++) {
        await click(1400, 675);
        await sleep(500);
    }
    //传送离开防止影响后续
    await genshin.returnMainUi();
    await genshin.tpToStatueOfTheSeven();
})();

//切换队伍
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }
    try {
        log.info("正在尝试切换至" + partyName);
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(partyName);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}