// 角色经验计算 - 主文件

// 加载模块
eval(file.readTextSync("lib/ui_navigator.js"));
eval(file.readTextSync("lib/calculator.js"));
eval(file.readTextSync("lib/image_recognition.js"));
eval(file.readTextSync("lib/file_utils.js"));

// 配置常量
const CONFIG = {
    OCR_REGION: {
        ROLE_NAME: { X: 1450, Y: 125, Width: 290, Height: 50 },
        ROLE_LEVEL: { X: 1450, Y: 200, Width: 290, Height: 40 },
        ROLE_EXP: { X: 1700, Y: 215, Width: 100, Height: 30 }
    },
    UI_COORDINATES: {
        DETAIL_BUTTON: { X: 1770, Y: 1015 } // 角色详情按钮
    },
    DELAY: {
        SHORT: 500,      // 短延迟
        MEDIUM: 1000,    // 中等延迟
        LONG: 1500       // 长延迟
    }
};

// 主逻辑
(async function () {    
    // 设置分辨率
    setGameMetrics(1920, 1080, 1);
    
    try {
        // 1. 读取并验证设置
        const { targetRoleNames, targetRoleLevel, experienceBookCalculation } = readAndValidateSettings();

        // 2. 处理角色名
        const roleNames = processRoleNames(targetRoleNames);
        log.info(`已检测到 ${roleNames.length} 个角色: ${roleNames.join(', ')}`);

        if (roleNames.length === 0) {
            throw new Error("未检测到有效的角色名");
        }

        // 3. 进入角色界面
        await UiNavigation.roleUiNavigation();
        await sleep(CONFIG.DELAY.MEDIUM);

        // 4. 识别所有角色信息
        const roleRecognitionResults = {};

        for (let i = 0; i < roleNames.length; i++) {
            const roleName = roleNames[i];
            log.info(`处理角色【${roleName}】(${i + 1}/${roleNames.length})`);

            // 筛选角色
            const filterResult = await UiNavigation.FilterRoles(roleName);
            if (!filterResult) {
                log.warn(`角色【${roleName}】筛选后无结果，跳过`);
                continue;
            }

            // 识别角色列表
            const identifiedRoles = await ImageRecognition.roleRecognition(roleName);
            if (!identifiedRoles) {
                log.warn(`角色【${roleName}】识别失败，跳过`);
                continue;
            }

            await sleep(CONFIG.DELAY.SHORT);

            // 识别角色详细信息
            const roleInfo = await recognizeRoleInfo(roleName);

            // 保存结果
            if (!roleRecognitionResults[roleName]) {
                roleRecognitionResults[roleName] = [];
            }

            roleRecognitionResults[roleName].push({
                roleName: roleInfo.roleName || roleName,
                roleLevel: roleInfo.level,
                roleExp: roleInfo.exp
            });

            log.info(`角色【${roleName}】识别完成: 等级${roleInfo.level}, 经验${roleInfo.exp}`);
        }

        // 5. 返回主界面
        await genshin.returnMainUi();

        // 6. 计算所需经验
        if (Object.keys(roleRecognitionResults).length === 0) {
            throw new Error('未成功识别任何角色信息');
        }

        const roleRequiredExperiences = calculateRoleRequiredExp(roleRecognitionResults, targetRoleLevel);

        // 7. 获取经验书数据
        let expBookData = null;
        if (experienceBookCalculation) {
            expBookData = await getExperienceBookData();
        }

        // 8. 获取世界等级并计算
        const worldLevel = await getWorldLevel();
        const experienceRecord = FileUtils.generateExpText(roleRequiredExperiences, targetRoleLevel, expBookData);

        // 9. 计算树脂需求
        const calculationResults = {
            average: resinCalculation.calculateExpBookRequirements(
                experienceRecord.additionalExperienceRequirements,
                worldLevel,
                { useExpected: true }
            ),
            minimumGuarantee: resinCalculation.calculateExpBookRequirements(
                experienceRecord.additionalExperienceRequirements,
                worldLevel,
                { useExpected: false }
            )
        };

        // 10. 生成并导出结果
        const resultText = generateResultText(
            experienceRecord,
            targetRoleLevel,
            expBookData,
            worldLevel,
            calculationResults
        );

        const fileName = FileUtils.generateSimpleFileName('exp_result');
        await FileUtils.fileReadWrite("test", resultText, fileName);

        await genshin.returnMainUi();
        
        log.info(`计算结果已保存到: ${fileName}`);

    } catch (error) {
        log.error(`程序执行失败: ${error.message}`);
        log.error(`错误堆栈: ${error.stack}`);

        // 尝试返回主界面
        try {
            await genshin.returnMainUi();
        } catch (uiError) {
            log.warn(`返回主界面失败: ${uiError.message}`);
        }

        // 重新抛出错误
        throw error;
    }
})();

// 读取并验证配置
function readAndValidateSettings() {
    const targetRoleNames = settings.targetRoleName;
    const targetRoleLevel = Number(settings.targetRoleLevel);
    const experienceBookCalculation = Boolean(settings.experienceBookCalculation);

    if (!targetRoleNames || typeof targetRoleNames !== 'string') {
        throw new Error("未输入目标角色名，请在js自定义配置中输入");
    }

    if (isNaN(targetRoleLevel) || targetRoleLevel <= 0 || targetRoleLevel > 90) {
        throw new Error("非法输入或未输入目标角色等级，请输入1-90之间的有效数字");
    }

    return { targetRoleNames, targetRoleLevel, experienceBookCalculation };
}

// 处理角色名，转换为标准名称
function processRoleNames(inputNames) {
    const aliases = FileUtils.readAliases('assets/combat_avatar.json');

    return String(inputNames)
        .split(/[,，]/)
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .map(input => aliases[input] || input)
        .filter(name => name && name.length > 0);
}

