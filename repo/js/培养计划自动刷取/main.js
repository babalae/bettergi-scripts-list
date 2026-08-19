// 培养计划自动刷取 v0.1
// 阶段1：读取冒险之证-秘境-提升指南页面上的培养计划标注，保存需求清单。
// 阶段2（后续）：按来源映射执行自动秘境/首领/采集。
// 坐标基准：1920x1080（与用户提供的截图一致）。

const MARKER_PATH = "assets/RecognitionObject/guide_marker_green.png";

// 弹窗整体 OCR 区域：扩大覆盖弹窗可能出现的范围
const POPUP_OCR_RECT = { x: 710, y: 55, w: 500, h: 960 };

// 右半屏搜索区域
const MARKER_ROI = { x: 900, y: 280, w: 1020, h: 600 };

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

let markerMat = null;
let markerRo = null;
let matchThreshold = 0.9;

// 8 秒无操作看门狗
let lastActivity = Date.now();
function touchActivity() {
  lastActivity = Date.now();
}
function assertAlive() {
  if (Date.now() - lastActivity > 8000) {
    throw new Error("8 秒无操作，超时退出");
  }
}

// 截图/OCR 前把鼠标移到游戏窗口 (宽/2, 高/6)，避免光标遮挡识别区域（按当前游戏分辨率计算）
function parkMouse(corner) {
  try {
    const [gw, gh] = getGameMetrics();
    moveMouseTo(Math.round(gw / 2), Math.round(gh / 6));
  } catch (e) { }
}

function canonicalName(name) {
  return String(name || "").replace(/[「」『』\[\]（）()]/g, "").trim();
}

function getS(name, def) {
  const v = settings ? settings[name] : undefined;
  return v === undefined || v === null ? def : v;
}

// 分辨率适配：所有 1920x1080 参考坐标按实际截图尺寸缩放
let scaleX = 1;
let scaleY = 1;
let swipeYOffset = 0;
function sX(v) { return Math.round(v * scaleX); }
function sY(v) { return Math.round(v * scaleY); }
function capToGameX(v) { return Math.round(v / scaleX); }
function capToGameY(v) { return Math.round(v / scaleY); }
// 行 y（截图坐标）转滑动用游戏坐标，并叠加用户微调偏移
function gameSwipeY(captureY) { return capToGameY(captureY) + swipeYOffset; }
function fallbackSwipeY() { return SWIPE_Y + swipeYOffset; }

function ocrText(x, y, w, h) {
  let cap = null;
  let res = null;
  try {
    parkMouse();
    cap = captureGameRegion();
    res = cap.find(RecognitionObject.ocr(x, y, w, h));
    if (res && !res.isEmpty()) {
      return (res.text || "").trim();
    }
    return "";
  } catch (e) {
    return "";
  } finally {
    try { if (res) res.dispose(); } catch (e) { }
    try { if (cap) cap.dispose(); } catch (e) { }
  }
}

// 一次性 OCR 整个弹窗，返回按 y,x 排序的文本行
function readPopupLines() {
  let cap = null;
  let results = null;
  try {
    parkMouse();
    cap = captureGameRegion();
    results = cap.findMulti(RecognitionObject.ocr(
      sX(POPUP_OCR_RECT.x), sY(POPUP_OCR_RECT.y), sX(POPUP_OCR_RECT.w), sY(POPUP_OCR_RECT.h)
    ));
    const lines = [];
    for (let i = 0; i < results.count; i++) {
      const r = results[i];
      const t = (r.text || "").replace(/\s+/g, "").trim();
      if (t) {
        lines.push({ text: t, x: r.x, y: r.y, width: r.width, height: r.height });
      }
    }
    lines.sort((a, b) => a.y - b.y || a.x - b.x);
    return lines;
  } catch (e) {
    return [];
  } finally {
    try {
      if (results) {
        for (let i = 0; i < results.count; i++) {
          try { results[i].dispose(); } catch (e) { }
        }
      }
    } catch (e) { }
    try { if (cap) cap.dispose(); } catch (e) { }
  }
}

function findAnchorLine(lines, keyword) {
  for (const l of lines) {
    if (l.text.includes(keyword)) return l;
  }
  return null;
}

// 取锚点下方一定范围内的文本（用于「来源」说明等换行文本）
function collectBelowAnchor(lines, anchor, maxDy, excludeRe) {
  if (!anchor) return "";
  const parts = [];
  for (const l of lines) {
    if (l.y < anchor.y + anchor.height - sY(5)) continue;
    if (l.y > anchor.y + sY(maxDy)) continue;
    if (l.x < anchor.x - sX(60) || l.x > sX(1400)) continue;
    if (excludeRe && excludeRe.test(l.text)) continue;
    parts.push(l.text);
  }
  return parts.join("");
}

// 弹窗顶部第一行非分类文字即材料名（名称行位于 y<sY(360) 且不含 素材/来源/培养需求/可合成）
function extractPopupName(lines) {
  const ex = /素材|来源|培养需求|可合成/;
  const yLimit = sY(360);
  let first = null;
  for (const l of lines) {
    if (l.y > yLimit) break;
    if (l.text.length >= 2 && !ex.test(l.text)) {
      first = l;
      break;
    }
  }
  if (first) {
    // 同一行的碎片（PaddleOCR 可能把名称拆成多段）按 x 拼接
    const parts = [];
    for (const l of lines) {
      if (Math.abs(l.y - first.y) <= sY(30) && l.x < sX(1400) && !ex.test(l.text)) {
        parts.push(l);
      }
    }
    parts.sort((a, b) => a.x - b.x);
    return parts.map(p => p.text).join("");
  }
  // 兜底：取顶部第一行并裁掉可能粘在一起的分类后缀
  for (const l of lines) {
    if (l.y > yLimit) break;
    if (l.text.length >= 2) {
      return l.text.replace(/(角色|武器)?天赋?突破?素材.*$/, "").trim();
    }
  }
  return "";
}

function parseNeedFromLines(lines, needAnchor) {
  const slashRe = /(\d+)\/(\d+)/;
  const candidates = [];

  if (needAnchor) {
    const own = needAnchor.text.match(slashRe);
    if (own) return { have: parseInt(own[1], 10), need: parseInt(own[2], 10) };

    for (const l of lines) {
      if (Math.abs(l.y - needAnchor.y) > sY(70)) continue;
      if (l.x < needAnchor.x - sX(80)) continue;
      const m = l.text.match(slashRe);
      if (m) candidates.push({ line: l, m });
    }
  }

  if (candidates.length === 0) {
    for (const l of lines) {
      const m = l.text.match(slashRe);
      if (m) candidates.push({ line: l, m });
    }
  }

  if (candidates.length === 0) {
    // 没有 x/y 格式时：取靠近「培养需求」的所有数字，最后一个视为需求数
    const nums = [];
    const addNums = (text) => {
      const ms = text.match(/\d+/g);
      if (ms) ms.forEach(n => nums.push(parseInt(n, 10)));
    };
    if (needAnchor) addNums(needAnchor.text);
    if (needAnchor) {
      for (const l of lines) {
        if (Math.abs(l.y - needAnchor.y) <= sY(70) && l.x >= needAnchor.x - sX(80)) addNums(l.text);
      }
    }
    if (nums.length > 0) return { have: nums.length >= 2 ? nums[0] : 0, need: nums[nums.length - 1] };
    return null;
  }

  if (needAnchor) {
    candidates.sort((a, b) =>
      Math.abs(a.line.y - needAnchor.y) - Math.abs(b.line.y - needAnchor.y));
  }
  const c = candidates[0];
  return { have: parseInt(c.m[1], 10), need: parseInt(c.m[2], 10) };
}

