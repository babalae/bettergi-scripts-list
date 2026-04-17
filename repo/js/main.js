// 抽卡资源统计（自动切换卡池收集四数据）
// 功能：进入祈愿界面 → 识别原石/星辉 → 根据卡池标题记录纠缠/相遇 → 切换页面直到数据齐或达上限

// ==================== 配置区 ====================
// 祈愿界面标题识别区域（用于确认已进入祈愿界面）
const WISH_TITLE_REGION = { x: 130, y: 30, width: 70, height: 30 };
const WISH_TITLE_TEXT = "祈愿";

// 1. 卡池标题识别区域（用于判断当前是什么卡池）
const TITLE_REGION = { x: 310, y: 210, width: 190, height: 40 };

// 2. 资源数值区域
const PRIMOGEM_REGION = { x: 1400, y: 25, width: 230, height: 46 };    // 原石
const STARGLITTER_REGION = { x: 60, y: 950, width: 140, height: 40 };  // 无主的星辉
const INTERTWINED_REGION = { x: 1640, y: 25, width: 160, height: 46 };  // 纠缠之缘（仅在活动卡池可见）
const ACQUAINT_REGION = { x: 1718, y: 33, width: 160, height: 46 };     // 相遇之缘（仅在常驻卡池可见）

// 3. 切换卡池按钮坐标（右侧箭头）
const SWITCH_BTN_X = 1845;
const SWITCH_BTN_Y = 540;

// 4. 最大切换次数（防止无限循环）
const MAX_SWITCH = 6;

// 字符替换映射（提高OCR准确率）
const REPLACEMENT_MAP = {
    "O": "0", "o": "0", "l": "1", "I": "1", "Z": "2", "S": "5", "B": "8"
};

// ==================== 工具函数 ====================
// 识别指定区域的文字
async function recognizeTextInRegion(region, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const cap = captureGameRegion();
            const ro = RecognitionObject.Ocr(region.x, region.y, region.width, region.height);
            const result = cap.Find(ro);
            cap.Dispose();
            if (result && !result.IsEmpty()) {
                let text = result.Text;
                for (let [wrong, correct] of Object.entries(REPLACEMENT_MAP)) {
                    text = text.split(wrong).join(correct);
                }
                result.Dispose();
                return text;
            }
            if (result) result.Dispose();
        } catch (e) {}
        await sleep(500);
    }
    return null;
}

// 识别区域内的数字（只保留数字字符）
async function recognizeNumberInRegion(region, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const cap = captureGameRegion();
            const ro = RecognitionObject.Ocr(region.x, region.y, region.width, region.height);
            const result = cap.Find(ro);
            cap.Dispose();
            if (result && !result.IsEmpty()) {
                let text = result.Text;
                log.info(`[OCR原始] ${text}`);  // 保留调试日志
                
                // 应用替换映射
                for (let [wrong, correct] of Object.entries(REPLACEMENT_MAP)) {
                    text = text.split(wrong).join(correct);
                }
                
                // 提取所有连续数字
                const match = text.match(/\d+/);
                const numberStr = match ? match[0] : '0';
                
                result.Dispose();
                log.info(`[OCR解析后] ${numberStr}`);
                return numberStr;
            }
            if (result) result.Dispose();
        } catch (e) {}
        await sleep(500);
    }
    log.warn("OCR 超时");
    return null;
}


