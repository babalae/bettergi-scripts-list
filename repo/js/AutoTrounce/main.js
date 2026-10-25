const movies = {
  "北风的狼王": true,
  "深入风龙废墟": false,
  "进入「黄金屋」": true,
  "「伏龙树」之底": false,
  "鸣神岛·天守": true,
  "梦想乐土之殁": false,
  "净琉璃工坊": true,
  "肇始之乡": true,
  "异界余影": false,
  "零落丘墟": true,
  "碑碣的记录": false,
  "待解「弈局」": true,
  "赝月的研究所": false,
  "万有涅槃缚境": true,
};

async function startCombat(round, token) {
  switch (settings.trounce) {
    case "北风的狼王":
      if (round === 1) {
        await sleep(9500);
        keyDown("W");
        await sleep(5000);
        keyUp("W");
        keyDown("A");
        await sleep(100);
        rightButtonClick();
        await sleep(800);
        rightButtonClick();
        keyUp("A");
      } else if (round === 2) {
        middleButtonClick();
        const boss = { x: -263, y: 1995 };
        (async () => {
          let distance = Infinity;
          while (distance >= 2 && !token.IsCancellationRequested) {
            try {
              const position = await genshin.getPositionFromMap("Teyvat");
              distance = Math.hypot(boss.x - position.x, boss.y - position.y);
              const rotate = (Math.atan2(boss.y - position.y, boss.x-position.x)*180 / Math.PI + 360) % 360;
              moveMouseBy(Math.round(10 * (((rotate - genshin.getCameraOrientation() + 540) % 360) - 180)), 0);
              await sleep(500);
              keyDown("W");
              await sleep(500);
              keyUp("W");
            } catch (e) {
              log.info(`${e}`);
              await sleep(2000);
            }
          }
          log.info("已抵达场地中心");
        })();
      }
      break;
    case "深入风龙废墟":
      if (round === 1) {
        keyDown("W");
        await sleep(2000);
        keyUp("W");
        await sleep(10000);
      } else {
        keyDown("D");
        await sleep(1000);
        keyUp("D");
        keyDown("W");
        for (let i = 0; i < 4; i++) {
          await sleep(800);
          keyPress("SPACE");
        }
        await sleep(200);
        keyUp("W");
      }
      break;
    case "进入「黄金屋」":
      if (round === 1) {
        keyDown("W");
        await sleep(800);
        rightButtonClick();
        await sleep(800);
        keyUp("W");
      } else {
        keyDown("W");
        await sleep(1500);
        keyUp("W");
      }
      break;
    case "「伏龙树」之底": 
        keyDown("W");
        await sleep(15000);
        keyUp("W");
      break;
    case "鸣神岛·天守":
      if (round === 1) {
        keyDown("W");
        await sleep(9000);
        rightButtonClick();
        await sleep(100);
        keyUp("W");
      } else {
        await sleep(8000);
        keyDown("W");
        await sleep(500);
        rightButtonClick();
        await sleep(800);
        rightButtonClick();
        await sleep(100);
        keyUp("W");
      }
      break;
    case "梦想乐土之殁":
      keyDown("W");
      await sleep(500);
      rightButtonClick();
      keyUp("W");
      break;
    case "净琉璃工坊":
    if (round === 1) {
        keyDown("W");
        await sleep(20000);
        keyUp("W");
      } else if (round === 2) {
        await sleep(3000);
        keyDown("W");
        for (let i = 0; i < 5; i++) {
          await sleep(900);
          rightButtonClick();
        }
        keyUp("W");
      }
      break;
    case "肇始之乡":
      if (round === 1) {
        keyDown("W");
        await sleep(16000);
        keyUp("W");
      } else if (round === 2) {
        (async () => {
          while (round === 2 && !token.IsCancellationRequested) {
            keyDown("W");
            moveMouseBy(500, 0);
            await sleep(5000);
            keyUp("W");
            await sleep(1000);
          }
        })();
      }
      break;
    case "异界余影":
      break;
    case "零落丘墟":
      if (round === 1) {
        keyDown("W");
        await sleep(12000);
        keyUp("W");
        keyDown("D");
        await sleep(1000);
        keyUp("D");
      } else {
        await sleep(10000);
        rightButtonClick();
        await sleep(1000);
        rightButtonClick();
      }
      break;
    case "碑碣的记录":
      keyDown("W");
      for (let i = 0; i < 5; i++) {
        await sleep(900);
        rightButtonClick();
      }
      keyUp("W");
      break;
    case "待解「弈局」":
      if (round === 1) {
        keyDown("W");
        for (let i = 0; i < 4; i++) {
          await sleep(900);
          rightButtonClick();
        }
        keyUp("W");
      } else if (round === 2) {
        await sleep(15000);
        keyDown("W");
        await sleep(300);
        rightButtonClick();
        keyUp("W");
      }
      break;
    case "赝月的研究所":
      keyDown("W");
      await sleep(2000);
      keyUp("W");
      keyDown("S");
      await sleep(3500);
      keyUp("S");
      keyDown("D");
      await sleep(4600);
      keyUp("D");
      await sleep(5000);
      keyDown("W");
      await sleep(800);
      rightButtonClick();
      await sleep(800);
      rightButtonClick();
      await sleep(800);
      keyUp("W");
      (async () => {
        while (!token.IsCancellationRequested) {
          keyPress("S");
          await sleep(2000);
        }
      })();
      break;
    case "万有涅槃缚境":
      if (round === 1) {
        keyDown("W");
        await sleep(800);
        rightButtonClick();
        await sleep(800);
        rightButtonClick();
        await sleep(800);
        keyUp("W");
      } else {
        await sleep(8000);
        keyDown("W");
        await sleep(1500);
        keyUp("W");
        await sleep(300);
        rightButtonClick();
        await sleep(800);
        rightButtonClick();
        await sleep(900);
        keyDown("D");
        keyDown("W");
        rightButtonClick();
        await sleep(3000);
        keyUp("W");
        await sleep(1000);
        for (let i = 0; i < 4; i++) {
          rightButtonClick();
          await sleep(800);
        }
        for (let i = 0; i < 5; i++) {
          leftButtonClick();
          await sleep(400);
        }
        for (let i = 0; i < 4; i++) {
          rightButtonClick();
          await sleep(800);
        }
        rightButtonClick();
        keyUp("D");
        (async () => {
        try {
          await sleep(2000);
          for (let i = 0; i < 20; i++) {
            leftButtonClick();
            await sleep(400);
          }
          await sleep(16000);
          keyDown("D");
          await sleep(3000);
          keyUp("D");
        } catch (e) {
          log.error(`${e}`);
        }
        })();
      }
      break;
    default:
      break;
  }
}

