(async function () {
    // 定义状态文件路径
    const STATE_FILE = "redeem_state.json";
    
    // 1. 检查配置项是否存在
    if (typeof settings === 'undefined' || typeof settings.redeemCodes === 'undefined') {
        log.error("兑换码配置项不存在，脚本终止运行");
        return;
    }
    
    // 2. 获取当前兑换码配置
    const currentCodesText = settings.redeemCodes || "";
    const currentCodes = currentCodesText.split(/\s+/).filter(code => code.trim() !== "");
    
    if (currentCodes.length === 0) {
        log.info("未检测到兑换码，脚本终止运行");
        return;
    }
    
    // 3. 读取上次兑换状态（使用 try-catch 替代 existsSync）
    let lastRunCodes = [];
    try {
        // 直接尝试读取文件，如果文件不存在会抛出异常
        const stateData = file.readTextSync(STATE_FILE);
        lastRunCodes = JSON.parse(stateData);
        log.info(`读取到上次兑换码配置: ${lastRunCodes.join(" ")}`);
    } catch (error) {
        // 文件不存在是正常情况，不需要警告
        if (!error.message.includes("文件不存在")) {
            log.warning(`读取状态文件失败: ${error.message}`);
        }
    }
    
    // 4. 检查兑换码是否变化
    const hasChanged = !arraysEqual(currentCodes, lastRunCodes);
    
    if (!hasChanged) {
        log.info("兑换码配置未变化，脚本终止运行");
        return;
    }
    
    log.info(`检测到新兑换码配置: ${currentCodesText}`);
    setGameMetrics(1920, 1080, 1);    
    // 5. 返回主界面，等待1秒
    await genshin.returnMainUi();
    await sleep(1000);

    // 6. 通过keyPress点按esc键(VK_ESCAPE)，等待2秒
    keyPress("ESCAPE");
    await sleep(2000);

    const settingsRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/settings.png"));
    const settingsRes = captureGameRegion().find(settingsRo);
    if (settingsRes.isExist()) {
        settingsRes.click();
    }
    await sleep(2000);

    const accountRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/account.png"));
    const accountRes = captureGameRegion().find(accountRo);
    if (accountRes.isExist()) {
        accountRes.click();
    }
    await sleep(500);

    const goToRedeemRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/go_to_redeem.png"));
    const goToRedeemRes = captureGameRegion().find(goToRedeemRo);
    if (goToRedeemRes.isExist()) {
        goToRedeemRes.click();
    }
    await sleep(500);

    try {
        for (const code of currentCodes) {
            log.info(`处理兑换码: ${code}`);
            
            // b. 识别输入兑换码图片并点击
            const inputCodeRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/input_code.png"));
            const inputCodeRes = captureGameRegion().find(inputCodeRo);
            if (inputCodeRes.isExist()) {
                inputCodeRes.click();
            }
            await sleep(300);

            // c. 通过虚拟键代码依次keyPress键入兑换码的每一个字符
            await inputText(code);
            await sleep(500); 

            // d. 输入完毕后，识别兑换图片并点击，等待1.5秒
            const redeemRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/redeem.png"));
            const redeemRes = captureGameRegion().find(redeemRo);
            if (redeemRes.isExist()) {
                redeemRes.click();
            }
            await sleep(1500);

            // e. 识别各种状态图片
            const invalidRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/invalid.png"));
            const invalidRes = captureGameRegion().find(invalidRo);
            if (invalidRes.isExist()) {
                log.info(`兑换码【${code}】无效`);
            }

            const usedRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/used.png"));
            const usedRes = captureGameRegion().find(usedRo);
            if (usedRes.isExist()) {
                log.info(`兑换码【${code}】已使用`);
            }

            const expiredRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/expired.png"));
            const expiredRes = captureGameRegion().find(expiredRo);
            if (expiredRes.isExist()) {
                log.info(`兑换码【${code}】已过期`);
            }

            const notopenRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/not_open.png"));
            const notopenRes = captureGameRegion().find(notopenRo);
            if (notopenRes.isExist()) {
                log.info(`兑换码【${code}】未开启`);
            }

            const confirmRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/confirm.png"));
            const confirmRes = captureGameRegion().find(confirmRo);
            if (confirmRes.isExist()) {
                log.info(`兑换码【${code}】成功兑换`);
                confirmRes.click();
            }

            // f. 识别清除图片并点击
            const clearRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/clear.png"));
            const clearRes = captureGameRegion().find(clearRo);
            if (clearRes.isExist()) {
                clearRes.click();
            }
            await sleep(4000);
        }
    } catch (error) {
        log.error(`处理兑换码时出错: ${error}`);
        return; // 出错时不更新状态
    }

    // 7. 所有兑换码兑换完成后返回主界面
    await genshin.returnMainUi();
    
    // 8. 保存当前兑换码到状态文件
    try {
        file.writeTextSync(STATE_FILE, JSON.stringify(currentCodes));
        log.info("兑换码状态已更新");
    } catch (error) {
        log.error(`保存状态文件失败: ${error}`);
    }
})();

// 辅助函数：比较两个数组是否相同
function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    
    // 创建副本避免修改原数组
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    
    for (let i = 0; i < sortedA.length; i++) {
        if (sortedA[i] !== sortedB[i]) return false;
    }
    return true;
}