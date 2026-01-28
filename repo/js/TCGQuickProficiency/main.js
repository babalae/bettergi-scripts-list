eval(file.readTextSync("lib/ocr.js"));

const rewardIcon = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RewardIcon.png"), 1430, 760, 100, 70);
const tavernRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/TavernIcon.png"), 800, 450, 500, 330);
const adventurersRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/AdventurersGuild.png"), 800, 450, 500, 330);

const stateMachine = {
    "任意界面": { "猫尾酒馆进门": teleportToTheCatsTail },
    "猫尾酒馆进门": { "邀请界面": gotoInvitationPanel },
    "邀请界面": { "牌组编辑器界面": gotoDeckDesignPanel, "对战": startChallenge },
    "牌组编辑器界面": { "邀请界面": goBackInvitationPanel },
    "对战": {}, // 对战结束后将状态维护至 猫尾酒馆进门
};
let currentState = "任意界面";

const outFile = "卡牌熟练度.json";
let allProficiencys = {};
try {
    allProficiencys = JSON.parse(file.readTextSync(outFile));
} catch (error) {
    log.debug("历史熟练度文件不存在");
}

(async function () {
    setGameMetrics(1920, 1080, 1.25);
    log.info("首次运行前请阅读脚本说明");
    log.info("请确保已进入双人联机模式");
    await sleep(1000);

    let runMode = settings.runMode;
    if (!runMode) {
        runMode = "作为主账号：速刷熟练度";
        log.info("未配置运行模式，默认以{0}模式运行", runMode);
    }

    if (runMode === "作为主账号：速刷熟练度") {
        await runAsMain(settings.targetProficiency);
    } else if (runMode === "作为辅助账号：快速投降") {
        await runAsPartner();
    } else if (runMode === "扫描当前账号卡牌熟练度") {
        currentState = await getCurrentState();
        await goToTargetState("牌组编辑器界面");
        allProficiencys = await scanCardsProficiency(true);
        file.writeTextSync(outFile, JSON.stringify(allProficiencys, null, 2));
        log.info("卡牌熟练度数据已写入{0}", outFile);
    } else {
        log.error("不支持的运行模式: {0}", runMode);
    }
})();

// 需要刷熟练度的角色的执行逻辑
async function runAsMain(targetProficiency) {
    log.info("主账号开始工作，如需停止请按下你设置的BetterGI停止按键");
    if (!targetProficiency) {
        targetProficiency = 30;
    }
    let loopCount = -1;

    currentState = await getCurrentState();
    log.info("当前界面: {0}", currentState);
    await goToTargetState("牌组编辑器界面");
    let teamProficiencys = await scanCardsProficiency(false);
    loopCount = targetProficiency - Math.min(...Object.values(teamProficiencys));
    if (loopCount > 0) {
        log.info("需重复执行{0}次以达成{1}熟练度", loopCount, targetProficiency);
        await goToTargetState("邀请界面");
    }

    while (loopCount > 0) {
        await goToTargetState("对战");
        try {
            await sleep(10);
        } catch (error) {
            log.info("用户停止运行");
            break;
        }
        loopCount--;
        log.info(`对局结束，当前熟练度 ${targetProficiency - loopCount}/${targetProficiency}`);
        currentState = "猫尾酒馆进门";
        await waitTpFinish();
    };

    // 执行过对战，且对战结束
    if (loopCount === 0 && currentState === "猫尾酒馆进门") {
        await goToTargetState("牌组编辑器界面");
        teamProficiencys = await scanCardsProficiency(false, true);
    }
    Object.assign(allProficiencys, teamProficiencys);
    recommendNextTeam(targetProficiency);
    file.writeTextSync(outFile, JSON.stringify(allProficiencys, null, 2));
}

// 小号的执行逻辑
async function runAsPartner() {
    log.info("辅助账号开始工作，如需停止请按下你设置的BetterGI停止按键");
    while (true) {
        log.info("等待对局邀请");
        await waitForTextAppear("点击进行准备", [820, 70, 296, 31], 1800000);
        keyPress("Y");
        await recognizeTextAndClick("接受", [1177, 713, 82, 55]);

        log.info("等待加载");
        await waitForTextAppear("七圣召唤", [902, 870, 119, 46]);

        await waitForTextAppear("请选择要替换的手牌", [847, 232, 229, 39], 30000);
        log.info("选择初始手牌");
        await recognizeTextAndClick("确定", [937, 922, 82, 54], 30000);

        log.info("等待进入牌桌界面");
        await waitForTextAppear("出战角色", [1766, 850, 118, 43]);

        log.info("认输");
        click(1864, 46);
        await sleep(500);
        await recognizeTextAndClick("放弃对局", [1543, 172, 112, 43]);
        await waitForTextAppear("确定要放弃", [785, 497, 339, 39]);
        await recognizeTextAndClick("确认", [1142, 732, 78, 51]);

        await waitForTextAppear("退出挑战", [913, 893, 130, 43], 60000);
        await sleep(300);
        await recognizeTextAndClick("退出挑战", [913, 893, 130, 43]);
        log.info("退出挑战");

        try {
            await sleep(3000);
        } catch (error) {
            log.info("用户停止运行");
            break;
        }
    }
}

