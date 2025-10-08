// 新增：独立的预加载函数，负责所有资源预处理
async function preloadImageResources(specificNames) {
    log.info("开始预加载所有图片资源");

    // 统一参数格式（与原逻辑一致）
    let preSpecificNames = specificNames;
    if (typeof specificNames === 'string') {
        preSpecificNames = [specificNames];
    }
    const isAll = !preSpecificNames || preSpecificNames.length === 0;
    if (isAll) {
        log.info("未指定具体弹窗名称，将执行所有弹窗目录处理");
    } else {
        log.info(`指定处理弹窗名称：${preSpecificNames.join(', ')}`);
    }

    // 定义根目录（与原代码一致）
    const rootDir = "assets/imageClick";

    // 获取所有子目录（与原代码一致）
    const subDirs = readAllFilePaths(rootDir, 0, 0, [], true);

    // 筛选目标目录（与原代码一致）
    const targetDirs = isAll
        ? subDirs
        : subDirs.filter(subDir => {
            const dirName = basename(subDir);
            return preSpecificNames.includes(dirName);
        });

    if (targetDirs.length === 0) {
        log.info(`未找到与指定名称匹配的目录，名称列表：${preSpecificNames?.join(', ') || '所有'}`);
        return [];
    }

    // 预加载所有目录的资源（原imageClick内的资源加载逻辑）
    const preloadedResources = [];
    for (const subDir of targetDirs) {
        const dirName = basename(subDir);
        // log.info(`开始预处理弹窗类型：${dirName}`);

        // 查找icon和Picture文件夹（与原代码一致）
        const entries = readAllFilePaths(subDir, 0, 1, [], true);
        const iconDir = entries.find(entry => entry.endsWith('\icon'));
        const pictureDir = entries.find(entry => entry.endsWith('\Picture'));

        if (!iconDir) {
            log.warn(`未找到 icon 文件夹，跳过分类文件夹：${subDir}`);
            continue;
        }
        if (!pictureDir) {
            log.warn(`未找到 Picture 文件夹，跳过分类文件夹：${subDir}`);
            continue;
        }

        // 读取图片文件（与原代码一致）
        const iconFilePaths = readAllFilePaths(iconDir, 0, 0, ['.png', '.jpg', '.jpeg']);
        const pictureFilePaths = readAllFilePaths(pictureDir, 0, 0, ['.png', '.jpg', '.jpeg']);

        // 预创建icon识别对象（与原代码一致）
        const iconRecognitionObjects = [];
        for (const filePath of iconFilePaths) {
            const mat = file.readImageMatSync(filePath);
            if (mat.empty()) {
                log.error(`加载图标失败：${filePath}`);
                continue;
            }
            const recognitionObject = RecognitionObject.TemplateMatch(mat, 0, 0, 1920, 1080);
            iconRecognitionObjects.push({ name: basename(filePath), ro: recognitionObject, iconDir });
        }

        // 预创建图库区域（与原代码一致）
        const pictureRegions = [];
        for (const filePath of pictureFilePaths) {
            const mat = file.readImageMatSync(filePath);
            if (mat.empty()) {
                log.error(`加载图库图片失败：${filePath}`);
                continue;
            }
            pictureRegions.push({ name: basename(filePath), region: new ImageRegion(mat, 0, 0) });
        }

        // 预计算匹配区域（与原代码一致）
        const foundRegions = [];
        for (const picture of pictureRegions) {
            for (const icon of iconRecognitionObjects) {
                const foundRegion = picture.region.find(icon.ro);
                if (foundRegion.isExist()) {
                    foundRegions.push({
                        pictureName: picture.name,
                        iconName: icon.name,
                        region: foundRegion,
                        iconDir: icon.iconDir
                    });
                }
            }
        }

        // 保存预处理结果
        preloadedResources.push({
            dirName,
            foundRegions
        });
    }

    log.info(`预加载完成，共处理 ${preloadedResources.length} 个目录`);
    return preloadedResources;
}

// 新增：imageClick后台任务函数
async function imageClickBackgroundTask() {
    log.info("imageClick后台任务已启动");
    const imageClickDelay = Math.min(99, Math.max(1, Math.floor(Number(settings.PopupClickDelay) || 5)))*1000;
    // 可以根据需要配置要处理的弹窗名称
    const specificNamesStr = settings.PopupNames || "";
    const specificNames = specificNamesStr
        .split(/[,，、 \s]+/)
        .map(name => name.trim())
        .filter(name => name !== "");

    // 调用独立预加载函数（循环前仅执行一次）
    const preloadedResources = await preloadImageResources(specificNames);
    if (preloadedResources.length === 0) {
        log.info("无可用预加载资源，任务结束");
        return { success: false };
    }

    // 循环执行，仅使用预加载资源
    while (!state.completed && !state.cancelRequested) {
        try {
            // 调用imageClick时传入预加载资源
            await imageClick(preloadedResources, null, specificNames, true);
        } catch (error) {
            log.info(`弹窗识别失败（继续重试）：${error.message}`);
        }
        // 短暂等待后再次执行
        await sleep(imageClickDelay);
    }
    
    log.info("imageClick后台任务已结束");
    return { success: true };
}

// 优化：使用预加载资源，保留所有原执行逻辑
async function imageClick(preloadedResources, ra = null, specificNames = null, useNewScreenshot = false) {
    // 保留原参数格式处理（兼容历史调用）
    if (typeof specificNames === 'string') {
        specificNames = [specificNames];
    }
    const isAll = !specificNames || specificNames.length === 0;

    // 遍历预处理好的资源（原targetDirs循环逻辑）
    for (const resource of preloadedResources) {
        const { dirName, foundRegions } = resource;
        for (const foundRegion of foundRegions) {
            // 保留原识别对象创建逻辑（使用预处理的路径）
            const tolerance = 1;
            const iconMat = file.readImageMatSync(`${foundRegion.iconDir}/${foundRegion.iconName}`);
            const recognitionObject = RecognitionObject.TemplateMatch(
                iconMat, 
                foundRegion.region.x - tolerance, 
                foundRegion.region.y - tolerance, 
                foundRegion.region.width + 2 * tolerance, 
                foundRegion.region.height + 2 * tolerance
            );
            recognitionObject.threshold = 0.85;

            // 保留原识别逻辑
            const result = await recognizeImage(
                recognitionObject,
                ra,
                1000,    // timeout
                500,     // interval
                useNewScreenshot,
                dirName  // iconType
            );
            
            // 保留原点击逻辑
            if (result.isDetected && result.x !== 0 && result.y !== 0) {
                const x = Math.round(result.x + result.width / 2);
                const y = Math.round(result.y + result.height / 2);
                log.info(`即将点击【${dirName}】类型下的图标：${foundRegion.iconName}，位置: (${x}, ${y})`);
                await click(x, y);
                log.info(`点击【${dirName}】类型下的${foundRegion.iconName}成功`);
                await sleep(10);
                return { success: true };
            } else {
                // log.info(`未发现弹窗【${dirName}】的图标：${foundRegion.iconName}`);
            }
        }
    }

    // 所有目标处理完毕仍未成功（保留原返回逻辑）
    return { success: false };
}
