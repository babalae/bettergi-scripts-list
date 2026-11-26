eval(file.readTextSync("lib/lib.js"));
eval(file.readTextSync("lib/ocr.js"));
eval(file.readTextSync("lib/inventory.js"));

const defaultTime = getDefaultTime();
const enemyCategory = "敌人与魔物";
const miningCategory = "矿物";

const linneaMiningAction = "linnea_mining";
const linneaMiningChar = "莉奈娅";
const unknownCd = "24小时";
const collectAbility = {
    hydro_collect: "水",
    electro_collect: "雷",
    anemo_collect: "风",
    pyro_collect: "火",
    nahida_collect: "纳西妲",
};

const unlimitedMaterials = ["莉奈娅一条龙", "爱可菲", "纳塔食材一条龙", "提瓦特食材一条龙", "瓦雷莎家的果园"];

const materialAliases = { 晶核: "晶蝶", 冷鲜肉: "「冷鲜肉」" };

const obtainedNameMap = { "晶蝶": "晶核", "「冷鲜肉」": "冷鲜肉" };

const monsterNameAliases = {
    "丘丘暴徒": ["丘丘王"],
    "丘丘人": ["丘丘人射手", "奇怪的丘丘人"],
    "遗迹机械": ["遗迹守卫", "遗迹机兵", "遗迹龙兽"],
    "遗迹猎者": ["遗迹守卫", "遗迹龙兽"],
    "兽境群狼": ["兽境之狼"],
    "深渊使徒": ["深渊法师"],
    "海乱鬼": ["野伏众"],
    "黯色空壳": ["黑蛇众"],
};

let pendingRemains = {};

// BGI 只能读写脚本目录内的文件，别换成绝对路径
const configDir = "采集CD管理配置文件";
const configFile = configDir + "\\panel_settings.json";
const recordRoot = configDir + "\\record";

const legacyConfigFile = "panel_settings.json";
const legacyRecordRoot = "record";
const panelHtmlFile = "assets/panel.html";
const panelSlotValues = ["1", "2", "3", "4"];
const panelHealSlotValues = ["不启用", "1", "2", "3", "4"];
const panelSkillValues = ["E（短按）", "E（长按）", "Q"];
const panelOnStartValues = ["每次运行前显示", "不显示（直接用已保存的配置）"];
const statusCornerValues = ["左上", "上中", "右上", "左中", "中间", "右中", "左下", "下中", "右下"];
const overlayPercentRange = { min: 0, max: 100 };
const overlayScaleRange = { min: 0, max: 100 };

const panelConfigKeys = [
    "targetItems",
    "excludeTimeRange",
    "manualSetAccountName",
    "routeNotify",
    "runAllAfterTargets",
    "panelOnStart",
    "statusCorner",
    "statusX",
    "statusY",
    "statusScale",
    "partyName",
    "partyName2nd",
    "partyName3rd",
    "partyNameCombat",
    "walkSlotMain",
    "healSlotMain",
    "healSkillMain",
    "healCdMain",
    "walkSlotSecond",
    "healSlotSecond",
    "healSkillSecond",
    "healCdSecond",
    "walkSlotThird",
    "healSlotThird",
    "healSkillThird",
    "healCdThird",
    "healSlotCombat",
    "healSkillCombat",
    "healCdCombat",
    "animalCharNames",
    "miningCharNames",
    "panelHotkey",
];

function defaultPanelConfig() {
    return {
        targetItems: "",
        excludeTimeRange: "",
        manualSetAccountName: "",
        routeNotify: true,
        runAllAfterTargets: true,
        panelOnStart: panelOnStartValues[0],
        panelHotkey: "F7",
        statusCorner: statusCornerValues[1],
        statusX: "50",
        statusY: "14",
        statusScale: "100",
        partyName: "",
        partyName2nd: "",
        partyName3rd: "",
        partyNameCombat: "",
        walkSlotMain: "1",
        healSlotMain: "不启用",
        healSkillMain: panelSkillValues[0],
        healCdMain: "8",
        walkSlotSecond: "1",
        healSlotSecond: "不启用",
        healSkillSecond: panelSkillValues[0],
        healCdSecond: "8",
        walkSlotThird: "1",
        healSlotThird: "不启用",
        healSkillThird: panelSkillValues[0],
        healCdThird: "8",
        healSlotCombat: "不启用",
        healSkillCombat: panelSkillValues[0],
        healCdCombat: "8",
        animalCharNames: "",
        miningCharNames: "",
    };
}

function normalizePanelConfig(raw) {
    const base = defaultPanelConfig();
    const out = Object.assign({}, base);
    if (!raw || typeof raw !== "object") return out;

    const bind = (key, fallback, values, isNumber) => {
        if (!(key in raw)) return;
        const value = raw[key];
        if (value === null || value === undefined) return;
        if (isNumber) {
            const num = Math.max(1, parseInt(String(value), 10) || parseInt(String(fallback), 10) || 1);
            out[key] = String(num);
            return;
        }
        out[key] = String(value);
    };

    ["targetItems", "excludeTimeRange", "manualSetAccountName", "animalCharNames", "miningCharNames"].forEach((key) => bind(key, base[key]));
    bind("partyName", base.partyName);
    bind("partyName2nd", base.partyName2nd);
    bind("partyName3rd", base.partyName3rd);
    bind("partyNameCombat", base.partyNameCombat);
    if (raw.routeNotify !== undefined) out.routeNotify = Boolean(raw.routeNotify);
    if (raw.runAllAfterTargets !== undefined) out.runAllAfterTargets = Boolean(raw.runAllAfterTargets);
    if (raw.panelOnStart !== undefined && panelOnStartValues.includes(String(raw.panelOnStart))) {
        out.panelOnStart = String(raw.panelOnStart);
    }
    if (raw.panelHotkey !== undefined) {
        const key = String(raw.panelHotkey).trim();
        if (isValidPanelHotkeyName(key)) {
            out.panelHotkey = normalizePanelHotkeyName(key);
        }
    }
    if (raw.statusCorner !== undefined && statusCornerValues.includes(String(raw.statusCorner))) {
        out.statusCorner = String(raw.statusCorner);
    }
    const bindRange = (key, fallback, min, max) => {
        if (!(key in raw)) return;
        const num = parseInt(String(raw[key]), 10);
        if (Number.isNaN(num)) return;
        out[key] = String(Math.min(max, Math.max(min, num)));
    };
    bindRange("statusX", base.statusX, overlayPercentRange.min, overlayPercentRange.max);
    bindRange("statusY", base.statusY, overlayPercentRange.min, overlayPercentRange.max);
    bindRange("statusScale", base.statusScale, overlayScaleRange.min, overlayScaleRange.max);
    ["Main", "Second", "Third"].forEach((suffix) => {
        bind("walkSlot" + suffix, base["walkSlot" + suffix], panelSlotValues);
        bind("healSlot" + suffix, base["healSlot" + suffix], panelHealSlotValues);
        bind("healSkill" + suffix, base["healSkill" + suffix], panelSkillValues);
        bind("healCd" + suffix, base["healCd" + suffix], null, true);
    });
    bind("healSlotCombat", base.healSlotCombat, panelHealSlotValues);
    bind("healSkillCombat", base.healSkillCombat, panelSkillValues);
    bind("healCdCombat", base.healCdCombat, null, true);

    for (const key of Object.keys(raw)) {
        if (!key.startsWith("selectRoute_")) continue;
        const value = raw[key];
        if (!Array.isArray(value)) continue;
        out[key] = value.filter((item) => item !== null && item !== undefined).map((item) => String(item));
    }
    return out;
}

function ensureConfigDir() {
    try {
        if (!file.isExists(configDir)) {
            file.createDirectory(configDir);
            log.info("已创建配置文件夹 {0}", configDir);
        }
    } catch (e) {
        log.warn("创建配置文件夹 {0} 失败: {1}", configDir, e.toString());
    }
}

function ensureRecordDir(dir) {
    try {
        if (!file.isExists(dir)) file.createDirectory(dir);
    } catch (e) {
        log.debug("创建记录目录 {0} 失败: {1}", dir, e.toString());
    }
}

function readPanelConfigFile() {
    try {
        if (file.isExists(configFile)) {
            const text = file.readTextSync(configFile);
            if (text && text.trim()) return JSON.parse(text);
        }

        if (file.isExists(legacyConfigFile)) {
            const text = file.readTextSync(legacyConfigFile);
            if (text && text.trim()) {
                const parsed = JSON.parse(text);
                ensureConfigDir();
                file.writeTextSync(configFile, JSON.stringify(parsed, null, 2));
                log.info("已把旧配置迁移到 {0}", configFile);
                return parsed;
            }
        }
        return null;
    } catch (e) {
        log.warn("读取 {0} 失败，使用默认配置: {1}", configFile, e.toString());
        return null;
    }
}

function loadPanelConfigFile() {
    ensureConfigDir();
    const stored = readPanelConfigFile();
    if (!stored) {
        const created = defaultPanelConfig();
        try {
            file.writeTextSync(configFile, JSON.stringify(created, null, 2));
            log.info("没有找到 {0}，已创建默认配置文件（可直接用游戏内面板修改）", configFile);
        } catch (e) {
            log.warn("创建 {0} 失败: {1}", configFile, e.toString());
        }
        return created;
    }
    return normalizePanelConfig(stored);
}

const cfg = loadPanelConfigFile();

function publicPanelConfig() {    const out = {};
    for (const key of panelConfigKeys) out[key] = cfg[key];
    for (const key of Object.keys(cfg)) {
        if (key.startsWith("selectRoute_")) out[key] = cfg[key];
    }
    return out;
}

function applyPanelConfig(payload) {
    if (!payload || typeof payload !== "object") return;
    const incoming = payload.settings && typeof payload.settings === "object" ? payload.settings : payload;
    const normalized = normalizePanelConfig(Object.assign({}, cfg, incoming));
    for (const key of Object.keys(normalized)) {
        cfg[key] = normalized[key];
    }

    if (payload.routeReady) {
        for (const key of Object.keys(cfg)) {
            if (key.startsWith("selectRoute_") && !(key in incoming)) delete cfg[key];
        }
    }
}

function persistPanelConfig() {
    try {
        ensureConfigDir();
        file.writeTextSync(configFile, JSON.stringify(publicPanelConfig(), null, 2));
        return true;
    } catch (e) {
        log.warn("保存 {0} 失败: {1}", configFile, e.toString());
        return false;
    }
}

function isPanelSupported() {
    try {
        return typeof htmlMask !== "undefined" && htmlMask !== null && typeof htmlMask.show === "function";
    } catch (e) {
        return false;
    }
}

function panelRouteGroups(index) {
    const list = [];
    for (const entry of Object.values(index)) {
        const keys = Object.keys(versionGroupsOf(entry)).sort((a, b) => a.localeCompare(b, "zh", { numeric: true }));
        if (keys.length <= 1) continue;
        const selected = (cfg["selectRoute_" + entry.name] || []).filter((key) => keys.includes(key));
        list.push({ name: entry.name, versions: keys, selected: selected });
    }
    list.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    return list;
}

const panelHotkeyDefault = "F7";

