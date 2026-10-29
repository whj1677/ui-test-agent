"""Focused gate regressions. Temporary files only; no workbench or model starts."""

import base64
import hashlib
import json
import tempfile
import unittest
import sys
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

import ai_context_delivery_scope as scope
import check_ai_context as checker
import collect_delivery_evidence as collector
from ai_context_change_records import GitChange


def digest(value):
    return hashlib.sha256(value).hexdigest()


class DeliveryScopeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.req = "REQ-0001-delivery"
        self.req_source = f"docs/requirements/{self.req}/requirement.source.json"
        self.other = "docs/requirements/REQ-0002-existing/current_state.md"
        self.write(self.other, b"historical FAILED; preserve me")
        self.write("src/existing.mjs", b"existing uncommitted work")
        self.write("src/changed.mjs", b"after")
        self.write(self.req_source, b'{"version":2}')
        self.baseline_rel = "workbench/qa/gate/baseline.json"
        before = {"src/changed.mjs": b"before", self.req_source: b'{"version":1}'}
        self.baseline = {
            "schema": scope.BASELINE_SCHEMA, "git_head": "a" * 40,
            "files": [{"path": p, "sha256": digest((self.root / p).read_bytes())}
                      for p in [self.other, "src/existing.mjs"]],
            "owned_before": {p: base64.b64encode(b).decode() for p, b in before.items()},
        }
        self.write(self.baseline_rel, json.dumps(self.baseline).encode())
        self.manifest = {
            "schema": scope.SCHEMA, "requirement": self.req,
            "baseline": self.baseline_rel, "baseline_sha256": scope.file_sha256(self.root / self.baseline_rel),
            "files": [{"path": p, "before_sha256": digest(b), "after_sha256": scope.file_sha256(self.root / p)}
                      for p, b in before.items()],
            "generated": [f"docs/requirements/{self.req}/delivery_evidence.md"],
            "evidence_directory": "workbench/qa/gate", "evidence_files": [self.baseline_rel],
        }
        self.status = [GitChange(" M", p, None) for p in [self.other, "src/existing.mjs", "src/changed.mjs", self.req_source]]
        self.status += [GitChange("??", p, None) for p in [scope.DEFAULT_SCOPE, self.baseline_rel]]
        self.addCleanup(patch.stopall)
        patch.object(scope, "_git_head", return_value="a" * 40).start()
        patch.object(scope, "git_changes", side_effect=lambda root: self.status).start()
        self.save()

    def write(self, rel, content):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(content)

    def save(self):
        self.write(scope.DEFAULT_SCOPE, json.dumps(self.manifest).encode())

    def test_mixed_existing_requirements_are_preserved_and_one_delivery_is_selected(self):
        result = scope.load_delivery_scope(self.root)
        self.assertEqual(result.requirement, self.req)
        self.assertEqual(result.preserved_count, 2)
        self.assertNotIn(self.other, result.selected_paths)

    def test_preserved_file_drift_is_rejected(self):
        self.write("src/existing.mjs", b"unapproved edit")
        with self.assertRaisesRegex(ValueError, "Preserved working-tree"):
            scope.load_delivery_scope(self.root)

    def test_shared_requirement_index_is_allowed_without_owning_a_second_req(self):
        self.write("docs/requirements/README.md", b"updated index")
        self.manifest["files"].append({"path":"docs/requirements/README.md","before_sha256":None,"after_sha256":digest(b"updated index")})
        self.save()
        self.status.append(GitChange("??", "docs/requirements/README.md", None))
        self.assertIsNotNone(scope.load_delivery_scope(self.root))

    def test_unlisted_new_code_is_rejected(self):
        self.write("src/new.mjs", b"unlisted")
        self.status.append(GitChange("??", "src/new.mjs", None))
        with self.assertRaisesRegex(ValueError, "outside the declared delivery"):
            scope.load_delivery_scope(self.root)

    def test_after_digest_drift_is_rejected(self):
        self.write("src/changed.mjs", b"later edit")
        with self.assertRaisesRegex(ValueError, "file drifted"):
            scope.load_delivery_scope(self.root)

    def test_wrong_before_digest_is_rejected(self):
        self.manifest["files"][0]["before_sha256"] = "0" * 64
        self.save()
        with self.assertRaisesRegex(ValueError, "before digest"):
            scope.load_delivery_scope(self.root)

    def test_unchanged_file_cannot_pose_as_new_delivery(self):
        self.manifest["files"][0]["before_sha256"] = self.manifest["files"][0]["after_sha256"]
        before = self.baseline["owned_before"]
        before["src/changed.mjs"] = base64.b64encode(b"after").decode()
        self.write(self.baseline_rel, json.dumps(self.baseline).encode())
        self.manifest["baseline_sha256"] = scope.file_sha256(self.root / self.baseline_rel)
        self.save()
        with self.assertRaisesRegex(ValueError, "has no change"):
            scope.load_delivery_scope(self.root)

    def test_frozen_baseline_corruption_is_rejected(self):
        self.write(self.baseline_rel, b"{}")
        with self.assertRaisesRegex(ValueError, "baseline digest"):
            scope.load_delivery_scope(self.root)

    def test_second_owned_requirement_is_rejected(self):
        self.manifest["files"].append({"path": self.other})
        self.save()
        with self.assertRaisesRegex(ValueError, "second requirement"):
            scope.load_delivery_scope(self.root)

    def test_parent_path_escape_is_rejected(self):
        self.manifest["files"][0]["path"] = "../outside.py"
        self.save()
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            scope.load_delivery_scope(self.root)

    def test_generated_exception_cannot_hide_source(self):
        self.manifest["generated"].append("src/hidden.mjs")
        self.save()
        with self.assertRaisesRegex(ValueError, "Uncontrolled generated"):
            scope.load_delivery_scope(self.root)

    def test_evidence_exception_cannot_hide_executable(self):
        self.manifest["evidence_files"].append("workbench/qa/gate/hidden.py")
        self.save()
        with self.assertRaisesRegex(ValueError, "cannot hide executable"):
            scope.load_delivery_scope(self.root)

    def test_duplicate_owned_file_is_rejected(self):
        self.manifest["files"].append(self.manifest["files"][0].copy())
        self.save()
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            scope.load_delivery_scope(self.root)

    def test_git_head_change_is_rejected(self):
        with patch.object(scope, "_git_head", return_value="b" * 40):
            with self.assertRaisesRegex(ValueError, "Git HEAD"):
                scope.load_delivery_scope(self.root)

    def test_no_declaration_retains_original_gate(self):
        (self.root / scope.DEFAULT_SCOPE).unlink()
        self.assertIsNone(scope.load_delivery_scope(self.root))

    def test_bad_schema_does_not_disable_gate(self):
        self.manifest["schema"] = "unknown"
        self.save()
        with self.assertRaisesRegex(ValueError, "schema"):
            scope.load_delivery_scope(self.root)


