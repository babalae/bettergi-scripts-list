const NoticeType = Object.freeze({
    bgi: 'bgi',//BGI通知
    independence: 'independence',//独立通知
    fromValue(value) {
        return Object.keys(this).find(key => this[key] === value);
    }
})
const NoticeMap = new Map([
    ['BGI通知', [{type: NoticeType.bgi}]],
    ['独立通知', [{type: NoticeType.independence}]],
    ['独立通知和BGI通知', [{type: NoticeType.independence}, {type: NoticeType.bgi}]],
])
const configNotice = {
    noticeList: NoticeMap.get(settings.noticeType),
}

/**
 * 发送通知的异步函数
 * @param {Map} map - 包含通知内容键值对的Map对象
 * @param {string} title - 通知的标题
 * @param {boolean} noNotice - 是否不发送通知的标志
 */
async function sendNotice(map = new Map(), title, noNotice = false) {
    log.debug(`sendNotice: map.size=${map.size}, noNotice=${noNotice}`);

    // 如果设置了不发送通知且map为空，则记录日志并返回
    if ((map.size <= 0) || noNotice) {
        log.debug(`if sendNotice: map.size=${map.size}, noNotice=${noNotice}`);
        log.info(`[sendNotice]无通知内容`)
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
    log.debug(`sendNotice: noticeText:{noticeText}`,noticeText);
    // 发送通知
    for (let noticeElement of configNotice.noticeList) {
        switch (noticeElement.type) {
            case NoticeType.independence:
                await wsUtil.sendText(noticeText)
                break
            case NoticeType.bgi:
                notification.send(noticeText)
                break
        }
    }
    log.debug(`sendNotice: --end`);
    return
}

/**
 * 异步发送通知的函数
 * @param {string} noticeText - 通知内容文本
 * @param {string} title - 通知标题
 * @param {boolean} noNotice - 是否不发送通知的标志
 */
async function sendText(noticeText, title, noNotice) {
    // 检查是否有通知内容且设置了不发送通知的标志
    if ((!noticeText) || noNotice) {
        log.info(`sendText 无通知内容`)  // 记录日志信息
        return  // 直接返回，不执行后续操作
    }
    // 构建通知文本，如果有标题则先添加标题
    let text = title ? title + "\n======\n" : "\n"
    // 添加通知内容
    text += noticeText
    // 发送通知
    for (let noticeElement of configNotice.noticeList) {
        switch (noticeElement.type) {
            case NoticeType.independence:
                await wsUtil.sendText(text)
                break
            case NoticeType.bgi:
                notification.send(text)
                break
        }
    }
    return
}

this.noticeUtil = {
    sendNotice,
    sendText,
}