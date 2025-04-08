/*
    一些值得留意的信息：
    
    中文 - 英文：
    地脉之花 - Ley Line Outcrop
    地脉 - Ley Line
    启示之花 - Blossom of Revelation
    藏金之花 - Blossom of Wealth

    蓝花=启示之花，产出经验书
    黄花=藏金之花，产出摩拉

    脚本函数：
    attemptReward(forcerun) 领取奖励
    closeCustomMarks() 关闭自定义标记
    findLeyLineOutcrop() 寻找地脉花位置
    openCustomMarks() 打开自定义标记
    zoomMap() 缩放地图
*/

(async function () {
    try {
        // 初始化游戏界面
        await genshin.returnMainUi();
        setGameMetrics(1920, 1080, 1);

        // 读取配置文件
        const { start, leylineoutcroptype: type, country, team, count = "6", forcerun, forcerunpath } = settings;
        let retry = false, retryCount = 0;

        if (!start) throw new Error("请仔细阅读脚本介绍，并在调度器内进行配置，如果你是直接运行的脚本，请将脚本加入调度器内运行！");

        // 检查地脉花类型
        if (!type) {
            log.error("请在游戏中确认地脉花的类型，然后在js设置中选择地脉花的类型。");
            log.error("请在配置组内右键脚本，选择\"修改JS脚本自定义配置\"，根据提示修改配置。");
            return;
        }
        log.info(`地脉花类型：${type}`);

        // 检查国家
        if (!country) {
            log.error("请在游戏中确认地脉花的第一个点的位置，然后在js设置中选择地脉花所在的国家。");
            log.error("请在配置组内右键脚本，选择\"修改JS脚本自定义配置\"，根据提示修改配置。");
            return;
        }
        log.info(`国家：${country}`);

        // 关闭自动拾取
        dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));

        // 切换队伍
        if (team) {
            log.info(`切换至队伍 ${team}`);
            await genshin.switchParty(team);
        }

        // 处理刷取次数
        const timesValue = parseCount(count);
        log.info(`刷取次数：${timesValue}`);

        // 强制运行模式
        if (forcerun) {
            log.info("已开启强制运行，不再识别地脉花位置");
            log.info(`执行策略：${forcerunpath}`);
            await executeForcedRun(type, forcerunpath, forcerun);
            return;
        }

        // 寻找地脉花位置
        await findLeyLineOutcrop(country, type, retry, retryCount);

        // 分配策略并执行
        await assignAndExecuteStrategy(country, type, retry, retryCount, forcerun);

        // 打开自定义标记
        await openCustomMarks();
    } catch (e) {
        log.error("出错了！", e.message);
        await openCustomMarks();
    }
})();

// 解析刷取次数
function parseCount(count) {
    if (!/^-?\d+\.?\d*$/.test(count)) {
        log.warn(`刷取次数 ${count} 不是数字，使用默认次数6次`);
        return 6;
    }
    const num = parseFloat(count);
    if (num < 1) {
        log.info(`⚠️ 次数 ${num} 小于1，已调整为1`);
        return 1;
    }
    if (num > 6) {
        log.info(`⚠️ 次数 ${num} 大于6，已调整为6`);
        return 6;
    }
    if (!Number.isInteger(num)) {
        const floored = Math.floor(num);
        log.info(`⚠️ 次数 ${num} 不是整数，已向下取整为 ${floored}`);
        return floored;
    }
    return num;
}

// 执行强制运行模式
async function executeForcedRun(type, forcerunpath, forcerun) {
    try {
        const pathType = type === "蓝花（经验书）" ? "BoR" : "BoW";
        for (let i = 1; i <= 6; i++) {
            await pathingScript.runFile(`assets/pathing/${pathType}/${forcerunpath}-${i}.json`);
            await attemptReward(forcerun);
        }
    } catch (error) {
        log.error(error.message);
    }
}

