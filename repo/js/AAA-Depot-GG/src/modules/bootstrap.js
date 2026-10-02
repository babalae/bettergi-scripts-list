/**
 * 启动前置校验。全部发生在「传送 / 按 T」之前，游戏不被操作。
 *
 * 四件事：
 *   1) 使用方法提示
 *   2) 保证每个分类目录都有「截图方法模板.png」，缺失则从标准 icon 图库复制
 *   3) 扫**料理 + 材料 两个目录的合集**，与下拉选项比对：
 *      - 有增减 → 改写 settings.json 刷新选项，默认项重置为模板，然后**停止**
 *      - 无增减 → 继续
 *   4) 判定选中项：
 *      - 选中模板 → 提示后**停止**（避免误存无关物品）
 *      - 选中文件不存在 → 按"有增减"处理：刷新 + 停止
 *      - 正常 → 返回选中项路径给识别层
 *
 * 分类由**选中图所在子目录**推断，不由用户选择。
 *
 * 所有 IO 均包 try/catch：失败只 warn 提示手动处理，不抛异常。
 */
import {
    DEFAULT_CATEGORY,
    ITEM_CATEGORIES,
    LIBRARY_TEMPLATE_PATH,
    SETTINGS_UI_FILE,
    TARGET_ITEM_DIR,
    TARGET_ITEM_SELECT,
    TEMPLATE_ITEM_LABEL,
    TEMPLATE_ITEM_NAME
} from "../constants.js";
import { basename, errorText, stripPng, withPng } from "../utils/common.js";
import { dbg } from "../utils/debuglog.js";
import { logLines } from "../utils/print.js";
import { WHO, notice } from "../utils/voice.js";

export const BOOT_OK = "ok";
export const BOOT_TEMPLATE_SELECTED = "template";
export const BOOT_REFRESHED = "refreshed";
export const BOOT_EMPTY_DIR = "empty";

/**
 * 打印使用方法（恒打，不再是设置项）。
 *
 * 行数按 BGI 真实行数算：一条 log.info = 2 行（时间戳 + 内容）。
 * 本函数 1 条标题 + 5 条正文 = 6 条 = 12 行。排版约束：
 *   - 不加分隔线（占 2 行且零信息）；
 *   - 箭头 `→` 收在行尾（`↓` 竖排每步多占 2 行）；
 *   - 每条控制在 ~38 显示格内，避免面板折行；
 *   - 「别选占位项」放在停止块里说（只有真没选时才需要）。
 *
 * 调用点在 task.js:runTask，且**只在确认要开工时**调用（停止类分支不打）。
 * 顺序按上手顺序：截图 → 归档 → 添加并配置 → 刷新并开工。
 */
export function printUsage() {
    logLines([
        `【${WHO.fatui} 征收须知 · 开工前点验】`,
        "① 截图：游戏里截一张要寄存的物品 →",
        "② 归档：丢进 目标物品/料理/ 或 材料/ →",
        "③ 添加并配置：加入脚本组，右键填按键与轮数 →",
        "④ 刷新并开工：先跑一次重写下拉，再选好物品启动",
        "分类不用选：图放哪个子目录，就点哪个页签"
    ]);
}

function categoryDirOf(category) {
    return `${TARGET_ITEM_DIR}/${category}`;
}

/** 枚举目录；返回 null 表示"当前 BetterGI 没有目录枚举 API" */
function listDir(dir) {
    try {
        if (typeof file !== "undefined" && typeof file.readPathSync === "function") {
            return file.readPathSync(dir) || [];
        }
        if (typeof file !== "undefined" && typeof file.ReadPathSync === "function") {
            return file.ReadPathSync(dir) || [];
        }
    } catch (error) {
        notice(`枚举目录失败：${dir}（${errorText(error)}）`);
    }
    return null;
}

/** 图片能否读到（读不到会抛异常，这里统一吞掉） */
function imageReadable(path) {
    try {
        if (typeof file === "undefined" || typeof file.readImageMatSync !== "function") {
            return false;
        }
        return !!file.readImageMatSync(path);
    } catch (error) {
        return false;
    }
}

