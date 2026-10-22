/// <reference path="bettergi.d.ts" />
/*
 * ============================================================================
 *  MapDisc —— 盖在小地图上的透明圆盘
 * ----------------------------------------------------------------------------
 *  一套「妈宝式」导航：
 *    · 透明叠层盖住左上角小地图，鼠标完全穿透，不挡操作
 *    · 圆环套准小地图外缘，环内是角色朝向指针（视野扇形 + 小箭头）
 *    · 永远只指 tasks.txt 里【第一个没做完的任务】：
 *        - 目标在小地图内 → 盘内红点，位置就是真实相对位置
 *        - 目标在范围外   → 圆环外沿箭头，指方向 + 距离
 *    · 走到任务点自动划掉、指下一个；F9 记当前位置为任务；F8 手动完成
 *
 *  数据流（这是最容易踩坑的部分，写清楚）：
 *    tasks.txt 是一份「任务队列」，一行一个任务，注释掉 = 已完成。
 *    脚本每 2 秒重读一次，永远取第一个未完成的行当目标 ——
 *    文件本身就是进度，重启不会从头再来，也天然支持往队列里插新任务。
 *
 *    getPositionFromMap() 拿玩家世界坐标（主界面，非主界面抛异常），
 *    目标坐标减玩家坐标 → 方位角 β → 屏幕角 φ = β − northAngle → 交给页面画。
 *    页面完全不碰世界坐标，只认「角度 + 距离比例」，所以将来换数据源
 *    （识别小地图图标 / 接官方点位库）只改 computeTarget 一个函数。
 * ============================================================================
 */
