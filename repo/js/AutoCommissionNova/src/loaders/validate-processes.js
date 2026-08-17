/**
 * 流程文件静态校验
 *
 * 手动遍历 process/<国家>/{NPC,Basic}/** 下所有 process.json，
 * 对每个 step 检查：
 *   (1) step.type 是否已在 registry 注册
 *   (2) step.data 是否通过该 type 声明的严格 dataSpec
 *   (3) 用户分支选择 的 step.data[branchKey] 嵌套 step 递归校验
 *   (4) 执行子流程引用的子流程文件递归校验，地图追踪引用的路径文件存在性校验
 *   (5) 通用条件字段 step.loc 是否为 [x, y]、[x, y, tolerance] 或 [[x, y], ...]
 *
 * 发现问题只输出 DEBUG，不阻断启动 —— 用户仍可跑其他正常委托，
 * 但启动日志会明确指出问题文件 + 步骤索引 + 错误描述
 */
import { COMMISSION_TYPE, PATHS } from "../config/index.js";
import { collectImpregnableDefensePaths } from "../processors/impregnable-defense-config.js";
import { parseStepLoc } from "../processors/commission-loc-utils.js";
import { validateCompleteRoles } from "./party-config.js";
import { probeRegistry } from "../probes/index.js";
import { loadAllBranchConfigs } from "./branch-config.js";
import { buildProcessBasePath, scanCommissionScopes } from "./process-scope.js";
import { loadUserConfig } from "./user-config.js";

const RETRY_MODES = new Set(["throw", "return-false", "all"]);

/**
 * 遍历所有 process.json 做静态校验
 * @param {Object} registry - StepProcessorRegistry 实例
 * @param {Array} [commissionScopes] - 可复用的流程范围快照；不传时扫描一次流程目录
 * @returns {Promise<number>} 发现的错误数（0 表示全部通过）
 */
export async function validateAllProcesses(registry, commissionScopes) {
    log.info("开始静态校验流程文件...");
    const scopes = commissionScopes ?? scanCommissionScopes().list;
    let errors = 0;
    errors += await validateNpcProcesses(registry, scopes);
    errors += await validateBasicProcesses(registry, scopes);
    errors += validateBranchConfig();
    errors += validatePartyConfig();

    if (errors > 0) {
        log.debug("流程文件静态校验发现 {n} 处问题，详见上面的日志", errors);
    } else {
        log.info("流程文件静态校验通过");
    }
    return errors;
}

function normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/\/+$/g, "");
}

function referenceKey(path) {
    return normalizePath(path).toLowerCase();
}

function readJsonFile(path, description) {
    if (!file.isFile(path)) {
        log.debug("[{path}] {description}不存在", path, description);
        return { ok: false };
    }
    try {
        return { ok: true, value: JSON.parse(file.readTextSync(path)) };
    } catch (error) {
        log.debug("[{path}] {description} JSON 解析失败: {error}", path, description, error.message);
        return { ok: false };
    }
}

function resolveSafeReference(resourceDir, reference, processPath, stepNumber, stepType, fieldName) {
    if (typeof reference !== "string" || !reference.trim()) {
        log.debug("[{path}] 步骤 #{n} ({type}) {field} 必须是非空路径字符串",
            processPath, stepNumber, stepType, fieldName);
        return null;
    }
    const normalized = reference.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+/g, "/");
    const parts = normalized.split("/");
    if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) ||
        /[:*?"<>|]/.test(normalized) || parts.includes(".") || parts.includes("..")) {
        log.debug("[{path}] 步骤 #{n} ({type}) {field} 必须是当前流程目录内的安全相对路径: {file}",
            processPath, stepNumber, stepType, fieldName, reference);
        return null;
    }
    if (!normalized.toLowerCase().endsWith(".json")) {
        log.debug("[{path}] 步骤 #{n} ({type}) {field} 必须指向 .json 文件: {file}",
            processPath, stepNumber, stepType, fieldName, reference);
        return null;
    }
    return normalizePath(resourceDir) + "/" + normalized;
}

