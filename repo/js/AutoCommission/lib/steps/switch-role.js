// 切换角色步骤处理器
(function() {
  StepProcessorLoader.register("切换角色", async function(step, context) {
    try {
      log.info("执行切换角色操作");
      
      if (!step.data) {
        log.warn("切换角色步骤缺少数据");
        return;
      }
      
      var characterData = step.data;
      var characterName;
      var position;
      
      // 处理不同的数据格式
      if (typeof characterData === "string") {
        characterName = characterData;
      } else if (typeof characterData === "object") {
        characterName = characterData.character || characterData.name;
        position = characterData.position;
      }
      
      if (!characterName && !position) {
        log.warn("切换角色步骤缺少角色信息");
        return;
      }
      
      try {
        log.info("开始切换角色：第{position}号位 -> {character}", position, characterName);
        
        // 位置坐标映射
        var positionCoordinates = [
          [460, 538],   // 第1号位
          [792, 538],   // 第2号位
          [1130, 538],  // 第3号位
          [1462, 538]   // 第4号位
        ];
        
        // 读取角色别名
        var aliases = Utils.readAliases();
        var actualName = aliases[characterName] || characterName;
        log.info("设置对应号位为【{character}】，切换角色为【{actualName}】", characterName, actualName);
        
        // 创建识别对象
        var roTeamConfig = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync("Data/RecognitionObject/队伍配置.png"),
          0, 0, 1920, 1080
        );
        var roReplace = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync("Data/RecognitionObject/更换.png"),
          0, 0, 1920, 1080
        );
        var roJoin = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync("Data/RecognitionObject/加入.png"),
          0, 0, 1920, 1080
        );
        
        var openPairingTries = 0;
        var totalOpenPairingTries = 0;
        
        // 打开配对界面的内部函数
        var openPairingInterface = async function() {
          while (openPairingTries < 3) {
            keyPress("l");
            await sleep(3500);
            const ro1 = captureGameRegion();
            var teamConfigResult = ro1.find(roTeamConfig);
            ro1.dispose();
            if (teamConfigResult.isExist()) {
              openPairingTries = 0;
              return true;
            }
            openPairingTries++;
            totalOpenPairingTries++;
          }
          if (totalOpenPairingTries < 6) {
            await genshin.tp("2297.630859375", "-824.5517578125");
            openPairingTries = 0;
            return openPairingInterface();
          } else {
            log.error("无法打开配对界面，任务结束");
            return false;
          }
        };
        
        if (!(await openPairingInterface())) {
          return false;
        }
        
        // 点击对应位置
        var coords = positionCoordinates[position - 1];
        click(coords[0], coords[1]);
        log.info("开始设置{position}号位角色", position);
        await sleep(1000);
        
        var characterFound = false;
        var pageTries = 0;
        
        // 最多尝试滚动页面20次寻找角色
        while (pageTries < 20) {
          // 尝试识别所有可能的角色文件名
          for (var num = 1; ; num++) {
            var paddedNum = num.toString().padStart(2, "0");
            var characterFileName = actualName + paddedNum;
            try {
              var characterRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync("Data/characterimage/" + characterFileName + ".png"),
                0, 0, 1920, 1080
              );
              const ro2 = captureGameRegion();
              var characterResult = ro2.find(characterRo);
              ro2.dispose();
              if (characterResult.isExist()) {
                log.info("已找到角色{character}", actualName);
                // 计算向右偏移35像素、向下偏移35像素的位置
                var targetX = characterResult.x + 35;
                var targetY = characterResult.y + 35;
                
                // 边界检查，确保坐标在屏幕范围内
                var safeX = Math.min(Math.max(targetX, 0), 1920);
                var safeY = Math.min(Math.max(targetY, 0), 1080);
                
                click(safeX, safeY);
                await sleep(500); // 点击角色后等待0.5秒
                characterFound = true;
                break;
              }
            } catch (error) {
              // 如果文件不存在，跳出循环
              break;
            }
          }
          
          if (characterFound) {
            break;
          }
          
          // 如果不是最后一次尝试，尝试滚动页面
          if (pageTries < 15) {
            log.info("当前页面没有目标角色，滚动页面");
            await UI.scrollPage(200); // 使用UI模块的scrollPage函数
          }
          pageTries++;
        }
        
        if (!characterFound) {
          log.error("未找到【{character}】", actualName);
          return false;
        }
        
        // 识别"更换"或"加入"按钮
        const ro3 = captureGameRegion();
        var replaceResult = ro3.find(roReplace);
        var joinResult = ro3.find(roJoin);
        ro3.dispose();
        
        if (replaceResult.isExist() || joinResult.isExist()) {
          await sleep(300);
          click(68, 1020);
          keyPress("VK_LBUTTON");
          await sleep(500);
          log.info("角色切换完成：{character} -> {actualName}", characterName, actualName);
          return true;
        } else {
          log.error("该角色已在队伍中，无需切换");
          await sleep(300);
          keyPress("VK_ESCAPE");
          await sleep(500);
          return false;
        }
        
      } catch (switchError) {
        log.error("切换角色时出错: {error}", switchError.message);
        
        // 尝试关闭可能打开的界面
        try {
          keyPress("VK_ESCAPE");
          await sleep(500);
        } catch (escapeError) {
          log.warn("关闭界面时出错: {error}", escapeError.message);
        }
        
        throw switchError;
      }
      
    } catch (error) {
      log.error("执行切换角色步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "切换角色",
  "data": "钟离",  // 字符串格式: 角色名称
  "note": "切换到指定角色"
}

或者对象格式:
{
  "type": "切换角色",
  "data": {
    "character": "钟离",    // 可选: 角色名称
    "name": "钟离",         // 可选: 角色名称(与character等效)
    "position": 1           // 可选: 队伍位置(1-4)
  },
  "note": "切换队伍中的角色"
}
注意: 需要角色头像文件在Data/characterimage/目录下
*/