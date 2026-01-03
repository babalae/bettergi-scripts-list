/* ===== 强制模板匹配拾取（BEGIN） ===== */
let targetItems = [];
let blacklist = [];
let blacklistSet = new Set();
let gameRegion;
let state = { running: true };
state.runPickupLog = [];   // 本次路线运行中拾取/交互的物品明细
const rollingDelay = 32;
const pickupDelay = 100;
const timeMoveUp = Math.round((settings.timeMove || 1000) * 0.45);
const timeMoveDown = Math.round((settings.timeMove || 1000) * 0.55);
const targetItemPath = "assets/targetItems";
const mainUITemplate = file.ReadImageMatSync("assets/MainUI.png");
const itemFullTemplate = file.ReadImageMatSync("assets/itemFull.png");
const fIcontemplate = file.ReadImageMatSync("assets/F_Dialogue.png");
const accountName = settings.infoFileName || "默认账户";
let currentParty = '';

// 定义目标文件夹路径和记录文件路径
const recordFolder = "record"; // 存储记录文件的文件夹路径
const defaultTimeStamp = "2023-10-13T00:00:00.000Z"; // 固定的时间戳
let pickupRecordFile;
const MAX_PICKUP_DAYS = 30;

// 从 settings 中读取用户配置，并设置默认值
const userSettings = {
    operationMode: settings.operationMode || "执行任务（若不存在索引文件则自动创建）",
    pathGroup1CdType: settings.pathGroup1CdType || "",
    pathGroup2CdType: settings.pathGroup2CdType || "",
    pathGroup3CdType: settings.pathGroup3CdType || "",
    otherPathGroupsCdTypes: settings.otherPathGroupsCdTypes || "",
    partyNames: settings.partyNames || "",
    skipTimeRanges: settings.skipTimeRanges || "",
    infoFileName: settings.infoFileName || "默认账户",
    disableJsons: settings.disableJsons || ""
};

let ingredientProcessingFood = settings.ingredientProcessingFood;
let foodCounts = settings.foodCount;

let firstCook = true;
let firstsettime = true;
let lastCookTime = new Date();
let lastsettimeTime = new Date();

// 解析禁用名单
let disableArray = [];
if (userSettings.disableJsons) {
    tmp = userSettings.disableJsons.split('；');
    for (k = 0; k < tmp.length; k++) {
        s = tmp[k].trim();
        if (s) disableArray[disableArray.length] = s;
    }
}

// 将 partyNames 分割并存储到一个数组中
const partyNamesArray = userSettings.partyNames.split(";").map(name => name.trim());

// 新增一个数组 pathGroupCdType，存储每个路径组的 cdtype 信息
const pathGroupCdType = [
    userSettings.pathGroup1CdType,
    userSettings.pathGroup2CdType,
    userSettings.pathGroup3CdType
];

// 如果 otherPathGroupsCdTypes 不为空，将其分割为数组并添加到 pathGroupCdType 中
if (userSettings.otherPathGroupsCdTypes) {
    pathGroupCdType.push(...userSettings.otherPathGroupsCdTypes.split(";"));
}

// 当infoFileName为空时，将其改为由其他自定义配置决定的一个字符串
if (!userSettings.infoFileName) {
    userSettings.infoFileName = [
        userSettings.pathGroup1CdType,
        userSettings.pathGroup2CdType,
        userSettings.pathGroup3CdType,
        userSettings.otherPathGroupsCdTypes,
    ].join(".");
}

let findFInterval = (+settings.findFInterval || 100);
if (findFInterval < 16) {
    findFInterval = 16;
}
if (findFInterval > 200) {
    findFInterval = 200;
}
let lastRoll = new Date();
let checkDelay = Math.round(findFInterval / 2);

let Foods = [];
let foodCount = [];

const FiconRo = RecognitionObject.TemplateMatch(fIcontemplate, 1102, 335, 34, 400);
FiconRo.Threshold = 0.95;
FiconRo.InitTemplate();

const mainUiRo = RecognitionObject.TemplateMatch(mainUITemplate, 0, 0, 150, 150);

let underWater = false;

let checkInterval = +settings.checkInterval || 50;

