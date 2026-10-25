/* ========================================================================================================= */
/* ============================================== 全局常量与变量定义区 ======================================= */
/* ========================================================================================================= */
/* ==================== 游戏对话区域坐标范围 ==================== */
const dialogZone = { x: { min: 900, max: 1700 }, y: { min: 450, max: 880 } };

/* ==================== 脚本数据存储对象 ====================== */
let record = {};
// 最大运行次数
let retryCount = 0;
const maxRetry = 3;

/* ==================== 每日任务冷却状态标记 ==================== */
let recordsTime = {
    "waterTime": false,         // 取水任务冷却状态
    "sticksTime": false,        // 上香任务冷却状态
    "lotsTime": false,          // 抽签任务冷却状态
    "conchsTime": false,        // 拾螺任务冷却状态
    "mealTime": false,          // 探监任务冷却状态
    "eggsTime": false,          // 拾龙蛋任务冷却状态
    "turntableTime": false,     // 转盘任务冷却状态
    "todayLuckTime": false,     // 每日运势领取冷却状态
    "sweetStatueTime": false,   // 糖雕奖励领取冷却状态
    "iceCreamTime": false       // 甜筒奖励领取冷却状态
};

/* ==================== 纳塔六枚龙蛋采集点位坐标 ==================== */
const eggCoordinates = [
    [565, 150],                 // 山之血
    [568, 723],                 // 飞澜鲨鲨
    [1088, 161],                // 圣龙君临
    [874, 335],                 // 太阳的轰鸣
    [468, 574],                 // 献给小酒杯
    [1339, 358]                 // 菲耶蒂娜
];



/* ========================================================================================================= */
/* ============================================== 通用封装函数功能区 ========================================= */
/* ========================================================================================================= */

/*  ==================== 队伍自动切换 ==================== */
/**
 * 根据配置自动切换队伍
 * 未配置队伍名 → 直接返回主界面
 * 配置队伍名 → 尝试切换，失败则传送七天神像重试
 * 异常捕获 → 联机/特殊状态无法切换时提示并返回主界面
 */
async function switchPartyIfNeeded(partyName) {
    // 未配置目标队伍，直接返回主界面
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }

    try {
        log.info(`"正在尝试切换至" + "${partyName}"`);

        // 尝试切换队伍，失败则传送七天神像重试
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(partyName);
        }
    } catch {
        // 异常处理：联机状态 / 特殊场景无法切换队伍
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}

/* ============ fakeLog 脚本日志伪装 =============== */
/**
 * 工具函数：fakeLog 脚本日志伪装
 * @调用规范 所有调用必须添加 await 关键字，防止V8引擎异步阻塞、界面白屏报错
 * @入参说明
 * @param {string}  name     任务名称（字符串），脚本内部展示用
 * @param {boolean} isJs     类型标记：true=JS自定义脚本，false=原生地图追踪任务
 * @param {boolean} isStart  阶段标记：true=任务开始日志，false=任务结束日志
 * @param {number}  duration 执行耗时(毫秒)，仅结束日志使用，开始日志固定传 0
 * @调用示例
 *  JS脚本启动日志：await fakeLog("任务名", true, true, 0);
 *  JS脚本结束日志：await fakeLog("任务名", true, false, 执行耗时);
 *  地图任务启动日志：await fakeLog("地图追踪.json", false, true, 0);
 *  地图任务结束日志：await fakeLog("地图追踪.json", false, false, 0);
 * @函数作用 完全模拟 BetterGenshinImpact 原生日志格式输出，实现日志伪装、后台运行无痕化，
 *          统一日志时间格式、耗时换算，用于日志记录展示与运行溯源。
 */
async function fakeLog(name, isJs, isStart, duration) {
    // 固定10ms延迟，避免日志输出过快造成乱序、引擎异常报错
    await sleep(10);

    // 获取当前设备毫秒级时间戳
    const currentTime = Date.now();

    // ========== 入参合法性校验 ==========
    if (typeof name !== 'string') {
        log.error("参数 'name' 必须为字符串类型！");
        return;
    }
    if (typeof isJs !== 'boolean') {
        log.error("参数 'isJs' 必须为布尔类型！");
        return;
    }
    if (typeof isStart !== 'boolean') {
        log.error("参数 'isStart' 必须为布尔类型！");
        return;
    }
    if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
        log.error("时间戳 'currentTime' 必须为整数！");
        return;
    }
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
        log.error("耗时参数 'duration' 必须为整数！");
        return;
    }

    // ========== 时间戳格式化：时:分:秒.毫秒 ==========
    const date = new Date(currentTime);
    const hours = String(date.getHours()).padStart(2, '0');                   // 小时（不足两位自动补0）
    const minutes = String(date.getMinutes()).padStart(2, '0');              // 分钟（不足两位自动补0）
    const seconds = String(date.getSeconds()).padStart(2, '0');             // 秒数（不足两位自动补0）
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');   // 毫秒（不足三位自动补0）
    const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

    // ========== 耗时单位换算：毫秒自动转为 分:秒格式 ==========
    const durationInSeconds = duration / 1000;                              // 毫秒转秒
    const durationMinutes = Math.floor(durationInSeconds / 60);             // 提取整数分钟
    const durationSeconds = (durationInSeconds % 60).toFixed(3);            // 剩余秒数，保留三位小数

    // ========== 四类日志场景统一输出 ==========
    // 场景1：JS自定义脚本 - 运行开始
    if (isJs && isStart) {
        const logMessage = `正在伪造js开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行JS脚本: "${name}"`;
        log.debug(logMessage);
    }

    // 场景2：JS自定义脚本 - 运行结束
    if (isJs && !isStart) {
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }

    // 场景3：原生地图任务 - 运行开始
    if (!isJs && isStart) {
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    }

    // 场景4：原生地图任务 - 运行结束
    if (!isJs && !isStart) {
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
}

/* ==================== 存档读取与脚本初始化函数 ==================== */
/**
 * 本地存档文件加载初始化
 * 流程：账号合法性校验 → 读取本地存档数据 → 解析历史时间记录 → 更新每日任务冷却状态
 */
