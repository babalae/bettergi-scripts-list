// 提升指南页面：导航、行扫描、秘境名识别、校准滑动、刷新
import { sX, sY, parkMouse, canonicalName, levDistance, touchActivity, assertAlive } from "../core/common.js";
import { guideMarkerCount, scanRowMarkers, disposeMarkers } from "../core/markers.js";
import { ocrText, clickTextInRegion, clickGuideButton, processMarker } from "./popup.js";

// 自动滑动的 y 值（用户标定）
const SWIPE_Y = 365;

// BGI 内置可传送秘境名（与 tp.json 一致），用于把行 OCR 到的文字标准化
const KNOWN_DOMAINS = [
  "铭记之谷", "忘却之峡", "仲夏庭园", "塞西莉亚苗圃", "无妄引咎密宫", "太山府",
  "震雷连山密宫", "孤云凌霄之处", "华池岩岫", "芬德尼尔之顶", "山脊守望", "菫色之庭",
  "椛染之庭", "砂流之庭", "沉眠之庭", "昏识塔", "缘觉塔", "有顶塔", "岩中幽谷",
  "赤金的城墟", "熔铁的孤塞", "深潮的余响", "苍白的遗荣", "罪祸的终末", "临瀑之城",
  "褪色的剧场", "蕴火的幽墟", "深古瞭望所", "虹灵的净土", "荒废砌造坞", "无光的深都",
  "霜凝的机枢", "失落的月庭", "月童的库藏", "山风的荆冕", "荒坠的圣迹", "逆悬的冰河",
  "妄念的创痕"
];

export function isGuidePage() {
  if (guideMarkerCount() > 0) return true;
  const title = ocrText(sX(400), sY(200), sX(300), sY(100), "页面标题OCR", "#00b0ff");
  return title.includes("提升指南");
}

export async function waitGuideMarkers(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const n = guideMarkerCount();
    if (n > 0) {
      log.info("检测到标注图标 {n} 个", n);
      return true;
    }
    await sleep(1000);
  }
  return false;
}

export async function ensureGuidePage() {
  if (isGuidePage()) {
    log.info("已在提升指南页面");
    return;
  }
  log.info("未检测到提升指南页面，自动打开");
  await genshin.returnMainUi();
  await sleep(800);
  keyPress("F1");
  await sleep(1500);

  if (!(await clickTextInRegion("秘境", sX(200), sY(350), sX(200), sY(150), 15000))) {
    throw new Error("未能找到冒险之证左侧的「秘境」按钮");
  }
  await sleep(1000);

  // 点完「秘境」后，先 OCR 找到并点击「提升指南」按钮（不用固定坐标）
  if (!isGuidePage()) {
    log.info("点击「提升指南」按钮");
    if (!(await clickGuideButton(15000))) {
      throw new Error("未能找到并点击「提升指南」按钮");
    }
    await sleep(800);
  }

  if (!(await waitGuideMarkers(30000))) {
    throw new Error("点击后 30 秒内未检测到标注图标，请检查游戏状态");
  }
  log.info("已进入提升指南页面");
}

export function qualityLabelForRank(rank) {
  return "rank" + rank;
}

export function sundayPosForX(x) {
  const rules = [[1, 1421], [2, 1336], [3, 1257]];
  for (const [pos, center] of rules) {
    if (Math.abs(x - sX(center)) <= sX(25)) return pos;
  }
  return 0;
}

export async function swipeRowRight(captureY) {
  const startX = sX(1100);
  const endX = sX(1400);
  log.info("[校准滑动] y={y} ({start}->{end})", captureY, startX, endX);

  let cap = null;
  try {
    cap = captureGameRegion();
    cap.moveTo(startX, captureY);
    await sleep(100);
    leftButtonDown();
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const x = startX + (endX - startX) * i / steps;
      cap.moveTo(Math.round(x), captureY);
      await sleep(20);
    }
    leftButtonUp();
  } catch (e) {
    log.error("[校准滑动] 失败: {err}", e.message);
  } finally {
    try { if (cap) cap.dispose(); } catch (e) { }
  }
  parkMouse();
  await sleep(1000);
}

