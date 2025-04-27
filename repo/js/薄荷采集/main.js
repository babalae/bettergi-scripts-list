(async function () {
    try {
        // 1. 读取用户配置
        const targetMint = parseInt(settings.targetMintCount);
        if (isNaN(targetMint) || targetMint <= 0) {
            notification.error("请输入有效的目标薄荷数量（正整数）");
            return;
        }

        // 读取是否刷新的配置
        const isRefresh = settings.isRefresh;

        // 输出已设置采集薄荷数量的日志
        log.info(`已设置采集薄荷数量：${targetMint}`);

        // ====================== 内置Sheet5任务数据（按顺序排列） ======================
        const sheet5Tasks = [
            { taskName: "薄荷E26-枫丹-佩特莉可镇", mintCount: 14 },
            { taskName: "薄荷E08-枫丹-秋分山东侧", mintCount: 6 },
            { taskName: "薄荷E23-枫丹-幽林雾道2", mintCount: 8 },
            { taskName: "薄荷C38-稻妻-清籁岛-浅濑神社", mintCount: 20 },
            { taskName: "薄荷A39-雪山-近郊2", mintCount: 21 },
            { taskName: "薄荷A38-雪山-近郊1", mintCount: 6 },
            { taskName: "薄荷E24-枫丹-湖中垂柳", mintCount: 15 },
            { taskName: "薄荷B10-璃月-归离原1", mintCount: 10 },
            { taskName: "薄荷C31-稻妻-海祇岛-珊瑚宫", mintCount: 11 },
            { taskName: "薄荷A08-蒙德-风起地2", mintCount: 7 },
            { taskName: "薄荷C27-稻妻-八酝岛-蛇骨矿洞3", mintCount: 12 },
            { taskName: "薄荷C04-稻妻-鸣神岛-绀田村", mintCount: 7 },
            { taskName: "薄荷C21-稻妻-八酝岛-藤兜砦2", mintCount: 5 },
            { taskName: "薄荷E20-枫丹-优兰尼娅湖1", mintCount: 15 },
            { taskName: "薄荷E16-枫丹-新枫丹科学院5", mintCount: 11 },
            { taskName: "薄荷C42-稻妻-鹤观-茂知祭场2", mintCount: 4 },
            { taskName: "薄荷E22-枫丹-幽林雾道1", mintCount: 12 },
            { taskName: "薄荷B17-璃月-渌华池2", mintCount: 9 },
            { taskName: "薄荷B11-璃月-归离原2", mintCount: 14 },
            { taskName: "薄荷E14-枫丹-新枫丹科学院3", mintCount: 17 },
            { taskName: "薄荷B60-沉玉谷-赤望台2", mintCount: 17 },
            { taskName: "薄荷C24-稻妻-八酝岛-蛇神之首2", mintCount: 6 },
            { taskName: "薄荷C16-稻妻-神无冢-踏鞴砂3", mintCount: 6 },
            { taskName: "薄荷B32-璃月-翠玦坡2", mintCount: 19 },
            { taskName: "薄荷B08-璃月-明藴镇1", mintCount: 13 },
            { taskName: "薄荷B47-沉玉谷-翘英庄3", mintCount: 11 },
            { taskName: "薄荷A10-蒙德-鹰翔海滩", mintCount: 10 },
            { taskName: "薄荷B07-璃月-荻花洲", mintCount: 14 },
            { taskName: "薄荷A34-雪山-眠龙谷1", mintCount: 22 },
            { taskName: "薄荷C43-稻妻-鹤观-茂知祭场3", mintCount: 7 },
            { taskName: "薄荷C35-稻妻-清籁岛-平海砦", mintCount: 2 },
            { taskName: "薄荷B18-璃月-渌华池3", mintCount: 14 },
            { taskName: "薄荷B42-璃月-南天门", mintCount: 6 },
            { taskName: "薄荷C19-稻妻-八酝岛-无想刃狭间", mintCount: 6 },
            { taskName: "薄荷C15-稻妻-神无冢-踏鞴砂2", mintCount: 3 },
            { taskName: "薄荷C12-稻妻-神无冢-九条阵屋2", mintCount: 3 },
            { taskName: "薄荷A04-蒙德-望风山地2", mintCount: 6 },
            { taskName: "薄荷B52-沉玉谷-赤璋城垣1", mintCount: 9 },
            { taskName: "薄荷C41-稻妻-鹤观-茂知祭场1", mintCount: 6 },
            { taskName: "薄荷B59-沉玉谷-赤望台1", mintCount: 10 },
            { taskName: "薄荷B12-璃月-归离原3", mintCount: 7 },
            { taskName: "薄荷F15-纳塔-花语会5", mintCount: 6 },
            { taskName: "薄荷E17-枫丹-中央实验室遗址1", mintCount: 9 },
            { taskName: "薄荷A02-蒙德-望风角2", mintCount: 13 },
            { taskName: "薄荷A29-雪山-覆雪之路2", mintCount: 7 },
            { taskName: "薄荷C44-稻妻-鹤观-茂知祭场4", mintCount: 3 },
            { taskName: "薄荷B35-璃月-绝云间1", mintCount: 18 },
            { taskName: "薄荷A01-蒙德-望风角1", mintCount: 9 },
            { taskName: "薄荷B19-璃月-遁玉陵", mintCount: 14 },
            { taskName: "薄荷B24-璃月-青墟浦1", mintCount: 16 },
            { taskName: "薄荷A32-雪山-星荧洞窟1", mintCount: 19 },
            { taskName: "薄荷B05-璃月-无妄坡3", mintCount: 13 },
            { taskName: "薄荷B37-璃月-绝云间3", mintCount: 9 },
            { taskName: "薄荷B13-璃月-归离原4", mintCount: 13 },
            { taskName: "薄荷B31-璃月-翠玦坡1", mintCount: 24 },
            { taskName: "薄荷B43-璃月-采樵谷1", mintCount: 32 },
            { taskName: "薄荷C37-稻妻-清籁岛-天云峠2", mintCount: 7 },
            { taskName: "薄荷A36-雪山-眠龙谷3", mintCount: 3 },
            { taskName: "薄荷A03-蒙德-望风山地1", mintCount: 6 },
            { taskName: "薄荷B34-璃月-奥藏山2", mintCount: 16 },
            { taskName: "薄荷B29-璃月-天遒谷1", mintCount: 7 },
            { taskName: "薄荷A35-雪山-眠龙谷2", mintCount: 15 },
            { taskName: "薄荷E21-枫丹-茉洁站", mintCount: 10 },
            { taskName: "薄荷C25-稻妻-八酝岛-蛇骨矿洞1", mintCount: 8 },
            { taskName: "薄荷B14-璃月-归离原5", mintCount: 7 },
            { taskName: "薄荷B02-璃月-石门2", mintCount: 13 },
            { taskName: "薄荷B01-璃月-石门1", mintCount: 19 },
            { taskName: "薄荷C34-稻妻-清籁岛-越石村", mintCount: 6 },
            { taskName: "薄荷B44-璃月-采樵谷2", mintCount: 19 },
            { taskName: "薄荷F02-纳塔-流泉之众1", mintCount: 2 },
            { taskName: "薄荷C40-稻妻-鹤观-笈名海滨", mintCount: 7 },
            { taskName: "薄荷E12-枫丹-新枫丹科学院1", mintCount: 6 },
            { taskName: "薄荷B56-沉玉谷-遗珑埠", mintCount: 5 },
            { taskName: "薄荷C22-稻妻-八酝岛-绯木村", mintCount: 6 },
            { taskName: "薄荷C11-稻妻-神无冢-九条阵屋1", mintCount: 6 },
            { taskName: "薄荷B41-璃月-琥牢山2", mintCount: 6 },
            { taskName: "薄荷B48-沉玉谷-灵濛山1", mintCount: 9 },
            { taskName: "薄荷B61-沉玉谷-赤望台3", mintCount: 10 },
            { taskName: "薄荷C23-稻妻-八酝岛-蛇神之首1", mintCount: 4 },
            { taskName: "薄荷C17-稻妻-神无冢-踏鞴砂4", mintCount: 10 },
            { taskName: "薄荷C39-稻妻-鹤观-知比山", mintCount: 7 },
            { taskName: "薄荷B22-璃月-天衡山2", mintCount: 7 },
            { taskName: "薄荷A09-蒙德-风起地3", mintCount: 3 },
            { taskName: "薄荷C14-稻妻-神无冢-踏鞴砂1", mintCount: 6 },
            { taskName: "薄荷C26-稻妻-八酝岛-蛇骨矿洞2", mintCount: 7 },
            { taskName: "薄荷F12-纳塔-花语会2", mintCount: 5 },
            { taskName: "薄荷B23-璃月-天衡山3", mintCount: 8 },
            { taskName: "薄荷C45-稻妻-鹤观-惑饲滩", mintCount: 3 },
            { taskName: "薄荷B15-璃月-孤云阁", mintCount: 6 },
            { taskName: "薄荷B27-璃月-灵矩关2", mintCount: 7 },
            { taskName: "薄荷C08-稻妻-鸣神岛-稻妻城1", mintCount: 5 },
            { taskName: "薄荷C07-稻妻-鸣神岛-白狐之野", mintCount: 5 },
            { taskName: "薄荷A07-蒙德-风起地1", mintCount: 5 },
            { taskName: "薄荷C32-稻妻-海祇岛-望泷村1", mintCount: 6 },
            { taskName: "薄荷B62-沉玉谷-赤望台4", mintCount: 7 },
            { taskName: "薄荷C33-稻妻-海祇岛-望泷村2", mintCount: 8 },
            { taskName: "薄荷B28-璃月-灵矩关3", mintCount: 8 },
            { taskName: "薄荷A28-雪山-覆雪之路1", mintCount: 16 },
            { taskName: "薄荷B46-沉玉谷-翘英庄2", mintCount: 9 },
            { taskName: "薄荷C20-稻妻-八酝岛-藤兜砦1", mintCount: 7 },
            { taskName: "薄荷B55-沉玉谷-悬练山2", mintCount: 8 },
            { taskName: "薄荷B21-璃月-天衡山1", mintCount: 9 },
            { taskName: "薄荷A15-蒙德-晨曦酒馆", mintCount: 8 },
            { taskName: "薄荷B51-沉玉谷-古茶树坡", mintCount: 8 },
            { taskName: "薄荷B03-璃月-无妄坡1", mintCount: 4 },
            { taskName: "薄荷B04-璃月-无妄坡2", mintCount: 5 },
            { taskName: "薄荷B09-璃月-明藴镇2", mintCount: 13 },
            { taskName: "薄荷E18-枫丹-中央实验室遗址2", mintCount: 11 },
            { taskName: "薄荷A19-蒙德-明冠峡1", mintCount: 5 },
            { taskName: "薄荷B36-璃月-绝云间2", mintCount: 9 },
            { taskName: "薄荷E15-枫丹-新枫丹科学院4", mintCount: 6 },
            { taskName: "薄荷B06-璃月-无妄坡4", mintCount: 9 },
            { taskName: "薄荷F06-纳塔-流泉之众5", mintCount: 1 },
            { taskName: "薄荷A22-蒙德-风龙废墟1", mintCount: 7 },
            { taskName: "薄荷B58-沉玉谷-宝玦口", mintCount: 9 },
            { taskName: "薄荷B25-璃月-青墟浦2", mintCount: 6 },
            { taskName: "薄荷C02-稻妻-鸣神岛-荒海1", mintCount: 4 },
            { taskName: "薄荷B33-璃月-奥藏山1", mintCount: 8 },
            { taskName: "薄荷C18-稻妻-神无冢-名椎滩", mintCount: 5 },
            { taskName: "薄荷A06-蒙德-星落湖", mintCount: 6 },
            { taskName: "薄荷A05-蒙德-摘星崖", mintCount: 3 },
            { taskName: "薄荷A24-蒙德-风龙废墟3", mintCount: 9 },
            { taskName: "薄荷B57-沉玉谷-暝垣山", mintCount: 8 },
            { taskName: "薄荷C06-稻妻-鸣神岛-神里屋敷", mintCount: 3 },
            { taskName: "薄荷F08-纳塔-烟密主2", mintCount: 2 },
            { taskName: "薄荷E03-枫丹-厄里那斯2", mintCount: 8 },
            { taskName: "薄荷B54-沉玉谷-赤璋城垣3", mintCount: 14 },
            { taskName: "薄荷B53-沉玉谷-赤璋城垣2", mintCount: 5 },
            { taskName: "薄荷A33-雪山-星荧洞窟2", mintCount: 5 },
            { taskName: "薄荷C05-稻妻-鸣神岛-神樱大社", mintCount: 1 },
            { taskName: "薄荷C03-稻妻-鸣神岛-荒海2", mintCount: 3 },
            { taskName: "薄荷E9-枫丹-枫丹廷1", mintCount: 6 },
            { taskName: "薄荷E7-枫丹-秋分山西侧", mintCount: 5 },
            { taskName: "薄荷B40-璃月-琥牢山1", mintCount: 8 },
            { taskName: "薄荷A13-蒙德-达达乌帕谷1", mintCount: 11 },
            { taskName: "薄荷A26-蒙德-清泉镇", mintCount: 8 },
            { taskName: "薄荷C09-稻妻-鸣神岛-稻妻城2", mintCount: 5 },
            { taskName: "薄荷E10-枫丹-枫丹廷2", mintCount: 6 },
            { taskName: "薄荷B45-沉玉谷-翘英庄1", mintCount: 6 },
            { taskName: "薄荷A14-蒙德-达达乌帕谷2", mintCount: 2 },
            { taskName: "薄荷E25-枫丹-卡布狄斯堡遗迹", mintCount: 4 },
            { taskName: "薄荷B49-沉玉谷-灵濛山2", mintCount: 4 },
            // 可以根据实际情况添加更多任务
        ];

        // 2. 读取/初始化进度文件（存储上次执行到的任务索引）
        let currentIndex = 0;
        if (!isRefresh) {
            try {
                const progress = await file.readText("mint_progress.txt");
                currentIndex = parseInt(progress);
                if (isNaN(currentIndex) || currentIndex < 0 || currentIndex >= sheet5Tasks.length) {
                    currentIndex = 0; // 无效进度，重置为0
                }
            } catch (error) {
                currentIndex = 0; // 文件不存在，初始化为0
            }
        }

        let collected = 0;
        let taskIndex = currentIndex;

        while (collected < targetMint) {
            // 执行当前任务
            const currentTask = sheet5Tasks[taskIndex];
            if (!currentTask) {
                taskIndex = 0; // 循环回起点
                continue;
            }

            const scriptPath = `assets/AutoPath/${currentTask.taskName}.json`;
            try {
                // 尝试读取脚本文件，以此判断脚本是否存在
                await file.readText(scriptPath);
            } catch (error) {
                log.info(`未检测到脚本 ${currentTask.taskName}，跳过该任务`);
                taskIndex++;
                // 到达任务列表末尾，从头开始循环
                if (taskIndex >= sheet5Tasks.length) {
                    taskIndex = 0;
                }
                continue;
            }

            log.info(`执行任务：${currentTask.taskName}，预计获得${currentTask.mintCount}薄荷`);
            // 假设地图追踪脚本文件名为 taskName.js，实际需根据脚本命名规则调整
            // 这里使用 runFile 从用户目录读取脚本，路径需根据实际情况修改
            await pathingScript.runFile(scriptPath);
            await sleep(1000); // 等待任务完成（根据实际情况调整等待时间）

            collected += currentTask.mintCount;
            log.info(`已采集${collected}个薄荷`);

            taskIndex++;

            // 记录进度：当前任务索引（下一次从下一个任务开始）
            await file.writeText("mint_progress.txt", taskIndex.toString());

            // 到达任务列表末尾，从头开始循环
            if (taskIndex >= sheet5Tasks.length) {
                taskIndex = 0;
            }

            // 检查是否达到目标
            if (collected >= targetMint) {
                log.info(`已采集${collected}薄荷，达到目标${targetMint}，任务完成！`);
                await file.writeText("mint_progress.txt", "0"); // 重置进度
                break;
            }
        }
    } catch (error) {
        log.error(`执行过程中出现错误: ${error.message}`);
    }
})();