let userName = settings.userName || "默认账户";
const mode = settings.runMode || "营养袋模式"
let recoveryFoodName = settings.recoveryFoodName || "";
let resurrectionFoodName = settings.resurrectionFoodName || "";
let attackFoodName = settings.attackFoodName || "";
let defenseFoodName = settings.defenseFoodName || "";
let otherFoodName = settings.otherFoodName || "";
const ocrRegion = {
        x: 1422,
        y: 586,
        width: 300,
        height: 40
    };
const ocrRegion1 = {
        x: 1420,
        y: 687,
        width: 300,
        height: 40
    };
const ocrRegion2 = {
        x: 105,
        y: 242,
        width: 140,
        height: 40
    };
const loadDelay = +settings.loadDelay || 800;
const stepDelay = +settings.stepDelay || 500;
let refreshTime = parseFloat(settings.refreshTime) || 4.0;
if (isNaN(refreshTime) || refreshTime < 0 || refreshTime >= 24) {
    refreshTime = 4.0;
    log.warn(`刷新时间设置错误，使用默认值4.0`);
}
// 计算刷新时间的小时和分钟
const refreshHour = Math.floor(refreshTime);
const refreshMinute = Math.floor((refreshTime - refreshHour) * 60);
log.info(`刷新时间为: ${refreshHour}:${String(refreshMinute).padStart(2, '0')}`);

