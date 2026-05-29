// “派蒙”头像图标裁剪范围：39, 35, 39, 39，完整头像范围：26, 13, 68, 76
const mainUIRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/派蒙.png'), 26, 13, 68, 76);

// “快速编队”图标裁剪范围：1209, 999, 210, 42，完整头像范围：1178, 988, 323, 64
//1300,1005,112,28
const quickSutepRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/快速编队.png'), 1178, 988, 323, 64);

// 第一个角色卡片范围：23, 98, 154, 182，单个宽高：154, 182
// 第一个角色的好感等级范围：66, 247, 70, 21
const characterFriendship = { "x": 66, "y": 247, "width": 70, "height": 21 };
const characterCard = { "width": 154, "height": 182 };

// 角色序号裁剪范围：142, 109, 21, 21; 296, 109, 21, 21; 449, 109, 21, 21; 603, 109, 21, 21;
const characterIndexRos = [
    RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/角色序号1.png'), 133 + characterCard.width * 0, 100, 40, 40),
    RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/角色序号2.png'), 133 + characterCard.width * 1, 100, 40, 40),
    RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/角色序号3.png'), 133 + characterCard.width * 2, 100, 40, 40),
    RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/角色序号4.png'), 133 + characterCard.width * 3, 100, 40, 40),
]
// 等级顺序裁剪范围：115, 33, 100, 30
const levelSortRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/等级顺序.png'), 100, 20, 130, 56);
// 好感度顺序裁剪范围：115, 225, 125, 30
const friendshipSortRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/好感度顺序.png'), 100, 210, 155, 60);
// 排序图标裁剪范围：746, 33, 30, 30
const sortIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/排序图标.png'), 736, 23, 50, 50);


// 好感不存在裁剪范围：76, 247, 50, 20
// 77, 255, 50, 6
// 105, 256, 21, 4
const friendshipNullMat = file.ReadImageMatSync('assets/recognitionObject/好感不存在.png');
// 好感1级裁剪范围：83, 247, 35, 20
// 111, 248, 12, 16
const friendshipOneMat = file.ReadImageMatSync('assets/recognitionObject/好感1级.png');
//好感图标裁剪范围：83, 247, 26, 20
const friendshipIconMat = file.ReadImageMatSync('assets/recognitionObject/好感图标.png');
// 保存配置裁剪范围：368, 1005, 112, 28
const saveSettingsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/recognitionObject/保存配置.png'), 37, 987, 742, 66);


//切换队伍
/**
 * @param {string} partyName
 */
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {
        log.error("未填写好感队的队伍名称");
        await genshin.returnMainUi();
        return false;
    }
    try {
        log.info("正在尝试切换至" + partyName);
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.returnMainUi();
            await genshin.tpToStatueOfTheSeven();
            if (!await genshin.switchParty(partyName)) { throw new Error("切换失败"); }
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        await genshin.returnMainUi();
        return false;
    }
    return true;
}

async function isMainUI() {
    let gameRegion;
    let result;
    let exists;

    await sleep(1000);
    gameRegion = captureGameRegion();
    result = gameRegion.find(mainUIRo);
    gameRegion.dispose();
    exists = result.isExist();
    result.dispose();
    return exists;
}

// 打开队伍配置页面，并判断是否成功打开
async function openPartySetup() {
    let gameRegion;
    let result;
    let exists;

    try {
        for (let index = 0; index < 3; index++) {
            keyPress("L");
            log.info("正在尝试打开队伍配置页面");
            if (!(await isMainUI())) {
                log.info("正在进入队伍配置页面");
                await sleep(2000);
                for (let index = 0; index < 10; index++) {
                    gameRegion = captureGameRegion();
                    result = gameRegion.find(quickSutepRo);
                    gameRegion.dispose();
                    exists = result.isExist();
                    result.dispose();
                    if (!exists) { await sleep(200); }
                    else { return true; }
                }
            }
            log.info("打开队伍配置页面失败，前往七天神像重试");
            await genshin.returnMainUi();
            await genshin.tpToStatueOfTheSeven();
        }
        log.info("多次尝试打开队伍配置页面，均失败");
        return false;
    } catch {
        log.error("打开队伍配置页面失败，可能处于联机模式或其他不可切换状态");
        await genshin.returnMainUi();
        return false;
    }
}

