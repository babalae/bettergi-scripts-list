async function main() {
  log.info("开始执行....");
  genshin.returnMainUi();
  await sleep(2000);

  // F6打开千星奇域界面
  keyPress("F6");
  await sleep(4000);

  // 点击奇遇收藏
  click(125, 985);
  await sleep(2000);

  // 点击置顶第一个
  click(415, 811);
  await sleep(2000);

  // 点击前往大厅
  click(1600, 938);
  await sleep(15000);

  ////////////////////// 第一个置顶 /////////////////////////

  // 点击单人挑战 （右边是匹配挑战）
  click(1290, 940);
  // 加载
  await sleep(25000);
  // 清掉弹窗
  keyPress("VK_ESCAPE");
  // 等待25秒
  await sleep(25000);
  // 退出
  keyPress("VK_ESCAPE");
  await sleep(2000);
  // 中断挑战
  click(989,599);
  await sleep(10000);
  // 返回大厅
  click(1410, 1018);
  await sleep(10000);


  ///////////////////   第二个置顶  //////////////////////////
  // F6打开千星奇域界面
  keyPress("F6");
  await sleep(4000);

  // 点击奇遇收藏
  click(125, 985);
  await sleep(2000);

  // 点击置顶第二个
  click(809, 863);
  await sleep(2000);

  // 点击开始游戏
  click(1601, 938);
  await sleep(10000);
  // 点击开始挑战
  click(1700, 1021);
  await sleep(7000);
  // 点击×
  click(1412, 277);
  await sleep(2000);
  // 向前走3s
  keyDown("w");
  await sleep(2000);
  keyUp("w");
  // 普攻
  click(750,759);
  await sleep(30000);
  // 返回
  keyPress("VK_ESCAPE");
  await sleep(2000);
  // 中断挑战
  click(989,599);
  await sleep(10000);
  // 返回大厅
  click(1410, 1018);
  await sleep(10000);





  ///////////////////   第三个个置顶  //////////////////////////
  // F6打开千星奇域界面
  keyPress("F6");
  await sleep(4000);

  // 点击奇遇收藏
  click(125, 985);
  await sleep(2000);

    // 点击置顶第三个
  click(1160, 863);
  await sleep(2000);

  // 点击开始游戏
  click(1601, 938);
  await sleep(10000);
  // 点击开始挑战
  click(1700, 1021);
  await sleep(7000);
  // 向前走3.5s
  keyDown("w");
  await sleep(3500);
  keyUp("w");
  // 开始计时
  keyPress("F");
  await sleep(2000);
  // 普攻
  click(750,759);
  await sleep(50000);
  // 停止计时
  keyPress("F");
  await sleep(2000);
  // 返回
  keyPress("VK_ESCAPE");
  await sleep(2000);
  // 中断挑战
  click(989,599);
  await sleep(6000);
  // 返回大厅
  click(1410, 1018);
  await sleep(10000);





  ////////////////// 领奖励  ////////////////////////
  keyPress("F6");
  await sleep(4000);
  // 右移
  keyPress("E");
  await sleep(2000);
  keyPress("E");
  await sleep(2000);
  // 领皮肤奖励
  click(1606, 402);
  await sleep(4000);
  // 去弹窗
  click(1606, 402);
  await sleep(2000);
  // 右移
  keyPress("E");
  await sleep(2000);

  // 领第一项原石奖励
  click(1815, 728);
  await sleep(2000);
  click(1815, 728);
  await sleep(2000);
  // 领第二项原石奖励
  click(1815, 900);
  await sleep(2000);
  click(1815, 900);
  await sleep(2000);


  // 返回
  keyPress("VK_ESCAPE");
  await sleep(2000);
  // 返回提瓦特
  keyPress("F2");
  await sleep(2000);
  click(1690, 50);
  await sleep(3000);
  click(1200, 760);
  await sleep(15000);
};


// 异常保护
main().catch(err => {
    log.error("脚本崩溃：" + err);
});