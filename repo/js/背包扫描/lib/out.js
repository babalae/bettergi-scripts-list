import { RECORD } from "./config.js";
import { ensureDir, writeText, saveFrame } from "./util.js";

let account = "";

export function sanitizeAccount(raw) {
    let a = String(raw === undefined || raw === null ? "" : raw).trim();
    a = a.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").replace(/^\.+|\.+$/g, "").trim();
    if (a === "." || a === "..") a = "";
    if (a.length > 40) a = a.slice(0, 40);
    return a;
}

export function setAccount(name) {
    account = sanitizeAccount(name);
    return account;
}

export function recordRoot() {
    return account ? (RECORD.root + "/" + account) : RECORD.root;
}

export function resultFile() { return recordRoot() + "/扫描结果.txt"; }
export function historyFile() { return recordRoot() + "/扫描结果历史记录.txt"; }

export function makeRunDir() {
    const root = recordRoot();
    ensureDir(root);
    return root;
}

function pad2(n) {
    return (n < 10 ? "0" : "") + n;
}

export function stampCompact() {
    const d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "_" +
        pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

export function makeDebugDir() {
    const dir = recordRoot() + "/scan-" + stampCompact();
    ensureDir(dir);
    ensureDir(dir + "/pages");
    return dir;
}

export function makeJsonlWriter(path) {
    let count = 0;
    let buf = "";
    return {
        write(obj) {
            buf += JSON.stringify(obj) + "\n";
            count++;
            return writeText(path, buf, false);
        },
        flush() { return writeText(path, buf, false); },
        get count() { return count; }
    };
}

export function savePageShot(frame, dir, pageName, index, suffix) {
    const tag = String(index).padStart(3, "0") + (suffix ? String(suffix) : "");
    const name = String(pageName) + "_p" + tag + ".png";
    const path = dir + "/pages/" + name;
    return saveFrame(frame, path) ? path : null;
}
