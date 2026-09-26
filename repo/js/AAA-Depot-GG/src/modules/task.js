/**
 * 编排层（整个脚本的"总指挥"）：
 *   1. 启动后无条件传送到七天神像，把热能补满（至冬地区没有热能就放不下造物）
 *   2. 原地按 cycleCount 跑「放置 → 存取 → 删除」循环
 *
 * 想改流程顺序就改 runCycle() 里的调用顺序；
 * 恢复热能固定走自带路径文件（Assets/Pathing/00-恢复热能-至冬-七天神像.json）。
 *
 * 本文件只做三件事：读设置、串流程、收尾。
 * 具体"怎么按、怎么认"分别在 actions.js / recognition.js / digits.js 里。
 */
import { DEFAULT_CATEGORY, PATHS, REQUIRED_TEMPLATES, TAB_CATEGORIES } from "../constants.js";
import {
    approachDevice,
    applyCamera,
    clearExistingDevice,
    clickFoodUntilFull,
    clickWithRetry,
    currentScreen,
    deleteDevice,
    emergencyCleanupDevice,
    emergencyExitCreation,
    enterCreationMode,
    findFoodWithScroll,
    markOutOfCreation,
    openCategoryTab,
    selectTypeAndPlace
} from "./actions.js";
import {
    normalizeVirtualKey,
    readCheckbox,
    readDelay,
    readInteger
} from "./config.js";
import { checkRequiredTemplates, disposeTemplates, setScreen, setTargetFoodOverride } from "./recognition.js";
import { errorText } from "../utils/common.js";
import { closeDebugLog, dbg, dbgError, initDebugLog } from "../utils/debuglog.js";
import { isDiagEnabled, printDiagReport, putDiag, resetDiag, setDiagEnabled } from "../utils/diag.js";
import { BOOT_OK, bootstrap, printUsage } from "./bootstrap.js";
import { disposeDigits, readItemCount } from "./digits.js";
import { LINES, WHO, accident, notice, say } from "../utils/voice.js";
import { logLines } from "../utils/print.js";

/**
 * 排障落点只报一次，先到先得。
 *
 * 《诊断报告》和排障日志写的是**同一个文件**（printDiagReport → dbgBlock → 同一份），
 * 每一轮各报一次，等于同一行重复 N 遍；窗口行数按"条数 × 2"算，重复是纯浪费。
 * 第一轮先报出去，顺带解决"脚本被中途掐掉也能知道文件在哪"。
 */
let announcedPlace = null;

function announcePlace(path) {
    if (!path || path === announcedPlace) {
        return false;
    }
    announcedPlace = path;
    return true;
}

/**
 * 恢复热能：固定走自带路径文件（至冬七天神像）。
 * 用「最近神像」那条路（genshin.tpToStatueOfTheSeven）实际不会用到，
 * 留着只会让设置面板多一个没意义的选项，所以不再暴露开关。
 *
 * 为什么一定要先补热能：至冬地区热能耗尽就放不下造物，
 * 与其在"放置"那一步失败再回头，不如开局先跑一趟，之后每轮都在原地跑。
 */
async function restoreHeat(reason) {
    say(WHO.fatui, LINES.tpStatue());
    dbg(`[Heat] 恢复热能（${reason}）：走 ${PATHS.restoreStatue}`);

    if (typeof pathingScript === "undefined" || typeof pathingScript.runFile !== "function") {
        throw new Error("当前 BetterGI 版本没有 pathingScript.runFile()");
    }
    await pathingScript.runFile(PATHS.restoreStatue);

    // 传送落点不一定正对神像，可选再按一次交互键把热能续满。
    // 注意：restoreInteractionEnabled 不在设置面板里（恒 false），本分支目前不会执行
    if (readCheckbox("restoreInteractionEnabled", false)) {
        const interactKey = normalizeVirtualKey(settings.restoreInteractionKey, "VK_F");
        say(WHO.fatui, `站到神像前，按 ${interactKey} 把热能续满`);
        keyPress(interactKey);
    }

    await sleep(readDelay("restoreDelay"));
    dbg("[Heat] 传送完成，原地开始放置流程（未读取热能数值）");
}

