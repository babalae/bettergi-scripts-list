import paimon from '../assets/imgs/paimon_menu.png';
import girl_moon from '../assets/imgs/girl_moon.png';
import primogem from '../assets/imgs/primogem.png';
import welkin_moon_logo from '../assets/imgs/welkin_moon_logo.png';

/**
 * 获取图片 Mat（支持单路径 / 路径数组）
 *
 * @param {string|string[]} path 图片路径或路径数组
 * @returns {Mat|Mat[]} OpenCV Mat 或 Mat 数组
 */
function getImgMat(path) {
  if (path == null) {
    throw new Error('getImgMat: path 不能为空');
  }

  // 数组形式
  if (Array.isArray(path)) {
    return path.map((p, index) => {
      if (typeof p !== 'string' || !p) {
        throw new Error(`getImgMat: path[${index}] 不是有效字符串`);
      }
      return file.readImageMatSync(p);
    });
  }

  // 单个路径
  if (typeof path !== 'string') {
    throw new Error('getImgMat: path 必须是字符串或字符串数组');
  }

  return file.readImageMatSync(path);
}

/**
 * 通用找图/找RO（支持图片文件路径、Mat）
 * @param {string|Mat} target 图片路径或已构造的 Mat
 * @param {number} [x=0] 识别区域左上角 X
 * @param {number} [y=0] 识别区域左上角 Y
 * @param {number} [w=1920] 识别区域宽度
 * @param {number} [h=1080] 识别区域高度
 * @param {number} [timeout=1000] 识别时间上限（毫秒）
 * @param {number} [interval=50] 每次识别之间的等待间隔（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
async function findImg(
  target,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  timeout = 1000,
  interval = 50
) {
  const ro =
    typeof target === 'string'
      ? RecognitionObject.TemplateMatch(
        file.readImageMatSync(target),
        x, y, w, h
      )
      : RecognitionObject.TemplateMatch(
        target,
        x, y, w, h
      );

  const start = Date.now();

  while (Date.now() - start <= timeout) {
    const gameRegion = captureGameRegion();
    try {
      const res = gameRegion.find(ro);
      if (!res.isEmpty()) {
        return res;
      }
    } catch (e) {
      log.error(e.toString());
    } finally {
      gameRegion.dispose();
    }

    await sleep(interval);
  }

  return null;
}

/**
 * 通用找图并点击（支持图片文件路径、Mat）
 * @param {string|Mat} target 图片路径或已构造的 Mat
 * @param {number} [x=0] 识别区域左上角 X
 * @param {number} [y=0] 识别区域左上角 Y
 * @param {number} [w=1920] 识别区域宽度
 * @param {number} [h=1080] 识别区域高度
 * @param {number} [timeout=1000] 识别时间上限（毫秒）
 * @param {number} [interval=50] 每次识别之间的等待间隔（毫秒）
 * @param {number} [preClickDelay=50] 点击前等待时间（毫秒）
 * @param {number} [postClickDelay=50] 点击后等待时间（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
async function findImgAndClick(
  target,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  timeout = 1000,
  interval = 50,
  preClickDelay = 50,
  postClickDelay = 50
) {
  const ro =
    typeof target === 'string'
      ? RecognitionObject.TemplateMatch(
        file.readImageMatSync(target),
        x, y, w, h
      )
      : RecognitionObject.TemplateMatch(
        target,
        x, y, w, h
      );

  const start = Date.now();

  while (Date.now() - start <= timeout) {
    const gameRegion = captureGameRegion();
    try {
      const res = gameRegion.find(ro);
      if (!res.isEmpty()) {
        await sleep(preClickDelay);
        res.click();
        await sleep(postClickDelay);
        return res;
      }
    } finally {
      gameRegion.dispose();
    }

    await sleep(interval);
  }

  return null;
}

/**
 * 通用找文本（OCR）
 * @param {string|string[]} text 目标文本（单个文本或文本列表，列表时需全部匹配）
 * @param {number} [x=0] OCR 区域左上角 X
 * @param {number} [y=0] OCR 区域左上角 Y
 * @param {number} [w=1920] OCR 区域宽度
 * @param {number} [h=1080] OCR 区域高度
 * @param {number} [attempts=5] OCR 尝试次数
 * @param {number} [interval=50] 每次 OCR 之间的等待间隔（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
async function findText(
  text,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  attempts = 5,
  interval = 50
) {
  const keywords = (Array.isArray(text) ? text : [text])
    .map(t => t.toLowerCase());

  for (let i = 0; i < attempts; i++) {
    const gameRegion = captureGameRegion();
    try {
      const ro = RecognitionObject.Ocr(x, y, w, h);
      const results = gameRegion.findMulti(ro);

      for (let j = 0; j < results.count; j++) {
        const res = results[j];
        if (!res.isExist() || !res.text) continue;

        const ocrText = res.text.toLowerCase();
        const matched = keywords.every(k => ocrText.includes(k));
        if (matched) {
          return res;
        }
      }
    } finally {
      gameRegion.dispose();
    }

    await sleep(interval);
  }

  return null;
}

/**
 * 通用找文本并点击（OCR）
 * @param {string|string[]} text 目标文本（单个文本或文本列表，列表时需全部匹配）
 * @param {number} [x=0] OCR 区域左上角 X
 * @param {number} [y=0] OCR 区域左上角 Y
 * @param {number} [w=1920] OCR 区域宽度
 * @param {number} [h=1080] OCR 区域高度
 * @param {number} [attempts=5] OCR 尝试次数
 * @param {number} [interval=50] 每次 OCR 之间的等待间隔（毫秒）
 * @param {number} [preClickDelay=50] 点击前等待时间（毫秒）
 * @param {number} [postClickDelay=50] 点击后等待时间（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
async function findTextAndClick(
  text,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  attempts = 5,
  interval = 50,
  preClickDelay = 50,
  postClickDelay = 50
) {
  const keyword = text.toLowerCase();

  for (let i = 0; i < attempts; i++) {
    const gameRegion = captureGameRegion();
    try {
      const ro = RecognitionObject.Ocr(x, y, w, h);
      const results = gameRegion.findMulti(ro);

      for (let j = 0; j < results.count; j++) {
        const res = results[j];
        if (
          res.isExist() &&
          res.text &&
          res.text.toLowerCase().includes(keyword)
        ) {
          await sleep(preClickDelay);
          res.click();
          await sleep(postClickDelay);
          return res;
        }
      }
    } finally {
      gameRegion.dispose();
    }

    await sleep(interval);
  }

  return null;
}

/**
 * 执行操作直到图片出现
 * @param {string|Mat} target 目标图片路径或 Mat
 * @param {() => Promise<void>} action 执行的操作函数
 * @param {number} [x=0] 识别区域左上角 X
 * @param {number} [y=0] 识别区域左上角 Y
 * @param {number} [w=1920] 识别区域宽度
 * @param {number} [h=1080] 识别区域高度
 * @param {number} [timeout=5000] 超时时间（毫秒）
 * @param {number} [interval=50] 操作和识别间隔（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
async function waitUntilImgAppear(
  target,
  action,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  timeout = 5000,
  interval = 50
) {
  const start = Date.now();

  while (Date.now() - start <= timeout) {
    await action();
    const res = await findImg(target, x, y, w, h, interval);
    if (res) return res;
    await sleep(interval);
  }

  return null;
}

/**
 * 执行操作直到图片消失
 * @param {string|Mat} target 目标图片路径或 Mat
 * @param {() => Promise<void>} action 执行的操作函数
 * @param {number} [x=0] 识别区域左上角 X
 * @param {number} [y=0] 识别区域左上角 Y
 * @param {number} [w=1920] 识别区域宽度
 * @param {number} [h=1080] 识别区域高度
 * @param {number} [timeout=5000] 超时时间（毫秒）
 * @param {number} [interval=50] 操作和识别间隔（毫秒）
 *
 * @returns
 * - true: 图片已消失, false: 超时
 */