/**
 * 下拉里显示成「刷新当前图库」，但"没选"这件事的判定要同时认它和旧的
 * 「截图方法模板」——老存档里存的是旧值，不能因为改名就判成"选中了一个不存在的物品"。
 */
function isTemplateValue(value) {
    const v = String(value == null ? "" : value).trim();
    return v === "" || v === TEMPLATE_ITEM_NAME || v === TEMPLATE_ITEM_LABEL;
}

/** 占位项在下拉里显示的文案（脚本重写选项 / 默认项都用它） */
function templateOptionLabel() {
    return TEMPLATE_ITEM_LABEL;
}

/** 扫目录，返回真实物品名（不含 .png、排除模板图、已排序）；无法枚举时返回 null */
export function scanItemNames(dir) {
    const entries = listDir(dir);
    if (!entries) {
        return null;
    }

    const names = [];
    for (const entry of entries) {
        if (typeof entry !== "string") continue;
        const base = basename(entry);
        if (!/\.png$/i.test(base)) continue;
        const name = stripPng(base);
        if (!name) continue;
        if (isTemplateValue(name)) continue; // 模板图（含下拉显示文案）不算候选
        if (names.indexOf(name) >= 0) continue;
        names.push(name);
    }

    names.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    return names;
}

/**
 * 扫**所有分类目录**，合成一份下拉名单，并记下每个名字属于哪个分类。
 *
 * 返回 { names, byName, duplicates }；当前 BetterGI 没有目录枚举 API 时返回 null。
 * 同名的图在两个目录里都有时，按 ITEM_CATEGORIES 的顺序（料理 优先）取第一个，
 * 并在日志里提示一声——真要用「材料」那份，把「料理」里那张删掉/改名即可。
 */
export function scanAllItems() {
    const byName = new Map();
    const duplicates = [];
    let haveEnum = false;

    for (const category of ITEM_CATEGORIES) {
        const dir = categoryDirOf(category);
        const names = scanItemNames(dir);
        if (!names) {
            continue;
        }
        haveEnum = true;
        for (const name of names) {
            if (byName.has(name)) {
                duplicates.push(`${name}（${byName.get(name).category} / ${category} 都有）`);
                continue;
            }
            byName.set(name, { name, category, dir, path: `${dir}/${withPng(name)}` });
        }
    }

    if (!haveEnum) {
        return null;
    }
    return { names: [...byName.keys()], byName, duplicates };
}

/**
 * 前置保障：分类目录里必须有「截图方法模板.png」。
 * 没有就从标准 icon 图库（Assets/RecognitionObject/截图方法模板.png）拷一份过去。
 * 拷贝失败只 warn —— 用户手动复制一张即可，不因此中断脚本。
 */
function ensureTemplateIcon(dir) {
    const target = `${dir}/${TEMPLATE_ITEM_NAME}.png`;
    if (imageReadable(target)) {
        return { ok: true, copied: false };
    }

    try {
        if (typeof file === "undefined" || typeof file.writeImageSync !== "function") {
            throw new Error("当前 BetterGI 没有 file.writeImageSync()");
        }
        const mat = file.readImageMatSync(LIBRARY_TEMPLATE_PATH);
        if (!mat) {
            throw new Error(`标准图库里读不到 ${LIBRARY_TEMPLATE_PATH}`);
        }
        if (!file.writeImageSync(target, mat)) {
            throw new Error("file.writeImageSync() 返回 false");
        }
        return { ok: true, copied: true };
    } catch (error) {
        return { ok: false, copied: false, error: errorText(error) };
    }
}

function loadSettingsUi() {
    try {
        if (typeof file === "undefined" || typeof file.readTextSync !== "function") {
            return null;
        }
        const arr = JSON.parse(file.readTextSync(SETTINGS_UI_FILE));
        return Array.isArray(arr) ? arr : null;
    } catch (error) {
        notice(`读取 settings.json 失败（${errorText(error)}），本次跳过下拉刷新`);
        return null;
    }
}

