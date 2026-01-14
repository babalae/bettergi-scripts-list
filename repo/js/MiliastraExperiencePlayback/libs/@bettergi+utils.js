import { __name } from "./rolldown-runtime.js";

//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/workflow.js
/** 默认最大重试次数 */
const defaultMaxAttempts = 5;
/** 默认重试间隔（毫秒） */
const defaultRetryInterval = 1e3;
/**
 * 等待直到条件满足或超时，期间执行重试操作
 * @param condition 返回条件是否满足的函数
 * @param retryAction 每次重试时执行的操作（可选）
 * @param options 配置选项
 * @returns - true  条件满足
 *          - false 达到最大重试次数
 */
const waitForAction = async (condition, retryAction, options) => {
  const { maxAttempts = defaultMaxAttempts, retryInterval = defaultRetryInterval } = options || {};
  for (let i = 0; i < maxAttempts; i++) {
    if (i === 0 && condition()) return true;
    await retryAction?.();
    await sleep(retryInterval);
    if (condition()) return true;
  }
  return false;
};
/**
 * 等待某个区域出现，期间执行重试操作
 * @param regionProvider 返回区域的函数
 * @param retryAction 每次重试时执行的操作（可选）
 * @param options 配置选项
 * @returns - true  区域出现
 *          - false 达到最大重试次数
 */
const waitForRegionAppear = async (regionProvider, retryAction, options) => {
  return waitForAction(
    () => {
      const region = regionProvider();
      return region != null && region.isExist();
    },
    retryAction,
    options,
  );
};
/**
 * 等待某个区域消失，期间执行重试操作
 * @param regionProvider 返回区域的函数
 * @param retryAction 每次重试时执行的操作（可选）
 * @param options 配置选项
 * @returns - true  区域消失
 *          - false 达到最大重试次数
 */