// KeyboardEvent.code -> Windows 虚拟键码
const panelHotkeyVkMap = {
    Escape: 27, Tab: 9, CapsLock: 20, Space: 32, Backspace: 8, Enter: 13,
    Insert: 45, Delete: 46, Home: 36, End: 35, PageUp: 33, PageDown: 34,
    ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
    PrintScreen: 44, ScrollLock: 145, Pause: 19, NumLock: 144,
    Shift: 16, ShiftLeft: 160, ShiftRight: 161,
    Control: 17, ControlLeft: 162, ControlRight: 163,
    Alt: 18, AltLeft: 164, AltRight: 165,
    Meta: 91, MetaLeft: 91, MetaRight: 92, ContextMenu: 93,
    Semicolon: 186, Equal: 187, Comma: 188, Minus: 189, Period: 190, Slash: 191,
    Backquote: 192, BracketLeft: 219, Backslash: 220, BracketRight: 221, Quote: 222,
    Numpad0: 96, Numpad1: 97, Numpad2: 98, Numpad3: 99, Numpad4: 100,
    Numpad5: 101, Numpad6: 102, Numpad7: 103, Numpad8: 104, Numpad9: 105,
    NumpadMultiply: 106, NumpadAdd: 107, NumpadSubtract: 109, NumpadDecimal: 110,
    NumpadDivide: 111, NumpadEnter: 13,
};
function isValidPanelHotkeyName(name) {
    const key = String(name || "").trim();
    if (!key) return false;
    if (/^F([1-9]|1[0-2])$/i.test(key)) return true;
    if (/^(Key[A-Z]|[A-Z])$/i.test(key)) return true;
    if (/^(Digit[0-9]|[0-9])$/.test(key)) return true;
    return Object.prototype.hasOwnProperty.call(panelHotkeyVkMap, key);
}
function normalizePanelHotkeyName(name) {
    const key = String(name || "").trim();
    if (/^F([1-9]|1[0-2])$/i.test(key) || /^[A-Za-z]$/.test(key) || /^[0-9]$/.test(key)) {
        return key.toUpperCase();
    }
    return key;
}
function panelHotkeyCode() {
    const raw = String(cfg.panelHotkey || panelHotkeyDefault).trim();
    const fn = raw.match(/^F([1-9]|1[0-2])$/i);
    if (fn) return 111 + parseInt(fn[1], 10);
    const letter = raw.match(/^(?:Key)?([A-Z])$/i);
    if (letter) return letter[1].toUpperCase().charCodeAt(0);
    const digit = raw.match(/^(?:Digit)?([0-9])$/);
    if (digit) return 48 + parseInt(digit[1], 10);
    if (Object.prototype.hasOwnProperty.call(panelHotkeyVkMap, raw)) return panelHotkeyVkMap[raw];
    const lower = raw.charAt(0).toLowerCase() + raw.slice(1);
    if (Object.prototype.hasOwnProperty.call(panelHotkeyVkMap, lower)) return panelHotkeyVkMap[lower];
    return 118;
}

const panelService = {
    running: false,
    panelId: null,
    openRequested: false,
    pauseRequested: false,
    restartRequested: false,
    stopRequested: false,
    hook: null,
    index: null,
    lastPushAt: 0,
    startRequested: false,
    executing: false,
    routeRunning: false,
    abortedRoute: false,
    pendingOpen: false,
    skipMaskClose: false,
};

class RestartRequested extends Error {
    constructor(message) {
        super(message || "配置已更新");
        this.name = "RestartRequested";
    }
}

function taskStopped() {
    if (panelService.stopRequested) return true;
    try {
        return isTaskCancelled();
    } catch (e) {
        return false;
    }
}

function stopScriptFromPanel() {
    panelService.stopRequested = true;
    panelService.pauseRequested = false;
    panelService.restartRequested = false;
    panelService.running = false;
    log.info("配置面板：用户点击结束脚本，正在停止");

    try {
        if (panelService.hook) {
            panelService.hook.dispose();
            panelService.hook = null;
        }
    } catch (e) {

    }
    try {
        if (typeof dispatcher !== "undefined" && dispatcher && typeof dispatcher.getLinkedCancellationTokenSource === "function") {
            const cts = dispatcher.getLinkedCancellationTokenSource();
            if (cts) cts.cancel();
        }
    } catch (e) {
        log.debug("从面板结束脚本时取消任务失败（改由检查点退出）: {0}", e.toString());
    }
}

function cfgNum(key, fallback) {
    const num = parseFloat(cfg[key]);
    return Number.isFinite(num) ? num : fallback;
}

function requestOpenPanel() {
    if (!panelService.running) return;
    if (panelService.panelId) return;

    if (panelService.executing && panelService.routeRunning) {
        // 面板一开，这条路线就当没跑过
        panelService.abortedRoute = true;
        statusState.note = "已按配置快捷键：当前路线中断（不记 CD、不扣数量）";
        updateStatusSoon();
    }

    syncTargetRemainBeforePanel();
    panelService.openRequested = true;
}

function panelInitPayload(paused) {
    return JSON.stringify({
        settings: publicPanelConfig(),
        routes: panelRouteGroups(panelService.index || {}),
        paused: Boolean(paused),
    });
}

function pushPanelInit() {
    if (!panelService.panelId) return;
    try {
        htmlMask.send(panelService.panelId, "/panel/init", panelInitPayload(panelService.pauseRequested));
        panelService.lastPushAt = Date.now();
    } catch (e) {
        log.debug("推送面板配置失败: {0}", e.toString());
    }
}

function openPanelWindow() {
    panelService.openRequested = false;

    syncTargetRemainBeforePanel();
    try {
        const id = htmlMask.show(panelHtmlFile);
        if (!id) {
            log.warn("打开配置面板失败");
            return;
        }
        panelService.panelId = id;
        panelService.pauseRequested = false;
        statusState.note = "";

        if (panelService.executing && panelService.routeRunning) {
            panelService.abortedRoute = true;
        }
        try {
            htmlMask.setClickThrough(id, false);
        } catch (e) {

        }
        pushPanelInit();
        try {
            ensureOverlaysVisible();
        } catch (e) {
            log.warn("显示悬浮件预览失败（不影响面板）: {0}", e.toString());
        }
        log.info("已打开配置面板：脚本暂停调度，配置完成后点「开始执行」，点「结束脚本」直接停止（F10 同样有效）");
    } catch (e) {
        log.warn("打开配置面板异常: {0}", e.toString());
        panelService.panelId = null;
        panelService.pauseRequested = false;
    }
}

function closePanelWindow() {
    const id = panelService.panelId;
    panelService.panelId = null;
    endOverlayPreview();
    if (!id) return;
    try {
        htmlMask.close(id);
    } catch (e) {

    }
}

function handlePanelMessage(raw) {
    let message = null;
    try {
        message = JSON.parse(raw);
    } catch (e) {
        return;
    }
    const url = message && message.url ? String(message.url) : "";
    let data = message ? message.data : null;
    if (typeof data === "string") {
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = {};
        }
    }
    if (!data || typeof data !== "object") data = {};

    if (url === "/panel/ready") {
        pushPanelInit();
        return;
    }
    if (url === "/panel/previewPosition") {
        handlePreviewPosition(data);
        return;
    }
    if (url === "/panel/overlayPos") return;
    if (url === "/panel/previewHotkey") {
        const key = String((data && data.panelHotkey) || "").trim();
        if (isValidPanelHotkeyName(key)) {
            cfg.panelHotkey = normalizePanelHotkeyName(key);
            log.info("配置面板快捷键已临时改为 {0}（点保存配置后长期保留）", key);
        }
        return;
    }
    if (url === "/panel/save") {
        applyPanelConfig(data);
        const ok = persistPanelConfig();
        applyOverlayCorns();
        try {
            htmlMask.send(panelService.panelId, "/panel/toast", JSON.stringify({ text: ok ? "已保存（长时间保留）" : "保存失败，看日志" }));
        } catch (e) {

        }
        log.info("配置面板：配置已保存到 {0}", configFile);
        return;
    }
    if (url === "/panel/run") {
        applyPanelConfig(data);
        persistPanelConfig();
        applyOverlayCorns();
        closePanelWindow(true);
        panelService.pauseRequested = false;
        if (panelService.executing) {
            panelService.restartRequested = true;
            log.info("配置面板：已确认，脚本按新配置重新开始");
        } else {
            panelService.startRequested = true;
            log.info("配置面板：已确认，开始执行");
        }
        return;
    }
    if (url === "/panel/close") {
        applyPanelConfig(data);
        persistPanelConfig();
        applyOverlayCorns();
        closePanelWindow();
        panelService.pauseRequested = false;
        panelService.restartRequested = false;
        log.info("配置面板：已关闭，脚本继续后台待命/继续执行（按 {0} 重新打开）", String(cfg.panelHotkey || panelHotkeyDefault));
        return;
    }
    if (url === "/panel/stop") {
        closePanelWindow(true);
        try {
            hideStatusWindow();
        } catch (e) {

        }
        stopScriptFromPanel();
        return;
    }
}

async function runPanelServiceLoop() {
    while (panelService.running && !panelService.stopRequested) {
        try {
            if (panelService.stopRequested) break;
            if (!panelService.panelId) {
                if (panelService.openRequested) {
                    openPanelWindow();
                    continue;
                }
                await sleep(350);
                continue;
            }
            if (!htmlMask.exists(panelService.panelId)) {
                closePanelWindow();
                panelService.pauseRequested = false;
                continue;
            }
            const raw = await htmlMask.receive(panelService.panelId, 300);
            if (!raw) continue;
            handlePanelMessage(raw);
        } catch (e) {
            const msg = e && e.message ? String(e.message) : String(e || "");

            if (panelService.stopRequested || !panelService.running || /disposed|已释放|ObjectDisposed/i.test(msg) || isCancelError(e) || taskStopped()) break;
            log.debug("配置面板服务异常: {0}", msg);
            await sleep(300);
        }
    }
    shutdownPanelService();
}

