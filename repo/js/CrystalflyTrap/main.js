(async function () {
    try {
        setGameMetrics(1920, 1080, 1)
        await genshin.returnMainUi();

        let enable = settings.enable;
        let ore = settings.ore;

        if (!enable) {
            throw new Error("请配置好脚本配置！");
        }
        if (!ore) {
            throw new Error("不是吧，哥们，你配置好了吗？用什么矿石啊？");
        }
        
        // 读取状态数据，如果文件不存在则创建默认状态
        let statusData = { isPlaced: false, collectionTime: 0 };
        try {
            const statusContent = file.readTextSync("status.json");
            if (statusContent) {
                statusData = JSON.parse(statusContent);
            }
        } catch (err) {
            log.info("未找到状态文件或文件格式错误，创建默认状态");
            await file.WriteTextSync("status.json", JSON.stringify(statusData, null, 2));
        }
        
        // 根据当前状态决定操作类型
        const isPlaced = statusData.isPlaced;
        const now = new Date().getTime();
        const operationType = isPlaced ? "收集" : "放置";
        
        log.info(`当前动作: ${operationType}`);
        log.info("传送至枫丹冒险家协会锚点");
        await genshin.tp(4509, 3631);
        await sleep(1000);
        
        if (!isPlaced) {
            // 放置操作
            log.info("放置晶蝶诱捕装置");
            keyPress("B");
            await sleep(1000);
            let backpackTitle = captureGameRegion();
            let resList = backpackTitle.findMulti(RecognitionObject.ocr(130, 0, 200, 50));
            backpackTitle.dispose();
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (!res.text.includes("小道")) {
                    log.info("点击小道具栏");
                    click(1060, 40);
                    await sleep(1000);
                }
            }
            const ro1 = captureGameRegion();
            let crystalflyTrap = ro1.find(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/晶蝶诱捕装置.png")))
            ro1.dispose();
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
            captureRegion.dispose();
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
            const ro2 = captureGameRegion();
            let oreIcon = ro2.find(RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/icon/${ore}.png`)))
            ro2.dispose();
            if (oreIcon) {
                const ro3 = captureGameRegion();
                let oreCount = ro3.find(RecognitionObject.ocr(oreIcon.x - 20, 240, 90, 30));
                ro3.dispose();
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
            
            // 更新状态信息
            log.info(`当前时间: ${new Date().toLocaleString()}`);
            let collectionTime = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
            log.info(`领取时间: ${new Date(collectionTime).toLocaleString()}`);
            
            // 使用JSON格式保存状态
            statusData.isPlaced = true;
            statusData.collectionTime = collectionTime;
            await file.WriteTextSync("status.json", JSON.stringify(statusData, null, 2));
            log.info("状态保存成功");
            
        } else {
            // 收集操作
            log.info(`读取领取时间成功`);
            const readableTime = new Date(statusData.collectionTime).toLocaleString();
            log.info(`领取时间: ${readableTime}`);
            if (now < statusData.collectionTime) {
                log.error("还没到领取时间");
                throw new Error(`还没到领取时间，领取时间: ${readableTime}`);
            }
            
            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(1210, 510, 210, 50));
            captureRegion.dispose();
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (!res.text.includes("晶蝶") || !res.text.includes("诱捕") || !res.text.includes("装置")) {
                    log.error("当前光标不是晶蝶诱捕装置");
                    throw new Error("当前光标不是晶蝶诱捕装置");
                }
            }
            log.info("收获晶蝶");
            keyPress("F");
            
            // 更新状态
            statusData.isPlaced = false;
            statusData.collectionTime = 0;
            await file.WriteTextSync("status.json", JSON.stringify(statusData, null, 2));
            
            await sleep(3000);
            keyPress("VK_ESCAPE");
        }
    } catch (e) {
        log.error(`执行脚本时出错：${e}`, e.message);
    }
})();