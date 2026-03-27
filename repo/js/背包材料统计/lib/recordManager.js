// ==============================================
// 记录管理模块
// ==============================================

// ==============================================
// 内容检测码生成（通用哈希逻辑）
// ==============================================
/**
 * 生成内容检测码（基于路径位置数据）
 * @param {Array} positions - 路径位置数组
 * @returns {string} 8位十六进制检测码
 */
function generateContentCode(positions) {
  try {
    const serialized = JSON.stringify(
      positions.map(pos => ({
        type: pos.type,
        x: parseFloat(pos.x).toFixed(2),
        y: parseFloat(pos.y).toFixed(2)
      }))
    );
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return ((hash >>> 0).toString(16).padStart(8, '0')).slice(-8);
  } catch (error) {
    log.warn(`生成检测码失败: ${error.message}，使用默认值`);
    return "00000000";
  }
}

/**
 * 从文件名中提取内容检测码
 * @param {string} fileName - 文件名
 * @returns {string|null} 内容检测码，未找到返回null
 */
function extractContentCodeFromFileName(fileName) {
  const match = fileName.match(/_([0-9a-fA-F]{8})\.json$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * 读取路径文件并生成内容检测码
 * @param {string} pathingFilePath - 路径文件路径
 * @returns {string} 内容检测码
 */
function generatePathContentCode(pathingFilePath) {
  try {
    const fileName = basename(pathingFilePath);
    const extractedCode = extractContentCodeFromFileName(fileName);
    if (extractedCode) {
      return extractedCode;
    }
    
    const content = safeReadTextSync(pathingFilePath);
    if (!content) {
      log.warn(`${CONSTANTS.LOG_MODULES.PATH}路径文件为空: ${pathingFilePath}`);
      return "00000000";
    }
    
    const pathData = JSON.parse(content);
    const positions = pathData.positions || [];
    
    if (!Array.isArray(positions) || positions.length === 0) {
      log.warn(`${CONSTANTS.LOG_MODULES.PATH}路径文件无有效位置数据: ${pathingFilePath}`);
      return "00000000";
    }
    
    return generateContentCode(positions);
  } catch (error) {
    log.warn(`${CONSTANTS.LOG_MODULES.PATH}生成路径检测码失败: ${error.message}`);
    return "00000000";
  }
}

// ==============================================
// 记录管理函数
// ==============================================

/**
 * 写入内容到文件（追加模式）
 * @param {string} filePath - 目标文件路径
 * @param {string} content - 要写入的内容
 */
function writeContentToFile(filePath, content) {
  try {
    let existingContent = '';
    try {
      existingContent = safeReadTextSync(filePath);
    } catch (readError) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}文件不存在或读取失败: ${filePath}`);
    }

    const updatedContent = content + existingContent;
    const result = file.writeTextSync(filePath, updatedContent, false);
    if (result) {
      log.info(`${CONSTANTS.LOG_MODULES.RECORD}记录成功: ${filePath}`);
    } else {
      log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录失败: ${filePath}`);
    }
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录失败: ${error}`);
  }
}

/**
 * 检查路径名出现频率（避免重复无效路径）
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @param {boolean} isFood - 是否为狗粮路径
 * @returns {boolean|Object} 是否允许运行（true=允许），false时返回详细信息对象
 */
function checkPathNameFrequency(resourceName, pathName, recordDir, isFood = false, pathingFilePath = null) {
  let suffix = CONSTANTS.ZERO_COUNT_SUFFIX;
  if (isFood) {
    suffix = CONSTANTS.FOOD_ZERO_EXP_SUFFIX;
  }
  const recordPath = `${recordDir}/${resourceName}${suffix}`;
  let totalCount = 0;

  const currentContentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  const hasValidContentCode = currentContentCode && currentContentCode !== "00000000";

  try {
    const content = safeReadTextSync(recordPath);
    const lines = content.split('\n');

    let currentPathName = null;
    let recordContentCode = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('路径名: ')) {
        currentPathName = line.split('路径名: ')[1];
      } else if (line.startsWith('内容检测码: ')) {
        recordContentCode = line.split('内容检测码: ')[1];
      } else if (line === '' && currentPathName && recordContentCode) {
        if (hasValidContentCode) {
          if (recordContentCode === currentContentCode) {
            totalCount++;
          }
        } else {
          if (currentPathName === pathName) {
            totalCount++;
          }
        }
        currentPathName = null;
        recordContentCode = null;
      }
    }
  } catch (error) {
    log.debug(`${CONSTANTS.LOG_MODULES.RECORD}目录${recordDir}中无${resourceName}${suffix}记录，跳过检查`);
  }

  if (totalCount >= 3) {
    const typeDesc = isFood ? "狗粮" : "普通材料";
    return {
      valid: false,
      reason: `0记录频率超限（累计${totalCount}次）`
    };
  }
  
  return true;
}

/**
 * 记录路径运行时间与材料变化
 * @param {string} resourceName - 资源名（普通材料名/怪物名）
 * @param {string} pathName - 路径名
 * @param {string} startTime - 开始时间
 * @param {string} endTime - 结束时间
 * @param {number} runTime - 运行时间（秒）
 * @param {string} recordDir - 记录目录
 * @param {Object} materialCountDifferences - 材料数量变化
 * @param {string} pathingFilePath - 路径文件路径
 */
function recordRunTime(resourceName, pathName, startTime, endTime, runTime, recordDir, materialCountDifferences = {}, pathingFilePath) {
  const recordPath = `${recordDir}/${resourceName}.txt`;
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
  const normalContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;

  try {
    if (runTime > 5) {
      const isError = typeof materialCountDifferences === 'string' || (typeof materialCountDifferences === 'object' && Object.values(materialCountDifferences).some(v => typeof v === 'string'));
      
      if (isError) {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}检测到错误状态，跳过0记录`);
        return;
      }
      
      const isMonsterPath = monsterToMaterials.hasOwnProperty(resourceName);
      if (isMonsterPath) {
        const monsterTargetMaterials = monsterToMaterials[resourceName] || [];
        let monsterMaterialsTotal = 0;
        monsterTargetMaterials.forEach(targetMat => {
          monsterMaterialsTotal += (materialCountDifferences[targetMat] || 0);
        });
        if (monsterMaterialsTotal === 0) {
          const zeroMonsterPath = `${recordDir}/${resourceName}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
          const zeroMonsterContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMonsterPath, zeroMonsterContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}怪物【${resourceName}】对应材料总数量为0，已写入单独文件: ${zeroMonsterPath}`);
        }
      }

      for (const [material, count] of Object.entries(materialCountDifferences)) {
        if (material === resourceName && count === 0) {
          const zeroMaterialPath = `${recordDir}/${material}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
          const zeroMaterialContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMaterialPath, zeroMaterialContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}材料数目为0，已写入单独文件: ${zeroMaterialPath}`);
        }
      }

      const hasZeroMaterial = Object.values(materialCountDifferences).includes(0);

      if (!hasZeroMaterial) {
        writeContentToFile(recordPath, normalContent);
      } else {
        if (hasZeroMaterial) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}存在材料数目为0的情况: ${JSON.stringify(materialCountDifferences)}`);
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}未写入正常记录: ${recordPath}`);
      }
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}运行时间小于5秒，未满足记录条件: ${recordPath}`);
    }
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录运行时间失败: ${error}`);
  }
}