// 分配策略并执行
async function assignAndExecuteStrategy(country, type, retry, retryCount, forcerun) {
    if (country == "蒙德" && lanhua && lanhua.x > 1250 && lanhua.x < 1300 && lanhua.y > 600 && lanhua.y < 610 || country == "蒙德" && huanghua && huanghua.x > 1250 && huanghua.x < 1300 && huanghua.y > 600 && huanghua.y < 610) {
        task = "蒙德1-风起地";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "蒙德" && lanhua && lanhua.x > 810 && lanhua.x < 830 && lanhua.y > 880 && lanhua.y < 910 || country == "蒙德" && huanghua && huanghua.x > 810 && huanghua.x < 830 && huanghua.y > 880 && huanghua.y < 910) {
        task = "蒙德2-清泉镇";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "蒙德" && lanhua && lanhua.x > 480 && lanhua.x < 490 && lanhua.y > 490 && lanhua.y < 500) {
        task = "蒙德3-奔狼领";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "蒙德" && lanhua && lanhua.x > 550 && lanhua.x < 600 && lanhua.y > 150 && lanhua.y < 250 || country == "蒙德" && huanghua && huanghua.x > 550 && huanghua.x < 600 && huanghua.y > 150 && huanghua.y < 250) {
        task = "蒙德4-风龙废墟";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "蒙德" && lanhua && lanhua.x > 1380 && lanhua.x < 1390 && lanhua.y > 515 && lanhua.y < 525 || country == "蒙德" && huanghua && huanghua.x > 1380 && huanghua.x < 1390 && huanghua.y > 515 && huanghua.y < 525) {
        task = "蒙德5-千风神殿";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "蒙德" && lanhua && lanhua.x > 1280 && lanhua.x < 1290 && lanhua.y > 170 && lanhua.y < 180 || country == "蒙德" && huanghua && huanghua.x > 1280 && huanghua.x < 1290 && huanghua.y > 170 && huanghua.y < 180) {
        task = "蒙德6-望风山地";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 5; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "蒙德" && lanhua && lanhua.x > 1100 && lanhua.x < 1300 && lanhua.y > 700 && lanhua.y < 900 || country == "蒙德" && huanghua && huanghua.x > 1100 && huanghua.x < 1300 && huanghua.y > 700 && huanghua.y < 900) {
        task = "蒙德7-达达乌帕谷";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 5; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (lanhua && lanhua.x > 1100 && lanhua.x < 1150 && lanhua.y > 300 && lanhua.y < 350) {
        task = "璃月1-石门";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (lanhua && lanhua.x > 1200 && lanhua.x < 1250 && lanhua.y > 450 && lanhua.y < 500) { // 如果改用碧水原七天神像的中心点的话这个也要改
        task = "璃月3-瑶光滩";
        log.info(`执行策略：${task}`);
        await pathingScript.runFile(`assets/pathing/BoR/${task}-1.json`);
        await attemptReward(forcerun);
    } else if (lanhua && lanhua.x > 220 && lanhua.x < 270 && lanhua.y > 900 && lanhua.y < 950) {
        task = "稻妻3-八酝岛";
        log.info(`执行策略：${task}`);
        await pathingScript.runFile(`assets/pathing/BoR/${task}-1.json`);
        await attemptReward(forcerun);
    } else if (country == "枫丹" && huanghua && huanghua.x > 700 && huanghua.x < 900 && huanghua.y > 900 && huanghua.y < 1100) {
        task = "枫丹1-秋分山西侧";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 5; i++) {
            await pathingScript.runFile(`assets/pathing/BoW/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "枫丹" && lanhua && lanhua.x > 300 && lanhua.x < 500 && lanhua.y > 700 && lanhua.y < 900) {
        task = "枫丹2-芒索斯山东麓";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "枫丹" && lanhua && lanhua.x > 800 && lanhua.x < 1000 && lanhua.y > 800 && lanhua.y < 1000 || country == "枫丹" && huanghua && huanghua.x > 800 && huanghua.x < 1000 && huanghua.y > 800 && huanghua.y < 1000) {
        task = "枫丹5-秋分山东侧";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (country == "枫丹" && lanhua && lanhua.x > 300 && lanhua.x < 500 && lanhua.y > 900 && lanhua.y < 1000) {
        task = "枫丹6-厄里那斯";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 6; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }
    } else if (lanhua && lanhua.x > 1100 && lanhua.x < 1200 && lanhua.y > 750 && lanhua.y < 850) {
        task = "纳塔5-圣火竞技场";
        log.info(`执行策略：${task}`);
        for (let i = 1; i <= 4; i++) {
            await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
            await attemptReward(forcerun);
        }

    } else {
        log.error("未找到对应的地脉花策略，请再次运行脚本");
        log.error("如果仍然不行，请截图*完整的*游戏界面，并反馈给作者！");
        log.error("完整的游戏界面！完整的游戏界面！完整的游戏界面！");
        return;
    }
}

// 领取奖励
async function attemptReward(forcerun) {
    // 超时处理
    if (retryCount >= 5 && forcerun == false) {
        retryCount = 0;
        throw new Error("超过最大重试次数，领取奖励失败");
    } else if (retryCount >= 5 && forcerun == true) {
        retryCount = 0;
        log.error("超过最大重试次数，领取奖励失败");
        log.info("强制运行模式，继续执行后续路线");
        await genshin.returnMainUi();
        return;
    }
    log.info("领取奖励，优先使用浓缩树脂");
    keyPress("F");
    await sleep(500);
    // 识别是否为地脉之花界面
    let resList = captureGameRegion().findMulti(RecognitionObject.ocrThis);
    let isValid = false;
    let condensedResin = null;
    let originalResin = null;

    if (resList && resList.count > 0) {
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("使用浓缩树脂")) {
                condensedResin = res;
            } else if (res.text.includes("使用原粹树脂")) {
                originalResin = res;
            } else if (res.text.includes("补充原粹树脂")) {
                // 树脂用完了，结束脚本
                isValid = true;
                log.error("识别到补充原粹树脂，看来树脂用完了呢");
                await keyPress("VK_ESCAPE");
                throw new Error("树脂已用完");
            }
        }

        if (condensedResin) {
            isValid = true;
            log.info("选择使用浓缩树脂");
            click(Math.round(condensedResin.x + condensedResin.width / 2), Math.round(condensedResin.y + condensedResin.height / 2));
            return;
        } else if (originalResin) {
            isValid = true;
            log.info("选择使用原粹树脂");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
            return;
        }
    }

    // 重试
    if (!isValid) {
        log.info("当前界面不是地脉之花界面，重新执行代码");
        await genshin.returnMainUi();
        await sleep(1000);
        retryCount++;
        await attemptReward(forcerun);
    }
}

// 关闭自定义标记
async function closeCustomMarks() {
    await genshin.returnMainUi();
    keyPress("M");
    await sleep(600);
    click(60,1020);
    await sleep(600);
    let button = captureGameRegion().find(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/open.png"),));
    if (button) {
        log.info("关闭自定义标记");
        click(Math.round(button.x + button.width / 2), Math.round(button.y + button.height / 2));
        await sleep(600);
    } else {
        log.error("未找到开关按钮");
    }
    await genshin.returnMainUi();
}

// 寻找地脉花位置
async function findLeyLineOutcrop(country, type, retry, retryCount) {
    if (retryCount >= 5) {
        retryCount = 0;
        throw new Error("寻找地脉花位置失败");
    }
    log.info("寻找地脉花位置");
    keyPress("M");
    await sleep(600);
    if (country == "蒙德") {
        await genshin.moveMapTo(-876, 2278, "蒙德");
    } else if (country == "璃月") {
        await genshin.moveMapTo(270, -666, "璃月");
    } else if (country == "稻妻") {
        await genshin.moveMapTo(-4400, -3050, "稻妻");
    } else if (country == "须弥") {
        await genshin.moveMapTo(2877, -374, "须弥");
    } else if (country == "枫丹") {
        await genshin.moveMapTo(4029, 3054, "枫丹"); //吞星之鲸周本
    } else if (country == "纳塔") {
        await genshin.moveMapTo(9541, -1782, "纳塔"); //镜璧山七天神像
    } else {
        throw new Error(`未知国家: ${country}`);
    }

    // 定位地脉花位置
    await locateLeyLineOutcrop(country, type, retry, retryCount);
}

// 定位地脉花位置
async function locateLeyLineOutcrop(country, type, retry, retryCount) {
    await sleep(200);
    // 设置地图缩放倍率
    await genshin.setBigMapZoomLevel(3.0);
    if (type == "蓝花（经验书）") {
        // 经验花的模板匹配
        let lanhuaList = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/Blossom_of_Revelation.png")));
        if (lanhuaList && lanhuaList.count > 0) {
            for (let i = 0; i < lanhuaList.count; i++) {
                lanhua = lanhuaList[i];
                log.info("找到经验地脉花,位置({x},{y})", lanhua.x, lanhua.y);
                center = genshin.getPositionFromBigMap();
            }
        } else {
            // 部分地脉花需要拖动地图才能找到
            if (country == "蒙德" && retry == true && retryCount == 1) {
                // 蒙德4
                retry = false;
                await genshin.moveMapTo(-386, 2298); // 奔狼领上方锚点
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "璃月" && retry == true && retryCount == 1) {
                // 璃月1
                retry = false;
                await genshin.moveMapTo(253, 1285); // 碧水原七天神像
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "璃月" && retry == true && retryCount == 2) {
                // 璃月3
                retry = false;
                await genshin.moveMapTo(342, 548); // 归离原字左边的锚点
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "稻妻" && retry == true && retryCount == 1) {
                // 稻妻3
                retry = false;
                await genshin.moveMapTo(-3233, -3533); // 踏鞴砂七天神像
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "枫丹" && retry == true && retryCount == 1) {
                // 枫丹5 6
                retry = false;
                await genshin.moveMapTo(4301, 4765); // 新枫丹科学院锚点
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            }
            retryCount++;
            retry = true;
            log.warn("未找到地脉花");
            log.warn("传送到七天神像并关闭自定义标记以避免地脉花图标被遮挡导致找不到地脉花");
            await genshin.tpToStatueOfTheSeven();
            await closeCustomMarks();
            await findLeyLineOutcrop(country, type, retry, retryCount);
            return;
        }
    } else {
        let huanghuaList = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/Blossom_of_Wealth.png")));
        if (huanghuaList && huanghuaList.count > 0) {
            for (let i = 0; i < huanghuaList.count; i++) {
                huanghua = huanghuaList[i];
                log.info("找到摩拉地脉花,位置({x},{y})", huanghua.x, huanghua.y);
            }
        } else {
            // 部分地脉花需要拖动地图才能找到
            if (country == "蒙德" && retry == true && retryCount == 1) {
                // 蒙德4
                retry = false;
                await genshin.moveMapTo(-386, 2298); // 奔狼领上方锚点
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "蒙德" && retry == true && retryCount == 2) {
                // 蒙德6
                retry = false;
                await genshin.moveMapTo(-1427, 1662); // 南风之狮的庙宇
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "璃月" && retry == true && retryCount == 1) {
                // 璃月1
                retry = false;
                await genshin.moveMapTo(253, 1285); // 碧水原七天神像
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "璃月" && retry == true && retryCount == 2) {
                // 璃月3
                retry = false;
                await genshin.moveMapTo(342, 548); // 归离原字左边的锚点
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "稻妻" && retry == true && retryCount == 1) {
                // 稻妻3
                retry = false;
                await genshin.moveMapTo(-3233, -3533); // 踏鞴砂七天神像
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            } else if (country == "枫丹" && retry == true && retryCount == 1) {
                // 枫丹5 6
                retry = false;
                await genshin.moveMapTo(4301, 4765); // 新枫丹科学院锚点
                await locateLeyLineOutcrop(country, type, retry, retryCount);
                return;
            }
            retry = true;
            retryCount++;
            log.warn("未找到地脉花");
            if (retryCount == 1) {
                log.warn("传送到七天神像并关闭自定义标记以避免地脉花图标被遮挡导致找不到地脉花");
                await genshin.tpToStatueOfTheSeven();
                await closeCustomMarks();
            }
            await findLeyLineOutcrop(country, type, retry, retryCount);
            return;
        }
    }
}

// 打开自定义标记
async function openCustomMarks() {
    await genshin.returnMainUi();
    keyPress("M");
    await sleep(600);
    click(60, 1020);
    await sleep(600);
    let button = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/close.png"),));
    if (button) {
        for (let i = 0; i < button.count; i++) {
            b = button[i];
            if (b.y > 280 && b.y < 350) {
                log.info("打开自定义标记");
                click(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
            }
        }
    } else {
        log.error("未找到开关按钮");
    }
    await genshin.returnMainUi();
}

// 纯点击的缩放地图，已弃用
async function zoomMap() {
    // 缩小地图
    await sleep(1000);
    await click(50, 640);
    await sleep(500);
    await click(50, 640);
    await sleep(500);
    await click(50, 640);
    await sleep(500);
    await click(50, 640);
    await sleep(500);
    await click(50, 640);
    await sleep(500);
    // 放大
    await click(50, 450);
    await sleep(500);
    await click(50, 450);
    await sleep(500);
}