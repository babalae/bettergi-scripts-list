// ======================== imageClick 弹窗识别与操作 ========================
// config.json 中文结构说明：
// {
//   "弹窗名称": "任意名称",
//   "识别": {
//     "方式": "固定区域" | "大小图标定",
//     "图标文件夹": "icon",                 // 可省略，默认 icon
//     "标定大图文件夹": "Picture",           // 仅"大小图标定"需要，可省略默认 Picture
//     "区域": { "x":0,"y":0,"宽":0,"高":0 }, // 仅"固定区域"需要
//     "阈值": 0.85,                          // 可省略，默认 0.85
//     "已标定区域": []                       // 大小图标定首次运行后自动回写，无需手填
//   },
//   "识别成功后": [                          // 严格按数组顺序执行
//     { "动作":"点击",     "次数":1, "间隔毫秒":0, "x偏移":0, "y偏移":0 },
//     { "动作":"按键",     "按键":"VK_J", "次数":1, "间隔毫秒":0 },
//     { "动作":"OCR点击",  "目标文本":["文字"], "区域":{"x":0,"y":0,"宽":0,"高":0}, "超时毫秒":2000, "次数":1, "间隔毫秒":0, "x偏移":0, "y偏移":0 },
//     { "动作":"执行键鼠脚本", "脚本路径":"assets/xxx.json", "次数":1, "间隔毫秒":0 },
//     { "动作":"等待",     "毫秒":1000 },
//     { "动作":"调用子弹窗", "弹窗":"assets/imageClick/其他/F", "重试次数":3, "重试间隔毫秒":500,
//       "循环":true, "循环间隔毫秒":300, "最大循环次数":20,
//       "直到识别到":"assets/imageClick/其他/F" }  // 可省略；填写后每轮先检测该弹窗，出现即提前结束循环
//   ],
//   "识别失败时": { "重试次数":3, "重试间隔毫秒":500 },
//   "循环间隔秒": 15                        // 可省略，省略时用设置里的默认间隔
// }
// 流程：先截图识别 → 识别成功后按"识别成功后"顺序执行步骤 → 全部失败才判定失败。
//
// ======================== imageClick 专用执行逻辑 ========================
// 【目录约定】
//   assets/imageClick/<弹窗名>/icon/    ：必需，存放识别模板图标（png）
//   assets/imageClick/<弹窗名>/Picture/ ：仅"大小图标定"需要，存放含图标的整页截图（标定用）
//   assets/imageClick/<弹窗名>/config.json：弹窗配置；没有 config 时按"大小图标定 + 识别后点击1次"处理
//   一级弹窗 = imageClick 下的直接子目录；二级弹窗 = 再深一层（如 其他/F），只供"调用子弹窗"触发，不参与外循环
//
// 【外循环（一级弹窗，慢节奏，省资源）】
//   1. 依次对每个一级弹窗执行 runPopup：截图识别 → 识别成功才执行步骤，识别不到什么都不做
//   2. 每个一级弹窗处理完，按它自己的"循环间隔秒"等待；未配置则用设置 PopupClickDelay（默认15秒）
//   3. 二级弹窗不参与外循环，不会被定时扫描
//
// 【单次弹窗流程 runPopup】
//   识别（detectWithRetry，按"识别失败时"重试）→ 识别成功 → 严格按"识别成功后"数组顺序执行步骤 → 结束
//   注意：识别与操作分离，识别函数只返回坐标，不会点击；一次触发只执行一次，不会重复操作
//
// 【两种识别方式】
//   固定区域 ：直接在 config 的"区域"内对实时画面做模板匹配，坐标写死，绑定1920x1080
//   大小图标定：首次用 Picture 大图反查 icon 得到坐标，自动回写 config 的"已标定区域"（含标定分辨率）；
//              以后直接读缓存坐标，不再加载 Picture。运行分辨率与标定分辨率不符时缓存作废、重新标定；
//              标定失败不覆盖旧缓存。标定坐标只用于缩小实时识别区域，运行时仍做一次实时模板匹配
//
// 【步骤动作】（"识别成功后"数组的每一项）
//   点击        ：点击识别到的图标中心 + x偏移/y偏移
//   按键        ：按"按键"（VK_xxx）；次数默认1
//   OCR点击     ：在"区域"内 OCR 找"目标文本"，点击识别到的文字位置（可加偏移）
//   执行键鼠脚本：运行"脚本路径"指向的 BetterGI 键鼠脚本
//   等待        ：sleep "毫秒"
//   调用子弹窗  ：运行"弹窗"路径对应的二级弹窗，默认只调一次
//
// 【调用子弹窗的快速循环】（一级弹窗触发后的快节奏，只在本次触发内有效）
//   配置 "循环":true 后，反复执行子弹窗的"识别→操作"：
//     - 每轮先检测"直到识别到"弹窗（若配置）：出现则提前结束循环
//     - 执行子弹窗；子弹窗识别不到 → 立即结束循环（失败即停，不无限重试）
//     - 一轮完成后等待"循环间隔毫秒"，再开始下一轮
//     - 总轮数不超过"最大循环次数"（防死循环）
//   循环结束后继续执行后续步骤；全部步骤走完才回到一级弹窗的慢循环
//
// 【对话链条示例】
//   对话页识别到 → 循环按空格（每轮先看F，没F才按空格）→ 看到F结束空格循环
//                → 滚轮快速循环（滚轮脚本→F→滚轮→F…，滚轮识别不到即停）→ 回到慢循环