async function readAndInitRecord() {
    // Windows系统文件名禁止包含的特殊字符正则
    const illegalCharacters = /[\\/:*?"<>|]/;
    // Windows系统系统保留关键字，不可作为文件名使用
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    // 获取用户配置账号名，无配置则使用默认账号
    let accountName = settings.accountName || "默认账户";

    // ==================== 游戏账号名称合法性校验 ====================
    // 校验规则：空名称、首尾空格、非法符号、系统保留名、超长名称均判定无效
    if (accountName === "" ||
        accountName.startsWith(" ") ||
        accountName.endsWith(" ") ||
        illegalCharacters.test(accountName) ||
        reservedNames.includes(accountName.toUpperCase()) ||
        accountName.length > 255
    ) {
        log.error(`账号名 "${accountName}" 格式非法，自动切换为默认账号`);
        accountName = "默认账户"; // 不合法则使用默认账户名
        await sleep(5000);       // 延时停留，方便用户查看报错日志
    } else {
        log.info(`账号名校验通过: "${accountName}"`);
    }

    // ==================== 本地存档路径定义 ====================
    const recordFolderPath = "records/";
    let recordFilePath = `records/${accountName}.txt`;

    // 遍历目录，判断当前账号存档文件是否存在
    const filesInSubFolder = file.ReadPathSync(recordFolderPath);
    let fileExists = false;
    for (const filePath of filesInSubFolder) {
        if (filePath === `records\\${accountName}.txt`) {
            fileExists = true; // 文件存在
            break;
        }
    }

    // ==================== 存档数据默认初始化 ====================
    record = {
        lastRunDate: new Date("1970-01-01 20:00:00"),           // 脚本上次运行日期
        lastWaterTime: new Date("1970-01-01 20:00:00"),         // 上次取水完成时间
        lastSticksTime: new Date("1970-01-01 20:00:00"),        // 上次上香完成时间
        lastLotsTime: new Date("1970-01-01 20:00:00"),          // 上次抽签完成时间
        lastConchsTime: new Date("1970-01-01 20:00:00"),        // 上次拾螺完成时间
        lastMealTime: new Date("1970-01-01 20:00:00"),          // 上次探监完成时间
        lastEggsTime: new Date("1970-01-01 20:00:00"),          // 上次龙蛋完成时间
        lastTurntableTime: new Date("1970-01-01 20:00:00"),     // 上次转盘完成时间
        lastTodayLuckTime: new Date("1970-01-01 20:00:00"),     // 上次运势领取时间
        lastSweetStatueTime: new Date("1970-01-01 20:00:00"),   // 上次糖雕领取时间
        lastIceCreamTime: new Date("1970-01-01 20:00:00"),      // 上次甜筒领取时间
        lastDragonEggsNum: "【山之血：0，飞澜鲨鲨：0，圣龙君临：0，太阳的轰鸣：0，献给小酒杯：0，菲耶蒂娜：0】",
        records: new Array(51).fill(""), // 历史事件记录缓存数组
    };

    let recordIndex = 0; // 历史记录写入下标

    // 存档文件不存在，直接使用默认初始数据
    if (!fileExists) {
        log.warn(`未检测到对应账号存档，加载默认初始数据`);
    }
    log.info(`账号存档文件已加载: ${recordFilePath}`);

    // 读取存档文本内容并按换行分割
    let content = await file.readText(recordFilePath);
    let lines = content.split("\n");

    // ==================== 逐行解析存档内时间数据 ====================
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue; // 自动过滤空行

        // 批量解析所有任务上次执行时间
        parseTime(line, "上次运行日期:", "lastRunDate");
        parseTime(line, "上次取水时间:", "lastWaterTime");
        parseTime(line, "上次上香时间:", "lastSticksTime");
        parseTime(line, "上次抽签时间:", "lastLotsTime");
        parseTime(line, "上次拾螺时间:", "lastConchsTime");
        parseTime(line, "上次探监时间:", "lastMealTime");
        parseTime(line, "上次拾蛋时间:", "lastEggsTime");
        parseTime(line, "上次转盘时间:", "lastTurntableTime");
        parseTime(line, "上次领菜时间:", "lastTodayLuckTime");
        parseTime(line, "上次领糖时间:", "lastSweetStatueTime");
        parseTime(line, "上次甜筒时间:", "lastIceCreamTime");

        // 解析存档内龙蛋背包数量信息
        if (line.startsWith("背包龙蛋数目:")) {
            record.lastDragonEggsNum = line.slice("背包龙蛋数目:".length).trim();
        }

        // 解析存档内所有历史运行事件记录
        if (line.startsWith(">>>>>>>>>> ") && recordIndex < record.records.length) {
            record.records[recordIndex++] = line;
        } else if (line.startsWith("抽签的结果: ") && recordIndex < record.records.length) {
            record.records[recordIndex++] = line;
        } else if (line.startsWith("获得的食物: ") && recordIndex < record.records.length) {
            record.records[recordIndex++] = line;
        } else if (line.startsWith("幸运签内容: ") && recordIndex < record.records.length) {
            record.records[recordIndex++] = line;
        } else if (line.startsWith("获得的龙蛋: ") && recordIndex < record.records.length) {
            record.records[recordIndex++] = line;
        } else if (line.startsWith("转盘的运势: ") && recordIndex < record.records.length)  {
            record.records[recordIndex++] = line;
        }
    }

    log.info(`脚本上次运行日期: ${formatDateTime(record.lastRunDate)}`);

    // ==================== 批量判定每日任务冷却是否刷新 ====================
    checkRefreshTime('water', 'lastWaterTime', '取水');
    checkRefreshTime('sticks', 'lastSticksTime', '上香');
    checkRefreshTime('lots', 'lastLotsTime', '抽签');
    checkRefreshTime('conchs', 'lastConchsTime', '拾螺');
    checkRefreshTime('meal', 'lastMealTime', '探监');
    checkRefreshTime('eggs', 'lastEggsTime', '拾蛋');
    checkRefreshTime('turntable', 'lastTurntableTime', '转盘');
    checkRefreshTime('todayLuck', 'lastTodayLuckTime', '收获');
    checkRefreshTime('sweetStatue', 'lastSweetStatueTime', '糖雕');
    checkRefreshTime('iceCream', 'lastIceCreamTime', '甜筒');
}

/* ==================== 通用文本时间解析函数 ==================== */
/**
 * 从存档行文本中提取时间并覆盖更新全局记录
 * @param {string} line      存档单行文本
 * @param {string} prefix    文本匹配前缀标识
 * @param {string} recordKey record对象内对应的时间字段名
 */
function parseTime(line, prefix, recordKey) {
    if (!line.startsWith(prefix)) return; // 不匹配直接退出，不做任何赋值
    const timeStr = line.slice(prefix.length).trim();
    if (!timeStr) return;

    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
        record[recordKey] = date;
    }
}

/**
 * Date对象 → "yyyy‑MM‑dd HH:mm:ss" 格式字符串
 * @param {Date} dateObj
 * @returns {string}
 */
