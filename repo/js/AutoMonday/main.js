(async function () {
    // ===== 1. 预处理部分 =====

    // 人机验证
    if (!settings.ifCheck) { log.error("请阅读readme文件并做好相关设置后再运行此脚本！"); return; }

    //初始化配置
    var TEAM;
    var Material = settings.Material;
    const actiontime = 180;//最大等待时间，单位秒
    const BH = `assets/RecognitionObject/${Material}.png`;
    const ZHIBIANYI = "assets/RecognitionObject/zhibian.png";
    const CHA = "assets/RecognitionObject/cha.png";
    const ifAkf = settings.ifAkf;
    const chargingMethod = settings.chargingMethod;
    const ifCooking = settings.ifCooking;
    const ifduanZao = settings.ifduanZao;
    const ifShouling = settings.ifShouling;
    const ifMijing = settings.ifMijing;
    const ifbuyNet = settings.ifbuyNet;
    const ifbuyTzq = settings.ifbuyTzq;
    const ifZBY = settings.ifZBY;
    const ifYB = settings.ifYB;
    const food = settings.food; // 要烹饪的食物
    const cookCount = settings.cookCount;//烹饪数量
    const mineral = settings.mineral;// 矿石种类
    const mineralFile = `assets/RecognitionObject/${mineral}.png`;// 矿石模板路径
    const BossPartyName = settings.BossPartyName;// 战斗队伍
    let mijingCount = 1;// 自动秘境计数
    // OCR对象用于检测战斗文本
    const ocrRo2 = RecognitionObject.Ocr(0, 0, 1920, 1080);

    // 创建材质到ITEM的映射表
    // 养成道具=1，食物=2，材料=3
    const materialToItemMap = {
        "牛角": 1,
        "苹果": 2, "日落果": 2, "泡泡桔": 2,
        "白铁块": 3, "水晶块": 3, "薄荷": 3, "菜": 3,
        "鸡腿": 3, "蘑菇": 3, "鸟蛋": 3, "兽肉": 3, "甜甜花": 3
    };

    // 直接通过映射获取ITEM值（未匹配时默认0）
    const ITEM = materialToItemMap[Material] || 0;

    if (chargingMethod == "法器角色充能" && settings.TEAMname === undefined) {
        log.error("您选择了法器角色充能，请在配置页面填写包含法器角色的队伍名称！！！");
        return;// 没选就报错后停止
    }
    //检查用户是否配置队伍
    if (ifAkf && settings.TEAMname === undefined) {
        log.error("您选择了拥有爱可菲，请在配置页面填写包含爱可菲的队伍名称！！！");
        return;// 没选就报错后停止
    }

    TEAM = settings.TEAMname;

    const username = settings.username || "默认账户";
    const cdRecordPath = `record/${username}_cd.txt`;// 修改CD记录文件路径，包含用户名

    // 定义任务列表
    const tasks = [
        { condition: ifZBY, func: autoZhibian, name: "质变仪" },
        { condition: ifYB, func: Jingdie, name: "晶蝶诱捕装置" },
        { condition: ifCooking, func: Cooking, name: "做菜" },
        { condition: ifduanZao, func: duanZao, name: "锻造" },
        { condition: ifShouling, func: hitBoss, name: "首领" },
        { condition: ifMijing, func: AutoDomain, name: "秘境" },
        { condition: ifbuyNet, func: buyNet, name: "购买四方八方之网" },
        { condition: ifbuyTzq, func: buyTzq, name: "购买投资券" }
    ];

    // ===== 2. 子函数定义部分 =====

    /**
     * 封装函数，执行图片识别及点击操作（测试中，未封装完成，后续会优化逻辑）
     * @param {string} imagefilePath - 模板图片路径
     * @param {number} timeout - 超时时间(秒)
     * @param {number} afterBehavior - 识别后行为(0:无,1:点击,2:按F键)
     * @param {number} debugmodel - 调试模式(0:关闭,1:详细日志)
     * @param {number} xa - 识别区域X坐标
     * @param {number} ya - 识别区域Y坐标
     * @param {number} wa - 识别区域宽度
     * @param {number} ha - 识别区域高度
     * @param {boolean} clickCenter - 是否点击目标中心
     * @param {number} clickOffsetX - 点击位置X轴偏移量
     * @param {number} clickOffsetY - 点击位置Y轴偏移量
     * @param {number} tt - 匹配阈值(0-1)
     */
    async function imageRecognitionEnhanced(
        imagefilePath = "空参数",
        timeout = 10,
        afterBehavior = 0,
        debugmodel = 0,
        xa = 0,
        ya = 0,
        wa = 1920,
        ha = 1080,
        clickCenter = false,  // 新增：是否点击中心
        clickOffsetX = 0,    // 新增：X轴偏移量
        clickOffsetY = 0,    // 新增：Y轴偏移量
        tt = 0.8
    ) {
        // 参数验证
        if (xa + wa > 1920 || ya + ha > 1080) {
            log.info("图片区域超出屏幕范围");
            return { found: false, error: "区域超出屏幕范围" };
        }

        const startTime = Date.now();
        let captureRegion = null;
        let result = { found: false };

        try {
            // 读取模板图像
            const templateImage = file.ReadImageMatSync(imagefilePath);
            if (!templateImage) {
                throw new Error("无法读取模板图像");
            }

            const Imagidentify = RecognitionObject.TemplateMatch(templateImage, true);
            if (tt !== 0.8) {
                Imagidentify.Threshold = tt;
                Imagidentify.InitTemplate();
            }

            // 循环尝试识别
            for (let attempt = 0; attempt < 10; attempt++) {
                if (Date.now() - startTime > timeout * 1000) {
                    if (debugmodel === 1) {
                        log.info(`${timeout}秒超时退出，未找到图片`);
                    }
                    break;
                }

                captureRegion = captureGameRegion();
                if (!captureRegion) {
                    await sleep(200);
                    continue;
                }

                try {
                    const croppedRegion = captureRegion.DeriveCrop(xa, ya, wa, ha);
                    const res = croppedRegion.Find(Imagidentify);

                    if (res.isEmpty()) {
                        if (debugmodel === 1) {
                            log.info("识别图片中...");
                        }
                    } else {
                        // 计算基准点击位置（目标的左上角）
                        let clickX = res.x + xa;
                        let clickY = res.y + ya;

                        // 如果要求点击中心，计算中心点坐标
                        if (clickCenter) {
                            clickX += Math.floor(res.width / 2);
                            clickY += Math.floor(res.height / 2);
                        }

                        // 应用自定义偏移量
                        clickX += clickOffsetX;
                        clickY += clickOffsetY;

                        if (debugmodel === 1) {
                            log.info("计算后点击位置：({x},{y})", clickX, clickY);
                        }

                        // 执行识别后行为
                        if (afterBehavior === 1) {
                            await sleep(1000);
                            click(clickX, clickY);
                        } else if (afterBehavior === 2) {
                            await sleep(1000);
                            keyPress("F");
                        }

                        result = {
                            x: clickX,
                            y: clickY,
                            w: res.width,
                            h: res.height,
                            found: true
                        };
                        break;
                    }
                } finally {
                    if (captureRegion) {
                        captureRegion.dispose();
                        captureRegion = null;
                    }
                }

                await sleep(200);
            }
        } catch (error) {
            log.info(`图像识别错误: ${error.message}`);
            result.error = error.message;
        }

        return result;
    }

    /**
     * 文字OCR识别封装函数（支持空文本匹配任意文字）
     * @param {string} text - 要识别的文字，默认为"空参数"，空字符串会匹配任意文字
     * @param {number} timeout - 超时时间，单位为秒，默认为10秒
     * @param {number} afterBehavior - 点击模式，0=不点击，1=点击文字位置，2=按F键，默认为0
     * @param {number} debugmodel - 调试模式，0=无输出，1=基础日志，2=详细输出，3=立即返回，默认为0
     * @param {number} x - OCR识别区域起始X坐标，默认为0
     * @param {number} y - OCR识别区域起始Y坐标，默认为0
     * @param {number} w - OCR识别区域宽度，默认为1920
     * @param {number} h - OCR识别区域高度，默认为1080
     * @param {number} matchMode - 匹配模式，0=包含匹配，1=精确匹配，默认为0
     * @returns {object} 包含识别结果的对象 {text, x, y, found}
     */
    async function textOCREnhanced(
        text = "空参数",
        timeout = 10,
        afterBehavior = 0,
        debugmodel = 0,
        x = 0,
        y = 0,
        w = 1920,
        h = 1080,
        matchMode = 0
    ) {
        const startTime = Date.now();
        const timeoutMs = timeout * 1000;
        let lastResult = null;
        let captureRegion = null; // 用于存储截图对象

        // 只在调试模式1下输出基本信息
        if (debugmodel === 1) {
            if (text === "") {
                log.info(`OCR: 空文本模式 - 匹配任意文字`);
            } else if (text === "空参数") {
                log.warn(`OCR: 使用默认参数"空参数"`);
            }
        }

        while (Date.now() - startTime < timeoutMs) {
            try {
                // 获取截图并进行OCR识别
                captureRegion = captureGameRegion();
                const resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));

                // 遍历识别结果
                for (let i = 0; i < resList.count; i++) {
                    const res = resList[i];

                    // 检查是否匹配
                    let isMatched = false;
                    if (text === "") {
                        // 空文本匹配任意文字
                        isMatched = true;
                    } else if (matchMode === 1) {
                        // 精确匹配
                        isMatched = res.text === text;
                    } else {
                        // 包含匹配（默认）
                        isMatched = res.text.includes(text);
                    }

                    if (isMatched) {
                        // 只在调试模式1下输出匹配成功信息
                        if (debugmodel === 1) {
                            log.info(`OCR成功: "${res.text}" 位置(${res.x},${res.y})`);
                        }

                        // 调试模式3: 立即返回
                        if (debugmodel === 3) {
                            // 释放内存
                            if (captureRegion) {
                                captureRegion.dispose();
                            }
                            return { text: res.text, x: res.x, y: res.y, found: true };
                        }

                        // 执行后续行为
                        switch (afterBehavior) {
                            case 1: // 点击文字位置
                                await sleep(1000);
                                click(res.x, res.y);
                                break;
                            case 2: // 按F键
                                await sleep(100);
                                keyPress("F");
                                break;
                            default:
                                // 不执行任何操作
                                break;
                        }

                        // 记录最后一个匹配结果但不立即返回
                        lastResult = { text: res.text, x: res.x, y: res.y, found: true };
                    }
                }

                // 释放截图对象内存
                if (captureRegion) {
                    captureRegion.dispose();
                }

                // 如果找到匹配结果，根据调试模式决定是否立即返回
                if (lastResult && debugmodel !== 2) {
                    return lastResult;
                }

                // 短暂延迟后继续下一轮识别
                await sleep(100);

            } catch (error) {
                // 发生异常时释放内存
                if (captureRegion) {
                    captureRegion.dispose();
                }
                log.error(`OCR异常: ${error.message}`);
                await sleep(100);
            }
        }

        if (debugmodel === 1) {
            // 超时处理
            if (text === "") {
                log.info(`OCR超时: ${timeout}秒内未找到任何文字`);
            } else {
                log.info(`OCR超时: ${timeout}秒内未找到"${text}"`);
            }
        }

        // 返回最后一个结果或未找到
        return lastResult || { found: false };
    }

    //判断队内角色
    async function includes(characterName) {
        var avatars = getAvatars();
        for (let i = 0; i < avatars.length; i++) {
            if (avatars[i] === characterName) {
                await keyPress(String(i + 1));
                await sleep(1500);
                return true;
            }
        }
        return false;
    }

    // 等待质变仪完成提示出现。 若超时则强制结束流程。
    async function waitTransformer(deployed) {
        var startTime = new Date();
        await sleep(500);
        var NowTime = new Date();
        var getFood = 0;
        var lastIncrementTime = 0; // 上次增加getFood的时间
        const intervalTime = 3000; // 3秒的时间间隔，单位为毫秒

        // 质变仪判断逻辑
        if (deployed) {
            await sleep(800);

            await keyDown("S");
            await sleep(500);
            await keyUp("S");

            if (chargingMethod == "法器角色充能") {
                const ifbblIn = await includes("芭芭拉");
                if (!ifbblIn) { throw new Error("队伍中未包含角色：芭芭拉"); }
            }
            while ((NowTime - startTime) < actiontime * 1000) {
                const ocrRes = await textOCREnhanced("质变产生了以下物质", 0.7, 1, 0, 539, 251, 800, 425);
                if (ocrRes.found) {
                    click(970, 760);
                    if (!ifAkf) { return true; }
                    await sleep(150);
                    break;
                }
                if (chargingMethod == "法器角色充能") {
                    leftButtonClick();
                    await sleep(150);
                }
                NowTime = new Date();
            }
        }

        // 厨艺机关判断逻辑
        if (ifAkf) {
            if ((chargingMethod == "电气水晶充能")) {
                await AutoPath("全自动爱可菲");//厨艺机关的部署动作用路径追踪执行
            } else if (chargingMethod == "法器角色充能") {

                const ifakfIn = await includes("爱可菲");
                if (!ifakfIn) { throw new Error("队伍中未包含角色:爱可菲"); }

                keyDown("E");
                await sleep(1000);
                keyUp("E");

                await sleep(800);
                await includes("芭芭拉");
            }
            while ((NowTime - startTime) < actiontime * 1000) {
                const ifEarn = await textOCREnhanced("获得", 0.2, 0, 3, 159, 494, 75, 44);
                if (ifEarn.found) {
                    const currentTime = new Date().getTime();
                    if (currentTime - lastIncrementTime >= intervalTime) {
                        getFood++;
                        lastIncrementTime = currentTime;
                        log.warn(`获得料理数量: ${getFood}`);
                        if (getFood >= 10) {
                            log.warn("获得料理数量已达10，结束流程！");
                            await genshin.returnMainUi(); // 提前退出循环
                            return true;
                        }
                    }
                }
                if (chargingMethod == "法器角色充能") {
                    leftButtonClick();
                    await sleep(150);
                }
                await sleep(50);
                NowTime = new Date();
            }
        }
        await genshin.returnMainUi();
        log.error(`${actiontime}秒超时，结束流程！`);
    }

    //放置质变仪
    async function deployTransformer() {
        //放置质变仪
        await sleep(500);
        await keyPress("B");
        await sleep(1000);

        await handleExpiredItems(); //处理过期物品

        await sleep(1000);
        await click(1067, 57);//点开背包,可做图像识别优化

        const bagOk = await textOCREnhanced("小道具", 3, 0, 3, 126, 17, 99, 53); if (!bagOk.found) { throw new Error("未打开'小道具'页面,请确保背包已正确打开并切换到小道具标签页"); }//确认在小道具界面
        await sleep(500);
        const ZbyResult = await imageRecognitionEnhanced(ZHIBIANYI, 1, 1, 0);//识别质变仪图片
        if (!ZbyResult.found) {
            await genshin.returnMainUi();
            log.warn("'质变仪CD中'或'未找到质变仪!'");
            return false;//质变仪找不到就直接退出
        } else {
            await sleep(1000);
            await click(1699, 1004);
            await sleep(1000);//点击部署操作
            await genshin.returnMainUi();
        }
        return true;
    }

    //参量质变仪放入“薄荷”交互流程
    async function insertMaterial() {
        log.info("请确保所选材料足够，现在开始部署！！");
        //检测并进入质变仪界面
        await middleButtonClick();
        await sleep(1000);
        let Fmeun = await textOCREnhanced("参量质变仪", 2, 2, 0, 1205, 508, 140, 53);//单条F检测
        await keyPress("F");
        let CHAx = await imageRecognitionEnhanced(CHA, 3, 0, 0, 1766, 3, 140, 90);
        if (!Fmeun.found && !CHAx.found) { return false; }

        //检测是否到达材料页面
        const startTransform = await textOCREnhanced("进行质变", 3, 0, 3, 1675, 994, 150, 50); if (!startTransform.found) { throw new Error("质变仪页面未打开"); }//单条F检测
        await sleep(500);
        let itemResult;
        switch (ITEM) {
            case 1:
                await click(863, 47); // 初始化与'1养成道具'相关的设置或资源
                itemResult = await textOCREnhanced("养成道具", 3, 0, 3, 120, 19, 240, 50); if (!itemResult.found) { throw new Error("'养成道具'页面未打开"); }
                break;
            case 2:
                await click(959, 45);// 初始化与'2食物'相关的设置或资源
                itemResult = await textOCREnhanced("食物", 3, 0, 3, 124, 16, 93, 63); if (!itemResult.found) { throw new Error("'食物'页面未打开"); }
                break;
            case 3:
                await click(1050, 50); // 初始化与'3材料'相关的设置或资源
                itemResult = await textOCREnhanced("材料", 3, 0, 3, 124, 16, 93, 63); if (!itemResult.found) { throw new Error("'材料'页面未打开"); }
                break;
            default:
                // 处理未知ITEM值的情况
                break;
        }

        //滚轮预操作
        await moveMouseTo(1287, 131);
        await sleep(100);
        await leftButtonDown();
        await sleep(100);
        await moveMouseTo(1287, 161);
        // 薄荷图片检测
        let YOffset = 0; // Y轴偏移量，根据需要调整
        const maxRetries = 20; // 最大重试次数
        let retries = 0; // 当前重试次数
        while (retries < maxRetries) {
            const ifBh = await imageRecognitionEnhanced(BH, 1, 0, 0, 115, 115, 1155, 845);
            if (ifBh.found) {
                await leftButtonUp();
                await sleep(500);
                await click(ifBh.x, ifBh.y);
                await sleep(1000);
                await click(440, 1008);  //选择最大数量
                await sleep(1000);
                await click(1792, 1019); //质变按钮
                const zbPanel = await textOCREnhanced("参量质变仪", 3, 0, 3, 828, 253, 265, 73); if (!zbPanel.found) { log.error("单种材料不足，退出！"); }
                await sleep(1000);
                await click(1183, 764); //确认 ;
                await sleep(1000);
                await genshin.returnMainUi();
                return true
            }
            retries++; // 重试次数加1
            //滚轮操作
            YOffset += 50;
            await sleep(500);
            if (retries === maxRetries || 161 + YOffset > 1080) {
                await leftButtonUp();
                await sleep(100);
                await moveMouseTo(1287, 131);
                await genshin.returnMainUi();
                log.error("未找到材料！");
            }
            await moveMouseTo(1287, 161 + YOffset);
            await sleep(300);
        }
        log.info("材料准备完成，开始任务！！！");
    }

    //切换队伍
    async function switchPartyIfNeeded(partyName) {
        if (!partyName) {
            await genshin.returnMainUi();
            return;
        }
        try {
            log.info("正在尝试切换至" + partyName);
            if (!await genshin.switchParty(partyName)) {
                log.info("切换队伍失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                await genshin.switchParty(partyName);
            }
        } catch {
            log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
            notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
            await genshin.returnMainUi();
        }
    }

    //寻路函数
    async function AutoPath(locationName) {
        try {
            let filePath = `assets/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
    }

    // 背包过期物品识别
    async function handleExpiredItems() {
        const ifGuoqi = await textOCREnhanced("物品过期", 1.5, 0, 3, 870, 280, 170, 40);
        if (ifGuoqi.found) {
            log.info("检测到过期物品，正在处理...");
            await sleep(500);
            await click(980, 750); // 点击确认按钮，关闭提示
        } else {
            log.info("未检测到过期物品");
        }
    }

    // 获取当前时间七天后的时间戳
    function getSevenDaysLater() {
        const now = new Date();
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 当前时间 + 7天
        return sevenDaysLater.toISOString();
    }

    // 返回当前时间的下周一四点的时间戳
    function getNextMonday4AMISO() {
        const now = new Date();

        // 获取当前是星期几
        const currentDay = now.getDay();

        // 计算距离下周一还有几天
        let daysUntilMonday = 1 - currentDay;
        if (daysUntilMonday <= 0) {
            daysUntilMonday += 7;
        }

        // 创建下周一4点的日期对象
        const nextMonday4AM = new Date(now);
        nextMonday4AM.setDate(now.getDate() + daysUntilMonday);
        nextMonday4AM.setHours(4, 0, 0, 0);

        return nextMonday4AM.toISOString();
    }

    // 检查文件是否存在
    async function checkFileExists(filePath) {
        try {
            // 尝试读取文件，如果成功则文件存在
            await file.readText(filePath);
            return true;
        } catch (e) {
            // 如果读取失败，则文件可能不存在
            return false;
        }
    }

    // 读取CD记录
    async function readCDRecords() {
        let records = {};

        // 使用基础方法检查文件是否存在
        const fileExists = await checkFileExists(cdRecordPath);
        if (fileExists) {
            try {
                const content = await file.readText(cdRecordPath);
                const lines = content.split('\n');

                for (const line of lines) {
                    if (line.trim()) {
                        const [name, timestamp] = line.split('::');
                        records[name] = timestamp;
                    }
                }
            } catch (e) {
                log.error(`读取CD记录失败: ${e}`);
            }
        }

        return records;
    }

    // 写入CD记录
    async function writeCDRecords(records) {
        let content = '';

        for (const name in records) {
            content += `${name}::${records[name]}\n`;
        }

        try {
            // 尝试创建目录（如果环境支持）
            try {
                if (typeof file.mkdir === 'function') {
                    file.mkdir('record');
                }
            } catch (e) {
                // 忽略目录创建错误
            }

            await file.writeText(cdRecordPath, content);
        } catch (e) {
            log.error(`写入CD记录失败: ${e}`);
        }
    }

    // 检查路线是否可执行（CD是否已刷新）
    function isRouteAvailable(routeName, cdRecords) {
        const now = new Date();

        // 如果记录中没有该路线，说明是第一次执行，可以执行
        if (!cdRecords[routeName]) {
            return true;
        }

        // 检查CD时间是否已过
        const cdTime = new Date(cdRecords[routeName]);
        return now >= cdTime;
    }

    // 自动战斗函数
    async function autoFight(timeout) {
        const cts = new CancellationTokenSource();
        dispatcher.runTask(new SoloTask("AutoFight"), cts);

        const startTime = Date.now();
        let fightResult = false;

        while (Date.now() - startTime < timeout) {
            let captureRegion = null;
            try {
                captureRegion = captureGameRegion();
                if (recognizeFightText(captureRegion)) {
                    fightResult = true;
                    break;
                }
            } finally {
                // 确保捕获的区域被正确释放
                if (captureRegion) {
                    captureRegion.dispose();
                    captureRegion = null;
                }
            }
            await sleep(1000);
        }

        cts.cancel();
        return fightResult;
    }

    // 战斗文本识别函数
    function recognizeFightText(captureRegion) {
        try {
            const result = captureRegion.find(ocrRo2);
            const text = result.text;
            const keywords = ["挑战成功", "达成", "挑战达成"];

            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            log.error("OCR识别出错: {0}", error);
            return false;
        }
    }

    // 自动秘境
    async function fuben() {
        await genshin.tp(1167.9833984375, 662.7353515625);// 太山府

        await sleep(1500);
        keyPress("F");

        await textOCREnhanced("单人挑战", 8, 1, 0, 1615, 990, 220, 50);// 等待“单人挑战”出现
        await sleep(10);
        await textOCREnhanced("开始挑战", 8, 1, 0, 1615, 990, 220, 50);// 等待“开始挑战”出现
        await sleep(10);
        await textOCREnhanced("地脉异常", 10, 1, 0, 840, 405, 180, 55);// 等待“地脉异常”出现

        await sleep(1000);

        let success;
        for (let attempt = 0; attempt < 10; attempt++) {
            success = await textOCREnhanced("启动", 0.5, 0, 3, 1210, 500, 85, 85);
            if (success.found) {
                keyPress("F");
                break;
            } else {
                keyDown("W");
                await sleep(2500);
                keyUp("W");
            }
        }

        if (!success.found) {
            log.warn("未找到秘境启动按钮！");
            return false;
        }
    }

    // 晶蝶诱捕装置
    async function Jingdie() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "晶蝶诱捕装置";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在执行本周晶蝶诱捕装置收取任务……");

        keyPress("M");
        await sleep(1000);

        // 判断是否诱捕完成
        const res2 = await textOCREnhanced("晶蝶诱捕装置", 1, 0, 3, 0, 0, 360, 500);

        if (!res2.found) {
            log.warn("诱捕未完成，不执行后续操作");
            await genshin.returnMainUi();
            return;
        } else {
            //执行晶蝶诱捕装置代码
            await AutoPath("晶蝶诱捕装置");
            //进行交互
            await sleep(1000);
            keyPress("F");//领取奖励
            await sleep(2000);

            click(960, 900);//点击奖励弹窗

            await sleep(1000);
            keyPress("F");//再次启动
            await sleep(1000);

            click(1750, 1020);//点击启动
            await sleep(1000);
            click(1180, 750);//点击确认

            log.info("已完成 领取晶蝶诱捕装置");
            await sleep(1000);

            // 更新CD记录（设置为七天后）
            updatedRecords[routeName] = getSevenDaysLater();
            await writeCDRecords(updatedRecords);

            log.info("本周晶蝶诱捕装置收取完成！");
        }


    }

    // 质变仪和爱可菲
    async function autoZhibian() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "质变仪&爱可菲";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在执行本周质变仪&爱可菲任务……");

        // 检查质变仪cd是否已刷新
        await sleep(500);
        await keyPress("B");
        await sleep(1000);

        await handleExpiredItems(); //处理过期物品

        await sleep(1000);
        await click(1067, 57);//点开背包,可做图像识别优化

        const ifXdj = await textOCREnhanced("小道具", 3, 0, 3, 126, 17, 99, 53); if (!ifXdj.found) { throw new Error("未打开'小道具'页面,请确保背包已正确打开并切换到小道具标签页"); }//确认在小道具界面
        await sleep(500);
        const res1 = await imageRecognitionEnhanced(ZHIBIANYI, 1, 1, 0);//识别质变仪图片
        if (res1.found) {
            await genshin.returnMainUi();
            log.info("质变仪CD已刷新！");
        } else {
            log.warn("'质变仪CD中'或'未找到质变仪!'");
            await genshin.returnMainUi();
            return;
        }

        await switchPartyIfNeeded(TEAM); //切换到指定队伍

        if (chargingMethod == "电气水晶充能") {
            await AutoPath("全自动质变仪");
        } else if (chargingMethod == "法器角色充能") {
            await genshin.tp(-874.724609375, 2276.950439453125);
        }

        const deployed = await deployTransformer();//部署质变仪
        if (!deployed) {
            log.error("质变仪未找到或在cd中");
        } else {
            await insertMaterial();//放入材料并开始质变流程
        }

        await waitTransformer(deployed)//等待质变完成
        log.info("任务执行完成！！！");

        // 更新CD记录（设置为七天后）
        updatedRecords[routeName] = getSevenDaysLater();
        await writeCDRecords(updatedRecords);
        log.info("本周质变仪&爱可菲任务已完成！");
    }

    // 每周做菜
    async function Cooking() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "每周做菜";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在执行本周烹饪任务……");
        await AutoPath("每周做菜");
        await sleep(10);
        keyDown("VK_MENU");
        await sleep(500);

        const res1 = await textOCREnhanced("烹饪", 5, 0, 3, 1150, 460, 155, 155);
        if (res1.found) {
            click(res1.x + 15, res1.y + 15);
        }

        await sleep(800);
        keyUp("VK_MENU");
        await sleep(1000);

        click(145, 1015);// 筛选
        await sleep(800);

        click(195, 1015);// 重置
        await sleep(800);

        click(500, 1020);// 确认筛选
        await sleep(800);

        //滚轮预操作
        await moveMouseTo(1287, 131);
        await sleep(100);
        await leftButtonDown();
        await sleep(100);
        await moveMouseTo(1287, 161);

        let YOffset = 0; // Y轴偏移量，根据需要调整
        const maxRetries = 20; // 最大重试次数
        let retries = 0; // 当前重试次数
        while (retries < maxRetries) {
            const res2 = await textOCREnhanced(food, 1, 0, 3, 116, 116, 1165, 880);
            if (res2.found) {
                await leftButtonUp();
                await sleep(500);
                await click(res2.x + 50, res2.y - 60);
                await sleep(1000);

                await sleep(1000);
                click(1700, 1020);// 制作
                await sleep(1000);

                await textOCREnhanced("自动烹饪", 5, 1, 0, 725, 1000, 130, 45);
                await sleep(800);
                click(960, 460);
                await sleep(800);
                inputText(cookCount);
                await sleep(800);
                click(1190, 755);
                await sleep(2500); // 等待烹饪完成

                await genshin.returnMainUi();
                log.info("本周烹饪任务已完成！");

                // 更新CD记录
                updatedRecords[routeName] = getNextMonday4AMISO();
                await writeCDRecords(updatedRecords);

                return;
            }
            retries++; // 重试次数加1
            //滚轮操作
            YOffset += 50;
            await sleep(500);
            if (retries === maxRetries || 161 + YOffset > 1080) {
                await leftButtonUp();
                await sleep(100);
                await moveMouseTo(1287, 131);
                await genshin.returnMainUi();
                log.error("料理未找到！");
            }
            await moveMouseTo(1287, 161 + YOffset);
            await sleep(300);
        }
    }

    // 每周锻造
    async function duanZao() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "每周锻造";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在执行本周锻造任务……");
        await AutoPath("瓦格纳");
        keyDown("VK_MENU");
        await textOCREnhanced("瓦格纳", 5, 1, 0, 1150, 460, 155, 155);
        await sleep(800);
        keyUp("VK_MENU");

        click(960, 540);// 对话
        await sleep(1000);

        await textOCREnhanced("委托锻造", 5, 1, 0, 1150, 400, 300, 300);
        await sleep(1500);

        click(960, 540);// 对话
        await sleep(1500);

        const res1 = await textOCREnhanced("可收取", 1, 0, 3, 625, 265, 130, 50);
        if (res1.found) {
            click(180, 1015);// 全部领取
            await sleep(1500);

            click(980, 900);// 确认按钮
            await sleep(1500);

            click(220, 145);// 点击配方
            await sleep(1000);
        }

        click(360, 1015);// 筛选按钮
        await sleep(1500);
        await textOCREnhanced("武器升级材料", 5, 1, 0, 30, 170, 410, 60);
        await sleep(1500);

        await imageRecognitionEnhanced(mineralFile, 10, 1, 0, 40, 210, 720, 770)
        await sleep(1500);

        for (let i = 0; i < 4; i++) {
            click(1760, 1015);// 开始锻造
            await sleep(300);
        }

        await genshin.returnMainUi();
        log.info("本周锻造任务已完成！");

        // 更新CD记录
        updatedRecords[routeName] = getNextMonday4AMISO();
        await writeCDRecords(updatedRecords);
    }

    // 每周首领
    async function hitBoss() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "每周首领";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在执行本周首领击败任务……");

        await genshin.tpToStatueOfTheSeven();// 先去神像确保状态和队伍切换
        await switchPartyIfNeeded(BossPartyName);
        await sleep(5000);

        for (let i = 1; i <= 10; i++) {
            if (i % 2 == 0) { await AutoPath("爆炎树"); }
            else if (i % 2 != 0) { await AutoPath("急冻树"); }
            await sleep(10);
            log.info("第" + i + "次首领已击败！")
        }

        log.info("本周首领击败任务已完成！");

        // 更新CD记录
        updatedRecords[routeName] = getNextMonday4AMISO();
        await writeCDRecords(updatedRecords);
    }

    // 每周秘境
    async function AutoDomain() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "每周秘境";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在执行本周秘境任务……");

        await genshin.tpToStatueOfTheSeven();// 先去神像确保状态和队伍切换
        await switchPartyIfNeeded(BossPartyName);
        await sleep(5000);

        while (mijingCount <= 10) {
            log.info(`正在进行第${mijingCount}次秘境挑战`);
            await fuben();
            // 开始自动战斗
            log.info("开始自动战斗");
            const fightResult = await autoFight(120000); // 120秒战斗超时

            if (fightResult) {
                log.info(`战斗成功！当前完成 ${mijingCount} 次`);
            } else {
                log.error("战斗失败，终止脚本");
                break;
            }
            await sleep(1500);
            mijingCount++;
        }
        log.info("本周秘境任务已完成！");

        // 更新CD记录
        updatedRecords[routeName] = getNextMonday4AMISO();
        await writeCDRecords(updatedRecords);

        await genshin.tpToStatueOfTheSeven();// 回一次神像
        await sleep(5000);
    }

    // 购买四方八方之网
    async function buyNet() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "购买四方网";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在执行本周四方网购买任务……");

        await AutoPath("四方八方之网");
        await sleep(800);

        keyPress("F");
        await sleep(1300);

        click(960, 540);// 对话
        await sleep(1000);

        await textOCREnhanced("购买", 3, 1, 0, 1320, 630, 130, 60);// 对话：购买四方八方之网
        await sleep(1000);

        const res1 = await textOCREnhanced("已售罄", 1, 0, 3, 1515, 920, 90, 35);
        if (!res1.found) {
            click(1670, 1015);
            await sleep(800);

            for (let i = 0; i < 7; i++) {// 拉满拉满，TMD全部拉满
                click(1290, 600);
                await sleep(150);
            }

            click(1175, 780);// 点击购买
            await sleep(300);
            await genshin.returnMainUi();

            log.info("本周四方网购买任务已完成！");

            // 更新CD记录
            updatedRecords[routeName] = getNextMonday4AMISO();
            await writeCDRecords(updatedRecords);
        } else {
            log.warn("四方网CD未刷新！！！");
        }
    }

    // 购买投资券
    async function buyTzq() {
        // 读取CD记录
        const cdRecords = await readCDRecords();
        let updatedRecords = { ...cdRecords };

        const routeName = "投资券";

        // 检查CD
        if (!isRouteAvailable(routeName, cdRecords)) {
            log.info(routeName + "CD未刷新，跳过本次执行");
            return;
        }

        log.info("正在提交本周投资券……");

        await AutoPath("投资券");

        await sleep(1000);
        keyPress("F");
        await sleep(1000);
        click(960, 540);
        await sleep(2000);

        await textOCREnhanced("我要结算", 3, 1, 0, 1325, 550, 250, 55);

        await sleep(1000);
        click(960, 540);
        await sleep(1000);

        const notHave = await textOCREnhanced("没有投资券", 3, 0, 3, 830, 925, 160, 50);
        if (notHave.found) {
            click(960, 540);
            await sleep(1500);

            click(960, 540);
            await sleep(1500);

            click(1700, 1000);
            await sleep(1000);

            for (let i = 0; i < 8; i++) {
                click(1295, 600);
                await sleep(100);
            }
            click(1180, 780);
            await sleep(1000);

            await genshin.returnMainUi();

            await sleep(1000);
            keyPress("F");
            await sleep(1000);
            click(960, 540);
            await sleep(1500);

            await textOCREnhanced("我要结算", 3, 1, 0, 1325, 500, 250, 80);

            await sleep(1000);
            click(960, 540);
            await sleep(1000);
        }
        keyPress("F");
        await sleep(1000);

        click(110, 185);
        await sleep(1000);
        click(1235, 815);
        await sleep(1000);
        click(1620, 1020);
        await sleep(2500);

        click(1620, 1020);

        log.info("本周投资券已提交！");

        // 更新CD记录
        updatedRecords[routeName] = getNextMonday4AMISO();
        await writeCDRecords(updatedRecords);
    }

    // 版本信息
    async function outputVersion() {
        let scriptVersion, scriptname;
        const manifestContent = file.readTextSync("manifest.json");
        const manifest = JSON.parse(manifestContent);
        scriptVersion = manifest.version;
        scriptname = manifest.name;

        log.warn(`${scriptname}：V${scriptVersion}`);
    }

    // ===== 3. 主函数执行部分 =====

    try {
        //设置分辨率和缩放
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();

        await outputVersion(); // 输出版本信息

        // 执行所有启用的任务
        for (const task of tasks) {
            if (task.condition) {
                await task.func();
                await sleep(10);
            }
        }
    } catch (error) {
        log.error(`执行过程中发生错误：${error.message}`);
    } finally {
        await genshin.returnMainUi();
    }
    
})();