// ======================== 1. 配置读取与规范化 ========================
function normalizeRegion(r) {
    if (!r || r.x == null || r.y == null || r.宽 == null || r.高 == null) return null;
    return { x: r.x, y: r.y, width: r.宽, height: r.高 };
}

function loadPopupConfig(subDir) {
    const rawConfig = {};
    const configPath = normalizePath(`${subDir}/config.json`);
    if (fileExists(configPath)) {
        try {
            Object.assign(rawConfig, JSON.parse(safeReadTextSync(configPath)));
        } catch (e) {
            log.error(`【${basename(subDir)}】解析config失败，使用默认配置：${e.message}`);
        }
    }

    const detect = rawConfig.识别 || {};
    const failCfg = rawConfig.识别失败时 || {};
    const mode = detect.方式 === "固定区域" ? "固定区域" : "大小图标定";

    return {
        configPath,
        rawConfig,
        cfg: {
            弹窗名称: rawConfig.弹窗名称 || basename(subDir),
            mode,
            iconDirName: detect.图标文件夹 || "icon",
            pictureDirName: detect.标定大图文件夹 || "Picture",
            threshold: typeof detect.阈值 === "number" ? detect.阈值 : 0.85,
            fixedRegion: mode === "固定区域" ? normalizeRegion(detect.区域) : null,
            cached: Array.isArray(detect.已标定区域) ? detect.已标定区域.map(c => ({
                picture: c.大图, icon: c.图标,
                x: c.x, y: c.y, width: c.宽, height: c.高,
                calibWidth: c.标定宽, calibHeight: c.标定高
            })) : [],
            steps: Array.isArray(rawConfig.识别成功后) ? rawConfig.识别成功后 : [{ 动作: "点击", 次数: 1, 间隔毫秒: 0 }],
            retryCount: failCfg.重试次数 != null ? failCfg.重试次数 : 3,
            retryDelay: failCfg.重试间隔毫秒 != null ? failCfg.重试间隔毫秒 : 500,
            loopDelaySec: rawConfig.循环间隔秒 != null ? Number(rawConfig.循环间隔秒) : null
        }
    };
}

// 将标定结果回写到 config.json（读-合并-写，保留其他字段）
function saveCalibration(configPath, rawConfig, cachedEntries) {
    try {
        rawConfig.识别 = rawConfig.识别 || {};
        rawConfig.识别.方式 = rawConfig.识别.方式 || "大小图标定";
        rawConfig.识别.已标定区域 = cachedEntries.map(c => ({
            "大图": c.picture,
            "图标": c.icon,
            "x": c.x, "y": c.y, "宽": c.width, "高": c.height,
            "标定宽": c.calibWidth, "标定高": c.calibHeight
        }));
        writeFile(configPath, JSON.stringify(rawConfig, null, 2), false);
        log.info(`标定结果已写入config：${configPath}（共${cachedEntries.length}组）`);
    } catch (e) {
        log.error(`回写标定config失败：${configPath}：${e.message}`);
    }
}

