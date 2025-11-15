eval(file.readTextSync("reward.js"));
eval(file.readTextSync("utils.js"));
(async function () {
    const FARM_MODES = {
        ONCE: "一次性",
        DAILY_LIMIT: "一次性-每日限量",
        DAILY: "每日重置"
    };
    try {
        /**
         * 追加Boss配置
         */
        async function addBoss() {
            //总次数
            const rounds = parseInt(settings.rounds, 10);
            if (isNaN(rounds) || rounds < 0) {
                log.warn(`⚠️无效的挑战次数: {rounds}，将使用 1 作为默认值。`, settings.rounds);
            }
            const totalCount = isNaN(rounds) ? 1 : rounds;

            // 每日刷取上限
            let dailyLimitCount = parseInt(settings.dailyLimitCount, 10);
            if (isNaN(dailyLimitCount) || dailyLimitCount < 0) {
                log.warn(`⚠️无效的每日上限: {dailyLimitCount}，将使用 1 作为默认值。`, settings.dailyLimitCount);
            }
            dailyLimitCount = isNaN(dailyLimitCount) ? 1 : dailyLimitCount;


            //战斗超时时间
            let timeout = parseInt(settings.timeout, 10);
            if (isNaN(timeout)) {
                log.warn(`⚠️无效的超时时间: {timeout}，将使用 240 秒作为默认值。`, settings.timeout)
                timeout = 240;
            }

            // 刷取模式
            if (settings.farmMode === FARM_MODES.ONCE) {
                farmMode = FARM_MODES.ONCE
            } else if (settings.farmMode === FARM_MODES.DAILY_LIMIT) {
                farmMode = FARM_MODES.DAILY_LIMIT
            } else if (settings.farmMode === FARM_MODES.DAILY) {
                farmMode = FARM_MODES.DAILY
            } else {
                throw new Error(`无效的farmMode: ${settings.farmMode}`);
            }

            const newBoss = {
                name: settings.bossSelection,
                totalCount: totalCount,
                remainingCount: totalCount,
                team: settings.switchPartyName,
                returnToStatueAfterEachRound: settings.returnToStatueBeforeStart,
                farmMode: farmMode,
                lastFarmTime: null,
                dailyLimitCount: dailyLimitCount,
                dailyRemainingCount: dailyLimitCount,
                fightParam: {
                    timeout: timeout,
                    strategyName: settings.strategyName,
                }
            };

            config.push(newBoss);
            log.info(`✅Boss "{bossSelection}" 已追加。`, settings.bossSelection);
        }

        /**
         * 移除所有同名Boss配置
         */
        function removeBoss() {
            const name = settings.bossSelection;
            const initialLength = config.length;
            config = config.filter(boss => boss.name !== name);
            log.info(`🗑️删除了 ${initialLength - config.length} 个 "${name}"。`);
        }

        /**
         * 清空所有Boss配置
         */
        function clearAllBosses() {
            config = [];
            log.info("🪦所有 Boss 配置已清空。");
        }

        /**
         * 遍历整个boss讨伐列表，然后按照讨伐次数自动讨伐并领取奖励
         * @async
         * @param {boolean} goToBoss - 是否需要导航到Boss。
         * @param {boolean} isInsufficientResin - 是否因为体力不足而中止。
         * @param {boolean} battleSuccess - 当前一轮讨伐是否成功。
         * @param {boolean} returnToStatueAfterEachRound - 是否在每次讨伐后回到七天神像。
         */
        async function runMain() {

            // --- 打印所有Boss的剩余次数 ---
            for (let i = 0; i < config.length; i++) {
                if (i % 10 === 0) {
                    let currentPage = Math.floor(i / 10) + 1;
                    log.info(`--- 当前boss队列 (第 {currentPage} 页) ---`, currentPage);
                }

                log.info(`🎵{i}.{name} - 剩余: {remainingCount}/{totalCount}, 队伍: {team}`,
                    i + 1,
                    config[i]["name"],
                    config[i]["remainingCount"],
                    config[i]["totalCount"],
                    config[i]["team"]
                );

                const isEndOfPage = (i + 1) % 10 === 0;
                const isLastItem = i === config.length - 1;

                if (isEndOfPage || isLastItem) {
                    // 补齐空行到10行
                    const linesToPad = 10 - (i - (Math.floor(i / 10) * 10) + 1);
                    for (let p = 0; p < linesToPad; p++) {
                        log.info("");
                    }

                    if (isEndOfPage && !isLastItem) {
                        let currentPage = Math.floor((i + 1) / 10);
                        log.info(`⌛️当前第 {currentPage} 页结束，5秒后显示下一页`, currentPage);
                        await sleep(5000);
                    } else if (isLastItem) {
                        log.info(`🔚列表显示完毕，5秒后继续`);
                        await sleep(5000);
                    }
                }
            }

            try {
                let isInsufficientResin = false;
                // --- 遍历Boss列表 ---
                for (let boss of config) {
                    let goToBoss = true;
                    const returnToStatueAfterEachRound = boss.returnToStatueAfterEachRound

                    // --- 检查体力是否足够 ---
                    if (isInsufficientResin) {
                        log.info(`体力不足，结束刷取BOSS材料`)
                        break; 
                    };

                    //刷取模式为 每日限量 or 每日重置 时
                    if (boss.farmMode === FARM_MODES.DAILY_LIMIT || boss.farmMode === FARM_MODES.DAILY) {
                        //如果今天还未刷取，重置今日已刷取次数
                        if (!isToday(boss.lastFarmTime)) {
                            log.info(`今天还未刷取{boss.name}，重置今日刷取次数`, boss.name);
                            boss.dailyRemainingCount = Math.min(boss.dailyLimitCount, boss.remainingCount);
                            boss.lastFarmTime = getToday();
                        }
                        if (boss.dailyRemainingCount < 1) {
                            log.info(`今日刷取{name}达到上限，跳过`, boss.name);
                            continue;
                        }
                    }


                    // --- 检查当前boss剩余需讨伐次数 ---
                    if (boss.remainingCount <= 0 && boss.farmMode === FARM_MODES.ONCE) {
                        log.info(`Boss "{name}" 已完成全部{totalCount}次讨伐。跳过`, boss.name, boss.totalCount);
                        continue;
                    };

                    // --- 切换队伍 ---
                    if (boss.team !== "不切换") {
                        log.info(`切换队伍『{team}』`, boss.team);
                        await genshin.switchParty(boss.team);
                    };

                    // --- 初始化自定战斗参数 ---
                    // let fightParam = new AutoFightParam(boss.fightParam.strategyName)
                    // fightParam.timeout = boss.fightParam.timeout;

                    let remainingCount
                    if (boss.farmMode === FARM_MODES.DAILY_LIMIT || boss.farmMode === FARM_MODES.DAILY) {
                        remainingCount = boss.dailyRemainingCount
                    } else if (boss.farmMode === FARM_MODES.ONCE) {
                        remainingCount = boss.remainingCount
                    }

                    // --- 根据剩余次数循环讨伐 ---
                    for (let round = 1; round <= remainingCount; round++) {
                        let battleSuccess = false;
                        if (isInsufficientResin) {
                            break; // --- 体力不足，停止讨伐 ---
                        }
                        log.info(`📢当前进度：讨伐『{boss.name}』，第{round}/{remainingCount}次,今日限次：{dailyLimitCount}`,
                            boss.name,
                            round,
                            remainingCount,
                            boss.farmMode === FARM_MODES.ONCE ? boss.totalCount : boss.dailyLimitCount
                        );
                        log.info(`使用队伍：{team}，每轮回七天神像：{text}`,
                            boss.team,
                            returnToStatueAfterEachRound ? '是' : '否'
                        );

                        for (let attempt = 1; attempt <= 2; attempt++) {
                            //体力不足和战斗成功后无需重试
                            if (isInsufficientResin || battleSuccess) {
                                break;
                            };
                            if (goToBoss) {
                                log.info(`🏃前往『{name}』`,boss.name);
                                await pathingScript.runFile(`assets/Pathing/${boss.name}前往.json`);
                            };
                            try {

                                log.info(`⚔️开始第 {round} 次讨伐的第 {attempt} 尝试`,round,attempt);
                                await dispatcher.runTask(new SoloTask("AutoFight"));
                                // await dispatcher.runAutoFightTask(fightParam);
                                await autoNavigateToReward();
                                isInsufficientResin = await takeReward(isInsufficientResin);
                                battleSuccess = true;
                                goToBoss = false;
                                // === 更新 讨伐完成次数 与 剩余讨伐次数 ===
                                if (!isInsufficientResin) {
                                    if (boss.farmMode === FARM_MODES.DAILY_LIMIT || boss.farmMode === FARM_MODES.ONCE) {
                                        boss.remainingCount--;
                                    }
                                    if (boss.farmMode === FARM_MODES.DAILY_LIMIT || boss.farmMode === FARM_MODES.DAILY) {
                                        boss.dailyRemainingCount--;
                                    }
                                };
                                break;

                            } catch (error) {
                                log.error(`❌讨伐『${boss.name}』失败: ${error}`);
                                battleSuccess = false;
                                continue;
                            };

                        }

                        if (!battleSuccess) {
                            log.error(`💀战斗失败次数超过2次，跳过当前BOSS ${name}`,boss.name);
                            break;
                        }

                        // 检查是否需要在每次讨伐后回七天神像
                        if (returnToStatueAfterEachRound) {
                            await genshin.tp(2297.630859375, -824.5517578125);
                            await sleep(3000);
                            goToBoss = true;
                        };

                        if (!goToBoss && boss.remainingCount > 0 && !isInsufficientResin) {
                            if (["歌裴莉娅的葬送", "科培琉司的劫罚", "纯水精灵","霜夜巡天灵主","重拳出击鸭"].includes(boss.name)) {
                                await pathingScript.runFile(`assets/Pathing/${boss.name}战斗后快速前往.json`);
                            } else {
                                log.debug("等待5s后BOSS刷新");
                                await sleep(5000);
                            };
                        };
                    }
                }
            }
            catch (error) {
                log.error(`遍历Boss列表失败， ${error}`);
            } finally {
                log.info("📢脚本执行完毕,保存配置");
                file.writeTextSync("assets/config/config.json", JSON.stringify(config, null, 4));
            }
        }

        let config;
        try {
            config = JSON.parse(file.readTextSync("assets/config/config.json"));
        } catch (error) {
            log.error(`读取配置文件失败: ${error}`);
            log.info(`初始化配置`);
            config = [];
        }
        if (!Array.isArray(config)) {
            log.warn("配置文件格式不正确，已重置为空数组");
            config = [];
        }

        const runMode = settings.runMode;
        // === 执行对应操作 ===
        const RUN_MODES = {
            ADD_BOSS: "追加指定Boss及相关配置",
            REMOVE_BOSS: "删除同名Boss及相关配置",
            CLEAR_ALL: "！！删除所有BOSS！！",
            RUN: "运行"
        };

        if (runMode === RUN_MODES.ADD_BOSS) {
            addBoss();
        } else if (runMode === RUN_MODES.REMOVE_BOSS) {
            removeBoss();
        } else if (runMode === RUN_MODES.CLEAR_ALL) {
            clearAllBosses();
        } else if (runMode === RUN_MODES.RUN) {
            await runMain();
        } else {
            log.error("❓️未知的运行模式:", runMode);
        }

        // === 写回配置文件 ===
        if (runMode !== "运行") {
            file.writeTextSync("assets/config/config.json", JSON.stringify(config, null, 4));
        }

    } catch (error) {
        log.error(`💥脚本执行出错: ${error}`);
    }
})();