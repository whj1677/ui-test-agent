#!/usr/bin/env python3
"""Collect current-round delivery evidence for one REQ or G1 Quick Fix record."""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

try:
    from ai_context_change_records import (
        EVIDENCE_END,
        EVIDENCE_START,
        SCHEMA_API_VERSION,
        ChangeRecord,
        changed_fix_records,
        changed_paths,
        changed_requirement_dirs,
        code_change_fingerprint,
        git_changes,
        parse_fix_document,
        replace_managed_block,
        resolve_fix,
        resolve_req,
        run_git_status,
        safe_project_path,
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


def run_cmd(root: Path, cmd: list[str], timeout: int = 60) -> tuple[int, str]:
    env = os.environ.copy()
    env.setdefault("PYTHONUTF8", "1")
    try:
        result = subprocess.run(
            cmd,
            cwd=str(root),
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            env=env,
        )
    except (FileNotFoundError, subprocess.SubprocessError) as exc:
        return 127, str(exc)
    return result.returncode, result.stdout


@dataclass(frozen=True)
class VerificationRun:
    command: str
    exit_code: int
    output: str
    test_count: int | None
    failure_count: int | None
    skipped_count: int | None
    started_at: str


def parse_test_statistics(output: str, exit_code: int) -> tuple[int | None, int | None, int | None]:
    """Parse common test-runner summaries; never use caller-supplied counts as facts."""

    # Python unittest: "Ran N tests" plus optional FAILED/OK counters.
    unittest_runs = re.findall(r"\bRan\s+(\d+)\s+tests?\b", output, flags=re.IGNORECASE)
    if unittest_runs:
        total = int(unittest_runs[-1])
        failed = 0 if exit_code == 0 else None
        skipped = 0
        summary = re.findall(r"(?:FAILED|OK)\s*\(([^)]*)\)", output, flags=re.IGNORECASE)
        if summary:
            counters = {
                key.lower(): int(value)
                for key, value in re.findall(r"([A-Za-z_]+)\s*=\s*(\d+)", summary[-1])
            }
            skipped = counters.get("skipped", 0)
            if exit_code != 0:
                failed = counters.get("failures", 0) + counters.get("errors", 0)
        return total, failed, skipped

    # Node.js built-in test runner TAP summary:
    # "# tests N", "# pass N", "# fail N", and "# skipped N".
    if re.search(r"^\s*TAP\s+version\s+\d+\s*$", output, flags=re.IGNORECASE | re.MULTILINE):
        node_tap_counts: dict[str, int] = {}
        for label, value in re.findall(
            r"^\s*#\s+(tests|pass|fail|skipped)\s+(\d+)\s*$",
            output,
            flags=re.IGNORECASE | re.MULTILINE,
        ):
            node_tap_counts[label.lower()] = int(value)
        required = {"tests", "pass", "fail", "skipped"}
        if required.issubset(node_tap_counts):
            total = node_tap_counts["tests"]
            passed = node_tap_counts["pass"]
            failed = node_tap_counts["fail"]
            skipped = node_tap_counts["skipped"]
            if passed + failed + skipped <= total:
                return total, failed, skipped

    # Maven Surefire/Failsafe.
    maven = re.findall(
        r"Tests run:\s*(\d+)\s*,\s*Failures:\s*(\d+)\s*,\s*Errors:\s*(\d+)\s*,\s*Skipped:\s*(\d+)",
        output,
        flags=re.IGNORECASE,
    )
    if maven:
        total, failures, errors, skipped = (int(value) for value in maven[-1])
        return total, failures + errors, skipped

    # Jest reports an explicit total.
    jest = re.findall(r"Tests:\s*(.*)$", output, flags=re.IGNORECASE | re.MULTILINE)
    for summary in reversed(jest):
        total_match = re.search(r"(\d+)\s+total", summary, flags=re.IGNORECASE)
        if total_match:
            failed_match = re.search(r"(\d+)\s+failed", summary, flags=re.IGNORECASE)
            skipped_match = re.search(r"(\d+)\s+(?:skipped|pending|todo)", summary, flags=re.IGNORECASE)
            return (
                int(total_match.group(1)),
                int(failed_match.group(1)) if failed_match else 0,
                int(skipped_match.group(1)) if skipped_match else 0,
            )

    # Rust libtest.
    rust = re.findall(
        r"test result:\s*\w+\.\s*(\d+)\s+passed;\s*(\d+)\s+failed;\s*(\d+)\s+ignored",
        output,
        flags=re.IGNORECASE,
    )
    if rust:
        passed, failed, ignored = (int(value) for value in rust[-1])
        return passed + failed + ignored, failed, ignored

    # pytest terminal summaries such as "4 passed, 1 skipped" or "1 failed, 3 passed".
    pytest_counts: dict[str, int] = {}
    for value, label in re.findall(
        r"(?<![.\d])(\d+)\s+(passed|failed|errors?|skipped|xfailed|xpassed)(?![\w-])",
        output,
        flags=re.IGNORECASE,
    ):
        pytest_counts[label.lower()] = int(value)
    if pytest_counts and any(label in pytest_counts for label in ("passed", "failed", "error", "errors")):
        failures = pytest_counts.get("failed", 0) + pytest_counts.get("error", 0) + pytest_counts.get("errors", 0)
        skipped = pytest_counts.get("skipped", 0) + pytest_counts.get("xfailed", 0)
        total = sum(
            pytest_counts.get(label, 0)
            for label in ("passed", "failed", "error", "errors", "skipped", "xfailed", "xpassed")
        )
        return total, failures, skipped

    return None, 0 if exit_code == 0 else None, None


def run_verification(root: Path, command: str, timeout: int) -> VerificationRun:
    env = os.environ.copy()
    env.setdefault("PYTHONUTF8", "1")
    started_at = _dt.datetime.now().astimezone().isoformat(timespec="seconds")
    try:
        result = subprocess.run(
            command,
            cwd=str(root),
            shell=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            env=env,
        )
        exit_code, output = result.returncode, result.stdout
    except subprocess.TimeoutExpired as exc:
        exit_code = 124
        captured = exc.stdout or ""
        if isinstance(captured, bytes):
            captured = captured.decode("utf-8", errors="replace")
        output = f"{captured}\nVerification command timed out after {timeout} seconds.\n"
    except (OSError, subprocess.SubprocessError) as exc:
        exit_code, output = 127, str(exc)
    test_count, failure_count, skipped_count = parse_test_statistics(output, exit_code)
    return VerificationRun(
        command=command,
        exit_code=exit_code,
        output=output,
        test_count=test_count,
        failure_count=failure_count,
        skipped_count=skipped_count,
        started_at=started_at,
    )


def atomic_write_project_text(root: Path, path: Path, text: str) -> Path:
    """Atomically replace a project-local regular file without following symlinks."""

    target = safe_project_path(root, path, allow_missing=True)
    if target is None:
        raise ValueError(f"unsafe or symlinked project path: {path}")
    parent = safe_project_path(root, target.parent, allow_missing=True)
    if parent is None:
        raise ValueError(f"unsafe or symlinked parent path: {target.parent}")
    parent.mkdir(parents=True, exist_ok=True)
    parent = safe_project_path(root, parent, allow_missing=False)
    if parent is None or not parent.is_dir():
        raise ValueError(f"log/evidence parent is not a safe project directory: {target.parent}")
    if target.exists() and (target.is_symlink() or not target.is_file()):
        raise ValueError(f"refusing to replace non-regular or symlinked path: {target}")

    fd, temp_name = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=str(parent))
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, target)
    except BaseException:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise
    return target


