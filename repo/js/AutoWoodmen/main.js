w(async function () {
    setGameMetrics(1920, 1080, 2);

    async function performGameActions() {
        // 负责砍树的，退出重进，按Z
        await sleep(1000);//等待一秒
        keyPress("ESCAPE");//按下esc
        await sleep(1000);
        click(50, 1030);//点击退出
        await sleep(1000);
        click(1000, 750);//点击确认
        await sleep(10000); //退出延迟
        click(1000, 550);//进入游戏
        await sleep(13000);//加载延迟
        keyDown("z");
        await sleep(300);
        keyUp("z");
    }


    async function runGameActionsMultipleTimes(times) {
        // 负责循环调用performGameActions，实现循环砍树
        for (let i = 0; i < times; i++) {
            await performGameActions();
        }
    }
    async function AutoPath(locationName,time) {
        let filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
        await runGameActionsMultipleTimes(time)
    }
    await AutoPath('木材-却砂木_璃月_9个',2)
    await AutoPath('木材-桦木_蒙德_15个',100)
    await AutoPath('木材-杉木_蒙德_12个',100)
    await AutoPath('木材-松木_蒙德_24个',80)

})();