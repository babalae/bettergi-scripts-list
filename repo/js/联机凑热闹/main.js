
// 判断是否加入房间
let isFindRoom = false;
// 滚动条顶部坐标
const scrollTopPosition = Object.freeze({x: 2410,y: 270});
// 滚动条底部坐标
const scrollBottomPosition = Object.freeze({x: 2410,y: 1198});

const onlineRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/online.png"), 0, 0, genshin.width / 3.0, genshin.width / 5.0);
const uiRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/ui.png"), 0, 0, genshin.width / 3.0, genshin.width / 5.0);

// 滚动联机列表并点击，最多点击8次到底部
const scrollPageClick = async (count) => {
  if (count === null || count < 1){
    count = 1;
  }
  if (count > 8){
    count = 8;
  }
  //起始坐标
  let startPosion;
  if(settings.join_type === '往下翻'){
    startPosion = JSON.parse(JSON.stringify(scrollTopPosition));
    startPosion.y = startPosion.y + (count * 112);
  }else{
    startPosion = JSON.parse(JSON.stringify(scrollBottomPosition));
    startPosion.y = startPosion.y - (count * 112);
  }
  moveMouseTo(startPosion.x, startPosion.y)
  leftButtonClick()
}

const scrollBottomClick = async () => {
  moveMouseTo(scrollBottomPosition.x, scrollBottomPosition.y)
  leftButtonDown()
  await sleep(500)
  leftButtonUp()
}

const findRoom = async () => {
  // 获取一张截图
  let captureRegion = captureGameRegion();
  // 对整个区域进行 OCR
  let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
  for (let i = 0; i < resList.count; i++) { // 遍历的是 C# 的 List 对象，所以要用 count，而不是 length
    let res = resList[i];
    if (res.text === settings.player_num){
        log.info("已到找到{player_num}房间，准备加入", settings.player_num);
        let x = Math.floor(res.x * genshin.scaleTo1080PRatio);
        let y = Math.floor((res.y + 60) * genshin.scaleTo1080PRatio);
        click(x, y)
        log.info("等待15s");
        await sleep(15000);

        isFindRoom = await isJoinRoom(5000)
        return true;
    }
  }
  return false;
}


const isJoinRoom = async (delay) => {
  //按delay判断一次是否处于联机状态
  for (let i = 0; i < 5; i++) {
    // 最多 ESC 5次
    let captureRegion = captureGameRegion();  // 获取一张截图
    let result = captureRegion.Find(onlineRo);
    if (result.isExist()) {
      return true;
    }
    result = captureRegion.Find(uiRo);
    if (result.isExist()) {
      return false;
    } 
    await sleep(delay);
  }
  return false;
}

const isLevelLimit = async () => {
  // 获取一张截图
  let captureRegion = captureGameRegion();
  // 对整个区域进行 OCR
  let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
  for (let i = 0; i < resList.count; i++) { // 遍历的是 C# 的 List 对象，所以要用 count，而不是 length
    let res = resList[i];
    if (res.text.indexOf("级可加入") !== -1){
        return true;
    }
  }
  return false;

}


(async function () {
    
    setGameMetrics(2560, 1440, 1);
    log.info("当前配置为：");
    log.info("方向设置：{join_type}",settings.join_type);
    log.info("联机人数设置：{player_num}",settings.player_num);
    log.info("总尝试次数：{repeat_num}",settings.repeat_num);
    let current_num = 1;
    await genshin.returnMainUi()
    while (!isFindRoom && (settings.repeat_num === "0" ||current_num <= settings.repeat_num)){
        if(await isJoinRoom(100)){
          log.info("已处于联机状态，脚本结束");
          break;
        }
        log.info("开始搜索房间，当前搜索次数{n}",current_num);
        keyPress("F2")
        await sleep(1000)
        if (settings.join_type === '往上翻'){
          await scrollBottomClick()
        }
        await findRoom()
        for(let i=1; i<=8; i++){
          
          if (isFindRoom){
            log.info("加入成功，已结束程序");
            break;
          }
          await sleep(100)
          await scrollPageClick(i)
          await findRoom()
          if (await isLevelLimit()){
            log.info("发现等级限制，提前终止寻找");
            break;
          }
        }
        await genshin.returnMainUi()
        log.info("未找到房间，关掉联机重新寻找");
        current_num = current_num + 1;
    }
    
    

})();