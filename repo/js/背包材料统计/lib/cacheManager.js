// ==============================================
// 全局缓存管理模块
// ==============================================

/**
 * 全局缓存管理器
 * 用于缓存路径文件、CD配置、记录文件等，减少重复IO操作
 */
var GlobalCacheManager = {
  // 路径文件缓存
  pathFilesCache: new Map(),
  
  // CD配置缓存
  cdConfigCache: new Map(),
  
  // 记录文件缓存
  recordFilesCache: new Map(),
  
  // 记录文件索引
  recordFileIndexes: new Map(),
  
  // 距离缓存
  distanceCache: new Map(),
  
  // 缓存统计
  stats: {
    pathFilesHits: 0,
    pathFilesMisses: 0,
    cdConfigHits: 0,
    cdConfigMisses: 0,
    recordFilesHits: 0,
    recordFilesMisses: 0,
    distanceHits: 0,
    distanceMisses: 0
  },

  /**
   * 获取路径文件列表（带缓存）
   * @param {string} directory - 目录路径
   * @param {number} depth - 深度
   * @param {number} maxDepth - 最大深度
   * @param {string[]} includeExtensions - 包含的扩展名
   * @returns {string[]} 文件路径列表
   */
  getPathFiles(directory, depth = 0, maxDepth = 6, includeExtensions = ['.json']) {
    const cacheKey = `${directory}|${depth}|${maxDepth}|${includeExtensions.join(',')}`;
    
    if (this.pathFilesCache.has(cacheKey)) {
      this.stats.pathFilesHits++;
      if (debugLog) log.debug(`[缓存] 路径文件缓存命中: ${cacheKey}`);
      return this.pathFilesCache.get(cacheKey);
    }
    
    this.stats.pathFilesMisses++;
    const files = readAllFilePaths(directory, depth, maxDepth, includeExtensions);
    this.pathFilesCache.set(cacheKey, files);
    
    if (debugLog) log.debug(`[缓存] 路径文件缓存写入: ${cacheKey}, 数量: ${files.length}`);
    return files;
  },

  /**
   * 获取CD配置（带缓存）
   * @param {string} category - CD分类
   * @returns {Object|null} CD配置
   */
  getCDConfig(category) {
    if (this.cdConfigCache.has(category)) {
      this.stats.cdConfigHits++;
      if (debugLog) log.debug(`[缓存] CD配置缓存命中: ${category}`);
      return this.cdConfigCache.get(category);
    }
    
    this.stats.cdConfigMisses++;
    const filePath = `${CONSTANTS.MATERIAL_CD_DIR}/${category}.txt`;
    const content = safeReadTextSync(filePath);
    
    if (!content) {
      this.cdConfigCache.set(category, null);
      return null;
    }
    
    const config = parseMaterialContent(content);
    this.cdConfigCache.set(category, config);
    
    if (debugLog) log.debug(`[缓存] CD配置缓存写入: ${category}`);
    return config;
  },

  /**
   * 批量获取CD配置（带缓存）
   * @returns {Object} 所有CD配置
   */
  getAllCDConfigs() {
    const cdFilePaths = readAllFilePaths(CONSTANTS.MATERIAL_CD_DIR, 0, 1, ['.txt']);
    const allConfigs = {};
    
    for (const filePath of cdFilePaths) {
      const categoryName = basename(filePath).replace('.txt', '');
      const config = this.getCDConfig(categoryName);
      if (config) {
        allConfigs[categoryName] = config;
      }
    }
    
    return allConfigs;
  },

  /**
   * 获取记录文件内容（带缓存）
   * @param {string} filePath - 文件路径
   * @returns {string|null} 文件内容
   */
  getRecordFile(filePath) {
    if (this.recordFilesCache.has(filePath)) {
      this.stats.recordFilesHits++;
      if (debugLog) log.debug(`[缓存] 记录文件缓存命中: ${basename(filePath)}`);
      return this.recordFilesCache.get(filePath);
    }
    
    this.stats.recordFilesMisses++;
    const content = safeReadTextSync(filePath);
    
    if (content) {
      this.recordFilesCache.set(filePath, content);
      if (debugLog) log.debug(`[缓存] 记录文件缓存写入: ${basename(filePath)}, 长度: ${content.length}`);
    }
    
    return content;
  },

  /**
   * 批量预加载记录文件
   * @param {string[]} filePaths - 文件路径列表
   */
  preloadRecordFiles(filePaths) {
    const loadedCount = { success: 0, failed: 0 };
    
    for (const filePath of filePaths) {
      try {
        const content = safeReadTextSync(filePath);
        if (content) {
          this.recordFilesCache.set(filePath, content);
          loadedCount.success++;
        }
      } catch (error) {
        loadedCount.failed++;
      }
    }
    
    if (debugLog) log.info(`[缓存] 批量预加载记录文件: 成功${loadedCount.success}个, 失败${loadedCount.failed}个`);
    return loadedCount;
  },

  /**
   * 创建记录文件索引
   * @param {string} filePath - 文件路径
   * @returns {Object|null} 索引对象
   */
  createRecordFileIndex(filePath) {
    if (this.recordFileIndexes.has(filePath)) {
      return this.recordFileIndexes.get(filePath);
    }
    
    const content = this.getRecordFile(filePath);
    if (!content) return null;
    
    const lines = content.split('\n');
    const index = {
      pathNames: [],
      contentCodes: [],
      recordBlocks: [],
      lineIndices: []
    };
    
    let currentBlock = [];
    let currentPathName = null;
    let currentContentCode = null;
    let blockStartLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('路径名: ')) {
        currentPathName = line.split('路径名: ')[1].trim();
      } else if (line.startsWith('内容检测码: ')) {
        currentContentCode = line.split('内容检测码: ')[1].trim() || '00000000';
      } else if (line === '' && currentPathName && currentContentCode) {
        index.pathNames.push(currentPathName);
        index.contentCodes.push(currentContentCode);
        index.recordBlocks.push(currentBlock.join('\n'));
        index.lineIndices.push(blockStartLine);
        
        currentBlock = [];
        currentPathName = null;
        currentContentCode = null;
        blockStartLine = i + 1;
      } else {
        currentBlock.push(line);
      }
    }
    
    this.recordFileIndexes.set(filePath, index);
    if (debugLog) log.debug(`[缓存] 记录文件索引创建: ${basename(filePath)}, 记录数: ${index.recordBlocks.length}`);
    
    return index;
  },

  /**
   * 获取距离（带缓存）
   * @param {Object} point1 - 点1 {x, y}
   * @param {Object} point2 - 点2 {x, y}
   * @returns {number} 距离
   */
  getDistance(point1, point2) {
    const key = `${point1.x.toFixed(2)},${point1.y.toFixed(2)}|${point2.x.toFixed(2)},${point2.y.toFixed(2)}`;
    const reverseKey = `${point2.x.toFixed(2)},${point2.y.toFixed(2)}|${point1.x.toFixed(2)},${point1.y.toFixed(2)}`;
    
    if (this.distanceCache.has(key)) {
      this.stats.distanceHits++;
      return this.distanceCache.get(key);
    }
    
    if (this.distanceCache.has(reverseKey)) {
      this.stats.distanceHits++;
      return this.distanceCache.get(reverseKey);
    }
    
    this.stats.distanceMisses++;
    const distance = calculateDistance(point1, point2);
    this.distanceCache.set(key, distance);
    this.distanceCache.set(reverseKey, distance);
    
    return distance;
  },

  /**
   * 清理过期缓存
   * @param {string} type - 缓存类型 'all'|'pathFiles'|'cdConfig'|'recordFiles'|'distance'
   */
  clearCache(type = 'all') {
    const clearCount = { pathFiles: 0, cdConfig: 0, recordFiles: 0, distance: 0 };
    
    if (type === 'all' || type === 'pathFiles') {
      clearCount.pathFiles = this.pathFilesCache.size;
      this.pathFilesCache.clear();
    }
    
    if (type === 'all' || type === 'cdConfig') {
      clearCount.cdConfig = this.cdConfigCache.size;
      this.cdConfigCache.clear();
    }
    
    if (type === 'all' || type === 'recordFiles') {
      clearCount.recordFiles = this.recordFilesCache.size;
      this.recordFilesCache.clear();
      this.recordFileIndexes.clear();
    }
    
    if (type === 'all' || type === 'distance') {
      clearCount.distance = this.distanceCache.size;
      this.distanceCache.clear();
    }
    
    if (debugLog) log.info(`[缓存] 清理缓存完成: ${JSON.stringify(clearCount)}`);
    return clearCount;
  },

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSizes: {
        pathFiles: this.pathFilesCache.size,
        cdConfig: this.cdConfigCache.size,
        recordFiles: this.recordFilesCache.size,
        recordFileIndexes: this.recordFileIndexes.size,
        distance: this.distanceCache.size
      },
      hitRates: {
        pathFiles: this.calculateHitRate(this.stats.pathFilesHits, this.stats.pathFilesMisses),
        cdConfig: this.calculateHitRate(this.stats.cdConfigHits, this.stats.cdConfigMisses),
        recordFiles: this.calculateHitRate(this.stats.recordFilesHits, this.stats.recordFilesMisses),
        distance: this.calculateHitRate(this.stats.distanceHits, this.stats.distanceMisses)
      }
    };
  },

  /**
   * 计算命中率
   * @param {number} hits - 命中次数
   * @param {number} misses - 未命中次数
   * @returns {string} 命中率百分比
   */
  calculateHitRate(hits, misses) {
    const total = hits + misses;
    if (total === 0) return '0.00%';
    return ((hits / total) * 100).toFixed(2) + '%';
  },

  /**
   * 打印缓存统计信息
   */
  printStats() {
    const stats = this.getStats();
    log.info(`[缓存] 统计信息:`);
    log.info(`  路径文件: 命中${stats.pathFilesHits}次, 未命中${stats.pathFilesMisses}次, 命中率${stats.hitRates.pathFiles}, 缓存数${stats.cacheSizes.pathFiles}`);
    log.info(`  CD配置: 命中${stats.cdConfigHits}次, 未命中${stats.cdConfigMisses}次, 命中率${stats.hitRates.cdConfig}, 缓存数${stats.cacheSizes.cdConfig}`);
    log.info(`  记录文件: 命中${stats.recordFilesHits}次, 未命中${stats.recordFilesMisses}次, 命中率${stats.hitRates.recordFiles}, 缓存数${stats.cacheSizes.recordFiles}`);
    log.info(`  距离计算: 命中${stats.distanceHits}次, 未命中${stats.distanceMisses}次, 命中率${stats.hitRates.distance}, 缓存数${stats.cacheSizes.distance}`);
  }
};