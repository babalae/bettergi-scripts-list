(async function () {
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    async function AutoPath(locationName) {
        let filePath = `assets/Benchmark/${locationName}.json`;
        await pathingScript.runFile(filePath);
        await sleep(1000);
    }

    function logScore(startTime, testName) {
        const endTime = Date.now();
        const timeTaken = (endTime - startTime) / 1000;
        const presetTimes = {
            '传送速度测试': 4500,
            '飞行速度测试': 3000,
            '游泳速度测试': 6000,
            '攀爬速度测试': 7000,
            '寻路速度测试': 12000,
            '抗打断测试': 9000
        };
        const score = presetTimes[testName] / timeTaken;
        log.info(`完成 ${testName} ，得分 ${score.toFixed(2)}`);
        return score;
    }

    async function runTest(testName, weight) {
        const startTime = Date.now();
        log.info('进行 {name}', testName);
        await AutoPath(testName);
        const score = await logScore(startTime, testName);
        scores.push({ name: testName, score, weight });
    }

    const weights = {
        '传送速度测试': 0.1,
        '飞行速度测试': 0.1,
        '游泳速度测试': 0.1,
        '攀爬速度测试': 0.1,
        '抗打断测试': 0.1,
        '寻路速度测试': 0.5
    };

    const scores = [];

    await runTest('传送速度测试', weights['传送速度测试']);
    await runTest('飞行速度测试', weights['飞行速度测试']);
    await runTest('游泳速度测试', weights['游泳速度测试']);
    await runTest('攀爬速度测试', weights['攀爬速度测试']);
    await runTest('寻路速度测试', weights['寻路速度测试']);
    await runTest('抗打断测试', weights['抗打断测试']);

    // 计算加权总得分
    const totalWeightedScore = scores.reduce((sum, item) => sum + item.score * item.weight, 0);
    log.info(`加权总得分：${totalWeightedScore.toFixed(2)}`);
    keyPress("m");
})();