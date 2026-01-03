
/**
 * @author Ayaka-Main
 * @link   https://github.com/Patrick-Ze
 * @description 对背包API的易用包装。使用方法: 将此文件放在脚本目录下的 lib 文件夹中，然后在你的脚本开头处执行下面这行:
   eval(file.readTextSync("lib/inventory.js"));
 */

let scriptContext = {
    version: "1.0",
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
 * 获取背包中物品的数量。
 * 如果没有找到，则为-1；如果找到了但数字识别失败，则为-2
 *
 * 暂不支持 冷鲜肉, 红果果菇, 奇异的「牙齿」
 */
async function getItemCount(itemList=null, retry=true) {
    if (Object.keys(materialMetadata).length === 0) {
        Object.assign(materialMetadata, parseCsvTextToDict());
    }

    if (typeof itemList === "string") {
        itemList = [itemList];
    } else if (itemList == null || itemList.length === 0) {
        itemList = Object.keys(materialMetadata);
    }
    const renameMap = {"晶蝶": "晶核", "「冷鲜肉」":"冷鲜肉"};
    const groupByType = {};
    for (const itemName of itemList) {
        const metadata = materialMetadata[itemName];
        const itemType = metadata?.type ?? "Materials";
        if (!metadata?.type) {
            log.warn("未查找到{0}所属的背包分类，默认它是{1}", itemName, itemType);
        }
        const normalizedName = renameMap[itemName] || itemName;
        groupByType[itemType] = groupByType[itemType] || [];
        groupByType[itemType].push(normalizedName);
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
    if (retry && itemList.some(item => !(item in results))) {
        // 即使在白天，大多数情况也能识别成功，因此不作为常态机制，仅在失败时使用
        log.info("部分物品识别失败，调整时间和视角后重试");
        await genshin.returnMainUi();
        await genshin.setTime(0, 0);
        await sleep(300);
        moveMouseBy(0, 9280);
        await sleep(300);
        const retryResults = await getItemCount(itemList, false);
        await genshin.returnMainUi();
        keyPress("MBUTTON");
        return retryResults;
    }
    const finalResults = {};
    for (const itemName of itemList) {
        const normalizedName = renameMap[itemName] || itemName;
        // 如果某个元素没有找到，则不会存在对应的键值，赋值为-1以保持与单个物品查找时一致的行为
        finalResults[itemName] = results[normalizedName] ?? -1;
    }
    return finalResults;
}

function getItemCD(itemName) {
    if (Object.keys(materialMetadata).length === 0) {
        Object.assign(materialMetadata, parseCsvTextToDict());
    }
    return materialMetadata[itemName]?.cd || null;
}