function startPanelService(index) {
    if (panelService.running) return;
    if (!isPanelSupported()) {
        log.warn("当前 BetterGI 不支持游戏内面板（需要 0.61 及以上），本次不显示悬浮按钮");
        return;
    }
    panelService.index = index || panelService.index;
    panelService.running = true;
    panelService.stopRequested = false;
    panelService.skipMaskClose = false;
    panelService.pendingOpen = false;
    let hook = null;
    try {
        hook = new KeyMouseHook();
        panelService.hook = hook;
    } catch (e) {
        log.warn("创建全局键鼠钩子失败（配置面板快捷键用不了）: {0}", e.toString());
    }
    if (hook) {
        const handleKey = (keyCode) => {
            if (!panelService.running || panelService.stopRequested) return;
            let code = NaN;
            try {
                if (typeof keyCode === "object" && keyCode !== null) {
                    code = Number(keyCode.keyCode ?? keyCode.KeyCode ?? keyCode.code ?? keyCode.Code ?? keyCode.value__ ?? NaN);
                }
                if (!Number.isFinite(code)) {
                    const raw = String(keyCode || "").trim();
                    if (/^\d+$/.test(raw)) {
                        code = Number(raw);
                    } else {
                        const fnKey = raw.match(/^F([1-9]|1[0-2])$/i);
                        const letterKey = raw.match(/^[A-Z]$/i);
                        const digitKey = raw.match(/^[0-9]$/);
                        if (fnKey) code = 111 + parseInt(fnKey[1], 10);
                        else if (letterKey) code = raw.toUpperCase().charCodeAt(0);
                        else if (digitKey) code = 48 + parseInt(raw, 10);
                        else if (Object.prototype.hasOwnProperty.call(panelHotkeyVkMap, raw)) code = panelHotkeyVkMap[raw];
                    }
                }
            } catch (e) {
                code = NaN;
            }
            if (Number.isFinite(code) && code === panelHotkeyCode()) {
                requestOpenPanel();
            }
        };
        try {
            hook.onKeyDown(handleKey, true);
        } catch (e) {
            log.warn("注册配置快捷键失败(useCodeOnly): {0}", e.toString());
        }
        try {
            hook.onKeyDown(handleKey);
        } catch (e) {
            log.warn("注册配置快捷键失败(默认): {0}", e.toString());
        }
        try {
            hook.onKeyUp(handleKey);
        } catch (e) {

        }
    }
    runPanelServiceLoop().catch((e) => log.debug("面板服务退出: {0}", e.toString()));
    log.info("面板服务已启动：按 {0} 打开配置面板（全局钩子，与当前焦点窗口无关；建议与 BGI 暂停快捷键一致）", String(cfg.panelHotkey || panelHotkeyDefault));
}

function shutdownPanelService() {
    panelService.running = false;
    panelService.openRequested = false;
    panelService.pauseRequested = false;
    try {
        if (panelService.hook) {
            panelService.hook.dispose();
            panelService.hook = null;
        }
    } catch (e) {

    }
    try {

        if (!panelService.skipMaskClose) {
            htmlMask.closeAll();
        }
    } catch (e) {

    }
}

async function waitBeforeNextRoute() {
    if (taskStopped()) throw new UserCancelled("任务已被停止");

    while (panelService.pendingOpen && !panelService.panelId) {
        if (taskStopped()) throw new UserCancelled("用户从配置面板结束脚本");
        await sleep(200);
    }
    while (panelService.panelId && htmlMask.exists(panelService.panelId)) {
        if (taskStopped()) throw new UserCancelled("用户从配置面板结束脚本");
        if (panelService.restartRequested) throw new RestartRequested("配置已更新");
        await sleep(300);
    }
    if (panelService.stopRequested) throw new UserCancelled("用户从配置面板结束脚本");
    if (panelService.restartRequested) throw new RestartRequested("配置已更新");
}

const statusHtmlFile = "assets/status.html";
const statusState = {
    active: false,
    material: "",
    targetName: "",
    targetCount: null,
    remain: null,
    picked: 0,
    routeName: "",
    routeIndex: 0,
    routeTotal: 0,
    note: "",
};
const statusService = { winId: null, running: false, lastPushAt: 0, previewOnly: false };
let scriptStartedAt = Date.now();

function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => (n < 10 ? "0" + n : String(n));
    return pad(h) + ":" + pad(m) + ":" + pad(s);
}

function beijingNowText() {

    const d = new Date(Date.now() + 8 * 3600 * 1000);
    const pad = (n) => (n < 10 ? "0" + n : String(n));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) +
        " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
}

function statusPayload() {
    let percent = -1;
    if (statusState.targetCount !== null && statusState.targetCount > 0) {
        const remain = statusState.remain === null ? statusState.targetCount : statusState.remain;
        const done = Math.max(0, statusState.targetCount - remain);
        percent = Math.min(100, Math.round((done / statusState.targetCount) * 100));
    }
    return {
        active: Boolean(statusState.active),
        material: statusState.material || "",
        targetName: statusState.targetName || "",
        targetCount: statusState.targetCount,
        remain: statusState.remain,
        picked: statusState.picked || 0,
        routeName: statusState.routeName || "",
        routeIndex: statusState.routeIndex || 0,
        routeTotal: statusState.routeTotal || 0,
        percent: percent,
        note: statusState.note || "",
        elapsedText: formatDuration(Date.now() - scriptStartedAt),
        clockText: beijingNowText(),
        corner: String(cfg.statusCorner || "上中"),
        x: cfgNum("statusX", 50),
        y: cfgNum("statusY", 14),
        scale: cfgNum("statusScale", 100) / 100,
    };
}

function pushStatus() {
    if (!statusService.winId) return;
    try {
        htmlMask.send(statusService.winId, "/status/update", JSON.stringify(statusPayload()));
        statusService.lastPushAt = Date.now();
    } catch (e) {

    }
}

function updateStatusSoon() {
    if (!statusService.winId) return;
    if (Date.now() - statusService.lastPushAt < 400) return;
    pushStatus();
}

async function runStatusLoop() {
    while (statusService.running) {
        pushStatus();
        await sleep(700);
    }
}

function startStatusWindow() {
    if (!isPanelSupported()) return;
    if (statusService.winId) {
        statusService.running = true;
        pushStatus();
        return;
    }
    let id = null;
    try {
        id = htmlMask.show(statusHtmlFile);
    } catch (e) {
        log.debug("显示路线悬浮窗失败: {0}", e.toString());
        return;
    }
    if (!id) return;
    statusService.winId = id;
    statusService.running = true;
    try {
        htmlMask.setClickThrough(id, true);
    } catch (e) {

    }
    statusService.lastPushAt = 0;
    runStatusLoop().catch((e) => log.debug("路线悬浮窗退出: {0}", e.toString()));
}

function hideStatusWindow() {
    statusService.running = false;
    const id = statusService.winId;
    statusService.winId = null;
    statusState.active = false;
    if (!id) return;
    try {
        htmlMask.close(id);
    } catch (e) {

    }
}

function handlePreviewPosition(data) {
    let incoming = data;
    if (incoming && typeof incoming === "object" && incoming.settings) incoming = incoming.settings;
    if (typeof incoming === "string") {
        try {
            incoming = JSON.parse(incoming);
        } catch (e) {
            incoming = {};
        }
    }
    if (!incoming || typeof incoming !== "object") return;
    if (incoming.statusCorner && statusCornerValues.includes(String(incoming.statusCorner))) {
        cfg.statusCorner = String(incoming.statusCorner);
    }
    const takeRange = (key, min, max) => {
        if (incoming[key] === undefined || incoming[key] === null || incoming[key] === "") return;
        const num = parseInt(String(incoming[key]), 10);
        if (Number.isNaN(num)) return;
        cfg[key] = String(Math.min(max, Math.max(min, num)));
    };
    takeRange("statusX", 0, 100);
    takeRange("statusY", 0, 100);
    takeRange("statusScale", 0, 100);
    if (panelService.panelId && htmlMask.exists(panelService.panelId)) {
        if (!statusService.winId) {
            ensureOverlaysVisible();
        }
    }
    applyOverlayCorns();
    pushStatus();
}

function applyOverlayCorns() {
    if (!isPanelSupported()) return;
    if (statusService.winId) {
        try {
            htmlMask.send(statusService.winId, "/status/config", JSON.stringify({
                corner: String(cfg.statusCorner || "上中"),
                x: cfgNum("statusX", 50),
                y: cfgNum("statusY", 14),
                scale: cfgNum("statusScale", 100) / 100,
            }));
        } catch (e) {

        }
    }
}

function ensureOverlaysVisible() {
    if (!isPanelSupported()) return;
    if (!statusService.winId) {
        statusState.active = true;
        statusState.material = "示例材料";
        statusState.targetName = "示例材料";
        statusState.targetCount = 100;
        statusState.remain = 43;
        statusState.picked = 57;
        statusState.routeName = "01-示例路线.json";
        statusState.routeIndex = 1;
        statusState.routeTotal = 1;
        statusState.note = "";
        statusService.previewOnly = true;
        startStatusWindow();
    } else {

        statusService.running = true;
    }
    applyOverlayCorns();
    pushStatus();
}

function endOverlayPreview() {
    if (statusService.previewOnly) {
        hideStatusWindow();
        statusService.previewOnly = false;
    }
}

async function showConfigPanel(index) {
    if (!isPanelSupported()) {
        log.warn("当前 BetterGI 不支持游戏内面板（需要 0.61 及以上），本次直接使用已保存的配置");
        return true;
    }
    startPanelService(index);
    panelService.startRequested = false;
    panelService.executing = false;
    openPanelWindow();
    if (!panelService.panelId && !panelService.stopRequested) {
        log.warn("打开配置面板失败，本次直接使用已保存的配置");
        return true;
    }
    while (!panelService.startRequested) {
        if (taskStopped()) throw new UserCancelled("用户结束脚本");
        await sleep(200);
    }
    endOverlayPreview();
    return true;
}

const pickupIcon = { x: 1102, y: 335, width: 34, height: 400 };
const pickupText = { x: 1210, width: 202, height: 40 };

let stopAtTime = null;
let currentParty = null;
let currentMap = "Teyvat";
let worldInfo = null;
let partyAbility = {};
let account = "";
const recordCache = {};

let pickupWhitelist = [];

let pickupCounterReady = false;
const enemyRefreshRules = loadEnemyRefreshRules();
const { monsterToDrops, dropToMonsters } = loadMonsterDropMap();

class ReachStopTime extends Error {
    constructor(message) {
        super(message);
        this.name = "ReachStopTime";
    }
}
class UserCancelled extends Error {
    constructor(message) {
        super(message);
        this.name = "UserCancelled";
    }
}

class FatalStop extends Error {
    constructor(message) {
        super(message);
        this.name = "FatalStop";
    }
}

function linkedCancelToken() {
    try {
        if (typeof dispatcher === "undefined" || !dispatcher || !dispatcher.getLinkedCancellationToken) return null;
        return dispatcher.getLinkedCancellationToken();
    } catch (e) {
        return null;
    }
}

function isTaskCancelled() {
    const token = linkedCancelToken();
    if (!token) return false;
    try {
        return !!token.isCancellationRequested;
    } catch (e) {
        return false;
    }
}

function isCancelError(error) {
    if (isTaskCancelled()) return true;
    const msg = error && error.message ? error.message : String(error || "");
    return /取消|停止|中止|cancel|Cancel|aborted|abort/i.test(msg);
}

function throwIfCancelled(error) {
    if (error && isCancelError(error)) {
        throw new UserCancelled(error.message ? error.message : "任务已被停止");
    }
}

function checkStop(where) {
    if (panelService && panelService.stopRequested) {
        throw new UserCancelled(where ? "用户从配置面板结束脚本（" + where + "）" : "用户从配置面板结束脚本");
    }
    if (!isTaskCancelled()) return;
    throw new UserCancelled(where ? "任务已被停止（" + where + "）" : "任务已被停止");
}

