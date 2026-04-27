import {toMainUi, openBag, findImgAndClick, OcrFind, findText} from "./tool";
import {sendText} from "./notice"

/**
 * 检查圣遗物背包中剩余空间是否达到阈值，如果达到阈值则发送提醒
 * @param {number} threshold - 圣遗物数量差阈值，默认为400
 */
export async function checkHolyRelicsKey(threshold = 400) {
    const ms = 300
    log.info("开始圣遗物数量检查")  // 记录开始检查圣遗物数量
    // const threshold = settings.threshold || 100  // 注释掉的阈值设置代码
    await openBag()  // 打开背包
    await sleep(ms)
    const textFind = await findText("圣遗物");  // 查找"圣遗物"文本
    log.debug("textFind:" + textFind)  // 记录查找结果
    if (textFind === null) {  // 如果未找到"圣遗物"文本
        await sleep(ms)  // 等待1秒
        log.info("进入圣遗物背包")  // 记录准备进入圣遗物背包
        // 点击圣遗物背包
        const clicked = await findImgAndClick('assets/holyRelics.jpg')
        if (!clicked) {
            log.error("未能点击进入圣遗物背包，终止检查")
            return
        } // 通过图片点击进入圣遗物背包
    }
    log.info("已进入圣遗物背包")  // 记录已进入圣遗物背包
    await sleep(ms)
    const OcrText = await OcrFind(1612, 34, 192, 31);  // 使用OCR识别指定区域的文本
    if (!(OcrText?.text)) {  // 如果OCR识别失败
        log.error("识别异常")  // 记录错误信息
        return  // 返回，终止函数执行
    }
    const text = OcrText.text.trim()  // 去除识别文本的前后空格
    const HolyRelics = text.replace(/[^0-9/]/g, '')  // 只保留数字和斜杠
    const strings = HolyRelics.split('/', 2);  // 按斜杠分割字符串
    if (strings.length < 2) {
        log.error(`圣遗物数量解析失败，OCR 原始文本：${text}`)
        return
    }
    const count = parseInt(strings[0], 10);// 解析当前数量
    const total = parseInt(strings[1], 10);// 解析总容量
    if (!Number.isFinite(count) || !Number.isFinite(total)) {
        log.error(`圣遗物数量解析异常，count=${count}, total=${total}, 原文本：${text}`)
        return
    }
    const diff = total - count  // 计算剩余空间数量

    log.debug(`text:${text}`)  // 记录原始识别文本
    log.debug(`HolyRelics:${HolyRelics}`)  // 记录处理后的文本
    log.debug(`count:${count}`)  // 记录当前数量
    log.debug(`total:${total}`)  // 记录总容量
    log.debug(`diff:${diff}`)  // 记录剩余空间数量

    if (diff <= threshold) {  // 如果剩余空间小于等于阈值
        log.info(`背包圣遗物数量：${count}/${total}，相差${diff}个，<=${threshold}个，提醒清理`)  // 记录需要清理的信息
        // 发送提醒消息
        await sendText(`背包圣遗物 剩余空间不足(设置阈值):${threshold},剩余:${diff},请前往清理!`, "背包圣遗物剩余空间检查")  // 发送提醒文本
    }
}