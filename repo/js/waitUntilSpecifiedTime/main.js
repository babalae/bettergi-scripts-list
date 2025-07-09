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
    const enableRegularChecks = settings.enableRegularChecks !== false; // 默认启用
    
    if (isNaN(specifyHours) || isNaN(specifyMinutes)) {
        log.warn(`⚠️请先设置目标时间点⚠️\n
             ⚠️⚠️请先设置目标时间点⚠️⚠️\n
           ⚠️⚠️⚠️请先设置目标时间点⚠️⚠️⚠️\n`);
    } else {
        // 首次计算并显示剩余时间
        const initialTimeLeft = getTimeUntilNextTime(specifyHours, specifyMinutes);
        const initialHours = Math.floor(initialTimeLeft / 3600000);
        const initialMinutes = Math.floor((initialTimeLeft % 3600000) / 60000);
        
        log.info(`--------------- 将等待至 ${specifyHours}：${specifyMinutes} ---------------`);
        log.info(`距离目标时间${specifyHours}小時${specifyMinutes}分，还有 ${initialHours} 小时 ${initialMinutes} 分`);
        
        if (enableRegularChecks) {
            let lastReportTime = Date.now();
            const FIVE_MINUTES = 5 * 60 * 1000;
            
            while (true) {
                // 计算剩余时间
                const timeLeft = getTimeUntilNextTime(specifyHours, specifyMinutes);
                const hours = Math.floor(timeLeft / 3600000);
                const minutes = Math.floor((timeLeft % 3600000) / 60000);
                
                // 每5分钟报告一次
                const now = Date.now();
                if (now - lastReportTime >= FIVE_MINUTES) {
                    log.info(`距离目标时间${specifyHours}小時${specifyMinutes}分，还有 ${hours} 小时 ${minutes} 分`);
                    lastReportTime = now;
                }
                
                // 到达目标时间后退出（预留5秒缓冲）
                if (timeLeft <= 5000) {
                    await sleep(timeLeft);
                    break;
                }
                
                // 每分钟检查一次（或更短时间如果接近目标）
                const waitTime = Math.min(60000, timeLeft);
                await sleep(waitTime);
            }
        } else {
            // 计算相差时间（毫秒）
            const timeLeft = getTimeUntilNextTime(specifyHours, specifyMinutes);
            await sleep(timeLeft + 5000);
        }
        
        log.info(`时间已到！当前时间为 ${specifyHours}：${specifyMinutes}`);
    }
})();