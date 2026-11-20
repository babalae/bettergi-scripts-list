// 圣遗物快速分解（design §3.7）——用途：把背包里 ≤ 星级的圣遗物一次性「快速分解」掉。
//
// **只做一件事**：调用即执行一次分解，**不判断该不该拆**（时机与条件归调用方）。
// **不碰副本任务**：秘境 / 幽境一律 `AutoArtifactSalvage = false`，分解只在这里发生。
// 流程照抄本体 0.66.0 `AutoArtifactSalvageTask` 的快速路径（`javaScript == null`），
// 只做快速分解，不做 5 星逐个筛选（那需要逐格图标识别 + ONNX 模型，收益不成正比）。
//
// 界面九步：回主界面 → 开背包圣遗物页 → 分解 → 快速选择 → 取消高于星级的档 →
// 白确认 → 分解确认 → 黑窗确认 → ESC 回主界面。
//
// 三处经验来自同目录脚本 `AAA-Artifacts-Bulk-Supply`（狗粮，实机跑过）：
//   ① 每一步**轮询等待**，不是截一次图找不到就失败（界面有动画）；
//   ② 进背包后可能弹「物品过期」提示，先点掉再找页签。判据与本体同源：认提示框左下角
//      那颗星（`PromptDialogLeftBottomStar`），白确认只在上 80% 里找——直接在下半屏找按钮
//      会把「快速选择」面板的确认按钮一起点上；
//   ③ 点完按钮把鼠标挪开，免得悬停提示框盖住下一处要 OCR 的地方。
//
// 失败处理照本体分两档，不是一律报错：
//   · **选择阶段**（开背包 / 分解按钮 / 快速选择 / 星级档）没找到 → 终止，`ok:false`
//     （本体这几处也是 `LogError` + `return`）；
//   · **确认阶段**（快速选择的白确认、最后的黑窗确认）没找到 → 记日志后继续，不算失败
//     （本体 `if (IsExist()) Click;` 后无条件 `Delay`，黑窗失败只 `LogInformation`）。
//     理由：走到那一步动作已经提交，按钮不在多半是动画没出来；判失败会让通知里的「失败」
//     不可信，用户重跑一次才发现早拆完了。

/**
 * 安全读取 BGI 集合的长度。
 *
 * `findMulti` 的结果在不同版本给 `count` / `Count` / `length`（`bettergi.d.ts` 声明是
 * `Region[]`，但封送的若是 .NET `List` 就只剩 `Count`）。直接读 `.count` 换版后会静默变成
 * 0 次循环——等于「没找到」，而分解九步任何一步失败都只报同一句话，不能再让这种静默混进来。
 *
 * 与 `resinReader/utils.js` 的同名函数逐行一致，**但故意不 import**：`salvage` 按分层约定
 * 不依赖 `resinReader`（reference.md §4），而那边是照搬上游、会被整体覆盖的模块——上游下次
 * 换掉 `utils.js` 就会把这里带崩。这函数只有十几行，各自维护的代价小于跨层依赖。
 */
function listCount(list) {
  if (!list) return 0;
  const keys = ["count", "Count", "length"];
  for (const key of keys) {
    try {
      const value = list[key];
      if (typeof value === "number") return value;
    } catch (e) {
      // 该属性不存在，试下一个
    }
  }
  return 0;
}

/** 模板路径（相对脚本根目录），与游戏 `Assets` 里 `1920x1080` 那套同名 */
const TPL = {
  bagChecked: "assets/icon/bag_artifact_checked.png",
  bagUnchecked: "assets/icon/bag_artifact_unchecked.png",
  salvage: "assets/icon/btn_artifact_salvage.png",
  whiteConfirm: "assets/icon/btn_white_confirm.png",
  salvageConfirm: "assets/icon/btn_artifact_salvage_confirm.png",
  blackConfirm: "assets/icon/btn_black_confirm.png",
  // 提示框左下角那颗星：本体 `Bv.IsInPromptDialog` 认的就是它（`PromptDialogLeftBottomStar`）
  promptStar: "assets/icon/prompt_dialog_left_bottom_star.png"
};

/** 模板匹配阈值：这几个按钮都是唯一图形，0.8 足够稳 */
const THRESHOLD = 0.8;

/** 轮询参数：找元素最长等 3 秒，100ms 一次 */
const WAIT_ELEM = { timeout: 3000, interval: 100 };

