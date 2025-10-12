/**
 * 带验证的单击函数
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {string} targetText - 需要验证消失的目标文字
 * @param {number} maxRetries - 最大重试次数，默认为10
 * @returns {Promise<boolean>} 是否成功
 */
this.clickWithVerification = async function(x, y, targetText, maxRetries = 20) {
    for (let i = 0; i < maxRetries; i++) {
        keyUp("LBUTTON");
        click(x, y);
        await sleep(400); 
        
        // 验证目标文字是否消失
        let captureRegion = captureGameRegion();
        let resList = captureRegion.findMulti(ocrRoThis);
        captureRegion.dispose();
        let textFound = false;
        
        if (resList && resList.count > 0) {
            for (let j = 0; j < resList.count; j++) {
                if (resList[j].text.includes(targetText)) {
                    textFound = true;
                    break;
                }
            }
        }
        
        // 如果文字消失了，说明点击成功
        if (!textFound) {
            return true;
        }
    }
    
    log.warn(`经过${maxRetries}次点击，文字"${targetText}"仍未消失`);
    return false;
}

/**
 * 尝试领取地脉花奖励
 * @returns {Promise<void>}
 */
this.attemptReward = async function (retryCount = 0) {
    const MAX_RETRY = 3;
    if (retryCount >= MAX_RETRY) {
        throw new Error("超过最大重试次数，领取奖励失败");
    }

    log.info("开始领取地脉奖励");
    keyPress("F");
    await sleep(500);

    // 识别是否为地脉之花界面
    let captureRegion = captureGameRegion();
    let resList = captureRegion.findMulti(ocrRoThis); // 使用预定义的ocrRoThis对象
    captureRegion.dispose();
    let isValid = false;
    let condensedResin = null;
    let originalResin = null;
    let fragileResin = null;
    let isResinEmpty = false;
    let dobuleReward = false;
    let isOriginalResinEmpty = false;

    if (resList && resList.count > 0) {
        // 分析识别到的文本
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("浓缩树脂")) {
                isValid = true;
                condensedResin = res;
            } else if (res.text.includes("原粹树脂")) {
                isValid = true;
                originalResin = res;
            } else if (res.text.includes("脆弱树脂") && settings.fragileResin) {
                isValid = true;
                fragileResin = res;
            } else if (res.text.includes("双倍掉落")) {
                isValid = true;
                dobuleReward = true;
            } else if (res.text.includes("补充")){
                isValid = true;
                isOriginalResinEmpty = true;
            } else {
                isValid = true;
                isResinEmpty = true;
            }
        }        // 处理不同的树脂情况
        if (originalResin && dobuleReward && !isOriginalResinEmpty) {
            log.info("选择使用原粹树脂，获得双倍产出");
            await clickWithVerification(
                Math.round(originalResin.x + originalResin.width / 2) + 400, 
                Math.round(originalResin.y + originalResin.height / 2),
                "使用"
            );
        } else if (condensedResin) {
            log.info("选择使用浓缩树脂");
            await clickWithVerification(
                Math.round(condensedResin.x + condensedResin.width / 2) + 400, 
                Math.round(condensedResin.y + condensedResin.height / 2),
                "使用"
            );
        } else if (originalResin && !isOriginalResinEmpty) {
            log.info("选择使用原粹树脂");
            await clickWithVerification(
                Math.round(originalResin.x + originalResin.width / 2) + 400, 
                Math.round(originalResin.y + originalResin.height / 2),
                "使用"
            );
        } else if (fragileResin) {
            log.info("选择使用脆弱树脂");
            await clickWithVerification(
                Math.round(fragileResin.x + fragileResin.width / 2) + 400,
                Math.round(fragileResin.y + fragileResin.height / 2),
                "使用"
            );
        } else if (isResinEmpty && isOriginalResinEmpty) {
            log.error("树脂用完了呢");
            keyPress("VK_ESCAPE");
            throw new Error("原粹树脂不足20，无法领取奖励");
        }
        if (settings.friendshipTeam) {
            log.info("切换回战斗队伍");
            await sleep(500);
            const switchSuccess = await switchTeam(settings.team);
        }
    }

    // 界面不正确，尝试重试
    if (!isValid) {
        log.info("当前界面不是地脉之花界面，重试");
        await genshin.returnMainUi();
        await sleep(1000);
        await autoNavigateToReward();
        await attemptReward(++retryCount);
    }
}