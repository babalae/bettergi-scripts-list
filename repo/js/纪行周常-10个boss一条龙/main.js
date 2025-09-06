(async function () {
    try {
        log.info(`请设置较长的战斗超时时间，否则超时后判定为战斗结束`);
        await sleep(1000);
        log.info(`请在自动战斗界面设置关闭战斗结束拾取物品和万叶拾取，关闭更快的检查结束`);
        await sleep(1000);
        log.info(`请设置行走位为钟离（或其他成男成女角色），且配队中无其他加速buff`);
        await sleep(1000);
        // 检查是否需要切换队伍
        if (settings.switchPartyName) {
            await genshin.switchParty(settings.switchPartyName);
        }

        // 检查是否需要在开始前回七天神像
        if (settings.returnToStatueBeforeStart) {
             await genshin.tp(2297.630859375, -824.5517578125);
             await sleep(3000);
        }

        // 获取讨伐轮次
        let rounds = parseInt(settings.rounds);
        if (isNaN(rounds) || rounds < 1 || rounds > 10) {
            rounds = 10;
        }

        for (let round = 1; round <= rounds; round++) {
            let challengeName = settings.bossSelection;
            let attempt = 1;
            let battleSuccess = false;
            log.info(`当前进度：纪行周常-讨伐『${challengeName}』第${round}次`);
            while (attempt <= 3 && !battleSuccess) {
                log.info(`执行前往『${challengeName}』的路线`);
                await pathingScript.runFile(`assets/${challengeName}前往.json`);
                log.info(`开始第${attempt}次战斗尝试`);
                try {
                    await dispatcher.runTask(new SoloTask("AutoFight"));
                    battleSuccess = true;
                } catch (error) {
                    log.error("战斗失败，再来一次");
                    attempt++;
                }
            }

            if (!battleSuccess) {
                log.error("战斗失败，请切换队伍后再次尝试");
            }

            // 检查是否需要在每次讨伐后回七天神像
            if (settings.returnToStatueAfterEachRound) {
                await genshin.tp(2297.630859375, -824.5517578125);
                await sleep(3000);
            } else {
                await genshin.tp(-2659.4501953125, 1638.2265625);
                await sleep(3000);
            }
        }
    } catch (error) {
        log.error(`脚本执行出错: ${error}`);
    }
})();
