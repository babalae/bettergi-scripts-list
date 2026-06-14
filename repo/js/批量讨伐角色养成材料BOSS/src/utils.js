/**
 * 获取今天的日期（考虑4点前为昨天）并格式化为YYYYMMDD
 * @function
 * @returns {string} 格式化为YYYYMMDD的日期字符串，例如：'20260506'
 * @description 由于游戏服务器每日刷新时间为凌晨4点，因此在4点之前调用此函数会返回昨天的日期。
 */
function getToday() {
    const now = new Date();
    const targetDate = now.getHours() < 4 ?
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) :
        new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * 判断给定日期是否为今天
 * @function
 * @param {string} date - 要判断的日期字符串，格式应为YYYYMMDD
 * @returns {boolean} 如果给定日期与今天相同则返回true，否则返回false
 * @description 比较给定的日期字符串是否与今天的日期（考虑4点刷新时间）相同。
 */
function isToday(date) {
    return date === getToday();
}

/**
 * 判断异常是否为取消相关的异常
 * @param {Error} error - 捕获的异常对象
 * @returns {boolean} 是否为取消异常
 */
function isCancellationError(error) {
    if (!error) return false;
    const msg = (error.message || error.toString() || "").toLowerCase();
    const isCancel = msg.includes("取消自动任务")
        || msg.includes("task was canceled")
        || msg.includes("operationcanceledexception")
        || msg.includes("normalendexception")
        || msg.includes("尝试多次后,截图失败!");

    return isCancel;
}

export { getToday, isToday, isCancellationError };
