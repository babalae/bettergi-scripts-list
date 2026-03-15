let notify = settings.notify
let account = settings.userName || "默认账户";
(async function () {
    // 设置分辨率和缩放
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    keyPress("B");//打开背包
    await sleep(1000);
    // 关闭弹窗
    await close_expired_stuff_popup_window();
    let enterAttempts = 0;
    while (enterAttempts < 10) {
        await click(642,36);
        const clicked = await clickPNG("分解",false);
        if (clicked) break; // 找到并点击成功就退出循环
        await sleep(750);
        enterAttempts++;
        await genshin.returnMainUi();
        await sleep(100);
        keyPress("B");
        await sleep(1000);
    }
    await clickPNG("时间顺序",true,1);
    await sleep(200);
    await clickPNG("筛选");
    await sleep(200);
    click(30, 30);
    await sleep(100);
    await clickPNG("重置");
    await sleep(200);
    await clickPNG("祝圣之霜定义");
    await sleep(200);
    await clickPNG("未装备");
    await sleep(200);
    await clickPNG("未锁定");
    await sleep(200);
    await clickPNG("确认");
    await sleep(200);
    click(30, 30);
    await sleep(100);
    const smallBottle = await getBottleCount('背包小瓶', 'assets/RecognitionObject/三星.png');
    const bigBottle = await getBottleCount('背包大瓶', 'assets/RecognitionObject/四星.png');
    await clickPNG("筛选");
    await sleep(200);
    click(30, 30);
    await sleep(100);
    await clickPNG("重置");
    await sleep(200);
    await clickPNG("确认");
    click(30, 30);
    await sleep(100);
    //点击分解
    await clickPNG("分解");
    await sleep(1000);
    // 识别已储存经验（1570-880-1650-930）
    const digits = await numberTemplateMatch("assets/已储存经验数字", 1573, 885, 74, 36);
    let initialValue = 0;
    if (digits >= 0) {
        initialValue = digits;
        log.info(`已储存经验识别成功: ${initialValue}`);
    } else {
        log.warn(`已储存经验值识别失败，使用默认值0`);
    }
    await clickPNG("快速选择");
    await sleep(500);
    // 识别不同星级狗粮数量
    const starPositions = [
        { star: 1, y: 130 },
        { star: 2, y: 200 },
        { star: 3, y: 270 },
        { star: 4, y: 340 }
    ];
    const starCounts = {};
    for (const { star, y } of starPositions) {
        const count = await numberTemplateMatch("assets/选中狗粮数字", 570, y, 60, 50);
        if (count < 0) {
            log.warn(`在${star}星狗粮位置未识别到有效数字`);
            starCounts[`star${star}`] = 0; // 设置默认值为0
        }else{
            starCounts[`star${star}`] = count;
            log.info(`${star}星狗粮识别到${count}个`);
        }
    }
    // 计算狗粮经验值
    const expStar1 = starCounts.star1 * 420;
    const expStar2 = starCounts.star2 * 840;
    const expStar3 = starCounts.star3 * 1260;
    const expStar4 = starCounts.star4 * 2520;
    const expStars = expStar1 + expStar2 + expStar3 + expStar4;
    // 库存经验值
    const expSmall = parseInt(smallBottle || 0) * 2500;
    const expBig = parseInt(bigBottle || 0) * 10000;
    const expStock = expSmall + expBig + initialValue;
    // 合计
    const totalExp = expStars + expStock;
    const totalCount = starCounts.star1 + starCounts.star2 + starCounts.star3 + starCounts.star4;
    
    // 预计算所有需要格式化的值
    const formattedExpStar1 = await formatExp(expStar1);
    const formattedExpStar2 = await formatExp(expStar2);
    const formattedExpStar3 = await formatExp(expStar3);
    const formattedExpStar4 = await formatExp(expStar4);
    const formattedExpStars = await formatExp(expStars);
    const formattedExpSmall = await formatExp(expSmall);
    const formattedExpBig = await formatExp(expBig);
    const formattedExpStock = await formatExp(expStock);
    const formattedTotalExp = await formatExp(totalExp);

    // 记录保存功能
    const userName = await getUserName();
    const recordPath = `assets/${userName}.txt`;
    
    // 构建通知消息
    let message = `📦 圣遗物经验统计\n`;
    message += `👤 账户名：${userName}\n`;;
    message += `\n`;
    message += `📊 [狗粮数量统计]\n`;
    message += `📦 总数量：${totalCount} 个\n`;
    message += `⭐ 1星：${starCounts.star1} 个${expStar1 > 0 ? `（${formattedExpStar1}）` : ''}\n`;
    message += `⭐ 2星：${starCounts.star2} 个${expStar2 > 0 ? `（${formattedExpStar2}）` : ''}\n`;
    message += `⭐ 3星：${starCounts.star3} 个${expStar3 > 0 ? `（${formattedExpStar3}）` : ''}\n`;
    message += `⭐ 4星：${starCounts.star4} 个${expStar4 > 0 ? `（${formattedExpStar4}）` : ''}\n`;
    message += `💰 狗粮经验合计：${formattedExpStars}\n`;
    message += `\n`;
    message += `🧪 [经验瓶数量]\n`;
    message += `🧪 小经验瓶：${smallBottle || 0} 个${expSmall > 0 ? `（${formattedExpSmall}）` : ''}\n`;
    message += `🧪 大经验瓶：${bigBottle || 0} 个${expBig > 0 ? `（${formattedExpBig}）` : ''}\n`;
    message += `💰 库存经验合计：${formattedExpStock}（含储存${initialValue}点）\n`;
    message += `\n`;
    message += `✨ 总经验：${formattedTotalExp}\n`;
    
    // 获取本地保存的数据
    const localData = await getLocalData(recordPath);
    
    // 更新记录
    await updateRecord(recordPath, initialValue, parseInt(smallBottle || 0), parseInt(bigBottle || 0), starCounts, totalExp);
    
    // 构建基础日志信息
    const formattedExpStarsLog = await formatExp(expStars);
    const formattedExpSmallLog = await formatExp(expSmall);
    const formattedExpBigLog = await formatExp(expBig);
    const formattedExpStockLog = await formatExp(expStock);
    const formattedTotalExpLog = await formatExp(totalExp);
    const baseLog = `狗粮:${totalCount}个(1★${starCounts.star1} 2★${starCounts.star2} 3★${starCounts.star3} 4★${starCounts.star4}) | 狗粮经验:${formattedExpStarsLog} | 小瓶:${formattedExpSmallLog} 大瓶:${formattedExpBigLog} 储存:${initialValue} | 库存经验:${formattedExpStockLog} | 总计:${formattedTotalExpLog}`;

    // 计算变化量并添加到通知消息
    let logMessage = baseLog;
    if (localData.initialized.initialValue && localData.initialized.smallBottle && localData.initialized.bigBottle && 
        localData.initialized.star1 && localData.initialized.star2 && localData.initialized.star3 && localData.initialized.star4 &&
        localData.initialized.totalExp) {
        // 计算本地记录中的狗粮经验合计
        const localExpStar1 = localData.starCounts.star1 * 420;
        const localExpStar2 = localData.starCounts.star2 * 840;
        const localExpStar3 = localData.starCounts.star3 * 1260;
        const localExpStar4 = localData.starCounts.star4 * 2520;
        const localExpStars = localExpStar1 + localExpStar2 + localExpStar3 + localExpStar4;
        
        // 计算总经验和狗粮经验合计的变化
        const diffTotalExp = totalExp - localData.totalExp;
        const diffExpStars = expStars - localExpStars;
        
        // 添加变化量到通知消息
        message += `\n`;
        if (diffTotalExp !== 0 || diffExpStars !== 0) {
            if (diffTotalExp !== 0) {
                const totalChangeDesc = diffTotalExp > 0 ? '增加' : '减少';
                const formattedDiffTotalExp = await formatExp(Math.abs(diffTotalExp));
                message += `📈 总经验${totalChangeDesc}：${formattedDiffTotalExp}\n`;
            }
            if (diffExpStars !== 0) {
                const expStarsChangeDesc = diffExpStars > 0 ? '增加' : '减少';
                const formattedDiffExpStars = await formatExp(Math.abs(diffExpStars));
                message += `🐶 未分解的狗粮经验${expStarsChangeDesc}：${formattedDiffExpStars}`;
            }
        } else {
            // 如果没有变化，输出不变
            message += `📊 经验数据无变化`;
        }
        
        // 构建完整日志（包含变化信息）
        if (diffTotalExp !== 0 || diffExpStars !== 0) {
            const totalChangeDesc = diffTotalExp > 0 ? '增加' : '减少';
            const expStarsChangeDesc = diffExpStars > 0 ? '增加' : '减少';
            const formattedDiffTotalExpLog = await formatExp(Math.abs(diffTotalExp));
            const formattedDiffExpStarsLog = await formatExp(Math.abs(diffExpStars));
            logMessage = `总经验${totalChangeDesc}：${formattedDiffTotalExpLog} | 狗粮经验${expStarsChangeDesc}：${formattedDiffExpStarsLog} | ${baseLog}`;
        } else {
            // 如果没有变化，日志也显示不变
            logMessage = `经验数据无变化 | ${baseLog}`;
        }
    }
    if (settings.notify) {
        notification.send(message);
    }
    log.info(logMessage);
    await genshin.returnMainUi();

    // 格式化经验值显示
    async function formatExp(num) {
        if (num >= 10000) {
            // 直接除法并转换为字符串，保留所有有效小数
            return `${(num / 10000).toString()}万`;
        } else {
            return `${num}`;
        }
    }
     /**
     * 在指定区域内，用 0-9 的 PNG 模板做「多阈值 + 非极大抑制」数字识别，
     * 最终把检测到的数字按左右顺序拼成一个整数返回。
     *
     * @param {string}  numberPngFilePath - 存放 0.png ~ 9.png 的文件夹路径（不含文件名）
     * @param {number}  x                 - 待识别区域的左上角 x 坐标，默认 0
     * @param {number}  y                 - 待识别区域的左上角 y 坐标，默认 0
     * @param {number}  w                 - 待识别区域的宽度，默认 1920
     * @param {number}  h                 - 待识别区域的高度，默认 1080
     * @param {number}  maxThreshold      - 模板匹配起始阈值，默认 0.95（最高可信度）
     * @param {number}  minThreshold      - 模板匹配最低阈值，默认 0.8（最低可信度）
     * @param {number}  splitCount        - 在 maxThreshold 与 minThreshold 之间做几次等间隔阈值递减，默认 3
     * @param {number}  maxOverlap        - 非极大抑制时允许的最大重叠像素，默认 2；只要 x 或 y 方向重叠大于该值即视为重复框
     *
     * @returns {number} 识别出的整数；若没有任何有效数字框则返回 -1
     *
     * @example
     * const mora = await numberTemplateMatch('摩拉数字', 860, 70, 200, 40);
     * if (mora >= 0) console.log(`当前摩拉：${mora}`);
     */
    async function numberTemplateMatch(
        numberPngFilePath,
        x = 0, y = 0, w = 1920, h = 1080,
        maxThreshold = 0.95,
        minThreshold = 0.8,
        splitCount = 3,
        maxOverlap = 2
    ) {
        let ros = [];
        for (let i = 0; i <= 9; i++) {
            ros[i] = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(`${numberPngFilePath}/${i}.png`), x, y, w, h);
        }

        function setThreshold(roArr, newThreshold) {
            for (let i = 0; i < roArr.length; i++) {
                roArr[i].Threshold = newThreshold;
                roArr[i].InitTemplate();
            }
        }

        const gameRegion = captureGameRegion();
        const allCandidates = [];

        /* 1. splitCount 次等间隔阈值递减 */
        try{
            for (let k = 0; k < splitCount; k++) {
                const curThr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
                setThreshold(ros, curThr);
            /* 2. 0-9 每个模板跑一遍，所有框都收 */
            for (let digit = 0; digit <= 9; digit++) {
                const res = gameRegion.findMulti(ros[digit]);
                if (res.count === 0) continue;
                for (let i = 0; i < res.count; i++) {
                    const box = res[i];
                    allCandidates.push({
                        digit: digit,
                        x: box.x,
                        y: box.y,
                        w: box.width,
                        h: box.height,
                        thr: curThr
                        });
                    }
                }
            }
        }finally {
            gameRegion.dispose();
        }

        /* 3. 无结果提前返回 -1 */
        if (allCandidates.length === 0) {
            return -1;
        }

        /* 4. 非极大抑制（必须 x、y 两个方向重叠都 > maxOverlap 才视为重复） */
        const adopted = [];
        for (const c of allCandidates) {
            let overlap = false;
            for (const a of adopted) {
                const xOverlap = Math.max(0, Math.min(c.x + c.w, a.x + a.w) - Math.max(c.x, a.x));
                const yOverlap = Math.max(0, Math.min(c.y + c.h, a.y + a.h) - Math.max(c.y, a.y));
                if (xOverlap > maxOverlap && yOverlap > maxOverlap) {
                    overlap = true;
                    break;
                }
            }
            if (!overlap) {
                adopted.push(c);
                //log.info(`在 [${c.x},${c.y},${c.w},${c.h}] 找到数字 ${c.digit}，匹配阈值=${c.thr}`);
            }
        }

        /* 5. 按 x 排序，拼整数；仍无有效框时返回 -1 */
        if (adopted.length === 0) return -1;
        adopted.sort((a, b) => a.x - b.x);

        return adopted.reduce((num, item) => num * 10 + item.digit, 0);
    }

    async function clickPNG(png, doClick = true, maxAttempts = 40, Threshold = 0.9) {
        const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
        pngRo.Threshold = Threshold;
        pngRo.InitTemplate();
        return await findAndClick(pngRo, maxAttempts, doClick);
    }

    async function findAndClick(target, maxAttempts = 20, doClick) {
        //log.info("调试-开始检查");
        for (let i = 0; i < maxAttempts; i++) {
            //log.info("调试-检查一次");
            const rg = captureGameRegion();
            try {
                const res = rg.find(target);
                if (res.isExist()) { if (doClick) await sleep(16), res.click(), await sleep(50); return true; }
            } finally { rg.dispose(); }
            if (i < maxAttempts - 1) await sleep(50);
        }
        return false;
    }

    // 检验账户名
    async function getUserName() {
        userName = userName.trim();
        // 账户名规则：数字、中英文，长度1-20字符
        if (!userName || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(userName)) {
            log.error(`账户名${userName}违规，暂时使用默认账户名，请查看readme后修改`)
            userName = "默认账户";
        }
        return userName;
    }

    async function close_expired_stuff_popup_window() {
        const game_region = captureGameRegion();
        const text_x = 850;
        const text_y = 273;
        const text_w = 225;
        const text_h = 51;
        const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));
        if (ocr_res) {
            if (ocr_res.text.includes("物品过期")) {
                log.info("检测到物品过期");
                click(1000, 750);
                await sleep(1000);
            }
        }
        game_region.dispose();
    }
    /**
     * 识别背包中指定物品的数量
     * @param {string} itemName - 物品名称（仅用于日志）
     * @param {string} templatePath - 模板图片路径
     * @returns {Promise<string>} 识别到的数字字符串（可能为空）
     */
    async function getBottleCount(itemName, templatePath) {
        const ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(templatePath));
        ro.InitTemplate();
        for (let i = 0; i < 5; i++) {
            const rg = captureGameRegion();
            try {
                const res = rg.find(ro);
                if (res.isExist()) {
                    const regionToCheck = { x: res.x, y: res.y + 20, width: 70, height: 20 };
                    // 使用numberTemplateMatch函数识别数字
                    const count = await numberTemplateMatch(
                        'assets/背包数字', // 数字模板文件夹路径
                        regionToCheck.x, regionToCheck.y, regionToCheck.width, regionToCheck.height
                    );
                    const digits = count === -1 ? '' : count.toString();
                    log.info(`识别到${itemName}数量为${digits}`);
                    //log.info(`识别到${itemName}识别区域为${regionToCheck.x}, ${regionToCheck.y}, ${regionToCheck.width}, ${regionToCheck.height}`)
                    return digits; // 成功识别即返回
                }
            } finally {
                rg.dispose();
            }
            if (i < 5 - 1) await sleep(50);
        }
        return ''; // 未找到时返回空字符串
    }

    // 检验账户名
    async function getUserName() {
        account = account.trim();
        // 账户名规则：数字、中英文，长度1-20字符
        if (!account || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(account)) {
            log.error(`账户名${account}违规，暂时使用默认账户名，请查看readme后修改`)
            account = "默认账户";
        }
        return account;
    }

    /**
     * 获取本地记录中最新的一组数据
     * @param {string} filePath - 记录文件路径
     * @returns {Promise<object>} 包含经验数据的对象
     */
    async function getLocalData(filePath) {
        // 初始化返回结果
        const result = {
            initialValue: null,
            smallBottle: null,
            bigBottle: null,
            starCounts: {
                star1: null,
                star2: null,
                star3: null,
                star4: null
            },
            totalExp: null,
            initialized: {
                initialValue: false,
                smallBottle: false,
                bigBottle: false,
                star1: false,
                star2: false,
                star3: false,
                star4: false,
                totalExp: false
            }
        };

        try {
            // 尝试读取文件，不存在则直接返回空结果
            const content = await file.readText(filePath);
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) return result;

            // 数据匹配正则
            const initialValueRegex = /已储存经验-(\d+)/;
            const smallBottleRegex = /小经验瓶-(\d+)/;
            const bigBottleRegex = /大经验瓶-(\d+)/;
            const star1Regex = /1星狗粮-(\d+)/;
            const star2Regex = /2星狗粮-(\d+)/;
            const star3Regex = /3星狗粮-(\d+)/;
            const star4Regex = /4星狗粮-(\d+)/;
            const totalExpRegex = /总经验-(\d+)/;

            // 遍历前几条记录，寻找最新的一组完整数据
            for (const line of lines) {
                // 匹配已储存经验
                if (!result.initialized.initialValue) {
                    const match = line.match(initialValueRegex);
                    if (match) {
                        result.initialValue = parseInt(match[1]);
                        result.initialized.initialValue = true;
                    }
                }

                // 匹配小经验瓶
                if (!result.initialized.smallBottle) {
                    const match = line.match(smallBottleRegex);
                    if (match) {
                        result.smallBottle = parseInt(match[1]);
                        result.initialized.smallBottle = true;
                    }
                }

                // 匹配大经验瓶
                if (!result.initialized.bigBottle) {
                    const match = line.match(bigBottleRegex);
                    if (match) {
                        result.bigBottle = parseInt(match[1]);
                        result.initialized.bigBottle = true;
                    }
                }

                // 匹配1星狗粮
                if (!result.initialized.star1) {
                    const match = line.match(star1Regex);
                    if (match) {
                        result.starCounts.star1 = parseInt(match[1]);
                        result.initialized.star1 = true;
                    }
                }

                // 匹配2星狗粮
                if (!result.initialized.star2) {
                    const match = line.match(star2Regex);
                    if (match) {
                        result.starCounts.star2 = parseInt(match[1]);
                        result.initialized.star2 = true;
                    }
                }

                // 匹配3星狗粮
                if (!result.initialized.star3) {
                    const match = line.match(star3Regex);
                    if (match) {
                        result.starCounts.star3 = parseInt(match[1]);
                        result.initialized.star3 = true;
                    }
                }

                // 匹配4星狗粮
                if (!result.initialized.star4) {
                    const match = line.match(star4Regex);
                    if (match) {
                        result.starCounts.star4 = parseInt(match[1]);
                        result.initialized.star4 = true;
                    }
                }

                // 匹配总经验
                if (!result.initialized.totalExp) {
                    const match = line.match(totalExpRegex);
                    if (match) {
                        result.totalExp = parseInt(match[1]);
                        result.initialized.totalExp = true;
                    }
                }

                // 所有数据都找到，提前终止遍历
                if (result.initialized.initialValue && 
                    result.initialized.smallBottle && 
                    result.initialized.bigBottle && 
                    result.initialized.star1 && 
                    result.initialized.star2 && 
                    result.initialized.star3 && 
                    result.initialized.star4 &&
                    result.initialized.totalExp) {
                    break;
                }
            }
            return result;
        } catch (error) {
            // 文件不存在或读取错误时返回空结果
            return result;
        }
    }

    /**
     * 更新记录文件
     * @param {string} filePath - 记录文件路径
     * @param {number} initialValue - 已储存经验
     * @param {number} smallBottle - 小经验瓶数量
     * @param {number} bigBottle - 大经验瓶数量
     * @param {object} starCounts - 狗粮数量
     * @param {number} totalExp - 总经验值
     */
    async function updateRecord(filePath, initialValue, smallBottle, bigBottle, starCounts, totalExp) {
        // 生成当前时间字符串
        const now = new Date();
        const timeStr = `${now.getFullYear()}/${
            String(now.getMonth() + 1).padStart(2, '0')
        }/${
            String(now.getDate()).padStart(2, '0')
        } ${
            String(now.getHours()).padStart(2, '0')
        }:${
            String(now.getMinutes()).padStart(2, '0')
        }:${
            String(now.getSeconds()).padStart(2, '0')
        }`;

        // 生成记录
        const records = [
            `时间:${timeStr}-已储存经验-${initialValue}`,
            `时间:${timeStr}-小经验瓶-${smallBottle}`,
            `时间:${timeStr}-大经验瓶-${bigBottle}`,
            `时间:${timeStr}-1星狗粮-${starCounts.star1}`,
            `时间:${timeStr}-2星狗粮-${starCounts.star2}`,
            `时间:${timeStr}-3星狗粮-${starCounts.star3}`,
            `时间:${timeStr}-4星狗粮-${starCounts.star4}`,
            `时间:${timeStr}-总经验-${totalExp}`
        ];

        try {
            let content = await file.readText(filePath);
            let lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                // 文件为空，直接写入新记录
                await file.writeText(filePath, records.join('\n'));
                return true;
            }



            // 添加新记录到最前面
            lines.unshift(...records);

            // 只保留1年内的记录
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const recentLines = lines.filter(line => {
                const timeMatch = line.match(/时间:(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
                if (!timeMatch) return false;
                const lineTime = new Date(timeMatch[1]);
                return lineTime >= oneYearAgo;
            });

            // 写入文件
            await file.writeText(filePath, recentLines.join('\n'));
            return true;
        } catch (error) {
            // 文件不存在时创建新文件
            await file.writeText(filePath, records.join('\n'));
            return true;
        }
    }
})();