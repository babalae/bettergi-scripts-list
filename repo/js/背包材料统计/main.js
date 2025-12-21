// ==============================================
// 常量与配置（集中管理硬编码值）
// ==============================================
const CONSTANTS = {
  // 路径与目录配置
  MATERIAL_CD_DIR: "materialsCD",
  TARGET_TEXT_DIR: "targetText",
  PATHING_DIR: "pathing",
  RECORD_DIR: "pathing_record",
  NO_RECORD_DIR: "pathing_record/noRecord",
  IMAGES_DIR: "assets/images",
  MONSTER_MATERIALS_PATH: "assets/Monster-Materials.txt",
  
  // 解析与处理配置
  MAX_PATH_DEPTH: 3, // 路径解析最大深度
  NOTIFICATION_CHUNK_SIZE: 500, // 通知拆分长度
  FOOD_EXP_RECORD_SUFFIX: "_狗粮.txt",
  SUMMARY_FILE_NAME: "材料收集汇总.txt",
  ZERO_COUNT_SUFFIX: "-0.txt",
  
  // 日志模块标识
  LOG_MODULES: {
    INIT: "[初始化]",
    PATH: "[路径处理]",
    MATERIAL: "[材料管理]",
    MONSTER: "[怪物映射]",
    CD: "[CD控制]",
    RECORD: "[记录管理]",
    MAIN: "[主流程]"
  }
};

// ==============================================
// 引入外部脚本（源码不变）
// ==============================================
eval(file.readTextSync("lib/file.js"));
eval(file.readTextSync("lib/ocr.js"));
eval(file.readTextSync("lib/autoPick.js"));
eval(file.readTextSync("lib/exp.js"));
eval(file.readTextSync("lib/backStats.js"));
eval(file.readTextSync("lib/imageClick.js"));
eval(file.readTextSync("lib/displacement.js"));

// ==============================================
// 全局状态（保持不变）
// ==============================================
var state = { completed: false, cancelRequested: false };

// ==============================================
// 初始化配置参数
// ==============================================
const timeCost = Math.min(300, Math.max(0, Math.floor(Number(settings.TimeCost) || 30)));
const notify = settings.notify || false;
const noRecord = settings.noRecord || false;
const targetCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.TargetCount) || 5000))); // 设定的目标数量
const exceedCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.ExceedCount) || 5000))); // 设定的超量目标数量
const endTimeStr = settings.CurrentTime ? settings.CurrentTime : null; 

// 解析需要处理的CD分类
const allowedCDCategories = (settings.CDCategories || "")
  .split(/[,，、 \s]+/)
  .map(cat => cat.trim())
  .filter(cat => cat !== "");

if (allowedCDCategories.length > 0) {
  log.info(`${CONSTANTS.LOG_MODULES.INIT}已配置只处理以下CD分类：${allowedCDCategories.join('、')}`);
} else {
  log.info(`${CONSTANTS.LOG_MODULES.INIT}未配置CD分类过滤，将处理所有分类`);
}

// ==============================================
// 材料与怪物映射管理
// ==============================================
// 材料分类映射
const material_mapping = {
  "General": "一般素材",
  "Drops": "怪物掉落素材",
  "CookingIngs": "烹饪食材",
  "ForagedFood": "采集食物",
  "Weekly": "周本素材",
  "Wood": "木材",
  "CharAscension": "角色突破素材",
  "Fishing": "鱼饵鱼类",
  "Smithing": "锻造素材",
  "Gems": "宝石",
  "Talent": "角色天赋素材",
  "WeaponAscension": "武器突破素材",
};

// 怪物-材料映射（双向，优化为Set提高查找效率）
let monsterToMaterials = {}; // 怪物名 -> [掉落材料列表]
let materialToMonsters = {}; // 材料名 -> Set(关联怪物列表)

/**
 * 解析怪物-材料映射文件，初始化双向映射
 * 优化点：使用Set存储材料对应的怪物，提高存在性判断效率
 */
function parseMonsterMaterials() {
  try {
    const content = file.readTextSync(CONSTANTS.MONSTER_MATERIALS_PATH);
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    lines.forEach(line => {
      if (!line.includes('：')) return;
      const [monsterName, materialsStr] = line.split('：');
      const materials = materialsStr.split(/[,，、 \s]+/)
        .map(mat => mat.trim())
        .filter(mat => mat);
      
      if (monsterName && materials.length > 0) {
        monsterToMaterials[monsterName] = materials;
        materials.forEach(mat => {
          if (!materialToMonsters[mat]) {
            materialToMonsters[mat] = new Set(); // 用Set替代Array
          }
          materialToMonsters[mat].add(monsterName);
        });
      }
    });
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.MONSTER}解析怪物材料文件失败：${error.message}`);
  }
}
parseMonsterMaterials(); // 初始化怪物材料映射

// ==============================================
// 路径模式配置
// ==============================================
const pathingValue = settings.Pathing || '';
const pathingPrefix = String(pathingValue).split('.')[0];

const pathingMode = {
  includeBoth: pathingPrefix === "1",
  onlyPathing: pathingPrefix === "2",
  onlyCategory: pathingPrefix === "3"
};

const isInvalidMode = !pathingMode.includeBoth && !pathingMode.onlyPathing && !pathingMode.onlyCategory;
if (isInvalidMode) {
  log.warn(`${CONSTANTS.LOG_MODULES.PATH}检测到无效的Pathing设置（${pathingValue}），自动切换为【路径材料】专注模式`);
  pathingMode.onlyPathing = true;
}

if (pathingMode.includeBoth) log.warn(`${CONSTANTS.LOG_MODULES.PATH}默认模式，📁pathing材料 将覆盖 勾选的分类`);
if (pathingMode.onlyCategory) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【背包统计】专注模式，将忽略📁pathing材料`);
if (pathingMode.onlyPathing) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【路径材料】专注模式，将忽略勾选的分类`);

// ==============================================
// 材料分类处理
// ==============================================
/**
 * 初始化并筛选选中的材料分类
 * @returns {string[]} 选中的材料分类列表
 */
function getSelectedMaterialCategories() {
  const initialSettings = Object.keys(material_mapping).reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

  const finalSettings = Object.keys(initialSettings).reduce((acc, key) => {
    // 若settings中有该键则使用其值，否则用默认的false（确保只处理material_mapping中的键）
    acc[key] = settings.hasOwnProperty(key) ? settings[key] : initialSettings[key];
    return acc;
  }, {});

  return Object.keys(finalSettings)
    .filter(key => key !== "unselected") 
    .filter(key => {
      if (typeof finalSettings[key] !== 'boolean') {
        log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}非布尔值的键: ${key}, 值: ${finalSettings[key]}`);
        return false;
      }
      return finalSettings[key];
    })
    .map(name => {
      if (!material_mapping[name]) {
        log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}material_mapping中缺失的键: ${name}`);
        return null;
      }
      return material_mapping[name];
    })
    .filter(name => name !== null);
}

const selected_materials_array = getSelectedMaterialCategories();

// ==============================================
// CD内容解析
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
    materialCDInfo[JSON.stringify(refreshCDInHours)] = materials
      .split(/[,，]\s*/)
      .map(material => material.trim())
      .filter(material => material !== '');
  });

  return materialCDInfo;
}

// ==============================================
// 路径资源提取（复用并优化）
// ==============================================
/**
 * 从路径中提取材料名和怪物名（基于目录结构）
 * @param {string} filePath - 路径文件路径
 * @param {Set} cdMaterialNames - CD中存在的材料名集合
 * @returns {Object} { materialName, monsterName }
 */
function extractResourceNameFromPath(filePath, cdMaterialNames) {
  const pathParts = filePath.split(/[\\/]/); // 分割路径
  const validMaterials = []; // 材料名匹配结果
  const validMonsters = []; // 怪物名匹配结果

  // 检查前MAX_PATH_DEPTH层目录
  for (let i = 1; i <= CONSTANTS.MAX_PATH_DEPTH && i < pathParts.length; i++) {
    const folderName = pathParts[i].trim();
    // 匹配CD中的材料名
    if (folderName && cdMaterialNames.has(folderName)) {
      validMaterials.push({ name: folderName, depth: i });
    }
    // 匹配怪物映射中的怪物名
    if (folderName && monsterToMaterials[folderName]) {
      validMonsters.push({ name: folderName, depth: i });
    }
  }

  // 确定材料名（取最深层匹配）
  let materialName = null;
  if (validMaterials.length > 0) {
    validMaterials.sort((a, b) => a.depth - b.depth);
    materialName = validMaterials[0].name;
  }

  // 确定怪物名（取最深层匹配）
  let monsterName = null;
  if (validMonsters.length > 0) {
    validMonsters.sort((a, b) => a.depth - b.depth);
    monsterName = validMonsters[0].name;
  }

  return { materialName, monsterName };
}

// ==============================================
// CD分类加载
// ==============================================
/**
 * 读取并解析所有材料CD分类文件
 * @returns {Object} 分类名到CD信息的映射
 */
function readMaterialCD() {
  const materialFilePaths = readAllFilePaths(CONSTANTS.MATERIAL_CD_DIR, 0, 1, ['.txt']);
  const materialCDCategories = {};

  for (const filePath of materialFilePaths) {
    if (state.cancelRequested) break;
    const content = file.readTextSync(filePath);
    if (!content) {
      log.error(`${CONSTANTS.LOG_MODULES.CD}加载文件失败：${filePath}`);
      continue;
    }

    const sourceCategory = basename(filePath).replace('.txt', '');
    if (allowedCDCategories.length > 0 && !allowedCDCategories.includes(sourceCategory)) {
      log.debug(`${CONSTANTS.LOG_MODULES.CD}跳过未选中的CD分类文件：${filePath}`);
      continue;
    }
    materialCDCategories[sourceCategory] = parseMaterialContent(content);
  }
  return materialCDCategories;
}

// ==============================================
// 时间工具
// ==============================================
/**
 * 获取当前时间（小时，含小数）
 * @returns {number} 当前时间（小时）
 */
function getCurrentTimeInHours() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

/**
 * 计算当前时间到指定终止时间的剩余分钟数（处理跨天，单向倒计时）
 * @param {string} endTimeStr - 指定终止时间（格式"HH:mm"，如"4:00"）
 * @returns {number} 剩余分钟数（负数表示已过终止时间），无效格式返回-1
 */
function getRemainingMinutesToEndTime(endTimeStr) {
  // 1. 解析终止时间
  const [endHours, endMinutes] = endTimeStr.split(/[:：]/).map(Number);
  if (isNaN(endHours) || isNaN(endMinutes) || endHours < 0 || endHours >= 24 || endMinutes < 0 || endMinutes >= 60) {
    log.error(`${CONSTANTS.LOG_MODULES.MAIN}无效终止时间格式：${endTimeStr}，需为"HH:mm"（如"14:30"）`);
    return -1; // 无效格式视为“已过时间”
  }

  // 2. 转换为时间戳（当天终止时间 & 次日终止时间，处理跨天）
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHours, endMinutes);
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000); // 加1天

  // 3. 确定有效终止时间（若当天已过，取次日）
  const targetEndTime = now <= todayEnd ? todayEnd : tomorrowEnd;

  // 4. 计算剩余分钟数（毫秒转分钟，保留整数）
  const remainingMs = targetEndTime - now;
  return Math.floor(remainingMs / (1000 * 60));
}

// ==============================================
// 记录管理
// ==============================================
/**
 * 写入内容到文件（追加模式）
 * @param {string} filePath - 目标文件路径
 * @param {string} content - 要写入的内容
 */
function writeContentToFile(filePath, content) {
  try {
    let existingContent = '';
    try {
      existingContent = file.readTextSync(filePath);
    } catch (readError) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}文件不存在或读取失败: ${filePath}`);
    }

    const updatedContent = content + existingContent;
    const result = file.writeTextSync(filePath, updatedContent, false);
    if (result) {
      log.info(`${CONSTANTS.LOG_MODULES.RECORD}记录成功: ${filePath}`);
    } else {
      log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录失败: ${filePath}`);
    }
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录失败: ${error}`);
  }
}

