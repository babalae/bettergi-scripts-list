/**
 * 测试执行模块
 * 跳过识别流程，直接运行流程文件或单元测试
 *
 * 由开发者测试遮罩传入配置，支持 case、basic、npc 三种测试模式。
 */
import { PATHS, COMMISSION_TYPE } from "../config/index.js";
import { prepareForCommission } from "./main-process.js";
import { loadNpcProcessFile, loadBasicProcess } from "../loaders/index.js";
import { trackCommission } from "../navigation/index.js";
import { createCommissionContext, runStepsWithContext } from "./commission-context.js";
import { stepRegistry } from "../processors/registry.js";

/**
 * 测试配置区
 * 修改这里的配置来切换测试模式
 */
const TEST_CONFIG = {
    mode: "basic",               // 测试模式: "case" | "basic" | "npc"
    caseName: "开启挑战测试",      // mode="case" 时生效，对应 test/process/ 下的目录名
    country: "挪德卡莱",           // mode="basic" / "npc" 时生效
    commissionName: "攀高危险",    // mode="basic" / "npc" 时生效
    location: "伦波岛-2",          // mode="basic" / "npc" 时生效
    processFile: "process.json",   // mode="basic" / "npc" 时生效
    /**
     * 仅 case 模式有效：测试探针 step（成就检测 / 对话探针 等）时，绕过 用户分支选择
     * step 锁定流程，直接给 context.branchCondition 注入指定 condition。
     * 不需要时置 null
     * 示例：{ type: "achievement", name: "迷踪猎人" }
     *       { type: "dialog", keywords: ["偷偷吃了"] }
     *       { type: "completion" }
     */
    branchCondition: null,
};

/**
 * 执行测试
 * @returns {Promise<boolean>} 执行是否成功
 */
export async function runTestCommission(config = TEST_CONFIG) {
    log.info("=== 测试模式已启用 ===");

    if (config.mode === "case") {
        return await runTestCase(config.caseName, config.branchCondition);
    }
    if (config.mode === "basic") return await runBasicCommission(config);
    if (config.mode === "npc") return await runNpcCommission(config);

    log.error("未知测试模式: {mode}，可用模式为 case、basic、npc", config.mode);
    return false;
}

/**
 * 运行测试用例（从 test/process/ 加载）
 * @param {string} caseName - 测试用例名称
 * @returns {Promise<boolean>}
 */
async function runTestCase(caseName, branchCondition = null) {
    const testCaseDir = `test/process/${caseName}`;
    const testCasePath = `${testCaseDir}/process.json`;
    log.info("=== 开始运行测试用例: {name} ===", caseName);

    try {
        const processContent = file.readTextSync(testCasePath);
        const processSteps = JSON.parse(processContent);
        log.info("加载流程步骤数量: {count}", processSteps.length);

        // 用 BASIC 类型构造 context，让 resolveResource 指向测试用例目录
        const context = createCommissionContext({
            type: COMMISSION_TYPE.BASIC,
            commissionName: caseName,
            location: "测试位置",
            processSteps,
            stepRegistry,
            processDir: testCaseDir,
        });

        // 测试探针 step 时直接注入 branchCondition，跳过 用户分支选择 决策
        // dispatchExplicit / dispatchOnDialogOcr / dispatchOnCommissionComplete 都依赖
        // context.branchCondition 非空才会派发到对应探针
        if (branchCondition) {
            context.branchCondition = branchCondition;
            context.activeBranch = "test-branch";
            log.info("测试模式注入 branchCondition: {cond}", JSON.stringify(branchCondition));
        }

        const success = await runStepsWithContext(context, { sleepMs: 1000, stopOnError: false });
        log.info("=== 测试用例执行完成: {success} ===", success ? "成功" : "失败");
        return success;
    } catch (error) {
        log.error("测试用例执行失败: {error}", error.message);
        return false;
    }
}

/**
 * 运行真实 Basic 委托流程。
 * @param {Object} config - 测试配置
 * @returns {Promise<boolean>}
 */
async function runBasicCommission(config) {
    const { country = "蒙德", commissionName, location, processFile = "process.json" } = config;
    const processDir = `${PATHS.PROCESS_ROOT}/${country}/Basic/${commissionName}/${location}`;
    const processPath = `${processDir}/${processFile}`;
    log.info("=== 开始测试 Basic 委托: {name} ({country}/{location}) ===", commissionName, country, location);

    try {
        await genshin.returnMainUi();
        await prepareForCommission();
        await trackCommission(commissionName);

        const processSteps = await loadBasicProcess(processPath);
        if (!processSteps || processSteps.length === 0) {
            log.error("未找到 Basic 流程文件或流程为空: {path}", processPath);
            return false;
        }

        log.info("加载流程步骤数量: {count}", processSteps.length);

        const context = createCommissionContext({
            type: COMMISSION_TYPE.BASIC,
            country,
            commissionName,
            location,
            processSteps,
            stepRegistry,
            processDir,
        });

        const success = await runStepsWithContext(context, { sleepMs: 1000, stopOnError: false });
        log.info("=== Basic 测试流程执行完成: {success} ===", success ? "成功" : "失败");
        return success;
    } catch (error) {
        log.error("Basic 测试流程执行失败: {error}", error.message);
        return false;
    }
}

/**
 * 运行真实 NPC 委托流程。
 * @param {Object} config - 测试配置
 * @returns {Promise<boolean>}
 */
async function runNpcCommission(config) {
    const { country = "蒙德", commissionName, location, processFile = "process.json" } = config;
    log.info("=== 开始测试 NPC 委托: {name} ({country}/{location}) ===", commissionName, country, location);

    try {
        await genshin.returnMainUi();
        await prepareForCommission();

        const processSteps = await loadNpcProcessFile(commissionName, location, processFile, country);
        if (!processSteps || processSteps.length === 0) {
            const processPath = `${PATHS.PROCESS_ROOT}/${country}/NPC/${commissionName}/${location}/${processFile}`;
            log.error("未找到 NPC 流程文件或流程为空: {path}", processPath);
            return false;
        }

        log.info("加载流程步骤数量: {count}", processSteps.length);

        const context = createCommissionContext({
            type: COMMISSION_TYPE.NPC,
            country,
            commissionName,
            location,
            processSteps,
            stepRegistry,
        });

        const success = await runStepsWithContext(context, { sleepMs: 2000, stopOnError: false });
        log.info("=== NPC 测试流程执行完成: {success} ===", success ? "成功" : "失败");
        return success;
    } catch (error) {
        log.error("NPC 测试流程执行失败: {error}", error.message);
        return false;
    }
}
