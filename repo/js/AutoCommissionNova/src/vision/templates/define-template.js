/**
 * RecognitionObject 模板声明 + 懒加载缓存
 *
 * 业务方不直接 readImageMatSync + RecognitionObject.templateMatch + finally mat.Dispose()，
 * 改为在 src/vision/templates/index.js 集中声明所有模板，调用方按 RO.inMainUI / RO.avatar("胡桃")
 * 的形态取 ro。首次访问懒加载，后续命中缓存；脚本退出时由 releaseAllTemplates 统一释放。
 *
 * 两种 def：
 *   staticDef({ path, region?, useMask?, threshold? })
 *     无参数。由 index.js 用 Object.defineProperty getter 挂到 RO；首次访问触发加载
 *
 *   dynamicDef({ path?|pathFn?, region?|regionFn?, useMask?, threshold? })
 *     带参数。返回一个函数，按 arg 维度独立缓存 mat/ro（不同参数互不影响）
 *
 * 资源生命周期：
 *   def 本身只注册元数据，不读图。mat/ro 在首次取用时创建并缓存。
 *   releaseAllTemplates 遍历所有 def 的 cache，Dispose 所有 mat，清空 cache —— 由 main.js
 *   顶层 finally 调用一次即可，业务代码不再写任何 mat.Dispose()。
 */

/** @type {Array<{def: Object, cache: Map<string, {mat: any, ro: any}>}>} 全部已注册的模板（含其缓存） */
const _registry = [];

function _cacheKey(arg) {
    if (arg === undefined) return "";
    if (typeof arg === "object" && arg !== null) return JSON.stringify(arg);
    return String(arg);
}

/**
 * 取一个模板的 ro（懒加载 + 按 arg 缓存）
 * 静态模板传 arg=undefined；动态模板由 dynamicDef 返回的闭包透传 arg
 */
function _resolve(entry, arg) {
    const key = _cacheKey(arg);
    const hit = entry.cache.get(key);
    if (hit) return hit.ro;

    const def = entry.def;
    const path = def.pathFn ? def.pathFn(arg) : def.path;
    const mat = file.readImageMatSync(path);
    const region = def.regionFn ? def.regionFn(arg) : def.region;
    const ro = region
        ? RecognitionObject.templateMatch(mat, ...region)
        : RecognitionObject.templateMatch(mat);
    if (def.useMask) ro.useMask = true;
    if (def.threshold !== undefined) ro.threshold = def.threshold;

    const created = { mat, ro };
    entry.cache.set(key, created);
    return ro;
}

function _register(def) {
    if (!def) throw new Error("def 不能为空");
    if (!def.path && !def.pathFn) throw new Error("模板必须提供 path 或 pathFn");
    if (def.path && def.pathFn) throw new Error(`模板 ${def.path} 不能同时声明 path 和 pathFn`);
    if (def.region && def.regionFn) throw new Error(`模板 ${def.path || "(dynamic)"} 不能同时声明 region 和 regionFn`);
    if (def.threshold !== undefined && typeof def.threshold !== "number") {
        throw new Error(`模板 ${def.path || "(dynamic)"} 的 threshold 必须是 number`);
    }
    const entry = { def, cache: new Map() };
    _registry.push(entry);
    return entry;
}

/**
 * 声明一个静态模板（无参数）。返回一个 thunk —— 由 index.js 用 Object.defineProperty
 * 把它包成 getter 挂到 RO 上，让调用方写 RO.inMainUI 而不是 RO.inMainUI()
 */
export function staticDef(def) {
    const entry = _register(def);
    return () => _resolve(entry, undefined);
}

/**
 * 声明一个动态模板（带参数）。返回一个函数，调用 (arg) 即得 ro
 * arg 用作缓存维度的 key —— 不同参数各自缓存 mat/ro，互不影响
 */
export function dynamicDef(def) {
    const entry = _register(def);
    return (arg) => _resolve(entry, arg);
}

/**
 * 释放所有已加载的 mat（脚本退出时调用一次）
 * 未被业务访问过的模板不会创建 mat，自然也无需释放 —— cache 为空即可
 */
export function releaseAllTemplates() {
    for (const entry of _registry) {
        for (const { mat } of entry.cache.values()) {
            try { mat.Dispose(); } catch (e) { }
        }
        entry.cache.clear();
    }
}
