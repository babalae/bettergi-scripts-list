// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};

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
                    let centerX = Math.round(res.x + res.width / 2);
                    let centerY = Math.round(res.y + res.height / 2);
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

// 主逻辑
(async function () {
    // 启用自动拾取的实时任务
    log.info("启用自动拾取的实时任务");
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    // 从自定义配置中获取 startRouteNumber，默认值为 1
    const startRouteNumber = settings.startRouteNumber || 1;

    // 定义 pathing 文件夹路径
    const pathingFolderPath = "pathing";

    // 定义 result 文件夹路径
    const resultFolderPath = "result";

    // 在 for 循环之前获取一次时间
    const startTime = new Date();
    const formattedStartTime = startTime.toISOString().replace(/[:\-\.]/g, '');
    const recordFileName = `route_info_${formattedStartTime}.txt`;
    const recordFilePath = resultFolderPath + '/' + recordFileName; // 使用字符串拼接

    // 读取 pathing 文件夹中的所有文件路径
    const filePaths = file.ReadPathSync(pathingFolderPath);
    log.info(`读取到的文件路径: ${filePaths}`);

    // 定义一个数组用于存储处理后的文件名
    let jsonFileNames = [];

    // 遍历文件路径数组并提取文件名
    for (const filePath of filePaths) {
        const fileName = basename(filePath); // 提取文件名
        if (fileName.endsWith('.json')) { // 检查文件名是否以 .json 结尾
            jsonFileNames.push(fileName); // 存储文件名
        }
    }

    // 定义一个数组用于存储每次任务的信息
    let routeInfo = [];

    // 后续逻辑：调用 mora 函数获取摩拉数值并记录到文件中
    for (let i = startRouteNumber - 1; i < jsonFileNames.length; i++) {
        // 获取当前文件名
        const entryName = jsonFileNames[i];
        const pathingFilePath = pathingFolderPath + '/' + entryName; // 使用字符串拼接

        // 获取任务开始前的摩拉数值
        let startMora = await mora();
        let startMoraText = startMora ? startMora : 'N/A';

        // 获取开始时间
        const taskStartTime = new Date();
        log.info(`开始执行任务: ${entryName}，时间: ${taskStartTime.toISOString()}`);

        // 执行路径文件
        await pathingScript.runFile(pathingFilePath);

        // 获取结束时间
        const taskEndTime = new Date();
        log.info(`完成任务: ${entryName}，时间: ${taskEndTime.toISOString()}，耗时: ${taskEndTime - taskStartTime}ms`);

        // 获取任务结束后的摩拉数值
        let endMora = await mora();
        let endMoraText = endMora ? endMora : 'N/A';
        let moraChange = endMora && startMora ? (endMora - startMora) : 'N/A';

        // 记录任务信息
        const taskInfo = {
            route: entryName,
            moraChange: moraChange,
            duration: taskEndTime - taskStartTime
        };
        routeInfo.push(taskInfo); // 将任务信息添加到 routeInfo 数组中

        // 将所有任务信息写入文件
        let allTaskInfo = 'Route\tMora Change\tDuration (ms)\n'; // 使用制表符作为分隔符
        for (const info of routeInfo) {
            allTaskInfo += `${info.route}\t${info.moraChange}\t${info.duration}\n`;
        }

        try {
            file.writeTextSync(recordFilePath, allTaskInfo, false); // 覆盖模式
        } catch (error) {
            log.error(`写入文件失败，错误信息: ${error.message}`);
        }

        await sleep(1000); // 在每次尝试之间等待 1 秒
    }

    // 输出任务信息记录
    log.info(`任务信息记录已写入文件: ${recordFilePath}`);
})();
