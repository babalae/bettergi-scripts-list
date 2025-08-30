function forge_pathing_start_log(name) {
    const t = new Date();
    const timestamp = t.toTimeString().slice(0, 8) + "." + String(t.getMilliseconds()).padStart(3, "0");
    var c = "Forging start log\n\n";
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n------------------------------\n\n`;
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n→ 开始执行地图追踪任务: "${name}"`;
    log.debug(c);
}

function forge_pathing_end_log(name, elapsed_time) {
    const elapsed_min = Math.floor(elapsed_time / 1000 / 60);
    const elapsed_sec = (elapsed_time / 1000 % 60).toFixed(3);
    const t = new Date();
    const timestamp = t.toTimeString().slice(0, 8) + "." + String(t.getMilliseconds()).padStart(3, "0");
    var c = "Forging end log\n\n";
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n→ 脚本执行结束: "${name}", 耗时: ${elapsed_min}分${elapsed_sec}秒\n\n`;
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n------------------------------`;
    log.debug(c);
}

function get_exclude_tags() {
    var tags = [];
    if (settings.exclude_fights) {
        tags.push("fight");
    }
    if (settings.exclude_natlan) {
        tags.push("natlan");
    }
    if (settings.exclude_fontaine_underwater) {
        tags.push("fontaine underwater");
    }
    if (settings.exclude_fontaine_terrestrial) {
        tags.push("fontaine terrestrial");
    }
    if (settings.exclude_sumeru) {
        tags.push("sumeru");
    }
    if (settings.exclude_inazuma) {
        tags.push("inazuma");
    }
    if (settings.exclude_liyue) {
        tags.push("liyue");
    }
    if (settings.exclude_chasm_underground) {
        tags.push("chasm underground");
    }
    if (settings.exclude_mondstadt) {
        tags.push("mondstadt");
    }
    if (settings.exclude_crystal_chunks) {
        tags.push("crystal chunk");
    }
    if (settings.exclude_condessence_crystals) {
        tags.push("condessence crystal");
    }
    if (settings.exclude_amethyst_lumps) {
        tags.push("amethyst lump");
    }
    return tags;
}

function get_profile_name() {
    if (!settings.profile_id) {
        return null;
    }
    return settings.profile_id;
}

const filename_to_path_map = {};

function load_filename_to_path_map() {
    var all_paths = [];
    const read_dir = (path) => {
        for (const i of file.readPathSync(path)) {
            if (file.isFolder(i)) {
                read_dir(i);
            } else {
                all_paths.push(i);
            }
        }
    };
    read_dir("assets/矿物");
    for (const i of all_paths) {
        const filename = i.replace(/^.*[\\/]/, "");
        filename_to_path_map[filename] = i;
    }
}

var persistent_data = {};
const in_memory_skip_tasks = new Set();

function load_persistent_data() {
    var file_content = "";
    try {
        file_content = file.readTextSync("local/persistent_data.json");
    } catch (error) {}
    if (file_content.length !== 0) {
        persistent_data = JSON.parse(file_content);
    }
}

const disabled_paths = new Set();

function load_disabled_paths() {
    for (const path of ["assets/disabled_paths.conf", "local/disabled_paths.txt"]) {
        var file_content = "";
        try {
            file_content = file.readTextSync(path);
        } catch (error) {}
        for (var l of file_content.split("\n")) {
            l = l.trim();
            if (l.length === 0) {
                continue;
            }
            if (l.startsWith("//") || l.startsWith("#")) {
                continue;
            }
            disabled_paths.add(l);
        }
    }
}

var statistics = {};

function load_statistics_data() {
    statistics = JSON.parse(file.readTextSync("assets/statistics.json")).data;
}

async function flush_persistent_data() {
    await file.writeText("local/persistent_data.json", JSON.stringify(persistent_data, null, "  "));
}

async function mark_task_finished(task_name) {
    const profile_name = get_profile_name();
    const profile_key = !profile_name ? "default-profile" : ("profile-" + profile_name);
    if (!persistent_data.hasOwnProperty(profile_key)) {
        persistent_data[profile_key] = {};
    }
    persistent_data[profile_key][task_name] = {
        "last_run_time": Date.now(),
    };
    await flush_persistent_data();
}

