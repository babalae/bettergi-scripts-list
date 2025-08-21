(async function () {
    setGameMetrics(1920, 1080, 2);
    const stepDuration = 50;

    const commonX = 49;
    const ZoomInButton = 428;
    const ZoomOutButton = 654;
    const start = 453;
    const end = 628;

    async function mouseClickNTimes(x, y,n) {
        moveMouseTo(x, y);
        await sleep(100);
        for (let i =0; i < n; i++) {
            leftButtonDown();
            await sleep(50);
            leftButtonUp();
            await sleep(50);
        }
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
    async function setMapZoom(n) {
        await mouseClickNTimes(commonX, ZoomOutButton, 5);
        if (Number.isInteger(n)) {
            mouseClickNTimes(commonX, ZoomInButton, 5 - n);
        } else {
            const targetY = Math.ceil(start + n * 35 - 0.5);
            await mouseClickAndMove(commonX, end, commonX, targetY);
        }
    }
    const zoom = Number(settings.zoom);
    const n = Math.min(Math.max(zoom, 1),6)- 1;
    log.info(`设置大地图缩放为 ${n+1}`);
    await keyPress("M");
    await sleep(1000);
    await setMapZoom(n);
    await sleep(1000);
    await keyPress("Escape");
    await sleep(1000);
})();