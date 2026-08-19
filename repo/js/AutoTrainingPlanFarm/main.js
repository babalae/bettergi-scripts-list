// 培养计划自动刷取 v0.1.8（坐标基准 1920x1080，运行时按分辨率缩放）
import { getS, setMetrics } from "./src/core/common.js";
import { debugEnsureMask, debugSetCanvas } from "./src/core/debug-overlay.js";
import { initMarkerTemplate, disposeMarkerResources, scanMarkersStable, dedupeMarkers, disposeMarkers, clusterRows } from "./src/core/markers.js";
import { ensureGuidePage, isGuidePage, waitGuideMarkers, processRow } from "./src/plan/guide.js";
import { runDomainPhase } from "./src/plan/domain-run.js";

(async function () {
  try {
  setGameMetrics(1920, 1080, 1.25);

  // 计算截图相对 1920x1080 的缩放比例
  {
    let probe = null;
    try {
      probe = captureGameRegion();
      setMetrics(probe.width, probe.height);
      debugSetCanvas(probe.width, probe.height);
      log.info("[截图] {w}x{h}，缩放 {sx}/{sy}", probe.width, probe.height, (probe.width / 1920).toFixed(3), (probe.height / 1080).toFixed(3));
    } finally {
      try { if (probe) probe.dispose(); } catch (e) { }
    }
  }

  // 提前打开调试覆盖层
  debugEnsureMask();

  const matchThreshold = parseFloat(getS("markerThreshold", "0.9"));
  if (isNaN(matchThreshold) || matchThreshold <= 0 || matchThreshold > 1) {
    throw new Error("markerThreshold 必须是 0~1 之间的数字");
  }
  const autoOpen = getS("autoOpenGuide", true);
  const saveFile = String(getS("saveFile", "plan_needs.json"));

  // 读取模板并按当前分辨率缩放
  initMarkerTemplate(matchThreshold);

  if (autoOpen) {
    await ensureGuidePage();
  } else if (!(await isGuidePage())) {
    log.warn("未检测到提升指南页面，如已打开请忽略，否则开启自动打开");
  }

  // 页面动画可能尚未渲染完，等标注图标出现再继续
  if (!(await waitGuideMarkers(15000))) {
    log.error("15 秒内未检测到标注图标");
  }

  const entries = [];

  // 1. 按行分组扫描（同排 y 差 < 10，持续约 1s 提高成功率）
  const visible = dedupeMarkers(await scanMarkersStable(1000));
  disposeMarkers(visible);
  log.info("[扫描] 识别到标注 {count} 个", visible.length);

  if (visible.length === 0) {
    log.info("未识别到标注，脚本结束");
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

  // 2. 逐行处理：识别该行材料并刷取，完成后切下一行；doneRowYs 仅本次运行内存态
  const doneRowYs = new Set();
  const runDomains = getS("runDomain", true) !== false;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (doneRowYs.has(row.y)) continue;

    // 换行时重新打开提升指南页
    if (ri > 0) {
      log.info("[行] 切换到 y={y}", row.y);
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
    log.info("[行] 第 {i} 行完成，新增 {n} 个材料", row.index, rowEntries.length);

    // 保存清单（每次处理完一行都落盘）
    const summary = {
      generatedAt: new Date().toISOString(),
      count: entries.length,
      items: entries
    };
    const ok = file.writeTextSync(saveFile, JSON.stringify(summary, null, 2));
    if (!ok) throw new Error("保存需求清单失败: " + saveFile);

    // 刷副本（可选）：只刷这一行的材料
    if (runDomains && rowEntries.length > 0) {
      const domainResult = await runDomainPhase(entries, Math.round(row.y));
      // 仅树脂耗尽模式：副本刷取结束即整体流程完成，不再处理后续行
      if (domainResult && domainResult.stopScript) {
        log.info("[树脂耗尽模式] 流程完成");
        break;
      }
    }

    // 本行处理完成，后续跳过该行
    doneRowYs.add(row.y);
    log.info("[行] 第 {i} 行处理完成", row.index);
  }

  // 3. 最终清单
  const summary = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    items: entries
  };
  const ok = file.writeTextSync(saveFile, JSON.stringify(summary, null, 2));
  if (!ok) throw new Error("保存需求清单失败: " + saveFile);

  log.info("扫描完成，共 {count} 个材料", entries.length);
  for (const e of entries) {
    log.info("  {name} [{label}] {needText} {source}", e.material, e.qualityLabel, e.needText, e.source);
  }
  log.info("清单: {file}", saveFile);

  // 4. 未开启自动刷副本时的提示
  if (!runDomains) {
    log.info("未开启自动刷副本，本次仅扫描。可在设置中开启。");
  }

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    log.error("脚本执行失败，已停止: {err}", msg);
    throw e;
  } finally {
    disposeMarkerResources();
  }
})();