class EvidenceClaimTests(unittest.TestCase):
    HEADER = "| VT | 执行状态 | 当前证据 | 退出码 | 测试数量 | 失败数量 | 跳过数量 |\n|---|---|---|---|---|---|---|\n"

    def issues(self, text):
        found = []
        checker.check_pass_claim_text(Path("04_verification.md"), text, found)
        return found

    def test_different_executions_can_pass_and_fail_without_rewriting_either(self):
        rows = self.HEADER + "| VT-1 | 集成测试通过 | 测试数量26；退出码0 | 0 | 26 | 0 | 0 |\n| VT-2 | 测试失败 | 24例12失败 | 1 | 24 | 12 | 0 |"
        self.assertEqual(self.issues(rows), [])

    def test_same_passed_execution_with_nonzero_exit_is_rejected(self):
        self.assertTrue(self.issues(self.HEADER + "| VT-1 | 集成测试通过 | actual | 1 | 5 | 0 | 0 |"))

    def test_same_passed_execution_with_failure_count_is_rejected(self):
        self.assertTrue(self.issues(self.HEADER + "| VT-1 | 集成测试通过 | actual | 0 | 5 | 1 | 0 |"))

    def test_disclosed_skip_does_not_rewrite_executed_success_as_failure(self):
        self.assertEqual(self.issues(self.HEADER + "| VT-1 | 集成测试通过 | actual | 0 | 5 | 0 | 1 |"), [])

    def test_all_skipped_cannot_count_as_passed_execution(self):
        self.assertTrue(self.issues(self.HEADER + "| VT-1 | 集成测试通过 | actual | 0 | 5 | 0 | 5 |"))

    def test_timeout_behavior_description_is_not_observed_failure(self):
        self.assertEqual(self.issues(self.HEADER + "| VT-1 | 集成测试通过 | 正确显示超时提示；退出码：0；测试数量：5；失败数量：0 | 0 | 5 | 0 | 0 |"), [])

    def test_actual_runner_failure_log_is_rejected(self):
        self.assertTrue(self.issues("## 验证结果\n测试通过\n\n```text\n# tests 3\n# fail 1\n退出码：0\n```"))

    def test_prose_claim_keeps_following_log_in_same_execution(self):
        self.assertTrue(self.issues("## 验证结果\n测试通过\n\n```text\nExit code: -1\n测试数量：3\n```"))

    def test_collector_metadata_cannot_hide_failed_exit_in_next_bullet(self):
        self.assertTrue(self.issues("## Delivery Evidence\n- Verification state: `单元测试通过`\n- Exit code: `1`\n- Test count: `5`\n- Failure count: `1`"))

    def test_vertical_execution_table_keeps_state_and_exit_bound(self):
        self.assertTrue(self.issues("| 字段 | 值 |\n|---|---|\n| 验证状态 | 集成测试通过 |\n| 退出码 | 1 |\n| 测试数量 | 5 |"))

    def test_headerless_vertical_table_cannot_hide_failure(self):
        self.assertTrue(self.issues("| 验证状态 | 集成测试通过 |\n| 退出码 | 1 |\n| 测试数量 | 5 |"))

    def test_table_in_quoted_tool_output_is_not_a_success_claim(self):
        self.assertEqual(self.issues("```text\n"+self.HEADER+"| VT-1 | 集成测试通过 | example | 1 | 5 | 1 | 0 |\n```"), [])

    def test_different_heading_batches_remain_separate(self):
        self.assertEqual(self.issues("### 批次A\n测试通过；退出码：0；测试数量：3\n### 批次B\n执行失败；退出码：1；失败数量：1"), [])

    def test_different_bullets_remain_separate(self):
        self.assertEqual(self.issues("- 批次A集成测试通过；退出码：0；测试数量：3\n- 批次B失败；退出码：1；失败数量：1"), [])

    def test_negated_pass_is_not_a_success_claim(self):
        self.assertEqual(self.issues("不得将测试通过作为结论；退出码：1；失败数量：1"), [])

    def test_state_names_inside_failed_checker_output_are_not_success_claims(self):
        self.assertEqual(self.issues("### Check AI Context\n- Exit code: `1`\n```text\nFAIL\nFix: Use 集成测试通过 or 测试失败\n```"), [])

    def test_pass_without_exit_and_test_evidence_is_rejected(self):
        self.assertTrue(self.issues("测试通过"))

    def test_failed_state_is_legal_but_unknown_state_remains_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            p = root / "04_verification.md"
            p.write_text("| VT | 执行状态 |\n|---|---|\n| VT-1 | 测试失败 |", encoding="utf-8")
            issues = []
            checker.check_verification_states(root, issues)
            self.assertEqual(issues, [])
            p.write_text(p.read_text(encoding="utf-8").replace("测试失败", "任意绿色"), encoding="utf-8")
            checker.check_verification_states(root, issues)
            self.assertEqual(len(issues), 1)

    def test_collector_binds_fingerprint_to_selected_delivery(self):
        selected = scope.DeliveryScope(scope.DEFAULT_SCOPE, "REQ-0001-delivery", ("src/a.py",), 3, "a" * 64)
        with tempfile.TemporaryDirectory() as d, patch.object(collector, "git_status", return_value=[]), patch.object(collector, "git_diff_stat", return_value=""), patch.object(collector, "untracked_files", return_value=[]), patch.object(collector, "code_change_fingerprint", return_value="b" * 64) as fingerprint:
            record = collector.ChangeRecord("REQ", selected.requirement, Path(d))
            body = collector.render_evidence(Path(d), record, "单元测试通过", "python tests.py", "0", "3", "0", "0", "run.log", "c" * 64, "collector-executed-v1", "Ran 3 tests\nOK", "限定交付", "", 0, "PASS", delivery_scope=selected)
            fingerprint.assert_called_once_with(Path(d), ["src/a.py"])
            self.assertIn("Preserved baseline SHA-256", body)


