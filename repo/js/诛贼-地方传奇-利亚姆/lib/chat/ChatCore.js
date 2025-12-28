// /**
//  * ChatCore —— 对话+表情包引擎
//  */
// var ChatCore = {

//     /* ==================== 常量配置 ==================== */
//     RULES_FILE: 'lib/chat/rules.json',
//     INPUT_FILE: 'lib/chat/input.txt',
//     LOG_FILE:   'lib/chat/chat_log.txt',
//     EMOJI_FILE: 'lib/chat/emoji.json',
//     EMOJI_DEFAULT: '乖巧',
//     EMOJI_DEFAULT_POS: [2, 2],

//     /* ==================== 工具方法 ==================== */
//     /**
//      * 统一日志
//      * @param {string} msg 内容
//      */
//     log: function (msg) {
//         if (typeof log !== 'undefined' && log.Info) log.Info('[Chat] ' + msg);
//     },

//     /**
//      * 当前时间字符串
//      * @returns {string}
//      */
//     now: function () {
//         return new Date().toLocaleString('zh-CN');
//     },

//     /**
//      * 安全读文本
//      * @param {string} path 文件路径
//      * @returns {string}
//      */
//     readText: function (path) {
//         try { return file.ReadTextSync(path); }
//         catch (e) { this.log(`读取失败: ${path} | ${e.message}`); return ''; }
//     },

//     /**
//      * 安全写日志
//      * @param {string} line 单行内容
//      */
//     appendLog: function (line) {
//         try { file.WriteTextSync(this.LOG_FILE, line + '\r\n', true); }
//         catch (e) { this.log(`写日志失败: ${e.message}`); }
//     },

//     /* ==================== 预处理 ==================== */
//     /**
//      * 简化的预处理：只做基本的清理
//      * @param {string} src 原始句
//      * @returns {string} 干净句
//      */
//     preprocess: function (src) {
//         let s = src;
//         // 全角转半角
//         s = s.replace(/[\uff01-\uff5e]/g, ch => 
//             String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
//         // 转小写
//         s = s.toLowerCase();
//         // 去标点，但保留空格（用于分词）
//         s = s.replace(/[^\u4e00-\u9fffa-z0-9\s]/g, '');
//         // 合并多个空格
//         s = s.replace(/\s+/g, ' ').trim();
//         return s;
//     },

//     /* ==================== 历史去重 ==================== */
//     history: new Set(),
//     DUPLICATE_REPLY: '@@DUPLICATE@@',
//     addHistory: function (s) { this.history.add(s); },
//     hasHistory: function (s) { return this.history.has(s); },

//     /* ==================== 规则合法性自检 ==================== */
//     /**
//      * 规则合法性扫描
//      * @param {object[]} rules 规则数组
//      * @param {string} fileName 文件名（日志用）
//      * @returns {boolean} true=通过
//      */
//     validataRules: function (rules, fileName) {
//         const ids = new Set();
//         for (let i = 0; i < rules.length; i++) {
//             const r = rules[i];
//             if (!r.id) { this.log(`[Validata] ${fileName} 第${i + 1}条缺失 id`); return false; }
//             if (ids.has(r.id)) { this.log(`[Validata] ${fileName} 第${i + 1}条 id 重复：${r.id}`); return false; }
//             ids.add(r.id);
//             if (typeof (r.priority || 5) !== 'number') { this.log(`[Validata] ${fileName} 第${i + 1}条 priority 非数字`); return false; }
//             const m = r.match || {};
//             const hasAny = (Array.isArray(m.exact) && m.exact.length) ||
//                 (Array.isArray(m.keyword) && m.keyword.length) ||
//                 (Array.isArray(m.regex) && m.regex.length);
//             if (!hasAny) { this.log(`[Validata] ${fileName} 第${i + 1}条 match 为空`); return false; }
//             if (!Array.isArray(r.replies) || r.replies.length === 0) { this.log(`[Validata] ${fileName} 第${i + 1}条 replies 为空`); return false; }
//         }
//         return true;
//     },

//     /* ==================== 对话规则 ==================== */
//     currentRules: [],
//     currentFile: '',

//     /**
//      * 加载对话规则（带自检）
//      * @param {string} [fileName='rules.json'] 文件路径
//      * @returns {object[]} 规则数组
//      */
//     loadRules: function (fileName = this.RULES_FILE) {
//         if (fileName === this.currentFile && this.currentRules.length) return this.currentRules;
//         const txt = this.readText(fileName);
//         if (!txt) { this.log(`规则文件 ${fileName} 为空或读取失败`); return []; }
//         try {
//             const obj = JSON.parse(txt);
//             const rules = Array.isArray(obj) ? obj : (obj.rules || []);
//             if (!this.validataRules(rules, fileName)) return [];
//             this.currentRules = rules;
//             this.currentFile = fileName;
//             this.log(`已加载规则文件：${fileName}，共 ${rules.length} 条`);
//             return rules;
//         } catch (e) {
//             this.log(`规则解析失败: ${e.message}`);
//             return [];
//         }
//     },

//     /**
//      * 简化但准确的匹配逻辑， 禁用编辑距离容错，避免错误匹配
//      * @param {string} msg 用户原句
//      * @param {object[]} rules 规则数组
//      * @returns {object|null} 命中的规则
//      */
// matchRule: function (msg, rules) {
//     const start = Date.now();
//     const cleanMsg = this.preprocess(msg);
//     this.log(`[PRE] "${msg}" -> "${cleanMsg}"`);
    
//     // 1. 首先检测明显的拒绝语句（最高优先级）
//     const explicitRefusePatterns = [
//         /网络不好/i,
//         /不好/i,
//         /网络差/i,
//         /容易掉/i,
//         /会掉线/i,
//         /不要/i,
//         /不可以/i,
//         /不行/i,
//         /不能/i,
//         /别烦/i,
//         /别打扰/i,
//         /没空/i,
//         /没时间/i,
//         /在忙/i,
//         /正忙/i,
//         /正打/i,
//         /在打/i,
//         /不方便/i
//     ];
    
//     for (const pattern of explicitRefusePatterns) {
//         if (pattern.test(msg)) {
//             this.log(`[MATCH-REFUSE] 直接拒绝匹配: "${msg}" 匹配拒绝模式`);
//             // 寻找拒绝类规则
//             const refuseRules = rules.filter(r => r.category === 'refuse');
//             if (refuseRules.length > 0) {
//                 // 返回优先级最高的拒绝规则
//                 const sortedRefuseRules = refuseRules.sort((a, b) => (a.priority || 5) - (b.priority || 5));
//                 return sortedRefuseRules[0];
//             }
//         }
//     }
    
