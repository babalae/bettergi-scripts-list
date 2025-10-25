eval(file.readTextSync("reward.js"));
(async function () {
    try {
        /**
         * 追加Boss配置
         */
        function addBoss() {
            const rounds = parseInt(settings.rounds, 10);
            if (isNaN(rounds) || rounds < 0) {
                console.warn(`⚠️无效的挑战次数: ${settings.rounds}，将使用 1 作为默认值。`);
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
            log.info(`✅Boss "${settings.bossSelection}" 已追加。`);
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
         * @param {boolean} isClaimFailed - 是否因为体力不足而中止。
         * @param {boolean} battleSuccess - 当前一轮讨伐是否成功。
         * @param {boolean} returnToStatueAfterEachRound - 是否在每次讨伐后回到七天神像。
         */
        async function runMain() {
            
            // --- 打印所有Boss的剩余次数 ---
            for (let i = 0; i < config.length; i++) {
                if (i % 10 === 0) {
                    let currentPage = Math.floor(i / 10) + 1;
                    log.info(`--- 当前boss队列 (第 ${currentPage} 页) ---`);
                }

                log.info(`🎵${i + 1}.${config[i]["name"]} - 剩余: ${config[i]["remainingCount"]}/${config[i]["totalCount"]}, 队伍: ${config[i]["team"]}`);

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
                        log.info(`⌛️当前第 ${currentPage} 页结束，5秒后显示下一页`);
                        await sleep(5000);
                    } else if (isLastItem) {
                        log.info(`🔚列表显示完毕，5秒后继续`);
                        await sleep(5000);
                    }
                }
            }
            try {
                let isClaimFailed = false;
                // --- 遍历Boss列表 ---
                for (const boss of config) {
                    let goToBoss = true;
                    const returnToStatueAfterEachRound = boss.returnToStatueAfterEachRound

                    // --- 检查体力是否足够 ---
                    if (isClaimFailed) {
                        break; // 如果体力不足，跳出循环
                    };

                    // --- 检查当前boss剩余需讨伐次数 ---
                    if (boss.remainingCount <= 0) {
                        log.info(`Boss "${boss.name}" 已完成全部${boss.totalCount}次讨伐。跳过`);
                        continue;
                    };

                    // --- 切换队伍 ---
                    if (boss.team !== "不切换") {
                        log.info(`切换队伍『${boss.team}』`);
                        await genshin.switchParty(boss.team);
                    };

                    // --- 根据剩余次数循环讨伐 ---
                    for (let round = 1; round <= boss.remainingCount; round++) {
                        let battleSuccess = false;
                        if (isClaimFailed) {
                            break; // --- 体力不足，停止讨伐 ---
                        }

                        log.info(`📢当前进度：讨伐『${boss.name}』，第${round}/${boss.remainingCount}次`);
                        log.info(`使用队伍：${boss.team}，每轮回七天神像：${returnToStatueAfterEachRound ? '是' : '否'}`);

                        for (let attempt = 1; attempt <= 2; attempt++) {
                            //体力不足和战斗成功后无需重试
                            if (isClaimFailed || battleSuccess) {
                                break;
                            };
                            if (goToBoss) {
                                log.info(`🏃前往『${boss.name}』`);
                                await pathingScript.runFile(`assets/Pathing/${boss.name}前往.json`);
                            };
                            try {

                                log.info(`⚔️开始第 ${attempt} 次讨伐尝试`);
                                await dispatcher.runTask(new SoloTask("AutoFight"));
                                await autoNavigateToReward();
                                isClaimFailed = await takeReward(isClaimFailed);
                                battleSuccess = true;
                                goToBoss = false;
                                // === 更新 讨伐完成次数 与 剩余讨伐次数 ===
                                if (!isClaimFailed) {
                                    boss.remainingCount--;
                                    boss.completedCount++;
                                };
                                break;

                            } catch (error) {
                                log.error(`❌讨伐『${boss.name}』失败: ${error}`);
                                battleSuccess = false;
                                continue;
                            };

                        }

                        if (!battleSuccess) {
                            log.error(`💀战斗失败次数超过2次，跳过当前BOSS ${boss.name}`);
                            break;
                        }

                        // 检查是否需要在每次讨伐后回七天神像
                        if (returnToStatueAfterEachRound) {
                            await genshin.tp(2297.630859375, -824.5517578125);
                            await sleep(3000);
                            goToBoss = true;
                        };

                        if (!goToBoss && boss.remainingCount > 0 && !isClaimFailed) {
                            if (["歌裴莉娅的葬送", "科培琉司的劫罚", "纯水精灵"].includes(boss.name)) {
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
                log.error(`遍历Boss列表失败，error: ${error}`);
            } finally {
                file.writeTextSync("assets/config/config.json", JSON.stringify(config, null, 4));
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
            log.debug("❓️未知的运行模式:", runMode);
        }

        // === 写回配置文件 ===
        if (runMode !== "运行") {
            file.writeTextSync("assets/config/config.json", JSON.stringify(config, null, 4));
        }

    } catch (error) {
        log.error(`💥脚本执行出错: ${error}`);
    }
})();