(async function () {
    // 首先检查配置项是否存在
    if (typeof settings === 'undefined' || typeof settings.redeemCodes === 'undefined') {
        log.error("兑换码配置项不存在，脚本终止运行");
        return;
    }
    
    // 检查兑换码是否为空
    const codesText = settings.redeemCodes || "";
    const codes = codesText.split(/\s+/).filter(code => code.trim() !== "");
    
    if (codes.length === 0) {
        log.info("未检测到兑换码，脚本终止运行");
        return;
    }
    
    log.info(`开始处理兑换码: ${codesText}`);
    setGameMetrics(1920, 1080, 1);    
    // 1. 返回主界面，等待1秒
    await genshin.returnMainUi();
    await sleep(1000);

    // 2. 通过keyPress点按esc键(VK_ESCAPE)，等待2秒。ocr识别设置图片并点击，等待2秒。识别账户图片并点击，等待0.5秒，识别前往兑换图片并点击，等待0.5秒
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
        for (const code of codes) {
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
    }

    // 4. 所有兑换码兑换完成后返回主界面
    await genshin.returnMainUi();
})();