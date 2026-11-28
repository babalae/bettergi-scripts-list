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
 * 路径记录写入到文件（追加模式）
 * @param {string} filePath - 目标文件路径
 * @param {string} content - 要写入的内容
 */
function writeContentToFile(filePath, content) {
  try {
    let existingContent = '';
    try {
      existingContent = safeReadTextSync(filePath);
    } catch (readError) {
      // log.debug(`${CONSTANTS.LOG_MODULES.RECORD}文件不存在或读取失败: ${filePath}`);
    }

    const updatedContent = content + existingContent;
    const result = file.writeTextSync(filePath, updatedContent, false);
    if (result) {
      if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}记录成功: ${filePath}`);
    } else {
      log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录失败: ${filePath}`);
    }
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录失败: ${error}`);
  }
}

/**
 * 上限检测：统计路径在 资源名-0.txt 中累计的命中次数，达到上限（3次）即排除
 * 注：达到刷怪/掉落上限后通常是收益减少、不一定降为0
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @returns {boolean|Object} 是否允许运行（true=允许），false时返回详细信息对象
 */
function checkPathNameFrequency(resourceName, pathName, recordDir, isFood = false, pathingFilePath = null, cache = {}) {
  const suffix = CONSTANTS.ZERO_COUNT_SUFFIX;
  const recordPath = `${recordDir}/${resourceName}${suffix}`;

  const currentContentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  const hasValidContentCode = currentContentCode && currentContentCode !== "00000000";
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');

  let totalCount = 0;
  const parsedBlocks = parseRecordFileOnce(recordPath, cache);
  if (parsedBlocks) {
    parsedBlocks.forEach(p => {
      const matched = hasValidContentCode
        ? p.recordContentCode === currentContentCode
        : p.cleanRecordPathName === cleanPathName;
      if (matched) totalCount++;
    });
  }

  if (totalCount >= 3) {
    return {
      valid: false,
      reason: `达到上限（累计${totalCount}次）`
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
function recordRunTime(resourceName, pathName, startTime, endTime, runTime, recordDir, materialCountDifferences = {}, pathingFilePath, noRecordDir) {
  const recordPath = `${recordDir}/${resourceName}.txt`;
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
  const normalContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;

  let outcome = 'none'; // 本次写入结果：'normal'普通记录 / 'zero'零记录 / 'none'未记录(错误或时长不足)，供0记录衰减判定

  try {
    if (runTime > 13) {
      const isError = typeof materialCountDifferences === 'string' || (typeof materialCountDifferences === 'object' && Object.values(materialCountDifferences).some(v => typeof v === 'string'));
      
      if (isError) {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}检测到错误状态，跳过0记录`);
        return 'none';
      }
      
      const isMonsterPath = monsterToMaterials.hasOwnProperty(resourceName);
      let shouldRecordNormal = true;
      
      if (isMonsterPath) {
        const monsterTargetMaterials = monsterToMaterials[resourceName] || [];
        let monsterMaterialsTotal = 0;
        monsterTargetMaterials.forEach(targetMat => {
          monsterMaterialsTotal += (materialCountDifferences[targetMat] || 0);
        });
        
        const gradeRatios = MONSTER_GRADE_RATIOS;
        let totalMiddleCount = 0;
        monsterTargetMaterials.forEach((mat, index) => {
          const diff = materialCountDifferences[mat] || 0;
          totalMiddleCount += diff * (gradeRatios[index] || 1);
        });
        totalMiddleCount = parseFloat(totalMiddleCount.toFixed(2));
        
        if (totalMiddleCount === 0) {
          const zeroMonsterPath = `${recordDir}/${resourceName}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
          const zeroMonsterContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMonsterPath, zeroMonsterContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}怪物【${resourceName}】对应材料折算总数量为0，已写入单独文件: ${zeroMonsterPath}`);
          
          const noRecordPath = `${noRecordDir}/${resourceName}.txt`;
          writeContentToFile(noRecordPath, zeroMonsterContent);
          if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}异常路径已记录：${pathName}（运行时间${runTime.toFixed(1)}秒）`);
          shouldRecordNormal = false;
        }
      }

      for (const [material, count] of Object.entries(materialCountDifferences)) {
        if (material === resourceName && count === 0) {
          const zeroMaterialPath = `${recordDir}/${material}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
          const zeroMaterialContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMaterialPath, zeroMaterialContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}材料数目为0，已写入单独文件: ${zeroMaterialPath}`);
          
          const noRecordPath = `${noRecordDir}/${resourceName}.txt`;
          writeContentToFile(noRecordPath, zeroMaterialContent);
          // log.info(`${CONSTANTS.LOG_MODULES.RECORD}异常路径已记录：${pathName}（运行时间${runTime.toFixed(1)}秒）`);
          shouldRecordNormal = false;
        }
      }

      if (shouldRecordNormal) {
        writeContentToFile(recordPath, normalContent);
        outcome = 'normal';
      } else {
        outcome = 'zero';
      }
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}运行时间小于5秒，未满足记录条件: ${recordPath}`);
    }
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录运行时间失败: ${error}`);
  }
  return outcome;
}

/**
 * 0记录衰减：给良好表现的路径逐步抵消旧0记录（“重生/翻身”）
 * - 重生路径(isRespawn，跑前≥3条0被排除)本次写了正常记录 → 立即清除该路径最旧1条0记录
 * - 普通路径本次正常 → 合并时间线(正常文件+0文件按结束时间倒序)最近连续2条均为正常时，清除最旧1条0记录
 * 中性记录(时间成本异常/识别失败)只写noRecord、不落这两文件，天然不参与也不打断连续判定。
 * @param {string} resourceKey - 资源键(怪物名/材料名)
 * @param {string} pathingFilePath - 路径文件路径
 * @param {string} recordDir - 记录目录
 * @param {string} outcome - recordRunTime 返回：'normal'/'zero'/'none'
 * @param {boolean} isRespawn - 本条是否为重生组注入
 * @param {Object} runCache - 本轮记录解析缓存(用于失效被改文件的缓存)
 * @returns {boolean} 是否实际清除了一条
 */
function applyZeroRecordDecay(resourceKey, pathingFilePath, recordDir, outcome, isRespawn, runCache) {
  if (outcome !== 'normal' || !resourceKey || !pathingFilePath) return false;
  const zeroPath = `${recordDir}/${resourceKey}${CONSTANTS.ZERO_COUNT_SUFFIX}`;

  if (!isRespawn) {
    const freshCache = {};
    const contentCode = generatePathContentCode(pathingFilePath);
    const pathName = basename(pathingFilePath);
    const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
    const hasValid = contentCode && contentCode !== '00000000';
    const isMine = b => hasValid ? b.recordContentCode === contentCode : b.cleanRecordPathName === cleanPathName;
    const normalBlocks = (parseRecordFileOnce(`${recordDir}/${resourceKey}.txt`, freshCache) || []).filter(isMine).map(b => ({ endTime: b.endTime, type: 'normal' }));
    const zeroBlocks = (parseRecordFileOnce(zeroPath, freshCache) || []).filter(isMine).map(b => ({ endTime: b.endTime, type: 'zero' }));
    const merged = [...normalBlocks, ...zeroBlocks].filter(x => x.endTime).sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
    if (!(merged.length >= 2 && merged[0].type === 'normal' && merged[1].type === 'normal')) return false;
  }

  const cleared = removeOldestZeroRecordForPath(resourceKey, pathingFilePath, recordDir, isRespawn);
  if (cleared && runCache) {
    delete runCache[`__fileparse__|${recordDir}/${resourceKey}.txt`];
    delete runCache[`__fileparse__|${zeroPath}`];
  }
  return cleared;
}

/**
 * 从 ${resourceKey}-0.txt 中删除该路径最旧的1个记录块（文件头插，最新在前，故最旧=末尾匹配块）
 * @returns {boolean} 是否删除成功
 */
function removeOldestZeroRecordForPath(resourceKey, pathingFilePath, recordDir, isRespawn) {
  const zeroPath = `${recordDir}/${resourceKey}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
  let raw;
  try {
    raw = safeReadTextSync(zeroPath);
  } catch (e) {
    return false;
  }
  if (!raw || !raw.includes('路径名: ')) return false;

  const contentCode = generatePathContentCode(pathingFilePath);
  const pathName = basename(pathingFilePath);
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
  const hasValid = contentCode && contentCode !== '00000000';

  const blocks = raw.split('\n\n');
  let targetIdx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (!block || !block.includes('路径名: ')) continue;
    let bCode = '00000000', bName = '';
    block.split('\n').map(l => l.trim()).filter(l => l).forEach(line => {
      if (line.startsWith('内容检测码: ')) bCode = line.split('内容检测码: ')[1].trim() || '00000000';
      else if (line.startsWith('路径名: ')) bName = line.split('路径名: ')[1].trim();
    });
    const matched = hasValid
      ? (bCode === contentCode)
      : (bName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json') === cleanPathName);
    if (matched) { targetIdx = i; break; }
  }
  if (targetIdx === -1) return false;

  blocks.splice(targetIdx, 1);
  const remaining = blocks.filter(b => b && b.includes('路径名: '));
  file.writeTextSync(zeroPath, remaining.join('\n\n') + '\n\n', false);
  log.warn(`${CONSTANTS.LOG_MODULES.RECORD}[0记录衰减] ${isRespawn ? '重生成功' : '连续2条正常'}，清除 ${pathName} 最旧1条0记录，${resourceKey}-0.txt 剩余${remaining.length}条`);
  return true;
}

