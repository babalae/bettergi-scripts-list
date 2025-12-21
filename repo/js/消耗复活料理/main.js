// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看

async function fakeLog(name, isJs, isStart, duration) {
    await sleep(10);
    const currentTime = Date.now();
    // 参数检查
    if (typeof name !== 'string') {
        log.error("参数 'name' 必须是字符串类型！");
        return;
    }
    if (typeof isJs !== 'boolean') {
        log.error("参数 'isJs' 必须是布尔型！");
        return;
    }
    if (typeof isStart !== 'boolean') {
        log.error("参数 'isStart' 必须是布尔型！");
        return;
    }
    if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
        log.error("参数 'currentTime' 必须是整数！");
        return;
    }
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
        log.error("参数 'duration' 必须是整数！");
        return;
    }

    // 将 currentTime 转换为 Date 对象并格式化为 HH:mm:ss.sss
    const date = new Date(currentTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

    // 将 duration 转换为分钟和秒，并保留三位小数
    const durationInSeconds = duration / 1000; // 转换为秒
    const durationMinutes = Math.floor(durationInSeconds / 60);
    const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数

    // 使用四个独立的 if 语句处理四种情况
    if (isJs && isStart) {
        // 处理 isJs = true 且 isStart = true 的情况
        const logMessage = `正在伪造js开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行JS脚本: "${name}"`;
        log.debug(logMessage);
    }
    if (isJs && !isStart) {
        // 处理 isJs = true 且 isStart = false 的情况
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
    if (!isJs && isStart) {
        // 处理 isJs = false 且 isStart = true 的情况
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    }
    if (!isJs && !isStart) {
        // 处理 isJs = false 且 isStart = false 的情况
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
}


(async function () {

    //伪造js结束的日志记录
    await fakeLog("消耗复活料理", true, false, 2333);

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

        await fakeLog(`第${i + 1}次信仰之跃.json`, false, true, 0);

        // 运行路径追踪任务
        await pathingScript.runFile(pathFileName);

        await fakeLog(`第${i + 1}次信仰之跃.json`, false, false, 0);

        //捕获任务结束的信息，同时等待115秒用来卡时间
        try {
            log.info('正在等待复活料理cd')
            await sleep(115000);
        } catch (error) {
            log.error(`发生错误: ${error}`);
            break; // 终止循环
        }
    }

    //伪造一个js开始的日志记录
    await fakeLog("消耗复活料理", true, true, 0);

})();
