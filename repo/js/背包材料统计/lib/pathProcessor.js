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
  return await pathingScript.runFile(pathingFilePath);
}

const executedPathRecords = []; // 记录本轮已执行路径（名称+实际耗时），供进度/通知使用
const MIN_RECORD_TIME = 15;
const MIN_PER_TIME_MULTIPLIER = 0.1;
const MAX_PER_TIME_MULTIPLIER = 10;

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
  if (debugLog) log.info(`→ 开始执行地图追踪任务: "${pathName}"`);
  await runPathAndNotify(pathingFilePath, currentMaterialName, estimatedTime);
  const endTime = new Date().toLocaleString();
  const runTime = (new Date(endTime) - new Date(startTime)) / 1000;
  executedPathRecords.push({ name: pathName, runTime });
  if (debugLog) log.info(`→ 脚本执行结束: "${pathName}", 耗时: ${formatTime(runTime)}`);
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
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}异常路径已记录：${pathName}（运行时间${runTime.toFixed(1)}秒）`);
  }
}

function checkPathSkipConditions(canRunCD, pathCheckResult, perTime, estimatedTime, pathName, logModule, ignoreFrequency = false) {
  if (!canRunCD) {
    log.info(`${logModule}${pathName} 跳过 | CD未刷新 | 时间成本：${perTime ?? '忽略'} | 预计耗时：${estimatedTime}秒`);
    return true;
  }
  if (!ignoreFrequency && !(pathCheckResult === true || pathCheckResult.valid)) {
    log.info(`${logModule}${pathName} 跳过 | ${pathCheckResult.reason || '达到上限'} | 时间成本：${perTime ?? '忽略'} | 预计耗时：${estimatedTime}秒`);
    return true;
  }
  return false;
}

/**
 * 处理怪物路径条目
 * @param {Object} entry - 路径条目 { path, monsterName, resourceName }
 * @param {Object} context - 上下文 { CDCategories, timeCost, recordDir, noRecordDir, imagesDir, ... }
 * @returns {Object} 更新后的上下文
 */
async function processMonsterPathEntry(entry, context) {
  const { path: pathingFilePath, monsterName, isRollback = false, isRespawn = false } = entry;
  const pathName = basename(pathingFilePath);
  const { 
    CDCategories, timeCost, recordDir, noRecordDir, imagesDir,
    materialCategoryMap, flattenedLowCountMaterials, 
    currentMaterialName: prevMaterialName,
    materialAccumulatedDifferences, globalAccumulatedDifferences,
    pathRecordCache, timeCostStats, mode
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
    const lastEndTime = getLastRunEndTime(monsterName, pathName, recordDir, noRecordDir, pathingFilePath, pathRecordCache);
    const pathCheckResult = checkPathNameFrequency(monsterName, pathName, recordDir, false, pathingFilePath, pathRecordCache);
    const perTime = calculatePerTime(
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
    if (checkPathSkipConditions(canRunCD, pathCheckResult, perTime, estimatedTime, pathName, `${CONSTANTS.LOG_MODULES.PATH}怪物路径`, isRespawn)) {
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
        const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap, null, mode);
        updatedFlattened = updatedLowCountMaterials
          .flat()
          .sort((a, b) => parseInt(a.count, 10) - parseInt(b.count, 10));
        materialAccumulatedDifferences[monsterName] = {};
      }

      const timing = await executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime);
      startTime = timing.startTime;
      runTime = timing.runTime;

      const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap, null, mode);
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

      const monsterMaterials = monsterToMaterials[monsterName] || [];
      const gradeRatios = MONSTER_GRADE_RATIOS;
      let totalMiddleCount = 0;
      monsterMaterials.forEach((mat, index) => {
        const diff = materialCountDifferences[mat] || 0;
        totalMiddleCount += diff * (gradeRatios[index] || 1);
      });
      totalMiddleCount = parseFloat(totalMiddleCount.toFixed(2));
      
      const actualPerTime = totalMiddleCount > 0 ? runTime / totalMiddleCount : null;
      
      if (perTime !== null && actualPerTime !== null && (actualPerTime < perTime * MIN_PER_TIME_MULTIPLIER || actualPerTime > perTime * MAX_PER_TIME_MULTIPLIER)) {
        const reason = actualPerTime < perTime * MIN_PER_TIME_MULTIPLIER ? `低于${MIN_PER_TIME_MULTIPLIER}倍` : `超过${MAX_PER_TIME_MULTIPLIER}倍`;
        log.warn(`${CONSTANTS.LOG_MODULES.PATH}[怪物路径] 实际时间成本异常: ${actualPerTime.toFixed(4)}秒/中级，平均: ${perTime.toFixed(4)}秒/中级，${reason}，将记录到norecord`);
        log.warn(`${CONSTANTS.LOG_MODULES.PATH}[怪物路径] 本次获得: ${JSON.stringify(materialCountDifferences)}, 折合中级: ${totalMiddleCount}`);
        
        const noRecordContent = generateRecordContent(
          pathingFilePath,
          pathName,
          startTime,
          timing.endTime,
          runTime,
          `时间成本异常: ${actualPerTime.toFixed(4)}秒/中级 (平均: ${perTime.toFixed(4)}秒/中级, 折合中级: ${totalMiddleCount})`
        );
        writeContentToFile(`${noRecordDir}/${monsterName}.txt`, noRecordContent);
        
        Object.entries(materialCountDifferences).forEach(([name, diff]) => {
          if (!isNaN(diff) && diff !== null) {
            globalAccumulatedDifferences[name] = (globalAccumulatedDifferences[name] || 0) + diff;
            materialAccumulatedDifferences[monsterName][name] = (materialAccumulatedDifferences[monsterName][name] || 0) + diff;
          }
        });
        
        await sleep(1);
        return {
          ...context,
          currentMaterialName,
          flattenedLowCountMaterials: updatedFlattened,
          materialAccumulatedDifferences,
          globalAccumulatedDifferences
        };
      }

      if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}怪物路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
      
      const monsterRecOutcome = recordRunTime(monsterName, pathName, timing.startTime, timing.endTime, runTime, recordDir, materialCountDifferences, pathingFilePath, noRecordDir);
      applyZeroRecordDecay(monsterName, pathingFilePath, recordDir, monsterRecOutcome, isRespawn, pathRecordCache);
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
      await handlePathError(error, pathingFilePath, pathName, monsterName, startTime, endTime, runTime, shouldRunAsNoRecord, state.cancelRequested);
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
  const { path: pathingFilePath, resourceName, isRollback = false, isRespawn = false } = entry;
  const pathName = basename(pathingFilePath);
  const { 
    CDCategories, timeCost, recordDir, noRecordDir,
    materialCategoryMap, flattenedLowCountMaterials, 
    currentMaterialName: prevMaterialName,
    materialAccumulatedDifferences, globalAccumulatedDifferences,
    pathRecordCache, timeCostStats, mode
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
    const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath, pathRecordCache);
    const pathCheckResult = checkPathNameFrequency(resourceName, pathName, recordDir, false, pathingFilePath, pathRecordCache);
    const perTime = calculatePerTime(resourceName, pathName, recordDir, noRecordDir, false, pathRecordCache, pathingFilePath);

    const estimatedTime = estimatePathTotalTime({ path: pathingFilePath, resourceName }, recordDir, noRecordDir);
    const canRunCD = canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName);
    if (checkPathSkipConditions(canRunCD, pathCheckResult, perTime, estimatedTime, pathName, `${CONSTANTS.LOG_MODULES.PATH}材料路径`, isRespawn)) {
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
        const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap, null, mode);
        updatedFlattened = updatedLowCountMaterials
          .flat()
          .sort((a, b) => parseInt(a.count, 10) - parseInt(b.count, 10));
        materialAccumulatedDifferences[resourceName] = {};
      }

      const timing = await executePathWithTiming(pathingFilePath, pathName, currentMaterialName, estimatedTime);
      startTime = timing.startTime;
      runTime = timing.runTime;

      const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap, null, mode);
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

      const diff = materialCountDifferences[resourceName] || 0;
      const actualPerTime = diff > 0 ? runTime / diff : null;
      
      if (perTime !== null && actualPerTime !== null && (actualPerTime < perTime * MIN_PER_TIME_MULTIPLIER || actualPerTime > perTime * MAX_PER_TIME_MULTIPLIER)) {
        const reason = actualPerTime < perTime * MIN_PER_TIME_MULTIPLIER ? `低于${MIN_PER_TIME_MULTIPLIER}倍` : `超过${MAX_PER_TIME_MULTIPLIER}倍`;
        log.warn(`${CONSTANTS.LOG_MODULES.PATH}[材料路径] 实际时间成本异常: ${actualPerTime.toFixed(4)}秒/个，平均: ${perTime.toFixed(4)}秒/个，${reason}，将记录到norecord`);
        log.warn(`${CONSTANTS.LOG_MODULES.PATH}[材料路径] 本次获得: ${JSON.stringify(materialCountDifferences)}`);
        
        const noRecordContent = generateRecordContent(
          pathingFilePath,
          pathName,
          startTime,
          timing.endTime,
          runTime,
          `时间成本异常: ${actualPerTime.toFixed(4)}秒/个 (平均: ${perTime.toFixed(4)}秒/个, 获得数量: ${diff})`
        );
        writeContentToFile(`${noRecordDir}/${resourceName}.txt`, noRecordContent);
        
        Object.entries(materialCountDifferences).forEach(([name, diff]) => {
          if (!isNaN(diff) && diff !== null) {
            globalAccumulatedDifferences[name] = (globalAccumulatedDifferences[name] || 0) + diff;
            materialAccumulatedDifferences[resourceName][name] = (materialAccumulatedDifferences[resourceName][name] || 0) + diff;
          }
        });
        
        await sleep(1);
        return {
          ...context,
          currentMaterialName,
          flattenedLowCountMaterials: updatedFlattened,
          materialAccumulatedDifferences,
          globalAccumulatedDifferences
        };
      }

      if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}材料路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
      
      const normalRecOutcome = recordRunTime(resourceName, pathName, timing.startTime, timing.endTime, runTime, recordDir, materialCountDifferences, pathingFilePath, noRecordDir);
      applyZeroRecordDecay(resourceName, pathingFilePath, recordDir, normalRecOutcome, isRespawn, pathRecordCache);
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
 * @param {Object} timeCost - 时间成本范围对象 {min, max}
 * @param {Object[]} flattenedLowCountMaterials - 低数量材料列表
 * @param {string|null} currentMaterialName - 当前处理的材料名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @param {string} imagesDir - 图像目录
 * @param {string} endTimeStr - 指定终止时间
 * @returns {Object} 处理结果
 */
async function processAllPaths(allPaths, CDCategories, materialCategoryMap, timeCost, flattenedLowCountMaterials, currentMaterialName, recordDir, noRecordDir, imagesDir, endTimeStr, pathingMode = null, maxRunTimeSec = null, externalCache = null) {
  try {
    // 如果没有传入pathingMode，使用全局变量（向后兼容）
    const mode = pathingMode || globalThis.pathingMode;
    
    if (debugLog) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[processAllPaths] 开始处理，allPaths长度: ${allPaths.length}`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[processAllPaths] state.cancelRequested: ${state.cancelRequested}`);
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[processAllPaths] mode.estimateMode: ${mode?.estimateMode}`);
    }
    
    const globalAccumulatedDifferences = {};
    const materialAccumulatedDifferences = {};
    const pathRecordCache = externalCache || {}; 
    
    if (mode.estimateMode) {
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
        const lastEndTime = getLastRunEndTime(resourceKey, pathName, recordDir, noRecordDir, pathingFilePath, pathRecordCache);
        const canRunCD = canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName);
        
        const pathCheckResult = checkPathNameFrequency(resourceKey, pathName, recordDir, false, pathingFilePath, pathRecordCache);
        
        const perTime = calculatePerTime(
          resourceKey,
          pathName,
          recordDir,
          noRecordDir,
          false,
          pathRecordCache,
          pathingFilePath,
          true
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
            estimatedTimeSum: 0,
            thresholdPerTimeSum: 0,
            thresholdPerTimeCount: 0,
            thresholdPerTimeList: [],
            thresholdEstimatedTimeSum: 0,
            thresholdPerTimeWithTimeList: []
          };
        }
        
        resourceAnalysis[resourceKey].total++;
        totalPaths++;
        
        if (!canRunCD) {
          failedCD++;
        } else if (!(pathCheckResult === true || pathCheckResult.valid)) {
          failedFrequency++;
        } else if (perTime === null) {
          insufficientRecords++;
        } else if (isTimeCostOk) {
          passedTimeCost++;
        } else {
          failedTimeCost++;
        }
        
        const isNotZeroExceeded = pathCheckResult === true || pathCheckResult.valid;
        
        if (isNotZeroExceeded) {
          const estimatedTime = estimatePathTotalTime(entry, recordDir, noRecordDir, pathRecordCache);
          
          if (perTime !== null && perTime > 0) {
            resourceAnalysis[resourceKey].thresholdPerTimeSum += perTime;
            resourceAnalysis[resourceKey].thresholdPerTimeCount++;
            resourceAnalysis[resourceKey].thresholdPerTimeList.push(perTime);
            resourceAnalysis[resourceKey].thresholdEstimatedTimeSum += estimatedTime;
            resourceAnalysis[resourceKey].thresholdPerTimeWithTimeList.push({ perTime, estimatedTime });
          }
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
      
      // log.info(`${CONSTANTS.LOG_MODULES.PATH}\n各材料平均时间成本及达标情况：`);
      for (const [resourceKey, data] of Object.entries(resourceAnalysis)) {
        const avgThresholdPerTime = data.thresholdPerTimeCount > 0 ? (data.thresholdPerTimeSum / data.thresholdPerTimeCount).toFixed(4) : '无记录';
        
        const minValue = timeCostStats[resourceKey]?.percentiles?.[timeCost.min];
        const maxValue = timeCostStats[resourceKey]?.percentiles?.[timeCost.max];
        const percentileItems = (minValue !== undefined && maxValue !== undefined)
          ? data.thresholdPerTimeWithTimeList.filter(item => item.perTime >= minValue && item.perTime < maxValue)
          : [];
        const avgThresholdPercentile = percentileItems.length > 0 
          ? (percentileItems.reduce((sum, item) => sum + item.perTime, 0) / percentileItems.length).toFixed(4) 
          : '无达标';
        const percentileEstimatedTimeSum = percentileItems.reduce((sum, item) => sum + item.estimatedTime, 0);
        
        const thresholdEstimatedTimeSum = data.thresholdPerTimeWithTimeList.reduce((sum, item) => sum + item.estimatedTime, 0);
        const totalEstimatedTime = formatTime(data.estimatedTimeSum);
        const thresholdEstimatedTime = formatTime(thresholdEstimatedTimeSum);
        const percentileEstimatedTime = formatTime(percentileEstimatedTimeSum);
        const avgQualifiedPerTime = data.qualified > 0 ? (data.qualifiedPerTimeSum / data.qualified).toFixed(4) : '无达标';
        
        const isMora = resourceKey === '摩拉';
        
        // log.info(`${CONSTANTS.LOG_MODULES.PATH}  --------------------------------------`);
        // log.info(`${CONSTANTS.LOG_MODULES.PATH}  ${resourceKey}:`);
        // log.info(`${CONSTANTS.LOG_MODULES.PATH}    达标平均：${avgQualifiedPerTime}`);
        
        if (isMora && data.thresholdPerTimeWithTimeList.length > 0) {
          const estimatedMora = data.thresholdPerTimeWithTimeList.reduce((sum, item) => {
            return sum + Math.round(item.estimatedTime / item.perTime);
          }, 0);
          // log.info(`${CONSTANTS.LOG_MODULES.PATH}    所有记录平均（排除0记录超限）：${avgThresholdPerTime}，预计：${estimatedMora.toLocaleString()}摩拉，耗时：${thresholdEstimatedTime}`);
        } else {
          // log.info(`${CONSTANTS.LOG_MODULES.PATH}    所有记录平均（排除0记录超限）：${avgThresholdPerTime}`);
        }
        
        if (isMora && percentileItems.length > 0) {
          const estimatedMoraByThreshold = Math.round(percentileEstimatedTimeSum / parseFloat(avgThresholdPercentile));
          const timeCostDisplay = timeCost.min === 0 && timeCost.max === 101 ? '100' : 
                                  timeCost.min === 0 ? `${timeCost.max}` :
                                  timeCost.max === 101 ? `${timeCost.min}~` :
                                  `${timeCost.min}~${timeCost.max}`;
          // log.info(`${CONSTANTS.LOG_MODULES.PATH}    ${timeCostDisplay}%分位阈值：${minValue?.toFixed(4)}~${maxValue?.toFixed(4)}，达标路径平均：${avgThresholdPercentile}，预计：${estimatedMoraByThreshold.toLocaleString()}摩拉，耗时：${percentileEstimatedTime}`);
        } else {
          const timeCostDisplay = timeCost.min === 0 && timeCost.max === 101 ? '100' : 
                                  timeCost.min === 0 ? `${timeCost.max}` :
                                  timeCost.max === 101 ? `${timeCost.min}~` :
                                  `${timeCost.min}~${timeCost.max}`;
          // log.info(`${CONSTANTS.LOG_MODULES.PATH}    ${timeCostDisplay}%分位阈值：${minValue?.toFixed(4)}~${maxValue?.toFixed(4)}`);
        }
      }
      
      // if (debugLog) {
        const timeCostDisplay = timeCost.min === 0 && timeCost.max === 101 ? '100' : 
                                timeCost.min === 0 ? `${timeCost.max}` :
                                timeCost.max === 101 ? `${timeCost.min}~` :
                                `${timeCost.min}~${timeCost.max}`;
        log.info(`${CONSTANTS.LOG_MODULES.PATH}\n===== 时间成本系数测算数据 =====`);
        log.info(`${CONSTANTS.LOG_MODULES.PATH}生成${timeCost.min}%到${timeCost.max}%的时间成本系数数据，间隔1%：`);
        
        const moraData = [];
        
        for (let p = timeCost.min; p <= timeCost.max; p++) {
          let totalEstimatedMora = 0;
          let totalEstimatedTime = 0;
          
          for (const [resourceKey, data] of Object.entries(resourceAnalysis)) {
            const isMora = resourceKey === '摩拉';
            
            if (isMora && data.thresholdPerTimeWithTimeList.length > 0) {
              const thresholdValue = timeCostStats[resourceKey]?.percentiles?.[p];
              const percentileItems = thresholdValue !== undefined
                ? data.thresholdPerTimeWithTimeList.filter(item => item.perTime < thresholdValue)
                : [];
              
              if (percentileItems.length > 0) {
                const percentileEstimatedTimeSum = percentileItems.reduce((sum, item) => sum + item.estimatedTime, 0);
                const estimatedMoraByThreshold = percentileItems.reduce((sum, item) => {
                  return sum + Math.round(item.estimatedTime / item.perTime);
                }, 0);
                
                totalEstimatedMora += estimatedMoraByThreshold;
                totalEstimatedTime += percentileEstimatedTimeSum;
              }
            }
          }
          
          moraData.push({ percent: p, mora: totalEstimatedMora, time: totalEstimatedTime });
        }
        
        const uniqueMoraData = [];
        const seenMora = new Set();
        
        for (const data of moraData) {
          const key = `${data.mora}_${data.time}`;
          if (!seenMora.has(key)) {
            seenMora.add(key);
            uniqueMoraData.push(data);
          }
        }
        
        for (const data of uniqueMoraData) {
          log.info(`${CONSTANTS.LOG_MODULES.PATH}${data.percent}%: ${data.mora.toLocaleString()}摩拉，耗时：${formatTime(data.time)}`);
        }
        
        log.info(`${CONSTANTS.LOG_MODULES.PATH}===== 时间成本系数测算数据结束（共${uniqueMoraData.length}组不同数据）=====\n`);
      // }
      
      const qualifiedRatio = totalPaths > 0 ? ((totalQualifiedPaths / totalPaths) * 100).toFixed(1) : 0;
      const timeCostStr = timeCost.min === 0 && timeCost.max === 101 ? '100' : 
                          timeCost.min === 0 ? `${timeCost.max}` :
                          timeCost.max === 101 ? `${timeCost.min}~` :
                          `${timeCost.min}~${timeCost.max}`;
      log.info(`${CONSTANTS.LOG_MODULES.PATH}===== 测算模式分析结果 =====\n时间成本:${timeCostStr}%，总路径:${totalPaths}\nCD冷却中:${failedCD}，CD满足但记录不足:${insufficientRecords}，cost不达标:${failedTimeCost}\n达标:${totalQualifiedPaths}(${qualifiedRatio}%)，预计耗时:${formatTime(totalEstimatedTime)}\n`);
      
      if (notify) {
        const estimateMsg = `【测算模式】分析完成\n总路径数：${totalPaths}\n达标路径数：${totalQualifiedPaths}\n达标占比：${totalPaths > 0 ? ((totalQualifiedPaths / totalPaths) * 100).toFixed(1) : 0}%\n预计耗时：${formatTime(totalEstimatedTime)}`;
        await sendNotificationInChunks(estimateMsg, notification.Send);
      }
      
      // 测算模式：只进行测算分析，不执行路径
      if (mode.estimateMode) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[测算模式] 测算分析完成，不执行路径`);
        state.completed = true;
        state.cancelRequested = true;
        return { 
          currentMaterialName: null, 
          flattenedLowCountMaterials: [],
          globalAccumulatedDifferences: {}
        };
      }
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
    if (debugLog) {
      const timeCostDisplay = timeCost.min === 0 && timeCost.max === 101 ? '100' : 
                              timeCost.min === 0 ? `${timeCost.max}` :
                              timeCost.max === 101 ? `${timeCost.min}~` :
                              `${timeCost.min}~${timeCost.max}`;
      log.info(`${CONSTANTS.LOG_MODULES.RECORD}[百分位数系统] 时间成本阈值：${timeCostDisplay}%`);
    }
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}[百分位数系统] 时间成本数据收集完成，共${Object.keys(timeCostStats).length}个资源`);
    
    let context = {
      mode,
      CDCategories, timeCost, recordDir, noRecordDir, imagesDir,
      materialCategoryMap, flattenedLowCountMaterials,
      currentMaterialName, materialAccumulatedDifferences,
      globalAccumulatedDifferences,
      pathRecordCache,
      timeCostStats
    };

    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[processAllPaths] 准备进入循环，allPaths长度: ${allPaths.length}`);
    if (debugLog && allPaths.length > 0) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[processAllPaths] 前3条路径: ${allPaths.slice(0, 3).map(p => basename(p.path)).join(', ')}`);
    }

    const loopStartTime = Date.now(); // 路径执行起始时间（用于执行时间上限判断）

    executedPathRecords.length = 0; // 重置本轮已执行路径记录
    let lastNotifyIndex = 0; // 已通知到的已执行记录索引

    if (notify) log.info(`${CONSTANTS.LOG_MODULES.PATH}[通知] 进度通知已启用，间隔 ${notify} 分钟，纳入路径 ${allPaths.length} 条`);

    // 预计算每条路径预估耗时，用于进度与预估剩余时间
    const pathEstimates = allPaths.map(entry => estimatePathTotalTime(entry, recordDir, noRecordDir, pathRecordCache));
    const estimatePrefix = [];
    let estimateAcc = 0;
    pathEstimates.forEach(e => { estimatePrefix.push(estimateAcc); estimateAcc += e; });
    estimatePrefix.push(estimateAcc);
    let totalEstimateSec = estimateAcc;
    let lastProgressNotify = Date.now();

    for (let i = 0; i < allPaths.length; i++) {
      const entry = allPaths[i];
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

      // 执行时间上限（多条件终止之一）：达到累计运行时长即停止，不开启新路径
      if (maxRunTimeSec !== null) {
        const elapsedSec = (Date.now() - loopStartTime) / 1000;
        if (elapsedSec >= maxRunTimeSec) {
          log.warn(`${CONSTANTS.LOG_MODULES.MAIN}已达执行时间上限（${(maxRunTimeSec / 3600).toFixed(4)}h，实际${(elapsedSec / 3600).toFixed(4)}h），停止路径处理`);
          state.cancelRequested = true;
          break;
        }
      }

      if (skipPath) break;

      const { path: pathingFilePath, resourceName, monsterName } = entry;
      const pathName = basename(pathingFilePath);

      // 进度与预估剩余时间：若存在执行时间上限，取「跑完剩余路径」与「达到上限」更先触发者
      const remainPathSec = Math.max(0, totalEstimateSec - estimatePrefix[i + 1]);
      const elapsedSecNow = (Date.now() - loopStartTime) / 1000;
      let remainSec = remainPathSec;
      let maxRunRemain = null;
      if (maxRunTimeSec !== null) {
        maxRunRemain = maxRunTimeSec - elapsedSecNow;
        if (maxRunRemain < remainSec) remainSec = maxRunRemain;
      }
      const remainMin = Math.ceil(Math.max(0, remainSec) / 60);
      const runLimitNote = (maxRunTimeSec !== null && maxRunRemain !== null && maxRunRemain <= remainPathSec) ? '（受执行时间上限约束）' : '';
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[进度] 第 ${i + 1}/${allPaths.length} 条 | 已完成 ${i}/${allPaths.length} | 预估剩余约 ${remainMin} 分钟${runLimitNote}`);

      if (debugLog) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[循环处理] 路径: ${pathName}, resourceName: ${resourceName}, monsterName: ${monsterName}`);
      }

      // 周期通知：按间隔推送已执行路径
      if (notify && (Date.now() - lastProgressNotify) >= notify * 60000) {
        const elapsedNow = (Date.now() - loopStartTime) / 1000;
        const rpSec = Math.max(0, totalEstimateSec - estimatePrefix[i + 1]);
        let rs = rpSec;
        let mr = null;
        if (maxRunTimeSec !== null) {
          mr = maxRunTimeSec - elapsedNow;
          if (mr < rs) rs = mr;
        }
        const rm = Math.ceil(Math.max(0, rs) / 60);
        const note = (maxRunTimeSec !== null && mr !== null && mr <= rpSec) ? '（受执行时间上限约束）' : '';
        const newExecuted = executedPathRecords.slice(lastNotifyIndex);
        let progressMsg = `【进度】已完成 ${i}/${allPaths.length}，预估剩余约 ${rm} 分钟${note}`;
        if (newExecuted.length > 0) {
          progressMsg += '\n已执行：\n' + newExecuted.map(r => `  ${r.name}（${formatTime(r.runTime)}）`).join('\n');
        }
        await sendNotificationInChunks(progressMsg, notification.Send);
        lastNotifyIndex = executedPathRecords.length;
        lastProgressNotify = Date.now();
      }

      try {
        if (monsterName) {
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

    // 全部跑完但未到下次通知间隔：补发一次进度通知（覆盖最后执行的路径）
    if (notify && lastNotifyIndex < executedPathRecords.length) {
      const finalExecuted = executedPathRecords.slice(lastNotifyIndex);
      let progressMsg = `【进度】全部完成，共 ${allPaths.length} 条\n已执行：\n` + finalExecuted.map(r => `  ${r.name}（${formatTime(r.runTime)}）`).join('\n');
      await sendNotificationInChunks(progressMsg, notification.Send);
      lastNotifyIndex = executedPathRecords.length;
    }

    if (context.currentMaterialName) {
      if (materialAccumulatedDifferences[context.currentMaterialName]) {
        const finalMsg = `目标[${context.currentMaterialName}]收集完成，累计获取：${JSON.stringify(materialAccumulatedDifferences[context.currentMaterialName])}`;
        await sendNotificationInChunks(finalMsg, notification.Send);
      }
    }

    return { 
      currentMaterialName: context.currentMaterialName, 
      flattenedLowCountMaterials: context.flattenedLowCountMaterials,
      globalAccumulatedDifferences: context.globalAccumulatedDifferences
    };

  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.PATH}路径处理整体错误：${error.message}`);
    throw error;
  } finally {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}路径组处理结束`);
    state.completed = true;
  }
}