// 识别角色信息
async function recognizeRoleInfo(roleName) {
    log.info(`识别角色【${roleName}】信息`);

    // 进入角色详情页面
    click(CONFIG.UI_COORDINATES.DETAIL_BUTTON.X, CONFIG.UI_COORDINATES.DETAIL_BUTTON.Y);
    await sleep(CONFIG.DELAY.MEDIUM);

    // 并行识别所有OCR内容
    const [roleNameText, levelText, expText] = await Promise.all([
        ImageRecognition.ocrRecognize(2000, CONFIG.OCR_REGION.ROLE_NAME),
        ImageRecognition.ocrRecognize(2000, CONFIG.OCR_REGION.ROLE_LEVEL),
        ImageRecognition.ocrRecognize(2000, CONFIG.OCR_REGION.ROLE_EXP)
    ]);

    // 返回角色界面
    keyPress("VK_ESCAPE");
    await sleep(CONFIG.DELAY.SHORT);

    return {
        roleName: roleNameText,
        level: levelText,
        exp: expText
    };
}

// 计算角色所需经验
function calculateRoleRequiredExp(roleRecognitionResults, targetRoleLevel) {
    const results = {};

    for (const [roleName, roleList] of Object.entries(roleRecognitionResults)) {
        if (!Array.isArray(roleList) || roleList.length === 0) {
            log.warn(`角色【${roleName}】无有效识别记录，跳过计算`);
            continue;
        }

        results[roleName] = roleList.map(roleInfo => {
            const currentLevel = getBeforeNumber(roleInfo.roleLevel) || 0;
            const currentExp = getBeforeNumber(roleInfo.roleExp) || 0;

            let requiredExperience = 0;
            if (currentLevel >= targetRoleLevel) {
                log.info(`角色【${roleName}】当前等级${currentLevel}已达到目标等级${targetRoleLevel}，无需经验`);
            } else if (currentLevel > 0 && currentLevel < targetRoleLevel) {
                requiredExperience = expCalculator.calculateExpRequired(
                    currentLevel,
                    currentExp,
                    targetRoleLevel
                );
                log.info(`角色【${roleName}】当前等级${currentLevel}（经验${currentExp}）距离等级${targetRoleLevel}还需经验${requiredExperience}`);
            } else {
                log.warn(`角色【${roleName}】等级解析失败：${roleInfo.roleLevel}`);
            }

            return {
                roleName: roleName,
                currentLevel: currentLevel,
                currentExp: currentExp,
                requiredExperience: requiredExperience
            };
        }).filter(record => record.requiredExperience > 0);
    }

    return results;
}

// 获取经验书数据
async function getExperienceBookData() {
    try {
        const expBookInfo = await ImageRecognition.IdentifyExperienceBook();
        return expBookInfo ? FileUtils.getExpBookData(expBookInfo) : null;
    } catch (error) {
        log.warn(`识别经验书失败: ${error.message}`);
        return null;
    }
}

// 获取世界等级
async function getWorldLevel() {
    try {
        const worldLevel = await ImageRecognition.WorldLevelRecognition();
        if (!worldLevel) {
            throw new Error("世界等级识别失败");
        }
        return worldLevel;
    } catch (error) {
        log.error(`获取世界等级失败: ${error.message}`);
        throw error;
    }
}

// 生成结果文本
function generateResultText(experienceRecord, targetRoleLevel, expBookData, worldLevel, calculationResults) {
    let text = experienceRecord.text || "经验计算结果\n";

    // 添加世界等级信息
    text += `\n当前世界等级：${worldLevel}\n`;
    text += "单次启示之花奖励（20原粹树脂）：\n";

    const dropConfig = resinCalculation.WORLD_LEVEL_DROP_CONFIG[worldLevel];
    if (dropConfig) {
        Object.entries(dropConfig).forEach(([bookName, [min, max]]) => {
            text += `  ${bookName}：${min}~${max}本\n`;
        });
    }

    // 添加计算结果
    text += '\n================ 计算结果 ================\n';

    if (experienceRecord.additionalExperienceRequirements < 0){
        text += '当前背包内经验书已满足经验需求，无需刷取\n'
    } else {
        // 保底计算
        text += '【保底计算（最非情况）】\n';
        text += `使用浓缩树脂需刷取次数: ${calculationResults.minimumGuarantee.runs.usingCondensedResin} 次\n`;
        text += `使用原粹树脂需刷取次数: ${calculationResults.minimumGuarantee.runs.usingOriginalResin} 次\n`;
        text += `原粹树脂总消耗: ${calculationResults.minimumGuarantee.resinCost.totalOriginalResin}\n`;

        // 期望计算
        text += '\n【期望计算（平均情况）】\n';
        text += `使用浓缩树脂需刷取次数: ${calculationResults.average.runs.usingCondensedResin} 次\n`;
        text += `使用原粹树脂需刷取次数: ${calculationResults.average.runs.usingOriginalResin} 次\n`;
        text += `原粹树脂总消耗: ${calculationResults.average.resinCost.totalOriginalResin}\n`;
    }
    return text;
}

/**
 * 只保留数字或符号“/”前的数字，否则为 0
 * @param {string} str
 * @return {number}
 */
function getBeforeNumber (str) {
    // 空值/非字符串兜底 
    if (!str || typeof str !== 'string') return 0;
    let val = str
        .split('/')[0].trim() // 分割后取前缀
        .match(/\d+/g)?.join('') || ''; // 只保留数字
    const num = Number(val) // 转换数字
    return isNaN(num) ? 0 : num; // 兜底 NaN 为 0
}