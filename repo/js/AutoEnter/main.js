//获取自定义配置
const enterMode = settings.enterMode || "进入他人世界";
const enteringUID = settings.enteringUID;
const permissionMode = settings.permissionMode || "无条件通过";
const nameToPermit1 = settings.nameToPermit1;
const nameToPermit2 = settings.nameToPermit2;
const nameToPermit3 = settings.nameToPermit3;
const timeOut = +settings.timeout || 5;
const maxEnterCount = +settings.maxEnterCount || 3;


const enterUIDRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/enterUID.png"));
const searchRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/search.png"));
const requestEnterRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/requestEnter.png"));
const requestEnter2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/requestEnter.png"), 1480, 300, 280, 600);
const yUIRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/yUI.png"));
const allowEnterRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/allowEnter.png"), 1250, 300, 150, 130);
const targetsPath = "targets";
let enterCount = 0;
let targetsRo;
let checkToEnd = false;
// 先初始化空数组
let targetList = [];
let enteredPlayers = [];

(async function () {
    setGameMetrics(1920, 1080, 1);
    const start = new Date();
    log.info(`当前模式为：${enterMode}`);

    // 依次判断并加入
    if (settings.nameToPermit1) targetList.push(settings.nameToPermit1);
    if (settings.nameToPermit2) targetList.push(settings.nameToPermit2);
    if (settings.nameToPermit3) targetList.push(settings.nameToPermit3);

    // 获取指定文件夹下所有文件
    let targetPngs = await readFolder(targetsPath, false);

    // 生成 targetsRo（使用 for...of）
    targetsRo = [];
    for (const f of targetPngs) {
        log.info(`找到文件${f.fullPath}`);
        if (f.fullPath.endsWith('.png')) {
            const mat = file.ReadImageMatSync(f.fullPath);
            const ro = RecognitionObject.TemplateMatch(mat, 650, 320, 350, 60);
            const baseName = f.fileName.replace(/\.png$/i, '');
            targetsRo.push({ ro, baseName });
        }
    }


    log.info(`加载完成共${targetPngs.length}个目标`);

    while (new Date() - start < timeOut * 60 * 1000) {
        if (enterMode === "进入他人世界") {
            //检验队伍编号
            const playerSign = await getPlayerSign();
            await sleep(500);
            if (playerSign != 0) {
                log.info(`加入世界成功，在队伍中的编号为${playerSign}`);
                break;
            } else {
                log.error(`不处于多人世界，开始尝试加入`);
                await genshin.returnMainUi();
                await sleep(500);
            }
            //反复敲门进入他人世界
            //我要cia进来llo
            if (enteringUID) {
                await keyPress("F2");
                //点击输入uid
                await sleep(2000);
                if (!await findAndClick(enterUIDRo)) {
                    await genshin.returnMainUi();
                    continue;
                }
                await sleep(1000);
                inputText(enteringUID);
                //点击搜索
                await sleep(1000);
                if (!await findAndClick(searchRo)) {
                    await genshin.returnMainUi();
                    continue;
                }
                //判断是否成功搜索
                if (await confirmSearchResult()) {
                    await genshin.returnMainUi();
                    continue;
                }

                //点击申请加入
                await sleep(500);
                if (!await findAndClick(requestEnterRo)) {
                    await genshin.returnMainUi();
                    continue;
                }
                //等待加入完成
                await waitForMainUI(true, 20 * 1000);
            } else {
                log.error("未填写有效的uid，请检查后重试");
                break;
            }
        } else {
            //等待他人进入世界
            if (enterCount < maxEnterCount) {
                if (await isYUI()) {
                    keyPress("VK_ESCAPE");
                }
                await genshin.returnMainUi();
                keyPress("Y");
                await sleep(250);
                if (await isYUI()) {
                    log.info("处于y界面开始识别");
                    let attempts = 0;
                    while (attempts < 5) {
                        attempts++;
                        if (permissionMode === "无条件通过") {
                            //无需筛选，全部通过
                            if (await findAndClick(allowEnterRo)) {
                                //等待加入完成
                                await waitForMainUI(true, 20 * 1000);
                                enterCount++;
                                break;
                            }
                        } else {
                            //需要筛选，开始识别第一行申请
                            const result = await recognizeRequest();
                            if (result) {
                                if (await findAndClick(allowEnterRo)) {
                                    //等待加入完成
                                    await waitForMainUI(true, 20 * 1000);
                                    enterCount++;
                                    log.info(`允许${result}加入世界`);
                                    // 把 result 加入 enteredPlayers，并立即去重
                                    enteredPlayers = [...new Set([...enteredPlayers, result])];
                                    await sleep(1000);
                                    if (await isYUI()) {
                                        keyPress("VK_ESCAPE");
                                        await genshin.returnMainUi();
                                    }
                                    break;
                                } else {
                                    if (await isYUI()) {
                                        keyPress("VK_ESCAPE");
                                        await genshin.returnMainUi();
                                    }
                                }

                            }
                        }
                        await sleep(500);
                    }
                }
                if (await isYUI()) {
                    keyPress("VK_ESCAPE");
                    await genshin.returnMainUi();
                }
            }
            if (enterCount >= maxEnterCount || checkToEnd) {
                log.info("准备结束js");
                checkToEnd = true;
                if (await isYUI()) {
                    keyPress("VK_ESCAPE");
                    await genshin.returnMainUi();
                }
                await sleep(20000);
                if (await findTotalNumber() === maxEnterCount + 1) {
                    break;
                } else {
                    enterCount--;
                }
            }
        }

    }

}
)();

