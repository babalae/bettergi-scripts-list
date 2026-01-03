const runExtra = settings.runExtra || false;
const leaveTeamRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/leaveTeam.png"));
let targetItems;
let pickupDelay = 100;
let timeMove = 1000;
let findFInterval = (+settings.findFInterval || 100);
if (findFInterval < 16) {
    findFInterval = 16;
}
if (findFInterval > 200) {
    findFInterval = 200;
}
let lastRoll = new Date();
let checkDelay = Math.round(findFInterval / 2);
let timeMoveUp = Math.round(timeMove * 0.45);
let timeMoveDown = Math.round(timeMove * 0.55);
let rollingDelay = 50;
let state;
let gameRegion;
let TMthreshold = +settings.TMthreshold || 0.9;
let doRunExtra = false;
let expGain;
let skipRunning = false;
let runnedEnding = false;

(async function () {
    setGameMetrics(1920, 1080, 1);

    if (settings.logName) {
        expGain = await processArtifacts();
    }
    await genshin.tpToStatueOfTheSeven();
    await switchPartyIfNeeded(settings.partyName);
    targetItems = await loadTargetItems();
    if (settings.groupMode != "按照下列配置自动进入并运行") {
        await genshin.clearPartyCache();
        await runGroupPurchasing(runExtra);
    }
    if (settings.groupMode != "手动进入后运行") {
        //解析与输出自定义配置
        const raw = settings.runningOrder || "1234";
        if (!/^[1-4]+$/.test(raw)) {
            throw new Error('runningOrder 只能由 1-4 的数字组成，检测到非法字符。');
        }
        if (new Set(raw).size !== raw.length) {
            throw new Error('runningOrder 中出现了重复数字。');
        }
        const enteringIndex = raw.split('').map(Number);
        const msg = '将依次进入' + enteringIndex.map(i => `${i}号`).join('，') + '的世界';
        log.info(msg);
        const yourIndex = Number(settings.yourIndex);
        if (!yourIndex || yourIndex < 1 || yourIndex > 4) {
            throw new Error('yourIndex 必须是 1-4 之间的数字。');
        }
        const pos = enteringIndex.indexOf(yourIndex) + 1; // 第几个执行
        log.info(`你的序号是${yourIndex}号，将在第${pos}个执行`);

        let loopCnt = 0;
        // 按 runningOrder 依次进入世界并执行联机收尾
        for (const idx of enteringIndex) {
            if (skipRunning) {
                break;
            }
            await genshin.clearPartyCache();
            if (settings.usingCharacter) { await sleep(1000); keyPress(`${settings.usingCharacter}`); }
            //构造加入idx号世界的autoEnter的settings
            let autoEnterSettings;
            if (idx === yourIndex) {
                settings.forceGroupNumber = 1;//将房主强制指定为房主
                // 1. 先收集真实存在的白名单
                const permits = {};
                let permitIndex = 1;
                for (const otherIdx of [1, 2, 3, 4]) {
                    if (otherIdx !== yourIndex) {
                        const pName = settings[`p${otherIdx}Name`];
                        if (pName) {                       // 过滤掉空/undefined
                            permits[`nameToPermit${permitIndex}`] = pName;
                            permitIndex++;
                        }
                    }
                }

                // 2. 用真正写进去的人数作为 maxEnterCount
                autoEnterSettings = {
                    enterMode: "等待他人进入",
                    permissionMode: "白名单",
                    timeout: loopCnt++ === 0 ? 10 : 5,   // ← 第一次 10，之后 5
                    maxEnterCount: Object.keys(permits).length
                };

                Object.assign(autoEnterSettings, permits);
                log.info(`等待他人进入自己世界，目标人数：${autoEnterSettings.maxEnterCount}`);
                notification.send(`等待他人进入自己世界，目标人数：${autoEnterSettings.maxEnterCount}`);
            } else {
                settings.forceGroupNumber = 0;//取消强制指定
                // 构造队员配置
                autoEnterSettings = {
                    enterMode: "进入他人世界",
                    enteringUID: settings[`p${idx}UID`],
                    timeout: loopCnt++ === 0 ? 10 : 5,   // ← 第一次 10，之后 5
                };
                log.info(`将要进入序号${idx}，uid为${settings[`p${idx}UID`]}的世界`);
                notification.send(`将要进入序号${idx}，uid为${settings[`p${idx}UID`]}，名称为${settings[`p${idx}Name`]}的世界`);
            }
            let attempts = 0;
            while (attempts < 5) {
                attempts++;
                await autoEnter(autoEnterSettings);
                //队员加入后要检查房主名称
                if (autoEnterSettings.enterMode === "进入他人世界" && attempts != 5) {
                    if (await checkP1Name(settings[`p${idx}Name`])) {
                        notification.send(`成功进入序号${idx}，uid为${settings[`p${idx}UID`]}，名称为${settings[`p${idx}Name`]}的世界`);
                        break;
                    } else {
                        //进入了错误的世界，退出世界并重新加入,最后一次不检查
                        await sleep(1000);
                        let leaveAttempts = 0;
                        while (leaveAttempts < 10) {
                            leaveAttempts++;
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
                } else {
                    break;
                }
            }
            //执行对应的联机狗粮
            await runGroupPurchasing(false);
            settings.forceGroupNumber = 0;//解除强制指定
        }
        //如果勾选了额外，且本次自动运行当过房主成功进人，在结束后再执行一次额外路线
        if (settings.runExtra && doRunExtra) {
            await runGroupPurchasing(runExtra);
        }
    }
    await genshin.tpToStatueOfTheSeven();

    if (skipRunning && !runnedEnding) {
        log.info(`本次运行启用并触发了强迫症模式，且未完成收尾路线需要重新上线`);

        // 按中文分号分割字符串
        const segments = settings.onlyRunPerfectly.split('；');

        // 逐段输出，每段间隔1秒
        for (const segment of segments) {
            if (segment.trim()) { // 跳过空段落
                log.info(segment.trim());
                await sleep(1000);
            }
        }
        await sleep(10000);
        return;
    }

    if (settings.logName) {
        expGain = await processArtifacts() - expGain;
        log.info(`${settings.logName}：联机狗粮分解获得经验${expGain}`);
        notification.send(`${settings.logName}：联机狗粮分解获得经验${expGain}`);
    }

    {
        log.info(`本次运行未启用或未触发强迫症模式，正常结束`);
        if (settings.normalEnding) {
            // 按中文分号分割字符串
            const segments = settings.normalEnding.split('；');

            // 逐段输出，每段间隔1秒
            for (const segment of segments) {
                if (segment.trim()) { // 跳过空段落
                    log.info(segment.trim());
                    await sleep(1000);
                }
            }
        }
    }
}
)();

async function checkP1Name(p1Name) {
    if (true) {
        //log.info("禁用了房主名称校验，直接视为通过");
        //强制禁用房主检测
        return true;
    }
    try {
        // 加载目标 PNG
        const targetPngs = await readFolder(targetsPath, false);
        for (const f of targetPngs) {
            if (!f.fullPath.endsWith('.png')) continue;
            const mat = file.ReadImageMatSync(f.fullPath);
            const ro = RecognitionObject.TemplateMatch(mat, 395, 158, 588, 65);
            const baseName = f.fileName.replace(/\.png$/i, '');
            targetsRo.push({ ro, baseName });
        }
        log.info(`加载完成共 ${targetsRo.length} 个目标`);
        await genshin.returnMainUi();
        await keyPress("F2");
        await sleep(2000);
        const gameRegion = captureGameRegion();
        for (const { ro, baseName } of targetsRo) {
            if (gameRegion.find(ro).isExist()) { gameRegion.dispose(); log.info(`找到房主为${baseName}`); return true; }
        }
        gameRegion.dispose();
    } catch { }
    try {
        const gameRegion = captureGameRegion();
        const resList = gameRegion.findMulti(RecognitionObject.ocr(400, 170, 300, 55));
        gameRegion.dispose();
        let hit = null;
        let txt;
        for (const res of resList) {
            txt = res.text.trim();
            if (txt === p1Name) { hit = txt; break; }
        }
        if (hit) {
            log.info(`识别到房主为${hit}，与预期相符`);
            return true;
        } else {
            log.warn(`识别结果为${txt},与预期的${p1Name}不符，重试`);
            return false;
        }
    } catch { return false; }
}


/**
 * 群收尾 / 额外路线统一入口
 * 
 */
async function runGroupPurchasing(runExtra) {
    // ===== 1. 读取配置 =====
    const p1EndingRoute = settings.p1EndingRoute || "枫丹高塔";
    const p2EndingRoute = "度假村";
    const p3EndingRoute = "智障厅";
    const p4EndingRoute = "踏鞴砂";
    const forceGroupNumber = settings.forceGroupNumber || 0;

    // ===== 2. 图标模板 =====
    const kickAllRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickAll.png"));
    const confirmKickRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirmKick.png"));


    // ===== 3. 初始化变量 =====
    let _infoPoints = null;
    let running = true;

    // ===== 4. 主流程 =====
    log.info("开始识别队伍编号");
    let groupNumBer = await getPlayerSign();
    if (groupNumBer !== 0) log.info(`在队伍中编号为${groupNumBer}`);
    else log.info(`不处于联机模式或识别异常`);

    if (forceGroupNumber != 0) {
        groupNumBer = forceGroupNumber;
        log.info(`将自己在队伍中的编号强制指定为${groupNumBer}`);
    }

    if (groupNumBer === 1) {
        log.info("是1p，检测当前总人数");
        const totalNumber = await findTotalNumber();
        await waitForReady(totalNumber);
        if (skipRunning) {
            log.info(`强迫症模式启用中，队友不齐或未及时到位，跳过所有路线`);
            notification.send(`强迫症模式启用中，队友不齐或未及时到位，跳过所有路线`);
            await sleep(10000);
        } else {
            for (let i = 1; i <= totalNumber; i++) await runEndingPath(i);
        }
        let kickAttempts = 0;
        while (kickAttempts < 10) {
            kickAttempts++;
            await genshin.returnMainUi();
            await keyPress("F2");
            await sleep(2000);
            await findAndClick(kickAllRo);
            await sleep(500);
            await findAndClick(confirmKickRo);
            await waitForMainUI(true);
            await genshin.returnMainUi();
            if (await getPlayerSign() === 0) {
                await genshin.returnMainUi();
                break;
            }
            await genshin.returnMainUi();
            await sleep(10000);
        }
    } else if (groupNumBer > 1) {
        await goToTarget(groupNumBer);
        let start = new Date();
        while (new Date() - start < 2 * 60 * 60 * 1000) {
            if (await waitForMainUI(false, 60 * 60 * 1000)) {
                await waitForMainUI(true);
                await genshin.returnMainUi();
                if (await getPlayerSign() === 0) {
                    break;
                }
            }
        }
        if (new Date() - start > 2 * 60 * 60 * 1000) {
            log.warn("超时仍未回到主界面，主动退出");
        }
        let leaveAttempts = 0;
        while (leaveAttempts < 10) {
            if (await getPlayerSign() === 0) {
                break;
            }
            await keyPress("F2");
            await sleep(1000);
            await findAndClick(leaveTeamRo);
            await waitForMainUI(true);
            await genshin.returnMainUi();
        }
    } else if (groupNumBer === 0) {
        if (runExtra) {
            log.info("请确保联机收尾已结束，将开始运行额外路线");
            await runExtraPath();
        } else {
            log.warn("处于单人模式，不执行任何路线");
        }
    } else {
        log.warn("角色编号识别异常")
    }
    running = false;

    /**
     * 等待所有队友（2P/3P/4P）就位
     * @param {number} totalNumber  联机总人数（包含自己）
     * @param {number} timeOut      最长等待毫秒
     */
    async function waitForReady(totalNumber, timeOut = 300000) {
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
                if (settings.runDebug) await sleep(10000);
                return true;
            }

            // 每轮检测后稍等，防止刷屏
            await sleep(500);
        }

        log.warn("等待队友就绪超时");
        if (settings.onlyRunPerfectly) {
            skipRunning = true;
            doRunExtra = false;
        }
        return false;
    }

    async function checkReady(i) {
        try {
            /* 1. 先把地图移到目标点位（point 来自 info.json） */
            const point = await getPointByPlayer(i);
            if (!point) return false;
            // 把路径封装在函数内部
            const map = {
                2: "assets/RecognitionObject/2pInBigMap.png",
                3: "assets/RecognitionObject/3pInBigMap.png",
                4: "assets/RecognitionObject/4pInBigMap.png"
            };
            const tplPath = map[i];
            if (!tplPath) {
                log.error(`无效玩家编号: ${i}`);
                return null;
            }

            const template = file.ReadImageMatSync(tplPath);
            const recognitionObj = RecognitionObject.TemplateMatch(template, 0, 0, 1920, 1080); // 全屏查找，可自行改区域
            if (await findAndClick(recognitionObj, 5)) await sleep(1000);

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

            return dist <= 10;   // 10 m 阈值，可按需调整
        } catch (error) {
            log.error(error.message);
            return false;
        }
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
        runnedEnding = true;
        if (!settings.runDebug) {
            for (const { fullPath } of files) {
                await runPath(fullPath, 1);
            }
            log.info(`${folderName} 的全部路线已完成`);
        } else {
            log.info("当前为调试模式，跳过执行路线");
        }
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

        if (skipRunning) {
            log.info(`强迫症模式启用中，队友不齐或未及时到位，跳过所有路线`);
            notification.send(`强迫症模式启用中，队友不齐或未及时到位，跳过所有路线`);
            await sleep(10000);
            return;
        }

        if (!settings.runDebug) {
            for (const { fullPath } of files) {
                await runPath(fullPath, 1);
            }

            log.info(`额外 的全部路线已完成`);
        } else {
            log.info("当前为调试模式，跳过执行路线");
        }
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
        }

        for (const { fullPath } of files) {
            await runPath(fullPath, 1);
        }
        try {
            const pos = await genshin.getPositionFromMap();
            const dist = Math.hypot(pos.x - 2297.3, pos.y + 823.8);
            if (dist && dist < 100) {
                log.warn("仍然在七天神像附近，尝试重跑至多一次");
                for (const { fullPath } of files) {
                    await runPath(fullPath, 1);
                }
            }
        } catch (error) {

        }
        log.info(`${folderName} 的全部路线已完成`);
    }
}
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
    const targetPngs = await readFolder(targetsPath, false);
    for (const f of targetPngs) {
        if (!f.fullPath.endsWith('.png')) continue;
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

//切换队伍
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }
    try {
        log.info("正在尝试切换至" + partyName);
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(partyName);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}