//     // 2. 检测明显的身份验证语句（次高优先级）
//     const identityPatterns = [
//         /脚本/i,
//         /机器人/i,
//         /人机/i,
//         /AI/i,
//         /自动/i,
//         /广告/i,
//         /外挂/i,
//         /程序/i,
//         /代码/i,
//         /代干/i,
//         /代肝/i,
//         /科技/i,
//         /辅助/i,
//         /托管/i,
//         /代练/i
//     ];
    
//     for (const pattern of identityPatterns) {
//         if (pattern.test(msg)) {
//             this.log(`[MATCH-IDENTITY] 身份验证匹配: "${msg}" 匹配身份验证模式`);
//             // 寻找身份验证类规则
//             const identityRules = rules.filter(r => r.id === 'identity_check_hit');
//             if (identityRules.length > 0) {
//                 return identityRules[0];
//             }
//         }
//     }
    
//     // 3. 检测明显的询问语句
//     const askPatterns = [
//         /方便吗/i,
//         /介意吗/i,
//         /不影响吧/i,
//         /不介意吧/i,
//         /采点/i,
//         /打点/i,
//         /钓会儿/i
//     ];
    
//     for (const pattern of askPatterns) {
//         if (pattern.test(msg)) {
//             this.log(`[MATCH-ASK] 询问匹配: "${msg}" 匹配询问模式`);
//             // 寻找询问类规则
//             const askRules = rules.filter(r => r.id === 'ask_permission_001');
//             if (askRules.length > 0) {
//                 return askRules[0];
//             }
//         }
//     }
    
//     // 4. 按优先级正常匹配规则
//     const sortedRules = rules.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    
//     for (const rule of sortedRules) {
//         const match = rule.match || {};
        
//         // 先检查exact（精确匹配）
//         if (Array.isArray(match.exact) && match.exact.length > 0) {
//             for (const exactStr of match.exact) {
//                 if (msg === exactStr) {
//                     this.log(`[MATCH-EXACT] 完全匹配: "${msg}" -> "${exactStr}"`);
//                     return rule;
//                 }
                
//                 const cleanExact = this.preprocess(exactStr);
//                 if (cleanMsg === cleanExact) {
//                     this.log(`[MATCH-EXACT] 预处理匹配: "${cleanMsg}" -> "${cleanExact}"`);
//                     return rule;
//                 }
//             }
//         }
        
//         // 检查keyword（关键词匹配）- 使用简单包含匹配
//         if (Array.isArray(match.keyword) && match.keyword.length > 0) {
//             for (const keyword of match.keyword) {
//                 if (msg.includes(keyword) || cleanMsg.includes(this.preprocess(keyword))) {
//                     this.log(`[MATCH-KEYWORD] 包含匹配: "${msg}" 包含 "${keyword}"`);
//                     return rule;
//                 }
//             }
//         }
        
//         // 检查regex
//         if (Array.isArray(match.regex) && match.regex.length > 0) {
//             for (const regexStr of match.regex) {
//                 try {
//                     const regex = new RegExp(regexStr, 'i');
//                     if (regex.test(msg)) {
//                         this.log(`[MATCH-REGEX] 正则匹配: "${msg}" 匹配 "${regexStr}"`);
//                         return rule;
//                     }
//                 } catch (e) {
//                     this.log(`[ERROR] 正则表达式错误: ${regexStr} - ${e.message}`);
//                 }
//             }
//         }
//     }
    
//     const cost = Date.now() - start;
//     if (cost > 50) this.log(`【性能提示】匹配耗时 ${cost}ms`);
    
//     this.log(`[MATCH] 未命中任何规则`);
//     return null;
// },

//     /* ==================== 表情包规则 ==================== */
//     emojiRulesCache: [],

//     /**
//      * 加载表情包规则
//      * @param {string} [file='emoji.json'] 文件路径
//      * @returns {object[]} 表情规则数组
//      */
//     loadEmojiRules: function (file = this.EMOJI_FILE) {
//         if (this.emojiRulesCache.length) return this.emojiRulesCache;
//         const txt = this.readText(file);
//         if (!txt) { this.log(`emoji 文件缺失：${file}，使用兜底表情`); return []; }
//         try {
//             const obj = JSON.parse(txt);
//             const rules = Array.isArray(obj) ? obj : (obj.rules || []);
//             if (!this.validataRules(rules, file)) return [];
//             this.emojiRulesCache = rules;
//             this.log(`已加载 emoji 规则：${file}，共 ${rules.length} 条`);
//             return rules;
//         } catch (e) {
//             this.log(`emoji 解析失败: ${e.message}，使用兜底表情`);
//             return [];
//         }
//     },

//     /**
//      * 表情包匹配
//      * @param {string} userSentence 用户原句
//      * @returns {{emojiId:string,position:number[]}} 表情名称+位置
//      */
// matchEmoji: function (userSentence) {
//     // 1. 首先检查是否有表情规则缓存
//     const rules = this.emojiRulesCache;
//     if (rules.length === 0) {
//         // 如果没有表情规则，使用兜底表情
//         return { emojiId: this.EMOJI_DEFAULT, position: this.EMOJI_DEFAULT_POS };
//     }
    
//     // 2. 预处理用户句子
//     const cleanSentence = this.preprocess(userSentence);
    
//     // 3. 按优先级排序规则（数字越小优先级越高）
//     const sortedRules = rules.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    
//     // 4. 遍历规则寻找匹配
//     for (const rule of sortedRules) {
//         const match = rule.match || {};
        
//         // 4.1 先检查exact（精确匹配）
//         if (Array.isArray(match.exact) && match.exact.length > 0) {
//             for (const exactStr of match.exact) {
//                 if (userSentence === exactStr) {
//                     this.log(`[EMOJI-MATCH] exact匹配: "${userSentence}" -> "${exactStr}"`);
//                     return {
//                         emojiId: rule.replies[0] || this.EMOJI_DEFAULT,
//                         position: rule.position || this.EMOJI_DEFAULT_POS
//                     };
//                 }
//             }
//         }
        