/** 从刚传送至猫尾酒馆的状态前往邀请界面 */
async function gotoInvitationPanel() {
    keyDown("MBUTTON");
    await sleep(500);

    keyDown("A");
    await sleep(1500);
    keyUp("A");

    await sleep(1000);
    await keyMouseScript.runFile(`assets/ALT点击.json`);
    await sleep(500);
    await recognizeTextAndClick("联机对局", [1217, 411, 220, 280]);
    await sleep(500);
    await keyMouseScript.runFile(`assets/ALT释放.json`);
}

/** 从邀请界面前往牌组编辑器界面 */
async function gotoDeckDesignPanel() {
    click(1306, 747);
    log.info("等待进入牌组界面");
    await recognizeTextAndClick("编辑牌组", [733, 997, 129, 48]);
    await waitForTextAppear("更改牌组外观", [1592, 186, 139, 35]);
}

/** 从牌组编辑器界面返回邀请界面 */
async function goBackInvitationPanel() {
    keyPress("VK_ESCAPE");
    await waitForTextAppear("更改牌组外观", [1592, 186, 139, 35]);
    keyPress("VK_ESCAPE");
    await waitForTextAppear("编辑牌组", [733, 997, 129, 48]);
    keyPress("VK_ESCAPE");
    await waitForTextAppear("我方出战牌组", [1248, 688, 156, 36]);
}

/** 从邀请界面进入对战模式（并完成对战） */
async function startChallenge() {
    log.info("邀请队友");
    for (let i = 0; i < 60; i++) {
        await recognizeTextAndClick("邀请队友", [1332, 886, 130, 49]);
        let r = await waitForTextAppear("正在匹配对局", [870, 385, 184, 42], 500);
        if (r.success) {
            break;
        }
        await sleep(500);
    }

    log.info("等待对方同意");
    await waitForTextAppear("正在匹配对局", [871, 386, 182, 39], 30000);

    log.info("等待加载");
    await waitForTextAppear("七圣召唤", [902, 870, 119, 46]);

    await waitForTextAppear("请选择要替换的手牌", [847, 232, 229, 39], 30000);
    log.info("选择初始手牌");
    await recognizeTextAndClick("确定", [937, 922, 82, 54], 30000);

    log.info("等待对方认输");
    await waitForTextAppear("退出挑战", [913, 893, 130, 43], 60000);
    await sleep(300);
    await recognizeTextAndClick("退出挑战", [913, 893, 130, 43]);

    currentState = "猫尾酒馆进门";
}