function validatePathFile(path, description) {
    const loaded = readJsonFile(path, description);
    if (!loaded.ok) return 1;
    const data = loaded.value;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        log.debug("[{path}] {description}根节点必须是对象", path, description);
        return 1;
    }
    if (!Array.isArray(data.positions)) {
        log.debug("[{path}] {description}缺少 positions 数组", path, description);
        return 1;
    }
    const hasValidPoint = data.positions.some(position => position && position.type !== "orientation" &&
        Number.isFinite(position.id) && Number.isFinite(position.x) && Number.isFinite(position.y));
    if (!hasValidPoint) {
        log.debug("[{path}] {description}没有有效坐标点", path, description);
        return 1;
    }
    return 0;
}

function validateMacroFile(path, description) {
    const loaded = readJsonFile(path, description);
    if (!loaded.ok) return 1;
    const data = loaded.value;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        log.debug("[{path}] {description}根节点必须是对象", path, description);
        return 1;
    }
    if (!Array.isArray(data.macroEvents) || data.macroEvents.length === 0) {
        log.debug("[{path}] {description}必须包含非空 macroEvents 数组", path, description);
        return 1;
    }
    for (let index = 0; index < data.macroEvents.length; index++) {
        const event = data.macroEvents[index];
        if (!event || typeof event !== "object" || Array.isArray(event)) {
            log.debug("[{path}] {description} macroEvents[{index}] 必须是对象", path, description, index);
            return 1;
        }
        if (!Number.isInteger(event.type) || event.type < 0 || event.type > 6) {
            log.debug("[{path}] {description} macroEvents[{index}].type 必须是 0 至 6", path, description, index);
            return 1;
        }
        if (!Number.isFinite(event.time) || event.time < 0) {
            log.debug("[{path}] {description} macroEvents[{index}].time 必须是非负有限数字", path, description, index);
            return 1;
        }
        if ((event.type === 0 || event.type === 1) &&
            (!Number.isInteger(event.keyCode) || event.keyCode < 1 || event.keyCode > 255)) {
            log.debug("[{path}] {description} macroEvents[{index}].keyCode 必须是 1 至 255 的整数", path, description, index);
            return 1;
        }
        if (event.type >= 2 && event.type <= 6 &&
            (!Number.isFinite(event.mouseX) || !Number.isFinite(event.mouseY))) {
            log.debug("[{path}] {description} macroEvents[{index}] 缺少合法 mouseX/mouseY", path, description, index);
            return 1;
        }
        if ((event.type === 4 || event.type === 5) && !["Left", "Right", "Middle"].includes(event.mouseButton)) {
            log.debug("[{path}] {description} macroEvents[{index}].mouseButton 只能是 Left、Right 或 Middle",
                path, description, index);
            return 1;
        }
    }
    return 0;
}

async function validateNpcProcesses(registry, scopes) {
    let errors = 0;

    for (const scope of scopes) {
        if (scope.type !== COMMISSION_TYPE.NPC) continue;
        const baseDir = buildProcessBasePath(scope.country, COMMISSION_TYPE.NPC);
        const processDir = baseDir + "/" + scope.commissionName + "/" + scope.locationDir;
        const processPath = processDir + "/process.json";
        const loaded = readJsonFile(processPath, "流程文件");
        if (!loaded.ok) {
            errors++;
            continue;
        }
        if (!Array.isArray(loaded.value)) {
            log.debug("[{path}] 流程文件根节点必须是步骤数组", processPath);
            errors++;
            continue;
        }
        if (loaded.value.length === 0) log.debug("[{path}] 流程为空，没有可执行步骤", processPath);
        errors += await validateProcessSteps(
            registry,
            processPath,
            loaded.value,
            processDir,
            scope.commissionName,
            new Set([referenceKey(processPath)])
        );
    }
    return errors;
}