//         // 4.2 检查keyword（关键词匹配）
//         if (Array.isArray(match.keyword) && match.keyword.length > 0) {
//             for (const keyword of match.keyword) {
//                 if (userSentence.includes(keyword)) {
//                     this.log(`[EMOJI-MATCH] keyword匹配: "${userSentence}" 包含 "${keyword}"`);
//                     return {
//                         emojiId: rule.replies[0] || this.EMOJI_DEFAULT,
//                         position: rule.position || this.EMOJI_DEFAULT_POS
//                     };
//                 }
//             }
//         }
        
//         // 4.3 检查regex
//         if (Array.isArray(match.regex) && match.regex.length > 0) {
//             for (const regexStr of match.regex) {
//                 try {
//                     const regex = new RegExp(regexStr, 'i');
//                     if (regex.test(userSentence)) {
//                         this.log(`[EMOJI-MATCH] regex匹配: "${userSentence}" 匹配 "${regexStr}"`);
//                         return {
//                             emojiId: rule.replies[0] || this.EMOJI_DEFAULT,
//                             position: rule.position || this.EMOJI_DEFAULT_POS
//                         };
//                     }
//                 } catch (e) {
//                     this.log(`[EMOJI-ERROR] 正则表达式错误: ${regexStr} - ${e.message}`);
//                 }
//             }
//         }
//     }
    
//     // 5. 如果没有任何规则匹配，使用兜底表情
//     this.log(`[EMOJI-MATCH] 未匹配到表情规则，使用默认`);
//     return { emojiId: this.EMOJI_DEFAULT, position: this.EMOJI_DEFAULT_POS };
// },

//     /* ==================== 回复选取 ==================== */
//     /**
//      * 随机挑选回复
//      * @param {object|null} rule 命中规则
//      * @returns {string} 回复文本
//      */
//     pickReply: function (rule) {
//         if (!rule || !Array.isArray(rule.replies) || rule.replies.length === 0) {
//             this.log(`[REPLY] 使用默认回复`);
//             return '(•ω•`)o';
//         }
//         const reply = rule.replies[Math.floor(Math.random() * rule.replies.length)];
//         this.log(`[REPLY] 从规则 ${rule.id} 的 ${rule.replies.length} 条回复中选择: "${reply}"`);
//         return reply;
//     },

//     /* ==================== 主流程 ==================== */
//     /**
//  * 单次对话处理函数（最简版）
//  * @param {string} userInput 用户输入的一句话
//  * @returns {object} 包含回复和表情信息的对象
//  * @returns {string} .reply - 回复文本
//  * @returns {string} .emojiId - 表情ID
//  * @returns {string} .emojiName - 表情名称（同emojiId）
//  * @returns {number[]} .position - 表情位置 [x, y]
//  */
// simpleChat: function (userInput) {
//     // 1. 每次调用都重新初始化（确保独立）
//     this.log(`[SimpleChat] 开始处理: "${userInput}"`);
    
//     // 2. 加载规则（简单加载）
//     let rules = [];
//     let emojiRules = [];
    
//     try {
//         // 加载对话规则
//         const rulesTxt = this.readText(this.RULES_FILE);
//         if (rulesTxt) {
//             const rulesObj = JSON.parse(rulesTxt);
//             rules = Array.isArray(rulesObj) ? rulesObj : (rulesObj.rules || []);
//         }
        
//         // 加载表情规则
//         const emojiTxt = this.readText(this.EMOJI_FILE);
//         if (emojiTxt) {
//             const emojiObj = JSON.parse(emojiTxt);
//             emojiRules = Array.isArray(emojiObj) ? emojiObj : (emojiObj.rules || []);
//         }
        
//         this.log(`[SimpleChat] 加载 ${rules.length} 条对话规则，${emojiRules.length} 条表情规则`);
//     } catch (e) {
//         this.log(`[SimpleChat] 规则加载失败: ${e.message}`);
//         // 返回兜底结果
//         return {
//             reply: "抱歉，我脑子有点晕～",
//             emojiId: this.EMOJI_DEFAULT,
//             emojiName: this.EMOJI_DEFAULT,
//             position: this.EMOJI_DEFAULT_POS
//         };
//     }
    
//     // 3. 匹配对话规则
//     const rule = this.matchRule(userInput, rules);
    
//     // 4. 选择回复
//     const reply = this.pickReply(rule);
    
//     // 5. 匹配表情（使用当前的表情规则缓存）
//     this.emojiRulesCache = emojiRules; // 临时设置表情规则
//     const emoji = this.matchEmoji(reply);
    
//     // 6. 清空表情缓存（可选，确保每次都是重新加载）
//     this.emojiRulesCache = [];
    
//     // 7. 简单日志
//     const ruleInfo = rule ? `规则: ${rule.id}` : '无规则匹配';
//     this.log(`[SimpleChat] ${ruleInfo} -> 回复: "${reply}" 表情: "${emoji.emojiId}"`);
    
//     // 8. 返回结果
//     return {
//         reply: reply,
//         emojiId: emoji.emojiId,
//         emojiName: emoji.emojiId,
//         position: emoji.position
//     };
// },

// chatWithHistory: function (userInput, isNewStart = false) {
//     // 1. 初始化历史记录（如果不存在）
//     if (!this.conversationHistory) {
//         this.conversationHistory = [];
//     }
    
//     // 2. 检查是否是新的开始
//     if (isNewStart) {
//         // 清空历史记录
//         this.conversationHistory = [];
//         this.log(`[ChatWithHistory] 新的对话开始，历史记录已清空`);
        
//         // 在日志文件中添加三个空行作为分隔
//         try {
//             file.WriteTextSync('data/dialogue_log.txt', '\n\n\n', true); // 追加模式
//             this.log(`[ChatWithHistory] 已添加分隔行到日志文件`);
//         } catch (e) {
//             this.log(`[ChatWithHistory] 写入分隔行失败: ${e.message}`);
//         }
//     } else {
//         // 3. 检查历史重复（如果不是新的开始）
//         const isDuplicate = this.conversationHistory.some(record => 
//             record.userInput === userInput
//         );
        
//         if (isDuplicate) {
//             this.log(`[ChatWithHistory] 历史重复，跳过处理: "${userInput}"`);
//             return {
//                 reply: "?",
//                 emojiId: "重复",
//                 emojiName: "重复", 
//                 position: [2, 2],
//                 isDuplicate: true
//             };
//         }
//     }
    
//     // 4. 调用simpleChat获取回复
//     this.log(`[ChatWithHistory] 调用simpleChat处理: "${userInput}"`);
//     const result = this.simpleChat(userInput);
    
//     // 5. 记录到历史
//     this.conversationHistory.push({
//         userInput: userInput,
//         reply: result.reply,
//         timestamp: new Date().toISOString()
//     });
    
