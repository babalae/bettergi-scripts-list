function forge_pathing_start_log(name) {
    const t = new Date();
    const timestamp = t.toTimeString().slice(0, 8) + "." + String(t.getMilliseconds()).padStart(3, "0");
    let c = "Forging start log\n\n";
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n------------------------------\n\n`;
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n→ 开始执行地图追踪任务: "${name}"`;
    log.debug(c);
}

function forge_pathing_end_log(name, elapsed_time) {
    const elapsed_min = Math.floor(elapsed_time / 1000 / 60);
    const elapsed_sec = (elapsed_time / 1000 % 60).toFixed(3);
    const t = new Date();
    const timestamp = t.toTimeString().slice(0, 8) + "." + String(t.getMilliseconds()).padStart(3, "0");
    let c = "Forging end log\n\n";
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n→ 脚本执行结束: "${name}", 耗时: ${elapsed_min}分${elapsed_sec}秒\n\n`;
    c += `[${timestamp}] [INF] BetterGenshinImpact.Service.ScriptService\n------------------------------`;
    log.debug(c);
}

function get_exclude_tags() {
    let tags = [];
    if (settings.fight_option === "全跳过") {
        tags.push("fight");
    } else if (settings.fight_option === "只跳过与精英怪战斗的路线") {
        tags.push("elite enemy");
    }
    if (settings.exclude_nod_krai) {
        tags.push("nod-krai");
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
    if (settings.exclude_rainbowdrop_crystals) {
        tags.push("rainbowdrop crystal");
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
    let all_paths = [];
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

let persistent_data = {};
const in_memory_skip_tasks = new Set();

function load_persistent_data() {
    let file_content = "";
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
        let file_content = "";
        try {
            file_content = file.readTextSync(path);
        } catch (error) {}
        for (let l of file_content.split("\n")) {
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

let statistics = {};

function load_statistics_data() {
    statistics = JSON.parse(file.readTextSync("assets/statistics.json")).data;
}

const flaky_end_paths = new Set();

function load_flaky_end_paths() {
    let file_content = "";
    try {
        file_content = file.readTextSync("assets/flaky_end_paths.conf");
    } catch (error) {}
    for (let l of file_content.split("\n")) {
        l = l.trim();
        if (l.length === 0) {
            continue;
        }
        if (l.startsWith("//") || l.startsWith("#")) {
            continue;
        }
        flaky_end_paths.add(l);
    }
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
    let t0 = Math.floor(t / 86400) * 86400 + 57600;
    if (t0 > t) {
        t0 -= 86400;
    }
    const respawn_time = t0 + 86400 * 3;
    return respawn_time < Date.now() / 1000;
}

function get_some_tasks(hints) {
    hints.target_running_seconds = Math.min(7200, hints.target_running_seconds || Number.MAX_VALUE);
    if (hints.target_yield) {
        log.debug("Schedule with target yield {a}", hints.target_yield);
    }
    if (hints.target_running_seconds) {
        log.debug("Schedule with target runnning seconds {a}", hints.target_running_seconds);
    }
    const exclude_tags = new Set(get_exclude_tags());
    let filtered_statistics = [];
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
        if (value.statistics.avg_num_defeats > 0.5) {
            continue;
        }
        if (value.statistics.avg_abnormal_exits > 0.5) {
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
    let candidates = [];
    let sum_yield = 0;
    let sum_running_seconds = 0;
    for (const [key, value] of filtered_statistics) {
        candidates.push([key, value]);
        sum_yield += value.statistics.avg_yield;
        sum_running_seconds += value.statistics.avg_time_consumed;
        if (hints.target_yield !== null && sum_yield >= hints.target_yield) {
            break;
        }
        if (hints.target_running_seconds !== null && sum_running_seconds >= hints.target_running_seconds) {
            break;
        }
    }

    const candidate_groups = {};
    for (const [key, value] of candidates) {
        const group_name = value.group;
        if (!candidate_groups.hasOwnProperty(group_name)) {
            candidate_groups[group_name] = {
                sum_yield: 0,
                sum_running_seconds: 0,
                tasks: [],
            };
        }
        candidate_groups[group_name].tasks.push(key);
        candidate_groups[group_name].sum_yield += value.statistics.avg_yield;
        candidate_groups[group_name].sum_running_seconds += value.statistics.avg_time_consumed;
    }
    for (const i of Object.values(candidate_groups)) {
        i.avg_yield_per_min = sum_yield / sum_running_seconds * 60;
        i.tasks.sort();
    }
    const tasks = Array.from(Object.values(candidate_groups)).sort((a, b) => b.avg_yield_per_min - a.avg_yield_per_min).map(i => i.tasks).flat();
    let log_content = "";
    sum_yield = 0;
    sum_running_seconds = 0;
    for (const i of tasks) {
        const s = statistics[i]
        log_content += `    ${s.statistics.avg_yield_per_min.toFixed(2)} ${i}\n`;
        sum_yield += s.statistics.avg_yield;
        sum_running_seconds += s.statistics.avg_time_consumed;
    }
    log.debug(log_content);
    log.debug("Expected yield {a}, time {b} min", sum_yield, sum_running_seconds / 60);
    return tasks.map(i => [i, statistics[i]]);
}

async function close_expired_stuff_popup_window() {
    const game_region = captureGameRegion();

    const text_x = 850;
    const text_y = 273;
    const text_w = 225;
    const text_h = 51;
    const ocr_res = game_region.find(RecognitionObject.ocr(text_x, text_y, text_w, text_h));
    if (ocr_res) {
        if (ocr_res.text.includes("物品过期")) {
            log.info("检测到物品过期");
            click(1000, 750);
            await sleep(1000);
        }
    }

    game_region.dispose();
}

async function get_inventory() {
    const ore_image_map = {
        amethyst_lumps: "assets/images/amethyst_lump.png",
        crystal_chunks: "assets/images/crystal_chunk.png",
        condessence_crystals: "assets/images/condessence_crystal.png",
        rainbowdrop_crystals: "assets/images/rainbowdrop_crystal.png",
    };

    await genshin.returnMainUi();
    keyPress("b")
    await sleep(1000);
    await close_expired_stuff_popup_window();
    click(964, 53);
    await sleep(500);

    const game_region = captureGameRegion();
    const inventory_result = {
        crystal_chunks: 0,
        condessence_crystals: 0,
        amethyst_lumps: 0,
        rainbowdrop_crystals: 0,
    };
    for (const [name, path] of Object.entries(ore_image_map)) {
        for (const suffix of ["", "_new"]) {
            const filename_with_suffix = path.replace(".png", suffix + ".png");
            let match_obj = RecognitionObject.TemplateMatch(file.ReadImageMatSync(filename_with_suffix));
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
                break;
            }
        }
    }
    game_region.dispose();
    if (inventory_result.crystal_chunks + inventory_result.condessence_crystals + inventory_result.amethyst_lumps + inventory_result.rainbowdrop_crystals === 0) {
        log.error("获取背包矿石数量失败");
    }
    await genshin.returnMainUi();
    return inventory_result;
}

let last_script_end_pos = [null, null];
let last_script_normal_completion = true;

async function run_pathing_script(name, path_state_change, current_states) {
    path_state_change ||= {};
    path_state_change.require ||= [];
    path_state_change.add ||= [];
    path_state_change.sustain ||= [];

    const use_global_mining_action = settings.custom_mining_action === "默认" || settings.custom_mining_action === "default";

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
    let json_content = await file.readText(filename_to_path_map[name]);
    {
        const json_obj = JSON.parse(json_content);
        let modified = false;
        for (const i of json_obj.positions) {
            if (use_global_mining_action) {
                if (settings.custom_mining_action && i.action === "combat_script" && i.action_params.includes("诺艾尔 ")) {
                    i.action = "mining";
                    i.action_params = "";
                    modified = true;
                }
            } else {
                if (i.action === "mining") {
                    // set Noelle mining action
                    i.action = "combat_script";
                    i.action_params = settings.custom_mining_action || "诺艾尔 attack(2.0)";
                    modified = true;
                } else if (settings.custom_mining_action && i.action === "combat_script" && i.action_params.includes("诺艾尔 ")) {
                    i.action_params = settings.custom_mining_action;
                    modified = true;
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
        const curr_pos = (() => {
            try {
                const p = genshin.getPositionFromMap(JSON.parse(json_content).info.map_name);
                return [p.X, p.Y];
            } catch (e) {}
            return [null, null];
        })();
        log.debug("Character current pos ({x},{y})", curr_pos[0], curr_pos[1]);
        let character_moved = false;
        if (curr_pos[0] === null || last_script_end_pos[0] === null) {
            character_moved = curr_pos[0] !== last_script_end_pos[0] || curr_pos[1] !== last_script_end_pos[1];
            log.debug("Character {action}", character_moved ? "moved" : "not moved");
        } else {
            const dist = Math.sqrt(Math.pow(curr_pos[0] - last_script_end_pos[0], 2) + Math.pow(curr_pos[1] - last_script_end_pos[1], 2));
            character_moved = dist > 5;
            log.debug("Character moved distance of {dist}", dist);
        }
        if (!character_moved && flaky_end_paths.has(name) && last_script_normal_completion) {
            log.debug("Assuming script successfully completed");
            character_moved = true;
        }
        last_script_end_pos = curr_pos;
        if (elapsed_time <= 5000) {
            in_memory_skip_tasks.add(name);
            log.warn("脚本运行时间小于5秒，可能发生了错误，不写记录");
            last_script_normal_completion = false;
        } else if (!character_moved) {
            in_memory_skip_tasks.add(name);
            log.warn("角色未移动，可能发生了错误，不写记录");
            last_script_normal_completion = false;
        } else {
            await mark_task_finished(name);
            last_script_normal_completion = true;
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
    file.writeTextSync("local/disabled_paths.txt", "", true);
    file.writeTextSync("local/persistent_data.json", "", true);
    load_filename_to_path_map();
    load_persistent_data();
    load_disabled_paths();
    load_statistics_data();
    load_flaky_end_paths();
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    // Run an empty pathing script to give BGI a chance to switch team if the user specifies one.
    await pathingScript.runFile("assets/empty_pathing.json");
    if (["natlan", "fontaine terrestrial", "sumeru", "inazuma", "liyue", "chasm underground", "mondstadt"].filter(i => !get_exclude_tags().includes(i)).length > 0) {
        if (!Array.from(getAvatars()).includes("诺艾尔") && !settings.custom_mining_action) {
            log.error("地面挖矿请带诺艾尔");
            return;
        }
    }

    const get_current_cst_hour = () => (Date.now() / 1000 + 8 * 3600) % 86400 / 3600;
    let run_until_unix_time = settings.target_running_minutes ? (Date.now() + Number(settings.target_running_minutes) * 60 * 1000) : null;
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
    log.info("已有水晶块{a}个，紫晶块{b}个，萃凝晶{c}个，虹滴晶{d}个", original_inventory.crystal_chunks, original_inventory.amethyst_lumps, original_inventory.condessence_crystals, original_inventory.rainbowdrop_crystals);
    const target_yield = settings.target_amount ? Math.ceil(Number(settings.target_amount)) : null;
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
    let last_log_progress_time = 0;
    let accurate_yield = 0;
    let estimated_yield = 0;
    let cached_inventory_data = original_inventory;

    let finished = false;
    const current_states = new Set();
    while (!finished) {
        const hints = {
            target_yield: target_yield ? (target_yield - estimated_yield + 5) : null,
            target_running_seconds: run_until_unix_time ? (run_until_unix_time - Date.now()) / 1000 : null,
        };
        {
            const now = Math.floor(Date.now() / 1000);
            let next_refresh_unix_time = Math.floor(now / 86400) * 86400 + 16 * 3600;
            next_refresh_unix_time += 180; // to avoid the effect of clock skew
            if (next_refresh_unix_time < now) {
                next_refresh_unix_time += 86400;
            }
            if (!(hints.target_yield || hints.target_running_seconds)) {
                hints.target_yield = 500;
            }
            const target_running_seconds2 = next_refresh_unix_time - now;
            if (!hints.target_running_seconds || target_running_seconds2 < hints.target_running_seconds) {
                hints.target_running_seconds = target_running_seconds2;
            }
        }
        const tasks = get_some_tasks(hints);
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
                accurate_yield += current_inventory.rainbowdrop_crystals - original_inventory.rainbowdrop_crystals;
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
            if (Date.now() - last_log_progress_time > 30000) {
                last_log_progress_time = Date.now();
                {
                    const estimated_prompt = estimated_yield === accurate_yield ? "" : "（预计）";
                    const target_yield_prompt = target_yield === null ? "" : `/${target_yield}`;
                    log.info(`当前产出${estimated_prompt}：${Math.round(estimated_yield)}${target_yield_prompt}个`);
                    // For ABGI only
                    log.debug(`当前进度：${Math.round(estimated_yield)}${target_yield_prompt}个`);
                } {
                    const running_minutes = ((Date.now() - start_time) / 1000 / 60).toFixed(1);
                    const total_minutes_prompt = run_until_unix_time === null ? "" : `/${Math.round((run_until_unix_time - start_time) / 60 / 1000)}`;
                    log.info(`当前运行时间：${running_minutes}${total_minutes_prompt}分钟`);
                }
            }
        }
    }

    const end_time = Date.now();
    const running_minutes = (end_time - start_time) / 1000 / 60;
    let total_yield_str = [];
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
    if (latest_inventory.rainbowdrop_crystals - original_inventory.rainbowdrop_crystals) {
        total_yield_str.push(`${latest_inventory.rainbowdrop_crystals - original_inventory.rainbowdrop_crystals}虹滴晶`);
    }
    if (total_yield_str.length > 0) {
        total_yield_str = "收获" + total_yield_str.join("，");
    } else {
        total_yield_str = "无收获";
    }
    log.info("现有水晶块{a}个，紫晶块{b}个，萃凝晶{c}个，虹滴晶{d}个", latest_inventory.crystal_chunks, latest_inventory.amethyst_lumps, latest_inventory.condessence_crystals, latest_inventory.rainbowdrop_crystals);
    const summary = `运行${running_minutes.toFixed(2)}分钟，${total_yield_str}`;
    log.info(summary);
    notification.send(summary);
}

(async function() {
    await main();
})();
