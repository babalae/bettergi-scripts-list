// // =========================================================================
// //                       Combat.js - 战斗检测与摩拉识别模块
// // =========================================================================
// // 此模块包含战斗检测、敌人识别、摩拉识别等战斗相关功能
// // 依赖：OCR.js, Utils.js, TaskManager.js

// var Combat = {
//     // === 常量定义 ===
//     // 敌人图标路径
//     ENEMY_IMAGE_DIR: 'assets/enemies/',
//     // 战斗界面标识图片
//     COMBAT_UI_IMAGE: 'assets/combat_ui.png',
//     HP_BAR_IMAGE: 'assets/hp_bar.png',
//     ENEMY_MARKER_IMAGE: 'assets/enemy_marker.png',
//     // 敌人配置JSON
//     ENEMY_CONFIG_FILE: 'assets/enemy_config.json',
//     // 摩拉识别区域
//     MORA_OCR_REGION: { x: 1620, y: 25, width: 152, height: 46 },
    
//     // === 状态变量 ===
//     isInCombat: false,
//     lastCombatTime: 0,
//     enemyCount: 0,
//     moraCache: 0,
//     moraCacheTime: 0,
    
//     // === 初始化函数 ===
    
//     /**
//      * 初始化战斗模块
//      */
//     init: function() {
//         log.info('初始化战斗模块...');
//         this.isInCombat = false;
//         this.lastCombatTime = 0;
//         this.enemyCount = 0;
//         this.moraCache = 0;
//         this.moraCacheTime = 0;
        
//         // 初始化敌人配置
//         this._loadEnemyConfig();
        
//         log.info('战斗模块初始化完成');
//     },
    
//     /**
//      * 加载敌人配置
//      */
//     _loadEnemyConfig: function() {
//         try {
//             const configText = file.ReadTextSync(this.ENEMY_CONFIG_FILE);
//             this.enemyConfig = JSON.parse(configText);
//             log.info(`已加载 ${Object.keys(this.enemyConfig).length} 种敌人配置`);
//         } catch (error) {
//             log.warn(`无法加载敌人配置: ${error.message}`);
//             this.enemyConfig = {};
//         }
//     },
    
//     // === 战斗检测函数 ===
    
//     /**
//      * 检测是否处于战斗状态
//      * @param {number} timeout - 检测超时时间(毫秒)
//      * @returns {Promise<boolean>} 是否在战斗中
//      */
//     isInCombatState: async function(timeout = 2000) {
//         try {
//             const startTime = Date.now();
//             let combatDetected = false;
            
//             // 多种方式检测战斗状态
//             while (Date.now() - startTime < timeout && !combatDetected) {
//                 // 方法1: 检测HP条
//                 if (await this._checkHPBars()) {
//                     combatDetected = true;
//                     break;
//                 }
                
//                 // 方法2: 检测战斗UI
//                 if (await this._checkCombatUI()) {
//                     combatDetected = true;
//                     break;
//                 }
                
//                 // 方法3: 检测敌人标记
//                 if (await this._checkEnemyMarkers()) {
//                     combatDetected = true;
//                     break;
//                 }
                
//                 // 短暂等待后重试
//                 await sleep(100);
//             }
            
//             this.isInCombat = combatDetected;
//             if (combatDetected) {
//                 this.lastCombatTime = Date.now();
//             }
            
//             return combatDetected;
//         } catch (error) {
//             if (!Utils.isTaskCanceledError(error)) {
//                 log.error(`战斗状态检测异常: ${error.message}`);
//             }
//             return false;
//         }
//     },
    
//     /**
//      * 检测HP条
//      */
//     _checkHPBars: async function() {
//         try {
//             const region = captureGameRegion();
//             const hpBarTemplate = file.ReadImageMatSync(this.HP_BAR_IMAGE);
//             const hpBarRo = RecognitionObject.TemplateMatch(
//                 hpBarTemplate,
//                 0, 0, genshin.width, genshin.height
//             );
//             hpBarRo.threshold = 0.7;
            
//             const result = region.find(hpBarRo);
//             return result && result.isExist();
//         } catch (error) {
//             return false;
//         }
//     },
    
