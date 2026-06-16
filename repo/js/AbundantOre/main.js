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

const use_global_mining_action = settings.custom_mining_action === "默认" || settings.custom_mining_action === "default";

const linnea_chs_name = "莉奈娅";

const country_name_tag_map = {
    "蒙德": "mondstadt",
    "璃月": "liyue",
    "层岩巨渊地下矿区": "chasm underground",
    "稻妻": "inazuma",
    "渊下宫": "enkanomiya",
    "须弥": "sumeru",
    "枫丹地面": "fontaine terrestrial",
    "枫丹水下": "fontaine underwater",
    "旧日之海水下": "sea of bygone eras underwater",
    "纳塔": "natlan",
    "远古圣山": "ancient sacred mountain",
    "挪德卡莱": "nod-krai",
};

function get_exclude_tags() {
    const ore_name_tag_map = {
        "水晶块": "crystal chunk",
        "紫晶块": "amethyst lump",
        "萃凝晶": "condessence crystal",
        "虹滴晶": "rainbowdrop crystal",
    };
    let tags = [];
    if (settings.fight_option === "全跳过") {
        tags.push("fight");
    } else if (settings.fight_option === "只跳过与精英怪战斗的路线") {
        tags.push("elite enemy");
    }
    for (const [i, j] of Object.entries(country_name_tag_map)) {
        if (Array.from(settings.exclude_regions).includes(i)) {
            tags.push(j);
        }
    }
    for (const [i, j] of Object.entries(ore_name_tag_map)) {
        if (Array.from(settings.exclude_ore_types).includes(i)) {
            tags.push(j);
        }
    }
    return tags;
}

