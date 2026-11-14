let username = settings.username || "default";
let use_bgi_code_source = settings.use_bgi_code_source || false;
let server = settings.server || "";
let trust_expire_time = settings.trust_expire_time || false;

// 服务器选项映射为内部标识
const serverMap = { "国服": "cn", "国际服（测试）": "global" };
server = serverMap[server] || "";

async function* getCodeFromFile() {
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
        yield [code, deadline, ""];
    }
}

const BGI_CODE_UPDATETIME_URL = "https://cnb.cool/bettergi/genshin-redeem-code/-/git/raw/main/update_time.txt"
const BGI_CODE_LIST_URL = "https://cnb.cool/bettergi/genshin-redeem-code/-/git/raw/main/codes.json"
async function* getCodeFromBGI() {
    // const updateTimeResp = await fetch(BGI_CODE_UPDATETIME_URL);
    // if (!updateTimeResp.ok) {
    //     log.error(`获取BGI兑换码更新时间失败: ${updateTimeResp.status} ${updateTimeResp.statusText}`);
    //     return;
    // }
    // const updateTime = (await updateTimeResp.text()).trim(); // YYYYMMDD
    // const updateTimeDate = new Date(`${updateTime.slice(0, 4)}-${updateTime.slice(4, 6)}-${updateTime.slice(6, 8)}`);

    const listResp = await http.request('GET', BGI_CODE_LIST_URL, null, null);
    log.debug(`BGI兑换码列表请求返回: ${JSON.stringify(listResp)}`);
    if (listResp.status_code != 200) {
        log.error(`获取BGI兑换码列表失败: 服务器返回状态${listResp.status} ${listResp.statusText}`);
        return;
    }
    const fixed = listResp.body
        .replace(/,\s*]/g, ']')
        .replace(/,\s*}/g, '}');

    const listJson = JSON.parse(fixed);
    if (!Array.isArray(listJson)) {
        log.error(`BGI兑换码列表格式错误`);
        return;
    }
    const codeTitles = listJson.map(item => item.title);
    log.info(`BGI兑换码列表获取成功，共 ${codeTitles.length} 组兑换码: ${codeTitles.join(", ")}`);  

    for (const item of listJson) {
        const valid = (item.valid || '').trim(); // YYYY-MM-DD，空值或缺失时视为不过期
        const codeServer = item.title && item.title.startsWith("[国际服]") ? "global" : "cn";
        if (!Array.isArray(item.codes)) continue;
        for (const code of item.codes) {
            if (!code) continue;
            yield [code, valid, codeServer];
        }
    }
}

async function* getCodeList() {
    if (!use_bgi_code_source) {
        yield *getCodeFromFile();
    } else {
        yield *getCodeFromBGI();
    }
}

async function openCodeUI() {
    keyPress("ESCAPE");
    await sleep(2000);

    const settingsRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/settings.png"));
    const ro1 = captureGameRegion();
    const settingsRes = ro1.find(settingsRo);
    ro1.dispose();
    if (settingsRes.isExist()) settingsRes.click();
    await sleep(2000);

    const accountRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/account.png"));
    const ro2 = captureGameRegion();
    const accountRes = ro2.find(accountRo);
    ro2.dispose();
    if (accountRes.isExist()) accountRes.click();
    await sleep(500);

    const goToRedeemRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/go_to_redeem.png"));
    const ro3 = captureGameRegion();
    const goToRedeemRes = ro3.find(goToRedeemRo);
    ro3.dispose();
    if (goToRedeemRes.isExist()) goToRedeemRes.click();
    await sleep(500);
}

