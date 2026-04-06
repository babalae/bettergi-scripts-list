// 角色经验计算 - 计算模块

// 经验
var expCalculator= {
    // 核心数据：1-90级每级升级所需经验值 (来源: 原神WIKI)[citation:5]
    LEVEL_EXP_REQUIREMENTS: [
        0,      // Lv1 之前为0
        1000, 1325, 1700, 2150, 2625,  // Lv1-5
        3150, 3725, 4350, 5000, 5700,  // Lv6-10
        6450, 7225, 8050, 8925, 9825,  // Lv11-15
        10750, 11725, 12725, 13775, 14875, // Lv16-20
        16800, 18000, 19250, 20550, 21875, // Lv21-25
        23250, 24650, 26100, 27575, 29100, // Lv26-30
        30650, 32250, 33875, 35550, 37250, // Lv31-35
        38975, 40750, 42575, 44425, 46300, // Lv36-40
        50625, 52700, 54775, 56900, 59075, // Lv41-45
        61275, 63525, 65800, 68125, 70475, // Lv46-50
        76500, 79050, 81650, 84275, 86950, // Lv51-55
        89650, 92400, 95175, 98000, 100875, // Lv56-60
        108950, 112050, 115175, 118325, 121525, // Lv61-65
        124775, 128075, 131400, 134775, 138175, // Lv66-70
        148700, 152375, 156075, 159825, 163600, // Lv71-75
        167425, 171300, 175225, 179175, 183175, // Lv76-80
        216225, 243025, 273100, 306800, 344600, // Lv81-85
        386950, 434425, 487625, 547200, 0       // Lv86-90 (90级为满级)
    ],

    // 经验书定义[citation:2]
    EXP_BOOKS: {
        PURPLE: {name: '大英雄的经验', experience: 20000},
        BLUE: {name: '冒险家的经验', experience: 5000},
        GREEN: {name: '流浪者的经验', experience: 1000}
    },

    /**
     * 计算从当前等级/经验升级到目标等级所需的总经验值。
     * @param {number} currentLevel - 当前等级 (1-89)
     * @param {number} currentExp - 当前等级下已累积的经验值
     * @param {number} targetLevel - 目标等级 (2-90)
     * @returns {number} 所需总经验值，如果输入无效返回 -1
     */
    calculateExpRequired: function (currentLevel, currentExp, targetLevel) {
        // 参数校验
        if (currentLevel < 1 || currentLevel >= 90 ||
            targetLevel <= currentLevel || targetLevel > 90 ||
            currentExp < 0) {
            console.error('Invalid input parameters.');
            return -1;
        }

        let totalExpNeeded = 0;

        // 1. 减去当前等级已积累的经验
        totalExpNeeded -= currentExp;

        // 2. 累加从当前等级到目标等级-1所需的每一级经验
        for (let lvl = currentLevel; lvl < targetLevel; lvl++) {
            totalExpNeeded += expCalculator.LEVEL_EXP_REQUIREMENTS[lvl];
        }

        return totalExpNeeded;
    },

    /**
     * 将经验值转换为所需的各种经验书数量（优先使用高等级书籍）。
     * @param {number} expRequired - 所需总经验值
     * @returns {Object} 包含三种经验书所需数量的对象
     */
    convertExpToBooks: function (expRequired) {
        let remainingExp = expRequired;

        const purpleBooks = Math.floor(remainingExp / expCalculator.EXP_BOOKS.PURPLE.experience);
        remainingExp %= expCalculator.EXP_BOOKS.PURPLE.experience;

        const blueBooks = Math.floor(remainingExp / expCalculator.EXP_BOOKS.BLUE.experience);
        remainingExp %= expCalculator.EXP_BOOKS.BLUE.experience;

        const greenBooks = Math.ceil(remainingExp / expCalculator.EXP_BOOKS.GREEN.experience);

        return {
            purple: purpleBooks,
            blue: blueBooks,
            green: greenBooks,
            summary: `共需: ${purpleBooks}本[${expCalculator.EXP_BOOKS.PURPLE.name}] + ${blueBooks}本[${expCalculator.EXP_BOOKS.BLUE.name}] + ${greenBooks}本[${expCalculator.EXP_BOOKS.GREEN.name}]`
        };
    }
}

