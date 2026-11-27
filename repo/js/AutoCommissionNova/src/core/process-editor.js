/** 委托流程快捷编辑器（HTML 遮罩）。 */
import { isCancellationError } from "../utils/error-utils.js";
import { scanCommissionScopes } from "../loaders/process-scope.js";
import { parseStepLoc } from "../processors/commission-loc-utils.js";
import { collectImpregnableDefensePaths } from "../processors/impregnable-defense-config.js";
import { openPathRecorder } from "./path-recorder.js";
import { PATHS } from "../config/index.js";
import { loadAllBranchConfigs } from "../loaders/branch-config.js";
import { validateAllProcesses } from "../loaders/validate-processes.js";

// Vue 单文件产物由 BetterGI 直接通过 file:// 加载。
const HTML_PATH = "web/process-editor/index.html";
const WINDOW_TAG = "process-editor";
const RECENT_PATH = "Data/process-editor-recents.json";
const MAX_RECENT_FILES = 8;
const CATEGORY_ORDER = ["路径与定位", "交互方法", "战斗与队伍", "流程控制", "自动化与道具", "特定委托对策", "成就分支"];
const STEP_ORDER = [
    "地图追踪",
    "对话", "开启挑战", "在附近交互", "追踪委托",
    "自动战斗", "切换委托队伍", "切换角色",
    "等待", "等待返回主界面", "执行子流程", "按键", "键鼠脚本",
    "自动任务", "使用道具",
    "摧毁哨塔", "摧毁史莱姆气球", "固若金汤", "乐流奔引",
    "成就检测", "用户分支选择",
];

function respond(windowId, requestId, data) {
    const payload = JSON.stringify(data);
    if (typeof htmlMask.respond === "function") htmlMask.respond(windowId, requestId, payload);
    else if (typeof htmlMask.Respond === "function") htmlMask.Respond(windowId, requestId, payload);
    else htmlMask.send(windowId, "/response", JSON.stringify({ requestId, data }));
}

function safePart(value, label) {
    const text = String(value || "").trim();
    if (!text || text === "." || text === ".." || /[\\/:*?"<>|]/.test(text)) {
        throw new Error(label + "包含非法字符或为空");
    }
    return text;
}

function buildPath(scope, fileName) {
    const country = safePart(scope?.country, "国家");
    const typeDir = scope?.typeDir === "Basic" ? "Basic" : scope?.typeDir === "NPC" ? "NPC" : "";
    if (!typeDir) throw new Error("委托类型只能是 Basic 或 NPC");
    const commission = safePart(scope?.commissionName, "委托名");
    const location = safePart(scope?.locationDir, "地点");
    const name = safePart(fileName, "文件名");
    if (!name.toLowerCase().endsWith(".json")) throw new Error("流程文件必须以 .json 结尾");
    return ["process", country, typeDir, commission, location, name].join("/");
}

// 返回当前委托地点的资源根目录，供路径候选和引用解析共用。
function processResourceDir(scope) {
    const typeDir = scope?.typeDir === "Basic" ? "Basic" : scope?.typeDir === "NPC" ? "NPC" : "";
    if (!typeDir) throw new Error("委托类型只能是 Basic 或 NPC");
    return ["process", safePart(scope?.country, "国家"), typeDir, safePart(scope?.commissionName, "委托名"), safePart(scope?.locationDir, "地点")].join("/");
}

// 将等价的相对引用统一为稳定形式，供循环检测和路径解析共用。
function normalizeReferenceValue(reference) {
    return String(reference || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^(?:\.\/)+/, "");
}

// 递归扫描当前委托目录，仅返回含有效坐标点的路径 JSON。
function listPathOptions(scope) {
    const root = processResourceDir(scope);
    const result = [];
    const seen = new Set();
    function visit(dir) {
        for (const entry of Array.from(file.readPathSync(dir) || [])) {
            const normalized = String(entry).replace(/\\/g, "/");
            if (file.isFolder(entry)) visit(normalized);
            else if (/\.json$/i.test(normalized)) {
                try {
                    const value = JSON.parse(file.readTextSync(normalized));
                    if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.positions)
                        || !value.positions.some(point => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))) continue;
                    const relative = normalized.slice(root.length + 1);
                    if (!seen.has(relative)) { seen.add(relative); result.push({ value: relative, label: relative }); }
                } catch (error) {}
            }
        }
    }
    try { if (file.isFolder(root)) visit(root); } catch (error) { log.debug("读取路径候选失败 [{path}]: {err}", root, error.message); }
    return result.sort((a, b) => a.value.localeCompare(b.value, "zh-CN"));
}

