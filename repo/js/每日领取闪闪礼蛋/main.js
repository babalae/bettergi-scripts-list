async function click_text(t) {
    for (var i = 0; i < 10; ++i) {
        const img = captureGameRegion();
        const ocr_result = img.findMulti(RecognitionObject.ocr(1170, 328, 494, 594));
        for (var j = 0; j < ocr_result.count; ++j) {
            const res = ocr_result[j];
            if (res.text.includes(t)) {
                log.info("Found text {text} at ({x}, {y})", res.text, res.x, res.y);
                keyDown("VK_MENU");
                await sleep(500);
                moveMouseTo(res.x, res.y);
                leftButtonClick();
                await sleep(500);
                keyUp("VK_MENU");
                return;
            }
        }
        await sleep(1000);
    }
    log.warn("Couldn't find text {t}", t);
}

(async function() {
    const dry_run = false;

    const coordinates = [
        [551, 153],
        [1087, 161],
        [881, 341],
        [1342, 357],
        [472, 572],
        [572, 721]
    ];
    const cancel_coordinate = [1497, 676];

    const seed = Date.now();
    const rand = BigInt(seed) * 1664525n + 1013904223n;
    const picked_index = rand % BigInt(coordinates.length);
    log.info("随机到第{n}个蛋", picked_index);
    const picked_coordinate = dry_run ? cancel_coordinate : coordinates[picked_index];

    await genshin.returnMainUi();
    await pathingScript.runFile("assets/pathing.json");

    await sleep(500);

    await click_text("察尔瓦");

    await genshin.chooseTalkOption("让我挑一枚");

    await sleep(4000);
    moveMouseTo(picked_coordinate[0], picked_coordinate[1]);
    await sleep(100);
    leftButtonClick();
    await sleep(3000);

    await genshin.returnMainUi();
})();