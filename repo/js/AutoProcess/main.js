// main.js

const settingsInput = settings.process

const FoodItems = {
    1: { name: '面粉', coordinate: [240, 260] },
    2: { name: '兽肉', coordinate: [435, 260] },
    3: { name: '鱼肉', coordinate: [630, 260] },
    4: { name: '神秘肉加工产物', coordinate: [825, 260] },
    5: { name: '奶油', coordinate: [1020, 260] },
    6: { name: '熏禽肉', coordinate: [1215, 260] },
    7: { name: '黄油', coordinate: [1410, 260] },
    8: { name: '火腿', coordinate: [1605, 260] },
    9: { name: '糖', coordinate: [240, 500] },
    10: { name: '香辛料', coordinate: [435, 500] },
    11: { name: '蟹黄', coordinate: [630, 500] },
    12: { name: '果酱', coordinate: [825, 500] },
    13: { name: '奶酪', coordinate: [1020, 500] },
    14: { name: '培根', coordinate: [1215, 500] },
    15: { name: '香肠', coordinate: [1410, 500] }
};

const coordinates = {
    process: [1350, 64],
    claimAll: [327, 1367],
    cook: [2250, 1368],
    amountStart: [990, 790],
    confirm: [1577, 1011]
}


function validateAndStoreNumbers(input) {
    // 定义存储结果的数组
    let storedNumbers = [];

    // 使用正则表达式检测是否符合期望格式
    const regex = /^(\b([1-9]|1[0-5])\b)(, (\b([1-9]|1[0-5])\b))*$/;

    // 检测输入字符串是否符合正则表达式
    if (regex.test(input)) {
        // 将输入字符串按逗号和空格分割成数组
        const numbers = input.split(', ');

        // 将分割后的数字字符串转换为整数并存储到数组中
        storedNumbers = numbers.map(Number);

        return storedNumbers;
    } else {
        return false
    }

    
}

async function QucikCook() {
    // 点击Cook
    click(...coordinates.cook);
    await sleep(100);   // 等待窗口弹出

    // 选中左边点
    moveMouseTo(...coordinates.amountStart);
    await sleep(100);
    leftButtonDown();
    await sleep(50);

    // 向右滑动
    moveMouseBy(1200, 0);
    await sleep(200);
    leftButtonUp();
    await sleep(100);

    // 点击弹出页的确认
    click(...coordinates.confirm);
    await sleep(500);

    // 点击空白处关闭
    click(...coordinates.confirm);
    await sleep(200);
}

async function AutoPath(locationName) {
    try {
    let filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);

        return true;
    } catch (error) {
        log.error(`执行 ${locationName} 路径时发生错误`);
        log.error(error.message);
    }
    
    return false;
}

(async function () {

    // 提醒别带内鬼
    log.warn("建议不要带某些靠近能灭火的\"内鬼\"角色.")

    
    // 判断设置合法性
    var items = [];

    if (settingsInput) {
        items = validateAndStoreNumbers(settingsInput);
        if (items) {
            const names = items
                .map(id => FoodItems[id] ? FoodItems[id].name : null) // 检查是否存在
                .filter(name => name !== null) // 过滤掉不存在的项
                .join(', ');
            log.info("已从设置中读取内容: ")|
            await sleep(100)
            log.info(names)
            
        } else {
            log.info("设置所填内容不合法, 请仔细阅读设置要求, 或者在群里问其他玩家")

            return
        }
        
    } else {
        log.info("还没有设置需要制作食材呢")
        log.info("请在调试器里添加本脚本->右键JS脚本->修改JS脚本自定义配置.")

        return
    }
    
    // 前往灶台
    if (!await AutoPath("找厨房")) {
        return
    }


    //设置脚本环境的游戏分辨率和DPI缩放
    setGameMetrics(2560, 1440, 1.5);

    // 交互, 进入烹饪界面
    await sleep(500)
    keyPress("F")
    await sleep(1000)
    click(...coordinates.process)
    await sleep(1000)

    // 收菜
    click(...coordinates.claimAll)
    await sleep(500)
    click(...coordinates.claimAll)
    await sleep(500)

    // 批量Cook
    for (let item of items) {
        // 选择目标
        click(...FoodItems[item].coordinate)
        await sleep(300)

        await QucikCook()

        log.info(`${FoodItems[item].name} = 制作完成 :)`);
        await sleep(200)
    }

    // 返回主菜单
    await genshin.returnMainUi()

    // 后退一下, 防止某些内鬼灭火
    keyDown("S")
    await sleep(2000)
    keyUp("S")

    log.info("┌────────────────────────────┐")
    log.info(" 感谢您的使用, 任务已全部完成")
    log.info(" 拜拜")
    log.info(" Done.")
    log.info("└────────────────────────────┘")



})();