// ===== 配置与工具函数 =====
// 字符替换映射表：修正OCR识别的常见错误字符
const replacementMap = {
    "监": "盐",
    "姐": "妲",
    "干": "千",
    "卵": "卯",
    "凌": "绫",
    "疑": "凝",
    "沙": "砂",
    "谣": "瑶",
    "萤": "荧",  
    "霄": "宵"
};

// 原神角色列表：用于OCR识别后的字符匹配
const genshinImpactCharacters = [
    "荧", "空", "神里绫华", "琴", "丽莎", "芭芭拉", "凯亚", "迪卢克", "雷泽", "安柏", "温迪", "香菱",
    "北斗", "行秋", "魈", "凝光", "可莉", "钟离", "菲谢尔", "班尼特", "达达利亚", "诺艾尔", "七七",
    "重云", "甘雨", "阿贝多", "迪奥娜", "莫娜", "刻晴", "砂糖", "辛焱", "罗莎莉亚", "胡桃", "枫原万叶",
    "烟绯", "宵宫", "托马", "优菈", "雷电将军", "早柚", "珊瑚宫心海", "五郎", "九条裟罗", "荒泷一斗",
    "八重神子", "鹿野院平藏", "夜兰", "绮良良", "埃洛伊", "申鹤", "云堇", "久岐忍", "神里绫人", "柯莱",
    "多莉", "提纳里", "妮露", "赛诺", "坎蒂丝", "纳西妲", "莱依拉", "流浪者", "珐露珊", "瑶瑶",
    "艾尔海森", "迪希雅", "米卡", "卡维", "白术", "琳妮特", "林尼", "菲米尼", "莱欧斯利", "那维莱特",
    "夏洛蒂", "芙宁娜", "夏沃蕾", "娜维娅", "嘉明", "闲云", "千织", "希格雯", "阿蕾奇诺", "赛索斯",
    "克洛琳德", "艾梅莉埃", "卡齐娜", "基尼奇", "玛拉妮", "希诺宁", "恰斯卡", "欧洛伦", "玛薇卡",
    "茜特菈莉", "蓝砚", "梦见月瑞希", "伊安珊", "瓦雷莎", "爱可菲", "伊法", "丝柯克", "塔利雅"
];

// 预加载所有模板图像：避免循环中重复读取文件，提升性能
const templates = {
    wanderer: file.ReadImageMatSync("assets/wanderer_icon.png"),        // 流浪者图标（活跃状态）
    wandererInactive: file.ReadImageMatSync("assets/wanderer_icon_no_active.png"), // 流浪者图标（非活跃状态）
    yin: file.ReadImageMatSync("assets/yin.png"),                      // 荧的图标模板1
    yin2: file.ReadImageMatSync("assets/yin2.png"),                    // 荧的图标模板2
};

// 创建模板匹配对象的工具函数：统一参数格式，减少重复代码
function createTemplateMatch(templateKey, x, y, width, height) {
    return RecognitionObject.TemplateMatch(
        templates[templateKey],  // 使用预加载的模板图像
        x, y,                    // 识别区域左上角坐标
        width, height            // 识别区域宽高
    );
}

// 过滤非中文字符的工具函数：处理OCR结果中的无效字符
function filterChineseChars(text) {
    return text?.replace(/[^\u4e00-\u9fa5]/g, '') || '';  // 保留中文字符，其他字符替换为空
}

// 图像识别函数：返回布尔值表示是否识别成功
async function recognizeImage(recognitionObject) {
    await sleep(500);  // 延迟500ms，避免识别请求过于频繁
    try {
        const ro = captureGameRegion();
        const imageResult = ro.find(recognitionObject);
        ro.dispose();
        // 当识别结果存在且坐标不为(0,0)时（排除无效识别）
        return !!imageResult && imageResult.x !== 0 && imageResult.y !== 0;
    } catch (error) {
        log.error(`识别图像时发生异常: ${error.message}`);
        return false;
    }
}

// OCR文本识别函数：在指定区域重试识别直到超时
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
    let startTime = Date.now();  // 记录开始时间
    let retryCount = 0;          // 重试次数计数

    // 循环直到超时
    while (Date.now() - startTime < timeout) {
        try {
            // 创建OCR识别区域对象
            const region = RecognitionObject.ocr(
                ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height
            );
            // 绘制识别区域红框（调试用）
            //captureGameRegion().find(region).DrawSelf("debug");

            const ro = captureGameRegion();
            const ocrResult = ro.find(region);
            ro.dispose();
            if (ocrResult) {
                // 应用字符替换映射表修正识别结果
                let correctedText = ocrResult.text;
                for (const [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }
                return correctedText;  // 返回修正后的文本
            } else {
                log.warn(`OCR 识别区域未找到内容`);
                return null;
            }
        } catch (error) {
            // 记录重试日志
            retryCount++;
            log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500);  // 每次重试间隔500ms
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null;
}

// 定义识别对象
const paimonMenuRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("assets/paimon_menu.png"),
    0,
    0,
    640,
    216
);

// 判断是否在主界面的函数
const isInMainUI = () => {
    let captureRegion = captureGameRegion();
    let res = captureRegion.Find(paimonMenuRo);
    captureRegion.dispose();
    return !res.isEmpty();
};