async function findAndClick(target, maxAttempts = 20) {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const gameRegion = captureGameRegion();
        try {
            const result = gameRegion.find(target);
            if (result.isExist()) {
                await sleep(250);
                result.click();
                return true;                 // 成功立刻返回
            }
        } catch (err) {
        } finally {
            gameRegion.dispose();
        }
        if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
            await sleep(250);
        }
    }
    //log.error("已达到重试次数上限，仍未找到目标");
    return false;
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

async function runPath(fullPath, targetItemPath) {
    state = { running: true };

    /* ---------- 主任务 ---------- */
    const pathingTask = (async () => {
        await genshin.returnMainUi();
        log.info(`开始执行路线: ${fullPath}`);
        await fakeLog(fullPath, false, true, 0);
        await pathingScript.runFile(fullPath);
        await fakeLog(fullPath, false, false, 0);
        state.running = false;
    })();

    /* ---------- 伴随任务 ---------- */

    const pickupTask = (async () => {
        await recognizeAndInteract();
    })();

    const errorProcessTask = (async () => {
        const revivalRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/复苏.png"));
        const readingRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/readingUI.png"), 72, 22, 133 - 72, 79 - 22);
        const dialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/dialogueUI.png"), 187, 26, 233 - 130, 69);
        let errorCheckCount = 9;
        while (state.running) {
            await sleep(100);
            errorCheckCount++;
            if (errorCheckCount > 50) {
                errorCheckCount = 0;

                if (await findAndClick(revivalRo, 1)) {
                    log.info("识别到复苏按钮，点击复苏");
                    errorCheckCount = 50;
                }

                if (await findRo(readingRo, 1)) {
                    log.info("识别到阅读界面，esc脱离");
                    await genshin.returnMainUi();
                    errorCheckCount = 50;
                }

                if (await findRo(dialogueRo, 1)) {
                    log.info("识别到对话界面，点击进行对话");
                    click(960, 540);
                    errorCheckCount = 50;
                }

                async function findRo(target, maxAttempts = 20) {
                    for (let attempts = 0; attempts < maxAttempts; attempts++) {
                        const gameRegion = captureGameRegion();
                        try {
                            const result = gameRegion.find(target);
                            if (result.isExist()) {
                                await sleep(250);
                                log.info("找到图标");
                                return true;
                            }
                        } catch (err) {
                        } finally {
                            gameRegion.dispose();
                        }
                        if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
                            await sleep(250);
                        }
                    }
                    return false;
                }
            }
        }
    })();

    /* ---------- 并发等待 ---------- */
    await Promise.allSettled([pathingTask, pickupTask, errorProcessTask]);
}

