// ======================== 1. 预加载函数（精简日志版）========================
async function preloadImageResources(specificNames) {
    // log.info("开始预加载所有图片资源");

    function hasIconFolder(dirPath) {
        try {
            const entries = readAllFilePaths(dirPath, 0, 0, [], true); 
            return entries.some(entry => normalizePath(entry).endsWith('/icon'));
        } catch (e) {
            log.error(`检查目录【${dirPath}】是否有icon文件夹失败：${e.message}`);
            return false;
        }
    }

    let preSpecificNames = specificNames;
    if (typeof specificNames === 'string') preSpecificNames = [specificNames];
    const isAll = !preSpecificNames || preSpecificNames.length === 0;
    // if (isAll) log.info("未指定具体弹窗名称，将执行所有含icon文件夹的弹窗目录处理");
    // else log.info(`指定处理弹窗名称：${preSpecificNames.join(', ')}（仅含icon文件夹的目录）`);

    const rootDir = "assets/imageClick";
    const rootDirNormalized = normalizePath(rootDir);
    const subDirs = readAllFilePaths(rootDir, 0, 2, [], true);

    const targetDirs = subDirs.filter(subDir => {
        const dirName = basename(subDir);
        const hasIcon = hasIconFolder(subDir); 
        const matchName = isAll ? true : preSpecificNames.includes(dirName);
        return hasIcon && matchName;
    });

    if (targetDirs.length === 0) {
        // log.info("未找到符合条件的弹窗目录");
        return [];
    }

    const preloadedResources = [];
    for (const subDir of targetDirs) {
        const dirName = basename(subDir);
        const fullPath = normalizePath(subDir);
        const pathSegments = fullPath.slice(rootDirNormalized.length + 1).split('/');
        const level = pathSegments.length;
        const isFirstLevel = level === 1;

        let popupConfig = {
            isSpecial: false,
            operationType: "click",
            ocrConfig: null,
            xOffset: 0,
            yOffset: 0,
            detectRegion: null,
            nextLevelOnSuccess: "",
            nextLevelOnFailure: "",
            loopCount: 1,
            loopDelay: 0
        };
        const configPath = normalizePath(`${subDir}/config.json`);
        let isSpecialModule = false;
        let specialDetectRegion = null;

        if (fileExists(configPath)) {
            try {
                const configContent = file.readTextSync(configPath);
                popupConfig = { ...popupConfig, ...JSON.parse(configContent) };
                isSpecialModule = popupConfig.isSpecial === true 
                    && typeof popupConfig.detectRegion === 'object' 
                    && popupConfig.detectRegion !== null 
                    && popupConfig.detectRegion.x != null 
                    && popupConfig.detectRegion.y != null 
                    && popupConfig.detectRegion.width != null 
                    && popupConfig.detectRegion.height != null 
                    && popupConfig.detectRegion.width > 0 
                    && popupConfig.detectRegion.height > 0;
                specialDetectRegion = isSpecialModule ? popupConfig.detectRegion : null;
                // log.info(`【${dirName}】加载配置成功：${isFirstLevel ? '第一级' : '第二级'} | 模块类型：${isSpecialModule ? '特殊模块' : '普通模块'}`);
            } catch (e) {
                log.error(`【${dirName}】解析配置失败，使用默认配置：${e.message}`);
                isSpecialModule = false;
            }
        }

        if (isSpecialModule) {
            const entries = readAllFilePaths(subDir, 0, 1, [], true);
            const iconDir = entries.find(entry => normalizePath(entry).endsWith('/icon'));
            const iconFilePaths = readAllFilePaths(iconDir, 0, 0, ['.png', '.jpg', '.jpeg']);
            
            if (iconFilePaths.length === 0) {
                log.warn(`【${dirName}】特殊模块无有效icon文件，跳过`);
                continue;
            }

            const iconRecognitionObjects = [];
            for (const filePath of iconFilePaths) {
                const mat = file.readImageMatSync(filePath);
                if (mat.empty()) {
                    log.error(`【${dirName}】特殊模块加载图标失败：${filePath}`);
                    continue;
                }
                iconRecognitionObjects.push({ 
                    name: basename(filePath),
                    ro: RecognitionObject.TemplateMatch(mat, 0, 0, 1920, 1080),
                    iconDir,
                    mat: mat
                });
            }

            // 关键修改：遍历所有图标，为每个图标生成识别信息
            const foundRegions = []; // 存储所有图标的识别配置
            for (const targetIcon of iconRecognitionObjects) { // 遍历每个图标
                const manualRegion = new ImageRegion(targetIcon.mat, specialDetectRegion.x, specialDetectRegion.y);
                manualRegion.width = specialDetectRegion.width;
                manualRegion.height = specialDetectRegion.height;
                foundRegions.push({
                    pictureName: "特殊模块",
                    iconName: targetIcon.name, // 当前图标的名称
                    region: manualRegion, // 复用同一个detectRegion区域
                    iconDir: iconDir
                });
            }
            // log.info(`【${dirName}】特殊模块生成识别区域：x=${manualRegion.x}, y=${manualRegion.y}, 宽=${manualRegion.width}, 高=${manualRegion.height}`);

            preloadedResources.push({
                dirName,
                fullPath,
                foundRegions,
                popupConfig,
                isFirstLevel: isFirstLevel,
                level: level
            });

        } else {
            const entries = readAllFilePaths(subDir, 0, 1, [], true);
            const iconDir = entries.find(entry => normalizePath(entry).endsWith('/icon'));
            const pictureDir = entries.find(entry => normalizePath(entry).endsWith('/Picture'));
            
            if (!pictureDir) {
                log.warn(`【${dirName}】普通模块无Picture文件夹，跳过`);
                continue;
            }

            const iconFilePaths = readAllFilePaths(iconDir, 0, 0, ['.png', '.jpg', '.jpeg']);
            const pictureFilePaths = readAllFilePaths(pictureDir, 0, 0, ['.png', '.jpg', '.jpeg']);
            
            // 仅在资源为空时警告
            if (iconFilePaths.length === 0) {
                log.warn(`【${dirName}】普通模块无有效icon文件，跳过`);
                continue;
            }
            if (pictureFilePaths.length === 0) {
                log.warn(`【${dirName}】普通模块无有效Picture文件，跳过`);
                continue;
            }

            const iconRecognitionObjects = [];
            for (const filePath of iconFilePaths) {
                const mat = file.readImageMatSync(filePath);
                if (mat.empty()) {
                    log.error(`【${dirName}】加载图标失败：${filePath}`);
                    continue;
                }
                iconRecognitionObjects.push({ 
                    name: basename(filePath),
                    ro: RecognitionObject.TemplateMatch(mat, 0, 0, 1920, 1080),
                    iconDir 
                });
            }

            const pictureRegions = [];
            for (const filePath of pictureFilePaths) {
                const mat = file.readImageMatSync(filePath);
                if (mat.empty()) {
                    log.error(`【${dirName}】加载图库图片失败：${filePath}`);
                    continue;
                }
                pictureRegions.push({ 
                    name: basename(filePath),
                    region: new ImageRegion(mat, 0, 0) 
                });
            }

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
            if (foundRegions.length === 0) {
                log.warn(`【${dirName}】普通模块无匹配图标，跳过`);
                continue;
            }

            preloadedResources.push({
                dirName,
                fullPath,
                foundRegions,
                popupConfig,
                isFirstLevel: isFirstLevel,
                level: level
            });
        }
    }

    // log.info(`预加载完成，共${preloadedResources.length}个有效弹窗目录（第一级：${preloadedResources.filter(r => r.isFirstLevel).length}个，第二级：${preloadedResources.filter(r => !r.isFirstLevel).length}个）`);
    return preloadedResources;
}

