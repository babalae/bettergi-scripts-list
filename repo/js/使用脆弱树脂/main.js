(async function () {
    const defaultTime = 1

    setGameMetrics(3840, 2160, 1.5); // 设置游戏窗口大小和DPI

    keyPress("M");//打开地图
    await sleep(1200);
    click(2475, 95);// 点击添加体力
    await sleep(600);
    click(1660, 950)// 选择脆弱树脂
    await sleep(600);
    click(2350, 1550);// 点击使用
    await sleep(600);

    if (isNaN(settings.times || settings.times <= 0)) {
        times = defaultTime
    }else{
        for (let i = 1; i < settings.times; ++i) {
            click(2585, 1295);// 点击使用数量
            await sleep(600);
        }
    }

    click(2350, 1550);// 点击使用
    await sleep(600);
    click(1920, 1500);// 点击空白处
    await sleep(600);
    keyPress("VK_ESCAPE");//关闭地图

})();