export async function swipeRowPressHold(captureY) {
  const startX = sX(1400);
  const endX = startX - sX(400);
  log.info("[主力滑动] y={y} ({start}->{end})", captureY, startX, endX);

  let cap = null;
  try {
    cap = captureGameRegion();
    cap.moveTo(startX, captureY);
    await sleep(100);
    leftButtonDown();
    await sleep(400); // 按住0.4s
    const steps = 25;
    for (let i = 1; i <= steps; i++) {
      const x = startX + (endX - startX) * i / steps;
      cap.moveTo(Math.round(x), captureY);
      await sleep(16);
    }
    await sleep(400); // 划完不松手，保持0.4s
    leftButtonUp();
  } catch (e) {
    log.error("[主力滑动] 失败: {err}", e.message);
  } finally {
    try { if (cap) cap.dispose(); } catch (e) { }
  }
  // 松开后先等 400ms，让滑动手势完全结束，再移动鼠标去点空处
  await sleep(400);
  parkMouse();
  // 只在主力滑动后：点一下中心偏上的空处消除标注悬停放大，再等 500ms 让动画回落
  try {
    const [gw, gh] = getGameMetrics();
    click(Math.round(gw / 2), Math.round(gh / 6));
  } catch (e) { }
  await sleep(500);
}

export async function readDomainName(rowY) {
  const text = await ocrText(sX(760), rowY - sY(15), sX(300), sY(45), "行秘境名OCR", "#00b0ff");
  log.info("[秘境OCR] y={y}: {text}", rowY, text);

  // 1. 直接包含
  for (const d of KNOWN_DOMAINS) {
    if (text.includes(d)) return d;
  }

  // 2. 逐行与标准名做编辑距离匹配（如 OCR 把「菫」认成「董」）
  const lines = String(text).split(/\n/).map(s => s.trim()).filter(s => s.length >= 2);
  for (const line of lines) {
    for (const d of KNOWN_DOMAINS) {
      if (Math.abs(line.length - d.length) <= 1 && levDistance(line, d) <= 1) {
        log.info("[秘境OCR] {line} -> {d}", line, d);
        return d;
      }
    }
  }
  return "";
}

// 提升指南页右上角树脂：浓缩（单个数）+ 原粹（X/200）；坐标 1920 基准，经 sX/sY 换算
export async function readResin() {
  const condensedText = await ocrText(sX(1220), sY(200), sX(120), sY(50), "浓缩树脂OCR", "#ffc107");
  const originalText = await ocrText(sX(1350), sY(200), sX(140), sY(50), "原粹树脂OCR", "#ffc107");
  const firstInt = (t) => {
    const m = String(t || "").match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };
  const condensed = firstInt(condensedText);
  const original = firstInt(originalText);
  // 浓缩优先：1 个浓缩 = 1 次；原粹 40 一次
  const rounds = condensed + Math.floor(original / 40);
  log.info("[树脂] 浓缩 {c}，原粹 {o}，可刷 {r} 轮（浓缩优先，原粹40/轮）",
    condensed, original, rounds);
  return { condensed, original, rounds };
}

export async function refreshPlanFromGuide(entries, rowY) {
  log.info("重新扫描培养计划");
  await ensureGuidePage();

  // 与重开脚本完全一致：按 processRow 完整重扫该行
  const row = { index: 0, y: rowY, names: new Set(), nextRank: 1, domainName: "" };
  const before = entries.length;
  try {
    await processRow(row, entries);
  } catch (e) {
    if (String(e.message || "").includes("校准后仍识别不到标注")) {
      // 该行已无标注 = 需求已全部满足
      log.info("[刷新] 该行已无标注，视为全部满足");
    } else {
      log.error("[刷新] 重扫失败: {err}", e.message);
      return false;
    }
  }

  // 只保留本次重扫到的条目：没再出现的从清单移除（等价于重开脚本时它不存在）
  const seen = entries.slice(before);
  const seenByKey = new Map(seen.map(e => [canonicalName(e.material), e]));
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (Number(e.rowY) !== rowY) continue;
    if (seenByKey.get(canonicalName(e.material)) !== e) {
      entries.splice(i, 1);
    }
  }
  return true;
}