// ==================== 主流程 ====================
(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    const notify = settings.notify || false;

        // 打开祈愿界面
        keyPress("F3");
        log.info("等待进入祈愿界面...");
        
        // 循环检测“祈愿”标题，最多等待3秒
        let entered = false;
        const start = Date.now();
        while (Date.now() - start < 3000) {
            const titleText = await recognizeTextInRegion(WISH_TITLE_REGION, 2000);
            if (titleText && titleText.includes(WISH_TITLE_TEXT)) {
                entered = true;
                break;
            }
            await sleep(500);
        }
        
        if (!entered) {
            log.error("未能进入祈愿界面，请检查游戏状态或标题区域配置");
            await genshin.returnMainUi();
            return;
        }
        log.info("已确认进入祈愿界面");
        await sleep(1000); // 界面稳定

    // 存储已收集的数据
    let primogem = null;
    let starglitter = null;
    let intertwined = null;
    let acquaint = null;

    let switchCount = 0;
    let collectedAll = false;

    // 循环切换页面收集数据
    while (switchCount < MAX_SWITCH && !collectedAll) {
        log.info(`--- 第 ${switchCount + 1} 个页面 ---`);

        // 1. 识别原石和星辉（这两个在所有页面都存在，只需识别一次）
        if (primogem === null) {
            const primogemStr = await recognizeNumberInRegion(PRIMOGEM_REGION, 3000);
            if (primogemStr) primogem = parseInt(primogemStr, 10) || 0;
        }
        if (starglitter === null) {
            const starglitterStr = await recognizeNumberInRegion(STARGLITTER_REGION, 3000);
            if (starglitterStr) starglitter = parseInt(starglitterStr, 10) || 0;
        }

        // 2. 识别当前卡池标题
        const titleRaw = await recognizeTextInRegion(TITLE_REGION, 3000);
        const title = titleRaw ? titleRaw.replace(/[^\u4e00-\u9fa5\d\-]/g, '') : '';
        log.info(`当前卡池标题：${title}`);

        // 3. 根据标题判断并识别对应资源
        if (title.includes("角色活动祈愿") || title.includes("角色活动祈愿-2") || title.includes("集录祈愿") || title.includes("武器活动祈愿")) {
            // 活动卡池，识别纠缠之缘
            if (intertwined === null) {
                const intertwinedStr = await recognizeNumberInRegion(INTERTWINED_REGION, 3000);
                if (intertwinedStr) intertwined = parseInt(intertwinedStr, 10) || 0;
                log.info(`识别到纠缠之缘：${intertwined}`);
            }
        } else if (title.includes("常驻祈愿")) {
            // 常驻卡池，识别相遇之缘
            if (acquaint === null) {
                const acquaintStr = await recognizeNumberInRegion(ACQUAINT_REGION, 3000);
                if (acquaintStr) acquaint = parseInt(acquaintStr, 10) || 0;
                log.info(`识别到相遇之缘：${acquaint}`);
            }
        } else {
            log.warn("未识别的卡池标题，跳过资源识别");
        }

        // 4. 检查是否已收集齐所有数据
        if (primogem !== null && starglitter !== null && intertwined !== null && acquaint !== null) {
            collectedAll = true;
            log.info("✅ 已收集齐所有数据，停止切换");
            break;
        }

        // 5. 未收集齐则切换页面
        switchCount++;
        if (switchCount < MAX_SWITCH && !collectedAll) {
            log.info(`切换至下一个卡池 (${switchCount}/${MAX_SWITCH})`);
            click(SWITCH_BTN_X, SWITCH_BTN_Y);
            await sleep(1000);
        }
    }

    // 处理未收集到的数据（置为0）
    primogem = primogem || 0;
    starglitter = starglitter || 0;
    intertwined = intertwined || 0;
    acquaint = acquaint || 0;

    // 计算总抽数
    const fromPrimogem = Math.floor(primogem / 160);
    const fromStarglitter = Math.floor(starglitter / 5);
    const upTotal = intertwined + fromPrimogem + fromStarglitter;
    const standardTotal = acquaint; 

    // 输出结果
    log.info(`===== 抽卡资源统计 =====`);
    log.info(`🔹原石: ${primogem} (可换 ${fromPrimogem} 抽)`);
    log.info(`🌟无主的星辉: ${starglitter} (可换 ${fromStarglitter} 抽)`);
    log.info(`纠缠之缘: ${intertwined}`);
    log.info(`相遇之缘: ${acquaint}`);
    log.info(`✨ UP池总抽数: ${upTotal} 抽`);
    log.info(`🔵 常驻池总抽数: ${standardTotal} 抽`);

    // 写入日志文件
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    const logLine = `${timeStr}    | 原石:${primogem}    星辉:${starglitter}    纠缠之缘:${intertwined}    相遇之缘:${acquaint}    | 合计UP抽:${upTotal}    常驻抽:${standardTotal}\n`;
    file.WriteTextSync("GachaResources_log.txt", logLine, true);

    // 发送通知
    const summary = `✨ UP抽: ${upTotal} 抽  |  🔵 常驻抽: ${standardTotal} 抽\n` +
                `💎 原石: ${primogem}  |  ⭐ 星辉: ${starglitter}\n` +
                `🎟️ 纠缠之缘: ${intertwined}  |  🎫 相遇之缘: ${acquaint}`;
    notification.Send("========原神抽卡资源========\n" + summary);


    await sleep(500);
    await genshin.returnMainUi();
})();