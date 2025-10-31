// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/workflow.js
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

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/asserts.js
var assertRegionAbsent = async (regionProvider, message) => {
  const region = regionProvider();
  if (region != null && region.isExist()) {
    throw new Error(message);
  }
};
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

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/exception.js
var getErrorMessage = (err) => {
  if (err && "message" in err && typeof err.message === "string")
    return err.message;
  return err && typeof err === "object" ? JSON.stringify(err) : "Unknown error";
};
var isHostException = (err) => {
  return err && "hostException" in err;
};

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/file.js
var readLinesSync = (path, options) => {
  const { notBlank = false, notEmpty = false, trim = false, distinct = false } = options || {};
  return file.readTextSync(path).replaceAll("\r\n", "\n").split("\n").filter((line) => (!notBlank || line.trim().length > 0) && (!notEmpty || line.length > 0)).map((line) => trim ? line.trim() : line).reduce((acc, line) => {
    return distinct ? acc.includes(line) ? acc : [...acc, line] : [...acc, line];
  }, []);
};

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/mouse.js
var simulateScroll = async (scrollAmountInClicks, times) => {
  const script = {
    macroEvents: Array(times).fill({ type: 6, mouseX: 0, mouseY: scrollAmountInClicks, time: 0 }),
    info: { name: "", description: "", x: 0, y: 0, width: 1920, height: 1080, recordDpi: 1.5 }
  };
  await keyMouseScript.run(JSON.stringify(script));
};
var mouseScrollDown = (height, algorithm = (h) => Math.floor(h / 18)) => {
  return simulateScroll(-120, algorithm(height));
};
var mouseScrollDownLines = (lines, lineHeight = 175) => {
  return mouseScrollDown(lines * lineHeight);
};

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/ocr.js
var findFirst = (ir, ro, predicate) => {
  const candidates = ir.findMulti(ro);
  for (let i = 0; i < candidates.count; i++) {
    if (predicate(candidates[i]))
      return candidates[i];
  }
  return void 0;
};
var findImageWithinBounds = (path, x, y, w, h, config = {}) => {
  const ir = captureGameRegion();
  try {
    const ro = RecognitionObject.templateMatch(file.readImageMatSync(path), x, y, w, h);
    Object.assign(ro, config);
    return findFirst(ir, ro, (region) => region.isExist());
  } catch (err) {
    log.warn(`${err.message || err}`);
  } finally {
    ir.dispose();
  }
};
var findTextWithinBounds = (text, x, y, w, h, options, config = {}) => {
  const { ignoreCase = true, contains = false } = options || {};
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const ir = captureGameRegion();
  try {
    const ro = RecognitionObject.ocr(x, y, w, h);
    Object.assign(ro, config);
    return findFirst(ir, ro, (region) => {
      const itemText = ignoreCase ? region.text.toLowerCase() : region.text;
      const isMatch = contains ? itemText.includes(searchText) : itemText === searchText;
      return isMatch && region.isExist();
    });
  } catch (err) {
    log.warn(`${err.message || err}`);
  } finally {
    ir.dispose();
  }
};
var findTextWithinListView = async (text, listView, matchOptions, retryOptions, config = {}) => {
  const { x, y, w, h, lineHeight, scrollLines = 1, paddingX = 10, paddingY = 10 } = listView;
  const { maxAttempts = 30, retryInterval = 1e3 } = retryOptions || {};
  const findTargetText = () => findTextWithinBounds(text, x, y, w, h, matchOptions, config);
  let lastTextRegion;
  const isReachedBottom = () => {
    const textRegion = findFirst(captureGameRegion(), RecognitionObject.ocr(x, y, w, h), (region) => {
      return region.isExist() && region.text.trim().length > 0;
    });
    if (textRegion) {
      if (lastTextRegion?.text === textRegion.text && Math.abs(textRegion.y - lastTextRegion.y) < lineHeight) {
        return true;
      } else {
        lastTextRegion = textRegion;
        return false;
      }
    }
    return true;
  };
  const isTextFoundOrBottomReached = await waitForAction(() => findTargetText() != void 0 || isReachedBottom(), async () => {
    moveMouseTo(x + w - paddingX, y + paddingY);
    await mouseScrollDownLines(scrollLines, lineHeight);
  }, { maxAttempts, retryInterval });
  return isTextFoundOrBottomReached ? findTargetText() : void 0;
};

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/game.js
var withGameMetrics = async (w, h, dpi, action) => {
  const [_w, _h, _dpi] = globalThis["getGameMetrics"] ? getGameMetrics() : [];
  try {
    setGameMetrics(w, h, dpi);
    return await action();
  } finally {
    globalThis["getGameMetrics"] && setGameMetrics(_w, _h, _dpi);
  }
};
var openPaimonMenu = async () => {
  await genshin.returnMainUi();
  await assertRegionAppearing(() => findTextWithinBounds("生日", 300, 230, 440, 100), "打开派蒙菜单超时", () => keyPress("ESCAPE"));
};
var openMenuPage = async (name, listView) => {
  await openPaimonMenu();
  const button = await withGameMetrics(1920, 1080, 1.5, async () => {
    const { x = 95, y = 330, w = 670, h = 730, lineHeight = 142 } = listView || {};
    return await findTextWithinListView(name, { x, y, w, h, lineHeight, scrollLines: 2 });
  });
  if (!button)
    throw new Error(`搜索菜单页面 ${name} 失败`);
  await assertRegionDisappearing(() => findTextWithinBounds(name, button.x, button.y, button.width, button.height), `打开菜单页面 ${name} 超时`, () => {
    button.click();
  });
};
var navigateToTab = async (condition, options) => {
  const { tabIconWidth = 96, verticalOffset = 540, paddingLeft = 72, paddingRight = 72, backwards = false, retryInterval = 1e3 } = options || {};
  const attempts = Math.floor(options?.maxAttempts ?? 1920 / tabIconWidth);
  for (let i = 0; i < attempts; i++) {
    if (i === 0 && condition())
      return true;
    click(backwards ? paddingLeft : 1920 - paddingRight, verticalOffset);
    await sleep(retryInterval);
    if (condition())
      return true;
  }
  return false;
};

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/misc.js
var shuffleArray = (array) => {
  const shuffled = [...array];
  let i = shuffled.length;
  while (i) {
    const j = Math.floor(Math.random() * i--);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
var deepMerge = (...objects) => {
  const isPlainObject = (input) => input?.constructor === Object;
  return objects.reduce((result, obj) => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const recursive = isPlainObject(acc[key]) && isPlainObject(value);
      acc[key] = recursive ? deepMerge(acc[key], value) : value;
      return acc;
    }, result);
  }, {});
};

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/store.js
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
var useStoreWithDefaults = (name, defaults) => {
  const store = useStore(name);
  Object.assign(store, deepMerge(defaults, store));
  return store;
};

