import { makeScaler, identityScaler, clampRect } from "./geom.js";
import { RESOLUTION, BATCH1 } from "./config.js";

 function hasHost() {
    return typeof captureGameRegion === "function";
}

function hostFile() {
    return (typeof file !== "undefined" && file) ? file : null;
}

 function toArray(res) {
    if (!res) return [];
    if (Object.prototype.toString.call(res) === "[object Array]") return res;
    let n = 0;
    try { if (typeof res.length === "number") n = res.length; } catch {            }
    if (!n) { try { if (typeof res.Length === "number") n = res.Length; } catch {          } }
    if (!n) { try { if (typeof res.Count === "number") n = res.Count; } catch {          } }
    if (!n) { try { if (typeof res.count === "number") n = res.count; } catch {          } }
    const out = [];
    for (let i = 0; i < n; i++) {
        try { out.push(res[i]); } catch { break; }
    }
    return out;
}

 function pickNum(obj, keys, def) {
    if (!obj) return def;
    for (let i = 0; i < keys.length; i++) {
        try {
            const v = obj[keys[i]];
            if (typeof v === "number" && isFinite(v)) return v;
        } catch {             }
    }
    return def;
}

 function pickStr(obj, keys, def) {
    if (!obj) return def;
    for (let i = 0; i < keys.length; i++) {
        try {
            const v = obj[keys[i]];
            if (typeof v === "string") return v;
        } catch {             }
    }
    return def;
}

 function rgx(rg) { return pickNum(rg, ["x", "X"], 0); }

 function rgy(rg) { return pickNum(rg, ["y", "Y"], 0); }

 function rgw(rg) { return pickNum(rg, ["width", "Width", "w"], 0); }

 function rgh(rg) { return pickNum(rg, ["height", "Height", "h"], 0); }

 function rgScore(rg) {
    return pickNum(rg, ["matchScore", "MatchScore", "score", "Score"], null);
}

export function srcMatOf(region) {
    if (!region) return null;
    try { if (region.srcMat) return region.srcMat; } catch {            }
    try { if (region.SrcMat) return region.SrcMat; } catch {            }
    return null;
}

export function matSize(mat) {
    let rows = 0, cols = 0;
    try { rows = (typeof mat.rows === "number") ? mat.rows : mat.Rows; } catch {            }
    try { cols = (typeof mat.cols === "number") ? mat.cols : mat.Cols; } catch {            }
    return { rows: rows || 0, cols: cols || 0 };
}

export function disposeRegion(rg) {
    if (!rg) return;
    try { if (typeof rg.dispose === "function") { rg.dispose(); return; } } catch {          }
    try { if (typeof rg.Dispose === "function") rg.Dispose(); } catch {                }
}

export function disposeRo(ro) {
    if (!ro) return;
    try { if (typeof ro.dispose === "function") { ro.dispose(); return; } } catch {          }
    try { if (typeof ro.Dispose === "function") ro.Dispose(); } catch {          }
}

export function capture() {
    if (!hasHost()) throw new Error("宿主不可用：captureGameRegion 不存在（是否在离线环境？）");
    return captureGameRegion();
}

export function hostResolution() {
    try {
        if (typeof genshin !== "undefined" && genshin &&
            typeof genshin.Width === "number" && typeof genshin.Height === "number") {
            const w = genshin.Width, h = genshin.Height;
            if (w > 0 && h > 0) return { w: w, h: h, src: "genshin" };
        }
    } catch (e) { }
    return null;
}

export function checkResolution(frame) {
    const out = { w: 0, h: 0, ok: false, matched: false, msg: "", src: "" };
    const host = hostResolution();
    if (host) {
        out.w = host.w;
        out.h = host.h;
        out.src = host.src;
    } else {
        const mat = srcMatOf(frame);
        if (mat) {
            const sz = matSize(mat);
            out.w = sz.cols;
            out.h = sz.rows;
            out.src = "mat";
        }
    }
    if (out.w && out.h) {
        out.ok = true;
        out.matched = (out.w === RESOLUTION.baseW && out.h === RESOLUTION.baseH);
        if (!out.matched) {
            out.msg = "当前运行分辨率不为 " + RESOLUTION.baseW + "×" + RESOLUTION.baseH +
                "，无法正常识别，结果不可靠！";
        }
    } else {
        out.msg = "无法读取画面尺寸";
    }
    return out;
}

 function deriveCrop(frame, x, y, w, h) {
    try { return frame.deriveCrop(x, y, w, h); } catch {
        try { return frame.DeriveCrop(x, y, w, h); } catch { return null; }
    }
}

