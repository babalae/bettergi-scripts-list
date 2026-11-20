const POINTS_PATH = "assets/tp-points.json";
const CHECKPOINT_PATH = "local/checkpoint.json";
const RESULTS_PATH = "local/results.log";
const REPORT_PATH = "local/report.json";
const MASK_PATH = "assets/status-mask.html";
const REPORT_MASK_PATH = "assets/report-mask.html";
const MASK_ID_PREFIX = "teleport-activation-check";
const UNSUPPORTED_MAPS = new Set(["MoonCanon"]);
const STATE_VERSION = 1;
const SCHEDULE_VERSION = "activation-check-seeded-v1";

const RUN_MODE_CONTINUE = "继续上次检测";
const RUN_MODE_RETEST = "仅复测异常点";
const RUN_MODE_RESTART = "重新检测全部";
const RUN_MODE_REPORT = "查看检测报告";

let maskWindowId = null;
let maskInstanceNumber = 0;

const TYPE_NAMES = {
  BlessDomain: "祝圣秘境",
  ForgeryDomain: "炼武秘境",
  Goddess: "七天神像",
  MasteryDomain: "精通秘境",
  NatlanObsidianTotemPole: "曜石图腾柱",
  NodKraiMeetingPoint: "挪德卡莱集会所",
  OneTimeDomain: "一次性秘境",
  Other: "特殊传送点",
  TeleportWaypoint: "传送锚点",
  TrounceDomain: "征讨领域",
};