async function withTimeout(promise, ms, label) {
    const timer = (async () => {
        try {
            await sleep(ms);
        } catch (e) {

            return { ok: false, timeout: true, cancelled: true };
        }
        return { ok: false, timeout: true };
    })();
    const task = Promise.resolve(promise)
        .then((value) => ({ ok: true, value: value }))
        .catch((error) => ({ ok: false, error: error }));
    const result = await Promise.race([task, timer]);
    if (result && !result.ok && result.error) throwIfCancelled(result.error);
    if (result && result.timeout) {
        if (result.cancelled || isTaskCancelled()) throw new UserCancelled("任务已被停止，停止等待");
        log.debug("{0} 超过 {1} ms 未返回，已放弃等待", label || "操作", ms);
    }
    return result;
}

async function safeReturnMainUi(ms) {
    if (isTaskCancelled()) throw new UserCancelled("任务已被停止");
    const timeout = ms || 6000;
    const result = await withTimeout(genshin.returnMainUi(), timeout, "回到主界面");
    return result.ok;
}

(async function () {
    setGameMetrics(1920, 1080, 1.25);
    const startTime = logFakeScriptStart();

    let flowDone = false;
    // 主流程可能卡在某个宿主调用里，这里单独盯取消
    const stopWatch = (async () => {
        while (!flowDone) {

            if (isTaskCancelled() || panelService.stopRequested) return "cancel";
            try {
                await sleep(400);
            } catch (e) {
                return "cancel";
            }
        }
        return "idle";
    })();

    const flow = (async () => {
        try {
            pickupCounterReady = canUsePickupCounter();
            await runGatherMode();
        } catch (e) {
            if (e instanceof ReachStopTime) {
                log.info("达到设置的停止时间 {0}，终止运行", stopAtTime);
            } else if (e instanceof UserCancelled) {
                log.info("用户取消，终止运行");
            } else if (e instanceof FatalStop) {
                log.error("{0}，脚本结束", e.message);
            } else if (isTaskCancelled() || isCancelError(e)) {

                log.info("用户取消，终止运行（{0}）", e && e.message ? e.message : e.toString());
            } else {
                log.error("脚本运行出错: {0}", e && e.message ? e.message : e.toString());
                if (e && e.stack) log.error("错误堆栈: {0}", e.stack);

            }
        } finally {
            try {
                finishUp(startTime);
            } catch (e) {
                log.debug("结束收尾失败（忽略，避免抛回宿主）: {0}", e && e.message ? e.message : String(e));
            }
            flowDone = true;
        }
    })();

    try {
        const winner = await Promise.race([flow.then(() => "done"), stopWatch]);
        if (winner === "cancel") {

            log.info("检测到任务已停止，脚本结束");

            panelService.running = false;
            panelService.stopRequested = true;
            panelService.skipMaskClose = true;
            statusService.running = false;
            statusService.winId = null;
            try {
                if (panelService.hook) {
                    panelService.hook.dispose();
                    panelService.hook = null;
                }
            } catch (e) {

            }
            try {
                flushTargetItems();
            } catch (e) {
                log.debug("回写剩余数量失败: {0}", e.toString());
            }
        }
    } catch (e) {

        log.debug("运行结束: {0}", e && e.message ? e.message : String(e));
    }
})();

function finishUp(startTime) {
    try {
        shutdownPanelService();
    } catch (e) {

    }
    try {
        hideStatusWindow();
    } catch (e) {

    }
    try {
        flushTargetItems();
    } catch (e) {
        log.debug("回写剩余数量失败: {0}", e.toString());
    }
    try {
        logFakeScriptEnd({ startTime: startTime });
    } catch (e) {

    }
}

async function runGatherMode() {
    let firstPass = !String(cfg.panelOnStart || "").startsWith("不显示");
    while (true) {
        try {
            await runGatherPass(firstPass);
            return;
        } catch (e) {
            if (e instanceof RestartRequested) {
                firstPass = false;
                panelService.restartRequested = false;
                try {
                    flushTargetItems();
                } catch (err) {
                    log.debug("重启前回写剩余数量失败: {0}", err.toString());
                }
                log.info("配置已更新：按新配置重新开始本次采集");
                continue;
            }
            throw e;
        }
    }
}

async function runGatherPass(showPanel) {
    log.info("正在扫描已订阅的路线...");
    const index = await buildMaterialIndex();
    if (Object.keys(index).length === 0) {
        log.error("未扫描到任何路线，请先在BetterGI中订阅需要的路线");
        return;
    }
    panelService.index = index;

    if (showPanel) {
        const started = await showConfigPanel(index);
        if (!started) {
            log.info("已关闭配置面板，本次不运行");
            return;
        }
    }
    panelService.executing = true;
    panelService.startRequested = false;
    panelService.pauseRequested = false;

    startPanelService(index);
    panelService.executing = true;
    panelService.startRequested = false;
    panelService.pauseRequested = false;
    startStatusWindow();

    writeMaterialListFile(index);
    pickupWhitelist = buildPickupWhitelist(index);

    if (cfg.excludeTimeRange) {
        const { duringRange, nearestStopTime } = checkExecutionExcludeTime(cfg.excludeTimeRange);
        if (duringRange) {
            log.info("当前处于设定的不运行时间段: {0}", duringRange);
            return;
        }
        stopAtTime = nearestStopTime;
        log.info("脚本已被配置为达到{0}后停止运行", stopAtTime);
    }

    const targets = parseTargets(cfg.targetItems);
    const runAllMode = targets.length === 0;
    if (runAllMode) {
        log.info("采集目标为空：按顺序执行全部已订阅路线（不限数量），直到所有路线都进入CD");
    } else {
        log.info("采集目标: {0}", targets.map((t) => formatTarget(t)).join("  "));
    }

    account = await getAccount();
    log.info("在{0}的世界采集材料并管理CD", account);

    checkStop("前往神像前");
    log.info("前往神像进行采集前的准备工作");
    const tpResult = await withTimeout(genshin.tpToStatueOfTheSeven(), 90000, "传送到神像");
    if (!tpResult.ok) log.warn("传送到神像未正常返回（超时或停止），继续后续流程");
    checkStop("传送神像后");
    if (worldInfo === null) {
        const coOpResult = await withTimeout(getCoOpModeAndHostUid(), 45000, "识别联机状态");
        worldInfo = coOpResult.ok && coOpResult.value ? coOpResult.value : { coOpMode: true, maskUid: account };
        if (!coOpResult.ok) log.warn("识别联机状态超时，本次按联机模式处理（不切换队伍）");
    }
    checkStop("识别联机状态后");
    if (worldInfo.coOpMode) {
        log.info("当前处于联机模式，不执行队伍切换");
    } else {

        const partyResult = await withTimeout(switchPartySafely(cfg.partyName, tpResult.ok), 90000, "切换采集队伍");
        if (!partyResult.ok) log.warn("切换采集队伍未正常返回，继续后续流程");
        currentParty = cfg.partyName;
    }
    checkStop("切换队伍后");

    if (pickupCounterReady) {
        log.info("已启用拾取识别计数：边跑路边读拾取提示，拾到目标物品即扣减数量");
    } else {

        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        log.warn("拾取识别不可用（assets/F_Dialogue.png 缺失或被修改），本次改用BGI自动拾取，数量按路线计1");
    }

    if (runAllMode) {
        await runAllRoutes(index);
    } else {
        for (const target of targets) {
            if (isTaskCancelled()) throw new UserCancelled("任务已被停止");
            await waitBeforeNextRoute();
            await runTarget(target, index);
        }
        log.info("全部采集目标处理完毕");
        if (cfg.runAllAfterTargets) {
            log.info("已开启「目标完成后继续跑全部路线」，接着按顺序执行其余已订阅路线");
            await runAllRoutes(index);
        }
    }
}

async function runAllRoutes(index) {
    const allEntries = sortEntriesForRunAll(index);
    log.info("共有 {0} 种材料/怪物可执行，按 地方特产 → 矿物 → 食材与炼金 → 敌人与魔物 的顺序执行", allEntries.length);
    for (const entry of allEntries) {
        if (isTaskCancelled()) throw new UserCancelled("任务已被停止");
        await waitBeforeNextRoute();
        await runTarget({ name: entry.name, count: null, allVersions: false, runAll: true }, index);
    }
    log.info("全部路线已执行完毕，所有路线均已进入CD");
}

function sortEntriesForRunAll(index) {
    const order = ["地方特产", "矿物", "食材与炼金", enemyCategory];
    const rank = (entry) => {
        const type = entry.type.split("/")[0];
        const idx = order.indexOf(type);
        return idx === -1 ? order.length : idx;
    };
    return Object.values(index).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "zh", { numeric: true }));
}

async function getAccount() {
    // 必须读到 9 位 UID，读不到就一直重试，不拿默认账号顶替
    let name = "";
    let attempt = 0;
    while (!name) {
        attempt++;
        checkStop("识别账号UID");
        try {
            await withTimeout(genshin.returnMainUi(), 6000, "回到主界面");
        } catch (e) {
            throwIfCancelled(e);
        }
        const result = await withTimeout(getCoOpModeAndHostUid(), 45000, "识别账号UID");
        const info = result.ok ? result.value : null;
        if (info && info.maskUid) {
            worldInfo = info;

            name = info.maskUid;
            break;
        }
        log.warn("第 {0} 次未读取到有效账号 UID（需要右下角/好友资料页的 9 位 UID），2 秒后重试；未读到 UID 不会执行任何路线", attempt);
        await sleep(2000);
    }
    log.info("已读取到账号 UID: {0}（掩码显示），记录保存在 record\\{0}", name);
    return name;
}

function canUsePickupCounter() {
    try {
        file.ReadImageMatSync("assets/F_Dialogue.png");
        return true;
    } catch (e) {
        log.error("读取拾取图标素材失败: {0}", e.toString());
        return false;
    }
}

function buildPickupWhitelist(index) {
    const names = new Set();
    for (const name of Object.keys(index)) names.add(name);
    for (const monster of Object.keys(monsterToDrops)) {
        for (const drop of monsterToDrops[monster]) names.add(drop);
    }
    for (const value of Object.values(obtainedNameMap)) names.add(value);
    for (const key of Object.keys(materialAliases)) names.add(key);
    return Array.from(names).filter((n) => n && n.length > 1);
}

const pickupTextNoise = /[^\u4e00-\u9fa5A-Za-z0-9]/g;

function normalizePickupText(text) {
    return String(text || "").replace(pickupTextNoise, "");
}

function matchPickupName(text, names) {
    if (!names || names.length === 0) return null;
    const target = normalizePickupText(text);
    if (!target) return null;
    let best = null;
    let bestKeyLength = 0;
    for (const name of names) {
        const key = normalizePickupText(name);
        if (!key) continue;
        if (target === key) return name;

        if (target.includes(key) && key.length > bestKeyLength) {
            best = name;
            bestKeyLength = key.length;
        }
    }
    if (best) return best;
    for (const name of names) {
        const key = normalizePickupText(name);
        if (!key || Math.abs(key.length - target.length) > 2) continue;
        const minLength = Math.min(key.length, target.length);
        if (stringSimilarity(target, key) >= (minLength >= 4 ? 0.75 : 0.66)) return name;
    }
    return null;
}

