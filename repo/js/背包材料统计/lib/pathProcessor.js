// ==============================================
// 路径处理模块
// ==============================================

/**
 * 极简封装：用路径和当前目标发通知，然后执行路径
 * @param {string} pathingFilePath - 路径文件路径
 * @param {string} currentMaterialName - 当前材料名
 * @param {number} estimatedTime - 预计耗时（秒）
 * @returns {Promise} 执行结果
 */
async function runPathAndNotify(pathingFilePath, currentMaterialName, estimatedTime = null) {
  const pathName = basename(pathingFilePath);
  if (notify) {
    let notifyMsg = `当前执行路径：${pathName}\n目标：${currentMaterialName || '未知'}`;
    if (estimatedTime !== null) {
      notifyMsg += `\n预计耗时：${formatTime(estimatedTime)}`;
    }
    notification.Send(notifyMsg);
  }
  return await pathingScript.runFile(pathingFilePath);
}

const MIN_RECORD_TIME = 15;

function findRefreshCD(resourceKey, CDCategories) {
  for (const [categoryName, cdInfo] of Object.entries(CDCategories)) {
    if (allowedCDCategories.length > 0 && !allowedCDCategories.includes(categoryName)) continue;
    for (const [cdKey, cdItems] of Object.entries(cdInfo)) {
      if (cdItems.includes(resourceKey)) {
        return JSON.parse(cdKey);
      }
    }
  }
  return null;
}

async function executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime, logModule) {
  const startTime = new Date().toLocaleString();
  log.info(`→ 开始执行地图追踪任务: "${pathName}"`);
  await runPathAndNotify(pathingFilePath, currentMaterialName, estimatedTime);
  const endTime = new Date().toLocaleString();
  const runTime = (new Date(endTime) - new Date(startTime)) / 1000;
  log.info(`→ 脚本执行结束: "${pathName}", 耗时: ${formatTime(runTime)}`);
  return { startTime, endTime, runTime };
}

