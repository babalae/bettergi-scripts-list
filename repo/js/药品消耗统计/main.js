function mapRecordMode(modeText) {
    switch (modeText) {
        case "仅记录库存":
            return "snapshot";
        case "记录并计算消耗":
            return "record";
        case "重新初始化":
            return "init";
        default:
            return "record";
    }
}
let userName = settings.userName || "默认账户";
const recoveryFoodName = settings.recoveryFoodName || "回血药名字没填";
const resurrectionFoodName = settings.resurrectionFoodName || "复活药名字没填";
const currentMode = mapRecordMode(settings.recordMode); // mode: "init" | "record" | "snapshot"
const ocrRegion = {
    x: 150,
    y: 250,
    width: 220,
    height: 270
};

(async function () {
    // 检验账户名
    async function getUserName() {
        userName = userName.trim();
        // 数字，中英文，长度在20个字符以内
        if (!userName || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(userName)) {
            log.error(`账户名${userName}违规，暂时使用默认账户名，请查看readme后修改`)
            userName = "默认账户";
        }
        return userName;
    }

    // 格式化日期时间为 YYYY/MM/DD HH:mm:ss
    async function formatDateTime(date) {
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    }

    // 处理旧格式记录文件（迁移功能保留）
    async function migrateOldFormatRecords(filePath) {
        try {
            const content = await file.readText(filePath);
            const lines = content.split('\n').filter(line => line.trim());

            // 检查是否有旧格式的记录（如2025-12-10T02:02:32.460Z|179|546）
            const hasOldFormat = lines.some(line =>
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|\d+\|\d+$/.test(line)
            );

            if (hasOldFormat) {
                // 直接清空文件（不创建备份）
                await file.writeText(filePath, '');
                notification.send(`${settings.userName}: 检测到旧格式记录，已重置记录文件`);
                return true;
            }
        } catch (error) {
            // 文件不存在或其他错误
        }
        return false;
    }

    /**
     * 文字OCR识别封装函数（支持空文本匹配任意文字）
     * @param {string} text - 要识别的文字，默认为"空参数"，空字符串会匹配任意文字
     * @param {number} timeout - 超时时间，单位为秒，默认为10秒
     * @param {number} afterBehavior - 点击模式，0=不点击，1=点击文字位置，2=按F键，默认为0
     * @param {number} debugmodel - 调试模式，0=无输出，1=基础日志，2=详细输出，3=立即返回，默认为0
     * @param {number} x - OCR识别区域起始X坐标，默认为0
     * @param {number} y - OCR识别区域起始Y坐标，默认为0
     * @param {number} w - OCR识别区域宽度，默认为1920
     * @param {number} h - OCR识别区域高度，默认为1080
     * @param {number} matchMode - 匹配模式，0=包含匹配，1=精确匹配，默认为0
     * @returns {object} 包含识别结果的对象 {text, x, y, found}
     */
    async function textOCREnhanced(
        text = "空参数",
        timeout = 10,
        afterBehavior = 0,
        debugmodel = 0,
        x = 0,
        y = 0,
        w = 1920,
        h = 1080,
        matchMode = 0
    ) {
        const startTime = Date.now();
        const timeoutMs = timeout * 1000;
        let lastResult = null;
        let captureRegion = null; // 用于存储截图对象

        // 只在调试模式1下输出基本信息
        if (debugmodel === 1) {
            if (text === "") {
                log.info(`OCR: 空文本模式 - 匹配任意文字`);
            } else if (text === "空参数") {
                log.warn(`OCR: 使用默认参数"空参数"`);
            }
        }

        while (Date.now() - startTime < timeoutMs) {
            try {
                // 获取截图并进行OCR识别
                captureRegion = captureGameRegion();
                const resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));

                // 遍历识别结果
                for (let i = 0; i < resList.count; i++) {
                    const res = resList[i];

                    // 检查是否匹配
                    let isMatched = false;
                    if (text === "") {
                        // 空文本匹配任意文字
                        isMatched = true;
                    } else if (matchMode === 1) {
                        // 精确匹配
                        isMatched = res.text === text;
                    } else {
                        // 包含匹配（默认）
                        isMatched = res.text.includes(text);
                    }

                    if (isMatched) {
                        // 只在调试模式1下输出匹配成功信息
                        if (debugmodel === 1) {
                            log.info(`OCR成功: "${res.text}" 位置(${res.x},${res.y})`);
                        }

                        // 调试模式3: 立即返回
                        if (debugmodel === 3) {
                            // 释放内存
                            if (captureRegion) {
                                captureRegion.dispose();
                            }
                            return { text: res.text, x: res.x, y: res.y, found: true };
                        }

                        // 执行后续行为
                        switch (afterBehavior) {
                            case 1: // 点击文字位置
                                await sleep(1000);
                                click(res.x, res.y);
                                break;
                            case 2: // 按F键
                                await sleep(100);
                                keyPress("F");
                                break;
                            default:
                                // 不执行任何操作
                                break;
                        }

                        // 记录最后一个匹配结果但不立即返回
                        lastResult = { text: res.text, x: res.x, y: res.y, found: true };
                    }
                }

                // 释放截图对象内存
                if (captureRegion) {
                    captureRegion.dispose();
                }

                // 如果找到匹配结果，根据调试模式决定是否立即返回
                if (lastResult && debugmodel !== 2) {
                    return lastResult;
                }

                // 短暂延迟后继续下一轮识别
                await sleep(100);

            } catch (error) {
                // 发生异常时释放内存
                if (captureRegion) {
                    captureRegion.dispose();
                }
                log.error(`OCR异常: ${error.message}`);
                await sleep(100);
            }
        }

        if (debugmodel === 1) {
            // 超时处理
            if (text === "") {
                log.info(`OCR超时: ${timeout}秒内未找到任何文字`);
            } else {
                log.info(`OCR超时: ${timeout}秒内未找到"${text}"`);
            }
        }

        // 返回最后一个结果或未找到
        return lastResult || { found: false };
    }

    // 背包过期物品识别
    async function handleExpiredItems() {
        const ifGuoqi = await textOCREnhanced("物品过期", 1.5, 0, 3, 870, 280, 170, 40);
        if (ifGuoqi.found) {
            log.info("检测到过期物品，正在处理...");
            await sleep(500);
            click(980, 750); // 点击确认按钮，关闭提示
        }
        else { log.info("未检测到过期物品"); }
    }

    async function recognizeNumberByOCR(ocrRegion, pattern) {
        let captureRegion = null;
        try {
            const ocrRo = RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
            captureRegion = captureGameRegion();
            const resList = captureRegion.findMulti(ocrRo);

            if (!resList || resList.length === 0) {
                log.warn("OCR未识别到任何文本");
                return null;
            }

            for (const res of resList) {
                if (!res || !res.text) {
                    continue;
                }

                const numberMatch = res.text.match(pattern);
                if (numberMatch) {
                    const number = parseInt(numberMatch[1] || numberMatch[0]);
                    if (!isNaN(number)) {
                        return number;
                    }
                }
            }
        }
        catch (error) {
            log.error(`OCR识别时发生异常: ${error.message}`);
        }
        finally {
            if (captureRegion) {
                captureRegion.dispose();
            }
        }
        return null;
    }

    // 获取食物数量（核心功能）
    async function getFoodNum() {
        keyPress("B");//打开背包
        await handleExpiredItems(); //处理过期物品弹窗
        await sleep(2000);
        click(863, 51);//选择食物
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(110, 110);//输入名字
        await sleep(1000);
        inputText(recoveryFoodName);
        await sleep(500);
        click(490, 1020);//确认筛选
        await sleep(1000);
        var recoveryNumber = await recognizeNumberByOCR(ocrRegion, /\d+/) //识别回血药数量
        // 处理回血药识别结果
        if (recoveryNumber === null) {
            recoveryNumber = 0;
            notification.send(`未识别到回血药数量，设置数量为0，药品名：${recoveryFoodName}`)
        }
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(110, 110);//输入名字
        await sleep(1000);
        inputText(resurrectionFoodName);
        await sleep(500);
        click(490, 1020);//确认筛选
        await sleep(1000);
        var resurrectionNumber = await recognizeNumberByOCR(ocrRegion, /\d+/) //识别复活药数量
        // 处理复活药识别结果
        if (resurrectionNumber === null) {
            resurrectionNumber = 0;
            notification.send(`未识别到复活药数量，设置数量为0，药品名：${resurrectionFoodName}`)
        }
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(490, 1020);//确认筛选
        await genshin.returnMainUi();
        return { recoveryNumber, resurrectionNumber };
    }

    async function addSnapshotRecord(filePath, recoveryNum, resurrectionNum) {
        const now = new Date();
        const dateTimeStr = await formatDateTime(now);

        const recordLine =
            `${dateTimeStr}—库存—${recoveryFoodName}—${recoveryNum}\n` +
            `${dateTimeStr}—库存—${resurrectionFoodName}—${resurrectionNum}`;

        try {
            let content = "";
            try {
                content = await file.readText(filePath);
            } catch (e) {}

            const newContent = content + (content ? "\n" : "") + recordLine;
            await file.writeText(filePath, newContent);

            log.info(`已记录库存快照`);
            return true;
        } catch (error) {
            log.error(`库存快照记录失败: ${error.message}`);
            return false;
        }
    }
    
    // 查找最近一次初始化记录
    async function findLastInitialization(historyFilePath) {
        let content = "";
        try {
            content = await file.readText(historyFilePath);
        } catch (e) {
            return null;
        }

        const lines = content.split("\n").filter(l => l.trim());
        if (lines.length === 0) return null;

        // 只看初始化行
        const initLines = lines.filter(l => l.includes("—初始化—"));
        if (initLines.length === 0) return null;

        // 从后往前，找最近的一组时间戳
        for (let i = initLines.length - 1; i >= 0; i--) {
            const initLine = initLines[i];
            const parts = initLine.split("—");
            if (parts.length < 4) continue;

            const time = parts[0];

            let recoveryNum = null;
            let resurrectionNum = null;

            // 收集同一时间戳的初始化记录
            for (const line of lines) {
                if (!line.startsWith(time)) continue;
                if (!line.includes("—初始化—")) continue;

                const seg = line.split("—");
                if (seg.length < 4) continue;

                const name = seg[2];
                const num = parseInt(seg[3], 10);
                if (isNaN(num)) continue;

                if (name === recoveryFoodName) {
                    recoveryNum = num;
                }
                if (name === resurrectionFoodName) {
                    resurrectionNum = num;
                }
            }

            if (recoveryNum !== null && resurrectionNum !== null) {
                return {
                    time,
                    recoveryNum,
                    resurrectionNum
                };
            }
        }

         return null;
    }

    // 添加历史记录
    async function addHistoryRecord(filePath, mode, recoveryNum, resurrectionNum) {
        const now = new Date();
        const dateTimeStr = await formatDateTime(now);
        const recordLine = `${dateTimeStr}—${mode}—${recoveryFoodName}—${recoveryNum}\n` +
        `${dateTimeStr}—${mode}—${resurrectionFoodName}—${resurrectionNum}`;
        
        try {
            // 检查旧格式并迁移
            await migrateOldFormatRecords(filePath);
            
            let content = "";
            try {
                content = await file.readText(filePath);
            } catch (error) {
                // 文件不存在，创建新文件
            }
            
            // 追加新记录
            const newContent = content + (content ? "\n" : "") + recordLine;
            await file.writeText(filePath, newContent);
            
            log.info(`已添加历史记录: ${recordLine}`);
            return { success: true, time: dateTimeStr };
        } catch (error) {
            log.error(`添加历史记录失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 添加消耗记录
    async function addConsumptionRecord(filePath, recoveryConsumed, resurrectionConsumed, initTime) {
        const now = new Date();
        const dateTimeStr = await formatDateTime(now);
        const recordLine = `${dateTimeStr}—消耗对比—${recoveryFoodName}—${recoveryConsumed}\n` +
        `${dateTimeStr}—消耗对比—${resurrectionFoodName}—${resurrectionConsumed}（对比${initTime}）`;
        
        try {
            let content = "";
            try {
                content = await file.readText(filePath);
            } catch (error) {
                // 文件不存在，创建新文件
            }
            
            // 追加新记录
            const newContent = content + (content ? "\n" : "") + recordLine;
            await file.writeText(filePath, newContent);
            
            log.info(`已添加消耗记录: ${recordLine}`);
            return { success: true };
        } catch (error) {
            log.error(`添加消耗记录失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 主执行流程
    async function main() {
        // 设置分辨率和缩放
        setGameMetrics(1920, 1080, 1);
        // 点击领月卡
        await genshin.blessingOfTheWelkinMoon();
        await sleep(1000);
        await genshin.returnMainUi();
        await sleep(1000);
        // 获取食物数量
        return await getFoodNum();
    }

    // ==================== 程序入口 ====================
    userName = await getUserName();
    const historyFilePath = `assets/${userName}_history.txt`;
    const snapshotFilePath = `assets/${userName}_snapshot.txt`;
    const consumptionFilePath = `assets/${userName}_consumption.txt`;
    
    // 获取当前药物数量
    const { recoveryNumber, resurrectionNumber } = await main();
    
    if (currentMode === "init") {
        // ============ 初始化模式 ============
        const result = await addHistoryRecord(historyFilePath, "初始化", recoveryNumber, resurrectionNumber);
        
        if (result.success) {
            notification.send(`${userName}: 已记录初始库存！${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`);
        } else {
            notification.send(`${userName}: 初始化记录失败！`);
        }
        
    } else if (currentMode === "record") {
        // ============ 记录模式 ============
        // 1. 查找最近一次初始化
        const lastInit = await findLastInitialization(historyFilePath);
        
        if (!lastInit) {
            // 没有找到初始化记录，自动转为初始化模式
            log.warn("未找到初始化记录，自动转为初始化模式");
            const result = await addHistoryRecord(historyFilePath, "初始化", recoveryNumber, resurrectionNumber);
            
            if (result.success) {
                notification.send(`${userName}: 未找到初始化记录，已自动记录为初始库存！${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`);
            }
            
        } else {
            // 2. 计算消耗量
            const recoveryConsumed = lastInit.recoveryNum - recoveryNumber;
            const resurrectionConsumed = lastInit.resurrectionNum - resurrectionNumber;
            
            // 3. 添加当前记录到历史文件
            const historyResult = await addHistoryRecord(historyFilePath, "记录", recoveryNumber, resurrectionNumber);
            
            // 4. 添加消耗记录到消耗文件
            if (recoveryConsumed > 0 || resurrectionConsumed > 0) {
                await addConsumptionRecord(
                    consumptionFilePath, 
                    recoveryConsumed, 
                    resurrectionConsumed, 
                    lastInit.time
                );
            }
            
            // 5. 发送通知
            if (recoveryConsumed > 0 || resurrectionConsumed > 0) {
                notification.send(`${userName}: 当前库存：${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个 | 消耗：${recoveryFoodName}${recoveryConsumed}个, ${resurrectionFoodName}${resurrectionConsumed}个（对比${lastInit.time}）`);
            } else {
                // 消耗为0或负数（数量增加）
                const recoveryChange = recoveryConsumed >= 0 ? `消耗${recoveryConsumed}个` : `新增${-recoveryConsumed}个`;
                const resurrectionChange = resurrectionConsumed >= 0 ? `消耗${resurrectionConsumed}个` : `新增${-resurrectionConsumed}个`;
                notification.send(`${userName}: 当前库存：${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个 | ${recoveryChange}, ${resurrectionChange}（对比${lastInit.time}）`);
            }
        }
        
    } else if (currentMode === "snapshot") {
        // ✅ 新增的纯记录模式
        const ok = await addSnapshotRecord(
            snapshotFilePath,
            recoveryNumber,
            resurrectionNumber
        );

        if (ok) {
            notification.send(
                `${userName}: 当前库存 — ${recoveryFoodName}${recoveryNumber}个，${resurrectionFoodName}${resurrectionNumber}个`
            );
        } else {
            notification.send(`${userName}: 库存记录失败`);
        }

    } else {
        notification.send(`${userName}: 错误！未知的模式: ${currentMode}`);
    }
    
})();