/**
 * 判断是否为地脉花并处理
 * @param {number} timeout - 超时时间
 * @param {string} targetPath - 目标路径
 * @param {number} [retries=0] - 当前函数内重试次数
 * @returns {Promise<void>}
 */
this.processLeyLineOutcrop = 
async function (timeout, targetPath, retries = 0) {
    const MAX_RETRIES = 3;
    let captureRegion = null;
    timeout = timeout * 1000;
    
    try {
        // 检查重试次数，避免死循环
        if (retries >= MAX_RETRIES) {
            const errorMsg = `开启地脉花失败，已重试${MAX_RETRIES}次，终止处理`;
            log.error("我辣么大一个地脉花哪去了？");
            throw new Error(errorMsg);
        }

        // 截图并识别
        captureRegion = captureGameRegion();
        const result = captureRegion.find(ocrRo2);
        const result2 = captureRegion.find(ocrRo3);
        
        // 检查地脉之花状态 - 已完成状态，准备领取奖励
        log.debug(`地脉花状态：${result2.text}`);
        if (result2.text.includes("之花")) {
            log.info("识别到地脉之花，准备领取奖励");
            await switchToFriendshipTeamIfNeeded();
            return;
        }
        
        // 处理地脉溢口
        if (result2.text.includes("溢口")) {
            log.info("识别到地脉溢口");
            keyPress("F");
            await sleep(300);
            keyPress("F");
            await sleep(500);
        } else if (result.text.includes("打倒所有敌人")) {
            log.info("地脉花已经打开，直接战斗");
        } else {
            // 未识别到目标，需要重新导航
            log.warn("未识别到地脉花文本，尝试重新导航");
            await pathingScript.runFile(targetPath);
            return await this.processLeyLineOutcrop(timeout, targetPath, retries + 1);
        }
        
        // 执行战斗
        const fightResult = await autoFight(timeout);
        if (!fightResult) {
            throw new Error("战斗失败");
        }
        
        // 完成后续操作
        await switchToFriendshipTeamIfNeeded();
        await autoNavigateToReward();
        
    } catch (error) {
        // 保留原始错误信息
        const errorMsg = `地脉花处理失败 (重试${retries}/${MAX_RETRIES}): ${error.message}`;
        log.error(errorMsg);
        throw error;
    } finally {
        // 确保资源释放
        if (captureRegion) {
            try {
                captureRegion.dispose();
            } catch (disposeError) {
                log.warn(`截图资源释放失败: ${disposeError.message}`);
            }
        }
    }
}
