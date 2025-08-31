// 初始化自定义配置并赋予默认值
let decomposeMode = settings.decomposeMode || "保留";//狗粮分解模式
let keep4Star = settings.keep4Star;//保留四星
let autoSalvage = settings.autoSalvage;//启用自动分解
let notify = settings.notify;//启用通知
let p1EndingRoute = settings.p1EndingRoute || "枫丹高塔";
let p2EndingRoute = settings.p2EndingRoute || "度假村";
let p3EndingRoute = settings.p3EndingRoute || "智障厅";
let p4EndingRoute = settings.p4EndingRoute || "踏鞴砂";
let accountName = settings.accountName || "默认账户";
let runExtra = settings.runExtra || false;
let forceGroupNumber = settings.forceGroupNumber || 0;


//文件路径
//摧毁狗粮
const ArtifactsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/ArtifactsButton.png"));
const DeleteButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/DeleteButton.png"));
const AutoAddButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/AutoAddButton.png"));
const ConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/ConfirmButton.png"));
const DestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/DestoryButton.png"));
const MidDestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/DestoryButton.png"), 900, 600, 500, 300);
const CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/CharacterMenu.png"), 60, 991, 38, 38);
//分解狗粮
const decomposeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/decompose.png"));
const quickChooseRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/quickChoose.png"));
const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirm.png"));
const doDecomposeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/doDecompose.png"));
const doDecompose2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/doDecompose2.png"));
//联机图标
const p2InBigMapRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/2pInBigMap.png"));
const p3InBigMapRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/3pInBigMap.png"));
const p4InBigMapRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/4pInBigMap.png"));
const kickAllRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickAll.png"));
const confirmKickRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirmKick.png"));
const leaveTeamRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/leaveTeam.png"));

//初始化变量
let artifactExperienceDiff = 0;
let moraDiff = 0;
let failcount = 0;
let autoSalvageCount = 0;
let furinaState = "unknown";
let _infoPoints = null;          // 缓存 assets/info.json 解析后的数组

(async function () {
    setGameMetrics(1920, 1080, 1);
    let groupNumBer = await getPlayerSign();
    if (groupNumBer != 0) {
        log.info(`在队伍中编号为${groupNumBer}`);
    } else {
        log.info(`不处于联机模式或识别异常`);
    }

    if (forceGroupNumber != 0) {
        groupNumBer = forceGroupNumber;
        log.info(`将自己在队伍中的编号强制指定为${groupNumBer}`);
    }

    if (groupNumBer === 1) {
        // 启用自动拾取的实时任务
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        //自己是房主，检测总人数
        log.info("是1p，检测当前总人数");
        const totalNumber = await findTotalNumber();

        //预处理
        /*await readRecord(accountName);//读取记录文件

        //运行前按自定义配置清理狗粮
        if (settings.decomposeMode === "分解（经验瓶）") {
            await processArtifacts(21);
        } else {
            artifactExperienceDiff -= await processArtifacts(21);
        }

        moraDiff -= await mora();*/

        //循环检测，直到其他人所有人到位
        await waitForReady(totalNumber);

        //根据人数决定执行路线
        for (let i = 1; i <= totalNumber; i++) {
            //执行第i条收尾路线
            await runEndingPath(i);
        }

        //运行结束，解散队伍？
        await genshin.returnMainUi();
        await keyPress("F2");
        await sleep(2000);
        await findAndClick(kickAllRo);
        await sleep(500);
        await findAndClick(confirmKickRo);
        await waitForMainUI(true);//等待直到回到主界面
        await genshin.returnMainUi();

        //运行后按自定义配置清理狗粮
        /*artifactExperienceDiff += await processArtifacts(21);
        moraDiff += await mora();
        log.info(`狗粮路线获取摩拉: ${moraDiff}`);
        log.info(`狗粮路线获取狗粮经验: ${artifactExperienceDiff}`);
        //修改records
        for (let i = record.records.length - 1; i > 0; i--) {
            record.records[i] = record.records[i - 1];
        }
        record.records[0] = `日期:${record.lastRunDate}，狗粮经验${artifactExperienceDiff}，摩拉${moraDiff}`;
        if (settings.notify) {
            notification.Send(`日期:${record.lastRunDate}，狗粮经验${artifactExperienceDiff}，摩拉${moraDiff}`);
        }
        await writeRecord(accountName);//修改记录文件*/
    } else if (groupNumBer > 1) {
        //自己是队员，前往对应的占位点
        await goToTarget(groupNumBer);
        //等待到房主解散队伍并返回主界面？
        if (await waitForMainUI(false, 2 * 60 * 60 * 1000)) {
            await waitForMainUI(true);
            await genshin.returnMainUi();
        } else {
            log.info("超时仍未回到主界面，主动退出");
        }
    } else if (runExtra) {
        log.info("请确保联机收尾已结束，将开始运行额外路线");
        // 启用自动拾取的实时任务
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        await runExtraPath();
    }
    /*
        for (i = 0; i < 3; i++) {
            //确保回到单机模式
            const finalPlayerSign = await getPlayerSign();
            if (finalPlayerSign != 0) {
                await genshin.returnMainUi();
                await keyPress("F2");
                await sleep(2000);
                if (finalPlayerSign === 1) {
                    await findAndClick(kickAllRo);
                    await sleep(500);
                    await findAndClick(confirmKickRo);
                    await waitForMainUI(true);//等待直到回到主界面
                    await genshin.returnMainUi();
                } else {
                    await findAndClick(leaveTeamRo);
                    await sleep(500);
                    await waitForMainUI(true);//等待直到回到主界面
                    await genshin.returnMainUi();
                }
            } else {
                log.info("已成功回到单人模式");
                break;
            }
        }
            */
}
)();

