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
    attemptReward(forcerun, retryCount) 领取奖励
    closeCustomMarks() 关闭自定义标记
    findLeyLineOutcrop() 寻找地脉花位置
    openCustomMarks() 打开自定义标记
*/
(async function () {
    try {
        await genshin.returnMainUi();
        setGameMetrics(1920, 1080, 1)

        // 读取配置文件
        let start = settings.start
        let type = settings.leylineoutcroptype
        let country = settings.country
        let team = settings.team
        let count = settings.count ? settings.count : "6";
        let forcerun = settings.forcerun
        let forcerunpath = settings.forcerunpath
        retry = false;
        retryCount = 0;

        if (start != true) {
            throw new Error("请仔细阅读脚本介绍，并在调度器内进行配置，如果你是直接运行的脚本，请将脚本加入调度器内运行！");
        }

        // 读取地脉花类型
        if (!type) {
            log.error("请在游戏中确认地脉花的类型，然后在js设置中选择地脉花的类型。");
            log.error("请在配置组内右键脚本，选择\"修改JS脚本自定义配置\"，根据提示修改配置。");
            return;
        }
        log.info(`地脉花类型：${type}`);
        //读取点位
        if (!country) {
            log.error("请在游戏中确认地脉花的第一个点的位置，然后在js设置中选择地脉花所在的国家。");
            log.error("请在配置组内右键脚本，选择\"修改JS脚本自定义配置\"，根据提示修改配置。");
            return;
        }
        log.info(`国家：${country}`);
        // 关闭自动拾取
        //dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
        // 切换队伍
        if (team) {
            console.log(`切换至队伍 ${team}`);
            await genshin.switchParty(team);
        }
        // 读取次数
        let timesValue;
        if (!/^-?\d+\.?\d*$/.test(count)) {
            log.warn(`刷取次数 ${count} 不是数字，使用默认次数6次`);
            let count = 6
        } else {
            // 转换为数字
            const num = parseFloat(count);

            // 范围检查
            if (num < 1) {
                timesValue = 1;
                log.info(`⚠️ 次数 ${num} 小于1，已调整为1`);
            } else if (num > 6) {
                timesValue = 6;
                log.info(`⚠️ 次数 ${num} 大于6，已调整为6`);
            } else {
                // 处理小数
                if (!Number.isInteger(num)) {
                    timesValue = Math.floor(num);
                    log.info(`⚠️ 次数 ${num} 不是整数，已向下取整为 ${timesValue}`);
                } else {
                    timesValue = num;
                }
            }
        }
        log.info(`刷取次数：${timesValue}`);

        // 强制运行
        if (forcerun == true) {
            log.info("已开启强制运行，不再识别地脉花位置");
            log.info(`执行策略：${forcerunpath}`);
            try {
                const pathType = type == "蓝花（经验书）" ? "BoR" : "BoW";
                for (let i = 1; i <= 6; i++) {
                    await pathingScript.runFile(`assets/pathing/${pathType}/${forcerunpath}-${i}.json`);
                    await attemptReward(forcerun, retryCount);
                }
            } catch (error) {
                log.info(error.message);
            }
            return;
        }

        // 寻找地脉花位置
        await findLeyLineOutcrop(country, type, retry, retryCount);
        
        // 分配对应的策略
        // 可以通过getBigMapZoomLevel()，获取到中心点坐标和地脉花图标的位置来确定地脉花所处的准确位置，但是作者的数学不好，实在是算不明白，只好先采用这种笨办法了，后续可以对这个进行优化
        if (country == "蒙德" && lanhua && lanhua.x > 1250 && lanhua.x < 1300 && lanhua.y > 600 && lanhua.y < 610 || country == "蒙德" && huanghua && huanghua.x > 1250 && huanghua.x < 1300 && huanghua.y > 600 && huanghua.y < 610) {
            task = "蒙德1-风起地";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "蒙德" && lanhua && lanhua.x > 810 && lanhua.x < 830 && lanhua.y > 880 && lanhua.y < 910 || country == "蒙德" && huanghua && huanghua.x > 810 && huanghua.x < 830 && huanghua.y > 880 && huanghua.y < 910) {
            task = "蒙德2-清泉镇";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "蒙德" && lanhua && lanhua.x > 480 && lanhua.x < 490 && lanhua.y > 490 && lanhua.y < 500) {
            task = "蒙德3-奔狼领";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "蒙德" && lanhua && lanhua.x > 550 && lanhua.x < 600 && lanhua.y > 150 && lanhua.y < 250 || country == "蒙德" && huanghua && huanghua.x > 550 && huanghua.x < 600 && huanghua.y > 150 && huanghua.y < 250) {
            task = "蒙德4-风龙废墟";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "蒙德" && lanhua && lanhua.x > 1380 && lanhua.x < 1390 && lanhua.y > 515 && lanhua.y < 525 || country == "蒙德" && huanghua && huanghua.x > 1380 && huanghua.x < 1390 && huanghua.y > 515 && huanghua.y < 525) {
            task = "蒙德5-千风神殿";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "蒙德" && lanhua && lanhua.x > 1280 && lanhua.x < 1290 && lanhua.y > 170 && lanhua.y < 180 || country == "蒙德" && huanghua && huanghua.x > 1280 && huanghua.x < 1290 && huanghua.y > 170 && huanghua.y < 180) {
            task = "蒙德6-望风山地";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 5; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "蒙德" && lanhua && lanhua.x > 1100 && lanhua.x < 1300 && lanhua.y > 700 && lanhua.y < 900 || country == "蒙德" && huanghua && huanghua.x > 1100 && huanghua.x < 1300 && huanghua.y > 700 && huanghua.y < 900) {
            task = "蒙德7-达达乌帕谷";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 5; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (lanhua && lanhua.x > 1100 && lanhua.x < 1150 && lanhua.y > 300 && lanhua.y < 350) {
            task = "璃月1-石门";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        //} else if (lanhua.x > 1350 && lanhua.x < 1400 && lanhua.y > 400 && lanhua.y < 450 && center.x - lanhua.x >= 1050 && center.x - lanhua.x <= 1060 && center.y - lanhua.y >= 90 && center.y - lanhua.y <= 100) {
        } else if (lanhua && lanhua.x > 1200 && lanhua.x < 1250 && lanhua.y > 450 && lanhua.y < 500) { // 如果改用碧水原七天神像的中心点的话这个也要改
            task = "璃月3-瑶光滩";
            log.info(`执行策略：${task}`);
            await pathingScript.runFile(`assets/pathing/BoR/${task}-1.json`);
            await attemptReward(forcerun, retryCount);
        } else if (lanhua && lanhua.x > 220 && lanhua.x < 270 && lanhua.y > 900 && lanhua.y < 950) {
            task = "稻妻3-八酝岛";
            log.info(`执行策略：${task}`);
            await pathingScript.runFile(`assets/pathing/BoR/${task}-1.json`);
            await attemptReward(forcerun, retryCount);
        } else if (country == "枫丹" && huanghua && huanghua.x > 700 && huanghua.x < 900 && huanghua.y > 900 && huanghua.y < 1100) {
            task = "枫丹1-秋分山西侧";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 5; i++) {
                await pathingScript.runFile(`assets/pathing/BoW/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "枫丹" && lanhua && lanhua.x > 300 && lanhua.x < 500 && lanhua.y > 700 && lanhua.y < 900) {
            task = "枫丹2-芒索斯山东麓";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "枫丹" && lanhua && lanhua.x > 700 && lanhua.x < 800 && lanhua.y > 400 && lanhua.y < 650) {
            task = "枫丹3-新枫丹科学院";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount); 
            }
        } else if (country == "枫丹" && lanhua && lanhua.x > 1800 && lanhua.x < 1900 && lanhua.y > 100 && lanhua.y < 200) {
            task = "枫丹4-柔灯港";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "枫丹" && lanhua && lanhua.x > 800 && lanhua.x < 1000 && lanhua.y > 800 && lanhua.y < 1000 || country == "枫丹" && huanghua && huanghua.x > 800 && huanghua.x < 1000 && huanghua.y > 800 && huanghua.y < 1000) {
            task = "枫丹5-秋分山东侧";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (country == "枫丹" && lanhua && lanhua.x > 300 && lanhua.x < 500 && lanhua.y > 900 && lanhua.y < 1000) {
            task = "枫丹6-厄里那斯";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 6; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }
        } else if (lanhua && lanhua.x > 1100 && lanhua.x < 1200 && lanhua.y > 750 && lanhua.y < 850) {
            task = "纳塔5-圣火竞技场";
            log.info(`执行策略：${task}`);
            for (let i = 1; i <= 4; i++) {
                await pathingScript.runFile(`assets/pathing/BoR/${task}-${i}.json`);
                await attemptReward(forcerun, retryCount);
            }

        } else {
            log.error("未找到对应的地脉花策略，请再次运行脚本");
            log.error("如果仍然不行，请截图*完整的*游戏界面，并反馈给作者！");
            log.error("完整的游戏界面！完整的游戏界面！完整的游戏界面！");
            return;
        }
        await openCustomMarks();
    } catch (e) {
        log.error("出错了！ {error}", e.message);
        await openCustomMarks();
    }
})();

async function attemptReward(forcerun, retryCount) {
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
    let isResinEmpty = false;

    if (resList && resList.count > 0) {
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("使用浓缩树脂")) {
                isValid = true;
                condensedResin = res;
            } else if (res.text.includes("使用原粹树脂")) {
                isValid = true;
                originalResin = res;
            } else if (res.text.includes("补充原粹树脂")) {
                isValid = true;
                isResinEmpty = true;
            }
        }

        if (condensedResin) {
            log.info("选择使用浓缩树脂");
            click(Math.round(condensedResin.x + condensedResin.width / 2), Math.round(condensedResin.y + condensedResin.height / 2));
            return;
        } else if (originalResin) {
            log.info("选择使用原粹树脂");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
            return;
        } else if (isResinEmpty) {
            log.error("识别到补充原粹树脂，看来树脂用完了呢");
            await keyPress("VK_ESCAPE");
            throw new Error("树脂已用完");
        }
    }

    // 重试
    if (!isValid) {
        log.info("当前界面不是地脉之花界面，重试");
        await genshin.returnMainUi();
        await sleep(1000);
        retryCount++;
        await attemptReward(forcerun, retryCount);
    }
}
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

async function findLeyLineOutcrop(country, type, retry, retryCount) {
    if (retryCount >= 5) {
        retryCount = 0;
        throw new Error("寻找地脉花位置失败");
    }
    log.info("寻找地脉花位置");
    keyPress("M");
    await sleep(600);
    /* OCR识别国家，会点到“蒙德城”“璃月港”等地区标注
    await click(1840, 1020);
    await sleep(600);
    let captureRegion = captureGameRegion();
    let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
    for (let i = 0; i < resList.count; i++) {
        let res = resList[i];
        if (res.text.includes(country)) {
            log.info("选择国家: {1}", country);
            click(Math.round(res.x + res.width / 2), Math.round(res.y + res.height / 2));
            break;
        }
    }
    */
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
//     } else if (country == "至冬") {
//         await genshin.moveMapTo(12288, 6144, "至冬");
    } else {
        throw new Error(`未知国家: ${country}`);
    }

    // 应该不需要再延时等待了
    // await sleep(500);
    // 识别地脉花位置
    lanhua = null;
    huanghua = null;

    // 定位地脉花位置
    await locateLeyLineOutcrop(country, type, retry, retryCount);
}

async function locateLeyLineOutcrop(country, type, retry, retryCount) {
    await sleep(200);
    // 使用新的方法来缩放地图
    await genshin.setBigMapZoomLevel(3.0);
    if (type == "蓝花（经验书）") {
        // 经验花的模板匹配
        // 虽然匹配写了多个地脉花的识别，但是还没有写对应的处理逻辑，如果真识别到了多个可能会出问题
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
            //log.info(`国家：${country}，是否重试：${retry}，重试次数：${retryCount}`);
            log.warn("传送到七天神像并关闭自定义标记以避免地脉花图标被遮挡导致找不到地脉花");
            // 优先处理站在地脉花上的情况，不过这个可能性比较小，后续会考虑放到后面处理
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