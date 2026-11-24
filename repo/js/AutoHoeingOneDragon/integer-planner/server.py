"""Optional, loopback-only route planner. Start explicitly with Python 3.10+ and SciPy."""
from __future__ import annotations

import json
import math
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp

ADDRESS = ("127.0.0.1", 18766)
ENDPOINT = "/auto-hoeing/solve"
MAX_BYTES = 1024 * 1024
MAX_ROUTES = 2000
SOLVE_SECONDS = 3.0
RATE_TOLERANCE = 1e-7


def number(value, name, maximum, *, integer=False, positive=False):
    if (type(value) not in (int, float) or not math.isfinite(value)
            or value < 0 or value > maximum or (positive and value == 0)
            or (integer and value != int(value))):
        raise ValueError(f"Invalid {name}")
    return value


def validate(data):
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("Unsupported protocol version")
    request_id = data.get("requestId")
    if not isinstance(request_id, str) or not 1 <= len(request_id) <= 100:
        raise ValueError("Invalid requestId")
    cap = number(data.get("eliteLimit"), "eliteLimit", 1000000, integer=True)
    goal = number(data.get("normalTarget"), "normalTarget", 1000000, integer=True)
    rows = data.get("routes")
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_ROUTES:
        raise ValueError("Expected 1..2000 routes")
    ids = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Invalid route")
        route_id = number(row.get("id"), "id", MAX_ROUTES - 1, integer=True)
        if route_id in ids:
            raise ValueError("Duplicate route id")
        ids.add(route_id)
        number(row.get("e"), "e", 1000000, integer=True)
        number(row.get("m"), "m", 1000000, integer=True)
        number(row.get("mora"), "mora", 1e9)
        number(row.get("t"), "t", 86400, positive=True)
        if type(row.get("required")) is not bool:
            raise ValueError("Invalid required flag")
    return rows, cap, goal


def solve(data):
    """Maximize sum(mora*x)/sum(t*x), with a binary variable per whole route.

    Dinkelbach iterations solve min(q*t - mora) globally with HiGHS. A dual
    bound and a positive lower bound on duration certify the final rate to
    RATE_TOLERANCE; an incumbent alone is never labelled optimal.
    """
    rows, cap, goal = validate(data)
    started = time.perf_counter()
    n = len(rows)
    e, m, gain, seconds = (np.array([row[key] for row in rows], dtype=float)
                           for key in ("e", "m", "mora", "t"))
    required = np.array([row["required"] for row in rows], dtype=float)
    bounds = Bounds(required, np.ones(n))
    constraints = LinearConstraint(np.vstack((e, m, np.ones(n))),
                                   [-np.inf, goal, 1], [cap, np.inf, np.inf])
    response = {"version": 1, "requestId": data["requestId"]}
    q = 0.0
    # At least one whole route must be selected, so its duration is >= min(t).
    min_seconds = float(seconds.min())
    for iteration in range(1, 33):
        remaining = SOLVE_SECONDS - (time.perf_counter() - started)
        if remaining <= 0:
            break
        result = milp(q * seconds - gain, integrality=np.ones(n), bounds=bounds,
                      constraints=constraints,
                      options={"mip_rel_gap": 0.0, "time_limit": remaining})
        if result.status == 2:
            return {**response, "status": "infeasible"}
        if result.status != 0 or result.x is None:
            break
        x = np.rint(result.x)
        if (np.max(np.abs(result.x - x)) > 1e-6 or np.any(x < required)
                or np.any(x > 1) or not x.any() or e @ x > cap or m @ x < goal):
            return {**response, "status": "invalid_solution"}
        total_gain, duration = float(gain @ x), float(seconds @ x)
        rate = total_gain / duration
        dual = getattr(result, "mip_dual_bound", None)
        if dual is None or not math.isfinite(dual):
            break
        upper_rate = max(rate, q + max(0.0, -float(dual)) / min_seconds)
        if upper_rate - rate <= RATE_TOLERANCE:
            return {**response, "status": "optimal",
                    "selected": [row["id"] for row, bit in zip(rows, x) if bit],
                    "totals": {"e": int(e @ x), "m": int(m @ x),
                               "mora": total_gain, "seconds": duration},
                    "rate": rate, "upperRate": upper_rate,
                    "iterations": iteration,
                    "solveMs": (time.perf_counter() - started) * 1000}
        if rate < q - RATE_TOLERANCE:
            break
        q = rate
    return {**response, "status": "incomplete",
            "solveMs": (time.perf_counter() - started) * 1000}


class Handler(BaseHTTPRequestHandler):
    # HTTPServer is deliberately serial: only one bounded solve runs at a time.
    # No file, process, game input, account name or route path is accepted.
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def reply(self, code, body):
        raw = json.dumps(body, allow_nan=False, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        # Disallow browser origins and require a custom header; no CORS support.
        if (self.path != ENDPOINT or self.headers.get("Host") != f"{ADDRESS[0]}:{self.server.server_port}"
                or self.headers.get("Origin") is not None
                or self.headers.get("X-BGI-Planner") != "1"):
            self.reply(403, {"error": "Local planner requests only"})
            return
        if (self.headers.get_content_type() != "application/json"
                or self.headers.get("Transfer-Encoding") is not None):
            self.reply(415, {"error": "Expected JSON with Content-Length"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BYTES:
                raise ValueError("Invalid body size")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("Incomplete body")
            data = json.loads(raw)
            result = solve(data)
        except (ValueError, TypeError, KeyError, OverflowError):
            self.reply(400, {"error": "Invalid planner input"})
            return
        except Exception:
            self.reply(500, {"error": "Planner failed"})
            return
        self.reply(200, result)


if __name__ == "__main__":
    print(f"Optional BetterGI planner: http://{ADDRESS[0]}:{ADDRESS[1]}{ENDPOINT}", flush=True)
    print("Only route numbers are processed. Stop with Ctrl+C.", flush=True)
    with HTTPServer(ADDRESS, Handler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
