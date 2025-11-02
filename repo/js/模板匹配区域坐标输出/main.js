
// 自定义 basename 函数
function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
    return filePath.substring(lastSlashIndex + 1);
}

// 检查路径是否存在
function pathExists(path) {
    try {
        const entries = file.readPathSync(path); // 尝试读取路径内容
        return entries !== undefined && entries.length >= 0;
    } catch (error) {
        return false; // 如果读取失败，返回 false
    }
}

// 自定义 readAllFilePaths 函数
function readAllFilePaths(dirPath, currentDepth = 0, maxDepth = 3, includeExtensions = ['.png', '.jpg', '.jpeg', '.bmp']) {
    if (!pathExists(dirPath)) {
        log.error(`目录 ${dirPath} 不存在`);
        return [];
    }

    try {
        const entries = file.readPathSync(dirPath); // 读取目录内容，返回的是完整路径
        const filePaths = [];

        for (const entry of entries) {
            const isDirectory = pathExists(entry); // 如果路径存在且返回的是数组，则认为是目录
            if (isDirectory && currentDepth < maxDepth) {
                filePaths.push(...readAllFilePaths(entry, currentDepth + 1, maxDepth, includeExtensions)); // 递归读取子目录
            } else if (!isDirectory) {
                const fileExtension = entry.substring(entry.lastIndexOf('.'));
                if (includeExtensions.includes(fileExtension.toLowerCase())) {
                    filePaths.push(entry); // 添加文件路径
                }
            }
        }

        return filePaths;
    } catch (error) {
        log.error(`读取目录 ${dirPath} 时发生错误: ${error}`);
        return [];
    }
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
                await drawAndClearRedBox(imageResult, 500);// 调用异步函数绘制红框并延时清除
                log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}, width=${imageResult.width}, height=${imageResult.height}`);
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

// 定义一个异步函数来绘制红框并延时清除
async function drawAndClearRedBox(result, delay) {
    // 绘制红框
    const ro1 = captureGameRegion();
    let drawRegion = ro1.DeriveCrop(result.x, result.y, result.width, result.height).DrawSelf("icon");
    ro1.dispose();

    // 延时
    await sleep(delay);

    // 清除红框
    if (drawRegion) {
        const ro2 = captureGameRegion();
        let drawRegion2 = ro2.DeriveCrop(0, 0, 0, 0);
        drawRegion2.DrawSelf("icon");
        ro2.dispose();
        drawRegion2.dispose(); // 释放对象
    }
    drawRegion.dispose();
}
// 主函数
(async function () {
    setGameMetrics(1920, 1080, 1);

    // 读取 assets 文件夹下的所有图标路径
    const assetsDir = "assets";
    const imagePaths = readAllFilePaths(assetsDir, 0, 1);

    // 遍历每个图标
    for (const imagePath of imagePaths) {
        const fileName = basename(imagePath); // 获取文件名
        // log.info(`正在处理图标: ${fileName}`);

        // 创建识别对象
        let recognitionObject = RecognitionObject.TemplateMatch(file.ReadImageMatSync(imagePath));

        // 识别图标
        let result = await recognizeImage(recognitionObject, 50);
        if (result.success) {
            // 输出坐标和识图范围推荐
            log.info(`图标 ${fileName} 的坐标: x=${result.x}, y=${result.y}, width=${result.width}, height=${result.height}，识图范围推荐: ${result.x-1}, ${result.y-1}, ${result.width+2}, ${result.height+2}`);
        } else {
            // log.warn(`未能识别到图标 ${fileName}`);
        }

        await sleep(50); // 确保识别之间有足够的时间间隔
    }
})();
