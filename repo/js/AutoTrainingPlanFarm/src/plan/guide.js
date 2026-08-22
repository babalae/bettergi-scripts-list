// 提升指南页面：导航、行扫描、秘境名识别、校准滑动、刷新
import { sX, sY, scaleX, scaleY, parkMouse, canonicalName, levDistance, touchActivity, assertAlive } from "../core/common.js";
import { debugFrameStart, debugBox } from "../core/debug-overlay.js";
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

// 树脂图标模板：透明背景已转纯绿 (0,255,0)，useMask=true 时绿色不参与匹配
const RESIN_CONDENSED_PATH = "assets/RecognitionObject/resin_condensed.png";
const RESIN_ORIGINAL_PATH = "assets/RecognitionObject/resin_original.png";
const RESIN_TEMPLATE_THRESHOLD = 0.9;

let resinCondensedMat = null;
let resinCondensedRo = null;
let resinOriginalMat = null;
let resinOriginalRo = null;
let resinDigitRos = null;

function ensureResinTemplates() {
  if (resinCondensedRo && resinOriginalRo && resinDigitRos) return;
  const loadResized = (path) => {
    let m = file.readImageMatSync(path);
    if (!m || m.empty() || m.width <= 0 || m.height <= 0) {
      throw new Error("树脂图标模板读取失败: " + path);
    }
    const tw = Math.max(4, Math.round(m.width * scaleX));
    const th = Math.max(4, Math.round(m.height * scaleY));
    if (tw !== m.width || th !== m.height) {
      const resized = new Mat();
      OpenCvSharp.OpenCvSharp.Cv2.Resize(m, resized, new OpenCvSharp.OpenCvSharp.Size(tw, th));
      try { m.dispose(); } catch (e) { }
      m = resized;
    }
    return m;
  };
  resinCondensedMat = loadResized(RESIN_CONDENSED_PATH);
  resinOriginalMat = loadResized(RESIN_ORIGINAL_PATH);
  resinCondensedRo = RecognitionObject.TemplateMatch(resinCondensedMat, true);
  resinOriginalRo = RecognitionObject.TemplateMatch(resinOriginalMat, true);
  resinCondensedRo.Threshold = RESIN_TEMPLATE_THRESHOLD;
  resinOriginalRo.Threshold = RESIN_TEMPLATE_THRESHOLD;

  // 浓缩数字用白色数字模板匹配（素材与 OCRCountResin 一致）
  resinDigitRos = [];
  for (let v = 0; v <= 5; v++) {
    const mat = loadResized("assets/RecognitionObject/num" + v + "_white.png");
    const ro = RecognitionObject.TemplateMatch(mat);
    ro.Threshold = 0.8;
    resinDigitRos.push({ ro, mat, value: v });
  }
}

export function disposeResinResources() {
  try {
    if (resinCondensedRo) {
      try { if (resinCondensedRo.TemplateImageGreyMat) resinCondensedRo.TemplateImageGreyMat.dispose(); } catch (e) { }
      try { if (resinCondensedRo.MaskMat) resinCondensedRo.MaskMat.dispose(); } catch (e) { }
      resinCondensedRo = null;
    }
  } catch (e) { }
  try {
    if (resinOriginalRo) {
      try { if (resinOriginalRo.TemplateImageGreyMat) resinOriginalRo.TemplateImageGreyMat.dispose(); } catch (e) { }
      try { if (resinOriginalRo.MaskMat) resinOriginalRo.MaskMat.dispose(); } catch (e) { }
      resinOriginalRo = null;
    }
  } catch (e) { }
  try { if (resinCondensedMat) resinCondensedMat.dispose(); } catch (e) { }
  try { if (resinOriginalMat) resinOriginalMat.dispose(); } catch (e) { }
  resinCondensedMat = null;
  resinOriginalMat = null;
  if (resinDigitRos) {
    for (const d of resinDigitRos) {
      try { if (d.ro.TemplateImageGreyMat) d.ro.TemplateImageGreyMat.dispose(); } catch (e) { }
      try { if (d.ro.MaskMat) d.ro.MaskMat.dispose(); } catch (e) { }
      try { if (d.mat) d.mat.dispose(); } catch (e) { }
    }
    resinDigitRos = null;
  }
}

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

