(async function () {
    // 设置游戏分辨率和DPI缩放
    setGameMetrics(1920, 1080, 1);

    async function cancelAni() {
        moveMouseTo(200, 200);
        leftButtonDown();
        await(10);
        leftButtonUp();
    }

    // 点击确认
    await click(1500,1000);

    // 跳过调整动画
    await sleep(1);
    await cancelAni();
    await sleep(1000);
    await click(45,715);

    // 重新进入调时间界面以消除调时间的声音
    await sleep(600);
    await keyPress("Escape");

    // 退出派蒙界面
    await sleep(600);
    await keyPress("Escape");
})();
