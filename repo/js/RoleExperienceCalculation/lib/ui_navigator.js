// UI交互功能模块
var UI = {
    // 进入角色列表界面
    enterRoleListInterface : async function() {
        //log.info("正在进入角色界面...");
        try {
            // 尝试按下L键进入角色配对界面
            log.info("尝试进入配对界面");
            keyPress("VK_L");
            await sleep(3500)
            
            // 点击角色
            click(450, 500);
            await sleep(100);
            return true;
        } catch (error) {
            log.error("进入界面失败: {error}", error);
            return false;
        }
    },
    
    // 进入背包 - 养成道具
    backpackDevelopmentProps : async function() {
        //log.info("打开背包，选择养成道具");
        
        try {
            // 尝试按下B键打开背包
            log.info("按下B键打开背包");
            keyPress("VK_B");
            //选择养成道具界面
            log.debug("选择养成道具界面");
            await sleep(1000);
            click(765, 50);
            await sleep(100);
            return true;
           
        } catch (error) {
            log.error("进入界面失败: {error}", error);
            return false;
        }
    },

    /** 
     * 界面滚动页面函数
     * @param {number} totalDistance - 滚动的总距离（像素）
     *    正数：向上滚动；
     *    负数：向下滚动
     * @param {number}stepDistance - 每次移动的步长（像素），默认10
     * @param {number}delayMs - 每次移动后的延迟时间（毫秒），默认5ms
     * @param {Object}startPosition - (可选)自定义起始位置，接受X,Y坐标
     * @returns {Promise<boolean>}
     */
    scrollPageFlexible: async function(totalDistance, stepDistance = 10, delayMs = 5, startPosition = null) {
        try {
            // 默认起始位置配置
            const defaultStartPositions = {
                up: { x: 400, y: 750 },    // 向上滚动起始位置
                down: { x: 400, y: 130 }   // 向下滚动起始位置
            };

            // 确定滚动方向
            const isUpward = totalDistance > 0;
            const direction = isUpward ? -1 : 1;
            const absoluteDistance = Math.abs(totalDistance);

            // 选择起始位置
            let startPos;
            if (startPosition) {
                // 使用传入的起始位置
                startPos = startPosition;
            } else {
                // 使用默认位置
                startPos = isUpward ? defaultStartPositions.up : defaultStartPositions.down;
            }

            // 移动到起始位置
            moveMouseTo(startPos.x, startPos.y);
            await sleep(50);

            // 按下鼠标开始拖动
            leftButtonDown();

            // 执行滚动
            const stepCount = Math.ceil(absoluteDistance / stepDistance);
            for (let i = 0; i < stepCount; i++) {
                const remaining = absoluteDistance - i * stepDistance;
                const currentStep = Math.min(stepDistance, remaining);

                moveMouseBy(0, direction * currentStep);
                await sleep(delayMs);
            }

            // 释放鼠标
            await sleep(700);
            leftButtonUp();
            await sleep(500);

            return true;
        } catch (error) {
            log.error("滚动页面时发生错误: {error}", error.message);
            return false;
        }        
    },

    // UI工具模块 - 处理UI检测
    UIUtils: {
        // 检测是否位于角色界面
        isInRoleUI: function() {
            const rolesListUI = RecognitionObject.TemplateMatch(
                file.readImageMatSync("assets/RecognitionObject/ReturnIcon.png"),
                0,
                0,
                1920,
                1080
            );
            
            const ro = captureGameRegion();
            const res = ro.find(rolesListUI);
            ro.dispose();
            return !res.isEmpty();
        },
        
        // 检测是否在背包界面
        isInBackpack: function() {
            const BackpackIcon = RecognitionObject.TemplateMatch(
                file.readImageMatSync("assets/RecognitionObject/Bagpack.png"),
                0,
                0,
                640,
                216
            );

            const ro = captureGameRegion();
            const res = ro.find(BackpackIcon);
            ro.dispose();
            return !res.isEmpty();
        },
        
        // 检测背包是否有过期物品
        isExpiredItem: function() {
            const BackpackIcon = RecognitionObject.TemplateMatch(
                file.readImageMatSync("assets/RecognitionObject/Confirm.png"),
                760,
                700,
                90,
                90
            );

            const ro = captureGameRegion();
            const res = ro.find(BackpackIcon);
            ro.dispose();
            return !res.isEmpty();
        }
    }
}

