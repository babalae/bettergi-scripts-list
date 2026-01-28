
/**
 * @author Ayaka-Main
 * @link   https://github.com/Patrick-Ze
 * @description 对背包API的易用包装。使用方法: 将此文件放在脚本目录下的 lib 文件夹中，然后在你的脚本开头处执行下面这行:
   eval(file.readTextSync("lib/inventory.js"));
 */

let scriptContext = {
    version: "1.1",
};

// 原本是csv格式，但是为了方便js重用，还是内置在代码中
const csvText = `物品,刷新机制,背包分类
「冷鲜肉」,12小时,材料
发光髓,12小时,材料
蝴蝶翅膀,12小时,材料
晶蝶,12小时,材料
晶核,12小时,材料
鳗肉,12小时,材料
螃蟹,12小时,材料
禽肉,12小时,材料
青蛙,12小时,材料
鳅鳅宝玉,12小时,材料
神秘的肉,12小时,材料
兽肉,12小时,材料
蜥蜴尾巴,12小时,材料
鱼肉,12小时,材料
沉玉仙茗,24小时,材料
便携轴承,46小时,材料
冰雾花花朵,46小时,材料
苍晶螺,46小时,材料
赤念果,46小时,材料
初露之源,46小时,材料
悼灵花,46小时,材料
嘟嘟莲,46小时,材料
绯樱绣球,46小时,材料
风车菊,46小时,材料
钩钩果,46小时,材料
鬼兜虫,46小时,材料
海灵芝,46小时,材料
海露花,46小时,材料
虹彩蔷薇,46小时,材料
湖光铃兰,46小时,材料
劫波莲,46小时,材料
晶化骨髓,46小时,材料
绝云椒椒,46小时,材料
枯叶紫英,46小时,材料
浪沫羽鳃,46小时,材料
烈焰花花蕊,46小时,材料
琉璃百合,46小时,材料
琉璃袋,46小时,材料
琉鳞石,46小时,材料
落落莓,46小时,材料
鸣草,46小时,材料
慕风蘑菇,46小时,材料
霓裳花,46小时,材料
帕蒂沙兰,46小时,材料
蒲公英籽,46小时,材料
奇异的「牙齿」,46小时,材料
青蜜莓,46小时,材料
清水玉,46小时,材料
清心,46小时,材料
柔灯铃,46小时,材料
肉龙掌,46小时,材料
塞西莉亚花,46小时,材料
沙脂蛹,46小时,材料
珊瑚真珠,46小时,材料
圣金虫,46小时,材料
石珀,46小时,材料
树王圣体菇,46小时,材料
霜盏花,46小时,材料
天云草实,46小时,材料
万相石,46小时,材料
微光角菌,46小时,材料
小灯草,46小时,材料
星螺,46小时,材料
血斛,46小时,材料
夜泊石,46小时,材料
幽灯蕈,46小时,材料
幽光星星,46小时,材料
月莲,46小时,材料
月落银,46小时,材料
冬凌草,46小时,材料
松珀香,46小时,材料
云岩裂叶,46小时,材料
灼灼彩菊,46小时,材料
子探测单元,46小时,材料
白铁块,每2天0点,材料
电气水晶,每2天0点,材料
星银矿石,每2天0点,材料
萃凝晶,每3天0点,材料
虹滴晶,每3天0点,材料
水晶块,每3天0点,材料
紫晶块,每3天0点,材料
白灵果,每天0点,材料
白萝卜,每天0点,材料
薄荷,每天0点,材料
澄晶实,每天0点,材料
墩墩桃,每天0点,材料
海草,每天0点,材料
寒涌石,每天0点,材料
红果果菇,每天0点,材料
胡萝卜,每天0点,材料
金鱼草,每天0点,材料
堇瓜,每天0点,材料
烬芯花,每天0点,材料
久雨莲,每天0点,材料
颗粒果,每天0点,材料
苦种,每天0点,材料
莲蓬,每天0点,材料
马尾,每天0点,材料
蘑菇,每天0点,材料
茉洁草,每天0点,材料
鸟蛋,每天0点,材料
树莓,每天0点,材料
松果,每天0点,材料
松茸,每天0点,材料
宿影花,每天0点,材料
甜甜花,每天0点,材料
铁块,每天0点,材料
汐藻,每天0点,材料
夏槲果,每天0点,材料
香辛果,每天0点,材料
须弥蔷薇,每天0点,材料
枣椰,每天0点,材料
竹笋,每天0点,材料
泡泡桔,每天0点,食物
苹果,每天0点,食物
日落果,每天0点,食物
星蕈,每天0点,食物
烛伞蘑菇,每天0点,食物
`

