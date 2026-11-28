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
eval(safeReadTextSync("lib/backStats.js"));
eval(safeReadTextSync("lib/colorDetection.js"));
eval(safeReadTextSync("lib/imageClick.js"));
eval(safeReadTextSync("lib/region.js"));

const MONSTER_GRADE_RATIOS = [3, 1, 1/3];

// ==============================================
// 引入拆分后的模块
// ==============================================
eval(safeReadTextSync("lib/recordManager.js"));
eval(safeReadTextSync("lib/timeCostSystem.js"));
eval(safeReadTextSync("lib/cacheManager.js"));
eval(safeReadTextSync("lib/pathProcessor.js"));
eval(safeReadTextSync("lib/alchemyBalance.js"));

// ==============================================
// 全局状态（保持不变）
// ==============================================
var state = {
  completed: false, cancelRequested: false, ocrPaused: false
};

// ==============================================
// 全局图片缓存（避免重复加载）
// ==============================================
const ocrContext = { currentPathType: null, currentTargetMaterials: [], pathingMonsterMaterials: new Set() };

// ==============================================
// 初始化配置参数
// ==============================================
let timeCostMin, timeCostMax;
const timeCostStr = String(settings.TimeCost || "50").trim();

if (timeCostStr.includes('~')) {
  const parts = timeCostStr.split('~').map(s => s.trim());
  
  if (parts.length === 2) {
    const leftValue = parts[0] === '' ? 0 : parseFloat(parts[0]);
    const rightValue = parts[1] === '' ? 101 : parseFloat(parts[1]);
    
    if (!isNaN(leftValue) && !isNaN(rightValue)) {
      timeCostMin = Math.min(101, Math.max(0, Math.floor(leftValue)));
      timeCostMax = Math.min(101, Math.max(0, Math.floor(rightValue)));
      
      if (timeCostMin > timeCostMax) {
        [timeCostMin, timeCostMax] = [timeCostMax, timeCostMin];
      }
    }
  }
}

if (timeCostMin === undefined || timeCostMax === undefined) {
  const singleValue = parseFloat(timeCostStr);
  if (!isNaN(singleValue)) {
    timeCostMin = 0;
    timeCostMax = Math.min(101, Math.max(0, Math.floor(singleValue)));
  } else {
    timeCostMin = 0;
    timeCostMax = 50;
  }
}

const timeCost = { min: timeCostMin, max: timeCostMax };
// 通知间隔（分钟）：空/无效为 null=不通知；填有效正数则按该间隔推送进度通知
const notifyStr = String(settings.notify ?? "").trim();
const notifyVal = parseFloat(notifyStr);
const notify = (notifyStr !== "" && isFinite(notifyVal) && notifyVal > 0) ? notifyVal : null;
const rollbackPathCount = Math.min(999, Math.max(0, Math.floor(Number(settings.RollbackPathCount) || 0)));
const noRecord = settings.noRecord || false;
// 独立标定模式（settings.FlipCalibTestMode 下拉框，单选，重启生效）：
// 【背包翻页拖动距离】= 开背包→养成页→迭代拖动标定“1页”距离→写 user/pageFlip.json，跑完即退
const testBagFlip = settings.FlipCalibTestMode === '背包翻页拖动距离';
const noMonsterFilter = !settings.noMonsterFilter;
const targetCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.TargetCount) || 1000))); // 设定的目标数量
const exceedCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.ExceedCount) || 3000))); // 设定的超量目标数量
const endTimeStr = settings.CurrentTime ? settings.CurrentTime : null;

// 执行时间上限（小时）：默认不启用；仅接受有效数字，最多4位小数（如 0.5=半小时）
const maxRunTimeStr = String(settings.MaxRunTime ?? "").trim();
let maxRunTimeSec = null; // 秒
if (maxRunTimeStr !== "" && /^\d+(\.\d{1,4})?$/.test(maxRunTimeStr)) {
  const runTimeValue = parseFloat(maxRunTimeStr);
  if (isFinite(runTimeValue) && runTimeValue > 0) {
    maxRunTimeSec = runTimeValue * 3600;
  }
} 

// ==============================================
// CD分类
// ==============================================
let allowedCDCategories = [];
try {
    allowedCDCategories = Array.from(settings.CDCategories || []);
} catch (e) {
    log.error(`${CONSTANTS.LOG_MODULES.INIT}获取CDCategories设置失败: ${e.message}`);
}

