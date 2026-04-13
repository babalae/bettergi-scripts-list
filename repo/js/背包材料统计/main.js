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
  EXCESS_MATERIALS_PATH: "user/超量名单.txt",
  
  // 解析与处理配置
  MAX_PATH_DEPTH: 6, // 路径解析最大深度
  NOTIFICATION_CHUNK_SIZE: 500, // 通知拆分长度
  FOOD_EXP_RECORD_SUFFIX: ".txt", // 狗粮记录后缀（统一格式）
  FOOD_ZERO_EXP_SUFFIX: "-0.txt", // 狗粮0记录后缀
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

// 提前读取 settings.json 以便定义 debugLog
var settingsContent = file.readTextSync("settings.json");
var settings = JSON.parse(settingsContent);
var debugLog = settings.debugLog || false;

eval(safeReadTextSync("lib/updateSettings.js"));
eval(safeReadTextSync("lib/ocr.js"));
eval(safeReadTextSync("lib/writeImage.js"));
eval(safeReadTextSync("lib/autoPick.js"));
eval(safeReadTextSync("lib/exp.js"));
eval(safeReadTextSync("lib/backStats.js"));
eval(safeReadTextSync("lib/colorDetection.js"));
eval(safeReadTextSync("lib/imageClick.js"));
eval(safeReadTextSync("lib/region.js"));

// ==============================================
// 引入拆分后的模块
// ==============================================
eval(safeReadTextSync("lib/recordManager.js"));
eval(safeReadTextSync("lib/timeCostSystem.js"));
eval(safeReadTextSync("lib/pathProcessor.js"));

// ==============================================
// 全局状态（保持不变）
// ==============================================
var state = { completed: false, cancelRequested: false, ocrPaused: false };

// ==============================================
// 全局图片缓存（避免重复加载）
// ==============================================
const ocrContext = { currentPathType: null, currentTargetMaterials: [], pathingMonsterMaterials: new Set() };

// ==============================================
// 初始化配置参数
// ==============================================
const timeCost = Math.min(100, Math.max(1, Math.floor(Number(settings.TimeCost) || 50)));
const notify = settings.notify || false;
const noRecord = settings.noRecord || false;
const noMonsterFilter = !settings.noMonsterFilter;
const targetCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.TargetCount) || 1000))); // 设定的目标数量
const exceedCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.ExceedCount) || 9000))); // 设定的超量目标数量
const endTimeStr = settings.CurrentTime ? settings.CurrentTime : null; 

// 解析需要处理的CD分类
let allowedCDCategories = [];
try {
    allowedCDCategories = Array.from(settings.CDCategories || []);
} catch (e) {
    log.error(`${CONSTANTS.LOG_MODULES.INIT}获取CDCategories设置失败: ${e.message}`);
}

let availableCDCategories = [];
try {
    const cdFilePaths = readAllFilePaths(CONSTANTS.MATERIAL_CD_DIR, 0, 1, ['.txt']);
    availableCDCategories = cdFilePaths.map(filePath => basename(filePath).replace('.txt', ''));
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.INIT}可用CD分类：${availableCDCategories.join(', ')}`);
} catch (e) {
    log.error(`${CONSTANTS.LOG_MODULES.INIT}扫描CD目录失败: ${e.message}`);
}

if (allowedCDCategories.length > 0) {
    const invalidCategories = allowedCDCategories.filter(cat => !availableCDCategories.includes(cat));
    if (invalidCategories.length > 0) {
        log.warn(`${CONSTANTS.LOG_MODULES.INIT}以下CD分类不存在，将被忽略：${invalidCategories.join('、')}`);
        allowedCDCategories = allowedCDCategories.filter(cat => availableCDCategories.includes(cat));
    }
    log.info(`${CONSTANTS.LOG_MODULES.INIT}已配置只处理以下CD分类：${allowedCDCategories.join('、')}`);
} else {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.INIT}未配置CD分类过滤，将处理所有分类`);
}

// ==============================================
// 材料与怪物映射管理
// ==============================================
// 材料分类映射 - 适配新的settings.json结构（只保留新的中文分类名称映射）
const material_mapping = {
  // 适配新的settings.json分类选项
  "矿石、原胚": "锻造素材",
  "经验书、怪物掉落": "怪物掉落素材",
  "一般素材": "一般素材",
  "采集食物": "采集食物",
  "周本素材": "周本素材",
  "烹饪用食材": "烹饪食材",
  "世界BOSS": "角色突破素材",
  "木材": "木材",
  "鱼饵、鱼类": "鱼饵鱼类",
  "宝石": "宝石",
  "天赋素材": "角色天赋素材",
  "武器突破": "武器突破素材",
  "祝圣精华": "祝圣精华"
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
    const content = safeReadTextSync(CONSTANTS.MONSTER_MATERIALS_PATH);
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    lines.forEach(line => {
      if (!line.includes('：')) return;
      const [monsterName, materialsStr] = line.split('：');
      const materials = materialsStr.split(/[,，、 \s]+/)
        .map(mat => mat.trim())
        .filter(mat => mat);
      
      if (monsterName && materials.length > 0) {
        const monsterNames = monsterName.split('/').map(m => m.trim()).filter(m => m);
        monsterNames.forEach(m => {
          monsterToMaterials[m] = materials;
        });
        materials.forEach(mat => {
          if (!materialToMonsters[mat]) {
            materialToMonsters[mat] = new Set();
          }
          monsterNames.forEach(m => materialToMonsters[mat].add(m));
        });
      }
    });
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.MONSTER}解析怪物材料文件失败：${error.message}`);
  }
}
parseMonsterMaterials(); // 初始化怪物材料映射

/**
 * 将怪物名转换为最高级材料
 * @param {string} name - 输入的名称（可能是怪物名或材料名）
 * @returns {string} 返回材料名（如果是怪物名则返回最高级材料，否则返回原名称）
 */
function convertMonsterToHighLevelMaterial(name) {
  if (monsterToMaterials[name]) {
    const materials = monsterToMaterials[name];
    return materials[materials.length - 1];
  }
  return name;
}

/**
 * 处理目标资源名，将怪物名转换为最高级材料
 * @param {string[]} targetResourceNames - 原始目标资源名列表
 * @returns {string[]} 处理后的目标资源名列表（怪物名已转换为最高级材料）
 */
function processTargetResourceNames(targetResourceNames) {
  const processedNames = targetResourceNames.map(name => convertMonsterToHighLevelMaterial(name));
  const uniqueNames = [...new Set(processedNames)];
  
  if (debugLog) {
    const convertedNames = targetResourceNames.filter(name => monsterToMaterials[name]);
    if (convertedNames.length > 0) {
      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}[怪物名转换] 以下怪物名已转换为最高级材料：`);
      convertedNames.forEach(monsterName => {
        const highLevelMat = convertMonsterToHighLevelMaterial(monsterName);
        log.info(`  ${monsterName} → ${highLevelMat}`);
      });
    }
  }
  
  return uniqueNames;
}

