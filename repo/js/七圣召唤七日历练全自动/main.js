// 存储挑战玩家信息
let textArray = [];
let skipNum = 0;

// 切换到指定的队伍
async function switchCardTeam(Name, shareCode) {
    let captureRegion = captureGameRegion();
    let teamName = captureRegion.find(RecognitionObject.ocr(1305, 793, 206, 46));
    log.info("当前队伍名称: {text}", teamName.text);

    async function selectTargetTeam(targetTeam) {
        moveMouseTo(100, 200);
        leftButtonDown();
        // 不能一次移动太多,否则会丢拖动
        for (let i = 1; i <= 9; i++) {
            await sleep(50);
            moveMouseTo(200 * i, 200);
        }
        await sleep(200);
        leftButtonUp();
        await sleep(1000);

        captureRegion = captureGameRegion();
        for (let i = 0; i < 4; i++) {
            let x = 135 + 463 * i;
            let res = captureRegion.find(RecognitionObject.ocr(x, 762, 230, 46));
            if (res.text == targetTeam) {
                log.info("切换至队伍: {text}", res.text);
                res.click();
                await sleep(500);
                break;
            }
        }
    }

    if (teamName.text != Name || settings.overwritePartyName == Name) {
        click(1312, 812); //点击队伍名称的糟糕UI
        await sleep(1000);
        await selectTargetTeam(Name);
    } else {
        return true;
    }

    async function stopNow() {
        await sleep(250);
        click(1795, 465); // 点空白处以便立即终止延时对话框
        await sleep(250);
    }

    let userDefault = false;
    if (shareCode) {
        captureRegion = captureGameRegion();
        let res = captureRegion.find(RecognitionObject.ocr(1140, 732, 83, 55));
        if (res.text === "确认") {
            res.click();
        } else {
            click(731, 998); // 编辑牌组
        }
        await sleep(800);
        click(1756, 48);    // ... 按钮
        await sleep(200);
        click(1546, 178);   // 使用分享码
        await sleep(500);
        click(960, 520);    // 输入区域
        await sleep(500);
        log.info("输入分享码 {0}", shareCode);
        await inputText(shareCode);
        await sleep(500);
        click(1166, 750);   // 导入
        await stopNow();
        click(1720, 1020);  // 保存
        await stopNow();
        captureRegion = captureGameRegion();
        res = captureRegion.find(RecognitionObject.ocr(770, 516, 381, 43));
        if (res.text.includes("无法出战")) {
            log.error(res.text);
            userDefault = true;
            await sleep(500);
            click(1162, 760); // 保存修改
            await stopNow();
        }
        click(1843, 46); // 关闭
        await sleep(1000);
    }

    if (userDefault) {
        log.info("分享码导入的牌组无法出战，切换到默认牌组: {0}", settings.defaultPartyName);
        await selectTargetTeam(settings.defaultPartyName);
    }

    click(1164, 1016); // 选择
    await sleep(4000); // 等待"出战牌组"的强制延时框消失
    return !userDefault;
}

/**
 * 判断任务是否已刷新
 * @param {string} filePath - 存储最后完成时间的文件路径
 * @param {object} options - 配置选项
 * @param {string} [options.refreshType] - 刷新类型: 'hourly'|'daily'|'weekly'|'monthly'|'custom'
 * @param {number} [options.customHours] - 自定义小时数(用于'custom'类型)
 * @param {number} [options.dailyHour=4] - 每日刷新的小时(0-23)
 * @param {number} [options.weeklyDay=1] - 每周刷新的星期(0-6, 0是周日)
 * @param {number} [options.weeklyHour=4] - 每周刷新的小时(0-23)
 * @param {number} [options.monthlyDay=1] - 每月刷新的日期(1-31)
 * @param {number} [options.monthlyHour=4] - 每月刷新的小时(0-23)
 * @returns {Promise<boolean>} - 是否已刷新
 */
