/**
 * 识别层：把 Assets/RecognitionObject 下的 PNG 变成"屏幕上的一个框"。
 *
 * 对外主要三件事：
 *   - findTemplate(key)       找一个模板（按钮 / 提示类）
 *   - findTemplateBox(key)    找一个模板并带矩形（用来判"按钮有没有飘"）
 *   - findTargetFoodMatches() 找目标物品的**所有**命中（一屏可能有好几个长得像的）
 *
 * 三个关键设计：
 *   1) **阈值可以单独配**：全局 templateThreshold 兜底，单个模板可用 constants.js 里的
 *      threshold 覆盖，还能用设置项再覆盖一层。排查误匹配基本就是调它。
 *   2) **ROI 限定区域**：用屏幕比例（0~1）写，运行时按真实分辨率换算。
 *      给「确认」加 ROI 就是为了把它和底部的「确认存取」分开（两张图都含"确认"二字）。
 *   3) **彩色匹配**：目标物品默认开三通道。"奇怪的XX"是"美味的XX"整体压暗一档，
 *      灰度匹配（TM_CCOEFF_NORMED 会去均值）对整体变暗几乎免疫，只有彩色能分开。
 *
 * 缓存：模板 Mat 与识别对象都缓住；自适应阈值那一档只是换个数字重建 RO，不重复读盘。
 */
import { ASSET_DIR, DEFAULT_CATEGORY, TARGET_ITEM_DIR, TEMPLATE_DEFS } from "../constants.js";
import { readCheckbox, readInteger } from "./config.js";
import { basename, errorText, stripPng } from "../utils/common.js";
import { dbg } from "../utils/debuglog.js";
import { notice, accident } from "../utils/voice.js";

const templateCache = {};
const matCache = {};
let screenForRoi = null;

// 目标料理不依赖固定文件名：运行期扫描 目标物品/ 目录，用里面实际存在的 PNG。
// 用户把截图丢进文件夹就能用，改名 / 挪动也不会启动即崩。
const targetFoodMatCache = {};
let targetFoodDiscovered = null;

/**
 * bootstrap 确定的那一张目标物品图。
 * 设了就用它，不再"文件夹里有啥用啥"——避免把目录里别的图也当候选点进去。
 * 为 null 才退回目录扫描（老版本 BetterGI 没有枚举 API 时的兼容路径）。
 */
let targetFoodOverride = null;

export function setTargetFoodOverride(path) {
    targetFoodOverride = path ? String(path).replace(/\\/g, "/") : null;
    targetFoodDiscovered = null;
    for (const p of Object.keys(targetFoodMatCache)) delete targetFoodMatCache[p];
}

export function setScreen(screen) {
    screenForRoi = screen;
    // 每轮重新识别前清空目标料理的发现结果（目录内容可能变了）
    targetFoodDiscovered = null;
    for (const p of Object.keys(targetFoodMatCache)) delete targetFoodMatCache[p];
}

function defOf(key) {
    return TEMPLATE_DEFS[key] || { file: key, roi: null, threshold: null };
}

export function templateFileName(key) {
    const def = defOf(key);
    const override = def.fileSetting ? String(settings[def.fileSetting] || "").trim() : "";
    const raw = override || def.file;
    // 允许只填名字不带扩展名
    return /\.png$/i.test(raw) ? raw : `${raw}.png`;
}

/** 模板的完整相对路径；带 baseDir / subDirSetting 的会拼出子目录 */
export function templatePath(key) {
    const def = defOf(key);
    const name = templateFileName(key);
    if (def.baseDir) {
        const sub = String(settings[def.subDirSetting] || def.subDirFallback || "").trim();
        return sub ? `${def.baseDir}/${sub}/${name}` : `${def.baseDir}/${name}`;
    }
    return `${ASSET_DIR}/${name}`;
}

/** 全局阈值（百分数 → 小数）；单个模板可用 threshold / thresholdSetting 覆盖 */
function globalThreshold() {
    return readInteger("templateThreshold", 70, 50, 100) / 100;
}

function thresholdOf(key) {
    const def = defOf(key);
    if (def.thresholdSetting) {
        const raw = settings[def.thresholdSetting];
        if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
            const value = Number(raw);
            if (Number.isFinite(value) && value >= 50 && value <= 100) {
                return value / 100;
            }
        }
    }
    if (typeof def.threshold === "number") {
        return def.threshold;
    }
    return globalThreshold();
}