// 将前端提交的相对路径限制并解析在当前委托目录内。
function resolvePathReference(scope, relative) {
    const value = normalizeReferenceValue(relative).replace(/^\/+/, "");
    if (!value || value.split("/").some(part => part === ".." || !part)) return null;
    const root = processResourceDir(scope);
    const path = root + "/" + value;
    return path.toLowerCase().endsWith(".json") ? path : null;
}

// 判断解析结果是否满足子流程的最低结构要求。
function isSubProcess(value) {
    return Array.isArray(value) && value.every(step => step && typeof step === "object" && !Array.isArray(step) && Object.hasOwn(step, "type"));
}

// 递归扫描当前委托目录中的合法子流程，并排除正在编辑的文档链。
function listSubProcessOptions(scope, excluded = []) {
    const root = processResourceDir(scope);
    const excludedKeys = new Set(excluded.map(value => normalizeReferenceValue(value).toLowerCase()));
    const result = [];
    function visit(dir) {
        for (const entry of Array.from(file.readPathSync(dir) || [])) {
            const normalized = String(entry).replace(/\\/g, "/");
            if (file.isFolder(entry)) visit(normalized);
            else if (/\.json$/i.test(normalized)) {
                const relative = normalized.slice(root.length + 1);
                if (excludedKeys.has(relative.toLowerCase())) continue;
                try {
                    if (isSubProcess(JSON.parse(file.readTextSync(normalized)))) result.push({ value: relative, label: relative });
                } catch (error) {}
            }
        }
    }
    try { if (file.isFolder(root)) visit(root); } catch (error) { log.debug("读取子流程候选失败 [{path}]: {err}", root, error.message); }
    return result.sort((a, b) => a.value.localeCompare(b.value, "zh-CN"));
}

// 创建目标文件的父目录，允许新子流程保存到多层目录。
function ensureParentDir(path) {
    const parent = processDir(path);
    if (!file.isFolder(parent) && !file.createDirectory(parent)) throw new Error("无法创建目录：" + parent);
}

function readRecentFiles() {
    if (!file.isFile(RECENT_PATH)) return [];
    try {
        const parsed = JSON.parse(file.readTextSync(RECENT_PATH));
        if (!Array.isArray(parsed)) return [];
        const paths = new Set();
        const result = [];
        for (const item of parsed) {
            try {
                const scope = item?.scope;
                const fileName = safePart(item?.fileName, "流程文件");
                const path = buildPath(scope, fileName);
                if (!file.isFile(path) || paths.has(path)) continue;
                paths.add(path);
                result.push({ scope, fileName, path });
                if (result.length >= MAX_RECENT_FILES) break;
            } catch (error) {}
        }
        return result;
    } catch (error) {
        log.warn("读取最近流程列表失败，将使用空列表: {error}", error.message);
        return [];
    }
}

function rememberRecentFile(scope, fileName) {
    const path = buildPath(scope, fileName);
    const item = {
        scope: {
            country: scope.country,
            typeDir: scope.typeDir,
            commissionName: scope.commissionName,
            locationDir: scope.locationDir,
        },
        fileName: safePart(fileName, "流程文件"),
        path,
    };
    const recent = [item, ...readRecentFiles().filter(entry => entry.path !== path)].slice(0, MAX_RECENT_FILES);
    try {
        if (!file.writeTextSync(RECENT_PATH, JSON.stringify(recent, null, 4) + "\r\n", false)) {
            log.warn("写入最近流程列表失败: {path}", RECENT_PATH);
        }
    } catch (error) {
        log.warn("写入最近流程列表失败: {error}", error.message);
    }
    return recent;
}

