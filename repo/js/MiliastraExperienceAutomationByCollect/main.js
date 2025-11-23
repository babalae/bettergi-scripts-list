// node_modules/.pnpm/@bettergi+utils@0.1.1/node_modules/@bettergi/utils/dist/workflow.js
const defaultMaxAttempts = 5;
const defaultRetryInterval = 1e3;
const waitForAction = async (condition, retryAction, options) => {
  const { maxAttempts = defaultMaxAttempts, retryInterval = defaultRetryInterval } = options || {};
  for (let i = 0; i < maxAttempts; i++) {
    if (i === 0 && condition())
      return true;
    await retryAction?.();
    await sleep(retryInterval);
    if (condition())
      return true;
  }
  return false;
};
const waitForRegionAppear = async (regionProvider, retryAction, options) => {
  return waitForAction(() => {
    const region = regionProvider();
    return region != null && region.isExist();
  }, retryAction, options);
};
const waitForRegionDisappear = async (regionProvider, retryAction, options) => {
  return waitForAction(() => {
    const region = regionProvider();
    return !region || !region.isExist();
  }, retryAction, options);
};

// node_modules/.pnpm/@bettergi+utils@0.1.1/node_modules/@bettergi/utils/dist/asserts.js
const assertRegionAppearing = async (regionProvider, message, retryAction, options) => {
  const isAppeared = await waitForRegionAppear(regionProvider, retryAction, options);
  if (!isAppeared) {
    throw new Error(message);
  }
};
const assertRegionDisappearing = async (regionProvider, message, retryAction, options) => {
  const isDisappeared = await waitForRegionDisappear(regionProvider, retryAction, options);
  if (!isDisappeared) {
    throw new Error(message);
  }
};

// node_modules/.pnpm/@bettergi+utils@0.1.1/node_modules/@bettergi/utils/dist/ocr.js
const findFirst = (ir, ro, predicate) => {
  const candidates = ir.findMulti(ro);
  for (let i = 0; i < candidates.count; i++) {
    if (predicate(candidates[i]))
      return candidates[i];
  }
  return void 0;
};
const findImageWithinBounds = (path, x, y, w, h) => {
  try {
    const ir = captureGameRegion();
    const ro = RecognitionObject.templateMatch(file.readImageMatSync(path), x, y, w, h);
    const result = findFirst(ir, ro, (region) => region.isExist());
    ir.dispose();
    return result;
  } catch (err) {
    err?.message && log.warn(`${err.message}`);
  }
};
const findText = (text, options) => {
  const { ignoreCase = true, contains = false } = options || {};
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const ir = captureGameRegion();
  const ro = RecognitionObject.ocrThis;
  const result = findFirst(ir, ro, (region) => {
    const itemText = ignoreCase ? region.text.toLowerCase() : region.text;
    const isMatch = contains ? itemText.includes(searchText) : itemText === searchText;
    return isMatch && region.isExist();
  });
  ir.dispose();
  return result;
};
const findTextWithinBounds = (text, x, y, w, h, options) => {
  const { ignoreCase = true, contains = false } = options || {};
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const ir = captureGameRegion();
  const ro = RecognitionObject.ocr(x, y, w, h);
  const result = findFirst(ir, ro, (region) => {
    const itemText = ignoreCase ? region.text.toLowerCase() : region.text;
    const isMatch = contains ? itemText.includes(searchText) : itemText === searchText;
    return isMatch && region.isExist();
  });
  ir.dispose();
  return result;
};

// node_modules/.pnpm/@bettergi+utils@0.1.1/node_modules/@bettergi/utils/dist/store.js
const useStore = (name) => {
  const filePath = `store/${name}.json`;
  const obj = (() => {
    try {
      const text = file.readTextSync(filePath);
      return JSON.parse(text);
    } catch {
      return {};
    }
  })();
  const createProxy = (target, parentPath = []) => {
    if (typeof target !== "object" || target === null) {
      return target;
    }
    return new Proxy(target, {
      get: (target2, key) => {
        const value = Reflect.get(target2, key);
        return typeof value === "object" && value !== null ? createProxy(value, [...parentPath, key]) : value;
      },
      set: (target2, key, value) => {
        const success = Reflect.set(target2, key, value);
        if (success) {
          Promise.resolve().then(() => {
            file.writeTextSync(filePath, JSON.stringify(obj, null, 2));
          });
        }
        return success;
      },
      deleteProperty: (target2, key) => {
        const success = Reflect.deleteProperty(target2, key);
        if (success) {
          Promise.resolve().then(() => {
            file.writeTextSync(filePath, JSON.stringify(obj, null, 2));
          });
        }
        return success;
      }
    });
  };
  return createProxy(obj);
};

