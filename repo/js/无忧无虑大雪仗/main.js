// 无忧无虑大雪仗
// 从大世界打开活动页，前往布达诺娃后开始大雪仗流程。

const TARGET_SCORE = 6000;
const FULL_SCREEN = { x: 0, y: 0, width: 1920, height: 1080 };
const SCORE_REGION = { x: 1380, y: 750, width: 390, height: 85 };
const NPC_PROMPT_REGION = { x: 980, y: 440, width: 700, height: 220 };
const ACTIVITY_NAME_REGION = { x: 180, y: 200, width: 360, height: 130 };
const GO_PLAY_REGION = { x: 1400, y: 740, width: 380, height: 150 };
const TELEPORT_BUTTON_REGION = { x: 1400, y: 990, width: 520, height: 90 };
const WORLD_READY_REGION = { x: 20, y: 995, width: 190, height: 80 };
const ARRIVAL_PATH_FILE = "前往布达诺娃.json";
const DIALOG_OPTION_REGION = { x: 1050, y: 380, width: 870, height: 570 };
const MATCH_BUTTON_REGION = { x: 1450, y: 850, width: 470, height: 230 };
const MATCH_STATUS_REGION = { x: 1220, y: 780, width: 700, height: 300 };
const ACCEPT_BUTTON_REGION = { x: 800, y: 620, width: 700, height: 260 };
const START_HINT_REGION = { x: 0, y: 0, width: 520, height: 260 };
const COMPLETE_REGION = { x: 650, y: 100, width: 650, height: 300 };

const WAIT_DIALOG_MS = 15000;
const WAIT_ACTIVITY_MS = 30000;
const WAIT_WORLD_READY_MS = 60000;
const WORLD_READY_STABLE_SAMPLES = 3;
const NPC_PROMPT_RETRY_CHECK_MS = 5000;
const ARRIVAL_ROUTE_MAX_ATTEMPTS = 5;
const MATCH_FLOW_TIMEOUT_MS = 600000;
const MATCH_TRANSITION_GRACE_MS = 3000;
const MATCH_RETRY_CONFIRM_MS = 1500;
const WAIT_ROUND_MS = 300000;
const MOVE_INTERVAL_MS = 15000;
const OCR_INTERVAL_MS = 250;
const CANCELLATION_POLL_MS = 250;

let cancellationToken = null;

function isCancellationRequested() {
    return cancellationToken?.isCancellationRequested === true;
}

async function waitInterruptibly(durationMs) {
    const deadline = Date.now() + durationMs;
    while (true) {
        if (isCancellationRequested()) return false;
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) return true;
        await sleep(Math.min(CANCELLATION_POLL_MS, remainingMs));
    }
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
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
        if (isCancellationRequested()) return false;
        if (isNpcPromptVisible()) return true;
        await sleep(OCR_INTERVAL_MS);
    }
    return !isCancellationRequested() && isNpcPromptVisible();
}

async function runArrivalRouteAndWaitForNpcPrompt() {
    for (let attempt = 1; attempt <= ARRIVAL_ROUTE_MAX_ATTEMPTS; attempt++) {
        if (isCancellationRequested()) return false;

        if (attempt === 1) {
            log.info("执行地图追踪路线前往布达诺娃");
        } else {
            log.warn("路线结束后 5 秒内未识别到交互提示，重新执行路线（第 {0} 次）", attempt);
        }

        await pathingScript.runFile(ARRIVAL_PATH_FILE);
        if (await waitForNpcPrompt(NPC_PROMPT_RETRY_CHECK_MS)) {
            log.info(attempt > 1
                ? "重跑路线后已识别到布达诺娃交互提示"
                : "路线完成后已识别到布达诺娃交互提示");
            return true;
        }
        if (isCancellationRequested()) return false;
    }

    return false;
}

