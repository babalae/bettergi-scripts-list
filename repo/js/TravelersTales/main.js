
// 全局变量声明
let data, config;
let characterX, characterY;
let avatar;
let failed = false;

(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    dispatcher.addTimer(new RealtimeTimer("AutoSkip")); // 开启自动剧情
    await loadData();

    // 检查进度并显示统计信息
    const progressInfo = checkProgress(characterPositions);

    if (settings.showStatistics) {
        log.info(`=== 对话进度统计 ===`);
        log.info(`总角色数量: ${progressInfo.total}`);
        log.info(`已完成: ${progressInfo.completed} (${progressInfo.completionRate}%)`);
        log.info(`待完成: ${progressInfo.remaining}`);
    }

    // 处理重置设置
    await handleResetSettings(characterPositions);

    // 重新检查进度（可能已重置）
    let currentProgress = checkProgress(characterPositions);

    if (currentProgress.remaining === 0) {
        log.info("所有角色都已完成对话！");
        log.info("如需在其他账号使用，请在设置中启用自动重置选项");
        return;
    }

    if (settings.showRemainingCharacters && currentProgress.remaining > 0) {
        log.info(`未完成的角色: ${currentProgress.remainingCharacters.join(", ")}`);
    }    // 前往七天神像
    // await genshin.tpToStatueOfTheSeven();
    let runCount = 0;
    const maxRuns = parseInt(settings.maxRuns) || 3;

    if (settings.enableDetailedLogs) {
        log.info(`最大运行次数: ${maxRuns}`);
    }
    // showCurrentSettings();

    let failCount = 0;
    let lastProgress = -1;

    let skipList = [];

    while (runCount < maxRuns) {
        if (settings.enableProgressLogs) {
            log.info(`开始第${runCount + 1}次运行`);
        }

        // 在每次运行前检查是否还有未完成的角色
        currentProgress = checkProgress(characterPositions);

        if (currentProgress.remaining === lastProgress) {
            log.warn("与上轮循环剩余数量一致，可能所有点位都不可用或运行失败");
            failCount++;
        }
        else {
            failCount = 0;
        }

        lastProgress = currentProgress.remaining;

        if (failCount >= 4) {
            log.error("连续五轮循环剩余数量没有变化，结束循环，请手动清理现在在地图上的旅闻后重新启动js")
            break;
        }

        if (currentProgress.remaining === 0) {
            log.info("🎉 所有角色都已完成对话！任务结束。");
            break;
        }

        if (settings.enableProgressLogs) {
            log.info(`当前进度: ${currentProgress.completed}/${currentProgress.total} (剩余${currentProgress.remaining}个)`);
        }

        const detectedCharacters = await find();
        let pathingName = null;
        let hasKeyMouse = false;
        let found = false;
        let matchedNames = [];
        for (const pos of characterPositions) {
            // 如果启用了跳过已完成角色的设置，则跳过已完成的角色
            if (settings.skipCompletedCharacters && config[pos.name]) {
                skipList.push(pos.name);
            }

            // 使用 Set 去除重复项
            skipList = [...new Set(skipList)];
            if (!config[pos.name] && isNearPosition(characterX, characterY, pos.x, pos.y)) {
                matchedNames.push(pos.name);
            }
        }
        if (matchedNames.length === 1) {
            pathingName = matchedNames[0];
            const pos = characterPositions.find(p => p.name === pathingName);
            hasKeyMouse = !!(pos && pos.hasKeyMouse);
            found = true;
            log.info(`找到角色，执行路线：${pathingName}`);
        } else if (matchedNames.length > 1) {
            log.info(`找到多个路线：${matchedNames.join(", ")}`);

            // 首先尝试通过检测到的角色名字进行匹配
            let foundByName = false;
            for (const name of matchedNames) {
                if (skipList.includes(name)) {
                    continue;
                }
                const avatarName = name.split("-")[0];
                if (detectedCharacters.includes(avatarName)) {
                    pathingName = name;
                    const pos = characterPositions.find(p => p.name === pathingName);
                    hasKeyMouse = !!(pos && pos.hasKeyMouse);
                    found = true;
                    log.info(`通过角色名字匹配到路线：${pathingName} (角色：${avatarName})`);
                    foundByName = true;
                    break;
                }
            }

            // 如果通过角色名字没有找到，则回退到原来的图像识别方法
            if (!foundByName) {
                for (const name of matchedNames) {
                    if (skipList.includes(name)) {
                        continue;
                    }
                    const avatarName = name.split("-")[0];
                    const ro = captureGameRegion();
                    const isChar = ro.findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/avatars/${avatarName}.png`)));
                    ro.dispose();
                    if (isChar && isChar.count > 0) {
                        pathingName = name;
                        const pos = characterPositions.find(p => p.name === pathingName);
                        hasKeyMouse = !!(pos && pos.hasKeyMouse);
                        found = true;
                        log.info(`通过图像识别匹配到路线：${pathingName}`);
                        break;
                    }
                }
            }
        }
        if (!found) {
            currentProgress = checkProgress(characterPositions);
            log.error("未找到角色，或者当前位置可能没有未完成的角色对话");
            log.error(`剩余未完成角色: ${currentProgress.remainingCharacters.join(", ")}`);
            log.info("继续寻找下一个角色...");
            continue; // 继续下一次循环而不是直接返回
        }
        log.info(`正在前往 ${pathingName} 所在位置...`);
        if (pathingName == "赛诺-3") { // 特殊处理
            await genshin.moveMapTo(2871, -377, "须弥");
            await genshin.setBigMapZoomLevel(1.0);
            await genshin.tp(2871, -377);
        }
        await pathingScript.runFile(`assets/pathing/${pathingName}.json`)
        await sleep(500);
        keyPress("F");
        await sleep(500);
        keyPress("F");
        if (!hasKeyMouse) {
            log.info("开始对话...");
        }
        await sleep(3000);
        await waitToMain(hasKeyMouse);
        if (hasKeyMouse) {
            log.info("执行对应键鼠脚本");
            await keyMouseScript.runFile(`assets/keymouse/${pathingName}.json`)
            await sleep(500);
            keyPress("F");
            await sleep(500);
            keyPress("F");
            log.info("开始对话...");
            await sleep(3000);
            await waitToMain(hasKeyMouse);
        }
        config[pathingName] = true;
        if (failed) {
            log.info("本次运行结果不会被保存");
            // 将 pathingName 加入 skipList
            skipList.push(pathingName);
        } else {
            config[pathingName] = true;
            await file.writeText("config.json", JSON.stringify(config, null, 4));
            log.info(`对话完成，已保存本次运行结果`);
        }
        runCount++;
        if (runCount < maxRuns) {
            log.info(`第${runCount}次运行完成`);
            // 根据设置决定进度更新间隔
            const updateInterval = parseInt(settings.progressUpdateInterval) || 5;
            if (runCount % updateInterval === 0) {
                currentProgress = checkProgress(characterPositions);
                log.info(`=== 进度更新 (第${runCount}次运行后) ===`);
                log.info(`完成进度: ${currentProgress.completed}/${currentProgress.total} (${currentProgress.completionRate}%)`);
                if (currentProgress.remaining > 0) {
                    log.info(`剩余角色: ${currentProgress.remainingCharacters.slice(0, 5).join(", ")}${currentProgress.remaining > 5 ? '...' : ''}`);
                }
            }
        }
    }

    // 最终统计
    const finalProgress = checkProgress(characterPositions);
    log.info(`=== 任务完成统计 ===`);
    log.info(`总运行次数: ${runCount}`);
    log.info(`最终完成进度: ${finalProgress.completed}/${finalProgress.total} (${finalProgress.completionRate}%)`);

    if (finalProgress.remaining === 0) {
        log.info("🎉 恭喜！所有角色对话已完成！");
    } else {
        log.info(`还有 ${finalProgress.remaining} 个角色未完成:`);
        log.info(finalProgress.remainingCharacters.join(", "));
        log.info("可以重新运行程序继续完成剩余角色");
    }

    log.info(`程序结束`);
})();

/**
 * 加载数据
 * @returns {Promise<void>}
 */
async function loadData() {
    try {
        data = JSON.parse(await file.readText("data.json"));
        config = JSON.parse(await file.readText("config.json"));
        characterPositions = JSON.parse(await file.readText("positions.json"));

        if (settings.enableDetailedLogs) {
            log.info("数据加载完成");
        }
    } catch (error) {
        log.error(`加载配置文件失败: ${error.message}`);
    }
}
/**
 * 寻找角色
 * @async
 * @returns {Promise<string[]>} 找到的角色名字数组，如果没有找到则返回空数组
 */
async function find() {
    const positions = data.mapPositions; // 读取data.json中的点位数据
    for (let retryCount = 0; retryCount < positions.length; retryCount++) {
        position = positions[retryCount];

        if (settings.enableDetailedLogs) {
            log.info(`第 ${retryCount + 1} 次尝试定位...`);
            log.info(`移动到位置：(${position.x}, ${position.y}), ${position.name || '未命名位置'}`);
        }

        await genshin.moveMapTo(position.x, position.y, position.country);
        log.info(`缩放等级为${(position.zoom && typeof position.zoom === "number") ? position.zoom : 6.0}`);
        await genshin.setBigMapZoomLevel((position.zoom && typeof position.zoom === "number") ? position.zoom : 6.0);
        await sleep(1000); // 确保画面稳定
        try {
            const detectedNames = await locate();
            if (detectedNames && detectedNames.length > 0) {
                return detectedNames; // 保持兼容性，设置全局变量
            }
        } catch (error) {
            log.debug(error.message);
            continue;
        }
    }
    log.error("寻找所有角色可能存在的位置都没有找到角色");
    throw new Error("在所有可能的位置都没有找到角色，结束任务");
}

/**
 * 定位角色并获取坐标
 * @async
 * @returns {Promise<string[]>} 检测到的角色名字数组
 */
async function locate() {
    await sleep(500); // 确保画面稳定
    await genshin.setBigMapZoomLevel((position && typeof position.zoom === "number") ? position.zoom : 6.0);
    log.info(`设置大地图缩放级别为 ${position.zoom || 6.0}`);

    let ro1 = captureGameRegion();
    let character = await ro1.findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/三个点.png")));
    ro1.dispose();
    await sleep(500);
    if (character && character.count > 0) {
        avatar = character[0];

        const center = genshin.getPositionFromBigMap();
        const mapZoomLevel = genshin.getBigMapZoomLevel();
        const mapScaleFactor = 2.361;

        characterX = (960 - avatar.x - 13) * mapZoomLevel / mapScaleFactor + center.x + 20;
        characterY = (540 - avatar.y - 13) * mapZoomLevel / mapScaleFactor + center.y + 20;
        if (settings.enableDetailedLogs) {
            log.info(`找到角色的大致坐标：(${characterX}, ${characterY})`);
        }

        await sleep(200);
        click(avatar.x + 20, avatar.y + 20);
        await sleep(2000);
        let ro2 = captureGameRegion();
        let resList = ro2.findMulti(RecognitionObject.ocrThis);
        ro2.dispose();

        // 识别text中的角色名字
        const characterNames = [
            "安柏","香菱","行秋","凝光","菲谢尔","诺艾尔","砂糖","迪卢克","七七",
            "刻晴", "迪奥娜", "钟离", "罗莎莉亚", "枫原万叶", "早柚", "珊瑚宫心海",
            "托马", "云堇", "申鹤", "八重神子", "神里绫人", "鹿野院平藏", 
            "柯莱", "赛诺", "瑶瑶", "迪希雅", "绮良良", "琳妮特", "林尼", "菲米尼",
            "那维莱特", "夏洛蒂", "夏沃蕾", "闲云", "梦见月瑞希", "烟绯", "辛焱"
        ];
        let foundNames = [];
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            for (let j = 0; j < characterNames.length; j++) {
                if (res.text.includes(characterNames[j])) {
                    log.info("识别到角色：{} ({x},{y})", characterNames[j]);
                    foundNames.push(characterNames[j]);
                }
            }
        }
        log.info(`识别到的角色名字：${foundNames.length > 0 ? foundNames.join(", ") : "未知"}`);
        await sleep(200);
        keyPress("VK_ESCAPE"); // 关闭菜单
        await sleep(1000); // 等待菜单关闭
        return foundNames;
    } else {
        log.warn("未找到角色");
        throw new Error("未找到角色，当前位置没有角色");
    }
}

/**
 * 检查是否存在派蒙菜单图标，等待游戏返回主菜单
 * 
 * @param {boolean} hasKeyMouse - 是否需要执行键鼠操作
 * @returns {Promise<boolean>} - 如果检测到主菜单，则返回 true，否则在超时时返回 false。
 */
async function waitToMain(hasKeyMouse = false) {
    log.info("等待返回主界面...");
    const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/paimon_menu.png"), 0, 0, 640, 216);
    const maxRetries = 180; // 设置最大重试次数以防止无限循环
    let retries = 0;
    let enteredLoop = false;
    while (true) {
        const ro = captureGameRegion();
        const isEmpty = ro.Find(paimonMenuRo).isEmpty();
        ro.dispose();
        if (!isEmpty) {
            break;
        }
        enteredLoop = true;
        if (retries >= maxRetries) {
            log.error("返回主界面超时");
            return false;
        }
        if (pathingName === "八重神子-1") {
            await click(960, 540); // 点击解签
        }
        await sleep(3000);
        retries++;
    }
    if (!enteredLoop && !hasKeyMouse) {
        log.error("进入对话失败");
        failed = true;
        return false;
    }
    failed = false;
    return true;
}

/**
 * 判断坐标是否在指定位置附近（误差范围内）
 * @param {number} x - 当前X坐标
 * @param {number} y - 当前Y坐标
 * @param {number} targetX - 目标X坐标
 * @param {number} targetY - 目标Y坐标
 * @returns {boolean} 是否在指定范围内
 */
function isNearPosition(x, y, targetX, targetY) {
    const errorThreshold = 150; // 误差范围
    return Math.abs(x - targetX) <= errorThreshold && Math.abs(y - targetY) <= errorThreshold;
}


/**
 * 检查对话进度并返回统计信息
 * @param {Object[]} characterPositions - 角色点位信息数组
 * @returns {Object} 包含进度统计的对象
 */
function checkProgress(characterPositions) {
    const total = characterPositions.length;
    let completed = 0;
    const remainingCharacters = [];
    const completedCharacters = [];

    for (const pos of characterPositions) {
        if (config[pos.name]) {
            completed++;
            completedCharacters.push(pos.name);
        } else {
            remainingCharacters.push(pos.name);
        }
    }

    const remaining = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
        total,
        completed,
        remaining,
        completionRate,
        remainingCharacters,
        completedCharacters
    };
}

/**
 * 重置所有对话配置
 * @returns {Promise<void>}
 */
async function resetAllProgress() {
    log.info("重置所有对话进度...");
    config = {};
    await file.writeText("config.json", JSON.stringify(config, null, 4));
    log.info("✅ 所有对话进度已重置，将重新开始所有角色的对话");
}

/**
 * 检查是否有未完成的角色，如果没有则提前结束
 * @param {Object[]} characterPositions - 角色点位信息数组
 * @returns {boolean} 是否还有未完成的角色
 */
function hasRemainingCharacters(characterPositions) {
    for (const pos of characterPositions) {
        if (!config[pos.name]) {
            return true;
        }
    }
    return false;
}

// === 设置管理相关函数 (BetterGI 自动处理设置) ===

/**
 * 显示当前设置
 */
// function showCurrentSettings() {
//     log.info("=== 当前设置 ===");
//     log.info(`启动时重置进度: ${settings.resetOnStart ? "✅ 启用" : "❌ 禁用"}`);
//     log.info(`重置前确认: ${settings.confirmBeforeReset ? "✅ 启用" : "❌ 禁用"}`);
//     log.info(`进度更新间隔: ${settings.progressUpdateInterval} 次`);
//     log.info(`显示剩余角色: ${settings.showRemainingCharacters ? "✅ 启用" : "❌ 禁用"}`);
//     log.info(`启用进度日志: ${settings.enableProgressLogs ? "✅ 启用" : "❌ 禁用"}`);
//     log.info(`启用详细日志: ${settings.enableDetailedLogs ? "✅ 启用" : "❌ 禁用"}`);
//     log.info(`显示统计信息: ${settings.showStatistics ? "✅ 启用" : "❌ 禁用"}`);
//     log.info(`找不到角色时继续: ${settings.continueOnNotFound ? "✅ 启用" : "❌ 禁用"}`);
//     log.info(`跳过已完成角色: ${settings.skipCompletedCharacters ? "✅ 启用" : "❌ 禁用"}`);
//     log.info("===============");
// }

/**
 * 处理重置相关设置
 * @param {Object[]} characterPositions - 角色点位信息数组
 * @returns {Promise<boolean>} 是否继续执行程序
 */
async function handleResetSettings(characterPositions) {
    // 启动时重置
    if (settings.resetOnStart) {
        if (settings.confirmBeforeReset) {
            log.info("⚠️  检测到启动时重置设置已启用");
            log.info("将在 5 秒后重置所有进度，如需取消请立即停止程序");
            await sleep(5000);
        }

        await resetAllProgress();
        log.info("🔄 已根据设置重置所有进度");
    }
}