/**
 * 一个完整循环：
 * 调整视角 →【开造前清场】→ 按 T → 循环按 3 直到出现寄物装置 → 左键放置
 * → 按 W 靠近直到出现打开寄物装置 → 按 F 打开
 * → 点分类页签 → 找目标物品（找不到就滚轮再找）→ 认一次数量 → 连点存取
 * → 确认存取 → 确认 → 退出页面 → 删除造物
 */
async function runCycle(index, screen, category) {
    // placed = 装置已经放到地上了（此后出错就必须把它拆掉，不能只退界面了事）
    const state = { entered: false, exited: false, placed: false, cleanupTried: false };

    try {
        say(WHO.fatui, LINES.roundStart(index));
        resetDiag();
        await sleep(readDelay("pathSettleDelay"));

        await applyCamera();

        // 视角固定后才能可靠识别；场上若已有一个装置，新的是放不下去的，先拆掉
        await clearExistingDevice(screen);

        await enterCreationMode();
        state.entered = true;

        await selectTypeAndPlace(screen);
        state.placed = true;   // ← 从这里往后出错，收尾必须把装置拆掉
        await approachDevice();
        await sleep(readDelay("panelOpenDelay"));

        await openCategoryTab(category);

        // 先侦察锁定（一步都不点）：确定真目标是哪个、阈值定死，
        // 然后用**锁定位置的正下方**去认数量，最后才开点。
        // 认数量要传分类：材料上限 9999、料理上限 2000，超出上限的一律判为误识别。
        const recon = await findFoodWithScroll(screen);
        const foodCount = readItemCount(recon.box, screen, category);
        const clicked = await clickFoodUntilFull(foodCount, recon, screen, category);

        // 诊断报告：整份只进排障文件，窗口里报一句落点就够
        // （一份 40~50 行，打出来会把流程台词全淹了，而且 BGI 窗口本来也会截断/滚掉）
        if (isDiagEnabled()) {
            putDiag("verdict", [`实际点击：${clicked} 次`]);
            const saved = printDiagReport(`第 ${index} 轮 · 诊断报告`);
            if (saved) {
                // 落点重复就不出声（同一文件），报过的那一轮已经把它说清楚了
                if (announcePlace(saved)) {
                    notice(LINES.diagSaved(saved));
                } else {
                    dbg(`[Diag] 落点不变，不再重复提示：${saved}`);
                }
            } else {
                notice(LINES.diagLost());
            }
        }

        // 这三个是弹窗按钮，点了之后要等下级界面出现，最容易点空
        say(WHO.fatui, LINES.confirmAccess());
        await clickWithRetry("confirmAccess", "确认存取", {
            waitFor: "confirm",
            afterDelay: "afterConfirmAccessDelay"
        });
        say(WHO.fatui, LINES.confirm());
        await clickWithRetry("confirm", "确认", {
            afterDelay: "afterConfirmDelay"
        });
        say(WHO.fatui, LINES.leaving());
        await clickWithRetry("exitDevice", "退出装置页面");

        // 关闭装置页面后游戏已离开造物模式（用户确认），标记后再让 deleteDevice 正常进入
        await markOutOfCreation();

        await deleteDevice(screen);
        state.exited = true;

        say(WHO.fatui, LINES.roundDone());
    } catch (error) {
        dbgError(`第 ${index} 轮异常`, error);
        // 只收一次：拆除本身也可能失败，失败后再收一遍只会把现场越搞越乱（还会掩盖原始错误）
        if (!state.exited && !state.cleanupTried && readCheckbox("emergencyExitOnError", true)) {
            state.cleanupTried = true;
            try {
                if (state.placed) {
                    // 装置已经落地（翻到底 / 认不到 / 点击异常都会走到这儿）：
                    // 退页面 → 拆装置。只按一下 T 是不够的，装置会留在场上。
                    await emergencyCleanupDevice(screen);
                } else if (state.entered) {
                    // 还没放下装置，只需要把造物界面退掉
                    await emergencyExitCreation();
                }
            } catch (cleanupError) {
                notice(`收尾没走完：${errorText(cleanupError)}`);
                dbgError("收尾异常", cleanupError);
            }
        }
        throw error;
    }
}