function underwater_only() {
    const all_regions = new Set(Object.keys(country_name_tag_map));
    const skipped_regions = new Set(settings.exclude_regions);
    const not_skipped_regions = all_regions.difference(skipped_regions);
    not_skipped_regions.delete("枫丹水下");
    not_skipped_regions.delete("旧日之海水下");
    return not_skipped_regions.size === 0;
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

let linnea_override_config = {};

function load_linnea_override_config() {
    const basedir = "assets/path_override/linnea/";
    const c = JSON.parse(file.readTextSync(basedir + "config.json"));
    for (const [k, v] of Object.entries(c)) {
        if (v.hasOwnProperty("file")) {
            v["file"] = basedir + v["file"];
            if (!v.hasOwnProperty("mining_dist_threshold")) {
                v["mining_dist_threshold"] = 0.0;
            }
        }
    }
    linnea_override_config = c;
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
    let running_time_scale = 1.0;
    if (hints.running_time_scale) {
        log.debug("Schedule with running time scale {a}", hints.running_time_scale);
        running_time_scale = hints.running_time_scale;
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
        value.statistics.avg_yield_per_min = value.statistics.avg_yield / value.statistics.avg_time_consumed * 60 / running_time_scale;
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
        sum_running_seconds += value.statistics.avg_time_consumed * running_time_scale;
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
        candidate_groups[group_name].sum_running_seconds += value.statistics.avg_time_consumed * running_time_scale;
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
        sum_running_seconds += s.statistics.avg_time_consumed * running_time_scale;
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
let mining_character = null;
let fallback_claymore_character = null;

function modify_script_for_claymores(json_content) {
    const json_obj = JSON.parse(json_content);
    let modified = false;
    for (const i of json_obj.positions) {
        if (i.action !== "mining") {
            continue;
        }
        if (settings.custom_mining_action) {
            i.action = "combat_script";
            i.action_params = settings.custom_mining_action;
            modified = true;
        } else if (mining_character === "诺艾尔") {
            i.action = "combat_script";
            i.action_params = "诺艾尔 attack(2.0)";
            modified = true;
        }
    }
    if (modified) {
        log.debug("Patched mining action");
        json_content = JSON.stringify(json_obj);
    }
    return json_content;
}

async function modify_script_for_linnea(json_content, override_config) {
    const linnea_mining_action = `${linnea_chs_name} moveby(0,2500),wait(0.1),charge(0.65),click(middle)`;
    const claymore_mining_actions = {
        "诺艾尔": "attack(2.0)",
        "迪希雅": "attack(0.6),mousedown,wait(2.1),mouseup,j",
        "玛薇卡": "attack(0.20),j,wait(0.5),attack(0.6)",
    };
    const fallback_mining_action = fallback_claymore_character ? (fallback_claymore_character + " " + claymore_mining_actions[fallback_claymore_character]) : null;
    let mining_dist_threshold = 7.5;
    const additional_sleep_time_before_teleport = 1.2;
    let pinned_mining_points = null;
    let fallback_mining_points = null;
    let follow_original_way_points = null;
    let wait_before_mining_points = null;

    if (override_config) {
        if (override_config.hasOwnProperty("file")) {
            json_content = await file.readText(override_config["file"]);
        }
        if (override_config.hasOwnProperty("mining_dist_threshold")) {
            mining_dist_threshold = override_config["mining_dist_threshold"];
        }
        if (override_config.hasOwnProperty("pinned_mining_points")) {
            pinned_mining_points = override_config["pinned_mining_points"];
        }
        if (override_config.hasOwnProperty("fallback_mining_points") && fallback_mining_action !== null) {
            fallback_mining_points = override_config["fallback_mining_points"];
        }
        if (override_config.hasOwnProperty("follow_original_way_points")) {
            follow_original_way_points = override_config["follow_original_way_points"];
        }
        if (override_config.hasOwnProperty("wait_before_mining_points")) {
            wait_before_mining_points = override_config["wait_before_mining_points"];
        }
    }

    const json_obj = JSON.parse(json_content);
    const path_segments = [];
    {
        let segment = [];
        let mining_counter = 0;
        for (const i of json_obj.positions) {
            if (i.type === "teleport") {
                if (segment.length !== 0) {
                    path_segments.push(segment);
                    segment = [];
                }
            }
            if (i.action === "mining") {
                const is_pinned = pinned_mining_points !== null && pinned_mining_points.includes(mining_counter);
                const is_fallback = fallback_mining_action !== null && fallback_mining_points !== null && fallback_mining_points.includes(mining_counter);
                i.internal = {
                    "mining_point_id": mining_counter,
                    "is_pinned": is_pinned || is_fallback,
                    "is_fallback": is_fallback,
                };
                mining_counter += 1;
            }
            segment.push(JSON.parse(JSON.stringify(i)));
        }
        if (segment.length !== 0) {
            path_segments.push(segment);
            segment = [];
        }
    }

    const process_segment = (segment) => {
        // Drop mining points around the pinned ones
        const pinned_mining_pos = [];
        for (const i of segment) {
            if (i.action === "mining" && i.internal.is_pinned) {
                pinned_mining_pos.push({
                    x: i.x,
                    y: i.y,
                });
            }
        }
        for (const i of segment) {
            if (i.action === "mining" && !i.internal.is_pinned) {
                for (const j of pinned_mining_pos) {
                    const dist = Math.hypot(i.x - j.x, i.y - j.y);
                    if (dist < mining_dist_threshold) {
                        i.type = "path";
                        i.action = "";
                        i.action_params = "";
                        break;
                    }
                }
            }
        }

        // Skip some mining points
        let last_linnea_mining_pos = null;
        for (const i of segment) {
            if (i.action !== "mining") {
                continue;
            }
            if (i.internal.is_pinned) {
                if (!i.internal.is_fallback) {
                    last_linnea_mining_pos = {
                        x: i.x,
                        y: i.y
                    };
                }
                continue;
            }
            const dist = last_linnea_mining_pos === null ? 9999 : Math.hypot(i.x - last_linnea_mining_pos.x, i.y - last_linnea_mining_pos.y);
            if (dist < mining_dist_threshold) {
                i.type = "path";
                i.action = "";
                i.action_params = "";
            } else {
                last_linnea_mining_pos = {
                    x: i.x,
                    y: i.y,
                };
            }
        }

        // Skip useless waypoints
        for (let i = 0; i < segment.length; ++i) {
            const wi = segment[i];
            if (wi.action === "mining" && !wi.internal.is_fallback) {
                let j = i + 1;
                for (; j < segment.length; ++j) {
                    const wj = segment[j];
                    if (wj.type === "path" && wj.action === "" && Math.hypot(wj.x - wi.x, wj.y - wi.y) <= 10 ||
                        wj.type === "target" && wj.action === "" && Math.hypot(wj.x - wi.x, wj.y - wi.y) <= 10 ||
                        wj.action === "combat_script" && wj.action_params.match(/^wait\([0-9.]+\)$/g) ||
                        wj.action === "pick_around") {} else {
                        break;
                    }
                }
                let follow_original_way_points_count = 0;
                if (follow_original_way_points && follow_original_way_points.includes(wi.internal.mining_point_id)) {
                    follow_original_way_points_count = 1;
                }
                for (let k = i + 1 + follow_original_way_points_count; k < j; ++k) {
                    if (!segment[k].internal) {
                        segment[k].internal = {};
                    }
                    segment[k].internal.useless = true;
                }
            }
        }
        for (let i = segment.length - 1; i >= 0; --i) {
            if (segment[i].internal?.useless) {
                segment.splice(i, 1);
            }
        }

        // patch mining actions
        for (const [id, i] of segment.entries()) {
            if (i.action === "mining") {
                if (i.internal.is_fallback) {
                    i.action = "combat_script";
                    i.action_params = fallback_mining_action;
                } else {
                    if (id > 0 && i.type === "target") {
                        let ext_dist = 0.75;
                        if (json_obj.info.map_name === "AncientSacredMountain") {
                            ext_dist = 2.0;
                        }
                        const x1 = segment[id - 1].x;
                        const y1 = segment[id - 1].y;
                        const x2 = i.x;
                        const y2 = i.y;
                        if (x1 !== x2 || y1 !== y2) {
                            const x3 = x2 + ext_dist * (x2 - x1) / Math.hypot(x2 - x1, y2 - y1);
                            const y3 = y2 + ext_dist * (y2 - y1) / Math.hypot(x2 - x1, y2 - y1);
                            i.type = "path";
                            i.x = x3;
                            i.y = y3;
                        }
                    }
                    i.action = "combat_script";
                    let action_params = linnea_mining_action;
                    if (wait_before_mining_points && wait_before_mining_points.includes(i.internal.mining_point_id)) {
                        action_params = "wait(4);" + action_params;
                    }
                    if (additional_sleep_time_before_teleport > 0.0 && id === segment.length - 1) {
                        action_params += `;wait(${additional_sleep_time_before_teleport})`;
                    }
                    i.action_params = action_params;
                }
            }
        }
    };

    const patched_positions = [];
    for (const segment of path_segments) {
        process_segment(segment);
        for (const i of segment) {
            const i_copy = JSON.parse(JSON.stringify(i));
            delete i_copy.internal;
            i_copy.id = patched_positions.length + 1;
            patched_positions.push(i_copy);
        }
    }
    json_obj.positions = patched_positions;

    log.debug("Patched mining action for Linnea");
    json_content = JSON.stringify(json_obj);
    return json_content;
}

async function run_pathing_script(name, tags, path_state_change, current_states) {
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
                    await run_pathing_script(name, data.tags, data.state_change, current_states);
                    break;
                }
            }
        }
    }
    log.info("运行 {name}", name);
    let json_content = await file.readText(filename_to_path_map[name]);
    if (use_global_mining_action || tags.includes("fontaine underwater") || tags.includes("sea of bygone eras underwater")) {
        // nop
    } else if (settings.custom_mining_action || mining_character === "诺艾尔") {
        json_content = modify_script_for_claymores(json_content);
    } else if (mining_character === linnea_chs_name) {
        json_content = await modify_script_for_linnea(json_content, linnea_override_config[name] || null);
    }

    const cancellation_token = dispatcher.getLinkedCancellationToken();
    const t0 = Date.now();
    forge_pathing_start_log(name);
    await pathingScript.run(json_content);
    await sleep(1000);
    const elapsed_time = Date.now() - t0;
    forge_pathing_end_log(name, elapsed_time);
    if (!cancellation_token.isCancellationRequested) {
        const curr_pos = (() => {
            try {
                const p = genshin.getPositionFromMap(JSON.parse(json_content).info.map_name);
                if (p === null) {
                    return [null, null];
                }
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
    load_linnea_override_config();
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    // Run an empty pathing script to give BGI a chance to switch team if the user specifies one.
    await pathingScript.runFile("assets/empty_pathing.json");
    if (!Object.keys(settings).includes("exclude_ore_types")) {
        log.error("首次运行前请编辑JS脚本自定义配置");
        return;
    }
    log.debug("Fight options: {a}", settings.fight_option);
    log.debug("Exclude regions: {a}, exclude types: {b}", settings.exclude_regions, settings.exclude_ore_types);
    log.debug("Exclude tags: {a}", get_exclude_tags());
    log.debug("Underwater only: {a}", underwater_only());

    const characters = Array.from(getAvatars());
    if (characters.includes(linnea_chs_name) && (use_global_mining_action || (settings.custom_mining_action || "").includes(linnea_chs_name))) {
        log.error("{l}挖矿请{no}填写自定义挖矿动作", linnea_chs_name, "勿");
        return;
    }
    if (!underwater_only() && !settings.custom_mining_action) {
        const preapproved_mining_characters = [linnea_chs_name, "诺艾尔"];
        const preapproved_fallback_claymore_characters = ["诺艾尔", "玛薇卡", "迪希雅"];
        for (const i of preapproved_mining_characters) {
            if (characters.includes(i)) {
                mining_character = i;
                break;
            }
        }
        if (mining_character === null) {
            log.error("地面挖矿请带{c}", preapproved_mining_characters.join("或"));
            return;
        }
        if (mining_character === linnea_chs_name) {
            for (const i of preapproved_fallback_claymore_characters) {
                if (characters.includes(i)) {
                    fallback_claymore_character = i;
                    break;
                }
            }
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
        if (mining_character === linnea_chs_name) {
            hints.running_time_scale = 0.75;
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
                await run_pathing_script(name, data.tags, data.state_change, current_states);
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
