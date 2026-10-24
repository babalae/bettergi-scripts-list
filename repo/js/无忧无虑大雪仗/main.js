// 无忧无虑大雪仗
// 运行前提：角色位于布达诺娃附近，并能看到对应的交互提示。

const TARGET_SCORE = 6000;
const FULL_SCREEN = { x: 0, y: 0, width: 1920, height: 1080 };
const SCORE_REGION = { x: 1220, y: 650, width: 680, height: 220 };
const NPC_PROMPT_REGION = { x: 980, y: 440, width: 700, height: 220 };
const DIALOG_OPTION_REGION = { x: 1050, y: 380, width: 870, height: 570 };
const MATCH_BUTTON_REGION = { x: 1450, y: 850, width: 470, height: 230 };
const MATCH_STATUS_REGION = { x: 1220, y: 780, width: 700, height: 300 };
const ACCEPT_BUTTON_REGION = { x: 800, y: 620, width: 700, height: 260 };
const START_HINT_REGION = { x: 0, y: 0, width: 520, height: 260 };
const COMPLETE_REGION = { x: 650, y: 100, width: 650, height: 300 };

const WAIT_DIALOG_MS = 15000;
const MATCH_FLOW_TIMEOUT_MS = 600000;
const MATCH_TRANSITION_GRACE_MS = 3000;
const MATCH_RETRY_CONFIRM_MS = 1500;
const WAIT_ROUND_MS = 300000;
const OCR_INTERVAL_MS = 250;

function normalizeText(text) {
    return String(text || "")
        .replace(/\s+/g, "")
        .replace(/[，。！!？?；;：:、“”'「」『』]/g, "");
}

function sendNotice(message) {
    try {
        if (typeof notification !== "undefined" && notification && typeof notification.send === "function") {
            notification.send(message);
        } else {
            log.warn("通知接口不可用：{0}", message);
        }
    } catch (error) {
        log.error("发送通知失败：{0}", error.message || error);
    }
}

function isNpcPromptVisible() {
    try {
        return !!findOcrMatch("布达诺娃", NPC_PROMPT_REGION);
    } catch (error) {
        log.warn("识别布达诺娃对话框失败：{0}", error.message || error);
        return false;
    }
}

async function waitForNpcPrompt(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (isNpcPromptVisible()) return true;
        await sleep(OCR_INTERVAL_MS);
    }
    return isNpcPromptVisible();
}

function findOcrMatch(targetText, rect = FULL_SCREEN) {
    const region = captureGameRegion();
    try {
        const results = region.findMulti(
            RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height)
        );
        const target = normalizeText(targetText);
        for (const result of results) {
            if (normalizeText(result.text).includes(target)) return result;
        }
        return null;
    } finally {
        region.dispose();
    }
}

async function waitForText(targetText, timeoutMs, rect = FULL_SCREEN, clickWhenFound = false) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const match = findOcrMatch(targetText, rect);
        if (match) {
            log.info("识别到文字：{0}", targetText);
            if (clickWhenFound) {
                match.click();
                await sleep(300);
            }
            return true;
        }
        await sleep(OCR_INTERVAL_MS);
    }
    return false;
}

function clickOcrMatchOnce(targetText, rect) {
    const region = captureGameRegion();
    try {
        const results = region.findMulti(
            RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height)
        );
        const target = normalizeText(targetText);
        for (const result of results) {
            if (normalizeText(result.text).includes(target)) {
                result.click();
                return true;
            }
        }
        return false;
    } finally {
        region.dispose();
    }
}

async function waitAndClickOcr(targetText, timeoutMs, rect) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (clickOcrMatchOnce(targetText, rect)) return true;
        await sleep(OCR_INTERVAL_MS);
    }
    return false;
}

async function waitForMatchStart(timeoutMs = MATCH_FLOW_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    const flowStartedAt = Date.now();
    let lastAcceptClickAt = 0;
    let retryButtonSince = 0;
    let retryCount = 0;

    // 给首次点击留出界面切换时间，避免把尚未消失的旧按钮误判为失败。
    await sleep(1200);

    while (Date.now() < deadline) {
        if (findOcrMatch("投掷雪球击打对手", START_HINT_REGION)) return true;

        const acceptVisible = !!findOcrMatch("接受", ACCEPT_BUTTON_REGION);
        if (acceptVisible) {
            retryButtonSince = 0;
            if (Date.now() - lastAcceptClickAt >= 2500 && clickOcrMatchOnce("接受", ACCEPT_BUTTON_REGION)) {
                lastAcceptClickAt = Date.now();
                log.info("识别到匹配接受按钮，已点击接受");
            }
            await sleep(OCR_INTERVAL_MS);
            continue;
        }

        const matchingVisible = !!findOcrMatch("匹配中", MATCH_STATUS_REGION)
            || !!findOcrMatch("取消匹配", MATCH_STATUS_REGION);
        if (matchingVisible) {
            retryButtonSince = 0;
            await sleep(OCR_INTERVAL_MS);
            continue;
        }

        const retryButtonVisible = !!findOcrMatch("匹配挑战", MATCH_BUTTON_REGION);
        const mayRetry = retryButtonVisible
            && (lastAcceptClickAt > 0 || Date.now() - flowStartedAt >= MATCH_TRANSITION_GRACE_MS);
        if (mayRetry) {
            if (retryButtonSince === 0) retryButtonSince = Date.now();
            if (Date.now() - retryButtonSince >= MATCH_RETRY_CONFIRM_MS
                && clickOcrMatchOnce("匹配挑战", MATCH_BUTTON_REGION)) {
                retryCount++;
                lastAcceptClickAt = 0;
                retryButtonSince = 0;
                log.info("确认匹配已退回活动页，重新匹配（第 {0} 次）", retryCount);
                await sleep(1200);
                continue;
            }
        } else {
            retryButtonSince = 0;
        }

        await sleep(OCR_INTERVAL_MS);
    }
    return false;
}

