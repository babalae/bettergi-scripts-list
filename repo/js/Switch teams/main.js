(async function () {
    setGameMetrics(3840, 2160, 2);
    keyPress("L");
    await sleep(4500);
    click(100, 2050);
    await sleep(800);
    
    for(let i = 0; i < 3; i++){
        await keyMouseScript.runFile(`assets/Team.json`);
        await sleep(800);
    }
    
    click(100, 300);
    await sleep(800);
    click(100, 2050);
    await sleep(800);
    
    for(let i = 1; i < settings.n; i++){
        click(3684, 1078);
        await sleep(800);
    }
    
    click(3200, 2050);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);

    log.info("已切换至第"+ settings.n +"队");
})();