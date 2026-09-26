(async function () {

    if (settings.Modes == "Alt+F4") {
        await QuitGame();
    } else if (settings.Modes == "完全退出游戏") {
        await ExitGame();
    } else if (settings.Modes == "完全退出游戏到桌面") {
        await ExitGametoDesktop();
    } else {
        log.info("尖尖哇嘎乃")
    }

    // HZYgrandma 退出游戏
    async function QuitGame() {
        keyDown("MENU");
        keyDown("F4");
        await sleep(50);
        keyUp("MENU");
        keyUp("F4");
        await sleep(1500);
    }

    // 完全退出游戏
    async function ExitGame() {
        // 前置系统状态：大世界正常主界面
        setGameMetrics(3840, 2160, 2)
        keyPress("VK_ESCAPE");//打开派蒙菜单
        await sleep(1000);
        click(90, 2000);//点击左下角退出按钮
        await sleep(1000);
        click(2100, 1080);//点击确定
        await sleep(10000);//渲染开门界面的时间
        click(192, 1970);//点击登录界面左下角退出按钮
        await sleep(1000);
        click(2150, 1150);//点击确定
        await sleep(1000);
    }

    // MeisterJ 完全退出游戏到桌面
    async function ExitGametoDesktop() {
        // settings 的对象内容来自于 settings.json 文件生成的动态配置页面
        // 前置系统状态：大世界正常主界面
        setGameMetrics(3840, 2160, 2)
        keyPress("VK_ESCAPE");//打开派蒙菜单
        await sleep(1000);
        click(90, 2000);//点击左下角退出按钮
        await sleep(1000);
        click(2100, 1300);//点击确定
    }

})();