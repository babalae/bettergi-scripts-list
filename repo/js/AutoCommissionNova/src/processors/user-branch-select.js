/**
 * 用户分支选择步骤处理器
 *
 * 分支配置存储：config/branches/{委托名}.json（每个委托一个文件）
 * 内存视图：合并后的 composite { 委托名: config }，缓存在 context.branchConfigCache
 *
 * 每个委托的 config 结构：
 *   {
 *       descriptions: { branchKey: 显示文字 },   // 此委托存在的所有分支（UI 唯一来源）
 *       conditions:   { branchKey: { type, ... } }, // 成就分支 + 探测达成方式（缺则为偏好分支）
 *       completed:    [branchKey],               // 已永久解锁的成就分支
 *       default:      branchKey,                  // 没有可追的分支时的兜底（通常指偏好分支）
 *       type, note                                // UI 用
 *   }
 *
 * 选择逻辑：
 *   queue = Object.keys(conditions || {}) 中 filter 掉 completed 里的（按声明顺序）
 *   有 queue → 跑 queue[0]
 *   queue 空 → 跑 default（用户配置 default 优先；其次 step.default）
 *
 * 一次委托内多次 用户分支选择 step 共享决策：
 *   首次决策后 context.activeBranch 被写入；后续遇到同 step 时直接复用 activeBranch，
 *   保证一条流程内所有 用户分支选择 step 选定同一分支。
 *
 * 探针机制：
 *   决策时把 conditions[branchKey] 写入 context.branchCondition；
 *   对话 step / 成就检测 step 据此写 context.branchConditionMet；
 *   commission-executor.updateBranchCompletion 据此判定是否把 activeBranch 写入 completed。
 */
import { defineStep } from "./define-step.js";
import { getBranchCompletedByUid, getBranchConfigUids, loadAllBranchConfigs } from "../loaders/branch-config.js";
import { getCurrentUid } from "../utils/account-utils.js";

function validateBranchData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: "用户分支选择 data 必须是分支对象" };
    }
    const entries = Object.entries(data);
    if (!entries.length) return { ok: false, error: "用户分支选择至少需要一个分支步骤" };
    for (const [key, step] of entries) {
        if (!key.trim()) return { ok: false, error: "用户分支选择的分支键不能为空" };
        if (!step || typeof step !== "object" || Array.isArray(step) || typeof step.type !== "string" || !step.type.trim()) {
            return { ok: false, error: "用户分支选择分支 " + key + " 必须是有效步骤对象" };
        }
    }
    return { ok: true, value: data };
}

function getBranchName(descriptions, branchKey) {
    if (descriptions && descriptions[branchKey]) {
        return descriptions[branchKey];
    }
    return branchKey;
}

function loadBranchConfig(context) {
    if (context.branchConfigCache) {
        return context.branchConfigCache;
    }
    try {
        const composite = loadAllBranchConfigs();
        context.branchConfigCache = composite;
        log.info("已加载分支配置（{n} 个委托）并缓存", Object.keys(composite).length);
        return composite;
    } catch (error) {
        log.warn("加载分支配置失败，使用空配置: {error}", error.message);
        context.branchConfigCache = {};
        return context.branchConfigCache;
    }
}

/**
 * 根据 conditions 和 completed 决策本次要执行的分支
 * 返回 { branchKey, condition } —— condition 为 null 表示偏好分支
 */
function decideBranch(commissionConfig, step, descriptions, accountUid) {
    const conditions = (commissionConfig && commissionConfig.conditions) || {};
    const completed = getBranchCompletedByUid(commissionConfig, accountUid);

    // 按声明顺序遍历 conditions，挑第一个未完成的
    const queue = Object.keys(conditions).filter(k => !completed.includes(k));
    if (queue.length > 0) {
        const branchKey = queue[0];
        log.info("选择第一个未完成的成就分支: {branch}", getBranchName(descriptions, branchKey));
        return { branchKey, condition: conditions[branchKey] };
    }

    // 无未完成成就分支 → 走 default
    const defaultBranch = (commissionConfig && commissionConfig.default) || step.default || null;
    if (!defaultBranch) {
        log.warn("无成就分支可执行，且未设置默认分支");
        return { branchKey: null, condition: null };
    }
    log.info("无成就分支可执行，使用默认分支: {branch}", getBranchName(descriptions, defaultBranch));
    // default 也可能在 conditions 里（虽然反常），如果命中则把它当成就分支处理
    return { branchKey: defaultBranch, condition: conditions[defaultBranch] || null };
}

export default defineStep({
    type: "用户分支选择",
    category: "成就分支",
    dataSpec: {
        kind: "custom",
        editor: "branches",
        label: "分支步骤",
        validate: validateBranchData,
    },
    swallow: true,
    run: async (step, context) => {
        const config = loadBranchConfig(context);
        if (!context.accountUid) {
            const accountUid = await getCurrentUid({ knownUids: getBranchConfigUids(config) });
            if (accountUid) {
                context.accountUid = accountUid;
            }
        }

        const commissionConfig = config[context.commissionName];
        const descriptions = (commissionConfig && commissionConfig.descriptions) || {};
        if (commissionConfig) {
            const configured = Object.keys(descriptions);
            const actual = Object.keys(step.data || {});
            const unknown = actual.filter(key => !configured.includes(key));
            const missing = configured.filter(key => !actual.includes(key));
            if (unknown.length || missing.length) {
                throw new Error("用户分支选择与分支配置不一致" +
                    (unknown.length ? "，未知分支: " + unknown.join("、") : "") +
                    (missing.length ? "，缺少分支: " + missing.join("、") : ""));
            }
        }

        // 一次委托内的后续 用户分支选择 step 直接复用首次锁定的分支
        if (context.activeBranch) {
            const branchStep = step.data ? step.data[context.activeBranch] : null;
            if (!branchStep) {
                log.warn("复用已锁定分支 {branch}，但当前 step.data 未定义该分支，跳过",
                    getBranchName(descriptions, context.activeBranch));
                return;
            }
            log.info("复用已锁定分支: {branch}", getBranchName(descriptions, context.activeBranch));
            await context.stepRegistry.process(branchStep, context);
            return;
        }

        // 首次决策
        const { branchKey, condition } = decideBranch(commissionConfig, step, descriptions, context.accountUid);
        if (!branchKey) {
            return;
        }

        const branchStep = step.data ? step.data[branchKey] : null;
        if (!branchStep) {
            log.warn("未在 step.data 中找到分支 {branch} 的定义，跳过", getBranchName(descriptions, branchKey));
            return;
        }

        // 锁定分支，注入 condition；branchConditionMet 留给探针 step 写
        context.activeBranch = branchKey;
        context.branchCondition = condition;
        if (condition) {
            log.info("锁定成就分支 {branch}，探针类型: {type}",
                getBranchName(descriptions, branchKey), condition.type);
        } else {
            log.info("锁定偏好分支 {branch}（不写入完成进度）", getBranchName(descriptions, branchKey));
        }

        await context.stepRegistry.process(branchStep, context);
    },
});
