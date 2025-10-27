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
    return findFirst(ir, ro, (region) => region.isExist());
  } catch (err) {
    err?.message && log.warn(`${err.message}`);
  }
};
const findText = (text, options) => {
  const { ignoreCase = true, contains = false } = options || {};
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const ir = captureGameRegion();
  const ro = RecognitionObject.ocrThis;
  return findFirst(ir, ro, (region) => {
    const itemText = ignoreCase ? region.text.toLowerCase() : region.text;
    const isMatch = contains ? itemText.includes(searchText) : itemText === searchText;
    return isMatch && region.isExist();
  });
};
const findTextWithinBounds = (text, x, y, w, h, options) => {
  const { ignoreCase = true, contains = false } = options || {};
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const ir = captureGameRegion();
  const ro = RecognitionObject.ocr(x, y, w, h);
  return findFirst(ir, ro, (region) => {
    const itemText = ignoreCase ? region.text.toLowerCase() : region.text;
    const isMatch = contains ? itemText.includes(searchText) : itemText === searchText;
    return isMatch && region.isExist();
  });
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
  log.info("打开全部奇域界面...");
  await assertRegionAppearing(
    () => findHeaderTitle("全部", true),
    "打开全部奇域界面超时",
    () => {
      findTextWithinBounds("全部", 1320, 0, 600, 95, {
        contains: true
      })?.click();
    }
  );
  log.info("粘贴奇域关卡文本: {room}", room);
  await sleep(1000);
  await assertRegionAppearing(
    () => findTextWithinBounds("清除", 0, 120, 1920, 60),
    "粘贴关卡文本超时",
    () => {
      const ph = findTextWithinBounds("搜索", 0, 120, 1920, 60, {
        contains: true
      });
      if (ph) {
        ph.click();
        inputText(room);
      }
    }
  );
  log.info("搜索奇域关卡: {guid}", room);
  const findSearchButton = () => findTextWithinBounds("搜索", 0, 120, 1920, 60);
  const findTooFrequentText = () => findTextWithinBounds("过于频繁", 0, 0, 1920, 300, { contains: true });
  await assertRegionAppearing(
    findTooFrequentText,
    "搜索关卡超时",
    () => {
      findSearchButton()?.click();
    },
    { maxAttempts: 50, retryInterval: 200 }
  );
  log.info("打开奇域介绍...");
  const findCreateRoomButton = () => findTextWithinBounds("房间", 960, 140, 960, 70, { contains: true });
  await assertRegionAppearing(
    findCreateRoomButton,
    "打开奇域介绍超时",
    () => {
      const lobbyButton = findTextWithinBounds("大厅", 880, 840, 1040, 110, {
        contains: true
      });
      if (lobbyButton) {
        log.info("当前不在大厅，前往大厅...");
        lobbyButton.click();
      } else {
        log.info("选择第一个奇域关卡...");
        click(355, 365);
      }
    },
    { maxAttempts: 30 }
  );
  log.info("创建并进入房间...");
  await assertRegionAppearing(
    () => findHeaderTitle("房间", true),
    "创建并进入房间超时",
    () => {
      findCreateRoomButton()?.click();
    },
    { maxAttempts: 10 }
  );
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
  await assertRegionAppearing(
    () => findBottomButton("大厅", true),
    "等待游戏结束超时",
    async () => {
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
        if (outputCount % 7 === 0 ) {
          log.info("等待本次关卡结束...");
        }
        outputCount++;
      }
    },
    { maxAttempts: 120 }
  );
  log.info("返回大厅...");
  await goToLobby();
};

// main.ts
(async function() {
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
  const roomStr = settings.room || "15698418162";
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
                  {maxAttempts: 30, retryInterval: 500}
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