(async function () {
    /* ===== 零基构建 settings.json（BEGIN） ===== */
    const SETTINGS_FILE = `settings.json`;
    const PATHINGS_ROOT = `pathing`;

    /* 1. 扫描 pathing 下第一层目录 */
    const filesInFolder = file.ReadPathSync(PATHINGS_ROOT);
    const subFolders = []; // 用于存储第一层文件夹路径
    for (const filePath of filesInFolder) {
        if (file.IsFolder(filePath)) {
            // 如果是文件夹，先存储到临时数组中
            subFolders.push(filePath);
        }
    }

    /* 2. 提取文件夹名称 */
    const firstLevelDirs = subFolders
        .map(folderPath => folderPath.replace(`${PATHINGS_ROOT}/`, '').replace(`${PATHINGS_ROOT}\\`, '')) // 去掉前缀 `pathing/` 或 `pathing\`
        .filter(Boolean); // 去掉空字符串

    let uniqueDirs = Array.from(new Set(firstLevelDirs)); // 去重

    /* 3. 移除多余的 'pathing' 选项 */
    //uniqueDirs = uniqueDirs.filter(dir => dir !== 'pathing');

    /* 4. 路径组数量 */
    const groupCount = Math.min(99, Math.max(1, parseInt(settings.groupCount || '3')));

    /* 5. 硬编码构建全新 JSON */
    const newSettings = [];

    /* 5.1 最前端：onlyRefresh + groupCount */
    newSettings.push(
        {
            name: "onlyRefresh",
            type: "checkbox",
            label: "勾选后仅刷新自定义配置，不运行"
        },
        {
            name: "groupCount",
            type: "input-text",
            label: "需要生成几个路径组配置（1-99）",
            default: "3"
        },
        {
            name: "enableMoreSettings",
            type: "checkbox",
            label: "勾选后下次运行展开高级设置\n用于进行路线筛选和排序"
        }
    );

    /* 5.2 操作模式 */
    newSettings.push({
        name: "operationMode",
        type: "select",
        label: "选择操作模式",
        options: [
            "执行任务（若不存在索引文件则自动创建）",
            "重新生成索引文件（用于强制刷新CD）"
        ]
    });

    /* 5.3 固定尾部节点（原样照搬） */
    newSettings.push(
        {
            "name": "timeRule",
            "type": "input-text",
            "label": "本地时间-不运行时段\n示例写法：\n  单个小时：8\n  连续区间：8-11 或 23:11-23:55（可省略分钟）\n  多项分隔：用中文逗号【，】\n规则：\n  只写小时：开始=整点，结束=59分；跨天自动识别\n  含分钟：按实际时分计算\n  提前10分钟结束并等待到限制时段开始\n留空=全天可运行"
        },
        {
            "name": "infoFileName",
            "type": "input-text",
            "label": "输入用于存储信息的文件名，只在不同账号分别管理CD时填写"
        },
        {
            "name": "disableJsons",
            "type": "input-text",
            "label": "填写需要禁用的路线的关键词，使用中文分号分隔\n文件路径含有相关关键词的路线会被禁用"
        },
        {
            "name": "findFInterval",
            "type": "input-text",
            "label": "识别间隔(毫秒)\n两次检测f图标之间等待时间",
            "default": "100"
        },
        {
            "name": "ingredientProcessingFood",
            "type": "input-text",
            "label": "食材名称\n用中文逗号，分隔"
        },
        {
            "name": "foodCount",
            "type": "input-text",
            "label": "食材数量\n数量对应上方的食材\n用中文逗号，分隔"
        },
        {
            "name": "checkInterval",
            "type": "input-text",
            "label": "食材加工中的识别间隔(毫秒)，设备反应较慢出现识别错误时适当调大",
            "default": "50"
        },
        {
            "name": "setTimeMode",
            "type": "select",
            "label": "尝试调节时间来获得移速加成\n队伍中含迪希雅、嘉明或塔利雅时选择白天\n队伍中含罗莎莉亚时选择夜晚",
            "options": [
                "不调节时间",
                "尽量调为白天",
                "尽量调为夜晚"
            ],
            "default": "不调节时间"
        }
    );

    if (settings.enableMoreSettings) {
        newSettings.push(
            {
                "name": "priorityItems",
                "type": "input-text",
                "label": "优先采集材料，每天会尝试优先采集指定数量的目标物品，随后才执行路径组\n格式：材料名*数量，由加号+连接\n如萃凝晶*160+甜甜花*10"
            },
            {
                "name": "priorityItemsPartyName",
                "type": "input-text",
                "label": "优先采集材料使用的配队名称"
            },
            {
                "name": "priorityTags",
                "type": "input-text",
                "label": "优先关键词，文件名或拾取材料含关键词的路线会被视为最高效率\n不同关键词使用【中文逗号】分隔"
            },
            {
                "name": "sortMode",
                "type": "select",
                "label": "选择同组路线排序模式",
                "options": [
                    "文件顺序，按在文件夹中位置顺序运行",
                    "优先最早刷新，将优先执行最早刷新的路线",
                    "优先最高效率，将优先执行最高分均拾取物的路线"
                ],
                "default": "文件顺序，按在文件夹中位置顺序运行"
            },
            {
                "name": "defaultEffPercentile",
                "type": "input-text",
                "label": "默认效率指数，范围0-1\n数值越大时，未知效率的路线被视作的默认效率越高",
                "default": "0.5"
            },
            {
                "name": "weightedRule",
                "type": "input-text",
                "label": "加权规则，允许将特定物品视为多倍计算效率\n黑名单物品将自动视为0\n格式如下：\n物品名称*权重\n使用【中文逗号】分隔\n如：甜甜花*2，树莓*0"
            }
        );
    }

    /* 5.4 路径组节点（整体移到最后） */
    for (let g = 1; g <= groupCount; g++) {
        /* 文件夹 */
        newSettings.push({
            name: `pathGroup${g}FolderName`,
            type: "select",
            label: `#############################################\n选择路径组${g}文件夹（pathing下第一层）`,
            options: ["", ...uniqueDirs]
        });

        /* CD类型 */
        newSettings.push({
            name: `pathGroup${g}CdType`,
            type: "select",
            label: `选择路径组${g}CD类型，不选不运行该路径组`,
            options: [
                "",
                "1次0点刷新",
                "2次0点刷新",
                "3次0点刷新",
                "4点刷新",
                "12小时刷新",
                "24小时刷新",
                "46小时刷新"
            ]
        });

        /* 队伍名 */
        newSettings.push({
            name: `pathGroup${g}PartyName`,
            type: "input-text",
            label: `输入路径组${g}使用配队名称`
        });

        if (settings.enableMoreSettings) {
            newSettings.push({
                "name": `pathGroup${g}thresholdEfficiency`,
                "type": "input-text",
                "label": `路径组${g}临界效率\n分均拾取个数效率低于临界效率的路线会被排除`,
                "default": "0"
            });
        }
    }

    /* 6. 一次性写入 & 日志 */
    await file.writeText(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), false);
    log.info(`已全新生成 settings.json，共 ${groupCount} 个路径组配置。`);
    log.info(`扫描到可供选择的文件夹：${uniqueDirs.join(' | ')}`);

    /* 仅刷新模式出口 */
    if (settings.onlyRefresh) {
        settings.onlyRefresh = false;
        return;
    }
    /* ===== 零基构建 settings.json（END） ===== */

    try {
        /* ===== 读取新 settings ===== */
        const groupCount = Math.min(99, Math.max(1, parseInt(settings.groupCount || '3')));
        const folderNames = [];
        const partyNames = [];
        for (let g = 1; g <= groupCount; g++) {
            folderNames.push(settings[`pathGroup${g}FolderName`] || '');
            partyNames.push(settings[`pathGroup${g}PartyName`] || '');
        }

        // 获取子文件夹路径
        const subFolderName = userSettings.infoFileName;
        const subFolderPath = `${recordFolder}/${subFolderName}`;
        pickupRecordFile = `${recordFolder}/${subFolderName}/拾取记录.json`;

        // 读取子文件夹中的所有文件路径
        const filesInSubFolder = file.ReadPathSync(subFolderPath);

        // 检查优先顺序：record.json > record.txt
        let indexDoExist = false;
        let useJson = false;
        for (const filePath of filesInSubFolder) {
            const fileName = basename(filePath);
            if (fileName === "record.json") {
                indexDoExist = true;
                useJson = true;
                break;
            }
            if (fileName === "record.txt") {
                indexDoExist = true;
                useJson = false;
            }
        }

        if (userSettings.operationMode === "重新生成索引文件（用于强制刷新CD）") {
            log.info("重新生成索引文件模式，将覆盖现有索引文件");
        }
        if (!indexDoExist) {
            log.info("文件不存在，将尝试生成索引文件");
        }

        /* 禁用BGI原生拾取，强制模板匹配 */
        targetItems = await loadTargetItems();
        /* ===== 别名索引 ===== */
        const name2Other = new Map();      // 本名 → 别名数组
        const alias2Names = new Map();     // 别名 → 本名数组（支持多对一）
        for (const it of targetItems) {
            const aliases = it.otherName || [];
            name2Other.set(it.itemName, aliases);
            for (const a of aliases) {
                if (!alias2Names.has(a)) alias2Names.set(a, []);
                alias2Names.get(a).push(it.itemName);   // 一个别名可指向多个本名
            }
        }

        await loadBlacklist(true);
        state.running = true;

        await fakeLog("采集cd管理", true, false, 1000);

        // 统一的 record.json 文件路径
        const recordFilePath = `${subFolderPath}/record.json`;

        // 读取 pathing 文件夹下的所有 .json 文件
        const pathingFolder = "pathing";
        const files = await readFolder(pathingFolder, true);
        const filePaths = files.map(file => file.fullPath);

        // ① 先加载已有记录（整对象）
        let recordArray = [];
        if (indexDoExist && useJson) {
            try { recordArray = JSON.parse(await file.readText(recordFilePath)); } catch (e) { }
        } else if (indexDoExist && !useJson) {
            try {
                const txt = await file.readText(`${subFolderPath}/record.txt`);
                txt.trim().split('\n').forEach(line => {
                    const [n, t] = line.trim().split('::');
                    if (n && t) recordArray.push({ fileName: n + '.json', cdTime: t });
                });
            } catch (e) { }
        }

        // ② 建 Map<fileName, 原对象>  确保 history 存在
        const existMap = new Map(recordArray.map(it => [it.fileName, {
            ...it,
            history: it.history || []   // 补空数组
        }]));

        // ③ 对 pathing 里存在的路线：只更新 cdTime，其余保留
        const defaultTime = "1970/1/1 08:00:00";
        for (const filePath of filePaths) {
            const fileName = basename(filePath);
            if (!fileName.endsWith('.json')) continue;

            const old = existMap.get(fileName) || {};
            const newCd = (indexDoExist &&
                userSettings.operationMode !== "重新生成索引文件（用于强制刷新CD）" &&
                old.cdTime)
                ? old.cdTime
                : defaultTime;

            existMap.set(fileName, {
                ...old,          // 保留所有旧字段
                fileName,
                cdTime: newCd,
                history: old.history || []   // 确保有 history
            });
        }

        // ④ 写回（含已消失的路线）
        const writeResult = file.writeTextSync(recordFilePath,
            JSON.stringify(Array.from(existMap.values()), null, 2));

        if (writeResult) {
            log.info(`信息已成功写入: ${recordFilePath}`);
        } else {
            log.error(`写入文件失败: ${recordFilePath}`);
        }

        if (typeof ingredientProcessingFood === 'string' && ingredientProcessingFood.trim()) {
            Foods = ingredientProcessingFood
                .split(/[,，;；\s]+/)          // 支持中英文逗号、分号、空格
                .map(word => word.trim())
                .filter(word => word.length > 0);
        }

        if (typeof foodCounts === 'string' && foodCounts.trim()) {
            foodCount = foodCounts
                .split(/[,，;；\s]+/)
                .map(word => word.trim())
                .filter(word => word.length > 0);
        }

        let cookInterval = 95 * 60 * 1000;
        let settimeInterval = 10 * 60 * 1000;
        // ==================== 优先级材料前置采集 ====================

        if (settings.priorityItems) {
            /* ---------- 1. 解析 ---------- */
            const priorityList = [];
            const segments = settings.priorityItems.split('+').map(s => s.trim());
            for (const seg of segments) {
                const [itemName, countStr] = seg.split('*').map(s => s.trim());
                if (itemName && countStr && !isNaN(Number(countStr))) {
                    priorityList.push({ itemName, count: Number(countStr) });
                }
            }
            log.info(`优先级材料解析完成: ${priorityList.map(e => `${e.itemName}*${e.count}`).join(', ')}`);
            /* ===== 追加：扣除今日已拾取（UTC+8 0 点分界） ===== */
            const utc8 = new Date(Date.now() + 8 * 3600_000);   // 手动+8小时
            const today = utc8.toISOString().slice(0, 10);      // "YYYY-MM-DD"
            let todayPicked = {};                                // 今日已拾取数量
            try {
                const txt = await file.readText(pickupRecordFile);
                if (txt) {
                    const arr = JSON.parse(txt);
                    const todayItem = arr.find(it => it.date === today);
                    if (todayItem) todayPicked = todayItem.items || {};
                }
            } catch (_) { /* 文件不存在或解析失败 */ }

            /* 扣除今日已拾取：双向扣除 */
            for (let i = priorityList.length - 1; i >= 0; i--) {
                const task = priorityList[i];
                let got = 0;

                /* 1. 字面名（可能是别名）直接扣 */
                got += todayPicked[task.itemName] || 0;

                /* 2. 如果字面名是别名，把对应本名也扣一遍 */
                const realNames = alias2Names.get(task.itemName) || [];   // 现在是数组

                for (const n of realNames) got += todayPicked[n] || 0;

                /* 3. 如果字面名是本名，把所有别名再扣一遍 */
                const others = name2Other.get(task.itemName) || [];
                for (const a of others) got += todayPicked[a] || 0;

                task.count -= got;
                if (task.count <= 0) priorityList.splice(i, 1);
            }

            if (priorityList.length === 0) {
                log.info("今日优先材料已达标，跳过优先采集阶段");
            }
            /* ================================= */

            /* ---------- 2. 材料→CD类型 映射表（仅列出现过的，其余默认 1次0点刷新）---------- */
            const materialCdMap = {
                // 46h 特产
                "小灯草": "46小时刷新",
                "嘟嘟莲": "46小时刷新",
                "落落莓": "46小时刷新",
                "塞西莉亚花": "46小时刷新",
                "慕风蘑菇": "46小时刷新",
                "蒲公英籽": "46小时刷新",
                "钩钩果": "46小时刷新",
                "风车菊": "46小时刷新",
                "霓裳花": "46小时刷新",
                "清心": "46小时刷新",
                "琉璃袋": "46小时刷新",
                "琉璃百合": "46小时刷新",
                "夜泊石": "46小时刷新",
                "绝云椒椒": "46小时刷新",
                "星螺": "46小时刷新",
                "石珀": "46小时刷新",
                "清水玉": "46小时刷新",
                "海灵芝": "46小时刷新",
                "鬼兜虫": "46小时刷新",
                "绯樱绣球": "46小时刷新",
                "鸣草": "46小时刷新",
                "珊瑚真珠": "46小时刷新",
                "晶化骨髓": "46小时刷新",
                "血斛": "46小时刷新",
                "天云草实": "46小时刷新",
                "幽灯蕈": "46小时刷新",
                "沙脂蛹": "46小时刷新",
                "月莲": "46小时刷新",
                "帕蒂沙兰": "46小时刷新",
                "树王圣体菇": "46小时刷新",
                "圣金虫": "46小时刷新",
                "万相石": "46小时刷新",
                "悼灵花": "46小时刷新",
                "劫波莲": "46小时刷新",
                "赤念果": "46小时刷新",
                "苍晶螺": "46小时刷新",
                "海露花": "46小时刷新",
                "柔灯铃": "46小时刷新",
                "子探测单元": "46小时刷新",
                "湖光铃兰": "46小时刷新",
                "幽光星星": "46小时刷新",
                "虹彩蔷薇": "46小时刷新",
                "初露之源": "46小时刷新",
                "浪沫羽鳃": "46小时刷新",
                "灼灼彩菊": "46小时刷新",
                "肉龙掌": "46小时刷新",
                "青蜜莓": "46小时刷新",
                "枯叶紫英": "46小时刷新",
                "微光角菌": "46小时刷新",
                "云岩裂叶": "46小时刷新",
                "琉鳞石": "46小时刷新",
                "奇异的「牙齿」": "46小时刷新",

                // 12h 素材
                "兽肉": "12小时刷新",
                "禽肉": "12小时刷新",
                "神秘的肉": "12小时刷新",
                "鱼肉": "12小时刷新",
                "鳗肉": "12小时刷新",
                "螃蟹": "12小时刷新",
                "蝴蝶翅膀": "12小时刷新",
                "青蛙": "12小时刷新",
                "发光髓": "12小时刷新",
                "蜥蜴尾巴": "12小时刷新",
                "晶核": "12小时刷新",
                "鳅鳅宝玉": "12小时刷新",

                // 4点
                "盐": "1次4点刷新",
                "胡椒": "1次4点刷新",
                "洋葱": "1次4点刷新",
                "牛奶": "1次4点刷新",
                "番茄": "1次4点刷新",
                "卷心菜": "1次4点刷新",
                "土豆": "1次4点刷新",
                "小麦": "1次4点刷新",
                "稻米": "1次4点刷新",
                "虾仁": "1次4点刷新",
                "豆腐": "1次4点刷新",
                "杏仁": "1次4点刷新",
                "发酵果实汁": "1次4点刷新",
                "咖啡豆": "1次4点刷新",
                "秃秃豆": "1次4点刷新",

                // 0点
                "甜甜花": "1次0点刷新",
                "胡萝卜": "1次0点刷新",
                "蘑菇": "1次0点刷新",
                "松茸": "1次0点刷新",
                "松果": "1次0点刷新",
                "金鱼草": "1次0点刷新",
                "莲蓬": "1次0点刷新",
                "薄荷": "1次0点刷新",
                "鸟蛋": "1次0点刷新",
                "树莓": "1次0点刷新",
                "白萝卜": "1次0点刷新",
                "苹果": "1次0点刷新",
                "日落果": "1次0点刷新",
                "竹笋": "1次0点刷新",
                "海草": "1次0点刷新",
                "堇瓜": "1次0点刷新",
                "星蕈": "1次0点刷新",
                "墩墩桃": "1次0点刷新",
                "须弥蔷薇": "1次0点刷新",
                "香辛果": "1次0点刷新",
                "枣椰": "1次0点刷新",
                "泡泡桔": "1次0点刷新",
                "汐藻": "1次0点刷新",
                "茉洁草": "1次0点刷新",
                "久雨莲": "1次0点刷新",
                "沉玉仙茗": "24小时刷新",
                "颗粒果": "1次0点刷新",
                "烛伞蘑菇": "1次0点刷新",
                "澄晶实": "1次0点刷新",
                "红果果菇": "1次0点刷新",
                "马尾": "1次0点刷新",
                "烈焰花花蕊": "1次0点刷新",
                "铁块": "1次0点刷新",
                "白铁块": "2次0点刷新",
                "星银矿石": "2次0点刷新",
                "水晶块": "3次0点刷新",
                "紫晶块": "3次0点刷新",
                "萃凝晶": "3次0点刷新",
                "虹滴晶": "3次0点刷新",
                "苦种": "1次0点刷新",
                "烬芯花": "1次0点刷新"
            };

            /* ---------- 3. 主循环 ---------- */
            while (priorityList.length > 0) {

                /* 1. 先把用户填的字面名（可能是别名）全部弄进来 */
                const priorityItemSet = new Set(priorityList.map(p => p.itemName));

                /* 2. 双向扩：本名↔别名 */
                for (const a of [...priorityItemSet]) {          // 复制一份避免遍历过程中增长
                    // 2.1 如果 a 是“本名”，把它的所有别名加进来（原来就有的逻辑）
                    const others = name2Other.get(a) || [];
                    for (const o of others) priorityItemSet.add(o);

                    // 2.2 如果 a 是“别名”，把对应的本名加进来（新增反向）
                    const realName = alias2Names.get(a) || [];
                    for (const r of realName) priorityItemSet.add(r);
                }

                const pickedCounter = {};
                priorityItemSet.forEach(n => pickedCounter[n] = 0);
                /* ===== 每轮开始输出剩余物品 ===== */
                log.info(`剩余目标材料 ${priorityList.map(t => `${t.itemName}*${t.count}`).join(', ')} `);
                /* 4-1 扫描 + 读 record + 前置过滤（禁用/时间/材料相关）+ 计算效率 + CD后置排除 */
                const allFiles = await readFolder('pathing', true);
                const rawRecord = await file.readText(`${recordFolder}/${subFolderName}/record.json`);
                let recordArray = [];
                try { recordArray = JSON.parse(rawRecord); } catch { /* 空记录 */ }
                const cdMap = new Map(recordArray.map(it => [it.fileName, it]));
                const now = new Date();
                /* 时间管制 */
                if (await isTimeRestricted(settings.timeRule, 10)) { priorityList.length = 0; break; }

                /* ---- 先算效率（不判CD）---- */
                for (const file of allFiles) {
                    const fullName = file.fileName;
                    const rec = cdMap.get(fullName);

                    /* 禁用关键词 */
                    let skip = false;
                    for (const kw of disableArray) { if (file.fullPath.includes(kw)) { skip = true; break; } }
                    if (skip) { file._priorityEff = -1; continue; }

                    /* 材料相关 */
                    const pathHit = [...priorityItemSet].some(n => file.fullPath.includes(n));
                    const histHit = rec?.history?.some(log =>
                        Object.keys(log.items).some(name => priorityItemSet.has(name))
                    ) ?? false;
                    let descHit = false;
                    if (file.description) {
                        descHit = [...priorityItemSet].some(kw => file.description.includes(kw));
                    }
                    if (!pathHit && !histHit && !descHit) {
                        file._priorityEff = -1;
                        continue;
                    }

                    /* 计算仅看优先材料的分均效率 */
                    let eff = -2; // 未知标记
                    if (rec?.history && rec.history.length >= 3) {
                        const effList = rec.history.map(log => {
                            const total = Object.entries(log.items)
                                .filter(([name]) => priorityItemSet.has(name))
                                .reduce((sum, [, cnt]) => sum + cnt, 0);
                            return (total / log.durationSec) * 60;
                        });
                        eff = effList.reduce((a, b) => a + b, 0) / effList.length;
                    }
                    file._priorityEff = eff;
                }

                /* ---- 用可运行路线算分位默认值 ---- */
                const knownEff = allFiles
                    .filter(f => {
                        const rec = cdMap.get(f.fileName);
                        const nextCD = rec ? new Date(rec.cdTime) : new Date(0);
                        return f._priorityEff >= 0 && now > nextCD;
                    })
                    .map(f => f._priorityEff)
                    .sort((a, b) => a - b);
                let defaultEff;
                if (knownEff.length === 0) {
                    defaultEff = 1;
                } else {
                    const rawPct = settings.defaultEffPercentile;
                    const pct = Math.max(0, Math.min(1, rawPct === "" ? 0.5 : Number(rawPct)));
                    const idx = Math.ceil(pct * knownEff.length) - 1;
                    defaultEff = knownEff[Math.max(0, idx)];
                }
                /* 回填未知 + 排除CD */
                allFiles.forEach(f => {
                    if (f._priorityEff === -2) f._priorityEff = defaultEff;
                    const rec = cdMap.get(f.fileName);
                    const nextCD = rec ? new Date(rec.cdTime) : new Date(0);
                    if (now <= nextCD) f._priorityEff = -1;
                });

                if (priorityList.length === 0) break;

                /* 4-2 只跑最高效率路线 */
                const candidateRoutes = allFiles.filter(f => f._priorityEff >= 0)
                    .sort((a, b) => b._priorityEff - a._priorityEff);
                if (candidateRoutes.length === 0) {
                    log.info('已无可用优先路线（可能全部在CD或已达标），退出优先采集阶段');
                    break;
                }
                const bestRoute = candidateRoutes[0];
                const filePath = bestRoute.fullPath;
                const fileName = basename(filePath).replace('.json', '');
                const fullName = fileName + '.json';
                const targetObj = cdMap.get(fullName);
                const startTime = new Date();

                /* ---------- 智能选队：按路线所在文件夹反查路径组 ---------- */
                {
                    const fullPath = bestRoute.fullPath;                            // 例：pathing/须弥/xxx.json
                    const folderName = fullPath.split(/\\|\//)[1];   // 索引 1 就是第二层
                    let targetParty = '';                                           // 最终要用的队伍名

                    const groupCount = Math.min(99, Math.max(1, parseInt(settings.groupCount || '3')));
                    for (let g = 1; g <= groupCount; g++) {                         // 遍历路径组
                        if (settings[`pathGroup${g}FolderName`] === folderName) {   // 找到归属组
                            targetParty = settings[`pathGroup${g}PartyName`] || '';
                            break;                                                  // 命中即停
                        }
                    }
                    if (!targetParty) targetParty = settings.priorityItemsPartyName || ''; // 回退
                    if (targetParty) {
                        await switchPartyIfNeeded(targetParty);
                        log.info(`优先采集阶段选用配队：${targetParty}（文件夹：${folderName}）`);
                    }
                }

                let timeNow = new Date();
                if (Foods.length != 0 && (((timeNow - lastCookTime) > cookInterval) || firstCook)) {
                    firstCook = false;
                    await ingredientProcessing();
                    lastCookTime = new Date();
                    underWater = false;
                }

                if (settings.setTimeMode && settings.setTimeMode != "不调节时间" && (((timeNow - lastsettimeTime) > settimeInterval) || firstsettime)) {
                    firstsettime = false;
                    if (settings.setTimeMode === "尽量调为白天") {
                        await pathingScript.runFile("assets/调为白天.json");
                    } else {
                        await pathingScript.runFile("assets/调为夜晚.json");
                    }
                    lastsettimeTime = new Date();
                }
                await fakeLog(fileName, false, true, 0);

                /* ================================= */
                log.info(`当前进度：执行路线 ${fileName}`);
                state.running = true;
                const pickupTask = recognizeAndInteract();
                if (!underWater && filePath.includes('枫丹水下')) {
                    await pathingScript.runFile("assets/A00-塞洛海原（学习螃蟹技能）.json");
                    underWater = true;
                }
                if (underWater && !filePath.includes('枫丹水下')) {
                    underWater = false;
                }
                try {
                    await pathingScript.runFile(filePath);
                } catch (e) {
                    log.error(`优先采集路线执行失败: ${filePath}`);
                    state.running = false; await pickupTask; continue;
                }
                state.running = false; await pickupTask;
                await fakeLog(fileName, false, false, 0);
                state.runPickupLog.forEach(name => {
                    /* 就地展开：别名→本名数组，再把所有相关名称都计数 */
                    const realNames = alias2Names.get(name) || [name]; // 可能是多个本名
                    for (const rn of realNames) {
                        if (priorityItemSet.has(name) || priorityItemSet.has(rn)) {
                            pickedCounter[rn] = (pickedCounter[rn] || 0) + 1;
                        }
                    }
                });

                /* ===== 追加：立即把 pickedCounter 回写到 priorityList（双向扣减）===== */
                for (const task of priorityList) {
                    let picked = 0;

                    /* 1. 字面名（可能是别名）直接扣 */
                    picked += pickedCounter[task.itemName] || 0;

                    /* 2. 别名→本名反向扣（多对一） */
                    const realNames = alias2Names.get(task.itemName) || [];
                    for (const rn of realNames) picked += pickedCounter[rn] || 0;

                    /* 3. 本名→别名顺向扣 */
                    const others = name2Other.get(task.itemName) || [];
                    for (const a of others) picked += pickedCounter[a] || 0;

                    task.count = Math.max(0, task.count - picked);
                }

                /* 倒序删除已达标项 */
                for (let i = priorityList.length - 1; i >= 0; i--) {
                    if (priorityList[i].count <= 0) {
                        log.info(`优先材料已达标: ${priorityList[i].itemName}`);
                        priorityList.splice(i, 1);
                    }
                }

                /* ================================================ */

                /* 4-4 计算CD（掉落材料决定）*/
                const timeDiff = new Date() - startTime;
                let pathRes = isArrivedAtEndPoint(filePath);

                // >>> 仅当 >3s 才更新 CD 并立即写回整条记录（含 history） <<<
                if (timeDiff > 3000 && pathRes) {
                    /* 1) 如果runPickupLog中不含优先材料，则按其他材料查找，使用最晚刷新时间 */
                    let hasPriority = state.runPickupLog.some(name => priorityItemSet.has(name));
                    let hitMaterials;
                    if (hasPriority) {
                        hitMaterials = [...new Set(state.runPickupLog.filter(n => priorityItemSet.has(n)))];
                    } else {
                        /* 非优先材料也按同一张表查CD */
                        hitMaterials = [...new Set(state.runPickupLog)];
                    }

                    let latestCD = new Date(0);          // 初始极小值
                    let foundAny = false;
                    hitMaterials.forEach(name => {
                        const cdType = materialCdMap[name] || "1次0点刷新";
                        let tmpDate = new Date(startTime);
                        switch (cdType) {
                            case "1次0点刷新":
                                tmpDate.setDate(tmpDate.getDate() + 1);
                                tmpDate.setHours(0, 0, 0, 0);
                                break;
                            case "2次0点刷新":
                                tmpDate.setDate(tmpDate.getDate() + 2);
                                tmpDate.setHours(0, 0, 0, 0);
                                break;
                            case "3次0点刷新":
                                tmpDate.setDate(tmpDate.getDate() + 3);
                                tmpDate.setHours(0, 0, 0, 0);
                                break;
                            case "1次4点刷新":
                                tmpDate.setHours(4, 0, 0, 0);
                                if (tmpDate <= startTime) tmpDate.setDate(tmpDate.getDate() + 1);
                                break;
                            case "12小时刷新":
                                tmpDate = new Date(startTime.getTime() + 12 * 60 * 60 * 1000);
                                break;
                            case "24小时刷新":
                                tmpDate = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
                                break;
                            case "46小时刷新":
                                tmpDate = new Date(startTime.getTime() + 46 * 60 * 60 * 1000);
                                break;
                            default:
                                tmpDate.setDate(tmpDate.getDate() + 1);
                                tmpDate.setHours(0, 0, 0, 0);
                        }
                        if (tmpDate > latestCD) latestCD = tmpDate;
                        foundAny = true;
                    });

                    /* 兜底：没有任何材料被识别到，按1次0点刷新 */
                    if (!foundAny) {
                        latestCD = new Date(startTime);
                        latestCD.setDate(latestCD.getDate() + 1);
                        latestCD.setHours(0, 0, 0, 0);
                    }

                    const durationSec = Math.round(timeDiff / 1000);
                    const itemCounter = {};
                    state.runPickupLog.forEach(n => { itemCounter[n] = (itemCounter[n] || 0) + 1; });
                    if (!targetObj.history) targetObj.history = [];
                    targetObj.history.push({ items: itemCounter, durationSec });
                    if (targetObj.history.length > 7) targetObj.history = targetObj.history.slice(-7);
                    targetObj.cdTime = latestCD.toISOString();
                    await file.writeText(recordFilePath,
                        JSON.stringify(Array.from(cdMap.values()), null, 2));

                    await appendDailyPickup(state.runPickupLog);
                    state.runPickupLog = [];
                }

            }
        }
        let loopattempts = 0;
        // ==================== 路径组循环 ====================
        while (loopattempts < 2) {
            loopattempts++;
            if (await isTimeRestricted(settings.timeRule, 10)) break;
            for (let i = 1; i <= groupCount; i++) {
                if (await isTimeRestricted(settings.timeRule, 10)) break;
                const currentCdType = settings[`pathGroup${i}CdType`] || "";
                if (!currentCdType) continue;

                const folder = folderNames[i - 1] || `路径组${i}`;
                const targetFolder = `pathing/${folder} `;

                /* 运行期同样用 Map<fileName, 原对象> 只改 cdTime */
                const rawRecord = await file.readText(recordFilePath);
                let recordArray = JSON.parse(rawRecord);
                const cdMap = new Map(recordArray.map(it => [it.fileName, it]));

                const groupFiles = await readFolder(targetFolder, true);

                if (userSettings.operationMode === "执行任务（若不存在索引文件则自动创建）") {
                    const groupNumber = i;
                    await genshin.returnMainUi();

                    try {
                        /* ================== 提前计算分均效率（所有模式通用） ================== */
                        // 0) 解析优先关键词
                        const priorityKeywords = settings.priorityTags
                            ? settings.priorityTags.split('，').map(s => s.trim()).filter(Boolean)
                            : [];

                        // 1) 解析加权规则
                        const weightMap = new Map();
                        if (settings.weightedRule) {
                            settings.weightedRule
                                .split('，')
                                .map(s => s.trim())
                                .forEach(rule => {
                                    const [item, wStr] = rule.split('*');
                                    if (item && wStr) {
                                        const w = Number(wStr);
                                        weightMap.set(item, isNaN(w) ? 1 : w);
                                    }
                                });
                        }

                        // 2) 先计算一次基础效率（未知路线先标 -1）
                        groupFiles.forEach(p => {
                            const fullName = basename(p.fullPath);
                            const obj = cdMap.get(fullName);
                            let avgEff = -1; // 先标记为“未知”

                            if (obj && obj.history && obj.history.length >= 3) {
                                const effList = obj.history.map(log => {
                                    const total = Object.entries(log.items).reduce((sum, [name, cnt]) => {
                                        const w = blacklistSet.has(name) ? 0 : (weightMap.get(name) ?? 1);
                                        return sum + cnt * w;
                                    }, 0);
                                    return (total / log.durationSec) * 60;
                                });
                                avgEff = effList.reduce((a, b) => a + b, 0) / effList.length;
                            }
                            p._efficiency = avgEff; // 已知路线存真实效率，未知路线存 -1
                        });

                        // 3) 计算默认效率（分位值 & 临界值 取最大）
                        const knownEff = groupFiles
                            .map(p => p._efficiency)
                            .filter(e => e >= 0)          // 只保留已知路线
                            .sort((a, b) => a - b);

                        const userThreshold = Number(settings[`pathGroup${i}thresholdEfficiency`]) || 0;

                        let defaultEff;
                        if (knownEff.length === 0) {
                            // 一条已知路线都没有 → 直接用临界值
                            defaultEff = userThreshold;
                        } else {
                            // 按配置的分位取效率
                            const rawPct = settings.defaultEffPercentile;
                            const pct = Math.max(0, Math.min(1, rawPct === "" ? 0.5 : Number(rawPct)));
                            const idx = Math.ceil(pct * knownEff.length) - 1;
                            const percentileEff = knownEff[Math.max(0, idx)];

                            // 关键改动：与临界值取最大
                            defaultEff = Math.max(percentileEff, userThreshold);
                        }

                        // 4) 把 -1 的未知路线替换成默认效率
                        groupFiles.forEach(p => {
                            if (p._efficiency === -1) p._efficiency = defaultEff;
                        });

                        // 5) 计算全局最大效率值（已含默认效率）
                        const maxEff = Math.max(...groupFiles.map(p => p._efficiency), 0);

                        // 6) 优先关键词加分（逻辑不变）
                        groupFiles.forEach(p => {
                            const fullName = basename(p.fullPath);
                            const obj = cdMap.get(fullName);

                            const itemHit = obj?.history?.some(log =>
                                Object.keys(log.items).some(item =>
                                    priorityKeywords.some(key => item.includes(key))
                                )
                            );
                            const pathHit = priorityKeywords.some(key => p.fullPath.includes(key));
                            const descHit = priorityKeywords.some(key => (p.description || '').includes(key));

                            if (itemHit || pathHit || descHit) {
                                p._efficiency += maxEff + 1;
                            }
                        });

                        /* ================== 排序分支 ================== */
                        switch (settings.sortMode) {
                            case "优先最早刷新，将优先执行最早刷新的路线":
                                groupFiles.sort((a, b) => {
                                    const nameA = basename(a.fullPath);
                                    const nameB = basename(b.fullPath);
                                    const timeA = cdMap.has(nameA) ? new Date(cdMap.get(nameA).cdTime) : new Date(0);
                                    const timeB = cdMap.has(nameB) ? new Date(cdMap.get(nameB).cdTime) : new Date(0);
                                    return timeA - timeB;   // 越早刷新越靠前
                                });
                                break;

                            case "优先最高效率，将优先执行最高分均拾取物的路线":
                                // 直接复用提前算好的 _efficiency
                                groupFiles.sort((a, b) => (b._efficiency || 0) - (a._efficiency || 0));
                                break;

                            default:
                                // 保持原有顺序，不做任何排序
                                break;
                        }

                        for (const filePath of groupFiles) {
                            const fileName = basename(filePath.fullPath).replace('.json', '');
                            const fullName = fileName + '.json';
                            const targetObj = cdMap.get(fullName);
                            const nextCD = targetObj ? new Date(targetObj.cdTime) : new Date(0);

                            const startTime = new Date();
                            if (startTime <= nextCD) {
                                log.info(`当前任务 ${fileName} 未刷新，跳过任务`);
                                continue;   // 跳过，不写回
                            }
                            if (await isTimeRestricted(settings.timeRule, 10)) break;

                            let doSkip = false;
                            for (const kw of disableArray) {
                                if (filePath.fullPath.includes(kw)) {
                                    log.info(`路径文件 ${filePath.fullPath} 包含禁用关键词 "${kw}"，跳过任务 ${fileName}`);
                                    doSkip = true; break;
                                }
                            }
                            if (doSkip) continue;

                            // ===== 临界效率过滤 =====
                            const routeEff = filePath._efficiency ?? 0;          // 提前算好的分均效率
                            const threshold = Number(settings[`pathGroup${i}thresholdEfficiency`]) || 0;
                            if (routeEff < threshold) {
                                log.info(`路线 ${fileName} 分均效率为 ${routeEff.toFixed(2)}，低于设定的临界值 ${threshold}，跳过`);
                                continue;
                            }

                            let timeNow = new Date();
                            if (Foods.length != 0 && (((timeNow - lastCookTime) > cookInterval) || firstCook)) {
                                firstCook = false;
                                await ingredientProcessing();
                                lastCookTime = new Date();
                                underWater = false;
                            }

                            if (settings.setTimeMode && settings.setTimeMode != "不调节时间" && (((timeNow - lastsettimeTime) > settimeInterval) || firstsettime)) {
                                firstsettime = false;
                                if (settings.setTimeMode === "尽量调为白天") {
                                    await pathingScript.runFile("assets/调为白天.json");
                                } else {
                                    await pathingScript.runFile("assets/调为夜晚.json");
                                }
                                lastsettimeTime = new Date();
                            }

                            await switchPartyIfNeeded(partyNames[groupNumber - 1]);

                            await fakeLog(fileName, false, true, 0);

                            /* ========== 历史拾取物前置排序 ========== */
                            // 0) 只有 history 里出现过的物品才需要前置
                            const historyItemSet = new Set();
                            const routeRec = cdMap.get(fullName);
                            if (routeRec?.history) {
                                routeRec.history.forEach(log => {
                                    Object.keys(log.items).forEach(name => historyItemSet.add(name));
                                });
                            }

                            // 1) 把 targetItems 拆成「历史出现」+「未出现」两部分
                            const frontPart = [];
                            const backPart = [];
                            for (const it of targetItems) {
                                (historyItemSet.has(it.itemName) ? frontPart : backPart).push(it);
                            }

                            // 2) 合并后重新赋值，完成前置
                            targetItems = [...frontPart, ...backPart];
                            /* ======================================= */

                            state.running = true;
                            const pickupTask = recognizeAndInteract();

                            log.info(`当前进度：路径组${i} ${folder} ${fileName} 为第 ${groupFiles.indexOf(filePath) + 1}/${groupFiles.length} 个`);
                            log.info(`当前路线分均效率为 ${(filePath._efficiency ?? 0).toFixed(2)}`);
                            if (!underWater && filePath.fullPath.includes('枫丹水下')) {
                                await pathingScript.runFile("assets/A00-塞洛海原（学习螃蟹技能）.json");
                                underWater = true;
                            }
                            if (underWater && !filePath.fullPath.includes('枫丹水下')) {
                                underWater = false;
                            }
                            try {
                                state.runPickupLog = [];          // 新路线开始前清空
                                await pathingScript.runFile(filePath.fullPath);
                            } catch (error) {
                                log.error(`路径文件 ${filePath.fullPath} 不存在或执行失败: ${error}`);
                                continue;
                            }

                            try { await sleep(1); }
                            catch (error) { log.error(`发生错误: ${error}`); break; }

                            const endTime = new Date();
                            const timeDiff = endTime.getTime() - startTime.getTime();

                            await fakeLog(fileName, false, false, timeDiff);
                            state.running = false;
                            await pickupTask;

                            let pathRes = isArrivedAtEndPoint(filePath.fullPath);

                            // >>> 仅当 >3s 才更新 CD 并立即写回整条记录（含 history） <<<
                            if (timeDiff > 3000 && pathRes) {
                                let newTimestamp = new Date(startTime);

                                switch (currentCdType) {
                                    case "1次0点刷新":
                                        newTimestamp.setDate(newTimestamp.getDate() + 1);
                                        newTimestamp.setHours(0, 0, 0, 0); break;
                                    case "2次0点刷新":
                                        newTimestamp.setDate(newTimestamp.getDate() + 2);
                                        newTimestamp.setHours(0, 0, 0, 0); break;
                                    case "3次0点刷新":
                                        newTimestamp.setDate(newTimestamp.getDate() + 3);
                                        newTimestamp.setHours(0, 0, 0, 0); break;
                                    case "4点刷新":
                                        newTimestamp.setHours(4, 0, 0, 0);
                                        if (newTimestamp <= startTime) newTimestamp.setDate(newTimestamp.getDate() + 1); break;
                                    case "12小时刷新":
                                        newTimestamp = new Date(startTime.getTime() + 12 * 60 * 60 * 1000); break;
                                    case "24小时刷新":
                                        newTimestamp = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); break;
                                    case "46小时刷新":
                                        newTimestamp = new Date(startTime.getTime() + 46 * 60 * 60 * 1000); break;
                                    default:
                                        newTimestamp = startTime; break;
                                }

                                // ===== 把本次拾取明细写进 history =====
                                const durationSec = Math.round(timeDiff / 1000);
                                const itemCounter = {};
                                for (const name of state.runPickupLog) {
                                    itemCounter[name] = (itemCounter[name] || 0) + 1;
                                }
                                const logEntry = {
                                    items: itemCounter,
                                    durationSec: durationSec
                                };
                                if (!targetObj.history) targetObj.history = [];   // 兜底
                                targetObj.history.push(logEntry);
                                // 保留最多 7 条记录，超出的旧记录丢弃
                                if (targetObj.history.length > 7) {
                                    targetObj.history = targetObj.history.slice(-7);
                                }

                                // 只改 cdTime，其余字段（含 history）保持
                                targetObj.cdTime = newTimestamp.toISOString();
                                await file.writeText(recordFilePath,
                                    JSON.stringify(Array.from(cdMap.values()), null, 2));
                                await appendDailyPickup(state.runPickupLog);

                                // 清空本次记录
                                state.runPickupLog = [];

                                log.info(`本任务cd信息已更新，下一次可用时间为 ${newTimestamp.toLocaleString()}`);
                            }
                        }
                        log.info(`路径组${groupNumber} 的所有任务运行完成`);
                    } catch (error) {
                        log.error(`读取路径组文件时出错: ${error}`);
                    }
                }
            }
            await sleep(1000);
        }

    } catch (error) {
        log.error(`操作失败: ${error}`);
    }

    //伪造js开始的日志
    await fakeLog("采集cd管理", true, true, 0);
})();