const waitForRegionDisappear = async (regionProvider, retryAction, options) => {
  return waitForAction(
    () => {
      const region = regionProvider();
      return !region || !region.isExist();
    },
    retryAction,
    options,
  );
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/asserts.js
/**
 * 断言某个区域即将出现，否则抛出异常
 * @param regionProvider 返回区域的函数
 * @param message 错误信息
 * @param retryAction 每次重试时执行的操作（可选）
 * @param options 配置选项
 */
const assertRegionAppearing = async (regionProvider, message, retryAction, options) => {
  if (!(await waitForRegionAppear(regionProvider, retryAction, options))) throw new Error(message);
};
/**
 * 断言某个区域即将消失，否则抛出异常
 * @param regionProvider 返回区域的函数
 * @param message 错误信息
 * @param retryAction 每次重试时执行的操作（可选）
 * @param options 配置选项
 */
const assertRegionDisappearing = async (regionProvider, message, retryAction, options) => {
  if (!(await waitForRegionDisappear(regionProvider, retryAction, options)))
    throw new Error(message);
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/exception.js
/**
 * 获取错误信息字符串
 * @param err 异常对象
 * @returns 错误信息字符串
 */
const getErrorMessage = (err) => {
  if (err && "message" in err && typeof err.message === "string") return err.message;
  return err && typeof err === "object" ? JSON.stringify(err) : "Unknown error";
};
/**
 * 判断是否为主机异常
 * @param err 异常对象
 */
const isHostException = (err) => {
  return err && "hostException" in err;
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/mouse.js
/** 使用回放脚本模拟滚动 */
const simulateScroll = async (wheelDelta, times) => {
  const script = {
    macroEvents: Array(times).fill({
      type: 6,
      mouseX: 0,
      mouseY: wheelDelta,
      time: 0,
    }),
    info: {
      name: "",
      description: "",
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      recordDpi: 1.5,
    },
  };
  await keyMouseScript.run(JSON.stringify(script));
};
/**
 * 鼠标滚轮向下滚动指定高度
 * @param height 滚动高度
 * @param algorithm 自定义滚动算法函数，接收高度参数并返回滚动次数（默认算法为每18像素滚动一次）
 */
const mouseScrollDown = (height, algorithm = (h) => Math.floor(h / 17.9795)) => {
  return simulateScroll(-120, algorithm(height));
};
/**
 * 鼠标滚轮向下滚动指定行数
 * @param lines 滚动行数
 * @param lineHeight 行高（默认值为175像素）
 */
const mouseScrollDownLines = (lines, lineHeight = 175) => {
  return mouseScrollDown(lines * lineHeight);
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/ocr.js
/**
 * 在指定区域内搜索图片
 * @param image 图片路径 或 图片Mat
 * @param x 水平方向偏移量（像素）
 * @param y 垂直方向偏移量（像素）
 * @param w 宽度
 * @param h 高度
 * @param config 识别对象配置
 * @returns 如果找到匹配的图片区域，则返回该区域，否则返回 undefined
 */
const findImageWithinBounds = (image, x, y, w, h, config = {}) => {
  const ir = captureGameRegion();
  try {
    const mat = typeof image === "string" ? file.readImageMatSync(image) : image;
    const ro = RecognitionObject.templateMatch(mat, x, y, w, h);
    if (Object.keys(config).length > 0) Object.assign(ro, config) && ro.initTemplate();
    const region = ir.find(ro);
    return region.isExist() ? region : void 0;
  } catch (err) {
    log.warn(`${err.message || err}`);
  } finally {
    ir.dispose();
  }
};
/**
 * 在图像区域内查找第一个符合条件的识别区域
 * @param ir 图像区域
 * @param ro 识别对象
 * @param predicate 筛选条件
 * @returns 第一个符合条件的识别区域，未找到则返回 undefined
 */
const findFirstRegion = (ir, ro, predicate) => {
  const candidates = ir.findMulti(ro);
  for (let i = 0; i < candidates.count; i++) if (predicate(candidates[i])) return candidates[i];
};
/**
 * 文本匹配
 * @param text 待匹配文本
 * @param searchText 待搜索文本
 * @param options 搜索选项
 * @returns 是否匹配
 */
const textMatch = (text, searchText, options) => {
  const { ignoreCase = true, contains = false } = options || {};
  text = ignoreCase ? text.toLowerCase() : text;
  searchText = ignoreCase ? searchText.toLowerCase() : searchText;
  return contains ? text.includes(searchText) : text === searchText;
};
/**
 * 在指定区域内搜索文本
 * @param text 待搜索文本
 * @param x 水平方向偏移量（像素）
 * @param y 垂直方向偏移量（像素）
 * @param w 宽度
 * @param h 高度
 * @param options 搜索选项
 * @param config 识别对象配置
 * @returns 如果找到匹配的文本区域，则返回该区域，否则返回 undefined
 */
const findTextWithinBounds = (text, x, y, w, h, options, config = {}) => {
  const ir = captureGameRegion();
  try {
    const ro = RecognitionObject.ocr(x, y, w, h);
    if (Object.keys(config).length > 0) Object.assign(ro, config) && ro.initTemplate();
    return findFirstRegion(ir, ro, (region) => {
      return region.isExist() && textMatch(region.text, text, options);
    });
  } catch (err) {
    log.warn(`${err.message || err}`);
  } finally {
    ir.dispose();
  }
};
/**
 * 在列表视图中滚动搜索区域
 * @param condition 查找条件
 * @param listView 列表视图参数
 * @param retryOptions 重试选项
 * @param sampling 区域采样函数，通过采样区域画面变化判断列表是否触底（默认：底半区）
 * @param threshold 采样区域匹配阈值（默认：0.9）
 * @returns 如果找到匹配的区域，则返回该区域，否则返回 undefined
 */
const findWithinListView = async (condition, listView, retryOptions, sampling, threshold = 0.9) => {
  const { x, y, w, h, lineHeight, scrollLines = 1, paddingX = 10, paddingY = 10 } = listView;
  const { maxAttempts = 99, retryInterval = 1200 } = retryOptions || {};
  sampling ??= (r) => r.deriveCrop(1, r.height * 0.5, r.width - 1, r.height * 0.5);
  const captureListViewRegion = () => captureGameRegion().deriveCrop(x, y, w, h);
  const isReachedBottom = (() => {
    let lastCaptured;
    return () => {
      const newRegion = captureListViewRegion();
      if (!newRegion?.isExist()) return true;
      try {
        if (!lastCaptured) return false;
        const oldRegion = sampling(lastCaptured);
        if (!oldRegion?.isExist()) return true;
        const ro = RecognitionObject.templateMatch(oldRegion.srcMat);
        ro.threshold = threshold;
        ro.use3Channels = true;
        ro.initTemplate();
        return newRegion.find(ro)?.isExist();
      } finally {
        lastCaptured = newRegion;
      }
    };
  })();
  let targetRegion;
  await waitForAction(
    () => {
      targetRegion = condition(captureListViewRegion());
      return targetRegion?.isExist() || isReachedBottom();
    },
    async () => {
      moveMouseTo(x + w - paddingX, y + paddingY);
      await sleep(50);
      await mouseScrollDownLines(scrollLines, lineHeight);
    },
    {
      maxAttempts,
      retryInterval,
    },
  );
  if (targetRegion?.isExist()) {
    const { item1, item2 } = targetRegion.convertPositionToGameCaptureRegion(0, 0);
    const scale = genshin.width / 1920;
    const [x$1, y$1] = [
      Math.floor(scale <= 1 ? item1 : item1 / scale),
      Math.floor(scale <= 1 ? item2 : item2 / scale),
    ];
    Object.assign(targetRegion, {
      x: x$1,
      y: y$1,
    });
    return targetRegion;
  }
};
/**
 * 在列表视图中滚动搜索文本
 * @param text 待搜索文本
 * @param listView 列表视图参数
 * @param matchOptions 搜索选项
 * @param retryOptions 重试选项
 * @param config 识别对象配置
 * @param sampling 区域采样函数，通过采样区域画面变化判断列表是否触底（默认：底半区）
 * @param threshold 采样区域匹配阈值（默认：0.9）
 * @returns 如果找到匹配的文本区域，则返回该区域，否则返回 undefined
 */
const findTextWithinListView = async (
  text,
  listView,
  matchOptions,
  retryOptions,
  config = {},
  sampling,
  threshold = 0.9,
) => {
  const ro = RecognitionObject.ocrThis;
  if (Object.keys(config).length > 0) Object.assign(ro, config) && ro.initTemplate();
  return findWithinListView(
    (lvr) => {
      return findFirstRegion(lvr, ro, (region) => {
        return region.isExist() && textMatch(region.text, text, matchOptions);
      });
    },
    listView,
    retryOptions,
    sampling,
    threshold,
  );
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/misc.js
/**
 * 深度合并多个对象
 * @param objects 多个对象
 * @returns 合并后的对象副本
 */
const deepMerge = (...objects) => {
  const isPlainObject = (input) => input?.constructor === Object;
  return objects.reduce((result, obj) => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      acc[key] =
        isPlainObject(acc[key]) && isPlainObject(value) ? deepMerge(acc[key], value) : value;
      return acc;
    }, result);
  }, {});
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/time.js
/**
 * 获取下一个（含当日）凌晨4点的时间
 */
const getNextDay4AM = () => {
  const now = /* @__PURE__ */ new Date();
  const result = new Date(now);
  result.setHours(4, 0, 0, 0);
  const daysUntilNextDay = now.getHours() < 4 ? 0 : 1;
  result.setDate(now.getDate() + daysUntilNextDay);
  return result;
};
/**
 * 获取下一个（含当日）周一凌晨4点的时间
 */
const getNextMonday4AM = () => {
  const now = /* @__PURE__ */ new Date();
  const result = new Date(now);
  result.setHours(4, 0, 0, 0);
  const currentDay = now.getDay();
  const daysUntilNextMonday = currentDay === 1 && now.getHours() < 4 ? 0 : 8 - currentDay;
  result.setDate(now.getDate() + daysUntilNextMonday);
  return result;
};
/**
 * 解析时长
 * @param duration 时长（毫秒）
 */
const parseDuration = (duration) => {
  return {
    h: Math.floor(duration / 36e5),
    m: Math.floor((duration % 36e5) / 6e4),
    s: Math.floor((duration % 6e4) / 1e3),
    ms: Math.floor(duration % 1e3),
  };
};
/**
 * 将时长转换为时钟字符串
 * @param duration 时长（毫秒）
 */
const formatDurationAsClock = (duration) => {
  return Object.values(parseDuration(duration))
    .slice(0, 3)
    .map((num) => String(num).padStart(2, "0"))
    .join(":");
};
/**
 * 将时长转换为可读格式
 * @param duration 时长（毫秒）
 */
const formatDurationAsReadable = (duration) => {
  return Object.entries(parseDuration(duration))
    .filter(([, value]) => value > 0)
    .map(([unit, value]) => `${value}${unit}`)
    .join(" ");
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/progress.js
/** 进度追踪器 */
var ProgressTracker = class {
  total = 0;
  current = 0;
  startTime = Date.now();
  formatter;
  interval;
  lastPrintTime = 0;
  constructor(total, config) {
    const { formatter, interval = 3e3 } = config || {};
    this.total = total;
    this.formatter = formatter || this.defaultFormatter;
    this.interval = interval;
  }
  defaultFormatter = (logger, message, progress) => {
    logger(
      "[🚧 {pct} ⏳ {eta}]: {msg}",
      progress.formatted.percentage.padStart(6),
      progress.current > 0 && progress.elapsed > 0 ? progress.formatted.remaining : "--:--:--",
      message,
    );
  };
  tick(options) {
    const { increment = 1, message, force = false } = options || {};
    this.current = Math.min(this.current + increment, this.total);
    if (message) this.print(message, force);
    return this.current === this.total;
  }
  complete(message) {
    this.current = this.total;
    this.print(message, true);
  }
  reset() {
    this.current = 0;
    this.startTime = Date.now();
    this.lastPrintTime = 0;
  }
  print(message, force = false, logger = log.info) {
    if (force || this.shouldPrint()) {
      this.formatter(logger, message, this.getProgress());
      this.printed();
    }
  }
  shouldPrint() {
    return Date.now() - this.lastPrintTime >= this.interval;
  }
  printed() {
    this.lastPrintTime = Date.now();
  }
  getProgress() {
    const percentage = this.current / this.total;
    const elapsed = Date.now() - this.startTime;
    const average = this.current > 0 ? elapsed / this.current : 0;
    const remaining = (this.total - this.current) * average;
    return {
      current: this.current,
      total: this.total,
      percentage,
      elapsed,
      average,
      remaining,
      formatted: {
        percentage: `${(percentage * 100).toFixed(1)}%`,
        elapsed: formatDurationAsReadable(elapsed),
        average: formatDurationAsReadable(average),
        remaining: formatDurationAsClock(remaining),
      },
    };
  }
};

//#endregion
//#region node_modules/.pnpm/@bettergi+utils@0.1.27/node_modules/@bettergi/utils/dist/store.js
/**
 * 创建一个持久化存储对象，用于管理应用状态数据
 * 该函数会创建一个代理对象，对该对象的所有属性的修改都会自动同步到相应的JSON文件（脚本的 `store` 目录下）中。
 * 支持深层嵌套对象的代理。
 * @param name 存储对象的名称，将作为文件名（不包扩展名）
 */
const useStore = (name) => {
  const filePath = `store/${name}.json`;
  const obj = (() => {
    try {
      if (
        ![...file.readPathSync("store")].map((path) => path.replace(/\\/g, "/")).includes(filePath)
      )
        throw new Error("File does not exist");
      const text = file.readTextSync(filePath);
      return JSON.parse(text);
    } catch {
      return {};
    }
  })();
  const createProxy = (target, parentPath = []) => {
    if (typeof target !== "object" || target === null) return target;
    return new Proxy(target, {
      get: (target$1, key) => {
        const value = Reflect.get(target$1, key);
        return typeof value === "object" && value !== null
          ? createProxy(value, [...parentPath, key])
          : value;
      },
      set: (target$1, key, value) => {
        const success = Reflect.set(target$1, key, value);
        if (success)
          Promise.resolve().then(() => {
            file.writeTextSync(filePath, JSON.stringify(obj, null, 2));
          });
        return success;
      },
      deleteProperty: (target$1, key) => {
        const success = Reflect.deleteProperty(target$1, key);
        if (success)
          Promise.resolve().then(() => {
            file.writeTextSync(filePath, JSON.stringify(obj, null, 2));
          });
        return success;
      },
    });
  };
  return createProxy(obj);
};
/**
 * 创建一个带有默认值的持久化存储对象，用于管理应用状态数据
 * @param name 存储对象的名称，将作为文件名（不包扩展名）
 * @param defaults 默认值数据对象
 */
const useStoreWithDefaults = (name, defaults) => {
  const newStore = useStore(name);
  Object.assign(newStore, deepMerge(defaults, newStore));
  return newStore;
};

//#endregion
export {
  ProgressTracker,
  assertRegionAppearing,
  assertRegionDisappearing,
  findImageWithinBounds,
  findTextWithinBounds,
  findTextWithinListView,
  getErrorMessage,
  getNextDay4AM,
  getNextMonday4AM,
  isHostException,
  useStoreWithDefaults,
  waitForAction,
};
