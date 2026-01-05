// ======================================================
// 切换账号(OCR)版本
const author = "彩虹QQ人";
const script_name = "切换账号(OCR)版本";
// 图像识别资源
const pm_out = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/pm_out.png")),
    name: "pm_out.png"
};
const out_to_login = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/out_to_login.png")),
    name: "out_to_login.png"
};
const login_out_account = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/login_out_account.png")),
    name: "login_out_account.png"
};
const out_account = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/out_account.png")),
    name: "out_account.png"
};
const login_other_account = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/login_other_account_1.png")),
    name: "login_other_account.png"
};
const input_phone_or_email = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/input_phone_or_email.png")),
    name: "input_phone_or_email.png"
};
const input_password = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/input_password.png")),
    name: "input_password.png"
};
const agree = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/agree.png")),
    name: "agree.png"
};
// 人机验证识别图片
const login_verification = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/verification.png")),
    name: "verification.png"
};
// 判断temporaryAccount是否为空，如果为空则赋值‘否’
const Account = settings.temporaryAccount || "否";

eval(file.readTextSync('utils/uid.js'))
// 点击区域中心
async function clickCenter(x, y, width, height) {
    let centerX = Math.round(x + width / 2);
    let centerY = Math.round(y + height / 2);
    await click(centerX, centerY);
    await sleep(500); // 确保点击后有足够的时间等待
    return { success: true, x: centerX, y: centerY };
}
// 匹配图像并点击
async function matchImgAndClick(obj, desc, timeout = 8000) {
    const start = Date.now();
    let retryCount = 0; // 识别次数计数
    let status = false; // 用于记录是否匹配成功
    try {
        while (Date.now() - start < timeout && !status) {
            await sleep(300);
            const ro = captureGameRegion();
            let result = ro.Find(obj.template);
            ro.dispose();
            await sleep(500); // 短暂延迟，避免过快循环
            if (result.isExist()) {
                let clickResult = await clickCenter(result.x, result.y, result.width, result.height);
                log.info(`【IMG】成功识别并点击 ${desc}| 耗时: ${Date.now() - start}ms`);
                status = true; // 设置匹配成功状态
                return { success: true, x: clickResult.x, y: clickResult.y };
            }
            // await sleep(200); // 短暂延迟，避免过快循环
            log.info(`【IMG】第${retryCount++}次识别并点击 ${desc} 失败 | 耗时: ${Date.now() - start}ms`);
        }
    } catch (error) {
        log.error(`【IMG】${script_name}等待超时，请人工介入。===待切换账号：${settings.username}===超时原因：未找到目标 [${desc}] | 文件：${obj.name}`);
        //如果有配置通知……
        notification.error(`【IMG】${script_name}等待超时，请人工介入。===待切换账号：${settings.username}===超时原因：未找到目标 [${desc}] | 文件：${obj.name}`);
        throw new Error(`【IMG】识别图像时发生异常: ${error.message}`);
    }
    return { success: false };
}
// 文字识别并点击
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 8000) {
    let start = Date.now();
    let retryCount = 0; // 重试计数
    let status = false; // 用于记录是否匹配成功
    try {
        while (Date.now() - start < timeout && !status) {
            const ro = captureGameRegion();
            let resultList = ro.findMulti(ocrRegion);
            ro.dispose();
            await sleep(500); // 短暂延迟，避免过快循环
            for (let result of resultList) {
                if (result.text.includes(targetText)) {
                    let clickResult = await clickCenter(result.x, result.y, result.width, result.height);
                    log.info(`【OCR】成功识别并点击 ${targetText}| 耗时: ${Date.now() - start}ms`);
                    status = true; // 设置匹配成功状态
                    return { success: true, x: clickResult.x, y: clickResult.y };
                }
            }
            // await sleep(200); // 短暂延迟，避免过快循环
            log.info(`【OCR】${targetText}失败，正在进行第 ${retryCount++} 次重试...`);
        }
    } catch (error) {
        log.warn(`【OCR】经过多次尝试，仍然无法识别文字: ”${targetText}“,尝试点击默认中心位置`);
        await clickCenter(result.x, result.y, result.width, result.height);
        //如果有配置通知……
        notification.error(`【OCR】识别文字: “${targetText}”,发生异常`);
        throw new Error(`【OCR】识别文字时发生异常: ${error.message}`);
    }
    return { success: false };
}
// 切换账号(OCR)版本
// ======================================================

// ======================================================
//切换账号DropDown


//切换账号DropDown
// ======================================================