// ======================== 2. 预加载（含一次性大小图标定）========================
async function preloadImageResources(specificNames, runtimeSize) {
    let preSpecificNames = specificNames;
    if (typeof preSpecificNames === 'string') preSpecificNames = [preSpecificNames];
    const isAll = !preSpecificNames || preSpecificNames.length === 0;

    const rootDir = "assets/imageClick";
    const rootDirNormalized = normalizePath(rootDir);
    const subDirs = readAllFilePaths(rootDir, 0, 2, [], true);

    const targetDirs = subDirs.filter(subDir => {
        const dirName = basename(subDir);
        let hasIcon = false;
        try {
            const entries = readAllFilePaths(subDir, 0, 1, [], true);
            hasIcon = entries.some(entry => normalizePath(entry).endsWith('/icon'));
        } catch (e) {
            log.error(`检查目录【${subDir}】icon文件夹失败：${e.message}`);
        }
        const matchName = isAll ? true : preSpecificNames.includes(dirName);
        return hasIcon && matchName;
    });

    const preloadedResources = [];

    for (const subDir of targetDirs) {
        const dirName = basename(subDir);
        const fullPath = normalizePath(subDir);
        const level = fullPath.slice(rootDirNormalized.length + 1).split('/').length;
        const isFirstLevel = level === 1;

        const { configPath, rawConfig, cfg } = loadPopupConfig(subDir);

        const entries = readAllFilePaths(subDir, 0, 1, [], true);
        const iconDir = entries.find(entry => normalizePath(entry).endsWith(`/${cfg.iconDirName}`));
        if (!iconDir) {
            log.warn(`【${dirName}】无${cfg.iconDirName}文件夹，跳过`);
            continue;
        }
        const iconFilePaths = readAllFilePaths(iconDir, 0, 0, ['.png', '.jpg', '.jpeg']);
        if (iconFilePaths.length === 0) {
            log.warn(`【${dirName}】无有效图标文件，跳过`);
            continue;
        }

        // 加载图标模板
        const iconObjects = [];
        for (const filePath of iconFilePaths) {
            const mat = file.readImageMatSync(filePath);
            if (mat.empty()) {
                log.error(`【${dirName}】加载图标失败：${filePath}`);
                continue;
            }
            iconObjects.push({ name: basename(filePath), mat });
        }
        if (iconObjects.length === 0) continue;

        let foundRegions = [];

        if (cfg.mode === "固定区域") {
            if (!cfg.fixedRegion) {
                log.warn(`【${dirName}】固定区域模式缺少"区域"配置，跳过`);
                continue;
            }
            for (const icon of iconObjects) {
                foundRegions.push({
                    iconName: icon.name, iconDir: normalizePath(iconDir),
                    x: cfg.fixedRegion.x, y: cfg.fixedRegion.y,
                    width: cfg.fixedRegion.width, height: cfg.fixedRegion.height
                });
            }
        } else {
            // 大小图标定：缓存有效（非空且分辨率一致）时直接使用，不再读 Picture
            const cacheValid = cfg.cached.length > 0 && cfg.cached.every(c =>
                runtimeSize && c.calibWidth === runtimeSize.width && c.calibHeight === runtimeSize.height);

            if (cacheValid) {
                foundRegions = cfg.cached.map(c => ({
                    iconName: c.icon, iconDir: normalizePath(iconDir),
                    x: c.x, y: c.y, width: c.width, height: c.height
                }));
            } else {
                const pictureDir = entries.find(entry => normalizePath(entry).endsWith(`/${cfg.pictureDirName}`));
                if (!pictureDir) {
                    log.warn(`【${dirName}】大小图标定模式无${cfg.pictureDirName}文件夹，跳过`);
                    continue;
                }
                const pictureFilePaths = readAllFilePaths(pictureDir, 0, 0, ['.png', '.jpg', '.jpeg']);
                if (pictureFilePaths.length === 0) {
                    log.warn(`【${dirName}】无有效标定大图，跳过`);
                    continue;
                }

                const newCached = [];
                for (const picturePath of pictureFilePaths) {
                    const pictureMat = file.readImageMatSync(picturePath);
                    if (pictureMat.empty()) {
                        log.error(`【${dirName}】加载标定大图失败：${picturePath}`);
                        continue;
                    }
                    const pictureRegion = new ImageRegion(pictureMat, 0, 0);
                    for (const icon of iconObjects) {
                        const ro = RecognitionObject.TemplateMatch(icon.mat, 0, 0, pictureMat.cols, pictureMat.rows);
                        ro.threshold = cfg.threshold;
                        const found = pictureRegion.find(ro);
                        if (found.isExist()) {
                            const entry = {
                                picture: basename(picturePath), icon: icon.name,
                                x: found.x, y: found.y, width: found.width, height: found.height,
                                calibWidth: pictureMat.cols, calibHeight: pictureMat.rows
                            };
                            newCached.push(entry);
                            foundRegions.push({
                                iconName: icon.name, iconDir: normalizePath(iconDir),
                                x: found.x, y: found.y, width: found.width, height: found.height
                            });
                        }
                    }
                }

                if (foundRegions.length === 0) {
                    log.warn(`【${dirName}】大小图标定未匹配到任何图标，跳过（不覆盖旧缓存）`);
                    continue;
                }
                // 首次标定完成，回写 config，下次直接读坐标
                saveCalibration(configPath, rawConfig, newCached);
            }
        }

        preloadedResources.push({
            dirName, fullPath, cfg,
            foundRegions,
            isFirstLevel, level
        });
    }

    return preloadedResources;
}