//等待主界面状态
async function waitForMainUI(requirement, timeOut = 60 * 1000) {
    log.info(`等待至多${timeOut}毫秒`)
    const startTime = Date.now();
    while (Date.now() - startTime < timeOut) {
        const mainUIState = await isMainUI();
        if (mainUIState === requirement) return true;

        const elapsed = Date.now() - startTime;
        const min = Math.floor(elapsed / 60000);
        const sec = Math.floor((elapsed % 60000) / 1000);
        const ms = elapsed % 1000;
        log.info(`已等待 ${min}分 ${sec}秒 ${ms}毫秒`);

        await sleep(1000);
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
        await sleep(50); // 每次检测间隔 50 毫秒
    }
    return false; // 如果尝试次数达到上限或取消，返回 false
}


//获取联机世界的当前玩家标识
async function getPlayerSign() {
    const picDic = {
        "1P": "assets/RecognitionObject/1P.png",
        "2P": "assets/RecognitionObject/2P.png",
        "3P": "assets/RecognitionObject/3P.png",
        "4P": "assets/RecognitionObject/4P.png"
    }
    await genshin.returnMainUi();
    await sleep(500);
    const p1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["1P"]), 344, 22, 45, 45);
    const p2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["2P"]), 344, 22, 45, 45);
    const p3Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["3P"]), 344, 22, 45, 45);
    const p4Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["4P"]), 344, 22, 45, 45);
    moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
    const gameRegion = captureGameRegion();
    // 当前页面模板匹配
    let p1 = gameRegion.Find(p1Ro);
    let p2 = gameRegion.Find(p2Ro);
    let p3 = gameRegion.Find(p3Ro);
    let p4 = gameRegion.Find(p4Ro);
    gameRegion.dispose();
    if (p1.isExist()) return 1;
    if (p2.isExist()) return 2;
    if (p3.isExist()) return 3;
    if (p4.isExist()) return 4;
    return 0;
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

/**
 * 等待所有队友（2P/3P/4P）就位
 * @param {number} totalNumber  联机总人数（包含自己）
 * @param {number} timeOut      最长等待毫秒
 */
async function waitForReady(totalNumber, timeOut = 300000) {
    await genshin.tpToStatueOfTheSeven();

    // 实际需要检测的队友编号：2 ~ totalNumber
    const needCheck = totalNumber - 1;          // 队友人数
    const readyFlags = new Array(needCheck).fill(false); // 下标 0 代表 2P，1 代表 3P …

    const startTime = Date.now();
    while (Date.now() - startTime < timeOut) {

        let allReady = true;
        await genshin.returnMainUi();
        await keyPress("M");          // 打开多人地图/界面
        await sleep(2000);             // 给 UI 一点加载时间

        for (let i = 0; i < needCheck; i++) {
            // 已就绪的队友跳过
            if (readyFlags[i]) continue;

            const playerIndex = i + 2;          // 2P/3P/4P
            const ready = await checkReady(playerIndex);

            if (ready) {
                log.info(`玩家 ${playerIndex}P 已就绪`);
                readyFlags[i] = true;
            } else {
                allReady = false;   // 还有没就绪的
            }
        }

        if (allReady) {
            log.info("所有队友已就绪");
            return true;
        }

        // 每轮检测后稍等，防止刷屏
        await sleep(500);
    }

    log.warn("等待队友就绪超时");
    return false;
}

