async function wait_until_region_has_text(x, y, w, h, expected_text, max_times, intercalary) {
    for (var _ = 0; _ < max_times; ++_) {
        const img = captureGameRegion();
        const ocr_result = img.findMulti(RecognitionObject.ocr(x, y, w, h));
        for (var i = 0; i < ocr_result.count; ++i) {
            const t = ocr_result[i].text;
            if (t === expected_text) {
                return {
                    x: ocr_result[i].x,
                    y: ocr_result[i].y,
                    w: ocr_result[i].width,
                    h: ocr_result[i].Height,
                    center: [Math.round(ocr_result[i].x + ocr_result[i].width / 2), Math.round(ocr_result[i].y + ocr_result[i].Height / 2)],
                };
            }
        }
        if (intercalary) {
            intercalary();
        }
        await sleep(1000);
    }
    return null;
}

async function click_dialog(t) {
    const pos = await wait_until_region_has_text(1170, 328, 494, 594, t, 5, null);
    if (pos) {
        log.info("Found text {t} at {x}, {y}", t, pos.x, pos.y);
        keyDown("VK_MENU");
        await sleep(500);
        moveMouseTo(...pos.center);
        leftButtonClick();
        await sleep(500);
        keyUp("VK_MENU");
        return true;
    } else {
        log.warn("Couldn't find text {t}", t);
        return false;
    }
}

async function teleport_to_theater_lobby() {
    await genshin.returnMainUi();
    await sleep(3000);

    keyPress("m");
    await sleep(1000);
    click(1841, 1019);
    await sleep(500);
    click(1436, 142);
    await sleep(500);
    click(1711, 49);
    await sleep(500);
    await click(1685, 1005);
    await sleep(500);

}


async function scroll_up_cast_page() {
    await sleep(200);
    moveMouseTo(996, 483);
    await sleep(200);
    leftButtonDown();
    await sleep(200);
    var total_pixels_to_move = 190;
    while (total_pixels_to_move > 0) {
        await sleep(10);
        const to_move = Math.min(total_pixels_to_move, 10);
        moveMouseBy(0, -to_move);
        total_pixels_to_move -= to_move;
    }
    await sleep(800);
    leftButtonUp();
    await sleep(200);
}

async function filter_cast(allowed_cast, min_constellation) {
    const region_x = 333;
    const region_y = 296;
    const region_w = 767;
    const region_h = 429;
    const gold_color_rgb = [250, 211, 68];

    function ocr_region(img, x, y, w, h) {
        const ocr_result = img.findMulti(RecognitionObject.ocr(x, y, w, h));
        return ocr_result.count > 0 ? ocr_result[0].text : null;
    }

    var last_screenshot_text = null;
    var text_unchange_times = 0;
    while (true) {
        const img = captureGameRegion();
        const ocr_result = img.findMulti(RecognitionObject.ocr(region_x, region_y, region_w, region_h));
        var ordered_result = [];
        var ordered_text = [];
        for (var i = 0; i < ocr_result.count; ++i) {
            ordered_result.push([ocr_result[i].x, ocr_result[i].y, ocr_result[i].text]);
            ordered_text.push(ocr_result[i].text);
        }
        ordered_result.sort();
        ordered_text.sort();
        const joined_text = ordered_text.join("");
        if (joined_text === last_screenshot_text) {
            text_unchange_times += 1;
        } else {
            text_unchange_times = 0;
            last_screenshot_text = joined_text;
        }
        if (text_unchange_times === 1) {
            break;
        }
        for (const [x, y, t] of ordered_result) {
            if (t.startsWith("Lv") || t.startsWith("LV")) {
                if (y <= 301) {
                    continue;
                }
                const crop = img.DeriveCrop(x - 17, y - 17, 14, 14);
                const mean_color = crop.srcMat.mean();
                const dist = 0.3 * Math.pow(mean_color.val2 - gold_color_rgb[0], 2) +
                    0.59 * Math.pow(mean_color.val1 - gold_color_rgb[1], 2)
                0.11 * Math.pow(mean_color.val0 - gold_color_rgb[2], 2);
                if (dist > 5000) {
                    continue;
                }

                click(x, y);
                await sleep(100);
                var img2 = null;
                var character_name = null;
                var constellation = null;
                for (var i = 0; i < 5; ++i) {
                    img2 = captureGameRegion();
                    const cn = ocr_region(img2, 1292, 317, 278, 44);
                    const cs = ocr_region(img2, 1292, 408, 278, 44);
                    log.debug("{cn} {cs}, {dist}, ({x}, {y})", cn, cs, dist, x, y);
                    if (!cn) {
                        await sleep(500);
                        continue;
                    }
                    character_name = cn;
                    constellation = parseInt((cs || "命之座0层").replace("命之座", "").replace("层", ""));
                    break;
                }
                const msg = ocr_region(img2, 341, 745, 1239, 55);

                if (msg === "每期仅能向同一好友邀请一位助演角色" && allowed_cast.includes(character_name) && constellation >= min_constellation) {
                    log.info("邀请 {constellation}命{character_name}", constellation, character_name);
                    return true;
                }

            }
        }
        await scroll_up_cast_page();
    }
    return false;
}