// ======================== 3. 识别（只识别，不操作）========================
async function detectOnce(resource) {
    const { dirName, foundRegions, cfg } = resource;
    const tolerance = 1;

    for (const foundRegion of foundRegions) {
        const iconMat = file.readImageMatSync(`${foundRegion.iconDir}/${foundRegion.iconName}`);
        if (iconMat.empty()) continue;

        const recognitionObject = RecognitionObject.TemplateMatch(
            iconMat,
            foundRegion.x - tolerance,
            foundRegion.y - tolerance,
            foundRegion.width + 2 * tolerance,
            foundRegion.height + 2 * tolerance
        );
        recognitionObject.threshold = cfg.threshold;

        const result = await recognizeImage(recognitionObject, null, 1000, 400, true, dirName);
        if (result.isDetected) {
            return {
                x: result.x, y: result.y, width: result.width, height: result.height,
                ra: result.ra
            };
        }
    }
    return null;
}

// 带重试的识别
async function detectWithRetry(resource, retryCount, retryDelay) {
    for (let attempt = 0; attempt < retryCount; attempt++) {
        const match = await detectOnce(resource);
        if (match) return match;
        if (attempt < retryCount - 1) await sleep(retryDelay);
    }
    return null;
}

// ======================== 4. 步骤执行 ========================
async function executeSteps(resource, match, preloadedMap) {
    const steps = resource.cfg.steps;
    const centerX = Math.round(match.x + match.width / 2);
    const centerY = Math.round(match.y + match.height / 2);

    for (const step of steps) {
        const count = step.次数 != null ? step.次数 : 1;
        const delay = step.间隔毫秒 != null ? step.间隔毫秒 : 0;

        switch (step.动作) {
            case "点击": {
                const x = centerX + (step.x偏移 || 0);
                const y = centerY + (step.y偏移 || 0);
                for (let i = 0; i < count; i++) {
                    await click(x, y);
                    if (debugLog) log.info(`【${resource.dirName}】点击(${x}, ${y}) 第${i + 1}次`);
                    if (i < count - 1) await sleep(delay);
                }
                break;
            }
            case "按键": {
                const key = step.按键 || "VK_SPACE";
                for (let i = 0; i < count; i++) {
                    keyPress(key);
                    if (debugLog) log.info(`【${resource.dirName}】按键【${key}】第${i + 1}次`);
                    if (i < count - 1) await sleep(delay);
                }
                break;
            }
            case "OCR点击": {
                const r = step.区域;
                if (!step.目标文本 || !r) {
                    log.error(`【${resource.dirName}】OCR点击配置不全，跳过`);
                    break;
                }
                const region = { x: r.x, y: r.y, width: r.宽, height: r.高 };
                const { results: ocrResults } = await performOcr(step.目标文本, region, match.ra, step.超时毫秒 || 2000);
                if (ocrResults.length > 0) {
                    const x = Math.round(ocrResults[0].x + ocrResults[0].width / 2) + (step.x偏移 || 0);
                    const y = Math.round(ocrResults[0].y + ocrResults[0].height / 2) + (step.y偏移 || 0);
                    for (let i = 0; i < count; i++) {
                        await click(x, y);
                        if (debugLog) log.info(`【${resource.dirName}】OCR点击“${ocrResults[0].text}”(${x}, ${y}) 第${i + 1}次`);
                        if (i < count - 1) await sleep(delay);
                    }
                } else {
                    log.warn(`【${resource.dirName}】OCR未识别到目标文本`);
                }
                break;
            }
            case "执行键鼠脚本": {
                const scriptPath = normalizePath(step.脚本路径 || "");
                if (!scriptPath || !fileExists(scriptPath)) {
                    log.error(`【${resource.dirName}】键鼠脚本不存在：${scriptPath}，跳过`);
                    break;
                }
                for (let i = 0; i < count; i++) {
                    await keyMouseScript.runFile(scriptPath);
                    if (debugLog) log.info(`【${resource.dirName}】执行键鼠脚本【${scriptPath}】第${i + 1}次`);
                    if (i < count - 1) await sleep(delay);
                }
                break;
            }
            case "等待": {
                await sleep(step.毫秒 || 0);
                break;
            }
            case "调用子弹窗": {
                const subResource = preloadedMap.get(normalizePath(step.弹窗));
                if (!subResource) {
                    log.error(`【${resource.dirName}】子弹窗不存在：${step.弹窗}，跳过`);
                    break;
                }
                const subRetry = step.重试次数 != null ? step.重试次数 : subResource.cfg.retryCount;
                const subDelay = step.重试间隔毫秒 != null ? step.重试间隔毫秒 : subResource.cfg.retryDelay;
                if (step.循环 === true) {
                    // 快速识别循环：反复"识别→执行"子弹窗，直到识别不到、达到最大循环次数、或识别到"直到识别到"弹窗
                    const loopInterval = step.循环间隔毫秒 != null ? step.循环间隔毫秒 : 300;
                    const maxLoops = step.最大循环次数 != null ? step.最大循环次数 : 20;
                    const untilResource = step.直到识别到
                        ? preloadedMap.get(normalizePath(step.直到识别到)) : null;
                    for (let round = 0; round < maxLoops; round++) {
                        if (untilResource) {
                            const untilMatch = await detectOnce(untilResource);
                            if (untilMatch) {
                                try { untilMatch.ra?.dispose(); } catch (e) { }
                                log.info(`【${resource.dirName}】循环中识别到【${untilResource.dirName}】，提前结束循环`);
                                break;
                            }
                        }
                        const subOk = await runPopup(subResource, preloadedMap, subRetry, subDelay);
                        if (!subOk) break;
                        if (debugLog) log.info(`【${resource.dirName}】子弹窗【${subResource.dirName}】快速循环第${round + 1}轮完成`);
                        if (round < maxLoops - 1) await sleep(loopInterval);
                    }
                } else {
                    await runPopup(subResource, preloadedMap, subRetry, subDelay);
                }
                break;
            }
            default:
                log.error(`【${resource.dirName}】未知动作：${step.动作}，跳过`);
        }
    }
}

