const COMPLETED_TASKS_FILE = "./completed_tasks.json";
let skipCheckStamina = 1;//为0时跳过检查体力
let messageBuffer = '';
// 累积消息函数
function addNotification(message) {
    messageBuffer += message + '\n';
}
if (settings.ifClearLog) {
    // 清空文件内容（覆盖写入空字符串）
    file.writeTextSync("completed_tasks.json", "");
    
    // 或者使用异步方式：
    // await file.writeText("completed_tasks.json", "");
    
    settings.ifClearLog = false;
}
 
// 发送累积的消息
function sendBufferedNotifications() {
    if (messageBuffer.trim()) {
        notification.send(messageBuffer.trim());
        messageBuffer = ''; // 清空缓冲区
    }
}

/**
 * 检测「手动填写数量」模式下是否误填了等级/情况字段。
 * 背景：顶部「数量填写模式」选「手动填写数量」时，等级/情况字段不生效，
 * 但用户很容易填了等级却忘了把模式切到「选择等级计算」，导致「明明选了等级却没生效」的困惑。
 * 命中时给出明确提示，引导用户切换顶部模式。
 * @param {boolean} useLevelCalc 是否已切换到「选择等级计算」模式
 * @param {Array<[string, any]>} entries 形如 [["天赋书1 当前等级", "1-1-1"], ...]
 */
function warnIfLevelFieldsIgnored(useLevelCalc, entries) {
    if (useLevelCalc) return; // 已切到「选择等级计算」，正常生效，无需提示

    // 这些是「没改过/等同于未填」的状态：
    //   - 天赋等级文本框默认 "1-1-1"
    //   - 武器/首领的情况、武器星级已移除 default，未选时为空白("")
    //   - 情况下拉框里主动选「无」等价于不刷，也不算有效填写
    const DEFAULT_VALUES = new Set(["", "无", "1-1-1"]);
    const touched = [];

    for (const [label, value] of entries) {
        if (value === undefined || value === null) continue;
        const v = value.toString().trim();
        if (!DEFAULT_VALUES.has(v)) touched.push(`${label}=${v}`);
    }

    if (touched.length > 0) {
        log.warn(`检测到已填写等级/情况，但顶部「数量填写模式」不是「选择等级计算」，这些填写不会生效。`);
        log.warn(`本次将按【手动填写数量】模式运行。若要按等级自动计算，请到设置里把顶部模式切换为「选择等级计算」后重跑。`);
        addNotification(`⚠️ 提示：你填写了等级/情况(${touched.slice(0, 4).join('、')}${touched.length > 4 ? ' 等' : ''})，但顶部「数量填写模式」不是「选择等级计算」，将按手动填写的数量运行。`);
    } else {
        log.info(`当前为【手动填写数量】模式（顶部模式未切换）。若想改用「选择等级计算」，请到设置里把顶部模式切换过去。`);
    }
}

// 添加函数来读写已完成任务记录
async function loadCompletedTasks() {
    try {
        if (file.isFolder(COMPLETED_TASKS_FILE)) {
            return {};
        }
        const content = await file.readText(COMPLETED_TASKS_FILE);
        return JSON.parse(content);
    } catch (error) {
        // 如果文件不存在或其他错误，返回空对象
        return {};
    }
}

async function saveCompletedTasks(tasks) {
    try {
        await file.writeText(COMPLETED_TASKS_FILE, JSON.stringify(tasks, null, 2));
        log.info("已保存完成任务记录");
    } catch (error) {
        log.error(`保存任务记录失败: ${error}`);
    }
}

async function addCompletedTask(materialType, materialName, requireCounts) {
    const tasks = await loadCompletedTasks();
    const taskKey = `${materialType}_${materialName}`;
    
    tasks[taskKey] = {
        materialType,
        materialName,
        requireCounts,
        completedAt: new Date().toISOString()
    };
    
    await saveCompletedTasks(tasks);
    log.info(`已标记 ${materialName} 为完成`);
}

/* =========================================================================
 * 等级 -> 材料数量 换算模块
 * 规则表存放于 assets/material_rules.json，可按需自行维护。
 * ========================================================================= */

const MATERIAL_RULES_FILE = "./assets/material_rules.json";

let MATERIAL_RULES = null;

/** 读取规则表（带缓存） */
function getMaterialRules() {
    if (MATERIAL_RULES) return MATERIAL_RULES;
    try {
        const content = file.readTextSync(MATERIAL_RULES_FILE);
        MATERIAL_RULES = JSON.parse(content);
    } catch (error) {
        throw new Error(`读取材料规则表失败(${MATERIAL_RULES_FILE}): ${error}`);
    }
    return MATERIAL_RULES;
}

/**
 * 解析 x-y-z 技能等级，例如 "1-10-10" / "888" / "9-9-9"
 * - "888" 这种三位纯数字会被展开为 8-8-8
 * @returns {number[]} 长度为3的数组，元素范围 1~10
 */
function parseTalentLevels(value, fallback) {
    const fb = fallback || [1, 1, 1];
    if (value === undefined || value === null) return fb.slice();
    const raw = value.toString().trim();
    if (!raw) return fb.slice();

    let parts;
    if (/^\d+$/.test(raw) && raw.length === 3) {
        // "888" -> [8,8,8]
        parts = raw.split('').map(c => parseInt(c, 10));
    } else {
        parts = raw.split('-').map(s => parseInt(s.trim(), 10));
    }

    const result = [];
    for (let i = 0; i < 3; i++) {
        let num = parts[i];
        if (isNaN(num)) num = fb[i] || 1;
        result.push(Math.max(1, Math.min(10, num)));
    }
    return result;
}

/**
 * 把突破选项（如 "20级未突破" / "50级突破" / "80级突破"）
 * 解析为「已经历的突破档位」数组。
 */
function parseBreakOption(value) {
    const rules = getMaterialRules();
    const map = rules._breakOptionMap || {};
    if (value === undefined || value === null) return [];
    const key = value.toString().trim();
    if (Object.prototype.hasOwnProperty.call(map, key)) {
        return map[key].slice();
    }
    // 兜底：从 "XX级..." 里抽数字，视为已达到该档位的突破
    const m = key.match(/(\d+)/);
    if (!m) return [];
    const lv = parseInt(m[1], 10);
    const done = [];
    for (const b of rules.charBreakLevels) {
        if (b <= lv && !key.includes('未突破')) done.push(b);
    }
    return done;
}

/**
 * 计算「从未突破档位集合 A 到档位集合 B」之间新增的突破点。
 * @returns {number[]} 新增的突破档位
 */
function newBreakLevels(currentOption, targetOption) {
    const rules = getMaterialRules();
    const cur = parseBreakOption(currentOption);
    const tgt = parseBreakOption(targetOption);
    const curSet = {};
    cur.forEach(v => { curSet[v] = true; });
    return tgt.filter(v => !curSet[v]);
}

/**
 * 计算首领（BOSS）材料数量。
 * @param {string} currentOption 当前情况，如 "50级未突破"
 * @param {string} targetOption  目标情况，如 "80级突破"
 * @returns {number}
 */
function calculateBossCount(currentOption, targetOption) {
    const rules = getMaterialRules();
    let total = 0;
    for (const lv of newBreakLevels(currentOption, targetOption)) {
        total += rules.charBossMaterialRules[String(lv)] || 0;
    }
    return total;
}

/**
 * 计算天赋书数量（绿-蓝-紫）。
 * 注：当前/目标等级解析失败时均兜底为 1-1-1（即不刷取）。
 * @param {string} currentTalents 当前技能等级，如 "1-1-1"
 * @param {string} targetTalents  目标技能等级，如 "10-10-10"
 * @returns {number[]} [绿, 蓝, 紫]
 */