// 用 OCR 找文字，找到后直接用识别结果的 region 点击（坐标换算交给 BGI）
async function clickTextInRegion(text, x, y, w, h, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let cap = null;
    let results = null;
    let clicked = false;
    try {
      // 识别区域偏左时停左下角，偏右时停右下角，避免光标挡字
      parkMouse((x + w / 2) < 960 ? 'bl' : 'br');
      cap = captureGameRegion();
      results = cap.findMulti(RecognitionObject.ocr(x, y, w, h));
      for (let i = 0; i < results.count; i++) {
        const r = results[i];
        const t = (r.text || "").replace(/\s+/g, "");
        if (t.includes(text)) {
          log.info("OCR 找到「{text}」@({x},{y},{w},{h})，点击其中心", text, r.x, r.y, r.width, r.height);
          r.click();
          clicked = true;
          break;
        }
      }
    } catch (e) {
      // 未找到则重试
    } finally {
      try {
        if (results) {
          for (let i = 0; i < results.count; i++) {
            try { results[i].dispose(); } catch (e) { }
          }
        }
      } catch (e) { }
      try { if (cap) cap.dispose(); } catch (e) { }
    }
    if (clicked) return true;
    await sleep(400);
  }
  return false;
}

// 页面上「提升指南」可能有两处：优先点最靠上的那一处
async function clickGuideButton(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let cap = null;
    let results = null;
    const found = [];
    try {
      parkMouse();
      cap = captureGameRegion();
      results = cap.findMulti(RecognitionObject.ocr(0, 0, cap.width, cap.height));
      for (let i = 0; i < results.count; i++) {
        const r = results[i];
        if ((r.text || "").replace(/\s+/g, "").includes("提升指南")) {
          const cy = r.y + r.height / 2;
          log.info("[提升指南候选] ({x},{y},{w},{h}) cy={cy}", r.x, r.y, r.width, r.height, Math.round(cy));
          found.push({ cy, r });
        }
      }
      if (found.length > 0) {
        // 一律选 y 最小的那个；选定后本次不再点其它候选
        found.sort((a, b) => a.cy - b.cy);
        const best = found[0];
        log.info("选择「提升指南」@({x},{y},{w},{h})（y最小），点击其中心，不再点下面的", best.r.x, best.r.y, best.r.width, best.r.height);
        best.r.click();
        return true;
      }
    } catch (e) {
      // 重试
    } finally {
      try {
        if (results) {
          for (let i = 0; i < results.count; i++) {
            try { results[i].dispose(); } catch (e) { }
          }
        }
      } catch (e) { }
      try { if (cap) cap.dispose(); } catch (e) { }
    }
    await sleep(500);
  }
  return false;
}

// 扫描右半屏标注图标。
// 注意：返回的每个 marker 持有 region 引用，调用方用完必须 dispose（disposeMarkers）。
function scanMarkers() {
  let cap = null;
  let results = null;
  try {
    parkMouse();
    cap = captureGameRegion();
    // 复用同一个识别规则对象，避免每次截图都重建灰度/遮罩 Mat
    if (!markerRo) {
      markerRo = RecognitionObject.TemplateMatch(markerMat, true);
    }
    markerRo.Threshold = matchThreshold;
    results = cap.findMulti(markerRo);

    const arr = [];
    let skippedNonFinite = 0;
    for (let i = 0; i < results.count; i++) {
      const r = results[i];
      const score = (r.matchScore === undefined || r.matchScore === null) ? -1 : r.matchScore;

      // 关键：先过滤 Infinity/NaN，绝不让它们参与后续流程或刷日志
      if (!Number.isFinite(Number(score))) {
        skippedNonFinite++;
        continue;
      }

      // 只保留右半屏目标区域（按分辨率缩放）
      if (r.x < sX(MARKER_ROI.x) || r.y < sY(MARKER_ROI.y)) continue;
      if (r.x + r.width > sX(MARKER_ROI.x) + sX(MARKER_ROI.w)) continue;
      if (r.y + r.height > sY(MARKER_ROI.y) + sY(MARKER_ROI.h)) continue;

      // 尺寸过滤：模板 24x32，按分辨率缩放后允许一定容差
      if (r.width < sX(16) || r.width > sX(40)) continue;
      if (r.height < sY(20) || r.height > sY(48)) continue;
      const ratio = r.height / r.width;
      if (ratio < 0.8 || ratio > 1.6) continue;

      // 二次分数过滤（防止 ClearScript 属性赋值未生效）
      if (score >= 0 && score < matchThreshold) continue;

      log.info("[标记候选] ({x},{y},{w},{h}) score={score}", r.x, r.y, r.width, r.height, Number(score).toFixed(3));
      touchActivity();
      arr.push({
        x: r.x, y: r.y,
        width: r.width, height: r.height,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2,
        score,
        region: r
      });
    }
    if (skippedNonFinite > 0) {
      log.info("[标记候选] 已过滤 Infinity/NaN 候选 {n} 个", skippedNonFinite);
    }
    // results 集合由调用方通过 marker.region.dispose() 释放
    return arr;
  } catch (e) {
    try {
      if (results) {
        for (let i = 0; i < results.count; i++) {
          try { results[i].dispose(); } catch (e2) { }
        }
      }
    } catch (e2) { }
    return [];
  } finally {
    try { if (cap) cap.dispose(); } catch (e) { }
    // 注意：不要在这里释放 results，marker.region 还引用着其中的对象
  }
}

function disposeMarkers(markers) {
  for (const m of markers) {
    try {
      if (m.region) {
        m.region.dispose();
        m.region = null;
      }
    } catch (e) { }
  }
}

// 释放模板匹配相关的 Mat（含 RecognitionObject 内部缓存的灰度图与遮罩）；可重复调用
function disposeMarkerResources() {
  try {
    if (markerRo) {
      try { if (markerRo.TemplateImageGreyMat) markerRo.TemplateImageGreyMat.dispose(); } catch (e) { }
      try { if (markerRo.MaskMat) markerRo.MaskMat.dispose(); } catch (e) { }
      markerRo = null;
    }
  } catch (e) { }
  try { if (markerMat) markerMat.dispose(); } catch (e) { }
  markerMat = null;
}

function dedupeMarkers(markers) {
  const sorted = markers.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const out = [];
  for (const m of sorted) {
    const dup = out.some(o => Math.abs(o.x - m.x) < sX(20) && Math.abs(o.y - m.y) < sY(20));
    if (dup) {
      // 被去重的结果立即释放
      try {
        if (m.region) {
          m.region.dispose();
          m.region = null;
        }
      } catch (e) { }
    } else {
      out.push(m);
    }
  }
  return out;
}

function clusterRows(markers) {
  const rows = [];
  for (const m of markers) {
    // 同一行：y 差值小于 10（按分辨率缩放）
    let row = rows.find(r => Math.abs(r.y - m.y) < sY(10));
    if (!row) {
      row = { y: m.y, markers: [] };
      rows.push(row);
    }
    row.markers.push(m);
  }
  rows.sort((a, b) => a.y - b.y);
  for (const r of rows) r.markers.sort((a, b) => a.x - b.x);
  return rows;
}

