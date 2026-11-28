// ==============================================
// 合成台平衡怪物材料（新js块）
// 在首次背包扫描完成后调用：
//   1. 按 targetCount 把每个怪物的三级材料(低/中/高)自底向上合成(3:1)：
//      先从低级开始合成(低级→中级)，低级只允许使用超出 targetCount 的部分；
//      再用中级补高级(中级→高级)
//   2. 去璃月合成台(OCR识别"合成"进入)
//   3. 用 genshin.craftMaterial 逐个执行合成
// 依赖(全局)：monsterToMaterials(低/中/高顺序)、targetCount、settings、log
// ==============================================

const ALCHEMY_BENCH_PATH = "assets/Pathing/璃月合成台.json";
const ALCHEMY_CATEGORY = "角色与武器培养素材"; // 怪物掉落素材所属合成分类

// 计算平衡方案：让每个怪物的三级材料(低/中/高)自底向上"流通"，尽量使三级都达到 targetCount
// 返回 [{ monsterName, low, med, high, L, M, H, achieved, ops:[{material,count}] }]
// 约定：3低级→1中级→1高级；每级保留 targetCount 库存，只把超出部分向上合成
function computeAlchemyPlan(flatCounts) {
    // flatCounts: [{ name, count }]，count 可能是字符串/数字/"?"
    const countMap = {};
    for (const item of flatCounts) {
        if (item.count === "?" || item.count === undefined) continue;
        const n = Number(item.count);
        if (Number.isFinite(n)) countMap[item.name] = n;
    }

    const seen = new Set();
    const plan = [];
    const T = targetCount;
    for (const monsterName in monsterToMaterials) {
        const mats = monsterToMaterials[monsterName];
        if (!mats || mats.length < 3) continue;
        const low = mats[0], med = mats[1], high = mats[2];
        const key = low + "|" + med + "|" + high;
        if (seen.has(key)) continue;
        seen.add(key);

        if (countMap[low] === undefined || countMap[med] === undefined || countMap[high] === undefined) continue;

        const L0 = countMap[low], M0 = countMap[med], H0 = countMap[high];
        const ops = [];

        // 让三级材料"流通"：保留每级 T 库存，把超出部分逐级向上补足上一级缺口
        // 高级缺口所需中级，优先用中级超出部分，不足时再用低级超出部分(低级→中级→高级)
        const xLow = Math.floor(Math.max(0, L0 - T) / 3);                 // 低级超出部分最多能合成的中级数
        const yMax = Math.floor(Math.max(0, M0 + xLow - T) / 3);          // 保留中级 T 的前提下最多能合成的高级数
        const doHigh = Math.min(Math.max(0, T - H0), yMax);               // 实际合成高级数(只补缺口，不过量合成)
        const doMed = Math.min(xLow, Math.max(0, T - M0 + doHigh * 3));   // 实际合成中级数(把中级补到 T 并为高级供给 doHigh*3)

        const L = L0 - doMed * 3;
        const M = M0 + doMed - doHigh * 3;
        const H = H0 + doHigh;

        // 执行顺序：先低级→中级，再中级→高级（从更低级开始合成）
        if (doMed > 0) ops.push({ material: med, count: doMed });
        if (doHigh > 0) ops.push({ material: high, count: doHigh });

        // 三级都 >= T 视为该怪材料整体达标（不再属于低数量材料）
        const achieved = L >= T && M >= T && H >= T;
        plan.push({ monsterName, low, med, high, L, M, H, achieved, ops });
    }
    return plan;
}

// 把"流通合成后"的预计数量写回扫描结果，供低数量筛选/超量名单同步使用（就地把 count 覆写为合成后的预测值）
function applyAlchemyProjection(flatCounts, plan) {
    const idxByName = {};
    flatCounts.forEach((it, i) => { if (idxByName[it.name] === undefined) idxByName[it.name] = i; });
    for (const item of plan) {
        if (item.low in idxByName) flatCounts[idxByName[item.low]].count = item.L;
        if (item.med in idxByName) flatCounts[idxByName[item.med]].count = item.M;
        if (item.high in idxByName) flatCounts[idxByName[item.high]].count = item.H;
    }
}

// 首次去合成台：用官方内置路径（传送+交互进入）
async function enterAlchemyBench() {
    log.info("[合成台] 前往合成台（官方路径）");
    await genshin.goToCraftingBench("璃月");
    await sleep(1500);
    return true;
}

// F对话图标模板（复用背包统计现成的 F_Dialogue.png 识别右侧F交互提示）
let _fDialogueRo = null;
function getFDialogueRo() {
    if (!_fDialogueRo) {
        _fDialogueRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync("assets/F_Dialogue.png"),
            1102, 335, 34, 400
        );
    }
    return _fDialogueRo;
}

// 释放截图帧（兼容 Dispose/dispose 两种命名）
function disposeRa(ra) {
    if (!ra) return;
    try {
        if (ra.Dispose) ra.Dispose();
        else if (ra.dispose) ra.dispose();
    } catch (e) {}
}

// 等合成材料界面加载出来（对齐官方IsInCraftingUi：同时出现"合成"标题和"筛选"才算就绪）
async function waitForCraftUi() {
    for (let i = 0; i < 50; i++) {
        const ra = captureGameRegion();
        const list = ra.findMulti(RecognitionObject.ocrThis);
        let hasScreen = false, hasFilter = false;
        for (let j = 0; j < list.count; j++) {
            const t = list[j].text;
            if (t.includes("合成")) hasScreen = true;
            if (t.includes("筛选")) hasFilter = true;
        }
        disposeRa(ra);
        if (hasScreen && hasFilter) return true;
        await sleep(100);
    }
    return false;
}

// 主入口：首次背包扫描完成后调用
// 就地修改 flatCounts：把每个怪物三级材料写回"流通合成后"的预测数量（用于达标判定与超量同步）
async function balanceMonsterMaterialsByAlchemy(flatCounts) {
    // 开关已并入 Pathing 的【合成台平衡】，由 main.js 写入 globalThis.pathingMode.alchemyBalance
    const mode = globalThis.pathingMode || null;
    if (!mode || !mode.alchemyBalance) return;
    log.info(`[合成台平衡] 目标数：${targetCount}`);

    const plan = computeAlchemyPlan(flatCounts);

    // 先做数量投影：合成前把三级材料流通后的预测数量写回，供后续低数量/超量判定使用
    applyAlchemyProjection(flatCounts, plan);

    // 收集需要实际执行的操作（只包含确实要合成的）
    const craftItems = plan.filter(item => item.ops.length > 0);
    if (craftItems.length === 0) {
        log.info("[合成台平衡] 无需合成（三级材料已达标或无法补足）");
        return;
    }
    for (const item of craftItems) {
        log.info(`[合成台平衡] ${item.monsterName}：${item.ops.map(op => `${op.material}x${op.count}`).join("，")}（流通后 低${item.L}/中${item.M}/高${item.H}${item.achieved ? "，达标" : ""}）`);
    }

    const entered = await enterAlchemyBench();
    if (!entered) return;

    for (const item of craftItems) {
        for (const op of item.ops) {
            if (debugLog) log.info(`[合成台平衡] 合成 ${op.material} x ${op.count}`);
            try {
                await genshin.craftMaterial(op.material, op.count, ALCHEMY_CATEGORY);
            } catch (e) {
                log.error(`[合成台平衡] ${op.material} 合成失败：${e.message}`);
            }
        }
    }
    await genshin.returnMainUi();
    log.info("[合成台平衡] 完成");
}
