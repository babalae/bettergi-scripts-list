# -*- coding: utf-8 -*-
r"""
把 BetterGI 录制的路径文件，转成「莉奈娅挖矿一条龙」可直接运行的路线。

用法：
    python tools\record_to_linnea.py --region 至冬 --ore 虹滴晶
    python tools\record_to_linnea.py --src "<录制文件或目录>" --region 至冬 --ore 虹滴晶 --battle

不填 --src 时，自动扫描 D:\Game\BetterGI\User\AutoPathing 下最近 24 小时修改过的 json。
文件里的每个 action="mining" 点都会被替换成莉奈娅蓄力射击，其余路径与动作原样保留。
"""

import os, sys, json, io, time, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_abundantore import patch_mining_inplace, DST, ORES

AUTOPATH = r"D:\Game\BetterGI\User\AutoPathing"


def recent_files(root, hours=24):
    limit = time.time() - hours * 3600
    out = []
    for r, d, fs in os.walk(root):
        for f in fs:
            if not f.endswith(".json"):
                continue
            p = os.path.join(r, f)
            try:
                if os.path.getmtime(p) >= limit:
                    out.append(p)
            except Exception:
                pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="录制文件或目录，默认扫 AutoPathing 最近 24 小时")
    ap.add_argument("--region", required=True, help="目标地区，如 至冬 / 蒙德")
    ap.add_argument("--ore", default="", help="矿种 tag，如 虹滴晶")
    ap.add_argument("--battle", action="store_true", help="标记为战斗路线")
    ap.add_argument("--hours", type=int, default=24, help="默认扫描的时间窗口（小时）")
    args = ap.parse_args()

    if args.src and os.path.isfile(args.src):
        files = [args.src]
    elif args.src and os.path.isdir(args.src):
        files = recent_files(args.src, args.hours)
    else:
        files = recent_files(AUTOPATH, args.hours)

    if not files:
        print("没找到录制文件。请先在 BetterGI 里录一条路径，或用 --src 指定文件。")
        return

    outdir = os.path.join(DST, args.region)
    os.makedirs(outdir, exist_ok=True)
    done = skipped = 0
    for p in files:
        try:
            data = json.load(io.open(p, encoding="utf-8"))
        except Exception as e:
            print("读取失败", p, e)
            continue
        pos = data.get("positions") or []
        n_mining = sum(1 for x in pos if (x.get("action") or "") == "mining")
        if n_mining == 0:
            print("跳过（没有挖矿点，录制时请按「记录挖矿点」）:", os.path.basename(p))
            skipped += 1
            continue

        patched = patch_mining_inplace(data)
        info = data.setdefault("info", {})
        tags = []
        if args.ore:
            tags.append(args.ore)
        if args.battle:
            tags.append("战斗")
        info["tags"] = tags
        info["type"] = "collect"
        info["last_modified_time"] = int(time.time() * 1000)
        info.setdefault("name", os.path.splitext(os.path.basename(p))[0])
        info["description"] = "实机录制并转换为莉奈娅路线"

        name = os.path.basename(p)
        dst = os.path.join(outdir, name)
        n = 1
        while os.path.exists(dst):
            dst = os.path.join(outdir, "%s-%d.json" % (os.path.splitext(name)[0], n))
            n += 1
        io.open(dst, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2))
        print("已转换 %s -> %s（替换 %d 个矿点，%d 个路径点）"
              % (os.path.basename(p), os.path.relpath(dst), patched, len(pos)))
        done += 1

    print("完成：%d 条，跳过 %d 条" % (done, skipped))


if __name__ == "__main__":
    main()