//     // 6. 追加到日志文件
//     try {
//         const logEntry = `[${this.now()}] USER: ${userInput} | BOT: ${result.reply} [${result.emojiId}]\n`;
//         file.WriteTextSync('data/dialogue_log.txt', logEntry, true); // 追加模式
//         this.log(`[ChatWithHistory] 已写入日志: ${userInput} -> ${result.reply}`);
//     } catch (e) {
//         this.log(`[ChatWithHistory] 写入日志失败: ${e.message}`);
//     }
    
//     // 7. 返回结果（添加历史相关信息）
//     return {
//         ...result,
//         historyLength: this.conversationHistory.length,
//         isNewStart: isNewStart,
//         isDuplicate: false
//     };
// },


//     /**
//      * 主入口：对话+表情追加
//      * @param {string} [ruleFile='rules.json'] 对话规则文件
//      * @param {string} [emojiFile='emoji.json'] 表情规则文件
//      * @returns {string} 运行结果
//      */
//     main: async function (ruleFile = this.RULES_FILE, emojiFile = this.EMOJI_FILE) {
        
//         this.log('=== 离线对话系统启动 ===');

// // 1. 加载对话规则
// // 从指定的规则文件加载对话规则，如果加载失败则脚本退出
// const rules = this.loadRules(ruleFile);
// if (rules.length === 0) {
//     this.log('规则加载失败，脚本退出');
//     return 'fail';  // 返回失败状态，表示脚本执行失败
// }

// // 2. 预加载表情
// // 从表情规则文件加载表情包数据，为后续的表情匹配做准备
// // 这里只是预加载到内存缓存，实际使用时再匹配具体表情
// this.loadEmojiRules(emojiFile);

// // 3. 读输入
// // 读取输入文件的内容，按换行符分割成数组
// // 对每行进行trim处理（去除前后空格），并过滤掉空行
// const lines = this.readText(this.INPUT_FILE).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
// if (lines.length === 0) {
//     this.log('警告：输入文件为空');
//     return 'empty';  // 返回空状态，表示输入为空
// }

// // 记录读取到的输入行数，用于调试和监控
// this.log(`读取到 ${lines.length} 条输入`);

// // 4. 逐句处理
// // 遍历每一行输入，逐条处理用户消息
// for (let i = 0; i < lines.length; i++) {
//     const raw = lines[i];  // 获取原始行内容
    
//     // 跳过标题行和纯编号行
//     // 标题行通常以"###"开头，纯编号行如"1. "（后面没有内容）
//     // 这些行只是测试用例的分类标识，不是实际的对话内容
//     if (raw.startsWith('###') || /^\d+\.\s*$/.test(raw)) {
//         this.log(`[SKIP] 跳过标题行: ${raw}`);
//         continue;  // 跳过当前循环，继续处理下一行
//     }
    
//     // 提取纯文本（去除编号）
//     // 有些测试用例带有序号，如"1. 可以"，需要提取出"可以"
//     let pureText = raw;  // 默认使用原始文本
//     const numMatch = raw.match(/^\d+\.\s*(.+)$/);  // 匹配"数字. 内容"格式
//     if (numMatch) {
//         pureText = numMatch[1].trim();  // 提取出括号中的内容（纯文本）
//     }
    
//     // 记录当前处理的用户输入，带上序号便于跟踪
//     this.log(`\n[${i+1}] USER: "${pureText}"`);
    
//     // 检查历史重复
//     // 如果这条消息之前已经处理过，则跳过，避免重复回复
//     if (this.hasHistory(pureText)) {
//         this.log(`[HISTORY] 历史重复: ${pureText}`);
//         // 匹配表情（即使重复也匹配表情，保持一致性）
//         const dupEmoji = this.matchEmoji(pureText);
//         // 构造重复标记回复，包含特殊标识和表情
//         const dupText = `${this.DUPLICATE_REPLY} [${dupEmoji.emojiId}]`;
//         this.log(`BOT:  ${dupText}  （历史重复）`);
//         // 将重复对话记录到日志文件
//         this.appendLog(`[${this.now()}] USER: ${pureText} | BOT: ${dupText} [duplicate]`);
//         continue;  // 跳过后续处理，继续下一行
//     }

//     // 匹配规则
//     // 核心：根据用户输入的内容，在规则库中查找匹配的对话规则
//     // matchRule函数会返回匹配到的规则对象，如果没匹配到则返回null
//     const rule = this.matchRule(pureText, rules);
    
//     // 选择回复
//     // 从匹配到的规则中随机选择一条回复，如果没有匹配到规则则使用默认回复
//     // pickReply函数会处理规则为空的情况，返回兜底回复
//     const reply = this.pickReply(rule);
    
//     // 匹配表情
//     // 根据回复内容匹配适合的表情包
//     // 注意：这里是用回复句去匹配表情，而不是用用户输入句
//     const emoji = this.matchEmoji(reply);
//     // 构建完整回复：文本 + 表情包标识（格式："回复文本 [表情ID]"）
//     const fullReply = `${reply} [${emoji.emojiId}]`;
    
//     // 记录命中信息
//     // 在控制台输出匹配详情，便于调试：
//     // - 如果匹配到规则：显示规则ID和优先级
//     // - 如果没匹配到：显示"无规则匹配"
//     const ruleInfo = rule ? `规则: ${rule.id} (优先级: ${rule.priority || 5})` : '无规则匹配';
//     this.log(`BOT:  ${fullReply}  (${ruleInfo})`);
    
//     // 写入日志
//     // 将对话记录追加到日志文件中，格式为：
//     // [时间] USER: 用户输入 | BOT: 机器人回复
//     this.appendLog(`[${this.now()}] USER: ${pureText} | BOT: ${fullReply}`);
    
//     // 添加到历史
//     // 将当前处理过的用户输入添加到历史记录中，用于后续去重判断
//     this.addHistory(pureText);
// }

// // 全部处理完成后，输出完成信息
// this.log('\n=== 全部处理完成，日志已写入 ' + this.LOG_FILE + ' ===');
// return 'success';  // 返回成功状态，表示脚本执行成功
//     }
// };
/**
 * ChatCore —— 对话+表情包引擎
 */