// src/misc.ts
const findHeaderTitle = (title, contains) => findTextWithinBounds(title, 0, 0, 300, 95, { contains });
const findBottomTitle = (title, contains) => findTextWithinBounds(title, 0, 600, 300, 400, { contains });
const findBottomButton = (text, contains) => findTextWithinBounds(text, 960, 980, 960, 100, { contains });
const getNextMonday4AM = () => {
  const now = /* @__PURE__ */ new Date();
  const result = new Date(now);
  result.setHours(4, 0, 0, 0);
  const currentDay = now.getDay();
  let daysUntilMonday;
  if (currentDay === 1 && now.getHours() < 4) {
    daysUntilMonday = 0;
  } else {
    daysUntilMonday = 8 - currentDay;
  }
  result.setDate(now.getDate() + daysUntilMonday);
  return result;
};

// src/lobby.ts
const findMessageEnter = () => findImageWithinBounds("assets/Enter.png", 0, 1020, 960, 60);
const findMessageEnter2 = () => findImageWithinBounds("assets/Enter2.png", 0, 1020, 960, 60);
const findExitButton = () => findImageWithinBounds("assets/Exit.png", 960, 0, 960, 540);
const findGotTeyvatButton = () => findTextWithinBounds("返回", 1500, 0, 300, 95, { contains: true });
const findClickAnywhere = () => findTextWithinBounds("空白处", 610, 950, 700, 60, { contains: true });
const isInLobby = () => findMessageEnter() !== void 0 || findMessageEnter2() !== void 0;
const goToLobby = async () => {
  const ok = await waitForAction(
    isInLobby,
    () => {
      findBottomButton("大厅", true)?.click();
    },
    { maxAttempts: 60 }
  );
  if (!ok) throw new Error("返回大厅超时");
};
const goBackToTeyvat = async () => {
  log.info("打开当前大厅...");
  await assertRegionAppearing(
    () => findHeaderTitle("大厅", true),
    "打开当前大厅超时",
    () => {
      keyPress("F2");
    },
    { maxAttempts: 10 }
  );
  await assertRegionAppearing(
    findMessageEnter,
    "返回提瓦特大陆超时",
    () => {
      log.info("返回提瓦特大陆...");
      findGotTeyvatButton()?.click();
      findText("确认")?.click();
    },
    { maxAttempts: 120 }
  );
};

// src/room.ts
const createRoom = async (room) => {
  log.info("打开人气奇域界面...");
  await assertRegionAppearing(
    () => findHeaderTitle("人气", true),
    "打开人气奇域界面超时",
    () => {
      keyPress("F6");
    }
  );
  
  log.info("打开收藏奇域界面...");
  await assertRegionAppearing(
    () => findBottomTitle("收藏", true),
    "打开收藏奇域界面超时",
    () => {
      findTextWithinBounds("收藏", 0, 500, 920, 580, {
        contains: true
      })?.click();
    }
  );

  log.info("搜索奇域关卡: {room}", room);
  // 搜索栏范围：0-1920, 0-75
  const searchX = 0, searchY = 0, searchW = 1920, searchH = 75;

  // 1. 如果有残留文本，先清除
  const clearBtn = findTextWithinBounds("清除", searchX, searchY, searchW, searchH, { contains: true });
  if (clearBtn) {
    log.info("清除旧搜索内容...");
    clearBtn.click();
    await sleep(500);
  }

  // 2. 查找并点击搜索占位符
  const findSearchPlaceholder = () => findTextWithinBounds("搜索", searchX, searchY, searchW, searchH, { contains: true });
  await assertRegionAppearing(
    findSearchPlaceholder,
    "未找到搜索框",
    undefined, 
    { maxAttempts: 10 }
  );
  
  const ph = findSearchPlaceholder();
  if (ph) {
    ph.click();
    await sleep(500);
    inputText(room); // 输入ID
    await sleep(1000); 

    // 3. 点击真正的搜索按钮
    const searchBtn = findTextWithinBounds("搜索", searchX, searchY, searchW, searchH, { contains: true });
    if (searchBtn) {
      log.info("点击搜索按钮...");
      searchBtn.click();
    }
  }

  // 4. 等待结果并点击固定坐标 (x:350, y:800)
  log.info("等待搜索结果并选择...");
  await sleep(1500); 
  click(350, 800);
  await sleep(1000);

  // 5. 循环检测进入逻辑
  // 大厅区域：1460-1600, 870-910
  const findEntryLobbyBtn = () => findTextWithinBounds("大厅", 1460, 870, 140, 40, { contains: true });
  // 开始区域：1470-1600, 870-905
  const findStartBtn = () => findTextWithinBounds("开始", 1470, 870, 130, 35, { contains: true });

  log.info("准备进入房间...");
  
  let loopCount = 0;
  const maxLoops = 20;

  // 手动循环，确保点击“开始”后立即跳出
  while (loopCount < maxLoops) {
    // 优先：如果看到“开始”，点击并直接退出函数
    const start = findStartBtn();
    if (start) {
        log.info("发现'开始'按钮，点击并准备开始游戏...");
        start.click();
        await sleep(1000); // 确保点击生效
        return; // 【关键修改】直接结束 createRoom，不再重试
    }

    // 其次：如果看到“大厅”，点击进入
    const lobby = findEntryLobbyBtn();
    if (lobby) {
        log.info("发现'大厅'入口，点击...");
        lobby.click();
        await sleep(1500); // 等待界面切换到出现“开始”
        continue; // 继续下一次循环，去检测“开始”
    }

    // 最后：如果什么都没看到，可能是卡片没点中，重试点击卡片
    log.info("未发现入口按钮，重试点击关卡卡片...");
    click(350, 800);
    
    await sleep(1500); // 等待卡片点击后的反应
    loopCount++;
  }

  throw new Error("进入房间超时");
};

