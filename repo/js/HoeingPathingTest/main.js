// 主逻辑
(async function () {
    const name1 = "锄地路线测试";
    const duration1 = 1234; // 1.234 秒
    await fakeLog(name1, true, false, duration1);

    if (settings.activatePickup) {
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    }

    const startRouteNumber = +settings.startRouteNumber || 1;
    const pathingFolderPath = "pathing";
    const resultFolderPath = "records";
    const fileInfo = file.readTextSync("assets/info.json");
    const infoData = JSON.parse(fileInfo);

    if (!settings.doTest) {
        const startTime = new Date();
        const formattedStartTime = startTime.toISOString().replace(/[^0-9]/g, '');
        const recordFileName = `${formattedStartTime}.json`;
        const recordFilePath = resultFolderPath + '/' + recordFileName;

        const routes = await readFolder(pathingFolderPath, true);
        let i = startRouteNumber - 2;
        let Mora = -1;
        let attempts = 0;
        while (attempts < 5) {
            const result = await mora();
            if (result !== null) {
                Mora = parseInt(result.match(/\d+/g).join(''), 10);
                break;
            }
            attempts++;
            log.warn(`获取的 mora 值为 null，尝试次数 ${attempts}/5，重新获取...`);
        }
        if (Mora === -1) log.warn('尝试 5 次后仍未获取到有效的 mora 值，记为 -1');

        let MonsterInfo = await getMonsterCounts();
        let routeTime = new Date();


        for (let k = 1; k < routes.length + 1; k++) {
            i++;
            if ((i + 1) === (+settings.endRouteNumber)) {
                break;
            }
            await genshin.tpToStatueOfTheSeven();
            if (settings.underwater) {
                await pathingScript.runFile("assets/学习螃蟹技能.json");
            }
            const route = routes[i % routes.length];
            log.info(`完整路径：${route.fullPath}`);

            route.expectMora = 0;
            route.eliteNum = 0;
            route.normalNum = 0;

            const duration2 = 0;
            await fakeLog(route.fullPath, false, true, duration2);
            routeTime = new Date();
            log.info(`这是第 ${(i % routes.length) + 1}条路线：${route.fullPath}`);
            settings.startRouteNumber = (i % routes.length) + 2

            await pathingScript.runFile(route.fullPath);

            const newDate = new Date();
            const timeDiffInSeconds = (newDate - routeTime) / 1000;
            route.routeTime = timeDiffInSeconds;

            const duration3 = 5000;
            await fakeLog(route.fullPath, false, false, duration3);

            try { await sleep(10); } catch (error) { log.error(`运行中断: ${error}`); break; }

            const currentMonsterInfo = await getMonsterCounts();
            const monsterDifferences = {};
            for (const monster in currentMonsterInfo) {
                if (currentMonsterInfo[monster] !== MonsterInfo[monster] &&
                    currentMonsterInfo[monster] !== -1 &&
                    MonsterInfo[monster] !== -1) {
                    monsterDifferences[monster] = currentMonsterInfo[monster] - MonsterInfo[monster];
                }
            }
            route.monsterNum = monsterDifferences;
            MonsterInfo = currentMonsterInfo;

            let currentMora = -1;
            attempts = 0;
            while (attempts < 5) {
                const result = await mora();
                if (result !== null) {
                    currentMora = parseInt(result.match(/\d+/g).join(''), 10);
                    break;
                }
                attempts++;
                log.warn(`获取的 mora 值为 null，尝试次数 ${attempts}/5，重新获取...`);
            }
            if (Mora === -1) log.warn('尝试 5 次后仍未获取到有效的 mora 值，记为 -1');

            const moraDiff = currentMora - Mora;
            route.moraDiff = moraDiff;
            Mora = currentMora;

            for (const [monsterName, count] of Object.entries(route.monsterNum)) {
                const monsterInfo = infoData.find(item => item.name === monsterName);
                if (monsterInfo) {
                    if (monsterInfo.type === "普通") {
                        route.normalNum += count;
                        route.expectMora += count * monsterInfo.moraRate * 40.5;
                    } else if (monsterInfo.type === "精英") {
                        route.eliteNum += count;
                        route.expectMora += count * monsterInfo.moraRate * 200;
                    }
                }
            }

            const recordContent = JSON.stringify(routes.slice(startRouteNumber - 1, i + 1), null, 2);
            try {
                await file.writeText(recordFilePath, recordContent);
                log.info(`记录文件已写入 ${recordFilePath}`);
            } catch (error) {
                log.error(`写入记录文件失败: ${error.message}`);
            }
            await sleep(1000);
        }
    } else {
        log.info("doTest 设置为 false，读取 records 文件夹中的文件");

        const routes = await readFolder(pathingFolderPath, true);
        log.info(`找到 ${routes.length} 个路径文件`);
        const records = await readFolder("records", true);
        log.info(`找到 ${records.length} 个记录文件`);

        const recordMap = {}; // 🔥 文件名匹配

        for (const record of records) {
            log.info(`处理文件：${record.fullPath}`);
            try {
                const fileContent = file.readTextSync(record.fullPath);
                const jsonData = JSON.parse(fileContent);
                const filtered = jsonData.filter(r => {
                    if (r.routeTime < 10) {
                        log.warn(`过滤异常记录: ${r.fullPath} | 用时=${r.routeTime}s（<10s）`);
                        return false;
                    }
                    if (r.monsterNum && typeof r.monsterNum === 'object') {
                        for (const [k, v] of Object.entries(r.monsterNum)) {
                            if (typeof v !== 'number' || v < 0 || v > 50) {
                                log.warn(`修正异常数量: ${r.fullPath} | ${k}: ${v} → 0`);
                                r.monsterNum[k] = 0;
                            }
                        }
                        const nums = Object.values(r.monsterNum);
                        if (nums.length && nums.every(c => c === 0)) {
                            log.warn(`过滤全零记录: ${r.fullPath}`);
                            return false;
                        }
                    }
                    return true;
                });

                if (Array.isArray(filtered)) {
                    for (const entry of filtered) {
                        const fileName = entry.fullPath.split('\\').pop(); // 🔥 文件名匹配
                        if (!fileName) {
                            log.warn(`fileName 为空，跳过该记录`);
                            continue;
                        }
                        if (!recordMap[fileName]) recordMap[fileName] = []; // 🔥 文件名匹配
                        recordMap[fileName].push({
                            fullPath: entry.fullPath,
                            fileName, // 🔥 文件名匹配
                            monsterNum: entry.monsterNum,
                            moraDiff: entry.moraDiff,
                            routeTime: entry.routeTime,
                            expectMora: entry.expectMora,
                            normalNum: entry.normalNum,
                            eliteNum: entry.eliteNum
                        });
                        if (recordMap[fileName].length > 7) recordMap[fileName].shift(); // 🔥 文件名匹配
                    }
                } else {
                    log.warn(`文件 ${record.fileName} 的内容不是数组，跳过该文件`);
                }
            } catch (error) {
                log.error(`读取或解析文件 ${record.fileName} 时出错：${error.message}`);
            }
        }

        const finalRecords = [];
        for (const fileName in recordMap) { // 🔥 文件名匹配
            const records = recordMap[fileName]; // 🔥 文件名匹配
            const fields = ["routeTime"];
            const processedRecord = { fileName, records: {} }; // 🔥 文件名匹配

            // =================  1. routeTime：只认 >10 秒  =================
            {
                const values = records
                    .map(r => r.routeTime)
                    .filter(v => typeof v === 'number' && v > 10);   // 🔥 只要 >10 秒
                if (values.length === 0) {
                    processedRecord.records.routeTime = 0;
                } else {
                    values.sort((a, b) => a - b);
                    const mid = Math.floor(values.length / 2);
                    processedRecord.records.routeTime = parseFloat(
                        (values.length % 2 === 0
                            ? (values[mid - 1] + values[mid]) / 2
                            : values[mid]).toFixed(2)
                    );
                }
            }

            // =================  2. monsterNum：0-40 只，缺项当 0  =================
            processedRecord.records.monsterNum = {};

            // 所有出现过的怪物名
            const allMonsters = [...new Set(records.flatMap(r => Object.keys(r.monsterNum || {})))];

            allMonsters.forEach(monster => {
                // 逐条采样：没写就按 0 算
                const values = records
                    .map(r => {
                        const v = r.monsterNum?.[monster];   // 可能为 undefined
                        const num = typeof v === 'number' ? v : 0; // 没写→0
                        return num >= 0 && num <= 40 ? num : NaN;  // 超界当 NaN 扔
                    })
                    .filter(v => !isNaN(v))                 // 只保留 0-40 的采样
                    .sort((a, b) => a - b);

                if (values.length === 0) return;          // 全部超界才真的跳过
                const mid = Math.floor(values.length / 2);
                const median = parseFloat(
                    (values.length % 2 === 0
                        ? (values[mid - 1] + values[mid]) / 2
                        : values[mid]).toFixed(2)
                );

                // 中位数>0 才写，避免全是 0 还占字段
                if (median > 0) processedRecord.records.monsterNum[monster] = median;
            });

            processedRecord.records.normalNum = 0;
            processedRecord.records.eliteNum = 0;
            processedRecord.records.expectMora = 0;
            for (const [monsterName, count] of Object.entries(processedRecord.records.monsterNum)) {
                const monsterInfo = infoData.find(item => item.name === monsterName);
                if (monsterInfo) {
                    if (monsterInfo.type === "普通") {
                        processedRecord.records.normalNum += count;
                        processedRecord.records.expectMora += count * monsterInfo.moraRate * 40.5;
                    } else if (monsterInfo.type === "精英") {
                        processedRecord.records.eliteNum += count;
                        processedRecord.records.expectMora += count * monsterInfo.moraRate * 200;
                    }
                }
            }
            finalRecords.push(processedRecord);
        }

        let matchedCount = 0;
        let unmatchedCount = 0;
        for (const { fileName, records } of finalRecords) { // 🔥 文件名匹配
            const route = routes.find(r => r.fileName === fileName); // 🔥 文件名匹配
            if (!route) {
                log.warn(`未找到文件名对应的路线: ${fileName}`); // 🔥 文件名匹配
                unmatchedCount++;
                continue;
            }
            const fileContent = file.readTextSync(route.fullPath);
            const jsonData = JSON.parse(fileContent);
            const { routeTime, expectMora, normalNum, eliteNum, monsterNum } = records;
            const refCount = recordMap[fileName] ? recordMap[fileName].length : 0; // 🔥 文件名匹配
            const monsterDescription = Object.entries(monsterNum)
                .map(([m, c]) => `${c}只${m}`)
                .join('、');
            let newDescription;
            if (eliteNum === 0 && normalNum === 0) {
                newDescription = `  路线信息：该路线预计用时${routeTime}秒，该路线不含任何精英或小怪。`;
            } else {
                newDescription = `  路线信息：该路线预计用时${routeTime}秒，包含以下怪物：${monsterDescription}。`;
            }
            jsonData.info.description = `${newDescription}`;
            const targetFolder = refCount > 3 ? 'pathingOut' : 'pathingToCheck';
            const modifiedFullPath = route.fullPath.replace('pathing', targetFolder);
            await file.writeTextSync(modifiedFullPath, JSON.stringify(jsonData, null, 2));
            log.info(`文件 ${route.fullPath} 的 description 已更新，本次共参考 ${refCount} 份历史记录`);
            if (refCount <= 3) log.warn('参考记录少于等于 3 份，可信度较低，输出到 pathingToCheck 目录');
            matchedCount++;
        }
        log.info(`总路径文件数：${routes.length}`);
        log.info(`成功匹配并修改的文件数：${matchedCount}`);
        log.info(`未匹配的记录数：${unmatchedCount}`);
    }

    const duration4 = 0;
    await fakeLog(name1, true, true, duration4);
})();

