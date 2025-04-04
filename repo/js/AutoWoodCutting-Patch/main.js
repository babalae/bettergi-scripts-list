(async function () {
    const RAW_PATHING = ['枫丹-炬木-苍晶区「很明亮的地方」-10个.json', '枫丹-炬木-白露区秋分山西侧西南-6个.json','纳塔-桃椰子木-涌流地浮土静界东-4个.json', '纳塔-桃椰子木-涌流地浮土静界南-6个.json'];
    const WOODS = ['炬木', '桃椰子木'];
    const BASE_PATH_PATHING = "assets/pathing/";
    const BASE_PATH_SCRIPT = "assets/KeyMouseScript/";
    let wood_num = 2000;

    function get_pathing_num(pathing_name) {
        const match = pathing_name.match(/-(\d+)个\.json$/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function pathing_filter() {
        log.info(`<--------当前配置-------->`);

        let temp_pathing = {};

        if (settings.wood_num !== undefined) {
            try {
                wood_num = parseInt(settings.wood_num, 10);
            } catch (error) {
                log.info(`错误：请正确设置伐木数量（0-2000）: ${error}`);
            }
        }

        if (settings.wood_list === "全选" || settings.wood_list === undefined) {
            for (const wood of WOODS) {
                temp_pathing[wood] = [];
            }

            for (const wood of WOODS) {
                for (const path of RAW_PATHING) {
                    if (path.includes(wood)) {
                        temp_pathing[wood].push(path);
                    }
                }
            }
            log.info(`炬木: ${wood_num}，桃椰子木: ${wood_num}`);
        } else {
            temp_pathing[settings.wood_list] = [];
            for (const path of RAW_PATHING) {
                if (path.includes(settings.wood_list)) {
                    temp_pathing[settings.wood_list].push(path);
                }
            }
            log.info(`${settings.wood_list}: ${wood_num}`);
        }

        return temp_pathing;
    }

    async function main() {
        log.info(`请确保当前的小道具为「王树瑞佑」且使用道具的按键为Z键！`);
        const wood_dic = pathing_filter();

        for (const [wood, paths] of Object.entries(wood_dic)) {
            let temp_num = paths.reduce((sum, p) => sum + get_pathing_num(p), 0);

            let num = ((wood_num / (temp_num * 3)) | 0) + 1;
            for (let i = 1; i <= num; i++) {
                log.info(`正在执行${wood}(${i}/${num})`);
                for (const file of paths) {
                    await pathingScript.runFile(BASE_PATH_PATHING + file);
                    await sleep(1000);
                    await keyMouseScript.runFile(BASE_PATH_SCRIPT + file);
                    await sleep(500);

                }
            }
        }
    }

    await main();
})();