function stringSimilarity(a, b) {
    if (!a || !b) return 0;
    const len1 = a.length;
    const len2 = b.length;
    if (len1 === 0 || len2 === 0) return 0;
    const dp = [];
    for (let i = 0; i <= len1; i++) dp.push(new Array(len2 + 1).fill(0));
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[len1][len2] / Math.max(len1, len2);
}

async function runPickupWatcher(state) {
    let iconRo;
    try {
        iconRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync("assets/F_Dialogue.png"),
            pickupIcon.x,
            pickupIcon.y,
            pickupIcon.width,
            pickupIcon.height
        );
    } catch (e) {
        log.error("初始化拾取识别失败，本材料改为按路线计1: {0}", e.toString());
        state.fallbackRouteCount = true;
        return;
    }

    let lastPress = { text: "", y: -999, time: 0 };
    let lastDebugLog = 0;
    while (state.running) {
        let frame = null;
        try {
            frame = captureGameRegion();
            const icon = frame.find(iconRo);
            if (!icon || !icon.isExist() || icon.x === 0 || icon.y === 0) {
                await sleep(80);
                continue;
            }
            const textY = Math.max(0, icon.y - 3);
            const textRo = RecognitionObject.ocr(pickupText.x, textY, pickupText.width, pickupText.height);
            const texts = frame.findMulti(textRo);
            let acted = false;
            for (let i = 0; i < texts.count; i++) {
                const rawText = (texts[i].text || "").trim();
                if (!rawText) continue;
                const now = Date.now();
                // 同一条提示会在多帧里出现，350ms 内同名同位置只算一次
                if (rawText === lastPress.text && Math.abs(icon.y - lastPress.y) < 15 && now - lastPress.time < 350) {
                    acted = true;
                    break;
                }
                const countName = matchPickupName(rawText, state.countNames);
                const pickupable = countName || matchPickupName(rawText, pickupWhitelist);
                if (!pickupable) continue;

                lastPress = { text: rawText, y: icon.y, time: now };
                keyPress("F");
                if (countName && state.remain !== null) {
                    state.remain -= 1;
                    state.picked.push(countName);
                    rememberRemain(state.target, state.remain);
                    statusState.remain = state.remain;
                    statusState.picked = state.picked.length;
                    updateStatusSoon();
                } else if (now - lastDebugLog > 1500) {
                    lastDebugLog = now;
                }
                await sleep(160);
                acted = true;
                break;
            }
            if (!acted) await sleep(80);
        } catch (e) {

            if (isCancelError(e)) return;
            log.debug("拾取识别异常: {0}", e.toString());
        } finally {
            try {
                if (frame && frame.dispose) frame.dispose();
            } catch (e) {

            }
        }
        if (state.remain !== null && state.remain <= 0) return;
    }
}

function loadMonsterDropMap() {
    const monsterToDrops = {};
    const dropToMonsters = {};
    try {
        const text = readTextSync("assets/怪物掉落.txt");
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim().replace(/^-\s*/, "");
            if (!line || line.startsWith("#")) continue;
            const sepIndex = line.search(/[：:]/);
            if (sepIndex <= 0) continue;
            const monsterPart = line.slice(0, sepIndex).trim();
            const dropPart = line.slice(sepIndex + 1).trim();
            if (!monsterPart || !dropPart) continue;
            const monsters = monsterPart.split("/").map((s) => s.trim()).filter((s) => s);
            const drops = dropPart.split(/[，,、;；\s]+/).map((s) => s.trim()).filter((s) => s);
            for (const monster of monsters) {
                if (!monsterToDrops[monster]) monsterToDrops[monster] = [];
                for (const drop of drops) {
                    if (!monsterToDrops[monster].includes(drop)) monsterToDrops[monster].push(drop);
                }
            }
            for (const drop of drops) {
                if (!dropToMonsters[drop]) dropToMonsters[drop] = new Set();
                for (const monster of monsters) dropToMonsters[drop].add(monster);
            }
        }
        log.debug("怪物掉落表已加载: {0}种怪物 / {1}种掉落物", Object.keys(monsterToDrops).length, Object.keys(dropToMonsters).length);
    } catch (e) {
        log.warn("读取怪物掉落表失败，将只能使用怪物名或材料名: {0}", e.toString());
    }
    return { monsterToDrops, dropToMonsters };
}

function loadEnemyRefreshRules() {
    const rules = [];
    try {
        const text = readTextSync("assets/敌人刷新规则.txt");
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) continue;
            const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
            if (!match) continue;
            const cd = match[1].trim();
            const words = match[2]
                .trim()
                .split(/\s+/)
                .filter((w) => w);
            if (cd && words.length > 0) rules.push({ cd: cd, words: words });
        }
    } catch (e) {
        log.debug("读取敌人刷新规则失败，使用内置默认规则: {0}", e.toString());
    }
    if (rules.length === 0) {
        rules.push({ cd: "12小时", words: ["默认"] });
    }
    return rules;
}

function getEnemyRefreshMode(monsterName) {
    for (const rule of enemyRefreshRules) {
        if (rule.words.includes("默认")) continue;
        if (rule.words.some((w) => monsterName.includes(w))) return rule.cd;
    }
    const fallback = enemyRefreshRules.find((rule) => rule.words.includes("默认"));
    return fallback ? fallback.cd : "每天4点";
}

function scanAndFilterJsonFiles(folderPath) {
    const jsonFiles = getFilesInAutoPathing(folderPath);
    jsonFiles.sort((a, b) => a.localeCompare(b, "zh", { numeric: true }));
    return jsonFiles;
}

async function buildMaterialIndex() {
    const index = {};

    const addPath = (type, name, path) => {
        if (!name) return;
        let entry = index[name];
        if (!entry) {
            entry = { name: name, type: type, paths: [], cdType: null };
            index[name] = entry;
        } else if (entry.type !== type && !entry.type.split("/").includes(type)) {
            entry.type = entry.type + "/" + type;
        }
        if (!entry.paths.includes(path)) entry.paths.push(path);
        if (!entry.cdType) entry.cdType = getCdTypeOf(name, path);
    };

    let specialtyFiles = [];
    try {
        specialtyFiles = scanAndFilterJsonFiles("地方特产");
    } catch (e) {
        log.debug("扫描地方特产路线失败: {0}", e.toString());
    }
    for (const path of specialtyFiles) {
        const parts = path.split("\\");
        const idx = parts.indexOf("地方特产");
        const specialty = idx === -1 ? null : parts[idx + 2];
        if (specialty) addPath("地方特产", specialty, path);
    }

    const otherCategories = ["食材与炼金", "矿物", enemyCategory];
    for (const category of otherCategories) {
        let jsonFiles = [];
        try {
            jsonFiles = scanAndFilterJsonFiles(category);
        } catch (e) {
            log.debug("扫描{0}路线失败: {1}", category, e.toString());
            continue;
        }
        const grouped = await groupByMaterialName(jsonFiles);
        for (const [name, paths] of Object.entries(grouped)) {

            if (category === "矿物" && name === "魔晶矿") continue;
            for (const path of paths) addPath(category, name, path);
        }
    }

    for (const entry of Object.values(index)) {
        if (!entry.cdType) {
            entry.cdType = unknownCd;
            log.info("未获取到{0}的刷新机制，暂按{1}处理", entry.name, unknownCd);
        }
    }
    log.info("路线扫描完成: 共{0}种材料/怪物", Object.keys(index).length);
    return index;
}

function getCdTypeOf(name, path) {
    let cdType = getItemCD(name);
    if (cdType !== null) return cdType;
    if (path.includes("地方特产")) return "46小时";
    if (path.split("\\")[0] === enemyCategory) return getEnemyRefreshMode(name);
    return null;
}

async function groupByMaterialName(jsonFiles) {
    const materialPathMap = {};
    const separator = "\\";
    for (const path of jsonFiles) {
        const parts = path.split(separator);
        if (parts.length > 1 && parts[1]) {
            (materialPathMap[parts[1]] || (materialPathMap[parts[1]] = [])).push(path);
        }
    }
    return materialPathMap;
}

function writeMaterialListFile(index) {
    const groups = {};
    for (const entry of Object.values(index)) {
        const type = entry.type.split("/")[0];
        (groups[type] || (groups[type] = [])).push(entry);
    }
    const lines = [
        "可选材料/怪物名单",
        "在脚本配置的“采集目标”里直接输入下列名称即可，格式: 名称*数量+名称*数量",
        "也可以输入怪物掉落物名（如 史莱姆凝液*50），脚本会自动找到掉落它的怪物路线",
        "",
    ];
    for (const [type, entries] of Object.entries(groups)) {
        entries.sort((a, b) => a.name.localeCompare(b.name, "zh"));
        lines.push(`【${type}】共${entries.length}种`);
        for (const entry of entries) {
            const drops = entry.type.split("/").includes(enemyCategory) ? monsterToDrops[entry.name] : null;
            const dropText = drops && drops.length > 0 ? `\t掉落: ${drops.join("/")}` : "";
            lines.push(`  ${entry.name}\tCD: ${entry.cdType}\t${entry.paths.length}条路线${dropText}`);
            const versions = Object.keys(versionGroupsOf(entry)).sort((a, b) => a.localeCompare(b, "zh", { numeric: true }));
            if (versions.length > 1) {
                lines.push(`      版本(配置里可勾选): ${versions.join(" / ")}`);
            }
        }
        lines.push("");
    }
    try {
        const content = lines.join("\n");

        if (!file.IsExists("可选材料名单.txt") || readTextSync("可选材料名单.txt") !== content) {
            file.writeTextSync("可选材料名单.txt", content);
        }
    } catch (e) {
        log.debug("写入材料名单文件失败: {0}", e.toString());
    }
}

function parseTargets(text) {
    if (!text) return [];
    const result = [];
    const segments = String(text)
        .split(/[+＋]/)
        .map((s) => s.trim())
        .filter((s) => s);
    for (const segment of segments) {
        const parsed = parseOneTarget(segment);
        if (parsed.name) result.push(parsed);
    }
    return result;
}

