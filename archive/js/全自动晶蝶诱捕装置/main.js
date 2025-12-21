(async function () {

  //设置脚本环境的游戏分辨率和DPI缩放
  setGameMetrics(1920, 1080, 1.5);

  await genshin.tp(8973.50,-1878.81);
  await sleep(6000);
  // 执行主操作
  keyPress("F");
  await sleep(500);
  click(1500, 400);
  await sleep(3000);
  keyPress("B");
  await sleep(1000);
  click(1054, 46);
  await sleep(500);
  click(1200, 200);
  await sleep(500);
  click(1684, 1012);
  await sleep(500);
  keyPress("F");
  await sleep(1000);

  let maTerial = settings.material || '';
  if (maTerial === '铁块') {
    log.info('开始加入铁块');
    click(180, 190);//铁块
  } else if (maTerial === '白铁块') {
    log.info('开始加入白铁块');
    click(330, 190);//白铁块
  } else if (maTerial === '水晶块') {
    log.info('开始加入水晶块');
    click(470, 190);//水晶块
  } else if (maTerial === '魔晶块') {
    log.info('开始加入魔晶块');
    click(610, 190);//魔晶块
  } else if (maTerial === '星银矿石') {
    log.info('开始加入星银矿石');
    click(770, 190);//星银矿石
  } else if (maTerial === '紫晶块') {
    log.info('开始加入紫晶块');
    click(910, 190);//紫晶块
  } else if (maTerial === '萃凝晶') {
    log.info('开始加入萃凝晶');
    click(1050, 190);//萃凝晶
  } else {
    log.info('未选择材料，执行默认材料（铁块）');
    click(180, 190);//铁块
  }

  await sleep(500);
  click(447, 1018);
  await sleep(500);
  click(1725, 1021);
  await sleep(500);
  click(1178, 752);
  await sleep(500);
})();