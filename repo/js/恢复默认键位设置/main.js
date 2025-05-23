const SettingsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/SettingsButton.png"), 0.8, 650, 100, 300);
const RestoreButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/RestoreButton.png"), 1400, 950, 130, 130);

(async function () {
    // 恢复默认键位设置
    async function KeyBindlings() {
        await genshin.returnMainUi();
        await sleep(2000);
        keyPress("ESCAPE");
        await sleep(2000);

        let SettingsButton = captureGameRegion().find(SettingsButtonRo);
        if (SettingsButton.isExist()) {
            log.info("识别到设置按钮");
            SettingsButton.click();
            await sleep(2000);

            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(100, 100, 300, 300));
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (res.text.includes("Key") || res.text.includes("Bindings") || res.text.includes("按键") || res.text.includes("按鍵")) {
                    res.click();
                    await sleep(2000);

                    let RestoreButton = captureGameRegion().find(RestoreButtonRo);
                    if (RestoreButton.isExist()) {
                        log.info("识别到恢复默认按钮");
                        RestoreButton.click();
                        await sleep(1500);


                        let captureRegion = captureGameRegion();
                        let resList = captureRegion.findMulti(RecognitionObject.ocr(1000, 720, 340, 60));
                        for (let i = 0; i < resList.count; i++) {
                            let res = resList[i];
                            if (res.text.includes("确认")) {
                                log.info("识别到确认按钮");
                                res.click();
                                await sleep(2000);
                            }
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
