async function main() {

    const today = new Date().getDay();
    const isMonday = today === 1;

    // 检查是否为周一，周三或周六
    if (!isScheduledDay()) {
        log.info("今日非周一，周三或周六，脚本不执行");
        return;
    }
    
    // 检查配置
    checkSettings();

    // 打开背包并切换到小道具
    await openBackpack();

    // 查找并使用尘歌壶
    await findAndUseSereniteaPot();

    // 等待进入尘歌壶
    await waitForEnteringSereniteaPot();

    // 找到阿圆
    await moveToTarget(settings.route);

    // 与阿圆对话
    keyPress("F");
    await sleep(2000);
    click(960, 540);
    await sleep(2000);

    // 领取好感度以及洞天宝钱
    await collectRewards();
    
    if (isMonday) {
        log.info("今天是周一，兑换物品");
        // 兑换物品
        await exchangeItems();
    }

    // 关闭与阿圆的对话
    await sleep(1000)
    click(1360, 800);
    await sleep(1000);
    click(960, 540);

    // 周一执行锻造任务和烹饪任务
    if (isMonday) {
        log.info("今天是周一，执行锻造任务");
        if (settings.forgingRoute) await handleForging();
        log.info("今天是周一，执行烹饪任务");
        if (settings.cookingRoute) await handleCooking();
        keyDown("a");
        await sleep(2000);
        keyUp("a");
    }
}

//============== 烹饪功能 ==============//
async function handleCooking() {
    log.info("开始自动烹饪");
    try {
        // 移动到烹饪点
        await moveToTarget(settings.cookingRoute);
        
        // 执行烹饪操作序列
        keyPress("F"); await sleep(1000);
        click(1695, 1013); await sleep(1000);  // 选择料理台
        click(785, 1015);  await sleep(500);   // 选择自动制作
        click(1018, 452);  await sleep(500);   // 选择制作
        keyPress("2");     await sleep(200);   // 选择数量
        keyPress("0");     await sleep(200);
        click(1159, 755); await sleep(2000);  // 确认制作
        
        // 关闭界面
        for(let i=0; i<3; i++) {
            keyPress("Escape"); await sleep(500);
        }
        log.info("烹饪完成");
    } catch (e) {
        log.info("烹饪失败: " + e.message);
    }
}

//============== 锻造功能 ==============//
async function handleForging() {
    log.info("开始自动锻造");
    try {
        // 移动到锻造点
        await moveToTarget(settings.forgingRoute);
        
        // 执行锻造操作序列
        keyPress("F"); await sleep(1500);
        
        // 完成材料
        for(let i=0; i<6; i++) {
            click(1745, 1019); await sleep(300);
        }
        
        click(217, 152);  await sleep(800);    // 选择条目
        click(546, 288);  await sleep(1000);   // 选择矿产
        
        // 确认锻造
        for(let i=0; i<3; i++) {
            click(1745, 1019); await sleep(300);
        }
        
        keyPress("Escape"); await sleep(1000);    // 关闭界面
        log.info("锻造完成");
    } catch (e) {
        log.info("锻造失败: " + e.message);
    }
}

// 判断当前是否为周一，周三或周六
function isScheduledDay() {
    const today = new Date().getDay(); // 0=周日, 1=周一, ..., 6=周六
    return today === 1 || today === 3 || today === 6; // 周一，周三或周六
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

    // 记录是否跳过领取角色好感和洞天宝钱
    if (settings.skipCharacterReward) {
        log.info("当前配置：不领取角色好感");
    }

    if (settings.skipTreasureReward) {
        log.info("当前配置：不领取洞天宝钱");
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
    if (!settings.skipCharacterReward) {
        log.info("领取角色好感度");
        click(1810, 715);
        await sleep(1000);

        // 关闭洞天赠礼弹窗
        click(1346, 300);
        await sleep(1000);
    } else {
        log.info("根据自定义配置，跳过领取角色好感度");
    }

    // 领取洞天宝钱
    if (!settings.skipTreasureReward) {
        log.info("领取洞天宝钱");
        click(1080, 929);
        await sleep(1000);

        // 关闭洞天财瓮弹窗
        click(1346, 300);
        await sleep(1000);
    } else {
        log.info("根据自定义配置，跳过领取洞天宝钱");
    }

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

async function moveToTarget(routeConfig) {
    if (!routeConfig) return;
    
    const routes = routeConfig.split(',').map(r => r.trim());
    for (const route of routes) {
        const [direction, time] = route.split(' ');
        if (!direction || !time) continue;
        
        keyDown(direction);
        await sleep(parseInt(time));
        keyUp(direction);
        await sleep(500);
    }
}

main();
