eval(file.readTextSync("lib/file.js"));
// ========================【检测码模块】========================
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
 * 读取user目录检测码记录文件
 * 返回结构：key:原始文件路径, value:{code:string, virtualKey:string}
 * @returns {Object}
 */
function loadContentCodeRecord() {
    const recordPath = "user/content_code_record.json";
    if (!fileExists(recordPath)) {
        return {};
    }
    try {
        const txt = safeReadTextSync(recordPath);
        return JSON.parse(txt);
    } catch (e) {
        log.warn(`读取检测码记录失败，重置为空:${e.message}`);
        return {};
    }
}
/**
 * 保存检测码记录到user目录
 * @param {Object} recordObj
 */
function saveContentCodeRecord(recordObj) {
    const recordPath = "user/content_code_record.json";
    try {
        const str = JSON.stringify(recordObj, null, 2);
        writeFile(recordPath, str, false);
    } catch (e) {
        log.error(`保存检测码记录失败:${e.message}`);
    }
}
// ========================【材料CD解析模块】========================
// 解析文件内容，提取材料信息
function parseMaterialContent(content) {
    if (!content) {
        log.warn(`文件内容为空`);
        return {};
    }
    const lines = content.split('\n').map(line => line.trim());
    const materialInfo = {};
    lines.forEach(line => {
        if (!line.includes('：')) {
            return;
        }
        const [refreshCD, materials] = line.split('：');
        if (!refreshCD || !materials) {
            return;
        }
        let refreshCDInHours;
        if (refreshCD.includes('次0点')) {
            const times = parseInt(refreshCD.split('次')[0], 10);
            if (isNaN(times)) {
                log.error(`无效的刷新时间格式：${refreshCD}`);
                return;
            }
            refreshCDInHours = { type: 'midnight', times: times };
        } else if (refreshCD.includes('点')) {
            const hours = parseFloat(refreshCD.replace('点', ''));
            if (isNaN(hours)) {
                log.error(`无效的刷新时间格式：${refreshCD}`);
                return;
            }
            refreshCDInHours = { type: 'specific', hour: hours };
        } else if (refreshCD.includes('小时')) {
            const hours = parseFloat(refreshCD.replace('小时', ''));
            if (isNaN(hours)) {
                log.error(`无效的刷新时间格式：${refreshCD}`);
                return;
            }
            refreshCDInHours = hours;
        } else if (refreshCD === '即时刷新') {
            refreshCDInHours = { type: 'instant' };
        } else {
            log.error(`未知的刷新时间格式：${refreshCD}`);
            return;
        }
        const materialList = materials.split(/[,，]\s*/).map(material => material.trim()).filter(material => material !== '');
        materialInfo[JSON.stringify(refreshCDInHours)] = materialList;
    });
    return materialInfo;
}
// 从路径中提取材料名
function extractResourceNameFromPath(filePath, cdMaterialNames) {
  const pathParts = filePath.split(/[\\/]/); // 分割路径，兼容 \ 和 /
  const validMaterials = [];
  const MAX_PATH_DEPTH = 6; // 最多扫描6层
  // 检查前MAX_PATH_DEPTH层目录
  for (let i = 1; i <= MAX_PATH_DEPTH && i < pathParts.length; i++) {
    const folderName = pathParts[i].trim();
    // 匹配CD中的材料名
    if (folderName && cdMaterialNames.has(folderName)) {
      validMaterials.push({ name: folderName, depth: i });
    }
  }
  // 确定材料名（取最外层匹配）
  let materialName = null;
  if (validMaterials.length > 0) {
    validMaterials.sort((a, b) => a.depth - b.depth);
    materialName = validMaterials[0].name;
  }
  return { materialName };
}
// 从 materialsCD 文件夹中读取分类信息
function readMaterialCategories(materialDir) {
    const materialFilePaths = readAllFilePaths(materialDir);
    const materialCategories = {};
    for (const filePath of materialFilePaths) {
        const content = safeReadTextSync(filePath);
        if (!content) {
            log.error(`加载文件失败：${filePath}`);
            continue;
        }
        const sourceCategory = basename(filePath).replace('.txt', '');
        materialCategories[sourceCategory] = parseMaterialContent(content);
    }
    return materialCategories;
}
// 获取当前时间（以小时为单位）
function getCurrentTimeInHours() {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}
// 记录运行时间到材料对应的文件中
function recordRunTime(resourceName, pathName, startTime, endTime, runTime) {
    const recordPath = `pathing_record/${resourceName}.txt`;
    const content = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n\n`;
    try {
        if (runTime >= 3) {
            const result = writeFile(recordPath, content, true, 3650);
            if (result) {
                log.info(`记录运行时间成功: ${recordPath}`);
            } else {
                log.error(`记录运行时间失败: ${recordPath}`);
            }
        } else {
            log.info(`运行时间小于3秒，请检查路径要求: ${recordPath}`);
        }
    } catch (error) {
        log.error(`记录运行时间失败: ${error}`);
    }
}
// 读取材料对应的文件，获取上次运行的结束时间
function getLastRunEndTime(resourceName, pathName) {
    const recordPath = `pathing_record/${resourceName}.txt`;
    try {
        const content = safeReadTextSync(recordPath);
        const lines = content.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].startsWith('路径名: ')) {
                const currentPathName = lines[i].split('路径名: ')[1];
                if (currentPathName === pathName) {
                    const endTimeLine = lines[i + 2];
                    if (endTimeLine.startsWith('结束时间: ')) {
                        return endTimeLine.split('结束时间: ')[1];
                    }
                }
            }
        }
    } catch (error) {
        log.warn(`未找到记录文件或记录文件中无结束时间: ${recordPath}`);
    }
    return null;
}
// 判断是否可以运行脚本
function canRunPathingFile(currentTime, lastEndTime, refreshCD) {
    if (!lastEndTime) {
        return true;
    }
    const lastEndTimeDate = new Date(lastEndTime);
    const currentDate = new Date();
    if (typeof refreshCD === 'object') {
        if (refreshCD.type === 'midnight') {
            const times = refreshCD.times;
            let daysPassed = Math.floor((currentDate - lastEndTimeDate) / (1000 * 60 * 60 * 24));
            const nextRunTime = new Date(lastEndTimeDate);
            nextRunTime.setDate(lastEndTimeDate.getDate() + times);
            nextRunTime.setHours(0, 0, 0, 0);
            const canRun = currentDate >= nextRunTime;
            log.info(`路径文件上次运行时间：${lastEndTimeDate.toLocaleString()}，下次运行时间：${nextRunTime.toLocaleString()}`);
            log.info(`是否可以运行：${canRun}`);
            return canRun;
        } else if (refreshCD.type === 'specific') {
            const specificHour = refreshCD.hour;
            const currentHour = currentDate.getHours();
            const lastEndHour = lastEndTimeDate.getHours();
            if (currentHour === specificHour && currentDate.getDate() !== lastEndTimeDate.getDate()) {
                return true;
            }
            const nextRunTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), specificHour);
            if (currentHour >= specificHour) {
                nextRunTime.setDate(nextRunTime.getDate() + 1);
            }
            log.info(`路径文件上次运行时间：${lastEndTimeDate.toLocaleString()}，下次运行时间：${nextRunTime.toLocaleString()}`);
            return false;
        } else if (refreshCD.type === 'instant') {
            return true;
        }
    } else {
        const nextRefreshTime = new Date(lastEndTimeDate.getTime() + refreshCD * 3600 * 1000);
        log.info(`路径文件上次运行时间：${lastEndTimeDate.toLocaleString()}，下次运行时间：${nextRefreshTime.toLocaleString()}`);
        return currentDate >= nextRefreshTime;
    }
    return false;
}
// ========================【fight转换模块】========================
/**
 * 处理单一路径json对象：替换 fight 节点
 * 规则：action == "fight" 并且 action_params是空字符串
 * @param {object} pathData 原始路径json对象
 * @returns {object} 修改后的pathData
 */
function convertFightToCombatScript(pathData) {
    if (!pathData || !Array.isArray(pathData.positions)) {
        return pathData;
    }
    // 深拷贝避免修改原对象
    const newData = JSON.parse(JSON.stringify(pathData));
    const vkKey = settings.virtualKey || "VK_END";
    log.info(`[按键调试] settings.virtualKey原始值：${settings.virtualKey}，最终使用按键：${vkKey}`);
    for (const pos of newData.positions) {
        if (pos.action === "fight" && pos.action_params === "") {
            pos.action = "combat_script";
            pos.action_params = `keypress(${vkKey})`;
            log.info(`[转换] 找到fight节点，替换为：${pos.action_params}`);
        }
    }
    return newData;
}
/**
 * 增强版JSON格式修复（和你原始脚本完全一样）
 * @param {string} jsonStr
 * @returns {string}
 */
function fixJsonFormat(jsonStr) {
    return jsonStr
        .replace(/,\s*([\]}])/g, ' $1')
        .trim();
}
/**
 * 修改：不再生成时间后缀，直接返回目标路径，同名直接覆盖
 * @param {string} basePath
 * @returns {string}
 */
function getUniqueFilePath(basePath) {
    // 直接返回原路径，不追加时间戳，覆盖写入
    return basePath;
}

async function convertMain() {
    const sourceDir = "pathing";
    const outputRoot = "user/output_combat_convert"; //输出目录迁移到user下
    const maxDepth = 5;
    const pathFiles = readAllFilePaths(sourceDir, 0, maxDepth, ['.json']);
    const currentVK = settings.virtualKey // ?? "VK_END";
    log.info(`[战斗转换模块] 当前全局转换按键：${currentVK}，共找到${pathFiles.length}个路径文件待处理`);
    // 加载已有的检测码记录
    const oldCodeRecord = loadContentCodeRecord();
    const newCodeRecord = {};
    let successCount = 0;
    let skipCount = 0;

    for (const pathFile of pathFiles) {
        try {
            const normalizedPath = pathFile.replace(/\\/g, '/');
            const fileName = basename(normalizedPath);
            const rawContent = safeReadTextSync(normalizedPath);
            if (!rawContent) {
                log.warn(`⚠️  ${fileName} 读取失败，跳过`);
                skipCount++;
                continue;
            }
            const fixedContent = fixJsonFormat(rawContent);
            const pathData = JSON.parse(fixedContent);

            // 【第一步：先判断是否含有fight节点，无fight直接跳过，不进codeRecord逻辑】
            let hasFight = false;
            if (Array.isArray(pathData.positions)) {
                hasFight = pathData.positions.some(p => p.action === "fight");
            }
            if (!hasFight) {
                log.info(`ℹ️ ${fileName} 不存在fight节点，跳过`);
                skipCount++;
                continue;
            }

            //【第二步：存在fight，读取旧记录】
            const recordItem = oldCodeRecord[normalizedPath];
            const currentCode = generateContentCode(pathData.positions);
            let needReConvert = true;

            if(recordItem){
                //旧记录按键为空，强制重转
                if (recordItem.virtualKey === "") {
                    log.info(`🔄 ${fileName} 旧记录按键为空，强制重新转换修复`);
                    needReConvert = true;
                } else if(recordItem.code === currentCode && recordItem.virtualKey === currentVK){
                    needReConvert = false;
                    log.info(`✅ ${fileName} 检测码&按键一致，跳过转换`);
                    newCodeRecord[normalizedPath] = recordItem;
                }else{
                    log.info(`🔄 ${fileName} 检测码相同但按键变更 / 检测码变更，强制重新转换`);
                    needReConvert = true;
                }
            }

            if(!needReConvert){
                skipCount++;
                continue;
            }

            const convertedData = convertFightToCombatScript(pathData);
            const afterPathing = normalizedPath.replace(/^pathing\//, "");
            const outFullPath = `${outputRoot}/${afterPathing}`;
            const finalOutPath = getUniqueFilePath(outFullPath);
            const writeContent = JSON.stringify(convertedData, null, 2);
            const writeResult = writeFile(finalOutPath, writeContent, false);
            if (writeResult) {
                log.info(`✅ ${fileName} → ${finalOutPath}`);
                successCount++;
                // 更新记录：保存检测码 + 当前使用的virtualKey
                newCodeRecord[normalizedPath] = {
                    code: currentCode,
                    virtualKey: currentVK
                };
            } else {
                log.error(`❌ 写入文件失败: ${finalOutPath}`);
                skipCount++;
            }
        } catch (error) {
            log.error(`❌ 处理${basename(pathFile)}出错: ${error.message}`);
            skipCount++;
        }
    }
    // 全部处理完毕，保存新的检测码记录文件，自动丢弃旧脏记录
    saveContentCodeRecord(newCodeRecord);
    log.info(`\n====战斗节点转换完成====\n成功处理：${successCount} 个\n跳过/失败：${skipCount} 个`);
}

// ========================【路径运行模块】========================
// 转换完成后，运行user/output_combat_convert目录路径【增加codeRecord+检测码校验，运行不比对virtualKey】
async function runConvertedPath() {
    const materialDir = "materialsCD";
    const runDir = "user/output_combat_convert";
    try {
        // 加载检测码记录
        const codeRecord = loadContentCodeRecord();
        const materialCategories = readMaterialCategories(materialDir);
        // 构建材料名Set
        const cdMaterialNames = new Set();
        for (const category of Object.values(materialCategories)) {
            for (const materialList of Object.values(category)) {
                materialList.forEach(name => cdMaterialNames.add(name));
            }
        }
        const pathingFilePaths = readAllFilePaths(runDir);
        for (const pathingFilePath of pathingFilePaths) {
            //输出路径反向还原原始源路径
            let srcFilePath = pathingFilePath.replace(/^user[\\/]output_combat_convert[\\/]/, "pathing/");
            srcFilePath = srcFilePath.replace(/\\/g, '/');


            // 不在codeRecord里面，禁止执行
            if (!codeRecord.hasOwnProperty(srcFilePath)) {
                log.info(`ℹ️ ${pathingFilePath} 源路径不在codeRecord记录内，跳过执行`);
                continue;
            }
            const savedRecord = codeRecord[srcFilePath];
            //读取原始源文件，重新计算检测码比对
            let srcText;
            try {
                srcText = safeReadTextSync(srcFilePath);
                if (!srcText) throw new Error("源文件读取为空");
                const srcFixed = fixJsonFormat(srcText);
                const srcData = JSON.parse(srcFixed);
                const realCode = generateContentCode(srcData.positions);
                if (realCode !== savedRecord.code) {
                    log.info(`ℹ️ ${pathingFilePath} 源文件检测码和记录不一致，跳过执行`);
                    continue;
                }
            } catch (e) {
                log.warn(`⚠️ 读取源文件${srcFilePath}失败，跳过执行:${e.message}`);
                continue;
            }

            // 检测码校验通过，继续原有CD逻辑
            const { materialName } = extractResourceNameFromPath(pathingFilePath, cdMaterialNames);
            if (!materialName) {
                log.warn(`无法提取材料名：${pathingFilePath}`);
                continue;
            }
            const pathName = basename(pathingFilePath);
            log.info(`处理路径文件：${pathingFilePath}，材料名：${materialName}，材料路径：${pathName}`);
            let categoryFound = false;
            for (const [category, materials] of Object.entries(materialCategories)) {
                for (const [refreshCDKey, materialList] of Object.entries(materials)) {
                    const refreshCD = JSON.parse(refreshCDKey);
                    if (materialList.includes(materialName)) {
                        const currentTime = getCurrentTimeInHours();
                        const lastEndTime = getLastRunEndTime(materialName, pathName);
                        categoryFound = true;
                        if (canRunPathingFile(currentTime, lastEndTime, refreshCD)) {
                            log.info(`可以调用路径文件：${pathName}`);
                            const startTime = new Date().toLocaleString();
                            await pathingScript.runFile(pathingFilePath);
                            await sleep(1000);
                            const endTime = new Date().toLocaleString();
                            const runTime = (new Date(endTime) - new Date(startTime)) / 1000;
                            recordRunTime(materialName, pathName, startTime, endTime, runTime);
                        } else {
                            log.info(`路径文件 ${pathName} 还未到刷新时间`);
                        }
                        break;
                    }
                }
                if (categoryFound) break;
            }
            if (!categoryFound) {
                log.warn(`未找到材料 ${materialName} 的分类信息，路径文件：${pathName}`);
            }
        }
    } catch (error) {
        log.error(`执行转换后路径失败: ${error}`);
    }
}

// ========================【入口函数】========================
// 总入口：settings.noReload为true，跳过转换，直接运行
(async function () {
	// =========新增校验=========
    if (!settings.virtualKey || settings.virtualKey.trim() === "") {
		log.error("================================================");
        log.error("请在自定义设置里填入BGI快捷键中的暂停键，未配置无法执行！");
		log.error("================================================");
        return;
    }
    // noReload 为true，则不执行转换
    if (!settings.noReload) {
        await convertMain();
    }else{
        log.info(`settings.noReload=true，跳过路径转换流程`);
    }
    await runConvertedPath();
})();