// ======================== 2. 后台任务函数（精简日志版）========================
async function imageClickBackgroundTask() {
    log.info("imageClick后台任务已启动");

    // 配置参数
    const taskDelay = Math.min(999, Math.max(1, Math.floor(Number(settings.PopupClickDelay) || 15)))*1000;
    const specificNamesStr = settings.PopupNames || "";
    const specificNames = specificNamesStr
        .split(/[,，、 \s]+/)
        .map(name => name.trim())
        .filter(name => name !== "");

    // 预加载资源
    const preloadedResources = await preloadImageResources(specificNames);
    if (preloadedResources.length === 0) {
        log.info("无可用弹窗资源，任务结束");
        return { success: false };
    }

    // 筛选一级弹窗
    const firstLevelDirs = preloadedResources.filter(res => res.isFirstLevel);
    if (firstLevelDirs.length === 0) {
        log.warn("无第一级弹窗目录，任务终止");
        return { success: false };
    }

    // 打印资源检测结果
    log.info("\n==================== 现有弹窗加载结果 ====================");
    log.info("1. 一级弹窗（共" + firstLevelDirs.length + "个）：");
    firstLevelDirs.forEach((res, idx) => log.info(`   ${idx+1}. 【${res.dirName}】`));
    const secondLevelResources = preloadedResources.filter(res => !res.isFirstLevel);
    log.info("\n2. 二级弹窗（共" + secondLevelResources.length + "个）：");
    secondLevelResources.forEach((res, idx) => log.info(`   ${idx+1}. 【${res.dirName}】`));
    log.info("=============================================================\n");

    // 核心逻辑：外循环遍历所有一级弹窗
    while (!state.completed && !state.cancelRequested) {
        // log.info(`\n===== 外循环开始：遍历所有一级弹窗（共${firstLevelDirs.length}个） =====`);

        // 遍历所有一级弹窗
        for (const currentFirstLevel of firstLevelDirs) {
            log.info(`【${currentFirstLevel.dirName}】准备识别...`);
            // 检查当前一级弹窗是否被触发
            const levelResult = await imageClick([currentFirstLevel], null, [currentFirstLevel.dirName], true);

            if (levelResult.success) {
                // log.info(`【${currentFirstLevel.dirName}】触发成功，进入内部流程...`);
                const levelStack = [currentFirstLevel];

                // 内循环处理内部流程
                while (levelStack.length > 0 && !state.completed && !state.cancelRequested) {
                    const currentResource = levelStack[levelStack.length - 1];
                    const innerResult = await imageClick([currentResource], null, [currentResource.dirName], true);

                    if (innerResult.success) {
                        const nextPath = normalizePath(currentResource.popupConfig.nextLevelOnSuccess);
                        if (nextPath && nextPath.trim()) {
                            const nextResource = preloadedResources.find(res => res.fullPath === nextPath);
                            if (nextResource) {
                                levelStack.push(nextResource);
                            } else {
                                // log.warn(`内循环：下一级(${nextPath})不存在，回退`);
                                levelStack.pop();
                            }
                        } else {
                            levelStack.pop();
                        }
                    } else {
                        const nextPath = normalizePath(currentResource.popupConfig.nextLevelOnFailure);
                        if (nextPath && nextPath.trim()) {
                            const nextResource = preloadedResources.find(res => res.fullPath === nextPath);
                            if (nextResource) {
                                levelStack.push(nextResource);
                            } else {
                                // log.warn(`内循环：下一级(${nextPath})不存在，回退`);
                                levelStack.pop();
                            }
                        } else {
                            levelStack.pop();
                        }
                    }

                    await sleep(100);
                }

                log.info(`【${currentFirstLevel.dirName}】内部流程处理完毕`);
            }
        }

        // log.info(`===== 外循环结束：等待${taskDelay/1000}秒后开始下一次循环 =====`);
        await sleep(taskDelay);
    }
    
    log.info("imageClick后台任务结束");
    return { success: true };
}

