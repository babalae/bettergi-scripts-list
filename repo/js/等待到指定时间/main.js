(async function () {
    /**
     * 計算從「現在」到下一次指定時分的毫秒差
     *
     * @param {number} validatedHours   小時（0–23）
     * @param {number} validatedMinutes 分鐘（0–59）
     * @returns {number} 下一次指定時分與目前時間的毫秒差
     */
    function getTimeUntilNextTime(validatedHours, validatedMinutes) {
        const now = new Date();
        const nextTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            validatedHours, validatedMinutes, 0, 0
        );

        // 如果目前時間已經到達或超過今天指定的時刻，就把 nextTime 設為明天的同一時間
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
    
    if (isNaN(specifyHours) || isNaN(specifyMinutes)) {
        log.warn(`⚠️先請设置停止运行的时间⚠️\n
             ⚠️⚠️先請设置停止运行的时间⚠️⚠️\n
           ⚠️⚠️⚠️先請设置停止运行的时间⚠️⚠️⚠️\n`);
    } else {

        log.info(`---------------将等待至 ${specifyHours}：${specifyMinutes} ---------------`)

        // 計算相差時間微秒
        const timeUntilNextTime = getTimeUntilNextTime(specifyHours, specifyMinutes);
        log.info(`等待 ${Math.floor((timeUntilNextTime / 60000 / 60))} 小时 ${(timeUntilNextTime / 60000 % 60).toFixed(0)} 分 ，直至 ${specifyHours} : ${specifyMinutes}`);
        // 多等待10秒
        await sleep(timeUntilNextTime + 10000);
        log.info(`时间到了！现在是 ${specifyHours}：${specifyMinutes}`);
    }

    //1秒   = 1000 毫秒
    //10秒  = 10000 毫秒
    //1分鐘 = 60000 毫秒
})();