async function isTaskRefreshed(filePath, options = {}) {
    const {
        refreshType = "hourly", // 默认每小时刷新
        customHours = 24, // 自定义刷新小时数默认24
        dailyHour = 4, // 每日刷新默认凌晨4点
        weeklyDay = 1, // 每周刷新默认周一(0是周日)
        weeklyHour = 4, // 每周刷新默认凌晨4点
        monthlyDay = 1, // 每月刷新默认第1天
        monthlyHour = 4, // 每月刷新默认凌晨4点
    } = options;

    try {
        // 读取文件内容
        let content = await file.readText(filePath);
        const lastTime = new Date(content);
        const nowTime = new Date();

        let shouldRefresh = false;

        switch (refreshType) {
            case "hourly": // 每小时刷新
                shouldRefresh = nowTime - lastTime >= 3600 * 1000;
                break;

            case "daily": // 每天固定时间刷新
                // 检查是否已经过了当天的刷新时间
                const todayRefresh = new Date(nowTime);
                todayRefresh.setHours(dailyHour, 0, 0, 0);

                // 如果当前时间已经过了今天的刷新时间，检查上次完成时间是否在今天刷新之前
                if (nowTime >= todayRefresh) {
                    shouldRefresh = lastTime < todayRefresh;
                } else {
                    // 否则检查上次完成时间是否在昨天刷新之前
                    const yesterdayRefresh = new Date(todayRefresh);
                    yesterdayRefresh.setDate(yesterdayRefresh.getDate() - 1);
                    shouldRefresh = lastTime < yesterdayRefresh;
                }
                break;

            case "weekly": // 每周固定时间刷新
                // 获取本周的刷新时间
                const thisWeekRefresh = new Date(nowTime);
                // 计算与本周指定星期几的差值
                const dayDiff = (thisWeekRefresh.getDay() - weeklyDay + 7) % 7;
                thisWeekRefresh.setDate(thisWeekRefresh.getDate() - dayDiff);
                thisWeekRefresh.setHours(weeklyHour, 0, 0, 0);

                // 如果当前时间已经过了本周的刷新时间
                if (nowTime >= thisWeekRefresh) {
                    shouldRefresh = lastTime < thisWeekRefresh;
                } else {
                    // 否则检查上次完成时间是否在上周刷新之前
                    const lastWeekRefresh = new Date(thisWeekRefresh);
                    lastWeekRefresh.setDate(lastWeekRefresh.getDate() - 7);
                    shouldRefresh = lastTime < lastWeekRefresh;
                }
                break;

            case "monthly": // 每月固定时间刷新
                // 获取本月的刷新时间
                const thisMonthRefresh = new Date(nowTime);
                // 设置为本月指定日期的凌晨
                thisMonthRefresh.setDate(monthlyDay);
                thisMonthRefresh.setHours(monthlyHour, 0, 0, 0);

                // 如果当前时间已经过了本月的刷新时间
                if (nowTime >= thisMonthRefresh) {
                    shouldRefresh = lastTime < thisMonthRefresh;
                } else {
                    // 否则检查上次完成时间是否在上月刷新之前
                    const lastMonthRefresh = new Date(thisMonthRefresh);
                    lastMonthRefresh.setMonth(lastMonthRefresh.getMonth() - 1);
                    shouldRefresh = lastTime < lastMonthRefresh;
                }
                break;

            case "custom": // 自定义小时数刷新
                shouldRefresh = nowTime - lastTime >= customHours * 3600 * 1000;
                break;

            default:
                throw new Error(`未知的刷新类型: ${refreshType}`);
        }

        // 如果文件内容无效或不存在，视为需要刷新
        if (!content || isNaN(lastTime.getTime())) {
            await file.writeText(filePath, "");
            shouldRefresh = true;
        }

        if (shouldRefresh) {
            notification.send(`七圣召唤七日历练周期已经刷新，执行脚本`);

            return true;
        } else {
            log.info(`七圣召唤七日历练未刷新`);
            return false;
        }
    } catch (error) {
        // 如果文件不存在，创建新文件并返回true(视为需要刷新)
        const createResult = await file.writeText(filePath, "");
        if (createResult) {
            log.info("创建新时间记录文件成功，执行脚本");
            return true;
        } else throw new Error(`创建新文件失败`);
    }
}