export function cropBase(frame, baseRect) {
    const mat = srcMatOf(frame);
    const sz = matSize(mat);
    const sc = (sz.cols && sz.rows) ? makeScaler(sz.cols, sz.rows) : identityScaler();
    const r = sc.rect(baseRect);
    const cl = clampRect(r, sz.cols, sz.rows);
    if (!cl) return null;
    return deriveCrop(frame, cl.x, cl.y, cl.w, cl.h);
}

 function channelsOf(pxVal) {
    if (pxVal === null || pxVal === undefined) return null;
    if (typeof pxVal === "number") return [pxVal, pxVal, pxVal];
    const names = ["Item0", "Item1", "Item2"];
    const out = [];
    for (let i = 0; i < 3; i++) {
        let v;
        try { v = pxVal[names[i]]; } catch { v = undefined; }
        if (typeof v !== "number") { try { v = pxVal[i]; } catch { v = undefined; } }
        if (typeof v !== "number") {
            try { if (typeof pxVal.get_Item === "function") v = pxVal.get_Item(i); } catch {            }
        }
        if (typeof v !== "number" || !isFinite(v)) return null;
        out.push(v);
    }
    return out;
}

let activeReader = null;

 function cvNamespace() {
    try { if (typeof OpenCvSharp !== "undefined" && OpenCvSharp) return OpenCvSharp; } catch {           }
    return null;
}

 function vec3bType() {
    const ns = cvNamespace();
    if (!ns) return null;
    try { if (ns.OpenCvSharp && ns.OpenCvSharp.Vec3b) return ns.OpenCvSharp.Vec3b; } catch {          }
    try { if (ns.Vec3b) return ns.Vec3b; } catch {         }
    return null;
}

export function initPixelReader(probeMat) {
    const v3 = vec3bType();
    const readers = [];
    if (v3) readers.push({ name: "Mat.Get(Vec3b,y,x)", fn: (m, y, x) => m.Get(v3, y, x) });
    readers.push({ name: "Mat.At(y,x)", fn: (m, y, x) => m.At(y, x) });
    readers.push({ name: "Mat.Get(y,x)", fn: (m, y, x) => m.Get(y, x) });
    readers.push({ name: "Mat.at(y,x)", fn: (m, y, x) => m.at(y, x) });
    activeReader = null;
    const sz = matSize(probeMat);
    if (!sz.rows || !sz.cols) return { ok: false, api: "", report: ["探针图像为空"] };
    const probes = [[0, 0], [sz.rows - 1, 0], [0, sz.cols - 1], [sz.rows - 1, sz.cols - 1]];
    const report = [];
    for (const rd of readers) {
        let okCount = 0;
        for (const [py, px] of probes) {
            try {
                const ch = channelsOf(rd.fn(probeMat, py, px));
                if (ch && ch.length === 3) okCount++;
            } catch {              }
        }
        const works = okCount === probes.length;
        report.push(rd.name + "=" + (works ? "ok" : "x"));
        if (works && !activeReader) activeReader = rd;
    }
    return { ok: !!activeReader, api: activeReader ? activeReader.name : "", report };
}

export function pixelReady() { return !!activeReader; }

export function px(mat, y, x) {
    if (!mat || !activeReader) return null;
    const sz = matSize(mat);
    if (sz.rows && sz.cols) {
        let cy = y, cx = x;
        if (!(cy >= 0)) cy = 0; else if (cy > sz.rows - 1) cy = sz.rows - 1;
        if (!(cx >= 0)) cx = 0; else if (cx > sz.cols - 1) cx = sz.cols - 1;
        if (cy !== y || cx !== x) {
        }
        y = cy; x = cx;
    }
    try {
        const ch = channelsOf(activeReader.fn(mat, y, x));
        if (!ch) return null;
        return ch;
    } catch {
        return null;
    }
}

const BMP_HEADER_MIN = 54;

