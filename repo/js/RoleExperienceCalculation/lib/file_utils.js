// 角色经验计算 - 文件读写工具
var FileUtils = {
    // 读取别名文件 （照搬脚本：AutoSwitchRoles（Tool_tingsu））
    readAliases: function (path) {
        const combatText = file.readTextSync(path);
        const combatData = JSON.parse(combatText);
        const aliases = {};
        for (const character of combatData) {
            if (character.alias && character.name) {
                for (const alias of character.alias) {
                    aliases[alias] = character.name;
                }
            }
        }
        return aliases;
    },

    /**
     * 生成简洁的文件名：前缀_日期_时间（精确到秒）
     * @param {string} prefix 文件名前缀
     * @param {string} suffix 文件后缀（不带点，默认："txt"，可选）
     * @returns {string} 最终文件名
     */
    generateSimpleFileName: function (prefix, suffix = 'txt') {
        const now = new Date();
        // 日期：YYYYMMDD
        const date = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        // 时间：HHmmss（精确到秒）
        const time = String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        // 拼接核心部分
        let fileName = `${prefix}_${date}_${time}`;
        // 追加后缀（自动补点）
        if (suffix) fileName += `.${suffix.replace(/^\./, '')}`;
        return fileName;
    },

    /**
     * 创建文件并写入内容
     * @param {string} filePath 文件根目录
     * @param {string} content 写入内容
     * @param {string} fileName 文件名（需加文件后缀）
     * @return {Promise<boolean>}
     */
    fileReadWrite: async function (filePath, content, fileName) {
        try {
            const path = `${filePath}/${fileName}`;
            const success = await file.writeText(path, content);
            if (success) {
                log.info(`${fileName}已保存`);
                return true;
            } else {
                log.error(`${fileName}保存失败`);
                return false;
            }
        } catch (error) {
            log.error(`${fileName}保存失败: ${error}`);
            return false;
        }
    },

    // 定义名称变体映射
    nameMapping : {
        // 大英雄的经验 - 紫色
        '大英雄的经验': 'PURPLE',

        // 冒险家的经验 - 蓝色
        '冒险家的经验': 'BLUE',

        // 流浪者的经验 - 绿色
        '流浪者的经验': 'GREEN',
    },
    
    /**
     * 将任意格式的经验书数据转换为标准格式
     * @param {{[key: string]: number}|null} rawData - 原始数据
     * @returns {Object} 标准化的经验书数量对象
     */
    normalizeBookData: function (rawData) {
        // 如果数据为null或空对象，返回空对象
        if (!rawData || Object.keys(rawData).length === 0) {
            return {};
        }

        const result = {
            PURPLE: 0,
            BLUE: 0,
            GREEN: 0
        };

        // 遍历原始数据的所有键
        Object.keys(rawData).forEach(key => {
            const value = rawData[key];

            // 查找映射
            const normalizedKey = this.nameMapping[key];

            if (normalizedKey) {
                result[normalizedKey] += value;
            } else {
                console.warn(`无法识别的经验书类型: ${key}`);
            }
        });

        return result;
    },

    /**
     * 经验书数据接口 - 提供经验书数据
     * @param {{[key: string]: number}} rawBookData - 原始经验书数据
     * @param {boolean} includeTotal - 是否包含总计行
     * @returns {Array} 经验书数据数组
     */
    getExpBookData: function (rawBookData, includeTotal = false) {
        // 标准化数据
        const normalizedData = this.normalizeBookData(rawBookData);

        const result = [];
        let totalExp = 0;
        let totalCount = 0;

        // 生成经验书数据
        Object.keys(normalizedData).forEach(bookType => {
            const quantity = normalizedData[bookType];

            if (quantity > 0) {
                const bookInfo = expCalculator.EXP_BOOKS[bookType];
                const expValue = bookInfo.experience * quantity;

                result.push({
                    bookName: bookInfo.name,
                    quantity: quantity,
                    totalExp: expValue
                });

                totalExp += expValue;
                totalCount += quantity;
            }
        });

        // 按总经验值降序排序
        result.sort((a, b) => b.totalExp - a.totalExp);

        // 如果需要总计行，添加到数组末尾
        if (includeTotal && result.length > 0) {
            result.push({
                bookName: '总计',
                quantity: totalCount,
                totalExp: totalExp
            });
        }

        return result;
    },

    /**
     * 生成角色经验记录的文本内容并输出核心数据
     * @param {object} roleData - 角色经验数据
     * @param {number} targetRoleLevel - 目标等级
     * @param {Object} expBookData - 经验书数据数组（可选）
     * @returns {Object} - {text:格式化后的文本,
     * totalRoleExperienceRequired:总需经验,
     * additionalExperienceRequirements:还需经验,
     * totalBackpackExperience:背包经验书可提供的经验}
     */
    generateExpText: function (roleData, targetRoleLevel, expBookData = []) {
        // 1. 头部：标题 + 时间戳
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN'); // 本地时间
        let text = `=== 原神角色升级所需的经验记录 [${timeStr}] ===\n\n`;

        // 2. 角色区块
        const roleNames = Object.keys(roleData);
        let totalRoleExperienceRequired = 0;

        if (roleNames.length > 0) {
            text += `===【角色数据】===\n`;

            roleNames.forEach(roleName => {
                const records = roleData[roleName];
                if (!Array.isArray(records) || records.length === 0) return;

                // 角色标题
                text += `【${roleName}】\n`;

                // 遍历该角色的每条记录
                records.forEach((record, index) => {
                    text += `\t当前等级：${record.currentLevel}级\n`;
                    text += `\t当前经验：${record.currentExp}\n`;
                    text += `\t升级至${targetRoleLevel}级所需经验：${record.requiredExperience}\n`;
                    totalRoleExperienceRequired += record.requiredExperience;

                    // 记录间空行（除了最后一条）
                    if (index < records.length - 1) {
                        text += '\n';
                    }
                });

                // 角色间空行分隔
                if (roleNames.indexOf(roleName) < roleNames.length - 1) {
                    text += '\n';
                }
            });

            text += '\n'; // 区块间空行
        }

        // 3. 经验书区块
        let totalBookExperience = 0;
        let totalBookCount = 0; // 初始化为数字0，避免字符串拼接
        let bookItems = [];

        if (expBookData && expBookData.length > 0) {
            // 如果是完整数据（包含总计行），需要先过滤掉总计行
            const hasTotalRow = expBookData.some(book => book.bookName === '总计');

            if (hasTotalRow) {
                bookItems = expBookData.filter(book => book.bookName !== '总计');
            } else {
                bookItems = expBookData;
            }

            if (bookItems.length > 0) {
                text += `===【经验书数据】===\n`;

                // 计算总计
                bookItems.forEach((book) => {
                    // 确保累加的是数字（避免字符串拼接）
                    totalBookExperience += Number(book.totalExp || 0);
                    totalBookCount += Number(book.quantity || 0); // 转数字后累加
                });

                // 显示每种经验书
                bookItems.forEach((book, index) => {
                    text += `\t${book.bookName}：\n`;
                    // 去除数量前置0：转数字再转字符串
                    text += `\t数量：${Number(book.quantity || 0)}\n`;
                    // 经验值也确保是数字（可选，防止前置0）
                    text += `\t总经验值：${Number(book.totalExp || 0)}\n`;

                    // 经验书间空行（除了最后一条）
                    if (index < bookItems.length - 1) {
                        text += '\n';
                    }
                });
            }
        }

        // 4. 尾部：统计信息
        text += `\n=== 记录结束 ===\n`;

        // 角色统计
        if (roleNames.length > 0) {
            text += `总计角色数：${roleNames.length} | 所有角色升至${targetRoleLevel}级总计所需经验：${totalRoleExperienceRequired}\n`;
        }
        
        // 经验书统计
        if (bookItems.length > 0) {
            text += `背包经验书种类数：${bookItems.length} | 总计经验值：${totalBookExperience}\n`;
        } else {
            const finalRequiredExperienceBook = expCalculator.convertExpToBooks(totalRoleExperienceRequired)
            text += `换算经验书：${finalRequiredExperienceBook.summary}\n`;
        }

        // 综合统计
        let deficit
        if (roleNames.length > 0 && bookItems.length > 0) {
            deficit = totalRoleExperienceRequired - totalBookExperience;
            if (deficit > 0) {
                text += `经验缺口：${deficit}（还需获取），`;
                const finalRequiredExperienceBook = expCalculator.convertExpToBooks(deficit)
                text += `换算经验书：${finalRequiredExperienceBook.summary}\n`;
            } else if (deficit < 0) {
                text += `经验盈余：${-deficit}（超出需求）\n`;
            } else {
                text += `经验平衡：恰好足够\n`;
            }
        }

        return {
            text:text,
            totalRoleExperienceRequired: totalRoleExperienceRequired,
            additionalExperienceRequirements: deficit,
            totalBackpackExperience:totalBookExperience
        }
    }
}