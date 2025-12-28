// =========================================================================
//                       Multiplayer.js - 多人世界相关功能模块
// =========================================================================
// 此模块包含多人世界相关的功能：加入/离开多人世界、检测世界状态、处理多人对话等
// 依赖：OCR.js, Utils.js, Combat.js, TaskManager.js


const skipIfWorldLevelBelow = settings.multi_min_world || 59;
const skipIfWorldLevelAbove = settings.multi_max_world || 60;
var Multiplayer = {
    // === 全局配置常量 ===
    TIMER_DEFAULT_TIMEOUT: 5000,
    DEFAULT_SLIDER_CLICK_OFFSET: 3.5,
    SLIDER_TOP_CLICK_OFFSET: 1.5,
    MOUSE_MOVE_DELAY: 500,
    CLICK_DELAY: 600,
    TOP_RESET_DELAY: 1000,
    DEFAULT_CLICK_DELAY: 200,
    OCR_CLICK_DELAY: 27,        //点击间隔，根据电脑配置调整！
    ROI_CHECK_THRESHOLD: 0,
    SLIDER_BOTTOM_Y_THRESHOLD: 400,
    WHEEL_SCROLL_JSON_PATH: "assets/Recognition/滚轮下翻.json",

    // === 图片路径常量 ===
    PAIMON_MENU_IMAGE: 'assets/Recognition/paimon_menu.png',
    SOU_IMAGE: 'assets/Recognition/sou.png',
    F2_0P_IMAGE: 'assets/Recognition/0p.png',
    F2_1P_IMAGE: 'assets/Recognition/1p.png',
    F2_2P_IMAGE: 'assets/Recognition/2p.png',
    F2_3P_IMAGE: 'assets/Recognition/3p.png',
    F2_4P_IMAGE: 'assets/Recognition/4p.png',
    CO_OP_MODE_PAGE_IMAGE: 'assets/Recognition/Co-Op Mode Page.png',
    SLIDER_BOTTOM_IMAGE: 'assets/Recognition/Slider Bottom.png',
    FRIENDS_BUTTON_IMAGE: 'assets/Recognition/Friends Button.png',
    SLIDER_TOP_IMAGE: 'assets/Recognition/Slider Top.png',
    LV_IMAGE: 'assets/Recognition/Lv.png',
    PEOPLE1_IMAGE: 'assets/Recognition/People1.png',

    // === 识别对象属性 ===
    paimonMenuRo: null,
    souRo: null,
    f2_0pRo: null,
    f2_1pRo: null,
    f2_2pRo: null,
    f2_3pRo: null,
    f2_4pRo: null,
    opModePageRo: null,
    sliderBottomRo: null,
    characterMenuRo: null,
    leftSliderTopRo: null,
    leftSliderBottomRo: null,
    middleSliderTopRo: null,
    middleSliderBottomRo: null,
    rightSliderTopRo: null,
    rightSliderBottomRo: null,
    lvRo1: null,
    lvRo2: null,
    lvRo3: null,
    lvRo4: null,
    lvRo5: null,
    lvRo6: null,

    // 多人世界状态标识
    WORLD_STATUS: {
        SINGLE: 'single',   // 单人世界，无其他玩家
        MULTI: 'multi',     // 多人世界，2人
        FULL: 'full',       // 多人世界，玩家已满
        JOINING: 'joining', // 正在加入世界的过程中
        LEAVING: 'leaving', // 正在离开世界的过程中
        UNKNOWN: 'unknown'  // 世界状态未知（初始或异常）
    },

    // 玩家权限级别
    PLAYER_PERMISSIONS: {
        HOST: 'host',       // 房主：拥有全部管理权限
        GUEST: 'guest',     // 访客：2p
        FRIEND: 'friend',   // 好友：3p或4p
    },

    // === 状态变量 ===
    currentWorldStatus: 'unknown', // 当前所在世界的实时状态，对应 WORLD_STATUS 多人世界状态标识
    worldPlayerCount: 0,           // 当前世界中在线的玩家总数（含自己）
    worldHostUID: '',              // 房主的唯一标识（UID），空串表示未知或无房主
    currentPermissions: 'guest',   // 自身在该世界中的权限级别，对应 PLAYER_PERMISSIONS 玩家权限级别
    lastWorldJoinTime: 0,          // 最近一次成功加入世界的时间戳（Unix ms），0 表示未加入过

    // === 初始化函数 ===
    
    /**
     * 初始化多人世界模块
     */
    init: function() {
        log.info('初始化多人世界模块...');
        
        // 初始化识别对象
        this._initRecognitionObjects();
        
        log.info('多人世界模块初始化完成');
    },
    
    /**
     * 初始化识别对象
     */
    _initRecognitionObjects: function() {
        try {
            // 创建所有识别对象
            this.paimonMenuRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.PAIMON_MENU_IMAGE),
                0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            this.souRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SOU_IMAGE),
                1611, 92, 150, 55
            );
            
            // 创建玩家数量图标识别对象
            this.f2_0pRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.F2_0P_IMAGE),
                0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            this.f2_1pRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.F2_1P_IMAGE),
                0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            this.f2_2pRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.F2_2P_IMAGE),
                0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            this.f2_3pRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.F2_3P_IMAGE),
                0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            this.f2_4pRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.F2_4P_IMAGE),
                0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            this.opModePageRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.CO_OP_MODE_PAGE_IMAGE),
                0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            this.sliderBottomRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE),
                1800, 100, 10, 900
            );
            
            this.characterMenuRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.FRIENDS_BUTTON_IMAGE)
            );
            
            // Slider 识别对象
            this.leftSliderTopRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SLIDER_TOP_IMAGE),
                650, 50, 100, 100
            );
            
            this.leftSliderBottomRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE),
                650, 100, 100, 900
            );
            
            this.middleSliderTopRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SLIDER_TOP_IMAGE),
                1250, 50, 100, 200
            );
            
            this.middleSliderBottomRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE),
                1250, 100, 100, 900
            );
            
            this.rightSliderTopRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SLIDER_TOP_IMAGE),
                1750, 100, 100, 100
            );
            
            this.rightSliderBottomRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.SLIDER_BOTTOM_IMAGE),
                1750, 100, 100, 900
            );
            
            // Lv 识别对象
            this.lvRo1 = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.LV_IMAGE),
                310, 170 + 130 * 0, 222, 130
            );
            
            this.lvRo2 = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.LV_IMAGE),
                310, 170 + 130 * 1, 222, 130
            );
            
            this.lvRo3 = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.LV_IMAGE),
                310, 170 + 130 * 2, 222, 130
            );
            
            this.lvRo4 = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.LV_IMAGE),
                310, 170 + 130 * 3, 222, 130
            );
            
            this.lvRo5 = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.LV_IMAGE),
                310, 170 + 130 * 4, 222, 130
            );
            
            this.lvRo6 = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(this.LV_IMAGE),
                310, 170 + 130 * 5, 222, 130
            );
            
            log.debug('多人世界识别对象初始化完成');
        } catch (error) {
            log.error(`初始化多人世界识别对象失败: ${error.message}`);
        }
    },


    // === 状态检测函数 ===
    
    /**
     * 检测当前玩家状态
     * 先检测派蒙菜单，存在则检测0~4P图标，返回对应数字， 不存在派蒙或找不到0~4P图标则返回false
     * @returns {Promise<{status: string, count: number}|false>} 返回状态和玩家数量或false（错误）
     */
    detectPlayerCount: async function() {

        
        const region = captureGameRegion();
            const joinResult = captureGameRegion().find(RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/a.png`), 0, 0, 1920, 1080));
            if (joinResult.isExist()) {
                joinResult.click();
                    await sleep(8888);}
        // 1. 检查派蒙菜单
        const paimonFound = region.find(this.paimonMenuRo);
        if (!paimonFound || (paimonFound.x === 0 && paimonFound.y === 0)) {
            log.warn(`[detectPlayerCount] 未找到派蒙菜单`);
            return {status: 'loading', count: 0}; // 可能是加载界面
        }
        
        log.info(`[detectPlayerCount] 找到派蒙菜单，坐标 (${paimonFound.x}, ${paimonFound.y})`);
        
        // 2. 检查玩家数量图标(0~4)
        const playerIcons = [
            {ro: this.f2_0pRo, count: 0},
            {ro: this.f2_1pRo, count: 1},
            {ro: this.f2_2pRo, count: 2},
            {ro: this.f2_3pRo, count: 3},
            {ro: this.f2_4pRo, count: 4}
        ];
        
        for (const icon of playerIcons) {
            const found = region.find(icon.ro);
            if (found && found.x !== 0 && found.y !== 0) {
                log.info(`[detectPlayerCount] 找到 ${icon.count}P图标，坐标 (${found.x}, ${found.y})`);
                return {
                    status: icon.count === 1 ? 'single' : 'multi',
                    count: icon.count
                };
            }
        }
        
        // 3. 找到派蒙但找不到玩家图标
        log.warn(`[detectPlayerCount] 找到派蒙菜单，但未找到任何玩家数量标识`);
        return {status: 'unknown', count: 0};
    },

    // === 世界状态检测函数 ===
    // 定义一个函数用于识别图像
recognizeImage:  async function(recognitionObject, timeout = 200) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试识别图像
            let imageResult = captureGameRegion().find(recognitionObject);
            if (imageResult) {
                // log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
                // log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
                return { success: true, x: imageResult.x, y: imageResult.y };
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别图像`);
    return { success: false };
},

    // === 弹窗识别函数 ===
