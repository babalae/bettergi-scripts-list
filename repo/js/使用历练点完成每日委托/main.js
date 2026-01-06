// Encounter Points
const AdventurerHandbookButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Adventurer Handbook Button.png"), 100, 300, 700, 700);
const EncounterPointsStageRewardsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Encounter Points Stage Rewards.png"), 1500, 700, 100, 100);
const Cannot_receive = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Cannot_receive.png"), 1060, 715, 100, 100);
// MainUi
const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/paimon_menu.png"), 0, 0, 100, 100);
// Paimon Menu
const FriendsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Friends Button.png"), 0, 300, 700, 780);
const CoOpModeButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Co-Op Mode Button.png"), 100, 300, 700, 780);
// Co-Op Mode Page
const CoOpModeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Co-Op Mode Page.png"), 0, 0, 200, 100);
const MyFriendsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/My Friends Page.png"), 0, 0, 200, 100);
const LeaveButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Leave Button.png"), 1400, 900, 300, 180);
// Party Setup
const QuickSetupButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Quick Setup Button.png"), 1100, 900, 400, 180);
const ConfigureTeamButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Configure Team Button.png"), 0, 900, 200, 180);
const ConfirmDeployButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Confirm Deploy Button.png"), 0, 900, 1920, 180);
// Slider
const LeftSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 650, 50, 100, 100);
const LeftSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 650, 100, 100, 900);
const MiddleSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 1250, 50, 100, 200);
const MiddleSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 1250, 100, 100, 900);
const RightSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 1750, 100, 100, 100);
const RightSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 1750, 100, 100, 900);

// 取得需要离队角色資訊
const removedCharacters1 = settings.removedCharacters1 || false;
const removedCharacters2 = settings.removedCharacters2 || false;
const removedCharacters3 = settings.removedCharacters3 || false;
const removedCharacters4 = settings.removedCharacters4 || false;
// 读取配置文件
const settingsWeek = settings.week;
const settingsNotDoublePoints = settings.notDoublePoints || false;
const settingsAppointFriendName = settings.appointFriendName ? settings.appointFriendName.trim() : "";

// 读取冒险家协会的指定地区
const adventurePath = settings.adventurePath || '蒙德'; // 若未定义，用蒙德兜底

/**
 * @returns {Promise<void>}
 */
