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
  FOOD_ZERO_EXP_SUFFIX: "_狗粮-0.txt", // 新增：狗粮0 EXP记录后缀
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
eval(safeReadTextSync("lib/updateSettings.js"));
eval(safeReadTextSync("lib/ocr.js"));
eval(safeReadTextSync("lib/autoPick.js"));
eval(safeReadTextSync("lib/exp.js"));
eval(safeReadTextSync("lib/backStats.js"));
eval(safeReadTextSync("lib/imageClick.js"));
eval(safeReadTextSync("lib/displacement.js"));

// ==============================================
// 内容检测码生成（通用哈希逻辑）
// ==============================================
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
      hash = hash & hash; // 转换为32位整数
    }
    return ((hash >>> 0).toString(16).padStart(8, '0')).slice(-8);
  } catch (error) {
    log.warn(`生成检测码失败: ${error.message}，使用默认值`);
    return "00000000";
  }
}

/**
 * 从文件名中提取内容检测码
 * @param {string} fileName - 文件名
 * @returns {string|null} 内容检测码，未找到返回null
 */
function extractContentCodeFromFileName(fileName) {
  const match = fileName.match(/_([0-9a-fA-F]{8})\.json$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * 读取路径文件并生成内容检测码
 * @param {string} pathingFilePath - 路径文件路径
 * @returns {string} 内容检测码
 */
function generatePathContentCode(pathingFilePath) {
  try {
    // 从文件名中提取检测码
    const fileName = basename(pathingFilePath);
    const extractedCode = extractContentCodeFromFileName(fileName);
    if (extractedCode) {
      return extractedCode;
    }
    
    // 如果文件名中没有检测码，生成新的
    const content = safeReadTextSync(pathingFilePath);
    if (!content) {
      log.warn(`${CONSTANTS.LOG_MODULES.PATH}路径文件为空: ${pathingFilePath}`);
      return "00000000";
    }
    
    const pathData = JSON.parse(content);
    const positions = pathData.positions || pathData.actions || [];
    
    if (!Array.isArray(positions) || positions.length === 0) {
      log.warn(`${CONSTANTS.LOG_MODULES.PATH}路径文件无有效位置数据: ${pathingFilePath}`);
      return "00000000";
    }
    
    return generateContentCode(positions);
  } catch (error) {
    log.warn(`${CONSTANTS.LOG_MODULES.PATH}生成路径检测码失败: ${error.message}`);
    return "00000000";
  }
}
// ==============================================
// 冷启动缓存管理（精简版，无取消状态）
// ==============================================
const ColdStartCache = {
  snapshot: null,
  timestamp: null,
  cacheFile: "cache/initial_snapshot.json",
  cacheDir: "cache",
  expiryMinutes: 30,
  maxAgeHours: 8,

  // 初始化
  init(settings) {
    if (settings.cacheExpiryMinutes) {
      this.expiryMinutes = Math.min(120, Math.max(5, Number(settings.cacheExpiryMinutes) || 30));
    }
    if (settings.cacheMaxAgeHours) {
      this.maxAgeHours = Math.min(24, Math.max(1, Number(settings.cacheMaxAgeHours) || 8));
    }
    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}缓存配置: ${this.expiryMinutes}分钟过期, 最长${this.maxAgeHours}小时`);

    // 尝试创建目录（不阻塞）
    this.ensureCacheDirectory();
  },

  // 检查缓存目录
  ensureCacheDirectory() {
    if (!file.isFolder(this.cacheDir)) {
      log.warn(`缓存目录不存在，请手动创建: ${this.cacheDir}`);
    }
  },
  // 获取初始快照
  async getInitialSnapshot(categoryMap, forceRefresh = false) {
    const now = Date.now();

    // 1. 尝试内存缓存
    if (!forceRefresh && this.snapshot && this.timestamp) {
      const ageMinutes = (now - this.timestamp) / (60 * 1000);
      const ageHours = ageMinutes / 60;

      if (ageHours > this.maxAgeHours) {
        log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}内存缓存超过最大生命周期，重新扫描`);
        this.snapshot = null;
        this.timestamp = null;
      } else if (ageMinutes <= this.expiryMinutes) {
        log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}🚀 使用内存缓存 (${ageMinutes.toFixed(1)}分钟前)`);
        // ✅ 直接返回，不执行任何扫描操作
        return this.snapshot;
      }
    }

    // 2. 尝试文件缓存
    if (!forceRefresh) {
      const fileCache = await this.loadFromFile();
      if (fileCache) {
        const ageMinutes = (now - this.timestamp) / (60 * 1000);
        const ageHours = ageMinutes / 60;

        if (ageHours > this.maxAgeHours) {
          log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}文件缓存超过最大生命周期，重新扫描`);
          this.snapshot = null;
          this.timestamp = null;
          this.deleteCacheFile();
        } else if (ageMinutes <= this.expiryMinutes) {
          log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}🚀 使用文件缓存 (${ageMinutes.toFixed(1)}分钟前)`);
          // ✅ 直接返回，不执行任何扫描操作
          return this.snapshot;
        }
      }
    }
    // 3. 只有没有缓存或缓存过期才执行扫描
    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}执行初始扫描...`);
    const startTime = Date.now();
    this.snapshot = await MaterialPath(categoryMap);
    this.timestamp = now;
    const costTime = ((Date.now() - startTime) / 1000).toFixed(1);

    this.saveToFile();
    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}初始扫描完成，耗时 ${costTime}秒，已缓存`);

    return this.snapshot;
  },

  // 路径执行后更新缓存
  updateAfterPath(materialCountDifferences) {
    if (!this.snapshot) return;

    let updated = false;
    Object.entries(materialCountDifferences).forEach(([materialName, diff]) => {
      for (const category of this.snapshot) {
        const item = category.find(m => m.name === materialName);
        if (item) {
          const oldCount = parseInt(item.count);
          item.count = (oldCount + diff).toString();
          updated = true;
          if (debugLog) {
            log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}缓存更新: ${materialName} ${oldCount} → ${item.count}`);
          }
          break;
        }
      }
    });

    // 直接保存，不用setTimeout
    if (updated) {
      this.saveToFile();
    }
  },

  // 保存到文件
  saveToFile() {
    if (!this.snapshot) return;

    try {
      const cacheData = {
        snapshot: this.snapshot,
        timestamp: this.timestamp,
        version: "1.0"  // 移除 taskCancelled
      };

      const jsonStr = JSON.stringify(cacheData);
      const result = file.writeTextSync(this.cacheFile, jsonStr, false);

      if (result && debugLog) {
        log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}缓存已保存 (${(jsonStr.length/1024).toFixed(2)}KB)`);
      }
    } catch (error) {
      if (debugLog) {
        log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}缓存保存失败: ${error.message}`);
      }
    }
  },

  // 从文件加载
  async loadFromFile() {
    try {
      const content = file.readTextSync(this.cacheFile);
      if (!content) return false;

      const cacheData = JSON.parse(content);

      // 版本检查（兼容旧版）
      if (cacheData.version !== "1.0" && cacheData.version !== undefined) {
        return false;
      }

      this.snapshot = cacheData.snapshot;
      this.timestamp = cacheData.timestamp;

      if (debugLog) {
        log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}缓存加载成功，来自: ${new Date(this.timestamp).toLocaleString()}`);
      }
      return true;
    } catch (error) {
      return false;
    }
  },

  // 删除缓存文件
  deleteCacheFile() {
    try {
      file.delete(this.cacheFile);
    } catch (error) {}
  },

  // 任务完成时更新缓存
  async updateOnCompletion(categoryMap) {
    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}任务完成，更新缓存...`);
    const startTime = Date.now();
    this.snapshot = await MaterialPath(categoryMap);
    this.timestamp = Date.now();
    this.saveToFile();
    const costTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}缓存更新完成，耗时 ${costTime}秒`);
    return this.snapshot;
  },

  // 强制保存
  forceSave() {
    this.saveToFile();
  },

  // 清除缓存
  clear() {
    this.snapshot = null;
    this.timestamp = null;
    this.deleteCacheFile();
    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}缓存已清除`);
  }
};

