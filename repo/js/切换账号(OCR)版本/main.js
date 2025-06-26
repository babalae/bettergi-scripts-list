const author = "彩虹QQ人";
const script_name = "切换账号(OCR)版本";

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

async function matchImgAndClick(obj, desc,timeout = 8000) {
    const start = Date.now();
    let x = 1; // 识别次数计数
    while (Date.now() - start < timeout) {
        try {
            await sleep(500); // 短暂延迟，避免过快循环
            let result = captureGameRegion().Find(obj.template);
            await sleep(500); // 短暂延迟，避免过快循环
            if (result.isExist()) {
                let centerX = Math.round(result.x + result.width / 2);
                let centerY = Math.round(result.y + result.height / 2);
                result.click();
                log.info(`成功识别并点击 ${desc}| 耗时: ${Date.now() - start}ms`);
                return { success: true, x: centerX, y: centerY };
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        log.info(`第${x++}次识别并点击 ${desc} 失败 | 耗时: ${Date.now() - start}ms`);
    }
    log.warn(`${script_name}等待超时，请人工介入。===待切换账号：${settings.username}===超时原因：未找到目标 [${desc}] | 文件：${obj.name}`);
    //这里配置通知方法
    notification.error(`${script_name}等待超时，请人工介入。===待切换账号：${settings.username}===超时原因：未找到目标 [${desc}] | 文件：${obj.name}`);
    return { success: false };
}
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 8000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试 OCR 识别
            let resList = captureGameRegion().findMulti(ocrRegion); // 指定识别区域
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                if (res.text.includes(targetText)) {
                    // 如果找到目标文本，计算并点击文字的中心坐标
                    let centerX = Math.round(res.x + res.width / 2);
                    let centerY = Math.round(res.y + res.height / 2);
                    await click(centerX, centerY);
                    await sleep(500); // 确保点击后有足够的时间等待
                    return { success: true, x: centerX, y: centerY };
                }
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`页面标志识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(1000); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别文字: ${targetText},尝试点击默认中心位置`);
    let centerX = Math.round(ocrRegion.x + ocrRegion.width / 2);
    let centerY = Math.round(ocrRegion.y + ocrRegion.height / 2);
    await click(centerX, centerY);
    await sleep(1000);
    return { success: false };
}
/**
 * main流程开始
 */
(async function () {

    setGameMetrics(1920, 1080, 1);
    // 如果切换账号是第一个脚本，则有可能出现月卡选项
    await genshin.blessingOfTheWelkinMoon();
    await sleep(1000);
    await genshin.blessingOfTheWelkinMoon();
    await sleep(1000);
    await genshin.returnMainUi();

    await keyPress("VK_ESCAPE");
    await sleep(500);

    await matchImgAndClick(pm_out,"左下角退出门");
    await matchImgAndClick(out_to_login,"退出至登陆页面");
    //这一步根据 电脑配置和当前网络情况不同休眠时间不同，建议实际运行之后，如果有日志 ： 第x次 识别失败，就适当增加休眠时间
    await sleep(9000);
    await matchImgAndClick(login_out_account,"登录页的右下角退出按钮");
    await matchImgAndClick(out_account,"退出当前账号");
    await matchImgAndClick(login_other_account,"登录其他账号");
    await sleep(1000);
    await matchImgAndClick(input_phone_or_email,"填写邮箱/手机号");
    await inputText(settings.username);
    await sleep(1000);
    await matchImgAndClick(input_password,"填写密码");
    await inputText(settings.password);
    await sleep(1000);
    //按下回车登录账号，弹出用户协议对话框
    await keyPress("VK_RETURN");
    //点击回车后，等待特瓦特大门加载
    await matchImgAndClick(agree,"同意用户协议");
    //如果当天上下线次数过于频繁
    for(let i = 1;i<=2;i++){
        let verify = captureGameRegion().Find(login_verification.template);
        //等待1s避免循环速度过快
        await sleep(1000);
        if (verify.isExist()) {
            //这里可配置通知方法
            notification.error(`${script_name}触发人机验证，请手动登录。===待切换UID：${settings.UID}`);
            log.error(`${script_name}触发人机验证，请手动登录。===待切换UID：${settings.UID}`);
        }
    }
    /**
     * 根据不同网络环境和电脑配置，此操作可能会将领取月卡操作取代，但是不影响使用
     * 如果发现卡在这一步，请适当延长sleep时间
     */
    await sleep(8000);
    await recognizeTextAndClick("点击进入", RecognitionObject.Ocr(862, 966, 206, 104), 960, 540, 5000);
    await sleep(12000);

    //可能登录账号的时候出现月卡提醒，则先点击一次月卡。
    await genshin.blessingOfTheWelkinMoon();
    await sleep(1000);
    await genshin.blessingOfTheWelkinMoon();
    await sleep(1000);
    //如果配置了通知
    notification.send("账号切换成功【UID：" + settings.UID + "】");

})();