async function checkReady(i) {
    /* 1. 先把地图移到目标点位（point 来自 info.json） */
    const point = await getPointByPlayer(i);
    if (!point) return false;
    await genshin.moveMapTo(Math.round(point.x), Math.round(point.y));

    /* 2. 取图标屏幕坐标 */
    const pos = await getPlayerIconPos(i);
    if (!pos || !pos.found) return false;

    /* 3. 屏幕坐标 → 地图坐标（图标）*/
    const mapZoomLevel = 2.0;
    await genshin.setBigMapZoomLevel(mapZoomLevel);
    const mapScaleFactor = 2.361;

    const center = genshin.getPositionFromBigMap();   // 仅用于坐标系转换
    const iconScreenX = pos.x;
    const iconScreenY = pos.y;

    const iconMapX = (960 - iconScreenX) * mapZoomLevel / mapScaleFactor + center.x;
    const iconMapY = (540 - iconScreenY) * mapZoomLevel / mapScaleFactor + center.y;

    /* 4. 计算“图标地图坐标”与“目标点位”的距离 */
    const dx = iconMapX - point.x;
    const dy = iconMapY - point.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    /* 5. 打印两种坐标及距离 */
    log.info(`玩家 ${i}P`);
    log.info(`├─ 屏幕坐标: (${iconScreenX}, ${iconScreenY})`);
    log.info(`├─ 图标地图坐标: (${iconMapX.toFixed(2)}, ${iconMapY.toFixed(2)})`);
    log.info(`├─ 目标点位坐标: (${point.x}, ${point.y})`);
    log.info(`└─ 图标与目标点位距离: ${dist.toFixed(2)} m`);

    return dist <= 20;   // 20 m 阈值，可按需调整
}


/**
 * 根据玩家编号返回该路线在 assets/info.json 中记录的点位坐标
 * @param {number} playerIndex 1 | 2 | 3 | 4
 * @returns {{x:number,y:number}|null}
 */
async function getPointByPlayer(playerIndex) {
    // 1. 只读一次：第一次调用时加载并缓存
    if (_infoPoints === null) {
        try {
            const jsonStr = file.ReadTextSync('assets/info.json');
            _infoPoints = JSON.parse(jsonStr);
            if (!Array.isArray(_infoPoints)) {
                log.error('assets/info.json 不是数组格式');
                _infoPoints = [];     // 防止后续再读
                return null;
            }
        } catch (err) {
            log.error(`读取或解析 assets/info.json 失败: ${err.message}`);
            _infoPoints = [];
            return null;
        }
    }

    // 2. 外部已准备好的路线名称映射
    const routeMap = {
        1: p1EndingRoute,
        2: p2EndingRoute,
        3: p3EndingRoute,
        4: p4EndingRoute
    };
    const routeName = routeMap[playerIndex];
    if (!routeName) {
        log.error(`无效玩家编号: ${playerIndex}`);
        return null;
    }

    // 3. 遍历缓存数组
    for (let i = 0; i < _infoPoints.length; i++) {
        const p = _infoPoints[i];
        if (p && p.name === routeName) {
            return { x: p.position.x, y: p.position.y };
        }
    }

    log.warn(`在 info.json 中找不到 name 为 "${routeName}" 的点`);
    return null;
}

/**
 * 根据玩家编号获取 2/3/4P 图标在屏幕上的坐标
 * @param {number} playerIndex  2 | 3 | 4
 * @param {number} timeout      最长查找毫秒，默认 2000
 * @returns {Promise<{x:number,y:number,width:number,height:number,found:boolean}|null>}
 *          found=true 时坐标有效；未找到/取消/异常返回 null
 */
async function getPlayerIconPos(playerIndex, timeout = 2000) {
    // 把路径封装在函数内部
    const map = {
        2: "assets/RecognitionObject/2pInBigMap.png",
        3: "assets/RecognitionObject/3pInBigMap.png",
        4: "assets/RecognitionObject/4pInBigMap.png"
    };
    const tplPath = map[playerIndex];
    if (!tplPath) {
        log.error(`无效玩家编号: ${playerIndex}`);
        return null;
    }

    const template = file.ReadImageMatSync(tplPath);
    const recognitionObj = RecognitionObject.TemplateMatch(template, 0, 0, 1920, 1080); // 全屏查找，可自行改区域

    const start = Date.now();
    while (Date.now() - start < timeout) {
        let gameRegion = null;
        try {
            gameRegion = captureGameRegion();
            const res = gameRegion.find(recognitionObj);
            if (res.isExist()) {
                log.info(`${playerIndex}P，在屏幕上的坐标为(${res.x + 10},${res.y + 10})`);//图标大小为20*20
                return {
                    x: res.x + 10,
                    y: res.y + 10,
                    found: true
                };
            }
        } catch (e) {
            log.error(`模板匹配异常: ${e.message}`);
            return null;
        } finally {
            if (gameRegion) gameRegion.dispose();
        }
        await sleep(100);
    }
    return null;
}