//     /**
//      * 检测战斗UI
//      */
//     _checkCombatUI: async function() {
//         try {
//             const region = captureGameRegion();
//             const combatUiTemplate = file.ReadImageMatSync(this.COMBAT_UI_IMAGE);
//             const combatUiRo = RecognitionObject.TemplateMatch(
//                 combatUiTemplate,
//                 0, 0, genshin.width, 200
//             );
//             combatUiRo.threshold = 0.8;
            
//             const result = region.find(combatUiRo);
//             return result && result.isExist();
//         } catch (error) {
//             return false;
//         }
//     },
    
//     /**
//      * 检测敌人标记
//      */
//     _checkEnemyMarkers: async function() {
//         try {
//             const region = captureGameRegion();
//             const enemyMarkerTemplate = file.ReadImageMatSync(this.ENEMY_MARKER_IMAGE);
//             const enemyMarkerRo = RecognitionObject.TemplateMatch(
//                 enemyMarkerTemplate,
//                 0, 0, genshin.width, genshin.height
//             );
//             enemyMarkerRo.threshold = 0.75;
            
//             const result = region.find(enemyMarkerRo);
//             return result && result.isExist();
//         } catch (error) {
//             return false;
//         }
//     },
    
    
// // === 战斗结束检测函数 ===
// /**
//  * 检测战斗是否结束
//  * @returns {Promise<boolean>} 是否结束
//  */
// checkBattleEnd: async function() {
//     const startTime = Date.now();

//     keyPress('l');
//     await sleep(600);

//     while (Date.now() - startTime < 1500) {
//         /* 成功区域 OCR：862,63 → 179×23 */
//         const ocrResult = captureGameRegion().find(
//             RecognitionObject.ocr(862, 63, 179, 23)
//         );
//         if (ocrResult && ocrResult.text.includes('正在读取队伍信息')) {
//             log.info('战斗已结束（成功文案）');
//             keyPress('l');
//             keyPress('space');
//             return true;
//         }
//         await sleep(50);          // 短间隔再扫
//     }

//     log.info('检测111');
//     keyPress('l');
//     await sleep(600);

//     log.info('检测超时，视为未结束');
//     return false;
// },

// // === OCR识别函数 ===
// /**
//  * 通用：指定区域 OCR 识别
//  * @param {Object} ocrRegion  {x, y, width, height}
//  * @param {number} timeout    毫秒
//  * @returns {string|null}     识别到的文字或 null
//  */
// recognizeTextInRegion: async function(ocrRegion, timeout = 500) {
//     const startTime = Date.now();
//     while (Date.now() - startTime < timeout) {
//         try {
//             const ocrResult = captureGameRegion().find(
//                 RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
//             );
//             if (ocrResult) return ocrResult.text;
//         } catch (e) { /* 立即重试 */ }
//         await sleep(50);
//     }
//     return null;
// },
//     /**
//      * 等待战斗结束
//      * @param {number} timeout - 最大等待时间(毫秒)
//      * @param {number} checkInterval - 检查间隔(毫秒)
//      * @returns {Promise<boolean>} 是否战斗结束
//      */
//     waitForCombatEnd: async function(timeout = 60000, checkInterval = 1000) {
//         const startTime = Date.now();
//         let inCombat = false;
        
//         while (Date.now() - startTime < timeout) {
//             // 检查是否仍在战斗中
//             inCombat = await this.isInCombatState(1000);
            
//             if (!inCombat) {
//                 // 连续检查3次确保战斗真的结束了
//                 let allClear = true;
//                 for (let i = 0; i < 3; i++) {
//                     await sleep(500);
//                     if (await this.isInCombatState(500)) {
//                         allClear = false;
//                         break;
//                     }
//                 }
                
//                 if (allClear) {
//                     log.info('战斗已结束');
//                     return true;
//                 }
//             }
            
//             // 等待一段时间后再次检查
//             await sleep(checkInterval);
//         }
        
//         log.warn(`等待战斗结束超时 (${timeout}ms)`);
//         return false;
//     },
    
//     /**
//      * 检测附近的敌人数量
//      * @param {string} enemyType - 敌人类型（可选）
//      * @returns {Promise<number>} 敌人数量
//      */
//     detectEnemies: async function(enemyType = null) {
//         try {
//             const region = captureGameRegion();
//             let enemyCount = 0;
            