def git_status(root: Path) -> list[str]:
    return run_git_status(root) or []


def git_diff_stat(root: Path) -> str:
    head_code, _ = run_cmd(root, ["git", "rev-parse", "--verify", "HEAD"])
    if head_code != 0:
        return "Repository has no commits; tracked diff is unavailable. Review the untracked-files section.\n"
    _, output = run_cmd(root, ["git", "diff", "--stat", "HEAD"])
    return output


def choose_records(
    root: Path,
    explicit_reqs: list[str],
    explicit_fixes: list[str],
) -> tuple[list[ChangeRecord], list[str]]:
    errors: list[str] = []
    records: list[ChangeRecord] = []
    if explicit_reqs or explicit_fixes:
        for identifier in explicit_reqs:
            path = resolve_req(root, identifier)
            if path is None:
                errors.append(f"Invalid, legacy, template, missing, or out-of-root REQ: {identifier}")
            else:
                records.append(ChangeRecord("REQ", path.name, path))
        for identifier in explicit_fixes:
            path = resolve_fix(root, identifier)
            if path is None:
                errors.append(f"Invalid, missing, or out-of-root FIX: {identifier}")
            else:
                records.append(ChangeRecord("FIX", path.stem, path))
        return records, errors

    paths = changed_paths(root)
    if paths is None:
        return [], ["Git status is unavailable; pass exactly one --req or --fix selector."]
    req_dirs = changed_requirement_dirs(root, paths)
    fix_files = changed_fix_records(root, paths)
    records.extend(ChangeRecord("REQ", path.name, path) for path in req_dirs)
    records.extend(ChangeRecord("FIX", path.stem, path) for path in fix_files)
    if not records:
        errors.append("No changed real REQ or FIX record found; historical records are not selected implicitly.")
    return records, errors


