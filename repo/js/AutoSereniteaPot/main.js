async function main() {
    // 先提示一下一般都需要配置移动路线
    if (!settings.route) {
        log.warn("当前未配置进入尘歌壶以后的路线，脚本可能无法正常运行");
    }

    // 打开背包
    keyPress("B");
    await sleep(1000);

    // 点击小道具选项卡(1048,50)
    click(1048, 50);
    await sleep(1000);

    // 查找并点击尘歌壶
    await findSereniteaPot();
    await sleep(1000);

    // 进入尘歌壶，等待加载动画
    keyPress("F");
    let waitTime = settings.loadingWaitTime;
    if (!waitTime) {
        waitTime = 10;
    }
    await sleep(waitTime * 1000);

    // 移动到阿圆
    await moveToAYuan();
    log.info("开始领取好感度以及洞天宝钱");

    // 按下 F
    keyPress("F");
    await sleep(2000);
    // 点击屏幕中间跳过对话
    click(960, 540);
    await sleep(1000);
    // 点击“信任等阶”
    click(1370, 432)
    await sleep(1000);
    // 领取好感
    click(1810, 715)
    await sleep(1000);
    // 如果弹出“洞天赠礼”，把它关闭
    click(1346, 300)
    await sleep(1000);
    // 领取洞天宝钱
    click(1080, 929)
    await sleep(1000);
    // 如果弹出“洞天财瓮”，把它关闭
    click(1346, 300)
    await sleep(1000);
    // 点击右上角的X
    click(1864, 47)
    await sleep(3000);
    // 点击“再见。”
    click(1360, 800)
    await sleep(1000);
    // 点击屏幕中间跳过对话
    click(960, 540);
}

async function findSereniteaPot() {
    let found = false;
    let currentX = 178; // 起始X坐标
    let searchCount = 0; // 添加查找次数计数器
    const MAX_SEARCH_COUNT = 5; // 最大查找次数

    while (searchCount < MAX_SEARCH_COUNT) {
        searchCount++;
        // 点击当前坐标的小道具
        click(currentX, 188);
        await sleep(1000);

        // 获取游戏区域截图
        let screen = captureGameRegion();

        // 根据指定区域进行剪裁
        let targetRegion = screen.DeriveCrop(1307, 119, 493, 55);

        // 使用OCR识别
        let ocrRo = RecognitionObject.Ocr(0, 0, targetRegion.Width, targetRegion.Height);
        let ocrResult = targetRegion.find(ocrRo);

        if (!ocrResult.isEmpty() && ocrResult.Text.includes("尘歌壶")) {
            found = true;
            // 点击指定坐标
            click(1690, 1020);
            await sleep(1000);
            // 检查一下背包页面是否退出了，有可能当前角色状态没法放置尘歌壶，直接再判断一次截图区域文本是不是尘歌壶就行
            let screen = captureGameRegion();
            // 根据指定区域进行剪裁
            let targetRegion = screen.DeriveCrop(1307, 119, 493, 55);
            let ocrRo = RecognitionObject.Ocr(0, 0, targetRegion.Width, targetRegion.Height);
            let ocrResult = targetRegion.find(ocrRo);
            if (!ocrResult.isEmpty() && ocrResult.Text.includes("尘歌壶")) {
                throw new Error("当前无法放置尘歌壶，请检查具体原因");
            }
            return;
        } else {
            currentX += 145; // 向右移动145像素，查找下一个格子的小道具
            await sleep(100);
        }
    }

    throw new Error(`查找尘歌壶次数超过${MAX_SEARCH_COUNT}次，请检查背包是否存在尘歌壶`);
}

async function moveToAYuan() {
    const userRoute = settings.route;
    if (!userRoute) {
        return
    }

    // 解析路径配置
    const routes = userRoute.split(',').map(route => route.trim());

    for (const route of routes) {
        const [direction, time] = route.split(' ');

        if (!direction || !time) {
            log.error("路径格式错误: {route}", route);
            continue;
        }

        // 执行移动
        keyDown(direction);
        await sleep(parseInt(time));
        keyUp(direction);
        await sleep(500);
    }
}

main();