(async function () {
    // ======================================================
    // Library functions

    var u = {}; // utilities 工具函数集合
    u.logi = function (message, args) { log.info("[切换账号]" + message, args) };
    u.logw = function (message, args) { log.warn("[切换账号]" + message, args) };
    u.loadTemplate = function (filePath, x /* 0 if omit */, y /* 0 if omit */, w /* maxWidth if omit */, h /* maxHeight if omit */) {
        return RecognitionObject.TemplateMatch(file.ReadImageMatSync(filePath), x, y, w, h);
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

    const assetLogoutIcon = u.loadTemplate("Assets/RecognitionObject/logout.png", 1750, 900, 170, 180);
    const assetPaimonMenuIcon = u.loadTemplate("Assets/RecognitionObject/paimon_menu.png", 0, 0, 150, 150);

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
                let resList = captureRegion.findMulti(RecognitionObject.ocr(850, 970, 220, 100));
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
        const assetPaimonCancelIcon = u.loadTemplate("Assets/RecognitionObject/paimon_cancel.png", 0, 0, 100, 100);

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
        click(50, 1024);

        // 退出至登录界面
        let btnExitToLogin = await u.waitAndFindText("退出至登录界面", 680, 380, 540, 340);
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

        const assetQuitTextButton = u.loadTemplate("Assets/RecognitionObject/quit.png", 680, 380, 1220, 700);
        let btnQuit = await u.waitAndFindImage(assetQuitTextButton, 200);
        // u.logi("识别到退出按钮，点击");
        // btnQuit.DrawSelf("QuitBtn");
        btnQuit.Click();
    };

    async function stateChangeUser() {
        u.logi("开始切换账号");
        await u.waitAndFindText(["进入游戏", "登录其他账号"], 680, 380, 540, 340, 200);

        const assetSelectUserDropDownIcon = u.loadTemplate("Assets/RecognitionObject/caret.png", 680, 380, 1220, 700);
        let captureRegion = captureGameRegion();
        let res = captureRegion.Find(assetSelectUserDropDownIcon);
        captureRegion.dispose();
        if (res.isEmpty()) {
            u.logi("未找到下拉菜单图标，点击硬编码的坐标(960, 500)展开菜单");
            click(960, 500);
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
                let resList = captureRegion.findMulti(RecognitionObject.ocr(680, 540, 540, 500));
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
            let btnEnterGame = captureRegion.DeriveCrop(684, 598, 552, 66);
            btnEnterGame.Click();
            captureRegion.dispose();
            btnEnterGame.dispose();
            // btnEnterGame.DrawSelf("EnterGameBtn");
            // u.logi("已点击\"进入游戏\"按钮，完成账号选择。");
        }
    }

    async function stateEnterGame() {
        // u.logi("开始进入游戏，等待游戏加载。");
        let textClickToStart = await u.waitAndFindText("点击进入", 850, 970, 220, 100);
        // u.logi("已识别到\"点击进入\"文本，点击鼠标进入游戏。");
        textClickToStart.DrawSelf("ClickToStart");
        textClickToStart.Click();
    }

    // ======================================================
    // Main flow

    if (await uidUtil.check()) {
        log.info("当前UID与设置UID相同，无需切换账号。");
        return
    }
    if (settings.Modes == "下拉列表") {
        await DropDownMode();
    } else if (settings.Modes == "账号+密码") {
        await KeyboardMouseMode();
    } else if (settings.Modes == "账号+密码+OCR") {
        await OcrMode();
    } else {
        log.info("尖尖哇嘎乃")
    }
    // 下拉列表模式
    async function DropDownMode() {
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

    }
    // 纯键鼠模式    对应：账号+密码（根据分辨率确定鼠标位置）
    async function KeyboardMouseMode() {
        setGameMetrics(1920, 1080, 2.0);
        //到达主页面
        await genshin.returnMainUi();//使用新号（无派蒙）测试，请注释掉这一行
        await sleep(1000);
        
        //打开派蒙页面
        keyPress("VK_ESCAPE");
        await sleep(1000);
        
        //退出门图标
        click(50, 1030);
        await sleep(1000);
        
        //退出至登录页面
        click(978, 540);
        await sleep(15000);
        
        //登录页面退出当前账号的小门图标
        click(1828, 985);
        await sleep(1000);
        
        //点击退出当前账号
        if(Account=="否"){
            //长期账号->勾选：退出并保留登录记录
            click(698, 568);
        } else{
            //临时账号->勾选：退出并清除登录记录
            click(698, 476);
        }
        await sleep(1000);
        
        //点击退出大按钮
        click(1107, 684);
        await sleep(1500);
        
        //登录其他账号
        click(946, 703);
        await sleep(1000);
        
        //点击用户名输入框
        click(815, 400);
        //如果有文本，清除
        await keyPress("VK_DELETE");
        // 输入文本
        await inputText(settings.username);
        await sleep(500);
        
        //点击密码输入框
        click(815, 480);
        //如果有文本，清除
        await keyPress("VK_DELETE");
        // 输入文本
        await inputText(settings.password);
        await sleep(500);
        
        //回车弹出协议确定框（如果有的话）
        for (let i = 0; i < 3; i++) {
            //三次回车，规避强制点击进入游戏（如果开启了自动开门功能，这一步是必须的，后续维护者须知0.54.0版本对开门的“进入游戏”识别是和配置组同时进行的。多次回车+短时间点击，可以规避掉鼠标乱点的问题。彩虹QQ人于2026年1月5日留。）
            keyPress("VK_RETURN");
            await sleep(500);
            //用户协议弹窗，点击同意，等待8.5s，增加容错
            click(1093, 593);
            await sleep(500);
        }
        await sleep(8000);//这一步根据各自网络环境和主机配置可以适当增减
        
        //进入世界循环点击，增加容错
        for (let i = 5; i > 0; i--) {
            click(960, 540);
            await sleep(1200);//增加容错（例如进入人机验证时）
        }
        //确保进入主页面
        await sleep(12000);
        //点击领月卡
        await genshin.blessingOfTheWelkinMoon();
    }
    // OCR模式 对应：账号+密码+OCR
    async function OcrMode() {
        setGameMetrics(1920, 1080, 1);
        // 如果切换账号是第一个脚本，则有可能出现月卡选项
        //防止genshin.blessingOfTheWelkinMoon();方法失效，先使用物理点击。
        try {
            keyDown("VK_MENU");
            await sleep(500);
            for (let i = 0; i <= 4; i++) {
                await click(960, 864);
                await sleep(1000);
            }
        } finally {
            keyUp("VK_MENU");
        }
        //await genshin.blessingOfTheWelkinMoon();
        //await sleep(1000);
        //await genshin.blessingOfTheWelkinMoon();
        //await sleep(1000);
        await genshin.returnMainUi();

        await keyPress("VK_ESCAPE");
        await sleep(500);
        try {
            await matchImgAndClick(pm_out, "左下角退出门");
            await matchImgAndClick(out_to_login, "退出至登陆页面");
            //这一步根据 电脑配置和当前网络情况不同休眠时间不同，建议实际运行之后，如果有日志 ： 第x次 识别失败，就适当增加休眠时间
            await sleep(9000);
            await matchImgAndClick(login_out_account, "登录页的右下角退出按钮");
            await matchImgAndClick(out_account, "退出当前账号");
            await recognizeTextAndClick("登录其他账号", RecognitionObject.Ocr(300, 200, 1200, 800), 5000);
            await sleep(1000);
            await matchImgAndClick(input_phone_or_email, "填写邮箱/手机号");
            await inputText(settings.username);
            await sleep(1000);
            await matchImgAndClick(input_password, "填写密码");
            await inputText(settings.password);
            await sleep(1000);
            //按下回车登录账号，弹出用户协议对话框
            await keyPress("VK_RETURN");
            //点击回车后，等待特瓦特大门加载
            await matchImgAndClick(agree, "同意用户协议");
            //如果当天上下线次数过于频繁
            for (let i = 1; i <= 2; i++) {
                const ro = captureGameRegion();
                let verify = ro.Find(login_verification.template);
                ro.dispose();
                //等待1s避免循环速度过快
                await sleep(1000);
                if (verify.isExist()) {
                    //这里可配置通知方法
                    notification.error(`${script_name}触发人机验证，请手动登录。===待切换账号：${settings.username}`);
                    log.error(`${script_name}触发人机验证，请手动登录。===待切换账号：${settings.username}`);
                }
            }
            /**
             * 根据不同网络环境和电脑配置，此操作可能会将领取月卡操作取代，但是不影响使用
             * 如果发现卡在这一步，请适当延长sleep时间
             */
            await sleep(8000);
            await recognizeTextAndClick("点击进入", RecognitionObject.Ocr(862, 966, 206, 104), 5000);
            await sleep(15000);

            //可能登录账号的时候出现月卡提醒，则先点击一次月卡。
            //await genshin.blessingOfTheWelkinMoon();
            //await sleep(1000);
            //await genshin.blessingOfTheWelkinMoon();
            //await sleep(1000);
            //防止genshin.blessingOfTheWelkinMoon();方法失效，先使用物理点击。
            await sleep(2000);
            keyDown("VK_MENU");
            await sleep(500);
            for (let i = 0; i <= 4; i++) {
                await click(960, 864);
                await sleep(1000);
            }
            //keyUp("VK_MENU");
            await genshin.returnMainUi();
            await sleep(1000);
            // 如果配置了通知
            notification.send("账号【" + settings.username + "】切换成功");
        } catch (error) {
            log.error(`${script_name}脚本执行过程中发生错误：${error.message}`);
            //如果发生错误，则发送通知
            notification.error(`${script_name}脚本执行过程中发生错误：${error.message}`);
            throw new Error(`${script_name}脚本执行过程中发生错误：${error.message}`);
        } finally {
            keyUp("VK_MENU");
        }
    }
})();