/** 各步固定等待（毫秒）。照本体取值：界面切换 800–1200，动画 1500 */
const WAIT = {
  ui: 600,
  bagOpen: 1200,
  tabSwitch: 800,
  click: 500,
  panel: 1000,
  quickSelect: 1500,
  dialog: 400
};

/** 懒加载的模板缓存：同一次分解里只读一次盘，结束时统一释放（resinReader 的 disposeResources 同款口径） */
const mats = {};

function mat(key) {
  if (!mats[key]) {
    const path = TPL[key];
    if (!path) throw new Error(`没有登记模板「${key}」`);
    mats[key] = file.readImageMatSync(path);
  }
  return mats[key];
}

function disposeMats() {
  for (const key of Object.keys(mats)) {
    try {
      if (mats[key] && typeof mats[key].dispose === "function") mats[key].dispose();
    } catch (e) {
      // 释放失败不影响结果
    }
    delete mats[key];
  }
}

/**
 * 识别结果释放：与 `resinReader` 同口径（那边叫 `safeDispose`）——`image` 与从它取出来的
 * 结果分属两个对象，只丢前者等于漏了后者。失败不抛：结果可能只是坐标结构体，没有 dispose
 * 就跳过，不影响分解主流程。
 */
function release(o) {
  try {
    if (o && typeof o.dispose === "function") o.dispose();
  } catch (e) {
    // 释放失败不影响结果
  }
}

/** 比例区域 → 像素矩形（截图尺寸每次都按实际取，兼容非 1080p） */
function rectPx(image, area) {
  const a = area || { x: 0, y: 0, w: 1, h: 1 };
  return {
    x: Math.round(image.width * a.x),
    y: Math.round(image.height * a.y),
    w: Math.round(image.width * a.w),
    h: Math.round(image.height * a.h)
  };
}

/**
 * 轮询等模板出现，命中就点。
 * @param key 模板键
 * @param area 可选的像素矩形 `{x,y,w,h}`，缺省全图
 * @param timeout 毫秒，默认 3000
 */
async function clickTemplate(key, area, timeout) {
  const end = Date.now() + (timeout || WAIT_ELEM.timeout);
  for (;;) {
    const image = captureGameRegion();
    let r = null;
    try {
      const roi = rectPx(image, area);
      const ro = area
        ? RecognitionObject.templateMatch(mat(key), roi.x, roi.y, roi.w, roi.h)
        : RecognitionObject.templateMatch(mat(key));
      ro.threshold = THRESHOLD;
      r = image.find(ro);
      if (r && !r.isEmpty()) {
        r.click();
        return true;
      }
    } finally {
      release(r);
      image.dispose();
    }
    if (Date.now() >= end) return false;
    await sleep(WAIT_ELEM.interval);
  }
}

/** 只判存在（点都不点），同样带轮询 */
async function hasTemplate(key, area, timeout) {
  const end = Date.now() + (timeout || WAIT_ELEM.timeout);
  for (;;) {
    const image = captureGameRegion();
    let r = null;
    try {
      const roi = rectPx(image, area);
      const ro = area
        ? RecognitionObject.templateMatch(mat(key), roi.x, roi.y, roi.w, roi.h)
        : RecognitionObject.templateMatch(mat(key));
      ro.threshold = THRESHOLD;
      r = image.find(ro);
      if (r && !r.isEmpty()) return true;
    } finally {
      release(r);
      image.dispose();
    }
    if (Date.now() >= end) return false;
    await sleep(WAIT_ELEM.interval);
  }
}

/**
 * 在比例区域里轮询 OCR，命中任一关键字就点。
 * @param keywords 关键字数组（比较时去掉空白）
 * @param area `{ x, y, w, h }` 比例（0–1），缺省整屏
 */
async function clickText(keywords, area, timeout) {
  const end = Date.now() + (timeout || WAIT_ELEM.timeout);
  for (;;) {
    const image = captureGameRegion();
    let hit = null;
    try {
      const r = rectPx(image, area);
      const ro = RecognitionObject.ocr(r.x, r.y, r.w, r.h);
      const list = image.findMulti(ro);
      const n = listCount(list);
      for (let i = 0; i < n; i++) {
        const item = list[i];
        const text = String(item.text || "").replace(/\s/g, "");
        for (const k of keywords) {
          if (text.indexOf(k) !== -1) {
            item.click();
            hit = item;   // 命中项要留着给 finally 释放（集合本身不丢，与 resinReader 一致）
            return true;
          }
        }
      }
    } finally {
      release(hit);
      image.dispose();
    }
    if (Date.now() >= end) return false;
    await sleep(WAIT_ELEM.interval);
  }
}

