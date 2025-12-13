(async function () {
    // 定义文件路径数组，直接包含完整的文件路径
    const pathingA = [
        "json/合成台/合成台_枫丹.json" // 枫丹合成台路径文件
    ];

    const pathingB = [
        "json/冒险家协会/冒险家协会_枫丹.json" // 枫丹冒险家协会路径文件
    ];

    // 定义一个运行单个文件的方法
    async function runFile(filePath) {
        try {
            // 日志：打印当前正在执行的文件路径
            log.info(`Executing file: ${filePath}`);
            // 调用路径脚本的 `runFile` 方法，执行路径文件
            await pathingScript.runFile(filePath);
        } catch (error) {
            // 如果执行文件时发生错误，打印错误日志
            log.error(`Error executing file: ${filePath} - ${error}`);
        }
    }

    // 定义批量执行文件的函数
    async function batch(files) {
        for (let filePath of files) {
            await runFile(filePath); // 执行每个文件
        }
    }

    // 主函数，控制路径A的执行流程
    async function mainA() {
        // 设置游戏运行的分辨率和缩放
        setGameMetrics(1920, 1080, 1);

        // 日志：开始执行路径A的任务
        log.info("开始执行合成台任务");
        // 批量执行路径A中的文件
        await batch(pathingA);

        // 日志：完成路径A的任务
        log.info("合成台任务执行完成");
    }

    // 主函数，控制路径B的执行流程
    async function mainB() {
        // 设置游戏运行的分辨率和缩放
        setGameMetrics(1920, 1080, 1);

        // 日志：开始执行路径B的任务
        log.info("开始执行冒险家协会任务");
        // 批量执行路径B中的文件
        await batch(pathingB);

        // 日志：完成路径B的任务
        log.info("冒险家协会任务执行完成");
    }

    await genshin.returnMainUi();
   //0、设置不可加入
    log.info("请确保执行脚本时处于主界面");
    
    keyPress("VK_F2")
    await sleep(1000);
    click(330,1010);//点击世界权限
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
        await sleep(2000);
        keyPress("Escape");
        break;
}

    // 1、前往_枫丹_合成台
    await mainA(); // 执行合成台任务

    // 2、合成浓缩树脂
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
   keyPress("1");
   await sleep(5000);
    keyPress("F");
    await sleep(3000);
    click(960, 540);
    await sleep(1000);
    click(960, 540);
    await sleep(1000);
    click(1750, 1010);
    await sleep(5000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    log.info("已完成合成浓缩树脂");

    // 3、领取历练点
    setGameMetrics(3840, 2160, 2);
    await sleep(1600);
    keyPress("F1");
    await sleep(1600);
    click(580, 680);
    await sleep(1000);
    click(3110, 1508);
    await sleep(1000);
    click(3110, 1508);
    await sleep(1500);
    keyPress("Escape");
    log.info("已领取历练点");

    // 4、前往_枫丹_冒险家协会
    await mainB(); // 执行冒险家协会任务

    // 5、领取每日委托奖励
    setGameMetrics(1920, 1080, 2);
    keyPress("1");
   await sleep(5000);
    keyPress("F");
    log.info("按下F键");
    await sleep(1800);
    log.info("等待1秒");
    click(960, 540);
    log.info("点击坐标(960, 540)(屏幕中心)");
    await sleep(2000);
    log.info("等待1秒");
    click(1380, 425);
    log.info("点击坐标(1380, 425)(领取「每日委托」奖励)");
    await sleep(2000);
    log.info("等待1秒");
    click(960, 540);
    log.info("点击坐标(960, 540)(屏幕中心)");
    await sleep(3000);
    log.info("等待3秒");
    click(960, 960);
    log.info("点击坐标(960, 960)(关闭奖励弹出页面)");
    log.info("结束");

    // 6、等待5秒
    setGameMetrics(1920, 1080, 2);
    await sleep(6000); // 转换时间单位，从20ms到秒
    log.info("等待了5秒");

    // 7、重新探索派遣
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("F");
    await sleep(3500);
    click(960, 540);
    await sleep(1000);
    click(1400, 580);
    await sleep(1000);
    click(160, 1010);
    await sleep(1000);
    click(1160, 1020);
    await sleep(1000);
    keyPress("Escape");
    log.info("重新探索派遣完成");

    // 8、领取纪行奖励
    setGameMetrics(3840, 2160, 2);
    await sleep(1600);
    keyPress("F4");
    await sleep(1500);
    click(1920, 100);
    await sleep(1000);
    click(3480, 1948);
    await sleep(1000);
    click(3480, 1948);
    await sleep(1000);
    click(1726, 192);
    await sleep(1000);
    click(3480, 1948);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    log.info("已领取纪行奖励");

    // 9、领取邮件
    setGameMetrics(3840, 2160, 2);
    await sleep(1600);
    keyPress("Escape");
    await sleep(1500);
    click(94, 1212);
    await sleep(1500);
    click(500, 2024);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    log.info("已领取邮件");

    // 10、向后行走1.5秒
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyDown("S");
    await sleep(1500);
    keyUp("S");
    log.info("已进入向后走1.5秒");
   
    //11、进入尘歌壶
    keyPress("B");
    await sleep(3000); 
    click(1060, 50); 
    await sleep(3000); 
    click(770, 180);
    await sleep(3000); 
    click(1690, 1010);
    await sleep(3000); 
    keyPress("F");
    await sleep(10000); 
    log.info("已进入尘歌壶");

    //等待3秒
    await sleep(7000); 
    log.info("等待3秒防止加载卡岩");

    //12、尘歌壶找阿圆
   (async function () {
        await sleep(3000); 
    // 绘绮庭路径
    const pathingA = async function() {
        keyDown("S");  // 按下 S 键
        await sleep(500); // 等待 500ms
        keyUp("S"); // 松开 S 键
        await sleep(500); // 等待 500ms
        keyDown("S");  // 按下 S 键
        keyDown("A");  // 按下 A 键
        await sleep(2100); // 等待 2100ms
        keyUp("S");  // 松开 S 键
        keyUp("A");  // 松开 A 键
        log.info("绮庭路径执行完毕"); // 输出日志
    };

    // 妙香林路径
    const pathingB = async function() {
        keyDown("D"); // 按下 D 键
        await sleep(1500); // 等待 1500ms
        keyUp("D"); // 松开 D 键
        log.info("妙香林路径执行完毕"); // 输出日志
    };

    // 黛翠峰&罗浮洞路径
    const pathingC = async function() {
        keyDown("D"); // 按下 D 键
        await sleep(500); // 等待 500ms
        keyUp("D"); // 松开 D 键
        log.info("黛翠峰&罗浮洞路径执行完毕"); // 输出日志
    };

    // 清琼岛路径
    const pathingD = async function() {
        keyDown("A");  // 按下 A 键
        await sleep(1500); // 等待 1500ms
        keyUp("A"); // 松开 A 键
        log.info("清琼岛路径执行完毕"); // 输出日志
    };

    // 读取用户设置
    let path = settings.path !== undefined ? settings.path : ''; // 使用设置的路径

    log.debug(`path: ${path}`);

    // 主逻辑
    setGameMetrics(1920, 1080, 1);

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
    } else if (path === '自动') {
        log.info('自动选择路径，执行路径A（绘绮庭）');
        await pathingA(); // 自动执行绮庭路径
    } else {
        log.info('未选择有效路径，执行默认路径A（绘绮庭）');
        await pathingA(); // 默认执行路径A（绘绮庭）
    }

})();

    //领取洞天宝钱和好感度
    await sleep(10000); 
    keyPress("F");
    await sleep(2000); 
    click(1370, 420); 
    await sleep(2000); 
    click(1370, 420); 
    await sleep(2000); 
    click(1800, 710);
    await sleep(2000); 
    click(1080, 960);
    await sleep(2000); 
    click(1865, 44);
    await sleep(2800); 
    click(1480, 799);
    log.info("已领取洞天宝钱和好感");

})();