def safe_log_path(root: Path, rel: str, *, allow_missing: bool = False) -> Path | None:
    if not rel:
        return None
    candidate = Path(rel)
    if candidate.is_absolute():
        return None
    if candidate.suffix.lower() not in {".log", ".txt"}:
        return None
    resolved = safe_project_path(root, candidate, require_file=not allow_missing, allow_missing=allow_missing)
    if resolved is None:
        return None
    if resolved.exists() and (resolved.is_symlink() or not resolved.is_file()):
        return None
    return resolved


def read_optional(path: Path | None, max_chars: int = 20000) -> str:
    if path is None:
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    if len(text) > max_chars:
        return text[:max_chars] + "\n... truncated ...\n"
    return text


def untracked_files(root: Path) -> list[str]:
    changes = git_changes(root) or []
    return [change.path for change in changes if change.status == "??"]


def selector_args(record: ChangeRecord) -> list[str]:
    return ["--req", record.identifier] if record.kind == "REQ" else ["--fix", record.identifier]


def render_evidence(
    root: Path,
    record: ChangeRecord,
    verify_state: str,
    verify_command: str,
    verify_exit_code: str,
    test_count: str,
    failure_count: str,
    skipped_count: str,
    verify_log: str,
    verify_log_sha256: str,
    verification_source: str,
    verify_log_text: str,
    notes: str,
    sync_out: str,
    check_code: int,
    check_out: str,
) -> str:
    now = _dt.datetime.now().astimezone().isoformat(timespec="seconds")
    status = "\n".join(git_status(root)) or "(clean)"
    diff_stat = git_diff_stat(root).strip() or "(no tracked diff)"
    untracked = "\n".join(untracked_files(root)) or "(none)"
    return "\n".join(
        [
            "## Delivery Evidence (managed)",
            "",
            f"- Generated at: `{now}`",
            f"- Record: `{record.identifier}`",
            f"- Change fingerprint: `{code_change_fingerprint(root)}`",
            f"- Verification source: `{verification_source or '未记录'}`",
            f"- Verification state: `{verify_state or '未记录'}`",
            f"- Command: `{verify_command or '未记录'}`",
            f"- Exit code: `{verify_exit_code or '未记录'}`",
            f"- Test count: `{test_count or '未记录'}`",
            f"- Failure count: `{failure_count or '未记录'}`",
            f"- Skipped count: `{skipped_count or '未记录'}`",
            f"- Log path: `{verify_log or '未记录'}`",
            f"- Log SHA-256: `{verify_log_sha256 or '未记录'}`",
            "",
            "### Git Status",
            "",
            "```text",
            status,
            "```",
            "",
            "### Git Diff Stat",
            "",
            "```text",
            diff_stat,
            "```",
            "",
            "### Untracked Files",
            "",
            "```text",
            untracked,
            "```",
            "",
            "### Verification Log Excerpt",
            "",
            "```text",
            verify_log_text.strip() or "(not provided)",
            "```",
            "",
            "### Sync Record Status",
            "",
            "```text",
            sync_out.strip() or "(no output)",
            "```",
            "",
            "### Check AI Context",
            "",
            f"- Exit code: `{check_code}`",
            "",
            "```text",
            check_out.strip() or "(no output)",
            "```",
            "",
            "### Notes",
            "",
            notes or "无",
        ]
    )


