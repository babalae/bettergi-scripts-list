(async function () {
    // 获取设置
    const weekdayOption = settings.weekdays || "周一"; // 默认周一
    const purchaseCount = parseInt(settings.purchases) || 5; // 默认购买5个
    
    // 将选项转换为对应的星期代码
    const weekdayMap = {
        "周一": 1,
        "周二": 2,
        "周三": 3,
        "周四": 4,
        "周五": 5,
        "周六": 6,
        "周日": 0
    };
    const selectedWeekday = weekdayMap[weekdayOption];
    
    // 检查当前星期是否为选择的星期
    const today = new Date().getDay(); // 0=周日, 1=周一, ... 6=周六
    if (today !== selectedWeekday) {
        log.info(`今天不是${weekdayOption}（当前星期：${today}），脚本终止`);
        return;
    }

    setGameMetrics(1920, 1080, 2);
    // 传送到稻妻若紫处
    async function AutoPath(locationName) {
        log.info(`前往稻妻-白狐之野-若紫处`);
        try {
            let filePath = `assets/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        await sleep(500);
    }
    async function Shopping() {
        await sleep(500);
        for (let j = 0; j < 4; j++) {
            keyPress("F"); await sleep(1000);//对话
        }
        await sleep(1000);
        for (let i = 0; i < purchaseCount; i++) {
            click(1690, 1020); await sleep(500); // 购买
            click(1170, 780); await sleep(400); // 确定
            click(1690, 1020); await sleep(200); // 点击空白处
        }
        geshin.returnMainUi(); // 返回主菜单
    }
    log.info("开始执行脚本");
    await AutoPath("四方八方之网");
    log.info("到达若紫处");
    await Shopping();
    log.info(`已购买 ${purchaseCount} 个四方八方之网`);
})();