/**
 * 获取上次运行结束时间
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @returns {string|null} 上次结束时间字符串（null=无记录）
 */
function getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath, cache = {}) {
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  const hasValidContentCode = contentCode && contentCode !== "00000000";
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');

  let latestEndTime = null;

  [recordDir, noRecordDir].forEach(dir => {
    const recordPath = `${dir}/${resourceName}.txt`;
    const parsedBlocks = parseRecordFileOnce(recordPath, cache);
    if (!parsedBlocks) return;

    parsedBlocks.forEach(p => {
      const isMatch = hasValidContentCode
        ? p.recordContentCode === contentCode
        : p.cleanRecordPathName === cleanPathName;
      // 精简版无狗粮专区：不再按“出货证据”过滤，所有记录（含noRecord的“noRecord模式忽略”）均顺延CD
      if (isMatch && p.endTime) {
        if (!latestEndTime || new Date(p.endTime) > new Date(latestEndTime)) {
          latestEndTime = p.endTime;
        }
      }
    });
  });

  return latestEndTime;
}

/**
 * 公共函数：读取路径历史记录（支持缓存复用，避免重复读文件）
 * @param {string} resourceKey - 记录键（怪物名/材料名）
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 主记录目录
 * @param {string} noRecordDir - 备用记录目录
 * @param {boolean} isFood - 保留参数位（兼容调用）
 * @param {Object} cache - 缓存对象（单次路径处理周期内有效）
 * @param {string} pathingFilePath - 路径文件路径（用于内容检测码）
 * @param {boolean} filterExcessMaterials - 是否过滤超量材料（默认false）
 * @returns {Array<Object>} 结构化记录列表（含runTime、quantityChange）
 */