// 树脂
var resinCalculation = {
    // 世界等级掉落配置：每种经验书的 [最小数量, 最大数量]
    WORLD_LEVEL_DROP_CONFIG : {
        0: { '流浪者的经验': [7, 8], '冒险家的经验': [3, 4] },
        1: { '流浪者的经验': [10, 12], '冒险家的经验': [5, 6] },
        2: { '冒险家的经验': [10, 11] },
        3: { '冒险家的经验': [13, 14] },
        4: { '大英雄的经验': [2, 3], '冒险家的经验': [6, 7] },
        5: { '大英雄的经验': [3, 4], '冒险家的经验': [6, 7] },
        6: { '大英雄的经验': [4, 5], '冒险家的经验': [6, 7] },
        7: { '大英雄的经验': [4, 5], '冒险家的经验': [6, 7] },
        8: { '大英雄的经验': [4, 5], '冒险家的经验': [6, 7] },
        9: { '大英雄的经验': [4, 5], '冒险家的经验': [6, 7] }
    },

    // 世界等级摩拉掉落（20 树脂）
    WORLD_LEVEL_MORA_DROP: {
        0: 12000,
        1: 20000,
        2: 28000,
        3: 36000,
        4: 44000,
        5: 52000,
        6: 60000,
        7: 60000,
        8: 60000,
        9: 61000
    },

    calculateSingleRunExp: function(worldLevel) {
        const BOOK_NAME_MAPPING = {
            '流浪者的经验': 'GREEN',
            '冒险家的经验': 'BLUE',
            '大英雄的经验': 'PURPLE'
        };

        const config = this.WORLD_LEVEL_DROP_CONFIG[worldLevel];
        if (!config || Object.keys(config).length === 0) {
            return { expectedExp: 0, minExp: 0, distribution: [] };
        }

        let outcomeDetails = [];
        for (const [chineseBookName, range] of Object.entries(config)) {
            const englishKey = BOOK_NAME_MAPPING[chineseBookName];

            if (!englishKey) {
                console.warn(`未找到对应的英文键名: ${chineseBookName}`);
                continue;
            }

            const [min, max] = range;
            const possibilities = [];

            const bookConfig = expCalculator.EXP_BOOKS[englishKey];
            if (!bookConfig) {
                console.warn(`在 EXP_BOOKS 中未找到: ${englishKey}`);
                continue;
            }

            for (let qty = min; qty <= max; qty++) {
                possibilities.push({
                    bookKey: englishKey,
                    chineseName: chineseBookName,
                    qty,
                    experience: bookConfig.experience * qty
                });
            }
            outcomeDetails.push(possibilities);
        }

        if (outcomeDetails.length === 0) {
            console.error('没有有效的掉落配置');
            return { expectedExp: 0, minExp: 0, distribution: [] };
        }

        const distributionMap = new Map();

        function dfs(index, currentExp, probability) {
            if (index === outcomeDetails.length) {
                distributionMap.set(currentExp, (distributionMap.get(currentExp) || 0) + probability);
                return;
            }
            for (const outcome of outcomeDetails[index]) {
                dfs(index + 1, currentExp + outcome.experience, probability / outcomeDetails[index].length);
            }
        }

        dfs(0, 0, 1.0);

        let distribution = [];
        let expectedExp = 0;
        let minExp = Infinity;

        for (const [experience, prob] of distributionMap.entries()) {
            distribution.push({ experience, probability: prob });
            expectedExp += experience * prob;
            if (experience < minExp) minExp = experience;
        }

        distribution.sort((a, b) => a.experience - b.experience);

        return {
            expectedExp: Math.round(expectedExp),
            minExp: minExp,
            distribution
        };
    },
    // 计算经验书需求
    calculateExpBookRequirements: function(requiredExp, worldLevel, options = {}) {
        const {
            useExpected = true,
            resinPerCondensed = 60
        } = options;

        const { expectedExp, minExp, distribution } = this.calculateSingleRunExp(worldLevel);

        if (expectedExp === 0) {
            return {
                error: `世界等级 ${worldLevel} 的掉落配置不完整，无法计算。请补充 WORLD_LEVEL_DROP_CONFIG 中的数据。`
            };
        }

        const expPerRun = useExpected ? expectedExp : minExp;
        const calcMode = useExpected ? '期望值(平均)' : '保底值(最小)';
        const actualExpPerRun = expPerRun * 2;
        const totalRuns = Math.ceil(requiredExp / actualExpPerRun);

        return {
            calcMode,
            expPerRunUsed: expPerRun,
            singleRunStats: {
                expectedExp,
                minExp,
                possibleExpRange: distribution.length > 0 ?
                    `${distribution[0].experience} ~ ${distribution[distribution.length - 1].experience}` : 'N/A'
            },
            runs: {
                totalChallenges: totalRuns
            }
        };
    },

    calculateMoraLeyLineRuns: function(moraShortage, worldLevel) {
        const moraPerRun = this.WORLD_LEVEL_MORA_DROP[worldLevel] || 0;
        if (moraPerRun === 0) {
            return {
                error: `世界等级 ${worldLevel} 的摩拉掉落配置不完整，无法计算。请补充 WORLD_LEVEL_MORA_DROP 中的数据。`
            };
        }
        const actualMoraPerRun = moraPerRun * 2;
        const totalRuns = Math.ceil(moraShortage / actualMoraPerRun);
        const totalOriginalResin = totalRuns * 20;
        return {
            moraPerRun: actualMoraPerRun,
            totalRuns,
            totalOriginalResin
        };
    }
}

