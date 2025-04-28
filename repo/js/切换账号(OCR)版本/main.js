const author = "彩虹QQ人";
const script_name = "切换账号(OCR)版本";
const pm_menu = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/pm_menu.png")),
    name: "pm_menu.png"
};
const pm_out = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/pm_out.png")),
    name: "pm_out.png"
};
const out_to_login = {
    template: RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/out_to_login.png")),
    name: "out_to_login.png"
};
const login_out_account = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/login_out_account.png")),
    name: "login_out_account.png"
};
const out_account = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/out_account.png")),
    name: "out_account.png"
};
const login_other_account = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/login_other_account.png")),
    name: "login_other_account.png"
};
const input_phone_or_email = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/input_phone_or_email.png")),
    name: "input_phone_or_email.png"
};
const input_password = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/input_password.png")),
    name: "input_password.png"
};
const agree = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/agree.png")),
    name: "agree.png"
};
//人机验证识别图片
const login_verification = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/verification.png")),
    name: "verification.png"
};
const click_into = {
    template:RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/click_into.png")),
    name: "click_into.png"
};


(async function () {

    /**
     *  普通的识别点击方法
     * @param obj 识别对象
     * @param desc  识别对象的描述，方便日志查看
     */
    async function identificationAndClick (obj,desc) {
            const start = Date.now();
            // 在截图中寻找
            let result = captureGameRegion().Find(obj.template);
            if (result.isExist()) {
                result.click();
                log.info(`成功识别并点击 ${desc} | 耗时: ${Date.now() - start}ms`);
            }else {
                //这里可配置通知方法
                // notification.error(`${script_name}识别超时===待切换账号：${settings.username}===原因：未找到目标 [${desc}] | 文件：${obj.name}`);
                throw new Error(`${script_name}识别超时：未找到目标 [${desc}] | 文件：${obj.name}`);
            }
    }

    /**
     * 等待正确页面的识别点击方法
     * @param obj 识别对象
     * @param desc 识别对象的描述，方便日志查看
     * @param timeout 设置超时时间（默认值为15000即不传此参数情况下）
     */
    async function waitForToClick(obj, desc,timeout = 15000) {
        await sleep(1000);
        const start = Date.now();
        let x = 1;
        while (Date.now() - start < timeout) {
            let result = captureGameRegion().Find(obj.template);
            //等待1s确保识别结果
            await sleep(800);
            if (result.isExist()) {
                result.click();
                log.info(`成功识别并点击 ${desc}| 耗时: ${Date.now() - start}ms`);
                return true;
            }
            log.info(`第${x}识别并点击 ${desc} 失败 | 耗时: ${Date.now() - start}ms`);
            x++;
            await sleep(1000);
        }
        //这里可配置通知方法
        //notification.error(`${script_name}等待超时，请人工介入。===待切换账号：${settings.username}===超时原因：未找到目标 [${desc}] | 文件：${obj.name}`);
        throw new Error(`${script_name}等待超时：未找到目标 [${desc}] | 文件：${obj.name}`);
    }
    
    await genshin.returnMainUi();
    //按下alt键（确保释放）
    await keyDown("VK_MENU");
    await sleep(500);
    try {
        await identificationAndClick(pm_menu,"左上角派蒙脑袋");
    } finally {
        await keyUp("VK_MENU");
    }
    await waitForToClick(pm_out,"左下角退出门");
    await waitForToClick(out_to_login,"退出至登陆页面");
    //这一步根据 电脑配置和当前网络情况不同休眠时间不同，建议实际运行之后，如果有日志 ： 第x次 识别失败，就适当增加休眠时间
    await sleep(9000);
    await waitForToClick(login_out_account,"登录页的右下角退出按钮");
    await waitForToClick(out_account,"退出当前账号");
    await waitForToClick(login_other_account,"登录其他账号");
    await sleep(1000);
    await waitForToClick(input_phone_or_email,"填写邮箱/手机号");
    await inputText(settings.username);
    await sleep(1000);
    await waitForToClick(input_password,"填写密码");
    await inputText(settings.password);
    await sleep(1000);
    //按下回车登录账号，弹出用户协议对话框
    await keyPress("VK_RETURN");
    //点击回车后，等待特瓦特大门加载
    await waitForToClick(agree,"同意用户协议");
    //如果当天上下线次数过于频繁
    for(let i = 1;i<=2;i++){
        await sleep(1000);
        let verify = captureGameRegion().Find(login_verification.template);
        //等待1s确保识别结果
        await sleep(800);
        if (verify.isExist()) {
            //这里可配置通知方法
            //notification.error(`${script_name}触发人机验证，请手动登录。===待切换账号：${settings.username}`);
            throw new Error(`${script_name}触发人机验证，请手动登录`);
        }
    }
    /**
     * 根据不同网络环境和电脑配置，此操作可能会将领取月卡操作取代，但是不影响使用
     * 如果发现卡在这一步，请适当延长sleep时间
     */
    log.info("点击中心屏幕，等待提瓦特开门");
    await sleep(5000);
    for(let i = 1;i<=8;i++){
        click(genshin.width/2.0,genshin.height/2.0);
        await sleep(1000);
    }
    await sleep(5000);
    log.info("执行开门自动领取月卡");
    await genshin.blessingOfTheWelkinMoon();
    await sleep(1000);
    log.info(`账号切换成功，当前帐号：${settings.username}`);
})();
