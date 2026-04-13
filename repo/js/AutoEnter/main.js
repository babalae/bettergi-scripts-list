const leaveTeamRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/leaveTeam.png"));

/**
 * 递归读取目录下所有文件
 * @param {string} folderPath 起始目录
 * @param {string} [ext='']   需要的文件后缀，空字符串表示不限制；例如 'json' 或 '.json' 均可
 * @returns {Array<{fullPath:string, fileName:string, folderPathArray:string[]}>}
 */
async function readFolder(folderPath, ext = '') {
    // 统一后缀格式：确保前面有一个点，且全小写
    const targetExt = ext ? (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase() : '';

    const folderStack = [folderPath];
    const files = [];

    while (folderStack.length > 0) {
        const currentPath = folderStack.pop();
        const filesInSubFolder = file.ReadPathSync(currentPath); // 同步读取当前目录
        const subFolders = [];

        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                subFolders.push(filePath);          // 子目录稍后处理
            } else {
                // 后缀过滤
                if (targetExt) {
                    const fileExt = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
                    if (fileExt !== targetExt) continue;
                }

                const fileName = filePath.split('\\').pop();
                const folderPathArray = filePath.split('\\').slice(0, -1);
                files.push({ fullPath: filePath, fileName, folderPathArray });
            }
        }

        // 保持同层顺序，reverse 后仍按原顺序入栈
        folderStack.push(...subFolders.reverse());
    }

    return files;
}

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
    const timeout = +autoEnterSettings.timeOut || 5;
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
                            log.info(`允许 ${result} 加入`);
                            notification.send(`允许 ${result} 加入`);
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

/**
 * 通用找图/找RO并可选点击（支持单图片文件路径、单RO、图片文件路径数组、RO数组）
 * @param {string|string[]|RecognitionObject|RecognitionObject[]} target
 * @param {boolean}  [doClick=true]                是否点击
 * @param {number}   [timeout=3000]                识别时间上限（ms）
 * @param {number}   [interval=50]                 识别间隔（ms）
 * @param {number}   [retType=0]                   0-返回布尔；1-返回 Region 结果
 * @param {number}   [preClickDelay=50]            点击前等待
 * @param {number}   [postClickDelay=50]           点击后等待
 * @returns {boolean|Region}  根据 retType 返回是否成功或最终 Region
 */
async function findAndClick(target,
    doClick = true,
    timeout = 3000,
    interval = 50,
    retType = 0,
    preClickDelay = 50,
    postClickDelay = 50) {
    try {
        // 1. 统一转成 RecognitionObject 数组
        let ros = [];
        if (Array.isArray(target)) {
            ros = target.map(t =>
                (typeof t === 'string')
                    ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(t))
                    : t
            );
        } else {
            ros = [(typeof target === 'string')
                ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(target))
                : target];
        }

        const start = Date.now();
        let found = null;

        while (Date.now() - start <= timeout) {
            const gameRegion = captureGameRegion();
            try {
                // 依次尝试每一个 ro
                for (const ro of ros) {
                    const res = gameRegion.find(ro);
                    if (!res.isEmpty()) {          // 找到
                        found = res;
                        if (doClick) {
                            await sleep(preClickDelay);
                            res.click();
                            await sleep(postClickDelay);
                        }
                        break;                     // 成功即跳出 for
                    }
                }
                if (found) break;                  // 成功即跳出 while
            } finally {
                gameRegion.dispose();
            }
            await sleep(interval);                 // 没找到时等待
        }

        // 3. 按需返回
        return retType === 0 ? !!found : (found || null);

    } catch (error) {
        log.error(`执行通用识图时出现错误：${error.message}`);
        return retType === 0 ? false : null;
    }
}

//等待主界面状态
async function waitForMainUI(requirement, timeOut = 60 * 1000) {
    log.info(`等待至多${timeOut}毫秒`)
    const startTime = Date.now();
    let logcount = 0;
    while (Date.now() - startTime < timeOut) {
        const mainUIState = await isMainUI();
        logcount++;
        if (mainUIState === requirement) return true;
        const elapsed = Date.now() - startTime;
        const min = Math.floor(elapsed / 60000);
        const sec = Math.floor((elapsed % 60000) / 1000);
        const ms = elapsed % 1000;
        if (logcount >= 50) {
            logcount = 0;
            log.info(`已等待 ${min}分 ${sec}秒 ${ms}毫秒`);
        }
        await sleep(200);
    }
    log.error("超时仍未到达指定状态");
    return false;
}