// ==============================================
// 全局状态（保持不变）
// ==============================================
var state = { completed: false, cancelRequested: false, ocrPaused: false };

// ==============================================
// 全局图片缓存（避免重复加载）
// ==============================================
const globalImageCache = new Map();

function getCachedImageMat(filePath) {
    if (globalImageCache.has(filePath)) {
        return globalImageCache.get(filePath);
    }
    const mat = file.readImageMatSync(filePath);
    if (!mat.empty()) {
        globalImageCache.set(filePath, mat);
    }
    return mat;
}

// ==============================================
// OCR上下文（用于动态过滤拾取列表）
// ==============================================
const ocrContext = { currentPathType: null, currentTargetMaterials: [], pathingMonsterMaterials: new Set() };

// ==============================================
// 初始化配置参数
// ==============================================
const timeCost = Math.min(300, Math.max(0, Math.floor(Number(settings.TimeCost) || 30)));
const notify = settings.notify || false;
const noRecord = settings.noRecord || false;
const debugLog = settings.debugLog || false;
const targetCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.TargetCount) || 5000))); // 设定的目标数量
const exceedCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.ExceedCount) || 9000))); // 设定的超量目标数量
const endTimeStr = settings.CurrentTime ? settings.CurrentTime : null;

// 新增：缓存配置
const cacheExpiryMinutes = Math.min(120, Math.max(5, Number(settings.cacheExpiryMinutes) || 30));

