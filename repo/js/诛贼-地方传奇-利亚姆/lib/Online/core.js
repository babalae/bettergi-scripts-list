// =========================================================================
//                       Core.js - 核心模块
// =========================================================================
// 此模块整合了所有功能模块的公共接口，提供统一的调用入口
// 依赖：Artifact.js, Combat.js, Multiplayer.js, OCR.js, PathManager.js, 
//       Record.js, TaskManager.js, Team.js, Utils.js

// 加载所有依赖模块
eval(file.readTextSync("lib/chat/ChatClick.js"));
eval(file.readTextSync("lib/Online/Artifact.js"));
eval(file.readTextSync("lib/Online/Utils.js"));
eval(file.readTextSync("lib/Online/Team.js"));
eval(file.readTextSync("lib/Online/TaskManager.js"));
eval(file.readTextSync("lib/Online/Record.js"));
eval(file.readTextSync("lib/Online/OCR.js"));
eval(file.readTextSync("lib/Online/PathManager.js"));
eval(file.readTextSync("lib/Online/Multiplayer.js"));
// eval(file.readTextSync("lib/Online/Combat.js"));

var Core = {
    // === Artifact模块函数 ===
    
    /**
     * 初始化圣遗物模块
     */
    artifactInit: async function() {
        return await Artifact.init();
    },
    
    /**
     * 自动分解圣遗物，同时识别当前总经验（个数）
     * @returns {Promise<number>} 分解获得的经验值
     */
    decomposeArtifacts: async function() {
        return await Artifact.decomposeArtifacts();
    },
    
    /**
     * 摧毁圣遗物换摩拉
     * @param {number} times - 处理次数
     * @returns {Promise<void>}
     */
    destroyArtifacts: async function(times = 1) {
        return await Artifact.destroyArtifacts(times);
    },
    
    /**
     * 处理狗粮分解或销毁
     * @param {number} times - 处理次数
     * @returns {Promise<number>} - 处理结果
     */
    processArtifacts: async function(times = 1) {
        return await Artifact.processArtifacts(times);
    },
    
    /**
     * 识别摩拉
     * @returns {Promise<number>} - 识别到的摩拉数值
     */
    mora: async function() {
        return await Artifact.mora();
    },
    
    /**
     * 获取背包中指定矿石的数量
     * @returns {Promise<Object>} 矿石数量对象 {crystal_chunks, amethyst_lumps, condessence_crystals}
     */
    getInventory: async function() {
        return await Artifact.getInventory();
    },
    
    /**
     * 写入挖矿记录
     * @param {Object} original_inventory - 原始库存
     * @param {Object} current_inventory - 当前库存
     * @param {number} running_minutes - 运行时间（分钟）
     * @param {number} accurate_yield - 总收获量
     * @param {string} accountName - 账户名称
     * @returns {Promise<Object>} 挖矿数据
     */
    writeRecord: async function(original_inventory, current_inventory, running_minutes, accurate_yield, accountName = '默认账户') {
        return await Artifact.writeRecord(original_inventory, current_inventory, running_minutes, accurate_yield, accountName);
    },
    
    /**
     * 保存挖矿数据到本地文件
     * @param {Object} original_inventory - 原始库存
     * @param {Object} current_inventory - 当前库存
     * @param {number} running_minutes - 运行时间（分钟）
     * @param {number} accurate_yield - 总收获量
     * @returns {Promise<Object>} 挖矿数据对象
     */
    saveMiningData: async function(original_inventory, current_inventory, running_minutes, accurate_yield) {
        return await Artifact.saveMiningData(original_inventory, current_inventory, running_minutes, accurate_yield);
    },
    
    /**
     * 获取矿石图片路径映射
     * @returns {Object} 矿石图片路径映射
     */
    getOreImages: function() {
        return Artifact.ORE_IMAGES;
    },
    
    // === Utils模块函数 ===
    

    
    /**
     * 安全裁剪区域，防止越界
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} w - 宽度
     * @param {number} h - 高度
     * @returns {Object} 安全的区域对象
     */
    safeROI: function(x, y, w, h) {
        return Utils.safeROI(x, y, w, h);
    },
    
    /**
     * 防御式ROI计算，防止越界
     * @param {number} cx - 起始X坐标
     * @param {number} cy - 起始Y坐标
     * @param {number} cw - 宽度
     * @param {number} ch - 高度
     * @param {number} imgWidth - 图像宽度
     * @param {number} imgHeight - 图像高度
     * @returns {Object} 安全的ROI区域
     */
    clampROI: function(cx, cy, cw, ch, imgWidth, imgHeight) {
        return Utils.clampROI(cx, cy, cw, ch, imgWidth, imgHeight);
    },
    
    /**
     * 验证超时时间设置
     * @param {number|string} value - 用户设置的超时时间（秒）
     * @param {number} defaultValue - 默认超时时间（秒）
     * @param {string} timeoutType - 超时类型名称
     * @returns {number} - 验证后的超时时间（秒）
     */
    validateTimeoutSetting: function(value, defaultValue, timeoutType) {
        return Utils.validateTimeoutSetting(value, defaultValue, timeoutType);
    },
    
    /**
     * 滚动页面（通用）
     * @param {number} totalDistance - 总滚动距离
     * @param {number} stepDistance - 单步滚动距离
     * @param {number} delayMs - 延迟时间(毫秒)
     */
    scrollPage: async function(totalDistance, stepDistance = 10, delayMs = 5) {
        return await Utils.scrollPage(totalDistance, stepDistance, delayMs);
    },
    
    /**
     * 向下翻页（滚轮版）
     * @param {number} ok - 滚动次数
     */
    pageDown1: async function(ok = 42) {
        return await Utils.pageDown1(ok);
    },
    
    /**
     * 向下翻页（鼠标拖拽版）
     * @param {number} totalDistance - 总滚动距离
     * @param {number} stepDistance - 单步滚动距离
     * @param {number} delayMs - 延迟时间(毫秒)
     */
    pageDown2: async function(totalDistance, stepDistance = 10, delayMs = 10) {
        return await Utils.pageDown2(totalDistance, stepDistance, delayMs);
    },
    
    /**
     * 回到页面顶部
     * @param {Object} SliderTopRo - 滑块顶部识别对象
     */
    pageTop: async function(SliderTopRo) {
        return await Utils.pageTop(SliderTopRo);
    },
    
    /**
     * 向下翻页（简化版）
     * @param {number} ok - 滚动次数
     */
    pageDown: async function(ok) {
        return await Utils.pageDown(ok);
    },
    
    /**
     * 绘制并清除红色框（占位函数，实际无操作）
     * @param {Object} rect - 矩形区域
     * @param {number} duration - 持续时间(毫秒)
     */
    drawAndClearRedBox: async function(rect, duration = 500) {
        return await Utils.drawAndClearRedBox(rect, duration);
    },
    
    /**
     * 读取角色别名文件
     * @returns {Object} 别名映射对象
     */
    readAliases: function() {
        return Utils.readAliases();
    },
    
    /**
     * 安全执行函数，处理任务取消异常
     * @param {Function} fn 要执行的函数
     * @param {string} functionName 函数名称（用于日志）
     * @returns {Promise<any>} 函数执行结果
     */
    safeExecute: async function(fn, functionName = '匿名函数') {
        return await Utils.safeExecute(fn, functionName);
    },
    
    /**
     * 带超时的安全执行
     * @param {Function} fn 要执行的函数
     * @param {number} timeout 超时时间(ms)
     * @param {string} functionName 函数名称
     * @returns {Promise<any>} 函数执行结果
     */
    safeExecuteWithTimeout: async function(fn, timeout = 5000, functionName = '匿名函数') {
        return await Utils.safeExecuteWithTimeout(fn, timeout, functionName);
    },
    
    /**
     * 检查是否是任务取消错误
     * @param {Error} error 错误对象
     * @returns {boolean} 是否是任务取消错误
     */
    isTaskCanceledError: function(error) {
        return Utils.isTaskCanceledError(error);
    },
    
    // === Team模块函数 ===
    
    /**
     * 初始化队伍模块
     */
    teamInit: async function() {
        return await Team.init();
    },
    
    /**
     * 根据position自动切换4号位角色（支持双模式）
     * @param {Object} position - 位置配置对象
     */
    characterRotator: async function(position) {
        return await Team.characterRotator.run(position);
    },
    
    /**
     * 切换角色（原switchRoles函数）
     */
    switchRoles: async function() {
        return await Team.switchRoles();
    },
    
    /**
     * 切换到指定队伍
     * @param {string} partyName - 队伍名称
     * @returns {Promise<boolean>} 是否成功
     */
    switchToParty: async function(partyName) {
        return await Team.switchToParty(partyName);
    },
    
    /**
     * 获取当前队伍角色
     * @returns {Array<string>} 角色名称数组
     */
    getCurrentTeam: function() {
        return Team.getCurrentTeam();
    },
    
    // === TaskManager模块函数 ===
    
    /**
     * 初始化任务管理器
     */
    taskManagerInit: async function() {
        return TaskManager.init();
    },
    
    /**
     * 生成唯一任务ID
     * @returns {string} 任务ID
     */
    generateTaskId: function() {
        return TaskManager.generateTaskId();
    },
    
    /**
     * 注册新任务
     * @param {string} taskId 任务ID
     * @param {Function} cleanupFn 清理函数
     * @param {string} description 任务描述
     * @returns {string} 任务ID
     */
    registerTask: function(taskId, cleanupFn, description = '') {
        return TaskManager.registerTask(taskId, cleanupFn, description);
    },
    
    /**
     * 取消任务
     * @param {string} taskId 任务ID
     * @param {string} reason 取消原因
     */
    cancelTask: function(taskId, reason = '手动取消') {
        return TaskManager.cancelTask(taskId, reason);
    },
    
    /**
     * 取消所有任务
     * @param {string} reason 取消原因
     */
    cancelAllTasks: function(reason = '脚本停止') {
        return TaskManager.cancelAllTasks(reason);
    },
    
    /**
     * 检查任务是否活跃
     * @param {string} taskId 任务ID
     * @returns {boolean}
     */
    isTaskActive: function(taskId) {
        return TaskManager.isTaskActive(taskId);
    },
    
    /**
     * 安全执行函数（带任务检查）
     * @param {Function} fn 要执行的函数
     * @param {string} taskId 任务ID
     * @param {string} functionName 函数名称
     * @returns {Promise<any>}
     */
    taskSafeExecute: async function(fn, taskId, functionName = '匿名函数') {
        return await TaskManager.safeExecute(fn, taskId, functionName);
    },
    
    /**
     * 带超时的安全执行
     * @param {Function} fn 要执行的函数
     * @param {string} taskId 任务ID
     * @param {number} timeout 超时时间(ms)
     * @param {string} functionName 函数名称
     * @returns {Promise<any>}
     */
    taskSafeExecuteWithTimeout: async function(fn, taskId, timeout = 5000, functionName = '匿名函数') {
        return await TaskManager.safeExecuteWithTimeout(fn, taskId, timeout, functionName);
    },
    
    /**
     * 创建任务包装器
     * @param {string} description 任务描述
     * @param {Function} taskFn 任务函数
     * @param {Function} cleanupFn 清理函数
     * @returns {Function} 包装后的函数
     */
    createTaskWrapper: function(description, taskFn, cleanupFn = null) {
        return TaskManager.createTaskWrapper(description, taskFn, cleanupFn);
    },
    
    /**
     * 获取任务状态统计
     * @returns {Object} 任务统计信息
     */
    getTaskStats: function() {
        return TaskManager.getTaskStats();
    },
    
    /**
     * 等待所有任务完成
     * @param {number} timeout 超时时间(ms)
     * @returns {Promise<void>}
     */
    waitForAllTasks: async function(timeout = 30000) {
        return await TaskManager.waitForAllTasks(timeout);
    },
    
    // === Record模块函数 ===
    
    /**
     * 初始化记录模块
     */
    recordInit: async function() {
        return Record.init();
    },
    
    /**
     * 记录运行数据
     * @param {Object} data - 要记录的数据
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @returns {Promise<boolean>} 是否记录成功
     */
    logData: async function(data, recordType = 'general', accountName = 'default') {
        return await Record.logData(data, recordType, accountName);
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
        return await Record.readRecords(recordType, accountName, limit, offset);
    },
    
    /**
     * 查询特定条件的记录
     * @param {Object} query - 查询条件
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @returns {Promise<Array>} 匹配的记录
     */
    queryRecords: async function(query, recordType = 'general', accountName = 'default') {
        return await Record.queryRecords(query, recordType, accountName);
    },
    
    /**
     * 清除旧记录
     * @param {number} daysToKeep - 保留多少天内的记录
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @returns {Promise<number>} 删除的记录数
     */
    cleanupOldRecords: async function(daysToKeep = 30, recordType = 'all', accountName = 'default') {
        return await Record.cleanupOldRecords(daysToKeep, recordType, accountName);
    },
    
    /**
     * 创建数据备份
     * @param {string} backupName - 备份名称
     * @returns {Promise<boolean>} 是否备份成功
     */
    createBackup: async function(backupName = null) {
        return await Record.createBackup(backupName);
    },
    
    /**
     * 恢复数据备份
     * @param {string} backupName - 备份名称
     * @returns {Promise<boolean>} 是否恢复成功
     */
    restoreBackup: async function(backupName) {
        return await Record.restoreBackup(backupName);
    },
    
    /**
     * 列出所有备份
     * @returns {Promise<Array>} 备份列表
     */
    listBackups: async function() {
        return await Record.listBackups();
    },
    
    /**
     * 获取统计数据
     * @param {string} accountName - 账户名称
     * @returns {Promise<Object>} 统计数据
     */
    getStatistics: async function(accountName = 'default') {
        return await Record.getStatistics(accountName);
    },
    
    /**
     * 导出数据为CSV格式
     * @param {string} recordType - 记录类型
     * @param {string} accountName - 账户名称
     * @param {string} outputPath - 输出路径
     * @returns {Promise<boolean>} 是否导出成功
     */
    exportToCSV: async function(recordType, accountName = 'default', outputPath = null) {
        return await Record.exportToCSV(recordType, accountName, outputPath);
    },
    
    /**
     * 获取模块信息
     */
    getRecordInfo: function() {
        return Record.getInfo();
    },
    
    /**
     * 重置记录模块（清除所有数据，慎用！）
     */
    resetRecord: async function() {
        return await Record.reset();
    },
    
    // === OCR模块函数 ===
    
    /**
     * 初始化OCR模块
     */
    ocrInit: async function() {
        return OCR.init();
    },
    
    /**
     * 识别图像
     * @param {Object} recognitionObject - 识别对象
     * @param {number} timeout - 超时时间(毫秒)
     * @returns {Object} 识别结果 {success: boolean, x: number, y: number}
     */
    recognizeImage: async function(recognitionObject, timeout = 5000) {
        return await OCR.recognizeImage(recognitionObject, timeout);
    },
    
    /**
     * 识别文字并点击
     * @param {string} targetText - 目标文字
     * @param {Object} ocrRegion - OCR区域 {x, y, width, height}
     * @param {number} timeout - 超时时间(毫秒)
     * @returns {Object} 结果 {success: boolean, x: number, y: number}
     */
    recognizeTextAndClick: async function(targetText, ocrRegion, timeout = 300) {
        return await OCR.recognizeTextAndClick(targetText, ocrRegion, timeout);
    },
    
    /**
     * 在指定区域进行OCR识别
     * @param {Object} ocrRegion - OCR区域 {x, y, width, height}
     * @param {number} timeout - 超时时间(毫秒)
     * @returns {string|null} 识别到的文字内容
     */
    recognizeTextInRegion: async function(ocrRegion, timeout = 5000) {
        return await OCR.recognizeTextInRegion(ocrRegion, timeout);
    },
    
    /**
     * OCR识别固定矩形区域（无关键词过滤，最快200ms超时）
     * @param {{x:number, y:number, width:number, height:number}} rect 识别区域（像素）
     * @param {number} timeout 最长等待时间（毫秒，默认300）
     * @returns {string} 识别到的全部文字（未识别到返回空字符串）
     */
    ocrFixedRect: async function(rect, timeout = 300) {
        return await OCR.ocrFixedRect(rect, timeout);
    },
    
    /**
     * 在游戏区域中查找模板图片并返回其中心点
     * @param {Object} imgVar 模板图片变量名（需提前在函数外初始化）
     * @returns {{x:number, y:number}|null} 找到返回中心点坐标，未找到返回null
     */
    findImageCenter: function(imgVar) {
        return OCR.findImageCenter(imgVar);
    },
    
    /**
     * 获取联机世界当前玩家数
     * @param {boolean} openF2IfFail 若当前界面未识别到人数，是否再按F2重新识别一次
     * @returns {[number, number]} [快速识别结果, 最终确认结果]（0表示未识别到）
     */
    getPlayerSign: async function(openF2IfFail = false) {
        return await OCR.getPlayerSign(openF2IfFail);
    },
    
    /**
     * 检测最靠下对话框所属玩家（0P|2P|4P），0=未检测到{不打开！}
     * @returns {number} 0 | 2 | 4 | 0(都未检测到)
     */
    getLowerDialog: async function() {
        return await OCR.getLowerDialog();
    },
    
    /**
     * 检测派蒙菜单或联机页面
     * @returns {Promise<boolean>} 是否找到派蒙菜单或联机页面
     */
    checkPaimonOrCoop: async function() {
        return await OCR.checkPaimonOrCoop();
    },
    

    
    /**
     * 检测滑块底部位置是否在y < 400
     * @returns {Promise<boolean>} 滑块是否在顶部位置
     */
    checkSliderBottom: async function() {
        return await OCR.checkSliderBottom();
    },
    
    /**
     * 判断是否处于游戏主界面
     * @returns {Promise<boolean>} 是否在主界面
     */
    isMainUI: async function() {
        return await OCR.isMainUI();
    },
    
    /**
     * 检测队伍配置界面
     * @returns {boolean} 是否找到队伍配置界面
     */
    checkTeamConfig: function() {
        return OCR.checkTeamConfig();
    },
    
    /**
     * 检测加入按钮
     * @returns {boolean} 是否找到加入按钮
     */
    checkJoinButton: function() {
        return OCR.checkJoinButton();
    },
    
    /**
     * 检测更换按钮
     * @returns {boolean} 是否找到更换按钮
     */
    checkReplaceButton: function() {
        return OCR.checkReplaceButton();
    },
    
    // === PathManager模块函数 ===
    
    /**
     * 初始化路径管理器
     */
    pathManagerInit: async function() {
        return PathManager.init();
    },
    
    /**
     * 递归读取文件夹内容
     * @param {string} folderPath 目标文件夹路径
     * @param {boolean} onlyJson 是否只返回JSON文件
     * @returns {Array<{fullPath: string, fileName: string, folderPathArray: string[]}>} 文件信息数组
     */
    readFolder: async function(folderPath, onlyJson) {
        return await PathManager.readFolder(folderPath, onlyJson);
    },
    
    /**
     * 扫描pathing文件夹下全部.json路径文件，并按文件夹名分组
     * @returns {Object} 形如 { 文件夹名: [路径对象, ...], ... }
     */
    processPathings: async function() {
        return await PathManager.processPathings();
    },
    
    /**
     * 按分组导出路径文件到pathingOut目录
     * @param {Object} folderGroups 路线分组
     * @returns {Promise<void>}
     */
    copyPathingsByGroup: async function(folderGroups) {
        return await PathManager.copyPathingsByGroup(folderGroups);
    },
    
    /**
     * 异步函数，用于将变量内容写回到文件
     * @param {string} startRunDate 上次运行开始日期
     * @param {Date} startTime 上次开始时间
     * @param {string} RunWorldCount 上次运行世界数量
     * @param {string} mobKilled 上次运行精英数量
     * @param {string} eliteKilled 上次运行小怪数量
     * @param {string[]} records 历史收益记录
     * @param {boolean} finished 上次运行是否完成
     * @param {string} version js版本
     * @param {string} recordFilePath 记录文件路径
     * @returns {Promise<void>}
     */
    writeRecordFile: async function(
        startRunDate, 
        startTime, 
        RunWorldCount, 
        mobKilled, 
        eliteKilled, 
        records, 
        finished = false, 
        version = manifest.version, 
        recordFilePath = "records/record.txt"
    ) {
        return await PathManager.writeRecordFile(
            startRunDate, 
            startTime, 
            RunWorldCount, 
            mobKilled, 
            eliteKilled, 
            records, 
            finished, 
            version, 
            recordFilePath
        );
    },
    
    /**
     * 写入运行记录（PathManager版本）
     * @param {Object} original_inventory - 原始库存
     * @param {Object} current_inventory - 当前库存
     * @param {number} running_minutes - 运行时间（分钟）
     * @param {number} accurate_yield - 总收获量
     * @param {string} accountName - 账户名称
     * @returns {Promise<void>}
     */
    pathManagerWriteRecord: async function(original_inventory, current_inventory, running_minutes, accurate_yield, accountName = '默认账户') {
        return await PathManager.writeRecord(original_inventory, current_inventory, running_minutes, accurate_yield, accountName);
    },
    
    /**
     * 初始化冷却时间记录
     * @param {Object} folderGroups 路线分组
     * @param {string} accountName 账户名称
     * @returns {Promise<void>}
     */
    initializeCdTime: async function(folderGroups, accountName) {
        return await PathManager.initializeCdTime(folderGroups, accountName);
    },
    
    /**
     * 更新并保存路线记录
     * @param {Object} folderGroups 路线分组
     * @param {string} accountName 账户名称
     * @returns {Promise<void>}
     */
    updateRecords: async function(folderGroups, accountName) {
        return await PathManager.updateRecords(folderGroups, accountName);
    },
    
    /**
     * 处理所有分组的所有路线
     * @param {Object} folderGroups 路线分组
     * @param {string} accountName 账户名称
     * @returns {Promise<void>}
     */
    processGroups: async function(folderGroups, accountName) {
        return await PathManager.processGroups(folderGroups, accountName);
    },
    
    /**
     * 运行单条路径文件，并可选进行OCR识别自动拾取
     * @param {string} pathFilePath 路径文件绝对路径
     * @param {string[]} whitelistKeywords OCR白名单关键词
     * @param {string[]} blacklistKeywords OCR黑名单关键词
     * @returns {Promise<void>}
     */
    runPath: async function(pathFilePath, whitelistKeywords, blacklistKeywords) {
        return await PathManager.runPath(pathFilePath, whitelistKeywords, blacklistKeywords);
    },
    
    /**
     * 发送聊天消息
     * @param {string} say 消息内容
     * @returns {Promise<void>}
     */
    saySomething: async function(say = ' ') {
        return await PathManager.saySomething(say);
    },
    
    /**
     * 获取OCR关键词列表
     * @param {string} enemyType 敌人类型
     * @returns {string[]} 关键词列表
     */
    getOcrKeywords: function(enemyType = "盗宝团") {
        return PathManager.getOcrKeywords(enemyType);
    },
    
    /**
     * 保存挖矿数据到本地文件（PathManager版本）
     * @param {Object} original_inventory - 原始库存
     * @param {Object} current_inventory - 当前库存
     * @param {number} running_minutes - 运行时间（分钟）
     * @param {number} accurate_yield - 总收获量
     * @returns {Promise<Object>} 挖矿数据对象
     */
    pathManagerSaveMiningData: async function(original_inventory, current_inventory, running_minutes, accurate_yield) {
        return await PathManager.saveMiningData(original_inventory, current_inventory, running_minutes, accurate_yield);
    },
    
    // === Multiplayer模块函数 ===
    
    /**
     * 初始化多人世界模块
     */
    multiplayerInit: async function() {
        return await Multiplayer.init();
    },
    
    /**
     * 检测当前玩家状态
     * @returns {Promise<{status: string, count: number}|false>} 返回状态和玩家数量或false
     */
    detectPlayerCount: async function() {
        return await Multiplayer.detectPlayerCount();
    },
    
    /**
     * 识别并处理弹窗
     * @param {string} popupName - 弹窗名称
     * @param {number} timeout - 超时时间(毫秒)，默认100
     * @returns {Promise<boolean>} 是否识别并处理成功
     */
    recognizeOnePopup: async function(popupName, timeout = 100) {
        return await Multiplayer.recognizeOnePopup(popupName, timeout);
    },
    
    /**
     * 获取当前世界玩家数量
     * @returns {Promise<number|boolean>} 玩家数量或false（失败）
     */
    getWorldPlayerCount: async function() {
        return await Multiplayer.getWorldPlayerCount();
    },
    
    /**
     * 打开F2界面
     * @returns {Promise<boolean>} 是否成功打开
     */
    openF2: async function() {
        return await Multiplayer.openF2();
    },
    
    /**
     * 退出多人模式
     * @returns {Promise<boolean>} 是否成功退出
     */
    outF2: async function() {
        return await Multiplayer.outF2();
    },
    
    /**
     * 点击符合条件的多人世界
     * @param {number} skipIfWorldLevelBelow - 跳过低于此等级的世界
     * @param {number} skipIfWorldLevelAbove - 跳过高于此等级的世界
     * @returns {Promise<boolean>} 是否进入转场
     */
    clickSuitableWorld: async function(skipIfWorldLevelBelow = 16, skipIfWorldLevelAbove = 60) {
        return await Multiplayer.clickSuitableWorld(skipIfWorldLevelBelow, skipIfWorldLevelAbove);
    },
    
    /**
     * 选择世界（递归滚动和点击）
     * @param {Object} localTimer - 定时器对象
     * @returns {Promise<boolean>} 是否成功选择
     */
    selectFriends: async function(localTimer = null) {
        if (!localTimer) {
            localTimer = Multiplayer.createTimer(30000);
        }
        return await Multiplayer.selectFriends(localTimer);
    },
    
    /**
     * 等待进入世界
     * @param {Object} timers - 定时器对象
     * @returns {Promise<boolean>} 是否成功进入
     */
    waitForWorldTransition: async function(timers = null) {
        if (!timers) {
            timers = Multiplayer.createTimer(300000);
        }
        return await Multiplayer.waitForWorldTransition(timers);
    },
    
    /**
     * 检测战斗是否结束
     * @returns {Promise<boolean>} 是否结束
     */
    checkBattleEnd: async function() {
        return await Multiplayer.checkBattleEnd();
    },
    
    /**
     * 通用：指定区域OCR识别
     * @param {Object} ocrRegion  {x, y, width, height}
     * @param {number} timeout 毫秒
     * @returns {Promise<string|null>} 识别到的文字或null
     */
    multiplayerRecognizeTextInRegion: async function(ocrRegion, timeout = 500) {
        return await Multiplayer.recognizeTextInRegion(ocrRegion, timeout);
    },
    
    /**
     * 踢出指定玩家（仅房主可用）
     * @param {number} playerNumber - 玩家编号
     * @returns {Promise<boolean>} 是否踢出成功
     */
    kickPlayer: async function(playerNumber) {
        return await Multiplayer.kickPlayer(playerNumber);
    },
    
    /**
     * 创建定时器对象（Multiplayer版本）
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Object} 定时器对象
     */
    createTimer: function(timeout = 20000) {
        return Multiplayer.createTimer(timeout);
    },
    
    /**
     * 安全裁剪区域：防止ROI越界（Multiplayer版本）
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} w - 宽度
     * @param {number} h - 高度
     * @returns {Object} 安全的区域对象
     */
    multiplayerSafeROI: function(x, y, w, h) {
        return Multiplayer.safeROI(x, y, w, h);
    },
    
    /**
     * 向下翻页（Multiplayer版本）
     * @param {Object} sliderBottomRo - 滑块底部识别对象
     * @returns {Promise<void>}
     */
    multiplayerPageDown: async function(sliderBottomRo) {
        return await Multiplayer.pageDown(sliderBottomRo);
    },
    
    /**
     * 回到页面顶部（Multiplayer版本）
     * @param {Object} sliderTopRo - 滑块顶部识别对象
     * @returns {Promise<void>}
     */
    multiplayerPageTop: async function(sliderTopRo) {
        return await Multiplayer.pageTop(sliderTopRo);
    },
    
    /**
     * 鼠标滚轮翻页（Multiplayer版本）
     * @param {number} ok - 滚动次数，默认42次
     * @returns {Promise<void>}
     */
    multiplayerPageDown1: async function(ok = 42) {
        return await Multiplayer.pageDown1(ok);
    },
    
    /**
     * 鼠标拖拽翻页（Multiplayer版本）
     * @param {number} totalDistance - 总滚动距离
     * @param {number} stepDistance - 单步滚动距离，默认10
     * @param {number} delayMs - 每步延迟时间(毫秒)，默认10
     * @returns {Promise<void>}
     */
    multiplayerPageDown2: async function(totalDistance, stepDistance = 10, delayMs = 10) {
        return await Multiplayer.pageDown2(totalDistance, stepDistance, delayMs);
    },
    
    /**
     * 检测滑块底部位置是否在指定Y坐标阈值之上
     * @returns {Promise<boolean>} 返回滑块底部是否在阈值之上
     */
    multiplayerCheckSliderBottom: async function() {
        return await Multiplayer.checkSliderBottom();
    },
    
    /**
     * OCR识别固定矩形区域（Multiplayer版本）
     * @param {{x:number, y:number, width:number, height:number}} rect 识别区域（像素）
     * @param {number} timeout 最长等待时间（毫秒，默认200）
     * @returns {Promise<string>} 识别到的全部文字
     */
    multiplayerOcrFixedRect: async function(rect, timeout = 300) {
        return await Multiplayer.ocrFixedRect(rect, timeout);
    },
    
    /**
     * 防御式ROI计算，确保ROI不超出图像边界
     * @param {number} cx - 原始X坐标
     * @param {number} cy - 原始Y坐标
     * @param {number} cw - 原始宽度
     * @param {number} ch - 原始高度
     * @param {number} imgWidth - 图像宽度
     * @param {number} imgHeight - 图像高度
     * @returns {Object} 调整后的ROI区域
     */
    multiplayerClampROI: function(cx, cy, cw, ch, imgWidth, imgHeight) {
        return Multiplayer.clampROI(cx, cy, cw, ch, imgWidth, imgHeight);
    },
    
    /**
     * 获取可用的多人世界功能列表
     * @returns {Array} 功能列表
     */
    getMultiplayerFunctions: function() {
        return Multiplayer.getAvailableFunctions();
    },
    
    /**
     * 获取当前世界状态信息
     * @returns {Object} 世界状态信息
     */
    getWorldStatus: function() {
        return {
            currentWorldStatus: Multiplayer.currentWorldStatus,
            worldPlayerCount: Multiplayer.worldPlayerCount,
            worldHostUID: Multiplayer.worldHostUID,
            currentPermissions: Multiplayer.currentPermissions,
            lastWorldJoinTime: Multiplayer.lastWorldJoinTime
        };
    },
    
    // === 其他模块的函数将在此处添加 ===
    // Combat模块函数
    
    /**
     * 初始化所有模块
     */
    initAll: async function() {
        log.info('开始初始化所有模块...');
        
        try {
            // 初始化基础工具模块
            log.info('初始化Utils模块...');
            // Utils模块通常不需要显式初始化
            
            // 初始化OCR模块
            log.info('初始化OCR模块...');
            await this.ocrInit();
            
            // 初始化TaskManager模块
            log.info('初始化TaskManager模块...');
            await this.taskManagerInit();
            
            // 初始化Record模块
            log.info('初始化Record模块...');
            await this.recordInit();
            
            // 初始化PathManager模块
            log.info('初始化PathManager模块...');
            await this.pathManagerInit();
            
            // 初始化Artifact模块
            log.info('初始化Artifact模块...');
            await this.artifactInit();
            
            // 初始化Team模块
            log.info('初始化Team模块...');
            await this.teamInit();
            
            // 初始化Multiplayer模块
            log.info('初始化Multiplayer模块...');
            await this.multiplayerInit();
            
            log.info('所有模块初始化完成！');
            return true;
        } catch (error) {
            log.error(`初始化失败: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 获取Core模块信息
     * @returns {Object} 模块信息
     */
    getInfo: function() {
        return {
            version: '1.0.0',
            description: '原神脚本核心模块 - 统一接口',
            modules: [
                'Artifact - 圣遗物处理',
                'Utils - 基础工具',
                'Team - 队伍管理',
                'TaskManager - 任务管理',
                'Record - 数据记录',
                'OCR - 图像识别',
                'PathManager - 路径管理',
                'Multiplayer - 多人世界'
            ],
            totalFunctions: Object.keys(this).filter(key => typeof this[key] === 'function').length
        };
    },
    
    /**
     * 获取模块使用示例
     * @returns {Object} 使用示例
     */
    getExamples: function() {
        return {
            // 圣遗物功能示例
            artifact: `
// 分解圣遗物
let experience = await Core.decomposeArtifacts();

// 识别摩拉
let moraCount = await Core.mora();

// 获取背包矿石
let inventory = await Core.getInventory();
            `,
            
            // 多人功能示例
            multiplayer: `
// 检测玩家状态
let playerStatus = await Core.detectPlayerCount();

// 加入多人世界
let joined = await Core.selectFriends();

// 等待进入世界
let entered = await Core.waitForWorldTransition();

// 检查战斗是否结束
let battleEnded = await Core.checkBattleEnd();
            `,
            
            // OCR功能示例
            ocr: `
// 识别文字
let text = await Core.recognizeTextInRegion({x: 100, y: 100, width: 200, height: 50});

// 识别并点击
let clicked = await Core.recognizeTextAndClick("确定", {x: 800, y: 600, width: 100, height: 50});

// 获取玩家数量标识
let playerSign = await Core.getPlayerSign();
            `,
            
            // 路径管理示例
            path: `
// 处理路径文件
let pathGroups = await Core.processPathings();

// 运行路径
await Core.runPath("pathing/路线.json", ["晶蝶"], ["怪物"]);

// 发送聊天消息
await Core.saySomething("谢谢帮助！");
            `,
            
            // 数据记录示例
            record: `
// 记录数据
await Core.logData({action: "挖矿", yield: 100}, "mining", "user123");

// 读取记录
let records = await Core.readRecords("mining", "user123");

// 获取统计
let stats = await Core.getStatistics("user123");
            `,
            
            // 任务管理示例
            task: `
// 创建任务
let taskId = Core.generateTaskId();
Core.registerTask(taskId, () => console.log("清理"), "我的任务");

// 安全执行
await Core.taskSafeExecute(() => doSomething(), taskId, "任务执行");

// 等待所有任务
await Core.waitForAllTasks();
            `
        };
    },
    
    /**
     * 执行快速测试
     * @returns {Promise<boolean>} 测试是否通过
     */
    quickTest: async function() {
        try {
            log.info('开始Core模块快速测试...');
            
            // 测试1: 检查基本函数
            let timer = this.createTimer(1000);
            if (!timer || !timer.isTimeout || !timer.reStart) {
                throw new Error('定时器创建失败');
            }
            
            // 测试2: 检查OCR识别对象
            if (!OCR || !OCR.init) {
                throw new Error('OCR模块加载失败');
            }
            
            // 测试3: 检查模块信息
            let info = this.getInfo();
            if (!info || !info.modules) {
                throw new Error('模块信息获取失败');
            }
            
            log.info(`Core模块测试通过！共加载 ${info.modules.length} 个模块`);
            return true;
            
        } catch (error) {
            log.error(`Core模块测试失败: ${error.message}`);
            return false;
        }
    },

// === 新增函数：路径处理功能 ===

/**
 * 读取指定文件夹下的JSON文件路径
 * @param {string} folderName - 要匹配的文件夹名称（如"枫丹水下@芝士贝果H测试"）
 * @returns {Promise<Array<string>>} JSON文件路径数组，如果没有匹配则返回空数组
 */
getPathingFiles: async function(folderName) {
    try {
        // 确保PathManager已初始化
        if (typeof PathManager === 'undefined') {
            await this.pathManagerInit();
        }
        
        // 使用PathManager读取文件夹
        const allFiles = await PathManager.readFolder('pathing', true);
        
        // 过滤出指定文件夹内的JSON文件
        const matchedFiles = allFiles.filter(file => {
            // 检查文件夹路径数组是否包含目标文件夹名
            return file.folderPathArray.some(folder => folder === folderName);
        });
        
        // 提取文件完整路径并返回
        const filePaths = matchedFiles.map(file => file.fullPath);
        log.info(`找到 ${filePaths.length} 个JSON文件在文件夹 "${folderName}" 中`);
        return filePaths;
    } catch (error) {
        log.error(`读取文件夹失败: ${error.message}`);
        return [];
    }
},

/**
 * 执行单个路径文件
 * @param {string} filePath - 要执行的路径文件完整路径
 * @param {string[]} [whitelistKeywords=[]] - OCR白名单关键词
 * @param {string[]} [blacklistKeywords=[]] - OCR黑名单关键词
 * @returns {Promise<boolean>} 是否执行成功
 */
runSinglePathFile: async function(filePath, whitelistKeywords = [], blacklistKeywords = []) {
    try {
        log.info(`开始执行路径文件: ${filePath}`);
        
        // 检查文件是否存在
        try {
            file.ReadTextSync(filePath);
        } catch (error) {
            log.error(`路径文件不存在: ${filePath}`);
            return false;
        }
        
        // 检查文件扩展名
        if (!filePath.endsWith('.json')) {
            log.error(`不是JSON文件: ${filePath}`);
            return false;
        }
        
        // 使用PathManager的runPath函数执行路径
        await PathManager.runPath(filePath, whitelistKeywords, blacklistKeywords);
        
        log.info(`路径文件执行完成: ${filePath}`);
        return true;
    } catch (error) {
        log.error(`执行路径文件失败 "${filePath}": ${error.message}`);
        return false;
    }
},

/**
 * 循环执行路径文件数组中的所有文件
 * @param {Array<string>} filePaths - 路径文件数组
 * @param {Object} [options={}] - 选项配置
 * @param {boolean} [options.stopOnError=false] - 遇到错误时是否停止
 * @param {string[]} [options.whitelistKeywords=[]] - OCR白名单关键词
 * @param {string[]} [options.blacklistKeywords=[]] - OCR黑名单关键词
 * @returns {Promise<Object>} 执行结果统计
 */
runPathArray: async function(filePaths, options = {}) {
    const {
        stopOnError = false,
        whitelistKeywords = [],
        blacklistKeywords = []
    } = options;
    
    const results = {
        total: filePaths.length,
        success: 0,
        failed: 0,
        errors: []
    };
    
    log.info(`开始批量执行路径，共 ${results.total} 个文件`);
    
    // 依次执行每个路径文件
    for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        
        log.info(`正在执行第 ${i + 1}/${results.total} 个文件: ${filePath}`);
        
        try {
            await ChatClick.run();        // 说话！！！
            // 执行单个文件
            const success = await this.runSinglePathFile(
                filePath, 
                whitelistKeywords, 
                blacklistKeywords
            );
            
            if (success) {
                results.success++;
                log.info(`第 ${i + 1} 个文件执行成功`);
            } else {
                results.failed++;
                const errorMsg = `第 ${i + 1} 个文件执行失败: ${filePath}`;
                results.errors.push(errorMsg);
                log.error(errorMsg);
                
                // 如果设置了出错停止，则退出循环
                if (stopOnError) {
                    log.warn('遇到错误，停止后续执行');
                    break;
                }
            }
            
        } catch (error) {
            results.failed++;
            const errorMsg = `执行第 ${i + 1} 个文件时发生异常: ${error.message}`;
            results.errors.push(errorMsg);
            log.error(errorMsg);
            
            // 如果设置了出错停止，则退出循环
            if (stopOnError) {
                log.warn('遇到异常，停止后续执行');
                break;
            }
        }
    }
    
    log.info(`批量执行完成: 成功 ${results.success} 个, 失败 ${results.failed} 个`);
    return results;
},

/**
 * 简化版：一步完成读取文件夹并执行所有路径
 * @param {string} folderName - 要匹配的文件夹名称
 * @param {Object} [options={}] - 选项配置
 * @returns {Promise<Object>} 执行结果统计
 */
runPathingFolder: async function(folderName, options = {}) {
    log.info(`开始处理文件夹: "${folderName}"`);
    
    // 1. 获取文件夹内的所有JSON文件路径
    const filePaths = await this.getPathingFiles(folderName);
    
    if (filePaths.length === 0) {
        log.warn(`文件夹 "${folderName}" 中没有找到JSON文件`);
        return {
            total: 0,
            success: 0,
            failed: 0,
            errors: [`文件夹 "${folderName}" 中没有找到JSON文件`]
        };
    }
    
    // 2. 执行所有路径文件
    return await this.runPathArray(filePaths, options);
}

    
};

// 导出Core对象
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Core;
} else if (typeof window !== 'undefined') {
    window.Core = Core;
}

// 自动初始化
if (typeof Core.initAll === 'function') {
    // 可选：在页面加载时自动初始化
    // Core.initAll().then(success => {
    //     if (success) {
    //         log.info('Core模块自动初始化完成');
    //     }
    // });
}