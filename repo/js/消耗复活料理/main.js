(async function () {
    // 定义六个运行时变量，初始值分别为 2000、1000、0、0、0、0
    let runtime1 = 2000;
    let runtime2 = 1000;
    let runtime3 = 0;
    let runtime4 = 0;
    let runtime5 = 0;
    let runtime6 = 0;

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

        // 更新 runtime 变量
        runtime6 = runtime5;
        runtime5 = runtime4;
        runtime4 = runtime3;
        runtime3 = runtime2;
        runtime2 = runtime1;
        runtime1 = now.getTime();

        // 检查时间差条件
        if ((runtime1 - runtime2) < 500 &&
            (runtime2 - runtime3) < 500 &&
            (runtime3 - runtime4) < 500 &&
            (runtime4 - runtime5) < 500 &&
            (runtime5 - runtime6) < 500) {
            log.info(`连续五次时间差小于 500 毫秒，循环终止。`);
            break; // 如果连续五次时间差小于 500 毫秒，退出循环
        }

        // 如果当前时间的小时数与排除时间相同，则退出循环
        if (currentHour === excludeHour) {
            log.info(`当前时间是 ${currentTime}，与排除时间小时数相同，将退出循环`);
            break; // 退出循环
        }

        // 记录当前时间
        log.info(`正在执行循环第 ${i + 1} 次，总共 ${maxLoopCount} 次，当前时间: ${currentTime}`);

        // 运行路径追踪任务
        await pathingScript.runFile(pathFileName);
    }
})();