function resolveNewScope(scope) {
    const country = safePart(scope?.country, "国家");
    const typeDir = scope?.typeDir === "Basic" ? "Basic" : scope?.typeDir === "NPC" ? "NPC" : "";
    if (!typeDir) throw new Error("委托类型只能是 Basic 或 NPC");
    const commissionName = safePart(scope?.commissionName, "委托名");
    const locationDir = safePart(scope?.locationDir, "地点");
    return { country, typeDir, commissionName, locationDir };
}

function metadata(registry) {
    return registry.getDefinitions().sort((a, b) => {
        const category = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
        if (category !== 0) return category;
        return STEP_ORDER.indexOf(a.type) - STEP_ORDER.indexOf(b.type);
    });
}

function roleOptions() {
    try {
        const strategies = JSON.parse(file.readTextSync(PATHS.AVATAR_STRATEGIES));
        const names = Object.keys(strategies);
        return names.filter(name => typeof name === "string" && name.trim())
            .sort((a, b) => a.localeCompare(b, "zh-CN"));
    } catch (error) {
        log.warn("流程编辑器读取角色候选失败: {error}", error.message);
        return [];
    }
}

function branchOptions(scope) {
    const commissionName = String(scope?.commissionName || "").trim();
    if (!commissionName) return [];
    const config = loadAllBranchConfigs()[commissionName];
    const descriptions = config?.descriptions;
    if (!descriptions || typeof descriptions !== "object" || Array.isArray(descriptions)) return [];
    return Object.keys(descriptions).map(key => ({ key, label: descriptions[key] || key }));
}

function editorScopes() {
    return scanCommissionScopes().list.filter((scope) => file.isFile(buildPath(scope, "process.json")));
}

function orderedDeclaredObject(value, fields) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const result = {};
    for (const [name, fieldSpec] of Object.entries(fields || {})) {
        if (value[name] === undefined) continue;
        if (fieldSpec.type === "object") result[name] = orderedDeclaredObject(value[name], fieldSpec.fields);
        else if (fieldSpec.type === "array" && Array.isArray(value[name]) && fieldSpec.items?.type === "object") {
            result[name] = value[name].map(item => orderedDeclaredObject(item, fieldSpec.items.fields));
        } else result[name] = value[name];
    }
    return result;
}

function orderedData(step, registry) {
    const data = step.data;
    const spec = registry.getDefinition(step.type)?.dataSpec;
    if (!spec || data === undefined) return data;
    if (spec.kind === "object") {
        const result = orderedDeclaredObject(data, spec.fields);
        return spec.optional && result && Object.keys(result).length === 0 ? undefined : result;
    }
    if (spec.kind !== "custom" || !data || typeof data !== "object" || Array.isArray(data)) return data;
    if (spec.editor === "key") {
        const result = {};
        if (data.key !== undefined) result.key = data.key;
        if (data.action !== undefined) result.action = data.action;
        return result;
    }
    if (spec.editor === "roles") {
        const result = {};
        for (const slot of ["1", "2", "3", "4"]) if (data[slot] !== undefined) result[slot] = data[slot];
        return result;
    }
    if (spec.editor === "branches") {
        const result = {};
        for (const [branch, nestedStep] of Object.entries(data)) result[branch] = orderedStep(nestedStep, registry);
        return result;
    }
    if (spec.editor === "waves") {
        const result = {};
        if (data.timeout !== undefined) result.timeout = data.timeout;
        const waveKeys = Object.keys(data).filter(key => /^wave[1-9]\d*$/.test(key))
            .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
        for (const key of waveKeys) {
            const routes = data[key];
            const orderedRoutes = {};
            for (const condition of Object.keys(routes || {}).sort((a, b) => Number(a) - Number(b))) {
                orderedRoutes[condition] = routes[condition];
            }
            result[key] = orderedRoutes;
        }
        return result;
    }
    return data;
}

