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

    /**
     * 計算到下一个X分5秒的时间差
     * @returns {number} 到下一個整分5秒的毫秒差
     */
    function getTimeToNextMinuteWith5Sec() {
        const now = new Date();
        // 創建下一個整分5秒的時間點
        const nextCheck = new Date(now);
        nextCheck.setSeconds(5); // 設置秒數為5
        nextCheck.setMilliseconds(0);
        
        // 如果當前時間已超過這個分鐘的5秒，則設置為下一分鐘
        if (now >= nextCheck) {
            nextCheck.setMinutes(nextCheck.getMinutes() + 1);
        }
        
        return nextCheck - now;
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

        // 每5分钟报告一次等待信息
        let lastReportTime = 0;
        const REPORT_INTERVAL = 5 * 60 * 1000; // 5分钟

        // 首次检查标志
        let isFirstCheck = true;
        
        while (true) {
            const now = new Date();
            
            // 檢測是否在3分鐘容差範圍內 (目標時間 ~ 目標時間+3分鐘)
            const targetTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                specifyHours, specifyMinutes, 0, 0
            );
            const tolerance = 3 * 60 * 1000; // 3分鐘容差
            
            // 如果當前時間在目標時間之後，且在3分鐘容差範圍內
            if (now >= targetTime && (now - targetTime) <= tolerance) {
                log.info(`已進入停止時間範圍，准备停止运行...`);
                break;
            }
            
            // 計算相差時間毫秒
            const timeUntilNextTime = getTimeUntilNextTime(specifyHours, specifyMinutes);
            
            // 每5分钟报告一次等待时间
            if (Date.now() - lastReportTime >= REPORT_INTERVAL) {
                const hours = Math.floor(timeUntilNextTime / 3600000);
                const minutes = Math.floor((timeUntilNextTime % 3600000) / 60000);
                const seconds = Math.floor((timeUntilNextTime % 60000) / 1000);
                log.info(`等待 ${hours}小时${minutes}分${seconds}秒 ，直至 ${specifyHours}:${specifyMinutes}`);
                lastReportTime = Date.now();
            }
            
            // 每60秒检查一次
            if (isFirstCheck) {
                // 第一次检查：等到下一个整分5秒
                const firstWaitTime = getTimeToNextMinuteWith5Sec();
                await sleep(firstWaitTime);
                isFirstCheck = false;
            } else {
                // 后续检查：每60秒一次
                await sleep(60000);
            }
        }
        
        // 加5秒缓冲）
        await sleep(5000);
        log.info(`时间到了！现在是 ${specifyHours}:${specifyMinutes}`);
    }

})();