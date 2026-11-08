// 「牌圣」v2.4.0
// 基于本地模型的七圣召唤自动对战脚本：可在对局任意阶段启动。
(async function () {
    "use strict";
    const downRolls = "{ \"macroEvents\": [ { \"type\": 6, \"mouseX\": 0, \"mouseY\": -120, \"time\": 0 }, { \"type\": 6, \"mouseX\": 0, \"mouseY\": 0, \"time\": 5 } ], \"info\": { \"name\": \"\", \"description\": \"\", \"x\": 0, \"y\": 0, \"width\": 1920, \"height\": 1080, \"recordDpi\": 1 } }";
    const SCRIPT_VERSION = "2.4.0";

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

    // BetterGI 用 HostTypeCollection(程序集名) 暴露 OpenCvSharp，
    // 实际命名空间对象在 OpenCvSharp.OpenCvSharp 下。
    // 宿主对象的可用时机不稳定，改为每次使用时解析，避免一次性缓存成 null。
    function opencvNs() {
        try {
            if (typeof OpenCvSharp === "undefined" || !OpenCvSharp) return null;
            const ns = OpenCvSharp.OpenCvSharp || OpenCvSharp;
            if (ns && ns.Cv2) return ns;
        } catch (e) {
            debugLog("OpenCvSharp 命名空间不可用: " + e);
        }
        return null;
    }

    // ==================== 设置读取 ====================
    function rawSetting(name) {
        try {
            if (typeof settings !== "undefined" && settings) {
                const value = settings[name];
                if (value !== undefined && value !== null) {
                    return value;
                }
            }
        } catch (e) {
        }
        return undefined;
    }

    function settingBool(name, fallback) {
        return parseBoolSetting(rawSetting(name), fallback);
    }

    function parseBoolSetting(value, fallback) {
        if (value === undefined || value === null) return fallback;
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value !== 0;
        const text = String(value).trim().toLowerCase();
        if (["false", "0", "off", "no", "否", "禁用", "关闭"].indexOf(text) >= 0) return false;
        if (["true", "1", "on", "yes", "是", "启用", "开启"].indexOf(text) >= 0) return true;
        return fallback;
    }

    // BetterGI 的 settings 是脚本启动时从脚本组配置读入的用户值（settings.json 里的 default 只是默认值，
// 用户勾选后实际值保存在脚本组配置中）。这里优先用 settings 里的用户值，settings.json 仅用于兜底。
    let settingsFileCache = { at: 0, entries: null };

    function settingsFileEntries() {
        const now = Date.now();
        if (now - settingsFileCache.at < 1500 && settingsFileCache.entries) {
            return settingsFileCache.entries;
        }
        settingsFileCache.at = now;
        try {
            const parsed = JSON.parse(readTextFile("settings.json"));
            const map = {};
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    if (item && item.name) map[item.name] = item.default;
                }
            } else if (parsed && typeof parsed === "object") {
                Object.assign(map, parsed);
            }
            settingsFileCache.entries = map;
        } catch (e) {
            // 读取失败时退回 BetterGI 的设置快照，不影响正常对战。
            settingsFileCache.entries = null;
        }
        return settingsFileCache.entries;
    }

    function liveSetting(name) {
        const direct = rawSetting(name);
        if (direct !== undefined && direct !== null) return direct;
        const entries = settingsFileEntries();
        if (entries && Object.prototype.hasOwnProperty.call(entries, name)) {
            return entries[name];
        }
        return direct;
    }

    function autoSurrenderEnabled() {
        return parseBoolSetting(liveSetting("autoSurrender"), true);
    }

    function surrenderThresholdValue() {
        const value = parseInt(liveSetting("surrenderThreshold"), 10);
        return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 10;
    }

    function settingInt(name, fallback, min, max) {
        const value = rawSetting(name);
        const parsed = parseInt(value, 10);
        let result = Number.isFinite(parsed) ? parsed : fallback;
        if (typeof min === "number") result = Math.max(min, result);
        if (typeof max === "number") result = Math.min(max, result);
        return result;
    }

    function settingString(name, fallback) {
        const value = rawSetting(name);
        if (value === undefined) return fallback;
        return String(value);
    }

    const CFG = {
        useModel: settingBool("useModel", true),
        modelFile: settingString("modelFile", "assets/model/policy.json"),
        actionDelayMs: settingInt("actionDelayMs", 200, 0, 2000),
        handCountMode: settingString("handCountMode", "自动（数字识别）"),
        scanZones: settingBool("scanZones", true),
        zoneClickFallback: settingBool("zoneClickFallback", true),
        characterStateScan: settingBool("characterStateScan", true),
        useActionCards: settingBool("useActionCards", true),
        writeTrace: settingBool("writeTrace", true),
        detailLog: settingBool("detailLog", false),
    };

    async function pause(ms) {
        await sleep(Math.max(0, (ms || 0) + CFG.actionDelayMs));
    }

    function debugLog(message) {
        if (CFG.detailLog) log.info(message);
    }

    // ==================== 与 Python 完全一致的特征定义 ====================
    const ELEMENTS = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo", "Omni"];
    const DICE_ELEMENTS = ELEMENTS;
    const ACTION_TYPES = ["normal", "skill", "burst", "switch", "tune", "end", "play_card"];

    const STATE_FEATURES = [
        "turn",
        "my_alive",
        "enemy_alive",
        "my_hp_ratio",
        "enemy_hp_ratio",
        "active_hp_ratio",
        "active_hp",
        "active_energy_ratio",
        "active_frozen",
        "dice_total",
        "dice_omni",
        "dice_matching",
        "hand_count",
        "enemy_attached_any",
        "reaction_bonus",
        "lethal_available",
        "could_die_next",
        "active_catalyst",
        "enemy_active_hp_ratio",
        "enemy_active_energy_ratio",
        "enemy_active_frozen",
        "my_support_count",
        "enemy_support_count",
        "my_summon_count",
        "enemy_summon_count",
        "my_support_counter",
        "enemy_support_counter",
        "my_summon_counter",
        "enemy_summon_counter",
        "my_summon_damage",
        "enemy_summon_damage",
        "hand_known",
        "hand_value",
        "hand_best_value",
    ].concat(
        ELEMENTS.map(function (name) { return "my_element_" + name; }),
        ELEMENTS.map(function (name) { return "enemy_element_" + name; }),
        ELEMENTS.map(function (name) { return "enemy_attached_" + name; }),
        // 阵亡风险与结束阶段结算：只用于专家启发式的字段也进入模型输入，
        // 让模型能直接学到“该防守/该换人/别急着结束”的规则。
        [
            "active_in_danger",
            "defense_available",
            "switch_cost",
            "enemy_threat",
            "my_end_damage",
            "enemy_end_damage",
            "my_end_heal",
            "enemy_end_heal",
        ],
        // 结束阶段伤害的元素分布与可触发的反应加成，供模型区分“1点物理”和“2点蒸发”。
        ELEMENTS.map(function (name) { return "my_end_element_" + name; }),
        ELEMENTS.map(function (name) { return "enemy_end_element_" + name; }),
        ["my_end_reaction", "enemy_end_reaction"],
        // 角色详情面板条目数与区域卡识别质量：图标模板只有 6 张，面板能补上看不见的状态。
        ["my_role_states", "enemy_role_states", "my_faction_states", "enemy_faction_states",
            "my_faction_counters", "enemy_faction_counters",
            "my_summon_unknown", "enemy_summon_unknown"]
    );

    const ACTION_FEATURES = ACTION_TYPES.map(function (name) { return "type_" + name; }).concat([
        "dice_cost",
        "tune",
        "affordable",
        "expected_damage",
        "reaction_bonus",
        "kills_target",
        "is_switch",
        "target_hp_ratio",
        "self_hp_ratio",
        "element_matches_active",
        "is_active_action",
        "is_damage_action",
        "target_is_enemy_active",
        "card_cost",
        "card_value",
        "card_needs_target",
        "card_is_support",
        "card_is_event",
        "card_is_equipment",
        "card_has_damage",
        "card_has_heal",
        "card_has_draw",
        "card_has_dice",
        "tune_card_value",
        "switch_gain",
        "switch_frozen",
        "card_is_defensive",
    ]);

    const INPUT_DIM = STATE_FEATURES.length + ACTION_FEATURES.length;

    const ELEMENT_CN = {
        "火": "Pyro",
        "水": "Hydro",
        "风": "Anemo",
        "雷": "Electro",
        "草": "Dendro",
        "冰": "Cryo",
        "岩": "Geo",
        "万能": "Omni",
        "物理": "Physical",
        "穿透": "Piercing",
        "冻结": "Freeze",
        "无": "None",
    };
    const ATTACHABLE_ELEMENTS = ["Pyro", "Hydro", "Electro", "Dendro", "Cryo"];

    // 与 features.py 的 REACTION_BONUS 保持一致
    const REACTION_BONUS = new Map();
    [
        ["Pyro", "Hydro", 2],
        ["Hydro", "Pyro", 2],
        ["Pyro", "Cryo", 2],
        ["Cryo", "Pyro", 2],
        ["Pyro", "Electro", 2],
        ["Electro", "Pyro", 2],
        ["Electro", "Hydro", 1],
        ["Hydro", "Electro", 1],
        ["Electro", "Cryo", 1],
        ["Cryo", "Electro", 1],
        ["Electro", "Dendro", 1],
        ["Dendro", "Electro", 1],
        ["Hydro", "Cryo", 1],
        ["Cryo", "Hydro", 1],
        ["Hydro", "Dendro", 1],
        ["Dendro", "Hydro", 1],
        ["Pyro", "Dendro", 1],
        ["Dendro", "Pyro", 1],
    ].forEach(function (item) {
        REACTION_BONUS.set(item[0] + ">" + item[1], item[2]);
    });
    ELEMENTS.forEach(function (element) {
        if (element !== "Geo" && element !== "Omni") {
            const key = "Geo>" + element;
            if (!REACTION_BONUS.has(key)) REACTION_BONUS.set(key, 1);
        }
        if (element !== "Anemo" && element !== "Omni") {
            const key = "Anemo>" + element;
            if (!REACTION_BONUS.has(key)) REACTION_BONUS.set(key, 1);
        }
    });

    function reactionBonus(attacker, attached) {
        if (!attacker || !attached) return 0;
        return REACTION_BONUS.get(attacker + ">" + attached) || 0;
    }

    // 敌方技能能对我方出战角色打出的最高反应加成：反应按“受击角色身上的附着”结算。
    function maxEnemyReactionBonus(enemy, active) {
        if (!enemy || !active || !active.attached) return 0;
        let best = 0;
        for (const skill of enemy.skills || []) {
            if (!skill || skill.type === "被动技能") continue;
            const cost = parseSkillCost(skill.cost);
            if (num(cost.energy) > num(enemy.chargeFilled)) continue;
            const info = parseSkillDamage(skill.effect_text);
            if (!info.damage) continue;
            const element = info.element || enemy.element || "";
            best = Math.max(best, reactionBonus(element, active.attached));
        }
        return best;
    }

    // 敌方能否用当前可放的技能冻结我方出战角色：水/冰互相命中会冻结，代价是丢掉一次行动。
    function enemyFreezeRisk(enemy, active) {
        if (!enemy || !active || isCharacterDisabled(active)) return false;
        const attached = active.attached || "";
        if (attached !== "Hydro" && attached !== "Cryo") return false;
        for (const skill of enemy.skills || []) {
            if (!skill || skill.type === "被动技能") continue;
            const cost = parseSkillCost(skill.cost);
            if (num(cost.energy) > num(enemy.chargeFilled)) continue;
            const info = parseSkillDamage(skill.effect_text);
            if (!info.damage) continue;
            const element = info.element || enemy.element || "";
            if ((element === "Cryo" && attached === "Hydro") ||
                (element === "Hydro" && attached === "Cryo")) {
                return true;
            }
        }
        return false;
    }

    // 反应除面板加成外还有冻结/感电溅射/结晶护盾等附带价值，只参与打分，不进模型输入。
    function reactionSideValue(state, action) {
        const element = action.damage_element || "";
        const attached = num(state.enemy_attached_any) ? state.enemy_attached_element : "";
        if (!element || !attached || !num(action.expected_damage)) return 0;
        if (!reactionBonus(element, attached)) return 0;
        let value = 0;
        const standby = Math.max(0, num(state.enemy_alive) - 1);
        // 扩散/感电/超导会把伤害溅到后台角色，敌方存活越多越值钱。
        if (element === "Anemo" ||
            (element === "Electro" && (attached === "Hydro" || attached === "Cryo"))) {
            value += 0.18 * Math.min(2, standby);
        }
        if (element === "Geo") value += 0.12;
        const freezes = (element === "Cryo" && attached === "Hydro") ||
            (element === "Hydro" && attached === "Cryo");
        if (freezes && !num(state.enemy_active_frozen)) value += 0.55;
        return value;
    }

    // 换人后敌方对我方新出战角色的反应加成（用敌方出战元素近似技能元素）。
    function switchReactionExposure(state, action) {
        const characters = state.characters && state.characters.user;
        const target = characters && characters[num(action.switch_index)];
        if (!target) return null;
        return reactionBonus(state.enemy_element || "", target.attached || "");
    }

    function clamp(value, low, high) {
        return Math.max(low, Math.min(high, value));
    }

    function num(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : (typeof fallback === "number" ? fallback : 0);
    }

    function boolNum(value) {
        return value ? 1 : 0;
    }

    function sumDice(dice) {
        let total = 0;
        if (dice) {
            for (const key of Object.keys(dice)) total += num(dice[key]);
        }
        return total;
    }

    // ==================== 资源路径 ====================
    const PIC_PATHS = {
        MainPyro: "assets/dice/MainPyro.png",
        MainHydro: "assets/dice/MainHydro.png",
        MainAnemo: "assets/dice/MainAnemo.png",
        MainElectro: "assets/dice/MainElectro.png",
        MainDendro: "assets/dice/MainDendro.png",
        MainCryo: "assets/dice/MainCryo.png",
        MainGeo: "assets/dice/MainGeo.png",
        MainOmni: "assets/dice/MainOmni.png",
        RollPyro: "assets/dice/RollPyro.png",
        RollHydro: "assets/dice/RollHydro.png",
        RollAnemo: "assets/dice/RollAnemo.png",
        RollElectro: "assets/dice/RollElectro.png",
        RollDendro: "assets/dice/RollDendro.png",
        RollCryo: "assets/dice/RollCryo.png",
        RollGeo: "assets/dice/RollGeo.png",
        RollOmni: "assets/dice/RollOmni.png",
        Hand5: "assets/num/Hand5.png",
        Hand6: "assets/num/Hand6.png",
        Hand7: "assets/num/Hand7.png",
        Hand8: "assets/num/Hand8.png",
        Hand9: "assets/num/Hand9.png",
        Hand10: "assets/num/Hand10.png",
        disable: "assets/disable.png",
        setting: "assets/setting.png",
        userTurn: "assets/user_turn.png",
        enemyTurn: "assets/enemy_turn.png",
        tuningConfirm: "assets/ui/tuning_confirm.png",
        equipConfirm: "assets/ui/equip_confirm.png",
        diceLack: "assets/ui/dice_lack.png",
        charge: "assets/charge.png",
        uncharge: "assets/uncharge.png",
        StatePyro: "assets/state/StatePyro.png",
        StateHydro: "assets/state/StateHydro.png",
        StateElectro: "assets/state/StateElectro.png",
        StateDendro: "assets/state/StateDendro.png",
        StateCryo: "assets/state/StateCryo.png",
        StateFreeze: "assets/state/StateFreeze.png",
        digit_0: "assets/hand/digit_0.png",
        digit_1: "assets/hand/digit_1.png",
        digit_2: "assets/hand/digit_2.png",
        digit_3: "assets/hand/digit_3.png",
        digit_5: "assets/hand/digit_5.png",
    };

    const HAND_DIGITS = ["digit_0", "digit_1", "digit_2", "digit_3", "digit_5"];
    // 最近一次数字识别到的每个费用数字（含位置），用于把卡面实际费用对齐到手牌顺序。
    let lastHandDigitEntries = [];
    const HAND_DIGIT_SEARCH = { x: 400, y: 770, w: 1350, h: 130 };
    // 0.75 会让费用“2”这类边缘匹配（实测 0.751）偶发丢失，手牌被少数一张后
    // 调和落点会偏到两张牌之间的缝隙；同一区域其他数字模板最高只有 0.54，0.70 安全。
    const HAND_DIGIT_THRESHOLD = 0.70;
    const HAND_DIGIT_DEDUPE = 22;
    const HAND_TEMPLATE_SEARCH = { x: 1463, y: 700, w: 439, h: 124 };

    // 角色牌充能区域
    const CHARGE_AREA = {
        size: [32, 180],
        enemy31: [812, 185],
        enemy32: [1022, 185],
        enemy33: [1233, 185],
        user31: [812, 612],
        user32: [1022, 612],
        user33: [1233, 612],
        enemy41: [708, 185],
        enemy42: [919, 185],
        enemy43: [1126, 185],
        enemy44: [1337, 185],
        enemy21: [918, 185],
        enemy22: [1128, 185],
        enemy11: [1022, 185],
    };

    // 角色牌状态区域
    const STATE_AREA = {
        size: [167, 382],
        enemy31: [663, 105],
        enemy32: [876, 105],
        enemy33: [1089, 105],
        user31: [663, 545],
        user32: [876, 545],
        user33: [1089, 545],
        enemy41: [562, 105],
        enemy42: [774, 105],
        enemy43: [984, 105],
        enemy44: [1193, 105],
        enemy21: [857, 185],
        enemy22: [1070, 185],
        enemy11: [1022, 185],
    };

    // 角色牌血量区域：[x, 非出战y, 出战y]（敌方出战靠下，我方出战靠上）
    const HP_AREA = {
        size: [58, 40],
        enemy31: [646, 170, 212],
        enemy32: [856, 170, 212],
        enemy33: [1066, 170, 212],
        user31: [646, 600, 640],
        user32: [856, 600, 640],
        user33: [1066, 600, 640],
        enemy41: [541, 170, 212],
        enemy42: [751, 170, 212],
        enemy43: [961, 170, 212],
        enemy44: [1171, 170, 212],
        enemy21: [751, 170, 212],
        enemy22: [962, 170, 212],
        enemy11: [856, 170, 212],
    };

    // 手牌展开后的位置（1-10 张）
    const HAND_POSITIONS = {
        1: { 1: [1120, 945] },
        2: { 1: [1019, 945], 2: [1222, 945] },
        3: { 1: [914, 945], 2: [1117, 945], 3: [1322, 945] },
        4: { 1: [812, 945], 2: [1013, 945], 3: [1216, 945], 4: [1424, 945] },
        5: { 1: [719, 945], 2: [913, 945], 3: [1115, 945], 4: [1319, 945], 5: [1528, 945] },
        6: { 1: [614, 945], 2: [811, 945], 3: [1012, 945], 4: [1216, 945], 5: [1423, 945], 6: [1625, 945] },
        7: { 1: [635, 945], 2: [799, 945], 3: [961, 945], 4: [1117, 945], 5: [1279, 945], 6: [1438, 945], 7: [1603, 945] },
        8: { 1: [605, 945], 2: [751, 945], 3: [893, 945], 4: [1042, 945], 5: [1177, 945], 6: [1325, 945], 7: [1471, 945], 8: [1618, 945] },
        9: { 1: [587, 945], 2: [716, 945], 3: [847, 945], 4: [976, 945], 5: [1103, 945], 6: [1225, 945], 7: [1352, 945], 8: [1492, 945], 9: [1634, 945] },
        10: { 1: [563, 945], 2: [686, 945], 3: [810, 945], 4: [932, 945], 5: [1048, 945], 6: [1168, 945], 7: [1288, 945], 8: [1408, 945], 9: [1528, 945], 10: [1649, 945] },
    };

    // 技能按钮位置：0 为四主动技能角色的普攻位置，1 为三主动技能角色的普攻位置
    const SKILL_POSITIONS = {
        0: [1500, 957],
        1: [1608, 957],
        2: [1716, 957],
        3: [1824, 957],
    };

    const ENEMY_CARD_X = {
        1: [959],
        2: [857, 1070],
        3: [750, 960, 1175],
        4: [648, 860, 1070, 1275],
    };
    const USER_CARD_X = [750, 960, 1175];
    const USER_CARD_CLICK_Y = 720;
    const ENEMY_CARD_CLICK_Y = 330;
    const RESET_X = 1190;
    const RESET_Y = 545;

    // 元素调和：展开手牌后点击卡牌，拖到右侧骰子区，再点“元素调和”确认按钮。
    const TUNE_HAND_Y = 1030;
    const TUNE_DROP_X = 1870;
    const TUNE_DROP_Y = 540;
    // 价值达到该阈值的牌不再用于调和，宁可放弃技能也不烧掉关键装备/圣遗物。
    const TUNE_MIN_CARD_VALUE = 2.4;

    // ==================== 文件/图片访问 ====================
    // 对局轨迹与调试截图统一放在 logs/ 下，保持脚本根目录干净。
    const LOG_DIR = "logs";

    function ensureDirectory(path) {
        try {
            if (typeof file.CreateDirectory === "function") return file.CreateDirectory(path);
            if (typeof file.createDirectory === "function") return file.createDirectory(path);
        } catch (e) {
            debugLog("创建目录失败: " + path + " " + e);
        }
        return false;
    }

    function readTextFile(path) {
        if (typeof file.readTextSync === "function") return file.readTextSync(path);
        return file.ReadTextSync(path);
    }

    function writeTextFile(path, content, append) {
        if (typeof file.writeTextSync === "function") return file.writeTextSync(path, content, !!append);
        return file.WriteTextSync(path, content, !!append);
    }

    function readImageMat(path) {
        if (typeof file.readImageMatSync === "function") return file.readImageMatSync(path);
        return file.ReadImageMatSync(path);
    }

    // 识别卡住时存一张现场截图，便于事后核对游戏 UI，不参与正常流程。
    function saveDebugScreenshot(tag) {
        let region = null;
        try {
            region = captureGameRegion();
            const mat = region.srcMat || region.SrcMat;
            if (!mat) {
                debugLog("调试截图失败: 截图为空");
                return;
            }
            const path = LOG_DIR + "/debug_" + tag + "_" + Date.now() + ".png";
            ensureDirectory(LOG_DIR);
            if (typeof file.writeImageSync === "function") file.writeImageSync(path, mat);
            else file.WriteImageSync(path, mat);
            log.info("调试截图已保存: " + path);
        } catch (e) {
            debugLog("调试截图保存失败: " + e);
        } finally {
            if (region) region.dispose();
        }
    }

    const matCache = Object.create(null);

    function getMat(key) {
        if (Object.prototype.hasOwnProperty.call(matCache, key)) {
            return matCache[key];
        }
        const path = PIC_PATHS[key];
        if (!path) {
            matCache[key] = null;
            return null;
        }
        try {
            matCache[key] = readImageMat(path);
        } catch (e) {
            log.error("读取模板失败: " + path + " | " + e);
            matCache[key] = null;
        }
        return matCache[key];
    }

    // ==================== 卡牌库 ====================
    let cardDic = null;
    let cardIndex = [];
    let actionCardIndex = [];

    function normalizeCardKey(text) {
        return String(text || "")
            .replace(/\[详情\]/g, "")
            .replace(/[\s·・:：\-—_（）()「」『』《》【】\[\],，。.!！?？]/g, "")
            .trim();
    }

    function levenshteinDistance(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        let previous = new Array(b.length + 1);
        let current = new Array(b.length + 1);
        for (let j = 0; j <= b.length; j++) previous[j] = j;
        for (let i = 1; i <= a.length; i++) {
            current[0] = i;
            const ca = a.charCodeAt(i - 1);
            for (let j = 1; j <= b.length; j++) {
                const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
                current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
            }
            const temp = previous;
            previous = current;
            current = temp;
        }
        return previous[b.length];
    }

    function findClosestCardName(raw, allowedTypes, allowedCtypes, sourceIndex) {
        const key = normalizeCardKey(raw);
        if (!key) return "";
        const pool = sourceIndex || cardIndex;
        let bestName = "";
        let bestDistance = Infinity;
        for (const item of pool) {
            if (allowedTypes && allowedTypes.indexOf(item.type) < 0) continue;
            if (allowedCtypes && allowedCtypes.indexOf(item.ctype) < 0) continue;
            const distance = levenshteinDistance(key, item.key);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestName = item.name;
            }
        }
        if (!bestName) return "";
        // 两字卡名必须完全一致；短名字允许一次误差，长名字按长度放宽。
        // 否则「爱可菲」这类未收录角色会被距离 2 的「可莉」顶替，整局按错误角色决策。
        const maxAllowed = key.length <= 2 ? 0 : Math.max(1, Math.floor((key.length - 1) / 3));
        if (bestDistance > maxAllowed) {
            debugLog("卡名匹配偏差过大，按未知卡牌处理: " + raw + " -> " + bestName + " (d=" + bestDistance + ")");
            return "";
        }
        return bestName;
    }

    function loadCardDictionary() {
        try {
            cardDic = JSON.parse(readTextFile("assets/card_dic.json"));
            cardIndex = Object.keys(cardDic).map(function (name) {
                return {
                    name: name,
                    key: normalizeCardKey(name),
                    type: cardDic[name].type,
                    ctype: cardDic[name].ctype || "",
                };
            });
            actionCardIndex = cardIndex.filter(function (item) {
                return item.type !== "角色牌" && item.type !== "魔物牌";
            });
            log.info("卡牌库加载完成: " + cardIndex.length + " 张（手牌 " + actionCardIndex.length + "）");
            return true;
        } catch (e) {
            log.error("卡牌库读取失败: " + e);
            cardDic = null;
            cardIndex = [];
            actionCardIndex = [];
            return false;
        }
    }

    function parseChargeMax(value) {
        const match = String(value || "").match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function makeCardEntry(name, rawName) {
        const data = (cardDic && cardDic[name]) || {};
        // 未收录的新角色保留 OCR 原名，避免显示成「未知」后被误当成通用角色。
        const fallbackName = String(rawName || "").replace(/\[详情\]/g, "").trim();
        const displayName = name || fallbackName || "未知";
        const isCharacter = data.type === "角色牌" || data.type === "魔物牌";
        let skills = Array.isArray(data.skills) ? data.skills : [];
        if (!skills.length) {
            skills = [{
                id: 0,
                name: "普通攻击",
                type: "普通攻击",
                cost: { "万能元素": 1 },
                effect_text: "造成2点物理伤害。",
            }];
        }
        return {
            name: displayName,
            rawName: rawName || "",
            type: data.type || "无",
            ctype: data.ctype || "",
            fullName: data.full_name || displayName,
            rawElement: data.element || "",
            element: isCharacter ? elementToEn(data.element || "") : "",
            weapon: data.weapon || "",
            maxHp: Number(data.health) || 10,
            skills: skills,
            chargeMax: parseChargeMax(data.charge),
            hp: null,
            active: false,
            chargeFilled: 0,
            chargeEmpty: 0,
            states: [],
            attached: "",
            panelStates: [],
            panelEntries: [],
            panelStateTurn: -1,
            panelStateFailTurn: -1,
        };
    }

    function createCardFromOcr(rawName) {
        const name = findClosestCardName(rawName, ["角色牌", "魔物牌"]);
        return makeCardEntry(name, rawName);
    }

    // ==================== 手牌 ====================
    function parseCardCost(cost) {
        const info = { dice: 0, matching: 0, omni: 0, energy: 0 };
        if (!cost || typeof cost !== "object") return info;
        for (const key of Object.keys(cost)) {
            const value = num(cost[key]);
            if (key.indexOf("充能") >= 0) {
                info.energy += value;
            } else if (key.indexOf("秘传") >= 0) {
                // 秘传是卡牌标签，不是骰子费用。
                continue;
            } else if (key.indexOf("相同") >= 0) {
                info.dice += value;
                info.matching += value;
            } else if (key.indexOf("万能") >= 0) {
                info.dice += value;
                info.omni += value;
            } else {
                info.dice += value;
                info.matching += value;
            }
        }
        return info;
    }

    function cardEffectTags(text) {
        const source = String(text || "");
        return {
            damage: /造成\s*\d+\s*点/.test(source),
            heal: /治疗|回复\s*\d+\s*点生命/.test(source),
            draw: /抓\s*\d*\s*张牌|抽取/.test(source),
            dice: /元素骰|骰子|少花费/.test(source),
            energy: /充能/.test(source),
            summon: /召唤物|召唤/.test(source),
            control: /冻结|眩晕|石化|束缚|击倒/.test(source),
            buff: /伤害\+|攻击力|生命值上限|护盾/.test(source),
            food: /料理|饱腹/.test(source),
        };
    }

    function makeHandCard(name, rawName, index) {
        const data = (cardDic && cardDic[name]) || {};
        const effect = data.effect_text || "";
        const damageMatch = effect.match(/造成\s*(\d+)\s*点[^。；\n]{0,14}?伤害/);
        return {
            index: index,
            name: name || "未知",
            rawName: rawName || "",
            known: !!name,
            ctype: data.ctype || "",
            label: data.label || "",
            means: data.means || "",
            effect: effect,
            cost: parseCardCost(data.cost),
            costRaw: data.cost || {},
            // 卡面数字就是减费后的实际费用；识别到数字后不再叠加本回合减费，避免重复扣减。
            costFromDigits: false,
            damage: damageMatch ? parseInt(damageMatch[1], 10) : 0,
            damageElement: elementFromDescription(effect),
            tags: cardEffectTags(effect),
            value: 0,
            playFailed: false,
        };
    }

    // 手牌价值只用于“烧哪张”和出牌排序，数值来自本地 card_dic 的费用与效果描述。
    function cardUtility(card, game) {
        if (!card || !card.known) return 0;
        const active = game.getActiveUser();
        const activeHp = active ? (active.hp === null ? active.maxHp : num(active.hp)) : 10;
        const tags = card.tags || {};
        let value = 1.0 + 0.25 * num(card.cost.dice);
        if (tags.draw) value += 1.2;
        if (tags.dice) value += 0.9;
        if (tags.energy) value += 0.7;
        if (tags.summon) value += 0.8;
        if (tags.damage) value += 0.8;
        if (tags.control) value += 0.9;
        if (tags.buff) value += 0.6;
        if (tags.heal) value += activeHp <= 5 ? 1.4 : 0.3;
        if (tags.food) value += activeHp <= 5 ? 0.8 : 0.2;
        if (card.ctype === "装备牌") value += 0.6;
        if (card.label === "特技") value -= 1.2;
        return clamp(value, 0.1, 5);
    }

    function refreshHandValues(game) {
        for (const card of game.handCards) card.value = cardUtility(card, game);
    }

    function pickTuneCard(game) {
        const cards = game.handCards || [];
        if (!cards.length || cards.length !== game.handCount) return -1;
        refreshHandValues(game);
        let best = -1;
        let bestValue = Infinity;
        for (const card of cards) {
            // 未识别的牌按中等价值处理，优先烧已知的低价值牌。
            const value = card.known ? card.value : 1.5;
            if (value < bestValue) {
                bestValue = value;
                best = card.index;
            }
        }
        return best;
    }

    // 与 pickTuneCard 保持一致：返回接下来会被烧掉的那张牌的价值。
    function tuneCardValue(game) {
        const index = pickTuneCard(game);
        if (index < 0) return 0;
        const card = (game.handCards || []).find(function (item) { return item.index === index; });
        if (!card) return 0;
        return card.known ? card.value : 1.5;
    }

    // 实际可烧的牌数：低于 TUNE_MIN_CARD_VALUE 的牌才允许调和，
    // 否则模型会规划一个根本执行不了的调和，白白浪费回合。
    function tuneableCardCount(game) {
        const handCount = Math.max(0, num(game.handCount));
        if (handCount <= 0) return 0;
        const cards = game.handCards || [];
        if (!cards.length) return handCount;
        refreshHandValues(game);
        let usable = 0;
        for (const card of cards) {
            const value = card.known ? card.value : 1.5;
            if (value < TUNE_MIN_CARD_VALUE) usable += 1;
        }
        const unknownSlots = handCount - cards.length;
        if (unknownSlots > 0) usable += unknownSlots;
        return Math.max(0, Math.min(handCount, usable));
    }

    // 这类事件牌会打开脚本无法完成的二级选择界面（选牌/选元素/交换手牌），直接跳过。
    function isRiskyEventCard(card) {
        if (!card || card.ctype !== "事件牌") return false;
        return /挑选|随机\s*\d+\s*张|交换双方手牌|选择\s*\d+\s*个元素|弃置\s*\d+\s*张/.test(card.effect || "");
    }

    // 需要选择召唤物目标的牌脚本还不会点目标，先当不可用，避免白交一次行动再被系统打回。
    function cardNeedsUnsupportedTarget(card) {
        if (!card || card.ctype !== "事件牌") return false;
        return /选择\s*(?:一个|1\s*个)?\s*(?:我方|敌方)?\s*「?召唤物」?/.test(card.effect || "");
    }

    // 打出后立刻往召唤区放一个召唤物的事件牌（「召唤跳跳纸蛙」「召唤一个独立的增殖生命体」）。
    // 支援/装备牌里的「召唤」多是延后触发的效果，不在这里算；「召唤物」三字连写则要排除。
    function cardCreatesSummon(card) {
        if (!card || card.ctype !== "事件牌") return false;
        return /召唤[^物「\s]/.test(String(card.effect || ""));
    }

    // 召唤区每侧 2×2 共 4 格，满了以后游戏不会接受新的召唤物事件牌。
    function summonSlotsFilled(game, side) {
        const zone = game && game.zones ? game.zones[side || "user"] : null;
        if (!zone) return 0;
        const occupied = Array.isArray(zone.summonOccupied) ? zone.summonOccupied : [];
        return Math.max(occupied.filter(Boolean).length, (zone.summons || []).length);
    }

    function isPlayableHandCard(card, game) {
        if (!card || !card.known || card.playFailed) return false;
        if (card.value < 1.6) return false;
        if (isRiskyEventCard(card)) return false;
        if (cardNeedsUnsupportedTarget(card)) return false;
        if (cardCreatesSummon(card) && summonSlotsFilled(game, "user") >= SUMMON_SLOTS) return false;
        // “本回合有我方角色被击倒，才能打出”的牌，没人倒下时游戏不会接受，先别浪费动作。
        if (/本回合有我方角色被击倒/.test(String(card.effect || "")) &&
            (!game || game.defeatTurn !== game.turn)) return false;
        if (card.ctype === "支援牌" || card.ctype === "场地牌") return true;
        if (card.ctype === "装备牌") return true;
        if (card.ctype === "事件牌") return true;
        return false;
    }

    function cardNeedsTarget(card) {
        if (!card) return false;
        if (card.ctype === "装备牌") return true;
        return !!(card.tags && card.tags.food);
    }

    // 出战角色可能被一击带走时，治疗/护盾/免击倒这类牌比继续输出更值钱。
    function cardIsDefensive(card, action) {
        if (action && num(action.card_has_heal)) return true;
        if (card && card.tags && card.tags.heal) return true;
        const effect = String((action && action.card_effect) || (card && card.effect) || "");
        return /治疗|恢复生命|护盾|不会因伤害|伤害减少|受到伤害-(1|2)/.test(effect);
    }

    // 角色同一槽位只能装备一件，再装一件会顶替掉原来的（圣遗物/武器/天赋/特技各自独立）。
    function equipSlotOf(card) {
        if (!card || card.ctype !== "装备牌") return "";
        const effect = String(card.effect || "");
        const suffix = effect.match(/角色(?:最多|只能)装备1[件个]「?(圣遗物|武器|天赋|特技)」?/);
        if (suffix) return suffix[1];
        // 卡牌库里槽位有时记在 label（获取途径为“天赋”等），有时记在 means（如「砰砰礼物」），两处都要看。
        const slots = ["圣遗物", "武器", "天赋", "特技"];
        if (slots.indexOf(card.label) >= 0) return card.label;
        if (slots.indexOf(card.means) >= 0) return card.means;
        return "";
    }

    function equipSlotTaken(game, charName, slot) {
        if (!game || !slot || !charName) return false;
        const slots = (game.equipSlots || {})[charName];
        return !!(slots && slots[slot]);
    }

    // 天赋/特技牌只能装备给对应角色（如「砰砰礼物」要求可莉出战）。
    // 效果文本没有统一的“XX角色才能装备”格式，按出战要求、装备描述和牌组限制依次匹配我方角色名。
    function talentOwnerName(game, card) {
        const effect = String(card.effect || "");
        const users = game.user.filter(function (char) { return char && char.name; });
        const patterns = ["出战角色为", "装备有此牌的", "牌组中包含"];
        for (const prefix of patterns) {
            for (const char of users) {
                if (effect.indexOf(prefix + char.name) >= 0) return char.name;
            }
        }
        for (const char of users) {
            if (effect.indexOf(char.name) >= 0) return char.name;
        }
        return "";
    }

    // 圣遗物/武器装备到尚未占用该槽位的角色，优先出战角色；天赋/特技只能给对应的出战角色。
    function pickEquipTargetIndex(game, card, slot) {
        if (!game.user.length) return -1;
        // 武器牌只能装备给对应武器类型的角色，出战角色不符合时点它游戏不会接受。
        const required = slot === "武器"
            ? String(card.effect || "").match(/「([^」]{1,6})」角色才能装备/)
            : null;
        const weaponTypeOf = function (char) {
            return String(char.weapon || "").replace(/^：/, "");
        };
        const activeIndex = game.getActiveUserIndex();
        if (slot !== "圣遗物" && slot !== "武器") {
            if (activeIndex < 0) return -1;
            const active = game.user[activeIndex];
            if (!active || !Game.expectAlive(active) || equipSlotTaken(game, active.name, slot)) return -1;
            // 对应角色不在出战位时游戏不接受这张天赋/特技牌，先留在手里。
            const owner = talentOwnerName(game, card);
            if (owner && owner !== active.name) return -1;
            return activeIndex;
        }
        if (activeIndex >= 0) {
            const active = game.user[activeIndex];
            if (active && Game.expectAlive(active) && !equipSlotTaken(game, active.name, slot) &&
                (!required || required[1] === weaponTypeOf(active))) return activeIndex;
        }
        for (let i = 0; i < game.user.length; i++) {
            const char = game.user[i];
            if (!Game.expectAlive(char) || equipSlotTaken(game, char.name, slot)) continue;
            if (slot === "武器") {
                // 解析不出武器类型时不冒险换人。
                if (!required) return -1;
                if (required[1] !== weaponTypeOf(char)) continue;
            }
            return i;
        }
        return -1;
    }

    // ==================== 支援牌替换 ====================
    // 场上支援牌的估值：和手牌用同一套标签打分，剩余可用次数略加权。
    function supportCardValue(card, game) {
        if (!card) return 0;
        if (!card.known) return 2.0;
        const data = (cardDic && cardDic[card.name]) || {};
        const effect = data.effect_text || "";
        const pseudo = {
            known: true,
            ctype: data.ctype || card.ctype || "",
            label: data.label || "",
            effect: effect,
            cost: parseCardCost(data.cost || {}),
            tags: cardEffectTags(effect),
        };
        let value = cardUtility(pseudo, game);
        if (num(card.counter) > 0) value += Math.min(0.5, 0.1 * num(card.counter));
        return value;
    }

    function supportSlotsFilled(game) {
        const zone = game.zones.user;
        const occupied = Array.isArray(zone.supportOccupied) ? zone.supportOccupied : [];
        const filled = occupied.filter(Boolean).length;
        return Math.max(filled, (zone.supports || []).length);
    }

    // 支援区最多 4 张，满了以后直接打会被要求先弃置一张。
    // 只有手牌明显更好时才值得替换，返回应弃置的槽位。
    function pickSupportReplacement(game, newCard) {
        if (!newCard || !newCard.known) return null;
        const supports = zoneCards(game, "user", "supports");
        const occupied = Array.isArray(game.zones.user.supportOccupied)
            ? game.zones.user.supportOccupied : [];
        const knownSlots = {};
        let worst = null;
        for (const support of supports) {
            const slot = supportSlotIndex(
                ZONES.userSupports,
                support.x + Math.floor(support.w / 2),
                support.y + Math.floor(support.h / 2)
            );
            if (slot < 0) continue;
            knownSlots[slot] = true;
            const value = supportCardValue(support, game);
            if (!worst || value < worst.value) {
                worst = { slot: slot, value: value, name: support.name };
            }
        }
        const unknownSlots = [];
        for (let i = 0; i < ZONES.userSupports.slots.length; i++) {
            if (occupied.length && !occupied[i]) continue;
            if (!knownSlots[i]) unknownSlots.push(i);
        }
        // 已知最差的一张明显弱于新手牌时才替换，避免烧掉优质支援。
        if (worst && worst.value + 0.4 <= num(newCard.value)) {
            return { slot: worst.slot, value: worst.value, name: worst.name };
        }
        // 有槽位读不到内容时，只有新手牌价值很高才冒一次险。
        if (unknownSlots.length && num(newCard.value) >= 3.2) {
            return { slot: unknownSlots[0], value: 2.0, name: "未知" };
        }
        return null;
    }

    function matchActionCardName(text) {
        const source = String(text || "");
        const key = normalizeCardKey(source);
        if (!key) return "";
        let best = null;
        for (const item of actionCardIndex) {
            if (item.key.length < 2) continue;
            if (key.indexOf(item.key) >= 0 && (!best || item.key.length > best.key.length)) best = item;
        }
        if (best) return best.name;
        const lines = source.split(/[\n\r]+/).map(normalizeCardKey).filter(function (line) {
            return line.length >= 2 && line.length <= 18;
        });
        for (const line of lines) {
            const name = findClosestCardName(line, null, null, actionCardIndex);
            if (name) return name;
        }
        return "";
    }

    // 手牌详情面板固定在画面左侧：放大卡面在 x≈40-280，标题在 x≈318 起。
    // 只读标题带，避免把左上角“宣布结束”、卡面或描述文字当成牌名。
    const HAND_TITLE_REGIONS = [
        { x: 296, y: 88, w: 368, h: 78 },
        { x: 296, y: 88, w: 368, h: 120 },
    ];

    async function readHoveredCardName() {
        for (const area of HAND_TITLE_REGIONS) {
            const text = await ocrTextAt(area.x, area.y, area.w, area.h);
            const name = matchActionCardName(text);
            if (name) return name;
            if (text) debugLog("手牌悬停OCR: " + text.slice(0, 80));
        }
        return "";
    }

    async function readHandCards(game) {
        if (!CFG.useActionCards) return false;
        const count = Math.max(1, Math.min(10, game.handCount));
        const row = HAND_POSITIONS[count];
        if (!row) return false;
        click(RESET_X, RESET_Y);
        await pause(250);
        click(967, 1041);
        await pause(800);
        const cards = [];
        for (let index = 0; index < count; index++) {
            const point = row[index + 1];
            if (!point) break;
            // moveMouseTo 只改光标位置，不会触发游戏内的悬停详情切换，
            // 左侧面板会一直停在展开手牌时默认显示的那张牌。
            // 单击手牌只会展示详情、不会打出，且手牌保持展开，所以逐张点击读取。
            click(point[0], TUNE_HAND_Y);
            await pause(650);
            let rawName = await readHoveredCardName();
            if (!rawName) {
                await pause(350);
                rawName = await readHoveredCardName();
            }
            debugLog("手牌[" + index + "]: " + (rawName || "未知"));
            const card = makeHandCard(rawName, rawName, index);
            card.playFailed = card.known && num(game.cardFailures[card.name]) >= 2;
            cards.push(card);
        }
        click(RESET_X, RESET_Y);
        await pause(300);
        game.handCards = cards;
        game.handKnown = cards.some(function (card) { return card.known; });
        applyHandCardCosts(game);
        log.info("手牌识别: " + cards.map(function (card) {
            return card.known ? card.name : "未知";
        }).join(" / "));
        return true;
    }

    // 手牌卡面左上角的费用数字就是减费后的实际费用；按 x 对齐到手牌顺序覆盖静态费用。
    function applyHandCardCosts(game) {
        const entries = lastHandDigitEntries;
        const count = Math.max(1, Math.min(10, num(game.handCount)));
        const row = HAND_POSITIONS[count];
        if (!entries.length || !row || game.handCards.length !== count) return;
        const used = {};
        for (const entry of entries) {
            let bestIndex = -1;
            let bestDistance = Infinity;
            for (let i = 1; i <= count; i++) {
                if (used[i]) continue;
                const point = row[i];
                if (!point) continue;
                const distance = Math.abs(point[0] - entry.x);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = i;
                }
            }
            if (bestIndex < 0 || bestDistance > 160) continue;
            used[bestIndex] = true;
            const card = game.handCards[bestIndex - 1];
            if (!card) continue;
            card.costFromDigits = true;
            const previous = num(card.cost.dice);
            if (entry.value === previous) continue;
            card.cost.dice = entry.value;
            card.cost.matching = Math.min(num(card.cost.matching), entry.value);
            debugLog("手牌实际费用: " + (card.known ? card.name : "未知") + " " + previous + " -> " + entry.value +
                " (匹配=" + num(entry.score).toFixed(2) + ")");
        }
    }

    // ==================== 元素与技能解析 ====================
    function elementToEn(text) {
        const source = String(text || "");
        for (const cn of ["火", "水", "风", "雷", "草", "冰", "岩", "万能", "物理", "穿透", "冻结", "无"]) {
            if (source.indexOf(cn) >= 0) return ELEMENT_CN[cn];
        }
        return "";
    }

    function elementFromDescription(text) {
        const source = String(text || "");
        if (source.indexOf("物理伤害") >= 0) return "Physical";
        if (source.indexOf("穿透伤害") >= 0) return "Piercing";
        for (const cn of ["火", "水", "风", "雷", "草", "冰", "岩"]) {
            if (source.indexOf(cn + "元素伤害") >= 0) return ELEMENT_CN[cn];
        }
        return "";
    }

    function parseSkillDamage(effectText) {
        const text = String(effectText || "");
        const regex = /造成\s*(\d+)\s*点\s*([^，。；\n]{0,16}?)\s*伤害/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const prefix = text.slice(Math.max(0, match.index - 12), match.index);
            if (prefix.indexOf("治疗") >= 0) continue;
            let element = elementFromDescription(match[2]);
            if (!element) element = elementFromDescription(text.slice(match.index, match.index + match[0].length + 8));
            if (!element) element = "Physical";
            return { damage: parseInt(match[1], 10) || 0, element: element };
        }
        return { damage: 0, element: "Physical" };
    }

    // 结束阶段效果同时可能是伤害或治疗（如「珊瑚宫」「化城郭」），
    // 只取“结束阶段”之后的第一句，避免把入场/使用时的效果算进结算。
    function parseEndPhaseEffect(effectText) {
        const text = String(effectText || "");
        const index = text.indexOf("结束阶段");
        if (index < 0) return { damage: 0, heal: 0, element: "", dynamic: false };
        const clause = text.slice(index, Math.min(text.length, index + 160));
        const sentence = clause.split("。")[0] || clause;
        const damage = clause.match(/造成\s*(\d+)\s*点\s*[^，。；\n]{0,16}?伤害/);
        const heal = clause.match(/(?:治疗|回复)[^。；\n]{0,18}?(\d+)\s*点/);
        // 「造成此牌攻击力值的雷元素伤害」这类数值来自场上状态，只能靠卡面左下角徽标读取。
        const dynamic = !damage && /造成[^。]*伤害/.test(sentence);
        return {
            damage: damage ? parseInt(damage[1], 10) || 0 : 0,
            heal: heal ? parseInt(heal[1], 10) || 0 : 0,
            element: damage ? elementFromDescription(damage[0])
                : (dynamic ? elementFromDescription(sentence) : ""),
            dynamic: dynamic,
        };
    }

    function parseEndPhaseDamage(effectText) {
        return parseEndPhaseEffect(effectText).damage;
    }

    function parseSkillCost(cost) {
        const result = { dice: 0, energy: 0, any: 0, elements: {} };
        if (!cost || typeof cost !== "object") return result;
        for (const key of Object.keys(cost)) {
            const value = num(cost[key]);
            if (value <= 0) continue;
            if (key.indexOf("充能") >= 0) {
                result.energy += value;
                continue;
            }
            result.dice += value;
            if (key.indexOf("万能") >= 0) {
                result.any += value;
                continue;
            }
            const element = elementToEn(key);
            if (element && element !== "Physical" && element !== "Piercing") {
                result.elements[element] = (result.elements[element] || 0) + value;
            } else {
                result.any += value;
            }
        }
        return result;
    }

    function skillTypeToAction(skillType) {
        if (skillType === "普通攻击") return "normal";
        if (skillType === "元素战技") return "skill";
        if (skillType === "元素爆发") return "burst";
        return "normal";
    }

    // ==================== 状态增益与费用修正 ====================
    // 只记录脚本自己打出的牌/释放的技能文本，不去猜未满足条件的触发效果。
    function createBuffs() {
        return {
            permanent: { damage: 0, takeDamage: 0, shield: 0 },
            // 装备牌的加成只属于穿戴者，按角色+槽位记录，换装时覆盖旧加成。
            equip: {},
            turn: {
                damage: 0,
                nextDamage: 0,
                nextSkillCost: 0,
                nextCardCost: 0,
                nextSwitchCost: 0,
                nextBurstEnergy: 0,
                takeDamage: 0,
                shield: 0,
            },
        };
    }

    function emptyTurnBuffs() {
        return {
            damage: 0,
            nextDamage: 0,
            nextSkillCost: 0,
            nextCardCost: 0,
            nextSwitchCost: 0,
            nextBurstEnergy: 0,
            takeDamage: 0,
            shield: 0,
        };
    }

    function ensureBuffs(game) {
        if (!game.buffs) game.buffs = createBuffs();
        if (!game.buffs.equip) game.buffs.equip = {};
        return game.buffs;
    }

    function clearTurnBuffs(game) {
        ensureBuffs(game).turn = emptyTurnBuffs();
    }

    function equipBuffTotal(game, charName, field) {
        const buffs = ensureBuffs(game);
        const slots = buffs.equip[charName] || {};
        let total = 0;
        for (const key of Object.keys(slots)) total += num(slots[key][field]);
        return total;
    }

    function sentenceAt(text, index) {
        const source = String(text || "");
        let start = 0;
        for (const separator of ["。", "；", "\n"]) {
            const pos = source.lastIndexOf(separator, Math.max(0, index - 1));
            if (pos + 1 > start) start = pos + 1;
        }
        let end = source.length;
        for (const separator of ["。", "；", "\n"]) {
            const pos = source.indexOf(separator, index);
            if (pos >= 0 && pos < end) end = pos;
        }
        return source.slice(start, end);
    }

    // 装备/支援的持续加成常常写着“触发后”“如果”“每回合”等条件，
    // 无条件句才当作常驻加成，避免把条件效果算成永久伤害。
    function isUnconditional(text, index) {
        return !/如果|若|后：|后:|后，|后,|后对|后使|前：|前:|时：|时:|时，|时,|时对|时使|每回合|最多|可叠加|才能|达到|消耗/.test(sentenceAt(text, index));
    }

    function parseBuffEffect(text, strict, allowCost) {
        const parsed = {
            damage: 0,
            nextDamage: 0,
            takeDamage: 0,
            shield: 0,
            nextSkillCost: 0,
            nextCardCost: 0,
            nextSwitchCost: 0,
            nextBurstEnergy: 0,
        };
        const source = String(text || "");
        if (!source) return parsed;
        const withoutTaken = source.replace(/受到的伤害\s*\+\s*\d+/g, "");
        // “下一次造成的伤害+N”优先单独记录，避免和持续伤害加成重复累加。
        const nextMatch = withoutTaken.match(/下一次[^。；\n]{0,14}造成的伤害\+(\d+)/);
        if (nextMatch && (!strict || isUnconditional(source, nextMatch.index))) {
            parsed.nextDamage += num(nextMatch[1]);
        }
        const rest = nextMatch ? withoutTaken.replace(nextMatch[0], "") : withoutTaken;
        let damageMatch = rest.match(/造成的伤害\+(\d+)/);
        if (!damageMatch) damageMatch = rest.match(/伤害\+(\d+)/);
        if (damageMatch && (!strict || isUnconditional(source, damageMatch.index))) {
            // “使此伤害+1”只强化当前这一次技能，不能当成后续技能的常驻加成。
            const ahead = source.slice(Math.max(0, damageMatch.index - 4), damageMatch.index);
            if (!/此$|该$|本次$/.test(ahead)) parsed.damage += num(damageMatch[1]);
        }
        const takenMatch = source.match(/受到的伤害\+(\d+)/);
        if (takenMatch && (!strict || isUnconditional(source, takenMatch.index))) {
            const prefix = source.slice(Math.max(0, takenMatch.index - 10), takenMatch.index);
            if (!/敌方|对手/.test(prefix)) parsed.takeDamage += num(takenMatch[1]);
        }
        const shieldMatch = source.match(/提供(\d+)点护盾/);
        if (shieldMatch && (!strict || isUnconditional(source, shieldMatch.index))) {
            parsed.shield += num(shieldMatch[1]);
        }
        const reduceTakenMatch = source.match(/受到的伤害-(\d+)/);
        if (reduceTakenMatch && (!strict || isUnconditional(source, reduceTakenMatch.index))) {
            const prefix = source.slice(Math.max(0, reduceTakenMatch.index - 10), reduceTakenMatch.index);
            if (!/敌方|对手/.test(prefix)) parsed.shield += num(reduceTakenMatch[1]);
        }
        // 持续类效果（装备/支援/场地）里的减费通常带牌型条件，不能当成通用减费，
        // 只记录本回合内一次性的“少花费/费用-”，避免高估后续动作的可负担性。
        if (allowCost) {
            const reduceMatch = source.match(/(?:少花费|费用-)\s*(\d+)\s*个?(?:无色)?(?:元素骰|骰子)?/);
            if (reduceMatch) {
                const value = num(reduceMatch[1]);
                const context = source.slice(Math.max(0, reduceMatch.index - 24),
                    reduceMatch.index + reduceMatch[0].length + 12);
                if (/切换/.test(context) && !/技能|战技|爆发|打出|手牌/.test(context)) {
                    parsed.nextSwitchCost += value;
                } else if (/技能|战技|爆发/.test(context)) parsed.nextSkillCost += value;
                else if (/打出|手牌|使用|「/.test(context)) parsed.nextCardCost += value;
                else parsed.nextSkillCost += value;
            }
            // “下一次元素爆发所需元素能量-N”只影响爆发，单独记录，避免减到普通技能上。
            const energyMatch = source.match(/所需元素能量\s*-\s*(\d+)/);
            if (energyMatch) {
                const context = source.slice(Math.max(0, energyMatch.index - 24),
                    energyMatch.index + energyMatch[0].length + 12);
                if (/爆发/.test(context)) parsed.nextBurstEnergy += num(energyMatch[1]);
            }
        }
        return parsed;
    }

    function applyEffectBuffs(game, text, scope, charName, slotKey) {
        const source = String(text || "");
        if (!source) return;
        const buffs = ensureBuffs(game);
        const parsed = parseBuffEffect(source, true, scope !== "permanent");
        if (scope === "permanent") {
            if (charName) {
                const slots = buffs.equip[charName] || (buffs.equip[charName] = {});
                slots[slotKey || "card"] = {
                    damage: parsed.damage,
                    takeDamage: parsed.takeDamage,
                    shield: parsed.shield,
                };
                debugLog("装备增益: " + charName + " [" + (slotKey || "card") + "]" +
                    " 伤害+" + parsed.damage + " 受伤+" + parsed.takeDamage + " 护盾=" + parsed.shield);
            } else {
                buffs.permanent.damage += parsed.damage;
                buffs.permanent.takeDamage += parsed.takeDamage;
                buffs.permanent.shield += parsed.shield;
                debugLog("持续增益: 伤害+" + parsed.damage + " 受伤+" + parsed.takeDamage +
                    " 护盾=" + parsed.shield);
            }
            return;
        }
        const target = buffs.turn;
        target.damage += parsed.damage;
        target.nextDamage += parsed.nextDamage;
        target.takeDamage += parsed.takeDamage;
        target.shield += parsed.shield;
        target.nextSkillCost += parsed.nextSkillCost;
        target.nextCardCost += parsed.nextCardCost;
        target.nextSwitchCost += parsed.nextSwitchCost;
        target.nextBurstEnergy += parsed.nextBurstEnergy;
        debugLog("状态增益[本回合]: " +
            "伤害+" + num(target.damage) + " 下次伤害+" + num(target.nextDamage) +
            " 技能减费=" + num(target.nextSkillCost) + " 出牌减费=" + num(target.nextCardCost) +
            " 切人减费=" + num(target.nextSwitchCost) + " 爆发减能=" + num(target.nextBurstEnergy) +
            " 受伤+" + num(target.takeDamage) + " 护盾=" + num(target.shield));
    }

    function buffDamage(game, charName) {
        const buffs = ensureBuffs(game);
        return num(buffs.permanent.damage) + num(buffs.turn.damage) + num(buffs.turn.nextDamage) +
            (charName ? equipBuffTotal(game, charName, "damage") : 0);
    }

    function buffTakeDamage(game, charName) {
        const buffs = ensureBuffs(game);
        return num(buffs.permanent.takeDamage) + num(buffs.turn.takeDamage) +
            (charName ? equipBuffTotal(game, charName, "takeDamage") : 0);
    }

    function buffShield(game, charName) {
        const buffs = ensureBuffs(game);
        return num(buffs.permanent.shield) + num(buffs.turn.shield) +
            (charName ? equipBuffTotal(game, charName, "shield") : 0);
    }

    function consumeNextDamage(game) {
        if (game.buffs) game.buffs.turn.nextDamage = 0;
    }

    function consumeNextSkillCost(game) {
        if (game.buffs) game.buffs.turn.nextSkillCost = 0;
    }

    function consumeNextCardCost(game) {
        if (game.buffs) game.buffs.turn.nextCardCost = 0;
    }

    function consumeNextSwitchCost(game) {
        if (game.buffs) game.buffs.turn.nextSwitchCost = 0;
    }

    function consumeNextBurstEnergy(game) {
        if (game.buffs) game.buffs.turn.nextBurstEnergy = 0;
    }

    // 减费优先扣“万能/无色”部分，扣不完再依次削减元素需求，和游戏的少花费规则一致。
    function applyCostReduction(cost, reduce) {
        const value = Math.max(0, num(reduce));
        if (!cost || value <= 0) return cost;
        const copy = {
            dice: num(cost.dice),
            energy: num(cost.energy),
            any: num(cost.any),
            elements: Object.assign({}, cost.elements || {}),
        };
        let left = Math.min(value, copy.any);
        copy.any -= left;
        copy.dice -= left;
        left = value - left;
        for (const element of Object.keys(copy.elements)) {
            if (left <= 0) break;
            const cut = Math.min(left, copy.elements[element]);
            copy.elements[element] -= cut;
            copy.dice -= cut;
            left -= cut;
        }
        return copy;
    }

    function effectiveSkillCost(game, skillDef) {
        const cost = parseSkillCost(skillDef && skillDef.cost);
        const buffs = ensureBuffs(game);
        if (skillDef && skillDef.type === "元素爆发") {
            cost.energy = Math.max(0, num(cost.energy) - num(buffs.turn.nextBurstEnergy));
        }
        return applyCostReduction(cost, buffs.turn.nextSkillCost);
    }

    function effectiveSwitchCost(game) {
        const buffs = ensureBuffs(game);
        return Math.max(0, 1 - num(buffs.turn.nextSwitchCost));
    }

    function effectiveCardDice(game, card) {
        const buffs = ensureBuffs(game);
        // 卡面数字已经包含游戏计算后的减费；只有没读到数字的牌才用记录的一次性减费补足。
        const discount = card.costFromDigits ? 0 : num(buffs.turn.nextCardCost);
        return Math.max(0, num(card.cost.dice) - discount);
    }

    function computeAffordability(cost, dice, energy, game, activeElement) {
        if (energy + 1e-9 < num(cost.energy)) {
            return { affordable: false, tune: 0 };
        }
        const total = sumDice(dice);
        let omni = num(dice.Omni);
        let tunable = 0;
        let untunable = 0;
        for (const element of Object.keys(cost.elements)) {
            const need = cost.elements[element];
            const have = num(dice[element]);
            const useOmni = Math.min(omni, Math.max(0, need - have));
            omni -= useOmni;
            const deficit = need - have - useOmni;
            if (deficit > 0) {
                if (element === activeElement) tunable += deficit;
                else untunable += deficit;
            }
        }
        if (untunable > 0) {
            return { affordable: false, tune: 0 };
        }
        const hand = Math.max(0, num(game.handCount));
        const tune = Math.max(tunable, Math.max(0, cost.dice - total));
        if (tune > hand) {
            return { affordable: false, tune: tune };
        }
        if (tune > 0 && (game.tuneBlocked || tune > tuneableCardCount(game))) {
            return { affordable: false, tune: tune };
        }
        return { affordable: true, tune: tune };
    }

    // 实际骰子能否支付技能费用；到这里调和已经结束，不再考虑烧牌换骰。
    function diceCoversCost(cost, dice) {
        if (sumDice(dice) < num(cost.dice)) return false;
        let omni = num(dice.Omni);
        for (const element of Object.keys(cost.elements)) {
            const need = cost.elements[element];
            const have = num(dice[element]);
            const useOmni = Math.min(omni, Math.max(0, need - have));
            omni -= useOmni;
            if (need > have + useOmni) return false;
        }
        return true;
    }

    // ==================== 模型 ====================
    class PolicyModel {
        constructor(payload) {
            this.inputDim = Number(payload.input_dim);
            this.mean = Float64Array.from(payload.mean);
            this.scale = Float64Array.from(payload.scale);
            this.weights = payload.weights.map(function (layer) {
                return layer.map(function (row) { return Float64Array.from(row); });
            });
            this.biases = payload.biases.map(function (bias) { return Float64Array.from(bias); });
            // 模型可能由旧版训练端导出，特征表与当前脚本不同。
            // 记录模型要求的特征顺序，推理时按名称对齐，避免整个模型被弃用。
            this.stateOrder = null;
            this.actionOrder = null;
            if (Array.isArray(payload.state_features) && Array.isArray(payload.action_features)) {
                this.stateOrder = payload.state_features.map(function (name) {
                    return STATE_FEATURES.indexOf(name);
                });
                this.actionOrder = payload.action_features.map(function (name) {
                    return ACTION_FEATURES.indexOf(name);
                });
            }
        }

        score(stateValues, actionValues) {
            let current = new Float64Array(this.inputDim);
            if (this.stateOrder && this.actionOrder &&
                this.stateOrder.length + this.actionOrder.length === this.inputDim) {
                for (let i = 0; i < this.stateOrder.length; i++) {
                    const index = this.stateOrder[i];
                    current[i] = index >= 0 ? num(stateValues[index]) : 0;
                }
                for (let i = 0; i < this.actionOrder.length; i++) {
                    const index = this.actionOrder[i];
                    current[this.stateOrder.length + i] = index >= 0 ? num(actionValues[index]) : 0;
                }
            } else {
                for (let i = 0; i < this.inputDim; i++) {
                    const value = (i < stateValues.length ? stateValues[i] : 0) +
                        (i >= stateValues.length ? actionValues[i - stateValues.length] : 0);
                    current[i] = value;
                }
            }
            for (let i = 0; i < this.inputDim; i++) {
                const scale = Math.abs(this.scale[i]) < 1e-9 ? 1 : this.scale[i];
                current[i] = (current[i] - this.mean[i]) / scale;
            }
            for (let layerIndex = 0; layerIndex < this.weights.length; layerIndex++) {
                const weights = this.weights[layerIndex];
                const biases = this.biases[layerIndex];
                const output = new Float64Array(weights[0].length);
                for (let j = 0; j < output.length; j++) {
                    let sum = biases[j];
                    for (let i = 0; i < current.length; i++) {
                        sum += current[i] * weights[i][j];
                    }
                    output[j] = layerIndex < this.weights.length - 1 ? Math.max(0, sum) : sum;
                }
                current = output;
            }
            const logit = clamp(current[0], -30, 30);
            return 1 / (1 + Math.exp(-logit));
        }
    }

    function arraysEqual(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function loadPolicyModelFromPayload(payload) {
        if (!payload || payload.model_type !== "mlp") {
            throw new Error("不是受支持的 MLP 模型");
        }
        const inputDim = Number(payload.input_dim);
        if (!Number.isInteger(inputDim) || inputDim <= 0) {
            throw new Error("模型 input_dim 无效: " + payload.input_dim);
        }
        if (!Array.isArray(payload.mean) || payload.mean.length !== inputDim ||
            !Array.isArray(payload.scale) || payload.scale.length !== inputDim) {
            throw new Error("标准化参数维度错误");
        }
        if (!Array.isArray(payload.weights) || !payload.weights.length ||
            !Array.isArray(payload.biases) || payload.biases.length !== payload.weights.length) {
            throw new Error("网络权重结构错误");
        }
        const hasFeatureSchema = Array.isArray(payload.state_features) && Array.isArray(payload.action_features);
        if (hasFeatureSchema) {
            if (payload.state_features.length + payload.action_features.length !== inputDim) {
                throw new Error("模型特征数量与 input_dim 不一致");
            }
        } else if (inputDim !== INPUT_DIM) {
            throw new Error("特征维度不一致: " + inputDim + " != " + INPUT_DIM + "（模型缺少特征清单，无法自动对齐）");
        }
        let expectedRows = inputDim;
        for (let layer = 0; layer < payload.weights.length; layer++) {
            const matrix = payload.weights[layer];
            if (!Array.isArray(matrix) || matrix.length !== expectedRows) {
                throw new Error("第 " + layer + " 层权重行数错误");
            }
            const columns = Array.isArray(matrix[0]) ? matrix[0].length : 0;
            if (!columns) throw new Error("第 " + layer + " 层权重为空");
            for (const row of matrix) {
                if (!Array.isArray(row) || row.length !== columns) {
                    throw new Error("第 " + layer + " 层权重列数不一致");
                }
            }
            if (!Array.isArray(payload.biases[layer]) || payload.biases[layer].length !== columns) {
                throw new Error("第 " + layer + " 层偏置维度错误");
            }
            expectedRows = columns;
        }
        return new PolicyModel(payload);
    }

    function loadPolicyModel(path) {
        try {
            const payload = JSON.parse(readTextFile(path));
            const model = loadPolicyModelFromPayload(payload);
            const metrics = payload.metrics || {};
            let schemaNote = "";
            if (Array.isArray(payload.state_features) && Array.isArray(payload.action_features) &&
                (!arraysEqual(payload.state_features, STATE_FEATURES) ||
                    !arraysEqual(payload.action_features, ACTION_FEATURES))) {
                schemaNote = " | 特征表与当前脚本不同，已按特征名对齐";
            }
            log.info("模型加载完成: " + path + schemaNote +
                " | val_acc=" + (metrics.val_accuracy !== undefined ? metrics.val_accuracy : "?") +
                " | expert_top1=" + (metrics.expert_top1 !== undefined ? metrics.expert_top1 : "?"));
            return model;
        } catch (e) {
            log.error("模型加载失败，将回退到专家策略: " + e);
            return null;
        }
    }

    // ==================== 特征向量 ====================
    let stateDimWarned = false;

    function stateVector(state) {
        const values = [
            Math.min(num(state.turn), 20) / 20,
            num(state.my_alive) / 3,
            num(state.enemy_alive) / 3,
            num(state.my_hp_ratio),
            num(state.enemy_hp_ratio),
            num(state.active_hp_ratio),
            Math.min(num(state.active_hp), 10) / 10,
            num(state.active_energy_ratio),
            boolNum(state.active_frozen),
            Math.min(num(state.dice_total), 10) / 10,
            Math.min(num(state.dice_omni), 10) / 10,
            Math.min(num(state.dice_matching), 10) / 10,
            Math.min(num(state.hand_count), 10) / 10,
            boolNum(state.enemy_attached_any),
            Math.min(num(state.reaction_bonus), 3) / 3,
            boolNum(state.lethal_available),
            boolNum(state.could_die_next),
            boolNum(state.active_catalyst),
            num(state.enemy_active_hp_ratio),
            num(state.enemy_active_energy_ratio),
            boolNum(state.enemy_active_frozen),
            Math.min(num(state.my_support_count), 4) / 4,
            Math.min(num(state.enemy_support_count), 4) / 4,
            Math.min(num(state.my_summon_count), 4) / 4,
            Math.min(num(state.enemy_summon_count), 4) / 4,
            Math.min(num(state.my_support_counter), 8) / 8,
            Math.min(num(state.enemy_support_counter), 8) / 8,
            Math.min(num(state.my_summon_counter), 8) / 8,
            Math.min(num(state.enemy_summon_counter), 8) / 8,
            Math.min(num(state.my_summon_damage), 6) / 6,
            Math.min(num(state.enemy_summon_damage), 6) / 6,
            num(state.hand_known),
            Math.min(num(state.hand_value), 20) / 20,
            Math.min(num(state.hand_best_value), 5) / 5,
        ];
        for (const element of ELEMENTS) values.push(state.my_element === element ? 1 : 0);
        for (const element of ELEMENTS) values.push(state.enemy_element === element ? 1 : 0);
        for (const element of ELEMENTS) values.push(state.enemy_attached_element === element ? 1 : 0);
        values.push(
            boolNum(state.active_in_danger),
            boolNum(state.defense_available),
            Math.min(num(state.switch_cost), 2) / 2,
            Math.min(num(state.enemy_threat), 10) / 10,
            Math.min(num(state.my_end_damage), 6) / 6,
            Math.min(num(state.enemy_end_damage), 6) / 6,
            Math.min(num(state.my_end_heal), 6) / 6,
            Math.min(num(state.enemy_end_heal), 6) / 6
        );
        for (const element of ELEMENTS) {
            values.push(Math.min(num(state["my_end_element_" + element]), 6) / 6);
        }
        for (const element of ELEMENTS) {
            values.push(Math.min(num(state["enemy_end_element_" + element]), 6) / 6);
        }
        values.push(
            Math.min(num(state.my_end_reaction), 3) / 3,
            Math.min(num(state.enemy_end_reaction), 3) / 3
        );
        values.push(
            Math.min(num(state.my_role_states), 4) / 4,
            Math.min(num(state.enemy_role_states), 4) / 4,
            Math.min(num(state.my_faction_states), 4) / 4,
            Math.min(num(state.enemy_faction_states), 4) / 4,
            Math.min(num(state.my_faction_counters), 8) / 8,
            Math.min(num(state.enemy_faction_counters), 8) / 8,
            Math.min(num(state.my_summon_unknown), 4) / 4,
            Math.min(num(state.enemy_summon_unknown), 4) / 4
        );
        // 向量长度和特征清单对不上说明两边改漏了；模型会按名字错位取值，必须立刻暴露。
        if (values.length !== STATE_FEATURES.length && !stateDimWarned) {
            stateDimWarned = true;
            log.warn("状态向量长度 " + values.length + " 与特征清单 " + STATE_FEATURES.length + " 不一致，请运行 python 开发/manage.py features 排查");
        }
        return values;
    }

    function actionVector(state, action) {
        const actionType = action.type || "normal";
        const damage = num(action.expected_damage);
        const isDamage = ["normal", "skill", "burst"].indexOf(actionType) >= 0 && damage > 0;
        const values = ACTION_TYPES.map(function (name) { return actionType === name ? 1 : 0; });
        values.push(
            Math.min(num(action.dice_cost), 5) / 5,
            Math.min(num(action.tune), 3) / 3,
            boolNum(action.affordable),
            Math.min(damage, 10) / 10,
            Math.min(num(action.reaction_bonus), 3) / 3,
            boolNum(action.kills_target),
            boolNum(action.is_switch),
            num(action.target_hp_ratio),
            num(action.self_hp_ratio),
            boolNum(action.element_matches_active),
            action.is_active_action === undefined ? 1 : boolNum(action.is_active_action),
            boolNum(isDamage),
            action.target_is_enemy_active === undefined ? 1 : boolNum(action.target_is_enemy_active),
            Math.min(num(action.card_cost), 5) / 5,
            Math.min(num(action.card_value), 5) / 5,
            boolNum(action.card_needs_target),
            boolNum(action.card_is_support),
            boolNum(action.card_is_event),
            boolNum(action.card_is_equipment),
            boolNum(action.card_has_damage),
            boolNum(action.card_has_heal),
            boolNum(action.card_has_draw),
            boolNum(action.card_has_dice),
            Math.min(num(action.tune_card_value), 5) / 5,
            Math.min(num(action.switch_gain), 6) / 6,
            boolNum(action.switch_frozen),
            cardIsDefensive(null, action) ? 1 : 0
        );
        return values;
    }

    // 没有阵亡压力时，换人不会回血，只有后排技能明显更强才值得交这次战斗行动。
    function switchIsWasteful(state, action) {
        return !num(state.active_in_danger) && !num(state.active_frozen) &&
            num(action.switch_gain) < 0.5;
    }

    // 换到更残的后排既躲不掉伤害也拿不到额外输出，属于纯亏动作，直接屏蔽。
    function switchLosesHealth(state, action) {
        return switchIsWasteful(state, action) &&
            num(action.self_hp_ratio) < num(state.active_hp_ratio) - 0.05;
    }

    // 目标能扛过敌方这一轮最大爆发（含结束阶段结算）时，换人就是实打实的保命。
    function switchSurvivesThreat(state, action) {
        if (!num(state.active_in_danger)) return false;
        const characters = state.characters && state.characters.user;
        const target = characters && characters[num(action.switch_index)];
        if (!target) return false;
        const hp = num(target.hp === null ? target.max_hp : target.hp);
        return hp + num(target.shield) > num(state.enemy_threat);
    }

    function expertScore(state, action) {
        const actionType = action.type || "normal";
        const activeHp = num(state.active_hp_ratio);
        const cost = num(action.dice_cost);
        const danger = num(state.active_in_danger);
        const switchCost = num(state.switch_cost);
        const diceLeft = num(state.dice_total) - cost;
        if (actionType === "end") {
            if (num(state.lethal_available)) return -1.5;
            // 结束阶段结算按净收益计分：我方召唤物/支援的伤害与治疗有利，敌方的有害。
            const myEnd = num(state.my_end_damage) || num(state.my_summon_damage);
            const enemyEnd = num(state.enemy_end_damage) || num(state.enemy_summon_damage);
            const myEndReaction = num(state.my_end_reaction);
            const enemyEndReaction = num(state.enemy_end_reaction);
            const endBalance = 0.08 * (myEnd + myEndReaction) - 0.12 * (enemyEnd + enemyEndReaction) +
                0.08 * num(state.my_end_heal) - 0.06 * num(state.enemy_end_heal);
            let score = (num(state.dice_total) <= 1 ? 0.2 : -0.35) + endBalance;
            // 交回合后对手可以连续行动，出战角色会被一套带走时先换人再考虑结束。
            if (danger && num(state.defense_available)) score -= 1.4;
            // 敌方结束阶段结算就足以打倒我方出战角色时，结束回合等于白送人头。
            if (num(state.active_hp) > 0 && num(state.dice_total) > 1 &&
                enemyEnd + enemyEndReaction - num(state.my_end_heal) >= num(state.active_hp)) {
                score -= 1.2;
            }
            // 我方结束阶段结算可以直接打倒敌方出战角色时，交回合就是一次几乎免费的击杀。
            if (num(state.enemy_active_hp) > 0 &&
                myEnd + myEndReaction - num(state.enemy_end_heal) >= num(state.enemy_active_hp) &&
                enemyEnd + enemyEndReaction - num(state.my_end_heal) < num(state.active_hp)) {
                score += 0.9;
            }
            return score;
        }
        if (actionType === "switch") {
            // 换人不回血，血量只在“即将被打死”时有防守意义；其余时候只看后排能不能带来更多输出。
            const targetHp = num(action.self_hp_ratio);
            let score = 0.35 + 0.55 * Math.min(4, num(action.switch_gain)) - 0.3 * cost + 0.1 * targetHp;
            if (num(state.active_frozen)) score += 1.2;
            if (num(action.switch_frozen)) score -= 6.0;
            // 我方出战带着会被敌方 +2 反应的附着时，换到干净的后排是一次真实的防守；
            // 但换人本身要交出一颗骰子和行动权，只有没多少骰子可用或血量偏低时才值得。
            const exposure = num(state.enemy_reaction_bonus);
            const targetExposure = switchReactionExposure(state, action);
            const avoidWorth = num(state.active_hp_ratio) <= 0.45 ||
                num(state.dice_total) <= num(state.switch_cost) + 1;
            // 冻结同样算高价值风险：被冻住会丢掉下一次行动，不只是 1 点伤害。
            const risky = exposure >= 2 || num(state.enemy_freeze_risk);
            const avoidsReaction = avoidWorth && risky &&
                targetExposure !== null && targetExposure < exposure;
            if (avoidsReaction) score += 0.5;
            if (targetExposure !== null && targetExposure >= 2 && targetExposure > exposure) score -= 0.3;
            if (danger) {
                // 换到同样残血的角色并不能躲过下一次击杀，必须明显更健康才值得交防守行动。
                if (targetHp >= activeHp + 0.15) score += 1.6;
                else score -= 0.8;
            } else if (switchIsWasteful(state, action) && !avoidsReaction) {
                score -= 1.2;
            }
            return score;
        }
        if (actionType === "tune") {
            return 0.1 - 0.2 * cost;
        }
        if (actionType === "play_card") {
            // 出牌是快速行动，不会结束回合；在交战斗行动前先打出有价值的牌。
            let score = 3.2 + 0.9 * num(action.card_value) - 0.15 * cost;
            score += 0.5 * num(action.reaction_bonus) + reactionSideValue(state, action);
            if (num(action.card_needs_target)) score -= 0.15;
            if (!action.affordable) score -= 6.0;
            if (num(state.lethal_available) && !action.kills_target) score -= 0.35;
            if (danger) {
                if (cardIsDefensive(null, action)) score += 1.0;
                else if (diceLeft < switchCost && !num(action.kills_target)) score -= 1.0;
            }
            return score;
        }
        let score = (
            1.2 * num(action.expected_damage) +
            1.55 * num(action.reaction_bonus) +
            reactionSideValue(state, action) +
            4.5 * num(action.kills_target) -
            0.22 * cost -
            0.4 * num(action.tune) -
            0.12 * num(action.tune_card_value) * Math.min(1, num(action.tune))
        );
        // 蒸发/融化/超载这类 +2 反应能显著放大有效伤害，额外加权让技能优先配合附着元素。
        if (num(action.reaction_bonus) >= 2) score += 0.7;
        const typeBonus = { normal: 0.0, skill: 0.35, burst: 0.55, play_card: 0.0 };
        score += typeBonus[actionType] || 0;
        if (!action.affordable) score -= 6.0;
        if (num(state.lethal_available) && !action.kills_target) score -= 0.5;
        // 有阵亡风险时，别把最后一颗骰子交给打不死人的技能。
        if (danger && diceLeft < switchCost && !num(action.kills_target)) score -= 0.8;
        return score;
    }

    function argmax(values) {
        let bestIndex = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] > values[bestIndex]) bestIndex = i;
        }
        return bestIndex;
    }

    // ==================== 轨迹日志 ====================
    // 只保留能反映“牌局是否真的推进”的字段。骰子、附着元素、支援区数量都会因识别抖动，
    // 不能作为进度依据，否则界面被遮挡时的重复决策会全部漏过。
    function decisionSignature(payload) {
        const state = payload.state || {};
        const chars = state.characters || {};
        const users = chars.user || [];
        const active = users.map(function (card) { return card.active ? 1 : 0; }).join("");
        return [
            num(state.turn),
            num(payload.chosen),
            Math.round(num(state.my_hp_ratio) * 100),
            Math.round(num(state.enemy_hp_ratio) * 100),
            num(state.hand_count),
            num(state.my_alive),
            num(state.enemy_alive),
            active,
        ].join("|");
    }

    function boardProgressSignature(game) {
        const active = game.getActiveUser();
        const enemy = game.getActiveEnemy();
        const energy = (game.user || []).reduce(function (sum, card) {
            return sum + num(card.chargeFilled);
        }, 0);
        return [
            num(game.turn),
            Math.round(game.userHpRatio() * 100),
            Math.round(game.enemyHpRatio() * 100),
            num(game.handCount),
            num(game.userAliveCount()),
            num(game.enemyAliveCount()),
            active ? active.name : "",
            enemy ? enemy.name : "",
            energy,
        ].join("|");
    }

    class DuelLogger {
        constructor() {
            this.enabled = CFG.writeTrace;
            this.path = "";
            this.gameId = "";
            this.step = 0;
            this.started = false;
            this.lastSignature = "";
            this.skipped = 0;
        }

        ensurePath() {
            if (this.path) return;
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            this.path = LOG_DIR + "/duel_" + now.getFullYear() + month + day + ".log";
        }

        write(record) {
            if (!this.enabled) return;
            try {
                this.ensurePath();
                ensureDirectory(LOG_DIR);
                record.v = 1;
                record.time = new Date().toISOString();
                writeTextFile(this.path, JSON.stringify(record) + "\n", true);
            } catch (e) {
                debugLog("轨迹写入失败: " + e);
            }
        }

        start(modelName, deck) {
            if (this.started) return;
            this.started = true;
            this.gameId = "d_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
            this.step = 0;
            this.lastSignature = "";
            this.skipped = 0;
            this.write({
                type: "start",
                game_id: this.gameId,
                model: modelName,
                deck: deck || [],
            });
            log.info(this.enabled ? "轨迹已开启: logs/duel_*.log" : "轨迹记录已关闭");
        }

        decision(payload) {
            if (!this.started) return;
            // 操作被遮挡时同样的状态会被反复决策，这些记录不是有效样本，不能进数据集。
            const signature = decisionSignature(payload);
            if (signature === this.lastSignature) {
                this.skipped += 1;
                return;
            }
            this.lastSignature = signature;
            const record = {
                type: "decision",
                game_id: this.gameId,
                step: this.step++,
                turn: payload.turn,
                state: payload.state,
                actions: payload.actions,
                chosen: payload.chosen,
                expert_scores: payload.expert_scores,
                policy_scores: payload.policy_scores,
                mode: payload.mode,
            };
            this.write(record);
        }

        result(result, turns, extra) {
            if (!this.started) return;
            const options = extra || {};
            this.write({
                type: "result",
                game_id: this.gameId,
                result: result,
                turns: turns,
                surrender: !!options.surrender,
                skipped_steps: this.skipped,
            });
        }
    }

    // ==================== 识别基础 ====================
    function normalizeOcrText(text) {
        return String(text || "").replace(/\s/g, "").trim();
    }

    let captureLost = false;

    async function ocrTextAt(x, y, w, h) {
        let region = null;
        try {
            region = captureGameRegion();
            const result = region.Find(RecognitionObject.Ocr(x, y, w, h));
            if (result && result.isExist()) return (result.text || "").trim();
            return "";
        } catch (e) {
            if (String(e).indexOf("截图器未初始化") >= 0) captureLost = true;
            debugLog("OCR 截图失败: " + e);
            return "";
        } finally {
            if (region) region.dispose();
        }
    }

    async function isUiReroll() {
        // 标题在不同版本里可能是“重投骰子”，也可能带副标题，不能做全等比较。
        return normalizeOcrText(await ocrTextAt(844, 167, 232, 65)).indexOf("重投") >= 0;
    }

    async function isUiChoice() {
        return normalizeOcrText(await ocrTextAt(1766, 851, 117, 37)) === "出战角色";
    }

    async function isUiFinish() {
        // 结算标题固定在画面中部；区域要完整包住文字，贴边裁剪会让 OCR 丢字。
        const text = normalizeOcrText(await ocrTextAt(700, 330, 520, 220));
        if (text.indexOf("对局胜利") >= 0) return "win";
        if (text.indexOf("对局失败") >= 0) return "lose";
        return "none";
    }

    function findTemplateInRegion(region, key, x, y, w, h, threshold) {
        const mat = getMat(key);
        if (!mat) return [];
        const ro = RecognitionObject.TemplateMatch(mat, x, y, w, h);
        ro.threshold = threshold;
        const list = region.FindMulti(ro);
        const output = [];
        if (list) {
            const count = typeof list.count === "number" ? list.count : (list.length || 0);
            for (let i = 0; i < count; i++) {
                const item = list[i];
                output.push({
                    x: item.x,
                    y: item.y,
                    width: item.width,
                    height: item.height,
                    score: num(item.matchScore),
                });
            }
        }
        return output;
    }

    function findTemplateOnScreen(key, x, y, w, h, threshold) {
        const region = captureGameRegion();
        try {
            return findTemplateInRegion(region, key, x, y, w, h, threshold);
        } finally {
            region.dispose();
        }
    }

    function templateExists(region, key, x, y, w, h, threshold) {
        return findTemplateInRegion(region, key, x, y, w, h, threshold).length > 0;
    }

    async function isUiMain() {
        return findTemplateOnScreen("setting", 1834, 15, 66, 66, 0.8).length > 0;
    }

    // 回合沙漏：我方金色、敌方蓝色，形状完全相同，只能靠颜色区分。
    const TURN_HOURGLASS = { x: 50, y: 505, w: 28, h: 30 };
    // 左上角敌方状态文字：正在等待… / 正在行动，技能详情面板不会遮挡它。
    const TURN_STATUS_ENEMY = { x: 130, y: 55, w: 220, h: 45 };
    // 左下角我方状态文字（BetterGI 日志浮层可能遮住上半部分，作为兜底）。
    const TURN_STATUS_USER = { x: 130, y: 1018, w: 200, h: 45 };

    function regionMeanBGR(region, area) {
        let crop = null;
        const cv = opencvNs();
        if (!cv) return null;
        try {
            crop = region.DeriveCrop(area.x, area.y, area.w, area.h);
            const mean = cv.Cv2.Mean(crop.SrcMat);
            return { b: mean.Val0, g: mean.Val1, r: mean.Val2 };
        } catch (e) {
            debugLog("回合颜色识别失败: " + e);
            return null;
        } finally {
            if (crop) crop.Dispose();
        }
    }

    async function getActingTurn() {
        // 结束阶段双方状态栏都显示“结束阶段”，这时点击无效，必须先识别出来。
        const enemyStatus = normalizeOcrText(await ocrTextAt(
            TURN_STATUS_ENEMY.x, TURN_STATUS_ENEMY.y, TURN_STATUS_ENEMY.w, TURN_STATUS_ENEMY.h
        ));
        if (enemyStatus.indexOf("结束阶段") >= 0) return "endphase";

        const region = captureGameRegion();
        try {
            const mean = regionMeanBGR(region, TURN_HOURGLASS);
            if (mean) {
                const warm = mean.r - mean.b;
                if (warm > 45) return "user";
                // 敌方蓝色图标实测 R-B≈-39，技能面板等中性遮挡只有 ±13 左右。
                if (warm < -20) return "enemy";
            }
        } finally {
            region.dispose();
        }

        if (enemyStatus.indexOf("正在行动") >= 0) return "enemy";
        if (enemyStatus.indexOf("正在等待") >= 0) return "user";
        const userStatus = normalizeOcrText(await ocrTextAt(
            TURN_STATUS_USER.x, TURN_STATUS_USER.y, TURN_STATUS_USER.w, TURN_STATUS_USER.h
        ));
        if (userStatus.indexOf("结束阶段") >= 0) return "endphase";
        if (userStatus.indexOf("正在行动") >= 0) return "user";
        if (userStatus.indexOf("正在等待") >= 0) return "enemy";
        return "none";
    }

    function parseLeadingInt(text) {
        const match = String(text || "").match(/^\s*(\d{1,2})/);
        if (!match) return null;
        const value = parseInt(match[1], 10);
        return Number.isFinite(value) ? value : null;
    }

    function ocrIntInRegion(region, x, y, w, h) {
        const result = region.Find(RecognitionObject.Ocr(x, y, w, h));
        if (result && result.isExist()) return parseLeadingInt(result.text);
        return null;
    }

    // 徽标左侧常带元素/次数图标，OCR 可能把图标识别成符号排在数字前面，
    // 直接取文本里的第一段数字，避免「★1」这类结果被当成识别失败。
    function parseBadgeValueText(text) {
        const value = String(text || "").trim();
        if (!value) return null;
        const match = value.match(/(\d{1,2})/);
        if (match) {
            const number = parseInt(match[1], 10);
            return Number.isFinite(number) ? number : null;
        }
        // 单个竖线常是数字 1 被 OCR 当成字母，只在整段只有一个字符时按 1 处理。
        // “ō”是徽标 1 叠上元素图标后的实测结果。
        if (/^[Il|丨１ōŌ]$/.test(value)) return 1;
        // Paddle 会把徽标里的白色数字读成带圈数字（实测“①”）。
        const circled = value.match(/[\u2460-\u2473]/);
        if (circled) return circled[0].charCodeAt(0) - 0x2460 + 1;
        const fullWidth = value.match(/[０-９]/);
        if (fullWidth) {
            const number = parseInt(fullWidth[0].replace(/[０-９]/g, function (ch) {
                return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
            }), 10);
            return Number.isFinite(number) ? number : null;
        }
        return null;
    }

    function ocrBadgeInt(region, x, y, w, h) {
        // 徽标数字压在彩色图标上，单个白色数字容易被 OCR 整段丢掉：
        // 先读完整徽标，再只读右半边的数字，最后带一圈背景重试。
        const boxes = [
            { x: x, y: y, w: w, h: h },
            {
                x: x + Math.round(w * 0.42),
                y: y + Math.round(h * 0.10),
                w: Math.max(8, Math.round(w * 0.58)),
                h: Math.max(8, Math.round(h * 0.80)),
            },
            {
                x: Math.max(0, x - 8),
                y: Math.max(0, y - 8),
                w: w + 16,
                h: h + 16,
            },
        ];
        const texts = [];
        for (const box of boxes) {
            const result = region.Find(RecognitionObject.Ocr(box.x, box.y, box.w, box.h));
            const text = result && result.isExist() ? String(result.text || "").trim() : "";
            texts.push(text);
            const value = parseBadgeValueText(text);
            if (value !== null) return value;
        }
        debugLog("徽标OCR失败: [" + texts.join(" | ") + "] @" + x + "," + y);
        return null;
    }

    async function ocrCardName() {
        moveMouseTo(1555, 860);
        await pause(80);
        const rawText = String(await ocrTextAt(311, 115, 341, 50) || "").trim();
        // 卡名至少两个字（如「白垩之术」曾被截成“白”），单字结果通常是标题框
        // 刚好切到边缘，外扩一圈重读一次再取更长的结果。
        if (rawText.length === 1 && !/^\d$/.test(rawText)) {
            const wider = String(await ocrTextAt(285, 108, 395, 64) || "").trim();
            const candidate = wider.length > rawText.length ? wider : rawText;
            return /^\d+$/.test(candidate) ? "" : candidate;
        }
        if (!rawText || /^\d+$/.test(rawText)) return "";
        return rawText;
    }

    // 点击卡牌后左侧详情面板会在标题下方显示完整效果文本。
    // 未收录的卡牌可以据此解析结束阶段伤害/治疗和元素，不依赖卡面彩色徽标。
    async function ocrCardDetailText() {
        const text = normalizeOcrText(await ocrTextAt(300, 170, 400, 380));
        if (text) debugLog("卡牌详情OCR: " + text.slice(0, 120));
        return text;
    }

    // ==================== 支援区 / 召唤物区 ====================
    // 坐标基于 BetterGI 强制设置的 1920x1080 游戏窗口。
    const CARD_ART_INDEX = "assets/card_art/index.json";
    const SUPPORT_CTYPES = ["支援牌", "场地牌"];
    const SUMMON_CTYPES = ["召唤物", "召唤物效果"];
    // 1920x1080 窗口下局内支援牌的原画与整框实测尺寸，模板只按这一档生成。
    const SUPPORT_ART_W = 99;
    const SUPPORT_ART_H = 109;
    const SUPPORT_CARD_W = 130;
    const SUPPORT_CARD_H = 156;
    const SUPPORT_MATCH = { accept: 0.70, lower: 0.58, gap: 0.10, sameSpot: 55 };
    const SUPPORT_OCCUPANCY = 0.05;
    const SUMMON_TEMPLATE_SCORE = 0.68;
    const SUMMON_OCCUPANCY = 0.10;
    const SUMMON_SLOTS = 4;
    // 召唤物画心框相对槽位左上角的偏移，模板窗口再相对画心框偏移；index.json 里的几何优先。
    const SUMMON_ART_FALLBACK = { offset: [-1, 3], window: [2, 2, 70, 83] };
    const SUMMON_ART_SEARCH = { accept: 0.68, gap: 0.06, pad: 14 };

    const ZONES = {
        userSupports: {
            side: "user",
            area: { x: 235, y: 555, w: 400, h: 390 },
            slots: [
                { x: 256, y: 578, w: 128, h: 150 },
                { x: 424, y: 578, w: 140, h: 150 },
                { x: 256, y: 758, w: 128, h: 150 },
                { x: 424, y: 758, w: 140, h: 150 },
            ],
        },
        enemySupports: {
            side: "enemy",
            area: { x: 235, y: 105, w: 400, h: 390 },
            slots: [
                { x: 268, y: 148, w: 114, h: 148 },
                { x: 428, y: 148, w: 114, h: 148 },
                { x: 268, y: 316, w: 114, h: 148 },
                { x: 428, y: 316, w: 114, h: 148 },
            ],
        },
        userSummons: {
            side: "user",
            area: { x: 1300, y: 555, w: 520, h: 360 },
            // 召唤物是 2 列 × 2 行固定槽位，左上角坐标实测来自 1920x1080 截图。
            slots: [
                { x: 1372, y: 597, w: 124, h: 149 },
                { x: 1535, y: 597, w: 124, h: 149 },
                { x: 1372, y: 762, w: 124, h: 149 },
                { x: 1535, y: 762, w: 124, h: 149 },
            ],
        },
        enemySummons: {
            side: "enemy",
            area: { x: 1300, y: 105, w: 520, h: 360 },
            slots: [
                { x: 1372, y: 145, w: 124, h: 149 },
                { x: 1535, y: 145, w: 124, h: 149 },
                { x: 1372, y: 310, w: 124, h: 149 },
                { x: 1535, y: 310, w: 124, h: 149 },
            ],
        },
    };

    let cardArt = null;
    let cardArtFailed = false;

    function createZones() {
        function side() {
            return {
                supports: [],
                summons: [],
                summonTemplates: [],
                clickAttempts: {},
                badgeCache: {},
                supportSignature: "",
                supportOccupied: [],
                supportTurn: -1,
                summonSignature: "",
                summonOccupied: [],
                summonTurn: -1,
            };
        }
        return { user: side(), enemy: side(), counterTurn: -1 };
    }

    function disposeZones(zones) {
        if (!zones) return;
        for (const side of ["user", "enemy"]) {
            for (const entry of zones[side].summonTemplates) {
                if (entry.mat) entry.mat.Dispose();
            }
        }
    }

    function loadCardArt() {
        if (cardArt || cardArtFailed) return cardArt;
        try {
            const payload = JSON.parse(readTextFile(CARD_ART_INDEX));
            const kinds = {};
            const specs = payload.kinds || {};
            for (const key in specs) {
                const spec = specs[key] || {};
                kinds[key] = {
                    cards: [],
                    search: spec.search || "area",
                    offset: spec.art_offset || [0, 0],
                    window: spec.match || [0, 0, 0, 0],
                };
            }
            const legacyKind = payload.kind || "support";
            for (const item of payload.cards || []) {
                if (!item.file) continue;
                const kind = item.kind || legacyKind;
                if (!kinds[kind]) {
                    kinds[kind] = {
                        cards: [],
                        search: "area",
                        offset: [0, 0],
                        window: [0, 0, item.width || 0, item.height || 0],
                    };
                }
                kinds[kind].cards.push({
                    name: item.name,
                    type: item.type || "",
                    ctype: item.ctype || "",
                    template: { file: item.file, mat: null, tried: false },
                });
            }
            // 旧版 index.json 没有 summon 段时退回实测几何，换资源包前后都能跑。
            if (!kinds.summon) {
                kinds.summon = {
                    cards: [], search: "slot",
                    offset: SUMMON_ART_FALLBACK.offset, window: SUMMON_ART_FALLBACK.window,
                };
            }
            cardArt = kinds;
            log.info("卡面模板加载完成: 支援 " + (kinds.support ? kinds.support.cards.length : 0) +
                " 张, 召唤物 " + kinds.summon.cards.length + " 张");
        } catch (e) {
            cardArtFailed = true;
            log.warn("卡面模板读取失败，将只按占位识别: " + e);
        }
        return cardArt;
    }

    function artKind(kind) {
        const art = loadCardArt();
        return art && art[kind] ? art[kind] : null;
    }

    function getArtTemplateMat(template) {
        if (template.mat || template.tried) return template.mat;
        template.tried = true;
        try {
            template.mat = readImageMat("assets/card_art/" + template.file);
        } catch (e) {
            template.mat = null;
        }
        return template.mat;
    }

    function edgeDensity(region, x, y, w, h) {
        let crop = null;
        let grey = null;
        let edges = null;
        const cv = opencvNs();
        if (!cv) return 0;
        try {
            crop = region.DeriveCrop(x, y, w, h);
            grey = new Mat();
            edges = new Mat();
            cv.Cv2.CvtColor(crop.SrcMat, grey, cv.ColorConversionCodes.BGR2GRAY);
            cv.Cv2.Canny(grey, edges, 45, 135);
            return cv.Cv2.CountNonZero(edges) / Math.max(1, w * h);
        } catch (e) {
            debugLog("占位密度计算失败: " + e);
            return 0;
        } finally {
            if (edges) edges.Dispose();
            if (grey) grey.Dispose();
            if (crop) crop.Dispose();
        }
    }

    function supportSlotIndex(cfg, x, y) {
        for (let i = 0; i < cfg.slots.length; i++) {
            const slot = cfg.slots[i];
            const cx = slot.x + slot.w / 2;
            const cy = slot.y + slot.h / 2;
            if (Math.abs(x - cx) <= slot.w * 0.75 && Math.abs(y - cy) <= slot.h * 0.75) return i;
        }
        return -1;
    }

    function collectSupportCandidates(region, cfg, area) {
        const art = artKind("support");
        if (!art || !art.cards.length) return [];
        const box = area || cfg.area;
        const candidates = [];
        for (const card of art.cards) {
            const template = card.template;
            const mat = getArtTemplateMat(template);
            if (!mat) continue;
            const ro = RecognitionObject.TemplateMatch(mat, box.x, box.y, box.w, box.h);
            ro.threshold = SUPPORT_MATCH.lower;
            ro.MaxMatchCount = 2;
            let list = null;
            try {
                list = region.FindMulti(ro);
            } catch (e) {
                continue;
            }
            if (!list) continue;
            const count = typeof list.count === "number" ? list.count : (list.length || 0);
            for (let i = 0; i < count; i++) {
                const item = list[i];
                candidates.push({
                    name: card.name,
                    type: card.type,
                    ctype: card.ctype,
                    score: num(item.matchScore),
                    x: item.x,
                    y: item.y,
                    w: item.width,
                    h: item.height,
                });
            }
        }
        return candidates;
    }

    function chooseSupportCandidates(candidates) {
        const sorted = candidates.slice().sort(function (a, b) { return b.score - a.score; });
        const chosen = [];
        for (const candidate of sorted) {
            const cx = candidate.x + candidate.w / 2;
            const cy = candidate.y + candidate.h / 2;
            let best = null;
            let rival = 0;
            for (const other of chosen) {
                const ox = other.x + other.w / 2;
                const oy = other.y + other.h / 2;
                if (Math.abs(cx - ox) <= SUPPORT_MATCH.sameSpot && Math.abs(cy - oy) <= SUPPORT_MATCH.sameSpot) {
                    if (other.name !== candidate.name) rival = Math.max(rival, other.score);
                    best = other;
                }
            }
            if (!best) {
                chosen.push({
                    name: candidate.name,
                    type: candidate.type,
                    ctype: candidate.ctype,
                    score: candidate.score,
                    rival: 0,
                    x: candidate.x,
                    y: candidate.y,
                    w: candidate.w,
                    h: candidate.h,
                });
                continue;
            }
            if (candidate.name === best.name) continue;
            if (candidate.score > best.score) {
                const previous = best.score;
                best.score = candidate.score;
                best.name = candidate.name;
                best.type = candidate.type;
                best.ctype = candidate.ctype;
                best.rival = Math.max(best.rival, previous, rival);
                best.x = candidate.x;
                best.y = candidate.y;
                best.w = candidate.w;
                best.h = candidate.h;
            } else {
                best.rival = Math.max(best.rival, candidate.score);
            }
        }
        return chosen.filter(function (candidate) {
            if (candidate.score >= SUPPORT_MATCH.accept) return true;
            return candidate.score >= SUPPORT_MATCH.lower &&
                candidate.score - candidate.rival >= SUPPORT_MATCH.gap;
        });
    }

    function makeSupportCard(candidate) {
        const scale = candidate.w / SUPPORT_ART_W;
        const width = Math.round(SUPPORT_CARD_W * scale);
        const height = Math.round(SUPPORT_CARD_H * scale);
        const data = (cardDic && cardDic[candidate.name]) || {};
        const endEffect = parseEndPhaseEffect(data.effect_text);
        return {
            name: candidate.name,
            rawName: "",
            type: candidate.type || data.type || "",
            ctype: candidate.ctype || data.ctype || "",
            x: Math.round(candidate.x + candidate.w / 2 - width / 2),
            y: Math.round(candidate.y + candidate.h / 2 - height / 2),
            w: width,
            h: height,
            artX: candidate.x,
            artY: candidate.y,
            artW: candidate.w,
            artH: candidate.h,
            counter: 0,
            endDamage: endEffect.damage,
            endHeal: endEffect.heal,
            endElement: endEffect.element,
            endDynamic: !!endEffect.dynamic,
            known: true,
            source: candidate.score >= SUPPORT_MATCH.accept ? "art" : "art+margin",
            template: null,
            score: candidate.score,
        };
    }

    function makeUnknownSupport(slot, source) {
        return {
            name: "未知",
            rawName: "",
            type: "",
            ctype: "",
            x: slot.x,
            y: slot.y,
            w: slot.w,
            h: slot.h,
            artX: slot.x + 13,
            artY: slot.y + 25,
            artW: SUPPORT_ART_W,
            artH: SUPPORT_ART_H,
            counter: 0,
            endDamage: 0,
            endHeal: 0,
            endElement: "",
            endDynamic: false,
            known: false,
            source: source,
            template: null,
            score: 0,
        };
    }

    // 右上角是可用次数/持续回合，左下角是结束阶段伤害或治疗的“元素符号+数值”。
    // 两个徽标都压在卡牌边角上，位置相对卡牌外框固定，按实测比例裁剪。
    function zoneBadgeBox(card, kind, corner) {
        if (corner === "element") {
            return {
                x: card.x + Math.round(card.w * 0.04),
                y: card.y + Math.round(card.h * 0.55),
                w: Math.round(card.w * 0.42),
                h: Math.round(card.h * 0.42),
            };
        }
        if (kind === "support") {
            // 支援牌徽标圆心实测在卡牌右上角内侧约 (0.91w, 0.09h)，向右凸出卡框。
            return {
                x: card.x + Math.round(card.w * 0.76),
                y: card.y - Math.round(card.h * 0.07),
                w: Math.round(card.w * 0.39),
                h: Math.round(card.h * 0.31),
            };
        }
        return {
            x: card.x + Math.round(card.w * 0.74),
            y: card.y - Math.round(card.h * 0.10),
            w: Math.round(card.w * 0.42),
            h: Math.round(card.h * 0.32),
        };
    }

    function readZoneBadge(region, card, side, kind, corner, game) {
        const zone = game.zones[side];
        const key = kind + ":" + corner + ":" + Math.round(card.x / 8) + ":" +
            Math.round(card.y / 8) + ":" + card.name;
        if (Object.prototype.hasOwnProperty.call(zone.badgeCache, key)) {
            return zone.badgeCache[key];
        }
        const box = zoneBadgeBox(card, kind, corner);
        const raw = ocrBadgeInt(region, box.x, box.y, box.w, box.h);
        const max = corner === "element" ? 9 : (kind === "support" ? 20 : 9);
        const value = raw === null || raw < 0 || raw > max ? null : raw;
        const result = { value: value, box: box };
        zone.badgeCache[key] = result;
        return result;
    }

    // 元素徽标颜色只能作为卡牌未识别时的兜底；绿色既可能是草元素也可能是治疗，不强行归类。
    function classifyBadgeElement(mean) {
        if (!mean) return "";
        const b = num(mean.b);
        const g = num(mean.g);
        const r = num(mean.r);
        const max = Math.max(b, g, r);
        const min = Math.min(b, g, r);
        if (max < 90 || max - min < 40) return "";
        if (r - b > 70 && g < r * 0.75) return "Pyro";
        if (b - r > 25 && r - g > 15) return "Electro";
        if (r - b > 45 && g > r * 0.78) return "Geo";
        // 风元素偏青绿，蓝色分量不比绿色高；放在水/冰之前避免被青蓝色规则吃掉。
        if (g - b > 10 && g - r > 35) return "Anemo";
        // 水元素是深蓝（蓝明显高于绿）；冰元素是浅青（蓝绿接近、整体更亮）。
        if (b - g > 30 && g - r > 25) return "Hydro";
        if (b - g > -6 && g - r > 25 && b - r > 30 && max > 150) return "Cryo";
        if (g - r > 35 && g - b > 25) return ""; // 可能是草元素伤害，也可能是治疗
        return "";
    }

    // 徽标数值是当前生效值（会被增伤/增益改写），读到后覆盖卡牌文本里的基础值。
    function applyEndBadge(card, badge) {
        if (!badge || badge.value === null || badge.value < 1) return;
        if (card.endDamage > 0) {
            card.endDamage = badge.value;
        } else if (card.endHeal > 0) {
            card.endHeal = badge.value;
        }
    }

    function readCardBadges(region, card, side, kind, game) {
        const counter = readZoneBadge(region, card, side, kind, "counter", game);
        card.counter = counter.value === null ? 0 : counter.value;
        if (card.known) {
            if (card.endDamage > 0 || card.endHeal > 0) {
                applyEndBadge(card, readZoneBadge(region, card, side, kind, "element", game));
            } else if (card.endDynamic) {
                // 「攻击力」这类动态伤害只能从徽标拿：数字退化时保留 0，避免虚增。
                const badge = readZoneBadge(region, card, side, kind, "element", game);
                if (badge.value !== null && badge.value > 0) {
                    card.endDamage = badge.value;
                    if (!card.endElement) {
                        card.endElement = classifyBadgeElement(regionMeanBGR(region, badge.box));
                    }
                }
            }
        } else if (kind === "summon") {
            const badge = readZoneBadge(region, card, side, kind, "element", game);
            if (badge.value !== null && badge.value > 0) {
                card.badgeValue = badge.value;
                card.badgeElement = classifyBadgeElement(regionMeanBGR(region, badge.box));
                // 只有颜色明确是伤害元素时才计入结束阶段伤害；绿色的治疗/草元素不猜。
                if (card.badgeElement) {
                    card.endDamage = badge.value;
                    card.endElement = card.badgeElement;
                }
            }
        }
    }

    function captureZoneTemplate(box) {
        let region = null;
        let crop = null;
        try {
            region = captureGameRegion();
            crop = region.DeriveCrop(box.x, box.y, box.w, box.h);
            return crop.SrcMat.Clone();
        } catch (e) {
            debugLog("区域模板缓存失败: " + e);
            return null;
        } finally {
            if (crop) crop.Dispose();
            if (region) region.Dispose();
        }
    }

    // 只截卡面中部：避开右上角次数和左下角元素徽标，这两个数字每回合都会变。
    function captureSummonTemplate(slot) {
        const box = {
            x: slot.x + Math.round(slot.w * 0.10),
            y: slot.y + Math.round(slot.h * 0.10),
            w: Math.round(slot.w * 0.52),
            h: Math.round(slot.h * 0.45),
        };
        const mat = captureZoneTemplate(box);
        if (!mat) return null;
        return { mat: mat, dx: box.x - slot.x, dy: box.y - slot.y };
    }

    async function identifyZoneCardByClick(side, kind, box, game) {
        if (!CFG.zoneClickFallback) return null;
        const zone = game.zones[side];
        const key = kind + ":" + Math.round(box.x / 10) + ":" + Math.round(box.y / 10);
        if (zone.clickAttempts[key] === game.turn) return null;
        zone.clickAttempts[key] = game.turn;

        const cx = box.x + Math.floor(box.w / 2);
        const cy = box.y + Math.floor(box.h / 2);
        // 手牌会盖住我方支援区下半行，但底部槽位中心约在 y=833，
// 仍高于展开/收起的手牌，只有更深的位置才可能误点手牌。
        if (kind === "support" && side === "user" && cy > 900) return null;
        if (kind === "support" && (cx < 230 || cx > 660)) return null;
        // 敌方召唤区在 y≈145 与 y≈310 两行，旧逻辑的 cy<250 会把第一行全部拒掉。
        if (kind === "summon" && (cx < 1300 || cx > 1890 || cy < 90 || cy > 900)) return null;

        click(cx, cy);
        await pause(480);
        const rawName = await ocrCardName();
        const name = findClosestCardName(
            rawName,
            null,
            kind === "support" ? SUPPORT_CTYPES : SUMMON_CTYPES
        );
        // 只有未收录（卡牌库没有这张）才需要读详情正文兜底，已收录的用卡牌库数据更稳。
        const detailText = name ? "" : await ocrCardDetailText();
        click(RESET_X, RESET_Y);
        await pause(320);
        const data = (cardDic && cardDic[name]) || {};
        const endEffect = parseEndPhaseEffect(data.effect_text);
        const detailEffect = detailText ? parseEndPhaseEffect(detailText) : null;
        const card = {
            name: name || (rawName ? rawName : "未知"),
            rawName: rawName || "",
            type: data.type || "",
            ctype: data.ctype || "",
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
            artX: kind === "support" ? box.x + 13 : box.x,
            artY: kind === "support" ? box.y + 25 : box.y,
            artW: kind === "support" ? SUPPORT_ART_W : box.w,
            artH: kind === "support" ? SUPPORT_ART_H : box.h,
            counter: 0,
            endDamage: detailEffect ? detailEffect.damage : endEffect.damage,
            endHeal: detailEffect ? detailEffect.heal : endEffect.heal,
            endElement: detailEffect ? detailEffect.element : endEffect.element,
            endDynamic: detailEffect ? !!detailEffect.dynamic : !!endEffect.dynamic,
            known: !!name,
            source: "ocr",
            template: null,
            score: 0,
        };
        // 未收录的召唤物同样缓存自身模板：名字来自 OCR 原文本，后续扫描不会再退回“未知”。
        // 结束阶段效果也要跟着模板一起缓存，否则卡牌库没有这张牌时，下一次扫描会重新
        // 按 cardDic 生成 0 伤害，丢掉详情面板 OCR 读到的数值。
        if (kind === "summon" && card.name && card.name !== "未知") {
            const entry = captureSummonTemplate(box);
            if (entry) {
                const index = zone.summonTemplates.findIndex(function (item) {
                    return item.name === card.name;
                });
                const previous = index >= 0 ? zone.summonTemplates[index] : null;
                const cached = {
                    name: card.name,
                    mat: entry.mat,
                    dx: entry.dx,
                    dy: entry.dy,
                    endDamage: Math.max(num(card.endDamage), num(previous && previous.endDamage)),
                    endHeal: Math.max(num(card.endHeal), num(previous && previous.endHeal)),
                    endElement: card.endElement || (previous && previous.endElement) || "",
                    endDynamic: !!card.endDynamic || !!(previous && previous.endDynamic),
                };
                if (index >= 0) {
                    if (previous.mat) previous.mat.Dispose();
                    zone.summonTemplates[index] = cached;
                } else {
                    zone.summonTemplates.push(cached);
                }
                card.template = entry.mat;
            }
        }
        debugLog("区域卡识别(" + side + "/" + kind + "): " + (rawName || "?") + " -> " + card.name);
        return card;
    }

    async function scanSupports(region, side, game) {
        const cfg = side === "user" ? ZONES.userSupports : ZONES.enemySupports;
        const zone = game.zones[side];
        const occupied = cfg.slots.map(function (slot) {
            return edgeDensity(region, slot.x, slot.y, slot.w, slot.h) >= SUPPORT_OCCUPANCY;
        });
        const signature = occupied.map(function (value) { return value ? "1" : "0"; }).join("");
        if (zone.supportTurn === game.turn && zone.supportSignature === signature) {
            return;
        }

        const cards = [];
        const used = [];
        if (occupied.some(Boolean)) {
            // 窗口固定 1920x1080，局内只有一种渲染尺度，模板也只生成这一档，全区域扫一遍即可。
            const perSlot = cfg.slots.map(function () { return null; });
            for (const candidate of chooseSupportCandidates(collectSupportCandidates(region, cfg))) {
                const slotIndex = supportSlotIndex(
                    cfg,
                    candidate.x + candidate.w / 2,
                    candidate.y + candidate.h / 2
                );
                if (slotIndex < 0 || !occupied[slotIndex]) continue;
                const current = perSlot[slotIndex];
                if (!current || candidate.score > current.score) {
                    perSlot[slotIndex] = candidate;
                }
            }
            for (let i = 0; i < cfg.slots.length; i++) {
                if (!occupied[i] || !perSlot[i]) continue;
                used.push(i);
                cards.push(makeSupportCard(perSlot[i]));
            }
        }

        for (let i = 0; i < cfg.slots.length; i++) {
            if (!occupied[i] || used.indexOf(i) >= 0) continue;
            const slot = cfg.slots[i];
            // 我方下半行离手牌最近，读不出内容的槽位保持未知，不冒险点击。
            if (side === "user" && slot.y + slot.h / 2 > 900) continue;
            const card = await identifyZoneCardByClick(side, "support", slot, game);
            cards.push(card || makeUnknownSupport(slot, "occupied"));
        }

        for (const card of cards) {
            readCardBadges(region, card, side, "support", game);
        }
        zone.supports = cards;
        // 槽位占用情况比识别到的卡牌更可靠，支援牌替换要用它判断是否已满。
        zone.supportOccupied = occupied;
        zone.supportTurn = game.turn;
        zone.supportSignature = signature;
        debugLog("支援区(" + side + "): " + cards.map(function (card) {
            return card.name + "x" + card.counter + "/" + card.endDamage +
                (card.endHeal ? "+" + card.endHeal : "") +
                (card.endElement ? "[" + card.endElement + "]" : "") + "@" + card.x;
        }).join(", "));
    }

    function summonSlotOccupied(region, slot) {
        return edgeDensity(region, slot.x, slot.y, slot.w, slot.h) >= SUMMON_OCCUPANCY;
    }

    // 召唤物图标位置固定，模板只截不含次数牌和元素徽标的画心窗口，逐槽位比对全部模板取最高分。
    function matchSummonArt(region, slot, art) {
        const pad = SUMMON_ART_SEARCH.pad;
        const wx = slot.x + art.offset[0] + art.window[0] - pad;
        const wy = slot.y + art.offset[1] + art.window[1] - pad;
        const ww = art.window[2] + pad * 2;
        const wh = art.window[3] + pad * 2;
        let best = null;
        let rival = 0;
        for (const card of art.cards) {
            const mat = getArtTemplateMat(card.template);
            if (!mat) continue;
            const ro = RecognitionObject.TemplateMatch(mat, wx, wy, ww, wh);
            ro.threshold = SUMMON_ART_SEARCH.accept;
            ro.MaxMatchCount = 1;
            let list = null;
            try {
                list = region.FindMulti(ro);
            } catch (e) {
                continue;
            }
            if (!list) continue;
            const count = typeof list.count === "number" ? list.count : (list.length || 0);
            if (!count) continue;
            const score = num(list[0].matchScore);
            if (score < SUMMON_ART_SEARCH.accept) continue;
            if (!best || score > best.score) {
                // 同画不同名的卡（例如柔灯之匣的各阶）会挤在一起，留下次高分供调试判断。
                if (best && best.name !== card.name) rival = Math.max(rival, best.score);
                best = { name: card.name, type: card.type, ctype: card.ctype, score: score };
            } else if (card.name !== best.name) {
                rival = Math.max(rival, score);
            }
        }
        if (!best) return null;
        best.gap = best.score - rival;
        best.source = best.gap < SUMMON_ART_SEARCH.gap ? "art+near" : "art";
        return best;
    }

    function matchSummonSlot(region, slot, entry) {
        const pad = 10;
        const ro = RecognitionObject.TemplateMatch(
            entry.mat,
            slot.x + entry.dx - pad,
            slot.y + entry.dy - pad,
            slot.w + pad * 2,
            slot.h + pad * 2
        );
        ro.threshold = SUMMON_TEMPLATE_SCORE;
        ro.MaxMatchCount = 1;
        let list = null;
        try {
            list = region.FindMulti(ro);
        } catch (e) {
            return null;
        }
        if (!list) return null;
        const count = typeof list.count === "number" ? list.count : (list.length || 0);
        if (!count) return null;
        const item = list[0];
        const score = num(item.matchScore);
        if (score < SUMMON_TEMPLATE_SCORE) return null;
        return {
            name: entry.name,
            score: score,
            endDamage: entry.endDamage,
            endHeal: entry.endHeal,
            endElement: entry.endElement,
            endDynamic: entry.endDynamic,
        };
    }

    function makeSummonCard(match, side, source, known) {
        const knownCard = !!(cardDic && cardDic[match.name]);
        const data = knownCard ? cardDic[match.name] : {};
        const endEffect = parseEndPhaseEffect(data.effect_text);
        return {
            name: match.name || "未知",
            rawName: "",
            type: data.type || "",
            ctype: data.ctype || "",
            x: match.x,
            y: match.y,
            w: match.w,
            h: match.h,
            artX: match.x,
            artY: match.y,
            artW: match.w,
            artH: match.h,
            counter: 0,
            endDamage: knownCard ? endEffect.damage : num(match.endDamage),
            endHeal: knownCard ? endEffect.heal : num(match.endHeal),
            endElement: knownCard ? endEffect.element : (match.endElement || ""),
            endDynamic: knownCard ? !!endEffect.dynamic : !!match.endDynamic,
            known: !!known && knownCard,
            source: source,
            template: null,
            score: match.score || 0,
        };
    }

    async function scanSummons(region, side, game) {
        const cfg = side === "user" ? ZONES.userSummons : ZONES.enemySummons;
        const zone = game.zones[side];
        const occupied = cfg.slots.map(function (slot) {
            return summonSlotOccupied(region, slot);
        });
        const signature = occupied.map(function (value) { return value ? "1" : "0"; }).join("");
        // 模板库有 67 张召唤物，逐槽位全库比对不便宜，占用情况没变的回合直接沿用上次结果。
        if (zone.summonTurn === game.turn && zone.summonSignature === signature) return;

        const art = artKind("summon");
        const useArt = !!(art && art.cards.length && art.search === "slot");
        const cards = [];

        for (let i = 0; i < cfg.slots.length; i++) {
            if (!occupied[i]) continue;
            const slot = cfg.slots[i];
            if (useArt) {
                const hit = matchSummonArt(region, slot, art);
                if (hit) {
                    cards.push(makeSummonCard(
                        { name: hit.name, score: hit.score, x: slot.x, y: slot.y, w: slot.w, h: slot.h },
                        side, hit.source, true
                    ));
                    continue;
                }
            }
            let best = null;
            for (const entry of zone.summonTemplates) {
                if (!entry.mat) continue;
                const match = matchSummonSlot(region, slot, entry);
                if (match && (!best || match.score > best.score)) best = match;
            }
            if (best) {
                cards.push(makeSummonCard(
                    { name: best.name, score: best.score, x: slot.x, y: slot.y, w: slot.w, h: slot.h },
                    side, "cache", true
                ));
                continue;
            }
            const card = await identifyZoneCardByClick(side, "summon", slot, game);
            cards.push(card || makeSummonCard({
                name: "未知", score: 0, x: slot.x, y: slot.y, w: slot.w, h: slot.h,
            }, side, "occupied", false));
        }

        for (const card of cards) {
            readCardBadges(region, card, side, "summon", game);
        }
        zone.summons = cards;
        zone.summonOccupied = occupied;
        zone.summonTurn = game.turn;
        zone.summonSignature = signature;
        debugLog("召唤区(" + side + "): " + cards.map(function (card) {
            return card.name + "x" + card.counter + "/" + card.endDamage +
                (card.endHeal ? "+" + card.endHeal : "") +
                (card.endElement ? "[" + card.endElement + "]" : "") + "@" + card.x +
                "/" + card.source + ":" + card.score.toFixed(2);
        }).join(", "));
    }

    async function scanZones(game) {
        if (!CFG.scanZones) return;
        const region = captureGameRegion();
        try {
            if (game.zones.counterTurn !== game.turn) {
                game.zones.counterTurn = game.turn;
                game.zones.user.badgeCache = {};
                game.zones.enemy.badgeCache = {};
            }
            await scanSupports(region, "user", game);
            await scanSupports(region, "enemy", game);
            await scanSummons(region, "user", game);
            await scanSummons(region, "enemy", game);
        } finally {
            region.dispose();
        }
    }

    // ==================== 骰子 / 手牌 ====================
    async function getDiceMsg(keepDice) {
        const reroll = await isUiReroll();
        if (!reroll && !(await isUiMain())) return null;
        const prefix = reroll ? "Roll" : "Main";
        const area = reroll ? { x: 553, y: 330, w: 819, h: 411 } : { x: 1848, y: 177, w: 38, h: 737 };

        moveMouseTo(1555, 860);
        await pause(120);

        const dice = {};
        const positions = {};
        const region = captureGameRegion();
        try {
            for (const element of DICE_ELEMENTS) {
                const matches = findTemplateInRegion(region, prefix + element, area.x, area.y, area.w, area.h, 0.85);
                if (matches.length) {
                    dice[element] = matches.length;
                    positions[element] = matches;
                }
            }
        } finally {
            region.dispose();
        }

        if (reroll && Array.isArray(keepDice) && keepDice.length) {
            for (const element of Object.keys(positions)) {
                if (keepDice.indexOf(element) >= 0) continue;
                for (const position of positions[element]) {
                    click(position.x + Math.floor(position.width / 2), position.y + Math.floor(position.height / 2));
                    await pause(100);
                }
            }
        }

        const total = sumDice(dice);
        debugLog("骰子识别: 总数=" + total + " | " + JSON.stringify(dice));
        return dice;
    }

    function dedupeDigitPoints(points) {
        points.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
        const kept = [];
        for (const point of points) {
            let duplicate = -1;
            for (let i = 0; i < kept.length; i++) {
                if (Math.abs(point.x - kept[i].x) <= HAND_DIGIT_DEDUPE &&
                    Math.abs(point.y - kept[i].y) <= HAND_DIGIT_DEDUPE) {
                    duplicate = i;
                    break;
                }
            }
            if (duplicate < 0) {
                kept.push(point);
            } else if (num(point.score) > num(kept[duplicate].score)) {
                // 同一费用位置可能被多个数字模板命中，保留匹配分最高的一个。
                kept[duplicate] = point;
            }
        }
        return kept;
    }

    function estimateHandCountFromXs(xs) {
        if (!xs.length) return -1;
        if (xs.length === 1) return 1;
        const gaps = [];
        for (let i = 1; i < xs.length; i++) gaps.push(xs[i] - xs[i - 1]);
        gaps.sort(function (a, b) { return a - b; });
        const median = gaps[Math.floor(gaps.length / 2)];
        let estimated;
        if (median < 20) {
            estimated = xs.length;
        } else {
            estimated = 1;
            for (const gap of gaps) {
                estimated += Math.max(1, Math.round(gap / median));
            }
        }
        estimated = Math.max(estimated, xs.length);
        return Math.min(estimated, 10);
    }

    async function countHandCardsByDigits() {
        click(RESET_X, RESET_Y);
        await pause(250);
        click(967, 1041);
        await pause(650);
        moveMouseTo(1791, 917);
        await pause(150);

        const points = [];
        const region = captureGameRegion();
        try {
            for (const key of HAND_DIGITS) {
                const matches = findTemplateInRegion(
                    region, key,
                    HAND_DIGIT_SEARCH.x, HAND_DIGIT_SEARCH.y,
                    HAND_DIGIT_SEARCH.w, HAND_DIGIT_SEARCH.h,
                    HAND_DIGIT_THRESHOLD
                );
                for (const match of matches) {
                    points.push({
                        x: match.x,
                        y: match.y,
                        value: parseInt(key.replace("digit_", ""), 10),
                        score: num(match.score),
                    });
                }
            }
        } finally {
            region.dispose();
        }

        click(RESET_X, RESET_Y);
        await pause(400);

        const kept = dedupeDigitPoints(points);
        lastHandDigitEntries = kept
            .filter(function (point) { return typeof point.value === "number"; })
            .map(function (point) {
                return { x: point.x, y: point.y, value: point.value, score: num(point.score) };
            })
            .sort(function (a, b) { return a.x - b.x; });
        const xs = [];
        for (const point of kept) {
            if (xs.indexOf(point.x) < 0) xs.push(point.x);
        }
        xs.sort(function (a, b) { return a - b; });
        const estimated = estimateHandCountFromXs(xs);
        const digitDetail = lastHandDigitEntries.map(function (point) {
            return point.value + "@" + point.x + "(" + point.score.toFixed(2) + ")";
        }).join(" ");
        debugLog("数字手牌识别: 匹配=" + kept.length + " xs=" + JSON.stringify(xs) +
            " " + digitDetail + " => " + estimated);
        return estimated;
    }

    async function countHandCardsByTemplates() {
        click(RESET_X, RESET_Y);
        await pause(250);
        click(967, 1041);
        await pause(650);
        moveMouseTo(1791, 917);
        await pause(150);

        lastHandDigitEntries = [];
        let found = -1;
        const region = captureGameRegion();
        try {
            for (let hand = 5; hand <= 10; hand++) {
                const matches = findTemplateInRegion(
                    region, "Hand" + hand,
                    HAND_TEMPLATE_SEARCH.x, HAND_TEMPLATE_SEARCH.y,
                    HAND_TEMPLATE_SEARCH.w, HAND_TEMPLATE_SEARCH.h,
                    0.8
                );
                if (matches.length) {
                    found = hand;
                    break;
                }
            }
        } finally {
            region.dispose();
        }

        click(RESET_X, RESET_Y);
        await pause(400);
        debugLog("模板手牌识别: " + found);
        return found;
    }

    async function countHandCards() {
        if (CFG.handCountMode.indexOf("关闭") >= 0) {
            lastHandDigitEntries = [];
            return -1;
        }
        if (CFG.handCountMode.indexOf("模板") >= 0) return await countHandCardsByTemplates();
        let count = await countHandCardsByDigits();
        if (count < 0) count = await countHandCardsByTemplates();
        return count;
    }

    // ==================== 游戏状态 ====================
    class Game {
        constructor() {
            this.user = [];
            this.enemy = [];
            this.enemyCount = 0;
            this.turn = 0;
            // 我方最近一次有角色倒下的回合，用于判断“本回合有角色被击倒才能打出”的牌。
            this.defeatTurn = -1;
            this.dice = {};
            this.handCount = 5;
            this.handCards = [];
            this.handKnown = false;
            this.cardPlayFailures = 0;
            this.cardFailures = {};
            this.cardPlaySupported = true;
            this.cardsPlayedThisTurn = 0;
            this.tuneBlocked = false;
            this.equipSlots = {};
            this.userLoaded = false;
            this.enemyLoaded = false;
            this.lethalAvailable = 0;
            this.finished = "";
            this.buffs = createBuffs();
            this.zones = createZones();
        }

        static expectAlive(card) {
            return !!card && (card.hp === null || card.hp > 0);
        }

        userAliveCount() {
            return this.user.filter(Game.expectAlive).length;
        }

        enemyAliveCount() {
            return this.enemy.filter(Game.expectAlive).length;
        }

        userHpRatio() {
            let current = 0;
            let total = 0;
            for (const card of this.user) {
                const max = card.maxHp || 10;
                total += max;
                current += card.hp === null ? max : Math.max(0, Math.min(card.hp, max));
            }
            return total > 0 ? clamp(current / total, 0, 1) : 0;
        }

        enemyHpRatio() {
            let current = 0;
            let total = 0;
            for (const card of this.enemy) {
                const max = card.maxHp || 10;
                total += max;
                current += card.hp === null ? max : Math.max(0, Math.min(card.hp, max));
            }
            return total > 0 ? clamp(current / total, 0, 1) : 0;
        }

        getActiveUser() {
            let active = this.user.find(function (card) { return card.active && Game.expectAlive(card); });
            if (!active) active = this.user.find(Game.expectAlive);
            return active || null;
        }

        getActiveEnemy() {
            let active = this.enemy.find(function (card) { return card.active && Game.expectAlive(card); });
            if (!active) active = this.enemy.find(Game.expectAlive);
            return active || null;
        }

        getActiveUserIndex() {
            const active = this.getActiveUser();
            return this.user.indexOf(active);
        }

        getActiveEnemyIndex() {
            const active = this.getActiveEnemy();
            return this.enemy.indexOf(active);
        }

        ensureActiveFlags(list) {
            const alive = list.filter(Game.expectAlive);
            if (!alive.length) {
                for (const card of list) card.active = false;
                return;
            }
            const active = alive.filter(function (card) { return card.active; });
            if (active.length === 1) {
                for (const card of list) card.active = card === active[0];
                return;
            }
            const fallback = active.length > 1 ? active[0] : alive[0];
            for (const card of list) card.active = card === fallback;
        }

        removeDeadEnemies() {
            const before = this.enemy.length;
            this.enemy = this.enemy.filter(function (card) { return !(card.hp === 0); });
            this.enemyCount = this.enemy.length;
            return before !== this.enemy.length;
        }
    }

    function ratio(value, max) {
        const m = num(max);
        return m > 0 ? clamp(num(value) / m, 0, 1) : 0;
    }

    function energyRatio(card) {
        if (!card) return 0;
        const total = num(card.chargeFilled) + num(card.chargeEmpty);
        if (total > 0) return clamp(num(card.chargeFilled) / total, 0, 1);
        if (card.chargeMax > 0) return clamp(num(card.chargeFilled) / card.chargeMax, 0, 1);
        return 0;
    }

    // 会让角色无法使用技能的异常状态。目前只有冻结有模板可识别，
    // 词表先按卡牌库里的控制类状态预留，后续补模板即可直接生效。
    const DISABLING_STATES = ["Freeze", "Stun", "Petrify", "Bind"];
    const STATE_LABELS = {
        Freeze: "冻结",
        Stun: "眩晕",
        Petrify: "石化",
        Bind: "束缚",
        Pyro: "火附着",
        Hydro: "水附着",
        Electro: "雷附着",
        Dendro: "草附着",
        Cryo: "冰附着",
    };

    function isCharacterDisabled(card) {
        if (!card) return false;
        const states = card.states || [];
        return states.some(function (state) { return DISABLING_STATES.indexOf(state) >= 0; });
    }

    function formatCardStates(card) {
        if (!card) return "";
        const labels = (card.states || []).map(function (state) {
            return STATE_LABELS[state] || state;
        });
        if (!labels.length && card.attached) labels.push(STATE_LABELS[card.attached] || card.attached);
        return labels.length ? "[" + labels.join(",") + "]" : "";
    }

    // 训练数据用的通用角色快照：血量、附着、异常状态、充能和增减伤都保留，
    // 新增状态只需补状态模板，不改训练特征维度。
    function characterSnapshot(game, card) {
        if (!card) return null;
        return {
            name: card.name,
            hp: card.hp,
            max_hp: card.maxHp,
            active: !!card.active,
            alive: Game.expectAlive(card),
            element: card.element || "",
            attached: card.attached || "",
            states: (card.states || []).slice(),
            disabled: isCharacterDisabled(card) ? 1 : 0,
            energy_filled: num(card.chargeFilled),
            energy_empty: num(card.chargeEmpty),
            damage_buff: buffDamage(game, card.name),
            take_damage_buff: buffTakeDamage(game, card.name),
            shield: buffShield(game, card.name),
            panel_role_states: panelEntriesOf(card, game, "role").map(function (entry) { return entry.name; }),
            panel_faction_states: panelEntriesOf(card, game, "faction").map(function (entry) {
                return entry.count === null ? entry.name : entry.name + "x" + entry.count;
            }),
        };
    }

    // 结束阶段结算：召唤物和支援/场地牌都可能有“结束阶段：造成X点伤害/治疗X点”。
    function endPhaseTotals(game) {
        const mySupports = zoneCards(game, "user", "supports");
        const enemySupports = zoneCards(game, "enemy", "supports");
        const mySummons = zoneCards(game, "user", "summons");
        const enemySummons = zoneCards(game, "enemy", "summons");
        return {
            myDamage: sumZoneField(mySummons, "endDamage") + sumZoneField(mySupports, "endDamage"),
            enemyDamage: sumZoneField(enemySummons, "endDamage") + sumZoneField(enemySupports, "endDamage"),
            myHeal: sumZoneField(mySummons, "endHeal") + sumZoneField(mySupports, "endHeal"),
            enemyHeal: sumZoneField(enemySummons, "endHeal") + sumZoneField(enemySupports, "endHeal"),
            myElements: sumZoneElements(mySummons.concat(mySupports)),
            enemyElements: sumZoneElements(enemySummons.concat(enemySupports)),
        };
    }

    function sumZoneElements(cards) {
        const totals = {};
        for (const card of cards) {
            const element = card.endElement;
            const damage = num(card.endDamage);
            if (!element || damage <= 0) continue;
            totals[element] = (totals[element] || 0) + damage;
        }
        return totals;
    }

    // 结束阶段伤害同样会触发元素反应，取各来源里能打出的最高反应加成。
    function maxElementReaction(elements, attached) {
        if (!elements || !attached) return 0;
        let best = 0;
        for (const element of Object.keys(elements)) {
            best = Math.max(best, reactionBonus(element, attached));
        }
        return best;
    }

    function zoneCards(game, side, kind) {
        const zones = game.zones;
        return zones && zones[side] ? zones[side][kind] : [];
    }

    function sumZoneField(cards, field) {
        let total = 0;
        for (const card of cards) total += num(card[field]);
        return total;
    }

    function countUnknownCards(cards) {
        let total = 0;
        for (const card of cards || []) {
            if (!card.known) total += 1;
        }
        return total;
    }

    // 详情面板条目只在读到它的那个回合有效，跨回合沿用会把已经消失的状态算进去。
    function panelEntriesOf(card, game, section) {
        if (!card || !game || card.panelStateTurn !== game.turn) return [];
        if (!card.panelEntries || !card.panelEntries.length) return [];
        return card.panelEntries.filter(function (entry) { return entry.section === section; });
    }

    function panelSectionCount(card, game, section) {
        return panelEntriesOf(card, game, section).length;
    }

    function panelSectionCounter(card, game, section) {
        let total = 0;
        for (const entry of panelEntriesOf(card, game, section)) total += num(entry.count);
        return total;
    }

    function summarizeZoneCards(cards) {
        return cards.map(function (card) {
            return {
                name: card.name,
                known: !!card.known,
                counter: num(card.counter),
                end_damage: num(card.endDamage),
                end_heal: num(card.endHeal),
                end_element: card.endElement || "",
                badge_value: num(card.badgeValue),
                badge_element: card.badgeElement || "",
                source: card.source || "",
                x: card.x,
                y: card.y,
                w: card.w,
                h: card.h,
            };
        });
    }

    function formatZoneCards(cards) {
        if (!cards || !cards.length) return "无";
        return cards.map(function (card) {
            let text = card.name + "(" + num(card.counter);
            if (num(card.endDamage) > 0) text += "/" + num(card.endDamage);
            if (num(card.endHeal) > 0) text += "/治疗" + num(card.endHeal);
            if (!card.known) text += "?";
            return text + ")";
        }).join(" ");
    }

    function buildState(game) {
        const active = game.getActiveUser();
        const enemy = game.getActiveEnemy();
        const activeElement = active ? active.element : "";
        const enemyElement = enemy ? enemy.element : "";
        const attached = enemy ? enemy.attached : "";
        const mySupports = zoneCards(game, "user", "supports");
        const enemySupports = zoneCards(game, "enemy", "supports");
        const mySummons = zoneCards(game, "user", "summons");
        const enemySummons = zoneCards(game, "enemy", "summons");
        const handCards = game.handCards || [];
        const knownHand = handCards.filter(function (card) { return card.known; });
        const handKnown = game.handCount > 0 && handCards.length === game.handCount
            ? knownHand.length / game.handCount
            : 0;
        const handValues = knownHand.map(function (card) { return cardUtility(card, game); });
        const handValue = handValues.reduce(function (sum, value) { return sum + value; }, 0);
        const handBestValue = handValues.reduce(function (best, value) { return Math.max(best, value); }, 0);
        const defense = assessDefense(game);
        const endTotals = endPhaseTotals(game);
        const state = {
            turn: game.turn,
            my_alive: game.userAliveCount(),
            enemy_alive: game.enemyAliveCount(),
            my_hp_ratio: game.userHpRatio(),
            enemy_hp_ratio: game.enemyHpRatio(),
            active_hp_ratio: active ? ratio(active.hp === null ? active.maxHp : active.hp, active.maxHp) : 0,
            active_hp: active ? num(active.hp) : 0,
            active_energy_ratio: active ? energyRatio(active) : 0,
            active_frozen: isCharacterDisabled(active) ? 1 : 0,
            active_disabled: isCharacterDisabled(active) ? 1 : 0,
            dice_total: sumDice(game.dice),
            dice_omni: num(game.dice.Omni),
            dice_matching: num(game.dice[activeElement]),
            hand_count: game.handCount,
            enemy_attached_any: attached ? 1 : 0,
            reaction_bonus: reactionBonus(activeElement, attached),
            lethal_available: game.lethalAvailable ? 1 : 0,
            // 我方承伤加成和护盾会改变“下回合是否会被击倒”的判断。
            could_die_next: active &&
                num(active.hp) <= 3 + buffTakeDamage(game, active.name) - buffShield(game, active.name) ? 1 : 0,
            // 按敌方实际最高伤害估算的阵亡风险，只用于决策启发式，不进入模型输入。
            enemy_threat: defense.threat,
            active_in_danger: defense.danger ? 1 : 0,
            defense_available: defense.defenseAvailable ? 1 : 0,
            switch_cost: defense.switchCost,
            active_catalyst: active && String(active.weapon || "").indexOf("法器") >= 0 ? 1 : 0,
            enemy_active_hp_ratio: enemy ? ratio(enemy.hp === null ? enemy.maxHp : enemy.hp, enemy.maxHp) : 0,
            enemy_active_hp: enemy ? num(enemy.hp === null ? enemy.maxHp : enemy.hp) : 0,
            enemy_active_energy_ratio: enemy ? energyRatio(enemy) : 0,
            enemy_active_frozen: isCharacterDisabled(enemy) ? 1 : 0,
            enemy_active_disabled: isCharacterDisabled(enemy) ? 1 : 0,
            my_support_count: mySupports.length,
            enemy_support_count: enemySupports.length,
            my_summon_count: mySummons.length,
            enemy_summon_count: enemySummons.length,
            my_support_counter: sumZoneField(mySupports, "counter"),
            enemy_support_counter: sumZoneField(enemySupports, "counter"),
            my_summon_counter: sumZoneField(mySummons, "counter"),
            enemy_summon_counter: sumZoneField(enemySummons, "counter"),
            my_summon_damage: sumZoneField(mySummons, "endDamage"),
            enemy_summon_damage: sumZoneField(enemySummons, "endDamage"),
            // 结束阶段伤害/治疗把支援/场地牌也算进来；只用于启发式，不改模型输入。
            my_end_damage: endTotals.myDamage,
            enemy_end_damage: endTotals.enemyDamage,
            my_end_heal: endTotals.myHeal,
            enemy_end_heal: endTotals.enemyHeal,
            my_end_reaction: maxElementReaction(endTotals.myElements, attached),
            enemy_end_reaction: maxElementReaction(endTotals.enemyElements, active ? active.attached : ""),
            hand_known: handKnown,
            hand_value: handValue,
            hand_best_value: handBestValue,
            my_element: activeElement,
            enemy_element: enemyElement,
            enemy_attached_element: attached,
            // 详情面板读到的条目数：图标模板只有 6 张，面板里的条目数能反映“看不见的状态”。
            my_role_states: panelSectionCount(active, game, "role"),
            enemy_role_states: panelSectionCount(enemy, game, "role"),
            my_faction_states: panelSectionCount(active, game, "faction"),
            enemy_faction_states: panelSectionCount(enemy, game, "faction"),
            my_faction_counters: panelSectionCounter(active, game, "faction"),
            enemy_faction_counters: panelSectionCounter(enemy, game, "faction"),
            my_summon_unknown: countUnknownCards(mySummons),
            enemy_summon_unknown: countUnknownCards(enemySummons),
            // 以下三项只用于决策启发式：我方出战身上的附着会被敌方技能/结束阶段打出反应。
            my_attached_element: active ? (active.attached || "") : "",
            enemy_reaction_bonus: maxEnemyReactionBonus(enemy, active),
            enemy_freeze_risk: enemyFreezeRisk(enemy, active) ? 1 : 0,
            zones: {
                my_supports: summarizeZoneCards(mySupports),
                enemy_supports: summarizeZoneCards(enemySupports),
                my_summons: summarizeZoneCards(mySummons),
                enemy_summons: summarizeZoneCards(enemySummons),
            },
            // 双方全部角色的状态快照，供数据集与运行时兜底使用（不参与模型输入）。
            characters: {
                user: game.user.map(function (card) { return characterSnapshot(game, card); }),
                enemy: game.enemy.map(function (card) { return characterSnapshot(game, card); }),
            },
        };
        for (const element of ELEMENTS) {
            state["my_end_element_" + element] = num(endTotals.myElements[element]);
            state["enemy_end_element_" + element] = num(endTotals.enemyElements[element]);
        }
        return state;
    }

    function makeEndAction(active, enemy, totalDice) {
        return {
            type: "end",
            dice_cost: 0,
            tune: 0,
            affordable: true,
            expected_damage: 0,
            reaction_bonus: 0,
            kills_target: 0,
            is_switch: 0,
            target_hp_ratio: enemy ? ratio(enemy.hp === null ? enemy.maxHp : enemy.hp, enemy.maxHp) : 0,
            target_index: 0,
            self_hp_ratio: active ? ratio(active.hp === null ? active.maxHp : active.hp, active.maxHp) : 0,
            element_matches_active: 0,
            is_active_action: 1,
            target_is_enemy_active: 1,
            dice_total: totalDice,
        };
    }

    // 估算角色下一步能打出的最高收益（伤害+反应+技能类型加权），
    // 用于判断切到后排主攻角色是否比当前出战角色继续输出更划算。
    function skillPotential(game, card, diceTotal, attached) {
        if (!card || !card.skills) return 0;
        const damageBuff = buffDamage(game, card.name);
        let best = 0;
        for (const skill of card.skills) {
            if (!skill || skill.type === "被动技能") continue;
            const cost = effectiveSkillCost(game, skill);
            if (num(cost.energy) > num(card.chargeFilled)) continue;
            if (num(cost.dice) > diceTotal) continue;
            const info = parseSkillDamage(skill.effect_text);
            if (!info.damage) continue;
            const element = info.element || card.element || "";
            const value = info.damage + damageBuff + 1.1 * reactionBonus(element, attached) +
                (skill.type === "元素爆发" ? 0.8 : (skill.type === "元素战技" ? 0.35 : 0));
            if (value > best) best = value;
        }
        return best;
    }

    // 敌方出战角色下一次行动能打出的最高伤害（含伤害增益与我方附着反应），
    // 用来判断我方出战角色会不会被一击带走。
    function maxEnemyHitDamage(game, enemy, active) {
        if (!enemy || !Array.isArray(enemy.skills)) return 0;
        const damageBuff = buffDamage(game, enemy.name);
        const attached = active ? active.attached || "" : "";
        let best = 0;
        for (const skill of enemy.skills) {
            if (!skill || skill.type === "被动技能") continue;
            const cost = parseSkillCost(skill.cost);
            if (num(cost.energy) > num(enemy.chargeFilled)) continue;
            const info = parseSkillDamage(skill.effect_text);
            if (!info.damage) continue;
            const element = info.element || enemy.element || "";
            const damage = info.damage + damageBuff + reactionBonus(element, attached);
            if (damage > best) best = damage;
        }
        return best;
    }

    // 我方出战角色是否会被敌方下一套带走，以及有没有更健康的角色可以换过去躲开。
    // 敌方技能之外还要算上双方召唤物/支援牌的结束阶段伤害与治疗。
    function assessDefense(game) {
        const active = game.getActiveUser();
        const enemy = game.getActiveEnemy();
        const endTotals = endPhaseTotals(game);
        if (!active) {
            return {
                threat: 0, danger: false, switchCost: 0, defenseAvailable: false,
                skillThreat: 0, endDamage: 0, endHeal: 0,
            };
        }
        const activeHp = num(active.hp === null ? active.maxHp : active.hp);
        const activeRatio = ratio(activeHp, active.maxHp);
        const skillThreat = maxEnemyHitDamage(game, enemy, active);
        // 结束阶段伤害也会按元素反应加成结算，对手的召唤物元素同样会放大威胁。
        const endReaction = maxElementReaction(endTotals.enemyElements, active.attached || "");
        const threat = Math.max(0, skillThreat + endTotals.enemyDamage + endReaction - endTotals.myHeal);
        const switchCost = effectiveSwitchCost(game);
        const healthyBench = game.user.some(function (card) {
            if (card === active || !Game.expectAlive(card)) return false;
            return ratio(card.hp === null ? card.maxHp : card.hp, card.maxHp) >= activeRatio + 0.15;
        });
        return {
            threat: threat,
            danger: activeHp > 0 && threat >= activeHp,
            switchCost: switchCost,
            defenseAvailable: healthyBench && sumDice(game.dice) >= switchCost,
            skillThreat: skillThreat,
            endDamage: endTotals.enemyDamage + endReaction,
            endHeal: endTotals.myHeal,
        };
    }

    // 粗略胜率估计：只用于“明显打不赢就放弃”这一个决策，
    // 不参与动作打分，避免误判影响正常出牌。
    function estimateWinRate(game) {
        const myAlive = game.userAliveCount();
        const enemyAlive = game.enemyAliveCount();
        let rate = 0.5 + 0.16 * (myAlive - enemyAlive) +
            0.7 * (game.userHpRatio() - game.enemyHpRatio());
        const active = game.getActiveUser();
        const enemy = game.getActiveEnemy();
        if (active) {
            rate += 0.12 * (ratio(active.hp === null ? active.maxHp : active.hp, active.maxHp) - 0.5);
        }
        if (enemy) {
            rate -= 0.12 * (ratio(enemy.hp === null ? enemy.maxHp : enemy.hp, enemy.maxHp) - 0.5);
        }
        const endTotals = endPhaseTotals(game);
        rate += 0.02 * (endTotals.myDamage - endTotals.enemyDamage) +
            0.02 * (endTotals.myHeal - endTotals.enemyHeal);
        return clamp(rate, 0.01, 0.99);
    }

    function buildActions(game) {
        const active = game.getActiveUser();
        const enemy = game.getActiveEnemy();
        const dice = game.dice || {};
        const totalDice = sumDice(dice);
        const actions = [];
        if (!active) {
            actions.push(makeEndAction(null, enemy, totalDice));
            return actions;
        }

        const activeElement = active.element || "";
        const activeHpRatio = ratio(active.hp === null ? active.maxHp : active.hp, active.maxHp);
        const enemyHp = enemy ? num(enemy.hp === null ? enemy.maxHp : enemy.hp) : 0;
        const enemyHpRatio = enemy ? ratio(enemyHp, enemy.maxHp) : 0;
        const attached = enemy ? enemy.attached : "";
        const tuneValue = tuneCardValue(game);
        const damageBuff = buffDamage(game, active.name);
        // 冻结/眩晕等异常状态都会让出战角色无法释放技能，必须先换人或结束回合。
        const activeDisabled = isCharacterDisabled(active);

        for (const skill of active.skills) {
            if (!skill || skill.type === "被动技能") continue;
            const cost = effectiveSkillCost(game, skill);
            const affordability = computeAffordability(
                cost, dice, num(active.chargeFilled), game, activeElement
            );
            if (activeDisabled) affordability.affordable = false;
            const damageInfo = parseSkillDamage(skill.effect_text);
            const element = damageInfo.element || activeElement;
            // 伤害加成只作用于有直接伤害的技能，纯增益技能不能当成攻击手段。
            const damage = damageInfo.damage > 0 ? damageInfo.damage + damageBuff : 0;
            const reaction = damage > 0 ? reactionBonus(element, attached) : 0;
            const kills = affordability.affordable && damage > 0 && enemy &&
                (damage + reaction >= enemyHp);
            actions.push({
                type: skillTypeToAction(skill.type),
                dice_cost: cost.dice,
                tune: affordability.tune,
                affordable: affordability.affordable,
                expected_damage: damage,
                reaction_bonus: reaction,
                kills_target: kills ? 1 : 0,
                is_switch: 0,
                target_hp_ratio: enemyHpRatio,
                target_index: 0,
                self_hp_ratio: activeHpRatio,
                element_matches_active: 1,
                is_active_action: 1,
                target_is_enemy_active: 1,
                damage_element: element,
                tune_card_value: affordability.tune > 0 ? tuneValue : 0,
                skill_id: skill.id,
                skill_name: skill.name,
                skill_type: skill.type,
                skill_energy_cost: cost.energy,
                skill_effect: skill.effect_text || "",
                base_damage: damageInfo.damage,
            });
        }

        const activePotential = skillPotential(game, active, totalDice, attached);
        const activeIndex = game.getActiveUserIndex();
        // 切人费用可能被“切换少花费”效果降到 0，后续技能按减费后的余额规划。
        const switchCost = effectiveSwitchCost(game);
        for (let index = 0; index < game.user.length; index++) {
            if (index === activeIndex) continue;
            const card = game.user[index];
            if (!Game.expectAlive(card)) continue;
            const targetPotential = skillPotential(game, card, Math.max(0, totalDice - switchCost), attached);
            const switchGain = Math.max(0, targetPotential - activePotential);
            const frozen = isCharacterDisabled(card);
            actions.push({
                type: "switch",
                dice_cost: switchCost,
                tune: 0,
                affordable: totalDice >= switchCost && !frozen,
                expected_damage: 0,
                reaction_bonus: 0,
                kills_target: 0,
                is_switch: 1,
                target_hp_ratio: enemyHpRatio,
                // target_index 只表示敌方目标；换人槽位写在 switch_index，别把随机槽号喂给模型。
                target_index: 0,
                self_hp_ratio: ratio(card.hp === null ? card.maxHp : card.hp, card.maxHp),
                element_matches_active: 0,
                is_active_action: 0,
                target_is_enemy_active: 1,
                switch_index: index,
                switch_gain: switchGain,
                switch_target_potential: targetPotential,
                switch_frozen: frozen ? 1 : 0,
            });
        }

        // 斩杀优先；没有斩杀时为后续战斗行动预留骰子，避免把牌打光却放不出技能。
        const hasLethal = actions.some(function (action) { return !!action.kills_target; });
        const attackCosts = actions.filter(function (action) {
            return ["normal", "skill", "burst"].indexOf(action.type) >= 0 &&
                action.affordable && num(action.expected_damage) > 0;
        }).map(function (action) { return num(action.dice_cost); });
        const reserveDice = attackCosts.length ? Math.min.apply(null, attackCosts) : 0;
        // 出战角色会被一套带走时，出牌不能吃掉留给换人的骰子。
        const defense = assessDefense(game);
        const cardReserve = defense.danger && defense.defenseAvailable
            ? Math.max(reserveDice, defense.switchCost)
            : reserveDice;
        if (!hasLethal && game.cardsPlayedThisTurn < 2 && CFG.useActionCards &&
            game.cardPlaySupported && game.handCards.length === game.handCount) {
            refreshHandValues(game);
            for (const card of game.handCards) {
                if (!isPlayableHandCard(card, game)) continue;
                // 卡面数字识别出的实际费用已经写回 card.cost，这里再叠加本回合的减费效果。
                const cardDice = effectiveCardDice(game, card);
                // 支援区最多 4 张；满了以后只有明显更好的牌才替换场上较差的一张。
                let replaceSlot = -1;
                let replaceName = "";
                if (card.ctype === "支援牌" && supportSlotsFilled(game) >= 4) {
                    const replacement = pickSupportReplacement(game, card);
                    if (!replacement) continue;
                    replaceSlot = replacement.slot;
                    replaceName = replacement.name;
                }
                if (totalDice < cardDice + cardReserve) continue;
                // 同一角色同槽位再装备会顶替掉原来的牌，宁可换个角色或直接不打。
                let equipSlot = "";
                let equipTarget = -1;
                if (card.ctype === "装备牌") {
                    equipSlot = equipSlotOf(card);
                    if (equipSlot) {
                        equipTarget = pickEquipTargetIndex(game, card, equipSlot);
                        if (equipTarget < 0) continue;
                    } else {
                        equipTarget = game.getActiveUserIndex();
                    }
                }
                const damage = num(card.damage);
                const element = card.damageElement || activeElement;
                const reaction = damage > 0 ? reactionBonus(element, attached) : 0;
                actions.push({
                    type: "play_card",
                    dice_cost: cardDice,
                    tune: 0,
                    affordable: true,
                    expected_damage: damage,
                    reaction_bonus: reaction,
                    kills_target: damage > 0 && enemy && (damage + reaction >= enemyHp) ? 1 : 0,
                    is_switch: 0,
                    target_hp_ratio: enemyHpRatio,
                    target_index: 0,
                    self_hp_ratio: activeHpRatio,
                    element_matches_active: 1,
                    is_active_action: 1,
                    target_is_enemy_active: 1,
                    damage_element: element,
                    card_index: card.index,
                    card_name: card.name,
                    card_cost: cardDice,
                    card_value: card.value,
                    card_effect: card.effect,
                    card_needs_target: cardNeedsTarget(card) ? 1 : 0,
                    card_is_support: card.ctype === "支援牌" || card.ctype === "场地牌" ? 1 : 0,
                    card_is_event: card.ctype === "事件牌" ? 1 : 0,
                    card_is_equipment: card.ctype === "装备牌" ? 1 : 0,
                    card_ctype: card.ctype,
                    equip_slot: equipSlot,
                    equip_target_index: equipTarget,
                    card_has_damage: card.tags.damage ? 1 : 0,
                    card_has_heal: card.tags.heal ? 1 : 0,
                    card_has_draw: card.tags.draw ? 1 : 0,
                    card_has_dice: card.tags.dice ? 1 : 0,
                    card_replace_support: replaceSlot >= 0 ? 1 : 0,
                    replace_support_slot: replaceSlot,
                    replace_support_name: replaceName,
                });
            }
        }

        actions.push(makeEndAction(active, enemy, totalDice));
        return actions;
    }

    function chooseAction(state, actions) {
        const expertScores = actions.map(function (action) { return expertScore(state, action); });
        let policyScores = null;
        let scores = expertScores;
        let mode = "expert";
        if (CFG.useModel && strategy.model) {
            try {
                const stateValues = stateVector(state);
                policyScores = actions.map(function (action) {
                    return strategy.model.score(stateValues, actionVector(state, action));
                });
                scores = policyScores;
                mode = "model";
                // 阵亡风险、结束阶段结算与后排潜力现在都进入模型输入；这里只保留
                // 三条兜底：屏蔽换到更残后排的亏动作、压掉其他无故换人，
                // 并在出战角色会被打倒时抬一手更健康的换人目标。
                const attackAvailable = actions.some(function (action) {
                    return action.affordable && action.type !== "switch" && action.type !== "tune" &&
                        action.type !== "end" && num(action.expected_damage) > 0;
                });
                for (let index = 0; index < actions.length; index++) {
                    const action = actions[index];
                    if (action.type !== "switch" || !action.affordable) continue;
                    if (switchLosesHealth(state, action)) {
                        scores[index] = -1e9;
                    } else if (switchIsWasteful(state, action)) {
                        // 有伤害可打时换人等于白送一次战斗行动，惩罚要压过血量特征带来的偏置。
                        scores[index] = Math.max(0, scores[index] - (attackAvailable ? 0.6 : 0.3));
                    }
                    if (num(state.active_in_danger)) {
                        if (num(action.self_hp_ratio) >= num(state.active_hp_ratio) + 0.15) {
                            scores[index] += switchSurvivesThreat(state, action) ? 1.0 : 0.4;
                        } else {
                            scores[index] = Math.max(0, scores[index] - 0.3);
                        }
                    }
                    // 换到没有危险附着的角色可以躲开敌方 +2 反应，但只在骰子不多或血量偏低时值得。
                    const exposure = num(state.enemy_reaction_bonus);
                    const targetExposure = switchReactionExposure(state, action);
                    const avoidWorth = num(state.active_hp_ratio) <= 0.45 ||
                        num(state.dice_total) <= num(state.switch_cost) + 1;
                    const risky = exposure >= 2 || num(state.enemy_freeze_risk);
                    if (avoidWorth && risky &&
                        targetExposure !== null && targetExposure < exposure) {
                        scores[index] += 0.5;
                    } else if (targetExposure !== null && targetExposure >= 2 && targetExposure > exposure) {
                        scores[index] -= 0.3;
                    }
                }
                // 模型把反应当特征学，但 +2 反应（蒸发/融化/超载）经常决定斩杀线，
                // 这里给可执行动作补一点直接加成，避免模型忽略高价值反应。
                for (let index = 0; index < actions.length; index++) {
                    const action = actions[index];
                    if (action.type === "end" || !action.affordable) continue;
                    if (num(action.reaction_bonus) >= 2) scores[index] += 0.4;
                    scores[index] += 0.5 * reactionSideValue(state, action);
                }
            } catch (e) {
                log.error("模型推理失败，回退专家策略: " + e);
                policyScores = null;
                scores = expertScores;
                mode = "expert";
            }
        }
        for (let index = 0; index < actions.length; index++) {
            if (!actions[index].affordable) scores[index] = -1e9;
        }
        let chosen = argmax(scores);

        let lethalIndex = -1;
        let lethalScore = -Infinity;
        for (let index = 0; index < actions.length; index++) {
            const action = actions[index];
            if (!action.kills_target || !action.affordable) continue;
            const score = num(action.expected_damage) * 10 - num(action.dice_cost) - num(action.tune) * 0.1;
            if (score > lethalScore) {
                lethalScore = score;
                lethalIndex = index;
            }
        }
        if (lethalIndex >= 0) {
            chosen = lethalIndex;
            mode += "+lethal";
        }

        // 模型有“提前结束回合”的倾向。手里还有骰子、又存在明确划算的动作时，
        // 用专家评分兜底，避免每回合带着 2~3 颗骰子白白交回合（骰子不会跨回合保留）。
        const endKills = num(state.enemy_active_hp) > 0 &&
            num(state.my_end_damage) + num(state.my_end_reaction) - num(state.enemy_end_heal) >=
                num(state.enemy_active_hp) &&
            num(state.enemy_end_damage) + num(state.enemy_end_reaction) - num(state.my_end_heal) <
                num(state.active_hp);
        if (actions[chosen] && actions[chosen].type === "end" &&
            !num(state.lethal_available) && !endKills && num(state.dice_total) >= 2) {
            let useDiceIndex = -1;
            let useDiceScore = 1.0;
            for (let index = 0; index < actions.length; index++) {
                const action = actions[index];
                // 换人是战斗行动，本来就会把回合交给对手，不算“用掉骰子”，不参与兜底。
                if (action.type === "end" || action.type === "tune" || action.type === "switch" ||
                    !action.affordable) continue;
                const score = expertScores[index];
                if (score > useDiceScore) {
                    useDiceScore = score;
                    useDiceIndex = index;
                }
            }
            if (useDiceIndex >= 0) {
                chosen = useDiceIndex;
                mode += "+usedice";
                debugLog("模型倾向结束回合，但仍有 " + num(state.dice_total) +
                    " 颗骰子，改走 " + actions[useDiceIndex].type +
                    (actions[useDiceIndex].card_name ? "(" + actions[useDiceIndex].card_name + ")" : ""));
            }
        }
        return { chosen: chosen, expertScores: expertScores, policyScores: policyScores, mode: mode };
    }

    // ==================== 操作 ====================
    async function mouseDrag(startX, startY, endX, endY, options) {
        // 游戏需要先按住一小段时间才进入拖拽状态；到达目标后也要停留，
        // 否则松开鼠标时拖拽动画还没落到目标区，元素调和会失败。
        const opts = options || {};
        const holdMs = opts.holdMs === undefined ? 220 : opts.holdMs;
        const moveMs = opts.moveMs === undefined ? 600 : opts.moveMs;
        const settleMs = opts.settleMs === undefined ? 400 : opts.settleMs;
        const steps = 15;
        const events = [];
        events.push({ type: 4, mouseX: startX, mouseY: startY, mouseButton: "Left", time: 0 });
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const eased = 1 - Math.pow(1 - progress, 2);
            events.push({
                type: 2,
                mouseX: Math.round(startX + (endX - startX) * eased),
                mouseY: Math.round(startY + (endY - startY) * eased),
                time: holdMs + Math.round((moveMs * i) / steps),
            });
        }
        events.push({
            type: 5,
            mouseX: endX,
            mouseY: endY,
            mouseButton: "Left",
            time: holdMs + moveMs + settleMs,
        });
        const script = {
            macroEvents: events,
            info: {
                name: "",
                description: "",
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                recordDpi: 1.25,
            },
        };
        await keyMouseScript.run(JSON.stringify(script));
    }

    function skillButtonPosition(card, skillId, skillName) {
        if (!card || !card.skills.length) return 1;
        const activeSkills = card.skills.filter(function (skill) { return skill.type !== "被动技能"; });
        let index = -1;
        for (let i = 0; i < card.skills.length; i++) {
            const skill = card.skills[i];
            if (skill.id === skillId && (!skillName || skill.name === skillName)) {
                index = activeSkills.indexOf(skill);
                break;
            }
        }
        if (index < 0) {
            for (let i = 0; i < activeSkills.length; i++) {
                if (activeSkills[i].name === skillName) {
                    index = i;
                    break;
                }
            }
        }
        if (index < 0) index = 0;
        return activeSkills.length >= 4 ? index : index + 1;
    }

    async function useSkill(action, game) {
        const active = game.getActiveUser();
        if (!active) return false;
        // 骰子不足且已经没有可调和的手牌时，技能不可能放出来，直接放弃。
        let skillDef = (active.skills || []).find(function (skill) {
            return skill.id === action.skill_id && (!action.skill_name || skill.name === action.skill_name);
        });
        if (!skillDef && action.skill_name) {
            skillDef = (active.skills || []).find(function (skill) { return skill.name === action.skill_name; });
        }
        if (skillDef && !diceCoversCost(effectiveSkillCost(game, skillDef), game.dice)) {
            log.warn("骰子不足且没有可调和手牌，放弃释放 " + (action.skill_name || "技能"));
            return false;
        }
        const position = skillButtonPosition(active, action.skill_id, action.skill_name);
        const point = SKILL_POSITIONS[position];
        if (!point) {
            log.error("技能按钮位置无效: " + position);
            return false;
        }
        click(RESET_X, RESET_Y);
        await pause(400);
        // 残留的切换确认状态下，技能按钮位置会被“切换角色”按钮占用，先取消。
        if (await isSwitchConfirmMode()) {
            log.warn("检测到切换确认状态，先取消再释放技能");
            click(RESET_X, RESET_Y);
            await pause(500);
            if (await isSwitchConfirmMode()) {
                log.warn("切换确认状态未能取消，放弃本次技能");
                return false;
            }
        }
        // 出战角色判断错误时会点到别的角色或元素爆发，释放前再校验一次。
        if (game.user.length === 3 && game.userAliveCount() === 3) {
            const activeIndex = game.user.indexOf(active);
            if (activeIndex >= 0 && (await isUserCardActive(activeIndex)) === false) {
                log.warn("出战角色识别不一致，放弃本次技能并重新识别牌局");
                return false;
            }
        }
        click(point[0], point[1]);
        // 技能详情面板需要约 1 秒才完全弹出，点击过早会被吞掉。
        await pause(1200);
        if (findTemplateOnScreen("diceLack", 960, 0, 960, 1080, 0.8).length > 0) {
            log.warn("元素骰子不足，技能未释放");
            click(RESET_X, RESET_Y);
            await pause(300);
            return false;
        }
        click(point[0], point[1]);
        await pause(800);
        moveMouseTo(RESET_X, RESET_Y);
        await pause(350);
        return true;
    }

    // 结束回合按钮在左下角，左侧的角色/技能/手牌详情面板会把它完全盖住，
    // 在面板内部点击不会关闭面板，所以点按钮前必须先点面板外的空场把面板关掉。
    async function terminateTurn() {
        for (let attempt = 0; attempt < 2; attempt++) {
            click(960, 540);
            await pause(400);
            for (let i = 0; i < 3; i++) {
                click(79, 539);
                await pause(650);
                // 结束后进入“结束阶段”或换敌方行动；仍是 user 说明这一下没点到按钮。
                // 每点一次就校验，避免敌方快速结束回合后把新回合又结束掉。
                if ((await getActingTurn()) !== "user") return true;
            }
        }
        return false;
    }

    // 切换过程中只关心目标角色是否已经站到出战位：
    // 先查后台血条位，再查出战血条位，返回 true/false，识别失败返回 null。
    async function isUserCardActive(index) {
        const area = HP_AREA["user3" + (index + 1)];
        if (!area) return null;
        let region = null;
        try {
            region = captureGameRegion();
            const standbyHp = ocrIntInRegion(region, area[0], area[2], HP_AREA.size[0], HP_AREA.size[1]);
            if (standbyHp !== null) return false;
            const activeHp = ocrIntInRegion(region, area[0], area[1], HP_AREA.size[0], HP_AREA.size[1]);
            if (activeHp !== null) return true;
            return null;
        } catch (e) {
            debugLog("出战状态校验失败: " + e);
            return null;
        } finally {
            if (region) region.dispose();
        }
    }

    function syncActiveUser(index, game) {
        if (game) {
            game.user.forEach(function (card, i) { card.active = i === index; });
        }
    }

    // 点开角色牌后左侧会出现角色详情面板，标题区域就是角色名。
    async function isUserCardPanelOpen(name) {
        const text = normalizeOcrText(await ocrTextAt(311, 115, 341, 50));
        if (!text) return false;
        const target = normalizeOcrText(name);
        if (!target) return true;
        return text.indexOf(target) >= 0 || target.indexOf(text) >= 0;
    }

    // 点击切换按钮一次只会进入“将所选角色切换为出战角色”确认状态，
    // 确认条存在时再次点击同一位置才会真正切人；
    // 确认条不存在时 (1820,958) 可能是元素爆发按钮，绝不能再点。
    async function isSwitchConfirmMode() {
        const text = normalizeOcrText(await ocrTextAt(700, 505, 520, 70));
        return text.indexOf("切换为出战") >= 0 ||
            (text.indexOf("所选角色") >= 0 && text.indexOf("出战") >= 0);
    }

    async function switchCard(index, game) {
        const point = USER_CARD_X[index];
        if (point === undefined) return false;
        const card = game && game.user ? game.user[index] : null;
        if (card && !Game.expectAlive(card)) return false;
        // 三人存活时血条位置固定，可以精确校验出战位；有人倒下后布局可能变化，不做硬判定。
        const canReadActive = !!game && game.user.length === 3 && game.userAliveCount() === 3;
        click(RESET_X, RESET_Y);
        await pause(400);
        // 上次操作残留的确认状态必须先取消，否则后面的按钮点击会确认错误的角色。
        if (await isSwitchConfirmMode()) {
            click(RESET_X, RESET_Y);
            await pause(500);
            if (await isSwitchConfirmMode()) {
                log.warn("切换确认状态无法取消，放弃本次切换");
                return false;
            }
        }
        // 目标已经是出战角色时，点击角色牌只会打开技能面板，
        // 随后点 (1820,958) 会变成元素爆发，因此这里必须直接返回。
        if (canReadActive && (await isUserCardActive(index)) === true) {
            syncActiveUser(index, game);
            return true;
        }
        // 切换原本要 1 个骰子，但「换班时间」等效果可能把费用减到 0，这里必须按减费后的价格判断。
        const switchCost = game ? effectiveSwitchCost(game) : 1;
        if (game && sumDice(game.dice) + 1e-9 < switchCost) {
            log.warn("元素骰子不足（切换需要 " + switchCost + " 个），取消本次切换");
            return false;
        }
        click(point, USER_CARD_CLICK_Y);
        await pause(800);
        const name = card && card.name && card.name !== "未知" ? card.name : "";
        if (!(await isUserCardPanelOpen(name))) {
            await pause(400);
            if (!(await isUserCardPanelOpen(name))) {
                log.warn("切换角色失败：未打开角色详情面板（" + (name || index) + "）");
                click(RESET_X, RESET_Y);
                await pause(300);
                return false;
            }
        }
        click(1820, 958);
        await pause(800);
        if (!(await isSwitchConfirmMode())) {
            // 个别情况下第一下就会直接切人，不再出现确认条。
            if (canReadActive && (await isUserCardActive(index)) === true) {
                syncActiveUser(index, game);
                return true;
            }
            log.warn("切换角色失败：未进入切换确认状态（" + (name || index) + "）");
            click(RESET_X, RESET_Y);
            await pause(300);
            return false;
        }
        // 确认状态下再点一次才会切人；确认条消失说明已经完成。
        for (let i = 0; i < 2; i++) {
            click(1820, 958);
            await pause(900);
            if (!(await isSwitchConfirmMode())) break;
        }
        await pause(700);
        let activeNow = null;
        if (canReadActive) {
            activeNow = await isUserCardActive(index);
            if (activeNow === false) {
                // 切人动画期间血条位置会移动，稍等再确认一次。
                await pause(600);
                activeNow = await isUserCardActive(index);
            }
        }
        moveMouseTo(RESET_X, RESET_Y);
        await pause(200);
        if (!canReadActive) {
            // 血条布局不可判定时，以确认条消失作为切换完成的依据。
            syncActiveUser(index, game);
            return true;
        }
        if (activeNow === true) {
            syncActiveUser(index, game);
            return true;
        }
        // 仍在确认状态时，点击空场取消，避免残留状态被下一次技能点击误触。
        click(RESET_X, RESET_Y);
        await pause(300);
        log.warn("切换角色未生效: " + (name || index) +
            (activeNow === null ? "（血条识别失败）" : ""));
        return false;
    }

    // 按可烧价值排序的调和候选；手牌未识别时按位置从左到右全部尝试。
    function tuneCandidates(game) {
        const handCount = Math.max(0, num(game.handCount));
        if (handCount <= 0) return [];
        const cards = game.handCards || [];
        if (!cards.length || cards.length !== handCount) {
            const indexes = [];
            for (let i = 0; i < Math.min(10, handCount); i++) indexes.push(i);
            return indexes;
        }
        refreshHandValues(game);
        return cards
            .filter(function (card) {
                const value = card.known ? card.value : 1.5;
                return value < TUNE_MIN_CARD_VALUE;
            })
            .sort(function (a, b) {
                return (a.known ? a.value : 1.5) - (b.known ? b.value : 1.5);
            })
            .map(function (card) { return card.index; });
    }

    // 长按手牌选中后拖到右侧骰子区；单击再拖拽容易因手牌抬起而抓空。
    async function tuneOneCard(game, cardIndex, active) {
        click(RESET_X, RESET_Y);
        await pause(300);
        click(960, 1030);
        await pause(1400);
        const total = Math.max(1, Math.min(10, game.handCount));
        const row = HAND_POSITIONS[total];
        const point = row ? row[cardIndex + 1] : null;
        if (!point) {
            click(RESET_X, RESET_Y);
            await pause(300);
            return false;
        }
        const tuneCard = (game.handCards || []).find(function (card) {
            return card.index === cardIndex;
        }) || null;
        const tuneValue = tuneCard && tuneCard.known ? cardUtility(tuneCard, game) : 1.5;
        debugLog("调和烧牌: " + (tuneCard && tuneCard.known
            ? tuneCard.name + " 价值=" + tuneValue.toFixed(2)
            : "未知牌（第 " + (cardIndex + 1) + " 张）"));
        moveMouseTo(point[0], TUNE_HAND_Y);
        await pause(200);
        // 出牌是先单击选牌再拖动；调和也用同样顺序，直接拖未选中的牌游戏不认。
        click(point[0], TUNE_HAND_Y);
        await pause(650);
        await mouseDrag(point[0], TUNE_HAND_Y, TUNE_DROP_X, TUNE_DROP_Y, {
            holdMs: 450,
            moveMs: 800,
            settleMs: 550,
        });
        await pause(1300);
        let confirmed = false;
        for (let attempt = 0; attempt < 3 && !confirmed; attempt++) {
            confirmed = await clickTuningConfirm();
            if (!confirmed) await pause(500);
        }
        if (!confirmed) {
            log.warn("元素调和未出现确认按钮: 第 " + (cardIndex + 1) + " 张手牌");
            // 对局结束时拖拽不会弹出确认条，先排除结算界面再当成操作失败，
            // 否则会连续试完 3 张牌、在失败结算界面上空耗半分钟。
            const finish = await isUiFinish();
            if (finish !== "none") {
                game.finished = finish;
                log.warn("元素调和中止：对局已" + (finish === "win" ? "胜利" : "失败"));
                return false;
            }
            saveDebugScreenshot("tune_fail");
            click(RESET_X, RESET_Y);
            await pause(500);
            return false;
        }
        const beforeDice = sumDice(game.dice);
        await pause(900);
        click(RESET_X, RESET_Y);
        await pause(400);
        game.handCount = Math.max(0, game.handCount - 1);
        // 调和得到的骰子以实际画面为准；本地盲目 +1 会和真实骰子数不一致，
        // 后续就可能拿着不够的骰子去放技能。
        let dice = await getDiceMsg();
        let diceTotal = dice ? sumDice(dice) : 0;
        for (let attempt = 0; attempt < 2 && diceTotal <= beforeDice; attempt++) {
            // 新骰子有飞入动画，识别也可能被切换动画挡住，多等两拍再重试。
            await pause(700);
            const retry = await getDiceMsg();
            const retryTotal = retry ? sumDice(retry) : 0;
            if (retryTotal > diceTotal) {
                dice = retry;
                diceTotal = retryTotal;
            }
        }
        if (diceTotal > 0) {
            game.dice = dice;
        }
        if (tuneCard) {
            game.handCards = game.handCards.filter(function (card) { return card !== tuneCard; });
            game.handCards.forEach(function (card, index) { card.index = index; });
        } else {
            game.handCards = [];
            game.handKnown = false;
        }
        debugLog("元素调和完成，剩余手牌: " + game.handCount + "，骰子=" + (diceTotal > 0 ? diceTotal : "未识别"));
        // 确认按钮已经点过，牌确实烧掉了；总数没涨多半是识别偏差（新骰子和旧骰子错位），
        // 以重新识别的结果为准即可，放技能前 diceCoversCost 还会再校验一次。
        if (diceTotal <= 0) {
            log.warn("元素调和后未能识别骰子，本回合不再调和");
            game.tuneBlocked = true;
            return false;
        }
        if (diceTotal <= beforeDice) {
            // 元素调和是把一颗骰子转成出战元素，总数不变是正常现象。
            debugLog("元素调和后骰子总数未变化（" + beforeDice + " -> " + diceTotal + "），按实际骰子继续");
        }
        return true;
    }

    async function elementalTuning(count, game) {
        const requested = Math.min(Math.max(0, num(count)), Math.max(0, game.handCount));
        let tuned = 0;
        for (let i = 0; i < requested; i++) {
            if (game.handCount <= 0) break;
            if (game.finished) return { ok: false, tuned: tuned };
            const active = game.getActiveUser();
            if (!active || !active.element) break;
            const candidates = tuneCandidates(game);
            if (!candidates.length) {
                log.info("停止元素调和：剩余手牌价值过高");
                game.tuneBlocked = true;
                return { ok: false, tuned: tuned };
            }
            let success = false;
            // 逐张尝试可以避开个别不可调和的牌；限制次数避免抓空时长时间卡在调和。
            const attempts = candidates.slice(0, 3);
            for (const cardIndex of attempts) {
                if (game.handCount <= 0) break;
                if (await tuneOneCard(game, cardIndex, active)) {
                    tuned += 1;
                    success = true;
                    break;
                }
                if (game.tuneBlocked) break;
                // 拖拽没弹出确认条有时是因为行动权已经交给对方，继续换下一张只会空点。
                if ((await getActingTurn()) !== "user") {
                    log.warn("元素调和中止：行动权已不在我方");
                    game.tuneBlocked = true;
                    return { ok: false, tuned: tuned };
                }
            }
            if (!success) {
                game.tuneBlocked = true;
                return { ok: false, tuned: tuned };
            }
        }
        return { ok: tuned >= requested, tuned: tuned };
    }

    // 出牌方式是把牌从手牌区拖到桌面，再点击下方按钮确认；
    // 普通行动牌是“打出手牌”，装备/圣遗物牌是“确认”，0 费牌拖出后会直接结算。
    // 不能用整块 OCR 结果的中心，必须逐行找到按钮文字本身再点击。
    function findTextLineInRegion(region, x, y, w, h, keywords) {
        const list = region.FindMulti(RecognitionObject.Ocr(x, y, w, h));
        const count = list ? (typeof list.count === "number" ? list.count : (list.length || 0)) : 0;
        for (let i = 0; i < count; i++) {
            const item = list[i];
            const text = normalizeOcrText(item.text || item.Text || "");
            for (const keyword of keywords) {
                if (text.indexOf(keyword) >= 0) {
                    return {
                        x: Math.round(item.x + item.width / 2),
                        y: Math.round(item.y + item.height / 2),
                        text: text,
                    };
                }
            }
        }
        return null;
    }

    async function clickPlayCardConfirm() {
        let region = null;
        try {
            region = captureGameRegion();
            // 装备/圣遗物选完角色后的“确定”按钮用模板匹配优先命中，OCR 只作兜底。
            const mat = getMat("equipConfirm");
            if (mat) {
                const ro = RecognitionObject.TemplateMatch(mat, 300, 700, 1320, 380);
                ro.threshold = 0.8;
                ro.MaxMatchCount = 1;
                const list = region.FindMulti(ro);
                const count = list ? (typeof list.count === "number" ? list.count : (list.length || 0)) : 0;
                if (count > 0) {
                    const item = list[0];
                    click(Math.round(item.x + item.width / 2), Math.round(item.y + item.height / 2));
                    return true;
                }
            }
            const found = findTextLineInRegion(region, 300, 740, 1600, 330,
                ["打出手牌", "确认", "确定"]);
            if (found) {
                click(found.x, found.y);
                return true;
            }
        } catch (e) {
            debugLog("出牌确认按钮识别失败: " + e);
        } finally {
            if (region) region.dispose();
        }
        return false;
    }

    // 装备牌会进入“请选择要装备圣遗物的角色”界面，点桌面无法取消，只能点右上角 X。
    async function isCardTargetPickMode() {
        const text = normalizeOcrText(await ocrTextAt(520, 510, 880, 60));
        return text.indexOf("请选择") >= 0 && text.indexOf("角色") >= 0;
    }

    // 确认按钮出现的时机受动画影响，轮询几次再放弃。
    async function confirmPlayCardWithRetry() {
        for (let attempt = 0; attempt < 4; attempt++) {
            if (await clickPlayCardConfirm()) return true;
            await pause(450);
        }
        return false;
    }

    // 支援区已满时拖出支援牌，会先弹出“需先选择一张支援牌弃置”的界面。
    async function supportFullPromptVisible() {
        const text = normalizeOcrText(await ocrTextAt(600, 505, 760, 70));
        return text.indexOf("支援区已满") >= 0;
    }

    async function chooseSupportReplacement(action, game) {
        const slot = num(action.replace_support_slot);
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await pause(500);
            if (!(await supportFullPromptVisible())) continue;
            log.info("支援区已满，弃置较差的支援牌: " + (action.replace_support_name || "未知") +
                "（槽位 " + (slot + 1) + "）");
            const cfgSlot = ZONES.userSupports.slots[slot];
            if (!cfgSlot) return false;
            click(cfgSlot.x + Math.round(cfgSlot.w / 2), cfgSlot.y + Math.round(cfgSlot.h / 2) + 12);
            await pause(800);
            let region = null;
            let confirm = null;
            try {
                region = captureGameRegion();
                confirm = findTextLineInRegion(region, 760, 890, 400, 110, ["确定", "确认"]);
            } finally {
                if (region) region.dispose();
            }
            if (confirm) click(confirm.x, confirm.y);
            else click(960, 934);
            await pause(1000);
            // 支援区内容已变化，清掉缓存等下一轮重新识别。
            game.zones.user.supportTurn = -1;
            game.zones.user.supportSignature = "";
            game.zones.user.supportOccupied = [];
            return true;
        }
        return false;
    }

    async function playHandCard(action, game) {
        const card = (game.handCards || []).find(function (item) {
            return item.index === action.card_index;
        }) || null;
        if (!card) return false;
        const total = Math.max(1, Math.min(10, game.handCount));
        const row = HAND_POSITIONS[total];
        const point = row ? row[card.index + 1] : null;
        if (!point) return false;
        const before = game.handCount;
        click(RESET_X, RESET_Y);
        await pause(350);
        click(960, 1030);
        await pause(1400);
        click(point[0], TUNE_HAND_Y);
        await pause(650);
        // 桌面中央的空场区域，避开双方角色牌，事件/支援牌拖到这里即可。
        await mouseDrag(point[0], TUNE_HAND_Y, 960, 505);
        await pause(1300);
        if (findTemplateOnScreen("diceLack", 960, 0, 960, 1080, 0.8).length > 0) {
            log.warn("元素骰子不足，无法打出 " + card.name);
            click(RESET_X, RESET_Y);
            await pause(500);
            return false;
        }
        let targetIndex = game.getActiveUserIndex();
        // 支援区已满的替换界面要先弃置一张支援牌，再点底部“确定”。
        let supportReplaced = false;
        if (num(action.card_replace_support)) {
            supportReplaced = await chooseSupportReplacement(action, game);
            if (!supportReplaced && await supportFullPromptVisible()) {
                log.warn("支援区替换界面未能完成，取消本次出牌");
                click(1875, 45);
                await pause(600);
                click(RESET_X, RESET_Y);
                await pause(500);
                return false;
            }
        }
        if (action.card_needs_target && !supportReplaced) {
            const equipTarget = num(action.equip_target_index);
            if (action.equip_slot && equipTarget >= 0) targetIndex = equipTarget;
            const targetX = USER_CARD_X[targetIndex >= 0 ? targetIndex : 0];
            click(targetX, USER_CARD_CLICK_Y);
            await pause(900);
        }
        const used = supportReplaced ? true : await confirmPlayCardWithRetry();
        if (used) {
            await pause(900);
        } else if (await isCardTargetPickMode()) {
            // 没点到“确定”时界面还停在选角色，点右上角 X 退出，避免卡住后续操作。
            log.warn("装备目标选择未确认，取消本次出牌");
            click(1875, 45);
            await pause(700);
        }
        click(RESET_X, RESET_Y);
        await pause(700);
        const after = await countHandCards();
        const changed = after < 0 ? true : after !== before;
        // 手牌打空时数字识别拿不到 0，本地至少要把已确认打出的这张扣掉，
        // 否则会一直保留旧手牌数并在空手牌状态下反复识别。
        if (after >= 0) game.handCount = after;
        else if (used) game.handCount = Math.max(0, before - 1);
        if (changed && action.equip_slot && targetIndex >= 0 && game.user[targetIndex]) {
            const char = game.user[targetIndex];
            game.equipSlots[char.name] = game.equipSlots[char.name] || {};
            game.equipSlots[char.name][action.equip_slot] = card.name;
            debugLog("装备记录: " + char.name + " 的" + action.equip_slot + " -> " + card.name);
        }
        debugLog("出牌校验: " + card.name + " 手牌 " + before + " -> " + (after >= 0 ? after : "?") +
            (used ? "（已点击确认按钮）" : ""));
        return changed;
    }

    async function clickTuningConfirm() {
        let region = null;
        try {
            region = captureGameRegion();
            const mat = getMat("tuningConfirm");
            if (mat) {
                // 按钮可能跟着拖拽落点出现在右侧骰子区，不能只搜下半屏。
                const ro = RecognitionObject.TemplateMatch(mat, 0, 0, 1920, 1080);
                ro.threshold = 0.8;
                ro.MaxMatchCount = 1;
                const list = region.FindMulti(ro);
                const count = list ? (typeof list.count === "number" ? list.count : (list.length || 0)) : 0;
                if (count > 0) {
                    const item = list[0];
                    click(Math.round(item.x + item.width / 2), Math.round(item.y + item.height / 2));
                    return true;
                }
            }
            const bands = [
                { x: 1300, y: 200, w: 620, h: 880 },
                { x: 400, y: 850, w: 1120, h: 230 },
                { x: 300, y: 700, w: 1320, h: 380 },
            ];
            for (const band of bands) {
                const found = findTextLineInRegion(region, band.x, band.y, band.w, band.h,
                    ["元素调和", "调和"]);
                // 结算界面的建议文案“进行元素调和…”也含关键词，不能当成确认按钮。
                if (found && found.text.indexOf("进行元素调和") < 0) {
                    click(found.x, found.y);
                    return true;
                }
            }
            return false;
        } catch (e) {
            debugLog("调和确认按钮识别失败: " + e);
            return false;
        } finally {
            if (region) region.dispose();
        }
    }

    // ==================== 识别牌桌 ====================
    function recordHp(card, hp, active) {
        card.hp = hp;
        card.active = active;
        card.hpRead = active ? "active" : "standby";
        // 卡牌库里的生命值是基础值，BOSS/特殊模式实测血量可能更高（如 25/7）。
        // 连续两次读到同一个超上限值才修正，避免单次 OCR 误读把上限永久抬高。
        if (hp > num(card.maxHp)) {
            if (card.maxHpPending === hp) {
                card.maxHp = hp;
                card.maxHpPending = 0;
                debugLog("血量上限修正: " + card.name + " " + hp);
            } else {
                card.maxHpPending = hp;
            }
        } else {
            card.maxHpPending = 0;
        }
    }

    function hpInfoForCard(region, side, serial, total, card) {
        const key = side + total + serial;
        const area = HP_AREA[key];
        if (!area) return;
        const activeY = side === "enemy" ? area[2] : area[1];
        const standbyY = side === "enemy" ? area[1] : area[2];
        // 先查后台位：出战角色的血条会向上偏移约 40px，后台位读到数字就说明不是出战。
        // 反过来先查出战位时，后台血条顶部的数字会被识别框截到一部分，
        // 导致后台角色也被判成出战，最后 ensureActiveFlags 取到错误角色。
        const standbyHp = ocrIntInRegion(region, area[0], standbyY, HP_AREA.size[0], HP_AREA.size[1]);
        if (standbyHp !== null) {
            recordHp(card, standbyHp, false);
            return;
        }
        const activeHp = ocrIntInRegion(region, area[0], activeY, HP_AREA.size[0], HP_AREA.size[1]);
        if (activeHp !== null) {
            recordHp(card, activeHp, true);
            return;
        }
        card.hpRead = "";
        debugLog("HP " + key + ": 两个位置都未识别到数字");
        if (templateExists(region, "disable", STATE_AREA[key][0], STATE_AREA[key][1],
            STATE_AREA.size[0], STATE_AREA.size[1], 0.8)) {
            card.hp = 0;
            card.active = false;
        }
    }

    // 出战角色血条 OCR 偶尔会失败，但此时另外两张牌通常都能在后台位读到数字。
    // 若恰好只缺一张，用排除法确定出战角色（与 BetterGI 的兜底逻辑一致）。
    function applyHpActiveFlags(list) {
        const alive = list.filter(Game.expectAlive);
        if (!alive.length) return;
        const freshActive = alive.filter(function (card) { return card.hpRead === "active"; });
        const freshStandby = alive.filter(function (card) { return card.hpRead === "standby"; });
        let chosen = null;
        if (freshActive.length > 0) {
            chosen = freshActive[0];
        } else if (freshStandby.length === alive.length - 1) {
            chosen = alive.find(function (card) { return card.hpRead !== "standby"; }) || null;
        }
        if (!chosen) return;
        for (const card of list) card.active = card === chosen;
    }

    function chargeInfoForCard(region, side, serial, total, card) {
        const key = side + total + serial;
        const area = CHARGE_AREA[key];
        if (!area) return;
        const filled = findTemplateInRegion(
            region, "charge", area[0], area[1], CHARGE_AREA.size[0], CHARGE_AREA.size[1], 0.7
        ).length;
        const empty = findTemplateInRegion(
            region, "uncharge", area[0], area[1], CHARGE_AREA.size[0], CHARGE_AREA.size[1], 0.7
        ).length;
        card.chargeFilled = filled;
        card.chargeEmpty = empty;
    }

    function updateAttachedFromStates(card) {
        const states = card.states || [];
        let attached = "";
        for (const element of ATTACHABLE_ELEMENTS) {
            if (states.indexOf(element) >= 0) {
                attached = element;
                break;
            }
        }
        // 冻结角色按冰元素附着处理：火元素攻击可触发融化 +2，这是最常用的破冻收益。
        if (!attached && states.indexOf("Freeze") >= 0) attached = "Cryo";
        card.attached = attached;
    }

    function stateInfoForCard(region, side, serial, total, card) {
        const key = side + total + serial;
        const area = STATE_AREA[key];
        if (!area) return;
        const states = [];
        const stateKeys = ["Pyro", "Hydro", "Electro", "Dendro", "Cryo", "Freeze"];
        for (const element of stateKeys) {
            if (templateExists(region, "State" + element, area[0], area[1],
                STATE_AREA.size[0], STATE_AREA.size[1], 0.8)) {
                states.push(element);
            }
        }
        card.states = states;
        updateAttachedFromStates(card);
    }

    // ==================== 角色详情面板状态 ====================
    // 点击角色牌会在左侧面板下段列出「角色状态」和「阵营出战状态」，图标模板只有 6 张，
    // 眩晕/石化这类异常状态和护盾类状态只能从这里读。坐标实测自 logs/live_16_17.png：
    // 面板宽 x60~420，两栏标题分别在 y≈490 与 y≈630，但标题位置会随上方技能描述的高度浮动，
    // 所以整块读一次 OCR，再按标题行分段，而不是写死两个矩形。
    const STATE_PANEL_AREA = { x: 60, y: 250, w: 370, h: 550 };
    const PANEL_STATE_KEYS = { "冻结": "Freeze", "眩晕": "Stun", "石化": "Petrify", "束缚": "Bind" };
    const PANEL_ELEMENT_KEYS = { "火": "Pyro", "水": "Hydro", "雷": "Electro", "草": "Dendro", "冰": "Cryo", "风": "Anemo", "岩": "Geo" };

    function ocrLinesInRegion(region, x, y, w, h) {
        const list = region.FindMulti(RecognitionObject.Ocr(x, y, w, h));
        const count = list ? (typeof list.count === "number" ? list.count : (list.length || 0)) : 0;
        const lines = [];
        for (let i = 0; i < count; i++) {
            const item = list[i];
            const text = normalizeOcrText(item.text || item.Text || "");
            if (!text) continue;
            lines.push({ text: text, y: Math.round(item.y) });
        }
        lines.sort(function (a, b) { return a.y - b.y; });
        return lines;
    }

    function panelStateKey(name) {
        for (const zh of Object.keys(PANEL_STATE_KEYS)) {
            if (name.indexOf(zh) >= 0) return PANEL_STATE_KEYS[zh];
        }
        for (const zh of Object.keys(PANEL_ELEMENT_KEYS)) {
            if (name.indexOf(zh + "元素") >= 0) return PANEL_ELEMENT_KEYS[zh];
        }
        return "";
    }

    // 标题行之前的行属于技能描述，直接丢掉；纯数字行算作上一条状态的剩余次数。
    function parsePanelStateLines(lines) {
        const entries = [];
        let section = "";
        for (const line of lines) {
            const text = line.text;
            if (text.length <= 8 && text.indexOf("出战状态") >= 0) {
                section = "faction";
                continue;
            }
            if (text.length <= 8 && text.indexOf("角色状态") >= 0) {
                section = "role";
                continue;
            }
            if (!section) continue;
            if (/^\d+$/.test(text)) {
                const last = entries[entries.length - 1];
                if (last && last.section === section && last.count === null) last.count = num(text);
                continue;
            }
            const matched = text.match(/[\u4e00-\u9fff]{2,8}/);
            if (!matched) continue;
            entries.push({ section: section, name: matched[0], count: null });
        }
        return entries;
    }

    function mergePanelStates(card, game) {
        const panel = card.panelStates || [];
        if (!panel.length || card.panelStateTurn !== game.turn) return;
        const states = card.states || [];
        for (const state of panel) {
            if (states.indexOf(state) < 0) states.push(state);
        }
        card.states = states;
        updateAttachedFromStates(card);
    }

    async function readCharacterStatePanel(side, index, game) {
        const list = side === "user" ? game.user : game.enemy;
        const card = list ? list[index] : null;
        if (!card || !Game.expectAlive(card)) return false;
        const x = side === "user" ? USER_CARD_X[index] : (ENEMY_CARD_X[list.length] || [])[index];
        if (x === undefined) return false;
        const y = side === "user" ? USER_CARD_CLICK_Y : ENEMY_CARD_CLICK_Y;
        click(RESET_X, RESET_Y);
        await pause(240);
        click(x, y);
        await pause(520);
        let lines = [];
        let region = null;
        try {
            region = captureGameRegion();
            lines = ocrLinesInRegion(region, STATE_PANEL_AREA.x, STATE_PANEL_AREA.y,
                STATE_PANEL_AREA.w, STATE_PANEL_AREA.h);
        } catch (e) {
            debugLog("角色状态 OCR 失败: " + e);
        } finally {
            if (region) region.dispose();
        }
        click(RESET_X, RESET_Y);
        await pause(260);
        const entries = parsePanelStateLines(lines);
        if (!entries.length && !lines.some(function (line) {
            return line.text.indexOf("状态") >= 0;
        })) {
            // 连“角色状态/阵营出战状态”两个标题都没读到，多半是面板没打开，别把这次结果当“无状态”。
            debugLog("角色状态面板未读到: " + side + "#" + (index + 1) + " " + (card.name || "?"));
            card.panelStateFailTurn = game.turn;
            return false;
        }
        const states = [];
        for (const entry of entries) {
            if (entry.section !== "role") continue;
            const key = panelStateKey(entry.name);
            if (key && states.indexOf(key) < 0) states.push(key);
        }
        card.panelStates = states;
        card.panelEntries = entries;
        card.panelStateTurn = game.turn;
        // 决策紧接着就要用（是否该把眩晕的角色换下去），不能等下一次读盘才并进去。
        mergePanelStates(card, game);
        debugLog("角色状态面板(" + side + "#" + (index + 1) + " " + card.name + "): " +
            (entries.length ? entries.map(function (entry) {
                return (entry.section === "role" ? "角色:" : "出战:") + entry.name +
                    (entry.count === null ? "" : "x" + entry.count);
            }).join(" ") : "无"));
        return true;
    }

    // 每回合只点开双方出战角色各一次：面板是眩晕/石化这类状态的唯一来源，
    // 但每次都要点角色牌 + 整块 OCR，代价不小，所以只读真正影响决策的两个角色。
    async function scanCharacterStates(game) {
        if (!CFG.characterStateScan) return;
        const targets = [
            ["user", game.getActiveUserIndex()],
            ["enemy", game.getActiveEnemyIndex()],
        ];
        for (const target of targets) {
            const side = target[0];
            const index = target[1];
            const list = side === "user" ? game.user : game.enemy;
            const card = index >= 0 && list && list.length > index ? list[index] : null;
            if (!card || card.panelStateTurn === game.turn || card.panelStateFailTurn === game.turn) continue;
            try {
                await readCharacterStatePanel(side, index, game);
            } catch (e) {
                debugLog("角色状态读取失败: " + side + " " + e);
            }
        }
    }

    function readBoardStats(region, game) {
        for (let i = 0; i < game.user.length; i++) {
            const card = game.user[i];
            const hpBefore = num(card.hp);
            hpInfoForCard(region, "user", i + 1, 3, card);
            if (hpBefore > 0 && num(card.hp) === 0) game.defeatTurn = game.turn;
        }
        for (let i = 0; i < game.enemy.length; i++) {
            hpInfoForCard(region, "enemy", i + 1, game.enemy.length, game.enemy[i]);
        }
        applyHpActiveFlags(game.user);
        applyHpActiveFlags(game.enemy);
        game.ensureActiveFlags(game.user);
        game.ensureActiveFlags(game.enemy);

        // 后排角色的充能和冻结状态同样影响切人决策：爆发是否就绪、切过去能否行动。
        for (let i = 0; i < game.user.length; i++) {
            if (!CHARGE_AREA["user3" + (i + 1)]) continue;
            chargeInfoForCard(region, "user", i + 1, 3, game.user[i]);
            stateInfoForCard(region, "user", i + 1, 3, game.user[i]);
            mergePanelStates(game.user[i], game);
        }
        const enemyActiveIndex = game.getActiveEnemyIndex();
        if (enemyActiveIndex >= 0) {
            const card = game.enemy[enemyActiveIndex];
            chargeInfoForCard(region, "enemy", enemyActiveIndex + 1, game.enemy.length, card);
            stateInfoForCard(region, "enemy", enemyActiveIndex + 1, game.enemy.length, card);
            mergePanelStates(card, game);
        }
    }

    async function detectEnemyCount() {
        const probes = [
            { x: 1275, count: 4 },
            { x: 1200, count: 3 },
            { x: 1061, count: 2 },
        ];
        for (const probe of probes) {
            click(probe.x, ENEMY_CARD_CLICK_Y);
            await pause(450);
            const name = await ocrCardName();
            click(RESET_X, RESET_Y);
            await pause(300);
            if (name) return probe.count;
        }
        return 1;
    }

    async function readUserNames(game) {
        const cards = [];
        for (let i = 0; i < USER_CARD_X.length; i++) {
            let rawName = "";
            for (let attempt = 0; attempt < 2 && !rawName; attempt++) {
                click(USER_CARD_X[i], USER_CARD_CLICK_Y);
                await pause(450);
                rawName = await ocrCardName();
                if (!rawName) await pause(250);
            }
            click(RESET_X, RESET_Y);
            await pause(280);
            const card = createCardFromOcr(rawName);
            card.hp = 10;
            cards.push(card);
            debugLog("我方角色" + (i + 1) + ": " + (rawName || "?") + " -> " + card.name);
        }
        game.user = cards;
        game.userLoaded = true;
        game.ensureActiveFlags(game.user);
    }

    async function readEnemyNames(game) {
        const count = await detectEnemyCount();
        const positions = ENEMY_CARD_X[count] || ENEMY_CARD_X[3];
        const cards = [];
        for (let i = 0; i < positions.length; i++) {
            let rawName = "";
            for (let attempt = 0; attempt < 2 && !rawName; attempt++) {
                click(positions[i], ENEMY_CARD_CLICK_Y);
                await pause(450);
                rawName = await ocrCardName();
                if (!rawName) await pause(250);
            }
            click(RESET_X, RESET_Y);
            await pause(280);
            const card = createCardFromOcr(rawName);
            card.hp = null;
            cards.push(card);
            debugLog("敌方角色" + (i + 1) + ": " + (rawName || "?") + " -> " + card.name);
        }
        game.enemy = cards;
        game.enemyCount = count;
        game.enemyLoaded = true;
        game.ensureActiveFlags(game.enemy);
    }

    // ==================== 放弃对局 ====================
    // 右上角设置菜单按钮：挑战目标 / 查看规则书 / 设置 / 放弃对局（第四行）。
    const SURRENDER_MENU = { x: 1430, y: 20, w: 400, h: 290 };
    const SURRENDER_TITLE = { x: 700, y: 270, w: 520, h: 70 };
    // 确认弹窗底部按钮带：左侧“取消”，右侧“确认”；弹窗正文也含“确定”，但不在这个带内。
    const SURRENDER_BUTTONS = { x: 940, y: 720, w: 380, h: 80 };
    const SURRENDER_CONFIRM_FALLBACK = [1164, 757];

    async function surrenderDuel() {
        const gear = findTemplateOnScreen("setting", 1834, 15, 66, 66, 0.8);
        if (!gear.length) {
            log.warn("未找到右上角设置按钮，无法放弃对局");
            return false;
        }
        click(Math.round(gear[0].x + gear[0].width / 2), Math.round(gear[0].y + gear[0].height / 2));
        await pause(700);

        let region = null;
        let entry = null;
        try {
            region = captureGameRegion();
            entry = findTextLineInRegion(region, SURRENDER_MENU.x, SURRENDER_MENU.y,
                SURRENDER_MENU.w, SURRENDER_MENU.h, ["放弃对局"]);
        } finally {
            if (region) region.dispose();
        }
        if (!entry) {
            log.warn("设置菜单里没有识别到“放弃对局”，关闭菜单");
            click(RESET_X, RESET_Y);
            await pause(500);
            return false;
        }
        click(entry.x, entry.y);
        await pause(900);

        const title = normalizeOcrText(await ocrTextAt(
            SURRENDER_TITLE.x, SURRENDER_TITLE.y, SURRENDER_TITLE.w, SURRENDER_TITLE.h
        ));
        if (title.indexOf("放弃对局") < 0) {
            log.warn("放弃对局确认弹窗未出现（识别到: " + (title || "空") + "），取消操作");
            click(RESET_X, RESET_Y);
            await pause(500);
            return false;
        }

        let confirm = null;
        try {
            region = captureGameRegion();
            confirm = findTextLineInRegion(region, SURRENDER_BUTTONS.x, SURRENDER_BUTTONS.y,
                SURRENDER_BUTTONS.w, SURRENDER_BUTTONS.h, ["确认", "确定"]);
        } finally {
            if (region) region.dispose();
        }
        if (confirm) {
            click(confirm.x, confirm.y);
        } else {
            click(SURRENDER_CONFIRM_FALLBACK[0], SURRENDER_CONFIRM_FALLBACK[1]);
        }
        await pause(1200);
        return true;
    }

    // ==================== 策略 ====================
    class Strategy {
        constructor() {
            this.game = new Game();
            this.model = null;
            this.logger = new DuelLogger();
            this.needHandCount = true;
            this.needBoardRefresh = true;
            this.noneCount = 0;
            this.actionFailures = 0;
            this.lastSwitchTarget = -1;
            this.switchRepeats = 0;
            this.surrenderTried = false;
            this.surrenderDone = false;
            this.endTurnFailures = 0;
        }

        // 只有明显打不赢时才放弃；识别抖动时至少落后一个人头或血量差 35% 以上。
        shouldSurrender(winRate) {
            if (this.surrenderTried || this.surrenderDone || this.game.finished) return false;
            if (this.game.turn < 2 || !this.game.userLoaded || !this.game.enemyLoaded) return false;
            if (winRate * 100 > surrenderThresholdValue()) return false;
            const myAlive = this.game.userAliveCount();
            const enemyAlive = this.game.enemyAliveCount();
            if (myAlive <= 0 || enemyAlive <= 0) return false;
            return enemyAlive > myAlive || this.game.enemyHpRatio() - this.game.userHpRatio() >= 0.35;
        }

        async waitStartingHand() {
            log.info("检测到初始手牌界面");
            await pause(500);
            click(960, 948);
            await pause(250);
            click(960, 948);
            await pause(800);
            this.game.handCount = 5;
            this.needHandCount = true;
        }

        async waitChoice() {
            log.info("检测到出战角色选择界面");
            await pause(1200);
            if (!this.game.userLoaded) {
                await readUserNames(this.game);
                this.needHandCount = true;
            }
            const alive = this.game.user.filter(Game.expectAlive);
            let chosen = 0;
            if (alive.length) chosen = this.game.user.indexOf(alive[0]);
            click(USER_CARD_X[chosen], USER_CARD_CLICK_Y);
            await pause(500);
            click(1826, 960);
            await pause(300);
            click(1826, 960);
            await pause(1000);
            for (let i = 0; i < this.game.user.length; i++) {
                this.game.user[i].active = i === chosen;
            }
            this.needBoardRefresh = true;
        }

        async waitEndPhase() {
            if (!this.endPhaseSeen) {
                log.info("进入结束阶段，等待自动结算");
                this.endPhaseSeen = true;
            }
            // 结束阶段只会自动结算，点击一律无效，只能等状态栏切回行动阶段。
            await pause(900);
        }

        async waitReroll() {
            log.info("检测到重投骰子界面");
            if (!this.game.userLoaded || !this.game.enemyLoaded) {
                click(1872, 49);
                await pause(1200);
                await this.readFullBoard();
                click(1872, 49);
                await pause(1200);
            }
            const keep = ["Omni"];
            for (const card of this.game.user) {
                if (card.element && keep.indexOf(card.element) < 0) keep.push(card.element);
            }
            const dice = await getDiceMsg(keep);
            if (dice) this.game.dice = dice;
            await pause(600);
            click(968, 950);
            await pause(500);
            click(968, 950);
            await pause(1200);
            this.game.turn += 1;
            this.game.handCards = [];
            this.game.handKnown = false;
            this.game.cardsPlayedThisTurn = 0;
            this.game.tuneBlocked = false;
            clearTurnBuffs(this.game);
            this.needHandCount = true;
            this.needBoardRefresh = true;
            log.info("进入第 " + this.game.turn + " 回合");
        }

        async readFullBoard() {
            await readUserNames(this.game);
            await readEnemyNames(this.game);

            const region = captureGameRegion();
            try {
                readBoardStats(region, this.game);
            } finally {
                region.dispose();
            }
            this.game.ensureActiveFlags(this.game.user);
            this.game.ensureActiveFlags(this.game.enemy);
            this.needBoardRefresh = false;
            this.logger.start(CFG.useModel && this.model ? CFG.modelFile : "expert", this.game.user.map(function (card) {
                return card.name;
            }));
            this.logBoard();
        }

        async refreshBoardInfo(retry) {
            await pause(500);
            const region = captureGameRegion();
            try {
                readBoardStats(region, this.game);
            } finally {
                region.dispose();
            }
            const hadDeaths = this.game.enemy.some(function (card) { return card.hp === 0; });
            if (hadDeaths) {
                this.game.removeDeadEnemies();
                log.info("敌方有角色倒下，更新牌桌布局");
                if (this.game.enemy.length === 0) return;
                if (!retry) {
                    await pause(900);
                    await this.refreshBoardInfo(true);
                }
                return;
            }
            this.game.ensureActiveFlags(this.game.user);
            this.game.ensureActiveFlags(this.game.enemy);
            this.needBoardRefresh = false;
        }

        async refreshDice() {
            const dice = await getDiceMsg();
            if (dice) {
                this.game.dice = dice;
            }
        }

        async calibrateHand() {
            let count = await countHandCards();
            if (count < 0) {
                // 新回合刚开始时手牌还在滑入/抽牌动画中，数字模板匹配不到，稍后重试一次。
                await pause(800);
                count = await countHandCards();
            }
            if (count >= 0) {
                this.game.handCount = count;
                log.info("手牌数量: " + count);
            } else {
                debugLog("手牌数量识别失败，保留旧值: " + this.game.handCount);
            }
            this.needHandCount = false;
        }

        logBoard() {
            const user = this.game.user.map(function (card) {
                return card.name + "(" + (card.hp === null ? "?" : card.hp) + "/" + card.maxHp +
                    (card.active ? "*" : "") + formatCardStates(card) + ")";
            }).join(" ");
            const enemy = this.game.enemy.map(function (card) {
                return card.name + "(" + (card.hp === null ? "?" : card.hp) + "/" + card.maxHp +
                    (card.active ? "*" : "") + formatCardStates(card) + ")";
            }).join(" ");
            log.info("我方: " + user);
            log.info("敌方: " + enemy);
            const zones = this.game.zones;
            if (zones) {
                log.info("我方支援: " + formatZoneCards(zones.user.supports) +
                    " | 召唤物: " + formatZoneCards(zones.user.summons));
                log.info("敌方支援: " + formatZoneCards(zones.enemy.supports) +
                    " | 召唤物: " + formatZoneCards(zones.enemy.summons));
                const endTotals = endPhaseTotals(this.game);
                log.info("结束阶段结算: 我方伤害=" + endTotals.myDamage + " 治疗=" + endTotals.myHeal +
                    " | 敌方伤害=" + endTotals.enemyDamage + " 治疗=" + endTotals.enemyHeal);
            }
        }

        async executeAction(action) {
            if (!action) return;
            if (action.type !== "switch") {
                this.lastSwitchTarget = -1;
                this.switchRepeats = 0;
            }
            if (action.type === "end") {
                log.info("结束当前回合");
                if (await terminateTurn()) {
                    this.endTurnFailures = 0;
                } else {
                    this.endTurnFailures = (this.endTurnFailures || 0) + 1;
                    log.warn("结束回合未生效（连续 " + this.endTurnFailures + " 次），可能有详情面板或弹窗遮挡");
                    if (this.endTurnFailures === 3) {
                        saveDebugScreenshot("end_turn_blocked");
                    }
                }
                return;
            }
            if (action.type === "switch") {
                const switchIndex = num(action.switch_index);
                if (this.lastSwitchTarget === switchIndex) {
                    this.switchRepeats += 1;
                } else {
                    this.lastSwitchTarget = switchIndex;
                    this.switchRepeats = 1;
                }
                log.info("切换角色 -> " + (this.game.user[switchIndex] ? this.game.user[switchIndex].name : switchIndex));
                const switched = await switchCard(switchIndex, this.game);
                if (switched) {
                    // 这次切换用掉了“切换少花费”效果，后续切人恢复原价。
                    consumeNextSwitchCost(this.game);
                } else {
                    log.warn("切换角色失败，重新识别牌局");
                    this.needBoardRefresh = true;
                }
                // 出战识别失败时切换指令会反复出现，避免在同一角色上无限循环。
                if (this.switchRepeats >= 3) {
                    log.warn("切换角色连续 " + this.switchRepeats + " 次未生效，结束当前回合");
                    this.lastSwitchTarget = -1;
                    this.switchRepeats = 0;
                    await terminateTurn();
                }
                return;
            }
            if (action.type === "play_card") {
                log.info("打出手牌: " + action.card_name +
                    " (" + (action.card_ctype || "行动牌") + ")" +
                    " 费用=" + action.dice_cost +
                    " 价值=" + num(action.card_value).toFixed(2) +
                    (action.kills_target ? " [击杀]" : ""));
                const ok = await playHandCard(action, this.game);
                // 出牌可能抓牌或改变手牌位置，清空缓存后重新识别。
                this.game.handCards = [];
                this.game.handKnown = false;
                this.needHandCount = true;
                this.needBoardRefresh = true;
                if (ok) {
                    this.game.cardPlayFailures = 0;
                    this.game.cardsPlayedThisTurn += 1;
                    delete this.game.cardFailures[action.card_name];
                    // 这张牌用掉了本回合的出牌减费；先清旧减费，再记录它自己带来的新效果。
                    consumeNextCardCost(this.game);
                    if (num(action.card_has_damage)) consumeNextDamage(this.game);
                    if (num(action.card_is_equipment)) {
                        const equipIndex = num(action.equip_target_index) >= 0
                            ? num(action.equip_target_index) : this.game.getActiveUserIndex();
                        const equipChar = this.game.user[equipIndex];
                        if (equipChar) {
                            applyEffectBuffs(this.game, action.card_effect, "permanent", equipChar.name,
                                action.equip_slot || ("card:" + action.card_name));
                        }
                    } else if (num(action.card_is_support)) {
                        applyEffectBuffs(this.game, action.card_effect, "permanent");
                    } else {
                        applyEffectBuffs(this.game, action.card_effect, "turn");
                    }
                } else {
                    this.game.cardPlayFailures += 1;
                    this.game.cardFailures[action.card_name] = num(this.game.cardFailures[action.card_name]) + 1;
                    log.warn("出牌失败: " + action.card_name);
                    if (this.game.cardPlayFailures >= 4) {
                        this.game.cardPlaySupported = false;
                        log.warn("多次出牌失败，本局不再尝试打出行动牌");
                    }
                }
                return;
            }
            if (["normal", "skill", "burst"].indexOf(action.type) >= 0) {
                if (action.type === "burst" &&
                    num(action.skill_energy_cost) > num((this.game.getActiveUser() || {}).chargeFilled)) {
                    log.warn("充能不足，取消本次元素爆发");
                    this.needBoardRefresh = true;
                    return;
                }
                if (action.tune > 0) {
                    // 上一步可能是“战斗行动”牌，行动权已经交给对方；这时再调和只会空点。
                    if ((await getActingTurn()) !== "user") {
                        log.warn("行动权已不在我方，取消本次技能");
                        this.needBoardRefresh = true;
                        return;
                    }
                    log.info("元素调和 " + action.tune + " 张手牌");
                    const result = await elementalTuning(action.tune, this.game);
                    if (!result.ok) {
                        log.warn("元素调和失败，放弃本次技能并重新识别牌局");
                        this.needBoardRefresh = true;
                        this.needHandCount = true;
                        this.actionFailures += 1;
                        if (this.actionFailures >= 3) {
                            log.warn("连续多次操作失败，结束当前回合");
                            this.actionFailures = 0;
                            await terminateTurn();
                        }
                        return;
                    }
                }
                log.info("使用技能: " + action.skill_name + " (" + action.skill_type + ")" +
                    " 预计伤害=" + action.expected_damage +
                    " 反应加成=" + action.reaction_bonus +
                    (action.kills_target ? " [击杀]" : ""));
                if (!(await useSkill(action, this.game))) {
                    log.warn("技能未成功释放，重新识别牌局");
                    this.needBoardRefresh = true;
                    this.needHandCount = true;
                    this.actionFailures += 1;
                    if (this.actionFailures >= 3) {
                        log.warn("连续多次操作失败，结束当前回合");
                        this.actionFailures = 0;
                        await terminateTurn();
                        await pause(1000);
                    }
                    return;
                }
                this.actionFailures = 0;
                // 本次技能消耗了“下一次伤害/减费/爆发减能”，再记录技能自身带来的新增益。
                if (num(action.base_damage) > 0) consumeNextDamage(this.game);
                consumeNextSkillCost(this.game);
                if (action.type === "burst") consumeNextBurstEnergy(this.game);
                applyEffectBuffs(this.game, action.skill_effect, "turn");
            }
        }

        async playStep() {
            // 对局可能在识别/决策的间隙结束，出牌前再确认一次，避免在结算界面继续操作。
            const finish = await isUiFinish();
            if (finish !== "none") {
                this.game.finished = finish;
                return;
            }
            if (CFG.scanZones) {
                try {
                    await scanZones(this.game);
                } catch (e) {
                    debugLog("区域扫描失败: " + e);
                }
            }
            try {
                await scanCharacterStates(this.game);
            } catch (e) {
                debugLog("角色状态扫描失败: " + e);
            }
            const actions = buildActions(this.game);
            const hasLethal = actions.some(function (action) { return action.kills_target; });
            this.game.lethalAvailable = hasLethal ? 1 : 0;
            const state = buildState(this.game);
            const winRate = estimateWinRate(this.game);
            if (autoSurrenderEnabled() && this.shouldSurrender(winRate)) {
                this.surrenderTried = true;
                log.warn("胜率估计 " + Math.round(winRate * 100) + "%，低于阈值 " + surrenderThresholdValue() +
                    "%，尝试放弃对局");
                if (await surrenderDuel()) {
                    this.surrenderDone = true;
                    this.game.finished = "lose";
                    log.info("已放弃对局");
                    return;
                }
                log.warn("放弃对局失败，继续自动对战");
            }
            const decision = chooseAction(state, actions);
            let chosenAction = actions[decision.chosen];
            // 出牌是快速行动，不会被技能的高伤害分数挤掉；交战斗行动前先打一张优质牌。
            // 换人前同理，但要有剩余骰子还够换人的硬约束。
            if (!hasLethal && this.game.cardsPlayedThisTurn < 2 &&
                ["normal", "skill", "burst", "end", "switch"].indexOf(chosenAction.type) >= 0) {
                const scores = decision.policyScores || decision.expertScores;
                const diceLeft = sumDice(this.game.dice);
                const reserveDice = chosenAction.type === "switch" ? num(chosenAction.dice_cost) : 0;
                let cardIndex = -1;
                let cardScore = -Infinity;
                for (let index = 0; index < actions.length; index++) {
                    if (actions[index].type !== "play_card") continue;
                    if (diceLeft < num(actions[index].dice_cost) + reserveDice) continue;
                    if (scores[index] > cardScore) {
                        cardScore = scores[index];
                        cardIndex = index;
                    }
                }
                if (cardIndex >= 0) {
                    decision.chosen = cardIndex;
                    chosenAction = actions[cardIndex];
                    decision.mode += "+fastcard";
                }
            }

            this.logger.decision({
                turn: state.turn,
                state: state,
                actions: actions,
                chosen: decision.chosen,
                expert_scores: decision.expertScores.map(function (value) { return Math.round(value * 10000) / 10000; }),
                policy_scores: decision.policyScores ? decision.policyScores.map(function (value) {
                    return Math.round(value * 1000000) / 1000000;
                }) : null,
                mode: decision.mode,
            });

            log.info("决策[" + decision.mode + "]: " + (chosenAction.skill_name || chosenAction.card_name || chosenAction.type) +
                " | 骰子=" + sumDice(this.game.dice) +
                " 手牌=" + this.game.handCount +
                " 敌方附着=" + (state.enemy_attached_element || "无") +
                (num(state.active_in_danger) ? " 危险(敌方威胁=" + num(state.enemy_threat) + ")" : ""));

            await this.executeAction(chosenAction);
            await pause(1500);
            await this.refreshBoardInfo(false);
            this.game.lethalAvailable = 0;
        }

        async ensureRoster() {
            if (!this.game.userLoaded || !this.game.enemyLoaded) {
                if (!(await isUiMain())) return false;
                await this.readFullBoard();
            }
            return this.game.userLoaded && this.game.enemyLoaded;
        }

        async run() {
            const idleTimeoutMs = 180000;
            let steps = 0;
            let idleSince = 0;
            let idleTick = 0;
            let setupWaits = 0;
            let lastProgress = "";
            let progressRepeats = 0;
            while (steps < 2000) {
                steps += 1;
                if (captureLost) {
                    log.warn("截图器已停止（BetterGI 可能被暂停或游戏窗口失效），脚本退出");
                    return;
                }
                const finish = this.game.finished || await isUiFinish();
                if (finish !== "none") {
                    log.info(finish === "win" ? "对局胜利！" : "对局失败...");
                    notification.send(`${finish === "win" ? "对局胜利！" : "对局失败..."}`);
                    this.logger.result(finish, Math.max(1, this.game.turn), {
                        surrender: this.surrenderDone,
                    });
                    disposeZones(this.game.zones);
                    this.game.zones = createZones();
                    return;
                }
                const phaseText = normalizeOcrText(await ocrTextAt(844, 167, 232, 65));
                if (phaseText === "初始手牌") {
                    await this.waitStartingHand();
                    continue;
                }
                if (phaseText.indexOf("重投") >= 0) {
                    await this.waitReroll();
                    continue;
                }
                if (phaseText.indexOf("结束阶段") >= 0) {
                    await this.waitEndPhase();
                    continue;
                }
                if (await isUiChoice()) {
                    await this.waitChoice();
                    continue;
                }

                const acting = await getActingTurn();
                if (acting === "user") {
                    if (this.game.turn > 0) {
                        setupWaits = 0;
                    } else if (sumDice(this.game.dice) === 0 && setupWaits < 30) {
                        // 开局的初始手牌/选人/重投阶段偶尔会被识别成我方行动，此时还没有掷骰子。
                        // 最多等约 40 秒，仍未进入第 1 回合就按旧逻辑继续，避免识别持续失败时卡死。
                        setupWaits += 1;
                        this.noneCount = 0;
                        idleSince = 0;
                        await pause(800);
                        continue;
                    }
                    this.noneCount = 0;
                    idleSince = 0;
                    idleTick = 0;
                    this.endPhaseSeen = false;
                    try {
                        if (!(await this.ensureRoster())) {
                            await pause(700);
                            continue;
                        }
                        if (this.needBoardRefresh) {
                            await this.refreshBoardInfo(false);
                        }
                        if (this.needHandCount) {
                            await this.calibrateHand();
                            if (CFG.useActionCards && this.game.handCount > 0) {
                                await readHandCards(this.game);
                            }
                        }
                        await this.refreshDice();
                        await this.playStep();
                        const progress = boardProgressSignature(this.game);
                        if (progress === lastProgress) {
                            progressRepeats += 1;
                            // 二十次决策（约两分钟）牌局完全没有变化，说明操作被界面挡住或一直没生效。
                            if (progressRepeats >= 20) {
                                log.error("连续 " + progressRepeats + " 次决策牌局状态没有变化，疑似界面被遮挡，脚本退出");
                                saveDebugScreenshot("no_progress");
                                return;
                            }
                        } else {
                            lastProgress = progress;
                            progressRepeats = 0;
                        }
                    } catch (e) {
                        log.error("回合决策异常: " + e);
                        await pause(1000);
                    }
                    continue;
                }

                if (acting === "enemy") {
                    this.noneCount = 0;
                    idleSince = 0;
                    idleTick = 0;
                    this.endPhaseSeen = false;
                    await pause(700);
                    if (this.needBoardRefresh) {
                        await this.refreshBoardInfo(false);
                    }
                    continue;
                }

                if (acting === "endphase") {
                    this.noneCount = 0;
                    idleSince = 0;
                    idleTick = 0;
                    await this.waitEndPhase();
                    continue;
                }

                // 状态未知：不点击设置按钮，只做安全复位，并允许较长时间等待动画。
                const now = Date.now();
                if (!idleSince) idleSince = now;
                const idleMs = now - idleSince;
                if (idleMs >= idleTimeoutMs) {
                    log.error("超过 " + Math.round(idleMs / 1000) + " 秒未能识别对局状态，脚本退出");
                    return;
                }
                idleTick += 1;
                if (idleTick % 4 === 0) {
                    moveMouseTo(RESET_X, RESET_Y);
                    await pause(250);
                }
                if (idleMs >= 8000 && idleMs < 60000) {
                    // 点击牌桌中央的空场区域，关掉悬停的技能/卡牌详情面板。
                    click(960, 540);
                    await pause(600);
                } else {
                    await pause(500);
                }
            }
            log.warn("达到最大循环次数，脚本结束");
        }
    }

    /**
     * 前往各个地点
     * @returns {Promise<void>}
     * @constructor
     */
    async function NavigateCharacterTo(name) {

        if (name === "Prince" || name === "Character" || name === "Co-op" || name === "Arena" || name === "Guest") {
            const imageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CatsTailIcon.png"));
            await genshin.returnMainUi();
            await sleep(2000);
            keyPress("M");
            await sleep(2000);
            click(1749, 1023);
            await sleep(1200);
            click(1359, 143);
            await sleep(1000);
            await genshin.setBigMapZoomLevel(1.0);
            await sleep(500);
            let capture = captureGameRegion();
            let imageResult = capture.find(imageRo);
            if (imageResult.isExist()) {
                imageResult.Click();
            } else {
                click(1013, 656);
            }
            capture.dispose();
            await sleep(1200);
            let ocrResult = await Ocr(1261, 646, 271, 306, true);
            for (let i = 0; i < ocrResult.length; i++) {
                if (ocrResult[i].text.includes("猫尾酒馆")) {
                    ocrResult[i].Click();
                    await sleep(1200);
                    click(1678, 1013);
                    await sleep(500);
                    break;
                }
            }
            await genshin.returnMainUi();

            // 前往具体位置
            if (name === "Prince") {
                keyDown("W");
                await sleep(2000);
                keyUp("W");
                await sleep(500);
                keyPress("F");
                await sleep(2000);
                keyPress("F");
                await sleep(200);
            } else if (name === "Character") {
                keyDown("A");
                await sleep(1200);
                keyUp("A");
                await sleep(300);
                keyPress("F");
                await sleep(200);
            } else if (name === "Co-op") {
                keyDown("A");
                await sleep(1200);
                keyUp("A");
                await sleep(300);
                await keyMouseScript.run(downRolls);
                await sleep(300);
                keyPress("F");
                await sleep(200);
            } else if (name === "Arena") {
                keyDown("A");
                await sleep(1200);
                keyUp("A");
                await sleep(300);
                await keyMouseScript.run(downRolls);
                await sleep(300);
                await keyMouseScript.run(downRolls);
                await sleep(300);
                keyPress("F");
                await sleep(200);
            }
        }

    }

    // ==================== 入口 ====================
    let strategy = null;
    let policyModel = null;

    async function main() {
        log.info("「牌圣」v" + SCRIPT_VERSION + " 启动");
        if (!loadCardDictionary()) return;

        // while (true) {
        //     const uiRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/HideUI.png"), 250, 19, 60, 58);
        //     const fRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F.png"), 1200, 561, 55, 272);
        //     await NavigateCharacterTo("Character");
        //     await sleep(500);
        //
        //     let ocrResult = await Ocr(1438, 168, 96, 38);
        //     log.info(`${Number(ocrResult.text)}`);
        //     await sleep(5000);
        //
        //     // test，角色挑战第一个
        //     click(443, 414);
        //     // test，角色挑战第二个
        //     // click(700, 407);
        //     await sleep(500);
        //     click(1449, 879);
        //
        //     // 等待到出现对话界面
        //     while (true) {
        //         let capture = captureGameRegion();
        //         let resultH = capture.find(uiRo).isExist();
        //         let resultF = capture.find(fRo).isExist();
        //         capture.dispose();
        //         if (resultH && resultF) {
        //             break;
        //         } else {
        //             keyPress("F");
        //             await sleep(200);
        //         }
        //     }
        //
        //     // 等待到出现F并点击
        //     while (true) {
        //         let capture = captureGameRegion();
        //         let result = capture.find(fRo).isExist();
        //         capture.dispose();
        //         if (result) {
        //             await sleep(1000);
        //             keyPress("F");
        //             await sleep(2000);
        //             break;
        //         } else {
        //             await sleep(200);
        //         }
        //     }
        //
        //     // 自动七圣召唤
        //     if (CFG.useModel) {
        //         policyModel = loadPolicyModel(CFG.modelFile);
        //         if (!policyModel) {
        //             log.warn("模型文件不可用，使用内置专家策略（失败原因见上方日志）");
        //         }
        //     } else {
        //         log.info("设置中已关闭模型，使用内置专家策略");
        //     }
        //
        //     strategy = new Strategy();
        //     strategy.model = policyModel;
        //     await strategy.run();
        //
        //     // 退出对局
        //     await sleep(5000);
        //     click(744, 921);
        //
        //     // 等待到出现对话界面
        //     while (true) {
        //         let capture = captureGameRegion();
        //         let resultH = capture.find(uiRo).isExist();
        //         capture.dispose();
        //         if (resultH) {
        //             break;
        //         } else {
        //             await sleep(200);
        //             keyPress("F");
        //             await sleep(200);
        //         }
        //     }
        //     // 对话直至退出
        //     while (true) {
        //         let capture = captureGameRegion();
        //         let resultH = capture.find(uiRo).isExist();
        //         capture.dispose();
        //         if (!resultH) {
        //             break;
        //         } else {
        //             await sleep(500);
        //             keyPress("F");
        //             await sleep(200);
        //         }
        //     }
        //     await sleep(5000);
        //     await genshin.returnMainUi();
        // }
        // 自动七圣召唤
        if (CFG.useModel) {
            policyModel = loadPolicyModel(CFG.modelFile);
            if (!policyModel) {
                log.warn("模型文件不可用，使用内置专家策略（失败原因见上方日志）");
            }
        } else {
            log.info("设置中已关闭模型，使用内置专家策略");
        }

        strategy = new Strategy();
        strategy.model = policyModel;
        await strategy.run();
    }

    // Node 下仅导出纯函数用于特征一致性测试；BetterGI 下正常运行。
    if (typeof require === "function" && typeof module !== "undefined" && module.exports) {
        module.exports = {
            ELEMENTS: ELEMENTS,
            ACTION_TYPES: ACTION_TYPES,
            STATE_FEATURES: STATE_FEATURES,
            ACTION_FEATURES: ACTION_FEATURES,
            INPUT_DIM: INPUT_DIM,
            reactionBonus: reactionBonus,
            stateVector: stateVector,
            actionVector: actionVector,
            expertScore: expertScore,
            buildActions: buildActions,
            skillPotential: skillPotential,
            parseSkillCost: parseSkillCost,
            parseSkillDamage: parseSkillDamage,
            parseEndPhaseDamage: parseEndPhaseDamage,
            loadPolicyModelFromPayload: loadPolicyModelFromPayload,
            createBuffs: createBuffs,
            applyEffectBuffs: applyEffectBuffs,
            buffDamage: buffDamage,
            buffTakeDamage: buffTakeDamage,
            buffShield: buffShield,
            effectiveSkillCost: effectiveSkillCost,
            effectiveCardDice: effectiveCardDice,
            effectiveSwitchCost: effectiveSwitchCost,
            consumeNextCardCost: consumeNextCardCost,
            consumeNextSkillCost: consumeNextSkillCost,
            consumeNextSwitchCost: consumeNextSwitchCost,
            applyCostReduction: applyCostReduction,
        };
        return;
    }

    await main();
})().catch(function (error) {
    try {
        log.error("脚本异常退出: " + (error && error.stack ? error.stack : error));
    } catch (e) {
    }
});