// ==============================================
// 路径模式配置
// ==============================================
const pathingValue = Array.from(settings.Pathing || []);
const estimateMode = pathingValue.includes('【测算模式】');
const pathingValueWithoutEstimate = pathingValue.filter(item => item !== '【测算模式】');

const pathingMode = {
  includeBoth: pathingValueWithoutEstimate.length === 2,
  onlyPathing: pathingValueWithoutEstimate.length === 1 && pathingValueWithoutEstimate.includes('📁pathing材料'),
  onlyCategory: pathingValueWithoutEstimate.length === 1 && pathingValueWithoutEstimate.includes('【扫描额外的分类】'),
  estimateMode: estimateMode
};

if (pathingValueWithoutEstimate.length === 0 && !estimateMode) {
  log.warn(`${CONSTANTS.LOG_MODULES.PATH}未配置Pathing，默认为仅📁pathing材料`);
  pathingMode.onlyPathing = true;
}

if (pathingMode.includeBoth) log.warn(`${CONSTANTS.LOG_MODULES.PATH}默认模式，📁pathing材料 将覆盖 勾选的【扫描额外的分类】`);
if (pathingMode.onlyCategory) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【背包统计】专注模式，将忽略📁pathing材料`);
if (pathingMode.onlyPathing) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【路径材料】专注模式，将忽略勾选的分类`);
if (pathingMode.estimateMode) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【测算模式】，将只测算不执行路径`);

// ==============================================
// 材料分类处理
// ==============================================
/** 
  * 初始化并筛选选中的材料分类（适配multi-checkbox的Categories配置） 
  * @returns {string[]} 选中的材料分类列表 
  */ 
 function getSelectedMaterialCategories() { 
  // 使用Array.from()确保将settings.Categories转换为真正的数组，适配multi-checkbox返回的类数组对象
  let selectedCategories = [];
  
  try {
    selectedCategories = Array.from(settings.Categories || []);
  } catch (e) {
    log.error(`${CONSTANTS.LOG_MODULES.MATERIAL}获取分类设置失败: ${e.message}`);
  }
   
  // 默认分类
  if (!selectedCategories || selectedCategories.length === 0) {
    selectedCategories = ["一般素材", "烹饪用食材"];
  }
 
  // 过滤无效值并映射到实际分类
  return selectedCategories 
    .filter(cat => typeof cat === 'string' && cat !== "") 
    .map(name => material_mapping[name] || "锻造素材") 
    .filter(name => name !== null); 
 }

const selected_materials_array = getSelectedMaterialCategories();

// ==============================================
// CD内容解析
// ==============================================
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
    const content = safeReadTextSync(filePath);
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
// 时间工具（核心修改：新增剩余时间计算）
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
      // log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，下次运行：${nextRunTime.toLocaleString()}`);
      return canRun;
    } else if (refreshCD.type === 'specific') {
        const specificHour = refreshCD.hour;
        const currentDate = new Date();
        const lastDate = new Date(lastEndTimeDate);
        
        const getRefreshTime = (date) => {
          const refreshTime = new Date(date);
          if (date.getHours() < specificHour) {
            refreshTime.setHours(specificHour, 0, 0, 0);
          } else {
            refreshTime.setDate(date.getDate() + 1);
            refreshTime.setHours(specificHour, 0, 0, 0);
          }
          return refreshTime;
        };
        
        const lastRefreshTime = getRefreshTime(lastDate);
        const currentRefreshTime = getRefreshTime(currentDate);
        const canRun = currentRefreshTime > lastRefreshTime;
        
        // log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，上次刷新点：${lastRefreshTime.toLocaleString()}，当前刷新点：${currentRefreshTime.toLocaleString()}，可运行：${canRun}`);
        return canRun;
    } else if (refreshCD.type === 'instant') {
      return true;
    }
  } else {
    const nextRefreshTime = new Date(lastEndTimeDate.getTime() + refreshCD * 3600 * 1000);
    // log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，下次运行：${nextRefreshTime.toLocaleString()}`);
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

// ==============================================
// 特殊材料与超量判断（核心新增逻辑）
// ==============================================
const specialMaterials = [
  "水晶块", "魔晶块", "星银矿石", "紫晶块", "萃凝晶", "虹滴晶", "铁块", "白铁块",
  "精锻用魔矿", "精锻用良矿", "精锻用杂矿"
];

let excessMaterialNames = []; // 超量材料名单

// 筛选低数量材料 + 平行标记超量材料（同源allMaterials）
function filterLowCountMaterials(pathingMaterialCounts, materialCategoryMap, onlyCategoryMode = false) {
  // 超量阈值（普通材料/矿石处理后统一对比）
  const EXCESS_THRESHOLD = exceedCount;
  log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}[超量判断] 超量阈值：${EXCESS_THRESHOLD}`);
  
  // 临时存储超量材料（从原始数据提取，平行于低数量筛选）
  const tempExcess = [];

  // 提取所有需要扫描的材料（超量+低数量共用同一源）
  const allMaterials = Object.values(materialCategoryMap).flat();
  
  // onlyCategory模式下，检查所有扫描到的材料，而不仅仅是materialCategoryMap中的材料
  const shouldCheckAll = onlyCategoryMode || allMaterials.length === 0;
  if (debugLog) log.info(`【材料基准】onlyCategoryMode=${onlyCategoryMode}, allMaterials长度=${allMaterials.length}, shouldCheckAll=${shouldCheckAll}, pathingMaterialCounts长度=${pathingMaterialCounts.length}`);
  if (debugLog) log.info(`【扫描结果】${pathingMaterialCounts.map(item => `${item.name}:${item.count}`).join(', ')}`);
  
  // ========== 第一步：平行判断超量材料（原始数据，不经过低数量过滤） ==========
  pathingMaterialCounts.forEach(item => {
    // onlyCategory模式下，检查所有材料；否则只检查allMaterials内的材料（同源）
    if (!shouldCheckAll && !allMaterials.includes(item.name)) {
      return;
    }
    // 未知数量（?）不判断超量
    if (item.count === "?") {
      return;
    }

    // 矿石数量特殊处理（和低数量筛选的处理逻辑一致）
    let processedCount = Number(item.count);
    if (specialMaterials.includes(item.name)) {
      processedCount = Math.floor(processedCount / 10);
    }

    // 超量判断（平行逻辑：只要≥阈值就标记，和低数量无关）
    if (processedCount >= EXCESS_THRESHOLD) {
      tempExcess.push(item.name);
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
      // 矿石数量处理（和超量判断的处理逻辑一致）
      let processedCount = item.count;
      if (specialMaterials.includes(item.name) && item.count !== "?") {
        processedCount = Math.floor(Number(item.count) / 10);
      }
      return { ...item, count: processedCount };
    });

  tempExcess.push("OCR启动");

  // ========== 第三步：更新全局超量名单（去重） ==========
  excessMaterialNames = [...new Set(tempExcess)];
  const realExcessCount = excessMaterialNames.filter(name => name !== "OCR启动").length;
  if (debugLog) log.info(`【超量材料更新】共${realExcessCount}种：${excessMaterialNames.filter(name => name !== "OCR启动").join("、")}`);
  if (debugLog) log.info(`【低数量材料】筛选后共${filteredLowCountMaterials.length}种：${filteredLowCountMaterials.map(m => m.name).join("、")}`);

  // 返回低数量材料（超量名单已独立生成）
  return filteredLowCountMaterials;
}

// ==============================================
// 路径分类与优先级（简化逻辑，补全所有缺失代码）
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
  const pathingFilePaths = readAllFilePaths(pathingDir, 0, CONSTANTS.MAX_PATH_DEPTH, ['.json']);
  const pathEntries = pathingFilePaths.map(path => {
    const { materialName, monsterName } = extractResourceNameFromPath(path, cdMaterialNames);
    return { path, resourceName: materialName, monsterName };
  }).filter(entry => {
    // 过滤超量材料对应的路径
    if (entry.monsterName) {
      const monsterMaterials = monsterToMaterials[entry.monsterName] || [];
      const allExcess = monsterMaterials.every(mat => excessMaterialNames.includes(mat));
      return !allExcess;
    }
    if (entry.resourceName) {
      return !excessMaterialNames.includes(entry.resourceName);
    }
    return false;
  });

  if (pathEntries.length > 0) {
    if (debugLog) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}\n===== 匹配到的材料路径列表 =====`);
      pathEntries.forEach((entry, index) => {
        log.info(`${index + 1}. 材料：${entry.resourceName || entry.monsterName}，路径：${entry.path}`);
      });
      log.info(`=================================\n`);
    }
  } else {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}未匹配到任何有效的材料路径`);
  }

  // 按优先级分类
  const prioritizedPaths = [];
  const normalPaths = [];
  for (const entry of pathEntries) {
    if (entry.monsterName) {
      const monsterMaterials = monsterToMaterials[entry.monsterName] || [];
      const hasValidTarget = monsterMaterials.some(mat => targetResourceNames.includes(mat) || lowCountMaterialNames.includes(mat));
      if (hasValidTarget) {
        prioritizedPaths.push(entry);
      } else {
        normalPaths.push(entry);
      }
    } else if (entry.resourceName) {
      if (targetResourceNames.includes(entry.resourceName)) {
        prioritizedPaths.push(entry);
      } else if (lowCountMaterialNames.includes(entry.resourceName)) {
        normalPaths.push(entry);
      }
    }
  }

  // 按低数量材料排序
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
  const pathingFilePaths = readAllFilePaths(pathingDir, 0, CONSTANTS.MAX_PATH_DEPTH, ['.json']);
  
  const pathEntries = pathingFilePaths.map(path => {
    const { materialName, monsterName } = extractResourceNameFromPath(path, cdMaterialNames);
    return { path, resourceName: materialName, monsterName };
  }).filter(entry => (entry.resourceName || entry.monsterName) && entry.path.trim() !== "");

  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[路径初始化] 共读取有效路径 ${pathEntries.length} 条`);

  // 测算模式：不执行背包扫描，直接返回所有路径
  if (pathingMode.estimateMode) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[测算模式] 将执行背包扫描以筛选低数量材料`);
  }

  // 分类路径（狗粮 > 怪物 > 普通材料）
  const foodPaths = pathEntries.filter(entry => entry.resourceName && isFoodResource(entry.resourceName));
  const monsterPaths = pathEntries.filter(entry => entry.monsterName && entry.monsterName !== '地脉花');
  const normalPaths = pathEntries.filter(entry => entry.resourceName && !entry.monsterName && entry.resourceName !== '锄地');

  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[路径分类] 狗粮:${foodPaths.length} 怪物:${monsterPaths.length} 普通:${normalPaths.length}`);

  // 测算模式不再直接返回所有路径，而是继续执行背包扫描以筛选低数量材料

  // 怪物路径关联材料到分类（扫描用）- 仅includeBoth和onlyPathing模式
  if (pathingMode.includeBoth || pathingMode.onlyPathing) {
    log.info(`${CONSTANTS.LOG_MODULES.MONSTER}开始处理${monsterPaths.length}条怪物路径的材料分类关联...`);
    monsterPaths.forEach((entry, index) => {
      const materials = monsterToMaterials[entry.monsterName] || [];
      if (materials.length === 0) {
        log.warn(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物路径${index+1}] 怪物【${entry.monsterName}】无对应材料映射`);
        return;
      }
      materials.forEach(mat => {
        // 添加到pathing怪物材料集合（用于OCR过滤）
        ocrContext.pathingMonsterMaterials.add(mat);
        
        const category = matchImageAndGetCategory(mat, imagesDir);
        if (!category) return;
        if (!materialCategoryMap[category]) materialCategoryMap[category] = [];
        if (!materialCategoryMap[category].includes(mat)) {
          materialCategoryMap[category].push(mat);
          // log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${entry.monsterName}】的材料【${mat}】加入分类【${category}】`);
        }
      });
    });
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}pathing文件夹中的怪物材料共${ocrContext.pathingMonsterMaterials.size}种：${Array.from(ocrContext.pathingMonsterMaterials).join('、')}`);
  }

  let processedFoodPaths = foodPaths;
  let processedNormalPaths = [];
  let processedMonsterPaths = monsterPaths;
  let pathingMaterialCounts = [];

  if (normalPaths.length > 0 || monsterPaths.length > 0 || pathingMode.onlyCategory) {
    // 优化：一次扫描获取全量材料数量，同时服务于怪物和普通材料
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] 执行一次全量背包扫描（服务于怪物+普通路径）`);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] materialCategoryMap内容：${JSON.stringify(materialCategoryMap)}`);
    const allMaterialCounts = await MaterialPath(materialCategoryMap);
    pathingMaterialCounts = allMaterialCounts;
    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] 扫描返回数据：${JSON.stringify(allMaterialCounts)}`);
    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] flat后数据：${JSON.stringify(allMaterialCounts.flat())}`);

    // 筛选低数量材料（同时生成超量名单）
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 基于全量扫描结果筛选有效材料`);
    const filteredMaterials = filterLowCountMaterials(allMaterialCounts.flat(), materialCategoryMap, pathingMode.onlyCategory);
    const validMonsterMaterialNames = filteredMaterials.map(m => m.name);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 筛选后有效材料：${validMonsterMaterialNames.join('、')}`);

    // includeBoth模式：更新超量名单并保存到文件
    if (pathingMode.includeBoth) {
      const finalExcessList = excessMaterialNames.filter(name => name !== "OCR启动");
      if (finalExcessList.length > 0) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[includeBoth模式] 更新超量名单，共${finalExcessList.length}种：${finalExcessList.join('、')}`);
      }
      const fullContent = finalExcessList.length > 0 ? `超量名单:${finalExcessList.join(',')}\n` : "";
      file.writeTextSync(CONSTANTS.EXCESS_MATERIALS_PATH, fullContent, false);
    }

    // onlyCategory模式：只扫描，不处理路径
    if (pathingMode.onlyCategory) {
      // 先读取txt超量名单
      const txtExcessMaterials = loadExcessMaterialsList();
      
      // 用本次扫描结果更新超量名单
      const scannedMaterials = allMaterialCounts.flat();
      const updatedExcessMaterials = new Set(txtExcessMaterials);
      
      if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] txt超量名单长度:${txtExcessMaterials.length}, 内容:${txtExcessMaterials.join('、')}`);
      // log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] updatedExcessMaterials初始长度:${updatedExcessMaterials.size}`);
      
      // 逐一检查txt超量名单中的每个材料
      const keptMaterials = [];
      const removedMaterials = [];
      
      txtExcessMaterials.forEach(name => {
        const found = scannedMaterials.find(m => m.name === name);
        if (found) {
          // 扫描到了，检查是否超量
          let rawCount = Number(found.count);
          const originalCount = rawCount;
          // 矿石类材料需要除以10
          if (specialMaterials.includes(name)) {
            rawCount = Math.floor(rawCount / 10);
          }
          // 用处理后的数量判断是否超量
          if (rawCount >= exceedCount) {
            keptMaterials.push(name);
          } else {
            removedMaterials.push(name);
            updatedExcessMaterials.delete(name);
          }
        } else {
          // 没扫描到，保留在超量名单
          keptMaterials.push(name);
        }
      });
      
      const finalExcessList = Array.from(updatedExcessMaterials);
      
      // 输出汇总日志
      if (keptMaterials.length > 0) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 保留在超量名单：${keptMaterials.join('、')}`);
      }
      if (removedMaterials.length > 0) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 从超量名单剔除：${removedMaterials.join('、')}`);
      }
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 更新后超量名单，共${finalExcessList.length}种`);
      
      // 保存更新后的超量名单（直接覆盖，不合并）
      const fullContent = finalExcessList.length > 0 ? `超量名单:${finalExcessList.join(',')}\n` : "";
      file.writeTextSync(CONSTANTS.EXCESS_MATERIALS_PATH, fullContent, false);
      // log.info(`${CONSTANTS.LOG_MODULES.RECORD}超量名单已保存至 ${CONSTANTS.EXCESS_MATERIALS_PATH}，共${finalExcessList.length}种`);
      
      // 过滤只保留超量名单中的材料
      const filteredByExcess = scannedMaterials.filter(item => finalExcessList.includes(item.name));
      pathingMaterialCounts = [filteredByExcess];
      if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 过滤后保留超量材料：${filteredByExcess.map(m => m.name).join('、') || '无'}`);
      
      return { allPaths: [], pathingMaterialCounts };
    }

    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 基于全量扫描结果筛选低数量材料`);
    const lowCountMaterialsFiltered = filteredMaterials;
    const flattenedLowCountMaterials = lowCountMaterialsFiltered.flat().sort((a, b) => a.count - b.count);
    const lowCountMaterialNames = flattenedLowCountMaterials.map(material => material.name);

    processedNormalPaths = classifyNormalPathFiles(pathingDir, targetResourceNames, lowCountMaterialNames, cdMaterialNames)
      .filter(entry => normalPaths.some(n => n.path.replace(/\\/g, '/') === entry.path.replace(/\\/g, '/')));
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 筛选后保留路径 ${processedNormalPaths.length} 条`);
  } else if (foodPaths.length > 0) {
    // 只有狗粮路径时，也需要初始化超量名单（OCR启动需要）
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[狗粮模式] 初始化超量名单`);
    excessMaterialNames = ["OCR启动"];
    if (debugLog) log.info(`【超量材料更新】共${excessMaterialNames.length}种：${excessMaterialNames.join("、")}`);
  }

  // 按TargetresourceName顺序处理路径（优先级1-3按目标顺序，同类型内也按目标顺序）
  const allPaths = [];
  
  // 先处理TargetresourceName中的每个目标，按设置顺序
  targetResourceNames.forEach((targetName, targetIndex) => {
    // 确定目标属于哪种类型
    const isFood = isFoodResource(targetName);
    const targetMonsterMaterials = monsterToMaterials[targetName] ? [targetName] : [];
    
    // 1. 目标狗粮（按TargetresourceName顺序）
    if (isFood) {
      const matchedFoodPaths = processedFoodPaths.filter(e => e.resourceName === targetName);
      allPaths.push(...matchedFoodPaths);
      if (matchedFoodPaths.length > 0) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[目标${targetIndex + 1}] ${targetName}（狗粮）路径 ${matchedFoodPaths.length} 条`);
      }
    }
    // 2. 目标怪物（按TargetresourceName顺序）
    else if (monsterToMaterials[targetName] || materialToMonsters[targetName]) {
      const matchedMonsterPaths = processedMonsterPaths.filter(e => {
        const materials = monsterToMaterials[e.monsterName] || [];
        return materials.includes(targetName);
      });
      allPaths.push(...matchedMonsterPaths);
      if (matchedMonsterPaths.length > 0) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[目标${targetIndex + 1}] ${targetName}（怪物掉落）路径 ${matchedMonsterPaths.length} 条`);
      }
    }
    // 3. 目标普通材料（按TargetresourceName顺序）
    else {
      const matchedNormalPaths = processedNormalPaths.filter(e => e.resourceName === targetName);
      allPaths.push(...matchedNormalPaths);
      if (matchedNormalPaths.length > 0) {
        log.info(`${CONSTANTS.LOG_MODULES.PATH}[目标${targetIndex + 1}] ${targetName}（普通材料）路径 ${matchedNormalPaths.length} 条`);
      }
    }
  });
  
  // 剩余非目标路径（优先级4-6，按原有逻辑）
  const remainingFoodPaths = processedFoodPaths.filter(e => !targetResourceNames.includes(e.resourceName));
  const remainingMonsterPaths = processedMonsterPaths.filter(e => {
    const materials = monsterToMaterials[e.monsterName] || [];
    return !materials.some(mat => targetResourceNames.includes(mat)) && 
           materials.some(mat => !excessMaterialNames.includes(mat));
  });
  const remainingNormalPaths = processedNormalPaths.filter(e => !targetResourceNames.includes(e.resourceName));
  
  // 4. 剩余狗粮
  allPaths.push(...remainingFoodPaths);
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[优先级4] 剩余狗粮 路径 ${remainingFoodPaths.length} 条`);
  
  // 5. 剩余怪物
  allPaths.push(...remainingMonsterPaths);
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[优先级5] 剩余怪物 路径 ${remainingMonsterPaths.length} 条`);
  
  // 6. 剩余普通材料
  allPaths.push(...remainingNormalPaths);
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[优先级6] 剩余普通材料 路径 ${remainingNormalPaths.length} 条`);

  // 按时间成本排序同一材料的路径（1%到100%）
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 开始按时间成本排序同一材料的路径...`);
  
  // 收集时间成本数据
  const pathRecordCache = {};
  const allTimeCostData = collectAllTimeCostData(allPaths, CONSTANTS.RECORD_DIR, CONSTANTS.NO_RECORD_DIR, pathRecordCache);
  
  // 按材料分组
  const pathsByResource = {};
  allPaths.forEach(entry => {
    const resourceKey = entry.monsterName || entry.resourceName;
    if (!resourceKey) return;
    
    if (!pathsByResource[resourceKey]) {
      pathsByResource[resourceKey] = [];
    }
    pathsByResource[resourceKey].push(entry);
  });
  
  // 对每个材料的路径按时间成本排序
  const sortedPaths = [];
  for (const [resourceKey, paths] of Object.entries(pathsByResource)) {
    // 为每个路径附加时间成本
    const pathsWithCost = paths.map(entry => {
      const pathName = basename(entry.path);
      const perTime = calculatePerTime(
        entry.resourceName || entry.monsterName,
        pathName,
        CONSTANTS.RECORD_DIR,
        CONSTANTS.NO_RECORD_DIR,
        isFoodResource(entry.resourceName || entry.monsterName),
        pathRecordCache,
        entry.path
      );
      return { ...entry, perTime };
    });
    
    // 辅助函数：检查路径是否有历史记录（利用已有的pathRecordCache）
    const entryHasHistory = (entry) => {
      const pathName = basename(entry.path);
      const resourceName = entry.resourceName || entry.monsterName;
      const isFood = isFoodResource(resourceName);
      
      // 利用已有的pathRecordCache，避免重复读取文件
      const cacheKey = `${resourceName}_${pathName}`;
      const cachedRecords = pathRecordCache[cacheKey];
      
      return cachedRecords && cachedRecords.length > 0;
    };
    
    // 按时间成本排序（三层优先级）
    // 优先级1：有具体时间成本的，按数值从小到大排序
    // 优先级2：记录不足但知道时间的，放在有具体时间的后面
    // 优先级3：不知道时间的，默认2分钟（120秒），放在最后
    const DEFAULT_TIME_COST = 120; // 默认2分钟（120秒）
    
    pathsWithCost.sort((a, b) => {
      // 获取排序优先级（1=有具体时间，2=记录不足，3=不知道时间）
      const getPriority = (perTime, hasHistory) => {
        if (perTime !== null) return 1; // 有具体时间成本
        if (hasHistory) return 2; // 记录不足但知道时间
        return 3; // 不知道时间
      };
      
      // 检查是否有历史记录
      const hasHistoryA = entryHasHistory(a);
      const hasHistoryB = entryHasHistory(b);
      
      const priorityA = getPriority(a.perTime, hasHistoryA);
      const priorityB = getPriority(b.perTime, hasHistoryB);
      
      // 优先级不同，按优先级排序
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // 优先级相同，按时间成本排序
      if (a.perTime !== null && b.perTime !== null) {
        return a.perTime - b.perTime;
      }
      
      // 都是null，保持原顺序
      return 0;
    });
    
    // 输出排序结果
    if (debugLog) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] ${resourceKey} 的路径按时间成本排序：`);
      pathsWithCost.forEach((p, idx) => {
        const hasHistory = entryHasHistory(p);
        let costStr;
        let priorityStr;
        
        if (p.perTime !== null) {
          costStr = `${p.perTime.toFixed(2)}秒/单位`;
          priorityStr = '优先级1（有具体时间）';
        } else if (hasHistory) {
          costStr = '记录不足';
          priorityStr = '优先级2（有历史但不足）';
        } else {
          costStr = '无记录（默认120秒）';
          priorityStr = '优先级3（无历史）';
        }
        
        log.info(`  ${idx + 1}. ${basename(p.path)} - ${costStr} - ${priorityStr}`);
      });
    }
    
    sortedPaths.push(...pathsWithCost);
  }
  
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 完成，共${sortedPaths.length}条路径`);

  // log.info(`${CONSTANTS.LOG_MODULES.PATH}[最终路径] 共${allPaths.length}条：${allPaths.map(p => basename(p.path))}`);
  return { allPaths: sortedPaths, pathingMaterialCounts };
}

// ==============================================
// 通知工具
// ==============================================
/**
 * 分块发送通知（修复为异步函数，确保通知发送完成后再退出）
 * @param {string} msg - 通知消息
 * @param {Function} sendFn - 发送函数
 */
async function sendNotificationInChunks(msg, sendFn) {
  if (!notify) return;
  if (typeof msg !== 'string' || msg.length === 0) return;

  const chunkSize = CONSTANTS.NOTIFICATION_CHUNK_SIZE;
  if (msg.length <= chunkSize) {
    try {
      sendFn(msg);
    } catch (e) {
      log.debug(`发送通知失败（可能已退出）: ${e.message}`);
    }
    return;
  }

  const totalChunks = Math.ceil(msg.length / chunkSize);
  log.info(`${CONSTANTS.LOG_MODULES.MAIN}通知消息过长（${msg.length}字符），拆分为${totalChunks}段发送`);
  
  let start = 0;
  for (let i = 0; i < totalChunks; i++) {
    const end = Math.min(start + chunkSize, msg.length);
    const chunkMsg = `【通知${i+1}/${totalChunks}】\n${msg.substring(start, end)}`;
    try {
      sendFn(chunkMsg);
      log.info(`${CONSTANTS.LOG_MODULES.MAIN}已发送第${i+1}段通知（${chunkMsg.length}字符）`);
    } catch (e) {
      log.debug(`发送第${i+1}段通知失败（可能已退出）: ${e.message}`);
    }
    start = end;
    await sleep(100); // 每段之间增加短暂延迟，确保发送完成
  }
}

// ==============================================
// 结果汇总
// ==============================================
/**
 * 保存超量名单到文件
 * @param {string[]} excessList - 超量材料名单
 */
function saveExcessMaterialsList(excessList) {
  try {
    const newMaterials = excessList.filter(name => name !== "OCR启动");
    
    let existingMaterials = [];
    try {
      const existingContent = safeReadTextSync(CONSTANTS.EXCESS_MATERIALS_PATH);
      const match = existingContent.match(/超量名单:(.*)/);
      if (match) {
        existingMaterials = match[1].split(',').map(name => name.trim()).filter(name => name);
      }
    } catch (readError) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}超量名单文件不存在或读取失败: ${CONSTANTS.EXCESS_MATERIALS_PATH}`);
    }
    
    const allMaterials = [...new Set([...existingMaterials, ...newMaterials])];
    const fullContent = allMaterials.length > 0 ? `超量名单:${allMaterials.join(',')}\n` : "";
    
    const result = file.writeTextSync(CONSTANTS.EXCESS_MATERIALS_PATH, fullContent, false);
    if (result) {
      const addedCount = newMaterials.filter(m => !existingMaterials.includes(m)).length;
      log.info(`${CONSTANTS.LOG_MODULES.RECORD}超量名单已保存至 ${CONSTANTS.EXCESS_MATERIALS_PATH}，共${allMaterials.length}种（新增${addedCount}种）`);
    } else {
      log.error(`${CONSTANTS.LOG_MODULES.RECORD}超量名单保存失败: ${CONSTANTS.EXCESS_MATERIALS_PATH}`);
    }
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}保存超量名单失败：${error.message}`);
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}错误堆栈：${error.stack}`);
  }
}

