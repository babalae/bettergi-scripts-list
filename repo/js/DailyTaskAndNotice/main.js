const ExpeditionIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Expedition Icon.png"), 1260, 200, 70, 700);
const ClaimDailyCommissionRewardIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Claim Daily Commission Reward Icon.png"), 1260, 200, 70, 700);
const ExpeditionClaimButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Black Claim Button.png"), 40, 980, 60, 80);
const BlackConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Black Confirm Button.png"), 500, 700, 900, 300);
const HideUIButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Hide UI Button.png"), 0, 0, 500, 100);

const AdventurerHandbookButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Adventurer Handbook Button.png"), 100, 300, 700, 700);
const RewardClaimedRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Reward Claimed.png"), 400, 800, 300, 100);

const MailButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Mail Button.png"), 0, 300, 100, 600);
const MailClaimButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Black Claim Button.png"), 0, 970, 700, 100);

const CloseButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Close Button.png"), 1800, 0, 100, 100);
const BattlePassButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Battle Pass Button.png"), 100, 300, 700, 700);
const SelectedTaskButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Selected Task Button.png"), 800, 0, 300, 90);
const TaskButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Task Button.png"), 800, 0, 300, 90);
const SelectedGnosticHymnButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Selected Gnostic Hymn Button.png"), 800, 0, 300, 90);
const GnosticHymnButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Gnostic Hymn Button.png"), 800, 0, 300, 90);

