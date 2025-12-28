// =========================================================================
//                       PathManager.js - 路径处理与文件管理模块
// =========================================================================
// 此模块包含路径处理、文件操作、记录管理等功能
// 依赖：Utils.js, OCR.js

var PathManager = {
    // === 常量定义 ===
    PATHING_FOLDER: 'pathing',
    PATHING_OUT_FOLDER: 'pathingOut',
    RECORDS_FOLDER: 'records',
    ASSETS_FOLDER: 'assets',
    
    // === 初始化函数 ===
    
    /**
     * 初始化路径管理器
     */
    init: function() {
        log.info('初始化路径管理器...');
        // 确保必要的文件夹存在
        this._ensureFolders();
    },
    
    // === 文件夹管理函数 ===
    
    /**
     * 确保必要的文件夹存在
     */
    _ensureFolders: function() {
        const folders = [
            this.PATHING_FOLDER,
            this.PATHING_OUT_FOLDER,
            this.RECORDS_FOLDER,
            this.ASSETS_FOLDER
        ];
        
        for (const folder of folders) {
            try {
                // 检查文件夹是否存在
                file.ReadPathSync(folder);
                log.debug(`文件夹已存在: ${folder}`);
            } catch (error) {
                // 文件夹不存在，创建它
                log.info(`创建文件夹: ${folder}`);
                // 注意：原API中没有创建文件夹的函数，这里假设文件夹已存在
                // 在实际使用中，可能需要手动创建这些文件夹
            }
        }
    },
    
    // === 文件操作函数 ===
    
    /**
     * 递归读取文件夹内容
     * @param {string} folderPath 目标文件夹路径
     * @param {boolean} onlyJson 是否只返回JSON文件
     * @returns {Array<{fullPath: string, fileName: string, folderPathArray: string[]}>} 文件信息数组
     */
    readFolder: async function(folderPath, onlyJson) {
        const stack = [folderPath]; // DFS栈
        const results = [];
        
        while (stack.length > 0) {
            const currentPath = stack.pop();
            const items = file.ReadPathSync(currentPath);
            const subDirs = [];
            
            for (const itemPath of items) {
                if (file.IsFolder(itemPath)) {
                    subDirs.push(itemPath); // 收集子目录
                } else if (!onlyJson || itemPath.endsWith(".json")) {
                    // 提取文件名和路径信息
                    const pathParts = itemPath.split('\\');
                    results.push({
                        fullPath: itemPath,
                        fileName: pathParts.pop(), // 最后一部分是文件名
                        folderPathArray: pathParts // 剩余部分是路径
                    });
                }
            }
            
            // 子目录逆序入栈（保证处理顺序）
            stack.push(...subDirs.reverse());
        }
        return results;
    },
    
    /**
     * 扫描pathing文件夹下全部.json路径文件，并按文件夹名分组
     * @returns {Object} 形如 { 文件夹名: [路径对象, ...], ... }
     */
    processPathings: async function() {
        // 递归读取所有JSON文件
        const allFiles = await this.readFolder(this.PATHING_FOLDER, true);
        const folderGroups = {};

        for (const file of allFiles) {
            // 取第二层文件夹名作为分组依据（如 pathing/枫丹/xxx.json -> 枫丹）
            const folderName = file.folderPathArray.length > 1
                ? file.folderPathArray[1]
                : "默认组"; // 如果没有子文件夹则归为默认组

            // 初始化分组数组
            if (!folderGroups[folderName]) {
                folderGroups[folderName] = [];
            }

            // 构建路径对象并添加到对应分组
            folderGroups[folderName].push({
                fullPath: file.fullPath,        // 文件绝对路径
                fileName: file.fileName,          // 文件名（不含路径）
                folderName: folderName,           // 所属文件夹名
                map_name: "Teyvat",               // 默认地图名称
                tags: [],                         // 预留标签字段
                t: 1,                             // 默认单条路线耗时（分钟）
                records: [],                      // 历史执行记录数组
                killStats: { elite: 0, mob: 0 }   // 击杀统计（精英怪/普通怪）
            });
        }
        return folderGroups;
    },
    
    /**
     * 按分组导出路径文件到pathingOut目录
     * @param {Object} folderGroups 路线分组
     * @returns {Promise<void>}
     */
    copyPathingsByGroup: async function(folderGroups) {
        for (const [groupName, pathList] of Object.entries(folderGroups)) {
            const targetDir = `${this.PATHING_OUT_FOLDER}/${groupName}`;
            
            // 注意：原API中没有创建文件夹的函数，这里假设文件夹已存在
            // 在实际使用中，可能需要手动创建目标文件夹
            
            for (const pathing of pathList) {
                try {
                    // 读取原始文件内容
                    const content = await file.readText(pathing.fullPath);
                    // 写入目标路径（覆盖模式）
                    await file.writeText(`${targetDir}/${pathing.fileName}`, content, false);
                    log.debug(`复制文件: ${pathing.fileName} -> ${targetDir}`);
                } catch (error) {
                    log.error(`文件复制失败: ${pathing.fileName} -> ${error.message}`);
                }
            }
        }
    },
    
    // === 记录管理函数 ===
    
    /**
     * 异步函数，用于将变量内容写回到文件
     * @param {string} startRunDate 上次运行开始日期
     * @param {Date} startTime 上次开始时间
     * @param {string} RunWorldCount 上次运行世界数量
     * @param {string} mobKilled 上次运行精英数量
     * @param {string} eliteKilled 上次运行小怪数量
     * @param {string[]} records 历史收益记录
     * @param {boolean} finished 上次运行是否完成
     * @param {string} version js版本
     * @param {string} recordFilePath 记录文件路径
     * @returns {Promise<void>}
     */
    writeRecordFile: async function(
        startRunDate, 
        startTime, 
        RunWorldCount, 
        mobKilled, 
        eliteKilled, 
        records, 
        finished = false, 
        version = manifest.version, 
        recordFilePath = "records/record.txt"
    ) {
        try {
            // 构造要写入文件的内容
            const content = [
                `上次运行开始日期: ${startRunDate}`,
                `上次开始时间: ${startTime.toISOString()}`,
                `上次运行世界数量: ${RunWorldCount}`,
                `上次运行精英数量: ${mobKilled}`,
                `上次运行小怪数量: ${eliteKilled}`,
                `上次运行是否完成: ${finished}`,
                `js版本: ${version}`,
                "历史收益："
            ].concat(records).join('\n');

            // 异步写入文件
            const result = await file.writeText(recordFilePath, content, false); // 覆盖写入
            if (result) {
                log.info("文件写入成功");
            } else {
                log.error("文件写入失败");
            }
        } catch (error) {
            log.error(`写入文件时出错: ${error}`);
        }
    },
    
    /**
     * 写入运行记录
     * @param {Object} original_inventory 原始库存
     * @param {Object} current_inventory 当前库存
     * @param {number} running_minutes 运行时间（分钟）
     * @param {number} accurate_yield 总收获量
     * @param {string} accountName 账户名称
     * @returns {Promise<void>}
     */
    writeRecord: async function(original_inventory, current_inventory, running_minutes, accurate_yield, accountName = '默认账户') {
        const recordFilePath = `${this.RECORDS_FOLDER}/${accountName}.txt`;

        const lines = [
            `开始路线时间: ${ new Date().toISOString()}`,
            `所用时间: ${running_minutes.toFixed(2)}`,
            `运行前数量: ${original_inventory.condessence_crystals}`,
            `运行后数量: ${current_inventory.condessence_crystals}`,
            `总收获量数量: ${accurate_yield}`
        ];

        const content = lines.join('\n');

        try {
            await file.writeText(recordFilePath, content, false);
            log.info(`记录已写入 ${recordFilePath}`);
        } catch (e) {
            log.error(`写入 ${recordFilePath} 失败:`, e);
        }
    },
    
    /**
     * 初始化冷却时间记录
     * @param {Object} folderGroups 路线分组
     * @param {string} accountName 账户名称
     * @returns {Promise<void>}
     */
    initializeCdTime: async function(folderGroups, accountName) {
        try {
            const recordFile = `${this.RECORDS_FOLDER}/${accountName}.json`;
            const data = JSON.parse(await file.readText(recordFile));
            
            // 将文件记录同步到内存
            for (const pathList of Object.values(folderGroups)) {
                for (const pathing of pathList) {
                    const record = data.find(r => r.fileName === pathing.fileName);
                    pathing.records = record?.records || [];
                }
            }
        } catch (error) {
            // 文件不存在时初始化空记录
            log.info(`初始化冷却时间记录: ${error.message}`);
            for (const pathList of Object.values(folderGroups)) {
                for (const pathing of pathList) {
                    pathing.records = [];
                }
            }
        }
    },
    
    /**
     * 更新并保存路线记录
     * @param {Object} folderGroups 路线分组
     * @param {string} accountName 账户名称
     * @returns {Promise<void>}
     */
    updateRecords: async function(folderGroups, accountName) {
        const records = [];
        
        // 收集所有路线数据
        for (const pathList of Object.values(folderGroups)) {
            for (const pathing of pathList) {
                records.push({
                    fileName: pathing.fileName,
                    group: pathing.folderName,
                    records: pathing.records,
                    executedCount: pathing.records.length // 执行次数=记录条数
                });
            }
        }
        
        // 写入记录文件
        const recordFile = `${this.RECORDS_FOLDER}/${accountName}.json`;
        await file.writeText(recordFile, JSON.stringify(records, null, 2), false);
        log.debug(`更新记录文件: ${recordFile}`);
    },
    
    /**
     * 处理所有分组的所有路线
     * @param {Object} folderGroups 路线分组
     * @param {string} accountName 账户名称
     * @returns {Promise<void>}
     */
    processGroups: async function(folderGroups, accountName) {
        // 1. 加载OCR过滤名单
        const pickupConfig = JSON.parse(await file.readText(`${this.ASSETS_FOLDER}/拾取名单.json`));
        const whitelist = pickupConfig['白名单'];
        const blacklist = pickupConfig['黑名单'];

        // 2. 加载击杀统计模板
        const templateData = JSON.parse(await file.readText(`${this.ASSETS_FOLDER}/index1.json`));
        const killTemplate = new Map(templateData.map(item => [item.fileName, item]));

        // 3. 准备全局标记
        let isFirstRoute = true;

        // 3.1 计算【全局】总路线条数，用于判断最后一条
        const allRoutes = Object.values(folderGroups).flat();
        const totalRoutes = allRoutes.length;
        let handledRoutes = 0;

        // 4. 遍历所有分组
        for (const [groupName, pathList] of Object.entries(folderGroups)) {
            log.info(`处理分组: ${groupName} (${pathList.length}条路线)`);

            // 5. 遍历组内每条路线
            for (const pathing of pathList) {
                // 5.1 初始化路线数据
                pathing.killStats ??= { elite: 0, mob: 0 };
                pathing.records ??= [];

                log.info(`执行路线: ${pathing.fileName}`);

                // 5.2 执行路线并计时
                const startTime = Date.now();
                dispatcher.addTimer(new RealtimeTimer('AutoPick', { forceInteraction: true }));
                await this.runPath(pathing.fullPath, whitelist, blacklist);

                // 5.3 全局仅第一次跑完后说话
                if (isFirstRoute) {
                    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                    await this.saySomething('谢谢你(✿◡‿◡)');
                    await this.saySomething('需要点时间，要我退就叫我好啦');
                    dispatcher.addTimer(new RealtimeTimer('AutoPick', { forceInteraction: true }));
                    isFirstRoute = false;
                }

                const durationSec = Math.round((Date.now() - startTime) / 1000);

                // 5.4 获取击杀数据
                const template = killTemplate.get(pathing.fileName);
                const eliteKills = template?.精英数量 || 0;
                const mobKills = template?.小怪数量 || 0;

                // 5.5 更新统计数据
                pathing.killStats.elite += eliteKills;
                pathing.killStats.mob += mobKills;

                // 5.6 添加执行记录
                pathing.records.push({
                    executedAt: new Date().toLocaleString(),
                    durationSec,
                    eliteKilled: eliteKills,
                    mobKilled: mobKills
                });

                // 5.7 实时保存记录
                await this.updateRecords(folderGroups, accountName);

                /* 5.8 路线后置检查 */
                // 如果不在正常界面，直接结束整个函数
                await genshin.returnMainUi();
                await sleep(700);
                if (!(await OCR.f2_2pAndpaimonMenuRo())) { // 注意：这里依赖OCR模块
                    log.warn('检测到不在正常界面，提前退出');
                    return;
                }

                // 更新已处理计数
                handledRoutes += 1;
            }
        }
    },
    
    /**
     * 运行单条路径文件，并可选进行OCR识别自动拾取
     * @param {string} pathFilePath       路径文件绝对路径
     * @param {string[]} whitelistKeywords OCR白名单关键词
     * @param {string[]} blacklistKeywords OCR黑名单关键词
     * @returns {Promise<void>}
     */
    runPath: async function(pathFilePath, whitelistKeywords, blacklistKeywords) {
        // ------------------ 状态变量 ------------------
        let thisMoveUpTime = 0;            // 第一次下翻的时间戳
        let lastMoveDown = 0;              // 最后一次下翻时间戳
        let lastPickupTime = new Date();   // 上次拾取时间（防重复日志）
        let lastPickupItem = "";           // 上次拾取物品名（防重复日志）
        
        // 拾取时间常量
        const timeMoveUp = 500;    // 向上滚动等待时间
        const timeMoveDown = 1000; // 向下滚动等待时间

        // 共享状态对象，用于任务间通信
        const state = {
            completed: false,       // 路径是否执行完成
            cancelRequested: false, // 是否请求取消任务
            atMainUi: false,        // 是否在主界面状态
            lastCheckMainUi: new Date() // 上次检查主界面时间
        };

        // =========================================================================
        //                            内部工具函数
        // =========================================================================
        
        /**
         * 判断当前是否处于游戏主界面
         * @returns {Promise<boolean>} 是否在主界面
         */
        async function isMainUI() {
            const MAIN_UI_IMAGE = `${PathManager.ASSETS_FOLDER}/ui/MainUI.png`;
            const SCAN_REGION = { x: 0, y: 0, width: 150, height: 150 };
            const MAX_ATTEMPTS = 2;
            
            let attempts = 0;
            while (attempts < MAX_ATTEMPTS && !state.cancelRequested) {
                try {
                    const template = file.ReadImageMatSync(MAIN_UI_IMAGE);
                    const recognizer = RecognitionObject.TemplateMatch(
                        template,
                        SCAN_REGION.x,
                        SCAN_REGION.y,
                        SCAN_REGION.width,
                        SCAN_REGION.height
                    );
                    
                    // 在游戏区域查找匹配项
                    const result = captureGameRegion().find(recognizer);
                    if (result.isExist()) return true;
                    
                    attempts++;
                    await sleep(2); // 短暂等待后重试
                } catch (error) {
                    // 检查是否是任务取消错误
                    if (error.message && error.message.includes("was canceled")) {
                        log.debug(`主界面识别任务被取消`);
                        keyPress('VK_ESCAPE');   // 正确的Esc键编码

                        return false;
                    }
                    log.error(`主界面识别异常: ${error.message}`);
                    return false;
                }
            }
            return false;
        }

        /**
         * 执行路径文件的核心逻辑
         */
        async function executePathFile() {
            try {
                // 调用外部路径脚本执行文件
                await pathingScript.runFile(pathFilePath);
                await sleep(1); // 防止CPU过载
            } catch (error) {
                log.error(`路径执行失败: ${error.message}`);
                state.cancelRequested = true; // 出错时取消任务
            } finally {
                state.completed = true; // 标记路径完成
            }
        }

        // =========================================================================
        //                        OCR 交互核心逻辑(F拾取_自义定)
        // =========================================================================
        
        /**
         * 持续检测并处理交互项（按F拾取）
         */
        async function performOcrAndInteract() {
            // 立即检查是否已被取消
            if (state.cancelRequested) {
                return;
            }
            
            // OCR配置常量
            const F_ICON_PATH = `${PathManager.ASSETS_FOLDER}/ui/F_Dialogue.png`;
            const OCR_REGION = {
                x: 1102, y: 335, width: 34, height: 400 // F图标检测区域
            };
            const TEXT_REGION = {
                xMin: 1210, xMax: 1412, // 文本识别横向范围
                yTolerance: 30           // 文本与图标纵向最大偏差
            };

            /**
             * 在指定区域执行OCR识别
             * @param {string[]} keywords 关键词白名单
             * @param {{min:number, max:number}} yRange 垂直检测范围
             * @param {number} timeout 超时时间(ms)
             */
            async function performOcr(keywords, yRange, timeout = 200) {
                const startTime = Date.now();
                while (Date.now() - startTime < timeout) {
                    try {
                        const ra = captureGameRegion();
                        const ocrWidth = TEXT_REGION.xMax - TEXT_REGION.xMin;
                        const ocrHeight = yRange.max - yRange.min;
                        
                        // 创建OCR识别对象
                        const ocrObj = RecognitionObject.ocr(
                            TEXT_REGION.xMin,
                            yRange.min,
                            ocrWidth,
                            ocrHeight
                        );
                        
                        // 执行识别并过滤结果
                        const results = [];
                        const resList = ra.findMulti(ocrObj);
                        
                        for (let i = 0; i < resList.count; i++) {
                            const res = resList[i];
                            const text = res.text;
                            
                            // 白名单为空或匹配任意关键词
                            if (keywords.length === 0 || keywords.some(kw => text.includes(kw))) {
                                results.push({
                                    text,
                                    x: res.x,
                                    y: res.y,
                                    width: res.width,
                                    height: res.height
                                });
                            }
                        }
                        return results;
                    } catch (error) {
                        log.error(`OCR识别异常: ${error.message}`);
                        return [];
                    }
                }
                return []; // 超时返回空
            }

            /**
             * 查找F交互图标
             */
            async function findFIcon(timeout = 500) {
                const startTime = Date.now();
                while (Date.now() - startTime < timeout && !state.cancelRequested) {
                    try {
                        const template = file.ReadImageMatSync(F_ICON_PATH);
                        const recognizer = RecognitionObject.TemplateMatch(
                            template,
                            OCR_REGION.x,
                            OCR_REGION.y,
                            OCR_REGION.width,
                            OCR_REGION.height
                        );
                        
                        const result = captureGameRegion().find(recognizer);
                        if (result.isExist()) {
                            return {
                                x: result.x,
                                y: result.y,
                                width: result.width,
                                height: result.height
                            };
                        }
                        await sleep(2); // 避免CPU过载
                    } catch (error) {
                        // 检查是否是任务取消错误
                        if (error.message && error.message.includes("was canceled")) {

                            log.debug(`F图标识别任务被取消`);
                        keyPress('VK_ESCAPE');   // 正确的Esc键编码
                            return null;
                        }
                        log.error(`F图标识别异常: ${error.message}`);
                        return null;
                    }
                }
                return null; // 未找到或超时
            }

            // ========================== OCR主循环 ==========================
            while (!state.completed && !state.cancelRequested) {
                try {
                    // 1. 查找F交互图标
                    const fIcon = await findFIcon(200);
                    
                    if (!fIcon) {
                        // 检查是否被取消
                        if (state.cancelRequested) break;
                        
                        // 1.1 未找到F图标时检查主界面状态
                        try {
                            state.atMainUi = await isMainUI();
                            state.lastCheckMainUi = new Date();
                        } catch (error) {
                            if (error.message && error.message.includes('was canceled')) {
                                state.cancelRequested = true;
                                break;
                            }
                            // 记录其他错误但继续执行
                            log.warn(`检查主界面时出错: ${error.message}`);
                        }
                        
                        if (state.atMainUi && !state.cancelRequested) {
                            // 在主界面时向下滚动寻找物品
                            try {
                                await keyMouseScript.runFile(`${PathManager.ASSETS_FOLDER}/scripts/滚轮下翻.json`);
                            } catch (error) {
                                if (error.message && error.message.includes('was canceled')) {
                                    state.cancelRequested = true;
                                    break;
                                }
                            }
                        }
                        continue;
                    }

                    // 2. 计算F图标中心位置
                    const iconCenterY = fIcon.y + fIcon.height / 2;
                    
                    // 3. 在F图标周围识别文本
                    const textDetectionArea = {
                        min: fIcon.y - TEXT_REGION.yTolerance,
                        max: fIcon.y + fIcon.height + TEXT_REGION.yTolerance * 2
                    };
                    
                    const ocrResults = await performOcr(
                        whitelistKeywords,
                        textDetectionArea,
                        200
                    );

                    // 4. 处理识别结果
                    let foundValidItem = false;
                    for (const item of ocrResults) {
                        // 4.1 黑名单过滤
                        const isBlacklisted = blacklistKeywords.some(kw => item.text.includes(kw));
                        if (isBlacklisted) continue;
                        
                        // 4.2 避免重复日志（1秒内相同物品不重复记录）
                        const isNewItem = item.text !== lastPickupItem;
                        const timeSinceLast = Date.now() - lastPickupTime;
                        if (isNewItem || timeSinceLast > 1000) {
                            log.info(`发现可交互项: "${item.text}"`);
                            lastPickupItem = item.text;
                            lastPickupTime = Date.now();
                        }
                        
                        // 4.3 检查文本与图标的垂直对齐
                        const textCenterY = item.y + item.height / 2;
                        if (Math.abs(textCenterY - iconCenterY) <= TEXT_REGION.yTolerance) {
                            keyPress("F"); // 执行交互
                            await sleep(5); // 等待交互完成
                            foundValidItem = true;
                            break; // 每次只交互一个项目
                        }
                    }

                    // 5. 未找到有效交互项时滚动屏幕
                    if (!foundValidItem) {
                        const now = Date.now();
                        
                        // 5.1 滚动逻辑控制
                        if (now - lastMoveDown > timeMoveUp) {
                            // 向下滚动（寻找更多物品）
                            try {
                                await keyMouseScript.runFile(`${PathManager.ASSETS_FOLDER}/scripts/滚轮下翻.json`);
                            } catch (error) {
                                if (error.message && error.message.includes('was canceled')) {
                                    state.cancelRequested = true;
                                    break;
                                }
                            }
                            
                            // 记录首次下翻时间
                            if (thisMoveUpTime === 0) thisMoveUpTime = now;
                            
                            // 检查是否需要重置滚动状态
                            if (now - thisMoveUpTime >= timeMoveDown) {
                                lastMoveDown = now;
                                thisMoveUpTime = 0; // 重置计时器
                            }
                        } else {
                            // 向上滚动（返回确认）
                            try {
                                await keyMouseScript.runFile(`${PathManager.ASSETS_FOLDER}/scripts/滚轮上翻.json`);
                            } catch (error) {
                                if (error.message && error.message.includes('was canceled')) {
                                    state.cancelRequested = true;
                                    break;
                                }
                            }
                        }
                    }
                } catch (error) {
                    if (error.message && error.message.includes('was canceled')) {
                        log.debug(`OCR任务被取消，退出循环`);
                        state.cancelRequested = true;
                        break;
                    }
                    log.error(`OCR主循环异常: ${error.message}`);
                    // 继续尝试，不退出
                }
            }
            
            log.debug(`OCR交互任务结束，取消状态: ${state.cancelRequested}`);
        }

        // ------------------ 任务启动区 ------------------
        try {
            // 并行执行路径任务和OCR任务
            const tasks = [executePathFile()];
            
            // 根据拾取模式决定是否启用OCR
            const pickupMode = "js拾取，默认只拾取狗粮和晶蝶";
            if (pickupMode === "js拾取，默认只拾取狗粮和晶蝶") {
                tasks.push(performOcrAndInteract());
            }
            
            // 等待所有任务完成
            await Promise.allSettled(tasks);
        } catch (error) {
            log.error(`任务执行异常: ${error.message}`);
        } finally {
            // 确保状态正确清理
            state.completed = true;
            state.cancelRequested = true;
        }
    },
    
    // === 辅助函数 ===
    
    /**
     * 发送聊天消息
     * @param {string} say 消息内容
     * @returns {Promise<void>}
     */
    saySomething: async function(say = ' ') {
        // 注意：这个函数实际上应该属于聊天模块，但原代码放在这里
        // 暂时保留在这里以保持兼容性
        try {
            if (await OCR.f2_2pAndpaimonMenuRo()) {
                await sleep(700);
                await genshin.returnMainUi();

                await sleep(700);
                keyPress('VK_RETURN');   // 正确的Enter键编码
                await sleep(200);
                keyPress('VK_RETURN');   // 正确的Enter键编码
                await sleep(700);

                inputText(say);
                await sleep(700);
                keyPress('VK_RETURN');   // 正确的Enter键编码

                await sleep(700);
                keyPress('VK_ESCAPE');   // 正确的Esc键编码
                await sleep(700);
                await genshin.returnMainUi();
            }
        } catch (error) {
            if (!Utils.isTaskCanceledError(error)) {
                log.error(`发送消息异常: ${error.message}`);
            }
        }
    },
    
    // === 实用工具函数 ===
    
    /**
     * 获取OCR关键词列表
     * @param {string} enemyType 敌人类型
     * @returns {string[]} 关键词列表
     */
    getOcrKeywords: function(enemyType = "盗宝团") {
        // 这里是一个示例，实际使用时需要根据 enemyType 返回不同的关键词
        const keywordMap = {
            "盗宝团": ["盗宝团", "宝箱", "宝藏"],
            "愚人众": ["愚人众", "执行官", "债务处理人"],
            "丘丘人": ["丘丘人", "丘丘", "萨满"],
            "深渊": ["深渊", "使徒", "咏者"]
        };
        
        return keywordMap[enemyType] || [enemyType];
    },
    
    /**
     * 保存挖矿数据到本地文件
     * @param {Object} original_inventory 原始库存
     * @param {Object} current_inventory 当前库存
     * @param {number} running_minutes 运行时间（分钟）
     * @param {number} accurate_yield 总收获量
     * @returns {Promise<Object>} 挖矿数据对象
     */
    saveMiningData: async function(original_inventory, current_inventory, running_minutes, accurate_yield) {
        // 计算每种矿石的增量
        const delta_crystal = current_inventory.crystal_chunks - original_inventory.crystal_chunks;
        const delta_amethyst = current_inventory.amethyst_lumps - original_inventory.amethyst_lumps;
        const delta_condessence = current_inventory.condessence_crystals - original_inventory.condessence_crystals;

        // 创建数据对象，包含时间戳、运行时长、各种矿石的增量和总量
        const miningData = {
            timestamp: new Date().toISOString(), // ISO格式的时间戳
            running_minutes: running_minutes.toFixed(2), // 运行时长（分钟），保留两位小数
            delta_crystal: delta_crystal, // 水晶块增量
            delta_amethyst: delta_amethyst, // 紫晶块增量
            delta_condessence: delta_condessence, // 萃凝晶增量
            total_crystal: current_inventory.crystal_chunks, // 水晶块总量
            total_amethyst: current_inventory.amethyst_lumps, // 紫晶块总量
            total_condessence: current_inventory.condessence_crystals, // 萃凝晶总量
            accurate_yield: accurate_yield // 总收获量（所有矿石增量之和）
        };

        // 定义数据文件路径
        const dataFilePath = "local/mining_data.json";
        
        let existingData = [];
        try {
            // 尝试读取现有数据文件
            const fileContent = await file.readText(dataFilePath);
            existingData = JSON.parse(fileContent);
        } catch (error) {
            // 如果文件不存在或读取失败，创建空数组
            existingData = [];
        }
        
        // 将新数据添加到现有数据数组中
        existingData.push(miningData);
        
        try {
            // 将更新后的数据写回文件
            await file.writeText(dataFilePath, JSON.stringify(existingData, null, 2));
            log.info("挖矿数据已保存到: {a}", dataFilePath);
        } catch (error) {
            log.error("保存挖矿数据失败: {a}", error.message);
        }
        
        return miningData;
    }
};

// 自动初始化
if (typeof file !== 'undefined') {
    PathManager.init();
}