async function waitUntilImgDisappear(
  target,
  action,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  timeout = 5000,
  interval = 50
) {
  const start = Date.now();

  while (Date.now() - start <= timeout) {
    await action();
    const res = await findImg(target, x, y, w, h, interval);
    if (!res) return true;
    await sleep(interval);
  }

  return false;
}

/**
 * 执行操作直到文本出现
 * @param {string|string[]} text 目标文本（单个文本或文本列表，列表时需全部匹配）
 * @param {() => Promise<void>} action 执行的操作函数
 * @param {number} [x=0] OCR 区域左上角 X
 * @param {number} [y=0] OCR 区域左上角 Y
 * @param {number} [w=1920] OCR 区域宽度
 * @param {number} [h=1080] OCR 区域高度
 * @param {number} [attempts=5] OCR 尝试次数
 * @param {number} [interval=50] 操作和识别间隔（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
async function waitUntilTextAppear(
  text,
  action,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  attempts = 5,
  interval = 50
) {
  const start = Date.now();

  while (Date.now() - start <= attempts * interval) {
    await action();

    const res = await findText(text, x, y, w, h, 1, interval);
    if (res) return res;

    await sleep(interval);
  }

  return null;
}

/**
 * 执行操作直到文本消失
 * @param {string} text 目标文本
 * @param {() => Promise<void>} action 执行的操作函数
 * @param {number} [x=0] OCR 区域左上角 X
 * @param {number} [y=0] OCR 区域左上角 Y
 * @param {number} [w=1920] OCR 区域宽度
 * @param {number} [h=1080] OCR 区域高度
 * @param {number} [attempts=5] OCR 尝试次数
 * @param {number} [interval=50] 操作和识别间隔（毫秒）
 *
 * @returns
 * - true: 文本已消失, false: 超时
 */
