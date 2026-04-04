// 材料刷取模块
var Farming = {
    // 跳过体力检查标志
    skipCheckStamina: 1,
    
    // 获取天赋书
    getTalentBook: async function(materialName, bookRequireCounts) {
        while (1) {
            log.info(`准备刷取天赋书，开始检查体力`);
            let afterStamina = 0;
            let res = 9999999;
            if (this.skipCheckStamina) afterStamina = await Inventory.queryStaminaValue();
            if (afterStamina < 20) this.skipCheckStamina = 0;
            
            if (afterStamina >= 20) {
                try {
                    log.info(`体力充足，开始检测物品数量`);
                    let bookCounts = await Inventory.getMaterialCount(materialName);
                    res = 0.12 * (bookRequireCounts[0] - bookCounts[0]) + 0.36 * (bookRequireCounts[1] - bookCounts[1]) + (bookRequireCounts[2] - bookCounts[2]);
                    if (res > 0) {
                        log.info(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
                        
                        let domainRounds = 1;
                        const PURPLE_PER_RUN = 1.7;
                        const STAMINA_PER_RUN = 40;
                        
                        const neededRounds = Math.ceil(res / PURPLE_PER_RUN);
                        const maxRoundsByStamina = Math.floor(afterStamina / STAMINA_PER_RUN);
                        const remainder = afterStamina % STAMINA_PER_RUN;
                        const extraRound = (remainder >= 20) ? 1 : 0;
                        const totalRoundsByStamina = maxRoundsByStamina + extraRound;
                        
                        if (neededRounds > totalRoundsByStamina) {
                            domainRounds = totalRoundsByStamina;
                        } else {
                            domainRounds = neededRounds;
                        }
                        
                        log.info(`根据体力${afterStamina}计算：需要${neededRounds}次，体力最多可执行${totalRoundsByStamina}次，实际执行${domainRounds}次`);
                        await Navigation.gotoAutoDomain(null, null, domainRounds);
                    } else {
                        Utils.addNotification(`${materialName}天赋书数量已经满足要求！！！`);
                        await TaskManager.addCompletedTask("talent", materialName, bookRequireCounts);
                        return;
                    }
                } catch (error) {
                    if (error.message && error.message.includes("检测到复苏界面")) {
                        log.warn(`检测到角色被击败，等待复活后继续刷取`);
                        await sleep(4000);
                        continue;
                    }
                    notification.send(`${materialName}天赋书刷取失败，错误信息: ${error}`);
                    await genshin.tp(2297.6201171875, -824.5869140625);
                    if (error.message != '秘境未在开启时间，跳过执行') {
                        let bookCounts = await Inventory.getMaterialCount(materialName);
                        res = 0.12 * (bookRequireCounts[0] - bookCounts[0]) + 0.36 * (bookRequireCounts[1] - bookCounts[1]) + (bookRequireCounts[2] - bookCounts[2]);
                    }
                    Utils.addNotification(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
                    return;
                }
            } else {
                log.info(`体力值为${afterStamina},可能无法刷取${materialName}天赋书`);
                const bookCounts = await Inventory.getMaterialCount(materialName);
                let res = 0.12 * (bookRequireCounts[0] - bookCounts[0]) + 0.36 * (bookRequireCounts[1] - bookCounts[1]) + (bookRequireCounts[2] - bookCounts[2]);
                if (res <= 0) {
                    await TaskManager.addCompletedTask("talent", materialName, bookRequireCounts);
                    Utils.addNotification(`${materialName}天赋书数量已经满足要求！！！`);
                } else {
                    Utils.addNotification(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
                }
                return;
            }
        }
    },
    
    // 获取武器材料
    getWeaponMaterial: async function(materialName, weaponRequireCounts) {
        while (1) {
            log.info(`准备刷取武器材料，开始检查体力`);
            let afterStamina = 0;
            let res = 99999999;
            if (this.skipCheckStamina) afterStamina = await Inventory.queryStaminaValue();
            if (afterStamina < 20) this.skipCheckStamina = 0;
            
            if (afterStamina >= 20) {
                try {
                    log.info(`体力充足，开始检测物品数量`);
                    let weaponCounts = await Inventory.getWeaponMaterialCount(materialName);
                    res = 0.12 * (weaponRequireCounts[0] - weaponCounts.green) + 0.36 * (weaponRequireCounts[1] - weaponCounts.blue) + (weaponRequireCounts[2] - weaponCounts.purple) + 3 * (weaponRequireCounts[3] - weaponCounts.gold);
                    if (res > 0) {
                        log.info(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
                        
                        let domainRounds = 1;
                        const PURPLE_PER_RUN = 1.4;
                        const STAMINA_PER_RUN = 40;
                        
                        const neededRounds = Math.ceil(res / PURPLE_PER_RUN);
                        const maxRoundsByStamina = Math.floor(afterStamina / STAMINA_PER_RUN);
                        const remainder = afterStamina % STAMINA_PER_RUN;
                        const extraRound = (remainder >= 20) ? 1 : 0;
                        const totalRoundsByStamina = maxRoundsByStamina + extraRound;
                        
                        if (neededRounds > totalRoundsByStamina) {
                            domainRounds = totalRoundsByStamina;
                        } else {
                            domainRounds = neededRounds;
                        }
                        
                        log.info(`根据体力${afterStamina}计算：需要${neededRounds}次，体力最多可执行${totalRoundsByStamina}次，实际执行${domainRounds}次`);
                        await Navigation.gotoAutoDomain("weaponDomain", null, domainRounds);
                    } else {
                        Utils.addNotification(`武器材料${materialName}数量已经满足要求！！！`);
                        await TaskManager.addCompletedTask("wepon", materialName, weaponRequireCounts);
                        return;
                    }
                } catch (error) {
                    if (error.message && error.message.includes("检测到复苏界面")) {
                        log.warn(`检测到角色被击败，等待复活后继续刷取`);
                        await sleep(4000);
                        continue;
                    }
                    Utils.addNotification(`武器材料${materialName}刷取失败，错误信息: ${error}`);
                    await genshin.tp(2297.6201171875, -824.5869140625);
                    if (error.message != '秘境未在开启时间，跳过执行') {
                        const weaponCounts = await Inventory.getWeaponMaterialCount(materialName);
                        res = 0.12 * (weaponRequireCounts[0] - weaponCounts.green) + 0.36 * (weaponRequireCounts[1] - weaponCounts.blue) + (weaponRequireCounts[2] - weaponCounts.purple) + 3 * (weaponRequireCounts[3] - weaponCounts.gold);
                    }
                    Utils.addNotification(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
                    return;
                }
            } else {
                log.info(`体力值为${afterStamina},可能无法刷取武器材料${materialName}`);
                const weaponCounts = await Inventory.getWeaponMaterialCount(materialName);
                let res = 0.12 * (weaponRequireCounts[0] - weaponCounts.green) + 0.36 * (weaponRequireCounts[1] - weaponCounts.blue) + (weaponRequireCounts[2] - weaponCounts.purple) + 3 * (weaponRequireCounts[3] - weaponCounts.gold);
                if (res <= 0) {
                    await TaskManager.addCompletedTask("wepon", materialName, weaponRequireCounts);
                    Utils.addNotification(`武器材料${materialName}数量已经满足要求！！！`);
                } else {
                    Utils.addNotification(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
                }
                return;
            }
        }
    },
    
    // 获取BOSS材料
    getBossMaterial: async function(bossName, bossRequireCounts) {
        while (1) {
            log.info(`准备刷取 boss 材料，开始检查体力`);
            let afterStamina = 0;
            let res = 99999999;
            if (this.skipCheckStamina) afterStamina = await Inventory.queryStaminaValue();
            if (afterStamina < 20) this.skipCheckStamina = 0;
            
            if (afterStamina >= 40) {
                try {
                    log.info(`体力充足，开始检测物品数量`);
                    let bossCounts = await Inventory.getBossMaterialCount(bossName);
                    res = bossRequireCounts - bossCounts;
                    if (res > 0) {
                        log.info(`${bossName}还差${res}个材料没有刷取`);
                        await Combat.fightBoss(bossName);
                    } else {
                        Utils.addNotification(`${bossName}材料数量已经满足要求！！！`);
                        await TaskManager.addCompletedTask("boss", bossName, bossRequireCounts);
                        return;
                    }
                } catch (error) {
                    if (error.message && error.message.includes("检测到复苏界面")) {
                        log.warn(`检测到角色被击败，等待复活后继续刷取`);
                        await sleep(4000);
                        continue;
                    }
                    Utils.addNotification(`${bossName}刷取失败，错误信息: ${error}`);
                    await genshin.tp(2297.6201171875, -824.5869140625);
                    return;
                }
            } else {
                log.info(`体力值为${afterStamina},可能无法刷取首领材料${bossName}`);
                const bossCounts = await Inventory.getBossMaterialCount(bossName);
                let res = bossRequireCounts - bossCounts;
                if (res > 0) {
                    Utils.addNotification(`${bossName}还差${res}个材料没有刷取`);
                } else {
                    Utils.addNotification(`${bossName}材料数量已经满足要求！！！`);
                    await TaskManager.addCompletedTask("boss", bossName, bossRequireCounts);
                }
                return;
            }
        }
    }
};
