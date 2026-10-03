import { isCancellationError } from "../utils/error-utils.js";
import { scanCommissionScopes } from "../loaders/process-scope.js";

// Vue 单文件产物由 BetterGI 直接通过 file:// 加载。
const HTML_PATH = "web/developer-test/index.html";
const WINDOW_TAG = "developer-test";

function baseName(path) {
    return String(path).split("/").pop().split("\\").pop();
}

function listJsonFiles(path) {
    try {
        return Array.from(file.readPathSync(path) || [])
            .filter((entry) => file.isFile(entry) && entry.toLowerCase().endsWith(".json"))
            .filter((entry) => {
                try { return Array.isArray(JSON.parse(file.readTextSync(entry))); } catch { return false; }
            })
            .map(baseName)
            .sort((a, b) => a.localeCompare(b, "zh-CN"));
    } catch {
        return [];
    }
}

function buildTestOptions() {
    const scopes = scanCommissionScopes().list.map((scope) => ({
        mode: String(scope.type).toLowerCase(),
        country: scope.country,
        commissionName: scope.commissionName,
        location: scope.locationDir,
        processFiles: listJsonFiles(`process/${scope.country}/${scope.typeDir}/${scope.commissionName}/${scope.locationDir}`),
    }));
    let cases = [];
    try {
        cases = Array.from(file.readPathSync("test/process") || [])
            .filter((entry) => file.isFolder(entry) && file.isFile(`${entry}/process.json`))
            .map(baseName)
            .sort((a, b) => a.localeCompare(b, "zh-CN"));
    } catch {}
    return { modes: ["case", "basic", "npc"], scopes, cases };
}

function respond(windowId, requestId, data) {
    const payload = JSON.stringify(data);
    if (typeof htmlMask.respond === "function") return htmlMask.respond(windowId, requestId, payload);
    if (typeof htmlMask.Respond === "function") return htmlMask.Respond(windowId, requestId, payload);
    htmlMask.send(windowId, "/response", JSON.stringify({ requestId, data }));
}

function validateConfig(config, options) {
    if (!config || !options.modes.includes(config.mode)) throw new Error("测试模式无效");
    if (config.mode === "case") {
        if (!options.cases.includes(config.caseName)) throw new Error("测试用例不存在");
        return config;
    }
    const scope = options.scopes.find((item) => item.mode === config.mode
        && item.country === config.country
        && item.commissionName === config.commissionName
        && item.location === config.location);
    if (!scope) throw new Error("委托流程不存在");
    if (!scope.processFiles.includes(config.processFile)) throw new Error("流程文件不存在");
    return config;
}

export async function openDeveloperTestEditor() {
    if (typeof htmlMask === "undefined") return null;
    const options = buildTestOptions();
    const windowId = htmlMask.show(HTML_PATH, WINDOW_TAG);
    htmlMask.setClickThrough(windowId, false);

    try {
        while (htmlMask.exists(windowId)) {
            let raw;
            try {
                raw = await htmlMask.receive(windowId, 1000);
            } catch (error) {
                if (isCancellationError(error)) break;
                await sleep(100);
                continue;
            }
            if (!raw) continue;
            let msg;
            try { msg = JSON.parse(raw); } catch { continue; }
            if (msg.url === "/loadTestOptions") {
                respond(windowId, msg.requestId, options);
            } else if (msg.url === "/runTest") {
                try {
                    const config = validateConfig(msg.data?.config, options);
                    respond(windowId, msg.requestId, { status: "ok" });
                    htmlMask.close(windowId);
                    return config;
                } catch (error) {
                    respond(windowId, msg.requestId, { status: "error", message: error.message });
                }
            } else if (msg.url === "/close") {
                respond(windowId, msg.requestId, { status: "ok" });
                htmlMask.close(windowId);
                return null;
            }
        }
    } catch (error) {
        if (!isCancellationError(error)) log.error("开发者测试面板异常: {error}", error.message);
    } finally {
        if (htmlMask.exists(windowId)) htmlMask.close(windowId);
    }
    return null;
}
