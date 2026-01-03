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

        const greenBooks = Math.ceil(remainingExp / expCalculator.EXP_BOOKS.GREEN.experience); // 向上取整，因为无法提供不足1000的经验

        return {
            purple: purpleBooks,
            blue: blueBooks,
            green: greenBooks,
            // 返回一个详细的文本摘要，方便直接使用
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

    /**
     * 计算单次刷取的期望经验值和概率分布
     * @param {string|boolean} worldLevel - 世界等级
     * @returns {Object} {expectedExp, minExp, distribution}
     */
    calculateSingleRunExp: function(worldLevel) {
    // 添加中文到英文的映射
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

            // 检查映射是否成功
            if (!englishKey) {
                console.warn(`未找到对应的英文键名: ${chineseBookName}`);
                continue;
            }

            const [min, max] = range;
            const possibilities = [];

            // 使用英文键名访问 EXP_BOOKS
            const bookConfig = expCalculator.EXP_BOOKS[englishKey];
            if (!bookConfig) {
                console.warn(`在 EXP_BOOKS 中未找到: ${englishKey}`);
                continue;
            }

            for (let qty = min; qty <= max; qty++) {
                possibilities.push({
                    bookKey: englishKey,
                    chineseName: chineseBookName, // 可选：保留中文名
                    qty,
                    experience: bookConfig.experience * qty
                });
            }
            outcomeDetails.push(possibilities);
        }

        // 如果 outcomeDetails 为空，返回默认值
        if (outcomeDetails.length === 0) {
            console.error('没有有效的掉落配置');
            return { expectedExp: 0, minExp: 0, distribution: [] };
        }            

        // 计算所有组合的概率分布（假设每种数量概率相等）
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

        // 转换为排序后的数组并计算期望值
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

    /**
     * 主计算函数：分别计算使用浓缩树脂和原粹树脂的刷取次数
     * @param {number} requiredExp - 所需经验值
     * @param {string|boolean} worldLevel - 世界等级 (0-9)
     * @param {{}} options - 计算选项
     * @param {boolean} options.useExpected - true:使用期望值计算(平均情况), false:使用保底值计算(最非情况)
     * @param {number} options.resinPerCondensed - 合成一个浓缩树脂所需的原粹树脂，默认为60
     * @returns {Object} 计算结果
     */
    calculateExpBookRequirements: function(requiredExp, worldLevel, options = {}) {
        const {
            useExpected = true,
            resinPerCondensed = 60
        } = options;

        // 获取单次刷取的经验数据
        const { expectedExp, minExp, distribution } = this.calculateSingleRunExp(worldLevel);

        if (expectedExp === 0) {
            return {
                error: `世界等级 ${worldLevel} 的掉落配置不完整，无法计算。请补充 WORLD_LEVEL_DROP_CONFIG 中的数据。`
            };
        }

        // 选择计算基准：期望值（平均）或保底值（最小）
        const expPerRun = useExpected ? expectedExp : minExp;
        const calcMode = useExpected ? '期望值(平均)' : '保底值(最小)';

        // 计算总刷取次数
        const totalRuns = Math.ceil(requiredExp / expPerRun);

        // 计算浓缩树脂相关次数
        const condensedRuns = Math.ceil(totalRuns / (resinPerCondensed / 20)); // 全部使用浓缩树脂的次数
        // 原粹树脂需要刷取的次数（如果没有浓缩树脂）
        const originalResinRuns = totalRuns; // 全部使用原粹树脂的次数

        // 计算原粹树脂总消耗量
        const totalOriginalResin = totalRuns * 20; // 每次副本固定消耗20原粹树脂

        // 计算需要合成的浓缩树脂数量
        const condensedResinNeeded = Math.ceil(totalOriginalResin / resinPerCondensed);

        return {
            // 计算基准信息
            calcMode,
            expPerRunUsed: expPerRun,
            singleRunStats: {
                expectedExp,
                minExp,
                possibleExpRange: distribution.length > 0 ?
                    `${distribution[0].experience} ~ ${distribution[distribution.length - 1].experience}` : 'N/A'
            },

            // 核心结果：分别输出两种树脂的刷取次数
            runs: {
                // 使用浓缩树脂需要刷取的次数
                usingCondensedResin: condensedRuns,
                // 使用原粹树脂需要刷取的次数
                usingOriginalResin: originalResinRuns,
                // 总副本挑战次数（两种方式相同）
                totalChallenges: totalRuns
            },

            // 资源消耗
            resinCost: {
                // 原粹树脂总消耗量
                totalOriginalResin,
                // 需要合成的浓缩树脂数量
                condensedResinNeeded,
                // 合成浓缩树脂所需原粹树脂总量
                resinForCondensed: condensedResinNeeded * resinPerCondensed
            },
        };
    },
}
