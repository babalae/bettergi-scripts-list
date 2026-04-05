// 主入口文件 - 角色养成一条龙Pro版
// 使用模块化架构，通过eval加载lib目录下的模块

log.info("开始加载模块...");

eval(file.readTextSync("lib/checkVersion.js"));

eval(file.readTextSync("lib/constants.js"));
eval(file.readTextSync("lib/utils.js"));
eval(file.readTextSync("lib/taskManager.js"));
eval(file.readTextSync("lib/ocrHelper.js"));
eval(file.readTextSync("lib/navigation.js"));
eval(file.readTextSync("lib/combat.js"));
eval(file.readTextSync("lib/inventory.js"));
eval(file.readTextSync("lib/farming.js"));
eval(file.readTextSync("lib/collection.js"));
eval(file.readTextSync("lib/character.js"));
eval(file.readTextSync("lib/ui_navigator.js"));
eval(file.readTextSync("lib/calculator.js"));
eval(file.readTextSync("lib/image_recognition.js"));
eval(file.readTextSync("lib/file_utils.js"));

log.info("所有模块加载完成");

// 模块加载验证
function checkModulesLoaded() {
    const requiredModules = ['Constants', 'Utils', 'TaskManager', 'OcrHelper', 'Navigation', 'Combat', 'Inventory', 'Farming', 'Collection', 'Character', 'ImageRecognition', 'FileUtils', 'expCalculator', 'moraCalculation', 'resinCalculation'];
    const missingModules = [];
    
    for (const moduleName of requiredModules) {
        try {
            const moduleType = eval("typeof " + moduleName);
            if (moduleType === 'undefined') {
                missingModules.push(moduleName);
            }
        } catch (error) {
            missingModules.push(moduleName);
        }
    }
    
    if (missingModules.length > 0) {
        log.error("以下模块加载失败: " + missingModules.join(", "));
        return false;
    }
    return true;
}