async function recognizeAndInteract() {
    let lastcenterYF = 0, lastItemName = "", thisMoveUpTime = 0, lastMoveDown = 0, blacklistCounter = 0;
    gameRegion = captureGameRegion();
    let lastCheckItemFull = new Date();
    let checkTask = null;

    while (state.running) {
        let time1 = new Date();
        gameRegion.dispose();
        gameRegion = captureGameRegion();

        if (new Date() - lastCheckItemFull > 2500 && !checkTask) {
            lastCheckItemFull = new Date();
            checkTask = checkItemFullAndOCR();
        }

        let time2 = new Date();
        const centerYF = await findFIcon();
        if (!centerYF) {
            if (await isMainUI()) {
                if (new Date() - lastRoll >= 200) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                    lastRoll = new Date();
                }
            }
            if (checkTask) {
                try { await checkTask; }
                catch (e) { log.error('背包满检查异常:', e); }
                finally { checkTask = null; }
            }
            continue;
        }
        let time3 = new Date();
        let itemName = null;
        itemName = await performTemplateMatch(centerYF);
        if (itemName) {
            if (Math.abs(lastcenterYF - centerYF) <= 20 && lastItemName === itemName) {
                await sleep(160);
                lastcenterYF = -20;
                lastItemName = null;
                if (checkTask) {
                    try { await checkTask; }
                    catch (e) { log.error('背包满检查异常:', e); }
                    finally { checkTask = null; }
                }
                continue;
            }
            if (!blacklistSet.has(itemName)) {
                keyPress("F");
                log.info(`交互或拾取："${itemName}"`);
                let time4 = new Date();
                /* >>> 提到最前 begin >>> */
                const idx = targetItems.findIndex(it => it.itemName === itemName);
                if (idx > 0) {
                    const [it] = targetItems.splice(idx, 1);
                    targetItems.unshift(it);
                }
                /* <<< 提到最前 end <<< */
                state.runPickupLog.push(itemName);

                lastcenterYF = centerYF;
                lastItemName = itemName;
                let time5 = new Date();
                //log.info(`调试-截图用时${time2 - time1},找f用时${time3 - time2}，匹配用时${time4 - time3}，后处理用时${time5 - time4}`);
                await sleep(pickupDelay);
            }
        } else {
            lastItemName = "";
        }
        const currentTime = Date.now();
        if (currentTime - lastMoveDown > timeMoveUp) {
            await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            if (thisMoveUpTime === 0) thisMoveUpTime = currentTime;
            if (currentTime - thisMoveUpTime >= timeMoveDown) {
                lastMoveDown = currentTime;
                thisMoveUpTime = 0;
            }
        } else {
            await keyMouseScript.runFile(`assets/滚轮上翻.json`);
        }
        await sleep(rollingDelay);
        if (checkTask) {
            try { await checkTask; }
            catch (e) { log.error('背包满检查异常:', e); }
            finally { checkTask = null; }
        }
    }
}

