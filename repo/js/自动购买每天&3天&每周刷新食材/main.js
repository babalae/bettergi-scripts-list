// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看
// name: 字符串，表示脚本或地图追踪的名称
// isJs: 布尔值，true表示脚本，false表示地图追踪
// isStart: 布尔值，true表示开始日志，false表示结束日志
// duration: 整数，表示脚本或地图追踪的运行时间（仅在结束日志时使用），单位为毫秒＿基本填０即可
// 示例:
// JS脚本开始
// await fakeLog("js脚本名", true, true, 0);
// JS脚本结束
// await fakeLog("js脚本名", true, false, 0);
// 地图追踪开始
// await fakeLog("地图追踪名", false, true, 0);
// 地图追踪结束
// await fakeLog("地图追踪名", false, false, 0);
// 交互或拾取："XXXX"
// await fakeLog("XXXX", false, false, 23333);
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
    // 交互或拾取："XXXX"
    if (duration == 23333) {
        log.info(`交互或拾取："${name}"`);
    }
}

// ==================== 日志辅助函数 ====================
function logConditional(message) {
    if (ignoreRecords || recordDebug) {
        log.info(message);
    } else {
        log.debug(message);
    }
}

// ==================== 加载外部数据文件 ====================
let foodsData = {};
let npcData = {};

async function loadExternalData() {
    try {
        // 加载食材数据
        const foodsContent = await file.readText("assets/data/foods.json");
        foodsData = JSON.parse(foodsContent);
        logConditional(`已加载食材数据: ${Object.keys(foodsData).length} 种食材`);
        
        // 加载NPC数据
        const npcsContent = await file.readText("assets/data/npcs.json");
        npcData = JSON.parse(npcsContent);
        logConditional(`已加载NPC数据: ${Object.keys(npcData).length} 个NPC`);
        
        return true;
    } catch (error) {
        log.error(`加载外部数据失败: ${error.message}`);
        return false;
    }
}