//检查是否在主界面
async function isMainUI() {
    // 修改后的图像路径
    const imagePath = "assets/RecognitionObject/MainUI.png";
    // 修改后的识别区域（左上角区域）
    const xMin = 0;
    const yMin = 0;
    const width = 150; // 识别区域宽度
    const height = 150; // 识别区域高度
    let template = file.ReadImageMatSync(imagePath);
    let recognitionObject = RecognitionObject.TemplateMatch(template, xMin, yMin, width, height);

    // 尝试次数设置为 5 次
    const maxAttempts = 5;

    let attempts = 0;
    while (attempts < maxAttempts) {
        try {

            let gameRegion = captureGameRegion();
            let result = gameRegion.find(recognitionObject);
            gameRegion.dispose();
            if (result.isExist()) {
                //log.info("处于主界面");
                return true; // 如果找到图标，返回 true
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);

            return false; // 发生异常时返回 false
        }
        attempts++; // 增加尝试次数
        await sleep(250); // 每次检测间隔 250 毫秒
    }
    return false; // 如果尝试次数达到上限或取消，返回 false
}

//获取联机世界的当前玩家标识
async function getPlayerSign() {
    let attempts = 0;
    while (attempts < 10) {
        attempts++;
        const picDic = {
            "0P": "assets/RecognitionObject/0P.png",
            "1P": "assets/RecognitionObject/1P.png",
            "2P": "assets/RecognitionObject/2P.png",
            "3P": "assets/RecognitionObject/3P.png",
            "4P": "assets/RecognitionObject/4P.png"
        }
        await genshin.returnMainUi();
        await sleep(500);
        const p0Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["0P"]), 200, 10, 400, 70);
        p0Ro.Threshold = 0.95;
        p0Ro.InitTemplate();
        const p1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["1P"]), 200, 10, 400, 70);
        p1Ro.Threshold = 0.95;
        p1Ro.InitTemplate();
        const p2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["2P"]), 200, 10, 400, 70);
        p2Ro.Threshold = 0.95;
        p2Ro.InitTemplate();
        const p3Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["3P"]), 200, 10, 400, 70);
        p3Ro.Threshold = 0.95;
        p3Ro.InitTemplate();
        const p4Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["4P"]), 200, 10, 400, 70);
        p4Ro.Threshold = 0.95;
        p4Ro.InitTemplate();
        moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
        const gameRegion = captureGameRegion();
        // 当前页面模板匹配
        let p0 = gameRegion.Find(p0Ro);
        let p1 = gameRegion.Find(p1Ro);
        let p2 = gameRegion.Find(p2Ro);
        let p3 = gameRegion.Find(p3Ro);
        let p4 = gameRegion.Find(p4Ro);
        gameRegion.dispose();
        if (p0.isExist()) { log.info("识别结果为0P"); return 0; }
        if (p1.isExist()) { log.info("识别结果为1P"); return 1; }
        if (p2.isExist()) { log.info("识别结果为2P"); return 2; }
        if (p3.isExist()) { log.info("识别结果为3P"); return 3; }
        if (p4.isExist()) { log.info("识别结果为4P"); return 4; }
        await genshin.returnMainUi();
        await sleep(250);
    }
    log.warn("超时仍未识别到队伍编号");
    return -1;
}

async function findTotalNumber() {
    await genshin.returnMainUi();
    await keyPress("F2");
    await sleep(2000);

    // 定义模板
    const kick2pRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickButton.png"), 1520, 277, 230, 120);
    const kick3pRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickButton.png"), 1520, 400, 230, 120);
    const kick4pRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickButton.png"), 1520, 527, 230, 120);

    moveMouseTo(1555, 860); // 防止鼠标干扰
    const gameRegion = captureGameRegion();
    await sleep(200);

    let count = 1; // 先算上自己

    // 依次匹配 2P
    if (gameRegion.Find(kick2pRo).isExist()) {
        log.info("发现 2P");
        count++;
    }

    // 依次匹配 3P
    if (gameRegion.Find(kick3pRo).isExist()) {
        log.info("发现 3P");
        count++;
    }

    // 依次匹配 4P
    if (gameRegion.Find(kick4pRo).isExist()) {
        log.info("发现 4P");
        count++;
    }

    gameRegion.dispose();

    log.info(`当前联机世界玩家总数（含自己）：${count}`);
    return count;
}