// 当前能扫到几个标注图标（用完即释放）
function guideMarkerCount() {
  const ms = scanMarkers();
  const n = ms.length;
  disposeMarkers(ms);
  return n;
}

// 判断是否已在「提升指南」页面
function isGuidePage() {
  if (guideMarkerCount() > 0) return true;
  const title = ocrText(sX(400), sY(200), sX(300), sY(100));
  return title.includes("提升指南");
}

async function waitGuideMarkers(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const n = guideMarkerCount();
    if (n > 0) {
      log.info("检测到 {n} 个标注图标", n);
      return true;
    }
    await sleep(1000);
  }
  return false;
}

async function ensureGuidePage() {
  if (isGuidePage()) {
    log.info("已在提升指南页面");
    return;
  }
  log.info("未检测到提升指南页面，尝试自动打开");
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
    log.info("未直接进入提升指南视图，尝试点击「提升指南」按钮");
    if (!(await clickGuideButton(15000))) {
      throw new Error("未能找到并点击「提升指南」按钮");
    }
    await sleep(800);
  }

  if (!(await waitGuideMarkers(30000))) {
    throw new Error("点击后 30 秒内未检测到标注图标，请检查游戏状态");
  }
  log.info("已切换到提升指南页面");
}

async function waitPopupName() {
  // 等弹窗入场动画：第一次识别前固定等 1s
  await sleep(1000);
  for (let i = 0; i < 20; i++) {
    assertAlive();
    const name = extractPopupName(readPopupLines());
    if (name) {
      touchActivity();
      return name;
    }
    await sleep(400);
  }
  return "";
}

// 判断材料弹窗是否仍打开：只认弹窗特有的锚点词，
// 避免把提升指南页面上的副本名称误判成弹窗材料名
function popupStillOpen(lines) {
  return !!(findAnchorLine(lines, "培养需求") || findAnchorLine(lines, "来源"));
}

async function closePopup(name) {
  keyPress("ESCAPE");
  await sleep(500);
  let closedCount = 0;
  for (let i = 0; i < 16; i++) {
    assertAlive();
    const lines = readPopupLines();
    if (!popupStillOpen(lines)) {
      // 连续两次确认锚点消失才认为已关闭，防止单次 OCR 抖动误判
      closedCount++;
      if (closedCount >= 2) {
        touchActivity();
        return true;
      }
    } else {
      closedCount = 0;
      if (name) {
        const current = extractPopupName(lines);
        if (current && !current.includes(name.substring(0, Math.min(2, name.length)))) {
          touchActivity();
          return true;
        }
      }
    }
    await sleep(250);
  }
  keyPress("ESCAPE");
  await sleep(500);
  return false;
}

// 屏幕中心向上滑动（弹窗内容上滚），滑完停1秒
async function scrollPopupUp() {
  let cap = null;
  try {
    cap = captureGameRegion();
    const cx = sX(960);
    const y1 = sY(700);
    const y2 = sY(250);
    cap.moveTo(cx, y1);
    await sleep(100);
    leftButtonDown();
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const y = y1 + (y2 - y1) * i / steps;
      cap.moveTo(cx, Math.round(y));
      await sleep(16);
    }
    leftButtonUp();
  } catch (e) {
    log.error("弹窗向上滑动失败: {err}", e.message);
  } finally {
    try { if (cap) cap.dispose(); } catch (e) { }
  }
  parkMouse();
  await sleep(1000);
}

async function readPopup() {
  const name = await waitPopupName();
  if (!name) return null;

  const lines = readPopupLines();
  const sourceAnchor = findAnchorLine(lines, "来源");
  const needAnchor = findAnchorLine(lines, "培养需求");
  const synthAnchor = findAnchorLine(lines, "可合成");

  // 「来源」文字在锚点下方；一次没读到就稍等重试
  let source = collectBelowAnchor(lines, sourceAnchor, 120, /来源|培养需求|可合成/);
  if (!source) {
    await sleep(600);
    const linesRetry = readPopupLines();
    const sourceAnchorRetry = findAnchorLine(linesRetry, "来源");
    if (sourceAnchorRetry) {
      source = collectBelowAnchor(linesRetry, sourceAnchorRetry, 120, /来源|培养需求|可合成/);
    }
  }

  const parsed = parseNeedFromLines(lines, needAnchor);
  // 可合成数量：从「可合成数量：N」里取最后一个数字
  let synthText = synthAnchor ? synthAnchor.text : "";
  const synthBelow = synthAnchor ? collectBelowAnchor(lines, synthAnchor, 80, /来源|培养需求|可合成/) : "";
  if (synthBelow) synthText += synthBelow;
  const synthDigits0 = (synthText.match(/\d+/g) || []);
  let synthCount = synthDigits0.length > 0 ? (parseInt(synthDigits0[synthDigits0.length - 1], 10) || 0) : 0;
  log.info("[可合成数量] 原文: {text} -> {n}", synthText, synthCount);

  // 类型行：顶部名称下方、y<360 的「XX素材」行
  let category = "";
  for (const l of lines) {
    if (l.y > sY(360)) break;
    if (/素材/.test(l.text) && l.y > 0) {
      category = l.text;
      break;
    }
  }

  const needText = parsed
    ? `${parsed.have}/${parsed.need}`
    : (needAnchor ? needAnchor.text : "");

  // 品质颜色兜底：跟着 OCR 找到的材料名行裁剪背景色（金1/紫2/蓝3/绿4），失败为 null
  const nameLine = popupNameLine(lines);
  const colorRankTop = qualityFromPopupColor(nameLine);

  // rank1/2/3 且没识别到可合成数量：屏幕中心向上滑一下，停1秒后补识别。
  // 滑动后材料名会移出屏幕，所以先在上面把名字等字段取完，这里只补可合成数量。
  if (colorRankTop >= 1 && colorRankTop <= 3 && synthCount === 0) {
    log.info("rank{rank} 未识别到可合成数量，屏幕中心向上滑动后停 1 秒补充识别", colorRankTop);
    await scrollPopupUp();

    const lines2 = readPopupLines();
    const synthAnchor2 = findAnchorLine(lines2, "可合成");
    let synthText2 = synthAnchor2 ? synthAnchor2.text : "";
    const synthBelow2 = synthAnchor2 ? collectBelowAnchor(lines2, synthAnchor2, 80, /来源|培养需求|可合成/) : "";
    if (synthBelow2) synthText2 += synthBelow2;
    const digits2 = (synthText2.match(/\d+/g) || []);
    const count2 = digits2.length > 0 ? (parseInt(digits2[digits2.length - 1], 10) || 0) : 0;
    log.info("[可合成数量] 补充识别 原文: {text} -> {n}", synthText2, count2);
    if (count2 > 0) {
      synthText = synthText2;
      synthCount = count2;
    }

    // 滑动后「来源」可能也重新可见，之前没读到就顺带补一次
    if (!source) {
      const sourceAnchor2 = findAnchorLine(lines2, "来源");
      if (sourceAnchor2) {
        source = collectBelowAnchor(lines2, sourceAnchor2, 120, /来源|培养需求|可合成/);
      }
    }
  }

  return {
    name,
    category,
    source,
    needText,
    have: parsed ? parsed.have : 0,
    need: parsed ? parsed.need : 0,
    synthText,
    synthCount,
    colorRankTop,
    foundAt: Date.now()
  };
}

