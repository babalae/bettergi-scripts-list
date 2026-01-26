/**
 * 根据用户输入的星期配置判断是否应该运行脚本
 * 输入格式：0（每天执行）或逗号分隔的星期几（1-7，7代表周日）
 * 若输入为空或未设置，则默认每天执行
 * @param {string} userInput - 用户输入的星期配置
 * @returns {boolean} 是否应该运行脚本
 */
function shouldRunByWeekConfig(userInput) {
    // 如果用户输入为空或未定义，默认为每天执行
    if (!userInput) {
        log.info("未设置星期配置，默认每天执行");
        return true;
    }

    // 获取调整后的星期几（考虑00:00~04:00视为前一天）
    const getAdjustedDayOfWeek = () => {
        const now = new Date();
        let dayOfWeek = now.getDay(); // 0-6 (0是周日)
        const hours = now.getHours();

        // 如果时间在00:00~04:00之间，视为前一天
        if (hours < 4) {
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 前一天
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，视为前一天（星期 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
        } else {
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，使用当天（星期 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
        }

        // 转换为1-7格式（7代表周日）
        return dayOfWeek === 0 ? 7 : dayOfWeek;
    };

    // 验证并存储用户输入的数字
    const validateAndStoreNumbers = (input) => {
        // 定义存储结果的数组
        let storedNumbers = [];

        // 使用正则表达式检测是否符合期望格式
        const regex = /^(\b([1-7])\b)(,(\b([1-7])\b))*$/;

        // 检测输入字符串是否符合正则表达式
        if (regex.test(input)) {
            // 将输入字符串按逗号分割成数组
            const numbers = input.split(',');

            // 将分割后的数字字符串转换为整数并存储到数组中
            storedNumbers = numbers.map(Number);
            return storedNumbers;
        } else {
            return false;
        }
    };

    // 判定每天执行 / 星期几执行
    if (userInput === "0") {
        log.info("设置每天执行");
        return true;
    } else {
        const items = validateAndStoreNumbers(userInput);
        if (!items) {
            log.error("星期设置格式错误，请使用类似'1,3,5,7'的格式，将默认每天执行");
            return true; // 格式错误时默认每天执行
        }

        // 获取调整后的星期几
        const dayOfWeek = getAdjustedDayOfWeek();

        // 检查当前星期是否在用户设置的范围内
        if (items.includes(dayOfWeek)) {
            log.info(`今天是星期 ${dayOfWeek}，符合运行条件`);
            return true;
        } else {
            log.info(`今天是星期 ${dayOfWeek}，不符合运行条件`);
            return false;
        }
    }
}

(async function () {
    // 检查是否应该执行
    if (!shouldRunByWeekConfig(settings.week)) {
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