async function ocrItem(x, y, w, h) {
    let recognitionObjectOcr = RecognitionObject.Ocr(x, y, w, h);
    let region = captureGameRegion()
    let res = region.find(recognitionObjectOcr);
    region.dispose();
    log.debug(`[OCR识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
    return res;
}
async function ocrUID() {
    let uid_json = { x: 120, y: 200, width: 170, height: 30}
    let recognitionObjectOcr = RecognitionObject.Ocr(uid_json.x, uid_json.y, uid_json.width, uid_json.height);
    let region = captureGameRegion()
    let res = region.find(recognitionObjectOcr);
    region.dispose();
    log.debug(`[OCR识别UID]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
    //只保留数字
    let uidStr = res.text;
    if (uidStr.match(/\d+/g)) {
        let uid = parseInt(uidStr.match(/\d+/g).join(""));
        return uid;
    }
    return "未知";
}
async function ocrName() {
    let uid_json = { x: 300, y: 30, width: 400, height: 70}
    let recognitionObjectOcr = RecognitionObject.Ocr(uid_json.x, uid_json.y, uid_json.width, uid_json.height);
    let region = captureGameRegion()
    let res = region.find(recognitionObjectOcr);
    region.dispose();
    log.debug(`[OCR识别用户名]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
    let name = res.text;
    return name;
}
async function ocrResin() {
    let resin_json = { x: 1370, y: 200, width: 110, height: 40};
    let recognitionObjectOcr = RecognitionObject.Ocr(resin_json.x, resin_json.y, resin_json.width, resin_json.height);
    let region = captureGameRegion()
    let res = region.find(recognitionObjectOcr);
    region.dispose();
    log.debug(`[OCR识别树脂]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
    let resin = res.text;
    return resin;
}
async function ocrEncounterPoints() {
    let resin_json = { x: 760, y: 815, width: 600, height: 50};
    let recognitionObjectOcr = RecognitionObject.Ocr(resin_json.x, resin_json.y, resin_json.width, resin_json.height);
    let region = captureGameRegion();
    let resList = region.findMulti(recognitionObjectOcr);
    region.dispose();
    let points = 0;
    for (let i = 0; i < resList.count; i++) {
        let res = resList[i];
        if (res.text.match(/[x\d+\.]/g)) {
            log.debug(`[OCR识别历练点]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
            points = parseFloat(res.text.match(/[\d+\.]/g).join(""));
        }
    }
    return points;
}

async function getUserInfo() {
    log.info("开始获取玩家信息");
    await keyPress("VK_ESCAPE");
    await sleep(1000);
    let uname = await ocrName();
    let uid = await ocrUID();
    log.info(`当前登录玩家 ${uname}[UID:${uid}]`);
    await genshin.returnMainUi();
    return [uname, uid];
}

async function claimAdventurersGuildTasks(uname, uid) {
    let msg = "";
    log.info("开始前往冒险家协会");
    let adventurersGuildPath = settings.adventurersGuildPath || "蒙德";
    let adventurersGuildPathJson = `Assets/Pathing/冒险家协会_${adventurersGuildPath}.json`;
    await pathingScript.runFile(adventurersGuildPathJson);
    await sleep(1000);
    if (expeditionEnabled) {
        // 重新探索派遣
        await keyPress("VK_F");
        await sleep(800);
        await keyPress("VK_F");
        await sleep(1000);
        const ro1 = captureGameRegion();
        let ExpeditionIcon = ro1.find(ExpeditionIconRo);
        ro1.dispose();
        if (ExpeditionIcon.isExist()) {
            log.info("识别到探索派遣");
            ExpeditionIcon.click();
            await sleep(1000);
            const ro2 = captureGameRegion();
            let ExpeditionClaimButton = ro2.find(ExpeditionClaimButtonRo);
            ro2.dispose();
            if (ExpeditionClaimButton.isExist()) {
                log.info("识别到全部领取按钮");
                ExpeditionClaimButton.click();
                await sleep(1000);
                click(1000, 1000);
                msg = `已领取派遣探索奖励`;
                if (settings.expeditionNotice) notification.send(`${uname}[UID:${uid}] ${msg}`);
            } else {
                msg = `无派遣探索派遣需要领取`;
            }
        } else {
            log.error("未识别到探索派遣按钮");
            await keyPress("VK_ESCAPE");
            await sleep(1000);
            await keyPress("VK_SPACE");
            await sleep(1000);
        }
        log.info(msg);
        await genshin.returnMainUi();
    }

    if (settings.dailyCommissionEnabled) {
        await keyPress("VK_F");
        await sleep(800);
        await keyPress("VK_F");
        await sleep(1000);
        const ro3 = captureGameRegion();
        let ClaimDailyCommissionRewardIcon = ro3.find(ClaimDailyCommissionRewardIconRo);
        ro3.dispose();
        if (ClaimDailyCommissionRewardIcon.isExist()) {
            log.info("识别到每日委托");
            ClaimDailyCommissionRewardIcon.click();
            await sleep(500);
            const ro4 = captureGameRegion();
            let EncounterPointsConfirmButton = ro4.find(BlackConfirmButtonRo);
            ro4.dispose();
            if (EncounterPointsConfirmButton.isExist()) {
                log.info("使用历练点完成每日委托");
                EncounterPointsConfirmButton.click();
            }
            await sleep(800);
            await keyPress("VK_SPACE");
            await sleep(1000);
            const ro5 = captureGameRegion();
            let HideUIButton = ro5.find(HideUIButtonRo);
            ro5.dispose();
            if (HideUIButton.isExist()) {
                msg = "「每日委托」奖励未完成或已领取";
                await sleep(1000);
                await keyPress("VK_SPACE");
            } else {
                msg = "已领取「每日委托」奖励";
                if (settings.dailyCommissionNotice) notification.send(`${uname}[UID:${uid}] ${msg}`);
            }
            log.info(msg);
        } else {
            log.error("未识别到每日委托按钮");
            const ro6 = captureGameRegion();
            let HideUIButton = ro6.find(HideUIButtonRo);
            ro6.dispose();
            if (HideUIButton.isExist()) {
                await keyPress("VK_ESCAPE");
                await sleep(1000);
                await keyPress("VK_SPACE");
            }
        }
        await genshin.returnMainUi();
    }
}

async function receiveMail(uname, uid) {
    let msg = "";
    log.info("开始领取新邮件");
    await keyPress("VK_ESCAPE");
    await sleep(1000);
    const ro1 = captureGameRegion();
    let MailButton = ro1.find(MailButtonRo);
    ro1.dispose();
    if (MailButton.isExist()) {
        log.info("识别到邮件按钮");
        MailButton.click();
        await sleep(1500);
        click(150, 1015);
        await sleep(1000);
        const ro2 = captureGameRegion();
        let MailClaimButton = ro2.find(MailClaimButtonRo);
        ro2.dispose();
        if (!MailClaimButton.isExist()) {
            msg = `已完成领取新邮件`;
            if (settings.mailNotice) notification.send(`${uname}[UID:${uid}] ${msg}`);
            click(150, 1015);
        }
    } else {
        log.error("未识别到邮件按钮");
    }
    log.info(msg);
    await genshin.returnMainUi();
}

async function claimBattlePassRewards(uname, uid) {
    async function newBattlePassProcess() {
        // 如果是新一期纪行需要额外点击跳过动画
        const ro1 = captureGameRegion();
        let CloseButton = ro1.find(CloseButtonRo);
        ro1.dispose();
        if (CloseButton.isExist()) {
            return;
        }
        for (let i=0; i<=10; i++) {
            click(1798, 45);
            await sleep(500);
            const ro2 = captureGameRegion();
            let BlackConfirmButton = ro2.find(BlackConfirmButtonRo);
            ro2.dispose();
            if (BlackConfirmButton.isExist()) {
                BlackConfirmButton.click();
                await sleep(2000);
                const ro3 = captureGameRegion();
                let CloseButton = ro3.find(CloseButtonRo);
                ro3.dispose();
                if (CloseButton.isExist()) {
                    CloseButton.click();
                    await sleep(1000);
                    const ro4 = captureGameRegion();
                    let BlackConfirmButton = ro4.find(BlackConfirmButtonRo);
                    ro4.dispose();
                    await sleep(1000);
                    break;
                }

            }
        }

    }
    let msg = "";
    log.info("开始领取纪行奖励");
    await keyPress("VK_ESCAPE");
    await sleep(1000);
    const ro1 = captureGameRegion();
    let BattlePassButton = ro1.find(BattlePassButtonRo);
    ro1.dispose();
    if (BattlePassButton.isExist()) {
        log.info("识别到纪行按钮");
        BattlePassButton.click();
        await sleep(1500);

        await newBattlePassProcess();

        const ro2 = captureGameRegion();
        let TaskButton = ro2.find(TaskButtonRo);
        let SelectedTaskButton = ro2.find(SelectedTaskButtonRo);
        ro2.dispose();
        if (TaskButton.isExist()) {
            log.info("进入任务页面");
            TaskButton.click();
            await sleep(500);
        } else if (SelectedTaskButton.isExist()) {
            log.info("已在任务页面");
        } else {
            log.info("任务按钮识别失败");
        }

        let btn = await ocrItem(1680, 930, 120, 80);
        if (btn.text.includes("一键领取") || btn.text.includes("一鍵領取") || btn.text.includes("Claim")) {
            btn.click();
            log.info("已领取纪行任务奖励");
            await sleep(2000);
        } else {
            log.info("无需领取纪行任务");
        }

        await sleep(1000);

        const ro3 = captureGameRegion();
        let GnosticHymnButton = ro3.find(GnosticHymnButtonRo);
        let SelectedGnosticHymnButton = ro3.find(SelectedGnosticHymnButtonRo);
        ro3.dispose();
        if (GnosticHymnButton.isExist()) {
            log.info("进入珍珠纪行页面");
            GnosticHymnButton.click();
            await sleep(500);
        } else if (SelectedGnosticHymnButton.isExist()) {
            log.info("已在珍珠纪行页面");
        } else {
            log.info("珍珠纪行按钮识别失败");
        }

        btn = await ocrItem(1680, 930, 120, 80);
        if (btn.text.includes("一键领取") || btn.text.includes("一鍵領取") || btn.text.includes("Claim")) {
            btn.click();
            msg = "已领取珍珠纪行奖励";
        } else {
            msg = "无需领取珍珠纪行";
        }
        log.info(msg);
        if (settings.battlePassNotice) notification.send(`${uname}[UID:${uid}] ${msg}`);
    } else {
        log.error("未识别到纪行按钮");
    }
    await genshin.returnMainUi();
}

async function dailyRewardNotice(uname, uid) {
    let msg = "";
    log.info("开始完成每日委托");
    await keyPress("VK_ESCAPE");
    await sleep(1000);
    let originalResin = "";
    let encounterPoints = 0;
    const ro1 = captureGameRegion();
    let AdventurerHandbookButton = ro1.find(AdventurerHandbookButtonRo);
    ro1.dispose();
    if (AdventurerHandbookButton.isExist()) {
        log.info("识别到冒险之证按钮");
        AdventurerHandbookButton.click();
        await sleep(2000);
        let region = captureGameRegion();
        let resList = region.findMulti(RecognitionObject.ocr(200, 200, 200, 600));
        region.dispose();
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("秘境") || res.text.includes("Domains")) {
                log.info("点击秘境选项卡");
                res.click();
                await sleep(500);
                originalResin = await ocrResin();
            }
        }
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("委托") || res.text.includes("委託") || res.text.includes("Commissions") || res.text.includes("委")) {
                log.info("点击委托选项卡");
                res.click();
                await sleep(500);
                encounterPoints = await ocrEncounterPoints();
            }
        }
        const ro2 = captureGameRegion();
        let RewardClaimedButton = ro2.find(RewardClaimedRo);
        ro2.dispose();
        msg = `每日委托仍未完成！`;
        if (RewardClaimedButton.isExist()) {
            msg = `每日委托已完成`;
        }
        msg += `\n当前原粹树脂${originalResin}，剩余历练点${encounterPoints}`;
        log.info(msg);
        if (encounterPoints <= 10) {
            msg += `\n剩余长效历练点即将不足，请立刻补充!`
        }
        notification.send(`${uname}[UID:${uid}] ${msg}`);
    } else {
        log.error("未识别到冒险之证");
    }
    await genshin.returnMainUi();
}

(async function() {
    try {
        if (!(
            settings.expeditionEnabled
         || settings.dailyCommissionEnabled
         || settings.mailEnabled
         || settings.battlePassEnabled
         || settings.dailyRewardNotice
        )) return;
        await genshin.returnMainUi();
        let [uname, uid] = await getUserInfo();
        if (settings.expeditionEnabled || settings.dailyCommissionEnabled) {
            await claimAdventurersGuildTasks(uname, uid);
        }
        if (settings.mailEnabled) {
            await receiveMail(uname, uid);
        }
        if (settings.battlePassEnabled) {
            await claimBattlePassRewards(uname, uid);
        }
        if (settings.dailyRewardNotice) {
            await dailyRewardNotice(uname, uid);
        }
    } catch (error) {
        if (settings.errorNotice) {
            notification.error(`任务执行失败: ${error.message}`);
        }
    }
})();
