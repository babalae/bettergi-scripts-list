/**
 * 动作层：镜头标定、按键循环、前进、滚轮、放置与删除。
 *
 * 要调的东西基本都在两个地方：
 *   - 次数上限 / 等待时长 -> src/constants.js 的 DEFAULT_LIMITS、DEFAULT_TIMINGS
 *   - 按键本身           -> settings.json 的 creationKey / typeSwitchKey / moveForwardKey / interactKey
 * 本文件里的函数只负责"怎么按"，不负责"按几次"。
 */
import {
    CAMERA_PITCH_CLAMP_Y,
    DEFAULT_CAMERA,
    DEFAULT_CATEGORY,
    DEFAULT_LIMITS,
    PATHS,
    SCROLL_RATIO,
    TAB_CATEGORIES
} from "../constants.js";
import {
    getScreenSize,
    normalizeVirtualKey,
    readCheckbox,
    readDelay,
    readInteger,
    readSelect
} from "./config.js";
import {
    describeMatches,
    findFirstTemplate,
    findTargetFoodAdaptive,
    findTargetFoodBox,
    findTargetFoodMatches,
    findTemplate,
    findTemplateBox,
    targetFoodBaseThreshold,
    targetFoodPrimaryName,
    templateFileName
} from "./recognition.js";
import { errorText, screenPoint } from "../utils/common.js";
import { dbg } from "../utils/debuglog.js";
import { putDiag } from "../utils/diag.js";
import { grabProbe, probeSame, releaseProbe } from "../utils/frameprobe.js";
import { LINES, WHO, accident, notice, say } from "../utils/voice.js";

/**
 * 造物模式开关状态。
 * T 是造物模式的开关：第一次按进入、第二次按退出（用户据真实运行确认）。
 * 脚本里所有按 T 的动作（清场 / 进入造物 / 拆除）都必须共用这个状态，
 * 否则多按一次就会把刚进来的造物模式又切走，导致后续「按 3 选类型」找不到寄物装置。
 * 拆掉 / 放好装置都不会改变这个状态，只有按 T 才改变，所以这里记一笔就够。
 */
let creationModeOn = false;

/**
 * 仅供回归测试重置造物模式开关状态（每个用例开始前清干净，避免跨用例串状态）。
 * 正常运行不会调用。
 */
export function resetCreationModeState() {
    creationModeOn = false;
}

/**
 * 退出装置存储页后，游戏会离开造物模式（用户据真实运行确认：关闭装置页面即退出造物模式）。
 * 在此显式把状态标记为"已离开"，保证随后的 deleteDevice 会像正常启动一样按一次 T 重新进入，
 * 而不是误以为还在造物模式内、跳过去直接校验「拆除返还」（那样会因不在模式内而先失败再走恢复）。
 */
export function markOutOfCreation() {
    if (creationModeOn) {
        creationModeOn = false;
        dbg("[造物] 退出装置页面后已离开造物模式，删除前将重新进入");
    }
}

/**
 * 侦察锁定的结果。点击阶段**严格沿用**，绝不回退到基线重新爬阈值。
 *
 * 为什么必须锁死：真实日志里出现过这样一条链——
 *   侦察锁定 (1510,750) 阈值 0.94 → 开点后 0.94 命中 0 → 代码退回基线 0.85 重爬 → 0.88
 *   → 0.88 挡不住 (1371,750) 那个相似项 → 之后 35 次点击在两个位置间**完全交替**。
 * 那条"自适应阈值：基线 0.85 → 最终 0.88"就是跳点的直接来源：
 * 重新评估等于把侦察好不容易淘汰掉的相似项又放回了候选里。
 */
let lockedFoodThreshold = null;
/** 锁定位置（侦察那一帧的中心点）。开点后只认它附近的命中，远处的一律丢掉 */
let lockedFoodPos = null;

/**
 * 上一帧实际点击的位置。**只用于在"已识别到的多个命中"之间就近沿用，保持稳定**。
 *
 * 绝不用于跳过识别：目标料理可能不足 32 个、点几次就存完了——
 * 它一从列表里消失，列表就会上移，原来那个坐标会变成**别的料理**的图标，
 * 照坐标继续点就会把别的料理存进去。所以每次点击都必须重新识图，
 * 识别不到（料理已存完）就停止，而不是沿用旧坐标硬点。
 */
let lastFoodClick = null;

export const DELETE_MODE_IN_CREATION = "造物模式内删除（T → 校验 → 左键）";
export const DELETE_MODE_FROM_NORMAL = "普通状态删除（T → T → 校验 → 左键）";

function creationKey() {
    return normalizeVirtualKey(settings.creationKey, "VK_T");
}

function typeSwitchKey() {
    return normalizeVirtualKey(settings.typeSwitchKey, "VK_3");
}

function moveForwardKey() {
    return normalizeVirtualKey(settings.moveForwardKey, "VK_W");
}

function interactKey() {
    return normalizeVirtualKey(settings.interactKey, "VK_F");
}

export async function applyCamera() {
    const clampPasses = readInteger("cameraClampPasses", DEFAULT_CAMERA.clampPasses, 1, 20);
    const clampPassDelay = readDelay("cameraClampPassDelay");

    dbg(`[Camera] 固定垂直基准：向上推 ${clampPasses} 次，间隔 ${clampPassDelay}ms`);
    for (let pass = 0; pass < clampPasses; pass += 1) {
        moveMouseBy(0, CAMERA_PITCH_CLAMP_Y);
        if (pass + 1 < clampPasses) {
            await sleep(clampPassDelay);
        }
    }
    await sleep(readDelay("cameraClampSettleDelay"));

    const pitchFromTop = readInteger(
        "cameraPitchFromTop",
        DEFAULT_CAMERA.pitchFromTop,
        0,
        10000
    );
    if (pitchFromTop !== 0) {
        moveMouseBy(0, pitchFromTop);
    }
    dbg(`[Camera] 已从垂直上限向下 ${pitchFromTop}（水平朝向保持不变）`);
    await sleep(readDelay("cameraSettleDelay"));
}

/**
 * 反复按某个键，直到画面出现指定模板。
 * 先查后按：进入时若已满足条件则一次都不按。
 * 返回匹配结果；超过次数仍未出现则抛错。
 */
export async function pressKeyUntil(vk, templateKey, maxAttempts, delay, label) {
    const fileName = templateFileName(templateKey);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const before = findTemplate(templateKey);
        if (before) {
            dbg(`[${label}] 已出现「${fileName}」，一次都不用按`);
            return before;
        }

        // 每次按键都打一行会把日志刷爆（最多 12 行）→ 只记"按了几次才成"
        keyPress(vk);
        await sleep(delay);

        const after = findTemplate(templateKey);
        if (after) {
            say(WHO.fatui, `按了 ${attempt} 次才翻到寄物装置`);
            return after;
        }
    }

    throw new Error(`[${label}] 按 ${vk} ${maxAttempts} 次后仍未出现「${fileName}」`);
}

/**
 * 小碎步前进，直到画面出现指定模板（用于靠近造物）。
 */
export async function walkUntil(vk, templateKey, maxAttempts, hold, gap, label) {
    const fileName = templateFileName(templateKey);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const before = findTemplate(templateKey);
        if (before) {
            dbg(`[${label}] 已出现「${fileName}」，不用走`);
            return before;
        }

        // 每次前进都打一行 = 最多 40 行刷屏 → 走到之后由调用方说一句人话
        keyDown(vk);
        await sleep(hold);
        keyUp(vk);
        await sleep(gap);

        const after = findTemplate(templateKey);
        if (after) {
            dbg(`[${label}] 前进 ${attempt} 步后「${fileName}」出现`);
            return after;
        }
    }

    throw new Error(`[${label}] 前进 ${maxAttempts} 次后仍未出现「${fileName}」`);
}

async function runWheelMacro(delta, times) {
    const macro = {
        macroEvents: [],
        info: {
            name: "",
            description: "寄物装置脚本滚轮",
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            recordDpi: 1
        }
    };
    for (let i = 0; i < times; i += 1) {
        macro.macroEvents.push({ type: 6, mouseX: 0, mouseY: delta, time: i * 30 });
    }

    let usedRun = false;
    if (typeof keyMouseScript !== "undefined" && typeof keyMouseScript.run === "function") {
        try {
            await keyMouseScript.run(JSON.stringify(macro));
            usedRun = true;
        } catch (error) {
            notice(`滚轮宏 run 失败，回退 runFile：${errorText(error)}`);
        }
    }
    if (usedRun) {
        return true;
    }

    if (typeof keyMouseScript === "undefined" || typeof keyMouseScript.runFile !== "function") {
        throw new Error("当前 BetterGI 版本既没有 keyMouseScript.run() 也没有 runFile()，无法滚动");
    }
    await keyMouseScript.runFile(delta < 0 ? PATHS.wheelDown : PATHS.wheelUp);
    if (times > 1) {
        notice(`回退方案一次只能滚 120 单位，本次要滚 ${times} 格`);
    }
    return false;
}

