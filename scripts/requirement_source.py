#!/usr/bin/env python3
"""Render and verify canonical requirement sources; audit legacy packages read-only."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SOURCE_FILE = "requirement.source.json"
SOURCE_SCHEMA = "ai-engineering-context/requirement-source-v1"
PACKAGE_SCHEMA = "ai-engineering-context/req-package-v1"
GENERATED_NOTICE = "<!-- generated from requirement.source.json; do not edit directly -->"
GENERATED_FILES = (
    "current_state.md",
    "change_log.md",
    "00_user_requirement.md",
    "01_development_requirement.md",
    "02_design.md",
    "03_tasks.md",
    "04_verification.md",
    "05_trace.md",
)
REQ_NAME = re.compile(r"^REQ-(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*$")
REQ_ID = re.compile(r"^REQ-(\d{4})$")
TOP_KEYS = {
    "schema", "req_id", "title", "metadata", "original_input", "user_requirements",
    "confirmed_facts", "inferences_and_open_questions", "development_requirements",
    "design_decisions", "interfaces_and_data_flow", "module_document_impact",
    "risks_and_rollback", "tasks", "verification_items", "verification_environment",
    "trace_current", "trace_history", "open_questions", "prohibited_implementation",
    "changes",
}
ITEM_KEYS = {
    "user_requirements": {"id", "status", "goal", "constraints", "success_criteria"},
    "development_requirements": {"id", "status", "requirement", "acceptance_criteria", "constraints"},
    "design_decisions": {"id", "dr_ids", "status", "summary", "rationale"},
    "tasks": {"id", "dr_ids", "dd_ids", "status", "task", "verification_ids"},
    "verification_items": {
        "id", "dr_ids", "confirmation_status", "execution_status", "item",
        "evidence_standard", "current_evidence",
    },
    "trace_current": {"un_id", "dr_id", "dd_id", "tk_id", "vt_id", "status"},
    "trace_history": {"version", "link", "status", "notes"},
    "changes": {"date", "version", "type", "description", "impact", "confirmed_by"},
}


@dataclass(frozen=True)
class LegacyAudit:
    package: str
    views: int
    byte_count: int
    sha256: str
    identifiers: int


def _keys(value: dict[str, Any], expected: set[str], where: str) -> None:
    missing = sorted(expected - set(value))
    extra = sorted(set(value) - expected)
    if missing or extra:
        raise ValueError(f"{where} fields differ: missing={missing}, unknown={extra}")


def _nonempty(value: Any, where: str) -> None:
    if re.fullmatch(r"source\.verification_items\[\d+\]\.current_evidence", where) and isinstance(value, dict):
        _keys(value, {"command", "exit_code", "test_count", "failure_count", "skipped_count", "log_path"}, where)
        for key in ("command", "log_path"):
            if not isinstance(value[key], str) or not value[key].strip():
                raise ValueError(f"{where}.{key} must be a non-empty string")
        for key in ("exit_code", "test_count", "failure_count", "skipped_count"):
            if type(value[key]) is not int:
                raise ValueError(f"{where}.{key} must be an integer")
            if key != "exit_code" and value[key] < 0:
                raise ValueError(f"{where}.{key} must not be negative")
        if value["failure_count"] + value["skipped_count"] > value["test_count"]:
            raise ValueError(f"{where}: failed and skipped counts exceed test_count")
        return
    if isinstance(value, str):
        if not value.strip():
            raise ValueError(f"{where} must not be empty")
        return
    if isinstance(value, list):
        if not value:
            raise ValueError(f"{where} must not be empty")
        for index, item in enumerate(value):
            _nonempty(item, f"{where}[{index}]")
        return
    if isinstance(value, dict):
        if not value:
            raise ValueError(f"{where} must not be empty")
        for key, item in value.items():
            _nonempty(item, f"{where}.{key}")
        return
    if isinstance(value, int):
        if value < 1:
            raise ValueError(f"{where} must be positive")
        return
    raise ValueError(f"{where} has unsupported value type")


def validate_source(source: dict[str, Any], package_name: str | None = None) -> None:
    if not isinstance(source, dict):
        raise ValueError("source root must be an object")
    _keys(source, TOP_KEYS, "source")
    if source["schema"] != SOURCE_SCHEMA:
        raise ValueError(f"schema must be {SOURCE_SCHEMA}")
    match = REQ_ID.fullmatch(str(source["req_id"]))
    if not match:
        raise ValueError("req_id must match REQ-NNNN")
    number = match.group(1)
    if package_name and not package_name.startswith(f"{source['req_id']}-"):
        raise ValueError("req_id does not match package directory")
    metadata = source["metadata"]
    if not isinstance(metadata, dict):
        raise ValueError("metadata must be an object")
    _keys(metadata, {"requirement_status", "governance_level", "version", "last_updated"}, "metadata")
    environment = source["verification_environment"]
    if not isinstance(environment, dict):
        raise ValueError("verification_environment must be an object")
    _keys(environment, {"working_directory", "commands", "environment", "conclusion"}, "verification_environment")
    for name, expected in ITEM_KEYS.items():
        items = source[name]
        if not isinstance(items, list) or not items:
            raise ValueError(f"{name} must be a non-empty list")
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                raise ValueError(f"{name}[{index}] must be an object")
            _keys(item, expected, f"{name}[{index}]")
    _nonempty(source, "source")

    ids: dict[str, set[str]] = {}
    for prefix, name in (
        ("UN", "user_requirements"), ("DR", "development_requirements"),
        ("DD", "design_decisions"), ("TK", "tasks"), ("VT", "verification_items"),
    ):
        values = {item["id"] for item in source[name]}
        if len(values) != len(source[name]):
            raise ValueError(f"{name} contains duplicate identifiers")
        for value in values:
            if not re.fullmatch(rf"{prefix}-{number}-\d{{2}}", value):
                raise ValueError(f"{value} must match {prefix}-{number}-NN")
        ids[prefix] = values

    def refs(values: list[str], prefix: str, where: str) -> None:
        if not isinstance(values, list) or not values:
            raise ValueError(f"{where} must be a non-empty list")
        missing = sorted(set(values) - ids[prefix])
        if missing:
            raise ValueError(f"{where} references missing {prefix}: {missing}")

    for index, item in enumerate(source["design_decisions"]):
        refs(item["dr_ids"], "DR", f"design_decisions[{index}].dr_ids")
    for index, item in enumerate(source["tasks"]):
        refs(item["dr_ids"], "DR", f"tasks[{index}].dr_ids")
        refs(item["dd_ids"], "DD", f"tasks[{index}].dd_ids")
        refs(item["verification_ids"], "VT", f"tasks[{index}].verification_ids")
    for index, item in enumerate(source["verification_items"]):
        refs(item["dr_ids"], "DR", f"verification_items[{index}].dr_ids")
    for index, item in enumerate(source["trace_current"]):
        for field, prefix in (
            ("un_id", "UN"), ("dr_id", "DR"), ("dd_id", "DD"),
            ("tk_id", "TK"), ("vt_id", "VT"),
        ):
            refs([item[field]], prefix, f"trace_current[{index}].{field}")

    decisions = {item["id"]: item for item in source["design_decisions"]}
    tasks = {item["id"]: item for item in source["tasks"]}
    verifications = {item["id"]: item for item in source["verification_items"]}
    covered = {prefix: set() for prefix in ids}
    for index, row in enumerate(source["trace_current"]):
        decision, task, verification = decisions[row["dd_id"]], tasks[row["tk_id"]], verifications[row["vt_id"]]
        for item in (decision, task, verification):
            if row["dr_id"] not in item["dr_ids"]:
                raise ValueError(f"trace_current[{index}]: {item['id']} does not declare DR {row['dr_id']}")
        if row["dd_id"] not in task["dd_ids"]:
            raise ValueError(f"trace_current[{index}]: {task['id']} does not declare DD {row['dd_id']}")
        if row["vt_id"] not in task["verification_ids"]:
            raise ValueError(f"trace_current[{index}]: {task['id']} does not declare VT {row['vt_id']}")
        for prefix in ids:
            covered[prefix].add(row[f"{prefix.lower()}_id"])
    for prefix, values in ids.items():
        missing = sorted(values - covered[prefix])
        if missing:
            raise ValueError(f"trace_current does not cover {prefix}: {missing}")


def _cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\r\n", "<br>").replace("\n", "<br>")


def _refs(values: list[str]) -> str:
    return " / ".join(values)


def _evidence_summary(value: Any) -> str:
    if not isinstance(value, dict):
        return _cell(value)
    return _cell(f"命令：{value['command']}；退出码：{value['exit_code']}；测试数量：{value['test_count']}；"
                 f"失败数量：{value['failure_count']}；跳过数量：{value['skipped_count']}；证据：{value['log_path']}")


def _evidence_columns(value: Any) -> str:
    if not isinstance(value, dict):
        return "- | - | - | - | - | -"
    return " | ".join(_cell(value[key]) for key in ("command", "exit_code", "test_count", "failure_count", "skipped_count", "log_path"))


def _bullets(values: list[str]) -> str:
    return "\n".join(f"- {item}" for item in values)


def _checks(values: list[str]) -> str:
    return "\n".join(item if item.lstrip().startswith("- [") else f"- [ ] {item}" for item in values)


def _quote(value: str) -> str:
    return "\n".join(f"> {line}" if line else ">" for line in value.splitlines())


def _header(req_id: str, label: str) -> str:
    return f"{GENERATED_NOTICE}\n# {req_id} {label}\n\n"


def render_views(source: dict[str, Any], package_name: str | None = None) -> dict[str, str]:
    validate_source(source, package_name)
    req = source["req_id"]
    meta = source["metadata"]

    un = "\n".join(
        f"| {_cell(x['id'])} | {_cell(x['status'])} | {_cell(x['goal'])} | {_cell(x['constraints'])} | {_cell(x['success_criteria'])} |"
        for x in source["user_requirements"]
    )
    dr = "\n".join(
        f"| {_cell(x['id'])} | {_cell(x['status'])} | {_cell(x['requirement'])} | {_cell(x['acceptance_criteria'])} | {_cell(x['constraints'])} |"
        for x in source["development_requirements"]
    )
    dd = "\n".join(
        f"| {_cell(x['id'])} | {_cell(_refs(x['dr_ids']))} | {_cell(x['status'])} | {_cell(x['summary'])} | {_cell(x['rationale'])} |"
        for x in source["design_decisions"]
    )
    tk = "\n".join(
        f"| {_cell(x['id'])} | {_cell(_refs(x['dr_ids'] + x['dd_ids']))} | {_cell(x['status'])} | {_cell(x['task'])} | {_cell(_refs(x['verification_ids']))} |"
        for x in source["tasks"]
    )
    vt = "\n".join(
        f"| {_cell(x['id'])} | {_cell(_refs(x['dr_ids']))} | {_cell(x['confirmation_status'])} | {_cell(x['execution_status'])} | {_cell(x['item'])} | {_cell(x['evidence_standard'])} | {_evidence_summary(x['current_evidence'])} | {_evidence_columns(x['current_evidence'])} |"
        for x in source["verification_items"]
    )
    trace = "\n".join(
        f"| {_cell(x['un_id'])} | {_cell(x['dr_id'])} | {_cell(x['dd_id'])} | {_cell(x['tk_id'])} | {_cell(x['vt_id'])} | {_cell(x['status'])} |"
        for x in source["trace_current"]
    )
    history = "\n".join(
        f"| {x['version']} | {_cell(x['link'])} | {_cell(x['status'])} | {_cell(x['notes'])} |"
        for x in source["trace_history"]
    )
    changes = "\n".join(
        f"| {_cell(x['date'])} | {x['version']} | {_cell(x['type'])} | {_cell(x['description'])} | {_cell(x['impact'])} | {_cell(x['confirmed_by'])} |"
        for x in source["changes"]
    )
    current_dd = "\n".join(
        f"| {_cell(x['id'])} | {_cell(_refs(x['dr_ids']))} | {_cell(x['status'])} | {_cell(x['summary'])} |"
        for x in source["design_decisions"]
    )
    current_tk = "\n".join(
        f"| {_cell(x['id'])} | {_cell(_refs(x['dr_ids'] + x['dd_ids']))} | {_cell(x['status'])} | {_cell(x['task'])} |"
        for x in source["tasks"]
    )
    current_vt = "\n".join(
        f"| {_cell(x['id'])} | {_cell(_refs(x['dr_ids']))} | {_cell(x['execution_status'])} | {_cell(x['item'])} | {_evidence_summary(x['current_evidence'])} |"
        for x in source["verification_items"]
    )

    views = {}
    views["00_user_requirement.md"] = (
        _header(req, "用户需求") + "## 原始输入\n\n" + _quote(source["original_input"])
        + "\n\n## 结构化理解\n\n| UN | 状态 | 目标 | 约束 | 成功标准 |\n|---|---|---|---|---|\n" + un
        + "\n\n## 已确认事实\n\n" + _bullets(source["confirmed_facts"])
        + "\n\n## 推断与待确认\n\n" + _bullets(source["inferences_and_open_questions"]) + "\n"
    )
    views["01_development_requirement.md"] = (
        _header(req, "开发需求") + f"## Schema\n\n- schema: {PACKAGE_SCHEMA}\n\n## 开发需求\n\n"
        + "| DR | 状态 | 开发需求 | 验收标准 | 约束 |\n|---|---|---|---|---|\n" + dr
        + "\n\n只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。\n"
    )
    views["02_design.md"] = (
        _header(req, "设计") + "## 设计标识\n\n| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |\n|---|---|---|---|---|\n" + dd
        + "\n\n## 接口与数据流\n\n" + _bullets(source["interfaces_and_data_flow"])
        + "\n\n## 模块文档影响\n\n" + _bullets(source["module_document_impact"])
        + "\n\n## 风险与回滚\n\n" + _bullets(source["risks_and_rollback"]) + "\n"
    )
    views["03_tasks.md"] = (
        _header(req, "任务") + "| TK | 关联 DR/DD | 状态 | 任务 | 验证入口 |\n|---|---|---|---|---|\n" + tk
        + "\n\n任务状态必须反映真实进度；需求未确认时不得标记为已完成。\n"
    )
    env = source["verification_environment"]
    views["04_verification.md"] = (
        _header(req, "验证") + f"## Schema\n\n- schema: {PACKAGE_SCHEMA}\n\n## 验证项\n\n"
        + "| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n" + vt
        + "\n\n## 本轮命令与环境\n\n- 工作目录：" + env["working_directory"]
        + "\n" + _bullets([f"命令：{x}" for x in env["commands"]])
        + "\n" + _bullets([f"环境：{x}" for x in env["environment"]])
        + "\n\n## 结论\n\n" + _bullets(env["conclusion"]) + "\n"
    )
    views["05_trace.md"] = (
        _header(req, "追踪") + "## 当前有效链路\n\n| UN | DR | DD | TK | VT | 状态 |\n|---|---|---|---|---|---|\n" + trace
        + "\n\n## 历史链路\n\n| 版本 | 链路 | 状态 | 说明 |\n|---:|---|---|---|\n" + history + "\n"
    )
    views["current_state.md"] = (
        _header(req, "当前状态") + f"- 需求标题：{source['title']}\n\n## 元数据\n\n"
        + f"- 需求状态：{meta['requirement_status']}\n- 治理分级：{meta['governance_level']}\n"
        + f"- 当前版本：{meta['version']}\n- 最后更新：{meta['last_updated']}\n\n"
        + "## 当前有效用户需求\n\n| UN | 状态 | 内容 |\n|---|---|---|\n"
        + "\n".join(f"| {_cell(x['id'])} | {_cell(x['status'])} | {_cell(x['goal'])} |" for x in source["user_requirements"])
        + "\n\n## 当前有效开发需求\n\n| DR | 状态 | 内容 |\n|---|---|---|\n"
        + "\n".join(f"| {_cell(x['id'])} | {_cell(x['status'])} | {_cell(x['requirement'])} |" for x in source["development_requirements"])
        + "\n\n## 当前有效设计\n\n| DD | DR | 状态 | 内容 |\n|---|---|---|---|\n" + current_dd
        + "\n\n## 当前有效任务\n\n| TK | DR/DD | 状态 | 内容 |\n|---|---|---|---|\n" + current_tk
        + "\n\n## 当前有效验证项\n\n| VT | DR | 状态 | 内容 | 当前证据 |\n|---|---|---|---|---|\n" + current_vt
        + "\n\n## 人工待确认项\n\n" + _checks(source["open_questions"])
        + "\n\n## 本轮禁止实现内容\n\n" + _bullets(source["prohibited_implementation"]) + "\n"
    )
    views["change_log.md"] = (
        _header(req, "变更记录") + "| 日期 | 版本 | 类型 | 变更内容 | 影响 | 确认人 |\n|---|---:|---|---|---|---|\n"
        + changes + "\n\n历史记录只保留在本文件；已撤销或已替换内容不得继续出现在当前任务、验证和当前 trace 中。\n"
    )
    return {name: views[name] for name in GENERATED_FILES}


def load_source(req_dir: Path) -> dict[str, Any]:
    path = req_dir / SOURCE_FILE
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"canonical source is missing or unsafe: {path}")
    try:
        source = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in {SOURCE_FILE}: {exc}") from exc
    validate_source(source, req_dir.name)
    return source


def _atomic_write(path: Path, text: str) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(text, encoding="utf-8", newline="\n")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def render_package(req_dir: Path, apply: bool = True) -> dict[str, str]:
    views = render_views(load_source(req_dir), req_dir.name)
    if apply:
        for name, text in views.items():
            _atomic_write(req_dir / name, text)
    return views


def check_generated_views(req_dir: Path) -> list[str]:
    expected = render_package(req_dir, apply=False)
    problems = []
    for name, text in expected.items():
        path = req_dir / name
        if path.is_symlink() or not path.is_file():
            problems.append(f"{name}: missing or unsafe generated view")
            continue
        try:
            actual = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            problems.append(f"{name}: cannot read as UTF-8 ({exc})")
            continue
        if actual != text:
            problems.append(f"{name}: differs from {SOURCE_FILE}")
    return problems


def audit_legacy_package(req_dir: Path) -> LegacyAudit:
    views = {}
    byte_count = 0
    digest = hashlib.sha256()
    identifiers = set()
    for name in GENERATED_FILES:
        path = req_dir / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"{req_dir.name}/{name}: missing or unsafe")
        raw = path.read_bytes()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError(f"{req_dir.name}/{name}: not UTF-8 ({exc})") from exc
        views[name] = text
        byte_count += len(raw)
        digest.update(name.encode("utf-8") + b"\0" + raw + b"\0")
        identifiers.update(re.findall(r"\b(?:UN|DR|DD|TK|VT)-(?:REQ-)?\d{4}-\d{2}\b", text))
    preserved = {"schema": "ai-engineering-context/legacy-preserved-v1", "package": req_dir.name, "views": views}
    restored = json.loads(json.dumps(preserved, ensure_ascii=False))["views"]
    for name, text in restored.items():
        if text.encode("utf-8") != (req_dir / name).read_bytes():
            raise ValueError(f"{req_dir.name}/{name}: byte round-trip mismatch")
    return LegacyAudit(req_dir.name, len(views), byte_count, digest.hexdigest(), len(identifiers))


def package_dir(root: Path, package: str) -> Path:
    if not REQ_NAME.fullmatch(package):
        raise ValueError("package must be a REQ-NNNN-slug directory name")
    path = root / "docs" / "requirements" / package
    if path.is_symlink() or not path.is_dir():
        raise ValueError(f"requirement package is missing or unsafe: {package}")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("render", "check", "audit-legacy"))
    parser.add_argument("--root", default=".")
    parser.add_argument("--package")
    parser.add_argument("--all-legacy", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    try:
        if args.mode in {"render", "check"}:
            if not args.package:
                raise ValueError("--package is required")
            req_dir = package_dir(root, args.package)
            if args.mode == "render":
                render_package(req_dir)
                print(f"REQ_SOURCE_RENDERED: {req_dir.name}; generated_views={len(GENERATED_FILES)}")
            else:
                problems = check_generated_views(req_dir)
                if problems:
                    raise ValueError("; ".join(problems))
                print(f"REQ_SOURCE_IN_SYNC: {req_dir.name}; generated_views={len(GENERATED_FILES)}")
            return 0
        if args.all_legacy == bool(args.package):
            raise ValueError("choose exactly one of --package or --all-legacy")
        requirements = root / "docs" / "requirements"
        packages = (
            [path for path in sorted(requirements.iterdir()) if path.is_dir() and REQ_NAME.fullmatch(path.name)]
            if args.all_legacy else [package_dir(root, args.package)]
        )
        audits = [audit_legacy_package(path) for path in packages]
        digest = hashlib.sha256("".join(item.sha256 for item in audits).encode("ascii")).hexdigest()
        print(
            "LEGACY_AUDIT_OK: "
            f"packages={len(audits)}; views={sum(x.views for x in audits)}; "
            f"bytes={sum(x.byte_count for x in audits)}; identifiers={sum(x.identifiers for x in audits)}; "
            f"sha256={digest}; no files written"
        )
        return 0
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"REQ_SOURCE_BLOCKED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
