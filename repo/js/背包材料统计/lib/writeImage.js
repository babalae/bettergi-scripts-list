// 带Y坐标间距校验的Rarity定位函数
async function locateRarityAndCropColumn(ra, scanX0, startY, columnHeight, minYGap) {
    // 配置参数：完全沿用你代码中的设定（78x13星级图、±2px扩展、阈值）
    const config = {
        maxRows: 4,               // 目标最多4个区域（你需求中“未必有四个”，按实际识别返回）
        columnYMin: 205,       // 材料列Y下限（236-85=151；151-121=30；236-30=206；206-1=205）
        columnYMax: 844, // 材料列Y上限（最后一页星级Y值843+1）
        globalThreshold: 0.85,    // 你代码中已设置的全局识别阈值
        localThreshold: 0.8,      // 你代码中已设置的局部验证阈值
        expandPx: 2,              // 你确认的±2px扩展（适配78x13星级图）
        rarityW: 78,              // 你代码中定义的星级图宽度
        rarityH: 13,              // 你代码中定义的星级图高度
        rarityMatDir: "assets/rarity/" // 你代码中星级素材的固定路径
    };

    const scanX = Math.round(scanX0);
    log.debug(`[处理开始] 列X=${scanX}，有效Y范围：${config.columnYMin}-${config.columnYMax}`);

    // ---------------------- 步骤1：找基准Y（复用你提供的recognizeImage函数） ----------------------
    let baseX = null;
    let baseY = null;
    for (let star = 1; star <= 5; star++) { // 遍历1-5星素材（你代码中星级范围）
        const matPath = `${config.rarityMatDir}${star}.png`;
        const rarityMat = file.readImageMatSync(matPath); // 你代码中用的素材加载方式
        
        if (rarityMat.empty()) { // 你代码中素材加载失败的处理逻辑
            log.warn(`[基准识别] 素材加载失败：${matPath}`);
            await sleep(30); // 你代码中常用的短延迟，避免高频报错
            continue;
        }

        // 全局识别对象：X宽123（与你代码中一致），覆盖整列
        const globalRo = RecognitionObject.TemplateMatch(
            rarityMat,
            scanX,                  // 与scanMaterials传递的scanX一致（列起始X）
            config.columnYMin,      // 材料列顶部Y
            123,                    // 你代码中固定的图标宽度（非星级图宽，适配列扫描）
            columnHeight            // 与scanMaterials传递的columnHeight一致
        );
        globalRo.threshold = config.globalThreshold;
        globalRo.Use3Channels = true; // 你代码中启用的3通道识别

        // 复用你提供的recognizeImage函数（带超时、重试，避免阻塞）
        const result = await recognizeImage(globalRo, ra, 200, 50);
        if (result.isDetected) { // 识别成功则取Y坐标（你代码中用result.y作为基准）
            baseX = result.x;
            baseY = result.y;
            log.debug(`[基准识别] 找到${star}星基准，Y=${baseY}`);
            break;
        }
        await sleep(30);
    }

    // 无基准则返回空（你代码中基准识别失败的处理逻辑）
    if (baseY === null) {
        log.debug(`[基准识别] 无有效基准，返回空`);
        return [];
    }

    // ---------------------- 步骤2：先下后上推导候选Y（你需求中的优先顺序） ----------------------
    const candidateYs = [baseY]; // 初始包含基准Y
    let currentY;

    // 2.1 优先向下推导（Y递增，与你需求“先向下算”一致）
    currentY = baseY + minYGap; // minYGap=176（scanMaterials调用时传递的参数）
    while (candidateYs.length < config.maxRows && currentY <= config.columnYMax) {
        if (!candidateYs.includes(currentY)) {
            candidateYs.push(currentY);
            log.debug(`[向下推导] 新增Y=${currentY}，当前总数：${candidateYs.length}`);
        }
        currentY += minYGap;
    }

    // 2.2 不足则向上补（Y递减，与你需求“超阈值向上算”一致）
    const need = config.maxRows - candidateYs.length;
    if (need > 0) {
        currentY = baseY - minYGap;
        let added = 0;
        while (added < need && currentY >= config.columnYMin) {
            if (!candidateYs.includes(currentY)) {
                candidateYs.push(currentY);
                added++;
                log.debug(`[向上补全] 新增Y=${currentY}，已补${added}/${need}`);
            }
            currentY -= minYGap;
        }
    }

    // 整理候选Y：去重→过滤超界→排序（你代码中常用的数组处理逻辑）
    const sortedYs = [...new Set(candidateYs)]
        .filter(y => y >= config.columnYMin && y <= config.columnYMax)
        .sort((a, b) => a - b) // 从上到下排序（符合游戏界面布局）
        .slice(0, config.maxRows); // 最多保留4个
    log.debug(`[候选整理] 最终候选Y：${sortedYs.join(', ')}（共${sortedYs.length}个）`);

    // ---------------------- 步骤3：局部验证（避免空裁图，你代码中的验证逻辑） ----------------------
    const validYs = [];
    for (const y of sortedYs) {
        // 局部验证范围：按星级图尺寸+扩展计算（你确认的78x13+±2px）
        const localXStart = baseX - config.expandPx;
        const localXWidth = config.rarityW + 2 * config.expandPx; // 78+4=82px
        const localYStart = y - config.expandPx;
        const localYHeight = config.rarityH + 2 * config.expandPx; // 13+4=17px
        let isVerified = false;

        // 遍历1-5星验证（与基准识别逻辑一致）
        for (let star = 1; star <= 5; star++) {
            const matPath = `${config.rarityMatDir}${star}.png`;
            const rarityMat = file.readImageMatSync(matPath);
            if (rarityMat.empty()) continue;
        const region = {
                x:localXStart,
                y:localYStart,
                width:localXWidth,
                height:localYHeight}
                // await drawAndClearRedBox(region, ra, 20);// 调用异步函数绘制红框并延时清除
            const localRo = RecognitionObject.TemplateMatch(
                rarityMat,
                localXStart,
                localYStart,
                localXWidth,
                localYHeight
            );
            localRo.threshold = config.localThreshold;
            localRo.Use3Channels = true;

            // 再次复用recognizeImage验证（确保与基准识别逻辑统一）
            const result = await recognizeImage(localRo, ra, 50, 10); // 超时减半，加快验证
            if (result.isDetected) {
                isVerified = true;
                break;
            }
            await sleep(10);
        }

        if (isVerified) {
            validYs.push(y);
            log.debug(`[局部验证] Y=${y} 通过`);
        } else {
            log.debug(`[局部验证] Y=${y} 无匹配星级，排除`);
        }
    }

    // ---------------------- 步骤4：生成裁图区域（与你代码中固定偏移一致） ----------------------
    const ocrRegions = validYs.map(y => ({
        x: Math.round(scanX0 + 29.5),   // 你代码中固定的X偏移（scanX0+29.5）
        y: y - 85,       // 你代码中固定的Y偏移（y-85）
        width: 64,       // 你代码中固定的裁图宽度
        height: 64       // 你代码中固定的裁图高度
    }));

    log.debug(`[处理完成] 有效裁图区域：${ocrRegions.length}个（Y：${validYs.join(', ')}）`);
    return ocrRegions;
}
/**
 * 保存OCR裁图区域（扩大2像素识图，用识别到的图片名命名）
 * @param {Object} ra - 游戏区域捕获对象（来自captureGameRegion()）
 * @param {Array} ocrRegions - 原始裁图区域数组（含x,y,width,height）
 * @param {Object} materialImages - 材料图片缓存（key:材料名，value:图片Mat对象，来自scanMaterials）
 * @param {string} [saveDir='assets/regions'] - 保存目录
 */
