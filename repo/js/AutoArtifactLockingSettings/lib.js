/**
 * 在指定区域内查找特定文本并返回其中心坐标（屏幕绝对坐标）
 * @param {number} x1 - 区域左上角 X 坐标
 * @param {number} y1 - 区域左上角 Y 坐标
 * @param {number} x2 - 区域右下角 X 坐标
 * @param {number} y2 - 区域右下角 Y 坐标
 * @param {string} targetText - 您要查找的目标文本
 * @returns {{x: number, y: number, text: string} | null} - 如果找到，返回中心坐标和文本；否则返回 null
 */
export const findTextInRegion = (x1, y1, x2, y2, targetText) => {
  // 获取游戏画面截图并裁剪指定区域
  let screen = captureGameRegion();
  let searchRegion = screen.deriveCrop(x1, y1, x2 - x1, y2 - y1);

  try {
    // 对区域进行 OCR，获取所有文本行的列表
    let ocrResultList = searchRegion.findMulti(RecognitionObject.ocrThis);
    log.debug("OCR 识别到的文本行总数: {count}", ocrResultList.count);

    // 遍历所有 OCR 结果
    for (let i = 0; i < ocrResultList.count; i++) {
      let currentResult = ocrResultList[i];
      log.debug("识别到文本: '{text}'，位置: ({x}, {y})", currentResult.text, currentResult.x, currentResult.y);

      // 判断识别到的文本是否包含目标文本
      if (currentResult.text && currentResult.text.includes(targetText)) {
        log.debug("成功找到目标文本 '{target}'!", targetText);
        // 计算中心坐标（局部坐标）
        let localCenterX = currentResult.x + Math.floor(currentResult.width / 2);
        let localCenterY = currentResult.y + Math.floor(currentResult.height / 2);
        // 转换为屏幕绝对坐标
        let screenX = x1 + localCenterX;
        let screenY = y1 + localCenterY;
        return {
          x: screenX,
          y: screenY,
          text: currentResult.text
        };
      }
    }

    // 如果遍历完所有结果都未找到，返回 null
    log.debug("在指定区域内未能找到目标文本: '{target}'", targetText);
    return null;
  } finally {
    // 释放图像资源
    searchRegion.dispose();
    screen.dispose();
  }
};

/**
 * 平滑拖动列表（从起始坐标拖动到目标坐标）
 * @param {number} startX - 起始 X 坐标
 * @param {number} startY - 起始 Y 坐标
 * @param {number} endX - 目标 X 坐标
 * @param {number} endY - 目标 Y 坐标
 * @param {number} stepDistance - 每步移动的距离（像素），默认 10
 * @returns {Promise<void>}
 */
export const smoothDragVertical = async (startX, startY, endX, endY, stepDistance = 10) => {
  log.debug("开始平滑拖动，从 ({x1}, {y1}) 到 ({x2}, {y2})", startX, startY, endX, endY);

  // 移动到起始位置
  moveMouseTo(startX, startY);

  // 按住鼠标左键
  leftButtonDown();

  // 计算总距离和步数
  const totalDistanceX = endX - startX;
  const totalDistanceY = endY - startY;
  const absDistanceY = Math.abs(totalDistanceY);
  const steps = Math.floor(absDistanceY / stepDistance); // 完整的步数

  // 分步移动鼠标，模拟自然拖动（使用绝对坐标）
  for (let i = 1; i <= steps; i++) {
    // 计算当前步的绝对坐标（线性插值）
    const progress = i / steps;
    const currentX = Math.round(startX + totalDistanceX * progress);
    const currentY = Math.round(startY + totalDistanceY * (i * stepDistance / absDistanceY));
    moveMouseTo(currentX, currentY);
    await sleep(10); // 每次移动后延迟 10 毫秒
  }

  // 最后确保精确到达目标位置
  moveMouseTo(endX, endY);
  await sleep(10);

  // 释放鼠标左键前稍作延迟
  await sleep(700);
  leftButtonUp();
  await sleep(500);

  log.debug("拖动完成");
};