// ==================== 辅助函数：获取调整后的星期几（1-7，周一为1） ====================
function getAdjustedDayOfWeek() {
    const now = new Date();
    let dayOfWeek = now.getDay(); // 0-6 (0是周日)
    const hours = now.getHours();

    // 如果时间在00:00~04:00之间，视为前一天
    if (hours < 4) {
        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 前一天
        if (recordDebug) {
            log.info(`[调试] 当前时间 ${now.getHours()}:${now.getMinutes()}，视为前一天（周 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
        }
    } else if (recordDebug) {
        log.info(`[调试] 当前时间 ${now.getHours()}:${now.getMinutes()}，使用当天（周 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
    }

    // 转换为1-7格式（7代表周日）
    return dayOfWeek === 0 ? 7 : dayOfWeek;
}

// ==================== 辅助函数：获取给定日期所在的周一日期 ====================
function getMondayOfWeek(date) {
    const d = new Date(date);
    // 调整到4点刷新
    if (d.getHours() < 4) {
        d.setDate(d.getDate() - 1);
    }
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    d.setHours(4, 0, 0, 0);
    return d;
}

// ==================== 账号管理功能 ====================
let userName = settings.userName || "默认账户";

// 确保设置变量存在
const ignoreRecords = settings.ignoreRecords || false;
const recordDebug = settings.recordDebug || false;

// 解析禁用的NPC列表
const disabledNpcs = (settings.disabledNpcs || "").split(/\s+/).filter(npc => npc.trim() !== "");
if (disabledNpcs.length > 0) {
    log.info(`已禁用NPC: ${disabledNpcs.join(", ")}`);
}

// 修改AKF设置处理
const AKFValue = parseInt(settings.AKF) || 1;
let AFKDay = null;
let followSystem = false;

if (AKFValue === 0) {
    // 0 表示跟随系统判定
    followSystem = true;
    log.info("7天食材购买: 跟随系统判定");
} else {
    AFKDay = AKFValue === 7 ? 0 : AKFValue;
    log.info(`7天食材购买: 每周${AFKDay === 0 ? "日" : AFKDay}购买`);
}

// 获取账号记录路径
function getRecordPath(accountName) {
    // 简单处理账户名，如果为空则使用默认账户
    if (!accountName || accountName.trim() === "") {
        accountName = "默认账户";
    }
    return `record/${accountName.trim()}/records.json`;
}

// 确保账号目录存在
async function ensureAccountDirectory(accountName) {
    const validName = validateUserName(accountName);
    const dirPath = `record/${validName}`;

    try {
        // 检查目录是否存在
        await file.readText(dirPath + "/.keep");
    } catch (error) {
        // 目录不存在，尝试创建
        try {
            // 创建目录（通过写入一个临时文件）
            await file.writeText(dirPath + "/.keep", "");
            log.info(`创建账号目录: ${dirPath}`);
        } catch (mkdirError) {
            log.error(`创建账号目录失败: ${mkdirError.message}`);
        }
    }
}

// ==================== 新增函数：读取NPC记录文件 ====================
async function loadNpcRecords() {
    const recordPath = getRecordPath(userName);
    try {
        const content = await file.readText(recordPath);
        if (content.trim()) {
            return JSON.parse(content);
        }
    } catch (error) {
        // 文件不存在或格式错误，返回空数组
    }
    return [];
}

// ==================== 保存NPC记录 ====================
async function saveNpcRecords(records) {
    const recordPath = getRecordPath(userName);
    try {
        await file.writeText(recordPath, JSON.stringify(records, null, 2));
        return true;
    } catch (error) {
        log.error(`保存记录文件失败: ${error.message}`);
        return false;
    }
}

// ==================== 获取NPC记录 ====================
function getNpcRecord(records, npcName) {
    return records.find(record => record.npcname === npcName);
}

// ==================== 更新NPC记录 ====================
function updateNpcRecord(records, npcName, refreshType, purchasedItems) {
    // 如果没有购买任何商品，不更新记录
    if (!purchasedItems || purchasedItems.length === 0) {
        return records;
    }

    let record = getNpcRecord(records, npcName);

    if (!record) {
        record = {
            npcname: npcName,
            "1d": [],
            "1d_time": null,
            "3d": [],
            "3d_time": null,
            "7d": [],
            "7d_time": null
        };
        records.push(record);
    }

    const now = new Date();
    let refreshTime;

    if (refreshType === "1d") {
        // 1天商品：下次刷新是购买日+1天
        refreshTime = new Date(now);
        refreshTime.setHours(4, 0, 0, 0);
        // 如果当前时间在4点前，刷新时间从昨天开始算
        if (now.getHours() < 4) {
            refreshTime.setDate(refreshTime.getDate() - 1);
        }
        refreshTime.setDate(refreshTime.getDate() + 1);
    } else if (refreshType === "3d") {
        // 3天商品：基于基准日的3天周期计算
        // 基准时间：2025-08-09 04:00 GMT+8 (转换为本地时间)
        const baseTime = new Date(2025, 7, 9, 4, 0, 0); // 2025-08-09 04:00
        
        // 调整当前时间到4点基准
        const adjustedNow = new Date(now);
        if (adjustedNow.getHours() < 4) {
            adjustedNow.setDate(adjustedNow.getDate() - 1);
        }
        adjustedNow.setHours(4, 0, 0, 0);
        
        // 计算距离基准日的天数
        const timeDiff = adjustedNow.getTime() - baseTime.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        // 计算当前3天周期
        const currentPeriod = Math.floor(daysDiff / 3);
        
        // 下一个3天周期的开始时间
        const nextPeriod = currentPeriod + 1;
        refreshTime = new Date(baseTime);
        refreshTime.setDate(baseTime.getDate() + (nextPeriod * 3));
        
        // 确保刷新时间是04:00
        refreshTime.setHours(4, 0, 0, 0);
    } else if (refreshType === "7d") {
        // 7天商品：下次刷新是下周一
        refreshTime = getMondayOfWeek(now);
        refreshTime.setDate(refreshTime.getDate() + 7);
    }

    // 只更新实际购买的商品
    record[refreshType] = purchasedItems;
    record[`${refreshType}_time`] = formatDateToLocalISO(refreshTime);

    // 计算下次刷新日期
    if (recordDebug) {
        const nextRefresh = new Date(refreshTime);
        log.info(`${npcName} 下次${refreshType}刷新时间: ${formatDateToLocalISO(nextRefresh)}`);
    }

    return records;
}

// ==================== 新增函数：计算基准日周期 ====================
function getBasePeriod(currentDate) {
    // 基准时间：2025-08-08 20:00 UTC (对应2025-08-09 04:00 GMT+8)
    const baseTime = Date.UTC(2025, 7, 8, 20, 0, 0);

    // 转换当前时间到UTC+8
    const utcNowMs = currentDate.getTime() + currentDate.getTimezoneOffset() * 60 * 1000;
    const gmt8Ms = utcNowMs + 8 * 60 * 60 * 1000;
    const gmt8Date = new Date(gmt8Ms);

    // 如果还没到凌晨4点，算作前一天
    if (gmt8Date.getHours() < 4) {
        gmt8Date.setDate(gmt8Date.getDate() - 1);
    }

    // 计算距离基准日的天数
    const daysDiff = Math.floor((gmt8Date.getTime() - baseTime) / (24 * 60 * 60 * 1000));

    return {
        day: gmt8Date,
        daysDiff: daysDiff,
        threeDayPeriod: Math.floor(daysDiff / 3),
        sevenDayPeriod: Math.floor(daysDiff / 7)
    };
}

// ==================== 判断是否需要购买 ====================
function shouldBuyFoods(npc, npcRecord, currentPeriod, forceRefresh = false) {
    const now = new Date();
    const foodsToBuy = {
        "1d": [],
        "3d": [],
        "7d": []
    };

    if (forceRefresh) {
        // 强制刷新，但只购买已启用的商品
        if (npc._1d_foods) foodsToBuy["1d"] = filterEnabledFoods(npc._1d_foods);
        if (npc._3d_foods) foodsToBuy["3d"] = filterEnabledFoods(npc._3d_foods);
        if (npc._7d_foods) foodsToBuy["7d"] = filterEnabledFoods(npc._7d_foods);
        return foodsToBuy;
    }

    // 1天商品逻辑
    if (npc._1d_foods) {
        const enabledFoods = filterEnabledFoods(npc._1d_foods);
        if (enabledFoods.length > 0) {
            if (!npcRecord || !npcRecord["1d_time"]) {
                // 没有记录，需要购买已启用的商品
                foodsToBuy["1d"] = enabledFoods;
            } else {
                // 读取记录中的下次刷新时间
                const nextRefreshTime = new Date(npcRecord["1d_time"]);

                if (now >= nextRefreshTime) {
                    // 已到刷新时间，需要购买
                    foodsToBuy["1d"] = enabledFoods;
                } else if (recordDebug) {
                    log.info(`[调试] ${npc.name} 的1天商品未到刷新时间，下次刷新: ${formatDateToLocalISO(nextRefreshTime)}`);
                }
            }
        }
    }

    // 3天商品逻辑
    if (npc._3d_foods) {
        const enabledFoods = filterEnabledFoods(npc._3d_foods);
        if (enabledFoods.length > 0) {
            if (!npcRecord || !npcRecord["3d_time"]) {
                // 没有记录，直接购买
                foodsToBuy["3d"] = enabledFoods;
                if (recordDebug) {
                    log.info(`[调试] ${npc.name} 的3天商品没有记录，直接购买`);
                }
            } else {
                // 有记录，检查是否已刷新
                const nextRefreshTime = new Date(npcRecord["3d_time"]);

                if (now >= nextRefreshTime) {
                    // 已到刷新时间，需要购买
                    foodsToBuy["3d"] = enabledFoods;
                    if (recordDebug) {
                        log.info(`[调试] ${npc.name} 的3天商品已到刷新时间，需要购买`);
                    }
                } else if (recordDebug) {
                    log.info(`[调试] ${npc.name} 的3天商品未到刷新时间，下次刷新: ${formatDateToLocalISO(nextRefreshTime)}`);
                }
            }
        }
    }

    // 7天商品逻辑
    if (npc._7d_foods) {
        const enabledFoods = filterEnabledFoods(npc._7d_foods);
        if (enabledFoods.length > 0) {
            if (!npcRecord || !npcRecord["7d_time"]) {
                // 没有记录，直接购买
                foodsToBuy["7d"] = enabledFoods;
                if (recordDebug) {
                    log.info(`[调试] ${npc.name} 的7天商品没有记录，直接购买`);
                }
            } else {
                // 有记录，检查是否已刷新
                const nextRefreshTime = new Date(npcRecord["7d_time"]);

                if (now >= nextRefreshTime) {
                    // 已到刷新时间，检查是否应该购买
                    if (followSystem) {
                        // 跟随系统模式：直接购买
                        foodsToBuy["7d"] = enabledFoods;
                        if (recordDebug) {
                            log.info(`[调试] ${npc.name} 的7天商品已到刷新时间，跟随系统模式，直接购买`);
                        }
                    } else {
                        // 固定日模式：检查今天是否是指定购买日
                        const today = getAdjustedDayOfWeek();
                        const targetDay = AFKDay === 0 ? 7 : AFKDay; // 将0（周日）转换为7

                        if (today === targetDay) {
                            foodsToBuy["7d"] = enabledFoods;
                            if (recordDebug) {
                                log.info(`[调试] ${npc.name} 的7天商品已到刷新时间，今天是指定购买日(${targetDay})，购买`);
                            }
                        } else if (recordDebug) {
                            log.info(`[调试] ${npc.name} 的7天商品已到刷新时间，但今天(${today})不是指定购买日(${targetDay})，不购买`);
                        }
                    }
                } else if (recordDebug) {
                    log.info(`[调试] ${npc.name} 的7天商品未到刷新时间，下次刷新: ${formatDateToLocalISO(nextRefreshTime)}`);
                }
            }
        }
    }

    return foodsToBuy;
}

// ==================== 新增函数：过滤已启用的食材 ====================
function filterEnabledFoods(foodList) {
    if (!foodList || !Array.isArray(foodList)) {
        return [];
    }

    return foodList.filter(food => {
        // 检查食材是否在 settings 中被启用
        const foodId = translationList[food] || food;
        return settings[foodId] === true;
    });
}

const translationList = {};
const enableFoods = new Set([]);

const othrtRo = {
    "buy": {
        "name": "购买按钮",
        "file": "assets/images/buyBtn.png"
    }
}

// 获取游戏内时间（考虑4点刷新）
function getGameTime() {
    const now = new Date();
    const utcNowMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const gmt8Ms = utcNowMs + 8 * 60 * 60 * 1000;
    const gmt8Date = new Date(gmt8Ms);

    // 如果还没到凌晨4点，算作前一天
    if (gmt8Date.getHours() < 4) {
        gmt8Date.setDate(gmt8Date.getDate() - 1);
    }

    return gmt8Date;
}

// ==================== 新增函数：格式化为本地ISO时间 ====================
function formatDateToLocalISO(date) {
    // 将日期格式化为 "YYYY-MM-DDTHH:mm:ss+08:00" 格式
    const pad = (n) => n.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
}

// 设置游戏时间
async function setTime(hour, minute) {
    // 关于setTime
    // 原作者: Tim
    // 脚本名称: SetTimeMinute - 精确调整游戏时间到分钟
    // 脚本版本: 1.0
    // Hash: f5c2547dfc286fc643c733d630f775e8fbf12971

    // 设置游戏分辨率和DPI缩放
    setGameMetrics(1920, 1080, 1);
    // 圆心坐标
    const centerX = 1441;
    const centerY = 501.6;
    // 半径
    const r1 = 30;
    const r2 = 150;
    const r3 = 300;
    const stepDuration = 50;

    function getPosition(r, index) {
        let angle = index * Math.PI / 720;
        return [Math.round(centerX + r * Math.cos(angle)), Math.round(centerY + r * Math.sin(angle))];
    }
    async function mouseClick(x, y) {
        moveMouseTo(x, y);
        await sleep(50);
        leftButtonDown();
        await sleep(50);
        leftButtonUp();
        await sleep(stepDuration);
    }
    async function mouseClickAndMove(x1, y1, x2, y2) {
        moveMouseTo(x1, y1);
        await sleep(50);
        leftButtonDown();
        await sleep(50);
        moveMouseTo(x2, y2);
        await sleep(50);
        leftButtonUp();
        await sleep(stepDuration);
    }
    async function setTime(hour, minute) {
        const end = (hour + 6) * 60 + minute - 20;
        const n = 3;
        for (let i = - n + 1; i < 1; i++) {
            let [x, y] = getPosition(r1, end + i * 1440 / n);
            await mouseClick(x, y);
        }
        let [x1, y1] = getPosition(r2, end + 5);
        let [x2, y2] = getPosition(r3, end + 20 + 0.5);
        await mouseClickAndMove(x1, y1, x2, y2);
    }

    let h = Math.floor(hour + minute / 60);
    const m = Math.floor(hour * 60 + minute) - h * 60;
    h = ((h % 24) + 24) % 24;
    log.info(`设置时间到 ${h} 点 ${m} 分`);
    await keyPress("Escape");
    await sleep(1000);
    await click(50, 700);
    await sleep(2000);
    await setTime(h, m);
    await sleep(1000);
    await click(1500, 1000);//确认
    await sleep(18000);
    await keyPress("Escape");
    await sleep(2000);
    await keyPress("Escape");
    await sleep(2000);
}

// 地图追踪
async function autoPath(locationPath) {
    try {
        let filePath = locationPath;
        await pathingScript.runFile(filePath);
        await sleep(200);

        return true;
    } catch (error) {
        log.error(`执行路径时发生错误: ${error.message}`);
        return false;
    }
}

// 平滑过渡函数（缓动效果）
function smoothStep(t) {
    return t * t * (3 - 2 * t);
}

// 模拟鼠标移动到指定位置（带曲线路径）
async function naturalMove(initX, initY, targetX, targetY, duration, wiggle = 30) {

    // 生成控制点（使路径形成曲线）
    const controlX = (initX + targetX) / 2 + (Math.random() * wiggle * 2 - wiggle);
    const controlY = (initY + targetY) / 2 + (Math.random() * wiggle * 2 - wiggle);

    const steps = Math.max(duration / 20, 10); // 计算步数

    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const t = smoothStep(progress); // 使用平滑过渡

        // 二次贝塞尔曲线计算
        const x = (1 - t) * (1 - t) * initX + 2 * (1 - t) * t * controlX + t * t * targetX;
        const y = (1 - t) * (1 - t) * initY + 2 * (1 - t) * t * controlY + t * t * targetY;

        moveMouseTo(Math.trunc(x), Math.trunc(y));

        // 随机延迟使移动更自然
        await sleep(Math.trunc(duration / steps * (0.8 + Math.random() * 0.4)));
    }

    await sleep(200);
    // 确保最终位置准确
    moveMouseTo(targetX, targetY);
}

// 切换下一页商品
async function nextFoodsPage() {
    //设置脚本环境的游戏分辨率和DPI缩放
    setGameMetrics(3840, 2160, 1.5);

    let [initX, initY] = [1500, 1850];
    let [targetX, targetY] = [1800, 260];

    moveMouseTo(initX, initY);
    leftButtonDown();
    await naturalMove(initX, initY, targetX, targetY, 300);

    // 按住了, 防止弹太远
    await sleep(520);
    leftButtonUp();
}

// 快速购买
async function qucikBuy() {
    //设置脚本环境的游戏分辨率和DPI缩放
    setGameMetrics(3840, 2160, 1.5);

    let [buyBtnX, buyBtnY] = [3200, 2045];
    let [confirmBtnX, confirmBtnY] = [2025, 1570];
    let [addNumX, addNumY] = [2060, 1208];

    // 等待界面切换
    await sleep(200);

    try {
        // 查找购买按钮
        let captureRegion = captureGameRegion();
        let buyBtn = captureRegion.Find(othrtRo.buy.ro);
        captureRegion.dispose();

        if (buyBtn.isEmpty()) {
            log.warn("未找到购买按钮");
            return false;
        }

        // 点击购买按钮
        click(buyBtn.x * 2 + buyBtn.width, buyBtn.y * 2 + buyBtn.height);
        // 等待购买窗口弹出
        await sleep(300);

        // 增加数量至最大
        leftButtonDown();
        await naturalMove(addNumX, addNumY, addNumX + 666, addNumY - 233, 100);
        leftButtonUp();

        // 确保最终数量至最大
        await sleep(200);
        click(2372, 1205);
        await sleep(200);

        // 点击确认按钮
        click(confirmBtnX, confirmBtnY);
        // 等待购买完成
        await sleep(200);
        // 点击空白关闭
        click(buyBtnX, buyBtnY);
        await sleep(200);

        return true;
    } catch (error) {
        log.error(`快速购买失败: ${error.message}`);
        return false;
    }
}

// 跳过对话
async function spikChat(npcName) {
    let count = 5; // 添加let声明
    await sleep(1000);
    if (npcName == "布纳马") {
        // 设置脚本环境的游戏分辨率和DPI缩放
        setGameMetrics(1920, 1080, 1);

        await sleep(1000);
        // 交互
        for (let i = 0; i < 3; i++) {
            keyPress("VK_F");
            await sleep(1500);
        }

        // 点击有什么卖的
        let captureRegion = captureGameRegion()
        let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
        for (let i = 0; i < resList.count; i++) {
            if (resList[i].text.includes("有什么卖的")) {
                await sleep(500);
                click(resList[i].x + 30, resList[i].y + 30); // 点击有什么卖的
                await sleep(500);

                // 使用完后释放资源
                captureRegion.dispose();
            }
        }

        await sleep(1500);
        keyPress("VK_F");
        await sleep(1500);
        keyPress("VK_F");
        await sleep(1500);
    } else {
        for (let i = 0; i < count; i++) {
            keyPress("VK_F");
            await sleep(1300);
        }
    }
}

// 修改后的购买逻辑
async function buyFoods(npcName, npcRecords, currentPeriod) {
    // 设置脚本环境的游戏分辨率和DPI缩放
    setGameMetrics(3840, 2160, 1.5);

    // 获取NPC数据
    const npc = npcData[npcName];
    const npcRecord = getNpcRecord(npcRecords, npc.name);

    if (recordDebug) {
        log.info(`[调试] 开始处理NPC: ${npc.name}`);
        if (npcRecord) {
            log.info(`[调试] NPC当前记录: 1d=${npcRecord["1d_time"] || "无"}, 3d=${npcRecord["3d_time"] || "无"}, 7d=${npcRecord["7d_time"] || "无"}`);
        }
    }

    // 判断需要购买的商品
    const foodsToBuy = shouldBuyFoods(npc, npcRecord, currentPeriod, ignoreRecords);

    if (recordDebug) {
        log.info(`[调试] ${npc.name} 购买判断结果:`);
        log.info(`[调试]   1天商品: ${foodsToBuy["1d"].join(", ")}`);
        log.info(`[调试]   3天商品: ${foodsToBuy["3d"].join(", ")}`);
        log.info(`[调试]   7天商品: ${foodsToBuy["7d"].join(", ")}`);
    }

    // 合并所有要购买的食物
    const allFoodsToBuy = [];
    if (foodsToBuy["1d"]) allFoodsToBuy.push(...foodsToBuy["1d"]);
    if (foodsToBuy["3d"]) allFoodsToBuy.push(...foodsToBuy["3d"]);
    if (foodsToBuy["7d"]) allFoodsToBuy.push(...foodsToBuy["7d"]);

    if (allFoodsToBuy.length === 0) {
        logConditional(`${npc.name} 没有需要购买的商品`);
        return {
            purchased: [],
            "1d": [],
            "3d": [],
            "7d": []
        };
    }

    logConditional(`${npc.name} 购买列表: ${allFoodsToBuy.join(", ")}`);

    let tempFoods = [...allFoodsToBuy];
    const purchasedFoods = [];
    const purchasedByType = {
        "1d": [],
        "3d": [],
        "7d": []
    };

    // 构建商品到刷新类型的映射
    const foodToRefreshType = {};
    for (const type of ["1d", "3d", "7d"]) {
        if (foodsToBuy[type]) {
            for (const food of foodsToBuy[type]) {
                foodToRefreshType[food] = type;
            }
        }
    }

    // 多页购买
    for (let i = 0; i < npc.page; i++) {
        await sleep(520);
        // 获取一张截图
        let captureRegion = captureGameRegion();

        // 记录已经购买的物品
        let boughtFoods = new Set([]);

        // 匹配商品
        for (let item of tempFoods) {
            if (recordDebug) {
                log.info(`[调试] 尝试购买: ${item}`);
            }
            
            // 将中文食材名转换为对应的英文ID
            let foodId = null;
            
            // 首先在translationList中查找（中文名->英文ID）
            if (translationList[item]) {
                foodId = translationList[item];
            } else {
                // 如果没有找到，直接在foodsData中查找是否有中文键
                foodId = Object.keys(foodsData).find(key => 
                    foodsData[key].name === item || foodsData[key].id === item
                );
            }
            
            if (!foodId) {
                log.warn(`未找到食材 "${item}" 的识别数据，跳过`);
                continue;
            }
            
            if (!foodsData[foodId] || !foodsData[foodId].ro) {
                log.warn(`食材 "${item}" (ID: ${foodId}) 未启用或没有识别对象，跳过`);
                continue;
            }

            let resList = captureRegion.FindMulti(foodsData[foodId].ro);

            for (let res of resList) {
                if (recordDebug) {
                    log.info(`[调试] 找到物品: ${foodsData[foodId].name} 位置(${res.x},${res.y},${res.width},${res.height})`);
                }
                // 移除已购买的物品
                boughtFoods.add(item);
                // 点击商品
                click(res.x * 2 + res.width, res.y * 2 + res.height);
                if (await qucikBuy()) {
                    log.info(`购买成功: ${foodsData[foodId].name}`);
                    // 交互或拾取："XXXX"
                    await fakeLog(foodsData[foodId].name, false, false, 23333);

                    // 记录购买的商品
                    purchasedFoods.push(item);
                    const refreshType = foodToRefreshType[item];
                    if (refreshType) {
                        purchasedByType[refreshType].push(item);

                        // 立即更新记录
                        npcRecords = updateNpcRecord(npcRecords, npc.name, refreshType, purchasedByType[refreshType]);
                        await saveNpcRecords(npcRecords);
                    }

                    await sleep(2000);
                    // 重新截图
                    captureRegion = captureGameRegion();
                }
                else {
                    log.info(`购买失败: ${foodsData[foodId].name}, 背包已经满或商品已售罄`);
                }
            }
        }

        captureRegion.dispose();
        // 从已购买物品中移除
        tempFoods = tempFoods.filter(item => !boughtFoods.has(item));

        // 若不是最后一页且还有未购买的物品
        if (tempFoods.length > 0 && i !== npc.page - 1) {
            logConditional("切换到下一页商品");
            await nextFoodsPage();

            // 最后一次切换界面, 等待UI回弹
            if (i === npc.page - 2) {
                logConditional("等待界面回弹");
                await sleep(520);
            }
        }
    }
    
    if (purchasedFoods.length > 0) {
        log.info(`${npc.name} 购买完成，成功购买: ${purchasedFoods.join(", ")}`);
    } else {
        logConditional(`${npc.name} 没有成功购买任何商品`);
    }

    // 返回购买结果
    return {
        purchased: purchasedFoods,
        "1d": purchasedByType["1d"],
        "3d": purchasedByType["3d"],
        "7d": purchasedByType["7d"]
    };
}

// 修改后的初始化NPC商品
async function initNpcData(records) {
    for (let [key, npc] of Object.entries(npcData)) {
        // 检查是否在禁用列表中
        if (disabledNpcs.includes(npc.name)) {
            npc.enable = false;
            logConditional(`已禁用NPC: ${npc.name}`);
            continue;
        }

        const npcRecord = getNpcRecord(records, npc.name);

        // 判断是否需要强制刷新
        const forceRefresh = ignoreRecords;

        // 判断需要购买的商品（这里只是检查是否有商品需要购买）
        const gameTime = getGameTime();
        const currentPeriod = getBasePeriod(gameTime);
        const foodsToBuy = shouldBuyFoods(npc, npcRecord, currentPeriod, forceRefresh);

        // 检查是否有需要购买的商品
        const hasFoodsToBuy = foodsToBuy["1d"].length > 0 ||
            foodsToBuy["3d"].length > 0 ||
            foodsToBuy["7d"].length > 0;

        npc.enable = npc.enable && hasFoodsToBuy;

        if (recordDebug && !npc.enable && hasFoodsToBuy) {
            log.info(`${npc.name} 有商品需要购买但NPC被禁用`);
        }
    }
}

// 加载识别对象
async function initRo() {
    try {
        // 加载识别对象
        for (let [key, item] of Object.entries(foodsData)) {
            // 填充中英文对照表
            translationList[item.name] = item.id;
            // 判断启动商品、加载识别对象
            if (settings[item.id]) {
                enableFoods.add(item.id);
                item.ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(item.file));
                item.ro.Threshold = 0.75;
                item.ro.Use3Channels = true;
                logConditional(`已启用食材: ${item.name} (${item.id})`);
            }
        }
        // 加载其他识别对象
        for (let [key, item] of Object.entries(othrtRo)) {
            item.ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(item.file));
            item.ro.Threshold = 0.85;
        }

        logConditional(`总共启用了 ${enableFoods.size} 种食材`);
        return true;
    }
    catch (error) {
        log.error("加载识别对象时发生错误: {error}", error.message);
        throw error;
    }
}