/**
 * 检查路径名出现频率（避免重复无效路径）
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @returns {boolean} 是否允许运行（true=允许）
 */
function checkPathNameFrequency(resourceName, pathName, recordDir) {
  const recordPath = `${recordDir}/${resourceName}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
  let totalCount = 0;

  try {
    const content = file.readTextSync(recordPath);
    const lines = content.split('\n');

    lines.forEach(line => {
      if (line.startsWith('路径名: ') && line.split('路径名: ')[1] === pathName) {
        totalCount++;
      }
    });
  } catch (error) {
    log.debug(`${CONSTANTS.LOG_MODULES.RECORD}目录${recordDir}中无${resourceName}记录，跳过检查`);
  }

  if (totalCount >= 3) {
    log.info(`${CONSTANTS.LOG_MODULES.RECORD}路径文件: ${pathName}，普通模式累计0采集${totalCount}次，请清理记录后再执行`);
    return false;
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
 * @param {number} finalCumulativeDistance - 累计移动距离
 */
function recordRunTime(resourceName, pathName, startTime, endTime, runTime, recordDir, materialCountDifferences = {}, finalCumulativeDistance) {
  const recordPath = `${recordDir}/${resourceName}.txt`;
  const normalContent = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;

  try {
    if (runTime >= 3) { // 运行时间≥3秒才处理记录
      const isMonsterPath = monsterToMaterials.hasOwnProperty(resourceName); // 是否为怪物路径
      if (isMonsterPath) {
        // 1. 获取当前怪物对应的所有目标材料（从已有映射中取）
        const monsterTargetMaterials = monsterToMaterials[resourceName] || [];
        // 2. 计算这些材料的总数量变化（只累加目标材料，忽略其他无关材料）
        let monsterMaterialsTotal = 0;
        monsterTargetMaterials.forEach(targetMat => {
          monsterMaterialsTotal += (materialCountDifferences[targetMat] || 0);
        });
        // 3. 若总数量为0，生成怪物专用0记录文件（文件名含“总0”标识，避免混淆）
        if (monsterMaterialsTotal === 0) {
          const zeroMonsterPath = `${recordDir}/${resourceName}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
          const zeroMonsterContent = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMonsterPath, zeroMonsterContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}怪物【${resourceName}】对应材料总数量为0，已写入单独文件: ${zeroMonsterPath}`);
        }
      }

      for (const [material, count] of Object.entries(materialCountDifferences)) {
        if (material === resourceName && count === 0) {
          const zeroMaterialPath = `${recordDir}/${material}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
          const zeroMaterialContent = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMaterialPath, zeroMaterialContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}材料数目为0，已写入单独文件: ${zeroMaterialPath}`);
        }
      }

      const hasZeroMaterial = Object.values(materialCountDifferences).includes(0);
      const isFinalCumulativeDistanceZero = finalCumulativeDistance === 0;

      if (!(hasZeroMaterial && isFinalCumulativeDistanceZero)) {
        writeContentToFile(recordPath, normalContent);
        log.info(`${CONSTANTS.LOG_MODULES.RECORD}正常记录已写入: ${recordPath}`);
      } else {
        if (hasZeroMaterial) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}存在材料数目为0的情况: ${JSON.stringify(materialCountDifferences)}`);
        if (isFinalCumulativeDistanceZero) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}累计距离为0: finalCumulativeDistance=${finalCumulativeDistance}`);
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}未写入正常记录: ${recordPath}`);
      }
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}运行时间小于3秒，未满足记录条件: ${recordPath}`);
    }
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}记录运行时间失败: ${error}`);
  }
}

/**
 * 获取上次运行结束时间
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @returns {string|null} 上次结束时间字符串（null=无记录）
 */
function getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir) {
  const checkDirs = [recordDir, noRecordDir];
  let latestEndTime = null;

  checkDirs.forEach(dir => {
    const recordPath = `${dir}/${resourceName}.txt`;
    try {
      const content = file.readTextSync(recordPath);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('路径名: ') && lines[i].split('路径名: ')[1] === pathName) {
          const endTimeLine = lines[i + 2];
          if (endTimeLine?.startsWith('结束时间: ')) {
            const endTimeStr = endTimeLine.split('结束时间: ')[1];
            const endTime = new Date(endTimeStr);

            if (!latestEndTime || endTime > new Date(latestEndTime)) {
              latestEndTime = endTimeStr;
            }
          }
        }
      }
    } catch (error) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}目录${dir}中无${resourceName}记录，跳过检查`);
    }
  });

  return latestEndTime;
}

/**
 * 计算单次时间成本（平均耗时/材料数量）
 * @param {string} resourceName - 资源名（普通材料名/怪物名）
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @returns {number|null} 时间成本（秒/中级单位），null=无法计算
 */
function getHistoricalPathRecords(resourceKey, pathName, recordDir, noRecordDir, isFood = false, cache = {}) {
  // 1. 生成唯一缓存键（确保不同路径/不同文件的记录不混淆）
  const isFoodSuffix = isFood ? CONSTANTS.FOOD_EXP_RECORD_SUFFIX : ".txt";
  const recordFile = `${recordDir}/${resourceKey}${isFoodSuffix}`;
  const cacheKey = `${recordFile}|${pathName}`; // 键格式：文件路径|路径名

  // 2. 优先从缓存获取，命中则直接返回（不读文件）
  if (cache[cacheKey]) {
    log.debug(`${CONSTANTS.LOG_MODULES.RECORD}从缓存复用记录：${cacheKey}`);
    return cache[cacheKey];
  }

  // 3. 缓存未命中，才读取文件
  const records = [];
  let targetFile = recordFile;
  let content = "";

  // 读主目录→读备用目录
  try {
    content = file.readTextSync(targetFile);
  } catch (mainErr) {
    targetFile = `${noRecordDir}/${resourceKey}${isFoodSuffix}`;
    try {
      content = file.readTextSync(targetFile);
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}从备用目录读取记录：${targetFile}`);
    } catch (backupErr) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}无${resourceKey}的历史记录：${targetFile}`);
      // 空记录也写入缓存，避免下次重复尝试读文件
      cache[cacheKey] = records;
      return records;
    }
  }

  // 解析记录（按原有格式提取runTime和quantityChange）
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('路径名: ') && lines[i].split('路径名: ')[1] === pathName) {
      const runTimeLine = lines[i + 3];
      const quantityChangeLine = lines[i + 4] || "";
      let runTime = 0;
      let quantityChange = {};

      // 提取运行时间（秒）
      if (runTimeLine?.startsWith('运行时间: ')) {
        runTime = parseInt(runTimeLine.split('运行时间: ')[1].split('秒')[0], 10) || 0;
      }
      // 提取数量变化（JSON格式）
      if (quantityChangeLine.startsWith('数量变化: ')) {
        try {
          quantityChange = JSON.parse(quantityChangeLine.split('数量变化: ')[1]) || {};
        } catch (e) {
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}解析数量变化失败：${quantityChangeLine}`);
        }
      }

      if (runTime > 0) {
        records.push({ runTime, quantityChange });
      }
    }
  }

  // 4. 将读取到的记录写入缓存，供后续复用
  cache[cacheKey] = records;
  log.debug(`${CONSTANTS.LOG_MODULES.RECORD}读取记录并缓存：${cacheKey}（${records.length}条）`);
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
  const isFood = resourceName && isFoodResource(resourceName);
  let resourceKey = isFood ? resourceName : (monsterName || resourceName);

  // 无资源关联时，默认5分钟（300秒）
  if (!resourceKey) {
    log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}无资源关联，默认按300秒（5分钟）预估`);
    return 300;
  }

  // 调用公共函数获取记录（复用缓存）
  const historicalRecords = getHistoricalPathRecords(
    resourceKey, 
    pathName, 
    recordDir, 
    noRecordDir, 
    isFood, 
    cache
  );

  // 无记录时，默认5分钟（300秒）
  if (historicalRecords.length === 0) {
    log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}无有效runTime记录，默认按300秒（5分钟）预估`);
    return 300;
  }

  // 取最近5条记录计算平均值
  const recentRecords = [...historicalRecords].reverse().slice(0, 5);
  const avgRunTime = Math.round(
    recentRecords.reduce((sum, record) => sum + record.runTime, 0) / recentRecords.length
  );

  log.debug(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}历史runTime（最近5条）：${recentRecords.map(r => r.runTime)}秒，预估耗时：${avgRunTime}秒`);
  return avgRunTime;
}

/**
 * 计算单次时间成本（秒/单位材料）（复用缓存）
 * @param {string} resourceName - 资源名
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 备用目录
 * @param {boolean} isFood - 是否为狗粮路径
 * @param {Object} cache - 缓存对象
 * @returns {number|null} 时间成本
 */
function calculatePerTime(resourceName, pathName, recordDir, noRecordDir, isFood = false, cache = {}) {
  const isMonster = monsterToMaterials.hasOwnProperty(resourceName);
  // 调用公共函数获取记录（复用缓存）
  const historicalRecords = getHistoricalPathRecords(
    resourceName, 
    pathName, 
    recordDir, 
    noRecordDir, 
    isFood, 
    cache
  );

  // 有效记录不足3条，返回null
  if (historicalRecords.length < 3) {
    log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}有效记录不足3条，无法计算时间成本`);
    return null;
  }

  const completeRecords = [];
  if (isMonster) {
    // 怪物路径：按中级单位计算
    const monsterMaterials = monsterToMaterials[resourceName];
    const gradeRatios = [3, 1, 1/3]; // 最高级×3，中级×1，最低级×1/3

    historicalRecords.forEach(record => {
      const { runTime, quantityChange } = record;
      let totalMiddleCount = 0;

      monsterMaterials.forEach((mat, index) => {
        const count = quantityChange[mat] || 0;
        totalMiddleCount += count * (gradeRatios[index] || 1);
      });

      totalMiddleCount = parseFloat(totalMiddleCount.toFixed(2));
      if (totalMiddleCount > 0) {
        completeRecords.push(parseFloat((runTime / totalMiddleCount).toFixed(2)));
      }
    });
  } else {
    // 普通材料路径：直接按材料数量计算
    historicalRecords.forEach(record => {
      const { runTime, quantityChange } = record;
      if (quantityChange[resourceName] !== undefined && quantityChange[resourceName] !== 0) {
        completeRecords.push(parseFloat((runTime / quantityChange[resourceName]).toFixed(2)));
      }
    });
  }

  // 异常值过滤与平均值计算（原有逻辑不变）
  if (completeRecords.length < 3) {
    log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}有效效率记录不足3条，无法计算时间成本`);
    return null;
  }

  const recentRecords = completeRecords.slice(-5).filter(r => !isNaN(r) && r !== Infinity);
  const mean = recentRecords.reduce((acc, val) => acc + val, 0) / recentRecords.length;
  const stdDev = Math.sqrt(recentRecords.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentRecords.length);
  const filteredRecords = recentRecords.filter(r => Math.abs(r - mean) <= 1 * stdDev);

    if (filteredRecords.length === 0) {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}记录数据差异过大，无法计算有效时间成本`);
      return null;
    }

  return parseFloat((filteredRecords.reduce((acc, val) => acc + val, 0) / filteredRecords.length).toFixed(2));
}

// ==============================================
// 路径运行控制
// ==============================================
/**
 * 检查路径是否可运行（基于CD和上次运行时间）
 * @param {number} currentTime - 当前时间（小时）
 * @param {string|null} lastEndTime - 上次结束时间
 * @param {Object|number} refreshCD - 刷新CD配置
 * @param {string} pathName - 路径名
 * @returns {boolean} 是否可运行
 */
function canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName) {
  if (!lastEndTime) return true;

  const lastEndTimeDate = new Date(lastEndTime);
  const currentDate = new Date();

  if (typeof refreshCD === 'object') {
    if (refreshCD.type === 'midnight') {
      const times = refreshCD.times;
      const nextRunTime = new Date(lastEndTimeDate);
      nextRunTime.setDate(lastEndTimeDate.getDate() + times);
      nextRunTime.setHours(0, 0, 0, 0);
      const canRun = currentDate >= nextRunTime;
      log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，下次运行：${nextRunTime.toLocaleString()}`);
      return canRun;
    } else if (refreshCD.type === 'specific') {
        const specificHour = refreshCD.hour;
        const currentDate = new Date();
        const lastDate = new Date(lastEndTimeDate);
        const todayRefresh = new Date(currentDate);
        todayRefresh.setHours(specificHour, 0, 0, 0);
        if (currentDate > todayRefresh && currentDate.getDate() !== lastDate.getDate()) {
          return true;
        }
        const nextRefreshTime = new Date(todayRefresh);
        if (currentDate >= todayRefresh) nextRefreshTime.setDate(nextRefreshTime.getDate() + 1);
        log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，下次运行：${nextRefreshTime.toLocaleString()}`);
        return false;
    } else if (refreshCD.type === 'instant') {
      return true;
    }
  } else {
    const nextRefreshTime = new Date(lastEndTimeDate.getTime() + refreshCD * 3600 * 1000);
    log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，下次运行：${nextRefreshTime.toLocaleString()}`);
    return currentDate >= nextRefreshTime;
  }

  return false;
}

// ==============================================
// 图像匹配与分类
// ==============================================
// 材料别名映射
const MATERIAL_ALIAS = {
  '晶蝶': '晶核',
  '白铁矿': '白铁块',
  '铁矿': '铁块',
};
const imageMapCache = new Map(); // 保持固定，不动态刷新

/**
 * 创建图像分类映射（目录到分类的映射）
 * @param {string} imagesDir - 图像目录
 * @returns {Object} 图像名到分类的映射
 */
const createImageCategoryMap = (imagesDir) => {
  const map = {};
  const imageFiles = readAllFilePaths(imagesDir, 0, 1, ['.png']);
  
  for (const imagePath of imageFiles) {
    const pathParts = imagePath.split(/[\\/]/);
    if (pathParts.length < 3) continue;

    const imageName = pathParts.pop()
      .replace(/\.png$/i, '')
      .trim()
      .toLowerCase();
    
    if (!(imageName in map)) {
      map[imageName] = pathParts[2];
    }
  }
  
  return map;
};

const loggedResources = new Set();

/**
 * 匹配图像并获取材料分类
 * @param {string} resourceName - 资源名
 * @param {string} imagesDir - 图像目录
 * @returns {string|null} 材料分类（null=未匹配）
 */
function matchImageAndGetCategory(resourceName, imagesDir) {
  const processedName = (MATERIAL_ALIAS[resourceName] || resourceName).toLowerCase();
  
  if (!imageMapCache.has(imagesDir)) {
    log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}初始化图像分类缓存：${imagesDir}`);
    imageMapCache.set(imagesDir, createImageCategoryMap(imagesDir));
  }

  const result = imageMapCache.get(imagesDir)[processedName] ?? null;
  if (result) {
    // log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}资源${resourceName}匹配分类：${result}`);
  } else {
    log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}资源${resourceName}未匹配到分类`);
  }

  if (!loggedResources.has(processedName)) {
    loggedResources.add(processedName);
  }
  
  return result;
}

// ==============================================
// 特殊材料与超量判断（核心新增逻辑）
// ==============================================
const specialMaterials = [
  "水晶块", "魔晶块", "星银矿石", "紫晶块", "萃凝晶", "虹滴晶", "铁块", "白铁块",
  "精锻用魔矿", "精锻用良矿", "精锻用杂矿"
];

let excessMaterialNames = []; // 超量材料名单

// 筛选低数量材料（保留原逻辑+修正超量判断）
function filterLowCountMaterials(pathingMaterialCounts, materialCategoryMap) {
  // 超量阈值（普通材料9999，矿石处理后也是9999）
  const EXCESS_THRESHOLD = exceedCount;
  // 临时存储本次超量材料
  const tempExcess = [];

  // 提取所有需要扫描的材料（含怪物材料）
  const allMaterials = Object.values(materialCategoryMap).flat();
  log.info(`【材料基准】本次需扫描的全量材料：${allMaterials.join("、")}`);

  // ========== 第一步：平行判断超量材料（原始数据，不经过低数量过滤） ==========
  pathingMaterialCounts.forEach(item => {
    // 只处理allMaterials内的材料（同源）
    if (!allMaterials.includes(item.name)) return;
    // 未知数量（?）不判断超量
    if (item.count === "?") return;

    // 矿石数量特殊处理（和低数量筛选的处理逻辑一致）
    let processedCount = Number(item.count);
    if (specialMaterials.includes(item.name)) {
      processedCount = Math.floor(processedCount / 10);
    }

    // 超量判断（平行逻辑：只要≥阈值就标记，和低数量无关）
    if (processedCount >= EXCESS_THRESHOLD) {
      tempExcess.push(item.name);
      log.debug(`【超量标记】${item.name} 原始数量：${item.count} → 处理后：${processedCount} ≥ 阈值${EXCESS_THRESHOLD}，标记为超量`);
    }
  });

  // ========== 第二步：平行筛选低数量材料（原有逻辑保留） ==========
  const filteredLowCountMaterials = pathingMaterialCounts
    .filter(item => {
      // 只处理allMaterials内的材料（同源）
      if (!allMaterials.includes(item.name)) return false;
      // 低数量判断：<目标值 或 数量未知（?）
      return item.count < targetCount || item.count === "?";
    })
    .map(item => {
      // 矿石数量÷10
      let processedCount = item.count;
      if (specialMaterials.includes(item.name) && item.count !== "?") {
        processedCount = Math.floor(Number(item.count) / 10);
      }
      return { ...item, count: processedCount };
    });

  tempExcess.push("OCR启动"); // 添加特殊标记，用于终止OCR等待

  // ========== 第三步：更新全局超量名单（去重） ==========
  excessMaterialNames = [...new Set(tempExcess)];
  log.info(`【超量材料更新】共${excessMaterialNames.length}种：${excessMaterialNames.join("、")}`);
  log.info(`【低数量材料】筛选后共${filteredLowCountMaterials.length}种：${filteredLowCountMaterials.map(m => m.name).join("、")}`);

  // 返回低数量材料（超量名单已独立生成）
  return filteredLowCountMaterials;
}
// 极简封装：用路径和当前目标发通知，然后执行路径
async function runPathAndNotify(pathingFilePath, currentMaterialName) {
  const pathName = basename(pathingFilePath); // 取路径名
  if (notify) { // 只在需要通知时执行
    notification.Send(`当前执行路径：${pathName}\n目标：${currentMaterialName || '未知'}`);
  }
  return await pathingScript.runFile(pathingFilePath); // 执行路径
}
// ==============================================
// 路径处理（拆分巨型函数）
// ==============================================
/**
 * 处理狗粮路径条目
 * @param {Object} entry - 路径条目 { path, resourceName }
 * @param {Object} accumulators - 累加器 { foodExpAccumulator, currentMaterialName }
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @returns {Object} 更新后的累加器
 */
async function processFoodPathEntry(entry, accumulators, recordDir, noRecordDir) {
  const { path: pathingFilePath, resourceName } = entry;
  const pathName = basename(pathingFilePath);
  const { foodExpAccumulator, currentMaterialName: prevMaterialName } = accumulators;

  // 切换目标材料
  let currentMaterialName = prevMaterialName;
  if (currentMaterialName !== resourceName) {
    if (prevMaterialName && foodExpAccumulator[prevMaterialName]) {
      const prevMsg = `材料[${prevMaterialName}]收集完成，累计EXP：${foodExpAccumulator[prevMaterialName]}`;
      sendNotificationInChunks(prevMsg, notification.Send);
    }
    currentMaterialName = resourceName;
    foodExpAccumulator[resourceName] = 0;
    log.info(`${CONSTANTS.LOG_MODULES.PATH}切换至狗粮材料【${resourceName}】`);
  }

  // 执行路径
  const startTime = new Date().toLocaleString();
  const initialPosition = genshin.getPositionFromMap();
  await runPathAndNotify(pathingFilePath, currentMaterialName);
  const finalPosition = genshin.getPositionFromMap();
  const finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
  const endTime = new Date().toLocaleString();
  const runTime = (new Date(endTime) - new Date(startTime)) / 1000;

  // 处理分解与记录
  const { success, totalExp } = await executeSalvageWithOCR();
  foodExpAccumulator[resourceName] += totalExp;

  const recordDirFinal = noRecord ? noRecordDir : recordDir;
  const foodRecordContent = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n移动距离: ${finalCumulativeDistance.toFixed(2)}\n分解状态: ${success ? "成功" : "失败"}\n本次EXP获取: ${totalExp}\n累计EXP获取: ${foodExpAccumulator[resourceName]}\n\n`;
  writeContentToFile(`${recordDirFinal}/${resourceName}${CONSTANTS.FOOD_EXP_RECORD_SUFFIX}`, foodRecordContent);

  const foodMsg = `狗粮路径【${pathName}】执行完成\n耗时：${runTime.toFixed(1)}秒\n本次EXP：${totalExp}\n累计EXP：${foodExpAccumulator[resourceName]}`;
  sendNotificationInChunks(foodMsg, notification.Send);

  await sleep(1); // 保留sleep(1)
  return { ...accumulators, foodExpAccumulator, currentMaterialName };
}

/**
 * 处理怪物路径条目
 * @param {Object} entry - 路径条目 { path, monsterName, resourceName }
 * @param {Object} context - 上下文 { CDCategories, timeCost, recordDir, noRecordDir, imagesDir, ... }
 * @returns {Object} 更新后的上下文
 */
