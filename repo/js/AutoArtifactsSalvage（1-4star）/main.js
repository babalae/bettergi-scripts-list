(async function () {
    // 读取用户设置
    let autoSalvage = settings.autoSalvage != undefined && settings.autoSalvage != '是' ? false : true;
    let autoSalvage1 = settings.autoSalvage1 != undefined && settings.autoSalvage1 != '是' ? true : false;
    let autoSalvage2 = settings.autoSalvage2 != undefined && settings.autoSalvage2 != '是' ? true : false;
    let autoSalvage3 = settings.autoSalvage3 != undefined && settings.autoSalvage3 != '是' ? true : false;
    let autoSalvage4 = settings.autoSalvage4 != undefined && settings.autoSalvage4 != '否' ? true : false;

    log.debug(`autoSalvage: ${autoSalvage}; autoSalvage4: ${autoSalvage4};`);

    // 分解圣遗物
    async function salvage() {
        if (!autoSalvage) return;

        await genshin.returnMainUi();

        keyPress("B"); await sleep(2000);
        click(670, 40); await sleep(1000); // 圣遗物
        click(660, 1010); await sleep(1000); // 分解
        click(300, 1020); await sleep(1000); // 快速选择

         if (autoSalvage1) { 
            click(200,150); await sleep(500); // 不包括1星
        }

        if (autoSalvage2) { 
            click(200,220); await sleep(500); // 不包括2星
        }

        if (autoSalvage3) { 
            click(200,300); await sleep(500); // 不包括3星
        }

        if (!autoSalvage4) { 
            click(200, 380); await sleep(500); // 不包括4星
        }

        click(340, 1000); await sleep(1000); // 确认选择
        click(1720, 1015); await sleep(1500); // 分解
        click(1180, 750); await sleep(1000); // 进行分解

        click(1840, 45); await sleep(1500); // 取消
        click(1840, 45); await sleep(1000); // 取消
        click(1840, 45); await sleep(1000); // 取消
    }

    // 执行分解
    await salvage();
    log.info("分解完成。");
})();