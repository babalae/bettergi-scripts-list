(async function () {
    // 读取用户设置
    let operationType = settings.operationType || "分解"; // 默认为分解
    let times = settings.times || 1; // 默认为1
    let includeOneStar = settings.includeOneStar || false;
    let includeTwoStar = settings.includeTwoStar || false;
    let includeThreeStar = settings.includeThreeStar || false;
    let includeFourStar = settings.includeFourStar || false;

    log.debug(`操作类型: ${operationType}`);
    log.debug(`操作次数: ${times}`);
    log.debug(`包含一星: ${includeOneStar}, 包含二星: ${includeTwoStar}, 包含三星: ${includeThreeStar}, 包含四星: ${includeFourStar}`);

    // 分解圣遗物
    async function salvage() {
        await genshin.returnMainUi();
        keyPress("B"); await sleep(2000); // 打开背包
        click(670, 40); await sleep(1000); // 点击圣遗物
        click(660, 1010); await sleep(1000); // 点击分解
        click(300, 1020); await sleep(1000); // 点击快速选择

        // 根据星级选择
        if (!includeOneStar) click(200, 150); await sleep(500); // 不包含一星
        if (!includeTwoStar) click(200, 220); await sleep(500); // 不包含二星
        if (!includeThreeStar) click(200, 300); await sleep(500); // 不包含三星
        if (!includeFourStar) click(200, 380); await sleep(500); // 不包含四星

        click(340, 1000); await sleep(1000); // 点击确认选择
        click(1720, 1015); await sleep(1500); // 点击分解
        click(1180, 750); await sleep(1000); // 点击进行分解

        click(1840, 45); await sleep(1500); // 取消
        click(1840, 45); await sleep(1000); // 取消
        click(1840, 45); await sleep(1000); // 取消
    }

    // 摧毁圣遗物
    async function destroy() {
        await genshin.returnMainUi();
        keyPress("B"); await sleep(2000); // 打开背包
        click(670, 40); await sleep(1000); // 点击圣遗物
        
        for (let i = 0; i < times; i++) {
            click(75, 1015); await sleep(1000); // 点击摧毁
            click(165, 1020); await sleep(1000); // 点击快捷放入

            // 根据星级选择
            if (includeOneStar) click(200, 150); await sleep(500); // 包含一星
            if (includeTwoStar) click(200, 220); await sleep(500); // 包含二星
            if (includeThreeStar) click(200, 300); await sleep(500); // 包含三星
            if (includeFourStar) click(200, 380); await sleep(500); // 包含四星

            click(165, 1020); await sleep(1000); // 点击快捷放入
            click(1720, 1015); await sleep(1000); // 点击摧毁
            click(1200, 830); await sleep(1000); // 点击摧毁
            click(960, 1000); await sleep(1000); // 点击空白处
        }

        click(1840, 45); await sleep(1500); // 取消
        click(1840, 45); await sleep(1000); // 取消
        click(1840, 45); await sleep(1000); // 取消
    }

    // 执行操作
    if (operationType === "分解") {
        await salvage();
        log.info("分解完成。");
    } else if (operationType === "摧毁") {
        await destroy();
        log.info("摧毁完成。");
    }
})();