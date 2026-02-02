(async function () { // 鱼饵合成上限[]、鱼饵原料数不为2时可能出错[]、NPC的CD记录[]，OCR仍有识别错误的可能性，例如1111识别成11

    const bait_list = ["果酿饵", "赤糜饵", "蠕虫假饵", "飞蝇假饵", "甘露饵", "酸桔饵", "维护机关频闪诱饵", "澄晶果粒饵", "温火饵", "槲梭饵", "清白饵"]
    const material_msg = {
        "风缠": {"花鳉": 20, "蓝染花鳉": 20, "鸩棘鱼": 20, "流纹茶蝶鱼": 20},
        "愿者": {"花鳉": 20, "甜甜花鳉": 20, "斗棘鱼": 20, "流纹褐蝶鱼": 20},
        "鸣川鹈饲": {"花鳉": 20, "琉璃花鳉": 20, "肺棘鱼": 20, "流纹京紫蝶鱼": 20},
        "盘缘": {"花鳉": 20, "真果角鲀": 20, "暮云角鲀": 20, "吹沙角鲀": 20},
        "穿浪斗枪": {"维护机关·初始能力型": 20, "维护机关·水域清理者": 20, "维护机关·态势控制者": 20, "海涛斧枪鱼": 20},
        "长犀圆鸟和扁鱼": {"炽岩斗士急流鱼": 20, "拟似燃素独角鱼": 20, "青浪翻车鲀": 20, "晚霞翻车鲀": 20},
        "谧晖白枝": {"无奇巨斧鱼": 20, "素素凶凶鲨": 20, "蓝昼明眼鱼": 20, "夜色明眼鱼": 20},
        "渔获": {"雷鸣仙": 6, "金赤假龙": 20, "锖假龙": 20},
        "赤穗酒枡": {"雷鸣仙": 12, "炮鲀": 40, "苦炮鲀": 40},
        "竭泽": {"沉波蜜桃": 4, "青金斧枪鱼": 16, "翡玉斧枪鱼": 16},
        "原海鱼油": {"沉波蜜桃": 8, "青金斧枪鱼": 32, "翡玉斧枪鱼": 32},
        "灰河渡手": {"维护机关·白金典藏型": 4, "波波心羽鲈": 10, "烘烘心羽鲈": 10, "海涛斧枪鱼": 12},
        "马腾斯万能护养剂": {"维护机关·白金典藏型": 8, "波波心羽鲈": 20, "烘烘心羽鲈": 20, "海涛斧枪鱼": 24}
    }
    const fish_msg = { // [DEBUG] 从AEscoffier_main补充数据
        "花鳉": {"bait": "果酿饵", "num": 0},
        "波波心羽鲈": {"bait": "酸桔饵", "num": 0},
        "烘烘心羽鲈": {"bait": "酸桔饵", "num": 0},
        "维护机关·水域清理者": {"bait": "维护机关频闪诱饵", "num": 0},
        "维护机关·态势控制者": {"bait": "维护机关频闪诱饵", "num": 0},
        "维护机关·澄金领队型": {"bait": "维护机关频闪诱饵", "num": 0},
        "海涛斧枪鱼": {"bait": "甘露饵", "num": 0},
        "维护机关·初始能力型": {"bait": "维护机关频闪诱饵", "num": 0},
        "维护机关·白金典藏型": {"bait": "维护机关频闪诱饵", "num": 0},
        "吹沙角鲀": {"bait": "甘露饵", "num": 0},
        "甜甜花鳉": {"bait": "果酿饵", "num": 0},
        "擒霞客": {"bait": "果酿饵", "num": 0},
        "水晶宴": {"bait": "果酿饵", "num": 0},
        "斗棘鱼": {"bait": "赤糜饵", "num": 0},
        "炮鲀": {"bait": "飞蝇假饵", "num": 0},
        "流纹褐蝶鱼": {"bait": "蠕虫假饵", "num": 0},
        "锖假龙": {"bait": "飞蝇假饵", "num": 0},
        "金赤假龙": {"bait": "飞蝇假饵", "num": 0},
        "玉玉心羽鲈": {"bait": "酸桔饵", "num": 0},
        "赤魔王": {"bait": "赤糜饵", "num": 0},
        "长生仙": {"bait": "蠕虫假饵", "num": 0},
        "苦炮鲀": {"bait": "飞蝇假饵", "num": 0},
        "肺棘鱼": {"bait": "赤糜饵", "num": 0},
        "流纹京紫蝶鱼": {"bait": "蠕虫假饵", "num": 0},
        "琉璃花鳉": {"bait": "果酿饵", "num": 0},
        "伪装鲨鲨独角鱼": {"bait": "澄晶果粒饵", "num": 0},
        "繁花斗士急流鱼": {"bait": "澄晶果粒饵", "num": 0},
        "深潜斗士急流鱼": {"bait": "澄晶果粒饵", "num": 0},
        "晚霞翻车鲀": {"bait": "澄晶果粒饵", "num": 0},
        "青浪翻车鲀": {"bait": "澄晶果粒饵", "num": 0},
        "拟似燃素独角鱼": {"bait": "温火饵", "num": 0},
        "炽岩斗士急流鱼": {"bait": "温火饵", "num": 0},
        "蓝染花鳉": {"bait": "果酿饵", "num": 0},
        "鸩棘鱼": {"bait": "赤糜饵", "num": 0},
        "流纹茶蝶鱼": {"bait": "蠕虫假饵", "num": 0},
        "雪中君": {"bait": "赤糜饵", "num": 0},
        "真果角鲀": {"bait": "甘露饵", "num": 0},
        "青金斧枪鱼": {"bait": "甘露饵", "num": 0},
        "暮云角鲀": {"bait": "甘露饵", "num": 0},
        "翡玉斧枪鱼": {"bait": "甘露饵", "num": 0},
        "沉波蜜桃": {"bait": "甘露饵", "num": 0},
        "雷鸣仙": {"bait": "蠕虫假饵", "num": 0},
        "佛玛洛鳐": {"bait": "飞蝇假饵", "num": 0},
        "迪芙妲鳐": {"bait": "飞蝇假饵", "num": 0},
        "秘源机关·巡戒使": {"bait": "温火饵", "num": 0},
        "蓝昼明眼鱼": {"bait": "清白饵", "num": 0},
        "夜色明眼鱼": {"bait": "清白饵", "num": 0},
        "无奇巨斧鱼": {"bait": "槲梭饵", "num": 0},
        "素素凶凶鲨": {"bait": "清白饵", "num": 0},
        "炽铁巨斧鱼": {"bait": "槲梭饵", "num": 0},
        "虹光凶凶鲨": {"bait": "清白饵", "num": 0},
        "冷冽巨斧鱼": {"bait": "槲梭饵", "num": 0}
    }
    const bait_msg = {
        "果酿饵": ["日落果", "小麦"],
        "赤糜饵": ["血斛", "禽肉"],
        "蠕虫假饵": ["史莱姆凝液", "树莓"],
        "飞蝇假饵": ["绯樱绣球", "马尾"],
        "甘露饵": ["香辛果", "须弥蔷薇"],
        "酸桔饵": ["泡泡桔", "小麦"],
        "维护机关频闪诱饵": ["茉洁草", "铁块"],
        "澄晶果粒饵": ["澄晶实", "颗粒果"],
        "温火饵": ["烬芯花", "小麦"],
        "槲梭饵": ["夏槲果", "面粉"],
        "清白饵": ["白灵果", "薄荷"]
    }
    const ingredient = { // 加工产品
        "面粉": {"material": {"小麦": 1}, "time": 1},
        "兽肉": {"material": {"冷鲜肉": 1}, "time": 2},
        "鱼肉": {"material": fish_msg, "time": 2}, // 暂不考虑加工鱼肉，两个值均不定
        "神秘的肉加工产物": {"material": {"神秘的肉": 1}, "time": 1},
        "奶油": {"material": {"牛奶": 1}, "time": 3},
        "熏禽肉": {"material": {"禽肉": 3, "盐": 1}, "time": 5},
        "黄油": {"material": {"牛奶": 2}, "time": 5},
        "火腿": {"material": {"兽肉": 2, "盐": 1}, "time": 5},
        "糖": {"material": {"甜甜花": 2}, "time": 3},
        "香辛料": {"material": {"香辛果": 2}, "time": 1},
        "蟹黄": {"material": {"螃蟹": 4}, "time": 20},
        "果酱": {"material": {"日落果": 3, "树莓": 2, "糖": 1}, "time": 10},
        "奶酪": {"material": {"牛奶": 3}, "time": 10},
        "培根": {"material": {"兽肉": 2, "盐": 2}, "time": 15},
        "香肠": {"material": {"兽肉": 3}, "time": 20}
    }
    const accelerator_msg = { // s
        "铁块": 20,
        "白铁块": 40,
        "水晶块": 60,
        "魔晶块": 60,
        "星银矿石": 40,
        "紫晶块": 60,
        "萃凝晶": 60,
        "虹滴晶": 60
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
     * 在当前页面选购商品（餐馆、杂货店等商人NPC），购买完成后停留在商店界面
     * @param {string} name - 名称
     * @param {number} num - 数量
     * @param {boolean} detect - 启用摩拉检测
     * @returns {Promise<number|boolean>}
     *   - 成功时返回实际购买成功的商品数量（可能与实际数目不符[如果OCR兜底失败]）
     *   - 失败时返回 false（如不存在、售罄、资金不足[还没做]或其他错误）
     */
    async function select_goods(name, num, detect = false) { // [DEBUG] 暂未设置摩拉不足的情况
        let barUpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_up.png"), 1270, 112, 13, 831);
        let barDownRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_down.png"), 1270, 112, 13, 831);
        barUpRo.threshold = 0.8;
        barDownRo.threshold = 0.8;

        // 确保滑块位于顶端
        while (true) {
            let gameRegion = captureGameRegion();
            let barUpSite = gameRegion.Find(barUpRo);
            if (barUpSite.isExist()) {
                if (barUpSite.y >= 125) {
                    click(1276, 125);
                    await sleep(200);
                    log.debug(`尝试将滑块调至顶端，当前位置: ${barUpSite.y}`);
                } else {
                    log.debug(`滑块已位于顶端: ${barUpSite.y}`);
                    break
                }
            } else {
                log.error("未找到滑块: Up");
                return false;
            }
        }

        while (true) {
            let gameRegion = captureGameRegion();
            let ocrList = await Ocr(115, 89, 1142, 856, true); // 左侧列表区域
            let barDownSite = gameRegion.Find(barDownRo);
            gameRegion.dispose();
            if (ocrList) {
                for (let i = 0; i < ocrList.length; i++) {
                    if (ocrList[i].text.includes(name)) { // 找到name
                        let real_num = 0;
                        ocrList[i].Click();
                        await sleep(500);
                        let buy_btn = await Ocr(1631, 993, 150, 50); // 右下购买按钮

                        if (buy_btn) {
                            buy_btn.Click();
                            await sleep(500);
                            let available_num = await Ocr(1190, 588, 81, 27); // 最大可选数量
                            if (available_num) {
                                let max_num = parseInt(available_num.text, 10);

                                if (max_num < num) { // 拉满
                                    click(1185, 601); // 点击滑条最大值(736-1186)
                                    await sleep(500);
                                    if (detect) { // 检测摩拉是否充足
                                        let mora_ocr = Ocr(1609, 28, 162, 40);
                                        let cost_ocr = Ocr(961,682, 95, 32);
                                        if (cost_ocr && mora_ocr) {
                                            let cost = parseInt(cost_ocr, 10);
                                            let mora = parseInt(mora_ocr, 10);
                                            if (cost > mora) {
                                                log.error(`剩余摩拉不足: 需求(${cost})拥有(${mora})`);
                                                return false;
                                            }
                                        }
                                    }
                                    click(1181, 780); // 点击购买
                                    await sleep(500);
                                    click(1555, 827); // 点击空白区域
                                    await sleep(500);
                                    real_num = max_num;
                                } else { // 百分比选择数量(有误差，使用OCR修正)
                                    click(736 + Math.floor(450 * num / max_num), 601);
                                    await sleep(100);
                                    let current_num = await Ocr(904, 527, 115, 54); // 已选的数量
                                    if (current_num) { // [DEBUG]若false则可能有些许误差
                                        current_num = parseInt(current_num.text, 10);
                                        log.debug(`OCR识别的当前已选数量(需求: ${num}): ${current_num}`);
                                        if (current_num > num) {
                                            for (let k = 0; k < current_num - num; k++) { // -
                                                log.debug("-1");
                                                click(628, 602);
                                                await sleep(50);
                                            }

                                        } else if (current_num < num) {
                                            for (let k = 0; k < num - current_num; k++) { // +
                                                log.debug("+1");
                                                click(1292, 602);
                                                await sleep(50);
                                            }
                                        }
                                    }
                                    await sleep(500);
                                    if (detect) { // 检测摩拉是否充足
                                        let mora_ocr = Ocr(1609, 28, 162, 40);
                                        let cost_ocr = Ocr(961,682, 95, 32);
                                        if (cost_ocr && mora_ocr) {
                                            let cost = parseInt(cost_ocr, 10);
                                            let mora = parseInt(mora_ocr, 10);
                                            if (cost > mora) {
                                                log.error(`剩余摩拉不足: 需求(${cost})拥有(${mora})`);
                                                return false;
                                            }
                                        }
                                    }
                                    click(1181, 780); // 点击购买
                                    await sleep(500);
                                    click(1555, 827); // 点击空白区域
                                    await sleep(500);
                                    real_num = num;
                                }
                                return real_num;
                            } else {
                                log.error(`未识别到 ${name} 的剩余数量`);
                                keyPress("Escape");
                                await sleep(500);
                            }
                        } else {
                            log.info(`${name} 已售罄`);
                        }
                        return false
                    }
                }
                if (barDownSite.isExist()) { // [DEBUG] 以下重复代码段应当优化
                    if (barDownSite.y <= 920) {
                        click(1276, barDownSite.y + 15);
                        log.debug(`将滑块向下调一格，当前位置: ${barDownSite.y}`);
                        await sleep(200);
                    } else {
                        log.warn(`已经滑动到底部: y(${barDownSite.y})`); // [DEBUG] 滑动到底部未找到
                        return false;
                    }
                } else {
                    log.error("未找到滑块: Down");
                    return false;
                }
            } else if (barDownSite.isExist()) {
                if (barDownSite.y <= 920) {
                    click(1276, barDownSite.y + 15);
                    await sleep(200);
                } else {
                    log.warn(`已经滑动到底部: y(${barDownSite.y})，未找到 ${name}`); // [DEBUG] 滑动到底部未找到
                    return false;
                }
            } else {
                log.error(`OCR为空，且未找到滑块: Down`);
                return false;
            }
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
     * @returns {null}
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
     * 按照原神物品名长度显示裁剪字符串[主物品显示界面适用]（用于OCR）
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
     * 在当前合成台页面找到鱼饵，并读取当前鱼饵数量和原材料数量
     * @param {string} name - 鱼饵名称
     * @returns {Promise<number[]|boolean>}
     *   - 成功时返回鱼饵和对应的原材料数组，长度为3
     *   - 失败时返回 false
     */
    async function get_bait_material_num(name) {
        let shelter_option = await Ocr(165, 1001, 289, 32); // 筛选器文本

        if (shelter_option) {
            if (shelter_option.text !== "鱼饵") {
                await sleep(500);
                shelter_option.Click(); // 继续测试：没奏效？
                await sleep(500);

                let ocrList = await Ocr(17, 93, 748, 893, true); // 左侧区域文本

                if (ocrList.length !== 0) {
                    let flag = true;
                    for (let i = 0; i < ocrList.length; i++) {
                        if (ocrList[i].text.includes("鱼饵")) {
                            flag = false;
                            ocrList[i].Click();
                            await sleep(500);
                            break;
                        }
                    }
                    if (flag) {
                        log.error("未找到筛选项：鱼饵");
                        return false;
                    }
                } else {
                    log.error(`OCR错误，未识别到筛选文本`);
                    return false;
                }
            }
        } else {
            log.error(`OCR错误，未识别到筛选文本`);
            return false;
        }

        let ocrList = await Ocr(44, 171, 704, 807, true); // 左侧物品区域

        if (ocrList.length !== 0) {
            if (settings.use_levenshteinDistance) {
                let menu_bait_list = [];
                for (let i = 0; i < ocrList.length; i++) {
                    menu_bait_list.push(ocrList[i].text);
                }
                let closest_match = await findClosestMatch(await deal_string(name), menu_bait_list);

                ocrList[menu_bait_list.indexOf(closest_match)].Click();
                await sleep(500);
            } else {
                let flag = true;
                for (let i = 0; i < ocrList.length; i++) {
                    if (ocrList[i].text.includes(await deal_string(name))) {
                        flag = false;
                        ocrList[i].Click();
                        await sleep(500);
                        break
                    }
                }
                if (flag) {
                    log.error(`未找到鱼饵 ${name}，建议在JS脚本配置启用OCR优化`);
                    log.info(`鱼饵: ${name} 已跳过`);
                    return false;
                }
            }
        } else {
            log.error(`OCR错误，未识别到鱼饵文本`);
            return false;
        }

        // 记录两种原料的当前数量
        let material_num = [-1, -1];
        for (let k = 0; k < 2; k++) {
            click(k === 0 ? 1080: 1216, 874); // 点击原料1、2
            await sleep(500);
            let ocr_area = await Ocr(881, 763, 158, 267, true); // 中间 "当前拥有xxx" 部分区域
            if (ocr_area) {
                let refer_y;
                for (let i = 0; i < ocr_area.length; i++) {
                    if (ocr_area[i].text.includes("当前拥有")) {
                        refer_y = ocr_area[i].y;

                        for (let j = 0; j < ocr_area.length; j++) {
                            let string = ocr_area[j].text.replace(/\D/g, '');
                            if (string && ocr_area[j].y > refer_y - 12 && ocr_area[j].y < refer_y + 12) { // 纯数字且y坐标范围合理
                                material_num[k === 0 ? 0: 1] = parseInt(string, 10);
                                log.info(`识别到 ${name} 的原料${k === 0 ? 1: 2}(${bait_msg[name][k === 0 ? 0: 1]})数量: ${material_num[k === 0 ? 0: 1]}`);
                                click(1480, 974); // 点击空白处返回
                                await sleep(500);
                            }
                        }
                    }
                    if (material_num[k === 0 ? 0: 1] !== -1) break;
                }
                if (material_num[k === 0 ? 0: 1] === -1) {
                    log.error(`OCR错误，未定位到原料${k ===0 ? 1: 2}数量`);
                    click(1480, 974); // 点击空白处返回
                    await sleep(500);
                    return false;
                }
            } else {
                log.error(`OCR错误，未识别到原料${k === 0 ? 1: 2}文本`);
                click(1480, 974); // 点击空白处返回
                await sleep(500);
                return false;
            }
        }

        // 获取鱼饵数量
        click(1346, 399); // 点击鱼饵图标
        await sleep(500);
        let bait_num = -1;
        let ocr_area = await Ocr(881, 763, 158, 267, true); // 中间 "当前拥有xxx" 部分区域
        if (ocr_area.length !== 0) {
            let refer_y;
            for (let i = 0; i < ocr_area.length; i++) {
                if (ocr_area[i].text.includes("当前拥有")) {
                    refer_y = ocr_area[i].y;

                    for (let j = 0; j < ocr_area.length; j++) {
                        let string = ocr_area[j].text.replace(/\D/g, '');
                        if (string && ocr_area[j].y > refer_y - 12 && ocr_area[j].y < refer_y + 12) { // 纯数字且y坐标范围合理
                            let bait_num = parseInt(string, 10);
                            log.info(`识别到 ${name} 的数量: ${bait_num}`);
                            click(1480, 974); // 点击空白处返回
                            await sleep(500);
                            return [bait_num, material_num[0], material_num[1]]; // return
                        }
                    }
                }
                if (bait_num !== -1) break;
            }
            if (bait_num === -1) {
                log.error(`OCR错误，未定位到鱼饵 ${name} 数量`);
                click(1480, 974); // 点击空白处返回
                await sleep(500);
                return false;
            }
        } else {
            log.error(`OCR错误，未识别到鱼饵 ${name} 文本`);
            click(1480, 974); // 点击空白处返回
            await sleep(500);
            return false;
        }
    }

    /**
     * 在当前合成台页面找到并合成鱼饵，合成完成后停留在合成界面 [DEBUG]如果以后鱼饵种类大于20种则需要加入滑块策略
     * @param {string} name - 名称
     * @param {number} num - 数量
     * @returns {Promise<boolean>}
     */
    async function make_bait(name, num) {
        if (num === 0) return true;
        let shelter_option = await Ocr(165, 1001, 289, 32); // 筛选器文本

        if (shelter_option) {
            if (shelter_option.text !== "鱼饵") {
                shelter_option.Click();
                await sleep(500);

                let ocrList = await Ocr(17, 93, 748, 893, true); // 左侧区域文本

                if (ocrList.length !== 0) {
                    let flag = true;
                    for (let i = 0; i < ocrList.length; i++) {
                        if (ocrList[i].text.includes("鱼饵")) {
                            flag = false;
                            ocrList[i].Click();
                            await sleep(500);
                            break;
                        }
                    }
                    if (flag) {
                        log.error("未找到筛选项：鱼饵");
                        return false;
                    }
                } else {
                    log.error(`OCR错误，未识别到筛选文本`);
                    return false;
                }
            }
        } else {
            log.error(`OCR错误，未识别到筛选文本`);
            return false;
        }

        let ocrList = await Ocr(44, 171, 704, 807, true); // 左侧物品区域

        if (ocrList.length !== 0) {
            if (settings.use_levenshteinDistance) {
                let menu_bait_list = [];
                for (let i = 0; i < ocrList.length; i++) {
                    menu_bait_list.push(ocrList[i].text);
                }
                let closest_match = await findClosestMatch(await deal_string(name), menu_bait_list);

                ocrList[menu_bait_list.indexOf(closest_match)].Click();
                await sleep(500);
            } else {
                let flag = true;
                for (let i = 0; i < ocrList.length; i++) {
                    if (ocrList[i].text.includes(await deal_string(name))) {
                        flag = false;
                        ocrList[i].Click();
                        await sleep(500);
                        break
                    }
                }
                if (flag) {
                    log.error(`未找到鱼饵 ${name}，建议在JS脚本配置启用OCR优化`);
                    log.info(`鱼饵: ${name} 已跳过`);
                    return false;
                }
            }
        } else {
            log.error(`OCR错误，未识别到鱼饵文本`);
            return false;
        }

        // 记录两种原料的当前数量
        let material_num = [-1, -1];
        for (let k = 0; k < 2; k++) {
            click(k === 0 ? 1080: 1216, 874); // 点击原料1、2
            await sleep(500);
            let ocr_area = await Ocr(881, 763, 158, 267, true); // 中间 "当前拥有xxx" 部分区域
            if (ocr_area.length !== 0) {
                let refer_y;
                for (let i = 0; i < ocr_area.length; i++) {
                    if (ocr_area[i].text.includes("当前拥有")) {
                        refer_y = ocr_area[i].y;

                        for (let j = 0; j < ocr_area.length; j++) {
                            let string = ocr_area[j].text.replace(/\D/g, '');
                            if (string && ocr_area[j].y > refer_y - 12 && ocr_area[j].y < refer_y + 12) { // 纯数字且y坐标范围合理
                                material_num[k === 0 ? 0: 1] = parseInt(string, 10);
                                log.info(`识别到 ${name} 的原料${k === 0 ? 1: 2}(${bait_msg[name][k === 0 ? 0: 1]})数量: ${material_num[k === 0 ? 0: 1]}`);
                                click(1480, 974); // 点击空白处返回
                                await sleep(500);
                                break;
                            }
                        }
                    }
                    if (material_num[k === 0 ? 0: 1] !== -1) break;
                }
                if (material_num[k === 0 ? 0: 1] === -1) {
                    log.error(`OCR错误，未定位到原料${k ===0 ? 1: 2}数量`);
                    click(1480, 974); // 点击空白处返回
                    await sleep(500);
                    return false;
                }
            } else {
                log.error(`OCR错误，未识别到原料${k === 0 ? 1: 2}文本`);
                click(1480, 974); // 点击空白处返回
                await sleep(500);
                return false;
            }
        }

        if (material_num[0] - num < parseInt(settings.material_num, 10) || material_num[1] - num < parseInt(settings.material_num, 10)) {
            log.warn(`二次检查生效: 合成后剩余原料数过低(<${parseInt(settings.material_num, 10)})，本次合成跳过`);
            return true;
        }
        // 选择鱼饵数量并合成
        let max_num = material_num[0] < material_num[1] ? material_num[0]: material_num[1];
        click(1166 + Math.floor(359 * num < max_num ? num: max_num / max_num), 671);
        await sleep(100);
        let current_num = await Ocr(1264, 617, 158, 30); // 已选的合成次数文本区域
        if (current_num && max_num > num) { // [DEBUG]若false则可能有些许误差
            current_num = parseInt(current_num.text.replace(/\D/g, ''), 10);
            if (current_num > num) {
                for (let i = 0; i < current_num - num; i++) { // -
                    log.debug("-1");
                    click(1075, 671);
                    await sleep(50);
                }
            } else if (current_num < num) {
                for (let i = 0; i < num - current_num; i++) { // +
                    log.debug("+1");
                    click(1612, 671);
                    await sleep(50);
                }
            }
        }
        await sleep(500);

        click(1757, 1017); // 点击合成
        await sleep(500);
        click(1171, 756); // 点击确认
        await sleep(2000); // 合成动画
        click(1555, 827); // 点击空白区域
        await sleep(500);

        return true;
    }

    /**
     * 计算各种数值，各鱼饵实际合成次数，各原料的实际需求量，计算摩拉消耗和实际消耗（食材加工计算）
     * @returns {Promise<Object>}
     */
    async function calculate_values() {
        let bait_dic = {};

        // 获取要合成的鱼饵种类和数量（此处的数量为原始数量，后续判断是否需要更改）
        if (Array.from(settings.material_select).length !== 0) {
            let material_select = Array.from(settings.material_select);
            for (let i = 0; i < material_select.length; i++) {
                for (let j = 0; j < Object.keys(material_msg).length; j++) {
                    if (material_select[i].includes(Object.keys(material_msg)[j])) {
                        let fish_dic = material_msg[Object.keys(material_msg)[j]];
                        for (const [f_name, f_num] of Object.entries(fish_dic)) {
                            if (Object.keys(bait_dic).includes(f_name)) {
                                bait_dic[f_name][0] += f_num;
                            } else {
                                bait_dic[f_name] = [f_num, 0, 0];
                            }
                        }
                        break;
                    }
                }
            }
        } else if (Array.from(settings.bait_select).length !== 0) { // [DEBUG] parseInt可能的报错未处理
            let bait_select = Array.from(settings.bait_select);
            let bait_num = settings.bait_num.split(" ");
            if (bait_num.length === 1) {
                bait_num = parseInt(bait_num[0], 10);
                for (let i = 0; i < bait_select.length; i++) {
                    bait_dic[bait_select[i]] = [bait_num, 0, 0];
                }
            } else if (bait_num.length > 1 && bait_select.length === bait_num.length) {
                for (let i = 0; i < bait_select.length; i++) {
                    bait_dic[bait_select[i]] = [parseInt(bait_num[i], 10), 0, 0];
                }
            } else {
                log.error("鱼饵数量设置有误");
                return false;
            }
        }

        // 获取当前的鱼饵和原料数据
        let current_bait_dic = {}; // 供计算实际鱼饵需求数量和记录原料变化
        await go_and_interact("合成台"); // 进入合成台界面
        for (let i = 0; i < Object.keys(bait_dic).length; i++) {
            let num_list = await get_bait_material_num(Object.keys(bait_dic)[i]);
            if (num_list) {
                current_bait_dic[Object.keys(bait_dic)[i]] = num_list;
            } else {
                log.error(`鱼饵(${Object.keys(bait_dic)[i]})数据获取错误`);
                return false;
            }
        }

        // 计算实际鱼饵需求数量
        if (settings.select_method === "合成的鱼饵数量(设置200则合成200个)") {
            log.info(`选择的合成模式: ${settings.select_method}`);
        } else if (settings.select_method === "期望的鱼饵数量(设置200则合成到200个)") {
            log.info(`选择的合成模式: ${settings.select_method}`);

            for (let i = 0; i < Object.keys(bait_dic).length; i++) {
                let b_name = Object.keys(bait_dic)[i];
                let exp_bait_num = bait_dic[b_name][0];
                let cur_bait_num = current_bait_dic[b_name][0];
                if (exp_bait_num >= cur_bait_num) {
                    log.info(`实际需合成的鱼饵(${b_name})数: ${exp_bait_num - cur_bait_num}，期望(${exp_bait_num})、已有(${cur_bait_num})`);
                    bait_dic[b_name][0] = exp_bait_num - cur_bait_num;
                } else {
                    log.info(`鱼饵(${b_name})的数量已达标: 期望(${exp_bait_num})、已有(${cur_bait_num})`);
                    bait_dic[b_name][0] = 0;
                }
            }
        } else {
            // 留空
        }

        // 计算合成鱼饵需求的原料数量(鱼饵数除以10，最后向上取整)
        let material_dic = {}; // 存储原料需求数量（并非兑换材料）
        for (const [b_name, b_msg] of Object.entries(bait_dic)) {
            for (let i = 0; i < bait_msg[b_name].length; i++) {
                let material_name = bait_msg[b_name][i]; // 原料名

                if (Object.keys(material_dic).includes(material_name)) {
                    material_dic[material_name] += b_msg[0] / 10;
                } else {
                    material_dic[material_name] = b_msg[0] / 10;
                }
            }
        }
        for (const [m_name, m_num] of Object.entries(material_dic)) { // 向上取整
            material_dic[m_name] = Math.ceil(material_dic[m_name]);
        }

        // 根据鱼饵需求的原料量计算实际的原料需求量
        let critical_value = parseInt(settings.material_num, 10); // [DEBUG] 没加检测（懒得加了
        let current_material_dic = {}; // 存储账号张当前已有的对应原料量
        for (const[b_name, b_msg] of Object.entries(current_bait_dic)) {
            for (let i = 0; i < bait_msg[b_name].length; i++) {
                if (!(Object.keys(current_material_dic).includes(bait_msg[b_name][i]))) {
                    current_material_dic[bait_msg[b_name][i]] = b_msg[i + 1]; //
                }
            }
        }
        for (const [m_name, m_num] of Object.entries(material_dic)) {
            if (m_num + critical_value <= current_material_dic[m_name]) {
                material_dic[m_name] = 0; // 保底+合成所需小于已有数量，将实际所需设为0
            } else {
                material_dic[m_name] = m_num + critical_value - current_material_dic[m_name]; // 计算实际所需
            }
        }

        return {
            "exp_bait_dic": bait_dic, // x: [x, 0, 0]
            "cur_bait_dic": current_bait_dic, // x: [x, x, x]
            "material_dic": material_dic // x: x
        }
    }

    /**
     * 跑到指定位置并交互进入界面
     * @param type 类型
     * @param area 国家
     * @returns {Promise<boolean>} 是否成功进入
     * @see enter_store 对话并进入NPC商店，需要确保与NPC对话的F图标存在
     */
    async function go_and_interact(type, area = "蒙德") {
        // 返回主界面
        await genshin.returnMainUi();

        if (type === "合成台") {
            await sleep(500);
            await pathingScript.runFile(`assets/timaeus/${settings.timaeus_select}.json`);
            await sleep(500);
        } else if (type === "餐馆" || type === "杂货店" || type === "锅") {
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
     *
     * 调整加工食材到指定数量(1-999)后点击确定
     *
     * @param num 加工食材数量
     * @returns {Promise<void>}
     */
    async function set_ingredient_num(num) {
        click(961, 454); // 选中输入框
        await sleep(200);
        inputText(`${num}`);

        await sleep(500);
        await click(1190, 760); // 确认
        await sleep(200);
    }

    /**
     * 在烹饪/食材加工界面开始，自动收集并实现单个食材加工
     * @param name 要加工的物品名称
     * @param num 要加工的食材数量，为0时仅收集
     * @param accelerator 使用矿石加速
     * @returns {Promise<number|boolean>} 实际加工的数量
     */
    async function ingredient_process(name, num, accelerator = []) {
        await sleep(500);
        click(1008, 48); // 点击食材加工图标
        await sleep(500);

        let claim_all = await Ocr(198, 1003, 118, 31);
        if (claim_all && claim_all.text === "全部领取") {
            claim_all.Click(); // 全部领取
            await sleep(500);
            click(1569, 864); // 点击空白处
            await sleep(500);
        }

        // 找到 name (制作中也能找到)
        let flag = false;
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 8; x++) {
                click(178 + 147 * x, 197 + 175 * y);
                await sleep(300);

                let item_name = await Ocr(1334, 129, 440, 40);
                if (item_name && item_name.text.includes(name)) {
                    flag = true;
                    break;
                }
            }
            if (flag) break;
        }

        // 点击 制作
        click(1687, 1016);
        await sleep(500);
        let check_ocr = await Ocr(901, 524, 118, 31);
        if (check_ocr && check_ocr.text === "队列已满") {
            log.info(`食材加工(${name}): 队列已满...`);
            return 0;
        }

        let max_num_ocr = await Ocr(1215, 573, 76, 34);
        let max_num = -1;
        if (max_num_ocr) {
            let string = max_num_ocr.text.replace(/\D/g, '');
            if (string) {
                max_num = parseInt(string, 10);
            }
        }
        if (max_num === -1) {
            log.warn(`食材加工(${name})制作界面未检测到最大值文本，可能是数字过小`);
            keyPress("Escape");
            await sleep(500);
            return 0;
        }

        if (num < max_num) {
            await set_ingredient_num(num);
            return num;
        } else {
            await set_ingredient_num(max_num);
            return max_num;
        }
    }

    async function main() {
        /**
         * {
         *  "exp_bait_dic": bait_dic, // x: [x, 0, 0]
         *  "cur_bait_dic": current_bait_dic, // x: [x, x, x]
         *  "material_dic": material_dic // x: x
         * }
         */
        let data = await calculate_values();
        await go_and_interact("合成台");
        for (const[b_name, b_msg] of Object.entries(data["exp_bait_dic"])) {
            log.info(`开始合成: ${b_name} - ${b_msg[0]}个`);
            await make_bait(b_name, Math.ceil(b_msg[0] / 10));
        }
        
        // log.info(`${await get_bait_material_num("维护机关频闪诱饵")}`)
        // await make_bait("维护机关频闪诱饵", 10);
        // await enter_store();
        // await select_goods("小麦", 67);
    }

    await main();
})();
