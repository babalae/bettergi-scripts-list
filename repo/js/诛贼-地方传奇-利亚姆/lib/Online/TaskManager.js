// =========================================================================
//                          TaskManager.js - 任务管理模块
// =========================================================================
// 此模块提供全局任务管理，优雅处理任务取消

var TaskManager = {
    // === 任务状态 ===
    tasks: new Map(),
    isCancelling: false,
    taskCounter: 0,
    
    // === 初始化函数 ===
    
    /**
     * 初始化任务管理器
     */
    init: function() {
        log.info('初始化任务管理器...');
        this.tasks.clear();
        this.isCancelling = false;
        this.taskCounter = 0;
        
        // 设置全局错误处理器
        this._setupGlobalErrorHandler();
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
            description: description || taskId
        });
        
        log.debug(`任务注册: ${description || taskId} (ID: ${taskId})`);
        return taskId;
    },
    
    /**
     * 取消任务
     * @param {string} taskId 任务ID
     * @param {string} reason 取消原因
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
        }
    },
    
    /**
     * 取消所有任务
     * @param {string} reason 取消原因
     */
    cancelAllTasks: function(reason = '脚本停止') {
        if (this.isCancelling) {
            log.debug('已经在取消任务中，跳过');
            return;
        }
        
        this.isCancelling = true;
        log.info(`开始取消所有任务... (原因: ${reason})`);
        
        const activeTasks = [];
        for (const [taskId, task] of this.tasks) {
            if (task.isActive) {
                activeTasks.push(task);
            }
        }
        
        log.info(`发现 ${activeTasks.length} 个活跃任务`);
        
        // 取消所有活跃任务
        for (const task of activeTasks) {
            this.cancelTask(task.id, reason);
        }
        
        // 清理已完成的任务
        this._cleanupCompletedTasks();
        
        log.info('所有任务已取消');
        this.isCancelling = false;
    },
    
    /**
     * 检查任务是否活跃
     * @param {string} taskId 任务ID
     * @returns {boolean}
     */
    isTaskActive: function(taskId) {
        if (this.isCancelling) {
            return false;
        }
        
        const task = this.tasks.get(taskId);
        return task ? task.isActive : false;
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
     * 创建任务包装器
     * @param {string} description 任务描述
     * @param {Function} taskFn 任务函数
     * @param {Function} cleanupFn 清理函数
     * @returns {Function} 包装后的函数
     */
    createTaskWrapper: function(description, taskFn, cleanupFn = null) {
        return async (...args) => {
            const taskId = this.generateTaskId();
            this.registerTask(taskId, cleanupFn, description);
            
            try {
                const result = await this.safeExecute(() => taskFn(...args), taskId, description);
                this._markTaskCompleted(taskId);
                return result;
            } catch (error) {
                this._markTaskFailed(taskId, error.message);
                throw error;
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
            failed: 0
        };
        
        for (const task of this.tasks.values()) {
            if (task.isActive) stats.active++;
            if (task.completed) stats.completed++;
            if (task.cancelReason) stats.cancelled++;
            if (task.failed) stats.failed++;
        }
        
        return stats;
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
        // 捕获未处理的Promise拒绝
        if (typeof process !== 'undefined') {
            process.on('unhandledRejection', (reason, promise) => {
                log.error(`未处理的Promise拒绝: ${reason}`);
                this.cancelAllTasks('未处理的Promise拒绝');
            });
            
            process.on('SIGINT', () => {
                log.info('接收到SIGINT信号，停止所有任务...');
                this.cancelAllTasks('SIGINT信号');
            });
        }
        
        // 捕获全局错误
        window.addEventListener('error', (event) => {
            log.error(`全局错误: ${event.message}`);
            this.cancelAllTasks('全局错误');
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
    }
};

// 自动初始化
if (typeof window !== 'undefined' || typeof process !== 'undefined') {
    TaskManager.init();
}