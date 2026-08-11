/**
 * 步骤处理器汇总注册入口
 * 每个处理器文件 default export 单个 {type, handler} 或数组 [{type, handler}, ...]
 * 新增处理器：实现文件后在此处 import + 加入 processors 数组即可
 */
import wait from "./wait.js";
import waitMainUi from "./wait-main-ui.js";
import keyPress from "./key-press.js";
import keyMouseScript from "./key-mouse-script.js";
import mapTracking from "./map-tracking.js";
import autoSkip from "./auto-skip.js";
import autoFight from "./auto-fight.js";
import autoTask from "./auto-task.js";
import switchCommissionParty from "./switch-commission-party.js";
import switchRole from "./switch-role.js";
import commissionTracking from "./commission-tracking.js";
import userBranchSelect from "./user-branch-select.js";
import executeSubprocess from "./execute-subprocess.js";
import achievementDetect from "./achievement-detect.js";
import useItem from "./use-item.js";
import basicDestroyWatchtower from "./basic-destroy-watchtower.js";
import destroySlimeBalloon from "./destroy-slime-balloon.js";
import startChallenge from "./start-challenge.js";
import musicFlow from "./music-flow.js";
import impregnableDefense from "./impregnable-defense.js";
import interactAround from "./interact-around.js";

const processors = [
    wait,
    waitMainUi,
    keyPress,
    keyMouseScript,
    mapTracking,
    autoSkip,
    autoFight,
    autoTask,
    switchCommissionParty,
    switchRole,
    commissionTracking,
    userBranchSelect,
    executeSubprocess,
    achievementDetect,
    useItem,
    basicDestroyWatchtower,
    destroySlimeBalloon,
    startChallenge,
    musicFlow,
    impregnableDefense,
    interactAround,
];

/**
 * 注册所有步骤处理器
 * @param {Object} registry - StepProcessorRegistry 实例
 */
export function registerAllProcessors(registry) {
    for (const proc of processors) {
        const items = Array.isArray(proc) ? proc : [proc];
        for (const { type, handler, validateData, category, dataSpec } of items) {
            registry.register(type, handler, validateData, category, dataSpec);
        }
    }
}
