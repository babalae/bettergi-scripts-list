const SettingsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/SettingsButton.png"), 0.8, 650, 100, 300);
const RestoreButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/RestoreButton.png"), 1400, 950, 130, 130);

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

                    const ro2 = captureGameRegion();
                    let RestoreButton = ro2.find(RestoreButtonRo);
                    ro2.dispose();
                    if (RestoreButton.isExist()) {
                        log.info("识别到恢复默认按钮");
                        RestoreButton.click();
                        await sleep(1500);


                        let captureRegion2 = captureGameRegion();
                        let resList2 = captureRegion2.findMulti(RecognitionObject.ocr(1000, 720, 340, 60));
                        captureRegion2.dispose();
                        for (let i = 0; i < resList2.count; i++) {
                            let res = resList2[i];
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