/**
 * 获取上次运行结束时间
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @returns {string|null} 上次结束时间字符串（null=无记录）
 */
function getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath) {
  const checkDirs = [recordDir, noRecordDir];
  let latestEndTime = null;
  
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  const hasValidContentCode = contentCode && contentCode !== "00000000";
  
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');

  checkDirs.forEach(dir => {
    const recordPath = `${dir}/${resourceName}.txt`;
    try {
      const content = safeReadTextSync(recordPath);
      const lines = content.split('\n');

      const recordBlocks = content.split('\n\n').filter(block => block.includes('路径名: '));
      
      recordBlocks.forEach(block => {
        const blockLines = block.split('\n');
        let blockPathName = '';
        let blockContentCode = '00000000';
        let blockEndTime = null;
        
        blockLines.forEach(line => {
          if (line.startsWith('路径名: ')) {
            blockPathName = line.split('路径名: ')[1];
          } else if (line.startsWith('内容检测码: ')) {
            blockContentCode = line.split('内容检测码: ')[1] || '00000000';
          } else if (line.startsWith('结束时间: ')) {
            blockEndTime = line.split('结束时间: ')[1];
          }
        });
        
        const cleanBlockPathName = blockPathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
        
        let isMatch = false;
        if (hasValidContentCode) {
          isMatch = blockContentCode === contentCode;
        } else {
          isMatch = cleanBlockPathName === cleanPathName;
        }
        
        if (isMatch && blockEndTime) {
          const endTime = new Date(blockEndTime);
          if (!latestEndTime || endTime > new Date(latestEndTime)) {
            latestEndTime = blockEndTime;
          }
        }
      });
    } catch (error) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}目录${dir}中无${resourceName}记录，跳过检查`);
    }
  });

  return latestEndTime;
}

/**
 * 公共函数：读取路径历史记录（支持缓存复用，避免重复读文件）
 * @param {string} resourceKey - 记录键（怪物名/材料名）
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 主记录目录
 * @param {string} noRecordDir - 备用记录目录
 * @param {boolean} isFood - 是否为狗粮路径
 * @param {Object} cache - 缓存对象（单次路径处理周期内有效）
 * @returns {Array<Object>} 结构化记录列表（含runTime、quantityChange）
 */
function getHistoricalPathRecords(resourceKey, pathName, recordDir, noRecordDir, isFood = false, cache = {}, pathingFilePath) {
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  const hasValidContentCode = contentCode && contentCode !== "00000000";
  
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
  
  const isFoodSuffix = isFood ? CONSTANTS.FOOD_EXP_RECORD_SUFFIX : ".txt";
  const recordFile = `${recordDir}/${resourceKey}${isFoodSuffix}`;
  const cacheKey = `${recordFile}|${cleanPathName}|${contentCode || "00000000"}|${hasValidContentCode ? "code" : "name"}`;

  if (cache[cacheKey]) {
    if (debugLog) log.debug(`${CONSTANTS.LOG_MODULES.RECORD}从缓存复用记录：${cacheKey}`);
    return cache[cacheKey];
  }

  const records = [];
  let targetFile = recordFile;
  let content = "";

  try {
    content = safeReadTextSync(targetFile);
  } catch (mainErr) {
    targetFile = `${noRecordDir}/${resourceKey}${isFoodSuffix}`;
    try {
      content = safeReadTextSync(targetFile);
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}从备用目录读取记录：${targetFile}`);
    } catch (backupErr) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}无${resourceKey}的历史记录：${targetFile}`);
      cache[cacheKey] = records;
      return records;
    }
  }

  const lines = content.split('\n');
  const recordBlocks = content.split('\n\n').filter(block => block.includes('路径名: '));
  
  recordBlocks.forEach(block => {
    const blockLines = block.split('\n').map(line => line.trim()).filter(line => line);
    let runTime = 0;
    let quantityChange = {};
    let isTargetPath = false;
    let recordContentCode = "00000000";

    blockLines.forEach(line => {
      if (line.startsWith('路径名: ')) {
        const recordPathName = line.split('路径名: ')[1];
        const cleanRecordPathName = recordPathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
        if (cleanRecordPathName === cleanPathName) {
          isTargetPath = true;
        }
      }
      if (line.startsWith('内容检测码: ')) {
        recordContentCode = line.split('内容检测码: ')[1] || "00000000";
      }
      if (line.startsWith('运行时间: ')) {
        runTime = parseInt(line.split('运行时间: ')[1].split('秒')[0], 10) || 0;
      }
      if (line.startsWith('本次EXP获取: ')) {
        const exp = parseInt(line.split('本次EXP获取: ')[1], 10) || 0;
        quantityChange = { exp: exp };
      } else if (line.startsWith('数量变化: ')) {
        try {
          quantityChange = JSON.parse(line.split('数量变化: ')[1]) || {};
        } catch (e) {
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}解析数量变化失败：${line}`);
        }
      }
    });

    let shouldInclude = false;
    if (hasValidContentCode) {
      shouldInclude = recordContentCode === contentCode && runTime > 0;
    } else {
      shouldInclude = isTargetPath && runTime > 0;
    }
    
    if (shouldInclude) {
      records.push({ runTime, quantityChange, contentCode: recordContentCode });
    }
  });

  cache[cacheKey] = records;
  if (debugLog) log.debug(`${CONSTANTS.LOG_MODULES.RECORD}读取记录并缓存：${cacheKey}（${records.length}条）`);
  return records;
}

