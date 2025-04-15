/*
    中文 - 英文：
    地脉之花 - Ley Line Outcrop
    地脉 - Ley Line
    启示之花 - Blossom of Revelation
    藏金之花 - Blossom of Wealth

    蓝花=启示之花，产出经验书
    黄花=藏金之花，产出摩拉

*/
(async function () {
    try {
        await genshin.returnMainUi();
        setGameMetrics(1920, 1080, 1)

        // 读取配置文件
        let start = settings.start
        let type = settings.leyLineOutcropType
        let country = settings.country
        let team = settings.team
        let reRun = settings.reRun
        let friendshipTeam = settings.friendshipteam
        let count = settings.count ? settings.count : "6";
        let forceRun = settings.forceRun
        let forceRunPath = settings.forceRunPath
        retry = false;
        retryCount = 0;

        if (!start) {
            throw new Error("请仔细阅读脚本介绍，并在调度器内进行配置，如果你是直接运行的脚本，请将脚本加入调度器内运行！");
        }

        // 读取地脉花类型
        if (!type) {
            log.error("请在游戏中确认地脉花的类型，然后在js设置中选择地脉花的类型。");
            log.error("请在配置组内右键脚本，选择\"修改JS脚本自定义配置\"，根据提示修改配置。");
            return;
        }
        log.info(`地脉花类型：${type}`);
        // 读取点位
        if (!country) {
            log.error("请在游戏中确认地脉花的第一个点的位置，然后在js设置中选择地脉花所在的国家。");
            log.error("请在配置组内右键脚本，选择\"修改JS脚本自定义配置\"，根据提示修改配置。");
            return;
        }
        log.info(`国家：${country}`);
        // 切换队伍
        if (team) {
            console.log(`切换至队伍 ${team}`);
            await genshin.switchParty(team);
        }
        // 读取好感队
        if (friendshipTeam) {
            if (!team) {
                log.error("未配置战斗队伍！当配置了好感队时必须配置战斗队伍！");
                log.error("请在配置组内右键脚本，选择\"修改JS脚本自定义配置\"，根据提示修改配置。");
                return;
            }
            log.info(`好感队：${friendshipTeam}`);
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

        // 可重跑模式
        if (reRun == true) {
            log.info("已开启可重跑模式，将选择可重跑路线"); 
        }

        // 强制运行
        if (forceRun == true) {
            log.info("已开启强制运行，不再识别地脉花位置");
            log.info(`执行策略：${forceRunPath}`);
            try {
                for (let i = 1; i <= 6; i++) {
                    await pathingScript.runFile(`assets/pathing/${forceRunPath}-${i}.json`);
                    await attemptReward(forceRun, retryCount);
                }
            } catch (error) {
                log.info(error.message);
            }
            return;
        }

        // 寻找地脉花位置
        await findLeyLineOutcrop(country, type, retry, retryCount);

        // 分配对应的策略
        // 使用实际坐标LeyLineOutcropX和LeyLineOutcropY进行比较
        let foundStrategy = false;

        if (country == "蒙德") {
            if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -1298, 2172)) {
                foundStrategy = true;
                task = "蒙德1-风起地";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -718, 1803)) {
                foundStrategy = true;
                task = "蒙德2-清泉镇";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -282, 2311)) {
                foundStrategy = true;
                task = "蒙德3-奔狼领";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 241, 2703)) {
                foundStrategy = true;
                task = "蒙德4-风龙废墟";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -1453, 2283)) {
                foundStrategy = true;
                task = "蒙德5-千风神殿";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 5; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -1513, 2774)) {
                foundStrategy = true;
                task = "蒙德6-望风山地";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -1660, 1393)) {
                foundStrategy = true;
                task = "蒙德7-达达乌帕谷";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 5; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            }
        } else if (country == "璃月") {
            if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 73, 1496)) {
                foundStrategy = true;
                task = "璃月1-石门";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -55, 604)) {
                foundStrategy = true;
                task = "璃月3-瑶光滩";
                log.info(`执行策略：${task}`);
                if (reRun == true) {
                    await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                    await attemptReward(forceRun, retryCount); 
                } else {
                    await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                    await attemptReward(forceRun, retryCount);
                }
            }
        } else if (country == "稻妻") {
            if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, -2270, -4068)) {
                foundStrategy = true;
                task = "稻妻3-八酝岛";
                log.info(`执行策略：${task}`);
                if (reRun == true) {
                    await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                    await attemptReward(forceRun, retryCount); 
                } else {
                    await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                    await attemptReward(forceRun, retryCount);
                }
            }
        } else if (country == "枫丹") {
            if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 4183, 2502)) {
                foundStrategy = true;
                task = "枫丹1-秋分山西侧";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 5; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 4963, 4396)) {
                foundStrategy = true;
                task = "枫丹2-芒索斯山东麓";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 4556, 4762)) {
                foundStrategy = true;
                task = "枫丹3-新枫丹科学院";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 2932, 3584)) {
                foundStrategy = true;
                task = "枫丹4-柔灯港";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 4098, 2584)) {
                foundStrategy = true;
                task = "枫丹5-秋分山东侧";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 4761, 2574)) {
                foundStrategy = true;
                task = "枫丹6-厄里那斯";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 6; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            }
        } else if (country == "纳塔") {
            if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 7865, -1824)) {
                foundStrategy = true;
                task = "纳塔1-隆崛坡";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 9029, -2343)) {
                foundStrategy = true;
                task = "纳塔4-溶水域";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 2; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 9687, -2898)) {
                foundStrategy = true;
                task = "纳塔5-安饶之野";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 3; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            } else if (isNearPosition(LeyLineOutcropX, LeyLineOutcropY, 9231, -2155)) {
                foundStrategy = true;
                task = "纳塔6-圣火竞技场";
                log.info(`执行策略：${task}`);
                for (let i = 1; i <= 4; i++) {
                    if (reRun == true) {
                        await pathingScript.runFile(`assets/pathing/rerun/${task}-${i}-rerun.json`);
                        await attemptReward(forceRun, retryCount); 
                    } else {
                        await pathingScript.runFile(`assets/pathing/${task}-${i}.json`);
                        await attemptReward(forceRun, retryCount);
                    }
                }
            }
        }
        if (!foundStrategy) {
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

async function attemptReward(forceRun, retryCount) {
    // 超时处理
    if (retryCount >= 5 && forceRun == false) {
        retryCount = 0;
        throw new Error("超过最大重试次数，领取奖励失败");
    } else if (retryCount >= 5 && forceRun == true) {
        retryCount = 0;
        log.error("超过最大重试次数，领取奖励失败");
        log.info("强制运行模式，继续执行后续路线");
        await genshin.returnMainUi();
        return;
    }
    // 切换好感队
    if (friendshipTeam) {
        log.info(`切换至队伍 ${friendshipTeam}`);
        await genshin.switchParty(friendshipTeam);
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
            if (friendshipTeam) {
                log.info("切换回战斗队伍");
                await genshin.switchParty(team);
            }
            return;
        } else if (originalResin) {
            log.info("选择使用原粹树脂");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
            if (friendshipTeam) {
                log.info("切换回战斗队伍");
                await genshin.switchParty(team);
            }
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
        await attemptReward(forceRun, retryCount);
    }
}
async function closeCustomMarks() {
    await genshin.returnMainUi();
    keyPress("M");
    await sleep(600);
    click(60, 1020);
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
    // 识别地脉花位置
    lanhua = null;
    huanghua = null;

    // 修改：检查locateLeyLineOutcrop的返回值
    const found = await locateLeyLineOutcrop(country, type, retry, retryCount);

    if (!found) {
        // 增加重试次数并再次尝试
        retry = true;
        retryCount++;

        if (retryCount == 1) {
            log.warn("传送到七天神像并关闭自定义标记以避免地脉花图标被遮挡导致找不到地脉花");
            await genshin.tpToStatueOfTheSeven();
            await closeCustomMarks();
        }

        await findLeyLineOutcrop(country, type, retry, retryCount);
    }
}

async function locateLeyLineOutcrop(country, type, retry, retryCount) {
    await sleep(200);
    await genshin.setBigMapZoomLevel(3.0);
    const iconPath = type == "蓝花（经验书）"
        ? "assets/icon/Blossom_of_Revelation.png"
        : "assets/icon/Blossom_of_Wealth.png";

    // 查找地脉花
    const flowerList = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconPath)));

    if (flowerList && flowerList.count > 0) {
        // 找到地脉花，记录位置并计算坐标
        const flower = flowerList[0];
        const flowerType = type == "蓝花（经验书）" ? "经验" : "摩拉";

        if (type == "蓝花（经验书）") {
            lanhua = flower;
        } else {
            huanghua = flower;
        }

        log.info(`找到${flowerType}地脉花,位置：(${flower.x},${flower.y})`);

        // 计算地脉花的实际坐标
        const center = genshin.getPositionFromBigMap();
        const mapZoomLevel = genshin.getBigMapZoomLevel();
        log.info(`地图缩放级别：${mapZoomLevel}`);

        const mapScaleFactor = 2.35; // 地图缩放因子，固定值
        LeyLineOutcropX = (960 - flower.x - 25) * mapZoomLevel / mapScaleFactor + center.x;
        LeyLineOutcropY = (540 - flower.y - 25) * mapZoomLevel / mapScaleFactor + center.y;

        log.info(`地脉花的实际坐标：(${LeyLineOutcropX},${LeyLineOutcropY})`);
        return true; // 修改：返回true表示找到了地脉花
    } else {
        // 未找到地脉花，尝试移动地图或重试
        if (shouldMoveMap(country, retry, retryCount)) {
            // 移动到特定位置再次尝试
            retry = false;
            const position = getMapPosition(country, retryCount);
            log.info(`移动到特定位置：(${position.x},${position.y})`);
            await genshin.moveMapTo(position.x, position.y);
            return await locateLeyLineOutcrop(country, type, retry, retryCount); // 修改：返回递归调用的结果
        }

        log.warn("未找到地脉花");
        return false; // 修改：返回false表示未找到地脉花
    }
}

