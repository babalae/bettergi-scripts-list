let userName;
(async function () {
    // 定义一个函数用于模拟按键操作
    async function simulateKeyOperations(key, duration) {
        keyDown(key);
        await sleep(duration);
        keyUp(key);
        await sleep(500); // 释放按键后等待 500 毫秒
    }

    async function close_expired_stuff_popup_window() {
        const game_region = captureGameRegion();
        const text_x = 850;
        const text_y = 273;
        const text_w = 225;
        const text_h = 51;
        const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));
        if (ocr_res) {
            if (ocr_res.text.includes("物品过期")) {
                log.info("检测到物品过期");
                click(1000, 750);
                await sleep(1000);
            }
        }
        game_region.dispose();
    }

    // 打开背包并识别圣遗物数量
    async function getArtifactsCount() {
        log.info("开始识别圣遗物数量");
        
        await genshin.returnMainUi();
        await sleep(1000);
        
        keyPress("B");
        await sleep(1500);
        
        // 检测并关闭背包过期物品弹窗
        await close_expired_stuff_popup_window();
        
        click(627, 66);
        await sleep(1000);
        
        const ra = captureGameRegion();
        const ocrRegion = {
            x: 1679,
            y: 31,
            width: 1797 - 1679,
            height: 65 - 31
        };
        let ocrCount = -1;
        const maxAttempts = 5;
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
                ocrObject.threshold = 0.85;
                const resList = ra.findMulti(ocrObject);
                
                for (let j = 0; j < resList.count; j++) {
                    const res = resList[j];
                    const text = res.text.trim();
                    log.debug(`OCR识别结果: ${text}`);
                    
                    // 直接去掉末尾5个字符（斜杠/被误识别为7 + 4位总数），剩余即为当前数量
                    // 适用于 XXXX/XXXX 且总数固定4位；斜杠被OCR误识别为7也能正确取值
                    let numStr = '';
                    if (text.length > 5) {
                        numStr = text.slice(0, -5).replace(/\D/g, '');
                    }
                    if (numStr) {
                        ocrCount = parseInt(numStr, 10);
                        log.debug(`OCR识别到圣遗物数量: ${ocrCount}（原文: ${text}）`);
                        break;
                    }
                }
            } catch (error) {
                log.error(`OCR识别异常: ${error.message}`);
            }
            if (ocrCount >= 0) break;
            await sleep(500);
        }
        
        ra.dispose();

        if (ocrCount >= 0) {
            await genshin.returnMainUi();
            await sleep(1000);
            return ocrCount;
        }

        await genshin.returnMainUi();
        await sleep(1000);
        log.warn("未能识别到圣遗物数量，返回0");
        return 0;
    }

    // ==================== 账号管理功能 ====================

    // 清理账户名，防止路径非法字符
    function validateUserName(name) {
        if (typeof name !== 'string' || name.trim() === '') return '默认账户';
        // 替换 Windows 路径非法字符，并去除首尾空格
        return name.trim().replace(/[\\/:*?"<>|]/g, '_');
    }

    // 通过bgi的 genshin.uid() 接口识别当前角色 UID 作为账户名
    async function getUidFromGame() {
        try {
            // 回到主界面
            await genshin.returnMainUi();
            await sleep(1000);

            const uidNum = await genshin.uid();
            const uid = uidNum ? String(uidNum).replace(/\D/g, '') : "";

            if (uid && uid.length >= 5) { // UID通常9位，至少5位
                log.info(`获取到UID: ${uid}`);
                return uid;
            } else {
                log.warn("未能获取到UID");
                return null;
            }
        } catch (e) {
            log.warn(`获取UID异常: ${e.message}`);
            return null;
        }
    }

    // ==================== 刷新时间计算（每周四凌晨4点刷新） ====================

    // 获取给定日期所在周的下一个周四凌晨4点（已过本周四4点则返回下周四）
    function getThursdayOfWeek(date) {
        const d = new Date(date);
        // 调整到4点刷新
        if (d.getHours() < 4) {
            d.setDate(d.getDate() - 1);
        }
        const day = d.getDay(); // 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
        const targetDay = 4;
        if (day < targetDay) {
            // 本周四
            d.setDate(d.getDate() + (targetDay - day));
        } else if (day > targetDay) {
            // 下周四
            d.setDate(d.getDate() + (7 - day + targetDay));
        } else {
            // 当天是周四，已经过了4点，返回下周四
            d.setDate(d.getDate() + 7);
        }
        d.setHours(4, 0, 0, 0);
        return d;
    }

    // 将日期格式化为 "YYYY-MM-DDTHH:mm:ss+08:00" 格式
    function formatDateToLocalISO(date) {
        const pad = (n) => n.toString().padStart(2, '0');

        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
    }

    // ==================== 购买记录功能 ====================

    // 获取当前账号的记录文件路径
    function getRecordPath() {
        return `record/${userName}/records.json`;
    }

    // 读取商人记录文件
    async function loadRecords() {
        try {
            const content = await file.readText(getRecordPath());
            if (content && content.trim()) {
                const records = JSON.parse(content);
                if (Array.isArray(records)) {
                    return records;
                }
            }
        } catch (error) {
            // 文件不存在或格式错误，返回空数组
        }
        return [];
    }

    // 保存商人记录文件
    async function saveRecords(records) {
        try {
            await file.writeText(getRecordPath(), JSON.stringify(records, null, 2));
            return true;
        } catch (error) {
            log.error(`保存记录文件失败: ${error.message}`);
            return false;
        }
    }

    // 获取指定点位的记录
    function getMerchantRecord(records, locationName) {
        return records.find(record => record.name === locationName);
    }

    // 判断该点位本周是否已完成（记录的下次刷新时间在当前时间之后则视为已完成）
    function isMerchantDone(records, locationName) {
        const record = getMerchantRecord(records, locationName);
        if (!record || !record.time) {
            return false;
        }
        const nextRefresh = new Date(record.time);
        if (isNaN(nextRefresh.getTime())) {
            return false;
        }
        return new Date() < nextRefresh;
    }

    // 写入点位完成记录：下次刷新时间为下一个周四凌晨4点
    function upsertMerchantRecord(records, locationName, count) {
        const newRecord = {
            name: locationName,
            time: formatDateToLocalISO(getThursdayOfWeek(new Date())),
            count: count
        };
        const idx = records.findIndex(record => record.name === locationName);
        if (idx >= 0) {
            records[idx] = newRecord;
        } else {
            records.push(newRecord);
        }
        return records;
    }

    // 移除指定点位的记录（未完成时清除，保证下次运行重试该点位）
    function removeMerchantRecord(records, locationName) {
        const idx = records.findIndex(record => record.name === locationName);
        if (idx >= 0) {
            records.splice(idx, 1);
        }
    }

    // 购买圣遗物 - 只执行购买部分（不包含寻路）
    async function purchaseOnly(locationName, isRetry = false) {
        log.info(`开始购买流程: ${locationName}${isRetry ? ' (重试)' : ''}`);

        // 定义模板
        let fDialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/F_Dialogue.png"), 1050, 400, 100, 400);
        let shopDialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/Shopping.png"), 1259, 540, 100, 400);
        let shopDialogueRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/Shopping2.png"), 0, 0, 150, 100);
        let conFirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/Confirm.png"), 1585, 1005, 31, 31);
        let guDong = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/古董.png"));

        // 定义一个函数识别并交互 NPC
        async function checkFAlignment(fDialogueRo) {
            let ra = captureGameRegion();
            let fRes = ra.find(fDialogueRo);
            ra.dispose();
            if (!fRes.isExist()) {
                let f_attempts = 0; // 初始化尝试次数
                while (f_attempts < 6) { // 最多尝试 5 次
                    f_attempts++;
                    log.info(`当前尝试次数：${f_attempts}`);
                    if (f_attempts <= 3) {
                        // 第 1-3 次尝试
                        await simulateKeyOperations("S", 200); // 后退 200 毫秒
                        await sleep(200);
                    } else if (f_attempts <= 5) {
                        // 第 4-5 次尝试
                        await simulateKeyOperations("W", 400); // 前进 400 毫秒
                        await sleep(500);
                    } else {
                        // 第 6 次尝试，尝试次数已达上限
                        log.warn("无法找到NPC，退出购买流程");
                        break;
                    }

                    // 检查是否找到 F 图标
                    ra = captureGameRegion();
                    fRes = ra.find(fDialogueRo); // 重新查找 F 图标
                    ra.dispose();
                    if (fRes.isExist()) {
                        log.info("找到 F 图标");
                        break; // 找到后退出循环
                    }
                    log.warn(`尝试 ${f_attempts}：寻找 F 图标`);
                }

                // 如果尝试次数用完仍未找到 F 图标，返回 false
                if (!fRes.isExist()) {
                    log.warn("经过多次尝试后仍未找到 F 图标");
                    return { success: false, reason: "npc_not_found" };
                }
            }
            return { success: true, reason: "" };
        }

        let alignmentResult = await checkFAlignment(fDialogueRo);
        if(!alignmentResult.success){
            // 返回一个对象，包含购买数量和失败原因
            return { purchasedCount: 0, failureReason: alignmentResult.reason, aligned: false };
        }

        // 进入对话选项
        for (let i = 0; i < 5; i++) {
            // 最多 F 5次
            let captureRegion = captureGameRegion();  // 获取一张截图
            let res;
            if (locationName=='璃月-璃月港-琳琅'){
                res = captureRegion.Find(guDong);
            }else{
                res = captureRegion.Find(shopDialogueRo);
            }
            captureRegion.dispose();
            if (res.isEmpty()) {
              keyPress("F");
              await sleep(1000);
            } else {
              res.click();
              log.info("已到达对话选项界面，点击商店图标({x},{y},{h},{w})", res.x, res.y, res.width, res.Height);
              break;
            }
            await sleep(500);
        }
        // 进入商店界面
        for (let i = 0; i < 5; i++) {
            // 最多 F 5次
            let captureRegion = captureGameRegion();  // 获取一张截图
            let res = captureRegion.Find(shopDialogueRo2);
            captureRegion.dispose();
            if (res.isEmpty()) {
              keyPress("F");
              await sleep(1000);
            } else {
              log.info("已到达商店界面");
              break;
            }
            await sleep(500);
        }
        if (locationName=='稻妻-离岛-山城健太'){
            click(200, 400); await sleep(500); // 选择狗粮
        }
        // 购买狗粮
        let purchasedCount = 0; // 记录购买次数
        for (let i = 0; i < 6; i++) {
            // 最多购买6次
            let captureRegion = captureGameRegion();  // 获取一张截图
            let res = captureRegion.Find(conFirmRo);
            captureRegion.dispose();
            if (res.isEmpty()) {
                log.info('圣遗物已售罄');
                break;
            }else{
                // 识别到购买标识，模拟购买操作的后续点击
                await click(1600, 1020);
                await sleep(1000); // 购买
                await click(1320, 780);
                await sleep(1000); // 最终确认
                await click(1320, 780);
                await sleep(1000); // 点击空白
                purchasedCount++; // 购买成功，计数加1
            }
            await sleep(500);
        }

        // 返回购买结果对象
        return { purchasedCount, failureReason: purchasedCount === 0 ? "sold_out" : "", aligned: true };
    }

    // 完整的购买流程（包含寻路）
    async function purChase(locationName) {
        // 寻路
        let filePath = `assets/Pathing/${locationName}.json`;
        await pathingScript.runFile(filePath);
        await sleep(1000);

        // 执行购买
        return await purchaseOnly(locationName);
    }

    // 检查函数，如果未买完则重新对话购买
    // 返回 { count, failed, soldOut }：
    //   failed=true 表示该路线未正常完成（购买失败/异常），售罄(sold_out)不算失败
    //   soldOut=true 表示商店已售罄（本周已买过/本次已买完）
    async function checkAndPurchase(locationName, locationIndex, totalLocations, merchantName) {
        let maxRetries = 2; // 最大重试次数（加上第一次共3次）
        let retryCount = 0;
        let totalPurchased = 0;
        let failed = false; // 本路线是否为真失败（npc_not_found/异常），售罄不算失败
        let soldOut = false; // 商店是否已售罄

        // 第一次执行完整的购买流程（包含寻路）
        log.info(`当前进度: ${locationIndex}/${totalLocations}`);
        log.info(`开始前往: ${locationName}`);
        let purchaseResult;
        try {
            purchaseResult = await purChase(locationName);
        } catch (error) {
            log.error(`${merchantName} 路线执行出错：${error.message}`);
            return { count: 0, failed: true, soldOut: false };
        }
        let purchasedCount = purchaseResult.purchasedCount;
        let failureReason = purchaseResult.failureReason;
        let aligned = purchaseResult.aligned;

        totalPurchased += purchasedCount;

        // 如果购买数量为0，检查失败原因
        if (purchasedCount === 0) {
            if (failureReason === "npc_not_found" || !aligned) {
                // NPC对齐失败，重新执行一次完整购买流程
                log.info(`${merchantName} 路线对话对齐失败，重新执行完整购买流程`);
                await genshin.returnMainUi();
                await sleep(2000);

                try {
                    purchaseResult = await purChase(locationName);
                } catch (error) {
                    log.error(`${merchantName} 路线第二次执行出错：${error.message}`);
                    return { count: 0, failed: true, soldOut: false };
                }
                purchasedCount = purchaseResult.purchasedCount;
                failureReason = purchaseResult.failureReason;
                aligned = purchaseResult.aligned;
                totalPurchased = purchasedCount; // 重置总购买数

                if (purchasedCount === 0 && (failureReason === "npc_not_found" || !aligned)) {
                    log.warn(`${merchantName} 第二次完整购买仍然对话对齐失败，跳过此路线`);
                    return { count: 0, failed: true, soldOut: false };
                }
            } else if (failureReason === "sold_out") {
                // 商店已售罄，说明之前已经买过了
                log.info(`${merchantName} 路线商品已售罄，之前已完整购买过`);
                return { count: 0, failed: false, soldOut: true };
            }
        }

        // 如果第一次没买完（且数量大于0），尝试重新对话购买
        while (totalPurchased < 5 && retryCount < maxRetries) {
            retryCount++;
            log.info(`第 ${retryCount} 次重试购买 ${merchantName} 路线的圣遗物，已购买 ${totalPurchased} 个圣遗物`);

            // 返回主界面
            await genshin.returnMainUi();
            await sleep(2000);

            // 重新执行购买（不包含寻路）
            log.info(`重新执行 ${merchantName} 路线的购买流程（不包含寻路）`);
            purchaseResult = await purchaseOnly(locationName, true);
            purchasedCount = purchaseResult.purchasedCount;
            failureReason = purchaseResult.failureReason;

            // 如果重新购买时数量为0，检查失败原因
            if (purchasedCount === 0) {
                if (failureReason === "npc_not_found") {
                    log.info(`${merchantName} 路线重试时对话对齐失败，停止重试`);
                    failed = true;
                    soldOut = false;
                    break;
                } else if (failureReason === "sold_out") {
                    log.info(`${merchantName} 路线重试时已无圣遗物可购买，停止重试`);
                    failed = false;
                    soldOut = true;
                    break;
                }
            }

            totalPurchased += purchasedCount;

            if (totalPurchased >= 5) {
                log.info(`成功购买 ${merchantName} 的所有圣遗物`);
                break;
            }
        }

        if (totalPurchased < 5 && totalPurchased > 0 && !soldOut) {
            log.warn(`${merchantName} 路线购买部分完成，只购买了 ${totalPurchased} 个圣遗物`);
        } else if (totalPurchased === 0 && !soldOut) {
            log.info(`${merchantName} 无圣遗物可购买`);
        }

        // 买到东西即视为本路线完成（非失败）
        if (totalPurchased > 0) {
            failed = false;
        }
        return { count: totalPurchased, failed, soldOut };
    }

    async function main(forceRun) {
        await genshin.returnMainUi();

        // 商人选项与购买任务的映射
        const merchantTaskMap = {
            '蒙德商人': { merchant: '蒙德商人', name: '蒙德-蒙德城-石榴' },
            '璃月商人1': { merchant: '璃月商人1', name: '璃月-璃月港-张顺' },
            '璃月商人2': { merchant: '璃月商人2', name: '璃月-璃月港-琳琅', time: { hour: 19, minute: 0 } },
            '稻妻商人': { merchant: '稻妻商人', name: '稻妻-离岛-山城健太' },
            '须弥商人': { merchant: '须弥商人', name: '须弥-须弥城-阿夫辛' },
            '枫丹商人': { merchant: '枫丹商人', name: '枫丹-枫丹廷-灰河-克洛莎' },
            '纳塔商人': { merchant: '纳塔商人', name: '纳塔-圣火竞技场-艾库瓦' },
            '挪德卡莱商人': { merchant: '挪德卡莱商人', name: '挪德卡莱-那夏镇-雷科' },
            '至冬商人': { merchant: '至冬商人', name: '至冬-至冬堡-雅罗斯拉夫' }
        };

        // 根据多选设置构建购买任务列表（仅包含勾选的商人）
        const merchantOrder = ['蒙德商人', '璃月商人1', '璃月商人2', '稻妻商人', '须弥商人', '枫丹商人', '纳塔商人', '挪德卡莱商人', '至冬商人'];
        // BGI 只在用户打开过设置UI时才会写入 multi-checkbox 默认值；未打开时 settings.merchants 为 undefined，需回退到全部商人
        let selectedMerchants = Array.from(settings.merchants || []);
        if (selectedMerchants.length === 0) {
            log.warn("未读取到已勾选的商人配置，使用默认全部9个商人");
            selectedMerchants = [...merchantOrder];
        }
        selectedMerchants = selectedMerchants
            .filter(m => merchantOrder.includes(m))
            .sort((a, b) => merchantOrder.indexOf(a) - merchantOrder.indexOf(b));
        const purchaseTasks = selectedMerchants
            .map(merchant => merchantTaskMap[merchant])
            .filter(task => task);

        // 加载本账户的商人独立记录
        let records = await loadRecords();
        log.info(`当前账户: ${userName}，记录文件 ${getRecordPath()} 中已有 ${records.length} 条商人记录`);

        // 断点续跑：本周已完成的点位直接跳过；若全部完成则不打开背包识别提前结束
        if (!forceRun) {
            const doneTasks = purchaseTasks.filter(task => isMerchantDone(records, task.name));
            if (doneTasks.length === purchaseTasks.length) {
                log.info("本周所有勾选商人均已购买完成，跳过运行");
                notification.send("本周狗粮均已购买完成，无需运行");
                return;
            }
            if (doneTasks.length > 0) {
                log.info(`以下点位本周已完成，运行时将自动跳过: ${doneTasks.map(task => task.merchant).join('、')}`);
            }
        }

        // 购买前识别背包中的圣遗物数量
        const initialCount = await getArtifactsCount();
        log.info(`购买前背包中圣遗物数量: ${initialCount}`);

        let totalPurchased = 0;
        let hasRealFailure = false; // 是否存在未正常完成的路线（购买失败/异常，售罄不算）
        let skippedCount = 0;       // 本次跳过的已完成点位数
        let completedCount = 0;     // 本次新完成的点位数

        for (let i = 0; i < purchaseTasks.length; i++) {
            const task = purchaseTasks[i];

            // 断点续跑：本周已完成的点位直接跳过（强制运行时不跳过）
            if (!forceRun && isMerchantDone(records, task.name)) {
                skippedCount++;
                log.info(`${task.merchant} 本周已完成，跳过该点位`);
                continue;
            }

            // 如果有时间设置，先设置时间
            if (task.time) {
                await genshin.setTime(task.time.hour, task.time.minute)
            }

            // 执行检查并购买
            const result = await checkAndPurchase(task.name, i + 1, purchaseTasks.length, task.merchant);
            totalPurchased += result.count;
            // 记录是否存在购买失败/异常的路线
            if (result.failed) {
                hasRealFailure = true;
                log.warn(`${task.merchant} 路线未正常完成（购买失败/异常）`);
            }

            log.info(`${task.merchant} 路线完成，购买了 ${result.count} 个圣遗物`);

            // 买满5个或商品售罄才记为本周完成；部分购买/失败不记录，下次运行自动重试该点位
            const isDone = result.soldOut || result.count >= 5;
            if (isDone) {
                upsertMerchantRecord(records, task.name, result.count);
                await saveRecords(records);
                completedCount++;
            } else {
                // 未完成：清除可能存在的旧记录（强制运行场景），保证下次运行会重试该点位
                removeMerchantRecord(records, task.name);
                await saveRecords(records);
                log.warn(`${task.merchant} 点位未完成（本次购买 ${result.count} 个），不写入完成记录，下次运行将重试该点位`);
            }

            // 返回主界面准备下一个任务
            await genshin.returnMainUi();
            await sleep(1000);
        }

        // 购买后识别背包中的圣遗物数量
        const finalCount = await getArtifactsCount();
        log.info(`购买后背包中圣遗物数量: ${finalCount}`);
        
        // 计算实际购买数量
        const actualPurchased = finalCount - initialCount;
        log.info(`本次购买实际获得圣遗物数量: ${actualPurchased}`);

        notification.send(`任务完成，总共购买了 ${totalPurchased} 个圣遗物，背包中圣遗物数量变化: ${initialCount} → ${finalCount}（+${actualPurchased}）`);

        if (hasRealFailure) {
            log.warn("本次存在购买失败/异常的点位，未写入完成记录，下次运行将自动重试这些点位");
        }
    }

    // ==================== 确定账户名 ====================
    // settings.userName 未写入时（从未打开设置UI）回退默认值"默认账户"；用户主动清空则 OCR 识别 UID
    let rawUserName = (settings.userName === undefined || settings.userName === null)
        ? "默认账户"
        : String(settings.userName).trim();
    if (!rawUserName) {
        log.info("账户名称为空，尝试从游戏获取UID作为账户名称...");
        const uid = await getUidFromGame();
        if (uid) {
            userName = uid;
            log.info(`使用UID作为账户名: ${userName}`);
        } else {
            userName = "默认账户";
            log.warn("无法获取UID，回退使用默认账户文件夹");
        }
    } else {
        userName = validateUserName(rawUserName);
        if (userName !== rawUserName) {
            log.info(`账户名包含路径非法字符，已清理为: ${userName}`);
            settings.userName = userName;
        }
    }
    log.info(`当前账户记录目录: record/${userName}/`);

    // 取消运行限制为一次性勾选，运行后自动取消勾选（参考角色养成一条龙 ifClearLog）
    const forceRun = settings.select9;
    if (forceRun) {
        settings.select9 = false;
        log.info("取消运行限制已勾选，无视记录，强制重跑所有勾选商人");
    }

    await main(forceRun);
})();
