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

    generateSimpleFileName: function (prefix, suffix = 'txt') {
        const now = new Date();
        const date = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const time = String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        let fileName = `${prefix}_${date}_${time}`;
        if (suffix) fileName += `.${suffix.replace(/^\./, '')}`;
        return fileName;
    },

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

    nameMapping : {
        '大英雄的经验': 'PURPLE',
        '冒险家的经验': 'BLUE',
        '流浪者的经验': 'GREEN',
    },
    
    normalizeBookData: function (rawData) {
        if (!rawData || Object.keys(rawData).length === 0) {
            return {};
        }

        const result = {
            PURPLE: 0,
            BLUE: 0,
            GREEN: 0
        };

        Object.keys(rawData).forEach(key => {
            const value = rawData[key];
            const normalizedKey = this.nameMapping[key];

            if (normalizedKey) {
                result[normalizedKey] += value;
            } else {
                console.warn(`无法识别的经验书类型: ${key}`);
            }
        });

        return result;
    },

    getExpBookData: function (rawBookData, includeTotal = false) {
        const normalizedData = this.normalizeBookData(rawBookData);

        const result = [];
        let totalExp = 0;
        let totalCount = 0;

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

        result.sort((a, b) => b.totalExp - a.totalExp);

        if (includeTotal && result.length > 0) {
            result.push({
                bookName: '总计',
                quantity: totalCount,
                totalExp: totalExp
            });
        }

        return result;
    },

    generateExpText: function (roleData, targetRoleLevel, expBookData = [], moraResult = null) {
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN');
        let text = `=== 原神角色升级所需的经验记录 [${timeStr}] ===\n\n`;

        const roleNames = Object.keys(roleData);
        let totalRoleExperienceRequired = 0;
        const characterName = settings.Character;

        if (roleNames.length > 0) {
            text += `===【角色数据】===\n`;

            roleNames.forEach(roleName => {
                const records = roleData[roleName];
                if (!Array.isArray(records) || records.length === 0) return;

                text += `【${characterName}】\n`;

                records.forEach((record, index) => {
                    text += `\t当前等级：${record.currentLevel}级\n`;
                    text += `\t当前经验：${record.currentExp}\n`;
                    text += `\t升级至${targetRoleLevel}级所需经验：${record.requiredExperience}\n`;
                    totalRoleExperienceRequired += record.requiredExperience;

                    if (index < records.length - 1) {
                        text += '\n';
                    }
                });

                if (roleNames.indexOf(roleName) < roleNames.length - 1) {
                    text += '\n';
                }
            });

            text += '\n';
        }

        let totalBookExperience = 0;
        let totalBookCount = 0;
        let bookItems = [];

        if (expBookData && expBookData.length > 0) {
            const hasTotalRow = expBookData.some(book => book.bookName === '总计');

            if (hasTotalRow) {
                bookItems = expBookData.filter(book => book.bookName !== '总计');
            } else {
                bookItems = expBookData;
            }

            if (bookItems.length > 0) {
                text += `===【经验书数据】===\n`;

                bookItems.forEach((book) => {
                    totalBookExperience += Number(book.totalExp || 0);
                    totalBookCount += Number(book.quantity || 0);
                });

                bookItems.forEach((book, index) => {
                    text += `\t${book.bookName}：\n`;
                    text += `\t数量：${Number(book.quantity || 0)}\n`;
                    text += `\t总经验值：${Number(book.totalExp || 0)}\n`;

                    if (index < bookItems.length - 1) {
                        text += '\n';
                    }
                });
            }
        }

        text += `\n=== 记录结束 ===\n`;

        if (roleNames.length > 0) {
            text += `总计角色数：${roleNames.length} | 所有角色升至${targetRoleLevel}级总计所需经验：${totalRoleExperienceRequired}\n`;
        }
        
        if (bookItems.length > 0) {
            text += `背包经验书种类数：${bookItems.length} | 总计经验值：${totalBookExperience}\n`;
        } else {
            const finalRequiredExperienceBook = expCalculator.convertExpToBooks(totalRoleExperienceRequired)
            text += `换算经验书：${finalRequiredExperienceBook.summary}\n`;
        }

        let deficit
        if (roleNames.length > 0 && bookItems.length > 0) {
            deficit = totalRoleExperienceRequired - totalBookExperience;
            if (deficit > 0) {
                text += `经验缺口：${deficit}（还需获取），`;
                const finalRequiredExperienceBook = expCalculator.convertExpToBooks(deficit)
                text += `换算经验书：${finalRequiredExperienceBook.summary}\n`;
            } else if (deficit < 0) {
                text += `经验盈余：${-deficit}（超出需求）\n`;
                const totalRequiredBooks = expCalculator.convertExpToBooks(totalRoleExperienceRequired)
                text += `总需求换算经验书：${totalRequiredBooks.summary}\n`;
            } else {
                text += `经验平衡：恰好足够\n`;
                const totalRequiredBooks = expCalculator.convertExpToBooks(totalRoleExperienceRequired)
                text += `换算经验书：${totalRequiredBooks.summary}\n`;
            }
        }

        // 摩拉计算结果
        if (moraResult) {
            text += `\n===【摩拉统计】===\n`;
            text += `\t当前拥有摩拉：${moraResult.currentMora.toLocaleString()}\n`;
            text += `\t角色突破摩拉：${moraResult.characterAscensionMora.toLocaleString()}\n`;
            text += `\t角色升级摩拉（使用经验书）：${moraResult.characterLevelUpMora.toLocaleString()}\n`;
            text += `\t天赋升级摩拉：${moraResult.totalTalentMora.toLocaleString()}\n`;
            text += `\t武器突破摩拉：${moraResult.weaponAscensionMora.toLocaleString()}\n`;
            text += `\t武器升级摩拉：${moraResult.weaponLevelUpMora.toLocaleString()}\n`;
            text += `\t总计需要摩拉：${moraResult.totalMoraRequired.toLocaleString()}\n`;
            
            if (moraResult.remainingMora >= 0) {
                text += `\t剩余摩拉：${moraResult.remainingMora.toLocaleString()}\n`;
            } else {
                text += `\t摩拉缺口：${(-moraResult.remainingMora).toLocaleString()}\n`;
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