(async function () {
    try {
        // ==================== 初始化账号 ====================
        log.info(`当前账户: ${userName}`);

         // ==================== 加载外部数据 ====================
        if (!await loadExternalData()) {
            log.error("食材或NPC数据加载失败，脚本终止");
            return;
        }

        // ==================== 初始化识别对象 ====================
        await initRo();
        
        logConditional("识别对象初始化完成");

        // ==================== 加载NPC购买记录 ====================
        let npcRecords = await loadNpcRecords();
        
        logConditional(`已加载 ${npcRecords.length} 个NPC的购买记录`);
        
        if (recordDebug && npcRecords.length > 0) {
            log.info("[调试] 当前NPC记录:");
            npcRecords.forEach(record => {
                log.info(`[调试]   ${record.npcname}:`);
                if (record["1d_time"]) log.info(`[调试]     1天刷新: ${record["1d_time"]}`);
                if (record["3d_time"]) log.info(`[调试]     3天刷新: ${record["3d_time"]}`);
                if (record["7d_time"]) log.info(`[调试]     7天刷新: ${record["7d_time"]}`);
            });
        }

        // ==================== 初始化NPC数据 ====================
        await initNpcData(npcRecords);

        logConditional("NPC数据初始化完成");

        // 统计启用的NPC数量
        const enabledNpcs = Object.values(npcData).filter(npc => npc.enable);
        log.info(`本次执行将处理 ${enabledNpcs.length} 个NPC`);

        // ==================== 自动购买 ====================
        // 获取当前时间和周期
        const gameTime = getGameTime();
        const currentPeriod = getBasePeriod(gameTime);

        if (recordDebug) {
            log.info(`[调试] 当前游戏时间: ${formatDateToLocalISO(gameTime)}`);
            log.info(`[调试] 当前周期信息: 3天周期=${currentPeriod.threeDayPeriod}, 7天周期=${currentPeriod.sevenDayPeriod}`);
        }

        let npcIndex = 0;
        for (let [key, npc] of Object.entries(npcData)) {
            if (npc.enable) {
                npcIndex++;
                log.info(`当前进度：${npcIndex}/${enabledNpcs.length}`);
                log.info(`开始前往NPC ${npc.name} 购买`);

                await genshin.returnMainUi();

                // 地图追踪开始
                await fakeLog(npc.name, false, true, 0);

                // 设置游戏时间
                if (npc.time === "night") {
                    await setTime(20, 0); // 设置为晚上8点
                }
                else if (npc.time === "day") {
                    await setTime(8, 0); // 设置为早上8点
                }

                await autoPath(npc.path);
                await spikChat(npc.name);

                // 购买商品，传入当前记录和周期
                const purchaseResult = await buyFoods(key, npcRecords, currentPeriod);

                // 返回主界面
                await genshin.returnMainUi();
                log.info(`完成购买NPC: ${npc.name}`);

                // 伪造日志任务结束
                await fakeLog(npc.name, false, false, 0);

                // NPC之间等待
                if (npcIndex < enabledNpcs.length) {
                    logConditional("等待2秒后处理下一个NPC");
                    await sleep(2000);
                }
            }
            else {
                if (recordDebug) {
                    log.info(`[调试] 跳过未启用的NPC: ${npc.name}`);
                }
            }
        }

        log.info("=== 食材购买脚本执行完成 ===");

    } catch (error) {
        log.error(`执行时发生错误: ${error.message}`);
    }
})();