async function findFIcon() {
    try {
        const r = gameRegion.find(FiconRo);
        if (r.isExist()) return Math.round(r.y + r.height / 2);
    } catch (e) {
        log.error(`findFIcon:${e.message}`);
    }
    await sleep(checkDelay);
    return null;
}

async function performTemplateMatch(centerYF) {
    /* 一次性切 6 种宽度（0-5 汉字） */
    const regions = [];
    for (let cn = 0; cn <= 6; cn++) {   // 0~5 共 6 档
        const w = 12 + 28 * Math.min(cn, 5) + 2;
        regions[cn] = gameRegion.DeriveCrop(1219, centerYF - 15, w, 30);
    }

    try {
        for (const it of targetItems) {
            const cnLen = Math.min(
                [...it.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length,
                5
            ); // 0-5

            if (regions[cnLen].find(it.roi).isExist()) {
                return it.itemName;
            }
        }
    } catch (e) {
        log.error(`performTemplateMatch: ${e.message}`);
    } finally {
        regions.forEach(r => r.dispose());
    }
    return null;
}

async function isMainUI() {
    for (let i = 0; i < 1 && state.running; i++) {
        if (!gameRegion) gameRegion = captureGameRegion();
        try {
            if (gameRegion.find(mainUiRo).isExist()) {
                return true;
            }
        } catch (e) {
            log.error(`isMainUI:${e.message}`);
        }
        await sleep(checkDelay);
    }
    return false;
}

async function checkItemFullAndOCR() {
    const fullRoi = RecognitionObject.TemplateMatch(itemFullTemplate, 0, 0, 1920, 1080);
    try {
        if (!gameRegion.find(fullRoi).isExist()) return;
    } catch (e) { return; }
    const TEXT_X = 560, TEXT_Y = 450, TEXT_W = 800, TEXT_H = 170;
    let ocrText = null;
    try {
        const list = gameRegion.findMulti(RecognitionObject.ocr(TEXT_X, TEXT_Y, TEXT_W, TEXT_H));
        if (list.count) {
            let longest = list[0];
            for (let i = 1;
                i < list.count;
                i++) if (list[i].text.length > longest.text.length) longest = list[i];
            ocrText = longest.text.replace(/[^\u4e00-\u9fa5]/g, '');
        }
    } catch (e) {
        log.error(`OCR:${e.message}`);
    } if (!ocrText) return;
    log.info(`背包满OCR:${ocrText}`);

    function calcMatchRatio(cnPart, txt) {
        if (!cnPart || !txt) return 0;
        const len = cnPart.length;
        let maxMatch = 0;
        for (let i = 0; i <= txt.length - len; i++) {
            let match = 0;
            for (let j = 0; j < len; j++) {
                if (txt[i + j] === cnPart[j]) match++;
                maxMatch = Math.max(maxMatch, match);
            }
        }
        return maxMatch / len;
    }
    const ratioMap = new Map();
    for (const it of targetItems) {
        const candNames = [it.itemName, ...(it.otherName || [])];
        let maxRatioThisItem = 0;
        for (const name of candNames) {
            const ratio = calcMatchRatio(name.replace(/[^\u4e00-\u9fa5]/g, ''), ocrText);
            if (ratio > maxRatioThisItem) maxRatioThisItem = ratio;
        }
        if (maxRatioThisItem > 0.75) {
            const oldMax = ratioMap.get(it.itemName) || 0;
            if (maxRatioThisItem > oldMax) ratioMap.set(it.itemName, maxRatioThisItem);
        }
    }
    if (ratioMap.size === 0) return;
    const maxRatio = Math.max(...ratioMap.values());
    const names = [...ratioMap.entries()].filter(([, r]) => r === maxRatio).map(([n]) => n).sort();
    log.warn(`背包满，黑名单加入:${names.join('、')}（${(maxRatio * 100).toFixed(1)}%）`);
    for (const n of names) {
        blacklistSet.add(n);
        blacklist.push(n);
    }
    await loadBlacklist(false);
}

// 加载拾取物图片
async function loadTargetItems() {
    const targetItemPath = "assets/targetItems/";

    const items = await readFolder(targetItemPath, false);

    for (const it of items) {
        try {
            it.template = file.ReadImageMatSync(it.fullPath);
            it.itemName = it.fileName.replace(/\.png$/i, '');
            it.roi = RecognitionObject.TemplateMatch(it.template);

            /* ---------- 1. 解析小括号阈值 ---------- */
            const match = it.fullPath.match(/[（(](.*?)[)）]/);
            const itsThreshold = (match => {
                if (!match) return 0.9;
                const v = parseFloat(match[1]);
                return !isNaN(v) && v >= 0 && v <= 1 ? v : 0.9;
            })(match);
            it.roi.Threshold = itsThreshold;
            it.roi.InitTemplate();

            /* ---------- 2. 解析中括号内容 + 纯中文过滤 ---------- */
            const otherNames = new Set();

            // 一次性扫描完整路径里的所有 []
            for (const m of it.fullPath.matchAll(/\[(.*?)\]/g)) {
                const pure = (m[1] || '').replace(/[^\u4e00-\u9fff]/g, '').trim();
                if (pure) otherNames.add(pure);
            }

            // 若 itemName 本身含非中文，也生成纯中文别名
            const namePure = it.itemName.replace(/[^\u4e00-\u9fff]/g, '').trim();
            if (namePure && namePure !== it.itemName) otherNames.add(namePure);

            it.otherName = Array.from(otherNames);

        } catch (error) {
            log.error(`[loadTargetItems] ${it.fullPath}: ${error.message}`);
        }
    }
    return items;
}

async function loadBlacklist(writeBack) {
    try {
        const raw = await file.readText(`blacklists/${accountName}.json`);
        blacklist = [...new Set([...blacklist, ...JSON.parse(raw)])];
    } catch { /* 文件不存在就跳过 */ }
    blacklistSet = new Set(blacklist);

    // 仅把 blacklist 中的中文部分合并到内存中的 settings.disableJsons
    const chineseParts = blacklist
        .map(name => name.replace(/[^\u4e00-\u9fa5]/g, ''))
        .filter(Boolean);

    const existing = settings.disableJsons
        ? settings.disableJsons.split('；').map(s => s.trim()).filter(Boolean)
        : [];

    const merged = [...new Set([...existing, ...chineseParts])].sort().join('；');
    settings.disableJsons = merged;

    if (writeBack) {
        await file.writeText(`blacklists/${accountName}.json`, JSON.stringify(blacklist, null, 2), false);
    }
    // 实时同步禁用关键词数组
    disableArray = settings.disableJsons.split('；').map(s => s.trim()).filter(Boolean);
}

// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看

async function fakeLog(name, isJs, isStart, duration) {
    await sleep(1);
    const currentTime = Date.now();
    // 参数检查
    if (typeof name !== 'string') {
        log.error("参数 'name' 必须是字符串类型！");
        return;
    }
    if (typeof isJs !== 'boolean') {
        log.error("参数 'isJs' 必须是布尔型！");
        return;
    }
    if (typeof isStart !== 'boolean') {
        log.error("参数 'isStart' 必须是布尔型！");
        return;
    }
    if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
        log.error("参数 'currentTime' 必须是整数！");
        return;
    }
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
        log.error("参数 'duration' 必须是整数！");
        return;
    }

    // 将 currentTime 转换为 Date 对象并格式化为 HH:mm:ss.sss
    const date = new Date(currentTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

    // 将 duration 转换为分钟和秒，并保留三位小数
    const durationInSeconds = duration / 1000; // 转换为秒
    const durationMinutes = Math.floor(durationInSeconds / 60);
    const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数

    // 使用四个独立的 if 语句处理四种情况
    if (isJs && isStart) {
        // 处理 isJs = true 且 isStart = true 的情况
        const logMessage = `正在伪造js开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行JS脚本: "${name}"`;
        log.debug(logMessage);
    }
    if (isJs && !isStart) {
        // 处理 isJs = true 且 isStart = false 的情况
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
    if (!isJs && isStart) {
        // 处理 isJs = false 且 isStart = true 的情况
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    }
    if (!isJs && !isStart) {
        // 处理 isJs = false 且 isStart = false 的情况
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
}

// 定义自定义函数 basename，用于获取文件名
function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
    return filePath.substring(lastSlashIndex + 1);
}

// 定义自定义函数 removeJsonSuffix，用于移除文件名中的 .json 后缀
function removeJsonSuffix(fileName) {
    if (fileName.endsWith('.json')) {
        return fileName.substring(0, fileName.length - 5); // 移除 .json 后缀
    }
    return fileName;
}

// 定义 readFolder 函数
async function readFolder(folderPath, onlyJson) {
    const folderStack = [folderPath];
    const files = [];

    while (folderStack.length > 0) {
        const currentPath = folderStack.pop();
        const filesInSubFolder = file.ReadPathSync(currentPath); // 同步读取
        const subFolders = [];

        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                subFolders.push(filePath);
                continue;
            }

            if (filePath.endsWith('.js')) continue; // 跳过 js

            // 仅 json 模式
            if (onlyJson) {
                if (!filePath.endsWith('.json')) continue;

                let description = '';
                try {
                    // 同步读文本，避免 async 传染
                    const txt = file.readTextSync(filePath);
                    const parsed = JSON.parse(txt);
                    description = parsed?.info?.description ?? '';
                } catch {
                    /* 读盘或解析失败就留空串 */
                }

                const fileName = filePath.split('\\').pop();
                const folderPathArray = filePath.split('\\').slice(0, -1);

                files.push({
                    fullPath: filePath,
                    fileName,
                    folderPathArray,
                    description
                });
                continue;
            }

            const fileName = filePath.split('\\').pop();
            const folderPathArray = filePath.split('\\').slice(0, -1);
            files.push({ fullPath: filePath, fileName, folderPathArray });
        }

        // 子文件夹按原顺序入栈（深度优先）
        folderStack.push(...subFolders.reverse());
    }

    return files;
}