function parseBmpHeader(bytes) {
    if (!bytes || bytes.length < BMP_HEADER_MIN) return null;
    if (bytes[0] !== 0x42 || bytes[1] !== 0x4D) return null;
    const rd32 = function (off) {
        return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
    };
    const rd16 = function (off) { return bytes[off] | (bytes[off + 1] << 8); };
    const dataOffset = rd32(10);
    const dibSize = rd32(14);
    const width = rd32(18) | 0;
    const rawH = rd32(22) | 0;
    const height = Math.abs(rawH);
    const bpp = rd16(28);
    if (dibSize < 40 || width <= 0 || height <= 0 || bpp !== 24) return null;
    const stride = ((width * 3 + 3) >> 2) << 2;
    return {
        dataOffset: dataOffset, width: width, height: height,
        topDown: rawH < 0, stride: stride, bpp: bpp
    };
}

export const DIAG = { on: false };

const _BULK_STATS = { fast: 0, slow: 0, shape: "", shapeHits: {} };

export function bulkStatsSnapshot() {
    return {
        fast: _BULK_STATS.fast,
        slow: _BULK_STATS.slow,
        shape: _BULK_STATS.shape || "",
        shapeHits: Object.assign({}, _BULK_STATS.shapeHits)
    };
}

function detectShape(raw) {
    try {
        if (!raw) return "null";
        if (typeof raw === "string") return "string";
        if (typeof ArrayBuffer !== "undefined" && raw instanceof ArrayBuffer) return "arraybuffer";
        if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(raw)) {
            try {
                if (raw.constructor && raw.constructor.name) return "typedarray:" + raw.constructor.name;
            } catch (e2) { }
            return "typedarray";
        }
        if (typeof raw.Length === "number") return "dotnet-array";
        if (typeof raw.length === "number") {
            return (raw.buffer && typeof raw.buffer === "object") ? "arraylike+buffer" : "arraylike";
        }
        if (raw.buffer && typeof raw.buffer === "object") {
            const bl = raw.buffer.byteLength;
            return (typeof bl === "number") ? "buffer-prop" : "buffer-prop?";
        }
        return "unknown";
    } catch (e) {
        return "detect-error";
    }
}

function noteShape(raw) {
    try {
        const s = detectShape(raw);
        _BULK_STATS.shape = s;
        _BULK_STATS.shapeHits[s] = (_BULK_STATS.shapeHits[s] || 0) + 1;
    } catch (e) { }
}

function bulkFromHost(raw, n) {
    if (!raw || !(n > 0)) return null;
    if (DIAG.on) noteShape(raw);
    try {
        if (typeof ArrayBuffer !== "undefined" && raw instanceof ArrayBuffer) {
            return new Uint8Array(raw, 0, Math.min(n, raw.byteLength));
        }
        if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView &&
            ArrayBuffer.isView(raw) && raw.buffer) {
            return new Uint8Array(raw.buffer, raw.byteOffset || 0, Math.min(n, raw.byteLength || n));
        }
        if (raw.buffer && typeof raw.buffer === "object" && typeof raw.buffer.byteLength === "number") {
            return new Uint8Array(raw.buffer, 0, Math.min(n, raw.buffer.byteLength));
        }
    } catch (e) {  }
    return null;
}

const _TOBYTES_FORM = { form: null, tried: [], fail: null };

export function toBytesStatsSnapshot() {
    return { form: _TOBYTES_FORM.form, tried: _TOBYTES_FORM.tried.slice(), fail: _TOBYTES_FORM.fail };
}

function callToBytes(mat) {
    if (_TOBYTES_FORM.form) {
        try {
            if (_TOBYTES_FORM.form === "ext+emptyArr") return mat.ToBytes(".bmp", []);
            if (_TOBYTES_FORM.form === "ext+emptyI32") return mat.ToBytes(".bmp", new Int32Array(0));
            if (_TOBYTES_FORM.form === "ext+zeroArr") return mat.ToBytes(".bmp", [0]);
            return mat.ToBytes(".bmp");
        } catch (e) { _TOBYTES_FORM.form = null; }
    }
    const cands = [
        { k: "ext+emptyArr", fn: function (m) { return m.ToBytes(".bmp", []); } },
        { k: "ext+emptyI32", fn: function (m) { return m.ToBytes(".bmp", new Int32Array(0)); } },
        { k: "ext+zeroArr", fn: function (m) { return m.ToBytes(".bmp", [0]); } },
        { k: "ext-only", fn: function (m) { return m.ToBytes(".bmp"); } }
    ];
    const tried = [];
    for (const c of cands) {
        try {
            const r = c.fn(mat);
            const n = r ? ((typeof r.Length === "number") ? r.Length
                : ((typeof r.length === "number") ? r.length : 0)) : 0;
            tried.push(c.k + "=" + (n > 0 ? "ok(" + n + "B)" : "empty"));
            if (n > 0) {
                _TOBYTES_FORM.form = c.k;
                _TOBYTES_FORM.tried = tried;
                _TOBYTES_FORM.fail = null;
                return r;
            }
        } catch (e) {
            tried.push(c.k + "=throw(" + ((e && e.message) ? e.message.slice(0, 40) : "?") + ")");
        }
    }
    _TOBYTES_FORM.tried = tried;
    _TOBYTES_FORM.fail = "全部形式失败：" + tried.join(" | ");
    return null;
}

