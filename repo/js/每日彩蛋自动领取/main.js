const INTERACT_REGION = { x: 1100, y: 430, w: 350, h: 300 };
const OPTION_MIN_X = 1200;
const OPTION_MIN_Y = 460;
const OPTION_MAX_Y = 920;
const DIALOG_REGION = { x: 620, y: 790, w: 580, h: 170 };
// 挑选界面里可点击项（如彩蛋名称）最高不会超过这个 y 值
const PICK_MAX_Y = 800;

let npcConfigs = [];
let accountName = "默认账户";
let record = { date: "", completed: [] };

// ==================== 基础工具 ====================

// 归一化文本：忽略「」括号、间隔号、空白，降低OCR差异影响
function normalizeText(text) {
    return (text || "").replace(/[「」『』【】·•・.\s]/g, "");
}

// 游戏日（凌晨4点刷新）的日期标识
function getGameDateKey() {
    const now = new Date();
    if (now.getHours() < 4) {
        now.setDate(now.getDate() - 1);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// ==================== 配置与记录 ====================

async function loadNpcConfigs() {
    const content = await file.readText("assets/npcs.json");
    const json = JSON.parse(content);
    const list = [];
    for (const name of Object.keys(json)) {
        // 以下划线开头的键作为说明字段忽略
        if (name.startsWith("_")) continue;
        const item = json[name] || {};
        list.push({
            name: name,
            enable: item.enable !== false,
            path: (item.path || "").trim(),
            interact: (item.interact || "f").toLowerCase(),
            options: Array.isArray(item.options)
                ? item.options.filter(o => typeof o === "string" && o.trim() !== "")
                : [],
            // 挑选类界面（如“让我挑一枚”彩蛋）：keyword 为该界面可点击项的文字关键字
            pick: item.pick && typeof item.pick.keyword === "string" && item.pick.keyword.trim() !== ""
                ? { keyword: item.pick.keyword.trim() }
                : null
        });
    }
    return list;
}

function getRecordPath() {
    return `record/${accountName}.json`;
}

async function loadRecord() {
    try {
        if (typeof file.isExists === "function" && !file.isExists(getRecordPath())) {
            record = { date: getGameDateKey(), completed: [] };
            return;
        }
        const content = await file.readText(getRecordPath());
        const data = JSON.parse(content);
        if (data && data.date === getGameDateKey() && Array.isArray(data.completed)) {
            record = data;
            return;
        }
    } catch (e) {
        // 记录不存在或格式错误时按新的一天处理
    }
    record = { date: getGameDateKey(), completed: [] };
}

async function saveRecord() {
    try {
        await file.writeText(getRecordPath(), JSON.stringify(record, null, 2));
    } catch (e) {
        log.warn(`保存每日记录失败: ${e.message}`);
    }
}

async function resolveAccountName() {
    const raw = (settings.userName || "").trim();
    if (raw) {
        accountName = raw.replace(/[\\/:*?"<>|]/g, "_");
        return;
    }
    await genshin.returnMainUi();
    await sleep(800);
    try {
        const uid = await genshin.uid();
        accountName = uid ? String(uid) : "默认账户";
    } catch (e) {
        accountName = "默认账户";
    }
}

// ==================== 地图追踪 ====================

async function autoPath(path) {
    try {
        await pathingScript.runFile(path);
        await sleep(300);
        return true;
    } catch (e) {
        log.error(`执行地图追踪出错: ${e.message}`);
        return false;
    }
}

// 点击 OCR 结果
// 缺失时用固定偏移兜底
function clickOcrResult(r) {
    const w = typeof r.width === "number" ? r.width : (typeof r.Width === "number" ? r.Width : 0);
    const h = typeof r.height === "number" ? r.height : (typeof r.Height === "number" ? r.Height : 0);
    const x = r.x + (w > 0 ? w / 2 : 40);
    const y = r.y + (h > 0 ? h / 2 : 14);
    click(Math.round(x), Math.round(y));
}

// ==================== OCR 辅助 ====================

// 扫描屏幕右侧的对话分支选项，返回识别结果数组
function scanDialogOptions() {
    const items = [];
    const capture = captureGameRegion();
    try {
        const resList = capture.findMulti(RecognitionObject.ocrThis);
        for (let i = 0; i < resList.count; i++) {
            const r = resList[i];
            const text = (r.text || "").trim();
            if (text === "") continue;
            if (r.x >= OPTION_MIN_X && r.y >= OPTION_MIN_Y && r.y <= OPTION_MAX_Y) {
                items.push(r);
            }
        }
    } finally {
        capture.dispose();
    }
    return items;
}

// 判断是否仍在对话中
function isDialogActive() {
    const capture = captureGameRegion();
    try {
        const res = capture.Find(RecognitionObject.Ocr(DIALOG_REGION.x, DIALOG_REGION.y, DIALOG_REGION.w, DIALOG_REGION.h));
        return res.isExist() && (res.text || "").trim().length > 0;
    } finally {
        capture.dispose();
    }
}

// ==================== 挑选界面（如“让我挑一枚”彩蛋） ====================

// 扫描挑选界面：返回包含关键字的可点击项，以及是否已进入挑选界面
function scanPickScreen(keyword) {
    const target = normalizeText(keyword);
    const result = { items: [], uiVisible: false };
    const capture = captureGameRegion();
    try {
        const resList = capture.findMulti(RecognitionObject.ocrThis);
        for (let i = 0; i < resList.count; i++) {
            const r = resList[i];
            const text = normalizeText(r.text);
            if (text === "") continue;
            // “下次再挑。”是挑选界面的固定退出项，用作界面标记
            if (text.includes("下次再挑")) {
                result.uiVisible = true;
            }
            if (r.y > PICK_MAX_Y) continue; // 排除底部对话框区域
            if (text.includes(target)) {
                result.items.push(r);
            }
        }
    } finally {
        capture.dispose();
    }
    return result;
}

// 从设置里取本次要挑的那一项；为空或“随机”时返回空字符串表示随机
// 仅当设置值属于当前挑选界面的项（包含该界面的 keyword，如“闪闪礼蛋”）时才生效，
// 避免多个挑选型NPC的设置互相干扰
function getPickChoiceText(pick) {
    const setting = (settings.pickChoice || "").trim();
    if (!setting) return "";
    return normalizeText(setting).includes(normalizeText(pick.keyword)) ? setting : "";
}

// 在挑选界面中挑一个：设置里指定了就点它，否则随机挑一个
async function pickReward(pick, npcName) {
    const choiceText = getPickChoiceText(pick);
    let choiceMissCount = 0;

    for (let attempt = 0; attempt < 15; attempt++) {
        const scan = scanPickScreen(pick.keyword);

        if (scan.items.length > 0) {
            let target = null;
            if (choiceText) {
                target = scan.items.find(r => normalizeText(r.text).includes(normalizeText(choiceText)));
                if (!target) {
                    // 界面文字可能还没加载完：稍等重试；多次找不到则放弃，不改为随机
                    choiceMissCount++;
                    if (choiceMissCount >= 5) {
                        log.warn(`挑选界面中没有找到「${choiceText}」`);
                        return false;
                    }
                    await sleep(600);
                    continue;
                }
            } else {
                target = scan.items[Math.floor(Math.random() * scan.items.length)];
            }
            log.info(`挑选奖励: ${target.text.trim()}`);
            await sleep(200);
            clickOcrResult(target);
            await sleep(1500);
            return true;
        }

        if (scan.uiVisible) {
            // 已进入挑选界面但没识别到奖励文字：等待重试，不按F
            await sleep(700);
            continue;
        }

        // 仍在普通对话中：按F推进，直到挑选界面出现
        keyPress("VK_F");
        await sleep(900);
    }

    log.warn(`「${npcName}」未能进入挑选界面或选择奖励`);
    return false;
}

// ==================== 进入对话 ====================

// 按住Alt呼出鼠标，按NPC名字点击交互选项
async function enterDialogByName(npcName) {
    const ro = RecognitionObject.Ocr(INTERACT_REGION.x, INTERACT_REGION.y, INTERACT_REGION.w, INTERACT_REGION.h);
    const targetName = normalizeText(npcName);

    for (let attempt = 1; attempt <= 3; attempt++) {
        let target = null;
        const capture = captureGameRegion();
        try {
            const resList = capture.findMulti(ro);
            for (let i = 0; i < resList.count; i++) {
                const r = resList[i];
                if (normalizeText(r.text).includes(targetName)) {
                    target = r;
                    break;
                }
            }
        } finally {
            capture.dispose();
        }

        if (target) {
            log.info(`找到交互选项: ${target.text.trim()}，开始交互`);
            keyDown("VK_MENU");
            await sleep(1000);
            clickOcrResult(target);
            await sleep(1000);
            keyUp("VK_MENU");
            await sleep(1200);
            return true;
        }

        log.warn(`未找到包含「${npcName}」的交互选项（第 ${attempt}/3 次）`);
        await sleep(1500);
    }
    return false;
}

// 直接按F进入对话
async function enterDialogByF() {
    keyPress("VK_F");
    await sleep(1500);
    return true;
}

// ==================== 对话推进与选项选择 ====================

// 选项列表中没有目标项（通常表示该NPC今日奖励已领取）：选择最后一个选项退出对话，
async function exitDialogByLastOption() {
    const options = scanDialogOptions();
    if (options.length === 0) {
        await advanceUntilDialogEnd();
        return;
    }
    const last = options.reduce((a, b) => (a.y >= b.y ? a : b));
    log.info(`退出对话: ${last.text.trim()}`);
    await sleep(200);
    clickOcrResult(last);
    await sleep(1200);
    await advanceUntilDialogEnd();
}

// 按F推进对话，直到出现包含关键字的目标选项后点击它
async function selectOptionByKeyword(keyword, maxAttempts = 12) {
    const targetKeyword = normalizeText(keyword);
    let noMatchCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const options = scanDialogOptions();

        if (options.length > 0) {
            const matched = options.find(r => normalizeText(r.text).includes(targetKeyword));
            if (matched) {
                log.info(`已找到对话选项: ${matched.text.trim()}，点击`);
                await sleep(200);
                clickOcrResult(matched);
                await sleep(1000);
                return true;
            }

            // 有选项列表但都不匹配：不按F（避免误选默认选项），等待后重试
            noMatchCount++;
            if (noMatchCount >= 4) {
                log.warn(`选项列表中没有找到「${keyword}」（可能今日已领取过）`);
                await exitDialogByLastOption();
                return false;
            }
            await sleep(600);
            continue;
        }

        // 选项尚未出现：对话已结束就直接返回
        if (!isDialogActive()) {
            log.warn(`对话已结束，未出现选项「${keyword}」`);
            return false;
        }

        // 按F推进下一句
        noMatchCount = 0;
        keyPress("VK_F");
        await sleep(1100);
    }

    log.warn(`多次尝试后仍未出现对话选项「${keyword}」`);
    return false;
}

// 按F推进对话，直到对话结束
async function advanceUntilDialogEnd(maxAttempts = 25) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(400);
        if (!isDialogActive()) {
            return true;
        }
        keyPress("VK_F");
        await sleep(900);
    }
    return !isDialogActive();
}

// 处理一个NPC的全部对话：依次选择各级选项、挑选奖励，然后推进到对话结束
async function talkAndSelectOptions(npc) {
    for (const option of npc.options) {
        const selected = await selectOptionByKeyword(option);
        if (!selected) {
            log.error(`「${npc.name}」未能选择选项「${option}」`);
            return false;
        }
        await sleep(500);
    }

    // 有挑选界面（如彩蛋）时先挑一个
    if (npc.pick) {
        const picked = await pickReward(npc.pick, npc.name);
        if (!picked) {
            return false;
        }
        await sleep(1000);
    }

    const ended = await advanceUntilDialogEnd();
    if (!ended) {
        log.warn(`「${npc.name}」对话可能未正常结束`);
    }
    return true;
}

// ==================== 主流程 ====================

(async function () {
    try {
        setGameMetrics(1920, 1080, 1);

        npcConfigs = await loadNpcConfigs();
        log.info(`配置中共有 ${npcConfigs.length} 个NPC`);

        await resolveAccountName();
        log.info(`当前账户: ${accountName}`);

        const ignoreRecords = settings.ignoreRecords === true;
        if (ignoreRecords) {
            settings.ignoreRecords = false; // 一次性开关，运行后自动取消
        }

        await loadRecord();
        if (record.completed.length > 0) {
            log.info(`今日(${record.date})已完成: ${record.completed.join("、")}`);
        }

        // 筛选本次要处理的NPC
        let targets = npcConfigs.filter(n => n.enable);
        const onlyNames = (settings.onlyNpc || "").split(/[,\s、]+/).filter(s => s.trim() !== "");
        if (onlyNames.length > 0) {
            targets = targets.filter(n => onlyNames.includes(n.name));
            const missing = onlyNames.filter(name => !npcConfigs.some(n => n.name === name));
            if (missing.length > 0) {
                log.warn(`assets/npcs.json 中不存在: ${missing.join("、")}`);
            }
        }
        if (targets.length === 0) {
            log.warn("没有需要处理的NPC（请检查 npcs.json 的 enable 与“只运行指定NPC”设置）");
            return;
        }

        const total = targets.length;
        let index = 0;

        for (const npc of targets) {
            index++;
            const prefix = `[${index}/${total}]`;

            if (!ignoreRecords && record.completed.includes(npc.name)) {
                log.info(`${prefix} ${npc.name} 今日已完成，跳过`);
                continue;
            }

            log.info(`${prefix} 开始前往: ${npc.name}`);

            if (!npc.path) {
                log.error(`${npc.name} 未配置地图追踪路径（path）`);
                continue;
            }
            if (typeof file.isExists === "function" && !file.isExists(npc.path)) {
                log.error(`找不到地图追踪文件: ${npc.path}`);
                continue;
            }

            await genshin.returnMainUi();
            await sleep(600);

            const pathOk = await autoPath(npc.path);
            if (!pathOk) {
                log.error(`${npc.name} 的地图追踪执行失败，跳过`);
                continue;
            }
            await sleep(1000);

            // 进入对话
            const entered = npc.interact === "alt"
                ? await enterDialogByName(npc.name)
                : await enterDialogByF();

            if (!entered) {
                log.error(`未能与「${npc.name}」进入对话，跳过`);
                await genshin.returnMainUi();
                continue;
            }

            await sleep(800);
            if (!isDialogActive()) {
                // 再尝试按一次F（部分点位需要多按一次才进入对话）
                keyPress("VK_F");
                await sleep(1200);
            }
            if (!isDialogActive()) {
                log.error(`未能进入「${npc.name}」的对话，跳过`);
                await genshin.returnMainUi();
                continue;
            }

            const finished = await talkAndSelectOptions(npc);

            await genshin.returnMainUi();
            await sleep(500);

            if (finished) {
                if (!record.completed.includes(npc.name)) {
                    record.completed.push(npc.name);
                    await saveRecord();
                }
                log.info(`${prefix} 完成: ${npc.name}`);
            } else {
                log.warn(`${prefix} 未完成: ${npc.name}（未写入今日记录，可重试）`);
            }
        }

        log.info("=== 每日彩蛋自动领取 执行完成 ===");
    } catch (e) {
        log.error(`执行时发生错误: ${e.message}`);
    }
})();