export async function scrollOnce(screen) {
    const delta = readInteger("scrollDelta", DEFAULT_LIMITS.scrollDelta, -2000, 2000);
    const times = readInteger("scrollStepsPerTry", DEFAULT_LIMITS.scrollStepsPerTry, 1, 60);
    const point = screenPoint(SCROLL_RATIO, screen);

    // 翻页这件事由 findFoodWithScroll 用一句人话带过，这里不再单独刷一行
    dbg(`[Scroll] 滚动 ${delta} × ${times}（一次翻够，别只露半截图标）`);
    moveMouseTo(point.x, point.y);
    await sleep(50);
    await runWheelMacro(delta, times);
    // 一次滚 32 格的惯性比 1 格大得多，等它停稳再截图，否则会拍到还在晃的画面
    await sleep(readDelay("scrollSettleDelay"));
}

/** 左键点击；可选的先把光标移到画面中心，避免停在屏幕边缘点空 */
async function primaryClick(screen, centerFirst, label) {
    if (centerFirst) {
        const center = screenPoint({ x: 0.5, y: 0.5 }, screen);
        moveMouseTo(center.x, center.y);
        await sleep(50);
    }
    leftButtonClick();
}

export async function placeDevice(screen) {
    await primaryClick(screen, readCheckbox("placeAtCenterFirst", true), "Place");
    say(WHO.fatui, LINES.placed());
    await sleep(readDelay("afterPlaceDelay"));
}

export async function enterCreationMode() {
    const vk = creationKey();
    if (creationModeOn) {
        dbg("[Place] 已在造物模式（清场已进入），跳过重复按键，避免切出");
        return;
    }
    say(WHO.fatui, LINES.building());
    keyPress(vk);
    await sleep(readDelay("enterCreationDelay"));
    creationModeOn = true;
}

export async function selectTypeAndPlace(screen) {
    const maxAttempts = readInteger("typeSwitchMax", 12, 1, 60);
    await pressKeyUntil(
        typeSwitchKey(),
        "device",
        maxAttempts,
        readDelay("typeSwitchDelay"),
        "选类型"
    );
    await placeDevice(screen);
}

export async function approachDevice() {
    const maxAttempts = readInteger("moveMax", 40, 1, 200);
    await walkUntil(
        moveForwardKey(),
        "openDevice",
        maxAttempts,
        readDelay("moveStepHold"),
        readDelay("moveStepGap"),
        "靠近装置"
    );

    const vk = interactKey();
    say(WHO.fatui, LINES.openDevice());
    keyPress(vk);
    await sleep(readDelay("afterInteractDelay"));
}

/**
 * 等按钮"停下来"。
 * 弹窗刚冒出来的几百毫秒里按钮还在飘（缩放/位移动画），这时候照着刚截到的坐标点必然落空——
 * 「确认存取 → 确认 → 退出」这一串点空基本都栽在这。
 * 判据：相邻两次采样里，中心点位移都不超过 uiClickMaxDrift 像素。
 */
async function waitStableBox(templateKey, label) {
    const maxStable = readInteger("uiClickStableMax", DEFAULT_LIMITS.uiClickStableMax, 1, 30);
    const maxDrift = readInteger("uiClickMaxDrift", DEFAULT_LIMITS.uiClickMaxDrift, 0, 200);
    const settle = readDelay("uiClickSettleDelay");
    const fileName = templateFileName(templateKey);

    let prev = findTemplateBox(templateKey);
    if (!prev) {
        return null;
    }

    for (let i = 1; i < maxStable; i += 1) {
        await sleep(settle);
        const next = findTemplateBox(templateKey);
        if (!next) {
            // 又消失了，交给外层重新找
            return null;
        }
        const drift = Math.max(Math.abs(next.cx - prev.cx), Math.abs(next.cy - prev.cy));
        if (drift <= maxDrift) {
            // 停稳是常规状态，每帧都报会把日志刷爆 → 只进排障日志
            dbg(`[${label}] 「${fileName}」已停稳（位移 ${drift.toFixed(1)}px）`);
            return next;
        }
        dbg(`[${label}] 「${fileName}」仍在动（位移 ${drift.toFixed(1)}px），第 ${i}/${maxStable} 次等待`);
        prev = next;
    }

    // 一直没停稳 = 坐标可能偏。内部策略，结果不受影响 → 只落盘
    dbg(`[稳定] 「${fileName}」${maxStable} 次采样都在动，按最后一次位置点`);
    return prev;
}

/** 先移动光标再左键：比直接 result.click() 更容易让游戏响应 */
async function clickBox(box, label) {
    const x = Math.round(box.cx);
    const y = Math.round(box.cy);
    // 坐标是排障数据 → 只进排障日志，窗口不占版面
    dbg(`[${label}] 移动到 (${x},${y}) 并左键`);
    dbg(`[${label}] 落点 ${x},${y}`);
    moveMouseTo(x, y);
    await sleep(readDelay("uiClickMoveDelay"));
    leftButtonClick();
}

/**
 * 找一个 UI 按钮并点掉它。相比"找到就点"，多三道保险：
 *   1) 停稳等待：按钮位置不再漂移才点（弹窗动画期间点了会落空）
 *   2) 手动落点：moveMouseTo 到中心 + 延时 + 左键，比 result.click() 稳
 *   3) 点击校验：点完再看一眼，没生效就再点（最多 uiClickVerifyMax 次）
 *
 * options.waitFor    点了之后还要等这个模板出现（如「确认存取」→「确认」）
 * options.afterDelay 点完额外等待的设置项名（如 afterConfirmAccessDelay）
 */
export async function clickWithRetry(templateKey, label, options) {
    const opts = options || {};
    const maxRetry = readInteger("uiClickRetry", DEFAULT_LIMITS.uiClickRetry, 1, 60);
    const verifyMax = readInteger("uiClickVerifyMax", DEFAULT_LIMITS.uiClickVerifyMax, 1, 20);
    const verifyGone = opts.waitFor ? true : readCheckbox("uiClickVerifyGone", true);
    const poll = readDelay("pollInterval");
    const verifyDelay = readDelay("uiClickVerifyDelay");
    const fileName = templateFileName(templateKey);

    for (let attempt = 1; attempt <= maxRetry; attempt += 1) {
        const box = await waitStableBox(templateKey, label);
        if (!box) {
            // 每次都打一行 = 最多 10 行刷屏，且都是同一句 → 只在最后汇总一次
            await sleep(poll);
            continue;
        }

        await clickBox(box, label);

        // 点完先硬等一段：给弹窗切换留时间（确认存取 → 确认这一步尤其需要）
        if (opts.afterDelay) {
            await sleep(readDelay(opts.afterDelay));
        } else {
            await sleep(readDelay("uiClickDelay"));
        }

        if (!verifyGone && !opts.waitFor) {
            return true;
        }

        // 校验：等目标出现 / 等原按钮消失。命中是常态，正常情况一句话都不用打
        for (let v = 1; v <= verifyMax; v += 1) {
            if (opts.waitFor) {
                if (findTemplate(opts.waitFor)) {
                    dbg(`[${label}] 已出现「${templateFileName(opts.waitFor)}」，点击生效`);
                    return true;
                }
            } else if (!findTemplate(templateKey)) {
                dbg(`[${label}] 「${fileName}」已消失，点击生效`);
                return true;
            }

            const again = await waitStableBox(templateKey, label);
            if (!again) {
                dbg(`[${label}] 第 ${v} 次校验：「${fileName}」找不到了，但预期结果未出现，交给下一步轮询`);
                break;
            }
            dbg(`[${label}] 第 ${v}/${verifyMax} 次校验未生效，重新点击「${fileName}」`);
            await clickBox(again, label);
            await sleep(verifyDelay);
        }

        // 校验不出结果不硬抛——下一步本来就会再轮询一次自己的按钮，继续走比卡死好
        notice(`「${fileName}」${verifyMax} 次校验后仍无法确认是否点中，按已点击继续`);
        return true;
    }

    const why = `等了 ${maxRetry} 次也没等到「${fileName}」`;
    accident(why);
    throw new Error(why);
}

/**
 * 连拍几帧，把候选合并成一张表。
 *
 * 同一位置（容差内）只留一条，记两件事：
 *   - score  ：**跨帧最高分**（某一帧被光标/动画压住会拉低分数，取最高最能代表它"到底像不像"）
 *   - frames ：这几帧里它**出现了几帧**（真目标应该帧帧都在；边缘抖动项会时有时无）
 *
 * 鼠标在这期间一动不动，所以拍到的是同一幅画面，可比性最好。
 */
async function shootCandidates(th, shots, tol, delay, label) {
    const map = new Map();
    for (let i = 0; i < shots; i += 1) {
        if (i > 0 && delay > 0) {
            await sleep(delay);
        }
        for (const m of findTargetFoodMatches(th)) {
            const key = `${Math.round(m.cx / tol)},${Math.round(m.cy / tol)}`;
            const cur = map.get(key);
            if (!cur) {
                map.set(key, { box: m, score: m.score, frames: 1 });
            } else {
                cur.frames += 1;
                if (m.score > cur.score) {
                    cur.box = m;
                    cur.score = m.score;
                }
            }
        }
    }

    // 出现帧数多的优先；并列取跨帧最高分；再并列按位置确定性排序
    const list = [...map.values()].sort((a, b) =>
        (b.frames - a.frames)
        || (b.score - a.score)
        || (a.box.cy - b.box.cy)
        || (a.box.cx - b.box.cx));

    // 每一档都攒进《诊断报告》的 ①（平时不打印，需要时随报告一次给出）
    putDiag("recon", [
        `阈值 ${th.toFixed(2)}｜连拍 ${shots} 帧｜候选 ${list.length} 个｜${describeCandidates(list)}`
    ]);
    return list;
}

