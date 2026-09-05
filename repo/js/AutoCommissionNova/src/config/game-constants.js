const rect = OpenCvSharp.OpenCvSharp.Rect
/** 游戏相关常量 */
export const COMMISSION_TYPE = {
    BASIC: "BASIC",
    NPC: "NPC",
};

/**
 * 委托状态（detectCommissionStatusByImage 返回值 + 持久化到委托对象的 status 字段）
 * UNKNOWN 表示无法判定（图标识别不出 / 地点 OCR 失败 / 处理过程抛错），下游统一不执行
 */
export const COMMISSION_STATUS = {
    /** 当日已完成，跳过执行 */
    COMPLETED: "已完成",
    /** 未完成且具备执行条件（有地点） */
    UNCOMPLETED: "未完成",
    /** 状态无法判定，跳过执行 */
    UNKNOWN: "未知",
};

/**
 * 委托统一配置（OCR 区域 + 状态检查区域）
 * 每个配置项包含委托名 OCR 识别区域和完成状态检测区域
 */
export const COMMISSION_CONFIG = [
    {
        index: 0,
        ocrRegion: new rect(796, 293, 440, 40),
        statusRegion: { x: 1550, y: 320, checkX: 1450, checkWidth: 150 },
    },
    {
        index: 1,
        ocrRegion: new rect(796, 401, 440, 40),
        statusRegion: { x: 1550, y: 440, checkX: 1450, checkWidth: 150 },
    },
    {
        index: 2,
        ocrRegion: new rect(796, 509, 440, 40),
        statusRegion: { x: 1550, y: 530, checkX: 1500, checkWidth: 100 },
    },
    {
        index: 3,
        ocrRegion: new rect(796, 544, 440, 40),
        statusRegion: { x: 1550, y: 560, checkX: 1450, checkWidth: 150 },
    },
];

export const MIN_TEXT_LENGTH = 3;

export const MAX_COMMISSION_RETRY_COUNT = 1;

export const POSITION_COORDINATES = [
    [460, 538],
    [792, 538],
    [1130, 538],
    [1462, 538],
];
/**
 * 委托完成状态的检测区域
 * 
 * 需要在冒险之证-委托页面进行检测
 */
export const COMMISSION_STATUS_REGIONS = [
[1510, 270, 80, 100],
[1510, 370, 80, 100],
[1510, 470, 80, 100],
[1510, 520, 80, 100], 
];

export const COMMISSION_POSITIONING_BUTTONS = [
    {x: 1550, y: 320 },
    {x: 1550, y: 440 },
    {x: 1550, y: 530 },
    {x: 1550, y: 560 },
];


export const THRESHOLDS = {
    /** 委托名称标准化阈值，用于将 OCR 识别错的委托名称标准化为正确的委托名称 */
    COMMISSION_NAME: 0.6,
    /** 地区名称标准化阈值，用于将 OCR 识别错的地区名称标准化为正确的地区名称 */
    LOCATION: 0.6,
    /** 委托描述匹配阈值，用于将 OCR 识别的委托描述与期望描述比较（cleanText 去标点后做编辑距离） */
    COMMISSION_DESC: 0.8,
    /** UID OCR 纠错阈值，配置 UID 候选或已有账号槽的相似度必须严格大于该值 */
    UID: 0.8,
};

/** 文件路径常量 */
export const PATHS = {
    PROCESS_ROOT: "process",
    COMMISSION_CATALOG: "config/commission-catalog.json",
    NPC_PROCESS_BASE: "process/蒙德/NPC",
    ACCOUNT_CONFIG_DIR: "Data/user-config",
    HAS_NO_RESULT_IMAGE: "Data/RecognitionObject/hasNoResult.png",
    COMPLETED_IMAGE: "Data/RecognitionObject/Completed.png",
    UNCOMPLETED_IMAGE: "Data/RecognitionObject/UnCompleted.png",
    TALK_EXIT_IMAGE: "Data/RecognitionObject/TalkExit.png",
    TALK_ICON_IMAGE: "Data/RecognitionObject/TalkIcon.png",
    PAIMON_MENU_IMAGE: "Data/RecognitionObject/paimon_menu.png",
    IN_MAP_IMAGE: "Data/RecognitionObject/inMap.png",
    INTALK_IMAGE: "Data/RecognitionObject/InTalk.png",
    ICON_BIGMAP_COMMISSION: "Data/RecognitionObject/IconBigmapCommission.jpg",
    ICON_BASE_COMMISSION: "Data/RecognitionObject/IconBaseCommission.png",
    ICON_QUESTION_COMMISSION: "Data/RecognitionObject/IconQuestionCommission.png",
    ICON_TASK_COMMISSION: "Data/RecognitionObject/IconTaskCommission.png",
    MOON_LIGHT_ICON: "Data/RecognitionObject/MoonLightIcon.png",
    TRACK_IMAGE: "Data/RecognitionObject/TrackButton.png",
    AVATAR_STRATEGIES: "config/avatar-strategies.json",
    /** 委托分支配置目录。每个委托一个文件：{委托名}.json
     *  内存视图（branchConfigCache / UI 编辑器）是合并后的 { 委托名: config }，
     *  磁盘按委托名拆分存储，新增委托加文件即可，零冲突 */
    BRANCHES_DIR: "config/branches",
};