function calculateTalentBookCounts(currentTalents, targetTalents) {
    const rules = getMaterialRules();
    const cur = parseTalentLevels(currentTalents, [1, 1, 1]);
    const tgt = parseTalentLevels(targetTalents, [1, 1, 1]);
    const totals = [0, 0, 0];

    for (let i = 0; i < 3; i++) {
        if (cur[i] >= tgt[i]) continue;
        for (let lv = cur[i]; lv < tgt[i]; lv++) {
            const mat = rules.talentBookRules[`${lv}-${lv + 1}`] || [0, 0, 0];
            for (let j = 0; j < 3; j++) totals[j] += mat[j] || 0;
        }
    }
    return totals;
}

/**
 * 计算武器突破材料数量（绿-蓝-紫-金）。
 * @param {string} star           "五星" / "四星" / "三星"
 * @param {string} currentOption  当前情况，如 "50级未突破"
 * @param {string} targetOption   目标情况，如 "80级突破"
 * @returns {number[]} [绿, 蓝, 紫, 金]
 */
function calculateWeaponMaterialCounts(star, currentOption, targetOption) {
    const rules = getMaterialRules();
    const starKey = rules.weaponMaterialRules[star] ? star : "四星";
    const table = rules.weaponMaterialRules[starKey];
    const totals = [0, 0, 0, 0];
    for (const lv of newBreakLevels(currentOption, targetOption)) {
        const arr = table[String(lv)];
        if (!arr) continue;
        for (let j = 0; j < 4; j++) totals[j] += arr[j] || 0;
    }
    return totals;
}

/**
 * 解析手动填写的材料数量字符串，例如 "9-63-114" / "0-5-11-6" / "46"。
 * 不足的位数补 0；非法字符会抛错。
 * @param {string} input 数量字符串
 * @param {number} expectedCount 期望的位数
 * @returns {number[]} 长度固定为 expectedCount 的数字数组
 */
function parseManualCounts(input, expectedCount) {
    const raw = (input === undefined || input === null) ? "" : input.toString().trim();
    if (!raw) {
        throw new Error(`未填写数量（应为 ${expectedCount} 个用 - 分隔的非负整数）`);
    }
    const parts = raw.split('-');
    const result = [];
    for (let i = 0; i < expectedCount; i++) {
        if (i < parts.length) {
            const num = parseInt(parts[i].trim(), 10);
            if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
                throw new Error(`数量第 ${i + 1} 位 '${parts[i]}' 不是合法的非负整数`);
            }
            result.push(num);
        } else {
            result.push(0);
        }
    }
    return result;
}

/**
 * 等待图片出现并点击
 * @param {string} imageName 图片名称（不带.png后缀且在assets文件中）
 * @param {number} [timeout=20000] 超时时间（毫秒），默认20秒
 * @param {number} [checkInterval=500] 检查间隔（毫秒），默认500毫秒
 * @returns {Promise<void>}
 * @throws 如果超时未找到图片则抛出错误
 */
