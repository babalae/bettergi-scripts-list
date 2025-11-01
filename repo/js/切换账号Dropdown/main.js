(async function () {
    // ======================================================
    // Library functions

    var u = {}; // utilities 工具函数集合
    u.logi = function(message, args) { log.info( "[切换账号]" + message, args) };
    u.logw = function(message, args) { log.warn( "[切换账号]" + message, args) };
    u.x = function (value) { return (value === undefined) ? genshin.width : genshin.width * (value / 1920); };
    u.y = function (value) { return (value === undefined) ? genshin.height : genshin.height * (value / 1080); };
    u.loadTemplate = function (filePath, x /* 0 if omit */, y /* 0 if omit */, w /* maxWidth if omit */, h /* maxHeight if omit */) {
        const _x = u.x(x === undefined ? 0 : x);
        const _y = u.y(y === undefined ? 0 : y);
        const _w = u.x(w) - _x;
        const _h = u.y(h) - _y;
        return RecognitionObject.TemplateMatch(file.ReadImageMatSync(filePath), _x, _y, _w, _h);
    };
    u.findText = function (resList, text) {
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text == text) {
                return res;
            }
        }
        return null;
    };
    u.matchUser = function (text, username) {
        if (typeof text !== "string" || typeof username !== "string") return false;
        if (text.length !== username.length) return false;
        for (let i = 0; i < text.length; i++) {
            const a = text[i];
            const b = username[i];
            if (a === '*' || b === '*') continue;
            if (a !== b) return false;
        }
        return true;
    };
    u.matchUserRelaxed = function (text, username) {
        if (typeof text !== "string" || typeof username !== "string") return false;
        // Check the head
        for (let i = 0; i < text.length; i++) {
            const a = text[i];
            const b = username[i];
            if (a === '*') break; // Stop checking when a '*' is found in text.
            if (a !== b) return false;
        }
        // Check the tail
        for (let i = 0; i < text.length; i++) {
            const a = text[text.length - 1 - i];
            const b = username[username.length - 1 - i];
            if (a === '*') break; // Stop checking when a '*' is found in text.
            if (a !== b) return false;
        }
        return true;
    };
    u.waitAndFindImage = async function (asset, internal = 500, timeout = 60000) {
        const start = Date.now();
        let lastLog = start;
        let endTime = start + timeout;
        while (Date.now() < endTime) {
            let captureRegion = captureGameRegion();
            let res = captureRegion.Find(asset);
            captureRegion.dispose();
            if (!res.isEmpty()) {
                return res;
            }
            if (Date.now() - lastLog >= 10000) {
                let elapsed = ((Date.now() - start) / 1000).toFixed(1);
                u.logw("等待匹配图像已持续 {0} 秒，仍在尝试寻找图像：{1}", elapsed, asset.Name);
                lastLog = Date.now();
            }
            await sleep(internal);
        }
        return null;
    }
    u.waitAndFindText = async function (text, x, y, w, h, internal = 500) {
        const start = Date.now();
        let lastLog = start;
        while (true) {
            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));
            captureRegion.dispose();
            if (typeof text === "string") {
                let textFound = u.findText(resList, text);
                if (textFound) {
                    return textFound;
                }
            } else if (text instanceof Array) {
                var textFound = null;
                for (let i = 0; i < text.length; i++) {
                    let textItem = text[i];
                    textFound = u.findText(resList, textItem);
                    if (!textFound) {
                        break;
                    }
                }
                if (textFound) {
                    return textFound;
                }
            }

            if (Date.now() - lastLog >= 10000) {
                let elapsed = ((Date.now() - start) / 1000).toFixed(1);
                u.logw("等待匹配图像已持续 {0} 秒，仍在尝试寻找文字：{1}", elapsed, text.toString());
                lastLog = Date.now();
            }
            await sleep(internal);
        }
    }

    // ======================================================
    // Setup

    const targetUser = settings.username;

    const assetLogoutIcon = u.loadTemplate("assets/logout.png", 1750, 900);
    const assetPaimonMenuIcon = u.loadTemplate("assets/paimon_menu.png", 0, 0, 150, 150);

    // ======================================================
    // Check current state

    /**
     * 领取空月祝福
     */
    async function useBlessingOfTheWelkinMoon() {
        u.logi("开始尝试领取空月祝福");
        
        let captureRegion = captureGameRegion();
        let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
        captureRegion.dispose();
        
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("点击领取") || res.text.includes("空月祝福")) {
                res.click();
                await sleep(500);
                res.click();
                res.click();
                await sleep(500);
            }
        }

        let captureRegionGetReward = captureGameRegion();
        let resGetReward = captureRegionGetReward.findMulti(RecognitionObject.ocrThis);
        captureRegionGetReward.dispose();
        for (let i = 0; i < resGetReward.count; i++) {
            let res = resGetReward[i];
            if (res.text.includes("点击") || res.text.includes("空白") || res.text.includes("获得")) {
                res.click();
                await sleep(500);
            }
        }
        
        u.logi("空月祝福领取成功");
    }

    async function waitAndDetermineCurrentView() {
        u.logi("开始判断当前画面状态");
        while (true) {
            let captureRegion = captureGameRegion();
            let res = captureRegion.Find(assetLogoutIcon);
            let logoutIconFound = !res.isEmpty();

            if (logoutIconFound) {
                let resList = captureRegion.findMulti(RecognitionObject.ocr(u.x(850), u.y(970), u.x(220), u.y(100)));
                captureRegion.dispose();
                if (u.findText(resList, "点击进入")) {
                    u.logi("检测到目前处于登录界面");
                    return false;
                }
            }

            // 尝试领取空月祝福
            await useBlessingOfTheWelkinMoon();

            // Not in the login screen, check if is in the game main menu.
            let paimonIcon = captureRegion.Find(assetPaimonMenuIcon);
            captureRegion.dispose();
            if (!paimonIcon.isEmpty()) {
                u.logi("检测到目前处于游戏主界面");
                return true;
            }

            // Not in the main game screen either, wait and try again.
            u.logi("未检测到登出按钮或派蒙菜单图标，可能处于游戏中，等待状态变化");
            genshin.blessingOfTheWelkinMoon();
            moveMouseTo(960, 0);
            await sleep(100);
            middleButtonClick();
            genshin.returnMainUi();
            await sleep(4900);
        }
    }

    async function stateReturnToGenshinGate() {
        const assetPaimonCancelIcon = u.loadTemplate("assets/paimon_cancel.png", 0, 0, 100, 100);

        while (true) {
            let paimonIcon = await u.waitAndFindImage(assetPaimonMenuIcon, 500, 1000);
            if (!paimonIcon) {
                u.logi("检测到派蒙菜单图标不存在，可能已开启菜单，进入登出按钮识别流程");
                break;
            }
            moveMouseTo(960, 0);
            await sleep(100);
            middleButtonClick();
            keyPress("VK_ESCAPE");
            u.logi("已按下ESC键，打开派蒙菜单");
            await sleep(1000);
        }

        // 识别派蒙菜单，点击登出按钮
        await u.waitAndFindImage(assetPaimonCancelIcon);
        // u.logi("点击登出按钮");
        click(u.x(50), u.y(1024));

        // 退出至登录界面
        let btnExitToLogin = await u.waitAndFindText("退出至登录界面", u.x(680), u.y(380), u.x(540), u.y(340));
        // u.logi("检测到\"退出至登录界面\"按钮，点击");
        // btnExitToLogin.DrawSelf("ExitToLoginBtn");
        btnExitToLogin.Click();
    }

    async function stateLogout() {
        u.logi("开始登出");

        let btnLogout = await u.waitAndFindImage(assetLogoutIcon);
        // u.logi("识别到登出按钮，点击");
        btnLogout.DrawSelf("LogoutBtn");
        btnLogout.Click();

        const assetQuitTextButton = u.loadTemplate("assets/quit.png", 680, 380, 1220, 720);
        let btnQuit = await u.waitAndFindImage(assetQuitTextButton, 200);
        // u.logi("识别到退出按钮，点击");
        // btnQuit.DrawSelf("QuitBtn");
        btnQuit.Click();
    };

    async function stateChangeUser() {
        u.logi("开始切换账号");
        await u.waitAndFindText(["进入游戏", "登录其他账号"], u.x(680), u.y(380), u.x(540), u.y(340), 200);

        const assetSelectUserDropDownIcon = u.loadTemplate("assets/caret.png", 680, 380, 1220, 720);
        let captureRegion = captureGameRegion();
        let res = captureRegion.Find(assetSelectUserDropDownIcon);
        captureRegion.dispose();
        if (res.isEmpty()) {
            u.logi("未找到下拉菜单图标，点击硬编码的坐标(960, 500)展开菜单");
            click(u.x(960), u.y(500));
        } else {
            // u.logi("识别到下拉菜单，点击");
            // res.DrawSelf("UserDropdown");
            res.Click();
        }

        u.logi("开始从下拉列表选择账号");
        var selectedUser = null;
        {
            const start = Date.now();
            let lastLog = start;
            while (selectedUser == null) {
                await sleep(200);

                let captureRegion = captureGameRegion();
                let resList = captureRegion.findMulti(RecognitionObject.ocr(u.x(680), u.y(540), u.x(540), u.y(500)));
                captureRegion.dispose();
                for (let i = 0; i < resList.count; i++) {
                    let res = resList[i];
                    let user = lastLog > start ? u.matchUserRelaxed(res.text, targetUser) : u.matchUser(res.text, targetUser);
                    if (user) {
                        selectedUser = res;
                        break;
                    }
                }

                if (Date.now() - lastLog >= 10000) {
                    let elapsed = ((Date.now() - start) / 1000).toFixed(1);
                    u.logw("等待匹配图像已持续 {0} 秒，仍在尝试寻找账号文本：{1}", elapsed, targetUser);
                    lastLog = Date.now();
                    for (let i = 0; i < resList.count; i++) {
                        let res = resList[i];
                        u.logw("账户文本：{0}", res.text);
                    }
                }
            }
        }

        u.logi("识别到目标账号：{0}", selectedUser.text);
        selectedUser.DrawSelf("SelectUser");
        selectedUser.Click();

        await sleep(500);
        {
            let captureRegion = captureGameRegion();
            let btnEnterGame = captureRegion.DeriveCrop(u.x(684), u.y(598), u.x(552), u.y(66));
            captureRegion.dispose();
            btnEnterGame.Click();
            // btnEnterGame.DrawSelf("EnterGameBtn");
            // u.logi("已点击\"进入游戏\"按钮，完成账号选择。");
        }
    }

    async function stateEnterGame() {
        // u.logi("开始进入游戏，等待游戏加载。");
        let textClickToStart = await u.waitAndFindText("点击进入", u.x(850), u.y(970), u.x(220), u.y(100));
        // u.logi("已识别到\"点击进入\"文本，点击鼠标进入游戏。");
        textClickToStart.DrawSelf("ClickToStart");
        textClickToStart.Click();
    }


    // ======================================================
    // Main flow

    const isInGame = await waitAndDetermineCurrentView();
    if (isInGame) {
        await stateReturnToGenshinGate();
        await sleep(1000);
    }
    await stateLogout();
    await sleep(500);
    await stateChangeUser();
    await sleep(500);
    await stateEnterGame();
    await sleep(20000);
    await waitAndDetermineCurrentView();

})();