class CollectorTimeoutTests(unittest.TestCase):
    def test_default_and_explicit_bounded_context_budgets(self):
        with patch.object(sys, 'argv', ['collector']):
            self.assertEqual(collector.parse_args().context_timeout, 120)
        with patch.object(sys, 'argv', ['collector', '--context-timeout', '600']):
            self.assertEqual(collector.parse_args().context_timeout, 600)

    def test_zero_or_negative_context_budget_is_rejected(self):
        for value in ['0', '-1']:
            with self.subTest(value=value), patch.object(sys, 'argv', ['collector', '--context-timeout', value]):
                with self.assertRaises(SystemExit) as result:
                    collector.parse_args()
                self.assertEqual(result.exception.code, 2)

    def test_longer_budget_keeps_rule_failure_and_timeout_failure_nonzero(self):
        args = SimpleNamespace(context_timeout=600, verify_state='未完成', verify_command='test',
            verify_exit_code=0, test_count=1, failure_count=0, skipped_count=0, verify_log='run.log',
            verify_log_sha256='a'*64, verification_source='collector-executed-v1', notes='阻塞')
        for code in [1,127]:
            with self.subTest(code=code), tempfile.TemporaryDirectory() as directory:
                root=Path(directory);record=collector.ChangeRecord('REQ','REQ-0001-timeout',root)
                with patch.object(collector,'run_cmd',side_effect=[(0,'dry sync'),(code,'actual check failure')]) as run, patch.object(collector,'render_evidence',return_value='record') as render, patch.object(collector,'write_record_evidence',return_value=root/'evidence.md'):
                    _, actual=collector.collect_one(root,record,args,None)
                    self.assertEqual(actual,code)
                    self.assertEqual(run.call_args.kwargs['timeout'],600)
                    self.assertEqual(render.call_args.args[-2:],(code,'actual check failure'))


if __name__ == "__main__":
    unittest.main(verbosity=2)