// 品质不靠类型判断：用统一的行内顺序标记，第1个点到的=最高档，后面依次更低
function qualityLabelForRank(rank) {
  return "rank" + rank;
}

// 靠材料图标 x 位置判断奖励序号：1=1421，2=1336，3=1257（中心±25）
// 未匹配到任何已知位置时返回 0，表示无法判断，由界面设置兜底
function sundayPosForX(x) {
  const rules = [[1, 1421], [2, 1336], [3, 1257]];
  for (const [pos, center] of rules) {
    if (Math.abs(x - sX(center)) <= sX(25)) return pos;
  }
  return 0;
}

// 找到弹窗顶部材料名那一行（与 extractPopupName 的筛选规则一致）
function popupNameLine(lines) {
  const ex = /素材|来源|培养需求|可合成/;
  const yLimit = sY(360);
  for (const l of lines) {
    if (l.y > yLimit) break;
    if (l.text.length >= 2 && !ex.test(l.text)) return l;
  }
  for (const l of lines) {
    if (l.y > yLimit) break;
    if (l.text.length >= 2) return l;
  }
  return null;
}

// 根据 OCR 找到的材料名行坐标，裁取它背后的颜色条判断品质：
// 金/橙=rankTop1，紫=2，蓝=3，绿=4；找不到名称行或颜色时返回 null
function qualityFromPopupColor(nameLine) {
  if (!nameLine) return null;
  const x = Math.max(0, nameLine.x - sX(12));
  const y = Math.max(0, nameLine.y - sY(12));
  const w = Math.min(sX(1920) - x, nameLine.width + sX(60));
  const h = Math.min(sY(1080) - y, nameLine.height + sY(24));
  if (w <= 0 || h <= 0) return null;

  let cap = null, crop = null, hsv = null;
  try {
    parkMouse();
    cap = captureGameRegion();
    crop = cap.deriveCrop(x, y, w, h);
    const cvt = OpenCvSharp.OpenCvSharp.ColorConversionCodes;
    hsv = crop.srcMat.cvtColor(cvt.BGR2HSV);

    const ranges = [
      [1, "金/橙", 0, 15, 60, 255, 80, 255],
      [2, "紫", 125, 145, 70, 255, 80, 255],
      [3, "蓝", 100, 120, 70, 255, 80, 255],
      [4, "绿", 70, 90, 90, 255, 80, 255]
    ];

    let best = null;
    for (const [rankTop, name, loH, hiH, loS, hiS, loV, hiV] of ranges) {
      let mask = null;
      try {
        mask = new Mat();
        OpenCvSharp.OpenCvSharp.Cv2.InRange(
          hsv,
          new OpenCvSharp.OpenCvSharp.Scalar(loH, loS, loV),
          new OpenCvSharp.OpenCvSharp.Scalar(hiH, hiS, hiV),
          mask
        );
        const cnt = OpenCvSharp.OpenCvSharp.Cv2.CountNonZero(mask);
        if (!best || cnt > best.cnt) best = { rankTop, name, cnt };
      } catch (e) {
        // 忽略单档调用失败
      } finally {
        try { if (mask) mask.dispose(); } catch (e) { }
      }
    }

    if (best && best.cnt >= Math.round(500 * scaleX * scaleY)) {
      log.info("[品质颜色] {name} 像素 {cnt}", best.name, best.cnt);
      return best.rankTop;
    }
    return null;
  } catch (e) {
    return null;
  } finally {
    try { if (hsv) hsv.dispose(); } catch (e) { }
    try { if (crop) crop.dispose(); } catch (e) { }
    try { if (cap) cap.dispose(); } catch (e) { }
  }
}

async function processMarker(m) {
  log.info("点击标注图标：识别区域({x},{y},{w},{h})，由 BGI region 换算点击", m.x, m.y, m.width, m.height);
  try {
    if (m.region) {
      m.region.click();
      m.region.dispose();
      m.region = null;
    } else {
      return null;
    }
  } catch (e) {
    log.error("点击标注图标失败: {err}", e.message);
    try { if (m.region) { m.region.dispose(); m.region = null; } } catch (e2) { }
    return null;
  }
  await sleep(900);

  const info = await readPopup();
  if (!info) {
    log.warn("点击后未识别到材料弹窗，按ESC并跳过");
    await closePopup("");
    return null;
  }

  // 有效弹窗必须同时有「来源」和「培养需求」；否则是误点/弹窗未弹出
  if (!info.source || !info.needText || info.need <= 0 || info.name.includes("秘境")) {
    log.warn("弹窗内容无效（name={name}, source={source}, need={need}），按ESC跳过", info.name, info.source, info.need);
    await closePopup(info.name);
    return null;
  }

  log.info("读取到材料: {name} | 来源: {source} | 需求: {needText}", info.name, info.source, info.needText);
  await closePopup(info.name);
  return info;
}

// 反向：从左往右短距离拖动（用于校准）。
// 参数为“截图坐标”；用 captureGameRegion().moveTo() 让 BGI 自己换算到窗口，
// 所有左→右滑动结束后：鼠标移到右下角，并延迟 1s 再继续识别
async function swipeRowRight(captureY) {
  const startX = sX(1100);
  const endX = sX(1400);
  log.info("校准：截图 y={y} 处从左往右拖 ({start}->{end})", captureY, startX, endX);

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
    log.error("校准滑动失败: {err}", e.message);
  } finally {
    try { if (cap) cap.dispose(); } catch (e) { }
  }
  parkMouse();
  await sleep(1000);
}

// 主力滑动：按住0.4s → 从右往左拖400px → 不松手保持0.4s → 松开
// 参数为“截图坐标”，同样交给 BGI region 换算
async function swipeRowPressHold(captureY) {
  const startX = sX(1400);
  const endX = startX - sX(400);
  log.info("按住0.4s后在截图 y={y} 处从右往左拖400px ({start}->{end})，划完保持0.4s再松开", captureY, startX, endX);

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
    log.error("主力滑动失败: {err}", e.message);
  } finally {
    try { if (cap) cap.dispose(); } catch (e) { }
  }
  parkMouse();
  await sleep(500);
}

// 持续识别标注约1s，提高捕获成功率
async function scanMarkersStable(timeoutMs = 1000) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    assertAlive();
    const ms = scanMarkers();
    if (ms.length > 0) return ms;
    disposeMarkers(ms);
    await sleep(250);
  }
  return [];
}

// 取指定 y 所在那一行的标注（同排判定：左上角 y 差 < 10），忽略其它行；
// 同样持续识别约1s，直到捕获到该行标注
async function scanRowMarkers(rowY, timeoutMs = 1000) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    assertAlive();
    const all = scanMarkers();
    const kept = [];
    const dropped = [];
    for (const m of all) {
      if (Math.abs(m.y - rowY) < sY(10)) {
        kept.push(m);
      } else {
        dropped.push(m);
      }
    }
    disposeMarkers(dropped);
    if (kept.length > 0) return kept;
    disposeMarkers(kept);
    await sleep(250);
  }
  return [];
}