/** 是否彩色匹配：单个模板可用 use3ChannelsSetting 覆盖全局设置 */
function use3ChannelsOf(key) {
    const def = defOf(key);
    if (def.use3ChannelsSetting) {
        // 目标料理必须用彩色（三通道）才能区分"美味的"和"奇怪的"——压暗会改色相 / 饱和度，
        // 灰度对整体变暗几乎免疫，阈值再高也分不清。所以缺省也按彩色，显式设 false 才回退灰度；
        // 不靠"设置项有没有被 BGI 重新加载"来判断，免得改了 settings.json 没点刷新就退回灰度。
        return readCheckbox(def.use3ChannelsSetting, true);
    }
    return readCheckbox("use3Channels", false);
}

function resolveRoi(key) {
    const def = defOf(key);
    if (!def.roi || !screenForRoi) {
        return null;
    }

    // 目标料理的右半屏限定可以单独关掉
    if (key === "targetFood" && !readCheckbox("targetFoodRightHalfOnly", true)) {
        return null;
    }

    const width = screenForRoi.width;
    const height = screenForRoi.height;
    const x = Math.max(0, Math.round(def.roi.x * width));
    const y = Math.max(0, Math.round(def.roi.y * height));
    const w = Math.min(width - x, Math.round(def.roi.w * width));
    const h = Math.min(height - y, Math.round(def.roi.h * height));

    if (w <= 0 || h <= 0) {
        return null;
    }
    return { x, y, w, h };
}

function createRo(mat, roi) {
    if (roi) {
        return RecognitionObject.TemplateMatch(mat, roi.x, roi.y, roi.w, roi.h);
    }
    return RecognitionObject.TemplateMatch(mat);
}

/** 读取并缓存模板原图；自适应阈值时按不同阈值重建 RO 复用这张图，避免反复读盘 */
function getMat(key) {
    if (Object.prototype.hasOwnProperty.call(matCache, key)) {
        return matCache[key];
    }
    const path = templatePath(key);
    let mat = null;
    try {
        mat = file.ReadImageMatSync(path);
    } catch (error) {
        notice(`读取失败：${path}（${errorText(error)}）`);
    }
    matCache[key] = mat;
    return mat;
}

export function getTemplate(key) {
    if (Object.prototype.hasOwnProperty.call(templateCache, key)) {
        return templateCache[key];
    }

    const fileName = templateFileName(key);
    const threshold = thresholdOf(key);
    const roi = resolveRoi(key);
    const mat = getMat(key);
    let ro = null;

    if (mat) {
        ro = createRo(mat, roi);
        ro.threshold = threshold;
        ro.Use3Channels = use3ChannelsOf(key);
    }

    if (ro) {
        // 逐个模板报会把窗口刷爆：一条日志占 2 行，10 个模板就是 20 行。
        // 阈值 / 区域 / 彩色这套细节只在排障时看，统一走 dbg，正常运行不占版面。
        const regionText = roi ? `，限定区域 ${roi.x},${roi.y},${roi.w},${roi.h}` : "，全屏";
        const channelText = use3ChannelsOf(key) ? "彩色" : "灰度";
        dbg(`[Recognition] 已加载「${fileName}」（阈值 ${threshold}，${channelText}${regionText}）`);
    } else {
        notice(`「${fileName}」加载失败，请确认 ${templatePath(key)} 存在`);
    }

    templateCache[key] = ro;
    return ro;
}

/**
 * 扫描目标料理文件夹，返回实际存在的 PNG 相对路径数组。
 * 顶层 Assets/RecognitionObject/目标物品/ 优先；顶层没有任何 png 时，才退回 目标物品/{分类}/ 子目录。
 * 这样：
 *   - 用户把截图直接丢进 目标物品/ 根目录即可，改名 / 挪动也不会启动即崩；
 *   - 顶层有图时不会把分类子目录里的"奇怪的"之类干扰图也拉进来当候选，避免误点。
 * 老版本 BetterGI 没有 file.readPathSync 时，退回固定文件名。
 */
