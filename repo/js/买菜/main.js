// main.js


let NPC_list = {};

async function setTime(hour, minute) {
    // 关于setTime
    // 原作者: Tim
    // 脚本名称: SetTimeMinute - 精确调整游戏时间到分钟
    // 脚本版本: 1.0
    // Hash: f5c2547dfc286fc643c733d630f775e8fbf12971

    // 设置游戏分辨率和DPI缩放
    setGameMetrics(1920, 1080, 1);
    // 圆心坐标
    const centerX = 1441;
    const centerY = 501.6;
    // 半径
    const r1 = 30;
    const r2 = 150;
    const r3 = 300;
    const stepDuration = 50; 

    function getPosition(r, index) {
        let angle = index * Math.PI / 720;
        return [Math.round(centerX + r * Math.cos(angle)), Math.round(centerY + r * Math.sin(angle))];
    }
    async function mouseClick(x, y) {
        moveMouseTo(x, y);
        await sleep(50);
        leftButtonDown();
        await sleep(50);
        leftButtonUp();
        await sleep(stepDuration);
    }
    async function mouseClickAndMove(x1, y1, x2, y2) {
        moveMouseTo(x1, y1);
        await sleep(50);
        leftButtonDown();
        await sleep(50);
        moveMouseTo(x2, y2);
        await sleep(50);
        leftButtonUp();
        await sleep(stepDuration);
    }
    async function setTime(hour, minute) {
        const end = (hour + 6) * 60 + minute-20;
        const n = 3;
        for (let i = - n + 1; i < 1; i++) {
            let [x,y] = getPosition(r1, end + i * 1440 / n);
            await mouseClick(x, y);
        }
        let [x1,y1] = getPosition(r2, end + 5);
        let [x2, y2] = getPosition(r3, end + 20 + 0.5);
        await mouseClickAndMove(x1, y1, x2, y2);
    }

    let h = Math.floor(hour+minute/60);
    const m = Math.floor(hour*60+minute)-h*60;
    h = ((h % 24) + 24) % 24;
    log.info(`设置时间到 ${h} 点 ${m} 分`);
    await keyPress("Escape");
    await sleep(1000);
    await click(50,700); 
    await sleep(2000);
    await setTime(h, m);
    await sleep(1000);
    await click(1500,1000);//确认
    await sleep(18000);
    await keyPress("Escape");
    await sleep(2000);
    await keyPress("Escape");
    await sleep(2000);

    // 最后恢复到听雨的分辨率
    setGameMetrics(2560, 1440, 1.5);
}


// 快速购买
async function QucikBuy(count = 1) {

    for (let i = 0; i < count; i++) {
        // 点击购买/兑换
        click(2230, 1370);
        await sleep(100);   // 等待窗口弹出

        // 选中左边点
        moveMouseTo(1000, 806);
        await sleep(100);
        leftButtonDown();
        await sleep(50);

        // 向右滑动
        moveMouseBy(1200, 0);
        await sleep(200);
        leftButtonUp();
        await sleep(100);

        // 点击弹出页的购买/兑换 1560, 1040
        click(1560, 1040);
        await sleep(200);

        // 点击空白处关闭
        leftButtonClick();
        await sleep(1000);

    }
}

// 跳过对话
async function Spik(count) {
    await sleep(100);
    for (let i = 0; i < count; i++) {
        keyPress("VK_F");
        await sleep(2000);
    }
}

async function AutoPath(locationName) {
    try {
    let filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
        sleep(2000);

        return true;
    } catch (error) {
        log.error(`执行 ${locationName} 路径时发生错误`);
        log.error(error.message);
    }
    
    return false;
}

async function AutoBuy(npc) {
    let npc_name = NPC_list[npc].npc_name;

    log.info(`自动寻路, 前往 ${npc_name} 所在`)

    if (await AutoPath(NPC_list[npc].location_name)) {

        await Spik(NPC_list[npc].spik_count);

        log.info("已打开商店界面")

        await QucikBuy(NPC_list[npc].item_count);

        await sleep(1000);
        genshin.returnMainUi();
        log.info(`${npc_name} 的商品购买完毕`)


    } else {
        log.error("寻路错误, 跳过购买任务")  
    };
}

(async function () {

    // ==================== 加载NPC列表 ===================
    
    try {
        const NPCText = file.readTextSync("NPC_list.json");
        NPC_list = JSON.parse(NPCText);
        log.info("NPC信息加载完成");
    } catch (e) {
        log.error("NPC信息文件损坏，脚本终止");
        return;
    }

    //设置脚本环境的游戏分辨率和DPI缩放
    setGameMetrics(2560, 1440, 1.5);

    log.info("┌───────────────────────────────────────────────────┐");
    log.info(" 在设置中勾选禁用的NPC.")
    await sleep(400);
    log.info(" 调试器添加脚本后, 右键脚本->修改JS脚本自定义配置.")
    await sleep(400);
    log.info(" 但是, BetterGI有Bug, 只能现实9个设置...")
    await sleep(400);
    log.info(" 要不, 你直接删掉不想要的NPC文件吧, 删除方法: ")
    await sleep(400);
    log.info(" JS脚本->打开目录->进入当前项目/assets/AutoPath文件夹")
    await sleep(400);
    log.info("└───────────────────────────────────────────────────┘")
    await sleep(400);


    try {
        for (let key in NPC_list) {
    
            let name = NPC_list[key].npc_name;
            
            log.info(`======== 当前目标NPC: ${name} ========`);
            await sleep(400);
            
            if (settings[key]) {
                log.info(` 玩家已标记, 跳过`);
                continue;
            };
        
            if (NPC_list[key].daytimeOnly == 1) {
                log.info("当前NPC只有白天才刷新, 调整时间");
                await sleep(3000);
                await setTime(9, 0);
            } else if (NPC_list[key].daytimeOnly == 2) {
                log.info("当前NPC只有晚上更合适, 调整时间");
                await sleep(3000);
                await setTime(20, 0);
            }

             
    
            await AutoBuy(key);
            await sleep(2000);
        };
    
    } catch (e) {
        log.error(`发生异常:  ${e.message}`);
        await sleep(3000);
    } finally {

        log.info("┌────────────────────────────┐")
        log.info(" 感谢您的使用, 任务已全部完成")
        log.info(" 拜拜")
        log.info(" Done.")
        log.info("└────────────────────────────┘")

    }
})();