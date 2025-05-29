/**
 * 尝试领取地脉花奖励
 * @returns {Promise<void>}
 */
this.attemptReward = 
async function () {
    const MAX_RETRY = 5;

    // 超时处理
    if (retryCount >= MAX_RETRY) {
        retryCount = 0;
        throw new Error("超过最大重试次数，领取奖励失败");
    }

    log.info("领取奖励，优先使用浓缩树脂");
    keyPress("F");
    await sleep(500);

    // 识别是否为地脉之花界面
    let resList = captureGameRegion().findMulti(ocrRoThis); // 使用预定义的ocrRoThis对象
    let isValid = false;
    let condensedResin = null;
    let originalResin = null;
    let isResinEmpty = false;
    let dobuleReward = false;

    if (resList && resList.count > 0) {
        // 分析识别到的文本
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("使用浓缩树脂")) {
                isValid = true;
                condensedResin = res;
            } else if (res.text.includes("使用原粹树脂")) {
                isValid = true;
                originalResin = res;
            } else if (res.text.includes("补充原粹树脂")) {
                isValid = true;
                isResinEmpty = true;
            } else if (res.text.includes("产出")) {
                isValid = true;
                dobuleReward = true;
            }
        }

        // 处理不同的树脂情况
        if (originalResin && dobuleReward == true) {
            log.info("选择使用原粹树脂，获得双倍产出");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
        } else if (condensedResin) {
            log.info("选择使用浓缩树脂");
            click(Math.round(condensedResin.x + condensedResin.width / 2), Math.round(condensedResin.y + condensedResin.height / 2));
        } else if (originalResin) {
            log.info("选择使用原粹树脂");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
        } else if (isResinEmpty) {
            log.error("识别到补充原粹树脂，看来树脂用完了呢");
            keyPress("VK_ESCAPE");
            throw new Error("树脂已用完");
        }
        if (settings.friendshipTeam) {
            log.info("切换回战斗队伍");
            await sleep(500);
            const switchSuccess = await switchTeam(settings.team);
            // if (!switchSuccess) {
            //     log.warn("切换队伍失败，返回七天神像切换");
            //     await genshin.tpToStatueOfTheSeven();
            //     await genshin.switchParty(settings.team);
            //     throw new Error("切换队伍失败");
            // }
        }
    }

    // 界面不正确，尝试重试
    if (!isValid) {
        log.info("当前界面不是地脉之花界面，重试");
        await genshin.returnMainUi();
        await sleep(1000);
        retryCount++;
        await autoNavigateToReward();
        await attemptReward();
    }
}