(async function () {
    await genshin.returnMainUi();
    let domainName = settings.domainName;
    let operationDelay = settings.operationDelay?Number(settings.operationDelay):1000;
    if(domainName===undefined){
        domainName="不允许加入"
    }
    setGameMetrics(1920, 1080, 1.5)
    keyPress("VK_F2")
    await sleep(operationDelay);

    if(settings.workMode==="基于固定位置"){
    click(330, 1010) //点击世界权限
    await sleep(operationDelay);

    switch (domainName) {
        case "直接加入":
            click(330, 910);
            log.info("权限设置为【直接加入】");
            break;
        case "不允许加入":
            click(330, 850); // 不允许
            log.info("权限设置为【不允许加入】");
            break;
        case "确认后可加入":
            click(330, 960); // 确认后
            log.info("权限设置为【确认后可加入】");
            break;
        default:
            click(330, 850); // 不允许
            log.info("锁门");
            break;
    }
    await sleep(operationDelay);
    }
    else{
        let tag = 0;
        for (let i = 0; i < 5 && tag === 0; i++) {
            let OCRcaptureRegion = captureGameRegion();
            
            let resList = OCRcaptureRegion.findMulti(RecognitionObject.ocrThis);
            OCRcaptureRegion.dispose();

            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (res.text.includes("世界权限")) { 
                    res.click(); 
                    tag = 1;
                    break;
                }
            }
        }
        if (tag === 0) {
            log.error("未找到【世界权限】按钮,结束执行");
            return;
        }
        tag = 0;
        for (let i = 0; i < 5 && tag === 0; i++) {
            let OCRcaptureRegion = captureGameRegion();

            let resList = OCRcaptureRegion.findMulti(RecognitionObject.ocrThis);
            OCRcaptureRegion.dispose();

            for (let i = 0; i < resList.count; i++) { 
                let res = resList[i];
                if (res.text.includes(domainName)) { 
                    res.click(); 
                    tag = 1;
                    break;
                }
            }
        }
        if (tag === 0) {
            log.error("找到【世界权限】按钮,但权限设置失败，结束执行");
            return;
        }
    }
    keyPress("VK_ESCAPE");
    log.info("权限设置为【" + domainName + "】");

})();