//等待主界面状态
async function waitForMainUI(requirement, timeOut = 60 * 1000) {

    log.info(`等待至多${timeOut}毫秒`)
    const startTime = Date.now();
    while (Date.now() - startTime < timeOut) {
        const mainUIState = await isMainUI();
        if (mainUIState === requirement) return true;

        const elapsed = Date.now() - startTime;
        const min = Math.floor(elapsed / 60000);
        const sec = Math.floor((elapsed % 60000) / 1000);
        const ms = elapsed % 1000;
        log.info(`已等待 ${min}分 ${sec}秒 ${ms}毫秒`);

        await sleep(1000);
    }
    log.error("超时仍未到达指定状态");
    return false;
}

//检查是否在主界面
async function isMainUI() {
    // 修改后的图像路径
    const imagePath = "assets/RecognitionObject/MainUI.png";
    // 修改后的识别区域（左上角区域）
    const xMin = 0;
    const yMin = 0;
    const width = 150; // 识别区域宽度
    const height = 150; // 识别区域高度
    let template = file.ReadImageMatSync(imagePath);
    let recognitionObject = RecognitionObject.TemplateMatch(template, xMin, yMin, width, height);

    // 尝试次数设置为 5 次
    const maxAttempts = 5;

    let attempts = 0;
    while (attempts < maxAttempts) {
        try {

            let gameRegion = captureGameRegion();
            let result = gameRegion.find(recognitionObject);
            gameRegion.dispose();
            if (result.isExist()) {
                //log.info("处于主界面");
                return true; // 如果找到图标，返回 true
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);

            return false; // 发生异常时返回 false
        }
        attempts++; // 增加尝试次数
        await sleep(50); // 每次检测间隔 50 毫秒
    }
    return false; // 如果尝试次数达到上限或取消，返回 false
}

//获取联机世界的当前玩家标识
async function getPlayerSign() {
    const picDic = {
        "1P": "assets/RecognitionObject/1P.png",
        "2P": "assets/RecognitionObject/2P.png",
        "3P": "assets/RecognitionObject/3P.png",
        "4P": "assets/RecognitionObject/4P.png"
    }
    await genshin.returnMainUi();
    await sleep(500);
    const p1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["1P"]), 344, 22, 45, 45);
    const p2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["2P"]), 344, 22, 45, 45);
    const p3Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["3P"]), 344, 22, 45, 45);
    const p4Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["4P"]), 344, 22, 45, 45);
    moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
    const gameRegion = captureGameRegion();
    // 当前页面模板匹配
    let p1 = gameRegion.Find(p1Ro);
    let p2 = gameRegion.Find(p2Ro);
    let p3 = gameRegion.Find(p3Ro);
    let p4 = gameRegion.Find(p4Ro);
    gameRegion.dispose();
    if (p1.isExist()) return 1;
    if (p2.isExist()) return 2;
    if (p3.isExist()) return 3;
    if (p4.isExist()) return 4;
    return 0;
}

async function confirmSearchResult() {
    maxAttempts = 5;
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const gameRegion = captureGameRegion();
        try {
            const result = gameRegion.find(requestEnter2Ro);
            if (result.isExist) {
                return false;                 // 成功立刻返回
            }
        } catch (err) {
        } finally {
            gameRegion.dispose();
        }
        if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
            await sleep(250);
        }
    }
    return true;
}

