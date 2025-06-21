(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    dispatcher.addTimer(new RealtimeTimer("AutoSkip"));
    await loadData();

    // 前往七天神像
    await genshin.tpToStatueOfTheSeven();
    let runCount = 0;
    const maxRuns = 50;
    while (runCount < maxRuns) {
        log.info(`开始第${runCount + 1}次运行`);
        await find();
        if (!foundAvatar) {
            log.info("未找到角色，结束运行");
            return;
        }
        log.info(`找到角色头像，正在查找对应角色...`);
        const characterPositions = [
            { name: "柯莱-1", x: 2843, y: -384, hasKeyMouse: true },
            { name: "迪希雅-1", x: 3771, y: 3608 },
            { name: "迪希雅-2", x: 4436, y: 3539 },
            { name: "赛诺-1", x: 3062, y: -268 },
            { name: "赛诺-2", x: 3059, y: -268 },
            { name: "赛诺-3", x: 2863, y: -380 },
            { name: "林尼-1", x: 4197, y: 4805 },
            { name: "夏沃蕾-1", x: 4356, y: 3707 },
            { name: "菲米尼-1", x: 4202, y: 3037, hasKeyMouse: true },
            { name: "夏洛蒂-1", x: 4618, y: 3518 },
            { name: "夏洛蒂-2", x: 4642, y: 3495 },
            { name: "绮良良-1", x: 231, y: -672 },
            { name: "绮良良-2", x: 231, y: -672 },
            { name: "绮良良-3", x: -4473, y: -2655 },
            { name: "鹿野院平藏-1", x: -4459, y: -3141 },
            { name: "鹿野院平藏-2", x: -4467, y: -3127 },
            { name: "鹿野院平藏-3", x: -4417, y: -3037 },
            { name: "托马-1", x: -4399, y: -3130 },
            { name: "梦见月瑞希-1", x: -4458, y: -3111, hasKeyMouse: true },
            { name: "梦见月瑞希-2", x: -4458, y: -3111, hasKeyMouse: true },
            { name: "八重神子-1", x: -4424, y: -2475 },
            { name: "那维莱特-1", x: 3600, y: 3804 },
            { name: "那维莱特-2", x: 4472, y: 3553 },
            { name: "神里绫人-1", x: -4473, y: -3132 }
        ];

        hasKeyMouse = false;
        let found = false;
        for (const pos of characterPositions) {
            if (!config[pos.name] && isNearPosition(characterX, characterY, pos.x, pos.y)) {
                pathingName = pos.name;
                hasKeyMouse = !!pos.hasKeyMouse;
                found = true;
                log.info(`找到角色，执行路线：${pathingName}`);
                break;
            }
        }
        if (!found) {
            log.error("未找到角色，或者角色未被收录");
            log.error("也有可能是配置文件中该角色已经对话过，请手动修改或清空config.json后重试");
            return;
        }
        log.info(`正在前往 ${pathingName} 所在位置...`);
        await pathingScript.runFile(`assets/pathing/${pathingName}.json`)
        keyPress("F");
        if (!hasKeyMouse) {
            log.info("开始对话...");
        }
        await sleep(3000);
        await waitToMain();
        if (hasKeyMouse) {
            log.info("执行对应键鼠脚本");
            await keyMouseScript.runFile(`assets/keymouse/${pathingName}.json`)
            keyPress("F");
            log.info("开始对话...");
            await sleep(3000);
            await waitToMain();
        }
        config[pathingName] = true;
        if (failed) {
            log.info("本次运行结果不会被保存");
        } else {
            await file.writeText("config.json", JSON.stringify(config, null, 4));
            log.info(`对话完成，已保存本次运行结果`);
        }
        runCount++;
        if (runCount < maxRuns) {
            log.info(`第${runCount}次运行完成`);
        }
    }
    log.info(`已对话${maxRuns}次，结束运行。`);
})();

/**
 * 加载数据
 * @returns {Promise<void>}
 */
async function loadData() {
    try {
        data = JSON.parse(await file.readText("data.json"));
        config = JSON.parse(await file.readText("config.json"));
    } catch (error) {
        log.error(`加载配置文件失败: ${error.message}`);
        throw new Error("配置文件加载失败，请检查对应文件文件是否存在");
    }
}
/**
 * 寻找并定位目标位置
 * @async
 * @returns {Promise<void>}
 */
async function find() {
    log.info("开始寻找角色...");
    const positions = data.mapPositions;
    for (let retryCount = 0; retryCount < positions.length; retryCount++) {
        const position = positions[retryCount];
        log.info(`第 ${retryCount + 1} 次尝试定位...`);
        log.info(`移动到位置：(${position.x}, ${position.y}), ${position.name || '未命名位置'}`);
        await genshin.moveMapTo(position.x, position.y, position.country);
        foundAvatar = await locate();
        if (foundAvatar) return;
    }
    log.error("寻找所有角色可能存在的位置都没有找到角色");
    return;
}

async function locate() {
    await sleep(500); // 确保画面稳定
    await genshin.setBigMapZoomLevel((data && typeof data.zoom === "number") ? data.zoom : 6.0);

    const character = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/三个点.png")));
    if (character && character.count > 0) {
        avatar = character[0];

        const center = genshin.getPositionFromBigMap();
        const mapZoomLevel = genshin.getBigMapZoomLevel();
        const mapScaleFactor = 2.361;

        characterX = (960 - avatar.x - 13) * mapZoomLevel / mapScaleFactor + center.x + 20;
        characterY = (540 - avatar.y - 13) * mapZoomLevel / mapScaleFactor + center.y + 20;

        log.info(`找到角色的大致坐标：(${characterX}, ${characterY})`);
        return true;
    } else {
        log.warn("未找到角色");
        return false;
    }
}

/**
 * 检查是否存在派蒙菜单图标，等待游戏返回主菜单
 * 
 * @returns {Promise<boolean>} - 如果检测到主菜单，则返回 true，否则在超时时返回 false。
 */
async function waitToMain() {
    log.info("等待返回主界面...");
    const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/paimon_menu.png"), 0, 0, genshin.width / 3.0, genshin.width / 5.0);
    const maxRetries = 180; // 设置最大重试次数以防止无限循环
    let retries = 0;
    let enteredLoop = false;
    while (captureGameRegion().Find(paimonMenuRo).isEmpty()) {
        enteredLoop = true;
        if (retries >= maxRetries) {
            log.error("返回主界面超时");
            return false;
        }
        await sleep(1000);
        retries++;
    }
    if (!enteredLoop || !hasKeyMouse) {
        log.error("进入对话失败");
        failed = true;
        return false;
    }
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
    // 使用配置中的阈值或默认值100
    const errorThreshold = 100;
    return Math.abs(x - targetX) <= errorThreshold && Math.abs(y - targetY) <= errorThreshold;
}