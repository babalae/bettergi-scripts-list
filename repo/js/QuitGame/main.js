(async function () {
    keyDown("MENU");
    keyDown("F4");
    await sleep(50);
    keyUp("MENU");
    keyUp("F4");
    await sleep(1500);
})();