function encodeBmpBytes(mat) {
    if (!mat || typeof mat.ToBytes !== "function") {
        _TOBYTES_FORM.fail = "Mat 没有 ToBytes 方法";
        return null;
    }
    try {
        const raw = callToBytes(mat);
        if (!raw) return null;
        const n = (typeof raw.Length === "number") ? raw.Length
            : ((typeof raw.length === "number") ? raw.length : 0);
        if (!n) return null;
        const bulk = tryBulkClone(raw, n);
        if (bulk) {
            return bulk;
        }
        if (DIAG.on && !_BULK_STATS.shape) noteShape(raw);
        _BULK_STATS.slow++;
        const out = new Uint8Array(n);
        for (let i = 0; i < n; i++) out[i] = raw[i] & 0xFF;
        return out;
    } catch (e) {
        _TOBYTES_FORM.fail = "encodeBmpBytes 异常：" + ((e && e.message) ? e.message : e);
        return null;
    }
}

function tryBulkClone(raw, n) {
    if (BATCH1 && BATCH1.USE_BULK_CROP === false) return null;
    const v = bulkFromHost(raw, n);
    if (v) { if (DIAG.on) _BULK_STATS.fast++; return v; }
    return null;
}

export function readMatBgrRect(mat, x, y, w, h) {
    const bad = function (reason) { return { ok: false, w: 0, h: 0, bgr: null, reason: reason }; };
    if (!mat) return bad("传参为空");
    if (!(w > 0) || !(h > 0)) return bad("宽高非法 " + w + "x" + h);
    const sz = matSize(mat);
    if (!sz.rows || !sz.cols) return bad("无法读取 Mat 尺寸");
    if (x < 0 || y < 0 || x + w > sz.cols || y + h > sz.rows) {
        return bad("子矩形越界 (" + x + "," + y + "," + w + "x" + h + ") 超出 " + sz.cols + "x" + sz.rows);
    }
    let sub = null;
    try {
        if (typeof mat.SubMat === "function") {
            sub = mat.SubMat(y, y + h, x, x + w);
        } else if (typeof mat.submat === "function") {
            sub = mat.submat(y, y + h, x, x + w);
        } else if (w === 1 && typeof mat.Col === "function") {
            const colM = mat.Col(x);
            try {
                sub = (typeof colM.SubMat === "function") ? colM.SubMat(y, y + h, 0, 1) : null;
            } finally { if (sub !== colM) { try { colM.Dispose(); } catch (e) { } } }
        }
        if (!sub) return bad("宿主缺少 SubMat/Col");
        return readMatBgr(sub);
    } catch (e) {
        return bad("子矩形读取异常：" + ((e && e.message) ? e.message : e));
    } finally {
        if (sub) { try { sub.Dispose(); } catch (e) { } }
    }
}

