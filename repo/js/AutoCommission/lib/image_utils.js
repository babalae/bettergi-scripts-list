// 原神每日委托自动执行脚本 - 图像识别工具模块
// 感谢 吉吉喵
// OTZ
var ImageUtils = {
  
  // 全局资源管理变量
  globalLatestRa: null,

  // 增强版图像识别函数
  recognizeImage: async function(
    recognitionObject, 
    ra, 
    timeout, 
    interval, 
    useNewScreenshot, 
    iconType
  ) {
    timeout = timeout || 1000;
    interval = interval || 500;
    useNewScreenshot = useNewScreenshot || false;
    iconType = iconType || null;
    
    var startTime = Date.now();
    
    // 只释放与当前ra不同的全局资源
    if (ImageUtils.globalLatestRa && ImageUtils.globalLatestRa !== ra) {
      ImageUtils.globalLatestRa.dispose();
    }
    ImageUtils.globalLatestRa = ra;
    var originalRa = ra;
    var tempRa = null;

    try {
      while (Date.now() - startTime < timeout) {
        var currentRa;
        if (useNewScreenshot) {
          // 释放之前的临时资源
          if (tempRa) {
            tempRa.dispose();
          }
          tempRa = captureGameRegion();
          currentRa = tempRa;
          ImageUtils.globalLatestRa = currentRa;
        } else {
          // 不使用新截图时直接使用原始ra，不重复释放
          currentRa = originalRa;
        }

        if (currentRa) {
          try {
            var result = currentRa.find(recognitionObject);
            if (result.isExist() && result.x !== 0 && result.y !== 0) {
              return {
                isDetected: true,
                iconType: iconType,
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
                ra: ImageUtils.globalLatestRa,
                usedNewScreenshot: useNewScreenshot
              };
            }
          } catch (error) {
            log.error("【{iconType}识别异常】: {error}", iconType || "未知", error.message);
          }
        }

        await sleep(interval);
      }
    } finally {
      // 释放临时资源但保留全局引用的资源
      if (tempRa && tempRa !== ImageUtils.globalLatestRa) {
        tempRa.dispose();
      }
      // 只释放原始资源如果它不再是全局引用
      if (originalRa && originalRa !== ImageUtils.globalLatestRa) {
        originalRa.dispose();
      }
    }

    return {
      isDetected: false,
      iconType: iconType,
      x: null,
      y: null,
      width: null,
      height: null,
      ra: ImageUtils.globalLatestRa,
      usedNewScreenshot: useNewScreenshot
    };
  },

  // 释放全局图像资源
  disposeGlobalResources: function() {
    if (ImageUtils.globalLatestRa) {
      ImageUtils.globalLatestRa.dispose();
      ImageUtils.globalLatestRa = null;
    }
  },

  // 获取当前全局图像资源
  getGlobalImageResource: function() {
    return ImageUtils.globalLatestRa;
  }
};

// 使用示例：
// 
// 1. 基础使用
// var captureRegion = captureGameRegion();
// var ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/button.png"));
// var result = await ImageUtils.recognizeImage(ro, captureRegion);
// 
// 2. 完整参数使用
// var result = await ImageUtils.recognizeImage(
//     recognitionObject,  // 识别对象
//     captureRegion,      // 截图区域
//     2000,              // 超时时间（毫秒）
//     300,               // 重试间隔（毫秒）
//     true,              // 使用新截图
//     "按钮图标"          // 图标类型（用于日志）
// );
//
// 3. 处理识别结果
// if (result.isDetected) {
//     log.info("找到{iconType}，位置: ({x}, {y})", result.iconType, result.x, result.y);
//     click(result.x + result.width/2, result.y + result.height/2);
// } else {
//     log.warn("未找到{iconType}", result.iconType);
// }
//
// 4. 清理资源
// ImageUtils.disposeGlobalResources();