// 摩拉计算
var moraCalculation = {
    CHARACTER_ASCENSION_MORA: {
        20: 20000,
        40: 40000,
        50: 60000,
        60: 80000,
        70: 100000,
        80: 120000
    },

    TALENT_UPGRADE_MORA: {
        1: 12500,
        2: 17500,
        3: 25000,
        4: 30000,
        5: 37500,
        6: 120000,
        7: 260000,
        8: 450000,
        9: 700000
    },

    WEAPON_ASCENSION_MORA_5STAR: {
        20: 10000,
        40: 20000,
        50: 30000,
        60: 45000,
        70: 55000,
        80: 65000
    },

    WEAPON_LEVEL_UP_MORA_5STAR: {
        20: 74500,
        40: 62800,
        50: 93000,
        60: 130000,
        70: 175000,
        80: 371500
    },

    EXP_BOOK_MORA: {
        PURPLE: 4000,
        BLUE: 1000,
        GREEN: 200
    },

    WEAPON_STAR_MULTIPLIER: {
        "五星": 1.0,
        "四星": 0.7,
        "三星": 0.45
    },
    // 角色突破摩拉计算
    calculateCharacterAscensionMora: function(currentBreakLevel, targetBreakLevel) {
        const ASCENSION_LEVELS = [20, 40, 50, 60, 70, 80];
        let totalMora = 0;
        for (const level of ASCENSION_LEVELS) {
            if (level >= currentBreakLevel && level <= targetBreakLevel) {
                totalMora += this.CHARACTER_ASCENSION_MORA[level] || 0;
            }
        }
        return totalMora;
    },
    // 角色升级摩拉计算
    calculateCharacterLevelUpMora: function(bookRequirements) {
        const purpleMora = bookRequirements.purple * this.EXP_BOOK_MORA.PURPLE;
        const blueMora = bookRequirements.blue * this.EXP_BOOK_MORA.BLUE;
        const greenMora = bookRequirements.green * this.EXP_BOOK_MORA.GREEN;
        return purpleMora + blueMora + greenMora;
    },
    // 天赋升级摩拉计算
    calculateTalentUpgradeMora: function(currentTalentLevel, targetTalentLevel) {
        let totalMora = 0;
        for (let i = currentTalentLevel; i < targetTalentLevel; i++) {
            totalMora += this.TALENT_UPGRADE_MORA[i] || 0;
        }
        return totalMora;
    },
    // 武器突破摩拉计算
    calculateWeaponAscensionMora: function(weaponStar, currentBreakLevel, targetBreakLevel) {
        const multiplier = this.WEAPON_STAR_MULTIPLIER[weaponStar] || 1.0;
        const ASCENSION_LEVELS = [20, 40, 50, 60, 70, 80];
        let totalMora = 0;
        for (const level of ASCENSION_LEVELS) {
            if (level >= currentBreakLevel && level <= targetBreakLevel) {
                totalMora += this.WEAPON_ASCENSION_MORA_5STAR[level] || 0;
            }
        }
        return Math.floor(totalMora * multiplier);
    },
    // 武器升级摩拉计算
    calculateWeaponLevelUpMora: function(weaponStar, currentLevel, targetLevel) {
        const multiplier = this.WEAPON_STAR_MULTIPLIER[weaponStar] || 1.0;
        const LEVEL_STAGES = [20, 40, 50, 60, 70, 80];
        let totalMora = 0;
        for (const level of LEVEL_STAGES) {
            if (level >= currentLevel && level <= targetLevel) {
                totalMora += this.WEAPON_LEVEL_UP_MORA_5STAR[level] || 0;
            }
        }
        log.info(`武器升级: currentLevel=${currentLevel}, targetLevel=${targetLevel}`);
        log.info(`武器升级摩拉总计: ${totalMora}, 乘以${multiplier}后: ${Math.floor(totalMora * multiplier)}`);
        return Math.floor(totalMora * multiplier);
    },

    calculateTotalMoraRequirement: function(config) {
        const {
            characterLevel,
            characterBreak,
            targetRoleLevel,
            targetBreakLevel,
            talentLevels,
            targetTalentLevels,
            weaponStar,
            weaponLevel,
            weaponBreakLevel,
            targetWeaponLevel,
            targetWeaponBreakLevel,
            bookRequirements,
            currentMora
        } = config;

        const characterAscensionMora = this.calculateCharacterAscensionMora(characterBreak, targetBreakLevel);
        const characterLevelUpMora = this.calculateCharacterLevelUpMora(bookRequirements);

        const talent1Mora = this.calculateTalentUpgradeMora(talentLevels[0], targetTalentLevels[0]);
        const talent2Mora = this.calculateTalentUpgradeMora(talentLevels[1], targetTalentLevels[1]);
        const talent3Mora = this.calculateTalentUpgradeMora(talentLevels[2], targetTalentLevels[2]);
        const totalTalentMora = talent1Mora + talent2Mora + talent3Mora;

        const weaponAscensionMora = this.calculateWeaponAscensionMora(weaponStar, weaponBreakLevel, targetWeaponBreakLevel);
        const weaponLevelUpMora = this.calculateWeaponLevelUpMora(weaponStar, weaponLevel, targetWeaponLevel);

        const totalMoraRequired = characterAscensionMora + characterLevelUpMora + totalTalentMora + weaponAscensionMora + weaponLevelUpMora;
        const remainingMora = currentMora - totalMoraRequired;

        return {
            characterAscensionMora,
            characterLevelUpMora,
            talent1Mora,
            talent2Mora,
            talent3Mora,
            totalTalentMora,
            weaponAscensionMora,
            weaponLevelUpMora,
            totalMoraRequired,
            currentMora,
            remainingMora,
            isEnough: remainingMora >= 0
        };
    }
}