function get_task_last_run_time(task_name) {
    const profile_name = get_profile_name();
    const profile_key = !profile_name ? "default-profile" : ("profile-" + profile_name);
    return persistent_data[profile_key]?.[task_name]?.last_run_time || 0;
}

function is_ore_respawned(t) {
    t /= 1000;
    var t0 = Math.floor(t / 86400) * 86400 + 57600;
    if (t0 > t) {
        t0 -= 86400;
    }
    const respawn_time = t0 + 86400 * 3;
    return respawn_time < Date.now() / 1000;
}

function get_some_tasks() {
    const exclude_tags = new Set(get_exclude_tags());
    var filtered_statistics = [];
    for (const [key, value] of Object.entries(statistics)) {
        if (in_memory_skip_tasks.has(key)) {
            continue;
        }
        if (disabled_paths.has(key)) {
            continue;
        }
        if (value.tags.some(i => exclude_tags.has(i))) {
            continue;
        }
        if (value.statistics.avg_num_defeats > 0) {
            continue;
        }
        if (value.statistics.avg_abnormal_exits > 0) {
            continue;
        }
        if (!filename_to_path_map.hasOwnProperty(key)) {
            continue;
        }
        if (!is_ore_respawned(get_task_last_run_time(key))) {
            log.debug("{name} not respawned, skip", key);
            continue;
        }
        value.statistics.avg_yield_per_min = value.statistics.avg_yield / value.statistics.avg_time_consumed * 60;
        filtered_statistics.push([key, value]);
    }
    filtered_statistics.sort((a, b) =>
        b[1].statistics.avg_yield_per_min - a[1].statistics.avg_yield_per_min
    );

    // We don't want to teleport around all the time. So add some spacial affinity here.
    const look_ahead_num = 20;
    var sorted_filtered_statistics = [];
    for (var i = 0; i < filtered_statistics.length; ++i) {
        if (!filtered_statistics[i]) {
            continue;
        }
        const filename = filtered_statistics[i][0];
        const value = filtered_statistics[i][1];
        const group_name = value.group;
        sorted_filtered_statistics.push([filename, value]);
        filtered_statistics[i] = null;
        for (var j = i + 1; j <= i + look_ahead_num && j < filtered_statistics.length; ++j) {
            if (!filtered_statistics[j]) {
                continue;
            }
            const filename2 = filtered_statistics[j][0];
            const value2 = filtered_statistics[j][1];
            const group_name2 = value2.group;
            if (group_name2 === group_name) {
                sorted_filtered_statistics.push([filename2, value2]);
                filtered_statistics[j] = null;
            }
        }
    }
    if (sorted_filtered_statistics.length === 0) {
        return [];
    }
    const first_out_of_group_index = sorted_filtered_statistics.findIndex(i => i[1].group !== sorted_filtered_statistics[0][1].group);
    const first_group = sorted_filtered_statistics.slice(0, first_out_of_group_index);
    first_group.sort((a, b) => a[0].localeCompare(b[0]));
    return first_group;
}

async function get_inventory() {
    const ore_image_map = {
        amethyst_lumps: "assets/images/amethyst_lump.png",
        crystal_chunks: "assets/images/crystal_chunk.png",
        condessence_crystals: "assets/images/condessence_crystal.png",
    };

    await genshin.returnMainUi();
    keyPress("b")
    await sleep(1000);
    click(964, 53);
    await sleep(500);

    const game_region = captureGameRegion();
    const inventory_result = {
        crystal_chunks: 0,
        condessence_crystals: 0,
        amethyst_lumps: 0
    };
    for (const [name, path] of Object.entries(ore_image_map)) {
        let match_obj = RecognitionObject.TemplateMatch(file.ReadImageMatSync(path));
        match_obj.threshold = 0.85;
        match_obj.Use3Channels = true;
        const match_res = game_region.Find(match_obj);
        if (match_res.isExist()) {
            log.debug(`Found ${name} image at (${match_res.x}, ${match_res.y})`);

            const text_x = match_res.x - 0;
            const text_y = match_res.y + 120;
            const text_w = 120;
            const text_h = 40;

            const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));

            if (ocr_res) {
                inventory_result[name] = Number(ocr_res.text);
            }
        }
    }
    await genshin.returnMainUi();
    return inventory_result;
}