export async function clickAndRecord(m, row, entries) {
  const info = await processMarker(m);
  if (!info) return "";

  const key = canonicalName(info.name);
  if (row.names.has(key)) {
    log.info("[重复] {name} 已记录，跳过", info.name);
    // 返回 key：本轮“识别到了”这个材料，只是不重复入库
    return key;
  }

  row.names.add(key);
  touchActivity();
  // 品质按颜色绝对4档：金1/紫2/蓝3/绿4；颜色失败按点击顺序兜底
  const orderRank = row.nextRank++;
  let rank = orderRank;
  if (info.colorRankTop && info.colorRankTop >= 1 && info.colorRankTop <= 4) {
    rank = info.colorRankTop;
  }
  const label = qualityLabelForRank(rank);
  entries.push({
    material: info.name,
    category: info.category,
    source: info.source,
    have: info.have,
    need: info.need,
    needText: info.needText,
    synthText: info.synthText,
    synthCount: info.synthCount || 0,
    qualityRank: rank,
    qualityLabel: label,
    colorRankTop: info.colorRankTop || null,
    orderRank,
    domainName: row.domainName || "",
    sundayPos: sundayPosForX(m.cx),
    rowY: Math.round(row.y),
    clickX: Math.round(m.cx),
    clickY: Math.round(m.cy)
  });
  log.info("[品质] {name} {label}", info.name, label);
  return key;
}

export async function processRow(row, entries) {
  log.info("[行] 第 {n} 行 y={y}", row.index, row.y);
  touchActivity();

  // 0. 读该行秘境名，供后续自动秘境使用
  row.domainName = await readDomainName(row.y);
  if (!row.domainName) {
    log.info("未识别秘境名，执行校准");
    for (let i = 0; i < 3; i++) {
      await swipeRowRight(sY(SWIPE_Y));
    }
    row.domainName = await readDomainName(row.y);
  }
  log.info("[秘境] {domain}", row.domainName || "(未识别)");

  // 左→右校准两次
  await swipeRowRight(row.y);
  await swipeRowRight(row.y);
  log.info("校准完成");

  // 识别标注，失败则校准重试
  let ms0 = await scanRowMarkers(row.y, 3000);
  if (ms0.length === 0) {
    log.info("未识别标注，校准后重试");
    for (let i = 0; i < 3; i++) {
      await swipeRowRight(sY(SWIPE_Y));
    }
    ms0 = await scanRowMarkers(row.y, 5000);
    if (ms0.length === 0) {
      throw new Error("校准后仍识别不到标注（卡死 5 秒），自动结束脚本");
    }
  }
  disposeMarkers(ms0);
  log.info("[扫描] 识别到该行标注");

  // 点击该行可见标注（第 1 次识别）
  const firstNames = new Set();
  {
    assertAlive();
    let ms = await scanRowMarkers(row.y);
    try {
      ms.sort((a, b) => a.x - b.x);
      log.info("[扫描] 该行可见标注 {k} 个", ms.length);
      for (const m of ms) {
        assertAlive();
        const key = await clickAndRecord(m, row, entries);
        if (key) firstNames.add(key);
      }
    } finally {
      disposeMarkers(ms);
    }
  }

  // 两次主力滑动补扫；第 1 次滑动后识别到的材料与初始一致（含编辑距离≤1 的 OCR 错字）时，
  // 跳过第 2 次滑动直接恢复校准
  const sameSetFuzzy = (a, b) =>
    a.size === b.size && [...a].every(x => [...b].some(y => levDistance(x, y) <= 1));
  for (let s = 1; s <= 2; s++) {
    assertAlive();
    await swipeRowPressHold(row.y);

    let ms = await scanRowMarkers(row.y);
    try {
      if (ms.length === 0) {
        log.info("[滑动] 第 {s} 次后未发现标注", s);
        continue;
      }
      ms.sort((a, b) => a.x - b.x);
      log.info("[滑动] 第 {s} 次后识别 {k} 个标注", s, ms.length);
      const passNames = new Set();
      for (const m of ms) {
        const key = await clickAndRecord(m, row, entries);
        if (key) passNames.add(key);
      }
      if (s === 1 && firstNames.size > 0 && sameSetFuzzy(firstNames, passNames)) {
        log.info("[滑动] 识别结果与初始一致，跳过第 2 次滑动");
        break;
      }
    } finally {
      disposeMarkers(ms);
    }
  }

  // 恢复校准
  log.info("滑动识别完成，恢复校准");
  await swipeRowRight(row.y);
  await swipeRowRight(row.y);

  return row.names.size;
}
