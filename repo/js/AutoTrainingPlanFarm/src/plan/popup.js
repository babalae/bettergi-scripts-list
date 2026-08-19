// 材料弹窗：OCR 读取、名称/需求/来源/可合成解析、品质颜色、点击 OCR 文本
import { sX, sY, scaleX, scaleY, parkMouse, touchActivity, assertAlive } from "../core/common.js";
import { debugFrameStart, debugBox } from "../core/debug-overlay.js";

// 弹窗整块 OCR 区域
const POPUP_OCR_RECT = { x: 710, y: 55, w: 500, h: 960 };

export function ocrText(x, y, w, h, label, color) {
  let cap = null;
  let res = null;
  try {
    debugFrameStart();
    debugBox(label, x, y, w, h, color);
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

export function readPopupLines() {
  let cap = null;
  let results = null;
  try {
    debugFrameStart();
    debugBox("弹窗整块OCR", sX(POPUP_OCR_RECT.x), sY(POPUP_OCR_RECT.y), sX(POPUP_OCR_RECT.w), sY(POPUP_OCR_RECT.h), "#ffd600");
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
        debugBox("弹窗文本:" + t + "@" + r.x + "," + r.y, r.x, r.y, r.width, r.height, "#4fc3f7");
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

export function findAnchorLine(lines, keyword) {
  for (const l of lines) {
    if (l.text.includes(keyword)) return l;
  }
  return null;
}

export function collectBelowAnchor(lines, anchor, maxDy, excludeRe) {
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

export function extractPopupName(lines) {
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

export function parseNeedFromLines(lines, needAnchor) {
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

export async function clickTextInRegion(text, x, y, w, h, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let cap = null;
    let results = null;
    let clicked = false;
    try {
      debugFrameStart();
      debugBox("点击OCR:" + text, x, y, w, h, "#ff9100");
      // 识别区域偏左时停左下角，偏右时停右下角，避免光标挡字
      parkMouse((x + w / 2) < 960 ? 'bl' : 'br');
      cap = captureGameRegion();
      results = cap.findMulti(RecognitionObject.ocr(x, y, w, h));
      for (let i = 0; i < results.count; i++) {
        const r = results[i];
        const t = (r.text || "").replace(/\s+/g, "");
        if (t.includes(text)) {
          log.info("[点击] {text} @({x},{y},{w},{h})", text, r.x, r.y, r.width, r.height);
          r.click();
          clicked = true;
          break;
        }
      }
    } catch (e) {
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

export async function clickGuideButton(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let cap = null;
    let results = null;
    const found = [];
    try {
      debugFrameStart();
      parkMouse();
      cap = captureGameRegion();
      debugBox("全屏OCR:提升指南", 0, 0, cap.width, cap.height, "#ff5252");
      results = cap.findMulti(RecognitionObject.ocr(0, 0, cap.width, cap.height));
      for (let i = 0; i < results.count; i++) {
        const r = results[i];
        if ((r.text || "").replace(/\s+/g, "").includes("提升指南")) {
          const cy = r.y + r.height / 2;
          found.push({ cy, r });
        }
      }
      if (found.length > 0) {
        // 一律选 y 最小的那个；选定后本次不再点其它候选
        found.sort((a, b) => a.cy - b.cy);
        const best = found[0];
        log.info("[点击] 提升指南 @({x},{y},{w},{h})", best.r.x, best.r.y, best.r.width, best.r.height);
        best.r.click();
        return true;
      }
    } catch (e) {
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

export async function waitPopupName() {
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

export function popupStillOpen(lines) {
  return !!(findAnchorLine(lines, "培养需求") || findAnchorLine(lines, "来源"));
}

export async function closePopup(name) {
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

export async function scrollPopupUp() {
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

export async function readPopup() {
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
  log.info("[可合成数量] {text} -> {n}", synthText, synthCount);

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

  // 按材料名行背景色判品质（金1/紫2/蓝3/绿4），失败为 null
  const nameLine = popupNameLine(lines);
  const colorRankTop = qualityFromPopupColor(nameLine);

  // rank1/2/3 且没识别到可合成数量：屏幕中心向上滑一下，停1秒后补识别。
  // 滑动后材料名会移出屏幕，所以先在上面把名字等字段取完，这里只补可合成数量。
  if (colorRankTop >= 1 && colorRankTop <= 3 && synthCount === 0) {
    log.info("[可合成数量] 未识别，上滑补充 (rank{rank})", colorRankTop);
    await scrollPopupUp();

    const lines2 = readPopupLines();
    const synthAnchor2 = findAnchorLine(lines2, "可合成");
    let synthText2 = synthAnchor2 ? synthAnchor2.text : "";
    const synthBelow2 = synthAnchor2 ? collectBelowAnchor(lines2, synthAnchor2, 80, /来源|培养需求|可合成/) : "";
    if (synthBelow2) synthText2 += synthBelow2;
    const digits2 = (synthText2.match(/\d+/g) || []);
    const count2 = digits2.length > 0 ? (parseInt(digits2[digits2.length - 1], 10) || 0) : 0;
    log.info("[可合成数量] 补充识别 {text} -> {n}", synthText2, count2);
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

export function popupNameLine(lines) {
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

export function qualityFromPopupColor(nameLine) {
  if (!nameLine) return null;
  const x = Math.max(0, nameLine.x - sX(12));
  const y = Math.max(0, nameLine.y - sY(12));
  const w = Math.min(sX(1920) - x, nameLine.width + sX(60));
  const h = Math.min(sY(1080) - y, nameLine.height + sY(24));
  if (w <= 0 || h <= 0) return null;

  let cap = null, crop = null, hsv = null;
  try {
    debugFrameStart();
    debugBox("品质颜色裁剪", x, y, w, h, "#e040fb");
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
      log.info("[品质颜色] {name} {cnt}px", best.name, best.cnt);
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

export async function processMarker(m) {
  log.info("[点击] 标注 ({x},{y},{w},{h})", m.x, m.y, m.width, m.height);
  try {
    if (m.region) {
      m.region.click();
      m.region.dispose();
      m.region = null;
    } else {
      return null;
    }
  } catch (e) {
    log.error("点击标注失败: {err}", e.message);
    try { if (m.region) { m.region.dispose(); m.region = null; } } catch (e2) { }
    return null;
  }
  await sleep(900);

  const info = await readPopup();
  if (!info) {
    log.warn("未识别到材料弹窗，ESC 跳过");
    await closePopup("");
    return null;
  }

  // 有效弹窗必须同时有「来源」和「培养需求」；否则是误点/弹窗未弹出
  if (!info.source || !info.needText || info.need <= 0 || info.name.includes("秘境")) {
    log.warn("弹窗无效 (name={name}, source={source}, need={need})，跳过", info.name, info.source, info.need);
    await closePopup(info.name);
    return null;
  }

  log.info("[材料] {name} | {source} | {needText}", info.name, info.source, info.needText);
  await closePopup(info.name);
  return info;
}