async function validateBasicProcesses(registry, scopes) {
    let errors = 0;

    for (const scope of scopes) {
        if (scope.type !== COMMISSION_TYPE.BASIC) continue;
        const baseDir = buildProcessBasePath(scope.country, COMMISSION_TYPE.BASIC);
        const processDir = baseDir + "/" + scope.commissionName + "/" + scope.locationDir;
        const processPath = processDir + "/process.json";
        const mapPath = processDir + "/_path.json";
        errors += validatePathFile(mapPath, "Basic 必需路径文件");

        const loaded = readJsonFile(processPath, "流程文件");
        if (!loaded.ok) {
            errors++;
            continue;
        }
        if (!Array.isArray(loaded.value)) {
            log.debug("[{path}] 流程文件根节点必须是步骤数组", processPath);
            errors++;
            continue;
        }
        if (loaded.value.length === 0) log.debug("[{path}] 流程为空，没有可执行步骤", processPath);
        errors += await validateProcessSteps(
            registry,
            processPath,
            loaded.value,
            processDir,
            scope.commissionName,
            new Set([referenceKey(processPath)])
        );
    }
    return errors;
}

/**
 * 对一份流程的步骤数组做校验
 *
 * @param {Object} registry
 * @param {string} processPath - 用于日志定位
 * @param {Array} steps - loader 返回的 step 数组
 * @param {string} resourceDir - 当前委托地点目录，所有资源引用均相对此目录解析
 * @param {string} commissionName - 当前委托名，用于分支配置校验
 * @param {Set<string>} stack - 当前递归栈中的流程路径，用于检测循环引用
 */