function generateRecordContent(pathingFilePath, pathName, startTime, endTime, runTime, changes, contentCode = null) {
  const code = contentCode || (pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000");
  const changeStr = typeof changes === 'string' ? changes : JSON.stringify(changes);
  return `路径名: ${pathName}\n内容检测码: ${code}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${changeStr}\n\n`;
}

async function handlePathError(error, pathingFilePath, pathName, resourceKey, startTime, endTime, runTime, shouldSkipRecord, isCancelled) {
  const canRecord = runTime > MIN_RECORD_TIME;
  
  if (!canRecord) {
    return;
  }
  
  if (isCancelled || !shouldSkipRecord) {
    const content = generateRecordContent(
      pathingFilePath,
      pathName,
      startTime,
      endTime,
      runTime,
      error.message
    );
    writeContentToFile(`${CONSTANTS.NO_RECORD_DIR}/${resourceKey}.txt`, content);
    log.info(`${CONSTANTS.LOG_MODULES.RECORD}异常路径已记录：${pathName}（运行时间${runTime.toFixed(1)}秒）`);
  }
}

function checkPathSkipConditions(canRunCD, pathCheckResult, isTimeCostOk, perTime, estimatedTime, pathName, logModule) {
  if (!canRunCD) {
    log.info(`${logModule}${pathName} 跳过 | CD未刷新 | 时间成本：${perTime ?? '忽略'} | 预计耗时：${estimatedTime}秒`);
    return true;
  }
  if (!(pathCheckResult === true || pathCheckResult.valid)) {
    log.info(`${logModule}${pathName} 跳过 | ${pathCheckResult.reason || '0记录频率超限'} | 时间成本：${perTime ?? '忽略'} | 预计耗时：${estimatedTime}秒`);
    return true;
  }
  if (!isTimeCostOk) {
    log.info(`${logModule}${pathName} 跳过 | 时间成本不合格 | 时间成本：${perTime ?? '忽略'} | 预计耗时：${estimatedTime}秒`);
    return true;
  }
  return false;
}

/**
 * 处理狗粮路径条目（完整校验：CD+时间成本+频率+运行时间+距离）
 * @param {Object} entry - 路径条目 { path, resourceName }
 * @param {Object} accumulators - 累加器 { foodExpAccumulator, currentMaterialName }
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @param {Object} CDCategories - CD分类配置
 * @param {number} timeCost - 时间成本阈值
 * @param {Object} pathRecordCache - 记录缓存
 * @returns {Object} 更新后的累加器
 */
async function processFoodPathEntry(entry, accumulators, recordDir, noRecordDir, CDCategories, timeCost, pathRecordCache, timeCostStats) {
  const { path: pathingFilePath, resourceName } = entry;
  const pathName = basename(pathingFilePath);
  const { foodExpAccumulator, currentMaterialName: prevMaterialName } = accumulators;

  let startTime = null;
  let runTime = 0;

  try {
    const refreshCD = findRefreshCD(resourceName, CDCategories);
    if (!refreshCD) {
      log.debug(`${CONSTANTS.LOG_MODULES.CD}狗粮材料【${resourceName}】未找到CD配置，跳过路径：${pathName}`);
      await sleep(1);
      return accumulators;
    }

    const pathCheckResult = checkPathNameFrequency(resourceName, pathName, recordDir, true, pathingFilePath);
    if (pathCheckResult !== true && !pathCheckResult.valid) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}狗粮路径${pathName} 跳过 | ${pathCheckResult.reason}`);
      await sleep(1);
      return accumulators;
    }

    const currentTime = getCurrentTimeInHours();
    const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath);
    const perTime = noRecord ? null : calculatePerTime(
      resourceName, 
      pathName, 
      recordDir, 
      noRecordDir, 
      true,
      pathRecordCache,
      pathingFilePath
    );

    const estimatedTime = estimatePathTotalTime({ path: pathingFilePath, resourceName }, recordDir, noRecordDir);
    const canRunCD = canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName);
    const isTimeCostOk = noRecord || perTime === null || isTimeCostQualified(perTime, resourceName, timeCost, timeCostStats);

    if (checkPathSkipConditions(canRunCD, pathCheckResult, isTimeCostOk, perTime, estimatedTime, pathName, `${CONSTANTS.LOG_MODULES.PATH}狗粮路径`)) {
      await sleep(1);
      return accumulators;
    }

    log.info(`${CONSTANTS.LOG_MODULES.PATH}狗粮路径${pathName} 执行 | 时间成本：${perTime ?? '忽略'}秒/EXP | 预计耗时：${estimatedTime}秒`);

    let currentMaterialName = prevMaterialName;
    if (currentMaterialName !== resourceName) {
      if (prevMaterialName && foodExpAccumulator[prevMaterialName]) {
        const prevMsg = `材料[${prevMaterialName}]收集完成，累计EXP：${foodExpAccumulator[prevMaterialName]}`;
        await sendNotificationInChunks(prevMsg, notification.Send);
      }
      currentMaterialName = resourceName;
      foodExpAccumulator[resourceName] = 0;
      log.info(`${CONSTANTS.LOG_MODULES.PATH}切换至狗粮材料【${resourceName}】`);
    }

    const timing = await executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime);
    startTime = timing.startTime;
    runTime = timing.runTime;

    const { success, totalExp } = await executeSalvageWithOCR();
    foodExpAccumulator[resourceName] += totalExp;

    const foodRecordContent = generateRecordContent(pathingFilePath, pathName, startTime, timing.endTime, runTime, { "EXP": totalExp });
    const recordDirFinal = noRecord ? noRecordDir : recordDir;

    const canRecord = runTime > MIN_RECORD_TIME;
    if (canRecord && !state.cancelRequested) {
      if (totalExp === 0) {
        const zeroExpFilePath = `${recordDirFinal}/${resourceName}${CONSTANTS.FOOD_ZERO_EXP_SUFFIX}`;
        writeContentToFile(zeroExpFilePath, foodRecordContent);
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}狗粮路径${pathName} EXP=0，写入0记录文件：${zeroExpFilePath}`);
      } else {
        const normalExpFilePath = `${recordDirFinal}/${resourceName}${CONSTANTS.FOOD_EXP_RECORD_SUFFIX}`;
        writeContentToFile(normalExpFilePath, foodRecordContent);
        const foodMsg = `狗粮路径【${pathName}】执行完成\n耗时：${runTime.toFixed(1)}秒\n本次EXP：${totalExp}\n累计EXP：${foodExpAccumulator[resourceName]}`;
        await sendNotificationInChunks(foodMsg, notification.Send);
      }
    } else {
      if (state.cancelRequested) {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}狗粮路径${pathName}手动终止，跳过记录`);
      } else {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}狗粮路径${pathName} 不满足记录条件：运行时间${runTime.toFixed(1)}秒（需>${MIN_RECORD_TIME}秒）`);
      }
    }

    await sleep(1);
    return { ...accumulators, foodExpAccumulator, currentMaterialName };
  } catch (error) {
    if (startTime) {
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;
      await handlePathError(error, pathingFilePath, pathName, resourceName, startTime, endTime, runTime, noRecord, state.cancelRequested);
    }
    throw error;
  }
}

