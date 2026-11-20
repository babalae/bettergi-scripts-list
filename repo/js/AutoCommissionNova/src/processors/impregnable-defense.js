/**
 * Basic 固若金汤：按波次提示和累计击杀进度强制换位。
 */
import { bvPageOcrRegionText } from "../vision/ocr-utils.js";
import { DEFAULT_BATTLE_STRATEGY, loadPartyConfigForContext, resolveBattleStrategy } from "../loaders/party-config.js";
import { isCancellationError } from "../utils/error-utils.js";
import { defineStep } from "./define-step.js";
import {
    parseImpregnableDefenseConfig,
    parseImpregnableDefenseKills,
    parseImpregnableDefenseWave,
    selectReachedThreshold,
} from "./impregnable-defense-config.js";

const POLL_INTERVAL_MS = 400;
const COMPLETION_CONFIRM_MS = 250;
const FIGHT_CANCEL_TIMEOUT_MS = 10 * 1000;
const WAVE_REGION = new OpenCvSharp.OpenCvSharp.Rect(805, 246, 328, 42);
const KILL_REGION = new OpenCvSharp.OpenCvSharp.Rect(54, 285, 383, 35);
const COMPLETION_REGION = new OpenCvSharp.OpenCvSharp.Rect(880, 165, 160, 45);

/**
 * 对指定屏幕区域执行 OCR；普通识别错误返回空文本，用户取消异常继续上抛。
 * @param {OpenCvSharp.OpenCvSharp.Rect} region - OCR 截取区域。
 * @param {string} label - 用于调试日志的区域名称。
 * @returns {string} OCR 文本，识别失败时返回空字符串。
 */
function readOcr(region, label) {
    try {
        return bvPageOcrRegionText(region);
    } catch (error) {
        if (isCancellationError(error)) throw error;
        log.debug("固若金汤{name} OCR 失败: {error}", label, error.message);
        return "";
    }
}

/**
 * 读取并解析当前波次提示。
 * @returns {{current: number, total: number}|null} 当前波次，未识别到时返回 null。
 */
function readWave() {
    return parseImpregnableDefenseWave(readOcr(WAVE_REGION, "波次"));
}

/**
 * 读取并解析委托的累计击杀进度。
 * @returns {{current: number, total: number}|null} 累计进度，未识别到时返回 null。
 */
function readKills() {
    return parseImpregnableDefenseKills(readOcr(KILL_REGION, "击杀进度"));
}

/**
 * 判断固定完成提示区域是否包含“委托完成”。
 * @returns {boolean} 当前帧是否识别到完成提示。
 */
function hasCompletionText() {
    return String(readOcr(COMPLETION_REGION, "完成提示")).replace(/\s/g, "").includes("委托完成");
}

/**
 * 创建一项使用独立取消令牌的自动战斗，并跟踪其异步结束状态。
 * @param {string} strategyName - BetterGI 自动战斗策略名称。
 * @returns {{cts: Object, state: {settled: boolean, error: Error|null, intentionalCancel: boolean}, task: Promise<void>}}
 * 战斗句柄；调用方负责取消并释放 cts。
 */
function createFight(strategyName) {
    const cts = dispatcher.GetLinkedCancellationTokenSource();
    const state = { settled: false, error: null, intentionalCancel: false };
    const param = new AutoFightParam(strategyName);
    const task = Promise.resolve(dispatcher.RunAutoFightTask(param, cts.Token))
        .then(() => { state.settled = true; })
        .catch(error => {
            state.error = error;
            state.settled = true;
        });
    return { cts, state, task };
}

/**
 * 主动取消自动战斗，并等待其在限定时间内完全退出。
 * @param {{cts: Object, state: Object, task: Promise<void>}|null} fight - 当前战斗句柄。
 * @returns {Promise<void>}
 * @throws {Error} 取消后十秒内仍未退出时抛出错误。
 */
async function stopFight(fight) {
    if (!fight) return;
    fight.state.intentionalCancel = true;
    fight.cts.Cancel();
    const completed = await Promise.race([
        fight.task.then(() => true),
        sleep(FIGHT_CANCEL_TIMEOUT_MS).then(() => false),
    ]);
    if (!completed) throw new Error("取消自动战斗超过 10 秒仍未退出");
}

/**
 * 释放战斗取消令牌源；兼容未暴露 Dispose 的 ClearScript 版本。
 * @param {{cts: Object}|null} fight - 当前战斗句柄。
 * @returns {void}
 */
function disposeFight(fight) {
    if (!fight) return;
    try { fight.cts.Dispose(); } catch (_) { /* ClearScript 版本可能不暴露 Dispose。 */ }
}

/**
 * 检查战斗是否发生非主动结束，并把该状态转换为步骤错误。
 * @param {{state: {settled: boolean, error: Error|null, intentionalCancel: boolean}}|null} fight - 当前战斗句柄。
 * @returns {void}
 * @throws {Error} 战斗在委托完成前自行返回或异常结束时抛出。
 */
function assertFightRunning(fight) {
    if (!fight || !fight.state.settled || fight.state.intentionalCancel) return;
    if (fight.state.error) {
        const message = fight.state.error.message || String(fight.state.error);
        if (message.toLowerCase().includes("normalendexception")) {
            throw new Error(`自动战斗在委托完成前异常结束: ${message}`);
        }
        throw fight.state.error;
    }
    throw new Error("自动战斗在委托完成前自行结束");
}

