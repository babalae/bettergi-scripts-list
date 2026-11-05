// 面板模式：开 htmlMask 窗口，循环收消息，读写 config/。
// 通信方向：HTML 用 chrome.webview.postMessage 发 -> 这里 receive；这里用 htmlMask.send 回 -> HTML onMessage 收。

import {
  CONFIG_DIR,
  readForPanel,
  loadGlobal,
  saveGlobal,
  setUiTheme,
  saveConfig,
  createAccount,
  listAccounts,
  listAccountsWithName,
  syncUidOptions,
  checkUid,
  exists,
  resolveVersion,
  setActiveVersion,
  fileExists,
  loadState,
  loadTemplate,
  saveTemplate,
  toSegments,
  TEMPLATE_UID
} from "./config.js";
import { fmtDate, gameNow } from "./utils.js";
import { GROUP_DAYS, todayGroup, weekName } from "./schedule.js";

const WIN_ID = "combat-config";
const HTML_PATH = "assets/config.html";

/**
 * 顶部「游戏日」后面那截：今天星期几、天赋 / 武器本开放第几组材料。
 * 组号与执行端同一份表（schedule.js），界面不自己算一份。
 * 换日小时也走执行端同一来源（toSegments 出的 dayStart），用户改了 clocks.dayStart 不会两端口径分叉。
 * 周日全开没有「第几组」，group 给 0。
 */
function dayInfo() {
  let dayStart;
  try {
    dayStart = toSegments(loadGlobal(), (m) => log.warn(m)).dayStart;
  } catch (e) {
    // 全局配置读不到 / 校验失败：gameNow 缺省按默认 4 点折
    log.warn(`换日小时取默认值（全局配置不可用：${e && e.message ? e.message : e}）`);
  }
  const d = gameNow(dayStart);
  const wd = d.getDay();
  const g = todayGroup(wd);
  const days = g > 0 ? GROUP_DAYS[g] || [] : [];
  return {
    date: fmtDate(d),
    weekday: wd,
    weekName: weekName(wd),
    group: g,
    // 同组的另外几天：「周一 / 周四」
    daysText: days.map(weekName).join(" / "),
    label: g > 0 ? `素材第 ${g} 组` : g === 0 ? "素材全开" : "素材组未知"
  };
}

/** 打开面板时带的 uid，只用作个人页的默认选中项 */
let activeUid = "";

/**
 * 这次打开面板时识别到的「当前登录账号」（genshin.uid() 的 9 位结果，识别失败为空）。
 * 两个用途：左栏里排到最前、settings.json 的 UID 下拉里排第一。
 */
let currentUid = "";

export async function openPanel(uid) {
  if (typeof htmlMask === "undefined" || !htmlMask) {
    throw new Error("当前版本不支持 htmlMask，无法打开配置面板");
  }

  // 顺序：回主界面 → 取当前 UID（并备好账号文件）→ 按 ESC 停在派蒙菜单 → 开窗。
  // UID 只在主界面图上稳定可读，所以取号排在按 ESC 之前，不能并进 toPaimonMenu。
  await backToMainUi();
  currentUid = await readCurrentUid();
  if (currentUid) prepareAccount(currentUid);
  // 识别到哪个号就默认选中哪个号，识别不到才退回调用方给的（配置里的 uid）
  activeUid = String(currentUid || uid || "");
  refreshUidOptions();

  await toPaimonMenu();

  const win = htmlMask.show(HTML_PATH, WIN_ID);
  if (!win) throw new Error("遮罩窗口创建失败（WebView2 运行时可能缺失）");

  // 遮罩默认点击穿透，必须关掉才点得动
  htmlMask.setClickThrough(win, false);
  log.info("配置面板已打开，关闭窗口即结束。");
  try {
    while (htmlMask.exists(win)) {
      const raw = await htmlMask.receive(win, 300);
      if (!raw) continue;
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      reply(win, msg);
    }
  } finally {
    htmlMask.closeAll();
  }
  log.info("配置面板已关闭。");
}

