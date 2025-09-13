(async function () {
    /********************************************************************************
     * * 脚本功能: 自动领取每日委托奖励 (OCR增强版)
     * 脚本逻辑:
     * 1. 与凯瑟琳交互 (F键)
     * 2. 点击屏幕中心跳过初始对话
     * 3. 使用OCR识别并点击包含 "每日委托" 字样的对话选项
     * 4. 等待奖励动画
     * 5. 点击屏幕中心关闭奖励结算页面
     * ********************************************************************************/

    // --- Helper Functions (辅助函数) ---
    /**
     * 在指定区域内查找特定文本并返回其识别结果对象
     * @param {ImageRegion} searchRegion - 需要进行搜索的图像区域。
     * @param {string} targetText - 您要查找的目标文本。
     * @returns {Region | null} - 如果找到，则返回包含坐标和文本的 Region 对象；如果未找到，则返回 null。
     */
    const findTextInRegion = (searchRegion, targetText) => {
        // 对整个区域进行 OCR，获取所有文本行的列表
        let ocrResultList = searchRegion.findMulti(RecognitionObject.ocrThis);

        // 遍历所有 OCR 结果
        for (let i = 0; i < ocrResultList.count; i++) {
            let currentResult = ocrResultList[i];
            log.debug("识别到文本: '{text}'，位置: ({x}, {y})", currentResult.text, currentResult.x, currentResult.y);

            // 判断识别到的文本是否包含您要找的目标文本 (使用 .includes() 进行模糊匹配)
            if (currentResult.text && currentResult.text.includes(targetText)) {
                log.info("成功找到目标文本 '{target}'!", targetText);
                return currentResult; // 如果找到，返回这个结果对象
            }
        }

        // 如果遍历完所有结果都未找到，返回 null
        log.warn("在指定区域内未能找到目标文本: '{target}'", targetText);
        return null;
    };

    /**
     * 在当前游戏画面中查找并点击包含指定文本的区域中心
     * @param {string} targetText - 您要查找并点击的目标文本。
     * @returns {Promise<boolean>} - 如果成功找到并点击，则返回 true；否则返回 false。
     */
    const findAndClickText = async (targetText) => {
        log.info("开始查找并点击文本: '{target}'", targetText);
        let captureRegion = captureGameRegion(); // 获取当前游戏截图
        let foundRegion = findTextInRegion(captureRegion, targetText);

        if (foundRegion && !foundRegion.isEmpty()) {
            // 计算找到文本区域的中心点坐标
            let centerX = foundRegion.x + Math.floor(foundRegion.width / 2);
            let centerY = foundRegion.y + Math.floor(foundRegion.height / 2);

            log.info("文本 '{text}' 的中心坐标是: x={x}, y={y}", foundRegion.text, centerX, centerY);
            click(centerX, centerY); // 点击中心点
            return true;
        } else {
            log.error("在当前屏幕中没有找到文本 '{target}'", targetText);
            return false;
        }
    };


    // --- Main Script Logic (主脚本逻辑) ---

    setGameMetrics(1920, 1080, 1);
    log.info("开始执行「每日委托」奖励领取");

    // 步骤 1: 与凯瑟琳交互
    keyPress("F");
    log.info("按下 F 键 (与凯瑟琳交互)");
    await sleep(2000); // 等待对话框完全出现

    // 步骤 2: 点击屏幕中心，跳过凯瑟琳的第一段对话
    click(960, 960);
    log.info("点击坐标(960, 960) (跳过对话)");
    await sleep(2000); // 等待对话选项出现

    // 步骤 3: 使用 OCR 查找并点击 "每日委托" 奖励选项
    // 游戏中的选项通常是 "关于「每日委托」..." 或类似的，所以用 "每日委托" 作为关键词查找
    const foundAndClicked = await findAndClickText("每日委托");

    // 步骤 4: 根据上一步的结果决定是否继续
    if (foundAndClicked) {
        await sleep(1000);
        log.info("等待1秒");
        click(960, 960);
        log.info("点击坐标(960, 960) (跳过对话)");
        await sleep(3000);
        log.info("等待3秒");
        click(960, 960);
        log.info("点击坐标(960, 960) (关闭奖励弹出页面)");

    } else {
        keyPress("Escape"); // 如果未找到选项，按 Escape 键退出对话
        log.error("未能找到「每日委托」的相关选项，脚本执行失败。");
    }
})();