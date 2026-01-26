(async function () { // 超2000上限条件未适配，应当跳过数量为0的料理，OCR特殊字符可能失效，滑块底部时左下角料理文本无法识别
    const food_msg = JSON.parse(file.readTextSync("assets/foodMsg.json"));
    const material_list = ['蘑菇', '黑麦粉', '洋葱', '夏槲果', '卷心菜', '胡萝卜', '土豆', '酸奶油', '兽肉', '火腿', '香肠', '胡椒', '宿影花', '冬凌草', '白灵果', '禽肉', '面粉', '香辛料', '薄荷', '苹果', '黄油', '糖', '鱼肉', '奶油', '秃秃豆', '鸟蛋', '盐', '番茄', '寒涌石', '奶酪', '青蜜莓', '苦种', '虾仁', '颗粒果', '咖啡豆', '墩墩桃', '日落果', '树莓', '牛奶', '汐藻', '泡泡桔', '海露花', '螃蟹', '绯樱绣球', '红果果菇', '堇瓜', '蟹黄', '清心', '烬芯花', '果酱', '澄晶实', '培根', '烛伞蘑菇', '肉龙掌', '发酵果实汁', '茉洁草', '稻米', '白萝卜', '松茸', '沉玉仙茗', '豆腐', '绝云椒椒', '竹笋', '金鱼草', '杏仁', '小麦', '松果', '海草', '琉璃袋', '帕蒂沙兰', '神秘的肉', '莲蓬', '枣椰', '鳗肉', '须弥蔷薇', '钩钩果', '树王圣体菇', '星蕈', '嘟嘟莲', '马尾', '甜甜花', '小灯草', '「冷鲜肉」', '熏禽肉'];
    const food_category = {
        "恢复类": ["恢复血量", "持续恢复", "复活"],
        "攻击类": ["提升伤害", "提升攻击", "提升暴击", "提升暴击伤害"],
        "冒险类": ["恢复体力", "减少体力消耗", "减少严寒消耗", "环境交互恢复"],
        "防御类": ["提升防御", "提升护盾", "生命上限提升", "提升治疗效果", "元素充能效率提升"],
        "其他": ["其他", "不可制作"],
    }
    // const food_type = ["特殊料理", "正常料理", "活动料理", "饮品", "视觉效果", "购买料理", "探索获取", "角色技能获取", "限时"]
    const special_food = { // 5星仅作占位用，无实际作用 [特殊料理用]
        "1": [0.1, 0.15, 0.2],
        "2": [0.1, 0.1, 0.15],
        "3": [0.05, 0.1, 0.15],
        "4": [0.05, 0.05, 0.1],
        "5": [0.05, 0.05, 0.1]
    }

    /**
     * 简洁易用的OCR函数
     * @param x
     * @param y
     * @param w
     * @param h
     * @param multi 是否使用FindMulti
     * @returns {Promise<void>} 返回对应的OCR对象
     */
    async function Ocr(x, y, w, h, multi = false) {
        let OcrRo = RecognitionObject.Ocr(x, y, w, h);
        let gameRegion = captureGameRegion();
        if (multi) {
            let ocrResult = gameRegion.FindMulti(OcrRo);
            gameRegion.dispose();
            if (ocrResult.count !== 0) {
                let resultList = [];
                for (let i = 0; i < ocrResult.count; i++) {
                    resultList.push(ocrResult[i]);
                }
                return resultList;
            } else {
                log.debug(`FindMulti为空: (${x}, ${y}, ${w}, ${h})`);
                return false;
            }
        } else {
            let ocrResult = gameRegion.Find(OcrRo);
            gameRegion.dispose();
            if (ocrResult.isExist()) {
                return ocrResult;
            } else {
                log.debug(`Find为空: (${x}, ${y}, ${w}, ${h})`);
                return false;
            }
        }
    }

    /**
     * 调整烹饪料理到指定数量(1-999)后点击确定
     * @param num 烹饪数量
     * @returns {Promise<void>}
     */
    async function set_ingredient_num(num) { // 后续改成inputText
        click(961, 454); // 选中输入框
        await sleep(100);
        inputText(`${num}`);

        await sleep(500);
        await click(1190, 760); // 确认
        await sleep(200);
    }

    /**
     * 对话并进入NPC商店，需要确保与NPC对话的F图标存在
     * 餐馆NPC、杂货店NPC、合成台、合成台NPC均可使用(适用于按F进入对话后一直按F进入界面的所有可交互对象)
     * @returns {Promise<boolean>}
     */
    async function enter_store() {
        let imageFRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F.png"));
        let imageExitRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Exit.png"));
        let location_flag = false;

        for (let i = 0; i < 3; i++) {
            await sleep(500);
            let gameRegion = captureGameRegion();
            if (gameRegion.Find(imageFRo).isExist()) {
                gameRegion.dispose();
                keyPress("F");
                log.debug("找到并按下F");
                await sleep(1000);
                location_flag = true;
                break;
            }
            gameRegion.dispose();
        }
        if (location_flag) {
            while (!(captureGameRegion().Find(imageExitRo).isExist())) { // [DEBUG] 可能陷入死循环？
                await sleep(500);
                keyPress("F");
                log.debug("按F直到进入商店界面");
            }
            log.info("已进入商店界面");
            await sleep(500);
            return true;
        } else {
            log.error("未找到对话按钮");
            return false;
        }
    }

    /**
     * 供 findClosestMatch 调用
     */
    async function levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // 替换
                        matrix[i][j - 1] + 1,     // 插入
                        matrix[i - 1][j] + 1      // 删除
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     *
     * 查找最相似的字符串（用于查找鱼饵，最大限度避免OCR偏差导致的异常）
     *
     * @param target 目标字符串
     * @param candidates 字符串数组
     * @returns {Promise<String>}
     * @see levenshteinDistance
     */
    async function findClosestMatch(target, candidates) {
        let closest = null;
        let minDistance = Infinity;
        for (const candidate of candidates) {
            const distance = await levenshteinDistance(target, candidate);
            if (distance < minDistance) {
                minDistance = distance;
                closest = candidate;
            }
        }
        return closest;
    }

    /**
     *
     * 按照原神物品名长度显示裁剪字符串[主物品显示界面适用]（用于OCR）
     *
     * @param string 原字符串
     * @returns {Promise<*|string>} 处理后的字符串
     */
    async function deal_string(string) {
        if (string.length <= 6) {
            return string; // 如果字符串长度是6位或以下，原形返回
        } else {
            return string.substring(0, 5) + '..'; // 如果字符串长度超过6位，保留前5位并加上'..'
        }
    }

    /**
     * 跑到指定位置并交互进入界面
     * @param type 类型
     * @param area 国家
     * @returns {Promise<boolean>} 是否成功进入
     * @see enter_store
     */
    async function go_and_interact(type, area = "蒙德") {
        // 返回主界面
        await genshin.returnMainUi();

        if (type === "餐馆" || type === "杂货店" || type === "锅") {
            const path_json = JSON.parse((file.readTextSync(`assets/npc/${area}-${type}.json`)));
            await sleep(500);
            await pathingScript.run(JSON.stringify(path_json));
            await sleep(500);
            if (path_json["info"]["description"].includes("GCM")) {
                // 等待到返回主界面
                await genshin.returnMainUi();
                await sleep(500);
                await keyMouseScript.runFile(`assets/npc/${area}-${type}-GCM.json`);
                await sleep(500);
            }
        }

        return await enter_store();
    }

    /**
     * 获取当前物品的数量（确保物品已经点开[物品位于屏幕中心单独显示]）
     * @returns {Promise<number|boolean>}
     */
    async function get_current_item_num() {
        let ocr_area = await Ocr(881, 763, 158, 267, true); // 中间 "当前拥有xxx" 部分区域
        let item_num = -1;

        if (ocr_area) {
            let refer_y;
            for (let i = 0; i < ocr_area.length; i++) {
                if (ocr_area[i].text.includes("当前拥有")) { // 寻找“当前拥有”
                    refer_y = ocr_area[i].y;

                    for (let j = 0; j < ocr_area.length; j++) {
                        let string = ocr_area[j].text.replace(/\D/g, ''); // 保留字符串为纯数字
                        if (string && ocr_area[j].y > refer_y - 12 && ocr_area[j].y < refer_y + 12) { // 纯数字且y坐标范围合理
                            item_num = parseInt(string, 10);
                            log.debug(`识别到物品数量: ${item_num}`);
                            click(1480, 974); // 点击空白处返回
                            await sleep(500);
                            return item_num;
                        }
                    }
                }
                if (item_num !== -1) break;
            }
            if (item_num === -1) {
                log.error(`OCR错误，未定位到物品数量`);
                click(1480, 974); // 点击空白处返回
                await sleep(500);
                return false;
            }
        } else {
            log.error(`OCR错误，未识别到任何文本`);
            click(1480, 974); // 点击空白处返回
            await sleep(500);
            return false;
        }
    }

    /**
     * 向上/下滑动滑块一次（原理，点击紧贴滑块的上/下方）[以下，高/顶表示屏幕上方，低/底表示屏幕下方]
     * @param x 滑块移动区域
     * @param y 滑块移动区域
     * @param w 滑块移动区域
     * @param h 滑块移动区域
     * @param max 滑块最高临界y值，若滑块y值小于此值则认为已经到顶
     * @param min 滑块最低临界y值，若滑块y值大于此值则认为已经到底
     * @param m_x 滑块区域的滑条中心x值
     * @param direction 滑动方向(Up/Down)
     */
    async function scroll_page(x, y, w, h, max, min, m_x, direction) {
        let barUpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_up.png"), x, y, w, h);
        let barDownRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_down.png"), x, y, w, h);
        barUpRo.threshold = 0.7;
        barDownRo.threshold = 0.7;

        let gameRegion = captureGameRegion();
        if (direction === "Up") {
            let barUpper = gameRegion.Find(barUpRo);
            gameRegion.dispose();
            if (barUpper.isExist()) {
               if (barUpper.y < max) { // 到顶了
                   log.info("滑块已经滑动到顶部...");
                   return false;
               } else {
                   click(m_x, barUpper.y - 15);
                   log.debug(`将滑块向上调一格，当前位置: ${barUpper.y}`);
               }
            } else {
                log.error("未找到滑块: Up");
                return false;
            }
        } else {
            let barLower = gameRegion.Find(barDownRo);
            gameRegion.dispose();
            if (barLower.isExist()) {
                if (barLower.y > min) { // 到底了
                    log.info("滑块已经滑动到底部...");
                    return false;
                } else {
                    click(m_x, barLower.y + 15);
                    log.debug(`将滑块向下调一格，当前位置: ${barLower.y}`);
                }
            } else {
                log.error("未找到滑块: Down");
                return false;
            }
        }
        await sleep(200);
        return true;
    }

    /**
     * 向上/下滑动滑块至顶部/底部（原理，点击紧贴滑块的上/下方）[以下，高/顶表示屏幕上方，低/底表示屏幕下方]
     * @param x 滑块移动区域
     * @param y 滑块移动区域
     * @param w 滑块移动区域
     * @param h 滑块移动区域
     * @param max 滑块最高临界y值，若滑块y值小于此值则认为已经到顶
     * @param min 滑块最低临界y值，若滑块y值大于此值则认为已经到底
     * @param max_y 滑块移动区域的最高点y值
     * @param min_y 滑块移动区域的最低点y值
     * @param m_x 滑块区域的滑条中心x值
     * @param side 滑动顶部或底部(Up/Down)
     * @returns {Promise<boolean>}
     * @see scroll_page
     */
    async function scroll_bar_to_side(x, y, w, h, max, min, max_y, min_y, m_x, side) {
        let barUpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_up.png"), x, y, w, h);
        let barDownRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_down.png"), x, y, w, h);
        barUpRo.threshold = 0.7;
        barDownRo.threshold = 0.7;

        while (true) {
            await sleep(200);
            log.debug(`将滑块滑动至 ${side} `);
            let gameRegion = captureGameRegion();
            if (side === "Up") {
                let barUpper = gameRegion.Find(barUpRo);
                gameRegion.dispose();
                if (barUpper.isExist()) {
                    if (barUpper.y < max) { // 到顶了
                        log.info("滑块已经滑动到顶部...");
                        break;
                    } else {
                        click(m_x, barUpper.y - 15);
                        log.debug(`将滑块向上调一格，当前位置: ${barUpper.y}`);
                    }
                } else {
                    log.error("未找到滑块: Up");
                    return false;
                }
            } else {
                let barLower = gameRegion.Find(barDownRo);
                gameRegion.dispose();
                if (barLower.isExist()) {
                    if (barLower.y > min) { // 到底了
                        log.info("滑块已经滑动到底部...");
                        break;
                    } else {
                        click(m_x, barLower.y + 15);
                        log.debug(`将滑块向下调一格，当前位置: ${barLower.y}`);
                    }
                } else {
                    log.error("未找到滑块: Down");
                    return false;
                }
            }
        }
        await sleep(200);
        return true;
    }

    /**
     * 在指定区域内OCR文本并返回OCR对象
     * @param x
     * @param y
     * @param w
     * @param h
     * @param text 文本
     * @returns {Promise<*>} 找到返回OCR对象，未找到返回false
     * @see Ocr
     */
    async function ocr_find_area(x, y, w, h, text) {
        const OcrResult = await Ocr(x, y, w, h, true);

        if (OcrResult) {
            let flag = true;
            for (let i = 0; i < OcrResult.length; i++) {
                if (OcrResult[i].text.includes(text)) {
                    flag = false;
                    await sleep(200);
                    return OcrResult[i];
                }
            }
            if (flag) {
                log.error(`区域(${x}, ${y}, ${w}, ${h})内未找到文本：${text}`);
                return false;
            }
        } else {
            log.error(`OCR错误，区域内未识别到文本: (${x}, ${y}, ${w}, ${h})`);
            return false;
        }
    }

    /**
     *
     * 自动执行手动烹饪(源于JS脚本: 烹饪熟练度一键拉满-(柒叶子-https://github.com/511760049))
     * @param segmentTime
     * @returns {Promise<number>}
     */
    async function auto_cooking_bgi(segmentTime = 66) {
        if (settings.segmentTime !== "" && parseInt(settings.segmentTime, 10) !== 0) {
            segmentTime = parseInt(settings.segmentTime, 10);
        }
        await sleep(350);
        await click(1005, 1011); // 点击手动烹饪
        await sleep(1000); // 等待画面稳定
        const checkPoints = [
            {x: 741, y: 772}, // 原始点1
            {x: 758, y: 766}, // 中间点1-2
            {x: 776, y: 760}, // 原始点2
            {x: 793, y: 755}, // 中间点2-3
            {x: 810, y: 751}, // 原始点3
            {x: 827, y: 747}, // 中间点3-4
            {x: 845, y: 744}, // 原始点4
            {x: 861, y: 742}, // 中间点4-5
            {x: 878, y: 740}, // 原始点5
            {x: 897, y: 737}, // 中间点5-6
            {x: 916, y: 735}, // 原始点6
            {x: 933, y: 735}, // 中间点6-7
            {x: 950, y: 736}, // 原始点7
            {x: 968, y: 736}, // 中间点7-8
            {x: 986, y: 737}, // 原始点8
            {x: 1002, y: 738}, // 中间点8-9
            {x: 1019, y: 740}, // 原始点9
            {x: 1038, y: 742}, // 中间点9-10
            {x: 1057, y: 744}, // 原始点10
            {x: 1074, y: 748}, // 中间点10-11
            {x: 1092, y: 752}, // 原始点11
            {x: 1107, y: 757}, // 中间点11-12
            {x: 1122, y: 762}, // 原始点12
            {x: 1138, y: 766}, // 中间点12-13
            {x: 1154, y: 770}, // 原始点13
            {x: 1170, y: 774}, // 中间点13-14
            {x: 1193, y: 779} // 原始点14
        ];

        // 区域大小
        const regionSize = 60;

        // 加载模板图片
        const templateMat0 = file.readImageMatSync("assets/best0.png");
        const templateMat1 = file.readImageMatSync("assets/best1.png");
        const templateMat2 = file.readImageMatSync("assets/best2.png");

        // 创建模板匹配识别对象
        const templateRo0 = RecognitionObject.templateMatch(templateMat0);
        const templateRo1 = RecognitionObject.templateMatch(templateMat1);
        const templateRo2 = RecognitionObject.templateMatch(templateMat2);
        templateRo0.threshold = 0.9;
        templateRo0.Use3Channels = true;
        templateRo1.threshold = 0.9;
        templateRo1.Use3Channels = true;
        templateRo2.threshold = 0.9;
        templateRo2.Use3Channels = true;
        // 捕获游戏区域
        const gameRegion = captureGameRegion();

        // 检查每个点
        for (let i = 0; i < checkPoints.length; i++) {
            const point = checkPoints[i];

            // 裁剪出当前检测区域
            const region = gameRegion.deriveCrop(
                point.x - regionSize/2,
                point.y - regionSize/2,
                regionSize,
                regionSize
            );

            let result;
            if (i < 9) {
                result = region.find(templateRo0);
            } else if (i >= 18) {
                result = region.find(templateRo2);
            } else {
                result = region.find(templateRo1);
            }
            region.dispose();

            if (!result.isEmpty()) {
                // const segmentTime = 66;
                const waitTime = Math.round(i * segmentTime);
                log.info(`找到点位${i}号区域`);
                await sleep(waitTime);
                keyPress("VK_SPACE");
                await sleep(500);
                keyPress("Escape");
                gameRegion.dispose();
                return 0;
            }
        }
        gameRegion.dispose();
        // log.info(`未找到点位区域，烹饪结束`);
        // keyPress("ESCAPE");
        // await sleep(1000);
        // keyPress("ESCAPE");
        // throw new Error("人家才不是错误呢>_<");
    }

    /**
     * 刷满熟练度(确保已经与烹饪锅交互进入界面) [DEBUG] 材料不足时仍尝试其他料理（若某材料有但不足，对应的料理可能会排在可制作料理之前）
     * 完成后按Escape退出到“料理制作”界面
     * @returns {Promise<boolean>} 成功运行指定次数手动烹饪返回true
     * @see findClosestMatch
     * @see deal_string
     */
    async function unlock_auto_cooking() {

        // 消除食材不足的料理
        await sleep(200);
        click(1009, 53); // 食材加工
        await sleep(200);
        click(911, 46); // 料理制作
        await sleep(200);

        click(143, 1018); // 筛选
        await sleep(500);
        click(143, 1018); // 重置
        await sleep(500);
        click(125, 684); // 未满
        await sleep(500);
        click(493, 1025); // 确认筛选
        await sleep(500)

        let food_name = await Ocr(116, 243, 125, 30);
        if (food_name) {
            food_name.Click();
            await sleep(500);
            // 寻找对应的料理
            let matchList = [];
            for (let i = 0; i < Object.keys(food_msg).length; i++) {
                matchList.push(await deal_string(Object.keys(food_msg)[i]));
            }
            food_name = await findClosestMatch(food_name.text, matchList);
            log.info(`当前料理: ${food_name}`);
            // let formula_num = Object.keys(food_msg["formula"]).length;
            click(1686, 1018); // 制作
            await sleep(800);
            let checkOcr = await Ocr(710, 523, 115, 31);
            if (checkOcr && checkOcr.text.includes("材料不足")) {
                log.error(`制作 ${food_name} 过程中，材料不足...`);
                return false;
            }
            await sleep(1000); // 等待进入烹饪界面
            checkOcr = await Ocr(132, 33, 69, 29);
            if (checkOcr && checkOcr.text.includes("烹饪")) {
                // 检测角色加成
                await check_character_bonus();
                await sleep(500);
                let cook_num = parseInt(food_msg[food_name]["price"], 10) * 5;
                for (let i = 0; i < cook_num; i++) {
                    await auto_cooking_bgi();
                    log.info(`进度: ${i + 1}/${cook_num}`);
                    await sleep(1000);
                    // 检测自动烹饪解锁
                    checkOcr = await Ocr(730, 993, 124, 40);
                    if (checkOcr && checkOcr.text.includes("自动烹饪")) {
                        log.info(`检测到自动烹饪已解锁，${food_name} 已完成...`);
                        break;
                    }
                    // 检测材料耗尽
                    checkOcr = await Ocr(121, 22, 158, 55);
                    if (!(checkOcr && checkOcr.text.includes("烹饪"))) {
                        if (checkOcr.text.includes("料理制作")) {
                            log.warn(`料理 ${food_name} ，制作过程中食材耗尽，已跳过...`);
                        }
                        log.error("OCR错误, 未识别到文本： 烹饪");
                        return false;
                    }
                }
                // 检测是否处于“烹饪界面”，并退出
                checkOcr = await Ocr(132, 33, 69, 29);
                if (checkOcr && checkOcr.text.includes("烹饪")) {
                    await sleep(500);
                    keyPress("Escape");
                    await sleep(500);
                }
                return true;
            } else {
                log.error("OCR错误, 未识别到文本： 烹饪");
                return false;
            }
        } else {
            let flag = await Ocr(137, 31, 111, 34);
            if (flag && flag.text.includes("料理制作")) {
                log.info("已经刷满全部料理熟练度...");
                return false;
            }
            log.error("OCR错误, 未识别到文本");
            return false;
        }
    }

    /**
     * 在料理制作界面，寻找并选中料理
     * @param food_name 必须为正确的料理名
     * @returns {Promise<void>}
     * @see scroll_bar_to_side
     * @see ocr_find_area
     * @see deal_string
     */
    async function find_and_click_food(food_name) {
        // 确保滑动到顶部
        await scroll_bar_to_side(1282, 112, 13, 838, 131, 930, 124, 936, 1288, "Up"); // 料理制作界面

        log.info(`在当前界面寻找 ${food_name} `);
        let select_food_category = food_msg[food_name]["category"];
        let search_keys = []; // 大类
        for (const [c_name, c_detail] of Object.entries(food_category)) {
            if (c_name === "其他") break;
            for (let i = 0; i < select_food_category.length; i++) {
                if (c_detail.includes(select_food_category[i])) {
                    if (!(search_keys.includes(c_name))) {
                        search_keys.push(c_name);
                        break;
                    }
                }
            }
        }

        // 筛选
        await sleep(200);
        click(143, 1018); // 筛选
        await sleep(500);
        click(143, 1018); // 重置
        await sleep(500);
        for (let i = 0; i < search_keys.length; i++) {
            let ocrResult = await ocr_find_area(94, 229, 136, 326, search_keys[i]);
            if (ocrResult) ocrResult.Click();
            await sleep(300);
        }
        await sleep(200)
        click(493, 1025); // 确认筛选
        await sleep(800)

        // OCR料理名称
        let ocrResult = await ocr_find_area(104, 108, 1172, 857, await deal_string(food_name));
        if (!ocrResult) {
            while (await scroll_page(1282, 112, 13, 838, 131, 930, 1288, "Down")) {
                ocrResult = await ocr_find_area(104, 108, 1172, 857, await deal_string(food_name));
                if (ocrResult) break;
                await sleep(300);
            }
        }
        if (ocrResult) {
            log.info(`找到料理: ${food_name}`);
            await sleep(500);
            ocrResult.Click();
            await sleep(500);
            return true;
        } else {
            log.error(`未找到料理: ${food_name}，可能未拥有该食谱或OCR错误...\n获得方式: ${food_msg[food_name]["obtain"]}`);
            return false;
        }

    }

    /**
     * 在料理制作界面，获取food_name的各个食材的数量并返回object [DEBUG]待测试
     * @param food_name
     * @returns {Promise<Object|boolean>}
     */
    async function get_material_num(food_name) {
        const material_site = { // 食材图标位置
            "0": {"x": 1383, "y1": 601, "y2": 695},
            "1": {"x": 1491, "y1": 601, "y2": 695},
            "2": {"x": 1599, "y1": 601, "y2": 695},
            "3": {"x": 1707, "y1": 601, "y2": 695}
        }
        let m_count = Object.keys(food_msg[food_name]["formula"]).length;
        if (!m_count) return false;

        let material_dic = {};

        log.info(`开始获取 ${food_name} 的食材余量...`);

        let materialList = Object.keys(food_msg[food_name]["formula"]); // OCR纠错用

        for (let i = 0; i < m_count; i++) {
            let flag = false;
            // 点击食材（上）
            await sleep(300);
            click(material_site[i]["x"], material_site[i]["y1"]);
            await sleep(500);
            let ocrResult = await Ocr(881, 763, 158, 267);
            if (ocrResult && ocrResult.text.includes("当前拥有")) {
                flag = true;
            } else {
                // 点击食材（下）
                click(1855, 785); // 点击空白处
                await sleep(300);
                click(material_site[i]["x"], material_site[i]["y2"]);
                await sleep(500);
                let ocrResult = await Ocr(881, 763, 158, 267);
                if (ocrResult && ocrResult.text.includes("当前拥有")) {
                    flag = true;
                }
            }
            if (flag) {
                let ocrName = await Ocr(736, 254, 280, 73); // 文本较少
                if (ocrName) {
                    ocrName = await findClosestMatch(ocrName.text, materialList); // 最大限度避免OCR误差（结合动态调整的materialList[当前料理的食材列表]）
                    materialList = materialList.filter(item => item !== ocrName);
                } else {
                    ocrName = await Ocr(736, 174, 280, 153); // 文本较多
                    if (ocrName) {
                        ocrName = await findClosestMatch(ocrName.text, Object.keys(food_msg[food_name]["formula"]));
                        materialList = materialList.filter(item => item !== ocrName);
                    } else {
                        log.error("OCR错误");
                        return false;
                    }
                }
                let item_num = await get_current_item_num();
                if (item_num) {
                    material_dic[ocrName] = item_num; // 计入食材字典
                    log.info(`${ocrName}(${item_num})`);
                } else {
                    log.warn(`OCR错误：未识别到食材(${ocrName})的数量，本次计为0`);
                    material_dic[ocrName] = 0; // 计入食材字典
                }
            } else {
                log.error(`OCR错误，未识别到 ${food_name}-食材${i + 1} 的独立物品界面`);
                return false;
            }
        }
        click(1855, 785); // 点击空白处
        await sleep(500);
        return material_dic;

    }

    /**
     * 根据JS脚本配置的全局设置，在烹饪界面选择角色加成
     * @param spl 设定为选择特殊料理
     * @returns {Promise<boolean>}
     */
    async function check_character_bonus(spl = false) {
        await sleep(200);
        click(1779, 254);
        while (true) {
            await sleep(200);
            let ocrResult = await Ocr(119, 29, 130, 37);
            if (ocrResult && ocrResult.text.includes("角色选择")) break;
        }
        await sleep(200);
        let ocrResult = await ocr_find_area(148, 95, 773, 937, "产出");
        let flag = false;
        if (settings.characterBonus === "12%概率双倍" && !spl) {
            if (ocrResult) {
                ocrResult.Click();
                log.info("选择角色加成: 12%概率双倍");
            }
        } else if (settings.characterBonus === "特殊料理" || spl) {
            let checkOcr = await ocr_find_area(148, 95, 773, 937, "特殊");
            if (checkOcr) {
                checkOcr.Click();
                log.info("选择角色加成: 特殊料理");
            } else {
                flag = true;
            }
        } else if (settings.characterBonus === "无加成") {
            let checkOcr = await ocr_find_area(148, 95, 773, 937, "暂无");
            if (checkOcr) {
                checkOcr.Click();
                log.info("选择角色加成: 无加成");
            } else {
                flag = true;
            }
        } else if (settings.characterBonus === "「奇怪的」") {
            let checkOcr = await ocr_find_area(148, 95, 773, 937, "奇怪");
            if (checkOcr) {
                checkOcr.Click();
                log.info("选择角色加成: 「奇怪的」");
            } else {
                flag = true;
            }
        }
        if (flag && !spl) {
            if (ocrResult) {
                ocrResult.Click();
                log.info("选择角色加成: 12%概率双倍");
            } else {
                log.error("角色加成选择错误，保留默认...");
            }
        }
        await sleep(500);
        click(1893, 889);
        await sleep(500);
        return !flag;
    }

    /**
     * 实力派「技术料理」大师，芙宁娜亲封「甜点大校」，[前]德波大饭店主厨 爱可菲，向你致以问候。
     * 贵为神明座上宾的你，也应享用提瓦特最顶尖的美食，希望我的作品能让你满意。
     * 	“	「司掌甜蜜的精灵」、「统御味蕾的暴君」？也没报纸上传得那么夸张哦，爱可菲只是个喜欢烹饪的…有一点点严格的女孩啦。那些不认真对待料理的家伙，当然也得不到她的尊重！总之，你们两个的「风味」一定能搭配得好，我保证！	” ——娜维娅
     *
     * 需要位于料理制作界面，并已经选中了对应料理
     * 角色加成选择，特殊料理 [DEBUG]左侧角色选择8人，最多有6条加成，先不加滑块逻辑了
     * @param food_name 料理名
     * @param food_num 料理数量
     * @param spl 特殊料理
     * @returns {Promise<void>}
     */
    async function escoffier_cook_for_u(food_name, food_num, spl = false) {
        if (settings.dealInsufficient !== "禁用") {
            // 食材数量检测
            let material_quantity = await get_material_num(food_name);
            if (!material_quantity) {
                return false;
            }
            for (const [m_name, m_num] of Object.entries(material_quantity)) { // [DEBUG] 此处可以结合settings加入额外逻辑
                let demand = parseInt(food_msg[food_name]["formula"][m_name], 10)
                let total = demand * food_num;
                if (total > m_num) { // 需求大于已有
                    log.warn(`食材(${m_num})不足: 需求(${total}), 拥有(${m_num}), 单次烹饪需求(${demand})`);
                    if (settings.dealInsufficient === "跳过此料理") {
                        log.info(`全局设置已启用，料理 ${food_name} 已跳过...`);
                        return true; // [DEBUG] 或许应该为false
                    } else {
                        let deal_num = Math.floor(m_num / demand) - 1;
                        if (deal_num < food_num) food_num = deal_num;
                        log.info(`全局设置已启用，料理(${food_name})的烹饪数量已被重新设置为${food_num}`);
                        await sleep(10);
                    }
                }
            }
        }

        // 料理数量检测
        let food_quantity = await Ocr(1333, 185, 197, 33);
        if (food_quantity) {
            food_quantity = parseInt(food_quantity.text.replace(/\D/g, ''), 10);
        } else {
            log.warn("未获取到当前持有的料理数量，本次视为0...");
            food_quantity = 0;
        }
        if (food_quantity + food_num > 2000) {
            food_num = food_quantity < 2000 ? 2000 - food_quantity: 0;
            log.warn(`制作的料理数超过上限，已调整为: ${food_num}`);
        }

        // 烹饪步骤
        await sleep(200);
        click(1681, 1019); // 点击 制作
        await sleep(800);
        // 检测角色加成
        let resultFlag = await check_character_bonus(spl);
        if (!resultFlag) {
            let characterName = "未知";
            for (const f_msg of Object.values(food_msg)) {
                if (f_msg["belonging"] === food_name) {
                    characterName = f_msg["character"];
                    break;
                }
            }
            log.error(`未找到 ${food_name} 对应的特殊料理角色(${characterName})...`);
            return false;
        }

        await sleep(200);
        click(1893, 889);
        await sleep(500);
        let checkOcr = await Ocr(730, 993, 524, 40);
        if (checkOcr) {
            if (!(checkOcr.text.includes("自动"))) { // 未解锁自动烹饪
                // 手动烹饪默认次数
                let cook_num = parseInt(food_msg[food_name]["price"], 10) * 5;
                let cook_count = 0;
                for (let i = 0; i < cook_num; i++) {
                    await auto_cooking_bgi(); // 调用手动烹饪
                    cook_count++; // 手动烹饪计数
                    log.info(`进度: ${i + 1}/${cook_num}`);
                    await sleep(1000);
                    // 检测自动烹饪解锁
                    checkOcr = await Ocr(730, 993, 124, 40);
                    if (checkOcr && checkOcr.text.includes("自动烹饪")) {
                        if (settings.autoLocked === "手动烹饪数计入总数") {
                            log.info(`检测到自动烹饪已解锁，${food_name} 剩余${food_num - cook_count}次`);
                            food_num -= cook_count;
                        } else {
                            log.info(`检测到自动烹饪已解锁，${food_name} 剩余${food_num}次`);
                        }
                        await sleep(200);
                        click(1878, 846); // 点击空白处
                        await sleep(500);
                        break;
                    }
                    // 检测材料耗尽
                    checkOcr = await Ocr(132, 33, 69, 29);
                    if (!(checkOcr && checkOcr.text.includes("烹饪"))) {
                        log.error("OCR错误, 未识别到文本： 烹饪，可能原因：食材耗尽");
                        return false;
                    }
                }
            }
            if (food_num > 0) { // 使用自动烹饪
                await sleep(200);
                click(793, 1013); // 自动烹饪
                await sleep(500);
                await set_ingredient_num(food_num);
                while (true) { // [DEBUG] 无容错
                    let ocrResult = await Ocr(934, 884, 76, 39);
                    if (ocrResult && ocrResult.text.includes("确认")) {
                        ocrResult.Click();
                        await sleep(500);
                        break;
                    }
                }
            }
            log.info(`料理(${food_name})烹饪完成...`);
            await sleep(500); // [DEBUG] 如果卡在烹饪界面，考虑延长此处延时
            click(1878, 846); // 点击空白处
            await sleep(500);
            let ocrResult = await Ocr(132, 33, 69, 29);
            if (ocrResult && ocrResult.text.includes("烹饪")) {
                await sleep(500);
                keyPress("Escape"); // 返回料理制作
                await sleep(500);
            }
            return true;

        } else {
            log.error("OCR错误，未找到烹饪按钮"); // [DEBUG] 加个检测，返回到料理制作界面
            return false;
        }
    }

    /**
     * 根据settings的选择，确定料理名和对应的数量
     * @param spl 特殊料理
     * @returns {Promise<void>} 如果成功读取，返回料理名称和料理数量的字典
     */
    async function calculate_food(spl = false) {
        let foodDic = {};
        let foodNum, foodList;

        // 读取设置项
        if (spl) {
            foodList = Array.from(settings.selectCharacter);
            foodNum = settings.characterFoodNum.trim().split(" ");
            log.debug(`解析料理数据(spl)\n${foodList.join("|")}\n${foodNum.join("|")}`);
            // 将特殊料理名转换为普通料理名 [DEBUG] 未测试
            let tempList = [];
            for (let i = 0; i < foodList.length; i++) {
                let spl_name = foodList[i].split("(")[0];
                tempList.push(food_msg[spl_name]["belonging"]);
            }
            foodList = tempList;
        } else {
            let arrays = [
                Array.from(settings.selectRecovery),
                Array.from(settings.selectATKBoosting),
                Array.from(settings.selectAdventure),
                Array.from(settings.selectDEFBoosting),
                Array.from(settings.selectOthers)
            ]
            foodList = [...new Set(arrays.flat())]; // 合并去重
            foodNum = settings.foodNum.trim().split(" ");
            log.debug(`解析料理数据\n${foodList.join("|")}\n${foodNum.join("|")}`);
        }

        // 检测并合并数量
        if (foodNum.length === 1) {
            for (let i = 0; i < foodList.length; i++) {
                foodDic[foodList[i]] = parseInt(foodNum[0], 10);
            }
        } else {
            if (foodList.length !== foodNum.length) {
                log.error("输入的料理数与选择的料理数不一致！");
                return false;
            }
            for (let i = 0; i < foodList.length; i++) {
                foodDic[foodList[i]] = parseInt(foodNum[i], 10);
            }
        }

        // 根据概率计算大致次数（向上取整）(spl)
        if (spl && settings.characterMode === "预期的特殊料理数") {
            for (const[f_name, f_num] of Object.entries(foodDic)) {
                let probability = special_food[food_msg[f_name]["price"]][2];
                let base = Math.ceil(1 / probability);
                foodDic[f_name] = base * f_num;
                log.info(`料理(${f_name})的预期烹饪次数发生更改: ${f_num} -> ${base * f_num}`)
            }
        }
        return foodDic;
    }

    async function main() {
        // EULA检测
        if (!(settings.EULA)) {
            log.error("请阅读README后，在JS脚本配置启用脚本...");
            return null;
        }

        // 返回主界面
        await genshin.returnMainUi();

        // 刷满熟练度
        if (settings.unlockAutoCooking) {
            log.info("当前模式为刷满熟练度...");
            if (parseInt(settings.segmentTime, 10) === 86) {
                log.warn("检测到JS脚本配置 时延 未进行更改，请确保已经正确设置!\n将在10s后继续...");
                await sleep(5000);
            }
            await sleep(5000);
            let flag = await go_and_interact("锅");
            if (!flag) {
                log.error("未找到锅...");
                return null;
            }
            while (await unlock_auto_cooking()) {
                log.debug("料理熟练度循环...");
            }
            log.info("刷满熟练度 任务结束...");
            // 返回主界面
            await genshin.returnMainUi();
            return null;
        }

        // 制作料理和特殊料理
        for (let i = 0; i < 2; i++) {
            let food_dic = await calculate_food(i !== 0);
            if (Object.keys(food_dic).length !== 0) {
                // 前往锅
                let flag = await go_and_interact("锅");
                if (!flag) {
                    log.error("未找到锅...");
                    return null;
                }
                for (const [f_name, f_num] of Object.entries(food_dic)) {
                    // 找到料理
                    let findResult = await find_and_click_food(f_name);
                    if (findResult) {
                        await escoffier_cook_for_u(f_name, f_num, i !== 0);
                    }
                }
                log.info("全部料理制作完毕...");
                // 返回主界面
                await genshin.returnMainUi();
            }
        }
    }

    await main();
})();