function recommendNextTeam(targetProficiency) {
    log.info("当前牌组中卡牌已达成熟练度目标，请更换牌组内角色");
    const nextTeam = Object.fromEntries(
        Object.entries(allProficiencys)
            .filter(([_, v]) => v < targetProficiency)
            .slice(0, 3)
    );
    if (Object.keys(nextTeam).length > 0) {
        let text = JSON.stringify(nextTeam).replace(/[{}"]/g, "");
        log.info("熟练度未满的角色推荐: {0}", text);
    }
}

/**
 * 等待传送结束
 * @param {Int} timeout 单位为ms
 * @note 参考了七圣召唤七日历练脚本
 */
async function waitTpFinish(timeout = 30000) {
    const region = RecognitionObject.ocr(1690, 230, 75, 350); // 队伍名称区域
    const startTime = new Date();

    await sleep(1000); //点击传送后等待一段时间避免误判
    while (new Date() - startTime < timeout) {
        let ro = captureGameRegion();
        let res = ro.find(region);
        ro.dispose();
        if (!res.isEmpty()) {
            await sleep(600); //传送结束后有僵直
            return;
        }
        await sleep(100);
    }
    throw new Error("传送时间超时");
}

/** 传送到猫尾酒馆并等待传送后摇结束 */
async function teleportToTheCatsTail() {
    await genshin.moveMapTo(-867, 2281, "蒙德");
    await genshin.setBigMapZoomLevel(1.0);
    let clickIcon = null;
    for (let i = 0; i < 5; i++) {
        const region = captureGameRegion();
        const tavern = region.find(tavernRo);
        clickIcon = tavern.isExist() ? tavern : region.find(adventurersRo);
        region.dispose();
        if (clickIcon.isExist()) {
            clickIcon.click();
            await sleep(500);
            break;
        }
        await sleep(500);
    }
    if (!(clickIcon && clickIcon.isExist())) {
        throw new Error("找不到猫尾酒馆，如果2P标志遮挡了酒馆图标，请将2P玩家传送至别处");
    }
    await recognizeTextAndClick("猫尾酒馆", [1320, 560, 300, 410]);
    await recognizeTextAndClick("传送至", [1580, 980, 225, 59]);
    await waitTpFinish();
}

async function getCurrentState() {
    let window = captureGameRegion();
    const invite = window.find(RecognitionObject.ocr(1248, 688, 156, 36));
    if (invite.text && invite.text.includes("我方出战牌组")) {
        window.dispose();
        return "邀请界面";
    }
    const deck = window.find(RecognitionObject.ocr(1592, 186, 139, 35));
    if (deck.text && deck.text.includes("更改牌组外观")) {
        window.dispose();
        return "牌组编辑器界面";
    }
    window.dispose();
    return "任意界面";
}

async function scanCardsProficiency(scanAll = false, getReward = false) {
    let proficiencys = {};
    let last_char = "";
    let character = null;
    let retry = 0;

    for (let i = 0; i < 5; i++) {
        if (scanAll) {
            click(198, 717);
        } else {
            click(700, 276);
        }
        let r = await waitForTextAppear("卡牌", [867, 266, 68, 47], 500);
        if (r.success) {
            break;
        }
    }

    while (true) {
        let captureRegion = captureGameRegion();

        if (getReward) {
            const icon = captureRegion.find(rewardIcon);
            if (icon.isExist()) {
                icon.click();
                await sleep(200);
                icon.click();
                await sleep(200);
            }
        }

        let proficiency = null;
        let proficiencyResult = captureRegion.find(RecognitionObject.ocr(855, 780, 210, 40));
        if (proficiencyResult.text) {
            const match = proficiencyResult.text.match(/(\d+)/);
            proficiency = parseInt(match[0]);
        }

        character = null;
        let ch_result = captureRegion.find(RecognitionObject.ocr(851, 326, 398, 65));
        if (ch_result.text) {
            character = ch_result.text.trim().replace(/t/g, "七");
        } else {
            retry++;
            if (retry >= 3) {
                const skill = captureRegion.find(RecognitionObject.ocr(897, 441, 300, 58));
                captureRegion.dispose();
                if (skill.text) {
                    log.warn("OCR无法识别当前角色名称，使用技能名作为替代");
                    character = `?${skill.text.trim()}`;
                } else {
                    log.warn("OCR无法识别当前角色名称，跳过");
                    click(1635, 538);
                    retry = 0;
                    continue;
                }
            }
        }

        if (last_char === character) {
            log.info("已到达角色列表末尾");
            keyPress("VK_ESCAPE");
            await sleep(400);
            break;
        }
        if (proficiency !== null && character !== null) {
            proficiencys[character] = proficiency;
            log.info("{ch} = {v}", character, proficiency);
            click(1635, 538);
            retry = 0;
            last_char = character;
        }
        await sleep(400);
    }

    const sortedProficiencys = Object.entries(proficiencys).sort((a, b) => b[1] - a[1]);
    proficiencys = Object.fromEntries(sortedProficiencys);
    return proficiencys;
}

/**
 * 使用BFS方法计算应当如何到达目标状态
 */
function searchPathWithBFS(start, target) {
    const queue = [[start, []]];
    const visited = new Set();

    while (queue.length > 0) {
        const [current, ops] = queue.shift();
        if (current === target) return ops;
        if (visited.has(current)) continue;
        visited.add(current);

        const transitions = stateMachine[current] || {};
        for (const [nextState, op] of Object.entries(transitions)) {
            queue.push([nextState, [...ops, op]]);
        }
    }

    // 无法到达时走最保守的路径
    if (start !== "任意界面") {
        return searchPathWithBFS("任意界面", target);
    }
    return null;
}

async function goToTargetState(target) {
    // log.info("切换状态: {0} -> {1}", currentState, target);
    const pathList = searchPathWithBFS(currentState, target);
    for (const fn of pathList) {
        // log.info("执行函数: {0}", fn.name);
        await fn();
    }
    currentState = target;
}