const enterRoom = async (room) => {
  const inLobby = isInLobby();
  if (inLobby) {
    const enterButton = findTextWithinBounds("房间", 1580, 110, 320, 390, {
      contains: true
    });
    if (enterButton) {
      log.info("当前已存在房间，进入房间...", room);
      await assertRegionAppearing(
        () => findHeaderTitle("房间", true),
        "进入房间超时",
        () => {
          keyPress("P");
        }
      );
      return;
    }
  }
  log.info("当前不在房间内，创建房间...", room);
  await createRoom(room);
};

const startGame = async () => {
  let outputCount = 0;
  
  // 修改判定结束的条件
  // 区域 x 1660-1800 y 1000-1038
  // 宽 = 1800-1660 = 140, 高 = 1038-1000 = 38
  const findEndGameLobbyBtn = () => findTextWithinBounds("大厅", 1660, 1000, 140, 38, { contains: true });

  log.info("进入游戏等待循环，等待关卡结束...");

  await assertRegionAppearing(
    findEndGameLobbyBtn,
    "等待游戏结束超时",
    async () => {
      // 在等待结束的过程中，持续尝试点击“开始游戏”和“准备”
      // 只有在没检测到结束的大厅按钮时，才尝试点击开始/准备，防止误触
      if (!findEndGameLobbyBtn()) {
        findBottomButton("开始游戏")?.click();
        findBottomButton("准备", true)?.click();
        
        const prepare = () => findText("加入准备", { contains: true });
        if (prepare()) {
          log.info("加入准备区...");
          await assertRegionDisappearing(prepare, "等待加入准备区提示消失超时");
          click(770, 275);
        } else {
          // 出现升级提醒时，点击空白处继续
          findClickAnywhere()?.click();
          if (outputCount % 10 === 0) {
            log.info("正在进行游戏，等待结束标志(x1660 y1000)...");
          }
          outputCount++;
        }
      }
    },
    { maxAttempts: 200, retryInterval: 2000 } // 增加等待时间
  );
  
  log.info("检测到'大厅'按钮，本局游戏结束，返回大厅...");
  // 此时已经在大厅了，点击这个按钮返回大厅
  const btn = findEndGameLobbyBtn();
  if (btn) {
    btn.click(); 
    await sleep(2000); // 等待返回动作完成
  }
  
  await goToLobby();
};

