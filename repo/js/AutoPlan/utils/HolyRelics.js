import {openBag, findImgAndClick, OcrFind, findText, drawAndClearBox, Log, drawBoxDebug} from "./tool";


/**
 * 检查圣遗物背包中剩余空间是否达到阈值，如果达到阈值则发送提醒
 * @param {number} threshold - 圣遗物数量差阈值，默认为400
 */
export async function checkHolyRelicsKey(threshold = 400) {
    const ms = 300
    Log.info("开始圣遗物数量检查")  // 记录开始检查圣遗物数量
    // const threshold = settings.threshold || 100  // 注释掉的阈值设置代码
    await openBag()  // 打开背包
    await sleep(ms)
    const textFind = await findText("圣遗物");  // 查找"圣遗物"文本
    Log.debug("textFind:" + textFind)  // 记录查找结果
    if (!textFind) {  // 如果未找到"圣遗物"文本
        await sleep(ms)  // 等待1秒
        Log.info("进入圣遗物背包")  // 记录准备进入圣遗物背包
        // 点击圣遗物背包
        const clicked = await findImgAndClick('assets/holyRelics.jpg')
        if (!clicked) {
            Log.error("未能点击进入圣遗物背包，终止检查")
            return false
        } // 通过图片点击进入圣遗物背包
    }
    Log.info("已进入圣遗物背包")  // 记录已进入圣遗物背包
    await sleep(ms)
    let OcrJson={
        x: 1612,
        y: 34,
        width: 192,
        height: 31
    }
    const OcrText = await OcrFind(OcrJson.x, OcrJson.y, OcrJson.width, OcrJson.height,new Pen(Color.LightPink, 2));  // 使用OCR识别指定区域的文本
    if (!(OcrText?.text)) {  // 如果OCR识别失败
        Log.error("识别异常")  // 记录错误信息
        return false  // 返回，终止函数执行
    }
    const text = OcrText.text.trim()  // 去除识别文本的前后空格
    const HolyRelics = text.replace(/[^0-9/]/g, '')  // 只保留数字和斜杠
    const strings = HolyRelics.split('/', 2);  // 按斜杠分割字符串
    if (strings.length < 2) {
        Log.error(`圣遗物数量解析失败，OCR 原始文本：${text}`)
        return false
    }
    const count = parseInt(strings[0], 10);// 解析当前数量
    const total = parseInt(strings[1], 10);// 解析总容量
    if (!Number.isFinite(count) || !Number.isFinite(total)) {
        Log.error(`圣遗物数量解析异常，count=${count}, total=${total}, 原文本：${text}`)
        return false
    }

    const diff =Math.abs(total - count)   // 计算剩余空间数量

    Log.debug(`text:${text}`)  // 记录原始识别文本
    Log.debug(`HolyRelics:${HolyRelics}`)  // 记录处理后的文本
    Log.debug(`count:${count}`)  // 记录当前数量
    Log.debug(`total:${total}`)  // 记录总容量
    Log.debug(`diff:${diff}`)  // 记录剩余空间数量

    // 如果剩余空间小于等于阈值
    const b = diff <= threshold;
    return b
}