export function discoverTargetFoodPaths() {
    // 下拉已选定 → 只用那一张
    if (targetFoodOverride) {
        targetFoodDiscovered = [targetFoodOverride];
        return targetFoodDiscovered;
    }

    if (targetFoodDiscovered) {
        return targetFoodDiscovered;
    }

    const out = [];
    const seen = new Set();
    const push = (full) => {
        const norm = String(full).replace(/\\/g, "/");
        if (!/\.png$/i.test(norm)) return;
        if (seen.has(norm)) return;
        seen.add(norm);
        out.push(norm);
    };

    const baseDir = TARGET_ITEM_DIR;
    // 没有下拉选定（老版本 / 兼容路径）时按默认分类找；正常路径一律走 targetFoodOverride
    const category = DEFAULT_CATEGORY;
    const categoryDir = `${baseDir}/${category}`;
    const dirs = [baseDir, categoryDir]; // 顶层优先；顶层为空才退到分类子目录

    let haveEnum = false;
    if (typeof file !== "undefined" && (typeof file.readPathSync === "function" || typeof file.ReadPathSync === "function")) {
        haveEnum = true;
        for (const dir of dirs) {
            let entries = null;
            try {
                entries = (typeof file.readPathSync === "function") ? file.readPathSync(dir) : file.ReadPathSync(dir);
            } catch (error) {
                notice(`枚举目录失败：${dir}（${errorText(error)}）`);
                entries = null;
            }
            if (!entries) continue;
            for (const entry of entries) {
                if (typeof entry !== "string") continue;
                const full = (entry.indexOf("/") >= 0 || entry.indexOf("\\") >= 0)
                    ? entry
                    : `${dir}/${entry}`;
                push(full);
            }
            // 顶层已经有 png 就直接用，不再去分类子目录（避免把干扰图也拉进来当候选）
            if (out.length > 0) break;
        }
    }

    if (!haveEnum) {
        // 老版本 BetterGI 没有目录枚举 API：退回固定文件名，且只在文件确实读得到时才登记
        const legacy = templatePath("targetFood");
        let readable = false;
        try {
            readable = !!file.ReadImageMatSync(legacy);
        } catch (error) {
            readable = false;
            notice(`目标物品退回固定文件名失败：${legacy}（${errorText(error)}）`);
        }
        if (readable) {
            push(legacy);
            notice(`当前 BetterGI 版本没有 file.readPathSync，目标物品退回固定文件名「${templateFileName("targetFood")}」`);
        }
    }

    targetFoodDiscovered = out;
    return out;
}

/** 目标料理用到的设置（阈值 / ROI / 彩色），所有候选 PNG 共用 */
function targetFoodMeta() {
    return {
        threshold: thresholdOf("targetFood"),
        roi: resolveRoi("targetFood"),
        use3Channels: use3ChannelsOf("targetFood")
    };
}

/** 读取并缓存某张目标料理 PNG；文件缺失返回 null（调用方跳过即可） */
function getTargetFoodMat(path) {
    if (Object.prototype.hasOwnProperty.call(targetFoodMatCache, path)) {
        return targetFoodMatCache[path];
    }
    let mat = null;
    try {
        mat = file.ReadImageMatSync(path);
    } catch (error) {
        notice(`目标物品读取失败：${path}（${errorText(error)}）`);
    }
    targetFoodMatCache[path] = mat;
    return mat;
}

/**
 * 为目标料理构建识别对象（RO）数组：每张实际存在的候选 PNG 一张。
 * 没有候选 / 文件缺失时返回空数组。
 */
export function getTargetFoodRos(threshold) {
    const paths = discoverTargetFoodPaths();
    const meta = targetFoodMeta();
    const th = threshold != null ? threshold : meta.threshold;
    const ros = [];
    for (const p of paths) {
        const mat = getTargetFoodMat(p);
        if (!mat) continue;
        const ro = createRo(mat, meta.roi);
        ro.threshold = th;
        ro.Use3Channels = meta.use3Channels;
        ros.push(ro);
    }
    return ros;
}

/** 目标料理的"基线阈值"（设置项 targetFoodThreshold）——点击阶段降档的下限 */
export function targetFoodBaseThreshold() {
    return thresholdOf("targetFood");
}

/** 目标料理识别是否走彩色（三通道）——供测试与外部确认 */
export function targetFoodColorEnabled() {
    return use3ChannelsOf("targetFood");
}

/**
 * 目标物品日志用的名字：取选中那张 PNG 的文件名（**不带 .png**，与下拉里的选项一致）；
 * 什么都没发现时用设置里的兜底名。
 */
export function targetFoodPrimaryName() {
    const paths = discoverTargetFoodPaths();
    if (paths.length > 0) {
        return stripPng(basename(paths[0]));
    }
    return stripPng(templateFileName("targetFood"));
}

/**
 * 通用：对一张 RO 做模板匹配，返回所有命中框。
 * 优先用 region.findMulti（一次拿多个命中），没有该 API 时退化为单次 find 包成数组。
 */
