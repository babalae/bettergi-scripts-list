"""Reproduce CPU-only route selection timings; never reads BetterGI user records."""
import argparse
import json
import platform
import statistics
import subprocess
import sys
import time
from pathlib import Path

import scipy
from server import solve


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeats", type=int, default=7)
    args = parser.parse_args()
    if not 1 <= args.repeats <= 100:
        parser.error("repeats must be 1..100")
    folder = Path(__file__).resolve().parent
    captured = json.loads(subprocess.check_output(["node", str(folder / "benchmark.cjs")], text=True, encoding="utf-8"))
    result = {key: value for key, value in captured.items() if key != "cases"}
    result.update(python=platform.python_version(), scipy=scipy.__version__,
                  platform=platform.platform(), repeats=args.repeats, cases=[])
    for case in captured["cases"]:
        data = case["input"]
        solve(data)  # exclude import and solver initialization from warm timings
        timings = []
        for _ in range(args.repeats):
            start = time.perf_counter()
            plan = solve(data)
            timings.append((time.perf_counter() - start) * 1000)
        cold_script = "import json,sys;from server import solve;print(json.dumps(solve(json.load(sys.stdin))))"
        start = time.perf_counter()
        cold = json.loads(subprocess.check_output([sys.executable, "-X", "utf8", "-c", cold_script],
            input=json.dumps(data), text=True, encoding="utf-8", cwd=folder))
        cold_ms = (time.perf_counter() - start) * 1000
        result["cases"].append({
            "name": case["name"], "variables": len(data["routes"]), "inputSha256": case["inputSha256"],
            "eliteLimit": data["eliteLimit"], "normalTarget": data["normalTarget"],
            "legacyMedianMs": statistics.median(case["legacyMs"]), "legacy": case["legacy"],
            "solverMedianMs": statistics.median(timings), "solverMaxMs": max(timings),
            "coldProcessMs": cold_ms, "status": plan["status"],
            "totals": plan.get("totals"), "rate": plan.get("rate"),
            "upperRate": plan.get("upperRate"), "coldStatus": cold["status"]})
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
