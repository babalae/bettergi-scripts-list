(async function () {
    /**
     * 封装函数，执行图片识别及点击操作（测试中，未封装完成，后续会优化逻辑）
     *
     * @param filePath 图片路径，默认为"空参数"
     * @param timeout 超时时间，单位为秒，默认为10秒
     * @param afterBehavior 点击模式，0为关闭点击，1为开启点击，2为开启F键点击，默认为0
     * @param debugmodel 调试代码模式，0为关闭调试模式，1为开启调试模式，默认为0
     * @param xa 识别区域的x轴偏移量，默认为0
     * @param ya 识别区域的y轴偏移量，默认为0
     * @param wa 识别区域的宽度，默认为1920
     * @param ha 识别区域的高度，默认为1080
     * @returns 返回识别结果，包括图片的x轴坐标、y轴坐标、宽度、高度及是否找到图片
     */
    async function imageRecognition(filePath = "空参数", timeout = 10, afterBehavior = 0, debugmodel = 0, xa = 0, ya = 0, wa = 1920, ha = 1080) {
        const startTime = new Date();
        const Imagidentify = RecognitionObject.TemplateMatch(file.ReadImageMatSync(filePath));
        for (let ii = 0; ii < 10; ii++) {
            captureRegion = captureGameRegion();  // 获取一张截图
            res = captureRegion.DeriveCrop(xa, ya, wa, ha).Find(Imagidentify);
            if (res.isEmpty()) {
                if (debugmodel === 1 & xa === 0 & ya === 0) { log.info("识别图片中") };
            } else {
                if (afterBehavior === 1) { log.info("点击模式:开"); await sleep(1000); click(res.x, res.y); } else { if (debugmodel === 1 & xa === 0 & ya === 0) { log.info("点击模式:关") } }
                if (afterBehavior === 2) { log.info("F模式:开"); await sleep(1000); keyPress("F"); } else { if (debugmodel === 1 & xa === 0 & ya === 0) { log.info("F模式:关") } }
                if (debugmodel === 1 & xa === 0 & ya === 0) { log.info("全图代码位置：({x},{y},{h},{w})", res.x - 10, res.y - 10, res.width + 10, res.Height + 10); } else { log.info("识别到图片"); }
                return result = { x: res.x, y: res.y, w: res.width, h: res.Height, found: true }
            }
            const NowTime = new Date();
            if ((NowTime - startTime) > timeout * 1000) { if (debugmodel === 1 & xa === 0 & ya === 0) { log.info(`${timeout}秒超时退出，未找到图片`); } return result = { found: false }; } else { ii = 8 }
            await sleep(200);
        }
        await sleep(1200);
    }

    /**
     * 文字OCR识别封装函数（测试中，未封装完成，后续会优化逻辑）
     * @param text 要识别的文字，默认为"空参数"
     * @param timeout 超时时间，单位为秒，默认为10秒
     * @param afterBehavior 点击模式，0表示不点击，1表示点击识别到文字的位置，2表示输出模式，默认为0
     * @param debugmodel 调试代码，0表示输入判断模式，1表示输出位置信息，2表示输出判断模式，默认为0
     * @param x OCR识别区域的起始X坐标，默认为0
     * @param y OCR识别区域的起始Y坐标，默认为0
     * @param w OCR识别区域的宽度，默认为1920
     * @param h OCR识别区域的高度，默认为1080
     * @returns 包含识别结果的对象，包括识别的文字、坐标和是否找到的结果
     */
    async function textOCR(text = "空参数", timeout = 10, afterBehavior = 0, debugmodel = 0, x = 0, y = 0, w = 1920, h = 1080) {
        const startTime = new Date();
        var Outcheak = 0
        for (var ii = 0; ii < 10; ii++) {
            // 获取一张截图
            var captureRegion = captureGameRegion();
            var res1
            var res2
            var conuntcottimecot = 1;
            var conuntcottimecomp = 1;
            // 对整个区域进行 OCR
            var resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));
            //log.info("OCR 全区域识别结果数量 {len}", resList.count);
            if (resList.count !== 0) {
                for (let i = 0; i < resList.count; i++) { // 遍历的是 C# 的 List 对象，所以要用 count，而不是 length
                    let res = resList[i];
                    res1 = res.text
                    conuntcottimecomp++;
                    if (res.text.includes(text) && debugmodel == 3) { return result = { text: res.text, x: res.x, y: res.y, found: true }; }
                    if (res.text.includes(text) && debugmodel !== 2) {
                        conuntcottimecot++;
                        log.info(`“${res1}”找到`);
                        if (debugmodel === 1 & x === 0 & y === 0) { log.info("全图代码位置：({x},{y},{h},{w})", res.x - 10, res.y - 10, res.width + 10, res.Height + 10); } else { log.info("文本OCR完成'{text}'", res.text); }
                        if (afterBehavior === 1) { log.info("点击模式:开"); await sleep(1000); click(res.x, res.y); } else { if (debugmodel === 1 & x === 0 & y === 0) { log.info("点击模式:关") } }
                        if (afterBehavior === 2) { log.info("F模式:开"); await sleep(100); keyPress("F"); } else { if (debugmodel === 1 & x === 0 & y === 0) { log.info("F模式:关"); } }
                        if (conuntcottimecot >= conuntcottimecomp / 2) { return result = { text: res.text, x: res.x, y: res.y, found: true }; } else { return result = { found: false }; }
                    }
                    if (debugmodel === 2) {
                        if (res1 === res2) { conuntcottimecot++; res2 = res1; }
                        //log.info("输出模式：全图代码位置：({x},{y},{h},{w},{string})", res.x-10, res.y-10, res.width+10, res.Height+10, res.text);
                        if (Outcheak === 1) { if (conuntcottimecot >= conuntcottimecomp / 2) { return result = { text: res.text, x: res.x, y: res.y, found: true }; } else { return result = { found: false }; } }
                    }
                }
            }
            const NowTime = new Date();
            if ((NowTime - startTime) > timeout * 1000) { if (debugmodel === 2) { if (resList.count === 0) { return result = { found: false }; } else { Outcheak = 1; ii = 2; } } else { Outcheak = 0; if (debugmodel === 1 & x === 0 & y === 0) { log.info(`${timeout}秒超时退出，"${text}"未找到`) }; return result = { found: false }; } }
            else { ii = 2; if (debugmodel === 1 & x === 0 & y === 0) { log.info(`"${text}"识别中……`); } }
            await sleep(100);
        }
    }

    // 等待质变仪完成提示出现。 若超时则强制结束流程。
    async function waitTransformer() {
        var startTime = new Date();
        await sleep(500);
        var NowTime = new Date();
        var getFood = 0;
        var lastIncrementTime = 0; // 上次增加getFood的时间
        const intervalTime = 3000; // 3秒的时间间隔，单位为毫秒

        // 质变仪判断逻辑
        while ((NowTime - startTime) < actiontime * 1000) {
            await textOCR("质变产生了以下物质", 0.7, 1, 0, 539, 251, 800, 425);
            if (result.found) {
                click(970, 760);
                if (!ifAkf) { return true; }
                await sleep(150);
                break;
            }
            NowTime = new Date();
        }

        // 厨艺机关判断逻辑
        if (ifAkf) {
            await AutoPath("全自动爱可菲");//厨艺机关的部署动作用路径追踪执行
            while ((NowTime - startTime) < actiontime * 1000) {
                let result = await textOCR("获得", 0.2, 0, 3, 159, 494, 75, 44);
                if (result.found) {
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
                await sleep(50);
                NowTime = new Date();
            }
        }
        await genshin.returnMainUi();
        throw new Error(`${actiontime}秒超时，结束流程！`);
    }

    //放置质变仪
    async function deployTransformer() {
        //放置质变仪
        await sleep(500);
        await keyPress("B");
        await sleep(1000);

        //连续点击三次防止过期道具卡背包
        await click(970, 760);
        await sleep(100);
        await click(970, 760);
        await sleep(100);
        await click(970, 760);

        await sleep(1000);
        await click(1067, 57);//点开背包,可做图像识别优化

        await textOCR("小道具", 3, 0, 0, 126, 17, 99, 53); if (!result.found) { throw new Error("未打开'小道具'页面,请确保背包已正确打开并切换到小道具标签页"); }//确认在小道具界面
        await sleep(500);
        await imageRecognition(ZHIBIANYI, 1, 1, 0);//识别质变仪图片
        if (!result.found) {
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
        let Fmeun = await textOCR("参量质变仪", 2, 2, 3, 1205, 508, 140, 53);//单条F检测
        await keyPress("F");
        let CHAx = await imageRecognition(CHA, 3, 0, 0, 1766, 3, 140, 90);
        if (!Fmeun.found && !CHAx.found) { return false; }

        //检测是否到达材料页面
        await textOCR("进行质变", 3, 0, 0, 1675, 994, 150, 50); if (!result.found) { throw new Error("质变仪页面未打开"); }//单条F检测
        await sleep(500);
        switch (ITEM) {
            case 1:
                await click(863, 47); // 初始化与'1养成道具'相关的设置或资源
                await textOCR("养成道具", 3, 0, 0, 120, 19, 240, 50); if (!result.found) { throw new Error("'养成道具'页面未打开"); }
                break;
            case 2:
                await click(959, 45);// 初始化与'2食物'相关的设置或资源
                await textOCR("食物", 3, 0, 0, 124, 16, 93, 63); if (!result.found) { throw new Error("'食物'页面未打开"); }
                break;
            case 3:
                await click(1050, 50); // 初始化与'3材料'相关的设置或资源
                await textOCR("材料", 3, 0, 0, 124, 16, 93, 63); if (!result.found) { throw new Error("'材料'页面未打开"); }
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
            await imageRecognition(BH, 1, 0, 0);
            if (result.found) {
                await leftButtonUp();
                await sleep(500);
                await click(result.x, result.y);
                await sleep(1000);
                await click(440, 1008);  //选择最大数量
                await sleep(1000);
                await click(1792, 1019); //质变按钮
                await textOCR("参量质变仪", 3, 0, 0, 828, 253, 265, 73); if (!result.found) { throw new Error("单种材料不足，退出！"); }
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
                throw new Error("未找到材料！");
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


    //main/======================================================================================

    // 人机验证
    if (!settings.ifCheck) { log.error("请阅读readme文件并做好相关设置后再运行此脚本！"); return; }

    //初始化配置
    var actiontime = settings.actiontime != undefined && ~~settings.actiontime > 0 ? ~~settings.actiontime : 180;
    var TEAM;
    var Material = settings.Material;
    var BH = `assets/RecognitionObject/${Material}.png`;
    var ZHIBIANYI = typeof settings.ZHIBIANY === 'string' && settings.ZHIBIANYI.trim() !== '' ? settings.ZHIBIANYI : "assets/RecognitionObject/zhibian.png";
    var CHA = "assets/RecognitionObject/cha.png"

    const ifAkf = settings.ifAkf;

    // 创建材质到ITEM的映射表
    // 养成道具=1，食物=2，材料=3
    const materialToItemMap = {
        "牛角": 1,
        "苹果": 2, "日落果": 2, "泡泡桔": 2,
        "白铁块": 3, "水晶块": 3, "薄荷": 3, "菜": 3,
        "鸡腿": 3, "蘑菇": 3, "鸟蛋": 3, "兽肉": 3, "甜甜花": 3
    };

    // 直接通过映射获取ITEM值（未匹配时默认0）
    ITEM = materialToItemMap[Material] || 0;


    //检查用户是否配置队伍
    if (ifAkf && settings.TEAMname === undefined) {
        log.error("您选择了拥有爱可菲，请在配置页面填写包含爱可菲的队伍名称！！！");
        return;// 没选就报错后停止
    } else {
        TEAM = settings.TEAMname;
    }


    //设置分辨率和缩放
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();

    // 打开地图
    keyPress("M");
    await sleep(1000);

    // 判断是否诱捕完成
    await textOCR("诱捕装置", 3, 0, 0, 0, 0, 360, 500);

    if (!result.found) {
        log.warn("诱捕未完成，不执行后续操作");
        await genshin.returnMainUi();
        return;
    } else {
        //开始任务
        try {
            await switchPartyIfNeeded(TEAM); //切换到指定队伍
            await AutoPath("全自动质变仪");

            if (!await deployTransformer()) {
                throw new Error("质变仪未找到或在cd中");
            };//部署质变仪

            await insertMaterial()//放入材料并开始质变流程

            await waitTransformer()//等待质变完成
            log.info("任务执行完成！！！");


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
        } catch (error) {
            log.error(`执行过程中发生错误：${error.message}`);
        } finally {
            await genshin.returnMainUi();
        }
    }
    //main/======================================================================================
})();
