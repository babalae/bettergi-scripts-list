(async function () {
    var domainList = [
        {
            "description": "Domain",
            "name": "仲夏庭园",
            "position": [
                2492.511,
                0,
                -1559.0781
            ]
        },
        {
            "description": "Domain",
            "name": "塞西莉亚苗圃",
            "position": [
                2256,
                0,
                -238
            ]
        },
        {
            "description": "Domain",
            "name": "震雷连山密宫",
            "position": [
                733.8096,
                0,
                -416.16895
            ]
        },
        {
            "description": "Domain",
            "name": "铭记之谷",
            "position": [
                1701.4146,
                0,
                -662.9004
            ]
        },
        {
            "description": "Domain",
            "name": "孤云凌霄之处",
            "position": [
                -292.23486,
                0,
                -965.48926
            ]
        },
        {
            "description": "Domain",
            "name": "无妄引咎密宫",
            "position": [
                1692.4849,
                0,
                392.50488
            ]
        },
        {
            "description": "Domain",
            "name": "华池岩岫",
            "position": [
                1290,
                0,
                1429
            ]
        },
        {
            "description": "Domain",
            "name": "忘却之峡",
            "position": [
                1679.4097,
                0,
                -891.89746
            ]
        },
        {
            "description": "Domain",
            "name": "太山府",
            "position": [
                658,
                0,
                1168
            ]
        },
        {
            "description": "Domain",
            "name": "芬德尼尔之顶",
            "position": [
                1039.1699,
                0,
                -823.71484
            ]
        },
        {
            "description": "Domain",
            "name": "山脊守望",
            "position": [
                1470.272,
                0,
                -321.72656
            ]
        },
        {
            "description": "Domain",
            "name": "砂流之庭",
            "position": [
                -2399.8633,
                0,
                -4406.427
            ]
        },
        {
            "description": "Domain",
            "name": "菫色之庭",
            "position": [
                -3204.5703,
                0,
                -3933.9707
            ]
        },
        {
            "description": "Domain",
            "name": "椛染之庭",
            "position": [
                -3772.582,
                0,
                -2367.2656
            ]
        },
        {
            "description": "Domain",
            "name": "沉眠之庭",
            "position": [
                -4298.787,
                0,
                -4211.6465
            ]
        },
        {
            "description": "Domain",
            "name": "岩中幽谷",
            "position": [
                -476.8003,
                0,
                1897.123
            ]
        },
        {
            "description": "Domain",
            "name": "缘觉塔",
            "position": [
                -564.2788,
                0,
                2211.4712
            ]
        },
        {
            "description": "Domain",
            "name": "有顶塔",
            "position": [
                -1747.3838,
                0,
                3471.52
            ]
        },
        {
            "description": "Domain",
            "name": "赤金的城墟",
            "position": [
                -1407.8496,
                0,
                4291.583
            ]
        },
        {
            "description": "Domain",
            "name": "熔铁的孤塞",
            "position": [
                -74.48389,
                0,
                6053.4297
            ]
        },
        {
            "description": "Domain",
            "name": "苍白的遗荣",
            "position": [
                2988.157959,
                389.184509,
                4188.811523
            ]
        },
        {
            "description": "Domain",
            "name": "深潮的余响",
            "position": [
                3956.014404,
                490.579529,
                4702.80127
            ]
        },
        {
            "description": "Domain",
            "name": "罪祸的终末",
            "position": [
                1852.823975,
                441.412659,
                4726.575195
            ]
        },
        {
            "description": "Domain",
            "name": "临瀑之城",
            "position": [
                2469.4155,
                0,
                3944.8374
            ]
        },
        {
            "description": "Domain",
            "name": "褪色的剧场",
            "position": [
                1287.5386,
                0,
                4202.8003
            ]
        },
        {
            "description": "Domain",
            "name": "蕴火的幽墟",
            "position": [
                -1867.7261962891,
                217.77606201172,
                7793.6870117188
            ]
        },
        {
            "description": "Domain",
            "name": "深古瞭望所",
            "position": [
                -1871.3815917969,
                131.88421630859,
                8175.0346679688
            ]
        },
        {
            "description": "Domain",
            "name": "虹灵的净土",
            "position": [
                -2421.4799804688,
                213.12219238281,
                9041.2890625
            ]
        },
        {
            "description": "Domain",
            "name": "昏识塔",
            "position": [-93.67, 0, 3015.46]
        },
        {
            "description": "Domain",
            "name": "荒废砌造坞",
            "position": [-3378.5, 0, 10535.5]
        },
        {
            "description": "Domain",
            "name": "霜凝的机枢",
            "position": [3150.53, 0, 9375.39]
        },
        {
            "description": "Domain",
            "name": "失落的月庭",
            "position": [1936.05, 0, 10828.34]
        },
        {
            "description": "Domain",
            "name": "无光的深都",
            "position": [1832.2, 0, 9967.05]
        }
    ]
    Lowxy = [200, 300, 400, 500, 600, 700]
    let domainName = settings.name;
    let domainLevel = settings.level;
    // 使用 find 方法找到匹配的域对象
    let domainInfo = domainList.find(function (domain) {
        return domain.name === domainName;
    });
    await genshin.tp(domainInfo.position[2], domainInfo.position[0]);
    await sleep(1000);
    switch (domainName) {
        case "芬德尼尔之顶":
        case "太山府":
            // 这两个不需要向前走
            break;
        case "无妄引咎密宫":
            // 火本需要往左走再往上走
            keyDown("a");
            await sleep(1500);
            keyUp("a");
            await sleep(500);
            keyDown("w");
            await sleep(500);
            keyUp("w");
            await sleep(500);
            break;
        case "苍白的遗荣":
            // 这个走一秒就够了，并且有可能被晶蝶打断，所以需要按F
            keyDown("w");
            await sleep(1000);
            keyUp("w");
            await sleep(500);
            keyDown("f");
            await sleep(500);
            keyUp("f");
            await sleep(500);
            break;
        default:
            // 其余秘境需要向前走
            keyDown("w");
            await sleep(2500);
            keyUp("w");
            await sleep(500);
            break;
    }
    await sleep(500);
    keyPress("f")
    await sleep(5000);
    let xy = 0; let xx = 400
    switch (domainLevel) {
        case "I": xy = 200; break;
        case "II": xy = 300; break;
        case "III": xy = 400; break;
        case "IV": xy = 500; break;
        case "V": xy = 600; break;
        case "VI": xy = 700; break;
    }
    log.info(`已选择难度${domainLevel}`)
    click(xx, xy)
    await sleep(1000);
    click(1840, 50)
})();
