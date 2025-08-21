(async function () {
    const pathing_list = [
        "璃月-禽肉-云来海璃月港北-1个-下落2肉1",
        "璃月-禽肉-云来海璃月港西-2个-下落1肉2",
        "璃月-禽肉-云来海璃月港西南-3个-下落1肉1",
        "璃月-禽肉-来歆山赤望台东南-1个-下落2肉1",
        "璃月-禽肉-沉玉谷·上谷宝玦口南-1个-下落2肉1",
        "璃月-禽肉-沉玉谷·上谷暝垣山-1个-下落2肉1",
        "璃月-禽肉-沉玉谷·上谷暝垣山西南-1个-下落2肉1",
        "璃月-禽肉-沉玉谷·上谷灵濛山北-2个-下落2肉2",
        "璃月-禽肉-沉玉谷·上谷瞑垣山南-1个-下落2肉1",
        "璃月-禽肉-沉玉谷·上谷翘英庄西-2个-下落1肉2",
        "璃月-禽肉-沉玉谷·上谷翘英庄西北-2个-下落1肉2",
        "璃月-禽肉-沉玉谷·上谷赤望台北-2个-下落2肉2",
        "璃月-禽肉-沉玉谷·南陵赤望台东-1个-下落2肉1",
        "璃月-禽肉-沉玉谷·南陵赤望台东北-1个-下落2肉1",
        "璃月-禽肉-沉玉谷·南陵赤璋城垣南-1个-下落2肉1",
        "璃月-禽肉-珉林华光林西南-2个-下落2肉2",
        "璃月-禽肉-珉林奥藏山东-1个-下落2肉1",
        "璃月-禽肉-珉林琥牢山东-1个-下落2肉1",
        "璃月-禽肉-琼玑野明蕴镇西南-2个-下落2肉2",
        "璃月-禽肉-琼玑野瑶光滩北-4个-下落2肉4",
        "璃月-禽肉-琼玑野瑶光滩西北-2个-下落2肉2",
        "璃月-禽肉-璃月港舔狗桥-5个-下落2肉5",
        "璃月-禽肉-碧水原望舒客栈北-1个-下落1肉1",
        "纳塔-禽肉-奥奇卡纳塔东南-5个-下落2肉5",
        "蒙德-禽肉-风起地-3个-下落2肉3",
        "蒙德-禽肉-风起地东南-11个-下落2肉11",
        "须弥-禽肉-上风蚀地丰饶绿洲东-3个-战斗3肉3",
        "须弥-禽肉-上风蚀地丰饶绿洲南-1个-战斗3肉1",
        "须弥-禽肉-上风蚀地荼诃落谷-1个-战斗3肉1",
        "须弥-禽肉-上风蚀地避让之丘东北-2个-战斗3肉2",
        "须弥-禽肉-下风蚀地圣显厅南-2个-战斗3肉2",
        "须弥-禽肉-下风蚀地圣显厅西南-4个-战斗3肉4",
        "须弥-禽肉-下风蚀地活力之家西-3个-战斗3肉3",
        "须弥-禽肉-下风蚀地舍身弃坑东南-2个-战斗3肉2",
        "须弥-禽肉-下风蚀地阿如村东北-2个-战斗3肉2",
        "须弥-禽肉-列柱沙原丰饶绿洲西南-2个-战斗3肉2",
        "须弥-禽肉-荒石苍漠「三运河之地」西-2个-战斗3肉2"
    ];
    const statue_name = "蒙德-七天神像-苍风高地";
    const longest_path_time = 300; // 耗时最长的路线的时长（s）

    /**
     * 设置时间（白天和夜晚）。
     *
     * 模拟键盘和鼠标操作来更改时间状态。
     *
     * @param {string} time_state - 时间状态，可以是 "白天" 或 "夜晚"。
     */
    async function set_time(time_state) {
        let position_center = [1440, 500];
        let position_0 = [1440, 670]; // 防止转动无效（鼠标途经点）
        let position_6 = [1270, 500];
        let position_12 = [1440, 330]; // 防止转动无效（鼠标途经点）
        let position_18 = [1610, 500];

        await keyPress("Escape");
        await sleep(1000);
        await click(45, 715);
        await sleep(2000);

        moveMouseTo(position_center[0], position_center[1]);
        await sleep(50);
        leftButtonDown();
        await sleep(50);
        if (time_state === "白天") {
            moveMouseTo(position_12[0], position_12[1]); // 途经点
            await(50);
            moveMouseTo(position_6[0], position_6[1]);
        } else if (time_state === "夜晚") {
            moveMouseTo(position_0[0], position_0[1]); // 途经点
            await(50);
            moveMouseTo(position_18[0], position_18[1]);
        }
        await sleep(50);
        leftButtonUp();

        await sleep(1000);
        await click(1450, 1020); // 确认
        await sleep(20000); // 等待时间调节
        await keyPress("Escape");
        await sleep(2000);
        await keyPress("Escape");
        await sleep(2000);
    }

    /**
    *
    * 自动领取空月祝福(检测并等待到4点)
    *
    * */
    async function welkin_moon() {
        // 4点自动领取月卡
        let time_now = new Date();
        let time_4 = new Date(time_now.getFullYear(), time_now.getMonth(), time_now.getDate(), 4, 0, 0); // 4点
        let time_predict_end; // 预测本次任务结束时间（加1分钟容错）
        time_predict_end = time_now.setSeconds(time_now.getSeconds() + longest_path_time + 60);

        // 30s点击一次，等待领取月卡
        let step_flag = 0; // 领取月卡步骤标志
        while (auto_skip && time_now < time_4 && time_predict_end >= time_4) {
            log.info(`等待领取月卡(剩余${Math.floor((time_4 - new Date()) / 1000)}s)...`);
            if (step_flag == 0) {
                // 传送到七天神像
                await pathingScript.runFile(base_path_pathing + statue_name + ".json");
                step_flag += 1;
            }
            await sleep(30000);
            keyDown("VK_LBUTTON");
            await sleep(100);
            keyUp("VK_LBUTTON");

            // 本次已经到达4点(5s容错)
            if (new Date() > time_4.setSeconds(time_4.getSeconds() - 5)) {
                step_flag += 1;
                auto_skip = false;
            }

        }
        // 领取月卡(点击两次)
        if (step_flag == 2) {
            step_flag = 0;
            await sleep(5); // 补回容错时间
            await click(1450, 1020); // 点击时间调节的确认按钮的位置
            await sleep(5); // 等待月卡动画时间
            await click(1450, 1020);
            await sleep(1);
        }
    }

    /**
    *
    * 读取JS脚本配置
    *
    * @return {Object} 包含解析后JS脚本配置的对象
    * */
    function read_settings() {
        const mode_pick = typeof(settings.mode_pick) === "undefined" ? "自动拾取" : settings.mode_pick;
        const check_upper_limit = typeof(settings.check_upper_limit) === "undefined" ? false : settings.check_upper_limit;
        const check_descend = typeof(settings.check_descend) === "undefined" ? false : settings.check_descend;
        const check_fight = typeof(settings.check_fight) === "undefined" ? false : settings.check_fight;
        const check_one = typeof(settings.check_one) === "undefined" ? false : settings.check_one;
        const check_two = typeof(settings.check_two) === "undefined" ? false : settings.check_two;
        const check_three = typeof(settings.check_three) === "undefined" ? false : settings.check_three;
        const check_welkin_moon = typeof(settings.check_welkin_moon) === "undefined" ? false : settings.check_welkin_moon;

        return {
            "mode_pick": mode_pick,
            "check_upper_limit": check_upper_limit,
            "check_descend": check_descend,
            "check_fight": check_fight,
            "check_one": check_one,
            "check_two": check_two,
            "check_three": check_three,
            "check_welkin_moon": check_welkin_moon
        }
    }

    /**
    *
    * 解析文件名
    *
    * */
    function parse_file_name(file_name) {
        try {
            const file_msg = file_name.split("-")
            let msg_dic = {}; // 存储路径信息

            const area = file_msg[0];
            const type = file_msg[1];
            const detail = file_msg[2];
            const num = parseInt(file_msg[3].replace(/个/g, ""), 10); // 鸟类总数
            const addition = file_msg[4].slice(0, 2); // 路径类型
            const objects = file_msg[4].substring(2).split("_"); // 详细掉落数目(需处理)

            msg_dic["area"] = area;
            msg_dic["type"] = type;
            msg_dic["detail"] = detail;
            msg_dic["num"] = num;
            msg_dic["addition"] = addition;
            msg_dic["objects"] = {}; // 初始化禽肉详情字典
            for (let i = 0; i < objects.length; i++) {
                const temp_msg = objects[i].split("肉");
                msg_dic["objects"][temp_msg[0]] = temp_msg[1];
            }

            return msg_dic;
        } catch (error) {
            log.info("路径文件解析错误，请检查main.js内的文件名...");
        }

    }

    /**
     *
     * 加载路径任务
     *
     * @param {string} file_name - JSON文件名
     *
     * */
    async function run_file(file_name) {
        const base_path_pathing = "assets/pathing/";
        await pathingScript.runFile(base_path_pathing + file_name + ".json");
    }

    async function main() {
        try {
            // 刷取上限所需
            let upper_one, upper_two, upper_three;
            const target_num = 300; // 上限(可以设置[test])
            // 读取配置
            const setting_msg = read_settings();
            // 自动拾取
            if (setting_msg["mode_pick"] === "自动拾取") {
                dispatcher.addTimer(new RealtimeTimer("AutoPick"));
            } else if (setting_msg["mode_pick"] === "强制拾取") {
                dispatcher.addTimer(new RealtimeTimer("AutoPick", {"forceInteraction": true}));
            }
            // 刷取禽肉上限
            // if (setting_msg["check_upper_limit"]) {}
            upper_one = 0;
            upper_two = 0;
            upper_three = 0;
            // 输出JS脚本配置
            log.info(`下落路线: ${setting_msg["check_descend"] ? "禁用": "启用"}`);
            log.info(`战斗路线: ${setting_msg["check_fight"] ? "禁用": "启用"}`);
            log.info(`小型鸟类: ${setting_msg["check_one"] ? "禁用": "启用"}`);
            log.info(`中型鸟类: ${setting_msg["check_two"] ? "禁用": "启用"}`);
            log.info(`大型鸟类: ${setting_msg["check_three"] ? "禁用": "启用"}`);
            log.info(`4点领取空月祝福: ${setting_msg["check_welkin_moon"] ? "禁用": "启用"}`);

            // 筛选并执行路径
            for (let i = 0; i < pathing_list.length; i++) {
                log.info(`当前路线: ${pathing_list[i]} (进度: ${i + 1}/${pathing_list.length})`);
                const path_msg = parse_file_name(pathing_list[i]);

                // 禁用下落路线
                if (setting_msg["check_descend"] && path_msg["addition"] === "下落") continue;
                // 禁用战斗路线
                if (setting_msg["check_fight"] && path_msg["addition"] === "战斗") continue;
                // 排除小型鸟类
                if (setting_msg["check_one"] && path_msg["objects"].keys().includes("1")) continue;
                // 排除中型鸟类
                if (setting_msg["check_two"] && path_msg["objects"].keys().includes("2")) continue;
                // 排除大型鸟类
                if (setting_msg["check_three"] && path_msg["objects"].keys().includes("3")) continue;
                // 自动领取空月祝福
                if (!setting_msg["check_welkin_moon"]) {
                    welkin_moon()
                }

                // 执行任务
                await run_file(pathing_list[i]);
                // 禽肉上限判定
                if (setting_msg["check_upper_limit"]) {
                    for (const [key, value] of Object.entries(path_msg["objects"])) {
                        if (key === "1") {
                            upper_one += parseInt(value, 10);
                            if (upper_one >= target_num) {
                                log.info(`小型鸟类已达 ${target_num} 上限，已禁用...`);
                                setting_msg["check_one"] = false;
                            }
                        } else if (key === "2") {
                            upper_two += parseInt(value, 10);
                            if (upper_two >= target_num) {
                                log.info(`中型鸟类已达 ${target_num} 上限，已禁用...`);
                                setting_msg["check_two"] = false;
                            }
                        } else if (key === "3") {
                            upper_three += parseInt(value, 10);
                            if (upper_three >= target_num) {
                                log.info(`大型鸟类已达 ${target_num} 上限，已禁用...`);
                                setting_msg["check_three"] = false;
                            }
                        }
                    }
                }
            }
            log.info(`任务完成(统计为预测值，实际可能存在误差):\n小型鸟类 ${upper_one} 只\n中型鸟类 ${upper_two} 只\n大型鸟类 ${upper_three} 只\n`);
        } catch (error) {
            log.error(`任务执行出错: ${error}`);
            return null;
        }

    }

    await main();
})();