let availableCDCategories = [];
try {
    const cdFilePaths = GlobalCacheManager.getPathFiles(CONSTANTS.MATERIAL_CD_DIR, 0, 1, ['.txt']);
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
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.INIT}已配置只处理以下CD分类：${allowedCDCategories.join('、')}`);
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

// ==============================================
// 怪物-材料映射（双向，优化为Set提高查找效率）
// ==============================================
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

// ==============================================
// 优先级材料语法（+ / -）
//   X / +X      → 优先（默认 +1），跳过目标数直接运行
//   ++X / +++X  → 权重 2 / 3，+号越多越优先
//   -X          → 排除（不运行其路径）
//   怪物名      → 自动展开为该怪物的三个材料，规则对三个材料同步生效
//   其他符号    → 当分隔符直接忽略（如 ! * # @ ~ % & ? ; : = | / ）
// ==============================================
const targetMaterialRules = new Map(); // 材料名 → { weight, order }；weight>0 优先，weight===0 排除
const targetMonsterRules = new Map();  // 怪物名 → { weight, order }

/**
 * 解析优先级材料字符串为“符号 + 名称”条目
 * 支持 ++薄荷 / ++ 薄荷 / -丘丘王 / 名刀镡（无符号默认 +1）
 * @param {string} targetStr - settings.TargetresourceName 原始内容
 * @returns {Array<{name:string, weight:number, order:number, sign:string}>}
 */
function parseTargetResourceEntries(targetStr) {
  const entries = [];
  // 预处理：除 + − ＋ － 以外的常见运算符/引号/括号一律当分隔符，避免符号粘连导致条目失效或权重丢失
  // 例：++!薄荷 → ++ 薄荷；-@兽肉 → - 兽肉；骗骗花/野伏众 → 骗骗花 野伏众
  const input = String(targetStr || "")
    .replace(/[,，、。;；:：\/／|｜=＝!！*＊#＃@＠~～%＆&?？"'“”‘’()（）\[\]［］【】{}｛｝]+/g, " ");
  // 分隔后只剩“符号 + 名称”，+ − ＋ － 仅作为符号，不属于名称
  const tokenRe = /([+\-＋－]*)\s*([^,，、\s+\-＋－]+)/g;
  let order = 0;
  let match;
  while ((match = tokenRe.exec(input)) !== null) {
    const signStr = match[1] || "";
    const name = (match[2] || "").trim();
    if (!name) continue;
    const isExclude = /[-－]/.test(signStr);
    const plusCount = (signStr.match(/[+＋]/g) || []).length;
    entries.push({ name, weight: isExclude ? 0 : Math.max(plusCount, 1), order: order++, sign: signStr });
  }
  return entries;
}

/**
 * 写入单条规则：排除优先于优先；同为优先时取更大权重，权重相同取更早的配置顺序
 */
function applyTargetRule(map, key, weight, order) {
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { weight, order });
    return;
  }
  if (prev.weight === 0 || weight === 0) {
    map.set(key, { weight: 0, order: Math.min(prev.order, order) });
    return;
  }
  if (weight > prev.weight) {
    map.set(key, { weight, order });
  }
}

/**
 * 构建优先级/排除规则（怪物名展开为对应的三个材料）
 * @param {string} targetStr - settings.TargetresourceName 原始内容
 * @returns {{prioritized:string[], excludedMaterials:string[], excludedMonsters:string[]}}
 */
function buildTargetRules(targetStr) {
  targetMaterialRules.clear();
  targetMonsterRules.clear();

  const entries = parseTargetResourceEntries(targetStr);
  entries.forEach(({ name, weight, order, sign }) => {
    // 同时写了 + 和 -：按“- 优先”当作排除处理，并提示避免歧义
    if (/[+＋]/.test(sign) && /[-－]/.test(sign)) {
      log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}[优先级材料] "${sign}${name}" 同时含 + 和 -，已按排除处理（- 优先）；如需优先请去掉 -`);
    }
    const monsterMaterials = monsterToMaterials[name];
    if (monsterMaterials && monsterMaterials.length > 0) {
      // 怪物名：怪物自身与其三个材料同步同一条规则
      applyTargetRule(targetMonsterRules, name, weight, order);
      monsterMaterials.forEach(mat => applyTargetRule(targetMaterialRules, mat, weight, order));
    } else {
      applyTargetRule(targetMaterialRules, name, weight, order);
    }
  });

  // 优先材料名列表：权重降序 → 配置顺序升序
  const prioritized = Array.from(targetMaterialRules.entries())
    .filter(([, rule]) => rule.weight > 0)
    .sort((a, b) => (b[1].weight - a[1].weight) || (a[1].order - b[1].order))
    .map(([name]) => name);

  const excludedMaterials = Array.from(targetMaterialRules.entries())
    .filter(([, rule]) => rule.weight === 0)
    .map(([name]) => name);
  const excludedMonsters = Array.from(targetMonsterRules.entries())
    .filter(([, rule]) => rule.weight === 0)
    .map(([name]) => name);

  if (entries.length > 0) {
    log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}[优先级材料] 解析${entries.length}项：${entries.map(e => `${e.weight === 0 ? '-' : '+'.repeat(e.weight)}${e.name}`).join('，')}`);
    if (prioritized.length > 0) {
      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}[优先级材料] 优先顺序：${prioritized.map(n => `${'+'.repeat(targetMaterialRules.get(n).weight)}${n}`).join('、')}`);
    }
    if (excludedMaterials.length > 0) {
      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}[优先级材料] 排除材料：${excludedMaterials.join('、')}`);
    }
    if (excludedMonsters.length > 0) {
      log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}[优先级材料] 排除怪物：${excludedMonsters.join('、')}`);
    }
  }

  return { prioritized, excludedMaterials, excludedMonsters };
}

/** 材料是否被 - 排除 */
function isTargetMaterialExcluded(name) {
  const rule = targetMaterialRules.get(name);
  return !!rule && rule.weight === 0;
}

/** 怪物是否被 - 排除 */
function isTargetMonsterExcluded(name) {
  const rule = targetMonsterRules.get(name);
  return !!rule && rule.weight === 0;
}

/**
 * 判断路径条目是否被优先级材料的 - 规则排除
 * 怪物路径：怪物被排除，或该怪物三个材料全部被排除时排除
 * 普通路径：材料被排除时排除
 */
function isPathEntryExcluded(entry) {
  if (!entry) return false;
  if (entry.monsterName) {
    if (isTargetMonsterExcluded(entry.monsterName)) return true;
    const materials = monsterToMaterials[entry.monsterName] || [];
    return materials.length > 0 && materials.every(mat => isTargetMaterialExcluded(mat));
  }
  return !!entry.resourceName && isTargetMaterialExcluded(entry.resourceName);
}

// ==============================================
// 路径模式配置
// ==============================================
const pathingValue = Array.from(settings.Pathing || []);
const estimateMode = pathingValue.includes('【测算模式】');
const alchemyBalanceMode = pathingValue.includes('【合成台平衡】');
// 这里过滤掉不产生路径的开关项（测算/合成台平衡都是附带动作）
const pathingValueFiltered = pathingValue.filter(item => item !== '【测算模式】' && item !== '【合成台平衡】');
const hasCategory = pathingValueFiltered.includes('【扫描额外的分类】');
const hasPathing = pathingValueFiltered.includes('📁pathing材料');

const pathingMode = {
  hasCategory: hasCategory,
  hasPathing: hasPathing,
  onlyPathing: pathingValueFiltered.length === 1 && hasPathing,
  onlyCategory: pathingValueFiltered.length === 1 && hasCategory,
  estimateMode: estimateMode,
  alchemyBalance: alchemyBalanceMode
};

// 暴露给全局，供 processAllPaths 函数使用
globalThis.pathingMode = pathingMode;

if (pathingValueFiltered.length === 0 && !estimateMode) {
  log.warn(`${CONSTANTS.LOG_MODULES.PATH}未配置Pathing，默认为仅📁pathing材料`);
  pathingMode.onlyPathing = true;
  pathingMode.hasPathing = true;
}

