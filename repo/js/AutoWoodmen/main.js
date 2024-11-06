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
        await sleep(validatedExitDelay); //退出延迟
        click(1000, 550);//进入游戏
        await sleep(13000);//加载延迟
        keyDown("z");
        await sleep(300);
        keyUp("z");
    }
    async function runGameActionsMultipleTimes(times,locationName) {
        // 负责循环调用performGameActions，实现循环砍树
        for (let i = 0; i < times; i++) {
            await performGameActions();
            log.info(`${locationName}循环次数：${i + 1}/${times}`)
        }
    }
    async function AutoPath(locationName, time) {
        //传入路径以及循环次数
        let filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
        await sleep(5000)
        await runGameActionsMultipleTimes(time,locationName)
    }
    async function KeyMouse(locationName, sec, x, y,time) {
        //传入路径，秒数，坐标
        if (x !== undefined && y !== undefined) {
            await genshin.tp(x, y);
            await sleep(1000);
        }

        let filePath = `assets/KeyMouse/${locationName}.json`;
        await keyMouseScript.runFile(filePath);
        await sleep(sec * 1000); // 将秒转换为毫秒
    }
    await AutoPath('松木_蒙德_24个', 84)
    await AutoPath('业果木15个(辉木15个)', 134)
    await AutoPath('刺葵木6个', 334)
    await AutoPath('却砂木12个', 167)
    await AutoPath('垂香木15个', 134)
    await AutoPath('御伽木9个(孔雀木6个)', 334)
    await AutoPath('悬铃木18个', 112)
    await AutoPath('杉木_蒙德_12个', 167)
    await AutoPath('枫木9个', 223)
    await AutoPath('柽木15个', 134)
    await AutoPath('桦木_蒙德_15个', 134)
    await AutoPath('梦见木12个', 167)
    await AutoPath('椴木9个(悬铃木9个)', 223)
    await AutoPath('灰灰楼木6个', 334)
    // await AutoPath('燃爆木15个', 0)
    await AutoPath('燃爆木6个(白栗栎木6个)', 334)
    await AutoPath('白梣木15个', 134)
    await AutoPath('竹节30个', 67)
    await AutoPath('萃华木6个(垂香木3个)', 334)
    await AutoPath('证悟木15个(业果木6个)', 134)
    await AutoPath('香柏木27个', 75)
    await KeyMouse('炬木15个',3, 8359.7548828125, -2868.03515625)
    // await keyDown('',5,8353.4921875,-2853.8505859375)


})();