//             // 如果没有指定敌人类型，使用通用敌人标记检测
//             if (!enemyType) {
//                 const enemyMarkerTemplate = file.ReadImageMatSync(this.ENEMY_MARKER_IMAGE);
//                 const enemyMarkerRo = RecognitionObject.TemplateMatch(
//                     enemyMarkerTemplate,
//                     0, 0, genshin.width, genshin.height
//                 );
//                 enemyMarkerRo.threshold = 0.7;
                
//                 // 使用findMulti查找所有匹配
//                 const results = region.findMulti(enemyMarkerRo);
//                 enemyCount = results ? results.count : 0;
//             } else {
//                 // 检测特定类型的敌人
//                 enemyCount = await this._detectSpecificEnemy(enemyType);
//             }
            
//             this.enemyCount = enemyCount;
//             log.debug(`检测到 ${enemyCount} 个敌人${enemyType ? ` (类型: ${enemyType})` : ''}`);
//             return enemyCount;
//         } catch (error) {
//             if (!Utils.isTaskCanceledError(error)) {
//                 log.error(`敌人检测异常: ${error.message}`);
//             }
//             return 0;
//         }
//     },
    
//     /**
//      * 检测特定类型的敌人
//      */
//     _detectSpecificEnemy: async function(enemyType) {
//         try {
//             // 从配置中获取敌人图片路径
//             const enemyConfig = this.enemyConfig[enemyType];
//             if (!enemyConfig || !enemyConfig.images || enemyConfig.images.length === 0) {
//                 log.warn(`未找到敌人类型 ${enemyType} 的配置`);
//                 return 0;
//             }
            
//             const region = captureGameRegion();
//             let totalCount = 0;
            
//             // 检测所有该敌人的图片变体
//             for (const imageName of enemyConfig.images) {
//                 try {
//                     const imagePath = `${this.ENEMY_IMAGE_DIR}/${imageName}`;
//                     const enemyTemplate = file.ReadImageMatSync(imagePath);
//                     const enemyRo = RecognitionObject.TemplateMatch(
//                         enemyTemplate,
//                         0, 0, genshin.width, genshin.height
//                     );
//                     enemyRo.threshold = enemyConfig.threshold || 0.7;
                    
//                     const results = region.findMulti(enemyRo);
//                     totalCount += results ? results.count : 0;
//                 } catch (error) {
//                     log.warn(`无法加载敌人图片: ${imageName}`);
//                 }
//             }
            
//             return totalCount;
//         } catch (error) {
//             log.error(`检测特定敌人异常: ${error.message}`);
//             return 0;
//         }
//     },
    
//     // === 摩拉识别函数 ===
    
//     /**
//      * 识别当前摩拉数量
//      * @param {boolean} forceUpdate - 是否强制更新缓存
//      * @returns {Promise<number>} 摩拉数量
//      */
//     recognizeMora: async function(forceUpdate = false) {
//         // 检查缓存（5分钟内有效）
//         const now = Date.now();
//         if (!forceUpdate && this.moraCache > 0 && now - this.moraCacheTime < 300000) {
//             return this.moraCache;
//         }
        
//         let result = 0;
//         let tryTimes = 0;
//         const maxTries = 3;
        
//         while (result === 0 && tryTimes < maxTries) {
//             try {
//                 await genshin.returnMainUi();
//                 log.debug(`第 ${tryTimes + 1} 次尝试识别摩拉`);
                
//                 // 按下C键打开角色界面
//                 keyPress("C");
//                 await sleep(1500);
                
//                 // 尝试打开角色天赋界面
//                 const opened = await this._openCharacterTalentPage();
//                 if (!opened) {
//                     await genshin.returnMainUi();
//                     tryTimes++;
//                     continue;
//                 }
                
//                 // OCR识别摩拉数量
//                 const moraText = await OCR.ocrFixedRect(this.MORA_OCR_REGION, 500);
//                 if (moraText) {
//                     // 提取数字
//                     const moraMatch = moraText.match(/\d+/g);
//                     if (moraMatch && moraMatch.length > 0) {
//                         // 可能有多个数字，取最大的（可能是完整摩拉数）
//                         const numbers = moraMatch.map(num => parseInt(num, 10));
//                         result = Math.max(...numbers);
//                         log.info(`识别到摩拉数量: ${result.toLocaleString()}`);
//                     }
//                 }
                
//                 // 关闭界面
//                 await genshin.returnMainUi();
                