/** 诊断用：把连拍合并后的候选打成一串（位置 + 最高分 + 出现帧数） */
function describeCandidates(list) {
    if (!list || list.length === 0) {
        return "无命中";
    }
    return list
        .slice()
        .sort((a, b) => (a.box.cy - b.box.cy) || (a.box.cx - b.box.cx))
        .map((c) => `(${c.box.cx.toFixed(0)},${c.box.cy.toFixed(0)})分${c.score.toFixed(2)}×${c.frames}帧`)
        .join("  ");
}

/**
 * 侦察锁定：点击之前先弄清楚"到底哪个才是真目标"，**这一步一次都不点**。
 *
 * 做法是**不动鼠标连拍几帧**（`foodReconShots`，默认 3）再综合判断，而不是拍一张就下结论：
 *   1) 同一位置跨帧取**最高分**（某一帧被光标/动画压住会拉低分数，最高分才代表它"像不像"）
 *   2) 记下它**出现了几帧**——真目标应该帧帧都在，卡在阈值边缘的相似项会时有时无
 *   3) 还有 2 个以上候选 → 逐级抬阈值，每档重新连拍，直到只剩 1 个
 *   4) 再抬一档留余量，然后要求"每一帧都在"才算锁住
 *
 * 为什么要"认了就不再反复识别"（见 clickFoodUntilFull）：
 *   物品一旦被点击就会变成**选中态**，外观变了，之后**根本认不出来**。
 *   以前"每次点击都重新识图"在两个相似项之间反复横跳，根子就在这儿——
 *   点 A → A 变选中态认不出 → 只能认到 B → 点 B → B 变选中态、A 取消选中 → 又认到 A …
 *
 * 返回 { box, threshold, base, stable, matchCount }；一个都没识别到时 box 为 null。
 */
export async function reconFoodTarget(label) {
    const step = readInteger("adaptiveThresholdStep", 3, 1, 20) / 100;
    const max = readInteger("adaptiveThresholdMax", 95, 70, 100) / 100;
    const shots = readInteger("foodReconShots", DEFAULT_LIMITS.foodReconShots, 1, 10);
    const shotDelay = readInteger("foodReconShotDelay", DEFAULT_LIMITS.foodReconShotDelay, 0, 2000);
    const tol = readInteger("foodReconfirmTol", DEFAULT_LIMITS.foodReconfirmTol, 1, 100);
    const base = targetFoodBaseThreshold();
    const name = targetFoodPrimaryName();

    // ① 基线阈值下连拍：同一位置取跨帧最高分，并记下出现了几帧
    let th = base;
    let cands = await shootCandidates(th, shots, tol, shotDelay, label);
    if (cands.length === 0) {
        return { box: null, threshold: th, base, stable: false, matchCount: 0 };
    }

    // ② 还有 2 个以上候选 → 逐级抬阈值，每档都重新连拍，直到只剩 1 个
    let tries = 0;
    while (cands.length >= 2 && th + step <= max && tries < 30) {
        const next = await shootCandidates(th + step, shots, tol, shotDelay, label);
        tries += 1;
        if (next.length === 0) {
            break; // 抬过头一个都不剩 → 保持上一个还能用的阈值
        }
        th += step;
        cands = next;
        // 阈值卡在边缘是"会误存"的信号，必须留档 → 完整候选表只进排障日志，
        // 窗口里一句话带过：数量 / 坐标那类数据串不占版面。
        //
        // 【注意：日志打在"抬完之后"，所以这里看到的是抬完还剩几个】
        //   next.length >= 2 → 还没收敛，"长得像的还挺多"才成立；
        //   next.length === 1 → **已经收敛了**，再喊"长得像的还挺多"就是误导。
        dbg(`[${label}] 复核不稳定（连拍 ${shots} 帧仍有 ${cands.length} 个候选），阈值 ${(th - step).toFixed(2)} → ${th.toFixed(2)}｜${describeCandidates(cands)}`);
        if (next.length >= 2) {
            say(WHO.fatui, LINES.alike());
        }
    }

    // ③ 只抬到"刚好淘汰第二名"不够：被淘汰的那个分数就卡在边缘上，
    //    每帧细微差异会让它一会儿过线一会儿不过。再抬一档留余量（抬完没命中就退回）。
    if (cands.length >= 1 && th + step <= max) {
        const retry = await shootCandidates(th + step, shots, tol, shotDelay, label);
        if (retry.length >= 1) {
            th += step;
            cands = retry;
        }
    }

    // ④ 稳定判据：真目标必须**每一帧都在**
    const top = cands[0];
    const stable = top.frames >= shots;
    if (!stable) {
        // 完整数据串（阈值/坐标/帧数）只进排障日志；窗口里只留一句值得看的话
        notice(`「${name}」${shots} 次复核未取得一致结果（最好那个只出现 ${top.frames}/${shots} 帧），按它继续`);
        dbg(`[${label}] 未稳定：阈值 ${th.toFixed(2)}｜(${top.box.cx.toFixed(0)},${top.box.cy.toFixed(0)})｜${top.frames}/${shots} 帧`);
    }
    putDiag("recon", [
        `最终锁定：(${top.box.cx.toFixed(0)},${top.box.cy.toFixed(0)})｜阈值 ${th.toFixed(2)}（基线 ${base.toFixed(2)}）｜${stable ? `每一帧都在（${top.frames}/${shots}，稳定）` : `只出现 ${top.frames}/${shots} 帧（不稳定）`}`
    ]);
    return { box: top.box, threshold: th, base, stable, matchCount: cands.length };
}

/** 从这一帧的命中里挑离 (x,y) 最近的一个（列表滑动时用来跟住同一个图标） */
function nearestBox(matches, x, y) {
    if (!matches || matches.length === 0) {
        return null;
    }
    const dist = (m) => Math.max(Math.abs(m.cx - x), Math.abs(m.cy - y));
    return matches.slice().sort((a, b) => dist(a) - dist(b))[0];
}

/**
 * 等列表**真的停下**再开点，并把"停稳后的最终位置"返回。
 *
 * 为什么要这一步（真实日志："点击的过程中，还是在重复向下滚动"）：
 *   一次连发 32 格滚轮，游戏那边是**平滑滚动动画**——事件发完了画面还在滑。
 *   这时候照刚锁定的坐标点下去，点到的就是正从光标底下划过的**别的物品**。
 *   判据：连续采样目标框位置，位移都不超过 scrollStillDrift 像素、且连续够 scrollStillHits 次。
 *
 * 返回最终位置 { x, y }（列表滑动过就用滑停后的位置，绝不用旧坐标）。
 */
async function waitListStill(recon, label) {
    const maxSamples = readInteger("scrollStillMax", DEFAULT_LIMITS.scrollStillMax, 1, 30);
    const needHits = readInteger("scrollStillHits", DEFAULT_LIMITS.scrollStillHits, 1, 10);
    const driftMax = readInteger("scrollStillDrift", DEFAULT_LIMITS.scrollStillDrift, 0, 50);
    const delay = readDelay("scrollStillDelay");

    let prev = { x: recon.box.cx, y: recon.box.cy };
    let hits = 0;

    for (let i = 1; i <= maxSamples; i += 1) {
        await sleep(delay);
        const now = nearestBox(findTargetFoodMatches(recon.threshold), prev.x, prev.y);
        if (!now) {
            // 认不到了：可能是滑出视野或已变选中态，别再空等
            dbg(`[${label}] 第 ${i} 次采样已认不到目标，按上一次位置继续`);
            break;
        }
        const drift = Math.max(Math.abs(now.cx - prev.x), Math.abs(now.cy - prev.y));
        prev = { x: now.cx, y: now.cy };
        if (drift <= driftMax) {
            hits += 1;
            if (hits >= needHits) {
                return prev;
            }
        } else {
            hits = 0;
        }
    }

    // 到采样上限还在动：只能按最后一次位置点。内部策略 → 只落盘
    if (maxSamples > 0) {
        dbg(`[Scroll] 列表未停稳：采样 ${maxSamples} 次仍在动，按最后一次位置继续 ${prev.x.toFixed(0)},${prev.y.toFixed(0)}`);
    }
    return prev;
}

/**
 * 在列表里找目标物品：**滚一次 → 截图判断在不在 → 不在再滚一次**，直到找到。
 *
 * 找到之后不急着返回：先等列表**停稳**（见 waitListStill），
 * 再把"停稳后的位置"作为锁定点交出去 —— 之后认数量、开点都用它。
 * 返回 { box, threshold, base, stable, matchCount }；
 *
 * 【两条收工条件】
 *   1. 滚满 scrollMax（50 次）还找不到 → 抛错（老行为，兜底）；
 *   2. **列表拉不动了** → 立刻抛错，不再白滚剩下的次数（见 utils/frameprobe.js）：
 *      每次翻页前拍一张右侧长条跟上一张比像素，连续 scrollBottomHits（3）次没变
 *      就说明到底了 —— 这件货根本不在这一栏，再滚也是空转。
 */