// node_modules/.pnpm/@bettergi+utils@0.1.11/node_modules/@bettergi/utils/dist/time.js
var getNextDay4AM = () => {
  const now = /* @__PURE__ */ new Date();
  const result = new Date(now);
  result.setHours(4, 0, 0, 0);
  const daysUntilNextDay = now.getHours() < 4 ? 0 : 1;
  result.setDate(now.getDate() + daysUntilNextDay);
  return result;
};

// src/friends.ts
var readFriendsFromFile = (filePath, shuffle) => {
  log.info("从文件中读取好友UID列表: {path}", filePath);
  const friends = readLinesSync(filePath, {
    notBlank: true,
    trim: true,
    distinct: true
  }).filter((line) => Number.isInteger(+line));
  return shuffle ? shuffleArray(friends) : friends;
};
//! -------------------------------- 定义区域开始 --------------------------------
//! 标题 [好友]
var findFriendsTitle = () => findTextWithinBounds("好友", 0, 0, 400, 96, { contains: true });
//! 标题 [添加好友]
var findAddFriendsTitle = () => findTextWithinBounds("添加好友", 0, 0, 400, 96, { contains: true });
//! 输入框 [清除] 按钮
var findClearBtn = () => findTextWithinBounds("清除", 1440, 96, 120, 85);
//! 输入框 [搜索] 按钮
var findSearchBtn = () => findTextWithinBounds("搜索", 1585, 96, 335, 85);
//! 玩家信息界面 [等级]，兼容 「千星奇域」
var findLevelText = () => findTextWithinBounds("等级", 425, 340, 490, 200, { contains: true });
//! 玩家信息界面 [添加好友] 按钮，兼容 「千星奇域」
var findAddFriendBtn = () => findTextWithinBounds("添加好友", 690, 550, 970, 305, { contains: true });
//! 玩家信息界面 [勋章]
var findMedalIcon = (medal) => {
  const medalFile = `assets/勋章/${medal}.png`;
  return findImageWithinBounds(medalFile, 400, 430, 525, 450, {
    threshold: 0.86,
    use3Channels: true
  });
};
//! 游戏提示 [UID不存在]
var findNotExistTip = () => findTextWithinBounds("不存在", 510, 180, 900, 60, { contains: true });
//! 游戏提示 [该玩家好友申请列表已达上限]
var findMaxedTip = () => findTextWithinBounds("上限", 510, 180, 900, 60, { contains: true });
//! 游戏提示 [添加好友过于频繁]
var findThrottledTip = () => findTextWithinBounds("频繁", 510, 180, 900, 60, { contains: true });
//! 关闭玩家信息界面 [点击位置]
var closeUserInfoCardClick = () => click(78, 48);
//! -------------------------------- 定义区域结束 --------------------------------
var openAddFriendsPage = async () => {
  //! 打开 [好友] 界面
  if (findAddFriendsTitle()) {
    log.info("当前已在 [好友] 界面");
  } else {
    log.info("打开 [好友] 界面...");
    await assertRegionAppearing(
      findFriendsTitle,
      "打开好友界面超时",
      async () => {
        await genshin.returnMainUi();
        await openMenuPage("好友");
      }
    );
  }
  //! 切换到 [添加好友] 界面
  if (findAddFriendsTitle()) {
    log.info("当前已在 [添加好友] 界面");
  } else {
    log.info("打开 [添加好友] 界面...");
    const ok = await navigateToTab(() => findAddFriendsTitle() !== void 0);
    if (!ok) throw new Error("打开添加好友界面超时");
  }
};
var searchFriendByUid = async (uid) => {
  await assertRegionAppearing(findLevelText, "搜索好友超时", async () => {
    //! 清除输入框
    findClearBtn()?.click();
    //! 点击输入框焦点
    const searchBtn = findSearchBtn();
    if (searchBtn) click(960, Math.round(searchBtn.y + searchBtn.height / 2));
    //! 粘贴UID
    await assertRegionAppearing(findClearBtn, "粘贴UID输入框超时", () => {
      inputText(uid);
    });
    //! 点击搜索按钮（输入框中需有内容）
    if (searchBtn && findClearBtn()) {
      searchBtn.click();
      await sleep(600);
      await assertRegionAbsent(findNotExistTip, "UID不存在");
    }
  });
};
var addFriendByUid = async (uid, imaginariumTheater, stygianOnslaught) => {
  const closeUserInfoCard = async () => {
    await assertRegionDisappearing(
      findLevelText,
      "返回添加好友界面超时",
      closeUserInfoCardClick
    );
  };
  log.info("搜索好友: {uid} ...", uid);
  try {
    await searchFriendByUid(uid);
  } catch (err) {
    if (isHostException(err)) throw err;
    log.warn("搜索好友 {uid} 失败: {err}", uid, getErrorMessage(err));
    await closeUserInfoCard();
    return { invalid: true };
  }
  log.info("添加好友: {uid} ...", uid);
  if (findAddFriendBtn()) {
    //! 「幻想真境剧诗」通关限制
    const imaginariumTheaterUnqualified = (() => {
      if (!imaginariumTheater) return false;
      const modes = ["困难模式", "卓越模式", "月谕模式"];
      const index = modes.indexOf(imaginariumTheater);
      return index >= 0 && !modes.slice(index).some((mode) => findMedalIcon(`幻想真境剧诗/${mode}`));
    })();
    if (imaginariumTheaterUnqualified) {
      log.warn(
        "未满足「幻想真境剧诗」最低通关 {limit} 限制，本次运行跳过添加",
        imaginariumTheater
      );
      await closeUserInfoCard();
      return { unqualified: true };
    }
    //! 「幽境危战」通关限制
    const stygianOnslaughtUnqualified = (() => {
      if (!stygianOnslaught) return false;
      const difficulties = ["险恶难度", "无畏难度", "绝境难度"];
      const index = difficulties.indexOf(stygianOnslaught);
      return index >= 0 && !difficulties.slice(index).some((difficulty) => findMedalIcon(`幽境危战/${difficulty}`));
    })();
    if (stygianOnslaughtUnqualified) {
      log.warn(
        "未满足「幽境危战」最低通关 {limit} 限制，本次运行跳过添加",
        stygianOnslaught
      );
      await closeUserInfoCard();
      return { unqualified: true };
    }
    //! 点击 [添加好友] 按钮
    await assertRegionDisappearing(findAddFriendBtn, "添加好友超时", () => {
      findAddFriendBtn()?.click();
    });
  }
  //! 等待提示信息出现
  return sleep(600).then(() => ({
    throttled: findThrottledTip() !== void 0,
    maxed: findMaxedTip() !== void 0
  })).finally(closeUserInfoCard);
};