//                 if (result > 0) {
//                     // 更新缓存
//                     this.moraCache = result;
//                     this.moraCacheTime = now;
//                     break;
//                 }
                
//             } catch (error) {
//                 if (!Utils.isTaskCanceledError(error)) {
//                     log.error(`摩拉识别异常 (尝试 ${tryTimes + 1}): ${error.message}`);
//                 }
//             }
            
//             tryTimes++;
//             await sleep(1000);
//         }
        
//         if (result === 0) {
//             log.warn(`经过 ${maxTries} 次尝试，无法识别摩拉数量`);
//         }
        
//         return result;
//     },
    
//     /**
//      * 打开角色天赋界面
//      */
//     _openCharacterTalentPage: async function() {
//         let recognized = false;
//         const startTime = Date.now();
        
//         while (Date.now() - startTime < 5000) {
//             // 方法1: 识别并点击"天赋"文字
//             const talentText = "天赋";
//             const talentRegion = { x: 133, y: 395, width: 115, height: 70 };
//             const talentResult = await OCR.recognizeTextAndClick(talentText, talentRegion, 1000);
            
//             if (talentResult.success) {
//                 log.debug(`点击天赋文字，坐标: x=${talentResult.x}, y=${talentResult.y}`);
//                 recognized = true;
//                 break;
//             }
            
//             // 方法2: 使用图像识别点击天赋图标
//             const characterMenuResult = await OCR.recognizeImage(OCR.CharacterMenuRo, 1000);
//             if (characterMenuResult.success) {
//                 // 点击天赋图标的大概位置（根据界面布局调整）
//                 await click(177, 433);
//                 await sleep(500);
//                 recognized = true;
//                 break;
//             }
            
//             await sleep(500);
//         }
        
//         return recognized;
//     },
    
//     /**
//      * 获取摩拉变化量（与上次记录对比）
//      * @param {number} previousMora - 上次记录的摩拉数量
//      * @returns {Promise<{current: number, delta: number, increased: boolean}>} 摩拉变化信息
//      */
//     getMoraChange: async function(previousMora = 0) {
//         const currentMora = await this.recognizeMora();
//         const delta = currentMora - previousMora;
        
//         return {
//             current: currentMora,
//             previous: previousMora,
//             delta: delta,
//             increased: delta > 0,
//             decreased: delta < 0,
//             unchanged: delta === 0
//         };
//     },
    
//     // === 战斗统计函数 ===
    
//     /**
//      * 开始战斗统计
//      * @returns {Object} 统计对象
//      */
//     startCombatStats: function() {
//         return {
//             startTime: Date.now(),
//             enemyKills: 0,
//             moraGained: 0,
//             itemsDropped: [],
//             combatCount: 0,
//             damageDealt: 0,
//             damageTaken: 0
//         };
//     },
    
//     /**
//      * 更新战斗统计
//      * @param {Object} stats - 统计对象
//      * @param {string} eventType - 事件类型
//      * @param {any} data - 事件数据
//      */
//     updateCombatStats: function(stats, eventType, data = null) {
//         switch (eventType) {
//             case 'enemy_killed':
//                 stats.enemyKills++;
//                 if (data && data.mora) {
//                     stats.moraGained += data.mora;
//                 }
//                 if (data && data.items) {
//                     stats.itemsDropped.push(...data.items);
//                 }
//                 break;
                
//             case 'combat_started':
//                 stats.combatCount++;
//                 break;
                
//             case 'damage_dealt':
//                 stats.damageDealt += data || 0;
//                 break;
                
//             case 'damage_taken':
//                 stats.damageTaken += data || 0;
//                 break;
                
//             case 'combat_ended':
//                 stats.endTime = Date.now();
//                 stats.duration = stats.endTime - stats.startTime;
//                 break;
//         }
//     },
    
//     /**
//      * 获取战斗统计摘要
//      * @param {Object} stats - 统计对象
//      * @returns {Object} 统计摘要
//      */
//     getCombatStatsSummary: function(stats) {
//         const duration = stats.duration || (Date.now() - stats.startTime);
//         const durationMinutes = duration / 60000;
        