(async function () {
    let shouldRun = false; // 标志变量
    let dayOfWeek = -1;    // 星期变量

    // 判断设置合法性
    var items = [];

    await genshin.returnMainUi();

    // 判定 每天执行 / 星期几、是否使用历练点领奖
    if (settingsWeek === "0") {
        shouldRun = true;
        log.info("设置每天执行，开始使用历练点完成每日委托");
    } else if (settingsWeek) {
        items = validateAndStoreNumbers(settingsWeek);
        if (!items) {
            log.error("星期设置格式错误，请使用类似'1,3,5,7'的格式");
            return;
        }

        // 获取调整后的星期几（考虑00:00~04:00视为前一天）
        dayOfWeek = getAdjustedDayOfWeek();

        // 检查当前星期是否在用户设置的范围内
        if (items.includes(dayOfWeek)) {
            shouldRun = true;
            log.info(`今天是星期 ${dayOfWeek}，开始使用历练点完成每日委托`);
        } else {
            log.info(`今天是星期 ${dayOfWeek}，不使用历练点`);
            log.info(`交互或拾取："不运行"`);
            return;
        }
    } else {
        log.error("还没有设置需要在星期几使用历练点完成每日委托呢");
        log.error("请在调试器里添加本脚本->右键JS脚本->修改JS脚本自定义配置.");
        return;
    }

    // 检查是否可以领取历练点奖励
    //好友尘歌壶历時檢查
    // 直接領取時檢查&領取
    log.info("检查是否可以领取历练点奖励");
    if (await checkEncounterPointsRewards() == true) {
        log.info("可以领取历练点奖励，开始执行");
    } else {
        log.warn("无法领取历练点奖励，可能是未完成委托或已领取\n或 未识别到 完成所有任務，而不领取历练点奖励");
        log.info(`交互或拾取："未满足领取条件"`);
        return;
    }

    if (shouldRun) {
        try {
            // 切换队伍
            if (!!settings.partyName) {
                try {
                    log.info("正在尝试切换至" + settings.partyName);
                    if (!settings.disableGoStatue) {
                        log.info("正在传送回七天神像切换队伍");
                        await genshin.TpToStatueOfTheSeven();
                        await SwitchParty(settings.partyName);
                    } else {
                        await genshin.returnMainUi();
                        await SwitchParty(settings.partyName);
                    }
                } catch {
                    log.warn("\n\n队伍切换失败,可能是：\n1.处于联机模式 \n2.无法正确识别\n3.JS自定义配置中的队伍名称设置错误，请检查!\n");
                    await genshin.returnMainUi();
                }
            } else {
                log.warn("没有设置切换队伍，使用当前队伍使用历练點");
                await genshin.returnMainUi();
            }

            // 区分双倍好感
            if (settingsNotDoublePoints == true) {
                // 不使用好友尘歌壶领双倍好感的情况
                // 如果有设置队伍名称，需要在切换队伍后单独领取历练点奖励
                if (!!settings.partyName) {
                    await claimEncounterPointsRewards();
                }
                await fontaineCatherineCommissionAward()
            } else if (settingsNotDoublePoints == false) {
                // 使用好友尘歌壶领双倍好感的情况
                let request_times = settings.request_times * 2;
                let total_clicks = request_times ? request_times : 14;
                // 指定好友名称
                if (settingsAppointFriendName !== "") {
                    let enterStatus = await AppointFriendRequestToVisitSereniteaPot();
                    if (enterStatus) {
                        await sleep(2000);
                        log.info("正在让指定位置角色离队");
                        await removeSpecifiedRole();
                        await claimEncounterPointsRewards();
                        await ReturnToBigWorld();
                        await fontaineCatherineCommissionAward()
                    } else {
                        log.warn("好友列表未能识别出设置的好友名称");
                        log.info("尝试依次进入");
                        await pageTop(RightSliderTopRo);
                        let enterStatus = await RequestToVisitSereniteaPot(total_clicks);
                        if (enterStatus) {
                            await sleep(2000);
                            log.info("正在让指定位置角色离队");
                            await removeSpecifiedRole();
                            await claimEncounterPointsRewards();
                            await ReturnToBigWorld();
                            await fontaineCatherineCommissionAward()
                        }
                    }
                } else if (settingsAppointFriendName == "") {
                    log.warn("未设置指定好友，执行依次进入");
                    let enterStatus = await RequestToVisitSereniteaPot(total_clicks);
                    if (enterStatus) {
                        await sleep(2000);
                        log.info("正在让指定位置角色离队");
                        await removeSpecifiedRole();
                        await claimEncounterPointsRewards();
                        await ReturnToBigWorld();
                        await fontaineCatherineCommissionAward()
                    }
                } else {
                    log.warn("出现异常，请检查自定义参数和日志，也可能是没有好友开放尘歌壶");
                }
            }

        } catch (e) {
            log.error("失败，请检查设置");
            return;
        }
    }

    // 以下为可供调用的函数部分

    // 切换队伍
    async function SwitchParty(partyName) {
        let ConfigureStatue = false;
        keyPress("VK_L");

        for (let i = 0; i < 10; i++) {
            const ro1 = captureGameRegion();
            let QuickSetupButton = ro1.find(QuickSetupButtonRo);
            ro1.dispose();
            if (QuickSetupButton.isExist()) {
                log.info("已进入队伍配置页面");
                break;
            } else {
                await sleep(1000);
            }
        }
        // 识别当前队伍
        let captureRegion = captureGameRegion();
        let resList = captureRegion.findMulti(RecognitionObject.ocr(100, 900, 300, 180));
        let currentPartyFound = false;
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (settings.enableDebug) {
                log.info("当前队伍名称位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
            }
            if (res.text.includes(partyName)) {
                log.info("当前队伍即为目标队伍，无需切换");
                keyPress("VK_ESCAPE");
                await sleep(500);
            } else {
                await sleep(1000);
                let ro2 = captureGameRegion();
                let ConfigureTeamButton = ro2.find(ConfigureTeamButtonRo);
                ro2.dispose();
                if (ConfigureTeamButton.isExist()) {
                    log.info("识别到配置队伍按钮");
                    ConfigureTeamButton.click();
                    await sleep(500);
                    await pageTop(LeftSliderTopRo);

                    for (let p = 0; p < 4; p++) {
                        // 识别当前页
                        let captureRegion = captureGameRegion();
                        let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 100, 400, 900));
                        captureRegion.dispose();
                        for (let i = 0; i < resList.count; i++) {
                            let res = resList[i];
                            if (settings.enableDebug) {
                                log.info("文本位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
                            }
                            if (res.text.includes(partyName)) {
                                if (settings.enableDebug) {
                                    log.info("目标队伍位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
                                }
                                click(Math.ceil(res.x + 360), res.y + Math.ceil(res.Height / 2));

                                // 找到目标队伍，点击确定、部署
                                await sleep(1500);
                                let ro3 = captureGameRegion();
                                let ConfirmButton = ro3.find(ConfirmDeployButtonRo);
                                ro3.dispose();
                                if (ConfirmButton.isExist()) {
                                    if (settings.enableDebug) {
                                        log.info("识别到确定按钮:({x},{y},{w},{h})", ConfirmButton.x, ConfirmButton.y, ConfirmButton.Width, ConfirmButton.Height);
                                    }
                                    ConfirmButton.click();
                                }
                                await sleep(1500);
                                let ro4 = captureGameRegion();
                                let DeployButton = ro4.find(ConfirmDeployButtonRo);
                                ro4.dispose();
                                if (DeployButton.isExist()) {
                                    if (settings.enableDebug) {
                                        log.info("识别到部署按钮:({x},{y},{w},{h})", DeployButton.x, DeployButton.y, DeployButton.Width, DeployButton.Height);
                                    }
                                    DeployButton.click();
                                    ConfigureStatue = true;
                                    break;
                                }
                            }
                        }
                        if (ConfigureStatue) {
                            await genshin.returnMainUi();
                            break;
                        } else {
                            await pageDown(LeftSliderBottomRo);
                        }
                    }
                    if (!ConfigureStatue) {
                        log.warn("\n\n队伍切换失败,可能是：\n1.处于联机模式 \n2.无法正确识别\n3.JS自定义配置中的队伍名称设置错误，请检查!\n");
                        await genshin.returnMainUi();
                        break;
                    }
                }
            }
        }
    }

    // 模板匹配&OCR进指定好友尘歌壶
    async function AppointFriendRequestToVisitSereniteaPot() {
        let enterStatus = false;
        await sleep(2000);
        keyPress("VK_ESCAPE");
        await sleep(2000);

        const ro5 = captureGameRegion();
        let FriendsBotton = ro5.find(FriendsButtonRo);
        ro5.dispose();
        if (FriendsBotton.isExist()) {
            log.info("识别到好友按钮");
            FriendsBotton.click();
            await sleep(2000);
        } else {
            log.warn("未识别到按钮,使用坐标点击");
            click(680, 550);
            await sleep(2000);
        }

        // 一頁7個好友、假定200好友位全滿、指定好友在第200位、得翻29次頁面
        for (let p = 0; p < 29; p++) {
            // 点击好友头像
            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(250, 120, 500, 840));
            captureRegion.dispose();
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (res.text.includes(settingsAppointFriendName)) {
                    if (settings.enableDebug) {
                        log.info("指定好友名字位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
                    }
                    click(res.x - 100, res.y + 50);
                    await sleep(1000);

                    // 申请造访尘歌壶
                    const ro6 = captureGameRegion();
                    let resList2 = ro6.findMulti(RecognitionObject.ocr(250, 220, 425, 380));
                    ro6.dispose();
                    for (let i = 0; i < resList2.count; i++) {
                        let res = resList2[i];
                        if (res.text.includes("申请造访") || res.text.includes("visit Serenitea Pot") || res.text.includes("申請造訪")) {
                            if (settings.enableDebug) {
                                log.info("申请造访尘歌壶位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
                            }
                            res.click();
                        }
                    }
                }
            }
            await sleep(1000);
            // 翻页继续尝试&模板匹配的方式等待加载
            const ro7 = captureGameRegion();
            let SliderBottom = ro7.find(RightSliderBottomRo);
            ro7.dispose();
            if (SliderBottom.isExist()) {
                await pageDown(RightSliderBottomRo);
            } else {
                for (let i = 0; i < 10; i++) {
                    const ro8 = captureGameRegion();
                    let paimonMenu = ro8.find(paimonMenuRo);
                    let CoOpMode = ro8.find(CoOpModeRo);
                    let MyFriends = ro8.find(MyFriendsRo);
                    ro8.dispose();
                    if (CoOpMode.isExist() || MyFriends.isExist()) {
                        log.info("继续申请");
                        break;
                    } else if (paimonMenu.isEmpty() && (CoOpMode.isEmpty() || MyFriends.isEmpty())) {
                        log.info("正在等待加载");
                        await click(960, 540);
                        for (let i = 0; i < 30; i++) {
                            const ro9 = captureGameRegion();
                            let paimonMenu = ro9.find(paimonMenuRo);
                            ro9.dispose();
                            if (paimonMenu.isExist()) {
                                break;
                            }
                            await sleep(1000);
                        }
                    } else if (paimonMenu.isExist()) {
                        log.info("已进入联机模式");
                        enterStatus = true;
                        break;
                    } else {
                        log.warn("出现异常情况，请检查");
                        enterStatus = false;
                    }
                }
                break;
            }
        }
        return enterStatus;
    }

    // 好友列表递增坐标进尘歌壶(仅第一页)
    async function RequestToVisitSereniteaPot(total_clicks) {
        let enterStatus = false;
        await sleep(2000);
        keyPress("VK_ESCAPE");
        await sleep(2000);
        const ro10 = captureGameRegion();
        let FriendsBotton = ro10.find(FriendsButtonRo);
        ro10.dispose();
        if (FriendsBotton.isExist()) {
            log.info("识别到好友按钮");
            FriendsBotton.click();
            await sleep(2000);
        } else {
            log.warn("未识别到按钮,使用坐标点击");
            // click(1020,840);
            click(680, 550);
            await sleep(2000);
        }

        let y_avatar = 178; //好友头像按钮起始Y坐标
        let y_request = 310; //申请造访按钮起始Y坐标
        const x_avatar = 208;
        const x_request = 460;
        const avatar_increment = 125; //两按钮相隔坐标
        const request_increment = 124; //两按钮相隔坐标
        const request_fixed_value = 560; //第四~七位好友申请造访按钮Y坐标
        let request_count = 0;

        // 先申请造访首位好友的尘歌壶
        log.info("正在申请造访第 1 位好友尘歌壶");
        click(x_avatar, y_avatar);
        await sleep(750);
        click(x_request, y_request);
        await sleep(750);

        // 依次申请造访第 2 ~ 7 位好友的尘歌壶
        for (let i = 2; i < total_clicks; i++) {
            if (i % 2 === 0) {
                // 偶数索引，递增 y_avatar
                y_avatar += avatar_increment;
                log.info(`正在申请造访第 ${i / 2 + 1} 位好友尘歌壶`);
                click(x_avatar, y_avatar);
                await sleep(250);
                click(x_avatar, y_avatar);
                await sleep(750);
            } else {
                // 奇数索引，递增 y_request
                if (request_count < 1) {
                    // 前 3 位好友递增 249
                    y_request += request_increment;
                } else {
                    // 第 4 位及以后设为 1118
                    y_request = request_fixed_value;
                }
                request_count++;
                click(x_request, y_request);
                await sleep(750);
            }
        }
        // 模板匹配的方式等待加载
        log.info("等待界面响应");
        for (let i = 0; i < 30; i++) {
            const ro20 = captureGameRegion();
            let res = ro20.find(paimonMenuRo);
            ro20.dispose();
            if (res.isEmpty()) {
                await click(960, 540);
            } else if (res.isExist()) {
                log.info("已进入好友尘歌壶");
                enterStatus = true;
                break;
            } else {
                log.warn("出现异常情况，请检查");
                enterStatus = false;
            }
            await sleep(500);
        }
        return enterStatus;
    }

    // 模板匹配领取历练点奖励
    async function claimEncounterPointsRewards() {

        await sleep(1300);
        log.info("正在打开冒险之证领取历练点奖励");
        await sleep(1300);
        keyPress("VK_ESCAPE");

        await sleep(2000);
        const ro21 = captureGameRegion();
        let AdventurerHandbookButton = ro21.find(AdventurerHandbookButtonRo);
        ro21.dispose();
        if (AdventurerHandbookButton.isExist()) {
            log.info("识别到冒险之证按钮");
            AdventurerHandbookButton.click();

            await sleep(2000)
            const ro22 = captureGameRegion();
            let resList = ro22.findMulti(RecognitionObject.ocr(200, 300, 200, 100));
            ro22.dispose();
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (res.text.includes("委托") || res.text.includes("委託") || res.text.includes("Commissions") || res.text.includes("委")) {
                    if (settings.enableDebug) {
                        log.info("识别到委托选项卡位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
                    }
                    res.click();
                } else {
                    log.info("未识别到识别到委托选项卡");
                }
            }

            await sleep(2000)
            const ro23 = captureGameRegion();
            let EncounterPointsStageRewardsButton = ro23.find(EncounterPointsStageRewardsRo);
            ro23.dispose();
            if (EncounterPointsStageRewardsButton.isExist()) {
                log.info("识别到历练点领取按钮");
                EncounterPointsStageRewardsButton.click();
                await sleep(2000);
                log.info("已领取历练点奖励");
                keyPress("VK_ESCAPE");
            } else if (EncounterPointsStageRewardsButton.isEmpty()) {
                log.warn("未识别到历练点领取奖励按钮，可能是已领取或未完成");
            }
            await genshin.returnMainUi();
            await sleep(2000);
        }
    }

    // 模板匹配领取历练点奖励是否能領取
    async function checkEncounterPointsRewards() {

        let returnValue = false;

        await sleep(1300);
        log.info("正在打开冒险之证檢查历练点完成度");
        await sleep(1300);
        keyPress("VK_ESCAPE");

        await sleep(2000);
        const ro27 = captureGameRegion();
        let AdventurerHandbookButton = ro27.find(AdventurerHandbookButtonRo);
        ro27.dispose();
        if (AdventurerHandbookButton.isExist()) {
            log.info("识别到冒险之证按钮");
            AdventurerHandbookButton.click();

            await sleep(2000)
            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(200, 300, 200, 100));
            captureRegion.dispose();
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                if (res.text.includes("委托") || res.text.includes("委託") || res.text.includes("Commissions") || res.text.includes("委")) {
                    if (settings.enableDebug) {
                        log.info("识别到委托选项卡位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
                    }
                    res.click();
                } else {
                    log.info("未识别到识别到委托选项卡");
                }
            }

            await sleep(2000)
            const ro28 = captureGameRegion();
            let EncounterPointsStageRewardsButton = ro28.find(Cannot_receive);
            ro28.dispose();
            if (EncounterPointsStageRewardsButton.isExist()) {
                log.info("识别到 完成所有任務");
                // EncounterPointsStageRewardsButton.click();
                returnValue = true;

                await sleep(2000);
                log.info("可领取历练点奖励");
                // 檢查是否可以領取 且 沒有設置隊伍名稱
                if (settingsNotDoublePoints == true && !settings.partyName) {
                    log.info(`不使用好友尘歌壶历练点领取双倍好感，直接使用历练点`);
                    const ro29 = captureGameRegion();
                    let EncounterPointsStageRewardsButton = ro29.find(EncounterPointsStageRewardsRo);
                    ro29.dispose();
                    if (EncounterPointsStageRewardsButton.isExist()) {
                        log.info("识别到历练点领取按钮");
                        EncounterPointsStageRewardsButton.click();
                        await sleep(2000);
                        log.info("已领取历练点奖励");
                        keyPress("VK_ESCAPE");
                    } else if (EncounterPointsStageRewardsButton.isEmpty()) {
                        log.warn("未识别到历练点领取奖励按钮，可能是已领取或未完成");
                    }
                }

                keyPress("VK_ESCAPE");
            } else if (EncounterPointsStageRewardsButton.isEmpty()) {
                log.info("未识别到 完成所有任務");
                log.info("不领取历练点奖励");
                returnValue = false;
            }
            await genshin.returnMainUi();
            await sleep(2000);
        }
        return returnValue
    }

    // 模板匹配退出尘歌壶回到大世界
    async function ReturnToBigWorld() {
        log.info("正在返回大世界");
        keyPress("VK_F2");
        await sleep(2000);
        const ro24 = captureGameRegion();
        let CoOpModeButton = ro24.find(CoOpModeRo);
        ro24.dispose();
        if (CoOpModeButton.isExist()) {
            log.info("识别到多人游戏页面");
            const ro25 = captureGameRegion();
            let LeaveButton = ro25.find(LeaveButtonRo);
            ro25.dispose();
            if (LeaveButton.isExist()) {
                log.info("识别到离开尘歌壶按钮");
                LeaveButton.click();
                await sleep(2000);
            }
            // 模板匹配的方式等待加载
            log.info("等待界面响应");
            for (let i = 0; i < 10; i++) {
                const ro26 = captureGameRegion();
                let res = ro26.find(paimonMenuRo);
                ro26.dispose();
                if (res.isEmpty()) {
                    await click(960, 540);
                } else if (res.isExist()) {
                    log.info("已离开尘歌壶");
                    break;
                } else {
                    log.warn("出现异常情况或超时，请检查");
                }
                await sleep(2000);
            }
        }
    }

    // 让指定位置角色离队
    async function removeSpecifiedRole() {
        try {
            if (removedCharacters1 || removedCharacters2 || removedCharacters3 || removedCharacters4) {
                // 打開配隊介面
                keyPress("l");
                await sleep(3500);

                // 让4号位角色离队
                if (removedCharacters4) {
                    // 第4名角色位置
                    click(1460, 600);
                    await sleep(750);
                    click(430, 1020);
                    await sleep(750);
                    log.info("4号位角色已离队");

                }

                // 让3号位角色离队
                if (removedCharacters3) {
                    // 第3名角色位置
                    click(1130, 600);
                    await sleep(750);
                    click(430, 1020);
                    await sleep(750);
                    log.info("3号位角色已离队");
                }

                // 让2号位角色离队
                if (removedCharacters2) {
                    // 第2名角色位置
                    click(790, 600);
                    await sleep(750);
                    click(430, 1020);
                    await sleep(750);
                    log.info("2号位角色已离队");
                }

                // 让1号位角色离队
                if (removedCharacters1) {
                    if (removedCharacters4 && removedCharacters3 && removedCharacters2) {
                        log.warn("2,3,4号位已离队，1号位角色不能离队");
                    } else {
                        // 第1名角色位置
                        click(480, 600);
                        await sleep(750);
                        click(430, 1020);
                        await sleep(750);
                        log.info("1号位角色已离队");
                    }
                }

                // 返回主界面
                await genshin.returnMainUi();
            } else {
                log.info("无需让角色离队");
            }
        } catch (error) {
            log.error("出错: {0}", error);
        }
    }

    // 向下一页
    async function pageDown(SliderBottomRo) {
        const ro18 = captureGameRegion();
        let SliderBottom = ro18.find(SliderBottomRo);
        ro18.dispose();
        if (SliderBottom.isExist()) {
            log.info("当前页面已点击完毕，向下滑动");
            if (settings.enableDebug) {
                log.info("滑块当前位置:({x},{y},{h},{w})", SliderBottom.x, SliderBottom.y, SliderBottom.Width, SliderBottom.Height);
            }
            click(Math.ceil(SliderBottom.x + SliderBottom.Width / 2), Math.ceil(SliderBottom.y + SliderBottom.Height * 3.5));
            await moveMouseTo(0, 0);
            await sleep(100);
        }
    }

    //    回到页面顶部
    async function pageTop(SliderTopRo) {
        const ro19 = captureGameRegion();
        let SliderTop = ro19.find(SliderTopRo);
        ro19.dispose();
        if (SliderTop.isExist()) {
            if (settings.enableDebug) {
                log.info("滑条顶端位置:({x},{y},{h},{w})", SliderTop.x, SliderTop.y, SliderTop.Width, SliderTop.Height);
            }
            await moveMouseTo(Math.ceil(SliderTop.x + SliderTop.Width / 2), Math.ceil(SliderTop.y + SliderTop.Height * 1.5));
            leftButtonDown();
            await sleep(500);
            leftButtonUp();
            await moveMouseTo(0, 0);
            await sleep(1000);
        }
    }

    // 获取用戶定義的星期几才執行
    function validateAndStoreNumbers(input) {
        // 定义存储结果的数组
        let storedNumbers = [];

        // 使用正则表达式检测是否符合期望格式
        const regex = /^(\b([1-7])\b)(,(\b([1-7])\b))*$/;

        // 检测输入字符串是否符合正则表达式
        if (regex.test(input)) {
            // 将输入字符串按逗号分割成数组
            const numbers = input.split(',');

            // 将分割后的数字字符串转换为整数并存储到数组中
            storedNumbers = numbers.map(Number);

            return storedNumbers;
        } else {
            return false
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

    // 自動凱瑟琳領奬
    async function fontaineCatherineCommissionAward() {
        await sleep(1000);
        try {
            const avatars = Array.from(getAvatars?.() || []);
            if (avatars.length < 4) {
                log.warn(`非4人隊伍 或 识别角色失败，不前往冒险家协会領奬`);
                log.info(`交互或拾取："领取失败"`);
                return;
            }
        } catch (e) {
            return;
        }

        //到指定冒险家协会領奬
        log.info(`开始前往${adventurePath}冒险家协会領奬`);
        let Catherine_Egeria = `Assets/AutoPath/冒险家协会_${adventurePath}.json`;
        await pathingScript.runFile(Catherine_Egeria);
        log.info('开始每日委托或探索派遣，若无退出对话，则说明重复领取或未完成派遣');
        // 交互
        await keyPress("f");
        await sleep(1000);
        // 利用自動劇情領奬
        dispatcher.addTimer(new RealtimeTimer("AutoSkip", { "forceInteraction": true }));
        await sleep(10000);
        await genshin.returnMainUi();
        await sleep(1000);
        log.info(`交互或拾取："领取完成"`);
    }

})();