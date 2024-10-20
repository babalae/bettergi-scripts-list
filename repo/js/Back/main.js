(async function () {
    for (var i=0;i<3;i++)
        { 
            keyPress("VK_ESCAPE");
            await sleep(1000);
        }
    keyPress("VK_RETURN");
    await sleep(500);
    keyPress("VK_ESCAPE");
    await sleep(500);
    log.info("已返回主界面");
})();