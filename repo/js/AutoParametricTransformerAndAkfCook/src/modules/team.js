//作者：夜雨l星辰
// 队伍模块：自动识别目标角色在队伍中的位置并切换，以及切换队伍（失败则传送七天神像重试）

// ===== 自动识别目标角色在队伍中的位置并切换 =====
export async function switchToAvatar(characterName) {
    var avatars = getAvatars();
    if (!avatars || avatars.length === 0) {
        log.error("未能识别到队伍角色，请确认已在游戏主界面且队伍满编");
        return false;
    }
    for (let i = 0; i < avatars.length; i++) {
        if (avatars[i] === characterName) {
            await keyPress(String(i + 1));
            await sleep(1500);
            log.info(`已切换到 ${characterName}（队伍第 ${i + 1} 位）`);
            return true;
        }
    }
    log.error(`队伍中未找到角色：${characterName}，请确认名字配置正确`);
    return false;
}

// ===== 切换队伍（失败则传送到七天神像重试）=====
export async function switchParty(partyName) {
    log.info("正在切换队伍: " + partyName);
    try {
        if (!await genshin.switchParty(partyName)) {
            log.info("队伍切换失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await sleep(1500);
            await genshin.switchParty(partyName);
        }
    } catch (error) {
        log.error("队伍切换异常: " + error.message);
        return false;
    }
    await sleep(1000);
    log.info("队伍切换完成");
    return true;
}
