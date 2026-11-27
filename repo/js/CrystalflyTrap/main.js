(async function () {
    const TRAP_ICON = "assets/icon/晶蝶诱捕装置.png";

    function ocrTexts(x, y, w, h) {
        let cap = captureGameRegion();
        const list = [];
        try {
            const res = cap.findMulti(RecognitionObject.ocr(x, y, w, h));
            for (let i = 0; i < res.count; i++) {
                list.push({
                    text: res[i].text,
                    x: res[i].x,
                    y: res[i].y,
                    w: res[i].width,
                    h: res[i].height,
                    region: res[i]
                });
            }
        } finally {
            cap.dispose();
        }
        return list;
    }

    function findText(x, y, w, h, keyword) {
        const list = ocrTexts(x, y, w, h);
        for (const item of list) {
            if (item.text.includes(keyword)) {
                return item;
            }
        }
        return null;
    }

    async function readStatus() {
        let status = { isPlaced: false, collectionTime: 0 };
        try {
            const content = file.readTextSync("status.json");
            if (content) {
                status = JSON.parse(content);
            }
        } catch (e) {
            await file.WriteTextSync("status.json", JSON.stringify(status, null, 2));
        }
        return status;
    }

    async function saveStatus(status) {
        await file.WriteTextSync("status.json", JSON.stringify(status, null, 2));
    }

    async function collectTrap(status) {
        log.info("开始收取晶蝶诱捕装置");
        let prompt = findText(900, 400, 700, 300, "晶蝶");
        if (!prompt) {
            prompt = findText(900, 400, 700, 300, "诱捕");
        }
        if (!prompt) {
            throw new Error("未找到晶蝶诱捕装置的交互提示");
        }
        keyPress("F");
        await sleep(1000);

        let gotCore = false;
        let notReady = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            const list = ocrTexts(250, 200, 1400, 600);
            for (const item of list) {
                if (item.text.includes("晶核")) {
                    gotCore = true;
                }
                if (item.text.includes("诱捕未完成") || item.text.includes("未完成")) {
                    notReady = true;
                }
            }
            if (gotCore || notReady) {
                break;
            }
            await sleep(400);
        }

        if (gotCore) {
            log.info("收取成功，关闭奖励界面");
            click(1800, 900);
            await sleep(1000);
            status.isPlaced = false;
            status.collectionTime = 0;
            await saveStatus(status);
            log.info("状态已更新：未部署");
        } else if (notReady) {
            log.info("诱捕未完成，装置仍在运转，今天不收取");
            await sleep(1500);
        } else {
            log.error("未识别到晶核或诱捕未完成，状态未知");
        }
    }

    async function chooseMaterialAndStart() {
        log.info("材料界面：检查左下角“最大”");
        let maxBtn = findText(200, 930, 500, 150, "最大");

        if (!maxBtn) {
            log.info("未找到“最大”，改为点击屏幕上数量最大的材料");
            const list = ocrTexts(100, 80, 1700, 500);
            let best = null;
            let bestVal = 0;
            for (const item of list) {
                const digits = item.text.replace(/[^\d]/g, "");
                if (!digits) {
                    continue;
                }
                const val = parseInt(digits, 10);
                if (val > 30 && val > bestVal) {
                    best = item;
                    bestVal = val;
                }
            }
            if (best) {
                log.info(`点击最大数量：${best.text}（${bestVal}）`);
                best.region.click();
                await sleep(800);
            } else {
                log.error("未找到大于30的材料数量");
            }
            maxBtn = findText(200, 930, 500, 150, "最大");
        }

        if (maxBtn) {
            log.info("点击“最大”");
            maxBtn.region.click();
            await sleep(500);
        } else {
            log.info("仍未找到“最大”，尝试固定坐标");
            click(460, 1010);
            await sleep(500);
        }

        log.info("启动！");
        click(1750, 1020);
        await sleep(1000);
        log.info("启动！！！");
        click(1200, 750);
        await sleep(3000);
    }

    try {
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();

        const status = await readStatus();

        log.info("传送到枫丹冒险家协会锚点");
        await genshin.tp(4509, 3631);
        await sleep(1000);

        // 打开背包，按 E 循环切页，直到左上角出现“小道具”
        keyPress("B");
        await sleep(1000);
        let foundGadgetTab = false;
        for (let i = 0; i < 20; i++) {
            const title = ocrTexts(0, 0, 400, 100).map((item) => item.text).join("");
            if (title.includes("小道具") || title.includes("小道")) {
                foundGadgetTab = true;
                break;
            }
            keyPress("E");
            await sleep(300);
        }
        if (!foundGadgetTab) {
            throw new Error("背包内未找到“小道具”页签");
        }

        // 找并点击晶蝶诱捕装置
        let trapCap = captureGameRegion();
        let trap = null;
        try {
            trap = trapCap.find(
                RecognitionObject.TemplateMatch(file.ReadImageMatSync(TRAP_ICON))
            );
        } finally {
            trapCap.dispose();
        }
        if (!trap) {
            throw new Error("背包内未找到晶蝶诱捕装置");
        }
        log.info("选择晶蝶诱捕装置");
        trap.click();
        await sleep(1000);

        // 用右下角“部署 / 取消布置”判断真实部署状态
        const buttonText = ocrTexts(1450, 930, 400, 150)
            .map((item) => item.text)
            .join("");
        log.info(`右下角按钮识别：${buttonText}`);

        if (buttonText.includes("取消")) {
            log.info("装置已经部署，进入收取流程");
            status.isPlaced = true;
            await saveStatus(status);
            keyPress("ESCAPE");
            await sleep(800);
            await collectTrap(status);
        } else if (buttonText.includes("部署")) {
            log.info("装置未部署，进入放置流程");
            click(1700, 1010);
            try {
                await genshin.returnMainUi();
            } catch (e) {
                log.info(`returnMainUi 失败，继续尝试：${e.message}`);
            }
            await sleep(1000);

            const worldPrompt = findText(900, 400, 700, 300, "晶蝶");
            if (!worldPrompt) {
                throw new Error("放置后未找到晶蝶诱捕装置的交互提示");
            }
            keyPress("F");
            await sleep(1000);

            await chooseMaterialAndStart();

            status.isPlaced = true;
            status.collectionTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
            await saveStatus(status);
            log.info("放置完成");
        } else {
            throw new Error(`无法识别部署状态：${buttonText}`);
        }
    } catch (e) {
        log.error(`执行脚本时出错：${e}`, e.message);
    }
})();
