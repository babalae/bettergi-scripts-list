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
          clickCenter = false,  // 新增：是否点击中心
          clickOffsetX = 0,    // 新增：X轴偏移量
          clickOffsetY = 0,    // 新增：Y轴偏移量
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
     * 文字OCR识别封装函数
     * @param {string} text 要识别的文字，默认为"空参数"
     * @param {number} timeout 超时时间，单位为秒，默认为10秒
     * @param {number} afterBehavior 点击模式，0表示不点击，1表示点击识别到文字的位置，2表示输出模式，默认为0
     * @param {number} debugmodel 调试模式，0表示输入判断模式，1表示输出位置信息，2表示输出判断模式，默认为0
     * @param {number} x OCR识别区域的起始X坐标，默认为0
     * @param {number} y OCR识别区域的起始Y坐标，默认为0
     * @param {number} w OCR识别区域的宽度，默认为1920
     * @param {number} h OCR识别区域的高度，默认为1080
     * @returns {Promise<Object>} 包含识别结果的对象，包括识别的文字、坐标和是否找到的结果
     */
     async function textOCR(text = "空参数", timeout = 10, afterBehavior = 0, debugmodel = 0, x = 0, y = 0, w = 1920, h = 1080) {
          const startTime = Date.now();
          const timeoutMs = timeout * 1000;
          let foundResult = null;

          try {
               while (Date.now() - startTime < timeoutMs) {
                    // 获取截图
                    const captureRegion = captureGameRegion();

                    try {
                         // 对整个区域进行 OCR
                         const resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));

                         if (resList && resList.count > 0) {
                              for (let i = 0; i < resList.count; i++) {
                                   const res = resList[i];

                                   if (debugmodel === 3 && res.text.includes(text)) {
                                        return { text: res.text, x: res.x, y: res.y, found: true };
                                   }

                                   if (res.text.includes(text)) {
                                        if (debugmodel !== 2) {
                                             if (debugmodel === 1) { log.info(`"${res.text}"找到`); }

                                             if (debugmodel === 1 && x === 0 && y === 0) {
                                                  log.info(`全图代码位置：(${res.x - 10},${res.y - 10},${res.width + 10},${res.height + 10})`);
                                             }

                                             if (afterBehavior === 1) {
                                                  if (debugmodel === 1) { log.info("点击模式:开"); }
                                                  await sleep(1000);
                                                  click(res.x, res.y);
                                             }

                                             if (afterBehavior === 2) {
                                                  if (debugmodel === 1) { log.info("F模式:开"); }
                                                  await sleep(100);
                                                  keyPress("F");
                                             }
                                        }

                                        foundResult = { text: res.text, x: res.x, y: res.y, found: true };
                                        break;
                                   }
                              }

                              if (foundResult) {
                                   return foundResult;
                              }
                         }

                         // 释放OCR结果资源
                         if (resList && typeof resList.dispose === 'function') {
                              resList.dispose();
                         }
                    } finally {
                         // 确保释放截图资源
                         if (captureRegion && typeof captureRegion.dispose === 'function') {
                              captureRegion.dispose();
                         }
                    }

                    if (debugmodel === 1 && x === 0 && y === 0) {
                         log.info(`"${text}"识别中……`);
                    }

                    await sleep(100);
               }

               log.info(`${timeout}秒超时退出，"${text}"未找到`);

               return { found: false };
          } catch (error) {
               log.error("OCR识别过程中发生错误:", error);
               return { found: false };
          }
     }

     async function doit() {
          await genshin.tp(1433.697, 837.387);

          await sleep(3000);
          await keyPress("B");
          await sleep(1000);

          //连续点击三次防止过期道具卡背包
          await click(970, 760);
          await sleep(500);
          await click(970, 760);
          await sleep(500);
          await click(970, 760);

          await sleep(1000);
          await click(862, 47);//点开背包,可做图像识别优化

          const ifshiwu = await textOCR("食物", 3, 0, 0, 126, 17, 99, 53);
          if (!ifshiwu) {
               await genshin.returnMainUi();
               log.warn("未打开'食物'页面");
               return;
          }//确认在食物界面
          await sleep(500);
          const ifpingguo = await imageRecognitionEnhanced(pingguo, 1, 1, 0, 115, 120, 1150, 155);//识别"苹果"图片
          if (!ifpingguo) {
               await genshin.returnMainUi();
               log.warn("没有找到指定的食物");
               return;
          }
          await sleep(500);
          await textOCR("使用", 5, 1, 0, 1620, 987, 225, 50);

          await sleep(1000);

          for (let i = 0; i < fn; i++) {
               click(1251, 630);
               await sleep(300);
          }

          await textOCR("确认", 5, 1, 0, 1100, 740, 225, 50);
          await sleep(500);
          leftButtonClick();
          await sleep(500);

          await genshin.returnMainUi();

          log.info("再见了伊涅芙，希望你喜欢这几分钟的戏份");

          keyDown("w");
          await sleep(2500);
          keyUp("w");

          await sleep(5000);
          await genshin.tp(1474.877, 763.940);
     }

     log.warn("使用前请确保食材充足！");
     
     //设置分辨率和缩放
     setGameMetrics(1920, 1080, 1);

     await genshin.returnMainUi();

     const food = settings.food;
     const n = settings.runNumber;
     const fn = (settings.foodNumber)-1;
     const pingguo = `assets/${food}.png`;

     for (let i = 0; i < n; i++) {
          await doit();
     }
})();