/** 退回主界面。失败只提醒不中止——配置跟游戏处在哪个界面无关，为这个不给面板反而更碍事 */
async function backToMainUi() {
  if (typeof genshin !== "undefined" && genshin && genshin.returnMainUi) {
    try {
      log.info("正在返回主界面…");
      await genshin.returnMainUi();
    } catch (e) {
      log.warn(`返回主界面失败（${e && e.message ? e.message : e}），继续`);
    }
  } else {
    log.warn("无 genshin.returnMainUi 接口，跳过返回主界面");
  }
}

/**
 * 按一次 ESC，停在派蒙菜单。
 * 面板要压在派蒙菜单上，别压在战斗、秘境结算、对话这些半截画面上。
 */
async function toPaimonMenu() {
  try {
    keyPress("ESCAPE");
    await sleep(800); // 等菜单展开动画走完再叠遮罩，否则面板会先于菜单出现
  } catch (e) {
    log.warn(`按 ESC 失败（${e && e.message ? e.message : e}），面板开启`);
  }
}

/** 原神 UID 固定 9 位（国服 / 国际服同） */
const UID_RE = /^\d{9}$/;

/**
 * 读当前登录账号的 UID。genshin.uid() 走 OCR，识别失败返回 0。
 *
 * 只认 9 位纯数字：OCR 少认一位就会造出一个不存在的账号文件，这个兜底不能省。
 * 失败重试一次——刚回主界面时 UI 可能还没画完，第一次常读到空。
 * 两次都不成返回空串，调用方沿用配置里的 uid，面板开启。
 */
async function readCurrentUid() {
  if (typeof genshin === "undefined" || !genshin || !genshin.uid) {
    log.warn("无 genshin.uid() 接口，跳过自动识别，面板按配置中的 UID 打开");
    return "";
  }
  for (let i = 0; i < 2; i++) {
    try {
      const v = await genshin.uid();
      const s = String(v === undefined || v === null ? "" : v).trim();
      if (UID_RE.test(s)) {
        log.info(`当前账号 UID：${s}`);
        return s;
      }
      if (i === 0) {
        await sleep(600);
        continue;
      }
      log.warn(`UID 识别失败（读到「${s || "空"}」，非 9 位数字）`);
    } catch (e) {
      if (i === 0) {
        await sleep(600);
        continue;
      }
      log.warn(`读取当前 UID 失败：${e && e.message ? e.message : e}，面板按配置里的 uid 打开`);
    }
  }
  return "";
}

/**
 * 当前账号还没有配置文件，就照「默认模板」新建一份。
 * 已有的一个字不动——面板打开时顺手改配置比"少建一个文件"危险得多。
 */
function prepareAccount(uid) {
  try {
    if (exists(uid)) {
      log.info(`账号 ${uid} 已有配置，沿用`);
      return;
    }
    createAccount(uid, "");
    log.info(`账号 ${uid} 尚无配置，已按默认模板新建 ${CONFIG_DIR}/${uid}.json`);
  } catch (e) {
    log.warn(`账号 ${uid} 的配置准备失败：${e && e.message ? e.message : e}`);
  }
}

/**
 * 把 settings.json 的 UID 下拉重写一遍。
 * 账号有增减时调一次；选项没变时 syncUidOptions 自己不写盘，这里不做判断。
 */
function refreshUidOptions() {
  try {
    if (syncUidOptions(currentUid)) {
      log.info(`settings.json 的 UID 下拉已更新（${listAccounts().length} 个账号，下次读设置时生效）`);
    }
  } catch (e) {
    log.warn(`UID 下拉同步失败：${e && e.message ? e.message : e}`);
  }
}

/**
 * 开发者选项（settings.json 的 checkbox，默认 false）：
 * 开着才允许编辑「默认」模板；关着模板锁定——只读，保存被拦。
 */
function isDev() {
  return typeof settings !== "undefined" && settings && settings.developer === true;
}

