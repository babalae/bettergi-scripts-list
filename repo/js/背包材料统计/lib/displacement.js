
/*

// 位移计算逻辑

*/

// 辅助函数：计算两点之间的距离
function calculateDistance(initialPosition, finalPosition) {
    const deltaX = finalPosition.X - initialPosition.X;
    const deltaY = finalPosition.Y - initialPosition.Y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}
/*
// 位移监测函数
async function monitorDisplacement(monitoring, resolve) {
    // 获取对象的实际初始位置
    let lastPosition = genshin.getPositionFromMap();
    let cumulativeDistance = 0; // 初始化累计位移量
    let lastUpdateTime = Date.now(); // 记录上一次位置更新的时间

    while (monitoring) {
        const currentPosition = genshin.getPositionFromMap(); // 获取当前位置
        const currentTime = Date.now(); // 获取当前时间

        // 计算位移量
        const deltaX = currentPosition.X - lastPosition.X;
        const deltaY = currentPosition.Y - lastPosition.Y;
        let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // 如果位移量小于0.5，则视为0
        if (distance < 0.5) {
            distance = 0;
        }

        // 如果有位移，更新累计位移量和最后更新时间
        if (distance > 0) {
            cumulativeDistance += distance; // 累计位移量
            lastUpdateTime = currentTime; // 更新最后更新时间
        }

        // 检测是否超过5秒没有位移
        if (currentTime - lastUpdateTime >= 5000) {
            // 触发跳跃
            keyPress(VK_SPACE);
            lastUpdateTime = currentTime; // 重置最后更新时间
        }

        // 输出位移信息和累计位移量
        log.info(`时间：${(currentTime - lastUpdateTime) / 1000}秒，位移信息: X=${currentPosition.X}, Y=${currentPosition.Y}, 当前位移量=${distance.toFixed(2)}, 累计位移量=${cumulativeDistance.toFixed(2)}`);

        // 更新最后位置
        lastPosition = currentPosition;

        // 等待1秒再次检查
        await sleep(1000);
    }

    // 当监测结束时，返回累计位移量
    resolve(cumulativeDistance);
}
*/