export function readMatBgr(mat) {
    const bad = function (reason) { return { ok: false, w: 0, h: 0, bgr: null, via: "", reason: reason }; };
    if (!mat) return bad("传参为空");
    const sz = matSize(mat);
    if (!sz.rows || !sz.cols) return bad("无法读取 Mat 尺寸");
    const bytes = encodeBmpBytes(mat);
    if (!bytes) {
        const why = _TOBYTES_FORM.fail || "未知原因";
        return bad("ToBytes 不可用（" + why + "）");
    }
    const hd = parseBmpHeader(bytes);
    if (!hd) return bad("BMP 头解析失败（魔数/DIB/位深不符）");
    if (hd.width !== sz.cols || hd.height !== sz.rows) {
        return bad("BMP 尺寸 " + hd.width + "x" + hd.height + " 与 Mat " + sz.cols + "x" + sz.rows + " 不符");
    }
    const need = hd.dataOffset + hd.stride * hd.height;
    if (bytes.length < need) return bad("BMP 数据不足：有 " + bytes.length + "，需 " + need);
    const w = hd.width, h = hd.height;
    const bgr = new Uint8Array(w * h * 3);
    const rowBytes = w * 3;
    if (hd.topDown) {
        for (let y = 0; y < h; y++) {
            const src = hd.dataOffset + y * hd.stride;
            bgr.set(bytes.subarray(src, src + rowBytes), y * rowBytes);
        }
    } else {
        for (let y = 0; y < h; y++) {
            const src = hd.dataOffset + (h - 1 - y) * hd.stride;
            bgr.set(bytes.subarray(src, src + rowBytes), y * rowBytes);
        }
    }
    return {
        ok: true, w: w, h: h, bgr: bgr, via: "ToBytes(.bmp)",
        reason: "", topDown: !!hd.topDown, stride: hd.stride, dataOffset: hd.dataOffset
    };
}

export function loadMat(path) {
    const f = hostFile();
    if (!f) { return null; }
    try { if (typeof f.isExists === "function" && !f.isExists(path)) { return null; } } catch {            }
    try {
        const m = f.readImageMatSync(path);
        if (!m) return null;
        try { if (typeof m.empty === "function" && m.empty()) return null; } catch {               }
        return m;
    } catch {
        return null;
    }
}

export function setRoThreshold(ro, v) {
    if (!ro || typeof v !== "number" || !isFinite(v)) return ro;
    try { ro.threshold = v; } catch {          }
    try { ro.Threshold = v; } catch {            }
    try { if (typeof ro.initTemplate === "function") ro.initTemplate(); } catch {          }
    try { if (typeof ro.InitTemplate === "function") ro.InitTemplate(); } catch {            }
    return ro;
}

export function makeTemplateRo(mat, x, y, w, h, threshold) {
    if (!mat) return null;
    if (typeof RecognitionObject === "undefined") return null;
    let ro = null;
    try { ro = RecognitionObject.TemplateMatch(mat, x, y, w, h); } catch {
        try { ro = RecognitionObject.templateMatch(mat, x, y, w, h); } catch { ro = null; }
    }
    if (!ro) return null;
    return setRoThreshold(ro, threshold);
}

export function findAll(frame, ro) {
    const out = [];
    if (!frame || !ro) return out;
    let raw = null;
    try {
        if (typeof frame.findMulti === "function") raw = frame.findMulti(ro);
        else if (typeof frame.FindMulti === "function") raw = frame.FindMulti(ro);
        else { return out; }
    } catch {
        return out;
    }
    const arr = toArray(raw);
    for (let i = 0; i < arr.length; i++) {
        const rg = arr[i];
        if (!rg) continue;
        out.push({
            x: rgx(rg), y: rgy(rg), w: rgw(rg), h: rgh(rg),
            score: rgScore(rg),
            text: pickStr(rg, ["text", "Text"], "")
        });
    }
    return out;
}

export function makeOcrRo(x, y, w, h, threshold) {
    if (typeof RecognitionObject === "undefined" || !RecognitionObject) return null;
    let ro = null;
    try { ro = RecognitionObject.Ocr(x, y, w, h); } catch {
        try { ro = RecognitionObject.ocr(x, y, w, h); } catch { return null; }
    }
    if (!ro) return null;
    return setRoThreshold(ro, (typeof threshold === "number") ? threshold : 0.5);
}

export function ocrText(frame, rect, threshold) {
    const bad = function (msg) { return { ok: false, text: "", hits: 0, error: msg }; };
    if (!frame || !rect) return bad("传参为空");
    if (typeof frame.findMulti !== "function" && typeof frame.FindMulti !== "function") {
        return bad("该对象没有 findMulti");
    }
    const ro = makeOcrRo(rect.x, rect.y, rect.w, rect.h, threshold);
    if (!ro) return bad("RecognitionObject.Ocr 不可用");
    let hits = [];
    let err = null;
    try {
        let raw = null;
        if (typeof frame.findMulti === "function") raw = frame.findMulti(ro);
        else if (typeof frame.FindMulti === "function") raw = frame.FindMulti(ro);
        hits = toArray(raw);
    } catch (e) {
        err = (e && e.message) ? e.message : String(e);
    } finally {
        disposeRo(ro);
    }
    if (err) return bad(err);
    let s = "";
    for (let i = 0; i < hits.length; i++) {
        const t = pickStr(hits[i], ["text", "Text"], "");
        if (t) s += String(t);
    }
    const text = s.replace(/\s+/g, "");
    return { ok: text.length > 0, text: text, hits: hits.length, error: null };
}

