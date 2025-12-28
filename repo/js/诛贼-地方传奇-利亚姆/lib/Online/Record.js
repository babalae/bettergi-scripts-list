// =========================================================================
//                       Record.js - 数据记录与文件管理模块
// =========================================================================
// 此模块包含数据记录、文件读写、记录管理等数据持久化功能
// 依赖：file API, Utils.js, PathManager.js

var Record = {
    // === 常量定义 ===
    BASE_RECORDS_DIR: 'records',
    DATA_DIR: 'data',
    BACKUP_DIR: 'backups',
    LOG_DIR: 'logs',
    
    // === 初始化函数 ===
    
    /**
     * 初始化记录模块
     */
    init: function() {
        log.info('初始化记录模块...');
        
        // 确保必要的文件夹存在
        this._ensureDirectories();
        
        // 初始化记录文件
        this._initRecordFiles();
        
        log.info('记录模块初始化完成');
    },
    
    /**
     * 确保必要的目录存在
     */
    _ensureDirectories: function() {
        const directories = [
            this.BASE_RECORDS_DIR,
            this.DATA_DIR,
            this.BACKUP_DIR,
            this.LOG_DIR
        ];
        
        for (const dir of directories) {
            try {
                file.ReadPathSync(dir);
                log.debug(`目录已存在: ${dir}`);
            } catch (error) {
                log.warn(`目录不存在: ${dir}，请手动创建或确保应用有创建权限`);
            }
        }
    },
    
    /**
     * 初始化记录文件
     */
    _initRecordFiles: function() {
        const requiredFiles = [
            {
                path: `${this.BASE_RECORDS_DIR}/global_stats.json`,
                defaultContent: {
                    total_runs: 0,
                    total_time_minutes: 0,
                    total_mora_gained: 0,
                    total_enemies_killed: 0,
                    last_run: null,
                    last_update: new Date().toISOString()
                }
            },
            {
                path: `${this.BASE_RECORDS_DIR}/account_records.json`,
                defaultContent: {}
            },
            {
                path: `${this.DATA_DIR}/settings_backup.json`,
                defaultContent: {}
            }
        ];
        
        for (const fileInfo of requiredFiles) {
            this._ensureFileExists(fileInfo.path, fileInfo.defaultContent);
        }
    },
    
    /**
     * 确保文件存在，不存在则创建
     */
    _ensureFileExists: function(filePath, defaultContent = {}) {
        try {
            file.ReadTextSync(filePath);
            log.debug(`文件已存在: ${filePath}`);
        } catch (error) {
            log.info(`创建文件: ${filePath}`);
            try {
                file.WriteTextSync(filePath, JSON.stringify(defaultContent, null, 2));
            } catch (writeError) {
                log.error(`无法创建文件 ${filePath}: ${writeError.message}`);
            }
        }
    },
    
    // === 数据记录函数 ===
    
    /**
     * 记录运行数据
     * @param {Object} data - 要记录的数据
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @returns {Promise<boolean>} 是否记录成功
     */
    logData: async function(data, recordType = 'general', accountName = 'default') {
        try {
            // 准备记录数据
            const recordData = {
                timestamp: new Date().toISOString(),
                account: accountName,
                type: recordType,
                data: data
            };
            
            // 确定文件路径
            let recordFilePath;
            switch (recordType) {
                case 'combat':
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_combat.json`;
                    break;
                case 'mining':
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_mining.json`;
                    break;
                case 'artifact':
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_artifact.json`;
                    break;
                case 'error':
                    recordFilePath = `${this.LOG_DIR}/${accountName}_errors.json`;
                    break;
                default:
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_general.json`;
            }
            
            // 读取现有数据
            let existingData = [];
            try {
                const fileContent = await file.readText(recordFilePath);
                existingData = JSON.parse(fileContent);
                if (!Array.isArray(existingData)) {
                    existingData = [existingData];
                }
            } catch (error) {
                existingData = [];
            }
            
            // 添加新记录
            existingData.push(recordData);
            
            // 限制记录数量（最多1000条）
            if (existingData.length > 1000) {
                existingData = existingData.slice(-1000);
            }
            
            // 写入文件
            await file.writeText(recordFilePath, JSON.stringify(existingData, null, 2));
            
            log.debug(`记录成功: ${recordType} - ${accountName}`);
            
            // 更新全局统计
            await this._updateGlobalStats(recordType, data);
            
            return true;
        } catch (error) {
            log.error(`记录数据失败: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 更新全局统计
     */
    _updateGlobalStats: async function(recordType, data) {
        try {
            const statsPath = `${this.BASE_RECORDS_DIR}/global_stats.json`;
            let stats = {};
            
            try {
                const content = await file.readText(statsPath);
                stats = JSON.parse(content);
            } catch (error) {
                stats = {
                    total_runs: 0,
                    total_time_minutes: 0,
                    total_mora_gained: 0,
                    total_enemies_killed: 0,
                    last_run: null
                };
            }
            
            // 更新统计
            stats.last_update = new Date().toISOString();
            
            if (recordType === 'combat') {
                stats.total_enemies_killed += data.enemyKills || 0;
                stats.total_mora_gained += data.moraGained || 0;
            } else if (recordType === 'mining') {
                stats.total_runs += 1;
                stats.total_time_minutes += data.durationMinutes || 0;
            }
            
            // 写入更新后的统计
            await file.writeText(statsPath, JSON.stringify(stats, null, 2));
        } catch (error) {
            log.error(`更新全局统计失败: ${error.message}`);
        }
    },
    
    /**
     * 读取记录数据
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @param {number} limit - 限制返回记录数
     * @param {number} offset - 偏移量
     * @returns {Promise<Array>} 记录数据数组
     */
    readRecords: async function(recordType = 'general', accountName = 'default', limit = 100, offset = 0) {
        try {
            // 确定文件路径
            let recordFilePath;
            switch (recordType) {
                case 'combat':
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_combat.json`;
                    break;
                case 'mining':
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_mining.json`;
                    break;
                case 'artifact':
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_artifact.json`;
                    break;
                case 'error':
                    recordFilePath = `${this.LOG_DIR}/${accountName}_errors.json`;
                    break;
                default:
                    recordFilePath = `${this.BASE_RECORDS_DIR}/${accountName}_general.json`;
            }
            
            // 读取数据
            const fileContent = await file.readText(recordFilePath);
            let records = JSON.parse(fileContent);
            
            if (!Array.isArray(records)) {
                records = [records];
            }
            
            // 应用偏移和限制
            const startIndex = Math.max(0, offset);
            const endIndex = Math.min(records.length, startIndex + limit);
            
            return records.slice(startIndex, endIndex);
        } catch (error) {
            log.warn(`读取记录失败: ${error.message}`);
            return [];
        }
    },
    
    /**
     * 查询特定条件的记录
     * @param {Object} query - 查询条件
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @returns {Promise<Array>} 匹配的记录
     */
    queryRecords: async function(query, recordType = 'general', accountName = 'default') {
        try {
            // 读取所有记录
            const allRecords = await this.readRecords(recordType, accountName, 1000, 0);
            
            // 过滤记录
            return allRecords.filter(record => {
                // 检查每个查询条件
                for (const [key, value] of Object.entries(query)) {
                    // 支持嵌套属性查询
                    const keys = key.split('.');
                    let recordValue = record;
                    
                    for (const k of keys) {
                        if (recordValue && typeof recordValue === 'object' && k in recordValue) {
                            recordValue = recordValue[k];
                        } else {
                            return false; // 属性不存在
                        }
                    }
                    
                    // 比较值
                    if (value instanceof RegExp) {
                        // 正则表达式匹配
                        if (typeof recordValue !== 'string') {
                            return false;
                        }
                        if (!value.test(recordValue)) {
                            return false;
                        }
                    } else if (typeof value === 'function') {
                        // 函数匹配
                        if (!value(recordValue)) {
                            return false;
                        }
                    } else {
                        // 精确匹配
                        if (recordValue !== value) {
                            return false;
                        }
                    }
                }
                
                return true;
            });
        } catch (error) {
            log.error(`查询记录失败: ${error.message}`);
            return [];
        }
    },
    
    /**
     * 清除旧记录
     * @param {number} daysToKeep - 保留多少天内的记录
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @returns {Promise<number>} 删除的记录数
     */
    cleanupOldRecords: async function(daysToKeep = 30, recordType = 'all', accountName = 'default') {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffISO = cutoffDate.toISOString();
            
            let deletedCount = 0;
            
            // 确定要清理的文件
            const filesToClean = [];
            if (recordType === 'all') {
                filesToClean.push(
                    `${this.BASE_RECORDS_DIR}/${accountName}_combat.json`,
                    `${this.BASE_RECORDS_DIR}/${accountName}_mining.json`,
                    `${this.BASE_RECORDS_DIR}/${accountName}_artifact.json`,
                    `${this.BASE_RECORDS_DIR}/${accountName}_general.json`,
                    `${this.LOG_DIR}/${accountName}_errors.json`
                );
            } else {
                let filePath;
                switch (recordType) {
                    case 'combat':
                        filePath = `${this.BASE_RECORDS_DIR}/${accountName}_combat.json`;
                        break;
                    case 'mining':
                        filePath = `${this.BASE_RECORDS_DIR}/${accountName}_mining.json`;
                        break;
                    case 'artifact':
                        filePath = `${this.BASE_RECORDS_DIR}/${accountName}_artifact.json`;
                        break;
                    case 'error':
                        filePath = `${this.LOG_DIR}/${accountName}_errors.json`;
                        break;
                    default:
                        filePath = `${this.BASE_RECORDS_DIR}/${accountName}_general.json`;
                }
                filesToClean.push(filePath);
            }
            
            // 清理每个文件
            for (const filePath of filesToClean) {
                try {
                    const content = await file.readText(filePath);
                    let records = JSON.parse(content);
                    
                    if (!Array.isArray(records)) {
                        continue;
                    }
                    
                    // 过滤出需要保留的记录
                    const filteredRecords = records.filter(record => {
                        if (!record.timestamp) {
                            return true; // 没有时间戳，保留
                        }
                        return record.timestamp >= cutoffISO;
                    });
                    
                    // 计算删除数量
                    deletedCount += records.length - filteredRecords.length;
                    
                    // 写入过滤后的记录
                    await file.writeText(filePath, JSON.stringify(filteredRecords, null, 2));
                    
                    log.debug(`清理文件 ${filePath}: 保留 ${filteredRecords.length} 条，删除 ${records.length - filteredRecords.length} 条`);
                    
                } catch (error) {
                    // 文件可能不存在，跳过
                    continue;
                }
            }
            
            log.info(`清理完成: 共删除 ${deletedCount} 条旧记录`);
            return deletedCount;
        } catch (error) {
            log.error(`清理旧记录失败: ${error.message}`);
            return 0;
        }
    },
    
    // === 备份与恢复函数 ===
    
    /**
     * 创建数据备份
     * @param {string} backupName - 备份名称
     * @returns {Promise<boolean>} 是否备份成功
     */
    createBackup: async function(backupName = null) {
        try {
            // 生成备份名称
            if (!backupName) {
                const now = new Date();
                backupName = `backup_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
            }
            
            const backupDir = `${this.BACKUP_DIR}/${backupName}`;
            
            // 获取所有记录文件
            const recordFiles = [];
            try {
                const baseFiles = file.ReadPathSync(this.BASE_RECORDS_DIR);
                for (const filePath of baseFiles) {
                    if (!file.IsFolder(filePath) && filePath.endsWith('.json')) {
                        recordFiles.push(filePath);
                    }
                }
            } catch (error) {
                log.warn(`无法读取记录目录: ${error.message}`);
            }
            
            // 创建备份
            let backupCount = 0;
            for (const sourceFile of recordFiles) {
                try {
                    // 提取文件名
                    const fileName = sourceFile.split('/').pop().split('\\').pop();
                    const targetFile = `${backupDir}/${fileName}`;
                    
                    // 读取源文件内容
                    const content = await file.readText(sourceFile);
                    
                    // 写入备份文件
                    await file.writeText(targetFile, content);
                    
                    backupCount++;
                } catch (error) {
                    log.warn(`备份文件失败 ${sourceFile}: ${error.message}`);
                }
            }
            
            // 记录备份元数据
            const backupMeta = {
                name: backupName,
                timestamp: new Date().toISOString(),
                file_count: backupCount,
                description: '自动备份'
            };
            
            await file.writeText(`${backupDir}/backup_meta.json`, JSON.stringify(backupMeta, null, 2));
            
            log.info(`备份创建成功: ${backupName} (${backupCount} 个文件)`);
            return true;
        } catch (error) {
            log.error(`创建备份失败: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 恢复数据备份
     * @param {string} backupName - 备份名称
     * @returns {Promise<boolean>} 是否恢复成功
     */
    restoreBackup: async function(backupName) {
        try {
            const backupDir = `${this.BACKUP_DIR}/${backupName}`;
            
            // 检查备份是否存在
            try {
                file.ReadPathSync(backupDir);
            } catch (error) {
                log.error(`备份不存在: ${backupName}`);
                return false;
            }
            
            // 读取备份文件列表
            const backupFiles = [];
            try {
                const files = file.ReadPathSync(backupDir);
                for (const filePath of files) {
                    if (!file.IsFolder(filePath) && filePath.endsWith('.json') && !filePath.endsWith('backup_meta.json')) {
                        backupFiles.push(filePath);
                    }
                }
            } catch (error) {
                log.error(`无法读取备份目录: ${error.message}`);
                return false;
            }
            
            // 恢复文件
            let restoreCount = 0;
            for (const backupFile of backupFiles) {
                try {
                    // 提取文件名
                    const fileName = backupFile.split('/').pop().split('\\').pop();
                    const targetFile = `${this.BASE_RECORDS_DIR}/${fileName}`;
                    
                    // 读取备份文件内容
                    const content = await file.readText(backupFile);
                    
                    // 写入目标文件
                    await file.writeText(targetFile, content);
                    
                    restoreCount++;
                } catch (error) {
                    log.warn(`恢复文件失败 ${backupFile}: ${error.message}`);
                }
            }
            
            log.info(`备份恢复成功: ${backupName} (${restoreCount} 个文件)`);
            return true;
        } catch (error) {
            log.error(`恢复备份失败: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 列出所有备份
     * @returns {Promise<Array>} 备份列表
     */
    listBackups: async function() {
        try {
            const backups = [];
            
            try {
                const backupDirs = file.ReadPathSync(this.BACKUP_DIR);
                
                for (const dir of backupDirs) {
                    if (file.IsFolder(dir)) {
                        const dirName = dir.split('/').pop().split('\\').pop();
                        
                        try {
                            // 读取备份元数据
                            const metaPath = `${dir}/backup_meta.json`;
                            const metaContent = await file.readText(metaPath);
                            const meta = JSON.parse(metaContent);
                            
                            backups.push({
                                name: dirName,
                                timestamp: meta.timestamp,
                                file_count: meta.file_count,
                                description: meta.description || '无描述'
                            });
                        } catch (error) {
                            // 没有元数据，使用目录信息
                            backups.push({
                                name: dirName,
                                timestamp: '未知',
                                file_count: '未知',
                                description: '无元数据'
                            });
                        }
                    }
                }
            } catch (error) {
                log.warn(`无法读取备份目录: ${error.message}`);
            }
            
            // 按时间排序（最新的在前）
            backups.sort((a, b) => {
                if (a.timestamp === '未知') return 1;
                if (b.timestamp === '未知') return -1;
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            
            return backups;
        } catch (error) {
            log.error(`列出备份失败: ${error.message}`);
            return [];
        }
    },
    
    // === 统计与分析函数 ===
    
    /**
     * 获取统计数据
     * @param {string} accountName - 账户名称
     * @returns {Promise<Object>} 统计数据
     */
    getStatistics: async function(accountName = 'default') {
        try {
            const stats = {
                account: accountName,
                generated_at: new Date().toISOString(),
                combat: await this._getCombatStats(accountName),
                mining: await this._getMiningStats(accountName),
                artifact: await this._getArtifactStats(accountName),
                general: await this._getGeneralStats(accountName)
            };
            
            return stats;
        } catch (error) {
            log.error(`获取统计失败: ${error.message}`);
            return null;
        }
    },
    
    /**
     * 获取战斗统计
     */
    _getCombatStats: async function(accountName) {
        try {
            const combatRecords = await this.readRecords('combat', accountName, 1000, 0);
            
            let totalEnemies = 0;
            let totalMora = 0;
            let totalDamage = 0;
            const enemyTypes = {};
            const dailyStats = {};
            
            for (const record of combatRecords) {
                if (record.data) {
                    totalEnemies += record.data.enemyKills || 0;
                    totalMora += record.data.moraGained || 0;
                    totalDamage += record.data.damageDealt || 0;
                    
                    // 按敌人类型统计
                    if (record.data.enemyType) {
                        enemyTypes[record.data.enemyType] = (enemyTypes[record.data.enemyType] || 0) + (record.data.enemyKills || 0);
                    }
                    
                    // 按日期统计
                    if (record.timestamp) {
                        const date = record.timestamp.split('T')[0];
                        if (!dailyStats[date]) {
                            dailyStats[date] = {
                                enemies: 0,
                                mora: 0,
                                sessions: 0
                            };
                        }
                        dailyStats[date].enemies += record.data.enemyKills || 0;
                        dailyStats[date].mora += record.data.moraGained || 0;
                        dailyStats[date].sessions += 1;
                    }
                }
            }
            
            // 计算最近7天统计
            const last7Days = {};
            const today = new Date();
            for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                last7Days[dateStr] = dailyStats[dateStr] || { enemies: 0, mora: 0, sessions: 0 };
            }
            
            return {
                total_enemies_killed: totalEnemies,
                total_mora_gained: totalMora,
                total_damage_dealt: totalDamage,
                enemy_type_distribution: enemyTypes,
                daily_stats: dailyStats,
                last_7_days: last7Days,
                record_count: combatRecords.length
            };
        } catch (error) {
            log.warn(`获取战斗统计失败: ${error.message}`);
            return {};
        }
    },
    
    /**
     * 获取挖矿统计
     */
    _getMiningStats: async function(accountName) {
        try {
            const miningRecords = await this.readRecords('mining', accountName, 1000, 0);
            
            let totalOre = 0;
            let totalTime = 0;
            const oreTypes = {};
            
            for (const record of miningRecords) {
                if (record.data) {
                    totalOre += record.data.oreCollected || 0;
                    totalTime += record.data.durationMinutes || 0;
                    
                    // 按矿石类型统计
                    if (record.data.oreType) {
                        oreTypes[record.data.oreType] = (oreTypes[record.data.oreType] || 0) + (record.data.oreCollected || 0);
                    }
                }
            }
            
            return {
                total_ore_collected: totalOre,
                total_mining_time_minutes: totalTime,
                ore_type_distribution: oreTypes,
                efficiency: totalTime > 0 ? totalOre / totalTime : 0,
                record_count: miningRecords.length
            };
        } catch (error) {
            log.warn(`获取挖矿统计失败: ${error.message}`);
            return {};
        }
    },
    
    /**
     * 获取圣遗物统计
     */
    _getArtifactStats: async function(accountName) {
        try {
            const artifactRecords = await this.readRecords('artifact', accountName, 1000, 0);
            
            let totalArtifacts = 0;
            let totalExperience = 0;
            let totalMoraFromDestroy = 0;
            const artifactTypes = {};
            
            for (const record of artifactRecords) {
                if (record.data) {
                    totalArtifacts += record.data.artifactsProcessed || 0;
                    totalExperience += record.data.experienceGained || 0;
                    totalMoraFromDestroy += record.data.moraFromDestroy || 0;
                    
                    // 按圣遗物类型统计
                    if (record.data.artifactType) {
                        artifactTypes[record.data.artifactType] = (artifactTypes[record.data.artifactType] || 0) + (record.data.artifactsProcessed || 0);
                    }
                }
            }
            
            return {
                total_artifacts_processed: totalArtifacts,
                total_experience_gained: totalExperience,
                total_mora_from_destroy: totalMoraFromDestroy,
                artifact_type_distribution: artifactTypes,
                record_count: artifactRecords.length
            };
        } catch (error) {
            log.warn(`获取圣遗物统计失败: ${error.message}`);
            return {};
        }
    },
    
    /**
     * 获取通用统计
     */
    _getGeneralStats: async function(accountName) {
        try {
            const generalRecords = await this.readRecords('general', accountName, 1000, 0);
            
            let firstRecord = null;
            let lastRecord = null;
            const activityByHour = {};
            
            for (const record of generalRecords) {
                if (!firstRecord || record.timestamp < firstRecord.timestamp) {
                    firstRecord = record;
                }
                if (!lastRecord || record.timestamp > lastRecord.timestamp) {
                    lastRecord = record;
                }
                
                // 按小时统计活动
                if (record.timestamp) {
                    const hour = new Date(record.timestamp).getHours();
                    activityByHour[hour] = (activityByHour[hour] || 0) + 1;
                }
            }
            
            return {
                first_record_date: firstRecord ? firstRecord.timestamp : null,
                last_record_date: lastRecord ? lastRecord.timestamp : null,
                total_records: generalRecords.length,
                activity_by_hour: activityByHour,
                days_active: firstRecord && lastRecord ? 
                    Math.ceil((new Date(lastRecord.timestamp) - new Date(firstRecord.timestamp)) / (1000 * 60 * 60 * 24)) : 0
            };
        } catch (error) {
            log.warn(`获取通用统计失败: ${error.message}`);
            return {};
        }
    },
    
    /**
     * 导出数据为CSV格式
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @param {string} outputPath - 输出路径
     * @returns {Promise<boolean>} 是否导出成功
     */
    exportToCSV: async function(recordType, accountName = 'default', outputPath = null) {
        try {
            const records = await this.readRecords(recordType, accountName, 10000, 0);
            
            if (records.length === 0) {
                log.warn(`没有可导出的 ${recordType} 记录`);
                return false;
            }
            
            // 确定输出路径
            if (!outputPath) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                outputPath = `${this.DATA_DIR}/export_${accountName}_${recordType}_${timestamp}.csv`;
            }
            
            // 提取所有可能的字段
            const allFields = new Set(['timestamp', 'account', 'type']);
            
            for (const record of records) {
                if (record.data && typeof record.data === 'object') {
                    this._extractFields(record.data, '', allFields);
                }
            }
            
            const fields = Array.from(allFields);
            
            // 生成CSV内容
            let csvContent = fields.join(',') + '\n';
            
            for (const record of records) {
                const row = [];
                
                for (const field of fields) {
                    let value = '';
                    
                    if (field.includes('.')) {
                        // 嵌套字段
                        const keys = field.split('.');
                        let obj = record;
                        for (const key of keys) {
                            if (obj && typeof obj === 'object' && key in obj) {
                                obj = obj[key];
                            } else {
                                obj = undefined;
                                break;
                            }
                        }
                        value = obj !== undefined ? JSON.stringify(obj).replace(/"/g, '""') : '';
                    } else {
                        // 直接字段
                        value = record[field] !== undefined ? JSON.stringify(record[field]).replace(/"/g, '""') : '';
                    }
                    
                    row.push(`"${value}"`);
                }
                
                csvContent += row.join(',') + '\n';
            }
            
            // 写入文件
            await file.writeText(outputPath, csvContent);
            
            log.info(`导出成功: ${records.length} 条记录导出到 ${outputPath}`);
            return true;
        } catch (error) {
            log.error(`导出CSV失败: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 递归提取字段名
     */
    _extractFields: function(obj, prefix, fields) {
        if (!obj || typeof obj !== 'object') {
            return;
        }
        
        for (const [key, value] of Object.entries(obj)) {
            const fieldName = prefix ? `${prefix}.${key}` : key;
            
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                this._extractFields(value, fieldName, fields);
            } else {
                fields.add(fieldName);
            }
        }
    },
    
    // === 工具函数 ===
    
    /**
     * 获取模块信息
     */
    getInfo: function() {
        return {
            version: '1.0.0',
            directories: {
                records: this.BASE_RECORDS_DIR,
                data: this.DATA_DIR,
                backups: this.BACKUP_DIR,
                logs: this.LOG_DIR
            },
            functions: [
                'logData', 'readRecords', 'queryRecords', 'cleanupOldRecords',
                'createBackup', 'restoreBackup', 'listBackups',
                'getStatistics', 'exportToCSV'
            ]
        };
    },
    
    /**
     * 重置模块（清除所有数据，慎用！）
     */
    reset: async function() {
        log.warn('正在重置记录模块，这将清除所有数据！');
        
        // 确认重置（在实际应用中可能需要用户确认）
        const confirmation = false; // 默认不确认
        
        if (!confirmation) {
            log.warn('重置操作需要确认，已取消');
            return false;
        }
        
        try {
            // 清除所有记录文件
            const dirsToClear = [this.BASE_RECORDS_DIR, this.DATA_DIR, this.BACKUP_DIR, this.LOG_DIR];
            
            for (const dir of dirsToClear) {
                try {
                    const files = file.ReadPathSync(dir);
                    for (const filePath of files) {
                        if (!file.IsFolder(filePath) && (filePath.endsWith('.json') || filePath.endsWith('.csv'))) {
                            file.DeleteSync(filePath);
                        }
                    }
                } catch (error) {
                    // 目录可能不存在或为空
                }
            }
            
            // 重新初始化
            this._initRecordFiles();
            
            log.info('记录模块已重置');
            return true;
        } catch (error) {
            log.error(`重置记录模块失败: ${error.message}`);
            return false;
        }
    }
};

// 自动初始化
if (typeof file !== 'undefined') {
    Record.init();
}