// 步骤处理器加载器和工厂
var StepProcessorLoader = {
  // 存储已加载的步骤处理器
  processors: {},
  
  // 动态加载步骤处理器
  loadStepProcessors: function() {
    try {
      // 尝试获取lib/steps目录下的所有.js文件
      var stepFiles = [];
      
      // 使用BGI支持的ReadPathSync方法获取文件列表
      try {
        if (typeof file.ReadPathSync === "function") {
          var allPaths = file.ReadPathSync("lib/steps");
          
          // 确保返回的是数组类型，并进行类型转换
          if (!Array.isArray(allPaths)) {
            // 如果不是数组，尝试转换为数组
            allPaths = Array.from(allPaths || []);
          }
          
          stepFiles = allPaths.filter(function(path) {
            // 只选择.js文件，排除文件夹
            // 检查路径是否在lib/steps目录下且是.js文件
            return path.toLowerCase().endsWith(".js") && 
                   (path.indexOf("lib/steps/") === 0 || path.indexOf("lib\\steps\\") === 0);
          }).map(function(path) {
            // 移除lib/steps/前缀，只保留文件名
            return path.replace(/^lib[\/\\]steps[\/\\]/, "");
          });
        } else {
          throw new Error("file.ReadPathSync方法不可用");
        }
      } catch (getDirError) {
        log.warn("无法动态扫描目录: {error}，使用预定义文件列表", getDirError.message);
        throw getDirError;
      }
      
      log.info("发现 {count} 个步骤处理器文件", stepFiles.length);

      // 加载所有步骤处理器文件
      for (var i = 0; i < stepFiles.length; i++) {
        var fileName = stepFiles[i];
        try {
          log.info("正在加载步骤处理器: {file}", fileName);
          eval(file.readTextSync("lib/steps/" + fileName));
          log.debug("步骤处理器 {file} 加载成功", fileName);
        } catch (error) {
          log.error("加载步骤处理器 {file} 失败: {error}", fileName, error.message);
        }
      }
      
      log.info("步骤处理器动态加载完成，共注册 {count} 个处理器", Object.keys(this.processors).length);
    } catch (error) {
      log.error("动态扫描步骤处理器目录失败: {error}", error.message);
      log.warn("将使用备用的固定文件列表加载方式");
      this.loadStepProcessorsFallback();
    }
  },

  // 备用加载方式（如果动态扫描失败）
  loadStepProcessorsFallback: function() {
    var stepFiles = [
      "map-tracking.js",
      "wait.js",
      "commission-tracking.js",
      "key-mouse-script.js",
      "key-press.js",
      "teleport.js",
      "wait-main-ui.js",
      "location-detection.js",
      "commission-description-detection.js",
      "switch-role.js",
      "switch-team.js",
      "auto-task.js"
    ];

    // 加载所有步骤处理器文件
    for (var i = 0; i < stepFiles.length; i++) {
      var fileName = stepFiles[i];
      try {
        log.info("正在加载步骤处理器: {file}", fileName);
        eval(file.readTextSync("lib/steps/" + fileName));
        log.debug("步骤处理器 {file} 加载成功", fileName);
      } catch (error) {
        log.error("加载步骤处理器 {file} 失败: {error}", fileName, error.message);
      }
    }
    
    log.info("备用方式加载完成，共注册 {count} 个处理器", Object.keys(this.processors).length);
  },

  // 注册新的步骤处理器（供各个处理器文件调用）
  register: function(stepType, processor) {
    this.processors[stepType] = processor;
    log.info("注册步骤处理器: {type}", stepType);
  },

  // 处理步骤
  process: async function(step, context) {
    var processor = this.processors[step.type];
    if (processor) {
      await processor(step, context);
    } else {
      log.warn("未知的流程类型: {type}", step.type);
    }
  },

  // 获取所有已注册的处理器类型
  getRegisteredTypes: function() {
    return Object.keys(this.processors);
  }
};