async function run_pathing_script(name, path_state_change, current_states) {
    path_state_change ||= {};
    path_state_change.require ||= [];
    path_state_change.add ||= [];
    path_state_change.sustain ||= [];

    for (const s of path_state_change.require) {
        if (!current_states.has(s)) {
            log.debug("Trying to get {s}", s);
            for (const [name, data] of Object.entries(statistics)) {
                const add_states = data.state_change?.add || [];
                if (add_states.includes(s)) {
                    await run_pathing_script(name, data.state_change, current_states);
                    break;
                }
            }
        }
    }
    log.info("运行 {name}", name);
    var json_content = await file.readText(filename_to_path_map[name]);
    {
        // set Noelle mining action
        const json_obj = JSON.parse(json_content);
        var modified = false;
        for (const i of json_obj.positions) {
            if (i.action === "mining" && !i.action_params) {
                i.action = "combat_script";
                i.action_params = "诺艾尔 attack(2.0)";
                modified = true;
            }
        }
        // scale underwater mining actions
        if (settings.enable_dpi_scaling && statistics[name].tags.includes("fontaine underwater") && genshin.screenDpiScale !== 1.0) {
            for (const i of json_obj.positions) {
                if (i.action_params) {
                    const new_actions = [];
                    for (const a of i.action_params.split(";")) {
                        if (a.startsWith("moveby(")) {
                            const [x, y] = a.slice(7, -1).split(",");
                            const new_val = "moveby(" + String(Math.round(x * genshin.screenDpiScale)) + "," + String(Math.round(y * genshin.screenDpiScale)) + ")";
                            new_actions.push(new_val);
                        } else {
                            new_actions.push(a);
                        }
                    }
                    const new_action_params = new_actions.join(";");
                    if (new_action_params !== i.action_params) {
                        i.action_params = new_action_params;
                        modified = true;
                    }
                }
            }
        }
        if (modified) {
            log.debug("Patched mining action");
            json_content = JSON.stringify(json_obj);
        }
    }
    const cancellation_token = dispatcher.getLinkedCancellationToken();
    const t0 = Date.now();
    forge_pathing_start_log(name);
    await pathingScript.run(json_content);
    const elapsed_time = Date.now() - t0;
    forge_pathing_end_log(name, elapsed_time);
    if (!cancellation_token.isCancellationRequested) {
        if (elapsed_time > 5000) {
            await mark_task_finished(name);
        } else {
            in_memory_skip_tasks.add(name);
            log.warn("脚本运行时间小于5秒，可能发生了错误，不写记录");
        }
    } else {
        throw new Error("Cancelled");
    }

    const new_states = current_states.intersection(new Set(path_state_change.sustain)).union(new Set(path_state_change.add));
    current_states.clear();
    for (const s of new_states) {
        current_states.add(s);
    }
}


