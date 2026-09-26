/**
 * 脚本入口：BetterGI 启动时就执行这个文件。
 * 真正的流程编排在 src/modules/task.js 的 runTask()，这里只负责把它跑起来，
 * 好让 main.js 保持"一眼看完"，改流程不用动它。
 */
import { runTask } from "./src/modules/task.js";

(async function () {
    await runTask();
})();
