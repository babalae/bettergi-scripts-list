/**
 * 需要战斗后重新对话开启战斗的 Boss 列表
 * (Talk to Start 战斗类型)
 * @readonly
 * @type {string[]}
 */
const BOSS_TALK_TO_START = [
    "歌裴莉娅的葬送",
    "科培琉司的劫罚",
    "纯水精灵",
    "重拳出击鸭"
];

/**
 * 未支持地图自动寻路的 Boss 列表
 * (需要使用键鼠手动寻路)
 * @readonly
 * @type {string[]}
 */
const BOSS_NO_PATHING_SUPPORT = [
    "蕴光月守宫",
    "超重型陆巡舰·机动战垒",
    "蕴光月幻蝶"
];

/**
 * 导航到指定 Boss 位置
 * @description 根据 Boss 类型选择正确的寻路方式：
 * - 未支持自动寻路的 Boss：使用强制传送 + 键鼠前往
 * - 其他 Boss：使用普通路径文件前往
 * @param {string} bossName - Boss 名称
 * @async
 */
async function navigateToBoss(bossName) {
    if (BOSS_NO_PATHING_SUPPORT.includes(bossName)) {
        //分层地图未适配区域的BOSS,使用键鼠寻路
        await pathingScript.runFile(`assets/Pathing/${bossName}强制传送.json`);
        await keyMouseScript.runFile(`assets/Pathing/${bossName}键鼠前往.json`);
    } else {
        await pathingScript.runFile(`assets/Pathing/${bossName}前往.json`);
    }
}

/**
 * 战斗后重新靠近 Boss 位置
 * @description 根据 Boss 类型执行正确的重定位策略：
 * - 需要对话交互的 Boss：执行战斗后快速前往路径
 * - 未支持自动寻路的 Boss：重新执行强制传送 + 键鼠前往
 * - 其他 Boss：读取前往路径文件，只执行最后一个位置点
 * @param {BossConfig} boss - Boss 配置对象，包含 name 和 remainingCount
 * @param {boolean} goToBoss - 当前是否需要重新前往（false 时才需要重定位）
 * @async
 */
async function repositionAfterFight(boss, goToBoss) {
    // 如果当前需要重新寻路，或者剩余次数为等于0，直接返回
    if (goToBoss || boss.remainingCount <= 0) {
        return;
    }

    if (BOSS_TALK_TO_START.includes(boss.name)) {
        //战斗后重新对话交互开启战斗
        await pathingScript.runFile(`assets/Pathing/${boss.name}战斗后快速前往.json`);

    } else if (BOSS_NO_PATHING_SUPPORT.includes(boss.name)) {
        //分层地图未适配区域的BOSS,重新寻路来靠近BOSS位置
        await pathingScript.runFile(`assets/Pathing/${boss.name}强制传送.json`);
        await keyMouseScript.runFile(`assets/Pathing/${boss.name}键鼠前往.json`);

    } else {
        log.info("重新靠近BOSS位置并等待4s");
        // 读取boss前往路径文件，获取最后一个位置点
        const pathingData = JSON.parse(file.readTextSync(`assets/Pathing/${boss.name}前往.json`));
        const lastPosition = pathingData.positions[pathingData.positions.length - 1];
        const pathingJson = JSON.stringify({ positions: [lastPosition] });
        await pathingScript.run(pathingJson);
        await sleep(4000);
    }

}

/**
 * 判断 Boss 是否需要战斗后重新对话交互
 * @param {string} bossName - Boss 名称
 * @returns {boolean}
 */
function isTalkToStartBoss(bossName) {
    return BOSS_TALK_TO_START.includes(bossName);
}

/**
 * 判断 Boss 是否未支持地图自动寻路
 * @param {string} bossName - Boss 名称
 * @returns {boolean}
 */
function isNoPathingSupportBoss(bossName) {
    return BOSS_NO_PATHING_SUPPORT.includes(bossName);
}

export {
    BOSS_TALK_TO_START,
    BOSS_NO_PATHING_SUPPORT,
    navigateToBoss,
    repositionAfterFight,
    isTalkToStartBoss,
    isNoPathingSupportBoss
};
