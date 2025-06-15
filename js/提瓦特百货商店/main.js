// 检查 F 图标和右边水平对齐的文字
async function checkNpcAndFAlignment(npcName, fDialogueRo) {
    try {
        let ra = captureGameRegion();
        let fRes = ra.find(fDialogueRo);
        if (!fRes.isExist()) {
            let f_attempts = 0; // 初始化为0而不是null
            while (f_attempts < 5) {
                f_attempts++;
                log.info(`当前尝试次数：${f_attempts}`);

                if (f_attempts <= 3) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                    await sleep(1000);
                } else if (f_attempts === 4) {
                    log.warn("尝试调整游戏时间");
                    // 先调整到8点
                    await setGameTime(8);
                    await sleep(2000);

                    // 8点时进行3次滚轮下滑和NPC检测
                    log.info("8点时执行滚轮下滑和NPC检测循环");
                    for (let i = 0; i < 3; i++) {
                        await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                        await sleep(1000);
                        // 检查F图标和NPC是否对齐
                        if (await checkAlignment()) {
                            log.info(`在8点第${i + 1}次滚动后找到对齐的NPC: ${npcName}`);
                            return true;
                        }
                    }
                    
                    // 如果8点没找到，调整到18点
                    await setGameTime(18);
                    await sleep(2000);

                    // 18点时进行3次滚轮下滑和NPC检测
                    log.info("18点时执行滚轮下滑和NPC检测循环");
                    for (let i = 0; i < 3; i++) {
                        await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                        await sleep(1000);
                        // 检查F图标和NPC是否对齐
                        if (await checkAlignment()) {
                            log.info(`在18点第${i + 1}次滚动后找到对齐的NPC: ${npcName}`);
                            return true;
                        }
                    }

                    // 如果都没找到，重新加载路径文件
                    log.info("重新加载路径文件");
                    await pathingScript.runFile(filePath);
                    await sleep(500);
                } else {
                    log.warn("尝试次数已达上限");
                    break;
                }

                fRes = ra.find(fDialogueRo);
                if (fRes.isExist()) {
                    log.info("找到 F 图标");
                    // 找到F图标后，立即检查对齐情况
                    if (await checkAlignment()) {
                        return true;
                    }
                }
                log.warn(`尝试 ${f_attempts}：寻找 F 图标`);
            }

            if (!fRes.isExist()) {
                log.warn("经过多次尝试后仍未找到 F 图标");
                return false;
            }
        }

        // 如果已经找到F图标，检查对齐情况
        return await checkAlignment();
    } catch (err) {
        log.warn(`检查NPC和F对齐失败: ${err}`);
        return false;
    }

    // 内部函数：检查F图标和NPC是否对齐
    async function checkAlignment() {
        let ra = captureGameRegion();
        let fRes = ra.find(fDialogueRo);
        if (!fRes.isExist()) return false;

        let centerYF = fRes.y + fRes.height / 2;
        let ocrResult = await performOcr(npcName, npcxRange, { min: fRes.y, max: fRes.y + fRes.height }, tolerance);
        if (!ocrResult.success) {
            return false;
        }

        let centerYnpcName = ocrResult.y + ocrResult.height / 2;
        let isAligned = Math.abs(centerYnpcName - centerYF) <= npctolerance;
        if (isAligned) {
            log.info(`NPC '${npcName}' 和 F 图标水平对齐，NPC: ${centerYnpcName}, F 图标: ${centerYF}`);
        }
        return isAligned;
    }
} 