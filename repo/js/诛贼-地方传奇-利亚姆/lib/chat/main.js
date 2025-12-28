


eval(file.readTextSync("ChatCore.js"));

// ChatCore.main();

// 改进的测试脚本 - 直接调用函数并查看结果
log.info("=== 改进的 chatWithHistory 测试 ===");

// 重置历史记录，确保测试环境干净
ChatCore.conversationHistory = [];
ChatCore.log("已清空历史记录");

// 测试1: 正常对话
log.info("\n--- 测试1: 首次对话 ---");
var result1 = ChatCore.chatWithHistory("你好");
log.info("输入: 你好");
log.info("回复:", result1.reply);
log.info("是否重复:", result1.isDuplicate);
log.info("表情:", result1.emojiName);

// 测试2: 重复检测
log.info("\n--- 测试2: 重复输入检测 ---");
var result2 = ChatCore.chatWithHistory("你好");
log.info("输入: 你好");
log.info("回复:", result2.reply);
log.info("是否重复:", result2.isDuplicate);

// 测试3: 新消息
log.info("\n--- 测试3: 新消息 ---");
var result3 = ChatCore.chatWithHistory("在吗");
log.info("输入: 在吗");
log.info("回复:", result3.reply);
log.info("是否重复:", result3.isDuplicate);



log.info("\n=== 测试完成 ===");