//检查挑战结果   await checkChallengeResults();
async function checkChallengeResults() {
    const region1 = RecognitionObject.ocr(785, 200, 380, 270); // 结果区域
    const region2 = RecognitionObject.ocr(1520, 170, 160, 40); // 退出位置
    let capture = captureGameRegion();
    let res1 = capture.find(region1);
    log.info(`结果识别：${res1.text}`);
    if (res1.text.includes("对局失败")) {
        log.info("对局失败");
        await sleep(1000);
        click(754, 915); //退出挑战
        await sleep(4000);
        await autoConversation();
        await sleep(1000);
        return;
    } else if (res1.text.includes("对局胜利")) {
        log.info("对局胜利");
        await sleep(1000);
        click(754, 915); //退出挑战
        await sleep(4000);
        await autoConversation();
        await sleep(1000);
        return;
    } else {
        log.info("挑战异常中断，对局失败");
        await sleep(1000);
        click(960, 540);
        await sleep(500);
        click(960, 540);
        await sleep(500);
        click(1860, 50); //点击齿轮图标
        await sleep(1000);
        let res2 = captureGameRegion().find(region2);
        if (res2.text.includes("设置")) click(1600, 260); //点击退出-选项4
        else click(1600, 200); //点击退出-选项3
        await sleep(1000);
        click(1180, 756); //点击确认
        await sleep(6000);
        click(754, 915); //退出挑战
        await sleep(4000);
        await autoConversation();
        await sleep(1000);
        return;
    }
}

//通过f和空格自动对话，对话标志消失时停止await autoConversation();
async function autoConversation() {
    await sleep(500); //点击后等待一段时间避免误判
    const talkRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/talkSymbol.png"));
    let talkTime = 0;
    let talkTimes = 0;
    log.info("准备开始对话");
    //最多10次对话
    while (talkTime < 30) {
        let talk = captureGameRegion().find(talkRo);
        if (talk.isExist()) {
            await sleep(300);
            keyPress("VK_SPACE");
            await sleep(300);
            keyPress("F");
            talkTimes++;
            await sleep(1500);
        } else if (talkTimes) {
            log.info("对话结束");
            return;
        }
        talkTime++;
        await sleep(1200);
    }
    throw new Error("对话时间超时");
}

//检测传送结束
async function tpEndDetection() {
    const region = RecognitionObject.ocr(1690, 230, 75, 350); // 队伍名称区域
    let tpTime = 0;
    await sleep(500); //点击传送后等待一段时间避免误判
    //最多30秒传送时间
    while (tpTime < 300) {
        let capture = captureGameRegion();
        let res = capture.find(region);
        if (!res.isEmpty()) {
            log.info("传送完成");
            await sleep(1200); //传送结束后有僵直
            return;
        }
        tpTime++;
        await sleep(100);
    }
    throw new Error("传送时间超时");
}

// 打开地图，查看玩家位置，并前往相应位置
const cardPlayerRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/cardPlayer.png"));
const detectCardPlayer = async () => {
    // 定义要检测的6个点位及对应的处理函数
    let i = 0;
    let findNum = 0;
    const checkPoints = [
        { x: 1475, y: 730, action: async () => await gotoTable1() }, // 1号桌
        { x: 1680, y: 780, action: async () => await gotoTable2() }, // 2号桌
        { x: 1645, y: 575, action: async () => await gotoTable3() }, // 3号桌
        { x: 1460, y: 360, action: async () => await gotoTable4() }, // 4号桌
        { x: 1550, y: 0, action: async () => await gotoTable5() }, // 包间1
        { x: 1130, y: 520, action: async () => await gotoTable6() }, // 包间2
    ];

    keyPress("M");
    await sleep(1200);
    await genshin.setBigMapZoomLevel(1.0); //放大地图
    await sleep(300);

    //地图拖动到指定位置
    moveMouseTo(200, 200);
    leftButtonDown();
    await sleep(500);
    moveMouseTo(170, 320);
    await sleep(500);
    moveMouseTo(970, 1000);
    await sleep(500);
    leftButtonUp();
    await sleep(500);

    // 获取游戏区域截图
    const captureRegion = captureGameRegion();

    for (const point of checkPoints) {
        i++;
        // 遍历所有检测点位
        const cropRegion = captureRegion.DeriveCrop(point.x, point.y, 160, 160);

        // 在裁剪区域中查找卡片
        const result = cropRegion.Find(cardPlayerRo);

        // 如果找到卡片
        if (!result.IsEmpty()) {
            findNum++;
            if (findNum - skipNum == 1) {
                log.info(`在点位${i}找到玩家，执行对应操作`);
                await sleep(1000);
                keyPress("ESCAPE");
                await sleep(1500);
                await point.action(); // 调用该点位对应的函数
                return true; // 返回true表示已找到并处理
            }
        }
    }

    // 所有点位都未找到
    log.info("未在任何检测点找到玩家");
    textArray.length = 0;
    return false;
};

