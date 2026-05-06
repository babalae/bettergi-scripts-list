// 全局变量
// 标记任务是否结束
let finished = false;
// 投喂次数
let feedCount = 0;

//模板与识别对象预加载
// “联机”指示图标裁剪范围为346, 29, 30, 30
const coOpModeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/联机.png'), 336, 19, 50, 50);
// “回到单人模式”按钮完整范围为1483, 986, 308, 63，图像裁剪范围为1514, 997, 230, 42
const singlePlayer1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/单人模式.png'), 1483, 986, 308, 63);
// 单人模式“确认”按钮完整区域为979, 726, 370, 63，裁剪范围为1010, 736, 210, 42
const singlePlayer1ConfirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/单人模式确认.png'), 979, 726, 370, 63);
// “离开队伍”按钮完整范围为1483, 986, 308, 63，图像裁剪范围为1514, 997, 230, 42
const singlePlayer2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/离开队伍.png'), 1483, 986, 308, 63);

//“动物密友”任务文字图像裁剪范围为83, 253, 84, 21。登陆完成后约500毫秒后可以检测到
const friendToAnimalsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/动物密友.png'), 30, 240, 150, 400);
friendToAnimalsRo.Threshold = 0.5;
friendToAnimalsRo.InitTemplate();
// 完成“动物密友”任务文字图像裁剪范围为83, 253, 84, 21。投喂完成几乎是可以立即检测到，持续时间约3000毫秒。
const finishedFriendToAnimalsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/动物密友完成.png'), 30, 240, 150, 400);
// “动物密友突发事件”图像的裁剪范围为892, 167, 136, 37，该图像在登陆完成后的1500-5500毫秒的时间内存在
const randomEventRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/突发事件.png'), 832, 151, 256, 69);
// “动物密友突发事件”图像的裁剪范围为892, 167, 136, 37。投喂完成后约1500毫秒后可以检测到，持续时间约3500毫秒
const finishedRandomEventRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/事件完成.png'), 832, 151, 256, 69);

// “投喂”图像的裁剪范围为1221, 525, 60, 28
const feedRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/投喂.png'), 1215, 523, 72, 32);
// “确认”按钮完整裁剪范围为978, 725, 372, 64，图像裁剪范围为1012, 736, 200, 42
const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/确认.png'), 978, 725, 372, 64);
// “禽肉数量”裁剪范围为945, 540, 14, 18
const zeroFowlRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/禽肉数量.png'), 940, 535, 40, 28);

// 事件奖励的摩拉图标裁剪范围：124, 602, 21, 21。确认投喂后约2500毫秒后可以检测到，持续时间约2500毫秒
const moraRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/摩拉.png'), 61, 500, 300, 300);

// 监测是否联机，若联机则退出联机状态
async function ensureSinglePlayerMode() {
    let gameRegion;
    let result;
    let exists;

    gameRegion = captureGameRegion();
    result = gameRegion.find(coOpModeRo);
    gameRegion.dispose();
    exists = result.isExist();
    result.dispose();
    if (exists) {
        log.info("单人模式");
        return true;
    } else {
        log.info("多人游戏中，尝试回到单人模式");
        await genshin.tp(-4492, -3208, "Teyvat", true);
        await sleep(1500);
        keyPress("F2");
        await sleep(1500);
        gameRegion = captureGameRegion();
        let result1 = gameRegion.find(singlePlayer1Ro);
        let result2 = gameRegion.find(singlePlayer2Ro);
        gameRegion.dispose();
        if (result1.isExist()) {
            result1.click();
            await sleep(1500);
            gameRegion = captureGameRegion();
            result1.dispose();
            result1 = gameRegion.find(singlePlayer1ConfirmRo);
            gameRegion.dispose();
            if (result1.isExist()) {
                result1.click();
                log.info("回到单人模式");
            }
        } else if (result2.isExist()) {
            result2.click();
            log.info("回到单人模式");
        }

        result1.dispose();
        result2.dispose();
        await sleep(2000);
        await genshin.returnMainUi();

        return false;
    }
}

//切换队伍
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }
    try {
        log.info(`正在尝试切换至: ${partyName}`);
        if (!(await genshin.switchParty(partyName))) {
            throw new Error("切换失败");
        }
        log.info(`成功切换至: ${partyName}`);
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        await genshin.returnMainUi();
    }
}

//判断好感突发事件是否触发
async function randomEventTriggered() {
    let index;
    let gameRegion;
    let result;
    let exists;

    await sleep(300);

    for (index = 0; index < 10; index++) {
        gameRegion = captureGameRegion();
        result = gameRegion.find(friendToAnimalsRo);
        gameRegion.dispose();
        exists = result.isExist();
        result.dispose();
        if (!exists) { await sleep(100); }
        else { return true; }
    }
    for (index = 0; index < 10; index++) {
        gameRegion = captureGameRegion();
        result = gameRegion.find(randomEventRo);
        gameRegion.dispose();
        exists = result.isExist();
        result.dispose();
        if (!exists) { await sleep(400); }
        else { return true; }
    }
    gameRegion = captureGameRegion();
    result = gameRegion.find(friendToAnimalsRo);
    gameRegion.dispose();
    exists = result.isExist();
    result.dispose();
    if (exists) { return true; }

    return false;
}