function formatDateTime(dateObj) {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) {
        return "1970-01-01 20:00:00";
    }
    const year = String(d.getFullYear()).padStart(4, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hh}:${mm}:${ss}`;
}

/* ==================== 每日刷新冷却检测函数 ==================== */
/**
 * 原神每日4点服务器刷新判定
 * 对比上次执行时间与今日刷新节点，更新任务可执行状态
 * @param {string} settingsKey  配置面板任务开关键名
 * @param {string} recordKey   存档内上次执行时间键名
 * @param {string} taskName    任务中文名称（日志输出用）
 */
function checkRefreshTime(settingsKey, recordKey, taskName) {
  // 配置未开启的任务直接跳过冷却检测
  const arr = toJsArray(settings[settingsKey]);
  if (arr.length === 0) return;

  const now = Date.now();
  const lastTime = new Date(record[recordKey]).getTime();

  // 构建当日服务器刷新时间：凌晨4:00:00
  const today4am = new Date();
  today4am.setHours(4, 0, 0, 0);
  const today4amTime = today4am.getTime();
  const ONE_DAY = 24 * 60 * 60 * 1000; // 一天毫秒常量

  // 判断当前时间所属刷新周期
  const baseTime = now < today4amTime ? today4amTime - ONE_DAY : today4amTime;

  // 计算任务下一次可执行时间
  const aimTime = lastTime < baseTime ? baseTime : baseTime + ONE_DAY;

  // 更新全局任务冷却状态标记
  const isTimeUp = aimTime - now <= 0;
  recordsTime[`${settingsKey}Time`] = isTimeUp;

  // 控制台日志反馈
  isTimeUp
    ? log.info(`${taskName}冷却已刷新，可执行任务！`)
    : log.info(`${taskName}冷却未结束，暂不可执行！`);
}

/* ==================== 本地存档数据写入保存函数 ==================== */
/**
 * 全局数据持久化保存
 * 账号校验 → 拼接所有存档字段文本 → 写入本地txt存档文件
 */
async function writeRecord() {
    // Windows文件名非法字符校验正则
    const illegalCharacters = /[\\/:*?"<>|]/;
    // Windows系统保留文件名关键字
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    // 账号名合法性二次校验
    let accountName = settings.accountName || "默认账户";
    if (accountName === "" ||
        accountName.startsWith(" ") ||
        accountName.endsWith(" ") ||
        illegalCharacters.test(accountName) ||
        reservedNames.includes(accountName.toUpperCase()) ||
        accountName.length > 255
    ) {
        accountName = "默认账户"; // 不合法则使用默认名
    }

    // 存档文件保存路径
    let recordFilePath = `records/${accountName}.txt`;

    // ==================== 拼接完整存档文本内容 ====================
    let lines = [
        `上次运行日期: ${formatDateTime(record.lastRunDate)}`,
        `上次取水时间: ${formatDateTime(record.lastWaterTime)}`,
        `上次上香时间: ${formatDateTime(record.lastSticksTime)}`,
        `上次抽签时间: ${formatDateTime(record.lastLotsTime)}`,
        `上次拾螺时间: ${formatDateTime(record.lastConchsTime)}`,
        `上次探监时间: ${formatDateTime(record.lastMealTime)}`,
        `上次拾蛋时间: ${formatDateTime(record.lastEggsTime)}`,
        `上次转盘时间: ${formatDateTime(record.lastTurntableTime)}`,
        `上次领菜时间: ${formatDateTime(record.lastTodayLuckTime)}`,
        `上次领糖时间: ${formatDateTime(record.lastSweetStatueTime)}`,
        `上次甜筒时间: ${formatDateTime(record.lastIceCreamTime)}`,
        `背包龙蛋数目: ${record.lastDragonEggsNum}`,
        ...record.records.filter(Boolean) // 过滤空记录，仅保存有效历史数据
    ];

    // ==================== 写入本地存档文件 ====================
    try {
        await file.writeText(recordFilePath, lines.join('\n'), false);
        log.info(`账号存档已成功保存至: ${recordFilePath}`);
    } catch (e) {
        log.error(`存档写入失败:`, e);
    }
}

/* ==================== 页面滑动（鼠标拖拽模拟） ==================== */
/**
 * 页面滑动函数（模拟鼠标拖拽滑动）
 * 功能：按住鼠标左键垂直向上滑动页面，用于游戏内列表、背包、界面滚动
 * @param {number} totalDistance  总滑动距离（像素）
 * @param {number} stepDistance   单步滑动距离，默认10像素
 * @param {number} delayMs        每步滑动间隔延迟，默认5毫秒
 */
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    // 移动鼠标到滑动起始坐标(999, 750)
    moveMouseTo(999, 750);
    await sleep(50);
    // 按下鼠标左键，准备拖拽
    leftButtonDown();

    // 计算需要滑动的总步数
    const steps = Math.ceil(totalDistance / stepDistance);
    // 分步循环滑动
    for (let j = 0; j < steps; j++) {
        // 计算当前剩余需要滑动的距离
        const remainingDistance = totalDistance - j * stepDistance;
        // 确定本次滑动距离，防止滑过头
        const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        // 向上滑动指定距离
        moveMouseBy(0, -moveDistance);
        // 每步滑动后延迟，保证流畅性
        await sleep(delayMs);
    }

    // 滑动完成等待界面稳定
    await sleep(700);
    // 释放鼠标左键
    leftButtonUp();
    // 操作结束后短暂延迟
    await sleep(100);
}

/* ==================== 数字识别（模板匹配） ==================== */
/**
 * 在指定区域内，用 0-9 的 PNG 模板做「多阈值 + 非极大抑制」数字识别，
 * 最终把检测到的数字按左右顺序拼成一个整数返回。
 *
 * @param {string}  numberPngFilePath - 存放 0.png ~ 9.png 的文件夹路径（不含文件名）
 * @param {number}  x                 - 待识别区域的左上角 x 坐标，默认 0
 * @param {number}  y                 - 待识别区域的左上角 y 坐标，默认 0
 * @param {number}  w                 - 待识别区域的宽度，默认 1920
 * @param {number}  h                 - 待识别区域的高度，默认 1080
 * @param {number}  maxThreshold      - 模板匹配起始阈值，默认 0.95（最高可信度）
 * @param {number}  minThreshold      - 模板匹配最低阈值，默认 0.8（最低可信度）
 * @param {number}  splitCount        - 在 maxThreshold 与 minThreshold 之间做几次等间隔阈值递减，默认 3
 * @param {number}  maxOverlap        - 非极大抑制时允许的最大重叠像素，默认 2；只要 x 或 y 方向重叠大于该值即视为重复框
 *
 * @returns {number} 识别出的整数；若没有任何有效数字框则返回 -1
 *
 * @example
 * const mora = await numberTemplateMatch('摩拉数字', { min: 1482, max: 1630 }, { min: 912, max: 957 });
 * if (mora >= 0) console.log(`当前摩拉：${mora}`);
 */
async function numberTemplateMatch(
    numberPngFilePath,
    xRange = { min: 0, max: 1920 }, 
    yRange = { min: 0, max: 1080 },
    maxThreshold = 0.95,
    minThreshold = 0.8,
    splitCount = 3,
    maxOverlap = 2
) {
    // 初始化 0~9 数字模板匹配对象
    let ros = [];
    for (let i = 0; i <= 9; i++) {
        ros[i] = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(`${numberPngFilePath}/${i}.png`), xRange.min, yRange.min, xRange.max - xRange.min, yRange.max - yRange.min);
    }

    // 工具函数：批量设置模板匹配阈值并重新初始化
    function setThreshold(roArr, newThreshold) {
        for (let i = 0; i < roArr.length; i++) {
            roArr[i].Threshold = newThreshold;
            roArr[i].InitTemplate();
        }
    }

    // 截取游戏画面区域
    const gameRegion = captureGameRegion();
    const allCandidates = [];

    // 1. 按 splitCount 进行多轮递减阈值匹配
    for (let k = 0; k < splitCount; k++) {
        const curThr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
        setThreshold(ros, curThr);

        // 2. 遍历 0~9 所有数字模板，收集全部识别结果
        for (let digit = 0; digit <= 9; digit++) {
            const res = gameRegion.findMulti(ros[digit]);
            if (res.count === 0) continue;

            for (let i = 0; i < res.count; i++) {
                const box = res[i];
                allCandidates.push({
                    digit: digit,
                    x: box.x,
                    y: box.y,
                    w: box.width,
                    h: box.height,
                    thr: curThr
                });
            }
        }
    }

    // 释放截图资源
    gameRegion.dispose();

    // 3. 未识别到任何数字，直接返回 -1
    if (allCandidates.length === 0) {
        return -1;
    }

    // 4. 非极大抑制：去重（xy 两个方向重叠超标则视为重复）
    const adopted = [];
    for (const c of allCandidates) {
        let overlap = false;
        for (const a of adopted) {
            const xOverlap = Math.max(0, Math.min(c.x + c.w, a.x + a.w) - Math.max(c.x, a.x));
            const yOverlap = Math.max(0, Math.min(c.y + c.h, a.y + a.h) - Math.max(c.y, a.y));
            if (xOverlap > maxOverlap && yOverlap > maxOverlap) {
                overlap = true;
                break;
            }
        }
        if (!overlap) {
            adopted.push(c);
        }
    }

    // 5. 按 X 坐标从左到右排序，拼接成最终整数
    if (adopted.length === 0) return -1;
    adopted.sort((a, b) => a.x - b.x);

    return adopted.reduce((num, item) => num * 10 + item.digit, 0);
}

/* ==================== 检测物品过期弹窗并处理 ==================== */
/**
 * 检测游戏内「物品过期」提示弹窗
 * 识别到文字后自动点击确认位置关闭弹窗
 */
async function checkExpire() {
    // 延迟1秒，等待界面完全加载
    await sleep(1000);
    
    // OCR识别指定区域：检测是否出现「物品过期」文字
    let ocrExpire = await performOcr("",{ min: 870, max: 1040 }, { min: 280, max: 320 }, true);
    
    // 判断识别结果：如果是物品过期弹窗
    if (ocrExpire.text == "物品过期") {
        log.info(`处理中=========`);
        // 点击确认按钮位置关闭弹窗
        await click(980, 750);
        await sleep(50);
    }
}

/* ==================== OCR文字识别封装函数 ==================== */
/**
 * OCR 文字识别函数（仅识别位置，不执行点击）
 * @param {string} keyWords - 需要匹配的关键词（judge为false时生效）
 * @param {object} xRange - X轴识别范围 {min:最小X, max:最大X}
 * @param {object} yRange - Y轴识别范围 {min:最小Y, max:最大Y}
 * @param {boolean} judge - 识别模式：true=纯识别返回文本，false=匹配关键词并返回坐标
 * @param {number} timeout - 超时时间（毫秒），默认500ms
 * @returns {object} 识别结果 {success: 是否成功, text: 文本, coordinates: [x, y] 坐标}
 */
async function performOcr(keyWords, xRange, yRange, judge, timeout = 500) {
    // 记录循环开始时间，用于超时判断
    let startTime = new Date();
    // 异常重试计数器
    let retryCount = 0;

    // 超时循环：在指定时间内持续尝试识别
    while (Date.now() - startTime < timeout) {
        // 截取当前游戏画面区域
        let gameRegion = captureGameRegion();
        
        try {
            if (judge) {
                // ==================== 模式1：纯OCR识别，返回文本 ====================
                let ocrResult = gameRegion.find(RecognitionObject.ocr(
                    xRange.min, yRange.min,
                    xRange.max - xRange.min, yRange.max - yRange.min
                ));
                
                // 释放截图资源，防止内存泄漏
                gameRegion.dispose();

                // 识别成功，返回结果与坐标
                if (ocrResult) {
                    return {
                        success: true,
                        text: ocrResult.text,
                        coordinates: [Math.round(ocrResult.x + ocrResult.width / 2), Math.round(ocrResult.y + ocrResult.height / 2)]
                    };
                }
            } else {
                // ==================== 模式2：关键词匹配识别，返回坐标 ====================
                let resList = gameRegion.findMulti(RecognitionObject.ocr(
                    xRange.min, yRange.min,
                    xRange.max - xRange.min, yRange.max - yRange.min
                ));
                
                // 释放截图资源
                gameRegion.dispose();

                // 遍历识别结果，匹配关键词
                for (let res of resList) {
                    let correctedText = res.text;
                    
                    // 包含关键词则返回成功结果
                    if (correctedText.includes(keyWords)) {
                        let centerX = Math.round(res.x + res.width / 2);
                        let centerY = Math.round(res.y + res.height / 2);
                        
                        return {
                            success: true,
                            text: correctedText,
                            coordinates: [centerX, centerY]
                        };
                    }
                }
            }
        } catch (error) {
            // 捕获识别异常，计数并输出警告日志
            retryCount++;
            log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
        }

        // 每次识别间隔50ms，降低性能消耗
        await sleep(50);
    }

    // 超时未识别到目标，返回失败
    return { success: false };
}

/* ==================== 图片模板识别封装函数 ==================== */
/**
 * 图片模板识别函数（仅识别位置，不执行点击）
 * @param {string} imagePath - 要识别的图片模板路径
 * @param {object} xRange - X轴识别范围 {min: 最小X, max: 最大X}
 * @param {object} yRange - Y轴识别范围 {min: 最小Y, max: 最大Y}
 * @param {boolean} judge - 识别模式：true=返回中心坐标, false=仅判断是否存在
 * @param {number} threshold - 识别相似度阈值（0-1），默认0.8
 * @param {number} timeout - 识别超时时间（毫秒），默认500ms
 * @returns {object} 识别结果 {success: 是否成功, coordinates: [x, y] 坐标}
 */
async function findImgIcon(imagePath, xRange, yRange, judge, threshold = 0.8, timeout = 500) {
    // 记录识别开始时间，用于超时判断
    let startTime = new Date();
    // 识别异常重试计数器
    let retryCount = 0;

    // 读取本地图片文件作为识别模板
    let template = file.ReadImageMatSync(imagePath);
    // 初始化模板识别对象，配置识别区域范围
    let recognitionObject = RecognitionObject.TemplateMatch(template, xRange.min, yRange.min,
        xRange.max - xRange.min, yRange.max - yRange.min);
    // 设置模板匹配相似度阈值
    recognitionObject.Threshold = threshold;
    // 初始化识别模板数据
    recognitionObject.InitTemplate();

    // 超时循环：在指定时间内持续尝试识别目标
    while (Date.now() - startTime < timeout) {
        // 截取当前游戏画面区域
        let gameRegion = captureGameRegion();
        // 执行模板匹配识别
        let result = gameRegion.find(recognitionObject);
        // 释放资源，防止内存泄漏
        gameRegion.dispose();

        try {
            if (judge) {
                // ==================== 模式1：识别并返回目标中心坐标 ====================
                if (result.isExist()) {
                    // 计算识别目标的中心坐标
                    let centerX = Math.round(result.x + result.width / 2);
                    let centerY = Math.round(result.y + result.height / 2);
                    // 返回识别成功结果与坐标
                    return { success: true, coordinates: [centerX, centerY] };
                }
            } else {
                // ==================== 模式2：仅判断目标是否存在 ====================
                if (result.isExist()) {
                    // 存在则返回成功，坐标默认 [0,0]
                    return { success: true, coordinates: [0, 0] };
                }
            }
        } catch (error) {
            // 捕获识别异常，计数并输出警告日志
            retryCount++;
            log.warn(`模板匹配失败，正在进行第 ${retryCount} 次重试...`);
        }

        // 每次重试间隔50ms，降低性能消耗
        await sleep(50);
    }

    // 超时未识别到目标，返回失败
    return { success: false };
}

/* ==================== 检测并统计背包内龙蛋数量 ==================== */
/**
 * 自动打开背包，识别全部6种纳塔龙蛋库存
 * 【全覆盖所有真实背包场景】
 * 1. 背包无任何龙蛋 → 自动翻页检索，超时正常退出
 * 2. 仅存在 1~5 个零散龙蛋 → 自动选取其中最底部一枚作为判定基准
 * 3. 6个龙蛋全部存在、上下错位分布 → 选取最底部一枚为全局基准
 * 4. 图标露出但下方数字被背包底部遮挡 → 强制小幅上滑，数字完整露出后再识别
 * 
 * 【核心算法】
 * 遍历当前页所有龙蛋图标
 * 自动筛选出【画面最靠下、Y坐标最大】的龙蛋作为唯一判定基准
 * 基准龙蛋距离底部不足 = 数字被遮挡 → 滑动调整
 * 基准龙蛋距离充足 = 界面安全 → 批量识别所有龙蛋数字
 * @returns {string} 龙蛋库存汇总字符串
 */
async function checkDragonEggs() {
    // 返回游戏主界面，打开背包
    await genshin.returnMainUi();
    await pathingScript.runFile("assets/runJson/调为白天.json");
    await genshin.returnMainUi();
    await keyPress("B");
    await checkExpire();
    await sleep(1500);

    // 切换至背包材料分类页
    await click(1250, 50);
    await sleep(50);

    // 初始化6种龙蛋库存数组
    let DragonEggs = [0, 0, 0, 0, 0, 0];
    // 1920*1080 分辨率屏幕底部Y坐标
    const SCREEN_BOTTOM_Y = 1080;
    // 安全距离阈值：低于此距离代表【数字被底部遮挡】，必须滑动
    const SAFE_DISTANCE_THRESHOLD = 220;
    // 数字遮挡时的小幅上滑距离
    const SMALL_SCROLL_DISTANCE = 180;
    // 当前页无龙蛋时的大范围翻页距离
    const BIG_SCROLL_DISTANCE = 700;
    // 最大循环检索次数，防止死循环卡死
    const MAX_LOOP_TIMES = 18;

    for (let loopCount = 0; loopCount < MAX_LOOP_TIMES; loopCount++) {
        // 存储本轮识别到的所有龙蛋图标信息
        let foundEggList = [];

        // ==============================================
        // 第一步：遍历全部6个龙蛋，仅识别图标，不读取数字
        // ==============================================
        for (let index = 0; index < 6; index++) {
            const egg = await findImgIcon(
                `assets/RecognitionObject/DragonEgg${index}.png`,
                { min: 99, max: 1295 },
                { min: 104, max: 967 },
                true,
                0.93
            );
            if (egg.success) {
                foundEggList.push({
                    index: index,
                    y: egg.coordinates[1],
                    pos: egg.coordinates
                });
            }
        }

        // ==============================================
        // 场景1：当前页面未检测到任何龙蛋图标
        // ==============================================
        if (foundEggList.length === 0) {
            log.info("当前页面无龙蛋，执行大范围翻页检索");
            await sleep(800);
            await scrollPage(BIG_SCROLL_DISTANCE, 10, 5);
            await sleep(800);
            continue;
        }

        // ==============================================
        // 自动筛选：在当前所有识别到的龙蛋中
        // 取出【Y最大、画面最靠下、离底部最近】的那一枚作为全局判定基准
        // 自适应：1个、2个、3个、任意数量龙蛋全部通用
        // ==============================================
        const bottomMostEgg = foundEggList.sort((a, b) => b.y - a.y)[0];
        const distanceToBottom = SCREEN_BOTTOM_Y - bottomMostEgg.y;
        log.info(`已检测到${foundEggList.length}个龙蛋 | 基准龙蛋Y坐标：${bottomMostEgg.y} | 距屏幕底部：${distanceToBottom}px`);

        // ==============================================
        // 核心判定分支
        // ==============================================
        if (distanceToBottom > SAFE_DISTANCE_THRESHOLD) {
            // 分支A：间距充足，图标+数字完整无遮挡 → 批量识别所有龙蛋数量
            log.info("✅ 界面安全，数字无遮挡，开始识别全部龙蛋库存");
            for (const item of foundEggList) {
                const eggNum = await numberTemplateMatch(
                    'assets/backpackNumber',
                    { min: item.pos[0] - 46, max: item.pos[0] + 34 },
                    { min: item.pos[1] + 56, max: item.pos[1] + 83 },
                    0.8,
                    0.65
                );
                DragonEggs[item.index] = Number(eggNum);
                log.info(`龙蛋[${item.index}] 库存数量：${eggNum}`);
            }
            // 本轮全部识别完毕，结束检测流程
            break;
        } else {
            // 分支B：间距不足，**图标可见、下方数字被底部遮挡**
            // 不执行数字识别，直接小幅上滑，露出完整数字区域后重试
            log.info("⚠️ 基准龙蛋贴近底部，数字区域被遮挡，小幅上滑调整界面");
            await sleep(800);
            await scrollPage(SMALL_SCROLL_DISTANCE, 10, 5);
            await sleep(800);
            continue;
        }
    }

    // ==================== 结果汇总、日志推送、存档持久化 ====================
    const resultMsg = `背包龙蛋数目: 【山之血：${DragonEggs[0]}，飞澜鲨鲨：${DragonEggs[1]}，圣龙君临：${DragonEggs[2]}，太阳的轰鸣：${DragonEggs[3]}，献给小酒杯：${DragonEggs[4]}，菲耶蒂娜：${DragonEggs[5]}】`;
    log.info(`识别出来的${resultMsg}`);

    // 配置开启则发送桌面通知
    if (settings.notify?.length) {
        notification.Send(`识别出来的${resultMsg}`);
    }

    // 更新本地存档并写入文件
    record.lastDragonEggsNum = resultMsg.split(": ")[1];
    await writeRecord();

    return record.lastDragonEggsNum;
}

/* ==================== 通用长对话点击函数 ==================== */
async function clickLongTalk() {
    // 识别是不是主界面
    let isMainUi = { success: false, coordinates:[0, 0]};
    do {
        leftButtonClick();
        isMainUi = await findImgIcon("assets/RecognitionObject/PaiMonMenu.png", { min: 15, max: 112 }, { min: 0, max: 84 }, false, 0.8, 500);
    } while (!isMainUi.success);    
};

/**
 * BGI C# List<string> → JS原生数组
 * @param {any} csList BGI桥接传来的C#List代理 / null
 * @returns {string[]} JS数组
 */
function toJsArray(csList) {
    if (csList == null) return [];
    return Array.from(csList);
}



/* ========================================================================================================= */
/* ============================================== 脚本主入口执行区 =========================================== */
/* ========================================================================================================= */
(async function() {
    // 脚本启动日志伪装
    await fakeLog("AutoPickLitter脚本", true, true, 0);

    /* ================= 配置开关全关闭检测 ================== */
    const checkList = [
        toJsArray(settings.water),
        toJsArray(settings.sticks),
        toJsArray(settings.lots),
        toJsArray(settings.conchs),
        toJsArray(settings.meal),
        toJsArray(settings.eggs),
        toJsArray(settings.turntable),
        toJsArray(settings.todayLuck),
        toJsArray(settings.sweetStatue),
        toJsArray(settings.iceCream)
    ];
    // 全部数组长度都是0
    if (!checkList.some(arr => arr.length > 0)) {
        log.error(`亲，这面请您点击【打开脚本目录】找到AutoPickLitter文件并打开然后去阅读README！！！`);
        log.error(`亲，这面请您点击【打开脚本目录】找到AutoPickLitter文件并打开然后去阅读README！！！`);
        log.error(`亲，这面请您点击【打开脚本目录】找到AutoPickLitter文件并打开然后去阅读README！！！`);
        await fakeLog("AutoPickLitter脚本", true, false, 2333);
        return 0;
    };

    /* ================= 游戏环境初始化设置 ================== */
    await setGameMetrics(1920,1080,1); // 锁定游戏分辨率1920*1080，DPI缩放1.0
    await dispatcher.AddTrigger(new RealtimeTimer("AutoSkip")); // 加载自动跳过触发器
    await dispatcher.clearAllTriggers(); // 清空残留实时任务触发器

    /* ================= 存档加载与数据初始化 ================== */
    await readAndInitRecord();

    // 更新本次脚本运行日期（适配原神4点刷新时区）
    record.lastRunDate = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    // 初始化完成后保存当前数据
    await writeRecord();

    /* ================ 后续子任务执行入口预留区 ================ */
    // 蒙德清泉镇圣水
    if (recordsTime.waterTime) {
        await fakeLog("蒙德清泉镇圣水", false, true, 0);
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/调为白天.json");
        await pathingScript.runFile("assets/runJson/蒙德清泉镇路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        // await sleep(700);
        // 识别对话位置
        let ocrResults = await performOcr("神奇的", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            // 按下F键
            keyDown("F");
            await sleep(700);
            keyUp("F");
            await sleep(700);
            leftButtonClick();
            leftButtonClick();
            await sleep(1400);
            keyDown("F");
            await sleep(700);
            keyUp("F");
            await sleep(700);
            leftButtonClick();
            leftButtonClick();
            let ocrOver = await performOcr("已",{ min: 1482, max: 1630 }, { min: 912, max: 957 }, false);
            await sleep(700);
            if (ocrOver.success) {
                log.info("已售罄！！！");
            } else {
                const mora = await numberTemplateMatch('assets/moraNumber', { min: 1600, max: 1780 }, { min: 30, max: 60 });
                if (BigInt(mora) >= 300) {
                    await sleep(800);
                    await click(1636,1019);
                    await sleep(1000);
                    await click(1168,785);
                    await sleep(1000);
                } else {
                    log.info("不是哥们，你怎么比我还穷！！！");
                };
            };
        };
        record.lastWaterTime = new Date();
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("蒙德清泉镇圣水", false, false, 0);
    };

    // 璃月璃沙娇上香
    if (recordsTime.sticksTime) {
        await fakeLog("璃月璃沙娇上香", false, true, 0);
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/璃月璃沙娇路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        // 识别区域
        let ocrResults = await performOcr("王平安", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            keyDown("VK_MENU");
            await sleep(700);
            moveMouseTo(ocrResults.coordinates[0], ocrResults.coordinates[1]);
            leftButtonClick();
            await sleep(800);
            keyUp("VK_MENU");
            await sleep(1000);
            await genshin.chooseTalkOption("能给我几支香吗");
            await sleep(700);
            leftButtonClick();
            await sleep(700);
            leftButtonClick();
            await sleep(2000);
            let ocrResults1 = await performOcr("敬香", dialogZone.x, dialogZone.y, false);
            if(ocrResults1.success){
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults1.coordinates[0], ocrResults1.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                await click(1168,785);
                await sleep(700);
            } else {
                log.error("未识别到对话，可能角色移速太快加上有开盾打断识别了");
                await genshin.returnMainUi();
            };
        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        record.lastSticksTime = new Date();
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("璃月璃沙娇上香", false, false, 0);
    };

    // 稻妻鸣神大社抽签
    if (recordsTime.lotsTime) {
        await fakeLog("稻妻鸣神大社抽签", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/稻妻鸣神大社路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        // await sleep(1000);
        // 识别对话位置，并点击
        let ocrResults = await performOcr("御神签箱", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            keyDown("VK_MENU");
            await sleep(700);
            moveMouseTo(ocrResults.coordinates[0], ocrResults.coordinates[1]);
            leftButtonClick();
            await sleep(800);
            keyUp("VK_MENU");
            await sleep(1000);
            await sleep(700);
            leftButtonClick();
            await sleep(2000);
            let ocrResults1 = await performOcr("求签吧", dialogZone.x, dialogZone.y, false);
            if (ocrResults1.success) {
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults1.coordinates[0], ocrResults1.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                leftButtonClick();
                await sleep(2000);
                leftButtonClick();
                await sleep(4000);
                leftButtonClick();
                await sleep(3500);
            };
            let ocrResults2 = await performOcr("玄冬林", dialogZone.x, dialogZone.y, false);
            keyDown("VK_MENU");
            await sleep(700);
            moveMouseTo(ocrResults2.coordinates[0], ocrResults2.coordinates[1]);
            leftButtonClick();
            await sleep(800);
            keyUp("VK_MENU");
            await sleep(1000);
            let results = "";
            if (ocrResults2.success) {
                await sleep(1000);
                leftButtonClick();
                await sleep(700);
                let ocrResults3 = await performOcr("我要", dialogZone.x, dialogZone.y, false);
                if (ocrResults3.success) {
                    keyDown("VK_MENU");
                    await sleep(700);
                    moveMouseTo(ocrResults3.coordinates[0], ocrResults3.coordinates[1]);
                    leftButtonClick();
                    await sleep(800);
                    keyUp("VK_MENU");
                    await sleep(1000);
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                    // 交互道具，直接选择位置点击
                    await click(111,184);
                    await sleep(1000);
                    await click(1250,817);
                    await sleep(1000);
                    await click(1603,1013);
                    await sleep(1500);
                    await genshin.returnMainUi();
                    // 打开背包找签
                    await keyPress("B");
                    await checkExpire();
                    await sleep(1000);
                    await click(1150,50);
                    await sleep(700);
                    for(let scroll = 0; scroll <= 22; scroll++){
                        // 识别御神签
                        let yuShenQian = await findImgIcon("assets/RecognitionObject/YuShenQianHalf.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                        if (yuShenQian.success) {
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(yuShenQian.coordinates[0], yuShenQian.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                            break;
                        };
                        if ( scroll != 0) {
                            // 判断是否到底
                            let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                            if (sliderBottom.success) {
                                log.info("已到达最后一页！");
                                break;
                            };
                        };
                        // 滑动背包
                        await scrollPage(680, 10, 5);
                        await sleep(100);
                    };
                    await sleep(2000);
                    await click(1670,1025);
                    await sleep(3000);
                    // 通过图片识别
                    // 大凶or凶
                    let bigBad = await findImgIcon("assets/RecognitionObject/BigBad.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let bad = await findImgIcon("assets/RecognitionObject/Bad.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    // 大吉、中吉、吉、末吉
                    let bigLuck = await findImgIcon("assets/RecognitionObject/BigLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let midLuck = await findImgIcon("assets/RecognitionObject/MidLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let endLuck = await findImgIcon("assets/RecognitionObject/EndLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    let luck = await findImgIcon("assets/RecognitionObject/Luck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                    await genshin.returnMainUi();
                    if (bigBad.success) {
                        log.info("抽签的结果:大凶");
                        results = "大凶";
                        await pathingScript.runFile("assets/runJson/挂签路线.json");
                        let ocrResults4 = await performOcr("御签挂", { min: 900, max: 1700 }, { min: 380, max: 880 }, false);
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(ocrResults4.coordinates[0], ocrResults4.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        await genshin.chooseTalkOption("挂起来吧");
                        await sleep(700);
                        await click(111,184);
                        await sleep(1000);
                        await click(1250,817);
                        await sleep(1000);
                        await click(1603,1013);
                        await sleep(1500);
                        await genshin.returnMainUi();
                        log.info("事事顺利");
                    } else if (bad.success) {
                        log.info("抽签的结果:凶");
                        results = "凶";  
                        await pathingScript.runFile("assets/runJson/挂签路线.json");
                        let ocrResults4 = await performOcr("御签挂", { min: 900, max: 1700 }, { min: 380, max: 880 }, false);
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(ocrResults4.coordinates[0], ocrResults4.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        await genshin.chooseTalkOption("挂起来吧");
                        await click(111,184);
                        await sleep(1000);
                        await click(1250,817);
                        await sleep(1000);
                        await click(1603,1013);
                        await sleep(1500);
                        await genshin.returnMainUi();
                        log.info("事事顺利");
                    } else if (bigLuck.success) {
                        log.info("抽签的结果:大吉");
                        results = "大吉";
                    } else if (midLuck.success) {
                        log.info("抽签的结果:中吉");
                        results = "中吉";
                    } else if (endLuck.success) {
                        log.info("抽签的结果:末吉");
                        results = "末吉";
                    } else if (luck.success) {
                        log.info("抽签的结果:吉");
                        results = "吉";
                    } else {
                        log.warn("嘘，快踢作者屁股，修bug！！！");
                    };  
                } else {
                    await sleep(700);
                    await genshin.chooseTalkOption("再见");
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                    log.info("对话出现再见，默认解签完毕以及查看签操作！！！");
                }; 

                for (let i = record.records.length - 1; i > 0; i--) {
                    record.records[i] = record.records[i - 1];
                }
                record.records[0] = `抽签的结果: ${results}`;
                if (settings.notify) {
                    notification.Send(`抽签的结果: ${results}`);
                }
                await writeRecord();//修改记录文件
            };
        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        record.lastLotsTime = new Date();
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("稻妻鸣神大社抽签", false, true, 0)
    };

    // 稻妻踏鞴砂海螺
    if (recordsTime.conchsTime) {
        await fakeLog("稻妻踏鞴砂海螺", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/稻妻踏鞴砂路线.json");
        // await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        // await sleep(1000);
        if (settings.doYouOpen) {
            await pathingScript.runFile("assets/runJson/阿敬.json");
            let figure = parseInt(settings.pickupTreasure);
            let ocrResults = await performOcr("阿敬", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                // 按下F键
                keyDown("F");
                await sleep(700);
                keyUp("F");
                await sleep(1000);
                leftButtonClick();
                await sleep(1600);
                let ocrResults1 = await performOcr("想要", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    keyDown("F");
                    await sleep(700);
                    keyUp("F");
                    await sleep(1000);
                    leftButtonClick();
                    await sleep(1500);
                    // 交互道具，直接选择位置点击
                    await click(111,184);
                    await sleep(1000);
                    await click(1250,817);
                    await sleep(1000);
                    await click(1603,1013);
                    await sleep(1500);
                    await genshin.returnMainUi();
                    if (figure != 0) {
                        await pathingScript.runFile(`assets/runJson/宝箱${figure}.json`);
                        log.info(`你即将开启${figure}号宝箱`);
                    } else {
                        figure = Math.floor(Math.random() * 3) + 1;
                        log.info(`你即将开启${figure}号宝箱`);
                        await pathingScript.runFile(`assets/runJson/宝箱${figure}.json`);
                    };
                } else {
                    log.info("你开过了？look my eyes,回答我！！！");
                    await genshin.chooseTalkOption("再见");
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
        };
        record.lastConchsTime = new Date();
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("稻妻踏鞴砂海螺", false, false, 0)
    };

    // 枫丹梅洛彼得堡福利餐
    if(recordsTime.mealTime){
        await fakeLog("枫丹梅洛彼得堡福利餐", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/枫丹梅洛彼得堡路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        await sleep(1500);
        let ocrResults = await performOcr("布兰", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            // 按下F键
            keyDown("F");
            await sleep(700);
            keyUp("F");
            await sleep(1000);
            leftButtonClick();
            await sleep(1500);
            let ocrResults1 = await performOcr("没什么", dialogZone.x, dialogZone.y, false);
            if(ocrResults1.success){
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults1.coordinates[0], ocrResults1.coordinates[1]);
                leftButtonClick();
                await sleep(1000);
                leftButtonClick();
                keyUp("VK_MENU");
                log.info("对话出现没什么，默认领取和使用过！！！");
            } else{
                keyDown("F");
                await sleep(700);
                keyUp("F");
                await sleep(1000);
                leftButtonClick();
                await sleep(1000);
                leftButtonClick();
                await sleep(1000);
                leftButtonClick();
                await sleep(1500);
                // 打开背包找签
                log.info("打开背包");
                await keyPress("B");
                await checkExpire();
                await sleep(1500);
                await click(1250,50); 
                await sleep(700);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let welffareMeal = await findImgIcon("assets/RecognitionObject/WelffareMealHalf.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true, 0.7);
                    if (welffareMeal.success) {
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(welffareMeal.coordinates[0], welffareMeal.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        break;
                    }
                    // 滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);

                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                // 这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(3000);
                // 识别获得的食物名称
                let ocrText = await performOcr("", { min: 813, max: 985 }, { min: 585, max: 619 }, true);
                if (ocrText.text == "") {
                    await sleep(700);
                    ocrText = await performOcr("", { min: 813, max: 985 }, { min: 585, max: 619 }, true);
                };
                log.info(`获得:${ocrText.text}`);
                for (let i = record.records.length - 1; i > 0; i--) {
                    record.records[i] = record.records[i - 1];
                }
                record.records[0] = `获得的食物: ${ocrText.text}`;
                if (settings.notify) {
                    notification.Send(`获得的食物: ${ocrText.text}`);
                };
                await writeRecord();// 修改记录文件

                // 点击幸运签，并识别内容
                await sleep(1000);
                await click(1000,520);
                await sleep(3000);
                let ocrText1 = await performOcr("", { min: 716, max: 1200 }, { min: 631, max: 710 }, true);
                if (ocrText1.text == "") {
                    await sleep(700);
                    ocrText1 = await performOcr("", { min: 716, max: 1200 }, { min: 631, max: 710 }, true);
                };
                let text = ocrText1.text.replace(/\r\n|\n|\r/g, "");

                log.info(`幸运签内容:${text}`);

                for (let i = record.records.length - 1; i > 0; i--) {
                    record.records[i] = record.records[i - 1];
                }
                record.records[0] = `幸运签内容: ${text}`;
                if (settings.notify) {
                    notification.Send(`幸运签内容: ${text}`);
                };
                record.lastMealTime = new Date();
                await writeRecord();// 修改记录文件
                
            };

        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
        await fakeLog("枫丹梅洛彼得堡福利餐", false, false, 0)
    };

    // 纳塔悠悠集市龙蛋
    if(recordsTime.eggsTime){
        await fakeLog("纳塔悠悠集市龙蛋", false, true, 0)
        // 判断背包与填写数量
        let nowDragonEggsNum = record.lastDragonEggsNum;
        log.info(`上次的龙蛋信息:${nowDragonEggsNum}`);
        let nowDragonEggs = [];
        if (settings.dragonEggsNum == "0-0-0-0-0-0") {
            nowDragonEggsNum = await checkDragonEggs();
            nowDragonEggs = nowDragonEggsNum.match(/\d+/g).map(Number);
        } else{
            nowDragonEggs = settings.dragonEggsNum.split('-').map(Number);
        };
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/纳塔悠悠集市路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        let ocrResults = await performOcr("察尔瓦", dialogZone.x, dialogZone.y, false);
        if (ocrResults.success) {
            await sleep(700);
            keyDown("F");
            await sleep(700);
            keyUp("F");
            await sleep(2000);
            leftButtonClick();
            await sleep(3500);
            let ocrResults1 = await performOcr("让我挑一枚", dialogZone.x, dialogZone.y, false);
            if (ocrResults1.success) {
                keyDown("F");
                await sleep(700);
                keyUp("F");
                await sleep(1000);
                let figure = 0;
                if (settings.selectDragonEggModel == "随机模式") {
                    figure = Math.floor(Math.random() * 6);
                    nowDragonEggs[figure]++;
                } else if (settings.selectDragonEggModel == "指定模式") {
                    switch (settings.pickupDragonEgg) {
                        case "闪闪礼蛋·山之血":
                            figure = 0;
                            break;
                        case "闪闪礼蛋·飞澜鲨鲨":
                            figure = 1;
                            break;
                        case "闪闪礼蛋·圣龙君临":
                            figure = 2;
                            break;
                        case "闪闪礼蛋·太阳的轰鸣":
                            figure = 3;
                            break;
                        case "闪闪礼蛋·献给小酒杯":
                            figure = 4;
                            break;
                        case "闪闪礼蛋·菲耶蒂娜":
                            figure = 5;
                            break;
                        default:
                            log.warn("嘘，快踢作者屁股，修bug！！！");
                            break;
                    };
                    nowDragonEggs[figure]++;
                }else {
                    // 平均模式
                    const now = new Date();
                    const weekNumber = now.getDay();
                    const allSame = nowDragonEggs.every(num => num === nowDragonEggs[0]);
                    if (allSame) {
                        // ✅ 只有全部数值完全相等，才走星期规则
                        log.info("【分支】全部相等，星期模式");
                        if (weekNumber == 0) { 
                            // 周日：随机一个元素+1
                            figure = Math.floor(Math.random() * 6);
                            nowDragonEggs[figure]++;
                        } else { 
                            // 周一~周六：按星期下标+1
                            figure = weekNumber - 1; 
                            nowDragonEggs[figure]++;
                        }
                    } else {
                        // ✅ 只要不一样，永远补全局最小，不受星期干扰
                        console.log("【分支】不均衡，补全局最小");
                        const minVal = Math.min(...nowDragonEggs);
                        const minIndices = nowDragonEggs
                            .map((num, i) => ({ num, i }))
                            .filter(item => item.num === minVal)
                            .map(item => item.i);

                        // 多个最小值优先选第一个，想要随机就替换这一行
                        // figure = minIndices[0];
                        figure = minIndices[Math.floor(Math.random() * minIndices.length)];
                        nowDragonEggs[figure]++;
                    };
                };
                // 日志输出会去点击那个龙蛋
                switch (figure) {
                    case 0:
                        log.info("获得的龙蛋:闪闪礼蛋·山之血");
                        break;
                    case 1:
                        log.info("获得的龙蛋:闪闪礼蛋·飞澜鲨鲨");
                        break;
                    case 2:
                        log.info("获得的龙蛋:闪闪礼蛋·圣龙君临");
                        break;
                    case 3:
                        log.info("获得的龙蛋:闪闪礼蛋·太阳的轰鸣");
                        break;
                    case 4:
                        log.info("获得的龙蛋:闪闪礼蛋·献给小酒杯");
                        break;
                    case 5:
                        log.info("获得的龙蛋:闪闪礼蛋·菲耶蒂娜");
                        break;
                    default:
                        log.warn("嘘，快踢作者屁股，修bug！！！");
                        break;
                };
                keyDown("VK_MENU");
                await sleep(1500);
                moveMouseTo(eggCoordinates[figure][0],eggCoordinates[figure][1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                if (settings.notify) {
                    notification.Send(`背包龙蛋数目: 【山之血：${nowDragonEggs[0]}，飞澜鲨鲨：${nowDragonEggs[1]}，圣龙君临：${nowDragonEggs[2]}，太阳的轰鸣：${nowDragonEggs[3]}，献给小酒杯：${nowDragonEggs[4]}，菲耶蒂娜：${nowDragonEggs[5]}】`);
                };
                // 更新记录
                settings.dragonEggsNum = `${nowDragonEggs[0]}-${nowDragonEggs[1]}-${nowDragonEggs[2]}-${nowDragonEggs[3]}-${nowDragonEggs[4]}-${nowDragonEggs[5]}`;
                record.lastDragonEggsNum = `【山之血：${nowDragonEggs[0]}，飞澜鲨鲨：${nowDragonEggs[1]}，圣龙君临：${nowDragonEggs[2]}，太阳的轰鸣：${nowDragonEggs[3]}，献给小酒杯：${nowDragonEggs[4]}，菲耶蒂娜：${nowDragonEggs[5]}】`;
                await writeRecord();
            } else {
                log.info("你今天已经领取过了");
            };
        } else {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        record.lastEggsTime = new Date();;
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("纳塔悠悠集市龙蛋", false, false, 0)
    };

    // 挪德卡莱那夏镇好运转盘
    if (recordsTime.turntableTime) {
        await fakeLog("挪德卡莱那夏镇好运转盘", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/挪德卡莱那夏镇好运转盘路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        // await sleep(1500);
        let text = "";
        let judgeTendency = true;
        let num = 0;
        do {
            let ocrResults = await performOcr("好运速转", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                await sleep(700);
                keyDown("F");
                await sleep(700);
                keyUp("F");
                await sleep(2000);
                leftButtonClick();
                await sleep(3000);
                leftButtonClick();
                await sleep(1000);
                let ocrResults1 = await performOcr("拨动转盘", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(700);
                    keyDown("F");
                    await sleep(700);
                    keyUp("F");
                    await sleep(2000);
                    leftButtonClick();
                    await sleep(6000);
                    let ocrText = await performOcr("", { min: 555, max: 1365 }, { min: 902, max: 1000 }, true);
                    if (ocrText.text == "") {
                        await sleep(700);
                        ocrText = await performOcr("", { min: 555, max: 1365 }, { min: 902, max: 1000 }, true);
                    };
                    log.info(`转盘运势:${ocrText.text}`);
                    text = ocrText.text.replace(/\r\n|\n|\r/g, "");
                    switch (settings.selectLuckTendency) {
                        case "林狼啸月，魔物环伺":
                            judgeTendency = text.includes("狼啸");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)) {
                                judgeTendency = true;
                            };
                            break;
                        case "雷鸣风骤，摧枯拉朽":
                            judgeTendency = text.includes("鸣风");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)) {
                                judgeTendency = true;
                            };
                            break;
                        case "旭日曈曈，驱散迷雾":
                            judgeTendency = text.includes("旭日");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)) {
                                judgeTendency = true;
                            };
                            break;
                        case "海蛇翻腾，风暴肆虐":
                            judgeTendency = text.includes("海蛇");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)){
                                judgeTendency = true;
                            };
                            break;
                        case "牝鹿引鹿，旅途顺利":
                            judgeTendency = text.includes("鹿引");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)) {
                                judgeTendency = true;
                            };
                            break;
                        case "晨露凝珠，浆果丰盛":
                            judgeTendency = text.includes("晨露");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)) {
                                judgeTendency = true;
                            };
                            break;
                        case "层云蔽月，大地沉睡":
                            judgeTendency = text.includes("层云");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)) {
                                judgeTendency = true;
                            };
                            break;
                        case "灯火长明，指引前路":
                            judgeTendency = text.includes("灯火");
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            if (num >= Number(settings.maxNum)) {
                                judgeTendency = true;
                            };
                            break;
                        default:
                            num++;
                            await sleep(2000);
                            leftButtonClick();
                            await sleep(3500);
                            break;
                    };
                } else {
                    log.error(`识别图像时发生异常: ${error.message}`);
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
        } while (!judgeTendency);
        log.info(`转了${num}次`);   

        for (let i = record.records.length - 1; i > 0; i--) {
            record.records[i] = record.records[i - 1];
        }
        record.records[0] = `转盘的运势: ${text}`;
        if (settings.notify) {
            notification.Send(`转盘的运势: ${text}`);
        };
        record.lastTurntableTime = new Date();
        await writeRecord();// 修改记录文件
        await genshin.returnMainUi();
        await fakeLog("挪德卡莱那夏镇好运转盘", false, false, 0)
    };

    // 挪德卡莱那夏镇今日收获
    if (recordsTime.todayLuckTime) {
        await fakeLog("挪德卡莱那夏镇美味的今日收获", false, true, 0)
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/runJson/挪德卡莱那夏镇美味的今日收获路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        await sleep(1000);
            let ocrResults = await performOcr("莉莉希", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                await sleep(700);
                keyDown("F");
                await sleep(700);
                keyUp("F");
                await sleep(2000);
                leftButtonClick();
                await sleep(700);
                leftButtonClick();
                let ocrResults1 = await performOcr("可以领", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(700);
                    keyDown("F");
                    await sleep(700);
                    keyUp("F");
                    await sleep(2000);
                    leftButtonClick();
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                } else {
                    log.warn("情况一，你根本没仔细看提示");
                    log.warn("情况二，你把它残忍放进背包了");
                    await sleep(1000);
                    await genshin.chooseTalkOption("其实");
                    await sleep(1000);
                    await sleep(700);
                    leftButtonClick();
                    await sleep(1500);
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
        record.lastTodayLuckTime = new Date();
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("挪德卡莱那夏镇美味的今日收获", false, false, 0)
    };

    // 挪德卡莱那夏镇糖雕
    if (recordsTime.sweetStatueTime) {
        await fakeLog("挪德卡莱那夏镇糖雕", false, true, 0)
        await pathingScript.runFile("assets/runJson/挪德卡莱那夏镇糖雕路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        await sleep(1000);
        if (settings.partyName == "") {
            let ocrResults = await performOcr("乌娜亚塔", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults.coordinates[0], ocrResults.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                leftButtonClick();
                await sleep(2000);
                keyDown("F");
                await sleep(700);
                keyUp("F");
                await sleep(2000);
                leftButtonClick();
                await clickLongTalk();
                // 打开背包找糖
                await keyPress("B");
                await checkExpire();
                await sleep(1000);
                await click(864,52);
                await sleep(800);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let sugar = await findImgIcon("assets/RecognitionObject/sugar.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (sugar.success) {
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(sugar.coordinates[0], sugar.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        break;
                    }
                    // 滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);
                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                // 这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(700);
                await click(1145, 765);
                await sleep(700);
                let ocrResults1 = await performOcr("是否", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(800);
                    await click(1012, 765);
                    await sleep(50);
                    await click(1012, 765);
                };
            };
        } else if (settings.partyName == "祈月") {
            let ocrResults = await performOcr("乌娜亚塔", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults.coordinates[0], ocrResults.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                leftButtonClick();
                await sleep(2000);
                let ocrResults1 = await performOcr("祈月", dialogZone.x, dialogZone.y, false);
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults1.coordinates[0], ocrResults1.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                leftButtonClick();
                keyUp("VK_MENU");
                leftButtonClick();
                await clickLongTalk();
                // 打开背包找糖
                await keyPress("B");
                await checkExpire();
                await sleep(1000);
                await click(864,52);
                await sleep(800);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let sugar = await findImgIcon("assets/RecognitionObject/sugar.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (sugar.success) {
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(sugar.coordinates[0], sugar.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        break;
                    }
                    // 滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);
                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                // 这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(700);
                await click(1145, 765);
                await sleep(700);
                let ocrResults2 = await performOcr("是否", dialogZone.x, dialogZone.y, false);
                if (ocrResults2.success) {
                    await sleep(800);
                    await click(1012, 765);
                    await sleep(50);
                    await click(1012, 765);
                };
            };
        } else {
            await switchPartyIfNeeded(settings.partyName); // 切换队伍
            let ocrResults = await performOcr("乌娜亚塔", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults.coordinates[0], ocrResults.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                leftButtonClick();
                keyUp("VK_MENU");
                leftButtonClick();
                await sleep(2000);
                let who = await performOcr(settings.selectGiveWho, dialogZone.x, dialogZone.y, false);
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(who.coordinates[0], who.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                await clickLongTalk();
                // 向后走两步，避免误触调查点
                keyDown("s");
                await sleep(1000);
                keyUp("s");
                await sleep(800);
                // 打开背包找糖
                await keyPress("B");
                await checkExpire();
                await sleep(1000);
                await click(864,52);
                await sleep(800);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let sugar = await findImgIcon("assets/RecognitionObject/sugar.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (sugar.success) {
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(sugar.coordinates[0], sugar.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        break;
                    }
                    // 滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);
                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                // 这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(700);
                let who1 = await findImgIcon(`assets/RecognitionObject/${settings.selectGiveWho}.png`, { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(who1.coordinates[0], who1.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                await click(1145, 765);
                await sleep(700);
                let ocrResults1 = await performOcr("是否", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(800);
                    await click(1012, 765);
                    await sleep(50);
                    await click(1012, 765);
                };
            };
        };
        record.lastSweetStatueTime = new Date();
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("挪德卡莱那夏镇糖雕", false, false, 0)
    };

    // 至冬至冬堡冰淇淋
    if (recordsTime.iceCreamTime) {
        await fakeLog("至冬至冬堡冰淇淋", false, true, 0)
        await pathingScript.runFile("assets/runJson/至冬至冬堡冰淇淋路线.json");
        await keyMouseScript.runFile("assets/runJson/滚动滚轮.json");
        await sleep(3000);
        if (settings.partyName1 == "") {
            let ocrResults = await performOcr("齐良", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults.coordinates[0], ocrResults.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                leftButtonClick();
                await sleep(2000);
                keyDown("F");
                await sleep(700);
                keyUp("F");
                await sleep(2000);
                leftButtonClick();
                await clickLongTalk();
                // 打开背包找糖
                await keyPress("B");
                await checkExpire();
                await sleep(1000);
                await click(864,52);
                await sleep(800);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let sugar = await findImgIcon("assets/RecognitionObject/sugar.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (sugar.success) {
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(sugar.coordinates[0], sugar.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        break;
                    }
                     滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);
                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                // 这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(700);
                await click(1145, 765);
                await sleep(700);
                let ocrResults1 = await performOcr("是否", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(800);
                    await click(1012, 765);
                    await sleep(50);
                    await click(1012, 765);
                };
            };
        } else {
            await switchPartyIfNeeded(settings.partyName1); // 切换队伍
            let ocrResults = await performOcr("齐良", dialogZone.x, dialogZone.y, false);
            if (ocrResults.success) {
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(ocrResults.coordinates[0], ocrResults.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(700);
                leftButtonClick();
                await sleep(2000);
                let who = await performOcr(settings.selectGiveWho1, dialogZone.x, dialogZone.y, false);
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(who.coordinates[0], who.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                await clickLongTalk();
                // 向后走两步，避免误触调查点
                keyDown("s");
                await sleep(1000);
                keyUp("s");
                await sleep(800);
                // 打开背包找糖
                await keyPress("B");
                await checkExpire();
                await sleep(1000);
                await click(864,52);
                await sleep(800);
                for(let scroll = 0; scroll <= 10; scroll++){
                    let sugar = await findImgIcon("assets/RecognitionObject/sugar.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                    if (sugar.success) {
                        keyDown("VK_MENU");
                        await sleep(700);
                        moveMouseTo(sugar.coordinates[0], sugar.coordinates[1]);
                        leftButtonClick();
                        await sleep(800);
                        keyUp("VK_MENU");
                        await sleep(1000);
                        break;
                    }
                    // 滑动背包
                    await sleep(1000);
                    await scrollPage(680, 10, 5);
                    await sleep(1000);
                    if ( scroll != 0) {
                        // 判断是否到底
                        let sliderBottom = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false);
                        if (sliderBottom.success) {
                            log.info("已到达最后一页！");
                            break;
                        };
                    };
                };
                // 这里是点击使用
                await sleep(1000);
                await click(1670,1025);
                await sleep(700);
                let who1 = await findImgIcon(`assets/RecognitionObject/${settings.selectGiveWho}.png`, { min: 99, max: 1295 }, { min: 104, max: 967 }, true);
                keyDown("VK_MENU");
                await sleep(700);
                moveMouseTo(who1.coordinates[0], who1.coordinates[1]);
                leftButtonClick();
                await sleep(800);
                keyUp("VK_MENU");
                await sleep(1000);
                await click(1145, 765);
                await sleep(700);
                let ocrResults1 = await performOcr("是否", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.success) {
                    await sleep(800);
                    await click(1012, 765);
                    await sleep(50);
                    await click(1012, 765);
                };
            };
        };
        record.lastIceCreamTime = new Date();
        await writeRecord();
        await genshin.returnMainUi();
        await fakeLog("至冬至冬堡冰淇淋", false, false, 0)
    };



    for (let i = record.records.length - 1; i > 0; i--) {
        record.records[i] = record.records[i - 1];
    }
    record.records[0] = `>>>>>>>>>> ${new Date().getFullYear()}年${String(new Date().getMonth() + 1).padStart(2, '0')}月${String(new Date().getDate()).padStart(2, '0')}日`;
    await writeRecord();// 修改记录文件


    // 脚本运行结束日志伪装
    await fakeLog("AutoPickLitter脚本", true, false, 2333);
})();