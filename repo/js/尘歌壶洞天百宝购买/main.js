// main.js
(async function () {
    // ==================== 时间检查 ====================
    function checkBeijingDay(allowedDays) {
        // 创建北京时间对象
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 3600 * 1000)); // UTC+8
        
        // 获取ISO星期（1=周一 到7=周日）
        const beijingDay = beijingTime.getUTCDay() || 7; // 转换周日0为7
        
        // 检查允许日期
        if (!allowedDays.includes(beijingDay)) {
            log.info(`当前北京时间：${beijingTime.toISOString()}`);
            log.error(`今日星期${beijingDay}不在允许运行列表，脚本终止`);
            return false;
        }
        return true;
    }

    // ==================== 初始化日志 ====================
    log.info("======== 脚本启动 ========");

    // ==================== 日期检查配置 ====================
    const ALLOWED_DAYS = [1]; // 设置允许运行的星期（1-7）
    if (!checkBeijingDay(ALLOWED_DAYS)) {
        return; // 直接终止脚本
    }

    //设置脚本环境的游戏分辨率和DPI缩放
    setGameMetrics(1920, 1080, 1.5);

    let purchasedCount = 0; // 已成功购买的商品种类

    function getDynamicY(y) {
        return y - (purchasedCount * 120); // 每个已购商品使后续商品Y-20
    }

    // ==================== 2. 加载商品坐标 ====================
    let items = {};
    try {
        const itemsText = file.readTextSync("items_coord.json");
        items = JSON.parse(itemsText);
        log.info("[成功] 商品坐标加载完成");
    } catch (e) {
        log.error("[致命错误] 商品坐标文件损坏，脚本终止");
        return;
    }

    // ==================== 3. 定义固定按钮坐标 ====================
    const FIXED_POS = {
        buyCategory: { x: 140, y: 162 },    // 购买类目入口y洞天宝货162，摆设,253，摆设图纸344，洞天珍物435，洞天种物526，木材617
        exchangeBtn: { x: 1750, y: 1020 },  // 兑换按钮
        maxQuantity: { x: 1180, y: 602 },   // 数量按钮x(747，1180)
        confirmBtn: { x: 1170, y: 780 },   // 确认兑换
        closePopup: { x: 1700, y: 200 }    // 关闭弹窗
    };

    // ==================== 5. 核心购买逻辑 ====================
    async function purchaseItem(itemKey) {
        const itemConfig = items[itemKey];
        if (!itemConfig) {
            log.error(`[配置错误] 未找到 ${itemKey} 的坐标配置`);
            return;
        }
        //log.info(`自定义配置为 ${settings[itemKey]}`);
        // 检查购买开关
        if (settings[itemKey] !== "是") {
            //log.info(`[跳过] ${itemConfig._name || itemKey}`);
            return;
        }

        try {
            log.info(`[开始] 正在购买 ${itemConfig._name}`);

            // 1. 进入购买类目
            click(FIXED_POS.buyCategory.x, FIXED_POS.buyCategory.y);
            await sleep(500);
            
            // 动态计算坐标
            const targetY = getDynamicY(itemConfig.y);

            // 2. 选择商品
            click(itemConfig.x, targetY);
            await sleep(500);

            // 3. 点击兑换
            click(FIXED_POS.exchangeBtn.x, FIXED_POS.exchangeBtn.y);
            await sleep(500);

            // 4. 选择最大数量
            click(FIXED_POS.maxQuantity.x, FIXED_POS.maxQuantity.y);
            await sleep(500);

            // 5. 确认兑换
            click(FIXED_POS.confirmBtn.x, FIXED_POS.confirmBtn.y);
            await sleep(1000);

            // 6. 关闭弹窗
            click(FIXED_POS.closePopup.x, FIXED_POS.closePopup.y);
            await sleep(500);

            purchasedCount++;
            log.info(`已购买商品数量: ${purchasedCount}`); 
            // 输出示例: "已购买商品数量: 3"
            log.info(`[成功] ${itemConfig._name} 购买完成`);
        } catch (e) {
            log.error(`[失败] ${itemConfig._name} 操作异常: ${e.message}`);
            // 异常时强制关闭弹窗
            click(FIXED_POS.closePopup.x, FIXED_POS.closePopup.y);
            await sleep(3000);
        }
    }

    // ==================== 6. 主执行流程 ====================
    try {
        // 前置操作
        keyPress("F");
        await sleep(2000);
        keyPress("F");
        await sleep(1000);
        click(1350, 655);  // 打开洞天百宝界面
        await sleep(500);

        // 遍历所有商品
        for (const itemKey of Object.keys(items)) {
            await purchaseItem(itemKey);
            await sleep(500);  // 商品间操作间隔
        }
    } catch (e) {
        log.error(`[全局异常] ${e.message}`);
    } finally {
        keyPress("Escape");
        await sleep(2000);
        click(1360, 810);//再见
        await sleep(1000);
        click(1360, 810);//退出对话
        await sleep(1000);
        log.info("======== 脚本执行结束 ========");
    }
})();