// 使用示例：
// await waitAndClickImage1("paimon_menu");
// await waitAndClickImage1("confirm_button",false,9000);
//
// (2) 自定义偏移量和是否点击，可以用于检测是否有图片
// await waitAndClickImage1("confirm_button",false,7000);
//滚动查询偏移点击
// await waitAndClickImage1("confirm_button",true,20000,758,60,true,1);
const waitAndClickImage1 = async (
    imageName,
	ifClick = true,
    timeout = 20000,
    extraWidth = 10,
    extraHeight = 10,
	ifScroll = false,
	scrollNum = 5,
    checkInterval = 500,
    threshold = 0.9 // 新增阈值参数，默认值0.8
) => {
    const startTime = Date.now();
    const imagePath = `assets/${imageName}.png`;
    
    // 读取模板图片
    const templateMat = file.ReadImageMatSync(imagePath);
    const recognitionObj = RecognitionObject.TemplateMatch(templateMat, 0, 0, 1920, 1080);
    recognitionObj.threshold = threshold;
    
    // 使用 try-finally 确保模板图像被释放
    try {
        while (Date.now() - startTime < timeout) {
            // 捕获游戏区域


            const captureRegion = captureGameRegion();
            
            // 使用 try-finally 确保每次循环的资源被释放
            try {
                // 查找图片
                const result = captureRegion.Find(recognitionObj);
                
                // 使用 try-finally 确保结果对象被释放
                try {
                    if (!result.isEmpty()) {
                        
						await sleep(400); // 点击前稍作等待
                        if (ifClick){
						    click(result.x+extraWidth, result.y+extraHeight);
						    log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
						} 
						else log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})`);
                        await sleep(200); // 点击后稍作等待
                        return true;
                    }
                } finally {
                    // 释放结果对象
                    if (result && result.Dispose) {
                        result.Dispose();
                    }
                }
            } finally {
                // 释放捕获区域
                if (captureRegion && captureRegion.Dispose) {
                    captureRegion.Dispose();
                }
            }
            
            await sleep(checkInterval);
			
			if(ifScroll){
                for (let i = 0; i < scrollNum; i++) {
                await keyMouseScript.runFile("assets/滚轮下滑.json");
				await sleep(80);
                }						
			}
        }
    } finally {
        // 释放模板图像
        if (templateMat && templateMat.Dispose) {
            templateMat.Dispose();
        }
    }
    
    throw new Error(`等待图片 ${imageName} 超时`);
}

async function isTaskCompleted(materialType, materialName, currentRequireCounts) {
    const tasks = await loadCompletedTasks();
    const taskKey = `${materialType}_${materialName}`;
    
    if (!tasks[taskKey]) {
        return false;
    }
    
    // 检查需求数量是否相同
    const previousRequireCounts = tasks[taskKey].requireCounts;
    if (Array.isArray(previousRequireCounts) && Array.isArray(currentRequireCounts)) {
        return previousRequireCounts.join(',') === currentRequireCounts.join(',');
    } else {
        return previousRequireCounts === currentRequireCounts;
    }
}

/**
 * 在指定区域内查找并点击指定文字
 * @param {string} targetText - 要点击的目标文字
 * @param {number} x - 识别区域的左上角X坐标
 * @param {number} y - 识别区域的左上角Y坐标
 * @param {number} width - 识别区域的宽度
 * @param {number} height - 识别区域的高度
 * @param {object} options - 可选参数
 * @param {boolean} options.trimText - 是否对OCR结果进行trim处理，默认true
 * @param {boolean} options.clickCenter - 是否点击文字区域中心，默认true
 * @param {number} options.retryCount - 重试次数，默认3
 * @param {number} options.retryInterval - 重试间隔(毫秒)，默认500
 * @returns {Promise<boolean>} 是否找到并点击了文字
 */
async function clickTextInRegion(targetText, x=0, y=0, width=1920, height=1080, options = {}) {
    const {
        trimText = true,
        clickCenter = true,
        retryCount = 3,
        retryInterval = 400
    } = options;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
        let captureRegion = null;
        let ocrRo = null;
        let results = null;
        
        try {
            // 获取游戏区域截图
            captureRegion = captureGameRegion();

            // 创建OCR识别对象，限定识别区域
            ocrRo = RecognitionObject.ocr(x, y, width, height);
            
            // 在限定区域内进行OCR识别
            results = captureRegion.findMulti(ocrRo);

            // 遍历OCR结果
            for (let i = 0; i < results.count; i++) {
                const res = results[i];
                let detectedText = res.text;
                
                // 可选：去除前后空白字符
                if (trimText) {
                    detectedText = detectedText.trim();
                }

                // 检查是否匹配目标文字
                if (detectedText === targetText) {
                    //log.info(`找到目标文字: "${targetText}"，位置: (${res.x}, ${res.y}, ${res.width}, ${res.height})`);
                    
                    if (clickCenter) {
                        // 点击文字区域中心
                        await sleep(200);
                        keyDown("VK_LMENU");
                        await sleep(600);
                        res.click();
                        await sleep(200);
                        keyUp("VK_LMENU");
                        log.info(`已点击文字中心: "${targetText}"`);

                    } else {
                        // 点击文字区域的左上角
                        res.clickTo(0, 0);
                        log.info(`已点击文字偏移位置: "${targetText}"`);
                    }
                    
                    // 释放资源
                    if (captureRegion) {
                        captureRegion.Dispose();
                    }
                    if (res) {
                        res.Dispose();
                    }
                    
                    return true;
                }
                
                // 释放当前遍历的结果对象
                if (res) {
                    res.Dispose();
                }
            }

            // 如果当前尝试未找到，且还有重试机会，则等待后重试
            if (attempt < retryCount) {
                
                await sleep(retryInterval);
            }
        } catch (error) {
            log.error(`点击文字"${targetText}"时发生错误: ${error.message}`);
            if (attempt < retryCount) {
                await sleep(retryInterval);
            }
        } finally {
            // 确保每次尝试都释放资源
            if (captureRegion) {
                captureRegion.Dispose();
            }
            if (results) {
                // 如果还有未释放的结果对象
                for (let i = 0; i < results.count; i++) {
                    const res = results[i];
                    if (res && typeof res.Dispose === 'function') {
                        try {
                            res.Dispose();
                        } catch (e) {
                            // 忽略释放错误
                        }
                    }
                }
            }
        }
    }

    log.info(`未找到文字: "${targetText}"，已尝试${retryCount + 1}次`);
    return false;
}

// 首领名称 -> 角色突破材料名称（背包「角色发育道具」页显示名）
const bossMaterialNameMap = {
    "爆炎树": "常燃火种",
    "半永恒统辖矩阵": "导光四面体",
    "掣电树": "藏雷野实",
    "纯水精灵": "净水之心",
    "翠翎恐蕈": "蕈王钩喙",
    "深罪浸礼者": "常暗圆环",
    "深邃摹结株": "深邃纠缠的凝视",
    "风蚀沙虫": "苍砾蕊羽",
    "冰风组曲-歌裴莉娅的葬送": "奇械发条备件·歌裴莉娅",
    "冰风组曲-科培琉司的劫罚": "奇械发条备件·科培琉司",
    "古岩龙蜥": "未熟之玉",
    "恒常机关阵列": "恒常机关之心",
    "急冻树": "极寒之核",
    "金焰绒翼龙暴君": "受祝所缚之印",
    "雷音权现": "雷霆数珠",
    "灵觉隐修的迷者": "谜土的护符",
    "魔像督军": "金色旋律的断章",
    "秘源机兵·统御械": "秘源积气喉",
    "秘源机兵·构型械": "秘刻金纹的源核",
    "魔偶剑鬼": "魔偶机心",
    "千年珍珠骏麟": "原海麟角",
    "熔岩辉龙像": "龙像的无智核",
    "贪食匿叶龙山王": "过熟的火榴果",
    "铁甲熔火帝皇": "帝皇的决断",
    "无相之草": "灭诤草蔓",
    "无相之火": "阴燃之珠",
    "无相之雷": "雷光棱镜",
    "无相之水": "排异之露",
    "无相之岩": "玄岩之塔",
    "水形幻人": "未能达成超越之水",
    "实验性场力发生装置": "图比昂装置",
    "遗迹巨蛇": "符纹之齿",
    "隐山猊兽": "凝云鳞甲",
    "兆载永劫龙兽": "永续机芯",
    "重拳出击鸭": "精密型月矩力冲鸭模具",
    "蕴光月幻蝶": "承光的鳞羽",
    "霜夜巡天灵主": "漫光的辉角",
    "超重型陆巡舰·机动战垒": "循环式军用月矩核心",
    "深黯魇语之主": "魇翼枯骸",
    "守望者·堕天": "堕天的落羽",
    "不灭衍生造物": "焰中不灭花枝",
    "嵌合翼骏狮": "游空之物的断尾",
    "游雪的护刃": "游离者的裂甲",
};

// 获取BOSS材料数量：优先通过背包「角色发育道具」页查询，失败时回退到冒险之证图像识别备用方法
async function getBossMaterialCount(bossName) {
    const count = await getBossMaterialCountByInventory(bossName);
    if (count !== null) return count;
    log.warn(`背包查询${bossName}材料数量失败，改用备用方法（冒险之证图像识别）`);
    return await getBossMaterialCountByTemplate(bossName);
}

// 【主方法】通过背包「角色发育道具」页查询BOSS材料数量，返回null表示查询失败
async function getBossMaterialCountByInventory(bossName) {
    const materialName = bossMaterialNameMap[bossName];
    if (!materialName) {
        log.warn(`未配置首领「${bossName}」的材料名称映射，无法通过背包查询`);
        return null;
    }
    try {
        await genshin.returnMainUi();
        await sleep(500);
        const task = new SoloTask("CountInventoryItem", {
            gridScreenName: GridScreenName.CharacterDevelopmentItems,
            itemNames: [materialName]
        });
        const result = await dispatcher.RunTask(task);
        const foundKeys = result ? Object.keys(result) : [];
        if (foundKeys.includes(materialName)) {
            const quantity = Number(result[materialName]) || 0;
            log.info(`背包查询到${bossName}材料「${materialName}」数量: ${quantity}`);
            return quantity;
        }
        log.warn(`背包「角色发育道具」页未找到${bossName}材料「${materialName}」`);
        return null;
    } catch (error) {
        log.error(`背包查询${bossName}材料「${materialName}」数量失败: ${error?.message ?? error}`);
        return null;
    }
}

// 【备用方法】打开冒险之证-讨伐-首领，通过模板匹配和OCR识别BOSS材料数量
async function getBossMaterialCountByTemplate(bossName) {
await genshin.returnMainUi();
await sleep(500);
keyPress("F1");
await repeatOperationUntilTextFound({x: 250,y: 520,width: 100,height: 60,targetText: "讨伐",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await repeatOperationUntilTextFound({x: 380,y: 180,width: 100,height: 50,targetText: "全部",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await repeatOperationUntilTextFound({x: 400,y: 360,width: 100,height: 50,targetText: "精英",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await sleep(500);
await repeatOperationUntilTextFound({x: 380,y: 180,width: 100,height: 50,targetText: "精英",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await sleep(500);
await repeatOperationUntilTextFound({x: 400,y: 420,width: 100,height: 50,targetText: "首领",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await sleep(500);
click(956,844);await sleep(500);//点到最后
click(956,844);await sleep(500);//点到最后
await waitAndClickImage('boss/wolf');//点击狼王图标，避免其他图标识别失败
click(958,286);await sleep(500);//返回最上边
click(958,286);await sleep(500);//返回最上边
log.info(`正在查询数量`);
        try {
            const targetImageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/boss/${bossName}.png`), 0, 0, 1920,1080);
            targetImageRo.Threshold = 0.95;
            const stopImageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/boss/无相之风.png"), 0, 0, 1920,1080);
            stopImageRo.Threshold = 0.95;
            await findAndClickWithScroll(targetImageRo, stopImageRo, {maxAttempts: 30,scrollNum: 9});
            if(bossName == '冰风组曲-科培琉司的劫罚') await waitAndClickImage("好感图标", 160, 30);
            else await waitAndClickImage("好感图标", 80, 30);
            await sleep(800);
            const result = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
            if (result !== false) {
                const quantity = positiveIntegerJudgment(result);
                log.info(`识别到${bossName}材料数量: ${quantity}`);
                return quantity;
            } else {
                log.warn(`${bossName}材料识别失败，请检查相关设置`);
            }
        } catch (error) {
        notification.send(`${bossName}材料刷取失败，错误信息: ${error}`);
        return 0;
        }
}