/**
 * 根据玩家编号执行执行路线的全部 JSON 文件
 * @param {number} i  1 | 2 | 3 | 4
 */
async function runEndingPath(i) {
    const routeMap = {
        1: p1EndingRoute,
        2: p2EndingRoute,
        3: p3EndingRoute,
        4: p4EndingRoute
    };

    const folderName = routeMap[i];
    if (!folderName) {
        log.error(`无效玩家编号: ${i}`);
        return;
    }

    const folderPath = `assets/ArtifactsPath/${folderName}/执行`;
    const files = await readFolder(folderPath, true);

    if (files.length === 0) {
        log.warn(`文件夹 ${folderPath} 下未找到任何 JSON 路线文件`);
        return;
    }

    for (const { fullPath } of files) {
        log.info(`开始执行路线: ${fullPath}`);
        await pathingScript.runFile(fullPath);
    }

    log.info(`${folderName} 的全部路线已跑完`);
}

/**
 * 执行额外路线
 */
async function runExtraPath() {

    const folderPath = `assets/ArtifactsPath/额外/执行`;
    const files = await readFolder(folderPath, true);

    if (files.length === 0) {
        log.warn(`文件夹 ${folderPath} 下未找到任何 JSON 路线文件`);
        return;
    }

    for (const { fullPath } of files) {
        log.info(`开始执行路线: ${fullPath}`);
        await pathingScript.runFile(fullPath);
    }

    log.info(`额外 的全部路线已跑完`);
}

/**
 * 根据玩家编号执行占位路线的全部 JSON 文件
 * @param {number} i  1 | 2 | 3 | 4
 */
async function goToTarget(i) {
    const routeMap = {
        1: p1EndingRoute,
        2: p2EndingRoute,
        3: p3EndingRoute,
        4: p4EndingRoute
    };

    const folderName = routeMap[i];
    if (!folderName) {
        log.error(`无效玩家编号: ${i}`);
        return;
    }

    const folderPath = `assets/ArtifactsPath/${folderName}/占位`;
    const files = await readFolder(folderPath, true);

    if (files.length === 0) {
        log.warn(`文件夹 ${folderPath} 下未找到任何 JSON 路线文件`);
        return;
    }

    for (const { fullPath } of files) {
        log.info(`开始执行路线: ${fullPath}`);
        await pathingScript.runFile(fullPath);
    }

    log.info(`${folderName} 的全部路线已跑完`);
}

async function readRecord(accountName) {
    /* ---------- 文件名合法性校验 ---------- */
    const illegalCharacters = /[\\/:*?"<>|]/;
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    let finalAccountName = accountName;

    if (accountName === "" ||
        accountName.startsWith(" ") ||
        accountName.endsWith(" ") ||
        illegalCharacters.test(accountName) ||
        reservedNames.includes(accountName.toUpperCase()) ||
        accountName.length > 255
    ) {
        log.error(`账户名 "${accountName}" 不合法，将使用默认值`);
        finalAccountName = "默认账户";
        await sleep(5000);
    } else {
        log.info(`账户名 "${accountName}" 合法`);
    }

    /* ---------- 读取记录文件 ---------- */
    const recordFolderPath = "records/";
    const recordFilePath = `records/${finalAccountName}.txt`;

    const filesInSubFolder = file.ReadPathSync(recordFolderPath);
    let fileExists = false;
    for (const filePath of filesInSubFolder) {
        if (filePath === `records\\${accountName}.txt`) {
            fileExists = true;
            break;
        }
    }



    /* ---------- 初始化记录对象 ---------- */
    record = {
        records: new Array(14).fill(""),
        version: ""
    };

    let recordIndex = 0;

    if (fileExists) {
        log.info(`记录文件 ${recordFilePath} 存在`);
    } else {
        log.warn(`无记录文件，将使用默认数据`);
        return;
    }

    const content = await file.readText(recordFilePath);
    const lines = content.split("\n");



    /* ---------- 逐行解析 ---------- */
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith("日期") && recordIndex < record.records.length) {
            record.records[recordIndex++] = line;
        }
    }

    log.info(`上次运行日期: ${record.lastRunDate}`);
    log.info(`上次激活路线开始时间: ${record.lastActivateTime.toLocaleString()}`);

    /* ---------- 读取 manifest 版本 ---------- */
    try {
        const manifest = JSON.parse(await file.readText("manifest.json"));
        record.version = manifest.version;
        log.info(`当前版本为${record.version}`);
    } catch (err) {
        log.error("读取或解析 manifest.json 失败:", err);
    }

}