function parseOneTarget(segment) {
    let name = segment.trim();
    let count = null;
    const countMatch = name.match(/^([^*×✕]+?)\s*[*×✕xX]\s*(\d+)$/);
    if (countMatch) {
        name = countMatch[1].trim();
        count = parseInt(countMatch[2], 10);
    }
    let allVersions = false;
    if (/#all$/i.test(name)) {
        allVersions = true;
        name = name.replace(/#all$/i, "").trim();
    }
    return { name: name, count: count, allVersions: allVersions };
}

function formatTarget(target) {
    return target.count === null ? target.name : `${target.name}*${target.count}`;
}

function countingNamesOfEntry(entryName, index) {
    const entry = index[entryName];
    const isEnemy = entry && entry.type.split("/").includes(enemyCategory);
    if (isEnemy) {
        const drops = monsterToDrops[entryName] || [];
        if (drops.length > 0) return drops.slice();
        log.warn("{0} 在掉落表里没有对应掉落物，数量目标将按“完成一条路线计1”统计", entryName);
        return [];
    }
    return [obtainedNameMap[entryName] || entryName];
}

function matchEntryStrict(name, index) {
    if (index[name]) return index[name];

    const alias = materialAliases[name];
    if (alias && index[alias]) return index[alias];

    const lastSegment = name.split(/[\\/]+/).filter((s) => s).pop();
    if (lastSegment && lastSegment !== name && index[lastSegment]) return index[lastSegment];
    return null;
}

function matchEntryFuzzy(name, index) {
    const candidates = Object.keys(index).filter((key) => key.includes(name) || name.includes(key));
    if (candidates.length === 1) {
        log.info("名称{0}模糊匹配为{1}", name, candidates[0]);
        return index[candidates[0]];
    }
    if (candidates.length > 1) {
        log.warn("名称{0}存在多个候选: {1}，请填写完整名称", name, candidates.join(", "));
    }
    return null;
}

function monsterEntries(monsterName, index) {
    const result = [];
    const push = (name) => {
        if (index[name] && !result.some((e) => e.name === name)) result.push(index[name]);
    };
    push(monsterName);
    const aliases = monsterNameAliases[monsterName] || [];
    for (const alias of aliases) push(alias);
    if (result.length > 0) return result;
    for (const name of Object.keys(index)) {
        if (!index[name].type.split("/").includes(enemyCategory)) continue;
        if (name.includes(monsterName) || monsterName.includes(name)) push(name);
    }
    return result;
}

function resolveTarget(inputName, index) {

    const strict = matchEntryStrict(inputName, index);
    if (strict) {
        return { entries: [strict], countNames: countingNamesOfEntry(strict.name, index) };
    }

    const monsters = dropToMonsters[inputName] ? Array.from(dropToMonsters[inputName]) : [];
    if (monsters.length > 0) {
        const matched = [];
        for (const monster of monsters) {
            for (const item of monsterEntries(monster, index)) {
                if (!matched.some((m) => m.name === item.name)) matched.push(item);
            }
        }
        if (matched.length > 0) {
            log.info(
                "掉落物 {0} 由怪物 {1} 掉落，将执行其 {2} 条路线",
                inputName,
                matched.map((m) => m.name).join("、"),
                matched.reduce((sum, m) => sum + m.paths.length, 0)
            );
            return { entries: matched, countNames: [inputName] };
        }
    }

    const fuzzy = matchEntryFuzzy(inputName, index);
    if (fuzzy) {
        return { entries: [fuzzy], countNames: countingNamesOfEntry(fuzzy.name, index) };
    }

    if (monsters.length > 0) {
        log.warn("掉落物 {0} 对应的怪物（{1}）在已订阅路线里找不到，请先订阅对应怪物路线", inputName, monsters.join("、"));
        return null;
    }
    log.error("未找到路线: {0}，请检查名称或先订阅对应路线（可查阅脚本目录下的 可选材料名单.txt）", inputName);
    return null;
}

function pickRoutePaths(entry, target) {
    const groups = versionGroupsOf(entry);
    const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh", { numeric: true }));
    if (keys.length <= 1) return entry.paths;

    let chosen = [];
    if (target.allVersions) {
        chosen = keys;
        log.info("{0}有{1}组路线版本，目标写了 #all，使用全部版本", entry.name, keys.length);
    } else {
        chosen = getSelectedVersionKeys(entry, keys);
        if (chosen.length === 0) {
            chosen = [keys[0]];
            log.info("{0}有{1}组路线版本，未勾选版本，只使用第一组: {2}", entry.name, keys.length, keys[0]);
        } else {
            log.info("{0}有{1}组路线版本，使用勾选的: {2}", entry.name, keys.length, chosen.join("、"));
        }
    }
    const paths = [];
    for (const key of chosen) {
        for (const path of groups[key]) {
            if (!paths.includes(path)) paths.push(path);
        }
    }
    return paths;
}

function getSelectedVersionKeys(entry, keys) {
    const settingName = "selectRoute_" + entry.name;
    let value = null;
    try {
        value = cfg[settingName];
    } catch (e) {
        value = null;
    }
    if (!value) return [];
    const picked = Array.isArray(value) ? value.slice() : Array.from(value);
    if (picked.length === 0) return [];
    const result = [];
    for (const item of picked) {
        const name = String(item);
        if (keys.includes(name)) {
            if (!result.includes(name)) result.push(name);
            continue;
        }

        const fuzzy = keys.filter((key) => key.includes(name) || name.includes(key));
        for (const key of fuzzy) {
            if (!result.includes(key)) result.push(key);
        }
    }
    return result.sort((a, b) => a.localeCompare(b, "zh", { numeric: true }));
}

function versionGroupsOf(entry) {
    // 材料目录下一级子目录就算一个版本
    const groups = {};
    for (const path of entry.paths) {
        const dir = path.substring(0, path.lastIndexOf("\\"));
        const segments = dir.split("\\");
        const nameIndex = segments.lastIndexOf(entry.name);
        let key = "(本目录)";
        if (nameIndex >= 0 && segments.length > nameIndex + 1) key = segments[nameIndex + 1];
        (groups[key] || (groups[key] = [])).push(path);
    }
    return groups;
}

function sortRoutesInOrder(paths) {
    return [...paths].sort((a, b) => basename(a).localeCompare(basename(b), "zh", { numeric: true }));
}

function recordSlugOf(jsonPath) {
    const parts = jsonPath.split("\\");
    const dirPath = parts.slice(0, parts.length - 1).join("\\");
    return dirPath.replace(/[^\u4e00-\u9fa5\w]+/g, "_");
}

function recordPathOf(jsonPath) {
    return recordRoot + "\\" + account + "\\" + recordSlugOf(jsonPath) + ".txt";
}

function loadRecord(recordFile) {
    if (recordCache[recordFile]) return recordCache[recordFile];
    const map = {};
    let text = "";
    if (file.isExists(recordFile)) {
        try {
            text = readTextSync(recordFile);
        } catch (e) {
            log.debug("读取运行记录失败: {0}", e.toString());
        }
    } else {

        try {
            const legacy = recordFile.replace(recordRoot + "\\", legacyRecordRoot + "/").replace(/\\/g, "/");
            if (file.isExists(legacy)) {
                text = readTextSync(legacy);
                ensureRecordDir(recordRoot + "\\" + account);
                file.writeTextSync(recordFile, text);
                log.info("已把旧运行记录迁移到 {0}", recordFile);
            }
        } catch (e) {
            log.debug("迁移旧运行记录失败: {0}", e.toString());
        }
    }
    if (text) {
        for (const line of text.split("\n")) {
            const pair = line.trim().split("\t");
            if (pair.length >= 2) map[pair[0]] = new Date(pair[1]);
        }
    }
    recordCache[recordFile] = map;
    return map;
}

function getNextRefreshTime(jsonPath) {
    const map = loadRecord(recordPathOf(jsonPath));
    return map[basename(jsonPath)] || defaultTime;
}

function setNextRefreshTime(jsonPath, refreshTime) {
    const recordFile = recordPathOf(jsonPath);
    const map = loadRecord(recordFile);
    map[basename(jsonPath)] = refreshTime;
    const lines = [];
    for (const [name, time] of Object.entries(map)) {
        lines.push(`${name}\t${formatDateTime(time)}`);
    }
    ensureRecordDir(recordRoot + "\\" + account);
    file.writeTextSync(recordFile, lines.join("\n"));
}

function notifyRouteStart(targetName, pathName, remain, routeMaterial) {
    if (!cfg.routeNotify) return;

    let target = targetName || "无";

    if (targetName && routeMaterial && targetName !== routeMaterial) target += `（路线: ${routeMaterial}）`;
    let msg = `当前执行路径：${pathName}\n目标：${target}`;
    if (remain !== null && remain !== undefined) msg += `（剩余 ${remain}）`;
    try {
        if (typeof notification === "undefined" || !notification) return;
        if (typeof notification.Send === "function") {
            notification.Send(msg);
        } else if (typeof notification.send === "function") {
            notification.send(msg);
        }
    } catch (e) {
        log.debug("发送路线通知失败: {0}", e.toString());
    }
}

async function runTarget(target, index) {
    const resolved = resolveTarget(target.name, index);
    if (!resolved) return;
    const entries = resolved.entries;

    let remain = null;
    if (target.count !== null && !unlimitedMaterials.includes(target.name) && !unlimitedMaterials.includes(entries[0].name)) {
        remain = target.count;
    }
    if (remain === 0) {
        log.info("{0}的目标数量为0，跳过", target.name);
        return;
    }

    const state = {
        running: true,
        remain: remain,
        countNames: resolved.countNames,
        picked: [],
        target: target,
        fallbackRouteCount: remain !== null && (!pickupCounterReady || resolved.countNames.length === 0),
    };
    if (state.fallbackRouteCount) {
        log.warn("{0} 无法按拾取物品计数，本次数量按“完成一条路线计1”统计", target.name);
    }

    statusState.active = true;
    statusState.material = entries[0] ? entries[0].name : target.name;
    statusState.targetName = target.name;
    statusState.targetCount = state.remain;
    statusState.remain = state.remain;
    statusState.picked = 0;
    statusState.routeName = "";
    statusState.routeIndex = 0;
    statusState.routeTotal = 0;
    statusState.note = "";
    updateStatusSoon();

    let watcher = null;
    if (pickupCounterReady) watcher = runPickupWatcher(state);

    let executed = 0;
    let planned = 0;
    try {
        for (const entry of entries) {
            if (state.remain !== null && state.remain <= 0) break;
            const paths = pickRoutePaths(entry, target);
            if (paths.length === 0) continue;
            const cdType = entry.cdType || unknownCd;
            log.info(
                "【{0}】{1}，{2}条路线，刷新机制 {3}{4}",
                entry.name,
                entry.type,
                paths.length,
                cdType,
                state.remain === null ? "" : `，目标 ${state.remain} 个`
            );

            const available = sortRoutesInOrder(paths.filter((p) => Date.now() > getNextRefreshTime(p)));
            if (available.length === 0) {
                log.info("{0}的路线全部处于CD中，跳过，采集下一个", entry.name);
                continue;
            }
            const skippedCount = paths.length - available.length;
            if (skippedCount > 0) log.info("{0}有{1}条路线处于CD中，已跳过", entry.name, skippedCount);

            planned += available.length;
            for (const jsonPath of available) {
                if (state.remain !== null && state.remain <= 0) break;
                if (stopAtTime && isTargetTimeReached(stopAtTime)) {
                    throw new ReachStopTime("达到设置的停止时间，终止运行");
                }
                statusState.routeName = basename(jsonPath);
                statusState.routeIndex = available.indexOf(jsonPath) + 1;
                statusState.routeTotal = available.length;
                statusState.remain = state.remain;
                statusState.picked = state.picked.length;
                updateStatusSoon();
                const result = await runOneRoute(entry.name, jsonPath, cdType, state.remain, target.runAll ? null : target.name);
                if (!result.moved) continue;

                executed++;
                if (state.remain !== null && state.fallbackRouteCount) {
                    state.remain -= 1;
                    rememberRemain(state.target, state.remain);
                    statusState.remain = state.remain;
                    statusState.picked = state.picked.length;
                    updateStatusSoon();
                }
            }
        }
    } finally {
        state.running = false;
        if (watcher) {
            try {
                await withTimeout(watcher, 8000, "拾取识别收尾");
            } catch (e) {
                log.debug("结束拾取识别任务时出错: {0}", e.toString());
            }
        }

        if (state.remain !== null) {
            if (state.picked.length > 0) {
                log.info("【{0}】本次实际拾取 {1} 个: {2}", target.name, state.picked.length, summarizePicked(state.picked));
            }
            if (state.remain <= 0) {
                log.info("【{0}】已达成目标数量，采集下一个材料", target.name);
                rememberRemain(target, 0);
            } else {
                log.info(
                    "【{0}】可用路线已全部执行完（本次{1}条），剩余{2}个，采集下一个材料",
                    target.name,
                    executed,
                    state.remain
                );
                rememberRemain(target, state.remain);
            }
        } else if (planned === 0) {
            log.info("{0} 没有可执行的路线，跳过", target.name);
        }
    }
}

function summarizePicked(picked) {
    const counter = {};
    for (const name of picked) counter[name] = (counter[name] || 0) + 1;
    return Object.keys(counter)
        .map((name) => `${name}x${counter[name]}`)
        .join("、");
}

function rememberRemain(target, remain) {
    if (!target || target.count === null) return;
    pendingRemains[target.name] = Math.max(0, remain);
}

function syncTargetRemainBeforePanel() {
    try {
        if (Object.keys(pendingRemains).length > 0) {
            flushTargetItems();
            log.info("打开配置面板前：已同步写入采集目标剩余数量");
        }
    } catch (e) {
        log.debug("打开面板前写入剩余数量失败（忽略）: {0}", e && e.message ? e.message : String(e));
    }
}

function flushTargetItems() {
    const names = Object.keys(pendingRemains);
    if (names.length === 0) return;
    const raw = String(cfg.targetItems || "");
    const segments = raw
        .split(/[+＋]/)
        .map((s) => s.trim())
        .filter((s) => s);
    const kept = [];
    for (const segment of segments) {
        const parsed = parseOneTarget(segment);
        if (!pendingRemains.hasOwnProperty(parsed.name)) {
            kept.push(segment);
            continue;
        }
        const remain = pendingRemains[parsed.name];
        if (remain > 0) kept.push(`${parsed.name}${parsed.allVersions ? "#all" : ""}*${remain}`);
    }
    cfg.targetItems = kept.join("+");
    persistPanelConfig();
    log.info("已把剩余采集数量写回配置: {0}", cfg.targetItems || "（全部完成，采集目标已清空）");
    pendingRemains = {};
}

async function runOneRoute(materialName, jsonPath, cdType, remain, displayName) {
    await waitBeforeNextRoute();
    const fileName = basename(jsonPath);
    const pathName = fileName.split(".")[0];
    const isEnemyRoute = jsonPath.split("\\")[0] === enemyCategory;
    const animalRoute = isAnimalRoute(jsonPath);
    const miningRoute = jsonPath.split("\\")[0] === miningCategory;
    // linnea_mining 只有莉奈娅本人能放
    const linneaMiningRoute = miningRoute && scanRouteActionSet(jsonPath).includes(linneaMiningAction);

    if (!isEnemyRoute && cfg.partyNameCombat && currentParty === cfg.partyNameCombat && cfg.partyName && worldInfo && !worldInfo.coOpMode) {
        log.debug("采集中：从战斗队伍切回采集队伍{0}", cfg.partyName);
        const backResult = await withTimeout(switchPartySafely(cfg.partyName), 90000, "切回采集队伍");
        if (backResult.ok) {
            currentParty = cfg.partyName;
            if (backResult.value) currentMap = "Teyvat";
            partyAbility[currentParty] = calculateAvatarsAbility(getAvatars());
        } else {
            log.warn("切回采集队伍未正常返回，继续执行");
        }
    }

    if (isEnemyRoute && cfg.partyNameCombat && worldInfo && !worldInfo.coOpMode && currentParty !== cfg.partyNameCombat) {
        log.debug("该路线为战斗路线，切换到战斗队伍{0}", cfg.partyNameCombat);
        const combatResult = await withTimeout(switchPartySafely(cfg.partyNameCombat), 90000, "切换战斗队伍");
        const combatTeleported = combatResult.ok ? combatResult.value : false;
        if (!combatResult.ok) {
            log.warn("切换战斗队伍未正常返回，跳过这条敌人路线");
            return { moved: false };
        }
        currentParty = cfg.partyNameCombat;
        if (combatTeleported) currentMap = "Teyvat";
    }

    if (!(currentParty in partyAbility)) {
        partyAbility[currentParty] = calculateAvatarsAbility(getAvatars());
    }
    const knownAbilities = Object.values(collectAbility);
    const specialMethods = scanSpecialCollectMethod([jsonPath]);
    const requiredAbilities = specialMethods.filter((method) => knownAbilities.includes(method));
    const missingAbilities = requiredAbilities.filter((element) => !partyAbility[currentParty].includes(element));
    if (requiredAbilities.length > 0) log.debug("所需角色: {0}", requiredAbilities.join(", "));
    if (missingAbilities.length > 0 && worldInfo && !worldInfo.coOpMode) {
        const candidates = partyCandidates(currentParty);
        if (candidates.length === 0) {
            log.warn("当前队伍缺少该路线要求的采集角色，且用户未配置其它采集队伍，跳过路线");
            return { moved: false };
        }
        let satisfied = false;
        for (const newParty of candidates) {
            log.info("当前队伍{0}缺少该路线所需角色{1}，尝试切换到{2}", currentParty, missingAbilities.join(", "), newParty);
            const switchResult = await withTimeout(switchPartySafely(newParty), 90000, "切换采集队伍");
            if (!switchResult.ok) {
                log.warn("切换采集队伍{0}未正常返回，跳过路线", newParty);
                return { moved: false };
            }
            currentParty = newParty;
            if (switchResult.value) currentMap = "Teyvat";
            partyAbility[newParty] = calculateAvatarsAbility(getAvatars());
            const stillMissing = requiredAbilities.filter((element) => !partyAbility[newParty].includes(element));
            if (stillMissing.length === 0) {
                satisfied = true;
                break;
            }
            log.warn("队伍{0}也缺少该路线所需角色{1}", newParty, stillMissing.join(", "));
        }
        if (!satisfied) {
            log.warn("所有采集队伍都缺少该路线所需角色，跳过路线");
            return { moved: false };
        }
    }

    if (!isEnemyRoute && worldInfo && !worldInfo.coOpMode) {
        if (animalRoute) {
            await ensurePartyWithChars(nonScaringCharacters(), "食材打动物");
        } else if (miningRoute) {

            await ensurePartyWithChars(miningPreferredChars(jsonPath), linneaMiningRoute ? "莉奈娅挖矿" : "挖矿");
        }
    }

    const assistCfg = getPartyAssistConfig(currentParty);
    let walkSlot = assistCfg.walkSlot;
    if (miningRoute) {
        const miningSlot = findCharacterSlot(miningPreferredChars(jsonPath), safeGetAvatars());
        if (miningSlot) {
            walkSlot = miningSlot;
        } else if (linneaMiningRoute) {
            log.warn("这条路线用的是莉奈娅挖矿动作（linnea_mining），但当前队伍里没有莉奈娅，矿石可能挖不动");
        }
    }
    if (walkSlot) {
        keyPress(String(walkSlot));
        await sleep(300);
    }

    if (isTaskCancelled()) throw new UserCancelled("任务已被停止");

    log.debug("{0}: 开始执行", pathName);
    notifyRouteStart(displayName, pathName, remain, materialName);
    const pathStart = logFakePathStart(fileName);
    const startPosResult = await withTimeout(genshin.getPositionFromMap(currentMap), 15000, "读取起始坐标");
    const pathStartPos = startPosResult.ok ? startPosResult.value : null;
    const pathStartTime = new Date();

    const healEnabled = !!assistCfg.healSlot && !(worldInfo && worldInfo.coOpMode);
    const healState = { running: healEnabled, lastCast: 0 };
    if (healState.running) {
        startHealWatcher(healState, walkSlot, assistCfg);
        log.info("回血位已启用：槽位{0}，技能{1}，冷却{2}秒", assistCfg.healSlot, assistCfg.skill, Math.round(assistCfg.cdMs / 1000));
    }
    try {

    panelService.routeRunning = true;
    panelService.abortedRoute = false;
    const pathPromise = pathingScript.runFileFromUser(jsonPath)
        .then((value) => ({ error: null, value: value }))
        .catch((e) => ({ error: e && e.message ? e.message : e.toString(), value: null }));

    const outcome = await racePathOutcome(pathPromise);

    healState.running = false;

    if (outcome.kind === "cancel") {
        logFakePathEnd(fileName, pathStart);
        throw new UserCancelled("任务已被停止（停止快捷键/BGI停止）");
    }

    const pathError = outcome.result.error;

    if ((pathError && isUserCancelMessage(pathError)) || isTaskCancelled()) {
        logFakePathEnd(fileName, pathStart);
        throw new UserCancelled(pathError || "任务已被停止");
    }

    if (panelService.abortedRoute) {
        panelService.abortedRoute = false;
        log.info("{0}: 因打开配置面板中断，本条不记 CD、不扣采集数量", pathName);
        logFakePathEnd(fileName, pathStart);
        return { moved: false, aborted: true };
    }

    if (pathError) {
        const refreshTime = calculateNextRefreshTime(new Date(), cdType);
        setNextRefreshTime(jsonPath, refreshTime);
        log.warn("{0}: 路线异常（{1}），已跳过并记录CD（下次刷新 {2}），继续执行后面的路线", pathName, pathError, formatDateTimeShort(refreshTime));
        logFakePathEnd(fileName, pathStart);
        return { moved: false };
    }

    await safeReturnMainUi();

    const endPosResult = await withTimeout(genshin.getPositionFromMap(currentMap), 15000, "读取结束坐标");
    const pathEndPos = endPosResult.ok ? endPosResult.value : null;
    let distance = calculateDistance(pathStartPos, pathEndPos);
    if (distance === null) {
        const timeDiff = (new Date() - pathStartTime) / 1000;
        if (timeDiff > 10) {
            log.warn("无法获取位置坐标，基于路径耗时更新刷新时间");
            distance = 20928;
        } else {
            log.warn("无法获取位置坐标，路径耗时较短，不更新刷新时间");
        }
    }

    if (distance >= 5) {
        // 位移太小说明路线没真正跑起来，不记 CD
        try {
            const jsonData = readRouteJson(jsonPath);
            const jsonRegion = jsonData.info?.map_name || "Teyvat";
            if (jsonRegion !== currentMap) {
                log.debug("当前地图区域: {0}", currentMap);
                currentMap = jsonRegion;
            }
        } catch (e) {
            log.debug("读取路线地图信息失败: {0}", e.toString());
        }
        const refreshTime = calculateNextRefreshTime(new Date(), cdType);
        setNextRefreshTime(jsonPath, refreshTime);
        log.debug("{0}: 已完成，下次刷新: {1}", pathName, formatDateTimeShort(refreshTime));
    } else {
        log.debug("{0}: 位置几乎未变化，不更新刷新时间", pathName);
    }
    logFakePathEnd(fileName, pathStart);
    return { moved: distance >= 5 };
    } finally {
        panelService.routeRunning = false;
        healState.running = false;

        if (panelService.pendingOpen && !panelService.panelId) {
            panelService.pendingOpen = false;
            panelService.openRequested = true;
        }
    }
}

const routeJsonCache = {};
function readRouteJson(jsonPath) {
    if (routeJsonCache[jsonPath]) return routeJsonCache[jsonPath];
    const data = JSON.parse(pathingScript.readTextSync(jsonPath));
    routeJsonCache[jsonPath] = data;
    return data;
}

function isUserCancelMessage(message) {
    return /取消|停止|中止|取消任务|cancel|stopped|abort/i.test(String(message || ""));
}

async function racePathOutcome(pathPromise) {
    let finished = false;
    const monitor = (async () => {
        while (!finished) {
            if (isTaskCancelled()) return { kind: "cancel" };
            await sleep(1000);
        }
        return { kind: "idle" };
    })();
    const outcome = await Promise.race([pathPromise.then((result) => ({ kind: "path", result: result })), monitor]);
    finished = true;
    return outcome;
}

function scanSpecialCollectMethod(jsonFiles) {
    const actions = jsonFiles.flatMap((filePath) => {
        try {
            const data = readRouteJson(filePath);
            return data.positions
                .map((p) => p.action)
                .filter((a) => a)
                .map((a) => collectAbility[a] ?? a);
        } catch (e) {
            log.warn("json文件无效: {0}: {1}", filePath, e.message);
            return [];
        }
    });
    return [...new Set(actions)];
}

function calculateAvatarsAbility(avatars) {
    const elements_map = JSON.parse(readTextSync("assets/avatar_elements.json"));
    const avatar2element = {};
    for (const key in elements_map) {
        if (elements_map.hasOwnProperty(key)) {
            elements_map[key].forEach((ele) => {
                avatar2element[ele] = key;
            });
        }
    }
    const abilitySet = new Set();
    for (const avatar of avatars) {
        if (avatar === "纳西妲") abilitySet.add(avatar);
        const element = avatar2element[avatar];
        if (element) abilitySet.add(element);
    }
    return [...abilitySet];
}

const defaultNonScaringChars = "埃洛伊,绮良良,早柚,瑶瑶";

const animalRouteActions = ["fight", "combat_script"];

const critterPathKeywords = ["晶蝶", "晶核"];
const healHoldMs = 1200;
const routeActionsCache = {};

function splitNames(text) {
    return String(text || "")
        .split(/[,，、;；\s]+/)
        .map((s) => s.trim())
        .filter((s) => s);
}

function nonScaringCharacters() {
    const names = splitNames(cfg.animalCharNames || defaultNonScaringChars);
    return names.length > 0 ? names : splitNames(defaultNonScaringChars);
}

function safeGetAvatars() {
    try {
        return getAvatars() || [];
    } catch (e) {
        log.debug("读取当前队伍角色失败: {0}", e && e.message ? e.message : String(e));
        return [];
    }
}

function findCharacterSlot(names, avatars) {
    const list = avatars || safeGetAvatars();
    for (let i = 0; i < list.length; i++) {
        if (names.includes(list[i])) return i + 1;
    }
    return null;
}

function defaultMiningCharacters() {
    const list = [];
    try {
        const text = readTextSync("assets/挖矿角色.txt");
        for (const line of String(text || "").split(/\r?\n/)) {
            const s = line.trim();
            if (!s || s.startsWith("#")) continue;
            list.push(...splitNames(s));
        }
    } catch (e) {
        log.debug("读取挖矿角色名单失败: {0}", e && e.message ? e.message : String(e));
    }
    try {
        const map = JSON.parse(readTextSync("assets/avatar_elements.json"));
        if (map && Array.isArray(map["岩"])) list.push(...map["岩"]);
    } catch (e) {
        log.debug("读取岩元素角色失败: {0}", e && e.message ? e.message : String(e));
    }
    return [...new Set(list)];
}

function miningPriorityCharacters() {
    const typed = splitNames(cfg.miningCharNames);
    return typed.length > 0 ? typed : defaultMiningCharacters();
}

function miningPreferredChars(jsonPath) {
    const actions = scanRouteActionSet(jsonPath);
    if (actions.includes(linneaMiningAction)) return [linneaMiningChar];
    return miningPriorityCharacters();
}

function configuredParties() {
    const list = [cfg.partyName, cfg.partyName2nd, cfg.partyName3rd]
        .map((s) => String(s || "").trim())
        .filter((s) => s);
    return [...new Set(list)];
}

function partyCandidates(partyName) {
    return configuredParties().filter((p) => p !== partyName);
}

function getPartyAssistConfig(partyName) {
    let key = "Main";
    if (cfg.partyName2nd && partyName === cfg.partyName2nd) key = "Second";
    else if (cfg.partyName3rd && partyName === cfg.partyName3rd) key = "Third";
    else if (cfg.partyNameCombat && partyName === cfg.partyNameCombat) key = "Combat";
    const toSlot = (value) => {
        const n = parseInt(String(value || ""), 10);
        return n >= 1 && n <= 4 ? n : null;
    };
    const skillRaw = String(cfg["healSkill" + key] || "E（短按）");
    const skill = /Q/i.test(skillRaw) ? "Q" : /长按/.test(skillRaw) ? "E长按" : "E短按";
    let cdSec = parseFloat(String(cfg["healCd" + key] || "").replace(/[^\d.]/g, ""));
    if (!isFinite(cdSec) || cdSec <= 0) cdSec = 8;
    if (cdSec < 1) cdSec = 1;
    return {

        walkSlot: key === "Combat" ? null : toSlot(cfg["walkSlot" + key]) || 1,
        healSlot: toSlot(cfg["healSlot" + key]),
        skill: skill,
        cdMs: cdSec * 1000,
    };
}

function scanRouteActionSet(jsonPath) {
    if (!routeActionsCache[jsonPath]) {
        try {
            const data = readRouteJson(jsonPath);
            routeActionsCache[jsonPath] = [...new Set((data.positions || []).map((p) => p.action).filter((a) => a))];
        } catch (e) {
            routeActionsCache[jsonPath] = [];
        }
    }
    return routeActionsCache[jsonPath];
}

function isAnimalRoute(jsonPath) {
    if (jsonPath.split("\\")[0] !== "食材与炼金") return false;
    const pathText = jsonPath.replace(/\\/g, "/");
    if (critterPathKeywords.some((k) => pathText.includes(k))) return true;
    const actions = scanRouteActionSet(jsonPath);
    return animalRouteActions.some((a) => actions.includes(a));
}

async function ensurePartyWithChars(chars, scene) {
    const names = chars || [];
    if (names.length === 0) return null;
    let avatars = safeGetAvatars();
    let slot = findCharacterSlot(names, avatars);
    if (slot) {
        log.debug("{0}：当前队伍{1}含所需角色{2}（槽位{3}）", scene, currentParty, avatars[slot - 1], slot);
        return slot;
    }
    const others = partyCandidates(currentParty);
    if (others.length === 0) {
        log.warn("{0}：当前队伍里没有所需角色（{1}），且未配置其它采集队伍，按当前队伍执行", scene, names.join("/"));
        return null;
    }
    for (const other of others) {
        log.debug("{0}：当前队伍{1}没有所需角色（{2}），尝试切换到{3}", scene, currentParty, names.slice(0, 4).join("/"), other);
        const switchResult = await withTimeout(switchPartySafely(other), 90000, "切换" + scene + "队伍");
        if (!switchResult.ok) {
            log.warn("{0}：切换队伍{1}未正常返回，按当前队伍继续执行", scene, other);
            return null;
        }
        currentParty = other;
        if (switchResult.value) currentMap = "Teyvat";
        partyAbility[other] = calculateAvatarsAbility(getAvatars());
        avatars = safeGetAvatars();
        slot = findCharacterSlot(names, avatars);
        if (slot) {
            log.debug("{0}：已切换到含{1}的队伍{2}，该路线使用角色{1}（槽位{3}）", scene, avatars[slot - 1], other, slot);
            return slot;
        }
        log.warn("{0}：队伍{1}里也没有所需角色", scene, other);
    }
    log.warn("{0}：所有采集队伍都没有所需角色（{1}），按当前队伍{2}执行", scene, names.slice(0, 4).join("/"), currentParty);
    return null;
}

function startHealWatcher(state, walkSlot, cfg) {
    const task = (async () => {
        try {
            while (state.running) {
                await sleep(1000);
                if (!state.running || isTaskCancelled()) break;

                if (panelService.abortedRoute || panelService.stopRequested) continue;
                if (!cfg.healSlot || !cfg.skill) continue;
                if (Date.now() - state.lastCast < cfg.cdMs) continue;
                if (!state.running) break;
                keyPress(String(cfg.healSlot));
                await sleep(400);
                if (!state.running) break;
                if (cfg.skill === "Q") {
                    keyPress("Q");
                } else if (cfg.skill === "E长按") {
                    keyDown("E");
                    await sleep(healHoldMs);
                    keyUp("E");
                } else {
                    keyPress("E");
                }
                state.lastCast = Date.now();
                log.debug("回血位{0}放技能（{1}），切回行走位{2}", cfg.healSlot, cfg.skill, walkSlot);
                await sleep(400);
                if (!state.running) break;
                if (walkSlot) keyPress(String(walkSlot));
            }
        } catch (e) {
            if (!isCancelError(e)) log.debug("回血位监控结束: {0}", e && e.message ? e.message : String(e));
        }
    })();
    return task;
}

async function getCoOpModeAndHostUid() {
    checkStop("识别联机模式前");
    await withTimeout(genshin.returnMainUi(), 6000, "回到主界面");
    checkStop("打开好友界面前");
    keyPress("F2");
    await waitForTextAppear("多人游戏", [130, 20, 129, 57], 6000);
    checkStop("识别联机模式");
    let uid = await getGameAccount(true, false);
    const coOpMode = !(await isTextExistedInRegion("搜索", [1638, 90, 87, 63]));
    if (coOpMode) {
        const btnText = await getTextInRegion([1560, 992, 191, 55]);
        if (btnText === "离开队伍") {
            log.info("当前处于联机模式，且玩家不是房主");
            click(332, 218);
            checkStop("查看玩家资料");
            await recognizeTextAndClick("查看资料", [555, 182, 118, 49]);
            await waitForTextAppear("角色展柜", [1082, 204, 107, 49], 6000);
            await sleep(100);
            uid = await getTextInRegion([623, 192, 118, 37]);
        } else {
            log.info("当前处于联机模式，玩家是房主");
        }
    } else {
        log.info("当前处于单人模式");
    }
    checkStop("关闭好友界面");
    await withTimeout(genshin.returnMainUi(), 6000, "回到主界面");
    const rawUid = String(uid || "").trim();

    const validUid = /^\d{9}$/.test(rawUid);
    const maskUid = validUid ? rawUid.replace(/\d\d(\d{3})\d{4}/, (match, group1) => match.replace(group1, "xxx")) : "";
    return { coOpMode: coOpMode, uid: validUid ? rawUid : "", maskUid: maskUid };
}