/**
 * 处理怪物路径条目
 * @param {Object} entry - 路径条目 { path, monsterName, resourceName }
 * @param {Object} context - 上下文 { CDCategories, timeCost, recordDir, noRecordDir, imagesDir, ... }
 * @returns {Object} 更新后的上下文
 */
async function processMonsterPathEntry(entry, context) {
  const { path: pathingFilePath, monsterName } = entry;
  const pathName = basename(pathingFilePath);
  const { 
    CDCategories, timeCost, recordDir, noRecordDir, imagesDir,
    materialCategoryMap, flattenedLowCountMaterials, 
    currentMaterialName: prevMaterialName,
    materialAccumulatedDifferences, globalAccumulatedDifferences,
    pathRecordCache, timeCostStats
  } = context;

  let startTime = null;
  let runTime = 0;
  let shouldRunAsNoRecord = false;

  try {
    const monsterMaterials = monsterToMaterials[monsterName] || [];
    const allExcess = monsterMaterials.every(mat => excessMaterialNames.includes(mat));
    if (allExcess) {
      log.warn(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${monsterName}】所有材料已超量，跳过路径：${pathName}`);
      await sleep(1);
      return context;
    }

    const refreshCD = findRefreshCD(monsterName, CDCategories);
    if (!refreshCD) {
      log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${monsterName}】未找到CD配置，跳过路径：${pathName}`);
      await sleep(1);
      return context;
    }

    const currentTime = getCurrentTimeInHours();
    const lastEndTime = getLastRunEndTime(monsterName, pathName, recordDir, noRecordDir, pathingFilePath);
    const pathCheckResult = checkPathNameFrequency(monsterName, pathName, recordDir, false, pathingFilePath);
    const perTime = noRecord ? null : calculatePerTime(
      monsterName, 
      pathName, 
      recordDir, 
      noRecordDir, 
      false,
      pathRecordCache,
      pathingFilePath
    );

    const estimatedTime = estimatePathTotalTime({ path: pathingFilePath, monsterName }, recordDir, noRecordDir);
    const canRunCD = canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName);
    const isTimeCostOk = noRecord || perTime === null || isTimeCostQualified(perTime, monsterName, timeCost, timeCostStats);

    if (checkPathSkipConditions(canRunCD, pathCheckResult, isTimeCostOk, perTime, estimatedTime, pathName, `${CONSTANTS.LOG_MODULES.PATH}怪物路径`)) {
      await sleep(1);
      return context;
    }

    log.info(`${CONSTANTS.LOG_MODULES.PATH}怪物路径${pathName} 执行 | 时间成本：${perTime ?? '忽略'} | 预计耗时：${estimatedTime}秒`);

    const resourceCategoryMap = {};
    const materials = monsterToMaterials[monsterName] || [];

    ocrContext.currentPathType = 'monster';
    ocrContext.currentTargetMaterials = materials;

    materials.forEach(mat => {
      const category = matchImageAndGetCategory(mat, imagesDir);
      if (category) {
        if (!resourceCategoryMap[category]) resourceCategoryMap[category] = [];
        if (!resourceCategoryMap[category].includes(mat)) {
          resourceCategoryMap[category].push(mat);
        }
      }
    });
    log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}怪物${monsterName}的扫描分类：${JSON.stringify(resourceCategoryMap)}`);

    let currentMaterialName = prevMaterialName;
    let updatedFlattened = flattenedLowCountMaterials;

    const hasExcessMaterial = materials.some(mat => excessMaterialNames.includes(mat));
    shouldRunAsNoRecord = noRecord || hasExcessMaterial;

    if (shouldRunAsNoRecord) {
      if (currentMaterialName !== monsterName) {
        currentMaterialName = monsterName;
        materialAccumulatedDifferences[monsterName] = {};
        log.info(`${CONSTANTS.LOG_MODULES.PATH}noRecord模式：切换目标至怪物【${monsterName}】`);
      }

      const timing = await executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime);
      startTime = timing.startTime;
      runTime = timing.runTime;

      if (runTime > MIN_RECORD_TIME) {
        const noRecordContent = generateRecordContent(pathingFilePath, pathName, startTime, timing.endTime, runTime, "noRecord模式忽略");
        writeContentToFile(`${noRecordDir}/${monsterName}.txt`, noRecordContent);
      } else {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}怪物路径${pathName}运行时间不足（${runTime.toFixed(1)}秒 < ${MIN_RECORD_TIME}秒），跳过noRecord记录`);
      }
    } else {
      if (currentMaterialName !== monsterName) {
        if (prevMaterialName && materialAccumulatedDifferences[prevMaterialName]) {
          const prevMsg = `目标[${prevMaterialName}]收集完成，累计获取：${JSON.stringify(materialAccumulatedDifferences[prevMaterialName])}`;
          await sendNotificationInChunks(prevMsg, notification.Send);
        }
        currentMaterialName = monsterName;
        const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
        updatedFlattened = updatedLowCountMaterials
          .flat()
          .sort((a, b) => parseInt(a.count, 10) - parseInt(b.count, 10));
        materialAccumulatedDifferences[monsterName] = {};
      }

      const timing = await executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime);
      startTime = timing.startTime;
      runTime = timing.runTime;

      const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
      const flattenedUpdated = updatedLowCountMaterials.flat().sort((a, b) => a.count - b.count);

      const materialCountDifferences = {};
        flattenedUpdated.forEach(updated => {
          const original = updatedFlattened.find(m => m.name === updated.name);
          if (original) {
            const updatedCount = parseInt(updated.count);
            const originalCount = parseInt(original.count);
            let diff = updatedCount - originalCount;
            
            if (isNaN(updatedCount) || isNaN(originalCount)) {
              diff = NaN;
            } else if (diff < 0) {
              diff = null;
            }
            
            if ((diff !== 0 && !isNaN(diff)) || materials.includes(updated.name)) {
              materialCountDifferences[updated.name] = diff;
              if (!isNaN(diff)) {
                globalAccumulatedDifferences[updated.name] = (globalAccumulatedDifferences[updated.name] || 0) + diff;
                materialAccumulatedDifferences[monsterName][updated.name] = (materialAccumulatedDifferences[monsterName][updated.name] || 0) + diff;
              }
            }
          }
        });

      updatedFlattened = updatedFlattened.map(m => {
        const updated = flattenedUpdated.find(u => u.name === m.name);
        return updated ? { ...m, count: updated.count } : m;
      });

      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}怪物路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
      
      recordRunTime(monsterName, pathName, timing.startTime, timing.endTime, runTime, recordDir, materialCountDifferences, pathingFilePath);
    }

    await sleep(1);
    return {
      ...context,
      currentMaterialName,
      flattenedLowCountMaterials: updatedFlattened,
      materialAccumulatedDifferences,
      globalAccumulatedDifferences
    };
  } catch (error) {
    if (startTime) {
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;
      await handlePathError(error, pathingFilePath, pathName, monsterName, startTime, endTime, runTime, shouldRunAsNoRecord, false);
    }
    throw error;
  }
}