// ======================== 5. 弹窗完整流程（识别 → 步骤）========================
async function runPopup(resource, preloadedMap, retryCount = null, retryDelay = null) {
    const useRetry = retryCount != null ? retryCount : resource.cfg.retryCount;
    const useDelay = retryDelay != null ? retryDelay : resource.cfg.retryDelay;

    const match = await detectWithRetry(resource, useRetry, useDelay);
    if (!match) {
        return false;
    }

    log.info(`识别到【${resource.dirName}】弹窗，开始执行步骤`);
    try {
        await executeSteps(resource, match, preloadedMap);
    } finally {
        try { match.ra?.dispose(); } catch (e) { }
    }
    return true;
}

// ======================== 6. 后台任务 ========================
async function imageClickBackgroundTask() {
    log.info("imageClick后台任务已启动");

    const taskDelay = Math.min(999, Math.max(1, Math.floor(Number(settings.PopupClickDelay) || 15))) * 1000;
    let specificNames = [];
    try {
        specificNames = Array.from(settings.PopupNames || []);
    } catch (e) {
        log.error(`获取PopupNames设置失败: ${e.message}`);
    }

    // 先截图获取游戏分辨率，用于校验标定缓存
    let runtimeSize = null;
    try {
        const probeRa = captureGameRegion();
        runtimeSize = { width: probeRa.width, height: probeRa.height };
        probeRa.dispose();
    } catch (e) {
        log.warn(`获取游戏分辨率失败，标定缓存校验可能失效：${e.message}`);
    }

    // 可用弹窗目录扫描
    let availablePopupDirs = [];
    try {
        const subDirs = readAllFilePaths("assets/imageClick", 0, 2, [], true);
        availablePopupDirs = subDirs.filter(subDir => {
            const entries = readAllFilePaths(subDir, 0, 1, [], true);
            return entries.some(entry => normalizePath(entry).endsWith('/icon'));
        }).map(dir => basename(dir));
        if (debugLog) log.info(`可用弹窗目录：${availablePopupDirs.join(', ')}`);
    } catch (e) {
        log.error(`扫描弹窗目录失败: ${e.message}`);
    }

    if (specificNames.length > 0) {
        const invalidNames = specificNames.filter(name => !availablePopupDirs.includes(name));
        if (invalidNames.length > 0) {
            log.warn(`以下弹窗名称不存在，将被忽略：${invalidNames.join(', ')}`);
            specificNames = specificNames.filter(name => availablePopupDirs.includes(name));
        }
    } else {
        if (debugLog) log.info("未指定弹窗名称，将处理所有可用弹窗");
    }

    const preloadedResources = await preloadImageResources(specificNames, runtimeSize);
    if (preloadedResources.length === 0) {
        log.info("无可用弹窗资源，任务结束");
        return { success: false };
    }

    // 路径 → 资源 映射，供子弹窗调用查找
    const preloadedMap = new Map();
    for (const res of preloadedResources) preloadedMap.set(res.fullPath, res);

    const firstLevelDirs = preloadedResources.filter(res => res.isFirstLevel);
    if (firstLevelDirs.length === 0) {
        log.warn("无第一级弹窗目录，任务终止");
        return { success: false };
    }

    const secondLevel = preloadedResources.filter(r => !r.isFirstLevel);
    log.info(`弹窗加载完成：一级${firstLevelDirs.length}个（${firstLevelDirs.map(r => r.dirName).join('、')}），二级${secondLevel.length}个（${secondLevel.map(r => r.dirName).join('、')}）`);

    while (!state.completed && !state.cancelRequested) {
        for (const currentFirstLevel of firstLevelDirs) {
            if (state.completed || state.cancelRequested) break;
            const triggered = await runPopup(currentFirstLevel, preloadedMap);
            if (triggered) {
                log.info(`【${currentFirstLevel.dirName}】流程处理完毕`);
            }
            // 每个一级弹窗按自己的循环间隔等待，未配置则用设置里的默认间隔
            const ownDelaySec = currentFirstLevel.cfg.loopDelaySec != null
                ? Math.min(999, Math.max(1, Math.floor(currentFirstLevel.cfg.loopDelaySec)))
                : taskDelay / 1000;
            await sleep(ownDelaySec * 1000);
        }
    }

    log.info("imageClick后台任务结束");
    return { success: true };
}
