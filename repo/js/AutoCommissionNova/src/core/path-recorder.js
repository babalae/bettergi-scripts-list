/** 无地图路径录制器。 */
import { isCancellationError } from "../utils/error-utils.js";

// Vue 单文件产物由 BetterGI 直接通过 file:// 加载。
const HTML_PATH = "web/path-recorder/index.html";
const WINDOW_TAG = "path-recorder";
const SETTINGS_PATH = "Data/path-recorder-settings.json";
const PATHING_BGI_VERSION = "0.52.0";
const DEFAULT_SETTINGS = {
    addKey: "NumPad2",
    finishKey: "NumPad1",
    toggleKey: "Oem3",
    authors: [],
    mapMatchMethod: "TemplateMatch",
    combatScripts: [],
};
const ALT_KEYS = new Set(["Menu", "LMenu", "RMenu"]);
const RESERVED_KEYS = new Set(ALT_KEYS);
const MAP_MATCH_METHODS = new Set(["TemplateMatch", "SIFT"]);
const POINT_TYPES = new Set(["teleport", "path", "target", "orientation"]);
const MOVE_MODES = new Set(["walk", "dash", "run", "fly", "swim", "climb", "jump"]);
const ACTIONS = new Set([
    "", "fight", "combat_script", "nahida_collect", "stop_flying", "up_down_grab_leaf",
    "mining", "linnea_mining", "fishing", "pick_up_collect", "pick_around", "use_gadget",
    "hydro_collect", "electro_collect", "anemo_collect", "pyro_collect", "force_tp", "log_output",
    "exit_and_relogin", "wonderland_cycle", "set_time",
]);
const COMMON_VIRTUAL_KEYS = [
    "W", "A", "S", "D", "E", "Q", "R", "F", "X", "SPACE", "ESCAPE", "RETURN", "TAB",
    "SHIFT", "CONTROL", "MENU", "LEFT", "UP", "RIGHT", "DOWN", "LBUTTON", "RBUTTON", "MBUTTON",
    "NUMPAD0", "NUMPAD1", "NUMPAD2", "NUMPAD3", "NUMPAD4", "NUMPAD5", "NUMPAD6", "NUMPAD7", "NUMPAD8", "NUMPAD9",
];
const COMBAT_METHODS = [
    { code: "skill", aliases: ["e"], template: "skill()", hint: "元素战技，可填 hold、wait、fast", params: ["hold", "wait", "fast"] },
    { code: "burst", aliases: ["q"], template: "burst", hint: "元素爆发" },
    { code: "attack", aliases: ["普攻", "普通攻击"], template: "attack", hint: "普通攻击，可用 attack(秒数) 指定持续时间" },
    { code: "charge", aliases: ["重击"], template: "charge", hint: "重击，可用 charge(秒数) 指定持续时间" },
    { code: "wait", aliases: ["after", "等待"], template: "wait()", hint: "等待秒数" },
    { code: "ready", aliases: ["完成"], template: "ready", hint: "等待当前角色就绪" },
    { code: "check", aliases: ["检测"], template: "check", hint: "执行检测" },
    { code: "walk", aliases: ["行走"], template: "walk(, )", hint: "方向和行走秒数", params: ["w", "a", "s", "d"] },
    { code: "w", aliases: [], template: "w()", hint: "向前移动秒数" },
    { code: "a", aliases: [], template: "a()", hint: "向左移动秒数" },
    { code: "s", aliases: [], template: "s()", hint: "向后移动秒数" },
    { code: "d", aliases: [], template: "d()", hint: "向右移动秒数" },
    { code: "dash", aliases: ["冲刺"], template: "dash", hint: "冲刺，可用 dash(秒数) 指定持续时间" },
    { code: "jump", aliases: ["j", "跳跃"], template: "jump", hint: "跳跃" },
    { code: "mousedown", aliases: [], template: "mousedown", hint: "按下左键，可用 mousedown(right) 等指定按键", params: ["left", "right", "middle"] },
    { code: "mouseup", aliases: [], template: "mouseup", hint: "松开左键，可用 mouseup(right) 等指定按键", params: ["left", "right", "middle"] },
    { code: "click", aliases: [], template: "click", hint: "点击左键，可用 click(right) 等指定按键", params: ["left", "right", "middle"] },
    { code: "moveby", aliases: [], template: "moveby(, )", hint: "鼠标相对移动 x, y" },
    { code: "keydown", aliases: [], template: "keydown()", hint: "按下按键", params: COMMON_VIRTUAL_KEYS },
    { code: "keyup", aliases: [], template: "keyup()", hint: "松开按键", params: COMMON_VIRTUAL_KEYS },
    { code: "keypress", aliases: [], template: "keypress()", hint: "按下并松开按键", params: COMMON_VIRTUAL_KEYS },
    { code: "scroll", aliases: ["verticalscroll"], template: "scroll()", hint: "垂直滚轮整数格数" },
    { code: "round", aliases: [], template: "round()", hint: "回合，例如 1、1,3-5" },
];
const COMBAT_METHOD_BY_NAME = new Map();
for (const method of COMBAT_METHODS) {
    COMBAT_METHOD_BY_NAME.set(method.code, method);
    for (const alias of method.aliases) COMBAT_METHOD_BY_NAME.set(alias, method);
}

