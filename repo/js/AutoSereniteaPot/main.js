async function main() {
    // 检查配置
    checkSettings();

    // 打开背包并切换到小道具
    await openBackpack();

    // 查找并使用尘歌壶
    await findAndUseSereniteaPot();

    // 等待进入尘歌壶
    await waitForEnteringSereniteaPot();

    // 找到阿圆
    await moveToAYuan();

    // 与阿圆对话
    keyPress("F");
    await sleep(2000);
    click(960, 540);
    await sleep(2000);

    // 领取好感度以及洞天宝钱
    await collectRewards();
    // 兑换物品
    await exchangeItems();

    // 关闭与阿圆的对话
    await sleep(1000)
    click(1360, 800);
    await sleep(1000);
    click(960, 540);
}

async function exchangeItems() {
    if (!settings.itemsToBuy) {
        log.warn("未配置要购买的物品");
        return;
    }

    log.info("开始兑换物品");
    // 点击洞天百宝
    click(1386, 655);
    await sleep(1000);
    // 点击第一个选项卡
    click(712, 50)
    await sleep(1000);

    // 获取用户想要购买的物品列表
    const itemsToBuy = settings.itemsToBuy.split(',').map(item => item.trim());
    log.info(`要购买的物品: ${itemsToBuy.join(', ')}`);

    // 设置固定的坐标
    const firstItemX = 193;
    const firstItemY = 196;
    const xOffset = 168; // 水平方向上的间距
    const yOffset = 190; // 垂直方向上的间距
    const itemsPerRow = 7; // 每行物品数量

    // 临时变量，已找到的物品数组和上一个物品名称变量
    const foundItems = [];
    let lastItemName = "";

    // 遍历所有物品
    outerLoop: for (let row = 0; row < 3; row++) {
        for (let col = 0; col < itemsPerRow; col++) {
            // 计算当前物品中心点坐标
            const centerX = firstItemX + (xOffset * col);
            const centerY = firstItemY + (yOffset * row);

            // 需要重复检查这个位置的物品
            let keepCheckingCurrentPosition = true;

            // 循环检查当前位置的物品，直到不再找到匹配的物品
            while (keepCheckingCurrentPosition) {
                // 点击物品中心
                click(centerX, centerY);
                await sleep(1000);

                // 获取物品详情区域截图
                let screen = captureGameRegion();
                let targetRegion = screen.DeriveCrop(1308, 120, 491, 56);

                // 使用OCR识别物品名称
                let ocrRo = RecognitionObject.Ocr(0, 0, targetRegion.Width, targetRegion.Height);
                let ocrResult = targetRegion.find(ocrRo);

                if (ocrResult.isEmpty()) {
                    throw new Error("无法识别物品名称，请检查具体原因");
                }

                const itemName = ocrResult.Text.trim();
                // 检查是否与上一个物品名称相同
                if (itemName === lastItemName) {
                    break outerLoop;
                } else {
                    lastItemName = itemName;
                }

                // 检查物品是否已售罄
                let soldOutRegion = screen.DeriveCrop(1308, 403, 491, 100);
                let soldOutOcrRo = RecognitionObject.Ocr(0, 0, soldOutRegion.Width, soldOutRegion.Height);
                let soldOutResult = soldOutRegion.find(soldOutOcrRo);

                // 如果发现任何已售罄的物品，就认为所有可购买的物品都已检查过，结束搜索
                log.debug(`识别到的文字: ${soldOutResult.Text}`)
                if (!soldOutResult.isEmpty() && soldOutResult.Text.includes("已售罄")) {
                    break outerLoop;
                }

                // 检查是否是用户想要购买的物品（使用包含关系）
                let matchedItem = itemsToBuy.find(item => itemName.includes(item));

                if (matchedItem) {
                    log.info(`找到要购买的物品: ${itemName} (匹配: ${matchedItem})`);
                    // 记录已找到的物品
                    if (!foundItems.includes(matchedItem)) {
                        foundItems.push(matchedItem);
                    }

                    log.info(`开始购买物品: ${itemName}`);

                    // 执行购买流程
                    // 1. 鼠标移动到起始位置
                    moveMouseTo(1448, 693);
                    await sleep(300);

                    // 2. 按下鼠标左键
                    leftButtonDown();
                    await sleep(300);

                    // 3. 移动到结束位置
                    moveMouseTo(1753, 693);
                    await sleep(300);

                    // 4. 松开鼠标左键
                    leftButtonUp();
                    await sleep(500);

                    // 5. 点击确认按钮
                    click(1698, 1022);
                    await sleep(1000);

                    // 6. 关闭弹窗
                    click(962, 763);
                    await sleep(1000);

                    log.info(`成功购买物品: ${itemName}`);

                    // 检查是否已找到所有物品
                    if (foundItems.length === itemsToBuy.length) {
                        log.info("已找到所有需要购买的物品，提前结束搜索");
                        break outerLoop;
                    }
                } else {
                    // 如果不匹配，不继续检查当前位置
                    keepCheckingCurrentPosition = false;
                }
            }
        }
    }

    // 如果浏览完所有格子后仍有未找到的物品
    const notFound = itemsToBuy.filter(item => !foundItems.includes(item));
    if (notFound.length > 0) {
        log.warn(`浏览完所有物品后，以下物品未找到或已售罄: ${notFound.join(', ')}`);
    }

    // 关闭兑换页面
    await sleep(1000);
    click(1841, 47)
    await sleep(1000);

}

// 检查配置
function checkSettings() {
    if (!settings.route) {
        log.warn("当前未配置进入尘歌壶以后的路线，脚本可能无法正常运行");
    }
}

// 打开背包并切换到小道具
async function openBackpack() {
    keyPress("B");
    await sleep(1000);
    click(1048, 50);
    await sleep(1000);
}

// 查找并使用尘歌壶
async function findAndUseSereniteaPot() {
    await findSereniteaPot();
    await sleep(1000);
    keyPress("F");
}

// 等待进入尘歌壶
async function waitForEnteringSereniteaPot() {
    // 先等待5秒，应该不会比这快
    await sleep(5000);

    // 等待传送完成
    let isEntering = true;
    while (isEntering) {
        let screen = captureGameRegion();
        let targetRegion = screen.DeriveCrop(85, 1025, 69, 28);
        let ocrRo = RecognitionObject.Ocr(0, 0, targetRegion.Width, targetRegion.Height);
        let ocrResult = targetRegion.find(ocrRo);
        if (ocrResult.Text.toLowerCase().includes("enter")) {
            isEntering = false;
        }
        await sleep(1000);
    }

    // 进入尘歌壶以后，等待1秒
    await sleep(1000);
}

// 移动到阿圆并领取奖励
async function collectRewards() {
    log.info("开始领取好感度以及洞天宝钱");

    click(1370, 432);
    await sleep(1000);

    // 领取好感度
    click(1810, 715);
    await sleep(1000);

    // 关闭洞天赠礼弹窗
    click(1346, 300);
    await sleep(1000);

    // 领取洞天宝钱
    click(1080, 929);
    await sleep(1000);

    // 关闭洞天财瓮弹窗
    click(1346, 300);
    await sleep(1000);

    // 关闭对话
    click(1864, 47);
    await sleep(3000);
}

async function findSereniteaPot() {
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
