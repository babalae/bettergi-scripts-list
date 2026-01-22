const attempts = 20; // 最大尝试次数
const interval = 1000; // 每次间隔 ms
const duration = 1000; // 默认点击等待延时

const storePath = "data/store.json"
const runJS = settings.runJS;
const achievementMode = settings.achievementMode;
const starMode = settings.starMode;
const roomID = settings.room || "37135473336";
const starRoomName = settings.starRoomName || "碰碰墙";
const userAttempts = Number(settings.thisAttempts || "0");
const useFixedAttempts = userAttempts > 0;
const weekMaxExp = Number(settings.weekMaxExp || "4000");
const singleExp = Number(settings.singleExp || "270");
let weekTotal = initWeekTotal();

// 获取图片资源
function getImgMat(path) {
  return file.readImageMatSync('assets/' + path + '.png');
}

// 读取存档
function loadWeekData() {
  try {
    const t = file.readTextSync(storePath);
    return JSON.parse(t);
  } catch (_) {
    return null;
  }
}

// 保存存档
function saveWeekData(data) {
  file.writeTextSync(storePath, JSON.stringify(data));
}

// 判断两个时间是否属于同一周
function isSameWeek(t1, t2) {
  const getMonday = (time) => {
    const d = new Date(time);
    const day = d.getDay(); // 0=周日
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  return getMonday(t1) === getMonday(t2);
}

// 初始化或更新 weekTotal
function initWeekTotal() {
  const stored = loadWeekData();
  const calculated = Math.ceil(weekMaxExp / singleExp);
  const now = Date.now();

  // 无存档 -> 初始化
  if (!stored) {
    const data = {
      weekMaxExp,
      singleExp,
      weekTotal: calculated,
      lastRunTime: now
    };
    saveWeekData(data);
    return calculated;
  }

  // 跨周 -> 重置次数
  if (!isSameWeek(stored.lastRunTime, now)) {
    stored.weekTotal = calculated;
    stored.lastRunTime = now;
    saveWeekData(stored);
    log.info("检测到跨周，已重置每周次数");
    return calculated;
  }

  // 配置变化 -> 重算
  if (
      stored.weekMaxExp !== weekMaxExp ||
      stored.singleExp !== singleExp
  ) {
    stored.weekMaxExp = weekMaxExp;
    stored.singleExp = singleExp;
    stored.weekTotal = calculated;
    stored.lastRunTime = now;
    saveWeekData(stored);
    return calculated;
  }

  // 正常情况，仅更新时间
  stored.lastRunTime = now;
  saveWeekData(stored);

  return stored.weekTotal;
}

// 刷完一次 -> 计数 -1
function decreaseWeekTotal() {
  const stored = loadWeekData();
  if (!stored) return;

  stored.weekTotal = Math.max(stored.weekTotal - 1, 0);
  stored.lastRunTime = Date.now();
  saveWeekData(stored);
  weekTotal = stored.weekTotal;
}

// 查找文本
async function findText(text, x, y, w, h, textAttempts = attempts) {
  const searchText = text.toLowerCase();

  for (let i = 0; i < textAttempts; i++) {
    const captureRegion = captureGameRegion();
    const ro = RecognitionObject.ocr(x, y, w, h);
    const results = captureRegion.findMulti(ro);
    captureRegion.dispose();

    for (let j = 0; j < results.count; j++) {
      const region = results[j];
      if (region.isExist() && region.text.toLowerCase().includes(searchText)) {
        return region;
      }
    }

    await sleep(interval);
  }

  return null;
}

// 查找图片
async function findImage(imgMat, x, y, w, h, imgAttempts = attempts) {
  const searchImg = RecognitionObject.TemplateMatch(imgMat, x, y, w, h);

  for (let i = 0; i < imgAttempts; i++) {
    const captureRegion = captureGameRegion();
    const result = captureRegion.find(searchImg);
    captureRegion.dispose();

    if (result.isExist()) {
      return result;
    }

    await sleep(interval);
  }

  return null;
}

// 查找文本并点击
async function findTextAndClick(text, x, y, w, h, textAttempts = attempts) {
  const target = await findText(text, x, y, w, h, textAttempts);
  if (target) {
    await sleep(duration);
    target.click();
  } else {
    log.error("文本{text}查找失败", text);
  }
}

// 查找图片并点击
async function findImageAndClick(path, x, y, w, h, imgAttempts = attempts) {
  const imgMat = getImgMat(path);
  const target = await findImage(imgMat, x, y, w, h, imgAttempts);
  if (target) {
    await sleep(duration);
    target.click();
  } else {
    log.error("图标{path}查找失败", path);
  }
}

// 查找要删除的存档
async function findSaveInList(keyword) {
  const maxScroll = 15;

  for (let i = 0; i < maxScroll; i++) {
    const region = await findText(
      keyword,
      200, 250, 1500, 700,
      1
    );

    if (region) {
      return region;
    }

    // 向下滚动
    moveMouseTo(1800, 500);
    await sleep(100);
    await mouseScrollDown(400);
    await sleep(500);
  }

  return null;
}

// 清除游玩数据
async function deleteSource() {
  if (!achievementMode) return;

  await genshin.returnMainUi();
  log.info("开始自动删除关卡存档");
  await sleep(duration);

  // 打开奇域收藏
  keyPress("VK_B");
  await sleep(duration);

  await findTextAndClick("管理关卡", 960, 0, 960, 100);
  await findTextAndClick("管理", 960, 980, 960, 100);

  // 查找目标存档
  const saveRegion = await findSaveInList(starRoomName);
  if (!saveRegion) {
    log.warn("未找到目标存档，跳过删除");
    await genshin.returnMainUi();
    return;
  }

  // 计算复选框位置
  const sy = saveRegion.y - 30;

  await sleep(300);
  await findImageAndClick("check_box", 0, sy, 1480, saveRegion.height + 70);
  // 删除
  await sleep(duration);
  await findTextAndClick("删除", 960, 980, 960, 100);
  await findTextAndClick("确认", 960, 600, 960, 400);
  await findTextAndClick("确认", 960, 600, 960, 400);

  log.info("关卡存档删除完成");
  await sleep(duration);
  await genshin.returnMainUi();
}

// 进入千星奇域的全部奇域页面
async function enterSourcePage() {
  // 1. 检测是否在房间内，在则退出
  const inRoom = await findText("房间", 1500, 0, 420, 500, 5);
  if (inRoom) {
    keyPress("VK_P");
    await sleep(duration);
    await findImageAndClick("exit_room", 960, 0, 960, 540);
    await findTextAndClick("确认", 960, 600, 960, 400);
    await genshin.returnMainUi();
    keyPress("VK_F6");
  } else {
    keyPress("VK_F6");
  }

  await sleep(duration);
}

// 进入千星奇域的收藏奇域页面
async function enterStarSourcePage() {
  // 1. 检测是否在房间内，在则退出
  const inRoom = await findText("房间", 1500, 0, 420, 500, 5);
  if (inRoom) {
    keyPress("VK_P");
    await sleep(duration);
    await findImageAndClick("exit_room", 960, 0, 960, 540);
    await findTextAndClick("确认", 960, 600, 960, 400);
    await genshin.returnMainUi();
    keyPress("VK_B");
  } else {
    keyPress("VK_F6");
    await sleep(duration);
    await findTextAndClick("收藏", 0, 850, 300, 230);
  }

  await sleep(duration);
}

// 创建关卡
async function createMap() {
  await findTextAndClick("搜索", 1320, 0, 600, 95);
  await findTextAndClick("搜索", 0, 120, 1920, 60);
  inputText(roomID);
  await sleep(1000);
  await findTextAndClick("搜索", 0, 120, 1920, 60);
  await sleep(duration);
  click(355, 365);
  await sleep(duration);
  while (true) {
    const result = await findText("房间", 960, 100, 960, 200, 2);
    if (result) {
      await sleep(duration);
      result.click();
      await sleep(duration);
      break;
    } else {
      const result2 = await findText("大厅", 960, 600, 960, 400, 2);
      if (result2) {
        result2.click();
        await sleep(duration);
      }
    }
  }
  await findText("开始游戏", 960, 540, 960, 540);
  click(770, 275);
  await sleep(duration);
}

// 从收藏创建关卡
async function createStarMap() {
  await findTextAndClick("搜索", 0, 0, 1920, 120);
  inputText(starRoomName);
  await sleep(1000);
  await findTextAndClick("搜索", 0, 0, 1920, 120);
  await sleep(duration);
  click(420, 830);
  await sleep(duration);
  while (true) {
    const result = await findText("房间", 960, 100, 960, 200, 2);
    if (result) {
      await sleep(duration);
      result.click();
      await sleep(duration);
      break;
    } else {
      const result2 = await findText("大厅", 960, 600, 960, 400, 2);
      if (result2) {
        result2.click();
        await sleep(duration);
      }
    }
  }
  await findText("开始游戏", 960, 540, 960, 540);
  click(770, 275);
  await sleep(duration);
}

// 游玩关卡
async function playMap() {
  const stored = loadWeekData();
  const leave = stored ? stored.weekTotal : weekTotal;
  const total = useFixedAttempts ? userAttempts : leave;

  if (starMode) {
    await createStarMap();
  } else {
    await createMap();
  }

  while (true) {
    await sleep(duration);
    const result = await findText("开始游戏", 960, 540, 960, 540, 5);
    if (result) {
      await sleep(duration);
      result.click();
      log.info("开始执行第{i}/{total}次奇域挑战", 1, total);
      await sleep(duration);
    } else {
      await sleep(duration);
      break;
    }
  }
  let firstOutputCount = 0;
  while (true) {
    const whiteText = await findText("空白", 610, 900, 700, 100, 1);
    if (whiteText) {
      await sleep(duration);
      click(610, 950);
    }

    const result = await findText("返回大厅", 960, 540, 960, 540, 1);
    if (result) {
      await sleep(duration);
      result.click();
      await sleep(duration);
      if (!useFixedAttempts) {
        decreaseWeekTotal();
      }
      log.info("本次关卡结束");
      break;
    } else {
      const inRoom = await findText("房间", 1500, 0, 420, 500, 1);
      if (inRoom) {
        break;
      }
      if (firstOutputCount % 16 === 0) {
        log.info("等待本次关卡结束...");
      }
      firstOutputCount++;
      await sleep(interval);
    }
  }

  await deleteSource();

  for (let i = 1; i < total; i++) {
    const inRoom = await findText("房间", 1500, 0, 420, 500);
    if (inRoom) {
      await sleep(duration);
      keyPress("VK_P");
      await sleep(duration);
      while (true) {
        const result = await findText("开始游戏", 960, 540, 960, 540, 1);
        if (result) {
          await sleep(duration);
          result.click();
          log.info("开始执行第{i}/{total}次奇域挑战", i + 1, total);
          await sleep(duration);
          break;
        } else {
          await sleep(duration);
        }
      }
      let outputCount = 0;
      while (true) {
        const whiteText = await findText("空白处", 610, 950, 700, 60, 1);
        if (whiteText) {
          await sleep(duration);
          click(610, 950);
        }
        const result = await findText("返回大厅", 960, 540, 960, 540, 1);
        if (result) {
          await sleep(duration);
          result.click();
          await sleep(duration);
          if (!useFixedAttempts) {
            decreaseWeekTotal();
          }
          log.info("本次关卡结束");
          break;
        } else {
          const inRoom = await findText("房间", 1500, 0, 420, 500, 1);
          if (inRoom) {
            break;
          }
          if (outputCount % 10 === 0) {
            log.info("等待本次关卡结束...");
          }
          outputCount++;
          await sleep(interval);
        }
      }
      await deleteSource();
    }
  }
}

// 退出到提瓦特
async function exitToTeyvat() {
  await genshin.returnMainUi();
  await sleep(duration);
  keyPress("VK_F2");
  await sleep(duration);
  await findTextAndClick("返回", 960, 0, 960, 100);
  await sleep(duration);
  await findTextAndClick("确认", 960, 600, 960, 400);
}

(async function () {
  if (!runJS) {
    log.error("您未同意此脚本的免责声明，请先同意后重新运行此脚本！");
    return;
  }

  await genshin.returnMainUi();

  if (useFixedAttempts) {
    // 手动模式：忽略本周计数
    log.info(
        "已进入指定次数模式，本次将执行{count}次挑战（不计入周进度）",
        userAttempts
    );
  } else {
    // 每周模式
    const stored = loadWeekData();
    const leave = stored.weekTotal;
    const done = Math.ceil(weekMaxExp / singleExp) - leave;

    log.info(
        "本周共需刷取 {total} 次，已刷 {done} 次，剩余 {leave} 次",
        Math.ceil(weekMaxExp / singleExp),
        done,
        leave
    );
  }

  if (starMode) {
    log.info("已使用收藏模式");
    await enterStarSourcePage();
  } else {
    await enterSourcePage();
  }
  await playMap();
  await exitToTeyvat();
})();
