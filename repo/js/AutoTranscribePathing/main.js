// 定义识别对象
const paimonMenuRo = RecognitionObject.TemplateMatch(
  file.ReadImageMatSync("assets/RecognitionObject/paimon_menu.png"),
  0,
  0,
  640,
  216
);

// 判断是否在主界面的函数
const isInMainUI = () => {
  let captureRegion = captureGameRegion();
  let res = captureRegion.Find(paimonMenuRo);
  captureRegion.dispose();
  return !res.isEmpty();
};


// 获取设置
/*const settings = {
  questName: "默认委托",
  questLocation: "默认地点",
  trackNumber: "1"
  //runMode: "录制模式",
};*/
const questName = settings.questName
const questLocation = settings.questLocation
const trackNumber = settings.trackNumber
const runMode = settings.runMode


// 初始化追踪数据
let trackData = {
  "info": {
    "name": `${settings.questName}-${settings.trackNumber}`,
    "type": "collect",
    "author": settings.author,
    "version": settings.version,
    "description": settings.description,
    "map_name": "Teyvat",
    "bgi_version": "0.45.0"
  },
  "positions": []
};

// 检查是否需要创建新文件夹
function checkOrCreateFolder() {
  const folderName = `assets/${settings.questLocation}-${settings.questName}`;
  /*if (!file.existsSync(folderName)) {
    file.writeTextSync(folderName, { recursive: true });
    log.info(`创建文件夹: ${folderName}`);
  }*/
}

// 保存追踪数据
async function saveTrackData() {
  const filePath = `assets/${settings.questLocation}-${settings.questName}/${settings.questName}-${settings.trackNumber}.json`;
  //const fileName = `${settings.questName}-${settings.trackNumber}.json`;

  try {
    await file.writeTextSync(filePath, JSON.stringify(trackData, null, 2));
    log.info(`追踪数据已保存到: ${filePath}`);
  } catch (error) {
    log.error(`保存追踪数据失败: ${error}`);
  }
}

// 获取当前位置并添加到追踪数据
async function recordPosition() {
  if (isInMainUI()) {
    try {
      const position = genshin.getPositionFromMap();
      log.info(`从小地图获取坐标: X=${position.X}, Y=${position.Y}`);
      trackData.positions.push({
        "id": trackData.positions.length + 1,
        "x": position.X,
        "y": position.Y,
        "action": "",
        "move_mode": "dash",
        "action_params": "",
        "type": "path"
      });
    }
    catch (error) {
      log.error(`获取坐标失败: ${error.message}`);
      await sleep(500);
      return await recordPosition();;
    }
  } else {
    try {
      await genshin.setBigMapZoomLevel(1.0);
      const position = genshin.getPositionFromBigMap();
      log.info(`从大地图获取坐标: X=${position.X}, Y=${position.Y}`);
      trackData.positions.push({
        "id": trackData.positions.length + 1,
        "x": position.X,
        "y": position.Y,
        "action": "",
        "move_mode": "walk",
        "action_params": "",
        "type": "target"
      });
      log.info("已在大地图界面，已生成地图追踪，脚本结束");
      await saveTrackData();
      return false;
    }
    catch (error) {
      log.error(`获取坐标失败: ${error.message}`);
      await sleep(500);
      return await recordPosition();;
    }
  }
  return true;
}

// 主逻辑
async function main() {
  log.info("委托地图追踪录制开始");

  checkOrCreateFolder();

  if (settings.runMode === "运行模式") {
    const filePath = `assets/${settings.questLocation}-${settings.questName}/${settings.questName}-${settings.trackNumber}.json`;
    log.info(`正在运行地图追踪任务文件: ${filePath}`);
    await pathingScript.runFile(filePath);
    return;
  }

  let continueRecording = true;
  let recordCount = 0;
  if (isInMainUI()) {
    const position = genshin.getPositionFromMap();
    log.info(`从小地图获取坐标: X=${position.X}, Y=${position.Y}`);

    trackData.positions.push({
      "id": trackData.positions.length + 1,
      "x": position.X,
      "y": position.Y,
      "action": "",
      "move_mode": "walk",
      "action_params": "",
      "type": "teleport"
    });
  } else {
    log.info("不在主界面，请返回主界面后重新启动脚本");
    return;
  }
  await sleep(3000);
  while (continueRecording && recordCount < 999) { // 限制最大录制次数，避免无限循环
    continueRecording = await recordPosition();
    if (continueRecording) {
      recordCount++;
      await sleep(3000); // 每3秒录制一次
    }
  }

  log.info("委托地图追踪录制结束");
}

main();