async function saveAllOcrRegionImages(ra, ocrRegions, materialImages, saveDir = 'assets/regions') {
    // Fixed: Added proper parameter validation at function entry
    if (!ra || !ocrRegions || !Array.isArray(ocrRegions) || ocrRegions.length === 0) {
        log.warn('saveAllOcrRegionImages: Invalid parameters provided');
        return;
    }
  // 保留你原有函数的初始化检查（仅补充materialImages参数，因需要它匹配图片名）
  log.debug(`【保存OCR区域图像】区域数量：${ocrRegions?.length || 0}`);
  if (!ra || !ocrRegions || ocrRegions.length === 0 || !materialImages) {
    log.error("【保存OCR区域图像】源图像或区域列表为空");
    return;
  }
  
  for (const region of ocrRegions) {
    // 你原有函数的变量（仅新增matchedMatName用于存图片名）
    let fileName = "";
    let matchedMatName = "unknown"; // 默认名（未匹配到时用）
    let croppedRegion = null;
    
    // 保留你原有函数的红框绘制逻辑
    // await drawAndClearRedBox(region, ra, 50);
    
    try {
      // ---------------------- 核心修改1：裁图区域扩大2像素作为识图区域 ----------------------
      // 原有裁图区域：region.x, region.y, region.width, region.height
      // 扩大2像素：上下左右各扩2px，总宽高各+4（复用你原代码的坐标逻辑，无陌生函数）
      const detectX = region.x - 2;
      const detectY = region.y - 2;
      const detectW = region.width + 4;
      const detectH = region.height + 4;
      log.debug(`【识图区域扩大】原区域(${region.x},${region.y}) → 扩大后(${detectX},${detectY},${detectW},${detectH})`);

      // ---------------------- 核心修改2：用扩大区域识别图片名（复用你原代码的模板匹配） ----------------------
      // materialImages是你scanMaterials函数中已有的“材料图片缓存”，不是陌生变量
      // RecognitionObject.TemplateMatch是你原代码识别材料用的方法，无陌生函数
      for (const [matName, mat] of Object.entries(materialImages)) {
        if (mat.empty()) continue; // 跳过空图（你原代码的逻辑）
        
        // 用扩大后的区域做模板匹配（和你scanMaterials识别材料的逻辑完全一致）
        const matchRo = RecognitionObject.TemplateMatch(mat, detectX, detectY, detectW, detectH);
        matchRo.threshold = 0.85; // 和你原代码识别阈值一致
        matchRo.Use3Channels = true; // 你原代码启用的3通道识别
        
        const matchResult = ra.find(matchRo); // 你原代码的识别方法
        if (matchResult.isExist()) {
          matchedMatName = matName; // 匹配到后，获取图片名
          break; // 找到匹配项就退出循环
        }
      }

      // ---------------------- 核心修改3：用识别到的图片名命名文件（保留你原有保存逻辑） ----------------------
      // 文件名：图片名_时间戳.png（避免重名，复用你原代码的Date.now()）
      fileName = `${matchedMatName}_${Date.now()}`;
      
      // 保留你原有函数的裁图逻辑（裁的是原区域，不是扩大后的区域）
      croppedRegion = ra.DeriveCrop(region.x, region.y, region.width, region.height);
      if (!croppedRegion || croppedRegion.SrcMat.empty()) throw new Error("裁剪失败");
      
      // 保留你原有函数的保存逻辑
      file.WriteImageSync(`${saveDir}/${fileName}.png`, croppedRegion.SrcMat);
      log.info(`【保存OCR区域图像】成功：${saveDir}/${fileName}.png`);
    } catch (error) {
      // 保留你原有函数的错误处理逻辑
      log.error(`【保存OCR区域图像】失败（${fileName || '未知区域'}）：${error.message}`);
    } finally {
      // 保留你原有函数的资源释放逻辑
      if (croppedRegion && typeof croppedRegion.dispose === 'function') {
        croppedRegion.dispose();
      }
    }
  }
}
