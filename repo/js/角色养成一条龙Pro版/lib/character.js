// 角色识别模块
var Character = {
    // 加载角色数据
    loadAvatarData: async function() {
        try {
            const json = file.readTextSync(Constants.avatarDataPath);
            const data = JSON.parse(json);
            const aliasMap = {};
            data.forEach(char => {
                aliasMap[char.name] = char.name;
                char.alias.forEach(alias => aliasMap[alias] = char.name);
            });
            return { aliasToNameMap: aliasMap };
        } catch (e) {
            log.error(`加载角色数据失败: ${e}`);
            return { aliasToNameMap: {} };
        }
    },
    
    // 选择元素
    selectElement: async function(element) {
        if (element === "物") return;
        const elemIdx = Constants.elements.indexOf(element);
        const clickX = Math.round(787 + elemIdx * 57.5);
        await click(960, 45);
        await sleep(100);
        leftButtonDown();
        for (let j = 0; j < 10; j++) { moveMouseBy(15, 0); await sleep(10); }
        await sleep(500);
        leftButtonUp();
        await sleep(500);
        await click(clickX, 130);
        await sleep(500);
        await click(540, 45);
        await sleep(200);
    },
    
    // 选择角色
    selectCharacter: async function(name, region, aliasMap) {
        for (let i = 0; i < 99; i++) {
            const res = await OcrHelper.recognizeText(name, region, aliasMap);
            if (res) return res.text;
            await click(1840, 540);
            await sleep(200);
        }
        log.warn(`未找到角色：${name}`);
        return "";
    },
    
    // 提取魔物名称
    extractMonsterNames: function(textList) {
        const monsterNames = [];
        const regex = /(\d+)级以上([^，。\s]+)[:：]?[^\n]*掉落/;
        
        textList.forEach(text => {
            const match = text.match(regex);
            if (match && match[2] && !monsterNames.includes(match[2])) {
                let cleanName = match[2]
                    .replace(/少量|活化状态下|大量|少许|枯焦状态下/g, '')
                    .replace(/[^\u4e00-\u9fa50-9·]/g, '')
                    .trim();
                if (cleanName && !monsterNames.includes(cleanName)) {
                    monsterNames.push(cleanName);
                }
            }
        });
        
        return monsterNames;
    },
    
    // 识别魔物名称和材料数量
    identifyMonsterAndMaterials: async function() {
        const result = { monsterNames: [], star1: 0, star2: 0, star3: 0 };
        try {
            const monsterCheckTextList = await Utils.ocrRecognizeWithRetry(Constants.ocrRegions.monsterCheck.x, Constants.ocrRegions.monsterCheck.y, Constants.ocrRegions.monsterCheck.width, Constants.ocrRegions.monsterCheck.height, "识别掉落", 200, 20, true);
            
            const items = [];
            for (const item of monsterCheckTextList) {
                if (item.text && item.text.includes("掉落")) {
                    items.push({x: Math.round(item.x + item.width / 2), y: Math.round(item.y + item.height / 2)});
                }
            }
            
            if (items && items.length > 0) {
                await click(items[0].x, items[0].y);
                await sleep(2000);
            } else {
                log.warn("未识别到'掉落'");
            }
            
            for (let i = 0; i < 4; i++) {
                await click(48, 444);
                await sleep(300);
            }
            
            await click(960, 540); await sleep(1000);
            await click(1566, 736); await sleep(1000);
            
            let star1Coords = { x: 0, y: 0 };
            const probTextList = await Utils.ocrRecognizeWithRetry(
                Constants.ocrRegions.probabilityGet.x,
                Constants.ocrRegions.probabilityGet.y,
                Constants.ocrRegions.probabilityGet.width,
                Constants.ocrRegions.probabilityGet.height,
                "识别概率获得",
                200,
                20,
                true
            );
            
            const filteredList = (probTextList || []).filter(item => item.text && item.text.includes("概率获得"));
            
            if (filteredList && filteredList.length > 0) {
                const centerX = Math.round(filteredList[0].x + filteredList[0].width / 2);
                const centerY = Math.round(filteredList[0].y + filteredList[0].height / 2);
                star1Coords = { x: centerX + 270, y: centerY + 77 };
                await click(star1Coords.x, star1Coords.y);
                await sleep(800);
            } else {
                log.warn("未识别到'概率获得'");
            }
            
            const star1TextList = await Utils.ocrRecognizeWithRetry(Constants.ocrRegions.star1MaterialCount.x, Constants.ocrRegions.star1MaterialCount.y, Constants.ocrRegions.star1MaterialCount.width, Constants.ocrRegions.star1MaterialCount.height, "一星武器材料数量", 200, 20, false);
            result.star1 = Utils.extractNumber(star1TextList, "当前拥有");
            keyPress("VK_ESCAPE");
            await sleep(1000);
            
            if (star1Coords.x > 0) {
                await click(star1Coords.x - 180, star1Coords.y);
                await sleep(800);
                
                moveMouseTo(970, 428);
                await sleep(100);
                leftButtonDown();
                const steps = 10;
                const stepDist = -9;
                for (let k = 0; k < steps; k++) {
                    moveMouseBy(0, stepDist);
                    await sleep(10);
                }
                await sleep(500);
                leftButtonUp();
                await sleep(800);
                
                const monsterTextList = await Utils.ocrRecognizeWithRetry(
                    Constants.ocrRegions.monsterMaterialDesc.x,
                    Constants.ocrRegions.monsterMaterialDesc.y,
                    Constants.ocrRegions.monsterMaterialDesc.width,
                    Constants.ocrRegions.monsterMaterialDesc.height,
                    "武器魔物材料描述"
                );
                const monsterNames = this.extractMonsterNames(monsterTextList);
                result.monsterNames = monsterNames;
                log.info(`识别到武器材料魔物名称: ${monsterNames.join(", ")}`);
                
                const star1 = Number(result.star1) || 0;
                const star1MultipleOf3 = Math.floor(star1 / 3) * 3;
                const synthesizableCount = Utils.extractNumber(monsterTextList, "可合成数量") || 0;
                result.star2 = Math.round(synthesizableCount * 3 - star1MultipleOf3 / 3);
                result.star3 = Utils.extractNumber(monsterTextList, "当前拥有");
            }

            keyPress("VK_ESCAPE");
            await sleep(900);
            await click(1709, 1011);
            log.info("点击停止追踪...");
            await sleep(1500);
            for (let i = 0; i < 2; i++) {
                keyPress("VK_ESCAPE");
                await sleep(1000);
            }
            
        } catch (e) {
            log.error(`武器魔物材料识别失败: ${e.message}`);
        }
        return result;
    },
    
    // 检查命座加成
    checkConstellationBonus: async function(talentName) {
        try {
            const ocr = RecognitionObject.ocr(28, 270, 155, 49);
            const capture = captureGameRegion();
            const resList = capture.findMulti(ocr);
            let hasBonus = false;
            const allTexts = [];
            
            for (let i = 0; i < resList.Count; i++) {
                if (resList[i] && resList[i].text) {
                    const text = resList[i].text.trim();
                    allTexts.push(text);
                    if (text.includes("天赋等级+3") || text.includes("等级+3")) {
                        hasBonus = true;
                        break;
                    }
                }
                if (resList[i] && resList[i].Dispose) resList[i].Dispose();
            }
            
            log.info(`${talentName}命座加成识别文本：${allTexts.join(" | ")}`);
            keyPress("VK_ESCAPE");
            await sleep(1000);
            capture.dispose();
            
            if (!hasBonus && allTexts.length > 0) {
                for (const text of allTexts) {
                    if (text.includes("+3") && (text.includes("天赋") || text.includes("等级"))) {
                        hasBonus = true;
                        log.info(`模糊匹配到${talentName}命座加成`);
                        break;
                    }
                }
            }
            
            return hasBonus;
        } catch (e) {
            log.error(`检查${talentName}命座加成出错：${e.message || e}`);
            return false;
        }
    },
    
    // 查找角色并返回角色信息
    findCharacter: async function() {
        try {
            log.info("📌 校准并返回游戏主界面...");
            setGameMetrics(1920, 1080, 1);
            await genshin.returnMainUi();
            await sleep(1500);
            log.info("✅ 游戏主界面已加载");
            
            const targetName = settings.Character ? settings.Character.trim() : "";
            const targetElement = settings.Element ? settings.Element.trim() : "";
            
            log.info("尝试按下C键打开角色页面...");
            keyPress("VK_C");
            await sleep(1000);
            
            let isCharacterPageOpen = false;
            for (let verifyCount = 0; verifyCount < 3; verifyCount++) {
                const pageTextList = await Utils.ocrRecognizeWithRetry(200, 990, 110, 37, "验证角色页面");
                const pageText = pageTextList && pageTextList.length > 0 ? pageTextList[0] : "";
                
                if (pageText.includes("指南") || pageText.includes("提升")) {
                    log.info("已成功进入角色页面");
                    isCharacterPageOpen = true;
                    break;
                } else {
                    log.warn(`第${verifyCount + 1}次验证：未识别到角色页面标志，当前识别文本：${pageText}`);
                    if (verifyCount < 2) {
                        keyPress("VK_ESCAPE");
                        await sleep(500);
                        await genshin.returnMainUi();
                        await sleep(500);
                        keyPress("VK_C");
                        await sleep(1500);
                    }
                }
            }
            
            if (!isCharacterPageOpen) {
                log.error("无法进入角色页面，已验证3次");
                return false;
            }
            
            log.info(`查找目标角色：${targetName}（${targetElement}）`);
            
            const { aliasToNameMap } = await this.loadAvatarData();
            
            const checkCharacter = async (x, y) => {
                click(x, y);
                await sleep(800);
                
                const recogName = await this.selectCharacter(targetName, Constants.ocrRegions.checkChar, aliasToNameMap);
                log.info(`检测到角色：${recogName}（坐标：${x},${y}）`);
                if (!recogName) return false;
                
                setGameMetrics(1920, 1080, 1.25);
                
                let characterLevel = 0;
                try {
                    const levelRegion = { x: 1463, y: 204, width: 109, height: 37 };
                    const levelOcr = RecognitionObject.ocr(levelRegion.x, levelRegion.y, levelRegion.width, levelRegion.height);
                    const capture = captureGameRegion();
                    const resList = capture.findMulti(levelOcr);
                    
                    if (resList && resList.Count > 0) {
                        const levelText = resList[0].text || "";
                        const levelMatch = levelText.match(/等级(\d+)/);
                        if (levelMatch) {
                            characterLevel = parseInt(levelMatch[1], 10);
                            log.info(`识别到角色等级：${characterLevel}`);
                        } else {
                            const numMatch = levelText.match(/(\d+)/);
                            if (numMatch) {
                                characterLevel = parseInt(numMatch[1], 10);
                                log.info(`识别到角色等级：${characterLevel}`);
                            }
                        }
                    }
                    capture.dispose();
                } catch (e) {
                    log.warn(`角色等级识别失败：${e.message}`);
                }
                
                return {
                    found: true,
                    characterLevel: characterLevel
                };
            };
            
            const pureElement = targetElement.replace("元素", "").trim();
            log.info(`筛选元素：${pureElement}`);
            await this.selectElement(pureElement);
            
            log.info("遍历第一行角色...");
            const firstRowStartX = 618;
            const firstRowStartY = 175;
            const firstRowXStep = -129;
            const firstRowCols = 5;
            
            for (let col = 0; col < firstRowCols; col++) {
                const x = firstRowStartX + (col * firstRowXStep);
                const result = await checkCharacter(x, firstRowStartY);
                if (result && result.found) {
                    return result;
                }
            }
            
            log.warn(`未找到目标角色：${targetName}`);
            notification.warn(`未找到目标角色：${targetName}`);
            return { found: false, characterLevel: 0 };
            
        } catch (e) {
            log.error(`查找角色异常：${e.message}`);
            return { found: false, characterLevel: 0 };
        }
    },
    
    // 识别武器信息
    recognizeWeapon: async function(recognitionType = "weapon") {
        try {
            log.info("📌 开始识别武器信息...");
            
            let weaponStar = "未知星级";
            let weaponLevel = "";
            let weaponMaterialResult = {
                weapon1: { monsterNames: [], star1: 0, star2: 0, star3: 0 },
                weapon2: { monsterNames: [], star1: 0, star2: 0, star3: 0 }
            };
            let moraAmount = 0;
            let weaponDomainName = "";
            let useBackupRegion = false;
            
            click(962, 612);
            await sleep(800);
            click(181, 223);
            log.info("点击武器...");
            await sleep(800);
            
            try {
                const starCount = await Utils.retryTask(async () => {
                    const capture = captureGameRegion(Constants.starCaptureRegion.X, Constants.starCaptureRegion.Y, Constants.starCaptureRegion.Width, Constants.starCaptureRegion.Height);
                    const template = file.readImageMatSync(Constants.starTemplatePath);
                    if (!template) throw new Error("模板加载失败");
                    
                    const matchObj = RecognitionObject.TemplateMatch(template);
                    const matches = capture.FindMulti(matchObj);
                    const count = matches && matches.Count ? matches.Count : 0;
                    
                    for (let i = 0; i < (matches && matches.Count ? matches.Count : 0); i++) {
                        if (matches[i] && matches[i].Dispose) matches[i].Dispose();
                    }
                    capture.Dispose();
                    template.Dispose();
                    return count;
                }, "武器星级模板匹配");
                
                weaponStar = starCount === 1 ? "一星" : 
                             starCount === 3 ? "三星" : 
                             starCount === 4 ? "四星" : 
                             starCount === 5 ? "五星" : 
                             "0";
            } catch (e) {
                log.error(`武器星级识别异常：${e.message}`);
                weaponStar = "0";
            }
            log.info(`武器星级：${weaponStar}`);
            
            let isWeaponMaxLevel = false;
            
            if (weaponStar === "一星") {
                log.info("💡 一星武器无需培养，跳过武器等级识别");
                weaponLevel = "一星武器（跳过识别等级）";
                click(1721, 1007);
                log.info("点击强化或突破进入武器...");
                await sleep(1800);
                
                moraAmount = await this.recognizeMora();
                click(1847, 49);
                log.info("点击右上角返回键退出武器...");
                await sleep(1500);
            } else {
                click(1721, 1007);
                log.info("点击强化或突破进入武器...");
                await sleep(1800);
                
                moraAmount = await this.recognizeMora();
                
                const levelText1 = await Utils.retryTask(() => {
                    const region = RecognitionObject.ocr(Constants.ocrRegions.weaponLevel1.x, Constants.ocrRegions.weaponLevel1.y, Constants.ocrRegions.weaponLevel1.width, Constants.ocrRegions.weaponLevel1.height);
                    const capture = captureGameRegion();
                    const res = capture.find(region);
                    const text = Utils.cleanText(res.text || "");
                    capture.dispose();
                    return text;
                }, "武器等级（区域1）");
                
                if (levelText1) {
                    const match = levelText1.match(/等级(\d+)|(\d+)级/);
                    weaponLevel = match ? `${match[1] || match[2]}级未突破` : "";
                    
                    if (weaponLevel) {
                        log.info("识别武器魔物材料（区域1）...");
                        log.info("识别第一种武器材料...");
                        await click(1640, 880);
                        await sleep(800);
                        weaponMaterialResult.weapon1 = await this.identifyMonsterAndMaterials();
                        log.info(`✅ 第一种武器材料：${JSON.stringify(weaponMaterialResult.weapon1)}`);
                        
                        log.info("识别第二种武器材料...");
                        await click(1524, 881);
                        await sleep(800);
                        weaponMaterialResult.weapon2 = await this.identifyMonsterAndMaterials();
                        log.info(`✅ 第二种武器材料：${JSON.stringify(weaponMaterialResult.weapon2)}`);
                        
                        if (recognitionType === "all") {
                            log.info("识别武器秘境名称...");
                            await click(1405, 882);
                            await sleep(800);
                            weaponDomainName = await this.recognizeDomainName("weapon_domain");
                            if (weaponDomainName) {
                                log.info(`✅ 获取到武器秘境名称：${weaponDomainName}`);
                            } else {
                                await sleep(500);
                                await click(1350, 300);
                                await sleep(800);
                                log.info("未获取到武器秘境名称");
                            }
                        }
                    }
                }
                
                if (!weaponLevel) {
                    click(1529, 1017);//打开突破素材预览。
                    await sleep(1000);
                    const levelText2 = await Utils.retryTask(() => {
                        const region = RecognitionObject.ocr(Constants.ocrRegions.weaponLevel2.x, Constants.ocrRegions.weaponLevel2.y, Constants.ocrRegions.weaponLevel2.width, Constants.ocrRegions.weaponLevel2.height);
                        const capture = captureGameRegion();
                        const res = capture.find(region);
                        const text = Utils.cleanText(res.text || "");
                        capture.dispose();
                        return text;
                    }, "武器等级（区域2）");
                    
                    if (levelText2) {
                        const match = levelText2.match(/提升到(\d+)级|等级(\d+)|(\d+)级/);
                        const tempLevel = match ? `${match[1] || match[2] || match[3]}级未突破` : "";
                        
                        if (tempLevel) {
                            weaponLevel = tempLevel;
                            log.info(`备用区域识别到武器等级：${tempLevel}`);
                            
                            log.info("识别武器魔物材料（区域2）...");
                            log.info("识别第一种武器材料...");
                            await click(1099, 491);
                            await sleep(1000);
                            weaponMaterialResult.weapon1 = await this.identifyMonsterAndMaterials();
                            log.info(`✅ 第一种武器材料（备用区域）：${JSON.stringify(weaponMaterialResult.weapon1)}`);
                            
                            log.info("识别第二种武器材料...");
                            await click(956, 491);
                            await sleep(800);
                            weaponMaterialResult.weapon2 = await this.identifyMonsterAndMaterials();
                            log.info(`✅ 第二种武器材料（备用区域）：${JSON.stringify(weaponMaterialResult.weapon2)}`);
                            
                            if (recognitionType === "all") {
                                log.info("识别武器秘境名称...");
                                await click(816, 482);
                                await sleep(800);
                                weaponDomainName = await this.recognizeDomainName("weapon_domain");
                                if (weaponDomainName) {
                                    log.info(`✅ 获取到武器秘境名称：${weaponDomainName}`);
                                } else {
                                    await sleep(500);
                                    await click(1350, 300);
                                    await sleep(800);
                                    log.info("未获取到武器秘境名称");
                                }
                            }
                        }
                    
                        keyPress("VK_ESCAPE");
                        log.info("退出武器材料详情页面...");
                        await sleep(1000);
                    }
                }
                
                if (!weaponLevel) {
                    weaponLevel = "90级已突破（满级）";
                    isWeaponMaxLevel = true;
                    log.info("💡 武器等级识别失败，判定为90级满级，跳过魔物材料识别");
                    
                    moraAmount = await this.recognizeMora();
                }
                
                log.info(`武器突破等级：${weaponLevel}`);
                await sleep(900);
                keyPress("VK_ESCAPE");
                log.info("退出武器页面...");
                await sleep(1500);
            }
            
            if (weaponStar === "一星") {
                log.info(`武器突破等级：${weaponLevel}`);
            }
            
            return {
                weaponStar: weaponStar,
                weaponLevel: weaponLevel,
                weaponMaterialResult: weaponMaterialResult,
                moraAmount: moraAmount,
                weaponDomainName: weaponDomainName
            };
            
        } catch (e) {
            log.error(`武器识别异常：${e.message}`);
            return {
                weaponStar: "未知星级",
                weaponLevel: "",
                weaponMaterialResult: {
                    weapon1: { monsterNames: [], star1: 0, star2: 0, star3: 0 },
                    weapon2: { monsterNames: [], star1: 0, star2: 0, star3: 0 }
                },
                moraAmount: 0,
                weaponDomainName: ""
            };
        }
    },
    
    // 识别摩拉数量
    recognizeMora: async function() {
        try {
            const moraRegion = { x: 1618, y: 33, width: 165, height: 28 };
            const moraTextList = await Utils.ocrRecognize(moraRegion.x, moraRegion.y, moraRegion.width, moraRegion.height);
            
            let moraAmount = 0;
            if (moraTextList && moraTextList.length > 0) {
                const moraText = moraTextList[0] || "";
                const cleanMoraText = moraText.replace(/[^\d]/g, "");
                if (cleanMoraText) {
                    moraAmount = parseInt(cleanMoraText, 10);
                    if (!isNaN(moraAmount) && moraAmount >= 0) {
                        log.info(`识别到摩拉数量：${moraAmount}`);
                    }
                }
            }
            return moraAmount;
        } catch (e) {
            log.warn(`摩拉数量识别失败：${e.message}`);
            return 0;
        }
    },
    
    // 识别天赋信息
    recognizeTalent: async function() {
        try {
            log.info("📌 开始识别天赋信息...");
            await sleep(1000);
            click(189, 431);
            await sleep(1000);
            
            const talentNormal = await OcrHelper.getTalentLevel(Constants.ocrRegions.talentNormal, "普通攻击");
            const talentSkill = await OcrHelper.getTalentLevel(Constants.ocrRegions.talentSkill, "元素战技");
            let talentBurst = await OcrHelper.getTalentLevel(Constants.ocrRegions.talentBurst, "元素爆发");
            if (!talentBurst) talentBurst = await OcrHelper.getTalentLevel(Constants.ocrRegions.talentBurstBackup, "元素爆发（备用）");
            
            const talentLevels = [
                talentNormal || 1,
                talentSkill || 1,
                talentBurst || 1
            ];
            log.info(`等级识别完成：普攻=${talentLevels[0]} 级, 战技=${talentLevels[1]} 级, 爆发=${talentLevels[2]} 级`);
            
            log.info("开始识别命座加成...");
            
            const talentPositions = {
                skill: { x: 1760, y: 260, name: "战技" },
                burst: { x: 1760, y: 348, name: "爆发" },
                burstBackup: { x: 1760, y: 441, name: "爆发(备用)" }
            };
            
            if (talentLevels[1] > 3) {
                log.info("检查元素战技命座加成...");
                await click(talentPositions.skill.x, talentPositions.skill.y);
                await sleep(1000);
                if (await this.checkConstellationBonus("元素战技")) {
                    talentLevels[1] = Math.max(1, talentLevels[1] - 3);
                    log.info(`元素战技命座加成修正后等级：${talentLevels[1]} 级`);
                    await click(1085, 381);
                    await sleep(800);
                }
            }
            
            if (talentLevels[2] > 3) {
                log.info("检查元素爆发命座加成...");
                let burstBonusFound = false;
                
                if (talentBurst === await OcrHelper.getTalentLevel(Constants.ocrRegions.talentBurst, "元素爆发")) {
                    await click(talentPositions.burst.x, talentPositions.burst.y);
                    await sleep(1000);
                    burstBonusFound = await this.checkConstellationBonus("元素爆发(常规)");
                } else {
                    await click(talentPositions.burstBackup.x, talentPositions.burstBackup.y);
                    await sleep(1000);
                    burstBonusFound = await this.checkConstellationBonus("元素爆发(备用)");
                }
                
                if (burstBonusFound) {
                    talentLevels[2] = Math.max(1, talentLevels[2] - 3);
                    log.info(`元素爆发命座加成修正后等级：${talentLevels[2]} 级`);
                }
            }
            
            const finalTalentLevels = `${talentLevels[0]}-${talentLevels[1]}-${talentLevels[2]}`;
            log.info(`最终天赋等级：${finalTalentLevels}`);
            
            return {
                talentLevels: talentLevels,
                finalTalentLevels: finalTalentLevels
            };
            
        } catch (e) {
            log.error(`天赋识别异常：${e.message}`);
            return {
                talentLevels: [1, 1, 1],
                finalTalentLevels: "1-1-1"
            };
        }
    },
    // 识别秘境名称工具
    recognizeDomainName: async function(materialType = "domain") {
        try {
            log.info("📌 开始识别秘境名称...");
            
            if (materialType === "talent_name") {
                log.info("材料类型为天赋名称，识别区域文字...");
                
                const talentTextList = await Utils.ocrRecognizeWithRetry(716, 181, 283, 159, "识别天赋名称区域", 200, 20);
                
                if (!talentTextList || talentTextList.length === 0) {
                    log.warn("未识别到天赋名称区域文字");
                    return "";
                }
                
                const fullText = talentTextList.join("");
                log.info(`识别到的完整文字：${fullText}`);
                
                const bracketMatch = fullText.match(/「(.+?)」/);
                if (!bracketMatch || !bracketMatch[1]) {
                    log.warn("未找到「」包裹的文字");
                    return "";
                }
                
                const talentName = bracketMatch[1];
                log.info(`提取到天赋名称：${talentName}`);
                await sleep(800);
                await click(1358, 408);
                await sleep(800);
                await click(1358, 408);
                await sleep(500);
                return talentName;
            }
            
            if (materialType === "weapon_domain") {
                log.info("材料类型为武器秘境名称，识别区域文字...");
                
                const weaponTextList = await Utils.ocrRecognizeWithRetry(716, 85, 314, 290, "识别武器秘境名称区域", 200, 20);
                
                if (!weaponTextList || weaponTextList.length === 0) {
                    log.warn("未识别到武器秘境名称区域文字");
                    return "";
                }
                
                const fullText = weaponTextList.join("");
                log.info(`识别到的完整文字：${fullText}`);
                
                const deIndex = fullText.indexOf('的');
                const zhiIndex = fullText.indexOf('之');
                
                let endIndex = -1;
                if (deIndex !== -1 && zhiIndex !== -1) {
                    endIndex = Math.min(deIndex, zhiIndex);
                } else if (deIndex !== -1) {
                    endIndex = deIndex;
                } else if (zhiIndex !== -1) {
                    endIndex = zhiIndex;
                }
                
                if (endIndex === -1) {
                    log.warn("未找到'的'或'之'字符");
                    return "";
                }
                
                const startIndex = Math.max(0, endIndex - 4);
                const weaponDomainName = fullText.substring(startIndex, endIndex);
                log.info(`提取到武器秘境名称：${weaponDomainName}`);
                await sleep(800);
                await click(1345, 300);
                await sleep(800);

                return weaponDomainName;
            }
            
            moveMouseTo(970, 428);
            await sleep(100);
            leftButtonDown();
            const steps = 10;
            const stepDist = -9;
            for (let k = 0; k < steps; k++) {
                moveMouseBy(0, stepDist);
                await sleep(10);
            }
            await sleep(500);
            leftButtonUp();
            await sleep(800);
            
            let domainName = "";
            let clickOffset = 0;
            
            const ownershipTextList = await Utils.ocrRecognizeWithRetry(742, 834, 398, 196, "识别当前拥有", 200, 20, true);
            
            if (!ownershipTextList || ownershipTextList.length === 0) {
                log.warn("未识别到'当前拥有'文字，超时返回");
                return "";
            }
            
            const ownershipText = ownershipTextList.find(item => item.text.includes("当前拥有"));
            if (!ownershipText) {
                log.warn("未找到包含'当前拥有'的文字");
                return "";
            }
            
            log.info(`识别到文字：${ownershipText.text}`);
            
            clickOffset = 69;
            log.info("材料类型为Boss，偏移量：69");
            
            const clickX = ownershipText.x;
            const clickY = ownershipText.y - clickOffset;
            await click(clickX, clickY);
            await sleep(800);
            
            const nameTextList = await Utils.ocrRecognizeWithRetry(1485, 17, 340, 37, "识别Boss名称", 200, 20);
            
            if (nameTextList && nameTextList.length > 0) {
                domainName = nameTextList[0].trim();
                log.info(`识别到Boss名称：${domainName}`);
            } else {
                log.warn("未识别到Boss名称");
            }
            
            await click(1866, 42);
            await sleep(1500);
            await click(1866, 42);
            await sleep(2500);
            
            if (materialType === "boss" && domainName === "「冰风组曲」") {
                log.info("识别到Boss名称为冰风组曲，开始识别附加文字...");
                const additionalTextList = await Utils.ocrRecognizeWithRetry(965, 222, 169, 47, "识别冰风组曲附加文字", 200, 20);
                
                if (additionalTextList && additionalTextList.length > 0) {
                    const additionalText = additionalTextList[0].trim();
                    log.info(`识别到附加文字：${additionalText}`);
                    domainName = domainName + additionalText;
                    log.info(`组合后的名称：${domainName}`);
                } else {
                    log.warn("未识别到附加文字");
                }
            }
            
            await click(1358, 408);
            await sleep(500);
            
            return domainName;
            
        } catch (e) {
            log.error(`识别秘境名称异常：${e.message}`);
            return "";
        }
    },
    
    // 查询天赋秘境
    queryTalentDomain: async function(talentLevels) {
        try {
            log.info("📌 开始查询天赋秘境...");
            
            const allMaxLevel = talentLevels.every(level => level >= 10);
            if (allMaxLevel) {
                log.info("所有天赋等级均为10级，跳过天赋秘境检查");
                return "";
            }
            
            const minLevel = Math.min(...talentLevels);
            let selectedTalentIndex = -1;
            
            for (let i = 0; i < talentLevels.length; i++) {
                if (talentLevels[i] === minLevel) {
                    selectedTalentIndex = i;
                    break;
                }
            }
            
            if (selectedTalentIndex === -1) {
                log.warn("无法选择天赋");
                return "";
            }
            
            const talentPositions = [
                { x: 1760, y: 170, name: "普通攻击" },
                { x: 1760, y: 260, name: "战技" },
                { x: 1760, y: 348, name: "爆发" },
                { x: 1760, y: 441, name: "爆发(备用)" }
            ];
            
            let clickPosition;
            if (selectedTalentIndex === 2) {
                const talentBurst = await OcrHelper.getTalentLevel(Constants.ocrRegions.talentBurst, "元素爆发");
                if (talentBurst) {
                    clickPosition = talentPositions[2];
                    log.info(`选择元素爆发（常规位置）：${clickPosition.name}`);
                } else {
                    clickPosition = talentPositions[3];
                    log.info(`选择元素爆发（备用位置）：${clickPosition.name}`);
                }
            } else {
                clickPosition = talentPositions[selectedTalentIndex];
                log.info(`选择天赋：${clickPosition.name}，等级：${talentLevels[selectedTalentIndex]}`);
            }
            
            await click(clickPosition.x, clickPosition.y);
            await sleep(800);
            
            const materialClickX = talentLevels[selectedTalentIndex] >= 9 ? 137 : 214;
            await click(materialClickX, 911);
            await sleep(1000);
            
            const domainName = await this.recognizeDomainName("talent_name");
            await sleep(1000);
            await click(656, 577);
            await sleep(1500);
            if (domainName) {
                log.info(`✅ 获取到天赋秘境名称：${domainName}`);
            } else {
                log.info("未获取到天赋秘境名称");
            }
            
            return domainName;
            
        } catch (e) {
            log.error(`查询天赋秘境异常：${e.message}`);
            return "";
        }
    },
    
    // 识别角色突破信息
    recognizeCharacterBreak: async function(talentInfo = null, recognitionType = "break") {
        try {
            log.info("📌 开始识别角色突破信息...");
            
            let bossMaterialName = "";
            
            await sleep(1000);
            click(170, 152);
            await sleep(1000);
            click(1779, 190);
            await sleep(1000);
            
            const breakStatusList = await Utils.ocrRecognizeWithRetry(
                Constants.ocrRegions.breakStatus.x,
                Constants.ocrRegions.breakStatus.y,
                Constants.ocrRegions.breakStatus.width,
                Constants.ocrRegions.breakStatus.height,
                "角色突破状态"
            );
            const breakStatus = breakStatusList && breakStatusList.length > 0 ? breakStatusList[0] : "";
            
            let breakResult = "未知突破状态";
            if (breakStatus.includes("已突破")) {
                breakResult = "90级已突破";
            } else {
                const levelMatch = breakStatus.match(/(\d+)级/);
                if (levelMatch) {
                    const level = `${levelMatch[1]}级未突破`;
                    breakResult = ["20", "40", "50", "60", "70", "80"].includes(levelMatch[1]) ? level : `${level}（非标准等级）`;
                } else {
                    breakResult = `无法识别（${breakStatus}）`;
                }
            }
            log.info(`角色突破状态：${breakResult}`);
            
            const materialData = {
                localSpecialties: "",
                localAmount: 0,
                monsterMaterials: [],
                star1Amount: 0,
                star2Amount: 0,
                star3Amount: 0,
                needMonsterStar3: 0,
                needLocalAmount: 0
            };
            
            try {
                log.info("打开魔物材料详情页...");
                await click(996, 272);
                await sleep(800);
                
                if (recognitionType === "all") {
                    log.info("识别Boss材料名称...");
                    await click(889, 527);
                    await sleep(800);
                    bossMaterialName = await this.recognizeDomainName("boss");
                    if (bossMaterialName) {
                        log.info(`✅ 获取到Boss材料名称：${bossMaterialName}`);
                    } else {
                        log.info("未获取到Boss材料名称");
                    }
                }
                
                await click(1171, 525);
                await sleep(1000);
                
                log.info("滑动查看材料详情...");
                moveMouseTo(970, 428);
                await sleep(100);
                leftButtonDown();
                const steps = 14;
                const stepDistance = -12;
                for (let j = 0; j < steps; j++) {
                    moveMouseBy(0, stepDistance);
                    await sleep(10);
                }
                await sleep(500);
                leftButtonUp();
                await sleep(500);
                
                log.info("识别魔物材料信息...");
                const monsterTextList = await OcrHelper.recognizeMultiText(Constants.ocrRegions.monsterMaterialDesc, "魔物材料描述");
                const monsterNames = this.extractMonsterNames(monsterTextList);
                log.info(`识别到魔物名称：${monsterNames.join(", ")}`);
                
                const star1Count = Utils.extractNumber(monsterTextList, "可合成数量") * 3;
                materialData.star1Amount = star1Count;
                log.info(`一星魔物材料数量：${star1Count}`);
                
                const star2Count = Utils.extractNumber(monsterTextList, "当前拥有");
                materialData.star2Amount = star2Count;
                log.info(`二星魔物材料数量：${star2Count}`);
                
                monsterNames.forEach((name, index) => {
                    materialData.monsterMaterials.push({ name: name, amount: 0 });
                });
                
                keyPress("VK_ESCAPE");
                await sleep(800);
                
                log.info("打开三星材料详情页...");
                await click(1128, 272);
                await sleep(800);
                await click(1171, 525);
                await sleep(800);
                
                const threeStarTextList = await Utils.ocrRecognizeWithRetry(Constants.ocrRegions.threeStarMaterialCount.x, Constants.ocrRegions.threeStarMaterialCount.y, Constants.ocrRegions.threeStarMaterialCount.width, Constants.ocrRegions.threeStarMaterialCount.height, "三星魔物材料数量", 200, 20, false);
                const star3Count = Utils.extractNumber(threeStarTextList, "当前拥有");
                materialData.star3Amount = star3Count;
                log.info(`三星魔物材料数量：${star3Count}`);
                
                keyPress("VK_ESCAPE");
                await sleep(800);
                
                log.info("打开区域特产材料详情页...");
                await click(1029, 524);
                await sleep(1200);
                
                const localCountTextList = await Utils.ocrRecognizeWithRetry(Constants.ocrRegions.localSpecialtyCount.x, Constants.ocrRegions.localSpecialtyCount.y, Constants.ocrRegions.localSpecialtyCount.width, Constants.ocrRegions.localSpecialtyCount.height, "区域特产数量", 200, 20, false);
                const localCount = Utils.extractNumber(localCountTextList, "当前拥有");
                materialData.localAmount = localCount;
                log.info(`区域特产数量：${localCount}`);
                await sleep(500);
                
                log.info("识别「前往采集」文字...");
                const goCollectTextList = await Utils.ocrRecognizeWithRetry(Constants.ocrRegions.goCollect.x, Constants.ocrRegions.goCollect.y, Constants.ocrRegions.goCollect.width, Constants.ocrRegions.goCollect.height, "前往采集文字（带坐标）", 200, 20, true);
                
                const targetGoCollect = goCollectTextList.find(item => {
                    return item.text === "前往采集" || 
                           item.text.includes("前往") && 
                           !item.text.includes("采集区域") && 
                           !item.text.includes("推荐") && 
                           !item.text.includes("尘歌壶种植");
                });
                
                if (targetGoCollect) {
                    log.info(`识别到「前往采集」（精准坐标）：文字="${targetGoCollect.text}"，坐标X=${targetGoCollect.x}, Y=${targetGoCollect.y}`);
                    const clickX = Math.round(targetGoCollect.x + targetGoCollect.width / 2);
                    const clickY = Math.round(targetGoCollect.y + targetGoCollect.height / 2);
                    
                    const validXRange = [Constants.ocrRegions.goCollect.x, Constants.ocrRegions.goCollect.x + Constants.ocrRegions.goCollect.width];
                    const validYRange = [Constants.ocrRegions.goCollect.y, Constants.ocrRegions.goCollect.y + Constants.ocrRegions.goCollect.height];
                    
                    if (clickX >= validXRange[0] && clickX <= validXRange[1] && clickY >= validYRange[0] && clickY <= validYRange[1]) {
                        log.info(`点击「前往采集」中心位置：X=${clickX}, Y=${clickY}`);
                        await click(clickX, clickY);
                        await sleep(2000);
                    } else {
                        log.warn(`「前往采集」坐标超出有效范围，跳过点击：X=${clickX}, Y=${clickY}`);
                        await click(Constants.ocrRegions.goCollect.x + Constants.ocrRegions.goCollect.width / 2, Constants.ocrRegions.goCollect.y + Constants.ocrRegions.goCollect.height / 2);
                        await sleep(2000);
                    }
                    
                    log.info("识别地图详情页的区域特产名称...");
                    const mapNameTextList = await OcrHelper.recognizeMultiText(Constants.ocrRegions.mapLocalName, "地图详情页特产名称");
                    if (mapNameTextList.length > 0) {
                        const rawName = mapNameTextList[0];
                        materialData.localSpecialties = Utils.extractPureLocalName(rawName);
                        log.info(`识别到区域特产名称（原始）：${rawName}`);
                        log.info(`提取纯净名称：${materialData.localSpecialties}`);
                    } else {
                        materialData.localSpecialties = "未知区域特产";
                        log.warn("未识别到地图详情页的特产名称");
                    }
                    await sleep(500);
                    await click(1709, 1011);
                    log.info("点击停止追踪采集...");
                    await sleep(500);
                } else {
                    log.warn("未识别到精准的「前往采集」文字，使用原有逻辑提取特产名称");
                    await sleep(3500);
                    const localNameTextList = await OcrHelper.recognizeMultiText(Constants.ocrRegions.localSpecialtyName, "区域特产名称");
                    materialData.localSpecialties = localNameTextList.find(text => !text.includes("区域特产")&&!text.includes("突破素")) ? localNameTextList.find(text => !text.includes("区域特产")&&!text.includes("突破素")).trim() : "未知区域特产";
                    log.info(`识别到区域特产名称：${materialData.localSpecialties}`);
                }
                
                keyPress("VK_ESCAPE");
                log.info("退出地图详情页...");
                await sleep(1500);
                
                log.info("开始计算所需材料数量...");
                const currCharLvl = breakResult.match(/(\d+)级/) ? parseInt(breakResult.match(/(\d+)级/)[1]) : 0;
                const targetCharLvl = settings.bossRequireCounts ? parseInt(settings.bossRequireCounts.match(/(\d+)级/)[1]) : 80;
                
                const charBreakNeed = Utils.calcCharBreakMonster(currCharLvl, targetCharLvl);
                log.info(`角色突破所需魔物材料 - 一星：${charBreakNeed.star1}，二星：${charBreakNeed.star2}，三星：${charBreakNeed.star3}`);
                
                const targetTalents = (settings && settings.talentBookRequireCounts ? settings.talentBookRequireCounts : "10-10-10")
                    .split('-')
                    .map(l => isNaN(parseInt(l)) ? 10 : parseInt(l));
                
                const talentLevels = talentInfo && talentInfo.talentLevels ? talentInfo.talentLevels : [1, 1, 1];
                log.info(`使用天赋等级进行计算：${talentLevels.join('-')}`);
                
                const talentNeed = Utils.calcTalentMonster(talentLevels, targetTalents);
                log.info(`天赋升级所需魔物材料 - 一星：${talentNeed.star1}，二星：${talentNeed.star2}，三星：${talentNeed.star3}`);
                
                const totalNeed = {
                    star1: charBreakNeed.star1 + talentNeed.star1,
                    star2: charBreakNeed.star2 + talentNeed.star2,
                    star3: charBreakNeed.star3 + talentNeed.star3
                };
                log.info(`总计所需魔物材料 - 一星：${totalNeed.star1}，二星：${totalNeed.star2}，三星：${totalNeed.star3}`);
                
                const convertResult = Utils.convertToThreeStar(materialData.star1Amount, materialData.star2Amount, materialData.star3Amount);
                log.info(`现有材料转换为三星等价物：${convertResult.totalStar3}（剩余一星：${convertResult.remainStar1}，剩余二星：${convertResult.remainStar2}）`);
                
                const totalNeedStar3 = Utils.convertToThreeStar(totalNeed.star1, totalNeed.star2, totalNeed.star3).totalStar3;
                materialData.needMonsterStar3 = Math.max(0, totalNeedStar3 - convertResult.totalStar3);
                log.info(`角色等级突破和天赋升级还需获取三星魔物材料数量：${materialData.needMonsterStar3}`);
                
                const localNeed = Utils.calcCharBreakLocal(currCharLvl, targetCharLvl);
                materialData.needLocalAmount = Math.max(0, localNeed - materialData.localAmount);
                log.info(`角色突破所需区域特产：${localNeed}，当前拥有：${materialData.localAmount}，还需：${materialData.needLocalAmount}`);
                
            } catch (e) {
                log.error(`材料识别流程异常：${e.message}`);
            }
            
            await sleep(700);
            log.info("已退出突破预览");
            
            return {
                breakResult: breakResult,
                materialData: materialData,
                bossMaterialName: bossMaterialName
            };
            
        } catch (e) {
            log.error(`角色突破识别异常：${e.message}`);
            return {
                breakResult: "未知突破状态",
                materialData: {
                    localSpecialties: "",
                    localAmount: 0,
                    monsterMaterials: [],
                    star1Amount: 0,
                    star2Amount: 0,
                    star3Amount: 0,
                    needMonsterStar3: 0,
                    needLocalAmount: 0
                },
                bossMaterialName: ""
            };
        }
    },
    
    // 主函数：查找角色并获取等级（支持按需识别）
    findCharacterAndGetLevel: async function(recognitionType = "all") {
        try {
            log.info(`📌 开始角色识别流程（识别类型：${recognitionType}）...`);
            
            let characterInfo = null;
            let weaponInfo = null;
            let talentInfo = null;
            let breakInfo = null;
            let talentDomainName = "";
            
            if (recognitionType === "all" || recognitionType === "weapon" || recognitionType === "break") {
                characterInfo = await this.findCharacter();
                if (!characterInfo.found) {
                    log.error("未找到目标角色，识别终止");
                    return false;
                }
            }
            
            if (recognitionType === "all" || recognitionType === "weapon") {
                weaponInfo = await this.recognizeWeapon(recognitionType);
            }
            
            if (recognitionType === "all" || recognitionType === "break") {
                talentInfo = await this.recognizeTalent();
            }
            
            if (recognitionType === "all") {
                talentDomainName = await this.queryTalentDomain(talentInfo.talentLevels);
            }
            
            if (recognitionType === "all" || recognitionType === "break") {
                breakInfo = await this.recognizeCharacterBreak(talentInfo, recognitionType);
            }
            
            await this.saveConfig(recognitionType, characterInfo, weaponInfo, talentInfo, breakInfo, talentDomainName, weaponInfo ? weaponInfo.weaponDomainName : "", breakInfo ? breakInfo.bossMaterialName : "");
            
            log.info(`✅ 角色识别流程完成（识别类型：${recognitionType}）`);
            return true;
            
        } catch (e) {
            log.error(`脚本执行异常：${e.message}`);
            notification.error(`脚本执行失败：${e.message}`);
            return false;
        }
    },
    
    // 保存配置（增量更新）
    saveConfig: async function(recognitionType, characterInfo, weaponInfo, talentInfo, breakInfo, talentDomainName = "", weaponDomainName = "", bossMaterialName = "") {
        try {
            let existingConfig = [];
            try {
                const configContent = file.readTextSync(Constants.CONFIG_PATH);
                existingConfig = JSON.parse(configContent);
            } catch (e) {
                log.info("配置文件不存在或读取失败，将创建新配置");
            }
            
            const newConfig = [...existingConfig];
            
            if (recognitionType === "all" || recognitionType === "weapon") {
                const currWeaponLvl = weaponInfo.weaponLevel.match(/(\d+)级/) ? parseInt(weaponInfo.weaponLevel.match(/(\d+)级/)[1]) : 0;
                const targetWeaponLvl = settings.weaponMaterialRequireCounts ? parseInt(settings.weaponMaterialRequireCounts.match(/(\d+)级/)[1]) : 80;
                const weaponStar = weaponInfo.weaponStar;
                
                const w1Req = Utils.calcWeaponMonsterNeed(currWeaponLvl, targetWeaponLvl, 1);
                const w1Owned = weaponInfo.weaponMaterialResult.weapon1.star1 + (weaponInfo.weaponMaterialResult.weapon1.star2 * 3) + (weaponInfo.weaponMaterialResult.weapon1.star3 * 9);
                const weapon1RemainStar3 = Math.max(0, Math.ceil((w1Req - w1Owned) / 9));
                log.info(`✅第一个魔物材料需${w1Req}个star1，当前拥有${w1Owned}个star1，还需${weapon1RemainStar3}个3星魔物材料`);
                
                const w2Req = Utils.calcWeaponMonsterNeed(currWeaponLvl, targetWeaponLvl, 2);
                const w2Owned = weaponInfo.weaponMaterialResult.weapon2.star1 + (weaponInfo.weaponMaterialResult.weapon2.star2 * 3) + (weaponInfo.weaponMaterialResult.weapon2.star3 * 9);
                const weapon2RemainStar3 = Math.max(0, Math.ceil((w2Req - w2Owned) / 9));
                log.info(`✅第二个魔物材料需${w2Req}个star1，当前拥有${w2Owned}个star1，还需${weapon2RemainStar3}个3星魔物材料`);
                
                const weaponConfigObj = {
                    "weaponStar": weaponStar,
                    "weaponLevel": weaponInfo.weaponLevel
                };
                
                const moraConfigObj = {
                    "moraAmount": weaponInfo.moraAmount
                };
                
                let weapons1Materials = "";
                if (weaponInfo.weaponMaterialResult.weapon1.monsterNames && weaponInfo.weaponMaterialResult.weapon1.monsterNames.length > 0) {
                    weapons1Materials = weaponInfo.weaponMaterialResult.weapon1.monsterNames.join(", ");
                }
                
                let weapons2Materials = "";
                if (weaponInfo.weaponMaterialResult.weapon2.monsterNames && weaponInfo.weaponMaterialResult.weapon2.monsterNames.length > 0) {
                    weapons2Materials = weaponInfo.weaponMaterialResult.weapon2.monsterNames.join(", ");
                }
                
                const weaponMaterialObj = {
                    "needamount1 stars3": weapon1RemainStar3,
                    "Weapons1 material0": weapons1Materials,
                    "needamount2 stars3": weapon2RemainStar3,
                    "Weapons2 material0": weapons2Materials
                };
                
                let weaponMatCount = [0, 0, 0, 0];
                if (weaponStar !== "一星" && weaponStar !== "未知星级" && weaponStar !== "识别异常" && currWeaponLvl <= targetWeaponLvl && currWeaponLvl > 0) {
                    const rules = Constants.weaponMaterialRules[weaponStar];
                    for (const lvl of Constants.charLevels) {
                        if (lvl >= currWeaponLvl && lvl <= targetWeaponLvl) {
                            const mat = rules[lvl] || [0, 0, 0, 0];
                            weaponMatCount = weaponMatCount.map((v, i) => v + mat[i]);
                        }
                    }
                }
                const weaponDomainNeedStr = weaponMatCount.join("-");
                log.info(`✅武器秘境材料需求：${weaponDomainNeedStr}`);
                
                const weaponDomainObj = {
                    "weaponMaterialRequireCounts0": weaponDomainNeedStr
                };
                
                this.updateConfigObject(newConfig, weaponConfigObj);
                this.updateConfigObject(newConfig, moraConfigObj);
                this.updateConfigObject(newConfig, weaponMaterialObj);
                this.updateConfigObject(newConfig, weaponDomainObj);
            }
            
            if (recognitionType === "all" || recognitionType === "break") {
                const targetTalents = (settings && settings.talentBookRequireCounts ? settings.talentBookRequireCounts : "10-10-10")
                    .split('-')
                    .map(l => isNaN(parseInt(l)) ? 10 : parseInt(l));
                
                const [currTal1 = 0, currTal2 = 0, currTal3 = 0] = talentInfo.talentLevels;
                
                const calcTalentMat = (curr, target) => {
                    let total = [0, 0, 0];
                    if (curr >= target || curr < 1 || target > 10) return total;
                    for (let lvl = curr; lvl < target; lvl++) {
                        const key = `${lvl}-${lvl + 1}`;
                        const mat = Constants.talentBookRules[key] || [0, 0, 0];
                        total = total.map((v, i) => v + mat[i]);
                    }
                    return total;
                };
                
                const tal1Mat = calcTalentMat(currTal1, targetTalents[0]);
                const tal2Mat = calcTalentMat(currTal2, targetTalents[1]);
                const tal3Mat = calcTalentMat(currTal3, targetTalents[2]);
                const talentMatCount = [
                    tal1Mat[0] + tal2Mat[0] + tal3Mat[0],
                    tal1Mat[1] + tal2Mat[1] + tal3Mat[1],
                    tal1Mat[2] + tal2Mat[2] + tal3Mat[2]
                ];
                
                const talentLevelObj = {
                    "talentLevels": talentInfo.finalTalentLevels
                };
                const talentBookObj = {
                    "talentBookRequireCounts0": talentMatCount.join("-")
                };
                
                this.updateConfigObject(newConfig, talentLevelObj);
                this.updateConfigObject(newConfig, talentBookObj);
            }
            
            if (recognitionType === "all" || recognitionType === "break") {
                let magicMaterials = "";
                if (breakInfo.materialData.monsterMaterials && breakInfo.materialData.monsterMaterials.length > 0) {
                    magicMaterials = breakInfo.materialData.monsterMaterials.map(m => m.name).join(", ");
                }

                const materialObj = {
                    "LocalSpecialties": breakInfo.materialData.localSpecialties,
                    "needLocalAmount": breakInfo.materialData.needLocalAmount,
                    "needMonsterStar3": breakInfo.materialData.needMonsterStar3,
                    "Magic material0": magicMaterials
                };

                const currCharLvl = breakInfo.breakResult.match(/(\d+)级/) ? parseInt(breakInfo.breakResult.match(/(\d+)级/)[1]) : 0;
                const targetCharLvl = settings.bossRequireCounts ? parseInt(settings.bossRequireCounts.match(/(\d+)级/)[1]) : 80;

                let charMatCount = 0;
                if (currCharLvl <= targetCharLvl && currCharLvl > 0) {
                    for (const lvl of Constants.charLevels) {
                        if (lvl >= currCharLvl && lvl <= targetCharLvl) {
                            charMatCount += Constants.charBossMaterialRules[lvl] || 0;
                        }
                    }
                }

                const charLevelObj = {
                    "characterLevel": characterInfo.characterLevel,
                    "characterBreak": breakInfo.breakResult,
                    "bossRequireCounts0": charMatCount
                };

                this.updateConfigObject(newConfig, materialObj);
                this.updateConfigObject(newConfig, charLevelObj);
            }
            
            if (recognitionType === "all" && talentDomainName) {
                const domainObj = {
                    "talentDomainName": talentDomainName
                };
                this.updateConfigObject(newConfig, domainObj);
                log.info(`✅ 天赋名称已保存：${talentDomainName}`);
            }
            
            if (recognitionType === "all") {
                const weaponDomainObj = {
                    "weaponDomainName": weaponDomainName
                };
                this.updateConfigObject(newConfig, weaponDomainObj);
                log.info(`✅ 武器秘境名称已保存：${weaponDomainName}`);
            }
            
            if (recognitionType === "all" && bossMaterialName) {
                const bossMaterialObj = {
                    "bossMaterialName": bossMaterialName
                };
                this.updateConfigObject(newConfig, bossMaterialObj);
                log.info(`✅ Boss材料名称已保存：${bossMaterialName}`);
            }
            
            this.mergeConfigGroups(newConfig);
            file.writeTextSync(Constants.CONFIG_PATH, JSON.stringify(newConfig, null, 2));
            log.info(`✅ 材料计算完成，已保存到config.json`);
            log.info(`📊 配置内容：${JSON.stringify(newConfig, null, 2)}`);
            
        } catch (e) {
            log.error(`❌ 保存配置失败：${e.message}`);
        }
    },
    
    mergeConfigGroups: function(configArray) {
        const groups = [
            ["weaponStar", "weaponLevel"],
            ["needamount1 stars3", "Weapons1 material0", "needamount2 stars3", "Weapons2 material0"],
            ["LocalSpecialties", "needLocalAmount", "needMonsterStar3", "Magic material0"]
        ];
        
        for (const groupKeys of groups) {
            const mergedObj = {};
            const indicesToRemove = new Set();
            
            for (let i = 0; i < configArray.length; i++) {
                const item = configArray[i];
                let hasGroupKey = false;
                for (const key of groupKeys) {
                    if (item.hasOwnProperty(key)) {
                        mergedObj[key] = item[key];
                        hasGroupKey = true;
                    }
                }
                if (hasGroupKey) {
                    indicesToRemove.add(i);
                }
            }
            
            if (Object.keys(mergedObj).length > 0) {
                const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
                for (const index of sortedIndices) {
                    configArray.splice(index, 1);
                }
                configArray.push(mergedObj);
            }
        }
    },
    
    // 更新配置对象（增量更新）
    updateConfigObject: function(configArray, newObj) {
        const groupKeys = {
            "weaponStar": ["weaponStar", "weaponLevel"],
            "weaponLevel": ["weaponStar", "weaponLevel"],
            "needamount1 stars3": ["needamount1 stars3", "Weapons1 material0", "needamount2 stars3", "Weapons2 material0"],
            "Weapons1 material0": ["needamount1 stars3", "Weapons1 material0", "needamount2 stars3", "Weapons2 material0"],
            "needamount2 stars3": ["needamount1 stars3", "Weapons1 material0", "needamount2 stars3", "Weapons2 material0"],
            "Weapons2 material0": ["needamount1 stars3", "Weapons1 material0", "needamount2 stars3", "Weapons2 material0"],
            "LocalSpecialties": ["LocalSpecialties", "needLocalAmount", "needMonsterStar3", "Magic material0"],
            "needLocalAmount": ["LocalSpecialties", "needLocalAmount", "needMonsterStar3", "Magic material0"],
            "needMonsterStar3": ["LocalSpecialties", "needLocalAmount", "needMonsterStar3", "Magic material0"],
            "Magic material0": ["LocalSpecialties", "needLocalAmount", "needMonsterStar3", "Magic material0"]
        };
        
        for (const key in newObj) {
            const existingIndex = configArray.findIndex(item => item.hasOwnProperty(key));
            if (existingIndex !== -1) {
                configArray[existingIndex][key] = newObj[key];
            } else {
                let targetIndex = -1;
                
                if (groupKeys[key]) {
                    const groupKeyList = groupKeys[key];
                    targetIndex = configArray.findIndex(item => 
                        groupKeyList.some(gk => item.hasOwnProperty(gk))
                    );
                }
                
                if (targetIndex !== -1) {
                    configArray[targetIndex][key] = newObj[key];
                } else {
                    configArray.push({ [key]: newObj[key] });
                }
            }
        }
    },
};
