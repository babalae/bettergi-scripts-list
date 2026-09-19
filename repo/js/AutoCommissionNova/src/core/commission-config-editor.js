/**
 * 委托配置编辑器(HTML 遮罩)
 * @description 打开委托配置的可视化配置面板,阻塞至用户点击关闭。
 *              通过 ~ 键(Oem3)切换显示/隐藏,隐藏时遮罩自动开启点击穿透,
 *              不影响游戏交互。修改即时写回文件。
 *
 *              磁盘存储为 config/branches/{委托名}.json 多文件结构，
 *              本编辑器透过 loadAllBranchConfigs / writeAllBranchConfigs 在
 *              composite 对象（与历史单文件结构一致）与多文件之间转换，
 *              HTML 侧无需感知拆分
 */

import { isCancellationError } from "../utils/error-utils.js";
import { createBranchConfigView, getBranchConfigUids, loadAllBranchConfigs, mergeBranchConfigView, writeAllBranchConfigs } from "../loaders/branch-config.js";
import { loadGlobalConfig, writeGlobalConfig } from "../loaders/global-config.js";
import { createPartyConfigView, writePartyConfigView } from "../loaders/party-config.js";
import { scanCommissionScopes } from "../loaders/process-scope.js";
import { getActiveAccountUid, getCurrentUid } from "../utils/account-utils.js";
import { listAccountUids, loadUserConfig, normalizeUid, writeUserConfig } from "../loaders/user-config.js";
import { PATHS } from "../config/index.js";

// Vue 单文件产物由 BetterGI 直接通过 file:// 加载。
const HTML_PATH = "web/commission-config/index.html";
const WINDOW_TAG = "commission-config";
const IDLE_TIMEOUT_MS = 30_000;

function normalizeStrategyPath(path) {
    return String(path || "").replace(/\\/g, "/");
}

function buildStrategyNodes(subPath = "./") {
    if (typeof strategyFile === "undefined") {
        return [];
    }

    const entries = Array.from(strategyFile.readPathSync(subPath) || []);
    const nodes = [];
    for (const entry of entries) {
        const normalized = normalizeStrategyPath(entry);
        if (!normalized) continue;
        if (strategyFile.isFolder(normalized)) {
            nodes.push({ name: normalized, type: "folder" });
            continue;
        }
        if (strategyFile.isFile(normalized) && /\.(json|txt)$/i.test(normalized)) {
            nodes.push({ name: normalized, type: "file" });
        }
    }

    return nodes.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "zh-CN");
    });
}

function sendHtmlMaskResponse(windowId, url, requestId, data) {
    if (requestId) {
        const payload = JSON.stringify(data);
        if (typeof htmlMask.respond === "function") {
            htmlMask.respond(windowId, requestId, payload);
            return;
        }
        if (typeof htmlMask.Respond === "function") {
            htmlMask.Respond(windowId, requestId, payload);
            return;
        }
        htmlMask.send(windowId, url, JSON.stringify({ requestId, data }));
        return;
    }

    htmlMask.send(windowId, url, JSON.stringify(data));
}

/**
 * 打开委托配置编辑器并阻塞至关闭
 * @description 显示遮罩窗口,注册 ~ 键钩子,进入消息循环直到用户点击"关闭"
 *              或脚本被取消。阻塞期间用户对分支状态的修改会即时写回文件。
 * @returns {Promise<{action: string}|null>}
 */
