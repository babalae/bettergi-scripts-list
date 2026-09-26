/**
 * 常量总表。调参只改这一个文件：素材文件名、阈值、限定区域、次数上限、等待时长。
 *
 * 分四块：
 *   - 目录与文件名：素材放哪儿、占位图叫什么、下拉设置项叫什么
 *   - TEMPLATE_DEFS：每个模板的图、阈值、限定区域（roi 用 0~1 比例写，运行时按分辨率换算）
 *   - DEFAULT_TIMINGS：各种等待时长（毫秒）
 *   - DEFAULT_LIMITS：次数上限、像素容差、识别区域尺寸
 *
 * 数字都给得出出处：要么对着实跑日志定的，要么被误匹配逼出来的。
 * 改之前先读它为什么是这个数——多半是别的 bug 的补丁。
 */

export const ASSET_DIR = "Assets/RecognitionObject";

/**
 * ---- 目标物品下拉 & 启动前置校验 ----
 * 目标物品不用"文件夹里有啥用啥"，改成设置里的下拉单选。
 * 选项由 bootstrap 启动时扫目录生成，有增减就改写 settings.json 再停一次。
 */
export const TARGET_ITEM_DIR = "Assets/RecognitionObject/目标物品";
/**
 * 占位图文件名（不带 .png）。选中它 = 还没选目标，脚本提示后停止。
 * **磁盘文件名就是这个，别改**；下拉里显示什么由 TEMPLATE_ITEM_LABEL 决定。
 */
export const TEMPLATE_ITEM_NAME = "截图方法模板";

/**
 * 占位项在**下拉里显示的文案**，与 TEMPLATE_ITEM_NAME 解耦。
 * 原来直接显示文件名「截图方法模板」，看着像个能存的物品，容易误选；
 * 换成一句人话「刷新当前图库」——真正要做的动作是"把截图丢进目录 → 再启动一次脚本"。
 *
 * 判"没选"时新旧两种值都认（本常量 / 文件名 / 空值），
 * 这样老存档里存着的「截图方法模板」不会因为这次改名失效。
 */
export const TEMPLATE_ITEM_LABEL = "刷新当前图库";
/** 标准 icon 图库里的模板图，分类目录缺图时从这儿拷过去 */
export const LIBRARY_TEMPLATE_PATH = "Assets/RecognitionObject/截图方法模板.png";
/** 下拉设置项的名字 */
export const TARGET_ITEM_SELECT = "targetFoodFileName";
/** 设置界面文件（脚本会直接改写它来刷新下拉选项） */
export const SETTINGS_UI_FILE = "settings.json";

/**
 * ---- 分类自动推断 ----
 * 下拉列的是「料理 + 材料」两个目录的合集，选中哪张图就从它的**路径**反推分类，
 * 装置界面的页签跟着自动点，用户不用手工选分类。
 */
export const ITEM_CATEGORIES = ["料理", "材料"];
/** 同名图同时存在于两个目录时的优先分类；也是"推断不出来"时的兜底 */
export const DEFAULT_CATEGORY = "料理";

/**
 * ---- 数量识别（数字模板匹配，不用 OCR）----
 * 0.png ~ 9.png 来自「营养袋吃药统计」的背包数字素材，放在 DIGIT_DIR。
 */
export const DIGIT_DIR = "Assets/RecognitionObject/数字";
/** 缩放系数扫描表。脚本内置，《诊断报告》的③挨个跑一遍并打成表 */
export const DIGIT_SCALE_LIST = [0.60, 0.70, 0.80, 0.90, 1.00, 1.10, 1.20, 1.30, 1.40, 1.50, 1.60];

export const PATHS = {
    restoreStatue: "Assets/Pathing/00-恢复热能-至冬-七天神像.json",
    wheelDown: "Assets/KeyMouse/滚轮下翻.json",
    wheelUp: "Assets/KeyMouse/滚轮上翻.json"
};

/**
 * ---- 排障落盘（debug/YYYY-MM-DD_HHMM.txt）----
 * 只写"出错 + 诊断"这类排查才用得上的内容，正常流程一行不落，避免刷爆日志窗口。
 * 相对路径 = 脚本目录。
 *
 * 不去改写宿主的全局 log：BetterGI 把它暴露成只读全局，
 * ES module 严格模式下赋值直接抛错（v0.10.0 实跑已验证）。
 * 所以改成"主动记"：关键节点自己调 dbg()，收尾时一次写盘。
 *
 * BGI 的 writeTextSync 不会自动建目录，写不进 debug/ 就退回脚本根目录。
 */