/**
 * 识别并处理弹窗（其他世界没有更新导致的）
 */
recognizeOnePopup: async function() {
        /* ---------- 1. 拼路径 ---------- */
    // const root    = `assets/imageClick/${popupName}`;
    // const iconDir = `${root}/icon`;

    // const iconFiles = `/${iconDir}/a.png`;
    const iconFiles = `lib/Online/assets/Confirm.png`;

    const tplMat = RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconFiles), 0, 0, 1920, 1080);
    
            const joinResult = captureGameRegion().find(tplMat);
            if (joinResult.isExist()) {
                joinResult.click();
}
},

    /**
     * 获取当前世界玩家数量
     * @returns {Promise<number|boolean>} 玩家数量或false（失败）
     */
    getWorldPlayerCount: async function() {
        try {
            // 先确保在主界面
            await genshin.returnMainUi();
            
            // 打开F2界面
            keyPress('VK_F2');
            await sleep(700);
            
            // 点击左上角关闭可能的弹窗
            click(1, 1);
            await sleep(500);
            
            // 识别玩家数量区域
            const rect = { x: 830, y: 90, width: 260, height: 40 };
            const text = await this.ocrFixedRect(rect, 200);
            
            // 使用正则表达式提取玩家数量
            const match = text.match(/当前游戏进度内人数([1-4])\/4/);
            
            // 返回主界面
            await genshin.returnMainUi();
            
            if (match && match[1]) {
                const playerCount = Number(match[1]);
                log.info(`[getWorldPlayerCount] 检测到玩家数量: ${playerCount}`);
                return playerCount;
            } else {
                log.warn(`[getWorldPlayerCount] 无法识别玩家数量，OCR结果: "${text}"`);
                return false;
            }
            
        } catch (error) {
            log.error(`获取玩家数量异常: ${error.message}`);
            return false; // 返回false表示失败
        }
    },

    // === 加入/离开世界函数 ===

    /**
     * 打开F2界面
     * @returns {Promise<void>}
     */
    openF2: async function() {
        const F2_KEY_PRESS_DELAY = 700;
        const OPEN_F2_CLICK_X = 1735;
        const OPEN_F2_CLICK_Y = 1012;
        const OPEN_F2_CLICK_DELAY = 200;
        // 检查是否是单人
const result = await this.detectPlayerCount();
if (!result || result.count !== 0) {
            await this.outF2();}
        await genshin.returnMainUi();
        keyPress('VK_F2');
        await sleep(F2_KEY_PRESS_DELAY);
        click(OPEN_F2_CLICK_X, OPEN_F2_CLICK_Y);
        await sleep(OPEN_F2_CLICK_DELAY);
    },

    /**
     * 退出多人
     * @returns {Promise<void>}
     */
    outF2: async function() {
        const F2_KEY_PRESS_DELAY = 700;
        const CLOSE_F2_CLICK_X = 1535;
        const CLOSE_F2_CLICK_Y = 1010;
        const CLOSE_F2_DELAY = 3000;
        
        await genshin.returnMainUi();

// 只要玩家数≠0 且没出错就继续（可能是多人模式下的一个人）
const res = await this.detectPlayerCount();
if (res === false || res.count === 0) return false;

        keyPress('VK_F2');
        await sleep(F2_KEY_PRESS_DELAY);
        click(CLOSE_F2_CLICK_X, CLOSE_F2_CLICK_Y);
        await sleep(1000);
        click(1150, 755);
        await sleep(CLOSE_F2_DELAY);    
        // 等待 200 ms × 180 次 = 36 秒
    for (let i = 0; i < 180; i++) {
        const res = await this.detectPlayerCount();   // 返回对象或 false
        if (res !== false) {                          // 只要出现派蒙（无论 count 是多少）就结束
            log.info('已进入');
        await sleep(500);
            return true;
        }
        await sleep(200);
    }

        log.warn('outF2：36 秒内未检测进入，超时');
        return false;

    },

    // === 世界选择函数 ===

    /**
     * 点击符合条件的多人世界
     * @param {number} skipIfWorldLevelBelow - 跳过低于此等级的世界
     * @param {number} skipIfWorldLevelAbove - 跳过高于此等级的世界
     * @returns {Promise<boolean>} 是否进入转场（true=已进入，false=未进入）
     */
    clickSuitableWorld: async function() {
        const LV_ROI_OFFSET = -10;
        const LV_ROI_WIDTH = 65;
        const LV_ROI_HEIGHT = 30;
        const PEOPLE_ROI_X = 1620;
        const PEOPLE_ROI_Y_OFFSET = -68;
        const PEOPLE_ROI_WIDTH = 10;
        const PEOPLE_ROI_HEIGHT = 36;
        const CLICK_X = 1622;
        
        let pageTries = 0;
        
        await sleep(100);
        
        // 获取所有Lv识别对象
        const roList = [
            this.lvRo1, this.lvRo2, this.lvRo3, 
            this.lvRo4, this.lvRo5, this.lvRo6
        ];
        
        const captureRegion = captureGameRegion();
        
        // 遍历所有Lv区域
        for (let i = 0; i < roList.length; i++) {
            const found = captureRegion.find(roList[i]);
            
            // 如果没找到Lv图标，说明可能进入加载界面
            if (!found || (found.x === 0 && found.y === 0)) {
                log.info('检测到加载界面，跳剩余流程');
                return true;   // 告诉外层"我已经进入转场"
            }
            
            // log.info('区域 {index} 已找到 Lv.png，坐标 ({x},{y})', i + 1, found.x, found.y);
            
            // 计算OCR区域并检查是否越界
            const ocrROI = this.clampROI(
                found.x + LV_ROI_OFFSET, 
                found.y + LV_ROI_OFFSET, 
                LV_ROI_WIDTH, 
                LV_ROI_HEIGHT, 
                genshin.width, 
                genshin.height
            );
            
            // 如果ROI超出屏幕，跳过本次OCR
            if (ocrROI.width === 0 || ocrROI.height === 0) {
                log.info("跳过本次 OCR");
                continue;   // 直接跳过本次循环，避免后续OCR报错
            }
            
            // 执行OCR识别：等级16-60
            const resList2 = captureRegion.findMulti(
                RecognitionObject.ocr(ocrROI.x, ocrROI.y, ocrROI.width, ocrROI.height)
            );
            
            // 处理所有OCR识别结果
            for (let j = 0; j < resList2.count; j++) {
                // log.info('OCR 识别结果：{text}', resList2[j].text);
                const match = resList2[j].text.match(/\d+/);
                
                // 检查是否有数字匹配
                if (!match) {
                    log.warn('无法从OCR结果中提取等级数字');
                    continue;
                }
                
                const level = parseInt(match[0], 10);
                
                // 检查等级是否在允许范围内
                if (level < skipIfWorldLevelBelow || level > skipIfWorldLevelAbove) {
                    log.info(`世界等级 ${level} 不在允许范围 (${skipIfWorldLevelBelow}-${skipIfWorldLevelAbove})，跳过`);
                    continue;
                }
                
                // log.info('等级满足要求');
                
                // 检查是否为单人世界
                const peopleROI = this.safeROI(
                    PEOPLE_ROI_X, 
                    found.y + PEOPLE_ROI_Y_OFFSET, 
                    PEOPLE_ROI_WIDTH, 
                    PEOPLE_ROI_HEIGHT
                );
                
                const People1 = RecognitionObject.TemplateMatch(
                    file.ReadImageMatSync(this.PEOPLE1_IMAGE),
                    peopleROI.x,
                    peopleROI.y,
                    peopleROI.width,
                    peopleROI.height
                );
                
                const found1 = captureRegion.find(People1);
                const isSinglePlayer = false; // true==多人
                
                // 如果是单人世界或强制单人模式，则点击
                if (found1 && (found1.x > this.ROI_CHECK_THRESHOLD || isSinglePlayer)) {
                    // log.info('当前为单人世界');
                    click(CLICK_X, found.y);
                    await sleep(this.OCR_CLICK_DELAY);
                } else {
                    // log.info('当前为多人世界，跳过');
                }
            }
        }
        
        return false;
    },

    /**
     * 选择世界（递归滚动和点击）
     * @param {Object} localTimer - 定时器对象
     * @returns {Promise<boolean>} 是否成功选择
     */
    selectFriends: async function(localTimer = this.createTimer(30000)) {
        // 检查是否超时
        if (localTimer.isTimeout()) return false;

        await genshin.returnMainUi();
        // 检查是否是单人
        const result = await this.detectPlayerCount();
        if (!result || result.count !== 0) {
            await this.outF2();}
        
        await genshin.returnMainUi();
        await this.recognizeOnePopup('过期物品',200);

        await genshin.returnMainUi();
        // 打开F2界面
        await this.openF2();

        // 尝试点击符合条件的多人世界
        if (await this.clickSuitableWorld()) return true;

        // 说明正常点击，需要继续滚动
        log.info('selectFriends：第一次：ensureOpenF2 返回 2 → 继续滚动');
        
        // 第一轮滚动尝试
        for (let pageTries = 0; pageTries < 3; pageTries++) {
            const region2 = captureGameRegion();
            
            if (!(region2.find(this.souRo))) {
                log.info('selectFriends：不滚动，进入开始');
                return true;
            } else {
                log.info('selectFriends：滚动页面');
                await this.pageDown1(42);
                
                log.info('selectFriends：点击');
                if (await this.clickSuitableWorld()) return true;
            }
        }
        
        // 额外滚动尝试
        const region22 = captureGameRegion();
        if (!(region22.find(this.souRo))) {
            log.info('selectFriends：不滚动，进入开始');
            return true;
        } else {
            log.info('selectFriends：滚动页面');
            await this.pageDown1(40);
            
            log.info('selectFriends：点击');
            if (await this.clickSuitableWorld()) return true;
        }
        
        // 第三轮滚动尝试，最后一次循环到这里是7页，如果是8级世界一般都大于7页
        for (let pageTries = 0; pageTries < 3; pageTries++) {
            const region12 = captureGameRegion();            
            if (!(region12.find(this.souRo))) {
                log.info('selectFriends：不滚动，进入开始');
                return true;
            } else {
                log.info('selectFriends：滚动页面');
                await this.pageDown1(42);
                
                log.info('selectFriends：点击');
                if (await this.clickSuitableWorld()) return true;
            }
        }
        
        // 所有尝试失败，递归重试
        log.info('selectFriends：7 次滚动结束，重试');
        return await this.selectFriends(localTimer);
    },

    // === 等待进入世界函数 ===
    /**
     * 等待进入世界
     * @param {Object} timers - 定时器对象
     * @returns {Promise<boolean>} 是否成功进入
     */
    waitForWorldTransition: async function(timers = this.createTimer(300000)) {
        // 尝试选择好友世界
        const entered = await this.selectFriends(timers);
        if (!entered) { // 如果 selectFriends 返回 false，才记录失败
            log.warn('waitForWorldTransition：selectFriends 流程失败');
            return false;
        }

        log.info('等待界面响应，确认进入…');
        await sleep(3000);
        
    // 等待 200 ms × 180 次 = 36 秒
    for (let i = 0; i < 180; i++) {
        const res = await this.detectPlayerCount();   // 返回对象或 false
        if (res.status !== 'loading') {                          // 只要出现派蒙就结束
            log.info('已进入');
        await sleep(200);
            return true;
        }
        await sleep(200);
    }

        log.warn('waitForWorldTransition：36 秒内未检测进入，超时');
        return false;
    },
    
    

    