async function writeRecord(accountName) {
    if (state.cancel) return;
    const recordFilePath = `records/${accountName}.txt`;

    const lines = [
        ...record.records.filter(Boolean)
    ];

    const content = lines.join('\n');

    try {
        await file.writeText(recordFilePath, content, false);
        log.info(`记录已写入 ${recordFilePath}`);
    } catch (e) {
        log.error(`写入 ${recordFilePath} 失败:`, e);
    }
}

async function findAndClick(target, maxAttempts = 20) {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const gameRegion = captureGameRegion();
        try {
            const result = gameRegion.find(target);
            if (result.isExist) {
                result.click();
                return true;                 // 成功立刻返回
            }
            log.warn(`识别失败，第 ${attempts + 1} 次重试`);
        } catch (err) {
        } finally {
            gameRegion.dispose();
        }
        if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
            await sleep(250);
        }
    }
    log.error("已达到重试次数上限，仍未找到目标");
    return false;
}

async function processArtifacts(times = 1) {
    await genshin.returnMainUi();
    await sleep(500);
    let result = 0;
    try {
        if (settings.decomposeMode === "销毁（摩拉）") {
            result = await destroyArtifacts(times);
        } else {
            result = await decomposeArtifacts();
        }
    } catch (error) {
        log.error(`处理狗粮分解时发生异常: ${error.message}`);
    }
    await genshin.returnMainUi();
    return result;

    async function decomposeArtifacts() {
        keyPress("B");
        await sleep(1000);
        await click(670, 45);
        await sleep(500);
        if (!await findAndClick(decomposeRo)) {
            await genshin.returnMainUi();
            return 0;
        }
        await sleep(1000);

        //识别已储存经验（1570-880-1650-930）
        let regionToCheck1 = { x: 1570, y: 880, width: 80, height: 50 };
        let initialNum = await recognizeTextInRegion(regionToCheck1);
        let initialValue = 0;

        if (initialNum && !isNaN(parseInt(initialNum, 10))) {
            initialValue = parseInt(initialNum, 10);
            log.info(`已储存经验识别成功: ${initialValue}`);
        } else {
            log.warn(`在指定区域未识别到有效数字: ${initialValue}`);
        }
        let regionToCheck3 = { x: 100, y: 885, width: 170, height: 50 };
        let decomposedNum = 0;
        let firstNumber = 0;
        let firstNumber2 = 0;

        if (settings.keep4Star) {
            if (!await findAndClick(quickChooseRo)) {
                await genshin.returnMainUi();
                return 0;
            }
            moveMouseTo(960, 540);
            await sleep(1000);

            // 点击“确认选择”按钮
            if (!await findAndClick(confirmRo)) {
                await genshin.returnMainUi();
                return 0;
            }
            await sleep(1000);

            decomposedNum = await recognizeTextInRegion(regionToCheck3);

            // 使用正则表达式提取第一个数字
            const match = decomposedNum.match(/已选(\d+)/);

            // 检查是否匹配成功
            if (match) {
                // 将匹配到的第一个数字转换为数字类型并存储在变量中
                firstNumber = Number(match[1]);
                log.info(`1-4星总数量: ${firstNumber}`);
            } else {
                log.info("识别失败");
            }
            keyPress("VK_ESCAPE");

            await sleep(500);
            if (!await findAndClick(decomposeRo)) {
                await genshin.returnMainUi();
                return 0;
            }
            await sleep(500);
        }
        if (!await findAndClick(quickChooseRo)) {
            await genshin.returnMainUi();
            return 0;
        }
        moveMouseTo(960, 540);
        await sleep(1000);

        if (settings.keep4Star) {
            await click(370, 370);//取消选择四星
            await sleep(1000);
        }
        // 点击“确认选择”按钮
        if (!await findAndClick(confirmRo)) {
            await genshin.returnMainUi();
            return 0;
        }
        await sleep(1500);

        let decomposedNum2 = await recognizeTextInRegion(regionToCheck3);

        // 使用正则表达式提取第一个数字
        const match2 = decomposedNum2.match(/已选(\d+)/);

        // 检查是否匹配成功
        if (match2) {
            // 将匹配到的第一个数字转换为数字类型并存储在变量中
            firstNumber2 = Number(match2[1]);
            log.info(`分解总数是: ${firstNumber2}`);
        } else {
            log.info("识别失败");
        }
        //识别当前总经验
        if (settings.notify) {
            notification.Send(`当前经验如图`);
        }
        let regionToCheck2 = { x: 1470, y: 880, width: 205, height: 70 };
        let newNum = await recognizeTextInRegion(regionToCheck2);
        let newValue = 0;

        if (newNum && !isNaN(parseInt(newNum, 10))) {
            newValue = parseInt(newNum, 10);
            log.info(`当前总经验识别成功: ${newValue}`);
        } else {
            log.warn(`在指定区域未识别到有效数字: ${newValue}`);
        }

        if (settings.decomposeMode === "分解（经验瓶）") {
            log.info(`用户选择了分解，执行分解`);
            // 根据用户配置，分解狗粮
            await sleep(1000);
            // 点击分解按钮
            if (!await findAndClick(doDecomposeRo)) {
                await genshin.returnMainUi();
                return 0;
            }
            await sleep(500);

            // 4. "进行分解"按钮// 点击进行分解按钮
            if (!await findAndClick(doDecompose2Ro)) {
                await genshin.returnMainUi();
                return 0;
            }
            await sleep(1000);

            // 5. 关闭确认界面
            await click(1340, 755);
            await sleep(1000);
        }
        else {
            log.info(`用户未选择分解，不执行分解`);
        }

        // 7. 计算分解获得经验=总经验-上次剩余
        const resinExperience = Math.max(newValue - initialValue, 0);
        log.info(`分解可获得经验: ${resinExperience}`);
        let fourStarNum = firstNumber - firstNumber2;
        if (settings.keep4Star) {
            log.info(`保留的四星数量: ${fourStarNum}`);
        }
        let resultExperience = resinExperience;
        if (resultExperience === 0) {
            resultExperience = initialValue;
        }
        const result = resultExperience;
        await genshin.returnMainUi();
        return result;
    }



    async function destroyArtifacts(times = 1) {
        await genshin.returnMainUi();
        await sleep(250);
        keyPress("B");
        await sleep(500);
        await findAndClick(ArtifactsButtonRo, 5)
        try {
            for (let i = 0; i < times; i++) {
                // 点击摧毁
                if (!await findAndClick(DeleteButtonRo)) {
                    await genshin.returnMainUi();
                    return;
                }
                await sleep(600);
                // 点击自动添加
                if (!await findAndClick(AutoAddButtonRo)) {
                    await genshin.returnMainUi();
                    return;
                }
                await sleep(900);
                click(150, 150);
                await sleep(300);
                click(150, 220);
                await sleep(300);
                click(150, 300);
                if (!settings.keep4Star) {
                    await sleep(300);
                    click(150, 370);
                }
                // 点击快捷放入
                if (!await findAndClick(ConfirmButtonRo)) {
                    await genshin.returnMainUi();
                    return;
                }
                await sleep(600);
                // 点击摧毁
                if (!await findAndClick(DestoryButtonRo)) {
                    await genshin.returnMainUi();
                    return;
                }
                await sleep(600);
                // 弹出页面点击摧毁
                if (!await findAndClick(MidDestoryButtonRo)) {
                    await genshin.returnMainUi();
                    return;
                }
                await sleep(600);
                click(960, 1000);// 点击空白处
                await sleep(1000);
            }
        } catch (ex) {
            log.info("背包里的圣遗物已摧毁完毕，提前结束")
        } finally {
            await genshin.returnMainUi();
        }

    }
}

