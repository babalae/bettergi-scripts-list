(async function () {
//读取用户配置
    setGameMetrics(1920, 1080, 1.25);
    let locationName = settings.selectValue || "枫丹凯瑟琳";
    let autoDailyReward = settings.AutoDailyReward || "否";
    let autoDispatchEnabled = settings.AutoDispatch || "是";

    log.debug(`用户选择的地点: ${locationName}`);
    log.debug(`自动领取每日委托状态: ${autoDailyReward}`);
    log.debug(`自动派遣状态: ${autoDispatchEnabled}`);

    //路径导航
    async function AutoPath(locationName) {
        log.info(`开始前往 ${locationName}`);
        try {
            let filePath = `assets/${locationName}.json`;
            log.debug(`加载路径文件: ${filePath}`);
            await pathingScript.runFile(filePath);
            log.info(`${locationName} 路径执行完成`);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误: ${error.message}`);
            log.debug(`错误详情: ${error.stack}`);
        }
        await sleep(2000);

        if (locationName === "纳塔凯瑟琳") {
            log.debug("正在处理特殊路径: 纳塔凯瑟琳");
            keyDown("w");
            await sleep(4500);
            keyUp("w");
            keyDown("d");
            await sleep(2000);
            keyUp("d");
        }
    }//

    //点击操作
    function getClickSequence(locationName, taskType) {
        const isSpecialLocation = locationName === "稻妻凯瑟琳" || locationName === "须弥凯瑟琳" || locationName === "枫丹凯瑟琳";
        if (taskType === "dailyReward") {
            return isSpecialLocation
                ? [
                    { x: 1300, y: 430, delay: 500 },
                    { x: 1300, y: 430, delay: 500 },
                    { x: 1300, y: 430, delay: 2000 },
                    { x: 1300, y: 430, delay: 1000 },
                    { x: 1300, y: 430, delay: 500 },
                    { x: 1600, y: 1020, delay: 500 },
                    { x: 1600, y: 1020, delay: 1000 },
                    { x: 1600, y: 1020, delay: 2000 }
                ]
                : [
                    { x: 1300, y: 510, delay: 500 },
                    { x: 1300, y: 510, delay: 500 },
                    { x: 1300, y: 510, delay: 2000 },
                    { x: 1300, y: 510, delay: 1000 },
                    { x: 1300, y: 510, delay: 500 },
                    { x: 1600, y: 1020, delay: 500 },
                    { x: 1600, y: 1020, delay: 1000 },
                    { x: 1600, y: 1020, delay: 2000 }
                ];
        } else if (taskType === "dispatch") {
            return isSpecialLocation
                ? [
                    { x: 1300, y: 580, delay: 500 },
                    { x: 1300, y: 580, delay: 500 },
                    { x: 1300, y: 580, delay: 1000 },
                    { x: 1300, y: 580, delay: 1000 },
                    { x: 110, y: 1020, delay: 1000 },
                    { x: 1080, y: 1020, delay: 1000 },
                    { x: 1840, y: 50, delay: 1000 }

                ]
                : [
                    { x: 1300, y: 650, delay: 500 },
                    { x: 1300, y: 650, delay: 500 },
                    { x: 1300, y: 650, delay: 1000 },
                    { x: 1300, y: 650, delay: 1000 },
                    { x: 110, y: 1020, delay: 1000 },
                    { x: 1080, y: 1020, delay: 1000 },
                    { x: 1840, y: 50, delay: 1000 }
                ];
        }
    }

    //点击操作函数
    async function performClickOperations(locationName, taskType) {
        await keyPress("f");
        const clicks = getClickSequence(locationName, taskType);
        await performClickSequence(clicks);
    }

    //延迟函数
    async function performClickSequence(clicks) {
        for (const { x, y, delay } of clicks) {
            await click(x, y);
            await sleep(delay);
        }
    }

    //处理任务函数
    async function HandleTask(taskName, isEnabled, operation) {
        log.info(`开始任务: ${taskName}`);
        try {
            if (isEnabled === "否") {
                log.info(`任务 "${taskName}" 未启用，跳过执行。`);
            } else {
                log.info(`任务 "${taskName}" 已启用，开始执行。`);
                await operation();
            }
        } catch (error) {
            log.error(`执行任务 "${taskName}" 时发生错误: ${error.message}`);
            log.debug(`错误详情: ${error.stack}`);
        }
    }

    //主执行函数
    log.info("开始执行路径脚本");
    await AutoPath(locationName);//路径函数
    await HandleTask("自动领取每日委托奖励", autoDailyReward, () => performClickOperations(locationName, "dailyReward"));//每日委托函数
    await sleep(1000);
    await HandleTask("探索派遣", autoDispatchEnabled, () => performClickOperations(locationName, "dispatch"));//派遣函数
})();