#!/usr/bin/env python3
"""Suggest or apply conservative status synchronization for one REQ or FIX."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from ai_context_change_records import (
        SCHEMA_API_VERSION,
        ChangeRecord,
        changed_fix_records,
        changed_paths,
        changed_requirement_dirs,
        is_code_or_test_change,
        parse_fix_document,
        resolve_fix,
        resolve_req,
    )
except (ImportError, AttributeError) as exc:
    print(
        "ERROR: AI context scripts are partially upgraded. Re-run migrate_context.py so the shared helper and all three entry scripts are updated together. "
        f"({exc})",
        file=sys.stderr,
    )
    raise SystemExit(2)

if SCHEMA_API_VERSION != 1:
    print("ERROR: Unsupported AI context change-record helper version; re-run migrate_context.py.", file=sys.stderr)
    raise SystemExit(2)


DEFAULT_IMPLEMENTED_STATUS = "已实现，验证未运行"
VERIFIED_STATES = {"单元测试通过", "集成测试通过"}
PARTIAL_VERIFIED_STATES = {"编译通过", "仅静态检查"}
BLOCKED_VERIFICATION_STATES = {"无法运行", "人工待确认"}
VERIFICATION_STATE_HEADERS = {"状态", "验证状态", "执行状态"}


@dataclass
class Change:
    path: Path
    description: str
    before: str
    after: str


def read_text(path: Path) -> str:
    # Governance files are UTF-8 contracts.  Replacement decoding could turn
    # invalid bytes into U+FFFD and then permanently rewrite/corrupt the file
    # during --apply, so malformed input must fail closed.
    return path.read_text(encoding="utf-8-sig")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def split_table_row(line: str) -> list[str] | None:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return None
    return [cell.strip() for cell in stripped.strip("|").split("|")]


def is_table_separator(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def extract_verification_states(req_dir: Path) -> set[str]:
    path = req_dir / "04_verification.md"
    if not path.exists():
        return set()
    rows = [row for line in read_text(path).splitlines() if (row := split_table_row(line))]
    if not rows:
        return set()
    header = rows[0]
    state_indexes = [idx for idx, cell in enumerate(header) if cell in VERIFICATION_STATE_HEADERS]
    states: set[str] = set()
    for row in rows[1:]:
        if is_table_separator(row):
            continue
        for idx in state_indexes:
            if idx < len(row) and row[idx].strip():
                states.add(row[idx].strip())
    return states


def target_status_from_states(states: set[str]) -> str:
    useful = states - {"未运行", "待补充", ""}
    if useful and useful <= VERIFIED_STATES:
        return "已实现，验证已记录"
    if useful & VERIFIED_STATES or useful & PARTIAL_VERIFIED_STATES:
        return "已实现，部分验证"
    if useful & BLOCKED_VERIFICATION_STATES:
        return "已实现，验证受阻"
    return DEFAULT_IMPLEMENTED_STATUS


def sync_req(record: ChangeRecord, apply: bool) -> list[Change]:
    # Verification results do not establish that any particular task was
    # implemented. JSON packages derive all views from explicit source states;
    # legacy packages require task-by-task updates by the implementing agent.
    source_path = record.path / "requirement.source.json"
    if not source_path.exists() and not source_path.is_symlink():
        for name in ("04_verification.md", "03_tasks.md", "05_trace.md"):
            path = record.path / name
            if path.exists():
                read_text(path)
        return []
    try:
        from requirement_source import render_package
    except ImportError as exc:
        raise ValueError("Source-backed REQ requires requirement_source.py; upgrade the formal components.") from exc
    views = render_package(record.path, apply=False)
    changes: list[Change] = []
    pending_writes: list[tuple[Path, str]] = []
    for name, updated in views.items():
        path = record.path / name
        if path.is_symlink() or (path.exists() and not path.is_file()):
            raise ValueError(f"Unsafe generated view: {path}")
        before = read_text(path) if path.exists() else None
        if before != updated:
            changes.append(Change(path, "source-derived view", "missing or differs from source", "rendered from explicit source values"))
            pending_writes.append((path, updated))
    # Read and parse every candidate before the first write.  One non-UTF-8 or
    # unreadable REQ file therefore leaves the entire synchronization unchanged.
    if apply:
        for path, updated in pending_writes:
            write_text(path, updated)
    return changes


def replace_fix_implementation_state(text: str, target_status: str) -> tuple[str, Change | None]:
    pattern = re.compile(
        r"^(\s*[-*+]\s*(?:\*\*)?实现状态(?:\*\*)?\s*[:：]\s*)(.*?)\s*$",
        flags=re.MULTILINE,
    )
    match = pattern.search(text)
    if not match:
        return text, None
    before = match.group(0)
    current = match.group(2).replace("`", "").strip()
    if current in {target_status, "已升级"}:
        return text, None
    allowed_sources = {
        "已实现",
        "已实现，验证未运行",
        "已实现，部分验证",
        "已实现，验证受阻",
        "已实现，验证已记录",
    }
    if current not in allowed_sources:
        return text, None
    after = f"{match.group(1)}{target_status}"
    updated = text[:match.start()] + after + text[match.end():]
    return updated, Change(Path(), "FIX implementation status", before, after)


def sync_fix(record: ChangeRecord, apply: bool) -> list[Change]:
    document = parse_fix_document(record.path)
    verification_state = document.metadata.get("验证状态", "未运行")
    target_status = target_status_from_states({verification_state})
    updated, change = replace_fix_implementation_state(document.text, target_status)
    if change is None:
        return []
    change.path = record.path
    if apply:
        write_text(record.path, updated)
    return [change]


def infer_records(root: Path, req_ids: list[str], fix_ids: list[str]) -> tuple[list[ChangeRecord], list[str], bool]:
    messages: list[str] = []
    records: list[ChangeRecord] = []
    if req_ids or fix_ids:
        for identifier in req_ids:
            path = resolve_req(root, identifier)
            if path is None:
                messages.append(f"Invalid, legacy, template, missing, or out-of-root REQ: {identifier}")
            else:
                records.append(ChangeRecord("REQ", path.name, path))
        for identifier in fix_ids:
            path = resolve_fix(root, identifier)
            if path is None:
                messages.append(f"Invalid, missing, or out-of-root FIX: {identifier}")
            else:
                records.append(ChangeRecord("FIX", path.stem, path))
        return records, messages, bool(messages)

    paths = changed_paths(root)
    if paths is None:
        return [], ["Git status is unavailable; pass exactly one --req or --fix selector."], True
    records.extend(ChangeRecord("REQ", path.name, path) for path in changed_requirement_dirs(root, paths))
    records.extend(ChangeRecord("FIX", path.stem, path) for path in changed_fix_records(root, paths))
    code_changes = [path for path in paths if is_code_or_test_change(path)]
    if code_changes and not records:
        return [], ["Code/test/config changed but no changed real REQ or FIX record was found."], True
    if not records:
        return [], ["No changed code/test/config or changed governance record found."], False
    return records, messages, False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render REQ views from explicit source states or refine an already implemented FIX.")
    parser.add_argument("--root", default=".", help="Project root. Defaults to the current directory.")
    parser.add_argument("--apply", action="store_true", help="Write source-derived REQ views or supported FIX status refinements.")
    selectors = parser.add_mutually_exclusive_group()
    selectors.add_argument("--req", action="append", default=[], help="Explicit real REQ package name.")
    selectors.add_argument("--fix", action="append", default=[], help="Explicit FIX record ID.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"Project root does not exist or is not a directory: {root}", file=sys.stderr)
        return 2

    records, messages, is_error = infer_records(root, args.req, args.fix)
    for message in messages:
        print(("ERROR" if is_error else "WARN") + f": {message}")
    if is_error:
        return 2
    if not records:
        return 0
    if len(records) != 1:
        print("ERROR: Status synchronization requires exactly one changed or explicitly selected record.", file=sys.stderr)
        return 2

    record = records[0]
    try:
        changes = sync_req(record, args.apply) if record.kind == "REQ" else sync_fix(record, args.apply)
    except UnicodeDecodeError as exc:
        print(
            f"ERROR: a governance file under {record.path} is not valid UTF-8 ({exc.reason}); "
            "status synchronization failed closed and made no changes.",
            file=sys.stderr,
        )
        return 2
    except OSError as exc:
        print(
            f"ERROR: could not safely read or write {exc.filename or record.path}: {exc}; status synchronization did not complete.",
            file=sys.stderr,
        )
        return 2
    except ValueError as exc:
        print(f"ERROR: {exc}; source validation failed before synchronization.", file=sys.stderr)
        return 2
    action = "APPLIED" if args.apply else "DRY-RUN"
    if not changes:
        print(f"{action}: no derived changes for {record.identifier}; explicit implementation states retained, never inferred from verification.")
        return 0
    print(f"{action}: {len(changes)} status update(s) for {record.identifier}.")
    for change in changes:
        try:
            display_path = change.path.relative_to(root)
        except ValueError:
            display_path = change.path
        print(f"- {display_path}")
        print(f"  before: {change.before}")
        print(f"  after : {change.after}")
    if not args.apply:
        print("\nRe-run with --apply to write these mechanical status updates, then review the result.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
