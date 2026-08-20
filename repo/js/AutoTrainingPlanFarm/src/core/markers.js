// 培养计划标注图标：模板加载、扫描、按行聚合
import { sX, sY, scaleX, scaleY, parkMouse, touchActivity, assertAlive } from "./common.js";
import { debugFrameStart, debugBox } from "./debug-overlay.js";

const MARKER_PATH = "assets/RecognitionObject/guide_marker_green.png";

// 右半屏搜索区域
const MARKER_ROI = { x: 900, y: 280, w: 1020, h: 600 };

// 行 y 合法范围（ROI 边界内留出模板高度余量）
export const ROW_Y_BOUNDS = { min: 288, max: 848 };

let markerMat = null;
let markerRo = null;
let matchThreshold = 0.9;

// 读取模板并按当前分辨率缩放；必须在 setMetrics 之后调用
export function initMarkerTemplate(threshold) {
  matchThreshold = threshold;
  markerMat = file.readImageMatSync(MARKER_PATH);
  if (!markerMat || markerMat.empty() || markerMat.width <= 0 || markerMat.height <= 0) {
    throw new Error("标注图标模板读取失败或为空: " + MARKER_PATH);
  }
  const tw = Math.max(4, Math.round(markerMat.width * scaleX));
  const th = Math.max(4, Math.round(markerMat.height * scaleY));
  if (tw !== markerMat.width || th !== markerMat.height) {
    const resized = new Mat();
    OpenCvSharp.OpenCvSharp.Cv2.Resize(markerMat, resized, new OpenCvSharp.OpenCvSharp.Size(tw, th));
    try { markerMat.dispose(); } catch (e) { }
    markerMat = resized;
    log.info("[模板] 缩放为 {w}x{h}", tw, th);
  }
}

export function scanMarkers() {
  let cap = null;
  let results = null;
  try {
    debugFrameStart();
    parkMouse();
    cap = captureGameRegion();
    debugBox("标记ROI", sX(MARKER_ROI.x), sY(MARKER_ROI.y), sX(MARKER_ROI.w), sY(MARKER_ROI.h), "#00e676");
    // 复用同一个识别规则对象，避免每次截图都重建灰度/遮罩 Mat
    if (!markerRo) {
      markerRo = RecognitionObject.TemplateMatch(markerMat, true);
    }
    markerRo.Threshold = matchThreshold;
    results = cap.findMulti(markerRo);

    const arr = [];
    for (let i = 0; i < results.count; i++) {
      const r = results[i];
      const drop = () => { try { r.dispose(); } catch (e) { } };

      // 分数缺失/非有限（含 Infinity/NaN）直接丢弃
      if (r.matchScore === undefined || r.matchScore === null) { drop(); continue; }
      const score = Number(r.matchScore);
      if (!Number.isFinite(score)) { drop(); continue; }

      // 只保留右半屏目标区域（按分辨率缩放）
      if (r.x < sX(MARKER_ROI.x) || r.y < sY(MARKER_ROI.y)) { drop(); continue; }
      if (r.x + r.width > sX(MARKER_ROI.x) + sX(MARKER_ROI.w)) { drop(); continue; }
      if (r.y + r.height > sY(MARKER_ROI.y) + sY(MARKER_ROI.h)) { drop(); continue; }

      // 尺寸过滤：模板 24x32，按分辨率缩放后允许一定容差
      if (r.width < sX(16) || r.width > sX(40)) { drop(); continue; }
      if (r.height < sY(20) || r.height > sY(48)) { drop(); continue; }
      const ratio = r.height / r.width;
      if (ratio < 0.8 || ratio > 1.6) { drop(); continue; }

      // 二次分数过滤（防止 ClearScript 属性赋值未生效）
      if (score < matchThreshold) { drop(); continue; }

      debugBox("标记@" + r.x + "," + r.y, r.x, r.y, r.width, r.height, "#ff1744");
      touchActivity();
      arr.push({
        x: r.x, y: r.y,
        width: r.width, height: r.height,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2,
        score,
        region: r
      });
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

export function disposeMarkers(markers) {
  for (const m of markers) {
    try {
      if (m.region) {
        m.region.dispose();
        m.region = null;
      }
    } catch (e) { }
  }
}

export function disposeMarkerResources() {
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

export function dedupeMarkers(markers) {
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

export function clusterRows(markers) {
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

export function guideMarkerCount() {
  const ms = scanMarkers();
  const n = ms.length;
  disposeMarkers(ms);
  return n;
}

export async function scanMarkersStable(timeoutMs = 1000) {
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

export async function scanRowMarkers(rowY, timeoutMs = 1000) {
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