async function recoverNpcPromptForNextRound() {
    if (await waitForNpcPrompt(45000)) return true;
    if (isCancellationRequested()) return false;

    try {
        if (await runArrivalRouteAndWaitForNpcPrompt()) {
            log.info("本轮结束后重新执行路线并识别到布达诺娃交互提示，继续下一轮");
            return true;
        }
    } catch (error) {
        if (isCancellationRequested()) return false;
        sendNotice("重新执行前往布达诺娃路线失败");
        log.error("重新执行前往布达诺娃路线失败：{0}", error.message || error);
        return false;
    }

    if (isCancellationRequested()) return false;
    sendNotice("前往布达诺娃路线连续执行 5 次后仍未识别到交互提示，请检查角色位置");
    log.warn("前往布达诺娃路线连续执行 5 次后仍未识别到交互提示，脚本结束。");
    return false;
}

async function waitForWorldReady(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let stableSamples = 0;

    while (Date.now() < deadline) {
        if (isCancellationRequested()) return false;
        const enterVisible = !!findOcrMatch("Enter", WORLD_READY_REGION);
        if (enterVisible) {
            stableSamples++;
            if (stableSamples >= WORLD_READY_STABLE_SAMPLES) {
                log.info("已连续识别到大世界左下角 Enter 提示");
                return true;
            }
        } else {
            stableSamples = 0;
        }
        await sleep(500);
    }
    return false;
}

async function navigateToSnowballEvent() {
    log.info("按 F5 打开活动界面");
    keyPress("F5");

    if (!await waitAndClickOcr("无忧无虑大雪仗", WAIT_ACTIVITY_MS, ACTIVITY_NAME_REGION)) {
        throw new Error("活动界面中未识别到“无忧无虑大雪仗”。");
    }
    await sleep(500);

    if (!await waitAndClickOcr("前往游玩", WAIT_DIALOG_MS, GO_PLAY_REGION)) {
        throw new Error("未找到“前往游玩”按钮。");
    }

    if (!await waitAndClickOcr("传送", WAIT_DIALOG_MS, TELEPORT_BUTTON_REGION)) {
        throw new Error("未找到右下角的“传送”按钮。");
    }

    log.info("已点击“传送”，等待大世界左下角的 Enter 提示");
    if (!await waitForWorldReady(WAIT_WORLD_READY_MS)) {
        if (isCancellationRequested()) return false;
        sendNotice("未识别到大世界界面，请检查传送是否完成");
        throw new Error("点击“传送”后未连续识别到左下角的 Enter 提示。");
    }

    log.info("场景加载完成，开始前往布达诺娃");
    if (!await runArrivalRouteAndWaitForNpcPrompt()) {
        if (isCancellationRequested()) return false;
        sendNotice("前往布达诺娃路线连续执行 5 次后仍未识别到交互提示");
        throw new Error("执行前往布达诺娃路线 5 次后仍未能识别到交互提示。");
    }
    return true;
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
        if (isCancellationRequested()) return false;
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
        if (isCancellationRequested()) return false;
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
    if (!await waitInterruptibly(1200)) return false;

    while (Date.now() < deadline) {
        if (isCancellationRequested()) return false;
        if (findOcrMatch("投掷雪球击打对手", START_HINT_REGION)) return true;

        const acceptVisible = !!findOcrMatch("接受", ACCEPT_BUTTON_REGION);
        if (acceptVisible) {
            retryButtonSince = 0;
            if (Date.now() - lastAcceptClickAt >= 2500 && clickOcrMatchOnce("接受", ACCEPT_BUTTON_REGION)) {
                lastAcceptClickAt = Date.now();
                log.info("识别到匹配接受按钮，已点击接受");
            }
            if (!await waitInterruptibly(OCR_INTERVAL_MS)) return false;
            continue;
        }

        const matchingVisible = !!findOcrMatch("匹配中", MATCH_STATUS_REGION)
            || !!findOcrMatch("取消匹配", MATCH_STATUS_REGION);
        if (matchingVisible) {
            retryButtonSince = 0;
            if (!await waitInterruptibly(OCR_INTERVAL_MS)) return false;
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
                if (!await waitInterruptibly(1200)) return false;
                continue;
            }
        } else {
            retryButtonSince = 0;
        }

        if (!await waitInterruptibly(OCR_INTERVAL_MS)) return false;
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
    let bestScore = null;
    while (Date.now() < deadline) {
        if (isCancellationRequested()) return null;
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
                if (score && (!bestScore || score.current > bestScore.current)) {
                    bestScore = score;
                }
            }
        } finally {
            region.dispose();
        }
        await sleep(OCR_INTERVAL_MS);
    }
    return isCancellationRequested() ? null : bestScore;
}

