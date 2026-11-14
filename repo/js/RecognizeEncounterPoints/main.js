(async function () {
    setGameMetrics(1920, 1080, 1);

    // 1. 返回主界面
    await genshin.returnMainUi();
    await sleep(1000);

    // 2. 初始化BvPage
    const page = new BvPage();
    const locatorActivate = page.Locator(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/activate.png")));
    const locatorNoActivate = page.Locator(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/no_activate.png")));
    const locatorQuestionMark = page.Locator(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/questionmark.png")));

    // 3. 构建进入长效历练点说明对话框的Flow
    await page.flow()
    .keyPress("VK_F1")      // 开书
    .waitUntilAny([locatorActivate, locatorNoActivate], 5000, 3)        // 等待出现委托字样，超时5s，重试3次
    .click()
    .waitUntil(locatorQuestionMark, 5000, 3)    // 等待出现长效历练点的帮助字样
    .click()
    .wait(1000)   // 等待对话框弹出
    .run();

    // 4. 识别历练点
    const locatorLTRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/locator_LT.png"));
    const locatorRBRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/locator_RB.png"));
    
    const imgFullScreen = captureGameRegion();       // 截图
    try
    {
        const locatorLTRes = imgFullScreen.find(locatorLTRo);
        const locatorRBRes = imgFullScreen.find(locatorRBRo);
        // 在同时找到对话框左上角和右下角定位标时继续
        if(locatorLTRes.isEmpty() && locatorRBRes.isEmpty())
        {
            throw new Error("对话框定位失败");
        }
        // 使用识别到的定位标裁剪对话框图像
        const imgDialog = imgFullScreen.deriveCrop(locatorLTRes.x, locatorLTRes.y, locatorRBRes.x + locatorRBRes.width, locatorRBRes.y + locatorRBRes.height);
        // 寻找历练点的定位点
        try
        {
            const keypointRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/keypoint.png"));
            const keypointRes = imgDialog.find(keypointRo);
            if(keypointRes.isEmpty())
            {
                throw new Error("历练点数据定位失败");
            }
            // 将KeyPoint右侧的像素划入OCR区域并识别
            const encounterPointsRo = RecognitionObject.ocr(keypointRes.x + keypointRes.width, keypointRes.y, imgDialog.width - keypointRes.width - keypointRes.x, keypointRes.height);
            const encounterPointsRes = imgDialog.find(encounterPointsRo);
            if(!encounterPointsRes.isEmpty())
            {
                log.info(`长效历练点剩余: ${encounterPointsRes.text}`);
                if(!file.writeTextSync("count.txt", encounterPointsRes.text, false))
                {
                    throw new Error("长效历练点数量写入失败");
                }
            }
        }
        finally
        {
            imgDialog.dispose();
        }
    }
    catch(error)
    {
        log.error(`长效历练点识别失败: ${error}`);
    }
    finally
    {
        imgFullScreen.dispose();
    }
    await genshin.returnMainUi();
})();
