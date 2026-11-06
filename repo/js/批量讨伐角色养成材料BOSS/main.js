import { openBossEditor } from "./src/editor.js";
import { loadConfig } from "./src/config.js";
import { runFarm } from "./src/farm-manager.js";
(async function () {
    try {
        //打开配置编辑器
        await openBossEditor();
        
        // 读取配置
        const config = loadConfig();

        // 执行 Boss 讨伐
        await runFarm(config);

    } catch (error) {
        log.error(`💥脚本执行出错: ${error}`);
    }
})();
