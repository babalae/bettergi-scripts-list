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
    // 初始化通知文本，如果有标题则添加标题
    let text = title ? title + "\n" : ""
    // 遍历map，将键值对添加到通知文本中
    map.forEach((value,key) => {
        text += "> ${key} ${value}\n"
    })
    // 发送通知
    notification.send(`${text}`)
}

this.noticeUtil = {
    sendNotice,
}