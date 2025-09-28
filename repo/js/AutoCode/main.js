let username = settings.useename || "default";

(async function () {
    setGameMetrics(1920, 1080, 1);

    // 1. 返回主界面
    await genshin.returnMainUi();
    await sleep(1000);

    // 2. 检验设置用户名
    function getUsername() {
        username = username.trim();
        // 只允许 中文 / 英文 / 数字，长度 1~20
        if (!username || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(username)) {
            log.error(`用户名${username}违规，暂时使用默认用户名，请查看readme后修改`)
            username = "default";
        }
        return username;
    }

    username = getUsername();
    const recordPath = `record/record_${username}.txt`;

    // 3. 读取已兑换记录
    let redeemedCodes = new Set();
    try {
        const recordContent = file.readTextSync(recordPath);
        if (recordContent) {
            redeemedCodes = new Set(recordContent.split("\n").map(l => l.trim()).filter(Boolean));
        }
    } catch (e) {
        log.warn(`未找到 ${recordPath}，稍后会自动创建`);
    }

    // 4. 打开兑换界面
    keyPress("ESCAPE");
    await sleep(2000);

    const settingsRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/settings.png"));
    const settingsRes = captureGameRegion().find(settingsRo);
    if (settingsRes.isExist()) settingsRes.click();
    await sleep(2000);

    const accountRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/account.png"));
    const accountRes = captureGameRegion().find(accountRo);
    if (accountRes.isExist()) accountRes.click();
    await sleep(500);

    const goToRedeemRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/go_to_redeem.png"));
    const goToRedeemRes = captureGameRegion().find(goToRedeemRo);
    if (goToRedeemRes.isExist()) goToRedeemRes.click();
    await sleep(500);

    // 5. 读取 codes.txt 进行兑换
    try {
        const content = file.readTextSync("codes.txt");
        const codes = content.split("\n");

        for (let i = 0; i < codes.length; i++) {
            const line = codes[i].trim();
            if (!line) continue;

            // 找到最后一个英文逗号
            const lastCommaIndex = line.lastIndexOf(',');
            let code, deadline;
            if (lastCommaIndex === -1) {
                // 没有逗号，则整个当作code
                code = line;
                deadline = '';
            } else {
                code = line.slice(0, lastCommaIndex).trim();
                deadline = line.slice(lastCommaIndex + 1).trim();
            }

            if (!code) continue;

            // 跳过已兑换的
            if (redeemedCodes.has(code)) {
                log.info(`检测到${redeemedCodes.size}个兑换码已兑换过，跳过`);
                continue;
            }

            // 时间检查
            const now = new Date();
            const currentTime = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
            if (currentTime > deadline) {
                log.info(`兑换码【${code}】已超过截止时间，跳过`);
                continue;
            }

            // 输入兑换码
            const inputCodeRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/input_code.png"));
            const inputCodeRes = captureGameRegion().find(inputCodeRo);
            if (inputCodeRes.isExist()) inputCodeRes.click();
            await sleep(300);

            await inputText(code);
            await sleep(500);

            // 点击兑换按钮
            const redeemRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/redeem.png"));
            const redeemRes = captureGameRegion().find(redeemRo);
            if (redeemRes.isExist()) redeemRes.click();
            await sleep(1500);

            // 检测各种状态
            const invalidRes = captureGameRegion().find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/invalid.png")));
            if (invalidRes.isExist()) log.info(`兑换码【${code}】无效`);

            const usedRes = captureGameRegion().find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/used.png")));
            if (usedRes.isExist()) {
                // 写入记录
                const writeOk = file.writeTextSync(recordPath, code + "\n", true);
                if (writeOk) {
                    log.info(`兑换码【${code}】已使用`);
                    redeemedCodes.add(code);
                }
            }

            const expiredRes = captureGameRegion().find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/expired.png")));
            if (expiredRes.isExist()) {
                // 写入记录
                const writeOk = file.writeTextSync(recordPath, code + "\n", true);
                if (writeOk) {
                    log.info(`兑换码【${code}】已过期`);
                    redeemedCodes.add(code);
                }
            }

            const notopenRes = captureGameRegion().find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/not_open.png")));
            if (notopenRes.isExist()) log.info(`兑换码【${code}】未开启`);

            const confirmRes = captureGameRegion().find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/confirm.png")));
            if (confirmRes.isExist()) {
                log.info(`兑换码【${code}】成功兑换`);
                confirmRes.click();

                // 写入记录
                const writeOk = file.writeTextSync(recordPath, code + "\n", true);
                if (writeOk) {
                    log.info(`已记录兑换码【${code}】到 ${recordPath}`);
                    redeemedCodes.add(code);
                }
            }

            // 清除输入
            const clearRes = captureGameRegion().find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/clear.png")));
            if (clearRes.isExist()) clearRes.click();

            await sleep(4000);
        }
    } catch (error) {
        log.error(`读取兑换码文件失败: ${error}`);
    }

    // 6. 返回主界面
    await genshin.returnMainUi();
})();