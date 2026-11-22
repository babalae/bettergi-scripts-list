import { runPatrol } from 'patrol.js';

function numberSetting(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const config = {
    npc: String(settings.npc || '淮安').trim(),
    routeFile: String(settings.routeFile || '暂行之策-安全下楼与巡逻.json').trim(),
    patrolStartIndex: numberSetting(settings.patrolStartIndex, 8),
    approachPointCount: numberSetting(settings.approachPointCount, 8),
    maxRounds: numberSetting(settings.maxRounds, 6),
    timeoutSeconds: numberSetting(settings.timeoutSeconds, 240),
    arrivalDistance: numberSetting(settings.arrivalDistance, 1.2),
    noSkip: !!settings.noSkip,
    noEat: !!settings.noEat
  };
  log.info('巡逻对话启动，目标 NPC：' + config.npc);
  await runPatrol(config);
}

main().catch(err => {
  log.error('巡逻对话停止：' + (err && err.message ? err.message : String(err)));
});
