(async function () {
    await autoEnter(settings);
}
)();

/**
 * 自动联机脚本（整体打包为一个函数）
 * @param {Object} autoEnterSettings 配置对象
 *   enterMode: "进入他人世界" | "等待他人进入"
 *   enteringUID: string | null
 *   permissionMode: "无条件通过" | "白名单"
 *   nameToPermit1/2/3: string | null
 *   timeout: 分钟
 *   maxEnterCount: number
 */
async function autoEnter(autoEnterSettings) {
    // ===== 配置解析 =====
    const enterMode = autoEnterSettings.enterMode || "进入他人世界";
    const enteringUID = autoEnterSettings.enteringUID;
    const permissionMode = autoEnterSettings.permissionMode || "无条件通过";
    const timeout = +autoEnterSettings.timeout || 5;
    const maxEnterCount = +autoEnterSettings.maxEnterCount || 3;

    // 白名单
    const targetList = [];
    [autoEnterSettings.nameToPermit1, autoEnterSettings.nameToPermit2, autoEnterSettings.nameToPermit3]
        .forEach(v => v && targetList.push(v));

    // ===== 模板 / 路径 =====
    const enterUIDRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/enterUID.png"));
    const searchRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/search.png"));
    const requestEnterRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/requestEnter.png"));
    const requestEnter2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/requestEnter.png"), 1480, 300, 280, 600);
    const yUIRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/yUI.png"));
    const allowEnterRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/allowEnter.png"));
    const targetsPath = "targets";

    // ===== 状态 =====
    let enterCount = 0;
    let targetsRo = [];
    let checkToEnd = false;
    let enteredPlayers = [];

    // ===== 初始化 =====
    setGameMetrics(1920, 1080, 1);
    const start = new Date();
    log.info(`当前模式为：${enterMode}`);

    // 加载目标 PNG
    const targetPngs = await readFolder(targetsPath, ".png");
    for (const f of targetPngs) {
        const mat = file.ReadImageMatSync(f.fullPath);
        const ro = RecognitionObject.TemplateMatch(mat, 664, 481, 1355 - 668, 588 - 484);
        const baseName = f.fileName.replace(/\.png$/i, '');
        targetsRo.push({ ro, baseName });
    }
    log.info(`加载完成共 ${targetsRo.length} 个目标`);

    // ===== 主循环 =====
    while (new Date() - start < timeout * 60 * 1000) {
        if (enterMode === "进入他人世界") {
            const playerSign = await getPlayerSign();
            await sleep(500);
            if (playerSign > 1) {
                log.info(`加入成功，队伍编号 ${playerSign}`);
                break;
            } else if (playerSign === -1) {
                log.warn("队伍编号识别异常，尝试按0p处理");
            }
            log.info('不处于多人世界，开始尝试加入');
            await genshin.returnMainUi(); await sleep(500);

            if (!enteringUID) { log.error('未填写有效 UID'); break; }

            await keyPress("F2"); await sleep(2000);
            if (!await findAndClick(enterUIDRo)) { await genshin.returnMainUi(); continue; }
            await sleep(1000); inputText(enteringUID);
            await sleep(1000);
            if (!await findAndClick(searchRo)) { await genshin.returnMainUi(); continue; }
            await sleep(500);
            if (!await confirmSearchResult()) { await genshin.returnMainUi(); log.warn("无搜索结果"); continue; }

            await sleep(500);
            if (!await findAndClick(requestEnterRo)) { await genshin.returnMainUi(); continue; }
            await waitForMainUI(true, 20 * 1000);

        } else { // 等待他人进入
            const playerSign = await getPlayerSign();
            if (playerSign > 1) {
                log.warn("处于他人世界，先尝试退出");
                let leaveAttempts = 0;
                while (leaveAttempts < 10) {
                    if (await getPlayerSign() === 0) {
                        break;
                    }
                    await keyPress("F2");
                    await sleep(1000);
                    await findAndClick(leaveTeamRo);
                    await sleep(1000);
                    keyPress("VK_ESCAPE");
                    await waitForMainUI(true);
                    await genshin.returnMainUi();
                }
            }
            if (enterCount >= maxEnterCount) break;
            if (await isYUI()) keyPress("VK_ESCAPE"); await sleep(500);
            await genshin.returnMainUi();
            keyPress("Y"); await sleep(250);

            if (!await isYUI()) continue;
            log.info("处于 Y 界面，开始识别");

            let attempts = 0;
            while (attempts++ < 5) {
                if (permissionMode === "无条件通过") {
                    if (await findAndClick(allowEnterRo)) {
                        doRunExtra = true;
                        await waitForMainUI(true, 20 * 1000);
                        enterCount++;
                        break;
                    }
                } else {
                    const result = await recognizeRequest();
                    if (result) {
                        if (await findAndClick(allowEnterRo)) {
                            await waitForMainUI(true, 20 * 1000);
                            enterCount++;
                            enteredPlayers = [...new Set([...enteredPlayers, result])];
                            log.info(`允许 ${result} 加入`);
                            notification.send(`允许 ${result} 加入`);
                            doRunExtra = true;
                            if (await isYUI()) { keyPress("VK_ESCAPE"); await sleep(500); await genshin.returnMainUi(); }
                            break;
                        } else {
                            if (await isYUI()) { keyPress("VK_ESCAPE"); await sleep(500); await genshin.returnMainUi(); }
                        }
                    }
                }
                await sleep(500);
            }

            if (await isYUI()) { keyPress("VK_ESCAPE"); await genshin.returnMainUi(); }

            if (enterCount >= maxEnterCount || checkToEnd) {
                checkToEnd = true;
                await sleep(20000);
                if (await findTotalNumber() === maxEnterCount + 1) {
                    notification.send(`已达到预定人数：${maxEnterCount + 1}`);
                    break;
                }
                else enterCount--;
            }
        }
    }

    if (new Date() - start >= timeout * 60 * 1000) {
        log.warn("超时未达到预定人数");
        notification.error(`超时未达到预定人数`);
        if (settings.onlyRunPerfectly) {
            skipRunning = true;
            doRunExtra = false;
        }
    }

    async function confirmSearchResult() {
        for (let i = 0; i < 4; i++) {
            const gameRegion = captureGameRegion();
            const res = gameRegion.find(requestEnter2Ro);
            gameRegion.dispose();
            if (res.isExist()) return false;
            if (i < 4) await sleep(250);
        }
        return true;
    }

    async function isYUI() {
        for (let i = 0; i < 5; i++) {
            const gameRegion = captureGameRegion();
            const res = gameRegion.find(yUIRo);
            gameRegion.dispose();
            if (res.isExist()) return true;
            await sleep(250);
        }
        return false;
    }

    async function recognizeRequest() {
        try {
            const gameRegion = captureGameRegion();
            for (const { ro, baseName } of targetsRo) {
                if (gameRegion.find(ro).isExist()) { gameRegion.dispose(); return baseName; }
            }
            gameRegion.dispose();
        } catch { }
        try {
            const gameRegion = captureGameRegion();
            const resList = gameRegion.findMulti(RecognitionObject.ocr(664, 481, 1355 - 668, 588 - 484));
            gameRegion.dispose();
            let hit = null;
            for (const res of resList) {
                const txt = res.text.trim();
                if (targetList.includes(txt)) { hit = txt; break; }
            }
            if (!hit) resList.forEach(r => log.warn(`识别到"${r.text.trim()}"，不在白名单`));
            return hit;
        } catch { return null; }
    }
}