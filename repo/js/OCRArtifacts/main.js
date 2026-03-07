// 加载额外模块
eval(file.readTextSync("lib/Constants.js"))
eval(file.readTextSync("lib/Artifact.js"))
eval(file.readTextSync("lib/Parser.js"))

// 每行圣遗物数量
const COUNT_PER_LINE = 8
// 每页圣遗物行数
const LINE_PER_PAGE = 5
// 左上方第一个圣遗物图标中心点坐标
const centerX = 180
const centerY = 253
// 每次向右移动鼠标的偏移量
const offsetX = 145
// 每次向下移动鼠标的偏移量
const offsetY = 166

// 翻页 使用模拟鼠标滚轮向下滚动实现
let _cnt = 0
async function scrollPage() {
  let count = 49
  for (let i = 0; i < count; i++) {
    await verticalScroll(-1)
  }
  if (++_cnt === 3) {
    await verticalScroll(1)
    _cnt = 0
  }
}

// 在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
  let startTime = Date.now()
  let retryCount = 0 // 重试计数
  while (Date.now() - startTime < timeout) {
    try {
      // 在指定区域进行 OCR 识别
      const ro = captureGameRegion();
      let ocrResult = ro.find(
        RecognitionObject.ocr(
          ocrRegion.x,
          ocrRegion.y,
          ocrRegion.width,
          ocrRegion.height
        )
      )
      ro.dispose();
      if (ocrResult) {
        return ocrResult.text // 返回识别到的内容
      } else {
        log.warn(`OCR 识别区域未找到内容`)
        return null // 如果 OCR 未识别到内容，返回 null
      }
    } catch (error) {
      retryCount++ // 增加重试计数
      log.warn(`OCR识别失败,正在进行第 ${retryCount} 次重试...`)
    }
    await sleep(500) // 短暂延迟，避免过快循环
  }
  log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`)
  return null // 如果未识别到文字，返回 null
}

// 识别右上方的圣遗物总数
async function recognizedArtifactCount() {
  let ocrRegion = { x: 1500, y: 0, width: 300, height: 80 }
  let text = await recognizeTextInRegion(ocrRegion)
  log.info('圣遗物数量识别结果: ', text)
  let res = text.match(/(\d+)\/(\d+)/)
  log.info('圣遗物数量:', res[1])
  return res[1]
}

// 识别左侧的圣遗物文本
async function recognizedArtifactText() {
  let ocrRegion = { x: 1306, y: 122, width: 496, height: 845 }
  return await recognizeTextInRegion(ocrRegion)
}

// 遍历当前页
async function traversePage(n, totalCount) {
  let x = centerX
  let y = centerY
  let num = n * LINE_PER_PAGE * COUNT_PER_LINE
  let startRow = 0
  const sy = totalCount - num
  if (sy < LINE_PER_PAGE * COUNT_PER_LINE) {
    let rowNum = Math.floor(sy / COUNT_PER_LINE)
    let last = sy - rowNum * COUNT_PER_LINE
    if (last > 0) rowNum++
    startRow = LINE_PER_PAGE - rowNum - 1
    if (startRow < 0) startRow = 0
    log.info(
      `当前为最后一页,开始行:${startRow},行数:${rowNum},最后一行有${last}个`
    )
  }
  let content = `开始遍历第${n + 1}页
===================`
  for (let j = startRow; j < LINE_PER_PAGE; j++) {
    y = centerY + offsetY * j
    for (let i = 0; i < COUNT_PER_LINE; i++) {
      x = centerX + offsetX * i
      await moveMouseTo(x, y)
      await click(x, y)
      await sleep(50)
      let text = await recognizedArtifactText()
      content += `第${++num}个圣遗物信息:
${text}
=====================`
      if (num == totalCount) return content
    }
  }
  return content
}

// 同步写入文件
async function writeFileSync(
  filePath,
  content,
  succLogFn = null,
  errorLogFn = null
) {
  result = file.WriteTextSync(filePath, `${content}`, true)
  if (result) {
    if (succLogFn) succLogFn()
    else log.info(`成功写入日志文件`)
  } else {
    if (errorLogFn) errorLogFn()
    else log.error(`写入日志文件失败`)
  }
}

// 识别圣遗物
async function doSearch(startTimeStamp) {
  const filePath = `records/artifact_log_${startTimeStamp}.txt`
  await genshin.returnMainUi()
  // 按下 B 键
  keyPress('B')
  await sleep(1000)
  // 点击圣遗物菜单的图标
  await click(675, 50)
  await sleep(1500)
  let content = `开始识别圣遗物，时间:${new Date()}`
  // 识别圣遗物数量
  const artifactCount = await recognizedArtifactCount()
  const lineCount = Math.ceil(artifactCount / COUNT_PER_LINE)
  const pageCount = Math.ceil(artifactCount / (COUNT_PER_LINE * LINE_PER_PAGE))
  let tips = `
圣遗物数量: ${artifactCount}, 页数: ${pageCount}, 行数: ${lineCount}
=============================`
  log.info(tips)
  content += tips
  writeFileSync(filePath, content)
  for (let n = 0; n < pageCount; n++) {
    let res = await traversePage(n, artifactCount)
    writeFileSync(
      filePath,
      res,
      () => log.info(`第${n + 1}页成功写入日志文件`),
      () => log.error(`第${n + 1}页写入日志文件失败`)
    )
    await moveMouseTo(centerX, centerY)
    await sleep(100)
    if (n < pageCount - 1) {
      await scrollPage()
    }
    await sleep(200)
  }
  await sleep(500)
  const searchEndTime = new Date().getTime()
  content = `识别结束,时间:${new Date()},识别耗时:${searchEndTime - startTimeStamp}`
  writeFileSync(filePath, content)
  return searchEndTime
}

async function doParse(filePath) {
  await parse(filePath)
}

; (async function () {
  setGameMetrics(1920, 1080, 1)
  const startTimeStamp = new Date().getTime()
  const filePath = `records/artifact_log_${startTimeStamp}.txt`
  try {
    await doSearch(startTimeStamp)
    await doParse(filePath)
    await genshin.returnMainUi()
    const endTimeStamp = new Date().getTime()
    content = `任务结束,时间:${new Date()},总耗时:${endTimeStamp - startTimeStamp}`
    writeFileSync(filePath, content)
  } catch (e) {
    log.error(e.stack)
    writeFileSync(filePath, `
      错误调用堆栈:
      ${e.stack}`)
  }

})()