// 主逻辑
const Main = async () => {
    try {
        await printVersion();

        if (!checkModulesLoaded()) {
            log.error("模块加载失败，脚本终止");
            return;
        }
        
        log.info("✅ 所有模块验证通过");
        
        // 检查霸王条款
        if (!settings.unfairContractTerms) {
           log.warn("{0}", Constants.ERROR_NO_README_MD);
            await sleep(10000)
            throw new Error('未签署霸王条款，无法使用');
            
        }
        
        // 加载已完成任务记录
        const completedTasks = TaskManager.loadCompletedTasks();
        log.info(`已加载 ${Object.keys(completedTasks).length} 个已完成任务记录`);
        
        // 封装从config.json读取配置的通用函数
        function getConfigValue(key) {
            try {
                const configContent = file.readTextSync(Constants.CONFIG_PATH);
                const configData = JSON.parse(configContent);
                for (const item of configData) {
                    if (item.hasOwnProperty(key)) {
                        return item[key];
                    }
                }
                throw new Error(`未在config.json中找到${key}配置`);
            } catch (fileError) {
                throw new Error(`读取/解析config.json失败: ${fileError.message}`);
            }
        }
        
        // ========== 第一步：执行角色识别与材料计算流程 ==========
        log.info("📌 开始执行角色识别与材料计算流程...");
        await Character.findCharacterAndGetLevel();
        
        // ============== 材料刷取逻辑开始 ==============
        
        // 识别UID（用于区分不同账号的任务记录）并保存到配置
        const currentUid = await Collection.getCurrentAccountUid();
        const maskedUid = Utils.maskUid(currentUid);
        log.info(`📌 当前运行账号UID：${maskedUid}`);
        
        // 保存UID到配置文件（保持数组格式）
        try {
            const configContent = file.readTextSync(Constants.CONFIG_PATH);
            let configArray = JSON.parse(configContent);
            if (!Array.isArray(configArray)) {
                configArray = [];
            }
            const uidIndex = configArray.findIndex(item => item.hasOwnProperty("currentUid"));
            if (uidIndex !== -1) {
                configArray[uidIndex] = { "currentUid": currentUid };
            } else {
                configArray.push({ "currentUid": currentUid });
            }
            file.writeTextSync(Constants.CONFIG_PATH, JSON.stringify(configArray, null, 2));
            log.info(`✅ UID已保存到配置文件`);
        } catch (e) {
            log.warn(`保存UID到配置文件失败: ${e.message}`);
        }
        
        setGameMetrics(1920, 1080, 1);
        
        // 天赋书刷取逻辑
        for (let i = 0; i < 1; i++) {
            const talentBookCandidates = [
                "自由",
                "抗争",
                "诗文",
                "繁荣",
                "勤劳",
                "黄金",
                "浮世",
                "风雅",
                "天光",
                "净言",
                "巧思",
                "笃行",
                "公平",
                "正义",
                "秩序",
                "角逐",
                "焚燔",
                "纷争",
                "月光",
                "乐园",
                "浪迹"
            ];
            const talentBookNameFromConfig = getConfigValue("talentDomainName");
            if (!talentBookNameFromConfig || talentBookNameFromConfig.trim() === "") {
                log.info(`天赋书配置为空，跳过执行`);
                continue;
            }
            const talentBookName = Utils.fuzzyMatch(talentBookNameFromConfig, talentBookCandidates);
            const currentCharacterName = settings.Character ? settings.Character.trim() : "未知角色";
            if (talentBookName && talentBookName !== "无") {
                try {
                    const talentBookConfigKey = `talentBookRequireCounts${i}`;
                    const talentBookCountsStr = getConfigValue(talentBookConfigKey);
                    let bookRequireCounts = Utils.parseAndValidateCounts(talentBookCountsStr, 3);
                    log.info(`天赋书${i + 1}方案解析成功: ${bookRequireCounts.join(', ')}`);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("talent", talentBookName, bookRequireCounts, currentCharacterName, currentUid);
                    if (isCompleted) {
                        log.info(`天赋书${talentBookName} 已刷取至目标数量，跳过执行`);
                        Utils.addNotification(`天赋书${talentBookName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getTalentBook(talentBookName, bookRequireCounts, currentCharacterName, currentUid);
                    }
                } catch (error) {
                    notification.send(`天赋书${talentBookName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                if (!talentBookName) {
                    log.warn(`天赋书"${talentBookNameFromConfig}"模糊匹配失败，未找到匹配项，跳过执行`);
                } else {
                    log.info(`没有选择刷取天赋书${i + 1}，跳过执行`);
                }
            }
        }
        
        // 武器材料刷取逻辑
        for (let i = 0; i < 1; i++) {
            const weaponDomainCandidates = [
                "高塔孤王",
                "凛风奔狼",
                "狮牙斗士",
                "孤云寒林",
                "雾海云间",
                "漆黑陨铁",
                "远海夷地",
                "鸣神御灵",
                "今昔剧话",
                "谧林涓露",
                "绿洲花园",
                "烈日威权",
                "幽谷弦音",
                "纯圣露滴",
                "无垢之海",
                "贡祭炽心",
                "谵妄圣主",
                "神合秘烟",
                "奇巧秘器",
                "长夜燧火",
                "终北遗嗣"
            ];
            const weaponDomainNameFromConfig = getConfigValue("weaponDomainName");
            if (!weaponDomainNameFromConfig || weaponDomainNameFromConfig.trim() === "") {
                log.info(`武器材料配置为空，跳过执行`);
                continue;
            }
            const weaponName = Utils.fuzzyMatch(weaponDomainNameFromConfig, weaponDomainCandidates);
            const currentCharacterName = settings.Character ? settings.Character.trim() : "未知角色";
            if (weaponName && weaponName !== "无") {
                try {
                    const weaponConfigKey = `weaponMaterialRequireCounts${i}`;
                    const weaponCountsStr = getConfigValue(weaponConfigKey);
                    let weaponRequireCounts = Utils.parseAndValidateCounts(weaponCountsStr, 4);
                    log.info(`武器材料${i + 1}方案解析成功: ${weaponRequireCounts.join(', ')}`);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("wepon", weaponName, weaponRequireCounts, currentCharacterName, currentUid);
                    if (isCompleted) {
                        log.info(`武器材料${weaponName} 已刷取至目标数量，跳过执行`);
                        Utils.addNotification(`武器材料${weaponName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getWeaponMaterial(weaponName, weaponRequireCounts, currentCharacterName, currentUid);
                    }
                } catch (error) {
                    notification.send(`武器材料${weaponName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                if (!weaponName) {
                    log.warn(`武器材料"${weaponDomainNameFromConfig}"模糊匹配失败，未找到匹配项，跳过执行`);
                } else {
                    log.info(`没有选择刷取武器材料${i + 1}，跳过执行`);
                }
            }
        }
        
        // 首领材料刷取逻辑
        for (let i = 0; i < 1; i++) {
            const bossMaterialCandidates = [
                "蕴光月守宫",
                "爆炎树",
                "半永恒统辖矩阵",
                "掣电树",
                "纯水精灵",
                "翠翎恐蕈",
                "深罪浸礼者",
                "深邃摹结株",
                "风蚀沙虫",
                "「冰风组曲」歌裴莉娅",
                "「冰风组曲」科培琉司",
                "古岩龙蜥",
                "恒常机关阵列",
                "急冻树",
                "金焰绒翼龙暴君",
                "雷音权现",
                "灵觉隐修的迷者",
                "魔像督军",
                "秘源机兵·统御械",
                "秘源机兵·构型械",
                "魔偶剑鬼",
                "千年珍珠骏麟",
                "熔岩辉龙像",
                "贪食匿叶龙山王",
                "铁甲熔火帝皇",
                "无相之草",
                "无相之火",
                "无相之雷",
                "无相之水",
                "无相之岩",
                "水形幻人",
                "实验性场力发生装置",
                "遗迹巨蛇",
                "隐山猊兽",
                "兆载永劫龙兽",
                "重拳出击鸭",
                "蕴光月幻蝶",
                "霜夜巡天灵主",
                "超重型陆巡舰·机动战垒",
                "深黯魇语之主"
            ];
            const bossMaterialNameFromConfig = getConfigValue("bossMaterialName");
            if (!bossMaterialNameFromConfig || bossMaterialNameFromConfig.trim() === "") {
                log.info(`首领材料配置为空，跳过执行`);
                continue;
            }
            const bossName = Utils.fuzzyMatch(bossMaterialNameFromConfig, bossMaterialCandidates);
            const currentCharacterName = settings.Character ? settings.Character.trim() : "未知角色";
            if (bossName && bossName !== "无") {
                try {
                    const bossConfigKey = `bossRequireCounts${i}`;
                    const bossRequireCounts = getConfigValue(bossConfigKey);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("boss", bossName, bossRequireCounts, currentCharacterName, currentUid);
                    if (isCompleted) {
                        log.info(`首领材料${bossName} 已刷取至目标数量，跳过执行`);
                        Utils.addNotification(`首领材料${bossName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getBossMaterial(bossName, bossRequireCounts, currentCharacterName, currentUid);
                    }
                } catch (error) {
                    notification.send(`首领材料${bossName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                if (!bossName) {
                    log.warn(`首领材料"${bossMaterialNameFromConfig}"模糊匹配失败，未找到匹配项，跳过执行`);
                } else {
                    log.info(`没有选择挑战首领${i + 1}，跳过执行`);
                }
            }
        }
        
        Utils.sendBufferedNotifications();
        log.info("✅ 所有材料刷取逻辑执行完成");
        
        // 返回游戏主界面
        log.info("📌 正在校准并返回游戏主界面...");
        await genshin.returnMainUi();
        await sleep(1500);
        
        // ============== 执行材料采集流程 ==========
        log.info("📌 开始执行材料采集流程...");
        await runMaterialCollection();
        // 返回游戏主界面
        log.info("📌 正在校准并返回游戏主界面...");
        await genshin.returnMainUi();
        await sleep(1500);
        // ============== 最后一步：地脉花管理流程 ==========
        log.info("📌 开始执行地脉花管理流程...");
        await runLeyLineManagement();
         // 返回游戏主界面
        log.info("📌 正在校准并返回游戏主界面...");
        await genshin.returnMainUi();
        await sleep(1500);
        
    } catch (globalError) {
        log.error(`❌ 整体流程执行失败: ${globalError.message}`);
        notification.send(`整体流程执行失败: ${globalError.message}`);
    }
};

// 材料采集主函数
async function runMaterialCollection() {
    log.info("===== BGI路径追踪脚本开始执行 =====");
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    log.info("📌 正在返回游戏主界面并校准...");
    await genshin.returnMainUi();
    setGameMetrics(1920, 1080, 1.25);
    
    // 读取配置
    const config = Utils.readJson(Constants.CONFIG_PATH);
    const cooldownRecord = Utils.readJson(Constants.SCRIPT_COOLDOWN_RECORD, {});
    const isNoGrassGod = settings.isNoGrassGod || false;
    log.info(`📌 草神路线配置：${isNoGrassGod ? "排除有草神路线" : "默认选择有草神路线"}`);
    
    // 从配置读取UID（已在材料刷取流程中识别并保存）
    const currentUid = config["currentUid"] || Constants.DEFAULT_UID;
    const maskedUid = Utils.maskUid(currentUid);
    log.info(`📌 当前运行账号UID：${maskedUid}`);
    
    // 清理所有材料类型的过期冷却记录
    log.info("📌 正在清理过期冷却记录...");
    Collection.cleanExpiredCooldownRecords(cooldownRecord, currentUid);
    
    // 提取配置参数
    const localKeyword = config["LocalSpecialties"] || "";
    const allMagicKeywords = Collection.extractAllMagicKeywords(config);
    const allWeapons1Keywords = Collection.extractAllWeapons1Keywords(config);
    const allWeapons2Keywords = Collection.extractAllWeapons2Keywords(config);
    
    log.info(`读取到配置：`);
    log.info(`- 地方特产：关键词[${localKeyword}]`);
    log.info(`- 敌人与魔物：${allMagicKeywords.length}个关键词`);
    log.info(`- 武器1材料：${allWeapons1Keywords.length}个关键词`);
    log.info(`- 武器2材料：${allWeapons2Keywords.length}个关键词`);
    
    // 检查是否有需要执行的材料采集
    let hasAnyMaterialToCollect = false;
    let hasLocalToCollect = false;
    let hasMagicToCollect = false;
    let hasWeapons1ToCollect = false;
    let hasWeapons2ToCollect = false;
    
    // 队伍切换开关
    let hasSwitchedToLocalTeam = false;
    let hasSwitchedToCombatTeam = false;
    
    // 检查地方特产
    if (localKeyword && Number(config["needLocalAmount"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasLocalToCollect = true;
    }
    
    // 检查敌人与魔物
    if (allMagicKeywords.length > 0 && Number(config["needMonsterStar3"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasMagicToCollect = true;
    }
    
    // 检查武器1材料
    if (allWeapons1Keywords.length > 0 && Number(config["needamount1 stars3"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasWeapons1ToCollect = true;
    }
    
    // 检查武器2材料
    if (allWeapons2Keywords.length > 0 && Number(config["needamount2 stars3"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasWeapons2ToCollect = true;
    }
    
    // 只有在有需要执行的材料采集时，才前往指定地点并切换队伍
    if (hasAnyMaterialToCollect) {
        log.info("📌 正在前往指定地点...");
        await genshin.tp(2297.6201171875, -824.5869140625);
    } else {
        log.info("⚠️ 没有需要执行的材料采集，跳过前往指定地点和切换队伍");
    }
    
    try {
        // 1. 地方特产
        if (localKeyword) {
            if (hasLocalToCollect && !hasSwitchedToLocalTeam) {
                log.info("📌 切换到采集队伍...");
                await Utils.switchPartySafe(settings.teamName2);
                hasSwitchedToLocalTeam = true;
            }
            await executeMaterialCollection({
                type: 'local',
                rootFolder: Constants.FOLDER_LOCAL,
                keywords: localKeyword,
                configKey: 'needLocalAmount',
                isExcludeGrassGod: isNoGrassGod,
                materialType: '地方特产',
                currentUid,
                cooldownRecord
            });
            Utils.sendBufferedNotifications();
            await sleep(1000);
        }
        
        // 2. 敌人与魔物
        if (allMagicKeywords.length > 0) {
            if (hasMagicToCollect && !hasSwitchedToCombatTeam) {
                log.info("📌 切换到战斗队伍...");
                await Utils.switchPartySafe(settings.teamName);
                hasSwitchedToCombatTeam = true;
            }
            await executeMaterialCollection({
                type: 'magic',
                rootFolder: Constants.FOLDER_MAGIC,
                keywords: allMagicKeywords,
                configKey: 'needMonsterStar3',
                materialType: '敌人与魔物',
                currentUid,
                cooldownRecord
            });
            await sleep(1000);
        }
        
        // 3. 武器1材料
        if (allWeapons1Keywords.length > 0) {
            if (hasWeapons1ToCollect && !hasSwitchedToCombatTeam) {
                log.info("📌 切换到战斗队伍...");
                await Utils.switchPartySafe(settings.teamName);
                hasSwitchedToCombatTeam = true;
            }
            await executeMaterialCollection({
                type: 'weapons1',
                rootFolder: Constants.FOLDER_WEAPONS1,
                keywords: allWeapons1Keywords,
                configKey: 'needamount1 stars3',
                materialType: '武器1材料',
                currentUid,
                cooldownRecord
            });
            await sleep(1000);
        }
        
        // 4. 武器2材料
        if (allWeapons2Keywords.length > 0) {
            if (hasWeapons2ToCollect && !hasSwitchedToCombatTeam) {
                log.info("📌 切换到战斗队伍...");
                await Utils.switchPartySafe(settings.teamName);
                hasSwitchedToCombatTeam = true;
            }
            await executeMaterialCollection({
                type: 'weapons2',
                rootFolder: Constants.FOLDER_WEAPONS2,
                keywords: allWeapons2Keywords,
                configKey: 'needamount2 stars3',
                materialType: '武器2材料',
                currentUid,
                cooldownRecord
            });
            Utils.sendBufferedNotifications();
        }
        
    } catch (globalErr) {
        if (globalErr.message.includes("A task was canceled") || globalErr.message.includes("取消自动任务")) {
            log.error(`[脚本终止] 检测到手动取消任务，脚本正常终止`);
        } else {
            log.error(`[脚本异常] 全局执行错误：${globalErr.message}`);
        }
    }
    
    log.info("===== BGI路径追踪脚本执行结束 =====");
}

// 统一的材料采集流程控制器
async function executeMaterialCollection(options) {
    const {
        type,
        rootFolder,
        keywords,
        configKey,
        isExcludeGrassGod = false,
        materialType,
        currentUid,
        cooldownRecord
    } = options;
    
    log.info(`\n========== 开始处理${materialType} ==========`);
    
    // 读取当前需求量
    const config = Utils.readJson(Constants.CONFIG_PATH);
    const currentAmount = Number(config[configKey]) || 0;
    
    if (currentAmount <= 0 && type !== 'local') {
        log.info(`[${materialType}] 需求数量为0，跳过执行`);
        Utils.addNotification(`[${materialType}] 需求数量为0，跳过执行`);
        return false;
    }
    
    if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
        log.info(`[${materialType}] 未配置关键词，跳过执行`);
        Utils.addNotification(`[${materialType}] 未配置关键词，跳过执行`);
        return false;
    }
    
    // 获取冷却时间
    let cooldown;
    switch (type) {
        case "local": cooldown = Constants.COOLDOWN_LOCAL; break;
        case "magic": cooldown = Constants.COOLDOWN_MAGIC; break;
        case "weapons1": cooldown = Constants.COOLDOWN_WEAPONS1; break;
        case "weapons2": cooldown = Constants.COOLDOWN_WEAPONS2; break;
        default: cooldown = 0;
    }
    
    // 扫描脚本文件
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];
    let allScriptFiles = [];
    
    for (const keyword of keywordList) {
        let targetDirs = [];
        const basePath = "pathing";
        
        if (rootFolder === Constants.FOLDER_LOCAL) {
            const localRootDir = `${Constants.ASSETS_BASE}/${rootFolder}`.replace(/\\/g, "/");
            const relativeLocalRoot = localRootDir.startsWith(basePath + "/") ? localRootDir.substring(basePath.length + 1) : localRootDir;
            try {
                const regionDirs = Array.from(pathingScript.ReadPathSync(relativeLocalRoot) || []);
                for (const regionDir of regionDirs) {
                    const regionRelative = regionDir.replace(/\\/g, "/").replace(/^\/+/, "");
                    if (pathingScript.IsFolder(regionRelative)) {
                        const regionName = regionRelative.split(/[\\/]/).pop();
                        const targetRelative = `${relativeLocalRoot}/${regionName}/${keyword}`.replace(/\\/g, "/");
                        if (pathingScript.IsFolder(targetRelative)) {
                            const targetDir = `${localRootDir}/${regionName}/${keyword}`.replace(/\\/g, "/");
                            targetDirs.push(targetDir);
                            log.info(`✅ 检测到有效路径：${targetDir}`);
                        }
                    }
                }
            } catch (e) {
                log.error(`读取目录失败：${e.message}`);
            }
        } else {
            const aliasList = Collection.getAllAliasesByStandardName(keyword);
            for (const alias of aliasList) {
                const aliasRelative = `${rootFolder}/${alias}`.replace(/\\/g, "/").replace(/^\/+/, "");
                if (pathingScript.IsFolder(aliasRelative)) {
                    const aliasDir = `${Constants.ASSETS_BASE}/${rootFolder}/${alias}`.replace(/\\/g, "/");
                    targetDirs.push(aliasDir);
                    log.info(`✅ 匹配到别名目录：${aliasDir}（关键词：${keyword}，匹配别名：${alias}）`);
                }
            }
        }
        
        const uniqueTargetDirs = [...new Set(targetDirs)];
        for (const targetDir of uniqueTargetDirs) {
            const dirFiles = Collection.recursiveScanScriptFiles(targetDir, isExcludeGrassGod);
            allScriptFiles = allScriptFiles.concat(dirFiles);
        }
    }
    
    if (allScriptFiles.length === 0) {
        log.warn(`⚠️ 未找到${materialType}的JSON路径脚本`);
        notification.send(`⚠️ 未找到${materialType}的JSON路径脚本`);
        log.warn("{0}", Constants.ERROR_NO_SCRIPTS);
        log.warn("{0}", Constants.ERROR_NO_PATHING);
        await sleep(15000);
        return false;
    }
    
    log.info(`✅ 共扫描到 ${allScriptFiles.length} 个路径脚本文件`);
    
    // 过滤掉异常路径
    const normalScripts = Collection.filterAbnormalPaths(allScriptFiles);
    
    // 过滤掉在冷却中的脚本
    const availableScripts = Collection.filterScriptsByCooldown(normalScripts, cooldown, cooldownRecord, currentUid);
    
    if (availableScripts.length === 0) {
        log.info(`[${materialType}] 所有脚本都在冷却中，跳过执行`);
        return false;
    }
    
    // 根据材料类型执行不同的控制逻辑
    let isCompleted = false;
    
    if (type === 'local') {
        isCompleted = await executeLocalBatch(availableScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord, type);
    } else {
        isCompleted = await executeMonsterBatch(availableScripts, configKey, materialType, currentUid, cooldown, cooldownRecord, type);
    }
    
    return isCompleted;
}

// 地方特产分批执行逻辑
async function executeLocalBatch(allScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord, type) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;
    
    const startIndex = Collection.getStartIndex(remainingScripts, currentUid, cooldownRecord, type);
    remainingScripts = remainingScripts.slice(startIndex);
    
    if (startIndex > 0) {
        log.info(`📌 [${materialType}] 断点续传，从第${startIndex + 1}个脚本开始执行`);
    }
    
    while (remainingScripts.length > 0) {
        const config = Utils.readJson(Constants.CONFIG_PATH);
        const currentNeed = Number(config["needLocalAmount"]) || 0;
        
        log.info(`\n📊 [${materialType}] 当前需求量：${currentNeed}，剩余脚本数：${remainingScripts.length}`);
        
        if (currentNeed <= 0) {
            log.info(`✅ [${materialType}] 需求已满足，停止执行`);
            Utils.addNotification(`✅ [${materialType}] 需求已满足，停止执行`);
            isCompleted = true;
            break;
        }
        
        const scriptsToExecute = Collection.filterLocalScriptsByCount(remainingScripts, currentNeed, !isExcludeGrassGod);
        
        if (scriptsToExecute.length === 0) {
            log.info(`⚠️ [${materialType}] 无需要执行的脚本`);
            Utils.addNotification(`⚠️ [${materialType}] 无需要执行的脚本`);
            break;
        }
        
        const totalCanGet = scriptsToExecute.reduce((sum, s) => sum + (s.count || Constants.DEFAULT_LOCAL_COUNT), 0);
        log.info(`🔢 [${materialType}] 本次计划执行${scriptsToExecute.length}个脚本，预计获取${totalCanGet}个特产`);
        
        const result = await Collection.executeScripts(scriptsToExecute, 0, 0, currentUid, cooldown, cooldownRecord);
        
        const executedPaths = new Set(scriptsToExecute.slice(0, result.executedCount).map(s => s.path));
        remainingScripts = remainingScripts.filter(s => !executedPaths.has(s.path));
        
        if (totalCanGet >= currentNeed) {
            log.info(`📌 [${materialType}] 本次执行路径数量(${totalCanGet}) >= 需求量(${currentNeed})，触发角色识别`);
            const recognitionType = materialType === '地方特产' ? 'break' : 'all';
            await performCharacterRecognition(materialType, recognitionType);
            
            const newConfig = Utils.readJson(Constants.CONFIG_PATH);
            const newNeed = Number(newConfig["needLocalAmount"]) || 0;
            
            if (newNeed <= 0) {
                log.info(`✅ [${materialType}] 需求已满足，停止执行`);
                Utils.addNotification(`✅ [${materialType}] 需求已满足，停止执行`);
                isCompleted = true;
                break;
            }
        } else {
            log.info(`ℹ️ [${materialType}] 本次执行路径数量(${totalCanGet}) < 需求量(${currentNeed})，不触发角色识别`);
        }
        
        if (remainingScripts.length === 0) {
            log.info(`✅ [${materialType}] 所有路径已执行完毕`);
            Utils.addNotification(`✅ [${materialType}] 所有路径已执行完毕`);
            isCompleted = true;
        }
        
        await sleep(1000);
    }
    
    return isCompleted;
}

// 敌人与魔物/武器材料分批执行逻辑（阈值控制）
async function executeMonsterBatch(allScripts, configKey, materialType, currentUid, cooldown, cooldownRecord, type) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;
    
    const startIndex = Collection.getStartIndex(remainingScripts, currentUid, cooldownRecord, type);
    remainingScripts = remainingScripts.slice(startIndex);
    
    if (startIndex > 0) {
        log.info(`📌 [${materialType}] 断点续传，从第${startIndex + 1}个脚本开始执行`);
    }
    
    while (remainingScripts.length > 0) {
        const config = Utils.readJson(Constants.CONFIG_PATH);
        let currentAmount = Number(config[configKey]) || 0;
        
        log.info(`\n📊 [${materialType}] 当前材料需求量：${currentAmount}，剩余脚本数：${remainingScripts.length}`);
        
        if (currentAmount <= 0) {
            log.info(`✅ [${materialType}] 材料需求已满足，停止执行`);
            Utils.addNotification(`✅ [${materialType}] 材料需求已满足，停止执行`);
            isCompleted = true;
            break;
        }
        
        let batchSize = 0;
        let shouldTriggerRecognition = false;
        
        if (currentAmount <= Constants.THRESHOLD_LOW) {
            batchSize = Constants.PATH_COUNT_LOW;
            shouldTriggerRecognition = true;
            log.info(`🔢 [${materialType}] 材料数量<=${Constants.THRESHOLD_LOW}，执行${Constants.PATH_COUNT_LOW}个路径`);
        } else if (currentAmount <= Constants.THRESHOLD_HIGH) {
            batchSize = Constants.PATH_COUNT_HIGH;
            shouldTriggerRecognition = true;
            log.info(`🔢 [${materialType}] 材料数量<=${Constants.THRESHOLD_HIGH}且>${Constants.THRESHOLD_LOW}，执行${Constants.PATH_COUNT_HIGH}个路径`);
        } else {
            batchSize = Constants.PATH_COUNT_HIGH;
            shouldTriggerRecognition = false;
            log.info(`🔢 [${materialType}] 材料数量>${Constants.THRESHOLD_HIGH}，执行${Constants.PATH_COUNT_HIGH}个路径（不触发角色识别）`);
        }
        
        const result = await Collection.executeScripts(remainingScripts, 0, batchSize, currentUid, cooldown, cooldownRecord);
        remainingScripts = result.remainingScripts;
        
        if (remainingScripts.length === 0) {
            log.info(`✅ [${materialType}] 所有路径已执行完毕`);
            Utils.addNotification(`✅ [${materialType}] 所有路径已执行完毕`);
            isCompleted = true;
            break;
        }
        
        if (shouldTriggerRecognition) {
            let recognitionType = 'all';
            if (type === 'magic') {
                recognitionType = 'break';
            } else if (type === 'weapons1' || type === 'weapons2') {
                recognitionType = 'weapon';
            }
            await performCharacterRecognition(materialType, recognitionType);
            const newConfig = Utils.readJson(Constants.CONFIG_PATH);
            const newAmount = Number(newConfig[configKey]) || 0;
            
            log.info(`📊 [${materialType}] 角色识别后材料需求量：${newAmount}`);
            
            if (newAmount <= 0) {
                log.info(`✅ [${materialType}] 材料需求已满足，停止执行剩余路径`);
                Utils.addNotification(`✅ [${materialType}] 材料需求已满足，停止执行剩余路径`);
                isCompleted = true;
                break;
            }
        }
        
        await sleep(1000);
    }
    
    return isCompleted;
}

// 执行角色识别
async function performCharacterRecognition(materialType, recognitionType = "all") {
    log.info(`📌 开始执行${materialType}的角色识别与材料计算流程（识别类型：${recognitionType}）...`);
    try {
        await Character.findCharacterAndGetLevel(recognitionType);
        log.info(`✅ ${materialType}角色识别与材料更新完成`);
        await sleep(2000);
    } catch (e) {
        log.error(`❌ ${materialType}角色识别失败：${e.message}`);
    }
}

// 地脉花管理流程
async function runLeyLineManagement() {
    try {
        log.info("===== 地脉花管理流程开始执行 =====");
        setGameMetrics(1920, 1080, 1)
        // 检查体力值
        const stamina = await Inventory.queryStaminaValue();
        const minStamina = 20;
        
        if (stamina < minStamina) {
            log.warn(`体力不足！当前体力：${stamina}，需要：${minStamina}`);
            log.info("体力不足，跳过地脉花流程");
            notification.send("体力不足，跳过地脉花流程");
            return;
        }
        
        log.info(`体力充足：${stamina}，开始地脉花`);
        
        // 初始化地脉花次数
        let expRuns = 0;
        let moraRuns = 0;
        
        // 读取并验证设置
        const { 
            targetRoleLevel, 
            targetBreakLevel,
            characterLevel, 
            characterBreak,
            talentLevels,
            targetTalentLevels,
            weaponStar,
            weaponLevel,
            weaponBreakLevel,
            targetWeaponLevel,
            targetWeaponBreakLevel,
            moraAmount
        } = readAndValidateSettingsForLeyLine();

        // 检查是否已经是满级
        if (targetRoleLevel >= 90 && characterLevel >= 90) {
            log.info(`角色已是满级（${characterLevel}级），无需经验书`);
            expRuns = 0;
        }

        // 获取世界等级（摩拉计算需要）
        const worldLevel = await getWorldLevelForLeyLine();

        // 只有不满级时才获取经验书数据
        let expBookData = { totalBookExperience: 0 };
        if (!(targetRoleLevel >= 90 && characterLevel >= 90)) {
            expBookData = await getExperienceBookDataForLeyLine();
        }

        // 计算升级所需经验
        const requiredExp = expCalculator.calculateExpRequired(characterLevel, 0, targetRoleLevel);
        log.info(`从${characterLevel}级升级到${targetRoleLevel}级需要${requiredExp}经验`);

        // 初始化经验书需求
        let bookRequirements = {
            purple: 0,
            blue: 0,
            green: 0,
            summary: "无需经验书"
        };

        // 如果已经是满级或不需要经验，跳过经验书相关计算
        if (requiredExp <= 0) {
            log.info(`无需经验书，跳过经验书地脉花任务`);
            expRuns = 0;
        } else {
            // 转换为经验书数量
            bookRequirements = expCalculator.convertExpToBooks(requiredExp);
            log.info(bookRequirements.summary);

            // 计算经验书地脉花次数
            const totalBookExperience = expBookData.totalBookExperience;
            log.info(`当前库存经验书总经验: ${totalBookExperience}`);
            const expShortage = Math.max(0, requiredExp - totalBookExperience);
            log.info(`经验缺口计算: ${requiredExp} - ${totalBookExperience} = ${expShortage}`);
            if (expShortage > 0) {
                const resinRequirements = resinCalculation.calculateExpBookRequirements(expShortage, worldLevel);
                expRuns = resinRequirements.runs.totalChallenges;
                log.info(`经验缺口: ${expShortage}, 经验书地脉花次数: ${expRuns}`);
            } else {
                log.info(`经验书充足，无需执行经验书地脉花任务`);
                Utils.addNotification(`经验书充足，无需执行经验书地脉花任务`);
            }
        }

        // 计算摩拉需求
        const moraConfig = {
            characterLevel: characterLevel,
            characterBreak: characterBreak,
            targetRoleLevel: targetRoleLevel,
            targetBreakLevel: targetBreakLevel,
            talentLevels: talentLevels,
            targetTalentLevels: targetTalentLevels,
            weaponStar: weaponStar,
            weaponLevel: weaponLevel,
            weaponBreakLevel: weaponBreakLevel,
            targetWeaponLevel: targetWeaponLevel,
            targetWeaponBreakLevel: targetWeaponBreakLevel,
            bookRequirements: bookRequirements,
            currentMora: moraAmount
        };
        
        const moraResult = moraCalculation.calculateTotalMoraRequirement(moraConfig);
        log.info(`摩拉计算结果: ${JSON.stringify(moraResult, null, 2)}`);

        // 计算摩拉缺口和地脉花次数
        let moraShortage = 0;
        if (moraResult.remainingMora < 0) {
            moraShortage = -moraResult.remainingMora;
            log.info(`摩拉缺口: ${moraShortage}`);
            const moraLeyLineResult = resinCalculation.calculateMoraLeyLineRuns(moraShortage, worldLevel);
            moraRuns = moraLeyLineResult.totalRuns;
            log.info(`摩拉地脉花次数: ${moraRuns}, 每次摩拉掉落: ${moraLeyLineResult.moraPerRun}`);
        }

        // 执行地脉花任务
        if (expRuns > 0 || moraRuns > 0) {
            await runAutoLeyLineOutcropTask(expRuns, moraRuns, stamina);
        } else {
            log.info("经验书和摩拉都已充足，无需执行地脉花任务");
            notification.send("经验书和摩拉都已充足，无需执行地脉花任务");
        }

        await genshin.returnMainUi();
        log.info("✅ 地脉花管理流程执行完成");

    } catch (error) {
        log.error(`地脉花管理流程执行失败: ${error.message}`);
        log.error(`错误堆栈: ${error.stack}`);
        notification.send(`地脉花管理流程执行失败: ${error.message}`);

        try {
            await genshin.returnMainUi();
        } catch (uiError) {
            log.warn(`返回主界面失败: ${uiError.message}`);
        }
    }
    
    log.info("===== 地脉花管理流程执行结束 =====");
}

// 读取并验证配置（地脉花管理专用）
function readAndValidateSettingsForLeyLine() {
    const bossRequireCounts = settings.bossRequireCounts;

    const levelMapping = {
        "20级": { level: 40, break: 40 },
        "40级": { level: 50, break: 50 },
        "50级": { level: 60, break: 60 },
        "60级": { level: 70, break: 70 },
        "70级": { level: 80, break: 80 },
        "80级": { level: 90, break: 90 }
    };

    const targetLevelInfo = levelMapping[bossRequireCounts];
    if (!targetLevelInfo) {
        throw new Error("非法输入或未输入目标角色等级，请选择有效的等级");
    }
    const targetRoleLevel = targetLevelInfo.level;
    const targetBreakLevel = targetLevelInfo.break;

    const weaponLevelMapping = {
        "20级": { level: 20, break: 20 },
        "40级": { level: 40, break: 40 },
        "50级": { level: 50, break: 50 },
        "60级": { level: 60, break: 60 },
        "70级": { level: 70, break: 70 },
        "80级": { level: 80, break: 80 }
    };
    const weaponRequireCounts = settings.weaponMaterialRequireCounts;
    const targetWeaponInfo = weaponLevelMapping[weaponRequireCounts] || { level: 80, break: 5 };
    const targetWeaponLevel = targetWeaponInfo.level;
    const targetWeaponBreakLevel = targetWeaponInfo.break;

    let characterLevel = 0;
    let characterBreak = 0;
    let talentLevels = [1, 1, 1];
    let weaponStar = "四星";
    let weaponLevel = 1;
    let weaponBreakLevel = 0;
    let moraAmount = 0;

    try {
        const configContent = file.readTextSync(Constants.CONFIG_PATH);
        const configArray = JSON.parse(configContent);

        const levelConfig = configArray.find(item => item.characterLevel !== undefined);
        if (levelConfig) {
            characterLevel = Number(levelConfig.characterLevel);
        }

        const breakConfig = configArray.find(item => item.characterBreak !== undefined);
        if (breakConfig) {
            const breakStr = breakConfig.characterBreak;
            const match = breakStr.match(/(\d+)级/);
            if (match) {
                const breakLevel = parseInt(match[1]);
                characterBreak = breakStr.includes("已突破") ? 90 : breakLevel;
            }
        }

        const talentConfig = configArray.find(item => item.talentLevels !== undefined);
        if (talentConfig) {
            const talents = talentConfig.talentLevels.split('-').map(Number);
            talentLevels = talents;
        }

        const weaponStarConfig = configArray.find(item => item.weaponStar !== undefined);
        if (weaponStarConfig) {
            weaponStar = weaponStarConfig.weaponStar;
        }

        const weaponLevelConfig = configArray.find(item => item.weaponLevel !== undefined);
        if (weaponLevelConfig) {
            const levelStr = weaponLevelConfig.weaponLevel;
            const match = levelStr.match(/(\d+)级/);
            if (match) {
                weaponLevel = parseInt(match[1]);
                weaponBreakLevel = levelStr.includes("已突破") ? 90 : weaponLevel;
            }
        }

        const moraConfig = configArray.find(item => item.moraAmount !== undefined);
        if (moraConfig) {
            moraAmount = Number(moraConfig.moraAmount);
        }
    } catch (error) {
        log.error(`读取config.json失败: ${error.message}`);
        throw new Error("读取config.json失败");
    }

    if (isNaN(characterLevel) || characterLevel <= 0 || characterLevel > 90) {
        throw new Error("config.json中的characterLevel配置无效，请输入1-90之间的有效数字");
    }

    const talentRequireCounts = settings.talentBookRequireCounts;
    const targetTalentLevels = talentRequireCounts ? talentRequireCounts.split('-').map(Number) : [10, 10, 10];
    
    return { 
        targetRoleLevel, 
        targetBreakLevel,
        characterLevel, 
        characterBreak,
        talentLevels,
        targetTalentLevels,
        weaponStar,
        weaponLevel,
        weaponBreakLevel,
        targetWeaponLevel,
        targetWeaponBreakLevel,
        moraAmount
    };
}

// 获取经验书数据（地脉花管理专用）
async function getExperienceBookDataForLeyLine() {
    try {
        const expBookInfo = await ImageRecognition.IdentifyExperienceBook();
        if (!expBookInfo) {
            return { totalBookExperience: 0 };
        }
        const bookData = FileUtils.getExpBookData(expBookInfo, true);
        if (bookData && bookData.length > 0) {
            const totalItem = bookData.find(item => item.bookName === '总计');
            return { totalBookExperience: totalItem ? totalItem.totalExp : 0 };
        }
        return { totalBookExperience: 0 };
    } catch (error) {
        log.warn(`识别经验书失败: ${error.message}`);
        return { totalBookExperience: 0 };
    }
}

// 获取世界等级（地脉花管理专用）
async function getWorldLevelForLeyLine() {
    try {
        const worldLevel = await ImageRecognition.WorldLevelRecognition();
        if (!worldLevel) {
            log.warn("世界等级识别失败，使用默认值0");
            return 0;
        }
        return worldLevel;
    } catch (error) {
        log.error(`获取世界等级失败: ${error.message}`);
        log.warn("使用默认世界等级0");
        return 0;
    }
}

// 执行地脉花任务
async function runAutoLeyLineOutcropTask(expRuns, moraRuns, stamina) {
    try {
        if (moraRuns > 0) {
            const moraMaxRounds = moraRuns >= 5 ? 2 : 1;
            for (let i = 0; i < moraMaxRounds; i++) {
                log.info(`开始执行藏金之花，次数: ${moraRuns}, 第${i + 1}轮`);
                
                // 检查体力值
             const stamina = await Inventory.queryStaminaValue();
             const minStamina = 20;
              if (stamina < minStamina) {
            log.warn(`体力值${stamina}低于${minStamina}，跳过当前轮`);
            continue;
        }
                
                const resin = await Inventory.queryStaminaValue();
                const resinSupportedCount = Math.floor(resin / 40) + (resin % 40 >= 20 ? 1 : 0);
                const actualCount = Math.min(moraRuns, resinSupportedCount);
                log.info(`当前树脂: ${resin}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                notification.send(`当前树脂: ${resin}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                
                let taskParam = new AutoLeyLineOutcropParam();
                taskParam.Count = actualCount;
                taskParam.Country = settings.adventurePath || "蒙德";
                taskParam.LeyLineOutcropType = "藏金之花";
                taskParam.Team = settings.teamName || "";
                taskParam.IsResinExhaustionMode = false;
                taskParam.UseAdventurerHandbook = false;
                taskParam.IsGoToSynthesizer = false;
                taskParam.UseFragileResin = false;
                taskParam.UseTransientResin = false;
                taskParam.IsNotification = false;
                taskParam.FightConfig.StrategyName = settings.strategyName || "auto";
                await dispatcher.RunAutoLeyLineOutcropTask(taskParam);
                log.info("藏金之花完成");
            }
        }

        if (expRuns > 0) {
            const expMaxRounds = expRuns >= 5 ? 2 : 1;
            for (let i = 0; i < expMaxRounds; i++) {
                log.info(`开始执行启示之花，次数: ${expRuns}, 第${i + 1}轮`);
                
                const resinSupportedCount = Math.floor(stamina / 40) + (stamina % 40 >= 20 ? 1 : 0);
                const actualCount = Math.min(expRuns, resinSupportedCount);
                log.info(`当前树脂: ${stamina}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                notification.send(`当前树脂: ${stamina}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                
                let taskParam = new AutoLeyLineOutcropParam();
                taskParam.Count = actualCount;
                taskParam.Country = settings.adventurePath || "蒙德";
                taskParam.LeyLineOutcropType = "启示之花";
                taskParam.Team = settings.teamName || "";
                taskParam.IsResinExhaustionMode = false;
                taskParam.UseAdventurerHandbook = false;
                taskParam.IsGoToSynthesizer = false;
                taskParam.UseFragileResin = false;
                taskParam.UseTransientResin = false;
                taskParam.IsNotification = false;
                taskParam.FightConfig.StrategyName = settings.strategyName || "auto";
                await dispatcher.RunAutoLeyLineOutcropTask(taskParam);
                log.info("启示之花完成");
            }
        }

        log.info("自动地脉花完成");
        notification.send("自动地脉花完成");
    } catch (error) {
        log.error(`执行地脉花任务失败：${error.message}`);
        if (error.message !== "树脂耗尽，任务结束") {
            throw error;
        }
    }
}

// 使用IIFE包装返回Promise
(async () => {
    // 定义全局唯一标识的锁变量，确保流程只执行一次
    if (typeof __genshinMaterialScriptExecuting === 'undefined') {
        __genshinMaterialScriptExecuting = false;
    }
    
    if (__genshinMaterialScriptExecuting) {
        log.info("⚠️ 脚本正在执行中，跳过重复触发");
        return;
    }
    __genshinMaterialScriptExecuting = true;
    
    try {
        await Main();
    } finally {
        __genshinMaterialScriptExecuting = false;
    }
})();
