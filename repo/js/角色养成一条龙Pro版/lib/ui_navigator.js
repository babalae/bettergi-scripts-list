// UI交互功能模块
var UI = {
    // 进入背包 - 养成道具
    backpackDevelopmentProps : async function() {
        try {
            log.info("按下B键打开背包");
            keyPress("VK_B");
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

    // 界面滚动页面函数
    scrollPageFlexible: async function(totalDistance, stepDistance = 10, delayMs = 5, startPosition = null) {
        try {
            const defaultStartPositions = {
                up: { x: 400, y: 750 },
                down: { x: 400, y: 130 }
            };

            const isUpward = totalDistance > 0;
            const direction = isUpward ? -1 : 1;
            const absoluteDistance = Math.abs(totalDistance);

            let startPos;
            if (startPosition) {
                startPos = startPosition;
            } else {
                startPos = isUpward ? defaultStartPositions.up : defaultStartPositions.down;
            }

            moveMouseTo(startPos.x, startPos.y);
            await sleep(50);

            leftButtonDown();

            const stepCount = Math.ceil(absoluteDistance / stepDistance);
            for (let i = 0; i < stepCount; i++) {
                const remaining = absoluteDistance - i * stepDistance;
                const currentStep = Math.min(stepDistance, remaining);

                moveMouseBy(0, direction * currentStep);
                await sleep(delayMs);
            }

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
    BackpackUiNavigation: async function(maxRetries = 3, delay = 1000) {
        const validMaxRetries = Math.max(1, parseInt(maxRetries, 10) || 3);
        const validDelay = Math.max(100, parseInt(delay, 10) || 1000);

        let currentRetry = 0;

        async function attempt() {
            try {
                await genshin.returnMainUi();
                log.info("已回到游戏主界面");

                await sleep(1000);

                const enterBackpack = await UI.backpackDevelopmentProps();
                if (!enterBackpack) {
                    throw new Error("打开背包失败（按钮未响应/点击坐标错误）");
                }
                log.info("操作完成，开始界面检测…");

                await sleep(1000);
                const isInBackpack = UI.UIUtils.isInBackpack();
                if (!isInBackpack) {
                    throw new Error("角色UI检测失败（界面未正确加载/识别区域错误）");
                }
                log.info("成功打开背包");
                return true;

            } catch (error) {
                currentRetry++;
                log.warn(`执行失败，错误：${error.message}，正在进行第 ${currentRetry} 次重试...`);

                if (currentRetry >= validMaxRetries) {
                    throw new Error(`达到最大重试次数（${validMaxRetries}次），任务执行失败：${error.message}`);
                }

                await sleep(validDelay);
                return attempt();
            }
        }

        log.info(`开始尝试打开背包，最大重试次数：${validMaxRetries}，重试间隔：${validDelay}ms`);
        return attempt();
    }
}