export async function findFoodWithScroll(screen) {
    const maxScroll = readInteger("scrollMax", DEFAULT_LIMITS.scrollMax, 0, 200);
    const bottomHits = readInteger("scrollBottomHits", DEFAULT_LIMITS.scrollBottomHits, 1, 20);
    const name = targetFoodPrimaryName();
    let prevProbe = null;
    let sameStreak = 0;

    for (let attempt = 0; attempt <= maxScroll; attempt += 1) {
        // 先把光标挪开再截图：压在图标上会被截进画面 / 触发悬停高亮，分数会失真
        await parkMouse(screen);
        const recon = await reconFoodTarget("侦察");

        if (recon.box) {
            // 找到 → 先等列表停稳，再交出锁定点（认数量、连点都以它为准）
            const still = await waitListStill(recon, "侦察");
            if (still.x !== recon.box.cx || still.y !== recon.box.cy) {
                // 位置变过说明列表还在滑。脚本自己会等停稳后重取，不构成问题 → 只落盘
                dbg(`[Scroll] 列表还在滑，已等它停稳：(${Math.round(recon.box.cx)},${Math.round(recon.box.cy)}) → (${Math.round(still.x)},${Math.round(still.y)})`);
                recon.box = nearestBox(findTargetFoodMatches(recon.threshold), still.x, still.y) || recon.box;
            }
            // 锁定坐标是排障数据，只进 debug 文件，日志窗口不占版面
            dbg(`[Food] 锁定「${name}」于 (${Math.round(recon.box.cx)},${Math.round(recon.box.cy)})｜阈值 ${recon.threshold.toFixed(2)}｜候选 ${recon.matchCount} 个`);
            say(WHO.fatui, LINES.found());
            return recon;
        }

        if (attempt === maxScroll) {
            break;
        }

        // ---- 到底检测：翻页前先拍一张，跟上一张比 ----
        // 拿不到帧（老版本 BGI / 抓帧失败）时 probeSame 一律返回 false = "变了"，
        // 于是退回原来的"滚满 50 次"行为，不会误判成到底。
        const probe = grabProbe(screen);
        if (prevProbe && probeSame(prevProbe, probe)) {
            sameStreak += 1;
            dbg(`[Scroll] 第 ${attempt} 次翻页画面没变（连续 ${sameStreak}/${bottomHits}）`);
            if (sameStreak >= bottomHits) {
                releaseProbe(prevProbe);
                releaseProbe(probe);
                say(WHO.fatui, LINES.listBottom());
                throw new Error(`「${name}」没找到：列表已拉到底（连续 ${sameStreak} 次翻页画面无变化）`);
            }
        } else {
            sameStreak = 0;
        }
        releaseProbe(prevProbe);
        prevProbe = probe;

        say(WHO.fatui, LINES.pageMiss(attempt + 1));
        await scrollOnce(screen);
    }

    releaseProbe(prevProbe);
    throw new Error(`滚动 ${maxScroll} 次后仍未找到「${name}」`);
}

/**
 * 点一次目标料理：用自适应阈值（见 recognition.findAdaptive）找，
 * 若同一张图在屏幕上匹配到 2 个位置，会逐步抬高阈值直到只剩 1 个，再点那一个。
 * 记录最终点击坐标，方便排查"点到第二个相似项"的问题。返回是否成功点到了。
 */
/**
 * 从本次识别到的多个命中里挑一个点：
 *   1) 优先沿用"上一帧点击位置附近"的命中 —— 保持点同一个图标，不左右跳；
 *   2) 附近没有（图标挪位了/第一次点）则按"最靠上"确定性地选一个。
 * 前提是这些命中都是**本次重新识别**出来的，所以点到的一定还是目标料理本身。
 */
function pickFoodTarget(matches, label, primaryName) {
    if (matches.length === 1) {
        return matches[0];
    }

    // 1) 优先沿用"上一帧点的那个图标"——锁定同一个目标，不左右跳。
    //    这里做的是"取距离最近的命中"，所以哪怕某帧列表轻微位移也能跟住。
    if (lastFoodClick) {
        const near = readInteger("foodClickNearPx", DEFAULT_LIMITS.foodClickNearPx, 0, 400);
        const dist = (m) => Math.max(Math.abs(m.cx - lastFoodClick.x), Math.abs(m.cy - lastFoodClick.y));
        const byDist = matches.slice().sort((a, b) => dist(a) - dist(b));
        if (dist(byDist[0]) <= near) {
            // 命中几个、落在哪个坐标 = 排障数据，正常情况不该占版面
            dbg(`[${label}] 「${primaryName}」命中 ${matches.length} 个，沿用上一帧那个（${byDist[0].cx.toFixed(0)},${byDist[0].cy.toFixed(0)}）`);
            return byDist[0];
        }
    }

    // 2) 没有上一帧、或附近确实没有 → 取**分数最高**的那个。
    //    原来是"取最靠上"，但同一样式的两个图标上下位置几乎一样，排序结果不稳定；
    //    分数由图像决定，是确定性的，真目标也比相似项高。
    const byScore = matches.slice().sort((a, b) => (b.score - a.score) || (a.cy - b.cy) || (a.cx - b.cx));
    dbg(`[${label}] 「${primaryName}」命中 ${matches.length} 个且不在上次位置附近，取分数最高的那个（${byScore[0].cx.toFixed(0)},${byScore[0].cy.toFixed(0)}，分数 ${byScore[0].score.toFixed(2)}）`);
    dbg(`[${label}] 多命中取最高分：${describeMatches(matches)}`);
    return byScore[0];
}

/**
 * 每次识图前把光标挪到"空地"（park）。
 *
 * 每一次点击都必须重新识图，但截图那一刻鼠标**还压在刚点过的那个图标上**：
 * 光标被画进画面 / 悬停高亮都会改掉那个图标的像素，于是它这一帧的匹配分数掉下来，
 * 命中集合就在"1 个 / 2 个"之间抖 —— 真实日志里 (1371,750) ↔ (1510,750) 连着 35 次
 * 左右横跳，抖到相似项上就是**误存**。所以识图前先把光标挪走，让它别挡路。
 */
function parkPoint(screen) {
    const px = readInteger("foodParkXPercent", DEFAULT_LIMITS.foodParkXPercent, 0, 100);
    const py = readInteger("foodParkYPercent", DEFAULT_LIMITS.foodParkYPercent, 0, 100);
    const size = screen || currentScreen();
    return {
        x: Math.round(size.width * px / 100),
        y: Math.round(size.height * py / 100)
    };
}

async function parkMouse(screen) {
    if (!readCheckbox("foodParkMouse", true)) {
        return null;
    }
    const p = parkPoint(screen);
    moveMouseTo(p.x, p.y);
    await sleep(readDelay("foodParkDelay"));
    return p;
}

/** 被"锁定半径"过滤掉的命中次数（一轮一统计，避免刷屏） */
let lockFilteredCount = 0;

/**
 * 只保留"锁定位置附近"的命中。没有锁定位置时原样返回。
 *
 * 这一条根治跳点：哪怕阈值降回来让「奇怪的XX」重新进了候选，它离锁定位置远，
 * 也会被直接丢掉 —— 宁可少存，也绝不点到一个别的物品上去。
 */
function keepNearLock(matches, label) {
    if (!lockedFoodPos || !matches || matches.length === 0) {
        return matches;
    }
    const radius = readInteger("foodLockRadius", DEFAULT_LIMITS.foodLockRadius, 0, 500);
    if (radius <= 0) {
        return matches;
    }

    const near = matches.filter((m) => Math.max(
        Math.abs(m.cx - lockedFoodPos.x),
        Math.abs(m.cy - lockedFoodPos.y)
    ) <= radius);

    if (near.length < matches.length) {
        lockFilteredCount += 1;
        // 【这行不再进日志窗口】15:19 实跑证明它是**误导性告警**：
        // 目标只是"挪位了"（点页签让列表重渲染 + 滚回顶部），脚本后面按全屏唯一命中
        // 正确处理了，可窗口里先弹一句"相似项混进候选" —— 看着像要出事，其实没事。
        // 真正的"认不到"由 relocateAfterReset 自己报，报的那句才带得上进度（第 N/M 次后）。
        dbg(`[${label}] 丢弃 ${matches.length - near.length} 个锁定点以外的命中（${describeMatches(matches)}）｜锁定点 (${lockedFoodPos.x},${lockedFoodPos.y})±${radius}px`);
    }
    return near;
}

/**
 * 点击阶段按"锁定"找回目标。**绝不从基线往上重新爬阈值**——重新评估正是跳点的来源。
 *   ① 锁定阈值直接认一次
 *   ② 没认到 → 等一下再认一次（刚点过的图标可能还没从悬停/光标遮挡里恢复）
 *   ③ 还不行 → 只沿锁定阈值**往下**逐级降档，每档都只收"锁定位置附近"的命中，
 *      下限是基线（不会低到把随便什么东西都认进来）
 *   ④ 全都没有 → 返回 null（目标多半已存完或消失，交给上层停止）
 */