// main.ts
(async function () {
  setGameMetrics(1920, 1080, 1.5);
  await genshin.returnMainUi();

  // 检查当前是否在房间内，如果是则先退回到大厅
  const inLobby = isInLobby();
  if (!inLobby) {
    log.info("检测到当前不在大厅，正在返回大厅...");
    try {
      await goToLobby();
    } catch (e) {
      log.warn("返回大厅失败，继续执行: " + (e.message || e));
    }
  }

  const goToTeyvat = settings.goToTeyvat ?? true;
  // 从房间号池中随机取一个
  let roomStr = settings.room;
  // 支持中英文逗号分割多个房间号
  const rooms = roomStr.split(/[,，]/).map(r => r.trim()).filter(r => r);
  const force = settings.force ?? false;
  const thisAttempts = Math.max(0, Number(settings.thisAttempts || "0"));
  const expWeeklyLimit = Math.max(1, Number(settings.expWeeklyLimit || "4000"));
  const expPerAttempt = Math.max(1, Number(settings.expPerAttempt || "20"));
  const store = useStore("data");
  store.weekly = store.weekly || { expGained: 0, attempts: 0 };
  store.nextWeek = store.nextWeek || getNextMonday4AM().getTime();
  if (Date.now() >= store.nextWeek) {
    log.info("新的一周，重置本周经验值数据");
    store.weekly = { expGained: 0, attempts: 0 };
    store.nextWeek = getNextMonday4AM().getTime();
  }

  // 如果只有一个房间号，检查经验上限
  if (rooms.length === 1) {
    if (store.weekly.expGained >= expWeeklyLimit) {
      if (force) {
        log.warn("本周获取经验值已达上限，强制执行");
      } else {
        log.warn("本周获取经验值已达上限，跳过执行");
        return;
      }
    }
  } else {
    log.info("检测到多个房间号，将忽略经验上限直接执行");
  }

  // 如果指定了通关次数，不显示经验相关日志
  const isSpecifiedAttempts = thisAttempts > 0;

  try {
    // 对每个房间号循环执行
    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
      const room = rooms[roomIndex];
      log.info("开始处理房间 " + room + " (" + (roomIndex + 1) + "/" + rooms.length + ")");

      const expRemain = expWeeklyLimit - store.weekly.expGained;
      let attempts = Math.ceil(
        (expRemain > 0 ? expRemain : expWeeklyLimit) / expPerAttempt
      );
      if (thisAttempts > 0) attempts = thisAttempts;

      // 对该房间执行指定次数
      for (let i = 0; i < attempts; i++) {
        // 多房间模式时忽略经验上限检查
        if (rooms.length === 1 && !isSpecifiedAttempts) {
          // 单房间模式且未指定次数：检查是否达到经验上限（仅第一次跳过，其他由内部判断）
          if (i === 0 && store.weekly.expGained >= expWeeklyLimit && !force) {
            log.warn("本周获取经验值已达上限，跳过该房间");
            break;
          }
        }

        // 首次执行时，先退出房间
        if (i === 0) {
          const inLobby = isInLobby();
          if (inLobby) {
            const enterButton = findTextWithinBounds("房间", 1580, 110, 320, 390, {
              contains: true
            });
            if (enterButton) {
              log.info("首次执行，先退出已有房间...");
              await sleep(2000);
              // 进入房间
              keyPress("P");
              await sleep(3000);
              // 等待房间界面出现
              await assertRegionAppearing(
                () => findHeaderTitle("房间", true),
                "等待进入房间超时"
              );
              // 点击退出按钮
              const exitBtn = findExitButton();
              if (exitBtn) {
                log.info("找到退出按钮，点击退出...");
                exitBtn.click();
                await sleep(2000);
                // 等待弹窗出现并点击"确认"
                const confirmBtn = findText("确认");
                if (confirmBtn && confirmBtn.isExist && confirmBtn.isExist()) {
                  confirmBtn.click();
                  await sleep(1000);
                } else if (confirmBtn) {
                  confirmBtn.click();
                  await sleep(1000);
                }
              } else {
                log.warn("未找到退出按钮");
              }
              // 确认已返回大厅
              const backToLobby = await waitForAction(
                isInLobby,
                null,
                { maxAttempts: 30, retryInterval: 500 }
              );
              if (backToLobby) {
                log.info("已成功退出已有房间");
              } else {
                log.warn("退出房间超时，但继续执行");
              }
            }
          }
        }

        if (isSpecifiedAttempts) {
          log.info(
            "房间 {room}: [{c}/{t}] 开始第 {num} 次奇域挑战...",
            room,
            i + 1,
            attempts,
            i + 1
          );
        } else {
          log.info(
            "房间 {room}: [{c}/{t}] 开始本周第 {num} 次奇域挑战...",
            room,
            i + 1,
            attempts,
            store.weekly.attempts + 1
          );
        }

        await enterRoom(room);
        await startGame();
        store.weekly.attempts += 1;
        store.weekly.expGained += expPerAttempt;

        // 单房间模式且未指定次数时检查经验上限
        if (rooms.length === 1 && !isSpecifiedAttempts && store.weekly.expGained >= expWeeklyLimit && !force) {
          log.warn("本周获取经验值已达上限，停止执行");
          break;
        }
      }
    }
  } catch (e) {
    log.error("脚本执行出错: " + (e.message || e));
    await genshin.returnMainUi();
  }
  if (goToTeyvat) {
    await goBackToTeyvat();
  }
})();