/** 点完把鼠标挪开一点，免得悬停提示框盖住下一步要识别的地方（相对移动，不吃分辨率） */
async function parkMouse() {
  try {
    moveMouseBy(0, -200);
  } catch (e) {
    // 移不动不影响点击流程
  }
  await sleep(WAIT.click);
}

/**
 * 提示框里白确认按钮的搜索范围：画面上 80%（本体 `OpenInventory` 传的就是
 * `Rect(0, 0, w, h - h*0.2)`）。**不能放到下半屏**：快速选择面板的确认按钮在更下面，
 * 一起搜进来就会误点。
 */
const PROMPT_CONFIRM_RECT = { x: 0, y: 0, w: 1, h: 0.8 };

/**
 * 屏幕上是不是弹了个提示框（物品过期 / 背包已满 / 队伍变化…）。
 *
 * 判据照本体 `Bv.IsInPromptDialog`：**认提示框左下角那颗星**，不看按钮。
 * 只看按钮的话，快速选择面板、分解确认框一类的白按钮都会被当成提示框。
 */
async function inPromptDialog() {
  return await hasTemplate("promptStar", null, 300);
}

/**
 * 点掉挡在前面的提示框。不是提示框就什么都不做。
 *
 * 本体 `OpenInventory` 的重试循环里也是这两步：先 `IsInPromptDialog`，再
 * `ClickWhiteConfirmButton`；点完 `return false` 让外层重来一轮。这里保持一致，
 * 由 `openArtifactBag` 的循环负责重试。
 *
 * @returns 是否真的点掉了一个提示框（`false` = 本来就没有）
 */
async function dismissPrompt() {
  if (!(await inPromptDialog())) return false;
  const clicked = await clickTemplate("whiteConfirm", PROMPT_CONFIRM_RECT, 800);
  if (!clicked) log.warn("圣遗物分解：已识别提示框，但未找到白色确认按钮");
  else await sleep(WAIT.click);
  return clicked;
}

/**
 * 打开背包并停在「圣遗物」页。
 *
 * 一轮的顺序：已在页内 → 直接返回；有提示框挡着 → 点掉、重来一轮；在别的背包页 → 点页签；
 * 都不是 → 按 B 开一次。提示框排在页签之前，是因为它盖住整个背包时页签根本认不到，
 * 先按 B 只会白按一次。
 */
async function openArtifactBag() {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await hasTemplate("bagChecked", null, 800)) return true;
    if (await dismissPrompt()) continue;
    if (await clickTemplate("bagUnchecked", null, 800)) {
      await sleep(WAIT.tabSwitch);
      if (await hasTemplate("bagChecked", null, 1500)) return true;
      continue;
    }
    // 还没进背包（或界面没起来）：按 B 开一次
    keyPress("B");
    await sleep(WAIT.bagOpen);
  }
  return false;
}

/** 退出：先按 ESC 关掉弹窗/背包，再回主界面。失败只记日志，不抛 */
async function backOut() {
  for (let i = 0; i < 2; i++) {
    try {
      keyPress("ESCAPE");
    } catch (e) {
      break;
    }
    await sleep(WAIT.click);
  }
  try {
    await genshin.returnMainUi();
  } catch (e) {
    log.warn(`圣遗物分解：回主界面失败（不影响结果）：${e && e.message ? e.message : e}`);
  }
}

/** 快速选择页左下角那块（本体 CutLeftBottom(0.25, 0.1)） */
const QUICK_SELECT_RECT = { x: 0, y: 0.9, w: 0.25, h: 0.1 };

/** 星级档选项在左半屏（本体 CutLeft(0.20)） */
const STAR_RECT = { x: 0, y: 0, w: 0.2, h: 1 };

/**
 * 执行一次快速分解。
 * @param opts `{ star, enabled }`
 *   - `star`：快速分解的最大星级（1–4，字符串或数字；空/非法按 4）
 *   - `enabled`：**传 `false` 就什么都不做**——不截图、不加载模板、不回主界面，
 *     直接返回 `action:"skip"`。不传或传其它值一律照常执行
 * @returns `{ ok, action, star, error?, warning? }`
 *   - `action: "done"` 已走到黑窗确认，分解已提交。`warning` 非空表示黑窗按钮没找到
 *     （本体同款口径：多半是卡顿，不代表没拆）
 *   - `action: "nothing"` 走到分解确认时按钮不在（没有可分解的圣遗物）
 *   - `action: "skip"` 调用方关了开关，未执行任何操作
 *   - `ok: false` 选择阶段没找到必需按钮，已退出界面
 */