def write_record_evidence(root: Path, record: ChangeRecord, body: str) -> Path:
    if record.kind == "REQ":
        path = record.path / "delivery_evidence.md"
        return atomic_write_project_text(root, path, f"# Delivery Evidence\n\n{body}\n")

    document = parse_fix_document(record.path)
    updated = replace_managed_block(document.text, EVIDENCE_START, EVIDENCE_END, body)
    return atomic_write_project_text(root, record.path, updated)


def update_fix_metadata(root: Path, record: ChangeRecord, verify_state: str) -> None:
    text = record.path.read_text(encoding="utf-8-sig")
    replacements = {
        "实现状态": "已实现，验证已记录",
        "验证状态": verify_state,
    }
    for key, value in replacements.items():
        pattern = re.compile(
            rf"^(\s*[-*+]\s*(?:\*\*)?{re.escape(key)}(?:\*\*)?\s*[:：]\s*)(`?).*?(`?)\s*$",
            flags=re.MULTILINE,
        )
        match = pattern.search(text)
        if not match:
            raise ValueError(f"FIX metadata field is missing: {key}")
        quote = "`" if match.group(2) or match.group(3) else ""
        replacement = f"{match.group(1)}{quote}{value}{quote}"
        text = text[:match.start()] + replacement + text[match.end():]
    atomic_write_project_text(root, record.path, text)


def collect_one(root: Path, record: ChangeRecord, args: argparse.Namespace, verify_log_path: Path | None) -> tuple[Path, int]:
    if record.kind == "FIX":
        update_fix_metadata(root, record, args.verify_state)
    verify_log_text = read_optional(verify_log_path)
    _, sync_out = run_cmd(
        root,
        [sys.executable, "scripts/sync_requirement_status.py", *selector_args(record)],
        timeout=120,
    )
    values = (
        root, record, args.verify_state, args.verify_command, args.verify_exit_code,
        args.test_count, args.failure_count, args.skipped_count, args.verify_log,
        args.verify_log_sha256, args.verification_source,
        verify_log_text, args.notes, sync_out,
    )
    initial_body = render_evidence(*values, 0, "(check runs after the initial evidence write)")
    path = write_record_evidence(root, record, initial_body)
    check_code, check_out = run_cmd(root, [sys.executable, "scripts/check_ai_context.py"], timeout=120)
    final_body = render_evidence(*values, check_code, check_out)
    path = write_record_evidence(root, record, final_body)
    return path, check_code


def verification_log_text(run: VerificationRun) -> str:
    return "\n".join(
        [
            "ai-engineering-context verification-log-v1",
            f"Started at: {run.started_at}",
            f"Command: {run.command}",
            f"Exit code: {run.exit_code}",
            f"Parsed test count: {run.test_count if run.test_count is not None else 'unavailable'}",
            f"Parsed failure count: {run.failure_count if run.failure_count is not None else 'unavailable'}",
            f"Parsed skipped count: {run.skipped_count if run.skipped_count is not None else 'unavailable'}",
            "",
            "--- command output ---",
            run.output.rstrip(),
            "",
        ]
    )


