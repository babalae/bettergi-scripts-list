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

    let noticeText = title ? title + "\n======\n" : "\n"
    for (const [name, info] of sortedEntries) {
        let common = info.common
        common = common ? `(${common})` : ''
        noticeText += `> ${common} ${name} ${info.text} (还剩 ${info.hours} 小时) ${info.desc}\n----\n`;
    }
    // 发送通知
    notification.send(noticeText)
}

/**
 * 异步发送通知的函数
 * @param {string} noticeText - 通知内容文本
 * @param {string} title - 通知标题
 * @param {boolean} noNotice - 是否不发送通知的标志
 */
async function send(noticeText, title, noNotice) {
    // 检查是否有通知内容且设置了不发送通知的标志
    if (noticeText && noNotice) {
        log.info(`无通知内容`)  // 记录日志信息
        return  // 直接返回，不执行后续操作
    }
    // 构建通知文本，如果有标题则先添加标题
    let text = title ? title + "\n======\n" : "\n"
    // 添加通知内容
    text += noticeText
    // 发送通知
    notification.send(text)

}

this.noticeUtil = {
    sendNotice,
    send,
}