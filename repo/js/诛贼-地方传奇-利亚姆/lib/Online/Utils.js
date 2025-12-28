// =========================================================================
//                          Utils.js - 基础工具模块
// =========================================================================
// 此模块包含所有不依赖游戏逻辑的通用工具函数
// 增加了任务取消处理功能

var Utils = {
    // === 定时器工具 ===
    
    /**
     * 创建定时器对象
     * @param {number} timeout - 超时时间(毫秒)
     * @returns {Object} 定时器对象
     */
    createTimer: function(timeout) {
        let time = Date.now();
        return Object.freeze({
            reStart() { time = Date.now(); },
            isTimeout() { return Date.now() - time >= timeout; }
        });
    },
    
    // === 区域处理工具 ===
    
    /**
     * 安全裁剪区域，防止越界
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} w - 宽度
     * @param {number} h - 高度
     * @returns {Object} 安全的区域对象
     */
    safeROI: function(x, y, w, h) {
        const maxW = genshin.width;
        const maxH = genshin.height;

        const safeX = Math.max(0, x);
        const safeY = Math.max(0, y);
        const safeW = Math.min(w, maxW - safeX);
        const safeH = Math.min(h, maxH - safeY);

        return { x: safeX, y: safeY, width: safeW, height: safeH };
    },
    
    /**
     * 防御式ROI计算，防止越界
     * @param {number} cx - 起始X坐标
     * @param {number} cy - 起始Y坐标
     * @param {number} cw - 宽度
     * @param {number} ch - 高度
     * @param {number} imgWidth - 图像宽度
     * @param {number} imgHeight - 图像高度
     * @returns {Object} 安全的ROI区域
     */
    clampROI: function(cx, cy, cw, ch, imgWidth, imgHeight) {
        // 先保证起点不冲出左上角
        const x = Math.max(0, cx);
        const y = Math.max(0, cy);

        // 再保证终点不冲出右下角
        const maxW = imgWidth  - x;
        const maxH = imgHeight - y;

        // 如果起点已经超出屏幕，直接返回零矩形
        if (maxW <= 0 || maxH <= 0) {
            log.warn(`ROI 完全超出屏幕，跳过 OCR: 起点(${x},${y}), 屏幕(${imgWidth},${imgHeight})`);
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        const width  = Math.min(cw, maxW);
        const height = Math.min(ch, maxH);

        if (width !== cw || height !== ch) {
            log.info(`ROI 被裁剪: 请求(${cw}×${ch}) → 实际(${width}×${height})`);
        }

        return { x, y, width, height };
    },
    
    // === 配置验证工具 ===
    
    /**
     * 验证超时时间设置
     * @param {number|string} value - 用户设置的超时时间（秒）
     * @param {number} defaultValue - 默认超时时间（秒）
     * @param {string} timeoutType - 超时类型名称
     * @returns {number} - 验证后的超时时间（秒）
     */
    validateTimeoutSetting: function(value, defaultValue, timeoutType) {
        // 转换为数字
        const timeout = Number(value);

        // 检查是否为有效数字且大于0
        if (!isFinite(timeout) || timeout <= 0) {
            log.warn(`${timeoutType}超时设置无效，必须是大于0的数字，将使用默认值 ${defaultValue} 秒`);
            return defaultValue;
        }

        log.info(`${timeoutType}超时设置为 ${timeout} 秒`);
        return timeout;
    },
    
    // === 页面滚动工具 ===
    
    /**
     * 滚动页面（通用）
     * @param {number} totalDistance - 总滚动距离
     * @param {number} stepDistance - 单步滚动距离
     * @param {number} delayMs - 延迟时间(毫秒)
     */
    scrollPage: async function(totalDistance, stepDistance = 10, delayMs = 5) {
        moveMouseTo(400, 750);
        await sleep(50);
        leftButtonDown();
        const steps = Math.ceil(totalDistance / stepDistance);
        for (let j = 0; j < steps; j++) {
            const remainingDistance = totalDistance - j * stepDistance;
            const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
            moveMouseBy(0, -moveDistance);
            await sleep(delayMs);
        }
        await sleep(700);
        leftButtonUp();
        await sleep(100);
    },
    
    /**
     * 向下翻页（滚轮版）
     * @param {number} ok - 滚动次数
     */
    pageDown1: async function(ok = 42) {
        click(1111, 555);
        await sleep(100);
        for(let i = 0; i < ok; i++) {
            log.info("向下滑动");
            await keyMouseScript.runFile(`assets/滚轮下翻.json`);
        }
        await sleep(100);
    },
    
    /**
     * 向下翻页（鼠标拖拽版）
     * @param {number} totalDistance - 总滚动距离
     * @param {number} stepDistance - 单步滚动距离
     * @param {number} delayMs - 延迟时间(毫秒)
     */
    pageDown2: async function(totalDistance, stepDistance = 10, delayMs = 10) {
        moveMouseTo(1026, 880);
        await sleep(180);
        leftButtonDown();

        const steps = Math.ceil(totalDistance / stepDistance);
        for (let j = 0; j < steps; j++) {
            const remaining = totalDistance - j * stepDistance;
            const move = remaining < stepDistance ? remaining : stepDistance;
            moveMouseBy(0, -move);
            await sleep(delayMs);
        }

        await sleep(600);
        leftButtonUp();
        await sleep(550);
    },
    
    /**
     * 回到页面顶部
     * @param {Object} SliderTopRo - 滑块顶部识别对象
     */
    pageTop: async function(SliderTopRo) {
        let SliderTop = captureGameRegion().find(SliderTopRo);
        if (SliderTop.isExist()) {
            log.info("滑条顶端位置:({x},{y},{h},{w})", SliderTop.x, SliderTop.y, SliderTop.Width, SliderTop.Height);
            await moveMouseTo(Math.ceil(SliderTop.x + SliderTop.Width / 2), Math.ceil(SliderTop.y + SliderTop.Height * 1.5));
            leftButtonDown();
            await sleep(500);
            leftButtonUp();
            await moveMouseTo(0, 0);
            await sleep(1000);
        }
    },
    
    /**
     * 向下翻页（简化版）
     * @param {number} ok - 滚动次数
     */
    pageDown: async function(ok) {
        let SliderBottom = captureGameRegion().find(RightSliderBottomRo);
        if (SliderBottom.isExist()) {
            log.info("当前页面已点击完毕，向下滑动");
            log.info("滑块当前位置:({x},{y},{h},{w})", SliderBottom.x, SliderBottom.y, SliderBottom.Width, SliderBottom.Height);
            click(Math.ceil(SliderBottom.x + SliderBottom.Width / 2), Math.ceil(SliderBottom.y + SliderBottom.Height * 3.5));
            await moveMouseTo(0, 0);
            await sleep(600);
        }
    },
    
    // === 调试工具 ===
    
    /**
     * 绘制并清除红色框（占位函数，实际无操作）
     * @param {Object} rect - 矩形区域
     * @param {number} duration - 持续时间(毫秒)
     */
    drawAndClearRedBox: async function(rect, duration = 500) {
        // 当前版本什么都不做，保留接口
        // 可用于调试时绘制识别框
    },
    
    // === 别名读取工具 ===
    
    /**
     * 读取角色别名文件
     * @returns {Object} 别名映射对象
     */
    readAliases: function() {
        const combatText = file.ReadTextSync('assets/combat_avatar.json');
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
    
    // === 任务取消处理 ===
    
    /**
     * 安全执行函数，处理任务取消异常
     * @param {Function} fn 要执行的函数
     * @param {string} functionName 函数名称（用于日志）
     * @returns {Promise<any>} 函数执行结果
     */
    safeExecute: async function(fn, functionName = '匿名函数') {
        try {
            return await fn();
        } catch (error) {
            if (error.message && error.message.includes('was canceled')) {
                log.debug(`[${functionName}] 任务被取消`);
                return null;
            }
            log.error(`[${functionName}] 执行异常: ${error.message}`);
            throw error; // 重新抛出非取消异常
        }
    },
    
    /**
     * 带超时的安全执行
     * @param {Function} fn 要执行的函数
     * @param {number} timeout 超时时间(ms)
     * @param {string} functionName 函数名称
     * @returns {Promise<any>} 函数执行结果
     */
    safeExecuteWithTimeout: async function(fn, timeout = 5000, functionName = '匿名函数') {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`[${functionName}] 执行超时 (${timeout}ms)`));
            }, timeout);
            
            this.safeExecute(fn, functionName)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    },
    
    /**
     * 检查是否是任务取消错误
     * @param {Error} error 错误对象
     * @returns {boolean} 是否是任务取消错误
     */
    isTaskCanceledError: function(error) {
        return error && error.message && error.message.includes('was canceled');
    }
};