/**
 * 带缓存的配队切换函数
 * 如果目标配队与 currentParty 一致则跳过；否则真正切换并更新 currentParty。
 * @param {string} partyName 期望切换到的配队名称
 */
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {                       // 空名直接回主界面
        await genshin.returnMainUi();
        return;
    }

    if (partyName === currentParty) {       // 缓存命中，跳过切换
        await genshin.returnMainUi();
        return;
    }

    /* 真正切换 */
    try {
        log.info(`正在尝试切换至配队「${partyName}」`);
        let success = await genshin.switchParty(partyName);
        if (!success) {                     // 第一次失败，去神像再试一次
            log.info('切换失败，前往七天神像重试');
            await genshin.tpToStatueOfTheSeven();
            success = await genshin.switchParty(partyName);
        }

        if (success) {                      // 切换成功，更新缓存
            currentParty = partyName;
            log.info(`已切换至配队「${partyName}」并更新缓存`);
        } else {
            throw new Error('两次切换均失败');
        }
    } catch (e) {
        log.error('队伍切换失败，可能处于联机模式或其他不可切换状态');
        notification.error('队伍切换失败，可能处于联机模式或其他不可切换状态');
        await genshin.returnMainUi();
    }
}

/**
 * 检查当前时间是否处于限制时间内或即将进入限制时间
 * @param {string} timeRule - 时间规则字符串，格式如 "8, 8-11, 23:11-23:55"
 * @param {number} [threshold=5] - 接近限制时间的阈值（分钟）
 * @returns {Promise<boolean>} - 如果处于限制时间内或即将进入限制时间，则返回 true，否则返回 false
 */
