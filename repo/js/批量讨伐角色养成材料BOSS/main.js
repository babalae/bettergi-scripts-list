(async function () {
    try {
        const autoNavigateToReward = async () => {
            // 定义识别对象
            const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/box.png"));

            let advanceNum = 0;//前进次数
            //调整为俯视视野
            middleButtonClick();
            await sleep(800);
            moveMouseBy(0, 1030);
            await sleep(400);
            moveMouseBy(0, 920);
            await sleep(400);
            moveMouseBy(0, 710);
            log.info("开始领奖");
            while (true) {
                // 1. 优先检查是否已到达领奖点
                let captureRegion = captureGameRegion();
                let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
                let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
                // 检测到特点文字则结束！！！
                if (rewardResult.text == "接触征讨之花") {
                    log.info("已到达领奖点，检测到文字: " + rewardResult.text);
                    return;
                }
                else if (advanceNum > 40) {
                    throw new Error('前进时间超时');
                }
                // 2. 未到达领奖点，则调整视野
                for (let i = 0; i < 100; i++) {
                    captureRegion = captureGameRegion();
                    let iconRes = captureRegion.Find(boxIconRo);
                    let climbTextArea = captureRegion.DeriveCrop(1686, 1030, 60, 23);
                    let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
                    // 检查是否处于攀爬状态
                    if (climbResult.text.toLowerCase() === "space") {
                        log.info("检侧进入攀爬状态，尝试脱离");
                        keyPress("x");
                        await sleep(1000);
                        keyDown("a");
                        await sleep(800);
                        keyUp("a");
                        keyDown("w");
                        await sleep(800);
                        keyUp("w");
                    }
                    if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {
                        advanceNum++;
                        log.info(`视野已调正，前进第${advanceNum}次`);
                        break;
                    } else {
                        // 小幅度调整
                        if (iconRes.y >= 520) moveMouseBy(0, 920);
                        let adjustAmount = iconRes.x < 920 ? -20 : 20;
                        let distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
                        let scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
                        let adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
                        moveMouseBy(adjustAmount * adjustAmount2, 0);
                        await sleep(100);
                    }
                    if (i > 50) throw new Error('视野调整超时');
                }
                // 3. 前进一小步
                keyDown("w");
                await sleep(500);
                keyUp("w");
                await sleep(200); // 等待角色移动稳定
            }
        }

        // === 追加Boss ===
        function addBoss() {
            // 确保 rounds 是有效数字，转换为整数
            const rounds = parseInt(settings.rounds, 10);
            if (isNaN(rounds) || rounds < 0) {
                console.warn(`无效的挑战次数: ${settings.rounds}，将使用 1 作为默认值。`);
            }
            const totalCount = isNaN(rounds) ? 1 : rounds;
            const newBoss = {
                name: settings.bossSelection,
                totalCount: totalCount,
                completedCount: 0,
                remainingCount: totalCount,
                team: settings.switchPartyName,
                returnToStatueAfterEachRound: settings.returnToStatueBeforeStart
            };
            config.push(newBoss);
            log.info(`Boss "${settings.bossSelection}" 已追加。`);
        }

        // === 移除所有同名Boss ===
        function removeBoss() {
            const name = settings.bossSelection;
            const initialLength = config.length;
            config = config.filter(boss => boss.name !== name);
            log.info(`删除了 ${initialLength - config.length} 个 "${name}"。`);
        }

        // === 移除所有Boss ===
        function clearAllBosses() {
            config = [];
            log.info("所有 Boss 配置已清空。");
        }

        // === 开始讨伐 ===
        async function runMain() {
            const debug = true;
            const mainUiRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/mainUi.png"));
            let isClaimFailed = false;//体力不足标志
            // === 打印boss剩余次数 ===
            for (let i = 0; i < config.length; i++) {
                log.info(`${config[i]["name"]} - 剩余: ${config[i]["remainingCount"]}/${config[i]["totalCount"]}, 队伍: ${config[i]["team"]}, 回神像: ${config[i]["returnToStatueAfterEachRound"]},`);
                //BGI的遮罩日志是12行
                if (i % 11 === 0 && i > 0) {
                    log.info("5秒后显示下一页");
                    await sleep(5000);
                }
            };

            //遍历boss列表
            for (let i = 0; i < config.length; i++) {
                
                if (isClaimFailed) {
                    break; // 如果体力不足，跳出循环
                };
                const c = config[i];
                const bossName = c["name"];           // boss 名称
                const totalCount = c["totalCount"];     // 总次数
                // const completedCount = c["completedCount"]; // 已完成次数
                const remainingCount = c["remainingCount"]; // 剩余次数
                const team = c["team"];           // 使用队伍
                const returnToStatueAfterEachRound = c["returnToStatueAfterEachRound"];

                if (remainingCount <= 0) {
                    log.info(`Boss "${bossName}" 已完成全部${totalCount}次讨伐。跳过`);
                    continue;
                }
                log.info(`开始讨伐『${bossName}』，剩余次数：${remainingCount}，使用队伍：${team}，每轮后回七天神像：${returnToStatueAfterEachRound}`);
                
                // === 切换队伍 ===
                if (team !== "不切换") {
                    log.info(`切换队伍『${team}』`);
                    await genshin.switchParty(team);
                }

                // === 是否去七天神像 ===
                if (returnToStatueAfterEachRound) {
                    await genshin.tp(2297.630859375, -824.5517578125);
                    await sleep(3000);
                }
                // === 根据剩余次数循环讨伐 ===
                for (let round = 1; round <= remainingCount; round++) {
                    let attempt = 1;
                    let battleSuccess = false;
                    let goToBoss = true;
                    if (isClaimFailed) {
                        break; // 体力不足，跳出循环
                    }
                    log.info(`当前进度：讨伐『${bossName}』，剩余次数：${remainingCount}，第${round}/${remainingCount}次，使用队伍：${team}，每轮后回七天神像：${returnToStatueAfterEachRound}`);
                    //尝试讨伐大于2次、战斗成功、体力不足领取失败 任一条件达成则停止
                    while (attempt <= 2 && !battleSuccess && !isClaimFailed) {
                        if (goToBoss) {
                            log.info(`执行前往『${bossName}』的路线`);
                            await pathingScript.runFile(`assets/Pathing/${bossName}前往.json`);
                            // await keyMouseScript.runFile(`assets/Pathing/${bossName}前往键鼠.json`);
                        }

                        log.info(`开始第 ${attempt} 次讨伐尝试`);
                        try {
                            await dispatcher.runTask(new SoloTask("AutoFight"));
                            await autoNavigateToReward()

                            // === 领取boss的地脉之花 === 
                            while (true) {
                                if (debug) {
                                    log.info("调试模式，跳过领取奖励");
                                    break; 
                                }
                                captureRegion = captureGameRegion();

                                // 点击F领取Boss地脉花
                                let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
                                let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
                                if (rewardResult.text == "接触征讨之花" && isClaimFailed == false) {
                                    keyPress("F");
                                    await sleep(1000);
                                }
                                
                                // 使用脆弱树脂领取奖励
                                let useTextArea = captureRegion.DeriveCrop(850, 740, 250, 35);
                                let useResult = useTextArea.find(RecognitionObject.ocrThis);
                                if ("补充" in closeResult.text) {
                                    log.info("脆弱树脂不足，跳过领取");
                                    click(1345, 300);
                                    await sleep(1000);
                                    isClaimFailed = true;
                                }
                                else if ("使用" in useResult.text) {
                                    log.info("使用脆弱树脂领取奖励");
                                    click(useResult.x, useResult.y);
                                    await sleep(3000);
                                }

                                // 关闭奖励界面
                                let closeRewardUi = captureRegion.DeriveCrop(860, 970, 200, 28);
                                let closeResult = closeRewardUi.find(RecognitionObject.ocrThis);
                                if ("点击" in closeResult.text) {
                                    click(975, 1000);//点击空白区域
                                    await sleep(1000);
                                }
                                
                                // 检查是否回到主界面
                                let inMainUi = captureRegion.Find(mainUiRo);
                                if (inMainUi.x > 0) {
                                    break; 
                                }

                            }
                            // === 领取结束 === 
                            battleSuccess = true;
                            // === 更新 讨伐完成次数 与 剩余讨伐次数 ===
                            config[i]["remainingCount"]--;
                            config[i]["completedCount"]++;
                            //防止意外中断，导致已讨伐次数未保存，每次战斗成功都保存一次。
                            file.writeTextSync("assets/config/config.json", JSON.stringify(config, null, 4));
                        } catch (error) {
                            log.error(`战斗失败，重试 ${attempt}/2 次`);
                            goToBoss = true;
                            attempt++;
                        }
                    }

                    if (!battleSuccess) {
                        log.error(`战斗失败次数超过2次，跳过BOSS ${bossName}`);
                        break;
                    }

                    // 检查是否需要在每次讨伐后回七天神像
                    if (returnToStatueAfterEachRound) {
                        await genshin.tp(2297.630859375, -824.5517578125);
                        await sleep(3000);
                    } else {
                        goToBoss = false;
                        log.debug("等待5s后BOSS刷新");
                        await sleep(5000);
                    }
                }
            }

        }

        const content = file.readTextSync("assets/config/config.json");
        let config = JSON.parse(content);

        if (!Array.isArray(config)) {
            config = [];
        }
        const runMode = settings.runMode;
        const modeHandlers = {
            "追加指定Boss及相关配置": addBoss,
            "删除同名Boss及相关配置": removeBoss,
            "！！删除所有BOSS！！": clearAllBosses,
            "运行": runMain,
        };

        // === 执行对应操作 ===
        const handler = modeHandlers[runMode];
        if (handler) {
            await handler();
        } else {
            log.debug("未知的运行模式:", runMode);
        }

        // === 写回配置文件 ===
        if (runMode !== "运行") {
            file.writeTextSync("assets/config/config.json", JSON.stringify(config, null, 4));
        }

    } catch (error) {
        log.error(`脚本执行出错: ${error}`);
    }
})();