/**
 * 文件级解析缓存：同一记录文件在单次处理周期内只读盘、解析一次
 * 解析全部记录块，供各路径按需筛选；文件不存在/读失败返回 null（同样缓存，避免重复尝试）
 * @param {string} filePath - 记录文件绝对路径
 * @param {Object} cache - 缓存对象
 * @returns {Array<Object>|null} 解析后的记录块数组（文件为空返回 []，读失败返回 null）
 */
function parseRecordFileOnce(filePath, cache) {
  const fileCacheKey = `__fileparse__|${filePath}`;
  if (Object.prototype.hasOwnProperty.call(cache, fileCacheKey)) {
    return cache[fileCacheKey];
  }

  let content;
  try {
    content = safeReadTextSync(filePath);
  } catch (e) {
    cache[fileCacheKey] = null;
    return null;
  }

  const parsedBlocks = [];
  content.split('\n\n').filter(block => block.includes('路径名: ')).forEach(block => {
    let recordPathName = '';
    let recordContentCode = '00000000';
    let runTime = 0;
    let endTime = null;
    let quantityChange = {};
    let quantityRaw = ''; // 数量变化原文（noRecord里的文本型记录靠它判是否有出货）

    block.split('\n').map(l => l.trim()).filter(l => l).forEach(line => {
      if (line.startsWith('路径名: ')) {
        recordPathName = line.split('路径名: ')[1].trim();
      } else if (line.startsWith('内容检测码: ')) {
        recordContentCode = line.split('内容检测码: ')[1].trim() || '00000000';
      } else if (line.startsWith('运行时间: ')) {
        runTime = parseInt(line.split('运行时间: ')[1].split('秒')[0], 10) || 0;
      } else if (line.startsWith('结束时间: ')) {
        endTime = line.split('结束时间: ')[1].trim();
      } else if (line.startsWith('数量变化: ')) {
        const rawQuantity = line.split('数量变化: ')[1];
        quantityRaw = rawQuantity;
        try {
          quantityChange = JSON.parse(rawQuantity) || {};
        } catch (e) {
          // 非 JSON 即异常记录（noRecord模式忽略 / 时间成本异常 / 摩拉识别失败 / task canceled 等）：
          // 无数量、不参与时间成本，仅供 CD 取结束时间；异常在写入时已记录，此处不重复报警
          quantityChange = {};
        }
      }
    });

    parsedBlocks.push({
      cleanRecordPathName: recordPathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json'),
      recordContentCode,
      runTime,
      endTime,
      quantityRaw,
      quantityChange
    });
  });

  cache[fileCacheKey] = parsedBlocks;
  return parsedBlocks;
}

