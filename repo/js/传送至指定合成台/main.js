async function AutoPath(locationName) {
  try {
  let filePath = `assets/${locationName}.json`;
      await pathingScript.runFile(filePath);
      return true;
  } catch (error) {
      log.error(`执行 ${locationName} 路径时发生错误`);
      log.error(error.message);
  }
  
  return false;
}
(
  async function () {
    try {
      await genshin.returnMainUi();
      setGameMetrics(1920, 1080, 1)
      // 读取配置文件
      let location = settings.location;
      await AutoPath(location);
    } catch (e) {
      log.error("传送失败，请检查设置");
      return;
      }
  }
)();