//获取挑战对象名称
async function captureAndStoreTexts() {
    // 清空数组
    textArray = [];
    // 四个固定位置坐标
    const positions = [
        { x: 450, y: 620 },
        { x: 760, y: 620 },
        { x: 1070, y: 620 },
        { x: 1380, y: 620 },
    ];

    // 截取区域大小
    const width = 240;
    const height = 56;
    await sleep(500);
    keyPress("F6");
    await sleep(1000);
    click(300, 370); //点击七日历练
    await sleep(1000);
    // 获取游戏区域截图
    const captureRegion = captureGameRegion();

    // 遍历四个位置进行OCR识别
    for (const pos of positions) {
        // 创建OCR识别区域
        const ocrRo = RecognitionObject.ocr(pos.x, pos.y, width, height); //挑战者名字区域
        const ocrRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/completed.png"), pos.x, pos.y + 60, width, height + 80);
        // 在指定区域进行OCR识别
        const result = captureRegion.find(ocrRo);
        let res2 = captureRegion.find(ocrRo2);
        if (!result.isEmpty() && result.text) {
            // 存储识别结果和对应位置
            if (res2.isExist()) {
                log.info(`识别到文本: ${result.text} 位置: (${pos.x}, ${pos.y})`);
                textArray.push({
                    text: result.text.trim(),
                    x: pos.x + width / 2, // 点击中心位置
                    y: pos.y + height / 2,
                });
            }
        } else {
            log.warn(`位置 (${pos.x}, ${pos.y}) 未识别到文本`);
        }
    }

    log.info(`剩余挑战人数:${textArray.length}`);
    keyPress("ESCAPE");
    await sleep(1000);
}

// 计算两个字符串的相似度（允许最多一个字的差异）
function isTextMatch(target, source) {
    // 如果完全匹配直接返回true
    if (target === source) return true;

    // 如果长度不同，直接不匹配
    if (target.length !== source.length) return false;

    let diffCount = 0;
    for (let i = 0; i < target.length; i++) {
        if (target[i] !== source[i]) {
            diffCount++;
            if (diffCount > 1) {
                return false;
            }
        }
    }
    return true;
}

// 获取某个角色的专用牌组的分享码。如无专用策略，则返回 null
function getShareCodeOfCharStrategy(charName) {
    const allFilesRaw = file.ReadPathSync("牌组策略");
    let strategyMap = {};
    for (const filePath of allFilesRaw) {
        if (filePath.endsWith(".txt")) {
            const parts = filePath.split("\\");
            const fileName = parts.slice(-1)[0];
            const baseName = fileName.split(".").slice(0, -1).join(".");
            strategyMap[baseName] = filePath;
        }
    }

    const content = file.readTextSync("牌组策略/雷神柯莱刻晴.txt");
    let result = { team: settings.defaultPartyName, shareCode: null, defaultContent: content, content: content };
    const matchFile = strategyMap[charName];
    if (matchFile) {
        const content = file.readTextSync(matchFile);
        let shareCode = null;
        for (const line of content.split("\n")) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("//") && trimmedLine.includes("shareCode=")) {
                const parts = trimmedLine.split("=");
                if (parts[1]) {
                    shareCode = parts.slice(1, parts.length).join("=");
                    break;
                }
            }
        }
        if (shareCode) {
            result.team = settings.overwritePartyName;
            result.shareCode = shareCode;
            result.content = content;
            log.debug("charName={0}, shareCode={1}", charName, shareCode);
        } else {
            log.error("策略文件中未找到有效的shareCode: {0}", matchFile);
        }
    }
    log.info("使用牌组{0}与{1}对战", result.team, charName);
    return result;
}