async function processMonsterPathEntry(entry, context) {
  const { path: pathingFilePath, monsterName } = entry;
  const pathName = basename(pathingFilePath);
  const { 
    CDCategories, timeCost, recordDir, noRecordDir, imagesDir,
    materialCategoryMap, flattenedLowCountMaterials, 
    currentMaterialName: prevMaterialName,
    materialAccumulatedDifferences, globalAccumulatedDifferences,
    pathRecordCache // 新增：从上下文取缓存
  } = context;
  const monsterMaterials = monsterToMaterials[monsterName] || [];
  const allExcess = monsterMaterials.every(mat => excessMaterialNames.includes(mat));
  if (allExcess) {
    log.warn(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${monsterName}】所有材料已超量，跳过路径：${pathName}`);
    await sleep(1);
    return context;
  }

  // 用怪物名查CD
  let refreshCD = null;
  for (const [categoryName, cdInfo] of Object.entries(CDCategories)) {
    if (allowedCDCategories.length > 0 && !allowedCDCategories.includes(categoryName)) continue;
    for (const [cdKey, cdItems] of Object.entries(cdInfo)) {
      if (cdItems.includes(monsterName)) {
        refreshCD = JSON.parse(cdKey);
        break;
      }
    }
    if (refreshCD) break;
  }

  if (!refreshCD) {
    log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${monsterName}】未找到CD配置，跳过路径：${pathName}`);
    await sleep(1);
    return context;
  }

  // 检查是否可运行
  const currentTime = getCurrentTimeInHours();
  const lastEndTime = getLastRunEndTime(monsterName, pathName, recordDir, noRecordDir);
  const isPathValid = checkPathNameFrequency(monsterName, pathName, recordDir);
  const perTime = noRecord ? null : calculatePerTime(
    monsterName, 
    pathName, 
    recordDir, 
    noRecordDir, 
    false, 
    pathRecordCache // 新增：传递缓存
  );

  log.info(`${CONSTANTS.LOG_MODULES.PATH}怪物路径${pathName} 单个材料耗时：${perTime ?? '忽略'}`);

  if (!(canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName) && isPathValid && (noRecord || perTime === null || perTime <= timeCost))) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}怪物路径${pathName} 不符合运行条件`);
    await sleep(1);
    return context;
  }

  // 构建怪物掉落材料的分类映射（用于扫描）
  const resourceCategoryMap = {};
  const materials = monsterToMaterials[monsterName] || [];
  materials.forEach(mat => {
    const category = matchImageAndGetCategory(mat, imagesDir);
    if (category) {
      if (!resourceCategoryMap[category]) resourceCategoryMap[category] = [];
      if (!resourceCategoryMap[category].includes(mat)) {
        resourceCategoryMap[category].push(mat);
      }
    }
  });
  log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}怪物${monsterName}的扫描分类：${JSON.stringify(resourceCategoryMap)}`);

  // 处理运行逻辑
  let currentMaterialName = prevMaterialName;
  let updatedFlattened = flattenedLowCountMaterials;

  if (noRecord) {
    // noRecord模式
    if (currentMaterialName !== monsterName) {
      currentMaterialName = monsterName;
      materialAccumulatedDifferences[monsterName] = {};
      log.info(`${CONSTANTS.LOG_MODULES.PATH}noRecord模式：切换目标至怪物【${monsterName}】`);
    }

    const startTime = new Date().toLocaleString();
    const initialPosition = genshin.getPositionFromMap();
    await runPathAndNotify(pathingFilePath, currentMaterialName);
    const finalPosition = genshin.getPositionFromMap();
    const finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
    const endTime = new Date().toLocaleString();
    const runTime = (new Date(endTime) - new Date(startTime)) / 1000;

    const noRecordContent = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: noRecord模式忽略\n\n`;
    writeContentToFile(`${noRecordDir}/${monsterName}.txt`, noRecordContent);
  } else {
    // 普通记录模式
    if (currentMaterialName !== monsterName) {
      if (prevMaterialName && materialAccumulatedDifferences[prevMaterialName]) {
        const prevMsg = `目标[${prevMaterialName}]收集完成，累计获取：${JSON.stringify(materialAccumulatedDifferences[prevMaterialName])}`;
        sendNotificationInChunks(prevMsg, notification.Send);
      }
      currentMaterialName = monsterName;
      const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
      updatedFlattened = updatedLowCountMaterials
        .flat()
        .sort((a, b) => parseInt(a.count, 10) - parseInt(b.count, 10));
      materialAccumulatedDifferences[monsterName] = {};
    }

    const startTime = new Date().toLocaleString();
    const initialPosition = genshin.getPositionFromMap();
    await runPathAndNotify(pathingFilePath, currentMaterialName);
    const finalPosition = genshin.getPositionFromMap();
    const finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
    const endTime = new Date().toLocaleString();
    const runTime = (new Date(endTime) - new Date(startTime)) / 1000;

    // 计算材料变化
    const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
    const flattenedUpdated = updatedLowCountMaterials.flat().sort((a, b) => a.count - b.count);

    const materialCountDifferences = {};
    flattenedUpdated.forEach(updated => {
      const original = updatedFlattened.find(m => m.name === updated.name);
      if (original) {
        const diff = parseInt(updated.count) - parseInt(original.count);
        if (diff !== 0 || updated.name === updated.name) {
          materialCountDifferences[updated.name] = diff;
          globalAccumulatedDifferences[updated.name] = (globalAccumulatedDifferences[updated.name] || 0) + diff;
          materialAccumulatedDifferences[monsterName][updated.name] = (materialAccumulatedDifferences[monsterName][updated.name] || 0) + diff;
        }
      }
    });

    // 更新材料计数缓存
    updatedFlattened = updatedFlattened.map(m => {
      const updated = flattenedUpdated.find(u => u.name === m.name);
      return updated ? { ...m, count: updated.count } : m;
    });

    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}怪物路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
    recordRunTime(monsterName, pathName, startTime, endTime, runTime, recordDir, materialCountDifferences, finalCumulativeDistance);
  }

  await sleep(1); // 保留sleep(1)
  return {
    ...context,
    currentMaterialName,
    flattenedLowCountMaterials: updatedFlattened,
    materialAccumulatedDifferences,
    globalAccumulatedDifferences
  };
}

/**
 * 处理普通材料路径条目
 * @param {Object} entry - 路径条目 { path, resourceName }
 * @param {Object} context - 上下文（同怪物路径）
 * @returns {Object} 更新后的上下文
 */
async function processNormalPathEntry(entry, context) {
  const { path: pathingFilePath, resourceName } = entry;
  const pathName = basename(pathingFilePath);
  const { 
    CDCategories, timeCost, recordDir, noRecordDir,
    materialCategoryMap, flattenedLowCountMaterials, 
    currentMaterialName: prevMaterialName,
    materialAccumulatedDifferences, globalAccumulatedDifferences,
    pathRecordCache // 新增：从上下文取缓存
  } = context;

  // 用材料名查CD
  let refreshCD = null;
  for (const [categoryName, cdInfo] of Object.entries(CDCategories)) {
    if (allowedCDCategories.length > 0 && !allowedCDCategories.includes(categoryName)) continue;
    for (const [cdKey, cdItems] of Object.entries(cdInfo)) {
      if (cdItems.includes(resourceName)) {
        refreshCD = JSON.parse(cdKey);
        break;
      }
    }
    if (refreshCD) break;
  }

  if (!refreshCD) {
    log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}材料【${resourceName}】未找到CD配置，跳过路径：${pathName}`);
    await sleep(1);
    return context;
  }

  // 检查是否可运行
  const currentTime = getCurrentTimeInHours();
  const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir);
  const isPathValid = checkPathNameFrequency(resourceName, pathName, recordDir);
  const perTime = noRecord ? null : calculatePerTime(
    resourceName, 
    pathName, 
    recordDir, 
    noRecordDir, 
    false, 
    pathRecordCache // 新增：传递缓存
  );

  log.info(`${CONSTANTS.LOG_MODULES.PATH}材料路径${pathName} 单个材料耗时：${perTime ?? '忽略'}`);

  if (!(canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName) && isPathValid && (noRecord || perTime === null || perTime <= timeCost))) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}材料路径${pathName} 不符合运行条件`);
    await sleep(1);
    return context;
  }

  // 构建材料分类映射（用于扫描）
  const resourceCategoryMap = {};
  for (const [cat, list] of Object.entries(materialCategoryMap)) {
    if (list.includes(resourceName)) {
      resourceCategoryMap[cat] = [resourceName];
      break;
    }
  }

  // 处理运行逻辑（同怪物路径，区别在于用resourceName作为记录键）
  let currentMaterialName = prevMaterialName;
  let updatedFlattened = flattenedLowCountMaterials;

  if (noRecord) {
    if (currentMaterialName !== resourceName) {
      currentMaterialName = resourceName;
      materialAccumulatedDifferences[resourceName] = {};
      log.info(`${CONSTANTS.LOG_MODULES.PATH}noRecord模式：切换目标至材料【${resourceName}】`);
    }

    const startTime = new Date().toLocaleString();
    const initialPosition = genshin.getPositionFromMap();
    await runPathAndNotify(pathingFilePath, currentMaterialName);
    const finalPosition = genshin.getPositionFromMap();
    const finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
    const endTime = new Date().toLocaleString();
    const runTime = (new Date(endTime) - new Date(startTime)) / 1000;

    const noRecordContent = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: noRecord模式忽略\n\n`;
    writeContentToFile(`${noRecordDir}/${resourceName}.txt`, noRecordContent);
  } else {
    if (currentMaterialName !== resourceName) {
      if (prevMaterialName && materialAccumulatedDifferences[prevMaterialName]) {
        const prevMsg = `目标[${prevMaterialName}]收集完成，累计获取：${JSON.stringify(materialAccumulatedDifferences[prevMaterialName])}`;
        sendNotificationInChunks(prevMsg, notification.Send);
      }
      currentMaterialName = resourceName;
      const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
      updatedFlattened = updatedLowCountMaterials
        .flat()
        .sort((a, b) => parseInt(a.count, 10) - parseInt(b.count, 10));
      materialAccumulatedDifferences[resourceName] = {};
    }

    const startTime = new Date().toLocaleString();
    const initialPosition = genshin.getPositionFromMap();
    await runPathAndNotify(pathingFilePath, currentMaterialName);
    const finalPosition = genshin.getPositionFromMap();
    const finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
    const endTime = new Date().toLocaleString();
    const runTime = (new Date(endTime) - new Date(startTime)) / 1000;

    // 计算材料变化
    const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
    const flattenedUpdated = updatedLowCountMaterials.flat().sort((a, b) => a.count - b.count);

    const materialCountDifferences = {};
    flattenedUpdated.forEach(updated => {
      const original = updatedFlattened.find(m => m.name === updated.name);
      if (original) {
        const diff = parseInt(updated.count) - parseInt(original.count);
        if (diff !== 0 || updated.name === resourceName) {
          materialCountDifferences[updated.name] = diff;
          globalAccumulatedDifferences[updated.name] = (globalAccumulatedDifferences[updated.name] || 0) + diff;
          materialAccumulatedDifferences[resourceName][updated.name] = (materialAccumulatedDifferences[resourceName][updated.name] || 0) + diff;
        }
      }
    });

    // 更新材料计数缓存
    updatedFlattened = updatedFlattened.map(m => {
      const updated = flattenedUpdated.find(u => u.name === m.name);
      return updated ? { ...m, count: updated.count } : m;
    });

    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}材料路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
    recordRunTime(resourceName, pathName, startTime, endTime, runTime, recordDir, materialCountDifferences, finalCumulativeDistance);
  }

  await sleep(1); // 保留sleep(1)
  return {
    ...context,
    currentMaterialName,
    flattenedLowCountMaterials: updatedFlattened,
    materialAccumulatedDifferences,
    globalAccumulatedDifferences
  };
}

