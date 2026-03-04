// ============================================================
// Fetch Mappings — Download and cache game data from remote URL
// ============================================================

var MAPPINGS_URL = "https://ggartifact.com/good/mappings.json";
var MAPPINGS_CACHE_PATH = "data/mappings.json";
var MAPPINGS_META_PATH = "data/mappings_meta.json";
var MAPPINGS_TTL_DEFAULT = 7 * 24 * 3600 * 1000; // 7 days
var MAPPINGS_TTL_REFRESH = 1 * 3600 * 1000;       // 1 hour

async function fetchMappingsIfNeeded() {
    // Read cached metadata
    var lastFetchTime = 0;
    try {
        var metaRaw = file.readTextSync(MAPPINGS_META_PATH);
        if (metaRaw) {
            var meta = JSON.parse(metaRaw);
            lastFetchTime = meta.lastFetchTime || 0;
        }
    } catch (e) {
        // No meta file or parse error — treat as never fetched
    }

    // Check if cached file exists
    var cacheExists = false;
    try {
        var cached = file.readTextSync(MAPPINGS_CACHE_PATH);
        cacheExists = cached && cached.length > 0;
    } catch (e) {
        cacheExists = false;
    }

    // Determine TTL based on user setting
    var ttl = settings.refreshMappings ? MAPPINGS_TTL_REFRESH : MAPPINGS_TTL_DEFAULT;
    var elapsed = Date.now() - lastFetchTime;

    if (cacheExists && elapsed < ttl) {
        log.info("游戏数据映射缓存有效，跳过刷新（上次更新: " +
            new Date(lastFetchTime).toISOString().slice(0, 19).replace("T", " ") + "）");
        return;
    }

    // Fetch from remote
    log.info("正在从远程服务器获取游戏数据映射...");
    try {
        var response = await http.request("GET", MAPPINGS_URL, null, null);

        if (response.status_code === 200 && response.body) {
            // Validate JSON before saving
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
            log.warn("获取游戏数据映射失败（" + e.message + "），使用本地缓存");
        } else {
            throw new Error("获取游戏数据映射失败且无本地缓存: " + e.message +
                "\n请确认已开启 JS HTTP 权限，并检查网络连接。");
        }
    }
}