export const DEBUG_DIR = "debug";
export const DEBUG_FLUSH_EVERY = 20;

/** 数量的合理上限，**按分类分档**：材料 9999、料理 2000。
 *  认出的数超过所在分类的上限 → 区域里混进了别的东西，退回"靠容量已满停止"。
 *  （统一用 9999，料理那档等于没防御；统一用 2000，又会误杀材料的真实 9995。）
 */
export const COUNT_MAX_BY_CATEGORY = {
    "料理": 2000,
    "材料": 9999
};
/** 分类推断不出来时的兜底（取宽松的那档，宁可放过也别误杀真值） */
export const COUNT_MAX_FALLBACK = 9999;

/**
 * ---- 模板配置（改这里就能改素材和识别区域）----
 * 所有 PNG 放在 ASSET_DIR 下，文件名与 file 字段一致。
 *
 * file            文件名；可用 fileSetting 指定的设置项覆盖（可不写 .png）
 * fileSetting     覆盖文件名的设置项名称（可选）
 * baseDir         单独目录（可选）；不填就统一放在 ASSET_DIR 下
 * subDirSetting   在 baseDir 下再按设置项的值分一层子目录（可选）
 * subDirFallback  subDirSetting 没填时的默认子目录名
 * roi             限定识别区域，屏幕比例 0~1，null = 全屏
 *                 例：{ x: 0.5, y: 0, w: 0.5, h: 1 } = 只在屏幕右半边找
 * threshold       单独阈值（0.5~1.0），null = 用全局 templateThreshold
 * thresholdSetting 覆盖阈值的设置项名称（可选，填百分数）
 * use3ChannelsSetting 覆盖"是否彩色匹配"的设置项名称（可选）
 */
export const TEMPLATE_DEFS = {
    // 造物类型已切到「寄物装置」时的样子
    device: {
        file: "寄物装置.png",
        roi: null,
        threshold: null
    },
    // 靠近造物后出现的交互提示
    openDevice: {
        file: "打开寄物装置.png",
        roi: null,
        threshold: null
    },
    // 装置界面的分类页签，每个分类两张图（选中态 / 未选中态），按顺序找，先找到哪张点哪张。
    // 用哪个分类由**选中图所在的目录**推断，不设设置项（材料 + 料理 就是全部，两个页签够用）。
    tabMaterial1: { file: "材料1.png", roi: null, threshold: null },
    tabMaterial2: { file: "材料2.png", roi: null, threshold: null },
    tabFood1: { file: "料理1.png", roi: null, threshold: null },
    tabFood2: { file: "料理2.png", roi: null, threshold: null },

    // 拆除确认：出现它才说明当前能拆造物
    demolishConfirm: {
        file: "拆除返还.png",
        roi: null,
        threshold: null
    },
    // 要存入的目标物品，单独放在「目标物品」目录下，按分类分子目录：
    //   Assets/RecognitionObject/目标物品/料理/<文件名>
    //   Assets/RecognitionObject/目标物品/材料/<文件名>
    // 文件名由 targetFoodFileName 决定；分类不靠设置项选，
    // 由"选中图在哪个子目录"推断（见 ITEM_CATEGORIES）。
    // roi 只留右半屏：左半屏是列表，容易误点。
    // 阈值给 0.85：TM_CCOEFF_NORMED 会去均值，灰度匹配对整体压暗几乎免疫，
    // 而「奇怪的XXX」就是「美味的XXX」整体压暗一档，阈值低了会被当成美味的存进去。
    // 所以两件事一起做：阈值抬高 + 默认开彩色匹配（压暗会改色相/饱和度，彩色能区分）。
    targetFood: {
        file: "美味的素鲍鱼.png",
        fileSetting: "targetFoodFileName",
        baseDir: "Assets/RecognitionObject/目标物品",
        subDirFallback: "料理",
        roi: { x: 0.5, y: 0, w: 0.5, h: 1 },
        threshold: 0.85,
        thresholdSetting: "targetFoodThreshold",
        use3ChannelsSetting: "targetFoodUse3Channels"
    },
    // 容量满了的提示
    capacityFull: {
        file: "寄物装置容量已满.png",
        roi: null,
        threshold: null
    },
    // 容量满之后的「确认存取」按钮
    confirmAccess: {
        file: "确认存取.png",
        roi: null,
        threshold: null
    },
    // 二级确认弹窗的「确认」按钮。
    // **ROI 必须限定**：两张图都含"确认"二字，低阈值下互相命中 ——
    // 点完「确认存取」(1458,1019) 后，「确认.png」第一次仍匹配到 (1430,1020)（几乎同一位置），
    // 点空；第二次才匹配到真正的弹窗按钮 (1182,757)。
    // 取屏幕中上部（y 0.40~0.90），把底部那条"确认存取"排除在外；阈值同时从 0.70 抬到 0.80。
    confirm: {
        file: "确认.png",
        roi: { x: 0.45, y: 0.40, w: 0.50, h: 0.50 },
        threshold: 0.80
    },
    // 关闭装置界面的按钮
    exitDevice: {
        file: "退出寄物装置页面.png",
        roi: null,
        threshold: null
    }
};

