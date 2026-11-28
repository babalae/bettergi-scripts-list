// ==============================================
// 时间成本系统模块
// ==============================================

/**
 * 解析材料CD文件内容，转换为刷新时间与材料的映射
 * @param {string} content - CD文件内容
 * @returns {Object} 刷新时间（JSON字符串）到材料列表的映射
 */
function parseMaterialContent(content) {
  if (!content) {
    log.warn(`${CONSTANTS.LOG_MODULES.CD}文件内容为空`);
    return {};
  }

  const lines = content.split('\n').map(line => line.trim());
  const materialCDInfo = {};

  lines.forEach(line => {
    if (!line.includes('：')) return;

    const [refreshCD, materials] = line.split('：');
    if (!refreshCD || !materials) return;

    let refreshCDInHours;
    if (refreshCD.includes('次0点')) {
      const times = parseInt(refreshCD.split('次')[0], 10);
      if (isNaN(times)) {
        log.error(`${CONSTANTS.LOG_MODULES.CD}无效的刷新时间格式：${refreshCD}`);
        return;
      }
      refreshCDInHours = { type: 'midnight', times: times };
    } else if (refreshCD.includes('点')) {
      const hours = parseFloat(refreshCD.replace('点', ''));
      if (isNaN(hours)) {
        log.error(`${CONSTANTS.LOG_MODULES.CD}无效的刷新时间格式：${refreshCD}`);
        return;
      }
      refreshCDInHours = { type: 'specific', hour: hours };
    } else if (refreshCD.includes('小时')) {
      const hours = parseFloat(refreshCD.replace('小时', ''));
      if (isNaN(hours)) {
        log.error(`${CONSTANTS.LOG_MODULES.CD}无效的刷新时间格式：${refreshCD}`);
        return;
      }
      refreshCDInHours = hours;
    } else if (refreshCD === '即时刷新') {
      refreshCDInHours = { type: 'instant' };
    } else {
      log.error(`${CONSTANTS.LOG_MODULES.CD}未知的刷新时间格式：${refreshCD}`);
      return;
    }
    let materialList = materials
      .split(/[,，]\s*/)
      .map(material => material.trim())
      .filter(material => material !== '');

    materialCDInfo[JSON.stringify(refreshCDInHours)] = materialList;
  });

  return materialCDInfo;
}

/**
 * 格式化时间显示，根据时间大小自动选择单位
 * @param {number} seconds - 时间（秒）
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(seconds) {
  const formatValue = (value) => {
    if (value % 1 === 0) {
      return value.toString();
    }
    return value.toFixed(4);
  };
  
  if (seconds >= 86400) {
    return `${formatValue(seconds / 86400)}天`;
  } else if (seconds >= 3600) {
    return `${formatValue(seconds / 3600)}小时`;
  } else if (seconds >= 60) {
    return `${formatValue(seconds / 60)}分钟`;
  } else {
    return `${formatValue(seconds)}秒`;
  }
}

/**
 * 收集所有路径的时间成本数据（按具体材料/怪物分组）
 * @param {Object[]} allPaths - 所有路径条目
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @param {Object} cache - 缓存对象
 * @returns {Object} 按材料名/怪物名分组的时间成本数据
 */
function collectAllTimeCostData(allPaths, recordDir, noRecordDir, cache = {}) {
  const statistics = {};

  allPaths.forEach(entry => {
    const { path: pathingFilePath, resourceName, monsterName } = entry;
    const pathName = basename(pathingFilePath);
    
    const resourceKey = monsterName || resourceName;
    if (!resourceKey) return;

    const perTime = calculatePerTime(
      resourceName || monsterName,
      pathName,
      recordDir,
      noRecordDir,
      false,
      cache,
      pathingFilePath
    );

    if (perTime !== null && !isNaN(perTime) && perTime > 0) {
      if (!statistics[resourceKey]) {
        statistics[resourceKey] = [];
      }
      statistics[resourceKey].push(perTime);
    }
  });

  return statistics;
}

/**
 * 计算百分位数
 * @param {number[]} data - 数据数组
 * @param {number} percentile - 百分位数（0-101）
 * @returns {number} 百分位数值
 */