if (pathingMode.onlyCategory) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【扫描额外的分类】，将自动更新超量名单并记录材料数量`);
if (pathingMode.onlyPathing) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【路径材料】模式，将执行材料路径并记录材料收益`);
if (pathingMode.estimateMode) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【测算模式】，将只测算不执行路径`);
if (pathingMode.alchemyBalance) log.warn(`${CONSTANTS.LOG_MODULES.PATH}已开启【合成台平衡】，扫描完背包将在璃月合成台把怪物三级材料自顶向上合成(3:1)`);
if (alchemyBalanceMode && !hasPathing && !hasCategory) {
  // 合成台平衡挂在首次背包扫描之后，只勾测算时根本不会扫背包，不提醒就会静默空转
  log.warn(`${CONSTANTS.LOG_MODULES.PATH}【合成台平衡】需要配合背包扫描才生效（请另勾📁pathing材料或【扫描额外的分类】），本次不会去合成台`);
}

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
// 图像匹配与分类
// ==============================================
// 材料别名映射
const MATERIAL_ALIAS = {
  '晶蝶': '晶核',
  '白铁矿': '白铁块',
  '铁矿': '铁块',
};

// ==============================================
// 图像映射缓存
// ==============================================
const imageMapCache = new Map(); // 保持固定，不动态刷新

// ==============================================
// 特殊材料与超量判断
// ==============================================
const specialMaterials = [
  "水晶块", "魔晶块", "星银矿石", "紫晶块", "萃凝晶", "虹滴晶", "铁块", "白铁块",
  "精锻用魔矿", "精锻用良矿", "精锻用杂矿"
];

let excessMaterialNames = []; // 超量材料名单

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

  // 确定材料名（取最浅层匹配）
  let materialName = null;
  if (validMaterials.length > 0) {
    validMaterials.sort((a, b) => a.depth - b.depth);
    materialName = validMaterials[0].name;
  }

  // 确定怪物名（取最浅层匹配）
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
  const materialFilePaths = GlobalCacheManager.getPathFiles(CONSTANTS.MATERIAL_CD_DIR, 0, 1, ['.txt']);
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
      // log.debug(`${CONSTANTS.LOG_MODULES.CD}跳过未选中的CD分类文件：${filePath}`);
      continue;
    }
    
    // 使用缓存获取CD配置
    const cdConfig = GlobalCacheManager.getCDConfig(sourceCategory);
    if (cdConfig) {
      materialCDCategories[sourceCategory] = cdConfig;
    } else {
      log.error(`${CONSTANTS.LOG_MODULES.CD}加载CD配置失败：${filePath}`);
    }
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
        const nextRunTime = new Date(lastEndTimeDate);
        nextRunTime.setHours(specificHour, 0, 0, 0);
        if (nextRunTime <= lastEndTimeDate) {
          nextRunTime.setDate(nextRunTime.getDate() + 1);
        }

        // log.info(`${CONSTANTS.LOG_MODULES.CD}路径${pathName}上次运行：${lastEndTimeDate.toLocaleString()}，下次运行：${nextRunTime.toLocaleString()}`);
        return currentDate >= nextRunTime;
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

// 筛选低数量材料 + 平行标记超量材料（同源allMaterials）
function filterLowCountMaterials(pathingMaterialCounts, materialCategoryMap, onlyCategoryMode = false) {
  // 超量阈值（普通材料/矿石处理后统一对比）
  const EXCESS_THRESHOLD = exceedCount;
  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MATERIAL}[超量判断] 超量阈值：${EXCESS_THRESHOLD}`);
  
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
      if (item.count === "?") return true;
      let numCount = Number(item.count);
      if (specialMaterials.includes(item.name)) {
        numCount = Math.floor(numCount / 10);
      }
      return numCount < targetCount;
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

/**
 * 筛选回滚路径组（按上次运行时间排序，优先选择最久没跑的路径）
 * @param {Object[]} allPaths - 所有路径条目
 * @param {string} recordDir - 记录目录
 * @param {string} noRecordDir - 备用目录
 * @param {number} count - 需要筛选的回滚路径数量
 * @returns {Object[]} 回滚路径数组
 */
function selectRollbackPaths(allPaths, recordDir, noRecordDir, count = 5, cache = {}) {
  const rollbackCandidates = [];
  
  allPaths.forEach(entry => {
    const pathName = basename(entry.path);
    const resourceName = entry.resourceName || entry.monsterName;
    
    const pathCheckResult = checkPathNameFrequency(resourceName, pathName, recordDir, false, entry.path, cache);
    
    if (pathCheckResult === true || pathCheckResult.valid) {
      const lastRunTime = getPathLastRunTime(entry, recordDir, noRecordDir, cache);
      
      if (lastRunTime) {
        const daysSinceLastRun = (new Date() - lastRunTime) / (1000 * 60 * 60 * 24);
        rollbackCandidates.push({
          entry,
          lastRunTime,
          daysSinceLastRun
        });
      }
    }
  });
  
  if (rollbackCandidates.length === 0) {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[滞后路径] 无符合条件的路径（所有路径均无历史记录或0记录超限）`);
    return [];
  }
  
  rollbackCandidates.sort((a, b) => a.lastRunTime - b.lastRunTime);
  
  const selectedRollbackPaths = rollbackCandidates.slice(0, count).map(item => ({
    ...item.entry,
    isRollback: true
  }));
  
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[滞后路径] 已选择${selectedRollbackPaths.length}条最久未运行的路径：`);
  selectedRollbackPaths.forEach((entry, idx) => {
    const daysAgo = rollbackCandidates[idx].daysSinceLastRun.toFixed(1);
    const lastRunDate = rollbackCandidates[idx].lastRunTime.toLocaleString();
    log.info(`  ${idx + 1}. ${basename(entry.path)} - 上次运行：${lastRunDate}（${daysAgo}天前）`);
  });
  
  return selectedRollbackPaths;
}

/**
 * 重生组：从“0记录超限(≥3条0)被排除”的路径里，挑 CD 就绪且最久未运行的 1 条，给它一次翻身机会
 * 触发条件（rollbackPathCount>2）由调用方控制；每轮最多选 1 条。
 * CD 未到者自动顺延下一条（不选它）。
 * @param {Object[]} pool - 候选池（须含被排除者）：通用模式传 sortedPaths
 * @param {Object} CDCategories - CD分类（缺失则不重生）
 * @returns {Object[]} 长度0或1的数组，元素为候选池中的原对象引用（由调用方就地打 isRespawn 或克隆后注入）
 */
