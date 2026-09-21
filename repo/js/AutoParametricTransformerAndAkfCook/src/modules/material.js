//作者：夜雨l星辰
// 材料模块：材料计划解析、分类页滚动查找、数量调整与放入参量质变仪

import { config } from "../config.js";
import { textOCREnhanced, imageRecognitionEnhanced } from "./vision.js";

// ===== 放入材料界面按钮（「最大」保留固定坐标；「增加/减少」用图像识别定位）=====
const BTN_MAX = { x: 440, y: 1008 };      // 「最大」数量按钮（AutoMonday 验证坐标）
const BTN_TRANSFORM = { x: 1792, y: 1019 }; // 「进行质变」按钮（AutoMonday 验证坐标）
const BTN_CONFIRM = { x: 1183, y: 764 };    // 质变确认按钮（推测，需实测校准）
const SCROLL_AREA_X = 1287;                 // 材料列表滚动条区域X（AutoMonday 验证）
const SCROLL_AREA_TOP = 131;                // 材料列表滚动条区域顶部Y
const SCROLL_AREA_BOTTOM = 161;             // 材料列表滚动条区域底部Y（初始）

// ===== 图像识别定位「增加/减少」按钮 =====
export async function locateAdjustButton(pngName) {
    // 搜索区域只覆盖加减按钮（x100-380），排除「最大」按钮及其右侧干扰；阈值0.9防止误匹配
    const res = await imageRecognitionEnhanced(
        "Assets/RecognitionObject/" + pngName,
        2, 0, 0, 100, 900, 280, 180, true, 0, 0, 0.9
    );
    if (res.found) {
        log.info("已定位按钮: " + pngName + " (" + res.x + "," + res.y + ")");
        return { x: res.x, y: res.y };
    }
    log.error("未识别到按钮: " + pngName);
    return null;
}

// ===== 分类标签常量（1=养成道具 2=食物 3=材料）=====
const CATEGORY_TABS = {
    1: { label: "养成道具", x: 863, y: 47 },
    2: { label: "食物", x: 959, y: 45 },
    3: { label: "材料", x: 1050, y: 50 }
};
const ALL_CATEGORIES = [1, 2, 3];
let currentCategory = 0; // 当前已切换到的分类页，0 表示未切换过

// ===== 解析页配置（支持 "1"、"一"、"养成道具" 等单个分类页；若写了组合则取第一个字）=====
export function parseCategoryPages(str) {
    if (!str) return null;
    const map = { "养成道具": 1, "食物": 2, "材料": 3, "1": 1, "2": 2, "3": 3, "一": 1, "二": 2, "三": 3 };
    const s = String(str).trim();
    // 先整体匹配（"养成道具"、"食物"、"材料"、"1"、"一"等）
    if (map[s]) return [map[s]];
    // 组合写法取第一个有效字符（"一二三"→"一"→1，"2,3"→"2"→2）
    for (const ch of s) {
        if (map[ch]) return [map[ch]];
    }
    return null;
}

// ===== 解析材料计划字符串（"材料名数量@页,材料名数量@页"，数量支持 max/最大，@页可选：单个分类页，不写则默认从分类3到1依次找）=====
// 容错：全角数字转半角、max 大小写统一；任一字段漏写/写错均收集到 errors，由调用方在开始前终止任务
export function parseMaterialPlan(plan) {
    const errors = [];
    if (!plan) return { list: [], errors: errors };
    const list = [];
    // 全角数字/空格转半角（手机输入常见），统一 max 大小写
    const norm = String(plan)
        .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/\u3000/g, " ")
        .replace(/max/gi, "max");
    const parts = norm.split(/[,，]/);
    for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        const m = p.match(/^(.+?)(\d+|max|最大)\s*(?:[@＠]\s*(.+))?$/);
        if (m) {
            const rawName = m[1].trim();
            const countStr = m[2];
            // 名字纯数字/无有效文字 → 判定漏写材料名
            if (!/[\u4e00-\u9fa5a-zA-Z]/.test(rawName)) {
                errors.push("材料计划缺少材料名: " + p);
                continue;
            }
            const count = (countStr === "max" || countStr === "最大") ? "max" : parseInt(countStr, 10);
            if (count === 0) {
                errors.push("材料数量为0: " + p);
                continue;
            }
            const pages = parseCategoryPages(m[3]);
            if (m[3] && !pages) {
                errors.push("分类页写法无法识别: " + rawName + " @ " + m[3]);
                continue;
            }
            list.push({ name: rawName, count: count, pages: pages });
        } else {
            errors.push("材料计划格式无法解析: " + p);
        }
    }
    return { list: list, errors: errors };
}

