let userName = settings.userName || "默认账户";
const recoveryFoodName = settings.recoveryFoodName || "回血药名字没填";
const resurrectionFoodName = settings.resurrectionFoodName || "复活药名字没填";
const ocrRegion = {
        x: 110,
        y: 242,
        width: 124,
        height: 32
    };
const loadDelay = +settings.loadDelay || 800;
const stepDelay = +settings.stepDelay || 500;
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

    /**
     * 获取本地记录中当天4点至次日4点间的最早记录
     * @param {string} filePath - 记录文件路径
     * @returns {Promise<object>} 包含药品数据的对象
     * 格式: { recovery: { count }, resurrection: { count }, initialized: { recovery, resurrection } }
     */
    async function getLocalData(filePath) {
        // 初始化返回结果
        const result = {
            recovery: null,
            resurrection: null,
            initialized: {
                recovery: false,
                resurrection: false
            }
        };

        try {
            // 尝试读取文件，不存在则直接返回空结果
            const content = await file.readText(filePath);
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) return result;

            // 获取当前时间范围（当天4点至次日4点）
            const now = new Date();
            let startTime, endTime;

            if (now.getHours() < 4) {
                // 当前时间在4点前，时间范围为昨天4点至今天4点
                startTime = new Date(now);
                startTime.setDate(now.getDate() - 1);
                startTime.setHours(4, 0, 0, 0);

                endTime = new Date(now);
                endTime.setHours(4, 0, 0, 0);
            } else {
                // 当前时间在4点后，时间范围为今天4点至明天4点
                startTime = new Date(now);
                startTime.setHours(4, 0, 0, 0);

                endTime = new Date(now);
                endTime.setDate(now.getDate() + 1);
                endTime.setHours(4, 0, 0, 0);
            }

            // 时间格式正则：匹配 "时间:YYYY/MM/DD HH:mm:ss"
            const timeRegex = /时间:(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/;
            // 药品匹配正则
            const recoveryRegex = new RegExp(`${recoveryFoodName}-(\\d+)`);
            const resurrectionRegex = new RegExp(`${resurrectionFoodName}-(\\d+)`);

            // 正向遍历：找到第一个小于startTime的行索引（边界）
            let firstOutOfRangeIndex = -1; // 初始化为-1（表示所有行都在时间范围内）
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const timeMatch = line.match(timeRegex);
                if (!timeMatch) continue;

                const recordTime = new Date(timeMatch[1]);

                // 找到第一个超出时间范围（小于startTime）的行，记录索引并终止正向遍历
                if (recordTime < startTime) {
                    // 如果第一条记录时间在今天4点之前，直接返回空结果
                    if (i === 0) {
                        return result;
                    }
                    firstOutOfRangeIndex = i;
                    break;
                }
            }

            // 反向遍历的起始索引：如果有超出范围的行，从边界上一行开始；否则从最后一行开始
            const reverseStartIndex = firstOutOfRangeIndex === -1
                ? lines.length - 1
                : firstOutOfRangeIndex - 1;

            // 反向遍历的终止索引：0（顶部）
            const reverseEndIndex = 0;

            // 反向遍历：找时间范围内最早的药品记录
            // 遍历范围：[reverseStartIndex, reverseEndIndex]（从时间范围的最旧→最新）
            for (let i = reverseStartIndex; i >= reverseEndIndex; i--) {
                // 防止索引越界（比如边界上一行是-1时）
                if (i < 0) break;

                const line = lines[i];
                const timeMatch = line.match(timeRegex);
                if (!timeMatch) continue;

                const recordTime = new Date(timeMatch[1]);
                // 二次校验：确保记录在目标时间范围内（避免边界判断误差）
                if (recordTime < startTime || recordTime >= endTime) {
                    continue;
                }

                // 匹配回血药：未初始化时才赋值
                if (!result.initialized.recovery) {
                    const recoveryMatch = line.match(recoveryRegex);
                    if (recoveryMatch) {
                        result.recovery = { count: parseInt(recoveryMatch[1]) };
                        result.initialized.recovery = true;
                    }
                }

                // 匹配复活药：未初始化时才赋值
                if (!result.initialized.resurrection) {
                    const resurrectionMatch = line.match(resurrectionRegex);
                    if (resurrectionMatch) {
                        result.resurrection = { count: parseInt(resurrectionMatch[1]) };
                        result.initialized.resurrection = true;
                    }
                }

                // 两个药品都找到，提前终止遍历（已拿到最早记录）
                if (result.initialized.recovery && result.initialized.resurrection) {
                    break;
                }
            }
            return result;
        } catch (error) {
            // 文件不存在或读取错误时返回空结果
            return result;
        }
    }

    async function updateRecord(filePath, currentRecovery, currentResurrection, deleteSameDayRecords = false) {
        // 生成当前时间字符串
        const now = new Date();
        const timeStr = `${now.getFullYear()}/${
            String(now.getMonth() + 1).padStart(2, '0')
        }/${
            String(now.getDate()).padStart(2, '0')
        } ${
            String(now.getHours()).padStart(2, '0')
        }:${
            String(now.getMinutes()).padStart(2, '0')
        }:${
            String(now.getSeconds()).padStart(2, '0')
        }`;

        // 生成两条新记录
        const recoveryLine = `时间:${timeStr}-${recoveryFoodName}-${currentRecovery}`;
        const resurrectionLine = `时间:${timeStr}-${resurrectionFoodName}-${currentResurrection}`;

        try {
            let content = await file.readText(filePath);
            let lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                // 文件为空，直接写入新记录
                await file.writeText(filePath, `${recoveryLine}\n${resurrectionLine}`);
                return true;
            }

            // 如果需要删除当天同名记录
            if (deleteSameDayRecords) {
                // 获取当前时间范围（当天4点至次日4点）
                let startTime, endTime;
                if (now.getHours() < 4) {
                    // 当前时间在4点前，时间范围为昨天4点至今天4点
                    startTime = new Date(now);
                    startTime.setDate(now.getDate() - 1);
                    startTime.setHours(4, 0, 0, 0);
                    endTime = new Date(now);
                    endTime.setHours(4, 0, 0, 0);
                } else {
                    // 当前时间在4点后，时间范围为今天4点至明天4点
                    startTime = new Date(now);
                    startTime.setHours(4, 0, 0, 0);
                    endTime = new Date(now);
                    endTime.setDate(now.getDate() + 1);
                    endTime.setHours(4, 0, 0, 0);
                }

                // 创建药品匹配正则
                const recoveryRegex = new RegExp(`${recoveryFoodName}-\\d+$`);
                const resurrectionRegex = new RegExp(`${resurrectionFoodName}-\\d+$`);

                // 过滤掉当天时间范围内的同名记录
                lines = lines.filter(line => {
                    const timeMatch = line.match(/时间:(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
                    if (!timeMatch) return true;

                    const recordTime = new Date(timeMatch[1]);
                    // 检查是否在当天时间范围内
                    if (recordTime >= startTime && recordTime < endTime) {
                        // 检查是否为回血药或复活药记录
                        if (recoveryRegex.test(line) || resurrectionRegex.test(line)) {
                            return false; // 删除该记录
                        }
                    }
                    return true; // 保留该记录
                });
            }

            // 添加新记录到最前面
            lines.unshift(resurrectionLine);
            lines.unshift(recoveryLine);

            // 只保留30天内的记录
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentLines = lines.filter(line => {
                const timeMatch = line.match(/时间:(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
                if (!timeMatch) return false;
                const lineTime = new Date(timeMatch[1]);
                return lineTime >= thirtyDaysAgo;
            });

            // 写入文件
            await file.writeText(filePath, recentLines.join('\n'));
            return true;
        } catch (error) {
            // 文件不存在时创建新文件
            await file.writeText(filePath, `${recoveryLine}\n${resurrectionLine}`);
            return true;
        }
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

    async function findAndClick(target, doClick = true, maxAttempts = 60) {
        for (let i = 0; i < maxAttempts; i++) {
            const rg = captureGameRegion();
            try {
                const res = rg.find(target);
                if (res.isExist()) { await sleep(50 * 2 + 50); if (doClick) { res.click(); } return true; }
            } finally { rg.dispose(); }
            if (i < maxAttempts - 1) await sleep(50);
        }
        return false;
    }

    async function clickPNG(png, maxAttempts = 20) {
//        log.info(`调试-点击目标${png},重试次数${maxAttempts}`);
        const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${png}.png`));
        pngRo.Threshold = 0.95;
        pngRo.InitTemplate();
        return await findAndClick(pngRo, true, maxAttempts);
    }

    async function main() {
    // 设置分辨率和缩放
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    keyPress("B");//打开背包
    await sleep(1000);
    await close_expired_stuff_popup_window()
    await sleep(loadDelay);
    click(863, 51);//选择食物
    await sleep(loadDelay);
    await clickPNG('筛选1', 1);
    await clickPNG('筛选2', 1);
    await clickPNG('重置');
    await sleep(stepDelay);
    await clickPNG('搜索');
    await sleep(loadDelay);
    log.info(`搜索${recoveryFoodName}`)
    inputText(recoveryFoodName);
    await clickPNG('确认筛选');
    await sleep(stepDelay);
    let recoveryNumber=await recognizeNumberByOCR(ocrRegion,/\d+/) //识别回血药数量
    // 处理回血药识别结果
    if (recoveryNumber === null) {
        recoveryNumber = 0;
        notification.send(`未识别到回血药数量(数量小于10识别不到)，设置数量为0，药品名：${recoveryFoodName}`)
        await sleep(5000);
        click(863, 51);//选择食物
        await sleep(1000);
    }
    await sleep(loadDelay);
    await clickPNG('筛选1', 1);
    await clickPNG('筛选2', 1);
    await clickPNG('重置');
    await sleep(stepDelay);
    await clickPNG('搜索');
    await sleep(loadDelay);
    log.info(`搜索${resurrectionFoodName}`)
    inputText(resurrectionFoodName);
    await clickPNG('确认筛选');
    await sleep(stepDelay);
    let resurrectionNumber=await recognizeNumberByOCR(ocrRegion,/\d+/) //识别复活药数量
    // 处理复活药识别结果
    if (resurrectionNumber === null) {
        resurrectionNumber = 0;
        notification.send(`未识别到复活药数量(数量小于10识别不到)，设置数量为0，药品名：${resurrectionFoodName}`)
        await sleep(5000);
        click(863, 51);//选择食物
        await sleep(1000);
    }
    await clickPNG('筛选1', 1);
    await clickPNG('筛选2', 1);
    await clickPNG('重置');
    await sleep(stepDelay);
    await clickPNG('确认筛选');
    await genshin.returnMainUi();
    return { recoveryNumber, resurrectionNumber };
    }

    // 主执行流程
    userName = await getUserName();
    const recordPath = `assets/${userName}.txt`;
    // 获取当前药物数量
    const { recoveryNumber, resurrectionNumber } = await main();
    // 获取本地保存的数据
    const localData = await getLocalData(recordPath);
    // 确定初始化数据
    let initRecovery, initResurrection;
    let useLocalDataAsInit = false;
    if (localData.initialized.recovery && localData.initialized.resurrection) {
        // 情况1：两者都有
        initRecovery = localData.recovery.count;
        initResurrection = localData.resurrection.count;
        useLocalDataAsInit = true;
        log.info(`已读取到本地数据`)
    } else if (localData.initialized.recovery || localData.initialized.resurrection) {
        // 情况2：一有一无，用有的那个，缺的用当前数据
        initRecovery = localData.initialized.recovery ? localData.recovery.count : recoveryNumber;
        initResurrection = localData.initialized.resurrection ? localData.resurrection.count : resurrectionNumber;
        log.info(`未读取到全部的本地数据，缺失部分使用当前数据作为初始数据`)
    } else {
        // 情况3：两者都无，使用当前数据
        initRecovery = recoveryNumber;
        initResurrection = resurrectionNumber;
        log.info(`未读取到本地数据，使用当前数据作为初始数据`)
    }
    // 判断是否需要写入（两个数据都不为0时才写入）
    const shouldWriteRecord = recoveryNumber > 0 && resurrectionNumber > 0;
    // initSelect处理逻辑
    if (settings.initSelect && shouldWriteRecord) {
        // 强制初始化：初始化数量和最后一次运行数量都设为当前值
        await updateRecord(recordPath, recoveryNumber, resurrectionNumber,deleteSameDayRecords=true);
        notification.send(`${userName}: 强制初始化完成！${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`);
        return
    }
    if (shouldWriteRecord) {
        // 使用当前的数据更新记录
        await updateRecord(recordPath, recoveryNumber, resurrectionNumber);
        // 本地有初始记录
        if(useLocalDataAsInit){
            // 计算消耗/增加数量
            const diffRecovery = initRecovery - recoveryNumber;
            const diffResurrection = initResurrection - resurrectionNumber;

            let logMsg = "";

            // 处理回血药描述
            let descRecovery = "";
            if (diffRecovery > 0) {
                descRecovery = `消耗${recoveryFoodName}${diffRecovery}个`;
            } else if (diffRecovery < 0) {
                descRecovery = `新增${recoveryFoodName}${-diffRecovery}个`;
            } else {
                descRecovery = `${recoveryFoodName}无变化`;
            }

            // 处理复活药描述
            let descResurrection = "";
            if (diffResurrection > 0) {
                descResurrection = `消耗${resurrectionFoodName}${diffResurrection}个`;
            } else if (diffResurrection < 0) {
                descResurrection = `新增${resurrectionFoodName}${-diffResurrection}个`;
            } else {
                descResurrection = `${resurrectionFoodName}无变化`;
            }

            // 根据变化组合日志消息
            if (diffRecovery === 0 && diffResurrection === 0) {
                // 两个值都等于0，输出无变化
                logMsg = `${userName}: 今日药物数量无变化`;
            } else {
                // 其他情况
                logMsg = `${userName}: 今日${descRecovery}，${descResurrection}`;
            }

            // 添加库存信息
            logMsg += ` | 当前库存：${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`;
            // 发送通知
            notification.send(logMsg);
        }else{
            // 添加账户名称的通知
            notification.send(`${userName}: 今日初始化完成！${recoveryFoodName}${initRecovery}个, ${resurrectionFoodName}${initResurrection}个`);
        }
    } else {
        // 当前数据有任意一个为0，不写入记录，只发送通知
        notification.send(`${userName}: 当前药品数量识别不全（${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个），不更新记录`);
    }
})();