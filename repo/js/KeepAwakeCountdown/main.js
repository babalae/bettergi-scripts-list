(async function () {

    // 声明游戏分辨率基准，使下面 moveMouseTo 的坐标按 1920x1080 自动缩放，
    // 不同分辨率下也能正确点到屏幕中心（与仓库其它脚本一致）。
    setGameMetrics(1920, 1080, 2);

    // ===== 工具函数 =====
    // 把任意输入安全转换为非负整数；解析失败或为负则回退到默认值
    function toInt(value, fallback) {
        let n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return fallback;
        return n;
    }

    // 把秒数格式化为 mm:ss / hh:mm:ss
    function fmt(sec) {
        sec = Math.max(0, Math.floor(sec));
        let h = Math.floor(sec / 3600);
        let m = Math.floor((sec % 3600) / 60);
        let s = sec % 60;
        let pad = (x) => (x < 10 ? "0" + x : "" + x);
        if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
        return pad(m) + ":" + pad(s);
    }

    // ===== 读取设置 =====
    let logInterval = toInt(settings.log_interval, 60);
    if (logInterval < 1) logInterval = 1;

    let sendNotify = settings.send_notification != undefined ? settings.send_notification : '是';
    let endMessage = (settings.end_message != undefined && String(settings.end_message).length > 0)
        ? String(settings.end_message)
        : '倒计时结束，进入下一个任务';

    // 防休眠设置
    let keepAliveEnable = (settings.keepalive_enable != undefined ? settings.keepalive_enable : '是') === '是';
    let keepAliveInterval = toInt(settings.keepalive_interval, 60);
    if (keepAliveInterval < 5) keepAliveInterval = 5; // 防止过于频繁

    // 「等到指定时间」时，若目标时刻今天已过/已到，是否等到明天同一时间。
    // 默认「否」：立即结束等待并继续后续任务，避免脚本启动稍晚就误等约 24 小时。
    let allowNextDay = (settings.allow_next_day != undefined ? settings.allow_next_day : '否') === '是';

    // 防休眠动作：在游戏主界面轻微晃动镜头再晃回。
    // 仅改变视角、不移动角色、不打开任何菜单，用于刷新系统空闲计时器防止休眠/熄屏。
    // 坐标按 1920x1080 游戏窗口的中心点（960,540），与本仓库其它脚本一致。
    async function keepAlive() {
        try {
            moveMouseTo(960, 540);
            await sleep(80);
            moveMouseTo(975, 540); // 向右微移约 15px
            await sleep(80);
            moveMouseTo(960, 540); // 晃回中心
        } catch (e) {
            log.warn("防休眠操作失败：{0}", e);
        }
    }

    // ===== 计算目标时间戳（核心：用绝对时间戳比对，零漂移）=====
    // 不管等多久（跨小时、跨天），都不会累积误差。
    let now = Date.now();
    let targetTime;   // 目标时刻的毫秒时间戳
    let mode;

    let clockStr = settings.target_clock != undefined ? String(settings.target_clock).trim() : '';
    // 兼容中文冒号
    clockStr = clockStr.replace("：", ":");

    if (clockStr.length > 0) {
        // ---- 模式 A：等到指定时钟时间（如 04:00）----
        // 严格校验格式，避免 "04:00:30" 这类输入被静默当成 04:00。
        let m = clockStr.match(/^(\d{1,2}):(\d{1,2})$/);
        if (!m) {
            log.error("目标时间格式错误：{0}，应为 HH:mm（如 04:00）。脚本退出。", clockStr);
            return;
        }
        let hh = toInt(m[1], -1);
        let mm = toInt(m[2], -1);

        if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
            log.error("目标时间超出范围：{0}，时应为 0-23、分应为 0-59。脚本退出。", clockStr);
            return;
        }

        let d = new Date();
        d.setHours(hh, mm, 0, 0);
        targetTime = d.getTime();
        // 若目标时刻今天已过（或正好是此刻）：
        //  - allowNextDay=是：顺延到明天同一时间；
        //  - allowNextDay=否（默认）：保持过去值，下面的等待循环会立即退出，
        //    直接继续后续处理/任务，避免“启动稍晚就误等约 24 小时”的悬崖问题。
        if (targetTime <= now) {
            if (allowNextDay) {
                d.setDate(d.getDate() + 1); // 按日历加一天，避免夏令时(DST)切换日 +24h 偏差
                targetTime = d.getTime();
                log.warn("目标时间 {0} 今天已过/已到，按设置等待到【明天】同一时间", clockStr);
            } else {
                log.warn("目标时间 {0} 今天已过/已到，不等到明天，立即结束等待并继续后续任务", clockStr);
            }
        }
        mode = "clock";
        log.info("模式：等到指定时间 {0}（本机时间）", clockStr);
    } else {
        // ---- 模式 B：相对倒计时（分钟 + 秒）----
        let minutes = toInt(settings.countdown_minutes, 0);
        let seconds = toInt(settings.countdown_seconds, 0);
        let totalSeconds = minutes * 60 + seconds;
        if (totalSeconds <= 0) {
            totalSeconds = 5 * 60;
            log.warn("未设置有效时长，使用默认 5 分钟");
        }
        targetTime = now + totalSeconds * 1000;
        mode = "relative";
        log.info("模式：相对倒计时 {0}", fmt(totalSeconds));
    }

    // 打印目标时刻，便于核对
    let td = new Date(targetTime);
    let pad = (x) => (x < 10 ? "0" + x : "" + x);
    log.info("预计结束时刻：{0}:{1}:{2}，总等待 {3}",
        pad(td.getHours()), pad(td.getMinutes()), pad(td.getSeconds()),
        fmt((targetTime - now) / 1000));

    // ===== 取消令牌：让长时间等待能被「停止」按钮及时中断 =====
    let token = null;
    try {
        if (typeof dispatcher !== "undefined" && dispatcher.getLinkedCancellationToken) {
            token = dispatcher.getLinkedCancellationToken();
        }
    } catch (e) {
        token = null;
    }
    function isCancelled() {
        try {
            return token && token.isCancellationRequested === true;
        } catch (e) {
            return false;
        }
    }

    // ===== 等待主循环：始终以「目标时间戳 - 当前时间」判断，零漂移 =====
    if (keepAliveEnable) {
        log.info("已启用防休眠：每 {0} 秒轻晃一次镜头", keepAliveInterval);
    }
    let lastLogged = -1;
    let nextKeepAlive = Date.now() + keepAliveInterval * 1000; // 下次防休眠时间戳
    while (true) {
        let remainMs = targetTime - Date.now();
        if (remainMs <= 0) break;

        if (isCancelled()) {
            log.warn("等待被手动中断，剩余 {0}", fmt(remainMs / 1000));
            return;
        }

        // 按间隔打印剩余时间（用整除桶，避免每秒刷屏）
        let remainSec = Math.ceil(remainMs / 1000);
        let bucket = Math.floor(remainSec / logInterval);
        if (bucket !== lastLogged) {
            lastLogged = bucket;
            log.info("剩余时间：{0}", fmt(remainSec));
        }

        // 到点则执行一次防休眠操作（仅在还剩较多时间时做，临近结束无需打扰）
        if (keepAliveEnable && Date.now() >= nextKeepAlive && remainMs > 3000) {
            await keepAlive();
            nextKeepAlive = Date.now() + keepAliveInterval * 1000;
        }

        // 每次最多睡 1 秒，保证能及时响应取消、并在临近结束时精确收敛
        remainMs = targetTime - Date.now();
        let step = remainMs > 1000 ? 1000 : remainMs;
        if (step > 0) await sleep(step);
    }

    // ===== 结束处理 =====
    // 可选：领取「空月祝福（月卡）」奖励。
    // 在每日重置后，购买月卡的账号会弹出领取窗口，若下一个任务不处理会被卡住。
    // genshin.blessingOfTheWelkinMoon() 为 BGI 官方函数，内部用图像识别完成
    // “双击领取 + 点击空白离开”，未购买月卡时也能安全跳过。
    let claimWelkin = (settings.claim_welkin != undefined ? settings.claim_welkin : '否') === '是';
    if (claimWelkin) {
        try {
            log.info("尝试领取空月祝福（月卡）奖励...");
            await sleep(5000); // 给更新后的领取弹窗一点出现/渲染时间
            await genshin.blessingOfTheWelkinMoon();
            await genshin.returnMainUi(); // 领取后回到主界面，确保不卡住下一个任务
            log.info("空月祝福处理完成");
        } catch (e) {
            log.warn("领取空月祝福失败（可能未购买月卡或界面异常），已跳过：{0}", e);
        }
    }

    log.info(endMessage);

    if (sendNotify === '是') {
        try {
            if (typeof notification !== "undefined") {
                if (notification.send) {
                    notification.send(endMessage);
                } else if (notification.Send) {
                    notification.Send(endMessage);
                }
            }
        } catch (e) {
            log.warn("发送通知失败：{0}", e);
        }
    }

    // 脚本到此自然结束。在 BetterGI 调度器分组中，
    // 当前 JS 脚本结束后会自动执行下一个任务。

})();
