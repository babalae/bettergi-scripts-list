// 识图资料
const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirm.png"));
const CondensedResin = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Condensed_Resin.png"));
const Clear = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Clear.png"));
// 读取配置文件
let location = settings.location;

/**
 * 根据星期配置判断是否运行脚本
 * @param {Array} weekSelection - 用户选择的星期数组
 * @returns {boolean} 是否符合运行条件
 */
function shouldRunByWeekConfig(weekSelection) {
    const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

    // 检查配置是否为空
    if (!Array.isArray(weekSelection) || weekSelection.length === 0) {
        return false;
    }

    // 取得调整后的星期（0-6，0=星期日）
    const getAdjustedDayOfWeek = () => {
        const now = new Date();
        let dayOfWeek = now.getDay(); // 0-6
        const hours = now.getHours();

        // 凌晨 00:00~04:00 视为前一天
        if (hours < 4) {
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，视为前一天（${weekDays[dayOfWeek]}）`);
        } else {
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，使用当天（${weekDays[dayOfWeek]}）`);
        }

        return dayOfWeek;
    };

    const adjustedDayOfWeek = getAdjustedDayOfWeek();
    const currentChineseDay = weekDays[adjustedDayOfWeek];

    // 检查是否在允许的星期范围内
    const shouldRun = weekSelection.includes(currentChineseDay);
    return shouldRun;
}

// 执行路径
async function AutoPath(locationName) {
    try {
        let filePath = `assets/Pathing/${locationName}.json`;
        await pathingScript.runFile(filePath);
        return true;
    } catch (error) {
        log.error(`执行 ${locationName} 路径时发生错误`);
        log.error(error.message);
    }

    return false;
}

// 合成浓缩树脂
async function condensedResin() {
    let captureRegion = captureGameRegion();
    // 记录是否找到合成台
    let Alchemy = false;
    let retryCount = 0;
    const maxRetries = 2; // 最大重试次数

    while (!Alchemy && retryCount <= maxRetries) {
        // 对整个区域进行 OCR
        let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
        captureRegion.dispose();
        for (let i = 0; i < resList.count; i++) {
            if (resList[i].text.includes("合成")) {

                // 找到合成台，点击合成台
                log.info("寻找合成台成功,开始与合成台交互");
                keyDown("VK_MENU");// Alt
                await sleep(1000);
                click(resList[i].x + 30, resList[i].y + 30); // 点击合成台选项
                await sleep(1000);
                click(resList[i].x + 30, resList[i].y + 30); // 跳过合成台对话
                await sleep(1500);
                keyUp("VK_MENU");// Alt
                await sleep(1000);

                const ro0 = captureGameRegion();
                let Resin0 = ro0.find(Clear);
                ro0.dispose();
                if (Resin0.isExist()) {
                    log.info("筛选中,先取消筛选");
                    await sleep(750);
                    Resin0.click();
                    await sleep(750);
                }

                // 图像识别浓缩树脂
                const ro1 = captureGameRegion();
                let Resin = ro1.find(CondensedResin);
                ro1.dispose();
                if (Resin.isExist()) {
                    Resin.click();
                    log.info("找到浓缩树脂,开始合成体力");
                    await sleep(750);
                    const ro2 = captureGameRegion();
                    let confirm = ro2.find(confirmRo);
                    ro2.dispose();
                    if (confirm.isExist()) {
                        confirm.click(); // 点击合成
                        await sleep(3000);
                        click(975, 900); // 点击确认，关闭合成成功资料
                        log.info("已完成合成浓缩树脂");
                    }
                } else {
                    log.warn("未能识别到浓缩树脂，不合成");
                }
                await sleep(1000);
                click(1845, 50); // 关闭页面
                await sleep(2000);
                Alchemy = true;
                break; // 找到合成台后跳出循环
            }
        }

        if (!Alchemy) {
            retryCount++;
            if (retryCount <= maxRetries) {
                log.warn(`未找到合成台，进行第 (${retryCount}/${maxRetries}) 次重试`);
                await sleep(1500);

                // 重新尝试路径执行
                try {
                    await AutoPath(location);
                    await sleep(1000);
                    captureRegion = captureGameRegion(); // 刷新捕获区域
                } catch (error) {
                    log.error(`路径重试失败: ${error.message}`);
                }
            }
        }
    }

    if (!Alchemy) {
        log.error(`连续${maxRetries}次未能找到合成台，中止任务`);
    }
    return Alchemy;
}

(async function () {
    // 检查配置是否存在
    if (!Object.keys(settings).includes("execute_Week")) {
        log.error("首次运行前请编辑JS脚本自定义配置");
        return;
    }

    // 检查是否应该运行
    const executeWeek = Array.from(settings.execute_Week || []);
    if (!shouldRunByWeekConfig(executeWeek)) {
        log.info(`交互或拾取："不运行"`);
        return;
    }

    //main/======================================================================================
    setGameMetrics(1920, 1080, 1)
    await genshin.returnMainUi();
    try {
        if (!location) {
            location = "蒙德合成台";
            log.info(`未设置传送位置，默认前往 ${location}...`);
        }
        log.info(`正在前往 ${location} 合成浓缩树脂`);
        await AutoPath(location);
        await sleep(1000);
        log.info("寻找合成台");
        await condensedResin();
        await sleep(1000);
        await genshin.returnMainUi();
        return;
    } catch (e) {
        log.error("传送失败，请检查设置");
        return;
    }
})();