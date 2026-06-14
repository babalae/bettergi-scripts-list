// 原神每日委托自动执行脚本 - 委托数据管理模块
var CommissionData = {
  // 支持的委托列表
  supportedCommissions: {
    fight: [],
    talk: []
  },

  // 加载支持的委托列表
  loadSupportedCommissions: async function() {
    var supportedCommissions = {
      fight: [],
      talk: []
    };

    try {
      // 使用正确的文件读取方法
      log.info("开始读取支持的委托列表: {path}", Constants.SUPPORT_LIST_PATH);

      // 尝试读取文件内容
      try {
        var supportListContent = file.readTextSync(Constants.SUPPORT_LIST_PATH);

        if (supportListContent && supportListContent.trim()) {
          try {
            // 解析JSON格式
            var commissionData = JSON.parse(supportListContent);
            supportedCommissions.fight = commissionData.fight || [];
            supportedCommissions.talk = commissionData.talk || [];

            log.info(
              "已加载支持的战斗委托列表，共 {count} 个",
              supportedCommissions.fight.length
            );
            log.info(
              "已加载支持的对话委托列表，共 {count} 个",
              supportedCommissions.talk.length
            );
          } catch (jsonError) {
            log.error("解析委托列表JSON失败: {error}", jsonError);
          }
        } else {
          log.warn("支持的委托列表为空");
        }
      } catch (readError) {
        // 如果读取失败，检查文件是否存在
        log.error("读取委托列表失败: {error}", readError);

        // 尝试创建文件
        try {
          // 创建默认的JSON结构
          var defaultJson = JSON.stringify(
            {
              fight: [],
              talk: []
            },
            null,
            2
          );

          var writeResult = file.writeTextSync(
            Constants.SUPPORT_LIST_PATH,
            defaultJson
          );
          if (writeResult) {
            log.info("已创建空的委托列表文件");
          } else {
            log.error("创建委托列表文件失败");
          }
        } catch (writeError) {
          log.error("创建委托列表文件失败: {error}", writeError);
        }
      }
    } catch (error) {
      log.error("处理委托列表时出错: {error}", error.message);
    }

    // 保存到内存中
    CommissionData.supportedCommissions = supportedCommissions;

    log.info(
      "加载委托数据完成: 战斗委托 {fight} 个，对话委托 {talk} 个",
      CommissionData.supportedCommissions.fight.length,
      CommissionData.supportedCommissions.talk.length
    );

    return CommissionData.supportedCommissions;
  },

  // 获取支持的委托列表
  getSupportedCommissions: function() {
    return CommissionData.supportedCommissions;
  },

  // 保存委托数据到文件
  saveCommissionsData: async function(commissionsTable) {
    try {
      log.info("保存委托数据到文件...");

      // 创建JSON格式的委托数据
      var commissionsData = {
        timestamp: new Date().toISOString(),
        commissions: commissionsTable,
      };

      // 保存到文件
      var outputPath = Constants.OUTPUT_DIR + "/commissions_data.json";
      try {
        var jsonResult = file.writeTextSync(
          outputPath,
          JSON.stringify(commissionsData, null, 2)
        );
        if (jsonResult) {
          log.info("委托数据已保存到: {path}", outputPath);
        } else {
          log.error("保存委托数据失败");
        }
      } catch (jsonError) {
        log.error("保存委托数据失败: {error}", jsonError.message);
      }

      // 创建可读的文本报告
      var reportContent = "# 原神每日委托识别报告\r\n";
      reportContent += "生成时间: " + new Date().toLocaleString() + "\r\n\r\n";
      reportContent += "## 委托列表\r\n\r\n";

      for (var i = 0; i < commissionsTable.length; i++) {
        var commission = commissionsTable[i];
        var supportStatus = commission.supported ? "✅ 支持" : "❌ 不支持";
        var typeInfo = commission.type ? "[" + commission.type + "]" : "";
        reportContent += commission.id + ". " + commission.name + " " + typeInfo + " - " + supportStatus + "\r\n";
      }

      // 保存报告
      var reportPath = Constants.OUTPUT_DIR + "/commissions_report.txt";
      try {
        var reportResult = file.writeTextSync(reportPath, reportContent);
        if (reportResult) {
          log.info("委托报告已保存到: {path}", reportPath);
        } else {
          log.error("保存委托报告失败");
        }
      } catch (reportError) {
        log.error("保存委托报告失败: {error}", reportError.message);
      }

      return commissionsTable.filter(function(c) { return c.supported; });
    } catch (error) {
      log.error("处理委托数据时出错: {error}", error.message);
      return [];
    }
  },

  // 生成委托报告内容
  generateCommissionReport: function(allCommissions, startTime, endTime) {
    var reportLines = [];
    
    // 报告头部
    reportLines.push("======================================");
    reportLines.push("原神每日委托识别报告");
    reportLines.push("======================================");
    reportLines.push("");
    reportLines.push("生成时间: " + endTime.toLocaleString());
    reportLines.push("执行时间: " + startTime.toLocaleString() + " - " + endTime.toLocaleString());
    reportLines.push("执行耗时: " + Math.round((endTime - startTime) / 1000) + " 秒");
    reportLines.push("");

    // 委托统计
    var totalCommissions = allCommissions.length;
    var supportedCount = allCommissions.filter(function(c) { return c.supported; }).length;
    var completedCount = allCommissions.filter(function(c) { return c.location === "已完成"; }).length;
    var fightCount = allCommissions.filter(function(c) { return c.type === Constants.COMMISSION_TYPE.FIGHT; }).length;
    var talkCount = allCommissions.filter(function(c) { return c.type === Constants.COMMISSION_TYPE.TALK; }).length;

    reportLines.push("委托统计:");
    reportLines.push("  总委托数: " + totalCommissions);
    reportLines.push("  支持委托: " + supportedCount);
    reportLines.push("  已完成委托: " + completedCount);
    reportLines.push("  战斗委托: " + fightCount);
    reportLines.push("  对话委托: " + talkCount);
    reportLines.push("");

    // 详细委托列表
    reportLines.push("详细委托列表:");
    reportLines.push("--------------------------------------");
    
    for (var i = 0; i < allCommissions.length; i++) {
      var commission = allCommissions[i];
      var supportStatus = commission.supported ? "✅ 支持" : "❌ 不支持";
      var typeInfo = commission.type ? "[" + commission.type + "]" : "[未知类型]";
      var locationInfo = commission.location || "未知地点";
      var countryInfo = commission.country ? "{" + commission.country + "}" : "{未知国家}";
      
      reportLines.push(
        commission.id + ". " + commission.name + " " + 
        "(" + locationInfo + ") " + countryInfo + " " + 
        typeInfo + " - " + supportStatus
      );
      
      // 如果有位置坐标，也添加到报告中
      if (commission.CommissionPosition) {
        reportLines.push(
          "   坐标: (" + commission.CommissionPosition.x + ", " + 
          commission.CommissionPosition.y + ")"
        );
      }
    }

    reportLines.push("");
    reportLines.push("======================================");
    reportLines.push("报告结束");
    reportLines.push("======================================");

    return reportLines.join("\n");
  },

  // 筛选支持的委托
  filterSupportedCommissions: function(allCommissions) {
    return allCommissions.filter(function(commission) {
      return commission.supported && commission.location !== "已完成";
    });
  },

  // 按类型分组委托
  groupCommissionsByType: function(commissions) {
    var grouped = {
      fight: [],
      talk: [],
      unknown: []
    };

    for (var i = 0; i < commissions.length; i++) {
      var commission = commissions[i];
      if (commission.type === Constants.COMMISSION_TYPE.FIGHT) {
        grouped.fight.push(commission);
      } else if (commission.type === Constants.COMMISSION_TYPE.TALK) {
        grouped.talk.push(commission);
      } else {
        grouped.unknown.push(commission);
      }
    }

    return grouped;
  },

  // 从数据文件加载委托（用于跳过识别功能）
  loadCommissionsFromDataFile: async function() {
    try {
      log.info("开始从Data文件夹加载委托数据...");
      
      // 读取委托数据文件
      var dataContent = file.readTextSync(Constants.COMMISSIONS_DATA_PATH);
      var data = JSON.parse(dataContent);
      
      var allCommissions = [];
      
      // 处理战斗委托
      if (data.fightCommissions && Array.isArray(data.fightCommissions)) {
        for (var i = 0; i < data.fightCommissions.length; i++) {
          var commission = data.fightCommissions[i];
          allCommissions.push({
            id: "fight_" + i,
            name: commission.name,
            location: commission.location,
            country: commission.country || "未知国家",
            type: Constants.COMMISSION_TYPE.FIGHT,
            supported: commission.supported !== false, // 默认为支持
            completed: false // 假设未完成，让后续流程判断
          });
        }
      }
      
      // 处理对话委托
      if (data.talkCommissions && Array.isArray(data.talkCommissions)) {
        for (var i = 0; i < data.talkCommissions.length; i++) {
          var commission = data.talkCommissions[i];
          allCommissions.push({
            id: "talk_" + i,
            name: commission.name,
            location: commission.location,
            country: commission.country || "未知国家",
            type: Constants.COMMISSION_TYPE.TALK,
            supported: commission.supported !== false, // 默认为支持
            completed: false // 假设未完成，让后续流程判断
          });
        }
      }
      
      log.info("从数据文件加载了 {count} 个委托", allCommissions.length);
      log.info("其中战斗委托 {fight} 个，对话委托 {talk} 个", 
               data.fightCommissions ? data.fightCommissions.length : 0,
               data.talkCommissions ? data.talkCommissions.length : 0);
      
      return allCommissions;
      
    } catch (error) {
      log.error("从数据文件加载委托时出错: {error}", error.message);
      log.warn("将返回空列表，建议检查数据文件是否存在和格式是否正确");
      return [];
    }
  },

  // 查找委托的处理脚本路径
  findCommissionScript: async function(commissionName, location, type) {
    try {
      var basePath;
      
      if (type === Constants.COMMISSION_TYPE.FIGHT) {
        // 战斗委托脚本路径
        basePath = Constants.FIGHT_SCRIPT_BASE_PATH;
      } else if (type === Constants.COMMISSION_TYPE.TALK) {
        // 对话委托脚本路径
        basePath = Constants.TALK_PROCESS_BASE_PATH;
      } else {
        log.warn("未知的委托类型: {type}", type);
        return null;
      }

      // 构建脚本文件路径
      var scriptPath = basePath + "/" + commissionName + "/" + location;
      
      // 检查路径是否存在
      try {
        var testContent = file.readTextSync(scriptPath + "/process.json");
        log.info("找到委托脚本: {path}", scriptPath);
        return scriptPath;
      } catch (error) {
        log.warn("未找到委托脚本: {path}", scriptPath);
        return null;
      }
    } catch (error) {
      log.error("查找委托脚本时出错: {error}", error.message);
      return null;
    }
  },

  // 验证委托数据完整性
  validateCommissionData: function(commission) {
    var isValid = true;
    var issues = [];

    // 检查必要字段
    if (!commission.id) {
      issues.push("缺少委托ID");
      isValid = false;
    }

    if (!commission.name || commission.name.trim().length === 0) {
      issues.push("缺少委托名称");
      isValid = false;
    }

    if (typeof commission.supported !== "boolean") {
      issues.push("支持状态字段无效");
      isValid = false;
    }

    if (!commission.location) {
      issues.push("缺少委托地点");
      isValid = false;
    }

    // 如果有问题，记录日志
    if (!isValid) {
      log.warn(
        "委托数据验证失败 - {name}: {issues}",
        commission.name || "未知委托",
        issues.join(", ")
      );
    }

    return {
      isValid: isValid,
      issues: issues
    };
  },

  // 统计委托执行结果
  calculateExecutionStats: function(commissions, executionResults) {
    var stats = {
      total: commissions.length,
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      successRate: 0
    };

    for (var i = 0; i < executionResults.length; i++) {
      var result = executionResults[i];
      stats.attempted++;
      
      if (result.success) {
        stats.successful++;
      } else {
        stats.failed++;
      }
    }

    stats.skipped = stats.total - stats.attempted;
    stats.successRate = stats.attempted > 0 ? 
      Math.round((stats.successful / stats.attempted) * 100) : 0;

    return stats;
  },

  // 创建委托执行摘要
  createExecutionSummary: function(stats, executionTime) {
    var summary = [];
    
    summary.push("执行摘要:");
    summary.push("  总委托数: " + stats.total);
    summary.push("  尝试执行: " + stats.attempted);
    summary.push("  执行成功: " + stats.successful);
    summary.push("  执行失败: " + stats.failed);
    summary.push("  跳过委托: " + stats.skipped);
    summary.push("  成功率: " + stats.successRate + "%");
    summary.push("  总耗时: " + Math.round(executionTime / 1000) + " 秒");
    
    return summary.join("\n");
  },

  // 更新commissions_data.json文件，将识别到的委托信息合并到数据文件中
  updateCommissionsDataFile: async function(recognizedCommissions) {
    try {
      // 读取现有的委托数据
      var existingData;
      try {
        var existingContent = file.readTextSync(Constants.COMMISSIONS_DATA_PATH);
        existingData = JSON.parse(existingContent);
      } catch (error) {
        log.warn("无法读取现有委托数据，将创建新的数据结构");
        existingData = {
          timestamp: new Date().toISOString(),
          fightCommissions: [],
          talkCommissions: []
        };
      }

      // 确保数据结构正确
      if (!existingData.fightCommissions) existingData.fightCommissions = [];
      if (!existingData.talkCommissions) existingData.talkCommissions = [];

      var newFightCommissions = [];
      var newTalkCommissions = [];
      var updatedCount = 0;

      // 处理识别到的委托
      for (var i = 0; i < recognizedCommissions.length; i++) {
        var commission = recognizedCommissions[i];
        
        // 创建标准化的委托对象
        var standardCommission = {
          name: commission.name || "未知委托",
          location: commission.location || "未知地点",
          country: commission.country || "未知国家",
          supported: commission.supported || false,
          description: "由脚本自动识别添加 - " + new Date().toLocaleDateString()
        };

        // 根据类型分类
        if (commission.type === Constants.COMMISSION_TYPE.FIGHT) {
          // 检查是否已存在
          var existsInFight = existingData.fightCommissions.some(function(existing) {
            return existing.name === standardCommission.name && 
                   existing.location === standardCommission.location;
          });
          
          if (!existsInFight) {
            newFightCommissions.push(standardCommission);
            updatedCount++;
          }
        } else if (commission.type === Constants.COMMISSION_TYPE.TALK) {
          // 检查是否已存在
          var existsInTalk = existingData.talkCommissions.some(function(existing) {
            return existing.name === standardCommission.name && 
                   existing.location === standardCommission.location;
          });
          
          if (!existsInTalk) {
            newTalkCommissions.push(standardCommission);
            updatedCount++;
          }
        }
      }

      // 合并新委托到现有数据
      existingData.fightCommissions = existingData.fightCommissions.concat(newFightCommissions);
      existingData.talkCommissions = existingData.talkCommissions.concat(newTalkCommissions);
      existingData.timestamp = new Date().toISOString();

      // 保存更新后的数据
      var updatedContent = JSON.stringify(existingData, null, 2);
      var success = file.writeTextSync(Constants.COMMISSIONS_DATA_PATH, updatedContent);

      if (success) {
        log.info("委托数据文件已更新: 新增 {count} 个委托", updatedCount);
        log.info("当前数据: 战斗委托 {fight} 个，对话委托 {talk} 个", 
                existingData.fightCommissions.length, 
                existingData.talkCommissions.length);
        return true;
      } else {
        log.error("委托数据文件写入失败");
        return false;
      }

    } catch (error) {
      log.error("更新委托数据文件时出错: {error}", error.message);
      return false;
    }
  }
};