(async function() {
    const dry_run = false;
    const default_allowed_cast = ["丝柯克", "瓦雷莎", "玛薇卡", "恰斯卡", "玛拉妮", "基尼奇", "克洛琳德", "阿蕾奇诺", "千织", "娜维娅", "那维莱特", "莱欧斯利", "艾尔海森"];
    const min_constellation = 6; // Only `6` is supported now
    const allow_override = false;

    const custom_allowed_cast = (settings.allowed_cast || "").split(" ").filter(i => i);
    const allowed_cast = custom_allowed_cast.length === 0 ? default_allowed_cast : custom_allowed_cast;

    log.info("备选角色：{cast}", allowed_cast.join(" "));

    await teleport_to_theater_lobby();
    await teleport_to_theater_lobby();
    await sleep(4000);
    if (!await click_dialog("幻想真境剧诗")) {
        return;
    }
    const prepare_button = await wait_until_region_has_text(1530, 732, 161, 45, "演出准备", 10, () => {
        click(960, 912);
    });
    await sleep(500);
    click(...prepare_button.center);
    await sleep(500);

    const easy_mode = await wait_until_region_has_text(196, 173, 148, 50, "轻简模式", 10, () => {
        click(128, 1020);
    });
    await sleep(500);
    click(...easy_mode.center);

    await sleep(500);
    click(1624, 1020); // party setup
    await sleep(500);
    click(200, 415); // select all trial characters
    click(350, 415);
    click(500, 415);
    click(650, 415);
    click(800, 415);
    click(900, 415);
    click(1624, 1020); // next

    await wait_until_region_has_text(1022, 440, 774, 100, "试用", 3, null);
    const supporting_cast = await wait_until_region_has_text(1022, 440, 774, 100, "助演", 1, null);
    if (supporting_cast && !allow_override) {
        log.info("已有选择的助演角色，退出");
        await genshin.returnMainUi();
        return;
    }
    await sleep(500);
    click(1644, 414); // invite supporting cast
    await sleep(500);

    const find_result = await filter_cast(allowed_cast, min_constellation);
    if (!find_result) {
        log.info("未找到符合条件的角色，去多加一些满命大佬吧");
        await genshin.returnMainUi();
        return;
    } else {
        await sleep(500);
        click(1134, 850);
        await sleep(500);
        click(1180, 760);
        await sleep(500);
    }

    await sleep(500);
    click(400, 1020); // auto select team members
    await sleep(500);
    click(960, 540);
    await sleep(500);
    click(1624, 1020); // start
    await sleep(500);
    click(1142, 909); // confirm start
    await sleep(500);

    const confirm_select = await wait_until_region_has_text(1344, 945, 156, 36, "确认选择", 15, () => {
        click(436, 577);
    });
    click(1414, 963);
    await sleep(500);
    click(1167, 814);
    await sleep(500);
    const can_press_esc = await wait_until_region_has_text(913, 638, 137, 37, "暂离演出", 10, () => {
        keyPress("VK_ESCAPE");
    });

    // now we've locked the character, safe to exit
    await genshin.TpToStatueOfTheSeven();
})();
