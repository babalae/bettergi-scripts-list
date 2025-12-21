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

function ocr_region(img, x, y, w, h) {
    const ocr_result = img.findMulti(RecognitionObject.ocr(x, y, w, h));
    var texts = [];
    for (var i = 0; i < ocr_result.count; ++i) {
        texts.push(ocr_result[i].text);
    }
    return texts;
}

(async function() {
    const dry_run = false;

    const stuff_to_buy = settings.stuff_to_buy.split(" ").filter(i => i);
    const buy_all = !settings.stuff_to_buy || stuff_to_buy.length === 0;
    if (buy_all) {
        log.info("准备购买所有商品");
    } else {
        log.info("准备购买商品：{stuff_to_buy}", stuff_to_buy);
    }
    await genshin.returnMainUi();
    await pathingScript.runFile("assets/pathing.json");

    await sleep(500);

    await click_text("清子");
    await genshin.chooseTalkOption("都卖些什么", 3);
    await genshin.chooseTalkOption("", 1);
    await sleep(1000);

    const MAX_ITEMS = 5;

    var img = captureGameRegion();
    var items_bought = [];
    while (true) {
        var bought_something = false;
        for (var i = 0; i < MAX_ITEMS; ++i) {
            const product_name_x = 224;
            const product_name_y = 126 + 115 * i;
            const product_name_w = 180;
            const product_name_h = 48;

            const product_stock_x = 1100;
            const product_stock_w = 150;

            const product_name = ocr_region(img, product_name_x, product_name_y, product_name_w, product_name_h)[0];
            const stock = ocr_region(img, product_stock_x, product_name_y, product_stock_w, product_name_h);
            const out_of_stock = stock.includes("已售罄");

            log.debug("Found {product_name} at index {i}, out of stock: {out_of_stock}", product_name, i, out_of_stock);

            if ((buy_all || stuff_to_buy.includes(product_name)) && !out_of_stock && !items_bought.includes(product_name)) {
                moveMouseTo(product_name_x, product_name_y); // select the product
                leftButtonClick();
                await sleep(500);

                moveMouseTo(1602, 1018); // click "buy"
                leftButtonClick();
                await sleep(500);

                moveMouseTo(743, 601); // maximize the slider
                await sleep(100);
                leftButtonDown();
                await sleep(100);
                moveMouseTo(1197, 601);
                await sleep(100);
                leftButtonUp();
                await sleep(100);

                if (dry_run) {
                    moveMouseTo(688, 782); // cancel
                } else {
                    moveMouseTo(1097, 782); // confirm
                }
                leftButtonClick();

                await sleep(1000);
                moveMouseTo(958, 752); // click to continue
                leftButtonClick();
                await sleep(1000);

                // Order of the products may have changed already, hence get another screenshot.
                img = captureGameRegion();
                bought_something = true;
                items_bought.push(product_name);
                break;
            }
        }
        if (!bought_something) {
            break;
        }
    }

    await genshin.returnMainUi();
})();