(async function () {
    // 从 settings 中获取最大循环次数，如果未配置则默认为 2000
    const maxLoopCount = parseInt(settings.maxLoopCount || 2000, 10);

    // 从 settings 中获取排除时间（小时数），如果未配置则默认为 4
    const excludeHour = parseInt(settings.excludeTimeRange || 4, 10);

    // 检查最大循环次数是否为有效数字
    if (isNaN(maxLoopCount) || maxLoopCount <= 0) {
        log.error("无效的最大循环次数，请输入一个正整数");
        return; // 退出整个程序
    }

    // 检查排除时间是否为有效数字
    if (isNaN(excludeHour) || excludeHour < 0 || excludeHour > 23) {
        log.error("无效的排除时间，请输入一个0到23之间的整数");
        return; // 退出整个程序
    }

    // 定义路径文件名
    const pathFileName = "信仰之跃.json";

    // 执行循环
    for (let i = 0; i < maxLoopCount; i++) {
        // 获取当前时间
        const now = new Date();
        const currentHour = now.getHours(); // 获取当前时间的小时数
        const currentTime = now.toLocaleString(); // 获取完整的当前时间字符串

        // 如果当前时间的小时数与排除时间相同，则退出循环
        if (currentHour === excludeHour) {
            log.info(`当前时间是 ${currentTime}，与排除时间小时数相同，将退出循环`);
            break; // 退出循环
        }

        // 记录当前时间
        log.info(`正在执行循环第 ${i + 1} 次，总共 ${maxLoopCount} 次，当前时间: ${currentTime}`);

        try {
            // 运行路径追踪任务
            await pathingScript.runFile(pathFileName);
        } catch (error) {
            // 捕获并处理路径追踪任务中的错误
            log.error(`在第 ${i + 1} 次循环中运行路径追踪任务时发生错误: ${error.message}`);
            log.error("由于发生错误，将退出整个程序");
            return; // 退出整个程序
        }
    }
})();
