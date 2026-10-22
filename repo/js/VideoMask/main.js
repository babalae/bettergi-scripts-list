/// <reference path="bettergi.d.ts" />
/*
 * ============================================================================
 *  VideoMask —— 游戏内悬浮攻略视频（BetterGI / 更好的原神 · JS 脚本）
 * ----------------------------------------------------------------------------
 *  做一个"妈宝式"的置顶攻略播放器：
 *    · 视频以透明 HTML 叠层浮在游戏窗口上，位置/大小/透明度都能调
 *    · 叠层默认「点击穿透」，不影响你操作角色
 *    · 全局热键（游戏有焦点时也生效）：播放暂停 / 快退快进 / 变速 / 透明度 /
 *      隐藏 / 穿透切换 / 上一集下一集 / 关闭
 *    · 位置、大小、透明度、播放进度自动记住，下次打开接着看
 *
 *  实现要点：
 *    htmlMask  → 叠层窗口（WebView2），setClickThrough 控制鼠标穿透
 *    KeyMouseHook → 系统级键鼠钩子，实现"游戏内也能控制视频"
 * ============================================================================
 */
(async function () {
  "use strict";

  const SCRIPT_VERSION = "1.6.29";
  const WINDOW_ID = "videomask";
  const st = (typeof settings === "undefined" || settings === null) ? {} : settings;

  /* ==========================================================================
   *  一、配置
   * ========================================================================== */

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
    return s === "true" || s === "1" || s === "yes";
  }
  function str(key, def) {
    const v = st[key];
    if (v === undefined || v === null || v === "") return def;
    return String(v);
  }

  /** 读取存在 settings 里的 JSON（收藏夹、观看统计） */
  function readJsonSetting(key, def) {
    try {
      const raw = st[key];
      if (!raw) return def;
      const o = JSON.parse(String(raw));
      return (o === null || o === undefined) ? def : o;
    } catch (e) {
      return def;
    }
  }

  /** 上次退出时保存的布局（settings.vmLayout） */
  function loadSavedLayout() {
    try {
      const raw = st.vmLayout;
      if (!raw) return null;
      const o = JSON.parse(String(raw));
      if (!o || typeof o !== "object") return null;
      return o;
    } catch (e) {
      return null;
    }
  }
  /* ---------- 浮窗内置浏览器的快捷键冲突 ----------
   * BGI 的浮窗不是普通窗口，是 WebView2（Edge 浏览器内核）。它默认带着一整套
   * 浏览器快捷键，而脚本这边的键盘钩子只能"听见"按键、**不能吞掉**，
   * 所以同一个键会被两边同时处理，最容易撞上的就是：
   *   F12 / Ctrl+Shift+I → 打开开发者工具（"老是跳 devtools"就是这个）
   *   F5  / Ctrl+R       → 刷新页面，播放进度直接归零
   *   F3  / Ctrl+F       → 弹出查找框
   *   F1 / F6 / F7 / F10 / F11 → 帮助 / 地址栏 / 光标浏览 / 菜单栏 / 全屏
   * 所以这些键在脚本里一律不直接用，启动时自动换成右边的安全键。
   */
  const TAKEN_KEYS = { f1: 1, f3: 1, f5: 1, f6: 1, f7: 1, f10: 1, f11: 1, f12: 1 };
  // 换成谁：F9 是唯一「三家都不占」的 F 键（原神只绑 F1~F8，BGI 用 F11，浏览器不抢 F9）。
  // 以前这里往 F2 / F4 / F8 换，可那三个在原神里是「联机 / 纪行 / 星之归还」——
  // 换个键反倒让游戏弹面板，等于换个姿势冲突。F12 还是给 Insert。
  const SAFE_ALIAS = {
    f1: "f9", f3: "f9", f5: "f9", f6: "f9",
    f7: "f9", f10: "f9", f11: "f9", f12: "insert",
  };
  const HOTKEY_SAFE = bool("hotkeySafe", true);

  /** 单个键：被浏览器占用就换成安全键，返回 { key, why } */
  function safeOneKey(k) {
    if (!HOTKEY_SAFE || !k || !TAKEN_KEYS[k]) return { key: k, why: "" };
    const alt = SAFE_ALIAS[k] || "insert";
    return { key: alt, why: k + "→" + alt };
  }

  /** 键列表（缩放模式可以填多个键） */
  function safeKeyList(list, what) {
    const out = [];
    const notes = [];
    for (let i = 0; i < list.length; i++) {
      const r = safeOneKey(normKey(list[i]));
      if (!r.key) continue;
      if (r.why) notes.push(r.why);
      if (out.indexOf(r.key) < 0) out.push(r.key);
    }
    if (notes.length) {
      try {
        log.warn("「" + what + "」热键 " + notes.join("，") +
          " —— 这些键会被浮窗内置浏览器抢走（F12 弹开发者工具、F5 刷新页面），已换掉。");
      } catch (e) { }
    }
    return out;
  }

  /** 动作热键表：逐个换掉危险键，顺带避免换完撞车 */
  function safeKeyMap(map, what) {
    const out = {};
    const used = {};
    const notes = [];
    for (const k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (!map[k]) { out[k] = ""; continue; }
      let key = normKey(map[k]);
      if (HOTKEY_SAFE && TAKEN_KEYS[key]) {
        const alt = SAFE_ALIAS[key] || "insert";
        if (used[alt]) {
          out[k] = "";
          notes.push(k + " 的 " + key + " 已禁用（替代键 " + alt + " 重复）");
          continue;
        }
        notes.push(k + ":" + key + "→" + alt);
        key = alt;
      }
      if (used[key]) {
        out[k] = "";
        notes.push(k + " 的 " + key + " 已禁用（与其他热键重复）");
        continue;
      }
      used[key] = 1;
      out[k] = key;
    }
    if (notes.length) {
      try { log.warn("「" + what + "」里的 " + notes.join("，") + " 已调整，避免被浮窗浏览器抢走。"); } catch (e) { }
    }
    return out;
  }

  /**
   * 动作热键表。
   *
   * 播放/暂停 v1.6.27 起默认「~」（Esc 下面那颗）。
   * 以前默认 F9，理由是原神只绑 F1~F8、BGI 用 F11；但**笔记本上 F9 往往是
   * 亮度/音量功能键**，按下去先被系统吃掉，脚本根本收不到，等于没绑。
   * 波浪号那颗键不参与游戏、不被浏览器抢、也没有厂商功能键覆盖，最稳。
   * 其余动作键一律留空 —— 没填就不占键。
   *
   * 「启用键盘热键」总开关关掉时，只保留播放/暂停这一颗（F9），
   * 其它动作键连注册都不注册 —— 这样这个开关才真的有用，而不是摆着好看。
   */
  function buildHotkeys() {
    const map = safeKeyMap({
      // v1.6.27：播放/暂停默认从 F9 改成「~」（Esc 下面那颗波浪号键）。
      // 不少笔记本的 F9 是亮度/音量功能键，按下去被系统先吃掉，脚本收不到。
      // 符号键走 canonKey 归一，配置里写 ~ 或 ` 都算同一颗。
      playPause: (function () {
        let v = str("hkPlayPause", "~");
        let mig = false;
        try { mig = String(st.playKeyMig || "") === "1"; } catch (e) { }
        if (!mig) {
          // 老配置里存着默认的 F9 就抬到 ~（只抬一次，之后你改回 F9 就尊重你）
          if (normKey(v) === "f9") {
            v = "~";
            try { settings.set("hkPlayPause", "~"); } catch (e) { }
            try {
              log.info("播放/暂停热键已从 F9 改为「~」：笔记本上 F9 常被亮度键占用。想换回就在侧栏「键」里改。");
            } catch (e) { }
          }
          try { settings.set("playKeyMig", "1"); } catch (e) { }
        }
        return v;
      })(),
      back: str("hkBack", ""),
      forward: str("hkForward", ""),
      slower: str("hkSlower", ""),
      faster: str("hkFaster", ""),
      opacityDown: str("hkOpacityDown", ""),
      opacityUp: str("hkOpacityUp", ""),
      toggleHide: str("hkToggleHide", ""),
      toggleInteractive: str("hkToggleInteractive", ""),
      close: str("hkClose", ""),
      prevVideo: str("hkPrevVideo", ""),
      nextVideo: str("hkNextVideo", ""),
      mark: str("hkMark", ""),
    }, "操作热键");
    if (!bool("enableHotkeys", true)) {
      // 总开关关掉：只留播放/暂停
      const keep = {};
      if (map.playPause) keep.playPause = map.playPause;
      return keep;
    }
    return map;
  }

  /**
   * 可以在浮窗「键」面板里改的按键（v1.6.15）。
   *
   * 为什么要有这张表：改热键要去 BGI 设置页里翻，得退出去找；
   * 而玩家真正想改的往往只是「F9 跟游戏/别的软件撞了，换一个」。
   * 所以把动作搬进浮窗：点一下、按个键就换了，改完立刻重挂钩子、立刻生效。
   *
   * setting 是写回 BGI 设置的名字；resize / login / hold 三项在配置里是
   * 「可填多个键」的列表，面板只显示和改第一个（够用，也不容易把人绕晕）。
   */
  const HOTKEY_DEFS = [
    { id: "playPause",          label: "播放 / 暂停",        setting: "hkPlayPause",        def: "~" },
    { id: "resize",             label: "缩放模式（接管鼠标）", setting: "hkResizeMode",      def: "Insert" },
    { id: "hold",               label: "按住＝临时可操作",    setting: "holdKey",            def: "Alt" },
    { id: "login",              label: "B 站登录窗",          setting: "hkLogin",            def: "End" },
    { id: "mark",               label: "打个怪点",            setting: "hkMark",             def: "" },
    { id: "back",               label: "后退 5 秒",           setting: "hkBack",             def: "" },
    { id: "forward",            label: "前进 5 秒",           setting: "hkForward",          def: "" },
    { id: "slower",             label: "减速",                setting: "hkSlower",           def: "" },
    { id: "faster",             label: "加速",                setting: "hkFaster",           def: "" },
    { id: "opacityDown",        label: "画面变淡",            setting: "hkOpacityDown",      def: "" },
    { id: "opacityUp",          label: "画面变实",            setting: "hkOpacityUp",        def: "" },
    { id: "toggleHide",         label: "隐藏画面",            setting: "hkToggleHide",       def: "" },
    { id: "toggleInteractive",  label: "切换可交互",          setting: "hkToggleInteractive", def: "" },
    { id: "prevVideo",          label: "上一集",              setting: "hkPrevVideo",        def: "" },
    { id: "nextVideo",          label: "下一集",              setting: "hkNextVideo",        def: "" },
    { id: "close",              label: "关闭浮窗",            setting: "hkClose",            def: "" },
  ];

  function hotkeyDef(id) {
    for (let i = 0; i < HOTKEY_DEFS.length; i++) {
      if (HOTKEY_DEFS[i].id === id) return HOTKEY_DEFS[i];
    }
    return null;
  }

  /**
   * "按住这个键，浮窗临时接管鼠标"的键表。
   *
   * 默认 Alt：原神里 Alt 本来就是「显示鼠标指针」，按住它的时候手本来就在鼠标上，
   * 正好拿它当"浮窗临时可交互"的开关 —— 按住就能拖进度条、点暂停，松开立刻还给游戏，
   * 不用先按 Insert 进缩放模式再退出来。
   *
   * 想改成 Ctrl 就在设置里填 Ctrl（以前那个 `ctrlDrag` 开关已经合并到这里了）。
   * 留空 = 关掉这套，只留缩放热键。
   */
  function buildHoldKeys() {
    const raw = str("holdKey", "Alt").trim();
    if (!raw) {
      // 兼容老配置：以前是 ctrlDrag 复选框
      return bool("ctrlDrag", false) ? ["control"] : [];
    }
    return raw.split(/[,，\s]+/).map(normKey).filter(Boolean);
  }

  /**
   * 钩子上报的键名跟配置里写的对不上（Alt 可能是 menu / lmenu / rmenu，
   * Ctrl 可能是 control / controlkey / lcontrol），所以这里做一次"族匹配"。
   */
  function matchHoldKey(k) {
    if (!k) return false;
    for (let i = 0; i < CFG.holdKeys.length; i++) {
      const want = CFG.holdKeys[i];
      if (want === "alt" || want === "menu" || want === "lmenu" || want === "rmenu") {
        if (k === "alt" || k === "menu" || k === "lmenu" || k === "rmenu" ||
          k.indexOf("menu") >= 0) return true;
        continue;
      }
      if (want === "ctrl" || want === "control" || want === "lcontrol" || want === "rcontrol") {
        if (k.indexOf("control") >= 0) return true;
        continue;
      }
      if (k === want) return true;
    }
    return false;
  }

  const CFG = {
    // 本地文件留空；在线默认给一个 BV，保证第一次跑就能看到画面
    videoFile: str("videoFile", ""),
    videoUrl: str("videoUrl", "BV1BMgj6MEz4"),
    // v1.6.8：启动时【不】自动加载视频，先黑底白字提示"去系列栏选地图"。
    // 以前一上来就播配置里那个视频，人还没想好要看哪张地图，声音和画面先糊上来了，
    // 而且很容易播到"上一次随手点的某一集"，看着莫名其妙。想恢复旧行为就把它关掉。
    startBlank: bool("startBlank", true),
    upMid: str("upMid", "431073645"),
    sessdata: str("sessdata", ""),
    showSubtitle: bool("showSubtitle", true),
    // 战斗检测（用 BGI 的 OCR，不依赖模板）
    combatPause: bool("combatPause", false),
    combatMode: str("combatMode", "ocr"),
    combatDry: bool("combatDry", true),
    combatMinText: num("combatMinText", 2),
    combatTemplate: str("combatTemplate", "assets/combat/enemy.png"),
    combatScore: num("combatScore", 0.75),
    combatRoi: str("combatRoi", "660,20,600,70"),
    combatResumeSec: num("combatResumeSec", 8),
    // ---- 在线直链自播（不再用跨域 iframe）----
    // 走 x/player/playurl 拿 mp4 直链自己播，好处是能拿到真实进度、能拖进度条、
    // 能把画面抽帧出来做分析（iframe 里这些都是死路）。
    videoQn: /360/.test(str("videoQn", "720P")) ? 16 : 64,   // 64=720P  16=360P
    // ---- 视频侧自动暂停 ----
    // 默认关：判据靠画面突变，主播切镜头/拉近拉远都会触发误停，还不太成熟。
    // 想要的人自己在设置里勾上（或按热键/点「析」按钮临时开）。
    autoPause: bool("autoPause", false),
    autoPauseMode: str("autoPauseMode", "cut"),   // cut=只在场景突变时 / off=关
    autoPauseCut: num("autoPauseCut", 0.45),      // 场景突变阈值（实测正常帧 0.06 / 换场地 >0.5）
    autoPauseFight: num("autoPauseFight", 2.0),   // 高出这个倍数算"在高动态里"，不暂停
    // ---- 打怪点 / 看完点（语料模型算出来的暂停时刻） ----
    // v1.6.24：**默认开**。全集 574 集（4950 分钟 / 1451 条清怪指令）已训完，
    // 评测 精确率 96.1% / 召回率 100%，时间表 1526 个点（打怪 1356 + 看完 170）
    // 已内嵌进下面的 SCHED_RAW，所以直接把暂停打开。嫌烦随时在浮窗齿轮面板关掉，
    // 关掉会存进设置，之后重载脚本也还是关。
    marksOn: (function () {
      // 老配置里可能还存着 v1.6.22 的默认 false，一次性抬成 true；
      // 抬过就写标记，之后你手动关掉就尊重你的选择，不再改回来。
      let migrated = false;
      try { migrated = String(st.marksOnMig || "") === "1"; } catch (e) { }
      let v = bool("marksOn", true);
      if (!migrated) {
        if (v !== true) {
          v = true;
          try { settings.set("marksOn", "true"); } catch (e) { }
        }
        try { settings.set("marksOnMig", "1"); } catch (e) { }
      }
      return v;
    })(),
    // ---- 看完自动续播（v1.6.16）----
    // 一集播完在画面底部倒计时 N 秒，然后自动切下一个：先试下一个分P，
    // 没有再试分类/合集里的下一个视频。只负责"播下一个"，不负责重播。
    autoNext: bool("autoNext", true),
    // v1.6.17：默认 5 秒 → 10 秒（实际播起来 5 秒太赶，片尾还有话没说完就跳了）。
    // 老配置里存着旧默认（3~5 秒）的，这里一次性抬到 10；抬过就写个标记，
    // 之后你自己改成几秒就是几秒，别再被"迁移"改回来。
    autoNextSec: (function () {
      let v = num("autoNextSec", 10);
      let migrated = false;
      try { migrated = String(st.autoNextSecMig || "") === "1"; } catch (e) { }
      if (!migrated && v > 0 && v <= 5) {
        v = 10;
        try {
          settings.set("autoNextSec", "10");
          settings.set("autoNextSecMig", "1");
        } catch (e) { }
      }
      return Math.max(3, Math.min(30, v));
    })(),
    voiceGate: bool("voiceGate", true),
    showSidebar: bool("showSidebar", false),
    autoLoadCollections: bool("autoLoadCollections", false),
    // 分类目录：把 UP 主散落在「一条龙 / 宝箱 / 神瞳 / 世界任务」各个系列里的视频，
    // 按地区（枫丹、须弥、璃月…）横向聚合成一个分类，侧栏里按分类选片。
    catalogOn: bool("catalogOn", true),
    catalogDays: num("catalogDays", 7),          // 本地索引缓存多少天
    catalogDeep: bool("catalogDeep", true),      // 是否连「世界任务」这类大合集一起索引
    resetLayout: bool("resetLayout", false),
    // 分辨率自适应：按比例记住浮窗位置/尺寸，换分辨率或切全屏后自动摆回去
    fitRes: bool("fitRes", true),
    opacity: num("opacity", 1.0),
    volume: num("volume", 1.0),
    speed: num("speed", 1.0),
    autoplay: bool("autoplay", true),
    resume: bool("resume", true),
    // 热键默认全关（会和游戏按键冲突），改用鼠标悬停自动切换穿透
    enableHotkeys: bool("enableHotkeys", true),
    hoverMode: bool("hoverMode", false),
    hoverExitMs: num("hoverExitMs", 900),
    // 进度条热区：鼠标移到画面底部这条上时临时关掉穿透，让进度条能拖；
    // 移开就恢复穿透，其余区域完全不挡鼠标。
    // v1.6.23 起默认【关】：开着时鼠标一搭到浮窗底部，浮窗就 setClickThrough(false)
    // 抢前台焦点（BGI 在 SetClickThrough 里做了 SetForegroundWindow+Activate），游戏一
    // 失焦，BGI 自带的自动剧情（过剧情）前台点击就点不到游戏、卡住。
    // 想拖进度条改按住 Alt（holdKey，松开 250ms 自动还焦点）或按 Insert 进缩放模式。
    // 下面带一次迁移：旧默认是"开"，从没主动改过的人自动关掉；之后自己再开就尊重。
    scrubZone: (function () {
      let migrated = false;
      try { migrated = String(st.scrubZoneMig || "") === "1"; } catch (e) { }
      let v = bool("scrubZone", false);
      if (!migrated) {
        if (v === true) {
          v = false;
          try { settings.set("scrubZone", "false"); } catch (e) { }
          try {
            log.warn("进度条热区已自动关闭：它会在鼠标路过浮窗底部时抢前台焦点，导致 BGI 自带的自动剧情（过剧情）失效。想拖进度条请按住 Alt。");
          } catch (e) { }
        }
        try { settings.set("scrubZoneMig", "1"); } catch (e) { }
      }
      return v;
    })(),
    // 按住这个键 = 浮窗临时可交互（默认 Alt，跟原神「显示鼠标」用的是同一颗键）
    holdKeys: buildHoldKeys(),
    // 方向键全局生效：←/→ 快退快进、↑/↓ 调音量，不用先按缩放热键
    arrowGlobal: bool("arrowGlobal", true),
    // 缩放模式热键：按一下进入、再按一下退出。
    // 默认 Insert —— 原来默认 F12，但 F12 是浮窗内置浏览器的"打开开发者工具"，
    // 按一下就会跳出 DevTools；F5 同理会更狠（直接刷新、进度归零）。
    // 支持用逗号填多个键，例如 "Insert,Pause"。
    resizeKeys: safeKeyList(
      str("hkResizeMode", "Insert").split(/[,，\s]+/).map(normKey).filter(Boolean),
      "缩放模式"
    ),
    // 关闭 B 站登录窗的热键。登录窗是一个铺满屏幕的独立窗口，会把浮窗整个盖住，
    // 侧栏上的「登录」按钮点不到 —— 没有这个热键就会卡在登录页回不来。
    // 默认 End：不在游戏的默认按键里，也不会被浏览器抢。
    loginKeys: safeKeyList(
      str("hkLogin", "End").split(/[,，\s]+/).map(normKey).filter(Boolean),
      "登录窗"
    ),
    // 启动后先给一段"可拖动"的时间（用来摆位置）。用 Ctrl 拖动的话可以设 0。
    // v1.6.26：默认改 0。以前 settings.json 里默认 25 秒，等于每次启动都让浮窗
    // 抢 25 秒前台焦点——这正是"开了悬浮窗，BGI 自动过剧情就不动了"的主要元凶之一：
    // 游戏一失焦，AutoSkip 在没开「后台运行」的情况下就点不到游戏。
    // 现在默认不抢；老配置里存着 25 的，一次性清成 0（下面的 startupIntMig）。
    startupInteractiveSec: (function () {
      let migrated = false;
      try { migrated = String(st.startupIntMig || "") === "1"; } catch (e) { }
      let v = num("startupInteractiveSec", 0);
      if (!migrated) {
        if (v > 0) {
          v = 0;
          try { settings.set("startupInteractiveSec", "0"); } catch (e) { }
          try {
            log.warn("「启动后可拖动多少秒」已自动改为 0：它会让浮窗在启动时抢前台焦点，" +
              "导致 BGI 自带的自动过剧情失效。想摆位置请按 Insert（或按住 Alt）。");
          } catch (e) { }
        }
        try { settings.set("startupIntMig", "1"); } catch (e) { }
      }
      return v;
    })(),
    // BGI 实时触发保活（v1.6.29）
    // BGI 在跑 JS 脚本前会把它自己的「实时触发」全部关掉（官方 FAQ 明说）。
    // 结果就是：开着浮窗，自动拾取不捡东西、自动剧情卡在对话里，看起来像两个功能打架。
    // 这里用 dispatcher.addTrigger 把它们按 BGI 里原本的设置挂回去。
    // 两个开关是"要不要替用户挂回去"，不是"强开"——BGI 里本来就关着的不会被打开。
    bgiKeepPick: bool("bgiKeepPick", true),
    bgiKeepSkip: bool("bgiKeepSkip", true),
    clickThrough: !bool("interactiveAtStart", false),
    showTip: bool("showTip", true),
    // 动作热键：播放/暂停默认 F9（开箱即用），其余留空 —— 没填的键一个都不占。
    // 填了 F12 / F5 这类会被浮窗内置浏览器抢走的键，这里会自动换掉。
    hotkeys: buildHotkeys(),
    // 可选的鼠标侧键绑定（mouse4 / mouse5 / 或自定义名称）
    mouseHotkeys: {
      playPause: str("mkPlayPause", ""),
      toggleInteractive: str("mkToggleInteractive", ""),
    },
    seekStep: num("seekStep", 5),
    speedStep: num("speedStep", 0.25),
    speedMin: num("speedMin", 0.5),
    speedMax: num("speedMax", 2.0),
    opacityStep: num("opacityStep", 0.1),
    opacityMin: num("opacityMin", 0.2),
  };

  /** 打怪点预置：按 "bvid#分P" 存，值是 [{t, chest, label}]
   *
   *  这张表不再是手工标的 5 个点，而是把 UP 主全集 4950 分钟跑图视频的字幕全跑了一遍，
   *  统计出「他说哪类话之后会叫你打怪」，再按概率表判出每一集该停的时刻。
   *  生成链路见 _vp/：asr_batch.py（转写）→ asr_to_corpus.js（语料）→
   *  train_pause.js（概率表）→ gen_schedule.js（这张表）。
   *
   *  实测：镇守宝箱之后要打怪的概率 82%、裸宝箱只有 14%、神瞳 16%、限时挑战 7%，
   *  所以「宝箱」这种词永远不会单独触发暂停——这就是最早"路上遇到宝箱也叫你停"的根治。
   *
   *  格式：bvid#分P=秒,秒,秒|bvid#分P=秒,...  （空串=这一集不用停）
   */
  const SCHED_RAW = "BV1BMgj6MEz4#2=337,368,438,727,815,944,1008|BV1BMgj6MEz4#3=73,150,409,699,w769|BV1BMgj6MEz4#4=w354,w501,520,775,958,984|BV1BMgj6MEz4#5=55,142,378,658,785,800,883,1012|BV1BMgj6MEz4#6=220,336,w757|BV1BMgj6MEz4#7=50,113,152,605,737,768|BV1BMgj6MEz4#8=213,w437|BV1BMgj6MEz4#9=77,395,503,691,830,873|BV1BMgj6MEz4#12=192,644|BV1BMgj6MEz4#13=w401,650,1086|BV1BMgj6MEz4#14=33,129,393|BV1BMgj6MEz4#15=23,75,252,291,312,354,373,w524,660|BV1BMgj6MEz4#16=17,74,w381,w690,796|BV1BMgj6MEz4#17=191,227,w248,597,669,829|BV1BMgj6MEz4#18=3,157,252,609,628,687,724|BV1BMgj6MEz4#19=105,130|BV1BMgj6MEz4#20=75,476,555|BV1BMgj6MEz4#21=66|BV1BMgj6MEz4#22=434,499|BV1BMgj6MEz4#23=w607|BV1BMgj6MEz4#24=872,951|BV1BMgj6MEz4#25=22,315|BV1BMgj6MEz4#27=92,144|BV1BMgj6MEz4#31=w572|BV1cE4m197fY#2=10|BV1cE4m197fY#3=307,425|BV1cE4m197fY#4=181|BV1cE4m197fY#5=85,108,212,347|BV1cE4m197fY#6=129,242,334|BV1cE4m197fY#7=36,92,221|BV1cE4m197fY#8=110|BV1cE4m197fY#9=199|BV1cE4m197fY#10=70,186,268|BV1cE4m197fY#11=10,175|BV1cE4m197fY#12=36,78|BV1cE4m197fY#13=91,163,372|BV1cE4m197fY#14=126,366,397|BV1cE4m197fY#16=45,112,197,330|BV1cE4m197fY#17=220|BV1cE4m197fY#18=22,187|BV1cE4m197fY#19=98,w146,156,188,228|BV1cE4m197fY#20=22,71,100,134,201|BV1cE4m197fY#22=9,46|BV1cE4m197fY#24=292|BV1cE4m197fY#25=238|BV1cE4m197fY#26=69,87,123,234|BV1cE4m197fY#28=91,173,297|BV1cE4m197fY#29=11,175|BV1cE4m197fY#30=83,342|BV1cE4m197fY#31=137,159,173,203,228,506,557,641,716|BV1cE4m197fY#32=59,243,353,385|BV1cE4m197fY#33=31,103,190,264|BV1cE4m197fY#34=8,87,111,225,275,311|BV1cE4m197fY#35=20,104,122,169,w241,286|BV1cE4m197fY#36=10,202,264|BV1cE4m197fY#37=13,60,69,111,135,180|BV1cE4m197fY#38=22,98,177,243,387,403|BV1cE4m197fY#39=233|BV1cE4m197fY#41=11|BV1cE4m197fY#43=32|BV1xw4m1v7cf#3=36,102,262,285,428,451,523,550,612,638,654|BV1xw4m1v7cf#4=87,420,446,597|BV1xw4m1v7cf#5=185|BV1xw4m1v7cf#6=60,253,272,376,595,619|BV1xw4m1v7cf#7=270,555,631,719,818|BV1xw4m1v7cf#8=40,178,217,425,451,595,843|BV1xw4m1v7cf#9=25,169,234,359|BV1xw4m1v7cf#10=262,548,578,623|BV1xw4m1v7cf#11=82|BV1xw4m1v7cf#12=51,207,657,683,809,871|BV1xw4m1v7cf#14=181,201,215,242|BV1xw4m1v7cf#15=41,179,316,370,609,624,696,770,791|BV1xw4m1v7cf#16=208,272,379,592|BV1xw4m1v7cf#17=130,520,570,665,718,746|BV1xw4m1v7cf#18=111,280|BV1xw4m1v7cf#19=89,150,335,429,448,542,635,744|BV1xw4m1v7cf#20=76,313,436,489|BV1xw4m1v7cf#21=74,125,156,439,470,553,658,682,734,806,866|BV1xw4m1v7cf#22=281,378,430|BV1xw4m1v7cf#23=31,120,182,236,375,436,w492,558,603,710|BV1xw4m1v7cf#25=130,166,234,285,384|BV1xw4m1v7cf#26=37,273,298,393|BV1xw4m1v7cf#27=318,401,430,484,543|BV1xw4m1v7cf#28=71,124,209,264,355,441,792|BV1xw4m1v7cf#29=149,246,323,375|BV1xw4m1v7cf#30=63,286,303,427|BV1xw4m1v7cf#32=114,w166,285|BV1xw4m1v7cf#33=335|BV1xw4m1v7cf#34=w293,554,637|BV1xw4m1v7cf#35=w63,69,94,210,432,588,810|BV1xw4m1v7cf#36=136,258,280,314,431|BV1xw4m1v7cf#37=107,131,162,216,343,402,474,527,583|BV1xw4m1v7cf#38=329,508|BV1xw4m1v7cf#39=19,197,219,260,442,574,598|BV1xw4m1v7cf#40=73,122,250,304,391,545|BV1xw4m1v7cf#41=157|BV1xw4m1v7cf#42=57,200,286,304,382,413|BV1xw4m1v7cf#43=88,234,501|BV1xw4m1v7cf#44=50,77,246,345,441,580|BV1xw4m1v7cf#45=69,117|BV1xw4m1v7cf#46=96,183,251,432,w580,585|BV1xw4m1v7cf#47=39,206,366,477,609|BV1xw4m1v7cf#48=35,51,81,103,342,389|BV1xw4m1v7cf#49=12,58,448,483,547,1060|BV1xw4m1v7cf#50=38,115,321|BV1xw4m1v7cf#53=351|BV13A4m1j7d8#2=69,w300,323|BV13A4m1j7d8#3=27,605,633|BV13A4m1j7d8#4=66,776|BV13A4m1j7d8#5=10,210,276,401,665,686|BV13A4m1j7d8#6=39,355|BV13A4m1j7d8#8=75,154,445,466|BV13A4m1j7d8#9=27,139,250|BV13A4m1j7d8#10=79,222,417|BV13A4m1j7d8#11=391,458,w766|BV13A4m1j7d8#13=68,160,423|BV13A4m1j7d8#14=452,w693|BV13A4m1j7d8#15=257,553|BV13A4m1j7d8#16=169,277,338,631|BV13A4m1j7d8#17=242,369,710,923|BV13A4m1j7d8#18=37,164,437,w494|BV13A4m1j7d8#19=151,216,w344,440,w536|BV13A4m1j7d8#20=61,297|BV13A4m1j7d8#21=235,279|BV13A4m1j7d8#22=16,359|BV13A4m1j7d8#23=332,w661|BV13A4m1j7d8#24=25,307,521|BV13zoeYeEuJ#2=w219,241,418|BV13zoeYeEuJ#3=w93,240,w370,w565|BV13zoeYeEuJ#4=120,157,222|BV13zoeYeEuJ#5=11,471,662|BV13zoeYeEuJ#6=240,276,410,502,w606|BV13zoeYeEuJ#7=447,609,625|BV13zoeYeEuJ#8=10|BV13zoeYeEuJ#9=9,w68,125,w833,972,1034,1083|BV13zoeYeEuJ#10=355,454,517|BV13zoeYeEuJ#11=27,131,182|BV13zoeYeEuJ#12=270,305,437|BV13zoeYeEuJ#13=51,197|BV13zoeYeEuJ#14=154,302,359,537|BV13zoeYeEuJ#15=107|BV13zoeYeEuJ#16=w247,450|BV13zoeYeEuJ#17=36,295|BV13zoeYeEuJ#18=43,67|BV13zoeYeEuJ#19=29,374,423|BV13zoeYeEuJ#20=291,330|BV14Z421L7DN#4=3,24,193,343|BV14Z421L7DN#5=87,160,372,411|BV14Z421L7DN#6=411|BV14Z421L7DN#7=50,147,417,w498,544,562|BV14Z421L7DN#8=27,118,377|BV14Z421L7DN#10=173,199,311,329,429|BV14Z421L7DN#11=25,202|BV14Z421L7DN#12=22,92,104,162,272,327,627,675,693,760,916,934|BV14Z421L7DN#13=66,79,507,598|BV14Z421L7DN#14=24,143,260|BV14Z421L7DN#15=90,113,358,382,462,505|BV14Z421L7DN#16=22,118,207|BV14Z421L7DN#17=10,130,161,w223|BV14Z421L7DN#19=67,w243,525|BV14Z421L7DN#20=15,172,202,222,297|BV14Z421L7DN#21=22,198|BV14Z421L7DN#22=143,177|BV14Z421L7DN#23=8|BV14Z421L7DN#24=10,54,167,384,520,679|BV14Z421L7DN#25=79,155,174,345|BV14Z421L7DN#27=8,62,509,525,597,651,764,787,938,w1105|BV14Z421L7DN#28=166|BV14Z421L7DN#29=9,127,318,358,w649|BV14Z421L7DN#30=46,82,486|BV14Z421L7DN#31=9,19,61,321,458,w645,w719|BV14Z421L7DN#32=92,898|BV14Z421L7DN#33=8,332,373,438|BV14Z421L7DN#34=w74,82,101,121,137,182,204,300,475,735,925|BV14Z421L7DN#37=44|BV14Z421L7DN#39=207|BV16z4y137cn#2=w323|BV16z4y137cn#3=41,301,w363|BV16z4y137cn#4=w271,317,555|BV16z4y137cn#5=130,340,w414,576|BV16z4y137cn#6=38,165,w279,312|BV16z4y137cn#8=14,263,441,597,678,843,1027|BV16z4y137cn#9=114,w223,267,573|BV16z4y137cn#10=398,408,460,705,763,1026|BV16z4y137cn#11=45,220|BV16z4y137cn#12=w67,190,236,257,460|BV16z4y137cn#13=27,243,357,510,564,636,724|BV16z4y137cn#14=276|BV16z4y137cn#15=187,254,274,310,361|BV16z4y137cn#16=198,411,w558,637,947,984|BV16z4y137cn#17=223,611,w675,686|BV16z4y137cn#18=139,316,630,887|BV1994y1q72z#2=82|BV1994y1q72z#3=400,468|BV1994y1q72z#4=w315,319|BV1994y1q72z#6=110,w207|BV1994y1q72z#7=75,w413,562|BV1994y1q72z#8=68,218|BV1994y1q72z#9=32,w122,206,346|BV1994y1q72z#10=w660|BV1994y1q72z#11=w311,552|BV1994y1q72z#13=w37,61,162,210|BV1994y1q72z#14=208,w281,490|BV1994y1q72z#15=w155,432,687,746,767,788,995|BV1994y1q72z#16=194,w632,1058,1154,1292|BV1994y1q72z#20=w660|BV1AihAz5EsW#3=211,406,443,537|BV1AihAz5EsW#4=w58,73,183,w326,391,539|BV1AihAz5EsW#5=w74,w283,306,w355|BV1AihAz5EsW#6=w262|BV1AihAz5EsW#7=185,231,395,558|BV1AihAz5EsW#8=188,w387,w494,w720|BV1AihAz5EsW#9=189,204,322|BV1AihAz5EsW#10=17,116,w212,246|BV1AihAz5EsW#11=w185,w342,w516,658|BV1AihAz5EsW#12=w57,w317|BV1AihAz5EsW#13=24,173,193,483,649,826|BV1AihAz5EsW#14=118|BV1AihAz5EsW#15=79,402,w557|BV1AihAz5EsW#16=158,350,369,454|BV1AihAz5EsW#17=32,84,w262,294,317,355,450,w640,715|BV1AihAz5EsW#18=w68|BV1AihAz5EsW#21=142|BV1BWknYKEgB#3=141,234,282,300,384,406,431|BV1BWknYKEgB#4=31,49,499,546|BV1BWknYKEgB#5=3,42,247,266,377,458|BV1BWknYKEgB#6=128,406,447|BV1BWknYKEgB#7=129,w217,264|BV1BWknYKEgB#8=52,420,567,603|BV1BWknYKEgB#9=77,w558,w739|BV1BWknYKEgB#10=47,155,317,383|BV1BWknYKEgB#11=118|BV1BWknYKEgB#12=39,98,144,w238,483,689,766|BV1BWknYKEgB#13=109,432|BV1BWknYKEgB#14=156,315,787|BV1BWknYKEgB#15=443,607,w981|BV1BWknYKEgB#16=96,122,185,374,451,504|BV1BWknYKEgB#17=69,214,557|BV1CMHQzsEJV#3=71,w300|BV1CMHQzsEJV#4=164,190,261,298,325,358|BV1CMHQzsEJV#5=123,264|BV1CMHQzsEJV#7=29,w272,w433,474,508,541,568,708|BV1CMHQzsEJV#9=173,201,253,269|BV1CMHQzsEJV#10=44,w206|BV1CMHQzsEJV#11=132,293,322|BV1CMHQzsEJV#12=117,156,505|BV1CMHQzsEJV#13=13,24,48,w244,303,338,365|BV1CMHQzsEJV#14=289,476,491|BV1CMHQzsEJV#15=9,70|BV1CMHQzsEJV#16=10,82,246,369,393|BV1CMHQzsEJV#18=18,73,218,435|BV1CMHQzsEJV#19=70,274|BV1CMHQzsEJV#20=38,204|BV1CMHQzsEJV#21=150,w242,270,287|BV1CMHQzsEJV#22=17,241,549,571,602|BV1CMHQzsEJV#23=16,62,185|BV1CMHQzsEJV#24=13,86,w225,270|BV1CMHQzsEJV#25=36,131,184,202,256,273|BV1CMHQzsEJV#26=14,34,88,118,176,222|BV1CMHQzsEJV#27=104,277,399|BV1CMHQzsEJV#28=107,151,273,297,310,363|BV1CMHQzsEJV#29=57|BV1CMHQzsEJV#30=14,292,442,625|BV1CMHQzsEJV#38=114,486|BV1Cm4y1n7VS#3=198,226,233|BV1Cm4y1n7VS#4=14,91,174,280,357,424,466,483,584|BV1Cm4y1n7VS#5=w226,307|BV1Cm4y1n7VS#6=24,73,177|BV1Cm4y1n7VS#7=32,w77,203,527,1029,1061|BV1Cm4y1n7VS#8=67,451,491,608,w677,799,822|BV1Cm4y1n7VS#9=19,423,466,w562|BV1Cm4y1n7VS#10=w125,w290,345,368|BV1Cm4y1n7VS#11=256,291,337,w708,735,765|BV1Cm4y1n7VS#14=w93,389,w479,668|BV1Cm4y1n7VS#15=w36,297,w675,w943,965|BV1Cm4y1n7VS#16=w311|BV1Cm4y1n7VS#17=231,401,463,563|BV1Cm4y1n7VS#18=w585|BV1Cm4y1n7VS#20=35|BV1Cm4y1n7VS#21=225,w299,w466,w640|BV1Cm4y1n7VS#23=18|BV1Cm4y1n7VS#25=34,w134,210,782,w849,955|BV1Cm4y1n7VS#27=88|BV1Cm4y1n7VS#29=w252,w419|BV1Cm4y1n7VS#35=110|BV1P24y1A7J4#2=w105,149|BV1P24y1A7J4#3=134,294,338,379|BV1P24y1A7J4#4=132,289,605|BV1P24y1A7J4#5=143,w318,704|BV1P24y1A7J4#6=w83,361,383,416,494|BV1P24y1A7J4#7=9,74,w301,317,358,528,609,739,852,976,1086,1126,1144,1186|BV1P24y1A7J4#8=27,60,112,588,636,659,1056,1140,1294|BV1P24y1A7J4#9=12,71,121,291,w758|BV1P24y1A7J4#10=350,w513|BV1P24y1A7J4#11=85,172,473|BV1P24y1A7J4#12=268,625|BV1P24y1A7J4#13=19,w510,602|BV1P24y1A7J4#14=187,250,488|BV1P24y1A7J4#15=99,152,w335,w515,957|BV1P24y1A7J4#20=71,105,128,185,259|BV1P24y1A7J4#22=125,294|BV1P6SNYREo8#2=75,242,346|BV1P6SNYREo8#3=142,348,692|BV1P6SNYREo8#4=14,208,247,268,333,358,707|BV1P6SNYREo8#5=w346,597|BV1P6SNYREo8#6=384,692|BV1P6SNYREo8#7=w442,571|BV1P6SNYREo8#8=68,229,470,685|BV1P6SNYREo8#9=51,401,458,869|BV1P6SNYREo8#10=30,257,298,395|BV1P6SNYREo8#11=527,564,676,954,992,1074|BV1P6SNYREo8#12=w78,87,202,327,437,473,815|BV1P6SNYREo8#13=21,185,561,w621,634,750|BV1P6SNYREo8#14=17,70,165,184,247,321,355,382,476,571|BV1P6SNYREo8#15=85,283,378,541|BV1P6SNYREo8#16=98,243,559|BV1P6SNYREo8#17=97,189,227,276,404,474,551,699|BV1P6SNYREo8#18=76,100,131,368|BV1Qz4y1n7DK#2=78|BV1Qz4y1n7DK#3=110,w149|BV1Qz4y1n7DK#4=75,w413|BV1Qz4y1n7DK#5=91,308,w533|BV1Qz4y1n7DK#6=w76,826,1052,w1124|BV1Qz4y1n7DK#8=w642,w1086,1182,w1326|BV1Qz4y1n7DK#9=121,w785|BV1Qz4y1n7DK#10=w95,w312,556|BV1Qz4y1n7DK#11=w67,389,w512|BV1Qz4y1n7DK#12=w325|BV1Qz4y1n7DK#14=315|BV1Qz4y1n7DK#16=66,138,183,240,w402|BV1Qz4y1n7DK#17=109,220|BV1Qz4y1n7DK#23=70,w407|BV1Qz4y1n7DK#25=62,130,179,234,w397|BV1YiDjB8EK9#2=60,w137,155,195,211,244,304,w425,450,470,627,666|BV1YiDjB8EK9#3=w88,195,w469,494,w529,689,751,817|BV1YiDjB8EK9#5=101,156,192,w287,348,387|BV1YiDjB8EK9#7=337,356|BV1YiDjB8EK9#8=w202,205,461,480|BV1YiDjB8EK9#9=81,279,365,w479,506|BV1YiDjB8EK9#10=251,695,w828|BV1YiDjB8EK9#11=6,87,285,422,460|BV1YiDjB8EK9#12=98|BV1YiDjB8EK9#13=222|BV1YiDjB8EK9#14=w77|BV1YiDjB8EK9#15=w166|BV1YiDjB8EK9#16=209|BV1YiDjB8EK9#17=51,352,w413,w549,626,668|BV1YiDjB8EK9#19=74,171,187,475,730|BV1fH4y1w7f1#2=44|BV1fH4y1w7f1#4=75,443,498,682|BV1fH4y1w7f1#5=404,564|BV1fH4y1w7f1#6=56|BV1fH4y1w7f1#7=w257|BV1fH4y1w7f1#9=40|BV1fH4y1w7f1#10=18|BV1fH4y1w7f1#12=461,600|BV1fH4y1w7f1#14=140,236|BV1fH4y1w7f1#15=66|BV1qH4y1A74y#2=12,419|BV1qH4y1A74y#3=99,180|BV1qH4y1A74y#4=17,71|BV1qH4y1A74y#5=207|BV1qH4y1A74y#6=214,475|BV1qH4y1A74y#7=17,74|BV1qH4y1A74y#8=33,w289|BV1qH4y1A74y#9=71,w196,217,267,451|BV1qH4y1A74y#11=363|BV1qH4y1A74y#14=347,406|BV1qprpBcEZN#2=55,86,168|BV1qprpBcEZN#3=114|BV1qprpBcEZN#4=270,416|BV1qprpBcEZN#5=10|BV1qprpBcEZN#6=56,349|BV1qprpBcEZN#7=81,253,281,326|BV1qprpBcEZN#8=46,134,248,289|BV1qprpBcEZN#9=364,399,458|BV1qprpBcEZN#10=68,319,389,592,726|BV1qprpBcEZN#11=49,303,332,398|BV1qprpBcEZN#12=84,142,465,w537,578,776|BV1qprpBcEZN#13=117,269|BV1qprpBcEZN#14=44,71,195,337|BV1qprpBcEZN#15=149,375,400|BV1qprpBcEZN#16=17,91,143,163,187,208,273|BV1qprpBcEZN#19=171,295|BV1uMTY6aEZv#2=17,196,313|BV1uMTY6aEZv#3=33,124,149,184,281|BV1uMTY6aEZv#4=218,377,418,504,685|BV1uMTY6aEZv#5=149|BV1uMTY6aEZv#6=44,290,w440|BV1uMTY6aEZv#7=37,78,299|BV1uMTY6aEZv#8=232,307|BV1uMTY6aEZv#9=101,183,217,276,524|BV1uMTY6aEZv#10=13,136,292,317,402,439,w519,636,677|BV1uMTY6aEZv#11=339,361,446,563,582|BV1uMTY6aEZv#12=35,256|BV1uMTY6aEZv#13=51,217,255|BV1uMTY6aEZv#16=18,136,662,755|BV1uMTY6aEZv#17=169,301,528|BV1uMTY6aEZv#18=121|BV1uMTY6aEZv#19=133,w288,337,390|BV1uMTY6aEZv#23=157|BV1ww411x7rm#2=79,w422,589|BV1ww411x7rm#3=18,51|BV1ww411x7rm#4=12,109,214|BV1ww411x7rm#5=160,558,797,985|BV1ww411x7rm#6=208|BV1ww411x7rm#7=182,389|BV1ww411x7rm#9=22|BV1ww411x7rm#10=70,123|BV1ww411x7rm#11=24,172,294,535,552|BV1ww411x7rm#12=52,71,318,727,817|BV1ww411x7rm#13=13,36,w138,403|BV1ww411x7rm#14=w40,436,590,728|BV1ww411x7rm#15=67,321,471|BV1ww411x7rm#16=w58,71,455,518,547|BV1ww411x7rm#17=13,275|BV1ww411x7rm#18=498|BV1ww411x7rm#19=w129,259,375,405|BV1ww411x7rm#20=82,284,w513";
   /* 由 _vp/gen_schedule.js 生成：566 集 / 4950 分钟 / 1526 个暂停点（打怪 1356 + 看完挑战/boss 170），别手改 */
  /* ==========================================================================
   *  本地视频：扫 assets/videos/ 下能直接播的文件
   *  BGI 0.45.1+ 才有 file.readPathSync；老版本拿不到就返回空数组，
   *  页面那边只是不显示「本地视频」这一栏，不会报错。
   * ========================================================================== */
  const LOCAL_DIR = "assets/videos";

  function listLocalVideos() {
    const out = [];
    try {
      if (typeof file === "undefined" || !file || typeof file.readPathSync !== "function") return out;
      let ps = file.readPathSync(LOCAL_DIR);
      ps = Array.from(ps || []);
      for (let i = 0; i < ps.length; i++) {
        const raw = String(ps[i] || "").replace(/\\/g, "/").trim();
        if (!raw) continue;
        const name = raw.split("/").pop();
        // 只认浏览器能直接放的容器；.mkv/.avi 多数内核解不了，别列出来误导人
        if (!/\.(mp4|m4v|webm|mov)$/i.test(name)) continue;
        try {
          if (typeof file.isFolder === "function" && file.isFolder(ps[i])) continue;
        } catch (e) { }
        if (out.indexOf(name) < 0) out.push(name);
      }
    } catch (e) {
      log.warn("扫描本地视频失败：" + ((e && e.message) ? e.message : String(e)));
    }
    out.sort();
    return out;
  }

  /* ==========================================================================
   *  BGI 实时触发保活：自动拾取 / 自动剧情（v1.6.29）
   *
   *  现象：装上浮窗后，BGI 的「自动拾取」不捡东西、「自动剧情」卡在对话里。
   *  根因不是鼠标穿透，也不是抢焦点，而是 BGI 的设计：跑 JS 脚本前会把它自己的
   *  实时触发全部关掉（官方 FAQ「为什么不拾取/不吃药/不点剧情」写得很直白：
   *  「你在实时触发里的所有配置都会在 JS 脚本运行前关闭……除非 JS 作者在代码中开启」）。
   *
   *  做法：用 dispatcher.addTrigger() 重新注册 RealtimeTimer 把任务挂回去。
   *  必须用 addTrigger 而不是 addTimer —— 后者会把已挂的任务全清掉。
   *
   *  只挂用户在 BGI 里本来就开着的：读 <BGI>\User\config.json 里的
   *  autoPickConfig.enabled / autoSkipConfig.enabled 判断，关着的不强行开。
   *  读不到（老版本 BGI / 文件被锁 / 路径受限）就按设置面板那两个勾选走，默认开。
   *
   *  另一个已知限制：这些任务靠截图识别，如果浮窗正好压在「拾取提示」或「对话选项」
   *  上，识别区域被视频挡住就会失效。要么把窗口挪开，要么在 BGI 启动页把截图方式
   *  换成 WindowsGraphicsCapture（只截游戏窗口内容，不含浮窗）。
   * ========================================================================== */
  const BGI_USER_CONFIG = "../../config.json";   // 脚本在 User/JsScript/VideoMask 下

  function readBgiUserConfig() {
    try {
      if (typeof file === "undefined" || !file || typeof file.readTextSync !== "function") return null;
      let txt = null;
      const tries = [BGI_USER_CONFIG, "..\\..\\config.json"];
      for (let i = 0; i < tries.length && txt === null; i++) {
        try { txt = file.readTextSync(tries[i]); } catch (e) { txt = null; }
      }
      if (!txt) return null;
      const s = String(txt).replace(/^\uFEFF/, "").trim();
      if (!s) return null;
      const o = JSON.parse(s);
      return (o && typeof o === "object") ? o : null;
    } catch (e) {
      return null;
    }
  }

  // 返回 true / false / null（null = 不知道，按默认开）
  function bgiEnabledFlag(cfg, key) {
    if (!cfg) return null;
    const sec = cfg[key];
    if (!sec || typeof sec !== "object") return null;
    if (typeof sec.enabled === "boolean") return sec.enabled;
    if (typeof sec.Enabled === "boolean") return sec.Enabled;
    return null;
  }

  function restoreBgiRealtimeTasks() {
    const want = [
      { name: "AutoPick", label: "自动拾取", cfgKey: "autoPickConfig", on: CFG.bgiKeepPick },
      { name: "AutoSkip", label: "自动剧情", cfgKey: "autoSkipConfig", on: CFG.bgiKeepSkip },
    ];
    let anyOn = false;
    for (let i = 0; i < want.length; i++) if (want[i].on) anyOn = true;
    if (!anyOn) {
      log.info("设置里「自动拾取」「自动剧情」的共存开关都关着：不替 BGI 挂回实时触发。");
      return;
    }
    if (typeof dispatcher === "undefined" || !dispatcher || typeof dispatcher.addTrigger !== "function") {
      log.warn("⚠ 这个 BGI 版本没有 dispatcher.addTrigger，没法把自动拾取/自动剧情挂回来（需要较新的 BGI）。" +
        "升级 BGI 后重开脚本即可；不升级就只能二选一：要么关浮窗，要么只玩浮窗。");
      return;
    }
    if (typeof RealtimeTimer === "undefined") {
      log.warn("⚠ 这个 BGI 版本没有 RealtimeTimer，没法把自动拾取/自动剧情挂回来，请升级 BGI。");
      return;
    }

    const cfg = readBgiUserConfig();
    if (!cfg) {
      log.warn("读不到 BGI 的 User/config.json（不影响看视频）。自动拾取/自动剧情先按默认挂上，" +
        "如果 BGI 里本来是关的，取消勾选设置里的那两项就行。");
    }

    const added = [], offInBgi = [], failed = [];
    for (let i = 0; i < want.length; i++) {
      const w = want[i];
      if (!w.on) continue;
      if (bgiEnabledFlag(cfg, w.cfgKey) === false) { offInBgi.push(w.label); continue; }
      try {
        dispatcher.addTrigger(new RealtimeTimer(w.name));
        added.push(w.label);
      } catch (e) {
        failed.push(w.label + "（" + ((e && e.message) ? e.message : String(e)) + "）");
      }
    }
    if (added.length) {
      log.info("已把 BGI 的实时触发挂回来：" + added.join("、") +
        "。BGI 跑 JS 脚本时会默认把它们关掉，不挂回来就是「开了浮窗就不捡东西、不过剧情」。");
    }
    if (offInBgi.length) log.info("BGI 设置里本来就关着，不强行打开：" + offInBgi.join("、"));
    if (failed.length) {
      log.warn("这些实时触发没挂上：" + failed.join("；") + "。可以到 BGI 里手动确认，或升级 BGI 版本。");
    }
  }

  /* 暂停密度：同一集里两个点靠得太近就合并，否则连着停两次很烦。
   * 语料里确实有这种重复——同一波怪他可能先后说两句「把怪清一下」，
   * 中间只隔十几秒（最短的一对只差 3 秒）。原样播会停一下、点继续、十几秒后又停。
   *
   * 规则：时间相邻且间隔 < markGap 秒的，只留一个；
   *   - 有 B 类（w，看完再停）优先留 B 类；
   *   - 同类就留早的那个（他真正喊"清一下"的第一句）。
   * markGap = 0 表示不合并（想完整看所有点就设 0）。 */
  const MARK_GAP = Math.max(0, num("markGap", 20));

  function mergeCloseMarks(list, gap) {
    if (!(gap > 0) || list.length < 2) return list;
    const sorted = list.slice().sort(function (a, b) { return a.t - b.t; });
    const kept = [];
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const prev = kept[kept.length - 1];
      if (prev && cur.t - prev.t < gap) {
        // 冲突：B 类优先；同级保留先到的那个
        if (cur.w && !prev.w) kept[kept.length - 1] = cur;
        continue;
      }
      kept.push(cur);
    }
    return kept;
  }

  const MARK_PRESET = (function () {
    const out = {};
    String(SCHED_RAW || "").split("|").forEach(function (seg) {
      if (!seg) return;
      const at = seg.indexOf("=");
      if (at < 0) return;
      const key = seg.slice(0, at);
      /* 两种点：纯数字 = 喊打怪就停（A 类）；w 前缀 = 挑战/打boss，整段看完再停（B 类）
       * B 类停早了等于没教——用户刚听到"这边有个限时挑战"就被切断，不知道怎么往里跑。 */
      const ts = seg.slice(at + 1).split(",").map(function (s) {
        const w = s.charAt(0) === "w";
        const n = Math.round(Number(w ? s.slice(1) : s) || 0);
        return n > 0 ? { t: n, w: w } : null;
      }).filter(Boolean);
      if (!ts.length) return;
      out[key] = mergeCloseMarks(ts, MARK_GAP).map(function (x) {
        return { t: x.t, chest: 0, w: x.w, label: x.w ? "看完再打" : "打怪" };
      });
    });
    return out;
  })();

  function marksAll() {
    try {
      const raw = st.vmMarks;
      if (!raw) return {};
      const o = JSON.parse(String(raw));
      return (o && typeof o === "object") ? o : {};
    } catch (e) {
      return {};
    }
  }

  function markKey(bvid, page) {
    return String(bvid || "") + "#" + (Number(page) || 1);
  }

  function marksFor(bvid, page) {
    const key = markKey(bvid, page);
    const all = marksAll();
    if (Object.prototype.hasOwnProperty.call(all, key)) return all[key] || [];
    const pre = MARK_PRESET[key];
    return pre ? pre.slice() : [];
  }

  function saveMarks(bvid, page, list) {
    const key = markKey(bvid, page);
    const all = marksAll();
    all[key] = (list || []).map(function (m) {
      return {
        t: Math.round(Number(m.t) * 10) / 10,
        chest: Number(m.chest) || 0,
        /* w = 挑战/BOSS 类，播放器靠它区分"看完再停"和"喊打怪就停"，别在存盘时丢掉 */
        w: m.w ? 1 : 0,
        label: String(m.label || (m.w ? "看完再打" : "打怪"))
      };
    });
    try { st.vmMarks = JSON.stringify(all); } catch (e) { }
    log.info("打怪点已保存（" + key + "）：" + all[key].length + " 个");
  }

  /* ==========================================================================
   *  二、运行状态
   * ========================================================================== */

  const saved = CFG.resetLayout ? null : loadSavedLayout();

  /**
   * 上次存的坐标如果已经落在屏幕外（换了分辨率、拔了副屏、误拖出边界），
   * 窗口就会"建了但看不见"。这种时候直接回落到默认位置，别让用户对着空屏发呆。
   */
  function sanePos(v, def) {
    if (v === null || v === undefined || v === "") return def;
    const n = Number(v);
    if (!isFinite(n)) return def;
    if (n < -4 || n > 10000) return def;
    return n;
  }
  function saneSize(v, def) {
    if (v === null || v === undefined || v === "") return def;
    const n = Number(v);
    if (!isFinite(n) || n < 160 || n > 4000) return def;
    return n;
  }

  const state = {
    winId: null,
    layout: {
      x: sanePos(saved && saved.x, 16),
      y: sanePos(saved && saved.y, 470),
      w: saneSize(saved && saved.w, 360),
      h: saneSize(saved && saved.h, 203),
    },
    // 上一版存的是绝对像素，跨分辨率就没意义了；比例才是真正可复用的那份
    ratio: (saved && saved.ratio && typeof saved.ratio === "object") ? saved.ratio : null,
    baseVw: (saved && isFinite(saved.baseVw)) ? Number(saved.baseVw) : 0,
    baseVh: (saved && isFinite(saved.baseVh)) ? Number(saved.baseVh) : 0,
    // 游戏分辨率（getGameMetrics），用来发现"切了全屏/改了分辨率"
    metric: null,
    metricAt: 0,
    metricBroken: false,
    opacity: (saved && isFinite(saved.opacity)) ? Number(saved.opacity) : CFG.opacity,
    speed: (saved && isFinite(saved.speed)) ? Number(saved.speed) : CFG.speed,
    volume: (saved && isFinite(saved.volume)) ? Number(saved.volume) : CFG.volume,
    resumeTime: (saved && isFinite(saved.t) && saved.resumeEnabled === true) ? Number(saved.t) : 0,
    file: (saved && saved.file) ? String(saved.file) : (CFG.videoUrl || CFG.videoFile),
    curBvid: "",
    curPage: 1,
    src: null,
    hidden: false,
    interactive: !CFG.clickThrough,
    geom: null,
    dragging: false,
    scrubbing: false,     // 页面正在拖进度条：这段时间别做穿透切换，否则手一停就断
    hoverOutAt: 0,
    graceUntil: 0,
    geomLogged: false,
    holdDown: false,      // 正按住"临时接管键"（默认 Alt）
    holdUpAt: 0,          // 松开的时间戳（主循环据此延迟切回穿透）
    // 侧栏（系列栏）开着时保持可交互，不然一点就穿透、点不到。
    // v1.6.28 起它不再是"永久钉住"：松开临时接管键（Alt）、或浮窗把鼠标还给游戏时，
    // 主循环会主动给页面发 closeside，让系列栏自己收回去（用户要的就是这个手感）。
    pinned: false,
    sideOpen: false,      // 系列栏当前是不是开着（和 pinned 同步，单独留一个给 closeside 判重）
    folded: false,        // 页面已收起成一条控制条：鼠标搭上去就能操作（整条都是热区）
    resizeMode: false,    // 缩放模式：按一下热键进入并常驻，再按一下退出
    resizeAt: 0,          // 上一次按缩放热键的时间
    // 正在改键：等待用户按下一个键（值是 HOTKEY_DEFS 里的 id；null=不在改）
    keyCap: null,
    keyCapAt: 0,          // 进入改键状态的时间（10 秒没按就自动取消）
    // 浮窗页面有没有键盘焦点（页面 focus/blur 上报；null = 还没上报过）。
    // 只记日志，不参与任何判断 —— 关键事实：BGI 的 setClickThrough(false) 里那句
    // Activate() 并不会让页面拿到键盘焦点（要点一下页面才有），所以刚进缩放模式时
    // 这个值一直是 false。拿它当"你是不是切走了"的判据会被骗（v1.6.3/v1.6.5 都栽在这）。
    pageFocus: null,
    focusLogged: false,   // 焦点日志只打一次，免得刷屏
    lastUxAt: 0,          // 最后一次真正操作浮窗的时间（拖/点/滚轮，不含自动上报的进度）
    ctCheckedAt: 0,       // 上一次"穿透状态对账"的时间
    preloadAt: 0,         // 后台预建分类索引的启动时间戳（0=还没排）
    preloadDone: false,   // 预建是否已经启动过（只启动一次）
    loginAt: 0,           // 登录窗打开的时间（用来超时自动关）
    playing: false,
    time: 0,
    duration: 0,
    pageReady: false,
  };

  /**
   * 把一条配置解析成"视频源"：
   *   BV1Hcbe6rEaa                      → 在线（B站外链播放器）
   *   https://www.bilibili.com/video/BV… → 在线（自动提取 BV 和分P）
   *   https://xxx/yyy.mp4               → 在线直链
   *   1.mp4 / 须弥/1.mp4                → 本地文件
   */
  function parseSource(spec) {
    const s = String(spec == null ? "" : spec).trim();
    if (!s) return null;

    const bv = s.match(/BV[0-9A-Za-z]{10}/);
    if (bv) {
      let page = 1;
      const pm = s.match(/[?&]p=(\d+)/);
      if (pm) page = parseInt(pm[1], 10) || 1;
      let t = 0;
      const tm = s.match(/[?&]t=(\d+)/);
      if (tm) t = parseInt(tm[1], 10) || 0;
      return {
        kind: "bili",
        bvid: bv[0],
        page: page,
        t: t,
        spec: s,
        label: bv[0] + (page > 1 ? (" P" + page) : ""),
      };
    }

    if (/^https?:\/\//i.test(s)) {
      return { kind: "url", url: s, spec: s, label: s };
    }

    return { kind: "file", file: s, spec: s, label: s };
  }

  const specText = CFG.videoUrl ? CFG.videoUrl : CFG.videoFile;
  let sources = String(specText)
    .split(/[,;\n]/)
    .map(s => parseSource(s))
    .filter(Boolean);
  if (!sources.length) sources = [parseSource("1.mp4")];

  let srcIndex = 0;
  for (let i = 0; i < sources.length; i++) {
    if (sources[i].spec === state.file) { srcIndex = i; break; }
  }
  // v1.6.8：默认先不放视频（黑屏白字，让用户自己从系列栏选地图）。
  // sources 照样留着给"上一个 / 下一个"用，只是不预先塞进播放器。
  //
  // v1.6.25：**不再"一启动就一大块黑屏"**。别人第一次用，看到一块纯黑会以为脚本坏了。
  // 现在的规则：
  //   1. 有上次观看记录（vmLast）→ 直接把那一集接回来，自动播；进度按「记住播放进度」决定要不要回溯。
  //   2. 完全没有记录（第一次用 / 记录过期）→ 才进空白引导页，但这页已改成半透明，
  //      游戏画面能透出来，不会再像"黑屏卡死"。
  let bootSrc = null;
  let bootResume = 0;
  if (CFG.startBlank) {
    const lw = readLastWatch();
    if (lw) {
      if (lw.bvid) {
        const pg = Number(lw.page) || 1;
        bootSrc = {
          kind: "bili", bvid: lw.bvid, page: pg, t: 0,
          spec: lw.bvid + (pg > 1 ? ("?p=" + pg) : ""),
          label: lw.bvid + (pg > 1 ? (" P" + pg) : ""),
        };
      } else if (lw.file) {
        bootSrc = { kind: "file", file: lw.file, spec: lw.file, label: lw.file };
      }
      if (bootSrc) bootResume = CFG.resume && lw.t > 1 ? lw.t : 0;
    }
  } else {
    bootSrc = sources[srcIndex];
  }
  state.src = bootSrc;
  state.file = state.src ? state.src.spec : "";
  state.resumeTime = bootResume;

  /* ==========================================================================
   *  三、小工具
   * ========================================================================== */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function round(v, n) { const p = Math.pow(10, n); return Math.round(v * p) / p; }
  function normKey(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

  /* 符号键的"同一个物理键、不同叫法"。
   * BGI 报上来的键名不统一：OemTilde / Oem3 / tilde / ` / ~ 都见过（跟键盘布局、
   * BGI 版本都有关）。这里统一折叠成 "`"，这样设置里写一个「~」能命中所有形式。
   * 为什么值得专门处理：不少笔记本的 F9 是亮度/音量功能键，按下去先被系统吃掉，
   * 波浪号那颗键（Esc 下面）反而最安全。 */
  function canonKey(s) {
    const k = normKey(s);
    if (k === "~" || k === "`" || k === "oemtilde" || k === "oem3" ||
      k === "tilde" || k === "grave") return "`";
    return k;
  }

  function send(url, data) {
    if (!state.winId) return;
    try {
      htmlMask.send(state.winId, url, JSON.stringify(data || {}));
    } catch (e) { }
  }

  function cmd(action, value) {
    send("/cmd", { a: action, v: value });
  }

  /**
   * 让页面把系列栏收回去。
   *
   * 为什么要脚本侧来管：页面的 openSide() 会把侧栏"钉住"（/pin on），
   * 钉住期间脚本不做穿透切换 —— 结果按 Alt 打开系列栏、选完视频松开 Alt，
   * 侧栏就一直挂在那儿，得再点一下「⧉」才关得掉。
   * 现在改成：只要"这一轮操作结束了"（松开 Alt / 鼠标还给游戏），就把它收回。
   * sideClosing 这段标志是为了剪掉 closeside → /pin off → setInteractive(false) →
   * 又发一次 closeside 的回环。
   */
  function closeSidePanel(reason) {
    if (!state.sideOpen) return false;
    // 先把标志落下再发指令：页面回 /pin{on:false} 时会再走一遍 setInteractive(false)，
    // 那时 sideOpen 已经是 false，不会又发一次 closeside。
    state.sideOpen = false;
    state.pinned = false;
    cmd("closeside");
    if (reason) log.info("系列栏自动收回（" + reason + "）。");
    return true;
  }

  function setInteractive(on) {
    on = !!on;
    if (state.interactive === on) return;
    state.interactive = on;
    // 鼠标一还给游戏，系列栏就没有存在的意义了（它是"临时挑片"的工具，不是常驻面板）。
    // 放在这里一举覆盖所有"退出可交互"的来路：松 Alt、悬停移出、空闲自动穿透、
    // 退出缩放模式、摆位宽限期结束……不用每处都补一遍。
    if (!on) closeSidePanel("鼠标已还给游戏");
    if (!state.winId) return;
    try { htmlMask.setClickThrough(state.winId, !on); } catch (e) { }
    cmd("interactive", on);
  }

  /**
   * 强制把"可交互"重新应用一遍（绕过 setInteractive 的"状态没变就早退"）。
   *
   * 为什么要这个：按 Win 键去浏览器/桌面干点事再回来，浮窗的键盘焦点已经没了，
   * 但 state.interactive 还是 true，于是 setInteractive(true) 直接 return，
   * BGI 那边的 setClickThrough(false) 根本不会被再次调用 —— 而"抢回前台 +
   * Activate"这个动作是在 BGI 的 SetClickThrough 里做的。结果就是：看着像还在
   * 缩放模式，实际操作全落进游戏。所以需要一条能重复触发的路。
   */
  function reapplyInteractive() {
    if (!state.winId) return false;
    try { htmlMask.setClickThrough(state.winId, false); } catch (e) { return false; }
    state.interactive = true;
    cmd("interactive", true);
    return true;
  }

  let ctApiOk = null;   // null=还没试过；false=这个 BGI 版本没有 getClickThrough

  /**
   * 穿透状态对账：拿窗口的真实样式（BGI 的 getClickThrough）和我们的期望比，不一致就拉正。
   * 只有"需要可交互"时才会顺手抢前台；切成穿透不会抢焦点，对游戏没影响。
   * 老版本 BGI 没有这个方法，调用会抛异常 —— 那就只提示一次然后彻底跳过。
   */
  function reconcileClickThrough(now) {
    if (ctApiOk === false) return;
    if (!state.winId || !state.pageReady) return;
    if (now - state.ctCheckedAt < 1500) return;
    state.ctCheckedAt = now;
    if (ctApiOk === null) {
      ctApiOk = (typeof htmlMask.getClickThrough === "function");
      if (!ctApiOk) {
        log.info("这个 BGI 版本没有 htmlMask.getClickThrough，跳过穿透状态对账（其它功能不受影响）。");
        return;
      }
    }
    let actual;
    try { actual = htmlMask.getClickThrough(state.winId); } catch (e) { return; }
    if (actual !== false && actual !== true) return;
    // actual 是"是否穿透"，和 interactive 正好相反，一致就别动
    if (actual === !state.interactive) return;
    try { htmlMask.setClickThrough(state.winId, !state.interactive); } catch (e) { return; }
    log.info("交互状态对账：窗口被切成了穿透，已按当前模式恢复成可交互。");
  }

  /**
   * 【v1.6.8 已删除】dropToGame / "/through" —— "单击画面就把鼠标还给游戏"。
   *
   * 删掉的原因：这个手势的判定太软（按下到松开移动 ≤3px、时长 <500ms），
   * 想把鼠标移到暂停键上结果点空了、拖完窗口松手、手抖一下，全都会被当成
   * "这一下我要点游戏"，鼠标瞬间穿回游戏、浮窗点不动，非常烦。
   *
   * 现在要还鼠标给游戏有两条明确的路：
   *   1) 按缩放热键（默认 Insert）退出缩放模式 → setInteractive(false)；
   *   2) 什么都不碰，hoverExit / 25 秒空闲后自动穿透。
   * 两条路径都仍然【不动播放状态】。
   */

  /**
   * 后台预建分类索引：侧栏点开之前就建好，不用再等十几秒。
   *
   * 主循环里比时间戳触发（BGI 的 JS 环境没有 setTimeout），只跑一次；
   * 有缓存时会直接走缓存（几乎瞬间），过期了才真的去 B 站拉。
   */
  function preloadTick(now) {
    if (state.preloadDone || !state.preloadAt || now < state.preloadAt) return;
    state.preloadDone = true;
    if (!CFG.catalogOn) return;
    log.info("后台预建分类索引（不影响播放）：侧栏「分」点开就是现成的。");
    Promise.resolve().then(function () { return indexCatalog(false); })
      .catch(function (e) { log.warn("预建分类索引出错：" + ((e && e.message) ? e.message : e)); });
  }

  /**
   * 登录窗超时兜底：登录窗是全屏置顶的独立窗口，万一热键也没按（人走了、
   * 或者改过键名忘了），五分钟后自动关掉，不让游戏一直进不去。
   */
  function loginTick(now) {
    if (!state.loginAt) return;
    if (now - state.loginAt < 5 * 60000) return;
    state.loginAt = 0;
    let alive = false;
    try { alive = htmlMask.exists("bili_login"); } catch (e) { alive = false; }
    if (!alive) return;
    try { htmlMask.close("bili_login"); } catch (e) { }
    log.warn("登录窗开了 5 分钟还没关，已自动关闭（避免一直挡住游戏）。");
    toast("登录窗已自动关闭");
    cmd("reload");
  }

  /**
   * 缩放热键：单纯的开/关。
   *
   * v1.6.6 起把"两段式"删掉了 —— 它靠页面上报的 document.hasFocus() 判断
   * "浮窗是不是被切走了"，可实测在这个 WebView2 里 hasFocus 一直是 false
   * （页面从来没拿到过键盘焦点），于是每次按都被判成"失去焦点"：
   * 第一次按只做重新激活、要看第二下才退出，还会配合焦点守卫在 1.2 秒后
   * 自己把鼠标塞回游戏中心。既然判据本身不可信，就不要再猜了。
   *
   * 现在的规则只有一条：按一下 = 切换。进入时一定会重新
   * setClickThrough(false)（BGI 在那一步里 SetForegroundWindow + Activate），
   * 所以"按 Win 出去一趟再回来"也只要再按一下就能重新接住浮窗。
   */
  function handleResizeKey(now) {
    toggleResizeMode();
  }

  /**
   * 缩放模式：按一下热键进入（鼠标可拖动画面、拉四角改尺寸），
   * 再按一下退出（切回穿透，鼠标还给游戏）。
   */
  function toggleResizeMode() {
    const on = !state.resizeMode;
    state.resizeMode = on;
    state.holdUpAt = 0;
    if (on) {
      state.resizeAt = Date.now();
      state.lastUxAt = state.resizeAt;      // 进入动作本身算一次交互
      const wasInteractive = state.interactive;
      setInteractive(true);
      // 悬停热区可能已经把它切成可交互了，那样 setInteractive 会早退、抢不到前台，
      // 所以再强制激活一次，保证键盘焦点真的落在浮窗上。
      if (wasInteractive) reapplyInteractive();
    } else {
      setInteractive(false);
    }
    if (on) {
      toast("缩放模式 ON：拖动画面 / 拉四角改尺寸，再按一次退出");
      log.info("进入缩放模式（鼠标可交互；播放状态保持原样，不会自己暂停）");
    } else {
      toast("缩放模式 OFF：鼠标穿透给游戏");
      log.info("退出缩放模式（鼠标已穿透；播放状态同样保持原样）");
    }
    return on;
  }

  /**
   * 悬停自动切换：指针在视频矩形内 → 可交互（能拖/能缩放）；
   * 移开超过 hoverExitMs → 自动穿透，把鼠标还给游戏。
   * 全程不占用任何键盘按键。
   */
  function hoverTick(now) {
    if (state.scrubbing) return;                               // 正在拖进度条，别打断
    if (state.resizeMode) return;                              // 缩放模式时不抢
    if (state.holdDown) return;                                // 正按住 Alt/Ctrl 手动接管，别跟它抢
    if (state.graceUntil && now < state.graceUntil) return;   // 摆位置期间不抢
    if (!CFG.hoverMode && !CFG.scrubZone && !state.folded && !state.pinned) return;
    const g = state.geom;
    if (!g) return;
    if (now - cursor.at > 2000) return;          // 鼠标一直没动，不做判断

    const dpr = g.dpr || 1;
    const px = cursor.x / dpr - g.sx;
    const py = cursor.y / dpr - g.sy;
    const pad = 3;
    const inRect = px >= g.x - pad && px <= g.x + g.w + pad &&
      py >= g.y - pad && py <= g.y + g.h + pad;

    // 底部这一条只留给进度条（v1.6.4 起进度条从顶部挪到了底部）：
    // 鼠标搭上去就能抓，别的地方继续穿透。这样既拖得动进度条，又不会挡住游戏点击。
    // 24px 是条本身（3px）+ 可拖热区（条上方 15px）再留一点余量；控制条显示时
    // 整个画面本来就归我们操作，这条热区不参与。
    // 只认"最近动过"的鼠标——手停下来超过 1.5 秒就还回去，免得长期吃点击。
    const inScrub = CFG.scrubZone &&
      px >= g.x - pad && px <= g.x + g.w + pad &&
      py >= g.y + g.h - 24 && py <= g.y + g.h + pad &&
      (now - cursor.at) <= 1500;

    // 收起态：整块浮窗就只剩这条控制条，所以整个矩形都算热区（不然点不动）
    const inFold = state.folded && inRect && (now - cursor.at) <= 4000;

    // 系列栏开着的时候，指针在"视频 + 系列栏"这一整块里都算还在操作浮窗；
    // 挪出去一会儿就自动穿透，顺带把系列栏收回（见 setInteractive 里的 closeSidePanel）。
    const sd = g.side;
    const inSide = !!sd &&
      px >= sd.x - pad && px <= sd.x + sd.w + pad &&
      py >= sd.y - pad && py <= sd.y + sd.h + pad;

    if (inRect || inSide) state.lastUxAt = now;    // 指针还搭在浮窗上 = 你刚用过它

    const want = inScrub || inFold || inSide || (CFG.hoverMode && inRect) ||
      (state.pinned && inRect);

    if (want) {
      state.hoverOutAt = 0;
      if (!state.interactive) setInteractive(true);
    } else if (state.interactive) {
      if (state.dragging) return;                // 正在拖，别抢
      if (!state.hoverOutAt) state.hoverOutAt = now;
      if (now - state.hoverOutAt > CFG.hoverExitMs) {
        state.hoverOutAt = 0;
        setInteractive(false);
      }
    }
  }

  /* ==========================================================================
   *  三·B、B 站合集接口
   *  说明：页面是跨域的，不能自己请求 api.bilibili.com（会被 CORS 拦），
   *        所以由脚本侧用 BetterGI 的 http.request 去取，再把 JSON 推给页面。
   *        需要 BetterGI 设置里开启「JS HTTP 权限」。
   * ========================================================================== */

  const BILI_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  let httpWarned = false;

  /**
   * 请求头尽量凑成"真实浏览器"的样子。B 站的 WAF 会综合打分：单看 UA 或单看某个头
   * 都能过，但 .NET 的 TLS 指纹本身可疑，头越齐全越容易被放行。
   */
  const BILI_HEADERS = {
    "User-Agent": BILI_UA,
    "Referer": "https://www.bilibili.com",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Origin": "https://www.bilibili.com",
    "sec-ch-ua": '"Not.A/Brand";v="99", "Chromium";v="126", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  };

  async function httpOnce(url, extraHeaders) {
    if (typeof http === "undefined" || !http || typeof http.request !== "function") {
      throw new Error("当前 BetterGI 版本不支持 http.request，无法加载在线内容。");
    }
    const h = {};
    for (const k in BILI_HEADERS) {
      if (Object.prototype.hasOwnProperty.call(BILI_HEADERS, k)) h[k] = BILI_HEADERS[k];
    }
    if (extraHeaders) {
      for (const k in extraHeaders) {
        if (Object.prototype.hasOwnProperty.call(extraHeaders, k)) h[k] = extraHeaders[k];
      }
    }
    const res = await http.request("GET", url, null, JSON.stringify(h));
    if (!res) throw new Error("请求没有返回");
    const sc = Number(res.status_code);
    if (sc !== 200) {
      // 只报一个 "HTTP 412" 查不出原因，把响应体前 200 字带上。
      const b = String(res.body == null ? "" : res.body).replace(/\s+/g, " ").slice(0, 200);
      throw new Error("HTTP " + sc + (b ? "｜" + b : "｜(响应体为空)"));
    }
    return String(res.body == null ? "" : res.body);
  }

  /**
   * api.bilibili.com 对 .NET 的 HttpClient 会直接甩 412 拦截页（同一个 URL 换个
   * HTTP 客户端就 200，说明它认的是客户端指纹而不是 IP 或参数）。
   * api.biliapi.net 是 B 站另一套入口，数据一模一样、WAF 不一样。
   * 所以一旦撞到 412 就记住，之后所有 api 请求直接走镜像，不再白挨一次 412。
   */
  let apiMirror = false;

  async function httpGetText(url, extraHeaders) {
    const canMirror = url.indexOf("api.bilibili.com") >= 0;
    if (apiMirror && canMirror) {
      return await httpOnce(url.replace("api.bilibili.com", "api.biliapi.net"), extraHeaders);
    }
    try {
      return await httpOnce(url, extraHeaders);
    } catch (e) {
      const msg = String((e && e.message) ? e.message : e);
      if (!apiMirror && canMirror && /412/.test(msg)) {
        apiMirror = true;
        log.warn("api.bilibili.com 返回 412，之后统一改走 api.biliapi.net");
        return await httpOnce(url.replace("api.bilibili.com", "api.biliapi.net"), extraHeaders);
      }
      throw e;
    }
  }

  async function apiGet(url, extraHeaders) {
    const body = await httpGetText(url, extraHeaders);
    return JSON.parse(body);
  }

  /**
   * B 站给每个"设备"发一个 buvid3 指纹，playurl 这类接口遇到不认识的请求时会直接
   * 回 412。补上这个 cookie 往往就能过——所以只在被 412 拒绝时才去取，平时不多请求。
   */
  async function getBuvid3() {
    try {
      const j = await apiGet("https://api.bilibili.com/x/frontend/finger/spi");
      const b3 = j && j.data && j.data.b_3;
      return b3 ? String(b3) : "";
    } catch (e) {
      return "";
    }
  }

  function explainApiError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    if (msg.indexOf("不允许请求此URL") >= 0) {
      return "manifest.json 没放行该接口地址：" + msg;
    }
    if (msg.indexOf("JS HTTP") >= 0 || msg.indexOf("权限") >= 0) {
      return "需要先在 BetterGI 的「设置 → 通用」里勾上「JS HTTP 权限」，否则取不到合集列表。";
    }
    return msg;
  }

  let collectionsCache = null;
  let collectionsBusy = null;    // 正在拉的时候复用同一个 Promise：启动预加载和分类索引别各拉一遍

  async function loadCollections() {
    if (collectionsBusy) return collectionsBusy;
    collectionsBusy = loadCollectionsOnce();
    const p = collectionsBusy;
    // 不写成 finally：老一点的 JS 运行时里 Promise.prototype.finally 不一定有
    p.then(function () { collectionsBusy = null; }, function () { collectionsBusy = null; });
    return p;
  }

  async function loadCollectionsOnce() {
    if (!CFG.upMid) {
      log.warn("没配置 UP 主 mid，侧栏合集不可用。");
      return;
    }
    try {
      // 注意：page_size 填 50 会被接口直接甩 -400（请求错误），最大只认 20。
      // 之前写 50 导致侧栏合集永远是空的，这里改回 20 并自己翻页。
      const seasons = [], series = [];
      for (let pn = 1; pn <= 6; pn++) {
        const url = "https://api.bilibili.com/x/polymer/web-space/seasons_series_list" +
          "?mid=" + encodeURIComponent(CFG.upMid) + "&page_num=" + pn + "&page_size=20";
        const j = await apiGet(url);
        if (!j || j.code !== 0) {
          if (pn === 1) {
            log.warn("取合集列表失败：code=" + (j ? j.code : "?") + " " + (j && j.message ? j.message : ""));
          }
          break;
        }
        const lists = (j.data && j.data.items_lists) ? j.data.items_lists : {};
        const sl = lists.seasons_list || [];
        const el = lists.series_list || [];
        sl.forEach(function (it) {
          const m = it.meta || {};
          seasons.push({ kind: "season", id: String(m.season_id), name: String(m.name || ""), total: Number(m.total || 0) });
        });
        el.forEach(function (it) {
          const m = it.meta || {};
          series.push({ kind: "series", id: String(m.series_id), name: String(m.name || ""), total: Number(m.total || 0) });
        });
        if (!sl.length && !el.length) break;      // 没有下一页了
      }
      collectionsCache = { seasons: seasons, series: series };
      send("/collections", collectionsCache);
      log.info("合集已加载：合集 " + seasons.length + " 个，系列 " + series.length + " 个。");
    } catch (e) {
      log.warn("取合集列表失败：" + explainApiError(e));
    }
  }

  async function loadEpisodes(kind, id, page) {
    if (!CFG.upMid || !id) return;
    page = Math.max(1, parseInt(page || 1, 10) || 1);
    try {
      let url, items = [], total = 0;
      if (kind === "series") {
        url = "https://api.bilibili.com/x/series/archives?mid=" + encodeURIComponent(CFG.upMid) +
          "&series_id=" + encodeURIComponent(id) +
          "&only_normal=true&sort=desc&pn=" + page + "&ps=30";
      } else {
        url = "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=" +
          encodeURIComponent(CFG.upMid) +
          "&season_id=" + encodeURIComponent(id) +
          "&sort_reverse=false&page_num=" + page + "&page_size=30";
      }
      const j = await apiGet(url);
      if (!j || j.code !== 0) {
        log.warn("取分集失败：code=" + (j ? j.code : "?"));
        return;
      }
      const arch = (j.data && j.data.archives) ? j.data.archives : [];
      const pg = (j.data && j.data.page) ? j.data.page : {};
      total = Number(pg.total || arch.length);
      items = arch.map(function (a) {
        return {
          bvid: String(a.bvid || ""),
          title: String(a.title || ""),
          dur: Number(a.duration || 0),
        };
      });
      send("/episodes", { kind: kind, id: String(id), page: page, total: total, items: items });
      log.info("分集已加载：" + items.length + " 条（第 " + page + " 页 / 共 " + total + " 集）");
    } catch (e) {
      log.warn("取分集失败：" + explainApiError(e));
    }
  }

  /* ==========================================================================
   *  分类目录（地区 × 内容类型）
   * --------------------------------------------------------------------------
   *  UP 主的视频是按「内容类型」分系列的：一条龙全收集 / 宝箱全收集 /
   *  神瞳类全收集 / 世界任务…，每个地区只是各自系列里的一个条目。
   *  所以想看「枫丹」的东西，得横跨三四个系列去翻。
   *
   *  这里把所有系列的条目拉平，从标题里认出「哪个地区」「什么类型」，
   *  按地区聚成一个分类，侧栏就能「选枫丹 → 一条龙/宝箱/神瞳/主线 全在这一页」。
   * ========================================================================== */

  // 地区规则：越靠前越优先。子区域单列（沉玉谷、龙脊雪山…），不要被大区抢走。
  const REGION_RULES = [
    ["沉玉谷", ["沉玉谷", "上谷", "南陵", "来歆山", "苍灵鲤"], "璃月"],
    ["龙脊雪山", ["龙脊雪山", "雪山", "绯红玉髓", "忍冬之树"], "蒙德"],
    ["层岩巨渊", ["层岩巨渊", "流明晶石", "流明石"], "璃月"],
    ["渊下宫", ["渊下宫"], "稻妻"],
    ["鹤观", ["鹤观"], "稻妻"],
    ["希穆兰卡", ["希穆兰卡", "希露兰卡", "悠乐片段", "赐福森林"], "枫丹"],
    ["金苹果群岛", ["金苹果群岛", "海岛"], "蒙德"],
    ["琉形蜃境", ["琉形蜃境", "礼券"], "须弥"],
    ["枫丹", ["枫丹", "枫丹廷", "莫尔泰", "黎翡", "旧日之海", "诺思托伊"], ""],
    ["纳塔", ["纳塔", "悠悠度假村", "安饶之野", "镜璧山", "坚岩隘谷", "万火之瓯", "翘枝崖"], ""],
    ["挪德卡莱", ["挪德卡莱", "杜南纳深坑", "霜月", "虚海望", "逐浪野", "伦波岛", "希汐岛", "帕哈岛"], ""],
    ["至冬", ["至冬", "古兽冰原", "焰羽谷", "霜殛寒峰", "白桦雪藏地"], ""],
    ["须弥", ["须弥", "雨林", "荒石", "千壑沙地", "浮罗囿", "净光翎", "沙漠"], ""],
    ["稻妻", ["稻妻", "鸣神岛", "神无冢", "八酝岛", "海祇岛", "清籁岛"], ""],
    ["璃月", ["璃月"], ""],
    ["蒙德", ["蒙德", "风息山", "空之神殿"], ""],
  ];

  // 类型规则：顺序有意义（"一条龙"的标题里常带"宝箱"，所以必须排在前面）
  const KIND_RULES = [
    ["一条龙", ["一条龙"]],
    ["宝箱", ["宝箱"]],
    ["神瞳", ["神瞳", "影生翼滴", "技忆团块", "苍灵鲤", "绯红玉髓", "流明石", "流明晶石", "键纹", "净光翎", "玉髓"]],
    ["主线", ["魔神任务", "主线"]],
    ["世界任务", ["世界任务", "传说任务", "邀约"]],
    ["特产", ["特产"]],
    ["摩拉堆", ["摩拉"]],
    ["怪物", ["怪物"]],
    ["采集", ["采集"]],
  ];
  const KIND_ORDER = ["一条龙", "宝箱", "神瞳", "主线", "世界任务", "特产", "摩拉堆", "怪物", "采集", "其他"];

  // 地区展示顺序：越靠前越"新"，**最新出的地图永远排第一**。
  //
  // 为什么不按视频数量排：至冬刚出只有 7 个视频，按数量会被挤到最后一屏 ——
  // 可正因为新，你才最想看它。以后出新地图，把名字加到数组最前面就行，
  // 排序代码一个字都不用改（记得同时在 REGION_RULES 里加它的关键词，否则认不出来）。
  const REGION_ORDER = ["至冬", "挪德卡莱", "纳塔", "枫丹", "须弥", "稻妻", "璃月", "蒙德"];

  let catalog = null;        // { at, items: [...] }
  let catalogBusy = false;   // 正在索引，别重复开

  function detectRegion(title) {
    const t = String(title || "");
    for (let i = 0; i < REGION_RULES.length; i++) {
      const keys = REGION_RULES[i][1];
      for (let j = 0; j < keys.length; j++) {
        if (t.indexOf(keys[j]) >= 0) {
          return { name: REGION_RULES[i][0], parent: REGION_RULES[i][2] || "" };
        }
      }
    }
    return { name: "", parent: "" };
  }

  function detectKind(title) {
    const t = String(title || "");
    for (let i = 0; i < KIND_RULES.length; i++) {
      const keys = KIND_RULES[i][1];
      for (let j = 0; j < keys.length; j++) {
        if (t.indexOf(keys[j]) >= 0) return KIND_RULES[i][0];
      }
    }
    return "其他";
  }

  function readCatalog() {
    try {
      const raw = st.vmCatalog;
      if (!raw) return null;
      const o = JSON.parse(String(raw));
      return (o && o.items && o.items.length) ? o : null;
    } catch (e) {
      return null;
    }
  }

  function saveCatalog(o) {
    try {
      st.vmCatalog = JSON.stringify(o);
      if (typeof settings !== "undefined" && settings && typeof settings.set === "function") {
        try { settings.set("vmCatalog", st.vmCatalog); } catch (e) { }
      }
    } catch (e) { }
  }

  /** 取某个系列/合集的一页条目（索引专用，不下发页面） */
  async function fetchListPage(kind, id, page) {
    let url;
    if (kind === "series") {
      url = "https://api.bilibili.com/x/series/archives?mid=" + encodeURIComponent(CFG.upMid) +
        "&series_id=" + encodeURIComponent(id) +
        "&only_normal=true&sort=desc&pn=" + page + "&ps=30";
    } else {
      url = "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=" +
        encodeURIComponent(CFG.upMid) +
        "&season_id=" + encodeURIComponent(id) +
        "&sort_reverse=false&page_num=" + page + "&page_size=30";
    }
    const j = await apiGet(url);
    if (!j || j.code !== 0) return null;
    const arch = (j.data && j.data.archives) ? j.data.archives : [];
    const pg = (j.data && j.data.page) ? j.data.page : {};
    return {
      total: Number(pg.total || arch.length),
      items: arch.map(function (a) {
        return { bvid: String(a.bvid || ""), title: String(a.title || ""), dur: Number(a.duration || 0) };
      }),
    };
  }

  /**
   * 地区排序权重：数小的排前面。
   *
   * - 大区按 REGION_ORDER 的顺序（新 → 旧）；
   * - 子区域（沉玉谷 / 渊下宫 / 希穆兰卡 / 龙脊雪山…）紧跟在自己的父地区后面；
   * - 顺序表里没有的地区垫在已知地区之后，免得哪天冒出来一个没登记的
   *   名字抢到至冬前面去。
   */
  function regionRank(g) {
    const own = REGION_ORDER.indexOf(g.name);
    if (own >= 0) return own * 10;
    const p = REGION_ORDER.indexOf(g.parent || "");
    if (p >= 0) return p * 10 + 1;
    return 900;
  }

  /** 把条目按地区 → 类型 分组 */
  function buildCatalogGroups(items) {
    const byRegion = {};
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const r = it.region || "未分类";
      if (!byRegion[r]) byRegion[r] = { name: r, parent: it.parent || "", kinds: {}, total: 0 };
      const k = it.kind || "其他";
      if (!byRegion[r].kinds[k]) byRegion[r].kinds[k] = [];
      byRegion[r].kinds[k].push(it);
      byRegion[r].total++;
    }
    const out = [];
    for (const r in byRegion) {
      if (!Object.prototype.hasOwnProperty.call(byRegion, r)) continue;
      const g = byRegion[r];
      const kinds = [];
      for (let i = 0; i < KIND_ORDER.length; i++) {
        const k = KIND_ORDER[i];
        if (g.kinds[k] && g.kinds[k].length) kinds.push({ name: k, n: g.kinds[k].length });
      }
      out.push({ name: g.name, parent: g.parent, total: g.total, kinds: kinds });
    }
    out.sort(function (a, b) {
      // 「未分类」永远沉底
      const au = a.name === "未分类" ? 1 : 0;
      const bu = b.name === "未分类" ? 1 : 0;
      if (au !== bu) return au - bu;
      // 新地图优先（至冬 → 挪德卡莱 → 纳塔 → 枫丹 → …），同权重才看视频数量
      const ra = regionRank(a), rb = regionRank(b);
      if (ra !== rb) return ra - rb;
      return b.total - a.total;
    });
    return out;
  }

  /**
   * 分类规则的版本号 —— 改了 REGION_RULES / KIND_RULES / 索引来源就 +1。
   *
   * 为什么需要它：索引结果会缓存 7 天（catalogDays），如果只是改规则，
   * 旧缓存里的"地区"还是按老关键词算的，新地图（比如至冬）要等一周才出现，
   * 用户看到的就是"系列栏里没有至冬"。版本号对不上就自动重建一次。
   */
  const CATALOG_VER = 2;

  /**
   * 用当前规则把缓存里的条目重新归一次类（地区 / 父地区 / 类型）。
   * 索引结果只存 bvid/标题/系列，规则随时可能改，重新算一遍比等缓存过期靠谱。
   * 返回 true 表示有变化，调用方负责写回缓存。
   */
  function retagCatalog(items) {
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const rg = detectRegion(it.title);
      const kd = detectKind(it.title);
      if (it.region !== rg.name || it.parent !== rg.parent || it.kind !== kd) {
        it.region = rg.name;
        it.parent = rg.parent;
        it.kind = kd;
        changed = true;
      }
    }
    return changed;
  }

  function catalogSummary() {
    const items = (catalog && catalog.items) ? catalog.items : [];
    return {
      at: (catalog && catalog.at) || 0,
      total: items.length,
      groups: buildCatalogGroups(items),
    };
  }

  function catalogRegionItems(region) {
    const items = (catalog && catalog.items) ? catalog.items : [];
    const out = [];
    for (let i = 0; i < items.length; i++) {
      if ((items[i].region || "未分类") === region) out.push(items[i]);
    }
    // 按类型顺序排（一条龙 → 宝箱 → 神瞳 → 主线 → …），同类型里按标题排
    out.sort(function (a, b) {
      const ka = KIND_ORDER.indexOf(a.kind), kb = KIND_ORDER.indexOf(b.kind);
      const da = ka < 0 ? 99 : ka, db = kb < 0 ? 99 : kb;
      if (da !== db) return da - db;
      return String(a.title).localeCompare(String(b.title));
    });
    return out;
  }

  /**
   * 建立索引：把「收集类系列」+「任务类合集」的条目全拉平。
   * 首次约 30~40 个请求（世界任务合集本身就有 700 多条），十几秒；之后读缓存。
   */
  async function indexCatalog(force) {
    if (!CFG.catalogOn) {
      log.info("分类索引：设置里关掉了，跳过。");
      return;
    }
    if (!CFG.upMid) return;
    if (catalogBusy) {
      // 页面又点了一次「分」。回一句状态，否则它会一直停在"正在建立索引…"
      log.info("分类索引：正在建，别催。");
      send("/catalog-state", { running: true, msg: "正在索引中，稍等…" });
      return;
    }
    catalogBusy = true;
    try {
      const cached = readCatalog();
      const maxAge = Math.max(1, CFG.catalogDays) * 86400000;
      const verOk = cached && Number(cached.ver) === CATALOG_VER;
      if (!force && cached && verOk && (Date.now() - Number(cached.at || 0)) < maxAge) {
        catalog = cached;
        // 规则细节可能改过（关键词增减），用当前规则重算一遍，别让旧标签留着
        if (retagCatalog(catalog.items)) {
          saveCatalog(catalog);
          log.info("分类规则有更新，已用新规则重新归类缓存条目（不重新拉视频）。");
        }
        send("/catalog-index", catalogSummary());
        log.info("分类索引：用本地缓存（" + cached.items.length + " 条）。想重建点侧栏的 ↻。");
        return;
      }
      if (cached && !verOk) {
        log.info("分类规则版本变了（缓存 v" + (cached.ver || 0) + " → v" + CATALOG_VER +
          "），重建一次索引，让新地图（至冬等）出现。");
      }

      if (!collectionsCache) await loadCollections();
      const cols = collectionsCache || { seasons: [], series: [] };

      // 收集类：一条龙/宝箱/神瞳/特产/摩拉堆/怪物/采集，全都索引进分类
      const targets = [];
      for (let i = 0; i < cols.series.length; i++) {
        const s = cols.series[i];
        if (/一条龙|宝箱|神瞳|特产|摩拉|怪物|采集|全收集/.test(s.name)) {
          targets.push({ kind: "series", id: s.id, name: s.name, total: s.total });
        }
      }
      // 任务类：世界任务/传说任务——「枫丹主线」就藏在这里，但要翻很多页
      if (CFG.catalogDeep) {
        for (let i = 0; i < cols.seasons.length; i++) {
          const s = cols.seasons[i];
          if (/世界任务|传说任务/.test(s.name)) {
            targets.push({ kind: "season", id: s.id, name: s.name, total: s.total });
          }
        }
      }
      if (!targets.length) {
        log.warn("分类索引：没找到可索引的系列/合集，先确认 upMid 填对了。");
        send("/catalog-index", { at: 0, total: 0, groups: [] });
        return;
      }

      // 先算总页数，好给页面报进度
      let totalPages = 0;
      for (let i = 0; i < targets.length; i++) {
        const ps = 30;
        const n = targets[i].total > 0 ? Math.ceil(targets[i].total / ps) : 1;
        targets[i].pages = Math.min(60, Math.max(1, n));
        totalPages += targets[i].pages;
      }
      log.info("分类索引：开始，共 " + targets.length + " 个来源 / 约 " + totalPages + " 页，请稍等…");
      send("/catalog-state", { running: true, done: 0, total: totalPages, msg: "正在索引 0/" + totalPages });

      const seen = {};
      const items = [];
      let done = 0;
      for (let ti = 0; ti < targets.length; ti++) {
        const t = targets[ti];
        for (let pn = 1; pn <= t.pages; pn++) {
          let r = null;
          try {
            r = await fetchListPage(t.kind, t.id, pn);
          } catch (e) {
            r = null;
          }
          done++;
          if (done === 1 || done === totalPages || done % 5 === 0) {
            send("/catalog-state", {
              running: true, done: done, total: totalPages,
              msg: "正在索引 " + done + "/" + totalPages,
            });
          }
          if (r && r.items) {
            for (let k = 0; k < r.items.length; k++) {
              const it = r.items[k];
              if (!it.bvid || seen[it.bvid]) continue;
              seen[it.bvid] = 1;
              const rg = detectRegion(it.title);
              items.push({
                bvid: it.bvid,
                title: it.title,
                dur: it.dur,
                series: t.name,
                region: rg.name,
                parent: rg.parent,
                kind: detectKind(it.title),
              });
            }
          }
        }
      }

      catalog = { at: Date.now(), ver: CATALOG_VER, items: items };
      saveCatalog(catalog);
      const summary = catalogSummary();
      send("/catalog-index", summary);
      send("/catalog-state", { running: false, done: totalPages, total: totalPages, msg: "索引完成" });
      log.info("分类索引完成：" + items.length + " 条，分成 " + summary.groups.length + " 个分类：" +
        summary.groups.map(function (g) { return g.name + "(" + g.total + ")"; }).join("、"));
    } catch (e) {
      log.warn("分类索引失败：" + ((e && e.message) ? e.message : e));
      send("/catalog-state", { running: false, error: String((e && e.message) ? e.message : e) });
    } finally {
      catalogBusy = false;
    }
  }

  /* ---------- 弹幕 ---------- */

  function decodeEntities(s) {
    return String(s)
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function parseDanmakuXml(xml) {
    const out = [];
    const re = /<d p="([^"]*)"[^>]*>([\s\S]*?)<\/d>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const p = m[1].split(",");
      const t = parseFloat(p[0]);
      if (!isFinite(t)) continue;
      const text = decodeEntities(m[2]).trim();
      if (!text) continue;
      out.push({
        t: Math.round(t * 10) / 10,
        m: parseInt(p[1] || "1", 10),      // 1=滚动 4=底部 5=顶部
        c: parseInt(p[3] || "16777215", 10),
        x: text,
      });
      if (out.length >= 4000) break;
    }
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  /* ---------- 视频信息（带缓存） ---------- */

  // 弹幕和直链都要 view 接口，各拉一次容易触发风控，也慢，缓存一份
  const viewCache = {};

  async function getView(bvid) {
    const key = String(bvid || "");
    if (!key) throw new Error("bvid 为空");
    if (viewCache[key]) return viewCache[key];
    const v = await apiGet("https://api.bilibili.com/x/web-interface/view?bvid=" + encodeURIComponent(key));
    if (!v || v.code !== 0 || !v.data) {
      throw new Error("取视频信息失败 code=" + (v ? v.code : "?") + " " + (v ? v.message : ""));
    }
    viewCache[key] = v.data;
    return v.data;
  }

  /* ---------- 播放直链 ----------
   * platform=html5 拿到的是一整个 mp4（不是 DASH 分片），可以直接塞进 <video>。
   * 这个地址不带 Referer 也能访问、支持 Range，所以页面侧不用任何特殊处理。
   */
  async function fetchPlayUrl(bvid, page, qn, seekT) {
    const pg = Math.max(1, parseInt(page, 10) || 1);
    try {
      const data = await getView(bvid);
      const rawPages = Array.isArray(data.pages) ? data.pages : [];
      const pages = rawPages.map(function (p) {
        return {
          i: Number(p.page) || 1,
          cid: String(p.cid || ""),
          dur: Number(p.duration || 0),
          title: String(p.part || ""),
        };
      });

      let cur = null;
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].i === pg) { cur = pages[i]; break; }
      }
      if (!cur) {
        cur = {
          i: 1,
          cid: String(data.cid || ""),
          dur: Number(data.duration || 0),
          title: String(data.title || ""),
        };
        if (!pages.length) pages.push(cur);
      }
      if (!cur.cid) throw new Error("这个视频没有 cid");

      const q = (Number(qn) === 16) ? 16 : 64;
      const apiUrl = "https://api.bilibili.com/x/player/playurl?bvid=" + encodeURIComponent(bvid) +
        "&cid=" + encodeURIComponent(cur.cid) +
        "&qn=" + q + "&fnval=1&platform=html5&high_quality=1";
      const sess = CFG.sessdata ? String(CFG.sessdata).trim() : "";
      let d = null;
      try {
        d = await apiGet(apiUrl, sess ? { "Cookie": "SESSDATA=" + sess } : null);
      } catch (e1) {
        if (!/412/.test(String(e1 && e1.message))) throw e1;
        // 412 = B 站风控。补一个 buvid3 设备指纹再试一次，多数情况能过。
        const b3 = await getBuvid3();
        if (!b3) throw e1;
        log.warn("playurl 返回 412，补 buvid3 后重试一次…");
        const ck = (sess ? "SESSDATA=" + sess + "; " : "") + "buvid3=" + b3;
        d = await apiGet(apiUrl, { "Cookie": ck });
      }
      if (!d || d.code !== 0 || !d.data) {
        throw new Error("取播放地址失败 code=" + (d ? d.code : "?") + " " + (d ? d.message : ""));
      }

      const durl = Array.isArray(d.data.durl) ? d.data.durl : [];
      if (!durl.length) throw new Error("没有 mp4 地址（这个视频只给了 DASH，暂时不支持）");
      const url = String(durl[0].url || "");
      if (!url) throw new Error("mp4 地址为空");

      send("/playurl", {
        bvid: bvid,
        page: pg,
        cid: cur.cid,
        url: url,
        t: Math.max(0, Number(seekT) || 0),
        quality: Number(d.data.quality || q),
        total: durl.length,
        partSec: Number(durl[0].length || 0) / 1000,
        title: String(data.title || ""),
        pages: pages,
      });
      send("/meta", {
        bvid: bvid,
        title: String(data.title || ""),
        cid: cur.cid,
        dur: Number(data.duration || 0),
      });
      log.info("直链就绪：" + bvid + (pg > 1 ? (" P" + pg) : "") +
        "　" + (Number(d.data.quality) >= 64 ? "720P" : "360P") +
        "　" + (durl.length > 1 ? ("已被切成 " + durl.length + " 段，先播第一段") : "单文件"));
    } catch (e) {
      const msg = explainApiError(e);
      log.warn("取播放直链失败：" + msg);
      send("/playurl", { bvid: bvid, page: pg, error: msg });
    }
  }

  async function fetchDanmaku(bvid) {
    if (!bvid) return;
    try {
      const data = await getView(bvid);
      const cid = data.cid;
      const title = String(data.title || "");
      const dur = Number(data.duration || 0);
      send("/meta", { bvid: bvid, title: title, cid: cid, dur: dur });

      const xml = await httpGetText("https://api.bilibili.com/x/v1/dm/list.so?oid=" + encodeURIComponent(cid));
      const items = parseDanmakuXml(xml);
      send("/danmaku", { bvid: bvid, items: items });
      log.info("弹幕已加载：" + items.length + " 条");
    } catch (e) {
      log.warn("弹幕加载失败：" + explainApiError(e));
    }
  }

  /* ---------- 字幕（方向提示） ---------- */

  async function fetchSubtitle(bvid) {
    if (!bvid) return;
    if (!CFG.sessdata) {
      log.info("没填 SESSDATA，字幕/方向提示不可用（B 站 AI 字幕需要登录态）。");
      return;
    }
    try {
      const cookie = { "Cookie": "SESSDATA=" + CFG.sessdata };
      const vd = await getView(bvid);
      const cid = vd.cid;

      const p = await apiGet("https://api.bilibili.com/x/player/v2?bvid=" + encodeURIComponent(bvid) +
        "&cid=" + encodeURIComponent(cid), cookie);
      const subs = (p && p.data && p.data.subtitle && p.data.subtitle.subtitles) ? p.data.subtitle.subtitles : [];
      if (!subs.length) {
        log.warn("这个视频没有可用字幕（UP 没传字幕、或者 AI 字幕没生成）。方向提示不可用。");
        send("/subtitle", { bvid: bvid, items: [] });
        return;
      }
      let pick = null;
      for (let i = 0; i < subs.length; i++) {
        const lan = String(subs[i].lan || "");
        if (lan === "zh-CN" || lan === "ai-zh") { pick = subs[i]; break; }
      }
      if (!pick) pick = subs[0];

      let url = String(pick.subtitle_url || "");
      if (url.indexOf("//") === 0) url = "https:" + url;
      if (!url) { log.warn("字幕地址为空。"); return; }

      const sub = await apiGet(url, cookie);
      const body = (sub && sub.body) ? sub.body : [];
      const items = [];
      for (let i = 0; i < body.length; i++) {
        const o = body[i];
        const txt = String(o.content || "").trim();
        if (!txt) continue;
        items.push({ f: Number(o.from || 0), t: Number(o.to || 0), x: txt });
      }
      items.sort(function (a, b) { return a.f - b.f; });
      send("/subtitle", { bvid: bvid, items: items });
      log.info("字幕已加载：" + items.length + " 句（" + String(pick.lan_doc || pick.lan || "") + "）");
    } catch (e) {
      log.warn("字幕加载失败：" + explainApiError(e));
    }
  }

  /** 存一张当前游戏画面，用于校准（战斗检测模板） */
  function snapshot() {
    const img = safeCapture();
    if (!img) { log.warn("截图失败：取不到游戏画面"); return; }
    try {
      const d = new Date();
      const p = function (n) { return n < 10 ? ("0" + n) : String(n); };
      const name = "assets/calib/" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
        "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".png";
      let ok = false;
      try {
        if (typeof file.writeImageSync === "function") ok = file.writeImageSync(name, img.srcMat);
        else if (typeof file.WriteImageSync === "function") ok = file.WriteImageSync(name, img.srcMat);
      } catch (e) { ok = false; }
      if (ok) {
        log.info("已保存截图：" + name);
        log.info("把它发我，我裁出「敌人血条」做成 assets/combat/enemy.png，自动暂停就能用了。");
        toast("截图已保存：" + name);
      } else {
        log.warn("截图保存失败（当前版本可能不支持 writeImageSync）。");
      }
    } finally {
      disposeObj(img);
    }
  }

  /**
   * 登录 B 站：在同一个 WebView2 配置里打开 bilibili，登录后 Cookie 会共享给
   * 播放器 iframe，画质才有可能从 480P 提上去。
   * 再点一次（或按登录热键）= 关闭登录窗，并自动刷新视频以应用新的登录态。
   *
   * 注意：登录窗是铺满屏幕的独立窗口，会把浮窗完全盖住 —— 侧栏上的按钮点不到。
   * 所以这里必须有一条热键兜底，否则登录完就退不出来了（用户踩过）。
   */
  function openBiliLogin() {
    const LOGIN_ID = "bili_login";
    const closeKey = (CFG.loginKeys[0] || "").toUpperCase();
    let exists = false;
    try { exists = htmlMask.exists(LOGIN_ID); } catch (e) { exists = false; }

    if (exists) {
      try { htmlMask.close(LOGIN_ID); } catch (e) { }
      state.loginAt = 0;
      log.info("登录窗口已关闭，正在刷新视频以应用登录态……");
      toast("已关闭登录窗，刷新视频");
      cmd("reload");
      return;
    }

    try {
      htmlMask.show("https://www.bilibili.com", LOGIN_ID);
      state.loginAt = Date.now();
      // 遮罩窗口默认点击穿透，登录窗必须关掉穿透才点得动
      try { htmlMask.setClickThrough(LOGIN_ID, false); } catch (e) { }
      log.info("已打开 B 站登录窗（可点击）。登录完按 " +
        (closeKey || "（没配热键，点侧栏的「登录」）") + " 关闭，视频会自动刷新。");
      toast("登录完按 " + (closeKey || "侧栏「登录」") + " 关闭登录窗");
    } catch (e) {
      log.error("打开 B 站窗口失败：" + ((e && e.message) ? e.message : String(e)));
    }
  }



  /* ==========================================================================
   *  四、全局键鼠钩子
   * ========================================================================== */

  // 钩子回调可能在别的线程触发，这里只做入队，由主循环统一处理
  const keyQueue = [];
  const keyHeld = {};

  let hook = null;
  const cursor = { x: -1, y: -1, at: 0 };

  /** 动作热键里是否至少填了一个键（决定要不要挂键盘钩子） */
  function hasActionKeys() {
    const hk = CFG.hotkeys;
    for (const a in hk) {
      if (Object.prototype.hasOwnProperty.call(hk, a) && hk[a]) return true;
    }
    return false;
  }

  /* ==========================================================================
   *  四·A0、浮窗里改键（v1.6.15）
   *
   *  BGI 设置页里改热键要退出去翻界面；而"F9 撞键了想换一个"是很常见的诉求。
   *  所以侧栏里放一个「键」面板：点一行 → 按你想用的键 → 立刻重挂钩子生效。
   *
   *  为什么捕获必须走全局钩子而不是页面 keydown：
   *  BGI 的浮窗虽然浮在游戏上，但页面拿不到键盘焦点（document.hasFocus() 长期
   *  false，实测过），页面自己的 keydown 收不到键。所以捕获期间由钩子把键吃下来
   *  转给页面，同时**不触发任何动作**。
   * ========================================================================== */

  /** 某个动作当前绑的键（列表型只取第一个） */
  function hotkeyGet(id) {
    if (id === "resize") return CFG.resizeKeys[0] || "";
    if (id === "login") return CFG.loginKeys[0] || "";
    if (id === "hold") return CFG.holdKeys[0] || "";
    if (!CFG.hotkeys) return "";
    return CFG.hotkeys[id] || "";
  }

  /** 写一个动作的键（只改内存 + 设置，不动钩子） */
  function hotkeyStore(def, key) {
    if (def.id === "resize") CFG.resizeKeys = key ? [key] : [];
    else if (def.id === "login") CFG.loginKeys = key ? [key] : [];
    else if (def.id === "hold") CFG.holdKeys = key ? [key] : [];
    else CFG.hotkeys[def.id] = key;
    try { settings.set(def.setting, key); } catch (e) { }
  }

  /** 整张键位表（发给页面渲染） */
  function hotkeyTable() {
    const out = [];
    for (let i = 0; i < HOTKEY_DEFS.length; i++) {
      const d = HOTKEY_DEFS[i];
      out.push({ id: d.id, label: d.label, key: hotkeyGet(d.id), def: d.def });
    }
    return out;
  }

  /**
   * 改一个键：同键冲突时把原来占着的动作清空（一个键只干一件事），
   * 然后重挂钩子让新键立刻生效，最后把新表推给页面。
   * 返回被清空的动作名，供日志/提示用。
   */
  function hotkeySet(id, key) {
    const def = hotkeyDef(id);
    if (!def) return [];
    key = normKey(key);
    const cleared = [];
    if (key) {
      for (let i = 0; i < HOTKEY_DEFS.length; i++) {
        const d = HOTKEY_DEFS[i];
        if (d.id === id) continue;
        if (hotkeyGet(d.id) === key) {
          hotkeyStore(d, "");
          cleared.push(d.label);
        }
      }
    }
    hotkeyStore(def, key);

    disposeHook();
    setupHook(true);          // 静默重挂：别把一堆一次性说明再刷一遍日志
    send("/keys", {
      keys: hotkeyTable(),
      tip: buildHotkeyTip(),
      holdKeyLabel: CFG.holdKeys.join("/").toUpperCase(),
    });
    return cleared;
  }

  /**
   * 捕获状态：把下一个按键交给页面（不触发动作）。返回 true = 这个键被吃掉了。
   * Esc 取消；其余键都算"用户选了它"。
   */
  function captureKey(k) {
    if (!state.keyCap) return false;
    const id = state.keyCap;
    if (k === "escape" || k === "esc") {
      state.keyCap = null;
      send("/keycap", { id: id, cancel: true });
      return true;
    }
    state.keyCap = null;
    send("/keycap", { id: id, key: k });
    return true;
  }

  function setupHook(quiet) {
    // quiet：改键后重挂时用，别把那一堆一次性说明再刷一遍
    const say = function (m) { if (!quiet) { try { log.info(m); } catch (e) { } } };
    try {
      hook = new KeyMouseHook();

      // 挂钩子的条件：总开关开了，或者至少绑了一个动作键。
      // v1.6.13：播放/暂停默认绑 F9，如果还看「启用键盘热键」那个总开关（默认关），
      // 就会出现"设置里明明写着 F9，按下去一点反应没有"。没绑任何键时仍然不挂钩子。
      if (CFG.enableHotkeys || hasActionKeys()) {
        hook.OnKeyDown(function (keyCode) {
          const k = normKey(keyCode);
          if (!k) return;
          if (captureKey(k)) return;          // 正在「按一个键」改键：这个键归面板
          const now = Date.now();
          if (keyHeld[k] && now - keyHeld[k] < 1500) return;
          keyHeld[k] = now;
          keyQueue.push({ type: "key", key: k });
        }, true);
        hook.OnKeyUp(function (keyCode) {
          const k = normKey(keyCode);
          if (k) delete keyHeld[k];
        }, true);
        say(CFG.enableHotkeys
          ? "键盘热键已开启（配置里填了才会生效）。"
          : "动作热键已就绪：只响应当前填了键的动作（" +
            (CFG.hotkeys.playPause ? "播放/暂停 " + CFG.hotkeys.playPause.toUpperCase() : "无") + "）。");
      }

      // 缩放模式开关：独立监听，不受上面那个"启用键盘热键"开关影响。
      // 只认配置里的这一个（或几个）键，按一下进入、再按一下退出。
      let lastResizeKeyAt = 0;
      let resizeProbeLeft = 3;      // 诊断：把前 3 个上报的键名打出来，键名对不上时看日志
      try {
        hook.OnKeyDown(function (keyCode) {
          const k = normKey(keyCode);
          if (!k) return;
          if (captureKey(k)) return;
          if (CFG.resizeKeys.map(canonKey).indexOf(canonKey(k)) < 0) {
            if (resizeProbeLeft > 0) {
              resizeProbeLeft--;
              say("键盘上报的键名：「" + k + "」（诊断用，仅前 3 个）");
            }
            return;
          }
          const now = Date.now();
          if (now - lastResizeKeyAt < 400) return;   // 防按住时的连发
          lastResizeKeyAt = now;
          handleResizeKey(now);
        }, true);
        say("缩放模式热键：" + (CFG.resizeKeys.length ? CFG.resizeKeys.join(" / ") : "(未配置)") +
          " —— 按一下进入，再按一下退出。");
      } catch (e) {
        log.warn("缩放模式热键注册失败：" + ((e && e.message) ? e.message : String(e)));
      }

      // 登录窗开关：和缩放热键一样独立监听，不看「启用键盘热键」那个开关。
      // 登录窗铺满屏幕、把浮窗整个盖住，没有这条热键就退不出来（会被困在登录页）。
      let lastLoginKeyAt = 0;
      try {
        if (CFG.loginKeys.length) {
          hook.OnKeyDown(function (keyCode) {
            const k = normKey(keyCode);
            if (!k) return;
            if (captureKey(k)) return;
            if (CFG.loginKeys.map(canonKey).indexOf(canonKey(k)) < 0) return;
            const now = Date.now();
            if (now - lastLoginKeyAt < 400) return;
            lastLoginKeyAt = now;
            openBiliLogin();
          }, true);
          say("登录窗热键：" + CFG.loginKeys.join(" / ") + " —— 按一下开、再按一下关。");
        }
      } catch (e) {
        log.warn("登录窗热键注册失败：" + ((e && e.message) ? e.message : String(e)));
      }

      // 鼠标侧键（不占键盘，只在配置里填了 mouse4/mouse5 时才生效）
      try {
        hook.OnMouseDown(function (button) {
          const b = normKey(button).replace(/\s/g, "");
          let name = "";
          if (b === "xbutton1" || b === "xbutton2") name = (b === "xbutton1") ? "mouse4" : "mouse5";
          else if (b === "mouse4" || b === "mouse5") name = b;
          if (name) keyQueue.push({ type: "mouse", key: name });
        });
      } catch (e) { }

      if (!saved) {
        // 没存过位置 → 让页面按"右上角"自己算
        state.layout.x = -1;
        state.layout.y = -1;
      }
      // 按住「临时接管键」（默认 Alt）＝ 这段时间浮窗收点击，可以拖进度条、点暂停；
      // 松开 250ms 后自动还给游戏。为什么用 Alt：原神里 Alt 就是"显示鼠标"，
      // 按住它的时候手本来就在鼠标上，顺势就能点浮窗，不用先按 Insert 进/退缩放模式。
      if (CFG.holdKeys.length) {
        let holdLogged = 0;
        hook.OnKeyDown(function (keyCode) {
          const k = normKey(keyCode);
          if (captureKey(k)) return;
          if (!matchHoldKey(k)) return;
          if (state.holdDown) return;
          state.holdDown = true;
          state.holdUpAt = 0;
          setInteractive(true);
          if (holdLogged < 2) {
            holdLogged++;
            say("按住 " + CFG.holdKeys.join("/").toUpperCase() +
              "：浮窗暂时接管鼠标（拖进度条 / 点暂停），松开就还回去。");
          }
        }, true);
        hook.OnKeyUp(function (keyCode) {
          const k = normKey(keyCode);
          if (state.keyCap) return;
          if (!matchHoldKey(k)) return;
          if (!state.holdDown) return;
          state.holdDown = false;
          // 注意：钩子回调运行在 C# 线程里的独立 V8 上下文，那里没有 setTimeout
          // （实测报 ReferenceError: setTimeout is not defined）。
          // 所以这里只打时间戳，真正的"延迟切回穿透"交给主循环去轮询。
          state.holdUpAt = Date.now();
        }, true);
        say("临时接管键：" + CFG.holdKeys.join(" / ") +
          "（按住可以拖进度条 / 点暂停，松开自动还给游戏）。");
      }

      // 方向键：←/→ 快退快进，↑/↓ 调音量。走全局钩子，所以【不用先按缩放热键】，
      // 游戏有焦点时也管用（键照样传给游戏，但原神本来就没绑方向键，不会打架）。
      // 页面收到 init 里的 keysGlobal=true 后就不再自己处理，避免一次按键跳两下。
      if (CFG.arrowGlobal) {
        let seekAt = 0, volAt = 0;
        hook.OnKeyDown(function (keyCode) {
          const k = normKey(keyCode);
          if (captureKey(k)) return;
          const isLeft = (k === "left" || k === "arrowleft");
          const isRight = (k === "right" || k === "arrowright");
          const isUp = (k === "up" || k === "arrowup");
          const isDown = (k === "down" || k === "arrowdown");
          if (!isLeft && !isRight && !isUp && !isDown) return;
          const now = Date.now();
          if (isLeft || isRight) {
            if (now - seekAt < 140) return;      // 按住连发，最快约 7 次/秒
            seekAt = now;
            cmd("seek", isLeft ? -Math.abs(CFG.seekStep) : Math.abs(CFG.seekStep));
          } else {
            if (now - volAt < 80) return;
            volAt = now;
            cmd("volume", isUp ? 0.1 : -0.1);
          }
        }, true);
        say("方向键已接管：←/→ 快退快进 " + CFG.seekStep + " 秒，↑/↓ 调音量（不用先按缩放热键）。" +
          "如果 BGI 自己的「暂停/取消任务」也绑着 ↑↓，按下去会两边一起响，去 BGI 设置里让一让。");
      }

      // 鼠标位置：用来判断"指针是否在视频上"，实现悬停自动切换穿透 + 进度条热区。
      // 注意：进度条热区也依赖它，所以两个开关任意一个开着都得注册。
      if (CFG.hoverMode || CFG.scrubZone) {
        hook.OnMouseMove(function (x, y) {
          cursor.x = Number(x);
          cursor.y = Number(y);
          cursor.at = Date.now();
        }, 100);
        say(CFG.hoverMode
          ? "鼠标悬停模式已开启：指针移到视频上才可拖动/缩放，移开自动穿透。"
          : "进度条热区已开启：鼠标移到画面底部那条上就能拖进度条，移开自动穿透。");
      }
      return true;
    } catch (e) {
      log.warn("鼠标钩子不可用（KeyMouseHook 初始化失败）：" + ((e && e.message) ? e.message : String(e)));
      log.warn("叠层仍会显示，但可能无法自动切换穿透。");
      hook = null;
      return false;
    }
  }

  function disposeHook() {
    if (!hook) return;
    try { if (typeof hook.RemoveAllListeners === "function") hook.RemoveAllListeners(); } catch (e) { }
    try {
      if (typeof hook.dispose === "function") hook.dispose();
      else if (typeof hook.Dispose === "function") hook.Dispose();
    } catch (e) { }
    hook = null;
  }

  /* ==========================================================================
   *  四·A2、游戏截图的两个小工具（v1.6.15 补）
   *
   *  说明：safeCapture() / disposeObj() 从 v1.6.x 起就被 snapshot() 和
   *  combatTick() 调用，但**从来没有定义过**。后果是：
   *    · 开启「检测到战斗自动暂停」→ 主循环第一次进 combatTick 就抛
   *      ReferenceError，而主循环外层没有 try，脚本当场停摆（浮窗还在，但
   *      热键、进度、一切都不动了）—— 这就是「自动暂停一开就用不了」的真因；
   *    · 侧栏「截」按钮（snapshot）同理，一直是坏的。
   * ========================================================================== */

  let captureWarned = false;

  /** 截一张游戏画面；失败返回 null，绝不抛错 */
  function safeCapture() {
    try {
      if (typeof captureGameRegion === "function") return captureGameRegion() || null;
      if (typeof genshin !== "undefined" && genshin && typeof genshin.captureGameRegion === "function") {
        return genshin.captureGameRegion() || null;
      }
    } catch (e) {
      if (!captureWarned) {
        captureWarned = true;
        log.warn("截取游戏画面失败：" + ((e && e.message) ? e.message : e));
      }
    }
    return null;
  }

  /** 释放截图对象（ImageRegion 是 IDisposable，不释放会攒内存） */
  function disposeObj(o) {
    if (!o) return;
    try { if (typeof o.dispose === "function") { o.dispose(); return; } } catch (e) { }
    try { if (typeof o.Dispose === "function") o.Dispose(); } catch (e) { }
  }

  /* ==========================================================================
   *  四·B、战斗检测 → 自动暂停（用 BetterGI 的识别引擎，而不是交给 BGI 打）
   *
   *  原理：进战斗时，屏幕上方正中会出现敌人名称 + 血条；那块区域平时是空的。
   *        所以用 BGI 的 OCR 去读它：**读到文字 = 在打怪**。
   *
   *  为什么用 OCR 而不是模板：
   *        · 不用准备模板图，不用标定；
   *        · 换分辨率、换 UI 缩放都不受影响（纯读字）；
   *        · 打谁都能认（Boss、丘丘人、深渊法师……名称不同但都是"有字"）。
   *        如果哪天 OCR 不灵，还能切到"模板匹配"模式，用自己裁的血条图兜底。
   * ========================================================================== */

  const combat = {
    roi: null,
    hits: 0,
    missAt: 0,
    paused: false,
    lastCheck: 0,
    tpl: null,
    tplTried: false,
    lastText: "",
  };

  function parseRoi(s, def) {
    const a = String(s || "").split(",").map(function (x) { return parseInt(x, 10); });
    if (a.length !== 4 || !isFinite(a[0]) || !isFinite(a[1]) || !isFinite(a[2]) || !isFinite(a[3])) return def;
    return { x: a[0], y: a[1], w: a[2], h: a[3] };
  }

  function ensureCombatRoi() {
    if (!combat.roi) combat.roi = parseRoi(CFG.combatRoi, { x: 660, y: 20, w: 600, h: 70 });
    return combat.roi;
  }

  /** OCR 版：读到文字就算在战斗 */
  function detectByOcr(img) {
    const roi = ensureCombatRoi();
    try {
      const ro = RecognitionObject.ocr(roi.x, roi.y, roi.w, roi.h);
      const res = img.find(ro);
      if (!res) return { hit: false, text: "" };
      if (typeof res.isEmpty === "function" && res.isEmpty()) return { hit: false, text: "" };
      const t = String(res.text == null ? "" : res.text).trim();
      return { hit: t.length >= CFG.combatMinText, text: t };
    } catch (e) {
      return { hit: false, text: "" };
    }
  }

  /** 模板版：用自己裁的敌人血条图兜底 */
  function detectByTemplate(img) {
    if (!combat.tplTried) {
      combat.tplTried = true;
      try {
        combat.tpl = file.readImageMatSync(CFG.combatTemplate);
        log.info("战斗检测模板已加载：" + CFG.combatTemplate);
      } catch (e) {
        combat.tpl = null;
        log.warn("没找到 " + CFG.combatTemplate + "，模板模式下不会暂停。");
      }
    }
    if (!combat.tpl) return { hit: false, text: "" };
    const roi = ensureCombatRoi();
    try {
      const ro = RecognitionObject.templateMatch(combat.tpl, roi.x, roi.y, roi.w, roi.h);
      ro.threshold = Math.max(0.5, CFG.combatScore - 0.2);
      const res = img.find(ro);
      if (!res) return { hit: false, text: "" };
      if (typeof res.isEmpty === "function" && res.isEmpty()) return { hit: false, text: "" };
      let sc = 1;
      try { sc = Number(res.matchScore); } catch (e) { sc = 1; }
      return { hit: sc >= CFG.combatScore, text: "score=" + sc.toFixed(2) };
    } catch (e) {
      return { hit: false, text: "" };
    }
  }

  function combatTick(now) {
    if (!CFG.combatPause) return;
    if (now - combat.lastCheck < 700) return;
    combat.lastCheck = now;

    const img = safeCapture();
    if (!img) return;
    let r = { hit: false, text: "" };
    try {
      r = (CFG.combatMode === "template") ? detectByTemplate(img) : detectByOcr(img);
    } finally {
      disposeObj(img);
    }

    if (r.text && r.text !== combat.lastText) {
      combat.lastText = r.text;
      log.info("战斗检测读到：" + r.text + (CFG.combatDry ? "（试运行，不暂停）" : ""));
    }

    if (r.hit) {
      combat.hits++;
      combat.missAt = 0;
      if (!combat.paused && combat.hits >= 2) {          // 连续命中两次才动作，防抖
        combat.paused = true;
        if (!CFG.combatDry) cmd("setPlay", false);
        toast(CFG.combatDry ? "检测到战斗（试运行，未暂停）" : "检测到战斗，视频已暂停");
        log.info("检测到战斗 → " + (CFG.combatDry ? "试运行，不暂停" : "暂停视频"));
      }
    } else {
      combat.hits = 0;
      if (combat.paused) {
        if (!combat.missAt) combat.missAt = now;
        if (now - combat.missAt > CFG.combatResumeSec * 1000) {
          combat.paused = false;
          combat.missAt = 0;
          if (!CFG.combatDry) cmd("setPlay", true);
          toast("战斗结束，继续播放");
          log.info("战斗结束 → 继续播放");
        }
      }
    }
  }

  /* ==========================================================================
   *  五、热键 → 动作
   * ========================================================================== */

  function findActionByKey(key) {
    const hk = CFG.hotkeys;
    for (const action in hk) {
      if (!Object.prototype.hasOwnProperty.call(hk, action)) continue;
      if (!hk[action]) continue;
      if (canonKey(hk[action]) === canonKey(key)) return action;
    }
    const mk = CFG.mouseHotkeys;
    for (const action in mk) {
      if (!Object.prototype.hasOwnProperty.call(mk, action)) continue;
      if (!mk[action]) continue;
      if (normKey(mk[action]) === key) return action;
    }
    return null;
  }

  function doAction(action) {
    switch (action) {
      case "playPause":
        cmd("playPause");
        break;

      case "mark":
        cmd("mark");
        break;

      case "back":
        cmd("seek", -Math.abs(CFG.seekStep));
        toast("后退 " + CFG.seekStep + " 秒");
        break;

      case "forward":
        cmd("seek", Math.abs(CFG.seekStep));
        toast("前进 " + CFG.seekStep + " 秒");
        break;

      case "slower":
        state.speed = round(clamp(state.speed - CFG.speedStep, CFG.speedMin, CFG.speedMax), 2);
        cmd("speed", state.speed);
        toast("速度 " + state.speed + "×");
        break;

      case "faster":
        state.speed = round(clamp(state.speed + CFG.speedStep, CFG.speedMin, CFG.speedMax), 2);
        cmd("speed", state.speed);
        toast("速度 " + state.speed + "×");
        break;

      case "opacityDown":
        state.opacity = round(clamp(state.opacity - CFG.opacityStep, CFG.opacityMin, 1), 2);
        cmd("opacity", state.opacity);
        toast("透明度 " + Math.round(state.opacity * 100) + "%");
        break;

      case "opacityUp":
        state.opacity = round(clamp(state.opacity + CFG.opacityStep, CFG.opacityMin, 1), 2);
        cmd("opacity", state.opacity);
        toast("透明度 " + Math.round(state.opacity * 100) + "%");
        break;

      case "toggleHide":
        state.hidden = !state.hidden;
        cmd("hide", state.hidden);
        break;

      case "toggleInteractive":
        setInteractive(!state.interactive);
        toast(state.interactive ? "可交互：可拖动视频" : "鼠标穿透中");
        break;

      case "prevVideo":
        switchVideo(-1);
        break;

      case "nextVideo":
        switchVideo(1);
        break;

      case "close":
        state.running = false;
        break;

      default:
        break;
    }
  }

  function switchVideo(dir) {
    if (sources.length <= 1) {
      toast("播放列表里只有一个视频");
      return;
    }
    srcIndex = (srcIndex + dir + sources.length) % sources.length;
    state.src = sources[srcIndex];
    state.file = state.src.spec;
    state.resumeTime = 0;
    state.time = 0;
    cmd("load", { src: state.src, resume: 0, autoplay: true });
    toast("切换到：" + state.src.label);
  }

  /* ==========================================================================
   *  六、叠层上的即时提示（不打断游戏）
   * ========================================================================== */

  let lastToast = 0;
  function toast(text) {
    const now = Date.now();
    if (now - lastToast < 120 && !text) return;
    lastToast = now;
    cmd("toast", text);
  }

  /* ==========================================================================
   *  七、收到 HTML 页面消息
   * ========================================================================== */

  function handlePageMessage(raw) {
    let msg = null;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || !msg.url) return;
    const data = msg.data || {};

    switch (msg.url) {
      case "/ready":
        state.pageReady = true;
        send("/init", {
          src: state.src,
          layout: state.layout,
          fitRes: CFG.fitRes,
          ratio: state.ratio,
          baseVw: state.baseVw,
          baseVh: state.baseVh,
          opacity: state.opacity,
          speed: state.speed,
          volume: state.volume,
          resume: CFG.resume ? state.resumeTime : 0,
          autoplay: CFG.autoplay,
          interactive: state.interactive,
          showTip: CFG.showTip,
          sidebar: CFG.showSidebar,
          upMid: CFG.upMid,
          fav: readJsonSetting("vmFav", []),
          stats: readJsonSetting("vmStats", {}),
          showSubtitle: CFG.showSubtitle,
          qn: CFG.videoQn,
          autoPause: CFG.autoPause,
          autoPauseMode: CFG.autoPauseMode,
          autoPauseCut: CFG.autoPauseCut,
          autoPauseFight: CFG.autoPauseFight,
          marksOn: CFG.marksOn,
          voiceGate: CFG.voiceGate,
          // 本地视频清单（assets/videos 下的 mp4）。页面侧栏里会多出「本地视频」一项，
          // 只有真的扫到文件才显示，空的时候不占地方。
          locals: listLocalVideos(),
          // 上次看到哪：页面把它渲染成启动黑屏上的一张「接着上次看」卡片
          lastWatch: readLastWatch(),
          // 看完自动续播（v1.6.16）
          autoNext: CFG.autoNext,
          autoNextSec: CFG.autoNextSec,
          marks: marksFor(state.src && state.src.bvid || "", state.src && state.src.page || 1),
          hotkeyTip: buildHotkeyTip(),
          loginKey: (CFG.loginKeys[0] || "").toUpperCase(),
          // 方向键由主脚本的全局钩子处理（不用先按缩放热键）；开着的话页面就别再自己处理，
          // 否则浮窗有焦点时一次按键跳两下。
          keysGlobal: CFG.arrowGlobal && !!hook,
          holdKeyLabel: CFG.holdKeys.join("/").toUpperCase(),
          // 键位表：侧栏「键」面板按它渲染（v1.6.15）
          keys: hotkeyTable(),
        });
        log.info("攻略视频叠层已就绪。当前：" + (state.src ? state.src.label : "(空)") +
          (state.src && state.src.kind === "bili" ? "（在线播放，清晰度受未登录限制）" : ""));
        if (CFG.upMid && CFG.autoLoadCollections) {
          // 不阻塞主循环，后台把合集列表拉回来
          Promise.resolve().then(loadCollections);
        }
        // 分类索引也在后台开工：等浮窗站稳（4 秒）再开始，避免和合集请求撞在一起。
        // 用户点开侧栏之前就该是现成的 —— 否则每次点「分」都要干等十几秒。
        if (CFG.catalogOn && CFG.upMid && !state.preloadDone) {
          state.preloadAt = Date.now() + (CFG.autoLoadCollections ? 6000 : 4000);
        }
        break;

      case "/state":
        if (isFinite(data.x)) state.layout.x = Number(data.x);
        if (isFinite(data.y)) state.layout.y = Number(data.y);
        if (isFinite(data.w)) state.layout.w = Number(data.w);
        if (isFinite(data.h)) state.layout.h = Number(data.h);
        // 页面回报的比例 + 它当时的视口尺寸，一起存下来给下次启动用
        if (isFinite(data.rx) && isFinite(data.ry) && isFinite(data.rw) &&
          isFinite(data.vw) && Number(data.vw) > 100) {
          state.ratio = {
            rx: Number(data.rx), ry: Number(data.ry),
            rw: Number(data.rw),
            ar: isFinite(data.ar) ? Number(data.ar) : 203 / 360,
          };
          state.baseVw = Number(data.vw);
          if (isFinite(data.vh) && Number(data.vh) > 100) state.baseVh = Number(data.vh);
        }
        if (isFinite(data.opacity)) state.opacity = Number(data.opacity);
        if (isFinite(data.speed)) state.speed = Number(data.speed);
        if (isFinite(data.volume)) state.volume = Number(data.volume);
        break;

      case "/progress":
        if (isFinite(data.t)) state.time = Number(data.t);
        if (isFinite(data.d)) state.duration = Number(data.d);
        if (data.playing !== undefined) state.playing = !!data.playing;
        break;

      case "/pref":
        // ⚙ 面板里改的开关顺手写回设置：下次启动还是这个状态，
        // 免得"这次关了自动暂停，重开脚本又自己开起来"。
        if (data.autoPause !== undefined) {
          CFG.autoPause = data.autoPause === true;
          try { settings.set("autoPause", CFG.autoPause); } catch (e) { }
          log.info("⚙ 自动暂停：" + (CFG.autoPause ? "开" : "关") + "（已存进设置）");
        }
        if (data.marksOn !== undefined) {
          CFG.marksOn = data.marksOn === true;
          try { settings.set("marksOn", CFG.marksOn); } catch (e) { }
          log.info("⚙ 打怪点暂停：" + (CFG.marksOn ? "开" : "关") + "（已存进设置）");
        }
        if (data.autoNext !== undefined) {
          CFG.autoNext = data.autoNext === true;
          try { settings.set("autoNext", CFG.autoNext); } catch (e) { }
          log.info("⚙ 看完续播：" + (CFG.autoNext ? "开" : "关") +
            (CFG.autoNext ? "（" + CFG.autoNextSec + " 秒）" : "") + "（已存进设置）");
        }
        break;

      case "/autonext":
        // ⚙ 面板「看完续播」开关 + 秒数：这个开关由页面自己管倒计时，主脚本只需存下来，
        // 下次启动通过 /init 再发回去。顺手把秒数报给页面，toast 里要显示。
        if (data.on !== undefined) {
          CFG.autoNext = data.on === true;
          try { settings.set("autoNext", CFG.autoNext); } catch (e) { }
          log.info("⚙ 看完续播：" + (CFG.autoNext ? "开（" + CFG.autoNextSec + " 秒）" : "关") +
            "（已存进设置）");
        }
        if (data.sec !== undefined) {
          const s = Math.max(3, Math.min(30, Math.round(Number(data.sec) || CFG.autoNextSec)));
          if (s !== CFG.autoNextSec) {
            CFG.autoNextSec = s;
            try {
              settings.set("autoNextSec", String(s));
              settings.set("autoNextSecMig", "1");   // 手动改过就别再被默认值迁移覆盖
            } catch (e) { }
            log.info("⚙ 续播倒计时：" + s + " 秒（已存进设置）");
          }
        }
        send("/autonext", { on: CFG.autoNext, sec: CFG.autoNextSec });
        break;

      case "/keycap":
        // 侧栏「键」面板里点了某一行 → 接下来的那个键归它（Esc 取消）
        if (data.on === true && data.id) {
          state.keyCap = String(data.id);
          state.keyCapAt = Date.now();
          const d = hotkeyDef(state.keyCap);
          toast("按一个键" + (d ? "给「" + d.label + "」" : "") + "（Esc 取消）");
          log.info("等待按键：给「" + (d ? d.label : state.keyCap) + "」绑一个新键，Esc 取消。");
        } else {
          state.keyCap = null;
        }
        break;

      case "/hotkey": {
        // 页面捕获到键之后回传：存设置 + 重挂钩子 + 把新表推回去
        const hid = String(data.id || "");
        const hdef = hotkeyDef(hid);
        if (!hdef) {
          send("/keys", { keys: hotkeyTable(), tip: buildHotkeyTip() });
          break;
        }
        const hkey = normKey(data.key == null ? "" : data.key);
        const cleared = hotkeySet(hid, hkey);
        const shown = hkey ? hkey.toUpperCase() : "（未设置）";
        log.info("⚙ 按键：" + hdef.label + " → " + shown +
          (cleared.length ? "；原来占着这个键的「" + cleared.join("」「") + "」已清空" : ""));
        const safe = safeOneKey(hkey);
        if (safe.why) {
          log.warn("「" + hkey + "」会被浮窗内置浏览器抢走（" + safe.why +
            "），按了没反应的话换一个键。");
        }
        toast(hdef.label + "：" + shown +
          (cleared.length ? "（" + cleared[0] + " 已让出这个键）" : ""));
        break;
      }

      case "/keys":
        // 页面主动要一份当前键位（比如它自己重新渲染）
        send("/keys", {
          keys: hotkeyTable(),
          tip: buildHotkeyTip(),
          holdKeyLabel: CFG.holdKeys.join("/").toUpperCase(),
        });
        break;

      case "/keys-reset": {
        // 一键恢复：F9 播放 / Insert 缩放 / Alt 按住 / End 登录，其余清空
        for (let i = 0; i < HOTKEY_DEFS.length; i++) {
          hotkeyStore(HOTKEY_DEFS[i], normKey(HOTKEY_DEFS[i].def));
        }
        disposeHook();
        setupHook(true);
        send("/keys", {
          keys: hotkeyTable(),
          tip: buildHotkeyTip(),
          holdKeyLabel: CFG.holdKeys.join("/").toUpperCase(),
        });
        log.info("⚙ 按键已恢复默认：F9 播放/暂停、Insert 缩放、Alt 按住可操作、End 登录窗。");
        toast("按键已恢复默认");
        break;
      }

      case "/fold":
        // 页面把画面收起成一条控制条（点 ▾），或者又展开了（点 ⤢）。
        // 收起时整块就剩下边栏那 34px，所以把它当成一个大热区：
        // 鼠标搭上去立刻可交互，不然那条看不见的"穿透"键盘根本点不动。
        state.folded = !!data.on;
        state.lastUxAt = Date.now();
        if (state.folded) setInteractive(true);
        log.info(state.folded ? "浮窗已收起（只留下边栏），鼠标移上去即可操作。" : "浮窗已展开画面。");
        break;

      case "/close":
        log.info("叠层上的关闭按钮被点击，脚本结束。");
        state.running = false;
        break;

      case "/switch":
        switchVideo(Number(data.dir) < 0 ? -1 : 1);
        break;

      case "/focus":
        // 页面自己上报的键盘焦点。只用来记日志。
        // 关键事实：BGI 的 setClickThrough(false) 里那句 Activate() 并不会让页面拿到
        // 键盘焦点（要点一下页面才有），所以刚进缩放模式时这里一直是 false。
        // v1.6.3 的"两段式热键"、v1.6.5 的"失焦 1.2 秒自动还鼠标"都拿它当判据，
        // 结果每按一次 Insert 进缩放模式，1.2 秒后鼠标就自己跳回游戏中心（v1.6.6 已都删掉）。
        state.pageFocus = data.on === true;
        if (state.pageFocus) state.lastUxAt = Date.now();
        if (state.pageFocus && !state.focusLogged) {
          state.focusLogged = true;
          log.info("浮窗页面已获得键盘焦点（方向键可用）。");
        }
        break;

      case "/through":
        // v1.6.8：这个指令已经作废 —— "单击画面还鼠标"整条链路拆掉了（太容易误触）。
        // 留着这个分支只为了兼容还在发它的旧页面：收下、什么也不做、不报错。
        log.info("收到已停用的 /through（单击还鼠标），忽略。");
        break;

      case "/idle":
        if (state.resizeMode) break;                      // 缩放模式时不做空闲穿透
        // 系列栏开着也算"人在用浮窗"，但一直没人动就该收 —— 面板不是常驻的
        if (state.pinned) closeSidePanel("长时间没操作");
        if (state.interactive) {
          setInteractive(false);
          toast("长时间没操作，已自动切回鼠标穿透");
        }
        break;

      case "/scrub":
        // 页面报告"正在拖进度条"。拖动期间：
        //   1) 强制可交互，否则鼠标事件到不了页面
        //   2) hoverTick 直接跳过，免得手一停就被判成移开、穿透关掉把拖动掐断
        state.scrubbing = !!data.on;
        state.lastUxAt = Date.now();
        if (state.scrubbing) {
          state.hoverOutAt = 0;
          if (!state.interactive) setInteractive(true);
        }
        break;

      case "/pin":
        // 页面侧的系列栏开着（on:true）/ 关了（on:false）。
        // 开着期间保持可交互，不然侧栏点不到；但"什么时候关"由脚本侧说了算：
        // 松开 Alt、或者鼠标还给游戏，都会发 closeside（见 closeSidePanel）。
        state.pinned = !!data.on;
        state.sideOpen = !!data.on;
        state.lastUxAt = Date.now();
        if (state.pinned) {
          setInteractive(true);
        } else {
          state.holdUpAt = 0;
          if (!state.holdDown && !state.dragging && !state.resizeMode) setInteractive(false);
        }
        break;

      case "/api/collections":
        loadCollections();
        break;

      case "/api/catalog":
        // region 为空 = 只要分类摘要；带了 = 要这个地区的条目
        if (data.region) {
          send("/catalog-region", {
            region: String(data.region),
            items: catalogRegionItems(String(data.region)),
          });
        } else if (data.force) {
          indexCatalog(true);
        } else if (catalog) {
          send("/catalog-index", catalogSummary());
        } else {
          indexCatalog(false);
        }
        break;

      case "/api/catalog-refresh":
        indexCatalog(true);
        break;

      case "/api/catalog-find": {
        // 页面重开侧栏时要"定位到当前这一集"：给个 bvid，回它属于哪个地区 / 哪一类。
        // 索引里没有（比如系列视图里选的视频）就回空 region，页面保持原样。
        const bv = String(data.bvid || "");
        let list = (catalog && catalog.items) ? catalog.items : [];
        if (!list.length) {
          // 索引还在后台建的时候，先用本地缓存查一次，别让"定位当前"白白落空
          const cached = readCatalog();
          if (cached && cached.items) list = cached.items;
        }
        let hit = null;
        for (let i = 0; i < list.length; i++) {
          if (list[i].bvid === bv) { hit = list[i]; break; }
        }
        send("/catalog-find", hit
          ? { bvid: bv, region: hit.region || "未分类", kind: hit.kind || "其他", title: hit.title || "" }
          : { bvid: bv, region: "" });
        break;
      }

      case "/api/episodes":
        loadEpisodes(String(data.kind || "season"), String(data.id || ""), data.page || 1);
        break;

      case "/login":
        openBiliLogin();
        break;

      case "/snapshot":
        snapshot();
        break;

      case "/api/danmaku":
        Promise.resolve().then(function () { fetchDanmaku(String(data.bvid || "")); });
        break;

      case "/api/playurl":
        state.curBvid = String(data.bvid || state.src && state.src.bvid || "");
        state.curPage = Number(data.page || 1) || 1;
        Promise.resolve().then(function () {
          fetchPlayUrl(
            String(data.bvid || state.src && state.src.bvid || ""),
            data.page || 1,
            isFinite(data.qn) ? Number(data.qn) : CFG.videoQn,
            data.t
          );
        });
        break;

      case "/api/marks":
        send("/marks", { list: marksFor(String(data.bvid || state.curBvid), data.page || state.curPage) });
        break;

      case "/api/local":
        send("/local", { files: listLocalVideos() });
        break;

      case "/mark":
        saveMarks(state.curBvid, state.curPage, data.list || []);
        break;

      case "/last": {
        const t = Number(data.t) || 0;
        if (!(t > 1)) break;
        const rec = {
          bvid: String(data.bvid || (state.src && state.src.bvid) || ""),
          page: Number(data.page) || 1,
          file: String(data.file || ""),
          t: round(t, 1),
          dur: Math.round(Number(data.dur) || 0),
          title: String(data.title || "").slice(0, 80),
          at: Date.now(),
        };
        if (!rec.bvid && !rec.file) break;
        if (rec.bvid) {
          state.curBvid = rec.bvid;
          state.curPage = rec.page;
        }
        saveLastWatch(rec);
        break;
      }

      case "/lastClear":
        try { st.vmLast = ""; } catch (e) { }
        try {
          if (typeof settings !== "undefined" && settings && typeof settings.set === "function") {
            settings.set("vmLast", "");
          }
        } catch (e) { }
        log.info("已忘掉上次观看记录");
        break;

      case "/api/subtitle":
        Promise.resolve().then(function () { fetchSubtitle(String(data.bvid || "")); });
        break;

      case "/geom":
        if (data && isFinite(data.x)) {
          state.geom = {
            sx: Number(data.sx) || 0,
            sy: Number(data.sy) || 0,
            dpr: Number(data.dpr) || 1,
            x: Number(data.x), y: Number(data.y),
            w: Number(data.w), h: Number(data.h),
            // 系列栏矩形（开着才有）。和视频矩形同一套 CSS 坐标，直接参与悬停判断。
            side: (data.side && isFinite(data.side.x)) ? {
              x: Number(data.side.x), y: Number(data.side.y),
              w: Number(data.side.w), h: Number(data.side.h),
            } : null,
          };
          if (!state.geomLogged) {
            state.geomLogged = true;
            log.info("叠层几何：屏幕位置(" + state.geom.sx + "," + state.geom.sy +
              ") dpr=" + state.geom.dpr +
              " 视频矩形(" + state.geom.x + "," + state.geom.y + "," + state.geom.w + "," + state.geom.h + ")");
          }
        }
        break;

      case "/dragstate":
        state.dragging = !!(data && data.d);
        break;

      case "/fav":
        try { st.vmFav = JSON.stringify(data.list || []); } catch (e) { }
        break;

      case "/stats":
        try { st.vmStats = JSON.stringify(data.days || {}); } catch (e) { }
        break;

      case "/log":
        if (data.msg) log.info(String(data.msg));
        break;

      case "/error":
        log.error("播放器报告：" + String(data.msg || "未知错误"));
        break;

      default:
        break;
    }
  }

  /**
   * 启动时那一行热键提示。
   *
   * 以前分两个分支：总开关关着就说缩放/登录，开着就只说动作键 —— 结果 v1.6.13 把 F9 设成默认后，
   * 总开关默认开着，提示里就只剩「F9 播放/暂停」，Insert 和 End 全丢了。
   * 现在统一拼一条：**缩放 → 动作键 → 登录**，谁有就写谁。
   */
  function buildHotkeyTip() {
    const hk = CFG.hotkeys;
    const K = function (k) { return k ? k.toUpperCase() : ""; };
    const parts = [];
    if (CFG.resizeKeys.length) {
      parts.push(K(CFG.resizeKeys[0]) + " 缩放（再按一次交还鼠标）");
    } else {
      parts.push("(缩放热键未配置)");
    }
    if (hk.playPause) parts.push(K(hk.playPause) + " 播放/暂停");
    if (hk.back) parts.push(K(hk.back) + " 后退");
    if (hk.forward) parts.push(K(hk.forward) + " 前进");
    if (hk.slower) parts.push(K(hk.slower) + " 减速");
    if (hk.faster) parts.push(K(hk.faster) + " 加速");
    if (hk.opacityDown) parts.push(K(hk.opacityDown) + " 变淡");
    if (hk.opacityUp) parts.push(K(hk.opacityUp) + " 变实");
    if (hk.toggleHide) parts.push(K(hk.toggleHide) + " 隐藏");
    if (hk.toggleInteractive) parts.push(K(hk.toggleInteractive) + " 可交互");
    if (hk.prevVideo) parts.push(K(hk.prevVideo) + " 上集");
    if (hk.nextVideo) parts.push(K(hk.nextVideo) + " 下集");
    if (hk.mark) parts.push(K(hk.mark) + " 打怪点");
    if (hk.close) parts.push(K(hk.close) + " 关闭");
    if (CFG.loginKeys.length) parts.push(K(CFG.loginKeys[0]) + " B 站登录窗");
    if (CFG.holdKeys.length) parts.push("按住 " + K(CFG.holdKeys[0]) + " 可拖 / 点");
    return parts.join("　|　");
  }

  /* ==========================================================================
   *  八、保存状态
   * ========================================================================== */

  /**
   * 「上次看到哪」（v1.6.22）。
   * 页面每 8 秒 + 每次暂停上报一次，这里只负责存和筛。
   * 三种情况不认：没看过（t<5）、已经看完（离结尾不到 15 秒）、放太久（30 天）。
   * 存在的意义：选片是页面自己做的，主脚本不知道你最后点了哪一集、看到第几秒，
   * 退出重开后只能靠这份记录把人和进度接回去。
   */
  function readLastWatch() {
    const o = readJsonSetting("vmLast", null);
    if (!o || typeof o !== "object") return null;
    if (!o.bvid && !o.file) return null;
    const at = Number(o.at) || 0;
    if (!at || Date.now() - at > 30 * 86400000) return null;
    const t = Number(o.t) || 0;
    if (!(t > 1)) return null;
    const dur = Number(o.dur) || 0;
    /* 看到结尾的也算「上一次」：用户要的是"回到那一集"，不是"从中间接着播"。
     * 打个 done 标记，页面那边换成「再看一遍」，别问"接着看完 0 秒"。 */
    const done = dur > 0 && t > dur - 15;
    if (!done && !(t > 5)) return null;
    return {
      bvid: String(o.bvid || ""),
      page: Number(o.page) || 1,
      file: String(o.file || ""),
      t: round(done ? 0 : t, 1),
      dur: Math.round(dur),
      done: done,
      title: String(o.title || ""),
      at: at,
    };
  }

  function saveLastWatch(rec) {
    const json = JSON.stringify(rec);
    try { st.vmLast = json; } catch (e) { }
    try {
      if (typeof settings !== "undefined" && settings && typeof settings.set === "function") {
        settings.set("vmLast", json);
      }
    } catch (e) { }
  }

  function persist() {
    try {
      st.vmLayout = JSON.stringify({
        x: Math.round(state.layout.x),
        y: Math.round(state.layout.y),
        w: Math.round(state.layout.w),
        h: Math.round(state.layout.h),
        // 比例 + 基准视口：跨分辨率/全屏恢复全靠这四个数
        ratio: state.ratio || null,
        baseVw: Math.round(state.baseVw || 0),
        baseVh: Math.round(state.baseVh || 0),
        opacity: state.opacity,
        speed: state.speed,
        volume: state.volume,
        t: CFG.resume ? round(state.time, 1) : 0,
        resumeEnabled: !!CFG.resume,
        file: state.file,
      });
    } catch (e) { }
  }

  /* ==========================================================================
   *  九、主流程
   * ========================================================================== */

  function openMask() {
    try {
      const id = htmlMask.show("assets/player.html", WINDOW_ID);
      state.winId = id || WINDOW_ID;
      log.info("叠层窗口已请求创建，id=" + state.winId +
        "，位置 " + Math.round(state.layout.x) + "," + Math.round(state.layout.y) +
        " 尺寸 " + Math.round(state.layout.w) + "x" + Math.round(state.layout.h) +
        (saved ? "" : "（首次启动/已重置位置）"));
      if (state.ratio) {
        log.info("上次的比例位置：rx=" + round(state.ratio.rx, 3) + " ry=" + round(state.ratio.ry, 3) +
          " rw=" + round(state.ratio.rw, 3) + "（基准视口 " + Math.round(state.baseVw) + "x" +
          Math.round(state.baseVh) + "）" + (CFG.fitRes ? "，这次分辨率不同会自动换算。" : "，但分辨率自适应是关的。"));
      }
    } catch (e) {
      throw new Error("打开 HTML 叠层失败：" + ((e && e.message) ? e.message : String(e)));
    }
    try { htmlMask.setClickThrough(state.winId, !state.interactive); } catch (e) { }
    try { htmlMask.setClickThrough("bili_login", false); } catch (e) { }
  }

  /* ==========================================================================
   *  八点五、截图体检
   *  目的只有一个：确认 captureGameRegion() 拍出来的画面里，有没有把这层浮窗
   *  一起拍进去。拍进去也没关系 —— 后续做宝箱检测时把这个矩形挖掉就行，
   *  但得先知道矩形准不准、截图和窗口是不是 1:1。
   * ========================================================================== */

  function readDim(o, names) {
    for (let i = 0; i < names.length; i++) {
      try {
        const v = o[names[i]];
        if (typeof v === "function") {
          const r = v.call(o);
          if (isFinite(r) && r > 0) return Number(r);
        } else if (isFinite(v) && v > 0) return Number(v);
      } catch (e) { }
    }
    return 0;
  }

  /**
   * 读游戏真实分辨率。
   * 注意：captureGameRegion() 在游戏分辨率 >1080P 时会自动缩到 1920x1080，
   * 拿它当"当前分辨率"会算错，所以这里用 getGameMetrics()（返回 [宽, 高, DPI]）。
   * 旧版 BGI 没有这个函数，返回 null，调用方自行降级。
   */
  function gameMetrics() {
    try {
      if (typeof getGameMetrics === "function") {
        const m = getGameMetrics();
        if (m && m.length >= 2) {
          const w = Number(m[0]), h = Number(m[1]);
          const dpi = (m.length >= 3 && isFinite(m[2]) && Number(m[2]) > 0) ? Number(m[2]) : 1;
          if (w > 0 && h > 0) return { w: w, h: h, dpi: dpi };
        }
      }
    } catch (e) { }
    return null;
  }

  function probeCapture() {
    let img = null;
    try {
      if (typeof captureGameRegion === "function") img = captureGameRegion();
      else if (typeof genshin !== "undefined" && genshin && typeof genshin.captureGameRegion === "function") {
        img = genshin.captureGameRegion();
      }
    } catch (e) { }
    if (!img) {
      log.warn("[体检] 取不到游戏画面（captureGameRegion 返回空）→ 游戏侧宝箱检测做不了。");
      return;
    }

    const W = readDim(img, ["Width", "width"]);
    const H = readDim(img, ["Height", "height"]);
    const L = state.layout;
    log.info("[体检] 游戏截图 " + W + "x" + H +
      "　浮窗 " + Math.round(L.x) + "," + Math.round(L.y) +
      " 尺寸 " + Math.round(L.w) + "x" + Math.round(L.h) +
      "　右边界 " + Math.round(L.x + L.w) + " 下边界 " + Math.round(L.y + L.h));

    const path = "debug_capture.png";
    // 真实分辨率和截图尺寸可能不一样：>1080P 时 captureGameRegion 会缩到 1920x1080，
    // 后面做游戏侧检测（宝箱/战斗）时坐标得按这个比例换算，所以先记清楚。
    const gm = gameMetrics();
    log.info("[体检] 游戏分辨率 " + (gm ? (gm.w + "x" + gm.h + "  DPI " + gm.dpi) : "(拿不到 getGameMetrics)") +
      "　截图 " + W + "x" + H +
      (gm && (W !== gm.w || H !== gm.h) ? " → 截图被缩放过，坐标要 ×" + round(gm.w / (W || 1), 3) : " → 1:1，坐标可直接用"));
    const ways = [
      ["img.SaveImage", function () { img.SaveImage(path); }],
      ["img.SrcMat.SaveImage", function () { img.SrcMat.SaveImage(path); }],
      ["img.srcMat.SaveImage", function () { img.srcMat.SaveImage(path); }],
      ["img.Save", function () { img.Save(path); }],
      ["img.SrcBitmap.Save", function () { img.SrcBitmap.Save(path); }],
    ];
    let how = "";
    for (let i = 0; i < ways.length; i++) {
      try { ways[i][1](); how = ways[i][0]; break; } catch (e) { }
    }
    if (how) {
      log.info("[体检] 已存图 " + path + "（" + how + "）。打开看一眼：视频浮窗在不在图里？");
      if (W && L.x + L.w > W) log.warn("[体检] 浮窗右边界超出截图宽度，坐标可能不是 1:1，需要换算。");
    } else {
      log.warn("[体检] 存图通道全失败，只拿到了尺寸。");
    }
    try { if (img && typeof img.dispose === "function") img.dispose(); } catch (e) { }
  }

  async function run() {
    log.info("===== VideoMask v" + SCRIPT_VERSION + " 启动 =====");
    state.running = true;

    openMask();
    log.info("视频源：" + (state.src ? state.src.label : "(空)") +
      (state.src && state.src.kind === "bili" ? "  【在线·B站直链自播】" : ""));
    log.info("热键：" + buildHotkeyTip());
    // 续播状态打一行日志：设置页里勾没勾、几秒，一眼能确认（改了设置要重开脚本才读到）
    log.info("看完续播：" + (CFG.autoNext
      ? ("开（播完倒计时 " + CFG.autoNextSec + " 秒自动切下一个）")
      : "关（一集播完就停在结尾）"));
    if (HOTKEY_SAFE) {
      log.info("提示：F12 是浮窗内置浏览器的「开发者工具」、F5 是「刷新页面」，" +
        "这两个键脚本不会再用（缩放模式已改用 " + (CFG.resizeKeys[0] || "Insert").toUpperCase() + "）。");
    }
    if (state.interactive) log.info("叠层启动时就是【可交互】状态，可以直接拖动视频。");

    setupHook();

    // v1.6.29：BGI 跑 JS 脚本时会把它自己的实时触发（自动拾取 / 自动剧情）全关掉，
    // 这里按用户原本的设置挂回来，否则「边看攻略边让它自动捡东西/过剧情」是不可能成立的。
    try { restoreBgiRealtimeTasks(); } catch (e) {
      log.warn("挂回 BGI 实时触发失败：" + ((e && e.message) ? e.message : String(e)));
    }

    // v1.6.23：进度条热区 / 悬停模式开着时，鼠标一搭到浮窗，浮窗就抢前台焦点
    // （BGI 在 setClickThrough 里 SetForegroundWindow+Activate），游戏失焦 → BGI 自带
    // 自动剧情（过剧情）的前台点击点不到游戏、卡住。这里醒目提醒一句。
    if (CFG.scrubZone || CFG.hoverMode) {
      try {
        log.warn("⚠ 开着「进度条热区」或「鼠标悬停模式」：浮窗会在鼠标搭上去时抢前台焦点，" +
          "可能导致 BGI 自带的自动剧情（过剧情）失效。要么在齿轮面板里关掉它们，要么去 BGI 设置开「后台运行」。");
      } catch (e) { }
    }

    // 截图体检：浮窗摆好之后再拍，否则拍到的是"浮窗还没出来"的画面。
    // 注意 BGI 的 JS 环境里【没有 setTimeout】（实测 ReferenceError），
    // 只能靠主循环里比时间戳来延时，写 setTimeout 会让脚本当场崩掉。
    let probeAt = Date.now() + 9000;
    let probeDone = false;

    // 启动后先给一段可拖动的时间，方便摆位置（不用任何热键）
    if (CFG.startupInteractiveSec > 0) {
      setInteractive(true);
      state.graceUntil = Date.now() + CFG.startupInteractiveSec * 1000;
      log.info("现在是【可拖动】状态：" + CFG.startupInteractiveSec +
        " 秒内可以用鼠标拖动画面、拉四个角缩放，之后自动穿透。");
      toast("可拖动 " + CFG.startupInteractiveSec + " 秒，摆好位置就行");
    }
    if (CFG.combatPause) {
      log.info("战斗检测已开启（模式：" + CFG.combatMode + "）" +
        (CFG.combatDry ? "｜试运行：只记日志不暂停，确认识别正常后关掉「战斗检测试运行」" : ""));
    }

    let lastPersist = 0;
    const seenKeys = {};
    const openedAt = Date.now();
    let missCount = 0;
    let everAlive = false;      // 是否曾经真的创建成功过（用来区分"没建出来"和"被关掉"）
    while (state.running) {
      // 0) 到点了就拍一张体检图（替代不存在的 setTimeout）
      if (!probeDone && Date.now() >= probeAt) {
        probeDone = true;
        try { probeCapture(); } catch (e) { log.warn("[体检] 拍照出错：" + ((e && e.message) ? e.message : e)); }
      }

      // 1) 处理热键队列
      while (keyQueue.length) {
        const ev = keyQueue.shift();
        const action = findActionByKey(ev.key);
        if (action) {
          log.info("热键 " + ev.key + " → " + action);
          doAction(action);
        } else if (!seenKeys[ev.key]) {
          // 前几个没绑定的键打出来，方便排查"键名对不上"的问题
          seenKeys[ev.key] = true;
          if (Object.keys(seenKeys).length <= 6) {
            log.info("钩子收到按键「" + ev.key + "」，当前没有绑定动作（可用于确认钩子是否生效 / 键名写法）");
          }
        }
      }

      // 2) 收页面消息
      let raw = null;
      try {
        raw = await htmlMask.receive(state.winId, 80);
      } catch (e) {
        raw = null;
      }
      if (raw) handlePageMessage(raw);

      // 3) 窗口被关掉就退出（刚创建的头 8 秒不算，WebView2 初始化需要时间）
      let alive = true;
      try { alive = htmlMask.exists(state.winId); } catch (e) { alive = true; }
      if (!alive) {
        if (Date.now() - openedAt < 8000) {
          await sleep(150);
          continue;                      // 初始化中，先等，别急着退出
        }
        missCount++;
        if (missCount >= 3) {
          if (everAlive) {
            log.info("叠层窗口已关闭（你点了停止 / 关了窗口），脚本正常退出。");
          } else {
            log.error("叠层窗口没能创建出来（WebView2 初始化失败），脚本退出。");
            log.error("常见原因：WebView2 数据目录不可写 / 另一个 WebView2 实例占用了它。");
          }
          break;
        }
      } else {
        missCount = 0;
        everAlive = true;
      }

      // 3.9) 改键超时兜底：10 秒没人按键就取消，别让钩子一直处在"吃掉所有键"的状态
      if (state.keyCap && Date.now() - state.keyCapAt > 10000) {
        const capId = state.keyCap;
        state.keyCap = null;
        send("/keycap", { id: capId, cancel: true, timeout: true });
        toast("改键超时，已取消");
      }

      // 4) 战斗检测（自动暂停）
      combatTick(Date.now());

      // 4.5) 鼠标悬停 → 自动切换穿透
      hoverTick(Date.now());

      // 4.51) 穿透状态对账（窗口被外部重置 / 重建时把"可交互"拉回来）
      reconcileClickThrough(Date.now());

      // 4.53) 后台预建分类索引（点开侧栏之前就该建好）
      preloadTick(Date.now());

      // 4.54) 登录窗超时兜底（万一热键没按，五分钟自动关）
      loginTick(Date.now());

      // 4.55) 松开「临时接管键」（默认 Alt）后 250ms → 切回穿透
      //       （不能用 setTimeout，钩子回调里没有；正在拖进度条时先别抢）
      if (state.holdUpAt) {
        if (state.holdDown) {
          state.holdUpAt = 0;                       // 又按下了，取消
        } else if (Date.now() - state.holdUpAt > 250) {
          state.holdUpAt = 0;
          // v1.6.28：松手就等于"这一轮临时操作结束"，系列栏跟着收回去。
          // 用户实测的手感是：按 Alt → 点「⧉」开系列栏 → 选视频 → 松 Alt，侧栏应该自己走。
          closeSidePanel("松开了临时接管键");
          if (!state.dragging && !state.scrubbing && !state.resizeMode) setInteractive(false);
        }
      }

      // 4.6) 摆位宽限期结束 → 自动穿透
      if (state.graceUntil && Date.now() > state.graceUntil && !state.dragging && !state.pinned && !state.resizeMode) {
        state.graceUntil = 0;
        setInteractive(false);
        log.info("摆位时间结束，已切回鼠标穿透。想再调位置就重跑一次脚本。");
      }

      // 4.7) 游戏分辨率变了（切全屏 / 改分辨率）→ 让浮窗按比例重排
      //      叠层视口自己变的时候页面会走 resize；视口没变（浮窗盖整屏）就靠这条兜住。
      if (CFG.fitRes && state.pageReady && !state.metricBroken) {
        const t = Date.now();
        if (t - state.metricAt > 1200) {
          state.metricAt = t;
          const m = gameMetrics();
          if (!m) {
            state.metricBroken = true;
            log.info("这个 BGI 版本没有 getGameMetrics，分辨率变化只能靠浮窗视口自己发现（多数情况下也够用）。");
          } else if (!state.metric) {
            state.metric = m;
            log.info("游戏分辨率 " + m.w + "×" + m.h + "（DPI " + m.dpi + "）｜分辨率自适应已开启。");
          } else if (state.metric.w !== m.w || state.metric.h !== m.h || state.metric.dpi !== m.dpi) {
            log.info("游戏分辨率变化：" + state.metric.w + "×" + state.metric.h +
              " → " + m.w + "×" + m.h + "，通知浮窗按比例重排。");
            state.metric = m;
            send("/metric", { w: m.w, h: m.h, dpi: m.dpi });
          }
        }
      }

      // 5) 每隔一段时间落一次盘，防止游戏崩溃丢进度
      const now = Date.now();
      if (now - lastPersist > 15000) {
        lastPersist = now;
        persist();
      }
    }

    // 收尾：再推一帧状态给页面，让它有机会回报当前进度
    send("/cmd", { a: "flush" });
    try { await sleep(120); } catch (e) { }
    persist();
  }

  try {
    await run();
  } catch (err) {
    log.error("脚本异常终止：" + ((err && err.message) ? err.message : String(err)));
    if (err && err.stack) log.error(String(err.stack));
  } finally {
    persist();
    disposeHook();
    try { if (state.winId) htmlMask.close(state.winId); } catch (e) { }
    try { htmlMask.closeAll(); } catch (e) { }
    log.info("===== VideoMask 已退出 =====");
  }
})();
