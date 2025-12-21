/**
 * 发送通知的异步函数
 * @param {Map} map - 包含通知内容键值对的Map对象
 * @param {string} title - 通知的标题
 * @param {boolean} noNotice - 是否不发送通知的标志
 */
async function sendNotice(map, title, noNotice) {
    // 如果设置了不发送通知且map为空，则记录日志并返回
    if (noNotice && !map) {
        log.info(`无通知内容`)
        return
    }
    // 按剩余小时升序排序（即将结束的在前）
    const sortedEntries = Array.from(map.entries())
        .sort((a, b) => a[1].hours - b[1].hours);

    let noticeText =  title ? title + "\n" : "\n"
    for (const [name, info] of sortedEntries) {
        noticeText += `> ${name} ${info.text}<还剩 ${info.hours} 小时>\n`;
    }
    // 发送通知
    notification.send(noticeText)
}

this.noticeUtil = {
    sendNotice,
}