function respond(windowId, requestId, data) {
    const payload = JSON.stringify(data);
    if (typeof htmlMask.respond === "function") htmlMask.respond(windowId, requestId, payload);
    else if (typeof htmlMask.Respond === "function") htmlMask.Respond(windowId, requestId, payload);
    else htmlMask.send(windowId, "/response", JSON.stringify({ requestId, data }));
}

function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function keySettings(value) {
    const addKey = String(value?.addKey || "").trim();
    const finishKey = String(value?.finishKey || "").trim();
    const toggleKey = String(value?.toggleKey || DEFAULT_SETTINGS.toggleKey).trim();
    if (!addKey || !finishKey || !toggleKey) throw new Error("快捷键不能为空");
    if (new Set([addKey, finishKey, toggleKey]).size !== 3) throw new Error("添加当前点位、结束录制和界面切换快捷键不能重复");
    if ([addKey, finishKey, toggleKey].some(key => RESERVED_KEYS.has(key))) throw new Error("Alt 键用于临时快捷编辑，不能设为录制器快捷键");
    return { addKey, finishKey, toggleKey };
}

function normalizePunctuation(value) {
    return String(value || "")
        .replace(/（/g, "(")
        .replace(/）/g, ")")
        .replace(/，/g, ",")
        .replace(/；/g, ";")
        .replace(/｜/g, "|");
}

function splitTopLevel(value, separators) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (char === "(") depth++;
        else if (char === ")") {
            depth--;
            if (depth < 0) throw new Error("右括号没有对应的左括号");
        } else if (depth === 0 && separators.has(char)) {
            parts.push(value.slice(start, index));
            start = index + 1;
        }
    }
    if (depth !== 0) throw new Error("括号不完整");
    parts.push(value.slice(start));
    return parts;
}

function finiteNumber(value, label, allowZero = true) {
    const number = Number(value);
    if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
        throw new Error(label + (allowZero ? "必须是非负数字" : "必须是正数"));
    }
    return number;
}

function isVirtualKey(value) {
    const key = String(value || "").trim().toUpperCase().replace(/^VK_/, "");
    if (/^[A-Z0-9]$/.test(key) || /^F(?:[1-9]|1\d|2[0-4])$/.test(key) || /^NUMPAD[0-9]$/.test(key)) return true;
    const names = new Set([
        "LBUTTON", "RBUTTON", "MBUTTON", "XBUTTON1", "XBUTTON2", "BACK", "TAB", "CLEAR", "RETURN",
        "SHIFT", "CONTROL", "MENU", "PAUSE", "CAPITAL", "ESCAPE", "SPACE", "PRIOR", "NEXT", "END", "HOME",
        "LEFT", "UP", "RIGHT", "DOWN", "SELECT", "PRINT", "EXECUTE", "SNAPSHOT", "INSERT", "DELETE", "HELP",
        "LWIN", "RWIN", "APPS", "SLEEP", "MULTIPLY", "ADD", "SEPARATOR", "SUBTRACT", "DECIMAL", "DIVIDE",
        "NUMLOCK", "SCROLL", "LSHIFT", "RSHIFT", "LCONTROL", "RCONTROL", "LMENU", "RMENU",
        "BROWSER_BACK", "BROWSER_FORWARD", "BROWSER_REFRESH", "BROWSER_STOP", "BROWSER_SEARCH", "BROWSER_FAVORITES", "BROWSER_HOME",
        "VOLUME_MUTE", "VOLUME_DOWN", "VOLUME_UP", "MEDIA_NEXT_TRACK", "MEDIA_PREV_TRACK", "MEDIA_STOP", "MEDIA_PLAY_PAUSE",
        "LAUNCH_MAIL", "LAUNCH_MEDIA_SELECT", "LAUNCH_APP1", "LAUNCH_APP2", "PROCESSKEY", "PACKET", "ATTN", "CRSEL",
        "EXSEL", "EREOF", "PLAY", "ZOOM", "NONAME", "PA1", "OEM_CLEAR",
    ]);
    return names.has(key) || /^OEM_(?:[1-8]|102|PLUS|COMMA|MINUS|PERIOD)$/.test(key);
}