/**
 * 脚本入口（BetterGI 调的就是这个函数）。
 *
 * 顺序上有一条硬规矩：**传送之前不碰游戏**。
 * 前置校验（截图模板齐不齐、有没有选到占位图）全部在 bootstrap() 里做完，
 * 不合格就直接停 —— 免得传送完才发现图没配好，白跑一趟还把角色丢在神像边上。
 */
export async function runTask() {
    let failed = false;
    try {
        // 排障日志恒开（不再暴露设置项）：只记出错与诊断，正常流程一行不落。
        // 一个字都没记上时 closeDebugLog 不写盘、不提示落点，见 debuglog.js。
        // 落点去重标记每次运行都要清零（模块状态在同一次进程里会跨运行残留）。
        announcedPlace = null;
        initDebugLog();

        say(WHO.fatui, LINES.start());

        // 诊断报告恒开（不再暴露设置项）：每轮攒一份完整报告，只落盘、不占窗口。
        setDiagEnabled(true);

        const screen = currentScreen();
        // 先告诉识别层屏幕尺寸，限定区域才能按分辨率换算
        setScreen(screen);

        // ---- 启动前置校验（传送之前，游戏完全不会被操作）----
        // 扫目录 → 比对下拉选项 → 有增减就改写 settings.json 并停止；
        // 选中的是「截图方法模板」也直接停止。
        const boot = bootstrap();
        if (boot.status !== BOOT_OK) {
            // 停止类分支不打说明书：那 6 条与停止块内容重复（都是"怎么选物品"），
            // 且停止块已写明当前该做什么，比通用说明书对症。见 bootstrap.js:logStopped。
            return;
        }

        // 说明书恒打（不再暴露设置项）。
        // 启动检查结果不进窗口：能执行到这里就说明检查已通过，再报一遍是冗余。
        printUsage();

        setTargetFoodOverride(boot.itemPath);

        // 分类页签那两张图是动态的：分类由**选中图所在的目录**推断出来，
        // 页签就点对应那两张，其余分类的图既不校验也不加载
        const category = boot.category;
        const required = REQUIRED_TEMPLATES.concat(TAB_CATEGORIES[category] || TAB_CATEGORIES[DEFAULT_CATEGORY]);
        checkRequiredTemplates(required);

        const cycleCount = readInteger("cycleCount", 1, 1, 999);
        say(WHO.fatui, LINES.cycles(cycleCount));

        // 脚本启动：无条件先回一次神像（台词已在 restoreHeat 里说过，这里不再重复）
        await restoreHeat("脚本启动");

        for (let index = 1; index <= cycleCount; index += 1) {
            await runCycle(index, screen, category);
            if (index < cycleCount) {
                await sleep(readDelay("cycleInterval"));
            }
        }

        say(WHO.fatui, LINES.allDone(cycleCount));
    } catch (error) {
        failed = true;
        accident(`脚本终止：${errorText(error)}`, error);
        throw error;
    } finally {
        disposeTemplates();
        disposeDigits();
        // 落盘必须在 dispose 之后：它是最后一行
        const saved = closeDebugLog(failed ? "异常终止" : "正常结束");
        // 前面哪一轮已经把落点报出去了（诊断报告与它是同一文件）就不再重复
        if (saved && announcePlace(saved)) {
            notice(`排障日志：${saved}`);
        }
    }
}
