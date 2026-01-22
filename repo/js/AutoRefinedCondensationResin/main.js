// 识图资料
const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/confirm.png"));
const CondensedResin = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Condensed_Resin.png"));
const Clear = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Clear.png"));
// 读取配置文件
let location = settings.location;
const settingsWeek = settings.week;
const everyDay = settings.everyDay;

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
    // 获取
    function validateAndStoreNumbers(input) {
        // 去除所有空格
        const cleanedInput = input.replace(/\s/g, '');
        
        // 使用正则表达式检测是否符合期望格式
        const regex = /^([1-7])(,([1-7]))*$/;
        
        // 检测输入字符串是否符合正则表达式
        if (regex.test(cleanedInput)) {
            // 将输入字符串按逗号分割成数组
            const numbers = cleanedInput.split(',');
            return numbers.map(Number);
        } else {
            return false;
        }
    }

    // 获取调整后的星期几（考虑00:00~04:00视为前一天）
    function getAdjustedDayOfWeek() {
        const now = new Date();
        let dayOfWeek = now.getDay(); // 0-6 (0是周日)
        const hours = now.getHours();

        // 如果时间在00:00~04:00之间，视为前一天
        if (hours < 4) {
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 前一天
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，视为前一天（星期 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
        } else {
            log.info(`当前时间 ${now.getHours()}:${now.getMinutes()}，使用当天（星期 ${dayOfWeek === 0 ? 7 : dayOfWeek}）`);
        }

        // 转换为1-7格式（7代表周日）
        return dayOfWeek === 0 ? 7 : dayOfWeek;
    }

    //main/======================================================================================
    setGameMetrics(1920, 1080, 1)
    await genshin.returnMainUi();

    // 判断设置合法性
    var items = [];

    // 每天都合成体力,开启后无视星期设定,运行完直接return跳出
    if (everyDay) {
        log.info("已开启每天都合成体力，无视星期设置");
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
    }

    if (settingsWeek && !everyDay) {
        items = validateAndStoreNumbers(settingsWeek);
        if (!items) {
            log.error("星期设置格式错误，请使用类似'1,3,5,7'的格式");
            return;
        }

        // 获取调整后的星期几（考虑00:00~04:00视为前一天）
        const dayOfWeek = getAdjustedDayOfWeek();

        // 检查当前星期是否在用户设置的范围内
        if (items.includes(dayOfWeek)) {
            try {
                // 读取配置文件
                if (!location) {
                    location = "璃月合成台";
                    log.info(`未设置传送位置，默认前往 ${location}...`);
                }
                log.info(`今天是星期 ${dayOfWeek}，正在前往 ${location} 合成浓缩树脂`);
                await AutoPath(location);
                await sleep(1000);
                log.info("寻找合成台");
                await condensedResin();
                await sleep(1000);
                await genshin.returnMainUi();
            } catch (e) {
                log.error("传送失败，请检查设置");
                return;
            }
        } else {
            log.info(`今天是星期 ${dayOfWeek}，不需要合成体力`);
            return;
        }
    } else if (!everyDay) {
        log.error("还没有设置需要在星期几合成体力呢");
        log.error("请在调试器里添加本脚本->右键JS脚本->修改JS脚本自定义配置.");
        return;
    }

    //main/**======================================================================================

})();