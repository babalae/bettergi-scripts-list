(async function () {
    const startTime = Date.now();
    setGameMetrics(1920, 1080, 1);


    //================= 1.设定路线 =================

    const folder1 = 'assets/枫丹地脉花-路线1 厄里那斯/';
    const folder2 = 'assets/枫丹地脉花-路线2 秋分山西侧锚点左下/';
    const folder3 = 'assets/枫丹地脉花-路线3 秋分山西侧锚点右/';
    const folder4 = 'assets/枫丹地脉花-路线4 柔灯港上锚点/';
    const folder5 = 'assets/枫丹地脉花-路线5 新枫丹科学院左锚点/';
    const folder6 = 'assets/枫丹地脉花-路线6 芒索斯山东麓/';

    const pathing1 = [
        "枫丹地脉花-路线1 厄里那斯-1：厄里那斯神像下.json",
        "枫丹地脉花-路线1 厄里那斯-2：厄里那斯神像右下.json",
        "枫丹地脉花-路线1 厄里那斯-3：厄里那斯神像右下_.json",
        "枫丹地脉花-路线1 厄里那斯-4：厄里那斯神像右下下下.json",
        "枫丹地脉花-路线1 厄里那斯-5：厄里那斯神像下下下下.json",
        "枫丹地脉花-路线1 厄里那斯-6：厄里那斯神像下下下.json",
    ]; 

    const pathing2 = [
        "枫丹地脉花-路线2 秋分山西侧锚点左下-1：秋分山左下.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-2：秋分山左下+.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-3：秋分山左下下.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-4：秋分山左下下下.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下.json",
    ]; 

    const pathing3 = [
        "枫丹地脉花-路线3 秋分山西侧锚点右-1：锚点右.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-2：锚点右右.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-3：锚点右右右.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-4：东侧锚点上.json",
    ]; 

    const pathing4 = [
        "枫丹地脉花-路线4 柔灯港上锚点-1：锚点左上.json",
        "枫丹地脉花-路线4 柔灯港上锚点-2：锚点左上+.json",
        "枫丹地脉花-路线4 柔灯港上锚点-3：锚点左左上.json",
        "枫丹地脉花-路线4 柔灯港上锚点-4：锚点左上++.json",
    ]; 

    const pathing5 = [
        "枫丹地脉花-路线5 新枫丹科学院左锚点-1：锚点左上.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-2：锚点上.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-3：科学院左上锚点.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-4：科学院左上锚点左上.json",
    ]; 

    const pathing6 = [
        "枫丹地脉花-路线6 芒索斯山东麓-1：锚点下.json",
        "枫丹地脉花-路线6 芒索斯山东麓-2：锚点右.json",
        "枫丹地脉花-路线6 芒索斯山东麓-3：锚点左.json",
        "枫丹地脉花-路线6 芒索斯山东麓-4：锚点左上.json",
    ]; 




    // ================= 2. 配置读取 =================

    let filePath; // 声明变量
    if (settings.path === undefined) { // 检查用户是否选了地址
        log.error("请在游戏中确认想刷地脉的首点位置，然后在js设置中选择路线。",);
        throw new Error("用户未设置路线，已终止执行"); // 没选就报错后停止
    }
    else { 
        filePath = settings.path
    }


    // 路线映射表-将用户设置映射对应路线
    const pathingMap = {
        "路线1 厄里那斯": pathing1,
        "路线2 秋分山西侧锚点左下": pathing2,
        "路线3 秋分山西侧锚点右": pathing3,
        "路线4 柔灯港上锚点": pathing4,
        "路线5 新枫丹科学院左锚点": pathing5,
        "路线6 芒索斯山东麓": pathing6
    };

    const folderMap = {
        "路线1 厄里那斯": folder1,
        "路线2 秋分山西侧锚点左下": folder2,
        "路线3 秋分山西侧锚点右": folder3,
        "路线4 柔灯港上锚点": folder4,
        "路线5 新枫丹科学院左锚点": folder5,
        "路线6 芒索斯山东麓": folder6
    };


    // 输出选择的路线
    log.info(`已选择路线：${settings.path}`);

    // 定义路线常量
    const selectedPath = pathingMap[filePath];
    const selectedFolder = folderMap[filePath];



    // 读取原始次数配置
    const rawTimes = settings.times ? settings.times : "6";

    // 验证是否为数字
    let timesValue; 
    if (!/^-?\d+\.?\d*$/.test(rawTimes)) { // 匹配整数和小数
        timesValue = 6
        log.info("⚠️ 刷本次数设置不为数字，改为默认值6");
    } else {
        // 转换为数字
        const num = parseFloat(rawTimes);

        // 范围检查
        if (num < 1) {
            timesValue = 1;
            log.info(`⚠️ 次数 ${num} 小于1，已调整为1`);
        } else if (num > 6) {
            timesValue = 6;
            log.info(`⚠️ 次数 ${num} 大于6，已调整为6`);
        } else {
            // 处理小数
            if (!Number.isInteger(num)) {
                timesValue = Math.floor(num);
                log.info(`⚠️ 次数 ${num} 不是整数，已向下取整为 ${timesValue}`);
            } else {
                timesValue = num;
            }
        }
    }
    const timesConfig = { value: timesValue };

    //已定义好路线路径、刷本次数的常量。现在需要定义领取动作，并做刷本动作，并保持自动拾取关闭。路线为selectedFolder+selectedPath，次数为timesConfig


    //路径存在性检查


    if (selectedPath) {
        for (const jsonFile of selectedPath) {

        }
    } else {
        throw new Error("未找到路径文件");
    }


    //定义领取动作
    async function claimRewards() {

        log.info("尝试领取奖励，优先使用浓缩，按下两次esc避免使用月亮");

        for (let i = 0; i < 6; i++) {
            keyPress("F");
            await sleep(i < 5 ? 400 : 600);
        }

        click(918, 760);
        await sleep(1600);

        keyPress("VK_ESCAPE");
        await sleep(800);
        keyPress("VK_ESCAPE");
        await sleep(800);
        
    }
    //定义了领取动作为claimRewards





    // ================= 3. 主执行逻辑 =================
    try {
       
        // 计算实际执行次数（取用户设置次数与路线长度的最小值）
        const maxExecutions = Math.min(timesConfig.value, selectedPath.length);
        log.info(`本条路线执行至第 ${maxExecutions} 朵花`);

        // 按顺序执行路径文件
        let executedCount = 0;
        for (const jsonFile of selectedPath) {
            if (executedCount >= maxExecutions) {
                log.info("已达到执行次数，终止运行");
                break; // 条件1触发：次数限制
            }

            // 关闭自动拾取
            dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));

            // 执行单个路径文件
            log.info(`开始执行第 ${executedCount + 1}/${maxExecutions} 次路径：${jsonFile}`);

            await pathingScript.runFile(`${selectedFolder}${jsonFile}`);

            // 领取奖励
            log.info(`此时应该可以按F接触地脉花`);
            log.info(`开始第 ${executedCount + 1} 朵花的奖励领取`);
            await claimRewards();

            // 确保重新开启自动拾取
            dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: true }));
          

            // 冷却等待（可选）
            await sleep(1000);

            executedCount++;
        }

        log.info("本次地脉花路线已执行完毕。");
    } catch (error) {
        log.error(`执行过程中发生错误：${error.message}`);
    }



})();