/**
 * 处理普通材料路径条目
 * @param {Object} entry - 路径条目 { path, resourceName }
 * @param {Object} context - 上下文（同怪物路径）
 * @returns {Object} 更新后的上下文
 */
async function processNormalPathEntry(entry, context) {
  const { path: pathingFilePath, resourceName } = entry;
  const pathName = basename(pathingFilePath);
  const { 
    CDCategories, timeCost, recordDir, noRecordDir,
    materialCategoryMap, flattenedLowCountMaterials, 
    currentMaterialName: prevMaterialName,
    materialAccumulatedDifferences, globalAccumulatedDifferences,
    pathRecordCache, timeCostStats
  } = context;

  let startTime = null;
  let runTime = 0;

  try {
    const refreshCD = findRefreshCD(resourceName, CDCategories);
    if (!refreshCD) {
      log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}材料【${resourceName}】未找到CD配置，跳过路径：${pathName}`);
      await sleep(1);
      return context;
    }

    const currentTime = getCurrentTimeInHours();
    const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath);
    const pathCheckResult = checkPathNameFrequency(resourceName, pathName, recordDir, false, pathingFilePath);
    const perTime = noRecord ? null : calculatePerTime(resourceName, pathName, recordDir, noRecordDir, false, pathRecordCache, pathingFilePath);

    const estimatedTime = estimatePathTotalTime({ path: pathingFilePath, resourceName }, recordDir, noRecordDir);
    const canRunCD = canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName);
    const isTimeCostOk = noRecord || perTime === null || isTimeCostQualified(perTime, resourceName, timeCost, timeCostStats);

    if (checkPathSkipConditions(canRunCD, pathCheckResult, isTimeCostOk, perTime, estimatedTime, pathName, `${CONSTANTS.LOG_MODULES.PATH}材料路径`)) {
      await sleep(1);
      return context;
    }

    log.info(`${CONSTANTS.LOG_MODULES.PATH}材料路径${pathName} 执行 | 时间成本：${perTime ?? '忽略'} | 预计耗时：${estimatedTime}秒`);

    const resourceCategoryMap = {};
    for (const [cat, list] of Object.entries(materialCategoryMap)) {
      if (list.includes(resourceName)) {
        resourceCategoryMap[cat] = [resourceName];
        break;
      }
    }

    let currentMaterialName = prevMaterialName;
    let updatedFlattened = flattenedLowCountMaterials;

    if (noRecord) {
      if (currentMaterialName !== resourceName) {
        currentMaterialName = resourceName;
        materialAccumulatedDifferences[resourceName] = {};
        log.info(`${CONSTANTS.LOG_MODULES.PATH}noRecord模式：切换目标至材料【${resourceName}】`);
      }

      const timing = await executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime);
      startTime = timing.startTime;
      runTime = timing.runTime;

      if (runTime > MIN_RECORD_TIME) {
        const noRecordContent = generateRecordContent(pathingFilePath, pathName, startTime, timing.endTime, runTime, "noRecord模式忽略");
        writeContentToFile(`${noRecordDir}/${resourceName}.txt`, noRecordContent);
      } else {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}材料路径${pathName}运行时间不足（${runTime.toFixed(1)}秒 < ${MIN_RECORD_TIME}秒），跳过noRecord记录`);
      }
    } else {
      if (currentMaterialName !== resourceName) {
        if (prevMaterialName && materialAccumulatedDifferences[prevMaterialName]) {
          const prevMsg = `目标[${prevMaterialName}]收集完成，累计获取：${JSON.stringify(materialAccumulatedDifferences[prevMaterialName])}`;
          await sendNotificationInChunks(prevMsg, notification.Send);
        }
        currentMaterialName = resourceName;
        const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
        updatedFlattened = updatedLowCountMaterials
          .flat()
          .sort((a, b) => parseInt(a.count, 10) - parseInt(b.count, 10));
        materialAccumulatedDifferences[resourceName] = {};
      }

      const timing = await executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime);
      startTime = timing.startTime;
      runTime = timing.runTime;

      const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
      const flattenedUpdated = updatedLowCountMaterials.flat().sort((a, b) => a.count - b.count);

      const materialCountDifferences = {};
      flattenedUpdated.forEach(updated => {
        const original = updatedFlattened.find(m => m.name === updated.name);
        if (original) {
          const updatedCount = parseInt(updated.count);
          const originalCount = parseInt(original.count);
          let diff = updatedCount - originalCount;
          
          if (isNaN(updatedCount) || isNaN(originalCount)) {
            diff = NaN;
          } else if (diff < 0) {
            diff = null;
          }
          
          if ((diff !== 0 && !isNaN(diff)) || updated.name === resourceName) {
            materialCountDifferences[updated.name] = diff;
            if (!isNaN(diff)) {
              globalAccumulatedDifferences[updated.name] = (globalAccumulatedDifferences[updated.name] || 0) + diff;
              materialAccumulatedDifferences[resourceName][updated.name] = (materialAccumulatedDifferences[resourceName][updated.name] || 0) + diff;
            }
          }
        }
      });

      updatedFlattened = updatedFlattened.map(m => {
        const updated = flattenedUpdated.find(u => u.name === m.name);
        return updated ? { ...m, count: updated.count } : m;
      });

      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}材料路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
      
      recordRunTime(resourceName, pathName, timing.startTime, timing.endTime, runTime, recordDir, materialCountDifferences, pathingFilePath);
    }

    await sleep(1);
    return {
      ...context,
      currentMaterialName,
      flattenedLowCountMaterials: updatedFlattened,
      materialAccumulatedDifferences,
      globalAccumulatedDifferences
    };
  } catch (error) {
    if (startTime) {
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;
      await handlePathError(error, pathingFilePath, pathName, resourceName, startTime, endTime, runTime, noRecord, state.cancelRequested);
    }
    throw error;
  }
}

