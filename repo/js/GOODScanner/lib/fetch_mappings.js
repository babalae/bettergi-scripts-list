// ============================================================
// Fetch Mappings — Download and cache game data from remote URL
// ============================================================

var MAPPINGS_URL = "https://ggartifact.com/good/mappings.json";
var MAPPINGS_CACHE_PATH = "data/mappings.json";
var MAPPINGS_META_PATH = "data/mappings_meta.json";
var MAPPINGS_TTL = 24 * 3600 * 1000; // 1 day

async function fetchMappingsIfNeeded() {
    var lastFetchTime = 0;
    try {
        var metaRaw = file.readTextSync(MAPPINGS_META_PATH);
        if (metaRaw) {
            var meta = JSON.parse(metaRaw);
            lastFetchTime = meta.lastFetchTime || 0;
        }
    } catch (e) {}

    var cacheExists = false;
    try {
        var cached = file.readTextSync(MAPPINGS_CACHE_PATH);
        cacheExists = cached && cached.length > 0;
    } catch (e) {}

    if (cacheExists && (Date.now() - lastFetchTime) < MAPPINGS_TTL) {
        return;
    }

    log.info("正在获取游戏数据映射...");
    try {
        var response = await http.request("GET", MAPPINGS_URL, null, null);

        if (response.status_code === 200 && response.body) {
            JSON.parse(response.body);
            file.WriteTextSync(MAPPINGS_CACHE_PATH, response.body);
            file.WriteTextSync(MAPPINGS_META_PATH, JSON.stringify({
                lastFetchTime: Date.now()
            }));
            log.info("游戏数据映射已更新");
        } else {
            throw new Error("HTTP " + response.status_code);
        }
    } catch (e) {
        if (cacheExists) {
            log.warn("获取数据失败（" + e.message + "），使用本地缓存");
        } else {
            throw new Error("获取游戏数据失败且无本地缓存: " + e.message +
                "\n请确认已开启 JS HTTP 权限，并检查网络连接。");
        }
    }
}