// 初始化缓存
ColdStartCache.init({ cacheExpiryMinutes });

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
    log.info(`${CONSTANTS.LOG_MODULES.INIT}可用CD分类：${availableCDCategories.join(', ')}`);
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
    log.info(`${CONSTANTS.LOG_MODULES.INIT}未配置CD分类过滤，将处理所有分类`);
}
// 新增：检查缓存目录
(function checkCacheDirectory() {
  try {
    // 尝试写测试文件
    const testFile = "cache/.test";
    const result = file.writeTextSync(testFile, "test", false);
    if (result) {
      try { file.delete(testFile); } catch (e) {}
    } else {
      log.warn(`========================================`);
      log.warn(`【重要提示】缓存功能需要手动创建文件夹`);
      log.warn(`请在脚本目录下创建文件夹: cache`);
      log.warn(`创建后缓存功能才能正常工作`);
      log.warn(`========================================`);
    }
  } catch (error) {
    log.warn(`========================================`);
    log.warn(`【重要提示】缓存功能需要手动创建文件夹`);
    log.warn(`请在脚本目录下创建文件夹: cache`);
    log.warn(`创建后缓存功能才能正常工作`);
    log.warn(`========================================`);
  }
})();

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
        // 处理怪物名称可能包含多个名称的情况（用 / 分隔）
        const monsterNames = monsterName.split(/[\/、\s]+/).filter(name => name.trim());

        monsterNames.forEach(singleMonsterName => {
          if (!monsterToMaterials[singleMonsterName]) {
            monsterToMaterials[singleMonsterName] = [];
          }

          // 去重添加材料
          materials.forEach(mat => {
            if (!monsterToMaterials[singleMonsterName].includes(mat)) {
              monsterToMaterials[singleMonsterName].push(mat);
            }
          });
        });

        materials.forEach(mat => {
          if (!materialToMonsters[mat]) {
            materialToMonsters[mat] = new Set(); // 用Set替代Array
          }
          monsterNames.forEach(singleMonsterName => {
            materialToMonsters[mat].add(singleMonsterName);
          });
        });

        // 调试信息：只在debugLog开启时打印详细解析内容
        if (debugLog) {
          log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}解析行: ${line}`);
          log.debug(`  -> 怪物: [${monsterNames.join('], [')}]`);
          log.debug(`  -> 材料: [${materials.join('], [')}]`);
        }
      }
    });

    // 重要统计信息：保持info级别（每次启动打印一次）
    log.info(`${CONSTANTS.LOG_MODULES.MONSTER}共解析 ${Object.keys(monsterToMaterials).length} 个怪物`);
    log.info(`${CONSTANTS.LOG_MODULES.MONSTER}共解析 ${Object.keys(materialToMonsters).length} 种材料`);

  } catch (error) {
    log.error(`${CONSTANTS.LOG_MODULES.MONSTER}解析怪物材料文件失败：${error.message}`);
  }
}
parseMonsterMaterials(); // 初始化怪物材料映射

// ==============================================
// 路径模式配置
// ==============================================
const pathingValue = Array.from(settings.Pathing || []);

const pathingMode = {
  includeBoth: pathingValue.length === 2,
  onlyPathing: pathingValue.length === 1 && pathingValue.includes('📁pathing材料'),
  onlyCategory: pathingValue.length === 1 && pathingValue.includes('【扫描额外的分类】')
};

if (pathingValue.length === 0) {
  log.warn(`${CONSTANTS.LOG_MODULES.PATH}未配置Pathing，默认为仅📁pathing材料`);
  pathingMode.onlyPathing = true;
}

if (pathingMode.includeBoth) log.warn(`${CONSTANTS.LOG_MODULES.PATH}默认模式，📁pathing材料 将覆盖 勾选的分类`);
if (pathingMode.onlyCategory) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【背包统计】专注模式，将忽略📁pathing材料`);
if (pathingMode.onlyPathing) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【路径材料】专注模式，将忽略勾选的分类`);

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
   
  // 兼容旧的checkbox字段名
  if (!selectedCategories || selectedCategories.length === 0) {
    const checkboxToCategory = {
      "Smithing": "矿石、原胚",
      "Drops": "经验书、怪物掉落",
      "ForagedFood": "采集食物",
      "General": "一般素材",
      "CookingIngs": "烹饪用食材",
      "Weekly": "周本素材",
      "Wood": "木材",
      "CharAscension": "世界BOSS",
      "Fishing": "鱼饵、鱼类",
      "Gems": "宝石",
      "Talent": "天赋素材",
      "WeaponAscension": "武器突破",
      "XP": "祝圣精华"
    };
     
    Object.keys(checkboxToCategory).forEach(checkboxName => {
      if (settings[checkboxName] === true) {
        selectedCategories.push(checkboxToCategory[checkboxName]);
      }
    });
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
// 记录管理（核心修改：公共函数+缓存复用）
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
      existingContent = safeReadTextSync(filePath);
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
 * @param {boolean} isFood - 是否为狗粮路径（新增参数）
 * @returns {boolean} 是否允许运行（true=允许）
 */
function checkPathNameFrequency(resourceName, pathName, recordDir, isFood = false) {
  // ========== 核心修改：适配狗粮0记录文件 ==========
  let suffix = CONSTANTS.ZERO_COUNT_SUFFIX; // 普通材料默认-0.txt
  if (isFood) {
    suffix = CONSTANTS.FOOD_ZERO_EXP_SUFFIX; // 狗粮用_狗粮-0.txt
  }
  const recordPath = `${recordDir}/${resourceName}${suffix}`;
  let totalCount = 0;

  try {
    const content = safeReadTextSync(recordPath);
    const lines = content.split('\n');

    lines.forEach(line => {
      if (line.startsWith('路径名: ') && line.split('路径名: ')[1] === pathName) {
        totalCount++;
      }
    });
  } catch (error) {
    log.debug(`${CONSTANTS.LOG_MODULES.RECORD}目录${recordDir}中无${resourceName}${suffix}记录，跳过检查`);
  }

  // 重复次数≥3则禁止运行（仅统计0记录）
  if (totalCount >= 3) {
    const typeDesc = isFood ? "狗粮" : "普通材料";
    log.info(`${CONSTANTS.LOG_MODULES.RECORD}${typeDesc}路径文件: ${pathName}，累计0 EXP/0数量运行${totalCount}次，请清理记录后再执行`);
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
function recordRunTime(resourceName, pathName, startTime, endTime, runTime, recordDir, materialCountDifferences = {}, finalCumulativeDistance, pathingFilePath) {
  const recordPath = `${recordDir}/${resourceName}.txt`;
  // 生成内容检测码
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
  const normalContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;

  try {
    if (runTime > 5) { // 运行时间>5秒才处理记录
      // 怪物路径专用逻辑（判断对应材料总数量是否为0）
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
          const zeroMonsterContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMonsterPath, zeroMonsterContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}怪物【${resourceName}】对应材料总数量为0，已写入单独文件: ${zeroMonsterPath}`);
        }
      }

      // 普通材料0记录逻辑
      for (const [material, count] of Object.entries(materialCountDifferences)) {
        if (material === resourceName && count === 0) {
          const zeroMaterialPath = `${recordDir}/${material}${CONSTANTS.ZERO_COUNT_SUFFIX}`;
          const zeroMaterialContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${JSON.stringify(materialCountDifferences)}\n\n`;
          writeContentToFile(zeroMaterialPath, zeroMaterialContent);
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}材料数目为0，已写入单独文件: ${zeroMaterialPath}`);
        }
      }

      // 正常记录生成逻辑
      const hasZeroMaterial = Object.values(materialCountDifferences).includes(0);
      const isFinalCumulativeDistanceTooSmall = finalCumulativeDistance <= 5;

      if (!(hasZeroMaterial && isFinalCumulativeDistanceTooSmall)) {
        writeContentToFile(recordPath, normalContent);
        log.info(`${CONSTANTS.LOG_MODULES.RECORD}正常记录已写入: ${recordPath}`);
      } else {
        if (hasZeroMaterial) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}存在材料数目为0的情况: ${JSON.stringify(materialCountDifferences)}`);
        if (isFinalCumulativeDistanceTooSmall) log.warn(`${CONSTANTS.LOG_MODULES.RECORD}累计距离≤5: finalCumulativeDistance=${finalCumulativeDistance}`);
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}未写入正常记录: ${recordPath}`);
      }
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}运行时间小于5秒，未满足记录条件: ${recordPath}`);
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
function getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath) {
  const checkDirs = [recordDir, noRecordDir];
  let latestEndTime = null;
  
  // 生成内容检测码
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  
  // 清理路径名中的检测码
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');

  checkDirs.forEach(dir => {
    const recordPath = `${dir}/${resourceName}.txt`;
    try {
      const content = safeReadTextSync(recordPath);
      const lines = content.split('\n');

      // 按空行分割成记录块
      const recordBlocks = content.split('\n\n').filter(block => block.includes('路径名: '));
      
      recordBlocks.forEach(block => {
        const blockLines = block.split('\n');
        let blockPathName = '';
        let blockContentCode = '00000000';
        let blockEndTime = null;
        
        blockLines.forEach(line => {
          if (line.startsWith('路径名: ')) {
            blockPathName = line.split('路径名: ')[1];
          } else if (line.startsWith('内容检测码: ')) {
            blockContentCode = line.split('内容检测码: ')[1] || '00000000';
          } else if (line.startsWith('结束时间: ')) {
            blockEndTime = line.split('结束时间: ')[1];
          }
        });
        
        // 清理记录中的路径名检测码
        const cleanBlockPathName = blockPathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
        
        // 匹配条件：路径名相同 或者 内容检测码相同（新逻辑）
        const isPathMatch = cleanBlockPathName === cleanPathName;
        const isContentCodeMatch = contentCode && blockContentCode === contentCode;
        const isMatch = isPathMatch || isContentCodeMatch;
        
        if (isMatch && blockEndTime) {
          const endTime = new Date(blockEndTime);
          if (!latestEndTime || endTime > new Date(latestEndTime)) {
            latestEndTime = blockEndTime;
          }
        }
      });
    } catch (error) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}目录${dir}中无${resourceName}记录，跳过检查`);
    }
  });

  return latestEndTime;
}