function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeededSchedule(points, sourceVersion) {
  const groupOrder = [];
  const groups = new Map();
  for (const point of points) {
    const groupKey = `${point.mapName}\u001f${point.country || ""}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
      groupOrder.push(groupKey);
    }
    groups.get(groupKey).push(point);
  }

  const scheduled = [];
  for (const groupKey of groupOrder) {
    const group = groups.get(groupKey).slice();
    const random = createRandom(hashSeed(`${sourceVersion}:${groupKey}`));
    for (let i = group.length - 1; i > 0; i--) {
      const selectedIndex = Math.floor(random() * (i + 1));
      [group[i], group[selectedIndex]] = [group[selectedIndex], group[i]];
    }
    scheduled.push(...group);
  }
  return scheduled;
}

function getPointKey(point) {
  return `${point.mapName}:${point.id}`;
}

function getPointName(point) {
  const location = [point.country, point.area]
    .filter((value) => value && String(value).trim())
    .join(" / ");
  const typeName = TYPE_NAMES[point.type] || point.type || "传送点";
  const name = point.name && point.name !== typeName ? `${typeName}「${point.name}」` : typeName;
  return location ? `${location} - ${name}` : `${point.mapName} - ${name}`;
}

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)} 秒`;
}

function clampInteger(value, defaultValue, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.min(max, Math.max(min, parsed));
}

function getOptions() {
  const configured = typeof settings === "object" && settings ? settings : {};
  const runMode = [RUN_MODE_CONTINUE, RUN_MODE_RETEST, RUN_MODE_RESTART, RUN_MODE_REPORT].includes(configured.runMode)
    ? configured.runMode
    : RUN_MODE_CONTINUE;
  return {
    runMode,
    retestCount: clampInteger(configured.retestCount, 3, 0, 10),
    slowThresholdMs: clampInteger(configured.slowThresholdSeconds, 10, 1, 300) * 1000,
    includeSlowPoints: configured.includeSlowPoints === true,
    pointIntervalMs: clampInteger(configured.pointIntervalMs, 500, 0, 5000),
    showOverlay: configured.showOverlay !== false,
  };
}

function statusMaskExists() {
  if (!maskWindowId) {
    return false;
  }
  try {
    return htmlMask.exists(maskWindowId);
  } catch (_) {
    maskWindowId = null;
    return false;
  }
}

async function showStatusMask(enabled) {
  if (!enabled || statusMaskExists()) {
    return;
  }
  try {
    const instanceId = `${MASK_ID_PREFIX}-${Date.now()}-${++maskInstanceNumber}`;
    maskWindowId = htmlMask.show(MASK_PATH, instanceId);
    if (!maskWindowId) {
      throw new Error("未能创建遮罩窗口");
    }
    await sleep(200);
    htmlMask.setClickThrough(maskWindowId, true);
  } catch (error) {
    maskWindowId = null;
    log.warn(`运行状态遮罩创建失败：${error.message || error}`);
  }
}

function closeStatusMask() {
  const windowId = maskWindowId;
  maskWindowId = null;
  if (!windowId) {
    return;
  }
  try {
    if (htmlMask.exists(windowId)) {
      htmlMask.close(windowId);
    }
  } catch (_) {
    // 遮罩可能已被用户关闭。
  }
}

function getStatusCounts(state) {
  const latestResults = Object.values(state.pointResults)
    .map(getLatestResult)
    .filter((result) => result != null);
  return {
    passed: latestResults.filter((result) => result.success && !result.slow).length,
    slow: latestResults.filter((result) => result.success && result.slow).length,
    failed: latestResults.filter((result) => !result.success).length,
  };
}

function updateStatusMask(state, totalPoints, current) {
  if (!statusMaskExists()) {
    return;
  }
  const counts = getStatusCounts(state);
  try {
    htmlMask.send(maskWindowId, "/status", JSON.stringify({
      phase: current.phase,
      current: current.current,
      phaseTotal: current.phaseTotal,
      totalPoints,
      name: current.name,
      status: current.status,
      elapsedMs: current.elapsedMs || 0,
      ...counts,
    }));
  } catch (_) {
    maskWindowId = null;
  }
}

function buildReportMaskData(state, totalPoints, skippedPoints, options) {
  const report = buildReport(state, totalPoints, skippedPoints, options);
  const unactivatedPoints = Object.values(state.pointResults)
    .map((record) => ({ record, latest: getLatestResult(record) }))
    .filter(({ latest }) => latest && !latest.success && !latest.cancelled)
    .map(({ record, latest }) => ({
      name: record.name,
      pointKey: record.pointKey,
      mapName: record.mapName,
      attempts: (record.initial ? 1 : 0) + (record.retests?.length || 0),
      elapsedMs: latest.elapsedMs || 0,
      error: latest.error || "点击后未能完成传送",
      timestamp: latest.timestamp,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  return { ...report, unactivatedPoints };
}

async function showReportMask(report) {
  closeStatusMask();
  const instanceId = `${MASK_ID_PREFIX}-report-${Date.now()}-${++maskInstanceNumber}`;
  maskWindowId = htmlMask.show(REPORT_MASK_PATH, instanceId);
  if (!maskWindowId) {
    throw new Error("无法创建检测报告遮罩");
  }

  await sleep(200);
  htmlMask.send(maskWindowId, "/report", JSON.stringify(report));

  while (statusMaskExists()) {
    const rawMessage = htmlMask.poll(maskWindowId);
    if (rawMessage) {
      try {
        const message = JSON.parse(rawMessage);
        if (message.url === "/close") {
          closeStatusMask();
          return;
        }
      } catch (_) {
        // 忽略格式不完整的前端消息。
      }
    }
    await sleep(100);
  }
}

function createState(sourceVersion) {
  return {
    stateVersion: STATE_VERSION,
    sourceVersion,
    scheduleVersion: SCHEDULE_VERSION,
    phase: "initial",
    activeMode: RUN_MODE_CONTINUE,
    nextIndex: 0,
    issuePointKeys: [],
    retestIndex: 0,
    retestAttempt: 0,
    pointResults: {},
    updatedAt: new Date().toISOString(),
  };
}

function importExistingResults(state, slowThresholdMs) {
  let lines;
  try {
    lines = file.readTextSync(RESULTS_PATH).split(/\r?\n/).filter((line) => line.trim());
  } catch (_) {
    return;
  }

  for (const line of lines) {
    let savedResult;
    try {
      savedResult = JSON.parse(line);
    } catch (_) {
      continue;
    }

    const pointKey = savedResult.pointKey;
    if (!pointKey) {
      continue;
    }

    let record = state.pointResults[pointKey];
    if (!record) {
      record = {
        pointKey,
        pointId: String(savedResult.pointId || pointKey.split(":").slice(1).join(":")),
        mapName: pointKey.split(":")[0],
        name: savedResult.name || savedResult.label || pointKey,
        initial: null,
        retests: [],
      };
      state.pointResults[pointKey] = record;
    }

    const elapsedMs = Number(savedResult.elapsedMs) || 0;
    const result = {
      timestamp: savedResult.timestamp || new Date().toISOString(),
      phase: savedResult.phase === "main" ? "initial" : savedResult.phase || "retest",
      attempt: Number(savedResult.attempt) || 0,
      index: Number(savedResult.index) || 0,
      pointId: record.pointId,
      pointKey,
      name: record.name,
      success: savedResult.success === true,
      slow: savedResult.success === true && elapsedMs >= slowThresholdMs,
      status: savedResult.success === true
        ? elapsedMs >= slowThresholdMs ? "slow" : "passed"
        : "failed",
      cancelled: savedResult.cancelled === true,
      error: savedResult.error || null,
      elapsedMs,
    };
    if (result.phase === "initial") {
      record.initial = result;
    } else {
      record.retests.push(result);
    }
  }
}

function loadState(sourceVersion, options) {
  let saved;
  try {
    saved = JSON.parse(file.readTextSync(CHECKPOINT_PATH));
  } catch (_) {
    return createState(sourceVersion);
  }

  if (!saved || saved.sourceVersion !== sourceVersion) {
    return createState(sourceVersion);
  }

  if (saved.stateVersion === STATE_VERSION) {
    saved.issuePointKeys = Array.isArray(saved.issuePointKeys) ? saved.issuePointKeys : [];
    saved.pointResults = saved.pointResults && typeof saved.pointResults === "object" ? saved.pointResults : {};
    return saved;
  }

  const migrated = createState(sourceVersion);
  migrated.phase = saved.phase === "main" ? "initial" : saved.phase === "retest" ? "retest" : "complete";
  migrated.nextIndex = Number.isInteger(saved.nextIndex) ? saved.nextIndex : 0;
  migrated.issuePointKeys = Array.isArray(saved.failedPointKeys) ? saved.failedPointKeys.slice() : [];
  migrated.retestIndex = Number.isInteger(saved.retestIndex) ? saved.retestIndex : 0;
  migrated.retestAttempt = Number.isInteger(saved.retestAttempt) ? saved.retestAttempt : 0;
  importExistingResults(migrated, options.slowThresholdMs);
  for (const [pointKey, record] of Object.entries(migrated.pointResults)) {
    if (needsReview(record, options.includeSlowPoints)) {
      addIssuePoint(migrated, pointKey);
    }
  }
  return migrated;
}

function updatePointMetadata(state, points) {
  const pointByKey = new Map(points.map((point) => [getPointKey(point), point]));
  for (const [pointKey, record] of Object.entries(state.pointResults)) {
    const point = pointByKey.get(pointKey);
    if (!point) {
      continue;
    }
    record.pointId = String(point.id);
    record.mapName = point.mapName;
    record.name = getPointName(point);
    if (record.initial) {
      record.initial.name = record.name;
    }
    for (const result of record.retests) {
      result.name = record.name;
    }
  }
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  file.writeTextSync(CHECKPOINT_PATH, JSON.stringify(state, null, 2));
}

function appendResult(result) {
  file.writeTextSync(RESULTS_PATH, `${JSON.stringify(result)}\n`, true);
}

function isCancellation(error) {
  const message = String(error && error.message ? error.message : error);
  const lowerMessage = message.toLowerCase();
  return message.includes("取消自动任务") || lowerMessage.includes("canceled") || lowerMessage.includes("cancelled");
}

function addIssuePoint(state, pointKey) {
  if (!state.issuePointKeys.includes(pointKey)) {
    state.issuePointKeys.push(pointKey);
  }
}

function savePointResult(state, point, phase, result) {
  const pointKey = getPointKey(point);
  let record = state.pointResults[pointKey];
  if (!record) {
    record = {
      pointKey,
      pointId: String(point.id),
      mapName: point.mapName,
      name: getPointName(point),
      initial: null,
      retests: [],
    };
    state.pointResults[pointKey] = record;
  }

  if (phase === "initial") {
    record.initial = result;
  } else {
    record.retests.push(result);
  }
}

function getLatestResult(record) {
  if (record.retests && record.retests.length > 0) {
    return record.retests[record.retests.length - 1];
  }
  return record.initial;
}

function recalculateSlowFlags(state, slowThresholdMs) {
  for (const record of Object.values(state.pointResults)) {
    const results = [record.initial, ...(record.retests || [])].filter((result) => result != null);
    for (const result of results) {
      result.slow = result.success && result.elapsedMs >= slowThresholdMs;
      result.status = result.success ? result.slow ? "slow" : "passed" : "failed";
    }
  }
}

function needsReview(record, includeSlowPoints) {
  const latest = getLatestResult(record);
  return !latest || !latest.success || (includeSlowPoints && latest.slow);
}

function refreshIssuePoints(state, includeSlowPoints) {
  const unresolved = [];
  for (const pointKey of state.issuePointKeys) {
    const record = state.pointResults[pointKey];
    if (!record || needsReview(record, includeSlowPoints)) {
      unresolved.push(pointKey);
    }
  }
  state.issuePointKeys = unresolved;
}

function buildReport(state, totalPoints, skippedPoints, options) {
  const records = Object.values(state.pointResults);
  const initialResults = records.map((record) => record.initial).filter((result) => result != null);
  const latestResults = records.map(getLatestResult).filter((result) => result != null);
  const passed = latestResults.filter((result) => result.success && !result.slow).length;
  const slow = latestResults.filter((result) => result.success && result.slow).length;
  const failed = latestResults.filter((result) => !result.success).length;
  const durations = latestResults.filter((result) => result.success).map((result) => result.elapsedMs);
  const averageElapsedMs = durations.length > 0
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    sourceVersion: state.sourceVersion,
    phase: state.phase,
    totalPoints,
    skippedPoints,
    checkedPoints: initialResults.length,
    passed,
    slow,
    failed,
    unresolved: state.issuePointKeys.length,
    averageElapsedMs,
    slowThresholdMs: options.slowThresholdMs,
    unresolvedPoints: state.issuePointKeys.map((pointKey) => {
      const record = state.pointResults[pointKey];
      return record || { pointKey, name: pointKey, initial: null, retests: [] };
    }),
  };
}

function writeReport(state, totalPoints, skippedPoints, options) {
  const report = buildReport(state, totalPoints, skippedPoints, options);
  file.writeTextSync(REPORT_PATH, JSON.stringify(report, null, 2));
  return report;
}

function logReport(report) {
  log.info(
    `检测汇总：已检测 ${report.checkedPoints}/${report.totalPoints}，通过 ${report.passed}，较慢 ${report.slow}，失败 ${report.failed}，仍需复核 ${report.unresolved}`
  );
  if (report.averageElapsedMs > 0) {
    log.info(`成功点平均耗时：${formatDuration(report.averageElapsedMs)}`);
  }
  if (report.unresolvedPoints.length > 0) {
    const preview = report.unresolvedPoints.slice(0, 10).map((record) => record.name).join("；");
    log.warn(`需复核点位${report.unresolvedPoints.length > 10 ? "（前 10 个）" : ""}：${preview}`);
  }
}

async function runPoint(point, index, total, phase, attempt, options) {
  const pointKey = getPointKey(point);
  const pointName = getPointName(point);
  const phaseName = phase === "initial" ? "首次检测" : `复测 ${attempt}`;
  const startedAt = Date.now();
  log.info(`[${index + 1}/${total}] ${phaseName}：${pointName}（${pointKey}）`);

  try {
    await genshin.tp(point.x, point.y, point.mapName, false);
    const elapsedMs = Date.now() - startedAt;
    const slow = elapsedMs >= options.slowThresholdMs;
    const result = {
      timestamp: new Date().toISOString(),
      phase,
      attempt,
      index,
      pointId: String(point.id),
      pointKey,
      name: pointName,
      success: true,
      slow,
      status: slow ? "slow" : "passed",
      elapsedMs,
    };
    appendResult(result);
    if (slow) {
      log.warn(`通过但较慢：${pointName}，耗时 ${formatDuration(elapsedMs)}`);
    } else {
      log.info(`通过：${pointName}，耗时 ${formatDuration(elapsedMs)}`);
    }
    if (options.pointIntervalMs > 0) {
      await sleep(options.pointIntervalMs);
    }
    return result;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const result = {
      timestamp: new Date().toISOString(),
      phase,
      attempt,
      index,
      pointId: String(point.id),
      pointKey,
      name: pointName,
      success: false,
      slow: false,
      status: "failed",
      cancelled: isCancellation(error),
      error: message,
      elapsedMs: Date.now() - startedAt,
    };
    appendResult(result);

    if (result.cancelled) {
      throw error;
    }

    log.error(`需要复核：${pointName}，原因：${message}`);
    try {
      await genshin.returnMainUi();
    } catch (returnError) {
      log.warn(`返回主界面失败：${returnError.message}`);
    }
    await sleep(1000);
    return result;
  }
}

(async function () {
  const startedAt = Date.now();
  const options = getOptions();
  const data = JSON.parse(file.readTextSync(POINTS_PATH));
  const allPoints = data.points || [];
  const sourceVersion = data.sourceVersion || "unknown";
  const points = buildSeededSchedule(
    allPoints.filter((point) => !UNSUPPORTED_MAPS.has(point.mapName)),
    sourceVersion
  );
  const pointByKey = new Map(points.map((point) => [getPointKey(point), point]));
  const pointIndexByKey = new Map(points.map((point, index) => [getPointKey(point), index]));
  const skippedPoints = allPoints.length - points.length;
  let state = loadState(sourceVersion, options);
  recalculateSlowFlags(state, options.slowThresholdMs);
  updatePointMetadata(state, points);
  for (const [pointKey, record] of Object.entries(state.pointResults)) {
    if (needsReview(record, options.includeSlowPoints)) {
      addIssuePoint(state, pointKey);
    }
  }
  refreshIssuePoints(state, options.includeSlowPoints);

  if (options.runMode === RUN_MODE_REPORT) {
    // 查看报告不会改变检测游标和上次运行模式。
  } else if (options.runMode === RUN_MODE_RESTART) {
    state = createState(sourceVersion);
    state.activeMode = RUN_MODE_RESTART;
    file.writeTextSync(RESULTS_PATH, "");
    saveState(state);
  } else if (options.runMode === RUN_MODE_RETEST) {
    if (state.activeMode !== RUN_MODE_RETEST || state.phase === "complete") {
      state.phase = "retest";
      state.retestIndex = 0;
      state.retestAttempt = 0;
    }
    state.activeMode = RUN_MODE_RETEST;
    saveState(state);
  } else {
    state.activeMode = RUN_MODE_CONTINUE;
    saveState(state);
  }

  log.info("传送点激活检测工具启动");
  log.info(
    `模式：${options.runMode}；候选点 ${points.length}；慢速阈值 ${options.slowThresholdMs / 1000} 秒；异常点复测 ${options.retestCount} 次`
  );

  if (options.runMode === RUN_MODE_REPORT) {
    const report = buildReportMaskData(state, points.length, skippedPoints, options);
    logReport(report);
    try {
      await showReportMask(report);
    } finally {
      closeStatusMask();
    }
    return;
  }

  await showStatusMask(options.showOverlay);
  updateStatusMask(state, points.length, {
    phase: state.phase === "retest" ? "异常复测" : "首次检测",
    current: state.phase === "retest" ? state.retestIndex : state.nextIndex,
    phaseTotal: state.phase === "retest" ? state.issuePointKeys.length : points.length,
    name: "正在准备检测",
    status: "preparing",
  });

  if (state.phase === "complete" && options.runMode === RUN_MODE_CONTINUE) {
    log.info("上一次检测已经完成。需要重新执行时，请在脚本设置中选择“重新检测全部”或“仅复测异常点”。");
    logReport(writeReport(state, points.length, skippedPoints, options));
    updateStatusMask(state, points.length, {
      phase: "检测完成",
      current: points.length,
      phaseTotal: points.length,
      name: "上一次检测已经完成",
      status: "complete",
    });
    await sleep(1500);
    closeStatusMask();
    return;
  }

  try {
    await genshin.returnMainUi();

    if (state.phase === "initial") {
      for (let i = state.nextIndex; i < points.length; i++) {
        const point = points[i];
        updateStatusMask(state, points.length, {
          phase: "首次检测",
          current: i + 1,
          phaseTotal: points.length,
          name: getPointName(point),
          status: "running",
        });
        const result = await runPoint(point, i, points.length, "initial", 0, options);
        savePointResult(state, point, "initial", result);
        if (!result.success || (options.includeSlowPoints && result.slow)) {
          addIssuePoint(state, getPointKey(point));
        }
        state.nextIndex = i + 1;
        saveState(state);
        updateStatusMask(state, points.length, {
          phase: "首次检测",
          current: i + 1,
          phaseTotal: points.length,
          name: getPointName(point),
          status: result.status,
          elapsedMs: result.elapsedMs,
        });

        if ((i + 1) % 25 === 0) {
          logReport(writeReport(state, points.length, skippedPoints, options));
        }
      }

      state.phase = "retest";
      state.retestIndex = 0;
      state.retestAttempt = 0;
      saveState(state);
    }

    const issuePoints = state.issuePointKeys
      .map((pointKey) => pointByKey.get(pointKey))
      .filter((point) => point != null);

    if (issuePoints.length === 0) {
      log.info("没有需要复测的异常点。");
    }

    for (let i = state.retestIndex; i < issuePoints.length; i++) {
      const point = issuePoints[i];
      const pointKey = getPointKey(point);
      const originalIndex = pointIndexByKey.get(pointKey) ?? 0;
      const startAttempt = i === state.retestIndex ? state.retestAttempt : 0;
      for (let attempt = startAttempt; attempt < options.retestCount; attempt++) {
        updateStatusMask(state, points.length, {
          phase: `异常复测 ${attempt + 1}/${options.retestCount}`,
          current: i + 1,
          phaseTotal: issuePoints.length,
          name: getPointName(point),
          status: "running",
        });
        const result = await runPoint(point, originalIndex, points.length, "retest", attempt + 1, options);
        savePointResult(state, point, "retest", result);
        state.retestIndex = i;
        state.retestAttempt = attempt + 1;
        saveState(state);
        updateStatusMask(state, points.length, {
          phase: `异常复测 ${attempt + 1}/${options.retestCount}`,
          current: i + 1,
          phaseTotal: issuePoints.length,
          name: getPointName(point),
          status: result.status,
          elapsedMs: result.elapsedMs,
        });
      }
      state.retestIndex = i + 1;
      state.retestAttempt = 0;
      saveState(state);
    }

    refreshIssuePoints(state, options.includeSlowPoints);
    state.phase = "complete";
    saveState(state);
    const report = writeReport(state, points.length, skippedPoints, options);
    logReport(report);
    log.info(`检测结束，总耗时 ${formatDuration(Date.now() - startedAt)}。详细报告：${REPORT_PATH}`);
    updateStatusMask(state, points.length, {
      phase: "检测完成",
      current: points.length,
      phaseTotal: points.length,
      name: report.unresolved > 0 ? `仍有 ${report.unresolved} 个点需要复核` : "全部点位检测完成",
      status: "complete",
    });
    await sleep(1500);
  } catch (error) {
    if (isCancellation(error)) {
      saveState(state);
      writeReport(state, points.length, skippedPoints, options);
      log.warn("检测已停止，进度已经保存，下次选择“继续上次检测”即可恢复。");
      return;
    }
    throw error;
  } finally {
    closeStatusMask();
  }
})();
