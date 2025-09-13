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
  let captureRegion1 = captureGameRegion();
  let resList = captureRegion1.findMulti(ocrRoThis);
  captureRegion1.dispose();
  for (let i = 0; i < resList.count; i++) {
    let res = resList[i];
    if (res.text.includes(country)) {
      res.click();
    }
  }
  await sleep(1000);
  let captureRegion2 = captureGameRegion();
  let resList2 = captureRegion2.findMulti(ocrRoThis);
  captureRegion2.dispose();
  for (let i = 0; i < resList2.count; i++) {
    let res = resList2[i];
    if (res.text.includes("停止追踪")) {
      res.click();
      await sleep(1000);
    }
  }
  click(1500, 850);
  click(1500, 850); //点击追踪，连点两次防止点不到
  await sleep(1000);
  //获取地脉花位置
  const center = genshin.getPositionFromBigMap();
  leyLineX = center.x;
  leyLineY = center.y;
  log.info(`找到地脉花的坐标：(${leyLineX}, ${leyLineY})`);

  // 取消追踪
  click(960, 540);
  await sleep(1000);
  let captureRegion3 = captureGameRegion();
  let zhuizong = captureRegion3.findMulti(ocrRoThis);
  captureRegion3.dispose();
  if (zhuizong && zhuizong.count > 0) {
    for (let i = 0; i < zhuizong.count; i++) {
      if (zhuizong[i].text.includes("停止追踪")) {
        zhuizong[i].click();
        log.debug("点击取消追踪");
        await sleep(1000);
        return;
      } else if (zhuizong[i].text.includes("地脉") || zhuizong[i].text.includes("衍出")) {
        zhuizong[i].click();
        await sleep(1000);
        click(1700, 1010);
        log.debug("点击取消追踪");
        await sleep(1000);
      }
    }
  }
  return center;
}