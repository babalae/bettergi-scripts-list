// 战斗模块
var Combat = {
    // 执行战斗并检测结束
    restoredEnergyAutoFightAndEndDetection: async function() {
        await genshin.tp(178.55, 384.4);
        
        await OcrHelper.repeatOperationUntilTextFound({
            stepDuration: 200,
            waitTime: 100
        });
        
        let enterAttempts = 0;
        while (enterAttempts < 3) {
            keyPress("F");
            await sleep(500);
            
            try {
                await OcrHelper.repeatOperationUntilTextFound({
                    x: 1650, y: 1000, width: 160, height: 45,
                    targetText: "单人挑战",
                    stepDuration: 0, waitTime: 100, ifClick: true
                });
                break;
            } catch (error) {
                enterAttempts++;
                log.info(`进入秘境失败，第${enterAttempts}次重试，正在前进...`);
                if (enterAttempts >= 3) {
                    throw new Error(`进入秘境失败，已重试3次`);
                }
                await OcrHelper.repeatOperationUntilTextFound({
                    stepDuration: 200,
                    waitTime: 100
                });
            }
        }
        
        await sleep(200);
        click(1180, 760);
        await OcrHelper.repeatOperationUntilTextFound({
            x: 1650, y: 1000, width: 160, height: 45,
            targetText: "开始挑战",
            stepDuration: 0, waitTime: 100, ifClick: true
        });
        await sleep(2000);
        await Navigation.tpEndDetection();
        
        keyDown("w");
        await sleep(200);
        keyDown("SHIFT");
        await sleep(300);
        keyUp("SHIFT");
        await sleep(500);
        keyDown("SHIFT");
        await sleep(300);
        keyUp("SHIFT");
        await sleep(1000);
        keyDown("SHIFT");
        await sleep(300);
        keyUp("SHIFT");
        await sleep(500);
        keyUp("w");
        
        let challengeTime = 0;
        while (challengeTime < 5000) {
            for (let i = 1; i < 5; i++) {
                keyPress(i.toString());
                await sleep(300);
                leftButtonClick();
                await sleep(400);
                keyDown("e");
                await sleep(400);
                keyUp("e");
                await sleep(500);
                leftButtonClick();
                await sleep(100);
                let ro = captureGameRegion();
                let res = ro.find(RecognitionObject.ocr(840, 935, 230, 40));
                ro.dispose();
                if (res.text.includes("自动退出")) {
                    log.info("检测到挑战成功");
                    return;
                }
            }
            challengeTime = challengeTime + 200;
            await sleep(100);
        }
        log.info("挑战超时，可能充能失败");
    },
    
    // 恢复能量
    restoredEnergy: async function() {
        await genshin.returnMainUi();
        await genshin.tp(2297.6201171875, -824.5869140625);
        await this.restoredEnergyAutoFightAndEndDetection();
        await this.restoredEnergyAutoFightAndEndDetection();
        log.info("能量充满，任务结束");
        await genshin.tp(2297.6201171875, -824.5869140625);
    },
    
    // 执行BOSS战斗
    fightBoss: async function(bossName) {
        if (!settings.teamName) throw new Error('未输入队伍名称');
        
        await genshin.returnMainUi();
        await Utils.switchPartySafe(settings.teamName);
        
        if (settings.energyMax) {
            await this.restoredEnergy();
        } else {
            await genshin.tp(2297.6201171875, -824.5869140625);
        }
        
        log.info(`前往讨伐${bossName}`);
        await pathingScript.runFile(`assets/goToBoss/${bossName}前往.json`);
        
        if (bossName == "超重型陆巡舰·机动战垒") {
            keyDown("w");
            await sleep(13000);
            keyUp("w");
        } else if (bossName == "蕴光月守宫") {
            keyDown("w");
            await sleep(11000);
            keyUp("w");
            await sleep(1000);
            keyDown("a");
            await sleep(600);
            keyUp("a");
            await sleep(1000);
            keyDown("w");
            await sleep(4500);
            keyUp("w");
            await sleep(1000);
            keyDown("d");
            await sleep(500);
            keyUp("d");
            await sleep(1000);
            keyDown("w");
            await sleep(5600);
            keyUp("w");
        }
        
        await sleep(500);
        log.info(`开始战斗`);
        
        try {
            await dispatcher.runTask(new SoloTask("AutoFight"));
        } catch (error) {
            log.info(`挑战失败，再来一次`);
            await genshin.tp(2297.6201171875, -824.5869140625);
            await pathingScript.runFile(`assets/goToBoss/${bossName}前往.json`);
            
            if (bossName == "超重型陆巡舰·机动战垒") {
                keyDown("w");
                await sleep(13000);
                keyUp("w");
            } else if (bossName == "蕴光月守宫") {
                keyDown("w");
            await sleep(11000);
            keyUp("w");
            await sleep(1000);
            keyDown("a");
            await sleep(600);
            keyUp("a");
            await sleep(1000);
            keyDown("w");
            await sleep(4500);
            keyUp("w");
            await sleep(1000);
            keyDown("d");
            await sleep(500);
            keyUp("d");
            await sleep(1000);
            keyDown("w");
            await sleep(5600);
            keyUp("w");
            }
            
            await dispatcher.runTask(new SoloTask("AutoFight"));
        }
        
        await sleep(1000);
        log.info(`战斗结束，开始领奖`);
        await Navigation.autoNavigateToReward();
        await sleep(600);
        keyPress("F");
        await sleep(800);
        click(968, 759);
        await sleep(3000);
        click(975, 1000);
        await sleep(1000);
        await genshin.tp(2297.6201171875, -824.5869140625);
        log.info(`首领讨伐结束`);
    }
};
