(async function () {
    // ===== 1. 预处理部分 =====

    // 配置读取和变量初始化
    let filePath = `assets/`;
    const CaiJiPartyName = settings.CaiJiPartyName || "null";
    const ZDYparty = settings.ZDYparty || "null";

    const userName = settings.userName || "默认账户";

    // Windows文件名非法字符列表
    const illegalCharacters = /[\\/:*?"<>|]/;
    // Windows保留设备名称列表
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    // 检查userName是否为空或只有空格
    if (!userName || userName.trim() === "") {
        log.error(`账户名 "${userName}" 不合法，账户名为空或只包含空格。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查userName是否以空格开头
    else if (userName.startsWith(" ")) {
        log.error(`账户名 "${userName}" 不合法，以空格开头。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查userName是否以空格结尾
    else if (userName.endsWith(" ")) {
        log.error(`账户名 "${userName}" 不合法，以空格结尾。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查userName是否以点号结尾
    else if (userName.endsWith(".")) {
        log.error(`账户名 "${userName}" 不合法，以点号结尾。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查userName是否包含非法字符
    else if (illegalCharacters.test(userName)) {
        log.error(`账户名 "${userName}" 不合法，包含非法字符。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查userName是否是保留设备名称
    else if (reservedNames.includes(userName.toUpperCase())) {
        log.error(`账户名 "${userName}" 不合法，是保留设备名称。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查userName长度是否超过255字符
    else if (userName.length > 255) {
        log.error(`账户名 "${userName}" 不合法，账户名过长。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查userName长度是否为0
    else if (userName.length === 0) {
        log.error(`账户名不合法，账户名为空。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    else {
        log.info(`账户名 "${userName}" 合法。`);
    }

    const cdRecordPath = `record/${userName}_cd.txt`;// 修改CD记录文件路径，包含用户名

    const ifMonthcard = settings.ifMonthcard;

    const ifingredientProcessing = settings.ifingredientProcessing;
    const ingredientProcessingFood = settings.ingredientProcessingFood;
    const foodCounts = settings.foodCount;
    const stove = settings.stove || "蒙德炉子";

    const ifCheck = settings.ifCheck || "不查询收益";
    const ifendTosafe = settings.ifendTosafe;

    let Foods = [];
    if (typeof ingredientProcessingFood === 'string' && ingredientProcessingFood.trim()) {
        Foods = ingredientProcessingFood.split(/[,，;；\s]+/)
            .map(word => word.trim())
            .filter(word => word.length > 0);
    }

    let foodCount = [];
    if (typeof foodCounts === 'string' && foodCounts.trim()) {
        foodCount = foodCounts.split(/[,，;；\s]+/)
            .map(word => word.trim())
            .filter(word => word.length > 0);
    }

    // 常量定义
    const Pamon = `assets/RecognitionObject/Paimon.png`;
    const targetFoods = new Set([
        "面粉", "兽肉", "鱼肉", "神秘的肉", "黑麦粉", "奶油", "熏禽肉",
        "黄油", "火腿", "糖", "香辛料", "酸奶油", "蟹黄", "果酱",
        "奶酪", "培根", "香肠"
    ]);

    // 区域配置
    const regions = [
        { enabled: settings.ifMengde, keyword: '蒙德' },
        { enabled: settings.ifLiyue, keyword: '璃月' },
        { enabled: settings.ifDaoqi, keyword: '稻妻' },
        { enabled: settings.ifXumi, keyword: '须弥' },
        { enabled: settings.ifFengdan, keyword: '枫丹' },
        { enabled: settings.ifNata, keyword: '纳塔' },
        { enabled: settings.ifNDKL, keyword: '挪德卡莱' },
        { enabled: settings.ifMine, keyword: '自定义' }
    ];

    // 状态变量
    let currentTask = 0; // 当前任务计数器
    let firstScan, secondScan, nowStatus, earning, stovePosition;

    // ===== 2. 子函数定义部分 =====

    // 背包过期物品识别，需要在背包界面，并且是1920x1080分辨率下使用
    async function handleExpiredItems() {
        const ifGuoqi = await textOCR("物品过期", 1.5, 0, 0, 870, 280, 170, 40);
        if (ifGuoqi.found) {
            log.info("检测到过期物品，正在处理...");
            await sleep(500);
            await click(980, 750); // 点击确认按钮，关闭提示
        } else {
            log.info("未检测到过期物品");
        }
    }

    // 自动开关门
    async function autoSwitchDoor(status) {
        try {
            setGameMetrics(1920, 1080, 1);
            await genshin.returnMainUi();
            await sleep(1000);
            await keyPress("F2");
            await sleep(1000);
            let now = await textOCR("", 2, 0, 2, 270, 1000, 150, 45);
            if (now.text == status) {
                log.debug("当前状态:" + now.text + "，无需调整");
                await genshin.returnMainUi();
                return "无需调整";
            }
            await click(385, 1020);//进行权限设置
            await sleep(500);

            const wantStatus = await textOCR(status, 2, 0, 0, 270, 850, 155, 155);
            await sleep(500);
            if (wantStatus.found) {
                click(wantStatus.x + 15, wantStatus.y + 15);
            }

            await sleep(500);
            const nowStatus = await textOCR("", 2, 0, 2, 270, 1000, 150, 45);
            log.debug("当前状态：" + nowStatus.text);

            await genshin.returnMainUi();
            return now.text;
        } catch (error) {
            log.error(`调整世界权限出错: ${error.message}`);
        }
    }

    /**
    * 获取下一个0点的时间戳
    * @returns {string} 返回下一个0点的ISO格式时间字符串
    */
    function getNextMidnight() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.toISOString();
    }

    /**
    * 检查文件是否存在
    * @param {string} filePath - 要检查的文件路径
    * @returns {Promise<boolean>} 返回Promise，resolve时返回布尔值表示文件是否存在
    */
    async function checkFileExists(filePath) {
        try {
            // 尝试读取文件，如果成功则文件存在
            await file.readText(filePath);
            return true;
        } catch (e) {
            // 如果读取失败，则文件可能不存在
            return false;
        }
    }

    /**
    * 读取CD记录
    * @returns {Promise<Object>} 返回包含CD记录的对象，键为名称，值为时间戳
    */
    async function readCDRecords() {
        let records = {};

        // 使用基础方法检查文件是否存在
        const fileExists = await checkFileExists(cdRecordPath);
        if (fileExists) {
            try {
                const content = await file.readText(cdRecordPath);
                const lines = content.split('\n');

                for (const line of lines) {
                    if (line.trim()) {
                        const [name, timestamp] = line.split('::');
                        records[name] = timestamp;
                    }
                }
            } catch (e) {
                log.error(`读取CD记录失败: ${e}`);
            }
        }

        return records;
    }

    /**
    * 写入CD记录
    * @param {Object} records - 要写入的记录对象，键值对形式
    * @returns {Promise<void>} 无返回值的异步函数
    */
    async function writeCDRecords(records) {
        let content = '';

        for (const name in records) {
            content += `${name}::${records[name]}\n`;
        }

        try {
            // 尝试创建目录（如果环境支持）
            try {
                if (typeof file.mkdir === 'function') {
                    file.mkdir('record');
                }
            } catch (e) {
                // 忽略目录创建错误
            }

            await file.writeText(cdRecordPath, content);
        } catch (e) {
            log.error(`写入CD记录失败: ${e}`);
        }
    }

    /**
    * 检查路线是否可执行（CD是否已刷新）
    * @param {string} routeName - 路线名称
    * @param {Object} cdRecords - CD记录对象，键为路线名称，值为CD结束时间
    * @returns {boolean} 返回true表示路线可执行，false表示路线不可执行
    */
    function isRouteAvailable(routeName, cdRecords) {
        const now = new Date();

        // 如果记录中没有该路线，说明是第一次执行，可以执行
        if (!cdRecords[routeName]) {
            return true;
        }

        // 检查CD时间是否已过
        const cdTime = new Date(cdRecords[routeName]);
        return now >= cdTime;
    }

    // 获取背包物品信息
    async function cancanneed() {
        /**
        * 独立的背包扫描函数（魔改版）
        * @param {Object} options - 扫描选项
        * @returns {Promise<Array>} 返回物品信息数组 [{name, count}, ...]
        */
        async function scanBackpackItems(options = {}) {
            // 默认配置
            const config = {
                // 鼠标按住位置的X坐标，用于页面滚动操作
                holdX: 1050,

                // 鼠标按住位置的Y坐标，用于页面滚动操作
                holdY: 750,

                // 页面滚动距离，控制每次翻页时滑动的距离，数值越小翻页越精细但需要更多次翻页
                pageScrollDistance: 300,

                // 图像识别延迟（毫秒），在识别物品时的延迟时间，用于平衡性能和准确性
                imageDelay: 20,

                // 目标计数，设定要识别的目标数量上限
                targetCount: 9999,

                // 页面切换延迟（毫秒），在切换背包分类页面时的等待时间
                pageSwitchDelay: 100,

                // 物品识别超时时间（毫秒），单个物品识别的最大等待时间
                itemRecognitionTimeout: 300,

                // 将传入的options对象属性合并到config中，允许外部自定义配置
                ...options
            };

            // 材料分类映射表
            const materialTypeMap = {
                "锻造素材": "5",
                "怪物掉落素材": "3",
                "一般素材": "5",
                "周本素材": "3",
                "烹饪食材": "5",
                "角色突破素材": "3",
                "木材": "5",
                "宝石": "3",
                "鱼饵鱼类": "5",
                "角色天赋素材": "3",
                "武器突破素材": "3",
                "采集食物": "4",
                "料理": "4",
            };

            // 材料前位定义
            const materialPriority = {
                "养成道具": 1,
                "祝圣精华": 2,
                "锻造素材": 1,
                "怪物掉落素材": 1,
                "采集食物": 1,
                "一般素材": 2,
                "周本素材": 2,
                "料理": 2,
                "烹饪食材": 3,
                "角色突破素材": 3,
                "木材": 4,
                "宝石": 4,
                "鱼饵鱼类": 5,
                "角色天赋素材": 5,
                "武器突破素材": 6,
            };

            // 工具函数
            function basename(filePath) {
                if (!filePath || typeof filePath !== 'string') return '';
                const normalizedPath = filePath.replace(/\\/g, '/');
                const lastSlashIndex = normalizedPath.lastIndexOf('/');
                return lastSlashIndex !== -1 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
            }

            // 改进的数字替换映射表（处理OCR识别误差，特别优化了数字7的识别）
            const numberReplaceMap = {
                "O": "0", "o": "0", "Q": "0", "０": "0", "D": "0",
                "I": "1", "l": "1", "i": "1", "１": "1", "一": "1", "|": "1",
                "Z": "2", "z": "2", "２": "2", "二": "2",
                "E": "3", "e": "3", "３": "3", "三": "3", "B": "3",
                "A": "4", "a": "4", "４": "4", "F": "4",
                "S": "5", "s": "5", "５": "5", "s": "5",
                "G": "6", "b": "6", "６": "6", "g": "6",
                "T": "7", "t": "7", "７": "7", "Y": "7", "V": "7", "F": "7", "J": "7", "L": "7", "Z": "7", // 增加更多7的可能误识别字符
                "B": "8", "θ": "8", "８": "8", "&": "8",
                "g": "9", "q": "9", "９": "9", "P": "9", "p": "9",
                "O": "0", "C": "0", "U": "0"
            };

            // 核心工具函数
            var globalLatestRa = null;
            async function recognizeImage(
                recognitionObject,
                ra,
                timeout = 800,  // 适中的超时时间
                interval = 150, // 适中的检查间隔
                useNewScreenshot = false,
                iconType = null
            ) {
                let startTime = Date.now();
                globalLatestRa = ra;
                const originalRa = ra;
                let tempRa = null;

                try {
                    while (Date.now() - startTime < timeout) {
                        let currentRa;
                        if (useNewScreenshot) {
                            if (tempRa) {
                                tempRa.dispose();
                            }
                            tempRa = captureGameRegion();
                            currentRa = tempRa;
                            globalLatestRa = currentRa;
                        } else {
                            currentRa = originalRa;
                        }

                        if (currentRa) {
                            try {
                                const result = currentRa.find(recognitionObject);
                                if (result.isExist() && result.x !== 0 && result.y !== 0) {
                                    return {
                                        isDetected: true,
                                        iconType: iconType,
                                        x: result.x,
                                        y: result.y,
                                        width: result.width,
                                        height: result.height,
                                        ra: globalLatestRa,
                                        usedNewScreenshot: useNewScreenshot
                                    };
                                }
                            } catch (error) {
                                log.error(`【${iconType || '未知'}识别异常】: ${error.message}`);
                            }
                        }

                        await sleep(interval);
                    }
                } finally {
                    if (tempRa && tempRa !== globalLatestRa) {
                        tempRa.dispose();
                    }
                }

                return {
                    isDetected: false,
                    iconType: iconType,
                    x: null,
                    y: null,
                    width: null,
                    height: null,
                    ra: globalLatestRa,
                    usedNewScreenshot: useNewScreenshot
                };
            }

            // OCR识别文本，数字识别特化
            async function recognizeText(ocrRegion, timeout = 800, retryInterval = 20, maxAttempts = 8, maxFailures = 3, ra = null) {
                let startTime = Date.now();
                let retryCount = 0;
                let failureCount = 0;
                const frequencyMap = {};
                let createdRa = false;
                let localRa = ra;

                try {
                    if (!localRa) {
                        localRa = captureGameRegion();
                        createdRa = true;
                    }

                    while (Date.now() - startTime < timeout && retryCount < maxAttempts) {
                        let ocrObject = null;
                        let resList = null;

                        try {
                            ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
                            ocrObject.threshold = 0.82;

                            resList = localRa.findMulti(ocrObject);

                            if (resList.count === 0) {
                                failureCount++;
                                if (failureCount >= maxFailures) {
                                    ocrRegion.x += 2;
                                    ocrRegion.width -= 4;
                                    ocrRegion.y += 1;
                                    ocrRegion.height -= 2;
                                    retryInterval += 10;

                                    if (ocrRegion.width <= 12 || ocrRegion.height <= 12) {
                                        return false;
                                    }
                                }
                                retryCount++;
                                await sleep(retryInterval);
                                continue;
                            }

                            let resultText = null;
                            for (let res of resList) {
                                let text = res.text;
                                text = text.replace(/[TtYVJL]/g, "7");
                                text = text.split('').map(char => numberReplaceMap[char] || char).join('');
                                text = text.replace(/[^0-9]/g, "");

                                if (!frequencyMap[text]) {
                                    frequencyMap[text] = 0;
                                }
                                frequencyMap[text]++;

                                if (frequencyMap[text] >= 2 || (text.length > 0 && retryCount >= 3)) {
                                    resultText = text || "?";
                                    break;
                                }
                            }

                            // 先释放资源再返回
                            if (resultText !== null) {
                                return resultText;
                            }

                        } finally {
                            // 确保每次循环的资源都被释放
                            if (ocrObject && typeof ocrObject.dispose === 'function') {
                                ocrObject.dispose();
                            }
                            if (resList && typeof resList.dispose === 'function') {
                                resList.dispose();
                            }
                        }

                        await sleep(retryInterval);
                        retryCount++;
                    }

                    const sortedResults = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a]);
                    return sortedResults.length === 0 ? "?" : sortedResults[0];

                } finally {
                    if (createdRa && localRa && typeof localRa.dispose === 'function') {
                        localRa.dispose();
                    }
                }
            }

            // 通用鼠标拖动函数
            async function mouseDrag({
                holdMouseX,
                holdMouseY,
                totalDistance,
                stepDistance = 180, // 适中的步长
                stepInterval = 15,  // 适中的步间隔
                waitBefore = 30,   // 适中的等待时间
                waitAfter = 200,   // 适中的等待时间
                repeat = 1,
                state = { isRunning: true }
            }) {
                try {
                    if (holdMouseX !== undefined && holdMouseY !== undefined) {
                        moveMouseTo(holdMouseX, holdMouseY);
                        await sleep(waitBefore);
                    }

                    leftButtonDown();
                    await sleep(waitBefore);

                    for (let r = 0; r < repeat; r++) {
                        if (!state.isRunning) break;

                        const steps = Math.ceil(Math.abs(totalDistance) / stepDistance);
                        const direction = totalDistance > 0 ? 1 : -1;

                        for (let s = 0; s < steps; s++) {
                            if (!state.isRunning) break;
                            const remaining = Math.abs(totalDistance) - s * stepDistance;
                            const move = Math.min(stepDistance, remaining) * direction;
                            moveMouseBy(0, move);
                            await sleep(stepInterval);
                        }

                        await sleep(waitAfter);
                    }

                    await sleep(waitAfter);
                    leftButtonUp();
                    await sleep(waitBefore);
                } catch (e) {
                    log.error(`拖动出错: ${e.message}`);
                    leftButtonUp();
                }
            }

            // 滑动页面函数
            async function scrollPage(totalDistance, stepDistance = 15, delayMs = 10) {
                await mouseDrag({
                    holdMouseX: config.holdX,
                    holdMouseY: config.holdY,
                    totalDistance: totalDistance,
                    stepDistance,
                    stepInterval: delayMs,
                    waitBefore: 30,
                    waitAfter: 200,
                    repeat: 1
                });
            }

            // 获取材料优先级
            function filterMaterialsByPriority(materialsCategory) {
                const currentPriority = materialPriority[materialsCategory];
                if (currentPriority === undefined) {
                    throw new Error(`Invalid materialsCategory: ${materialsCategory}`);
                }

                const currentType = materialTypeMap[materialsCategory];
                if (currentType === undefined) {
                    throw new Error(`Invalid materialTypeMap for: ${materialsCategory}`);
                }

                const backPriorityMaterials = Object.keys(materialPriority)
                    .filter(mat => materialPriority[mat] > currentPriority && materialTypeMap[mat] === currentType);

                const finalFilteredMaterials = [...backPriorityMaterials, materialsCategory];
                return finalFilteredMaterials;
            }

            // 扫描材料 - 优化版本
            async function scanMaterials(materialsCategory, materialCategoryMap) {
                // 获取当前+后位材料名单
                const priorityMaterialNames = [];
                const finalFilteredMaterials = await filterMaterialsByPriority(materialsCategory);
                for (const category of finalFilteredMaterials) {
                    const materialIconDir = `assets/RecognitionObject/${category}`;
                    try {
                        if (file.isFolder && file.isFolder(materialIconDir)) {
                            const materialIconFilePaths = file.ReadPathSync(materialIconDir);
                            for (const filePath of materialIconFilePaths) {
                                const name = basename(filePath).replace(".png", "");
                                priorityMaterialNames.push({ category, name });
                            }
                        }
                    } catch (e) {
                        // 文件夹不存在，跳过
                        log.debug(`文件夹 ${materialIconDir} 不存在，跳过读取`);
                    }
                }

                // 根据材料分类获取对应的材料图片文件夹路径
                const materialIconDir = `assets/RecognitionObject/${materialsCategory}`;
                const materialIconFilePaths = file.ReadPathSync(materialIconDir);

                // 创建材料种类集合
                const materialCategories = [];
                const allMaterials = new Set();
                const materialRecognitionObject = {};

                // 检查 materialCategoryMap 中当前分类的数组是否为空
                const categoryMaterials = materialCategoryMap[materialsCategory] || [];
                const shouldScanAllMaterials = categoryMaterials.length === 0;

                for (const filePath of materialIconFilePaths) {
                    const name = basename(filePath).replace(".png", "");

                    if (typeof pathingMode !== 'undefined' && pathingMode.onlyPathing && !shouldScanAllMaterials && !categoryMaterials.includes(name)) {
                        continue;
                    }

                    const mat = file.readImageMatSync(filePath);
                    if (mat.empty()) {
                        log.error(`加载图标失败：${filePath}`);
                        continue;
                    }

                    materialCategories.push({ name, filePath });
                    allMaterials.add(name);
                    materialRecognitionObject[name] = mat;
                }

                // 已识别的材料集合，避免重复扫描
                const recognizedMaterials = new Set();
                const materialInfo = [];

                // 扫描参数
                const tolerance = 1;
                const startX = 117;
                const startY = 121;
                const OffsetWidth = 146.428;
                const columnWidth = 123;
                const columnHeight = 680;
                const maxColumns = 8;
                const pageScrollCount = 35;

                // 扫描状态
                let hasFoundFirstMaterial = false;
                let lastFoundTime = null;
                let shouldEndScan = false;
                let foundPriorityMaterial = false;

                // 扫描背包中的材料
                for (let scroll = 0; scroll <= pageScrollCount; scroll++) {
                    const ra = captureGameRegion();

                    if (!foundPriorityMaterial) {
                        for (const { category, name } of priorityMaterialNames) {
                            if (recognizedMaterials.has(name)) {
                                continue;
                            }

                            const filePath = `assets/RecognitionObject/${category}/${name}.png`;
                            const mat = file.readImageMatSync(filePath);
                            if (mat.empty()) {
                                log.error(`加载材料图库失败：${filePath}`);
                                continue;
                            }

                            const recognitionObject = RecognitionObject.TemplateMatch(mat, 1142, startY, columnWidth, columnHeight);
                            recognitionObject.threshold = 0.78; // 适中的阈值
                            recognitionObject.Use3Channels = true;

                            const result = ra.find(recognitionObject);
                            if (result.isExist() && result.x !== 0 && result.y !== 0) {
                                foundPriorityMaterial = true;
                                // log.info(`发现当前或后位材料: ${name}，开始全列扫描`);
                                break;
                            }
                        }
                    }

                    if (foundPriorityMaterial) {
                        for (let column = 0; column < maxColumns; column++) {
                            const scanX0 = startX + column * OffsetWidth;
                            const scanX = Math.round(scanX0);

                            for (let i = 0; i < materialCategories.length; i++) {
                                const { name } = materialCategories[i];
                                if (recognizedMaterials.has(name)) {
                                    continue;
                                }

                                const mat = materialRecognitionObject[name];
                                const recognitionObject = RecognitionObject.TemplateMatch(mat, scanX, startY, columnWidth, columnHeight);
                                recognitionObject.threshold = 0.82;
                                recognitionObject.Use3Channels = true;

                                const result = ra.find(recognitionObject);

                                if (result.isExist() && result.x !== 0 && result.y !== 0) {
                                    recognizedMaterials.add(name);
                                    moveMouseTo(result.x, result.y);

                                    const ocrRegion = {
                                        x: result.x - tolerance,
                                        y: result.y + 97 - tolerance,
                                        width: 66 + 2 * tolerance,
                                        height: 22 + 2 * tolerance
                                    };

                                    // 增加OCR识别尝试次数和时间，提高数字7识别成功率
                                    const ocrResult = await recognizeText(ocrRegion, 1000, 25, 10, 4, ra);
                                    materialInfo.push({ name, count: ocrResult || "?" });

                                    if (!hasFoundFirstMaterial) {
                                        hasFoundFirstMaterial = true;
                                        lastFoundTime = Date.now();
                                    } else {
                                        lastFoundTime = Date.now();
                                    }
                                }
                                await sleep(config.imageDelay);
                            }
                        }
                    }

                    // 检查是否结束扫描
                    if (recognizedMaterials.size === allMaterials.size) {
                        log.info("所有材料均已识别！");
                        shouldEndScan = true;
                        break;
                    }

                    if (hasFoundFirstMaterial && Date.now() - lastFoundTime > 4000) {
                        log.info("未发现新的材料，结束扫描");
                        shouldEndScan = true;
                        break;
                    }

                    // 检查是否到达最后一页
                    const sliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/SliderBottom.png"), 1284, 916, 9, 26);
                    sliderBottomRo.threshold = 0.75;
                    const sliderBottomResult = ra.find(sliderBottomRo);
                    if (sliderBottomResult.isExist()) {
                        log.info("已到达最后一页！");
                        shouldEndScan = true;
                        break;
                    }

                    // 滑动到下一页
                    if (scroll < pageScrollCount) {
                        await scrollPage(-config.pageScrollDistance, 15, 10);
                        await sleep(100); // 适中的页面切换延迟
                    }
                }

                return materialInfo;
            }

            // 动态材料分组
            function dynamicMaterialGrouping(materialCategoryMap) {
                const dynamicMaterialGroups = {};

                for (const category in materialCategoryMap) {
                    const type = materialTypeMap[category];
                    if (!dynamicMaterialGroups[type]) {
                        dynamicMaterialGroups[type] = [];
                    }
                    dynamicMaterialGroups[type].push(category);
                }

                for (const type in dynamicMaterialGroups) {
                    dynamicMaterialGroups[type].sort((a, b) => materialPriority[a] - materialPriority[b]);
                }

                const sortedGroups = Object.entries(dynamicMaterialGroups)
                    .map(([type, categories]) => ({ type: parseInt(type), categories }))
                    .sort((a, b) => a.type - b.type);

                return sortedGroups;
            }

            try {
                // 确保材料分类是数组格式
                let categories = options.materialCategories;
                if (!categories) {
                    // 如果没有指定分类，则扫描所有分类
                    categories = Object.keys(materialTypeMap);
                }
                categories = Array.isArray(categories) ? categories : [categories];

                // 创建一个materialCategoryMap
                const materialCategoryMap = {};
                categories.forEach(category => {
                    if (materialTypeMap[category]) {
                        materialCategoryMap[category] = [];
                    }
                });

                const sortedGroups = dynamicMaterialGrouping(materialCategoryMap);
                const allMaterialInfo = [];

                // 返回主界面
                await genshin.returnMainUi();
                await sleep(300);

                // 打开背包界面
                keyPress("B");
                await handleExpiredItems();
                await sleep(1500);

                let cachedFrame = captureGameRegion();
                const BagpackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Bagpack.png"), 58, 31, 38, 38);

                const backpackResult = await recognizeImage(BagpackRo, cachedFrame, 3000);

                if (!backpackResult.isDetected) {
                    log.warn("未识别到背包图标");
                    return [];
                }

                let currentGroupIndex = 0;
                let currentCategoryIndex = 0;
                let materialsCategory = "";

                while (currentGroupIndex < sortedGroups.length) {
                    const group = sortedGroups[currentGroupIndex];

                    if (currentCategoryIndex < group.categories.length) {
                        materialsCategory = group.categories[currentCategoryIndex];
                        const offset = materialTypeMap[materialsCategory];
                        const menuClickX = Math.round(575 + (offset - 1) * 96.25);
                        click(menuClickX, 75);

                        await sleep(config.pageSwitchDelay);
                        await moveMouseTo(1288, 124);

                        await sleep(config.pageSwitchDelay);

                        cachedFrame?.dispose();
                        cachedFrame = captureGameRegion();

                        // 识别材料分类
                        let CategoryObject;
                        switch (materialsCategory) {
                            case "锻造素材":
                            case "一般素材":
                            case "烹饪食材":
                            case "木材":
                            case "鱼饵鱼类":
                                CategoryObject = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Materials.png"), 941, 29, 38, 38);
                                break;
                            case "采集食物":
                            case "料理":
                                CategoryObject = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Food.png"), 845, 31, 38, 38);
                                break;
                            case "怪物掉落素材":
                            case "周本素材":
                            case "角色突破素材":
                            case "宝石":
                            case "角色天赋素材":
                            case "武器突破素材":
                                CategoryObject = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/CultivationItems.png"), 749, 30, 38, 38);
                                break;
                            default:
                                log.error("未知的材料分类");
                                currentCategoryIndex++;
                                continue;
                        }

                        await sleep(1500);

                        let CategoryResult = await recognizeImage(CategoryObject, cachedFrame, 5000);

                        if (!CategoryResult.isDetected) {
                            log.warn(`首次未识别到材料分类图标: ${materialsCategory}，重试中...`);
                            CategoryResult = await recognizeImage(CategoryObject, cachedFrame, 5000);
                            if (!CategoryResult.isDetected) {
                                log.error(`重试后仍未识别到材料分类图标: ${materialsCategory}`);
                            }
                        } else {
                            // log.info(`识别到${materialsCategory} 所在分类。`);

                            // 重置材料滑条
                            await moveMouseTo(1288, 124);
                            await sleep(50);
                            leftButtonDown();
                            await sleep(200);
                            leftButtonUp();
                            await sleep(100);

                            // 扫描材料
                            const materialInfo = await scanMaterials(materialsCategory, materialCategoryMap);
                            allMaterialInfo.push(...materialInfo);
                        }

                        currentCategoryIndex++;
                    } else {
                        currentGroupIndex++;
                        currentCategoryIndex = 0;
                    }
                }

                await genshin.returnMainUi();
                log.info("扫描流程结束");

                cachedFrame?.dispose();
                return allMaterialInfo;
            } catch (error) {
                log.error(`背包扫描出错: ${error.message}`);
                return [];
            } finally {
                await genshin.returnMainUi();
            }
        }

        // const items = await scanBackpackItems();
        // // 输出结果
        // items.forEach(item => {
        //     log.info(`物品名称: ${item.name}, 数量: ${item.count}`);
        // });

        // 扫描特定分类
        let materialCategories;
        switch (ifCheck) {
            case "查询所有收益":
                materialCategories = ["一般素材", "烹饪食材"];
                break;
            case "查询食材加工收益":
                materialCategories = ["烹饪食材"];
                break;
            default:
                materialCategories = ["一般素材", "烹饪食材"];
        }

        const items = await scanBackpackItems({
            materialCategories: materialCategories
        });

        return items;
    }

    /**
     * 快速计算物品数量差值，处理识别失败情况
     * @param {Array} scan1 第一次扫描结果
     * @param {Array} scan2 第二次扫描结果
     * @param {Array} itemNames 物品名称数组
     * @returns {Object} {物品名称: 数量差值或"识别失败"}
     */
    async function getItemDifferences(scan1, scan2, itemNames) {
        const diff = {};

        // 创建查找映射
        const createMap = (scan) => {
            const map = {};
            scan.forEach(item => {
                // 保留原始数量值，不转换为数字
                map[item.name] = item.count;
            });
            return map;
        };

        const map1 = createMap(scan1);
        const map2 = createMap(scan2);

        // 如果itemNames为空，则获取所有物品名称
        const itemsToCheck = itemNames && itemNames.length > 0
            ? itemNames
            : [...new Set([...Object.keys(map1), ...Object.keys(map2)])];

        // 计算每个物品的差值
        itemsToCheck.forEach(name => {
            const count1 = map1[name] || "0";
            const count2 = map2[name] || "0";

            // 检查是否有任意一次识别失败
            if (count1 === "?" || count2 === "?") {
                diff[name] = "识别失败";
            } else {
                // 将数量转换为数字进行计算
                const num1 = parseInt(count1) || 0;
                const num2 = parseInt(count2) || 0;
                diff[name] = num2 - num1;
            }
        });

        /**
        * 将收益数据保存到txt文件中，只保留最近七次记录
        * @param {Object} diff - 收益差异对象
        */
        async function saveEarningsToFile(diff) {
            const earningsFilePath = `record/${userName}_earnings.txt`;

            try {
                // 创建目录（如果不存在）
                try {
                    if (typeof file.mkdir === 'function') {
                        file.mkdir('record');
                    }
                } catch (e) {
                    // 忽略目录创建错误
                }

                // 读取现有记录
                let records = [];
                try {
                    const content = await file.readText(earningsFilePath);
                    if (content.trim()) {
                        records = content.trim().split('\n\n').filter(record => record.trim() !== '');
                    }
                } catch (e) {
                    // 文件不存在或读取失败，使用空数组
                }

                // 创建新记录
                const now = new Date();
                const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                let newRecord = `=== ${formattedDate} ===\n（收益结果受多因素影响，可能会不准确，本结果仅供参考）\n`;

                let hasChanges = false;
                Object.keys(diff).forEach(item => {
                    const change = diff[item];

                    if (change === "识别失败") {
                        // 记录识别失败的项目
                        newRecord += `❌ ${item}: 识别失败\n`;
                        hasChanges = true; // 确保即使只有识别失败的项目也会显示"有变化"
                    } else {
                        if (change !== 0) {
                            newRecord += `✅ ${item}: ${change > 0 ? '+' : ''}${change}\n`;
                            hasChanges = true;
                        }
                    }
                });

                if (!hasChanges) {
                    newRecord += "无收益变化\n";
                }

                newRecord += "=====================\n";

                // 添加新记录到开头
                records.unshift(newRecord);

                // 只保留最近7条记录
                if (records.length > 7) {
                    records = records.slice(0, 7);
                }

                // 写入文件
                const contentToWrite = records.join('\n\n');
                await file.writeText(earningsFilePath, contentToWrite);

                log.info(`收益已保存至 ${earningsFilePath}，共 ${records.length} 条记录`);
                log.warn("收益记录仅供参考！");

                return newRecord;
            } catch (error) {
                log.error(`保存收益记录失败: ${error.message}`);
            }
        }
        const newRecord = await saveEarningsToFile(diff);
        log.info("\n" + newRecord);
        return newRecord;
    }

    /**
    * 文字OCR识别封装函数（测试中，未封装完成，后续会优化逻辑）
    * @param text 要识别的文字，默认为"空参数"
    * @param timeout 超时时间，单位为秒，默认为10秒
    * @param afterBehavior 点击模式，0表示不点击，1表示点击识别到文字的位置，2表示输出模式，默认为0
    * @param debugmodel 调试代码，0表示输入判断模式，1表示输出位置信息，2表示输出判断模式，默认为0
    * @param x OCR识别区域的起始X坐标，默认为0
    * @param y OCR识别区域的起始Y坐标，默认为0
    * @param w OCR识别区域的宽度，默认为1920
    * @param h OCR识别区域的高度，默认为1080
    * @returns 包含识别结果的对象，包括识别的文字、坐标和是否找到的结果
    */
    async function textOCR(text = "空参数", timeout = 10, afterBehavior = 0, debugmodel = 0, x = 0, y = 0, w = 1920, h = 1080) {
        const startTime = new Date();
        var Outcheak = 0
        for (var ii = 0; ii < 10; ii++) {
            // 获取一张截图
            var captureRegion = captureGameRegion();
            var res1
            var res2
            var conuntcottimecot = 1;
            var conuntcottimecomp = 1;
            // 对整个区域进行 OCR
            var resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));
            //log.info("OCR 全区域识别结果数量 {len}", resList.count);
            if (resList.count !== 0) {
                for (let i = 0; i < resList.count; i++) { // 遍历的是 C# 的 List 对象，所以要用 count，而不是 length
                    let res = resList[i];
                    res1 = res.text
                    conuntcottimecomp++;
                    if (res.text.includes(text) && debugmodel == 3) { return result = { text: res.text, x: res.x, y: res.y, found: true }; }
                    if (res.text.includes(text) && debugmodel !== 2) {
                        conuntcottimecot++;
                        if (debugmodel === 1 & x === 0 & y === 0) { log.info("全图代码位置：({x},{y},{h},{w})", res.x - 10, res.y - 10, res.width + 10, res.Height + 10); }
                        if (afterBehavior === 1) { await sleep(1000); click(res.x, res.y); } else { if (debugmodel === 1 & x === 0 & y === 0) { log.info("点击模式:关") } }
                        if (afterBehavior === 2) { await sleep(100); keyPress("F"); } else { if (debugmodel === 1 & x === 0 & y === 0) { log.info("F模式:关"); } }
                        if (conuntcottimecot >= conuntcottimecomp / 2) { return result = { text: res.text, x: res.x, y: res.y, found: true }; } else { return result = { found: false }; }
                    }
                    if (debugmodel === 2) {
                        if (res1 === res2) { conuntcottimecot++; res2 = res1; }
                        //log.info("输出模式：全图代码位置：({x},{y},{h},{w},{string})", res.x-10, res.y-10, res.width+10, res.Height+10, res.text);
                        if (Outcheak === 1) { if (conuntcottimecot >= conuntcottimecomp / 2) { return result = { text: res.text, x: res.x, y: res.y, found: true }; } else { return result = { found: false }; } }
                    }
                }
            }
            const NowTime = new Date();
            if ((NowTime - startTime) > timeout * 1000) { if (debugmodel === 2) { if (resList.count === 0) { return result = { found: false }; } else { Outcheak = 1; ii = 2; } } else { Outcheak = 0; if (debugmodel === 1 & x === 0 & y === 0) { log.info(`${timeout}秒超时退出，"${text}"未找到`) }; return result = { found: false }; } }
            else { ii = 2; if (debugmodel === 1 & x === 0 & y === 0) { log.info(`"${text}"识别中……`); } }
            await sleep(100);
        }
    }

    /**
     * 封装函数，执行图片识别及点击操作（测试中，未封装完成，后续会优化逻辑）
     * @param {string} imagefilePath - 模板图片路径
     * @param {number} timeout - 超时时间(秒)
     * @param {number} afterBehavior - 识别后行为(0:无,1:点击,2:按F键)
     * @param {number} debugmodel - 调试模式(0:关闭,1:详细日志)
     * @param {number} xa - 识别区域X坐标
     * @param {number} ya - 识别区域Y坐标
     * @param {number} wa - 识别区域宽度
     * @param {number} ha - 识别区域高度
     * @param {boolean} clickCenter - 是否点击目标中心
     * @param {number} clickOffsetX - 点击位置X轴偏移量
     * @param {number} clickOffsetY - 点击位置Y轴偏移量
     * @param {number} tt - 匹配阈值(0-1)
     */
    async function imageRecognitionEnhanced(
        imagefilePath = "空参数",
        timeout = 10,
        afterBehavior = 0,
        debugmodel = 0,
        xa = 0,
        ya = 0,
        wa = 1920,
        ha = 1080,
        clickCenter = false,
        clickOffsetX = 0,
        clickOffsetY = 0,
        tt = 0.8
    ) {
        // 参数验证
        if (xa + wa > 1920 || ya + ha > 1080) {
            log.info("图片区域超出屏幕范围");
            return { found: false, error: "区域超出屏幕范围" };
        }

        const startTime = Date.now();
        let captureRegion = null;
        let result = { found: false };

        try {
            // 读取模板图像
            const templateImage = file.ReadImageMatSync(imagefilePath);
            if (!templateImage) {
                throw new Error("无法读取模板图像");
            }

            const Imagidentify = RecognitionObject.TemplateMatch(templateImage, true);
            if (tt !== 0.8) {
                Imagidentify.Threshold = tt;
                Imagidentify.InitTemplate();
            }

            // 循环尝试识别
            for (let attempt = 0; attempt < 10; attempt++) {
                if (Date.now() - startTime > timeout * 1000) {
                    if (debugmodel === 1) {
                        log.info(`${timeout}秒超时退出，未找到图片`);
                    }
                    break;
                }

                captureRegion = captureGameRegion();
                if (!captureRegion) {
                    await sleep(200);
                    continue;
                }

                try {
                    const croppedRegion = captureRegion.DeriveCrop(xa, ya, wa, ha);
                    const res = croppedRegion.Find(Imagidentify);

                    if (res.isEmpty()) {
                        if (debugmodel === 1) {
                            log.info("识别图片中...");
                        }
                    } else {
                        // 计算基准点击位置（目标的左上角）
                        let clickX = res.x + xa;
                        let clickY = res.y + ya;

                        // 如果要求点击中心，计算中心点坐标
                        if (clickCenter) {
                            clickX += Math.floor(res.width / 2);
                            clickY += Math.floor(res.height / 2);
                        }

                        // 应用自定义偏移量
                        clickX += clickOffsetX;
                        clickY += clickOffsetY;

                        if (debugmodel === 1) {
                            log.info("计算后点击位置：({x},{y})", clickX, clickY);
                        }

                        // 执行识别后行为
                        if (afterBehavior === 1) {
                            await sleep(1000);
                            click(clickX, clickY);
                        } else if (afterBehavior === 2) {
                            await sleep(1000);
                            keyPress("F");
                        }

                        result = {
                            x: clickX,
                            y: clickY,
                            w: res.width,
                            h: res.height,
                            found: true
                        };
                        break;
                    }
                } finally {
                    if (captureRegion) {
                        captureRegion.dispose();
                        captureRegion = null;
                    }
                }

                await sleep(200);
            }
        } catch (error) {
            log.info(`图像识别错误: ${error.message}`);
            result.error = error.message;
        }

        return result;
    }

    /**
    * 伪造日志信息的异步函数，用于模拟脚本或地图追踪任务的开始与结束日志。
    * @param {string} name - 日志中显示的任务名称（如脚本名、地图追踪文件名）
    * @param {boolean} isJs - 标识是否为 JS 脚本日志（true 表示 JS 脚本，false 表示地图追踪）
    * @param {boolean} isStart - 标识是开始还是结束日志（true 表示开始，false 表示结束）
    * @param {number} duration - 持续时间（单位：毫秒），仅在结束日志时有意义
    * 
    * 注意事项：
    * - 必须使用 await 调用此函数以避免 V8 引擎相关错误；
    * - duration 参数只在伪造“结束”日志时起作用，且主要用于日志展示；
    */
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

    /**
    * 获取JSON文件中最后一个对象的xy坐标
    * @param {string} filePath - JSON文件路径
    * @returns {Object|null} 包含x和y坐标的对象，失败时返回null
    */
    async function getLastPositionCoords(filePath) {
        try {
            // 使用异步文件读取函数
            const content = await file.readText(filePath);

            // 为了减少内存使用，在使用完content后尽快释放
            let positions;
            let lastPosition;
            let result;

            try {
                const jsonData = JSON.parse(content);

                // 检查数据结构
                if (!jsonData || typeof jsonData !== 'object') {
                    throw new Error('无效的JSON数据结构');
                }

                positions = jsonData.positions;
                if (!positions || !Array.isArray(positions) || positions.length === 0) {
                    throw new Error('positions数组为空或不存在');
                }

                // 获取最后一个点位
                lastPosition = positions[positions.length - 1];

                // 检查坐标字段
                if (typeof lastPosition.x === 'undefined' || typeof lastPosition.y === 'undefined') {
                    throw new Error('最后一个点位缺少x或y坐标');
                }

                result = {
                    x: lastPosition.x,
                    y: lastPosition.y,
                    positionId: lastPosition.id || null,
                    totalPositions: positions.length,
                    index: positions.length - 1
                };
            } finally {
                // 显式清理对象引用，帮助垃圾回收
                positions = null;
                lastPosition = null;
            }

            return result;

        } catch (error) {
            log.error(`处理文件 ${filePath} 时出错:`, error.message);
            return null;
        }
    }


    /**
    * 比较两个坐标是否近似相等
    * @param {Object} coord1 - 第一个坐标对象 {x, y}
    * @param {Object} coord2 - 第二个坐标对象 {x, y}
    * @param {number} tolerance - 容差范围，默认1.0
    * @returns {boolean} 是否近似相等
    */
    function areCoordinatesApproximate(coord1, coord2, tolerance = 1.0) {
        if (!coord1 || !coord2) return false;

        const xDiff = Math.abs(coord1.x - coord2.X);
        const yDiff = Math.abs(coord1.y - coord2.Y);

        return xDiff <= tolerance && yDiff <= tolerance;
    }

    /**
    * 路线筛选函数
    * 根据国家模式和路线名称来判断是否执行该路线
    * @param {string} fName - 路线名称
    * @param {string} countryMode - 国家模式，决定路线筛选规则
    * @returns {boolean} 返回true表示执行该路线，false表示不执行
    */
    async function routeSelection(fName, countryMode) {
        // 如果国家模式是"不运行"则不执行任何路线
        if (countryMode === "不运行") {
            return false;
        }

        switch (countryMode) {
            case "全跑模式":
                return true;

            case "高效＆螃蟹模式":
                return fName.includes("高效") || fName.includes("螃蟹");

            case "高效模式":
                return fName.includes("高效");

            case "螃蟹模式":
                return fName.includes("螃蟹");

            default:
                return false;
        }
    }

    /**
    * 异步执行一组地图追踪路线文件，根据国家模式筛选并按顺序运行符合条件的路线。
    * 包括冷却时间检查、路径执行、坐标校验、重试机制以及月卡点击等功能。
    * @param {string} filePathDir - 地图追踪文件所在的目录路径
    * @param {string} countryMode - 当前国家的运行模式（如“只运行”、“不运行”等）
    * @param {string} countryName - 国家名称，用于日志输出标识
    * @param {Object} totalCount - 总任务数对象，包含 totalKeywordCount 属性表示总关键词数量
    */
    async function runPathGroups(filePathDir, countryMode, countryName, totalCount) {
        try {
            if (countryName == "自定义") {
                await switchPartyIfNeeded(ZDYparty);
            }

            if (countryMode != "不运行") {
                log.info(`正在加载${countryName}的地图追踪文件，运行模式: ${countryMode}`);
                await sleep(150);
            }

            // 读取CD记录
            const cdRecords = await readCDRecords();
            let updatedRecords = { ...cdRecords };

            // 读取文件夹中的文件名并处理
            const filePaths = file.readPathSync(filePathDir);
            const jsonFilePaths = [];

            for (const filePath of filePaths) {
                if (filePath.endsWith('.json')) {
                    jsonFilePaths.push(filePath);
                }
            }

            //添加验证，目录为空就结束运行
            if (jsonFilePaths.length === 0) {
                throw new Error('目录中没有找到JSON文件，停止运行');//抛出异常
            }

            log.info("地图追踪文件加载完成！");
            await sleep(150);

            /**
             * 异步运行一组路线文件，依次执行路径脚本并进行相关逻辑判断与重试机制。
             * @param { string[] } files - 要执行的路线文件名数组（含路径）
             */
            async function runFiles(files) {
                // 启用自动拾取
                dispatcher.addTimer(new RealtimeTimer("AutoPick"));

                for (const fileName of files) {
                    try {
                        // 提取路线名称（不含.json后缀）
                        const fName = fileName.split('\\').pop().split('/').pop().replace('.json', '');

                        // 判断是否选择该路线执行（根据路线名和国家模式）
                        if (!await routeSelection(fName, countryMode)) {
                            continue;
                        }

                        const routeName = fName;
                        currentTask++;

                        // 检查冷却时间是否已刷新，未刷新则跳过该路线
                        if (!isRouteAvailable(routeName, cdRecords)) {
                            log.info(`路线 ${routeName} CD未刷新，跳过`);
                            continue;
                        }

                        let retryCount = 0;
                        const maxRetries = 3; // 最大重试次数，避免无限循环

                        // 循环尝试执行路径直到成功或达到最大重试次数
                        while (retryCount < maxRetries) {
                            await fakeLog(routeName, false, true, 0);
                            log.info(`当前任务：${routeName} 为第${currentTask}/${totalCount.totalKeywordCount}个`);

                            // 运行指定的路径文件
                            await pathingScript.runFile(fileName);
                            await sleep(300);

                            let position1, position2;
                            try {
                                // 获取路径结束位置坐标及当前游戏内小地图坐标
                                position1 = await getLastPositionCoords(fileName);
                                position2 = genshin.getPositionFromMap();
                            } catch (error) {
                                position2 = { X: 0, Y: 0 }
                            }
                            log.debug(`当前任务末位坐标: X=${position1.x}, Y=${position1.y}`);
                            log.debug(`当前小地图坐标: X=${position2.X}, Y=${position2.Y}`);

                            // 判断两个坐标的偏差是否在允许范围内
                            const ifDeviation = areCoordinatesApproximate(position1, position2, 25);
                            await sleep(10);

                            if (ifDeviation) {
                                // 坐标匹配，更新CD记录，并跳出重试循环
                                updatedRecords[routeName] = getNextMidnight();
                                await writeCDRecords(updatedRecords);
                                break; // 跳出重试循环，继续下一个文件
                            } else {
                                await fakeLog(routeName, false, false, 0);
                                // 坐标偏差较大，进入重试流程
                                log.info(`坐标偏差，第${retryCount + 1}次重试 ${routeName}`);
                                // 防被抓策略延迟等待
                                await exponentialBackoffRetry(preventBeingcaught, 3, 500);

                                retryCount++;

                                if (retryCount >= maxRetries) {
                                    log.info(`路线 ${routeName} 重试${maxRetries}次后仍失败，跳过`);
                                }
                            }
                        }

                        await fakeLog(routeName, false, false, 0);

                        const ifExit = checkExitTime(settings.exitTime); // 检查是否已到退出时间
                        if (!ifExit) {
                            // 计算需要等待的时间
                            const waitTime = calculateWaitTime(settings.exitTime);
                            if (waitTime > 0) {
                                log.warn(`距离退出时间还有约${Math.floor(waitTime / 1000 / 60)}分${Math.floor((waitTime / 1000) % 60)}秒`);
                                await genshin.tpToStatueOfTheSeven(); // 回神像等别被肘死了再怪作者……
                                await sleep(waitTime + 10000); // 等待时间差+10秒
                            }
                        }

                        try {
                            // 若启用月卡功能，则点击领取月卡奖励
                            if (ifMonthcard) {
                                await clickMonthcard();//月卡点击
                            } else {
                                log.debug("月卡点击功能未开启");
                            }
                        } catch (error) {
                            log.error(`月卡功能发生错误: ${error}`);
                        }

                        if (!ifExit) {
                            log.warn("已到退出时间，将退出程序");
                            await genshin.returnMainUi();
                            throw new Error("Exit time reached."); // 抛出异常
                        }

                    } catch (e) {
                        if (e.message == "A task was canceled." || e.message == "Exit time reached.") {
                            throw e; // 继续抛出错误
                        } else {
                            log.error(`处理文件 ${fileName} 时出错: ${e.message}，已跳过该路径`);
                            continue; // 继续执行下一个路径
                        }
                    }
                }

                // 关闭自动拾取，防止误触炉子
                dispatcher.ClearAllTriggers();

                // 获取炉子位置坐标并与当前位置比较，决定是否需要执行食材加工
                let position4;
                try {
                    position4 = genshin.getPositionFromMap();
                } catch (error) {
                    position4 = { X: 0, Y: 0 }
                }

                if (stovePosition && ifingredientProcessing) {
                    log.debug(`炉子坐标: X=${stovePosition.x}, Y=${stovePosition.y}`);
                    log.debug(`当前小地图坐标: X=${position4.X}, Y=${position4.Y}`);

                    const ifDeviation1 = areCoordinatesApproximate(stovePosition, position4, 15);
                    await sleep(10);

                    if (ifDeviation1) {
                        log.debug("距离上一次加工过近，不执行食材加工");
                        return;
                    }
                }

                // 执行食材加工
                await ingredientProcessing();
                await sleep(10);
            }

            // 执行地图追踪文件
            await runFiles(jsonFilePaths);
        } catch (e) {
            if (e.message == "A task was canceled." || e.message == "Exit time reached.") {
                throw e;
            }
            log.error(`路径组执行失败: ${e.message}`);
        }
    }

    /**
    * 计算距离退出时间的等待时间
    * @param {string} timeSetting - 时间设置字符串，格式为 "HH:MM" 或 "HH：MM"
    * @returns {number} 需要等待的毫秒数
    */
    function calculateWaitTime(timeSetting) {
        if (!timeSetting || !/^\d{1,2}[:：]\d{2}$/.test(timeSetting)) return 0;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();

        // 解析设置的时间（支持中英文冒号）
        const [targetHour, targetMinute] = timeSetting.split(/[:：]/).map(Number);

        // 验证时间有效性
        if (isNaN(targetHour) || isNaN(targetMinute) ||
            targetHour < 0 || targetHour > 23 ||
            targetMinute < 0 || targetMinute > 59) {
            return 0;
        }

        // 计算当前时间和目标时间的总秒数
        const currentTotalSeconds = currentHour * 3600 + currentMinute * 60 + currentSecond;
        const targetTotalSeconds = targetHour * 3600 + targetMinute * 60;

        // 计算需要等待的秒数
        let secondsToWait;
        if (currentTotalSeconds < targetTotalSeconds) {
            // 同一天内
            secondsToWait = targetTotalSeconds - currentTotalSeconds;
        } else {
            // 跨天情况（目标时间是第二天）
            secondsToWait = (24 * 3600 - currentTotalSeconds) + targetTotalSeconds;
        }

        return secondsToWait * 1000; // 转换为毫秒
    }

    /**
    * 检查当前时间是否接近禁止运行的时间点（提前10分钟停止）
    * @param {string} timeSetting - 时间设置字符串，格式为 "HH:MM" 或 "HH：MM"，如 "04:30" 或 "04：30" 表示凌晨4点30分
    * @returns {boolean} 如果当前时间距离禁止运行时间点不足10分钟返回false，否则返回true
    */
    function checkExitTime(timeSetting) {
        if (!timeSetting || !/^\d{1,2}[:：]\d{2}$/.test(timeSetting)) return true;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // 解析设置的时间（支持中英文冒号，会有小笨猪写中文冒号吗？）
        const [targetHour, targetMinute] = timeSetting.split(/[:：]/).map(Number);

        // 验证时间有效性
        if (isNaN(targetHour) || isNaN(targetMinute) ||
            targetHour < 0 || targetHour > 23 ||
            targetMinute < 0 || targetMinute > 59) {
            return true;
        }

        // 计算当前时间与目标时间的分钟差
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        const targetTotalMinutes = targetHour * 60 + targetMinute;

        // 计算距离目标时间的分钟数（考虑跨天情况）
        let minutesToTarget;
        if (currentTotalMinutes <= targetTotalMinutes) {
            // 同一天内
            minutesToTarget = targetTotalMinutes - currentTotalMinutes;
        } else {
            // 跨天情况（目标时间是第二天）
            minutesToTarget = (24 * 60 - currentTotalMinutes) + targetTotalMinutes;
        }

        // 如果距离目标时间不足10分钟，返回false表示应该退出
        if (minutesToTarget <= 10 && minutesToTarget >= 0) {
            log.warn(`当前时间 ${currentHour}:${currentMinute.toString().padStart(2, '0')} 距离禁止运行时间 ${targetHour}:${targetMinute.toString().padStart(2, '0')} 不足10分钟，脚本将退出`);
            return false;
        }

        // 如果当前时间正好在目标时间，也退出
        if (currentHour === targetHour && currentMinute === targetMinute) {
            log.warn(`当前时间 ${currentHour}:${currentMinute.toString().padStart(2, '0')} 为禁止运行时间，脚本将退出`);
            return false;
        }

        return true;
    }

    /**
    * 逃逸函数
    * 通过模拟点击操作来防止被活动捕捉，执行一系列点击动作后返回主界面
    * @returns {Promise<void>} 无返回值的异步函数
    */
    async function preventBeingcaught() {
        // 解决剧情弹出页，观景点以及其他奇奇怪怪的页面，理论上都有办法逃出。长剧情无法完全退出时，在运行下一脚本前会触发bgi剧情接管
        // 因为某些问题频繁交互的场景下无法解决
        const res1 = await imageRecognitionEnhanced(Pamon, 1.5, 0, 0, 39, 31, 38, 38);
        if (res1.found) {
            return;
        }
        for (let i = 0; i < 3; i++) {
            await click(1370, 800); // 尝试点击剧情对话位置
            await sleep(300);
            await keyPress("ESCAPE"); // 尝试点击ESC键返回主页面
            await sleep(300);
            await click(1370, 800);
            await sleep(300);
        }
        const res2 = await imageRecognitionEnhanced(Pamon, 1.5, 0, 0, 39, 31, 38, 38);
        if (res2.found) {
            return;
        } else {
            throw new Error("多次尝试未能返回主页面");
        }
    }

    /**
    * 指数退避重试函数
    * 当操作失败时，按照指数退避算法进行重试，重试间隔逐渐增加
    * @param {Function} operation - 需要执行的操作函数，应返回Promise
    * @param {number} maxRetries - 最大重试次数，默认为5次
    * @param {number} baseDelay - 基础延迟时间(毫秒)，默认为500ms
    * @returns {Promise} 返回操作函数的执行结果
    */
    async function exponentialBackoffRetry(operation, maxRetries = 5, baseDelay = 500) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                await click(975, 985); // 点击“复苏”（如果有），先排除全体阵亡的可能性
                await sleep(100);
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;

                const delay = baseDelay * Math.pow(2, i); // 指数退避
                log.info(`操作失败，${delay}ms 后进行第${i + 1}次重试`);
                await sleep(delay);
            }
        }
    }

    // 切换队伍
    async function switchPartyIfNeeded(partyName) {
        if (partyName == "null") { log.warn("未填写队伍名称，将以当前队伍执行脚本！"); return; }
        try {
            if (!await genshin.switchParty(partyName)) {
                log.info("切换队伍失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                await genshin.switchParty(partyName);
            }
        } catch {
            log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
            // notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
            await genshin.returnMainUi();
        }
    }

    // 寻路函数
    async function AutoPath(locationName) {
        try {
            let filePath = `assets/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
    }

    // 月卡点击功能
    async function clickMonthcard() {
        // 获取当前时间
        const now = new Date();

        // 计算下一个4点的时间
        let next4am = new Date(now);
        next4am.setHours(4, 0, 0, 0);
        if (now >= next4am) {
            // 如果已经过了今天4点，则取明天4点
            next4am.setDate(next4am.getDate() + 1);
        }

        // 计算距离下一个4点的毫秒数
        const diffMs = next4am - now;
        const diffMinutes = diffMs / 1000 / 60;

        // 如果距离4点小于10分钟
        if (diffMinutes < 10) {
            log.info(`距离4点还有${diffMinutes.toFixed(2)}分钟，等待领取月卡...`);

            await genshin.tpToStatueOfTheSeven();

            // 持续等待直到过了4点
            while (true) {
                const current = new Date();
                if (current >= next4am) {
                    await sleep(10000);//四点之后等十秒再点击

                    for (let i = 0; i < 5; i++) {
                        click(960, 740);
                        await sleep(100);
                    }
                    break;
                }
                await sleep(1000);
            }
            const res = await imageRecognitionEnhanced(Pamon, 1.5, 0, 0, 39, 31, 38, 38);
            if (res.found) {
                log.info("已领取月卡");
            } else {
                for (let i = 0; i < 3; i++) {
                    click(960, 740);
                    await sleep(100);
                }
                log.info("已领取月卡");
            }
        }
    }

    /**
    * 食材加工主函数，用于自动前往指定地点进行食材或料理的加工制作
    * 
    * 该函数会根据 Foods 和 foodCount 数组中的食材名称和数量，依次查找并制作对应的料理/食材
    * 支持两种类型：普通料理（需滚动查找）和调味品类食材（直接在“食材加工”界面查找）
    * 
    * @returns {Promise<void>} 无返回值，执行完所有加工流程后退出
    */
    async function ingredientProcessing() {
        if (!ifingredientProcessing) { return; }
        if (Foods.length == 0) { log.error("未选择要加工的料理/食材"); return; }
        if (Foods.length != foodCount.length) { log.error("请检查料理与对应的数量是否一致！"); return; }

        log.info(`正在前往${stove}进行食材加工`);

        await AutoPath(stove);

        const res1 = await textOCR("烹饪", 5, 0, 0, 1150, 460, 155, 155);
        if (res1.found) {
            await sleep(10);
            keyDown("VK_MENU");
            await sleep(500);
            click(res1.x + 15, res1.y + 15);
        } else {
            log.warn("烹饪按钮未找到，正在寻找……");
            let attempts = 0;
            const maxAttempts = 3;
            let foundInRetry = false;
            while (attempts < maxAttempts) {
                log.info(`第${attempts + 1}次尝试寻找烹饪按钮`);
                keyPress("W");
                const res2 = await textOCR("烹饪", 5, 0, 0, 1150, 460, 155, 155);
                if (res2.found) {
                    await sleep(10);
                    keyDown("VK_MENU");
                    await sleep(500);
                    click(res2.x + 15, res2.y + 15);
                    foundInRetry = true;
                    break;
                } else {
                    attempts++;
                    await sleep(500);
                }
            }
            if (!foundInRetry) {
                log.error("多次未找到烹饪按钮，放弃寻找");
                return;
            }
        }

        await sleep(800);
        keyUp("VK_MENU");
        await sleep(1000);

        for (let i = 0; i < Foods.length; i++) {
            if (targetFoods.has(Foods[i])) {//调味品就点到对应页面
                const res3 = await textOCR("食材加工", 1, 0, 0, 140, 30, 115, 30);
                if (!res3.found) {
                    await sleep(500);
                    click(1010, 55);
                    await sleep(500);
                }

                const res = await textOCR("全部领取", 1, 0, 0, 195, 1000, 120, 40);
                if (res.found) {
                    click(res.x, res.y);
                    await sleep(800);
                    click(960, 750);
                    await sleep(500);
                }

                const res1 = await textOCR(Foods[i], 1, 0, 3, 116, 116, 1165, 505);

                if (res1.found) {
                    log.info(`${Foods[i]}已找到`);
                    await click(res1.x + 50, res1.y - 60);
                } else {
                    await sleep(500);
                    let ra = captureGameRegion();

                    try {
                        const ocrResult = ra.findMulti(RecognitionObject.ocr(115, 115, 1150, 502));
                        const foodItems = []; // 存储找到的相关项目

                        // 收集所有包含"分钟"或"秒"的项目
                        for (let j = 0; j < ocrResult.count; ++j) {
                            if (ocrResult[j].text.endsWith("分钟") || ocrResult[j].text.endsWith("秒")) {
                                foodItems.push({
                                    index: j,
                                    x: ocrResult[j].x,
                                    y: ocrResult[j].y
                                });
                            }
                        }

                        log.debug("检查到的正在加工食材的数量：" + foodItems.length);

                        // 依次筛选这些项目
                        for (const item of foodItems) {
                            // 点击该项目
                            click(item.x, item.y);
                            await sleep(150);
                            click(item.x, item.y);
                            await sleep(800);

                            let res2 = await textOCR("", 0.5, 0, 2, 1320, 100, 150, 50);
                            log.debug("当前项目：" + res2.text);
                            log.debug(item.x + "," + item.y);
                            await sleep(1000);

                            if (res2.text === Foods[i]) {
                                ra?.dispose();
                                res1.found = true;
                                log.info(`从正在加工的食材中找到了：${Foods[i]}`);
                                break;
                            }
                        }
                        if (!res1.found) {
                            log.error(`未找到目标食材: ${Foods[i]}`);
                            ra?.dispose();
                            continue;
                        }
                    } finally {
                        ra?.dispose();
                    }
                }

                await sleep(1000);
                click(1700, 1020);// 制作
                await sleep(800);
                click(960, 460);
                await sleep(800);
                inputText(foodCount[i]);
                log.info(`尝试制作${Foods[i]} ${foodCount[i]}个`);
                log.warn("由于受到队列和背包食材数量限制，实际制作数量与上述数量可能不一致！");
                await sleep(800);
                click(1190, 755);
                await sleep(800);
            } else {
                const res3 = await textOCR("料理制作", 1, 0, 0, 140, 30, 115, 30);
                if (!res3.found) {
                    await sleep(500);
                    click(910, 55);
                    await sleep(500);
                }

                click(145, 1015);// 筛选
                await sleep(800);

                click(195, 1015);// 重置
                await sleep(800);

                click(500, 1020);// 确认筛选
                await sleep(800);

                //滚轮预操作
                await moveMouseTo(1287, 131);
                await sleep(100);
                await leftButtonDown();
                await sleep(100);
                await moveMouseTo(1287, 161);

                let YOffset = 0; // Y轴偏移量，根据需要调整
                const maxRetries = 20; // 最大重试次数
                let retries = 0; // 当前重试次数
                while (retries < maxRetries) {
                    const res2 = await textOCR(Foods[i], 1, 0, 3, 116, 116, 1165, 880);
                    if (res2.found) {
                        await leftButtonUp();
                        await sleep(500);
                        await click(res2.x + 50, res2.y - 60);
                        await sleep(1000);

                        await sleep(1000);
                        click(1700, 1020);// 制作
                        await sleep(1000);

                        await textOCR("自动烹饪", 5, 1, 0, 725, 1000, 130, 45);
                        await sleep(800);
                        click(960, 460);
                        await sleep(800);
                        inputText(foodCount[i]);
                        await sleep(800);
                        click(1190, 755);
                        await sleep(2500); // 等待烹饪完成

                        keyPress("ESCAPE")
                        await sleep(500);
                        keyPress("ESCAPE")
                        await sleep(1500);

                        break;
                    } else {
                        retries++; // 重试次数加1
                        //滚轮操作
                        YOffset += 50;
                        await sleep(500);
                        if (retries === maxRetries || 161 + YOffset > 1080) {
                            await leftButtonUp();
                            await sleep(100);
                            await moveMouseTo(1287, 131);
                            await sleep(800);
                            leftButtonClick();
                            log.error(`料理/食材：${Foods[i]} 未找到！请检查料理名称是否正确！`);
                            continue;
                        }
                        await moveMouseTo(1287, 161 + YOffset);
                        await sleep(300);
                    }
                }

            }
        }
        await genshin.returnMainUi();
    }

    /**
    * 筛选要执行的区域
    * 
    * 该函数用于读取指定路径下的文件夹，并根据 regions 配置筛选出需要执行的区域。
    * 它会检查每个 region 是否启用，并尝试在读取到的文件夹中查找匹配关键字的文件夹。
    * 最终返回一个包含路径、执行模式和关键字的对象数组。
    * 
    * @returns {Promise<Array<{path: string, mode: string, keyword: string}>>} 
    *          返回一个包含要执行区域信息的数组，每个元素包括：
    *          - path: 匹配的文件夹路径
    *          - mode: 执行模式（来自 region.enabled）
    *          - keyword: 匹配的关键字（来自 region.keyword）
    */
    async function executeRegions() {
        const executedCountries = [];
        try {
            // log.debug(`尝试读取路径: ${filePath}`);

            // 读取assets目录下的所有文件夹
            let allPaths = [];
            try {
                const res = file.readPathSync(filePath);
                const result = Array.from(res);
                // log.debug(`readPathSync 返回类型: ${typeof result}`);
                // log.debug(`readPathSync 返回内容: ${JSON.stringify(result)}`);

                allPaths = Array.isArray(result) ? result : [];
            } catch (e) {
                log.error("无法读取assets目录: " + e.message);
                return;
            }

            // log.debug(`解析后的路径数组长度: ${allPaths.length}`);
            // log.debug(`路径数组内容: ${JSON.stringify(allPaths)}`);

            // 过滤出有效的文件夹
            const folders = [];
            for (const path of allPaths) {
                if (typeof path !== 'string') {
                    log.debug(`跳过非字符串路径: ${typeof path} = ${path}`);
                    continue;
                }

                // log.debug(`检查路径: ${path}`);
                try {
                    let isFolder = file.isFolder(path);

                    if (isFolder) {
                        folders.push(path);
                        // log.debug(`识别为有效文件夹: ${path}`);
                    } else {
                        log.debug(`路径不是有效文件夹: ${path}`);
                    }
                } catch (e) {
                    log.debug(`无法读取路径 ${path}: ${e.message}`);
                    // 忽略无法读取的路径
                }
            }

            log.debug("读取到的所有文件夹: " + JSON.stringify(folders));

            // 创建文件夹数组副本，用于后续比对
            let remainingFolders = [...folders];

            // 筛选启用的区域
            for (const region of regions) {
                if (!region.enabled) {
                    region.enabled = "不采集";
                }
                if (region.enabled != "不采集") {
                    let targetFolderIndex = -1;
                    let targetFolder = null;

                    // 在剩余的文件夹中查找匹配项
                    targetFolderIndex = remainingFolders.findIndex(folder => {
                        if (typeof folder !== 'string') return false;

                        // 获取文件夹名称
                        const pathParts = folder.split(/[\/\\]/); // 同时支持正斜杠和反斜杠
                        const folderName = pathParts[pathParts.length - 1].toLowerCase();

                        // log.debug(`检查文件夹: ${folderName}, 关键字: ${region.keyword.toLowerCase()}`);

                        return folderName.includes(region.keyword.toLowerCase());
                    });

                    if (targetFolderIndex !== -1) {
                        targetFolder = remainingFolders[targetFolderIndex];

                        // 从剩余文件夹数组中移除已匹配的文件夹，减轻后续比对压力
                        remainingFolders.splice(targetFolderIndex, 1);

                        executedCountries.push({
                            path: targetFolder,
                            mode: region.enabled,
                            keyword: region.keyword
                        });
                    } else {
                        log.warn(`未找到包含"${region.keyword}"的文件夹`);
                    }
                }
            }
        } catch (error) {
            log.error(`读取文件夹时发生错误: ${error.message}`);
        }
        return executedCountries;
    }

    /**
    * 统计指定区域目录中JSON文件的数量以及包含关键词的JSON文件数量
    * @param {Array} executeRegions - 区域数组，每个区域对象应包含path属性表示目录路径
    * @param {Array} keywords - 关键词数组，用于筛选文件名中包含特定关键词的JSON文件
    * @returns {Object} 统计结果对象，包含总JSON文件数、总关键词匹配数以及各区域详细统计信息
    */
    function countJsonFiles(executeRegions) {
        const results = {
            totalKeywordCount: 0,
            regions: []
        };

        executeRegions.forEach(region => {
            const folderPath = region.path;
            let keywordCount = 0;

            let keywords;
            switch (region.mode) {
                case "高效＆螃蟹模式":
                    keywords = ['螃蟹', '高效'];
                    break;
                case "不采集":
                    return; // 在 forEach 中跳过当前区域
                case "全跑模式":
                    keywords = [];
                    break;
                case "螃蟹模式":
                    keywords = ['螃蟹'];
                    break;
                case "高效模式":
                    keywords = ['高效'];
                    break;
                default:
                    // 处理其他未知模式，可以设置为空数组或默认值
                    keywords = [region.mode]; // 或者根据需求调整
                    break;
            }

            try {
                // 使用 readPathSync 读取目录内容
                const items = file.readPathSync(folderPath);

                for (const item of items) {
                    // 检查是否为 JSON 文件
                    if (item.endsWith('.json')) {
                        // 提取纯文件名（不含路径和扩展名）
                        const fileName = item.split('\\').pop().split('/').pop().replace('.json', '');

                        // 检查是否满足关键词条件
                        if (keywords.length === 0 || keywords.some(keyword => fileName.includes(keyword))) {
                            keywordCount++;
                        }
                    }
                }
            } catch (error) {
                log.warn(`无法读取目录 ${folderPath}:`, error.message);
            }

            // 更新统计结果
            results.totalKeywordCount += keywordCount; // 总关键词匹配数

            results.regions.push({ // 区域统计结果
                path: folderPath,
                keywordCount
            });
        });

        return results;
    }

    // ===== 3. 主函数执行部分 =====

    try {
        //伪造js开始记录
        await fakeLog("AotoTeyvatFoodOneDragon", true, true, 0);

        // 初始化游戏设置
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();

        await switchPartyIfNeeded(CaiJiPartyName);

        // 获取炉子位置
        if (ifingredientProcessing) {
            try {
                stovePosition = await getLastPositionCoords(`assets/${stove}.json`);
            } catch (error) {
                log.warn(`获取炉子坐标失败: ${error.message}`);
                stovePosition = null;
            }
        }

        const countrys = await executeRegions(); // 筛选要运行的国家
        const jsonCount = countJsonFiles(countrys); // 统计JSON文件数

        if (ifCheck != "不查询收益") {
            nowStatus = await autoSwitchDoor("不允许加入");
            firstScan = await cancanneed();
        }

        for (const country of countrys) {
            await runPathGroups(country.path, country.mode, country.keyword, jsonCount);
            await sleep(10);
        }

        //执行完毕返回主页面
        await genshin.returnMainUi();
        log.info("地图追踪文件执行完毕！");

        // 收益查询后处理
        if (ifCheck !== "不查询收益") {
            secondScan = await cancanneed();

            // 根据查询类型确定要检查的物品列表
            let itemsToCheck = [];
            if (ifCheck === "查询所有收益") {
                itemsToCheck = [];
            } else if (ifCheck === "查询食材加工收益") {
                itemsToCheck = Foods;
            }

            earning = await getItemDifferences(firstScan, secondScan, itemsToCheck);

            if (nowStatus != "无需调整") { await autoSwitchDoor(nowStatus); }
        }

        if (ifendTosafe) {
            log.info("正在前往指定的七天神像……");
            await genshin.tpToStatueOfTheSeven();
        } else {
            log.debug("未开启返回七天神像功能，不返回七天神像！");
        }
        log.info("终于跑完了！下班下班！！我要吃桃子🍑！！！");

        //伪造js结束记录
        await fakeLog("AotoTeyvatFoodOneDragon", true, false, 0);

        if (settings.notify) {
            notification.Send("AotoTeyvatFoodOneDragon运行结束\n" + earning);
        }
    } catch (error) {
        // 伪造错误结束记录
        await fakeLog("AotoTeyvatFoodOneDragon", true, false, 0);

        if (error.message != "Exit time reached.") {
            notification.error("任务中断：" + error.message);
        }

        log.error("任务中断：" + error.message);
        return;
    }
})();