async function runTrounceFlow() {
  let cts;
  let linkedCts;
  let page;
  let alive = true;
  const ctsToken = dispatcher.getLinkedCancellationToken();
	try {
	  const domainRect = new OpenCvSharp.OpenCvSharp.Rect(230, 408, 120, 70);
    const trounceRect = new OpenCvSharp.OpenCvSharp.Rect(432, 615, 270, 75);
	  const targetRect = new OpenCvSharp.OpenCvSharp.Rect(710, 700, 500, 225);
    const tabRect = new OpenCvSharp.OpenCvSharp.Rect(1090, 500, 430, 75);
    const levelRect = new OpenCvSharp.OpenCvSharp.Rect(40, 475, 850, 320);
    const startRect = new OpenCvSharp.OpenCvSharp.Rect(1580, 995, 250, 50);
    const enterRect = new OpenCvSharp.OpenCvSharp.Rect(88, 1026, 65, 25);
    const exitRect = new OpenCvSharp.OpenCvSharp.Rect(800, 940, 320, 40);
    const revivalRect = new OpenCvSharp.OpenCvSharp.Rect(800, 225, 320, 55);
    page = new BvPage(ctsToken);
    //1.前往征讨领域
    await genshin.tpToStatueOfTheSeven();
    await genshin.switchParty(settings.partyName);
    if (settings.trounce !== "北风的狼王") {
      const icon = page.Locator(
        RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${settings.trounce}.png`))
      );
      await page.flow()
        .withDefaultTimeout(20000)
        .keyPress("F1")
        .untilText("秘境", domainRect)
        .click()
        .untilAnyText(["征", "讨", "领", "域"], trounceRect)
        .click()
        .moveTo(750,390)
        .do(async () => {
            Array.from({ length: 8 }).forEach(() => verticalScroll(-100));
        })
        .until(icon)
        .click()
        .waitUntilText("挑战奖励", targetRect)
        .moveTo()
        .wait(1000)
        .click()
        .wait(2000)
        .keyPress("F")
        .do(async () => {
          await genshin.returnMainUi()
        })
        .do(async () => {
          keyDown("W");
          await sleep(500);
          keyUp("W");
        })
        .untilAnyText([...settings.trounce], tabRect)
        .keyPress("F")
        .waitUntilText("9", levelRect)
        .click()
        .wait(1000)
        .keyPress("F")
        .wait(1000)
        .click(1300, 755)
        .untilText("开始挑战", startRect)
        .keyPress("F")
        .click(960, 800)
        .withTimeout(60000)
        .untilText("Enter", enterRect)
        .run()
    } else {
      const start = page.getByText("开启试炼", tabRect);
      await pathingScript.runFile("assets/北风的狼王.json");
      await page.flow()
      .do(async () => {
        if (start.isExist()) return;
        moveMouseBy(1536, 0);
        keyDown("W");
        await sleep(500);
        keyUp("W");
      })
      .until(start)
      .keyPress("F")
      .run();
    }
      

    const dvalinRo = RecognitionObject.TemplateMatch(
      file.ReadImageMatSync("assets/dvalin.png"), 1100, 70, 400, 300
    );
    dvalinRo.threshold = 0.6;
    const dvalinLocator = page.Locator(dvalinRo);
    //2.战斗循环+后台检测
    let round = 1;
    const maxRounds = 10;
    const movie = movies[settings.trounce];
    while (round <= maxRounds) {
      if (ctsToken.IsCancellationRequested) {
        return true;   // 手动停止
      }
      cts = new CancellationTokenSource();
      linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        ctsToken,
        cts.Token
      );
      const autoFightToken = linkedCts.Token;
      
      await startCombat(round, autoFightToken);
      
      const combatPage = new BvPage(autoFightToken);
      const exit = combatPage.getByText("自动退出", exitRect);
      const enter = combatPage.getByText("Enter", enterRect);
      const revival = combatPage.getByText("使用道具复苏角色", revivalRect);
      const skipTask = (async () => {
        let missingCount = 0;
        const MISSING_THRESHOLD = 7;
        while (!autoFightToken.IsCancellationRequested) {
          await sleep(500);
          if (exit.isExist()) {
            cts.Cancel();
            log.info(`战斗结束：${settings.trounce}`);
            return false;   //讨伐成功
          }
          if (movie) {
            if (!enter.isExist()) {
              missingCount++;
              if (missingCount >= MISSING_THRESHOLD) {
                cts.Cancel();
                log.info("进入过场动画");
                return true;   //进入下一轮战斗
              }
            } else {
              missingCount = 0;
            }
          }
          if (revival.isExist()){
            alive = false;
            log.warn("角色已倒下，即将取消本次征讨");
            return false;   //讨伐失败，等待自动战斗流程返回神像
          }
          if (settings.trounce === "深入风龙废墟" && dvalinLocator.isExist()) {
            cts.Cancel();
            log.info("特瓦林可能进入瘫痪状态");
            return true;   //进入下一轮战斗
          }
        }
      })();
      
      const param = new AutoFightParam(settings.strategyName);
      if (settings.trounce !== "北风的狼王") {
        param.FightFinishDetectEnabled = false;
      }
      param.PickDropsAfterFightEnabled = false;
      param.Timeout = parseInt(settings.time, 10) || 180;   //单场战斗超时时间

      try {
        await dispatcher.runAutoFightTask(param, autoFightToken);
      } catch (e) {
        const msg = String(e?.message ?? e);
        if (/取消|cancel/i.test(msg)) {
          log.info(`自动战斗已取消：${msg}`);
        } else {
          log.error(`${msg}`);
          return false;
        }
      } finally {
        cts.Cancel();
      }
      
      const skip = await skipTask;
      
      cts.dispose();
      linkedCts.dispose();
      cts = null;
      linkedCts = null;
      //3.下一轮战斗或领奖退出
      if (skip) {
        try {
          await page.flow()
            .click(1800, 50)
            .untilText("Enter", enterRect)
            .run();
        } catch (e) {
          log.error(`${e}`);
          return false;
        }
        round += 1;
        log.info(`进入第 ${round}轮战斗`);
        continue;
      } else {
        if (!alive) {
          return false;
        }
        log.info("战斗流程结束");
        
        const boxIcon = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));
        const reward = page.getByText("征讨之花", tabRect);
        const MAX_ATTEMPTS = 300;
        let attempts = 0;
        
        middleButtonClick();
        await sleep(1000);
        while (attempts++ < MAX_ATTEMPTS) {
          if (reward.isExist()) {
            log.info("抵达征讨之花附近");

            try {
              await page.flow()
              .keyPress("F")
              .waitUntilText("使用原粹树脂")
              .click()
              .waitUntilAnyText(["退出秘境", "空白区域"])
              .click()
              .do(async () => {
                log.info(`${settings.trounce}讨伐成功，已领取奖励`);
                await genshin.returnMainUi()
              })
              .run();
            } catch (e) {
              log.warn(`讨伐成功，但奖励未领取：${e}`);
            }

            return true;
          }
          const image = captureGameRegion();
          const box = image.find(boxIcon);
          try {
            if (!box.isEmpty()) {
              if (box.x >= 820 && box.x <= 1100 && box.y <= 750) {
                keyDown("W");
                await sleep(500);
                keyUp("W");
              } else {
                let x = box.x < 910 ? -20 : 20;
                moveMouseBy(x, 0);
                await sleep(100);
              }
            } else {
              log.info("开始寻找征讨之花");
              let x = 1;
              await page.flow()
                .withDefaultTimeout(30000)
                .withDefaultRetryInterval(100)
                .do(async () => {
                  keyDown("W");
                  await sleep(500);
                  keyUp("W");
                  if (x % 10 === 0) {
                    moveMouseBy(1536, 0);
                  }
                  x++;
                })  //以既定的五角星路线寻找
                .until(reward)
                .run();
            }
          } catch (e) {
            log.warn(`讨伐成功，但奖励未领取：寻找征讨之花超时 ${e}`);
            return false;
          } finally {
            image.dispose();
          }
        }
        log.warn("讨伐成功，但奖励未领取：征讨之花定位超时");
        return true;
      }
    }
    return false;
	} catch (e) {
    if (ctsToken.IsCancellationRequested) {
      log.info("已停止当前任务");
      return true;
    }
    log.error(`${e}`);
    return false;
  } finally {
    cts?.dispose();
    linkedCts?.dispose();
  }
}

(async function () {
  const MAX_RETRIES = parseInt(settings.maxRetries, 10) || 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      log.info(`第 ${attempt} 次尝试讨伐`);
      const success = await runTrounceFlow();
      if (success) {
        break;
      }
      log.warn(`第 ${attempt} 次讨伐失败`);
    }
    await genshin.tpToStatueOfTheSeven();
})();