function validateMethodArgs(method, args, emptyParentheses) {
    const code = method.code;
    const count = args.length;
    const requireCount = expected => {
        if (count !== expected) throw new Error(`${code} 需要 ${expected} 个参数`);
    };
    if (code === "skill") {
        const allowed = new Set(["hold", "wait", "fast"]);
        if (args.some(arg => !allowed.has(arg)) || new Set(args).size !== args.length) throw new Error("skill 参数只能使用 hold、wait、fast，且不能重复");
    } else if (["burst", "ready", "check", "jump"].includes(code)) {
        requireCount(0);
    } else if (["attack", "charge", "dash"].includes(code)) {
        if (emptyParentheses) throw new Error(`${code} 不允许空括号，请删除括号或填写持续时间`);
        if (count > 1) throw new Error(`${code} 最多只能填写一个持续时间`);
        if (count) finiteNumber(args[0], `${code} 持续时间`);
    } else if (code === "wait") {
        requireCount(1);
        finiteNumber(args[0], "wait 时间");
    } else if (code === "walk") {
        requireCount(2);
        if (!["w", "a", "s", "d"].includes(args[0].toLowerCase())) throw new Error("walk 方向只能是 w、a、s、d");
        finiteNumber(args[1], "walk 时间", false);
    } else if (["w", "a", "s", "d"].includes(code)) {
        requireCount(1);
        finiteNumber(args[0], `${code} 移动时间`, false);
    } else if (["mousedown", "mouseup", "click"].includes(code)) {
        if (emptyParentheses) throw new Error(`${code} 不允许空括号，请删除括号或填写鼠标按键`);
        if (count > 1 || (count && !["left", "right", "middle"].includes(args[0].toLowerCase()))) {
            throw new Error(`${code} 只能使用 left、right、middle`);
        }
    } else if (code === "moveby") {
        requireCount(2);
        if (args.some(arg => !/^-?\d+$/.test(arg))) throw new Error("moveby 的 x、y 必须是整数");
    } else if (["keydown", "keyup", "keypress"].includes(code)) {
        requireCount(1);
        if (!isVirtualKey(args[0])) throw new Error(`${code} 的按键不是有效 VirtualKey：${args[0]}`);
    } else if (code === "scroll") {
        requireCount(1);
        if (!/^-?\d+$/.test(args[0])) throw new Error("scroll 滚动格数必须是整数");
    } else if (code === "round") {
        if (!count) throw new Error("round 必须填写回合");
        for (const arg of args) {
            const match = /^(\d+)(?:-(\d+))?$/.exec(arg);
            if (!match || Number(match[1]) <= 0 || (match[2] && Number(match[2]) < Number(match[1]))) {
                throw new Error("round 必须使用正整数或递增范围，例如 1,3-5");
            }
        }
    }
}

function validateCombatScript(value, label = "简易策略") {
    const script = normalizePunctuation(value).trim();
    if (!script) throw new Error(label + "不能为空");
    const lines = script.split(/\r?\n/);
    let commandCount = 0;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("//") || line.startsWith("#")) continue;
        for (const rawPart of splitTopLevel(line, new Set([";"]))) {
            let part = rawPart.trim();
            if (!part) continue;
            const separator = part.search(/\s/);
            if (separator > 0) {
                const first = part.slice(0, separator);
                const rest = part.slice(separator).trim();
                const restMethod = /^([^\s(]+)/.exec(rest)?.[1];
                if (!COMBAT_METHOD_BY_NAME.has(first) && COMBAT_METHOD_BY_NAME.has(restMethod)) part = rest;
            }
            for (const rawCommand of splitTopLevel(part, new Set([",", "|"]))) {
                const command = rawCommand.trim();
                if (!command) continue;
                const match = /^([^\s()]+)(?:\((.*)\))?$/.exec(command);
                if (!match) throw new Error(`${label}中的指令格式错误：${command}`);
                const method = COMBAT_METHOD_BY_NAME.get(match[1]);
                if (!method) throw new Error(`${label}中存在未知指令：${match[1]}`);
                const args = match[2] === undefined || match[2].trim() === ""
                    ? []
                    : match[2].split(",").map(arg => arg.trim());
                try {
                    validateMethodArgs(method, args, match[2] !== undefined && match[2].trim() === "");
                } catch (error) {
                    throw new Error(`${label}中的 ${command}：${error.message}`);
                }
                commandCount++;
            }
        }
    }
    if (!commandCount) throw new Error(label + "没有可执行指令");
    return script;
}

