(async function () {
    const raw_pathing = ['稻妻-野伏众-八酝岛名椎滩-11个.json', '稻妻-野伏众-八酝岛无想刃狭间东南方岸边-6个.json', '稻妻-野伏众-八酝岛无想刃狭间南方-4个.json', '稻妻-野伏众-八酝岛绯木村东北半山腰-1个.json', '稻妻-野伏众-八酝岛绯木村内蛇神之首左蛇骨矿洞左-16个.json', '稻妻-野伏众-八酝岛藤兜砦东略偏北岸边-4个.json', '稻妻-野伏众-八酝岛藤兜砦北-2个.json', '稻妻-野伏众-八酝岛藤兜砦崖上-6个.json', '稻妻-野伏众-八酝岛藤兜砦西-1个.json', '稻妻-野伏众-八酝岛蛇神之首东方-9个.json', '稻妻-野伏众-八酝岛蛇骨矿洞上方-2个.json', '稻妻-野伏众-八酝岛蛇骨矿洞东南-6个.json', '稻妻-野伏众-八酝岛蛇骨矿洞南崖下-4个.json', '稻妻-野伏众-海祇岛北方最远处浅滩-3个.json', '稻妻-野伏众-海祇岛北方略偏左-4个.json', '稻妻-野伏众-海祇岛曚云神社北方-4个.json', '稻妻-野伏众-海祇岛望泷村东北方河边瀑布边-4个.json', '稻妻-野伏众-海祇岛望泷村左侧崖上-2个.json', '稻妻-野伏众-海祇岛望泷村左侧崖下岸边-3个.json', '稻妻-野伏众-海祇岛水月池东南岸边-3个.json', '稻妻-野伏众-海祇岛水月池南略偏右-3个.json', '稻妻-野伏众-海祇岛珊瑚宫下火炬间-1个.json', '稻妻-野伏众-海祇岛珊瑚宫东北方-3个.json', '稻妻-野伏众-清籁岛天云峠东侧-8个.json', '稻妻-野伏众-清籁岛平海砦-11个.json', '稻妻-野伏众-清籁岛平海砦南方-3个.json', '稻妻-野伏众-清籁岛浅濑神社东-5个.json', '稻妻-野伏众-清籁岛越石村东方崖下-2个.json', '稻妻-野伏众-神无冢九条阵屋东南-9个.json', '稻妻-野伏众-神无冢九条阵屋西北-2个.json', '稻妻-野伏众-神无冢九条阵屋西崖下-3个.json', '稻妻-野伏众-神无冢九条阵屋西海岸-7个.json', '稻妻-野伏众-神无冢踏鞴砂东-5个.json', '稻妻-野伏众-神无冢踏鞴砂东南-7个.json', '稻妻-野伏众-神无冢踏鞴砂北岸边-3个.json', '稻妻-野伏众-神无冢踏鞴砂南方略偏东岸边-5个.json', '稻妻-野伏众-神无冢踏鞴砂南方略偏西岸边-5个.json', '稻妻-野伏众-神无冢踏鞴砂西崖上-2个.json', '稻妻-野伏众-鸣神岛刃连岛崖上-4个.json', '稻妻-野伏众-鸣神岛刃连岛崖下-13个.json', '稻妻-野伏众-鸣神岛白狐之野东南-1个.json', '稻妻-野伏众-鸣神岛神里屋敷东北-3个.json', '稻妻-野伏众-鸣神岛绀田村西侧和北侧-8个.json', '稻妻-野伏众-鸣神岛镇守之森东南-4个.json', '稻妻-野伏众-鸣神岛鸣神大社北岸边-2个.json', '稻妻-野伏众-鸣神岛鸣神大社北崖上-2个.json', '稻妻-野伏众-鸣神岛鸣神大社南侧瀑布下-2个.json', '稻妻-野伏众-鸣神岛鸣神大社西侧海岸-2个.json']
    const areas = {
        path_restriction_NarukamiIsland: "鸣神岛",
        path_restriction_Kannazuka: "神无冢",
        path_restriction_YashioriIsland: "八酝岛",
        path_restriction_SeiraiIsland: "清籁岛",
        path_restriction_WatatsumiIsland: "海祇岛"
    };
    const base_path = "assets/pathing/";
    let pathing = [];
    let minimum = typeof(settings.path_restriction_min) === 'undefined' ? 0 : parseInt(settings.path_restriction_min, 10);
    let maximum = typeof(settings.path_restriction_max) === 'undefined' ? 0 : parseInt(settings.path_restriction_max, 10);

    // 获取路径包含的数目信息，未获取到则返回0
    function get_pathing_num(pathing_name) {
        const match = pathing_name.match(/-(\d+)个\.json$/);
        return match ? parseInt(match[1], 10) : 0;
    }

    // 根据脚本配置筛选路径并显示配置
    function pathing_filter() {
        const ban_area = [];

        log.info(`<--------当前配置-------->`)

        // 检查并添加禁用的区域
        for (const [key, value] of Object.entries(areas)) {
            if (settings[key]) {
                ban_area.push(value);
                log.info(`地区：${value} <-已禁用->`);
            } else {
                log.info(`地区：${value} <-已启用->`);
            }
        }

        // 过滤禁用的区域路径
        let temp_pathing = raw_pathing.filter(path => !ban_area.some(region => path.includes(region)));
        // 过滤路径的数量
        if (minimum < maximum) {
            temp_pathing = temp_pathing.filter(path => {
                const amount = get_pathing_num(path);
                return minimum < amount && amount <= maximum;
            });
            log.info(`单个路径限制个体数：(${minimum}, ${maximum}]`)
        } else {
            log.info("错误：未配置'最小值'和'最大值'或配置错误！");
            log.info("单个路径限制个体数：不限");
        }
        return temp_pathing;
    }

    async function main() {
        pathing = pathing_filter();
        // 延迟10s启动
        const responseTime = settings.response_time !== undefined ? parseInt(settings.response_time, 10) : 10;
        log.info(`将在${responseTime}s后开始...`);
        await sleep(responseTime * 1000);

        // 总路径数
        const pathing_num = pathing.length;
        // 总个体数
        let entity_num = pathing.reduce((total, p) => total + get_pathing_num(p), 0);

        let pathing_count = 0; // 计数用
        let entity_count = 0; // 计数用
        for (const element of pathing) {
            try {
                log.info(`开始地图追踪：${element}`);

                dispatcher.addTimer(new RealtimeTimer("AutoPick"));
                let file_path = base_path + element;
                await pathingScript.runFile(file_path);

                pathing_count++;
                entity_count += get_pathing_num(element);
                log.info(`当前进度(地图追踪)：${pathing_count}/${pathing_num}`);
                log.info(`当前进度(野伏众)：${entity_count}/${entity_num}`)
            } catch (error) {
                log.info(`地图追踪：${element} 执行中发生错误`);
            }
        }
    }
    await main();
})();