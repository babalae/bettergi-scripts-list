const SettingsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/SettingsButton.png"), 0.8, 650, 100, 300);
const RestoreButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/RestoreButton.png"), 1400, 950, 130, 130);
const bot2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/bot2.png"), 492,659,129,55);

(async function () {
    // 恢复默认键位设置
    async function KeyBindlings() {
        await genshin.returnMainUi();
        await sleep(2000);
        keyPress("ESCAPE");
        await sleep(2000);

        const ro1 = captureGameRegion();
        let SettingsButton = ro1.find(SettingsButtonRo);
        ro1.dispose();
        if (SettingsButton.isExist()) {
            log.info("识别到设置按钮");
            SettingsButton.click();
            await sleep(2000);

            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(100, 100, 300, 300));
            captureRegion.dispose();
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (res.text.includes("Key") || res.text.includes("Bindings") || res.text.includes("按键") || res.text.includes("按鍵")) {
                    res.click();
                    await sleep(2000);

                    
                    // 获取一张截图
                    let captureRegion = captureGameRegion();

                    // 对整个区域进行 OCR
                    let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
                    for (let i = 0; i < resList.count; i++) { 
                      let res = resList[i];
                      //log.info("OCR结果:位置({x},{y},{h},{w}), 文本{text}", res.x, res.y, res.width, res.Height, res.text);
                      //修改元素战技为 F
                      if (res.text.includes("元素战技")) {
                        res.clickTo(1120,10)
                        await sleep(2000);
                        let filePath = `assets/KeyPressF.json`;
                        await keyMouseScript.runFile(filePath);
                        await sleep(2000);
                    }
                    }
                    //确认
                    let captureRegion2 = captureGameRegion();
                    let resList2 = captureRegion2.findMulti(RecognitionObject.ocrThis);
                    for (let i = 0; i < resList2.count; i++) { 
                      let res2 = resList2[i];
                      if (res2.text.includes("确认")) {
                        res2.click()
                        await sleep(2000);
                    }
                    }
                    }
                    
                }
            }
        }
    
    // 执行函数
    await KeyBindlings();
    await genshin.returnMainUi();
})();
