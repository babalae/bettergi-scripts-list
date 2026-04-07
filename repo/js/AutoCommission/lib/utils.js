// 原神每日委托自动执行脚本 - 工具函数模块
var Utils = {
  // OCR区域调试工具
  iframe: async function (ocrRegion) {
    try {
      // 参数验证
      if (!ocrRegion || typeof ocrRegion !== "object") {
        log.error("OCR区域参数不能为空且必须是对象, 收到: " + typeof ocrRegion);
        return;
      }

      var X = ocrRegion.X;
      var Y = ocrRegion.Y;
      var WIDTH = ocrRegion.WIDTH;
      var HEIGHT = ocrRegion.HEIGHT;

      // 属性验证
      if (
        typeof X !== "number" ||
        typeof Y !== "number" ||
        typeof WIDTH !== "number" ||
        typeof HEIGHT !== "number"
      ) {
        log.error(
          "OCR区域的X、Y、WIDTH、HEIGHT必须都是数字, 收到: X=" +
            X +
            ", Y=" +
            Y +
            ", WIDTH=" +
            WIDTH +
            ", HEIGHT=" +
            HEIGHT
        );
        return;
      }

      log.info("i{index}", { X: X, Y: Y, WIDTH: WIDTH, HEIGHT: HEIGHT });

      // 最简单的方式创建OCR识别对象
      var ro = RecognitionObject.Ocr(X, Y, WIDTH, HEIGHT);
      ro.Name = "debug";
      ro.DrawOnWindow = true;

      // 捕获并识别
      var region = captureGameRegion();
      region.Find(ro);
      region.dispose();

      // 2000毫秒后移除绘制的边框
      setTimeout(function () {
        // 使用相同的名称移除边框
        var drawContent = VisionContext.Instance().DrawContent;
        drawContent.RemoveRect("debug");
        // 或者也可以使用 drawContent.Clear() 清除所有绘制的内容

        log.info("已移除边框");
      }, 2000);
    } catch (error) {
      // 记录完整错误信息
      log.error("详细错误: " + JSON.stringify(error));
    }
  },
  easyTemplateMatch: async function (imgPath, ocrRegion, useMask = false) {
    try {
      // 参数验证
      if (!ocrRegion || typeof ocrRegion !== "object") {
        log.error("TemplateMatch区域参数不能为空且必须是对象, 收到: " + typeof ocrRegion);
        return { count: 0 };
      }

      var X = ocrRegion.X;
      var Y = ocrRegion.Y;
      var WIDTH = ocrRegion.WIDTH;
      var HEIGHT = ocrRegion.HEIGHT;

      // 属性验证
      if (
        typeof X !== "number" ||
        typeof Y !== "number" ||
        typeof WIDTH !== "number" ||
        typeof HEIGHT !== "number"
      ) {
        log.error(
          "TemplateMatch区域的X、Y、WIDTH、HEIGHT必须都是数字, 收到: X=" +
            X +
            ", Y=" +
            Y +
            ", WIDTH=" +
            WIDTH +
            ", HEIGHT=" +
            HEIGHT
        );
        return { count: 0 };
      }

      // 数值合理性验证
      if (X < 0 || Y < 0 || WIDTH <= 0 || HEIGHT <= 0) {
        log.error(
          "TemplateMatch区域参数必须为正数, 收到: X=" +
            X +
            ", Y=" +
            Y +
            ", WIDTH=" +
            WIDTH +
            ", HEIGHT=" +
            HEIGHT
        );
        return { count: 0 };
      }

      // log.info("进行文字识别")
      // 创建OCR识别对象
      let mat = file.readImageMatSync(imgPath);
      var TemplateMatchRo = RecognitionObject.TemplateMatch(
        mat,
        X,
        Y,
        WIDTH,
        HEIGHT
      );
      TemplateMatchRo.UseMask = useMask;

      // 截图识别
      var captureRegion = captureGameRegion();
      var results = await captureRegion.findMulti(TemplateMatchRo);
      captureRegion.dispose();

      return results;
    } catch (error) {
      log.error("TemplateMatch识别出错: {error}", error.message);
      return { count: 0 };
    }
  },
  // 简单OCR识别函数
  easyOCR: async function (ocrRegion) {
    try {
      // 参数验证
      if (!ocrRegion || typeof ocrRegion !== "object") {
        log.error("OCR区域参数不能为空且必须是对象, 收到: " + typeof ocrRegion);
        return { count: 0 };
      }

      var X = ocrRegion.X;
      var Y = ocrRegion.Y;
      var WIDTH = ocrRegion.WIDTH;
      var HEIGHT = ocrRegion.HEIGHT;

      // 属性验证
      if (
        typeof X !== "number" ||
        typeof Y !== "number" ||
        typeof WIDTH !== "number" ||
        typeof HEIGHT !== "number"
      ) {
        log.error(
          "OCR区域的X、Y、WIDTH、HEIGHT必须都是数字, 收到: X=" +
            X +
            ", Y=" +
            Y +
            ", WIDTH=" +
            WIDTH +
            ", HEIGHT=" +
            HEIGHT
        );
        return { count: 0 };
      }

      // 数值合理性验证
      if (X < 0 || Y < 0 || WIDTH <= 0 || HEIGHT <= 0) {
        log.error(
          "OCR区域参数必须为正数, 收到: X=" +
            X +
            ", Y=" +
            Y +
            ", WIDTH=" +
            WIDTH +
            ", HEIGHT=" +
            HEIGHT
        );
        return { count: 0 };
      }

      // log.info("进行文字识别")
      // 创建OCR识别对象
      var locationOcrRo = RecognitionObject.Ocr(X, Y, WIDTH, HEIGHT);

      // 截图识别
      var captureRegion = captureGameRegion();
      var OCRresults = await captureRegion.findMulti(locationOcrRo);
      captureRegion.dispose();
      log.debug("OCR结果: {OCRresults}", Array.from(OCRresults).map(r => r.text) );
      return OCRresults;
    } catch (error) {
      log.error("easyOCR识别出错: {error}", error.message);
      return { count: 0 };
    }
  },

  // 单个OCR识别函数
  easyOCROne: async function (ocrdata) {
    var results = await Utils.easyOCR(ocrdata);
    if (results.count > 0) {
      // 取第一个结果作为地点
      return results[0].text.trim();
    }
    return "";
  },

  // 清理文本（去除标点符号等）
  cleanText: function (text) {
    if (!text) return "";
    // 去除标点符号和特殊字符
    return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").trim();
  },

  // 解析跳过的委托列表
  parseSkipCommissions: function (skipCommissionsStr) {
    if (!skipCommissionsStr || typeof skipCommissionsStr !== "string") {
      return [];
    }

    // 支持中文逗号和英文逗号分割
    return skipCommissionsStr
      .split(/[,，]/)
      .map(function (name) {
        return name.trim();
      })
      .filter(function (name) {
        return name.length > 0;
      });
  },

  // 读取角色别名文件
  readAliases: function () {
    try {
      var combatText = file.ReadTextSync("Data/avatar/combat_avatar.json");
      var combatData = JSON.parse(combatText);
      var aliases = {};
      for (var i = 0; i < combatData.length; i++) {
        var character = combatData[i];
        if (character.alias && character.name) {
          for (var j = 0; j < character.alias.length; j++) {
            var alias = character.alias[j];
            aliases[alias] = character.name;
          }
        }
      }
      return aliases;
    } catch (error) {
      log.error("读取角色别名文件失败: {error}", error.message);
      return {};
    }
  },

  // 获取设置配置
  getSetting: async function () {
    try {
      var skipRecognition = settings.skipRecognition || false;
      var prepare = settings.prepare || false;
      var team = settings.team || "";
      var skipCommissions = "";

      var result = {
        skipRecognition: skipRecognition,
        prepare: prepare,
        team: team,
        skipCommissions: skipCommissions,
      };

      log.debug("setting:{index}", result);

      return result;
    } catch (error) {
      log.error("getSetting函数出现错误,将使用默认配置");
      return {
        skipRecognition: false,
        prepare: true,
        team: "",
        skipCommissions: "",
      };
    }
  },

  // 睡眠函数包装
  sleep: function (ms) {
    return sleep(ms);
  },

  // 随机延迟函数
  randomDelay: async function (min, max) {
    var delay = Math.random() * (max - min) + min;
    return await Utils.sleep(delay);
  },

  // 人名提取函数
  extractName: function (text) {
    var patterns = [
      /与(.+?)对话/,
      /与(.+?)一起/,
      /同(.+?)交谈/,
      /向(.+?)打听/,
      /向(.+?)回报/,
      /向(.+?)报告/,
      /给(.+?)听/,
      /陪同(.+?)\S+/,
      /找到(.+?)\S+/,
      /询问(.+?)\S+/,
      /拜访(.+?)\S+/,
      /寻找(.+?)\S+/,
      /告诉(.+?)\S+/,
      /带(.+?)去\S+/,
      /跟随(.+?)\S+/,
      /协助(.+?)\S+/,
      /请教(.+?)\S+/,
      /拜托(.+?)\S+/,
      /委托(.+?)\S+/,
    ];

    for (var i = 0; i < patterns.length; i++) {
      var pattern = patterns[i];
      var match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  },

  // 错误处理和恢复函数
  handleError: async function (error, context) {
    log.error("发生错误: {error}", error.message);

    if (context) {
      log.error("错误上下文: {context}", context);
    }

    try {
      await genshin.returnMainUi();
      log.info("已尝试返回主界面");
    } catch (recoveryError) {
      log.warn("返回主界面时出错: {error}", recoveryError.message);
    }
  },

  // 计算两点之间的距离
  calculateDistance: function (point1, point2) {
    if (
      !point1 ||
      !point2 ||
      !point1.X ||
      !point1.Y ||
      !point2.x ||
      !point2.y
    ) {
      log.warn("无效的位置数据");
      return Infinity;
    }
    return Math.sqrt(
      Math.pow(point1.X - point2.x, 2) + Math.pow(point1.Y - point2.y, 2)
    );
  },

  // 确保目录存在
  ensureDirectoryExists: async function (dirPath) {
    try {
      // 尝试创建目录，如果目录已存在，writeTextSync不会报错
      // 创建一个临时文件来确保目录存在
      var tempFilePath = dirPath + "/.temp";
      file.writeTextSync(tempFilePath, "");
      // log.info(`已确保目录存在: ${dirPath}`);
      return true;
    } catch (error) {
      log.error("创建目录时出错: {error}", error);
      return false;
    }
  },
};
