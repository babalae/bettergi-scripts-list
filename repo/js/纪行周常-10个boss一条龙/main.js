/**
 * 根据星期配置判断是否运行脚本
 * @param {Array} weekSelection - 用户选择的星期数组
 * @returns {boolean} 是否符合运行条件
 */
function shouldRunByWeekConfig(weekSelection) {
    const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

    // 检查配置是否为空
    if (!Array.isArray(weekSelection) || weekSelection.length === 0) {
        return false;
    }

    // 取得调整后的星期（0-6，0=星期日）
    const getAdjustedDayOfWeek = () => {
        const now = new Date();
        let dayOfWeek = now.getDay(); // 0-6
        const hours = now.getHours();

        // 凌晨 00:00~04:00 视为前一天
        if (hours < 4) {
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，视为前一天（${weekDays[dayOfWeek]}）`);
        } else {
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，使用当天（${weekDays[dayOfWeek]}）`);
        }

        return dayOfWeek;
    };

    const adjustedDayOfWeek = getAdjustedDayOfWeek();
    const currentChineseDay = weekDays[adjustedDayOfWeek];

    // 检查是否在允许的星期范围内
    const shouldRun = weekSelection.includes(currentChineseDay);
    return shouldRun;
}

(async function () {
    // 检查配置是否存在
    if (!Object.keys(settings).includes("execute_Week")) {
        log.error("首次运行前请编辑JS脚本自定义配置");
        return;
    }

    // 检查是否应该运行
    const executeWeek = Array.from(settings.execute_Week || []);
    if (!shouldRunByWeekConfig(executeWeek)) {
        log.info(`交互或拾取："不运行"`);
        return;
    }
    // ------------------------------------

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
