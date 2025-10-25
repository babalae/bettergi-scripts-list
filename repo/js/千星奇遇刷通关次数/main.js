(async function () {
    while(true) {
        keyPress("P");
        await sleep(500);
        keyPress("F");
        await sleep(500);
        click(1727, 1020); 
        await sleep(500);
    }
})();