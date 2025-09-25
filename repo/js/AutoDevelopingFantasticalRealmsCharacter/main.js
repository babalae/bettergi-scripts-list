(async function () {
    // === 模块加载区域（顶层执行，BGI要求） ===
    eval(file.readTextSync("lib/AutoFontaineLeyLine/AutoFontaineLeyLine.js"));
    eval(file.readTextSync("lib/AutoCultivation/AutoCultivation.js"));
    eval(file.readTextSync("lib/AutoDomain/AutoDomain.js"));

    // 定义替换映射表
    const replacementMap1 = {
        "监": "盐",
        "卵": "卯"
    };
    const replacementMap2 = [
        {
            "chineseOnly": "冰风组曲歌裴莉娅",
            "original": "冰风组曲-歌裴莉娅的葬送"
        },
        {
            "chineseOnly": "冰风组曲科培琉司",
            "original": "冰风组曲-科培琉司的劫罚"
        },
        {
            "chineseOnly": "秘源机兵统御械",
            "original": "秘源机兵·统御械"
        },
        {
            "chineseOnly": "秘源机兵构型械",
            "original": "秘源机兵·构型械"
        }
    ];

    let CarryoutTask = [
        {
            isMoraLeylineFlower: false,
            isExpBookLeylineFlower: false
        },
        {
            character: null,
            requiredSpecialtyMaterialName: "",//所需特产材料名称
            requiredSpecialtyMaterialCount: 0, //所需特产材料数量
            requiredSpecialtyMaterialArea: "",//所需材料区域
            requiredBossMaterialBossName: "无", //所需boss材料的BOSS名称
            requiredBossMaterialCount: 0,     //所需boss材料数量
            requiredTalentBookName: "无",       //所需天赋书名称
            requiredTalentBookCount: "",       //所需天赋书数量
            requiredMonsterName: ""           //所需（击败）怪物名称
        },
        {
            character: null,
            requiredSpecialtyMaterialName: "",//所需特产材料名称
            requiredSpecialtyMaterialCount: 0, //所需特产材料数量
            requiredSpecialtyMaterialArea: "",//所需材料区域
            requiredBossMaterialBossName: "无", //所需boss材料的BOSS名称
            requiredBossMaterialCount: 0,     //所需boss材料数量
            requiredTalentBookName: "无",       //所需天赋书名称
            requiredTalentBookCount: "",       //所需天赋书数量
            requiredMonsterName: ""           //所需（击败）怪物名称
        }
    ];

    // 非快速配对模式
    // 使用file.ReadTextSync（BGI文件API）从combat_avatar.json加载角色别名。
    // 别名将替代名称映射到标准角色名称，以支持灵活输入。

    // 从combat_avatar.json读取角色别名。
    // @returns {Object} 别名到标准角色名称的映射。
    var aliases;
    async function readAliases() {
        const combatText = file.ReadTextSync('combat_avatar.json'); // 使用BGI文件API同步读取JSON文件。
        const combatData = JSON.parse(combatText); // 解析JSON为对象。
        const aliasesS = {};
        for (const character of combatData) {
            if (character.alias && character.name) {
                // 将每个别名映射到标准角色名称。
                for (const alias of character.alias) {
                    aliasesS[alias] = character.name;
                }
            }
        }
        return aliasesS; // 返回别名映射。
    }
    aliases = await readAliases(); // IIFE主流程最开始赋值

    /**
     * 过滤指定文件夹路径，提取匹配的路径列表
     * @param {string[]} txtLines - 从文件中读取的路径行数组
     * @param {string} targetPath - 目标文件夹路径
     * @returns {string[]} 匹配目标路径的路径列表
     * @throws {Error} 如果输入参数无效，抛出异常
     * @description 
     *   - 将目标路径和输入路径统一转换为正斜杠格式以支持跨平台。
     *   - 使用正则表达式匹配以目标路径开头的行，确保路径后是分隔符或文件。
     *   - 跳过空行，忽略前后空白字符。
     *   - 用于筛选特定文件夹下的文件路径，例如怪物或特产材料路径。
     */
    function filterPathsByFolder(txtLines, targetPath) {
        // 用于转义正则表达式中的特殊字符
        function escapeRegExp(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        // 将目标路径中的反斜杠统一转换为正斜杠，便于跨平台匹配
        const normalizedTarget = targetPath.replace(/\\/g, '/');
        // 存储符合条件的路径
        const matchedPaths = [];

        for (const line of txtLines) {
            // 去除每行的前后空白字符
            const trimmedLine = line.trim();
            if (!trimmedLine) continue; // 跳过空行

            // 将当前行的路径转换为统一格式（正斜杠）
            const normalizedLine = trimmedLine.replace(/\\/g, '/');

            // 检查当前路径是否以目标路径开头，且后面是分隔符或文件
            // 使用正则表达式确保路径匹配的精确性
            const regex = new RegExp(`^${escapeRegExp(normalizedTarget)}(\\/|\\\\|$)`);
            if (regex.test(normalizedLine)) {
                matchedPaths.push(trimmedLine);
            }
        }
        return matchedPaths;
    }
    /**
         * 异步读取文本文件并将其内容分割为行数组
         * @param {string} path - 文件路径
         * @returns {Promise<string[]>} 文件内容按行分割的数组，失败时返回空数组
         * @throws {Error} 如果文件读取失败，记录错误日志
         * @description 
         *   - 使用 BGI 文件 API 异步读取指定路径的文本文件。
         *   - 将文件内容按换行符（支持 \r\n 和 \n）分割为数组。
         *   - 捕获读取错误并记录日志，返回空数组以确保程序继续运行。
         */
    async function readTxtToArray(path) {
        try {
            // 读取文件
            let content = await file.readText(path);
            const strNums = content.split(/\r?\n/);
            return strNums;
        } catch (error) {
            log.error(`操作失败: ${error}`);
            return [];
        }
    }


    /**
     * 检查指定路径是否存在
     * @param {string} path - 要检查的路径
     * @returns {boolean} 路径存在返回 true，否则返回 false
     * @description 
     *   - 使用 BGI 文件 API 同步读取路径内容，判断路径是否存在。
     *   - 如果读取失败（例如路径不存在），返回 false。
     *   - 用于验证文件或文件夹的有效性。
     */
    function pathExists(path) {
        try {
            const entries = file.readPathSync(path); // 尝试读取路径内容
            return entries !== undefined && entries.length >= 0;
        } catch (error) {
            return false; // 如果读取失败，返回 false
        }
    }

    /**
     * 从 JSON 文件同步读取数据
     * @param {string} filePath - JSON 文件路径（固定为 'ProcessData.json'）
     * @returns {Object|null} 解析后的 JSON 数据，失败时返回 null
     * @throws {Error} 如果文件读取或 JSON 解析失败，记录错误日志
     * @description 
     *   - 使用 BGI 文件 API 同步读取 'ProcessData.json' 文件。
     *   - 解析文件内容为 JavaScript 对象。
     *   - 捕获文件读取或解析错误，记录日志并返回 null。
     */
    function readJsonFile() {
        try {
            const combatText = file.ReadTextSync('ProcessData.json');
            const combatData = JSON.parse(combatText);
            return combatData;
        } catch (error) {
            console.error('读取JSON文件失败:', error.message);
            return null;
        }
    }
    /**
     * 将数据写入 JSON 文件
     * @param {Object} data - 要写入的 JavaScript 对象
     * @returns {boolean} 写入操作是否成功
     * @throws {Error} 如果文件写入或 JSON 序列化失败，记录错误日志
     * @description 
     *   - 将输入数据序列化为格式化的 JSON 字符串（缩进 2 个空格）。
     *   - 使用 BGI 文件 API 同步写入 'ProcessData.json' 文件。
     *   - 记录写入成功或失败的日志。
     */
    function writeJsonFile(data) {
        try {
            // 将数据转换为JSON字符串，缩进2个空格便于阅读
            const jsonData = JSON.stringify(data, null, 2);
            const result = file.writeTextSync("ProcessData.json", jsonData);
            if (result) {
                log.info(`成功写入JSON文件: ProcessData.json`);
            } else {
                log.error('写入JSON文件失败:');
            }
        } catch (error) {
            log.error('写入JSON文件失败:', error.message);
        }
    }

    /**
     * 在指定区域绘制红框并在指定延时后清除
     * @param {Object} region - 包含 X, Y, WIDTH, HEIGHT 的区域对象
     * @param {number} delay - 延时时间（毫秒）
     * @returns {Promise<void>} 无返回值
     * @description 
     *   - 使用 BGI API 在指定区域绘制红框以进行调试或可视化。
     *   - 在指定延时后清除红框并释放资源。
     *   - 确保 drawRegion 对象被正确释放以避免内存泄漏。
     */
    async function drawAndClearRedBox(result, delay) {
        // 绘制红框
        let drawRegion = captureGameRegion().DeriveCrop(result.X, result.X, result.WIDTH, result.HEIGHT).DrawSelf("icon");

        // 延时
        await sleep(delay);

        // 清除红框
        if (drawRegion) {
            drawRegion = captureGameRegion().DeriveCrop(0, 0, 0, 0).DrawSelf("icon");
            drawRegion = null; // 释放对象
        }
    }

    /**
     * 对多个区域进行同步 OCR 识别
     * @param {Object[]} regions - 包含 X, Y, WIDTH, HEIGHT 的区域对象数组
     * @param {number} [times=5] - 每个区域的最大重试次数
     * @param {number} [interval=20] - 每次重试的间隔时间（毫秒）
     * @returns {string[]} 每个区域的识别结果数组
     * @throws {Error} 如果 regions 参数不是非空数组，抛出异常
     * @description 
     *   - 对多个区域进行同步 OCR 识别，尝试直到成功或达到最大重试次数。
     *   - 使用 replacementMap1 替换错误字符，移除非中文字符。
     *   - 优化性能通过单次截图处理所有区域。
     *   - 记录每次识别的日志，捕获并记录异常。
     */
    function performMultiOCRSync(regions, times = 5, interval = 20) {
        if (!Array.isArray(regions) || regions.length === 0) {
            throw new Error("regions 参数必须是数组且不能为空");
        }

        let results = new Array(regions.length).fill("");        // 存储最终结果
        let attempts = new Array(regions.length).fill(0);        // 每个区域已尝试次数

        // 循环直到所有区域识别完成 或者超出最大尝试次数
        while (attempts.some((cnt, idx) => cnt < times && !results[idx])) {
            try {
                // 一次截图
                const snapshot = captureGameRegion();

                regions.forEach((region, idx) => {
                    if (results[idx]) return; // 已识别成功则跳过
                    if (attempts[idx] >= times) return; // 超过最大次数也跳过

                    attempts[idx]++;

                    try {
                        const regionObj = RecognitionObject.ocr(region.X, region.Y, region.WIDTH, region.HEIGHT);
                        const found = snapshot.find(regionObj);

                        if (found) {
                            //found.DrawSelf("debug");
                            let text = (typeof found.text === "string") ? found.text : "";

                            //log.info(`区域${idx} 尝试 ${attempts[idx]}: ${text}`);

                            if (text.trim()) {
                                for (let [wrongChar, correctChar] of Object.entries(replacementMap1)) {
                                    text = text.replace(new RegExp(wrongChar, "g"), correctChar);
                                }
                                const nonChineseRegex = /[^\u4e00-\u9fa5]/g;
                                results[idx] = text.replace(nonChineseRegex, "");
                            }
                        }
                    } catch (innerErr) {
                        log.error(`区域${idx} 识别失败: ${innerErr.message}`);
                    }
                });
            } catch (e) {
                log.error(`captureGameRegion 出错: ${e.message}`);
            }

            // 同步等待，避免截屏太频繁
            const start = Date.now();
            while (Date.now() - start < interval) { }
        }

        return results;
    }

    /**
     * 异步 OCR 识别指定区域的文本
     * @param {Object} region - 包含 X, Y, WIDTH, HEIGHT 的区域对象
     * @param {number} [interval=20] - 每次重试的间隔时间（毫秒）
     * @param {number} [times=3] - 最大重试次数
     * @returns {Promise<string>} 识别到的中文文本，失败时返回空字符串
     * @throws {Error} 如果 region 参数无效或 interval/times 参数无效，抛出异常
     * @description 
     *   - 使用 BGI OCR API 识别指定区域的文本。
     *   - 应用 replacementMap1 替换错误字符，移除非中文字符。
     *   - 重试指定次数直到识别到有效文本或达到最大重试次数。
     *   - 记录每次识别的日志，捕获并记录异常。
     */
    async function performOCR(region, interval = 20, times = 3) {
        if (!region || typeof region.X !== 'number') throw new Error('无效的识别区域参数');
        if (typeof interval !== 'number' || interval <= 0) throw new Error('无效的识别间隔时间');
        if (typeof times !== 'number' || times <= 0) throw new Error('无效的识别次数');

        let result = "";
        let attempt = 0;

        while (attempt < times) {
            attempt++;
            try {
                const regionObj = RecognitionObject.ocr(region.X, region.Y, region.WIDTH, region.HEIGHT);
                const found = captureGameRegion().find(regionObj);

                let text = '';
                if (found) {
                    // 在对象仍然有效时立刻调用
                    //await drawAndClearRedBox(region, interval);
                    text = (typeof found.text === "string") ? found.text : "";
                }

                //log.info(`识别尝试 ${attempt}: ${text}`);

                if (text.trim()) {
                    for (let [wrongChar, correctChar] of Object.entries(replacementMap1)) {
                        text = text.replace(new RegExp(wrongChar, 'g'), correctChar);
                    }
                    // 正则表达式：匹配所有非中文字符（\u4e00-\u9fa5 为中文字符范围）
                    const nonChineseRegex = /[^\u4e00-\u9fa5]/g;
                    // 将非中文字符替换为空字符串，保留中文字符
                    result = text.replace(nonChineseRegex, '');
                    return result;
                }
            } catch (e) {
                log.error(`OCR识别尝试 ${attempt} 失败: ${e.message}`);
            }
            await sleep(interval);
        }
        return result;
    }

    /**
    * 同步 OCR 识别并处理 5x4 网格区域，寻找符合条件的数字并执行点击
    * @param {Object} region - 包含 X, Y, WIDTH, HEIGHT 的区域对象，表示整体网格区域
    * @param {number} targetNumber - 目标数字，用于比较识别到的数字
    * @param {number} [retries=5] - 每个格子的最大重试次数
    * @param {number} [interval=20] - 每次重试的间隔时间（毫秒）
    * @returns {Promise<string>} 符合条件的格子文本，失败时返回空字符串
    * @throws {Error} 如果参数无效，抛出异常
    */
    async function syncOCR(region, targetNumber, retries = 5, interval = 20) {
        //log.info('开始执行syncOCR函数');
        //log.info(`传入参数: 区域=${JSON.stringify(region)}, 目标数字=${targetNumber}, 重试次数=${retries}, 间隔=${interval}ms`);

        // 参数校验
        if (!region || typeof region.X !== 'number' || typeof region.Y !== 'number' ||
            typeof region.WIDTH !== 'number' || typeof region.HEIGHT !== 'number') {
            log.error('无效的识别区域参数，抛出异常');
            throw new Error('无效的识别区域参数');
        }
        if (typeof targetNumber !== 'number') {
            log.error('无效的目标数字，抛出异常');
            throw new Error('无效的目标数字');
        }
        if (typeof retries !== 'number' || retries <= 0) {
            log.error('无效的识别重试次数，抛出异常');
            throw new Error('无效的识别重试次数');
        }
        if (typeof interval !== 'number' || interval <= 0) {
            log.error('无效的识别间隔时间，抛出异常');
            throw new Error('无效的识别间隔时间');
        }

        // 将识别区域划分为5行4列
        const rows = 5;
        const cols = 4;
        const cellWidth = region.WIDTH / cols;
        const cellHeight = region.HEIGHT / rows;
        //log.info(`网格划分: ${rows}行${cols}列，每个格子宽=${cellWidth.toFixed(2)}, 高=${cellHeight.toFixed(2)}`);

        // “培养中”检查区域
        const checkRegion = { X: 1647, Y: 123, WIDTH: 61, HEIGHT: 127 };
        //log.info(`培养中检查区域: ${JSON.stringify(checkRegion)}`);

        // 遍历所有格子
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                //log.info(`开始处理第${row + 1}行，第${col + 1}列的格子`);

                const cellRegion = {
                    X: region.X + col * cellWidth,
                    Y: region.Y + row * cellHeight,
                    WIDTH: cellWidth,
                    HEIGHT: cellHeight
                };
                //log.info(`当前格子区域: ${JSON.stringify(cellRegion)}`);

                let attempt = 0;
                let text = '';

                // 识别当前格子
                while (attempt < retries) {
                    attempt++;
                    //log.info(`第${attempt}/${retries}次尝试识别当前格子`);

                    try {
                        const regionObj = RecognitionObject.ocr(cellRegion.X, cellRegion.Y, cellRegion.WIDTH, cellRegion.HEIGHT);
                        const found = captureGameRegion().find(regionObj);

                        if (found && typeof found.text === "string") {
                            text = found.text.trim();
                            //log.info(`识别到文本: "${text}"`);
                        } else {
                            log.error('未识别到有效文本');
                        }

                        if (text) {
                            // 替换非数字字符（只保留数字）
                            const nonNumberRegex = /[^0-9]/g;
                            const cleanedText = text.replace(nonNumberRegex, '');
                            //log.info(`清理后文本: "${cleanedText}"`);
                            text = cleanedText;

                            // 提取数字
                            const numbers = text.match(/\d+/g);
                            if (numbers) {
                                const number = parseInt(numbers[0], 10);
                                //log.info(`提取到数字: ${number}，与目标值${targetNumber}比较`);

                                if (number < targetNumber) {
                                    //log.info(`数字${number}小于目标值${targetNumber}，准备点击格子中心`);
                                    // 执行点击
                                    const clickX = Math.floor(cellRegion.X + cellWidth / 2);
                                    const clickY = Math.floor(cellRegion.Y + cellHeight / 2);
                                    //log.info(`点击坐标: (${clickX.toFixed(2)}, ${clickY.toFixed(2)})`);
                                    await click(clickX, clickY);
                                    await sleep(500);

                                    // 检查“培养中”区域
                                    let checkAttempt = 0;
                                    while (checkAttempt < 2) {
                                        checkAttempt++;
                                        //log.info(`第${checkAttempt}/2次检查培养中区域`);

                                        try {
                                            const checkRegionObj = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/培养中.png`), 1652, 119, 87, 32);
                                            const checkFound = await recognizeImage(checkRegionObj);
                                            const arr = settings.autoFosterBlacklist.split('/')
                                            if (!checkFound.success){
                                                await sleep(300);
                                                const result = await performOCR({ X: 775, Y: 120, WIDTH: 250, HEIGHT: 50 });
                                                if(!!result && arr.includes(result)){
                                                    log.info(`当前角色:${result}在黑名单中，跳过当前角色`);
                                                    break; // 成功识别，退出检查循环
                                                }
                                                //log.info(`培养中区域识别结果不是"培养中"，`);
                                                return text;
                                            }else{
                                                //log.info(`培养中区域识别结果是"培养中"，跳过当前角色`);
                                                log.info(`当前角色在培养中，跳过当前角色`);
                                                break; // 成功识别，退出检查循环
                                            }
                                        } catch (e) {
                                            log.error(`“培养中”区域识别尝试 ${checkAttempt} 失败: ${e.message}`);
                                        }
                                        await sleep(interval);
                                    }
                                    break; // 跳出当前格子的重试循环
                                }
                            } else {
                                log.error('未从识别文本中提取到数字');
                            }
                            break; // 有文本但不符合数字条件，跳到下一个格子
                        }
                    } catch (e) {
                        log.error(`OCR识别尝试 ${attempt} 失败: ${e.message}`);
                    }
                    await sleep(interval);
                }
            }
        }

        //log.info('所有格子处理完毕，未找到符合条件的结果，返回空字符串');
        log.info('未找到符合条件的角色，返回');
        return '';
    }

    /**
     * 模拟鼠标拖动以滚动页面
     * @param {number} totalDistance - 总滚动距离（正值向上，负值向下）
     * @param {number} [x=396] - 鼠标起始 X 坐标
     * @param {number} [y=963] - 鼠标起始 Y 坐标
     * @param {number} [stepDistance=10] - 每步滚动距离（像素）
     * @param {number} [delayMs=5] - 每步之间的延时（毫秒）
     * @returns {Promise<void>} 无返回值
     * @description 
     *   - 使用 BGI 鼠标 API 模拟鼠标拖动以滚动页面（如角色选择界面）。
     *   - 分步移动鼠标以实现平滑滚动，控制每步距离和延时。
     *   - 在滚动前后添加等待以确保界面稳定。
     *   - 适用于
    */
    async function scrollPage(totalDistance, x = 396, y = 963, stepDistance = 10, delayMs = 5) {
        moveMouseTo(x, y); // 移动鼠标到安全起始点以进行滚动（BGI鼠标API）。
        await sleep(50); // 短暂等待以确保鼠标移动完成。
        leftButtonDown(); // 按下并保持左键以开始拖动。
        const steps = Math.ceil(totalDistance / stepDistance); // 计算步数。
        for (let j = 0; j < steps; j++) {
            const remainingDistance = totalDistance - j * stepDistance;
            const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
            moveMouseBy(0, -moveDistance); // 向上移动鼠标（负Y方向）以滚动。
            await sleep(delayMs); // 每步之间短暂延时以确保平滑滚动。
        }
        await sleep(700); // 等待0.7秒以确保界面更新。
        leftButtonUp(); // 释放左键。
        await sleep(300); // 最后等待以确保界面稳定。
    }

    /**
     * 在角色选择界面查找并点击指定角色
     * @param {string[]} CharacterName - 要查找的角色名称数组
     * @returns {Promise<string[]>} 成功选择的角色名称数组
     * @throws {Error} 如果未签署霸王条款或角色名称未提供，抛出异常
     * @description 
     *   - 从 combat_avatar.json 读取角色别名并映射到标准名称。
     *   - 通过图像模板匹配和 OCR 查找角色，滚动页面以搜索更多角色。
     *   - 点击找到的角色并验证选择结果，处理未找到的情况。
     *   - 记录详细日志以便调试，清除队伍缓存以重置状态。
     */
    async function findClickOrScroll(CharacterName) {
        // 定义替换映射表
        const replacementMap = {
            "监": "盐",
            "卵": "卯"
        };
        let characterArray = []; // 存储成功选择的角色名称
        // 非快速配对模式
        // 使用file.ReadTextSync（BGI文件API）从combat_avatar.json加载角色别名。
        // 别名将替代名称映射到标准角色名称，以支持灵活输入。

        // 从combat_avatar.json读取角色别名。
        // @returns {Object} 别名到标准角色名称的映射。
        async function readAliases() {
            const combatText = file.ReadTextSync('combat_avatar.json'); // 使用BGI文件API同步读取JSON文件。
            const combatData = JSON.parse(combatText); // 解析JSON为对象。
            const aliasesS = {};
            for (const character of combatData) {
                if (character.alias && character.name) {
                    // 将每个别名映射到标准角色名称。
                    for (const alias of character.alias) {
                        aliasesS[alias] = character.name;
                    }
                }
            }
            return aliasesS; // 返回别名映射。
        }
        const aliases = await readAliases();
        // 滚动页面函数，模拟鼠标拖动以滚动角色选择界面。
        // @param {number} totalDistance - 总滚动距离（正值向上，负值向下）。
        // @param {number} stepDistance - 每步滚动距离（默认10像素）。
        // @param {number} delayMs - 每步之间的延时（默认5毫秒）。
        async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
            moveMouseTo(396, 963); // 移动鼠标到安全起始点以进行滚动（BGI鼠标API）。
            await sleep(50); // 短暂等待以确保鼠标移动完成。
            leftButtonDown(); // 按下并保持左键以开始拖动。
            const steps = Math.ceil(totalDistance / stepDistance); // 计算步数。
            for (let j = 0; j < steps; j++) {
                const remainingDistance = totalDistance - j * stepDistance;
                const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
                moveMouseBy(0, -moveDistance); // 向上移动鼠标（负Y方向）以滚动。
                await sleep(delayMs); // 每步之间短暂延时以确保平滑滚动。
            }
            await sleep(700); // 等待0.7秒以确保界面更新。
            leftButtonUp(); // 释放左键。
            await sleep(300); // 最后等待以确保界面稳定。
        }
        // 如果存在别名则使用别名，否则使用原始输入名称。
        // 记录映射以便调试，空或无效输入返回null。
        const positionSettings = CharacterName.map(input => {
            if (input && input.trim() !== "") {
                const actualName = aliases[input] || input;
                //log.info(`设置对应号位为【${input}】，切换角色为【${actualName}】`);
                return actualName;
            }
            return null;
        });

        // 检查所有位置设置是否均为null（未指定任何角色）。
        // 如果是，记录日志，返回主界面并退出以跳过不必要的处理。
        if (positionSettings.every((item) => !item)) {
            log.info("未设置任何角色，跳过切换队伍步骤");
            await genshin.returnMainUi();
            return null;
        }

        for (let i = 0; i < positionSettings.length; i++) {
            let rolenum = i + 1; // 槽位编号（用于日志，从1开始）。
            const selectedCharacter = positionSettings[i];
            if (!selectedCharacter) {
                log.info(`未设置${rolenum}号位角色，跳过`); // 如果该槽位未设置角色，则跳过。
                continue;
            }
            //const [x, y] = positionCoordinates[i]; // 获取当前槽位的坐标。
            //click(x, y); // 点击槽位以打开角色选择界面（BGI鼠标API）。
            await click(604, 115); // 点击角色选择界面顶端（BGI鼠标API）。
            log.info(`开始设置${rolenum}号位角色`);
            await sleep(1000); // 等待1秒以确保界面加载。
            let characterFound = false;
            let pageTries = 0;

            // 最多尝试滚动页面20次以查找角色。
            while (pageTries < 20) {

                const snapshot = captureGameRegion();
                // ✅ 检查是否到达最后一页
                const sliderBottomRo = RecognitionObject.TemplateMatch(
                    file.ReadImageMatSync("assets/RecognitionObject/SliderBottom.png"),
                    600, 945, 9, 27
                );
                sliderBottomRo.threshold = 0.6;
                const sliderBottomResult = snapshot.find(sliderBottomRo);
                const isLastPage = sliderBottomResult.isExist();

                if (isLastPage) {
                    await sleep(1500); // 点击后等待1.5秒。
                }
                if (settings.autoFoster) {
                    if ((await syncOCR({ X: 48, Y: 93, WIDTH: 543, HEIGHT: 840 }, 70)).length > 0) {
                        characterFound = true;
                        await sleep(300);
                        const result = await performOCR({ X: 775, Y: 120, WIDTH: 250, HEIGHT: 50 });
                        if (!!result) {
                            characterArray.push(result);
                        }
                    }
                } else {
                    // 尝试匹配所有可能的角色图像文件（例如，安柏01.png、安柏02.png）。
                    for (let num = 1; ; num++) {
                        const paddedNum = num.toString().padStart(2, "0"); // 确保编号为两位数（01、02等）。
                        const characterFileName = `${selectedCharacter}${paddedNum}`;
                        try {
                            let startTime = Date.now();
                            while (Date.now() - startTime < 500) {
                                // 使用BGI RecognitionObject API创建角色图像的模板匹配对象。
                                const characterRo = RecognitionObject.TemplateMatch(
                                    file.ReadImageMatSync(`assets/characterimage/${characterFileName}.png`),
                                    22,
                                    80,
                                    580,
                                    920
                                );
                                characterRo.threshold = 0.6;
                                const characterResult = captureGameRegion().find(characterRo); // 在屏幕上搜索角色图像。
                                if (characterResult && characterResult.x != 0 && characterResult.y != 0 && characterResult.width != 0 && characterResult.height != 0) {
                                    log.info(`已找到角色${selectedCharacter}`); // 记录成功匹配。
                                    // 计算匹配图像中心的点击位置（偏移35像素）。
                                    const targetX = characterResult.x + 35;
                                    const targetY = characterResult.y + 35;
                                    // 确保坐标在屏幕范围内（0到1920，0到1080）。
                                    const safeX = Math.min(Math.max(targetX, 0), 1920);
                                    const safeY = Math.min(Math.max(targetY, 0), 1080);
                                    await click(safeX, safeY); // 点击角色以选择。
                                    await sleep(500); // 点击后等待0.5秒。

                                    const region = { X: 775, Y: 110, WIDTH: 220, HEIGHT: 50 }; // 角色名称OCR识别区域（TextOcr）
                                    const regionObj = RecognitionObject.ocr(region.X, region.Y, region.WIDTH, region.HEIGHT);
                                    const found = captureGameRegion().find(regionObj);
                                    let result;
                                    let text = '';
                                    if (found) {
                                        // 在对象仍然有效时立刻调用
                                        //found.DrawSelf("debug");
                                        text = (typeof found.text === "string") ? found.text : "";
                                    };
                                    if (text.trim()) {
                                        for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                                            text = text.replace(new RegExp(wrongChar, 'g'), correctChar);
                                        }
                                        // 正则表达式：匹配所有非中文字符（\u4e00-\u9fa5 为中文字符范围）
                                        const nonChineseRegex = /[^\u4e00-\u9fa5]/g;
                                        // 将非中文字符替换为空字符串，保留中文字符
                                        result = text.replace(nonChineseRegex, '');
                                        log.info(`点击角色${result}`);
                                    }
                                    if (result && result.includes(selectedCharacter)) {
                                        characterArray.push(result);
                                        //log.info(`characterArray: ${characterArray} result: ${result}`);
                                        characterFound = true;
                                        break; // 如果找到角色，退出编号循环。
                                    }
                                }
                                await sleep(10); // 点击后等待0.1秒。
                            }
                            if(characterFound) break;
                        } catch (error) {
                            // 如果图像文件不存在（例如，没有更多编号文件），跳出循环。
                            break;
                        }
                    }
                }
                if (characterFound) {
                    await click(1800, 135); // 点击角色以选择。
                    await sleep(500); // 点击后等待0.5秒。

                    await click(810, 265); // 点击角色等级。
                    await sleep(500); // 点击后等待0.5秒。
                    for (let j = 0; j < 9; j++) {
                        await click(1700, 380); // 加10级。
                        await sleep(100); // 点击后等待0.1秒。
                    }
                    await sleep(400); // 点击后等待0.4秒。
                    if ((aliases[settings.roleName1] || settings.roleName1).includes(selectedCharacter)) {
                        for (let j = 0; j < (90 - settings.roleTargetLevel1) / 10; j++) {
                            await click(1575, 380); // 减少10级。
                            await sleep(200); // 点击后等待0.5秒。
                        }
                    } else if ((aliases[settings.roleName2] || settings.roleName2).includes(selectedCharacter)) {
                        for (let j = 0; j < (90 - settings.roleTargetLevel2) / 10; j++) {
                            await click(1575, 380); // 减少10级。
                            await sleep(200); // 点击后等待0.5秒。
                        }
                    }else {
                        for (let j = 0; j < 2; j++) {
                            await click(1575, 380); // 减少10级。
                            await sleep(200); // 点击后等待0.5秒。
                        }
                    }
                    break; // 如果找到角色，退出滚动循环。
                }
                if (isLastPage) {
                    log.info(`当前账号没有目标角色${selectedCharacter}，寻找下一个角色`);
                    characterFound = false;
                    break;
                }
                // 如果未找到角色且未达到最大滚动次数，滚动选择界面。
                if (pageTries < 15) {
                    log.info("当前页面没有目标角色，滚动页面");
                    await scrollPage(440, 5); // 向上滚动800像素（BGI鼠标和延时API）。
                    await sleep(100); // 点击后等待0.1秒。
                    await click(100, 155); // 点击角色以选择。
                    await sleep(100); // 点击后等待0.1秒。
                    await click(700, 170); // 点击角色以选择。
                }
                pageTries++;
            }

            if (!characterFound) {
                log.error(`未找到【${selectedCharacter}】`); // 如果达到最大尝试次数仍未找到，记录失败。
                continue;
            }
            await sleep(500); // 额外等待以确保界面过渡。
        }
        // 清除队伍缓存以重置状态。
        genshin.ClearPartyCache();
        return characterArray;
    }

    /**
     * 识别并返回所需材料数量
     * @returns {Promise<{success: boolean, result?: number, error?: string}>} 包含成功标志和材料数量的对象，失败时包含错误信息
     * @description 
     *   - 识别“培养需求.png”图像并定位材料数量区域。
     *   - 使用 OCR 识别材料数量（格式为“当前/所需”或单个数值）。
     *   - 计算所需材料数量（所需 - 当前），支持斜杠分割和特殊单数字格式。
     *   - 记录识别日志，处理异常情况并返回结果。
     */
    async function MaterialsQuantity() {
        const MatchImage1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/培养需求.png`), 0, 0, 1920, 1080);
        const OCRresult = captureGameRegion().find(MatchImage1);

        if (!OCRresult.isExist()) {
            return { success: false };
        }
        let region = { X: OCRresult.X + 138, Y: OCRresult.Y, WIDTH: 110, HEIGHT: 50 }
        //await drawAndClearRedBox({ X: OCRresult.X+138, Y: OCRresult.Y, WIDTH: 100, HEIGHT: 50 },1000);
        let startTime = Date.now();
        while (Date.now() - startTime < 1000) {
            const regionObj = RecognitionObject.ocr(region.X, region.Y, region.WIDTH, region.HEIGHT);

            const text = captureGameRegion().find(regionObj);
            //text.DrawSelf("debug");
            //log.info(`材料区域识别为${text.text}`);

            // 原始字符串
            const str = text.text;

            // 使用 / 分割字符串
            const parts = str.split('/');

            // 检查是否分割出两部分
            if (parts.length === 2) {
                // 处理左边部分：去除空格，提取数字
                const leftPart = parts[0].trim();
                const leftNumber = parseInt(leftPart, 10);

                // 处理右边部分：去除空格，提取数字
                const rightPart = parts[1].trim();
                const rightNumber = parseInt(rightPart, 10);

                // 计算差值
                const result = rightNumber - leftNumber;

                log.info(`所需材料数${result}`);
                return { success: true, result: result };
            } else {

                // 检查是否为数字字符串
                if (/^\d+$/.test(str)) {
                    // 查找所有'1'的位置
                    const ones = [];
                    for (let i = 0; i < str.length; i++) {
                        if (str[i] === '1') {
                            ones.push(i);
                        }
                    }

                    // 检查是否仅有一个'1'且不在两端
                    if (ones.length !== 1) {
                        return { error: "字符串中不是仅有一个'1'" };
                    }

                    const oneIndex = ones[0];
                    if (oneIndex === 0 || oneIndex === str.length - 1) {
                        return { error: "'1'处于字符串两端" };
                    }

                    // 分割字符串并转换为数字
                    const part1 = str.substring(0, oneIndex);
                    const part2 = str.substring(oneIndex + 1);

                    const result = part2 - part1;
                    return {
                        success: true,
                        result: result,
                        result1: part1,
                        result2 : part2
                    };
                } else {
                    log.error("字符串格式不正确，无法通过斜杠分割出两部分");
                }
            }
            await sleep(20);
        }
        return { success: false };
    }

    /**
     * 识别指定图像并返回匹配结果
     * @param {Object} recognitionObject - BGI RecognitionObject 模板匹配对象
     * @param {number} [timeout=1000] - 识别超时时间（毫秒）
     * @returns {Promise<{success: boolean, x?: number, y?: number, width?: number, height?: number}>} 包含匹配结果的对象
     * @description 
     *   - 使用 BGI API 在游戏截图中查找指定图像，尝试直到成功或超时。
     *   - 返回匹配的坐标和尺寸，失败时返回空结果。
     *   - 记录识别日志，捕获并记录异常。
     */
    async function recognizeImage(recognitionObject, timeout = 1000) {
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 尝试识别图像
                let imageResult = captureGameRegion().find(recognitionObject);
                if (imageResult && imageResult.x !== 0 && imageResult.y !== 0 && imageResult.width !== 0 && imageResult.height !== 0) {
                    //await drawAndClearRedBox(imageResult, 500);// 调用异步函数绘制红框并延时清除
                    //log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}, width=${imageResult.width}, height=${imageResult.height}`);
                    return { success: true, x: imageResult.x, y: imageResult.y, width: imageResult.width, height: imageResult.height };
                }
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
            }
            await sleep(10); // 短暂延迟，避免过快循环
        }
        //log.warn(`经过多次尝试，仍然无法识别图像`);
        return { success: false };
    }

    /**
     * 检查指定位置的像素颜色是否匹配目标 RGB 值
     * @param {number} targetR - 目标颜色的 R 值
     * @param {number} targetG - 目标颜色的 G 值
     * @param {number} targetB - 目标颜色的 B 值
     * @param {number} [tolerance=10] - 颜色误差范围
     * @param {number} [x=985] - 检查的像素 X 坐标
     * @param {number} [y=210] - 检查的像素 Y 坐标
     * @returns {Promise<{success: boolean, isCorrect?: boolean, currentR?: number, currentG?: number, currentB?: number, targetR?: number, targetG?: number, targetB?: number, tolerance?: number, error?: string}>} 颜色检查结果
     * @throws {Error} 如果颜色检查失败，记录错误日志
     * @description 
     *   - 使用 BGI OpenCV API 获取指定像素的 RGB 值。
     *   - 检查像素颜色是否在目标 RGB 值的误差范围内。
     *   - 返回详细的颜色信息，用于调试或验证。

     */
    async function checkColor(targetR, targetG, targetB, tolerance = 10, x = 985, y = 210) {
        try {
            // 获取游戏区域截图
            let cap = captureGameRegion();
            let mat = cap.SrcMat;

            // 获取指定位置的像素值 (注意: OpenCV通常使用BGR格式)
            var pixelAt00 = mat.Get(OpenCvSharp.OpenCvSharp.Vec3b, y, x);

            // 提取BGR值并转换为RGB
            const b = pixelAt00.Item0;
            const g = pixelAt00.Item1;
            const r = pixelAt00.Item2;

            // 输出当前像素值用于调试
            //log.info(`当前像素 RGB: R=${r}, G=${g}, B=${b}`);
            //log.info(`目标像素 RGB: R=${targetR}, G=${targetG}, B=${targetB}, 误差范围: ±${tolerance}`);

            // 检查每个颜色通道是否在误差范围内
            const rWithinTolerance = Math.abs(r - targetR) <= tolerance;
            const gWithinTolerance = Math.abs(g - targetG) <= tolerance;
            const bWithinTolerance = Math.abs(b - targetB) <= tolerance;

            // 所有通道都在误差范围内才认为颜色正确
            const isColorCorrect = rWithinTolerance && gWithinTolerance && bWithinTolerance;

            return {
                success: true,
                isCorrect: isColorCorrect,
                currentR: r,
                currentG: g,
                currentB: b,
                targetR: targetR,
                targetG: targetG,
                targetB: targetB,
                tolerance: tolerance
            };
        } catch (error) {
            log.error(`颜色检查出错: ${error}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 根据对照数组查找字符串的正确值
     * @param {string} str - 输入字符串
     * @param {Object[]} mapArray - 包含 original 和 chineseOnly 的对照数组
     * @returns {string} 匹配到的字符串，未匹配返回原字符串
     * @description 
     *   - 在 mapArray 中查找输入字符串的 original 或 chineseOnly 匹配。
     *   - 返回对应的 chineseOnly 或 original，未匹配返回原字符串。
     *   - 用于处理特定名称的替换，例如 boss 名称的标准化。
     */
    function getMatchedString(str, mapArray) {
        // 遍历对照数组查找匹配项
        for (const item of mapArray) {
            // 如果输入字符串与original匹配，则返回对应的chineseOnly
            if (str === item.original) {
                return item.chineseOnly;
            }
            // 如果输入字符串与chineseOnly匹配，则返回对应的original
            if (str === item.chineseOnly) {
                return item.original;
            }
        }
        // 如果没有找到匹配项，返回原字符串
        return str;
    }
    /**
     * 根据操作类型执行材料收集操作
     * @param {number} x - 点击区域的 X 坐标
     * @param {number} y - 点击区域的 Y 坐标
     * @param {string} OperationType - 操作类型（"角色等级", "武器", "圣遗物", "角色天赋"）
     * @param {number} idx - CarryoutTask 数组的索引
     * @returns {Promise<void>} 无返回值
     * @description 
     *   - 根据操作类型识别并记录所需材料（如特产、经验书、boss 材料等）。
     *   - 使用图像模板匹配和 OCR 识别材料信息，更新 CarryoutTask。
     *   - 处理特殊情况（如 boss 名称补全），记录详细日志。
     */
    async function RequirementsOperation(x, y, OperationType, idx) {
        await sleep(500);
        await click(x + 15 - 1050, y + 17);
        await sleep(500);
        await moveMouseTo(918, 465);
        const MatchImage1 = [
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/区域特产.png`), 0, 0, 1920, 1080),
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/冒险之证讨伐页查看.png`), 0, 0, 1920, 1080),
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/激活启示之花奖励.png`), 0, 0, 1920, 1080),
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/激活藏金之花奖励.png`), 0, 0, 1920, 1080),
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/星尘兑换.png`), 0, 0, 1920, 1080),
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/角色培养素材.png`), 0, 0, 1920, 1080)]

        const MatchImage2 = [
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/星尘兑换.png`), 0, 0, 1920, 1080),
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/精通秘境.png`), 0, 0, 1920, 1080),
            RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/合成台转换获取.png`), 0, 0, 1920, 1080),]
        if (OperationType == "角色等级") {
            for (let index = 0; index < MatchImage1.length; index++) {
                const result = await recognizeImage(MatchImage1[index]);
                if (result.success) {
                    switch (index) {
                        case 0:
                            log.info(`记录：材料采集`);
                            const MatchImage1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/区域特产.png`), 0, 0, 1920, 1080);
                            const OCRresult = captureGameRegion().find(MatchImage1);
                            if (OCRresult.isExist()) {
                                let region1 = { X: OCRresult.X - 50, Y: OCRresult.Y, WIDTH: 55, HEIGHT: 27 };
                                let region2 = { X: OCRresult.X - 60, Y: OCRresult.Y - 65, WIDTH: 155, HEIGHT: 50 };
                                // 一次截图
                                let [text1, text2] = performMultiOCRSync([region1, region2]);
                                log.info(`区域识别结果-->${text1}`);
                                log.info(`材料名称识别结果-->${text2}`);
                                const result1 = await MaterialsQuantity();
                                if ((result1.success) || (!!text2 && !!text1)) {
                                    CarryoutTask[idx].requiredSpecialtyMaterialName = text2;
                                    CarryoutTask[idx].requiredSpecialtyMaterialArea = text1;
                                } else {
                                    log.info(`材料采集--存在空字符`);
                                    //log.info(`result1.success -->${result1.success}  !!text2-->${!!text2}  !!text1-->${!!text1}`);
                                }
                                const rl = await MaterialsQuantity();
                                if(rl.result){
                                    CarryoutTask[idx].requiredSpecialtyMaterialCount = rl.result;
                                }else{
                                    log.info(`材料数量识别失败`);
                                    //log.info(`rl.success -->${rl.success}`);
                                }
                            }
                            break;
                        case 1:
                            log.info(`脚本无法获取宝石，请玩家自行合成`);
                            break;
                        case 2:
                            log.info(`记录：经验书刷取`);
                            CarryoutTask[0].isExpBookLeylineFlower = true;
                            break;
                        case 3:
                            log.info(`记录：摩拉刷取`);
                            CarryoutTask[0].isMoraLeylineFlower = true;
                            break;
                        case 4:
                            log.info(`记录：小怪名称`);
                            keyPress("ESCAPE");
                            await sleep(700);
                            await click(x + 15, y + 17);
                            await sleep(1500);
                            const MonsterName = await performOCR({ X: 1020, Y: 250, WIDTH: 200, HEIGHT: 60 });
                            if (!!MonsterName) {
                                CarryoutTask[idx].requiredMonsterName = MonsterName;
                            } else {
                                log.info(`材料采集--存在空字符`);
                                //log.info(`!!MonsterName -->${!!MonsterName} `);
                            }
                            break;
                        case 5:
                            log.info(`记录：boss刷取`);
                            const result = await MaterialsQuantity();
                            keyPress("ESCAPE");
                            await sleep(700);
                            await click(x + 15, y + 17);
                            await sleep(1500);
                            let BossName = await performOCR({ X: 1020, Y: 250, WIDTH: 400, HEIGHT: 60 });
                            if (!!BossName && result.success) {
                                if (BossName === "冰风组曲") {
                                    keyPress("ESCAPE");
                                    await sleep(1500);
                                    await click(x + 15 - 1050, y + 17);
                                    await sleep(500);
                                    BossName += await performOCR({ X: 944, Y: 210, WIDTH: 187, HEIGHT: 46 });
                                }
                                BossName = getMatchedString(BossName, replacementMap2);
                                CarryoutTask[idx].requiredBossMaterialBossName = BossName;
                                CarryoutTask[idx].requiredBossMaterialCount = result.result2;
                            } else {
                                log.info(`材料采集--存在空字符`);
                                if (!!BossName) {
                                    CarryoutTask[idx].requiredBossMaterialBossName = BossName;
                                }
                                log.info(`!!BossName -->${!!BossName}  result.success-->${result.success}`);
                            }
                            break;
                        default:
                            log.warn(`MatchImage1 数组下标溢出`);
                    }
                    break;
                } else {
                    // log.warn(`未能识别到图标 ${fileName}`);
                }

            }
        } else if (OperationType == "武器") {
            log.info(`暂时不支持武器处理`);
        } else if (OperationType == "圣遗物") {
            log.info(`暂时不支持圣遗物处理`);
        } else if (OperationType == "角色天赋") {
            for (let index = 0; index < MatchImage2.length; index++) {
                const result = await recognizeImage(MatchImage2[index]);
                if (result.success) {
                    switch (index) {
                        case 0:
                            log.info(`记录：小怪名称`);
                            keyPress("ESCAPE");
                            await sleep(700);
                            await click(x + 15, y + 17);
                            await sleep(1500);
                            const MonsterName = await performOCR({ X: 1020, Y: 250, WIDTH: 200, HEIGHT: 60 });
                            if (!!MonsterName) {
                                CarryoutTask[idx].requiredMonsterName = MonsterName;
                            } else {
                                log.info(`材料采集--存在空字符`);
                                //log.info(`!!MonsterName -->${!!MonsterName} `);
                            }
                            break;
                        case 1:
                            log.info(`记录：天赋书`);
                            // 识别天赋书名称
                            const TalentMaterialName = await performOCR({ X: 761, Y: 193, WIDTH: 70, HEIGHT: 33 });
                            log.info(`天赋书名称为${TalentMaterialName || '未识别'}`);

                            // 保存识别到的天赋书名称
                            if (!!TalentMaterialName) {
                                CarryoutTask[idx].requiredTalentBookName = TalentMaterialName;
                            }
                            // 天赋突破材料累计数量数组（2-10级）
                            // 规则：x=教导（1号位）、y=指引（2号位）、z=哲学（3号位），值为对应等级的累计消耗
                            const talentMaterialTotal = [
                                { x: 0, y: 0, z: 0 },
                                // 2级突破：仅消耗教导*3，指引/哲学无消耗
                                { x: 3, y: 0, z: 0 },
                                // 3级突破：累计指引+2（总2），教导保持3，哲学0
                                { x: 3, y: 2, z: 0 },
                                // 4级突破：累计指引+4（总6）
                                { x: 3, y: 6, z: 0 },
                                // 5级突破：累计指引+6（总12）
                                { x: 3, y: 12, z: 0 },
                                // 6级突破：累计指引+9（总21）
                                { x: 3, y: 21, z: 0 },
                                // 7级突破：累计哲学+4（总4），教导/指引保持不变
                                { x: 3, y: 21, z: 4 },
                                // 8级突破：累计哲学+6（总10）
                                { x: 3, y: 21, z: 10 },
                                // 9级突破：累计哲学+12（总22）
                                { x: 3, y: 21, z: 22 },
                                // 10级突破：累计哲学+16（总38）
                                { x: 3, y: 21, z: 38 }
                            ];
                            if (CarryoutTask[idx].character === (aliases[settings.roleName1] || CarryoutTask[idx].character.includes((aliases[settings.roleName1] || settings.roleName1)))) {
                                const parts = settings.roleTargetTalent1.split('/');
                                if (parts.length != 3) {
                                    log.info("天赋书写格式不对")
                                    log.info(`分割后数组: ${JSON.stringify(parts)}, 长度: ${parts.length}`);
                                } else {
                                    const x = `${talentMaterialTotal[parts[0] - 1].x + talentMaterialTotal[parts[1] - 1].x + talentMaterialTotal[parts[2] - 1].x}-`;
                                    const y = `${talentMaterialTotal[parts[0] - 1].y + talentMaterialTotal[parts[1] - 1].y + talentMaterialTotal[parts[2] - 1].y}-`;
                                    const z = `${talentMaterialTotal[parts[0] - 1].z + talentMaterialTotal[parts[1] - 1].z + talentMaterialTotal[parts[2] - 1].z}`;
                                    CarryoutTask[idx].requiredTalentBookCount = "" + x + y + z;
                                }
                            } else if (CarryoutTask[idx].character === (aliases[settings.roleName2] || CarryoutTask[idx].character.includes((aliases[settings.roleName2] || settings.roleName2)))) {
                                const parts = settings.roleTargetTalent2.split('/');
                                if (parts.length != 3) {
                                    log.info("天赋书写格式不对")
                                    //log.info(`分割后数组: ${JSON.stringify(parts)}, 长度: ${parts.length}`);
                                } else {
                                    const x = `${talentMaterialTotal[parts[0]].x + talentMaterialTotal[parts[1]].x + talentMaterialTotal[parts[2]].x}-`;
                                    const y = `${talentMaterialTotal[parts[0]].y + talentMaterialTotal[parts[1]].y + talentMaterialTotal[parts[2]].y}-`;
                                    const z = `${talentMaterialTotal[parts[0]].z + talentMaterialTotal[parts[1]].z + talentMaterialTotal[parts[2]].z}`;
                                    CarryoutTask[idx].requiredTalentBookCount = "" + x + y + z;
                                    log.info(`当前天赋书数量为：${CarryoutTask[idx].requiredTalentBookCount}`);
                                }
                            }
                            //下列是旧版识别代码
                            /*

                            // 定义天赋书颜色配置（绿、蓝、紫）
                            const ColorMaterials = [
                                { num: 0, R: 42, G: 143, B: 114, name: '绿色天赋书' },
                                { num: 0, R: 81, G: 128, B: 203, name: '蓝色天赋书' },
                                { num: 0, R: 161, G: 86, B: 224, name: '紫色天赋书' }
                            ];

                            // 遍历检查每种颜色的天赋书
                            for (let j = 0; j < ColorMaterials.length; j++) {
                                const colorCheckResult = await checkColor(
                                    ColorMaterials[j].R,
                                    ColorMaterials[j].G,
                                    ColorMaterials[j].B
                                );

                                // 颜色匹配成功
                                if (colorCheckResult.success && colorCheckResult.isCorrect) {
                                    log.info(`匹配成功：${ColorMaterials[j].name}`);

                                    // 获取材料数量
                                    const quantityResult = await MaterialsQuantity();
                                    if (quantityResult.success) {
                                        // 更新对应颜色天赋书的数量
                                        ColorMaterials[j].num = quantityResult.result;

                                        // 输出调试日志
                                        //log.info(`当前处理的ColorMaterials索引: ${j}, 对应数值: ${quantityResult.result}`);
                                        //log.info(`当前CarryoutTask索引: ${idx}`);

                                        // 处理天赋书数量字符串
                                        if (!!CarryoutTask[idx].requiredTalentBookCount) {
                                            //log.info(`原始requiredTalentBookCount: ${CarryoutTask[idx].requiredTalentBookCount}`);

                                            // 分割字符串为数组
                                            const parts = CarryoutTask[idx].requiredTalentBookCount.split('-');
                                            //log.info(`分割后数组: ${JSON.stringify(parts)}, 数组长度: ${parts.length}`);
                                            //log.info(`目标替换索引idx: ${idx}, 数组有效索引范围: 0~${parts.length - 1}`);

                                            // 检查索引有效性
                                            if (idx < 0 || idx >= parts.length) {
                                                log.warn(`警告: idx=${idx} 超出数组有效索引范围`);
                                            }

                                            // 重新拼接字符串
                                            let newStr = "";
                                            for (let i = 0; i < parts.length; i++) {
                                                //log.info(`循环i=${i}: 是否匹配目标索引${idx}? ${i === idx}`);

                                                if (i === j) {
                                                    newStr += ColorMaterials[j].num;
                                                    //log.info(`替换位置i=${i}为: ${ColorMaterials[j].num}`);
                                                } else {
                                                    newStr += parts[i];
                                                    //log.info(`保留位置i=${i}的值: ${parts[i]}`);
                                                }

                                                // 添加分隔符（最后一个元素除外）
                                                if (i < parts.length - 1) {
                                                    newStr += "-";
                                                }
                                            }

                                            // 更新结果
                                            CarryoutTask[idx].requiredTalentBookCount = newStr;
                                            //log.info(`替换后字符串: ${newStr}`);
                                        } else {
                                            // 初始化数量字符串
                                            CarryoutTask[idx].requiredTalentBookCount = `${ColorMaterials[0].num}-${ColorMaterials[1].num}-${ColorMaterials[2].num}`;
                                            //log.info(`初始化requiredTalentBookCount: ${CarryoutTask[idx].requiredTalentBookCount}`);
                                        }

                                        log.info(`当前天赋书数量为：${CarryoutTask[idx].requiredTalentBookCount}`);
                                        break; // 匹配成功后退出循环
                                    }
                                }
                            }*/
                            break;
                        case 2:
                            log.info(`脚本无法获取周本材料，请玩家自行合成 或刷取`);
                            break;
                        default:
                            log.warn(`MatchImage1 数组下标溢出`);
                    }
                    break;
                } else {
                    log.info(`识别失败，进行${index}次识别`);
                }
            }
        } else {
            log.warn(`类型错误`);
        }
        // 延时
        await sleep(500);
        keyPress("ESCAPE");
        await sleep(1500);
    }


    /**
     * 检测“定位.png”图像并调用材料操作函数
     * @param {string} OperationType - 操作类型（"角色等级", "武器", "圣遗物", "角色天赋"）
     * @param {number} idx - CarryoutTask 数组的索引
     * @param {boolean} [topToBottom=true] - 识别方向，true 为自上而下，false 为自下而上
     * @returns {Promise<number>} 识别到的图像数量
     * @description 
     *   - 在指定区域内识别“定位.png”图像，记录匹配位置并调用 RequirementsOperation。
     *   - 支持自上而下或自下而上的扫描方向，动态调整识别区域。
     *   - 使用 BGI API 进行图像模板匹配，绘制红框以可视化匹配区域。
     *   - 记录匹配数量和日志，处理边界情况和异常。
     */

    async function detectPositions(OperationType, idx, topToBottom = true) {
        // 定义总体识别区域和图像参数
        const totalX = 1700;      // 起始x坐标
        const totalY = 310;       // 起始y坐标
        const totalWidth = 220;   // 固定宽度
        const totalHeight = 750;  // 总区域高度
        const totalBottom = totalY + totalHeight;  // 总区域下边界y坐标（1060）
        const imageHeight = 34;   // “定位.png”图像高度
        const stepSize = 34;      // 每次未识别时高度增加的步长

        // 加载“定位.png”图像，使用BGI file.ReadImageMatSync API
        const imageMat = file.ReadImageMatSync('assets/RecognitionObject/坐标.png');

        // 根据识别方向初始化当前Y坐标
        let currentY = topToBottom ? totalY : totalBottom - imageHeight;
        let currentHeight = imageHeight;  // 当前识别区域高度，初始为34
        let matchCount = 0;       // 匹配到的图像计数

        // 循环直到当前区域超出总边界
        while ((topToBottom ? currentY < totalBottom : currentY >= totalY) && currentHeight >= imageHeight) {
            // 确保当前高度不超过边界（根据方向调整）
            if (topToBottom) {
                if (currentY + currentHeight > totalBottom) {
                    currentHeight = totalBottom - currentY; // 调整高度到下边界
                }
            } else {
                if (currentY - currentHeight < totalY) {
                    currentHeight = currentY - totalY; // 调整高度到上边界
                }
            }

            // 如果当前高度小于图像高度，停止循环
            if (currentHeight < imageHeight) {
                break;
            }

            // 创建当前区域的模板匹配对象，使用BGI RecognitionObject API
            const ro = RecognitionObject.TemplateMatch(
                imageMat,               // 图像Mat
                totalX,                 // 固定x坐标
                topToBottom ? currentY : currentY - currentHeight,  // 根据方向计算起始y坐标
                totalWidth,             // 固定宽度
                currentHeight           // 当前高度
            );
            let drawRegion = captureGameRegion().DeriveCrop(
                totalX,                 // 固定x坐标
                topToBottom ? currentY : currentY - currentHeight,  // 根据方向计算起始y坐标
                totalWidth,             // 固定宽度
                currentHeight           // 当前高度
            ).DrawSelf("icon");
            await sleep(10);

            // 捕获游戏区域并查找匹配，使用BGI captureGameRegion API
            const captureRegion = captureGameRegion();
            const result = await captureRegion.find(ro);

            if (result.isExist()) {
                // 匹配成功，记录日志并调用RequirementsOperation
                //log.info(`识别到定位图像，位置：(${result.x}, ${result.y})`);
                // 清除红框
                if (drawRegion) {
                    drawRegion = captureGameRegion().DeriveCrop(0, 0, 0, 0).DrawSelf("icon");
                    drawRegion = null; // 释放对象
                }
                matchCount++;  // 计数+1
                await RequirementsOperation(result.x, result.y, OperationType, idx);  // 调用外部处理函数

                // 根据识别方向更新起始y坐标
                if (topToBottom) {
                    currentY = result.y + imageHeight;  // 自上而下：向下移动
                } else {
                    currentY = result.y;  // 自下而上：向上移动
                }
                currentHeight = imageHeight;  // 重置高度为34
            } else {
                // 未匹配，高度增加17像素
                currentHeight += stepSize;
                // 如果高度仍小于图像高度，重置为图像高度
                if (currentHeight < imageHeight) {
                    currentHeight = imageHeight;
                }
            }
            // 清除红框
            if (drawRegion) {
                drawRegion = captureGameRegion().DeriveCrop(0, 0, 0, 0).DrawSelf("icon");
                drawRegion = null; // 释放对象
            }
            // 如果未匹配且高度达到最大（或接近边界），移动y坐标并重置高度
            if (!result.isExist()) {
                if (topToBottom) {
                    if (currentY + currentHeight >= totalBottom) break;
                } else {
                    if (currentY - currentHeight <= totalY) break;
                }
            }
            // 短暂延时以避免过度CPU使用（BGI sleep API）
            await sleep(50);
        }

        // 记录总匹配数量并返回
        //log.info(`识别完成，总匹配数量：${matchCount}`);
        return matchCount;
    }
    /**
     * 统计角色的所需材料
     * @param {number} idx - CarryoutTask 数组的索引
     * @returns {Promise<void>} 无返回值
     * @description 
     *   - 遍历角色等级和天赋相关的操作类型，跳过武器和圣遗物。
     *   - 使用 detectPositions 识别材料需求，滚动页面以处理更多内容。
     *   - 检测上下箭头以判断页面是否需要滚动，支持双向扫描。
     *   - 记录日志以跟踪处理进度。
     */
    async function StatisticsRequiredMaterial(idx) {
        const array = ["角色等级", "武器", "圣遗物", "角色天赋"];
        const x = 810;
        const y = 260;
        for (let index = 0; index < array.length; index++) {
            //暂时不支持武器和圣遗物的识别
            if (index == 1 || index == 2) {
                continue;
            }
            if (index === 3 && (!settings.talentCultivation || settings.autoFoster)) {
                continue;
            }
            await click(x + index * 300, y);
            await sleep(500);
            //log.info(`索引 ${index } 对应的元素: ${array[index]}`);
            await detectPositions(array[index], idx + 1, true);
            const sliderBottomRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync("assets/RecognitionObject/上箭头.png"),
                1850, 310, 13, 134
            );
            sliderBottomRo.threshold = 0.6;
            if (captureGameRegion().find(sliderBottomRo).isExist()) {
                for (let i = 0; i < 5; i++) {
                    await scrollPage(200, 1000, 985);
                    await sleep(1500);
                    const sliderBottomRo1 = RecognitionObject.TemplateMatch(
                        file.ReadImageMatSync("assets/RecognitionObject/下箭头.png"),
                        1850, 908, 15, 136
                    );
                    sliderBottomRo1.threshold = 0.6;
                    if (captureGameRegion().find(sliderBottomRo1).isExist()) {
                        await detectPositions(array[index], idx + 1, false);
                        break;
                    } else {
                        await detectPositions(array[index], idx + 1, true);
                    }
                }
            } else {
                log.error(`未识别到下箭头`);
            }

        }
    }

    /**
         * 执行任务计划，包括地脉花、角色培养和材料收集
         * @param {Object[]} carryoutTask - 任务数据数组
         * @returns {Promise<void>} 无返回值
         * @description 
         *   - 根据任务配置执行地脉花刷取、角色培养或材料收集。
         *   - 支持蓝花（经验花）、黄花（摩拉花）或秘境挑战。
         *   - 处理怪物和特产材料任务，运行对应的路径脚本。
         *   - 记录详细日志以跟踪任务执行情况。
         */
    async function PerformOperation(carryoutTask) {
        // 自定义 normalizePath 函数，将路径中的反斜杠替换为正斜杠
    function normalizePath(filePath) {
        return filePath.replace(/\\/g, '/');
    }

    // 获取目录下所有 JSON 文件，返回路径使用正斜杠
    function readAllJsonFilePaths(dirPath, currentDepth = 0, maxDepth = 10, includeExtensions = ['.json']) {
        const normalizedDirPath = normalizePath(dirPath); // 规范化输入路径
        if (!pathExists(normalizedDirPath)) {
            log.error(`目录 ${normalizedDirPath} 不存在`);
            return [];
        }

        try {
            let entries = file.readPathSync(normalizedDirPath); // 读取目录内容
            entries = Array.from(entries).map(normalizePath); // 转换为标准数组并规范化路径
            const filePaths = [];

            for (const entry of entries) {
                const isDirectory = file.isFolder(entry); // 检查是否为目录
                if (isDirectory && currentDepth < maxDepth) {
                    // 递归读取子目录
                    filePaths.push(...readAllJsonFilePaths(entry, currentDepth + 1, maxDepth, includeExtensions));
                } else if (!isDirectory) {
                    const fileExtension = entry.substring(entry.lastIndexOf('.')).toLowerCase();
                    if (includeExtensions.includes(fileExtension)) {
                        filePaths.push(entry); // 添加 JSON 文件路径（已规范化）
                    }
                }
            }

            return filePaths;
        } catch (error) {
            log.error(`读取目录 ${normalizedDirPath} 时发生错误: ${error}`);
            return [];
        }
    }
        // 启用自动拾取的实时任务
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        //保底优先执行体力任务
        if (!carryoutTask[0].isMoraLeylineFlower && 
            !carryoutTask[0].isExpBookLeylineFlower && 
            carryoutTask[1].requiredBossMaterialBossName==="无" && 
            carryoutTask[1].requiredTalentBookName == "无" && 
            carryoutTask[2].requiredBossMaterialBossName==="无" && 
            carryoutTask[2].requiredTalentBookName == "无" &&
            settings.leyLineOptions !=="不执行") {
            log.info(`角色培养无需体力任务，执行选择方案:${settings.leyLineOptions}`);
            if (settings.leyLineOptions === "1-蓝花(经验花)") {
                await AutoFontaineLeyLine(
                    {
                        method: "冒险之证", // 默认：通过 <冒险之证> 寻找地脉花，一般不用改\n可选：通过 <拖动地图> 为原始方法，按需要选择
                        n: settings.n, // 选填：战斗队伍，默认不更换队伍，如需好感队则必填
                        nh: settings.nh, // 选填：好感队伍，如设定领奖前切换，同时战斗队伍必填
                        times: "4", // 选填：按刷取次数，默认6次，最多99次，树脂耗尽模式下无效
                        shuv: "2-树脂耗尽", // 默认：<1> 为按上面的次数刷取，可选 <2> 为耗尽树脂模式
                        color: "1-蓝花(经验花)", // 默认：<1-蓝花(经验花)>，可选<2-黄花(摩拉花)>
                        Rewardsuse: "1/2/5", // 树脂设定：1=浓缩/2=40原粹/3=脆弱/4=须臾/5=20原粹\n用`/`隔开：填写对应的树脂<数字>即可\n默认：1/2/5 (先用浓缩后原粹，直至用完，不填的不使用 ↓↓)
                        primogemUseCount: "0", // 原石购买体力次数(0~6次)，上面设置的树脂用完后才会使用 ↓↓
                        Fightquick: true, // 默认开启：异步检测战斗结束，即地脉花长出后马上停止战斗\n开启后，请关闭配置组中的<自动检测战斗结束>选项\n不启用：使用传统<打开队伍界面>判断战斗结束 ↓↓
                        timeout: "180", // 战斗超时，启用<异步检测战斗结束>开启后，下方填写的超时时间才有效\n默认180秒，建议和配置组的战斗超时一致 ↓↓
                        SMODEL: true, // 直跑模式：如下个花近，直跑去，不传送，要求44.8版本以上 ↓↓
                        EAT: false, // 支持BGI本体血量恢复药和复活药，有小BUG，酌情使用\n自动吃药：请戴“营养袋”，要求48.2版本以上，否则会报错。 ↓↓
                        Rewards: false, // 勾选后，打完地脉花后，领取历练点并提交每日任务 ↓↓
                        nowuid: "" // 禁止特定UID刷地脉花，用 / 隔开，如（12345/99999）↓↓ 
                    }
                )
            } else if (settings.leyLineOptions === "2-黄花(摩拉花)") {
                await AutoFontaineLeyLine(
                    {
                        method: "冒险之证", // 默认：通过 <冒险之证> 寻找地脉花，一般不用改\n可选：通过 <拖动地图> 为原始方法，按需要选择
                        n: settings.n, // 选填：战斗队伍，默认不更换队伍，如需好感队则必填
                        nh: settings.nh, // 选填：好感队伍，如设定领奖前切换，同时战斗队伍必填
                        times: "4", // 选填：按刷取次数，默认6次，最多99次，树脂耗尽模式下无效
                        shuv: "2-树脂耗尽", // 默认：<1> 为按上面的次数刷取，可选 <2> 为耗尽树脂模式
                        color: "2-黄花(摩拉花)", // 默认：<1-蓝花(经验花)>，可选<2-黄花(摩拉花)>
                        Rewardsuse: "1/2/5", // 树脂设定：1=浓缩/2=40原粹/3=脆弱/4=须臾/5=20原粹\n用`/`隔开：填写对应的树脂<数字>即可\n默认：1/2/5 (先用浓缩后原粹，直至用完，不填的不使用 ↓↓)
                        primogemUseCount: "0", // 原石购买体力次数(0~6次)，上面设置的树脂用完后才会使用 ↓↓
                        Fightquick: true, // 默认开启：异步检测战斗结束，即地脉花长出后马上停止战斗\n开启后，请关闭配置组中的<自动检测战斗结束>选项\n不启用：使用传统<打开队伍界面>判断战斗结束 ↓↓
                        timeout: "180", // 战斗超时，启用<异步检测战斗结束>开启后，下方填写的超时时间才有效\n默认180秒，建议和配置组的战斗超时一致 ↓↓
                        SMODEL: true, // 直跑模式：如下个花近，直跑去，不传送，要求44.8版本以上 ↓↓
                        EAT: false, // 支持BGI本体血量恢复药和复活药，有小BUG，酌情使用\n自动吃药：请戴“营养袋”，要求48.2版本以上，否则会报错。 ↓↓
                        Rewards: false, // 勾选后，打完地脉花后，领取历练点并提交每日任务 ↓↓
                        nowuid: "" // 禁止特定UID刷地脉花，用 / 隔开，如（12345/99999）↓↓ 
                    }
                )
            } else {
                await AutoDomain({domainName :settings.domainName});
            }
        } else {

            await AutoCultivation(
                {
                    talentBookName: carryoutTask[1].requiredTalentBookName, // 请选择天赋书类型（select类型无默认值时为空字符串）
                    talentBookRequireCounts: carryoutTask[1].requiredTalentBookCount, // 天赋书数量，绿-蓝-紫（input-text类型默认值为空字符串）
                    weaponName: "无", // 请选择武器材料类型（select类型无默认值时为空字符串）
                    weaponMaterialRequireCounts: "", // 武器材料数量，绿-蓝-紫-金（input-text类型默认值为空字符串）
                    bossName: carryoutTask[1].requiredBossMaterialBossName, // 请选择首领（select类型无默认值时为空字符串）
                    bossRequireCounts: ``+carryoutTask[1].requiredBossMaterialCount, // 首领材料数量（input-text类型默认值为空字符串）
                    teamName: settings.n, // 挑战队伍名称（input-text类型默认值为空字符串）
                    energyMax: false, // 挑战前是否恢复满能量
                    unfairContractTerms: settings.unfairContractTerms // 签署霸王条款开启使用，出了事跟作者无关
                }
            );
            await AutoCultivation(
                {
                    talentBookName: carryoutTask[2].requiredTalentBookName, // 请选择天赋书类型（select类型无默认值时为空字符串）
                    talentBookRequireCounts: carryoutTask[2].requiredTalentBookCount, // 天赋书数量，绿-蓝-紫（input-text类型默认值为空字符串）
                    weaponName: "无", // 请选择武器材料类型（select类型无默认值时为空字符串）
                    weaponMaterialRequireCounts: "", // 武器材料数量，绿-蓝-紫-金（input-text类型默认值为空字符串）
                    bossName: carryoutTask[2].requiredBossMaterialBossName, // 请选择首领（select类型无默认值时为空字符串）
                    bossRequireCounts: ``+carryoutTask[2].requiredBossMaterialCount, // 首领材料数量（input-text类型默认值为空字符串）
                    teamName: settings.n, // 挑战队伍名称（input-text类型默认值为空字符串）
                    energyMax: false, // 挑战前是否恢复满能量
                    unfairContractTerms: settings.unfairContractTerms // 签署霸王条款开启使用，出了事跟作者无关
                }
            );

            if (carryoutTask[0].isExpBookLeylineFlower) {
                await AutoFontaineLeyLine(
                    {
                        method: "冒险之证", // 默认：通过 <冒险之证> 寻找地脉花，一般不用改\n可选：通过 <拖动地图> 为原始方法，按需要选择
                        n: settings.n, // 选填：战斗队伍，默认不更换队伍，如需好感队则必填
                        nh: settings.nh, // 选填：好感队伍，如设定领奖前切换，同时战斗队伍必填
                        times: "4", // 选填：按刷取次数，默认6次，最多99次，树脂耗尽模式下无效
                        shuv: "2-树脂耗尽", // 默认：<1> 为按上面的次数刷取，可选 <2> 为耗尽树脂模式
                        color: "1-蓝花(经验花)", // 默认：<1-蓝花(经验花)>，可选<2-黄花(摩拉花)>
                        Rewardsuse: "1/2/5", // 树脂设定：1=浓缩/2=40原粹/3=脆弱/4=须臾/5=20原粹\n用`/`隔开：填写对应的树脂<数字>即可\n默认：1/2/5 (先用浓缩后原粹，直至用完，不填的不使用 ↓↓)
                        primogemUseCount: "0", // 原石购买体力次数(0~6次)，上面设置的树脂用完后才会使用 ↓↓
                        Fightquick: true, // 默认开启：异步检测战斗结束，即地脉花长出后马上停止战斗\n开启后，请关闭配置组中的<自动检测战斗结束>选项\n不启用：使用传统<打开队伍界面>判断战斗结束 ↓↓
                        timeout: "240", // 战斗超时，启用<异步检测战斗结束>开启后，下方填写的超时时间才有效\n默认180秒，建议和配置组的战斗超时一致 ↓↓
                        SMODEL: true, // 直跑模式：如下个花近，直跑去，不传送，要求44.8版本以上 ↓↓
                        EAT: false, // 支持BGI本体血量恢复药和复活药，有小BUG，酌情使用\n自动吃药：请戴“营养袋”，要求48.2版本以上，否则会报错。 ↓↓
                        Rewards: false, // 勾选后，打完地脉花后，领取历练点并提交每日任务 ↓↓
                        nowuid: "" // 禁止特定UID刷地脉花，用 / 隔开，如（12345/99999）↓↓ 
                    }
                )
            } 
            if (carryoutTask[0].isMoraLeylineFlower) {
                await AutoFontaineLeyLine(
                    {
                        method: "冒险之证", // 默认：通过 <冒险之证> 寻找地脉花，一般不用改\n可选：通过 <拖动地图> 为原始方法，按需要选择
                        n: settings.n, // 选填：战斗队伍，默认不更换队伍，如需好感队则必填
                        nh: settings.nh, // 选填：好感队伍，如设定领奖前切换，同时战斗队伍必填
                        times: "4", // 选填：按刷取次数，默认6次，最多99次，树脂耗尽模式下无效
                        shuv: "2-树脂耗尽", // 默认：<1> 为按上面的次数刷取，可选 <2> 为耗尽树脂模式
                        color: "2-黄花(摩拉花)", // 默认：<1-蓝花(经验花)>，可选<2-黄花(摩拉花)>
                        Rewardsuse: "1/2/5", // 树脂设定：1=浓缩/2=40原粹/3=脆弱/4=须臾/5=20原粹\n用`/`隔开：填写对应的树脂<数字>即可\n默认：1/2/5 (先用浓缩后原粹，直至用完，不填的不使用 ↓↓)
                        primogemUseCount: "0", // 原石购买体力次数(0~6次)，上面设置的树脂用完后才会使用 ↓↓
                        Fightquick: true, // 默认开启：异步检测战斗结束，即地脉花长出后马上停止战斗\n开启后，请关闭配置组中的<自动检测战斗结束>选项\n不启用：使用传统<打开队伍界面>判断战斗结束 ↓↓
                        timeout: "240", // 战斗超时，启用<异步检测战斗结束>开启后，下方填写的超时时间才有效\n默认180秒，建议和配置组的战斗超时一致 ↓↓
                        SMODEL: true, // 直跑模式：如下个花近，直跑去，不传送，要求44.8版本以上 ↓↓
                        EAT: false, // 支持BGI本体血量恢复药和复活药，有小BUG，酌情使用\n自动吃药：请戴“营养袋”，要求48.2版本以上，否则会报错。 ↓↓
                        Rewards: false, // 勾选后，打完地脉花后，领取历练点并提交每日任务 ↓↓
                        nowuid: "" // 禁止特定UID刷地脉花，用 / 隔开，如（12345/99999）↓↓ 
                    }
                )
            }

        }
        if (settings.claimReward){
            await genshin.returnMainUi();
            await genshin.claimEncounterPointsRewards();
            await genshin.goToAdventurersGuild("枫丹");
            await genshin.claimBattlePassRewards();
            await genshin.returnMainUi();
        }

        function extractCount(filename) {
            // 匹配格式：数字+个.json（位于字符串末尾）
            const match = filename.match(/(\d+)个\.json$/);
            // 匹配成功则返回数字，否则返回0或null
            return match ? Number(match[1]) : 0;
        }

        log.info('执行任务：地图追踪');
        // 外层循环，迭代 1 到 2
        for (let i = 1; i < 3; i++) {
            log.info('开始第 {0} 次任务循环', i);

            // 读取文件内容
            log.info('准备读取文件夹: User/AutoPathing');
            const txtContent = readAllJsonFilePaths("User/AutoPathing");
            log.info('文件读取完成，内容长度: {0}', txtContent.length);

            // 检查是否需要处理怪物任务
            if (!!carryoutTask[i].requiredMonsterName) {
                //切换配对
                if (settings.n) {
                    await genshin.switchParty(settings.n);
                }
                log.info('检测到需要处理怪物任务，怪物名称: {0}', carryoutTask[i].requiredMonsterName);

                const targetPath1 = "User/AutoPathing/敌人与魔物/" + carryoutTask[i].requiredMonsterName;
                log.info('生成目标路径: {0}', targetPath1);

                const result1 = filterPathsByFolder(txtContent, targetPath1);
                log.info('过滤路径结果数量: {0}', result1.length);

                for (let index = 0; index < result1.length; index++) {
                    log.info('开始执行第 {0}/{1} 个子任务，路径: {2}', index + 1, result1.length, result1[index]);
                    try {
                        log.info('尝试运行路径脚本: {0}', result1[index]);
                        // 返回主界面
                        await genshin.returnMainUi();
                        await pathingScript.runFile(result1[index] + "");
                        log.info('路径脚本 {0} 执行成功', result1[index]);
                    } catch (error) {
                        log.error('操作失败: {0}, 错误详情: {1}', result1[index], error.message);
                    }
                }
            } else {
                log.info('第 {0} 次任务循环中无怪物任务需要处理', i);
            }
            // 检查是否需要处理特产材料任务
            if (!!carryoutTask[i].requiredSpecialtyMaterialName && !!carryoutTask[i].requiredSpecialtyMaterialArea) {
                //切换配对
                if (settings.nhh) {
                    await genshin.switchParty(settings.nhh);
                }
                log.info('检测到需要处理特产材料任务，材料: {0}, 区域: {1}',
                    carryoutTask[i].requiredSpecialtyMaterialName,
                    carryoutTask[i].requiredSpecialtyMaterialArea);

                const targetPath2 = "User/AutoPathing/地方特产/" + carryoutTask[i].requiredSpecialtyMaterialArea + "/" + carryoutTask[i].requiredSpecialtyMaterialName;
                log.info('生成目标路径: {0}', targetPath2);

                const result2 = filterPathsByFolder(txtContent, targetPath2);
                log.info('过滤路径结果数量: {0}', result2.length);

                let sum = 0;
                for (let index = 0; index < result2.length; index++) {
                    sum += extractCount(result2[index]);
                    log.info('开始执行第 {0}/{1} 个子任务，路径: {2}', index + 1, result2.length, result2[index]);
                    try {
                        log.info('尝试运行路径脚本: {0}', result2[index]);
                        // 返回主界面
                        await genshin.returnMainUi();
                        await pathingScript.runFile(result2[index] + "");
                        log.info(`当前获取材料数目:${sum}`);
                        log.info('路径脚本 {0} 执行成功', result2[index]);
                    } catch (error) {
                        log.error('操作失败: {0}, 错误详情: {1}', result2[index], error.message);
                    }
                    if(carryoutTask[i].requiredSpecialtyMaterialCount > 0){
                        //材料的1.5倍，保证容错
                        if(sum > Math.ceil(carryoutTask[i].requiredSpecialtyMaterialCount* 1.5)) {
                            log.info(`获取材料总数为:${sum}，已满足需求：${carryoutTask[i].requiredSpecialtyMaterialCount}`);
                            break;
                        }
                    }
                }
            } else {
                log.info('第 {0} 次任务循环中无特产材料任务需要处理', i);
            }

            log.info('第 {0} 次任务循环结束', i);
        }
    }
//-----------------------------------------------------------------------------------------------------------------------------------
    if(!file.isFolder("User"))throw new Error('User文件夹不存在\n\t\t\t请你先运行脚本下的bat文件生成User文件夹');
    let roleNameArray = [];
    if (!settings.unfairContractTerms) throw new Error('未签署霸王条款，无法使用');
    if (!settings.autoFoster && (aliases[settings.roleName1] || settings.roleName1) === "" && (aliases[settings.roleName2] || settings.roleName2) === "") throw new Error('未填入养成角色，脚本退出');
    //切换配对
    if (settings.n) {
        await genshin.switchParty(settings.n);
    }else{
        log.error(`未设置战斗队伍，默认当前队伍,最好请你设置一下战斗队伍`);
    }
    if(!settings.nhh){
        log.error(`未设置采集队伍，默认当前队伍,最好请你设置一下特产队伍，否则可能无法采集!!!`);
    }
    if (!settings.isSkip) {
        const UpCharactercCoordinates = [{ X: 1745, Y: 240 }, { X: 1745, Y: 400 }];

        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();
        keyPress("ESCAPE");
        await sleep(1000);
        let Identifier = false;
        let startTime = Date.now();
        while (Date.now() - startTime < 10000 && !Identifier) {
            const ImprovementGuide = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/提升指南.png`), 0, 0, 1920, 1080);
            const ImprovementGuideResult = await recognizeImage(ImprovementGuide);
            if (ImprovementGuideResult.success) {
                Identifier = true;
                await click(ImprovementGuideResult.x, ImprovementGuideResult.y);
            } else {
                log.info(`未识别到提升指南`);
                log.info(`尝试重新打开esc`);
                await genshin.returnMainUi();
                keyPress("ESCAPE");
                await sleep(1000);
            }
        }

        if (!Identifier) {
            log.info(`多次尝试仍未找到提升指南，脚本结束`);
            return null;
        }
        await sleep(1500);
        await click(1857, 130);//点击目录最上方
        await sleep(500);
        let role = [
            (aliases[settings.roleName1] || settings.roleName1 || ""),
            (aliases[settings.roleName2] || settings.roleName2 || "")
        ];
        if(settings.autoFoster){
            role = ["-","-"];
        }
        let OCRtargettext = await performOCR({ X: 650, Y: 115, WIDTH: 195, HEIGHT: 42 });
        //log.info(`OCRtargettext --> ${OCRtargettext}`);
        if (OCRtargettext && OCRtargettext.includes("培养计划角色列表")) {
            // 同时识别两个区域
            let region1 = { X: 1580, Y: 190, WIDTH: 65, HEIGHT: 25 };
            let region2 = { X: 758, Y: 185, WIDTH: 325, HEIGHT: 45 };

            for (let j = 0; j < 2; j++) {
                let [text1, text2] = performMultiOCRSync([region1, region2]);
                log.info(`识别结果: ${text1}+ ${text2}`);
                // 判断逻辑
                if (text1 === "培养中" || text1 === "已完成") {
                    if (role.includes(text2) || role === text2) {
                        log.info(`匹配成功: 培养中 + ${text2}`);
                        roleNameArray.push(text2);
                        region1 = { X: 1580, Y: 340, WIDTH: 65, HEIGHT: 25 };
                        region2 = { X: 758, Y: 335, WIDTH: 325, HEIGHT: 45 };
                        await sleep(700); // 等待0.7秒（700毫秒）
                        await click(UpCharactercCoordinates[j].X, UpCharactercCoordinates[j].Y);

                        await sleep(500); // 点击后等待0.5秒。
                        await click(810, 265); // 点击角色等级。
                        await sleep(500); // 点击后等待0.5秒。
                        for (let j = 0; j < 9; j++) {
                            await click(1700, 380); // 加10级。
                            await sleep(50); // 点击后等待0.05秒。
                        }
                        await sleep(400); // 点击后等待0.4秒。
                        for (let j = 0; j < (90 - settings.roleTargetLevel1) / 10; j++) {
                            await click(1575, 380); // 减少10级。
                            await sleep(200); // 点击后等待0.2秒。
                        }
                        await keyPress("ESCAPE");
                        await sleep(2000); // 点击后等待2秒。
                    } else {
                        await click(region2.X + 978, region2.Y + 60);
                        await sleep(700);
                        await click(1800, 135);
                        await sleep(700);
                        await keyPress("ESCAPE");
                        await sleep(1000);
                    }
                }
                OCRtargettext = await performOCR({ X: 650, Y: 115, WIDTH: 195, HEIGHT: 42 });
                if (!OCRtargettext || !OCRtargettext.includes("培养计划角色列表")) {
                    break;
                }
            }
        } else {
            log.info(`无培养角色，跳过取消其他角色培养`);
        }
        const newrole = role.filter(r => !roleNameArray.includes(r));
        // 当newrole数组不为空时，执行角色搜索与逐个操作逻辑
        if (newrole.length > 0 || settings.autoFoster) {
            // 进入角色搜索界面的前置操作
            await sleep(2000);
            await click(1647, 51);
            await sleep(2000);
            log.info("已进入角色搜索界面，开始遍历目标角色列表");
            //log.info(`前：roleNameArray数组为：${JSON.stringify(roleNameArray, null, 2)}`);
            const CharacterArray = await findClickOrScroll(newrole);
            //log.info(`CharacterArray数组为：${JSON.stringify(CharacterArray, null, 2)}`);
            roleNameArray.push(...CharacterArray);
            //log.info(`后：roleNameArray数组为：${JSON.stringify(roleNameArray, null, 2)}`);
            await sleep(700); // 等待0.7秒（700毫秒）
            keyPress("ESCAPE");
            log.info("选择的所有角色已遍历完成");
            if (roleNameArray.length === 0) {
                log.info("你填写的俩个角色都未拥有");
            } else if (roleNameArray.length === 1) {
                log.info("你填写的部分角色都未拥有");
            } else {
                log.info("你填写的全部角色都全部找到");
            }
        }
        for (let i = 0; i < roleNameArray.length; i++) {
            CarryoutTask[i + 1].character = roleNameArray[i];
        }
        //log.info(`roleNameArray数组为：${JSON.stringify(roleNameArray, null, 2)}`);
        //const RequiredMaterialArray = [];
        for (let index = 0; index < roleNameArray.length; index++) {
            await sleep(700); // 等待0.7秒（700毫秒）
            await click(UpCharactercCoordinates[0].X, UpCharactercCoordinates[0].Y);
            await sleep(700); // 等待0.7秒（700毫秒）
            const result = await performOCR({ X: 775, Y: 110, WIDTH: 220, HEIGHT: 50 });
            if (!!result && !settings.autoFoster) {
                CarryoutTask[index + 1].character = result;
            }
            await StatisticsRequiredMaterial(index);

            await sleep(700); // 等待0.7秒（700毫秒）
            await click(1800, 135);
            await sleep(700); // 等待0.7秒（700毫秒）
            keyPress("ESCAPE");
            log.info(`角色：${CarryoutTask[index + 1].character}，处理完成`);
            await sleep(700);
            let OCRtargettext = await performOCR({ X: 650, Y: 115, WIDTH: 195, HEIGHT: 42 });
            //log.info(`OCRtargettext --> ${OCRtargettext}`);
            if (!OCRtargettext || !OCRtargettext.includes("培养计划角色列表")) {
                break;
            }
        }
        //log.info(`角色数组为${JSON.stringify(CarryoutTask, null, 2)}`);
        await writeJsonFile(CarryoutTask);
    } else {
        const array = readJsonFile()
        if (array && array.length != 0) {
            CarryoutTask = array;
        }
        setGameMetrics(1920, 1080, 1);
        let Identifier = false;
        await genshin.returnMainUi();
        keyPress("ESCAPE");
        await sleep(1000);
        let startTime = Date.now();
        while (Date.now() - startTime < 10000 && !Identifier) {
            const ImprovementGuide = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/提升指南.png`), 0, 0, 1920, 1080);
            const ImprovementGuideResult = await recognizeImage(ImprovementGuide);
            if (ImprovementGuideResult.success) {
                Identifier = true;
                await click(ImprovementGuideResult.x, ImprovementGuideResult.y);
                await sleep(2000);
            } else {
                log.info(`未识别到提升指南`);
                log.info(`尝试重新打开esc`);
                await genshin.returnMainUi();
                keyPress("ESCAPE");
                await sleep(1000);
            }
        }
        if (!Identifier) {
            log.info(`多次尝试仍未找到提升指南，脚本结束`);
            return null;
        }
        let OCRtargettext = await performOCR({ X: 650, Y: 115, WIDTH: 195, HEIGHT: 42 });
        log.info(`OCRtargettext --> ${OCRtargettext}`);
        if (!!OCRtargettext && OCRtargettext.includes("培养计划角色列表")) {
            for (let j = 0; j < 2; j++) {
                await click(1740, 240);
                await sleep(700);
                await click(1800, 135);
                await sleep(700);
                keyPress("ESCAPE");
                await sleep(1000);
                OCRtargettext = await performOCR({ X: 650, Y: 115, WIDTH: 195, HEIGHT: 42 });
                if (!OCRtargettext || !OCRtargettext.includes("培养计划角色列表")) {
                    break;
                }
            }
        }
    }
    await PerformOperation(CarryoutTask);
    if(settings.autoFoster){
        log.info("自动培养的角色为：{0},{1}",CarryoutTask[1].character,CarryoutTask[2].character);
    }
    log.info("请你及时上线点击升级按钮，保证材料所需被正确判断");
    log.info("脚本执行完毕，感谢使用");
})();