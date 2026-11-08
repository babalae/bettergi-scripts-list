# -*- coding: utf-8 -*-
"""
从 AbundantOre（矿产资源批发）导入各国矿点路线，转换为「莉奈娅挖矿一条龙」可用格式。

完整复刻 AbundantOre main.js 的 modify_script_for_linnea：
  - 支持 config.json 的 mining_dist_threshold / pinned_mining_points /
    wait_before_mining_points / follow_original_way_points
  - fallback（备用大剑角色）忽略：本脚本队伍只有莉奈娅

纳塔、挪德卡莱已有自录路线，不重复导入。
覆盖版（作者重录）优先，但其中残留的 mining 动作会就地替换为莉奈娅射击。
"""

import os, json, io, math, time, hashlib

SRC = r"D:\Game\BetterGI\User\JsScript\AbundantOre\assets"
OVR = os.path.join(SRC, "path_override", "linnea")
CFG_PATH = os.path.join(OVR, "config.json")
ORE_ROOT = os.path.join(SRC, "矿物")
DST = r"D:\Game\BetterGI\User\JsScript\LinneaMining\paths"
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".imported.txt")

LINNEA_ACTION = "莉奈娅 w(0.05),wait(0.15),moveby(0,2500),wait(0.15),charge(0.65),click(middle)"
DEFAULT_THRESHOLD = 7.5
EXT_DIST = 0.75
EXT_DIST_ASM = 2.0
TAIL_WAIT = 1.2

SKIP_REGIONS = {"纳塔", "挪德卡莱"}
ORES = ["虹滴晶", "白铁块", "水晶块", "萃凝晶", "紫晶块", "魔晶块", "铁块"]


def region_of(name, relpath):
    path = relpath.replace("/", "\\")
    if "旧日之海" in name:
        return "枫丹水下"
    if "枫丹水下" in path:
        return "枫丹水下"
    if "远古圣山" in name:
        return "纳塔"
    for r in ["层岩巨渊", "沉玉谷", "渊下宫", "挪德卡莱", "至冬", "蒙德",
              "璃月", "稻妻", "须弥", "枫丹", "纳塔"]:
        if r in name or r in path:
            return r
    return "其他"


def ore_of(name, relpath):
    for o in ORES:
        if o in relpath or o in name:
            return o
    return ""


def has_battle(name):
    return any(k in name for k in ("战斗", "精英", "高危", "火免", "水免", "冰免"))


def linnea_params(is_last, wait_before=False):
    p = ("wait(4);" if wait_before else "") + LINNEA_ACTION
    if is_last:
        p += ";wait(%s)" % TAIL_WAIT
    return p


def patch_mining_inplace(doc):
    """覆盖版：只把残留的 mining 换成莉奈娅射击，不动结构"""
    pos = doc.get("positions", [])
    n = 0
    for i, p in enumerate(pos):
        if (p.get("action") or "") != "mining":
            continue
        if i > 0 and p.get("type") == "target":
            prev = pos[i - 1]
            x1, y1, x2, y2 = prev.get("x"), prev.get("y"), p.get("x"), p.get("y")
            if None not in (x1, y1, x2, y2) and (x1 != x2 or y1 != y2):
                ext = EXT_DIST_ASM if doc.get("info", {}).get("map_name") == "AncientSacredMountain" else EXT_DIST
                d = math.hypot(x2 - x1, y2 - y1)
                p["type"] = "path"
                p["x"] = x2 + ext * (x2 - x1) / d
                p["y"] = y2 + ext * (y2 - y1) / d
        p["action"] = "combat_script"
        p["action_params"] = linnea_params(i == len(pos) - 1)
        n += 1
    return n