/**
 * 基于历史runTime预估路径总耗时（默认5分钟）
 * @param {Object} entry - 路径条目
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 备用目录
 * @param {Object} cache - 缓存对象
 * @returns {number} 预估耗时（秒）
 */
function estimatePathTotalTime(entry, recordDir, noRecordDir, cache = {}) {
  const { resourceName, monsterName, path: pathingFilePath } = entry;
  const pathName = basename(pathingFilePath);
  const isFood = resourceName && isFoodResource(resourceName);
  let resourceKey = isFood ? resourceName : (monsterName || resourceName);

  if (!resourceKey) {
    log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}无资源关联，默认按120秒（2分钟）预估`);
    return 120;
  }

  const historicalRecords = getHistoricalPathRecords(
    resourceKey, 
    pathName, 
    recordDir, 
    noRecordDir, 
    isFood, 
    cache,
    pathingFilePath
  );

  if (historicalRecords.length === 0) {
    log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName} 无正常运行记录，默认耗时120秒`);
    return 120;
  }

  const recentRecords = [...historicalRecords].reverse().slice(0, 5);
  const avgRunTime = Math.round(
    recentRecords.reduce((sum, record) => sum + record.runTime, 0) / recentRecords.length
  );

  log.debug(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}历史runTime（最近5条）：${recentRecords.map(r => r.runTime)}秒，预估耗时：${avgRunTime}秒`);
  return avgRunTime;
}