async function readFolder(folderPath, onlyJson) {
    const folderStack = [folderPath];
    const files = [];
    while (folderStack.length > 0) {
        const currentPath = folderStack.pop();
        const filesInSubFolder = file.ReadPathSync(currentPath);
        const subFolders = [];
        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                subFolders.push(filePath);
            } else {
                if (onlyJson && !filePath.endsWith('.json')) continue;
                const fileName = filePath.split('\\').pop();
                const folderPathArray = filePath.split('\\').slice(0, -1);
                files.push({ fullPath: filePath, fileName, folderPathArray });
            }
        }
        folderStack.push(...subFolders.reverse());
    }
    return files;
}

async function readFolder(folderPath, onlyJson) {
    log.info(`开始读取文件夹：${folderPath}`);

    // 新增一个堆栈，初始时包含 folderPath
    const folderStack = [folderPath];

    // 新增一个数组，用于存储文件信息对象
    const files = [];

    // 当堆栈不为空时，继续处理
    while (folderStack.length > 0) {
        // 从堆栈中弹出一个路径
        const currentPath = folderStack.pop();

        // 读取当前路径下的所有文件和子文件夹路径
        const filesInSubFolder = file.ReadPathSync(currentPath);

        // 临时数组，用于存储子文件夹路径
        const subFolders = [];
        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                // 如果是文件夹，先存储到临时数组中
                subFolders.push(filePath);
            } else {
                // 如果是文件，根据 onlyJson 判断是否存储
                if (onlyJson) {
                    if (filePath.endsWith(".json")) {
                        const fileName = filePath.split('\\').pop(); // 提取文件名
                        const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                        files.push({
                            fullPath: filePath,
                            fileName: fileName,
                            folderPathArray: folderPathArray
                        });
                        //log.info(`找到 JSON 文件：${filePath}`);
                    }
                } else {
                    const fileName = filePath.split('\\').pop(); // 提取文件名
                    const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                    files.push({
                        fullPath: filePath,
                        fileName: fileName,
                        folderPathArray: folderPathArray
                    });
                    //log.info(`找到文件：${filePath}`);
                }
            }
        }
        // 将临时数组中的子文件夹路径按原顺序压入堆栈
        folderStack.push(...subFolders.reverse()); // 反转子文件夹路径
    }

    return files;
}