// 正则特殊字符转义函数
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
(async function () {
    // 检验账户名
    async function getUserName() {
        userName = userName.trim();
        // 账户名规则：数字、中英文，长度1-20字符
        if (!userName || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(userName)) {
            log.error(`账户名${userName}违规，暂时使用默认账户名，请查看readme后修改`)
            userName = "默认账户";
        }
        return userName;
    }

    async function close_join_world_popup_window() {
        const game_region = captureGameRegion();
        const text_x = 762;
        const text_y = 29;
        const text_w = 210;
        const text_h = 40;
        const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));
        if (ocr_res) {
            if (ocr_res.text.includes("进入世界申请")) {
                log.info("检测到有人申请进入世界，拒绝申请");
                click(1051, 51);//选择珍贵物品
                await clickPNG('拒绝', 10);
            }
        }
        game_region.dispose();
    }

    async function close_expired_stuff_popup_window() {
        const game_region = captureGameRegion();
        const text_x = 850;
        const text_y = 273;
        const text_w = 225;
        const text_h = 51;
        const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));
        if (ocr_res) {
            if (ocr_res.text.includes("物品过期")) {
                log.info("检测到物品过期");
                click(1000, 750);
                await sleep(1000);
            }
        }
        game_region.dispose();
    }

    /**
     * 获取本地记录中当天4点至次日4点间的最早记录
     * @param {string} filePath - 记录文件路径
     * @returns {Promise<object>} 包含药品数据的对象
     * 格式: { recovery: { count }, resurrection: { count }, attack: { count }, defense: { count }, other: { count }, initialized: { recovery, resurrection, attack, defense, other } }
     */
    async function getLocalData(filePath) {
        // 初始化返回结果
        const result = {
            recovery: null,
            resurrection: null,
            attack: null,
            defense: null,
            other: null,
            initialized: {
                recovery: false,
                resurrection: false,
                attack: false,
                defense: false,
                other: false
            }
        };

        try {
            // 尝试读取文件，不存在则直接返回空结果
            const content = await file.readText(filePath);
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) return result;

            // 获取当前时间范围（根据自定义刷新时间）
            const now = new Date();
            let startTime, endTime;

            // 创建今天的刷新时间点
            const todayRefresh = new Date(now);
            todayRefresh.setHours(refreshHour, refreshMinute, 0, 0);

            if (now < todayRefresh) {
                // 当前时间在刷新时间前，时间范围为昨天刷新时间至今天刷新时间
                startTime = new Date(todayRefresh);
                startTime.setDate(startTime.getDate() - 1);
                endTime = new Date(todayRefresh);
            } else {
                // 当前时间在刷新时间后，时间范围为今天刷新时间至明天刷新时间
                startTime = new Date(todayRefresh);
                endTime = new Date(todayRefresh);
                endTime.setDate(endTime.getDate() + 1);
            }

            // 时间格式正则：匹配 "时间:YYYY/MM/DD HH:mm:ss"
            const timeRegex = /时间:(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/;
            // 药品匹配正则
            const recoveryRegex = new RegExp(`${escapeRegExp(recoveryFoodName)}-(\\d+)`);
            const resurrectionRegex = new RegExp(`${escapeRegExp(resurrectionFoodName)}-(\\d+)`);
            const attackRegex = new RegExp(`${escapeRegExp(attackFoodName)}-(\\d+)`);
            const defenseRegex = new RegExp(`${escapeRegExp(defenseFoodName)}-(\\d+)`);
            const otherRegex = new RegExp(`${escapeRegExp(otherFoodName)}-(\\d+)`);

            // 正向遍历：找到第一个小于startTime的行索引（边界）
            let firstOutOfRangeIndex = -1; // 初始化为-1（表示所有行都在时间范围内）
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const timeMatch = line.match(timeRegex);
                if (!timeMatch) continue;

                const recordTime = new Date(timeMatch[1]);

                // 找到第一个超出时间范围（小于startTime）的行，记录索引并终止正向遍历
                if (recordTime < startTime) {
                    // 如果第一条记录时间在今天4点之前，直接返回空结果
                    if (i === 0) {
                        return result;
                    }
                    firstOutOfRangeIndex = i;
                    break;
                }
            }

            // 反向遍历的起始索引：如果有超出范围的行，从边界上一行开始；否则从最后一行开始
            const reverseStartIndex = firstOutOfRangeIndex === -1
                ? lines.length - 1
                : firstOutOfRangeIndex - 1;

            // 反向遍历的终止索引：0（顶部）
            const reverseEndIndex = 0;

            // 根据当前模式确定需要处理的药品类型
            const needAttackDefenseOther = mode === "综合模式";

            // 反向遍历：找时间范围内最早的药品记录
            // 遍历范围：[reverseStartIndex, reverseEndIndex]（从时间范围的最旧→最新）
            for (let i = reverseStartIndex; i >= reverseEndIndex; i--) {
                // 防止索引越界（比如边界上一行是-1时）
                if (i < 0) break;

                const line = lines[i];
                const timeMatch = line.match(timeRegex);
                if (!timeMatch) continue;

                const recordTime = new Date(timeMatch[1]);
                // 二次校验：确保记录在目标时间范围内（避免边界判断误差）
                if (recordTime < startTime || recordTime >= endTime) {
                    continue;
                }

                // 匹配回血药：未初始化时才赋值
                if (!result.initialized.recovery) {
                    const recoveryMatch = line.match(recoveryRegex);
                    if (recoveryMatch) {
                        result.recovery = { count: parseInt(recoveryMatch[1]) };
                        result.initialized.recovery = true;
                    }
                }

                // 匹配复活药：未初始化时才赋值
                if (!result.initialized.resurrection) {
                    const resurrectionMatch = line.match(resurrectionRegex);
                    if (resurrectionMatch) {
                        result.resurrection = { count: parseInt(resurrectionMatch[1]) };
                        result.initialized.resurrection = true;
                    }
                }

                // 匹配攻击药：未初始化时才赋值，仅在综合模式下处理
                if (needAttackDefenseOther && !result.initialized.attack) {
                    const attackMatch = line.match(attackRegex);
                    if (attackMatch) {
                        result.attack = { count: parseInt(attackMatch[1]) };
                        result.initialized.attack = true;
                    }
                }

                // 匹配防御药：未初始化时才赋值，仅在综合模式下处理
                if (needAttackDefenseOther && !result.initialized.defense) {
                    const defenseMatch = line.match(defenseRegex);
                    if (defenseMatch) {
                        result.defense = { count: parseInt(defenseMatch[1]) };
                        result.initialized.defense = true;
                    }
                }

                // 匹配其他药：未初始化时才赋值，仅在综合模式下处理
                if (needAttackDefenseOther && !result.initialized.other) {
                    const otherMatch = line.match(otherRegex);
                    if (otherMatch) {
                        result.other = { count: parseInt(otherMatch[1]) };
                        result.initialized.other = true;
                    }
                }

                // 所有需要的药品都找到，提前终止遍历（已拿到最早记录）
                let allFound = result.initialized.recovery && result.initialized.resurrection;
                if (needAttackDefenseOther) {
                    allFound = allFound && result.initialized.attack && result.initialized.defense && result.initialized.other;
                }
                if (allFound) {
                    break;
                }
            }
            return result;
        } catch (error) {
            // 文件不存在或读取错误时返回空结果
            return result;
        }
    }

    async function updateRecord(filePath, currentRecovery, currentResurrection, currentAttack, currentDefense, currentOther, deleteSameDayRecords = false) {
        // 生成当前时间字符串
        const now = new Date();
        const timeStr = `${now.getFullYear()}/${
            String(now.getMonth() + 1).padStart(2, '0')
        }/${
            String(now.getDate()).padStart(2, '0')
        } ${
            String(now.getHours()).padStart(2, '0')
        }:${
            String(now.getMinutes()).padStart(2, '0')
        }:${
            String(now.getSeconds()).padStart(2, '0')
        }`;

        // 根据当前模式确定需要处理的药品类型
        const needAttackDefenseOther = mode === "综合模式";
        
        // 基础药品：回血药和复活药
        const baseDrugs = [
            { name: recoveryFoodName, count: currentRecovery },
            { name: resurrectionFoodName, count: currentResurrection }
        ];
        
        // 根据模式确定要处理的药品列表
        let drugs = [...baseDrugs];
        
        // 只在综合模式下添加攻击药、防御药和其他药
        if (needAttackDefenseOther) {
            drugs = drugs.concat([
                { name: attackFoodName, count: currentAttack },
                { name: defenseFoodName, count: currentDefense },
                { name: otherFoodName, count: currentOther }
            ]);
        }
        
        // 生成记录，只包含name不为空且数量>0的数据
        const records = drugs
            .filter(drug => drug.name.trim() && drug.count > 0)
            .map(drug => `时间:${timeStr}-${drug.name}-${drug.count}`);

        // 如果没有需要记录的数据，直接返回
        if (records.length === 0) {
            log.info("没有需要记录的数据");
            return true;
        }

        try {
            let content = await file.readText(filePath);
            let lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                // 文件为空，直接写入新记录
                await file.writeText(filePath, records.join('\n'));
                return true;
            }

            // 如果需要删除当天同名记录
            if (deleteSameDayRecords) {
                // 获取当前时间范围（根据自定义刷新时间）
                let startTime, endTime;

                // 创建今天的刷新时间点
                const todayRefresh = new Date(now);
                todayRefresh.setHours(refreshHour, refreshMinute, 0, 0);

                if (now < todayRefresh) {
                    // 当前时间在刷新时间前，时间范围为昨天刷新时间至今天刷新时间
                    startTime = new Date(todayRefresh);
                    startTime.setDate(startTime.getDate() - 1);
                    endTime = new Date(todayRefresh);
                } else {
                    // 当前时间在刷新时间后，时间范围为今天刷新时间至明天刷新时间
                    startTime = new Date(todayRefresh);
                    endTime = new Date(todayRefresh);
                    endTime.setDate(endTime.getDate() + 1);
                }

                // 根据当前模式确定需要处理的药品类型
                const needAttackDefenseOther = mode === "综合模式";
                
                // 基础药品：回血药和复活药
                const baseDrugs = [recoveryFoodName, resurrectionFoodName];
                
                // 根据模式确定要处理的药品列表
                let drugs = [...baseDrugs];
                
                // 只在综合模式下添加攻击药、防御药和其他药
                if (needAttackDefenseOther) {
                    drugs = drugs.concat([attackFoodName, defenseFoodName, otherFoodName]);
                }
                
                // 创建药品匹配正则，只处理需要记录的药品
                const regexList = drugs
                    .filter(name => name.trim())
                    .map(name => new RegExp(`${escapeRegExp(name)}-\\d+$`));

                // 过滤掉当天时间范围内的同名记录
                lines = lines.filter(line => {
                    const timeMatch = line.match(/时间:(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
                    if (!timeMatch) return true;

                    const recordTime = new Date(timeMatch[1]);
                    // 检查是否在当天时间范围内
                    if (recordTime >= startTime && recordTime < endTime) {
                        // 检查是否为需要记录的药品记录
                        for (const regex of regexList) {
                            if (regex.test(line)) {
                                return false; // 删除该记录
                            }
                        }
                    }
                    return true; // 保留该记录
                });
            }

            // 添加新记录到最前面
            lines.unshift(...records);

            // 只保留30天内的记录
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentLines = lines.filter(line => {
                const timeMatch = line.match(/时间:(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
                if (!timeMatch) return false;
                const lineTime = new Date(timeMatch[1]);
                return lineTime >= thirtyDaysAgo;
            });

            // 写入文件
            await file.writeText(filePath, recentLines.join('\n'));
            return true;
        } catch (error) {
            // 文件不存在时创建新文件
            await file.writeText(filePath, records.join('\n'));
            return true;
        }
    }

    async function recognizeNumberByOCR(ocrRegion, pattern) {
        let captureRegion = null;
        try {
            const ocrRo = RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
            captureRegion = captureGameRegion();
            const resList = captureRegion.findMulti(ocrRo);

            if (!resList || resList.length === 0) {
                log.warn("OCR未识别到任何文本");
                return null;
            }

            for (const res of resList) {
                if (!res || !res.text) {
                    continue;
                }
                const numberMatch = res.text.match(pattern);
                if (numberMatch) {
                    const number = parseInt(numberMatch[1] || numberMatch[0]);
                    if (!isNaN(number)) {
                        return number;
                    }
                }
            }
        }
        catch (error) {
            log.error(`OCR识别时发生异常: ${error.message}`);
        }
        finally {
            if (captureRegion) {
                captureRegion.dispose();
            }
        }
        return null;
    }

    async function recognizeFoodItemByOCR(ocrRegion, pattern) {
        let captureRegion = null;
        try {
            const ocrRo = RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
            captureRegion = captureGameRegion();
            const resList = captureRegion.findMulti(ocrRo);

            if (!resList || resList.length === 0) {
                log.warn("OCR未识别到任何文本");
                return { name: null, count: null };
            }

            for (const res of resList) {
                if (!res || !res.text) {
                    continue;
                }
                const match = res.text.match(pattern);
                if (match) {
                    let name = null;
                    let count = null;

                    if (match[1]) {
                        name = match[1].trim();
                    }

                    if (match[2]) {
                        count = parseInt(match[2]);
                        if (isNaN(count)) {
                            count = null;
                        }
                    }

                    if (name || count) {
                        return { name, count };
                    }
                }
            }
        }
        catch (error) {
            log.error(`OCR识别时发生异常: ${error.message}`);
        }
        finally {
            if (captureRegion) {
                captureRegion.dispose();
            }
        }
        return { name: null, count: null };
    }

    async function findAndClick(target, doClick = true, maxAttempts = 60) {
        for (let i = 0; i < maxAttempts; i++) {
            const rg = captureGameRegion();
            try {
                const res = rg.find(target);
                if (res.isExist()) { await sleep(50 * 2 + 50); if (doClick) { res.click(); } return true; }
            } finally { rg.dispose(); }
            if (i < maxAttempts - 1) await sleep(50);
        }
        return false;
    }

    async function clickPNG(png, maxAttempts = 20, doClick=true) {
//        log.info(`调试-点击目标${png},重试次数${maxAttempts}`);
        const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${png}.png`));
        pngRo.Threshold = 0.95;
        pngRo.InitTemplate();
        return await findAndClick(pngRo, doClick, maxAttempts);
    }

    // 生成药品描述的函数
    async function generateDrugDescription(drugName, diffValue,changes) {
        if (!drugName.trim()) return;
        
        let desc = "";
        if (diffValue > 0) {
            desc = `- ${drugName}：消耗 ${diffValue} 个`;
        } else if (diffValue < 0) {
            desc = `- ${drugName}：新增 ${-diffValue} 个`;
        } else {
            desc = `- ${drugName}：无变化`;
        }
        changes.push(desc);
    }

    async function main() {
        let recoveryNumber = 0;
        let resurrectionNumber = 0;
        let attackNumber = 0;
        let defenseNumber = 0;
        let otherNumber = 0;
        
        // 进入界面的通用函数
        async function enterInterface(interfaceType, maxRetries = 5) {
            let retryCount = 0;
            let successClick = false;
            
            while (retryCount < maxRetries && !successClick) {
                retryCount++;
                await close_join_world_popup_window();
                
                if (interfaceType === 'nutrition_bag') {
                    // 营养袋模式：进入小道具界面
                    click(1051, 51); // 选择小道具
                    await sleep(loadDelay);
                    
                    if (await clickPNG('拒绝', 3)) {
                        log.info("检测到进入世界申请，已拒绝，重新尝试点击分类标签");
                        await sleep(stepDelay);
                        continue;
                    }
                    
                    if (await clickPNG('营养袋', 1, false)) {
                        successClick = true;
                        log.info("成功进入小道具界面");
                        break;
                    }
                } else if (interfaceType === 'filter') {
                    // 筛选模式：进入食物界面
                    click(863, 51); // 选择食物
                    await sleep(loadDelay);
                    
                    if (await clickPNG('拒绝', 3)) {
                        log.info("检测到进入世界申请，已拒绝，重新尝试点击分类标签");
                        await sleep(stepDelay);
                        continue;
                    }
                    
                    if (await clickPNG('筛选1', 1, false) || await clickPNG('筛选2', 1, false)) {
                        successClick = true;
                        log.info("成功进入食物界面");
                        break;
                    }
                }
                
                log.warn(`尝试点击分类标签失败，第${retryCount}次重试`);
                await sleep(stepDelay);
            }
            
            return successClick;
        }
        
        // 搜索和识别药品的通用函数
        async function searchAndRecognizeDrug(drugName, drugType) {
            if (!drugName.trim()) return 0;
            
            await clickPNG('筛选1', 1);
            await clickPNG('筛选2', 1);
            await clickPNG('重置');
            await sleep(stepDelay);
            await clickPNG('搜索');
            await sleep(loadDelay);
            log.info(`搜索${drugName}`);
            inputText(drugName);
            await clickPNG('确认筛选');
            await sleep(loadDelay);
            const count = await recognizeNumberByOCR(ocrRegion2, /\d+/) || 0;
            
            if (count === 0) {
                notification.send(`【营养袋吃药统计】\n未识别到${drugType}数量\n药品名：${drugName}\n设置数量为：0`);
            }
            
            return count;
        }
        
        // 营养袋药品识别的通用函数
        async function recognizeNutritionBagDrug(ocrRegionId, pattern, drugType) {
            let result = await recognizeFoodItemByOCR(ocrRegionId, pattern);
            if (result.name && result.count !== null) {
                log.info(`识别到: ${result.name}, 份数: ${result.count}`);
            } else {
                log.warn(`未识别到有效的${drugType}信息`);
            }
            const count = result.count || 0;
            const name = result.name || `未识别到${drugType}名称`;
            
            if (count === 0) {
                notification.send(`【营养袋吃药统计】\n未识别到${drugType}数量\n药品名：${name}\n设置数量为：0`);
            }
            
            return { count, name };
        }
        
        // 设置分辨率和缩放
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();
        keyPress("B");//打开背包
        await sleep(1000);
        // 关闭弹窗
        await close_expired_stuff_popup_window();
        await close_join_world_popup_window();
        await sleep(loadDelay);
        
        if (mode === "综合模式") {
            // 综合模式：回血药和复活药通过营养袋模式获取，攻击药和防御药通过筛选模式获取
            
            // 1. 先处理营养袋模式（识别回血药和复活药）
            const successClick = await enterInterface('nutrition_bag');
            if (successClick) {
                await clickPNG('营养袋', 1);
                await sleep(loadDelay);
                const pattern = /(.+?)\s*[（\(](\d+)[份\s]*[）\)]/;
                
                // 使用模块化函数识别各种药品
                const recoveryResult = await recognizeNutritionBagDrug(ocrRegion, pattern, '回血药');
                recoveryNumber = recoveryResult.count;
                recoveryFoodName = recoveryResult.name;
                
                const resurrectionResult = await recognizeNutritionBagDrug(ocrRegion1, pattern, '复活药');
                resurrectionNumber = resurrectionResult.count;
                resurrectionFoodName = resurrectionResult.name;
            }
            // 2. 然后处理筛选模式（识别攻击药和防御药，只有填了名字才筛选）
            // 检查是否需要进行筛选（攻击药、防御药或其他药名字已填）
            const needFilter = !!attackFoodName.trim() || !!defenseFoodName.trim() || !!otherFoodName.trim();
            
            if (needFilter) {
                const successClick = await enterInterface('filter');
                if (successClick) {
                    // 使用模块化函数识别各种药品
                    attackNumber = await searchAndRecognizeDrug(attackFoodName, '攻击药');
                    defenseNumber = await searchAndRecognizeDrug(defenseFoodName, '防御药');
                    otherNumber = await searchAndRecognizeDrug(otherFoodName, '其他药');
                    
                    // 重置筛选
                    await clickPNG('筛选1', 1);
                    await clickPNG('筛选2', 1);
                    await clickPNG('重置');
                    await sleep(stepDelay);
                    await clickPNG('确认筛选');
                }
            }
        } else if (mode === "营养袋模式") {
            // 使用通用进入界面函数
            const successClick = await enterInterface('nutrition_bag');
            
            if (successClick) {
                await clickPNG('营养袋', 1);
                await sleep(loadDelay);
                const pattern = /(.+?)\s*[（\(](\d+)[份\s]*[）\)]/;
                
                // 使用模块化函数识别各种药品
                const recoveryResult = await recognizeNutritionBagDrug(ocrRegion, pattern, '回血药');
                recoveryNumber = recoveryResult.count;
                recoveryFoodName = recoveryResult.name;
                
                const resurrectionResult = await recognizeNutritionBagDrug(ocrRegion1, pattern, '复活药');
                resurrectionNumber = resurrectionResult.count;
                resurrectionFoodName = resurrectionResult.name;
            }
        } else if (mode === "筛选模式") {
            // 筛选模式：只处理回血药和复活药
            // 使用通用进入界面函数
            const successClick = await enterInterface('filter');
            
            if (successClick) {
                // 使用模块化函数识别各种药品
                recoveryNumber = await searchAndRecognizeDrug(recoveryFoodName, '回血药');
                resurrectionNumber = await searchAndRecognizeDrug(resurrectionFoodName, '复活药');
                
                // 重置筛选
                await clickPNG('筛选1', 1);
                await clickPNG('筛选2', 1);
                await clickPNG('重置');
                await sleep(stepDelay);
                await clickPNG('确认筛选');
            }
        }
        
        await genshin.returnMainUi();
        return { recoveryNumber, resurrectionNumber, attackNumber, defenseNumber, otherNumber };
    }
    // 主执行流程
    userName = await getUserName();
    const recordPath = `assets/${userName}.txt`;
    // 获取当前药物数量
    const { recoveryNumber, resurrectionNumber, attackNumber, defenseNumber, otherNumber } = await main();
    // 获取本地保存的数据
    const localData = await getLocalData(recordPath);
    // 确定初始化数据
    let initRecovery, initResurrection, initAttack, initDefense, initOther;
    let useLocalDataAsInit = false;
    
    // 检查本地数据初始化情况，只处理name不为空的数据
    const hasLocalRecovery = recoveryFoodName.trim() && localData.initialized.recovery;
    const hasLocalResurrection = resurrectionFoodName.trim() && localData.initialized.resurrection;
    const hasLocalAttack = attackFoodName.trim() && localData.initialized.attack;
    const hasLocalDefense = defenseFoodName.trim() && localData.initialized.defense;
    const hasLocalOther = otherFoodName.trim() && localData.initialized.other;
    
    // 根据当前模式确定需要处理的药品类型
    const needAttackDefenseOther = mode === "综合模式";
    
    // 计算有效药品数量（name不为空的药品），只考虑当前模式下需要处理的药品
    const baseFoods = [recoveryFoodName, resurrectionFoodName];
    const allFoods = needAttackDefenseOther 
        ? [...baseFoods, attackFoodName, defenseFoodName, otherFoodName] 
        : baseFoods;
    const validFoodCount = allFoods.filter(name => name.trim()).length;
    
    // 计算已读取到本地数据的有效药品数量，只考虑当前模式下需要处理的药品
    const baseLoaded = [hasLocalRecovery, hasLocalResurrection];
    const allLoaded = needAttackDefenseOther 
        ? [...baseLoaded, hasLocalAttack, hasLocalDefense, hasLocalOther] 
        : baseLoaded;
    const loadedFoodCount = allLoaded.filter(Boolean).length;
    
    if (validFoodCount > 0 && validFoodCount === loadedFoodCount) {
        // 情况1：所有有效药品（name不为空）都有本地数据
        initRecovery = hasLocalRecovery ? localData.recovery.count : recoveryNumber;
        initResurrection = hasLocalResurrection ? localData.resurrection.count : resurrectionNumber;
        initAttack = hasLocalAttack ? localData.attack.count : attackNumber;
        initDefense = hasLocalDefense ? localData.defense.count : defenseNumber;
        initOther = hasLocalOther ? localData.other.count : otherNumber;
        useLocalDataAsInit = true;
        log.info(`已读取到本地数据`)
    } else {
        // 情况2：部分有，部分无，用有的那个，缺的用当前数据
        // 情况3：全部本地数据都没有，所有药品都使用当前数据作为初始数据
        initRecovery = hasLocalRecovery ? localData.recovery.count : recoveryNumber;
        initResurrection = hasLocalResurrection ? localData.resurrection.count : resurrectionNumber;
        initAttack = hasLocalAttack ? localData.attack.count : attackNumber;
        initDefense = hasLocalDefense ? localData.defense.count : defenseNumber;
        initOther = hasLocalOther ? localData.other.count : otherNumber;
        if (loadedFoodCount === 0) {
            log.info(`未读取到本地数据，所有药品使用当前数据作为初始数据`)
        } else {
            log.info(`未读取到全部的本地数据，缺失部分使用当前数据作为初始数据`)
        }
    }
    
    // 判断是否需要写入（只写入填了名字的药品）
    const shouldWriteRecovery = recoveryFoodName.trim() && recoveryNumber > 0;
    const shouldWriteResurrection = resurrectionFoodName.trim() && resurrectionNumber > 0;
    const shouldWriteAttack = attackFoodName.trim() && attackNumber > 0;
    const shouldWriteDefense = defenseFoodName.trim() && defenseNumber > 0;
    const shouldWriteOther = otherFoodName.trim() && otherNumber > 0;
    const shouldWriteRecord = shouldWriteRecovery || shouldWriteResurrection || shouldWriteAttack || shouldWriteDefense || shouldWriteOther;
    
    // initSelect处理逻辑
    if (settings.initSelect && shouldWriteRecord) {
        // 强制初始化：初始化数量和最后一次运行数量都设为当前值
        await updateRecord(recordPath, recoveryNumber, resurrectionNumber, attackNumber, defenseNumber, otherNumber, deleteSameDayRecords=true);
        
        // 构建通知消息
        let initMsg = `【营养袋吃药统计】\n\n`;
        initMsg += `📋 强制初始化完成！\n`;
        initMsg += `👤 账户：${userName}\n\n`;
        initMsg += `📊 初始药品数据：\n`;
        
        let items = [];
        if (shouldWriteRecovery) items.push(`- ${recoveryFoodName}：${recoveryNumber}个`);
        if (shouldWriteResurrection) items.push(`- ${resurrectionFoodName}：${resurrectionNumber}个`);
        if (shouldWriteAttack) items.push(`- ${attackFoodName}：${attackNumber}个`);
        if (shouldWriteDefense) items.push(`- ${defenseFoodName}：${defenseNumber}个`);
        if (shouldWriteOther) items.push(`- ${otherFoodName}：${otherNumber}个`);
        
        initMsg += items.join('\n');
        
        notification.send(initMsg);
        
        // 添加简单格式的日志记录
        let initItemsSummary = items.map(item => item.replace(/- /g, "")).join(", ");
        log.info(`${userName}：强制初始化完成|当前库存：${initItemsSummary}`);
        return
    }
    
    if (shouldWriteRecord) {
        // 使用当前的数据更新记录
        await updateRecord(recordPath, recoveryNumber, resurrectionNumber, attackNumber, defenseNumber, otherNumber);
        
        // 本地有初始记录
        if(useLocalDataAsInit){
            const diffRecovery = initRecovery - recoveryNumber;
            const diffResurrection = initResurrection - resurrectionNumber;
            
            // 根据当前模式确定需要处理的药品类型
            const needAttackDefenseOther = mode === "综合模式";
            const diffAttack = needAttackDefenseOther ? initAttack - attackNumber : 0;
            const diffDefense = needAttackDefenseOther ? initDefense - defenseNumber : 0;
            const diffOther = needAttackDefenseOther ? initOther - otherNumber : 0;

            let changes = [];
            
            await generateDrugDescription(recoveryFoodName, diffRecovery,changes);
            await generateDrugDescription(resurrectionFoodName, diffResurrection,changes);
            
            // 只在综合模式下处理攻击药、防御药和其他药
            if (needAttackDefenseOther) {
                await generateDrugDescription(attackFoodName, diffAttack,changes);
                await generateDrugDescription(defenseFoodName, diffDefense,changes);
                await generateDrugDescription(otherFoodName, diffOther,changes);
            }

            // 构建通知消息
            let logMsg = `【营养袋吃药统计】\n\n`;
            logMsg += `📊 今日药品使用情况\n`;
            logMsg += `👤 账户：${userName}\n\n`;
            
            if (changes.every(change => change.includes("无变化"))) {
                logMsg += `✅ 今日药物数量无变化\n\n`;
            } else {
                logMsg += `📝 使用记录：\n`;
                logMsg += changes.join('\n');
                logMsg += `\n\n`;
            }

            // 添加库存信息
            const baseDrugs = [
                { name: recoveryFoodName, count: recoveryNumber },
                { name: resurrectionFoodName, count: resurrectionNumber }
            ];
            
            let inventoryDrugs = [...baseDrugs];
            
            // 只在综合模式下添加攻击药、防御药和其他药的库存信息
            if (needAttackDefenseOther) {
                inventoryDrugs = inventoryDrugs.concat([
                    { name: attackFoodName, count: attackNumber },
                    { name: defenseFoodName, count: defenseNumber },
                    { name: otherFoodName, count: otherNumber }
                ]);
            }
            
            let inventory = inventoryDrugs
                .filter(drug => drug.name.trim() && drug.count > 0)
                .map(drug => `- ${drug.name}：${drug.count}个`);
            
            if (inventory.length > 0) {
                logMsg += `📦 当前库存：\n`;
                logMsg += inventory.join('\n');
            }
            
            notification.send(logMsg);
            
            // 添加简单格式的日志记录
            let usageSummary = changes.every(change => change.includes("无变化")) ? "药物数量无变化" : changes.map(change => change.replace(/- /g, "")).join(", ");
            let inventorySummary = inventory.length > 0 ? inventory.map(item => item.replace(/- /g, "")).join(", ") : "无";
            log.info(`${userName}：今日使用情况|${usageSummary}|当前库存：${inventorySummary}`);
        } else {
            // 构建通知消息
            let initMsg = `【营养袋吃药统计】\n\n`;
            initMsg += `✅ 今日初始化完成！\n`;
            initMsg += `👤 账户：${userName}\n\n`;
            
            // 根据当前模式确定需要显示的药品类型
            const needAttackDefenseOther = mode === "综合模式";
            
            const baseDrugs = [
                { name: recoveryFoodName, count: initRecovery },
                { name: resurrectionFoodName, count: initResurrection }
            ];
            
            let drugs = [...baseDrugs];
            
            // 只在综合模式下添加攻击药、防御药和其他药
            if (needAttackDefenseOther) {
                drugs = drugs.concat([
                    { name: attackFoodName, count: initAttack },
                    { name: defenseFoodName, count: initDefense },
                    { name: otherFoodName, count: initOther }
                ]);
            }
            
            let items = drugs
                .filter(drug => drug.name.trim() && drug.count > 0)
                .map(drug => `- ${drug.name}：${drug.count}个`);
            
            if (items.length > 0) {
                initMsg += `📊 初始药品数据：\n`;
                initMsg += items.join('\n');
                notification.send(initMsg);
                
                // 添加简单格式的日志记录
                let initItemsSummary = items.map(item => item.replace(/- /g, "")).join(", ");
                log.info(`${userName}：初始化完成|当前库存：${initItemsSummary}`);
            } else {
                initMsg += `⚠️ 未识别到有效药品数据\n`;
                notification.send(initMsg);
                
                // 添加简单格式的日志记录
                log.info(`${userName}：初始化完成|当前库存：无`);
            }
        }
    } else {
        // 构建通知消息
        let msg = `【营养袋吃药统计】\n\n`;
        msg += `⚠️ 识别异常提醒\n`;
        msg += `👤 账户：${userName}\n\n`;
        msg += `📋 当前药品数量识别不全\n\n`;
        
        const drugs = [
            { name: recoveryFoodName, count: recoveryNumber },
            { name: resurrectionFoodName, count: resurrectionNumber },
            { name: attackFoodName, count: attackNumber },
            { name: defenseFoodName, count: defenseNumber },
            { name: otherFoodName, count: otherNumber }
        ];
        
        let items = drugs
            .filter(drug => drug.name.trim())
            .map(drug => `- ${drug.name}：${drug.count}个`);
        
        msg += `🔍 识别结果：\n`;
        msg += items.join('\n');
        msg += `\n\n`;
        msg += `❌ 不更新记录\n`;
        
        notification.send(msg);
        
        // 添加简单格式的日志记录
        log.info(`${userName}：识别异常，未更新记录|当前库存：无`);
    }
})();