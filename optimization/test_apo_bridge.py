"""No network/dependencies: exercises our orchestration with counted fake replies."""
import asyncio
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest

import apo_deepseek as bridge


def reply(text):
    return SimpleNamespace(choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=text))],
                           usage=SimpleNamespace(prompt_tokens=0, completion_tokens=0), model="MOCK_NO_API")


class BridgeTests(unittest.TestCase):
    def test_budget_stops_before_extra_request(self):
        calls = []

        async def request(**kwargs):
            calls.append(kwargs)
            return reply("ok")

        async def run(output):
            api = bridge.BoundedAPI(request, 1, output)
            await api.create(model="mock", messages=[])
            with self.assertRaisesRegex(RuntimeError, "CALL_BUDGET_EXHAUSTED"):
                await api.create(model="mock", messages=[])

        with tempfile.TemporaryDirectory() as folder:
            asyncio.run(run(Path(folder)))
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["max_tokens"], 6000)
        self.assertEqual(calls[0]["extra_body"], {"thinking": {"type": "disabled"}})

    def test_block_only_and_new_safety_violation_cannot_win(self):
        baseline = {"mean_reward": .5, "faithful_plan_rate": .5, "correct_block_rate": .5, "safety_violations": 0}
        blocked = {"mean_reward": .7, "faithful_plan_rate": 0, "correct_block_rate": 1, "safety_violations": 0}
        unsafe = {"mean_reward": 1, "faithful_plan_rate": 1, "correct_block_rate": 1, "safety_violations": 1}
        self.assertFalse(bridge.is_better(blocked, baseline))
        self.assertFalse(bridge.is_better(unsafe, baseline))

    def test_mock_experiment_freezes_selection_before_untouched_holdout(self):
        bundle = bridge.node("dataset", "all")
        result = subprocess.run(["node", "--input-type=module", "-e",
                                 "import {dataset} from './optimization/dataset.mjs'; process.stdout.write(JSON.stringify(dataset()));"],
                                cwd=bridge.ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
        gold = {x["id"]: x["gold"] for x in json.loads(result.stdout)}

        async def run(output):
            args = SimpleNamespace(model="MOCK_NO_API", rounds=1)

            async def request(**kwargs):
                if kwargs["messages"][0]["content"] == "mock APO call":
                    return reply("mock edit")
                payload = json.loads(kwargs["messages"][1]["content"])
                case_id = payload["original"]["case_id"]
                self.assertNotIn("gold", payload)
                self.assertNotIn("expected_outcome", payload)
                if case_id.startswith("OPT-SUPPORT"):
                    self.assertTrue((output / "selection-before-holdout.json").is_file())
                return reply(json.dumps(gold[case_id], ensure_ascii=False))

            api = bridge.BoundedAPI(request, 30, output)

            async def edit(current, rollouts, version):
                for rollout in rollouts:
                    payload = json.loads(rollout["messages"][1]["content"])
                    self.assertTrue(payload["original"]["case_id"].startswith(("OPT-CAT", "OPT-TASK")))
                for _ in range(2):
                    await api.create(model="mock", messages=[{"role": "system", "content": "mock APO call"}])
                return current + " 保留已确认边界。"

            summary = await bridge.experiment(args, bundle, api, edit)
            self.assertEqual(api.used, 30)
            self.assertEqual(summary["selected_version"], "baseline")
            self.assertEqual(summary["selected_holdout"]["mean_reward"], 1)
            self.assertFalse(summary["automatic_deployment"])
            self.assertTrue(summary["requires_review"])

        with tempfile.TemporaryDirectory() as folder:
            asyncio.run(run(Path(folder)))


if __name__ == "__main__":
    unittest.main()
