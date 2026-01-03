// 原神每日委托自动执行脚本 - 常量定义模块
var Constants = {
  // 文件路径常量
  SUPPORT_LIST_PATH: "name.json",
  OUTPUT_DIR: "Data",
  FIGHT_SCRIPT_BASE_PATH: "assets",  // 战斗委托脚本基础路径
  TALK_PROCESS_BASE_PATH: "assets/process",  // 对话委托脚本基础路径
  COMMISSIONS_DATA_PATH: "Data/commissions_data.json",  // 委托数据文件路径
  COMMISSIONS_REPORT_PATH: "Data/commissions_report.txt",  // 委托报告文件路径

  // 图像识别相关常量
  COMPLETED_IMAGE_PATH: "Data/RecognitionObject/Completed.png",
  UNCOMPLETED_IMAGE_PATH: "Data/RecognitionObject/UnCompleted.png",
  TALK_EXIT_IMAGE_PATH:"Data/RecognitionObject/TalkExit.png",
  TALK_ICON_IMAGE_PATH:"Data/RecognitionObject/TalkIcon.png",
  
  // 基础配置常量
  MIN_TEXT_LENGTH: 3, // 最小文本长度
  MAX_COMMISSION_RETRY_COUNT: 1, // 默认重试机制，超过则跳过该委托

  // 委托类型常量
  COMMISSION_TYPE: {
    FIGHT: "fight",
    TALK: "talk",
  },

  // OCR识别区域常量
  OCR_REGIONS: {
    Main_Dev: [
      // 第1个委托名字
      {
        X: 796,
        Y: 293,
        WIDTH: 440,
        HEIGHT: 40,
      },
      // 第2个委托名字
      {
        X: 796,
        Y: 401,
        WIDTH: 440,
        HEIGHT: 40,
      },
      // 第3个委托名字
      {
        X: 796,
        Y: 509,
        WIDTH: 440,
        HEIGHT: 40,
      },
      // 第4个委托名字(滑动后)
      {
        X: 796,
        Y: 544,
        WIDTH: 440,
        HEIGHT: 40,
      },
    ],

    // 主要委托识别区域
    MAIN: {
      X: 750,
      Y: 250,
      WIDTH: 450,
      HEIGHT: 400,
    },
    // 委托地点OCR区域
    LOCATION: {
      X: 1530,
      Y: 100,
      WIDTH: 250, // 1630 - 1530
      HEIGHT: 30, // 130 - 100
    },
    // 委托详情页面国家检测OCR区域
    DETAIL_COUNTRY: {
      X: 1480,
      Y: 100,
      WIDTH: 55, // 1535 - 1480
      HEIGHT: 30, // 130 - 100
    },
    // 委托触发检测区域
    COMMISSION_TRIGGER: {
      X: 885,
      Y: 200,
      WIDTH: 165, // 1050 - 885
      HEIGHT: 50, // 250 - 200
    },
    // 委托完成检测区域
    COMMISSION_COMPLETE: {
      X: 880,
      Y: 165,
      WIDTH: 170, // 1050 - 880
      HEIGHT: 45, // 210 - 165
    },
    // 委托追踪检测区域
    COMMISSION_TRACKING: {
      X: 1622,
      Y: 987,
      WIDTH: 137,
      HEIGHT: 35,
    },
    // 委托详情检测区域
    COMMISSION_DETAIL: {
      X: 76,
      Y: 239,
      WIDTH: 280, // 358 - 76
      HEIGHT: 43, // 272-239
    },
  },

  // 委托详情按钮位置常量
  COMMISSION_DETAIL_BUTTONS: [
    { id: 1, x: 1550, y: 320, checkX: 1450, checkWidth: 150 }, // 第一个委托详情按钮
    { id: 2, x: 1550, y: 440, checkX: 1450, checkWidth: 150 }, // 第二个委托详情按钮
    { id: 3, x: 1550, y: 530, checkX: 1500, checkWidth: 100 }, // 第三个委托详情按钮
    { id: 4, x: 1550, y: 560, checkX: 1450, checkWidth: 150 }, // 第四个委托详情按钮（滑动后）
  ],

  // 其他兼容性常量（保持向后兼容）
  LOCATION_OCR_X: 1530,
  LOCATION_OCR_Y: 100,
  LOCATION_OCR_WIDTH: 250, // 1630 - 1530
  LOCATION_OCR_HEIGHT: 30, // 130 - 100

  // 委托触发检测区域
  COMMISSION_TRIGGER_OCR_X: 885,
  COMMISSION_TRIGGER_OCR_Y: 200,
  COMMISSION_TRIGGER_OCR_WIDTH: 165, // 1050 - 885
  COMMISSION_TRIGGER_OCR_HEIGHT: 50, // 250 - 200

  // 委托完成检测区域
  COMMISSION_COMPLETE_OCR_X: 880,
  COMMISSION_COMPLETE_OCR_Y: 165,
  COMMISSION_COMPLETE_OCR_WIDTH: 170, // 1050 - 880
  COMMISSION_COMPLETE_OCR_HEIGHT: 45, // 210 - 165
};