async function isTimeRestricted(timeRule, threshold = 5) {
    if (!timeRule) return false;

    // 兼容中英文逗号、冒号
    const ruleClean = timeRule
        .replace(/，/g, ',')
        .replace(/：/g, ':');

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMinute;

    for (const seg of ruleClean.split(',').map(s => s.trim())) {
        if (!seg) continue;

        let startStr, endStr;
        if (seg.includes('-')) {
            [startStr, endStr] = seg.split('-').map(s => s.trim());
        } else {
            startStr = endStr = seg.trim();
        }

        const parseTime = (str, isEnd) => {
            if (str.includes(':')) {
                const [h, m] = str.split(':').map(Number);
                return { h, m };
            }
            // 单独小时：start 8→8:00，end 8→8:59
            const h = Number(str);
            return { h, m: isEnd ? 59 : 0 };
        };

        const start = parseTime(startStr, false);
        const end = parseTime(endStr, true);

        const startTotal = start.h * 60 + start.m;
        const endTotal = end.h * 60 + end.m;

        const effectiveEnd = endTotal >= startTotal ? endTotal : endTotal + 24 * 60;

        if (
            (currentTotal >= startTotal && currentTotal < effectiveEnd) ||
            (currentTotal + 24 * 60 >= startTotal && currentTotal + 24 * 60 < effectiveEnd)
        ) {
            log.warn("处于限制时间内");
            return true;
        }

        let nextStartTotal = startTotal;
        if (nextStartTotal <= currentTotal) nextStartTotal += 24 * 60;
        const waitMin = nextStartTotal - currentTotal;
        if (waitMin > 0 && waitMin <= threshold) {
            log.warn(`接近限制时间，等待 ${waitMin} 分钟`);
            await genshin.tpToStatueOfTheSeven();
            await sleep(waitMin * 60 * 1000);
            return true;
        }
    }
    return false;
}