/** 对话相关区域常量 */
export const DIALOG_REGIONS = {
    /** 对话NPC名称识别区域 */
    NPC_NAME: new rect(80, 248, 343, 31),
    /** 对话选项列表识别区域 */
    DIALOG_OPTIONS: new rect(1150, 300, 350, 400),
    /** 对话气泡图标模板匹配区域 [x, y, width, height] */
    TALK_ICON: [1260, 300, 90, 550],
    /** 对话选项OCR识别区域 */
    DIALOG_OPTIONS_OCR: new rect(1250, 250, 550, 600),
    /** NPC 对话台词区域。用于 step.probe=true 时
     *  在按 SPACE 翻页之前 OCR 当前段台词，给分支探针扫描关键词 */
    DIALOG_CONTENT: new rect(308, 924, 1356, 99),
};

/** UI界面相关区域常量 */
export const UI_REGIONS = {
    /** 冒险之证-委托标签区域 */
    COMMISSION_TAB: new rect(260, 317, 89, 47),
    /** 每日委托奖励区域 */
    DAILY_COMMISSION_REWARD: new rect(427, 345, 142, 36),
    /** 冒险历练启用状态判断区域：检测"长效历练点" */
    ADVENTURE_ENCOUNTERS_ENABLED_INDICATOR: new rect(759, 817, 125, 47),
    /** 冒险历练点数 OCR 区域 */
    ENCOUNTER_POINTS: new rect(765, 823, 254, 38),
    /** 追踪按钮模板匹配区域 [x, y, width, height] */
    TRACK_BUTTON: [1428, 965, 87, 86],
    /** 剧情图标识别区域 [x, y, width, height] */
    STORY_ICON: [265, 37, 30, 22],
    /** F图标识别区域 [x, y, width, height] */
    F_ICON: [1207, 0, 43, 850],
    /** 主界面派蒙菜单搜索区域 [x, y, width, height] */
    PAIMON_MENU_SEARCH: [0, 0, 500, 500],

};

/** OCR 识别区域坐标常量 */
export const OCR_REGIONS = {
    /** 冒险之证 - 委托界面 - 委托名称（冒险历练启用） */
    COMMISSION_NAME_ADVENTURE_ENCOUNTERS_ENABLED: [
        new rect(810, 300, 340, 40),
        new rect(810, 405, 340, 40),
        new rect(810, 510, 340, 40),
        new rect(810, 545, 340, 40),
    ],
    /** 冒险之证 - 委托界面 - 委托名称（冒险历练未启用） */
    COMMISSION_NAME_ADVENTURE_ENCOUNTERS_DISABLED: [
        new rect(810, 330, 340, 35),
        new rect(810, 455, 340, 35),
        new rect(810, 580, 340, 35),
        new rect(810, 625, 340, 35),
    ],
    LOCATION_IN_OTHER_COUNTRY: new rect(1530, 100, 250, 30),
    LOCATION_IN_NOD_KRAI: new rect(1580, 100, 250, 30),
    DETAIL_COUNTRY: new rect(1480, 100, 55, 30),
    /** 大地图 - 选中委托后 - 停止追踪按钮 */
    COMMISSION_TRACKING: new rect(1626, 987, 127, 40),
    /** 主界面 - 追踪任务时 - 委托名称/第一行描述文本 */
    COMMISSION_DETAIL: new rect(80, 250, 380, 27),
    /** 主界面 - 追踪任务时 - 第二行描述文本 */
    COMMISSION_DETAIL_SECOND_LINE: new rect(80, 280, 380, 30),
};
