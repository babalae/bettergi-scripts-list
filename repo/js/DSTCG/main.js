(async function () { // 仅适配敌方1-4张牌[我方3张牌]的情况其他情况可能不适配，角色装备检测（根据已有数据）[后续实现]，冰冻切人逻辑，全局额外延迟加入设置，敌方骰子数量识别，设置内更改流浪者名称【不支持流浪者】、【注意：双方召唤区与支援区读取已关闭，手牌详情读取已关闭】、死循环内的重投骰子检测要再次确认队伍角色的存活情况、角色倒地仍会切换倒地角色
    // 所有图片的路径信息
    const pic_path_dic = {
        "MainPyro": "assets/dice/MainPyro.png",
        "MainHydro": "assets/dice/MainHydro.png",
        "MainAnemo": "assets/dice/MainAnemo.png",
        "MainElectro": "assets/dice/MainElectro.png",
        "MainDendro": "assets/dice/MainDendro.png",
        "MainCryo": "assets/dice/MainCryo.png",
        "MainGeo": "assets/dice/MainGeo.png",
        "MainOmni": "assets/dice/MainOmni.png",
        "RollPyro": "assets/dice/RollPyro.png",
        "RollHydro": "assets/dice/RollHydro.png",
        "RollAnemo": "assets/dice/RollAnemo.png",
        "RollElectro": "assets/dice/RollElectro.png",
        "RollDendro": "assets/dice/RollDendro.png",
        "RollCryo": "assets/dice/RollCryo.png",
        "RollGeo": "assets/dice/RollGeo.png",
        "RollOmni": "assets/dice/RollOmni.png",
        "Hand5": "assets/num/Hand5.png",
        "Hand6": "assets/num/Hand6.png",
        "Hand7": "assets/num/Hand7.png",
        "Hand8": "assets/num/Hand8.png",
        "Hand9": "assets/num/Hand9.png",
        "Hand10": "assets/num/Hand10.png",
        "disable": "assets/disable.png",
        "setting": "assets/setting.png",
        "userTurn": "assets/user_turn.png",
        "enemyTurn": "assets/enemy_turn.png",
        "charge": "assets/charge.png",
        "uncharge": "assets/uncharge.png",
        "StatePyro": "assets/state/StatePyro.png",
        "StateHydro": "assets/state/StateHydro.png",
        "StateElectro": "assets/state/StateElectro.png",
        "StateDendro": "assets/state/StateDendro.png",
        "StateCryo": "assets/state/StateCryo.png",
        "StateFreeze": "assets/state/StateFreeze.png",
    }
    // 包含异常状态[State](其他状态从第12项开始，用于显示User.userState和User.enemyState)
    const element_dic = {
        "无": "None",
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
        "冰冻": "Freeze"
    }
    // 定位角色牌充能的位置（识别角色牌充能用，覆盖整个牌的充能区域）
    const chargeArea_dic = {
        "size": [32, 180],
        "enemy31": [812, 185],
        "enemy32": [1022, 185],
        "enemy33": [1233, 185],
        "user31": [812, 612],
        "user32": [1022, 612],
        "user33": [1233, 612],
        "enemy41": [708, 185],
        "enemy42": [919, 185],
        "enemy43": [1126, 185],
        "enemy44": [1337, 185],
        "enemy21": [918, 185],
        "enemy22": [1128, 185],
        "enemy11": [1022, 185]
    }
    // 定位角色牌位置（识别异常状态用，覆盖整个牌面及上方部分区域）
    const stateArea_dic = {
        "size": [167, 382],
        "enemy31": [663, 105],
        "enemy32": [876, 105],
        "enemy33": [1089, 105],
        "user31": [663, 545],
        "user32": [876, 545],
        "user33": [1089, 545],
        "enemy41": [562, 105],
        "enemy42": [774, 105],
        "enemy43": [984, 105],
        "enemy44": [1193, 105],
        "enemy21": [857, 185],
        "enemy22": [1070, 185],
        "enemy11": [1022, 185]
    }
    // 定位手牌位置（1-10张手牌）
    const stateHand_dic = {
        1: {
            1: [1120, 945]
        },
        2: {
            1: [1019, 945],
            2: [1222, 945]
        },
        3: {
            1: [914, 945],
            2: [1117, 945],
            3: [1322 , 945]
        },
        4: {
            1: [812, 945],
            2: [1013, 945],
            3: [1216, 945],
            4: [1424, 945]
        },
        5: {
            1: [719, 945],
            2: [913, 945],
            3: [1115, 945],
            4: [1319, 945],
            5: [1528, 945]
        },
        6: {
            1: [614, 945],
            2: [811, 945],
            3: [1012, 945],
            4: [1216, 945],
            5: [1423, 945],
            6: [1625, 945]
        },
        7: {
            1: [635, 945],
            2: [799, 945],
            3: [961, 945],
            4: [1117, 945],
            5: [1279, 945],
            6: [1438, 945],
            7: [1603, 945]
        },
        8: {
            1: [605, 945],
            2: [751, 945],
            3: [893, 945],
            4: [1042, 945],
            5: [1177, 945],
            6: [1325, 945],
            7: [1471, 945],
            8: [1618, 945]
        },
        9: {
            1: [587, 945],
            2: [716, 945],
            3: [847, 945],
            4: [976, 945],
            5: [1103, 945],
            6: [1225, 945],
            7: [1352, 945],
            8: [1492, 945],
            9: [1634, 945]
        },
        10: {
            1: [563, 945],
            2: [686, 945],
            3: [892, 945],
            4: [920, 945],
            5: [1039, 945],
            6: [1153, 945],
            7: [1270, 945],
            8: [1384, 945],
            9: [1507, 945],
            10: [1649, 945]
        }
    }
    // 角色牌血量坐标（0为x，1、2为两个y值[分别对应上下两个位置]）
    const hpArea_dic = {
        "size": [58, 40],
        "enemy31": [646, 170, 212],
        "enemy32": [856, 170, 212],
        "enemy33": [1066, 170, 212],
        "user31": [646, 600, 640],
        "user32": [856, 600, 640],
        "user33": [1066, 600, 640],
        "enemy41": [541, 170, 212],
        "enemy42": [751, 170, 212],
        "enemy43": [961, 170, 212],
        "enemy44": [1171, 170, 212],
        "enemy21": [751, 170, 212],
        "enemy22": [962, 170, 212],
        "enemy11": [856, 170, 212]
    }
    // 角色牌技能位置（0为四技能角色的普攻位置，1为三技能角色的普攻位置）
    let skillPosition_dic = {
        0: [1500, 957],
        1: [1608, 957],
        2: [1716, 957],
        3: [1824, 957]
    }
    // 元素反应字典(左侧为附着元素)[不可更改顺序]【DEBUG】还需要改进，这里仅考虑伤害增幅和对后台角色的额外伤害，不考虑激化、绽放、碎冰(目前添加较为简单)等后续伤害增幅和召唤物
    let elementReaction_dic = {
        "Pyro": {
            "Pyro": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Hydro": {
                "increase": 2,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Anemo": {
                "increase": 0,
                "others": {
                    "damage": 1,
                    "element_type": "Pyro"
                }
            },
            "Electro": {
                "increase": 2,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Dendro": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Cryo": {
                "increase": 2,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Geo": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            }
        },
        "Hydro": {
            "Pyro": {
                "increase": 2,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Hydro": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Anemo": {
                "increase": 0,
                "others": {
                    "damage": 1,
                    "element_type": "Hydro"
                }
            },
            "Electro": {
                "increase": 1,
                "others": {
                    "damage": 1,
                    "element_type": "Piercing"
                }
            },
            "Dendro": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Cryo": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Geo": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            }
        },
        "Electro": {
            "Pyro": {
                "increase": 2,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Hydro": {
                "increase": 1,
                "others": {
                    "damage": 1,
                    "element_type": "Piercing"
                }
            },
            "Anemo": {
                "increase": 0,
                "others": {
                    "damage": 1,
                    "element_type": "Electro"
                }
            },
            "Electro": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Dendro": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Cryo": {
                "increase": 1,
                "others": {
                    "damage": 1,
                    "element_type": "Piercing"
                }
            },
            "Geo": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            }
        },
        "Cryo": {
            "Pyro": {
                "increase": 2,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Hydro": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Anemo": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Electro": {
                "increase": 1,
                "others": {
                    "damage": 1,
                    "element_type": "Piercing"
                }
            },
            "Dendro": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Cryo": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Geo": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            }
        },
        "Dendro": {
            "Pyro": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Hydro": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Anemo": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Electro": {
                "increase": 1,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Dendro": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Cryo": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            },
            "Geo": {
                "increase": 0,
                "others": {
                    "damage": 0,
                    "element_type": ""
                }
            }
        },
    }
    // 全部卡牌信息（本地读取）
    const card_dic = await parseCardData();

    /**
     * 所有卡牌的基类
     */
    class Card {
        constructor(name, type) {
            this.name = name;           // 卡牌名称（例如“卡齐娜”、“以极限之名”等）
            this.type = type;           // 卡牌大类（角色牌、附属牌、行动牌、魔物牌）
            this.triggers = {};         // 【DEBUG】占位，存放诸如“入场时”、“结束阶段”的触发器函数
        }
    }

    /**
     * 角色牌（含血量、技能、附属牌子卡等信息）
     */
    class CharacterCard extends Card {
        constructor({ name, full_name, health, element, charge, weapon, team, means, skills, children }) {
            super(name, "角色牌");
            this.full_name = full_name;
            this.health = health;
            this.element = element;
            this.charge = charge;
            this.weapon = weapon;
            this.team = team;
            this.means = means;
            this.skills = skills || [];
            // children 表示角色的附属牌名称数组
            this.children = children || [];
        }
    }

    /**
     * 附属牌（一般是召唤物，具有触发效果，常在“结束阶段”生效）
     */
    class SummonCard extends Card {
        constructor({ name, ctype, effect_text, cost }) {
            super(name, "附属牌");
            this.ctype = ctype;  // 召唤物标识等
            this.effect_text = effect_text; // 效果文字描述
            this.cost = cost;
            this.effect = createActionFromEffectText(effect_text);
        }
    }

    /**
     * 行动牌（事件牌、装备牌、场地牌等）
     */
    class ActionCard extends Card {
        constructor({ name, ctype, label, means, cost, effect_text }) {
            super(name, "行动牌");
            this.ctype = ctype;
            this.label = label;
            this.means = means;
            this.cost = cost;  // 花费（仅记录，不做计算）
            this.effect_text = effect_text; // 效果文字描述
            this.effect = createActionFromEffectText(effect_text);
        }
    }

    /**
     * 魔物牌
     * 注意：没有魔物牌的附属牌信息
     */
    class MonsterCard extends Card {
        constructor({ name, health, element, charge, weapon, team, means, skills }) {
            super(name, "魔物牌");
            this.full_name = full_name;
            this.health = health;
            this.element = element;
            this.charge = charge;
            this.weapon = weapon;
            this.team = team;
            this.means = means;
            this.skills = skills || [];
        }
    }

    class Game {
        constructor(options) {
            /**
             * 字典内的内容(除了enemyCharge、userCharge、enemyState和userState)
             * {
             *     0: { // id，用于判断顺序，从0开始
             *     "name": "card_name", // 卡牌名
             *     "object": Object // 对应的卡牌类的实例(由createCardFromDict创建)
             *     }
             * }
             * 字典内的内容(enemyCharge和userCharge)
             * {
             *     0: [ // id，用于判断顺序，从0开始
             *         充能数,
             *         未充能数
             *     ]
             * }
             * 字典内的内容(enemyState和userState)
             * {
             *     0: [ // id，用于判断顺序，从0开始
             *         "Pyro",
             *         "Freeze",
             *         ...
             *     ]
             * }
             */
            this.enemyMainCard = ""; // 敌方-出战角色牌
            this.userMainCard = ""; // 我方-出战角色牌
            this.enemyMainCardId = 0; // 敌方-出战角色牌id
            this.userMainCardId = 0; // 我方-出战角色牌id
            this.enemyCards = {}; // 敌方-角色牌
            this.enemyLocationArea = {}; // 敌方-场地区
            this.enemySummonArea = {}; // 敌方-召唤区
            this.userCards = {}; // 我方-角色牌
            this.userLocationArea = {}; // 我方-场地区
            this.userSummonArea = {}; // 我方-召唤区
            this.enemyCharge = {}; // 敌方-充能数
            this.userCharge = {}; // 我方-充能数
            this.enemyState = {}; // 敌方-元素/异常状态
            this.userState = {}; // 我方-元素/异常状态
            this.enemyHp = {}; // 敌方-角色牌血量
            this.userHp = {}; // 我方-角色牌血量

            this.effectDic = {}; // 元素反应造成的影响，由game.calculateEachReacctionEffect()生成
        }

        // 获取出战角色的id
        async calculateId() {
            for (const [id, msg] of Object.entries(this.enemyCards)) {
                if (msg["name"] === this.enemyMainCard) {
                    this.enemyMainCardId = id;
                }
            }
            for (const [id, msg] of Object.entries(this.userCards)) {
                if (msg["name"] === this.userMainCard) {
                    this.userMainCardId = id;
                }
            }
        }

        // 封装通用逻辑，遍历所有坐标进行点击识别
        async getMainCard(cardCoords, extraWaitTime = 0) {
            const waitTime = 500 + extraWaitTime;
            for (const { x, y } of cardCoords) {
                click(x, y);
                await sleep(waitTime);
                const cardName = await ocrCardName();
                if (cardName !== false) {
                    // 点击屏幕中间（重置状态）
                    click(1190, 545); // 点击屏幕中间靠右复位
                    await sleep(waitTime);
                    return cardName;
                }
            }
            return false; // 如果所有坐标处理后依然未获取到内容，则返回 false
        }

        // 获取敌方出战角色牌 [DEBUG] 应考虑卡牌数变化的情况
        async getEnemyMainCard(extraWaitTime = 0) {
            const enemyCoords = [
                { x: 696, y: 460 },
                { x: 908, y: 460 },
                { x: 1018, y: 460 },
                { x: 1231, y: 460 }
            ];
            this.enemyMainCard = await this.getMainCard(enemyCoords, extraWaitTime);
        }

        // 获取我方出战角色牌
        async getUserMainCard(extraWaitTime = 0) {
            const myCoords = [
                { x: 751, y: 608 },
                { x: 962, y: 608 },
                { x: 1174, y: 608 }
            ];
            this.userMainCard = await this.getMainCard(myCoords, extraWaitTime);
        }

        async getEnemyCard(x, id, waitTime) {  // 通用处理函数，用于点击指定位置、等待、OCR获取名称、退出详情界面，并将卡牌数据存入 enemyCards
            click(x, 330);                   // 点击指定位置
            await sleep(waitTime);             // 等待详情界面打开
            let cardName;
            for (let i = 0; i < 3; i++) {      // 最多试3次获取卡牌名称
                cardName = await ocrCardName();
                await sleep(waitTime);
                if (cardName !== false) break;
            }
            await sleep(waitTime);
            click(1190, 545); // 点击屏幕中间靠右复位       // 退出详情界面
            await sleep(waitTime);
            // 将获取到的卡牌数据存入 enemyCards 中
            this.enemyCards[id] = {
                name: cardName,
                object: await createCardFromDict(cardName)
            };
        }

        async getUserCard(x, id, waitTime) {  // 通用处理函数，用于点击指定位置、等待、OCR获取名称、退出详情界面，并将卡牌数据存入 userCards
            click(x, 720);                   // 点击指定位置
            await sleep(waitTime);             // 等待详情界面打开
            let cardName;
            for (let i = 0; i < 3; i++) {      // 最多试3次获取卡牌名称
                cardName = await ocrCardName();
                await sleep(waitTime);
                if (cardName !== false) break;
            }
            await sleep(waitTime);
            click(1190, 545); // 点击屏幕中间靠右复位       // 退出详情界面
            await sleep(waitTime);
            // 将获取到的卡牌数据存入 userCards 中
            this.userCards[id] = {
                name: cardName,
                object: await createCardFromDict(cardName)
            };
        }

        // 获取敌方角色牌名称和充能
        async getEnemyCards(extraWaitTime = 0) {
            const waitTime = 200 + extraWaitTime;

            // 判断敌方角色牌数量
            let cardNum;
            // 首先点击一个位置来判断敌方卡牌的数量（这里用敌方第四张牌的位置做检测）
            click(1275, 300);
            await sleep(waitTime);
            let cardCheck = await ocrCardName();
            click(1190, 545); // 点击屏幕中间靠右复位 // 退出卡牌界面
            await sleep(waitTime);
            if (cardCheck !== false) {
                cardNum = 4;
            } else {
                // 尝试点击敌方第三张牌的位置（假设总共三张牌）
                click(1200, 300);
                await sleep(waitTime);
                cardCheck = await ocrCardName();
                click(1190, 545); // 点击屏幕中间靠右复位 // 退出卡牌界面
                await sleep(waitTime);
                if (cardCheck !== false) {
                    cardNum = 3;
                } else {
                    // 尝试点击敌方第二张牌的位置（假设总共两张牌）
                    click(1061, 300);
                    await sleep(waitTime);
                    cardCheck = await ocrCardName();
                    click(1190, 545); // 点击屏幕中间靠右复位 // 退出卡牌界面
                    await sleep(waitTime);
                    if (cardCheck !== false) {
                        cardNum = 2;
                    } else {
                        cardNum = 1;
                    }
                }
            }


            await sleep(waitTime); // 等待UI稳定
            let gameRegion = captureGameRegion(); // 捕获一次游戏区域
            if (cardNum === 1) { // 一张牌
                this.enemyCharge[0] = await getCharge("enemy", 1, 1, gameRegion);
                this.enemyState[0] = await getState("enemy", 1, 1, gameRegion);
                this.enemyHp[0] = await getCardHp("enemy", 1, 1, gameRegion);
                await this.getEnemyCard(959, 0, waitTime);
            } else if (cardNum === 2) { // 两张牌
                for (let i = 0; i < 2; i++) {
                    this.enemyCharge[i] = await getCharge("enemy", i + 1, 2, gameRegion);
                    this.enemyState[i] = await getState("enemy", i + 1, 2, gameRegion);
                    this.enemyHp[i] = await getCardHp("enemy", i + 1, 2, gameRegion);
                }
                await this.getEnemyCard(857, 0, waitTime);
                await this.getEnemyCard(1070, 1, waitTime);
            } else if (cardNum === 3) { // 三张牌
                for (let i = 0; i < 3; i++) {
                    this.enemyCharge[i] = await getCharge("enemy", i + 1, 3, gameRegion);
                    this.enemyState[i] = await getState("enemy", i + 1, 3, gameRegion);
                    this.enemyHp[i] = await getCardHp("enemy", i + 1, 3, gameRegion);
                }
                await this.getEnemyCard(750, 0, waitTime);
                await this.getEnemyCard(960, 1, waitTime);
                await this.getEnemyCard(1175, 2, waitTime);
            } else if (cardNum === 4) { // 四张牌
                for (let i = 0; i < 4; i++) {
                    this.enemyCharge[i] = await getCharge("enemy", i + 1, 4, gameRegion);
                    this.enemyState[i] = await getState("enemy", i + 1, 4, gameRegion);
                    this.enemyHp[i] = await getCardHp("enemy", i + 1, 4, gameRegion);
                }
                await this.getEnemyCard(648, 0, waitTime);
                await this.getEnemyCard(860, 1, waitTime);
                await this.getEnemyCard(1070, 2, waitTime);
                await this.getEnemyCard(1275, 3, waitTime);
            }
            gameRegion.dispose();
        }

        // 获取我方角色牌名称和充能
        async getUserCards(extraWaitTime = 0) {
            const waitTime = 200 + extraWaitTime;

            await sleep(waitTime); // 等待UI稳定
            let gameRegion = captureGameRegion(); // 捕获一次游戏区域
            for (let i = 0; i < 3; i++) {
                this.userCharge[i] = await getCharge("user", i + 1, 3, gameRegion);
                this.userState[i] = await getState("user", i + 1, 3, gameRegion);
                this.userHp[i] = await getCardHp("user", i + 1, 3, gameRegion);
            }
            gameRegion.dispose();
            await this.getUserCard(750, 0, waitTime);
            await this.getUserCard(960, 1, waitTime);
            await this.getUserCard(1175, 2, waitTime);
        }

        // 辅助函数：遍历坐标数组，依次点击、等待、调用 OCR 并填充到指定区域
        async fillArea(area, coords, extraWaitTime = 0) {
            const waitTime = 100 + extraWaitTime;
            let i = 0;
            for (const { x, y } of coords) {
                // 点击屏幕中间以重置状态
                await sleep(waitTime);
                click(1190, 545); // 点击屏幕中间靠右复位
                await sleep(waitTime + 150); // 额外等待时间，防止卡牌遮挡
                click(x, y);
                await sleep(waitTime);
                const cardName = await ocrCardName();
                if (cardName !== false) {
                    area[i] = {
                        name: cardName,
                        object: await createCardFromDict(cardName),
                    };
                    i++;
                }
            }
        }

        // 获取敌方支援牌(和状态)
        async getEnemyLocationArea(extraWaitTime = 0) {
            const enemyCoords = [
                { x: 321, y: 218 },
                { x: 490, y: 218 },
                { x: 321, y: 413 },
                { x: 490, y: 413 },
            ];
            await this.fillArea(this.enemyLocationArea, enemyCoords, extraWaitTime);
        }

        // 获取我方支援牌(和状态)
        async getUserLocationArea(extraWaitTime = 0) {
            const userCoords = [
                { x: 321, y: 671 },
                { x: 490, y: 671 },
                { x: 321, y: 852 },
                { x: 487, y: 852 },
            ];
            await this.fillArea(this.userLocationArea, userCoords, extraWaitTime);
        }

        // 获取敌方召唤牌(和状态)
        async getEnemySummonArea(extraWaitTime = 0) {
            const enemySummonCoords = [
                { x: 1433, y: 218 },
                { x: 1596, y: 218 },
                { x: 1433, y: 413 },
                { x: 1596, y: 413 },
            ];
            await this.fillArea(this.enemySummonArea, enemySummonCoords, extraWaitTime);
        }

        // 获取我方召唤牌(和状态)
        async getUserSummonArea(extraWaitTime = 0) {
            const userSummonCoords = [
                { x: 1433, y: 671 },
                { x: 1596, y: 671 },
                { x: 1433, y: 852 },
                { x: 1596, y: 852 },
            ];
            await this.fillArea(this.userSummonArea, userSummonCoords, extraWaitTime);
        }

        // 聚合获取当前局面的方法
        async get_state(extraWaitTime = 0) {
            await this.getEnemyMainCard(extraWaitTime); // 敌方出战卡牌

            await this.getUserMainCard(extraWaitTime); // 我方出战卡牌

            await this.getUserCards(extraWaitTime); // 我方卡牌

            await this.getEnemyCards(extraWaitTime); // 敌方卡牌

            // await this.getUserLocationArea(extraWaitTime); // 我方支援牌

            // await this.getEnemyLocationArea(extraWaitTime); // 敌方支援牌
            //
            // await this.getUserSummonArea(extraWaitTime); // 我方召唤牌
            //
            // await this.getEnemySummonArea(extraWaitTime); // 敌方召唤牌

            await this.calculateId(); // 双方出战角色id

            return true;
        }

        // 仅获取双方角色牌信息
        async get_character_cards(extraWaitTime = 0) {
            await this.getEnemyMainCard(extraWaitTime); // 敌方出战卡牌

            await this.getUserMainCard(extraWaitTime); // 我方出战卡牌

            await this.getUserCards(extraWaitTime); // 我方卡牌

            await this.getEnemyCards(extraWaitTime); // 敌方卡牌

            await this.calculateId(); // 双方出战角色id
        }

        // 计算单独阵营所有角色受到敌方元素攻击造成的元素反应影响【DEBUG】仅参考总体伤害量，暂不考虑造成的元素附着影响
        // 【DEBUG】一个角色同时附有冰草附着的情况下，理应不会在一次行动中清除这两种元素
        async calculateEachReactionEffect(target) {
            let enemyElement = "";
            this.effectDic = {};
            if (target === "enemy") {
                let elementText = this.userCards[this.userMainCardId]["object"].element;
                for (const [cn_name, en_name] of Object.entries(element_dic)) {
                    if (elementText.includes(cn_name)) {
                        enemyElement = en_name;
                        break;
                    }
                }
                for (const [id, debuffs] of Object.entries(this.enemyState)) {
                    let measure = 0;
                    if (debuffs.length !== 0) { // 有元素附着
                        let reactionDic = elementReaction_dic[debuffs[0]][enemyElement];
                        measure += reactionDic["increase"];
                        if (reactionDic["others"]["damage"] !== 0 && reactionDic["others"]["element_type"] === "Piercing") { // 穿透伤害
                            measure += Object.keys(this.enemyCards).length - 1; // 其他角色全部受到1点穿透伤害
                        } else if (enemyElement === "Anemo" && reactionDic["others"]["element_type"] !== "Piercing") { // 扩散伤害
                            for (const [b_id, b_debuffs] of Object.entries(this.enemyState)) { // 遍历一遍后台角色
                                if (b_id === id) continue;
                                if (b_debuffs.length !== 0) { // 有元素附着
                                    let b_reactionDic = elementReaction_dic[b_debuffs[0]][reactionDic["others"]["element_type"]]; // 受到出战角色的扩散元素造成的元素反应伤害
                                    measure += b_reactionDic["increase"];
                                    if (reactionDic["others"]["damage"] !== 0 && reactionDic["others"]["element_type"] === "Piercing") { // 穿透伤害
                                        measure += Object.keys(this.enemyCards).length - 1; // 其他角色全部受到1点穿透伤害
                                    }
                                } else { // 无元素附着
                                    measure += 1; // 受到一点元素伤害
                                }
                            }
                        }
                    } else { // 无元素附着
                        measure += 1; // 受到一点元素伤害
                    }
                    this.effectDic[id] = measure;
                }
            } else if (target === "user") {
                let elementText = this.enemyCards[this.enemyMainCardId]["object"].element; // [DEBUG] 此处获取的enemyMainCardId极大概率是上回合的，应在getEnemyMainCardId方法处更正策略
                for (const [cn_name, en_name] of Object.entries(element_dic)) {
                    if (elementText.includes(cn_name)) {
                        enemyElement = en_name;
                        break;
                    }
                }
                for (const [id, debuffs] of Object.entries(this.userState)) {
                    let measure = 0;
                    if (debuffs.length !== 0) { // 有元素附着
                        let reactionDic = elementReaction_dic[debuffs[0]][enemyElement];
                        log.info(`[DEBUG] 出战角色受击预测: ${target}(${id}): ${debuffs[0]}(附着)|${enemyElement}(受击)`);
                        measure += reactionDic["increase"];
                        if (reactionDic["others"]["damage"] !== 0 && reactionDic["others"]["element_type"] === "Piercing") { // 穿透伤害
                            measure += Object.keys(this.userCards).length - 1; // 其他角色全部受到1点穿透伤害
                        } else if (enemyElement === "Anemo" && reactionDic["others"]["element_type"] !== "Piercing") { // 扩散伤害
                            for (const [b_id, b_debuffs] of Object.entries(this.userState)) { // 遍历一遍后台角色
                                if (b_id === id) continue;
                                if (b_debuffs.length !== 0) { // 有元素附着
                                    let b_reactionDic = elementReaction_dic[b_debuffs[0]][reactionDic["others"]["element_type"]]; // 受到出战角色的扩散元素造成的元素反应伤害
                                    log.info(`[DEBUG] 出战角色受击预测: ${target}(${id}): ${b_debuffs[0]}(附着)|${reactionDic["others"]["element_type"]}(受击)`);
                                    measure += b_reactionDic["increase"];
                                    if (reactionDic["others"]["damage"] !== 0 && reactionDic["others"]["element_type"] === "Piercing") { // 穿透伤害
                                        measure += Object.keys(this.userCards).length - 1; // 其他角色全部受到1点穿透伤害
                                    }
                                } else { // 无元素附着
                                    measure += 1; // 受到一点元素伤害
                                }
                            }
                        }
                    } else { // 有元素附着
                        measure += 1; // 受到一点元素伤害
                    }
                    this.effectDic[id] = measure;
                }
            }
        }

        // 输出当前牌桌详情
        async log_info() {
            let user_cards = "|";
            let enemy_cards = "|";

            if (Object.keys(this.userCards).length !== 0) {
                // log.info(`我方卡牌数量: ${Object.keys(this.userCards).length}`);
                for (let i = 0; i < Object.keys(this.userCards).length; i++) {
                    let stateText = "-";
                    for (const [cn_name, en_name] of Object.entries(element_dic)) {
                        for (let j = 0; j < Object.entries(this.userState[i]).length; j++) {
                            if (Object.entries(this.userState[i])[j].includes(en_name)) {
                                stateText += `${cn_name}-`;
                            }
                        }
                    }
                    user_cards += `${this.userCards[Object.keys(this.userCards)[i]]["name"]}${this.userMainCard === this.userCards[Object.keys(this.userCards)[i]]["name"] ? "[出战]": ""}(${this.userCharge[i][0]}/${this.userCharge[i][0] + this.userCharge[i][1]})${stateText !== "-" ? `{${stateText}}`: ""}\<${this.userHp[i]}\>|`;
                }
                log.info(`我方卡牌(${Object.keys(this.userCards).length}): ${user_cards}`);
            }
            if (Object.keys(this.enemyCards).length !== 0) {
                for (let i = 0; i < Object.keys(this.enemyCards).length; i++) {
                    let stateText = "-";
                    for (const [cn_name, en_name] of Object.entries(element_dic)) {
                        for (let j = 0; j < Object.entries(this.enemyState[i]).length; j++) {
                            if (Object.entries(this.enemyState[i])[j].includes(en_name)) {
                                stateText += `${cn_name}-`;
                            }
                        }
                    }
                    enemy_cards += `${this.enemyCards[Object.keys(this.enemyCards)[i]]["name"]}${this.enemyMainCard === this.enemyCards[Object.keys(this.enemyCards)[i]]["name"] ? "[出战]": ""}(${this.enemyCharge[i][0]}/${this.enemyCharge[i][0] + this.enemyCharge[i][1]})${stateText !== "-" ? `{${stateText}}`: ""}\<${this.enemyHp[i]}\>|`;
                }
                log.info(`敌方卡牌(${Object.keys(this.enemyCards).length}): ${enemy_cards}`);
            }
            let userLocationAreaText = "我方支援牌：|";
            if (Object.keys(this.userLocationArea).length !== 0) {
                for (let i = 0; i < Object.keys(this.userLocationArea).length; i++) {
                    userLocationAreaText += `${this.userLocationArea[i]["name"]}(${i + 1})|`;
                }
                log.info(`${userLocationAreaText}`);
            }
            let enemyLocationAreaText = "敌方支援牌：|";
            if (Object.keys(this.enemyLocationArea).length !== 0) {
                for (let i = 0; i < Object.keys(this.enemyLocationArea).length; i++) {
                    enemyLocationAreaText += `${this.enemyLocationArea[i]["name"]}(${i + 1})|`;
                }
                log.info(`${enemyLocationAreaText}`);
            }
            let userSummonAreaText = "我方召唤牌：|";
            if (Object.keys(this.userSummonArea).length !== 0) {
                for (let i = 0; i < Object.keys(this.userSummonArea).length; i++) {
                    userSummonAreaText += `${this.userSummonArea[i]["name"]}(${i + 1})|`;
                }
                log.info(`${userSummonAreaText}`);
            }
            let enemySummonAreaText = "敌方召唤牌：|";
            if (Object.keys(this.enemySummonArea).length !== 0) {
                for (let i = 0; i < Object.keys(this.enemySummonArea).length; i++) {
                    enemySummonAreaText += `${this.enemySummonArea[i]["name"]}(${i + 1})|`;
                }
                log.info(`${enemySummonAreaText}`);
            }
        }
    }

    class Action {
        /**
         *
         * 根据effect_text解析单个卡牌效果（仅影响出牌决策，具体效果不进行推算[对局数据使用其他方法实时获取]）
         *
         * @param {boolean} dealDamage 是否造成伤害
         * @param {boolean} instantDamage 是否是即时伤害
         * @param {boolean} clickTwice 是否需要二次点击
         * 	  例如指定敌方的召唤牌
         * @param {bigint} damage 伤害
         * 	  正数为攻击、负数为治疗
         * @param {bigint} residueDegree 剩余次数
         * @param {bigint} consumption 生效后减少的可用次数
         * @param {string} effectType 生效类型
         *    我方出战角色为...（角色被动）user_main_card[卡牌名]
         *    我方...卡牌入场（名称、类型）user_card_income[卡牌名]
         *    敌方...卡牌入场（名称、类型）enemy_card_income[卡牌名]
         *    我方切换角色 user_switch
         *    敌方切换角色 enemy_switch
         *    我方造成元素攻击 user_element_dmg
         *    敌方造成元素攻击 enemy_element_dmg
         *    我方造成穿透伤害 user_real_dmg
         *    敌方造成穿透伤害 enemy_real_dmg
         *    回合结束 round_over
         * @param {string} elementType 元素类型(元素附着)
         *    无 None
         *    火 Pyro
         *    水 Hydro
         *    风 Anemo
         *    雷 Electro
         *    草 Dendro
         *    冰 Cryo
         *    岩 Geo
         * @param {string} targetType 目标
         *    敌方出战卡牌 enemy_main_card
         *    我方出战卡牌 user_main_card
         *    敌方下一个角色卡牌 enemy_next_card
         *    我方下一个角色卡牌 user_next_card
         *    敌方所有后台卡牌 enemy_other_card
         *    我方所有后台卡牌 user_other_card
         *    敌方支援牌 enemy_location
         *    敌方召唤牌 enemy_summon
         *    我方支援牌 user_location
         *    我方召唤牌 user_summon
         * @param {string} specialEffect 特殊效果
         * 	  例如本回合禁止对方使用行动牌（秘传卡牌等）
         */
        constructor (dealDamage, instantDamage, clickTwice, damage, residueDegree, consumption, effectType, elementType, targetType, specialEffect) {
            this.dealDamage = dealDamage; // 是否造成伤害(boolean)
            this.instantDamage = instantDamage; // 是否是即时伤害(boolean)
            this.clickTwice = clickTwice; // 是否需要二次点击(boolean)

            this.damage = damage; // 伤害(int)
            this.residueDegree = residueDegree; // 剩余次数(int)
            this.consumption = consumption; // 生效后减少的可用次数(int)

            this.effectType = effectType; // 生效类型(String)
            this.elementType = elementType; // 元素类型[元素附着](String)
            this.targetType = targetType; // 目标(String)
            this.specialEffect = specialEffect; // 特殊效果(String)
        }
    }

    class Strategy {

        constructor () {
            this.diceMsg = {};
            this.keepDiceList = ["Omni"];
            this.TcgGame = new Game();
        }

        /**
         * 选择手牌开始【DEBUG】需要加入手牌选择功能
         */
        async waitStartingHand() {
            if (await isUiStartingHand(false)) {
                log.info("当前为手牌选择界面");
                await sleep(500);
                click(960, 948);
                await sleep(200);
                click(960, 948); // 防止点不上【DEBUG】可以在后续流程加检测
            }
        }

        /**
         * 选择出战角色界面
         */
        async waitChoice() {
            if (await isUiChoice(false)) {
                // 识别我方角色牌
                await sleep(1500); // 等待界面动画结束
                await this.TcgGame.getUserCards();
                await this.TcgGame.log_info(); // 输出我方角色牌信息
                // 选择出战角色(第一个牌)【DEBUG】出战角色选择逻辑有待完善[根据数据总结]
                await sleep(200);
                click(750, 720);
                await sleep(500);
                click(1826, 960);
                await sleep(200);
                click(1826, 960); // 【DEBUG】此处可以添加动态检测逻辑
            }
        }

        /**
         * 重投界面
         */
        async waitReroll(extraWaitTime = 0) {
            let waitTime = 1000 + extraWaitTime;
            // 重投骰子
            if (await isUiReroll(false)) {
                // 尚未读取我方角色牌信息，优先读取(此处读取双方角色牌信息)
                if (Object.keys(this.TcgGame.userCards).length === 0) {
                    click(1872, 49); // 点击右上角按钮查看牌桌
                    await sleep(waitTime);
                    await this.TcgGame.get_character_cards();
                    await this.TcgGame.log_info();
                    await sleep(waitTime);
                    click(1872, 49); // 点击右上角按钮返回重投界面
                    await sleep(waitTime);
                }
                if (this.keepDiceList.length === 1) {
                    // 检测骰子信息并根据角色牌保留骰子【DEBUG】保留骰子的逻辑应根据牌组适配
                    for (let i = 0; i < Object.keys(this.TcgGame.userCards).length; i++) {
                        for (const [char, name] of Object.entries(element_dic)) {
                            if (card_dic[this.TcgGame.userCards[i]["name"]]["element"].includes(char) && !(this.keepDiceList.includes(name))) {
                                this.keepDiceList.push(name);
                            }
                        }
                    }
                }
                this.diceMsg = await getDiceMsg(this.keepDiceList);
                await sleep(waitTime);
                click(968, 950);
                await sleep(waitTime);
                click(968, 950); // 【DEBUG】此处可以添加动态检测逻辑
            }
        }

        async strategyZero() {

            while (true) { // 主要循环
                // 选择手牌开始【DEBUG】需要加入手牌选择功能
                await this.waitStartingHand();
                // 选择出战角色界面
                await this.waitChoice();
                // 检测对局结束【DEBUG】结束条件检测（成功或者失败添加不同条件）
                if (await isUiFinish(false) !== "none") break;
                // 重投骰子
                await this.waitReroll();
                // 识别当前回合归属
                let turnStatus = await getActingTurn(false);
                // 回合动作
                if (turnStatus === "user") { // 我方回合
                    await sleep(100); // test
                    // 本回合行动标志
                    let continueFlag = true;
                    // 获取牌桌信息
                    await this.TcgGame.get_state();
                    await this.TcgGame.log_info();
                    // 获取骰子信息
                    this.diceMsg = await getDiceMsg();
                    let diceNum = Object.values(this.diceMsg).reduce((acc, current) => acc + current, 0);
                    // 检测元素骰是否充足 【DEBUG】此处也要考虑敌方骰子数量
                    if (diceNum <= 1) {
                        log.info("元素骰子不足，结束回合");
                        // 结束回合
                        await terminateTurn();
                        continutFlag = false;
                    }
                    // 获取手牌信息【DEBUG】暂时无用，手牌部分仅手牌数量有用
                    // // 【DEBUG】目前暂时为烧牌，后续改进通过结合Action类进行牌型分析后打出有效手牌
                    // let handMsg = await getHandMsg(await getHandNum());

                    // 我方回合行动策略【主要部分】------------------------------------------------《>>|*|<<》
                    // 此处敌方出战角色的元素附着状态，血量和我方出战角色血量已知

                    // 【开局策略】【附着元素，防止自身被附着元素】

                    // 【猛攻策略】【释放元素爆发】检测充能和敌方附着

                    // 【策略1】【防御：应对敌方充能满】

                    if (this.TcgGame.enemyCharge[this.TcgGame.enemyMainCardId][1] === 0 && continueFlag) { // 敌方出战卡牌的未充能数为0【满充能】
                        log.info("敌方出战角色牌充能已满，通过切人应对");
                        if (this.TcgGame.userHp[this.TcgGame.userMainCardId] <= 3) { // 血量过低
                            // 切人
                            // 计算元素影响
                            let switchList = [];
                            await this.TcgGame.calculateEachReactionEffect("user");
                            for (const [id, measure] of Object.entries(this.TcgGame.effectDic)) {
                                switchList.push(this.TcgGame.userHp[id] - measure);
                            }
                            // 获取最大值
                            const maxValue = Math.max(...switchList);
                            // 找到最大值的索引
                            const maxIndex = switchList.indexOf(maxValue);
                            // 如果最优角色牌不是出战角色就切人
                            if (this.TcgGame.userMainCardId !== maxIndex) {
                                await switchCard(maxIndex);
                                continueFlag = false;
                            }

                        } else { // 血量充足，检测元素反应
                            // 计算元素影响
                            await this.TcgGame.calculateEachReactionEffect("user");
                            let switch_flag = false;
                            for (const [name, msg] of Object.entries(elementReaction_dic)) {
                                if (switch_flag) break;
                                if (this.TcgGame.userState[this.TcgGame.userMainCardId].includes(name)) { // 被附着了可以发生元素反应的元素
                                    for (const [cn_name, en_name] of Object.entries(element_dic)) {
                                        if (this.TcgGame.enemyCards[this.TcgGame.enemyMainCardId]["object"].element.includes(cn_name)) { // 找到敌方出战卡牌元素的英文字符串
                                            if (Object.keys(msg).includes(en_name)) { // 如果可以发生元素反应
                                                // 切人
                                                // 计算最优出战角色
                                                // 获取最小值
                                                const minValue = Math.min(...Object.values(this.TcgGame.effectDic));
                                                // 找到最小值的索引
                                                const minIndex = Object.values(this.TcgGame.effectDic).indexOf(minValue);
                                                // 如果最优角色不是出战角色
                                                if (this.userMainCardId !== minIndex) {
                                                    await switchCard(minIndex);
                                                }
                                                switch_flag = true;
                                                continueFlag = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        // 【策略2】【利用敌方已有附着触发反应】
                        // 敌方存在元素附着并且元素骰子大于等于3【DEBUG】骰子不一定要大于等于3，需要加一个实时判断，也需要一个手牌数判断
                    }
                    if (Object.keys(this.TcgGame.enemyState[this.TcgGame.enemyMainCardId]).length !== 0 && diceNum >= 3 && continueFlag) {
                        log.info("敌方出战角色具有元素附着，利用敌方已有附着触发反应");
                        let enemyElement = "";
                        let userElement = "";
                        if (this.TcgGame.enemyState[this.TcgGame.enemyMainCardId].length !== 0 ) enemyElement = this.TcgGame.enemyState[this.TcgGame.enemyMainCardId][0];
                        for (const [cn_name, en_name] of Object.entries(element_dic)) {
                            if (this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].element.includes(cn_name)) {
                                userElement = en_name;
                                break;
                            }
                        }
                        log.info(`${enemyElement}|${userElement}`);
                        if (enemyElement && Object.keys(elementReaction_dic[enemyElement]).includes(userElement)) { // 可以触发元素反应
                            // 我方角色释放技能（元素调和）
                            // // 1.获取骰子信息
                            // let this.diceMsg = await getDiceMsg();
                            // 1.选择具备元素附着的技能
                            let skillId = 1;
                            let skillList = this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].skills;
                            for (let i = 0; i < skillList.length; i++) {
                                let currentAction = await createActionFromEffectText(skillList[i]["effect_text"]);
                                if (Object.keys(element_dic).slice(1, 8).includes(currentAction.elementType)) {
                                    skillId = i;
                                    break;
                                }
                            }
                            // 2.计算技能花费
                            let needCostDic = await calculateSkillCost(skillId, this.TcgGame, this.diceMsg);
                            if (needCostDic["isEnough"]) {
                                // 释放技能
                                await useSkill(skillId, this.TcgGame.userMainCard);
                            } else if (!needCostDic["isEnough"] && needCostDic["needNum"] !== -1) { // 骰子不满足释放要求，可通过元素调和释放
                                let currentHandNum = await getHandNum();
                                if (currentHandNum >= needCostDic["needNum"]) { // 手牌足够用来烧牌
                                    await elementalTuning(needCostDic["needNum"]);
                                    await useSkill(skillId, this.TcgGame.userMainCard);
                                    continueFlag = false;
                                }
                            } else if (!needCostDic["isEnough"] && needCostDic["needNum"] === -1) { // 骰子不足无法释放
                                await sleep(200);
                            }
                        }
                        // 【策略3】【主动给敌方附上元素，需要至少有两个元素骰】
                    }
                    if (this.TcgGame.enemyState[this.TcgGame.enemyMainCardId].length === 0 && diceNum > 2 && continueFlag) {
                        log.info("敌方出战卡牌未附有元素，主动给敌方附上元素")
                        // 选择具备元素附着的技能
                        let skillId = 0;
                        let skillList = this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].skills;
                        for (let i = 0; i < skillList.length; i++) {
                            let currentAction = await createActionFromEffectText(skillList[i]["effect_text"]);
                            if (currentAction.elementType.includes(Object.keys(element_dic).slice(1, 8))) {
                                skillId = i;
                                break;
                            }
                        }
                        // 我方角色释放技能（元素调和）
                        let needCostDic = await calculateSkillCost(skillId, this.TcgGame, this.diceMsg);
                        if (needCostDic["isEnough"]) {
                            // 释放技能
                            await useSkill(skillId, this.TcgGame.userMainCard);
                        } else if (!needCostDic["isEnough"] && needCostDic["needNum"] !== -1) { // 骰子不满足释放要求，可通过元素调和释放
                            let currentHandNum = await getHandNum();
                            if (currentHandNum >= needCostDic["needNum"]) { // 手牌足够用来烧牌
                                await elementalTuning(needCostDic["needNum"]);
                                await useSkill(skillId, this.TcgGame.userMainCard);
                            }
                        } else if (!needCostDic["isEnough"] && needCostDic["needNum"] === -1) { // 骰子不足无法释放【DEBUG】这里加了切人逻辑
                            // 计算元素影响
                            let switchList = [];
                            await this.TcgGame.calculateEachReactionEffect("user");
                            for (const [id, measure] of Object.entries(this.TcgGame.effectDic)) {
                                switchList.push(this.TcgGame.userHp[id] - measure);
                            }
                            // 获取最大值
                            const maxValue = Math.max(...switchList);
                            // 找到最大值的索引
                            const maxIndex = switchList.indexOf(maxValue);
                            // 如果最优角色牌不是出战角色就切人
                            if (this.userMainCardId !== maxIndex) {
                                await switchCard(maxIndex);
                            } else { // 如果是出战角色就结束回合
                                await terminateTurn();
                            }

                        }
                    } else { // 【DEBUG】有待检验，切换条件不应为只是检测敌方而应该是我方
                        log.warn("执行备用策略");
                        if (diceNum < 3 && diceNum > 0) { // 测试用，可用性待验证【DEBUG】此处的可能情境为元素骰子不足
                            log.info(`${diceNum}`);
                            // 如果敌方出战角色牌血量不是最低的，换我方血量最高的【DEBUG】优先换我方元素附着为对方出战角色元素的高血量牌
                            if (this.TcgGame.enemyHp[this.TcgGame.enemyMainCardId] > Math.min(...Object.values(this.TcgGame.enemyHp))) {
                                log.info("敌方出战角色牌血量较高，切换我方血量最高的角色牌出战");
                                for (const [id, hp] of Object.entries(this.TcgGame.userHp)) {
                                    if (hp === Math.max(...Object.values(this.TcgGame.userHp))) {
                                        if (this.TcgGame.userMainCardId === id) { // 如果要切换的角色为出战角色
                                            break;
                                        } else {
                                            await switchCard(id);
                                            continueFlag = false;
                                            break;
                                        }
                                    }
                                }
                                // 如果我方出战角色牌血量最低，换下一位角色牌为出战角色【DEBUG】，最好是换血量第二低的角色牌，且我方骰子数需要至少为1(这点应该满足)
                            } else if (this.TcgGame.userHp[this.TcgGame.userMainCardId] === Math.min(...Object.values(this.TcgGame.userHp))) {
                                log.info("我方出战角色牌血量最低，切换下一个角色牌出战");
                                await switchCard((this.TcgGame.userMainCardId + 1) % 3);
                                continueFlag = false;
                            }
                        }
                        await sleep(1000);
                    }
                    // 【策略4】【备选输出[条件可以是元素相同的时候释放或者元素吊着数量大于2时释放]】普通攻击

                    await sleep(5000);

                } else if (turnStatus === "enemy") { // 敌方回合
                    await sleep(500);
                } else {
                    click(960, 540);
                    await sleep(500);
                }
            }
        }

        async strategyOne() {
            while (true) { // 主要循环
                // 选择手牌开始【DEBUG】需要加入手牌选择功能
                await this.waitStartingHand();
                // 选择出战角色界面
                await this.waitChoice();
                // 检测对局结束【DEBUG】结束条件检测（成功或者失败添加不同条件）
                if (await isUiFinish(false) !== "none") break;
                // 重投骰子
                await this.waitReroll();
                // 识别当前回合归属
                let turnStatus = await getActingTurn(false);
                // 回合动作
                if (turnStatus === "user") { // 我方回合
                    // 获取牌桌信息
                    await this.TcgGame.get_state();
                    await this.TcgGame.log_info();
                    // 获取骰子信息
                    this.diceMsg = await getDiceMsg();
                    let diceNum = Object.values(this.diceMsg).reduce((acc, current) => acc + current, 0);
                    // 获取手牌数量
                    let currentHandNum = await getHandNum();
                    // 计算元素影响
                    this.TcgGame.calculateEachReactionEffect("user");
                    // 计算元素影响后的我方角色牌剩余血量
                    let restHpDic = {};
                    log.info(`[DEBUG] 我方当前血量 ${Object.keys(this.TcgGame.userHp)} | ${Object.values(this.TcgGame.userHp)}`);
                    for (const [id, num] of Object.entries(this.TcgGame.userHp)) {
                        restHpDic[id] = num - this.TcgGame.effectDic[id];
                    }
                    log.info(`[DEBUG] 我方元素影响后剩余血量预测 ${Object.keys(restHpDic)} | ${Object.values(restHpDic)}`);
                    // 声明技能消耗字典，以免重复声明
                    let costDic;

                    if (diceNum <= 1) {
                        // 我方骰子数小于等于1 结束回合
                        await terminateTurn();
                        log.info(`骰子数(${diceNum})小于等于1，结束回合`);
                    } else if (this.TcgGame.userCharge[this.TcgGame.userMainCardId][1] === 0){
                        // 我方出战角色充能已满
                        log.info(`我方出战角色(${this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name})充能已满(${this.TcgGame.userCharge[this.TcgGame.userMainCardId][0]}/${this.TcgGame.userCharge[this.TcgGame.userMainCardId][0]+ this.TcgGame.userCharge[this.TcgGame.userMainCardId][1]})`);
                        let skillList = this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].skills;
                        let skillId;
                        for (let i = 0; i < skillList.length; i++) {
                            if (skillList[i]["type"] === "元素爆发") {
                                skillId = skillList[i]["id"];
                                break;
                            }
                        }
                        let costDic = await calculateSkillCost(skillId, this.TcgGame, this.diceMsg);
                        log.info(`[DEBUG] 元素爆发需求字典 ${costDic["isEnough"]} | ${costDic["needNum"]}`);
                        if (costDic["isEnough"]) { // 满足元素爆发释放条件
                            await useSkill(skillId, this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                        } else if (costDic["needNum"] === -1) { // 不满足元素爆发释放条件，且无法通过元素调和的方式释放元素爆发
                            // 切换我方受对方元素影响最低的角色(如果切换的是当前角色，释放普攻) 【DEBUG】应当灵活检测，根据需要选择释放元素战技还是普攻
                            // 1.切换到指定角色牌
                            let switchId = Object.values(restHpDic).indexOf(Math.max(...Object.values(restHpDic)));
                            // 2.根据切牌条件细化选择
                            if (switchId !== this.TcgGame.userMainCardId && this.TcgGame.userHp[switchId] >= 0) { // 若要切换的角色不为当前出战角色且要切换的角色牌血量大于等于0
                                await switchCard(switchId);
                            } else { // 当前出战角色释放普攻
                                // 计算普攻的消耗
                                costDic = await calculateSkillCost(0, this.TcgGame, this.diceMsg);
                                if (costDic["isEnough"]) { // 如果能释放普攻就释放普攻
                                    await useSkill(0, this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                } else if (costDic["needNum"] === -1) { // 不满足普攻释放条件，且无法通过元素调和的方式释放普攻
                                    // 结束当前回合【DEBUG】很极端的一种情况，尚待测试
                                    await terminateTurn();
                                } else { // 元素调和后释放普攻
                                    await elementalTuning(costDic["needNum"]);
                                    await useSkill(0, this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                }
                            }
                        } else { // 通过元素调和释放元素爆发
                            await elementalTuning(costDic["needNum"]);
                            await useSkill(skillId, this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                        }
                    } else if (restHpDic[this.TcgGame.userMainCardId] > 0) {
                        // 我方出战角色经元素反应检测后剩余血量大于0
                        if (this.TcgGame.enemyState[this.TcgGame.enemyMainCardId].length !== 0) { // 敌方出战角色附有元素
                            let userElement;
                            for (const [cn_name, en_name] of Object.entries(element_dic)) {
                                if (this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].element.includes(cn_name)) {
                                    userElement = en_name;
                                    break;
                                }
                            }

                            let currentReactionDic = elementReaction_dic[this.TcgGame.enemyState[this.TcgGame.enemyMainCardId][0]][userElement];
                            let skills = this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].skills

                            if (currentReactionDic["increase"] !== 0 || currentReactionDic["others"]["damage"] !== 0) { // 我方出战角色元素可以与敌方出战角色的附着元素发生反应
                                // 释放元素战技
                                for (let i = 0; i <skills.length; i++) {
                                    if (skills[i]["type"] === "元素战技") {
                                        // 计算消耗
                                        costDic = await calculateSkillCost(skills[i]["id"], this.TcgGame, this.diceMsg);
                                        if (costDic["isEnough"]) { // 如果能释放就释放
                                            await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                        } else if (costDic["needNum"] === -1) { // 不满足释放条件，且无法通过元素调和的方式释放
                                            // 结束当前回合【DEBUG】很极端的一种情况，尚待测试
                                            await terminateTurn();
                                        } else { // 元素调和后释放
                                            await elementalTuning(costDic["needNum"]);
                                            await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                        }
                                        break;
                                    }
                                }
                            } else {
                                if (this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].weapon === "法器") { // 我方出战角色为法器角色
                                // 释放元素战技
                                    for (let i = 0; i <skills.length; i++) {
                                        if (skills[i]["type"] === "元素战技") {
                                            // 计算消耗
                                            costDic = await calculateSkillCost(skills[i]["id"], this.TcgGame, this.diceMsg);
                                            if (costDic["isEnough"]) { // 如果能释放就释放
                                                await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                            } else if (costDic["needNum"] === -1) { // 不满足释放条件，且无法通过元素调和的方式释放
                                                // 结束当前回合【DEBUG】很极端的一种情况，尚待测试
                                                await terminateTurn();
                                            } else { // 元素调和后释放
                                                await elementalTuning(costDic["needNum"]);
                                                await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                            }
                                            break;
                                        }
                                    }
                                } else {
                                    // 释放普攻
                                    // 计算普攻的消耗
                                    costDic = await calculateSkillCost(0, this.TcgGame, this.diceMsg);
                                    if (costDic["isEnough"]) { // 如果能释放普攻就释放普攻
                                        await useSkill(0, this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                    } else if (costDic["needNum"] === -1) { // 不满足普攻释放条件，且无法通过元素调和的方式释放普攻
                                        // 结束当前回合【DEBUG】很极端的一种情况，尚待测试
                                        await terminateTurn();
                                    } else { // 元素调和后释放普攻
                                        await elementalTuning(costDic["needNum"]);
                                        await useSkill(0, this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                    }
                                }

                            }
                        } else { // 我方出战角色使用附带元素附着的攻击(优先技能，避免使用元素爆发)
                            log.info(`[DEBUG] 待释放技能所需元素骰子详情: ${this.TcgGame.userCards[this.TcgGame.userMainCardId]["name"]}|${this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name}`);
                            let skills = this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].skills;
                            for (let i = 0; i < skills.length; i++) {
                                if (skills[i]["type"] !== "元素爆发" && skills[i]["effect_text"].includes("元素")) {
                                    // 计算技能释放条件
                                    costDic = await calculateSkillCost(skills[i]["id"], this.TcgGame, this.diceMsg);
                                    if (costDic["isEnough"]) {
                                        await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                    } else if (costDic["needNum"] === -1) {
                                        await terminateTurn();
                                    } else {
                                        await elementalTuning(costDic["needNum"]);
                                        await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                    }
                                    break;
                                }
                            }
                        }
                    } else if (restHpDic[this.TcgGame.userMainCardId] <= 0) {
                        // 我方出战角色经元素反应检测后剩余血量小于等于0
                        this.TcgGame.calculateEachReactionEffect("enemy"); // 计算敌方受到我方的元素影响
                        if (this.TcgGame.enemyHp[this.TcgGame.enemyMainCardId] - this.TcgGame.effectDic[this.TcgGame.enemyMainCardId] <= 0) { // 敌方出战角色经元素反应检测后血量小于等于0
                            let skills = this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].skills
                            // 释放元素战技
                            for (let i = 0; i <skills.length; i++) {
                                if (skills[i]["type"] === "元素战技") {
                                    // 计算消耗
                                    costDic = await calculateSkillCost(skills[i]["id"], this.TcgGame, this.diceMsg);
                                    if (costDic["isEnough"]) { // 如果能释放就释放
                                        await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                    } else if (costDic["needNum"] === -1) { // 不满足释放条件，且无法通过元素调和的方式释放
                                        // 结束当前回合【DEBUG】很极端的一种情况，尚待测试
                                        await terminateTurn();
                                    } else { // 元素调和后释放
                                        await elementalTuning(costDic["needNum"]);
                                        await useSkill(skills[i]["id"], this.TcgGame.userCards[this.TcgGame.userMainCardId]["object"].name);
                                    }
                                    break;
                                }
                            }
                        } else {
                            await switchCard(Object.values(restHpDic).indexOf(Math.max(...Object.values(restHpDic))));
                        }
                    } else { // 理论上不可能执行该步骤
                        log.error("策略执行异常，结束回合");
                        await terminateTurn();
                    }
                } else if (turnStatus === "enemy") { // 敌方回合
                    click(960, 540);
                    await sleep(1000);
                } else {
                    click(1873, 47);
                    await sleep(1500);
                }
                await sleep(2000);
            }
        }

        /**
         * 策略模板
         */
        async strategySerial() {
            while (true) { // 主要循环
                // 选择手牌开始【DEBUG】需要加入手牌选择功能
                await this.waitStartingHand();
                // 选择出战角色界面
                await this.waitChoice();
                // 检测对局结束【DEBUG】结束条件检测（成功或者失败添加不同条件）
                if (await isUiFinish(false) !== "none") break;
                // 重投骰子
                await this.waitReroll();
                // 识别当前回合归属
                let turnStatus = await getActingTurn(false);
                // 回合动作
                if (turnStatus === "user") { // 我方回合
                    // 获取牌桌信息
                    await this.TcgGame.get_state();
                    await this.TcgGame.log_info();
                    // 获取骰子信息
                    this.diceMsg = await getDiceMsg();
                    // 获取手牌数量
                    let currentHandNum = await getHandNum();
                    // 计算元素影响
                    this.TcgGame.calculateEachReactionEffect("user");
                    // 计算元素影响后的我方角色牌剩余血量
                    let restHpDic = {};
                    for (const [id, num] of Object.entries(this.TcgGame.userHp)) {
                        restHpDic[id] = num - this.TcgGame.effectDic[id];
                    }
                    let diceNum = Object.values(this.diceMsg).reduce((acc, current) => acc + current, 0);
                    log.info("此为模板策略，不可使用，仅供CV，使用时删除此行，回合动作从此行开始");
                } else if (turnStatus === "enemy") { // 敌方回合
                    await sleep(500);
                } else {
                    click(960, 540);
                    await sleep(500);
                }
            }
        }
    }

    /**
     * 供 findClosestMatch 调用
     */
    function levenshteinDistance(a, b) {
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
     * 查找最相似的字符串（用于查找角色牌，最大限度避免OCR偏差导致的异常）
     *
     * @param target 目标字符串
     * @param candidates 字符串数组
     * @returns {null}
     */
    function findClosestMatch(target, candidates) {
        let closest = null;
        let minDistance = Infinity;
        for (const candidate of candidates) {
            const distance = levenshteinDistance(target, candidate);
            if (distance < minDistance) {
                minDistance = distance;
                closest = candidate;
            }
        }
        return closest;
    }

    /**
     *
     * 根据卡牌名返回实例化的卡牌类
     *
     * @param card_name 卡牌名称
     * @returns {Promise<CharacterCard|SummonCard|Card|ActionCard>} 实例化的卡牌类
     */
    async function createCardFromDict(card_name) {
        // 【DEBUG】新逻辑，仍需检验，使用 Levenshtein 距离衡量两个字符串，选择最相似的角色牌名称[但是在Game的log_info()显示的仍为OCR内容，ocr识别错误的情况下日志会输出错误的卡牌名称]
        card_name = findClosestMatch(card_name, Object.keys(card_dic));
        if (Object.keys(card_dic).includes(card_name)) { // 存在该卡牌
            if (card_dic[card_name]["type"] === "角色牌") {
                return new CharacterCard({
                    name: card_name,
                    full_name: card_dic[card_name]["full_name"],
                    health: card_dic[card_name]["health"],
                    element: card_dic[card_name]["element"],
                    charge: card_dic[card_name]["charge"],
                    weapon: card_dic[card_name]["weapon"],
                    team: card_dic[card_name]["team"],
                    means: card_dic[card_name]["means"],
                    skills: card_dic[card_name]["skills"],
                    children: card_dic[card_name]["children"]
                });
            } else if (card_dic[card_name]["type"] === "附属牌") { // ctype为召唤物cost为空，ctype为特技有cost
                return new SummonCard({
                    name: card_name,
                    ctype: card_dic[card_name]["type"],
                    effect_text: card_dic[card_name]["effect_text"],
                    cost: card_dic[card_name]["cost"]
                });
            } else if (card_dic[card_name]["type"] === "行动牌") {
                return new ActionCard({
                    name: card_name,
                    ctype: card_dic[card_name]["ctype"],
                    label: card_dic[card_name]["label"],
                    means: card_dic[card_name]["means"],
                    cost: card_dic[card_name]["cost"],
                    effect_text: card_dic[card_name]["effect_text"]
                });
            } else if (card_dic[card_name]["type"] === "魔物牌") {
                return new CharacterCard({
                    name: card_name,
                    health: card_dic[card_name]["health"],
                    element: card_dic[card_name]["element"],
                    charge: card_dic[card_name]["charge"],
                    weapon: card_dic[card_name]["weapon"],
                    team: card_dic[card_name]["team"],
                    means: card_dic[card_name]["means"],
                    skills: card_dic[card_name]["skills"]
                });
            }
        } else { // 不存在该卡牌
            return new Card(card_name, "无");
        }
    }

    /**
     *
     * 从卡牌的effect_text解析出相关的Action
     *
     * @param {string} effectText 卡牌的技能描述文本effect_text
     * @returns {Promise<Action>}
     */
    function createActionFromEffectText(effectText) {
        let dealDamage, instantDamage, clickTwice, damage, residueDegree, consumption, effectType, elementType, targetType, specialEffect;
        // const regexFull = /造成(\d+)点([\u4e00-\u9fa5]+)伤害/;
        let healFlag = false; // 标记攻击类型为治疗
        const regexFull = /(?<=造成)[\s\S]*?(?=伤害)/;
        const regexHeal = /(?<=治疗)[^点]*?点/;
        const regexDamage = /(\d+)(?=点)/;
        let match = effectText.match(regexFull);
        let matchHeal = effectText.match(regexHeal);
        if (!match && matchHeal) {
            healFlag = true;
            match = matchHeal;
        }

        // dealDamage 是否造成伤害
        if (match) dealDamage = true;
        // instantDamage 是否是即时伤害 【DEBUG】逻辑有待完善
        if (effectText.includes("回合开始时：") || effectText.includes("结束阶段：")) {
            instantDamage = false;
        } else {
            instantDamage = true;
        }
        // clickTwice 是否需要二次点击 【DEBUG】难以实现，需要结合读取选择的卡牌类型，现阶段解决方法为融牌[未实现]
        clickTwice = false;

        // damage 伤害
        if (match && match[0].includes("点")) {
            damage = healFlag ? -1 * parseInt(match[0].match(regexDamage)[0], 10): parseInt(match[0].match(regexDamage)[0], 10);
        } else {
            damage = 0;
        }
        // residueDegree 剩余次数 【DEBUG】性价比不高且较难实现，暂时搁置
        residueDegree = 0;
        // consumption 生效后减少的可用次数 【DEBUG】性价比不高且较难实现，暂时搁置
        consumption = 0;

        // effectType 生效类型 【DEBUG】测试功能，优先实现
        effectType = "";
        // elementType 元素类型(元素附着) 【DEBUG】仅判断造成伤害时的元素附着
        elementType = "None";
        if (match) {
            for (const [sname, name] of Object.entries(element_dic)) {
                if (match[0].includes(sname)) {
                    elementType = element_dic[sname];
                    break;
                }
            }
        }

        // targetType 目标 【DEBUG】测试功能，优先实现
        targetType = "";
        // specialEffect 特殊效果 【DEBUG】测试功能，优先实现
        specialEffect = "";
        return new Action(dealDamage, instantDamage, clickTwice, damage, residueDegree, consumption, effectType, elementType, targetType, specialEffect);
    }

    /**
     *
     * 读取并解析本地的卡牌信息(assets/card_dic.json)
     *
     * @returns {Promise<any|null>}
     */
    async function parseCardData() {
        const text = file.readTextSync("assets/card_dic.json");
        try {
            // 解析 JSON 字符串为对象
            let parsedObject = JSON.parse(text);
            return parsedObject;
        } catch (error) {
            console.error("解析失败:", error);
            return null;
        }
    }

    /**
     *
     * 判断当前界面是否为初始手牌界面
     *
     * @returns {Promise<boolean>}
     */
    async function isUiStartingHand(moveMouse = true) {
        const ocrRo = RecognitionObject.Ocr(844, 167, 232, 65);

        if (moveMouse) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        }
        await sleep(200);
        const ro1 = captureGameRegion();
        let ocr = ro1.Find(ocrRo); // 当前页面OCR
        ro1.dispose();
        if (ocr.isExist() && ocr.text === "初始手牌") {
            return true;
        } else {
            return false;
        }
    }

    /**
     *
     * 判断当前界面是否为重投骰子界面
     *
     * @returns {Promise<boolean>}
     */
    async function isUiReroll(moveMouse = true) {
        const ocrRo = RecognitionObject.Ocr(844, 167, 232, 65);

        if (moveMouse) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        }
        await sleep(200);
        const ro2 = captureGameRegion();
        let ocr = ro2.Find(ocrRo); // 当前页面OCR
        ro2.dispose();
        if (ocr.isExist() && ocr.text === "重投骰子") {
            return true;
        } else {
            return false;
        }
    }

    /**
     *
     * 判断当前界面是否为出战角色选择界面【首次选择】【DEBUG】
     *
     * @returns {Promise<boolean>}
     */
    async function isUiChoice(moveMouse = true) {
        const ocrRo = RecognitionObject.Ocr(1766, 851, 117, 37);

        if (moveMouse) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        }
        await sleep(200);
        const ro3 = captureGameRegion();
        let ocr = ro3.Find(ocrRo); // 当前页面OCR
        ro3.dispose();
        if (ocr.isExist() && ocr.text === "出战角色") {
            return true;
        } else {
            return false;
        }
    }

    /**
     *
     * 判断当前界面是否为结束界面
     *
     * @returns {Promise<string>}
     */
    async function isUiFinish(moveMouse = true) {
        const ocrRo = RecognitionObject.Ocr(763, 101, 394, 381);

        if (moveMouse) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        }
        await sleep(200);
        const ro4 = captureGameRegion();
        let ocr = ro4.Find(ocrRo); // 当前页面OCR
        ro4.dispose();
        if (ocr.isExist() && ocr.text.includes("对局胜利")) {
            return "win";
        } else if (ocr.isExist() && ocr.text.includes("对局失败")){
            return "lose";
        } else { // 不是结束界面
            return "none";
        }
    }

    /**
     *
     * 判断当前界面是否为对局界面
     *
     * @returns {Promise<boolean>}
     */
    async function isUiMain(moveMouse = true) {
        const slide_barRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic["setting"]), 1834, 15, 66, 66);

        if (moveMouse) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        }
        await sleep(100);
        const ro5 = captureGameRegion();
        let slide_bar = ro5.Find(slide_barRo); // 当前页面模板匹配
        ro5.dispose();
        if (slide_bar.isExist()) {
            return true;
        } else {
            return false;
        }
    }

    /**
     *
     * OCR识别当前点开的卡详情的卡名
     *
     * @param mode 决定卡名的位置（例如初始手牌的卡详情和局内的卡详情位置不同）
     * @returns {Promise<*|boolean>} 识别成功返回字符串，否则返回false
     */
    async function ocrCardName(mode="main") {
        const ocrRo_StartingHand = RecognitionObject.Ocr(58, 112, 339, 53);
        const ocrRo_Main = RecognitionObject.Ocr(311, 115, 341, 50);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(10);
        const ro6 = captureGameRegion();
        let ocr;
        if (mode === "StartingHand") {
            ocr = ro6.Find(ocrRo_StartingHand); // 当前页面OCR
        } else if (mode === "main") {
            ocr = ro6.Find(ocrRo_Main); // 当前页面OCR
        }
        ro6.dispose();
        if (ocr.isExist()) {
            return ocr.text;
        } else {
            return false;
        }
    }

    /**
     *
     * 获取当前的骰子类型和数量(自动识别对局界面和投掷界面)，
     *
     * @param keepDice 要保留的骰子（投掷界面生效）
     * @param threshold 模板匹配容差（实测0.85-0.9较为准确）
     * @returns {Promise<void>}
     */
    async function getDiceMsg(keepDice = [], threshold = 0.85) {
        let dice_dic = {};
        const diceNames = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo", "Omni"];
        let region, keyPrefix;

        if (await isUiReroll()) {
            region = { x: 553, y: 330, w: 819, h: 411 };
            keyPrefix = "Roll";
        } else if (await isUiMain()) {
            region = { x: 1848, y: 177, w: 38, h: 737 };
            keyPrefix = "Main";
        } else {
            log.error(`当前界面错误，无法识别骰子信息...`);
            return false;
        }

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
        await sleep(100);
        let gameRegion = captureGameRegion(); // 捕获一次游戏区域，避免重复调用

        for (let i = 0; i < diceNames.length; i++) {
            let name = diceNames[i];
            const key = keyPrefix + name;
            let diceRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic[key]), region.x, region.y, region.w, region.h);
            diceRo.threshold = threshold;
            let dice = gameRegion.FindMulti(diceRo);
            if (dice.count !== 0) {
                dice_dic[name] = dice.count;
            }
            if (keepDice.length !== 0 && !(keepDice.includes(name)) && dice.count !== 0) { // 排除不保留的骰子
                for (let j = 0; j < dice.count; j++) {
                    await sleep(200);
                    dice[j].Click();
                }
            }
        }
        gameRegion.dispose();
        log.info(`[DEBUG] 剩余元素骰: ${Object.keys(dice_dic)} | ${Object.values(dice_dic)}`);
        return dice_dic;
    }

    /**
     *
     * 识别当前手牌数量(需要位于对局界面)
     *
     * @returns {Promise<void>}
     */
    async function getHandNum() {
        const HandNumNames = ["Hand5", "Hand6", "Hand7", "Hand8", "Hand9", "Hand10"];
        click(967, 1041); // 点击手牌区域
        await sleep(600); // 等待手牌统计数字出现

        moveMouseTo(1791, 917); // 移走鼠标，防止干扰识别
        await sleep(100);
        let gameRegion = captureGameRegion(); // 捕获一次游戏区域
        for (let i = 0; i < HandNumNames.length; i++) {
            let numRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic[HandNumNames[i]]), 1463, 700, 439, 124);
            let num = gameRegion.Find(numRo);
            gameRegion.dispose();
            if (num.isExist()) return parseInt(HandNumNames[i].slice(4), 10);
        }

        // 4
        click(776, 920);
        await sleep(200);
        if (await ocrCardName() !== false) return 4;
        await sleep(500);
        click(967, 1041); // 点击手牌区域
        await sleep(200);
        // 3
        click(859, 920);
        await sleep(200);
        if (await ocrCardName() !== false) return 3;
        await sleep(500);
        click(967, 1041); // 点击手牌区域
        await sleep(200);
        // 2
        click(965, 920);
        await sleep(200);
        if (await ocrCardName() !== false) return 2;
        await sleep(500);
        click(967, 1041); // 点击手牌区域
        await sleep(200);
        // 1
        click(1061, 920);
        await sleep(200);
        if (await ocrCardName() !== false) return 1;
        // 0
        click(1190, 545); // 点击屏幕中间靠右复位
        return 0;
    }

    /**
     *
     * 识别手牌的具体信息
     *
     * @param total 手牌总数
     * @param extraWaitTime 额外等待时间
     * @returns {Promise<void>}
     */
    async function getHandMsg(total, extraWaitTime = 0) {
        const waitTime = 100 + extraWaitTime;
        let HandMsgDic = {};

        // 点击屏幕中间复位
        click(1190, 545); // 点击屏幕中间靠右复位
        await sleep(waitTime);
        // 点击手牌区域
        click(967, 1041);
        await sleep(waitTime);
        for (const [serial, pos] of Object.entries(stateHand_dic[total])) {
            click(pos[0], pos[1]);
            await sleep(waitTime);
            let card_name = await ocrCardName();
            // 实例化该牌的类并添加到字典
            HandMsgDic[serial] = await createCardFromDict(card_name);
        }
        return HandMsgDic;
    }

    /**
     * 选择出战卡牌（切换出战卡牌）
     *
     * @param card_name 要切换的卡牌名
     * @returns {Promise<void>}
     */
    async function setActiveCard(card_name, extraWaitTime = 0) {
        const waitTime = 100 + extraWaitTime;
        // 定义下方的两个点击坐标
        const coords = [
            { x: 750, y: 720 }, // 1
            { x: 960, y: 720 }, // 2
            { x: 1175, y: 720 } // 3
        ];

        // 循环 3 次，依次点击不同的坐标（不足时取余）
        for (let i = 0; i < 3; i++) {
            const { x, y } = coords[i % coords.length];
            click(x, y);
            await sleep(waitTime);
            if (await ocrCardName() === card_name) {
                click(1825, 960);
                await sleep(500); // 局内切换（使用默认元素）
                click(1825, 960); // 局内切换（使用默认元素）
                // 如果满足条件则可以选择跳出循环
                break;
            }
        }
    }

    /**
     *
     * 判断当前为哪方的行动回合
     *
     * @param moveMouse 是否移开鼠标（防止模板匹配受影响）
     * @returns {Promise<void>} 预期三种返回，我方，敌方，无
     */
    async function getActingTurn(moveMouse = true) {
        let userRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic["userTurn"]), 64, 518, 33, 42);
        let enemyRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic["enemyTurn"]), 64, 518, 33, 42);

        if (moveMouse) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        }
        let gameRegion = captureGameRegion(); // 捕获一次游戏区域
        let userTurn = gameRegion.Find(userRo);
        let enemyTurn = gameRegion.Find(enemyRo);
        gameRegion.dispose();
        if (userTurn.isExist()) {
            return "user";
        } else if (enemyTurn.isExist()) {
            return "enemy";
        } else {
            return "none";
        }
    }

    /**
     *
     * 获取单张角色牌的充能情况
     *
     * @param target 识别的卡牌所处的阵营（我方user，敌方enemy）
     * @param serial 卡牌的序号（从1开始，从左到右）
     * @param total 该阵营牌桌上角色牌总数
     * @param gameRegion 传入的游戏截图
     * @returns {Promise<*[]>} [充能数，未充能数]
     */
    async function getCharge(target, serial, total, gameRegion, threshold = 0.7) {
        let target_msg = `${target}${total}${serial}`; // 目标卡牌信息，例如：enemy31, enemy42, user32
        let charge, uncharge;
        let width = chargeArea_dic["size"][0];
        let height = chargeArea_dic["size"][1];
        for (const [name, pos] of Object.entries(chargeArea_dic)) {
            if (name === target_msg) {
                let chargeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic["charge"]), pos[0], pos[1], width, height);
                let unchargeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic["uncharge"]), pos[0], pos[1], width, height);
                chargeRo.threshold = threshold
                unchargeRo.threshold = threshold
                let charge = gameRegion.FindMulti(chargeRo);
                let uncharge = gameRegion.FindMulti(unchargeRo);
                return [charge.count, uncharge.count]; // [充能数，未充能数]
            }
        }
    }

    /**
     *
     * 识别角色牌血量（OCR和模板匹配），调用此方法先需要等待2s
     *
     * @param target 识别的卡牌所处的阵营（我方user，敌方enemy）
     * @param serial 卡牌的序号（从1开始，从左到右）
     * @param total 该阵营牌桌上角色牌总数
     * @param gameRegion 传入的游戏截图
     * @returns {Promise<number|boolean>}
     */
    async function getCardHp(target, serial, total, gameRegion) {
        let target_msg = `${target}${total}${serial}`; // 目标卡牌信息，例如：enemy31, enemy42, user32
        // 分别检测出战角色血量位置和未出战角色血量位置
        let ocr1Ro = RecognitionObject.Ocr(hpArea_dic[target_msg][0], hpArea_dic[target_msg][1], hpArea_dic["size"][0], hpArea_dic["size"][1]);
        let ocr2Ro = RecognitionObject.Ocr(hpArea_dic[target_msg][0], hpArea_dic[target_msg][2], hpArea_dic["size"][0], hpArea_dic["size"][1]);
        let ocr1Result = gameRegion.Find(ocr1Ro);
        let ocr2Result = gameRegion.Find(ocr2Ro);
        let hp = 0
        if (ocr1Result.isExist() || ocr2Result.isExist()) {
            try {
                hp = ocr1Result.isExist() ? parseInt(ocr1Result.text, 10): parseInt(ocr2Result.text, 10);
                return hp;
            } catch (error) {
                log.error(`角色牌: ${target_msg} 的血量OCR信息转换错误...\nmsg: ${error}`);
                return hp;
            }
        } else { // 未识别到血量信息
            let disableRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path_dic["disable"]), stateArea_dic[target_msg][0], stateArea_dic[target_msg][1], stateArea_dic["size"][0], stateArea_dic["size"][1]);
            if (gameRegion.Find(disableRo).isExist()) { // 角色牌处于阵亡状态
                return 0;
            } else { // 识别有误【DEBUG】暂且返回0，后续使用boolean
                return 0;
            }
        }

    }

    /**
     *
     * 获取单张角色牌的状态
     *
     * @param target 识别的卡牌所处的阵营（我方user，敌方enemy）
     * @param serial 卡牌的序号（从1开始，从左到右）
     * @param total 该阵营牌桌上角色牌总数
     * @param gameRegion 传入的游戏截图
     * @returns {Promise<[]>} 列表，记录每种异常状态 ["Pyro", ...]
     */
    async function getState(target, serial, total, gameRegion) {
        let target_msg = `${target}${total}${serial}`; // 目标卡牌信息，例如：enemy31, enemy42, user32
        let stateList = [];
        for (const [name, path] of Object.entries(pic_path_dic)) {
            if (name.startsWith("State")) {
                let stateRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(path), stateArea_dic[target_msg][0], stateArea_dic[target_msg][1], stateArea_dic["size"][0], stateArea_dic["size"][1]);
                let state = gameRegion.Find(stateRo);
                if (state.isExist()) stateList.push(name.slice(5));
                // if (state.isExist()) log.info(`${target_msg}|${name}`);
            }
        }
        return stateList;
    }

    /**
     *
     * 模拟鼠标拖动操作
     *
     * @param startX
     * @param startY
     * @param endX
     * @param endY
     * @param extraWaitTime 额外等待时间
     * @returns {Promise<boolean>}
     */
    async function mouseDrag(startX, startY, endX, endY, extraWaitTime = 0) {
        const durationMs = 100 + extraWaitTime;
        const events = [];
        const totalDeltaX = endX - startX;
        const totalDeltaY = endY - startY;

        // 计算总移动距离（曼哈顿距离）
        const totalDistance = Math.abs(totalDeltaX) + Math.abs(totalDeltaY);

        // 按每步最大合位移10计算步数（至少1步）
        const steps = Math.max(1, Math.ceil(totalDistance / 10));

        // 生成移动事件
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentX = startX + totalDeltaX * progress;
            const currentY = startY + totalDeltaY * progress;

            // 计算时间戳（均匀分布）
            const timestamp = Math.round((durationMs * i) / (steps + 1));

            events.push({
                type: 2,
                mouseX: Math.round(currentX),
                mouseY: Math.round(currentY),
                time: timestamp
            });
        }

        // 添加起始事件（按下）
        events.unshift({
            type: 4,
            mouseX: startX,
            mouseY: startY,
            mouseButton: "Left",
            time: 0
        });

        // 添加结束事件（抬起）
        events.push({
            type: 5,
            mouseX: endX,
            mouseY: endY,
            mouseButton: "Left",
            time: durationMs
        });

        let jsonObject = {
            macroEvents: events,
            info: {
                name: "",
                description: "",
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                recordDpi: 1.25
            }
        };
        await keyMouseScript.run(JSON.stringify(jsonObject));
        return true;
    }

    /**
     *
     * 模拟打出手牌
     *
     * @param serial 要打出的手牌序号（从1开始，从左到右）
     * @param total 手牌总数
     * @returns {Promise<boolean>}
     */
    async function dragCard(serial, total, extraWaitTime = 0) {
        let waitTime = 100 + extraWaitTime;
        // 点击屏幕中间复位
        click(1190, 545); // 点击屏幕中间靠右复位
        await sleep(waitTime);
        // 点击手牌区域
        click(967, 1041);
        let x = stateHand_dic[total][serial][0];
        let y = stateHand_dic[total][serial][1];
        await sleep(waitTime);
        // 拖动并打出手牌【DEBUG】额外选择不应在此方法内执行，应另写方法
        await mouseDrag(x, y, x, y - 350, extraWaitTime);
        return true;
    }

    /**
     *
     * 释放角色牌技能（无技能可用性判断）
     *
     * @param skill_id 技能序号（从0开始）
     * @param card_name 角色牌名称
     * @param extraWaitTime 额外等待时间
     * @returns {Promise<boolean>}
     */
    async function useSkill(skill_id, card_name, extraWaitTime = 0) {
        let waitTime = 100 + extraWaitTime;
        let skill_list = card_dic[card_name]["skills"];

        click(1190, 545); // 点击屏幕中间靠右复位
        await sleep(waitTime);
        if (skill_list.length === 3 || (skill_list.length == 4 && skill_list[3]["type"] === "被动技能")) {
           click(skillPosition_dic[skill_id + 1][0], skillPosition_dic[skill_id + 1][1]);
           await sleep(500 + waitTime);
           click(skillPosition_dic[skill_id + 1][0], skillPosition_dic[skill_id + 1][1]);
           return true;
        } else if (skill_list.length === 4) {
            click(skillPosition_dic[skill_id][0], skillPosition_dic[skill_id][1]);
            await sleep(500 + waitTime);
            click(skillPosition_dic[skill_id][0], skillPosition_dic[skill_id][1]);
            return true;
        } else {
            log.warn(`角色牌技能读取错误: ${card_name}(${skill_id})`);
            return false
        }
    }

    /**
     *
     * 判断剩余骰子是否足够释放技能，是否需要烧牌，要烧几张【DEBUG】部分角色消耗可变，后续需要加入游戏内检测
     *
     * @param skill_id 技能序号（从0开始）
     * @param game 实例化的Game类，需要含有完整的局面数据（需要提前调用Game.get_state()）
     * @param dice_dic 当前剩余的元素骰（使用getDiceMsg()获取）
     * @returns {Promise<{isEnough: boolean, needDic: {}}>}
     */
    async function calculateSkillCost(skill_id, game, dice_dic) {
        let charge = 0;
        let cost_dic = {};
        let element_type;
        let all_dice_num = 0;
        let result_dic = {
            "isEnough": true,
            "needNum": 0
        };
        // 获取角色牌的当前充能和技能消耗信息
        for (const [id, msg] of Object.entries(game.userCards)) {
            log.info(`[TEMP] ${msg["name"]} | ${game.userMainCard}`);
            if (msg["name"] === game.userMainCard) {
                charge = game.userCharge[id][0];
                log.info(`[DEBUG] 角色当前技能(${msg["object"].skills[skill_id]["name"]})(skill_id: ${skill_id})`);
                log.info(`[DEBUG] 角色牌技能信息 ${Object.keys(msg["object"].skills[skill_id]["cost"])} | ${Object.values(msg["object"].skills[skill_id]["cost"])}`)
                cost_dic = msg["object"].skills[skill_id]["cost"];
                for (const [cn_name, en_name] of Object.entries(element_dic)) {
                    if (msg["object"].element.includes(cn_name)) {
                        element_type = en_name;
                    }
                }
                break;
            }
        }
        // 获取剩余的骰子总数
        for (const [name, num] of Object.entries(dice_dic)) {
            all_dice_num += num;
        }
        if (all_dice_num < Object.values(cost_dic).reduce((a, b) => a + b, 0)) { // 如果剩余骰子数不满足要求
            result_dic["isEnough"] = false;
            result_dic["needNum"] = -1;
        } else {
            // 计算需求是否满足（遍历角色的技能需求字典）[DEBUG] 可能存在逻辑漏洞，万能元素和指定元素应当合并判断
            let all_active_dic_num = 0;
            let allNum = 0;
            log.info(`[TEMP] ${Object.keys(cost_dic)} | ${Object.values(cost_dic)}`);
            for (const [name, num] of Object.entries(cost_dic)) {
                log.info(`[DEBUG] name: ${name}`);
                if (name.includes("元素") && name !== "万能元素") { // 需求为元素骰【DEBUG】此处不检测需要什么元素，而是默认使用角色牌的元素
                    allNum += num;
                    log.info(`[DEBUG] dice_dic_keys: ${Object.keys(dice_dic)} | element_type: ${element_type}`);
                    if (Object.keys(dice_dic).includes(element_type)) { // 如果有当前角色牌所需的元素骰子
                        all_active_dic_num += dice_dic[element_type];
                    }
                    if (Object.keys(dice_dic).includes("Omni")){ // 若有万能骰子
                        all_active_dic_num += dice_dic["Omni"];
                    }
                } else if (name.includes("充能")) { // 需求为充能
                    let difference = game.userCharge[game.userMainCardId][0] - num; // 计算当前充能和需求充能的差值
                    if (difference > 0) { // 充能不足
                        result_dic["isEnough"] = false;
                        result_dic["needNum"] = -1; // 无法通过元素调和解决【DEBUG】后续可通过Action进行手牌的牌型分析解决
                    }
                }
            }
            let difference = allNum - all_active_dic_num; // 计算差值（所需元素骰和已有元素骰）
            if (difference > 0) {
                result_dic["isEnough"] = false;
                result_dic["needNum"] = difference;
            }
        }

        return result_dic;
    }

    /**
     *
     * 结束我方当前行动回合（需要处于我方回合）
     *
     * @param extraWaitTime 额外等待时间
     * @returns {Promise<void>}
     */
    async function terminateTurn(extraWaitTime = 0) {
        let waitTime = 200 + extraWaitTime;
        // let ocrRo = RecognitionObject.Ocr(274, 519, 140, 42);
        while (await getActingTurn() !== "user") { // 确保为我方回合
            await sleep(500);
        }
        click(79, 539); // 点击结束回合按钮【DEBUG】有点冗余了，后续得改改
        await sleep(500 + waitTime);
        click(79, 539); // 点击结束回合按钮
        await sleep(500 + waitTime);
        click(79, 539); // 点击结束回合按钮
        await sleep(500 + waitTime);
        click(79, 539); // 点击结束回合按钮
        return null;
        // while (true) { // 等待回合结束出现(容易失去OCR目标陷入死循环)
        //
        //     await sleep(waitTime);
        //     let ocr = captureGameRegion().Find(ocrRo);
        //     if (ocr.isExist() && ocr.text === "回合结束") {
        //         ocr.Click();
        //         await sleep(waitTime);
        //         // ocr.Click();
        //         // await sleep(waitTime);
        //         break;
        //     }
        // }
    }

    /**
     *
     * 切换角色（根据ID切换）【DEBUG】修改建议：改为模板匹配右下角启人图标
     *
     * @param id 角色id（从左到右，从0开始）
     * @returns {Promise<void>}
     */
    async function switchCard(id, extraWaitTime = 0) {
        let waitTime = 200 + extraWaitTime;

        let cardPosDic = {
            0: [750, 720],
            1: [960, 720],
            2: [1175, 720]
        }
        click(1190, 545); // 点击屏幕中间靠右复位 // 复位
        await sleep(waitTime);
        // 点击角色牌
        click(cardPosDic[id][0], cardPosDic[id][1]);
        await sleep(waitTime);
        click(1820, 958); // 点击切人按钮
        await sleep(500 + waitTime);
        click(1820, 958); // 再次点击切人按钮
    }

    /**
     *
     * 元素调和(调和次数要大于等于手牌数)【DEBUG】后续改成指定要调和的牌
     *
     * @param tuningTime 调和次数
     * @param extraWaitTime 额外等待时间
     * @returns {Promise<void>}
     */
    async function elementalTuning(tuningTime, extraWaitTime = 0) {
        let waitTime = 500 + extraWaitTime;

        let handCardNum = await getHandNum();
        log.info(`当前手牌数量: ${handCardNum}`);
        click(1190, 545); // 点击屏幕中间靠右复位 // 复位
        await sleep(waitTime);
        // 点击手牌区域
        click(967, 1041);
        await sleep(waitTime + 500);
        for (let i = handCardNum; i > handCardNum - tuningTime; i--) {
            await mouseDrag(stateHand_dic[handCardNum][1][0], stateHand_dic[handCardNum][1][1], 1867, 518, waitTime + 500);
            await sleep(200 + waitTime);
            click(960, 948); // 点击 元素调和
            await sleep(waitTime);
        }
        click(1190, 545); // 点击屏幕中间靠右复位 // 复位
        await sleep(waitTime);
    }

    async function main() { // 【DEBUG】main的结构需要整理
        // let testDic = await getHandMsg(5);
        // for (const [serial, card] of Object.entries(testDic)) {
        //     log.info(`${serial}|${card.name}|${card.ctype}|${card.label}|${card.means}`);
        // }
        // return null;
        // await sleep(1000);
        // await dragCard(2, 6);
        // return null;
        // let action = createActionFromEffectText("附属角色受到圣遗物以外的治疗后：治疗我方受伤最多的角色1点。（每回合至多触发2次）");
        // log.info(`${action.damage}`);
        // return null;
        let strategy = new Strategy();
        await strategy.strategyOne();
    }

    await main();
})();