async function waitUntilTextDisappear(
  text,
  action,
  x = 0,
  y = 0,
  w = 1920,
  h = 1080,
  attempts = 5,
  interval = 50
) {
  const start = Date.now();

  while (Date.now() - start <= attempts * interval) {
    await action();
    const res = await findText(text, x, y, w, h, 1, interval); // 每次只试 1 次 OCR
    if (!res) return true;
    await sleep(interval);
  }

  return false;
}

/**
 * 根据派蒙图标判断当前是否位于主页面
 * @return {Promise<boolean>}
 * - true: 位于主页面, false: 不在主页面
 */
async function isInMainUI() {
  try {
    return !!(await findImg(paimon));
  } catch (e) {
    log.error("判断是否位于主页面时出错", e);
    return false;
  }
}

/**
 * 启动一个后台任务，用于自动月卡点击
 *
 * 使用示例：
 *
 * const watcher = startMonthCardWatcher();
 *
 * // 执行你的操作
 *
 * await watcher.cancel();
 *
 * @return {function} cancel(): 取消监听方法，调用后可以停止检测事件运行（异步）
 */
function startMonthCardWatcher() {
  let cancelled = false;

  const task = (async () => {
    try {
      while (!cancelled) {
        const [girl, common] = await Promise.all([
          findImg(girl_moon),
          findImg(welkin_moon_logo)
        ]);

        if (girl || common) {
          log.info("检测到月卡");
          await sleep(200);
          click(100, 100);
          await sleep(200);
        }

        const stone = await findImg(primogem);
        if (stone) {
          log.info("点击原石");
          while (!cancelled) {
            await sleep(200);
            click(100, 100);
            if (await isInMainUI()) {
              log.info("已进入主页面");
              cancelled = true;
              break;
            }
          }
        }

        await sleep(1000);
      }
    } catch (e) {
      log.error("月卡监听异常", e);
    } finally {
      log.info("月卡监听任务结束");
    }
  })();

  return {
    cancel() {
      cancelled = true;
      return task;
    }
  };
}

/**
 * 打开背包（检测过期物品）
 */
async function openBag() {
  await genshin.returnMainUi();
  keyPress("B");
  await sleep(500);
  const expiredText = await findText("物品过期", 870, 280, 170, 40, 2);
  if (expiredText) {
    log.info("检测到过期物品，关闭弹窗");
    await sleep(500);
    click(980, 750);
  }
  await sleep(50);
}

// /**
//  * 修改分辨率为1080p(会导致截图器重启，任务全部清空，暂时无法使用，仅供参考)
//  * @return {Promise<void>}
//  */
// async function changeTo1080P() {
//   await genshin.returnMainUi();
//   const settings_button = await waitUntilImgAppear(
//     esc_settings,
//     async () => {
//       keyPress("ESCAPE");
//       await sleep(1500);
//     }
//   );
//   if (settings_button) {
//     await sleep(500);
//     await waitUntilImgAppear(
//       page_close_white,
//       async () => {
//         settings_button.click();
//         await sleep(500);
//       }
//     );
//     await sleep(1000);
//   } else {
//     throw new Error("打开菜单超时");
//   }
//   await findTextAndClick("图像", 100, 200, 200, 300, 10);
//   const view_mode = await findText("显示模式", 450, 200, 200, 200, 10);
//   await sleep(500);
//   click(view_mode.x + 1100, view_mode.y + 20);
//   await sleep(200);
//   moveMouseBy(0, 100);
//   await sleep(200);
//   for (let count = 0; count < 20; count++) {
//     verticalScroll(100);
//     await sleep(50);
//   }
//   const text_1080p = await waitUntilTextAppear(
//     ["1920", "1080"],
//     () => {
//       verticalScroll(-100);
//     },
//     1400,
//     300,
//     400,
//     600,
//     20,
//     1000
//   );
//   await sleep(200);
//   log.info("已切换至1080P");
//   click(text_1080p.x + 100, text_1080p.y + 10);
// }

export {
  getImgMat,
  findImg,
  findImgAndClick,
  findText,
  findTextAndClick,
  waitUntilImgAppear,
  waitUntilImgDisappear,
  waitUntilTextAppear,
  waitUntilTextDisappear,
  isInMainUI,
  startMonthCardWatcher,
  openBag
};