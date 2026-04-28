// 任务管理模块
var TaskManager = {
    // 加载已完成任务记录
    loadCompletedTasks: function() {
        return Utils.readJson(Constants.COMPLETED_TASKS_FILE, {});
    },
    
    // 保存已完成任务记录
    saveCompletedTasks: async function(tasks) {
        try {
            await file.writeText(Constants.COMPLETED_TASKS_FILE, JSON.stringify(tasks, null, 2));
            log.info("已保存完成任务记录");
        } catch (error) {
            log.error(`保存任务记录失败: ${error}`);
        }
    },
    
    // 添加已完成任务
    addCompletedTask: async function(materialType, materialName, requireCounts, characterName, uid) {
        const tasks = this.loadCompletedTasks();
        const taskKey = `${uid}_${characterName}_${materialType}_${materialName}`;
        
        tasks[taskKey] = {
            uid,
            characterName,
            materialType,
            materialName,
            requireCounts,
            completedAt: new Date().toISOString()
        };
        
        await this.saveCompletedTasks(tasks);
        log.info(`已标记 ${uid} 的 ${characterName} 的 ${materialName} 为完成`);
    },
    
    isTaskCompleted: async function(materialType, materialName, currentRequireCounts, characterName, uid) {
        const tasks = this.loadCompletedTasks();
        const taskKey = `${uid}_${characterName}_${materialType}_${materialName}`;
        
        if (!tasks[taskKey]) {
            return false;
        }
        
        const previousRequireCounts = tasks[taskKey].requireCounts;
        if (Array.isArray(previousRequireCounts) && Array.isArray(currentRequireCounts)) {
            return previousRequireCounts.join(',') === currentRequireCounts.join(',');
        } else {
            return previousRequireCounts === currentRequireCounts;
        }
    }
};
