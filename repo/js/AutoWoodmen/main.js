(async function () {
    setGameMetrics(1920, 1080, 1.5);

    const defaultExitDelay = 10000;
    const defaultLoadingDelay = 13000;

    // 将字符串转换为数字
    let exitdelay = Number(settings.exitdelay);
    let loadingdelay = Number(settings.loadingdelay);

    // 检查参数是否有效，并设置缺省值
    function validateAndSetDefaults(exitdelay, loadingdelay) {
        if (isNaN(exitdelay) || exitdelay <= 0) {
            log.warn("你没有设置退出延迟，将使用默认值");
            exitdelay = defaultExitDelay;
        }

        if (isNaN(loadingdelay) || loadingdelay <= 0) {
            log.warn("你没有设置加载延迟，将使用默认值");
            loadingdelay = defaultLoadingDelay;
        }
        return { exitdelay, loadingdelay };
    }

    // 调用验证和设置缺省值函数
    const { exitdelay: validatedExitDelay, loadingdelay: validatedLoadingDelay } = validateAndSetDefaults(exitdelay, loadingdelay);

    // 继续执行程序逻辑
    log.info(`退出延迟: ${validatedExitDelay}, 加载延迟: ${validatedLoadingDelay}`);
    log.info("垂香木,悬铃木,桃椰子木,炬木,白栗栎木,燃爆木因路线问题无法获取");
    log.info("开始运行脚本");


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
        await sleep(validatedLoadingDelay);//加载延迟
        keyPress("z");
        // await sleep(300);
        // keyUp("z");
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
        await sleep(3000)
        await runGameActionsMultipleTimes(time)
    }



    await AutoPath('香柏木27个', 1)
    await AutoPath('御伽木9个(孔雀木6个)', 1)
    await AutoPath('萃华木6个(垂香木3个)', 1)
    await AutoPath('松木24个', 1)
    await AutoPath('业果木15个(辉木15个)', 1)
    await AutoPath('刺葵木6个', 1)
    await AutoPath('却砂木12个', 1)
    // await AutoPath('垂香木15个', 1)//?w?
    // await AutoPath('悬铃木18个', 1)//w??
    await AutoPath('杉木12个', 1)
    await AutoPath('枫木9个', 1)
    await AutoPath('柽木15个', 1)
    await AutoPath('桦木15个', 1)
    await AutoPath('梦见木12个', 1)
    await AutoPath('椴木9个(悬铃木9个)', 1)
    await AutoPath('灰灰楼木6个', 1)
    // await AutoPath('燃爆木15个', 134)//>>
    // await AutoPath('燃爆木6个(白栗栎木6个)', 1)//?ww
    await AutoPath('白梣木15个', 1)//?
    await AutoPath('竹节30个', 1)
    await AutoPath('证悟木15个(业果木6个)', 1)
    // await KeyMouse('炬木15个',3, 8359.7548828125, -2868.03515625,1)//?
    // await KeyMouse('桃椰子木12个',5,8353.4921875,-2853.8505859375,1)//?
    
    let endTime = settings.selectValue

    theEnd(endTime)
    async function theEnd(endTime){
        if (endTime === '退出账号'){
            await sleep(1000);//等待一秒
            keyPress("ESCAPE");//按下esc
            await sleep(1000);
            click(50, 1030);//点击退出
            await sleep(1000);
            click(1000, 750);//点击确认
            log.info('退出账号')
        }else if (endTime === '关闭游戏'){
            log.info('关闭游戏')
            keyDown("MENU");
            keyDown("F4");
            await sleep(50);
            keyUp("MENU");
            keyUp("F4");
            await sleep(1500);
        }else if (endTime === '无操作'){
            // 对，这里什么也没有
        } else {
            log.info('未选择结束后操作，默认无操作')

        }
    }


})();