async function acquireFromLock(label, primaryName) {
    const step = readInteger("adaptiveThresholdStep", 3, 1, 20) / 100;
    const base = targetFoodBaseThreshold();
    const th0 = lockedFoodThreshold;

    // ①
    let near = keepNearLock(findTargetFoodMatches(th0), label);
    if (near.length > 0) {
        return { matches: near, threshold: th0 };
    }

    // ②
    await sleep(readDelay("foodParkDelay"));
    near = keepNearLock(findTargetFoodMatches(th0), label);
    if (near.length > 0) {
        return { matches: near, threshold: th0 };
    }

    // ③
    for (let th = th0 - step; th >= base - 1e-6; th -= step) {
        const retry = keepNearLock(findTargetFoodMatches(th), label);
        if (retry.length > 0) {
            dbg(`[${label}] 「${primaryName}」在锁定阈值 ${th0.toFixed(2)} 下没命中，降到 ${th.toFixed(2)} 重新认到（位置仍在锁定点附近）`);
            return { matches: retry, threshold: th };
        }
    }
    return null;
}

/**
 * 复核"锁定点还在不在"（**不点击**）。只在 clickFoodUntilFull 的软复核里用。
 * 认不到**不等于**存完了：物品被点一下就变选中态，本来就认不出来。
 */
async function lockStillThere(label, screen) {
    await parkMouse(screen);
    const got = await acquireFromLock(label, targetFoodPrimaryName());
    if (got) {
        lockedFoodThreshold = got.threshold;
        return true;
    }
    return false;
}

/** 照锁定位置点一下，**不重新识图**（理由见 clickFoodUntilFull） */
async function clickAtLock(label) {
    const x = lockedFoodPos.x;
    const y = lockedFoodPos.y;
    moveMouseTo(x, y);
    await sleep(readDelay("uiClickMoveDelay"));
    leftButtonClick();
    lastFoodClick = { x, y };
    return true;
}

async function clickTargetFoodOnce(label, screen) {
    const primaryName = targetFoodPrimaryName();

    // 每次都重新识图，绝不复用上一次的坐标。
    // 原因：目标料理可能不足 32 个，点几次就存完了——它一从列表消失，列表就会上移，
    // 原来那个坐标会变成**别的料理**的图标；照旧坐标继续点就会把别的料理存进去。
    // 所以识别不到（已存完 / 数量不足）就返回 false，让上层停止点击。
    // 识图前先把光标挪开：光标压在图标上会被截进画面 / 触发悬停高亮，
    // 下一帧那个图标反而匹配不上（真实日志里连着 35 次左右横跳就是这么来的）。
    await parkMouse(screen);

    let matches = null;
    let threshold = null;

    if (lockedFoodThreshold != null) {
        // 侦察已经把阈值和位置定死了，这里严格沿用：
        // 一旦退回"从基线重新爬"，被淘汰掉的相似项就会被放回候选 → 左右跳点。
        const got = await acquireFromLock(label, primaryName);
        if (got) {
            matches = got.matches;
            threshold = got.threshold;
            // 降档认到之后把锁定阈值一并更新，下次直接用，省得每帧重新降
            lockedFoodThreshold = got.threshold;
        }
    } else {
        // 只有在没有侦察结果时才做自适应评估（从基线往上抬到只剩一个）
        const res = findTargetFoodAdaptive();
        matches = res.matches;
        threshold = res.threshold;
        lockedFoodThreshold = threshold;
        if (threshold > res.base + 1e-6) {
            dbg(`[${label}] 自适应阈值：基线 ${res.base.toFixed(2)} → 最终 ${threshold.toFixed(2)}，命中 ${matches.length} 个`);
        }
    }

    if (!matches || matches.length === 0) {
        // 认不到 = 停止信号（多半已存完），这是**值得看**的：宁可少存也绝不误点别的物品
        if (lockedFoodPos) {
            notice(`「${primaryName}」在锁定位置附近认不到了（阈值降到基线仍无命中）；多半已存完，停止点击`);
            dbg(`[${label}] 认不到：锁定点 (${lockedFoodPos.x},${lockedFoodPos.y})｜基线 ${targetFoodBaseThreshold().toFixed(2)}`);
        } else {
            notice(`未匹配到「${primaryName}」（阈值 ${(threshold == null ? targetFoodBaseThreshold() : threshold).toFixed(2)} 仍 0 个）；可能已存完或数量不足，停止点击`);
        }
        return false;
    }

    const chosen = pickFoodTarget(matches, label, primaryName);
    const x = Math.round(chosen.cx);
    const y = Math.round(chosen.cy);

    // 位置**变了**才值得记（那意味着目标挪位了/换了一个图标）——但也只是排障数据
    const moved = !lastFoodClick || lastFoodClick.x !== x || lastFoodClick.y !== y;
    if (moved) {
        dbg(`[${label}] 「${primaryName}」锁定位置 (${x},${y})${lastFoodClick ? `（原 ${lastFoodClick.x},${lastFoodClick.y}）` : ""}`);
    }
    lastFoodClick = { x, y };

    moveMouseTo(x, y);
    await sleep(readDelay("uiClickMoveDelay"));
    leftButtonClick();
    return true;
}

/**
 * 【静默】点一次分类页签 —— 目的是**清掉选中态**，不是切分类。
 *
 * 为什么需要这一步（2026-09-26 实跑观察到的真机制）：
 *   物品被点一下就变**选中态**（高亮），外观变了，模板匹配就认不出来了。
 *   而点页签会让列表重新渲染，选中态随之消失 —— 图标恢复原样，于是又能认出来了。
 *   这一步把"选中态认不出"这个死结解开：**不是不能重新识图，而是得先把它清掉**。
 *
 * 为什么静默：一轮要点几十次，每次都打"翻到XX这一栏"会把日志刷爆，
 * 而且它根本不是在翻页，只是在复位。所以一句 info 都不打。
 */
async function resetSelectionTab(category) {
    const keys = TAB_CATEGORIES[category] || TAB_CATEGORIES[DEFAULT_CATEGORY];
    const hit = findFirstTemplate(keys);
    if (!hit) {
        throw new Error(`找不到分类页签「${keys.map((k) => templateFileName(k)).join(" / ")}」，无法清掉选中态`);
    }
    dbg(`[页签] 复位：点击「${templateFileName(hit.key)}」清掉选中态`);
    hit.result.click();
    await sleep(readDelay("uiClickDelay"));
}

/**
 * 锁定半径内认不到时，按**锁定阈值全屏**再找一次，判断目标是不是"挪远了"。
 *
 * 为什么敢这么认：锁定阈值是侦察阶段为了**把相似项甩掉**抬上去的
 *（真目标 1.00 / 「奇怪的XX」0.90 那种，阈值会抬到 0.91 以上），
 * 所以能在锁定阈值下命中的，基本就是真目标本人。
 *
 * @returns {{matches: Array, threshold: number}|null} 唯一命中 → 判定为挪位；否则 null
 */
function findMovedTarget(label) {
    const th = lockedFoodThreshold != null ? lockedFoodThreshold : targetFoodBaseThreshold();
    const loose = findTargetFoodMatches(th) || [];

    if (loose.length !== 1) {
        // 0 = 不在画面里了（存完 / 滚出视野）；≥2 = 分不清，绝不挑一个乱点
        dbg(`[${label}] 锁定半径内没有 → 按锁定阈值 ${th.toFixed(2)} 全屏认到 ${loose.length} 个 → 判定为认不到`);
        return null;
    }

    dbg(`[${label}] 锁定半径内没有，但全屏唯一命中 → 判定为挪位：(${lockedFoodPos.x},${lockedFoodPos.y}) → (${Math.round(loose[0].cx)},${Math.round(loose[0].cy)})`);
    return { matches: loose, threshold: th };
}

/**
 * 点完一次之后，重新确认目标还在不在原来的位置。
 *
 * 流程：**点页签清选中态 → 鼠标挪开 → 重新识图 → 比对位置**。
 *
 * 为什么要这么绕（用户实跑看到的现象）：
 *   第 1 下点对了，第 2 下点到了它下面的物品，第 3 下点到了再下面一个 ——
 *   说明**列表在两次点击之间挪了位**，锁定坐标已经对应到别的物品了。
 *   之前"照锁定点一路点完"的做法，等于给一排不同的物品各点了一下。
 *
 * 【关键：认不到 ≠ 没了 —— 得分清"挪远了"和"真没了"】
 *   点页签会让列表**重渲染**，实测还会把滚动位置带回顶部：目标整块挪到画面别处去了。
 *   这时候 `acquireFromLock` 只认锁定半径（`foodLockRadius` 60px）内的命中，
 *   于是"挪远了"会被当成"认不到" → 上层直接停手（真实日志里第 1/32 次就停了）。
 *   所以半径内没有时，要**按锁定阈值全屏再找一次**：
 *     唯一命中 → 那就是挪位后的目标（锁定阈值本来就只放真目标过），搬过去继续点；
 *     0 个     → 真不在画面里了（多半存完 / 滚出视野）→ 交上层停止；
 *     ≥2 个    → 分不清，宁可停（绝不挑一个乱点）。
 *
 * @returns {boolean|null} true  = 位置变了（已更新锁定点）
 *                         false = 位置没变（可以放心照这个点）
 *                         null  = 认不到了（多半已存完，交给上层停止）
 */