export function writeText(path, content, append) {
    const f = hostFile();
    if (!f) return false;
    try { if (f.writeTextSync(path, content, !!append)) return true; } catch {          }
    try { if (f.WriteTextSync(path, content, !!append)) return true; } catch {          }
    return false;
}

export function saveFrame(frame, path) {
    const mat = srcMatOf(frame);
    const f = hostFile();
    if (!f || !mat) return false;
    try { return !!f.writeImageSync(path, mat); } catch {
        try { return !!f.WriteImageSync(path, mat); } catch { return false; }
    }
}

export function readText(path) {
    const f = hostFile();
    if (!f) return null;
    try { if (typeof f.isExists === "function" && !f.isExists(path)) return null; } catch {            }
    try { return f.readTextSync(path); } catch { return null; }
}

export function ensureDir(path) {
    const f = hostFile();
    if (!f) return false;
    try { return !!f.createDirectory(path); } catch { return false; }
}

let token = null;

let tokenProbed = false;

 function getCancelToken() {
    if (tokenProbed) return token;
    tokenProbed = true;
    try {
        if (typeof dispatcher !== "undefined" && dispatcher &&
            typeof dispatcher.getLinkedCancellationToken === "function") {
            token = dispatcher.getLinkedCancellationToken();
        }
    } catch {
        token = null;
    }
    return token;
}

export function isCancelled() {
    const t = getCancelToken();
    if (!t) return false;
    try {
        if (typeof t.isCancellationRequested === "boolean") return t.isCancellationRequested;
        if (typeof t.IsCancellationRequested === "boolean") return t.IsCancellationRequested;
    } catch {            }
    return false;
}

export function sleepMs(ms) {
    return sleep(ms);
}

 function hasSettings() {
    try { return typeof settings !== "undefined" && !!settings; } catch { return false; }
}

 function settingRaw(key) {
    if (!hasSettings()) return undefined;
    try { return settings[key]; } catch { return undefined; }
}

export function settingBool(key, def) {
    const v = settingRaw(key);
    if (v === undefined || v === null) return def;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1") return true;
        if (s === "false" || s === "0" || s === "") return false;
    }
    return def;
}

export function settingText(key, def) {
    const v = settingRaw(key);
    if (v === undefined || v === null) return (typeof def === "string") ? def : "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return (typeof def === "string") ? def : "";
}

export function settingList(key, def, opt) {
    const o = opt || {};
    const v = settingRaw(key);
    if (v === undefined || v === null) return def;
    const out = toArray(v);
    const strs = out.filter(function (x) { return typeof x === "string" && x.length; });
    if (!strs.length) {
        return o.distinguishEmpty ? [] : def;
    }
    return strs;
}

const _HOST_CROP = {
    form: null,
    fail: null,
    bytes: {}
};

export function hostCropStats() {
    const b = {};
    for (const k in _HOST_CROP.bytes) b[k] = _HOST_CROP.bytes[k];
    return { form: _HOST_CROP.form, fail: _HOST_CROP.fail, fast: _HOST_CROP.fast, slow: _HOST_CROP.slow, ms: _HOST_CROP.ms, calls: _HOST_CROP.calls, bytes: b };
}

export function hostCropReset() {
    _HOST_CROP.fast = 0; _HOST_CROP.slow = 0; _HOST_CROP.bytes = {}; _HOST_CROP.ms = 0; _HOST_CROP.calls = 0;
}

function cvRoot() {
    try {
        if (typeof OpenCvSharp === "undefined" || !OpenCvSharp) return null;
        const inner = OpenCvSharp.OpenCvSharp;
        if (inner && (inner.Cv2 || inner.Mat || inner.Size)) return inner;
        return OpenCvSharp;
    } catch (e) { return null; }
}

function interpArea(ns) {
    try {
        const f = ns.InterpolationFlags;
        if (!f) return null;
        const v = (f.Area !== undefined) ? f.Area : f.INTER_AREA;
        return (v === undefined || v === null) ? null : v;
    } catch (e) { return null; }
}