function getHistoricalPathRecords(resourceKey, pathName, recordDir, noRecordDir, isFood = false, cache = {}, pathingFilePath, filterExcessMaterials = false) {
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  const hasValidContentCode = contentCode && contentCode !== "00000000";
  
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
  
  const recordFile = `${recordDir}/${resourceKey}.txt`;
  const cacheKey = `${recordFile}|${cleanPathName}|${contentCode || "00000000"}|${hasValidContentCode ? "code" : "name"}`;

  if (cache[cacheKey]) {
    // if (debugLog) log.debug(`${CONSTANTS.LOG_MODULES.RECORD}从缓存复用记录：${cacheKey}`);
    return cache[cacheKey];
  }

  // 时间成本只用主目录正常记录：主目录读不到即无时间成本，绝不回退 noRecord（noRecord 仅供 CD 取结束时间）
  const parsedBlocks = parseRecordFileOnce(recordFile, cache);
  if (!parsedBlocks) {
    cache[cacheKey] = [];
    return [];
  }

  const records = [];
  parsedBlocks.forEach(p => {
    const matched = hasValidContentCode
      ? (p.recordContentCode === contentCode && p.runTime > 0)
      : (p.cleanRecordPathName === cleanPathName && p.runTime > 0);
    if (matched) {
      records.push({ runTime: p.runTime, quantityChange: p.quantityChange, contentCode: p.recordContentCode });
    }
  });

  cache[cacheKey] = records;
  // if (debugLog) log.debug(`${CONSTANTS.LOG_MODULES.RECORD}读取记录并缓存：${cacheKey}（${records.length}条）`);
  
  if (filterExcessMaterials && excessMaterialNames.length > 0) {
    const filteredRecords = records.filter(record => {
      const { quantityChange } = record;
      
      if (monsterToMaterials[resourceKey]) {
        const monsterMaterials = monsterToMaterials[resourceKey];
        const allExcess = monsterMaterials.every(mat => excessMaterialNames.includes(mat));
        return !allExcess;
      }
      
      if (quantityChange[resourceKey] !== undefined) {
        return !excessMaterialNames.includes(resourceKey);
      }
      
      return true;
    });
    
    // if (debugLog && filteredRecords.length !== records.length) {
    //   log.debug(`${CONSTANTS.LOG_MODULES.RECORD}过滤超量材料记录：${records.length}条 -> ${filteredRecords.length}条`);
    // }
    
    return filteredRecords;
  }
  
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
  let resourceKey = monsterName || resourceName;

  if (!resourceKey) {
    // log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}无资源关联，默认按120秒（2分钟）预估`);
    return 120;
  }

  const historicalRecords = getHistoricalPathRecords(
    resourceKey, 
    pathName, 
    recordDir, 
    noRecordDir, 
    false, 
    cache,
    pathingFilePath
  );

  if (historicalRecords.length === 0) {
    // if (debugLog) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName} 无正常运行记录，默认耗时120秒`);
    return 120;
  }

  // 记录文件新→旧排列，直接取前5条=最近5条（与 calculatePerTime 同口径）；不可再 reverse，否则会取到最旧5条
  const recentRecords = historicalRecords.slice(0, 5);
  const avgRunTime = Math.round(
    recentRecords.reduce((sum, record) => sum + record.runTime, 0) / recentRecords.length
  );

  // if (debugLog) log.debug(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}历史runTime（最近5条）：${recentRecords.map(r => r.runTime)}秒，预估耗时：${avgRunTime}秒`);
  return avgRunTime;
}

/**
 * 获取路径的上次运行时间（用于回滚路径筛选）
 * @param {Object} entry - 路径条目
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 备用目录
 * @returns {Date|null} 上次运行时间（无记录返回null）
 */
function getPathLastRunTime(entry, recordDir, noRecordDir, cache = {}) {
  const { resourceName, monsterName, path: pathingFilePath } = entry;
  const pathName = basename(pathingFilePath);
  let resourceKey = monsterName || resourceName;

  if (!resourceKey) {
    return null;
  }

  const lastEndTime = getLastRunEndTime(resourceKey, pathName, recordDir, noRecordDir, pathingFilePath, cache);
  return lastEndTime ? new Date(lastEndTime) : null;
}