/**
 * 批量处理所有路径
 * @param {Object[]} allPaths - 所有路径条目
 * @param {Object} CDCategories - CD分类配置
 * @param {Object} materialCategoryMap - 材料分类映射
 * @param {number} timeCost - 时间成本阈值
 * @param {Object[]} flattenedLowCountMaterials - 低数量材料列表
 * @param {string|null} currentMaterialName - 当前处理的材料名
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @param {string} imagesDir - 图像目录
 * @param {string} endTimeStr - 指定终止时间
 * @returns {Object} 处理结果
 */
async function processAllPaths(allPaths, CDCategories, materialCategoryMap, timeCost, flattenedLowCountMaterials, currentMaterialName, recordDir, noRecordDir, imagesDir, endTimeStr) {
  try {
    // 初始化累加器
    let foodExpAccumulator = {};
    const globalAccumulatedDifferences = {};
    const materialAccumulatedDifferences = {};
    // 新增：单路径处理周期内的记录缓存（处理完所有路径后自动释放）
    const pathRecordCache = {}; 
    let context = {
      CDCategories, timeCost, recordDir, noRecordDir, imagesDir,
      materialCategoryMap, flattenedLowCountMaterials,
      currentMaterialName, materialAccumulatedDifferences,
      globalAccumulatedDifferences,
      pathRecordCache // 上下文加入缓存，供子函数使用
    };

    for (const entry of allPaths) {
      // 优先响应手动终止指令（原有逻辑保留）
      if (state.cancelRequested) {
        log.warn(`${CONSTANTS.LOG_MODULES.PATH}检测到手动终止指令，停止路径处理`);
        break;
      }

      // 核心修改：仅当endTimeStr有值时才执行定时终止判断（默认不执行）
      let skipPath = false;
      if (endTimeStr) { // 只有用户显式配置了终止时间，才进入判断
        const isValidEndTime = /^\d{1,2}[:：]\d{1,2}$/.test(endTimeStr);
        if (isValidEndTime) {
          const remainingMinutes = getRemainingMinutesToEndTime(endTimeStr);
          if (remainingMinutes <= 0) {
            log.warn(`${CONSTANTS.LOG_MODULES.MAIN}已过指定终止时间（${endTimeStr}），停止路径处理`);
            state.cancelRequested = true;
            break;
          }

          const pathTotalTimeSec = estimatePathTotalTime(
            entry, 
            recordDir, 
            noRecordDir, 
            pathRecordCache
          );
          const pathTotalTimeMin = pathTotalTimeSec / 60;
          const requiredMin = pathTotalTimeMin + 2;

          if (remainingMinutes <= requiredMin) {
            log.warn(`${CONSTANTS.LOG_MODULES.MAIN}时间不足：剩余${remainingMinutes}分钟，需${requiredMin}分钟（含2分钟空闲）`);
            state.cancelRequested = true;
            skipPath = true;
            break;
          } else {
            log.debug(`${CONSTANTS.LOG_MODULES.MAIN}时间充足：剩余${remainingMinutes}分钟，需${requiredMin}分钟`);
          }
        } else {
          log.warn(`${CONSTANTS.LOG_MODULES.MAIN}终止时间格式无效（${endTimeStr}），跳过定时判断`);
        }
      } // 若endTimeStr为null（默认），则完全跳过定时终止逻辑

      if (skipPath) break;

      // 原有路径处理逻辑（仅新增缓存传递）
      const { path: pathingFilePath, resourceName, monsterName } = entry;
      log.info(`${CONSTANTS.LOG_MODULES.PATH}开始处理路径：${basename(pathingFilePath)}`);

      try {
        if (resourceName && isFoodResource(resourceName)) {
          const result = await processFoodPathEntry(entry, {
            foodExpAccumulator,
            currentMaterialName: context.currentMaterialName,
            pathRecordCache // 传递缓存
          }, recordDir, noRecordDir);
          foodExpAccumulator = result.foodExpAccumulator;
          context.currentMaterialName = result.currentMaterialName;
        } else if (monsterName) {
          context = await processMonsterPathEntry(entry, context);
        } else if (resourceName) {
          context = await processNormalPathEntry(entry, context);
        } else {
          log.warn(`${CONSTANTS.LOG_MODULES.PATH}跳过无效路径条目：${JSON.stringify(entry)}`);
        }
      } catch (singleError) {
        log.error(`${CONSTANTS.LOG_MODULES.PATH}处理路径出错，已跳过：${singleError.message}`);
        await sleep(1);
        if (state.cancelRequested) {
          log.warn(`${CONSTANTS.LOG_MODULES.PATH}检测到终止指令，停止处理`);
          break;
        }
      }
    }

    // 最后一个目标收尾
    if (context.currentMaterialName) {
      if (isFoodResource(context.currentMaterialName) && foodExpAccumulator[context.currentMaterialName]) {
        const finalMsg = `狗粮材料[${context.currentMaterialName}]收集完成，累计EXP：${foodExpAccumulator[context.currentMaterialName]}`;
        sendNotificationInChunks(finalMsg, notification.Send);
      } else if (materialAccumulatedDifferences[context.currentMaterialName]) {
        const finalMsg = `目标[${context.currentMaterialName}]收集完成，累计获取：${JSON.stringify(materialAccumulatedDifferences[context.currentMaterialName])}`;
        sendNotificationInChunks(finalMsg, notification.Send);
      }
    }

    return { 
      currentMaterialName: context.currentMaterialName, 
      flattenedLowCountMaterials: context.flattenedLowCountMaterials,
      globalAccumulatedDifferences: context.globalAccumulatedDifferences,
      foodExpAccumulator
    };

  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.PATH}路径处理整体错误：${error.message}`);
    throw error;
  } finally {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}路径组处理结束`);
    state.completed = true;
  }
}

// ==============================================
// 路径分类与优先级（简化逻辑）
// ==============================================
/**
 * 分类普通材料路径（按目标和低数量排序）
 * @param {string} pathingDir - 路径目录
 * @param {string[]} targetResourceNames - 目标资源名列表
 * @param {string[]} lowCountMaterialNames - 低数量材料名列表
 * @param {Set} cdMaterialNames - CD中存在的材料名集合
 * @returns {Object[]} 分类后的路径条目
 */
function classifyNormalPathFiles(pathingDir, targetResourceNames, lowCountMaterialNames, cdMaterialNames) {
  const pathingFilePaths = readAllFilePaths(pathingDir, 0, 3, ['.json']);
  const pathEntries = pathingFilePaths.map(path => {
    const { materialName, monsterName } = extractResourceNameFromPath(path, cdMaterialNames);
    return { path, resourceName: materialName, monsterName }; // 新增monsterName字段
  }).filter(entry => {
    // 新增：过滤超量材料对应的路径（包括怪物材料）
    if (entry.monsterName) {
      // 怪物路径：检查其所有材料是否都超量
      const monsterMaterials = monsterToMaterials[entry.monsterName] || [];
      const allExcess = monsterMaterials.every(mat => excessMaterialNames.includes(mat));
      return !allExcess; // 若所有材料超量则过滤该路径
    }
    if (entry.resourceName) {
      // 普通材料路径：检查自身是否超量
      return !excessMaterialNames.includes(entry.resourceName);
    }
    return false;
  });

  if (pathEntries.length > 0) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}\n===== 匹配到的材料路径列表 =====`);
    pathEntries.forEach((entry, index) => {
    });
    log.info(`=================================\n`);
  } else {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}未匹配到任何有效的材料路径`);
  }

  // 按优先级分类
  const prioritizedPaths = [];
  const normalPaths = [];
  for (const entry of pathEntries) {
    if (entry.monsterName) {
      // 怪物路径：检查是否包含有效目标材料
      const monsterMaterials = monsterToMaterials[entry.monsterName] || [];
      const hasValidTarget = monsterMaterials.some(mat => targetResourceNames.includes(mat) || lowCountMaterialNames.includes(mat));
      if (hasValidTarget) {
        prioritizedPaths.push(entry);
      } else {
        normalPaths.push(entry);
      }
    } else if (entry.resourceName) {
      // 普通材料路径
      if (targetResourceNames.includes(entry.resourceName)) {
        prioritizedPaths.push(entry);
      } else if (lowCountMaterialNames.includes(entry.resourceName)) {
        normalPaths.push(entry);
      }
    }
  }
  // 按低数量排序
  normalPaths.sort((a, b) => {
    const indexA = lowCountMaterialNames.indexOf(a.resourceName) || lowCountMaterialNames.indexOf(a.monsterName ? monsterToMaterials[a.monsterName]?.[0] : '');
    const indexB = lowCountMaterialNames.indexOf(b.resourceName) || lowCountMaterialNames.indexOf(b.monsterName ? monsterToMaterials[b.monsterName]?.[0] : '');
    return indexA - indexB;
  });
  return prioritizedPaths.concat(normalPaths);
}