//检查是否有对应的挑战对手
async function searchAndClickTexts() {
    middleButtonClick();
    await sleep(800);
    moveMouseBy(0, 1030);
    await sleep(800);
    moveMouseBy(0, 1030);
    await sleep(800);
    // 限定区域坐标和大小
    const searchX = 1210;
    const searchY = 440;
    const searchWidth = 150;
    const searchHeight = 195;

    // 获取游戏区域截图
    const captureRegion = captureGameRegion();

    // 在限定区域内进行OCR识别
    const ocrRo = RecognitionObject.ocr(searchX, searchY, searchWidth, searchHeight);
    const results = captureRegion.findMulti(ocrRo);

    // 遍历OCR结果
    for (let i = 0; i < results.count; i++) {
        const res = results[i];
        const resText = res.text.trim();

        // 在存储的文本数组中查找匹配项
        const index = textArray.findIndex((item) => isTextMatch(item.text, resText));

        if (index !== -1) {
            // 找到匹配项，点击对应位置
            log.info(`找到匹配文本: ${resText} (原存储文本: ${textArray[index].text})`);
            skipNum = 0;
            // 点击存储的位置
            await keyMouseScript.runFile(`assets/ALT点击.json`);
            await sleep(500);
            res.click();
            await sleep(500);
            await keyMouseScript.runFile(`assets/ALT释放.json`);
            const strategy = getShareCodeOfCharStrategy(textArray[index].text);
            await Playcards(strategy);

            // 从数组中移除已处理的文本
            textArray.splice(index, 1);

            return true;
        }
    }
    log.info(`未找到匹配文本`);
    skipNum++;
    return false;
}

//函数：打开地图前往猫尾酒馆
async function gotoTavern() {
    const tavernRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/tavern.png"));
    await genshin.returnMainUi();
    await sleep(1000);
    keyPress("m");
    await sleep(1500);
    click(1841, 1015); //地图选择
    await sleep(1000);
    click(1460, 140); //蒙德
    await sleep(1200);
    //放大地图
    await genshin.setBigMapZoomLevel(1.0);
    await sleep(400);

    click(1000, 645); //猫尾酒馆
    await sleep(600);
    let tavern = captureGameRegion().find(tavernRo);
    if (tavern.isExist()) {
        tavern.click();
        await sleep(500);
    } else {
        throw new Error("未能找到猫尾酒馆");
    }
    click(1707, 1010); //确认传送
    await sleep(1000);
    await tpEndDetection();
}

async function waitOrCheckMaxCoin(wait_time_ms) {
    const startTime = new Date().getTime();
    while (new Date().getTime() - startTime < wait_time_ms) {
        let captureRegion = captureGameRegion();
        let result = captureRegion.find(RecognitionObject.ocr(578, 600, 763, 41));
        // 道具已达到容量上限，无法获取对应奖励且挑战目标无法完成，是否继续进行挑战
        if (!result.isEmpty() && result.text.includes("道具已达到容量上限")) {
            let coin = "?";
            let result2 = captureRegion.find(RecognitionObject.ocr(916, 530, 89, 41));
            if (!result2.isEmpty()) {
                coin = result2.text.trim();
            }
            click(733, 730); //点击取消
            await sleep(1000);
            click(1860, 250); //点击右上角X，退出打牌对话界面
            throw new Error(`幸运牌币${coin}，已达到容量上限，无法获取对应奖励且挑战目标无法完成`);
        }
        await sleep(1000);
        // 无break，以确保牌币未满时延时行为与此前一致
    }
}

//函数：对话和打牌
async function Playcards(strategy) {
    await sleep(800); //略微俯视，避免名字出现在选项框附近，导致错误点击
    moveMouseBy(0, 1030);
    await sleep(1000);
    await autoConversation();
    log.info("对话完成");
    await sleep(1500);
    const success = await switchCardTeam(strategy.team, strategy.shareCode);
    const content = success ? strategy.content : strategy.defaultContent;
    click(1610, 900); //点击挑战
    await waitOrCheckMaxCoin(8000);
    await dispatcher.runTask(new SoloTask("AutoGeniusInvokation", { strategy: content }));
    await sleep(3000);
    await checkChallengeResults();
    await sleep(1000);
}

