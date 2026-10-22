import { isCancellationError } from '../core/error-classifier.js';

/** 只采样推荐页证据；不会解析套装、扫描背包或授权刷取。导航由已有指南模块提供。 */
export async function collectArtifactRecommendationSample({
  characterName, runId, directory, startedAt, version,
  openHome, findCharacter, openCharacter, clickArtifactTab, capture,
  requireCharacterHeader, returnMainUi, save, saveFailureScreenshot,
  wait, now = Date.now, checkCancellation = () => {},
}) {
  const deadline = now() + 90000;
  const report = {
    schemaVersion: 1, runId, characterName, requestedTab: '圣遗物',
    startedAt, bettergiVersion: version, reportPath: `${directory}/sample.json`,
    status: 'reading', ok: false, stage: '打开提升指南',
    tabClicked: false, pageActivationVerified: false, recommendationVerified: false,
    spendingAllowed: false, snapshots: {}, cleanup: { status: 'not-started' },
  };
  let cancelled = null;
  const check = () => {
    checkCancellation();
    if (now() >= deadline) {
      const error = new Error('圣遗物推荐采样超过90秒，已停止');
      error.code = 'sample_timeout';
      throw error;
    }
  };
  const step = async (stage, action) => {
    report.stage = stage;
    check();
    const value = await action();
    check();
    return value;
  };
  try {
    report.snapshots.home = await step('打开提升指南', openHome);
    const character = findCharacter(report.snapshots.home, characterName);
    if (!character) throw new Error(`指南当前列表中未找到“${characterName}”；未修改游戏培养计划`);
    report.snapshots.beforeTab = await step('打开所选角色', () => openCharacter(character, report.snapshots.home));
    requireCharacterHeader(report.snapshots.beforeTab, characterName);
    report.tabLocator = await step('点击圣遗物页签', () => clickArtifactTab(report.snapshots.beforeTab.screen));
    report.tabClicked = true;
    await step('等待推荐页面', () => wait(700));
    report.snapshots.first = await step('保存推荐页第一帧', capture);
    requireCharacterHeader(report.snapshots.first, characterName);
    await step('等待第二帧', () => wait(400));
    report.snapshots.second = await step('保存推荐页第二帧', capture);
    requireCharacterHeader(report.snapshots.second, characterName);
    // 两张全屏和OCR用于首次布局确认；看见页签不等于已经验证选中态。
    report.status = 'captured-pending-review';
    report.ok = true;
    report.note = '已保存两帧推荐页候选画面，页签选中状态及推荐区域仍需截图确认；未授权刷取';
  } catch (error) {
    cancelled = isCancellationError(error) ? error : null;
    report.status = cancelled ? 'cancelled' : 'failed';
    report.error = { code: cancelled ? 'cancelled' : error.code ?? 'sample_failed',
      message: error.message ?? String(error), stack: error.stack ?? null };
    if (!cancelled) {
      try { report.failureScreenshot = saveFailureScreenshot(); }
      catch (captureError) { report.failureScreenshotError = captureError.message ?? String(captureError); }
    }
  } finally {
    if (cancelled) {
      report.cleanup = { status: 'skipped-cancelled' };
    } else {
      try {
        // 超时后仅允许安全返回；不继续查找、点击页签或重新采样。
        checkCancellation();
        await returnMainUi();
        report.cleanup = { status: 'succeeded' };
      } catch (error) {
        cancelled = isCancellationError(error) ? error : null;
        report.cleanup = { status: cancelled ? 'cancelled' : 'failed', message: error.message ?? String(error) };
        report.status = cancelled ? 'cancelled' : 'failed';
        report.ok = false;
        report.error ??= { code: cancelled ? 'cancelled' : 'cleanup_failed', message: report.cleanup.message };
      }
    }
    report.completedAt = new Date(now()).toISOString();
    try { await save(report); }
    catch (error) {
      if (cancelled) throw cancelled;
      throw new Error(`采样报告保存失败：${error.message ?? String(error)}`);
    }
  }
  if (cancelled) throw cancelled;
  return report;
}
