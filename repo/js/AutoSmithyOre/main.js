(async function () {
    ///
    // 读取用户配置
    ///
    let smithyName = settings.smithyName != undefined ? settings.smithyName : "枫丹铁匠铺";

    ///
    // 定义函数
    ///
    // 自动前往铁匠铺
    async function autoSmithy(smithyName) {
        log.info(`自动前往${smithyName}`);
        try {
            let filePath = `assets/${smithyName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${smithyName} 路径时发生错误`);
            log.error(error.toString());
        }
    }

    const forgeOre = async function (smithyName) {
        await sleep(1000);
        keyPress("F"); await sleep(1000); // 开始交互
        await click(960, 600); await sleep(1000); // 跳过第一个对话
        await click(960, 600); await sleep(1000); // 跳过第一个对话
        await click(1375, 500); await sleep(1000);
        await click(960, 600); await sleep(1000); // 跳过第二个对话
        await click(960, 600); await sleep(1000); // 跳过第二个对话
        await click(520, 140); await sleep(1000); // 选择锻造队列
        await click(170, 1010); await sleep(1000); // 领取全部
        await click(960, 900); await sleep(1000); // 确认
        await click(220, 140); await sleep(1000); // 选择配方
        await click(540, 270); await sleep(1000); // 选择魔矿
        await click(1750, 1020); await sleep(1000); // 3次锻造魔矿
        await click(1750, 1020); await sleep(1000);
        await click(1750, 1020); await sleep(2000);
        await click(960, 600); await sleep(2000);
        await click(1840, 45); await sleep(1000); // 退出锻造界面
    }

    ///
    // main
    ///
    setGameMetrics(1920, 1080, 1);
    await autoSmithy(smithyName);
    await forgeOre(smithyName);
})();