/**
 * 生成最终路径数组（按优先级排序，简化逻辑）
 * @param {string} pathingDir - 路径目录
 * @param {string[]} targetResourceNames - 目标资源名列表
 * @param {Set} cdMaterialNames - CD中存在的材料名集合
 * @param {Object} materialCategoryMap - 材料分类映射
 * @param {Object} pathingMode - 路径模式配置
 * @param {string} imagesDir - 图像目录
 * @returns {Object} { allPaths, pathingMaterialCounts }
 */
async function generateAllPaths(pathingDir, targetResourceNames, cdMaterialNames, materialCategoryMap, pathingMode, imagesDir) {
  // 缓存路径文件列表（减少IO）
  const pathingFilePaths = readAllFilePaths(pathingDir, 0, 3, ['.json']);
  const pathEntries = pathingFilePaths.map(path => {
    const { materialName, monsterName } = extractResourceNameFromPath(path, cdMaterialNames);
    return { path, resourceName: materialName, monsterName };
  }).filter(entry => (entry.resourceName || entry.monsterName) && entry.path.trim() !== "");

  log.info(`${CONSTANTS.LOG_MODULES.PATH}[路径初始化] 共读取有效路径 ${pathEntries.length} 条`);

  // 分类路径（狗粮 > 怪物 > 普通材料）
  const foodPaths = pathEntries.filter(entry => entry.resourceName && isFoodResource(entry.resourceName));
  const monsterPaths = pathEntries.filter(entry => entry.monsterName && !isFoodResource(entry.resourceName));
  const normalPaths = pathEntries.filter(entry => entry.resourceName && !isFoodResource(entry.resourceName) && !entry.monsterName);

  log.info(`${CONSTANTS.LOG_MODULES.PATH}[路径分类] 狗粮:${foodPaths.length} 怪物:${monsterPaths.length} 普通:${normalPaths.length}`);

  // 怪物路径关联材料到分类（扫描用）
  log.info(`${CONSTANTS.LOG_MODULES.MONSTER}开始处理${monsterPaths.length}条怪物路径的材料分类关联...`);
  monsterPaths.forEach((entry, index) => {
    const materials = monsterToMaterials[entry.monsterName] || [];
    if (materials.length === 0) {
      log.warn(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物路径${index+1}] 怪物【${entry.monsterName}】无对应材料映射`);
      return;
    }
    materials.forEach(mat => {
      const category = matchImageAndGetCategory(mat, imagesDir);
      if (!category) return;
      if (!materialCategoryMap[category]) materialCategoryMap[category] = [];
      if (!materialCategoryMap[category].includes(mat)) {
        materialCategoryMap[category].push(mat);
        log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${entry.monsterName}】的材料【${mat}】加入分类【${category}】`);
      }
    });
  });

  // 处理普通材料路径
  let processedFoodPaths = foodPaths;
  let processedNormalPaths = [];
  let processedMonsterPaths = monsterPaths;
  let pathingMaterialCounts = [];

  if (normalPaths.length > 0 || monsterPaths.length > 0) { // 包含怪物路径时也需要扫描
    // 优化：一次扫描获取全量材料数量，同时服务于怪物和普通材料
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] 执行一次全量背包扫描（服务于怪物+普通路径）`);
    const allMaterialCounts = await MaterialPath(materialCategoryMap); // 仅一次扫描
    pathingMaterialCounts = allMaterialCounts; // 普通材料直接复用扫描结果

    // 1. 怪物材料筛选（复用全量扫描结果）
    log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 基于全量扫描结果筛选有效材料`);
    const filteredMaterials = filterLowCountMaterials(allMaterialCounts.flat(), materialCategoryMap); // 仅调用一次！
    // 怪物材料复用结果
    const validMonsterMaterialNames = filteredMaterials.map(m => m.name);
    log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 筛选后有效材料：${validMonsterMaterialNames.join('、')}`);

    // 2. 普通材料筛选（同样复用全量扫描结果，无需再次扫描）
    if (pathingMode.onlyCategory) {
      state.cancelRequested = true;
      return { allPaths: [], pathingMaterialCounts };
}
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 基于全量扫描结果筛选低数量材料`);
    const lowCountMaterialsFiltered = filteredMaterials; // 复用第一次的结果！
    const flattenedLowCountMaterials = lowCountMaterialsFiltered.flat().sort((a, b) => a.count - b.count);
    const lowCountMaterialNames = flattenedLowCountMaterials.map(material => material.name);

    processedNormalPaths = classifyNormalPathFiles(pathingDir, targetResourceNames, lowCountMaterialNames, cdMaterialNames)
      .filter(entry => normalPaths.some(n => n.path.replace(/\\/g, '/') === entry.path.replace(/\\/g, '/')));
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 筛选后保留路径 ${processedNormalPaths.length} 条`);
  }

  // 简化路径优先级逻辑：用规则数组定义优先级
  const PATH_PRIORITIES = [
    // 1. 目标狗粮
    { 
      source: processedFoodPaths, 
      filter: e => targetResourceNames.includes(e.resourceName) 
    },
    // 2. 目标怪物（掉落材料含目标）
    { 
      source: processedMonsterPaths, 
      filter: e => {
        const materials = monsterToMaterials[e.monsterName] || [];
        return materials.some(mat => targetResourceNames.includes(mat));
      } 
    },
    // 3. 目标普通材料
    { 
      source: processedNormalPaths, 
      filter: e => targetResourceNames.includes(e.resourceName) 
    },
    // 4. 剩余狗粮
    { 
      source: processedFoodPaths, 
      filter: e => !targetResourceNames.includes(e.resourceName) 
    },
    // 5. 剩余怪物
    { 
      source: processedMonsterPaths, 
      filter: e => {
        const materials = monsterToMaterials[e.monsterName] || [];
        return !materials.some(mat => targetResourceNames.includes(mat)) && 
               materials.some(mat => !excessMaterialNames.includes(mat)); // 排除所有材料超量的怪物
      } 
    },
    // 6. 剩余普通材料
    { 
      source: processedNormalPaths, 
      filter: e => !targetResourceNames.includes(e.resourceName) 
    }
  ];

  // 按优先级合并路径
  const allPaths = [];
  PATH_PRIORITIES.forEach(({ source, filter }, index) => {
    const filtered = source.filter(filter);
    allPaths.push(...filtered);
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[优先级${index+1}] 路径 ${filtered.length} 条`);
  });

  log.info(`${CONSTANTS.LOG_MODULES.PATH}[最终路径] 共${allPaths.length}条：${allPaths.map(p => basename(p.path))}`);
  return { allPaths, pathingMaterialCounts };
}

// ==============================================
// 通知工具
// ==============================================
/**
 * 分块发送通知（保持原有逻辑）
 * @param {string} msg - 通知消息
 * @param {Function} sendFn - 发送函数
 */