async function validateProcessSteps(registry, processPath, steps, resourceDir, commissionName, stack = new Set()) {
    let errors = 0;

    async function validateReferencedProcess(reference, stepNumber, stepType, fieldName, guarded) {
        const subPath = resolveSafeReference(resourceDir, reference, processPath, stepNumber, stepType, fieldName);
        if (!subPath) {
            errors++;
            return;
        }
        const stackKey = referenceKey(subPath);
        if (stack.has(stackKey)) {
            if (guarded) {
                log.debug("[{path}] 步骤 #{n} ({type}) 检测到由 desc 条件保护的循环引用: {file}",
                    processPath, stepNumber, stepType, reference);
            } else {
                log.debug("[{path}] 步骤 #{n} ({type}) 检测到无条件循环引用: {file}",
                    processPath, stepNumber, stepType, reference);
                errors++;
            }
            return;
        }
        const loaded = readJsonFile(subPath, "子流程文件");
        if (!loaded.ok) {
            errors++;
            return;
        }
        if (!Array.isArray(loaded.value)) {
            log.debug("[{path}] 步骤 #{n} ({type}) 子流程根节点必须是步骤数组: {file}",
                processPath, stepNumber, stepType, reference);
            errors++;
            return;
        }
        if (loaded.value.length === 0) {
            log.debug("[{path}] 步骤 #{n} ({type}) 子流程为空: {file}",
                processPath, stepNumber, stepType, reference);
        }
        stack.add(stackKey);
        try {
            errors += await validateProcessSteps(
                registry,
                `${processPath} → ${reference}`,
                loaded.value,
                resourceDir,
                commissionName,
                stack
            );
        } finally {
            stack.delete(stackKey);
        }
    }
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        if (!step || typeof step !== "object" || Array.isArray(step)) {
            log.debug("[{path}] 步骤 #{n} 必须是对象格式，收到: {value}", processPath, i + 1, step);
            errors++;
            continue;
        }

        errors += validateCommonStepFields(processPath, i + 1, step);

        const stepType = step.type;
        if (!registry.has(stepType)) {
            log.debug("[{path}] 步骤 #{n} 未知 type: {type}", processPath, i + 1, stepType);
            errors++;
            continue;
        }

        const dataResult = registry.validateData(stepType, step.data);
        if (!dataResult.ok) {
            log.debug("[{path}] 步骤 #{n} ({type}) 校验失败: {error}", processPath, i + 1, stepType, dataResult.error);
            errors++;
        }

        // 嵌套校验：用户分支选择 的 step.data[branchKey] 是嵌套 step 对象
        if (stepType === "用户分支选择" && step.data && typeof step.data === "object" && !Array.isArray(step.data)) {
            const branchConfig = loadAllBranchConfigs()[commissionName];
            if (!branchConfig || !branchConfig.descriptions || typeof branchConfig.descriptions !== "object" ||
                Array.isArray(branchConfig.descriptions)) {
                log.debug("[{path}] 步骤 #{n} ({type}) 当前委托没有有效分支配置",
                    processPath, i + 1, stepType);
                errors++;
            } else {
                const configured = Object.keys(branchConfig.descriptions);
                const actual = Object.keys(step.data);
                const unknown = actual.filter(key => !configured.includes(key));
                const missing = configured.filter(key => !actual.includes(key));
                if (unknown.length || missing.length) {
                    log.debug("[{path}] 步骤 #{n} ({type}) 与分支配置不一致，未知: {unknown}，缺少: {missing}",
                        processPath, i + 1, stepType, unknown.join("、") || "无", missing.join("、") || "无");
                    errors++;
                }
            }
            for (const [branchKey, branchStep] of Object.entries(step.data)) {
                if (!branchStep || typeof branchStep !== "object" || Array.isArray(branchStep)) continue;
                errors += await validateProcessSteps(
                    registry,
                    `${processPath} → 用户分支 ${branchKey}`,
                    [branchStep],
                    resourceDir,
                    commissionName,
                    stack
                );
            }
        }

        // 路径、宏和子流程引用都必须是当前委托目录内的安全 JSON 相对路径。
        if (stepType === "地图追踪" && typeof step.data === "string") {
            const mapPath = resolveSafeReference(resourceDir, step.data, processPath, i + 1, stepType, "data");
            if (!mapPath) errors++;
            else errors += validatePathFile(mapPath, "地图追踪文件");
        }

        if (stepType === "键鼠脚本" && typeof step.data === "string") {
            const macroPath = resolveSafeReference(resourceDir, step.data, processPath, i + 1, stepType, "data");
            if (!macroPath) errors++;
            else errors += validateMacroFile(macroPath, "键鼠脚本文件");
        }

        if (stepType === "摧毁哨塔" && step.data && typeof step.data === "object" &&
            step.data.navigation === "路径追踪") {
            const pathFields = typeof step.data.path === "string" ? ["path"] : ["path1", "path2"];
            for (const field of pathFields) {
                if (typeof step.data[field] !== "string") continue;
                const mapPath = resolveSafeReference(resourceDir, step.data[field], processPath, i + 1, stepType, `data.${field}`);
                if (!mapPath) errors++;
                else errors += validatePathFile(mapPath, `摧毁哨塔${field}路径文件`);
            }
        }

        if (stepType === "固若金汤") {
            const defenseConfig = collectImpregnableDefensePaths(step.data);
            if (defenseConfig.ok) {
                for (const pathRef of defenseConfig.paths) {
                    const mapPath = resolveSafeReference(resourceDir, pathRef, processPath, i + 1, stepType, "波次路径");
                    if (!mapPath) errors++;
                    else errors += validatePathFile(mapPath, "固若金汤波次路径文件");
                }
            }
        }

        if (stepType === "执行子流程" && step.data && typeof step.data.path === "string") {
            await validateReferencedProcess(step.data.path, i + 1, stepType, "data.path",
                typeof step.desc === "string" && Boolean(step.desc.trim()));
        }

    }
    return errors;
}