// main.ts
(async function() {
  //! 初始化脚本环境
  setGameMetrics(1920, 1080, 1.5);
  await genshin.returnMainUi();
  //! 读取脚本设置
  const s_preset = settings.preset || "官服-藏龙卧虎.list";
  const s_file = settings.file || s_preset;
  const s_shuffle = settings.shuffle ?? true;
  const s_imaginariumTheater = settings.imaginariumTheater || "不限制";
  const s_stygianOnslaught = settings.stygianOnslaught || "不限制";
  const s_quota = Math.max(1, Number(settings.quota || "20"));
  const s_force = settings.force ?? false;
  //! 创建数据存储代理（store/data.json）
  const store = useStoreWithDefaults("data", {});
  //! -------------------------------- 脚本主逻辑开始 --------------------------------
  try {
    //! 从文件中读取玩家UID列表
    const friends = readFriendsFromFile(`assets/${s_file}`, s_shuffle);
    //! 获取/创建数据分段，使用文件名作为key值
    const segment = store[s_file] ??= {
      daily: { attempts: 0, nextDay: getNextDay4AM().getTime() },
      history: { added: [] }
    };
    //! 筛除已经尝试添加过的UID
    const uids = friends.filter((uid) => !segment.history.added.includes(uid));
    if (uids.length === 0) {
      log.warn("清单中没有新的好友可添加，脚本结束运行");
      return;
    }
    //! 重置每日数据
    if (Date.now() >= segment.daily.nextDay) {
      segment.daily.attempts = 0;
      segment.daily.nextDay = getNextDay4AM().getTime();
    }
    //! 迭代添加好友
    let attemptCount = 0;
    let addedCount = 0;
    for (let i = 0; i < uids.length; i++) {
      try {
        const attempts = s_force ? attemptCount : segment.daily.attempts;
        if (attempts >= s_quota) {
          log.info("今日好友申请已达上限，脚本结束运行");
          break;
        }
        log.info(
          "[{at}/{qt}/{rm}] 添加好友: {uid} ...",
          attempts + 1,
          s_quota,
          uids.length - addedCount,
          uids[i]
        );
        //! 打开添加好友页面
        await openAddFriendsPage();
        //! 添加好友
        const result = await addFriendByUid(
          uids[i],
          s_imaginariumTheater,
          s_stygianOnslaught
        );
        //! 更新脚本数据：每日尝试次数
        if (!result.invalid && !result.unqualified && !result.throttled && !result.maxed) {
          attemptCount += 1;
          segment.daily.attempts += 1;
        }
        //! 更新脚本数据：历史添加列表
        if (!result.unqualified && !result.throttled) {
          addedCount += 1;
          segment.history.added.push(uids[i]);
        }
        //! 提示操作频繁，等待冷却
        if (result.throttled) {
          log.info("操作频繁，等待 {s} 秒后继续...", 60);
          await sleep(60 * 1e3);
        }
      } catch (err) {
        if (isHostException(err)) throw err;
        log.warn("添加好友 {uid} 失败: {err}", uids[i], getErrorMessage(err));
      }
    }
  } finally {
    await genshin.returnMainUi();
  }
})();