function parseScoreText(text) {
    const normalized = String(text || "")
        .replace(/[OoＯ]/g, "0")
        .replace(/[Il|]/g, "1");
    const match = normalized.match(/([0-9][0-9,，]*)\s*[\/／]\s*([0-9][0-9,，]*)/);
    if (!match) return null;

    const current = Number(match[1].replace(/[,，]/g, ""));
    const limit = Number(match[2].replace(/[,，]/g, ""));
    if (!Number.isFinite(current) || !Number.isFinite(limit)) return null;
    return { current, limit, raw: match[0] };
}

async function readCurrentScore(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const region = captureGameRegion();
        try {
            const results = region.findMulti(RecognitionObject.ocr(
                SCORE_REGION.x,
                SCORE_REGION.y,
                SCORE_REGION.width,
                SCORE_REGION.height
            ));
            for (const result of results) {
                const score = parseScoreText(result.text);
                if (score) return score;
            }
        } finally {
            region.dispose();
        }
        await sleep(OCR_INTERVAL_MS);
    }
    return null;
}

async function advanceDialogueUntilScore(timeoutMs = WAIT_DIALOG_MS) {
    const deadline = Date.now() + timeoutMs;
    await sleep(1000);

    while (Date.now() < deadline) {
        const score = await readCurrentScore(250);
        if (score) return score;

        // 底部中央的对白菱形提示；积分界面出现后立即停止点击。
        click(960, 1045);
        await sleep(300);
    }

    return await readCurrentScore(1000);
}

async function playRoundUntilComplete() {
    const moveKeys = ["W", "D", "S", "A"];
    let keyIndex = 0;
    const deadline = Date.now() + WAIT_ROUND_MS;

    log.info("开始每秒依次按 W、D、S、A 移动，并等待挑战完成");
    while (Date.now() < deadline) {
        if (findOcrMatch("挑战完成", COMPLETE_REGION)) return true;

        keyPress(moveKeys[keyIndex]);
        keyIndex = (keyIndex + 1) % moveKeys.length;
        await sleep(1000);
    }
    return !!findOcrMatch("挑战完成", COMPLETE_REGION);
}

async function runOneRound() {
    keyPress("F");
    await sleep(500);

    if (!await waitForText("那就打雪仗吧", WAIT_DIALOG_MS, DIALOG_OPTION_REGION)) {
        throw new Error("对话选项中未找到“那就打雪仗吧！”。");
    }
    keyPress("F");
    const score = await advanceDialogueUntilScore();
    if (!score) {
        throw new Error("无法识别当前雪球欢意分数，已停止以免误操作。");
    }
    log.info("当前雪球欢意：{0}/{1}", score.current, score.limit);

    if (score.current >= TARGET_SCORE) {
        log.info("当前分数已达到目标 {0}，脚本结束。", TARGET_SCORE);
        keyPress("Escape");
        await sleep(500);
        return "target-reached";
    }

    if (score.limit > 0 && score.current >= score.limit) {
        log.info("当前分数已达到界面显示上限 {0}，但未达到目标 {1}；脚本结束。", score.limit, TARGET_SCORE);
        sendNotice("当前分数已达上限");
        keyPress("Escape");
        await sleep(500);
        return "score-cap-reached";
    }

    if (!await waitAndClickOcr("匹配挑战", WAIT_DIALOG_MS, MATCH_BUTTON_REGION)) {
        throw new Error("未找到“匹配挑战”按钮。");
    }

    if (!await waitForMatchStart()) {
        throw new Error("匹配流程等待超时，未识别到挑战开始提示。");
    }

    if (!await playRoundUntilComplete()) {
        throw new Error("等待“挑战完成”超时，已停止移动按键循环。");
    }

    log.info("识别到挑战完成，本轮结束。");
    return "round-complete";
}

(async function () {
    try {
        setGameMetrics(1920, 1080, 1);
        // 首次启动时按用户要求立即检查；未识别到就通知并结束。
        let promptFound = false;
        try {
            promptFound = isNpcPromptVisible();
        } catch (error) {
            log.warn("检测布达诺娃交互提示失败：{0}", error.message || error);
        }
        if (!promptFound) {
            sendNotice("请走到布达诺娃面前再运行该脚本");
            log.info("未识别到布达诺娃对话框，脚本结束。");
            return;
        }

        let round = 0;
        while (true) {
            round++;
            log.info("开始第 {0} 轮大雪仗流程", round);

            const result = await runOneRound();
            if (result === "target-reached" || result === "score-cap-reached") return;

            // 挑战结果页会自动退出；等布达诺娃交互提示重新出现后再进入下一轮。
            if (!await waitForNpcPrompt(45000)) {
                sendNotice("请走到布达诺娃面前再运行该脚本");
                log.warn("本轮结束后未重新识别到布达诺娃对话框，脚本结束。");
                return;
            }
        }
    } catch (error) {
        log.error("无忧无虑大雪仗脚本执行失败：{0}", error.message || error);
    }
})();