/**
 * 读取超量名单文件
 * @returns {string[]} 超量材料名单
 */
function loadExcessMaterialsList() {
  try {
    const content = safeReadTextSync(CONSTANTS.EXCESS_MATERIALS_PATH);
    if (!content) {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}超量名单文件不存在或为空：${CONSTANTS.EXCESS_MATERIALS_PATH}`);
      return [];
    }
    
    const match = content.match(/超量名单:(.*)/);
    if (!match) {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}超量名单文件格式错误，未找到"超量名单:"前缀`);
      return [];
    }
    
    const materials = match[1].split(',').map(name => name.trim()).filter(name => name);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}读取超量名单成功，共${materials.length}种：${materials.join('、')}`);
    return materials;
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.RECORD}读取超量名单失败：${error.message}`);
    return [];
  }
}

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
总耗时：${formatTime(totalRunTime)}
累计获取材料：
${Object.entries(totalDifferences).map(([name, diff]) => `  ${name}: +${diff}个`).join('\n')}
=========================================\n\n`;
  writeContentToFile(summaryPath, content);
  log.info(`${CONSTANTS.LOG_MODULES.RECORD}最终汇总已记录至 ${summaryPath}`);
  state.completed = true;
  state.cancelRequested = true;
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
  const texttolerance = 3;

  // 目标资源处理
  const targetResourceNamesStr = settings.TargetresourceName || "";
  const rawTargetResourceNames = targetResourceNamesStr
    .split(/[,，、 \s]+/)
    .map(name => name.trim())
    .filter(name => name !== "");
  
  // 将怪物名转换为最高级材料
  const targetResourceNames = processTargetResourceNames(rawTargetResourceNames);

  const targetTextCategories = readtargetTextCategories(CONSTANTS.TARGET_TEXT_DIR);

  // 并行任务：OCR交互（修正版）
  const ocrTask = pathingMode.estimateMode ? null : (async () => {
    let allTargetTexts = [];
    for (const categoryName in targetTextCategories) {
      const targetTexts = targetTextCategories[categoryName];
      allTargetTexts = allTargetTexts.concat(Object.values(targetTexts).flat());
    }

    // 等待超量名单生成
    let waitTimes = 0;
    while (excessMaterialNames.length === 0 && !state.cancelRequested && waitTimes < 100) { 
      await sleep(1000);
      waitTimes++;
    }
    if (state.cancelRequested) {
      log.info(`${CONSTANTS.LOG_MODULES.MAIN}OCR任务收到终止信号，已退出`);
      return;
    }
    
    const getFilteredTargetTexts = () => {
      // 首先过滤超量材料
      let filtered = allTargetTexts.filter(name => !excessMaterialNames.includes(name));
      
      // 如果不是怪物路径，直接返回过滤结果
      if (ocrContext.currentPathType !== 'monster') {
        return filtered;
      }
      
      // 如果取消怪物材料过滤，直接返回过滤结果
      if (noMonsterFilter) {
        if (debugLog) {
          log.info(`OCR拾取列表（怪物路径，取消过滤）：`);
          log.info(`  - 所有未超量材料：${filtered.join('、') || '无'}`);
        }
        return filtered;
      }
      
      // 怪物路径的过滤逻辑
      filtered = filtered.filter(name => {
        // 如果不是怪物材料，保留
        if (!materialToMonsters[name]) return true;
        
        // 如果是怪物材料，检查是否在允许的列表中
        const currentMonsterMaterials = ocrContext.currentTargetMaterials || [];
        const pathingMonsterMaterials = Array.from(ocrContext.pathingMonsterMaterials || new Set());
        
        // 保留当前怪物的材料或pathing中的怪物材料
        return currentMonsterMaterials.includes(name) || pathingMonsterMaterials.includes(name);
      });
      
      // 输出调试信息
      if (debugLog) {
        const currentMonsterMaterials = ocrContext.currentTargetMaterials || [];
        const pathingMonsterMaterials = Array.from(ocrContext.pathingMonsterMaterials || new Set());
        const additionalMonsterMaterials = pathingMonsterMaterials.filter(mat => 
          !currentMonsterMaterials.includes(mat) && !excessMaterialNames.includes(mat)
        );
        
        log.info(`OCR拾取列表（怪物路径）：`);
        log.info(`  - 当前怪物材料：${currentMonsterMaterials.join('、') || '无'}`);
        log.info(`  - pathing其他怪物材料（未超量）：${additionalMonsterMaterials.join('、') || '无'}`);
        log.info(`  - 非怪物材料：${filtered.filter(name => !materialToMonsters[name]).join('、') || '无'}`);
      }
      
      return filtered;
    };

    log.info(`超量名单：${excessMaterialNames.join('、')}`);
    if (debugLog) log.info(`OCR最终目标文本（已过滤超量）：${getFilteredTargetTexts().join('、')}`);

    await alignAndInteractTarget(getFilteredTargetTexts, fDialogueRo, textxRange, texttolerance);
  })();

  // 并行任务：路径处理
  const pathTask = (async () => {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}开始路径处理流程`);

    // 加载CD分类
    const CDCategories = readMaterialCD();
    const cdMaterialNames = new Set();
    for (const [categoryName, cdInfo] of Object.entries(CDCategories)) {
      if (allowedCDCategories.length > 0 && !allowedCDCategories.includes(categoryName)) continue;
      for (const [_, materialList] of Object.entries(cdInfo)) {
        materialList.forEach(name => cdMaterialNames.add(name));
      }
    }
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.CD}CD文件中材料名（已过滤）：${Array.from(cdMaterialNames).join(', ')}`);

    // 生成材料分类映射
  let materialCategoryMap = {};
  
  // 处理选中的材料分类
  if (selected_materials_array.length > 0 && !pathingMode.onlyPathing) {
    // 1. 初始化选中的分类（onlyPathing模式除外）
    selected_materials_array.forEach(selectedCategory => {
      materialCategoryMap[selectedCategory] = [];
    });
  } else {
    if (pathingMode.onlyPathing) {
      if (debugLog) log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}onlyPathing模式：将自动扫描pathing材料的实际分类`);
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}未选择【材料分类】，采用【路径材料】专注模式`);
    }
  }
  
  // 2. 处理路径相关材料（仅includeBoth和onlyPathing模式）
  if ((pathingMode.includeBoth || pathingMode.onlyPathing) && (Object.keys(materialCategoryMap).length > 0 || pathingMode.onlyPathing)) {
    const pathingFilePaths = readAllFilePaths(CONSTANTS.PATHING_DIR, 0, CONSTANTS.MAX_PATH_DEPTH, ['.json']);
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
    Array.from(allMaterials).forEach(resourceName => {
      const category = matchImageAndGetCategory(resourceName, CONSTANTS.IMAGES_DIR);
      if (category) {
        if (!materialCategoryMap[category]) {
          materialCategoryMap[category] = [];
        }
        if (!materialCategoryMap[category].includes(resourceName)) {
          materialCategoryMap[category].push(resourceName);
        }
      }
    });
  }
  
  // 3. 在onlyPathing或onlyCategory模式下，保留所有选中的分类
  if (pathingMode.onlyPathing || pathingMode.onlyCategory) {
    // 对于onlyCategory模式，保留所有选中的分类，即使是空数组
    // 对于onlyPathing模式，删除空数组
    if (pathingMode.onlyPathing) {
      Object.keys(materialCategoryMap).forEach(category => {
        if (materialCategoryMap[category].length === 0) {
          delete materialCategoryMap[category];
        }
      });
    }
  }
  
  // 4. 在onlyCategory模式下，确保materialCategoryMap只包含选中的分类
  if (pathingMode.onlyCategory) {
    const selectedCategoriesSet = new Set(selected_materials_array);
    const filteredMap = {};
    
    // 只保留选中的分类，即使是空数组
    selected_materials_array.forEach(category => {
      filteredMap[category] = materialCategoryMap[category] || [];
    });
    
    materialCategoryMap = filteredMap;
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

    // onlyCategory模式：只扫描，不处理路径和末次扫描，直接结束
    // 但如果同时勾选了测算模式，则跳过此逻辑
    if (pathingMode.onlyCategory && !pathingMode.estimateMode) {
      // log.info(`${CONSTANTS.LOG_MODULES.MAIN}[onlyCategory模式] 扫描完成，直接结束`);
      // log.info(`${CONSTANTS.LOG_MODULES.MAIN}[onlyCategory模式] 超量名单数据：${JSON.stringify(excessMaterialNames)}`);
      saveExcessMaterialsList(excessMaterialNames);
      state.completed = true;
      state.cancelRequested = true;
      return;
    }

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
      endTimeStr
    );

    // 测算模式下不执行末次扫描和汇总
    if (pathingMode.estimateMode) {
      log.info(`${CONSTANTS.LOG_MODULES.MAIN}[测算模式] 分析完成，直接结束`);
      state.completed = true;
      state.cancelRequested = true;
      return;
    }

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
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}总耗时：${formatTime(totalRunTime)}`);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}总累积获取：${JSON.stringify(totalDifferences, null, 2)}`);

    recordFinalSummary(CONSTANTS.RECORD_DIR, firstScanTime, endTime, totalRunTime, totalDifferences);

    let finalMsg = `收集完成\n总耗时：${formatTime(totalRunTime)}\n累计获取：\n`;
    Object.entries(totalDifferences).forEach(([n, d]) => {
      if (n.includes('_EXP')) {
        finalMsg += `  ${n.replace('_EXP', '')}（EXP）: ${d}\n`;
      } else {
        finalMsg += `  ${n}: ${d}个\n`;
      }
    });
    await sendNotificationInChunks(finalMsg, notification.Send);
  })();

  // 执行所有任务
  // 测算模式下，只执行路径任务，不执行 OCR 和图像点击任务
  const imageTask = pathingMode.estimateMode ? null : imageClickBackgroundTask();
  
  const tasks = pathingMode.estimateMode ? [pathTask] : [ocrTask, pathTask, imageTask].filter(t => t !== null);
  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}任务列表已创建，共${tasks.length}个任务`);
  
  try {
    await Promise.allSettled(tasks);
  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.MAIN}执行任务时发生错误：${error.message}`);
    state.cancelRequested = true;
  } finally {
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}执行结束或取消后的清理操作...`);
    state.cancelRequested = true;
  }
})();
