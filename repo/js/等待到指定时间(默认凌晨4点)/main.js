(async function () {

    const defaultHours = 4;
    const defaultMinutes = 0;

    function validateAndSetDefaults(specifyHours, specifyMinutes) {
        if (isNaN(specifyHours) || specifyHours > 23 || specifyHours == '') {
            if (specifyHours > 23) {
                log.warn("设置指定时间错误，请使用 0~23 时，将使用默认值：4时");
            }
            else {
                log.warn("你没有设置指定时，将使用默认值：4时");
            }

            specifyHours = defaultHours;
        }
        if (isNaN(specifyMinutes) || specifyMinutes > 59 || specifyMinutes == '') {
            if (specifyMinutes > 59) {
                log.warn("设置指定时间错误，请使用 0~59 分，将使用默认值：0分");
            } else {
                log.warn("你没有设置指定分钟，将使用默认值：0分");
            }
            specifyMinutes = defaultMinutes;
        }
        log.info(`---------------将等待至 ${specifyHours}：${specifyMinutes} ---------------`)
        return { specifyHours, specifyMinutes };
    }

    // 計算相差時間微秒
    function getTimeUntilNextTime(validatedHours, validatedMinutes) {
        const now = new Date();
        const nextTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            validatedHours, validatedMinutes, 0, 0
        );

        // 如果現在時間已經過了今天的 4 點，則計算明天的 4 點
        if (now >= nextTime) {
            nextTime.setDate(nextTime.getDate() + 1);
        }

        return nextTime - now;
    }

    setGameMetrics(1920, 1080, 2);
    // 启用自动拾取的实时任务
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    // 启用自动剧情的实时任务
    dispatcher.addTimer(new RealtimeTimer("AutoSkip"));
    // 讀取參數
    let specifyHours = Number(settings.specifyHours);
    let specifyMinutes = Number(settings.specifyMinutes);

    const { specifyHours: validatedHours, specifyMinutes: validatedMinutes } = validateAndSetDefaults(specifyHours, specifyMinutes);

    // 計算相差時間微秒
    const timeUntilNextTime = getTimeUntilNextTime(validatedHours, validatedMinutes);
    log.info(`等待 ${Math.floor((timeUntilNextTime / 60000 / 60))} 小时 ${(timeUntilNextTime / 60000 % 60).toFixed(0)} 分 ，直到下一个 ${validatedHours} : ${validatedMinutes}`);
    // 多等待10秒
    await sleep(timeUntilNextTime + 10000);
    log.info(`时间到了！现在是 ${specifyHours}：${specifyMinutes}`);

    //1秒   = 1000 毫秒
    //10秒  = 10000 毫秒
    //1分鐘 = 60000 毫秒
})();