(async function () {
    setGameMetrics(1920, 1080, 1);

    // 1. 返回主界面
    await genshin.returnMainUi();
    await sleep(1000);

    // 2. 检验设置用户名
    async function getUsername() {
        const uid = await genshin.uid()
        if (uid === 0) {
            username = username.trim();
            // 只允许 中文 / 英文 / 数字，长度 1~20
            if (!username || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(username)) {
                log.error(`用户名${username}违规，暂时使用默认用户名，请查看readme后修改`)
                username = "default";
            }
        } else {
            username = `${uid}`;
        }

        return username;
    }

    username =await getUsername();
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
    
    // 4-5. 读取 code 并打开兑换界面进行兑换
    try {
        // 收集所有兑换码
        const allCodes = [];
        for await (const [code, deadline, codeServer] of getCodeList()) {
            allCodes.push({ code, deadline, codeServer });
        }

        // 按服务器分组：目标服务器组走原规则，其他服务器组无效也写缓存
        const targetCodes = [];
        const otherCodes = [];
        for (const item of allCodes) {
            if (!server || !item.codeServer || item.codeServer === server) {
                targetCodes.push(item);
            } else {
                otherCodes.push(item);
            }
        }

        let count = 0;
        let uiOpened = false;

        async function redeemCode(code, deadline, writeInvalidToCache) {
            // 跳过已兑换的
            if (redeemedCodes.has(code)) {
                count++;
                return;
            }

            // 时间检查（仅当用户信任过期时间时才跳过，过期超过一天才跳过）
            if (trust_expire_time && deadline) {
                const deadlineDate = new Date(deadline);
                if (!isNaN(deadlineDate.getTime())) {
                    const buffered = new Date(deadlineDate.getTime() + 24 * 60 * 60 * 1000);
                    if (new Date() > buffered) {
                        log.info(`兑换码【${code}】已超过截止时间，跳过`);
                        return;
                    }
                }
            }

            // 打开兑换界面
            if (!uiOpened) {
                await openCodeUI();
                uiOpened = true;
            }

            // 输入兑换码
            const inputCodeRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/input_code.png"));
            const ro4 = captureGameRegion();
            const inputCodeRes = ro4.find(inputCodeRo);
            ro4.dispose();
            if (inputCodeRes.isExist()) inputCodeRes.click();
            await sleep(300);

            await inputText(code);
            await sleep(500);

            // 点击兑换按钮
            const redeemRo = RecognitionObject.TemplateMatch(file.readImageMatSync("assets/redeem.png"));
            const ro5 = captureGameRegion();
            const redeemRes = ro5.find(redeemRo);
            ro5.dispose();
            if (redeemRes.isExist()) redeemRes.click();
            await sleep(1500);

            // 检测各种状态
            const ro6 = captureGameRegion();
            const invalidRes = ro6.find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/invalid.png")));
            ro6.dispose();
            if (invalidRes.isExist()) {
                if (writeInvalidToCache) {
                    const writeOk = file.writeTextSync(recordPath, code + "\n", true);
                    if (writeOk) {
                        log.info(`兑换码【${code}】无效（非目标服务器），已记录不再尝试`);
                        redeemedCodes.add(code);
                    }
                } else {
                    log.info(`兑换码【${code}】无效`);
                }
            }

            const ro7 = captureGameRegion();
            const usedRes = ro7.find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/used.png")));
            ro7.dispose();
            if (usedRes.isExist()) {
                const writeOk = file.writeTextSync(recordPath, code + "\n", true);
                if (writeOk) {
                    log.info(`兑换码【${code}】已使用`);
                    redeemedCodes.add(code);
                }
            }

            const ro8 = captureGameRegion();
            const expiredRes = ro8.find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/expired.png")));
            ro8.dispose();
            if (expiredRes.isExist()) {
                const writeOk = file.writeTextSync(recordPath, code + "\n", true);
                if (writeOk) {
                    log.info(`兑换码【${code}】已过期`);
                    redeemedCodes.add(code);
                }
            }

            const ro9 = captureGameRegion();
            const notopenRes = ro9.find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/not_open.png")));
            ro9.dispose();
            if (notopenRes.isExist()) log.info(`兑换码【${code}】未开启`);

            const ro10 = captureGameRegion();
            const confirmRes = ro10.find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/confirm.png")));
            ro10.dispose();
            if (confirmRes.isExist()) {
                log.info(`兑换码【${code}】成功兑换`);
                confirmRes.click();

                const writeOk = file.writeTextSync(recordPath, code + "\n", true);
                if (writeOk) {
                    log.info(`已记录兑换码【${code}】到 ${recordPath}`);
                    redeemedCodes.add(code);
                }
            }

            // 清除输入
            const ro11 = captureGameRegion();
            const clearRes = ro11.find(RecognitionObject.TemplateMatch(file.readImageMatSync("assets/clear.png")));
            ro11.dispose();
            if (clearRes.isExist()) clearRes.click();

            await sleep(4000);
        }

        // 第一轮：目标服务器码，无效不写缓存
        log.info(`开始兑换目标服务器（${server || "不区分"}）兑换码，共 ${targetCodes.length} 个`);
        for (const { code, deadline } of targetCodes) {
            await redeemCode(code, deadline, false);
        }

        // 第二轮：其他服务器码，无效也写缓存（避免反复尝试）
        if (otherCodes.length > 0) {
            log.info(`尝试兑换其他服务器兑换码，共 ${otherCodes.length} 个，无效将被记录`);
            for (const { code, deadline } of otherCodes) {
                await redeemCode(code, deadline, true);
            }
        }

        if (count > 0) {
            log.info(`检测到${count}个兑换码已兑换过，跳过`);
        }
    } catch (error) {
        log.error(`读取兑换码文件失败: ${error}`);
    }

    // 6. 返回主界面
    await genshin.returnMainUi();

})();