function calculatePercentile(data, percentile) {
  if (data.length === 0) return 0;

  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  if (lower === upper) return sorted[lower];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * 计算时间成本统计信息
 * @param {number[]} data - 时间成本数据数组
 * @returns {Object} 统计信息
 */
function calculateTimeCostStats(data) {
  if (data.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      percentiles: {}
    };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  const percentiles = {};
  for (let p = 0; p <= 101; p++) {
    const value = calculatePercentile(sorted, p);
    percentiles[p] = parseFloat(value.toFixed(4));
  }

  return {
    count: data.length,
    mean: parseFloat(mean.toFixed(4)),
    median: parseFloat(calculatePercentile(sorted, 50).toFixed(4)),
    stdDev: parseFloat(stdDev.toFixed(4)),
    percentiles,
    sortedValues: sorted.map(v => parseFloat(v.toFixed(4)))
  };
}

/**
 * 判断路径时间成本是否合格（基于百分位数范围）
 * @param {number} perTime - 路径的时间成本
 * @param {string} resourceKey - 资源键（材料名/怪物名）
 * @param {Object} timeCostRange - 时间成本范围对象 {min, max}
 * @param {Object} statistics - 时间成本统计数据（按资源键分组）
 * @returns {boolean} 是否合格
 */
function isTimeCostQualified(perTime, resourceKey, timeCostRange, statistics) {
  if (perTime === null || perTime === undefined) return true;

  const stats = statistics[resourceKey];
  if (!stats || stats.count === 0 || !Array.isArray(stats.sortedValues) || stats.sortedValues.length === 0) {
    log.debug(`${CONSTANTS.LOG_MODULES.RECORD}资源${resourceKey}无统计数据，默认合格`);
    return true;
  }

  // 按每路径效率排名分布：perTime 越小越高效
  // 排名百分位 = 严格小于该值的路径数 / 总数（越高效越靠前，越接近 0）
  const sortedValues = stats.sortedValues;
  let rank = 0;
  for (const v of sortedValues) {
    if (v < perTime) rank++;
  }
  const rankPercentile = rank / sortedValues.length; // 0~1

  const minPercentile = timeCostRange.min;
  const maxPercentile = timeCostRange.max;

  const minRatio = minPercentile / 100;
  const maxRatio = (maxPercentile === 101 ? 101 : maxPercentile) / 100;

  const isQualified = rankPercentile >= minRatio && rankPercentile < maxRatio;

  if (debugLog) {
    log.info(`${CONSTANTS.LOG_MODULES.RECORD}时间成本校验（效率排名）：${resourceKey} | 路径成本：${perTime.toFixed(4)} | 排名：${rank + 1}/${sortedValues.length}（百分位${(rankPercentile * 100).toFixed(2)}%） | 区间：${minPercentile}%~${maxPercentile}% | 结果：${isQualified ? '合格' : '不合格'}`);
  }

  return isQualified;
}

/**
 * 按 perTime 量化值天然分档（时间成本档次）并组织执行顺序
 * 与"效率排名"不同：同量化值=效率实质相同=一个天然档，档数由数据决定，不强制等距档数
 * 档间按 perTime 升序，档内按路径名称（地域）排序
 * @param {Array} pathPerTimes - [{ entry, perTime }]，perTime 均为有效数值
 * @param {number} digits - 量化小数位（默认3）
 * @returns {Array} 按天然档顺序、档内名称排序展平后的路径条目
 */
function arrangePathsByNaturalTiers(pathPerTimes, digits = 3) {
  if (!Array.isArray(pathPerTimes) || pathPerTimes.length === 0) return [];

  const groups = new Map();
  pathPerTimes.forEach(p => {
    const key = p.perTime.toFixed(digits);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });

  const keys = [...groups.keys()].sort((a, b) => parseFloat(a) - parseFloat(b));

  const result = [];
  keys.forEach(k => {
    groups.get(k).sort((a, b) => basename(a.entry.path).localeCompare(basename(b.entry.path), 'zh'));
    groups.get(k).forEach(p => result.push(p.entry));
  });
  return result;
}


/**
 * 计算单次时间成本（秒/单位材料）（复用缓存）
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 备用目录
 * @param {boolean} isFood - 保留参数位（兼容调用）
 * @param {Object} cache - 缓存对象
 * @returns {number|null} 时间成本
 */
function calculatePerTime(resourceName, pathName, recordDir, noRecordDir, isFood = false, cache = {}, pathingFilePath, filterExcessMaterials = false) {
  const isMonster = monsterToMaterials.hasOwnProperty(resourceName);
  
  const historicalRecords = getHistoricalPathRecords(
    resourceName, 
    pathName, 
    recordDir, 
    noRecordDir, 
    isFood, 
    cache,
    pathingFilePath,
    filterExcessMaterials
  );

  if (historicalRecords.length < 3) {
    if (debugLog) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}历史记录不足3条，无法计算时间成本`);
    return null;
  }

  const completeRecords = [];
  if (isMonster) {
    const monsterMaterials = monsterToMaterials[resourceName];
    const gradeRatios = MONSTER_GRADE_RATIOS;

    historicalRecords.forEach(record => {
      const { runTime, quantityChange } = record;
      let totalMiddleCount = 0;

      monsterMaterials.forEach((mat, index) => {
        const count = quantityChange[mat] || 0;
        totalMiddleCount += count * (gradeRatios[index] || 1);
      });

      totalMiddleCount = parseFloat(totalMiddleCount.toFixed(2));
      if (totalMiddleCount > 0) {
        completeRecords.push(parseFloat((runTime / totalMiddleCount).toFixed(3)));
      }
    });
  } else {
    historicalRecords.forEach(record => {
      const { runTime, quantityChange } = record;
      if (quantityChange[resourceName] !== undefined && quantityChange[resourceName] !== 0) {
        completeRecords.push(parseFloat((runTime / quantityChange[resourceName]).toFixed(3)));
      }
    });
  }

  if (completeRecords.length < 3) {
    if (debugLog) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}有效记录不足3条，无法计算时间成本`);
    return null;
  }

  const recentRecords = completeRecords.slice(0, 5).filter(r => !isNaN(r) && r !== Infinity);
  const mean = recentRecords.reduce((acc, val) => acc + val, 0) / recentRecords.length;
  const stdDev = Math.sqrt(recentRecords.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentRecords.length);
  const filteredRecords = recentRecords.filter(r => Math.abs(r - mean) <= 1 * stdDev);

  if (filteredRecords.length === 0) {
    log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}记录数据差异过大，无法计算有效时间成本`);
    return null;
  }

  return parseFloat((filteredRecords.reduce((acc, val) => acc + val, 0) / filteredRecords.length).toFixed(3));
}