// 判断投喂后是否完成事件
async function finishedEvent() {
    let index;
    let gameRegion;
    let result;
    let exists;

    for (index = 0; index < 10; index++) {
        gameRegion = captureGameRegion();
        result = gameRegion.find(finishedFriendToAnimalsRo);
        gameRegion.dispose();
        exists = result.isExist();
        result.dispose();
        if (!exists) { await sleep(100); }
        else { return true; }
    }

    for (index = 0; index < 10; index++) {
        gameRegion = captureGameRegion();
        result = gameRegion.find(finishedRandomEventRo);
        gameRegion.dispose();
        exists = result.isExist();
        result.dispose();
        if (!exists) { await sleep(100); }
        else { return true; }
    }

    return false;
}

// 识别奖励
async function hasEventReward() {
    let index;
    let gameRegion;
    let result;
    let exists;

    for (index = 0; index < 50; index++) {
        gameRegion = captureGameRegion();
        result = gameRegion.find(moraRo);
        gameRegion.dispose();
        exists = result.isExist();
        result.dispose();
        if (!exists) { await sleep(100); }
        else { return true; }
    }
    return false;
}

// 寻找“投喂”，按下F，点击“确认”按钮，完成投喂
async function feedDog() {
    let gameRegion;
    let result;
    let exists;
    let retry;

    retry = 0;
    await sleep(200); // 等待角色站稳，避免二次调整位置
    do {
        gameRegion = captureGameRegion();
        result = gameRegion.find(feedRo);
        gameRegion.dispose();
        exists = result.isExist();
        result.dispose();
        if (!exists) {
            if (++retry > 5) {
                log.error("多次尝试仍未识别到“投喂”，结束任务");
                return false;
            }
            await pathingScript.runFile("assets/pathing/鸡腿好感_狗盆点位.json");
        } else { keyPress("F"); }
    } while (!exists);

    await sleep(1000);
    gameRegion = captureGameRegion();
    result = gameRegion.find(confirmRo);
    try {
        if (result.isExist()) { result.click(); }
        else {
            log.error("未识别到可交互的确认按钮");
            result.dispose();
            result = gameRegion.find(zeroFowlRo);
            keyPress("Escape");
            await sleep(1000);
            await genshin.returnMainUi();
            if (result.isExist()) { log.error("禽肉数量为0，无法完成任务"); }
            return false;
        }
    } finally {
        result.dispose();
        gameRegion.dispose();
    }

    return true;
}

// 检查“投喂”的结果
async function checkFeed() {
    if (await finishedEvent()) {
        feedCount++;
        log.info("投喂成功");
        if (feedCount >= 10) {
            log.info("10次投喂完成");
            finished = true;
            return true;
        }
        if (!(await hasEventReward())) {
            log.info("投喂成功后未识别到奖励，当日突发事件奖励已达上限");
            finished = true;
        }
    }
}

async function main() {
    let retry;

    // 等待返回主界面
    await genshin.returnMainUi();
    // 强制传送，避免在奇奇怪怪的地方，例如“银月之庭”
    await genshin.tp(-4492, -3208, "Teyvat", true);
    // 判断是否为联机模式，通过模拟点击回到单人模式
    while (!(await ensureSinglePlayerMode())) { await sleep(500); }
    // 移动到任务刷新点
    await pathingScript.runFile("assets/pathing/鸡腿好感_初始化.json");
    // 判断是否设置了好感队，切换队伍
    await switchPartyIfNeeded(settings.partyName);
    retry = 0;
    const startTime = Date.now();
    // 任务循环
    task: while (!finished) {
        // 重新登陆，刷新任务
        await genshin.relogin();
        // 检测“动物密友”任务是否触发，若未触发则重新登陆触发
        if (!(await randomEventTriggered())) {
            if (++retry > 5) {
                log.error("多次尝试触发突发事件失败，结束任务");
                break;
            }
            await pathingScript.runFile("assets/pathing/鸡腿好感_甜甜花点位.json");
            continue;
        } else { retry = 0; }
        // 前往狗盆
        await pathingScript.runFile("assets/pathing/鸡腿好感_喂狗.json");
        // 等待投喂
        if (!(await feedDog())) { break; }
        // 异步检查投喂结果
        const checkFeedPromise = checkFeed();
        // 返回前判断任务是否已完成，减少时间
        for (let index = 0; index < 10; index++) {
            if (finished) { break task; }
            await sleep(10);
        }
        // 返回甜甜花
        await pathingScript.runFile("assets/pathing/鸡腿好感_返回.json");
        // 计算剩余时间
        if (feedCount > 0) {
            const remainingTime = (Date.now() - startTime) / feedCount * (10 - feedCount) / 1000;
            const remainingMinutes = Math.floor(remainingTime / 60);
            const remainingSeconds = remainingTime % 60;
            log.info(`当前进度：第 ${feedCount}/10 次已完成，预计剩余时间：${remainingMinutes} 分 ${remainingSeconds.toFixed(0)} 秒`);
        }
        await checkFeedPromise;
    }
    log.info("好感任务结束");
}

(async function () {
    await main();
})();