function reply(win, msg) {
  const url = String(msg.url || "");
  const data = normalize(msg.data);
  if (url === "/panel/init") log.info("配置面板已连接，正在读取配置…");
  let res;
  try {
    res = route(win, url, data);
  } catch (e) {
    res = { ok: false, msg: String((e && e.message) || e) };
    log.error(`${url} 处理失败：${res.msg}`);
  }
  // 窗口可能在这中间被关掉，回不到包是正常收场，不当错误刷屏
  if (!htmlMask.exists(win)) return;
  try {
    htmlMask.send(win, `${url}:reply`, JSON.stringify(res));
  } catch (e) {
    log.warn(`回包失败（窗口已关闭）：${e && e.message ? e.message : e}`);
  }
}

function route(win, url, data) {
  switch (url) {
    case "/panel/init":
      return initPayload();
    case "/config/load": {
      const uid = String(data.uid || "");
      // 「默认」不是账号：它没有 UID、不参与三层合并，只是一份抄写底稿
      if (uid === TEMPLATE_UID) return { ok: true, cfg: loadTemplate(), dev: isDev() };
      const { cfg } = readForPanel(uid);
      // `played` 来自 .state.json：面板要显示「本轮已打」，只读，面板从不写这个文件
      return { ok: true, cfg, dev: isDev(), played: loadState(uid) };
    }
    case "/config/save": {
      const uid = String(data.uid || "");
      if (uid === TEMPLATE_UID) {
        // 模板锁定：开发者选项关着时不许写，前端只读之外再拦一道（防绕过界面直发消息）
        if (!isDev()) {
          log.warn("默认模板保存被拒：开发者选项未开启");
          return { ok: false, msg: "默认模板已锁定：在脚本设置里开启「开发者选项」后才能编辑" };
        }
        const p = saveTemplate(data.cfg || {});
        log.info(`默认模板已保存：${p}`);
        return { ok: true, msg: "默认模板已保存，之后新建的账号照这份抄", accounts: accountsForPanel() };
      }
      const chk = checkUid(uid);
      if (!chk.ok) return { ok: false, msg: chk.msg };
      for (const w of chk.warns) log.warn(w);
      // 文件不存在就是顺手新建：面板里填完直接存，不必先点「新建账号」
      const fresh = !exists(uid);
      const p = saveConfig(uid, data.cfg || {});
      log.info(`${fresh ? "已新建" : "已保存"}配置：${p}`);
      // 账号集合变了，settings.json 的 UID 下拉跟着重写
      if (fresh) refreshUidOptions();
      return {
        ok: true,
        msg: fresh ? `已新建账号 ${uid}` : `已保存 ${uid}`,
        accounts: accountsForPanel()
      };
    }
    case "/global/save": {
      const p = saveGlobal(data.global || {});
      log.info(`全局配置已保存：${p}`);
      return { ok: true, msg: "全局已保存" };
    }
    case "/global/active": {
      // 点版本行即启用：只落 activeVersion 一个字段，不碰其他数据的编辑状态
      try {
        const v = setActiveVersion(data.activeVersion);
        log.info(`已启用版本 ${v}`);
        return { ok: true };
      } catch (e) {
        return { ok: false, msg: String((e && e.message) || e) };
      }
    }
    case "/ui/theme": {
      // 只落主题一个字段：走 /global/save 会带上整表校验，被别处的半截输入挡住就切不动
      const p = setUiTheme(data.theme);
      log.info(`面板主题已切到 ${data.theme}：${p}`);
      return { ok: true };
    }
    case "/options/save": {
      const p = saveOptions(data.options || {});
      log.info(`数据库已保存：${p}`);
      return { ok: true, msg: "数据库已保存" };
    }
    case "/domains/save": {
      const list = normalizeDomains((data.domains || {}).domains);
      const p = saveDomains({ domains: list });
      log.info(`秘境数据已保存：${p}`);
      return { ok: true, msg: "秘境已保存" };
    }
    case "/config/create": {
      const uid = String(data.uid || "").trim();
      const chk = checkUid(uid);
      if (!chk.ok) return { ok: false, msg: chk.msg };
      for (const w of chk.warns) log.warn(w);
      // 重名不报错，按规划直接打开既有账号；配置由前端接着发的 /config/load 带回
      if (exists(uid)) {
        log.info(`账号 ${uid} 已存在，直接打开`);
        return {
          ok: true,
          uid,
          accounts: accountsForPanel(),
          msg: `账号 ${uid} 已存在，已直接打开`
        };
      }
      const cfg = createAccount(uid, String(data.name || ""));
      log.info(`已新建账号 ${cfg.uid}`);
      refreshUidOptions();
      return { ok: true, uid: cfg.uid, accounts: accountsForPanel(), msg: `已新建账号 ${cfg.uid}` };
    }
    case "/panel/close":
      htmlMask.close(win);
      return { ok: true };
    default:
      return { ok: false, msg: `未知请求：${url}` };
  }
}