export async function salvageArtifacts(opts) {
  const o = opts || {};
  const raw = Number(o.star);
  const star = isFinite(raw) && raw >= 1 ? Math.min(4, Math.floor(raw)) : 4;

  // 开关关掉：一个界面操作都不做，也不读模板图
  if (o.enabled === false) {
    return { ok: true, action: "skip", star, error: null };
  }

  const fail = async (error) => {
    await backOut();
    return { ok: false, action: "fail", star, error };
  };

  try {
    // 模板是按 1920×1080 截的：分辨率不符时匹配大概率失败，先留一条日志好排查
    try {
      const probe = captureGameRegion();
      try {
        if (probe.width !== 1920 || probe.height !== 1080) {
          log.warn(`圣遗物分解：截图 ${probe.width}×${probe.height}，模板按 1920×1080 截取，识别可能失败`);
        }
      } finally {
        probe.dispose();
      }
    } catch (e) {
      log.warn(`圣遗物分解：探测分辨率失败（不影响继续）：${e && e.message ? e.message : e}`);
    }

    await genshin.returnMainUi();
    await sleep(WAIT.ui);

    if (!(await openArtifactBag())) return await fail("打开背包的圣遗物页失败");

    await sleep(WAIT.ui);
    if (!(await clickTemplate("salvage"))) {
      return await fail("没找到圣遗物分解按钮（界面未就绪或背包为空）");
    }
    await sleep(WAIT.panel);

    if (!(await clickText(["快速选择"], QUICK_SELECT_RECT))) {
      return await fail("没找到「快速选择」按钮");
    }
    await parkMouse();

    // 5.5 之后快速选择是「反选」：默认勾中 1–4 星，点某一档是取消它。
    // 所以 maxStar = N 时，要从 N+1 一路点到 4（本体同款逻辑）。
    // 与本体唯一的有意差异：本体一次 OCR 拿到全部档位后复用坐标，这里每档重新截图。
    // 原因是面板动画没结束时 OCR 会返回空列表，本体靠固定 500ms 赌时机，这里靠轮询等；
    // 多花的 3 次截图（约 0.3 秒）换的是「动画慢的机器上也能点到」。
    for (let n = star + 1; n <= 4; n++) {
      if (!(await clickText([`${n}星圣遗物`], STAR_RECT))) {
        return await fail(`没找到「${n}星圣遗物」档位，无法排除 ${n} 星`);
      }
      await parkMouse();
    }

    // 本体这里不判失败：`if (quickSelectConfirmBtn.IsExist()) Click;` 之后无条件 `Delay(1500)`。
    // 面板若还开着，下一步的分解确认按钮本来就找不到，自然会落到「没有可分解」。
    if (await clickTemplate("whiteConfirm")) {
      log.info("圣遗物分解：已确认快速选择");
    } else {
      log.warn("圣遗物分解：未找到快速选择确认按钮，继续执行分解确认");
    }
    await sleep(WAIT.quickSelect);

    // 走到这里说明选择已确认：没有分解按钮 = 当前没有可分解的圣遗物，不算失败
    if (!(await clickTemplate("salvageConfirm"))) {
      await backOut();
      log.info("圣遗物分解：未找到分解确认按钮，可能已无待分解圣遗物");
      return { ok: true, action: "nothing", star, error: null };
    }
    await sleep(WAIT.panel);

    // 本体把黑窗确认当二次确认：点完分解确认就算已提交，按钮不在多半是动画没出来，
    // 只记一句日志、仍算完成（`ClickBlackConfirmButton` 失败 → `LogInformation`「可能发生了卡顿」）。
    // 但把这句话带回给调用方：真卡住时通知里看得出「完成」是带着疑问的。
    let warning = null;
    if (await clickTemplate("blackConfirm")) {
      log.info(`圣遗物分解：已完成 ${star} 星圣遗物快速分解`);
      await sleep(WAIT.dialog);
    } else {
      warning = "未找到进行分解按钮，可能发生了卡顿";
      log.warn(`圣遗物分解：${warning}`);
    }

    await backOut();
    return { ok: true, action: "done", star, error: null, warning };
  } catch (e) {
    return await fail(`分解流程异常：${e && e.message ? e.message : e}`);
  } finally {
    // 成功、失败、异常都走到这：模板只服务本次分解，不挂到脚本结束
    disposeMats();
  }
}