async function getMonsterCounts() {
    let failcount = 0;
    /* 0. 读取怪物列表 */
    const raw = file.readTextSync('assets/info.json');
    const monsterList = JSON.parse(raw).map(it => it.name);
    const monsterCounts = {};

    /* 外层重试：最多 3 轮 */
    for (let round = 1; round <= 3; round++) {
        log.info(`===== 第 ${round} 轮获取怪物数量 =====`);

        /* 1. 外层循环：最多 3 次进入生物志 */
        let attempt = 0;
        while (attempt < 3) {
            attempt++;
            log.info(`第 ${attempt} 次尝试进入生物志`);
            await genshin.returnMainUi();
            keyPress('VK_ESCAPE');
            await sleep(1500);

            const archiveTpl = RecognitionObject.TemplateMatch(
                file.readImageMatSync('assets/RecognitionObject/图鉴.png'), 0, 0, 1920, 1080);
            if (!(await findAndClick(archiveTpl))) continue;

            const faunaTpl = RecognitionObject.TemplateMatch(
                file.readImageMatSync('assets/RecognitionObject/生物志.png'), 0, 0, 1920, 1080);
            if (!(await findAndClick(faunaTpl))) continue;

            click(1355, 532);
            await sleep(2000);
            break;
        }
        if (attempt >= 3) {
            log.error('连续 3 次无法进入生物志，脚本终止');
            await genshin.returnMainUi();
            return {};
        }

        /* ===== 工具函数 ===== */
        async function findAndClick(target, maxAttempts = 100) {
            for (let attempts = 0; attempts < maxAttempts; attempts++) {
                const gameRegion = captureGameRegion();
                try {
                    const result = gameRegion.find(target);
                    if (result.isExist()) {
                        result.click();
                        return true;                 // 成功立刻返回
                    }
                } catch (err) {
                } finally {
                    gameRegion.dispose();
                }
                if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
                    await sleep(50);
                }
            }
            //log.error("已达到重试次数上限，仍未找到目标");
            return false;
        }

        async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
            moveMouseTo(400, 750); // 移动到屏幕水平中心，垂直750坐标
            await sleep(50);
            leftButtonDown();

            // 计算滚动方向和总步数
            const isDownward = totalDistance < 0; // 如果totalDistance为负数，则向下滑动
            const steps = Math.ceil(Math.abs(totalDistance) / stepDistance); // 使用绝对值计算步数

            for (let j = 0; j < steps; j++) {
                const remainingDistance = Math.abs(totalDistance) - j * stepDistance;
                const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;

                // 根据滚动方向调整移动方向
                const direction = isDownward ? 1 : -1; // 向下滑动为正方向，向上滑动为负方向
                moveMouseBy(0, 1.2 * direction * moveDistance); // 根据方向调整滚动方向
                await sleep(delayMs);
            }

            await sleep(300);
            leftButtonUp();
            await sleep(1000);
        }

        async function readKillCount(maxTry = 10) {
            const ocrObj = RecognitionObject.Ocr(865, 980, 150, 50);
            for (let t = 0; t < maxTry; t++) {
                const region = captureGameRegion();
                const results = region.findMulti(ocrObj);
                region.dispose();

                for (let i = 0; i < results.count; i++) {
                    const str = results[i].text.trim();
                    // 必须是纯数字
                    if (/^\d+$/.test(str)) {
                        return { success: true, count: parseInt(str, 10) };
                    }
                }
                if (t < maxTry - 1) await sleep(25); // 最后一次不重试
            }
            return { success: false, count: -1 };
        }

        async function readKillCountStable(prevCount, sameTolerance = 5) {
            let lastCount = -1;
            for (let r = 0; r < sameTolerance; r++) {
                await sleep(50 * r);
                //log.info(`执行第${r}次ocr`)
                const ocrRet = await readKillCount();
                if (!ocrRet.success) break;              // 真的读不到数字就放弃
                lastCount = ocrRet.count;

                if (lastCount !== prevCount) return { success: true, count: lastCount }; // 变了→成功
            }
            // 3 次仍相同→返回最后一次相同值
            return { success: true, count: lastCount };
        }


        async function findMonsterIcon(monsterId, iconRetry = 3) {
            const tpl = RecognitionObject.TemplateMatch(
                file.readImageMatSync(`assets/monster/${monsterId.trim()}.png`), 130, 80, 670, 970);
            let pageTurnsUp = 0;
            while (pageTurnsUp < 1) {
                let pageTurns = 0;
                while (pageTurns < 2) {
                    //log.info("执行一次模板识别");
                    if (await findAndClick(tpl, iconRetry)) return true;
                    await scrollPage(400);
                    pageTurns++;
                }
                for (let j = 0; j < 2; j++) {
                    await scrollPage(-370);
                }
                pageTurnsUp++;
            }
            return false;
        }

        /* ===== 主循环 ===== */
        let prevCount = -1;          // 上一轮 OCR 结果
        let retryMask = 0;           // 位掩码：第 i 位为 1 表示已回退过
        let prevFinalCount = -1;   // 上一只怪物的最终击杀数
        let continuousFail = 0;    // 连续 -1 计数器（新增）

        for (let i = 0; i < monsterList.length; i++) {
            const monsterId = monsterList[i];
            let time0 = new Date();
            /* 1. 找怪 + OCR */
            if (!(await findMonsterIcon(monsterId, 3))) {
                log.info(`怪物: ${monsterId.trim()}, 未找到图标`);
                failcount++;
                if (failcount >= 10) {
                    break;
                }
                monsterCounts[monsterId.trim()] = -1;
                prevCount = -1;                 // 重置
                continuousFail++;               // 新增
                if (continuousFail >= 7) {      // 新增
                    log.warn('连续 7 个怪物获取失败，中断本轮');
                    break;                      // 新增：中断本轮
                }
                continue;
            }
            let time1 = new Date();
            //log.info(`寻找图标用时${time1 - time0}`);
            /* 2. OCR：与上一只结果比较，原地重试 3 次 */
            const ocr = await readKillCountStable(prevFinalCount, 3);
            const count = ocr.success ? ocr.count : -1;
            let time2 = new Date();
            //log.info(`ocr用时${time2 - time1}`);
            /* 2. 结果相同且本行还没回退过 → 回退一次 */
            if (count === prevCount && !(retryMask & (1 << i))) {
                retryMask |= (1 << i);          // 标记已回退
                i--;                            // 回退同一 i 一次
                continue;
            }

            /* 3. 正常记录 */
            monsterCounts[monsterId.trim()] = count;
            log.info(`怪物: ${monsterId.trim()}, 数量: ${count}`);
            prevCount = count;
            prevFinalCount = count;   // 记录本次最终值，供下一只比对

            /* 新增：连续失败计数更新 */
            if (count === -1) {
                continuousFail++;
                if (continuousFail >= 7) {
                    log.warn('连续 7 个怪物获取失败，中断本轮');
                    break;
                }
            } else {
                continuousFail = 0;   // 成功就清零
            }
        }

        /* 本轮结束判定：如果中途没有因“7连失败”跳出，则认为成功 */
        if (continuousFail < 7) {
            log.info('所有怪物数量获取完成');
            return monsterCounts;
        }
        /* 否则 continuousFail >=7，自动进入下一轮重试 */
    }

    /* 3 轮都失败 */
    log.error('3 轮重试后仍连续 7 次失败，放弃获取');
    return monsterCounts;
}