async function findAndClick(target, maxAttempts = 20) {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const gameRegion = captureGameRegion();
        try {
            const result = gameRegion.find(target);
            if (result.isExist) {
                result.click();
                return true;                 // 成功立刻返回
            }
            log.warn(`识别失败，第 ${attempts + 1} 次重试`);
        } catch (err) {
        } finally {
            gameRegion.dispose();
        }
        if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
            await sleep(250);
        }
    }
    log.error("已达到重试次数上限，仍未找到目标");
    return false;
}

//检查是否在主界面
async function isYUI() {
    // 尝试次数设置为 5 次
    const maxAttempts = 5;
    let attempts = 0;
    while (attempts < maxAttempts) {
        try {
            let gameRegion = captureGameRegion();
            let result = gameRegion.find(yUIRo);
            gameRegion.dispose();
            if (result.isExist()) {
                //log.info("处于Y界面");
                return true; // 如果找到图标，返回 true
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);

            return false; // 发生异常时返回 false
        }
        attempts++; // 增加尝试次数
        await sleep(250); // 每次检测间隔 50 毫秒
    }
    return false; // 如果尝试次数达到上限或取消，返回 false
}

// 确认当前申请是否为目标
async function recognizeRequest() {
    // 1. 模板匹配
    try {
        const gameRegion = captureGameRegion();
        for (const { ro, baseName } of targetsRo) {
            if (gameRegion.find(ro).isExist()) {
                gameRegion.dispose();
                return baseName;
            }
        }
        gameRegion.dispose();
    } catch (err) {
        log.error(`模板匹配异常: ${err.message}`);
    }

    // 2. OCR 仅识别一次，固定区域 650,320,350,60
    try {
        const gameRegion = captureGameRegion();
        const resList = gameRegion.findMulti(
            RecognitionObject.ocr(650, 320, 350, 60)
        );
        gameRegion.dispose();

        let hit = null;
        for (const res of resList) {
            const txt = res.text.trim();
            for (const whiteItem of targetList) {
                if (txt === whiteItem) {
                    hit = whiteItem;
                    break;
                }
            }
            if (hit) break;
        }

        // 如果未命中，输出所有识别结果
        if (!hit) {
            for (const res of resList) {
                log.warn(`识别到"${res.text.trim()}"，不在白名单`);
            }
        }

        return hit; // 命中返回白名单项，未命中返回 null
    } catch (err) {
        log.error(`OCR 识别异常: ${err.message}`);
    }

    return null;
}


// 定义 readFolder 函数
async function readFolder(folderPath, onlyJson) {
    // 新增一个堆栈，初始时包含 folderPath
    const folderStack = [folderPath];

    // 新增一个数组，用于存储文件信息对象
    const files = [];

    // 当堆栈不为空时，继续处理
    while (folderStack.length > 0) {
        // 从堆栈中弹出一个路径
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
                        //log.info(`找到 JSON 文件：${filePath}`);
                    }
                } else {
                    const fileName = filePath.split('\\').pop(); // 提取文件名
                    const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                    files.push({
                        fullPath: filePath,
                        fileName: fileName,
                        folderPathArray: folderPathArray
                    });
                    //log.info(`找到文件：${filePath}`);
                }
            }
        }
        // 将临时数组中的子文件夹路径按原顺序压入堆栈
        folderStack.push(...subFolders.reverse()); // 反转子文件夹路径
    }

    return files;
}

async function findTotalNumber() {
    await genshin.returnMainUi();
    await keyPress("F2");
    await sleep(2000);

    // 定义模板
    const kick2pRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickButton.png"), 1520, 277, 230, 120);
    const kick3pRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickButton.png"), 1520, 400, 230, 120);
    const kick4pRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/kickButton.png"), 1520, 527, 230, 120);

    moveMouseTo(1555, 860); // 防止鼠标干扰
    const gameRegion = captureGameRegion();
    await sleep(200);

    let count = 1; // 先算上自己

    // 依次匹配 2P
    if (gameRegion.Find(kick2pRo).isExist()) {
        log.info("发现 2P");
        count++;
    }

    // 依次匹配 3P
    if (gameRegion.Find(kick3pRo).isExist()) {
        log.info("发现 3P");
        count++;
    }

    // 依次匹配 4P
    if (gameRegion.Find(kick4pRo).isExist()) {
        log.info("发现 4P");
        count++;
    }

    gameRegion.dispose();

    log.info(`当前联机世界玩家总数（含自己）：${count}`);
    return count;
}