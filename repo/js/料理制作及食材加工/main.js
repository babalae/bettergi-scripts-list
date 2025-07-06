(async function () {

  let foodName = settings.foodName ?? 0;
  let foodNum = settings.foodNum ?? 1;
  let flourNum = settings.flourNum ?? 0;
  let creamNum = settings.creamNum ?? 0;
  let smokedPoultryNum = settings.smokedPoultryNum ?? 0;
  let butterNum = settings.butterNum ?? 0;
  let hamNum = settings.hamNum ?? 0;
  let sugarNum = settings.sugarNum ?? 0;
  let spiceNum = settings.spiceNum ?? 0;
  let crabRoeNum = settings.crabRoeNum ?? 0;
  let jamNum = settings.jamNum ?? 0;
  let cheeseNum = settings.cheeseNum ?? 0;
  let baconNum = settings.baconNum ?? 0;
  let sausageNum = settings.sausageNum ?? 0;

  await sleep(1000);
  await pathingScript.runFile("assets/璃月杂货商东升旁灶台.json");


  /**
      F交互区
  **/
  // 定义一个函数用于模拟按键操作
  async function simulateKeyOperations(key, duration) {
    keyDown(key);
    await sleep(duration);
    keyUp(key);
    await sleep(500); // 释放按键后等待 500 毫秒
  }

  // 识别 F 图标
  async function recognizeFIcon() {
    const fDialogueRo = RecognitionObject.TemplateMatch(
      file.ReadImageMatSync("assets/F_Dialogue.png"),
      1101,
      400,
      36,
      400
    );

    let ra = captureGameRegion();
    let fRes = ra.find(fDialogueRo);

    if (!fRes.isExist()) {
      let f_attempts = 0; // 初始化尝试次数
      while (f_attempts < 3) { // 最多尝试 3 次
        f_attempts++;
        log.info(`当前尝试次数：${f_attempts}`);

        if (f_attempts === 1 || f_attempts === 2) {
          // 第一次未找到 F 图标
          await simulateKeyOperations("S", 200); // 后退 200 毫秒
          log.info("执行后退操作");
          await sleep(200);
          await simulateKeyOperations("W", 600); // 前进 600 毫秒
          log.info("执行前进操作");
        } else if (f_attempts === 3) {
          // 第二次未找到 F 图标
          log.info("重新加载路径文件");
          const filePath = `assets/璃月杂货商东升旁灶台.json`;
          log.info(`加载路径文件：${filePath}`);
          await pathingScript.runFile(filePath);
          await sleep(500);
        }

        // 重新获取游戏区域截图
        ra = captureGameRegion();
        fRes = ra.find(fDialogueRo);

        // 打印识别结果
        log.info(`识别结果：${fRes.isExist()}`);

        // 如果识别成功，立即退出循环
        if (fRes.isExist()) {
          log.info("识别成功，退出循环");
          break;
        }

        await sleep(500);
      }
    }

    // 如果尝试次数已达上限，返回 null
    if (!fRes.isExist()) {
      log.error("尝试次数已达上限");
      return null;
    }

    return fRes;
  }

  // 识别 Cooking 图标
  async function recognizeCookingIcon(centerYF) {
    const cookingRo = RecognitionObject.TemplateMatch(
      file.ReadImageMatSync("assets/Cooking.png"),
      1176,
      centerYF - 18, // 以 F 图标的中心，向上偏移 18 像素
      27,           // 宽度范围
      36            // 高度范围
    );

    let ra = captureGameRegion();
    let cookingRes = ra.find(cookingRo);

    if (cookingRes.isExist()) {
      log.info("找到 灶台 图标");
      return cookingRes;
    } else {
      log.info("未找到 灶台 图标");
      return null;
    }
  }

  // 主逻辑函数
  async function main() {
    // 识别 F 图标
    let fRes = await recognizeFIcon();
    if (!fRes) {
      log.error("未能识别 F 图标，退出任务");
      return;
    }

    // 获取 F 图标的中心点 Y 坐标
    let centerYF = Math.round(fRes.y + fRes.height / 2);

    const maxScrollAttempts = 5; // 最大滚轮操作次数限制
    let scrollAttempts = 0;

    while (scrollAttempts < maxScrollAttempts) {
      // 识别 灶台 图标
      let cookingRes = await recognizeCookingIcon(centerYF);
      if (cookingRes) {
        // log.info("找到 灶台 图标");
        return cookingRes; // 识别成功，返回结果
      }

      // 如果未找到 Cooking 图标，执行滚轮操作
      log.info(`未找到 Cooking 图标，执行滚轮操作，当前尝试次数：${scrollAttempts + 1}`);
      await keyMouseScript.runFile(`assets/滚轮下翻.json`);
      await sleep(1000);

      // 重新识别 F 图标，获取最新的中心点
      fRes = await recognizeFIcon();
      if (!fRes) {
        log.error("滚轮操作后，未能重新识别 F 图标，退出任务");
        return;
      }

      centerYF = Math.round(fRes.y + fRes.height / 2); // 更新 F 图标的中心点 Y 坐标

      // 增加尝试次数
      scrollAttempts++;
    }

    // 如果超过最大滚轮操作次数，返回 null
    log.error(`滚轮操作次数已达上限 ${maxScrollAttempts} 次，未能找到 Cooking 图标`);
    return null;
  }


  try {
    // 识别 Cooking 图标
    const cookingRes = await main();
    if (!cookingRes) {
      log.error("未能识别 灶台 图标，退出任务");
      return;
    }

    // 按下 F 键
    keyPress("F");
    await sleep(1000);

    //制作料理
    if (foodName) {
      click(910, 51);//选择料理
      await sleep(1000);
      click(170, 1020);//筛选
      await sleep(1000);
      click(195, 1020);//重置
      await sleep(1000);
      click(110, 110);//输入名字
      await sleep(1000);
      inputText(`${foodName}`);
      await sleep(500);
      click(490, 1020);//确认筛选
      await sleep(1000);
      click(180, 180);//选择第一个食物
      await sleep(2000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(795, 1015);//自动烹饪
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of foodNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(4000);//等待烹饪
      click(960, 1045); //点击任意处
      await sleep(1000);
      click(960, 1045); //点击任意处
      await sleep(1000);
    };

    //食材加工

    click(1010, 50); //选择食材加工
    await sleep(1000);
    click(255, 1020); //全部领取
    await sleep(1000);
    click(960, 1045); //点击任意处
    await sleep(1000);
    click(960, 1045); //点击任意处
    await sleep(1000);
    click(960, 1045); //点击任意处
    await sleep(2000);


    if (flourNum) {
      click(175, 190);//flour
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of flourNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (creamNum) {
      click(770, 190);//cream
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of creamNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (smokedPoultryNum) {
      click(920, 190);//smokedPoultry
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of smokedPoultryNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (butterNum) {
      click(1060, 190);//butter
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of butterNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (hamNum) {
      click(1210, 190);//ham
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of hamNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (sugarNum) {
      click(175, 375);//sugar
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of sugarNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (spiceNum) {
      click(325, 375);//spice
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of spiceNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (crabRoeNum) {
      click(475, 375);//crabRoe
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of crabRoeNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (jamNum) {
      click(620, 375);//jam
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of jamNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (cheeseNum) {
      click(770, 375);//cheese
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of cheeseNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (baconNum) {
      click(915, 375);//bacon
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of baconNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };

    if (sausageNum) {
      click(1060, 375);//sausage
      await sleep(1000);
      click(1690, 1015);//制作
      await sleep(1000);
      click(965, 455);//输入数量
      await sleep(1000);
      for (const char of sausageNum) {
        keyPress(char);
        await sleep(500);
      }
      click(1190, 755);//确认
      await sleep(1000);
    };
    await genshin.returnMainUi();
    await sleep(1000);
    keyDown("S");
    await sleep(1500);
    keyUp("S");
    await sleep(1000);

  } catch (error) {
    log.error(`执行按键或鼠标操作时发生错误：${error.message}`);
  }

  // 发送通知
  notification.send("烹饪脚本结束");
})();
