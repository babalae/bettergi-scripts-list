import copy
import http.client
import itertools
import json
import random
import threading
import unittest
from http.server import HTTPServer
from types import SimpleNamespace
from unittest.mock import patch

import server


def example():
    return {"version": 1, "requestId": "test", "eliteLimit": 1, "normalTarget": 1,
            "routes": [
                {"id": 0, "e": 1, "m": 1, "mora": 100, "t": 1, "required": False},
                {"id": 1, "e": 1, "m": 0, "mora": 110, "t": 1, "required": False},
                {"id": 2, "e": 0, "m": 1, "mora": 1, "t": 10, "required": False}]}


def exhaustive(data):
    best = None
    rows = data["routes"]
    for bits in itertools.product((0, 1), repeat=len(rows)):
        if not any(bits) or any(r["required"] and not bit for r, bit in zip(rows, bits)):
            continue
        chosen = [r for r, bit in zip(rows, bits) if bit]
        if sum(r["e"] for r in chosen) > data["eliteLimit"] or sum(r["m"] for r in chosen) < data["normalTarget"]:
            continue
        rate = sum(r["mora"] for r in chosen) / sum(r["t"] for r in chosen)
        best = rate if best is None else max(best, rate)
    return best


class SolverTests(unittest.TestCase):
    def test_whole_route_exchange(self):
        result = server.solve(example())
        self.assertEqual(result["selected"], [0])
        self.assertEqual(result["rate"], 100)
        self.assertLessEqual(result["upperRate"] - result["rate"], server.RATE_TOLERANCE)

    def test_random_against_exhaustive(self):
        rng = random.Random(20261123)
        for trial in range(64):
            data = example()
            data.update(eliteLimit=rng.randrange(12), normalTarget=rng.randrange(15))
            data["routes"] = [{"id": i, "e": rng.randrange(5), "m": rng.randrange(7),
                               "mora": rng.randrange(500) / 4, "t": rng.randrange(1, 100) / 5,
                               "required": rng.random() < 0.1} for i in range(9)]
            expected = exhaustive(data)
            result = server.solve(data)
            with self.subTest(trial=trial):
                if expected is None:
                    self.assertEqual(result["status"], "infeasible")
                else:
                    self.assertEqual(result["status"], "optimal")
                    self.assertAlmostEqual(result["rate"], expected, places=7)
                    self.assertGreaterEqual(result["upperRate"] + 1e-8, expected)

    def test_zero_budget_and_zero_gain(self):
        data = example()
        data.update(eliteLimit=0, normalTarget=0)
        data["routes"][2]["mora"] = 0
        result = server.solve(data)
        self.assertEqual(result["selected"], [2])
        self.assertEqual(result["rate"], 0)

    def test_infeasible_required_routes(self):
        data = example()
        data["routes"][0]["required"] = data["routes"][1]["required"] = True
        self.assertEqual(server.solve(data)["status"], "infeasible")

    def test_limits_do_not_claim_optimal(self):
        with patch.object(server, "SOLVE_SECONDS", 0):
            self.assertEqual(server.solve(example())["status"], "incomplete")
        with patch.object(server, "milp", return_value=SimpleNamespace(status=1, x=None)):
            self.assertEqual(server.solve(example())["status"], "incomplete")
        with patch.object(server, "milp", return_value=SimpleNamespace(
                status=0, x=server.np.array([1, 0, 0]), mip_dual_bound=-10000)):
            self.assertEqual(server.solve(example())["status"], "incomplete")

    def test_reject_bad_inputs(self):
        mutations = [lambda d: d.update(routes=[]), lambda d: d.update(eliteLimit=-1),
                     lambda d: d.update(normalTarget=1.5), lambda d: d.update(normalTarget=True),
                     lambda d: d["routes"][0].update(t=0),
                     lambda d: d["routes"][0].update(mora=float("nan")),
                     lambda d: d["routes"][1].update(id=0),
                     lambda d: d["routes"][0].update(required="false")]
        for mutate in mutations:
            data = copy.deepcopy(example())
            mutate(data)
            with self.assertRaises(ValueError):
                server.solve(data)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = HTTPServer(("127.0.0.1", 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def request(self, **changes):
        connection = http.client.HTTPConnection(*self.httpd.server_address, timeout=5)
        headers = {"Content-Type": "application/json", "X-BGI-Planner": "1", **changes}
        connection.request("POST", server.ENDPOINT, json.dumps(example()), headers)
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_real_http(self):
        status, result = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(result["selected"], [0])

    def test_reject_browser_and_wrong_host(self):
        self.assertEqual(self.request(Origin="http://example.org")[0], 403)
        self.assertEqual(self.request(Host="example.org")[0], 403)
        self.assertEqual(self.request(**{"X-BGI-Planner": "0"})[0], 403)
        self.assertEqual(self.request(**{"Content-Type": "text/plain"})[0], 415)


if __name__ == "__main__":
    unittest.main()
