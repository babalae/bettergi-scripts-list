// 获取今天的日期（考虑4点前为昨天）并格式化为YYYYMMDD
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

// 判断给定日期是否为今天
function isToday(date) {
    return date === getToday();
}
