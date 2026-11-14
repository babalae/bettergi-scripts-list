import { stepRegistry } from "./src/processors/registry.js";
import { registerAllProcessors } from "./src/processors/index.js";
import { registerAllProbes } from "./src/probes/index.js";
import { executeMainProcess } from "./src/core/main-process.js";
import { checkVersion } from "./src/version/check-version.js";
import { runTestCommission } from "./src/core/test-runner.js";
import { getSetting } from "./src/utils/settings-utils.js";
import { openCommissionConfigEditor } from "./src/core/commission-config-editor.js";
import { openDeveloperTestEditor } from "./src/core/developer-test-editor.js";
import { openProcessEditor } from "./src/core/process-editor.js";
import { openPathRecorder } from "./src/core/path-recorder.js";
import { releaseAllTemplates } from "./src/vision/index.js";
import { scanCommissionScopes } from "./src/loaders/process-scope.js";
import { initializeCurrentAccount } from "./src/utils/account-utils.js";

registerAllProcessors(stepRegistry);
registerAllProbes();

(async function () {
    try {
        setGameMetrics(1920, 1080, genshin.ScreenDpiScale);
        //检查版本
        await checkVersion();
        // 获取界面设置
        const setting = getSetting();

        if (setting.runMode === "编辑委托流程") {
            await openProcessEditor(stepRegistry);
            log.info("委托流程编辑器已关闭");
            return;
        }

        if (setting.runMode === "录制地图路径") {
            await openPathRecorder();
            log.info("地图路径录制器已关闭");
            return;
        }

        //根据设置决定是否打开分支配置面板,阻塞至用户关闭
        let developerTestConfig = null;
        if (setting.showConfigEditor) {
            // 配置页允许在当前 UID 尚未登记时先打开已有档案并新增账号。
            await initializeCurrentAccount({ required: false });
            const editorResult = await openCommissionConfigEditor();
            if (editorResult?.action === "developer-test") {
                developerTestConfig = await openDeveloperTestEditor();
            }
        }

        if (developerTestConfig) {
            await runTestCommission(developerTestConfig);
        } else {
            // 正式执行前必须固定有效 UID，后续同步加载始终读取同一账号文件。
            await initializeCurrentAccount();
            // 执行主流程
            // 本次自动委托执行复用的流程目录快照。
            const commissionScopes = scanCommissionScopes().list;
            await executeMainProcess(stepRegistry, commissionScopes);
        }

        log.info("自动委托执行完毕");
    } catch (error) {
        log.error("自动委托执行过程中发生错误: {error}", error.message);
        throw error;
    } finally {
        // 释放所有懒加载的 RO 模板 mat（脚本退出统一回收）
        releaseAllTemplates();
    }
})();
