(async function () {
    try {
        log.info("开始执行自动按键脚本");
        
        // 确保游戏窗口激活
        log.info("请确保游戏窗口是激活状态");
        
        // 使用BetterGI提供的sleep函数（全局方法）
        // 注意：BetterGI已经提供了sleep函数，不需要重新定义
        
        // 从选项字符串中提取虚拟键码的函数
        function extractKeyCode(optionString) {
            if (!optionString || optionString === "无") {
                return null;
            }
            // 匹配括号内的键码，如"空格键(SPACE)"中的"SPACE"
            const match = optionString.match(/\(([^)]+)\)/);
            if (match && match[1]) {
                return match[1];
            }
            // 如果没有括号，直接返回原字符串
            return optionString;
        }
        
        // 从持续时间字符串中提取毫秒数
        function extractMilliseconds(durationString) {
            if (!durationString || durationString === "无") {
                return 100; // 默认值
            }
            const match = durationString.match(/(\d+)/);
            return match ? parseInt(match[1]) : 100;
        }
        
        // 从重复次数字符串中提取数字
        function extractRepeatCount(repeatString) {
            if (!repeatString || repeatString === "无") {
                return 1; // 默认值
            }
            const match = repeatString.match(/(\d+)/);
            return match ? parseInt(match[1]) : 1;
        }
        
        // 根据设置选择要按的键
        if (settings.keyConfig === "单个按键" && settings.singleKey) {
            const keyToPress = extractKeyCode(settings.singleKey);
            if (!keyToPress) {
                log.info("未选择按键，脚本结束");
                return;
            }
            
            const repeatCount = extractRepeatCount(settings.repeatCount);
            
            log.info(`准备按下单个按键: ${keyToPress}，重复 ${repeatCount} 次`);
            
            for (let i = 0; i < repeatCount; i++) {
                keyPress(keyToPress);
                log.info(`第${i+1}次按下: ${keyToPress}`);
                
                // 重复执行时的间隔
                if (i < repeatCount - 1) {
                    const delay = extractMilliseconds(settings.delayBetweenKeys);
                    if (delay > 0) {
                        await sleep(delay);
                    }
                }
            }
            
        } else if (settings.keyConfig === "组合键") {
            const modifierKey = extractKeyCode(settings.modifierKey);
            const mainKey = extractKeyCode(settings.mainKey);
            
            if (!modifierKey && !mainKey) {
                log.info("未选择组合键，脚本结束");
                return;
            }
            
            const repeatCount = extractRepeatCount(settings.repeatCount);
            
            if (modifierKey && mainKey) {
                log.info(`准备按下组合键: ${modifierKey} + ${mainKey}，重复 ${repeatCount} 次`);
                
                for (let i = 0; i < repeatCount; i++) {
                    // 按下组合键 - 使用BetterGI的正确方式
                    keyDown(modifierKey);
                    await sleep(100); // 确保修饰键按下
                    keyDown(mainKey);
                    await sleep(100); // 保持按键状态
                    keyUp(mainKey);
                    await sleep(50);
                    keyUp(modifierKey);
                    
                    log.info(`第${i+1}次按下组合键: ${modifierKey} + ${mainKey}`);
                    
                    // 重复执行时的间隔
                    if (i < repeatCount - 1) {
                        const delay = extractMilliseconds(settings.delayBetweenKeys);
                        if (delay > 0) {
                            await sleep(delay);
                        }
                    }
                }
            } else if (mainKey) {
                // 只有主键，没有修饰键
                log.info(`准备按下单个按键: ${mainKey}，重复 ${repeatCount} 次`);
                for (let i = 0; i < repeatCount; i++) {
                    keyPress(mainKey);
                    log.info(`第${i+1}次按下: ${mainKey}`);
                    
                    if (i < repeatCount - 1) {
                        const delay = extractMilliseconds(settings.delayBetweenKeys);
                        if (delay > 0) {
                            await sleep(delay);
                        }
                    }
                }
            } else if (modifierKey) {
                // 只有修饰键，没有主键
                log.info(`准备按下单个按键: ${modifierKey}，重复 ${repeatCount} 次`);
                for (let i = 0; i < repeatCount; i++) {
                    keyPress(modifierKey);
                    log.info(`第${i+1}次按下: ${modifierKey}`);
                    
                    if (i < repeatCount - 1) {
                        const delay = extractMilliseconds(settings.delayBetweenKeys);
                        if (delay > 0) {
                            await sleep(delay);
                        }
                    }
                }
            }
            
        } else if (settings.keyConfig === "按键序列" && settings.keySequence) {
            const keySequence = settings.keySequence;
            if (!keySequence.trim()) {
                log.info("按键序列为空，脚本结束");
                return;
            }
            
            const repeatCount = extractRepeatCount(settings.repeatCount);
            
            log.info(`准备按下按键序列: ${keySequence}，重复 ${repeatCount} 次`);
            
            // 按键名称映射表 - 将常见名称映射到虚拟键码
            const keyMapping = {
                // 特殊键
                "SPACE": "SPACE", "空格": "SPACE", "空格键": "SPACE",
                "ENTER": "RETURN", "回车": "RETURN", "回车键": "RETURN",
                "ESC": "ESCAPE", "ESCAPE": "ESCAPE", "退出": "ESCAPE", "退出键": "ESCAPE",
                "TAB": "TAB", "制表": "TAB", "制表键": "TAB",
                "BACKSPACE": "BACK", "退格": "BACK", "退格键": "BACK",
                "DELETE": "DELETE", "删除": "DELETE", "删除键": "DELETE",
                "INSERT": "INSERT", "插入": "INSERT", "插入键": "INSERT",
                "HOME": "HOME", "起始": "HOME", "起始键": "HOME",
                "END": "END", "结束": "END", "结束键": "END",
                "PAGEUP": "PRIOR", "PAGEUP": "PRIOR", "上页": "PRIOR", "上页键": "PRIOR",
                "PAGEDOWN": "NEXT", "PAGEDOWN": "NEXT", "下页": "NEXT", "下页键": "NEXT",
                
                // 方向键
                "UP": "UP", "上": "UP", "上方向": "UP", "上箭头": "UP",
                "DOWN": "DOWN", "下": "DOWN", "下方向": "DOWN", "下箭头": "DOWN", 
                "LEFT": "LEFT", "左": "LEFT", "左方向": "LEFT", "左箭头": "LEFT",
                "RIGHT": "RIGHT", "右": "RIGHT", "右方向": "RIGHT", "右箭头": "RIGHT",
                
                // 修饰键
                "CTRL": "CONTROL", "CONTROL": "CONTROL", "控制": "CONTROL", "控制键": "CONTROL",
                "ALT": "MENU", "MENU": "MENU", "菜单": "MENU", "菜单键": "MENU",
                "SHIFT": "SHIFT", "转换": "SHIFT", "转换键": "SHIFT",
                "WIN": "LWIN", "窗口": "LWIN", "窗口键": "LWIN",
                
                // 功能键
                "F1": "F1", "F2": "F2", "F3": "F3", "F4": "F4",
                "F5": "F5", "F6": "F6", "F7": "F7", "F8": "F8",
                "F9": "F9", "F10": "F10", "F11": "F11", "F12": "F12",
                
                // 字母键（直接使用）
                "A": "A", "B": "B", "C": "C", "D": "D", "E": "E",
                "F": "F", "G": "G", "H": "H", "I": "I", "J": "J",
                "K": "K", "L": "L", "M": "M", "N": "N", "O": "O",
                "P": "P", "Q": "Q", "R": "R", "S": "S", "T": "T",
                "U": "U", "V": "V", "W": "W", "X": "X", "Y": "Y", "Z": "Z",
                
                // 数字键（直接使用）
                "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
                "5": "5", "6": "6", "7": "7", "8": "8", "9": "9"
            };
            
            const keys = keySequence.split(',').map(key => key.trim().toUpperCase());
            
            for (let round = 0; round < repeatCount; round++) {
                log.info(`开始第${round+1}轮按键序列`);
                
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (key) {
                        // 查找映射的键码
                        const keyToPress = keyMapping[key] || key;
                        
                        log.info(`按下序列中的第${i+1}个键: ${keyToPress} (原始输入: ${key})`);
                        keyPress(keyToPress);
                        
                        // 按键间隔（最后一个按键后不需要间隔）
                        if (i < keys.length - 1) {
                            const delay = extractMilliseconds(settings.delayBetweenKeys);
                            if (delay > 0) {
                                await sleep(delay);
                            }
                        }
                    }
                }
                
                // 序列之间的间隔
                if (round < repeatCount - 1) {
                    const delay = extractMilliseconds(settings.delayBetweenKeys);
                    if (delay > 0) {
                        await sleep(delay);
                    }
                }
            }
            log.info("按键序列完成");
            
        } else {
            log.info("使用默认按键: F1");
            keyPress("F1");
            log.info("F1键已按下");
        }
        
        log.info("脚本执行完成");
        
    } catch (error) {
        log.error(`脚本执行出错: ${error.message}`);
    }
})();