/**
 * 公共函数：读取路径历史记录（支持缓存复用，避免重复读文件）
 * @param {string} resourceKey - 记录键（怪物名/材料名）
 * @param {string} pathName - 路径名
 * @param {string} recordDir - 主记录目录
 * @param {string} noRecordDir - 备用记录目录
 * @param {boolean} isFood - 是否为狗粮路径
 * @param {Object} cache - 缓存对象（单次路径处理周期内有效）
 * @returns {Array<Object>} 结构化记录列表（含runTime、quantityChange）
 */
function getHistoricalPathRecords(resourceKey, pathName, recordDir, noRecordDir, isFood = false, cache = {}, pathingFilePath) {
  // 生成内容检测码
  const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : null;
  
  // 清理路径名中的检测码
  const cleanPathName = pathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
  
  // 1. 生成唯一缓存键（确保不同路径/不同文件的记录不混淆）
  const isFoodSuffix = isFood ? CONSTANTS.FOOD_EXP_RECORD_SUFFIX : ".txt";
  const recordFile = `${recordDir}/${resourceKey}${isFoodSuffix}`;
  const cacheKey = `${recordFile}|${cleanPathName}|${contentCode || "00000000"}`; // 键格式：文件路径|清理后的路径名|内容检测码

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
    content = safeReadTextSync(targetFile);
  } catch (mainErr) {
    targetFile = `${noRecordDir}/${resourceKey}${isFoodSuffix}`;
    try {
      content = safeReadTextSync(targetFile);
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}从备用目录读取记录：${targetFile}`);
    } catch (backupErr) {
      log.debug(`${CONSTANTS.LOG_MODULES.RECORD}无${resourceKey}的历史记录：${targetFile}`);
      // 空记录也写入缓存，避免下次重复尝试读文件
      cache[cacheKey] = records;
      return records;
    }
  }

  // 解析记录（核心修改：遍历找关键字，而非硬编码行数）
  const lines = content.split('\n');
  // 先按空行分割成独立的记录块，避免跨记录解析
  const recordBlocks = content.split('\n\n').filter(block => block.includes('路径名: '));
  
  recordBlocks.forEach(block => {
    const blockLines = block.split('\n').map(line => line.trim()).filter(line => line);
    let runTime = 0;
    let quantityChange = {};
    let isTargetPath = false;
    let recordContentCode = "00000000";

    // 遍历当前记录块的每一行，找关键字
    blockLines.forEach(line => {
      // 1. 判断是否是目标路径
      if (line.startsWith('路径名: ')) {
        const recordPathName = line.split('路径名: ')[1];
        // 清理记录中的路径名检测码
        const cleanRecordPathName = recordPathName.replace(/_[0-9a-fA-F]{8}\.json$/, '.json');
        if (cleanRecordPathName === cleanPathName) {
          isTargetPath = true;
        }
      }
      // 2. 提取内容检测码
      if (line.startsWith('内容检测码: ')) {
        recordContentCode = line.split('内容检测码: ')[1] || "00000000";
      }
      // 3. 提取运行时间
      if (line.startsWith('运行时间: ')) {
        runTime = parseInt(line.split('运行时间: ')[1].split('秒')[0], 10) || 0;
      }
      // 4. 提取EXP（狗粮）或数量变化（普通材料）
      if (line.startsWith('本次EXP获取: ')) {
        const exp = parseInt(line.split('本次EXP获取: ')[1], 10) || 0;
        quantityChange = { exp: exp };
      } else if (line.startsWith('数量变化: ')) {
        try {
          quantityChange = JSON.parse(line.split('数量变化: ')[1]) || {};
        } catch (e) {
          log.warn(`${CONSTANTS.LOG_MODULES.RECORD}解析数量变化失败：${line}`);
        }
      }
    });

    // 匹配条件：路径名相同 或者 内容检测码相同（新逻辑）
    const isContentCodeMatch = contentCode && recordContentCode === contentCode;
    const shouldInclude = (isTargetPath || isContentCodeMatch) && runTime > 0;
    
    if (shouldInclude) {
      records.push({ runTime, quantityChange, contentCode: recordContentCode });
    }
  });

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
    cache,
    pathingFilePath
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
function calculatePerTime(resourceName, pathName, recordDir, noRecordDir, isFood = false, cache = {}, pathingFilePath) {
  const isMonster = monsterToMaterials.hasOwnProperty(resourceName);
  // 调用公共函数获取记录（复用缓存）
  const historicalRecords = getHistoricalPathRecords(
    resourceName, 
    pathName, 
    recordDir, 
    noRecordDir, 
    isFood, 
    cache,
    pathingFilePath
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
  } else if (isFood) {
    // 狗粮路径：按EXP计算时间成本
    historicalRecords.forEach(record => {
      const { runTime, quantityChange } = record;
      const expValue = quantityChange.exp || 0;
      if (expValue > 0) {
        // 计算：秒/单位EXP
        completeRecords.push(parseFloat((runTime / expValue).toFixed(2)));
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

  // 异常值过滤与平均值计算
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
        
        // 计算上次运行后最近的刷新时间
        const lastRefreshAfterRun = new Date(lastEndTimeDate);
        lastRefreshAfterRun.setHours(specificHour, 0, 0, 0);
        if (lastRefreshAfterRun <= lastEndTimeDate) {
          lastRefreshAfterRun.setDate(lastRefreshAfterRun.getDate() + 1);
        }
        
        // 如果当前时间已经过了最近的刷新时间，允许运行
        if (currentDate >= lastRefreshAfterRun) {
          log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，最近刷新时间：${lastRefreshAfterRun.toLocaleString()}，允许运行`);
          return true;
        }
        
        // 计算下次刷新时间
        const todayRefresh = new Date(currentDate);
        todayRefresh.setHours(specificHour, 0, 0, 0);
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
    // log.debug(`${CONSTANTS.LOG_MODULES.MATERIAL}资源${resourceName}未匹配到分类`);
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