// ===== 切换到对应分类标签（记录当前页，已在该页则跳过点击）=====
export async function switchCategory(cat) {
    if (currentCategory === cat) return;
    const tab = CATEGORY_TABS[cat];
    if (!tab) { log.warn("未知分类页: " + cat); return; }
    await click(tab.x, tab.y);
    await sleep(1000);
    currentCategory = cat;
}

// ===== 在指定页的列表中滚动查找目标材料并点击；查不到自动换下一页 =====
export async function findMaterialInCategory(cat, materialName) {
    await switchCategory(cat);
    log.info("正在分类页 " + cat + "(" + CATEGORY_TABS[cat].label + ") 查找: " + materialName);

    // 滚动条预操作（按住列表向下拖动一下，保证从顶部开始）
    await moveMouseTo(SCROLL_AREA_X, SCROLL_AREA_TOP);
    await sleep(100);
    await leftButtonDown();
    await sleep(100);
    await moveMouseTo(SCROLL_AREA_X, SCROLL_AREA_BOTTOM);
    await sleep(200);

    let YOffset = 0;
    const maxRetries = 20;
    for (let retries = 0; retries < maxRetries; retries++) {
        const res = await imageRecognitionEnhanced(
            "Assets/RecognitionObject/" + materialName + ".png",
            1, 0, 0, 115, 115, 1155, 845, true
        );
        if (res.found) {
            await leftButtonUp();
            await sleep(500);
            await click(res.x, res.y);
            await sleep(1200);
            log.info("已选中材料: " + materialName + "（分类页" + cat + "）");
            return true;
        }
        if (retries === maxRetries - 1 || SCROLL_AREA_BOTTOM + YOffset > 1080) {
            await leftButtonUp();
            await moveMouseTo(SCROLL_AREA_X, SCROLL_AREA_TOP);
            log.warn("分类页" + cat + "滚动到底仍未找到: " + materialName);
            return false;
        }
        YOffset += 50;
        await sleep(500);
        await moveMouseTo(SCROLL_AREA_X, SCROLL_AREA_BOTTOM + YOffset);
        await sleep(300);
    }
    await leftButtonUp();
    return false;
}

// ===== 选择材料：有@页按指定页查找，未指定默认从分类3(材料)到1(养成道具)依次找 =====
export async function selectMaterial(item) {
    const name = item.name;
    let pages = (item.pages && item.pages.length) ? item.pages : null;
    if (!pages) {
        pages = [3, 2, 1];
        log.info("未指定页，默认从分类3(材料)到1(养成道具)依次找");
    }
    for (const cat of pages) {
        if (await findMaterialInCategory(cat, name)) return true;
    }
    log.error("所有分类页均未找到: " + name);
    return false;
}

// ===== OCR 读取加减按钮中间的数量数字（数字框位置由加减按钮中心动态推导）=====
export async function readCurrentCount(btnMinus, btnPlus) {
    try {
        let x, y, w, h;
        if (btnMinus && btnPlus) {
            // 数字框在加减按钮中间：水平范围取减号中心到加号中心，垂直以按钮中心为基准上下各扩35
            const cx = Math.round((btnMinus.x + btnPlus.x) / 2);
            const cy = Math.round((btnMinus.y + btnPlus.y) / 2);
            const bw = Math.max(btnPlus.x - btnMinus.x, 60);
            x = cx - Math.round(bw / 2);
            y = cy - 35;
            w = bw;
            h = 70;
        } else {
            x = 65; y = 900; w = 190; h = 60;   // 兜底：无按钮坐标时用原绝对区域
        }
        const r = await textOCREnhanced("", 0.8, 0, 0, x, y, w, h);
        if (r.found && r.text) {
            const m = String(r.text).match(/\d+/);
            if (m) return parseInt(m[0], 10);
        }
    } catch (e) { log.warn("读取数量OCR异常: " + e.message); }
    return null;
}

