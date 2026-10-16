import {sendText as wsSendText} from "./ws"
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
// ===== BetterGI 脚本通知接口的硬性限制 =====
// 见 BetterGenshinImpact/Core/Script/Dependence/Notification.cs
//  1. 单条消息长度 > 500 字符                     → 日志「通知内容违规，消息被拦截」，消息不发出
//  2. 消息含 <script> / http:// / https://（不分大小写）→ 同上
//  3. 同一分钟内最多发送 5 条                     → 第 6 条起「通知频率超限，消息被拦截」
// 所以长通知必须切分成多条发送，并控制每分钟条数，否则整条通知会被丢弃。
const BGI_NOTICE_MAX_CHARS = 500
const BGI_NOTICE_CHUNK_CHARS = 470 // 留出 "[1/2]" 前缀的余量
const BGI_NOTICE_MAX_PER_MINUTE = 5
const BGI_NOTICE_BATCH_SIZE = 4 // 一批只发 4 条，留 1 条余量给其它通知
const BGI_NOTICE_BATCH_WAIT_MS = 61 * 1000
const BGI_NOTICE_FORBIDDEN = ["<script>", "http://", "https://"]

/**
 * 在 [start, windowEnd) 内找一个不会切开代理对（emoji 等）的硬切点
 * @param {string} text
 * @param {number} start
 * @param {number} windowEnd
 * @returns {number} 切点（不含）
 */
function hardCutPosition(text, start, windowEnd) {
    let end = windowEnd
    const prev = text.charCodeAt(end - 1)
    if (prev >= 0xD800 && prev <= 0xDBFF) end-- // 前一字符是高代理，回退一位
    const next = text.charCodeAt(end)
    if (next >= 0xDC00 && next <= 0xDFFF) end-- // 后一字符是低代理，回退一位
    return Math.max(end, start + 1)
}

/**
 * 把通知文本切分成每条都不超过 limit 个字符的数组（优先在换行处切分）
 * 把结果按顺序拼回去与原文完全一致
 * @param {string} text
 * @param {number} limit
 * @returns {string[]}
 */
function splitNoticeText(text, limit = BGI_NOTICE_CHUNK_CHARS) {
    const chunks = []
    let start = 0
    while (text.length - start > limit) {
        const windowEnd = start + limit
        let cut = text.lastIndexOf('\n', windowEnd - 1)
        if (cut <= start) {
            cut = hardCutPosition(text, start, windowEnd) - 1 // 窗口内没有换行，只能硬切
        }
        chunks.push(text.slice(start, cut + 1))
        start = cut + 1
    }
    if (start < text.length) {
        chunks.push(text.slice(start))
    }
    return chunks
}

/**
 * 发送 BGI 通知，自动分条并遵守 BGI 的限频规则
 * @param {string} text - 完整通知内容
 */
async function sendBgiNotice(text) {
    const chunks = splitNoticeText(text)
    for (let i = 0; i < chunks.length; i++) {
        if (i > 0 && i % BGI_NOTICE_BATCH_SIZE === 0) {
            log.info(`BGI 通知每分钟最多 ${BGI_NOTICE_MAX_PER_MINUTE} 条，等待 ${BGI_NOTICE_BATCH_WAIT_MS / 1000} 秒后继续发送`)
            await sleep(BGI_NOTICE_BATCH_WAIT_MS)
        }
        const content = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n${chunks[i]}` : chunks[i]
        if (content.length > BGI_NOTICE_MAX_CHARS) {
            log.warn(`BGI 通知单条长度 ${content.length} 超过 ${BGI_NOTICE_MAX_CHARS}，会被 BGI 拦截`)
        }
        const forbidden = BGI_NOTICE_FORBIDDEN.find(pattern => content.toLowerCase().includes(pattern))
        if (forbidden) {
            log.warn(`BGI 通知内容包含禁止字符串 "${forbidden}"，该条消息会被 BGI 拦截`)
        }
        log.debug(`sendBgiNotice: 发送第 ${i + 1}/${chunks.length} 条，长度 ${content.length}`)
        notification.send(content)
    }
}

let configNotice = {
    noticeList: NoticeMap.get(settings.noticeType),
}
async function buildConfigNotice() {
    configNotice = {
        noticeList: NoticeMap.get(settings.noticeType),
    }
}
/**
 * 发送通知的异步函数
 * @param {Map} map - 包含通知内容键值对的Map对象
 * @param {string} title - 通知的标题
 * @param {boolean} noNotice - 是否不发送通知的标志
 */
async function sendNotice(map = new Map(), title, noNotice = false) {
    log.debug(`sendNotice: map.size=${map.size}, noNotice=${noNotice}`);
    await buildConfigNotice()
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
                await wsSendText(noticeText)
                break
            case NoticeType.bgi:
                await sendBgiNotice(noticeText)
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
 */
async function sendText(noticeText, title, noNotice = false) {
    // 检查是否有通知内容且设置了不发送通知的标志
    if ((!noticeText) || noNotice) {
        log.info(`sendText 无通知内容`)  // 记录日志信息
        return  // 直接返回，不执行后续操作
    }
    await buildConfigNotice()
    // 构建通知文本，如果有标题则先添加标题
    let text = title ? title + "\n======\n" : "\n"
    // 添加通知内容
    text += noticeText
    // 发送通知
    for (let noticeElement of configNotice.noticeList) {
        switch (noticeElement.type) {
            case NoticeType.independence:
                await wsSendText(text)
                break
            case NoticeType.bgi:
                await sendBgiNotice(text)
                break
        }
    }
    return
}

// this.noticeUtil = {
//     sendNotice,
//     sendText,
// }

export {
    sendNotice,
    sendText,
}