async function main() {
    await genshin.returnMainUi();
    load_filename_to_path_map();
    load_persistent_data();
    load_disabled_paths();
    load_statistics_data();
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    // Run an empty pathing script to give BGI a chance to switch team if the user specifies one.
    await pathingScript.runFile("assets/empty_pathing.json");
    if (["natlan", "fontaine terrestrial", "sumeru", "inazuma", "liyue", "chasm underground", "mondstadt"].filter(i => !get_exclude_tags().includes(i)).length > 0) {
        if (!Array.from(getAvatars()).includes("诺艾尔")) {
            log.error("地面挖矿必须带诺艾尔");
            return;
        }
    }

    const get_current_cst_hour = () => (Date.now() / 1000 + 8 * 3600) % 86400 / 3600;
    var run_until_unix_time = settings.target_running_minutes ? (Date.now() + Number(settings.target_running_minutes) * 60 * 1000) : null;
    if (settings.time_range) {
        const time_range = settings.time_range.replace("～", "~").replace("：", ":");
        if (time_range.includes("~")) {

            const [
                [start_h, start_m],
                [end_h, end_m]
            ] = time_range.split("~").map(i => i.split(":").map(Number));
            const start_time = start_h + start_m / 60;
            const end_time = end_h + end_m / 60;
            const current_time = get_current_cst_hour();
            if (start_time < end_time && !(current_time >= start_time && current_time < end_time)) {
                // format like 01:30~03:50
                log.info("不在允许运行的时间内，退出");
                return;
            }
            if (start_time > end_time && current_time < start_time && current_time > end_time) {
                // format like 23:30~4:00
                log.info("不在允许运行的时间内，退出");
                return;
            }
            const run_until_unix_time2 = ((end_time - current_time + 24) % 24) * 3600 * 1000 + Date.now();
            run_until_unix_time = Math.min(run_until_unix_time2, run_until_unix_time || Number.MAX_VALUE);
        } else {
            // format like 03:50
            const [end_h, end_m] = time_range.split(":").map(Number);
            const end_time = end_h + end_m / 60;
            const run_until_unix_time2 = (end_time - get_current_cst_hour() + 24) % 24 * 3600 * 1000 + Date.now();
            run_until_unix_time = Math.min(run_until_unix_time2, run_until_unix_time || Number.MAX_VALUE);
        }
    }

    const original_inventory = await get_inventory();
    log.info("已有水晶块{a}个，紫晶块{b}个，萃凝晶{c}个", original_inventory.crystal_chunks, original_inventory.amethyst_lumps, original_inventory.condessence_crystals);
    const target_yield = settings.target_amount ? Math.floor(Number(settings.target_amount)) : null;
    if (target_yield && !run_until_unix_time) {
        log.info("将挖矿{a}个", target_yield);
    } else if (!target_yield && run_until_unix_time) {
        const running_minutes = Math.round((run_until_unix_time - Date.now()) / 60 / 1000);
        log.info("将挖矿{a}分钟", running_minutes);
    } else if (target_yield && run_until_unix_time) {
        const running_minutes = Math.round((run_until_unix_time - Date.now()) / 60 / 1000);
        log.info("将挖矿{a}个或{b}分钟，任何一个先发生", target_yield, running_minutes);
    } else {
        log.info("将持续挖矿");
    }

    const start_time = Date.now();
    var accurate_yield = 0;
    var estimated_yield = 0;
    var cached_inventory_data = null;

    var finished = false;
    const current_states = new Set();
    while (!finished) {
        const tasks = get_some_tasks();
        if (tasks.length === 0) {
            log.info("没有更多任务可运行，退出");
            finished = true;
        } else {
            log.debug("Running {num} tasks as a group", tasks.length);
        }
        for (const [name, data] of tasks) {
            cached_inventory_data = null;
            try {
                await run_pathing_script(name, data.state_change, current_states);
            } catch (e) {
                finished = true;
                break;
            }
            estimated_yield += data.statistics.avg_yield;

            if (target_yield !== null && estimated_yield >= target_yield + 5) {
                const current_inventory = await get_inventory();
                cached_inventory_data = current_inventory;
                accurate_yield += current_inventory.crystal_chunks - original_inventory.crystal_chunks;
                accurate_yield += current_inventory.condessence_crystals - original_inventory.condessence_crystals;
                accurate_yield += current_inventory.amethyst_lumps - original_inventory.amethyst_lumps;
                estimated_yield = accurate_yield;
            }
            if (target_yield !== null && accurate_yield >= target_yield) {
                finished = true;
                break;
            }
            if (run_until_unix_time !== null && Date.now() >= run_until_unix_time) {
                finished = true;
                break;
            }
        }
    }

    const end_time = Date.now();
    const running_minutes = (end_time - start_time) / 1000 / 60;
    var total_yield_str = [];
    const latest_inventory = cached_inventory_data ? cached_inventory_data : (await get_inventory());
    if (latest_inventory.crystal_chunks - original_inventory.crystal_chunks) {
        total_yield_str.push(`${latest_inventory.crystal_chunks - original_inventory.crystal_chunks}水晶块`);
    }
    if (latest_inventory.condessence_crystals - original_inventory.condessence_crystals) {
        total_yield_str.push(`${latest_inventory.condessence_crystals - original_inventory.condessence_crystals}萃凝晶`);
    }
    if (latest_inventory.amethyst_lumps - original_inventory.amethyst_lumps) {
        total_yield_str.push(`${latest_inventory.amethyst_lumps - original_inventory.amethyst_lumps}紫晶块`);
    }
    if (total_yield_str.length > 0) {
        total_yield_str = "收获" + total_yield_str.join("，");
    } else {
        total_yield_str = "无收获";
    }
    log.info("现有水晶块{a}个，紫晶块{b}个，萃凝晶{c}个", latest_inventory.crystal_chunks, latest_inventory.amethyst_lumps, latest_inventory.condessence_crystals);
    log.info("运行{m}分钟，{y}", running_minutes.toFixed(2), total_yield_str);
}

(async function() {
    await main();
})();