function lenOf(b) {
    try { if (typeof b.Length === "number") return b.Length; } catch (e) { }
    try { if (typeof b.length === "number") return b.length; } catch (e) { }
    return 0;
}

function toBmpBytes(m) {
    const t = encodeBmpBytes(m);
    if (!t) { _HOST_CROP.fail = "BMP 取字节失败：" + (_TOBYTES_FORM.fail || "未知"); return null; }
    if (DIAG.on) _HOST_CROP.form = "encodeBmpBytes";
    return t;
}

function bmpToTightBgr(bytes, n) {
    const hd = parseBmpHeader(bytes);
    if (!hd) { _HOST_CROP.fail = "BMP 头解析失败"; return null; }
    if (hd.width !== n || hd.height !== n) {
        _HOST_CROP.fail = "BMP 尺寸 " + hd.width + "x" + hd.height + " != " + n + "x" + n;
        return null;
    }
    const rowBytes = n * 3;
    const out = new Uint8Array(n * n * 3);
    for (let y = 0; y < n; y++) {
        const src = hd.topDown
            ? hd.dataOffset + y * hd.stride
            : hd.dataOffset + (n - 1 - y) * hd.stride;
        let d = y * rowBytes;
        for (let i = 0; i < rowBytes; i++) out[d + i] = bytes[src + i];
    }
    return out;
}

export function hostGrayArea30(srcMat, cw, ch, n) {
    const nn = (n > 0) ? n : 30;
    const _t0 = Date.now();
    let sub = null, mf = null, g32 = null, d32 = null, d8 = null;
    try {
        const ns = cvRoot();
        if (!ns) { _HOST_CROP.fail = "OpenCvSharp 命名空间不可见"; return null; }
        const Cv2 = ns.Cv2, SizeCtor = ns.Size, MT = ns.Mat;
        const CC = ns.ColorConversionCodes;
        const area = interpArea(ns);
        if (!Cv2 || typeof Cv2.Resize !== "function" || typeof Cv2.CvtColor !== "function") {
            _HOST_CROP.fail = "Cv2.Resize/CvtColor 不可见"; return null;
        }
        if (typeof SizeCtor !== "function" || typeof MT !== "function" || !CC) {
            _HOST_CROP.fail = "Size/Mat/ColorConversionCodes 不可见"; return null;
        }
        if (area === null) { _HOST_CROP.fail = "InterpolationFlags.Area 不可见"; return null; }
        if (!srcMat) return null;

        mf = new MT();
        srcMat.ConvertTo(mf, ns.MatType.CV_32FC3);

        g32 = new MT();
        Cv2.CvtColor(mf, g32, CC.BGR2GRAY, 0);

        d32 = new MT();
        Cv2.Resize(g32, d32, new SizeCtor(nn, nn), 0, 0, area);

        d8 = new MT();
        d32.ConvertTo(d8, ns.MatType.CV_8U);

        const sz = matSize(d8);
        if (sz.cols !== nn || sz.rows !== nn) { _HOST_CROP.fail = "灰度输出 " + sz.cols + "x" + sz.rows; return null; }
        if (d8.Channels && d8.Channels() !== 1) { _HOST_CROP.fail = "灰度输出通道数 " + d8.Channels(); return null; }

        const bytes = toBmpBytes(d8);
        if (!bytes) return null;
        const hd = parseBmpHeader8(bytes);
        if (!hd || hd.width !== nn || hd.height !== nn) { _HOST_CROP.fail = "灰度 BMP 头不符"; return null; }

        const out = new Uint8Array(nn * nn);
        for (let y = 0; y < nn; y++) {
            const src = hd.topDown
                ? hd.dataOffset + y * hd.stride
                : hd.dataOffset + (nn - 1 - y) * hd.stride;
            const dst = y * nn;
            for (let x = 0; x < nn; x++) out[dst + x] = bytes[src + x];
        }
        if (DIAG.on) _HOST_CROP.fast++;
        return out;
    } catch (e) {
        _HOST_CROP.fail = "hostGrayArea30 异常：" + ((e && e.message) ? e.message : e);
        return null;
    } finally {
        if (DIAG.on) {
            _HOST_CROP.ms += Date.now() - _t0;
            _HOST_CROP.calls++;
        }
        try { if (d8) d8.Dispose(); } catch (e) { }
        try { if (d32) d32.Dispose(); } catch (e) { }
        try { if (g32) g32.Dispose(); } catch (e) { }
        try { if (mf) mf.Dispose(); } catch (e) { }
        try { if (sub) sub.Dispose(); } catch (e) { }
    }
}