function validateCommonStepFields(processPath, stepNumber, step) {
    let errors = 0;

    for (const fieldName of ["note", "desc"]) {
        if (step[fieldName] !== undefined && typeof step[fieldName] !== "string") {
            log.debug("[{path}] 步骤 #{n} {field} 必须是字符串", processPath, stepNumber, fieldName);
            errors++;
        }
    }
    if (step.retry !== undefined && (!Number.isInteger(step.retry) || step.retry < 0)) {
        log.debug("[{path}] 步骤 #{n} retry 必须是非负整数", processPath, stepNumber);
        errors++;
    }
    if (step.retryOn !== undefined && !RETRY_MODES.has(step.retryOn)) {
        log.debug("[{path}] 步骤 #{n} retryOn 只能是 throw、return-false 或 all", processPath, stepNumber);
        errors++;
    }

    const locResult = parseStepLoc(step.loc);
    if (!locResult.ok) {
        log.debug("[{path}] 步骤 #{n} loc 校验失败: {error}", processPath, stepNumber, locResult.error);
        errors++;
    }

    return errors;
}

/**
 * 校验 config/branches/ 下的所有分支配置文件和账户状态中合成的完成进度。
 *
 * 检查项：
 *   1. conditions[branchKey].type 必须在 probeRegistry 中注册
 *   2. 委托给探针自己的 validate(cond)（schema 检查下沉到探针）
 *   3. conditions / default 中出现的分支 key 必须在 descriptions 中（孤儿告警）
 *   4. completed 中的分支必须在 conditions 中（偏好分支不应进 completed）
 *   5. note 仅允许纯文本，UI 不再消费 noteLevel
 *
 * 加载错误（目录不存在 / 单文件 JSON 解析失败）由 loadAllBranchConfigs 自行记录，
 * 此处只校验已成功解析的内容
 */
function validateBranchConfig() {
    const composite = loadAllBranchConfigs();
    if (!composite || Object.keys(composite).length === 0) {
        log.debug("分支配置为空，跳过校验: {dir}", PATHS.BRANCHES_DIR);
        return 0;
    }

    let errors = 0;
    const registeredTypes = probeRegistry.types().join(", ");
    for (const commissionName of Object.keys(composite)) {
        const cfg = composite[commissionName];
        const filePath = PATHS.BRANCHES_DIR + "/" + commissionName + ".json";
        if (!cfg || typeof cfg !== "object") {
            log.debug("[{path}] 配置必须是对象", filePath);
            errors++;
            continue;
        }

        const descriptions = cfg.descriptions || {};
        const conditions = cfg.conditions || {};
        const completedByUid = cfg.completedByUid || {};
        if (cfg.completedByUid === undefined) {
            log.debug("[{path}] 缺少 completedByUid", filePath);
            errors++;
        }
        if (cfg.completed !== undefined) {
            log.debug("[{path}] completed 已废弃，请使用 completedByUid", filePath);
            errors++;
        }
        if (!completedByUid || typeof completedByUid !== "object" || Array.isArray(completedByUid)) {
            log.debug("[{path}] completedByUid 必须是对象", filePath);
            errors++;
        }
        if (cfg.note !== undefined && typeof cfg.note !== "string") {
            log.debug("[{path}] note 必须是字符串", filePath);
            errors++;
        }
        if (cfg.noteLevel !== undefined) {
            log.debug("[{path}] noteLevel 已废弃，请移除该字段", filePath);
        }

        // 1-2: 每个 condition 用探针注册表校验
        for (const branchKey of Object.keys(conditions)) {
            const cond = conditions[branchKey];
            if (!cond || typeof cond !== "object") {
                log.debug("[{path}] conditions.{br} 必须是对象", filePath, branchKey);
                errors++;
                continue;
            }
            if (!probeRegistry.has(cond.type)) {
                log.debug("[{path}] conditions.{br}.type 未注册: {t}（已注册类型: {list}）",
                    filePath, branchKey, cond.type, registeredTypes);
                errors++;
                continue;
            }
            const probe = probeRegistry.get(cond.type);
            if (probe.validate) {
                const result = probe.validate(cond);
                if (!result.ok) {
                    log.debug("[{path}] conditions.{br} ({t}) 校验失败: {error}",
                        filePath, branchKey, cond.type, result.error);
                    errors++;
                }
            }
        }

        // 3: 孤儿分支告警（key 不在 descriptions 中）
        for (const branchKey of Object.keys(conditions)) {
            if (!descriptions[branchKey]) {
                log.debug("[{path}] conditions.{br} 不在 descriptions 中，UI 将无法显示该分支",
                    filePath, branchKey);
            }
        }
        if (cfg.default && !descriptions[cfg.default]) {
            log.debug("[{path}] default = {br} 不在 descriptions 中", filePath, cfg.default);
        }

        // 4: completedByUid 中的分支必须在 conditions 中
        if (completedByUid && typeof completedByUid === "object" && !Array.isArray(completedByUid)) {
            for (const uid of Object.keys(completedByUid)) {
                if (!/^\d+$/.test(uid)) {
                    log.debug("[{path}] completedByUid 包含非数字 UID: {uid}", filePath, uid);
                }
                const completed = completedByUid[uid];
                if (!Array.isArray(completed)) {
                    log.debug("[{path}] completedByUid.{uid} 必须是数组", filePath, uid);
                    errors++;
                    continue;
                }
                for (const branchKey of completed) {
                    if (!conditions[branchKey]) {
                        log.debug("[{path}] completedByUid.{uid} 包含偏好分支 {br}（未在 conditions 中声明），运行时不会被使用",
                            filePath, uid, branchKey);
                    }
                }
            }
        }
    }
    return errors;
}