(async function () {
  "use strict";

  const SCRIPT_VERSION = "0.4.0";
  const WINDOW_ID = "mapdisc";
  const st = (typeof settings === "undefined" || settings === null) ? {} : settings;

  function num(key, def) {
    const v = st[key];
    if (v === undefined || v === null || v === "") return def;
    const n = Number(v);
    return isFinite(n) ? n : def;
  }
  function bool(key, def) {
    const v = st[key];
    if (v === undefined || v === null) return def;
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "开";
  }
  function str(key, def) {
    const v = st[key];
    if (v === undefined || v === null || v === "") return def;
    return String(v);
  }

  const CFG = {
    // 1080p 基准下的像素值，页面按 innerHeight/1080 自动缩放
    cx: num("discX", 118),
    cy: num("discY", 118),
    r: Math.max(20, num("discR", 104)),
    opacity: Math.min(1, Math.max(0.05, num("discOpacity", 0.55))),
    showRing: bool("showRing", true),
    showHeading: bool("showHeading", true),
    debug: bool("debugHud", true),
    unit: str("angleUnit", "度") === "弧度" ? "rad" : "deg",
    offset: num("angleOffset", 90),
    sign: str("angleSign", "正向") === "反向" ? -1 : 1,
    calibKey: str("hkCalib", "insert"),

    /* ---- 任务队列（永远只指"下一个"）---- */
    mapRange: Math.max(10, num("mapRange", 60)),   // 小地图半径 = 多少米
    northAngle: num("northAngle", -90),            // "北"在世界坐标系里的角度
    showTarget: bool("showTarget", true),
    // 到达判定
    autoDone: bool("autoDone", true),              // 到了就自动划掉、指下一个
    arriveR: Math.max(2, num("arriveR", 8)),       // 多少米内算"到了"
    arriveHoldMs: Math.max(0, num("arriveHoldMs", 1200)),   // 要在范围内待够多久（防路过误判）
    // 热键：记点 / 手动完成
    hkMark: str("hkMark", "f9"),
    hkDone: str("hkDone", "f8"),

    /* ---- 自动识别小地图任务图标（可选，配好模板才开）---- */
    autoDetect: bool("autoDetect", false),        // 用模板匹配找小地图上的任务图标
    autoScore: Math.min(0.99, Math.max(0.5, num("autoScore", 0.75))),  // 匹配分阈值
    hkSample: str("hkSample", "backslash"),       // 按一下存一张小地图截图（做模板用）
  };

  const state = {
    winId: "",
    running: true,
    pageReady: false,
    // 标定用的可变副本（热键改这里，退出标定时写回设置）
    cx: CFG.cx,
    cy: CFG.cy,
    r: CFG.r,
    calib: false,
    // 朝向
    yaw: null,          // 归一化到 0~360 的度
    rawVal: null,       // API 原样返回的值（标定时看它判断单位）
    err: "",
    errLogged: "",
    camOk: 0,
    camFail: 0,
    // 玩家世界坐标
    px: null,
    py: null,
    posErr: "",
    posErrLogged: "",
    posOk: 0,
    startedAt: Date.now(),
    /* 任务队列。
     * 关键约定：tasks[0] 永远是"下一个还没做的任务"，也永远是屏幕上唯一那个点。
     * 做完一个就从文件里注释掉一行、重新解析 —— 不需要"当前索引"这种东西，
     * 因为"第一个未完成的"天然就是当前任务。 */
    tasks: [],
    total: 0,
    tasksText: undefined,
    nearSince: 0,        // 进入到达半径的时刻（0 = 不在范围内）
    doneCoolUntil: 0,    // 刚划掉一个，2.5 秒内不再判到达（防连跳）
    // 自动识别
    autoTgt: null,       // {rel, phi, score} —— 识别到的任务图标（相对小地图中心）
    autoErr: "",
    autoErrLogged: "",
    sampling: false,
    sampleAt: 0,
  };

  /* ==========================================================================
   *  一、小工具
   * ========================================================================== */

  /** 键名归一：BGI 报上来的键名各种写法都有，折叠成一套自己用的名字 */
  function canonKey(s) {
    const k = String(s == null ? "" : s).trim().toLowerCase().replace(/[\s_]/g, "");
    switch (k) {
      case "arrowup": case "up": case "↑": return "up";
      case "arrowdown": case "down": case "↓": return "down";
      case "arrowleft": case "left": case "←": return "left";
      case "arrowright": case "right": case "→": return "right";
      case "oemplus": case "add": case "+": case "plus": case "=": return "plus";
      case "oemminus": case "subtract": case "-": case "minus": return "minus";
      case "oemopenbrackets": case "leftbracket": case "[": return "[";
      case "oemclosebrackets": case "rightbracket": case "]": return "]";
      case "oem5": case "oembackslash": case "backslash": case "\\": case "|": return "backslash";
      case "insert": case "ins": return "insert";
      case "home": return "home";
      default: return k;
    }
  }

  /* 等待。BGI 全局提供了 sleep(ms)（VideoMask 里实测可用），优先用它；
   * 没有就退化成 setTimeout 轮询。注意 BGI 的 V8 环境里【可能没有 setTimeout】，
   * 所以两条路都得留着，别只写一种。 */
  const NATIVE_SLEEP = (function () {
    try {
      if (typeof globalThis !== "undefined" && typeof globalThis.sleep === "function") return globalThis.sleep;
    } catch (e) { }
    return null;
  })();

  function sleep(ms) {
    ms = Math.max(0, ms | 0);
    if (NATIVE_SLEEP) return NATIVE_SLEEP(ms);
    return new Promise(function (resolve) {
      const end = Date.now() + ms;
      const tick = function () {
        if (Date.now() >= end) { resolve(); return; }
        try {
          if (typeof setTimeout === "function") { setTimeout(tick, 4); return; }
        } catch (e) { }
        tick();
      };
      tick();
    });
  }

  function logInfo(m) { try { log.info(m); } catch (e) { } }
  function logWarn(m) { try { log.warn(m); } catch (e) { } }
  function logErr(m) { try { log.error(m); } catch (e) { } }

  /* ==========================================================================
   *  二、和页面通信
   * ========================================================================== */

  function send(url, data) {
    if (!state.winId) return;
    try {
      htmlMask.send(state.winId, url, JSON.stringify(data || {}));
    } catch (e) { }
  }

  function pushState() {
    const now = Date.now();
    send("/state", {
      cx: state.cx,
      cy: state.cy,
      r: state.r,
      baseH: 1080,
      opacity: CFG.opacity,
      ring: CFG.showRing,
      heading: CFG.showHeading,
      debug: CFG.debug,
      calib: state.calib,
      // 页面拿到 yaw 自己算指针角度；calib 时把原始值也带过去
      yaw: state.yaw,
      raw: state.rawVal,
      unit: CFG.unit,
      offset: CFG.offset,
      sign: CFG.sign,
      err: state.err,
      // 玩家坐标（null = 还没读到）
      pos: (state.px === null) ? null : { x: state.px, y: state.py },
      posErr: state.posErr,
      // 目标点：极坐标（角度 + 距离比例），页面对着画不用懂世界坐标
      tgt: computeTarget(now),
      // 自动识别到的任务图标（黄色标记，与手动红点区分）；null = 没识别到
      autoTgt: state.autoTgt,
      mapRange: CFG.mapRange,
      ver: SCRIPT_VERSION,
    });
  }

  function handlePageMessage(raw) {
    let msg = null;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || !msg.url) return;
    const d = msg.data || {};
    switch (msg.url) {
      case "/ready":
        state.pageReady = true;
        logInfo("圆盘页面已就绪。");
        pushState();
        break;
      case "/log":
        if (d.msg) logInfo("[页面] " + String(d.msg));
        break;
      default:
        break;
    }
  }

  /* ==========================================================================
   *  三、朝向探测
   * ========================================================================== */

  /**
   * 读相机水平朝向。
   *
   * 已知的不确定性（这一版就是来把它钉死的）：
   *   · 单位：度还是弧度
   *   · 零点：0° 指向世界的哪个方向
   *   · 正负：逆时针递增还是顺时针递增
   *
   * 所以这里不做任何"聪明"的换算，只把原值打出来、把归一化值送到页面，
   * 由指针 + 游戏自带小地图的箭头对比来定。
   */
  function probeOrientation() {
    let raw = null, err = null;

    try {
      if (typeof getCameraOrientation === "function") {
        raw = getCameraOrientation();
      } else {
        err = "当前 BGI 版本没有 getCameraOrientation()";
      }
    } catch (e) {
      // 非主界面（打开背包/对话/加载中）时这个 API 会抛异常，属于正常情况
      err = "取不到朝向（可能不在主界面）：" + ((e && e.message) ? String(e.message) : String(e));
    }

    if (raw !== null && raw !== undefined) {
      let v = raw;
      // 有的版本返回数组 [水平, 垂直]，取第一个
      if (typeof v === "object" && typeof v.length === "number") v = v[0];
      v = Number(v);
      if (isFinite(v)) {
        state.rawVal = Math.round(v * 1000) / 1000;
        let deg = (CFG.unit === "rad") ? v * 180 / Math.PI : v;
        deg = ((deg % 360) + 360) % 360;
        state.yaw = Math.round(deg * 10) / 10;
        state.err = "";
        state.camOk++;
      } else {
        state.err = "朝向返回值不是数字：" + String(raw);
        state.camFail++;
      }
    } else {
      state.err = err || "取不到朝向";
      state.camFail++;
    }

    // 同一条错误只打一次，别刷屏
    if (state.err && state.err !== state.errLogged) {
      state.errLogged = state.err;
      logWarn(state.err);
    }
    if (!state.err && state.errLogged) {
      logInfo("朝向读取恢复正常了。");
      state.errLogged = "";
    }
  }

  /* ==========================================================================
   *  三·B、玩家坐标 + 目标点
   * ========================================================================== */

  /** Point2f 可能是 {X,Y} / {x,y} / [x,y]，统一成一个对象 */
  function pt2f(p) {
    if (!p) return null;
    const xv = (typeof p.X !== "undefined") ? p.X : ((typeof p.x !== "undefined") ? p.x : p[0]);
    const yv = (typeof p.Y !== "undefined") ? p.Y : ((typeof p.y !== "undefined") ? p.y : p[1]);
    const x = Number(xv), y = Number(yv);
    if (!isFinite(x) || !isFinite(y)) return null;
    return { x: x, y: y };
  }

  /**
   * 读玩家在小地图上的世界坐标。
   *
   * 注意这是个"重"调用（内部要识别小地图），不能每帧都读：
   * 主循环里按 400ms 节流，且带 900ms 缓存 —— 走两步才更新一次坐标，
   * 对"箭头指方向"来说完全够（距离几十米，400ms 走不出 1 米）。
   */
  function probePosition() {
    let p = null, err = "";
    try {
      if (typeof getPositionFromMap === "function") {
        try {
          // 带缓存的重载更省；地图名不对时会退化成无参版本
          p = getPositionFromMap("Teyvat", 900);
        } catch (e1) {
          p = getPositionFromMap();
        }
      } else {
        err = "当前 BGI 版本没有 getPositionFromMap()";
      }
    } catch (e) {
      err = "取不到坐标（可能不在主界面）：" + ((e && e.message) ? String(e.message) : String(e));
    }

    const v = pt2f(p);
    if (v) {
      state.px = Math.round(v.x * 10) / 10;
      state.py = Math.round(v.y * 10) / 10;
      state.posErr = "";
      state.posOk++;
    } else {
      state.posErr = err || "坐标识别失败（小地图被挡住 / 正在加载）";
      // 保留上一次坐标：宁可用旧值画，也不要让红点突然消失又跳回来
    }

    if (state.posErr && state.posErr !== state.posErrLogged) {
      state.posErrLogged = state.posErr;
      logWarn(state.posErr);
    }
    if (!state.posErr && state.posErrLogged) {
      logInfo("坐标读取恢复正常。");
      state.posErrLogged = "";
    }
  }

  /**
   * 解析 tasks.txt —— 它是一份**任务队列**，不是"一堆可选的点"。
   *
   *   2163.664, -1642.421, 去庙宇找凯亚           ← 没注释 = 还没做
   *   # 500, -600, 回风起地   # ✔ 到达 14:22      ← 注释掉 = 做完了
   *
   * 为什么用"注释掉"表示完成，而不是另存一个进度文件：
   *   文件本身就是进度 —— 重启不会从头再来，用户打开文件一眼就知道做到哪了，
   *   而且往队列里插一行新任务也不会把进度搞乱（不像"存第几个"那种做法）。
   */
  function parseTasks(txt) {
    const pending = [];
    let total = 0;
    const lines = String(txt || "").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const isDone = /^\s*#/.test(raw);
      // 先摘掉行首的完成标记 #，再摘掉行尾/行内的 # 注释，剩下的才是坐标本体。
      // （不能只写 replace(/#.*$/)：那样行首就是 # 的已完成任务会被整行删掉，total 就漏算了）
      const body = raw.replace(/^\s*#\s*/, "").replace(/#.*$/, "").trim();
      if (!body) continue;
      const m = body.match(/(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)/);
      if (!m) continue;
      const x = Number(m[1]), y = Number(m[2]);
      if (!isFinite(x) || !isFinite(y)) continue;
      total++;                      // 只要解析得出坐标就算一个任务（含已完成的）
      if (isDone) continue;         // 已完成的不进待办队列
      const name = body.replace(m[0], " ").replace(/^[\s,，]+|[\s,，]+$/g, "");
      pending.push({ x: x, y: y, name: name || ("任务 " + total), line: i, raw: raw });
    }
    return { pending: pending, total: total };
  }

  function readTasksFile() {
    try {
      if (typeof file !== "undefined" && file && typeof file.readTextSync === "function") {
        return String(file.readTextSync("tasks.txt") || "");
      }
    } catch (e) { }
    return null;
  }

  /** 把解析结果装进 state，并打一行"下一个是什么" */
  function applyTasks(txt) {
    const r = parseTasks(txt);
    state.tasks = r.pending;
    state.total = r.total;
    state.nearSince = 0;

    if (state.tasks.length) {
      const t = state.tasks[0];
      logInfo("下一个任务：" + t.name + " @ " + t.x + ", " + t.y +
        "（队列里还剩 " + state.tasks.length + " / 共 " + state.total + " 个）");
    } else if (state.total) {
      logInfo("tasks.txt 里的 " + state.total + " 个任务全部完成。");
    }
  }

  function loadTasks() {
    const txt = readTasksFile();
    if (txt === null) return;
    if (txt === state.tasksText) return;
    state.tasksText = txt;

    const r0 = parseTasks(txt);
    /* 文件里明明写了字，却一个坐标都没解析出来 —— 多半是手滑写错了。
     * 这时【不能】把队列清空：用户正指着下一个任务，改错一个字就丢目标太气人。
     * 真想清空，就把整个文件写成空 / 全是注释。 */
    if (!r0.total && state.tasks.length) {
      logWarn("tasks.txt 里没找到坐标（每行要写成 1234.5, -567.2 这样），当前任务保持不变。");
      return;
    }
    applyTasks(txt);
  }

  /** F9：把当前位置追加到队列末尾（当成"以后要去的点"） */
  function appendPoint() {
    if (state.px === null || state.py === null) {
      logWarn("还没读到坐标（不在主界面？），等红点出来再按。");
      return;
    }
    const x = Math.round(state.px * 10) / 10;
    const y = Math.round(state.py * 10) / 10;
    const line = x + ", " + y + ", 标记" + (state.total + 1);

    let cur = readTasksFile();
    if (cur === null) cur = "";
    const next = cur.replace(/\s*$/, "") + (cur.trim() ? "\n" : "") + line + "\n";

    try {
      if (typeof file === "undefined" || !file || typeof file.writeTextSync !== "function") {
        logWarn("这个 BGI 版本没有 file.writeTextSync，没法自动记点。手动加这行：" + line);
        return;
      }
      file.writeTextSync("tasks.txt", next);
      state.tasksText = next;
      applyTasks(next);
      logInfo("已把当前位置追加到 tasks.txt 末尾：" + line);
    } catch (e) {
      logWarn("写 tasks.txt 失败：" + ((e && e.message) ? e.message : String(e)) +
        "，手动加这行也行：" + line);
    }
  }

  /**
   * 划掉当前任务，自动指向下一个。
   * 两个触发：走到跟前（自动）、按 F8（人自己说做完了）。
   *
   * 划掉的方式是把那一行注释掉，并在行尾盖个时间戳 —— 这样文件打开就是一份完成记录。
   */
  function markDone(reason) {
    const t = state.tasks[0];
    if (!t) return false;

    const txt = readTasksFile();
    if (txt === null) {
      logWarn("读不到 tasks.txt，没法记录进度。");
      return false;
    }
    const lines = txt.split(/\r?\n/);
    if (lines[t.line] === undefined) {
      logWarn("任务行对不上（文件刚被改过？），下一轮重读。");
      state.tasksText = undefined;
      return false;
    }

    const d = new Date();
    const stamp = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    lines[t.line] = "# " + lines[t.line].replace(/^\s*#\s*/, "") + "    # ✔ " + reason + " " + stamp;
    const next = lines.join("\n");

    let wrote = false;
    try {
      if (typeof file !== "undefined" && file && typeof file.writeTextSync === "function") {
        file.writeTextSync("tasks.txt", next);
        wrote = true;
      }
    } catch (e) {
      logWarn("写 tasks.txt 失败：" + ((e && e.message) ? e.message : String(e)));
    }
    if (!wrote) {
      logWarn("这个 BGI 版本写不了文件：本次运行里会继续往下走，但重启后这个任务会复活。");
    }

    // 不管写没写成，内存里都要往下走，否则界面会卡在已经做完的任务上
    state.tasksText = next;
    applyTasks(next);
    state.doneCoolUntil = Date.now() + 2500;   // 防止站在俩任务中间连跳
    return true;
  }

  /**
   * 到达判定：进到 arriveR 米内、并且待够 arriveHoldMs，就算"到了"，自动划掉切下一个。
   *
   * 为什么要"待够一会儿"：路过也会进半径，一站上去就划掉等于白送一个任务；
   * 1.2 秒足够区分"路过"和"站住"。
   * 为什么要 doneCoolUntil 冷却：有些任务点挨得很近，连跳会让红点闪个不停。
   */
  function checkArrived(now) {
    if (!CFG.autoDone) return;
    const t = state.tasks[0];
    if (!t || state.px === null || state.py === null) return;
    if (now < state.doneCoolUntil) return;

    const dx = t.x - state.px;
    const dy = t.y - state.py;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > CFG.arriveR) { state.nearSince = 0; return; }
    if (!state.nearSince) { state.nearSince = now; return; }
    if (now - state.nearSince >= CFG.arriveHoldMs) {
      state.nearSince = 0;
      markDone("到达 " + Math.round(d) + "m");
    }
  }

  /**
   * 算出"目标点相对玩家"的极坐标，交给页面去画。
   *
   * 为什么只传极坐标（角度 + 距离比例）不传世界坐标：
   *   页面根本不需要知道世界坐标系长什么样，它只要知道"往这个角度、这个比例"。
   *   世界坐标那套（+x 朝东 / +y 朝南 / 北在世界角 0 度还是 -90 度）全关在这一个函数里，
   *   将来换数据源（识别图标 / 外部点位库）只要改这里。
   *
   * 角度换算（三段，容易绕晕，写清楚）：
   *   β  = atan2(dy, dx)         目标方位（世界角，0 = +x，逆时针为正）
   *   φ  = β − northAngle        屏幕角（从"正上方"顺时针算，因为小地图是北朝上）
   *   位置 = (sin φ, −cos φ) × 距离比例     （屏幕 y 轴朝下，所以取负）
   */
  function computeTarget(now) {
    if (!CFG.showTarget) return null;

    // 永远只取队列第一个 —— 屏幕上永远只有一个点，就是"下一个任务"
    const cur = state.tasks.length ? state.tasks[0] : null;

    if (!cur) {
      /* 队列空：要么一次都没配过（演示模式，看效果），要么全做完了（done，不再画点） */
      if (state.total > 0) {
        return { done: true, demo: false, total: state.total, left: 0 };
      }
      const t = (now - state.startedAt) / 1000;
      const ang = (t * 24) % (Math.PI * 2);
      const dist = 25 + 60 * (1 + Math.sin(t * 0.9)) / 2;   // 25~85 米
      const tx0 = (state.px || 0) + Math.cos(ang) * dist;
      const ty0 = (state.py || 0) + Math.sin(ang) * dist;
      if (state.px === null || state.py === null) {
        return { waiting: true, demo: true, name: "" };
      }
      return buildTarget(tx0, ty0, { demo: true, name: "", left: 0, total: 0 });
    }

    if (state.px === null || state.py === null) {
      return { waiting: true, demo: false, name: cur.name };
    }
    return buildTarget(cur.x, cur.y, {
      demo: false,
      name: cur.name,
      left: state.tasks.length,
      total: state.total
    });
  }

  /** 目标相对玩家 → 极坐标（页面只管画，不懂世界坐标） */
  function buildTarget(tx, ty, meta) {
    const dx = tx - state.px;
    const dy = ty - state.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const beta = Math.atan2(dy, dx) * 180 / Math.PI;
    let phi = beta - CFG.northAngle;
    phi = ((phi % 360) + 360) % 360;

    return {
      waiting: false,
      demo: !!meta.demo,
      name: meta.name || "",
      left: meta.left || 0,
      total: meta.total || 0,
      // 距离比例：1 = 正好在小地图边缘，>1 = 在地图外（画成外径箭头）
      rel: Math.round((dist / CFG.mapRange) * 1000) / 1000,
      phi: Math.round(phi * 10) / 10,
      dist: Math.round(dist * 10) / 10,
    };
  }

  /* ==========================================================================
   *  三·C、自动识别小地图任务图标（可选，配好模板才开）
   * --------------------------------------------------------------------------
   *  思路：任务图标是游戏自己在小地图上画的，我们不问"任务在哪"，直接
   *  截小地图区域做模板匹配，找到图标就照抄它的位置 —— 不需要任何坐标库。
   *
   *  依赖两张图（都放在 assets/ 下）：
   *    · shot_minimap.png：按采样热键存下来的小地图截图（我用来裁模板/调参）
   *    · task_icon.png   ：任务图标的模板图，放进来后自动识别就生效了
   * ========================================================================== */

  /** 把 1080p 基准的圆盘几何换算到"截图坐标系"里的矩形 */
  function minimapRect(imageH) {
    const k = (imageH || 1080) / 1080;
    const cx = state.cx * k, cy = state.cy * k, r = state.r * k;
    const pad = Math.round(r * 0.2);   // 多裁一圈边，图标贴在小地图边缘时别被切掉
    return {
      x: Math.round(cx - r - pad),
      y: Math.round(cy - r - pad),
      w: Math.round(r * 2 + pad * 2),
      h: Math.round(r * 2 + pad * 2),
      r: r,                             // 半径（rel 的分母）
    };
  }

  /** 采样热键：先让页面把圆盘藏起来，再截一张干净的小地图 */
  function saveSample() {
    if (typeof captureGameRegion !== "function") {
      logWarn("这个 BGI 版本没有 captureGameRegion，存不了截图。");
      return;
    }
    state.sampling = true;
    state.sampleAt = Date.now() + 180;   // 给 WebView2 一点时间把圆盘藏掉
    send("/sample", { on: true });
    logInfo("正在截小地图（先隐藏圆盘）…");
  }

  function doSampleShot() {
    let image = null, crop = null;
    try {
      image = captureGameRegion();
      const R = minimapRect(image.height || 1080);
      crop = image.deriveCrop(R.x, R.y, R.w, R.h);
      if (typeof file === "undefined" || !file || typeof file.writeImageSync !== "function") {
        logWarn("这个 BGI 版本没有 file.writeImageSync，存不了截图。");
        return;
      }
      file.writeImageSync("assets/shot_minimap.png", crop.srcMat);
      logInfo("小地图已存到 assets/shot_minimap.png —— 发我，或自己裁出任务图标存成 assets/task_icon.png。");
    } catch (e) {
      logWarn("截图保存失败：" + ((e && e.message) ? e.message : String(e)));
    } finally {
      if (crop) { try { crop.dispose(); } catch (e) { } }
      if (image) { try { image.dispose(); } catch (e) { } }
      state.sampling = false;
      send("/sample", { on: false });
    }
  }

  /** 模板匹配找任务图标，结果转成"相对小地图中心"的极坐标 */
  function autoDetectTick() {
    if (!CFG.autoDetect) return;
    let image = null, crop = null, template = null;
    try {
      if (typeof captureGameRegion !== "function" ||
          typeof file === "undefined" || !file ||
          typeof file.readImageMatSync !== "function" ||
          typeof RecognitionObject === "undefined") {
        state.autoTgt = null;
        return;
      }

      image = captureGameRegion();
      const R = minimapRect(image.height || 1080);
      crop = image.deriveCrop(R.x, R.y, R.w, R.h);

      template = file.readImageMatSync("assets/task_icon.png");
      const ro = RecognitionObject.templateMatch(template);
      ro.threshold = CFG.autoScore;
      const results = crop.findMulti(ro);

      let best = null;
      const n = (results && results.count) ? results.count : 0;
      for (let i = 0; i < n; i++) {
        const m = results[i];
        const sc = Number(m.matchScore);
        if (!best || sc > best.score) {
          best = { x: Number(m.x), y: Number(m.y), w: Number(m.width), h: Number(m.height), score: sc };
        }
      }

      if (best && best.score >= CFG.autoScore) {
        const dx = best.x + best.w / 2 - R.w / 2;
        const dy = best.y + best.h / 2 - R.h / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const rel = dist / R.r;
        // 屏幕角：正上方是 0，顺时针递增（dx 向右、dy 向下 → 上方是 -y）
        const phi = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        state.autoTgt = {
          rel: Math.round(rel * 100) / 100,
          phi: Math.round(phi * 10) / 10,
          score: Math.round(best.score * 100) / 100,
        };
      } else {
        state.autoTgt = null;
      }
    } catch (e) {
      state.autoTgt = null;
      // 没配模板（task_icon.png 不存在）是常态，不刷屏；其它错误才提示一次
      const msg = ((e && e.message) ? String(e.message) : String(e));
      if (msg !== state.autoErr) {
        state.autoErr = msg;
        if (msg.indexOf("task_icon") < 0) {
          logWarn("自动识别失败：" + msg);
        }
      }
    } finally {
      if (crop) { try { crop.dispose(); } catch (e) { } }
      if (image) { try { image.dispose(); } catch (e) { } }
      if (template) { try { template.dispose(); } catch (e) { } }
    }
  }

  /* ==========================================================================
   *  四、标定（热键）
   * ========================================================================== */

  function toggleCalib() {
    state.calib = !state.calib;
    if (state.calib) {
      logInfo("进入标定模式：方向键挪圆心、+/- 改半径、Home 复位、再按一次 " +
        CFG.calibKey.toUpperCase() + " 退出并保存。");
      logInfo("当前：" + Math.round(state.cx) + ", " + Math.round(state.cy) +
        " 半径 " + Math.round(state.r));
    } else {
      saveCalib();
    }
    pushState();
  }

  function saveCalib() {
    const vals = {
      discX: String(Math.round(state.cx)),
      discY: String(Math.round(state.cy)),
      discR: String(Math.round(state.r)),
    };
    try {
      if (typeof settings !== "undefined" && settings && typeof settings.set === "function") {
        Object.keys(vals).forEach(function (k) { settings.set(k, vals[k]); });
        logInfo("标定值已保存：" + vals.discX + ", " + vals.discY + " 半径 " + vals.discR +
          "（写回设置，下次启动直接生效）。");
      } else {
        logInfo("这个 BGI 版本没有 settings.set，没法自动保存。请手动把这三个数字填进设置：" +
          vals.discX + " / " + vals.discY + " / " + vals.discR);
      }
    } catch (e) {
      logWarn("保存标定值失败：" + ((e && e.message) ? e.message : String(e)));
    }
  }

  const STEP = 2;   // 每按一次挪 2px（1080p 基准），够快也不容易过冲

  function handleKey(k) {
    const kk = canonKey(k);

    if (kk === canonKey(CFG.calibKey)) { toggleCalib(); return; }
    // 记点 / 手动完成 / 采样截图：跟标定模式无关，任何时候都能按
    if (kk === canonKey(CFG.hkMark)) { appendPoint(); pushState(); return; }
    if (kk === canonKey(CFG.hkSample)) { saveSample(); return; }
    if (kk === canonKey(CFG.hkDone)) {
      if (state.tasks.length) { markDone("手动完成"); pushState(); }
      else logInfo("队列里没有任务了。");
      return;
    }

    if (!state.calib) return;

    let changed = false;
    if (kk === "up") { state.cy -= STEP; changed = true; }
    else if (kk === "down") { state.cy += STEP; changed = true; }
    else if (kk === "left") { state.cx -= STEP; changed = true; }
    else if (kk === "right") { state.cx += STEP; changed = true; }
    else if (kk === "plus") { state.r = Math.min(400, state.r + STEP); changed = true; }
    else if (kk === "minus") { state.r = Math.max(20, state.r - STEP); changed = true; }
    else if (kk === "home") {
      state.cx = CFG.cx; state.cy = CFG.cy; state.r = CFG.r; changed = true;
      logInfo("标定值已复位到设置里的值。");
    }

    if (changed) {
      state.cx = Math.round(state.cx);
      state.cy = Math.round(state.cy);
      state.r = Math.round(state.r);
      pushState();
    }
  }

  /* ==========================================================================
   *  五、主流程
   * ========================================================================== */

  function openMask() {
    let id = null;
    try {
      id = htmlMask.show("assets/disc.html", WINDOW_ID);
    } catch (e) {
      throw new Error("创建透明叠层失败：" + ((e && e.message) ? e.message : String(e)));
    }
    state.winId = id || WINDOW_ID;
    // 圆盘只看不摸：立刻把鼠标还给游戏，绝不抢焦点
    try { htmlMask.setClickThrough(state.winId, true); } catch (e) { }
    logInfo("透明叠层已创建，id=" + state.winId + "（鼠标穿透已开启）");
  }

  async function run() {
    logInfo("===== 地图圆盘 v" + SCRIPT_VERSION + " 启动 =====");
    logInfo("永远只指一个点：tasks.txt 里第一个没做完的任务。到了自动划掉、切下一个。");
    logInfo("叠层几何：" + "圆心 " + CFG.cx + "," + CFG.cy + " 半径 " + CFG.r +
      "（1080p 基准，会按实际分辨率自动缩放）");

    openMask();
    pushState();

    // 先试一次，把返回值原样打进日志 —— 标定的第一手材料
    probeOrientation();
    if (state.rawVal !== null) {
      logInfo("getCameraOrientation() 原始返回：" + state.rawVal +
        (CFG.unit === "rad" ? "（按弧度换算）" : "（按度理解）") +
        " → 归一化 " + state.yaw + "°");
    }

    probePosition();
    if (state.px !== null) {
      logInfo("玩家世界坐标：" + state.px + ", " + state.py);
    }

    // tasks.txt 就是任务队列：改一行就换任务，不用重开脚本
    loadTasks();
    if (!state.total) {
      logInfo("tasks.txt 里还没有任务 → 【演示模式】目标绕着玩家转，用来看红点和外径箭头的样子。");
      logInfo("按 " + CFG.hkMark.toUpperCase() + " 可以把当前位置记成一个任务。");
    } else {
      logInfo("到达判定：" + (CFG.autoDone ? "开" : "关") + "（" + CFG.arriveR + " 米内待 " +
        (CFG.arriveHoldMs / 1000) + " 秒就算到了）｜" + CFG.hkDone.toUpperCase() + " 手动完成当前任务");
      logInfo("小地图半径 " + CFG.mapRange + " 米｜北在世界角 " + CFG.northAngle + "°");
    }

    if (CFG.autoDetect) {
      logInfo("自动识别已开：用 assets/task_icon.png 匹配小地图上的任务图标，阈值 " + CFG.autoScore + "。");
    }
    logInfo("按 " + CFG.hkSample.toUpperCase() + " 可存一张小地图截图到 assets/shot_minimap.png（做模板用）。");

    /* ---- 键鼠钩子：只为了标定时能微调，不依赖它也能用 ---- */
    let hook = null;
    const keyQueue = [];
    let calibKeyAt = 0;
    try {
      if (typeof KeyMouseHook === "function") {
        hook = new KeyMouseHook();
        hook.OnKeyDown(function (keyCode) {
          const k = String(keyCode || "");
          if (!k) return;
          const now = Date.now();
          if (now - calibKeyAt < 35) return;   // 吃掉自动重复的洪峰，长按仍然能连续微调
          calibKeyAt = now;
          keyQueue.push(k);
        }, true);
        logInfo("热键已就绪：" + CFG.calibKey.toUpperCase() + " 开关标定模式。");
      } else {
        logWarn("这个 BGI 版本没有 KeyMouseHook，标定热键不可用；只能在设置里手动填数值。");
      }
    } catch (e) {
      logWarn("键鼠钩子初始化失败（标定热键不可用，其余功能正常）：" +
        ((e && e.message) ? e.message : String(e)));
      hook = null;
    }

    const openedAt = Date.now();
    let lastProbe = 0;
    let lastPos = 0;
    let lastTarget = 0;
    let lastAuto = 0;
    let missCount = 0;
    let everAlive = false;

    while (state.running) {
      const now = Date.now();

      // 1) 热键
      while (keyQueue.length) {
        try { handleKey(keyQueue.shift()); } catch (e) { }
      }

      // 2) 采样到点就截图（先藏圆盘再截，截完恢复）
      if (state.sampling && now >= state.sampleAt) {
        try { doSampleShot(); } catch (e) { }
      }

      // 3) 自动识别任务图标（500ms 一次，比坐标探测慢一拍没关系）
      if (CFG.autoDetect && now - lastAuto >= 500) {
        lastAuto = now;
        try { autoDetectTick(); } catch (e) { }
      }

      // 4) tasks.txt 热重载（2 秒一次，读个小文件而已）
      if (now - lastTarget >= 2000) {
        lastTarget = now;
        try { loadTasks(); } catch (e) { }
      }

      // 5) 玩家坐标（重活：内部要识别小地图，400ms 一次就够）
      if (now - lastPos >= 400) {
        lastPos = now;
        probePosition();
        checkArrived(now);
      }

      // 6) 朝向（60ms ≈ 16fps，指针转起来够顺，开销也可忽略）
      if (now - lastProbe >= 60) {
        lastProbe = now;
        probeOrientation();
        pushState();
      }

      // 7) 页面消息
      let raw = null;
      try { raw = await htmlMask.receive(state.winId, 40); } catch (e) { raw = null; }
      if (raw) handlePageMessage(raw);

      // 8) 窗口被关掉就退出
      let alive = true;
      try { alive = htmlMask.exists(state.winId); } catch (e) { alive = true; }
      if (!alive) {
        if (Date.now() - openedAt < 8000) { await sleep(120); continue; }
        if (++missCount >= 3) {
          logInfo(everAlive ? "叠层窗口已关闭，脚本退出。" : "叠层窗口没能创建出来（WebView2 初始化失败）。");
          break;
        }
      } else { missCount = 0; everAlive = true; }

      await sleep(20);
    }
  }

  try {
    await run();
  } catch (err) {
    logErr("脚本异常终止：" + ((err && err.message) ? err.message : String(err)));
    if (err && err.stack) logErr(String(err.stack));
  } finally {
    try { if (state.winId) htmlMask.close(state.winId); } catch (e) { }
    try { htmlMask.closeAll(); } catch (e) { }
    logInfo("===== 地图圆盘 已退出 =====");
  }
})();
