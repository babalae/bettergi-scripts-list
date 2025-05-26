(async function () {
    setGameMetrics(1920, 1080, 1);

    async function AutoPath() {
        log.info("开始执行自动寻路任务");

        const isGrocerySelected = settings["稻妻杂货商"];
        const isCharcoalSelected = settings["稻妻志村屋店主"];
        const isLiyueGrocerySelected = settings["璃月杂货商"];
        const isNataGrocerySelected = settings["纳塔杂货商"]; 
        const isFengdanGrocerySelected = settings["枫丹杂货商"]; // 新增枫丹杂货商选项
        const isCafeLuzheSelected = settings["咖啡厅露泽店主"]; // 新增咖啡厅露泽店主阿鲁埃选项
        const clickCount1 = Number(settings["点击购买次数1"]) || 11;
        const clickCount2 = Number(settings["点击购买次数2"]) || 12;
        const clickCount3 = Number(settings["点击购买次数3"]) || 11;
        const clickCount4 = Number(settings["点击购买次数4"]) || 9;

        const groceryFilePath = `assets/稻妻九十九物店主.json`;
        const charcoalFilePath = `assets/稻妻志村屋店主.json`;
        const liyueGroceryFilePath = `assets/璃月杂货商东升.json`;
        const nataGroceryFilePath = `assets/纳塔杂货商布纳马.json`;
        const fengdanGroceryFilePath = `assets/枫丹杂货商布希柯.json`; // 新增枫丹杂货商路径文件
        const cafeLuzheFilePath = `assets/咖啡厅露泽店主阿鲁埃.json`; // 新增咖啡厅露泽店主阿鲁埃路径文件

        try {
            if (isGrocerySelected) {
                log.info(`加载路径文件：${groceryFilePath}`);
                await pathingScript.runFile(groceryFilePath);
                log.info("路径文件执行完成");

                log.info("执行稻妻杂货商的按键操作...");
                keyDown("w");
                await sleep(200);
                keyUp("w");
                await sleep(1000);
                keyPress("F");
                await sleep(2000);

                await click(1300, 650); await sleep(1000);
                await click(1300, 650); await sleep(1000);
                await click(1600, 1020); await sleep(1000);

                for (let i = 0; i < clickCount1; i++) {
                    await click(1600, 1020); await sleep(1000);
                    await click(1181, 600); await sleep(200);
                    await click(1291, 600); await sleep(500);
                    await click(1300, 780); await sleep(1000);
                    await click(1300, 780); await sleep(1000);
                }
            }

            if (isCharcoalSelected) {
                log.info(`加载路径文件：${charcoalFilePath}`);
                await pathingScript.runFile(charcoalFilePath);
                log.info("路径文件执行完成");

                log.info("执行稻妻志村屋店主的按键操作...");
                keyDown("w");
                await sleep(200);
                keyUp("w");
                await sleep(1000);
                keyPress("F");
                await sleep(2000);

                await click(1300, 580); await sleep(1000);
                await click(1300, 580); await sleep(1000);
                await click(1600, 540); await sleep(1000);
                await click(1600, 540); await sleep(1000);

                for (let i = 0; i < 2; i++) {
                    await click(1050, 520); await sleep(1000);
                    await click(1600, 1020); await sleep(1000);
                    await click(1181, 600); await sleep(200);
                    await click(1291, 600); await sleep(500);
                    await click(1300, 780); await sleep(1000);
                    await click(1300, 780); await sleep(1000);
                }
            }

            if (isLiyueGrocerySelected) {
                log.info(`加载路径文件：${liyueGroceryFilePath}`);
                await pathingScript.runFile(liyueGroceryFilePath);
                log.info("路径文件执行完成");

                log.info("执行璃月杂货商东升的按键操作...");
                keyDown("w");
                await sleep(200);
                keyUp("w");
                await sleep(1000);
                keyPress("F");
                await sleep(2000);

                await click(1300, 650); await sleep(1000);
                await click(1300, 650); await sleep(1000);
                await click(1600, 1020); await sleep(1000);

                for (let i = 0; i < clickCount2; i++) {
                    await click(1600, 1020); await sleep(1000);
                    await click(1181, 600); await sleep(200);
                    await click(1291, 600); await sleep(500);
                    await click(1300, 780); await sleep(1000);
                    await click(1300, 780); await sleep(1000);
                }
            }

            if (isNataGrocerySelected) {
                log.info(`加载路径文件：${nataGroceryFilePath}`);
                await pathingScript.runFile(nataGroceryFilePath);
                log.info("路径文件执行完成");

                log.info("执行纳塔杂货商布纳马的按键操作...");
                
                keyDown("w");
                await sleep(4800);
                keyUp("w");
                keyDown("a");
                await sleep(780);
                keyUp("a");
                keyDown("w");
                await sleep(1200);
                keyUp("w");
                keyDown("a");
                await sleep(220);
                keyUp("a");
                await sleep(1000);
                keyPress("F");
                await sleep(2000);

                await click(1300, 580); await sleep(1000);
                await click(1300, 580); await sleep(1000);
                await click(1300, 580); await sleep(1000);
                await click(1180, 290); await sleep(1000);
                await click(1180, 290); await sleep(1000);

                for (let i = 0; i < clickCount4; i++) {
                    await click(1600, 1020); await sleep(1000);
                    await click(1181, 600); await sleep(200);
                    await click(1291, 600); await sleep(500);
                    await click(1300, 780); await sleep(1000);
                    await click(1300, 780); await sleep(1000);
                }
            }

            if (isFengdanGrocerySelected) { // 新增枫丹杂货商的逻辑
                log.info(`加载路径文件：${fengdanGroceryFilePath}`);
                await pathingScript.runFile(fengdanGroceryFilePath);
                log.info("路径文件执行完成");

                log.info("执行枫丹杂货商布希柯的按键操作...");
                keyDown("w");
                await sleep(200);
                keyUp("w");
                await sleep(1000);
                keyPress("F");
                await sleep(2000);

                await click(1300, 580); await sleep(1000);
                await click(1300, 580); await sleep(1000);
                await click(1150, 520); await sleep(1000);
                await click(1150, 520); await sleep(1000);

                for (let i = 0; i < clickCount3; i++) {
                    await click(1600, 1020); await sleep(1000);
                    await click(1181, 600); await sleep(200);
                    await click(1291, 600); await sleep(500);
                    await click(1300, 780); await sleep(1000);
                    await click(1300, 780); await sleep(1000);
                }
            }

            if (isCafeLuzheSelected) {
                log.info(`加载路径文件：${cafeLuzheFilePath}`);
                await pathingScript.runFile(cafeLuzheFilePath);
                log.info("路径文件执行完成");

                log.info("执行咖啡厅露泽店主阿鲁埃的按键操作...");
                keyDown("w");
                await sleep(100);
                keyUp("w");
                await sleep(1000);
                keyPress("F");
                await sleep(2000);

                await click(1300, 580); await sleep(1000);
                await click(1300, 580); await sleep(1000);
                await click(1600, 540); await sleep(1000);
                await click(1600, 540); await sleep(1000);

                await click(1050, 520); await sleep(1000);
                await click(1600, 1020); await sleep(1000);
                await click(1181, 600); await sleep(200);
                await click(1291, 600); await sleep(500);
                await click(1300, 780); await sleep(1000);
                await click(1300, 780); await sleep(1000);
            }

            // 最后点击退出按钮
            log.info("点击退出按钮...");
            await click(1845, 45); // 假设退出按钮的坐标是 (1845, 45)
            await sleep(1000);
        } catch (error) {
            log.error(`执行路径文件或操作时发生错误：${error.message}`);
        }
    }

    await AutoPath();
})();