function normalizeSettings(value, strict) {
    const defaults = cloneDefaultSettings();
    const warnings = [];
    let keys;
    try {
        keys = keySettings(value);
    } catch (error) {
        if (strict) throw error;
        keys = keySettings(defaults);
        warnings.push("快捷键配置损坏，已恢复默认值");
    }

    let mapMatchMethod = String(value?.mapMatchMethod || defaults.mapMatchMethod);
    if (!MAP_MATCH_METHODS.has(mapMatchMethod)) {
        if (strict) throw new Error("地图匹配模式只能是 TemplateMatch 或 SIFT");
        mapMatchMethod = defaults.mapMatchMethod;
        warnings.push("地图匹配模式损坏，已恢复 TemplateMatch");
    }

    const authors = [];
    const authorKeys = new Set();
    for (const raw of Array.isArray(value?.authors) ? value.authors : []) {
        const name = String(raw?.name || "").trim();
        const links = String(raw?.links || "").trim();
        if (!name && !links && !raw?.def) continue;
        if (!name) {
            if (strict) throw new Error("预设作者姓名不能为空");
            warnings.push("已忽略姓名为空的作者预设");
            continue;
        }
        const key = name + "\n" + links;
        if (authorKeys.has(key)) {
            if (strict) throw new Error("预设作者不能重复：" + name);
            warnings.push("已忽略重复作者：" + name);
            continue;
        }
        authorKeys.add(key);
        authors.push({ name, links, def: raw?.def === true });
    }

    const combatScripts = [];
    const scriptNames = new Set();
    let defaultScripts = 0;
    for (const raw of Array.isArray(value?.combatScripts) ? value.combatScripts : []) {
        const name = String(raw?.name || "").trim();
        const scriptValue = String(raw?.value || "").trim();
        if (!name && !scriptValue && !raw?.def) continue;
        try {
            if (!name) throw new Error("策略名称不能为空");
            if (scriptNames.has(name)) throw new Error("策略名称不能重复：" + name);
            const normalizedValue = validateCombatScript(scriptValue, `策略“${name}”`);
            if (raw?.def === true) defaultScripts++;
            if (defaultScripts > 1) throw new Error("只能设置一个默认简易策略");
            scriptNames.add(name);
            combatScripts.push({ name, value: normalizedValue, def: raw?.def === true });
        } catch (error) {
            if (strict) throw error;
            warnings.push("已忽略无效策略：" + (name || "未命名"));
        }
    }

    return {
        settings: { ...keys, authors, mapMatchMethod, combatScripts },
        warnings,
    };
}

function loadSettings() {
    if (!file.isFile(SETTINGS_PATH)) return { settings: cloneDefaultSettings(), warning: "" };
    try {
        const normalized = normalizeSettings(JSON.parse(file.readTextSync(SETTINGS_PATH)), false);
        return { settings: normalized.settings, warning: normalized.warnings.join("；") };
    } catch (error) {
        return { settings: cloneDefaultSettings(), warning: "录制器配置损坏，已恢复默认值" };
    }
}

function saveSettings(settings) {
    const value = normalizeSettings(settings, true).settings;
    const content = JSON.stringify(value, null, 4) + "\r\n";
    if (!file.writeTextSync(SETTINGS_PATH, content, false)) throw new Error("录制器配置保存失败");
    return value;
}

function normalizeRouteMeta(value, fallbackSettings) {
    const authors = [];
    const seen = new Set();
    for (const raw of Array.isArray(value?.authors) ? value.authors : []) {
        const name = String(raw?.name || "").trim();
        const links = String(raw?.links || "").trim();
        if (!name) throw new Error("当前路线作者姓名不能为空");
        const key = name + "\n" + links;
        if (seen.has(key)) continue;
        seen.add(key);
        authors.push({ name, links });
    }
    const mapMatchMethod = String(value?.mapMatchMethod || fallbackSettings.mapMatchMethod);
    if (!MAP_MATCH_METHODS.has(mapMatchMethod)) throw new Error("当前路线地图匹配模式无效");
    return { authors, mapMatchMethod };
}