// ======================== 3. 识别与操作函数（精简日志版）========================
async function imageClick(preloadedResources, ra = null, specificNames = null, useNewScreenshot = false) {
    if (typeof specificNames === 'string') {
        specificNames = [specificNames];
    }
    const isAll = !specificNames || specificNames.length === 0;
    let isAnySuccess = false;

    for (const resource of preloadedResources) {
        const { dirName, foundRegions, popupConfig } = resource;
        const { xOffset, yOffset } = popupConfig;
        let hasAnyIconDetected = false; // 标记是否有图标被识别

        for (const foundRegion of foundRegions) {
            const tolerance = 1;
            const iconMat = file.readImageMatSync(`${normalizePath(foundRegion.iconDir)}/${foundRegion.iconName}`);
            
            const { detectRegion } = popupConfig;
            const defaultX = foundRegion.region.x - tolerance;
            const defaultY = foundRegion.region.y - tolerance;
            const defaultWidth = foundRegion.region.width + 2 * tolerance;
            const defaultHeight = foundRegion.region.height + 2 * tolerance;
            const recognitionObject = RecognitionObject.TemplateMatch(
                iconMat, 
                detectRegion?.x ?? defaultX,
                detectRegion?.y ?? defaultY,
                detectRegion?.width ?? defaultWidth,
                detectRegion?.height ?? defaultHeight
            );
            // log.info(JSON.stringify(detectRegion, null, 2));
            recognitionObject.threshold = 0.85;

            const result = await recognizeImage(
                recognitionObject,
                ra,
                1000,
                500,
                useNewScreenshot,
                dirName
            );
            
            if (result.isDetected && result.x !== 0 && result.y !== 0) {
                hasAnyIconDetected = true;
                isAnySuccess = true;
                const centerX = Math.round(result.x + result.width / 2);
                const centerY = Math.round(result.y + result.height / 2);
                const actualX = centerX + xOffset;
                const actualY = centerY + yOffset;
                log.info(`识别到【${dirName}】弹窗，偏移后位置(${actualX}, ${actualY})`);

                if (!popupConfig.isSpecial) {
                    // 新增：普通点击加循环（默认1次，0间隔，与原逻辑一致）
                    const clickCount = popupConfig.loopCount;
                    const clickDelay = popupConfig.loopDelay;
                    for (let i = 0; i < clickCount; i++) {
                        await click(actualX, actualY); // 保留原始点击逻辑
                        // log.info(`点击【${dirName}】弹窗：(${actualX}, ${actualY})${i+1}次`);
                        if (i < clickCount - 1) await sleep(clickDelay); // 非最后一次加间隔
                    }
                } else {
                    switch (popupConfig.operationType) {
                        case "key_press": {
                            const targetKey = popupConfig.keyCode || "VK_SPACE";
                            // 新增：key_press用循环（默认3次，1000ms间隔，与原硬编码逻辑一致）
                            const pressCount = popupConfig.loopCount || 3;
                            const pressDelay = popupConfig.loopDelay || 500;
                            for (let i = 0; i < pressCount; i++) {
                                keyPress(targetKey); // 保留原始按键逻辑
                                log.info(`【${dirName}】弹窗触发按键【${targetKey}】${i+1}次`);
                                if (i < pressCount - 1) await sleep(pressDelay); // 非最后一次加间隔
                            }
                            log.info(`【${dirName}】弹窗触发按键【${targetKey}】，共${pressCount}次，间隔${pressDelay}ms`);
                            break;
                        }
                        case "ocr_click": {
                            isAnySuccess = false;
                            const { targetTexts, xRange, yRange, timeout = 2000 } = popupConfig.ocrConfig || {};
                            if (!targetTexts || !xRange || !yRange) {
                                log.error(`【${dirName}】弹窗OCR配置不全，跳过`);
                                break;
                            }
                            const ocrResults = await performOcr(targetTexts, xRange, yRange, timeout, ra);
                            if (ocrResults.length > 0) {
                                const ocrActualX = Math.round(ocrResults[0].x + ocrResults[0].width/2) + xOffset;
                                const ocrActualY = Math.round(ocrResults[0].y + ocrResults[0].height/2) + yOffset;
                                // 新增：OCR点击加循环（默认1次，0间隔，与原逻辑一致）
                                const ocrCount = popupConfig.loopCount;
                                const ocrDelay = popupConfig.loopDelay;
                                for (let i = 0; i < ocrCount; i++) {
                                    await click(ocrActualX, ocrActualY); // 保留原始OCR点击逻辑
                                    if (i < ocrCount - 1) await sleep(ocrDelay); // 非最后一次加间隔
                                }
                                log.info(`【${dirName}】弹窗OCR点击“${ocrResults[0].text}”：(${ocrActualX}, ${ocrActualY})，共${ocrCount}次，间隔${ocrDelay}ms`);
                                isAnySuccess = true;
                            } else {
                                log.warn(`【${dirName}】弹窗OCR未识别到文本`);
                            }
                            break;
                        }
                        case "key_mouse_script": {
                            try {
                                const scriptPath = normalizePath(popupConfig.scriptPath || "");
                                if (!scriptPath) {
                                    log.error(`【${dirName}】弹窗未配置键鼠脚本路径，跳过执行`);
                                    isAnySuccess = false;
                                    break;
                                }
                                if (!fileExists(scriptPath)) {
                                    log.error(`【${dirName}】弹窗键鼠脚本不存在：${scriptPath}`);
                                    isAnySuccess = false;
                                    break;
                                }
                                // 新增：键鼠脚本加循环（默认1次，0间隔，与原逻辑一致）
                                const scriptCount = popupConfig.loopCount;
                                const scriptDelay = popupConfig.loopDelay;
                                for (let i = 0; i < scriptCount; i++) {
                                    await keyMouseScript.runFile(scriptPath); // 保留原始脚本执行逻辑
                                    if (i < scriptCount - 1) await sleep(scriptDelay); // 非最后一次加间隔
                                }
                                log.info(`【${dirName}】弹窗键鼠脚本执行完成，共${scriptCount}次，间隔${scriptDelay}ms`);
                                isAnySuccess = true;
                            } catch (error) {
                                log.error(`【${dirName}】弹窗键鼠脚本执行失败：${error.message}`);
                                isAnySuccess = false;
                            }
                            break;
                        }
                        default:
                            log.error(`【${dirName}】弹窗未知操作类型：${popupConfig.operationType}，默认执行点击`);
                            // 新增：默认操作加循环（默认1次，0间隔，与原逻辑一致）
                            const defaultCount = popupConfig.loopCount;
                            const defaultDelay = popupConfig.loopDelay;
                            for (let i = 0; i < defaultCount; i++) {
                                await click(actualX, actualY); // 保留原始默认点击逻辑
                                log.info(`点击【${dirName}】弹窗：(${actualX}, ${actualY})${i+1}次`);
                                if (i < defaultCount - 1) await sleep(defaultDelay); // 非最后一次加间隔
                            }
                            isAnySuccess = true;
                    }
                }
            }
        }

        // 仅在该弹窗无任何图标识别时输出警告
        if (!hasAnyIconDetected && !isAnySuccess) {
            // log.warn(`【${dirName}】弹窗未发现任何有效图标`);
        }
        await sleep(10);
    }

    return { success: isAnySuccess, message: isAnySuccess ? "弹窗识别操作成功" : "未识别到弹窗" };
}
