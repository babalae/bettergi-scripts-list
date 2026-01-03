(async function () {
    setGameMetrics(1920, 1080, 1);
    
    // 读取用户设置
    const enableDampDetection = settings.enableDampDetection === true; // 默认启用
    const maxWaitAttempts = parseInt(settings.maxWaitAttempts) || 5; // 转换数字输入
    const enableHighRiskRoutes = settings.enableHighRiskRoutes === true; // 默认启用高危路线
    const partyName = settings.partyName || ""; // 队伍名称
    
    // 检测当前队伍角色
    function checkRequiredCharacters() {
        const avatars = getAvatars();
        let hasLayla = false;
        let hasKazuha = false;

        if (avatars && avatars.length > 1) {
            for (let i = 0; i < avatars.length; i++) {
                if (avatars[i] === "菈乌玛") hasLayla = true;
                if (avatars[i] === "枫原万叶") hasKazuha = true;
            }

            if (!hasLayla || !hasKazuha) {
                log.error(`队伍角色检查失败 - 菈乌玛:${hasLayla ? '✓' : '✗'} 枫原万叶:${hasKazuha ? '✓' : '✗'}`);
                return false;
            }
            return true;
        }
        return false;
    }
    
    // 高危路线数组（目前只有07路线）
    const highRiskRoutes = ["07"];
    
    log.info(`兽肉路线脚本启动 - 潮湿检测:${enableDampDetection ? '启用' : '禁用'} 高危路线:${enableHighRiskRoutes ? '启用' : '禁用'} 队伍:${partyName || '未设置'}`);
    
    // 切换队伍函数
    async function switchPartyIfNeeded(partyName) {
        if (!partyName) {
            await genshin.returnMainUi();
            return;
        }
        try {
            partyName = partyName.trim();
            log.info("切换队伍: " + partyName);
            if (!await genshin.switchParty(partyName)) {
                log.info("切换失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                await genshin.switchParty(partyName);
            }
        } catch {
            log.error("队伍切换失败");
            notification.error(`队伍切换失败`);
            await genshin.returnMainUi();
        }
    }
    
    // 读取文件夹中的所有文件
    async function readFolder(folderPath, onlyJson) {
        const folderStack = [folderPath];
        const files = [];

        while (folderStack.length > 0) {
            const currentPath = folderStack.pop();

            // 读取当前路径下的所有文件和子文件夹路径
            const filesInSubFolder = file.ReadPathSync(currentPath);

            // 临时数组，用于存储子文件夹路径
            const subFolders = [];
            for (const filePath of filesInSubFolder) {
                if (file.IsFolder(filePath)) {
                    // 如果是文件夹，先存储到临时数组中
                    subFolders.push(filePath);
                } else {
                    if (filePath.endsWith(".js")) {
                        //跳过js结尾的文件
                        continue;
                    }
                    // 如果是文件，根据 onlyJson 判断是否存储
                    if (onlyJson) {
                        if (filePath.endsWith(".json")) {
                            const fileName = filePath.split('\\').pop(); // 提取文件名
                            const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                            files.push({
                                fullPath: filePath,
                                fileName: fileName,
                                folderPathArray: folderPathArray
                            });
                        }
                    } else {
                        const fileName = filePath.split('\\').pop(); // 提取文件名
                        const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                        files.push({
                            fullPath: filePath,
                            fileName: fileName,
                            folderPathArray: folderPathArray
                        });
                    }
                }
            }

            // 将子文件夹路径添加到堆栈中
            for (let i = subFolders.length - 1; i >= 0; i--) {
                folderStack.push(subFolders[i]);
            }
        }

        return files;
    }

    // 动态获取兽肉路线文件
    async function getMeatRoutes() {
        try {
            // 使用与锄地一条龙相同的方式读取路径文件
            const pathsDir = "paths";
            const allRoutes = [];
            const routeOptions = [];
            
            // 读取路径文件夹中的所有文件
            const pathings = await readFolder(pathsDir, true);
            
            for (const pathing of pathings) {
                const fullPath = pathing.fullPath;
                const fileName = pathing.fileName;
                
                allRoutes.push(fullPath);
                
                // 提取路线ID和名称用于选项
                const routeId = fileName.match(/^(\d+)/)?.[1];
                if (routeId) {
                    const routeName = fileName.replace('.json', '');
                    routeOptions.push({
                        value: routeId,
                        label: routeName
                    });
                }
            }
            
            return allRoutes;
        } catch (err) {
            log.error("获取路线文件时出错:", err);
            return [];
        }
    }
    
    // 根据设置选择要运行的路线
    const allRoutes = await getMeatRoutes();
    let meatRoutes = allRoutes.filter(route => {
        // 从路径中提取路线ID（假设文件名以数字开头）
        const fileName = route.split('\\').pop(); // 使用反斜杠分割，因为Windows路径
        const routeId = fileName.match(/^(\d+)/)?.[1];
        
        if (!routeId) return false;
        
        // 如果是高危路线，需要检查是否启用高危路线
        if (highRiskRoutes.includes(routeId)) {
            return enableHighRiskRoutes;
        }
        
        // 非高危路线默认运行
        return true;
    });
    
    // 检查是否找到路线文件
    if (meatRoutes.length === 0) {
        log.error("未找到任何路线文件！请确保paths目录下存在路线文件。");
        return;
    }
    
    log.info(`将运行 ${meatRoutes.length} 条路线`);
    
    // 检测潮湿状态
    async function checkDampStatus() {
        try {
            // 读取模板图像
            const templateImage = file.ReadImageMatSync("assets/damp.png");
            if (!templateImage) {
                log.warn("无法读取潮湿状态模板图像");
                return false;
            }
            
            // 创建模板匹配对象
            const dampRo = RecognitionObject.TemplateMatch(templateImage, 700, 880, 260, 200);
            dampRo.threshold = 0.8;
            dampRo.InitTemplate();

            const gameRegion = captureGameRegion();
            // 执行模板匹配
            const result = gameRegion.find(dampRo);
            gameRegion.dispose();
            
            return result.isExist();
        } catch (err) {
            log.error("检测潮湿状态时出错:", err.message || err);
            return false;
        }
    }
    
    // 循环检测并调整潮湿状态
    async function handleDampStatus() {
        let attempts = 0;
        while (attempts < maxWaitAttempts) {
            if (await checkDampStatus()) {
                log.info(`检测到潮湿状态，第${attempts + 1}次调整时间`);
                await genshin.setTime(6, 0);
                await sleep(3000); // 等待调时间生效
            } else {
                log.info("潮湿状态已解除");
                return true;
            }
            attempts++;
        }
        log.warn("潮湿状态调整超时");
        return false;
    }
    
    // 传送到路线第一个点位
    async function teleportToFirstPoint(routePath) {
        try {
            // 读取路线文件获取第一个点位坐标
            const routeContent = file.readTextSync(routePath);
            const routeData = JSON.parse(routeContent);
            if (!routeData || !routeData.positions || routeData.positions.length === 0) {
                log.error(`路线文件格式错误: ${routePath}`);
                return false;
            }
            
            const firstPoint = routeData.positions[0];
            if (typeof firstPoint.x !== "number" || typeof firstPoint.y !== "number"
                || Number.isNaN(firstPoint.x) || Number.isNaN(firstPoint.y)) {
                log.error(`坐标无效: ${routePath}`);
                return false;
            }
            
            // 使用传送功能传送到第一个点位
            await genshin.tp(firstPoint.x, firstPoint.y);
            await sleep(2000); // 等待传送完成
            
            return true;
        } catch (err) {
            log.error(`传送失败 ${routePath}:`, err);
            return false;
        }
    }
    
    // 运行单条兽肉路线
    async function runMeatRoute(routePath) {
        try {
            // 运行路径追踪脚本
            await pathingScript.runFile(routePath);
        } catch (err) {
            log.error(`路线运行失败 ${routePath}:`, err);
        }
    }
    
    // 主执行逻辑
    // 设置游戏分辨率和DPI缩放
    setGameMetrics(1920, 1080, 1);

    // 切换队伍
    await switchPartyIfNeeded(partyName);

    // 检查队伍角色
    if (!checkRequiredCharacters()) {
        log.error("队伍角色检查失败，脚本终止");
        return;
    }

    // 开启自动拾取
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    
    for (let i = 0; i < meatRoutes.length; i++) {
        const route = meatRoutes[i];
        log.info(`路线 ${i + 1}/${meatRoutes.length}: ${route.split('\\').pop()}`);

        // 先传送到路线的第一个点位
        const teleportSuccess = await teleportToFirstPoint(route);
        if (!teleportSuccess) {
            log.error(`传送失败，跳过路线`);
            continue;
        }

         // 检测潮湿状态
         if (enableDampDetection) {
             await sleep(2000);
             if (await checkDampStatus()) {
                 await handleDampStatus();
             }
         }

        // 运行路线
        await runMeatRoute(route);

        // 路线间等待
        if (i < meatRoutes.length - 1) {
            await sleep(2000);
        }
     }
    
    log.info("所有路线运行完成");
})();
