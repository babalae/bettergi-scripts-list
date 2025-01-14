(async function () {



    // 设置游戏运行的分辨率和缩放
    setGameMetrics(1920, 1080, 1);
    //基础延迟
    let delay = settings.delay || 2000;
    //定义合成台and凯瑟琳的选择路径
    let hct_filePath = settings.hsc_selectValue || "枫丹合成台";
    let ksl_filePath = settings.ksl_selectValue || "枫丹凯瑟琳";


    async function hct_AutoPath(locationName) {
        log.info(`即将前往 ${locationName}`);
        try {
            let filePath = `assets/合成台位置/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        log.info(`已到达 ${locationName}`);
    }

    async function ksl_AutoPath(locationName) {
        log.info(`即将前往 ${locationName}`);
        try {
            let filePath = `assets/凯瑟琳位置/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        log.info(`已到达 ${locationName}`);
        // await sleep(2000);
        // if (locationName == "纳塔凯瑟琳")
        //     keyDown("w");
        // await sleep(4500);
        // keyUp("w");
        // keyDown("d");
        // await sleep(2000);
        // keyUp("d");
    }




    // 领取邮件
    setGameMetrics(3840, 2160, 2);
    keyPress("Escape");
    await sleep(1500);
    click(94, 1212);
    // click(50, 605); //1920x1080
    await sleep(1500);
    click(500, 2024);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    // keyPress("Escape");
    log.info("已完成 领取邮件");
    setGameMetrics(1920, 1080, 1);


    // 设置世界权限
    log.info("请确保执行脚本时处于主界面");
    keyPress("VK_F2")
    await sleep(1000);
    click(160, 1020); // 点击世界权限
    await sleep(1000);
    let domainName = settings.domainName;
    switch (domainName) {
        case "不允许加入":
            click(330, 870);
            log.info("权限设置为 不允许加入");
            break;
        case "直接加入":
            click(330, 920);
            log.info("权限设置为 直接加入");
            break;
        case "确认后可加入":
            click(330, 970);
            log.info("权限设置为 确认后可加入");
            break;
        default:
            click(330, 870); // 为空不允许
            log.info("锁门");
            await sleep(2000);
            keyPress("Escape");
            break;
    }


    // 前往_合成台
    await hct_AutoPath(hct_filePath);


    // 合成浓缩树脂
    keyPress("F");
    await sleep(2000);
    click(960, 540);
    await sleep(1000);
    click(960, 540);
    await sleep(1000);
    click(1750, 1010); //点击合成
    await sleep(5000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape"); // 确保完全退出合成
    log.info("已完成 合成浓缩树脂");
    await sleep(2000);

    // 自动秘境
    while (true) {
        try {
            await dispatcher.runTask(new SoloTask("AutoDomain"));
            await sleep(500);
            break;
        } catch (ex) {
            if (ex.message.includes("检测到复苏界面")) {
                log.info("复活后，继续执行自动秘境。");
                continue;
            }
            else {
                // 如果不包含 "检测到复苏界面"，则继续抛出异常
                throw ex;
            }
        }
    }

    if (settings.decomposeDogFood == "是" | settings.decomposeDogFood == undefined) {
        // 分解狗粮
        keyPress("B");
        await sleep(1000);
        click(670, 40);
        await sleep(1000);
        click(660, 1010);
        await sleep(1000);
        click(300, 1020);
        await sleep(500);
        click(300, 380);
        await sleep(50);
        click(300, 300);
        await sleep(50);
        click(300, 220);
        await sleep(50);
        click(300, 150);
        await sleep(500);
        click(340, 1010);
        await sleep(800);
        click(1740, 1020);
        await sleep(800);
        click(1180, 750);
        await sleep(800);
        click(950, 800);
        await sleep(800);
        keyPress("Escape");
        await sleep(1000);
        keyPress("Escape");
        log.info("已完成 分解狗粮");
        await sleep(1000);
    }


    // 前往_凯瑟琳
    await ksl_AutoPath(ksl_filePath);
    await sleep(1000);


    // 领取历练点
    keyPress("F1");
    await sleep(2000);
    click(290, 345);
    await sleep(1000);
    click(1550, 755);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1500);
    click(1670, 235);
    // keyPress("Escape");
    log.info("已完成 领取历练点");
    await sleep(delay);


    // 领取每日委托奖励
    keyPress("F");
    log.info("按下F键");
    await sleep(1000);
    click(960, 540);// 点击坐标(960, 540)(屏幕中心)
    await sleep(1000);
    click(1380, 425);// 点击坐标(1380, 425)(领取「每日委托」奖励)
    await sleep(1000);
    click(960, 540);// 点击坐标(960, 540)(屏幕中心)
    await sleep(2000);
    click(960, 960);// 点击坐标(960, 960)(关闭奖励弹出页面)
    log.info("已完成 领取每日委托奖励");
    await sleep(delay);


    // 重新探索派遣
    keyPress("F");
    await sleep(1800);
    click(960, 540);
    await sleep(1000);
    click(1400, 580);
    await sleep(1000);
    click(160, 1010);
    await sleep(1000);
    click(1160, 1020);
    await sleep(1000);
    keyPress("Escape");
    log.info("已完成 重新探索派遣");
    await sleep(delay);


    // 领取纪行奖励
    keyPress("F4");
    await sleep(1500);
    click(960, 50);
    await sleep(1000);
    click(1720, 980);
    await sleep(1000);
    click(860, 50);
    await sleep(1000);
    click(1720, 980);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    log.info("已完成 领取纪行奖励");
    await sleep(delay);


    // 传送到枫丹凯瑟琳锚点
    await genshin.tp(4515, 3630);
    await sleep(1000);


    //切换队伍
    keyPress("L");
    await sleep(3000);
    click(75, 1020);
    await sleep(200);
    click(700, 115);
    await sleep(200);
    click(700, 115);
    await sleep(300);
    click(75, 200);
    await sleep(800);
    click(75, 1020);
    await sleep(800);
    let tempVar = settings.number || 5;
    if (tempVar < 9) {   // 向右点击
        for (let i = 1; i < tempVar; i++) {
            click(1850, 540);
            await sleep(50);
        }
    } else {    // 向左点击
        tempVar = 16 - tempVar
        for (let i = 0; i < tempVar; i++) {
            click(75, 540);
            await sleep(50);
        }
    }
    click(1555, 1020);
    await sleep(1000);
    keyPress("Escape");
    log.info("已切换至第" + settings.number || 5 + "队");
    await sleep(delay);

    //切换角色
    keyPress("1");
    log.info("已切换至第1个角色");


    // // 向后行走1.5秒
    // keyDown("S");
    // await sleep(1500);
    // keyUp("S");
    // log.info("已完成 向后走1.5秒");
    // await sleep(1000);


    // 进入尘歌壶
    keyPress("B");
    await sleep(1000);
    click(1060, 50);
    await sleep(500);
    click(770, 180);
    await sleep(300);
    click(1690, 1010);
    await sleep(1000);
    keyPress("F");
    await sleep(10000);
    log.info("已完成 进入尘歌壶");


    // // 防止加载卡岩
    // await sleep(3000);
    // log.info("等待防止加载卡岩");


    // 尘歌壶找阿圆
    (async function () {
        // 绘绮庭路径
        const pathingA = async function () {
            keyDown("S");  // 按下 S 键
            await sleep(500); // 等待 500ms
            keyUp("S"); // 松开 S 键
            await sleep(500); // 等待 500ms
            keyDown("S");  // 按下 S 键
            keyDown("A");  // 按下 A 键
            await sleep(2100); // 等待 2100ms
            keyUp("S");  // 松开 S 键
            keyUp("A");  // 松开 A 键
            log.info("绮庭路径执行完毕");
        };
        // 妙香林路径
        const pathingB = async function () {
            keyDown("D"); // 按下 D 键
            await sleep(1500); // 等待 1500ms
            keyUp("D"); // 松开 D 键
            log.info("妙香林路径执行完毕");
        };
        // 黛翠峰&罗浮洞路径
        const pathingC = async function () {
            keyDown("D"); // 按下 D 键
            await sleep(500); // 等待 500ms
            keyUp("D"); // 松开 D 键
            log.info("黛翠峰&罗浮洞路径执行完毕");
        };
        // 清琼岛路径
        const pathingD = async function () {
            keyDown("D");
            await sleep(500);
            keyUp("D");
            log.info("清琼岛路径执行完毕");
        };

        // 读取用户设置
        let path = settings.path !== undefined ? settings.path : ''; // 使用设置的路径
        log.debug(`path: ${path}`);


        // 根据选择的路径执行相应操作，默认执行路径A（绘绮庭路径）
        if (path === '绘绮庭') {
            log.info('开始执行绮庭路径');
            await pathingA(); // 执行绘绮庭路径
        } else if (path === '妙香林') {
            log.info('开始执行妙香林路径');
            await pathingB(); // 执行妙香林路径
        } else if (path === '黛翠峰&罗浮洞') {
            log.info('开始执行黛翠峰&罗浮洞路径');
            await pathingC(); // 执行黛翠峰or罗浮洞路径
        } else if (path === '清琼岛') {
            log.info('开始执行清琼岛路径');
            await pathingD(); // 执行清琼岛路径
        } else {
            log.info('未选择有效路径，执行默认路径D（清琼岛）');
            await pathingD(); // 默认执行路径A（清琼岛）
        }

    })();


    //领取洞天宝钱和好感度
    await sleep(1000);
    keyPress("F");
    await sleep(2000);
    click(1370, 420);
    await sleep(2000);
    click(1370, 420);

    await sleep(800);
    click(1800, 710); //领取好感
    await sleep(200);
    click(1345, 300); //点击x
    await sleep(200);
    click(1080, 960); //领取洞天宝钱
    await sleep(200);
    click(1345, 300); //点击x

    await sleep(500);
    click(1865, 44); //点击右上角x退出
    await sleep(3000);
    click(1300, 800);
    await sleep(1000);
    click(1300, 800);
    log.info("已完成 领取洞天宝钱和好感");
    await sleep(3000);


    //抓晶蝶
    if (settings.catchButterfly == "是" | settings.catchButterfly == undefined) {
        dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));  // 启用自动拾取的实时任务
        log.info('开始捕捉晶蝶，请在队伍中务必携带{zyyy}，使用成男/成女角色', '早柚/瑶瑶');
        async function captureCrystalfly(locationName, x, y, num) {
            log.info('前往 {name}', locationName);
            await genshin.tp(x, y);
            await sleep(1000);
            log.info('尝试捕捉晶蝶, {num}只', num);
            let filePath = `assets/晶蝶位置/${locationName}.json`;
            await keyMouseScript.runFile(filePath);
        }
        await captureCrystalfly('枫丹-塔拉塔海谷', 4328, 3960, 4);
        await captureCrystalfly('枫丹-枫丹廷区', 4822, 3628, 3);
        await captureCrystalfly('枫丹-苍白的遗荣', 4188, 2992, 2);
        await captureCrystalfly('枫丹-幽林雾道', 3376, 3290, 2);
        await captureCrystalfly('枫丹-莫尔泰区', 3810, 2334, 2);
        await captureCrystalfly('枫丹-特别温暖的地方', 4790, 2520, 3);
        await captureCrystalfly('须弥-下风蚀地', 4452, -2456, 3);
    }

    // 结束游戏
    keyDown("MENU");
    keyDown("F4");
    await sleep(50);
    keyUp("MENU");
    keyUp("F4");
    await sleep(1500);

    log.info("已完成 所有内容 结束-Tzi");

})();