/**
 * 面板左栏用的账号表：模板固定排第一，后面才是真账号。
 * 当前登录的号排在最前（紧跟模板）：面板一开就选中它，不用在一堆号里找。
 * tpl:true 是给界面做区分的，后端不认这个字段。
 */
function accountsForPanel() {
  const list = listAccountsWithName();
  if (currentUid) {
    const i = list.findIndex((a) => a.uid === currentUid);
    if (i > 0) list.unshift(list.splice(i, 1)[0]);
  }
  return [{ uid: TEMPLATE_UID, name: "默认", tpl: true }].concat(list);
}

/**
 * 战斗配置候选：`User\AutoFight\` 下的 `.txt` 与 `.json` 文件，**带扩展名原样列出**，
 * 存进配置的也是这个文件名——格式由 `src/tasks.js` 按后缀拆开再喂本体。
 *
 * 必须走 strategyFile，不能用 file.readPathSync("../../AutoFight")：
 * file.* 只认脚本目录内的路径，往上跳会被判「越界访问」并在日志里刷一条 ERR。
 * strategyFile 是给这个目录单独开的通道，路径一律相对 User\AutoFight。
 * 扫不到不算错，界面上手填照样能用。
 */
function listFightStrategies() {
  const out = [];
  if (typeof strategyFile === "undefined" || !strategyFile) {
    log.warn("当前版本没有 strategyFile 接口，战斗配置列表留空（可手填）");
    return out;
  }
  try {
    const arr = Array.from(strategyFile.readPathSync("./"));
    for (const p of arr) {
      // 变量名不叫 file：BGI 全局有个 `file` 对象，遮蔽后同函数里再想用它只会拿到字符串
      const baseName = String(p).replace(/\\/g, "/").split("/").pop();
      if (!/\.(txt|json)$/i.test(baseName)) continue;
      try {
        if (!strategyFile.isFile(p)) continue;
      } catch (e) {
        continue;
      }
      out.push(baseName);
    }
    out.sort();
  } catch (e) {
    log.warn(`扫描战斗配置失败（可手填）：${e && e.message ? e.message : e}`);
  }
  return out;
}

function initPayload() {
  const accounts = accountsForPanel();
  const g = loadGlobal();

  // 版本日期命中就切过去，没命中保持原样——日期是写死的，按它选不会选错；
  // 没填日期的版本不参与，绝不能因为「没填」被切走。
  const auto = resolveVersion(g);
  let switched = "";
  if (auto && auto !== g.activeVersion) {
    try {
      const before = g.activeVersion;
      // 只落 activeVersion：走 saveGlobal 会带上整表校验，被别处的半截输入挡住就切不过去了
      setActiveVersion(auto);
      g.activeVersion = auto;
      switched = auto;
      log.info(`今天落在版本 ${auto} 的日期里${before ? `，已自 ${before} 切换` : ""}`);
    } catch (e) {
      log.warn(`按日期切换版本失败：${e && e.message ? e.message : e}`);
    }
  }

  return {
    ok: true,
    uid: activeUid,
    accounts,
    global: g,
    options: loadOptions(),
    domains: loadDomains(),
    fightStrategies: listFightStrategies(),
    todayInfo: dayInfo(),
    autoVersion: switched
  };
}