async function advanceDialogueUntilScore(timeoutMs = WAIT_DIALOG_MS) {
    const deadline = Date.now() + timeoutMs;
    if (!await waitInterruptibly(1000)) return null;

    while (Date.now() < deadline) {
        if (isCancellationRequested()) return null;
        const score = await readCurrentScore(750);
        if (score) return score;

        // 底部中央的对白菱形提示；积分界面出现后立即停止点击。
        click(960, 1045);
        if (!await waitInterruptibly(300)) return null;
    }

    return await readCurrentScore(1000);
}

async function playRoundUntilComplete() {
    const moveKeys = ["W", "D", "S", "A"];
    let keyIndex = 0;
    const deadline = Date.now() + WAIT_ROUND_MS;

    log.info("开始每 15 秒依次按 W、D、S、A 移动，并等待挑战完成");
    while (Date.now() < deadline) {
        if (isCancellationRequested()) return false;
        if (findOcrMatch("挑战完成", COMPLETE_REGION)) return true;

        keyPress(moveKeys[keyIndex]);
        keyIndex = (keyIndex + 1) % moveKeys.length;

        const intervalDeadline = Date.now() + MOVE_INTERVAL_MS;
        while (Date.now() < intervalDeadline) {
            if (isCancellationRequested()) return false;
            if (findOcrMatch("挑战完成", COMPLETE_REGION)) return true;
            const remainingMs = intervalDeadline - Date.now();
            if (remainingMs > 0) {
                await sleep(Math.min(OCR_INTERVAL_MS, remainingMs));
            }
        }
    }
    return !isCancellationRequested() && !!findOcrMatch("挑战完成", COMPLETE_REGION);
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
        cancellationToken = dispatcher.getLinkedCancellationToken();
        setGameMetrics(1920, 1080, 1);
        let round = 0;
        log.info("先返回大世界主界面，确保可以打开活动面板");
        await genshin.returnMainUi();

        if (!await waitForWorldReady(5000)) {
            if (isCancellationRequested()) {
                log.info("收到 BetterGI 停止快捷键，已停止无忧无虑大雪仗脚本");
                return;
            }
            sendNotice("请先回到大世界主界面再运行该脚本");
            log.warn("返回主界面后仍未识别到左下角 Enter 提示，脚本结束。");
            return;
        }

        if (!await navigateToSnowballEvent()) {
            if (isCancellationRequested()) log.info("收到 BetterGI 停止快捷键，已停止无忧无虑大雪仗脚本");
            return;
        }

        while (true) {
            if (isCancellationRequested()) {
                log.info("收到 BetterGI 停止快捷键，已停止无忧无虑大雪仗脚本");
                return;
            }
            round++;
            log.info("开始第 {0} 轮大雪仗流程", round);

            const result = await runOneRound();
            if (isCancellationRequested()) {
                log.info("收到 BetterGI 停止快捷键，已停止无忧无虑大雪仗脚本");
                return;
            }
            if (result === "target-reached" || result === "score-cap-reached") return;

            // 挑战结果页会自动退出；若角色落点偏离交互范围，重跑到布达诺娃的路线后再开始下一轮。
            if (!await recoverNpcPromptForNextRound()) {
                if (isCancellationRequested()) log.info("收到 BetterGI 停止快捷键，已停止无忧无虑大雪仗脚本");
                return;
            }
        }
    } catch (error) {
        if (isCancellationRequested()) {
            log.info("收到 BetterGI 停止快捷键，已停止无忧无虑大雪仗脚本");
        } else {
            log.error("无忧无虑大雪仗脚本执行失败：{0}", error.message || error);
        }
    }
})();
