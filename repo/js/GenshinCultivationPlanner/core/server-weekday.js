/**
 * 原神按服务器时间每日 04:00 刷新。返回 0=周日、1=周一……6=周六。
 * automatic=false 时仅用于开发/故障排查，使用手动星期。
 */
export function resolvePlanningWeekday({ automatic = true, manualWeekday, nowMs, serverOffsetMs = 0 }) {
  if (!automatic) {
    const day = Number.parseInt(manualWeekday, 10);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('手动计划星期必须为 0 到 6');
    return day;
  }
  const serverTime = new Date(nowMs + serverOffsetMs);
  if (serverTime.getUTCHours() < 4) serverTime.setUTCDate(serverTime.getUTCDate() - 1);
  return serverTime.getUTCDay();
}
