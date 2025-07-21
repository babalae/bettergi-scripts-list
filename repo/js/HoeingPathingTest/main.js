
// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};

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
    // 初始化结果对象
    const monsterCounts = {};

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

        await sleep(200);
        leftButtonUp();
        await sleep(100);
    }

    await genshin.returnMainUi(); // 返回主界面
    keyPress("VK_ESCAPE"); // 打开派蒙菜单
    await sleep(1500); // 等待1.5秒

    // 1. 识别并点击【图鉴】
    const archiveTemplate = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/RecognitionObject/图鉴.png"),
        0, 0, 1920, 1080
    );
    const archiveRegion = captureGameRegion().find(archiveTemplate);
    if (!archiveRegion.isEmpty()) {
        archiveRegion.click();
    }
    await sleep(3000); // 等待3秒

    // 2. 识别并点击【生物志】
    const faunaTemplate = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/RecognitionObject/生物志.png"),
        0, 0, 1920, 1080
    );
    const faunaRegion = captureGameRegion().find(faunaTemplate);
    if (!faunaRegion.isEmpty()) {
        faunaRegion.click();
    }
    await sleep(400);
    click(1355, 532);
    await sleep(2000); // 等待2秒

    // 3. 循环处理怪物识别
    // 读取 name.txt 文件中的怪物名称列表
    const monsterList = file.readTextSync("assets/name.txt").split('\n').filter(name => name.trim() !== '');
    let monsterNum = 1;

    let previousMonsterCount = -1;

    let failCount = 0;

    for (let i = 0; i < monsterList.length; i++) {
        const monsterId = monsterList[i];
        let monsterRegion = null;

        let pageTurnsUp = 0;
        while (pageTurnsUp < 5) {
            let pageTurns = 0;
            while (pageTurns < 5) {
                let tryTimes = 0;
                while (tryTimes < 5) {
                    // 4a. 识别怪物图片
                    const monsterTemplate = RecognitionObject.TemplateMatch(
                        file.readImageMatSync(`assets/monster/${monsterId.trim()}.png`),
                        0, 0, 1920, 1080
                    );
                    monsterRegion = captureGameRegion().find(monsterTemplate);
                    if (!monsterRegion.isEmpty()) {
                        break; // 识别到怪物，跳出翻页循环
                    }
                    //未识别到时重试
                    tryTimes++;
                }
                if (!monsterRegion.isEmpty()) {
                    break; // 识别到怪物，跳出翻页循环
                }
                // 未识别到则向下翻页
                await scrollPage(300); // 调用翻页函数
                pageTurns++;
            }
            if (!monsterRegion.isEmpty()) {
                break; // 识别到怪物，跳出翻页循环
            }
            // 未识别到则向上翻页
            await scrollPage(-1800); // 调用翻页函数
            pageTurnsUp++;
        }

        if (!monsterRegion || monsterRegion.isEmpty()) {
            log.info(`怪物: ${monsterId.trim()}, 没有找到`);
            monsterCounts[monsterId.trim()] = -1;
            continue; // 达到翻页上限仍未找到，处理下一个怪物
        }

        monsterRegion.click(); // 点击怪物图标
        await sleep(10); // 等待界面加载

        // 4b. 识别数量区域（870,1000,100,30）
        const countRegion = new ImageRegion(
            captureGameRegion().SrcMat,
            830, 980,
            null, // owner 参数设置为 null
            null, // converter 参数设置为 null
            null  // drawContent 参数设置为 null
        );
        // 创建OCR识别对象
        const ocrObject = RecognitionObject.Ocr(830, 980, 140, 70);
        const countResults = countRegion.findMulti(ocrObject);
        let monsterCount = "-1";

        if (countResults.count > 0) {
            for (let i = 0; i < countResults.count; i++) {
                const text = countResults[i].text;
                const numbers = text.match(/\d+/);
                if (numbers) {
                    monsterCount = numbers[0];
                    break;
                }
            }
        }

        if ((monsterCount === -1 || monsterCount === previousMonsterCount) && failCount <= 5) {
            log.warn(`识别失败或结果与上次相同，重新识别第 ${i + 1} 个怪物 ${monsterId}`);
            i--; // 将索引减 1，使得下一次循环重新执行当前索引
            failCount++;//失败计数加一
            continue; // 跳过当前迭代的剩余部分
        } else {
            failCount = 0;//重置失败计数
        }

        previousMonsterCount = monsterCount;


        // 4c. 输出日志
        log.info(`NO.${monsterNum} 怪物名称: ${monsterId.trim()}, 数量: ${monsterCount}`);
        monsterNum++;

        // 4d. 存储结果到对象
        monsterCounts[monsterId.trim()] = monsterCount;
    }

    return monsterCounts;
}

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
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }

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
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }
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