/**
 * 批量处理所有路径（核心修改：时间预判+缓存传递）
 * @param {Object[]} allPaths - 所有路径条目
 * @param {Object} CDCategories - CD分类配置
 * @param {Object} materialCategoryMap - 材料分类映射
 * @param {number} timeCost - 时间成本阈值
 * @param {Object[]} flattenedLowCountMaterials - 低数量材料列表
 * @param {string|null} currentMaterialName - 当前处理的材料名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @param {string} imagesDir - 图像目录
 * @param {string} endTimeStr - 指定终止时间
 * @returns {Object} 处理结果
 */
async function processAllPaths(allPaths, CDCategories, materialCategoryMap, timeCost, flattenedLowCountMaterials, currentMaterialName, recordDir, noRecordDir, imagesDir, endTimeStr) {
  try {
    let foodExpAccumulator = {};
    const globalAccumulatedDifferences = {};
    const materialAccumulatedDifferences = {};
    const pathRecordCache = {};

    if (pathingMode.estimateMode) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[测算模式] 开始路径分析...`);
      
      const allTimeCostData = collectAllTimeCostData(allPaths, recordDir, noRecordDir, pathRecordCache);
      
      const timeCostStats = {};
      for (const [resourceKey, data] of Object.entries(allTimeCostData)) {
        timeCostStats[resourceKey] = calculateTimeCostStats(data);
      }
      
      const resourceAnalysis = {};
      let totalQualifiedPaths = 0;
      let totalPaths = 0;
      let totalEstimatedTime = 0;
      let failedCD = 0;
      let failedFrequency = 0;
      let passedTimeCost = 0;
      let failedTimeCost = 0;
      let insufficientRecords = 0;
      
      for (const entry of allPaths) {
        const { path: pathingFilePath, resourceName, monsterName } = entry;
        const pathName = basename(pathingFilePath);
        const resourceKey = monsterName || resourceName || '未知';
        
        let refreshCD = null;
        for (const [categoryName, cdInfo] of Object.entries(CDCategories)) {
          if (allowedCDCategories.length > 0 && !allowedCDCategories.includes(categoryName)) continue;
          for (const [cdKey, cdItems] of Object.entries(cdInfo)) {
            if (cdItems.includes(resourceKey)) {
              refreshCD = JSON.parse(cdKey);
              break;
            }
          }
          if (refreshCD) break;
        }
        
        const currentTime = getCurrentTimeInHours();
        const lastEndTime = getLastRunEndTime(resourceKey, pathName, recordDir, noRecordDir, pathingFilePath);
        const canRunCD = canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName);
        
        const isFood = resourceName && isFoodResource(resourceName);
        const pathCheckResult = checkPathNameFrequency(resourceKey, pathName, recordDir, isFood, pathingFilePath);
        
        const perTime = calculatePerTime(
          resourceKey,
          pathName,
          recordDir,
          noRecordDir,
          isFood,
          pathRecordCache,
          pathingFilePath
        );
        
        const isTimeCostOk = perTime === null || isTimeCostQualified(
          perTime,
          resourceKey,
          timeCost,
          timeCostStats
        );
        
        if (!resourceAnalysis[resourceKey]) {
          resourceAnalysis[resourceKey] = {
            total: 0,
            qualified: 0,
            perTimeSum: 0,
            perTimeCount: 0,
            qualifiedPerTimeSum: 0,
            estimatedTimeSum: 0
          };
        }
        
        resourceAnalysis[resourceKey].total++;
        totalPaths++;
        
        if (!canRunCD) {
          failedCD++;
        }
        if (!(pathCheckResult === true || pathCheckResult.valid)) {
          failedFrequency++;
        }
        if (perTime === null) {
          insufficientRecords++;
        } else if (isTimeCostOk) {
          passedTimeCost++;
        } else {
          failedTimeCost++;
        }
        
        if (canRunCD && (pathCheckResult === true || pathCheckResult.valid) && isTimeCostOk) {
          resourceAnalysis[resourceKey].qualified++;
          totalQualifiedPaths++;
          
          const estimatedTime = estimatePathTotalTime(entry, recordDir, noRecordDir, pathRecordCache);
          resourceAnalysis[resourceKey].estimatedTimeSum += estimatedTime;
          totalEstimatedTime += estimatedTime;
          
          if (perTime !== null) {
            resourceAnalysis[resourceKey].qualifiedPerTimeSum += perTime;
          }
        }
        
        if (perTime !== null) {
          resourceAnalysis[resourceKey].perTimeSum += perTime;
          resourceAnalysis[resourceKey].perTimeCount++;
        }
      }
      
      log.info(`${CONSTANTS.LOG_MODULES.PATH}\n===== 测算模式分析结果 =====`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}时间成本：${timeCost}%`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}总路径数：${totalPaths}`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}未通过（CD未刷新）：${failedCD}条`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}未通过（0记录超限）：${failedFrequency}条`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}未达标（时间成本不合格）：${failedTimeCost}条`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}直通达标（记录不足）：${insufficientRecords}条`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}达标路径数：${totalQualifiedPaths}条（同时通过三个校验）`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}达标占比：${totalPaths > 0 ? ((totalQualifiedPaths / totalPaths) * 100).toFixed(1) : 0}%`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}预计耗时：${formatTime(totalEstimatedTime)}`);
      
      log.info(`${CONSTANTS.LOG_MODULES.PATH}\n各材料平均时间成本及达标情况：`);
      for (const [resourceKey, data] of Object.entries(resourceAnalysis)) {
        const avgPerTime = data.perTimeCount > 0 ? (data.perTimeSum / data.perTimeCount).toFixed(4) : '无记录';
        const qualifiedRatio = data.total > 0 ? ((data.qualified / data.total) * 100).toFixed(1) : '0.0';
        const totalEstimatedTime = formatTime(data.estimatedTimeSum);
        const avgQualifiedPerTime = data.qualified > 0 ? (data.qualifiedPerTimeSum / data.qualified).toFixed(4) : '无达标';
        const thresholdValue = timeCostStats[resourceKey] ? (timeCostStats[resourceKey].percentiles[timeCost] || timeCostStats[resourceKey].median).toFixed(4) : '无数据';
        
        const isFood = resourceKey && isFoodResource(resourceKey);
        const isMonster = monsterToMaterials.hasOwnProperty(resourceKey);
        let unit = '秒/个';
        if (isFood) {
          unit = '秒/EXP';
        } else if (isMonster) {
          unit = '秒/中位材料';
        }
        
        log.info(`${CONSTANTS.LOG_MODULES.PATH}  --------------------------------------`);
        log.info(`${CONSTANTS.LOG_MODULES.PATH}  ${resourceKey}:`);
        log.info(`${CONSTANTS.LOG_MODULES.PATH}    达标平均：${avgQualifiedPerTime}${unit}`);
        log.info(`${CONSTANTS.LOG_MODULES.PATH}    设置的${timeCost}%分位阈值：${thresholdValue}${unit}`);
        log.info(`${CONSTANTS.LOG_MODULES.PATH}    所有有记录路径的平均：${avgPerTime}${unit}`);
        log.info(`${CONSTANTS.LOG_MODULES.PATH}    达标：${qualifiedRatio}% (${data.qualified}/${data.total})，总耗时：${totalEstimatedTime}`);
      }
      log.info(`${CONSTANTS.LOG_MODULES.PATH}=============================\n`);
      
      if (notify) {
        const estimateMsg = `【测算模式】分析完成\n总路径数：${totalPaths}\n达标路径数：${totalQualifiedPaths}\n达标占比：${totalPaths > 0 ? ((totalQualifiedPaths / totalPaths) * 100).toFixed(1) : 0}%\n预计耗时：${formatTime(totalEstimatedTime)}`;
        await sendNotificationInChunks(estimateMsg, notification.Send);
      }
      
      state.completed = true;
      state.cancelRequested = true;
      return { 
        currentMaterialName: null, 
        flattenedLowCountMaterials: [],
        globalAccumulatedDifferences: {},
        foodExpAccumulator
      };
    }

    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}[百分位数系统] 开始收集时间成本数据...`);
    const allTimeCostData = collectAllTimeCostData(allPaths, recordDir, noRecordDir, pathRecordCache);
    
    const timeCostStats = {};
    for (const [resourceKey, data] of Object.entries(allTimeCostData)) {
      timeCostStats[resourceKey] = calculateTimeCostStats(data);
      if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}[百分位数系统] ${resourceKey}统计：样本数=${timeCostStats[resourceKey].count}, 平均值=${timeCostStats[resourceKey].mean}, 中位数=${timeCostStats[resourceKey].median}`);
      if (debugLog) {
        log.info(`  标准差：${timeCostStats[resourceKey].stdDev}`);
        log.info(`  百分位数：${JSON.stringify(timeCostStats[resourceKey].percentiles)}`);
      }
    }
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}[百分位数系统] 时间成本阈值：${timeCost}%`);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}[百分位数系统] 时间成本数据收集完成，共${Object.keys(timeCostStats).length}个资源`);
    
    let context = {
      CDCategories, timeCost, recordDir, noRecordDir, imagesDir,
      materialCategoryMap, flattenedLowCountMaterials,
      currentMaterialName, materialAccumulatedDifferences,
      globalAccumulatedDifferences,
      pathRecordCache,
      timeCostStats
    };

    for (const entry of allPaths) {
      if (state.cancelRequested) {
        log.warn(`${CONSTANTS.LOG_MODULES.PATH}检测到手动终止指令，停止路径处理`);
        break;
      }

      let skipPath = false;
      if (endTimeStr) {
        const isValidEndTime = /^\d{1,2}[:：]\d{1,2}$/.test(endTimeStr);
        if (isValidEndTime) {
          const remainingMinutes = getRemainingMinutesToEndTime(endTimeStr);
          if (remainingMinutes <= 0) {
            log.warn(`${CONSTANTS.LOG_MODULES.MAIN}已过指定终止时间（${endTimeStr}），停止路径处理`);
            state.cancelRequested = true;
            break;
          }

          const pathTotalTimeSec = estimatePathTotalTime(
            entry, 
            recordDir, 
            noRecordDir, 
            pathRecordCache
          );
          const pathTotalTimeMin = pathTotalTimeSec / 60;
          const requiredMin = pathTotalTimeMin + 2;

          if (remainingMinutes <= requiredMin) {
            log.warn(`${CONSTANTS.LOG_MODULES.MAIN}时间不足：剩余${remainingMinutes}分钟，需${requiredMin}分钟（含2分钟空闲）`);
            state.cancelRequested = true;
            skipPath = true;
            break;
          } else {
            log.debug(`${CONSTANTS.LOG_MODULES.MAIN}时间充足：剩余${remainingMinutes}分钟，需${requiredMin}分钟`);
          }
        } else {
          log.warn(`${CONSTANTS.LOG_MODULES.MAIN}终止时间格式无效（${endTimeStr}），跳过定时判断`);
        }
      }

      if (skipPath) break;

      const { path: pathingFilePath, resourceName, monsterName } = entry;

      try {
        if (resourceName && isFoodResource(resourceName)) {
          const result = await processFoodPathEntry(
            entry, 
            {
              foodExpAccumulator,
              currentMaterialName: context.currentMaterialName
            }, 
            recordDir, 
            noRecordDir, 
            CDCategories, 
            timeCost, 
            context.pathRecordCache,
            context.timeCostStats
          );
          foodExpAccumulator = result.foodExpAccumulator;
          context.currentMaterialName = result.currentMaterialName;
        } else if (monsterName) {
          context = await processMonsterPathEntry(entry, context);
        } else if (resourceName) {
          context = await processNormalPathEntry(entry, context);
        } else {
          log.warn(`${CONSTANTS.LOG_MODULES.PATH}跳过无效路径条目：${JSON.stringify(entry)}`);
        }
      } catch (singleError) {
        log.error(`${CONSTANTS.LOG_MODULES.PATH}处理路径出错，已跳过：${singleError.message}`);
        
        await sleep(1);
        if (state.cancelRequested) {
          log.warn(`${CONSTANTS.LOG_MODULES.PATH}检测到终止指令，停止处理`);
          break;
        }
      }
    }

    if (context.currentMaterialName) {
      if (isFoodResource(context.currentMaterialName) && foodExpAccumulator[context.currentMaterialName]) {
        const finalMsg = `狗粮材料[${context.currentMaterialName}]收集完成，累计EXP：${foodExpAccumulator[context.currentMaterialName]}`;
        await sendNotificationInChunks(finalMsg, notification.Send);
      } else if (materialAccumulatedDifferences[context.currentMaterialName]) {
        const finalMsg = `目标[${context.currentMaterialName}]收集完成，累计获取：${JSON.stringify(materialAccumulatedDifferences[context.currentMaterialName])}`;
        await sendNotificationInChunks(finalMsg, notification.Send);
      }
    }

    return { 
      currentMaterialName: context.currentMaterialName, 
      flattenedLowCountMaterials: context.flattenedLowCountMaterials,
      globalAccumulatedDifferences: context.globalAccumulatedDifferences,
      foodExpAccumulator
    };

  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.PATH}路径处理整体错误：${error.message}`);
    throw error;
  } finally {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}路径组处理结束`);
    state.completed = true;
  }
}