/**
 * 分类页签：分类名 -> 依次尝试的模板 key。
 * 只有「料理」「材料」两个页签，它们已覆盖全部物品。
 * 「全部」页签不用：多一个只多一种误点可能，其素材（全部1/2.png）也一并从 Assets/RecognitionObject 移除。
 */
export const TAB_CATEGORIES = {
    "材料": ["tabMaterial1", "tabMaterial2"],
    "料理": ["tabFood1", "tabFood2"]
};

// 每轮固定要用的模板（分类页签那两张是动态的，单独校验）
export const REQUIRED_TEMPLATES = [
    "device",
    "openDevice",
    "targetFood",
    "capacityFull",
    "confirmAccess",
    "confirm",
    "exitDevice",
    "demolishConfirm"
];

// 只改变俯仰，不动 orientation / 传送落地后的水平朝向。
export const CAMERA_PITCH_CLAMP_Y = -10000;

export const DEFAULT_CAMERA = {
    pitchFromTop: 7500,
    clampPasses: 4
};

// 滚轮位置：屏幕右侧居中（1080p 下约为 1440,540）
export const SCROLL_RATIO = {
    x: 0.75,
    y: 0.5
};

export const DEFAULT_TIMINGS = {
    restoreDelay: 1500,
    pathSettleDelay: 1000,

    cameraClampPassDelay: 100,
    cameraClampSettleDelay: 150,
    cameraSettleDelay: 400,

    // 拆除前重新对准装置。退出装置存储页后准星可能没对着刚放的寄物装置，
    // 而「拆除返还」只在造物模式内、且视角对准装置时才出现，
    // 所以先把鼠标移到装置/画面中心，让相机转过去。
    reaimDelay: 600,

    enterCreationDelay: 600,
    typeSwitchDelay: 350,
    afterPlaceDelay: 800,

    moveStepHold: 300,
    moveStepGap: 150,
    afterInteractDelay: 600,
    panelOpenDelay: 800,

    // 滚完要等列表停稳再截图。一次滚 32 格（见 DEFAULT_LIMITS.scrollStepsPerTry），
    // 惯性比滚 1 格大得多，等不够会拍到还在晃的画面 → 匹配框飘 → 点错位置。
    scrollSettleDelay: 600,
    // 停稳检测的采样间隔
    scrollStillDelay: 120,
    // 点击目标物品的间隔。60ms 偏快，游戏偶发吞点击（点了没反应）反而更慢，100ms 更稳。
    foodClickInterval: 100,
    // 每次点击后把光标挪到空地（park）之后的等待。
    // 光标压在图标上会被截进画面 / 触发悬停高亮，下一次识别时"刚点过的那个"反而匹配不上
    // ——命中集合每帧都在变，就是左右横跳的来源。挪开后要给它一点时间恢复原样。
    foodParkDelay: 30,
    uiClickDelay: 400,
    pollInterval: 150,

    // 弹窗类按钮的额外等待。「确认存取 → 确认 → 退出」这一串原来太快，点空了。
    uiClickSettleDelay: 250,   // 找到按钮后先等它稳定（弹窗动画会飘），再点
    uiClickMoveDelay: 30,      // 移动光标到按钮中心后、按左键之前的停顿
    uiClickVerifyDelay: 300,   // 点完等一会儿再去校验有没有点中
    afterConfirmAccessDelay: 900, // 点完「确认存取」到找「确认」之间的等待
    afterConfirmDelay: 800,       // 点完「确认」到找「退出」之间的等待

    deleteSwitchDelay: 500,
    afterDeleteDelay: 500,
    exitCreationDelay: 500,
    // 清场拆除后的稳定等待，给界面关闭留时间
    clearExistingSettleDelay: 600,
    // 清场按造物键的间隔：比收尾拆除长一点，刚传送落地游戏响应慢
    clearSwitchDelay: 700,
    // 清场二次确认的间隔：命中后隔这么久再看一眼，滤掉一闪而过的误匹配
    clearRecheckDelay: 200,

    cycleInterval: 1000
};