async function findAndClickWithScroll(targetRo, stopRo, options = {}) {
    const {
        maxAttempts = 10,
        scrollNum = 9,
        clickDelay = 500
    } = options;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 1. 捕获当前游戏区域
        const captureRegion = captureGameRegion();
        
        try {
            // 3. 寻找目标图片
            const targetResult = captureRegion.find(targetRo);
            if (!targetResult.isEmpty()) {
                // 找到目标，点击并返回
                log.info(`找到目标图片，位置: (${targetResult.x}, ${targetResult.y})`);
                targetResult.click();
                await sleep(clickDelay);
                return;
            }
            
            // 4. 未找到目标，滚动画面
            log.info(`第 ${attempt + 1} 次尝试未找到目标图片，将滚动画面...`);
            for (let i = 0; i < scrollNum; i++) {
                await keyMouseScript.runFile("assets/滚轮下滑.json");
            }

            // 2. 检查是否遇到终止图片
            const stopResult = captureRegion.find(stopRo);
            if (!stopResult.isEmpty()) {
                throw new Error(`遇到终止图片，停止寻找目标图片。终止位置: (${stopResult.x}, ${stopResult.y})`);
            }
        } finally {
            // 释放captureRegion占用的资源
            captureRegion.dispose();
        }
    }
    
    // 达到最大尝试次数仍未找到
    throw new Error(`在 ${maxAttempts} 次尝试后仍未找到目标图片`);
}

//执行战斗并检测结束																		
async function restoredEnergyAutoFightAndEndDetection() {
await genshin.tp(178.55,384.4);
await repeatOperationUntilTextFound();//
keyPress("F"); 
await repeatOperationUntilTextFound({x: 1650,y: 1000,width: 160,height: 45,targetText: "单人挑战",stepDuration: 0,waitTime: 100,ifClick: true});//等待点击单人挑战
await sleep(200);
click(1180, 760);//队伍等级偏低、体力不够可能会出弹窗
await repeatOperationUntilTextFound({x: 1650,y: 1000,width: 160,height: 45,targetText: "开始挑战",stepDuration: 0,waitTime: 100,ifClick: true});//等待点击开始挑战
await sleep(2000);
await tpEndDetection();
keyDown("w");
await sleep(200);
keyDown("SHIFT");
await sleep(300);
keyUp("SHIFT");
await sleep(500);
keyDown("SHIFT");
await sleep(300);
keyUp("SHIFT");
await sleep(1000);
keyDown("SHIFT");
await sleep(300);
keyUp("SHIFT");
await sleep(500);
keyUp("w");
let challengeTime = 0;
    //2分钟兜底
    while (challengeTime < 5000) {
            for (let i = 1;i < 5; i++) {
            keyPress(i.toString()); 
            await sleep(300);
            leftButtonClick();
            await sleep(400);
            keyDown("e"); 
            await sleep(400);
            keyUp("e"); 
            await sleep(500);
            leftButtonClick();
            await sleep(100);
            let res = captureGameRegion().find(RecognitionObject.ocr(840, 935, 230, 40));
            if (res.text.includes("自动退出")) {
                     log.info("检测到挑战成功");           
                     return;
                }
            }
        challengeTime = challengeTime + 200;
        await sleep(100);
        } 
log.info("挑战超时，可能充能失败");
}

async function restoredEnergy() {
await genshin.returnMainUi();
await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像，避免有倒下的角色
await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
 log.info("能量充满，任务结束");
await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
}
//征讨之花领奖(图标识别)
const autoNavigateToReward = async () => {
        // 定义识别对象
        const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));
        const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测
        let advanceNum = 0;//前进次数
        //调整为俯视视野
        middleButtonClick();
        await sleep(800);
        moveMouseBy(0, 1030);
        await sleep(400);
        moveMouseBy(0, 920);
        await sleep(400);
        moveMouseBy(0, 710);
        log.info("开始领奖");
    while (true) {
        // 1. 优先检查是否已到达领奖点
        let captureRegion = captureGameRegion();
        let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
        let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
        // 检测到特点文字则结束！！！ 
        if (rewardResult.text == "接触征讨之花") {
            log.info(`总计前进第${advanceNum}次`);
            log.info("已到达领奖点，检测到文字: " + rewardResult.text);
            return;
        }
        else if(advanceNum > 150){
        log.info(`总计前进第${advanceNum}次`);
        throw new Error('前进时间超时');
        }
        // 2. 未到达领奖点，则调整视野
        for(let i = 0; i < 100; i++){
        captureRegion = captureGameRegion();
        let iconRes = captureRegion.Find(boxIconRo);
        let climbTextArea = captureRegion.DeriveCrop(1685, 1030, 65, 25);
        let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
        // 检查是否处于攀爬状态
        if (climbResult.text == "Space"){
        log.info("检侧进入攀爬状态，尝试脱离");
        keyPress("x");
        await sleep(1000);
        keyDown("a");
        await sleep(800);
        keyUp("a");
        keyDown("w");
        await sleep(800);
        keyUp("w");
        }
        if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {    
            advanceNum++;
            break;
        } else {
            // 小幅度调整
            if(iconRes.y >= 520)  moveMouseBy(0, 920);
            let adjustAmount = iconRes.x < 920 ? -20 : 20;
            let distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
            let scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
            let adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
            moveMouseBy(adjustAmount * adjustAmount2, 0);
            await sleep(100);
        }     
  if(i > 20) throw new Error('视野调整超时');
    }
        // 3. 前进一小步
        keyDown("w");
        await sleep(200);
        keyUp("w");

    }
}

//检查是否为正整数
function positiveIntegerJudgment(testNumber) {
    // 如果输入是字符串，尝试转换为数字
    if (typeof testNumber === 'string') {
        // 移除可能存在的非数字字符（如空格、百分号等）
        const cleaned = testNumber.replace(/[^\d]/g, '');
        testNumber = parseInt(cleaned, 10);
    }
    
    // 检查是否为有效的数字
    if (typeof testNumber !== 'number' || isNaN(testNumber)) {
        return 0;
    }
    
    // 检查是否为整数
    if (!Number.isInteger(testNumber)) {
        return 0;
    }
    
    return testNumber;
}

async function queryStaminaValue() {
    try {
        await genshin.returnMainUi();
        await sleep(2500);
        keyPress("F1"); 
        await sleep(1000);
	    await clickTextInRegion("讨伐",0,0,700,1000);
        await sleep(500);
        click(1570, 203);
        await sleep(800);
        let captureRegion = captureGameRegion();
        let stamina = captureRegion.find(RecognitionObject.ocr(1580, 20, 210, 55));
        log.info(`OCR原始文本：${stamina.text}`);
        const staminaText = stamina.text.replace(/\s/g, ''); // 移除所有空格
         const standardMatch = staminaText.match(/(\d+)/);
            if (standardMatch) {
                const currentValue = standardMatch[1];
                let validatedStamina = positiveIntegerJudgment(currentValue);
                if (validatedStamina > 11200) validatedStamina = (validatedStamina-1200)/10000;
           log.info(`返回体力值：${validatedStamina}`);
           return validatedStamina;
            }       
    } catch (error) {
        log.error(`体力识别失败：${error.message}，默认为零`);
        await genshin.returnMainUi();
        return 0;
    }      
}

//检测传送结束  await tpEndDetection();
async function tpEndDetection() {
    const region1 = RecognitionObject.ocr(1690, 230, 75, 350);// 队伍名称区域
    const region2 = RecognitionObject.ocr(872, 681, 180, 30);// 点击任意处关闭
    let tpTime = 0;
    await sleep(1500);//点击传送后等待一段时间避免误判
    //最多30秒传送时间
    while (tpTime < 300) {

        let capture = captureGameRegion();
        let res1 = capture.find(region1);
        let res2 = capture.find(region2);
        if (!res1.isEmpty()|| !res2.isEmpty()){
            log.info("传送完成");
            await sleep(1000);//传送结束后有僵直
            click(960, 810);//点击任意处
            await sleep(500);
            return;
        } 
        tpTime++;
        await sleep(100);
    }
    throw new Error('传送时间超时');
}