function saveSettingsUi(arr) {
    try {
        if (typeof file === "undefined" || typeof file.writeTextSync !== "function") {
            return false;
        }
        return !!file.writeTextSync(SETTINGS_UI_FILE, JSON.stringify(arr, null, 2));
    } catch (error) {
        notice(`写入 settings.json 失败（${errorText(error)}），请手动检查该文件`);
        return false;
    }
}

function findSelectDef(arr) {
    if (!arr) return null;
    for (const item of arr) {
        if (item && item.name === TARGET_ITEM_SELECT) {
            return item;
        }
    }
    return null;
}

/** 读取下拉里当前的选项（排除占位项）；读不到返回 null */
function readCurrentOptions() {
    const def = findSelectDef(loadSettingsUi());
    if (!def || !Array.isArray(def.options)) {
        return null;
    }
    return def.options.slice();
}

/** 下拉选项里的真实物品名（排除占位项那一条） */
function realOptions(options) {
    return (options || []).filter((n) => !isTemplateValue(n));
}

/** 直接改写 settings.json：重建下拉选项，默认项重置为模板 */
function writeRefreshedOptions(itemNames) {
    const arr = loadSettingsUi();
    const def = findSelectDef(arr);
    if (!def) {
        notice(`settings.json 里找不到下拉项「${TARGET_ITEM_SELECT}」，无法刷新选项`);
        return false;
    }
    def.type = "select";
    def.options = [templateOptionLabel()].concat(itemNames);
    def.default = templateOptionLabel();
    return saveSettingsUi(arr);
}

/**
 * 窗口里列名单：超过 maxShow 个就只列前几个 + "等"。
 *
 * 完整名单照旧进排障文件（`dbg`），窗口只给个样品 ——
 * 8 个物品名连起来接近 60 个字，BGI 面板一折行，一条就变 2 行（= 4 行窗口高度）。
 */
function briefNames(names, maxShow) {
    if (!names || names.length === 0) {
        return "（空）";
    }
    if (names.length <= maxShow) {
        return names.join("、");
    }
    return `${names.slice(0, maxShow).join("、")} 等`;
}