// ===== 调整已选中材料的数量到目标值（OCR数字校准 + 按住+10递增 + 接近后单点微调）=====
export async function adjustMaterialCount(count) {
    if (count === "max") {
        await click(BTN_MAX.x, BTN_MAX.y);   // 选最大
        await sleep(1000);
        log.info("数量已选择: 最大");
        return true;
    }
    const target = parseInt(count, 10);
    if (!target || target <= 0) return true;

    // 图像识别定位「增加」「减少」按钮（locateAdjustButton 返回中心坐标）
    const btnPlus = await locateAdjustButton("增加.png");
    if (!btnPlus) return false;
    const btnMinus = await locateAdjustButton("减少.png");
    if (!btnMinus) return false;

    // 读取当前数量，读不到则按默认1处理
    let cur = await readCurrentCount(btnMinus, btnPlus);
    if (cur === null) { log.warn("数量OCR未读到，按默认1处理"); cur = 1; }
    log.info("当前数量: " + cur + "，目标: " + target);

    // 按住「增加」连续+1（游戏内按住会逐渐加速），停止条件以OCR回读数字为准：
    // 每段按住后回读，用本段实测增量自适应推算下一段按住时长（速率变快则自动缩短），接近目标转单点微调
    let holdMs = 400;    // 首段按住时长（毫秒）
    let lastDelta = 13;  // 首段增量估算（约30ms/+1），仅作起点，后续用实测值
    while (target - cur > 12) {
        await moveMouseTo(btnPlus.x, btnPlus.y);
        await sleep(100);
        await leftButtonDown();
        await sleep(holdMs);
        await leftButtonUp();
        await sleep(400);
        const after = await readCurrentCount(btnMinus, btnPlus);
        if (after === null) {
            log.error("数量OCR读取失败，无法校准，任务终止");
            return false;
        }
        const delta = after - cur;
        cur = after;
        log.info("按住增加后数量: " + cur + "（本段+" + delta + "，按住" + holdMs + "ms）");
        // 用本段实测速率外推下一段按住时长，预留10个余量，上限1.5秒防过冲
        if (delta > 0) {
            holdMs = Math.min(Math.max((target - cur - 10) * holdMs / delta, 150), 1500);
            lastDelta = delta;
        }
    }

    // 余数单点微调：差值<=12 后点一次+1，直到达到目标
    let guard = 0;
    while (cur < target && guard < 20) {
        await click(btnPlus.x, btnPlus.y);
        await sleep(300);
        const after = await readCurrentCount(btnMinus, btnPlus);
        if (after === null) {
            log.error("数量OCR读取失败，无法校准，任务终止");
            return false;
        }
        cur = after;
        guard++;
    }

    // 若超了，用「减少」回调
    guard = 0;
    while (cur > target && guard < 20) {
        await click(btnMinus.x, btnMinus.y);
        await sleep(300);
        const after = await readCurrentCount(btnMinus, btnPlus);
        if (after === null) {
            log.error("数量OCR读取失败，无法校准，任务终止");
            return false;
        }
        cur = after;
        guard++;
    }

    log.info("数量已调整为: " + cur);
    await sleep(500);
    return true;
}

// ===== 放入材料（多材料逐项识别、按量分配、质变确认）=====
export async function insertMaterial() {
    const parsed = parseMaterialPlan(config.materialPlanStr);
    if (parsed.errors.length > 0) {
        log.error("材料计划存在漏写/写错，任务已终止:");
        for (const err of parsed.errors) log.error("  - " + err);
        return false;
    }
    const plan = parsed.list;
    if (plan.length === 0) {
        log.warn("未配置有效材料计划，跳过放入");
        return false;
    }
    log.info("材料计划: " + plan.map(p => p.name + "x" + p.count).join(", "));

    // 逐项选择材料并调整数量
    for (const item of plan) {
        const selected = await selectMaterial(item);
        if (!selected) {
            log.error("材料未找到，任务终止: " + item.name);
            return false;
        }
        const countOk = await adjustMaterialCount(item.count);
        if (!countOk) {
            log.error("数量调整失败，任务终止: " + item.name);
            return false;
        }
    }

    // 全部放入后点「进行质变」
    await sleep(500);
    await click(BTN_TRANSFORM.x, BTN_TRANSFORM.y);
    await sleep(1200);

    // OCR 确认进入质变确认界面
    const confirmPanel = await textOCREnhanced("参量质变仪", 3, 0, 0, 828, 253, 265, 73);
    if (!confirmPanel.found) {
        log.warn("未检测到质变确认界面，请检查材料是否已放入");
        return false;
    }
    await sleep(500);
    await click(BTN_CONFIRM.x, BTN_CONFIRM.y); // 确认开始质变
    await sleep(1500);
    log.info("材料已放入，质变开始");
    return true;
}