/**
 * 数据库只有一个文件：assets/options.json。
 * 里面装两份下拉清单 + 秘境全量数据（domains）。
 * 「domains」存的是对象数组（id/type/name/country/rewards）；给面板下拉候选用的是它的名字投影，
 * 读的时候分开给，写的时候各自保留对方的键，互不覆盖。
 */
const OPTIONS_FILE = "assets/options.json";

/** 由「数据库」页直接维护的两个字符串清单 */
const OPTION_KEYS = ["leylineTypes", "leylineCountries"];

function readOptionsRaw() {
  let raw = null;
  try {
    raw = JSON.parse(file.readTextSync(OPTIONS_FILE));
  } catch (e) {
    if (fileExists(OPTIONS_FILE)) log.warn("assets/options.json 解析失败，候选清单按空处理");
  }
  return raw && typeof raw === "object" ? raw : {};
}

function writeOptionsRaw(obj) {
  file.writeTextSync(OPTIONS_FILE, JSON.stringify(obj, null, 2) + "\n", false);
}

function strList(v) {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter((x) => x !== "") : [];
}

/** 开放组的三个键：既是「第几份材料」，也是全开时选第几项（BGI 的 SundaySelectedValue） */
const GROUP_KEYS = ["1", "2", "3"];

/**
 * 秘境条目规范化：id 保留 null（新加的行没有 id），空名的行丢掉。
 * groups 只有材料本才有——键是组号 1/2/3，值是材料名；圣遗物天天开，写了也丢掉。
 */
function normalizeDomains(v) {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .map((d) => {
      const out = {
        id: d && d.id !== undefined && d.id !== null && d.id !== "" ? Number(d.id) : null,
        type: String((d && d.type) || "").trim(),
        name: String((d && d.name) || "").trim(),
        country: String((d && d.country) || "").trim(),
        rewards: Array.isArray(d && d.rewards) ? d.rewards.map(String) : []
      };
      const g = d && d.groups;
      if (g && typeof g === "object" && !Array.isArray(g)) {
        const pick = {};
        for (const k of GROUP_KEYS) {
          const s = String(g[k] === undefined || g[k] === null ? "" : g[k]).trim();
          if (s) pick[k] = s;
        }
        if (Object.keys(pick).length) out.groups = pick;
      }
      return out;
    })
    .filter((d) => d.name !== "");
}

/** 候选清单：只有两个字符串清单，秘境全量由 loadDomains 单独给 */
function loadOptions() {
  const raw = readOptionsRaw();
  const out = {};
  for (const k of OPTION_KEYS) out[k] = strList(raw[k]);
  return out;
}

/** 存清单；domains 归 saveDomains 管，这里原样留着不被冲掉 */
function saveOptions(opts) {
  const raw = readOptionsRaw();
  for (const k of OPTION_KEYS) raw[k] = strList(opts[k]);
  writeOptionsRaw(raw);
  return OPTIONS_FILE;
}

/** 秘境全量数据：同一份 options.json 里的 domains 数组 */
function loadDomains() {
  const raw = readOptionsRaw();
  return { domains: normalizeDomains(raw.domains) };
}

/** 秘境落盘：只换 domains，两份清单原样留着 */
function saveDomains(payload) {
  const raw = readOptionsRaw();
  raw.domains = normalizeDomains(payload && payload.domains);
  delete raw.domainsMeta;  // 来源档案已无读方，残留键顺手清掉
  writeOptionsRaw(raw);
  return OPTIONS_FILE;
}

function normalize(d) {
  if (d === null || d === undefined) return {};
  if (typeof d === "string") {
    try {
      return JSON.parse(d);
    } catch (e) {
      return {};
    }
  }
  return d;
}