// ===== 主流程逻辑 =====
(async function () {
    // 初始化游戏界面（设置分辨率等）
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();  // 返回游戏主界面
    await sleep(2000);  // 等待界面响应

    if (isInMainUI(paimonMenuRo)) {


        // 按下ESC键（可能用于打开菜单或其他操作）
        keyPress("ESCAPE");
        await sleep(1500);  // 等待界面响应

        // 识别玩家名称（主角名称）
        const playerNameRegion = { x: 270, y: 40, width: 400, height: 40 };
        let playerName = await recognizeTextInRegion(playerNameRegion);
        playerName = filterChineseChars(playerName);  // 过滤非中文字符
        log.info(`识别到的主角为：${playerName}`);

        // 返回主界面并等待加载
        await genshin.returnMainUi();
        await sleep(1000);

        if (!isInMainUI(paimonMenuRo)) {
            log.error(`返回主界面失败`);
            return;
        }

        // 初始化角色识别结果数组
        const CharacterJudgment = [false, false, false, false];  // 记录每个角色是否识别成功
        const Character = [];                                    // 存储识别到的角色名称

        // 并行识别4个角色（使用Promise.all提升效率）
        const recognitionPromises = Array(4).fill().map(async (_, i) => {
            try {
                // 计算第i个角色的OCR识别区域（垂直排列，间隔100px）
                const ocrRegion = {
                    x: 1620,
                    y: 225 + i * 100,
                    width: 160,
                    height: 60
                };
                // 执行OCR识别并过滤字符
                const recognizedText = await recognizeTextInRegion(ocrRegion);
                const filteredText = filterChineseChars(recognizedText);
                //log.info(`[角色${i + 1}] 识别到的文本：${filteredText}`);

                // 与角色列表进行匹配
                let isCharacterMatched = false;
                for (let j = 0; j < genshinImpactCharacters.length; j++) {
                    if (genshinImpactCharacters[j] === filteredText) {
                        // 匹配成功，记录结果
                        CharacterJudgment[i] = true;
                        log.info(`[角色${i + 1}] ${filteredText} 匹配成功`);
                        Character[i] = filteredText;
                        await sleep(500);  // 等待后续操作
                        isCharacterMatched = true;
                        break;
                    }
                }

                // 当OCR未匹配到角色时，尝试通过图像模板识别（散兵/旅行者）
                if (!isCharacterMatched) {
                    const { x, y, width, height } = ocrRegion;  // 解构区域坐标

                    // 创建4个模板匹配对象（流浪者和旅行者的不同状态）
                    const wanderer1 = createTemplateMatch("wanderer", x + 100, y, width + 20, height + 20);
                    const wanderer2 = createTemplateMatch("wandererInactive", x + 100, y - 10, width + 20, height + 30);
                    const yin3 = createTemplateMatch("yin", x + 100, y - 10, width + 20, height + 30);
                    const yin4 = createTemplateMatch("yin2", x + 100, y - 10, width + 20, height + 30);

                    // 执行图像识别并处理结果（添加catch避免异常中断）
                    const result1 = await recognizeImage(wanderer1).catch(() => false);
                    const result2 = await recognizeImage(wanderer2).catch(() => false);

                    if (result1 || result2) {
                        // 识别到流浪者
                        Character[i] = "流浪者";
                        log.info(`[角色${i + 1}] 流浪者匹配成功`);
                        CharacterJudgment[i] = true;
                    } else {
                        // 尝试识别旅行者（荧或空）
                        const result3 = await recognizeImage(yin3).catch(() => false);
                        const result4 = await recognizeImage(yin4).catch(() => false);
                        if ((result3 || result4) && filteredText === playerName) {
                            Character[i] = "荧";
                            log.info(`[角色${i + 1}] 荧匹配成功`);
                            CharacterJudgment[i] = true;
                        } else if (filteredText === playerName) {
                            Character[i] = "空";
                            log.info(`[角色${i + 1}] 空匹配成功`);
                            CharacterJudgment[i] = true;
                        } else {
                            log.error(`[角色${i + 1}] 散兵/旅行者识别失败`);
                        }
                    }
                }
            } catch (error) {
                // 记录详细错误到日志文件
                const errorMsg = `[角色${i + 1}] 识别失败: ${error.message}`;
                file.WriteTextSync("Resources_log.txt", errorMsg + "\n", true);
                log.warn(errorMsg);
            }
        });

        // 等待所有角色识别完成
        await Promise.all(recognitionPromises);

        // 检查是否全部识别成功
        const allRecognized = CharacterJudgment.every(Boolean);
        if (allRecognized) {
            // 记录识别结果到日志文件
            const now = new Date();
            const logContent = `${now.toLocaleString()} —— 1: ${Character[0]} ——- 2:${Character[1]} ——- 3:${Character[2]} ———— 4:${Character[3]}\n`;
            const writeSuccess = file.WriteTextSync("Character_log.txt", logContent, true);
            log.info(writeSuccess ? "成功将队伍信息写入日志文件" : "写入日志文件失败");
        } else {
            log.error("未能完全识别队伍角色");
        }

        // 等待后返回主界面
        await sleep(500);
        await genshin.returnMainUi();
    } else {
        log.error(`返回主界面失败,跳过识别`);
    }
})();