async function relocateAfterReset(category, screen, label) {
    const name = targetFoodPrimaryName();
    const tol = readInteger("foodRelocateTol", DEFAULT_LIMITS.foodRelocateTol, 0, 200);

    await resetSelectionTab(category);
    await parkMouse(screen);

    let got = await acquireFromLock(label, name);
    if (!got) {
        got = findMovedTarget(label);
        if (!got) {
            return null;
        }
    }

    const next = pickFoodTarget(got.matches, label, name);
    const nx = Math.round(next.cx);
    const ny = Math.round(next.cy);
    const old = lockedFoodPos;
    lockedFoodThreshold = got.threshold;

    const drift = Math.max(Math.abs(nx - old.x), Math.abs(ny - old.y));
    if (drift <= tol) {
        // 位置没变 → 一次就够，之后照这个点完
        dbg(`[${label}] 位置没变（${nx},${ny}），可以照着点完`);
        return false;
    }

    // 挪了 → 锁定点跟着走（坐标只进排障文件，窗口不占版面）
    dbg(`[${label}] 目标挪位：(${old.x},${old.y}) → (${nx},${ny})，位移 ${drift}px`);
    lockedFoodPos = { x: nx, y: ny };
    lastFoodClick = { x: nx, y: ny };
    say(WHO.fatui, LINES.shifted());
    return true;
}

/**
 * 连点目标物品，直到：点满识别到的数量 / 出现容量已满 / 达到上限。
 *
 * 【点击策略：点一次 → 清选中态 → 重新定位，确认不动了再一路点完】
 *
 *   背景（两版策略的来龙去脉，别再改回去）：
 *   - v0.9：发现"物品被点一下就变选中态、外观变了认不出来"，于是改成
 *     **认了就认了，照锁定坐标一路点完，不再重新识图**。
 *   - v0.10.3 实跑打脸：第 1 下点对了，第 2 下点到它下面的物品，第 3 下点再下面一个。
 *     说明**列表在两次点击之间会挪位**，锁定坐标会逐渐对应到别的物品 ——
 *     "照坐标连点"的前提（列表不动）根本不成立。
 *
 *   现在两步都做对：
 *     ① 每次点完 → 点页签清掉选中态 → 重新识图拿到新位置；
 *     ② 位置没变（≤ foodRelocateTol）→ **一次就认定稳定**，剩下的次数照这个点完；
 *        位置变了 → 更新锁定点继续校验；**连续 foodUnstableStop 次都在变 → 报错停手**。
 *
 * 【停止仍然靠数量】
 *   点 1 次 = 存入 1 个，所以点击上限 = min(识别到的数量 N, 容量 32)。
 *   认不到数量时按 32 次，靠「容量已满」提前停（会明确告警）。
 *
 * @param {number|null} foodCount 本轮开头识别到的剩余数量
 * @param {object} recon          侦察锁定的结果
 * @param {object} screen         屏幕尺寸
 * @param {string} category       料理 / 材料（点页签复位时要用）
 */
export async function clickFoodUntilFull(foodCount, recon, screen, category) {
    const capacity = DEFAULT_LIMITS.capacityLimit;
    // 0 也是有效数量：认到 0 就一个都不点（少点没事，多点才有事）
    const counted = Number.isFinite(foodCount) && foodCount >= 0;
    // 点 1 次 = 存入 1 个，所以点 min(N, 容量上限) 次就够
    const limit = counted ? Math.min(Math.round(foodCount), capacity) : capacity;
    const interval = readDelay("foodClickInterval");
    const checkEvery = readInteger("capacityCheckEvery", DEFAULT_LIMITS.capacityCheckEvery, 1, 10);
    let clicked = 0;
    let full = false;
    let stoppedByCount = false;
    let stoppedByMiss = false;

    // 侦察阶段已经把阈值和位置定下来了，这里**严格沿用**：
    // 开点后再重新评估阈值，等于把被淘汰的相似项放回候选 —— 那就是左右跳点的来源。
    lockedFoodThreshold = (recon && recon.threshold != null) ? recon.threshold : null;
    lockedFoodPos = (recon && recon.box)
        ? { x: Math.round(recon.box.cx), y: Math.round(recon.box.cy) }
        : null;
    lastFoodClick = lockedFoodPos ? { x: lockedFoodPos.x, y: lockedFoodPos.y } : null;
    lockFilteredCount = 0;

    // 软复核：默认关（0 = 不复核）。开了也只是"连续认不到 N 次才停"，
    // 因为**认不到不代表存完了**——物品被点过就变选中态，本来就认不出来。
    const reverifyEvery = readInteger("foodReverifyEvery", DEFAULT_LIMITS.foodReverifyEvery, 0, 100);
    const missStop = readInteger("foodMissStop", DEFAULT_LIMITS.foodMissStop, 1, 20);
    let missStreak = 0;

    if (lockedFoodPos) {
        const radius = readInteger("foodLockRadius", DEFAULT_LIMITS.foodLockRadius, 0, 500);
        say(WHO.fatui, LINES.selecting());
        dbg(`[Food] 锁定点 ${lockedFoodPos.x},${lockedFoodPos.y}｜阈值 ${lockedFoodThreshold.toFixed(2)}｜点击上限 ${limit}`);
        if (reverifyEvery > 0) {
            dbg(`[Food] 每 ${reverifyEvery} 次复核一次锁定点，连续 ${missStop} 次认不到才停`);
        } else if (radius > 0) {
            dbg(`[Food] 锁定半径 ${radius}px（只认锁定点附近的命中，远处的相似项一律丢掉）`);
        }
    }

    if (counted) {
        const raw = Math.round(foodCount);
        if (raw <= 0) {
            say(WHO.fatui, LINES.countZero());
            return 0;
        }
        // 战利品是愚人众在清点，这句归执行官说
        say(WHO.fatui, LINES.count(raw));
    } else {
        // 数量没认到就不报数，只提示：点击上限退回容量 32
        notice(`数量没认出来 → 按容量点 ${limit} 次，靠「容量已满」停；照《诊断报告》把识别区域对准数字`);
    }

    // 开点后如果连着几次位置都在变，说明列表一直在动，再点下去就是给一排不同的物品各点一下
    const unstableStop = readInteger("foodUnstableStop", DEFAULT_LIMITS.foodUnstableStop, 1, 20);
    const cat = category || DEFAULT_CATEGORY;
    let unstableStreak = 0;
    let settled = false;
    let relocateCount = 0;

    for (let i = 1; i <= limit; i += 1) {
        if (i === 1 || i % checkEvery === 0) {
            if (findTemplate("capacityFull")) {
                // 装置塞不塞得下是执行官的事，这句归愚人众
                say(WHO.fatui, LINES.full());
                full = true;
                break;
            }
        }

        // 软复核（默认不做）：只认锁定点附近，认不到就记一次 miss，连续够多次才停
        if (lockedFoodPos && reverifyEvery > 0 && i > 1 && (i - 1) % reverifyEvery === 0) {
            if (await lockStillThere("目标物品", screen)) {
                missStreak = 0;
            } else {
                missStreak += 1;
                dbg(`[目标物品] 第 ${i} 次前复核：锁定点 (${lockedFoodPos.x},${lockedFoodPos.y}) 附近认不到（第 ${missStreak}/${missStop} 次）`);
                if (missStreak >= missStop) {
                    notice(`连续 ${missStreak} 次认不到锁定点，停止点击以免误点其他物品`);
                    stoppedByMiss = true;
                    break;
                }
            }
        }

        if (lockedFoodPos) {
            // 照锁定位置点一下 —— 这个位置是上一步刚验过的（第一次用侦察锁定的结果）
            await clickAtLock("目标物品");
        } else if (!await clickTargetFoodOnce("目标物品", screen)) {
            // 没有侦察结果时才退回"每次重新识图"的老路
            notice(`第 ${i} 次已识别不到目标物品（多半已存完），停止点击以免误点其他物品`);
            break;
        }
        clicked += 1;
        await sleep(interval);

        // ---- 点完立刻回头验位置：清选中态 → 重新识图 → 比对 ----
        // 最后一次点完不用再验（验是为了后面几次点得准），已经验稳了也不用再验。
        if (lockedFoodPos && !settled && clicked < limit) {
            relocateCount += 1;
            let moved = await relocateAfterReset(cat, screen, "目标物品");
            if (moved === null) {
                // 截图 / UI 动画偶尔会有瞬时抖动，先原样再验一次；仍认不到才判定"存完了"
                relocateCount += 1;
                moved = await relocateAfterReset(cat, screen, "目标物品");
            }

            if (moved === null) {
                // 清完选中态还是认不到 = 多半存完了。带上进度是为了一眼看出"是不是存完了"：
                // 第 1/32 次就认不到，那不是存完了，是别的问题（图 / 阈值 / 列表滚走了）。
                // **立刻停**：半径内 + 按锁定阈值全屏都认不到 → 多半存完了。
                // 绝不为凑次数把阈值降下来去全屏乱找（那才是误存别的物品的根源）。
                notice(`第 ${clicked}/${limit} 次后，清掉选中态仍认不到目标（多半已存完），停止点击以免误点其他物品`);
                stoppedByMiss = true;
                break;
            }
            if (moved) {
                unstableStreak += 1;
                if (unstableStreak >= unstableStop) {
                    accident(LINES.unstable(unstableStreak));
                    throw new Error(`目标位置连续 ${unstableStreak} 次都在变，列表不对劲，停止点击`);
                }
            } else {
                // 一次没变就认定它不会再动 → 剩下的次数照这个点完
                unstableStreak = 0;
                settled = true;
                dbg(`[Food] 第 ${clicked} 次后位置没变 → 认定稳定，剩下 ${limit - clicked} 次照这个点完`);
            }
        }

        if (clicked >= limit) {
            stoppedByCount = true;
        }
    }

    say(WHO.fatui, LINES.hauling(clicked));
    if (relocateCount > 0) {
        dbg(`[Food] 共重新定位 ${relocateCount} 次${settled ? "（已确认稳定）" : "（未确认稳定）"}`);
    }
    if (lockFilteredCount > 1) {
        dbg(`[Food] 另有 ${lockFilteredCount} 次把锁定点以外的命中丢掉了（相似项混进候选，已按锁定点过滤）`);
    }

    // 已经按数量点满了，容量肯定没满，不用再等「容量已满」
    if (stoppedByCount && !full) {
        return clicked;
    }
    if (stoppedByMiss) {
        return clicked;
    }

    if (!full) {
        const waitMax = readInteger("capacityWaitMax", 20, 0, 200);
        for (let i = 1; i <= waitMax; i += 1) {
            if (findTemplate("capacityFull")) {
                full = true;
                break;
            }
            await sleep(readDelay("pollInterval"));
        }
    }

    if (!full) {
        accident(`点了 ${clicked} 次也没装满，按设定继续走确认流程`);
    }
    return clicked;
}

