/**
 * 判断是否为地脉花并处理
 * @param {number} timeout - 超时时间
 * @param {string} targetPath - 目标路径
 * @param {number} [retries=0] - 当前函数内重试次数
 * @returns {Promise<void>}
 */
this.processLeyLineOutcrop = 
async function (timeout, targetPath, retries = 0) {
    // 设置最大重试次数，防止死循环
    const MAX_RETRIES = 3;

    // 如果超过最大重试次数，记录错误并返回，避免死循环
    if (retries >= MAX_RETRIES) {
        log.error(`开启地脉花失败，已重试${MAX_RETRIES}次，终止处理`);
        log.error("我辣么大一个地脉花哪去了？");
        throw new Error("开启地脉花失败");
    }

    let captureRegion = captureGameRegion();
    let result = captureRegion.find(ocrRo2);
    let result2 = captureRegion.find(ocrRo3);
    if (result2.text.includes("地脉之花")) {
        log.info("识别到地脉之花");
        await switchToFriendshipTeamIfNeeded();
        return;
    }
    if (result2.text.includes("地脉溢口")) {
        log.info("识别到地脉溢口");
        keyPress("F");
        await sleep(300);
        keyPress("F");     // 两次重试避免开花失败
        await sleep(500);
    } else if (result.text.includes("打倒所有敌人")) {
        log.info("地脉花已经打开，直接战斗");
    } else {
        log.warn(`未识别到地脉花文本，当前重试次数: ${retries + 1}/${MAX_RETRIES}`);
        try {
            await pathingScript.runFile(targetPath);
            await processLeyLineOutcrop(timeout, targetPath, retries + 1);
            return;
        } catch (error) {
            throw new Error(`未识别到地脉花: ${error.message}`);
        }
    }
    if(!await autoFight(timeout)){
        throw new Error("战斗失败");
    }
    await switchToFriendshipTeamIfNeeded();
    await autoNavigateToReward();
}