/**
* 食材加工主函数，用于自动前往指定地点进行食材的加工
*
* 该函数会根据 Foods 和 foodCount 数组中的食材名称和数量，依次查找并制作对应的料食材
* 支持调味品类食材（直接在“食材加工”界面查找）
*
* @returns {Promise<void>} 无返回值，执行完所有加工流程后退出
*/
async function ingredientProcessing() {
    const targetFoods = [
        "面粉", "兽肉", "鱼肉", "神秘的肉", "黑麦粉", "奶油", "熏禽肉",
        "黄油", "火腿", "糖", "香辛料", "酸奶油", "蟹黄", "果酱",
        "奶酪", "培根", "香肠"
    ];
    if (Foods.length == 0) { log.error("未选择要加工的食材"); return; }
    if (Foods.length != foodCount.length) { log.error("请检查食材与对应的数量是否一致！"); return; }
    const taskList = Foods.map((name, i) => `${name}*${foodCount[i]}`).join("，");
    const tasks = Foods.map((name, idx) => ({
        name,
        count: Number(foodCount[idx]) || 0,
        done: false
    }));
    log.info(`本次加工食材：${taskList}`);
    const stove = "蒙德炉子";
    log.info(`正在前往${stove}进行食材加工`);

    try {
        let filePath = `assets/${stove}.json`;
        await pathingScript.runFile(filePath);
    } catch (error) {
        log.error(`执行 ${stove} 路径时发生错误`);
        return;
    }

    const res1 = await findPNG("交互烹饪锅");
    if (res1) {
        keyPress("F");
    } else {
        log.warn("烹饪按钮未找到，正在寻找……");
        let attempts = 0;
        const maxAttempts = 3;
        let foundInRetry = false;
        while (attempts < maxAttempts) {
            log.info(`第${attempts + 1}次尝试寻找烹饪按钮`);
            keyPress("W");
            const res2 = await findPNG("交互烹饪锅");
            if (res2) {
                keyPress("F");
                foundInRetry = true;
                break;
            } else {
                attempts++;
                await sleep(500);
            }
        }
        if (!foundInRetry) {
            log.error("多次未找到烹饪按钮，放弃");
            return;
        }
    }
    await clickPNG("食材加工");

    /* ===== 1. 公共加工流程 ===== */
    async function doCraft(i) {
        await clickPNG("制作");
        await sleep(300);

        /* ---------- 1. 队列已满 ---------- */
        if (await findPNG("队列已满", 1)) {
            log.warn(`检测到${tasks[i].name}队列已满，等待图标消失`);
            while (await findPNG("队列已满", 1)) {
                log.warn(`检测到${tasks[i].name}队列已满，等待图标消失`);
                await sleep(300);
            }
            if (await clickPNG("全部领取", 3)) {
                await clickPNG("点击空白区域继续");
                await findPNG("食材加工2");
                await sleep(100);
            }
            return false;
        }

        /* ---------- 2. 材料不足 ---------- */
        if (await findPNG("材料不足", 1)) {
            log.warn(`检测到${tasks[i].name}材料不足，等待图标消失`);
            while (await findPNG("材料不足", 1)) {
                log.warn(`检测到${tasks[i].name}材料不足，等待图标消失`);
                await sleep(300);
            }
            if (await clickPNG("全部领取", 3)) {
                await clickPNG("点击空白区域继续");
                await findPNG("食材加工2");
                await sleep(100);
            }
            Foods.splice(i, 1);
            foodCount.splice(i, 1);

            return false;
        }

        /* ---------- 3. 正常加工流程 ---------- */
        await findPNG("选择加工数量");
        click(960, 460);
        await sleep(800);
        inputText(String(tasks[i].count));

        log.info(`尝试制作${tasks[i].name} ${tasks[i].count}个`);
        await clickPNG("确认加工");
        await sleep(500);

        /* ---------- 4. 已不能持有更多 ---------- */
        if (await findPNG("已不能持有更多", 1)) {
            log.warn(`检测到${tasks[i].name}已满，等待图标消失`);
            while (await findPNG("已不能持有更多", 1)) {
                log.warn(`检测到${tasks[i].name}已满，等待图标消失`);
                await sleep(300);
            }
            if (await clickPNG("全部领取", 3)) {
                await clickPNG("点击空白区域继续");
                await findPNG("食材加工2");
                await sleep(100);
            }
            Foods.splice(i, 1);
            foodCount.splice(i, 1);

            return false;
        }

        await sleep(200);
        /* 正常完成：仅领取，不移除 */
        if (await clickPNG("全部领取", 3)) {
            await clickPNG("点击空白区域继续");
            await findPNG("食材加工2");
            await sleep(100);
        }
    }

    /* ===== 2. 两轮扫描 ===== */
    // 进入界面先领取一次
    if (await clickPNG("全部领取", 3)) {
        await clickPNG("点击空白区域继续");
        await findPNG("食材加工2");
        await sleep(100);
    }

    let lastSuccess = true;
    for (let i = 0; i < tasks.length; i++) {
        if (!targetFoods.includes(tasks[i].name)) continue;

        const retry = lastSuccess ? 5 : 1;
        if (await clickPNG(`${tasks[i].name}1`, retry)) {
            log.info(`${tasks[i].name}已找到`);
            await doCraft(i);
            tasks[i].done = true;
            lastSuccess = true;   // 记录成功
        } else {
            lastSuccess = false;  // 记录失败
        }
    }

    const remain1 = tasks.filter(t => !t.done).map(t => `${t.name}*${t.count}`).join("，") || "无";
    log.info(`剩余待加工食材：${remain1}`);

    if (remain1 === "无") {
        log.info("所有食材均已加工完毕，跳过第二轮扫描");
        await genshin.returnMainUi();
        return;
    }

    const rg = captureGameRegion();
    const foodItems = [];
    try {
        for (const flag of ['已加工0个', '已加工1个']) {
            const mat = file.ReadImageMatSync(`assets/RecognitionObject/${flag}.png`);
            const res = rg.findMulti(RecognitionObject.TemplateMatch(mat));
            for (let k = 0; k < res.count; ++k) {
                foodItems.push({ x: res[k].x, y: res[k].y });
            }
            mat.dispose();
        }
    } finally { rg.dispose(); }

    log.info(`识别到${foodItems.length}个加工中食材`);

    for (const item of foodItems) {
        click(item.x, item.y); await sleep(1 * checkInterval);
        click(item.x, item.y); await sleep(6 * checkInterval);

        for (let round = 0; round < 5; round++) {
            const rg = captureGameRegion();
            try {
                let hit = false;

                /* 直接扫 tasks，模板已挂在 task.ro */
                for (const task of tasks) {
                    if (task.done) continue;
                    if (!targetFoods.includes(task.name)) continue;

                    /* 首次使用再加载，避免重复 IO */
                    if (!task.ro) {
                        task.ro = RecognitionObject.TemplateMatch(
                            file.ReadImageMatSync(`assets/RecognitionObject/${task.name}2.png`)
                        );
                        task.ro.Threshold = 0.9;
                        task.ro.InitTemplate();
                    }

                    if (!task.ro) {
                        log.warn(`${task.name}2.png 不存在，跳过识别`);
                        continue;
                    }
                    const res = rg.find(task.ro);
                    if (res.isExist()) {
                        log.info(`${task.name}已找到`);
                        await doCraft(tasks.indexOf(task));
                        task.done = true;
                        hit = true;
                        break;             // 一轮只处理一个
                    }
                }

                if (hit) break;            // 本轮已命中，跳出 round
            } finally {
                rg.dispose();
            }
        }
    }

    const remain = tasks.filter(t => !t.done).map(t => `${t.name}*${t.count}`).join("，") || "无";
    log.info(`剩余待加工食材：${remain}`);



    await genshin.returnMainUi();
}