/**
 * 点击装置界面的分类页签。
 *
 * 用哪个分类**不再单独设置** —— 目标物品图放在 目标物品/料理/ 还是 目标物品/材料/，
 * 就点哪个页签（分类由 bootstrap 从选中图的路径反推后传进来）。
 * 每个分类有两张候选图，按顺序找，先找到哪张就点哪张。
 *
 * @param {string} category 料理 / 材料
 */
export async function openCategoryTab(category) {
    const keys = TAB_CATEGORIES[category] || TAB_CATEGORIES[DEFAULT_CATEGORY];
    const names = keys.map((key) => templateFileName(key)).join(" / ");
    const maxRetry = readInteger("uiClickRetry", 10, 1, 60);

    // 翻哪一栏是愚人众在动手（派蒙只在旁边吐槽），所以这句归执行官
    say(WHO.fatui, LINES.tab(category));
    dbg(`[页签] 候选图：${names}`);

    for (let attempt = 1; attempt <= maxRetry; attempt += 1) {
        const hit = findFirstTemplate(keys);
        if (hit) {
            hit.result.click();
            dbg(`[页签] 已点击「${templateFileName(hit.key)}」`);
            await sleep(readDelay("uiClickDelay"));
            return true;
        }
        dbg(`[页签] 第 ${attempt}/${maxRetry} 次未匹配到「${names}」`);
        await sleep(readDelay("pollInterval"));
    }

    throw new Error(`[页签] ${maxRetry} 次尝试后仍未找到分类页签「${names}」`);
}

/**
 * 轮询等待「拆除返还.png」出现。
 * 出现它才说明当前确实处在"可以拆"的状态（拆除预览/返还提示）。
 */
async function waitForDemolishConfirm(label) {
    const fileName = templateFileName("demolishConfirm");
    const maxVerify = readInteger("demolishVerifyMax", DEFAULT_LIMITS.demolishVerifyMax, 1, 60);

    for (let attempt = 1; attempt <= maxVerify; attempt += 1) {
        if (findTemplate("demolishConfirm")) {
            // 「拆除返还」只在造物模式内、且视角对准装置时才出现，所以看到它就是可靠的探针：
            // 据此把造物模式状态校正为"已进入"，结尾据此一定能正确退出造物模式。
            creationModeOn = true;
            dbg(`[${label}] 已出现「${fileName}」，确认可拆除（已在造物模式）`);
            return true;
        }
        // 每次都打一行 = 最多 10 行同义刷屏 → 交给调用方汇总
        dbg(`[${label}] 第 ${attempt}/${maxVerify} 次未匹配到「${fileName}」`);
        await sleep(readDelay("pollInterval"));
    }
    return false;
}

/**
 * 进造物之前先清场：如果场上已经存在一个寄物装置（上一轮没拆干净、或手动放的），
 * 新造物是放不下去的，必须先把旧的拆掉。
 *
 * T 是造物模式的开关：第一次按进入、第二次按退出（已据真实运行确认）。
 * 本函数会按需按一次 T 进入造物模式（进入后场上已有的装置会显示「拆除返还.png」），
 * 但绝不补按第二次——第二次会把刚进来的造物模式又切走，导致后续「按 3 选类型」找不到寄物装置。
 * 进入造物模式后本函数不再按 T，退出交给 enterCreationMode / deleteDevice 统一处理。
 *
 * 残留有两种可识别状态，按键序列不同：
 *   1) 屏幕上有「拆除返还.png」  → 已经在造物模式内且处于拆除预览态，直接左键就拆掉了，不用按键
 *   2) 屏幕上有「打开寄物装置.png」→ 人就在装置旁但可能还没进造物模式，
 *                                  按一次 T 进入造物模式，等「拆除返还.png」出现后左键拆除
 * 两个都没有 → 场上干净，直接返回。
 *
 * 两个判断都做了「二次确认」：命中后隔一会儿再查一次，两次都在才算数。
 * 因为一次阈值命中很可能是误匹配（七天神像的交互提示就长得像"打开XXX"），
 * 一旦误判，后面会白按好几次造物键，还会拿鼠标去戳画面中心。
 *
 * 注意：在造物模式下、附近没有可拆的造物时，不会出现「拆除返还」——
 * 所以已进入造物模式却迟迟不出现，基本可以断定是「打开寄物装置.png」误匹配，
 * 清场属于兜底步骤，默认不因此中断整个脚本（可用 clearExistingStrict 改成严格模式）。
 *
 * 拆除后界面会自行关闭，但仍停留在造物模式内（本函数不按 T 退出）。
 * 返回是否真的清理过东西。
 */
export async function clearExistingDevice(screen) {
    if (!readCheckbox("clearExistingEnabled", true)) {
        dbg("[清场] 跳过（设置里关掉了）");
        return false;
    }
    say(WHO.fatui, LINES.clearing());

    const maxPass = readInteger("clearExistingMax", DEFAULT_LIMITS.clearExistingMax, 1, 10);
    const stuckLimit = readInteger("clearStuckLimit", DEFAULT_LIMITS.clearStuckLimit, 1, 10);
    const switchDelay = readDelay("clearSwitchDelay");
    const recheck = readCheckbox("clearRecheck", true);
    const strict = readCheckbox("clearExistingStrict", false);
    const vk = creationKey();
    const centerFirst = readCheckbox("deleteAtCenterFirst", true);
    let cleaned = false;
    let stuck = 0;

    // 命中一次不算数，隔一会儿再看一眼，两次都在才认
    const seeTwice = async (key) => {
        if (!findTemplate(key)) {
            return false;
        }
        if (!recheck) {
            return true;
        }
        await sleep(readDelay("clearRecheckDelay"));
        return !!findTemplate(key);
    };

    for (let pass = 1; pass <= maxPass; pass += 1) {
        // 1) 已经在拆除确认态：不用再按键，直接点
        if (await seeTwice("demolishConfirm")) {
            // 拆完界面本应自行关闭。若拆除后它还在，多半是界面没关透或误匹配，
            // 再点就是拿鼠标戳画面中心了，点几次还不走就收手
            stuck += 1;
            if (stuck > stuckLimit) {
                notice(`「${templateFileName("demolishConfirm")}」连续 ${stuck} 次仍在，判断为界面未关闭或误匹配，停止清场`);
                return cleaned;
            }
            dbg("[清场] 地上有个旧的，拆掉先");
            // 「拆除返还」只在造物模式内出现，说明此时已处于造物模式
            creationModeOn = true;
            await primaryClick(screen, centerFirst, "清场");
            await sleep(readDelay("clearExistingSettleDelay"));
            cleaned = true;
            continue;
        }

        // 2) 能看到「打开寄物装置」＝人就在装置旁。T 是造物模式的开关：
        //    第一次按进入造物模式、第二次按退出，所以这里只需按一次。
        //    进入造物模式后，当场已有的装置会显示「拆除返还.png」，左键即可拆掉。
        if (await seeTwice("openDevice")) {
            stuck = 0;
            // 若尚未进入造物模式才按 T；已在（比如上一轮残留、或清场已按过）就跳过，
            // 避免重复按把刚进来的造物模式又切走。
            if (!creationModeOn) {
                dbg("[清场] 旁边就有个旧装置，拆掉先");
                keyPress(vk);
                await sleep(switchDelay);
                creationModeOn = true;
            } else {
                dbg("[清场] 已在造物模式，直接等待「拆除返还.png」");
            }

            // 进入造物模式后轮询等「拆除返还.png」；出现才说明真的有可拆的装置
            if (await waitForDemolishConfirm("清场")) {
                await primaryClick(screen, centerFirst, "清场");
                await sleep(readDelay("clearExistingSettleDelay"));
                dbg("[清场] 拆掉了");
                cleaned = true;
                continue;
            }

            // 进入了造物模式却迟迟不出现「拆除返还」：多半是「打开寄物装置.png」误匹配，
            // 附近其实没装置（造物模式下没有可拆对象就不会有返还提示）。绝不补按第二次 T——
            // 第二次 T 会把刚进来的造物模式切走，反而更糟。
            const why = `按了造物键却没等来「${templateFileName("demolishConfirm")}」，多半是「${templateFileName("openDevice")}」误匹配（旁边其实没装置）`;
            if (strict) {
                throw new Error(`[清场] ${why}，无法确认可拆除，已放弃`);
            }
            notice(`${why}，跳过清场继续`);
            return cleaned;
        }

        say(WHO.fatui, LINES.cleared());
        return cleaned;
    }

    // 达上限 = 场上可能还有残留装置 → 后面放置会失败。这是隐患，必须留在窗口
    notice(`清场达上限 ${maxPass} 次，场上若仍有旧装置会导致放置失败`);
    return cleaned;
}

