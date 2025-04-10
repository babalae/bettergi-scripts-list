(async function () {
    try {
        setGameMetrics(1920, 1080, 1)
        await genshin.returnMainUi();

        let enable = settings.enable;
        let type = settings.type;
        let ore = settings.ore;

        if (!enable) {
            throw new Error("请配置好脚本配置！");
        }
        if (!ore) {
            throw new Error("不是吧，哥们，你配置好了吗？用什么矿石啊？");
        }
        log.info(`当前动作: ${type}`);
        log.info("传送至枫丹冒险家协会锚点");
        await genshin.tp(4509, 3631);
        await sleep(1000);
        if (type == "放置") {
            log.info("放置晶蝶诱捕装置");
            keyPress("B");
            await sleep(1000);
            let backpackTitle = captureGameRegion();
            let resList = backpackTitle.findMulti(RecognitionObject.ocr(130, 0, 200, 50));
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (!res.text.includes("小道")) {
                    log.info("点击小道具栏");
                    click(1060, 40);
                    await sleep(1000);
                }
            }
            let crystalflyTrap = captureGameRegion().find(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/晶蝶诱捕装置.png")))
            if (crystalflyTrap) {
                log.info("选择晶蝶诱捕装置");
                crystalflyTrap.click();
                await sleep(1000);
                log.info("点击放置");
                click(1700, 1010);
            } else {
                log.error("背包内未找到晶蝶诱捕装置，请检查背包内是否拥有该道具！");
                throw new Error("背包内未找到晶蝶诱捕装置");
            }
            await genshin.returnMainUi();
            await sleep(1000);
            let captureRegion = captureGameRegion();
            let resList2 = captureRegion.findMulti(RecognitionObject.ocr(1210, 510, 210, 50));
            for (let i = 0; i < resList2.count; i++) {
                let res = resList2[i];
                if (!res.text.includes("晶蝶") || !res.text.includes("诱捕") || !res.text.includes("装置")) {
                    log.error("当前光标不是晶蝶诱捕装置");
                    throw new Error("当前光标不是晶蝶诱捕装置");
                }
            }
            log.info("添加矿石");
            keyPress("F");
            await sleep(1000);
            let oreIcon = captureGameRegion().find(RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/icon/${ore}.png`)))
            if (oreIcon) {
                let oreCount = captureGameRegion().find(RecognitionObject.ocr(oreIcon.x - 20, 240, 90, 30));
                if (oreCount.text < 30) {
                    log.error(`${ore}数量不足30个！`);
                    throw new Error(`${ore}数量不足30个！`);
                }
                log.info(`选择${ore}`);
                oreIcon.click();
                await sleep(200);
                log.info("数量拉满");
                click(460, 1010);
                await sleep(200);
                log.info("启动！");
                click(1750, 1020);
                await sleep(200);
                log.info("启动！！！");
                click(1200, 750);
                await sleep(200);
                await genshin.returnMainUi();
            } else {
                log.error(`未找到${ore}，请检查背包内是否拥有该矿石！`);
                throw new Error(`未找到${ore}`);
            }
            log.info(`当前时间: ${new Date().toLocaleString()}`);
            let collectionTime = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
            log.info(`领取时间: ${new Date(collectionTime).toLocaleString()}`);
            await file.WriteTextSync("time.txt", collectionTime.toString());
            log.info("时间保存成功");
        } else if (type == "收集") {
            const content = file.readTextSync("time.txt");
            log.info(`读取领取时间成功`);
            const readableTime = new Date(parseInt(content)).toLocaleString();
            log.info(`领取时间: ${readableTime}`);
            const now = new Date().getTime();
            if (now < parseInt(content)) {
                log.error("还没到领取时间");
                throw new Error(`还没到领取时间，领取时间: ${readableTime}`);
            }
            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(1210, 510, 210, 50));
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (!res.text.includes("晶蝶") || !res.text.includes("诱捕") || !res.text.includes("装置")) {
                    log.error("当前光标不是晶蝶诱捕装置");
                    throw new Error("当前光标不是晶蝶诱捕装置");
                }
            }
            log.info("收获晶蝶");
            keyPress("F");
            await file.WriteTextSync("time.txt", "");
            await sleep(3000);
            keyPress("VK_ESCAPE");
        } else {
           throw new Error("不是吧，哥们，你配置好了吗？放置还是收集啊？"); 
        }
    } catch (e) {
        log.error(`执行脚本时出错：${e}`, e.message);
    }
})();