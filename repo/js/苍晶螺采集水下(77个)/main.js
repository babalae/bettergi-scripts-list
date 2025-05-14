(async function () {
  if (!settings.enable) {
    log.error(`请打开「JS脚本自定义配置」，然后阅读并勾选第一个复选框。`);
    return
  }

  // 切换跑图队伍
  if (settings.team) {
    log.info(`切换至队伍 ${settings.team},请确保双风少女体型！`);
    try {
        log.info("正在尝试切换至" + settings.team);
        if(!await genshin.switchParty(settings.team)){
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(settings.team);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
  }

  log.info('安眠处地面1，3个。');
  if (settings.selectAll || settings.annapausis1) {
    try {
      await genshin.tp(5035.94, 3672.92);//安眠处1
      await sleep(1000);
      await keyMouseScript.runFile(`assets/安眠处地面1-3.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('安眠处地面3，6个。');
  if (settings.selectAll || settings.annapausis3) {
    try {
      await genshin.tp(4939.90, 3564.62);//安眠处2
      await sleep(1000);
      await keyMouseScript.runFile(`assets/安眠处地面3-6.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('安眠处地面4，8个。');
  if (settings.selectAll || settings.annapausis4) {
    try {
      await genshin.tp(4939.90, 3564.62);//安眠处2
      await sleep(1000);
      await keyMouseScript.runFile(`assets/安眠处地面4-8.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('安眠处地面5，6个。');
  if (settings.selectAll || settings.annapausis5) {
    try {
      await genshin.tp(4939.90, 3564.62);//安眠处2
      await sleep(1000);
      await keyMouseScript.runFile(`assets/安眠处地面5-6.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('白松镇1，3个。');
  if (settings.selectAll || settings.poisson1) {
    try {
      //3
      await genshin.tp(4259.14, 2704.10, true);//白松镇1
      await sleep(1000);
      await keyMouseScript.runFile(`assets/白松镇1-3.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('自然哲学学院1，9个。');
  if (settings.selectAll || settings.instituteOfNaturalPhilosophy1) {
    try {
      //9
      await genshin.tp(4234.85, 3121.65);//自然哲学学院1，有概率失败
      await sleep(1000);
      await keyMouseScript.runFile(`assets/自然哲学学院1.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('自然哲学学院2，4个。');
  if (settings.selectAll || settings.instituteOfNaturalPhilosophy2) {
    try {
      //4
      await genshin.tp(4175.23, 3280.54);//自然哲学学院2
      await sleep(1000);
      await keyMouseScript.runFile(`assets/自然哲学学院2.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('自塔拉塔海谷1，4个。');
  if (settings.selectAll || settings.thalattaSubmarineCanyon1) {
    try {
      //4
      await genshin.tp(4191.45, 3802.76);//塔拉塔海沟
      await sleep(1000);
      await keyMouseScript.runFile(`assets/塔拉塔海谷1.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('塞洛海原1，4个。');
  if (settings.selectAll || settings.salaciaPlain1) {
    try {
      //4
      await genshin.tp(4012.88, 3434.90);//塞洛海原1
      await sleep(1000);
      await keyMouseScript.runFile(`assets/塞洛海原1.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('塞洛海原2，5个。');
  if (settings.selectAll || settings.salaciaPlain2) {
    try {
      //5
      await genshin.tp(3965.72, 3235.31);//塞洛海原2
      await sleep(1000);
      await keyMouseScript.runFile(`assets/塞洛海原2.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('塞洛海原3，3个。');
  if (settings.selectAll || settings.salaciaPlain3) {
    try {
      //3
      await genshin.tp(4396.86, 3092.05);//塞洛海原3
      await sleep(1000);
      await keyMouseScript.runFile(`assets/塞洛海原3.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('塞洛海原4，5个。');
  if (settings.selectAll || settings.salaciaPlain4) {
    try {
      //5
      await genshin.tp(4396.86, 3092.05);//塞洛海原3
      await sleep(1000);
      await keyMouseScript.runFile(`assets/塞洛海原4.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('苍晶区1，5个。');
  if (settings.selectAll || settings.eltonTrench1) {
    try {
      //5
      await genshin.tp(4487.10, 2801.05);//苍晶区1
      await sleep(1000);
      await keyMouseScript.runFile(`assets/苍晶区1.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('枫丹廷区1，8个。');
  if (settings.selectAll || settings.courtOfFontaine1) {
    try {
      //8
      await genshin.tp(4775.41, 3145.85);//枫丹廷区1
      await sleep(1000);
      await keyMouseScript.runFile(`assets/枫丹廷区1.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('枫丹廷区2，2个。');
  if (settings.selectAll || settings.courtOfFontaine2) {
    try {
      //2
      await genshin.tp(4775.41, 3145.85);//枫丹廷区1
      await sleep(1000);
      await keyMouseScript.runFile(`assets/枫丹廷区2.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

  log.info('枫丹廷区3，3个。');
  if (settings.selectAll || settings.courtOfFontaine3) {
    try {
      //3
      await genshin.tp(4775.41, 3145.85);//枫丹廷区1
      await sleep(1000);
      await keyMouseScript.runFile(`assets/枫丹廷区3.json`);
    } catch (error) {
      log.warn(error.message);
      log.warn('传送错误，跳过。');
    }
  } else {
    log.info('跳过。');
  }

})();
