(async function () {
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

     //判断队内角色
     async function includes(characterName) {
          var avatars = getAvatars();
          for (let i = 0; i < avatars.length; i++) {
               if (avatars[i] === characterName) { return true; }
          }
          return false;
     }

     //切换队伍
     async function switchPartyIfNeeded(partyName) {
          try {
               if (!await genshin.switchParty(partyName)) {//切换失败前往副本门口重试
                    log.warn("切换队伍失败，正在重试……");
                    await genshin.tp(-887.193359375, 1679.44287109375);//沉眠之庭
                    await genshin.switchParty(partyName);
                    return await includes("伊涅芙");
               } else {
                    if (!await includes("伊涅芙")) { return false; }
                    await genshin.tp(-887.193359375, 1679.44287109375);//切换成功就直接传送
                    return true;
               }
          } catch (e) {
               log.error("队伍切换失败，可能处于联机模式或其他不可切换状态：" + e.message);
               notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
               await genshin.returnMainUi();
               return false;
          }
     }

     // 传送并进入副本
     async function fuben() {
          // 先判断一次，队伍里有伊涅芙就直接开始运行，没有的话就切换指定队伍
          if (!await includes("伊涅芙")) {
               if (!await switchPartyIfNeeded(party)) { log.error("未识别到指定队伍，或队伍中不包含伊涅芙，请检查队伍名是否正确！"); return false; }//找不到指定队伍就直接报错停止
          } else {
               log.info("已识别到伊涅芙，即将开始后续动作……");
               await genshin.tp(-887.193359375, 1679.44287109375);//识别成功直接传送
          }

          keyDown("w");
          await sleep(2500);
          keyUp("w");
          keyPress("F");
          await sleep(4000);
          await click(1600, 1015);
          await sleep(1500);
          await click(1600, 1015);
          await sleep(9000);
          leftButtonClick();
          await sleep(1500);

          log.info("古又老师说让你先die一下");//先降低点生命值避免满血弹窗
          keyDown("A");
          await sleep(3000);
          keyUp("A");
          await sleep(3000);

          return true;
     }

     // 伊涅芙跳楼机
     async function doit() {
          await sleep(3000);
          await keyPress("B");
          await sleep(1000);

          //连续点击三次防止过期道具卡背包
          await click(970, 760);
          await sleep(100);
          await click(970, 760);
          await sleep(100);
          await click(970, 760);

          log.info("猜猜为什么要连续点击这个位置呢~");

          await sleep(1000);
          await click(860, 50);

          const ifshiwu = await imageRecognitionEnhanced(foodbag, 3, 0, 0, 126, 17, 99, 53);

          if (!ifshiwu.found) {
               await genshin.returnMainUi();
               throw new Error("未打开'食物'页面,请确保背包已正确打开并切换到食物标签页");
          }//确认在食物界面
          await sleep(500);
          const ifpingguo = await imageRecognitionEnhanced(pingguo, 1, 1, 0, 115, 120, 1150, 155, true);//识别"苹果"图片
          if (!ifpingguo.found) {
               await genshin.returnMainUi();
               throw new Error("没有找到指定的食物：" + food + "，请检查背包中该食材数量是否足够！");
          }
          await sleep(500);

          await click(1700, 1020);//点击使用
          await sleep(1000);

          const ifzjz = await imageRecognitionEnhanced(zjz, 5, 1, 0, 625, 290, 700, 360, true);//点击伊涅芙证件照
          await sleep(100);
          leftButtonClick();//连续点击确保吃食物的是伊涅芙
          await sleep(100);
          leftButtonClick();
          await sleep(100);

          if (!ifzjz.found) { throw new Error("未识别到伊涅芙"); }

          for (let i = 0; i < foodCount; i++) {
               click(1251, 630);
               await sleep(150);
          }

          await click(1180, 770);//点击确认
          await sleep(500);

          log.info("看我一口气吃掉" + settings.foodNumber + "个" + food + "！");

          await sleep(1000);
          await keyPress("ESCAPE");
          await sleep(1000);
          await keyPress("ESCAPE");

          await sleep(1000);

          if (n == 1) { return; }

          log.info("再见了伊涅芙，希望你喜欢这几分钟的戏份");

          keyDown("A");
          await sleep(3000);
          keyUp("A");
          await sleep(3000);
     }


     // ===== MAIN EXECUTION =====


     // 预处理
     const party = settings.n;//设置好要切换的队伍
     const food = settings.food;//设置要吃的食物
     const foodCount = settings.foodNumber - 1;//点击“+”的次数，比食物数量少1
     const n = settings.runNumber;//运行次数

     const pingguo = `assets/${food}.png`;//食物图片路径
     const zjz = `assets/zhengjianzhao.png`;//伊涅芙证件照
     const foodbag = `assets/foodbag.png`;//背包的“食物”界面

     // 添加验证
     if (!party) { log.error("队伍名为空，请仔细阅读readme并进行设置后再使用此脚本！"); return; }// 利用队伍是否为空判断用户有没有进行设置
     if (foodCount > 98 || foodCount < 0) { log.error("食材数量请填写1-99之间的数字！"); return; }//确保食材数量1~99
     if (n <= 0) { log.error("不是哥们，运行次数还能小于0？？？"); return; }//确保运行次数合法


     //设置分辨率和缩放
     setGameMetrics(1920, 1080, 1);
     await genshin.returnMainUi();//回到主界面，在秘境中可能会卡几秒

     log.warn("使用前请仔细阅读readme并进行相关设置！");
     log.warn("请确保食材充足！");

     const iffuben = await fuben(); if (!iffuben) { return; }//前期准备，进入副本并降低一部分血量

     // 循环控制运行次数
     try {
          for (let i = 0; i < n; i++) {
               await doit();
          }
     } catch (error) {
          log.error(`识别图像时发生异常: ${error.message}`);
     }
     log.info("运行结束！今天的" + food + "味道不错哦~");

     await genshin.tp(-887.193359375, 1679.44287109375);//回到副本门口
})();
