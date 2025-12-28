// =========================================================================
//                       Artifact.js - 圣遗物处理模块
// =========================================================================
// 此模块包含圣遗物分解、销毁、摩拉识别等功能
// 依赖：Utils.js, OCR.js

var Artifact = {
    // === 常量定义 ===
    // 矿石图片路径映射
    ORE_IMAGES: {
        amethyst_lumps: "assets/images/amethyst_lump.png",
        crystal_chunks: "assets/images/crystal_chunk.png",
        condessence_crystals: "assets/images/condessence_crystal.png"
    },
    
    // === 初始化函数 ===
    
    /**
     * 初始化圣遗物模块
     */
    init: function() {
        log.info('初始化圣遗物模块...');
        // 这里可以放置初始化代码
    },
    
    // === 圣遗物处理函数 ===
    
    /**
     * 自动分解圣遗物，同时识别当前总经验（个数）
     * @returns {Promise<number>} 分解获得的经验值
     */
    decomposeArtifacts: async function() {
        keyPress("V");
        await sleep(1000);
        await click(670, 45);
        await sleep(500);

        await OCR.recognizeTextAndClick("分解", { x: 635, y: 991, width: 81, height: 57 });
        await sleep(1000);

        // 识别已储存经验（1570-880-1650-930）
        let regionToCheck1 = { x: 1570, y: 880, width: 80, height: 50 };
        let initialNum = await OCR.recognizeTextInRegion(regionToCheck1);
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

        if (1) {
            await OCR.recognizeTextAndClick("快速选择", { x: 248, y: 996, width: 121, height: 49 });
            moveMouseTo(960, 540);
            await sleep(1000);

            await click(370, 1020); // 点击"确认选择"按钮
            await sleep(1500);

            decomposedNum = await OCR.recognizeTextInRegion(regionToCheck3);

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

            await OCR.recognizeTextAndClick("分解", { x: 635, y: 991, width: 81, height: 57 });
            await sleep(1000);
        }
        
        await OCR.recognizeTextAndClick("快速选择", { x: 248, y: 996, width: 121, height: 49 });
        moveMouseTo(960, 540);
        await sleep(1000);

        if (1) {
            await click(370, 370); // 取消选择四星
            await sleep(1000);
        }
        
        await click(370, 1020); // 点击"确认选择"按钮
        await sleep(1500);

        let decomposedNum2 = await OCR.recognizeTextInRegion(regionToCheck3);

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
        
        // 识别当前总经验
        let regionToCheck2 = { x: 1500, y: 900, width: 150, height: 100 };
        let newNum = await OCR.recognizeTextInRegion(regionToCheck2);
        let newValue = 0;

        if (newNum && !isNaN(parseInt(newNum, 10))) {
            newValue = parseInt(newNum, 10);
            log.info(`当前总经验识别成功: ${newValue}`);
        } else {
            log.warn(`在指定区域未识别到有效数字: ${newValue}`);
        }

        if (1) {
            log.info(`用户选择了分解，执行分解`);
            // 根据用户配置，分解狗粮
            await sleep(1000);
            await click(1620, 1020); // 点击分解按钮
            await sleep(1000);

            // 4. 识别"进行分解"按钮
            await click(1340, 755); // 点击进行分解按钮

            await sleep(1000);

            // 5. 关闭确认界面
            await click(1340, 755);
            await sleep(1000);
        } else {
            log.info(`用户未选择分解，不执行分解`);
        }

        // 7. 计算分解获得经验=总经验-上次剩余
        const resinExperience = Math.max(newValue - initialValue, 0);
        log.info(`分解可获得经验: ${resinExperience}`);
        
        let fourStarNum = firstNumber - firstNumber2;
        if (1) {
            log.info(`保留的四星数量: ${fourStarNum}`);
        }
        
        let resultExperience = resinExperience;
        if (resultExperience === 0) {
            resultExperience = initialValue;
        }
        
        const result = resultExperience;
        await genshin.returnMainUi();
        return result;
    },
    
    /**
     * 摧毁圣遗物换摩拉
     * @param {number} times - 处理次数
     * @returns {Promise<void>}
     */
    destroyArtifacts: async function(times = 1) {
        // 由于原代码中使用的图片不存在，这里使用OCR识别文字代替
        // 原代码使用图片识别，现在改用文字识别
        await genshin.returnMainUi();
        keyPress("V");
        await sleep(1500);

        // 尝试识别圣遗物文字
        await OCR.recognizeTextAndClick("圣遗物", { x: 100, y: 100, width: 200, height: 50 });
        await sleep(1500);

        try {
            for (let i = 0; i < times; i++) {
                // 使用文字识别代替图片识别
                await OCR.recognizeTextAndClick("摧毁", { x: 600, y: 900, width: 100, height: 50 });
                await sleep(600);
                
                await OCR.recognizeTextAndClick("自动添加", { x: 700, y: 900, width: 150, height: 50 });
                await sleep(600);
                
                await sleep(300);
                click(150, 150);
                await sleep(300);
                click(150, 220);
                await sleep(300);
                click(150, 300);
                
                if (!1) {
                    await sleep(300);
                    click(150, 370);
                }
                
                // 确认按钮
                await OCR.recognizeTextAndClick("确认", { x: 800, y: 950, width: 100, height: 50 });
                await sleep(600);
                
                // 再次确认摧毁
                await OCR.recognizeTextAndClick("摧毁", { x: 600, y: 900, width: 100, height: 50 });
                await sleep(600);
                
                // 弹出页面点击摧毁
                await OCR.recognizeTextAndClick("摧毁", { x: 900, y: 600, width: 100, height: 50 });
                await sleep(600);
                
                click(960, 1000); // 点击空白处
                await sleep(1000);
            }
        } catch (ex) {
            log.info("背包里的圣遗物已摧毁完毕，提前结束");
        } finally {
            await genshin.returnMainUi();
        }
    },
    
    /**
     * 处理狗粮分解或销毁
     * @param {number} times - 处理次数
     * @returns {Promise<number>} - 处理结果
     */
    processArtifacts: async function(times = 1) {
        await genshin.returnMainUi();
        let result = 0;
        try {
            if (1) {
                result = await this.destroyArtifacts(times);
            } else {
                result = await this.decomposeArtifacts();
            }
        } catch (error) {
            log.error(`处理狗粮分解时发生异常: ${error.message}`);
        }
        await genshin.returnMainUi();
        return result;
    },
    
    /**
     * 识别摩拉
     * @returns {Promise<number>} - 识别到的摩拉数值
     */
    mora: async function() {
        let result = 0;
        let tryTimes = 0;
        while (result === 0 && tryTimes < 3) {
            await genshin.returnMainUi();
            log.info("开始尝试识别摩拉");
            // 按下 C 键
            keyPress("C");
            await sleep(1500);
            let recognized = false;
            // 识别"角色菜单"图标或"天赋"文字
            let startTime = Date.now();
            while (Date.now() - startTime < 5000) {
                // 尝试识别"角色菜单"图标
                let characterMenuResult = await OCR.recognizeImage(OCR.CharacterMenuRo, 5000);
                if (characterMenuResult.success) {
                    await click(177, 433);
                    await sleep(500);
                    recognized = true;
                    break;
                }

                // 尝试识别"天赋"文字
                let targetText = "天赋";
                let ocrRegion = { x: 133, y: 395, width: 115, height: 70 }; // 设置对应的识别区域
                let talentResult = await OCR.recognizeTextAndClick(targetText, ocrRegion);
                if (talentResult.success) {
                    log.info(`点击天赋文字，坐标: x=${talentResult.x}, y=${talentResult.y}`);
                    recognized = true;
                    break;
                }

                await sleep(1000); // 短暂延迟，避免过快循环
            }

            let recognizedText = "";

            // 如果识别到了"角色菜单"或"天赋"，则识别"摩拉数值"
            if (recognized) {
                let ocrRegionMora = { x: 1620, y: 25, width: 152, height: 46 }; // 设置对应的识别区域
                recognizedText = await OCR.recognizeTextInRegion(ocrRegionMora);
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
    },
    
    // === 库存管理函数 ===
    
    /**
     * 获取背包中指定矿石的数量
     * @returns {Promise<Object>} 矿石数量对象 {crystal_chunks, amethyst_lumps, condessence_crystals}
     */
    getInventory: async function() {
        await sleep(1000);
        
        // 返回游戏主界面，确保界面一致性
        await genshin.returnMainUi();
        
        // 模拟按下 V 键，打开背包界面
        keyPress("V");
        
        // 等待 1 秒，确保界面加载完成
        await sleep(1000);
        
        await sleep(1000);
        
        // 点击背包界面左上角位置，确保背包界面完全展开
        click(964, 53);
        
        await sleep(1000);
        
        // 等待 0.5 秒，确保界面响应
        await sleep(500);

        // 截取当前游戏画面，用于后续图像识别
        const game_region = captureGameRegion();
        
        // 初始化结果对象，用于存储各类矿石的数量，默认值为 0
        const inventory_result = {
            crystal_chunks: 0,
            condessence_crystals: 0,
            amethyst_lumps: 0
        };
        
        // 遍历矿石图片映射表，进行模板匹配识别
        for (const [name, path] of Object.entries(this.ORE_IMAGES)) {
            try {
                // 创建模板匹配识别对象，读取对应矿石图片
                let match_obj = RecognitionObject.TemplateMatch(file.ReadImageMatSync(path));
                
                // 设置匹配阈值，0.85 表示匹配度需达到 85% 以上才认为是有效匹配
                match_obj.threshold = 0.85;
                
                // 使用三通道（RGB）进行匹配，提高识别准确性
                match_obj.Use3Channels = true;
                
                // 在当前游戏画面中进行模板匹配，寻找矿石图标
                const match_res = game_region.Find(match_obj);
                
                // 如果找到匹配结果
                if (match_res.isExist()) {
                    // 打印日志，输出矿石名称及其在屏幕上的坐标
                    log.debug(`Found ${name} image at (${match_res.x}, ${match_res.y})`);

                    // 计算矿石数量文本区域的坐标和尺寸
                    // 文本区域位于矿石图标下方约 120 像素处，宽度 120，高度 40
                    const text_x = match_res.x - 0;
                    const text_y = match_res.y + 120;
                    const text_w = 120;
                    const text_h = 40;

                    // 使用 OCR 识别文本区域内的数字（矿石数量）
                    const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));

                    // 如果 OCR 识别成功
                    if (ocr_res) {
                        // 将识别到的文本转换为数字，并保存到结果对象中
                        inventory_result[name] = Number(ocr_res.text);
                    }
                }
            } catch (error) {
                log.error(`识别矿石 ${name} 时出错: ${error.message}`);
            }
        }
        
        // 识别完成后，返回游戏主界面
        await genshin.returnMainUi();

        await sleep(1000);
        
        await sleep(1000);
        
        // 返回矿石数量结果对象
        return inventory_result;
    },
    
    // === 数据记录函数 ===
    
    /**
     * 写入挖矿记录
     * @param {Object} original_inventory - 原始库存
     * @param {Object} current_inventory - 当前库存
     * @param {number} running_minutes - 运行时间（分钟）
     * @param {number} accurate_yield - 总收获量
     * @param {string} accountName - 账户名称
     * @returns {Promise<Object>} 挖矿数据
     */
    writeRecord: async function(original_inventory, current_inventory, running_minutes, accurate_yield, accountName = '默认账户') {
        const recordFilePath = `records/${accountName}.txt`;

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
     * 保存挖矿数据到本地文件
     * @param {Object} original_inventory - 原始库存
     * @param {Object} current_inventory - 当前库存
     * @param {number} running_minutes - 运行时间（分钟）
     * @param {number} accurate_yield - 总收获量
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
if (typeof genshin !== 'undefined') {
    Artifact.init();
}