// 树脂：图标模板定位 + 数字条 OCR；图标没匹配到时回退固定坐标区域
// 原淬白字预处理：单独截图，二值化 + 反色后 OCR（不污染主截图）
function ocrWhiteDigits(x, y, w, h) {
  let cap = null, crop = null, grey = null, bin = null, inv = null, bgr = null, res = null;
  try {
    cap = captureGameRegion();
    crop = cap.deriveCrop(x, y, w, h);
    grey = crop.srcMat.cvtColor(OpenCvSharp.OpenCvSharp.ColorConversionCodes.BGR2GRAY);
    bin = grey.threshold(180, 255, OpenCvSharp.OpenCvSharp.ThresholdTypes.Binary);
    inv = new Mat();
    OpenCvSharp.OpenCvSharp.Cv2.BitwiseNot(bin, inv);
    bgr = inv.cvtColor(OpenCvSharp.OpenCvSharp.ColorConversionCodes.GRAY2BGR);
    bgr.copyTo(crop.srcMat, null);
    res = crop.find(RecognitionObject.ocrThis);
    if (res && !res.isEmpty()) return (res.text || "").trim();
  } catch (e) {
    // 预处理失败，回退普通 OCR
  } finally {
    try { if (res) res.dispose(); } catch (e) { }
    try { if (bgr) bgr.dispose(); } catch (e) { }
    try { if (inv) inv.dispose(); } catch (e) { }
    try { if (bin) bin.dispose(); } catch (e) { }
    try { if (grey) grey.dispose(); } catch (e) { }
    try { if (crop) crop.dispose(); } catch (e) { }
    try { if (cap) cap.dispose(); } catch (e) { }
  }
  return "";
}

export async function readResin() {
  ensureResinTemplates();
  debugFrameStart();

  let condensed = 0;
  let digitInfo = "未命中";
  let originalText = "";
  let cap = null;
  let cRegion = null;
  let oRegion = null;
  let cScore = 0;
  let oScore = 0;
  try {
    parkMouse();
    cap = captureGameRegion();
    // 用 findMulti 取最高有限分：单个 find 的 matchScore 可能缺失/Infinity，导致误判未命中
    const pickBest = (ro) => {
      let results = null;
      let best = null;
      try {
        results = cap.findMulti(ro);
        for (let k = 0; k < results.count; k++) {
          const r = results[k];
          const s = Number(r.matchScore);
          if (!Number.isFinite(s)) {
            try { r.dispose(); } catch (e) { }
            continue;
          }
          if (!best || s > best.score) {
            if (best) { try { best.region.dispose(); } catch (e) { } }
            best = { score: s, region: r, x: r.x, y: r.y, w: r.width, h: r.height };
          } else {
            try { r.dispose(); } catch (e) { }
          }
        }
      } catch (e) {
        // 无候选
      }
      return best;
    };
    const cInfo = pickBest(resinCondensedRo);
    const oInfo = pickBest(resinOriginalRo);
    if (cInfo) {
      cRegion = cInfo.region;
      cScore = cInfo.score;
    }
    if (oInfo) {
      oRegion = oInfo.region;
      oScore = oInfo.score;
    }

    const readDigitsAt = (x, y, w, h) => {
      let res = null;
      try {
        res = cap.find(RecognitionObject.ocr(x, y, w, h));
        if (res && !res.isEmpty()) return (res.text || "").trim();
      } catch (e) {
        // 失败按空处理，外层回退
      } finally {
        try { if (res) res.dispose(); } catch (e) { }
      }
      return "";
    };

    if (cRegion && !cRegion.isEmpty()) {
      log.info("[树脂定位] 浓缩图标 @({x},{y},{w},{h}) 分={s}",
        cRegion.x, cRegion.y, cRegion.width, cRegion.height, cScore.toFixed(3));
      // 浓缩数字：白色数字模板匹配，验证区=图标左上角起 90x40
      const region = { x: cRegion.x, y: cRegion.y, w: sX(90), h: sY(40) };
      debugBox("浓缩数字区", region.x, region.y, region.w, region.h, "#448aff");
      let best = null;
      for (const d of resinDigitRos) {
        let r = null;
        try { r = cap.find(d.ro); } catch (e) { }
        if (!r || r.isEmpty()) {
          try { if (r) r.dispose(); } catch (e) { }
          continue;
        }
        const s = Number(r.matchScore);
        const ok = Number.isFinite(s) &&
          r.x >= region.x && r.x <= region.x + region.w &&
          r.y >= region.y && r.y <= region.y + region.h;
        if (!ok || (best && s <= best.score)) {
          try { r.dispose(); } catch (e) { }
          continue;
        }
        if (best) { try { best.region.dispose(); } catch (e) { } }
        best = { score: s, region: r, value: d.value, x: r.x, y: r.y, w: r.width, h: r.height };
      }
      if (best) {
        condensed = best.value;
        digitInfo = "值=" + best.value + " 分=" + best.score.toFixed(3) +
          " @(" + best.x + "," + best.y + "," + best.w + "," + best.h + ")";
        debugBox("浓缩数字" + best.value, best.x, best.y, best.w, best.h, "#ff4081");
        try { best.region.dispose(); } catch (e) { }
      }
    } else {
      log.warn("[树脂] 浓缩图标未命中，浓缩按 0");
    }

    if (oRegion && !oRegion.isEmpty()) {
      log.info("[树脂定位] 原淬图标 @({x},{y},{w},{h}) 分={s}",
        oRegion.x, oRegion.y, oRegion.width, oRegion.height, oScore.toFixed(3));
      // 数字起点在图标右缘左侧：左移 5px，130x50
      const x = oRegion.x + oRegion.width - sX(5);
      const y = Math.max(0, oRegion.y + Math.round((oRegion.height - sY(50)) / 2));
      debugBox("原淬数字条", x, y, sX(130), sY(50), "#ffc107");
      originalText = ocrWhiteDigits(x, y, sX(130), sY(50));
      if (!originalText) originalText = readDigitsAt(x, y, sX(130), sY(50));
      // 图标定位后的 OCR 为空时，回退 ResinCalibration 标定的固定区域（仅原淬）
      if (!originalText) {
        const oFx = sX(1350), oFy = sY(200), oFw = sX(140), oFh = sY(50);
        log.info("[树脂] 原淬图标定位 OCR 为空，回退固定区域 ({x},{y},{w},{h})", oFx, oFy, oFw, oFh);
        debugBox("原淬OCR(固定回退)", oFx, oFy, oFw, oFh, "#ffc107");
        originalText = readDigitsAt(oFx, oFy, oFw, oFh);
      }
    } else {
      debugBox("原淬树脂OCR(回退)", sX(1350), sY(200), sX(140), sY(50), "#ffc107");
      originalText = await ocrText(sX(1350), sY(200), sX(140), sY(50), "原粹树脂OCR", "#ffc107");
    }
  } finally {
    try { if (cRegion) cRegion.dispose(); } catch (e) { }
    try { if (oRegion) oRegion.dispose(); } catch (e) { }
    try { if (cap) cap.dispose(); } catch (e) { }
  }

  // 抗干扰：只保留数字和斜杠
  const cleanDigits = (t) => String(t || "").replace(/[^0-9/]/g, "");
  const firstInt = (t) => {
    const m = String(t || "").match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };

  let original = 0;
  {
    const raw = String(originalText || "").replace(/\s+/g, "");
    const m = raw.match(/(\d+)\/(\d+)/) || cleanDigits(originalText).match(/(\d+)\/(\d+)/);
    original = m ? parseInt(m[1], 10) : firstInt(cleanDigits(originalText));
  }

  // 浓缩优先：1 个浓缩 = 1 次；原粹 40 一次
  const rounds = condensed + Math.floor(original / 40);
  log.info("[树脂] 浓缩 {c}（{ci}），原淬 {o}（{ot}），可刷 {r} 轮（浓缩优先，原淬40/轮）",
    condensed, digitInfo, original, originalText, rounds);
  return { condensed, original, rounds };
}