def _assert_optional_claim(name: str, claimed: str, actual: int | None) -> str | None:
    if claimed == "":
        return None
    try:
        claimed_value = int(claimed)
    except ValueError:
        return f"{name} must be an integer when supplied."
    if actual is None:
        return f"{name} cannot be verified from the collector-executed command output."
    if claimed_value != actual:
        return f"{name} claimed {claimed_value}, but the collector-executed command produced {actual}."
    return None


def prepare_verification(
    root: Path,
    record: ChangeRecord,
    args: argparse.Namespace,
) -> tuple[Path | None, list[str]]:
    """Execute verification and replace CLI claims with collector-observed facts."""

    errors: list[str] = []
    args.verification_source = "未记录"
    args.verify_log_sha256 = ""

    if not args.verify_command:
        supplied_claims = {
            "--verify-exit-code": args.verify_exit_code,
            "--test-count": args.test_count,
            "--failure-count": args.failure_count,
            "--skipped-count": args.skipped_count,
        }
        claimed = [name for name, value in supplied_claims.items() if value != ""]
        if claimed:
            errors.append(
                "Verification metrics are not trusted without a collector-executed --verify-command: "
                + ", ".join(claimed)
            )
        if args.verify_state in {"单元测试通过", "集成测试通过"}:
            errors.append("A pass state requires --verify-command so the collector can execute and observe the test run.")
        log_path = safe_log_path(root, args.verify_log) if args.verify_log else None
        if args.verify_log and log_path is None:
            errors.append("--verify-log must name an existing regular .log/.txt file inside the project root without symlinks.")
        if log_path is not None:
            args.verification_source = "external-log-untrusted"
            args.verify_log_sha256 = hashlib.sha256(log_path.read_bytes()).hexdigest()
        return log_path, errors

    if "\n" in args.verify_command or "\r" in args.verify_command:
        return None, ["--verify-command must be a single-line command."]

    requested_log = args.verify_log or f"artifacts/ai-context-verification-{record.identifier}.log"
    log_path = safe_log_path(root, requested_log, allow_missing=True)
    if log_path is None:
        return None, [
            "--verify-log must be a project-local regular .log/.txt destination without symlink components."
        ]

    claimed_values = {
        "--verify-exit-code": args.verify_exit_code,
        "--test-count": args.test_count,
        "--failure-count": args.failure_count,
        "--skipped-count": args.skipped_count,
    }
    run = run_verification(root, args.verify_command, args.verify_timeout)
    managed_log = verification_log_text(run)
    log_path = atomic_write_project_text(root, log_path, managed_log)
    log_sha256 = hashlib.sha256(log_path.read_bytes()).hexdigest()

    actual_values = {
        "--verify-exit-code": run.exit_code,
        "--test-count": run.test_count,
        "--failure-count": run.failure_count,
        "--skipped-count": run.skipped_count,
    }
    for name, claimed in claimed_values.items():
        error = _assert_optional_claim(name, claimed, actual_values[name])
        if error:
            errors.append(error)

    args.verify_exit_code = str(run.exit_code)
    args.test_count = str(run.test_count) if run.test_count is not None else "未解析"
    args.failure_count = str(run.failure_count) if run.failure_count is not None else "未解析"
    args.skipped_count = str(run.skipped_count) if run.skipped_count is not None else "未解析"
    args.verify_log = log_path.relative_to(root).as_posix()
    args.verify_log_sha256 = log_sha256
    args.verification_source = "collector-executed-v1"

    if args.verify_state in {"单元测试通过", "集成测试通过"}:
        if run.exit_code != 0:
            errors.append(f"Pass state rejected because collector-executed verification exited {run.exit_code}.")
        if run.test_count is None or run.test_count <= 0:
            errors.append("Pass state rejected because a positive test count was not parsed from command output.")
        if run.failure_count != 0:
            errors.append(
                "Pass state rejected because collector-executed verification did not report zero failures."
            )
        if run.skipped_count is None or run.skipped_count < 0:
            errors.append("Pass state rejected because skipped-test count was not parsed from command output.")
    return log_path, errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect delivery evidence for one changed REQ or G1 Quick Fix.")
    parser.add_argument("--root", default=".", help="Project root. Defaults to current directory.")
    selectors = parser.add_mutually_exclusive_group()
    selectors.add_argument("--req", action="append", default=[], help="Real REQ package name.")
    selectors.add_argument("--fix", action="append", default=[], help="FIX record ID.")
    parser.add_argument("--verify-state", default="", help="Actual verification state, such as 单元测试通过.")
    parser.add_argument("--verify-command", default="", help="Verification command for the collector to execute now.")
    parser.add_argument("--verify-exit-code", default="", help="Optional expected exit code; checked against the actual run.")
    parser.add_argument("--test-count", default="", help="Optional expected test count; checked against parsed output.")
    parser.add_argument("--failure-count", default="", help="Optional expected failure count; checked against parsed output.")
    parser.add_argument("--skipped-count", default="", help="Optional expected skipped count; checked against parsed output.")
    parser.add_argument("--verify-log", default="", help="Project-local .log/.txt destination overwritten with this run's output.")
    parser.add_argument("--verify-timeout", type=int, default=300, help="Verification command timeout in seconds.")
    parser.add_argument("--notes", default="", help="Additional evidence notes.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"Project root does not exist or is not a directory: {root}", file=sys.stderr)
        return 2

    records, errors = choose_records(root, args.req, args.fix)
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if errors:
        return 2
    if len(records) != 1:
        if records:
            print("ERROR: Evidence collection requires exactly one selected record.", file=sys.stderr)
        return 2

    if args.verify_timeout <= 0:
        print("ERROR: --verify-timeout must be a positive integer.", file=sys.stderr)
        return 2

    record = records[0]
    try:
        verify_log_path, verification_errors = prepare_verification(root, record, args)
    except (OSError, ValueError) as exc:
        print(f"ERROR: Verification could not be executed or recorded safely: {exc}", file=sys.stderr)
        return 2
    for error in verification_errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if verification_errors:
        return 2

    if record.kind == "FIX":
        required = {
            "--verify-state": args.verify_state,
            "--verify-command": args.verify_command,
            "--verify-exit-code": args.verify_exit_code,
            "--test-count": args.test_count,
            "--failure-count": args.failure_count,
            "--skipped-count": args.skipped_count,
            "--verify-log": args.verify_log,
        }
        missing = [name for name, value in required.items() if value == ""]
        if missing:
            print("ERROR: G1 Quick Fix evidence requires " + ", ".join(missing), file=sys.stderr)
            return 2
        if args.verify_state not in {"单元测试通过", "集成测试通过"}:
            print("ERROR: G1 Quick Fix requires 单元测试通过 or 集成测试通过.", file=sys.stderr)
            return 2
        exit_code = int(args.verify_exit_code)
        test_count = int(args.test_count)
        failure_count = int(args.failure_count)
        skipped_count = int(args.skipped_count)
        if exit_code != 0 or test_count <= 0 or failure_count != 0 or skipped_count < 0:
            print("ERROR: Quick Fix closure requires exit 0, positive tests, zero failures, and non-negative skips.", file=sys.stderr)
            return 2

    try:
        path, check_code = collect_one(root, record, args, verify_log_path)
    except (OSError, ValueError) as exc:
        print(f"ERROR: Could not update delivery evidence safely: {exc}", file=sys.stderr)
        return 2
    print(f"Wrote {path.relative_to(root)}")
    if check_code != 0:
        print(f"ERROR: check_ai_context.py returned {check_code}; evidence was kept for diagnosis.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