async function mora() {
    // 定义一个函数用于识别图像
    async function recognizeImage(recognitionObject, timeout = 5000) {
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 尝试识别图像
                const gameRegion = captureGameRegion();
                let imageResult = gameRegion.find(recognitionObject);
                gameRegion.dispose;
                if (imageResult) {
                    // log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
                    // log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
                    return { success: true, x: imageResult.x, y: imageResult.y };
                }
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
            }
            await sleep(500); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法识别图像`);
        return { success: false };
    }
    let result = 0;
    let tryTimes = 0;
    while (result === 0 && tryTimes < 3) {
        await genshin.returnMainUi();
        await sleep(100);
        log.info("开始尝试识别摩拉");
        // 按下 C 键
        keyPress("C");
        await sleep(1500);
        let recognized = false;
        // 识别“角色菜单”图标或“天赋”文字
        let startTime = Date.now();
        while (Date.now() - startTime < 5000) {
            // 尝试识别“角色菜单”图标
            let characterMenuResult = await recognizeImage(CharacterMenuRo, 5000);
            if (characterMenuResult.success) {
                await click(177, 433);
                await sleep(500);
                recognized = true;
                break;
            }

            // 尝试识别“天赋”文字
            let targetText = "天赋";
            let ocrRegion = { x: 133, y: 395, width: 115, height: 70 }; // 设置对应的识别区域
            let talentResult = await recognizeTextAndClick(targetText, ocrRegion);
            if (talentResult.success) {
                log.info(`点击天赋文字，坐标: x=${talentResult.x}, y=${talentResult.y}`);
                recognized = true;
                break;
            }

            await sleep(1000); // 短暂延迟，避免过快循环
        }

        let recognizedText = "";

        // 如果识别到了“角色菜单”或“天赋”，则识别“摩拉数值”
        if (recognized) {
            if (settings.notify) {
                notification.Send(`当前摩拉如图`);
            }
            let ocrRegionMora = { x: 1620, y: 25, width: 152, height: 46 }; // 设置对应的识别区域
            recognizedText = await recognizeTextInRegion(ocrRegionMora);
            if (recognizedText) {
                log.info(`成功识别到摩拉数值: ${recognizedText}`);
                result = recognizedText;
            } else {
                log.warn("未能识别到摩拉数值。");
            }
        } else {
            log.warn("未能识别到角色菜单或天赋");
        }
        await sleep(500);
        tryTimes++;
        await genshin.returnMainUi();
    }
    return Number(result);
}

// 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 在指定区域进行 OCR 识别
            const gameRegion = captureGameRegion();
            let ocrResult = gameRegion.find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            gameRegion.dispose();
            if (ocrResult) {
                let correctedText = ocrResult.text;
                return correctedText; // 返回识别到的内容
            } else {
                log.warn(`OCR 识别区域未找到内容`);
                return null; // 如果 OCR 未识别到内容，返回 null
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}

// 定义一个函数用于识别文字并点击
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 3000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试 OCR 识别
            const gameRegion = captureGameRegion();
            let resList = gameRegion.findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)); // 指定识别区域
            gameRegion.dispose();
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                let correctedText = res.text;
                if (correctedText.includes(targetText)) {
                    // 如果找到目标文本，计算并点击文字的中心坐标
                    let centerX = Math.round(res.x + res.width / 2);
                    let centerY = Math.round(res.y + res.height / 2);
                    await click(centerX, centerY);
                    await sleep(500); // 确保点击后有足够的时间等待
                    return { success: true, x: centerX, y: centerY };
                }
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`页面标志识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(1000); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别文字: ${targetText},尝试点击默认中心位置`);
    let centerX = Math.round(ocrRegion.x + ocrRegion.width / 2);
    let centerY = Math.round(ocrRegion.y + ocrRegion.height / 2);
    await click(centerX, centerY);
    await sleep(1000);
    return { success: false };
}

// 定义 readFolder 函数
async function readFolder(folderPath, onlyJson) {
    // 新增一个堆栈，初始时包含 folderPath
    const folderStack = [folderPath];

    // 新增一个数组，用于存储文件信息对象
    const files = [];

    // 当堆栈不为空时，继续处理
    while (folderStack.length > 0) {
        // 从堆栈中弹出一个路径
        const currentPath = folderStack.pop();

        // 读取当前路径下的所有文件和子文件夹路径
        const filesInSubFolder = file.ReadPathSync(currentPath);

        // 临时数组，用于存储子文件夹路径
        const subFolders = [];
        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                // 如果是文件夹，先存储到临时数组中
                subFolders.push(filePath);
            } else {
                // 如果是文件，根据 onlyJson 判断是否存储
                if (onlyJson) {
                    if (filePath.endsWith(".json")) {
                        const fileName = filePath.split('\\').pop(); // 提取文件名
                        const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                        files.push({
                            fullPath: filePath,
                            fileName: fileName,
                            folderPathArray: folderPathArray
                        });
                        //log.info(`找到 JSON 文件：${filePath}`);
                    }
                } else {
                    const fileName = filePath.split('\\').pop(); // 提取文件名
                    const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                    files.push({
                        fullPath: filePath,
                        fileName: fileName,
                        folderPathArray: folderPathArray
                    });
                    //log.info(`找到文件：${filePath}`);
                }
            }
        }
        // 将临时数组中的子文件夹路径按原顺序压入堆栈
        folderStack.push(...subFolders.reverse()); // 反转子文件夹路径
    }

    return files;
}

async function runPaths(folderFilePath) {
    let Paths = await readFolder(folderFilePath, true);
    for (let i = 0; i < Paths.length; i++) {
        let skiprecord = false;
        const Path = Paths[i];
        let success = true;
        if (settings.autoSalvage && autoSalvageCount >= 4) {
            autoSalvageCount = 0;
            if (settings.decomposeMode === "分解（经验瓶）") {
                artifactExperienceDiff += await processArtifacts(1);
            } else {
                await processArtifacts(1);
            }
        } else {
            autoSalvageCount++;
        }
        await fakeLog(Path.fileName, false, true, 0);
        const pathInfo = await parsePathing(Path.fullPath);
        try {
            log.info(`当前进度：${Path.fileName}为${folderFilePath}第${i + 1}/${Paths.length}个`);
            await pathingScript.runFile(Path.fullPath);
            await sleep(1);
        } catch (error) {
            skiprecord = true;
            log.error(`执行路径文件时发生错误：${error.message}`);
            if (error.message === "A task was canceled.") {
                log.warn("任务取消");
                state.cancel = true;
            }
            success = false;
            break;
        }
        await fakeLog(Path.fileName, false, false, 0);
        if (pathInfo.ok) {
            //回到主界面
            await genshin.returnMainUi();
            await sleep(100);
            try {
                // 获取当前人物在指定地图上的坐标
                const currentPosition = await genshin.getPositionFromMap(pathInfo.map_name);

                // 计算与最后一个非 orientation 点的距离
                const distToLast = Math.hypot(
                    currentPosition.x - pathInfo.x,
                    currentPosition.y - pathInfo.y
                );

                // 距离超过 50 认为路线没有正常完成（卡死或未开图等）
                if (distToLast >= 50) {
                    failcount++;
                    skiprecord = true;
                    log.warn(`路线${Path.fileName}没有正常完成`);
                    await sleep(5000);
                }
            } catch (error) {
                log.error(`发生错误：${error.message}`);
                skiprecord = true;
            }
        }
    }
}

async function parsePathing(pathFilePath) {
    try {
        const raw = await file.readText(pathFilePath);
        const json = JSON.parse(raw);

        // 只要 positions 不是数组就直接失败
        if (!Array.isArray(json.positions)) {
            log.error("文件positions字段异常");
            return { ok: false };
        }

        // map_name 不存在时兜底为 "Teyvat"
        const map_name =
            typeof json.map_name === 'string' && json.map_name.trim() !== ''
                ? json.map_name
                : 'Teyvat';

        // 从后往前找第一个 type !== "orientation" 的点
        for (let i = json.positions.length - 1; i >= 0; i--) {
            const p = json.positions[i];
            if (
                p.type !== 'orientation' &&
                typeof p.x === 'number' &&
                typeof p.y === 'number'
            ) {
                return {
                    ok: true,
                    x: p.x,
                    y: p.y,
                    map_name,
                };
            }
        }
        return { ok: false };
    } catch (err) {
        log.error(`解析路径文件失败: ${err.message}`);
        return { ok: false };
    }
}


// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看

async function fakeLog(name, isJs, isStart, duration) {
    await sleep(10);
    const currentTime = Date.now();
    // 参数检查
    if (typeof name !== 'string') {
        log.error("参数 'name' 必须是字符串类型！");
        return;
    }
    if (typeof isJs !== 'boolean') {
        log.error("参数 'isJs' 必须是布尔型！");
        return;
    }
    if (typeof isStart !== 'boolean') {
        log.error("参数 'isStart' 必须是布尔型！");
        return;
    }
    if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
        log.error("参数 'currentTime' 必须是整数！");
        return;
    }
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
        log.error("参数 'duration' 必须是整数！");
        return;
    }

    // 将 currentTime 转换为 Date 对象并格式化为 HH:mm:ss.sss
    const date = new Date(currentTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

    // 将 duration 转换为分钟和秒，并保留三位小数
    const durationInSeconds = duration / 1000; // 转换为秒
    const durationMinutes = Math.floor(durationInSeconds / 60);
    const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数

    // 使用四个独立的 if 语句处理四种情况
    if (isJs && isStart) {
        // 处理 isJs = true 且 isStart = true 的情况
        const logMessage = `正在伪造js开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行JS脚本: "${name}"`;
        log.debug(logMessage);
    }
    if (isJs && !isStart) {
        // 处理 isJs = true 且 isStart = false 的情况
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
    if (!isJs && isStart) {
        // 处理 isJs = false 且 isStart = true 的情况
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    }
    if (!isJs && !isStart) {
        // 处理 isJs = false 且 isStart = false 的情况
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
}