// 打开快速配置，并取消所有出战角色
async function clickQuickSetup() {
    let gameRegion;
    let result;
    let exists;


    gameRegion = captureGameRegion();
    result = gameRegion.find(quickSutepRo);
    gameRegion.dispose();
    if (result.isExist()) { result.click(); result.dispose(); }
    else { result.dispose(); return false; }


    for (let index = 0; index < 10; index++) {
        gameRegion = captureGameRegion();
        result = gameRegion.find(levelSortRo);
        gameRegion.dispose();
        exists = result.isExist();
        result.dispose();
        if (exists) { break; }
        await sleep(200);
    }

    await sleep(1000);
    gameRegion = captureGameRegion();
    for (const indexRo of characterIndexRos) {
        result = gameRegion.find(indexRo);
        if (result.isExist()) { result.click();; }
        result.dispose()
        await sleep(500);
    }
    gameRegion.dispose();

    return true;
}

// 按好感度排序角色
async function sortByFriendship() {
    let gameRegion;
    let result;
    let exists;


    gameRegion = captureGameRegion();
    result = gameRegion.find(levelSortRo);
    if (result.isExist()) { result.click(); }
    gameRegion.dispose();
    result.dispose();

    await sleep(500);

    gameRegion = captureGameRegion();
    result = gameRegion.find(friendshipSortRo);
    if (result.isExist()) { result.click(); }
    gameRegion.dispose();
    result.dispose();

    await sleep(500);

    gameRegion = captureGameRegion();
    result = gameRegion.find(sortIconRo);
    if (result.isExist()) { result.click(); }
    gameRegion.dispose();
    result.dispose();

    await sleep(500);

    // 判断第一个角色是否为无好感或好感为1的角色
    gameRegion = captureGameRegion();
    result = gameRegion.find(RecognitionObject.TemplateMatch(friendshipNullMat,
        characterFriendship.x, characterFriendship.y,
        characterFriendship.width, characterFriendship.height));
    exists = result.isExist();
    result.dispose();
    result = gameRegion.find(RecognitionObject.TemplateMatch(friendshipOneMat,
        characterFriendship.x, characterFriendship.y,
        characterFriendship.width, characterFriendship.height));
    exists = exists || result.isExist();
    result.dispose();
    gameRegion.dispose();
    return exists;
}

async function selectCharacter() {
    let gameRegion;
    let result;
    let exists;
    let number;

    number = 0;
    gameRegion = captureGameRegion();
    out: for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 5; j++) {
            result = gameRegion.find(RecognitionObject.TemplateMatch(friendshipNullMat,
                (characterFriendship.x + characterCard.width * j), (characterFriendship.y + characterCard.height * i),
                characterFriendship.width, characterFriendship.height));
            exists = result.isExist();
            result.dispose();
            if (exists) { continue; }
            result = gameRegion.find(RecognitionObject.TemplateMatch(friendshipIconMat,
                (characterFriendship.x + characterCard.width * j), (characterFriendship.y + characterCard.height * i),
                characterFriendship.width, characterFriendship.height));
            if (result.isExist()) {
                result.click();
                number++;
                await sleep(500);
            }
            result.dispose();
            if (number >= 4) { break out; }
        }
    }
    gameRegion.dispose();
    if (number < 4) {
        log.warn(`仅选中 ${number} 名角色，少于预期的 4 人；可能候选角色不足或图标识别失败`);
    }

    await sleep(1000);
    gameRegion = captureGameRegion();
    result = gameRegion.find(saveSettingsRo);
    if (result.isExist()) { result.click(); }
    else {
        result.dispose();
        gameRegion.dispose();
        log.error("未找到“保存配置”按钮，可能没有任何角色被选中");
        return false;
    }
    result.dispose();
    gameRegion.dispose();

    await genshin.returnMainUi();
    return true;
}

async function main() {
    await genshin.returnMainUi();
    // 等待切换到目标队伍
    if (!(await switchPartyIfNeeded(settings.partyName))) { return false; }

    // 打开队伍配置页面
    if (!(await openPartySetup())) { return false; }

    // 点击“快速编队”，并取消所有出战角色
    if (!(await clickQuickSetup())) { return false; }

    // 点击“等级顺序”，选择“好感度顺序”，点击“排序”图标，让排序按好感度从低到高排序，检查首位角色是否为好感等级为1或者无好感等级（主角或奇偶）的角色
    if (!(await sortByFriendship())) { return false; }

    // 从左往右，从上往下，依次选择角色，排除无好感等级的角色，若好感等级未满级角色低于4人，则将不可避免的编入好感满级角色
    // 点击“保存配置”，“保存配置”按钮在未选择角色时不显示，按ESC键退出队伍配置页面
    if (!(await selectCharacter())) { return false; }

}

(async function () {
    try {
        await main();
    } catch { log.info("出错了！"); }
    await genshin.returnMainUi();
})();