// 游戏ui导航
var UiNavigation = {
    /**
     * 进入角色界面选项
     * 回到主界面 → 进入角色配对界面 → 验证游戏界面
     * @param {number} maxRetries - 最大重试次数（默认3次，最小1次）
     * @param {number} delay - 重试间隔（毫秒，默认1000ms，最小100ms）
     * @returns {Promise<boolean>} 成功返回true，失败抛出错误
     */
    roleUiNavigation: async function(maxRetries = 3, delay = 1000) {
        // 1. 参数合法性校验，避免无效配置
        const validMaxRetries = Math.max(1, parseInt(maxRetries, 10) || 3);
        const validDelay = Math.max(100, parseInt(delay, 10) || 1000);

        // 记录当前重试次数
        let currentRetry = 0;

        // 定义递归执行函数
        async function attempt() {
            // 检测并回到主界面
            await genshin.returnMainUi();
            log.info("已回到游戏主界面");

            try {
                await sleep(1000); // 等待界面加载

                // 进入角色界面
                const enterResult = await UI.enterRoleListInterface();
                if (!enterResult) {
                    throw new Error("进入角色界面失败（按钮未响应/点击坐标错误）");
                }
                log.info("操作完成，开始界面检测…");

                // 检测是否成功进入角色界面
                await sleep(1000); // 等待界面加载
                const isInRoleUI = UI.UIUtils.isInRoleUI();
                if (!isInRoleUI) {
                    throw new Error("角色UI检测失败（界面未正确加载/识别区域错误）");
                }
                log.info("成功进入角色界面");
                return true;

            } catch (error) {
                // 重试次数+1
                currentRetry++;
                log.warn(`执行失败，错误：${error.message}，正在进行第 ${currentRetry} 次重试...`);

                // 判断是否达到最大重试次数
                if (currentRetry >= validMaxRetries) {
                    throw new Error(`达到最大重试次数（${validMaxRetries}次），任务执行失败：${error.message}`);
                }

                // 等待指定延迟后，递归重试
                await sleep(validDelay);
                return attempt();
            }
        }

        // 启动第一次尝试
        log.info(`开始尝试进入角色界面，最大重试次数：${validMaxRetries}，重试间隔：${validDelay}ms`);
        return attempt();
    },

    /**
     * 进入背包 - 养成道具
     * 回到主界面 → 进入背包界面 → 验证游戏界面
     * @param {number} maxRetries - 最大重试次数（默认3次，最小1次）
     * @param {number} delay - 重试间隔（毫秒，默认1000ms，最小100ms）
     * @returns {Promise<boolean>} 成功返回true，失败抛出错误
     */
    BackpackUiNavigation: async function(maxRetries = 3, delay = 1000) {
        // 参数合法性校验，避免无效配置
        const validMaxRetries = Math.max(1, parseInt(maxRetries, 10) || 3);
        const validDelay = Math.max(100, parseInt(delay, 10) || 1000);

        // 记录当前重试次数
        let currentRetry = 0;

        // 定义递归执行函数
        async function attempt() {
            try {
                // 检测并回到主界面
                await genshin.returnMainUi();
                log.info("已回到游戏主界面");

                await sleep(1000);

                // 进入背包界面
                const enterBackpack = await UI.backpackDevelopmentProps();
                if (!enterBackpack) {
                    throw new Error("打开背包失败（按钮未响应/点击坐标错误）");
                }
                log.info("操作完成，开始界面检测…");

                // 检测是否成功进入角色UI
                await sleep(1000); // 等待界面加载
                const isInBackpack = UI.UIUtils.isInBackpack();
                if (!isInBackpack) {
                    throw new Error("角色UI检测失败（界面未正确加载/识别区域错误）");
                }
                log.info("成功打开背包");
                return true;

            } catch (error) {
                // 重试次数+1
                currentRetry++;
                log.warn(`执行失败，错误：${error.message}，正在进行第 ${currentRetry} 次重试...`);

                // 判断是否达到最大重试次数
                if (currentRetry >= validMaxRetries) {
                    throw new Error(`达到最大重试次数（${validMaxRetries}次），任务执行失败：${error.message}`);
                }

                // 等待指定延迟后，递归重试
                await sleep(validDelay);
                return attempt();
            }
        }

        // 启动第一次尝试
        log.info(`开始尝试打开背包，最大重试次数：${validMaxRetries}，重试间隔：${validDelay}ms`);
        return attempt();
    },

    // 角色筛选（照搬脚本：AutoSwitchRoles（Tool_tingsu））
    FilterRoles: async function(roleName) {
        // 执行筛选前清除筛选信息
        await sleep(300);
        click(730,940)

        const filterConfig = {};
        try {
            const filterContent = file.readTextSync('assets/RecognitionObject/角色筛选/attribute.txt');
            const lines = filterContent.split('\n');
            lines.forEach(line => {
                // 使用中文逗号分割，并去除可能的空格
                const [name, element, weapon] = line.trim().split(/，\s*/).map(item => item || null);
                if (name) { // 只要角色名存在就记录，元素和武器可为空
                    filterConfig[name] = { element, weapon };
                }
            });
        } catch (error) {
            log.error(`读取筛选配置失败: ${error}`);
        }

        // 预加载"暂无筛选结果"模板
        let noResultTemplate;
        try {
            noResultTemplate = file.readImageMatSync('assets/RecognitionObject/角色筛选/暂无筛选结果.png');
        } catch (error) {
            log.error(`加载"暂无筛选结果"模板失败: ${error}`);
        }

        await sleep(1000);

        // 执行筛选操作
        const filterInfo = filterConfig[roleName];
        // let hasNoFilterResult = false; // 标记是否存在无筛选结果状态
        if (filterInfo && noResultTemplate) {
            try {
                log.info(`对角色【${roleName}】执行筛选: 元素=${filterInfo.element || '空'}, 武器=${filterInfo.weapon || '空'}`);

                // 点击筛选按钮
                const ro1 = captureGameRegion();
                const filterBtn = ro1.find(RecognitionObject.TemplateMatch(
                    file.readImageMatSync('assets/RecognitionObject/角色筛选/筛选.png'), 0, 0, 1920, 1080
                ));
                ro1.dispose();
                if (filterBtn.isExist()) {
                    filterBtn.click();
                    await sleep(200);

                    // 元素不为空才执行元素筛选
                    if (filterInfo.element) {
                        const ro2 = captureGameRegion();
                        const elementBtn = ro2.find(RecognitionObject.TemplateMatch(
                            file.readImageMatSync(`assets/RecognitionObject/角色筛选/${filterInfo.element}.png`), 0, 0, 1920, 1080
                        ));
                        ro2.dispose();
                        if (elementBtn.isExist()) {
                            elementBtn.click();
                            await sleep(200);
                        } else {
                            log.warn(`未找到元素筛选图标: assets/RecognitionObject/角色筛选/${filterInfo.element}.png`);
                        }
                    } else {
                        log.info(`元素为空，跳过元素筛选`);
                    }

                    // 武器不为空才执行武器筛选
                    if (filterInfo.weapon) {
                        const ro3 = captureGameRegion();
                        const weaponBtn = ro3.find(RecognitionObject.TemplateMatch(
                            file.readImageMatSync(`assets/RecognitionObject/角色筛选/${filterInfo.weapon}.png`), 0, 0, 1920, 1080
                        ));
                        ro3.dispose();
                        if (weaponBtn.isExist()) {
                            weaponBtn.click();
                            await sleep(200);
                        } else {
                            log.warn(`未找到武器筛选图标: assets/RecognitionObject/角色筛选/${filterInfo.weapon}.png`);
                        }
                    } else {
                        log.info(`武器为空，跳过武器筛选`);
                    }

                    // 点击确认筛选（无论元素/武器是否为空都需要确认）
                    const ro4 = captureGameRegion();
                    const confirmFilterBtn = ro4.find(RecognitionObject.TemplateMatch(
                        file.readImageMatSync('assets/RecognitionObject/角色筛选/确认筛选.png'), 0, 0, 1920, 1080
                    ));
                    ro4.dispose();
                    if (confirmFilterBtn.isExist()) {
                        confirmFilterBtn.click();
                        await sleep(50); // 等待筛选结果显示

                        // 识别是否有"暂无筛选结果"提示
                        const noResultRo = RecognitionObject.TemplateMatch(noResultTemplate, 0, 0, 1920, 1080);
                        const ro5 = captureGameRegion();
                        const noResult = ro5.find(noResultRo);
                        ro5.dispose();
                        if (noResult.isExist()) {
                            log.warn(`筛选后无结果，跳过角色`);
                            return false;
                            /**
                             // 关闭筛选面板（如果需要）
                             keyPress("VK_ESCAPE");
                             await sleep(200);
                             keyPress("VK_ESCAPE");
                             await sleep(200);
                             keyPress("VK_ESCAPE");
                             await sleep(200);
                             */
                        } else {
                            return true;
                        }
                    } else {
                        log.warn('未找到确认筛选图标: assets/RecognitionObject/角色筛选/确认筛选.png');
                    }
                } else {
                    log.warn('未找到筛选图标: assets/RecognitionObject/角色筛选/筛选.png');
                }
            } catch (error) {
                log.error(`筛选操作失败: ${error}`);
            }

        }
    }
}