def convert(doc, cfg):
    cfg = cfg or {}
    threshold = cfg.get("mining_dist_threshold", DEFAULT_THRESHOLD)
    pinned = cfg.get("pinned_mining_points")
    wait_before = cfg.get("wait_before_mining_points")
    follow = cfg.get("follow_original_way_points")
    map_name = doc.get("info", {}).get("map_name")

    positions = [json.loads(json.dumps(p)) for p in doc.get("positions", [])]
    segments, seg = [], []
    mid = 0
    for p in positions:
        if p.get("type") == "teleport" and seg:
            segments.append(seg)
            seg = []
        if (p.get("action") or "") == "mining":
            p["_mid"] = mid
            p["_pinned"] = bool(pinned) and mid in pinned
            mid += 1
        seg.append(p)
    if seg:
        segments.append(seg)

    def process(seg):
        # 1. pinned 点周围的其它矿点合并掉
        pin_pos = [(p["x"], p["y"]) for p in seg
                   if (p.get("action") or "") == "mining" and p.get("_pinned")]
        for p in seg:
            if (p.get("action") or "") == "mining" and not p.get("_pinned"):
                for (px, py) in pin_pos:
                    if math.hypot(p["x"] - px, p["y"] - py) < threshold:
                        p["type"], p["action"], p["action_params"] = "path", "", ""
                        break

        # 2. 相邻矿点只保留一个射击点
        last = None
        for p in seg:
            if (p.get("action") or "") != "mining":
                continue
            if p.get("_pinned"):
                last = (p["x"], p["y"])
                continue
            if last is not None and math.hypot(p["x"] - last[0], p["y"] - last[1]) < threshold:
                p["type"], p["action"], p["action_params"] = "path", "", ""
            else:
                last = (p["x"], p["y"])

        # 3. 删除矿点后紧跟的无意义路径点
        useless = set()
        for i, wi in enumerate(seg):
            if (wi.get("action") or "") != "mining":
                continue
            j = i + 1
            while j < len(seg):
                wj = seg[j]
                a = (wj.get("action") or "")
                d = math.hypot(wj["x"] - wi["x"], wj["y"] - wi["y"])
                if (a == "" and wj.get("type") in ("path", "target") and d <= 10) \
                        or (a == "combat_script" and (wj.get("action_params") or "").strip().startswith("wait(")
                            and (wj.get("action_params") or "").strip().endswith(")")) \
                        or a == "pick_around":
                    j += 1
                else:
                    break
            keep = 1 if (follow and wi.get("_mid") in follow) else 0
            for k in range(i + 1 + keep, j):
                useless.add(id(seg[k]))
        seg[:] = [p for p in seg if id(p) not in useless]

        # 4. 动作替换
        for idx, p in enumerate(seg):
            if (p.get("action") or "") != "mining":
                continue
            if idx > 0 and p.get("type") == "target":
                prev = seg[idx - 1]
                x1, y1, x2, y2 = prev["x"], prev["y"], p["x"], p["y"]
                if x1 != x2 or y1 != y2:
                    ext = EXT_DIST_ASM if map_name == "AncientSacredMountain" else EXT_DIST
                    d = math.hypot(x2 - x1, y2 - y1)
                    p["type"] = "path"
                    p["x"] = x2 + ext * (x2 - x1) / d
                    p["y"] = y2 + ext * (y2 - y1) / d
            p["action"] = "combat_script"
            p["action_params"] = linnea_params(idx == len(seg) - 1,
                                               bool(wait_before) and p.get("_mid") in wait_before)

    out = []
    for s in segments:
        process(s)
        for p in s:
            p.pop("_mid", None); p.pop("_pinned", None)
            p["id"] = len(out) + 1
            out.append(p)
    doc["positions"] = out
    return doc


def main():
    # 清理上一轮导入
    if os.path.exists(MANIFEST):
        for line in io.open(MANIFEST, encoding="utf-8").read().splitlines():
            if line.strip() and os.path.isfile(line.strip()):
                try:
                    os.remove(line.strip())
                except Exception:
                    pass

    cfg_all = {}
    if os.path.exists(CFG_PATH):
        cfg_all = json.load(io.open(CFG_PATH, encoding="utf-8"))
    now_ms = int(time.time() * 1000)

    candidates = []
    for root, dirs, fs in os.walk(ORE_ROOT):
        for f in fs:
            if f.endswith(".json"):
                candidates.append((os.path.join(root, f), f))

    written = []
    seen = {}   # (region, filename) -> source kind
    imported = skipped = 0
    stat = {}

    # 覆盖版优先
    def sort_key(item):
        return 0 if item[1] in cfg_all and "file" in cfg_all[item[1]] else 1

    for src, f in sorted(candidates, key=sort_key):
        rel = os.path.relpath(src, ORE_ROOT)
        try:
            raw = json.load(io.open(src, encoding="utf-8"))
        except Exception:
            continue
        name = (raw.get("info") or {}).get("name") or os.path.splitext(f)[0]
        region = region_of(name, rel)
        if region in SKIP_REGIONS:
            skipped += 1
            continue
        ore = ore_of(name, rel)
        cfg = cfg_all.get(f) or {}

        if cfg.get("file"):
            ovr_path = os.path.join(OVR, cfg["file"])
            if not os.path.exists(ovr_path):
                continue
            data = json.load(io.open(ovr_path, encoding="utf-8"))
            patch_mining_inplace(data)
            kind = "override"
        else:
            data = convert(raw, cfg)
            kind = "convert"

        key = (region, f)
        if key in seen:
            # 同名已导入：覆盖版优先，其余视为重复
            if seen[key] == "override" or kind != "override":
                continue
        seen[key] = kind

        info = data.setdefault("info", {})
        tags = [ore] if ore else []
        if has_battle(name):
            tags.append("战斗")
        info["tags"] = tags
        info["type"] = "collect"
        info["name"] = name
        info["last_modified_time"] = now_ms
        info["description"] = ("移植自 AbundantOre 莉奈娅适配路线" if kind == "override"
                               else "由 AbundantOre 路线按莉奈娅算法转换")

        outdir = os.path.join(DST, region)
        os.makedirs(outdir, exist_ok=True)
        dst = os.path.join(outdir, f)
        n = 1
        while os.path.exists(dst):
            dst = os.path.join(outdir, "%s-%d.json" % (os.path.splitext(f)[0], n))
            n += 1
        io.open(dst, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2))
        written.append(dst)
        imported += 1
        s = stat.setdefault(region, {"routes": 0, "points": 0, "override": 0})
        s["routes"] += 1
        s["points"] += len(data.get("positions", []))
        if kind == "override":
            s["override"] += 1

    io.open(MANIFEST, "w", encoding="utf-8").write("\n".join(written))

    print("导入路线:", imported, " 跳过(已有地区):", skipped)
    total_r = total_p = 0
    for r, s in sorted(stat.items(), key=lambda x: -x[1]["routes"]):
        print("  %-10s 路线 %3d  路径点 %4d  覆盖版 %d" % (r, s["routes"], s["points"], s["override"]))
        total_r += s["routes"]; total_p += s["points"]
    print("合计: %d 条 / %d 点" % (total_r, total_p))


if __name__ == "__main__":
    main()
