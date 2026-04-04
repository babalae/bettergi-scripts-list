// 全局常量定义模块
var Constants = {
    // 冷却时间(毫秒)
    COOLDOWN_LOCAL: 46 * 60 * 60 * 1000,      // 地方特产46小时冷却
    COOLDOWN_MAGIC: 12 * 60 * 60 * 1000,      // 敌人与魔物12小时冷却
    COOLDOWN_WEAPONS1: 12 * 60 * 60 * 1000,   // 武器1材料12小时冷却
    COOLDOWN_WEAPONS2: 12 * 60 * 60 * 1000,   // 武器2材料12小时冷却
    
    // OCR重试配置
    OCR_RETRY_WAIT: 600,   // OCR识别重试等待时间(毫秒)
    OCR_MAX_RETRIES: 8,     // OCR识别最大重试次数
    
    // 路径配置
    ASSETS_BASE: "pathing",
    FOLDER_LOCAL: "地方特产",
    FOLDER_MAGIC: "敌人与魔物",
    FOLDER_WEAPONS1: "敌人与魔物",
    FOLDER_WEAPONS2: "敌人与魔物",
    
    // 文件路径
    CONFIG_PATH: "data/run_data/config.json",
    SCRIPT_COOLDOWN_RECORD: "data/run_data/script_cooldown_record.json",
    ABNORMAL_PATHS_RECORD: "data/run_data/abnormal_paths.json",
    MAPPING_PATH: "data/Mapping.json",
    COMPLETED_TASKS_FILE: "data/run_data/completed_tasks.json",
    
    // 草神路线配置
    GRASS_GOD_KEYWORD: "有草神",
    DEFAULT_LOCAL_COUNT: 4,
    DEFAULT_UID: "未识别UID",
    GRASS_GOD_ERROR_EXTRA: 8,
    
    // 错误提示
    ERROR_NO_SCRIPTS: "⚠️ 未找到任何JSON路径脚本！",
    ERROR_NO_PATHING: "⚠️请确保地图追踪 地方特产和敌人与魔物，已全部订阅或更新路径",
    ERROR_NO_README_MD: "⚠️请先右键点击脚本名称打开脚本所在目录阅读README.md文档",
    
    // 敌人与魔物材料阈值常量
    THRESHOLD_HIGH: 50,    // 高阈值：<=50且>20
    THRESHOLD_LOW: 20,     // 低阈值：<=20
    PATH_COUNT_HIGH: 10,   // 高阈值时执行路径数
    PATH_COUNT_LOW: 5,     // 低阈值时执行路径数
    
    // 技能书与国家、行列位置的映射
    bookToPosition: {
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
        // 挪德卡莱
        "浪迹": {country: "挪德卡莱天赋", row: 2},
        "乐园": {country: "挪德卡莱天赋", row: 1},
        "月光": {country: "挪德卡莱天赋", row: 0}
    },
    
    // 品质对应的列位置
    qualityPositions: [
        {x: 1101, y: 0}, // 绿色 (0,0)
        {x: 1180, y: 0}, // 蓝色 (0,1)
        {x: 1260, y: 0}  // 紫色 (0,2)
    ],
    
    // 武器材料与国家、行列位置的映射
    weaponMaterialToPosition: {
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
        // 挪德卡莱
        "终北遗嗣": {country: "挪德卡莱武器", row: 2},
        "长夜燧火": {country: "挪德卡莱武器", row: 1},
        "奇巧秘器": {country: "挪德卡莱武器", row: 0}
    },
    
    // 武器材料品质对应的列位置和品质名称（4种品质）
    weaponQualityPositions: [
        {x: 1096, y: 0, quality: "绿色"},
        {x: 1178, y: 0, quality: "蓝色"},
        {x: 1259, y: 0, quality: "紫色"},
        {x: 1341, y: 0, quality: "金色"}
    ],
    
    // 角色突破等级
    charLevels: [20, 40, 50, 60, 70, 80],
    
    // 角色突破BOSS材料规则
    charBossMaterialRules: { 20:0, 40:2, 50:4, 60:8, 70:12, 80:20 },
    
    // 武器材料规则
    weaponMaterialRules: {
        "三星": {20:[2,0,0,0], 40:[0,2,0,0], 50:[0,4,0,0], 60:[0,0,2,0], 70:[0,0,4,0], 80:[0,0,0,3]},
        "四星": {20:[3,0,0,0], 40:[0,3,0,0], 50:[0,6,0,0], 60:[0,0,3,0], 70:[0,0,6,0], 80:[0,0,0,4]},
        "五星": {20:[5,0,0,0], 40:[0,5,0,0], 50:[0,9,0,0], 60:[0,0,5,0], 70:[0,0,9,0], 80:[0,0,0,6]},
        "未知星级": [0,0,0,0], 
        "识别异常": [0,0,0,0]
    },
    
    // 天赋书规则
    talentBookRules: {
        "1-2":[3,0,0], "2-3":[0,2,0], "3-4":[0,4,0], "4-5":[0,6,0], "5-6":[0,9,0],
        "6-7":[0,0,4], "7-8":[0,0,6], "8-9":[0,0,12], "9-10":[0,0,16]
    },
    
    // 角色突破魔物材料配置
    charBreakMonsterRules: {
        20: { star1: 3, star2: 0, star3: 0 },
        40: { star1: 15, star2: 0, star3: 0 },
        50: { star1: 0, star2: 12, star3: 0 },
        60: { star1: 0, star2: 18, star3: 0 },
        70: { star1: 0, star2: 0, star3: 12 },
        80: { star1: 0, star2: 0, star3: 24 }
    },
    
    // 角色突破区域特产配置
    charBreakLocalRules: {
        20: 3,
        40: 10,
        50: 20,
        60: 30,
        70: 45,
        80: 60
    },
    
    // 天赋升级魔物材料配置
    talentMonsterRules: {
        "1-2": { star1: 6, star2: 0, star3: 0 },
        "2-3": { star1: 0, star2: 3, star3: 0 },
        "3-4": { star1: 0, star2: 4, star3: 0 },
        "4-5": { star1: 0, star2: 6, star3: 0 },
        "5-6": { star1: 0, star2: 9, star3: 0 },
        "6-7": { star1: 0, star2: 0, star3: 4 },
        "7-8": { star1: 0, star2: 0, star3: 6 },
        "8-9": { star1: 0, star2: 0, star3: 9 },
        "9-10": { star1: 0, star2: 0, star3: 12 }
    },
    
    // OCR识别区域配置
    ocrRegions: {
        character: { x: 1463, y: 135, width: 256, height: 32 },
        checkChar: { x: 1464, y: 124, width: 250, height: 45 },
        breakStatus: { x: 815, y: 323, width: 302, height: 37 },
        weaponLevel1: { x: 1290, y: 174, width: 113, height: 44 },
        weaponLevel2: { x: 765, y: 745, width: 408, height: 43 },
        talentNormal: { x: 1625, y: 166, width: 80, height: 35 },
        talentSkill: { x: 1625, y: 260, width: 80, height: 35 },
        talentBurst: { x: 1625, y: 351, width: 80, height: 35 },
        talentBurstBackup: { x: 1625, y: 439, width: 80, height: 35 },
        monsterMaterialDesc: { x: 740, y: 444, width: 404, height: 560 },
        threeStarMaterialCount: { x: 741, y: 859, width: 404, height: 144 },
        localSpecialtyName: { x: 707, y: 122, width: 290, height: 290 },
        localSpecialtyCount: { x: 747, y: 817, width: 395, height: 204 },
        goCollect: { x: 720, y: 548, width: 410, height: 310 },
        mapLocalName: { x: 1487, y: 14, width: 364, height: 42 },
        monsterCheck: { x: 723, y: 575, width: 402, height: 357 },
        probabilityGet: { x: 1438, y: 215, width: 466, height: 450 },
        star1MaterialCount: { x: 725, y: 818, width: 418, height: 193 },
        talentLevel: { x: 50, y: 318, width: 147, height: 36 }
    },
    
    // OCR文字替换映射
    replacementMap: { 
        "卵": "卯", "姐": "妲", "去": "云", "日": "甘", "螨": "螭", 
        "知": "矢", "钱": "钺", "础": "咄", "厘": "匣", "排": "绯", 
        "朦": "曚", "矿": "斫", "镰": "簾", "廉": "簾", "救": "赦", 
        "塑": "槊", "雍": "薙", "睛": "晴", "t": "七" , "优": "优菈","伏":"优","更":"雨"
    },
    
    // 元素列表
    elements: ["火", "水", "草", "雷", "风", "冰", "岩", "物"],
    
    // 文件路径
    avatarDataPath: "data/combat_avatar.json",
    starTemplatePath: "assets/weapon_star.png",
    starCaptureRegion: { X: 1464, Y: 324, Width: 162, Height: 28 }
};
