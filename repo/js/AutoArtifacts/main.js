(async function () {

    // 启用自动拾取的实时任务
    const startTime = Date.now();
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    async function logTaskStart() {
        const messages = [
            '确保地图的按键为M键',
            '左上角派蒙头像未被其他悬浮窗遮挡',
            '游戏以60帧运行',
            '游戏视角灵敏度保持默认为3',
            '运行时是琳妮特前台且拥有双风共鸣',
            '元素共鸣需要四个角色组队触发，仅两个风系角色无效',
            '不要带其他有移速加成的角色'
        ];

        for (let message of messages) {
            log.info(message); 
            await sleep(1000);
        }
    }

    async function KeyMouse(locationName, sec, x, y) 
    {
        if (x !== undefined && y !== undefined) {
            log.info(`前往 ${locationName}`);
            await genshin.tp(x, y);
            await sleep(1000);
        }
    
        let filePath = `assets/KeyMouse/${locationName}.json`;
        await keyMouseScript.runFile(filePath);
        await sleep(sec * 1000); // 将秒转换为毫秒
    }

    async function AutoPath(locationName) {
        let filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
    }

    function logTimeTaken(startTime) {
        const currentTime = Date.now();
        const totalTimeInSeconds = (currentTime - startTime) / 1000;
        const minutes = Math.floor(totalTimeInSeconds / 60);
        const seconds = totalTimeInSeconds % 60;
        const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
        log.info(`当前运行总时长：${formattedTime}`);
    }

    await logTaskStart();

    log.info('前往地区：璃月')
    await KeyMouse('地中之盐北', 1, -321, 1470);
    await KeyMouse('无相之冰', 1, -410, 1161);
    await KeyMouse('解除冰元素附着', 4, -255, 629);
    await KeyMouse('地中之盐', 2, -164, 1183);
    await KeyMouse('望舒客栈', 2, 330, 874);
    await AutoPath('荻花洲');
    await KeyMouse('荻花洲西', 2, 730, 1062);
    await KeyMouse('望舒客栈西', 2, 730, 1062);
    await KeyMouse('轻策庄', 2, 547, 1767);
    await AutoPath('轻策庄');
    await KeyMouse('沉玉谷码头', 2, 1113, 1948);
    await KeyMouse('沉玉谷狗洞', 2, 1114, 1948);
    await KeyMouse('奥藏山', 2, 1451, 1029);
    await KeyMouse('酒窖', 2, 730, 1062);
    await AutoPath('酒窖');
    await AutoPath('渌华池');
    logTimeTaken(startTime);

    log.info('前往地区：稻妻')
    await KeyMouse('神无冢1', 2, -3405, -3534);
    await KeyMouse('神无冢2', 2, -3405, -3534);
    await KeyMouse('炉心1', 2, -3289, -3654);
    await KeyMouse('炉心2', 2, -3289, -3654);
    await KeyMouse('绝美我心', 2, -1315, -3776);
    await AutoPath('望泷村西南');
    await KeyMouse('沉眠之庭1', 2, -4185, -4244);
    await KeyMouse('沉眠之庭2', 2, -4185, -4244);
    await KeyMouse('浅濑神社', 2, -3698, -4689);
    await KeyMouse('鹤观神像1', 2, -3269, -6135);
    await KeyMouse('鹤观神像2', 2, -3269, -6135);
    await KeyMouse('黄金王兽北', 2, -2612, -6507);
    logTimeTaken(startTime);

    log.info('前往地区：须弥')
    await KeyMouse('须弥城', 2, 2786, -503);
    await KeyMouse('须弥城东', 2, 2694, -416);
    await KeyMouse('须弥城西北1', 2, 2876, -292);
    await KeyMouse('须弥城西北2', 2, 2876, -292);
    await AutoPath('化城郭西');
    await AutoPath('维摩庄');
    await KeyMouse('圣显厅南', 2, 4271, -1666);
    await KeyMouse('圣显厅西', 2, 4775, -1437);
    await KeyMouse('神的棋盘', 2, 5759, -1309);
    logTimeTaken(startTime);

    log.info('前往地区：枫丹')
    await KeyMouse('枫丹廷1', 2, 4509, 3630);
    await KeyMouse('枫丹廷2', 2, 4509, 3630);
    await KeyMouse('欧庇克莱歌剧院东南', 2, 3595, 3254);
    await KeyMouse('芒索斯山东1', 2, 4985, 4463);
    await KeyMouse('芒索斯山东2', 2, 4985, 4463);
    await KeyMouse('学术会堂', 2, 4144, 4424);
    await KeyMouse('科学院北', 2, 4434, 5092);
    await KeyMouse('科学院西北1', 2, 4624, 4952);
    await KeyMouse('科学院西北2', 2, 4624, 4952);
    await KeyMouse('放大地图', 1);
    await KeyMouse('科学院西', 2, 4498, 4711);
    await KeyMouse('缩小地图', 1);
    await KeyMouse('海露港', 6, 4984, 1700);
    await KeyMouse('佩特莉可神像', 2, 4454, 1255);
    await KeyMouse('佩特莉可镇', 2, 4322, 1172);
    logTimeTaken(startTime);

    log.info('前往地区：纳塔')
    await KeyMouse('楚汶市集1', 2, 9059, -1847);
    await KeyMouse('楚汶市集2', 2, 9059, -1847);
    await KeyMouse('竞技场东', 2, 8734, -1856);
    await KeyMouse('中鸵鸟', 1, 8242, -1735);
    await KeyMouse('北鸵鸟', 1, 8396, -1216);
    await KeyMouse('虹灵的净土', 2, 9038, -2428);
    await KeyMouse('流泉之众', 2, 8918, -2678);
    await KeyMouse('悬木人', 2, 8433, -2108);
    logTimeTaken(startTime);

    log.info('前往地区：其他')
    await KeyMouse('精石铜城', 2, 6323, 821);
    await AutoPath('塔尼特营地');
    await AutoPath('新枫科院宿舍');
    // 计算并输出总时长
    const endTime = Date.now();
    const totalTimeInSeconds = (endTime - startTime) / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = totalTimeInSeconds % 60;
    const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
    log.info(`自动狗粮运行总时长：${formattedTime}`);
})();
