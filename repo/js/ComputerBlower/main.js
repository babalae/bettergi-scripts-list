// 主函数
(async function () {
    let startTime = Date.now();
    const interval = +settings.interval || 1000;
    const timeout = +settings.timeout || 60;
    let lastCheck = startTime;
    let ocrcount = 0;
    let loopCount = 0;
    let logCount = 0;
    //let store = [];
    while (Date.now() - startTime < timeout * 1000) {
        loopCount++;
        try {
            let GameRegion = captureGameRegion();
            // store[loopCount] = GameRegion;
            if (settings.dispose) GameRegion.dispose();
            ocrcount++;
        } catch (error) {
            log.error(`运行时发生异常: ${error.message}`);
            break;
        }
        if (Date.now() - lastCheck >= interval) {
            logCount++;
            lastCheck = Date.now();
            log.info(`在第${logCount}个${interval}毫秒内执行了${ocrcount}次截图`);
            ocrcount = 0;
        }
    }
})();