const renameMap = { "晶蝶": "晶核", "「冷鲜肉」": "冷鲜肉", "白铁矿": "白铁块", "铁矿": "铁块" };

const supportFile = "native_supported.json";
const materialMetadata = {};

function parseCsvTextToDict() {
    // 1. 将文本按行分割成数组
    const lines = csvText.trim().split("\n");

    // 预期标题是：['物品', '刷新机制', '背包分类']
    const headers = lines[0].split(",").map((header) => header.trim());

    // 检查标题是否符合预期，防止解析错误
    if (headers[0] !== "物品" || headers.length < 3) {
        console.error("CSV格式的标题行不符合预期。");
        return {};
    }

    // 确定我们需要的值对应的索引
    const cdIndex = headers.indexOf("刷新机制");
    const typeIndex = headers.indexOf("背包分类");

    // 3. 处理数据行，构建结果字典
    const resultDict = {};

    // 从第二行（索引 1）开始遍历数据
    const typeMap = {"食物": "Food", "材料": "Materials"};
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "") continue; // 跳过空行

        // 将数据行按逗号分割
        const values = line.split(",").map((value) => value.trim());

        // 确保数据行有足够的值
        if (values.length > Math.max(cdIndex, typeIndex) && values[0]) {
            const itemName = values[0];
            const cdValue = values[cdIndex];
            const typeValue = typeMap[values[typeIndex]];

            // 存入结果字典，以物品名为 key
            resultDict[itemName] = {
                cd: cdValue,
                type: typeValue,
            };
        }
    }

    return resultDict;
}

/**
 * 获取需要手动扫描的材料及其对应路径
 * @returns {Object} 格式为 { "材料名": "文件完整路径" } 的对象
 */
function getManualOcrMaterials() {
    const scanDir = "assets/images/CustomScan";
    const items = file.ReadPathSync(scanDir);
    
    // 1. 读取本地记录文件，获取已支持列表
    let native_supported = {};
    try {
        const content = readTextSync(supportFile);
        if (content) {
            native_supported = JSON.parse(content);
        }
    } catch (error) {
        log.debug(`读取记录文件失败: ${error.toString()}`);
    }

    // 2. 核心逻辑：建立材料名与路径的映射关系，并过滤已支持材料
    const manualDict = {};
    for (const itemPath of items) {
        // 提取材料名（不含扩展名）
        const itemName = splitExt(basename(itemPath))[0];
        // 差集计算：只有当 BetterGI 不支持该材料时，才加入待扫描字典
        if (!native_supported.hasOwnProperty(itemName)) {
            manualDict[itemName] = itemPath;
        }
    }

    return manualDict;
}

const manualOcrMaterials = getManualOcrMaterials();

