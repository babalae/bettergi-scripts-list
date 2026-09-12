/**
 * 流程文件加载器门面
 * core 与 processors 都通过此入口引用，保持单向依赖
 */
export { loadNpcProcessFile } from "./npc-process-loader.js";
export { loadBasicProcess } from "./basic-process-loader.js";
export { validateAllProcesses } from "./validate-processes.js";
export {
    createBranchConfigView,
    getBranchCompletedByUid,
    getBranchConfigUids,
    loadAllBranchConfigs,
    mergeBranchConfigView,
    sanitizeBranchConfig,
    writeBranchConfig,
    writeAllBranchConfigs,
} from "./branch-config.js";
