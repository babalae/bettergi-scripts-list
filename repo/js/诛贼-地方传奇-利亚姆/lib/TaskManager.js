// =========================================================================
//                       TaskManager.js 
// =========================================================================
// 此模块提供全局任务管理，优雅处理任务取消，与PathManager集成

var TaskManager = {
    // === 任务状态 ===
    tasks: new Map(),
    isCancelling: false,
    taskCounter: 0,
    
    // === 全局中断标志 ===
    globalInterruptFlag: false,
    
    // === 初始化函数 ===
    
    /**
     * 初始化任务管理器
     */
    init: function() {
        log.info('初始化任务管理器...');
        this.tasks.clear();
        this.isCancelling = false;
        this.taskCounter = 0;
        this.globalInterruptFlag = false;
        
        // 设置全局错误处理器
        this._setupGlobalErrorHandler();
        
        // 监听脚本停止事件
        this._setupStopListener();
    },
    
    /**
     * 设置停止监听器
     */
    _setupStopListener: function() {
        // 监听窗口事件（如果存在停止按钮）
        window.addEventListener('scriptStop', (event) => {
            this.cancelAllTasks(event.detail?.reason || '脚本停止');
        });
        
        // 监听键盘快捷键（如ESC键）
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && e.ctrlKey) {
                this.cancelAllTasks('用户按下Ctrl+Esc');
            }
        });
    },
    
    // === 任务管理函数 ===
    
    /**
     * 生成唯一任务ID
     * @returns {string} 任务ID
     */
    generateTaskId: function() {
        this.taskCounter++;
        return `task-${this.taskCounter}-${Date.now()}`;
    },
    
    /**
     * 注册新任务
     * @param {string} taskId 任务ID
     * @param {Function} cleanupFn 清理函数
     * @param {string} description 任务描述
     * @returns {string} 任务ID
     */
    registerTask: function(taskId, cleanupFn, description = '') {
        if (!taskId) {
            taskId = this.generateTaskId();
        }
        
        this.tasks.set(taskId, {
            id: taskId,
            cleanup: cleanupFn,
            isActive: true,
            startTime: Date.now(),
            description: description || taskId,
            progress: 0,
            subTasks: []
        });
        
        log.debug(`任务注册: ${description || taskId} (ID: ${taskId})`);
        return taskId;
    },
    
    /**
     * 取消任务
     * @param {string} taskId 任务ID
     * @param {string} reason 取消原因
     * @returns {boolean} 是否成功取消
     */
    cancelTask: function(taskId, reason = '手动取消') {
        const task = this.tasks.get(taskId);
        if (task && task.isActive) {
            task.isActive = false;
            task.endTime = Date.now();
            task.cancelReason = reason;
            
            if (task.cleanup) {
                try {
                    task.cleanup();
                    log.debug(`任务清理完成: ${task.description} (原因: ${reason})`);
                } catch (e) {
                    log.debug(`清理任务 ${task.description} 时出错: ${e.message}`);
                }
            }
            log.info(`任务取消: ${task.description} (原因: ${reason})`);
            return true;
        }
        return false;
    },
    
    /**
     * 取消所有任务
     * @param {string} reason 取消原因
     * @returns {number} 取消的任务数量
     */
    cancelAllTasks: function(reason = '脚本停止') {
        if (this.isCancelling) {
            log.debug('已经在取消任务中，跳过');
            return 0;
        }
        
        this.isCancelling = true;
        this.globalInterruptFlag = true;
        log.info(`开始取消所有任务... (原因: ${reason})`);
        
        const activeTasks = [];
        for (const [taskId, task] of this.tasks) {
            if (task.isActive) {
                activeTasks.push(task);
            }
        }
        
        log.info(`发现 ${activeTasks.length} 个活跃任务`);
        
        // 取消所有活跃任务
        let cancelledCount = 0;
        for (const task of activeTasks) {
            if (this.cancelTask(task.id, reason)) {
                cancelledCount++;
            }
        }
        
        // 清理已完成的任务
        this._cleanupCompletedTasks();
        
        log.info(`所有任务已取消，共取消 ${cancelledCount} 个任务`);
        this.isCancelling = false;
        return cancelledCount;
    },
    
    /**
     * 立即停止所有任务（强制）
     * @param {string} reason 停止原因
     */
    forceStopAllTasks: function(reason = '强制停止') {
        this.globalInterruptFlag = true;
        const count = this.cancelAllTasks(reason);
        
        // 立即清理所有定时器
        try {
            dispatcher.ClearAllTriggers();
            log.info('已清理所有定时器');
        } catch (e) {
            log.debug('清理定时器时出错:', e.message);
        }
        
        // 尝试返回主界面
        try {
            genshin.returnMainUi();
            log.info('已返回游戏主界面');
        } catch (e) {
            log.debug('返回主界面时出错:', e.message);
        }
        
        return count;
    },
    
    /**
     * 检查任务是否活跃
     * @param {string} taskId 任务ID
     * @returns {boolean}
     */
    isTaskActive: function(taskId) {
        if (this.isCancelling || this.globalInterruptFlag) {
            return false;
        }
        
        const task = this.tasks.get(taskId);
        return task ? task.isActive : false;
    },
    
    /**
     * 检查全局中断标志
     * @returns {boolean}
     */
    shouldInterrupt: function() {
        return this.globalInterruptFlag || this.isCancelling;
    },
    
    /**
     * 安全执行函数（带任务检查）
     * @param {Function} fn 要执行的函数
     * @param {string} taskId 任务ID
     * @param {string} functionName 函数名称
     * @returns {Promise<any>}
     */
    safeExecute: async function(fn, taskId, functionName = '匿名函数') {
        // 检查任务是否活跃
        if (!this.isTaskActive(taskId)) {
            log.debug(`任务 ${taskId} 已被取消，跳过执行: ${functionName}`);
            throw new Error('Task was canceled');
        }
        
        try {
            const result = await fn();
            
            // 执行后再次检查任务状态
            if (!this.isTaskActive(taskId)) {
                log.debug(`任务 ${taskId} 在执行期间被取消: ${functionName}`);
                throw new Error('Task was canceled during execution');
            }
            
            return result;
        } catch (error) {
            // 处理取消异常
            if (error.message === 'Task was canceled' || 
                error.message === 'Task was canceled during execution' ||
                (error.message && error.message.includes('was canceled'))) {
                log.debug(`任务 ${taskId} 执行被取消: ${functionName}`);
            } else {
                log.error(`任务 ${taskId} 执行异常: ${functionName} - ${error.message}`);
            }
            throw error;
        }
    },
    
    /**
     * 带超时的安全执行
     * @param {Function} fn 要执行的函数
     * @param {string} taskId 任务ID
     * @param {number} timeout 超时时间(ms)
     * @param {string} functionName 函数名称
     * @returns {Promise<any>}
     */
    safeExecuteWithTimeout: async function(fn, taskId, timeout = 5000, functionName = '匿名函数') {
        return new Promise((resolve, reject) => {
            // 立即检查任务状态
            if (!this.isTaskActive(taskId)) {
                reject(new Error('Task was canceled'));
                return;
            }
            
            const timeoutId = setTimeout(() => {
                reject(new Error(`[${functionName}] 执行超时 (${timeout}ms)`));
            }, timeout);
            
            this.safeExecute(fn, taskId, functionName)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    },
    
    /**
     * 为路径管理创建专用函数包装器
     * @param {string} description 任务描述
     * @param {Function} taskFn 任务函数
     * @param {Function} cleanupFn 清理函数
     * @returns {{execute: Function, taskId: string}} 包装器对象
     */
    createPathingTask: function(description, taskFn, cleanupFn = null) {
        const taskId = this.generateTaskId();
        
        // 清理函数默认行为
        const defaultCleanup = () => {
            log.info(`清理路径任务: ${description}`);
            try {
                dispatcher.ClearAllTriggers();
                genshin.returnMainUi();
            } catch (e) {
                log.debug(`清理任务 ${taskId} 时出错: ${e.message}`);
            }
        };
        
        this.registerTask(
            taskId, 
            cleanupFn || defaultCleanup, 
            description
        );
        
        return {
            taskId,
            execute: async (...args) => {
                try {
                    const result = await this.safeExecute(() => taskFn(...args), taskId, description);
                    this._markTaskCompleted(taskId);
                    return result;
                } catch (error) {
                    this._markTaskFailed(taskId, error.message);
                    throw error;
                }
            }
        };
    },
    
    /**
     * 创建循环任务包装器
     * @param {string} description 任务描述
     * @param {Function} loopFn 循环函数
     * @param {Function} conditionFn 继续条件函数
     * @param {Function} cleanupFn 清理函数
     * @returns {{execute: Function, taskId: string}} 包装器对象
     */
    createLoopTask: function(description, loopFn, conditionFn, cleanupFn = null) {
        const taskId = this.generateTaskId();
        
        this.registerTask(
            taskId, 
            cleanupFn || (() => {
                log.info(`清理循环任务: ${description}`);
                dispatcher.ClearAllTriggers();
            }), 
            description
        );
        
        return {
            taskId,
            execute: async () => {
                try {
                    while (this.isTaskActive(taskId) && conditionFn()) {
                        await this.safeExecute(loopFn, taskId, `${description} 循环迭代`);
                        await sleep(100); // 防止CPU过载
                    }
                    this._markTaskCompleted(taskId);
                } catch (error) {
                    this._markTaskFailed(taskId, error.message);
                    throw error;
                }
            }
        };
    },
    
    /**
     * 获取任务状态统计
     * @returns {Object} 任务统计信息
     */
    getTaskStats: function() {
        const stats = {
            total: this.tasks.size,
            active: 0,
            completed: 0,
            cancelled: 0,
            failed: 0,
            globalInterrupt: this.globalInterruptFlag
        };
        
        for (const task of this.tasks.values()) {
            if (task.isActive) stats.active++;
            if (task.completed) stats.completed++;
            if (task.cancelReason) stats.cancelled++;
            if (task.failed) stats.failed++;
        }
        
        return stats;
    },
    
    /**
     * 获取活动任务列表
     * @returns {Array<Object>} 活动任务列表
     */
    getActiveTasks: function() {
        const activeTasks = [];
        for (const [taskId, task] of this.tasks) {
            if (task.isActive) {
                activeTasks.push({
                    id: taskId,
                    description: task.description,
                    startTime: task.startTime,
                    duration: Date.now() - task.startTime
                });
            }
        }
        return activeTasks;
    },
    
    /**
     * 重置全局中断标志
     */
    resetGlobalInterrupt: function() {
        this.globalInterruptFlag = false;
        log.info('全局中断标志已重置');
    },
    
    // === 内部函数 ===
    
    /**
     * 标记任务完成
     * @param {string} taskId 任务ID
     */
    _markTaskCompleted: function(taskId) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.isActive = false;
            task.completed = true;
            task.endTime = Date.now();
            task.duration = task.endTime - task.startTime;
            log.debug(`任务完成: ${task.description} (耗时: ${task.duration}ms)`);
        }
    },
    
    /**
     * 标记任务失败
     * @param {string} taskId 任务ID
     * @param {string} error 错误信息
     */
    _markTaskFailed: function(taskId, error) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.isActive = false;
            task.failed = true;
            task.error = error;
            task.endTime = Date.now();
            task.duration = task.endTime - task.startTime;
            log.debug(`任务失败: ${task.description} - ${error}`);
        }
    },
    
    /**
     * 清理已完成的任务
     */
    _cleanupCompletedTasks: function() {
        const toDelete = [];
        const now = Date.now();
        
        for (const [taskId, task] of this.tasks) {
            // 清理一小时前完成的任务
            if (!task.isActive && task.endTime && (now - task.endTime > 3600000)) {
                toDelete.push(taskId);
            }
        }
        
        for (const taskId of toDelete) {
            this.tasks.delete(taskId);
        }
        
        if (toDelete.length > 0) {
            log.debug(`清理了 ${toDelete.length} 个旧任务`);
        }
    },
    
    /**
     * 设置全局错误处理器
     */
    _setupGlobalErrorHandler: function() {
        // 捕获全局错误
        window.addEventListener('error', (event) => {
            log.error(`全局错误: ${event.message}`);
            this.cancelAllTasks('全局错误');
        });
        
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            log.error(`未处理的Promise拒绝: ${event.reason}`);
            this.cancelAllTasks('未处理的Promise拒绝');
        });
    },
    
    // === 工具函数 ===
    
    /**
     * 等待所有任务完成
     * @param {number} timeout 超时时间(ms)
     * @returns {Promise<void>}
     */
    waitForAllTasks: function(timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                const stats = this.getTaskStats();
                
                if (stats.active === 0) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`等待任务完成超时 (${timeout}ms)`));
                    return;
                }
                
                log.debug(`等待任务完成: ${stats.active} 个活跃任务`);
            }, 1000);
        });
    },
    
    /**
     * 检查并抛出取消异常
     * @param {string} taskId 任务ID
     * @throws {Error} 任务取消异常
     */
    throwIfCancelled: function(taskId) {
        if (!this.isTaskActive(taskId)) {
            throw new Error('Task was canceled');
        }
    },
    
    /**
     * 睡眠函数，可被中断
     * @param {number} ms 毫秒数
     * @param {string} taskId 任务ID
     * @returns {Promise<void>}
     */
    sleepInterruptible: async function(ms, taskId) {
        const start = Date.now();
        while (Date.now() - start < ms) {
            if (!this.isTaskActive(taskId)) {
                throw new Error('Task was canceled during sleep');
            }
            await sleep(Math.min(100, ms - (Date.now() - start)));
        }
    }
};

// 自动初始化
if (typeof window !== 'undefined') {
    TaskManager.init();
}

// 导出全局函数以便按钮调用
window.stopAllTasks = function() {
    TaskManager.forceStopAllTasks('用户点击停止按钮');
    return '正在停止所有任务...';
};

window.getTaskStatus = function() {
    return TaskManager.getTaskStats();
};

// 为PathManager提供快捷方法
if (typeof PathManager !== 'undefined') {
    PathManager.TaskManager = TaskManager;
}