function parseBmpHeader8(bytes) {
    if (!bytes || bytes.length < 54) return null;
    if (bytes[0] !== 0x42 || bytes[1] !== 0x4D) return null;
    const rd32 = function (off) {
        return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
    };
    const rd16 = function (off) { return bytes[off] | (bytes[off + 1] << 8); };
    const dataOffset = rd32(10);
    const dibSize = rd32(14);
    const width = rd32(18) | 0;
    const rawH = rd32(22) | 0;
    const height = Math.abs(rawH);
    const bpp = rd16(28);
    if (dibSize < 40 || width <= 0 || height <= 0 || bpp !== 8) return null;
    const stride = ((width + 3) >> 2) << 2;
    return { dataOffset, width, height, topDown: rawH < 0, stride, bpp };
}

export function bgrToGray(bgr, n) {
    const out = new Uint8Array(n * n);
    for (let i = 0, p = 0; i < out.length; i++, p += 3) {
        out[i] = Math.max(0, Math.min(255, Math.round(0.114 * bgr[p] + 0.587 * bgr[p + 1] + 0.299 * bgr[p + 2])));
    }
    return out;
}

export function hostCropMulti(srcMat, x, y, cw, ch, sizes, asGray) {
    const _t0 = DIAG.on ? Date.now() : 0;
    try {
        return _hostCropMultiImpl(srcMat, x, y, cw, ch, sizes, asGray);
    } finally {
        if (DIAG.on) {
            _HOST_CROP.ms += Date.now() - _t0;
            _HOST_CROP.calls++;
        }
    }
}

function _hostCropMultiImpl(srcMat, x, y, cw, ch, sizes, asGray) {
    if (!srcMat || !sizes || !sizes.length) return null;
    const ns = cvRoot();
    if (!ns) { _HOST_CROP.fail = "OpenCvSharp 命名空间不可见"; _HOST_CROP.slow++; return null; }
    const Cv2 = ns.Cv2, SizeCtor = ns.Size;
    const area = interpArea(ns);
    if (!Cv2 || typeof Cv2.Resize !== "function") { _HOST_CROP.fail = "Cv2.Resize 不可见"; _HOST_CROP.slow++; return null; }
    if (typeof SizeCtor !== "function") { _HOST_CROP.fail = "Size 不可见"; _HOST_CROP.slow++; return null; }
    if (area === null) { _HOST_CROP.fail = "InterpolationFlags.Area 不可见"; _HOST_CROP.slow++; return null; }
    const MT = ns.Mat;
    if (typeof MT !== "function") { _HOST_CROP.fail = "Mat 构造器不可见"; _HOST_CROP.slow++; return null; }

    let sub = null;
    const dsts = [];
    try {
        sub = srcMat.SubMat(y, y + ch, x, x + cw);

        const result = {};
        for (let i = 0; i < sizes.length; i++) {
            const n = sizes[i];
            if (!(n > 0)) continue;
            const dst = new MT();
            dsts.push(dst);
            Cv2.Resize(sub, dst, new SizeCtor(n, n), 0, 0, area);

            const cols = matSize(dst).cols, rows = matSize(dst).rows;
            if (cols !== n || rows !== n) { _HOST_CROP.fail = "Resize 输出 " + cols + "x" + rows; _HOST_CROP.slow++; return null; }

            const bytes = toBmpBytes(dst);
            if (!bytes) { _HOST_CROP.slow++; return null; }
            if (DIAG.on) _HOST_CROP.bytes[n] = lenOf(bytes);

            const tight = bmpToTightBgr(bytes, n);
            if (!tight) { _HOST_CROP.slow++; return null; }
            result[n] = asGray ? bgrToGray(tight, n) : tight;
        }
        _HOST_CROP.fast++;
        return result;
    } catch (e) {
        _HOST_CROP.fail = "宿主链路异常：" + ((e && e.message) ? e.message : e);
        _HOST_CROP.slow++;
        return null;
    } finally {
        for (let i = 0; i < dsts.length; i++) { try { dsts[i].Dispose(); } catch (e) { } }
        if (sub) { try { sub.Dispose(); } catch (e) { } }
    }
}