export const DEFAULT_LIMITS = {
    typeSwitchMax: 12,
    moveMax: 40,
    // 找目标物品时最多滚几轮。滚动只在"这一轮没找到"时发生 ——
    // 找到就立刻 return 去点击，不会继续滚，所以步子迈大也不会跳过目标。
    scrollMax: 50,
    // 单格滚轮量（负数为向下滚）
    scrollDelta: -120,
    // **每滚一次 = 连发几格**。
    // 只滚 1 格的话，图标往往只露出一部分就被裁进画面：模板匹配能过，但框的位置偏；
    // 点一下 UI 又把这一项完整展开（图片 + 数字），列表一重排，上次的坐标就落到别的东西上。
    // 一次滚 32 格（= 120 × 32 = 3840 单位），翻得快、少等几轮 600ms 的停稳。
    // ⚠️ 步子被"列表可视高度"卡着上限：单次跳跃一旦超过一屏，中间那几行根本没渲染出来，
    //    就会漏检 —— 症状是"目标明明在列表里，脚本却报翻到底了"。再往上调之前先确认没漏。
    scrollStepsPerTry: 32,
    // **滚完必须确认列表真的停了再开点**。
    // 滚轮事件一次性连发 32 格，游戏那边是平滑滚动动画，事件发完画面还在滑；
    // 这时候照着刚锁定的坐标点，点到的就是正在滑过光标底下的**别的物品**。
    // 判据：连续采样目标框位置，位移都不超过 scrollStillDrift 像素、且连续够 scrollStillHits 次。
    scrollStillMax: 12,     // 最多采样几次（超出就按最后一次位置继续）
    scrollStillHits: 2,     // 连续几次"位移够小"才算停稳
    scrollStillDrift: 2,    // 位移不超过这么多像素算"没动"
    // 装置一次能装多少。**不进设置面板**：每次存取就这么多，改它没有意义。
    // 点击上限 = min(识别到的数量 N, capacityLimit)：
    //   - N ≤ 32 → 点 N 次就够了（点 1 次存 1 个），不用等「容量已满」
    //   - N > 32 → 点到第 32 个自然出现「容量已满」，剩下的本来就装不下
    //   - N 认不到 → 按 32 次，靠「容量已满」提前停（日志会明确告警）
    capacityLimit: 32,
    capacityWaitMax: 20,
    uiClickRetry: 10,
    demolishVerifyMax: 10,
    pollInterval: 150,
    // 稳定检测：连着两次截图里按钮中心位移不超过 uiClickMaxDrift 像素才认为停稳
    uiClickStableMax: 6,
    uiClickMaxDrift: 6,
    // 点完校验：没点中就再点，最多这么多次
    uiClickVerifyMax: 5,
    // 开造前清场：最多连续拆掉几个残留造物
    clearExistingMax: 3,
    // 清场时「拆除返还」若在拆除后仍反复出现，最多再点几次就收手
    // （拆完界面本应自行关闭；一直不走多半是误匹配，继续点画面中心容易误伤）
    clearStuckLimit: 2,
    // 目标料理自适应阈值：同一张图在屏幕上匹配到 2 个及以上 → 阈值偏低（误匹配相似项），
    // 逐步抬高直到只剩 1 个命中。以下两项是抬升的步长与上限。
    adaptiveThresholdStep: 3,
    adaptiveThresholdMax: 95,
    // 目标料理多命中时的"就近沿用"半径（像素）。
    // 每次点击都重新识图；上一帧点击位置附近若仍有命中就继续点它，
    // "一屏两个相同料理图标"时就不会左右跳点。
    // 只用它在"已识别到的命中"之间选一个，不用来跳过识别。
    foodClickNearPx: 48,
    // 每点几次检查一次「容量已满」。点得比这快时可以隔几次查一次来提速。
    capacityCheckEvery: 2,
    // 数字去重：两个框 x、y 方向重叠都超过这个像素数才算同一个数字
    digitMaxOverlap: 2,
    // 扫描时用：要试的「图标下方偏移」列表（像素，负数 = 往图标内部上方挪，
    // 数字压在图标右下角时用它）。只在《诊断报告》里跑，不进设置面板。
    digitScanOffsets: "-32,-16,0,16,32,48,64",
    // 高度一致性过滤（百分数，0 = 关）：只保留高度差不多的命中。
    // 区域比数字大时会把图标边框、分隔线、角标背景一起框进来，它们常被认成一个数字；
    // 真正的数字同一行同一字号，高度一致。
    digitHeightTol: 35,
    // 数量识别区域 = 目标物品图标正下方的一块，这三个值微调它。
    // padX **千万别往大调**：往左扩会框进图标左边缘的竖线，那条线被认成数字 1，
    // 拼成前导 1 —— 真实数量 1667 就是这么变成 11667 的。
    countRegionPadX: 0,
    countRegionOffsetY: 0,
    countRegionHeight: 48,
    // 数量的合理上限，超过就当成误识别（区域里混进了别的数字）。
    // **必须 ≥ 9999**（背包单格上限）：真实数量 1667 曾被 999 误杀。
    // 要挡的是 5 位以上噪声（11667 / 1711111 这种），4 位以内的都是合理的。
    countMax: 9999,
    // 点击进度每隔几次报一次（0 = 不报）
    foodLogEvery: 10,
    // 侦察锁定：**不动鼠标连拍几帧**再下结论，而不是拍一张就认。
    // 同一位置跨帧取最高分，并记下它出现了几帧 —— 真目标应该帧帧都在。
    foodReconShots: 3,
    foodReconShotDelay: 30,
    // 判定"是同一个位置"的容差（像素）
    foodReconfirmTol: 8,
    // ---- 点击后重新定位（列表会在点击之间挪位，见 actions.clickFoodUntilFull）----
    // 判定"位置没变"的容差（像素）。**一次不变就认为稳定**，之后照这个点完剩下的次数。
    foodRelocateTol: 2,
    // 连续这么多次"每次点完位置都在变" → 直接报错停手。
    // 偶尔挪一次是正常的（选中态让列表重排），连着挪说明列表一直在动，
    // 再点下去就是给一堆不同物品各点一下了 —— 宁可停，不要误存。
    foodUnstableStop: 3,
    // ---- 翻页"到底了"检测（见 utils/frameprobe.js）----
    // 目标在列表深处时要一直往下滚；滚到底还找不到就该立刻收工，
    // 而不是把 scrollMax 老实滚完（每次滚还要等 600ms 让画面停稳）。
    // 判据：每次翻页前拍一张右侧长条，跟上一张比像素；连续这么多次没变 → 到底了。
    // 探测区域（屏幕比例）：物品列表在画面右侧，取那一块
    scrollProbeRegion: { x: 0.62, y: 0.20, w: 0.34, h: 0.66 },
    // 采样网格：20×20 = 400 个点（再多就是白跑 Jint→CLR 调用）
    scrollProbeGrid: 20,
    // 单个采样点三通道最大差超过这个数，才算这个点"变了"
    scrollProbePixelTol: 12,
    // 变化点占比低于这个百分数 → 认为这一页**没动**
    scrollProbeChangedPct: 2,
    // 连续这么多次"翻页画面没变" → 判定列表拉不动了，报错收工
    scrollBottomHits: 3,
    // 开点后的软复核（默认 0 = 不复核）。位置确认稳定之后才会用到它：
    // 每点这么多次回头验一次，发现又挪了就重新锁定。
    foodReverifyEvery: 0,
    foodMissStop: 2,
    // 锁定半径（像素）：开点之后只认"侦察锁定位置附近"的命中。
    // 远处的命中一律丢弃——哪怕阈值降回来让「奇怪的XX」重新进候选，它离锁定位置远，
    // 也不会被点中。这一条根治"左一个右一个"的跳点。
    foodLockRadius: 60,
    // 停鼠标的空地（屏幕百分比）。每次点击前后把光标停在这儿，
    // 别让它压在物品图标上（会被截进画面 / 触发悬停高亮）。
    // 默认画面左上角内侧；若那儿正好有东西，改这两个百分比即可。
    foodParkXPercent: 2,
    foodParkYPercent: 4
};

export const DEFAULT_SCREEN = {
    width: 1920,
    height: 1080
};