// 从该行左侧 OCR 出 BGI 标准秘境名（如 荒坠的圣迹），支持 OCR 错别字模糊匹配
// 下面的 15/45 都是“1920x1080 参考坐标”，运行时已经过 sX/sY 按实际分辨率缩放，
// 例如 1600x900 时会变成 12/37 像素，换分辨率不需要改这里。
async function readDomainName(rowY) {
  const text = await ocrText(sX(760), rowY - sY(15), sX(300), sY(45));
  log.info("[行秘境名OCR] y={y} 原文: {text}", rowY, text);

  // 1. 直接包含
  for (const d of KNOWN_DOMAINS) {
    if (text.includes(d)) return d;
  }

  // 2. 逐行与标准名做编辑距离匹配（如 OCR 把「菫」认成「董」）
  const lines = String(text).split(/\n/).map(s => s.trim()).filter(s => s.length >= 2);
  for (const line of lines) {
    for (const d of KNOWN_DOMAINS) {
      if (Math.abs(line.length - d.length) <= 1 && levDistance(line, d) <= 1) {
        log.info("[行秘境名OCR] 模糊匹配: {line} -> {d}", line, d);
        return d;
      }
    }
  }
  return "";
}

// ------- 奖励匹配与材料齐集判断 -------

function levDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) dp.push(new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

// 材料名通常是 XX的XX：取“的”前面的 XX 作为系列名
function seriesKey(name) {
  const n = canonicalName(name);
  const idx = n.indexOf("的");
  return idx > 0 ? n.slice(0, idx) : n;
}

// 计划按“系列”分组：同一副本可能同时培养多个角色，出现多组 XX的XX。
// OCR 可能把系列名认错一个字（如 今昔→今音），因此系列名用编辑距离≤1 聚成一组。
function buildPlan(entries) {
  const items0 = entries.map(e => {
    const norm = canonicalName(e.material);
    return { entry: e, norm, series: seriesKey(norm) };
  });

  const keyClusters = [];
  for (const it of items0) {
    let cluster = keyClusters.find(c => levDistance(c.key, it.series) <= 1);
    if (!cluster) {
      cluster = { key: it.series };
      keyClusters.push(cluster);
    }
    it.groupKey = cluster.key;
  }

  const map = new Map();
  for (const it of items0) {
    if (!map.has(it.groupKey)) map.set(it.groupKey, []);
    map.get(it.groupKey).push(it);
  }

  const groups = [];
  const flat = [];
  let idx = 0;
  for (const [base, arr] of map) {
    const isThreeTier = arr.length === 3;
    // 3 档系列按点击顺序排序（左→右 = 高→低），随后固定映射到 2/3/4 档；
    // 其余系列统一按颜色绝对4档排序：金1/紫2/蓝3/绿4
    if (isThreeTier) {
      arr.sort((a, b) => ((a.entry.orderRank || 99) - (b.entry.orderRank || 99)));
    } else {
      arr.sort((a, b) =>
        ((a.entry.qualityRank || 99) - (b.entry.qualityRank || 99)) ||
        ((a.entry.orderRank || 99) - (b.entry.orderRank || 99))
      );
    }
    arr.forEach((item, order) => {
      // 后缀按每个材料自己的系列名切，避免 OCR 错字导致后缀错位
      item.suffix = item.norm.slice(item.series.length).replace(/^的/, "");
      // 3 档系列（如天赋书：哲学/指引/教导）固定占 2/3/4 档，与 matchReward 的品质关键词假设一致；
      // 4 档系列用颜色绝对档位，颜色失败再按点击顺序兜底
      item.localRank = isThreeTier
        ? order + 2
        : Math.min(4, Math.max(1, Number(item.entry.qualityRank) || order + 1));
      item.entry.qualityRank = item.localRank;
      item.globalIdx = idx++;
      flat.push(item);
    });
    // 永远按4档权重链 27/9/3/1 计算
    groups.push({ base, items: arr, maxRank: 4 });
  }

  return { groups, flat };
}

function matchReward(name, plan) {
  const n = canonicalName(name);

  // 1. 名字完全对上（全计划）
  for (const i of plan.flat) {
    if (i.norm === n) return i.globalIdx;
  }

  // 2. 系列前缀 + 品质后缀（用每个材料自己的 series，兼容 OCR 错字分组）
  for (const g of plan.groups) {
    for (const i of g.items) {
      if (!n.startsWith(i.series)) continue;
      const suf = n.slice(i.series.length).replace(/^的/, "");
      if (suf === i.suffix) return i.globalIdx;
    }
  }

  // 3. 天赋书品质关键词兜底（仅3档系列）
  let kw = null;
  if (n.includes("哲学")) kw = "high";
  else if (n.includes("指引")) kw = "mid";
  else if (n.includes("教导")) kw = "low";
  if (kw) {
    for (const g of plan.groups) {
      if (g.items.length !== 3) continue;
      for (const i of g.items) {
        const label = i.localRank === 2 ? "high" : i.localRank === 3 ? "mid" : i.localRank === 4 ? "low" : null;
        if (label === kw) return i.globalIdx;
      }
    }
  }

  // 4. 同系列内用编辑距离模糊匹配（按各自 series 切后缀）
  for (const g of plan.groups) {
    for (const i of g.items) {
      if (!n.startsWith(i.series)) continue;
      const suf = n.slice(i.series.length).replace(/^的/, "");
      if (levDistance(suf, i.suffix) <= 2) return i.globalIdx;
    }
  }

  // 5. 系列名都可能被 OCR 认错（如 今昔→今音）：整名编辑距离 ≤1 直接归入
  for (const i of plan.flat) {
    if (levDistance(n, i.norm) <= 1) return i.globalIdx;
  }

  return -1;
}

// 只允许 3 低合 1 高（不可反向）的精确判定；
// 按系列分组分别判定，最后合并总缺口/剩余
function checkPlan(plan, counts) {
  let allOk = true;
  let totalDeficit = 0;
  let totalSurplus = 0;
  const groups = [];

  for (const g of plan.groups) {
    const n = g.maxRank;
    const have = new Array(n).fill(0);
    const need = new Array(n).fill(0);

    // 只有组内“最低档(绿/rank4)信息缺失”时才启用可合成数量补偿；
    // 低等级材料信息齐全时完全按原算法计算，不使用合成补偿
    const lowestInfoPresent = g.items.some(o => o.localRank === 4);

    for (const item of g.items) {
      const r = (item.localRank || 1) - 1;
      // 扫描到的背包数 + 本次运行内获得的奖励（历史奖励已包含在背包数中，不再单独计入）
      let synthBonus = 0;
      const hasLowerTier = g.items.some(o => o.localRank > item.localRank);
      if (!lowestInfoPresent && !hasLowerTier && Number(item.entry.synthCount) > 0) {
        synthBonus = Number(item.entry.synthCount);
        log.info("[合成补偿] {name} 可合成 {n}，计入材料缺口计算", item.entry.material, synthBonus);
      }
      have[r] += (Number(item.entry.have) || 0) + (Number(counts[item.globalIdx]) || 0) + synthBonus;
      need[r] += Number(item.entry.need) || 0;
    }

    // 权重统一4档：index0(金)=27，index1(紫)=9，index2(蓝)=3，index3(绿)=1
    const weightOf = (i) => Math.pow(3, n - 1 - i);

    const totalHaveLow = have.reduce((s, v, i) => s + v * weightOf(i), 0);
    const totalNeedLow = need.reduce((s, v, i) => s + v * weightOf(i), 0);

    // 缺口/剩余按最低品质单位精确折算：低品质可 3:1 向上合成，
    // 不足 3 的余数也要保留，不能像贪心进位那样被 floor 丢弃。
    const deficit = Math.max(0, totalNeedLow - totalHaveLow);
    const surplus = Math.max(0, totalHaveLow - totalNeedLow);

    // 每档 missing 仅用于日志展示：从低到高贪心推演一次
    const missing = new Array(n).fill(0);
    let carry = 0;
    for (let i = n - 1; i >= 0; i--) {
      const avail = have[i] + carry;
      const gap = Math.max(0, need[i] - avail);
      if (gap > 0) {
        missing[i] = gap;
        carry = 0;
      } else {
        missing[i] = 0;
        carry = Math.floor((avail - need[i]) / 3); // 3低 → 1高
      }
    }

    const ok = deficit === 0;
    if (!ok) allOk = false;
    totalDeficit += deficit;
    totalSurplus += surplus;
    groups.push({ base: g.base, ok, deficitLowUnits: deficit, surplusLowUnits: surplus, missing });
  }

  return {
    ok: allOk,
    deficitLowUnits: totalDeficit,
    surplusLowUnits: totalSurplus,
    groups
  };
}

// 奖励识别不可靠时的兜底：重新打开冒险之证提升指南页，逐一点开材料刷新 have/need
async function refreshPlanFromGuide(entries, rowY) {
  log.info("打开冒险之证兜底刷新培养计划");

  await ensureGuidePage();

  // 与开始运行时一致的校准：先左→右滑两次
  await swipeRowRight(rowY);
  await swipeRowRight(rowY);
  let ms = await scanRowMarkers(rowY, 3000);
  if (ms.length === 0) {
    log.info("兜底刷新：3 秒未识别到标注，用 y=365 左→右滑 3 次校准");
    for (let i = 0; i < 3; i++) {
      await swipeRowRight(sY(SWIPE_Y));
    }
    ms = await scanRowMarkers(rowY, 5000);
    if (ms.length === 0) {
      throw new Error("兜底刷新失败：校准后仍识别不到标注");
    }
  }

  const matchedKeys = new Set();
  const refreshMarkers = async (markers) => {
    markers.sort((a, b) => a.x - b.x);
    for (const m of markers) {
      const info = await processMarker(m);
      if (!info) continue;
      const key = canonicalName(info.name);
      const target = entries.find(e => canonicalName(e.material) === key);
      if (target) {
        target.have = info.have;
        target.need = info.need;
        target.needText = info.needText;
        matchedKeys.add(key);
        touchActivity();
        log.info("兜底刷新: {name} 现有 {have}，需求 {need}", target.material, target.have, target.need);
      }
    }
  };

  try {
    await refreshMarkers(ms);
  } finally {
    disposeMarkers(ms);
  }

  for (let s = 1; s <= 2; s++) {
    await swipeRowPressHold(rowY);
    let ms2 = await scanRowMarkers(rowY);
    try {
      await refreshMarkers(ms2);
    } finally {
      disposeMarkers(ms2);
    }
  }

  // 兜底刷新也执行两次左→右恢复校准
  await swipeRowRight(rowY);
  await swipeRowRight(rowY);

  // 本次刷新中没识别到的品质，一律按 0 处理，防止旧数据虚高
  for (const e of entries) {
    if (Math.abs((e.rowY || 0) - rowY) > 50) continue;
    if (!matchedKeys.has(canonicalName(e.material))) {
      if (e.have !== 0) {
        log.warn("兜底刷新未识别到 {name}，将其已有数更新为 0", e.material);
      }
      e.have = 0;
    }
  }
}

// 执行阶段：用记录的 BGI 秘境名调用自动秘境；每轮记录奖励，材料齐了自动停止树脂刷取
async function runDomainPhase(entries) {
  const item = entries.find(e => e.domainName) || entries[0];
  if (!item || !item.domainName) {
    log.warn("没有记录到可刷的秘境名，跳过自动秘境");
    return;
  }

  const plan = buildPlan(entries);
  const rewardFile = "domain_rewards.json";
  const autoStop = getS("autoStopWhenEnough", true) !== false;

  // 本次只以“选中的第一个系列”作为停止条件：
  // 刷满当前目标系列就停，其余系列不参与本次是否停下来的判断
  const targetGroup = plan.groups.find(g => g.items.some(i => i.entry === item)) || plan.groups[0];
  const stopPlan = { groups: [targetGroup], flat: targetGroup.items };

  // 每次新扫描/新计划开始时重置累计奖励：domain_rewards.json 只记录本次运行内的奖励，
  // 防止与 entries[].have（扫描时读到的当前背包数，已包含历史奖励）重复计数。
  let totalRaw = {};
  file.writeTextSync(rewardFile, JSON.stringify({
    updatedAt: new Date().toISOString(),
    items: totalRaw
  }, null, 2));

  // 本次运行内的奖励按计划条目索引累计
  const rewardCounts = plan.flat.map(() => 0);

  // 先用本次扫描到的背包库存判断一次，材料已齐就直接跳过
  const initialStatus = checkPlan(stopPlan, rewardCounts);
  if (autoStop && initialStatus.ok) {
    log.info("根据本次扫描的背包库存，材料已经齐了（最低品质折算剩余 {s}），跳过刷取", initialStatus.surplusLowUnits);
    try { notification.send("材料已齐，无需刷取：" + item.domainName); } catch (e) { }
    return;
  }
  if (!initialStatus.ok) {
    log.info("当前缺口（最低品质单位折算）: {d}", initialStatus.deficitLowUnits);
  }

  const roundSetting = parseInt(getS("domainRoundNum", "9999"), 10);
  const maxRounds = (!Number.isFinite(roundSetting) || roundSetting <= 0) ? 9999 : roundSetting;

  // 树脂耗尽模式专用：该模式副本刷取结束后，整体插件流程直接完成，
  // 不再执行后续流程（兜底刷新、缺口复查、后续批次与后续行处理等）
  let stopScript = false;

  function saveRewards() {
    file.writeTextSync(rewardFile, JSON.stringify({
      updatedAt: new Date().toISOString(),
      items: totalRaw
    }, null, 2));
  }

  // 每次记录奖励：优先按名字匹配，对不上再按品质匹配；返回匹配到的奖励条数
  function applyRewards(rewards) {
    let current = {};
    try {
      current = JSON.parse(JSON.stringify(rewards));
    } catch (e) {
      log.warn("奖励对象解析失败: {err}", e.message);
      return 0;
    }
    let matchedCount = 0;
    for (const rawName of Object.keys(current)) {
      const v = Number(current[rawName]);
      if (!Number.isFinite(v) || v <= 0) continue;

      totalRaw[rawName] = (Number(totalRaw[rawName]) || 0) + v;

      const mi = matchReward(rawName, plan);
      if (mi >= 0) {
        rewardCounts[mi] += v;
        matchedCount++;
        const matched = plan.flat[mi];
        log.info("奖励记录: {raw} x{n} -> 归入 {material} [{label}]", rawName, v, matched.entry.material, matched.entry.qualityLabel);
      } else {
        log.warn("奖励记录: {raw} x{n} 未能匹配到计划材料（只记累计，不计入齐集判断）", rawName, v);
      }
    }
    saveRewards();
    return matchedCount;
  }

  const param = new AutoDomainParam();
  param.DomainName = item.domainName;
  // 不指定树脂次数：插件按缺口分批、一轮一判断，树脂消耗由 BGI 本体设置管理
  param.SpecifyResinUse = false;
  param.RewardRecognitionEnabled = true;

  // 周日/限时全开奖励序号：优先用图标x位置判断出的序号，其次用界面设置
  let sundayValue = "";
  if (item.sundayPos === 1 || item.sundayPos === 2 || item.sundayPos === 3) {
    sundayValue = String(item.sundayPos);
    log.info("根据图标x位置自动选择奖励序号: {v}", sundayValue);
  } else {
    sundayValue = String(getS("sundaySelectedValue", ""));
  }
  if (sundayValue === "1" || sundayValue === "2" || sundayValue === "3") {
    param.SundaySelectedValue = sundayValue;
    log.info("已设置周日/限时全开奖励序号: {v}", sundayValue);
  }

  const party = String(getS("partyName", ""));
  if (party) param.PartyName = party;

  log.info("开始自动秘境：{name}，按缺口自动选择模式（≥160 树脂耗尽 / <160 三刷一查 / <100 两刷一查 / <50 一刷一查）", item.domainName);

  // 先回主界面，再由 BGI 自动秘境负责传送、进本、战斗、领奖
  await genshin.returnMainUi();
  await sleep(1000);

  let totalRounds = 0;
  for (let batchIndex = 1; totalRounds < maxRounds; batchIndex++) {
    const statusBefore = checkPlan(stopPlan, rewardCounts);
    const d = statusBefore.deficitLowUnits;

    let roundsThisBatch;
    let modeName;
    if (d >= 160) {
      // 树脂耗尽模式：把剩余轮数全部交给 BGI，由它刷到树脂耗尽自动停
      roundsThisBatch = maxRounds - totalRounds;
      modeName = "树脂耗尽模式";
    } else if (d >= 100) {
      roundsThisBatch = Math.min(3, maxRounds - totalRounds);
      modeName = "三刷一检查";
    } else if (d >= 50) {
      roundsThisBatch = Math.min(2, maxRounds - totalRounds);
      modeName = "两刷一检查";
    } else {
      roundsThisBatch = Math.min(1, maxRounds - totalRounds);
      modeName = "一刷一检查";
    }

    param.DomainRoundNum = roundsThisBatch;
    totalRounds += roundsThisBatch;
    log.info("第 {batch} 批（{n} 轮，{mode}，缺口 {d}），累计 {total}/{max} 轮",
      batchIndex, roundsThisBatch, modeName, d, totalRounds, maxRounds);

    try {
      const rewards = await dispatcher.runAutoDomainTask(param);
      log.info("第 {batch} 批奖励汇总: {rewards}", batchIndex, JSON.stringify(rewards));
      const matched = applyRewards(rewards);

      // 仅树脂耗尽模式：副本刷取结束后，插件整体流程直接完成。
      // 跳过奖励兜底刷新、缺口复查、后续批次与后续行处理。
      if (modeName === "树脂耗尽模式") {
        log.info("树脂耗尽模式刷取结束，插件流程直接完成，不再执行后续流程");
        try { notification.send("树脂耗尽模式刷取结束，停止刷取：" + item.domainName); } catch (e) { }
        stopScript = true;
        break;
      }

      // 奖励识别不可靠时：打开冒险之证重新扫描，刷新 have/need
      if (matched === 0) {
        log.warn("本轮奖励识别为空，打开冒险之证兜底刷新");
        await refreshPlanFromGuide(entries, Number(item.rowY) || 365);
      }

      const status = checkPlan(stopPlan, rewardCounts);
      if (autoStop && status.ok) {
        log.info("材料已集齐，自动停止树脂刷取（剩余折算 {s}）", status.surplusLowUnits);
        try { notification.send("材料已集齐，停止刷取：" + item.domainName); } catch (e) { }
        break;
      }

      log.info("第 {batch} 批后缺口（最低品质单位折算）: {d}，各档缺口: {missing}", batchIndex, status.deficitLowUnits, JSON.stringify(status.missing));
    } catch (e) {
      if (String(e.message).includes("树脂不足") || String(e.message).includes("未找到可用的树脂")) {
        log.info("树脂耗尽，自动停止刷取");
        try { notification.send("树脂耗尽，停止刷取：" + item.domainName); } catch (e2) { }
        if (modeName === "树脂耗尽模式") {
          stopScript = true;
        }
      } else {
        log.error("第 {batch} 批自动秘境失败: {err}", batchIndex, e.message);
        try { notification.error("自动秘境失败：" + e.message); } catch (e2) { }
        // 树脂耗尽模式下无论以何种方式结束，都不再继续后续流程
        if (modeName === "树脂耗尽模式") {
          stopScript = true;
        }
      }
      break;
    }
  }

  return { stopScript };
}

async function clickAndRecord(m, row, entries) {
  const info = await processMarker(m);
  if (!info) return false;

  const key = canonicalName(info.name);
  if (row.names.has(key)) {
    log.info("材料 {name} 已记录，跳过重复项", info.name);
    return false;
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
  log.info("记录为行内第 {rank} 个品质（{label}）", rank, label);
  return true;
}

// 处理一行：先点该行全部可见标注（左→右=高→低），
// 然后左滑识别被遮挡的低品质材料（3档/4档通用）
async function processRow(row, entries) {
  log.info("处理第 {n} 行 (y={y})", row.index, row.y);
  touchActivity();

  // 0. 读取该行左侧的 BGI 标准秘境名，供后续自动秘境使用
  row.domainName = await readDomainName(row.y);
  if (!row.domainName) {
    log.info("未识别到可刷秘境名，自动改用 y=365 左→右滑校准");
    for (let i = 0; i < 3; i++) {
      await swipeRowRight(sY(SWIPE_Y));
    }
    row.domainName = await readDomainName(row.y);
  }
  log.info("该行秘境名: {domain}", row.domainName || "(未识别到)");

  // 1. 一开始先从左往右滑两次校准（已识别到行，用识别到的行 y）
  await swipeRowRight(row.y);
  await swipeRowRight(row.y);
  log.info("初始左→右校准完成");

  // 2. 识别该行标注，3s 识别不到就自动用 y=365 从左往右滑 3 次再校准
  let ms0 = await scanRowMarkers(row.y, 3000);
  if (ms0.length === 0) {
    log.info("3 秒未识别到标注，自动从左往右滑动 3 次校准");
    for (let i = 0; i < 3; i++) {
      await swipeRowRight(sY(SWIPE_Y));
    }
    ms0 = await scanRowMarkers(row.y, 5000);
    if (ms0.length === 0) {
      throw new Error("校准后仍识别不到标注（卡死 5 秒），自动结束脚本");
    }
  }
  disposeMarkers(ms0);
  log.info("识别到该行标注，开始依次点击识别");

  // 2. 识别该行材料，依次点击识别
  {
    assertAlive();
    let ms = await scanRowMarkers(row.y);
    try {
      ms.sort((a, b) => a.x - b.x);
      log.info("该行可见标注 {k} 个，依次点击识别", ms.length);
      for (const m of ms) {
        assertAlive();
        await clickAndRecord(m, row, entries);
      }
    } finally {
      disposeMarkers(ms);
    }
  }

  // 3. 按住0.4s从右往左滑400px，划完保持0.4s松开；识别该行所有标注并去重；连续滑2次后停止
  for (let s = 1; s <= 2; s++) {
    assertAlive();
    await swipeRowPressHold(row.y);

    let ms = await scanRowMarkers(row.y);
    try {
      if (ms.length === 0) {
        log.info("第 {s} 次滑动后该行未发现标注", s);
        continue;
      }
      ms.sort((a, b) => a.x - b.x);
      log.info("第 {s} 次滑动后，按左→右顺序识别该行 {k} 个标注", s, ms.length);
      for (const m of ms) {
        await clickAndRecord(m, row, entries);
      }
    } finally {
      disposeMarkers(ms);
    }
  }

  // 4. 本行右→左滑动识别流程结束后，执行两次左→右恢复校准
  log.info("本行右→左识别完成，执行两次左→右恢复校准");
  await swipeRowRight(row.y);
  await swipeRowRight(row.y);

  // 该行识别完仍没有可刷秘境名：再用 y=365 左→右滑校准一次并回填
  if (!row.domainName) {
    log.warn("该行仍无可刷秘境名，用 y=365 左→右滑校准重试");
    for (let i = 0; i < 3; i++) {
      await swipeRowRight(sY(SWIPE_Y));
    }
    const retryDomain = await readDomainName(row.y);
    if (retryDomain) {
      row.domainName = retryDomain;
      for (const e of entries) {
        if (e.rowY === Math.round(row.y)) e.domainName = retryDomain;
      }
      log.info("校准后识别到秘境名: {domain}", retryDomain);
    }
  }

  return row.names.size;
}

(async function () {
  try {
  setGameMetrics(1920, 1080, 1.25);

  // 计算截图相对 1920x1080 的缩放比例
  {
    let probe = null;
    try {
      probe = captureGameRegion();
      scaleX = probe.width / 1920;
      scaleY = probe.height / 1080;
      log.info("截图尺寸: {w}x{h}，缩放系数 x={sx} y={sy}", probe.width, probe.height, scaleX.toFixed(3), scaleY.toFixed(3));
    } finally {
      try { if (probe) probe.dispose(); } catch (e) { }
    }
  }

  matchThreshold = parseFloat(getS("markerThreshold", "0.9"));
  if (isNaN(matchThreshold) || matchThreshold <= 0 || matchThreshold > 1) {
    throw new Error("markerThreshold 必须是 0~1 之间的数字");
  }
  const autoOpen = getS("autoOpenGuide", true);
  const saveFile = String(getS("saveFile", "plan_needs.json"));

  // 读取模板并按当前分辨率缩放
  markerMat = file.readImageMatSync(MARKER_PATH);
  if (!markerMat || markerMat.empty() || markerMat.width <= 0 || markerMat.height <= 0) {
    throw new Error("标注图标模板读取失败或为空: " + MARKER_PATH);
  }
  {
    const tw = Math.max(4, Math.round(markerMat.width * scaleX));
    const th = Math.max(4, Math.round(markerMat.height * scaleY));
    if (tw !== markerMat.width || th !== markerMat.height) {
      const resized = new Mat();
      OpenCvSharp.OpenCvSharp.Cv2.Resize(markerMat, resized, new OpenCvSharp.OpenCvSharp.Size(tw, th));
      try { markerMat.dispose(); } catch (e) { }
      markerMat = resized;
      log.info("模板已缩放为 {w}x{h}", tw, th);
    }
  }

  if (autoOpen) {
    await ensureGuidePage();
  } else if (!(await isGuidePage())) {
    log.warn("未检测到提升指南页面。如已打开请忽略，否则请在设置中开启自动打开");
  }

  // 页面动画可能尚未渲染完，等标注图标出现再继续
  if (!(await waitGuideMarkers(15000))) {
    log.error("15 秒内未检测到标注图标");
  }

  const entries = [];

  // 1. 先扫描一次用于按“行”分组（同排 y 差 < 10）；持续约1s提高成功率
  const visible = dedupeMarkers(await scanMarkersStable(1000));
  disposeMarkers(visible);
  log.info("当前右半屏识别到 {count} 个标注图标", visible.length);

  if (visible.length === 0) {
    log.info("没有识别到任何标注图标，脚本结束");
    const emptySummary = { generatedAt: new Date().toISOString(), count: 0, items: [] };
    file.writeTextSync(saveFile, JSON.stringify(emptySummary, null, 2));
    return;
  }

  const rows = clusterRows(visible).map((r, idx) => ({
    index: idx + 1,
    y: Math.max(300, Math.min(850, Math.round(r.y))),
    names: new Set(),
    nextRank: 1
  }));

  // 2. 逐行处理：先扫描识别该行材料，刷满后标记完成并过滤，再切下一行
  // 注意：doneRowYs 仅本次运行内存态，不写任何文件，脚本重开后从第一行重新开始
  const doneRowYs = new Set();
  const runDomains = getS("runDomain", true) !== false;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (doneRowYs.has(row.y)) continue;

    // 换行时重新打开提升指南页，重新开始扫描流程（已处理行会被过滤）
    if (ri > 0) {
      log.info("切换到下一行 (y={y})，重新打开提升指南页面", row.y);
      await ensureGuidePage();
      if (!(await waitGuideMarkers(15000))) {
        log.error("切换行后 15 秒内未检测到标注图标");
      }
    }

    const beforeCount = entries.length;
    try {
      await processRow(row, entries);
    } catch (e) {
      log.error("识别流程提前结束: {err}", e.message);
    }
    const rowEntries = entries.slice(beforeCount);
    log.info("第 {i} 行识别完成，新增 {n} 个材料", row.index, rowEntries.length);

    // 保存清单（每次处理完一行都落盘）
    const summary = {
      generatedAt: new Date().toISOString(),
      count: entries.length,
      items: entries
    };
    const ok = file.writeTextSync(saveFile, JSON.stringify(summary, null, 2));
    if (!ok) throw new Error("保存需求清单失败: " + saveFile);

    // 刷副本（可选）：只刷这一行的材料，满足后 runDomainPhase 自动停
    if (runDomains && rowEntries.length > 0) {
      const domainResult = await runDomainPhase(rowEntries);
      // 仅树脂耗尽模式：副本刷取结束即整体流程完成，不再处理后续行
      if (domainResult && domainResult.stopScript) {
        log.info("树脂耗尽模式结束，插件流程完成，停止处理后续行");
        break;
      }
    }

    // 本行满足后标记完成，后续识别过滤该行
    doneRowYs.add(row.y);
    log.info("第 {i} 行处理完成，后续识别将过滤该行", row.index);
  }

  // 3. 最终清单
  const summary = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    items: entries
  };
  const ok = file.writeTextSync(saveFile, JSON.stringify(summary, null, 2));
  if (!ok) throw new Error("保存需求清单失败: " + saveFile);

  log.info("===== 培养计划扫描完成，共 {count} 个材料 =====", entries.length);
  for (const e of entries) {
    log.info("- {name} [{label}] {needText} 来源: {source}", e.material, e.qualityLabel, e.needText, e.source);
  }
  log.info("清单已保存到 {file}", saveFile);

  // 4. 未开启自动刷副本时的提示
  if (!runDomains) {
    log.info("设置项「扫描完后自动刷该行秘境」未开启，本次只扫描不刷副本。请在配置组里勾选该选项后重跑。");
  }

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    log.error("脚本执行失败，已停止: {err}", msg);
    throw e;
  } finally {
    disposeMarkerResources();
  }
})();
