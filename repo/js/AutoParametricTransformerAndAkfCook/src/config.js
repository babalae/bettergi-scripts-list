//作者：夜雨l星辰
// 配置模块：统一从 settings.json 读取用户配置并导出
// 字段含义与 settings.json 一一对应，修改配置时只需改这里

const config = {
    // 启用爱可菲锅配置（控制爱可菲相关步骤）
    enableAkfPot: !!settings.enableAkfPot,
    // 队伍名称
    teamName: settings.TEAMname || "",
    // 目标角色名固定，不会改变
    targetName: "爱可菲",
    // 路径文件（位于 Assets/Pathing 下）
    pathFile: "Assets/Pathing/自动参量质变仪与爱可菲烹饪.json",
    // 长按E技能时长（固定）
    eHoldMs: 3000,
    // 爱可菲长按E后等待计时时长（秒，可配置，默认60）
    eWaitSec: parseInt(settings.eWaitSec) || 60,
    // 等待完成超时（秒）
    waitTimeout: parseInt(settings.waitTimeout) || 30,
    // 启用7天质变冷却（勾选后：距上次质变不足7天则跳过执行）
    enableCooldown: !!settings.enableCooldown,
    // 启动角色辅助参量质变仪（质变期间按优先级切角色放技能/攻击）
    enableSkillHelper: !!settings.enableSkillHelper,
    // 辅助角色优先级（固定，无需配置）
    helperPriority: "妮露,爱可菲,久岐忍,芙宁娜,芭芭拉",
    // 冷却时长：7天
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
    // 上次质变完成时间记录文件
    cdRecordPath: "record/transform_cd.txt",
    // 材料计划，留空则不放入
    materialPlanStr: (settings.materialPlan || "").trim(),
    // 计划非空才执行放入
    ifInsert: (settings.materialPlan || "").trim().length > 0,
    // 参量质变仪小道具图片
    zhibianyiImg: "Assets/RecognitionObject/zhibian.png"
};

export { config };