function runFindMulti(ro) {
    if (typeof captureGameRegion !== "function") {
        throw new Error("当前 BetterGI 版本没有 captureGameRegion()，无法做模板匹配");
    }

    const region = captureGameRegion();
    let raw = null;
    try {
        if (typeof region.findMulti === "function") {
            raw = region.findMulti(ro);
        } else if (typeof region.FindMulti === "function") {
            raw = region.FindMulti(ro);
        } else if (typeof region.find === "function") {
            const one = region.find(ro);
            raw = (one && typeof one.isExist === "function" && one.isExist()) ? [one] : [];
        } else if (typeof region.Find === "function") {
            const one = region.Find(ro);
            raw = (one && typeof one.isExist === "function" && one.isExist()) ? [one] : [];
        } else {
            throw new Error("captureGameRegion() 不支持 findMulti()/find()");
        }
    } finally {
        if (region && typeof region.dispose === "function") region.dispose();
        if (ro && typeof ro.dispose === "function") ro.dispose();
    }

    if (raw == null) return [];
    const count = (typeof raw.count === "number") ? raw.count
        : (typeof raw.Count === "number") ? raw.Count
        : (Array.isArray(raw) ? raw.length : 0);

    const boxes = [];
    for (let i = 0; i < count; i += 1) {
        const r = raw[i];
        if (!r) continue;
        if (typeof r.isExist === "function" && !r.isExist()) continue;
        const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        const x = num(r.x), y = num(r.y), w = num(r.width), h = num(r.height);
        boxes.push({
            result: r, x, y, w, h, cx: x + w / 2, cy: y + h / 2,
            score: (typeof r.matchScore === "number") ? r.matchScore : 0
        });
    }
    return boxes;
}

/**
 * 目标料理的多候选匹配：对发现的每一张 PNG 都做一次匹配，合并所有命中框。
 * 返回 [{ result, x, y, w, h, cx, cy, score }]。
 */
export function findTargetFoodMatches(thresholdOverride) {
    const ros = getTargetFoodRos(thresholdOverride);
    const all = [];
    for (const ro of ros) {
        const boxes = runFindMulti(ro);
        for (const b of boxes) all.push(b);
    }
    return all;
}

/**
 * 自适应阈值（目标料理专用）：匹配到 2 个及以上位置时，逐步抬高阈值直到只剩 1 个，再返回。
 * 避免点到"看起来像"的第二个位置。返回 { matches, threshold, base }。
 */
export function findTargetFoodAdaptive(opts) {
    const o = opts || {};
    const step = (typeof o.step === "number") ? o.step
        : readInteger("adaptiveThresholdStep", 3, 1, 20) / 100;
    const max = (typeof o.max === "number") ? o.max
        : readInteger("adaptiveThresholdMax", 95, 70, 100) / 100;
    const base = thresholdOf("targetFood");
    let th = base;
    let matches = findTargetFoodMatches(th);
    let tries = 0;
    while (matches.length >= 2 && th + step <= max && tries < 30) {
        th += step;
        matches = findTargetFoodMatches(th);
        tries += 1;
    }

    // 关键：只抬到"刚好淘汰掉第二名"不够。
    // 被淘汰的那个（常常是「奇怪的XX」这类相似项）分数就卡在阈值边缘上，
    // 每帧截图有细微差异 → 它一会儿过线一会儿不过 → 命中在 1 个 / 2 个之间抖，
    // 表现成 (1371,750) ↔ (1510,750) 左右跳点，抖到相似项就是**误存**。
    // 所以再往上抬一档留余量；抬完若一个都不剩，就退回上一个还能用的阈值。
    if (matches.length >= 1 && th + step <= max) {
        const stricter = th + step;
        const retry = findTargetFoodMatches(stricter);
        if (retry.length >= 1) {
            th = stricter;
            matches = retry;
        }
    }

    return { matches, threshold: th, base };
}

/**
 * 找目标物品的图标位置（用于定位它下方的数量文字）。
 * 多个命中时取**分数最高**的那个；分数拿不到（BetterGI 的 Region 未必有 matchScore）
 * 时退化为"最靠上"，与点击侧的选点策略保持一致。
 * 返回 { result, x, y, w, h, cx, cy, score }；找不到返回 null。
 */