function diffNames(oldNames, newNames) {
    const added = newNames.filter((n) => oldNames.indexOf(n) < 0);
    const removed = oldNames.filter((n) => newNames.indexOf(n) < 0);
    return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

/** 变化摘要压成一句话（原来"新增：/ 移除："各占一行 = 4 行窗口高度） */
function diffBrief(diffNamesResult) {
    const parts = [];
    if (diffNamesResult.added.length > 0) {
        parts.push(`新增：${diffNamesResult.added.join("、")}`);
    }
    if (diffNamesResult.removed.length > 0) {
        parts.push(`移除：${diffNamesResult.removed.join("、")}`);
    }
    return parts.join("｜");
}

/**
 * 选中项判定后、确定要停止时打的日志块。
 *
 * **不带分隔线**：分隔线自己就占 2 行（时间戳 + 内容），却一个字都不携带。
 * 停止类的块本来就短，靠标题已经够醒目了。
 */
function logStopped(title, lines) {
    logLines([`【${title}】`].concat(lines, ["本次运行到此为止，尚未操作游戏。"]));
}

/**
 * 主流程。返回：
 *   { status: BOOT_OK,                 category, dir, itemName, itemPath, itemNames }
 *   { status: BOOT_TEMPLATE_SELECTED,  category, dir, itemNames }
 *   { status: BOOT_REFRESHED,          category, dir, itemNames, diff }
 *   { status: BOOT_EMPTY_DIR,          category, dir, itemNames }
 */
export function bootstrap() {
    // ---- 1) 模板图前置保障（每个分类目录都要有占位图）----
    const tplResults = ITEM_CATEGORIES.map((category) => Object.assign(
        { category, dir: categoryDirOf(category) },
        ensureTemplateIcon(categoryDirOf(category))
    ));
    const tplCopied = tplResults.filter((t) => t.copied).map((t) => t.category);
    const tplFailed = tplResults.filter((t) => !t.ok);

    // ---- 2) 扫目录（料理 + 材料 的合集）----
    const scanned = scanAllItems();

    // 老版本 BetterGI 没有目录枚举 API：不做刷新，退回"设置里填什么就用什么"
    if (!scanned) {
        notice("当前 BetterGI 没有 file.readPathSync()，跳过下拉刷新，按设置里的选中项继续");
        return bootstrapWithoutEnum();
    }

    const itemNames = scanned.names;
    const dirText = ITEM_CATEGORIES.map((c) => categoryDirOf(c)).join("　与　");
    if (scanned.duplicates.length > 0) {
        notice(`同名图出现在多个分类目录，按「${ITEM_CATEGORIES[0]}」优先处理：${scanned.duplicates.join("、")}`);
    }

    // ---- 3) 比对下拉选项 ----
    const currentOptions = readCurrentOptions();
    const currentReal = currentOptions ? realOptions(currentOptions) : null;

    // 读不到 settings.json 时当作"选项为空"处理，照常刷新（写失败会 warn）
    const diff = diffNames(currentReal || [], itemNames);

    if (diff.changed || currentReal === null) {
        const ok = writeRefreshedOptions(itemNames);
        const lines = [];
        if (currentReal === null) {
            lines.push("下拉选项尚未写入，已按目录内容重建");
        } else {
            lines.push(`检测到目录内容与下拉选项不一致：${diffBrief(diff)}`);
        }
        lines.push(`当前目录（${itemNames.length} 个）：${briefNames(itemNames, 3)}`);
        if (ok) {
            lines.push("已完成刷新：再启动一次本脚本，下拉里就是这份名单，选好即可正式运行。");
        } else {
            lines.push("刷新失败（见上方 warn），请手动检查 settings.json");
        }
        dbg(`[启动] 目标物品目录：${dirText}`);
        dbg(`[启动] 完整名单（${itemNames.length} 个）：${itemNames.length ? itemNames.join("、") : "（空）"}`);
        logStopped("下拉选项已刷新", lines);
        return { status: BOOT_REFRESHED, category: DEFAULT_CATEGORY, itemNames, diff, refreshed: ok };
    }

    // ---- 4) 判定选中项 ----
    const selected = String(settings[TARGET_ITEM_SELECT] || TEMPLATE_ITEM_LABEL).trim();

    if (isTemplateValue(selected)) {
        // 【窗口只留 4 条 = 8 行】
        //   停止块自带"本次运行到此为止"，所以这里只给 2 条正文：
        //   一条说"图从哪儿来"，一条说"下拉里选哪个"。通用说明书（6 条 = 12 行）
        //   在停止分支不打 —— 它跟这两条讲同一件事，重复一遍等于白占 12 行。
        //   完整名单（8 个连起来近 60 字，面板一折行又是 4 行）只列样品，其余用"等"带过。
        //   【这里刻意不 dbg 名单】：这一趟压根没操作游戏，本就不该产出排障日志，
        //   记一行进去反而会让收尾"有内容"、白白多提示一句落点（多占 2 行）。
        logStopped("未选择目标物品", [
            "截图丢进 目标物品/料理/ 或 材料/，再启动一次就进下拉 →",
            `下拉里选它，别选「${TEMPLATE_ITEM_LABEL}」（${itemNames.length} 个：${briefNames(itemNames, 2)}）`
        ]);
        return { status: BOOT_TEMPLATE_SELECTED, category: DEFAULT_CATEGORY, itemNames };
    }

    // 选中的名字不在目录里（多半是图片被删了）：按"有增减"处理，刷新后停止
    const entry = scanned.byName.get(selected);
    if (!entry) {
        const ok = writeRefreshedOptions(itemNames);
        const lines = [
            `选中的「${selected}」已经不在目录里（图片被移动或删除了）`,
            ok ? "已按当前目录内容刷新下拉选项，再启动一次脚本后重新选择即可"
                : "刷新失败（见上方 warn），请手动检查 settings.json"
        ];
        dbg(`[启动] 目标物品目录：${dirText}`);
        logStopped("目标物品已失效", lines);
        return { status: BOOT_REFRESHED, category: DEFAULT_CATEGORY, itemNames, missing: selected, refreshed: ok };
    }

    // 选中项存在但文件读不到（极端情况：枚举到了但读不了）
    if (!imageReadable(entry.path)) {
        const lines = [
            `目标物品目录：${entry.dir}`,
            `选中项「${selected}」的文件读不到：${entry.path}`,
            "",
            "请确认图片没有损坏；重新截一张丢进目录后，下次启动会自动加进下拉。"
        ];
        logStopped("目标物品无法读取", lines);
        return { status: BOOT_REFRESHED, category: entry.category, dir: entry.dir, itemNames, missing: selected, refreshed: false };
    }

    // ---- 通过 ----
    // 分类 = 选中图所在的子目录 → 装置界面的页签就点这一个。
    // 检查结果不进窗口：能返回到 BOOT_OK，调用方（task.js:runTask）直接往下跑即可，
    // 窗口里再报一句"检查通过"是冗余。图片路径、候选名单只落盘。
    dbg(`[启动] 图片路径：${entry.path}｜分类 ${entry.category}`);
    dbg(`[启动] 可选（${itemNames.length} 个）：${itemNames.length ? itemNames.join("、") : "（空）"}`);
    if (tplCopied.length > 0) {
        dbg(`[启动] 已自动补齐「${TEMPLATE_ITEM_NAME}.png」到：${tplCopied.join("、")}`);
    }
    if (tplFailed.length > 0) {
        // 真会影响运行（缺占位图 → 该分类无法刷新）→ 必须进窗口
        notice(`${tplFailed.map((t) => t.category).join("、")} 缺少「${TEMPLATE_ITEM_NAME}.png` +
            `」，请手动复制 ${LIBRARY_TEMPLATE_PATH}`);
    }
    return {
        status: BOOT_OK,
        category: entry.category,
        dir: entry.dir,
        itemName: entry.name,
        itemPath: entry.path,
        itemNames
    };
}

/** 没有目录枚举 API 时的退化路径：不做刷新，只用设置里的值（分类退回默认） */
function bootstrapWithoutEnum() {
    const dir = categoryDirOf(DEFAULT_CATEGORY);
    const selected = String(settings[TARGET_ITEM_SELECT] || TEMPLATE_ITEM_LABEL).trim();
    if (isTemplateValue(selected)) {
        logStopped("未选择目标物品", [
            `目标物品目录：${dir}`,
            `当前选中的是占位项「${templateOptionLabel()}」，请在自定义设置里改填真实的物品截图名`,
            "（当前 BetterGI 没有目录枚举 API，无法列出目录内容，只能手填）"
        ]);
        return { status: BOOT_TEMPLATE_SELECTED, category: DEFAULT_CATEGORY, dir, itemNames: [] };
    }

    const itemPath = `${dir}/${withPng(selected)}`;
    if (!imageReadable(itemPath)) {
        logStopped("目标物品无法读取", [
            `目标物品目录：${dir}`,
            `读不到：${itemPath}`,
            "请确认文件名填写正确（可以带 .png 也可以不带）"
        ]);
        return { status: BOOT_REFRESHED, category: DEFAULT_CATEGORY, dir, itemNames: [], missing: selected, refreshed: false };
    }

    dbg(`[启动] 无目录枚举 API，路径按 ${itemPath} 处理（分类按默认「${DEFAULT_CATEGORY}」）`);

    return { status: BOOT_OK, category: DEFAULT_CATEGORY, dir, itemName: selected, itemPath, itemNames: [selected] };
}
