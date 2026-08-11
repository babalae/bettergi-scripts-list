/**
 * 按键步骤处理器
 */
import { defineStep } from "./define-step.js";

const KEY_ACTIONS = new Set(["press", "down", "up"]);
const NAMED_KEYS = new Set([
    "LBUTTON", "RBUTTON", "MBUTTON", "XBUTTON1", "XBUTTON2", "BACK", "TAB", "CLEAR", "RETURN",
    "SHIFT", "CONTROL", "MENU", "PAUSE", "CAPITAL", "ESCAPE", "SPACE", "PRIOR", "NEXT", "END", "HOME",
    "LEFT", "UP", "RIGHT", "DOWN", "SELECT", "PRINT", "EXECUTE", "SNAPSHOT", "INSERT", "DELETE", "HELP",
    "LWIN", "RWIN", "APPS", "SLEEP", "MULTIPLY", "ADD", "SEPARATOR", "SUBTRACT", "DECIMAL", "DIVIDE",
    "NUMLOCK", "SCROLL", "LSHIFT", "RSHIFT", "LCONTROL", "RCONTROL", "LMENU", "RMENU",
]);

export function isSupportedVirtualKey(value) {
    const key = String(value || "").trim().toUpperCase().replace(/^VK_/, "");
    return /^[A-Z0-9]$/.test(key) || /^F(?:[1-9]|1\d|2[0-4])$/.test(key) || /^NUMPAD[0-9]$/.test(key) ||
        NAMED_KEYS.has(key) || /^OEM_(?:[1-8]|102|PLUS|COMMA|MINUS|PERIOD)$/.test(key);
}

function validateKeyData(data) {
    if (typeof data === "string") {
        if (!data.trim()) return { ok: false, error: "按键 data 不能为空" };
        if (!isSupportedVirtualKey(data)) return { ok: false, error: "按键 data 不是支持的 VirtualKey: " + data };
        return { ok: true, value: data.trim() };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: "按键 data 必须是按键字符串或 {key, action} 对象" };
    }
    const unknown = Object.keys(data).filter(name => name !== "key" && name !== "action");
    if (unknown.length) return { ok: false, error: "按键 data 包含不支持的字段: " + unknown.join("、") };
    if (typeof data.key !== "string" || !data.key.trim() || !isSupportedVirtualKey(data.key)) {
        return { ok: false, error: "按键 data.key 不是支持的 VirtualKey" };
    }
    const action = data.action || "press";
    if (!KEY_ACTIONS.has(action)) return { ok: false, error: "按键 data.action 只能是 press、down 或 up" };
    return { ok: true, value: { key: data.key.trim(), action } };
}

export default defineStep({
    type: "按键",
    category: "流程控制",
    dataSpec: {
        kind: "custom",
        editor: "key",
        label: "按键操作",
        actions: [
            { value: "press", label: "点击" },
            { value: "down", label: "按下" },
            { value: "up", label: "释放" },
        ],
        validate: validateKeyData,
    },
    run: async (step) => {
        if (!step.data) {
            log.warn("按键步骤缺少数据");
            return;
        }
        if (typeof step.data === "string") {
            log.info("执行按键: {key}", step.data);
            keyPress(step.data);
        } else if (typeof step.data === "object") {
            if (step.data.action === "down") {
                log.info("按下按键: {key}", step.data.key);
                keyDown(step.data.key);
            } else if (step.data.action === "up") {
                log.info("释放按键: {key}", step.data.key);
                keyUp(step.data.key);
            } else {
                log.info("执行按键: {key}", step.data.key);
                keyPress(step.data.key);
            }
        }
    },
});
