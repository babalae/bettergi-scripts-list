(async function () {
    // 脚本配置参数
    // const ACTIVITY_LOCATION = { x: "1200.0", y: "1500.0" }; // 活动坐标
    const PATH_FILE_START = "assets/pathing/start.json"; // 地图追踪路径文件
    const PATH_FILE_CONTINUE = "assets/pathing/continue.json"; // 地图追踪路径文件

    await sleep(1000);

    log.info("自动吃金币活动, 启动!")

    // 1. 脚本开始前确保在主界面
    log.info("确保游戏在主界面状态");
    await genshin.returnMainUi();
    await sleep(1000);

    // 在循环前添加游戏次数限制
    // const MAX_GAMES = 2;
    const MAX_GAMES = typeof (settings.max_games) === 'undefined' ? 20 : parseInt(settings.max_games, 10);
    let gameCount = 0;

    log.info("最大游戏次数设定: {MAX_GAMES}次", MAX_GAMES)


    // 只要积分未满且游戏次数未达上限，就循环进行匹配和游戏
    while (gameCount < MAX_GAMES) {
        gameCount++; // 增加游戏计数
        log.info("开始第{count}场游戏", gameCount);

        // 2. 使用地图追踪走到活动入口
        log.info("正在使用地图追踪前往活动入口");
        try {
            // 运行路径追踪脚本
            if (gameCount == 1) {
                await pathingScript.runFile(PATH_FILE_START);
            } else {
                await pathingScript.runFile(PATH_FILE_CONTINUE);
            }

            log.info("已到达活动入口");
        } catch (error) {
            log.error("地图追踪失败: {error}", error);
            return;
        }

        // 3. 检测F键交互窗口 - 使用正确的OCR方法
        let foundActivity = false;
        for (let i = 0; i < 10; i++) { // 最多尝试10次
            // 获取游戏截图
            const screenshot = captureGameRegion();

            // 对整个区域进行OCR - 使用ocrThis
            const activityTextRegions = screenshot.findMulti(RecognitionObject.ocrThis);

            // 遍历所有OCR结果
            for (let j = 0; j < activityTextRegions.count; j++) {
                const region = activityTextRegions[j];

                if (region.text.includes("跨界挑战")) {
                    log.info("检测到活动入口");
                    foundActivity = true;
                    break;
                }
            }

            if (foundActivity) break;

            keyPress('W');
            moveMouseBy(0, 100); // 轻微移动视角帮助识别
            await sleep(1000);
        }

        // 4. 按F进入活动界面
        log.info("进入活动界面");
        keyPress("F");
        await sleep(2000); // 等待界面加载

        // 5. 精确识别积分信息
        const scoreRegion = captureGameRegion().deriveCrop(
            1248,   // x
            360,  // y
            150,   // width
            30   // height
        );

        // 对积分区域进行OCR
        const scoreResults = scoreRegion.findMulti(RecognitionObject.ocrThis);

        let currentScore = 0;
        let maxScore = 0;
        let scoreFound = false;
        // 遍历所有识别结果
        for (let i = 0; i < scoreResults.count; i++) {
            const res = scoreResults[i];

            // 使用正则表达式匹配积分格式
            const match = res.text.match(/(\d+)\s*\/\s*(\d+)/);
            if (match && match.length >= 3) {
                currentScore = parseInt(match[1]);
                maxScore = parseInt(match[2]);
                scoreFound = true;
                break;
            }
        }
        if (!scoreFound) {
            log.error("未识别到积分信息");
            // await genshin.returnMainUi();
            return;
        }
        log.info("积分状态: {current}/{max}", currentScore, maxScore);
        if (currentScore >= maxScore) {
            log.info("PVP活动已完成");
            // notification.send("PVP活动已完成");
            await genshin.returnMainUi();
            await sleep(1000);
            return;
        }


        // 6. 点击开始匹配
        log.info("匹配挑战");
        // 假设开始按钮在屏幕中间下方位置
        click(1560, 1012);
        await sleep(1000);

        // 7. 等待并确认匹配
        let matchFound = false,matchFound_1st = false;  //matchFound_1st：确认按钮是否点击过
        let matchTimeout = 0;    //联机确认按钮超时等待（单位：秒）
        let beRefusedCount = 0;    //被拒绝次数
        for (let i = 0; i < 60; i++) { // 最多等待60秒
            const confirmRegion = captureGameRegion().deriveCrop(
                1037,
                706,
                280,
                64
            );

            // 执行OCR识别
            const confirmResults = confirmRegion.findMulti(RecognitionObject.ocrThis);
            log.info("匹配确认区域OCR识别结果数量: {count}", confirmResults.count);

            /*处理联机确认按钮
                执行逻辑:（如有报错，自己改 或者 反馈naralan0502@gmail.com）
                    如果OCR识别结果数量等于0，判断是否已经点击过确认按钮（通过变量matchFound_1st确认）
                        是：超时等待时长matchTimeout++，若超时等待时长==13，设置matchFound为true，跳出循环
                        否：继续循环
                    如果OCR识别结果数量大于0，遍历所有识别结果
                        如果存在确认按钮，设置变量matchFound_1st = true，超时等待t=0
            */
            if(confirmResults.count){
                // 遍历所有识别结果
                for (let j = 0; j < confirmResults.count; j++) {
                    const region = confirmResults[j];
                    // log.info("匹配确认区域OCR结果:位置({x},{y},{w},{h}), 文本: {text}",
                    //     region.x, region.y, region.width, region.height, region.text);

                    if (region.text.includes("接受")) {
                        click(1182, 737); // 点击确认按钮
                        if(matchFound_1st && (++beRefusedCount >= 3))    log.info("兄啊有点点背，被拒绝了{count}次诶", beRefusedCount);
                        matchFound_1st = true;
                        log.info("匹配成功, 点击接受");
                        matchTimeout = 0;
                        break;
                    }
                }
            }
            else{
                if(matchFound_1st && (++matchTimeout == 13)) {   //超时等待13s（游戏内联机确认超时时长10s+冷却CD3s）
                    matchFound = true;
                    log.info("点击确认成功");
                    break;
                }
            }

            await sleep(1000);
        }

        if (!matchFound) {
            notification.error("匹配超时");
            return;
        }

        // 7 等待进入游戏（直到出现"第1回合"提示）
        let roundStarted = false;
        const roundStartTime = Date.now();
        const ROUND_TIMEOUT = 90 * 1000; // 90秒超时

        while (!roundStarted && Date.now() - roundStartTime < ROUND_TIMEOUT) {
            const roundRegion = captureGameRegion().deriveCrop(
                770,
                246,
                373,
                60
            );

            const roundText = roundRegion.find(RecognitionObject.ocrThis);
            if (roundText && roundText.text && roundText.text.includes("第1回合")) {
                log.info("游戏开始");
                roundStarted = true;
                break;
            }

            await sleep(1000);
        }

        if (!roundStarted) {
            log.error("未检测到回合开始提示");
            notification.error("进入游戏失败");
            return;
        }

        // 8. 进入游戏后模拟操作
        log.info("开始模拟操作");

        // 随机选择操作
        const actions = [
            // Shift+W 冲刺前进1秒
            async () => {
                keyDown("SHIFT");
                keyDown("W");
                await sleep(1000);
                keyUp("W");
                keyUp("SHIFT");
            },
            // Shift+A 冲刺左移1秒
            async () => {
                keyDown("SHIFT");
                keyDown("A");
                await sleep(1000);
                keyUp("A");
                keyUp("SHIFT");
            },
            // Shift+S 冲刺后退1秒
            async () => {
                keyDown("SHIFT");
                keyDown("S");
                await sleep(1000);
                keyUp("S");
                keyUp("SHIFT");
            },
            // Shift+D 冲刺右移1秒
            async () => {
                keyDown("SHIFT");
                keyDown("D");
                await sleep(1000);
                keyUp("D");
                keyUp("SHIFT");
            },
            // 空格跳跃1秒
            async () => {
                keyDown("SPACE");
                await sleep(1000);
                keyUp("SPACE");
            },
            // 1秒内按两下E（元素战技）
            async () => {
                // 第一次按E
                keyPress("E");
                await sleep(700); // 短暂间隔

                // 第二次按E
                keyPress("E");
                await sleep(300); // 总时间1秒
            }
        ];

        const startTime = Date.now();
        const MAX_GAME_DURATION = 300 * 1000;

        while (Date.now() - startTime < MAX_GAME_DURATION) {
            // 在屏幕顶部中央检测"挑战完成"文本
            const completionRegion = captureGameRegion().deriveCrop(
                800, 180, 320, 100
            );

            const completionResults = completionRegion.findMulti(RecognitionObject.ocrThis);
            let challengeCompleted = false;

            // 遍历识别结果
            for (let i = 0; i < completionResults.count; i++) {
                const region = completionResults[i];
                if (region.text.includes("挑战完成")) {
                    challengeCompleted = true;
                    break;
                }
            }

            if (challengeCompleted) {
                log.info("挑战完成");
                break;
            }
            // 随机执行一个操作
            const action = actions[Math.floor(Math.random() * actions.length)];
            await action();

        }

        await sleep(20000);
        await genshin.returnMainUi();
        await sleep(1000);
        await genshin.returnMainUi();
    }

    log.info("已达到最大游戏次数{max}次", MAX_GAMES);
    return;


})();
