const WAVE_KEY_PATTERN = /^wave([1-9]\d*)$/;
const THRESHOLD_KEY_PATTERN = /^(?:0|[1-9]\d*)$/;

/**
 * 统一 OCR 文本中的空白、数字 0 和分隔符，降低常见识别误差的影响。
 * @param {unknown} text - OCR 返回的原始文本。
 * @returns {string} 可供正则解析的标准化文本。
 */
function normalizeOcrText(text) {
    return String(text || "")
        .replace(/\s/g, "")
        .replace(/[oO]/g, "0")
        .replace(/[|\\]/g, "/");
}

/**
 * 从“敌人再次来袭！(2/3)”一类文本中解析当前波次。
 * @param {unknown} text - 波次提示区域的 OCR 文本。
 * @returns {{current: number, total: number}|null} 合法波次，无法解析时返回 null。
 */
export function parseImpregnableDefenseWave(text) {
    const normalized = normalizeOcrText(text);
    const match = normalized.match(/敌人再次来袭.*?[（(](\d+)\/(\d+)[）)]/);
    if (!match) return null;
    const current = Number(match[1]);
    const total = Number(match[2]);
    if (current < 1 || total < 1 || current > total) return null;
    return { current, total };
}

/**
 * 解析累计击杀进度。优先匹配击败/消灭/击退描述，并以纯 x/y 作为兜底。
 * @param {unknown} text - 委托子描述区域的 OCR 文本。
 * @returns {{current: number, total: number}|null} 合法进度，无法解析时返回 null。
 */
export function parseImpregnableDefenseKills(text) {
    const normalized = normalizeOcrText(text);
    const semanticMatch = normalized.match(/(?:击败|消灭|击退).*?(\d+)\/(\d+)/);
    const match = semanticMatch || normalized.match(/(\d+)\/(\d+)/);
    if (!match) return null;
    const current = Number(match[1]);
    const total = Number(match[2]);
    if (current < 0 || total < 1 || current > total) return null;
    return { current, total };
}

/**
 * 解析“固若金汤”步骤配置。
 * @param {Object} data - 包含动态 waveN 与可选 timeout 的原始步骤配置。
 * @returns {{ok: boolean, error?: string, warnings: string[], timeout?: number, waves?: Map<number, Object>}}
 * 标准化配置；配置非法时通过 ok=false 和 error 返回原因。
 */
export function parseImpregnableDefenseConfig(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: "固若金汤步骤需要对象格式的 data", warnings: [] };
    }

    const warnings = [];
    const waves = new Map();
    let timeout = 300;

    for (const key of Object.keys(data)) {
        if (key === "timeout") {
            if (typeof data.timeout !== "number" || !Number.isInteger(data.timeout) || data.timeout <= 0) {
                return { ok: false, error: "字段 timeout 必须是正整数", warnings };
            }
            timeout = data.timeout;
            continue;
        }

        const waveMatch = key.match(WAVE_KEY_PATTERN);
        if (!waveMatch) return { ok: false, error: `未知顶层字段 ${key}`, warnings };

        const waveData = data[key];
        if (!waveData || typeof waveData !== "object" || Array.isArray(waveData)) {
            return { ok: false, error: `字段 ${key} 必须是对象`, warnings };
        }
        if (Object.keys(waveData).length === 0) {
            return { ok: false, error: `字段 ${key} 至少需要一条路径条件`, warnings };
        }

        const paths = new Map();
        let unconditionalPath = null;
        for (const conditionKey of Object.keys(waveData)) {
            const path = waveData[conditionKey];
            if (typeof path !== "string" || !path.trim()) {
                return { ok: false, error: `字段 ${key}.${conditionKey} 必须是非空路径字符串`, warnings };
            }
            if (conditionKey === "-1") {
                unconditionalPath = path.trim();
                continue;
            }
            if (!THRESHOLD_KEY_PATTERN.test(conditionKey)) {
                return { ok: false, error: `字段 ${key}.${conditionKey} 不是合法的累计击杀数`, warnings };
            }
            paths.set(Number(conditionKey), path.trim());
        }

        waves.set(Number(waveMatch[1]), {
            unconditionalPath,
            paths,
            thresholds: Array.from(paths.keys()).sort((a, b) => a - b),
        });
    }

    if (waves.size === 0) {
        return { ok: false, error: "至少需要配置一个合法的 waveN", warnings };
    }
    return { ok: true, warnings, timeout, waves };
}

/**
 * 解析配置并收集所有波次引用的路径，供启动期存在性校验使用。
 * @param {Object} data - “固若金汤”步骤的原始 data。
 * @returns {{ok: boolean, error?: string, warnings: string[], paths: string[], timeout?: number, waves?: Map<number, Object>}}
 * 配置解析结果；失败时 paths 为空数组。
 */
export function collectImpregnableDefensePaths(data) {
    const parsed = parseImpregnableDefenseConfig(data);
    if (!parsed.ok) return { ...parsed, paths: [] };
    const paths = [];
    for (const wave of parsed.waves.values()) {
        if (wave.unconditionalPath) paths.push(wave.unconditionalPath);
        for (const path of wave.paths.values()) paths.push(path);
    }
    return { ...parsed, paths };
}

/**
 * 选择当前可执行的最大击杀阈值，并将不大于该阈值的条件标记为已跨过。
 * @param {{thresholds: number[], paths: Map<number, string>}|undefined} wave - 当前波次配置。
 * @param {number|null|undefined} currentKills - 已确认的累计击杀数。
 * @param {Set<number>} processed - 当前波次已执行或已跨过的阈值集合，会被原地更新。
 * @returns {{threshold: number, path: string}|null} 应执行的条件和路径，无命中时返回 null。
 */
export function selectReachedThreshold(wave, currentKills, processed) {
    if (!wave || currentKills === null || currentKills === undefined) return null;
    const reached = wave.thresholds.filter(value => value <= currentKills && !processed.has(value));
    if (reached.length === 0) return null;
    const selected = reached[reached.length - 1];
    for (const threshold of wave.thresholds) {
        if (threshold <= selected) processed.add(threshold);
    }
    return { threshold: selected, path: wave.paths.get(selected) };
}