/**
 * 执行“固若金汤”动态波次流程。
 * @param {{data: Object}} step - 当前流程步骤。
 * @param {{resolveResource: function(string): string}} context - 委托上下文及资源路径解析器。
 * @returns {Promise<boolean>} 连续确认委托完成后返回 true。
 */
async function runImpregnableDefense(step, context) {
    const parsed = parseImpregnableDefenseConfig(step.data);
    if (!parsed.ok) throw new Error(parsed.error);
    for (const warning of parsed.warnings) log.warn("固若金汤配置: {warning}", warning);

    const configBundle = loadPartyConfigForContext(context);
    const strategyName = resolveBattleStrategy(configBundle) || DEFAULT_BATTLE_STRATEGY;
    const deadline = Date.now() + parsed.timeout * 1000;
    const processedByWave = new Map();
    let currentWave = 1;
    let maximumKills = null;
    let fight = null;

    /**
     * 检查步骤总时限。
     * @returns {void}
     * @throws {Error} 当前时间达到步骤截止时间时抛出。
     */
    const ensureWithinTimeout = () => {
        if (Date.now() >= deadline) throw new Error(`固若金汤步骤超过 ${parsed.timeout} 秒总超时`);
    };

    /**
     * 停止当前战斗并执行一条换位路径。
     * @param {string} path - 相对于当前委托目录的路径文件。
     * @returns {Promise<void>}
     */
    const runPath = async path => {
        if (fight) {
            const oldFight = fight;
            await stopFight(oldFight);
            disposeFight(oldFight);
            fight = null;
        }
        const fullPath = context.resolveResource(path);
        log.info("固若金汤执行换位路径: {path}", fullPath);
        await pathingScript.runFile(fullPath);
        ensureWithinTimeout();
    };

    /**
     * 创建并记录当前波次的自动战斗。
     * @returns {void}
     */
    const startFight = () => {
        log.info("固若金汤开始自动战斗，当前波次: {wave}", currentWave);
        fight = createFight(strategyName);
    };

    /**
     * 进入指定波次，并按当前击杀数选择阈值路径或无条件路径。
     * @param {number} waveNumber - 新的逻辑波次编号。
     * @returns {Promise<boolean>} 是否执行了换位路径。
     */
    const enterWave = async waveNumber => {
        currentWave = waveNumber;
        const wave = parsed.waves.get(waveNumber);
        if (!wave) return false;
        const processed = new Set();
        processedByWave.set(waveNumber, processed);
        const kills = readKills();
        if (kills) maximumKills = maximumKills === null ? kills.current : Math.max(maximumKills, kills.current);
        const selected = selectReachedThreshold(wave, kills ? kills.current : null, processed);
        if (selected) {
            log.info("进入第 {wave} 波时累计击杀 {kills}，执行阈值 {threshold} 路径",
                waveNumber, kills.current, selected.threshold);
            await runPath(selected.path);
            return true;
        }
        if (wave.unconditionalPath) {
            processed.add(-1);
            log.info("进入第 {wave} 波，执行无条件路径", waveNumber);
            await runPath(wave.unconditionalPath);
            return true;
        }
        return false;
    };

    try {
        await enterWave(1);
        if (!fight) startFight();

        while (true) {
            ensureWithinTimeout();
            assertFightRunning(fight);

            if (hasCompletionText()) {
                await sleep(COMPLETION_CONFIRM_MS);
                if (hasCompletionText()) {
                    log.info("连续识别到委托完成，结束固若金汤步骤");
                    await stopFight(fight);
                    return true;
                }
            }

            const waveStatus = readWave();
            if (waveStatus && waveStatus.current > currentWave) {
                log.info("固若金汤波次更新: {old} -> {current}/{total}",
                    currentWave, waveStatus.current, waveStatus.total);
                await enterWave(waveStatus.current);
                ensureWithinTimeout();
                if (!fight) startFight();
                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            const killStatus = readKills();
            if (killStatus && (maximumKills === null || killStatus.current >= maximumKills)) {
                let accepted = killStatus;
                if (maximumKills !== null && killStatus.current - maximumKills > 1) {
                    await sleep(100);
                    const confirmed = readKills();
                    accepted = confirmed && confirmed.total === killStatus.total && confirmed.current >= killStatus.current
                        ? confirmed
                        : null;
                }
                if (accepted) {
                    maximumKills = accepted.current;
                    const wave = parsed.waves.get(currentWave);
                    const processed = processedByWave.get(currentWave) || new Set();
                    processedByWave.set(currentWave, processed);
                    const selected = selectReachedThreshold(wave, maximumKills, processed);
                    if (selected) {
                        log.info("第 {wave} 波累计击杀达到 {kills}，执行阈值 {threshold} 路径",
                            currentWave, maximumKills, selected.threshold);
                        await runPath(selected.path);
                        startFight();
                    }
                }
            }

            await sleep(POLL_INTERVAL_MS);
        }
    } finally {
        if (fight) {
            fight.state.intentionalCancel = true;
            try { fight.cts.Cancel(); } catch (_) { /* 已释放或已取消。 */ }
            disposeFight(fight);
        }
    }
}

export default defineStep({
    type: "固若金汤",
    category: "特定委托对策",
    dataSpec: {
        kind: "custom",
        editor: "waves",
        label: "波次配置",
        validate: data => {
            const result = parseImpregnableDefenseConfig(data);
            return result.ok
                ? { ok: true, value: data }
                : { ok: false, error: result.error };
        },
    },
    run: runImpregnableDefense,
});
