(async function () {

    // 默认值
    const DEFAULT_HOURS = 4;
    const DEFAULT_MINUTES = 0;
    const BUFFER_MS = 10 * 1000; // 10秒缓冲

    // 解析布尔（支持 true / 'true' / false / 'false'）
    function parseBoolean(val) {
        return val === true || val === 'true' || val === '1' || val === 1;
    }

    // 解析数字并做范围限制，若输入为空或无法解析则返回 defaultValue
    function parseAndClampNumber(val, defaultValue, min, max) {
        const n = Number(val);
        if (val === '' || !Number.isFinite(n)) {
            return { value: defaultValue, warned: true, reason: 'empty_or_invalid' };
        }
        const rounded = Math.floor(n);
        if (rounded < min || rounded > max) {
            return { value: Math.min(max, Math.max(min, rounded)), warned: true, reason: 'out_of_range' };
        }
        return { value: rounded, warned: false, reason: '' };
    }

    // 计算下一个目标时间（返回 Date 或 null，当 allowNextDay=false 且今天已过时）
    function computeNextTargetDate(hours, minutes, allowNextDay) {
        const now = new Date();
        let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        if (target.getTime() > now.getTime()) {
            return { target, isTomorrow: false };
        } else {
            if (allowNextDay) {
                const tomorrow = new Date(target.getTime() + 24 * 60 * 60 * 1000);
                return { target: tomorrow, isTomorrow: true };
            } else {
                return { target: null, isTomorrow: false };
            }
        }
    }

    // 主等待函数（封装校验、计算、等待）
    async function waitUntilSpecifiedTime(rawHours, rawMinutes, rawAllowNextDay) {
        // 解析与校验
        const ph = parseAndClampNumber(rawHours, DEFAULT_HOURS, 0, 23);
        const pm = parseAndClampNumber(rawMinutes, DEFAULT_MINUTES, 0, 59);
        const allowNextDay = parseBoolean(rawAllowNextDay);

        if (ph.warned) {
            if (ph.reason === 'out_of_range') {
                log.warn(`设置指定小时错误（${rawHours}），已修正为 ${ph.value}（范围 0~23）`);
            } else {
                log.warn(`未设置有效的指定小时，将使用默认：${ph.value} 时`);
            }
        }
        if (pm.warned) {
            if (pm.reason === 'out_of_range') {
                log.warn(`设置指定分钟错误（${rawMinutes}），已修正为 ${pm.value}（范围 0~59）`);
            } else {
                log.warn(`未设置有效的指定分钟，将使用默认：${pm.value} 分`);
            }
        }

        const validatedHours = ph.value;
        const validatedMinutes = pm.value;

        log.info(`--------------- 将等待至 ${validatedHours}：${validatedMinutes} ---------------`);

        // 计算下一次目标时间
        const { target, isTomorrow } = computeNextTargetDate(validatedHours, validatedMinutes, allowNextDay);

        if (!target) {
            // 今天已过且不允许等到明天
            log.info(`[等待到指定时间] 目标时间 ${validatedHours}:${validatedMinutes} 已经过了今天（当前时间 ${new Date().toLocaleString()}），allowNextDay 未开启，脚本将直接结束当前等待分组。`);
            return { status: 'skipped', reason: 'target time already passed today', when: null };
        }

        const now = Date.now();
        let msToWait = target.getTime() - now;

        if (msToWait < 0) {
            // 非常规保护：若计算误差导致负值（极短时间差），设为 0
            msToWait = 0;
        }

        // 日志 → 用更友好的时间描述
        const minutesRemaining = Math.floor(msToWait / 60000);
        const hoursRemaining = Math.floor(minutesRemaining / 60);
        const minutesPart = minutesRemaining % 60;
        log.info(`现在时间 ${new Date().toLocaleString()}，将等待约 ${hoursRemaining} 小时 ${minutesPart} 分钟（${Math.floor(msToWait / 1000)} 秒），直到 ${target.toLocaleString()}（isTomorrow=${isTomorrow}）`);

        // 真正等待（加缓冲）
        await sleep(msToWait + BUFFER_MS);

        log.info(`时间到了！现在是 ${new Date().toLocaleString()}，目标 ${validatedHours}:${validatedMinutes}（isTomorrow=${isTomorrow}）`);
        return { status: 'done', when: target.toISOString(), isTomorrow };
    }

    // --- 入口逻辑 ---
    // setGameMetrics / dispatcher / log / settings / sleep 为宿主提供的全局 API

    setGameMetrics(1920, 1080, 2);
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    dispatcher.addTimer(new RealtimeTimer("AutoSkip"));

    // 读取参数（可能为字符串）
    const rawHours = settings && settings.specifyHours !== undefined ? settings.specifyHours : '';
    const rawMinutes = settings && settings.specifyMinutes !== undefined ? settings.specifyMinutes : '';
    // settings.allowNextDay 由 settings.json 中的 switch 提供，可能为 boolean 或字符串 'true'
    const rawAllowNextDay = settings && settings.allowNextDay !== undefined ? settings.allowNextDay : false;

    // 调用统一等待函数
    const result = await waitUntilSpecifiedTime(rawHours, rawMinutes, rawAllowNextDay);

    // 返回结果，方便宿主或调用者判断
    return result;

})();