/**
 * 退出装置存储页后，准星可能没对着刚放的寄物装置——
 * 「拆除返还」只在造物模式内、且视角对准装置时才出现。
 * 把鼠标移到装置（或画面中心）的位置，让相机转过去对准它。
 */
async function reaimAtDeviceOrCenter(label) {
    const box = findTemplateBox("openDevice") || findTemplateBox("device");
    if (box) {
        dbg(`[${label}] 把准星对准装置 (${Math.round(box.cx)},${Math.round(box.cy)})`);
        moveMouseTo(Math.round(box.cx), Math.round(box.cy));
    } else {
        dbg(`[${label}] 未找到装置位置，准星回归画面中心 (960,540)`);
        moveMouseTo(960, 540);
    }
    await sleep(readDelay("reaimDelay"));
}

export async function deleteDevice(screen) {
    const mode = readSelect(
        "deleteMode",
        DELETE_MODE_IN_CREATION,
        [DELETE_MODE_IN_CREATION, DELETE_MODE_FROM_NORMAL]
    );
    const vk = creationKey();
    const switchDelay = readDelay("deleteSwitchDelay");
    const fileName = templateFileName("demolishConfirm");
    const maxVerify = readInteger("demolishVerifyMax", DEFAULT_LIMITS.demolishVerifyMax, 1, 60);

    dbg(`[Delete] 删除模式：${mode}`);

    // T 是造物模式的开关（第 1 次进、第 2 次退），必须和 enterCreationMode / clearExistingDevice
    // 共用 creationModeOn，否则多按一次会把造物模式切走，或漏按导致后续「按 3」找不到寄物装置。
    if (mode === DELETE_MODE_FROM_NORMAL) {
        // 当前可能不在造物模式：按需进入（已在就跳过，避免重复按键切出）
        if (!creationModeOn) {
            dbg(`[Delete] 按 ${vk} 进入造物模式`);
            keyPress(vk);
            await sleep(switchDelay);
            creationModeOn = true;
        } else {
            dbg(`[Delete] 已在造物模式，跳过进入按键`);
        }
    } else {
        // IN_CREATION 模式：装置存储页关闭后游戏已离开造物模式（markOutOfCreation），
        // 所以这里必然要补按一次 T 重新进入——这是正常路径，不是异常，只提示不告警。
        if (!creationModeOn) {
            dbg(`[Delete] 已离开造物模式，按设置重新按 ${vk} 进入`);
            keyPress(vk);
            await sleep(switchDelay);
            creationModeOn = true;
        }
    }

    // 处于造物模式且视角对准装置时，已放置的寄物装置会显示「拆除返还」，左键即可拆掉。
    // 退出装置存储页后准星可能没对着装置（相机角度），且装置交互有时会顺带把造物模式切走，
    // 这两种情况都会导致「拆除返还」不出现。兜底顺序：
    //   1) 先轮询等「拆除返还」
    //   2) 把准星对准装置（让相机转过去）后再轮询
    //   3) 仍不行就按一次 T 切换造物模式状态（尝试两种 parity），每次切换后都重新对准再轮询
    // —— 只要「拆除返还」出现，waitForDemolishConfirm 会据此把 creationModeOn 校正为"已在造物模式"，
    //    结尾据真实状态一定能正确退出造物模式；不再用"翻转标志"去猜当前是进还是退。
    if (!await waitForDemolishConfirm("Delete")) {
        let recovered = false;
        for (let attempt = 1; attempt <= 2 && !recovered; attempt += 1) {
            await reaimAtDeviceOrCenter("[Delete]");
            if (await waitForDemolishConfirm("[Delete] 对准后")) {
                recovered = true;
                break;
            }
            // 切换造物模式状态属于"已经在自救"的信号，值得看见 → 用提示级
            notice(`还是没等到「${fileName}」，切一次造物模式状态再试（第 ${attempt} 次）`);
            keyPress(vk);
            await sleep(switchDelay);
            await reaimAtDeviceOrCenter("[Delete]");
            if (await waitForDemolishConfirm("[Delete] 切换后")) {
                recovered = true;
                break;
            }
        }
        if (!recovered) {
            const why = `试了 ${maxVerify} 次也没等来「${fileName}」，拆不动，本轮放弃`;
            accident(why);
            throw new Error(why);
        }
    }

    await primaryClick(screen, readCheckbox("deleteAtCenterFirst", true), "Delete");
    say(WHO.fatui, LINES.demolish());
    await sleep(readDelay("afterDeleteDelay"));

    // 拆除后仍在造物模式，按一次 T 退出，让下一轮从干净状态开始（T 是开关）
    if (creationModeOn) {
        dbg(`[Delete] 按 ${vk} 退出造物模式`);
        keyPress(vk);
        await sleep(switchDelay);
        creationModeOn = false;
    }

    say(WHO.fatui, LINES.demolished());
}

/**
 * 异常兜底：确实处于造物模式时按一次 T 退出，并同步 creationModeOn。
 * 供 task.js 在循环异常且已进入造物模式时调用，避免把造物界面卡在开着的状态。
 */
export async function emergencyExitCreation() {
    if (!creationModeOn) {
        dbg("[Exit] 当前不在造物模式，无需兜底退出");
        return;
    }
    const vk = creationKey();
    notice(`出错了，兜底按 ${vk} 把造物界面退掉`);
    keyPress(vk);
    await sleep(readDelay("exitCreationDelay"));
    creationModeOn = false;
}

/**
 * 异常兜底（**装置已经落地之后**才用）：退页面 → 拆装置，把现场收拾干净。
 *
 * 为什么需要它（16:37 实跑的真 bug）：
 *   找目标物品时"翻到底了"会抛错，而那时装置**已经放在地上、存取页面还开着**。
 *   以前只调 `emergencyExitCreation()` 按一下 T 就完事 —— 界面是退了，
 *   可装置还杵在场地上，留一个残留造物（下一轮清场才拆，甚至一直留到用户手动处理）。
 *
 * 正确收尾是两步，顺序不能反：
 *   ① 装置存取页面还开着 → 先点「退出装置页面」把它关掉
 *      （页面开着时按 T 是没用的，得先回到大世界）；
 *   ② 再走 `deleteDevice()` —— 它会自己按需按 T 进造物模式、对准装置、拆掉、退出。
 *
 * 拆不动时**不硬抛**：这里本来就在异常处理里，抛出去只会把原始错误盖掉，
 * 让日志变成"收尾失败"而看不到"翻到底了"这个真正的原因。所以只提示 + 落盘。
 *
 * @returns {boolean} 是否拆掉了
 */
export async function emergencyCleanupDevice(screen) {
    // ① 关页面。按钮找不到了说明页面已经关了（比如错误就发生在退出那一步），跳过。
    if (findTemplate("exitDevice")) {
        notice("先把装置页面退掉，再把留在场上的装置拆了");
        await clickWithRetry("exitDevice", "退出装置页面");
    } else {
        dbg("[Exit] 装置页面已关闭，跳过退出点击");
    }
    await markOutOfCreation();

    // ② 拆装置。失败只提示，不抛出（理由见上面注释）
    try {
        await deleteDevice(screen);
        return true;
    } catch (cleanupError) {
        notice(`装置没能拆掉：${errorText(cleanupError)}（现场可能留有残留造物，请手动拆除）`);
        dbgError("兜底拆除失败", cleanupError);
        return false;
    }
}

export function currentScreen() {
    return getScreenSize();
}
