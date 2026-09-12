// 核心控制变量
let keyMouseHook = null;       
let isAltPressed = false;      
let firstPoint = null;         
let isScriptRunning = true;    

// ===================== 红框绘制函数（精简日志）=====================
async function drawAndClearRedBox(searchRegion, ra, delay = 500) {
    if (!isScriptRunning || !ra || !searchRegion || searchRegion.width <= 0 || searchRegion.height <= 0) return;

    let drawRegion = null;
    try {
        drawRegion = ra.DeriveCrop(searchRegion.x, searchRegion.y, searchRegion.width, searchRegion.height);
        drawRegion.DrawSelf("rect"); 
        await sleep(delay);
        ra.DeriveCrop(0, 0, 0, 0).DrawSelf("rect");
    } catch (e) {
        if (!e.message.includes("task was canceled")) log.error(`红框绘制异常：${e.message}`);
    } finally {
        if (drawRegion && typeof drawRegion.dispose === 'function') drawRegion.dispose();
    }
}

// ===================== OCR函数（指定XYWH格式+识图范围+两点坐标）=====================
async function performOcrOnce(x1, y1, x2, y2) {
    if (!isScriptRunning) return;

    log.info(`===== 开始OCR识别 =====`);
    log.info(`识别区域：左上(${x1},${y1}) → 右下(${x2},${y2})`);

    const ra = captureGameRegion();
    if (!ra) {
        log.error("OCR失败：未捕获到游戏区域");
        log.info(`===== OCR识别结束 =====\n`);
        return;
    }

    const width = x2 - x1;
    const height = y2 - y1;
    if (width <= 0 || height <= 0) {
        log.error(`OCR失败：无效区域（宽=${width}，高=${height}）`);
        ra.dispose();
        log.info(`===== OCR识别结束 =====\n`);
        return;
    }

    let resList = ra.findMulti(RecognitionObject.ocr(x1, y1, width, height));
    log.info(`OCR识别完成，共识别到 ${resList.count} 段文本：`);

    if (resList.count === 0) {
        log.info("识别结果：无文本");
    } else {
        for (let i = 0; i < resList.count; i++) {
            const res = resList[i];
            // 核心XYWH信息
            const xywh = `x: ${res.x}, y: ${res.y}, width: ${res.width}, height: ${res.height}`;
            // 识图范围推荐（x-1, y-1, width+2, height+2）
            const recommendRange = `识图范围推荐: ${res.x-1}, ${res.y-1}, ${res.width+2}, ${res.height+2}`;
            // 两点坐标（左上/右下）
            const leftTop = `(${res.x},${res.y})`;
            const rightBottom = `(${res.x + res.width},${res.y + res.height})`;
            const twoPoint = `坐标范围：左上${leftTop} → 右下${rightBottom}`;
            
            // 按指定格式输出完整信息
            log.info(`结果[${i+1}]：文字="${res.text}" | ${xywh} | ${recommendRange} | ${twoPoint}`);
        }
    }

    ra.dispose();
    log.info(`===== OCR识别结束 =====\n`);
}

// ===================== 优雅退出 =====================
function gracefulExit() {
    isScriptRunning = false;
    if (keyMouseHook && typeof keyMouseHook.dispose === 'function') {
        keyMouseHook.dispose();
    }
    log.info("脚本已终止，资源已释放");
}

// ===================== 主函数（修复语法错误+精简日志）=====================
async function main() {
    log.info("========== OCR识别脚本启动 ==========");
    log.info("操作说明：按住左Alt+右键选两点 → 触发OCR识别；Alt+左键重置");

    // 创建键鼠钩子
    keyMouseHook = new KeyMouseHook();
    if (!keyMouseHook) {
        log.error("键鼠钩子创建失败！请以管理员运行BGI");
        return;
    }

    // 监听Alt键（LMenu/RMenu）
    keyMouseHook.OnKeyDown((keyCode) => {
        if (!isScriptRunning) return;
        if (keyCode === "LMenu" || keyCode === "RMenu") {
            isAltPressed = true;
        }
    }, true);

    keyMouseHook.OnKeyUp((keyCode) => {
        if (!isScriptRunning) return;
        if (keyCode === "LMenu" || keyCode === "RMenu") {
            isAltPressed = false;
            firstPoint = null;
            log.info("Alt键释放，标记已重置");
        }
    }, true);

    // 监听鼠标点击
    keyMouseHook.OnMouseDown(async (button, x, y) => {
        if (!isScriptRunning || !isAltPressed) return;

        // Alt+右键：选点/触发OCR
        if (button === "Right") {
            if (!firstPoint) {
                firstPoint = { x, y };
                log.info(`标记起点：(${x}, ${y})`);
                const ra = captureGameRegion();
                await drawAndClearRedBox({ x: x - 1, y: y - 1, width: 2, height: 2 }, ra, 2000);
                if (ra && typeof ra.dispose === 'function') ra.dispose();
            } else {
                log.info(`标记终点：(${x}, ${y})`);
                const newX1 = Math.min(firstPoint.x, x);
                const newY1 = Math.min(firstPoint.y, y);
                const newX2 = Math.max(firstPoint.x, x);
                const newY2 = Math.max(firstPoint.y, y);

                // 绘制范围红框
                const ra = captureGameRegion();
                await drawAndClearRedBox({ x: newX1, y: newY1, width: newX2 - newX1, height: newY2 - newY1 }, ra, 3000);
                if (ra && typeof ra.dispose === 'function') ra.dispose();

                // 执行OCR
                await performOcrOnce(newX1, newY1, newX2, newY2);
                firstPoint = null;
            }
        }
        // Alt+左键：重置
        else if (button === "Left") {
            firstPoint = null;
            log.info("标记状态已重置，可重新选点");
        }
    });

    // 常驻循环
    try {
        while (isScriptRunning) {
            await sleep(100);
        }
    } catch (e) {
        if (!e.message.includes("task was canceled")) log.error(`脚本异常：${e.message}`);
    } finally {
        gracefulExit();
    }
}

// 调用主函数并处理异常（修复.catch语法错误）
main().catch((e) => {
    if (!e.message.includes("task was canceled")) {
        log.error(`全局异常：${e.message}`);
    }
    gracefulExit();
});