/**
 * 把本次路线的掉落合并到“拾取记录.json”中同一天条目（不含 durationSec）
 * @param {string[]} pickupLog  本次路线的 state.runPickupLog
 */
async function appendDailyPickup(pickupLog) {
    if (!pickupLog || !pickupLog.length) return;

    let oldArr = [];
    try {
        const txt = await file.readText(pickupRecordFile);
        if (txt) oldArr = JSON.parse(txt);
    } catch (_) { /* 文件不存在或解析失败 */ }

    // 统一按 UTC+8 的 0 点划分日期
    const utc8 = new Date(Date.now() + 8 * 3600_000);
    const today = utc8.toISOString().slice(0, 10); // "YYYY-MM-DD"

    let todayItem = oldArr.find(e => e.date === today);
    if (!todayItem) {
        todayItem = { date: today, items: {} };
        oldArr.push(todayItem);
    }

    const todayItems = todayItem.items;
    pickupLog.forEach(name => {
        todayItems[name] = (todayItems[name] || 0) + 1;
    });

    // 滑动窗口：只保留最近 MAX_PICKUP_DAYS 天
    if (oldArr.length > MAX_PICKUP_DAYS) oldArr = oldArr.slice(-MAX_PICKUP_DAYS);

    // 按日期倒序（最新在前）
    oldArr.sort((a, b) => b.date.localeCompare(a.date));

    // 写盘 + 异常捕获
    try {
        await file.writeText(pickupRecordFile, JSON.stringify(oldArr, null, 2), false);
    } catch (error) {
        log.error(`appendDailyPickup 写盘失败: ${error.message}`);
    }
}

async function clickPNG(png, maxAttempts = 20) {
    //log.info(`调试-点击目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.95;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, true, maxAttempts);
}

async function findPNG(png, maxAttempts = 20) {
    //log.info(`调试-识别目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.95;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, false, maxAttempts);
}

async function findAndClick(target, doClick = true, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { await sleep(checkInterval * 2 + 50); if (doClick) { res.click(); } return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(checkInterval);
    }
    return false;
}

/**
 * 判断当前人物是否已到达指定路线的终点
 * @param {string} fullPath  路线文件完整路径（.json）
 * @returns {boolean}        true = 已到达；false = 未到达/读文件失败/取坐标失败
 */
function isArrivedAtEndPoint(fullPath) {
    try {
        /* 1. 读路线文件，取终点坐标 */
        const raw = file.readTextSync(fullPath);
        const json = JSON.parse(raw);
        if (!Array.isArray(json.positions)) return false;

        let endX = 0, endY = 0;
        for (let i = json.positions.length - 1; i >= 0; i--) {
            const p = json.positions[i];
            if (p.type !== 'orientation' &&
                typeof p.x === 'number' &&
                typeof p.y === 'number') {
                endX = p.x;
                endY = p.y;
                break;
            }
        }
        if (endX === 0 && endY === 0) return false;   // 没找到有效点

        /* 2. 取当前人物坐标 */
        const mapName = (json.info?.map_name && json.info.map_name.trim()) ? json.info.map_name : 'Teyvat';
        const pos = genshin.getPositionFromMap(mapName);   // 同步 API
        const curX = pos.X;
        const curY = pos.Y;

        /* 3. 曼哈顿距离 ≤30 视为到达 */
        return Math.abs(endX - curX) + Math.abs(endY - curY) <= 30;
    } catch (e) {
        /* 任何异常（读盘失败、解析失败、API 异常）都算“未到达” */
        return false;
    }
}