function orderedStep(step, registry) {
    const result = {};
    const knownKeys = ["type", "data", "note", "desc", "loc", "retry", "retryOn"];
    for (const key of knownKeys) {
        if (step[key] !== undefined) result[key] = key === "data" ? orderedData(step, registry) : step[key];
    }
    for (const key of Object.keys(step)) {
        if (!knownKeys.includes(key)) result[key] = step[key];
    }
    return result;
}

const RETRY_MODES = new Set(["throw", "return-false", "all"]);

function processDir(processPath) {
    return processPath.slice(0, processPath.lastIndexOf("/"));
}

function resolveReference(resourceDir, reference, prefix, errors) {
    if (typeof reference !== "string" || !reference.trim()) {
        errors.push(prefix + "必须是非空路径字符串");
        return null;
    }
    const normalized = normalizeReferenceValue(reference);
    const parts = normalized.split("/");
    if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) || /[:*?"<>|]/.test(normalized) ||
        parts.includes(".") || parts.includes("..")) {
        errors.push(prefix + "必须是当前流程目录内的相对路径：" + reference);
        return null;
    }
    if (!normalized.toLowerCase().endsWith(".json")) {
        errors.push(prefix + "必须指向 .json 文件：" + reference);
        return null;
    }
    return resourceDir + "/" + normalized;
}

function readJsonFile(path, prefix, errors) {
    if (!file.isFile(path)) {
        errors.push(prefix + "文件不存在：" + path);
        return { ok: false };
    }
    try {
        return { ok: true, value: JSON.parse(file.readTextSync(path)) };
    } catch (error) {
        errors.push(prefix + "JSON 解析失败：" + path + " - " + error.message);
        return { ok: false };
    }
}

function validatePathFile(path, prefix, errors) {
    const loaded = readJsonFile(path, prefix, errors);
    if (!loaded.ok) return;
    const data = loaded.value;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        errors.push(prefix + "路径文件根节点必须是对象：" + path);
        return;
    }
    if (!Array.isArray(data.positions)) {
        errors.push(prefix + "路径文件缺少 positions 数组：" + path);
        return;
    }
    const validPoint = data.positions.some(position => position && position.type !== "orientation" &&
        Number.isFinite(position.id) && Number.isFinite(position.x) && Number.isFinite(position.y));
    if (!validPoint) errors.push(prefix + "路径文件没有有效坐标点：" + path);
}

