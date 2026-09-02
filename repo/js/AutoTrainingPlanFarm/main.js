// 培养计划自动刷取 v0.1.10（坐标基准 1920x1080，运行时按分辨率缩放）
import { getS, setMetrics, sY, touchActivity } from "./src/core/common.js";
import { debugEnsureMask, debugSetCanvas } from "./src/core/debug-overlay.js";
import { initMarkerTemplate, disposeMarkerResources, scanMarkersStable, dedupeMarkers, disposeMarkers, clusterRows, ROW_Y_BOUNDS } from "./src/core/markers.js";
import { ensureGuidePage, isGuidePage, waitGuideMarkers, processRow, disposeResinResources, calibrateFirstRow, FIRST_ROW_ANCHOR_Y } from "./src/plan/guide.js";
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
  let saveFile = String(getS("saveFile", "plan_needs.json"));
  if (!/^[^\\/:*?"<>|]+\.json$/i.test(saveFile)) {
    log.warn("saveFile 非法（只允许 .json 文件名），已回退为 plan_needs.json");
    saveFile = "plan_needs.json";
  }

  // 写需求清单（空计划也写，避免日常流程读到上一次的旧清单）
  const writeSummary = (items) => {
    const summary = {
      generatedAt: new Date().toISOString(),
      count: items.length,
      items
    };
    const ok = file.writeTextSync(saveFile, JSON.stringify(summary, null, 2));
    if (!ok) throw new Error("保存需求清单失败: " + saveFile);
  };

  // 读取模板并按当前分辨率缩放
  initMarkerTemplate(matchThreshold);

  // 完全重扫，和第一次打开脚本一样；首行没标注就先做一次固定位置校准
  const rescanRows = async () => {
    await ensureGuidePage();
    touchActivity();

    const firstRowY = sY(FIRST_ROW_ANCHOR_Y);
    let visible = dedupeMarkers(await scanMarkersStable(1000));
    if (!visible.some(m => Math.abs(m.y - firstRowY) < sY(30))) {
      log.warn("首行区域（y≈{y}）未识别到标注，执行一次首行校准后重试", firstRowY);
      disposeMarkers(visible);
      await calibrateFirstRow();
      touchActivity();
      visible = dedupeMarkers(await scanMarkersStable(1000));
    }
    const visibleCount = visible.length;
    disposeMarkers(visible);
    log.info("[扫描] 识别到标注 {count} 个", visibleCount);

    if (visibleCount === 0) return null;
    return clusterRows(visible).map((r, idx) => ({
      index: idx + 1,
      y: Math.max(sY(ROW_Y_BOUNDS.min), Math.min(sY(ROW_Y_BOUNDS.max), Math.round(r.y))),
      names: new Map(),
      nextRank: 1
    }));
  };

  // 清单只保留“当前处理行”：每次都先清空再扫描当前行
  const entries = [];
  let stopByNoDomain = false;

  let rows = await rescanRows();
  if (!rows) {
    // 校准后仍无任何标注：确认页面后按无待刷材料正常结束
    if (isGuidePage()) {
      log.warn("已确认在提升指南页面且无培养标注：本日无待刷材料，正常结束");
      writeSummary([]);
      log.info("清单: {file}", saveFile);
      return;
    }
    throw new Error("扫描不到标注，且未确认在提升指南页面，请检查游戏状态");
  }

  let ri = 0;
  while (true) {
    if (ri >= rows.length) break; // 本快照里的行已全部处理完

    const row = rows[ri];

    // 换行时重新打开提升指南页
    if (ri > 0) {
      log.info("[行] 切换到 y={y}", row.y);
      await ensureGuidePage();
      touchActivity();
      if (!(await waitGuideMarkers(15000))) {
        log.warn("切换行后 15 秒内未检测到标注图标，重试一次");
        if (!(await waitGuideMarkers(15000))) {
          throw new Error("切换行后 30 秒内未检测到标注图标，请检查游戏状态");
        }
      }
    }

    // A 方案：文件只保留当前行。处理新行前先清掉上一条记录。
    entries.length = 0;

    let rowOk = false;
    let rowResult = null;
    try {
      rowResult = await processRow(row, entries);
      rowOk = true;
    } catch (e) {
      log.error("[行] 第 {i} 行识别失败，本行结果已清空，不再刷取: {err}", row.index, e.message);
      entries.length = 0;
    }
    const rowEntries = entries.slice();

    // 周本/未开放副本/秘境名 OCR 彻底失败：正常结束，不抛错
    if (rowResult && rowResult.status === "noDomain") {
      log.warn("第 {i} 行无可刷秘境（周本/未开放副本），正常结束", row.index);
      stopByNoDomain = true;
      writeSummary([]);
      break;
    }

    if (!rowOk) {
      log.warn("[行] 第 {i} 行未成功完成，跳过自动秘境，继续下一行", row.index);
      ri++;
      continue;
    }

    log.info("[行] 第 {i} 行完成，新增 {n} 个材料", row.index, rowEntries.length);

    // 保存当前行清单
    writeSummary(entries);

    // 刷副本（固定开启）：只刷这一行的材料
    if (rowEntries.length > 0) {
      let domainResult = null;
      try {
        domainResult = await runDomainPhase(entries, Math.round(row.y));
      } catch (e) {
        // 出错时先落盘当前清单，再抛给全局 catch
        log.error("[自动秘境] 第 {i} 行执行异常，保存当前清单后停止: {err}", row.index, (e && e.message) ? e.message : String(e));
        try {
          writeSummary(entries);
          log.info("清单: {file}", saveFile);
        } catch (e2) {
          log.error("[自动秘境] 保存清单失败: {err}", (e2 && e2.message) ? e2.message : String(e2));
        }
        throw e;
      }
      // 树脂耗尽或刷新失败：整体流程完成，不再处理后续行
      if (domainResult && domainResult.stopScript) {
        log.info("[自动秘境] 已停止（树脂耗尽或刷新失败），不再处理后续行");
        break;
      }
      // 本行已消失、下方行上移：完全重扫，和第一次打开脚本一样
      if (domainResult && domainResult.rowGone) {
        log.info("当前行已完成并消失，重新扫描剩余行");
        rows = await rescanRows();
        if (!rows) {
          if (isGuidePage()) {
            log.warn("重新扫描无标注：本日无待刷材料，正常结束");
            writeSummary([]);
            log.info("清单: {file}", saveFile);
            return;
          }
          throw new Error("重新扫描不到标注，且未确认在提升指南页面，请检查游戏状态");
        }
        ri = 0;
        continue;
      }
    }

    // 本行未消失（材料已够但页面仍显示），按第一次运行逻辑切到本快照下一行
    ri++;
  }

  // 最终清单（A 方案：写当前/最后一次的清单；noDomain 已在分支内落盘空清单）
  if (!stopByNoDomain) {
    writeSummary(entries);
  }

  if (stopByNoDomain) {
    log.info("无可刷秘境，正常结束，共记录 {count} 个材料", entries.length);
  } else {
    log.info("扫描完成，共 {count} 个材料", entries.length);
  }
  for (const e of entries) {
    log.info("  {name} [{label}] {needText} {source}", e.material, e.qualityLabel, e.needText, e.source);
  }
  log.info("清单: {file}", saveFile);

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    log.error("脚本执行失败，已停止: {err}", msg);
    throw e;
  } finally {
    disposeMarkerResources();
    disposeResinResources();
  }
})();
