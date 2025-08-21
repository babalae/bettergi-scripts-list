(async function () {
  let walkTime = parseInt(settings.walkTime); // 使用 DEFAULT_TEAM
  // 向右走walkTime
  keyDown("D");
  await sleep(walkTime);
  keyUp("D");
  log.info("已向右走${settings.walkTime}");
})();