//前往一号桌
async function gotoTable1() {
    log.info(`前往1号桌`);
    keyDown("d");
    await sleep(1500);
    keyUp("d");
    keyDown("w");
    await sleep(400);
    keyUp("w");
    keyDown("d");
    keyDown("w");
    await sleep(1200);
    keyUp("d");
    keyUp("w");
    await sleep(700);
}
//前往二号桌
async function gotoTable2() {
    log.info(`前往2号桌`);
    keyDown("d");
    await sleep(1500);
    keyUp("d");
    keyDown("w");
    await sleep(400);
    keyUp("w");
    keyDown("d");
    keyDown("w");
    await sleep(1200);
    keyUp("d");
    keyUp("w");
    keyDown("s");
    await sleep(700);
    keyUp("s");
    await sleep(700);
}
//前往三号桌
async function gotoTable3() {
    log.info(`前往3号桌`);
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    keyDown("d");
    await sleep(5000);
    keyUp("d");
    keyDown("a");
    await sleep(1500);
    keyUp("a");
    await sleep(700);
}
//前往四号桌
async function gotoTable4() {
    log.info(`前往4号桌`);
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    keyDown("d");
    await sleep(5000);
    keyUp("d");
    keyDown("a");
    await sleep(1500);
    keyUp("a");
    keyDown("d");
    await sleep(200);
    keyUp("d");
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    await sleep(700);
}
//前往一号包间
async function gotoTable5() {
    log.info(`前往1号包间`);
    keyDown("w");
    await sleep(2500);
    keyUp("w");
    keyDown("d");
    await sleep(200);
    keyUp("d");
    await sleep(500);
    keyPress("ESCAPE");
    await sleep(1500);
    keyPress("ESCAPE");
    await sleep(1500);
    keyDown("w");
    await sleep(5900);
    keyUp("w");
    await sleep(700);
}
//前往二号包间
async function gotoTable6() {
    log.info(`前往2号包间`);
    await sleep(1500);
    keyDown("d");
    await sleep(1500);
    keyUp("d");
    keyDown("w");
    keyDown("d");
    await sleep(4000);
    keyUp("d");
    keyUp("w");
    keyDown("a");
    await sleep(1500);
    keyUp("a");
    keyDown("w");
    await sleep(3000);
    keyPress("VK_SPACE");
    await sleep(1000);
    keyUp("w");
    keyDown("s");
    await sleep(1000);
    keyPress("VK_SPACE");
    await sleep(700);
    keyUp("s");
    await sleep(500);
}

async function main() {
    //主流程
    const nowTime = new Date();
    log.info(`前往猫尾酒馆`);
    await gotoTavern();
    await captureAndStoreTexts();
    if (textArray.length != 0) {
        await detectCardPlayer();
        await searchAndClickTexts();
    }
    for (let i = 0; i < 20; i++) {
        //循环兜底，避免角色未到达指定位置
        if (textArray.length === 0) break;
        await gotoTavern();
        await detectCardPlayer();
        await searchAndClickTexts();
    }
    await genshin.returnMainUi();
    await captureAndStoreTexts();
    notification.send(`打牌结束、剩余挑战人数:${textArray.length}`);
    // 更新最后完成时间
    if (textArray.length === 0) {
        await file.writeText("assets/weekly.txt", nowTime.toISOString());
    }
}

(async function () {
    const refresh = {
        refreshType: "weekly",
        weeklyDay: 1, // 周一
        weeklyHour: 4, // 凌晨4点
    };
    if (!settings.defaultPartyName || !settings.overwritePartyName || settings.defaultPartyName == settings.overwritePartyName) {
        log.error("需要在JS脚本配置中设置两个牌组且名称不能相同");
        return;
    }
    if ((await isTaskRefreshed("assets/weekly.txt"), refresh)) {
        await main();
    }
})();