function sendNotificationInChunks(msg, sendFn) {
  if (!notify) return;
  if (typeof msg !== 'string' || msg.length === 0) return;

  const chunkSize = CONSTANTS.NOTIFICATION_CHUNK_SIZE;
  if (msg.length <= chunkSize) {
    sendFn(msg);
    return;
  }

  const totalChunks = Math.ceil(msg.length / chunkSize);
  log.info(`${CONSTANTS.LOG_MODULES.MAIN}通知消息过长（${msg.length}字符），拆分为${totalChunks}段发送`);
  
  let start = 0;
  for (let i = 0; i < totalChunks; i++) {
    const end = Math.min(start + chunkSize, msg.length);
    const chunkMsg = `【通知${i+1}/${totalChunks}】\n${msg.substring(start, end)}`;
    sendFn(chunkMsg);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}已发送第${i+1}段通知（${chunkMsg.length}字符）`);
    start = end;
  }
}

// ==============================================
// 结果汇总
// ==============================================
/**
 * 记录最终汇总结果
 * @param {string} recordDir - 记录目录
 * @param {string} firstScanTime - 首次扫描时间
 * @param {string} endTime - 结束时间
 * @param {number} totalRunTime - 总耗时（秒）
 * @param {Object} totalDifferences - 总材料变化
 */
function recordFinalSummary(recordDir, firstScanTime, endTime, totalRunTime, totalDifferences) {
  const summaryPath = `${recordDir}/${CONSTANTS.SUMMARY_FILE_NAME}`;
  const content = `===== 材料收集汇总 =====
首次扫描时间：${firstScanTime}
末次扫描时间：${endTime}
总耗时：${totalRunTime.toFixed(1)}秒
累计获取材料：
${Object.entries(totalDifferences).map(([name, diff]) => `  ${name}: +${diff}个`).join('\n')}
=========================================\n\n`;
  writeContentToFile(summaryPath, content);
  log.info(`${CONSTANTS.LOG_MODULES.RECORD}最终汇总已记录至 ${summaryPath}`);
  state.completed = true; // 标记任务完全完成
  state.cancelRequested = true; // 终止所有后台任务（如图像点击、OCR）
}

// ==============================================
// 主执行函数
// ==============================================
(async function () {
  setGameMetrics(1920, 1080, 1);
  await genshin.returnMainUi();

  // 初始化固定资源
  const fDialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F_Dialogue.png"), 1102, 335, 34, 400);
  const textxRange = { min: 1210, max: 1412 };
  const texttolerance = 2;

  // 目标资源处理
  const targetResourceNamesStr = settings.TargetresourceName || "";
  const targetResourceNames = targetResourceNamesStr
    .split(/[,，、 \s]+/)
    .map(name => name.trim())
    .filter(name => name !== "");

  const targetTextCategories = readtargetTextCategories(CONSTANTS.TARGET_TEXT_DIR);

  // 并行任务：OCR交互
  const ocrTask = (async () => {
    let allTargetTexts = [];
    for (const categoryName in targetTextCategories) {
      const targetTexts = targetTextCategories[categoryName];
      allTargetTexts = allTargetTexts.concat(Object.values(targetTexts).flat());
    }

    // 关键补充：等待超量名单生成（由filterLowCountMaterials更新）
    let waitTimes = 0;
    while (excessMaterialNames.length === 0 && !state.cancelRequested && waitTimes < 100) { 
      await sleep(1000); // 每1秒查一次
      waitTimes++;
    }
    // 若收到终止信号，直接退出OCR任务（不再执行后续逻辑）
    if (state.cancelRequested) {
      log.info(`${CONSTANTS.LOG_MODULES.MAIN}OCR任务收到终止信号，已退出`);
      return;
    }
    // 现在过滤才有效（确保excessMaterialNames已生成）
    allTargetTexts = allTargetTexts.filter(name => !excessMaterialNames.includes(name));
    log.info(`超量名单：${excessMaterialNames.join('、')}`);
    log.info(`OCR最终目标文本（已过滤超量）：${allTargetTexts.join('、')}`);

    await alignAndInteractTarget(allTargetTexts, fDialogueRo, textxRange, texttolerance);
  })();

  // 并行任务：路径处理
  const pathTask = (async () => {
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}开始路径处理流程`);

    // 加载CD分类
    const CDCategories = readMaterialCD();
    const cdMaterialNames = new Set();
    for (const [categoryName, cdInfo] of Object.entries(CDCategories)) {
      if (allowedCDCategories.length > 0 && !allowedCDCategories.includes(categoryName)) continue;
      for (const [_, materialList] of Object.entries(cdInfo)) {
        materialList.forEach(name => cdMaterialNames.add(name));
      }
    }
    log.info(`${CONSTANTS.LOG_MODULES.CD}CD文件中材料名（已过滤）：${Array.from(cdMaterialNames).join(', ')}`);

    // 生成材料分类映射（含怪物掉落）
    let materialCategoryMap = {};
    if (!pathingMode.onlyCategory) {
      const pathingFilePaths = readAllFilePaths(CONSTANTS.PATHING_DIR, 0, 3, ['.json']);
      const pathEntries = pathingFilePaths.map(path => {
        const { materialName, monsterName } = extractResourceNameFromPath(path, cdMaterialNames);
        return { materialName, monsterName };
      });

      // 收集所有材料（含怪物掉落）
      const allMaterials = new Set();
      pathEntries.forEach(({ materialName, monsterName }) => {
        if (materialName) allMaterials.add(materialName);
        if (monsterName) {
          (monsterToMaterials[monsterName] || []).forEach(mat => allMaterials.add(mat));
        }
      });

      // 构建分类映射
      materialCategoryMap = Array.from(allMaterials).reduce((acc, resourceName) => {
        const category = matchImageAndGetCategory(resourceName, CONSTANTS.IMAGES_DIR);
        if (category) {
          if (!acc[category]) acc[category] = [];
          if (!acc[category].includes(resourceName)) {
            acc[category].push(resourceName);
          }
        }
        return acc;
      }, {});
    }

    // 处理选中的材料分类
    if (selected_materials_array.length > 0) {
      selected_materials_array.forEach(selectedCategory => {
        if (!materialCategoryMap[selectedCategory]) {
          materialCategoryMap[selectedCategory] = [];
        }
      });
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}未选择【材料分类】，采用【路径材料】专注模式`);
    }

    if (pathingMode.onlyPathing) {
      Object.keys(materialCategoryMap).forEach(category => {
        if (materialCategoryMap[category].length === 0) {
          delete materialCategoryMap[category];
        }
      });
    }

    // 生成路径数组
    const { allPaths, pathingMaterialCounts } = await generateAllPaths(
      CONSTANTS.PATHING_DIR,
      targetResourceNames,
      cdMaterialNames,
      materialCategoryMap,
      pathingMode,
      CONSTANTS.IMAGES_DIR
    );

    // 处理所有路径
    let currentMaterialName = null;
    let flattenedLowCountMaterials = [];

    const firstScanTime = new Date().toLocaleString();
    const initialMaterialCounts = pathingMaterialCounts.flat().reduce((acc, mat) => {
      acc[mat.name] = parseInt(mat.count, 10) || 0;
      return acc;
    }, {});

    const processResult = await processAllPaths(
      allPaths,
      CDCategories,
      materialCategoryMap,
      timeCost,
      flattenedLowCountMaterials,
      currentMaterialName,
      CONSTANTS.RECORD_DIR,
      CONSTANTS.NO_RECORD_DIR,
      CONSTANTS.IMAGES_DIR,
      endTimeStr // 传递终止时间
    );

    // 汇总结果
    const globalAccumulatedDifferences = processResult.globalAccumulatedDifferences;
    const foodExpAccumulator = processResult.foodExpAccumulator || {};

    // 末次扫描
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}开始末次背包扫描，计算总差值`);
    const finalMaterialCounts = await MaterialPath(materialCategoryMap);
    const flattenedFinal = finalMaterialCounts.flat();
    const finalCounts = flattenedFinal.reduce((acc, mat) => {
      acc[mat.name] = parseInt(mat.count, 10) || 0;
      return acc;
    }, {});

    // 计算总差异
    const totalDifferences = {};
    // 普通材料差异
    Object.keys(initialMaterialCounts).forEach(name => {
      const diff = finalCounts[name] - initialMaterialCounts[name];
      if (diff > 0) {
        totalDifferences[name] = diff;
      }
    });
    // 狗粮EXP差异
    Object.keys(foodExpAccumulator).forEach(name => {
      totalDifferences[`${name}_EXP`] = foodExpAccumulator[name];
    });

    // 输出汇总信息
    const endTime = new Date().toLocaleString();
    const totalRunTime = (new Date(endTime) - new Date(firstScanTime)) / 1000;
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}\n所有目标收集完成`);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}首次扫描时间：${firstScanTime}`);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}末次扫描时间：${endTime}`);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}总耗时：${totalRunTime.toFixed(1)}秒`);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}总累积获取：${JSON.stringify(totalDifferences, null, 2)}`);

    recordFinalSummary(CONSTANTS.RECORD_DIR, firstScanTime, endTime, totalRunTime, totalDifferences);

    let finalMsg = `收集完成\n总耗时：${totalRunTime.toFixed(1)}秒\n累计获取：\n`;
    Object.entries(totalDifferences).forEach(([n, d]) => {
      if (n.includes('_EXP')) {
        finalMsg += `  ${n.replace('_EXP', '')}（EXP）: ${d}\n`;
      } else {
        finalMsg += `  ${n}: ${d}个\n`;
      }
    });
    sendNotificationInChunks(finalMsg, notification.Send);

  })();

  // 并行任务：图像点击
  const imageTask = imageClickBackgroundTask();

  // 执行所有任务
  try {
    await Promise.allSettled([ocrTask, pathTask, imageTask]);
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.MAIN}执行任务时发生错误：${error.message}`);
    state.cancelRequested = true;
  } finally {
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}执行结束或取消后的清理操作...`);
    state.cancelRequested = true;
  }
})();