function validatePartyModeConfig(config, filePath, fieldName, { allowStrategy }) {
    let errors = 0;
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        log.debug("[{path}] {field} 必须是对象", filePath, fieldName);
        return 1;
    }

    if (config.mode !== undefined && config.mode !== "global" && config.mode !== "custom") {
        log.debug("[{path}] {field}.mode 只能是 global 或 custom", filePath, fieldName);
        errors++;
    }
    if (config.teamMode !== undefined && config.teamMode !== "teamName" && config.teamMode !== "roles") {
        log.debug("[{path}] {field}.teamMode 只能是 teamName 或 roles", filePath, fieldName);
        errors++;
    }
    if (config.teamName !== undefined && typeof config.teamName !== "string") {
        log.debug("[{path}] {field}.teamName 必须是字符串", filePath, fieldName);
        errors++;
    }
    if (config.customTeamName !== undefined && typeof config.customTeamName !== "string") {
        log.debug("[{path}] {field}.customTeamName 必须是字符串", filePath, fieldName);
        errors++;
    }
    if (config.mode === "custom" && config.teamMode === undefined) {
        log.debug("[{path}] {field}.teamMode 在 custom 模式下必填", filePath, fieldName);
        errors++;
    }
    if (config.mode === "custom" && config.teamMode === "teamName" &&
        (typeof config.teamName !== "string" || !config.teamName.trim())) {
        log.debug("[{path}] {field}.teamName 在 custom/teamName 模式下必须是非空字符串", filePath, fieldName);
        errors++;
    }
    if (config.mode === "custom" && config.teamMode === "roles") {
        if (typeof config.customTeamName !== "string" || !config.customTeamName.trim()) {
            log.debug("[{path}] {field}.customTeamName 在 custom/roles 模式下必须是非空字符串", filePath, fieldName);
            errors++;
        }
        const roleResult = validateCompleteRoles(config.roles);
        if (!roleResult.ok) {
            log.debug("[{path}] {field} 角色配置无效: {error}", filePath, fieldName, roleResult.error);
            errors++;
        }
    }
    if (allowStrategy) {
        if (config.strategy !== undefined && typeof config.strategy !== "string") {
            log.debug("[{path}] {field}.strategy 必须是字符串", filePath, fieldName);
            errors++;
        }
    } else if (config.strategy !== undefined) {
        log.debug("[{path}] {field}.strategy 不会被使用，建议移除", filePath, fieldName);
    }

    return errors;
}

