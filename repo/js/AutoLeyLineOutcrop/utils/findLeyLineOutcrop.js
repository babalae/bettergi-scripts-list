/**
 * 查找地脉花位置
 * @param {string} country - 国家名称
 * @param {string} type - 地脉花类型
 * @returns {Promise<void>}
 */
this.findLeyLineOutcrop = 
async function (country, type) {
    currentFlower = null;
    await closeCustomMarks();
    await sleep(1000);
    log.info("开始寻找地脉花");
    if (!config.mapPositions[country] || config.mapPositions[country].length === 0) {
        throw new Error(`未找到国家 ${country} 的位置信息`);
    }

    const positions = config.mapPositions[country];
    await genshin.moveMapTo(positions[0].x, positions[0].y, country);
    const found = await locateLeyLineOutcrop(type);
    await sleep(1000); // 移动后等一下
    if (found) return;
    for (let retryCount = 1; retryCount < positions.length; retryCount++) {
        const position = positions[retryCount];
        log.info(`第 ${retryCount + 1} 次尝试定位地脉花`);
        log.info(`移动到位置：(${position.x}, ${position.y}), ${position.name || '未命名位置'}`);
        await genshin.moveMapTo(position.x, position.y);
        
        const found = await locateLeyLineOutcrop(type);
        if (found) return;
    }

    // 如果到这里还没找到
    throw new Error("寻找地脉花失败，已达最大重试次数");
}