function fileNameOf(path) {
    return String(path || "").replace(/\\/g, "/").split("/").pop();
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function timestamp() {
    const date = new Date();
    const pad = value => String(value).padStart(2, "0");
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + "_" +
        pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
}

function listedFileNames(directory) {
    if (!file.isFolder(directory)) return [];
    return Array.from(file.readPathSync(directory) || []).filter(entry => file.isFile(entry)).map(fileNameOf);
}

function nextCommissionFile(directory, commissionName) {
    const pattern = new RegExp("^" + escapeRegExp(commissionName) + "-(\\d+)\\.json$", "i");
    const indexes = listedFileNames(directory).map(name => pattern.exec(name)).filter(Boolean).map(match => Number(match[1]));
    return commissionName + "-" + (indexes.length ? Math.max(...indexes) + 1 : 1) + ".json";
}

function safeFileName(value) {
    const name = String(value || "").trim();
    if (!name || name === "." || name === ".." || /[\\/:*?"<>|]/.test(name)) throw new Error("文件名包含非法字符或为空");
    if (!name.toLowerCase().endsWith(".json")) throw new Error("文件名必须以 .json 结尾");
    return name;
}

function roundCoordinate(value) {
    return Math.round(value * 10000) / 10000;
}

function normalizePoints(points, sourceOffset = 0) {
    if (!Array.isArray(points) || points.length === 0) throw new Error("至少需要一个有效路径点");
    return points.map((point, index) => {
        const prefix = "点位 #" + (sourceOffset + index + 1) + "：";
        const rawX = point?.x;
        const rawY = point?.y;
        const x = rawX === null || rawX === undefined || rawX === "" ? NaN : Number(rawX);
        const y = rawY === null || rawY === undefined || rawY === "" ? NaN : Number(rawY);
        const type = String(point?.type || "");
        const moveMode = String(point?.move_mode || "");
        const action = String(point?.action || "");
        let actionParams = String(point?.action_params || "");
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(prefix + "坐标必须是有限数字");
        if (!POINT_TYPES.has(type)) throw new Error(prefix + "点位类型无效");
        if (!MOVE_MODES.has(moveMode)) throw new Error(prefix + "移动方式无效");
        if (!ACTIONS.has(action)) throw new Error(prefix + "动作无效");
        if ((action === "combat_script" || action === "log_output") && !actionParams.trim()) throw new Error(prefix + "当前动作必须填写动作参数");
        if (action === "combat_script") actionParams = validateCombatScript(actionParams, prefix + "简易策略");
        if (action === "stop_flying" && actionParams.trim() && (!/^\d+$/.test(actionParams.trim()) || Number(actionParams) < 0)) {
            throw new Error(prefix + "下落攻击等待时间必须是非负整数毫秒数");
        }
        if (action === "up_down_grab_leaf" && actionParams.trim() && !["up", "down"].includes(actionParams.trim().toLowerCase())) {
            throw new Error(prefix + "四叶印方向只能是 up 或 down");
        }
        if (action === "mining" && actionParams.trim() && actionParams.trim().toLowerCase() !== "disablepickuparound") {
            throw new Error(prefix + "挖矿参数只能是 disablePickupAround 或留空");
        }
        if (action === "pick_around" && actionParams.trim() && (!/^\d+$/.test(actionParams.trim()) || Number(actionParams) <= 0)) {
            throw new Error(prefix + "附近拾取轮数必须是正整数");
        }
        if (action === "use_gadget" && actionParams.trim() && actionParams.trim().toLowerCase() !== "not_wait" && (!Number.isFinite(Number(actionParams)) || Number(actionParams) < 0)) {
            throw new Error(prefix + "使用小道具参数必须是非负等待秒数、not_wait 或留空");
        }
        if (action === "set_time" && !/^(?:[01]?\d|2[0-3]):[0-5]?\d$/.test(actionParams.trim())) throw new Error(prefix + "设置时间必须使用 H:M、H:MM、HH:M 或 HH:MM 格式");
        if (action === "linnea_mining" && actionParams.trim()) {
            const values = actionParams.split(",").map(value => value.trim());
            const matches = values.map(value => /^(?:(mines|rounds)=)?(\d+)$/i.exec(value));
            const named = matches.map(match => match?.[1]?.toLowerCase()).filter(Boolean);
            if (values.length > 2 || matches.some(match => !match || Number(match[2]) <= 0 || Number(match[2]) > 999) || new Set(named).size !== named.length) {
                throw new Error(prefix + "莉奈娅挖矿参数应为 1 至 999 的射箭次数和可选寻矿次数，例如 1 或 1,5");
            }
        }
        return Object.assign({}, point, {
            id: index + 1,
            x: roundCoordinate(x),
            y: roundCoordinate(y),
            type,
            move_mode: moveMode,
            action,
            action_params: actionParams,
        });
    });
}

// 生成可执行路径文件，并在编辑模式下保留原文件的扩展元数据。
function buildPathingFile(name, points, meta, sourceOffset = 0, original = null) {
    const originalInfo = original?.info && typeof original.info === "object" ? original.info : null;
    const hasOriginalName = originalInfo && Object.prototype.hasOwnProperty.call(originalInfo, "name");
    const originalMapMatchMethod = typeof originalInfo?.map_match_method === "string"
        ? originalInfo.map_match_method
        : "";
    return Object.assign({}, original || {}, {
        info: Object.assign({}, originalInfo || {}, {
            name: hasOriginalName ? originalInfo.name : name.replace(/\.json$/i, ""),
            type: "collect",
            authors: meta.authors,
            version: "1.0",
            description: "",
            map_name: "Teyvat",
            bgi_version: PATHING_BGI_VERSION,
            map_match_method: originalMapMatchMethod.trim() ? originalMapMatchMethod : meta.mapMatchMethod,
        }),
        positions: normalizePoints(points, sourceOffset),
    });
}

// 按 BetterGI 地图编辑器规则递归排序全部字段后序列化路径数据。
function stringifyPathingFile(value, space = 0) {
    // 全局字段集合与本体 replacer 行为一致，并保留所有数组元素的原始顺序。
    const allKeys = new Set();
    JSON.stringify(value, (key, item) => (allKeys.add(key), item));
    return JSON.stringify(value, Array.from(allKeys).sort(), space);
}

/**
 * @param {{targetDir?: string, commissionName?: string}} options
 * @returns {Promise<{status: string, path?: string, fileName?: string}>}
 */
export async function openPathRecorder(options = {}) {
    if (typeof htmlMask === "undefined") throw new Error("当前环境不支持 htmlMask，无法打开路径录制器");
    if (htmlMask.exists(WINDOW_TAG)) throw new Error("路径录制器已经打开");
    const targetDir = String(options.targetDir || "pathing").replace(/\\/g, "/").replace(/\/+$/, "");
    const commissionName = String(options.commissionName || "").trim();
    const existingPath = String(options.existingPath || "").replace(/\\/g, "/").trim();
    const loadedSettings = loadSettings();
    // 编辑模式下缓存原始文件，以初始化点位并在保存时保留未知字段。
    let existingData = null;
    if (existingPath) {
        if (!file.isFile(existingPath)) throw new Error("路径文件不存在：" + existingPath);
        try { existingData = JSON.parse(file.readTextSync(existingPath)); } catch (error) { throw new Error("路径文件 JSON 解析失败：" + error.message); }
        if (!existingData || typeof existingData !== "object" || Array.isArray(existingData) || !Array.isArray(existingData.positions)) throw new Error("路径文件格式无效：" + existingPath);
    }
    const session = {
        phase: existingData ? "stopped" : "idle",
        settings: loadedSettings.settings,
        points: existingData ? existingData.positions.map((point, index) => Object.assign({}, point, { id: index + 1, x: point.x, y: point.y, type: point.type || (index ? "path" : "teleport"), move_mode: point.move_mode || "walk", action: point.action || "", action_params: point.action_params || "" })) : [],
        sampling: false,
        binding: false,
        interactionLock: false,
        sideMode: false,
        altHeld: false,
        displayMode: "normal",
        running: false,
        savedPath: existingPath,
        result: { status: "cancelled" },
    };
    let suggestedFileName = existingPath ? existingPath.split("/").pop() : commissionName
        ? nextCommissionFile(targetDir, commissionName)
        : "未命名路线-" + timestamp() + ".json";
    const windowId = htmlMask.show(HTML_PATH, WINDOW_TAG);
    htmlMask.setClickThrough(windowId, false);
    const hook = new KeyMouseHook();
    const pressedKeys = new Set();
    const heldAltKeys = new Set();

    function applyDisplayMode() {
        const nextMode = session.running
            ? "compact"
            : session.sideMode
                ? (session.altHeld || session.binding || session.interactionLock ? "compact-edit" : "compact")
                : "normal";
        if (session.displayMode === nextMode) return;
        session.displayMode = nextMode;
        htmlMask.setClickThrough(windowId, nextMode === "compact");
        htmlMask.send(windowId, "/displayMode", JSON.stringify({ mode: nextMode }));
    }

    function defaultRouteAuthors() {
        return session.settings.authors.filter(author => author.def).map(author => ({ name: author.name, links: author.links }));
    }

    function viewState(extra = {}) {
        return Object.assign({
            phase: session.phase,
            settings: session.settings,
            points: session.points,
            sampling: session.sampling,
            running: session.running,
            displayMode: session.displayMode,
            suggestedFileName,
        }, extra);
    }

    function pushState(extra = {}) {
        if (htmlMask.exists(windowId)) htmlMask.send(windowId, "/state", JSON.stringify(viewState(extra)));
    }

    function currentPosition() {
        const position = genshin.getPositionFromMap("Teyvat");
        const x = Number(position?.X ?? position?.x);
        const y = Number(position?.Y ?? position?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("未识别到有效坐标");
        return { x: roundCoordinate(x), y: roundCoordinate(y) };
    }

    async function samplePoint() {
        if (session.sampling || session.running) return;
        session.sampling = true;
        pushState({ message: "正在识别当前位置..." });
        try {
            const position = currentPosition();
            session.points.push({
                id: session.points.length + 1,
                x: position.x,
                y: position.y,
                type: session.points.length === 0 ? "teleport" : "path",
                move_mode: "walk",
                action: "",
                action_params: "",
            });
            pushState({ message: "已录制点位 #" + session.points.length });
        } catch (error) {
            pushState({ error: error.message || String(error) });
        } finally {
            session.sampling = false;
            pushState();
        }
    }

    // 开始快捷键采点模式，仅切换状态并保留当前已有点位。
    function startRecording() {
        if (session.running || session.phase === "recording") return;
        session.savedPath = "";
        session.result = { status: "cancelled" };
        session.phase = "recording";
        pushState({ message: "录制已开始，可通过快捷键或按钮添加点位" });
    }

    // 结束快捷键采点模式并允许检查和保存当前路线。
    function finishRecording() {
        if (session.phase !== "recording" || session.running) return;
        session.phase = "stopped";
        pushState({ message: "录制已结束，请检查点位后保存" });
    }

    // 由同一快捷键在开始和结束录制之间切换。
    function toggleRecording() {
        if (session.phase === "recording") finishRecording();
        else startRecording();
    }

    function launchRun(output) {
        session.running = true;
        session.sideMode = true;
        session.altHeld = false;
        session.interactionLock = false;
        heldAltKeys.clear();
        applyDisplayMode();
        pushState({ message: "路线执行中，已锁定侧边穿透模式" });
        (async () => {
            try {
                await sleep(120);
                await pathingScript.run(stringifyPathingFile(output));
                if (htmlMask.exists(windowId)) pushState({ message: "路线执行已结束，请查看 BetterGI 日志" });
            } catch (error) {
                if (!isCancellationError(error) && htmlMask.exists(windowId)) pushState({ error: "路线执行结束：" + (error.message || String(error)) });
            } finally {
                session.running = false;
                session.sideMode = true;
                session.altHeld = false;
                session.interactionLock = false;
                if (htmlMask.exists(windowId)) {
                    applyDisplayMode();
                    pushState();
                }
            }
        })();
    }

    hook.onKeyDown(function (keyCode) {
        if (!htmlMask.exists(windowId) || session.running) return;
        if (session.binding) {
            if (pressedKeys.has(keyCode)) return;
            pressedKeys.add(keyCode);
            htmlMask.send(windowId, "/bindingKey", JSON.stringify({ keyCode }));
            return;
        }
        if (session.interactionLock) return;
        if (ALT_KEYS.has(keyCode)) {
            heldAltKeys.add(keyCode);
            if (session.sideMode && !session.altHeld) {
                session.altHeld = true;
                applyDisplayMode();
            }
            return;
        }
        if (pressedKeys.has(keyCode)) return;
        pressedKeys.add(keyCode);
        if (keyCode === session.settings.toggleKey) {
            session.sideMode = !session.sideMode;
            heldAltKeys.clear();
            session.altHeld = false;
            session.interactionLock = false;
            applyDisplayMode();
        } else if (session.phase === "recording" && keyCode === session.settings.addKey) {
            samplePoint();
        } else if (keyCode === session.settings.finishKey) {
            toggleRecording();
        }
    });
    hook.onKeyUp(function (keyCode) {
        pressedKeys.delete(keyCode);
        if (session.running || !ALT_KEYS.has(keyCode)) return;
        heldAltKeys.delete(keyCode);
        if (session.altHeld && heldAltKeys.size === 0) {
            session.altHeld = false;
            applyDisplayMode();
        }
    });

    const cancelToken = dispatcher.getLinkedCancellationToken();
    try {
        while (htmlMask.exists(windowId) && !cancelToken.isCancellationRequested) {
            let raw;
            try {
                raw = await htmlMask.receive(windowId, 500);
            } catch (error) {
                if (isCancellationError(error)) break;
                continue;
            }
            if (!raw) continue;
            let message;
            try { message = JSON.parse(raw); } catch (error) { continue; }
            let closeAfterResponse = false;
            try {
                if (message.url === "/init") {
                    respond(windowId, message.requestId, viewState({
                        warning: loadedSettings.warning,
                        targetDir,
                        commissionMode: Boolean(commissionName),
                        routeAuthors: existingData?.info?.authors || defaultRouteAuthors(),
                        routeMapMatchMethod: typeof existingData?.info?.map_match_method === "string" && existingData.info.map_match_method.trim()
                            ? existingData.info.map_match_method
                            : session.settings.mapMatchMethod,
                        combatSyntax: COMBAT_METHODS,
                    }));
                } else if (message.url === "/settings") {
                    if (session.running) throw new Error("路线执行过程中不能修改设置");
                    session.settings = saveSettings(message.data);
                    respond(windowId, message.requestId, { status: "ok", settings: session.settings });
                } else if (message.url === "/binding") {
                    if (session.running) throw new Error("路线执行过程中不能修改快捷键");
                    session.binding = message.data?.active === true;
                    applyDisplayMode();
                    respond(windowId, message.requestId, { status: "ok" });
                } else if (message.url === "/interactionLock") {
                    if (session.running) throw new Error("路线执行过程中不能切换交互状态");
                    session.interactionLock = message.data?.active === true;
                    applyDisplayMode();
                    respond(windowId, message.requestId, { status: "ok" });
                } else if (message.url === "/start") {
                    if (session.running) throw new Error("路线正在执行");
                    if (session.phase === "recording") throw new Error("已经在录制中");
                    startRecording();
                    respond(windowId, message.requestId, viewState());
                } else if (message.url === "/sample") {
                    if (session.running) throw new Error("路线执行过程中不能添加点位");
                    respond(windowId, message.requestId, { status: "ok" });
                    samplePoint();
                } else if (message.url === "/resample") {
                    if (session.running) throw new Error("路线执行过程中不能重新录制坐标");
                    const index = Number(message.data?.index);
                    if (!Number.isInteger(index) || index < 0 || index >= session.points.length) throw new Error("点位序号无效");
                    const position = currentPosition();
                    session.points[index].x = position.x;
                    session.points[index].y = position.y;
                    respond(windowId, message.requestId, { status: "ok", points: session.points });
                } else if (message.url === "/finish") {
                    finishRecording();
                    respond(windowId, message.requestId, viewState());
                } else if (message.url === "/points") {
                    if (session.running) throw new Error("路线执行过程中不能修改点位");
                    if (!Array.isArray(message.data?.points)) throw new Error("点位数据格式错误");
                    session.points = message.data.points;
                    if (session.phase !== "recording") session.phase = session.points.length ? "stopped" : "idle";
                    respond(windowId, message.requestId, { status: "ok", phase: session.phase });
                } else if (message.url === "/runFromPoint") {
                    if (session.running) throw new Error("路线已经在执行");
                    if (!Array.isArray(message.data?.points)) throw new Error("点位数据格式错误");
                    const index = Number(message.data?.index);
                    if (!Number.isInteger(index) || index < 0 || index >= message.data.points.length) throw new Error("起始点位无效");
                    session.points = message.data.points;
                    const meta = normalizeRouteMeta(message.data, session.settings);
                    const output = buildPathingFile("临时路线-从点位" + (index + 1), session.points.slice(index), meta, index);
                    launchRun(output);
                    respond(windowId, message.requestId, { status: "ok", running: true, displayMode: "compact" });
                } else if (message.url === "/save") {
                    if (session.running) throw new Error("路线执行过程中不能保存");
                    if (session.phase === "recording") throw new Error("请先结束录制");
                    session.points = message.data?.points;
                    const meta = normalizeRouteMeta(message.data, session.settings);
                    const name = safeFileName(message.data?.fileName);
                    const path = targetDir + "/" + name;
                    const isCurrentFile = [existingPath, session.savedPath]
                        .filter(Boolean)
                        .some(currentPath => currentPath.toLowerCase() === path.toLowerCase());
                    if (file.isFile(path) && !isCurrentFile && message.data?.overwrite !== true) {
                        respond(windowId, message.requestId, { status: "confirm_overwrite", path, fileName: name });
                        continue;
                    }
                    const output = buildPathingFile(name, session.points, meta, 0, existingData);
                    if (!file.isFolder(targetDir) && !file.createDirectory(targetDir)) throw new Error("无法创建保存目录：" + targetDir);
                    if (!file.writeTextSync(path, stringifyPathingFile(output, 4) + "\r\n", false)) throw new Error("路径文件写入失败：" + path);
                    session.savedPath = path;
                    session.phase = "saved";
                    suggestedFileName = name;
                    session.result = { status: "saved", path, fileName: name };
                    respond(windowId, message.requestId, { status: "ok", path, fileName: name });
                } else if (message.url === "/done") {
                    if (session.running) throw new Error("路线执行过程中不能关闭录制器");
                    if (!session.savedPath) throw new Error("路径尚未保存");
                    respond(windowId, message.requestId, { status: "ok" });
                    closeAfterResponse = true;
                } else if (message.url === "/cancel") {
                    if (session.running) throw new Error("路线执行过程中不能关闭录制器，请先停止 BetterGI 任务");
                    respond(windowId, message.requestId, { status: "ok" });
                    closeAfterResponse = true;
                }
            } catch (error) {
                respond(windowId, message.requestId, { status: "error", message: error.message || String(error) });
            }
            if (closeAfterResponse) break;
        }
    } finally {
        try { hook.dispose(); } catch (error) {}
        if (htmlMask.exists(windowId)) htmlMask.close(windowId);
    }
    return session.result;
}
