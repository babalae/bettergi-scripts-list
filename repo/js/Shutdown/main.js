(async function () {
    keyDown("LWIN");
    keyDown("X");
    await sleep(50);
    keyUp("LWIN");
    keyUp("X");
    await sleep(3000);
    keyPress("LSHIFT");
    await sleep(50);
    keyPress("LCONTROL");    
    await sleep(50);
    keyPress("U");
    await sleep(1000);
    keyPress("U");
    await sleep(50);
    keyPress("RETURN");
})();