function selectRespawnPath(pool, recordDir, noRecordDir, CDCategories, cache = {}) {
  if (!Array.isArray(pool) || !CDCategories) return [];
  const currentTime = getCurrentTimeInHours();
  const candidates = [];
  pool.forEach(entry => {
    const pathName = basename(entry.path);
    const resourceName = entry.resourceName || entry.monsterName;
    if (!resourceName) return;
    const pathCheckResult = checkPathNameFrequency(resourceName, pathName, recordDir, false, entry.path, cache);
    if (pathCheckResult === true || pathCheckResult.valid) return; // 未超限者不是重生候选
    const refreshCD = findRefreshCD(resourceName, CDCategories);
    if (!refreshCD) return;
    const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir, noRecordDir, entry.path, cache);
    if (!canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName)) return; // CD未到→顺延下一条
    const lastRunTime = getPathLastRunTime(entry, recordDir, noRecordDir, cache);
    candidates.push({ entry, lastRunTime: lastRunTime || new Date(0) });
  });
  if (candidates.length === 0) {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[重生组] 无“已超限且CD就绪”的路径，本轮不重生`);
    return [];
  }
  candidates.sort((a, b) => a.lastRunTime - b.lastRunTime);
  const chosen = candidates[0].entry;
  const lastRunStr = (candidates[0].lastRunTime instanceof Date && candidates[0].lastRunTime.getTime()) ? candidates[0].lastRunTime.toLocaleString() : '无记录';
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[重生组] 已选最久未运行的超限路径1条：${basename(chosen.path)}（上次运行：${lastRunStr}）`);
  return [chosen];
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
  const pathingFilePaths = GlobalCacheManager.getPathFiles(pathingDir, 0, CONSTANTS.MAX_PATH_DEPTH, ['.json']);
  const pathEntries = pathingFilePaths.map(path => {
    const { materialName, monsterName } = extractResourceNameFromPath(path, cdMaterialNames);
    return { path, resourceName: materialName, monsterName };
  }).filter(entry => {
    // 优先级材料 -X：命中排除规则的路径直接剔除
    if (isPathEntryExcluded(entry)) return false;
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
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}未匹配到任何有效的材料路径`);
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
async function generateAllPaths(pathingDir, targetResourceNames, cdMaterialNames, materialCategoryMap, pathingMode, imagesDir, CDCategories = null) {
  // 统一的记录解析缓存：整个名单构建 + 路径执行期间，每个记录文件只读盘、解析一次
  const pathRecordCache = {};
  // 创建materialCategoryMap的深拷贝，避免修改原始数据
  const localMaterialCategoryMap = JSON.parse(JSON.stringify(materialCategoryMap));
  
  if (debugLog) {
    const allMaterials = Object.values(localMaterialCategoryMap).flat();
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[generateAllPaths] 开始`);
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[generateAllPaths] pathingMode: ${JSON.stringify({estimateMode: pathingMode.estimateMode, hasPathing: pathingMode.hasPathing, hasCategory: pathingMode.hasCategory, onlyCategory: pathingMode.onlyCategory})}`);
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[generateAllPaths] localMaterialCategoryMap包含${Object.keys(localMaterialCategoryMap).length}个分类，共${allMaterials.length}种材料`);
    if (allMaterials.length > 0 && allMaterials.length <= 20) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[generateAllPaths] 材料列表: ${allMaterials.join('、')}`);
    }
  }
  
  // 创建本地的pathingMonsterMaterials集合，避免修改全局ocrContext
  const localPathingMonsterMaterials = new Set();
  
  // 缓存路径文件列表（减少IO）
  const pathingFilePaths = GlobalCacheManager.getPathFiles(pathingDir, 0, CONSTANTS.MAX_PATH_DEPTH, ['.json']);

  // 被 - 规则排除的路径名（仅用于日志）
  const excludedPathNames = [];
  
  const pathEntries = pathingFilePaths.map(path => {
    const { materialName, monsterName } = extractResourceNameFromPath(path, cdMaterialNames);
    return { path, resourceName: materialName, monsterName };
  }).filter(entry => (entry.resourceName || entry.monsterName) && entry.path.trim() !== "")
    .filter(entry => {
      // 优先级材料 -X：命中排除规则的路径直接剔除
      if (isPathEntryExcluded(entry)) {
        excludedPathNames.push(basename(entry.path));
        return false;
      }
      return true;
    });

  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[路径初始化] 共读取有效路径 ${pathEntries.length} 条`);

  if (excludedPathNames.length > 0) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[优先级材料] 排除路径${excludedPathNames.length}条：${excludedPathNames.join('、')}`);
  }

  // onlyCategory模式：只扫描背包，不处理路径
  if (pathingMode.onlyCategory) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 只扫描背包，不处理路径`);
    
    // 执行背包扫描
    const allMaterialCounts = await MaterialPath(localMaterialCategoryMap, null, pathingMode);
    const pathingMaterialCounts = allMaterialCounts;
    const flatCounts = allMaterialCounts.flat();

    // 合成台平衡（Pathing【合成台平衡】）：扫描完背包后，把怪物三级材料自底向上"流通"，并就地把预测数量写回 flatCounts
    if (pathingMode.alchemyBalance) {
      await balanceMonsterMaterialsByAlchemy(flatCounts);
    }

    // 筛选低数量材料（同时生成超量名单）——使用投影后的 flatCounts，达标三级不再计为低数量
    const filteredMaterials = filterLowCountMaterials(flatCounts, localMaterialCategoryMap, true);
    
    // 将本地pathingMonsterMaterials复制到全局ocrContext
    ocrContext.pathingMonsterMaterials.clear();
    localPathingMonsterMaterials.forEach(mat => ocrContext.pathingMonsterMaterials.add(mat));
    
    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 扫描完成，不返回路径`);
    return { allPaths: [], pathingMaterialCounts };
  }

  // 分类路径（怪物 > 普通材料）
  const monsterPaths = pathEntries.filter(entry => entry.monsterName && entry.monsterName !== '地脉花');
  const normalPaths = pathEntries.filter(entry => entry.resourceName && !entry.monsterName);

  // 测算模式：不扫描背包，直接返回所有路径
  if (pathingMode.estimateMode) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[测算模式] 测算模式，不扫描背包`);
    
    const allPaths = [...monsterPaths, ...normalPaths];
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[测算模式] pathing材料模式，共${allPaths.length}条路径`);
    
    return { allPaths, pathingMaterialCounts: [], pathRecordCache };
  }

  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[路径分类] 怪物:${monsterPaths.length} 普通:${normalPaths.length}`);

  // 测算模式不再直接返回所有路径，而是继续执行背包扫描以筛选低数量材料

  // 怪物路径关联材料到分类（扫描用）- onlyPathing模式或混合模式（hasPathing）
    if (pathingMode.hasPathing) {
    log.info(`${CONSTANTS.LOG_MODULES.MONSTER}开始处理${monsterPaths.length}条怪物路径的材料分类关联...`);
    monsterPaths.forEach((entry, index) => {
      const materials = monsterToMaterials[entry.monsterName] || [];
      if (materials.length === 0) {
        log.warn(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物路径${index+1}] 怪物【${entry.monsterName}】无对应材料映射`);
        return;
      }
      materials.forEach(mat => {
        // 添加到本地pathing怪物材料集合
        localPathingMonsterMaterials.add(mat);
        
        const category = matchImageAndGetCategory(mat, imagesDir);
        if (!category) return;
        if (!localMaterialCategoryMap[category]) localMaterialCategoryMap[category] = [];
        if (!localMaterialCategoryMap[category].includes(mat)) {
          localMaterialCategoryMap[category].push(mat);
          // log.debug(`${CONSTANTS.LOG_MODULES.MONSTER}怪物【${entry.monsterName}】的材料【${mat}】加入分类【${category}】`);
        }
      });
    });
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}pathing文件夹中的怪物材料共${localPathingMonsterMaterials.size}种：${Array.from(localPathingMonsterMaterials).join('、')}`);
  }

  let processedNormalPaths = [];
  const processedMonsterPaths = monsterPaths;
  let pathingMaterialCounts = [];

  if (normalPaths.length > 0 || monsterPaths.length > 0 || pathingMode.hasCategory) {
    // 优化：一次扫描获取全量材料数量，同时服务于怪物和普通材料
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] 执行一次全量背包扫描（服务于怪物+普通路径）`);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] materialCategoryMap内容：${JSON.stringify(localMaterialCategoryMap)}`);
    const allMaterialCounts = await MaterialPath(localMaterialCategoryMap, null, pathingMode);
    pathingMaterialCounts = allMaterialCounts;
    const flatCounts = allMaterialCounts.flat();

    // 合成台平衡（Pathing【合成台平衡】）：扫描完背包后，把怪物三级材料自底向上"流通"，并就地把预测数量写回 flatCounts
    if (pathingMode.alchemyBalance) {
      await balanceMonsterMaterialsByAlchemy(flatCounts);
    }
    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] 扫描返回数据：${JSON.stringify(allMaterialCounts)}`);
    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[材料扫描] flat后数据：${JSON.stringify(flatCounts)}`);

    // 筛选低数量材料（同时生成超量名单）——使用投影后的 flatCounts，达标三级不再计为低数量
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 基于全量扫描结果筛选有效材料`);
    const filteredMaterials = filterLowCountMaterials(flatCounts, localMaterialCategoryMap, pathingMode.onlyCategory);
    const validMonsterMaterialNames = filteredMaterials.map(m => m.name);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MONSTER}[怪物材料] 筛选后有效材料：${validMonsterMaterialNames.join('、')}`);

    // 超量名单更新：onlyPathing模式或混合模式（hasPathing）
    if (pathingMode.hasPathing) {
      const finalExcessList = excessMaterialNames.filter(name => name !== "OCR启动");
      if (finalExcessList.length > 0) {
        if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[Pathing材料模式] 更新超量名单，共${finalExcessList.length}种：${finalExcessList.join('、')}`);
        const fullContent = `超量名单:${finalExcessList.join(',')}\n`;
        file.writeTextSync(CONSTANTS.EXCESS_MATERIALS_PATH, fullContent, false);
      }
    }
    
    // onlyCategory模式：只扫描，不处理路径
    if (pathingMode.hasCategory && !pathingMode.estimateMode) {
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
        if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 保留在超量名单：${keptMaterials.join('、')}`);
      }
      if (removedMaterials.length > 0) {
        if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 从超量名单剔除：${removedMaterials.join('、')}`);
      }
      if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 更新后超量名单，共${finalExcessList.length}种`);
      
      // 保存更新后的超量名单（直接覆盖，不合并）
      if (finalExcessList.length > 0) {
        const fullContent = `超量名单:${finalExcessList.join(',')}\n`;
        file.writeTextSync(CONSTANTS.EXCESS_MATERIALS_PATH, fullContent, false);
        if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.RECORD}超量名单已保存至 ${CONSTANTS.EXCESS_MATERIALS_PATH}，共${finalExcessList.length}种`);
      }
      
      // 过滤只保留超量名单中的材料
      const filteredByExcess = scannedMaterials.filter(item => finalExcessList.includes(item.name));
      pathingMaterialCounts = [filteredByExcess];
      // if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[onlyCategory模式] 过滤后保留超量材料：${filteredByExcess.map(m => m.name).join('、') || '无'}`);
    } else {

    // log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 基于全量扫描结果筛选低数量材料`);
    const lowCountMaterialsFiltered = filteredMaterials;
    const flattenedLowCountMaterials = lowCountMaterialsFiltered.flat().sort((a, b) => a.count - b.count);
    const lowCountMaterialNames = flattenedLowCountMaterials.map(material => material.name);

    processedNormalPaths = classifyNormalPathFiles(pathingDir, targetResourceNames, lowCountMaterialNames, cdMaterialNames)
      .filter(entry => normalPaths.some(n => n.path.replace(/\\/g, '/') === entry.path.replace(/\\/g, '/')));
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[普通材料] 筛选后保留路径 ${processedNormalPaths.length} 条`);
    }
  }

  // 按TargetresourceName顺序处理路径（优先级1-3按目标顺序，同类型内也按目标顺序）
  const allPaths = [];

  const pushedPathKeys = new Set(allPaths.map(entry => entry.path.replace(/\\/g, '/')));
  const pushUniquePaths = (matchedPaths) => {
    if (!matchedPaths || matchedPaths.length === 0) return;
    matchedPaths.forEach(entry => {
      const key = entry.path.replace(/\\/g, '/');
      if (pushedPathKeys.has(key)) return;
      pushedPathKeys.add(key);
      allPaths.push(entry);
    });
  };

  targetResourceNames.forEach((targetName, targetIndex) => {
    // 1. 目标怪物材料（怪物名已展开为三个材料，任一材料命中即优先；同一路径只入队一次）
    if (monsterToMaterials[targetName] || materialToMonsters[targetName]) {
      pushUniquePaths(processedMonsterPaths.filter(e => {
        const materials = monsterToMaterials[e.monsterName] || [];
        return materials.includes(targetName);
      }));
    }
    // 3. 目标普通材料（按优先级顺序）
    else {
      pushUniquePaths(processedNormalPaths.filter(e => e.resourceName === targetName));
    }
  });
  
  const remainingMonsterPaths = processedMonsterPaths.filter(e => {
    const materials = monsterToMaterials[e.monsterName] || [];
    return !materials.some(mat => targetResourceNames.includes(mat)) && 
           materials.some(mat => !excessMaterialNames.includes(mat));
  });
  const remainingNormalPaths = processedNormalPaths.filter(e => !targetResourceNames.includes(e.resourceName));
  
  // 5. 剩余怪物
  allPaths.push(...remainingMonsterPaths);
  // log.info(`${CONSTANTS.LOG_MODULES.PATH}[优先级5] 剩余怪物 路径 ${remainingMonsterPaths.length} 条`);
  
  // 6. 剩余普通材料
  allPaths.push(...remainingNormalPaths);
  // log.info(`${CONSTANTS.LOG_MODULES.PATH}[优先级6] 剩余普通材料 路径 ${remainingNormalPaths.length} 条`);

  // 按时间成本排序同一材料的路径（1%到100%）
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 开始按时间成本排序同一材料的路径...`);
  
  // 收集时间成本数据
  const allTimeCostData = collectAllTimeCostData(allPaths, CONSTANTS.RECORD_DIR, CONSTANTS.NO_RECORD_DIR, pathRecordCache);
  
  // 计算时间成本统计数据
  const timeCostStats = {};
  for (const [resourceKey, data] of Object.entries(allTimeCostData)) {
    timeCostStats[resourceKey] = calculateTimeCostStats(data);
  }
  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 时间成本统计数据计算完成，共${Object.keys(timeCostStats).length}个资源`);
  
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
  if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 按材料分组完成，共${Object.keys(pathsByResource).length}个分组`);
  
  // 对每个材料的路径按时间成本排序
  const sortedPaths = [];
  for (const [resourceKey, paths] of Object.entries(pathsByResource)) {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 处理材料: ${resourceKey}, 路径数: ${paths.length}`);
    // 为每个路径附加时间成本
    const pathsWithCost = paths.map(entry => {
      const pathName = basename(entry.path);
      const perTime = calculatePerTime(
        entry.resourceName || entry.monsterName,
        pathName,
        CONSTANTS.RECORD_DIR,
        CONSTANTS.NO_RECORD_DIR,
        false,
        pathRecordCache,
        entry.path
      );
      return { ...entry, perTime };
    });
    
    // 辅助函数：检查路径是否有历史记录（利用已有的pathRecordCache）
    const entryHasHistory = (entry) => {
      const pathName = basename(entry.path);
      const resourceName = entry.resourceName || entry.monsterName;
      
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
      
      // 优先级相同：先按时间成本（天然档间），perTime 相同（同档）按路径名称（地域）
      if (a.perTime !== null && b.perTime !== null) {
        if (a.perTime !== b.perTime) return a.perTime - b.perTime;
        return basename(a.path).localeCompare(basename(b.path), 'zh');
      }

      // 都是 null（记录不足/无历史），按路径名称（地域）排序
      return basename(a.path).localeCompare(basename(b.path), 'zh');
    });
    
    // 输出排序结果
    if (debugLog) {
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] ${resourceKey} 的路径按时间成本排序：`);
      pathsWithCost.forEach((p, idx) => {
        const hasHistory = entryHasHistory(p);
        let costStr;
        let priorityStr;
        
        if (p.perTime !== null) {
          costStr = `${p.perTime.toFixed(3)}秒/单位`;
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
    
    // 按时间成本范围过滤路径
    const stats = timeCostStats[resourceKey];
    let pathsToAdd = pathsWithCost;
    
    if (stats && stats.count > 0 && timeCost.min !== 0 && timeCost.max !== 101) {
      const minValue = stats.percentiles[timeCost.min] || stats.median;
      const maxValue = stats.percentiles[timeCost.max] || stats.median;
      
      const beforeFilterCount = pathsWithCost.length;
      pathsToAdd = pathsWithCost.filter(p => {
        if (p.perTime === null) return true;
        return p.perTime >= minValue && p.perTime <= maxValue;
      });
      
      const filteredCount = beforeFilterCount - pathsToAdd.length;
      if (filteredCount > 0) {
        if (debugLog) {
          log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] ${resourceKey} 已过滤${filteredCount}条不在${timeCost.min}%~${timeCost.max}%范围内的路径（${minValue.toFixed(4)}~${maxValue.toFixed(4)}秒/单位）`);
        }
      }
    }
    
    sortedPaths.push(...pathsToAdd);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 材料 ${resourceKey} 排序完成，添加 ${pathsToAdd.length} 条路径`);
  }
  
  log.info(`${CONSTANTS.LOG_MODULES.PATH}[时间成本排序] 完成，共${sortedPaths.length}条路径`);

  if (rollbackPathCount > 0) {
    log.info(`${CONSTANTS.LOG_MODULES.PATH}[滞后路径] 功能已启用，开始筛选最久未运行的路径...`);
    const rollbackPaths = selectRollbackPaths(sortedPaths, CONSTANTS.RECORD_DIR, CONSTANTS.NO_RECORD_DIR, rollbackPathCount, pathRecordCache);
    
    if (rollbackPaths.length > 0) {
      const rollbackPathNames = rollbackPaths.map(p => basename(p.path));
      log.info(`${CONSTANTS.LOG_MODULES.PATH}[滞后路径] 已添加${rollbackPaths.length}条滞后路径：${rollbackPathNames.join('、')}`);
      
      sortedPaths.push(...rollbackPaths);
    }
  }

  // 重生组：RollbackPathCount>2 时，给1条被0记录超限排除的（怪物/材料）路径就地放行
  // 通用模式下这些超限路径本就在 sortedPaths 中（执行期才被 checkPathSkipConditions 跳过），故直接对原对象打 isRespawn 标记绕过上限
  if (rollbackPathCount > 2) {
    const respawnPaths = selectRespawnPath(sortedPaths, CONSTANTS.RECORD_DIR, CONSTANTS.NO_RECORD_DIR, CDCategories, pathRecordCache);
    respawnPaths.forEach(e => { e.isRespawn = true; });
  }

  // 将本地pathingMonsterMaterials复制到全局ocrContext，供OCR使用
  ocrContext.pathingMonsterMaterials.clear();
  localPathingMonsterMaterials.forEach(mat => ocrContext.pathingMonsterMaterials.add(mat));

  // log.info(`${CONSTANTS.LOG_MODULES.PATH}[最终路径] 共${allPaths.length}条：${allPaths.map(p => basename(p.path))}`);
  return { allPaths: sortedPaths, pathingMaterialCounts, pathRecordCache };
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
      // log.debug(`发送通知失败（可能已退出）: ${e.message}`);
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
      // log.debug(`发送第${i+1}段通知失败（可能已退出）: ${e.message}`);
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
      // log.debug(`${CONSTANTS.LOG_MODULES.RECORD}超量名单文件不存在或读取失败: ${CONSTANTS.EXCESS_MATERIALS_PATH}`);
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

  // 初始化固定资源（F+OCR 拾取循环所需）
  const fDialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F_Dialogue.png"), 1102, 335, 34, 400);
  const textxRange = { min: 1210, max: 1412 };
  const texttolerance = 3;

  // ★独立标定模式单独入口：背包翻页标定（settings.FlipCalibTestMode=【背包翻页拖动距离】，优先执行）
  //   开背包→养成道具页→重置滑条→扫列1(需≥5个)→迭代拖动标定"1页"距离(第五个材料落到第一个原位、绝不过冲)→存 user/pageFlip.json，跑完即退。
  if (testBagFlip) {
    setGameMetrics(1920, 1080, 1);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}[翻页标定] 独立测试模式启动（已跳过正常流程）：标定完成后正常翻页可直接留空【拖动距离】`);
    try { await runBagFlipCalib(); }
    catch (e) { log.error('【翻页标定】异常终止: ' + e.message); }
    state.completed = true;
    state.cancelRequested = true;
    return;
  }

  // 拖动距离未设置且 user/pageFlip.json 无标定记录 → 自动先跑一次翻页标定，再继续正常流程
  if (needFlipCalib()) {
    setGameMetrics(1920, 1080, 1);
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}[翻页标定] 未设置拖动距离且无标定记录，自动执行一次`);
    try { await runBagFlipCalib(); refreshTotalPageDistance(); }
    catch (e) { log.error('【翻页标定】自动标定失败: ' + e.message); }
  }

  // await initPathEngine();

  // 目标资源处理（支持 + / - 语法：+号越多越优先，- 为排除，怪物名展开为对应三个材料）
  const targetRules = buildTargetRules(settings.TargetresourceName || "");
  // 优先材料列表（已按 + 权重降序、同权重按配置顺序排序）
  const targetResourceNames = targetRules.prioritized;

  const targetTextCategories = readtargetTextCategories(CONSTANTS.TARGET_TEXT_DIR);

  // Pathing材料模式：读取或初始化超量名单（哨兵"OCR启动"，使 ocrTask 不空等、正常启动拾取循环）
  if (pathingMode.hasPathing) {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[Pathing材料模式] 读取超量名单文件`);
    const loadedExcessMaterials = loadExcessMaterialsList();
    if (loadedExcessMaterials.length > 0) {
      excessMaterialNames = [...loadedExcessMaterials, "OCR启动"];
    } else {
      excessMaterialNames = ["OCR启动"];
    }
    if (debugLog) log.info(`【超量材料更新】共${excessMaterialNames.length}种：${excessMaterialNames.join("、")}`);
  }

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
      // 首先过滤超量材料（源头剔除，保证拾取逻辑不变）
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
        
        // log.info(`OCR拾取列表（怪物路径）：`);
        // log.info(`  - 当前怪物材料：${currentMonsterMaterials.join('、') || '无'}`);
        // log.info(`  - pathing其他怪物材料（未超量）：${additionalMonsterMaterials.join('、') || '无'}`);
        // log.info(`  - 非怪物材料：${filtered.filter(name => !materialToMonsters[name]).join('、') || '无'}`);
      }
      
      return filtered;
    };

    // log.info(`超量名单：${excessMaterialNames.join('、')}`);
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
  if (selected_materials_array.length > 0 && !pathingMode.hasPathing) {
    // 1. 初始化选中的分类（hasPathing模式除外）
    selected_materials_array.forEach(selectedCategory => {
      materialCategoryMap[selectedCategory] = [];
    });
  } else if (selected_materials_array.length > 0 && pathingMode.hasPathing) {
    // 混合模式（hasCategory + hasPathing）：初始化选中的分类，然后添加pathing材料
    if (debugLog) log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}混合模式：先初始化选中的分类，再添加pathing材料`);
    selected_materials_array.forEach(selectedCategory => {
      materialCategoryMap[selectedCategory] = [];
    });
  } else {
    if (pathingMode.hasPathing) {
      if (debugLog) log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}Pathing材料模式：将自动扫描pathing材料的实际分类`);
    } else {
      log.warn(`${CONSTANTS.LOG_MODULES.MATERIAL}未选择【材料分类】，采用【路径材料】专注模式`);
    }
  }
  
  // 2. 处理路径相关材料（hasPathing模式）
  if (pathingMode.hasPathing) {
    // 清除空分类（在扫描前清理）
    Object.keys(materialCategoryMap).forEach(category => {
      if (materialCategoryMap[category] && materialCategoryMap[category].length === 0) {
        delete materialCategoryMap[category];
      }
    });
    const pathingFilePaths = GlobalCacheManager.getPathFiles(CONSTANTS.PATHING_DIR, 0, CONSTANTS.MAX_PATH_DEPTH, ['.json']);
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

    // 构建分类映射（混合模式下只添加到已初始化的分类）
    Array.from(allMaterials).forEach(resourceName => {
      const category = matchImageAndGetCategory(resourceName, CONSTANTS.IMAGES_DIR);
      if (category) {
        // 混合模式（hasCategory）：只添加到选中的分类
        if (pathingMode.hasCategory && !selected_materials_array.includes(category)) {
          return;
        }
        if (!materialCategoryMap[category]) {
          materialCategoryMap[category] = [];
        }
        if (!materialCategoryMap[category].includes(resourceName)) {
          materialCategoryMap[category].push(resourceName);
        }
      }
    });
  }
  
  // 3. 在hasPathing或hasCategory模式下，保留所有选中的分类
  if (pathingMode.hasPathing || pathingMode.hasCategory) {
    // 对于hasCategory模式，保留所有选中的分类，即使是空数组
    // 对于hasPathing模式（纯模式），删除空数组
    // 对于混合模式（hasPathing + hasCategory），也删除空数组
    if (pathingMode.hasPathing) {
      Object.keys(materialCategoryMap).forEach(category => {
        if (materialCategoryMap[category].length === 0) {
          delete materialCategoryMap[category];
        }
      });
    }
  }
  
  // 4. 在hasCategory模式下，确保materialCategoryMap只包含选中的分类
  if (pathingMode.hasCategory) {
    const selectedCategoriesSet = new Set(selected_materials_array);
    const filteredMap = {};
    
    // 只保留选中的分类，即使是空数组
    selected_materials_array.forEach(category => {
      filteredMap[category] = materialCategoryMap[category] || [];
    });
    
    materialCategoryMap = filteredMap;
  }

  // 优先级1：测算模式（先执行测算分析，不扫描背包）
  if (pathingMode.estimateMode) {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级1] 测算模式：执行测算分析（不扫描背包）`);
    
    const estimatePathingMode = { 
      estimateMode: true, 
      hasCategory: false, 
      hasPathing: pathingMode.hasPathing, 
      onlyCategory: false
    };
    
    const { allPaths: estimatePaths } = await generateAllPaths(
      CONSTANTS.PATHING_DIR,
      targetResourceNames,
      cdMaterialNames,
      materialCategoryMap,
      estimatePathingMode,
      CONSTANTS.IMAGES_DIR
    );
    
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级1] 测算完成，共${estimatePaths.length}条路径`);
    
    // 测算模式一律只测算：无论是否同时勾选了其它模式，都不执行任何路径，测算完直接结束
    await processAllPaths(
      estimatePaths,
      CDCategories,
      materialCategoryMap,
      timeCost,
      [],
      null,
      CONSTANTS.RECORD_DIR,
      CONSTANTS.NO_RECORD_DIR,
      CONSTANTS.IMAGES_DIR,
      endTimeStr,
      estimatePathingMode,
      maxRunTimeSec
    );
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级1] 测算模式完成，只测算不执行路径，直接结束`);
    return;
  }

  // 优先级2：纯扫描分类模式（只扫描不执行）
  if (pathingMode.onlyCategory) {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级2] 纯扫描分类模式：只扫描不执行路径`);
    
    // 清空全局ocrContext.pathingMonsterMaterials，避免模式间干扰
    ocrContext.pathingMonsterMaterials.clear();
    
    // 创建独立的materialCategoryMap副本
    const categoryMaterialCategoryMap = JSON.parse(JSON.stringify(materialCategoryMap));
    
    // 创建独立的pathingMode副本，关闭测算模式
    const categoryPathingMode = { 
      estimateMode: false, 
      hasCategory: true, 
      hasPathing: false, 
      onlyCategory: true,
      alchemyBalance: pathingMode.alchemyBalance
    };
    
    await generateAllPaths(
      CONSTANTS.PATHING_DIR,
      targetResourceNames,
      cdMaterialNames,
      categoryMaterialCategoryMap,
      categoryPathingMode,
      CONSTANTS.IMAGES_DIR
    );
    
    saveExcessMaterialsList(excessMaterialNames);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级2] 扫描完成，超量名单已保存`);
    state.completed = true;
    state.cancelRequested = true;
    return;
  }

  // 优先级3：混合模式 - 按顺序独立执行多个单次任务
  // 任务1：扫描额外的分类（独立扫描背包并更新超量名单）
  if (pathingMode.hasCategory) {
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级3-任务1] 执行【扫描额外的分类】（独立扫描背包）`);
    
    // 清空全局ocrContext.pathingMonsterMaterials，避免模式间干扰
    ocrContext.pathingMonsterMaterials.clear();
    
    // 创建独立的materialCategoryMap副本
    const categoryMaterialCategoryMap = JSON.parse(JSON.stringify(materialCategoryMap));
    
    const categoryPathingMode = { 
      estimateMode: false, 
      hasCategory: true, 
      hasPathing: false, 
      onlyCategory: true,
      alchemyBalance: pathingMode.alchemyBalance
    };
    
    await generateAllPaths(
      CONSTANTS.PATHING_DIR,
      targetResourceNames,
      cdMaterialNames,
      categoryMaterialCategoryMap,
      categoryPathingMode,
      CONSTANTS.IMAGES_DIR
    );
    
    saveExcessMaterialsList(excessMaterialNames);
    
    const reloadedExcessMaterials = loadExcessMaterialsList();
    if (reloadedExcessMaterials.length > 0) {
      excessMaterialNames = [...reloadedExcessMaterials, "OCR启动"];
    } else {
      excessMaterialNames = ["OCR启动"];
    }
    if (debugLog) log.info(`【超量材料更新】任务1完成，重新读取超量名单，共${excessMaterialNames.length}种：${excessMaterialNames.join("、")}`);
    await sleep(10);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级3-任务1] 扫描分类完成，继续执行任务2`);
  }

  // 优先级4：任务2 - 执行pathing模式（独立扫描背包并执行路径）
  if (pathingMode.hasPathing) {
    if (debugLog) log.info(CONSTANTS.LOG_MODULES.MAIN + '[优先级4-任务2] 执行pathing材料（独立扫描背包并执行路径）');
    
    // 清空全局ocrContext.pathingMonsterMaterials，避免模式间干扰
    ocrContext.pathingMonsterMaterials.clear();
    
    // 创建独立的materialCategoryMap副本
    let pathingMaterialCategoryMap = JSON.parse(JSON.stringify(materialCategoryMap));
    
    // 如果是pathing模式，重新构建materialCategoryMap，只包含pathing文件夹中的材料
    if (pathingMode.hasPathing) {
      log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级4-任务2] 重新构建materialCategoryMap，只包含pathing文件夹中的材料`);
      
      // 清空现有分类
      pathingMaterialCategoryMap = {};
      
      // 读取pathing文件夹中的所有路径
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
          if (!pathingMaterialCategoryMap[category]) {
            pathingMaterialCategoryMap[category] = [];
          }
          if (!pathingMaterialCategoryMap[category].includes(resourceName)) {
            pathingMaterialCategoryMap[category].push(resourceName);
          }
        }
      });
      
      if (debugLog) {
        const allPathingMaterials = Object.values(pathingMaterialCategoryMap).flat();
        log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级4-任务2] pathing材料共${allPathingMaterials.length}种：${allPathingMaterials.join('、')}`);
      }
    }
    
    // 清理materialCategoryMap中的空数组（任务1可能添加的）
    Object.keys(pathingMaterialCategoryMap).forEach(category => {
      if (pathingMaterialCategoryMap[category] && pathingMaterialCategoryMap[category].length === 0) {
        delete pathingMaterialCategoryMap[category];
        if (debugLog) log.info(CONSTANTS.LOG_MODULES.MAIN + '[优先级4-任务2] 清理空分类: ' + category);
      }
    });
    
    // 创建独立的pathingMode副本
    const pathingPathingMode = { 
      estimateMode: false, 
      hasCategory: false,
      hasPathing: pathingMode.hasPathing, 
      onlyPathing: pathingMode.hasPathing,
      onlyCategory: false
    };
    
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级4-任务2] pathingPathingMode: ${JSON.stringify(pathingPathingMode)}`);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级4-任务2] pathingMaterialCategoryMap包含${Object.keys(pathingMaterialCategoryMap).length}个分类`);
    if (debugLog) {
      Object.entries(pathingMaterialCategoryMap).forEach(([category, materials]) => {
        log.info(`${CONSTANTS.LOG_MODULES.MAIN}[优先级4-任务2] 分类[${category}]: ${materials.length}种材料 - ${materials.join('、')}`);
      });
    }
    
    const { allPaths, pathingMaterialCounts, pathRecordCache } = await generateAllPaths(
      CONSTANTS.PATHING_DIR,
      targetResourceNames,
      cdMaterialNames,
      pathingMaterialCategoryMap,
      pathingPathingMode,
      CONSTANTS.IMAGES_DIR,
      CDCategories
    );

    // 处理所有路径
    let currentMaterialName = null;
    let flattenedLowCountMaterials = [];

    // 重置状态，让路径能够执行
    state.cancelRequested = false;
    
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[main] generateAllPaths返回完成，准备调用processAllPaths`);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[main] allPaths长度: ${allPaths.length}`);
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[main] state.cancelRequested已重置为: ${state.cancelRequested}`);
    
    const firstScanTime = new Date().toLocaleString();
    const initialMaterialCounts = pathingMaterialCounts.flat().reduce((acc, mat) => {
      acc[mat.name] = parseInt(mat.count, 10) || 0;
      return acc;
    }, {});

    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[main] 开始调用processAllPaths...`);
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
      endTimeStr,
      pathingPathingMode,
      maxRunTimeSec,
      pathRecordCache
    );
    if (debugLog) log.info(`${CONSTANTS.LOG_MODULES.PATH}[main] processAllPaths返回完成`);

    // 汇总结果
    const globalAccumulatedDifferences = processResult.globalAccumulatedDifferences;

    // 末次扫描
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}开始末次背包扫描，计算总差值`);
    const finalMaterialCounts = await MaterialPath(materialCategoryMap, null, pathingPathingMode);
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
      finalMsg += `  ${n}: ${d}个\n`;
    });
    await sendNotificationInChunks(finalMsg, notification.Send);
  }
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
    
    // 清理缓存
    if (debugLog) {
      GlobalCacheManager.printStats();
    }
    GlobalCacheManager.clearCache('all');
    log.info(`${CONSTANTS.LOG_MODULES.MAIN}缓存已清理`);
  }
})();
