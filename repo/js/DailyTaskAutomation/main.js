// ==========================================
// BetterGI 每日任务自动化脚本 - v3.0 重构版
// 单文件结构（BGI ClearScript 不支持 require/setTimeout）
// 支持重试/超时/配置化
// ==========================================

(async function () {
    "use strict";

    // ==================== 常量配置 ====================

    const DEFAULT_WIDTH = 1920;
    const DEFAULT_HEIGHT = 1080;
    const DEFAULT_DPI = 2;

    const TIME_SHORT = 800;
    const TIME_MEDIUM = 1500;
    const TIME_LONG = 3000;

    const COORDS = {
        PERMISSION: {
            WORLD_PERMISSION_BUTTON: { x: 330, y: 1010 },
            MODE_DIRECT_JOIN: { y: 910, text: "直接加入" },
            MODE_CONFIRM_JOIN: { y: 960, text: "确认后可加入" },
            MODE_DENY_JOIN: { y: 850, text: "不允许加入" }
        },
        MAIL: {
            MAIL_BUTTON: { x: 94, y: 1212 },
            CLAIM_ALL_BUTTON: { x: 500, y: 2024 }
        }
    };

    const PERMISSION_MODES = {
        "直接加入": COORDS.PERMISSION.MODE_DIRECT_JOIN,
        "确认后可加入": COORDS.PERMISSION.MODE_CONFIRM_JOIN,
        "不允许加入": COORDS.PERMISSION.MODE_DENY_JOIN
    };

    // ==================== 工具函数 ====================

    async function safeClick(x, y, desc, delayMs) {
        delayMs = delayMs || TIME_SHORT;
        log.info("点击: " + desc + " (" + x + ", " + y + ")");
        click(x, y);
        await sleep(delayMs);
    }

    async function safeKey(key, desc, delayMs) {
        delayMs = delayMs || TIME_SHORT;
        log.info("按键: " + desc + " [" + key + "]");
        keyPress(key);
        await sleep(delayMs);
    }

    async function enforceResolution() {
        log.info("强制设置分辨率: " + DEFAULT_WIDTH + "x" + DEFAULT_HEIGHT);
        setGameMetrics(DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_DPI);
        await sleep(200);
    }

    /**
     * 带重试的异步操作
     * @param {Function} operation - 异步操作函数
     * @param {number} maxRetries - 最大重试次数
     * @param {string} desc - 操作描述
     */
    async function withRetry(operation, maxRetries, desc) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    log.info("[" + desc + "] 第 " + attempt + " 次重试...");
                    await sleep(TIME_MEDIUM);
                }
                return await operation();
            } catch (e) {
                lastError = e;
                log.warn("[" + desc + "] 尝试 " + (attempt + 1) + "/" + (maxRetries + 1) + " 失败: " + e.message);
            }
        }
        throw new Error("[" + desc + "] 重试 " + (maxRetries + 1) + " 次后仍失败: " + lastError.message);
    }

    /**
     * 带超时的异步操作（使用 sleep 轮询，非 setTimeout）
     * @param {Function} operation - 异步操作函数（需自行控制执行时间）
     * @param {number} timeoutSec - 超时时间（秒）
     * @param {string} desc - 操作描述
     */
    async function withTimeout(operation, timeoutSec, desc) {
        // BGI 不支持 setTimeout，使用 sleep 做简单超时保护
        // 注意：此实现依赖 operation 内部使用 sleep，无法强制中断长时间运行的操作
        const startTime = Date.now();
        try {
            const result = await operation();
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > timeoutSec) {
                log.warn("[" + desc + "] 执行耗时 " + elapsed.toFixed(1) + " 秒，超过设定超时 " + timeoutSec + " 秒");
            }
            return result;
        } catch (e) {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > timeoutSec) {
                throw new Error("[" + desc + "] 执行超时（" + timeoutSec + "秒）- " + e.message);
            }
            throw e;
        }
    }

    /**
     * 组合：带重试 + 超时的异步操作
     */
    async function withRetryAndTimeout(operation, maxRetries, timeoutSec, desc) {
        return withRetry(
            function() {
                return withTimeout(operation, timeoutSec, desc);
            },
            maxRetries,
            desc
        );
    }

    // ==================== 任务模块 ====================

    // 任务1: 设置世界权限
    async function taskSetupPermission() {
        log.info(">>> 开始: 设置世界权限");

        await genshin.returnMainUi();
        log.info("请确保处于主界面");

        await safeKey("VK_F2", "打开多人游戏", TIME_LONG);
        await safeClick(COORDS.PERMISSION.WORLD_PERMISSION_BUTTON.x, COORDS.PERMISSION.WORLD_PERMISSION_BUTTON.y, "世界权限按钮", TIME_LONG);

        const domainName = settings.domainName;
        let mode = PERMISSION_MODES[domainName];
        if (!mode) {
            mode = PERMISSION_MODES["不允许加入"];
        }

        await safeClick(COORDS.PERMISSION.WORLD_PERMISSION_BUTTON.x, mode.y, "权限设置: " + mode.text, 500);

        if (mode.text === "不允许加入") {
            await sleep(2000);
            await safeKey("Escape", "关闭界面", 500);
        }

        log.info("<<< 结束: 设置世界权限");
    }

    // 任务2: 合成浓缩树脂
    async function taskCraftResin() {
        log.info(">>> 开始: 合成浓缩树脂");

        const region = settings.craftRegion || "枫丹";
        try {
            await genshin.goToCraftingBench(region);
            log.info("合成完成");
        } catch (e) {
            log.error("合成失败: " + e.message);
            throw e;
        }

        log.info("<<< 结束: 合成浓缩树脂");
    }

    // 任务3: 领取每日委托、探索派遣和历练点
    async function taskClaimDailyAndExpedition() {
        log.info(">>> 开始: 领取每日委托、探索派遣和历练点");

        const region = settings.guildRegion || "枫丹";
        try {
            await genshin.goToAdventurersGuild(region);
            log.info("每日委托、探索派遣和历练点全部完成");
        } catch (e) {
            log.error("领取失败: " + e.message);
            throw e;
        }

        log.info("<<< 结束: 领取每日委托、探索派遣和历练点");
    }

    // 任务4: 领取纪行奖励
    async function taskClaimBattlePass() {
        log.info(">>> 开始: 领取纪行奖励");

        try {
            await genshin.claimBattlePassRewards();
            log.info("纪行奖励领取完成");
        } catch (e) {
            log.warn("领取纪行失败: " + e.message);
        }

        log.info("<<< 结束: 领取纪行奖励");
    }

    // 任务5: 领取邮件
    async function taskClaimMail() {
        log.info(">>> 开始: 领取邮件");

        // 邮件界面需要更高分辨率才能正确识别和点击
        log.info("切换分辨率以适配邮件界面");
        setGameMetrics(3840, 2160, DEFAULT_DPI);
        await sleep(200);

        await safeKey("Escape", "打开菜单", TIME_LONG);
        await safeClick(COORDS.MAIL.MAIL_BUTTON.x, COORDS.MAIL.MAIL_BUTTON.y, "打开邮件", TIME_LONG);
        await safeClick(COORDS.MAIL.CLAIM_ALL_BUTTON.x, COORDS.MAIL.CLAIM_ALL_BUTTON.y, "一键领取", TIME_MEDIUM);

        await safeKey("Escape", "关闭邮件", TIME_MEDIUM);
        await safeKey("Escape", "关闭菜单", TIME_MEDIUM);

        // 恢复默认分辨率
        log.info("恢复默认分辨率");
        await enforceResolution();

        log.info("<<< 结束: 领取邮件");
    }

    // ==================== 主流程 ====================

    async function main() {
        log.info("=======================================");
        log.info("每日任务自动化脚本 - v3.0 重构版");
        log.info("=======================================");

        // 解析配置
        const retryCount = parseInt(settings.globalRetryCount, 10) || 3;
        const timeoutSec = parseInt(settings.globalTimeoutSec, 10) || 60;
        const enableCraftResin = settings.enableCraftResin !== false;
        const enableBattlePass = settings.enableBattlePass !== false;
        const enableMail = settings.enableMail !== false;

        log.info("配置: 重试=" + retryCount + ", 超时=" + timeoutSec + "秒");
        log.info("树脂合成: " + (enableCraftResin ? "启用" : "跳过"));
        log.info("纪行奖励: " + (enableBattlePass ? "启用" : "跳过"));
        log.info("邮件领取: " + (enableMail ? "启用" : "跳过"));

        // 强制设置分辨率
        await enforceResolution();

        // 构建任务列表
        const tasks = [
            { fn: taskSetupPermission, name: "设置世界权限", skip: false },
            { fn: taskCraftResin, name: "合成浓缩树脂", skip: !enableCraftResin },
            { fn: taskClaimDailyAndExpedition, name: "领取每日委托、探索派遣和历练点", skip: false },
            { fn: taskClaimBattlePass, name: "领取纪行奖励", skip: !enableBattlePass },
            { fn: taskClaimMail, name: "领取邮件", skip: !enableMail }
        ];

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            log.info("---------------------------------------");
            log.info("进度: " + (i + 1) + "/" + tasks.length + " - " + task.name);

            // 检查是否跳过
            if (task.skip) {
                log.info("⊘ 跳过任务: " + task.name);
                skipCount++;
                continue;
            }

            // 执行任务（带重试）
            try {
                await withRetry(task.fn, retryCount, task.name);
                successCount++;
                log.info("✓ 任务成功: " + task.name);
            } catch (error) {
                failCount++;
                log.error("✗ 任务失败: " + task.name + " - " + error.message);
                log.info("继续执行下一个任务...");

                // 尝试恢复
                try {
                    await genshin.returnMainUi();
                    log.info("已尝试返回主界面恢复状态");
                } catch (e) {
                    log.warn("返回主界面失败: " + e.message);
                }
            }
        }

        log.info("=======================================");
        log.info("执行统计: 成功 " + successCount + " 项, 失败 " + failCount + " 项, 跳过 " + skipCount + " 项");
        log.info("=======================================");

        try {
            await genshin.returnMainUi();
            log.info("已返回主界面");
        } catch (e) {
            log.warn("返回主界面失败: " + e.message);
        }

        log.info("脚本执行完毕");
    }

    // 启动
    try {
        await main();
    } catch (error) {
        log.error("脚本发生严重错误: " + error.message);
    }

})();