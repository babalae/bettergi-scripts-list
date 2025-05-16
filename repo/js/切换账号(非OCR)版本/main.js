(async function () {
    /**
     * 不使用屏幕识别的登出至其他账号的脚本
     * 版本：
     * 	原神：5.5
     * 	BIG：0.44.6
     */
    //实测缩放倍数1.0、1.5可行，实测凡16：9（大于1920*1080）均能正常使用。
    setGameMetrics(1920, 1080, 2.0);
    //到达主页面
    await genshin.returnMainUi();
    await sleep(1000);
    //打开派蒙页面
    keyPress("VK_ESCAPE");
    await sleep(1000);
    click(50, 1030);
    //退出门图标
    await sleep(1000);
    //退出至登录页面
    click(978, 540);
    await sleep(10000);
    //登录页面退出当前账号的小门图标
    click(1828, 985);
    await sleep(1000);
    //勾选：退出并保留登录记录
    click(701, 573);
    await sleep(1000);
    //点击退出大按钮
    click(1107, 684);
    await sleep(1000);
    //登录其他账号
    click(946, 703);
    await sleep(1000);
    //点击用户名输入框
    click(815, 400);
    //如果有文本，清除
    await keyPress("VK_DELETE");
    // 输入文本
    await inputText(settings.username);
    await sleep(500);
    //点击密码输入框
    click(815, 480);
    //如果有文本，清除
    await keyPress("VK_DELETE");
    // 输入文本
    await inputText(settings.password);
    await sleep(500);
    //登录
    keyPress("VK_RETURN");
    await sleep(500);
    //用户协议弹窗，点击同意，等待8.5s，增加容错
    click(1093, 593);
    await sleep(8500);
    //进入世界循环点击，增加容错
    for(let i = 3;i>0;i--){
        click(960, 540);
        await sleep(1500);
    }
    //确保进入主页面
    await sleep(12000);
    //点击领月卡
    await genshin.blessingOfTheWelkinMoon();

})();