var ChatCore = {

    /* ==================== 常量配置 ==================== */
    RULES_FILE: 'lib/chat/rules.json',
    INPUT_FILE: 'lib/chat/input.txt',
    LOG_FILE:   'lib/chat/chat_log.txt',
    EMOJI_FILE: 'lib/chat/emoji.json',
    EMOJI_DEFAULT: '乖巧',
    EMOJI_DEFAULT_POS: [2, 2],

    /* ==================== 工具方法 ==================== */
    /**
     * 统一日志
     * @param {string} msg 内容
     */
    log: function (msg) {
        if (typeof log !== 'undefined' && log.Info) log.Info('[Chat] ' + msg);
    },

    /**
     * 当前时间字符串
     * @returns {string}
     */
    now: function () {
        return new Date().toLocaleString('zh-CN');
    },

    /**
     * 安全读文本
     * @param {string} path 文件路径
     * @returns {string}
     */
    readText: function (path) {
        try { return file.ReadTextSync(path); }
        catch (e) { this.log(`读取失败: ${path} | ${e.message}`); return ''; }
    },

    /**
     * 安全写日志
     * @param {string} line 单行内容
     */
    appendLog: function (line) {
        try { file.WriteTextSync(this.LOG_FILE, line + '\r\n', true); }
        catch (e) { this.log(`写日志失败: ${e.message}`); }
    },

    /* ==================== 预处理 ==================== */
    /**
     * 简化的预处理：只做基本的清理
     * @param {string} src 原始句
     * @returns {string} 干净句
     */
    preprocess: function (src) {
        let s = src;
        // 全角转半角
        s = s.replace(/[\uff01-\uff5e]/g, ch => 
            String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
        // 转小写
        s = s.toLowerCase();
        // 去标点，但保留空格（用于分词）
        s = s.replace(/[^\u4e00-\u9fffa-z0-9\s]/g, '');
        // 合并多个空格
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    },

    /* ==================== 历史去重 ==================== */
    history: new Set(),
    DUPLICATE_REPLY: '@@DUPLICATE@@',
    addHistory: function (s) { this.history.add(s); },
    hasHistory: function (s) { return this.history.has(s); },

    /* ==================== 新增：回复历史记录 ==================== */
    replyHistory: [], // 存储历史回复内容
    
    /**
     * 检查当前回复是否在回复历史中已存在
     * @param {string} replyText 当前回复文本
     * @returns {boolean} true=回复内容重复
     */
    checkReplyDuplicate: function (replyText) {
        if (!this.replyHistory || this.replyHistory.length === 0) {
            return false;
        }
        
        // 检查当前回复是否在历史回复中存在
        const isDuplicate = this.replyHistory.some(historyReply => 
            historyReply === replyText
        );
        
        if (isDuplicate) {
            this.log(`[ReplyDuplicate] 检测到重复回复: "${replyText}"`);
        }
        
        return isDuplicate;
    },
    
    /**
     * 添加回复到回复历史
     * @param {string} replyText 回复文本
     */
    addReplyToHistory: function (replyText) {
        if (!this.replyHistory) {
            this.replyHistory = [];
        }
        
        // 添加当前回复到历史
        this.replyHistory.push(replyText);
        
        // 可选：限制历史记录长度，避免内存占用过大
        const MAX_HISTORY_LENGTH = 100;
        if (this.replyHistory.length > MAX_HISTORY_LENGTH) {
            this.replyHistory = this.replyHistory.slice(-MAX_HISTORY_LENGTH);
        }
        
        this.log(`[ReplyHistory] 添加到回复历史，当前数量: ${this.replyHistory.length}`);
    },
    
    /**
     * 清空回复历史
     */
    clearReplyHistory: function () {
        this.replyHistory = [];
        this.log('[ReplyHistory] 已清空回复历史记录');
    },

    /* ==================== 规则合法性自检 ==================== */
    /**
     * 规则合法性扫描
     * @param {object[]} rules 规则数组
     * @param {string} fileName 文件名（日志用）
     * @returns {boolean} true=通过
     */
    validataRules: function (rules, fileName) {
        const ids = new Set();
        for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            if (!r.id) { this.log(`[Validata] ${fileName} 第${i + 1}条缺失 id`); return false; }
            if (ids.has(r.id)) { this.log(`[Validata] ${fileName} 第${i + 1}条 id 重复：${r.id}`); return false; }
            ids.add(r.id);
            if (typeof (r.priority || 5) !== 'number') { this.log(`[Validata] ${fileName} 第${i + 1}条 priority 非数字`); return false; }
            const m = r.match || {};
            const hasAny = (Array.isArray(m.exact) && m.exact.length) ||
                (Array.isArray(m.keyword) && m.keyword.length) ||
                (Array.isArray(m.regex) && m.regex.length);
            if (!hasAny) { this.log(`[Validata] ${fileName} 第${i + 1}条 match 为空`); return false; }
            if (!Array.isArray(r.replies) || r.replies.length === 0) { this.log(`[Validata] ${fileName} 第${i + 1}条 replies 为空`); return false; }
        }
        return true;
    },

    /* ==================== 对话规则 ==================== */
    currentRules: [],
    currentFile: '',

    /**
     * 加载对话规则（带自检）
     * @param {string} [fileName='rules.json'] 文件路径
     * @returns {object[]} 规则数组
     */
    loadRules: function (fileName = this.RULES_FILE) {
        if (fileName === this.currentFile && this.currentRules.length) return this.currentRules;
        const txt = this.readText(fileName);
        if (!txt) { this.log(`规则文件 ${fileName} 为空或读取失败`); return []; }
        try {
            const obj = JSON.parse(txt);
            const rules = Array.isArray(obj) ? obj : (obj.rules || []);
            if (!this.validataRules(rules, fileName)) return [];
            this.currentRules = rules;
            this.currentFile = fileName;
            this.log(`已加载规则文件：${fileName}，共 ${rules.length} 条`);
            return rules;
        } catch (e) {
            this.log(`规则解析失败: ${e.message}`);
            return [];
        }
    },

    /**
     * 简化但准确的匹配逻辑， 禁用编辑距离容错，避免错误匹配
     * @param {string} msg 用户原句
     * @param {object[]} rules 规则数组
     * @returns {object|null} 命中的规则
     */
matchRule: function (msg, rules) {
    const start = Date.now();
    const cleanMsg = this.preprocess(msg);
    this.log(`[PRE] "${msg}" -> "${cleanMsg}"`);
    
    // 1. 首先检测明显的拒绝语句（最高优先级）
    const explicitRefusePatterns = [
        /网络不好/i,
        /不好/i,
        /网络差/i,
        /容易掉/i,
        /会掉线/i,
        /不要/i,
        /不可以/i,
        /不行/i,
        /不能/i,
        /别烦/i,
        /别打扰/i,
        /没空/i,
        /没时间/i,
        /在忙/i,
        /正忙/i,
        /正打/i,
        /在打/i,
        /不方便/i
    ];
    
    for (const pattern of explicitRefusePatterns) {
        if (pattern.test(msg)) {
            this.log(`[MATCH-REFUSE] 直接拒绝匹配: "${msg}" 匹配拒绝模式`);
            // 寻找拒绝类规则
            const refuseRules = rules.filter(r => r.category === 'refuse');
            if (refuseRules.length > 0) {
                // 返回优先级最高的拒绝规则
                const sortedRefuseRules = refuseRules.sort((a, b) => (a.priority || 5) - (b.priority || 5));
                return sortedRefuseRules[0];
            }
        }
    }
    
    // 2. 检测明显的身份验证语句（次高优先级）
    const identityPatterns = [
        /脚本/i,
        /机器人/i,
        /人机/i,
        /AI/i,
        /自动/i,
        /广告/i,
        /外挂/i,
        /程序/i,
        /代码/i,
        /代干/i,
        /代肝/i,
        /科技/i,
        /辅助/i,
        /托管/i,
        /代练/i
    ];
    
    for (const pattern of identityPatterns) {
        if (pattern.test(msg)) {
            this.log(`[MATCH-IDENTITY] 身份验证匹配: "${msg}" 匹配身份验证模式`);
            // 寻找身份验证类规则
            const identityRules = rules.filter(r => r.id === 'identity_check_hit');
            if (identityRules.length > 0) {
                return identityRules[0];
            }
        }
    }
    
    // 3. 检测明显的询问语句
    const askPatterns = [
        /方便吗/i,
        /介意吗/i,
        /不影响吧/i,
        /不介意吧/i,
        /采点/i,
        /打点/i,
        /钓会儿/i
    ];
    
    for (const pattern of askPatterns) {
        if (pattern.test(msg)) {
            this.log(`[MATCH-ASK] 询问匹配: "${msg}" 匹配询问模式`);
            // 寻找询问类规则
            const askRules = rules.filter(r => r.id === 'ask_permission_001');
            if (askRules.length > 0) {
                return askRules[0];
            }
        }
    }
    
    // 4. 按优先级正常匹配规则
    const sortedRules = rules.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    
    for (const rule of sortedRules) {
        const match = rule.match || {};
        
        // 先检查exact（精确匹配）
        if (Array.isArray(match.exact) && match.exact.length > 0) {
            for (const exactStr of match.exact) {
                if (msg === exactStr) {
                    this.log(`[MATCH-EXACT] 完全匹配: "${msg}" -> "${exactStr}"`);
                    return rule;
                }
                
                const cleanExact = this.preprocess(exactStr);
                if (cleanMsg === cleanExact) {
                    this.log(`[MATCH-EXACT] 预处理匹配: "${cleanMsg}" -> "${cleanExact}"`);
                    return rule;
                }
            }
        }
        
        // 检查keyword（关键词匹配）- 使用简单包含匹配
        if (Array.isArray(match.keyword) && match.keyword.length > 0) {
            for (const keyword of match.keyword) {
                if (msg.includes(keyword) || cleanMsg.includes(this.preprocess(keyword))) {
                    this.log(`[MATCH-KEYWORD] 包含匹配: "${msg}" 包含 "${keyword}"`);
                    return rule;
                }
            }
        }
        
        // 检查regex
        if (Array.isArray(match.regex) && match.regex.length > 0) {
            for (const regexStr of match.regex) {
                try {
                    const regex = new RegExp(regexStr, 'i');
                    if (regex.test(msg)) {
                        this.log(`[MATCH-REGEX] 正则匹配: "${msg}" 匹配 "${regexStr}"`);
                        return rule;
                    }
                } catch (e) {
                    this.log(`[ERROR] 正则表达式错误: ${regexStr} - ${e.message}`);
                }
            }
        }
    }
    
    const cost = Date.now() - start;
    if (cost > 50) this.log(`【性能提示】匹配耗时 ${cost}ms`);
    
    this.log(`[MATCH] 未命中任何规则`);
    return null;
},

    /* ==================== 表情包规则 ==================== */
    emojiRulesCache: [],

    /**
     * 加载表情包规则
     * @param {string} [file='emoji.json'] 文件路径
     * @returns {object[]} 表情规则数组
     */
    loadEmojiRules: function (file = this.EMOJI_FILE) {
        if (this.emojiRulesCache.length) return this.emojiRulesCache;
        const txt = this.readText(file);
        if (!txt) { this.log(`emoji 文件缺失：${file}，使用兜底表情`); return []; }
        try {
            const obj = JSON.parse(txt);
            const rules = Array.isArray(obj) ? obj : (obj.rules || []);
            if (!this.validataRules(rules, file)) return [];
            this.emojiRulesCache = rules;
            this.log(`已加载 emoji 规则：${file}，共 ${rules.length} 条`);
            return rules;
        } catch (e) {
            this.log(`emoji 解析失败: ${e.message}，使用兜底表情`);
            return [];
        }
    },

    /**
     * 表情包匹配
     * @param {string} userSentence 用户原句
     * @returns {{emojiId:string,position:number[]}} 表情名称+位置
     */
matchEmoji: function (userSentence) {
    // 1. 首先检查是否有表情规则缓存
    const rules = this.emojiRulesCache;
    if (rules.length === 0) {
        // 如果没有表情规则，使用兜底表情
        return { emojiId: this.EMOJI_DEFAULT, position: this.EMOJI_DEFAULT_POS };
    }
    
    // 2. 预处理用户句子
    const cleanSentence = this.preprocess(userSentence);
    
    // 3. 按优先级排序规则（数字越小优先级越高）
    const sortedRules = rules.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    
    // 4. 遍历规则寻找匹配
    for (const rule of sortedRules) {
        const match = rule.match || {};
        
        // 4.1 先检查exact（精确匹配）
        if (Array.isArray(match.exact) && match.exact.length > 0) {
            for (const exactStr of match.exact) {
                if (userSentence === exactStr) {
                    this.log(`[EMOJI-MATCH] exact匹配: "${userSentence}" -> "${exactStr}"`);
                    return {
                        emojiId: rule.replies[0] || this.EMOJI_DEFAULT,
                        position: rule.position || this.EMOJI_DEFAULT_POS
                    };
                }
            }
        }
        
        // 4.2 检查keyword（关键词匹配）
        if (Array.isArray(match.keyword) && match.keyword.length > 0) {
            for (const keyword of match.keyword) {
                if (userSentence.includes(keyword)) {
                    this.log(`[EMOJI-MATCH] keyword匹配: "${userSentence}" 包含 "${keyword}"`);
                    return {
                        emojiId: rule.replies[0] || this.EMOJI_DEFAULT,
                        position: rule.position || this.EMOJI_DEFAULT_POS
                    };
                }
            }
        }
        
        // 4.3 检查regex
        if (Array.isArray(match.regex) && match.regex.length > 0) {
            for (const regexStr of match.regex) {
                try {
                    const regex = new RegExp(regexStr, 'i');
                    if (regex.test(userSentence)) {
                        this.log(`[EMOJI-MATCH] regex匹配: "${userSentence}" 匹配 "${regexStr}"`);
                        return {
                            emojiId: rule.replies[0] || this.EMOJI_DEFAULT,
                            position: rule.position || this.EMOJI_DEFAULT_POS
                        };
                    }
                } catch (e) {
                    this.log(`[EMOJI-ERROR] 正则表达式错误: ${regexStr} - ${e.message}`);
                }
            }
        }
    }
    
    // 5. 如果没有任何规则匹配，使用兜底表情
    this.log(`[EMOJI-MATCH] 未匹配到表情规则，使用默认`);
    return { emojiId: this.EMOJI_DEFAULT, position: this.EMOJI_DEFAULT_POS };
},

    /* ==================== 回复选取 ==================== */
    /**
     * 随机挑选回复
     * @param {object|null} rule 命中规则
     * @returns {string} 回复文本
     */
    pickReply: function (rule) {
        if (!rule || !Array.isArray(rule.replies) || rule.replies.length === 0) {
            this.log(`[REPLY] 使用默认回复`);
            return '(•ω•`)o';
        }
        const reply = rule.replies[Math.floor(Math.random() * rule.replies.length)];
        this.log(`[REPLY] 从规则 ${rule.id} 的 ${rule.replies.length} 条回复中选择: "${reply}"`);
        return reply;
    },

    /* ==================== 主流程 ==================== */
    /**
 * 单次对话处理函数（最简版）
 * @param {string} userInput 用户输入的一句话
 * @returns {object} 包含回复和表情信息的对象
 * @returns {string} .reply - 回复文本
 * @returns {string} .emojiId - 表情ID
 * @returns {string} .emojiName - 表情名称（同emojiId）
 * @returns {number[]} .position - 表情位置 [x, y]
 */
simpleChat: function (userInput) {
    // 1. 每次调用都重新初始化（确保独立）
    this.log(`[SimpleChat] 开始处理: "${userInput}"`);
    
    // 2. 加载规则（简单加载）
    let rules = [];
    let emojiRules = [];
    
    try {
        // 加载对话规则
        const rulesTxt = this.readText(this.RULES_FILE);
        if (rulesTxt) {
            const rulesObj = JSON.parse(rulesTxt);
            rules = Array.isArray(rulesObj) ? rulesObj : (rulesObj.rules || []);
        }
        
        // 加载表情规则
        const emojiTxt = this.readText(this.EMOJI_FILE);
        if (emojiTxt) {
            const emojiObj = JSON.parse(emojiTxt);
            emojiRules = Array.isArray(emojiObj) ? emojiObj : (emojiObj.rules || []);
        }
        
        this.log(`[SimpleChat] 加载 ${rules.length} 条对话规则，${emojiRules.length} 条表情规则`);
    } catch (e) {
        this.log(`[SimpleChat] 规则加载失败: ${e.message}`);
        // 返回兜底结果
        return {
            reply: "抱歉，我脑子有点晕～",
            emojiId: this.EMOJI_DEFAULT,
            emojiName: this.EMOJI_DEFAULT,
            position: this.EMOJI_DEFAULT_POS
        };
    }
    
    // 3. 匹配对话规则
    const rule = this.matchRule(userInput, rules);
    
    // 4. 选择回复
    const reply = this.pickReply(rule);
    
    // 5. 匹配表情（使用当前的表情规则缓存）
    this.emojiRulesCache = emojiRules; // 临时设置表情规则
    const emoji = this.matchEmoji(reply);
    
    // 6. 清空表情缓存（可选，确保每次都是重新加载）
    this.emojiRulesCache = [];
    
    // 7. 简单日志
    const ruleInfo = rule ? `规则: ${rule.id}` : '无规则匹配';
    this.log(`[SimpleChat] ${ruleInfo} -> 回复: "${reply}" 表情: "${emoji.emojiId}"`);
    
    // 8. 返回结果
    return {
        reply: reply,
        emojiId: emoji.emojiId,
        emojiName: emoji.emojiId,
        position: emoji.position
    };
},

chatWithHistory: function (userInput, isNewStart = false) {
    // 1. 初始化历史记录（如果不存在）
    if (!this.conversationHistory) {
        this.conversationHistory = [];
    }
    
    // 2. 检查是否是新的开始
    if (isNewStart) {
        // 清空历史记录和回复历史
        this.conversationHistory = [];
        this.clearReplyHistory();
        this.log(`[ChatWithHistory] 新的对话开始，历史记录已清空`);
        
        // 在日志文件中添加三个空行作为分隔
        try {
            file.WriteTextSync('data/dialogue_log.txt', '\n\n\n', true); // 追加模式
            this.log(`[ChatWithHistory] 已添加分隔行到日志文件`);
        } catch (e) {
            this.log(`[ChatWithHistory] 写入分隔行失败: ${e.message}`);
        }
    } else {
        // 3. 检查历史重复（如果不是新的开始）
        const isDuplicate = this.conversationHistory.some(record => 
            record.userInput === userInput
        );
        
        if (isDuplicate) {
            this.log(`[ChatWithHistory] 历史重复，跳过处理: "${userInput}"`);
            return {
                reply: "",
                emojiId: "重复",
                emojiName: "重复", 
                position: [5, 3],
                isDuplicate: true,
                isReplyDuplicate: false  // 用户输入重复时，不涉及回复重复
            };
        }
    }
    
    // 4. 调用simpleChat获取回复
    this.log(`[ChatWithHistory] 调用simpleChat处理: "${userInput}"`);
    const result = this.simpleChat(userInput);
    
    // 5. 检查回复是否在回复历史中重复
    const isReplyDuplicate = this.checkReplyDuplicate(result.reply);
    
    // 6. 记录到历史
    this.conversationHistory.push({
        userInput: userInput,
        reply: result.reply,
        timestamp: new Date().toISOString()
    });
    
    // 7. 添加回复到回复历史
    this.addReplyToHistory(result.reply);
    
    // 8. 追加到日志文件
    try {
        const logEntry = `[${this.now()}] USER: ${userInput} | BOT: ${result.reply} [${result.emojiId}]\n`;
        file.WriteTextSync('data/dialogue_log.txt', logEntry, true); // 追加模式
        this.log(`[ChatWithHistory] 已写入日志: ${userInput} -> ${result.reply}`);
    } catch (e) {
        this.log(`[ChatWithHistory] 写入日志失败: ${e.message}`);
    }
    
    // 9. 返回结果（添加历史相关信息和回复重复标志）
    return {
        ...result,
        historyLength: this.conversationHistory.length,
        isNewStart: isNewStart,
        isDuplicate: false,
        isReplyDuplicate: isReplyDuplicate  // 新增：回复是否重复的标志
    };
},


    /**
     * 主入口：对话+表情追加
     * @param {string} [ruleFile='rules.json'] 对话规则文件
     * @param {string} [emojiFile='emoji.json'] 表情规则文件
     * @returns {string} 运行结果
     */
    main: async function (ruleFile = this.RULES_FILE, emojiFile = this.EMOJI_FILE) {
        
        this.log('=== 离线对话系统启动 ===');

// 1. 加载对话规则
// 从指定的规则文件加载对话规则，如果加载失败则脚本退出
const rules = this.loadRules(ruleFile);
if (rules.length === 0) {
    this.log('规则加载失败，脚本退出');
    return 'fail';  // 返回失败状态，表示脚本执行失败
}

// 2. 预加载表情
// 从表情规则文件加载表情包数据，为后续的表情匹配做准备
// 这里只是预加载到内存缓存，实际使用时再匹配具体表情
this.loadEmojiRules(emojiFile);

// 3. 读输入
// 读取输入文件的内容，按换行符分割成数组
// 对每行进行trim处理（去除前后空格），并过滤掉空行
const lines = this.readText(this.INPUT_FILE).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
if (lines.length === 0) {
    this.log('警告：输入文件为空');
    return 'empty';  // 返回空状态，表示输入为空
}

// 记录读取到的输入行数，用于调试和监控
this.log(`读取到 ${lines.length} 条输入`);

// 4. 逐句处理
// 遍历每一行输入，逐条处理用户消息
for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];  // 获取原始行内容
    
    // 跳过标题行和纯编号行
    // 标题行通常以"###"开头，纯编号行如"1. "（后面没有内容）
    // 这些行只是测试用例的分类标识，不是实际的对话内容
    if (raw.startsWith('###') || /^\d+\.\s*$/.test(raw)) {
        this.log(`[SKIP] 跳过标题行: ${raw}`);
        continue;  // 跳过当前循环，继续处理下一行
    }
    
    // 提取纯文本（去除编号）
    // 有些测试用例带有序号，如"1. 可以"，需要提取出"可以"
    let pureText = raw;  // 默认使用原始文本
    const numMatch = raw.match(/^\d+\.\s*(.+)$/);  // 匹配"数字. 内容"格式
    if (numMatch) {
        pureText = numMatch[1].trim();  // 提取出括号中的内容（纯文本）
    }
    
    // 记录当前处理的用户输入，带上序号便于跟踪
    this.log(`\n[${i+1}] USER: "${pureText}"`);
    
    // 检查历史重复
    // 如果这条消息之前已经处理过，则跳过，避免重复回复
    if (this.hasHistory(pureText)) {
        this.log(`[HISTORY] 历史重复: ${pureText}`);
        // 匹配表情（即使重复也匹配表情，保持一致性）
        const dupEmoji = this.matchEmoji(pureText);
        // 构造重复标记回复，包含特殊标识和表情
        const dupText = `${this.DUPLICATE_REPLY} [${dupEmoji.emojiId}]`;
        this.log(`BOT:  ${dupText}  （历史重复）`);
        // 将重复对话记录到日志文件
        this.appendLog(`[${this.now()}] USER: ${pureText} | BOT: ${dupText} [duplicate]`);
        continue;  // 跳过后续处理，继续下一行
    }

    // 匹配规则
    // 核心：根据用户输入的内容，在规则库中查找匹配的对话规则
    // matchRule函数会返回匹配到的规则对象，如果没匹配到则返回null
    const rule = this.matchRule(pureText, rules);
    
    // 选择回复
    // 从匹配到的规则中随机选择一条回复，如果没有匹配到规则则使用默认回复
    // pickReply函数会处理规则为空的情况，返回兜底回复
    const reply = this.pickReply(rule);
    
    // 检查回复是否在回复历史中重复
    const isReplyDuplicate = this.checkReplyDuplicate(reply);
    
    // 匹配表情
    // 根据回复内容匹配适合的表情包
    // 注意：这里是用回复句去匹配表情，而不是用用户输入句
    const emoji = this.matchEmoji(reply);
    // 构建完整回复：文本 + 表情包标识（格式："回复文本 [表情ID]"）
    const fullReply = `${reply} [${emoji.emojiId}]${isReplyDuplicate ? ' [回复重复]' : ''}`;
    
    // 记录命中信息
    // 在控制台输出匹配详情，便于调试：
    // - 如果匹配到规则：显示规则ID和优先级
    // - 如果没匹配到：显示"无规则匹配"
    const ruleInfo = rule ? `规则: ${rule.id} (优先级: ${rule.priority || 5})` : '无规则匹配';
    const duplicateInfo = isReplyDuplicate ? ' [回复内容重复]' : '';
    this.log(`BOT:  ${fullReply}  (${ruleInfo}${duplicateInfo})`);
    
    // 写入日志
    // 将对话记录追加到日志文件中，格式为：
    // [时间] USER: 用户输入 | BOT: 机器人回复
    this.appendLog(`[${this.now()}] USER: ${pureText} | BOT: ${fullReply}`);
    
    // 添加到历史
    // 将当前处理过的用户输入添加到历史记录中，用于后续去重判断
    this.addHistory(pureText);
    
    // 添加回复到回复历史
    this.addReplyToHistory(reply);
}

// 全部处理完成后，输出完成信息
this.log('\n=== 全部处理完成，日志已写入 ' + this.LOG_FILE + ' ===');
return 'success';  // 返回成功状态，表示脚本执行成功
    }
};