async function manualOcr(normalizedItemList, shouldStop, sharedResults) {
    // 1. 预加载：将所有待识别材料的模板初始化并存储，避免在循环中重复读取文件
    const templates = {};
    let remainingItems = [];

    for (const itemName of normalizedItemList) {
        const mat = file.readImageMatSync(manualOcrMaterials[itemName]);
        const ro = RecognitionObject.TemplateMatch(mat);
        ro.threshold = 0.85;
        templates[itemName] = ro;
        remainingItems.push(itemName); // 加入待扫描清单
    }

    const _parseInt = (value, defaultValue = 0) => {
        const parsed = parseInt(value.trim(), 10);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    };
    if (remainingItems.length > 0) {
        log.info(`将通过补充OCR识别{0}等{1}类物品的数量`, remainingItems[0], remainingItems.length);
    }

    // 2. 扫描循环：直到所有材料都找到，或者当前画面不再有新目标
    while (remainingItems.length > 0 && !shouldStop()) {
        // 使用 withCapture 确保每一帧 region 都能正确 dispose
        const foundInThisFrame = await withCapture(async (region) => {
            const foundList = [];
            for (const itemName of remainingItems) {
                const result = region.find(templates[itemName]);
                if (result.isExist()) {
                    // 计算 OCR 区域坐标, 抄了 吉吉喵 大佬的方法
                    const tolerance = 1;
                    const rect = {
                        x: result.x - tolerance,
                        y: result.y + 97 - tolerance,
                        width: 66 + 2 * tolerance,
                        height: 22 + 2 * tolerance,
                    };
                    // drawRegion(rect); // 调试用
                    let ocrResult = region.find(RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height));
                    if (ocrResult && ocrResult.text) {
                        const count = _parseInt(ocrResult.text, -2);
                        sharedResults[itemName] = count;
                        log.info("{0}: {1}", itemName, count);
                        foundList.push(itemName); // 记录本帧识别到的条目
                    }
                }
            }
            return foundList; // 将本帧找到的列表返回给外部
        });

        // 3. 更新剩余待扫描列表
        if (foundInThisFrame.length > 0) {
            remainingItems = remainingItems.filter((item) => !foundInThisFrame.includes(item));
        }
        if (remainingItems.length > 0 && !shouldStop()) {
            await sleep(100); // 如果仍有剩余材料，短暂停顿
        } else {
            break; // 全部找到，退出循环
        }
    }

    return sharedResults;
}

/**
 * 获取背包中物品的数量。
 * 如果没有找到，则为-1；如果找到了但数字识别失败，则为-2
 */
async function getItemCount(itemList=null) {
    if (Object.keys(materialMetadata).length === 0) {
        Object.assign(materialMetadata, parseCsvTextToDict());
    }

    if (typeof itemList === "string") {
        itemList = [itemList];
    } else if (itemList == null || itemList.length === 0) {
        itemList = Object.keys(materialMetadata);
    }
    const normalizedItemList = itemList.map((itemName) => {
        return renameMap[itemName] || itemName;
    });
    const result = await mainScan(normalizedItemList);
    return result;
}

/**
 * 合并扫描结果并实现特征库自动更新（自愈）
 * @param {Object} nativeResults - BetterGI 返回的结果 { "鸣草": 10, ... }
 * @param {Object} manualResults - 手动 OCR 返回的结果 { "新材料": 5, ... }
 * @param {string[]} targetManualList - 本次扫描中，原本判定为需要“手动处理”的材料名清单
 * @returns {Object} 合并后的最终清单
 */
function mergeAndAutoRepair(nativeResults, manualResults, manualCandidateList) {
    // 1. 以原生结果为基础，合并手动结果
    const finalData = { ...nativeResults };
    const newlySupported = [];

    for (const name in manualResults) {
        // 如果 nativeResults 里没有这个材料，采用手动结果
        if (!finalData[name] || finalData[name] < 0) {
            finalData[name] = manualResults[name];
        }
    }

    // 2. 自愈检查：遍历原本以为需要手动的列表
    for (const name of manualCandidateList) {
        // 如果 BetterGI 的返回结果里包含了这个材料说明特征库更新了
        if (nativeResults.hasOwnProperty(name) && nativeResults[name] > 0) {
            newlySupported.push(name);
        }
    }

    // 3. 更新本地记录文件
    if (newlySupported.length > 0) {
        updateNativeSupportedJson(newlySupported);
    }

    return finalData;
}

/**
 * 更新本地受支持列表的持久化存储
 */