// 定义 mora 函数
async function mora() {
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

// 定义自定义函数 basename，用于获取文件名
function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
    return filePath.substring(lastSlashIndex + 1);
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

// 主逻辑
(async function () {
    const name1 = "锄地路线测试";
    // 调用 fakeLog 函数，输出 JavaScript 的结尾日志，耗时 1.234 秒
    const duration1 = 1234; // 1.234 秒
    await fakeLog(name1, true, false, duration1);
    // 启用自动拾取的实时任务
    log.info("启用自动拾取的实时任务");
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    // 从自定义配置中获取 startRouteNumber，默认值为 1
    const startRouteNumber = settings.startRouteNumber || 1;

    // 定义 pathing 文件夹路径
    const pathingFolderPath = "pathing";

    // 定义 result 文件夹路径
    const resultFolderPath = "records";

    // 读取文件内容并解析为对象
    const fileInfo = file.readTextSync("assets/info.json");
    const infoData = JSON.parse(fileInfo);

    if (!settings.doTest) {
        // 在 for 循环之前获取一次时间,用于命名记录文件
        const startTime = new Date();
        const formattedStartTime = startTime.toISOString().replace(/[^0-9]/g, ''); // 去掉所有非数字的字符

        const recordFileName = `${formattedStartTime}.json`;

        const recordFilePath = resultFolderPath + '/' + recordFileName; // 使用字符串拼接

        // 读取 pathing 文件夹中的所有文件路径
        const routes = await readFolder(pathingFolderPath, true);

        let Mora = -1; // 初始化为 -1，表示失败
        let attempts = 0; // 初始化尝试次数

        while (attempts < 5) {
            const result = await mora(); // 调用 mora() 获取结果
            if (result !== null) {
                Mora = parseInt(result.match(/\d+/g).join(''), 10); // 处理结果并赋值
                break; // 成功获取后退出循环
            }
            attempts++; // 增加尝试次数
            log.warn(`获取的 mora 值为 null，尝试次数 ${attempts}/5，重新获取...`);
        }

        if (Mora === -1) {
            log.warn('尝试 5 次后仍未获取到有效的 mora 值，记为 -1');
        }


        // 在循环前获取初始的怪物数量信息
        let MonsterInfo = await getMonsterCounts();

        let routeTime = new Date();



        // 遍历 routes 数组，处理每个文件的 fullPath
        for (let i = startRouteNumber - 1; i < routes.length; i++) {
            await genshin.tpToStatueOfTheSeven();
            const route = routes[i];
            log.info(`完整路径：${route.fullPath}`);

            // 初始化 expectMora, eliteNum 和 normalNum
            route.expectMora = 0;
            route.eliteNum = 0;
            route.normalNum = 0;

            // 输出地图追踪开始的日志
            const duration2 = 0; // 地图追踪开始时，耗时为 0
            await fakeLog(route.fullPath, false, true, duration2);

            routeTime = new Date();

            log.info(`这是第 ${i + 1}条路线：${route.fullPath}`)

            // 执行路线文件
            await pathingScript.runFile(route.fullPath);

            // 再次获取当前时间
            let newDate = new Date();

            // 计算时间差（以秒为单位）
            const timeDiffInSeconds = (newDate - routeTime) / 1000;

            // 将时间差添加到对应 routes 中的 routeTime 子项
            route.routeTime = timeDiffInSeconds;

            // 调用 fakeLog 函数，输出地图追踪结束的日志，耗时 5.000 秒
            const duration3 = 5000; // 5.000 秒
            await fakeLog(route.fullPath, false, false, duration3);

            try {
                await sleep(10);
            } catch (error) {
                log.error(`运行中断: ${error}`);
                break;
            }

            // 再次获取怪物数量信息
            let currentMonsterInfo = await getMonsterCounts();

            const monsterDifferences = {};
            for (const monster in currentMonsterInfo) {
                // 检查当前怪物数量或初始怪物数量是否为 -1
                if (currentMonsterInfo[monster] !== MonsterInfo[monster] &&
                    currentMonsterInfo[monster] !== -1 &&
                    MonsterInfo[monster] !== -1) {
                    monsterDifferences[monster] = currentMonsterInfo[monster] - MonsterInfo[monster];
                }
            }

            // 将不为 0 且不涉及 -1 的怪物及其数量添加到对应 routes 中的 monsterNum 子项
            route.monsterNum = monsterDifferences;


            // 更新 MonsterInfo 为当前的怪物数量信息，以便下一次循环使用
            MonsterInfo = currentMonsterInfo;

            let currentMora = -1; // 初始化为 -1，表示失败
            attempts = 0; // 初始化尝试次数

            while (attempts < 5) {
                const result = await mora(); // 调用 mora() 获取结果
                if (result !== null) {
                    currentMora = parseInt(result.match(/\d+/g).join(''), 10); // 处理结果并赋值
                    break; // 成功获取后退出循环
                }
                attempts++; // 增加尝试次数
                log.warn(`获取的 mora 值为 null，尝试次数 ${attempts}/5，重新获取...`);
            }

            if (Mora === -1) {
                log.warn('尝试 5 次后仍未获取到有效的 mora 值，记为 -1');
            }

            // 计算摩拉数量的差值
            const moraDiff = currentMora - Mora;

            // 将摩拉数量的差值添加到对应 routes 中的 moraDiff 子项
            route.moraDiff = moraDiff;

            // 更新 Mora 为当前的摩拉数量，以便下一次循环使用
            Mora = currentMora;

            // 处理怪物数量信息
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

            // 将已经运行过的 routes 写入记录文件
            let recordContent = JSON.stringify(routes.slice(startRouteNumber - 1, i + 1), null, 2);
            log.debug(recordContent);
            // 将文件名写入记录文件
            try {
                await file.writeText(recordFilePath, recordContent);
                log.info(`记录文件已写入 ${recordFilePath}`);
            } catch (error) {
                log.error(`写入记录文件失败: ${error.message}`);
            }
            await sleep(1000);
        }
    } else {
        // 在 else 分支中读取 records 文件夹中的文件
        log.info("doTest 设置为 false，读取 records 文件夹中的文件");

        // 读取 pathing 文件夹中的所有文件路径
        const pathingFolderPath = "pathing";
        const routes = await readFolder(pathingFolderPath, true);
        log.info(`找到 ${routes.length} 个路径文件`);

        // 读取 records 文件夹中的所有文件路径
        const recordsFolderPath = "records";
        const records = await readFolder(recordsFolderPath, true);
        log.info(`找到 ${records.length} 个记录文件`);

        // 创建一个对象来存储每个 fullPath 的最近五次记录
        const recordMap = {};

        // 遍历读取到的记录文件路径
        for (const record of records) {
            log.info(`处理文件：${record.fullPath}`);

            try {
                // 读取文件内容
                const fileContent = file.readTextSync(record.fullPath);
                log.info(`文件内容：${fileContent}`);

                // 解析文件内容
                const jsonData = JSON.parse(fileContent);

                // 如果 jsonData 是一个数组，遍历数组中的每一项
                if (Array.isArray(jsonData)) {
                    for (const entry of jsonData) {
                        // 提取需要的信息
                        // 逐项解析
                        const fullPath = entry.fullPath;
                        const monsterNum = entry.monsterNum;
                        const moraDiff = entry.moraDiff;
                        const routeTime = entry.routeTime;
                        const expectMora = entry.expectMora;
                        const normalNum = entry.normalNum;
                        const eliteNum = entry.eliteNum;
                        // 如果 fullPath 不存在或为空，跳过该记录
                        if (!fullPath) {
                            log.warn(`文件 ${record.fileName} 中的 fullPath 不存在或为空，跳过该记录`);
                            continue;
                        }

                        // 如果 recordMap 中没有这个 fullPath，初始化一个数组
                        if (!recordMap[fullPath]) {
                            recordMap[fullPath] = [];
                        }

                        // 将当前记录添加到数组中
                        recordMap[fullPath].push({
                            fullPath,
                            monsterNum,
                            moraDiff,
                            routeTime,
                            expectMora,
                            normalNum,
                            eliteNum
                        });

                        // 确保每个 fullPath 的记录不超过七次
                        if (recordMap[fullPath].length > 7) {
                            recordMap[fullPath].shift(); // 移除最早的记录
                        }
                    }
                } else {
                    log.warn(`文件 ${record.fileName} 的内容不是数组，跳过该文件`);
                }
            } catch (error) {
                log.error(`读取或解析文件 ${record.fileName} 时出错：${error.message}`);
            }
        }

        // 对 recordMap 中的每个 fullPath 进行处理
        const finalRecords = [];
        for (const fullPath in recordMap) {
            const records = recordMap[fullPath];

            // 对每个字段分别处理
            const fields = ["routeTime"];
            const processedRecord = { fullPath, records: {} };

            // 处理数值字段
            fields.forEach(field => {
                // 提取每个记录的字段值
                const values = records.map(record => record[field]);

                // 剔除小于等于 0 的项
                const positiveValues = values.filter(val => val > 0);

                // 如果过滤后的数组长度为 0，设置结果为 0
                if (positiveValues.length === 0) {
                    processedRecord.records[field] = 0;
                } else if (positiveValues.length < 5) {
                    // 如果记录数量小于五个，直接取平均值并保留两位小数
                    processedRecord.records[field] = parseFloat((positiveValues.reduce((sum, val) => sum + val, 0) / positiveValues.length).toFixed(2));
                } else {
                    // 如果记录数量大于等于五个，去除一个最大值和一个最小值，取平均值并保留两位小数
                    let maxVal = Math.max(...positiveValues);
                    let minVal = Math.min(...positiveValues);

                    // 去掉一个最大值和一个最小值
                    const filteredValues = positiveValues.filter(val => {
                        if (val === maxVal) {
                            maxVal = null; // 确保只去掉一个最大值
                            return false;
                        }
                        if (val === minVal) {
                            minVal = null; // 确保只去掉一个最小值
                            return false;
                        }
                        return true;
                    });

                    // 计算平均值并保留两位小数
                    processedRecord.records[field] = parseFloat((filteredValues.reduce((sum, val) => sum + val, 0) / filteredValues.length).toFixed(2));
                }
            });

            // 处理 monsterNum 字段
            const allMonsters = records.flatMap(record => Object.keys(record.monsterNum));
            const uniqueMonsters = [...new Set(allMonsters)];
            processedRecord.records.monsterNum = {};

            uniqueMonsters.forEach(monster => {
                // 提取每个怪物的数量，并将缺失或小于 0 的值视为 0
                const counts = records.map(record => {
                    const count = record.monsterNum[monster];
                    return count > 0 ? count : 0; // 如果小于或等于 0，视为 0
                });

                // 如果所有记录中的数量都是 0，跳过该怪物
                if (counts.every(count => count === 0)) {
                    return;
                }

                // 如果记录总数大于等于 5，依次去除最大值和最小值，直到记录总数小于 5
                let removeMax = true; // 控制去除最大值或最小值
                while (counts.length >= 5) {
                    if (removeMax) {
                        // 去掉一个最大值
                        const maxCount = Math.max(...counts);
                        counts.splice(counts.indexOf(maxCount), 1);
                    } else {
                        // 去掉一个最小值
                        const minCount = Math.min(...counts);
                        counts.splice(counts.indexOf(minCount), 1);
                    }
                    // 切换去除最大值或最小值的标志
                    removeMax = !removeMax;
                }

                // 计算平均值并保留两位小数
                const average = parseFloat((counts.reduce((sum, val) => sum + val, 0) / counts.length).toFixed(2));

                // 如果平均值小于等于 0 或无意义，跳过该怪物
                if (average <= 0) {
                    return;
                }

                // 记录平均值
                processedRecord.records.monsterNum[monster] = average;
            });



            // 使用处理后的 monsterNum 数据计算其他相关数值字段
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

            // 将处理后的记录添加到最终结果中
            finalRecords.push(processedRecord);
        }

        // 初始化计数器
        let totalRoutes = routes.length;
        let matchedCount = 0;
        let unmatchedCount = 0;

        // 遍历 finalRecords，更新 description 字段
        for (const record of finalRecords) {
            const { fullPath, records } = record;

            // 检查 fullPath 是否在 routes 中
            const route = routes.find(route => route.fullPath === fullPath);

            if (!route) {
                log.warn(`文件 ${fullPath} 不在 routes 中，跳过处理`);
                unmatchedCount++;
                continue;
            }

            // 读取文件内容
            const fileContent = file.readTextSync(fullPath);
            const jsonData = JSON.parse(fileContent);

            // 构建新的 description 内容
            const {
                routeTime,
                expectMora,
                normalNum,
                eliteNum,
                monsterNum
            } = records;

            // 生成怪物描述
            let monsterDescription = Object.entries(monsterNum)
                .map(([monster, count]) => `${count}只${monster}`)
                .join('、');

            let newDescription;

            if (eliteNum === 0 && normalNum === 0) {
                // 如果精英和小怪数量都为 0
                newDescription = `  路线信息：该路线预计用时${routeTime}秒，该路线不含任何精英或小怪。`;
            } else {
                newDescription = `  路线信息：该路线预计用时${routeTime}秒，包含以下怪物：${monsterDescription}。`;
            }

            jsonData.info.description = `${newDescription}`;

            // 将更新后的内容写回文件
            // 替换第一个出现的 pathing 为 pathingOut
            const modifiedFullPath = fullPath.replace("pathing", "pathingOut");
            log.info(modifiedFullPath);
            // 写入文件
            await file.writeTextSync(modifiedFullPath, JSON.stringify(jsonData, null, 2));
            log.info(`文件 ${fullPath} 的 description 已更新`);

            matchedCount++;
        }

        // 输出最终统计信息
        log.info(`总路径文件数：${totalRoutes}`);
        log.info(`成功匹配并修改的文件数：${matchedCount}`);
        log.info(`未匹配的记录数：${unmatchedCount}`);
    }

    // 调用 fakeLog 函数，输出 JavaScript 开始的日志
    const duration4 = 0; // JS 开始时，耗时为 0
    await fakeLog(name1, true, true, duration4);
})();