//加载拾取物图片
async function loadTargetItems() {
    const targetItemPath = 'assets/targetItems';   // 固定目录
    const items = await readFolder(targetItemPath, false);
    // 统一预加载模板
    for (const it of items) {
        it.template = file.ReadImageMatSync(it.fullPath);
        it.itemName = it.fileName.replace(/\.png$/i, '');
    }
    return items;
}

// 定义一个函数用于拾取
async function recognizeAndInteract() {
    //log.info("调试-开始执行图像识别与拾取任务");
    let lastcenterYF = 0;
    let lastItemName = "";
    let fIcontemplate = file.ReadImageMatSync('assets/F_Dialogue.png');
    let mainUITemplate = file.ReadImageMatSync("assets/MainUI.png");
    let thisMoveUpTime = 0;
    let lastMoveDown = 0;

    gameRegion = captureGameRegion();
    //主循环
    while (state.running) {
        gameRegion.dispose();
        gameRegion = captureGameRegion();
        let centerYF = await findFIcon();
        if (!centerYF) {
            if (await isMainUI()) {
                if (new Date() - lastRoll >= 200) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                    lastRoll = new Date();
                }
            }
            continue;
        }
        //log.info(`调试-成功找到f图标,centerYF为${centerYF}`);
        let foundTarget = false;
        let itemName = await performTemplateMatch(centerYF);
        if (itemName) {
            //log.info(`调试-识别到物品${itemName}`);
            if (Math.abs(lastcenterYF - centerYF) <= 20 && lastItemName === itemName) {
                //log.info("调试-相同物品名和相近y坐标，本次不拾取");
                await sleep(2 * pickupDelay);
                lastcenterYF = -20;
                lastItemName = null;
            } else {
                keyPress("F");
                log.info(`交互或拾取："${itemName}"`);
                lastcenterYF = centerYF;
                lastItemName = itemName;
                await sleep(pickupDelay);
            }
        } else {
            /*
            log.info("识别失败，尝试截图");
            await refreshTargetItems(centerYF);
            lastItemName = "";
            */
        }

        if (!foundTarget) {
            //log.info(`调试-执行滚轮动作`);
            const currentTime = new Date().getTime();
            if (currentTime - lastMoveDown > timeMoveUp) {
                await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                if (thisMoveUpTime === 0) thisMoveUpTime = currentTime;
                if (currentTime - thisMoveUpTime >= timeMoveDown) {
                    lastMoveDown = currentTime;
                    thisMoveUpTime = 0;
                }
            } else {
                await keyMouseScript.runFile(`assets/滚轮上翻.json`);
            }
            await sleep(rollingDelay);
        }
    }

    async function performTemplateMatch(centerYF) {
        try {
            let result;
            let itemName = null;
            for (const targetItem of targetItems) {
                //log.info(`正在尝试匹配${targetItem.itemName}`);
                const cnLen = Math.min([...targetItem.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length, 5);
                const recognitionObject = RecognitionObject.TemplateMatch(
                    targetItem.template,
                    1219,
                    centerYF - 15,
                    12 + 28 * cnLen + 2,
                    30
                );

                recognitionObject.Threshold = TMthreshold;
                recognitionObject.InitTemplate();
                result = gameRegion.find(recognitionObject);
                if (result.isExist()) {
                    itemName = targetItem.itemName;
                    break;
                }
            }
            return itemName;
        } catch (error) {
            log.error(`模板匹配时发生异常: ${error.message}`);
            return null;
        }
    }

    async function findFIcon() {
        let recognitionObject = RecognitionObject.TemplateMatch(fIcontemplate, 1102, 335, 34, 400);
        recognitionObject.Threshold = 0.95;
        recognitionObject.InitTemplate();
        try {
            let result = gameRegion.find(recognitionObject);
            if (result.isExist()) {
                return Math.round(result.y + result.height / 2);
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            if (!state.running)
                return null;
        }
        await sleep(checkDelay);
        return null;
    }

    async function isMainUI() {
        const recognitionObject = RecognitionObject.TemplateMatch(mainUITemplate, 0, 0, 150, 150);
        const maxAttempts = 1;
        let attempts = 0;

        while (attempts < maxAttempts && state.running) {
            try {
                const result = gameRegion.find(recognitionObject);
                if (result.isExist()) return true;
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
                if (!state.running) break;
                return false;
            }
            attempts++;
            await sleep(checkDelay);
        }
        return false;
    }
}

async function processArtifacts() {
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

    const decomposeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/decompose.png"));
    const quickChooseRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/quickChoose.png"));
    const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirm.png"));
    const doDecomposeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/doDecompose.png"));
    const doDecompose2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/doDecompose2.png"));

    const outDatedRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/ConfirmButton.png"), 760, 700, 100, 100);
    await genshin.returnMainUi();
    await sleep(500);
    let result = 0;
    try {
        result = await decomposeArtifacts();
    } catch (error) {
        log.error(`处理狗粮分解时发生异常: ${error.message}`);
    }
    await genshin.returnMainUi();
    return result;

    async function decomposeArtifacts() {
        keyPress("B");
        if (await findAndClick(outDatedRo)) {
            log.info("检测到过期物品弹窗，处理");
            await sleep(1000);
        }
        await sleep(1000);
        await click(670, 45);
        await sleep(500);
        if (!await findAndClick(decomposeRo)) {
            await genshin.returnMainUi();
            return 0;
        }
        await sleep(1000);

        // 识别已储存经验（1570-880-1650-930）
        const regionToCheck1 = { x: 1570, y: 880, width: 80, height: 50 };
        const raw = await recognizeTextInRegion(regionToCheck1);

        // 把识别到的文字里所有非数字字符去掉，只保留数字
        const digits = (raw || '').replace(/\D/g, '');

        let initialValue = 0;
        if (digits) {
            initialValue = parseInt(digits, 10);
            log.info(`已储存经验识别成功: ${initialValue}`);
        } else {
            log.warn(`在指定区域未识别到有效数字: ${initialValue}`);
        }

        let regionToCheck3 = { x: 100, y: 885, width: 170, height: 50 };

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
        await sleep(1500);

        let decomposedNum2 = await recognizeTextInRegion(regionToCheck3);

        // 使用正则表达式提取第一个数字
        const match2 = decomposedNum2.match(/已选(\d+)/);

        // 检查是否匹配成功
        if (match2) {
            // 将匹配到的第一个数字转换为数字类型并存储在变量中
            let firstNumber2 = Number(match2[1]);
            log.info(`分解总数是: ${firstNumber2}`);
        } else {
            log.info("识别失败");
        }
        //识别当前总经验
        notification.Send(`当前经验如图`);
        // 当前总经验（1470-880-205-70）
        const regionToCheck2 = { x: 1470, y: 880, width: 205, height: 70 };
        const raw2 = await recognizeTextInRegion(regionToCheck2);

        // 只保留数字
        const digits2 = (raw2 || '').replace(/\D/g, '');

        let newValue = 0;
        if (digits2) {
            newValue = parseInt(digits2, 10);
            log.info(`当前总经验识别成功: ${newValue}`);
        } else {
            log.warn(`在指定区域未识别到有效数字: ${newValue}`);
        }
        /*
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
        */
        const resinExperience = Math.max(newValue - initialValue, 0);
        log.info(`分解可获得经验: ${resinExperience}`);
        let resultExperience = resinExperience;
        if (resultExperience === 0) {
            resultExperience = initialValue;
        }
        const result = resultExperience;
        await genshin.returnMainUi();
        return result;
    }

    async function findAndClick(target, maxAttempts = 20) {
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const gameRegion = captureGameRegion();
            try {
                const result = gameRegion.find(target);
                if (result.isExist()) {
                    await sleep(250);
                    result.click();
                    return true;                 // 成功立刻返回
                }
            } catch (err) {
            } finally {
                gameRegion.dispose();
            }
            if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
                await sleep(250);
            }
        }
        return false;
    }
}