function validatePartyConfig() {
    if (!file.isFolder(PATHS.ACCOUNT_CONFIG_DIR)) return 0;
    let errors = 0;
    for (const filePath of Array.from(file.readPathSync(PATHS.ACCOUNT_CONFIG_DIR) || []).filter((path) => file.isFile(path))) {
        const normalizedPath = String(filePath).replace(/\\/g, "/");
        const fileName = normalizedPath.split("/").pop() || "";
        if (!/^\d+\.json$/.test(fileName)) {
            log.debug("[{path}] UID 配置文件名必须为纯数字 UID.json", filePath);
            errors++;
            continue;
        }
        let account;
        try {
            account = JSON.parse(file.readTextSync(filePath));
        } catch (error) {
            log.debug("[{path}] UID 配置 JSON 解析失败: {error}", filePath, error.message);
            errors++;
            continue;
        }
        const uid = fileName.slice(0, -5);
        if (!account || typeof account !== "object" || Array.isArray(account)) {
            log.debug("[{path}] UID 配置根节点必须是对象", filePath);
            errors++;
            continue;
        }
        if (account.uid !== uid) {
            log.debug("[{path}] 文件名 UID 与内部 uid 不一致", filePath);
            errors++;
        }
        if (!Array.isArray(account.commissions)) {
            log.debug("[{path}] commissions 必须是数组", filePath);
            errors++;
        }
        if (!account.branchCompleted || typeof account.branchCompleted !== "object" || Array.isArray(account.branchCompleted)) {
            log.debug("[{path}] branchCompleted 必须是对象", filePath);
            errors++;
        }
        errors += validateAccountPartyConfig(account.settings, filePath);
    }
    return errors;
}

function validateAccountPartyConfig(settings, filePath) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        log.debug("[{path}] settings 必须是对象", filePath);
        return 1;
    }
    if (!settings.party || typeof settings.party !== "object" || Array.isArray(settings.party)) {
        log.debug("[{path}] party 必须是对象", filePath);
        return 1;
    }
    let errors = 0;
    const global = settings.party.global;
    if (!global || typeof global !== "object" || Array.isArray(global)) {
        log.debug("[{path}] party.global 必须是对象", filePath);
        errors++;
    } else {
        if (typeof global.battleTeamName !== "string" || !global.battleTeamName.trim()) {
            log.debug("[{path}] party.global.battleTeamName 必须是非空字符串", filePath);
            errors++;
        }
        if (typeof global.elementTeamName !== "string" || !global.elementTeamName.trim()) {
            log.debug("[{path}] party.global.elementTeamName 必须是非空字符串", filePath);
            errors++;
        }
        for (const field of ["customBattleTeamName", "customElementTeamName", "battleStrategy"]) {
            if (global[field] !== undefined && typeof global[field] !== "string") {
                log.debug("[{path}] party.global.{field} 必须是字符串", filePath, field);
                errors++;
            }
        }
    }
    if (!settings.party.scopes || typeof settings.party.scopes !== "object" || Array.isArray(settings.party.scopes)) {
        log.debug("[{path}] party.scopes 必须是对象", filePath);
        return errors + 1;
    }
    for (const [scopeKey, config] of Object.entries(settings.party.scopes)) {
        const scopePath = `${filePath}#party.scopes.${scopeKey}`;
        if (!scopeKey.split("/").every(Boolean) || scopeKey.split("/").length !== 4) {
            log.debug("[{path}] scope 键必须是 country/type/commission/location", scopePath);
            errors++;
        }
        if (!config || typeof config !== "object" || Array.isArray(config)) {
            log.debug("[{path}] 委托队伍配置必须是对象", scopePath);
            errors++;
            continue;
        }
        errors += validatePartyModeConfig(config.battle || {}, scopePath, "battle", { allowStrategy: true });
        errors += validatePartyModeConfig(config.collect || {}, scopePath, "collect", { allowStrategy: false });
    }
    return errors;
}
