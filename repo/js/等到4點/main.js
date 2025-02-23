(async function () {
    setGameMetrics(1920, 1080, 2);

    function getTimeUntilNext4AM() {
        const now = new Date();
        const next4AM = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            4, 0, 0, 0
        );

        // 如果現在時間已經過了今天的 4 點，則計算明天的 4 點
        if (now >= next4AM) {
            next4AM.setDate(next4AM.getDate() + 1);
        }

        return next4AM - now;
    }

    // 執行
    const timeUntilNext4AM = getTimeUntilNext4AM();
    log.info(`等待 ${timeUntilNext4AM / 60000} 分鐘直到下一個 4 點…`);
    // 多等待1分鐘
    await sleep(timeUntilNext4AM + 60000);
    log.info("時間到了！現在是 4 點。");
    
    //1 分鐘 = 60000 毫秒
})();