// 判断是否需要移动地图
function shouldMoveMap(country, retry, retryCount) {
    if (!retry) return false;

    const countryRetryMap = {
        "蒙德": [0, 1, 2],
        "璃月": [0, 1, 2],
        "稻妻": [0, 1],
        "枫丹": [0, 1],
        "纳塔": [0, 1, 2]
    };

    return countryRetryMap[country] && countryRetryMap[country].includes(retryCount);
}

// 获取地图移动位置
function getMapPosition(country, retryCount) {
    const positionMap = {
        "蒙德": [
            { x: -386, y: 2298, name: "奔狼领上方锚点" },
            { x: -1427, y: 1662, name: "南风之狮的庙宇" }
        ],
        "璃月": [
            { x: 253, y: 1285, name: "碧水原七天神像" },
            { x: 342, y: 548, name: "归离原字左边的锚点" }
        ],
        "稻妻": [
            { x: -3233, y: -3533, name: "踏鞴砂七天神像" }
        ],
        "枫丹": [
            { x: 4301, y: 4765, name: "新枫丹科学院锚点" }
        ],
        "纳塔": [
            { x: 9040, y: -2428, name: "虹灵的净土" },
            { x: 8258, y: -1744, name: "硫晶支脉下方锚点" }
        ]
    };

    // 根据国家和重试次数获取对应位置
    const positions = positionMap[country] || [];
    if (positions.length === 0) {
        log.warn(`未找到国家 ${country} 的位置信息`);
        return { x: 0, y: 0, name: "默认位置" };
    }

    const index = Math.min(retryCount, positions.length - 1);
    return positions[index];
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

// 判断坐标是否在指定位置附近（误差范围内）
function isNearPosition(x, y, targetX, targetY) {
    return Math.abs(x - targetX) <= 100 && Math.abs(y - targetY) <= 100;
}