export async function openCommissionConfigEditor() {
    if (typeof htmlMask === "undefined") {
        log.warn("当前环境不支持 htmlMask,跳过委托配置面板");
        return;
    }

    if (htmlMask.exists(WINDOW_TAG)) {
        log.debug("委托配置面板已存在,跳过重复打开");
        return;
    }

    let windowId;
    let result = null;
    try {
        windowId = htmlMask.show(HTML_PATH, WINDOW_TAG);
    } catch (err) {
        if (isCancellationError(err)) return;
        log.warn("打开委托配置面板失败: {0}", err.message);
        return;
    }
    htmlMask.setClickThrough(windowId, false);
    log.info("委托配置面板已打开,按 ~ 键切换显示,点击关闭按钮继续主流程");

    const initialBranchConfig = loadAllBranchConfigs();
    const knownUids = Array.from(new Set([...listAccountUids(), ...getBranchConfigUids(initialBranchConfig)]));
    const accountUid = getActiveAccountUid() || (await getCurrentUid({ knownUids }));
    if (!accountUid) {
        log.warn("无法确认当前UID，委托配置面板不会更新账号分支完成进度");
    }
    const idleDeadlineAt = Date.now() + IDLE_TIMEOUT_MS;

    const hook = new KeyMouseHook();
    let isVisible = true;
    let idleActive = true;
    let lastCountdownSecond = null;

    hook.onKeyDown(function (keyCode) {
        if (keyCode !== "Oem3") return;
        if (!htmlMask.exists(windowId)) return;
        try {
            if (isVisible) {
                htmlMask.setClickThrough(windowId, true);
                htmlMask.send(windowId, "/toggleVisibility", JSON.stringify({ visible: false }));
            } else {
                htmlMask.setClickThrough(windowId, false);
                htmlMask.send(windowId, "/toggleVisibility", JSON.stringify({ visible: true }));
            }
            isVisible = !isVisible;
        } catch (err) {
            if (isCancellationError(err)) return;
            log.debug("切换委托配置面板显示失败: {0}", err.message);
        }
    });

    const cancelToken = dispatcher.getLinkedCancellationToken();

    try {
        while (htmlMask.exists(windowId)) {
            if (cancelToken.isCancellationRequested) {
                htmlMask.close(windowId);
                break;
            }

            if (idleActive) {
                const remainingMs = idleDeadlineAt - Date.now();
                if (remainingMs <= 0) {
                    log.info("委托配置面板 30 秒无操作，已自动关闭并继续主流程");
                    htmlMask.close(windowId);
                    break;
                }

                const remainingSeconds = Math.ceil(remainingMs / 1000);
                if (remainingSeconds !== lastCountdownSecond) {
                    htmlMask.send(windowId, "/idleCountdown", JSON.stringify({
                        active: true,
                        remainingSeconds,
                    }));
                    lastCountdownSecond = remainingSeconds;
                }
            }

            let raw;
            try {
                raw = await htmlMask.receive(windowId, 1000);
            } catch (err) {
                if (isCancellationError(err)) {
                    htmlMask.close(windowId);
                    break;
                }
                log.debug("接收委托配置面板消息失败: {0}", err.message);
                await sleep(200);
                continue;
            }

            if (!raw) {
                await sleep(1);
                continue;
            }

            let msg;
            try {
                msg = JSON.parse(raw);
            } catch (err) {
                log.debug("解析委托配置面板消息失败: {0}", err.message);
                continue;
            }

            if (!msg || !msg.url) continue;

            if (msg.url === "/activity") {
                idleActive = false;
                if (msg.requestId) {
                    sendHtmlMaskResponse(windowId, "/activity", msg.requestId, { status: "ok" });
                }
            } else if (msg.url === "/loadConfig") {
                try {
                    const requestedUid = normalizeUid(msg.data?.uid) || accountUid || listAccountUids()[0] || "";
                    if (!requestedUid || !listAccountUids().includes(requestedUid)) {
                        throw new Error("请选择有效的 UID 配置档案");
                    }
                    const globalView = loadGlobalConfig(requestedUid);
                    const branchView = createBranchConfigView(loadAllBranchConfigs(), requestedUid);
                    const partyView = createPartyConfigView(scanCommissionScopes().byName, requestedUid);
                    sendHtmlMaskResponse(windowId, "/loadConfig", msg.requestId, {
                        uids: listAccountUids(),
                        selectedUid: requestedUid,
                        currentUid: accountUid,
                        global: globalView,
                        branches: branchView,
                        party: partyView,
                    });
                    log.debug("已发送委托配置到面板（{n} 个分支配置委托）", Object.keys(branchView).length);
                } catch (err) {
                    if (isCancellationError(err)) {
                        htmlMask.close(windowId);
                        break;
                    }
                    log.warn("读取委托配置失败: {0}", err.message);
                    sendHtmlMaskResponse(windowId, "/loadConfig", msg.requestId, { global: {}, branches: {}, party: { global: {}, scopesByCommission: {} } });
                }
            } else if (msg.url === "/saveConfig") {
                let status = "ok";
                let errMsg = "";
                try {
                    const content = msg.data && msg.data.content;
                    const requestedUid = normalizeUid(msg.data?.uid);
                    if (!requestedUid || !listAccountUids().includes(requestedUid)) {
                        throw new Error("缺少有效的 UID 配置档案");
                    }
                    if (typeof content !== "string") {
                        throw new Error("缺少 content 字段");
                    }
                    const viewComposite = JSON.parse(content);
                    if (!viewComposite || typeof viewComposite !== "object") {
                        throw new Error("content 必须解析为对象");
                    }

                    if (viewComposite.global || viewComposite.branches || viewComposite.party) {
                        if (Object.prototype.hasOwnProperty.call(viewComposite, "global")) {
                            writeGlobalConfig(viewComposite.global || {}, requestedUid);
                        }
                        const branchComposite = mergeBranchConfigView(
                            viewComposite.branches || {},
                            requestedUid,
                            loadAllBranchConfigs()
                        );
                        if (Object.prototype.hasOwnProperty.call(viewComposite, "branches")) {
                            writeAllBranchConfigs(branchComposite);
                        }
                        if (Object.prototype.hasOwnProperty.call(viewComposite, "party")) {
                            writePartyConfigView(viewComposite.party || {}, requestedUid);
                        }
                        log.debug("委托配置已保存（{n} 个分支配置委托）", Object.keys(branchComposite).length);
                    } else {
                        const legacyComposite = mergeBranchConfigView(viewComposite, requestedUid, loadAllBranchConfigs());
                        writeAllBranchConfigs(legacyComposite);
                        log.debug("已按旧格式保存分支配置（{n} 个委托）", Object.keys(legacyComposite).length);
                    }
                } catch (err) {
                    if (isCancellationError(err)) {
                        htmlMask.close(windowId);
                        break;
                    }
                    status = "error";
                    errMsg = err.message;
                    log.warn("保存委托配置失败: {0}", err.message);
                }
                if (msg.requestId) {
                    try {
                        sendHtmlMaskResponse(windowId, "/saveConfig", msg.requestId, { status, message: errMsg });
                    } catch (err) {
                        if (isCancellationError(err)) {
                            htmlMask.close(windowId);
                            break;
                        }
                        log.debug("回复保存结果失败: {0}", err.message);
                    }
                }
            } else if (msg.url === "/createAccount") {
                const response = { status: "ok", message: "", uid: "", uids: [] };
                try {
                    const requestedUid = normalizeUid(msg.data?.uid);
                    if (!requestedUid) throw new Error("UID 必须为纯数字");
                    if (!listAccountUids().includes(requestedUid)) {
                        writeUserConfig(loadUserConfig(requestedUid));
                    }
                    response.uid = requestedUid;
                    response.uids = listAccountUids();
                } catch (err) {
                    response.status = "error";
                    response.message = err.message;
                }
                if (msg.requestId) sendHtmlMaskResponse(windowId, "/createAccount", msg.requestId, response);
            } else if (msg.url === "/loadStrategyTree") {
                const response = { children: [], error: "" };
                try {
                    response.children = buildStrategyNodes("./");
                } catch (err) {
                    if (isCancellationError(err)) {
                        htmlMask.close(windowId);
                        break;
                    }
                    response.error = err.message;
                    log.warn("读取战斗策略根目录失败: {0}", err.message);
                }
                if (msg.requestId) {
                    sendHtmlMaskResponse(windowId, "/loadStrategyTree", msg.requestId, response);
                }
            } else if (msg.url === "/loadStrategyChildren") {
                const response = {
                    path: msg.data?.path || "",
                    children: [],
                    error: "",
                };
                try {
                    response.children = buildStrategyNodes(response.path || "./");
                } catch (err) {
                    if (isCancellationError(err)) {
                        htmlMask.close(windowId);
                        break;
                    }
                    response.error = err.message;
                    log.warn("读取战斗策略目录失败 [{path}]: {err}", response.path, err.message);
                }
                if (msg.requestId) {
                    sendHtmlMaskResponse(windowId, "/loadStrategyChildren", msg.requestId, response);
                }
            } else if (msg.url === "/locateScope") {
                const response = { status: "ok", message: "", target: null };
                try {
                    if (htmlMask.exists(windowId)) {
                        htmlMask.setClickThrough(windowId, true);
                        htmlMask.send(windowId, "/toggleVisibility", JSON.stringify({ visible: false }));
                        isVisible = false;
                    }

                    const scope = msg.data && msg.data.scope;
                    const requiredFields = ["country", "typeDir", "commissionName", "locationDir"];
                    for (const field of requiredFields) {
                        if (!scope || typeof scope[field] !== "string" || !scope[field].trim()) {
                            throw new Error(`定位缺少 ${field} 字段`);
                        }
                    }

                    const country = scope.country.trim();
                    const processDir = `${PATHS.PROCESS_ROOT}/${country}/${scope.typeDir.trim()}/${scope.commissionName.trim()}/${scope.locationDir.trim()}`;
                    const processPath = `${processDir}/process.json`;
                    if (!file.isFile(processPath)) {
                        throw new Error(`找不到流程文件: ${processPath}`);
                    }

                    const steps = JSON.parse(file.readTextSync(processPath));
                    if (!Array.isArray(steps)) {
                        throw new Error(`流程文件根节点必须是数组: ${processPath}`);
                    }

                    const mapStep = steps.find((step) => step && step.type === "地图追踪");
                    if (!mapStep || typeof mapStep.data !== "string" || !mapStep.data.trim()) {
                        throw new Error(`流程中没有有效地图追踪步骤: ${processPath}`);
                    }

                    const mapDataPath = String(mapStep.data).replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+/g, "/");
                    if (!mapDataPath || mapDataPath.startsWith("/") || mapDataPath.includes("../") || /^[A-Za-z]:\//.test(mapDataPath)) {
                        throw new Error(`地图追踪文件路径必须是当前流程目录下的相对路径: ${mapStep.data}`);
                    }

                    const mapPath = `${processDir}/${mapDataPath}`;
                    if (!file.isFile(mapPath)) {
                        throw new Error(`找不到地图追踪文件: ${mapPath}`);
                    }

                    const mapData = JSON.parse(file.readTextSync(mapPath));
                    const positions = Array.isArray(mapData.positions) ? mapData.positions : [];
                    const target = positions
                        .filter((pos) => pos && pos.type !== "orientation" && Number.isFinite(Number(pos.id)) && Number.isFinite(Number(pos.x)) && Number.isFinite(Number(pos.y)))
                        .sort((a, b) => Number(b.id) - Number(a.id))[0];
                    if (!target) {
                        throw new Error(`地图追踪文件没有有效目标点: ${mapPath}`);
                    }

                    const x = Number(target.x);
                    const y = Number(target.y);
                    await genshin.clickMapPoint(x, y, country);
                    response.target = { x, y, country, processPath, mapPath };
                    log.debug("已定位委托流程: {path} -> ({x}, {y})", response.target.mapPath, response.target.x, response.target.y);
                } catch (err) {
                    if (isCancellationError(err)) {
                        htmlMask.close(windowId);
                        break;
                    }
                    response.status = "error";
                    response.message = err.message;
                    log.info("定位委托流程失败: {0}", "暂不支持该委托定位");
                    log.debug("定位委托流程失败: {0}", err.message);
                }
                if (msg.requestId) {
                    sendHtmlMaskResponse(windowId, "/locateScope", msg.requestId, response);
                }
            } else if (msg.url === "/openDeveloperTest") {
                try {
                    sendHtmlMaskResponse(windowId, "/openDeveloperTest", msg.requestId, { status: "ok" });
                } catch (err) {
                    if (isCancellationError(err)) break;
                }
                result = { action: "developer-test" };
                htmlMask.close(windowId);
                break;
            } else if (msg.url === "/close") {
                try {
                    if (msg.requestId) {
                        sendHtmlMaskResponse(windowId, "/close", msg.requestId, { status: "ok" });
                    }
                } catch (err) {
                    if (isCancellationError(err)) {
                        htmlMask.close(windowId);
                        break;
                    }
                    log.debug("回复关闭确认失败: {0}", err.message);
                }
                htmlMask.close(windowId);
                break;
            }

            await sleep(1);
        }
    } catch (error) {
        // 最外层兜底:取消异常静默退出,其他异常记录后继续走 finally 清理
        if (!isCancellationError(error)) {
            log.error("委托配置面板执行异常: {0}", error.message);
        }
    } finally {
        log.debug("释放委托配置面板键鼠钩子...");
        try { hook.dispose(); } catch (e) {}
        try {
            if (htmlMask.exists(windowId)) {
                htmlMask.close(windowId);
            }
        } catch (e) {}
        log.info("委托配置面板已关闭");
    }
    return result;
}
