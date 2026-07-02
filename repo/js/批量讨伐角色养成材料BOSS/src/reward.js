import { isCancellationError } from "./utils.js";

/**
 * 自动导航到奖励点（征讨之花位置）
 * 
 * 该函数通过以下步骤实现自动寻路：
 * 1. 调整为俯视视角
 * 2. 通过识别宝箱图标来调整方向和前进
 * 3. 检测攀爬状态并尝试脱离
 * 4. 当检测到"接触征讨之花"文字时停止
 * 
 * @async
 * @function autoNavigateToReward
 * @throws {Error} 当前进时间超过 40 次时抛出超时错误
 * @throws {Error} 当视野调整超过 50 次未成功时抛出超时错误
 * 
 * @example
 * await autoNavigateToReward();
 */
async function autoNavigateToReward() {
    try {
        const Rect = OpenCvSharp.OpenCvSharp.Rect;
        const page = new BvPage();
        const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/box.png"));

        const rewardRect = new Rect(1210, 515, 200, 50);
        const climbRect = new Rect(1686, 1030, 60, 23);

        let advanceNum = 0;
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
            if (await page.Locator("接触征讨之花", rewardRect).isExist()) {
                log.info("已到达领奖点，检测到文字：接触征讨之花");
                return;
            }
            
            if (advanceNum > 40) {
                throw new Error('前进时间超时');
            }
            
            // 2. 未到达领奖点，则调整视野
            for (let i = 0; i < 100; i++) {
                if (i > 50) throw new Error('视野调整超时');
                
                // 检查攀爬状态
                if (await page.Locator("Space", climbRect).isExist()) {
                    log.info("检测到攀爬状态，尝试脱离");
                    keyPress("x");
                    await sleep(1000);
                    keyDown("a");
                    await sleep(800);
                    keyUp("a");
                    keyDown("w");
                    await sleep(800);
                    keyUp("w");
                    continue;
                }
                
                // 查找宝箱图标
                const boxResult = page.Locator(boxIconRo).findAll();
                if (boxResult.count < 1) {
                    log.warn("未找到宝箱图标，重试");
                    moveMouseBy(200, 0);
                    await sleep(500);
                    continue;
                }
             
                const iconRes = boxResult[0];
                if (iconRes.X >= 920 && iconRes.X <= 980 && iconRes.Y <= 540) {
                    advanceNum++;
                    log.info(`视野已调正，前进第${advanceNum}次`);
                    break;
                } else {
                    // 小幅度调整
                    if (iconRes.Y >= 520) moveMouseBy(0, 920);
                    const adjustAmount = iconRes.X < 920 ? -20 : 20;
                    const distanceToCenter = Math.abs(iconRes.X - 920);
                    const scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50));
                    const adjustAmount2 = iconRes.Y < 540 ? scaleFactor : 10;
                    moveMouseBy(adjustAmount * adjustAmount2, 0);
                    await sleep(100);
                }
            }
            
            // 3. 前进一小步
            keyDown("w");
            await sleep(500);
            keyUp("w");
            await sleep(200);
        }
    } catch (error) {
        // 先检查是否为取消异常
        if (isCancellationError(error)) {
            throw error;
        }
        log.error(`自动寻路到奖励失败，error: ${error}`);
        throw error;
    }
}

/**
 * 领取讨伐奖励
 * 
 * 该函数通过以下步骤实现奖励领取：
 * 1. 识别并交互"接触征讨之花"（按 F 键）
 * 2. 处理脆弱树脂不足的情况（检测"补充"文字）
 * 3. 使用脆弱树脂领取奖励（检测"使用"文字）
 * 4. 关闭奖励界面（检测"点击"文字）
 * 5. 确认回到主界面后结束
 * 
 * @async
 * @function takeReward
 * @param {boolean} isInsufficientResin - 树脂是否不足的标志位
 * @returns {Promise<boolean>} 返回更新后的树脂不足状态
 * @throws {Error} 当领取奖励超过 100 次尝试时抛出超时错误
 * 
 * @example
 * let insufficientResin = false;
 * insufficientResin = await takeReward(insufficientResin);
 */
async function takeReward(isInsufficientResin) {
    try {
        const Rect = OpenCvSharp.OpenCvSharp.Rect;
        const page = new BvPage();

        const rewardRect = new Rect(1210, 515, 200, 50);    //地脉花交互
        const useRect = new Rect(850, 740, 250, 35);    //补充原粹树脂 or 使用原粹树脂
        const closeRect = new Rect(850, 960, 220, 35);    //关闭掉落奖励列表
        const mainUiRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/mainUi.png"));

        await page.Locator("接触征讨之花", rewardRect)
            .withRetryAction(async () => {
                log.info("检测到接触征讨之花，按 F 键交互");
                keyPress("F");
            })
            .WaitForDisappear();

        try {
            await page.Locator("使用原粹树脂", useRect).ClickUntilDisappears(3000)
            await page.Locator("点击空白区域继续", closeRect).ClickUntilDisappears(3000)
        } catch (error) {
            isInsufficientResin = true;
            await page.Locator("补充原粹树脂", useRect)
                .withRetryAction(async () => {
                    page.Click(1345, 300); //点击右上角 X 关闭窗口
                })
                .WaitForDisappear();
            log.info("领取失败，可能是原粹树脂不足，尝试关闭领取界面");
            log.debug("错误信息：{message}", error.message);
            log.debug("错误栈：{stack}", error.stack);
        }
        if (await page.Locator(mainUiRo).isExist()) {
            log.info("已回到主界面，领取奖励结束");
            return isInsufficientResin;
        }

        throw new Error('未成功回到主界面');
        
    } catch (error) {
        // 先检查是否为取消异常
        if (isCancellationError(error)) {
            throw error;
        }
        log.error(`领取奖励失败：${error.message}`);
        throw error;
    }
}

export { autoNavigateToReward, takeReward };
