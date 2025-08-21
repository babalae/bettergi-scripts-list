(async function () {
    log.info("请确保执行脚本前能够通过ESC回到主界面");
    await genshin.returnMainUi();
    keyPress("VK_F2")
    await sleep(1000);
    click(330,1010) //点击世界权限
    await sleep(1000);
    let domainName = settings.domainName;

    switch (domainName) {
    case "直接加入":
        click(330, 910);
        log.info("权限设置为【直接加入】");
        break;
    case "不允许加入":
        click(330, 850); // 不允许
        log.info("权限设置为【不允许加入】");
        break;
    case "确认后可加入":
        click(330, 960); // 确认后
        log.info("权限设置为【确认后可加入】");
        break;
    default:
        click(330, 850); // 不允许
        log.info("锁门");
        break;    
    }
    await genshin.returnMainUi(); // 结束后回到主界面
})();
