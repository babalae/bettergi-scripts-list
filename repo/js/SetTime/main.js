(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    //拖动鼠标
    async function moveMouseSmoothly(x1, y1, x2, y2) {
        const deltaX = x2 - x1;
        const deltaY = y2 - y1;
        const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));
        const stepX = deltaX / steps;
        const stepY = deltaY / steps;
        await moveMouseTo(x1, y1);
        await leftButtonDown();
        for (let i = 1; i <= steps; i++) {
            const newX = x1 + stepX * i;
            const newY = y1 + stepY * i;
            const validX = Math.round(newX);
            const validY = Math.round(newY);
            await moveMouseTo(validX, validY);
            await sleep(10);
        }
        await leftButtonUp();
    }
    //设定时间
    async function settime(time) {
        const centerX = 1441;
        const centerY = 501;
        const radius = 100;
        let angle;
        angle = (90 + time * 15) % 360;
        angle = angle >= 0 ? angle : 360 + angle;
        const angle1 = (angle + 90) % 360;
        const angle2 = (angle + 180) % 360;
        const angle3 = (angle + 270) % 360;
        const radians = angle * (Math.PI / 180);
        const radians1 = angle1 * (Math.PI / 180);
        const radians2 = angle2 * (Math.PI / 180);
        const radians3 = angle3 * (Math.PI / 180);
        const x = centerX + radius * Math.cos(radians);
        const y = centerY + radius * Math.sin(radians);
        const x1 = centerX + radius * Math.cos(radians1);
        const y1 = centerY + radius * Math.sin(radians1);
        const x2 = centerX + radius * Math.cos(radians2);
        const y2 = centerY + radius * Math.sin(radians2);
        const x3 = centerX + radius * Math.cos(radians3);
        const y3 = centerY + radius * Math.sin(radians3);

        // 输出最终的坐标
        await sleep(2000);
        await moveMouseSmoothly(centerX,centerY, x1,y1);
        await sleep(2000);
        await moveMouseSmoothly(centerX,centerY, x2,y2);
        await sleep(2000);
        await moveMouseSmoothly(centerX,centerY, x3,y3);
        await sleep(2000);
        await moveMouseSmoothly(centerX,centerY, x,y);
    }
    //设置时间
    log.info('设置时间到{xy}点',settings.time);
    await keyPress("Escape");
    await sleep(1000);
    await click(50,700); 
    await sleep(2000);
    await settime(settings.time)
    await sleep(3000);
    await click(1500,1000);//确认
    await sleep(20000);
    await keyPress("Escape");
    await sleep(2000);
    await keyPress("Escape");
    await sleep(2000);
})();