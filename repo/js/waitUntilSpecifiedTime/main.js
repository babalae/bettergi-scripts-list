(async function () {
    /**
     * 计算从「现在」到下一次指定时分的毫秒差
     *
     * @param {number} validatedHours   小时（0–23）
     * @param {number} validatedMinutes 分钟（0–59）
     * @returns {number} 下一次指定时分与目前时间的毫秒差
     */
    function getTimeUntilNextTime(validatedHours, validatedMinutes) {
        const now = new Date();
        const nextTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            validatedHours, validatedMinutes, 0, 0
        );

        // 如果当前时间已经到达或超过今天指定的时刻，就把 nextTime 设为明天的同一时间
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

    // 读取参数
    let specifyHours = Number(settings.specifyHours);
    let specifyMinutes = Number(settings.specifyMinutes);
    
    if (isNaN(specifyHours) || isNaN(specifyMinutes)) {
        log.warn(`⚠️请先设置目标时间点⚠️\n
             ⚠️⚠️请先设置目标时间点⚠️⚠️\n
           ⚠️⚠️⚠️请先设置目标时间点⚠️⚠️⚠️\n`);
    } else {

        log.info(`--------------- 将等待至 ${specifyHours}：${specifyMinutes} ---------------`)

        // 计算相差时间（毫秒）
        const timeUntilNextTime = getTimeUntilNextTime(specifyHours, specifyMinutes);
        const hours = Math.floor(timeUntilNextTime / 3600000);
        const minutes = Math.floor((timeUntilNextTime % 3600000) / 60000);
        log.info(`距离目标时间 ${specifyHours}:${specifyMinutes}，还有 ${hours} 小时 ${minutes} 分钟`);

        // 每5分钟报告一次剩余时间
        const reportInterval = 5 * 60 * 1000; // 5分钟（毫秒）
        let remainingTime = timeUntilNextTime;
        
        while (remainingTime > reportInterval) {
            // 等待5分钟或剩余时间（取较小值）
            const waitTime = Math.min(reportInterval, remainingTime);
            await sleep(waitTime);
            
            // 更新剩余时间
            remainingTime -= waitTime;

            // 计算剩余小时和分钟
            const remainHours = Math.floor(remainingTime / 3600000);
            const remainMinutes = Math.floor((remainingTime % 3600000) / 60000);
            
            // 报告剩余时间
            log.info(`距离目标时间 ${specifyHours}:${specifyMinutes}，还有 ${remainHours} 小时 ${remainMinutes} 分钟`);
        }
        
        // 等待最后剩余的时间（不足5分钟）
        if (remainingTime > 0) {
            await sleep(remainingTime);
        }
        
        // 多等待5秒
        // await sleep(5000);
        log.info(`时间已到！当前时间为 ${specifyHours}：${specifyMinutes}`);
    }
})();