// 定义 mora 函数
async function mora() {
    // 定义所有图标的图像识别对象，每个图片都有自己的识别区域
    let CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CharacterMenu.png"), 60, 991, 38, 38);

    // 定义一个函数用于识别图像
    async function recognizeImage(recognitionObject, timeout = 5000) {
        log.info(`开始图像识别，超时时间: ${timeout}ms`);
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 尝试识别图像
                let imageResult = captureGameRegion().find(recognitionObject);
                if (imageResult) {
                    log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
                    return { success: true, x: imageResult.x, y: imageResult.y };
                }
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
            }
            await sleep(500); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法识别图像`);
        return { success: false };
    }

    // 定义一个函数用于识别文字并点击
    async function recognizeTextAndClick(targetText, ocrRegion, timeout = 5000) {
        log.info(`开始文字识别，目标文本: ${targetText}，区域: x=${ocrRegion.x}, y=${ocrRegion.y}, width=${ocrRegion.width}, height=${ocrRegion.height}`);
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 尝试 OCR 识别
                let resList = captureGameRegion().findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)); // 指定识别区域
                // 遍历识别结果，检查是否找到目标文本
                for (let res of resList) {
                    // 后处理：根据替换映射表检查和替换错误识别的字符
                    let correctedText = res.text;

                    if (correctedText.includes(targetText)) {
                        // 如果找到目标文本，计算并点击文字的中心坐标
                        let centerX = res.x + res.width / 2;
                        let centerY = res.y + res.height / 2;
                        log.info(`识别到目标文本: ${correctedText}，点击坐标: x=${centerX}, y=${centerY}`);
                        await click(centerX, centerY);
                        await sleep(500); // 确保点击后有足够的时间等待
                        return { success: true, x: centerX, y: centerY };
                    }
                }
            } catch (error) {
                log.warn(`页面标志识别失败，正在进行重试... 错误信息: ${error.message}`);
            }
            await sleep(1000); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法识别文字: ${targetText}`);
        return { success: false };
    }

    // 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
    async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
        log.info(`开始 OCR 识别，区域: x=${ocrRegion.x}, y=${ocrRegion.y}, width=${ocrRegion.width}, height=${ocrRegion.height}`);
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // 在指定区域进行 OCR 识别
                let ocrResult = captureGameRegion().find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
                if (ocrResult) {
                    log.info(`OCR 识别成功，原始文本: ${ocrResult.text}`);
                    // 后处理：根据替换映射表检查和替换错误识别的字符
                    let correctedText = ocrResult.text;
                    log.info(`修正后文本: ${correctedText}`);
                    return correctedText; // 返回识别到的内容
                } else {
                    log.warn(`OCR 识别区域未找到内容`);
                    return null; // 如果 OCR 未识别到内容，返回 null
                }
            } catch (error) {
                log.error(`OCR 摩拉数识别失败，错误信息: ${error.message}`);
            }
            await sleep(500); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
        return null; // 如果未识别到文字，返回 null
    }
    log.info("开始执行 mora 函数");
    // 设置游戏分辨率和 DPI 缩放比例
    setGameMetrics(1920, 1080, 1);
    log.info("游戏分辨率和 DPI 设置完成");

    // 返回游戏主界面
    await genshin.returnMainUi();
    log.info("返回游戏主界面");

    // 按下 C 键
    keyPress("C");
    log.info("按下 C 键");
    await sleep(1500);

    let recognized = false;

    // 识别“角色菜单”图标或“天赋”文字
    let startTime = Date.now();
    while (Date.now() - startTime < 5000) {
        // 尝试识别“角色菜单”图标
        let characterMenuResult = await recognizeImage(CharacterMenuRo, 5000);
        if (characterMenuResult.success) {
            await click(177, 433);
            log.info("点击角色菜单图标");
            await sleep(500);
            recognized = true;
            break;
        }

        // 尝试识别“天赋”文字
        let targetText = "天赋";
        let ocrRegion = { x: 133, y: 395, width: 115, height: 70 }; // 设置对应的识别区域
        let talentResult = await recognizeTextAndClick(targetText, ocrRegion);
        if (talentResult.success) {
            log.info(`点击天赋文字，坐标: x=${talentResult.x}, y=${talentResult.y}`);
            recognized = true;
            break;
        }

        await sleep(1000); // 短暂延迟，避免过快循环
    }

    // 如果识别到了“角色菜单”或“天赋”，则识别“摩拉数值”
    if (recognized) {
        let ocrRegionMora = { x: 1620, y: 25, width: 152, height: 46 }; // 设置对应的识别区域
        let recognizedText = await recognizeTextInRegion(ocrRegionMora);
        if (recognizedText) {
            log.info(`成功识别到摩拉数值: ${recognizedText}`);
            return recognizedText; // 返回识别到的摩拉数值
        } else {
            log.warn("未能识别到摩拉数值。");
        }
    } else {
        log.warn("未能识别到角色菜单或天赋，跳过摩拉数值识别。");
    }

    await sleep(500);
    await genshin.returnMainUi();
    log.info("返回游戏主界面");

    return null; // 如果未能识别到摩拉数值，返回 null
}

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