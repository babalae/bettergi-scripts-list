// 调试可视化（htmlMask）：仅 debugShowBoxes=true 且存在 assets/debug_boxes.html 时生效，失败不影响主流程
import { getS } from "./common.js";

let debugMaskId = null;
const debugBoxes = [];
let debugCapW = 0;
let debugCapH = 0;

export function debugSetCanvas(w, h) {
  debugCapW = w;
  debugCapH = h;
}

export function debugEnsureMask() {
  try {
    if (getS("debugShowBoxes", false) === false) return false;
    if (typeof htmlMask === "undefined" || !htmlMask || !htmlMask.show) return false;
    if (!debugMaskId || !htmlMask.exists || !htmlMask.exists(debugMaskId)) {
      debugMaskId = htmlMask.show("assets/debug_boxes.html", "plan-debug-boxes");
    }
    return !!debugMaskId;
  } catch (e) {
    return false;
  }
}

export function debugFrameStart() {
  debugBoxes.length = 0;
  if (!debugEnsureMask()) return;
  try {
    htmlMask.send(debugMaskId, "/boxes/clear", "{}");
  } catch (e) { }
}

export function debugBox(label, x, y, w, h, color) {
  if (!label || !debugEnsureMask()) return;
  if (!debugCapW || !debugCapH) return;
  const box = {
    label: String(label).slice(0, 80),
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
    color: color || "#00e5ff"
  };
  const idx = debugBoxes.findIndex(b => b.label === box.label);
  if (idx >= 0) debugBoxes[idx] = box;
  else {
    if (debugBoxes.length >= 80) debugBoxes.shift();
    debugBoxes.push(box);
  }
  try {
    htmlMask.send(debugMaskId, "/boxes/update", JSON.stringify({
      w: debugCapW, h: debugCapH, boxes: debugBoxes
    }));
  } catch (e) { }
}