function updateNativeSupportedJson(newItems) {
    let registry = {};
    try {
        registry = JSON.parse(readTextSync(supportFile) || "{}");
    } catch(e) {}

    const today = new Date().toISOString().split('T')[0];
    newItems.forEach(item => {
        registry[item] = today;
        log.info(`发现{0}已被内置接口支持，未来将跳过它的补充OCR`, item);
    });

    file.WriteTextSync(supportFile, JSON.stringify(registry, null, 2));
}

async function mainScan(normalizedItemList) {
    const sharedOcrResults = {}; // 创建共享对象
    let isApiFinished = false;

    const manualList = normalizedItemList.filter(name => manualOcrMaterials.hasOwnProperty(name));

    // 并发启动
    const apiPromise = getItemCountWithApi(normalizedItemList, sharedOcrResults)
        .finally(() => isApiFinished = true);
    const manualPromise = manualOcr(manualList, () => isApiFinished, sharedOcrResults);

    // 等待全部完成
    const [apiResults, _] = await Promise.all([apiPromise, manualPromise]);

    // 最后合并结果（此时 sharedOcrResults 已经包含了所有 OCR 成功识别的内容）
    const results = mergeAndAutoRepair(apiResults, sharedOcrResults, manualList);
    const finalResults = {};
    const reverseRenameMap = Object.entries(renameMap).reduce((acc, [key, value]) => {
        acc[value] = key;
        return acc;
    }, {});
    for (const itemName of normalizedItemList) {
        // 如果某个元素没有找到，则不会存在对应的键值，赋值为-1以保持与单个物品查找时一致的行为
        const originName = reverseRenameMap[itemName] || itemName;
        finalResults[originName] = results[itemName] ?? -1;
    }
    return finalResults;
}

async function getItemCountWithApi(normalizedItemList, sharedOcrResults) {
    const groupByType = {};
    for (const itemName of normalizedItemList) {
        const metadata = materialMetadata[itemName];
        const itemType = metadata?.type ?? "Materials";
        if (!metadata?.type) {
            log.warn("未查找到{0}所属的背包分类，默认它是{1}", itemName, itemType);
        }
        groupByType[itemType] = groupByType[itemType] || [];
        groupByType[itemType].push(itemName);
    }

    let results = {};
    for (const type in groupByType) {
        const names = groupByType[type];
        const countResult = await dispatcher.runTask(new SoloTask("CountInventoryItem", {
            "gridScreenName": type,
            "itemNames": names,
        }));
        Object.assign(results, countResult);
    }

    // 逻辑：既不在 API 的结果里，也不在 OCR 已经实时识别到的结果里
    const missingItems = normalizedItemList.filter(name => 
        !(name in results) && !(name in sharedOcrResults)
    );
    if (missingItems.length > 0) {
        // 即使在白天，大多数情况也能识别成功，因此不作为常态机制，仅在失败时使用
        log.info(`${missingItems.length}个物品识别失败，调整时间和视角后重试`);
        await genshin.returnMainUi();
        await genshin.setTime(0, 0);
        await sleep(300);
        moveMouseBy(0, 9280);
        await sleep(300);

        // 只针对缺失的物品进行重试
        for (const type in groupByType) {
            const namesToRetry = groupByType[type].filter(name => missingItems.includes(name));
            if (namesToRetry.length > 0) {
                const retryCountResult = await dispatcher.runTask(new SoloTask("CountInventoryItem", {
                    "gridScreenName": type,
                    "itemNames": namesToRetry,
                }));
                // 将重试结果合并到原始 results 中
                Object.assign(results, retryCountResult);
            }
        }

        // 恢复视角
        await genshin.returnMainUi();
        keyPress("MBUTTON");
    }
    return results;
}

function getItemCD(itemName) {
    if (Object.keys(materialMetadata).length === 0) {
        Object.assign(materialMetadata, parseCsvTextToDict());
    }
    return materialMetadata[itemName]?.cd || null;
}