export async function refreshPlanFromGuide(entries, rowY) {
  log.info("重新扫描培养计划");
  await ensureGuidePage();

  // 与重开脚本完全一致：按 processRow 完整重扫该行
  const row = { index: 0, y: rowY, names: new Map(), nextRank: 1, domainName: "" };
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

  // 该行重扫前的旧条目全部移除，以本次重扫结果为准（等价于重开脚本）
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (Number(e.rowY) !== rowY) continue;
    if (i < before) {
      entries.splice(i, 1);
    }
  }
  return true;
}

export async function clickAndRecord(m, row, entries) {
  const info = await processMarker(m);
  if (!info) return "";

  const key = canonicalName(info.name);
  const orderRank = row.nextRank;
  let rank = orderRank;
  if (info.colorRankTop && info.colorRankTop >= 1 && info.colorRankTop <= 4) {
    rank = info.colorRankTop;
  }

  let dup = false;
  for (const [k, rk] of row.names) {
    // 完全同名无条件去重；错 1 字只有品质档位相同才算重复，避免把“一角/一片”这类不同档合并
    if (k === key || (rk === rank && levDistance(k, key) <= 1)) {
      dup = true;
      break;
    }
  }
  if (dup) {
    log.info("[重复] {name} 已记录（含同档错1字），跳过", info.name);
    // 返回 key：本轮“识别到了”这个材料，只是不重复入库
    return key;
  }

  row.names.set(key, rank);
  row.nextRank = orderRank + 1;
  touchActivity();
  // 品质按颜色绝对4档：金1/紫2/蓝3/绿4；颜色失败按点击顺序兜底
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
