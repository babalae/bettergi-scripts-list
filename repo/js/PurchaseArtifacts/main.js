let userName = settings.userName || "默认账户";
(async function () {
    // 定义一个函数用于模拟按键操作
    async function simulateKeyOperations(key, duration) {
        keyDown(key);
        await sleep(duration);
        keyUp(key);
        await sleep(500); // 释放按键后等待 500 毫秒
    }

    // 检验账户名
    async function getUserName() {
        userName = userName.trim();
    //数字，中英文，长度在20个字符以内
        if (!userName || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(userName)) {
            log.error(`账户名${userName}违规，暂时使用默认账户名，请查看readme后修改`)
            userName = "默认账户";
        }
        return userName;
    }

    /**
     * 判断任务是否已刷新（固定为每周四4点刷新）
     * @param {string} filePath - 存储最后完成时间的文件路径
     * @returns {Promise<boolean>} - 是否已刷新
     */
    async function isTaskRefreshed(filePath) {
        const WEEKLY_DAY = 4;  // 周四（0是周日，1是周一，4是周四）
        const WEEKLY_HOUR = 4; // 凌晨4点

        try {
            // 读取文件内容
            let content = await file.readText(filePath);

            // 如果文件内容为空或无效，视为需要刷新
            if (!content) {
                await file.writeText(filePath, '');
                log.info("创建新时间记录文件成功，执行脚本");
                return true;
            }

            const lastTime = new Date(content);
            const nowTime = new Date();

            // 检查上次记录时间是否有效
            if (isNaN(lastTime.getTime())) {
                log.info("时间记录文件内容无效，执行脚本");
                return true;
            }

            // 获取本周的刷新时间
            const thisWeekRefresh = new Date(nowTime);

            // 计算与本周周四的差值
            const dayDiff = (thisWeekRefresh.getDay() - WEEKLY_DAY + 7) % 7;
            thisWeekRefresh.setDate(thisWeekRefresh.getDate() - dayDiff);
            thisWeekRefresh.setHours(WEEKLY_HOUR, 0, 0, 0);

            // 如果当前时间已经过了本周的刷新时间
            if (nowTime >= thisWeekRefresh) {
                // 检查上次完成时间是否在本周刷新之前
                if (lastTime < thisWeekRefresh) {
                    notification.send("购买狗粮已经刷新，执行脚本");
                    return true;
                }
            } else {
                // 否则检查上次完成时间是否在上周刷新之前
                const lastWeekRefresh = new Date(thisWeekRefresh);
                lastWeekRefresh.setDate(lastWeekRefresh.getDate() - 7);

                if (lastTime < lastWeekRefresh) {
                    notification.send("购买狗粮已经刷新，执行脚本");
                    return true;
                }
            }

            log.info("购买狗粮未刷新");
            return false;

        } catch (error) {
            // 如果文件不存在或读取失败，创建新文件并返回true
            log.info(`文件读取失败: ${error.message}，创建新文件`);
            await file.writeText(filePath, '');
            return true;
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
                        await simulateKeyOperations("W", 400); // 前进 400 毫秒
                        await sleep(500);
                    } else if (f_attempts <= 5) {
                        // 第 4-5 次尝试
                        log.warn("无法找到NPC，退出购买流程");
                        return { success: false, reason: "npc_not_found" };
                    } else {
                        // 第 6 次尝试，尝试次数已达上限
                        log.warn("尝试次数已达上限");
                        break; // 找到后退出循环
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
            let res = captureRegion.Find(shopDialogueRo);
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
        if (locationName=='稻妻购买狗粮'){
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
        log.info(`加载路径文件: ${locationName}`);
        let filePath = `assets/Pathing/${locationName}.json`;
        await pathingScript.runFile(filePath);
        await sleep(1000);

        // 执行购买
        return await purchaseOnly(locationName);
    }

    // 检查函数，如果未买完则重新对话购买
    async function checkAndPurchase(locationName) {
        let maxRetries = 2; // 最大重试次数（加上第一次共3次）
        let retryCount = 0;
        let totalPurchased = 0;

        // 第一次执行完整的购买流程（包含寻路）
        log.info(`开始执行 ${locationName} 的完整购买流程`);
        let purchaseResult = await purChase(locationName);
        let purchasedCount = purchaseResult.purchasedCount;
        let failureReason = purchaseResult.failureReason;
        let aligned = purchaseResult.aligned;

        totalPurchased += purchasedCount;

        // 如果购买数量为0，检查失败原因
        if (purchasedCount === 0) {
            if (failureReason === "npc_not_found" || !aligned) {
                // NPC对齐失败，重新执行一次完整购买流程
                log.info(`${locationName} NPC对齐失败，重新执行完整购买流程`);
                await genshin.returnMainUi();
                await sleep(2000);

                purchaseResult = await purChase(locationName);
                purchasedCount = purchaseResult.purchasedCount;
                failureReason = purchaseResult.failureReason;
                aligned = purchaseResult.aligned;
                totalPurchased = purchasedCount; // 重置总购买数

                if (purchasedCount === 0 && (failureReason === "npc_not_found" || !aligned)) {
                    log.warn(`${locationName} 第二次完整购买仍然NPC对齐失败，跳过此地点`);
                    return 0;
                }
            } else if (failureReason === "sold_out") {
                // 商店已售罄，说明之前已经买过了
                log.info(`${locationName} 商店已售罄，之前已完整购买过`);
                return 0;
            }
        }

        // 如果第一次没买完（且数量大于0），尝试重新对话购买
        while (totalPurchased < 5 && retryCount < maxRetries) {
            retryCount++;
            log.info(`第 ${retryCount} 次重试购买 ${locationName}，已购买 ${totalPurchased} 个`);

            // 返回主界面
            await genshin.returnMainUi();
            await sleep(2000);

            // 重新执行购买（不包含寻路）
            log.info(`重新执行 ${locationName} 的购买流程（不包含寻路）`);
            purchaseResult = await purchaseOnly(locationName, true);
            purchasedCount = purchaseResult.purchasedCount;
            failureReason = purchaseResult.failureReason;

            // 如果重新购买时数量为0，检查失败原因
            if (purchasedCount === 0) {
                if (failureReason === "npc_not_found") {
                    log.info(`${locationName} 重试时NPC对齐失败，停止重试`);
                    break;
                } else if (failureReason === "sold_out") {
                    log.info(`${locationName} 重试时已无圣遗物可购买，停止重试`);
                    break;
                }
            }

            totalPurchased += purchasedCount;

            if (totalPurchased >= 5) {
                log.info(`成功购买 ${locationName} 的所有圣遗物`);
                break;
            }
        }

        if (totalPurchased < 5 && totalPurchased > 0) {
            log.warn(`购买 ${locationName} 未完成，只购买了 ${totalPurchased} 个圣遗物`);
        } else if (totalPurchased === 0) {
            log.info(`${locationName} 无圣遗物可购买`);
        }

        return totalPurchased;
    }

    async function main() {
        await genshin.returnMainUi();
        // 使用数组存储要执行的地点
        const purchaseTasks = [
            { enabled: settings.select1, name: '蒙德购买狗粮' },
            { enabled: settings.select2, name: '璃月购买狗粮1' },
            { enabled: settings.select3, name: '璃月购买狗粮2', time: { hour: 19, minute: 0 } },
            { enabled: settings.select4, name: '稻妻购买狗粮' },
            { enabled: settings.select5, name: '须弥购买狗粮' },
            { enabled: settings.select6, name: '枫丹购买狗粮' },
            { enabled: settings.select7, name: '纳塔购买狗粮' },
            { enabled: settings.select8, name: '挪德卡莱购买狗粮' }
        ];

        let totalPurchased = 0;

        for (const task of purchaseTasks) {
            if (task.enabled) {
                // 如果有时间设置，先设置时间
                if (task.time) {
                    await genshin.setTime(task.time.hour, task.time.minute)
                }

                // 执行检查并购买
                let count = await checkAndPurchase(task.name);
                totalPurchased += count;

                log.info(`${task.name} 完成，购买了 ${count} 个圣遗物`);

                // 返回主界面准备下一个任务
                await genshin.returnMainUi();
                await sleep(1000);
            }
        }

        notification.send(`所有任务完成，总共购买了 ${totalPurchased} 个圣遗物`);

        await file.writeText(recordPath, new Date().toISOString());
    }

    userName = await getUserName();
    const recordPath = `assets/${userName}.txt`;
    //每周四4点刷新
    if( await isTaskRefreshed(recordPath)|| settings.select9){
    await main();
    }
})();