// === 战斗结束检测函数 ===
/**
 * 检测战斗是否结束
 * @returns {Promise<boolean>} 是否结束
 */
checkBattleEnd: async function() {
    const startTime = Date.now();

    keyPress('l');
    await sleep(600);

    while (Date.now() - startTime < 1500) {
        /* 成功区域 OCR：862,63 → 179×23 */
        const ocrResult = captureGameRegion().find(
            RecognitionObject.ocr(862, 63, 179, 23)
        );
        if (ocrResult && ocrResult.text.includes('正在读取队伍信息')) {
            log.info('战斗已结束（成功文案）');
            keyPress('l');
            keyPress('space');
            return true;
        }
        await sleep(50);          // 短间隔再扫
    }

    log.info('检测111');
    keyPress('l');
    await sleep(600);

    log.info('检测超时，视为未结束');
    return false;
},

// === OCR识别函数 ===
/**
 * 通用：指定区域 OCR 识别
 * @param {Object} ocrRegion  {x, y, width, height}
 * @param {number} timeout    毫秒
 * @returns {string|null}     识别到的文字或 null
 */
recognizeTextInRegion: async function(ocrRegion, timeout = 500) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const ocrResult = captureGameRegion().find(
                RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
            );
            if (ocrResult) return ocrResult.text;
        } catch (e) { /* 立即重试 */ }
        await sleep(50);
    }
    return null;
},


    
    // === 世界管理函数 ===
    
    /**
     * 踢出指定玩家（仅房主可用）
     * @param {number} playerNumber - 玩家编号
     * @returns {Promise<boolean>} 是否踢出成功
     */
    kickPlayer: async function(playerNumber) {
        try {

            log.info(`已踢出玩家 ${playerNumber}`);
            return true;
        } catch (error) {
            log.error(`踢出玩家异常: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 点击玩家菜单，记一下uid和名称
     */
    _clickPlayerMenu: async function(playerNumber) {
        try {
            return true;
        } catch (error) {
            log.error(`点击玩家菜单异常: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 确认踢出玩家，回到单人世界
     */
    _confirmKick: async function() {
        try {
            await this.outF2();
            return true;
        } catch (error) {
            log.error(`确认踢出异常: ${error.message}`);
            return false;
        }
    },
    
    /**
     * 输入好友UID
     */
    _inputFriendUID: async function(uid) {
        try {
            return true;
        } catch (error) {
            log.error(`输入好友UID异常: ${error.message}`);
            return false;
        }
    },
    
    // === 工具函数 ===
    
    /**
     * 创建定时器对象
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Object} 定时器对象，包含重新开始和检查超时的方法
     */
    createTimer: function(timeout = 20000) {
        let time = Date.now();
        return Object.freeze({
            reStart: function() { 
                time = Date.now(); 
            },
            isTimeout: function() { 
                return Date.now() - time >= timeout; 
            },
            getRemaining: function() {
                const elapsed = Date.now() - time;
                return Math.max(0, timeout - elapsed);
            }
        });
    },

    /**
     * 安全裁剪区域：防止 ROI 越界
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} w - 宽度
     * @param {number} h - 高度
     * @returns {Object} 安全的区域对象
     */
    safeROI: function(x, y, w, h) {
        const maxW = genshin.width;
        const maxH = genshin.height;
        
        const safeX = Math.max(0, x);
        const safeY = Math.max(0, y);
        const safeW = Math.min(w, maxW - safeX);
        const safeH = Math.min(h, maxH - safeY);
        
        return { x: safeX, y: safeY, width: safeW, height: safeH };
    },

    // === 页面滚动函数 ===

    /**
     * 向下翻页（没有细节控制）
     * @param {Object} sliderBottomRo - 滑块底部识别对象
     * @returns {Promise<void>}
     */
    pageDown: async function(sliderBottomRo) {
        let SliderBottom = captureGameRegion().find(sliderBottomRo);
        if (SliderBottom.isExist()) {
            log.info("当前页面已点击完毕，向下滑动");
            log.info("滑块当前位置:({x},{y},{w},{h})", 
                SliderBottom.x, SliderBottom.y, SliderBottom.Width, SliderBottom.Height);
            
            click(
                Math.ceil(SliderBottom.x + SliderBottom.Width / 2),
                Math.ceil(SliderBottom.y + SliderBottom.Height * this.DEFAULT_SLIDER_CLICK_OFFSET)
            );
            
            await moveMouseTo(0, 0);
            await sleep(this.CLICK_DELAY);
        }
    },

    /**
     * 回到页面顶部
     * @param {Object} sliderTopRo - 滑块顶部识别对象
     * @returns {Promise<void>}
     */
    pageTop: async function(sliderTopRo) {
        let SliderTop = captureGameRegion().find(sliderTopRo);
        if (SliderTop.isExist()) {
            log.info("滑条顶端位置:({x},{y},{w},{h})", 
                SliderTop.x, SliderTop.y, SliderTop.Width, SliderTop.Height);
            
            await moveMouseTo(
                Math.ceil(SliderTop.x + SliderTop.Width / 2),
                Math.ceil(SliderTop.y + SliderTop.Height * this.SLIDER_TOP_CLICK_OFFSET)
            );
            
            leftButtonDown();
            await sleep(this.MOUSE_MOVE_DELAY);
            leftButtonUp();
            
            await moveMouseTo(0, 0);
            await sleep(this.TOP_RESET_DELAY);
        }
    },

    /**
     * 鼠标滚轮翻页（慢，但精确）
     * @param {number} ok - 滚动次数，默认42次
     * @returns {Promise<void>}
     */
    pageDown1: async function(ok = 42) {
        const PAGEDOWN1_CLICK_X = 1111;
        const PAGEDOWN1_CLICK_Y = 555;
        const PAGEDOWN1_CLICK_DELAY = 100;
        const PAGEDOWN1_SCROLL_DELAY = 100;
        
        await this.recognizeOnePopup('过期物品',200);
        await sleep(PAGEDOWN1_CLICK_DELAY);
        click(PAGEDOWN1_CLICK_X, PAGEDOWN1_CLICK_Y);
        await sleep(PAGEDOWN1_CLICK_DELAY);
        
        for(let i = 0; i < ok; i++) {
            log.info("向下滑动");
            // 向下滚动
            await keyMouseScript.runFile(this.WHEEL_SCROLL_JSON_PATH);
        }
        
        await sleep(PAGEDOWN1_SCROLL_DELAY);
    },

    /**
     * 鼠标拖拽翻页
     * @param {number} totalDistance - 总滚动距离
     * @param {number} stepDistance - 单步滚动距离，默认10
     * @param {number} delayMs - 每步延迟时间(毫秒)，默认10
     * @returns {Promise<void>}
     */
    pageDown2: async function(totalDistance, stepDistance = 10, delayMs = 10) {
        const PAGEDOWN2_START_X = 1026;
        const PAGEDOWN2_START_Y = 880;
        const PAGEDOWN2_MOUSEDOWN_DELAY = 180;
        const PAGEDOWN2_MOUSEUP_DELAY = 600;
        const PAGEDOWN2_FINAL_DELAY = 550;
        
        moveMouseTo(PAGEDOWN2_START_X, PAGEDOWN2_START_Y);
        await sleep(PAGEDOWN2_MOUSEDOWN_DELAY);
        leftButtonDown();
        
        const steps = Math.ceil(totalDistance / stepDistance);
        for (let j = 0; j < steps; j++) {
            const remaining = totalDistance - j * stepDistance;
            const move = remaining < stepDistance ? remaining : stepDistance;
            moveMouseBy(0, -move);
            await sleep(delayMs);
        }
        
        await sleep(PAGEDOWN2_MOUSEUP_DELAY);
        leftButtonUp();
        await sleep(PAGEDOWN2_FINAL_DELAY);
    },
    
    /**
     * 检测滑块底部位置是否在指定Y坐标阈值之上
     * @returns {Promise<boolean>} 返回滑块底部是否在阈值之上
     */
    checkSliderBottom: async function() {
        const region = captureGameRegion();
        const found = region.find(this.sliderBottomRo);
        
        if (found && found.y < this.SLIDER_BOTTOM_Y_THRESHOLD) {
            log.info(`[checkSliderBottom] 找到滑块底部，坐标 (${found.x}, ${found.y})`);
            return true;
        }
        
        return false;
    },
    
    /**
     * OCR 识别固定矩形区域（无关键词过滤，最快 200 ms 超时）
     * @param {{x:number, y:number, width:number, height:number}} rect  识别区域（像素）
     * @param {number} [timeout=200]  最长等待时间（毫秒，默认 200）
     * @returns {string}  识别到的全部文字（未识别到返回空字符串）
     */
    ocrFixedRect: async function(rect, timeout = 300) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const roi   = captureGameRegion();
                const ocrObj = RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height);
                const resList = Array.from(roi.findMulti(ocrObj) || []);
                const text = resList.map(r => r.text).join('');
                if (text.length) return text;
            } catch (e) {
                log.error(`[ocrFixedRect] ${e.message}`);
            }
            await sleep(50); // 短间隔快速重试
        }
        return '';
    },

    /**
     * 防御式 ROI 计算，确保ROI不超出图像边界
     * @param {number} cx - 原始X坐标
     * @param {number} cy - 原始Y坐标
     * @param {number} cw - 原始宽度
     * @param {number} ch - 原始高度
     * @param {number} imgWidth - 图像宽度
     * @param {number} imgHeight - 图像高度
     * @returns {Object} 调整后的ROI区域
     */
    clampROI: function(cx, cy, cw, ch, imgWidth, imgHeight) {
        // 先保证起点不冲出左上角
        const x = Math.max(0, cx);
        const y = Math.max(0, cy);
        
        // 再保证终点不冲出右下角
        const maxW = imgWidth - x;
        const maxH = imgHeight - y;
        
        // 如果起点已经超出屏幕，直接返回零矩形
        if (maxW <= 0 || maxH <= 0) {
            log.warn(`ROI 完全超出屏幕，跳过 OCR: 起点(${x},${y}), 屏幕(${imgWidth},${imgHeight})`);
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        const width = Math.min(cw, maxW);
        const height = Math.min(ch, maxH);
        
        if (width !== cw || height !== ch) {
            log.info(`ROI 被裁剪: 请求(${cw}×${ch}) → 实际(${width}×${height})`);
        }
        
        return { x, y, width, height };
    },

    /**
     * 获取可用的多人世界功能列表
     * @returns {Array} 功能列表
     */
    getAvailableFunctions: function() {
        return [
            '检测多人世界状态',
            '获取玩家数量',
            '加入指定UID的世界',
            '加入指定等级世界',
            '离开当前世界',
            '发送聊天消息',
            '获取玩家状态',
            '踢出玩家（房主）'
        ];
    }
};

// 自动初始化
if (typeof genshin !== 'undefined') {
    Multiplayer.init();
}