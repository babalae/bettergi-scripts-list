// node_modules/.pnpm/@bettergi+utils@0.1.1/node_modules/@bettergi/utils/dist/workflow.js
var defaultMaxAttempts = 5;
var defaultRetryInterval = 1e3;
var waitForAction = async (condition, retryAction, options) => {
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
var waitForRegionAppear = async (regionProvider, retryAction, options) => {
  return waitForAction(() => {
    const region = regionProvider();
    return region != null && region.isExist();
  }, retryAction, options);
};
var waitForRegionDisappear = async (regionProvider, retryAction, options) => {
  return waitForAction(() => {
    const region = regionProvider();
    return !region || !region.isExist();
  }, retryAction, options);
};

// node_modules/.pnpm/@bettergi+utils@0.1.1/node_modules/@bettergi/utils/dist/asserts.js
var assertRegionAppearing = async (regionProvider, message, retryAction, options) => {
  const isAppeared = await waitForRegionAppear(regionProvider, retryAction, options);
  if (!isAppeared) {
    throw new Error(message);
  }
};
var assertRegionDisappearing = async (regionProvider, message, retryAction, options) => {
  const isDisappeared = await waitForRegionDisappear(regionProvider, retryAction, options);
  if (!isDisappeared) {
    throw new Error(message);
  }
};

// node_modules/.pnpm/@bettergi+utils@0.1.1/node_modules/@bettergi/utils/dist/ocr.js
var findFirst = (ir, ro, predicate) => {
  const candidates = ir.findMulti(ro);
  for (let i = 0; i < candidates.count; i++) {
    if (predicate(candidates[i]))
      return candidates[i];
  }
  return void 0;
};
var findImageWithinBounds = (path, x, y, w, h) => {
  try {
    const ir = captureGameRegion();
    const ro = RecognitionObject.templateMatch(file.readImageMatSync(path), x, y, w, h);
    return findFirst(ir, ro, (region) => region.isExist());
  } catch (err) {
    err?.message && log.warn(`${err.message}`);
  }
};
var findText = (text, options) => {
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
var findTextWithinBounds = (text, x, y, w, h, options) => {
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
var useStore = (name) => {
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
var findHeaderTitle = (title, contains) => findTextWithinBounds(title, 0, 0, 300, 95, { contains });
var findBottomButton = (text, contains) => findTextWithinBounds(text, 960, 980, 960, 100, { contains });
var getNextMonday4AM = () => {
  const now = /* @__PURE__ */ new Date();
  const result = new Date(now);
  result.setHours(4, 0, 0, 0);
  const currentDay = now.getDay();
  let daysUntilMonday;
  if (currentDay === 1 && now.getHours() < 4) {
    daysUntilMonday = 0;
  } else {
    daysUntilMonday = (8 - currentDay) % 7;
  }
  result.setDate(now.getDate() + daysUntilMonday);
  return result;
};

// src/lobby.ts
var findMessageEnter = () => findImageWithinBounds("assets/Enter.png", 0, 1020, 960, 60);
var findMessageEnter2 = () => findImageWithinBounds("assets/Enter2.png", 0, 1020, 960, 60);
var findGotTeyvatButton = () => findTextWithinBounds("返回", 1500, 0, 300, 95, { contains: true });
var isInLobby = () => findMessageEnter() !== void 0 || findMessageEnter2() !== void 0;
var goToLobby = async () => {
  const ok = await waitForAction(
    isInLobby,
    () => {
      findBottomButton("大厅", true)?.click();
    },
    { maxAttempts: 60 }
  );
  if (!ok) throw new Error("返回大厅超时");
};
var goBackToTeyvat = async () => {
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
var createRoom = async (room) => {
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
var enterRoom = async (room) => {
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
var startGame = async () => {
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
  const goToTeyvat = settings.goToTeyvat ?? true;
  const room = settings.room || "7070702264";
  const force = settings.force ?? false;
  const thisAttempts = Math.max(0, Number(settings.thisAttempts || "0"));
  const expWeeklyLimit = Math.max(1, Number(settings.expWeeklyLimit || "5000"));
  const expPerAttempt = Math.max(1, Number(settings.expPerAttempt || "20"));
  const store = useStore("data");
  store.weekly = store.weekly || { expGained: 0, attempts: 0 };
  store.nextWeek = store.nextWeek || getNextMonday4AM().getTime();
  if (Date.now() >= store.nextWeek) {
    log.info("新的一周，重置本周经验值数据");
    store.weekly = { expGained: 0, attempts: 0 };
    store.nextWeek = getNextMonday4AM().getTime();
  }
  if (store.weekly.expGained >= expWeeklyLimit) {
    if (force) {
      log.warn("本周获取经验值已达上限，强制执行");
    } else {
      log.warn("本周获取经验值已达上限，跳过执行");
      return;
    }
  }
  try {
    const expRemain = expWeeklyLimit - store.weekly.expGained;
    let attempts = Math.ceil(
      (expRemain > 0 ? expRemain : expWeeklyLimit) / expPerAttempt
    );
    if (thisAttempts > 0) attempts = thisAttempts;
    for (let i = 0; i < attempts; i++) {
      log.info(
        "[{c}/{t}]: 开始本周第 {num} 次奇域挑战...",
        i + 1,
        attempts,
        store.weekly.attempts + 1
      );
      await enterRoom(room);
      await startGame();
      store.weekly.attempts += 1;
      store.weekly.expGained += expPerAttempt;
      if (store.weekly.expGained >= expWeeklyLimit && !force) {
        log.warn("本周获取经验值已达上限，停止执行");
        break;
      }
    }
  } catch (e) {
    log.error("脚本执行出错: {error}", { error: e.message || e });
    await genshin.returnMainUi();
  }
  if (goToTeyvat) {
    await goBackToTeyvat();
  }
})();
