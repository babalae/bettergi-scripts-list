/**
 * 运行状态面板模块
 * @description 通过 HTML 遮罩显示当前 Boss 讨伐状态信息的悬浮窗
 */

let statusWindowId = null;

/**
 * 打开状态面板悬浮窗
 * @description 创建全透明背景的 HTML 遮罩窗口，内部包含半透明黑色信息面板
 * @returns {string|null} 窗口 ID，未开启显示时返回 null
 */
function openStatusPanel() {
    if (settings.showStatusPanel === false) {
        return null;
    }
    if (htmlMask.exists("status-panel")) {
        return;
    }
    statusWindowId = htmlMask.show("assets/html/状态面板.html", "status-panel");
    htmlMask.setClickThrough(statusWindowId, true);
    return statusWindowId;
}

/**
 * 更新状态面板显示内容
 * @description 从 boss 对象中动态读取所有状态信息（刷取模式、名称、进度、队伍、策略、是否回神像），
 * 进度根据外部传入的实际可讨伐总次数显示
 * @param {Object} boss - 当前 Boss 配置对象
 * @param {string} boss.name - Boss 名称
 * @param {string} boss.team - 队伍名称
 * @param {string} boss.farmMode - 刷取模式
 * @param {Object} boss.fightParam - 战斗参数对象
 * @param {string} boss.fightParam.strategyName - 战斗策略名称
 * @param {boolean} boss.returnToStatueAfterEachRound - 是否每轮后返回七天神像
 * @param {number} currentRound - 当前第几轮
 * @param {number} totalCount - 当前实际可讨伐总次数（由 getRemainingCount 计算得出）
 */
function updateStatusPanel(boss, currentRound, totalCount) {
    if (!statusWindowId || !htmlMask.exists(statusWindowId)) {
        return;
    }

    const data = {
        farmMode: boss.farmMode,
        bossName: boss.name,
        progress: `${currentRound} / ${totalCount}`,
        team: boss.team,
        strategy: boss.fightParam.strategyName,
        returnStatue: boss.returnToStatueAfterEachRound ? '是' : '否'
    };
    htmlMask.send(statusWindowId, '/updateStatus', JSON.stringify(data));
}

/**
 * 关闭状态面板
 */
function closeStatusPanel() {
    if (statusWindowId && htmlMask.exists(statusWindowId)) {
        htmlMask.close(statusWindowId);
        statusWindowId = null;
    }
}

export { openStatusPanel, updateStatusPanel, closeStatusPanel };