function referenceKey(path) {
    return String(path || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function validateMacroFile(path, prefix, errors) {
    const loaded = readJsonFile(path, prefix, errors);
    if (!loaded.ok) return;
    const data = loaded.value;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        errors.push(prefix + "键鼠脚本根节点必须是对象：" + path);
        return;
    }
    if (!Array.isArray(data.macroEvents) || data.macroEvents.length === 0) {
        errors.push(prefix + "键鼠脚本必须包含非空 macroEvents 数组：" + path);
        return;
    }
    for (let index = 0; index < data.macroEvents.length; index++) {
        const event = data.macroEvents[index];
        const eventPrefix = prefix + "macroEvents[" + index + "] ";
        if (!event || typeof event !== "object" || Array.isArray(event)) {
            errors.push(eventPrefix + "必须是对象：" + path);
            return;
        }
        if (!Number.isInteger(event.type) || event.type < 0 || event.type > 6) {
            errors.push(eventPrefix + "type 必须是 0 至 6 的事件类型：" + path);
            return;
        }
        if (!Number.isFinite(event.time) || event.time < 0) {
            errors.push(eventPrefix + "time 必须是非负有限数字：" + path);
            return;
        }
        if ((event.type === 0 || event.type === 1) &&
            (!Number.isInteger(event.keyCode) || event.keyCode < 1 || event.keyCode > 255)) {
            errors.push(eventPrefix + "键盘事件必须包含 1 至 255 的 keyCode：" + path);
            return;
        }
        if (event.type >= 2 && event.type <= 6 &&
            (!Number.isFinite(event.mouseX) || !Number.isFinite(event.mouseY))) {
            errors.push(eventPrefix + "鼠标事件必须包含有限数字 mouseX/mouseY：" + path);
            return;
        }
        if ((event.type === 4 || event.type === 5) && !["Left", "Right", "Middle"].includes(event.mouseButton)) {
            errors.push(eventPrefix + "鼠标按键只能是 Left、Right 或 Middle：" + path);
            return;
        }
    }
}

function validateProcess(steps, registry, processPath, resourceDir, scope, diagnostics, stack, label) {
    const { errors, warnings } = diagnostics;
    if (!Array.isArray(steps)) {
        errors.push(label + "根节点必须是步骤数组");
        return;
    }
    if (steps.length === 0) warnings.push(label + "流程为空，没有可执行步骤");

    function validateSubProcess(reference, prefix, guarded) {
        const path = resolveReference(resourceDir, reference, prefix, errors);
        if (!path) return;
        const stackKey = referenceKey(path);
        if (stack.has(stackKey)) {
            const message = prefix + (guarded ? "检测到由 desc 条件保护的循环引用：" : "检测到无条件循环引用：") + path;
            (guarded ? warnings : errors).push(message);
            return;
        }
        const loaded = readJsonFile(path, prefix, errors);
        if (!loaded.ok) return;
        stack.add(stackKey);
        try {
            validateProcess(loaded.value, registry, path, resourceDir, scope, diagnostics, stack, prefix + " → ");
        } finally {
            stack.delete(stackKey);
        }
    }

    function validateStep(step, prefix) {
        if (!step || typeof step !== "object" || Array.isArray(step)) {
            errors.push(prefix + "必须是对象");
            return;
        }
        if (typeof step.type !== "string" || !step.type.trim()) {
            errors.push(prefix + "type 必填");
            return;
        }
        if (!registry.has(step.type)) {
            errors.push(prefix + "未知类型：" + step.type);
            return;
        }
        for (const name of ["note", "desc"]) {
            if (step[name] !== undefined && typeof step[name] !== "string") errors.push(prefix + name + " 必须是字符串");
        }
        if (step.retry !== undefined && (!Number.isInteger(step.retry) || step.retry < 0)) {
            errors.push(prefix + "retry 必须是非负整数");
        }
        if (step.retryOn !== undefined && !RETRY_MODES.has(step.retryOn)) {
            errors.push(prefix + "retryOn 只能是 throw、return-false 或 all");
        }
        const locResult = parseStepLoc(step.loc);
        if (!locResult.ok) errors.push(prefix + "loc 格式错误：" + locResult.error);

        const dataResult = registry.validateData(step.type, step.data);
        if (!dataResult.ok) errors.push(prefix + dataResult.error);

        if (step.type === "地图追踪" && typeof step.data === "string" && step.data.trim()) {
            const path = resolveReference(resourceDir, step.data, prefix + "地图追踪文件", errors);
            if (path) validatePathFile(path, prefix + "地图追踪文件：", errors);
        } else if (step.type === "键鼠脚本" && typeof step.data === "string" && step.data.trim()) {
            const path = resolveReference(resourceDir, step.data, prefix + "键鼠脚本文件", errors);
            if (path) validateMacroFile(path, prefix + "键鼠脚本文件：", errors);
        } else if (step.type === "执行子流程" && step.data && typeof step.data === "object") {
            validateSubProcess(step.data.path, prefix + "data.path：",
                typeof step.desc === "string" && Boolean(step.desc.trim()));
        } else if (step.type === "摧毁哨塔") {
            const data = step.data && typeof step.data === "object" && !Array.isArray(step.data) ? step.data : {};
            if (data.navigation === "路径追踪") {
                const pathFields = typeof data.path === "string" ? ["path"] : ["path1", "path2"];
                for (const field of pathFields) {
                    const path = resolveReference(resourceDir, data[field], prefix + `data.${field}：`, errors);
                    if (path) validatePathFile(path, prefix + `${field} 路径追踪文件：`, errors);
                }
            }
        } else if (step.type === "固若金汤") {
            const result = collectImpregnableDefensePaths(step.data);
            if (!result.ok) errors.push(prefix + result.error);
            for (const warning of result.warnings || []) warnings.push(prefix + warning);
            if (result.ok) {
                for (const reference of result.paths) {
                    const path = resolveReference(resourceDir, reference, prefix + "波次路径：", errors);
                    if (path) validatePathFile(path, prefix + "波次路径文件：", errors);
                }
            }
        } else if (step.type === "用户分支选择") {
            if (!step.data || typeof step.data !== "object" || Array.isArray(step.data)) errors.push(prefix + "data 必须是分支对象");
            else {
                const branches = Object.entries(step.data);
                if (branches.length === 0) warnings.push(prefix + "没有配置任何分支步骤");
                const configured = branchOptions(scope).map(item => item.key);
                if (!configured.length) errors.push(prefix + "当前委托没有分支配置，不能使用用户分支选择");
                else {
                    const actual = branches.map(([key]) => key);
                    const unknown = actual.filter(key => !configured.includes(key));
                    const missing = configured.filter(key => !actual.includes(key));
                    if (unknown.length) errors.push(prefix + "包含未配置分支：" + unknown.join("、"));
                    if (missing.length) errors.push(prefix + "缺少已配置分支：" + missing.join("、"));
                }
                for (const [branchKey, branchStep] of branches) validateStep(branchStep, prefix + "分支 " + branchKey + " → ");
            }
        }
    }

    for (let index = 0; index < steps.length; index++) validateStep(steps[index], label + "步骤 #" + (index + 1) + "：");
}

function validateSteps(steps, registry, scope, fileName) {
    const diagnostics = { errors: [], warnings: [] };
    const path = buildPath(scope, fileName);
    const stack = new Set([referenceKey(path)]);
    validateProcess(steps, registry, path, processDir(path), scope, diagnostics, stack, "");
    if (scope.typeDir === "Basic") {
        const mapPath = processDir(path) + "/_path.json";
        validatePathFile(mapPath, "Basic 必需路径文件：", diagnostics.errors);
    }
    return diagnostics;
}

// 使用委托资源根目录校验任意相对路径的子流程文档。
function validateSubProcessSteps(steps, registry, scope, reference) {
    const diagnostics = { errors: [], warnings: [] };
    const path = resolveReference(processResourceDir(scope), reference, "子流程路径", diagnostics.errors);
    if (!path) return { diagnostics, path: null };
    validateProcess(steps, registry, path, processResourceDir(scope), scope, diagnostics, new Set([referenceKey(path)]), "");
    return { diagnostics, path };
}

export async function openProcessEditor(registry) {
    if (typeof htmlMask === "undefined") return log.warn("当前环境不支持 htmlMask，无法打开流程编辑器");
    if (htmlMask.exists(WINDOW_TAG)) return;
    const windowId = htmlMask.show(HTML_PATH, WINDOW_TAG);
    htmlMask.setClickThrough(windowId, false);
    const hook = new KeyMouseHook();
    let isVisible = true;
    let recorderActive = false;
    hook.onKeyDown(function (keyCode) {
        if (recorderActive || keyCode !== "Oem3" || !htmlMask.exists(windowId)) return;
        isVisible = !isVisible;
        htmlMask.setClickThrough(windowId, !isVisible);
        htmlMask.send(windowId, "/toggleVisibility", JSON.stringify({ visible: isVisible }));
    });
    const cancelToken = dispatcher.getLinkedCancellationToken();
    try {
        while (htmlMask.exists(windowId) && !cancelToken.isCancellationRequested) {
            let raw;
            try {
                raw = await htmlMask.receive(windowId, 1000);
            } catch (error) {
                if (isCancellationError(error)) break;
                continue;
            }
            if (!raw) continue;
            let message;
            try { message = JSON.parse(raw); } catch (error) { continue; }
            try {
                if (message.url === "/init") {
                    respond(windowId, message.requestId, {
                        scopes: editorScopes(),
                        processors: metadata(registry),
                        roles: roleOptions(),
                        recentFiles: readRecentFiles(),
                    });
                } else if (message.url === "/validateAll") {
                    // 全量静态校验返回的问题数量，用于同步编辑器状态栏。
                    const errors = await validateAllProcesses(registry);
                    respond(windowId, message.requestId, {
                        status: errors > 0 ? "error" : "ok",
                        errors: errors > 0 ? [`共发现 ${errors} 处问题，详见 BetterGI 日志`] : [],
                        warnings: [],
                    });
                } else if (message.url === "/target") {
                    const scope = message.data?.create ? resolveNewScope(message.data?.scope) : message.data?.scope;
                    const path = buildPath(scope, message.data?.fileName);
                    respond(windowId, message.requestId, {
                        status: "ok",
                        scope,
                        path,
                        exists: file.isFile(path),
                        branches: branchOptions(scope),
                        pathOptions: listPathOptions(scope),
                        subProcessOptions: listSubProcessOptions(scope, [message.data?.fileName]),
                    });
                } else if (message.url === "/load") {
                    const path = buildPath(message.data?.scope, message.data?.fileName);
                    if (!file.isFile(path)) throw new Error("文件不存在：" + path);
                    const content = file.readTextSync(path);
                    let loaded;
                    try {
                        loaded = JSON.parse(content);
                    } catch (error) {
                        throw new Error("流程文件 JSON 解析失败：" + error.message);
                    }
                    if (!Array.isArray(loaded)) throw new Error("流程文件根节点必须是步骤数组");
                    const recentFiles = rememberRecentFile(message.data?.scope, message.data?.fileName);
                    respond(windowId, message.requestId, {
                        status: "ok",
                        path,
                        content,
                        branches: branchOptions(message.data?.scope),
                        recentFiles,
                    });
                } else if (message.url === "/recordPath") {
                    const scope = message.data?.create ? resolveNewScope(message.data?.scope) : message.data?.scope;
                    const path = buildPath(scope, message.data?.fileName);
                    recorderActive = true;
                    isVisible = false;
                    htmlMask.setClickThrough(windowId, true);
                    htmlMask.send(windowId, "/toggleVisibility", JSON.stringify({ visible: false }));
                    let result;
                    try {
                        const existingPath = resolvePathReference(scope, message.data?.existingPath);
                        result = await openPathRecorder({
                            targetDir: processDir(path),
                            commissionName: scope.commissionName,
                            existingPath,
                        });
                    } finally {
                        recorderActive = false;
                        isVisible = true;
                        if (htmlMask.exists(windowId)) {
                            htmlMask.setClickThrough(windowId, false);
                            htmlMask.send(windowId, "/toggleVisibility", JSON.stringify({ visible: true }));
                        }
                    }
                    respond(windowId, message.requestId, Object.assign({}, result, { scope }));
                } else if (message.url === "/openSubprocess") {
                    const scope = message.data?.scope;
                    const reference = normalizeReferenceValue(message.data?.reference);
                    const blocked = Array.isArray(message.data?.blocked) ? message.data.blocked.map(normalizeReferenceValue) : [];
                    if (blocked.some(value => value.toLowerCase() === reference.toLowerCase())) throw new Error("不能打开当前流程或上级流程：" + reference);
                    const errors = [];
                    const path = resolveReference(processResourceDir(scope), reference, "子流程路径", errors);
                    if (!path) throw new Error(errors.join("\n"));
                    let content = "[]";
                    const exists = file.isFile(path);
                    if (exists) {
                        let parsed;
                        try { parsed = JSON.parse(file.readTextSync(path)); } catch (error) { throw new Error("子流程 JSON 解析失败：" + error.message); }
                        if (!isSubProcess(parsed)) throw new Error("文件不是合法子流程，数组内每个元素都必须包含 type 字段：" + path);
                        content = JSON.stringify(parsed, null, 4) + "\r\n";
                    }
                    respond(windowId, message.requestId, {
                        status: "ok", path, reference, exists, content,
                        subProcessOptions: listSubProcessOptions(scope, [...blocked, reference]),
                    });
                } else if (message.url === "/validateSubprocess" || message.url === "/saveSubprocess") {
                    let parsed;
                    try { parsed = JSON.parse(String(message.data?.content || "")); } catch (error) { throw new Error("JSON 格式错误：" + error.message); }
                    const scope = message.data?.scope;
                    const result = validateSubProcessSteps(parsed, registry, scope, message.data?.reference);
                    if (message.url === "/validateSubprocess") {
                        respond(windowId, message.requestId, {
                            status: result.diagnostics.errors.length ? "error" : result.diagnostics.warnings.length ? "warning" : "ok",
                            errors: result.diagnostics.errors,
                            warnings: result.diagnostics.warnings,
                        });
                        continue;
                    }
                    if (result.diagnostics.errors.length) throw new Error(result.diagnostics.errors.join("\n"));
                    if (!result.path) throw new Error("子流程路径无效");
                    if (file.isFile(result.path)) {
                        try {
                            if (!isSubProcess(JSON.parse(file.readTextSync(result.path)))) throw new Error("目标文件不是合法子流程，不能覆盖：" + result.path);
                        } catch (error) { throw new Error(error.message || String(error)); }
                    }
                    ensureParentDir(result.path);
                    const content = JSON.stringify(parsed.map(step => orderedStep(step, registry)), null, 4) + "\r\n";
                    if (!file.writeTextSync(result.path, content, false)) throw new Error("写入失败：" + result.path);
                    respond(windowId, message.requestId, { status: "ok", path: result.path, content, warnings: result.diagnostics.warnings });
                } else if (message.url === "/validate" || message.url === "/save") {
                    let parsed;
                    try { parsed = JSON.parse(String(message.data?.content || "")); }
                    catch (error) { throw new Error("JSON 格式错误：" + error.message); }
                    const scope = message.data?.create ? resolveNewScope(message.data?.scope) : message.data?.scope;
                    const path = buildPath(scope, message.data?.fileName);
                    if (message.url === "/save" && message.data?.create && file.isFile(path)) {
                        throw new Error("目标流程已存在，请从“现有委托”中打开后再保存：" + path);
                    }
                    const diagnostics = validateSteps(parsed, registry, scope, message.data?.fileName);
                    if (message.url === "/validate") {
                        respond(windowId, message.requestId, {
                            status: diagnostics.errors.length ? "error" : diagnostics.warnings.length ? "warning" : "ok",
                            errors: diagnostics.errors,
                            warnings: diagnostics.warnings,
                        });
                    } else {
                        if (diagnostics.errors.length) throw new Error(diagnostics.errors.join("\n"));
                        ensureParentDir(path);
                        const content = JSON.stringify(parsed.map(step => orderedStep(step, registry)), null, 4) + "\r\n";
                        if (!file.writeTextSync(path, content, false)) throw new Error("写入失败：" + path);
                        respond(windowId, message.requestId, { status: "ok", path, content, scope, warnings: diagnostics.warnings });
                    }
                } else if (message.url === "/close") {
                    respond(windowId, message.requestId, { status: "ok" });
                    break;
                }
            } catch (error) {
                respond(windowId, message.requestId, { status: "error", message: error.message });
            }
        }
    } finally {
        try { hook.dispose(); } catch (error) {}
        if (htmlMask.exists(windowId)) htmlMask.close(windowId);
    }
}