// 筛选低数量材料 + 平行标记超量材料（同源allMaterials）
function filterLowCountMaterials(pathingMaterialCounts, materialCategoryMap) {
  // 超量阈值（普通材料/矿石处理后统一对比）
  const EXCESS_THRESHOLD = exceedCount;
  // 临时存储超量材料（从原始数据提取，平行于低数量筛选）
  const tempExcess = [];

  // 提取所有需要扫描的材料（超量+低数量共用同一源）
  const allMaterials = Object.values(materialCategoryMap).flat();
  if (debugLog) log.info(`【材料基准】本次需扫描的全量材料：${allMaterials.join("、")}`);

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
      // 矿石数量处理（和超量判断的处理逻辑一致）
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
  if (debugLog) log.info(`【低数量材料】筛选后共${filteredLowCountMaterials.length}种：${filteredLowCountMaterials.map(m => m.name).join("、")}`);

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
 * 处理狗粮路径条目（完整校验：CD+时间成本+频率+运行时间+距离）
 * @param {Object} entry - 路径条目 { path, resourceName }
 * @param {Object} accumulators - 累加器 { foodExpAccumulator, currentMaterialName }
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 无记录目录
 * @param {Object} CDCategories - CD分类配置
 * @param {number} timeCost - 时间成本阈值
 * @param {Object} pathRecordCache - 记录缓存
 * @returns {Object} 更新后的累加器
 */
async function processFoodPathEntry(entry, accumulators, recordDir, noRecordDir, CDCategories, timeCost, pathRecordCache) {
  const { path: pathingFilePath, resourceName } = entry;
  const pathName = basename(pathingFilePath);
  const { foodExpAccumulator, currentMaterialName: prevMaterialName } = accumulators;

  let startTime = null;
  let initialPosition = null;
  let finalPosition = null;
  let runTime = 0;
  let finalCumulativeDistance = 0;

  try {
    // ========== 1. CD 冷却校验 ==========
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
      log.debug(`${CONSTANTS.LOG_MODULES.CD}狗粮材料【${resourceName}】未找到CD配置，跳过路径：${pathName}`);
      await sleep(1);
      return accumulators;
    }

    // ========== 2. 路径0记录频率校验 ==========
    const isPathValid = checkPathNameFrequency(resourceName, pathName, recordDir, true);
    if (!isPathValid) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}狗粮路径${pathName} 0记录频率超限，跳过`);
      await sleep(1);
      return accumulators;
    }

    // ========== 3. 时间成本校验 ==========
    const currentTime = getCurrentTimeInHours();
    const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath);
    const perTime = noRecord ? null : calculatePerTime(
      resourceName, 
      pathName, 
      recordDir, 
      noRecordDir, 
      true,
      pathRecordCache,
      pathingFilePath
    );

    log.info(`${CONSTANTS.LOG_MODULES.PATH}狗粮路径${pathName} 单位EXP耗时：${perTime ?? '忽略'}秒/EXP`);
    
    const estimatedTime = estimatePathTotalTime({ path: pathingFilePath, resourceName }, recordDir, noRecordDir);
    log.info(`${CONSTANTS.LOG_MODULES.PATH}狗粮路径${pathName} 预计耗时：${estimatedTime}秒`);

    const canRun = canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName) 
      && isPathValid 
      && (noRecord || perTime === null || perTime <= timeCost);

    if (!canRun) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}狗粮路径${pathName} 不符合运行条件`);
      await sleep(1);
      return accumulators;
    }

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

    startTime = new Date().toLocaleString();
    initialPosition = genshin.getPositionFromMap();
    await runPathAndNotify(pathingFilePath, currentMaterialName);
    finalPosition = genshin.getPositionFromMap();
    finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
    const endTime = new Date().toLocaleString();
    runTime = (new Date(endTime) - new Date(startTime)) / 1000;

    const { success, totalExp } = await executeSalvageWithOCR();
    foodExpAccumulator[resourceName] += totalExp;

    const recordDirFinal = noRecord ? noRecordDir : recordDir;
    const foodRecordContent = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n移动距离: ${finalCumulativeDistance.toFixed(2)}\n分解状态: ${success ? "成功" : "失败"}\n本次EXP获取: ${totalExp}\n累计EXP获取: ${foodExpAccumulator[resourceName]}\n\n`;

    const canRecord = runTime > 5 && finalCumulativeDistance > 5;
    if (canRecord) {
      if (totalExp === 0) {
        const zeroExpFilePath = `${recordDirFinal}/${resourceName}${CONSTANTS.FOOD_ZERO_EXP_SUFFIX}`;
        writeContentToFile(zeroExpFilePath, foodRecordContent);
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}狗粮路径${pathName} EXP=0，写入0记录文件：${zeroExpFilePath}`);
      } else {
        const normalExpFilePath = `${recordDirFinal}/${resourceName}${CONSTANTS.FOOD_EXP_RECORD_SUFFIX}`;
        writeContentToFile(normalExpFilePath, foodRecordContent);
        const foodMsg = `狗粮路径【${pathName}】执行完成\n耗时：${runTime.toFixed(1)}秒\n本次EXP：${totalExp}\n累计EXP：${foodExpAccumulator[resourceName]}`;
        sendNotificationInChunks(foodMsg, notification.Send);
      }
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.RECORD}狗粮路径${pathName} 不满足记录条件：运行时间${runTime.toFixed(1)}秒（需>5秒）| 移动距离${finalCumulativeDistance.toFixed(2)}（需>5）`);
    }

    await sleep(1);
    return { ...accumulators, foodExpAccumulator, currentMaterialName };
  } catch (error) {
    if (startTime && initialPosition) {
      finalPosition = genshin.getPositionFromMap();
      finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;
      
      const canRecord = runTime > 5 && finalCumulativeDistance > 5;
      if (canRecord) {
        const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
        const noRecordContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${error.message}\n\n`;
        writeContentToFile(`${CONSTANTS.NO_RECORD_DIR}/${resourceName}.txt`, noRecordContent);
        log.info(`${CONSTANTS.LOG_MODULES.RECORD}已将错误路径记录为noRecord模式：${pathName}（实际执行：${runTime.toFixed(1)}秒，${finalCumulativeDistance.toFixed(2)}米）`);
      } else {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}执行异常但不满足记录条件（运行时间${runTime.toFixed(1)}秒，移动距离${finalCumulativeDistance.toFixed(2)}米），跳过noRecord记录`);
      }
    }
    throw error;
  }
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
    pathRecordCache
  } = context;

  let startTime = null;
  let initialPosition = null;
  let finalPosition = null;
  let runTime = 0;
  let finalCumulativeDistance = 0;

  try {
    const monsterMaterials = monsterToMaterials[monsterName] || [];
    const allExcess = monsterMaterials.every(mat => excessMaterialNames.includes(mat));
    if (allExcess) {
      log.warn(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${monsterName}】所有材料已超量，跳过路径：${pathName}`);
      await sleep(1);
      return context;
    }

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

    const currentTime = getCurrentTimeInHours();
    const lastEndTime = getLastRunEndTime(monsterName, pathName, recordDir, noRecordDir, pathingFilePath);
    const isPathValid = checkPathNameFrequency(monsterName, pathName, recordDir);
    const perTime = noRecord ? null : calculatePerTime(
      monsterName, 
      pathName, 
      recordDir, 
      noRecordDir, 
      false,
      pathRecordCache,
      pathingFilePath
    );

    log.info(`${CONSTANTS.LOG_MODULES.PATH}怪物路径${pathName} 单个材料耗时：${perTime ?? '忽略'}`);
    
    const estimatedTime = estimatePathTotalTime({ path: pathingFilePath, monsterName }, recordDir, noRecordDir);
    log.info(`${CONSTANTS.LOG_MODULES.PATH}怪物路径${pathName} 预计耗时：${estimatedTime}秒`);

    if (!(canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName) && isPathValid && (noRecord || perTime === null || perTime <= timeCost))) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}怪物路径${pathName} 不符合运行条件`);
      await sleep(1);
      return context;
    }

    const resourceCategoryMap = {};
    const materials = monsterToMaterials[monsterName] || [];

    ocrContext.currentPathType = 'monster';
    ocrContext.currentTargetMaterials = materials;

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

    let currentMaterialName = prevMaterialName;
    let updatedFlattened = flattenedLowCountMaterials;

    if (noRecord) {
      if (currentMaterialName !== monsterName) {
        currentMaterialName = monsterName;
        materialAccumulatedDifferences[monsterName] = {};
        log.info(`${CONSTANTS.LOG_MODULES.PATH}noRecord模式：切换目标至怪物【${monsterName}】`);
      }

      startTime = new Date().toLocaleString();
      initialPosition = genshin.getPositionFromMap();
      await runPathAndNotify(pathingFilePath, currentMaterialName);
      finalPosition = genshin.getPositionFromMap();
      finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;

      const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
      const noRecordContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: noRecord模式忽略\n\n`;
      writeContentToFile(`${noRecordDir}/${monsterName}.txt`, noRecordContent);
    } else {
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

      startTime = new Date().toLocaleString();
      initialPosition = genshin.getPositionFromMap();
      await runPathAndNotify(pathingFilePath, currentMaterialName);
      finalPosition = genshin.getPositionFromMap();
      finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;

      const updatedLowCountMaterials = await MaterialPath(resourceCategoryMap);
      const flattenedUpdated = updatedLowCountMaterials.flat().sort((a, b) => a.count - b.count);

      const materialCountDifferences = {};
      flattenedUpdated.forEach(updated => {
        const original = updatedFlattened.find(m => m.name === updated.name);
        if (original) {
          const diff = parseInt(updated.count) - parseInt(original.count);
          if (diff !== 0 || materials.includes(updated.name)) {
            materialCountDifferences[updated.name] = diff;
            globalAccumulatedDifferences[updated.name] = (globalAccumulatedDifferences[updated.name] || 0) + diff;
            materialAccumulatedDifferences[monsterName][updated.name] = (materialAccumulatedDifferences[monsterName][updated.name] || 0) + diff;
          }
        }
      });

      updatedFlattened = updatedFlattened.map(m => {
        const updated = flattenedUpdated.find(u => u.name === m.name);
        return updated ? { ...m, count: updated.count } : m;
      });

      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}怪物路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
      // 新增：更新缓存
      if (ColdStartCache.snapshot) {
        ColdStartCache.updateAfterPath(materialCountDifferences);
      }
      // 检查怪物对应的材料是否有超量，如果有，记录到noRecord目录
      let isExcess = false;
      const monsterMaterials = monsterToMaterials[monsterName] || [];
      for (const material of monsterMaterials) {
        if (excessMaterialNames.includes(material)) {
          isExcess = true;
          break;
        }
      }
      const targetRecordDir = isExcess ? noRecordDir : recordDir;
      recordRunTime(monsterName, pathName, startTime, endTime, runTime, targetRecordDir, materialCountDifferences, finalCumulativeDistance, pathingFilePath);
    }

    await sleep(1);
    return {
      ...context,
      currentMaterialName,
      flattenedLowCountMaterials: updatedFlattened,
      materialAccumulatedDifferences,
      globalAccumulatedDifferences
    };
  } catch (error) {
    if (startTime && initialPosition) {
      finalPosition = genshin.getPositionFromMap();
      finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;
      
      const canRecord = runTime > 5 && finalCumulativeDistance > 5;
      if (canRecord) {
        const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
        const noRecordContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${error.message}\n\n`;
        writeContentToFile(`${CONSTANTS.NO_RECORD_DIR}/${monsterName}.txt`, noRecordContent);
        log.info(`${CONSTANTS.LOG_MODULES.RECORD}已将错误路径记录为noRecord模式：${pathName}（实际执行：${runTime.toFixed(1)}秒，${finalCumulativeDistance.toFixed(2)}米）`);
      } else {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}执行异常但不满足记录条件（运行时间${runTime.toFixed(1)}秒，移动距离${finalCumulativeDistance.toFixed(2)}米），跳过noRecord记录`);
      }
    }
    throw error;
  }
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
    pathRecordCache
  } = context;

  let startTime = null;
  let initialPosition = null;
  let finalPosition = null;
  let runTime = 0;
  let finalCumulativeDistance = 0;

  try {
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

    const currentTime = getCurrentTimeInHours();
    const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, pathingFilePath);
    const isPathValid = checkPathNameFrequency(resourceName, pathName, recordDir);
    const perTime = noRecord ? null : calculatePerTime(
      resourceName, 
      pathName, 
      recordDir, 
      noRecordDir, 
      false,
      pathRecordCache,
      pathingFilePath
    );

    log.info(`${CONSTANTS.LOG_MODULES.PATH}材料路径${pathName} 单个材料耗时：${perTime ?? '忽略'}`);
    
    const estimatedTime = estimatePathTotalTime({ path: pathingFilePath, resourceName }, recordDir, noRecordDir);
    log.info(`${CONSTANTS.LOG_MODULES.PATH}材料路径${pathName} 预计耗时：${estimatedTime}秒`);

    if (!(canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName) && isPathValid && (noRecord || perTime === null || perTime <= timeCost))) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}材料路径${pathName} 不符合运行条件`);
      await sleep(1);
      return context;
    }

    const resourceCategoryMap = {};
    for (const [cat, list] of Object.entries(materialCategoryMap)) {
      if (list.includes(resourceName)) {
        resourceCategoryMap[cat] = [resourceName];
        break;
      }
    }

    let currentMaterialName = prevMaterialName;
    let updatedFlattened = flattenedLowCountMaterials;

    if (noRecord) {
      if (currentMaterialName !== resourceName) {
        currentMaterialName = resourceName;
        materialAccumulatedDifferences[resourceName] = {};
        log.info(`${CONSTANTS.LOG_MODULES.PATH}noRecord模式：切换目标至材料【${resourceName}】`);
      }

      startTime = new Date().toLocaleString();
      initialPosition = genshin.getPositionFromMap();
      await runPathAndNotify(pathingFilePath, currentMaterialName);
      finalPosition = genshin.getPositionFromMap();
      finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;

      const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
      const noRecordContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: noRecord模式忽略\n\n`;
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

      startTime = new Date().toLocaleString();
      initialPosition = genshin.getPositionFromMap();
      await runPathAndNotify(pathingFilePath, currentMaterialName);
      finalPosition = genshin.getPositionFromMap();
      finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;

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

      updatedFlattened = updatedFlattened.map(m => {
        const updated = flattenedUpdated.find(u => u.name === m.name);
        return updated ? { ...m, count: updated.count } : m;
      });

      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}材料路径${pathName}数量变化: ${JSON.stringify(materialCountDifferences)}`);
      // 新增：更新缓存
      if (ColdStartCache.snapshot) {
        ColdStartCache.updateAfterPath(materialCountDifferences);
      }
      // 检查材料是否在超量名单中，如果是，记录到noRecord目录
      let isExcess = false;
      // 检查当前材料是否超量
      if (excessMaterialNames.includes(resourceName)) {
        isExcess = true;
      } else if (monsterToMaterials.hasOwnProperty(resourceName)) {
        // 对于怪物路径，检查其对应的材料是否有超量
        const monsterMaterials = monsterToMaterials[resourceName];
        for (const material of monsterMaterials) {
          if (excessMaterialNames.includes(material)) {
            isExcess = true;
            break;
          }
        }
      }
      const targetRecordDir = isExcess ? noRecordDir : recordDir;
      recordRunTime(resourceName, pathName, startTime, endTime, runTime, targetRecordDir, materialCountDifferences, finalCumulativeDistance, pathingFilePath);
    }

    await sleep(1);
    return {
      ...context,
      currentMaterialName,
      flattenedLowCountMaterials: updatedFlattened,
      materialAccumulatedDifferences,
      globalAccumulatedDifferences
    };
  } catch (error) {
    if (startTime && initialPosition) {
      finalPosition = genshin.getPositionFromMap();
      finalCumulativeDistance = calculateDistance(initialPosition, finalPosition);
      const endTime = new Date().toLocaleString();
      runTime = (new Date(endTime) - new Date(startTime)) / 1000;
      
      const canRecord = runTime > 5 && finalCumulativeDistance > 5;
      if (canRecord) {
        const contentCode = pathingFilePath ? generatePathContentCode(pathingFilePath) : "00000000";
        const noRecordContent = `路径名: ${pathName}\n内容检测码: ${contentCode}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n数量变化: ${error.message}\n\n`;
        writeContentToFile(`${CONSTANTS.NO_RECORD_DIR}/${resourceName}.txt`, noRecordContent);
        log.info(`${CONSTANTS.LOG_MODULES.RECORD}已将错误路径记录为noRecord模式：${pathName}（实际执行：${runTime.toFixed(1)}秒，${finalCumulativeDistance.toFixed(2)}米）`);
      } else {
        log.warn(`${CONSTANTS.LOG_MODULES.RECORD}路径${pathName}执行异常但不满足记录条件（运行时间${runTime.toFixed(1)}秒，移动距离${finalCumulativeDistance.toFixed(2)}米），跳过noRecord记录`);
      }
    }
    throw error;
  }
}

/**
 * 批量处理所有路径（核心修改：时间预判+缓存传递）
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
    // 单路径处理周期内的记录缓存
    const pathRecordCache = {}; 
    let context = {
      CDCategories, timeCost, recordDir, noRecordDir, imagesDir,
      materialCategoryMap, flattenedLowCountMaterials,
      currentMaterialName, materialAccumulatedDifferences,
      globalAccumulatedDifferences,
      pathRecordCache
    };

    for (const entry of allPaths) {
      // 优先响应手动终止指令
      if (state.cancelRequested) {
        log.warn(`${CONSTANTS.LOG_MODULES.PATH}检测到手动终止指令，停止路径处理`);
        break;
      }

      // 定时终止判断
      let skipPath = false;
      if (endTimeStr) {
        const isValidEndTime = /^\d{1,2}[:：]\d{1,2}$/.test(endTimeStr);
        if (isValidEndTime) {
          const remainingMinutes = getRemainingMinutesToEndTime(endTimeStr);
          if (remainingMinutes <= 0) {
            log.warn(`${CONSTANTS.LOG_MODULES.MAIN}已过指定终止时间（${endTimeStr}），停止路径处理`);
            state.cancelRequested = true;
            ColdStartCache.setTaskCancelled(true);  // 新增：记录任务被取消
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
      }

      if (skipPath) break;

      const { path: pathingFilePath, resourceName, monsterName } = entry;
      log.info(`${CONSTANTS.LOG_MODULES.PATH}开始处理路径：${basename(pathingFilePath)}`);

      try {
        if (resourceName && isFoodResource(resourceName)) {
          // 狗粮路径：传递完整校验参数
          const result = await processFoodPathEntry(
            entry, 
            {
              foodExpAccumulator,
              currentMaterialName: context.currentMaterialName
            }, 
            recordDir, 
            noRecordDir, 
            CDCategories, 
            timeCost, 
            context.pathRecordCache
          );
          foodExpAccumulator = result.foodExpAccumulator;
          context.currentMaterialName = result.currentMaterialName;
        } else if (monsterName) {
          // 怪物路径
          context = await processMonsterPathEntry(entry, context);
        } else if (resourceName) {
          // 普通材料路径
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

    // 最后一个目标收尾通知
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
  const pathingFilePaths = readAllFilePaths(pathingDir, 0, 3, ['.json']);
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

  if (normalPaths.length > 0 || monsterPaths.length > 0) {
    // 优化：一次扫描获取全量材料数量，同时服务于怪物和普通材料
    // 优化：使用缓存获取材料数量
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] 获取背包数据...`);
    const allMaterialCounts = await ColdStartCache.getInitialSnapshot(materialCategoryMap);
    pathingMaterialCounts = allMaterialCounts;

    // 筛选低数量材料（同时生成超量名单）
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 基于全量扫描结果筛选有效材料`);
    const filteredMaterials = filterLowCountMaterials(allMaterialCounts.flat(), materialCategoryMap);
    const validMonsterMaterialNames = filteredMaterials.map(m => m.name);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 筛选后有效材料：${validMonsterMaterialNames.join('、')}`);

    // 普通材料筛选
    if (pathingMode.onlyCategory) {
      return { allPaths: [], pathingMaterialCounts };
    }
    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 基于全量扫描结果筛选低数量材料`);
    const lowCountMaterialsFiltered = filteredMaterials;
    const flattenedLowCountMaterials = lowCountMaterialsFiltered.flat().sort((a, b) => a.count - b.count);
    const lowCountMaterialNames = flattenedLowCountMaterials.map(material => material.name);

    processedNormalPaths = classifyNormalPathFiles(pathingDir, targetResourceNames, lowCountMaterialNames, cdMaterialNames)
      .filter(entry => normalPaths.some(n => n.path.replace(/\\/g, '/') === entry.path.replace(/\\/g, '/')));
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 筛选后保留路径 ${processedNormalPaths.length} 条`);
  }

  // 路径优先级规则数组
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
    // 5. 剩余怪物（掉落材料未超量且低数量）
    { 
      source: processedMonsterPaths, 
      filter: e => {
        const materials = monsterToMaterials[e.monsterName] || [];
        return !materials.some(mat => targetResourceNames.includes(mat)) && 
               materials.some(mat => !excessMaterialNames.includes(mat));
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

  // log.info(`${CONSTANTS.LOG_MODULES.PATH}[最终路径] 共${allPaths.length}条：${allPaths.map(p => basename(p.path))}`);
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
  const texttolerance = 2;

  // 目标资源处理
  const targetResourceNamesStr = settings.TargetresourceName || "";
  const targetResourceNames = targetResourceNamesStr
    .split(/[,，、 \s]+/)
    .map(name => name.trim())
    .filter(name => name !== "");

  const targetTextCategories = readtargetTextCategories(CONSTANTS.TARGET_TEXT_DIR);

  // 并行任务：OCR交互（修正版）
  const ocrTask = (async () => {
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
      let filtered = allTargetTexts.filter(name => !excessMaterialNames.includes(name));
      
      if (ocrContext.currentPathType === 'monster') {
        // 怪物路径执行时的过滤逻辑：
        // 1. 对于怪物材料，只保留：
        //    - 当前怪物的材料
        //    - pathing文件夹中存在且未超量的其他怪物材料
        // 2. 非怪物材料保持不变
        
        filtered = filtered.filter(name => {
          // 如果不是怪物材料，保留
          if (!materialToMonsters[name]) return true;
          
          // 如果是怪物材料，检查是否在允许的列表中
          const currentMonsterMaterials = ocrContext.currentTargetMaterials || [];
          const pathingMonsterMaterials = Array.from(ocrContext.pathingMonsterMaterials || new Set());
          
          // 保留当前怪物的材料或pathing中的怪物材料
          return currentMonsterMaterials.includes(name) || pathingMonsterMaterials.includes(name);
        });
        
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
      }
      
      return filtered;
    };

    log.info(`超量名单：${excessMaterialNames.join('、')}`);
    if (debugLog) log.info(`OCR最终目标文本（已过滤超量）：${getFilteredTargetTexts().join('、')}`);

    await alignAndInteractTarget(getFilteredTargetTexts, fDialogueRo, textxRange, texttolerance);
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
      log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}onlyPathing模式：将自动扫描pathing材料的实际分类`);
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}未选择【材料分类】，采用【路径材料】专注模式`);
    }
  }
  
  // 2. 处理路径相关材料（仅includeBoth和onlyPathing模式）
  if ((pathingMode.includeBoth || pathingMode.onlyPathing) && (Object.keys(materialCategoryMap).length > 0 || pathingMode.onlyPathing)) {
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
    if (pathingMode.onlyCategory) {
      log.info(`${CONSTANTS.LOG_MODULES.MAIN}[onlyCategory模式] 扫描完成，直接结束`);
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