/**
 * 自动导航直到检测到指定文字
 * @param {Object} options 配置选项
 * @param {number} [options.x=1210] 检测区域左上角x坐标
 * @param {number} [options.y=515] 检测区域左上角y坐标
 * @param {number} [options.width=200] 检测区域宽度
 * @param {number} [options.height=50] 检测区域高度
 * @param {string|RegExp} [options.targetText="奖励"] 要检测的目标文字
 * @param {number} [options.maxSteps=100] 最大检查次数
 * @param {number} [options.stepDuration=200] 每步前进持续时间(ms)
 * @param {number} [options.waitTime=10] 单次等待时间(ms)
 * @param {string} [options.moveKey="w"] 前进按键
 * @param {boolean} [options.ifClick=false] 是否点击
 * @returns {Promise<void>}
 * await repeatOperationUntilTextFound();  默认F区域检测到任何文字即停止前进
 * await repeatOperationUntilTextFound({targetText: "日落果"});  F区域检测到指定文字即停止前进
 *await repeatOperationUntilTextFound({x: 10,y: 10,width: 100,height: 100,targetText: "奖励",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
 */
const repeatOperationUntilTextFound = async ({
    //默认区域为单个F图标右边的文字，最多6个
    x = 1210,
    y = 515,
    width = 200,
    height = 50,
    targetText = null,
    maxSteps = 100,
    stepDuration = 200,
    waitTime = 10,
    moveKey = "w",
    ifClick = false,
} = {}) => {
    /**
     * 转义正则表达式中的特殊字符
     * @param {string} string 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // 预编译正则表达式（如果是字符串则转换并转义）
    const textPattern = typeof targetText === 'string' 
        ? new RegExp(escapeRegExp(targetText)) 
        : targetText;
    
    let stepsTaken = 0;
    
    while (stepsTaken <= maxSteps) {
        // 1. 捕获游戏区域并裁剪出检测区域
        const captureRegion = captureGameRegion();
        const textArea = captureRegion.DeriveCrop(x, y, width, height);
        
        // 2. 执行OCR识别
        const ocrResult = textArea.find(RecognitionObject.ocrThis);
        
        const hasAnyText = ocrResult.text.trim().length > 0;
        const matchesTarget = targetText === null 
            ? hasAnyText 
            : textPattern.test(ocrResult.text);

        if (matchesTarget) {
            log.info(`检测到${targetText === null ? '文字' : '目标文字'}: ${ocrResult.text}`);
            await sleep(500);
            if (ifClick) click(Math.round(x + width / 2), Math.round(y + height / 2));
            return true;
        }
        
        // 4. 检查步数限制
        if (stepsTaken >= maxSteps) {
            throw new Error(`检查次数超过最大限制: ${maxSteps}，未查询到文字"${targetText}"`);
        }
        
        // 5. 前进一小步
        if (stepDuration != 0) {
        keyDown(moveKey);
        await sleep(stepDuration);
        keyUp(moveKey);
        }
        await sleep(waitTime);
        stepsTaken++;
    }
}

/**
 * 等待图片出现并点击
 * @param {string} imageName 图片名称（不带.png后缀且在assets文件中）
 * @param {number} [timeout=10000] 超时时间（毫秒），默认10秒
 * @param {number} [checkInterval=500] 检查间隔（毫秒），默认500毫秒
 * @returns {Promise<void>}
 * @throws 如果超时未找到图片则抛出错误
 */
// 使用示例：
// await waitAndClickImage("paimon_menu");
//
// (2) 自定义偏移量
// await waitAndClickImage("confirm_button", 700, 0);
const waitAndClickImage = async (
    imageName,
    extraWidth = 0,
    extraHeight = 0,
    ifClick = true,
    timeout = 10000,
    checkInterval = 500,
threshold = 0.8 // 新增阈值参数，默认值0.8
) => {
    const startTime = Date.now();
    const imagePath = `assets/${imageName}.png`;
    
    // 读取模板图片
    const templateMat = file.ReadImageMatSync(imagePath);
    // 创建识别对象，使用默认阈值0.8
    const recognitionObj = RecognitionObject.TemplateMatch(templateMat, 0, 0, 1920, 1080);
    recognitionObj.threshold = threshold;
    while (Date.now() - startTime < timeout) {
        // 捕获游戏区域
        const captureRegion = captureGameRegion();
        // 查找图片
        const result = captureRegion.Find(recognitionObj);
        
        if (!result.isEmpty()) {
            log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
            if (ifClick) click(result.x+extraWidth,result.y+extraHeight);
            await sleep(300); // 点击后稍作等待
            return true;
        }
        
        await sleep(checkInterval);
    }
    
    throw new Error(`等待图片 ${imageName} 超时`);
}

/**
 * 在游戏画面中查找指定图片并在其附近进行OCR识别
 * @param {string} imagePath - 模板图片路径
 * @param {number} ocrWidth - OCR区域宽度
 * @param {number} ocrHeight - OCR区域高度
 * @param {number} offsetX - OCR区域相对于模板匹配结果的X偏移
 * @param {number} offsetY - OCR区域相对于模板匹配结果的Y偏移
 * @returns {Promise<string|boolean>} - 返回OCR识别结果，失败返回false
 */
async function findImageAndOCR(imagePath, ocrWidth, ocrHeight, offsetX, offsetY) {
    try {
        // 1. 读取模板图片并创建识别对象
        const templateMat = file.ReadImageMatSync(imagePath);
        const templateRo = RecognitionObject.TemplateMatch(templateMat);
        
        // 2. 捕获游戏区域并查找模板图片
        const captureRegion = captureGameRegion();
        const foundRegion = captureRegion.Find(templateRo);
        
        if (foundRegion.isEmpty()) {
            log.info(`未找到模板图片: ${imagePath}`);
            return false;
        }
        
        log.info("找到模板图片，位置({x},{y})", foundRegion.x, foundRegion.y);
        
        // 3. 计算OCR区域位置（基于模板匹配结果的位置+偏移量）
        const ocrX = foundRegion.x + offsetX;
        const ocrY = foundRegion.y + offsetY;
        
        // 4. 创建OCR识别对象并识别
        const ocrRo = RecognitionObject.Ocr(ocrX, ocrY, ocrWidth, ocrHeight);
        const ocrResult = captureRegion.Find(ocrRo);
        
        if (ocrResult.isEmpty() || !ocrResult.text || ocrResult.text.trim() === "") {
            log.info("OCR未识别到内容");
            return false;
        }
        
        log.info("OCR识别结果: {text}", ocrResult.text);
        return ocrResult.text.trim();
        
    } catch (error) {
        log.error("识别过程中出错: {error}", error);
        return false;
    }
}


//前往刷天赋书或者武器(必须保证在材料介绍页面)await gotoAutoDomain(imageName = "weaponDomain");
async function gotoAutoDomain(imageName = "bookDomain") {
await sleep(1000);
moveMouseTo(960, 580);//重置鼠标位置,居中
leftButtonDown();
            await sleep(500);
            moveMouseTo(965, 700);
            await sleep(500);
            moveMouseTo(961, 300);
            await sleep(500);
            leftButtonUp();
            await sleep(500);
            moveMouseTo(50, 50);//移动鼠标到左上角，避免检测失败
            await sleep(400);

await waitAndClickImage(imageName);
    try {
 await repeatOperationUntilTextFound({x: 1640,y: 960,width: 200,height: 100,targetText: "传送",stepDuration: 0, maxSteps:25, waitTime:100,ifClick: true});//用来等待点击文字,10s等待
    } catch (error) {
     log.info("秘境未开启");
     await genshin.returnMainUi();
     throw new Error(`秘境未在开启时间，跳过执行`);
 } 
log.info("开始前往天赋本秘境");
await sleep(1000);
await tpEndDetection();
await sleep(3000);//枫丹天赋材料本门口有水晶碟，可能影响
await repeatOperationUntilTextFound();
keyPress("F");
await sleep(2000);
await dispatcher.runTask(new SoloTask("AutoDomain", {  SpecifyResinUse: true,  
// 原粹树脂刷取次数  
OriginalResinUseCount: 1,   
// 浓缩树脂刷取次数    
CondensedResinUseCount: 0,  
// 须臾树脂刷取次数  
TransientResinUseCount: 0,   
// 脆弱树脂刷取次数  
FragileResinUseCount: 0  
}));
}
// 技能书与国家、行列位置的映射
const bookToPosition = {
    // 蒙德
    "自由": {country: "蒙德天赋", row: 0},
    "抗争": {country: "蒙德天赋", row: 1},
    "诗文": {country: "蒙德天赋", row: 2},
    // 璃月
    "繁荣": {country: "璃月天赋", row: 0},
    "勤劳": {country: "璃月天赋", row: 1},
    "黄金": {country: "璃月天赋", row: 2},
    // 稻妻
    "浮世": {country: "稻妻天赋", row: 0},
    "风雅": {country: "稻妻天赋", row: 1},
    "天光": {country: "稻妻天赋", row: 2},
    // 须弥
    "净言": {country: "须弥天赋", row: 0},
    "巧思": {country: "须弥天赋", row: 1},
    "笃行": {country: "须弥天赋", row: 2},
    // 枫丹
    "公平": {country: "枫丹天赋", row: 0},
    "正义": {country: "枫丹天赋", row: 1},
    "秩序": {country: "枫丹天赋", row: 2},
    // 纳塔
    "角逐": {country: "纳塔天赋", row: 0},
    "焚燔": {country: "纳塔天赋", row: 1},
    "纷争": {country: "纳塔天赋", row: 2},
    //挪德卡莱
    "浪迹": {country: "挪德卡莱天赋", row: 2},
    "乐园": {country: "挪德卡莱天赋", row: 1},
    "月光": {country: "挪德卡莱天赋", row: 0},
    // 至冬
    "慈爱": {country: "至冬天赋", row: 0},
    "坚忍": {country: "至冬天赋", row: 1},
    "荣光": {country: "至冬天赋", row: 2},
};

// 品质对应的列位置
const qualityPositions = [
    {x: 1101, y: 0}, // 绿色 (0,0)
    {x: 1180, y: 0}, // 蓝色 (0,1)
    {x: 1260, y: 0}  // 紫色 (0,2)
];

// 武器材料与国家、行列位置的映射
const weaponMaterialToPosition = {
    // 蒙德
    "高塔孤王": {country: "蒙德武器", row: 0},
    "凛风奔狼": {country: "蒙德武器", row: 1},
    "狮牙斗士": {country: "蒙德武器", row: 2},
    // 璃月
    "孤云寒林": {country: "璃月武器", row: 0},
    "雾海云间": {country: "璃月武器", row: 1},
    "漆黑陨铁": {country: "璃月武器", row: 2},
    // 稻妻
    "远海夷地": {country: "稻妻武器", row: 0},
    "鸣神御灵": {country: "稻妻武器", row: 1},
    "今昔剧话": {country: "稻妻武器", row: 2},
    // 须弥
    "谧林涓露": {country: "须弥武器", row: 0},
    "绿洲花园": {country: "须弥武器", row: 1},
    "烈日威权": {country: "须弥武器", row: 2},
    // 枫丹
    "幽谷弦音": {country: "枫丹武器", row: 0},
    "纯圣露滴": {country: "枫丹武器", row: 1},
    "无垢之海": {country: "枫丹武器", row: 2},
    // 纳塔
    "贡祭炽心": {country: "纳塔武器", row: 0},
    "谵妄圣主": {country: "纳塔武器", row: 1},
    "神合秘烟": {country: "纳塔武器", row: 2},
    //挪德卡莱
    "终北遗嗣": {country: "挪德卡莱武器", row: 2},
    "长夜燧火": {country: "挪德卡莱武器", row: 1},
    "奇巧秘器": {country: "挪德卡莱武器", row: 0},
    // 至冬
    "苍星军势": {country: "至冬武器", row: 0},
    "藏窖灵浆": {country: "至冬武器", row: 1},
    "凛雪帝皇": {country: "至冬武器", row: 2},	
	
};

// 武器材料品质对应的列位置和品质名称（4种品质）
const weaponQualityPositions = [
    {x: 1096, y: 0, quality: "绿色"}, // (0,0)
    {x: 1178, y: 0, quality: "蓝色"}, // (0,1)
    {x: 1259, y: 0, quality: "紫色"}, // (0,2)
    {x: 1341, y: 0, quality: "金色"}  // (0,3)
];


/**
 * 获取指定技能书的材料数量
 * @param {string} bookName 技能书名称
 * @returns {Array<number>} 返回一个包含三个数字的数组，分别代表绿色、蓝色、紫色品质的材料数量
 */
async function getMaterialCount(bookName) {
    // 检查输入的技能书名称是否有效
    if (!bookToPosition.hasOwnProperty(bookName)) {
        log.error("无效的技能书名称: " + bookName);
        return [0, 0, 0];
    }
    
    const {country, row} = bookToPosition[bookName];
    const results = [0, 0, 0];
    
    try {
        await genshin.returnMainUi();
        await sleep(500);
        keyPress("F1");
        await clickTextInRegion("秘境",0,0,700,1000);
		await clickTextInRegion("天赋突破素材",510,0,960,1000);
        // 1. 进入对应国家的副本
        log.info(`正在点击${country}副本...`);
        moveMouseTo(1600, 320);
	    await waitAndClickImage1(country,true,30000,700,35,true,10);
        // 等待加载
        await sleep(500);
        
        // 2. 遍历三种品质的材料
        for (let col = 0; col < 3; col++) {
            // 计算点击位置 (使用你提供的点位信息)
            const clickX = qualityPositions[col].x;
            const clickY = 504 + row * 105; // 每行间隔约105像素
            
            // 点击材料
            log.info(`点击位置: (${clickX}, ${clickY})`);
            click(clickX, clickY);
            
            // 等待材料详情界面加载
            await sleep(400);
            
            // 3. OCR识别数量
            const result = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
            if (result !== false) {
                const quantity = positiveIntegerJudgment(result);
                results[col] = quantity;
                log.info(`识别到${["绿色", "蓝色", "紫色"][col]}品质材料数量: ${quantity}`);
            } else {
                log.warn("识别失败，将重试...");
                // 简单重试机制
                click(clickX, clickY);
                await sleep(1500);
                const retryResult = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                results[col] = retryResult !== false ? positiveIntegerJudgment(retryResult) : 0;
            }
            
            // 4. 点击空白处返回
            if( col != 2 ) click(800, 10);
            await sleep(1000);
        }
        
        return results;
    } catch (error) {
        log.error("获取材料数量时出错: " + error);
        // 出错时尝试返回
        return results;
    }
}



/**
 * 获取指定武器材料的数量
 * @param {string} materialName 武器材料名称
 * @returns {Array<number>} 返回一个包含四个数字的数组，分别代表绿色、蓝色、紫色、金色品质的材料数量
 */
async function getWeaponMaterialCount(materialName) {
    // 检查输入的武器材料名称是否有效
    if (!weaponMaterialToPosition.hasOwnProperty(materialName)) {
        log.error("无效的武器材料名称: " + materialName);
        return [0, 0, 0, 0];
    }
    
    const {country, row} = weaponMaterialToPosition[materialName];
    const results = [0, 0, 0, 0];
    
    try {
        await genshin.returnMainUi();
        await sleep(500);
        keyPress("F1");
        await clickTextInRegion("秘境",0,0,700,1000);
		await clickTextInRegion("武器突破素材",510,0,960,1000);
        // 1. 进入对应国家的副本
        log.info(`正在点击${country}副本...`);
		moveMouseTo(1600, 320);
	    await waitAndClickImage1(country,true,30000,700,35,true,10);
        // 等待加载
        await sleep(500);
        
        // 2. 遍历四种品质的材料
        for (let col = 0; col < 4; col++) {
            const {x, y, quality} = weaponQualityPositions[col];
            const clickX = x;
            const clickY = 502 + row * 107; // 每行间隔约107像素
            
            // 点击材料
            log.info(`点击${quality}品质材料位置: (${clickX}, ${clickY})`);
            click(clickX, clickY);
            
            // 等待材料详情界面加载
            await sleep(400);
            
            // 3. OCR识别数量
            const result = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
            if (result !== false) {
                const quantity = positiveIntegerJudgment(result);
                results[col] = quantity;
                log.info(`识别到${quality}品质材料数量: ${quantity}`);
            } else {
                log.warn(`${quality}品质识别失败，将重试...`);
                // 简单重试机制
                click(clickX, clickY);
                await sleep(1500);
                const retryResult = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                results[col] = retryResult !== false ? positiveIntegerJudgment(retryResult) : 0;
            }
            
            // 4. 点击空白处返回
            if( col != 3 ) click(800, 10);
            await sleep(500);
        }
        
        return {
            green: results[0],  // 绿色
            blue: results[1],   // 蓝色
            purple: results[2], // 紫色
            gold: results[3]    // 金色
        };
    } catch (error) {
        log.error("获取武器材料数量时出错: " + error);
        await sleep(1000);
        return {
            green: 0,
            blue: 0,
            purple: 0,
            gold: 0
        };
    }
}

//去刷天赋书
async function getTalentBook(materialName,bookRequireCounts) {
while(1){
log.info(`准备刷取天赋书，开始检查体力`);
let afterStamina = 0;
let res = 9999999;
if(skipCheckStamina)afterStamina = await queryStaminaValue();
if(afterStamina< 20) skipCheckStamina = 0;
    if ( afterStamina >= 20 ){       
             try {
             log.info(`体力充足，开始检测物品数量`);
             let bookCounts = await getMaterialCount(materialName);
             res = 0.12*(bookRequireCounts[0]-bookCounts[0])+0.36*(bookRequireCounts[1]-bookCounts[1])+(bookRequireCounts[2]-bookCounts[2]);
             if(res>0){
              log.info(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
              await gotoAutoDomain();
             } 
             else {
             addNotification(`${materialName}天赋书数量已经满足要求！！！`);
             await addCompletedTask("talent", materialName, bookRequireCounts);
             return;
              }
             }
             catch (error) {  
             notification.send(`${materialName}天赋书刷取失败，错误信息: ${error}`);
             await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
             if (error.message != '秘境未在开启时间，跳过执行'){
             let bookCounts = await getMaterialCount(materialName);
             res = 0.12*(bookRequireCounts[0]-bookCounts[0])+0.36*(bookRequireCounts[1]-bookCounts[1])+(bookRequireCounts[2]-bookCounts[2]);
             }
              addNotification(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
             return;
       }
     }
       else{
             log.info(`体力值为${afterStamina},可能无法刷取${materialName}天赋书`);
             const bookCounts = await getMaterialCount(materialName);
             let res = 0.12*(bookRequireCounts[0]-bookCounts[0])+0.36*(bookRequireCounts[1]-bookCounts[1])+(bookRequireCounts[2]-bookCounts[2]);
             if(res <= 0){
             await addCompletedTask("talent", materialName, bookRequireCounts);
             addNotification(`${materialName}天赋书数量已经满足要求！！！`);
             } 
             else addNotification(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
             return;
         }
}
}

//去刷武器材料
async function getWeaponMaterial(materialName,weaponRequireCounts) {
while(1){
log.info(`准备刷取武器材料，开始检查体力`);
let afterStamina = 0;
let res = 99999999;
if(skipCheckStamina)afterStamina = await queryStaminaValue();
if(afterStamina< 20) skipCheckStamina = 0;
    if ( afterStamina >= 20 ){       
             try {
             log.info(`体力充足，开始检测物品数量`);
             let weaponCounts = await getWeaponMaterialCount(materialName);
             res = 0.12*(weaponRequireCounts[0]-weaponCounts.green)+0.36*(weaponRequireCounts[1]-weaponCounts.blue)+(weaponRequireCounts[2]-weaponCounts.purple)+3*(weaponRequireCounts[3]-weaponCounts.gold);
             if(res>0){
              log.info(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
              await gotoAutoDomain("weaponDomain");
             } 
             else {
             addNotification(`武器材料${materialName}数量已经满足要求！！！`);
             await addCompletedTask("wepon", materialName, weaponRequireCounts);
             return;
             }
             }
             catch (error) {  
             addNotification(`武器材料${materialName}刷取失败，错误信息: ${error}`);
             await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
             if (error.message != '秘境未在开启时间，跳过执行'){
             const weaponCounts = await getWeaponMaterialCount(materialName);
             res = 0.12*(weaponRequireCounts[0]-weaponCounts.green)+0.36*(weaponRequireCounts[1]-weaponCounts.blue)+(weaponRequireCounts[2]-weaponCounts.purple)+3*(weaponRequireCounts[3]-weaponCounts.gold);
             }
             addNotification(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
             return;
             }
       }
       else{
             log.info(`体力值为${afterStamina},可能无法刷取武器材料${materialName}`);
             const weaponCounts = await getWeaponMaterialCount(materialName);
             let res = 0.12*(weaponRequireCounts[0]-weaponCounts.green)+0.36*(weaponRequireCounts[1]-weaponCounts.blue)+(weaponRequireCounts[2]-weaponCounts.purple)+3*(weaponRequireCounts[3]-weaponCounts.gold);
             if(res <= 0){
             await addCompletedTask("wepon", materialName, weaponRequireCounts);
             addNotification(`武器材料${materialName}数量已经满足要求！！！`);
             } 
             else addNotification(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
             return;
         }
}
}

const bossNameSum = [
    "超重型陆巡舰·机动战垒",
    "不灭衍生造物",
];

//去刷boss材料
async function getBossMaterial(bossName,bossRequireCounts) {
while(1){
log.info(`准备刷取 boss 材料，开始检查体力`);
let afterStamina = 0;
let res = 99999999;
if(skipCheckStamina)afterStamina = await queryStaminaValue();
if(afterStamina< 20) skipCheckStamina = 0;
    if ( afterStamina >= 40 ){       
             try {
             log.info(`体力充足，开始检测物品数量`);
             let bossCounts = await getBossMaterialCount(bossName);
             res = bossRequireCounts-bossCounts;
             if(res>0){
                     log.info(`${bossName}还差${res}个材料没有刷取`);
                     if(!settings.teamName) throw new Error('未输入队伍名称');
                     await genshin.returnMainUi();
					
                     if(settings.energyMax) await restoredEnergy();
                     else await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
					 await genshin.switchParty(settings.teamName);
					 await sleep(1000);
                     log.info(`前往讨伐${bossName}`);
                     await pathingScript.runFile(`assets/goToBoss/${bossName}前往.json`);
					 if (bossNameSum.includes(bossName)) await keyMouseScript.runFile(`assets/goToBoss/${bossName}前往键鼠.json`);
					
					 
                     await sleep(100);
                     log.info(`开始战斗`);
                     try {
                         await dispatcher.runTask(new SoloTask("AutoFight"));
                     } catch (error) {
                         //失败后最多只挑战一次，因为两次都打不过，基本上没戏，干脆直接报错结束
                         log.info(`挑战失败，再来一次`);
                         await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
                         await pathingScript.runFile(`assets/goToBoss/${bossName}前往.json`);
                         if (bossNameSum.includes(bossName)) await keyMouseScript.runFile(`assets/goToBoss/${bossName}前往键鼠.json`);
                         await dispatcher.runTask(new SoloTask("AutoFight"));
                     }
                     await sleep(1000);
                     log.info(`战斗结束，开始领奖`);
                     await autoNavigateToReward();//前往地脉之花
                     await sleep(600);
                     keyPress("F");
                     await sleep(800);
                     click(968, 759);//消耗树脂领取
                     await sleep(3000);
                     click(975, 1000);//点击空白区域
                     await sleep(1000);//等待 boss 刷新
                     await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
                     log.info(`首领讨伐结束`);
             }
             else {
                     addNotification(`${bossName}材料数量已经满足要求！！！`);
                     await addCompletedTask("boss", bossName, bossRequireCounts);
                     return;
                     }
             }
             catch (error) {  
             addNotification(`${bossName}刷取失败，错误信息: ${error}`);
             await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
             return;
             }
       }
       else{
             log.info(`体力值为${afterStamina},可能无法刷取首领材料${bossName}`);
             const bossCounts = await getBossMaterialCount(bossName);
             let res = bossRequireCounts-bossCounts;
             if(res>0) addNotification(`${bossName}还差${res}个材料没有刷取`);
             else {
                     addNotification(`${bossName}材料数量已经满足要求！！！`);
                     await addCompletedTask("boss", bossName, bossRequireCounts);
             }
             return;
         }
}
}


(async function () {

if(!settings.unfairContractTerms) throw new Error('未签署霸王条款，无法使用');
const completedTasks = await loadCompletedTasks();
log.info(`已加载 ${Object.keys(completedTasks).length} 个已完成任务记录`);
// 数量填写模式：settings.useLevelCalc 为「选择等级计算」时才启用等级换算
// 兼容旧配置：老版本这里是 checkbox(true/false)，true 等价于「选择等级计算」
const levelMode = settings.useLevelCalc;
const useLevelCalc = (levelMode === '选择等级计算') || (levelMode === true);
log.info(useLevelCalc ? '【模式】根据等级/状态自动计算数量' : '【模式】手动填写数量');

// 手动模式下若用户误填了等级字段，给出明确提示，避免「选了等级却没生效」的困惑
warnIfLevelFieldsIgnored(useLevelCalc, [
    ['天赋书1 当前等级', settings.talentCurrent0], ['天赋书1 目标等级', settings.talentTarget0],
    ['天赋书2 当前等级', settings.talentCurrent1], ['天赋书2 目标等级', settings.talentTarget1],
    ['天赋书3 当前等级', settings.talentCurrent2], ['天赋书3 目标等级', settings.talentTarget2],
    ['武器1 星级', settings.weaponStar0], ['武器1 当前情况', settings.weaponCurrent0], ['武器1 目标情况', settings.weaponTarget0],
    ['武器2 星级', settings.weaponStar1], ['武器2 当前情况', settings.weaponCurrent1], ['武器2 目标情况', settings.weaponTarget1],
    ['武器3 星级', settings.weaponStar2], ['武器3 当前情况', settings.weaponCurrent2], ['武器3 目标情况', settings.weaponTarget2],
    ['首领1 当前情况', settings.bossCurrent0], ['首领1 目标情况', settings.bossTarget0],
    ['首领2 当前情况', settings.bossCurrent1], ['首领2 目标情况', settings.bossTarget1],
    ['首领3 当前情况', settings.bossCurrent2], ['首领3 目标情况', settings.bossTarget2],
]);

for (let i = 0; i < 3; i++) {

const talentBookName = eval(`settings.talentBookName${i}`);
if(talentBookName != "无" && talentBookName){
try{
let bookRequireCounts;
if (useLevelCalc) {
    const talentCurrent = eval(`settings.talentCurrent${i}`) || "1-1-1";
    const talentTarget  = eval(`settings.talentTarget${i}`)  || "1-1-1";
    bookRequireCounts = calculateTalentBookCounts(talentCurrent, talentTarget);
    log.info(`天赋书${i+1}【${talentBookName}】技能 ${talentCurrent} → ${talentTarget}，原始需 绿-蓝-紫 = ${bookRequireCounts.join('-')}`);
} else {
    bookRequireCounts = parseManualCounts(eval(`settings.talentBookRequireCounts${i}`), 3);
    log.info(`天赋书${i+1}【${talentBookName}】手动数量 绿-蓝-紫 = ${bookRequireCounts.join('-')}`);
}
const isCompleted = await isTaskCompleted("talent", talentBookName, bookRequireCounts);
if (isCompleted){addNotification(`天赋书${talentBookName} 已刷取至目标数量，跳过执行`);} 
else await getTalentBook(talentBookName,bookRequireCounts);
}
catch (error) {  notification.send(`天赋书${talentBookName}刷取失败，错误信息: ${error}`);}
}
else log.info(`没有选择刷取天赋书${i+1}，跳过执行`);
}


for (let i = 0; i < 3; i++) {
const weaponName = eval(`settings.weaponName${i}`);
if(weaponName != "无" && weaponName){
try{
let weaponRequireCounts;
if (useLevelCalc) {
    const weaponStar    = eval(`settings.weaponStar${i}`)    || "四星";
    const weaponCurrent = eval(`settings.weaponCurrent${i}`) || "无";
    const weaponTarget  = eval(`settings.weaponTarget${i}`)  || "无";
    if (weaponStar === "无") {
        log.info(`武器材料${i+1}【${weaponName}】星级未选择（为「无」），视为无需刷取，跳过执行`);
        weaponRequireCounts = null;
    } else if (weaponTarget === "无") {
        log.info(`武器材料${i+1}【${weaponName}】目标情况未选择（为「无」），视为无需刷取，跳过执行`);
        weaponRequireCounts = null;
    } else {
        weaponRequireCounts = calculateWeaponMaterialCounts(weaponStar, weaponCurrent, weaponTarget);
        log.info(`武器材料${i+1}【${weaponName}】${weaponStar} ${weaponCurrent} → ${weaponTarget}，原始需 绿-蓝-紫-金 = ${weaponRequireCounts.join('-')}`);
    }
} else {
    weaponRequireCounts = parseManualCounts(eval(`settings.weaponMaterialRequireCounts${i}`), 4);
    log.info(`武器材料${i+1}【${weaponName}】手动数量 绿-蓝-紫-金 = ${weaponRequireCounts.join('-')}`);
}
if (weaponRequireCounts) {
    const isCompleted = await isTaskCompleted("wepon", weaponName, weaponRequireCounts);
    if (isCompleted){addNotification(`武器材料${weaponName} 已刷取至目标数量，跳过执行`);} 
    else await getWeaponMaterial(weaponName,weaponRequireCounts);
}
}
catch (error) {  notification.send(`武器材料${weaponName}刷取失败，错误信息: ${error}`);}
}
else log.info(`没有选择刷取武器材料${i+1}，跳过执行`);
}

for (let i = 0; i < 3; i++) {
const bossName = eval(`settings.bossName${i}`);
if(bossName != "无" && bossName){
try{
let bossRequireCounts;
if (useLevelCalc) {
    const bossCurrent = eval(`settings.bossCurrent${i}`) || "无";
    const bossTarget  = eval(`settings.bossTarget${i}`)  || "无";
    if (bossTarget === "无") {
        log.info(`首领材料${i+1}【${bossName}】目标情况未选择（为「无」），视为无需刷取，跳过执行`);
        bossRequireCounts = 0;
    } else {
        bossRequireCounts = calculateBossCount(bossCurrent, bossTarget);
        log.info(`首领材料${i+1}【${bossName}】角色 ${bossCurrent} → ${bossTarget}，需 ${bossRequireCounts} 个`);
    }
} else {
    bossRequireCounts = parseManualCounts(eval(`settings.bossRequireCounts${i}`), 1)[0];
    log.info(`首领材料${i+1}【${bossName}】手动数量 = ${bossRequireCounts}`);
}
if (bossRequireCounts <= 0) { addNotification(`首领材料${bossName} 无需刷取，跳过`); }
else {
const isCompleted = await isTaskCompleted("boss", bossName, bossRequireCounts);
if (isCompleted){addNotification(`首领材料${bossName} 已刷取至目标数量，跳过执行`);} 
else await getBossMaterial(bossName,bossRequireCounts);
}
}
catch (error) {  notification.send(`首领材料${bossName}刷取失败，错误信息: ${error}`);}
}
else log.info(`没有选择挑战首领${i+1}，跳过执行`);
}

sendBufferedNotifications();//发送累积的完成信息

})();

