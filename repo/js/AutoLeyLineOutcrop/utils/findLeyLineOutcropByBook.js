/**
 * 通过冒险之证查找地脉花位置 - 【测试中】
 * @param {string} country - 国家名称
 * @param {string} type - 地脉花类型
 * @returns {Promise<void>}
 */
this.findLeyLineOutcropByBook = async function (country, type) {
  await genshin.returnMainUi();
  await sleep(1000);
  log.info("使用冒险之证寻找地脉花");
  //确保运行时位于主界面
  keyPress("F1");
  await sleep(1000);
  click(300, 550); //点击讨伐
  await sleep(1000);
  click(500, 200); //点击筛选
  await sleep(1000);
  click(500, 500); //点击其他
  await sleep(1000);
  if (type === "蓝花（经验书）") {
    click(700, 350); //点击经验花
  } else {
    click(500, 350); //点击摩拉花
  }
  await sleep(1000);
  click(1300, 800); //点击推荐
  await sleep(1000);
  let captureRegion = captureGameRegion();
  let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
  for (let i = 0; i < resList.count; i++) {
    let res = resList[i];
    if (res.text.includes(country)) {
      res.click();
    }
  }
  await sleep(1000);
  click(1500, 850);
  click(1500, 850); //点击追踪，连点两次防止点不到
  await sleep(1000);
  //获取地脉花位置
  const center = genshin.getPositionFromBigMap();
  leyLineX = center.x;
  leyLineY = center.y;
  log.info(`找到地脉花的坐标：(${center.x}, ${center.y})`);
  return center;
}