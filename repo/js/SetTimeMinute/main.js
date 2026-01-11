(async function () {
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
    const hour = Number(settings.hour);
    const minute = Number(settings.minute);
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
})();