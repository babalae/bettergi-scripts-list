async function main() {
    setGameMetrics(1920, 1080, 1);

    // 获取调整后的周几
    const dayOfWeek = getAdjustedDayOfWeek();
    
    // 检查是否需要跳过整个尘歌壶流程
    if (settings.week) {
        const weekArray = validateAndStoreNumbers(settings.week);
        
        if (!weekArray) {
            log.error("周设置格式错误，请使用类似'0,1,3,5,7'的格式（0表示每天运行），将跳过周检查");
        } else if (weekArray.length > 0) {
            // 如果设置了0，表示每天运行，跳过周检查
            if (weekArray.includes(0)) {
                log.info("周设置中包含0，每天运行尘歌壶流程");
            } else if (!weekArray.includes(dayOfWeek)) {
                    log.info(`今天是周 ${dayOfWeek}，不在设置的周 ${settings.week} 中，跳过尘歌壶流程`);
                    return;
            }
        }
    }

    // 解析exchangeWeek设置，判断今天是否兑换物品
    let exchangeWeekArray = [1]; // 默认周一
    if (settings.exchangeWeek) {
        const result = validateAndStoreNumbers(settings.exchangeWeek);
        if (result) {
            exchangeWeekArray = result;
        } else {
            log.error("exchangeWeek设置格式错误，将使用默认值（周一）");
        }
    }
    
    let shouldExchange = false;
    if (exchangeWeekArray.includes(0)) {
        shouldExchange = true;
        log.info("exchangeWeek设置为0，每天兑换物品");
    } else if (exchangeWeekArray.includes(dayOfWeek)) {
        shouldExchange = true;
    }

    // 检查配置
    checkSettings();

    await genshin.returnMainUi();
    await sleep(1000);

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
    
    if (shouldExchange) {
        log.info(`今天是周 ${dayOfWeek}，兑换物品`);
        // 兑换物品
        await exchangeItems();
    }

    // 关闭与阿圆的对话
    await sleep(1000)
    click(1360, 800);
    await sleep(1000);
    click(960, 540);

    // 周N执行锻造任务和烹饪任务
    if (shouldExchange) {
        log.info(`今天是周 ${dayOfWeek}，执行锻造任务`);
        if (settings.forgingRoute) await handleForging();
        log.info(`今天是周 ${dayOfWeek}，执行烹饪任务`);
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

// 获取当前周（考虑00:00~04:00视为前一天）
    function getAdjustedDayOfWeek() {
        const now = new Date();
        let dayOfWeek = now.getDay(); // 0-6 (0是周日)
        const hours = now.getHours();

        // 如果时间在00:00~04:00之间，视为前一天
        if (hours < 4) {
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 前一天
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，视为前一天（周 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
        } else {
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，使用当天（周 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
        }

        // 转换为1-7格式（7代表周日）
        return dayOfWeek === 0 ? 7 : dayOfWeek;
    }

    // 验证周设置格式
    function validateAndStoreNumbers(input) {
        if (!input) return false;
        
        // 去除所有空格
        const cleanedInput = input.replace(/\s/g, '');
        
        // 使用正则表达式检测是否符合期望格式
        const regex = /^([0-7])(,([0-7]))*$/;
        
        // 检测输入字符串是否符合正则表达式
        if (regex.test(cleanedInput)) {
            // 将输入字符串按逗号分割成数组
            const numbers = cleanedInput.split(',');
            return numbers.map(Number);
        } else {
            return false;
        }
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
                targetRegion.dispose();

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
                screen.dispose();
                soldOutRegion.dispose();

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
        screen.dispose();
        targetRegion.dispose();
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
        screen.dispose();
        targetRegion.dispose();

        if (!ocrResult.isEmpty() && ocrResult.Text.includes("尘歌壶")) {
            // 点击指定坐标
            click(1690, 1020);
            await sleep(1000);
            // 检查一下背包页面是否退出了，有可能当前角色状态没法放置尘歌壶，直接再判断一次截图区域文本是不是尘歌壶就行
            let screen2 = captureGameRegion();
            // 根据指定区域进行剪裁
            let targetRegion2 = screen2.DeriveCrop(1307, 119, 493, 55);
            let ocrRo2 = RecognitionObject.Ocr(0, 0, targetRegion2.Width, targetRegion2.Height);
            let ocrResult2 = targetRegion2.find(ocrRo2);
            screen2.dispose();
            targetRegion2.dispose();
            if (!ocrResult2.isEmpty() && ocrResult2.Text.includes("尘歌壶")) {
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