export function findTargetFoodBox(thresholdOverride) {
    const ros = getTargetFoodRos(thresholdOverride);
    const all = [];
    for (const ro of ros) {
        const boxes = runFindMulti(ro);
        for (const b of boxes) all.push(b);
    }
    if (all.length === 0) {
        return null;
    }
    all.sort((a, b) => (b.score - a.score) || (a.cy - b.cy) || (a.cx - b.cx));
    return all[0];
}

/**
 * 诊断用：把本次识别到的所有命中打成一串文字（位置 + 分数）。
 * 排查"左右跳点 / 点到奇怪的XX"时最有价值的一条信息。
 */
export function describeMatches(matches) {
    if (!matches || matches.length === 0) {
        return "无命中";
    }
    return matches
        .slice()
        .sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx))
        .map((m) => `(${m.cx.toFixed(0)},${m.cy.toFixed(0)})分${m.score.toFixed(2)}`)
        .join("  ");
}

/** 匹配一次，返回原始 result（可能不存在），由调用方判断 */
function rawFind(key) {
    const ro = getTemplate(key);
    if (!ro) {
        return null;
    }

    if (typeof captureGameRegion !== "function") {
        throw new Error("当前 BetterGI 版本没有 captureGameRegion()，无法做模板匹配");
    }

    const region = captureGameRegion();
    let result = null;
    try {
        if (typeof region.find === "function") {
            result = region.find(ro);
        } else if (typeof region.Find === "function") {
            result = region.Find(ro);
        } else {
            throw new Error("captureGameRegion() 不支持 find()/Find()");
        }
    } finally {
        if (region && typeof region.dispose === "function") {
            region.dispose();
        }
    }

    if (!result || typeof result.isExist !== "function" || !result.isExist()) {
        return null;
    }
    return result;
}

export function findTemplate(key) {
    return rawFind(key);
}

/**
 * 匹配并返回带矩形的结果，用于判断按钮有没有"飘"（弹窗动画期间位置会变）。
 * 返回 { result, x, y, w, h, cx, cy }；找不到返回 null。
 */
export function findTemplateBox(key) {
    const result = rawFind(key);
    if (!result) {
        return null;
    }
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const x = num(result.x);
    const y = num(result.y);
    const w = num(result.width);
    const h = num(result.height);
    return { result, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** 按给定顺序找模板，返回第一个命中的 { key, result }；全都没命中返回 null */
export function findFirstTemplate(keys) {
    for (const key of keys) {
        const result = findTemplate(key);
        if (result) {
            return { key, result };
        }
    }
    return null;
}

/**
 * 启动前置校验：必需素材齐不齐。
 * 缺任何一个都直接抛错 —— 宁可启动即停，也不要跑到一半才发现图没配好。
 * 目标物品不按固定文件名硬校验，只要求"目录里至少有一张 png"。
 */
export function checkRequiredTemplates(requiredKeys) {
    const missing = [];
    for (const key of requiredKeys) {
        if (key === "targetFood") {
            // 目标物品不按固定文件名硬校验；改为"目录里至少有一个 png"
            const paths = discoverTargetFoodPaths();
            if (paths.length === 0) {
                missing.push("目标物品目录下没有可识别的 PNG");
            }
            continue;
        }
        if (!getTemplate(key)) {
            missing.push(templateFileName(key));
        }
    }

    if (missing.length > 0) {
        for (const key of requiredKeys) {
            if (key === "targetFood") {
                const paths = discoverTargetFoodPaths();
                if (paths.length === 0) {
                    accident("缺少目标物品：Assets/RecognitionObject/目标物品/ 及其分类子目录下没有找到任何 .png 截图，请先放入要存入的物品截图");
                }
            } else if (!getTemplate(key)) {
                accident(`缺少素材：${templatePath(key)}`);
            }
        }
        throw new Error(`缺少必需模板素材：${missing.join("、")}`);
    }

    dbg(`[Recognition] 必需模板校验通过，共 ${requiredKeys.length} 个（目标物品候选 ${discoverTargetFoodPaths().length} 张）`);
}

export function disposeTemplates() {
    for (const key of Object.keys(templateCache)) {
        const ro = templateCache[key];
        if (ro && typeof ro.dispose === "function") {
            try {
                ro.dispose();
            } catch (error) {
                // 释放失败只影响内存回收，与运行结果无关 → 只落盘
                dbg(`[Recognition] 释放模板失败：${errorText(error)}`);
            }
        }
        delete templateCache[key];
    }
    for (const p of Object.keys(targetFoodMatCache)) delete targetFoodMatCache[p];
    targetFoodDiscovered = null;
}