//         return {
//             duration: duration,
//             durationFormatted: `${Math.floor(duration / 60000)}分${Math.floor((duration % 60000) / 1000)}秒`,
//             enemyKills: stats.enemyKills,
//             killsPerMinute: durationMinutes > 0 ? stats.enemyKills / durationMinutes : 0,
//             moraGained: stats.moraGained,
//             moraPerMinute: durationMinutes > 0 ? stats.moraGained / durationMinutes : 0,
//             combatCount: stats.combatCount,
//             damageDealt: stats.damageDealt,
//             damageTaken: stats.damageTaken,
//             efficiency: stats.damageTaken > 0 ? stats.damageDealt / stats.damageTaken : Infinity
//         };
//     },
    
//     // === 战斗策略函数 ===
    
//     /**
//      * 执行自动战斗
//      * @param {Object} options - 战斗选项
//      * @returns {Promise<boolean>} 是否战斗成功
//      */
//     autoCombat: async function(options = {}) {
//         const defaultOptions = {
//             useSkills: true,
//             useBurst: true,
//             dodgeEnemyAttacks: true,
//             targetPriority: 'nearest', // nearest, weakest, strongest
//             combatTimeout: 30000,
//             healThreshold: 0.3
//         };
        
//         const settings = { ...defaultOptions, ...options };
//         let combatSuccess = false;
        
//         log.info(`开始自动战斗，目标优先级: ${settings.targetPriority}`);
        
//         try {
//             // 进入战斗状态
//             let inCombat = await this.isInCombatState(3000);
//             if (!inCombat) {
//                 log.info('未检测到战斗，尝试寻找敌人');
//                 // 寻找最近的敌人
//                 await this._findAndApproachEnemy();
//                 inCombat = await this.isInCombatState(3000);
//             }
            
//             if (!inCombat) {
//                 log.warn('无法进入战斗状态');
//                 return false;
//             }
            
//             const combatStartTime = Date.now();
            
//             // 战斗主循环
//             while (Date.now() - combatStartTime < settings.combatTimeout) {
//                 // 检查是否仍在战斗中
//                 inCombat = await this.isInCombatState(1000);
//                 if (!inCombat) {
//                     log.info('战斗结束');
//                     combatSuccess = true;
//                     break;
//                 }
                
//                 // 执行战斗策略
//                 await this._executeCombatStrategy(settings);
                
//                 // 短暂延迟，避免过快循环
//                 await sleep(100);
//             }
            
//             if (!combatSuccess) {
//                 log.warn(`战斗超时 (${settings.combatTimeout}ms)`);
//             }
            
//         } catch (error) {
//             if (!Utils.isTaskCanceledError(error)) {
//                 log.error(`自动战斗异常: ${error.message}`);
//             }
//             combatSuccess = false;
//         }
        
//         return combatSuccess;
//     },
    
//     /**
//      * 寻找并接近敌人
//      */
//     _findAndApproachEnemy: async function() {
//         try {
//             // 模拟按下TAB键锁定敌人
//             keyPress('VK_TAB');
//             await sleep(500);
            
//             // 向前移动接近敌人
//             keyDown('W');
//             await sleep(1000);
//             keyUp('W');
            
//             // 尝试攻击
//             keyPress('VK_LBUTTON');
//             await sleep(500);
            
//         } catch (error) {
//             log.error(`寻找敌人异常: ${error.message}`);
//         }
//     },
    
//     /**
//      * 执行战斗策略
//      */
//     _executeCombatStrategy: async function(settings) {
//         try {
            
            
//         } catch (error) {
//             log.error(`战斗策略执行异常: ${error.message}`);
//         }
//     },
    
//     // === 工具函数 ===
    
//     /**
//      * 重置战斗模块状态
//      */
//     reset: function() {
//         this.isInCombat = false;
//         this.lastCombatTime = 0;
//         this.enemyCount = 0;
//         log.debug('战斗模块状态已重置');
//     },
    
//     /**
//      * 获取模块状态信息
//      */
//     getStatus: function() {
//         return {
//             isInCombat: this.isInCombat,
//             lastCombatTime: new Date(this.lastCombatTime).toLocaleString(),
//             enemyCount: this.enemyCount,
//             moraCache: this.moraCache,
//             moraCacheAge: this.moraCacheTime > 0 ? 
//                 Math.floor((Date.now() - this.moraCacheTime) / 1000) : '无缓存'
//         };
//     }
// };

// // 自动初始化
// if (typeof genshin !== 'undefined') {
//     Combat.init();
// }