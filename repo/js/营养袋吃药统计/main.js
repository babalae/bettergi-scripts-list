let userName = settings.userName || "默认账户";
const recoveryFoodName = settings.recoveryFoodName || "回血药名字没填";
const resurrectionFoodName = settings.resurrectionFoodName || "复活药名字没填";
const ocrRegion = {
        x: 150,
        y: 250,
        width: 220,
        height: 270
    };
const filterButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/filterButton.png"),154, 1003, 27, 27);
const resetButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/resetButton.png"),66, 1006, 27, 27);
const researchRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/research.png"),95, 101, 27, 27);
const confirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirmButton.png"), 355, 999, 44, 44);
const loadDelay = +settings.loadDelay || 1000;
const stepDelay = +settings.stepDelay || 1000;
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

    // 处理错误格式记录文件（检测时间格式：YYYY/MM/DD HH:mm:ss）
    async function deleteOldFormatRecords(filePath) {
        try {
            // 尝试读取文件，不存在则直接返回
            const content = await file.readText(filePath);
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) return false; // 空文件无需处理

            // 时间格式正则：匹配 "时间:YYYY/MM/DD HH:mm:ss" 完整格式
            const timeFormatRegex = /时间:\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/;

            // 检查是否所有行都包含正确的时间格式
            const allHasValidTime = lines.every(line => timeFormatRegex.test(line));

            if (allHasValidTime) return false; // 所有行都有正确时间格式，无需处理

            // 存在任意行没有正确时间格式，清空文件
            await file.writeText(filePath, '');
            notification.send(`${settings.userName}: 检测到记录文件缺少有效时间格式，已重置记录文件`);
            return true;
        } catch (error) {
            // 文件不存在或其他错误时不处理
            return false;
        }
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

    //  背包过期物品识别，需要在背包界面，并且是1920x1080分辨率下使用
    async function handleExpiredItems() {
          const ifGuoqi = await textOCREnhanced("物品过期", 1.5, 0, 3, 870, 280, 170, 40);
          if (ifGuoqi.found) {
               log.info("检测到过期物品，正在处理...");
               await sleep(500);
               await click(980, 750); // 点击确认按钮，关闭提示
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

    async function findAndClick(target, maxAttempts = 50) {
        for (let i = 0; i < maxAttempts; i++) {
            const result = await recognizeImage(target);
            if (result.success) {
                click(result.x, result.y);
                await sleep(50);
                return true;
            } else {
                log.warn(`未能识别到图标，尝试 ${i + 1}/${maxAttempts}`);
            }
            await sleep(50);
        }
        return false;
    }
    
    // 定义一个函数用于识别图像
    async function recognizeImage(recognitionObject, timeout = 5000) {
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 尝试识别图像
                const ro = captureGameRegion();
                let imageResult = ro.find(recognitionObject);
                ro.dispose();
                if (imageResult && imageResult.x !== 0 && imageResult.y !== 0 && imageResult.width !== 0 && imageResult.height !== 0) {
//                    log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}, width=${imageResult.width}, height=${imageResult.height}`);
                    return { success: true, x: imageResult.x, y: imageResult.y, width: imageResult.width, height: imageResult.height};
                }
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
            }
            await sleep(10); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法识别图像`);
        return { success: false };
    }

    async function main() {
    // 设置分辨率和缩放
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    keyPress("B");//打开背包
    await handleExpiredItems(); //处理过期物品弹窗
    await sleep(loadDelay);
    click(863, 51);//选择食物
    await sleep(loadDelay);
    await findAndClick(filterButtonRo);//筛选 图标的坐标: x=155, y=1004, width=25, height=25，识图范围推荐: 154, 1003, 27, 27
    await sleep(stepDelay);
    await findAndClick(resetButtonRo);//重置按钮 图标的坐标: x=67, y=1007, width=25, height=25，识图范围推荐: 66, 1006, 27, 27
    await sleep(stepDelay);
    await findAndClick(researchRo);//搜索输入框 图标的坐标: x=96, y=102, width=25, height=25，识图范围推荐: 95, 101, 27, 27
    await sleep(loadDelay);
    inputText(recoveryFoodName);
    await sleep(stepDelay);
    await findAndClick(confirmButtonRo);//确认按钮 图标的坐标: x=356, y=1000, width=42, height=42，识图范围推荐: 355, 999, 44, 44
    await sleep(loadDelay);
    let recoveryNumber=await recognizeNumberByOCR(ocrRegion,/\d+/) //识别回血药数量
    // 处理回血药识别结果
    if (recoveryNumber === null) {
        recoveryNumber = 0;
        notification.send(`未识别到回血药数量，设置数量为0，药品名：${recoveryFoodName}`)
        await sleep(5000);
        click(863, 51);//选择食物
        await sleep(1000);
    }
    await findAndClick(filterButtonRo);//筛选 图标的坐标: x=155, y=1004, width=25, height=25，识图范围推荐: 154, 1003, 27, 27
    await sleep(stepDelay);
    await findAndClick(resetButtonRo);//重置按钮
    await sleep(stepDelay);
    await findAndClick(researchRo);//搜索输入框
    await sleep(loadDelay);
    inputText(resurrectionFoodName);
    await sleep(stepDelay);
    await findAndClick(confirmButtonRo);//确认按钮
    await sleep(loadDelay);
    let resurrectionNumber=await recognizeNumberByOCR(ocrRegion,/\d+/) //识别复活药数量
    // 处理复活药识别结果
    if (resurrectionNumber === null) {
        resurrectionNumber = 0;
        notification.send(`未识别到复活药数量，设置数量为0，药品名：${resurrectionFoodName}`)
        await sleep(5000);
        click(863, 51);//选择食物
        await sleep(1000);
    }
    await findAndClick(filterButtonRo);//筛选
    await sleep(stepDelay);
    await findAndClick(resetButtonRo);//重置
    await sleep(stepDelay);
    await findAndClick(confirmButtonRo);//确认按钮
    await genshin.returnMainUi();
    return { recoveryNumber, resurrectionNumber };
    }

    // 主执行流程
    userName = await getUserName();
    const recordPath = `assets/${userName}.txt`;
    // 获取当前药物数量
    const { recoveryNumber, resurrectionNumber } = await main();
    // 处理旧的记录文件
    await deleteOldFormatRecords(recordPath)
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