// 背包/材料查询模块
var Inventory = {
    // 查询体力值
    queryStaminaValue: async function() {
        try {
            await genshin.returnMainUi();
            await sleep(2500);
            keyPress("F1");
            await sleep(1800);
            click(300, 540);
            await sleep(500);
            click(1570, 203);
            await sleep(800);
            const staminaList = await Utils.ocrRecognizeWithRetry(1580, 20, 210, 55, "体力识别");
            const staminaText = staminaList && staminaList.length > 0 ? staminaList[0].replace(/\s/g, '') : "";
            log.info(`OCR原始文本：${staminaText}`);
            const standardMatch = staminaText.match(/(\d+)/);
            if (standardMatch) {
                const currentValue = standardMatch[1];
                let validatedStamina = Utils.positiveIntegerJudgment(currentValue);
                if (validatedStamina > 11200) validatedStamina = (validatedStamina - 1200) / 10000;
                log.info(`返回体力值：${validatedStamina}`);
                return validatedStamina;
            }
        } catch (error) {
            log.error(`体力识别失败：${error.message}，默认为零`);
            await genshin.returnMainUi();
            return 0;
        }
    },
    
    // 获取BOSS材料数量
    getBossMaterialCount: async function(bossName) {
        await genshin.returnMainUi();
        await sleep(500);
        keyPress("F1");
        await OcrHelper.repeatOperationUntilTextFound({x: 250, y: 520, width: 100, height: 60, targetText: "讨伐", stepDuration: 0, waitTime: 100, ifClick: true});
        await OcrHelper.repeatOperationUntilTextFound({x: 380, y: 180, width: 100, height: 50, targetText: "全部", stepDuration: 0, waitTime: 100, ifClick: true});
        await OcrHelper.repeatOperationUntilTextFound({x: 400, y: 360, width: 100, height: 50, targetText: "精英", stepDuration: 0, waitTime: 100, ifClick: true});
        await sleep(500);
        await OcrHelper.repeatOperationUntilTextFound({x: 380, y: 180, width: 100, height: 50, targetText: "精英", stepDuration: 0, waitTime: 100, ifClick: true});
        await sleep(500);
        await OcrHelper.repeatOperationUntilTextFound({x: 400, y: 420, width: 100, height: 50, targetText: "首领", stepDuration: 0, waitTime: 100, ifClick: true});
        await sleep(500);
        click(956, 844); await sleep(500);
        click(956, 844); await sleep(500);
        await OcrHelper.waitAndClickImage('boss/wolf');
        click(958, 286); await sleep(500);
        click(958, 286); await sleep(500);
        log.info(`正在查询数量`);
        
        try {
            const targetImageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/boss/${bossName}.png`), 0, 0, 1920, 1080);
            targetImageRo.Threshold = 0.95;
            const stopImageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/boss/无相之风.png"), 0, 0, 1920, 1080);
            stopImageRo.Threshold = 0.95;
            await Navigation.findAndClickWithScroll(targetImageRo, stopImageRo, {maxAttempts: 30, scrollNum: 9});
            
            if (bossName == '「冰风组曲」科培琉司') {
                await OcrHelper.waitAndClickImage("好感图标", 160, 30);
            } else {
                await OcrHelper.waitAndClickImage("好感图标", 80, 30);
            }
            
            await sleep(800);
            const result = await OcrHelper.findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
            if (result !== false) {
                const quantity = Utils.positiveIntegerJudgment(result);
                log.info(`识别到${bossName}材料数量: ${quantity}`);
                return quantity;
            } else {
                log.warn(`${bossName}材料识别失败，请检查相关设置`);
            }
        } catch (error) {
            notification.send(`${bossName}材料刷取失败，错误信息: ${error}`);
            return 0;
        }
    },
    
    // 获取技能书材料数量
    getMaterialCount: async function(bookName) {
        if (!Constants.bookToPosition.hasOwnProperty(bookName)) {
            log.error("无效的技能书名称: " + bookName);
            return [0, 0, 0];
        }
        
        const {country, row} = Constants.bookToPosition[bookName];
        const results = [0, 0, 0];
        
        try {
            await genshin.returnMainUi();
            await sleep(500);
            keyPress("F1");
            await OcrHelper.repeatOperationUntilTextFound({x: 250, y: 420, width: 100, height: 60, targetText: "秘境", stepDuration: 0, waitTime: 100, ifClick: true});
            await OcrHelper.repeatOperationUntilTextFound({x: 415, y: 390, width: 300, height: 195, targetText: "天赋", stepDuration: 0, waitTime: 100, ifClick: true});
            
            log.info(`正在点击${country}副本...`);
            try {
                await OcrHelper.waitAndClickImage(country, 700, 35, true, 1000);
            } catch (error) {
                await sleep(500);
                moveMouseTo(1600, 300);
                leftButtonDown();
                await sleep(500);
                moveMouseTo(1600, 700);
                await sleep(500);
                moveMouseTo(1600, 500);
                await sleep(100);
                leftButtonUp();
                await sleep(1000);
                await OcrHelper.waitAndClickImage(country, 700, 35, true, 3000);
            }
            
            await sleep(500);
            
            for (let col = 0; col < 3; col++) {
                const clickX = Constants.qualityPositions[col].x;
                const clickY = 504 + row * 105;
                
                log.info(`点击位置: (${clickX}, ${clickY})`);
                click(clickX, clickY);
                await sleep(400);
                
                const result = await OcrHelper.findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                if (result !== false) {
                    const quantity = Utils.positiveIntegerJudgment(result);
                    results[col] = quantity;
                    log.info(`识别到${["绿色", "蓝色", "紫色"][col]}品质材料数量: ${quantity}`);
                } else {
                    log.warn("识别失败，将重试...");
                    click(clickX, clickY);
                    await sleep(1500);
                    const retryResult = await OcrHelper.findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                    results[col] = retryResult !== false ? Utils.positiveIntegerJudgment(retryResult) : 0;
                }
                
                if (col != 2) click(800, 10);
                await sleep(1000);
            }
            
            return results;
        } catch (error) {
            log.error("获取材料数量时出错: " + error);
            return results;
        }
    },
    
    // 获取武器材料数量
    getWeaponMaterialCount: async function(materialName) {
        if (!Constants.weaponMaterialToPosition.hasOwnProperty(materialName)) {
            log.error("无效的武器材料名称: " + materialName);
            return [0, 0, 0, 0];
        }
        
        const {country, row} = Constants.weaponMaterialToPosition[materialName];
        const results = [0, 0, 0, 0];
        
        try {
            await genshin.returnMainUi();
            await sleep(500);
            keyPress("F1");
            await OcrHelper.repeatOperationUntilTextFound({x: 250, y: 420, width: 100, height: 60, targetText: "秘境", stepDuration: 0, waitTime: 100, ifClick: true});
            await OcrHelper.repeatOperationUntilTextFound({x: 415, y: 300, width: 300, height: 195, targetText: "武器", stepDuration: 0, waitTime: 100, ifClick: true});
            
            log.info(`正在点击${country}副本...`);
            try {
                await OcrHelper.waitAndClickImage(country, 700, 35, true, 1000);
            } catch (error) {
                await sleep(500);
                moveMouseTo(1600, 300);
                leftButtonDown();
                await sleep(500);
                moveMouseTo(1600, 700);
                await sleep(500);
                moveMouseTo(1600, 500);
                await sleep(100);
                leftButtonUp();
                await sleep(1000);
                await OcrHelper.waitAndClickImage(country, 700, 35, true, 3000);
            }
            
            await sleep(500);
            
            for (let col = 0; col < 4; col++) {
                const {x, y, quality} = Constants.weaponQualityPositions[col];
                const clickX = x;
                const clickY = 502 + row * 107;
                
                log.info(`点击${quality}品质材料位置: (${clickX}, ${clickY})`);
                click(clickX, clickY);
                await sleep(400);
                
                const result = await OcrHelper.findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                if (result !== false) {
                    const quantity = Utils.positiveIntegerJudgment(result);
                    results[col] = quantity;
                    log.info(`识别到${quality}品质材料数量: ${quantity}`);
                } else {
                    log.warn(`${quality}品质识别失败，将重试...`);
                    click(clickX, clickY);
                    await sleep(1500);
                    const retryResult = await OcrHelper.findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                    results[col] = retryResult !== false ? Utils.positiveIntegerJudgment(retryResult) : 0;
                }
                
                if (col != 3) click(800, 10);
                await sleep(500);
            }
            
            return {
                green: results[0],
                blue: results[1],
                purple: results[2],
                gold: results[3]
            };
        } catch (error) {
            log.error("获取武器材料数量时出错: " + error);
            await sleep(1000);
            return { green: 0, blue: 0, purple: 0, gold: 0 };
        }
    }
};
