// 材料采集模块
var Collection = {
    // 获取所有别名
    getAllAliasesByStandardName: function(standardName) {
        const mappingList = Utils.readJson(Constants.MAPPING_PATH, []);
        if (!Array.isArray(mappingList) || mappingList.length === 0) {
            log.warn(`Mapping.json解析失败或为空，仅使用标准名称：${standardName}`);
            return [standardName];
        }
        const targetItem = mappingList.find(item => item.name === standardName);
        if (!targetItem || !Array.isArray(targetItem.alias)) {
            log.info(`Mapping.json中未找到【${standardName}】的精确匹配，尝试模糊匹配...`);
            
            for (const item of mappingList) {
                if (!item.name || !Array.isArray(item.alias)) continue;
                
                const isFuzzyMatch = 
                    item.name.includes(standardName) || 
                    standardName.includes(item.name) ||
                    this.fuzzyMatch(standardName, item.name);
                
                if (isFuzzyMatch) {
                    log.info(`【${standardName}】模糊匹配到映射项【${item.name}】`);
                    const allNames = [...new Set([standardName, ...item.alias])];
                    log.info(`【${standardName}】匹配到所有别名：${JSON.stringify(allNames)}`);
                    return allNames;
                }
            }
            
            log.info(`Mapping.json中未找到【${standardName}】的别名配置，仅使用标准名称`);
            return [standardName];
        }
        const allNames = [...new Set([standardName, ...targetItem.alias])];
        log.info(`【${standardName}】匹配到所有别名：${JSON.stringify(allNames)}`);
        return allNames;
    },
    
    // 模糊匹配函数
    fuzzyMatch: function(str1, str2) {
        if (!str1 || !str2) return false;
        const len1 = str1.length;
        const len2 = str2.length;
        if (Math.abs(len1 - len2) > 1) return false;
        let matchCount = 0;
        const minLen = Math.min(len1, len2);
        for (let i = 0; i < minLen; i++) {
            if (str1[i] === str2[i]) matchCount++;
        }
        return matchCount >= minLen * 0.6;
    },
    
    // 检查是否有草神目录脚本
    hasGrassGodDirScripts: function(scriptList) {
        return scriptList.some(script => script.path.includes(Constants.GRASS_GOD_KEYWORD));
    },
    
    // 根据数量筛选地方特产脚本
    filterLocalScriptsByCount: function(scriptList, targetCount, isIncludeGrassGod) {
        let totalCount = 0;
        const needExecuteScripts = [];
        let errorValue = targetCount >= 45 ? 12 : 8;
        if (isIncludeGrassGod && this.hasGrassGodDirScripts(scriptList)) {
            errorValue += Constants.GRASS_GOD_ERROR_EXTRA;
            log.info(`📈 检测到有草神目录的脚本，额外增加${Constants.GRASS_GOD_ERROR_EXTRA}个误差值，总误差值变为：${errorValue}个`);
        }
        const totalTarget = targetCount + errorValue;
        log.info(`🎯 特产收集目标：${targetCount}个，误差值：${errorValue}个，累计需收集：${totalTarget}个`);
        
        for (const script of scriptList) {
            needExecuteScripts.push(script);
            totalCount += script.count;
            log.info(`🔢 加入脚本【${script.name}】- 单次数量：${script.count}个，累计：${totalCount}个`);
            if (totalCount >= totalTarget) {
                log.info(`✅ 累计数量已达${totalCount}个（≥${totalTarget}个），停止添加后续脚本`);
                break;
            }
        }
        log.info(`📊 特产脚本筛选结果：共扫描${scriptList.length}个，需执行${needExecuteScripts.length}个，预计收集${totalCount}个`);
        return needExecuteScripts;
    },
    
    // 递归扫描脚本文件
    recursiveScanScriptFiles: function(scriptDir, isExcludeGrassGod) {
        let allScriptFiles = [];
        scriptDir = scriptDir.replace(/\\/g, "/");
        const basePath = "pathing";
        let relativePath = scriptDir;
        if (scriptDir.startsWith(basePath + "/")) {
            relativePath = scriptDir.substring(basePath.length + 1);
        }
        log.info(`📂 递归扫描目录：${scriptDir}（相对路径：${relativePath}，排除有草神路线：${isExcludeGrassGod}）`);
        
        try {
            let allPaths = pathingScript.ReadPathSync(relativePath);
            allPaths = Array.from(allPaths || []);
            
            for (const itemPath of allPaths) {
                const normalizedPath = itemPath.replace(/\\/g, "/").replace(/^\/+/, "");
                let fullPath = "";
                
                if (normalizedPath.startsWith(scriptDir + "/")) {
                    fullPath = normalizedPath;
                } else if (normalizedPath.includes("/") && !normalizedPath.startsWith("./") && !normalizedPath.startsWith("/")) {
                    fullPath = `${basePath}/${normalizedPath}`;
                } else {
                    fullPath = `${scriptDir}/${normalizedPath}`;
                }
                fullPath = fullPath.replace(/\\/g, "/");
                
                const itemRelativePath = fullPath.startsWith(basePath + "/") ? fullPath.substring(basePath.length + 1) : fullPath;
                if (pathingScript.IsFolder(itemRelativePath)) {
                    const folderName = fullPath.split(/[\\/]/).pop() || "";
                    if (isExcludeGrassGod && folderName.includes(Constants.GRASS_GOD_KEYWORD)) {
                        log.info(`🚫 排除有草神路线文件夹：${fullPath}`);
                        continue;
                    }
                    log.info(`📂 发现子目录：${fullPath}，递归扫描`);
                    const subDirFiles = this.recursiveScanScriptFiles(fullPath, isExcludeGrassGod);
                    allScriptFiles = allScriptFiles.concat(subDirFiles);
                } else {
                    if (normalizedPath.toLowerCase().endsWith(".json")) {
                        const fileName = normalizedPath.split("/").pop() || normalizedPath;
                        const count = Utils.extractLocalCountFromFileName(fileName);
                        allScriptFiles.push({ path: fullPath, name: fileName, count: count });
                    }
                }
            }
        } catch (e) {
            log.error(`扫描目录失败 [${scriptDir}]：${e.message}`);
        }
        return allScriptFiles;
    },
    
    // 获取当前账号UID
    getCurrentAccountUid: async function() {
        async function executeCheckWithRetry(task, taskName) {
            const maxRetries = Constants.OCR_MAX_RETRIES;
            let retryCount = 0;
            while (retryCount < maxRetries) {
                try {
                    await task();
                    break;
                } catch (e) {
                    retryCount++;
                    log.error(`❌ ${taskName}失败（第${retryCount}次重试）：${e.message}`);
                    if (retryCount >= maxRetries) {
                        throw new Error(`${taskName}失败，已重试${maxRetries}次`);
                    }
                    await sleep(Constants.OCR_RETRY_WAIT);
                }
            }
        }
        
        const checkResult = { accountUid: Constants.DEFAULT_UID };
        try {
            await executeCheckWithRetry(async () => {
                log.info("🔍 正在识别当前账号UID");
                log.info("📌 按下ESC打开派蒙菜单");
                keyPress("VK_ESCAPE");
                await sleep(2000);
                log.info("🔍 OCR识别UID（区域：x168,y195,w120,h27）");
                const uidTextList = await Utils.ocrRecognizeWithRetry(168, 195, 120, 27, "UID识别");
                let rawUidText = uidTextList && uidTextList.length > 0 ? uidTextList[0] : "";
                const extractedUid = rawUidText.replace(/[^0-9]/g, '');
                
                // 验证UID：不能是默认值，且必须是9位数字
                if (!extractedUid || extractedUid === Constants.DEFAULT_UID || extractedUid.length !== 9) {
                    log.warn(`⚠️ UID识别结果无效：${extractedUid || "空"}（需要9位数字），将重试`);
                    log.info("📌 按下ESC关闭派蒙菜单，准备重试");
                    await genshin.returnMainUi();
                    await sleep(2500);
                    throw new Error(`UID识别结果无效：${extractedUid || "空"}（需要9位数字）`);
                }
                
                checkResult.accountUid = extractedUid;
                log.info(`✅ 当前账号UID：${Utils.maskUid(checkResult.accountUid)}`);
                log.info("📌 按下ESC关闭派蒙菜单，返回主界面");
                keyPress("VK_ESCAPE");
                await sleep(1500);
            }, "当前账号UID识别");
        } catch (e) {
            log.error(`❌ UID识别失败：${e.message}，使用兜底标识${Constants.DEFAULT_UID}`);
            checkResult.accountUid = Constants.DEFAULT_UID;
        }
        return checkResult.accountUid;
    },
    
    // 检查脚本冷却
    checkScriptCooldown: function(scriptPath, cooldown, cooldownRecord, currentUid) {
        const uidRecord = cooldownRecord[currentUid] || {};
        const lastExec = uidRecord[scriptPath] || 0;
        if (lastExec === 0) return true;
        
        const now = Utils.getNow();
        const elapsed = now - lastExec;
        const remaining = cooldown - elapsed;
        
        if (elapsed < cooldown) {
            log.info(`[${Utils.maskUid(currentUid)}] 脚本冷却中：${scriptPath.split('/').pop()}，已过${(elapsed/3600000).toFixed(1)}小时，还需${(remaining/3600000).toFixed(1)}小时`);
            return false;
        }
        return true;
    },
    
    // 更新脚本冷却记录
    updateScriptCooldown: function(scriptPath, cooldownRecord, currentUid) {
        if (!cooldownRecord[currentUid]) {
            cooldownRecord[currentUid] = {};
        }
        cooldownRecord[currentUid][scriptPath] = Utils.getNow();
        file.writeTextSync(Constants.SCRIPT_COOLDOWN_RECORD, JSON.stringify(cooldownRecord, null, 2));
        log.info(`[${Utils.maskUid(currentUid)}] 脚本冷却记录已更新: ${scriptPath.split('/').pop()}`);
    },
    
    // 清理过期冷却记录
    cleanExpiredCooldownRecords: function(cooldownRecord, currentUid) {
        if (!cooldownRecord[currentUid]) return;
        
        const uidRecord = cooldownRecord[currentUid];
        const now = Utils.getNow();
        let cleanedCount = 0;
        
        for (const scriptPath in uidRecord) {
            if (uidRecord.hasOwnProperty(scriptPath)) {
                const lastExec = uidRecord[scriptPath];
                const elapsed = now - lastExec;
                
                let cooldown;
                if (scriptPath.includes("地方特产")) {
                    cooldown = Constants.COOLDOWN_LOCAL;
                } else if (scriptPath.includes("敌人与魔物")) {
                    cooldown = Constants.COOLDOWN_MAGIC;
                } else if (scriptPath.includes("武器1")) {
                    cooldown = Constants.COOLDOWN_WEAPONS1;
                } else if (scriptPath.includes("武器2")) {
                    cooldown = Constants.COOLDOWN_WEAPONS2;
                } else {
                    continue;
                }
                
                if (elapsed >= cooldown) {
                    delete uidRecord[scriptPath];
                    cleanedCount++;
                }
            }
        }
        
        if (Object.keys(uidRecord).length === 0) {
            delete cooldownRecord[currentUid];
        }
        
        if (cleanedCount > 0) {
            file.writeTextSync(Constants.SCRIPT_COOLDOWN_RECORD, JSON.stringify(cooldownRecord, null, 2));
            log.info(`[${Utils.maskUid(currentUid)}] 已清理${cleanedCount}条过期冷却记录`);
        }
    },
    
    // 记录异常路径
    recordAbnormalPath: function(scriptPath, scriptName) {
        try {
            let abnormalRecord = Utils.readJson(Constants.ABNORMAL_PATHS_RECORD, {});
            if (!abnormalRecord.paths) {
                abnormalRecord.paths = {};
            }
            
            if (!abnormalRecord.paths[scriptPath]) {
                abnormalRecord.paths[scriptPath] = {
                    name: scriptName,
                    firstDetected: Utils.getNow(),
                    detectedCount: 1
                };
                log.info(`[异常路径] 新增异常路径记录：${scriptName}（${scriptPath}）`);
            } else {
                abnormalRecord.paths[scriptPath].detectedCount++;
                abnormalRecord.paths[scriptPath].lastDetected = Utils.getNow();
                log.info(`[异常路径] 更新异常路径记录：${scriptName}（第${abnormalRecord.paths[scriptPath].detectedCount}次检测）`);
            }
            
            file.writeTextSync(Constants.ABNORMAL_PATHS_RECORD, JSON.stringify(abnormalRecord, null, 2));
        } catch (e) {
            log.error(`[异常路径] 记录异常路径失败：${e.message}`);
        }
    },
    
    // 过滤掉异常路径
    filterAbnormalPaths: function(scriptList) {
        try {
            const abnormalRecord = Utils.readJson(Constants.ABNORMAL_PATHS_RECORD, {});
            if (!abnormalRecord.paths || Object.keys(abnormalRecord.paths).length === 0) {
                return scriptList;
            }
            
            const abnormalPaths = Object.keys(abnormalRecord.paths);
            const filteredScripts = [];
            const skippedScripts = [];
            
            for (const script of scriptList) {
                if (abnormalPaths.includes(script.path)) {
                    skippedScripts.push(script.name);
                } else {
                    filteredScripts.push(script);
                }
            }
            
            if (skippedScripts.length > 0) {
                log.info(`[异常路径] 已过滤${skippedScripts.length}个异常路径：${skippedScripts.join(', ')}`);
            }
            
            return filteredScripts;
        } catch (e) {
            log.error(`[异常路径] 过滤异常路径失败：${e.message}`);
            return scriptList;
        }
    },
    
    // 根据冷却过滤脚本
    filterScriptsByCooldown: function(scriptList, cooldown, cooldownRecord, currentUid) {
        const availableScripts = [];
        const coolingScripts = [];
        
        for (const script of scriptList) {
            if (this.checkScriptCooldown(script.path, cooldown, cooldownRecord, currentUid)) {
                availableScripts.push(script);
            } else {
                coolingScripts.push(script.name);
            }
        }
        
        if (coolingScripts.length > 0) {
            log.info(`[${Utils.maskUid(currentUid)}] ${coolingScripts.length}个脚本在冷却中，已跳过：${coolingScripts.join(', ')}`);
        }
        
        log.info(`[${Utils.maskUid(currentUid)}] 脚本过滤结果：共${scriptList.length}个，可执行${availableScripts.length}个，冷却中${coolingScripts.length}个`);
        return availableScripts;
    },
    
    // 执行脚本
    executeScripts: async function(scriptList, startIndex, maxCount, currentUid, cooldown, cooldownRecord) {
        let isLastScriptSuccess = false;
        let isTaskCanceled = false;
        let executedCount = 0;
        const remainingScripts = [];
        const ABNORMAL_TIME_THRESHOLD = 9 * 60 * 1000;//多少分钟为异常阈值
        
        const endIndex = maxCount > 0 ? Math.min(startIndex + maxCount, scriptList.length) : scriptList.length;
        
        for (let i = startIndex; i < endIndex; i++) {
            if (isTaskCanceled) {
                log.warn(`[执行终止] 检测到任务取消，停止执行剩余脚本`);
                for (let j = i; j < scriptList.length; j++) {
                    remainingScripts.push(scriptList[j]);
                }
                break;
            }
            
            const script = scriptList[i];
            const isLast = i === endIndex - 1;
            
            try {
                log.info(`\n【执行第 ${i + 1}/${endIndex} 个脚本】`);
                log.info(`加载路径脚本：${script.path}`);
                let relativePath = script.path.startsWith("pathing/") ? script.path.substring(7) : script.path;
                relativePath = relativePath.replace(/^\/+/, '');
                
                const cancellation_token = dispatcher.getLinkedCancellationToken();
                const scriptStartTime = Date.now();
                await pathingScript.runFileFromUser(relativePath);
                const scriptElapsedTime = Date.now() - scriptStartTime;
                
                if (cancellation_token.isCancellationRequested) {
                    log.error(`[任务取消] 检测到手动取消任务，终止所有脚本执行`);
                    isTaskCanceled = true;
                    for (let k = i; k < scriptList.length; k++) {
                        remainingScripts.push(scriptList[k]);
                    }
                    throw new Error("Cancelled");
                }
                
                if (scriptElapsedTime >= ABNORMAL_TIME_THRESHOLD) {
                    log.warn(`[异常路径] 脚本执行时间${(scriptElapsedTime / 60000).toFixed(1)}分钟，超过9分钟阈值`);
                    log.warn(`[异常路径] 标记为异常路径：${script.name}`);
                    this.recordAbnormalPath(script.path, script.name);
                }
                
                executedCount++;
                
                log.info(`✅ 脚本执行成功：${script.name}（预计获取${script.count || 0}个材料），耗时${(scriptElapsedTime / 1000).toFixed(1)}秒`);
                
                //log.info(`📌 开始OCR识别弹窗文字并处理`);
                await this.handlePopupByOCR();
                
                if (cooldown && cooldownRecord) {
                    this.updateScriptCooldown(script.path, cooldownRecord, currentUid);
                }
                
                if (isLast) isLastScriptSuccess = true;
                await sleep(500);
            } catch (e) {
                log.error(`❌ 脚本执行失败 [${script.name}]：${e.message}`);
                if (e.message === "Cancelled") {
                    isTaskCanceled = true;
                    log.error(`[任务取消] 检测到手动取消任务，终止所有脚本执行`);
                    for (let k = i; k < scriptList.length; k++) {
                        remainingScripts.push(scriptList[k]);
                    }
                }
                if (isLast) isLastScriptSuccess = false;
                if (!isTaskCanceled) continue;
                else break;
            }
        }
        
        if (!isTaskCanceled && endIndex < scriptList.length) {
            for (let m = endIndex; m < scriptList.length; m++) {
                remainingScripts.push(scriptList[m]);
            }
        }
        
        return { isLastSuccess: isLastScriptSuccess, executedCount, remainingScripts };
    },
    
    // 获取起始索引（基于冷却记录）
    getStartIndex: function(scriptList, currentUid, cooldownRecord, type) {
        let startIndex = 0;
        let cooldown;
        
        switch (type) {
            case "local": cooldown = Constants.COOLDOWN_LOCAL; break;
            case "magic": cooldown = Constants.COOLDOWN_MAGIC; break;
            case "weapons1": cooldown = Constants.COOLDOWN_WEAPONS1; break;
            case "weapons2": cooldown = Constants.COOLDOWN_WEAPONS2; break;
            default: cooldown = 0;
        }
        
        const uidRecord = cooldownRecord[currentUid] || {};
        
        for (let i = 0; i < scriptList.length; i++) {
            const script = scriptList[i];
            const lastExec = uidRecord[script.path];
            
            if (lastExec) {
                const now = Utils.getNow();
                const elapsed = now - lastExec;
                
                if (elapsed < cooldown) {
                    startIndex = i + 1;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        if (startIndex > 0) {
            const lastScript = scriptList[startIndex - 1]?.name || "未知";
            log.info(`📌 检测到冷却记录，最后执行：【${lastScript}】，从第${startIndex + 1}个脚本继续执行`);
        } else {
            log.info("📌 无冷却记录或已全部过期，从头开始执行");
        }
        
        return startIndex;
    },
    
    // 提取魔物关键词
    extractAllMagicKeywords: function(config) {
        const magicKeywords = [];
        const value = config["Magic material0"] ? config["Magic material0"].trim() : "";
        if (value) {
            const keywords = value.split(",").map(k => k.trim()).filter(k => k);
            magicKeywords.push(...keywords);
        }
        return magicKeywords;
    },
    
    // 提取武器1关键词
    extractAllWeapons1Keywords: function(config) {
        const weapons1Keywords = [];
        const value = config["Weapons1 material0"] ? config["Weapons1 material0"].trim() : "";
        if (value) {
            const keywords = value.split(",").map(k => k.trim()).filter(k => k);
            weapons1Keywords.push(...keywords);
        }
        return weapons1Keywords;
    },
    
    // 处理弹窗（OCR识别并点击）
    handlePopupByOCR: async function() {
        const popupRegion = { x: 722, y: 726, width: 507, height: 65 };
        const checkInterval = 100;
        const maxChecks = 10;
        
        log.info(`🔍 开始检测弹窗（区域：x${popupRegion.x}, y${popupRegion.y}, w${popupRegion.width}, h${popupRegion.height}）`);
        
        for (let i = 0; i < maxChecks; i++) {
            try {
                const textPositions = await Utils.ocrRecognize(popupRegion.x, popupRegion.y, popupRegion.width, popupRegion.height, true);
                
                if (textPositions.length > 0) {
                    const hasConfirm = textPositions.some(t => t.text.includes("确认"));
                    const hasCancel = textPositions.some(t => t.text.includes("取消"));
                    
                    if (hasCancel && hasConfirm) {
                        log.info(`⚠️ 检测到"弹窗"，优先点击"取消"`);
                        const cancelPos = textPositions.find(t => t.text.includes("取消"));
                        if (cancelPos) {
                            click(cancelPos.x + 25, cancelPos.y + 32);
                            log.info(`📌 点击"取消"按钮，等待返回主界面`);                           
                            await genshin.returnMainUi();
                            return true;
                        }
                    } else if (hasConfirm) {
                        log.info(`⚠️ 检测到"网络超时"，点击"确认"按钮`);
                        const confirmPos = textPositions.find(t => t.text.includes("确认"));
                        if (confirmPos) {
                            click(confirmPos.x + 25, confirmPos.y + 32);
                            log.info(`📌 点击"确认"按钮，等待返回主界面`);
                            await sleep(15000);
                            await click(971, 757);
                            await sleep(4000);
                            await genshin.returnMainUi();
                            return true;
                        }
                    }
                }
            } catch (e) {
                //log.warn(`弹窗检测失败（第${i + 1}次）：${e.message}`);
            }
            
            await sleep(checkInterval);
        }
        
        return false;
    },
    
    // 提取武器2关键词
    extractAllWeapons2Keywords: function(config) {
        const weapons2Keywords = [];
        const value = config["Weapons2 material0"] ? config["Weapons2 material0"].trim() : "";
        if (value) {
            const keywords = value.split(",").map(k => k.trim()).filter(k => k);
            weapons2Keywords.push(...keywords);
        }
        return weapons2Keywords;
    }
};
