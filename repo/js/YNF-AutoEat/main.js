(async function () {
     // ===== 1. 预处理部分 =====

     const party = settings.n;//设置好要切换的队伍
     const food = settings.food;//设置要吃的食物
     const foodCount = settings.foodNumber - 1;//点击“+”的次数，比食物数量少1
     const n = settings.runNumber;//运行次数

     const Dm = `assets/地脉.png`
     const pingguo = `assets/${food}.png`;//食物图片路径
     const zjz = `assets/zhengjianzhao.png`;//伊涅芙证件照
     const foodbag = `assets/foodbag.png`;//背包的“食物”界面

     const eater = "伊涅芙";//客官一位~

     // 添加验证
     if (!party) { log.error("队伍名为空，请仔细阅读readme并进行设置后再使用此脚本！"); return; }// 利用队伍是否为空判断用户有没有进行设置
     if (foodCount > 98 || foodCount < 0) { log.error("食材数量请填写1-99之间的数字！"); return; }//确保食材数量1~99
     if (n <= 0) { log.error("不是哥们，运行次数还能小于0？？？"); return; }//确保运行次数合法

     // ===== 2. 子函数定义部分 =====

     /**
     * 封装函数，执行图片识别及点击操作（测试中，未封装完成，后续会优化逻辑）
     * @param {string} imagefilePath - 模板图片路径
     * @param {number} timeout - 超时时间(秒)
     * @param {number} afterBehavior - 识别后行为(0:无,1:点击,2:按F键)
     * @param {number} debugmodel - 调试模式(0:关闭,1:详细日志)
     * @param {number} xa - 识别区域X坐标
     * @param {number} ya - 识别区域Y坐标
     * @param {number} wa - 识别区域宽度
     * @param {number} ha - 识别区域高度
     * @param {boolean} clickCenter - 是否点击目标中心
     * @param {number} clickOffsetX - 点击位置X轴偏移量
     * @param {number} clickOffsetY - 点击位置Y轴偏移量
     * @param {number} tt - 匹配阈值(0-1)
     */
     async function imageRecognitionEnhanced(
          imagefilePath = "空参数",
          timeout = 10,
          afterBehavior = 0,
          debugmodel = 0,
          xa = 0,
          ya = 0,
          wa = 1920,
          ha = 1080,
          clickCenter = false,
          clickOffsetX = 0,
          clickOffsetY = 0,
          tt = 0.8
     ) {
          // 参数验证
          if (xa + wa > 1920 || ya + ha > 1080) {
               log.info("图片区域超出屏幕范围");
               return { found: false, error: "区域超出屏幕范围" };
          }

          const startTime = Date.now();
          let captureRegion = null;
          let result = { found: false };

          try {
               // 读取模板图像
               const templateImage = file.ReadImageMatSync(imagefilePath);
               if (!templateImage) {
                    throw new Error("无法读取模板图像");
               }

               const Imagidentify = RecognitionObject.TemplateMatch(templateImage, true);
               if (tt !== 0.8) {
                    Imagidentify.Threshold = tt;
                    Imagidentify.InitTemplate();
               }

               // 循环尝试识别
               for (let attempt = 0; attempt < 10; attempt++) {
                    if (Date.now() - startTime > timeout * 1000) {
                         if (debugmodel === 1) {
                              log.info(`${timeout}秒超时退出，未找到图片`);
                         }
                         break;
                    }

                    captureRegion = captureGameRegion();
                    if (!captureRegion) {
                         await sleep(200);
                         continue;
                    }

                    try {
                         const croppedRegion = captureRegion.DeriveCrop(xa, ya, wa, ha);
                         const res = croppedRegion.Find(Imagidentify);

                         if (res.isEmpty()) {
                              if (debugmodel === 1) {
                                   log.info("识别图片中...");
                              }
                         } else {
                              // 计算基准点击位置（目标的左上角）
                              let clickX = res.x + xa;
                              let clickY = res.y + ya;

                              // 如果要求点击中心，计算中心点坐标
                              if (clickCenter) {
                                   clickX += Math.floor(res.width / 2);
                                   clickY += Math.floor(res.height / 2);
                              }

                              // 应用自定义偏移量
                              clickX += clickOffsetX;
                              clickY += clickOffsetY;

                              if (debugmodel === 1) {
                                   log.info("计算后点击位置：({x},{y})", clickX, clickY);
                              }

                              // 执行识别后行为
                              if (afterBehavior === 1) {
                                   await sleep(1000);
                                   click(clickX, clickY);
                              } else if (afterBehavior === 2) {
                                   await sleep(1000);
                                   keyPress("F");
                              }

                              result = {
                                   x: clickX,
                                   y: clickY,
                                   w: res.width,
                                   h: res.height,
                                   found: true
                              };
                              break;
                         }
                    } finally {
                         if (captureRegion) {
                              captureRegion.dispose();
                              captureRegion = null;
                         }
                    }

                    await sleep(200);
               }
          } catch (error) {
               log.info(`图像识别错误: ${error.message}`);
               result.error = error.message;
          }

          return result;
     }

     /**
     * 文字OCR识别封装函数（支持空文本匹配任意文字）
     * @param {string} text - 要识别的文字，默认为"空参数"，空字符串会匹配任意文字
     * @param {number} timeout - 超时时间，单位为秒，默认为10秒
     * @param {number} afterBehavior - 点击模式，0=不点击，1=点击文字位置，2=按F键，默认为0
     * @param {number} debugmodel - 调试模式，0=无输出，1=基础日志，2=详细输出，3=立即返回，默认为0
     * @param {number} x - OCR识别区域起始X坐标，默认为0
     * @param {number} y - OCR识别区域起始Y坐标，默认为0
     * @param {number} w - OCR识别区域宽度，默认为1920
     * @param {number} h - OCR识别区域高度，默认为1080
     * @param {number} matchMode - 匹配模式，0=包含匹配，1=精确匹配，默认为0
     * @returns {object} 包含识别结果的对象 {text, x, y, found}
     */
     async function textOCREnhanced(
          text = "空参数",
          timeout = 10,
          afterBehavior = 0,
          debugmodel = 0,
          x = 0,
          y = 0,
          w = 1920,
          h = 1080,
          matchMode = 0
     ) {
          const startTime = Date.now();
          const timeoutMs = timeout * 1000;
          let lastResult = null;
          let captureRegion = null; // 用于存储截图对象

          // 只在调试模式1下输出基本信息
          if (debugmodel === 1) {
               if (text === "") {
                    log.info(`OCR: 空文本模式 - 匹配任意文字`);
               } else if (text === "空参数") {
                    log.warn(`OCR: 使用默认参数"空参数"`);
               }
          }

          while (Date.now() - startTime < timeoutMs) {
               try {
                    // 获取截图并进行OCR识别
                    captureRegion = captureGameRegion();
                    const resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));

                    // 遍历识别结果
                    for (let i = 0; i < resList.count; i++) {
                         const res = resList[i];

                         // 检查是否匹配
                         let isMatched = false;
                         if (text === "") {
                              // 空文本匹配任意文字
                              isMatched = true;
                         } else if (matchMode === 1) {
                              // 精确匹配
                              isMatched = res.text === text;
                         } else {
                              // 包含匹配（默认）
                              isMatched = res.text.includes(text);
                         }

                         if (isMatched) {
                              // 只在调试模式1下输出匹配成功信息
                              if (debugmodel === 1) {
                                   log.info(`OCR成功: "${res.text}" 位置(${res.x},${res.y})`);
                              }

                              // 调试模式3: 立即返回
                              if (debugmodel === 3) {
                                   // 释放内存
                                   if (captureRegion) {
                                        captureRegion.dispose();
                                   }
                                   return { text: res.text, x: res.x, y: res.y, found: true };
                              }

                              // 执行后续行为
                              switch (afterBehavior) {
                                   case 1: // 点击文字位置
                                        await sleep(1000);
                                        click(res.x, res.y);
                                        break;
                                   case 2: // 按F键
                                        await sleep(100);
                                        keyPress("F");
                                        break;
                                   default:
                                        // 不执行任何操作
                                        break;
                              }

                              // 记录最后一个匹配结果但不立即返回
                              lastResult = { text: res.text, x: res.x, y: res.y, found: true };
                         }
                    }

                    // 释放截图对象内存
                    if (captureRegion) {
                         captureRegion.dispose();
                    }

                    // 如果找到匹配结果，根据调试模式决定是否立即返回
                    if (lastResult && debugmodel !== 2) {
                         return lastResult;
                    }

                    // 短暂延迟后继续下一轮识别
                    await sleep(100);

               } catch (error) {
                    // 发生异常时释放内存
                    if (captureRegion) {
                         captureRegion.dispose();
                    }
                    log.error(`OCR异常: ${error.message}`);
                    await sleep(100);
               }
          }

          if (debugmodel === 1) {
               // 超时处理
               if (text === "") {
                    log.info(`OCR超时: ${timeout}秒内未找到任何文字`);
               } else {
                    log.info(`OCR超时: ${timeout}秒内未找到"${text}"`);
               }
          }

          // 返回最后一个结果或未找到
          return lastResult || { found: false };
     }

     //判断队内角色
     async function includes(characterName) {
          var avatars = getAvatars();
          for (let i = 0; i < avatars.length; i++) {
               if (avatars[i] === characterName) {
                    await keyPress(String(i + 1));
                    await sleep(1500);
                    return true;
               }
          }
          return false;
     }

     //切换队伍
     async function switchPartyIfNeeded(partyName) {
          try {
               let switched = await genshin.switchParty(partyName);
               if (!switched) {
                    log.warn("切换队伍失败，正在重试……");
                    switched = await genshin.switchParty(partyName);
                    if (!switched) {
                         throw new Error("未找到指定队伍");
                    } // 在神像切换两次都失败，大概率是没有找到哦队伍
               }
               return true;
          } catch (e) {
               log.error("队伍切换失败，可能处于联机模式或其他不可切换状态：" + e.message);
               notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
               await genshin.returnMainUi();
               return false;
          }
     }

     // 传送并进入副本
     async function fuben() {
          await genshin.tp(-887.193359375, 1679.44287109375);//识别成功直接传送

          keyDown("w");
          await sleep(2000);
          keyUp("w");

          keyPress("F");

          await textOCREnhanced("单人挑战", 8, 1, 0, 1615, 990, 220, 50);//等待“单人挑战”出现
          await textOCREnhanced("开始挑战", 8, 1, 0, 1615, 990, 220, 50);//等待“开始挑战”出现
          await textOCREnhanced("地脉异常", 15, 1, 0, 840, 405, 180, 55);//等待“地脉异常”出现
          await sleep(1000);

          return true;
     }

     /**
      * 返回秘境界面
      * @returns {Promise<boolean>} 返回是否成功回到秘境界面
      */
     async function returnMijingUi() {
          let ifDm = await imageRecognitionEnhanced(Dm, 0.8, 0, 0, 15, 96, 47, 53);
          if (ifDm.found) {
               return true;
          } else {
               for (let i = 0; i < 3; i++) {
                    keyPress("VK_ESCAPE");
                    ifDm = await imageRecognitionEnhanced(Dm, 1.5, 0, 0, 15, 96, 47, 53);
                    if (ifDm.found) {
                         return true;
                    }
                    await sleep(100);
               }
          }
          return false;
     }

     // 伊涅芙跳楼机
     async function doit() {
          const randomNumber = Math.floor(Math.random() * 3) + 1;
          if (randomNumber == 1) { log.info("即使分离，我们的心始终相连"); }
          if (randomNumber == 2) { log.info("再见了伊涅芙，希望你喜欢这几分钟的戏份"); }
          if (randomNumber == 3) { log.info("离别不是结束，而是为了更好的重逢"); }

          keyDown("A");
          await sleep(3500);
          keyUp("A");

          await sleep(2500);
          let FH = await returnMijingUi();
          if (!FH) {
               for (let i = 0; i < 8; i++) {
                    FH = await returnMijingUi();
                    if (FH) {
                         break;
                    }
                    await sleep(1000);
               }
          }

          await keyPress("B");
          await handleExpiredItems(); //处理过期物品弹窗
          await sleep(1000);
          await click(860, 50);
          await sleep(800);

          let ifshiwu = await imageRecognitionEnhanced(foodbag, 3, 0, 0, 126, 17, 99, 53);//确认在食物界面
          if (!ifshiwu.found) {
               log.warn("未打开'食物'页面，正在尝试重新打开……");
               let attempts = 0;
               const maxAttempts = 3;
               let foundInRetry = false;
               while (attempts < maxAttempts) {
                    log.info(`第${attempts + 1}次尝试打开'食物'页面`);
                    await returnMijingUi();
                    await sleep(1000);
                    await keyPress("B");
                    await handleExpiredItems();
                    await sleep(1000);
                    await click(860, 50);
                    await sleep(1000);
                    ifshiwu = await imageRecognitionEnhanced(foodbag, 3, 0, 0, 126, 17, 99, 53);
                    if (ifshiwu.found) {
                         foundInRetry = true;
                         break;
                    } else {
                         attempts++;
                         await sleep(500);
                    }
               }
               if (!foundInRetry) {
                    throw new Error("未打开'食物'页面,请确保背包已正确打开并切换到食物标签页");
               }
          }

          //滚轮预操作
          await moveMouseTo(1287, 131);
          await sleep(100);
          await leftButtonDown();
          await sleep(100);
          await moveMouseTo(1287, 161);

          let YOffset = 0; // Y轴偏移量，根据需要调整
          const maxRetries = 20; // 最大重试次数
          let retries = 0; // 当前重试次数
          while (retries < maxRetries) {
               const ifpingguo = await imageRecognitionEnhanced(pingguo, 1, 0, 0, 115, 120, 1150, 880);//识别"苹果"图片
               if (ifpingguo.found) {
                    await leftButtonUp();
                    await sleep(500);
                    await click(ifpingguo.x + 45, ifpingguo.y + 50);
                    await sleep(1000);

                    await click(1700, 1020);//点击使用

                    await imageRecognitionEnhanced(zjz, 3, 1, 0, 625, 290, 700, 360, true);//点击伊涅芙证件照,确保吃食物的是伊涅芙
                    await sleep(500);

                    for (let i = 0; i < foodCount; i++) {
                         click(1251, 630);
                         await sleep(150);
                    }

                    await click(1180, 770);//点击确认
                    await sleep(500);

                    log.info("看我一口气吃掉" + settings.foodNumber + "个" + food + "！");

                    await returnMijingUi();
                    await sleep(10);

                    return;
               }
               retries++; // 重试次数加1
               //滚轮操作
               YOffset += 50;
               await sleep(500);
               if (retries === maxRetries || 161 + YOffset > 1080) {
                    await leftButtonUp();
                    await sleep(100);
                    await moveMouseTo(1287, 131);
                    await genshin.returnMainUi();
                    throw new Error("没有找到指定的食物：" + food + "，请检查背包中该食材数量是否足够！");
               }
               await moveMouseTo(1287, 161 + YOffset);
               await sleep(300);
          }
     }

     // 版本信息
     async function outputVersion() {
          let scriptVersion, scriptname;
          const manifestContent = file.readTextSync("manifest.json");
          const manifest = JSON.parse(manifestContent);
          scriptVersion = manifest.version;
          scriptname = manifest.name;

          log.warn(`${scriptname}：V${scriptVersion}`);
     }

     // 背包过期物品识别，需要在背包界面，并且是1920x1080分辨率下使用
     async function handleExpiredItems() {
          const ifGuoqi = await textOCREnhanced("物品过期", 1.5, 0, 3, 870, 280, 170, 40);
          if (ifGuoqi.found) {
               log.info("检测到过期物品，正在处理...");
               await sleep(500);
               await click(980, 750); // 点击确认按钮，关闭提示
          }
          // else { log.info("未检测到过期物品"); }//频繁开关背包，不需要每次都提示
     }

     // ===== 3. 主函数执行部分 =====

     //设置分辨率和缩放
     setGameMetrics(1920, 1080, 1);
     await genshin.returnMainUi();//回到主界面，在秘境中可能会卡几秒

     await outputVersion();

     log.warn("使用前请仔细阅读readme并进行相关设置！");
     log.warn("请确保食材充足！");

     await genshin.tpToStatueOfTheSeven();


     // 先判断一次，队伍里有伊涅芙就直接开始运行，没有的话就切换指定队伍
     if (!await includes(eater)) {
          if (!await switchPartyIfNeeded(party)) { log.error("未识别到指定队伍，请检查队伍名是否正确！"); return false; }//找不到指定队伍就直接报错停止
          if (!await includes(eater)) { log.error(`未识别到` + eater + `，请检查队伍名是否正确！`); return false; }// 切换成功后判断队伍中是否有伊涅芙
     }

     log.info(`已识别到` + eater + `，即将开始后续动作……`);
     await sleep(5000);

     try {
          await fuben();//进入副本

          let dieCount = 0;
          // 循环控制运行次数
          for (let i = 0; i < n; i++) {
               await doit();
               dieCount++;
               if (dieCount % 8 === 0 && dieCount != n) { //每8次回一次神像
                    log.info("队友们的血量好像有点不太健康欸……先回去补一补！");
                    await genshin.tpToStatueOfTheSeven();
                    await sleep(500);
                    await fuben();
               }
          }
     } catch (error) {
          await returnMijingUi();
          log.error(`脚本运行中断: ${error.message}`);
          return;
     }
     log.info("运行结束！今天的" + food + "味道不错哦~");

     await genshin.tpToStatueOfTheSeven();
})();
