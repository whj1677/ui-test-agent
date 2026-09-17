#!/usr/bin/env python3
"""Check project AI engineering context consistency.

Read-only, Python standard library only. The checker accepts old projects,
legacy-imported projects, and the simplified structure, while reporting the
issues that should be fixed before delivery.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from ai_context_change_records import (
        AI_CONTEXT_SCRIPT_PATHS,
        EVIDENCE_END,
        EVIDENCE_START,
        FIX_ELIGIBILITY_LABELS,
        FIX_META_END,
        FIX_META_START,
        FIX_REQUIRED_METADATA,
        FIX_SCHEMA,
        SCHEMA_API_VERSION,
        changed_fix_records as shared_changed_fix_records,
        changed_paths as shared_changed_paths,
        changed_requirement_dirs as shared_changed_requirement_dirs,
        code_change_fingerprint,
        fix_record_files,
        git_changes,
        has_placeholder,
        is_code_or_test_change as shared_is_code_or_test_change,
        is_fix_record_change,
        is_real_requirement_change as shared_is_real_requirement_change,
        parse_fix_document,
        project_code_files,
        quick_fix_block_reason,
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


try:
    from requirement_source import SOURCE_FILE, check_generated_views
except (ImportError, AttributeError) as exc:
    print(
        "ERROR: requirement source support is partially upgraded. Re-run migrate_context.py. "
        f"({exc})",
        file=sys.stderr,
    )
    raise SystemExit(2)


ALLOWED_VERIFICATION_STATES = {
    "未运行",
    "无法运行",
    "仅静态检查",
    "编译通过",
    "单元测试通过",
    "集成测试通过",
    "人工待确认",
}

REQUIRED_NEW_ROOT_FILES = [
    "docs/ai_engineering/README.md",
    "docs/ai_engineering/00_project_brief.md",
    "docs/ai_engineering/01_architecture.md",
    "docs/ai_engineering/02_rules.md",
    "docs/ai_engineering/03_interfaces.md",
    "docs/ai_engineering/04_build_test.md",
    "docs/ai_engineering/05_decisions_log.md",
    "docs/ai_engineering/06_known_issues.md",
    "docs/ai_engineering/07_code_model.md",
    "docs/ai_engineering/08_ai_workflow.md",
    "docs/requirements/README.md",
    "docs/requirements/inbox.md",
    "docs/requirements/_requirement_template.md",
    "docs/requirements/_change_template.md",
    "docs/changes/README.md",
    "docs/changes/_quick_fix_template.md",
    "docs/modules/README.md",
    "docs/modules/_module_template.md",
    "docs/reusable/README.md",
    "docs/reusable/_reusable_template.md",
    "scripts/check_ai_context.py",
    "scripts/sync_requirement_status.py",
    "scripts/collect_delivery_evidence.py",
    "scripts/ai_context_change_records.py",
    "scripts/create_requirement.py",
    "scripts/requirement_source.py",
    "docs/requirements/REQ-0000-template/requirement.source.json",
]

REQUIRED_REQ_FILES = [
    "current_state.md",
    "change_log.md",
    "00_user_requirement.md",
    "01_development_requirement.md",
    "02_design.md",
    "03_tasks.md",
    "04_verification.md",
    "05_trace.md",
]

OLD_AI_ENGINEERING_FILES = [
    "docs/ai_engineering/06_task_templates.md",
    "docs/ai_engineering/07_review_checklist.md",
    "docs/ai_engineering/10_context_policy.md",
    "docs/ai_engineering/11_requirements_design_tasks.md",
    "docs/ai_engineering/12_dev_loop.md",
    "docs/ai_engineering/12_unit_test_plan.md",
    "docs/ai_engineering/13_verification_policy.md",
    "docs/ai_engineering/14_delivery_review.md",
]

FORBIDDEN_PHRASES = [
    "逻辑通过",
    "应该通过",
    "静态分析通过，所以单元测试通过",
    "测试已完成但没有证据",
]

WITHDRAWN_KEYWORDS = ["已撤销", "已取消", "已废弃", "不再实现", "撤销需求"]
WITHDRAWN_CHANGE_PREFIXES = ["撤销内容", "已撤销", "不再返回", "不要返回", "移除", "取消"]
WITHDRAWN_SCAN_FILES = ["current_state.md", "02_design.md", "03_tasks.md", "04_verification.md", "05_trace.md"]
WITHDRAWN_TERM_STOPWORDS = {
    "",
    "-",
    "无",
    "暂无",
    "待补充",
    "不适用",
    "历史记录",
    "当前有效内容",
    "当前有效范围",
}
TRACE_TOKENS = ["UN", "DR", "DD", "TK", "VT"]
DESIGN_NO_CHANGE_MARKERS = ["本次无需设计变更", "无需设计变更"]
VERIFICATION_NO_CHANGE_MARKERS = ["本次无需验证变更", "无需验证变更", "验证不适用"]
TRACE_NO_CHANGE_MARKERS = ["本次无需 trace 变更", "本次无需追踪变更", "无需 trace 变更", "无需追踪变更"]
PASS_CLAIM_TERMS = ["测试通过", "单元测试通过", "集成测试通过", "全部通过", "已通过测试"]
PASS_CLAIM_NEGATION = re.compile(
    r"(?:不把|不将|不得|禁止|避免|不能|不可|不要|不应|未曾|没有)"
    r"[^。；;！？!?\n]{0,32}$"
)
VERIFICATION_ACTUAL_SECTION_HEADINGS = [
    "验证记录",
    "执行记录",
    "测试记录",
    "验证结果",
    "测试结果",
    "实际结果",
    "验证证据",
    "测试证据",
]
VERIFICATION_PLAN_SECTION_HEADINGS = [
    "验证计划",
    "测试计划",
    "计划",
]
BUILD_FAILURE_TERMS = [
    "BUILD FAILURE",
    "BUILD FAILED",
    "COMPILATION ERROR",
    "Could not resolve",
    "Could not find artifact",
    "Failed to execute goal",
    "No tests found",
    "Tests run:",
    "There are test failures",
    "退出码：1",
    "退出码: 1",
    "exit code: 1",
    "Exit code 1",
    "命令非 0",
    "超时",
    "依赖下载失败",
    "JDK 不匹配",
    "跳过测试",
    "skipTests",
]
COMPLETION_CLAIM_TERMS = ["完成", "已完成", "已闭环", "交付闭环", "可交付", "验证通过"]
NEGATED_COMPLETION_CLAIM = re.compile(
    r"(?:未|尚未|并未|没有|不曾|不算|并非|不是)\s*(?:全部\s*)?"
    r"(?:已完成|完成|已闭环|闭环|交付闭环|可交付|验证通过)"
    r"|(?:不能|不可|不得|不应|尚不|并不|不)\s*"
    r"(?:(?:宣称|视为|认为|算作|进入|达到)\s*)?"
    r"(?:已完成|完成|已闭环|闭环|交付闭环|可交付|验证通过)"
    r"|(?:验证|交付验证)\s*(?:未|尚未|并未|没有|不曾|不)\s*通过"
)
LEGACY_REQUIRED_MARKERS = {
    "来源": "legacy import auto",
    "当前有效性": "待人工确认",
    "可信等级": "迁移生成，需人工复核",
    "迁移依据": "按 Markdown H2-H4 小节自动拆分",
}
DANGEROUS_TEST_TERMS = [
    "释放后使用",
    "use-after-free",
    "已释放",
    "释放后的",
    "已关闭",
    "关闭后的",
    "closed stream",
    "closed file",
    "fclose",
    "悬空指针",
    "dangling pointer",
    "空悬",
    "未定义行为",
    "undefined behavior",
    "实现定义",
    "implementation-defined",
    "竞态",
    "race condition",
    "随机时序",
    "偶现",
]
DANGEROUS_TEST_PASS_TERMS = [
    "单元测试通过",
    "集成测试通过",
    "测试通过",
    "全部通过",
    "已实现",
    "已完成",
]
DANGEROUS_TEST_SAFE_TERMS = [
    "人工待确认",
    "仅静态检查",
    "无法运行",
    "未运行",
    "不作为稳定单元测试",
    "不能作为稳定单元测试",
    "不可作为稳定单元测试",
    "改用 mock",
    "改用 fake",
    "可控替身",
    "平台相关",
    "不稳定",
]
LEGACY_CONFIRMATION_CLAIMS = [
    "已人工确认",
    "已确认并转化",
    "已转化为",
    "当前有效性：已确认",
    "当前有效性: 已确认",
    "不再独立维护开发需求链路",
]
LEGACY_IMPLEMENTATION_TERMS = [
    "REQ-legacy-",
    "11_requirements_design_tasks.md",
    "12_unit_test_plan.md",
]
LEGACY_IMPLEMENTATION_ACTION_TERMS = [
    "承接",
    "转化",
    "实现",
    "已实现",
    "当前有效",
    "进入实现",
    "代码修改",
]
EXPLICIT_USER_CONFIRMATION_TERMS = [
    "用户明确确认",
    "用户已明确确认",
    "当前对话明确确认",
]


@dataclass
class Issue:
    path: Path
    message: str
    suggestion: str


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8-sig")


def add_issue(issues: list[Issue], path: Path, message: str, suggestion: str) -> None:
    issues.append(Issue(path=path, message=message, suggestion=suggestion))


def check_exists(root: Path, rel_path: str, issues: list[Issue]) -> None:
    path = root / rel_path
    if not path.exists():
        add_issue(issues, path, "Required file is missing.", f"Create `{rel_path}` from the skill template.")
    elif path.is_symlink():
        add_issue(
            issues,
            path,
            "Required governance path is a symlink and is not trusted for delivery.",
            f"Replace `{rel_path}` with a regular project-local file or directory.",
        )


def requirement_dirs(requirements_dir: Path) -> list[Path]:
    if not requirements_dir.exists():
        return []
    return sorted(
        path
        for path in requirements_dir.iterdir()
        if not path.is_symlink() and path.is_dir() and path.name.startswith("REQ-")
    )


def real_requirement_dirs(requirements_dir: Path) -> list[Path]:
    return [
        path
        for path in requirement_dirs(requirements_dir)
        if path.name != "REQ-0000-template" and not path.name.startswith("REQ-legacy-")
    ]


def has_legacy_upgrade_report(root: Path) -> bool:
    req_dir = root / "docs" / "requirements"
    return req_dir.exists() and any(req_dir.glob("_legacy_upgrade_report_*.md"))


def check_root_structure(root: Path, issues: list[Issue]) -> None:
    old_sources_exist = any((root / rel).exists() for rel in OLD_AI_ENGINEERING_FILES)
    new_readme = root / "docs/ai_engineering/README.md"
    new_workflow = root / "docs/ai_engineering/08_ai_workflow.md"

    for rel in REQUIRED_NEW_ROOT_FILES:
        if rel == "docs/ai_engineering/08_ai_workflow.md" and old_sources_exist and not new_workflow.exists():
            add_issue(
                issues,
                root / rel,
                "Simplified workflow file is missing while old structure files still exist.",
                "Run migrate_context.py so legacy import happens first, then create `08_ai_workflow.md`.",
            )
            continue
        check_exists(root, rel, issues)

    if not new_readme.exists() and old_sources_exist:
        add_issue(
            issues,
            new_readme,
            "Old structure exists but the simplified README entry is missing.",
            "Run the bootstrap migration and keep old files until the report confirms handling.",
        )


def check_requirement_structure(root: Path, issues: list[Issue]) -> None:
    requirements_dir = root / "docs" / "requirements"
    if not requirements_dir.exists():
        add_issue(issues, requirements_dir, "`docs/requirements/` is missing.", "Run the bootstrap script.")
        return

    for req_dir in requirement_dirs(requirements_dir):
        for filename in REQUIRED_REQ_FILES:
            path = req_dir / filename
            if not path.exists():
                add_issue(
                    issues,
                    path,
                    f"`{filename}` is missing from requirement package `{req_dir.name}`.",
                    "Copy the missing file from `REQ-0000-template/` and projectize it.",
                )
            elif path.is_symlink():
                add_issue(
                    issues,
                    path,
                    f"`{filename}` is a symlink and is not trusted as requirement evidence.",
                    "Replace it with a regular project-local file.",
                )


    for req_dir in real_requirement_dirs(requirements_dir):
        source_path = req_dir / SOURCE_FILE
        if not source_path.exists():
            continue
        try:
            drift = check_generated_views(req_dir)
        except (OSError, UnicodeError, ValueError) as exc:
            add_issue(
                issues,
                source_path,
                f"Canonical requirement source cannot be validated: {exc}",
                "Repair the canonical source, then render the generated views once.",
            )
        else:
            for problem in drift:
                add_issue(
                    issues,
                    req_dir,
                    f"Generated requirement view drift: {problem}",
                    "Edit the canonical source only, then run requirement_source.py render.",
                )


def is_real_requirement_change(path: str) -> bool:
    return shared_is_real_requirement_change(path)


def is_code_or_test_change(path: str) -> bool:
    return shared_is_code_or_test_change(path)


def _fresh_bootstrap_scaffold_change(root: Path, changes: list, code_changes: list[str]) -> bool:
    """Allow only a provable first install of the managed governance scripts."""

    if not code_changes or any(path not in AI_CONTEXT_SCRIPT_PATHS for path in code_changes):
        return False
    status_by_path = {change.path: change.status for change in changes}
    if any(status_by_path.get(path) != "??" for path in code_changes):
        return False
    current_paths = [change.path for change in changes if change.path]
    return is_bootstrap_scaffold_only(root, current_paths)


def _quick_fix_upgrade_target(fix_path: Path) -> tuple[str | None, str | None]:
    """Return the explicitly linked REQ for a completed FIX-to-REQ upgrade."""

    try:
        document = parse_fix_document(fix_path)
    except (OSError, ValueError) as exc:
        return None, f"Quick Fix upgrade record cannot be parsed: {exc}"
    section = markdown_section(document.text, "升级记录")
    if not section:
        return None, "Quick Fix upgrade record has no `升级记录` section."

    def field(label: str) -> str:
        match = re.search(
            rf"^\s*[-*+]?\s*{re.escape(label)}\s*[:：]\s*(.*?)\s*$",
            section,
            flags=re.MULTILINE,
        )
        return match.group(1).strip().strip("` *。.;；") if match else ""

    if field("是否升级") != "是":
        return None, "Quick Fix must state `是否升级：是` when a FIX and REQ change together."
    target_text = field("承接 REQ")
    target_match = re.search(r"REQ-[A-Za-z0-9][A-Za-z0-9._-]*", target_text)
    if not target_match:
        return None, "Quick Fix upgrade must name one concrete `承接 REQ`."
    reason = field("升级原因")
    if not reason or reason in {"无", "不适用"} or has_placeholder(reason):
        return None, "Quick Fix upgrade must record a concrete, confirmed upgrade reason."
    return target_match.group(0), None


def check_changed_code_has_requirement_update(root: Path, issues: list[Issue], enabled: bool) -> None:
    if not enabled:
        return
    changes = git_changes(root)
    if changes is None:
        discovered = project_code_files(root)
        if discovered:
            preview = ", ".join(discovered[:8])
            if len(discovered) > 8:
                preview += f" 等 {len(discovered)} 个文件"
            add_issue(
                issues,
                root,
                "Git status is unavailable in a project containing code/test/config files; governance linkage cannot be verified.",
                "Install/enable Git and run the checker inside an initialized repository before delivery. "
                f"Detected project files: {preview}",
            )
        return
    changed_paths: list[str] = []
    for change in changes:
        if change.original_path:
            changed_paths.append(change.original_path)
        if change.path:
            changed_paths.append(change.path)
    changed_paths = list(dict.fromkeys(changed_paths))
    code_changes = [path for path in changed_paths if is_code_or_test_change(path)]
    if not code_changes:
        return
    if _fresh_bootstrap_scaffold_change(root, changes, code_changes):
        return

    req_changes = [path for path in changed_paths if is_real_requirement_change(path)]
    fix_changes = [path for path in changed_paths if is_fix_record_change(path)]
    req_dirs = shared_changed_requirement_dirs(root, req_changes)
    fix_files = shared_changed_fix_records(root, fix_changes)
    record_count = len(req_dirs) + len(fix_files)

    if record_count == 0:
        preview = ", ".join(code_changes[:8])
        if len(code_changes) > 8:
            preview += f" 等 {len(code_changes)} 个文件"
        add_issue(
            issues,
            root / "docs" / "requirements",
            "Code/test/config changes exist without a changed governance record.",
            "Create/update one real `docs/requirements/REQ-*` package, or use one eligible "
            "`docs/changes/FIX-*` record for a verified G1 Quick Fix. "
            f"Changed files: {preview}",
        )
        return

    if len(req_dirs) == 1 and len(fix_files) == 1:
        target, error = _quick_fix_upgrade_target(fix_files[0])
        if error or target != req_dirs[0].name:
            detail = error or (
                f"Quick Fix names `{target}`, but the changed full requirement is `{req_dirs[0].name}`."
            )
            add_issue(
                issues,
                root / "docs",
                "A mixed FIX + REQ delivery is allowed only for one explicit FIX-to-REQ upgrade.",
                f"Set `是否升级：是`, link the same changed `承接 REQ`, and record a concrete reason. {detail}",
            )
            return
        # The full REQ is the governing record. The FIX remains as the explicit
        # audit trail for why the lightweight path was abandoned.
    elif record_count > 1:
        records = [path.name for path in req_dirs] + [path.name for path in fix_files]
        add_issue(
            issues,
            root / "docs",
            "Code/test/config changes are linked to multiple or mixed governance records.",
            "Keep one changed FIX or one changed real REQ for this delivery, or split the work. "
            f"Changed records: {', '.join(records)}",
        )
        return

    if fix_files and not req_dirs:
        check_changed_quick_fix(root, fix_files[0], code_changes, issues)
        return

    check_changed_requirement_doc_sync(root, changed_paths, code_changes, req_changes, issues)
    check_changed_module_docs_sync(root, changed_paths, code_changes, req_changes, issues)
    check_changed_requirement_status(root, req_changes, issues)
    for req_dir in req_dirs:
        check_changed_requirement_evidence(root, req_dir, code_changes, issues)


def markdown_section(text: str, title: str) -> str:
    match = re.search(
        rf"^##\s+{re.escape(title)}\s*$([\s\S]*?)(?=^##\s+|\Z)",
        text,
        flags=re.MULTILINE,
    )
    return match.group(1).strip() if match else ""


def numeric_evidence_value(text: str, labels: tuple[str, ...]) -> int | None:
    label_pattern = "|".join(re.escape(label) for label in labels)
    match = re.search(rf"(?:{label_pattern})\s*[:：]\s*`?(\d+)`?", text, flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def inline_evidence_value(text: str, labels: tuple[str, ...]) -> str | None:
    label_pattern = "|".join(re.escape(label) for label in labels)
    match = re.search(rf"(?:{label_pattern})\s*[:：]\s*`([^`]+)`", text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def collector_log_binding_is_valid(root: Path, evidence: str) -> bool:
    """Validate collector provenance, project-local log bytes, and observed facts."""

    if inline_evidence_value(evidence, ("Verification source", "验证来源")) != "collector-executed-v1":
        return False
    command = inline_evidence_value(evidence, ("Command", "命令"))
    log_rel = inline_evidence_value(evidence, ("Log path", "日志路径"))
    log_sha = inline_evidence_value(evidence, ("Log SHA-256", "日志 SHA-256"))
    if not command or not log_rel or not log_sha or not re.fullmatch(r"[0-9a-f]{64}", log_sha):
        return False
    log_path = safe_project_path(root, log_rel, require_file=True)
    if log_path is None:
        return False
    try:
        log_bytes = log_path.read_bytes()
        log_text = log_bytes.decode("utf-8", errors="replace")
    except OSError:
        return False
    if hashlib.sha256(log_bytes).hexdigest() != log_sha:
        return False
    if not log_text.startswith("ai-engineering-context verification-log-v1\n"):
        return False

    expected = {
        "Command": command,
        "Exit code": str(numeric_evidence_value(evidence, ("Exit code", "退出码"))),
        "Parsed test count": str(numeric_evidence_value(evidence, ("Test count", "测试数量"))),
        "Parsed failure count": str(numeric_evidence_value(evidence, ("Failure count", "失败数量"))),
        "Parsed skipped count": str(numeric_evidence_value(evidence, ("Skipped count", "跳过数量"))),
    }
    for label, value in expected.items():
        if value == "None" or not re.search(
            rf"^{re.escape(label)}:\s*{re.escape(value)}\s*$",
            log_text,
            flags=re.MULTILINE,
        ):
            return False
    return True


def check_changed_requirement_evidence(
    root: Path,
    req_dir: Path,
    code_changes: list[str],
    issues: list[Issue],
) -> None:
    path = req_dir / "delivery_evidence.md"
    if not path.is_file() or path.is_symlink():
        return
    text = read_text(path)
    fingerprint_match = re.search(r"Change fingerprint\s*[:：]\s*`([0-9a-f]{64})`", text)
    current_fingerprint = code_change_fingerprint(root, code_changes)
    if not fingerprint_match or fingerprint_match.group(1) != current_fingerprint:
        add_issue(
            issues,
            path,
            "REQ delivery evidence fingerprint is missing or stale for the current behavior diff.",
            f"Re-run `python scripts/collect_delivery_evidence.py --req {req_dir.name} ...` after the final code/test/config edit.",
        )

    missing_paths = [changed for changed in code_changes if changed not in text]
    if missing_paths:
        add_issue(
            issues,
            path,
            "REQ delivery evidence does not bind every current behavior file.",
            "Regenerate evidence. Missing: " + ", ".join(missing_paths),
        )

    pass_claimed = any(
        state in text
        for state in ("单元测试通过", "集成测试通过")
    ) or any(
        state in actual_verification_text(candidate, read_text(candidate))
        for candidate in (req_dir / "04_verification.md", req_dir / "current_state.md")
        if candidate.is_file()
        for state in ("单元测试通过", "集成测试通过")
    )
    if pass_claimed and not collector_log_binding_is_valid(root, text):
        add_issue(
            issues,
            path,
            "REQ pass evidence is not bound to a collector-executed verification log.",
            "Run the collector with `--verify-command`; caller-supplied exit/count values and pre-existing logs are not trusted.",
        )


def check_changed_quick_fix(root: Path, fix_path: Path, code_changes: list[str], issues: list[Issue]) -> None:
    try:
        document = parse_fix_document(fix_path)
    except (OSError, ValueError) as exc:
        add_issue(issues, fix_path, f"Quick Fix record cannot be parsed: {exc}", "Recreate it from `_quick_fix_template.md`.")
        return

    if document.text.count(FIX_META_START) != 1 or document.text.count(FIX_META_END) != 1:
        add_issue(
            issues,
            fix_path,
            "Quick Fix metadata markers are missing or duplicated.",
            "Keep exactly one managed fix-record metadata block from the template.",
        )

    missing_metadata = sorted(FIX_REQUIRED_METADATA - set(document.metadata))
    if missing_metadata:
        add_issue(
            issues,
            fix_path,
            f"Quick Fix metadata is incomplete: {', '.join(missing_metadata)}.",
            "Fill every required field in the managed metadata block; do not remove keys.",
        )

    expected_values = {
        "Schema": FIX_SCHEMA,
        "ID": fix_path.stem,
        "变更性质": "恢复已有行为",
        "公共接口/协议/数据结构/配置语义变更": "否",
        "依赖/构建变更": "否",
        "安全/权限/隐私/计费/迁移/关键并发": "否",
        "跨模块行为变更": "否",
        "人工待确认项": "无",
    }
    for key, expected in expected_values.items():
        value = document.metadata.get(key, "")
        if value != expected:
            add_issue(
                issues,
                fix_path,
                f"Quick Fix field `{key}` must be `{expected}`, found `{value or 'missing'}`.",
                "Use a full REQ when the assertion is not exactly true.",
            )

    if document.metadata.get("分级", "") not in {"G1", "G1 Quick Fix"}:
        add_issue(
            issues,
            fix_path,
            f"Quick Fix field `分级` must be `G1`, found `{document.metadata.get('分级', 'missing')}`.",
            "Use a full REQ for G2/G3 work.",
        )

    for key in FIX_REQUIRED_METADATA:
        value = document.metadata.get(key, "")
        if key != "人工待确认项" and has_placeholder(value):
            add_issue(
                issues,
                fix_path,
                f"Quick Fix field `{key}` is empty or still contains a placeholder.",
                "Replace placeholders with confirmed facts, or upgrade the work to a full REQ.",
            )

    implementation_state = document.metadata.get("实现状态", "")
    if not implementation_state.startswith("已实现"):
        add_issue(
            issues,
            fix_path,
            f"Quick Fix implementation state is `{implementation_state or 'missing'}`.",
            "After editing code, set implementation state to an evidence-aware `已实现...` value.",
        )

    verification_state = document.metadata.get("验证状态", "")
    if verification_state not in {"单元测试通过", "集成测试通过"}:
        add_issue(
            issues,
            fix_path,
            f"G1 Quick Fix requires actual unit/integration-test closure; found `{verification_state or 'missing'}`.",
            "Run a repeatable test and record `单元测试通过` or `集成测试通过`; otherwise use a full REQ.",
        )

    for label in FIX_ELIGIBILITY_LABELS:
        value = document.eligibility.get(label, "")
        if value != "是":
            add_issue(
                issues,
                fix_path,
                f"Quick Fix eligibility `{label}` must be `是`, found `{value or 'missing'}`.",
                "If this cannot be confirmed, create a full REQ instead of using Quick Fix.",
            )
        evidence_value = document.eligibility_evidence.get(label, "")
        if has_placeholder(evidence_value):
            add_issue(
                issues,
                fix_path,
                f"Quick Fix eligibility `{label}` has no concrete evidence.",
                "Replace the template/placeholder evidence with a reviewable requirement, test, interface document, reproduction, or code fact.",
            )

    for title in ("症状与稳定复现", "已确认根因", "修复范围", "实施摘要", "回滚方式"):
        section = markdown_section(document.text, title)
        if has_placeholder(section):
            add_issue(
                issues,
                fix_path,
                f"Quick Fix section `{title}` is missing or incomplete.",
                "Record concrete facts and evidence; unresolved facts require a full REQ.",
            )

    declared = {path for path in document.declared_paths if is_code_or_test_change(path)}
    changed = set(code_changes)
    missing_paths = sorted(changed - declared)
    stale_paths = sorted(declared - changed)
    if missing_paths or stale_paths:
        detail = []
        if missing_paths:
            detail.append("not declared: " + ", ".join(missing_paths))
        if stale_paths:
            detail.append("not changed this round: " + ", ".join(stale_paths))
        add_issue(
            issues,
            fix_path,
            "Quick Fix exact changed-file list does not match the current code/test/config diff.",
            "Make the list exact for this delivery (" + "; ".join(detail) + ").",
        )

    for path in code_changes:
        reason = quick_fix_block_reason(path)
        if reason:
            add_issue(
                issues,
                root / path,
                f"Path is not eligible for G1 Quick Fix: {reason}.",
                "Use a full REQ and its complete design/trace/verification chain.",
            )

    evidence = document.evidence_text
    if document.text.count(EVIDENCE_START) != 1 or document.text.count(EVIDENCE_END) != 1 or not evidence:
        add_issue(
            issues,
            fix_path,
            "Quick Fix delivery-evidence block is missing or malformed.",
            f"Run `python scripts/collect_delivery_evidence.py --fix {fix_path.stem} ...` after verification.",
        )
        return

    command_match = re.search(r"(?:Command|命令)\s*[:：]\s*`([^`]+)`", evidence, flags=re.IGNORECASE)
    exit_code = numeric_evidence_value(evidence, ("Exit code", "退出码"))
    test_count = numeric_evidence_value(evidence, ("Test count", "测试数量"))
    failure_count = numeric_evidence_value(evidence, ("Failure count", "失败数量"))
    skipped_count = numeric_evidence_value(evidence, ("Skipped count", "跳过数量"))
    evidence_state = re.search(
        r"(?:Verification state|验证状态)\s*[:：]\s*`?(单元测试通过|集成测试通过)`?",
        evidence,
    )
    log_match = re.search(r"(?:Log path|日志路径)\s*[:：]\s*`([^`]+)`", evidence, flags=re.IGNORECASE)
    fingerprint_match = re.search(r"Change fingerprint\s*[:：]\s*`([0-9a-f]{64})`", evidence)
    log_excerpt = re.search(
        r"^###\s+Verification Log Excerpt\s*$([\s\S]*?)(?=^###\s+|\Z)",
        evidence,
        flags=re.MULTILINE,
    )
    current_fingerprint = code_change_fingerprint(root, code_changes)
    evidence_invalid = (
        not command_match
        or command_match.group(1) in {"未记录", "-"}
        or exit_code != 0
        or test_count is None
        or test_count <= 0
        or failure_count != 0
        or skipped_count is None
        or not evidence_state
        or evidence_state.group(1) != verification_state
        or not log_match
        or log_match.group(1) in {"未记录", "-"}
        or not log_excerpt
        or not log_excerpt.group(1).strip()
        or "(not provided)" in log_excerpt.group(1)
        or not fingerprint_match
        or fingerprint_match.group(1) != current_fingerprint
        or not collector_log_binding_is_valid(root, evidence)
    )
    if evidence_invalid:
        add_issue(
            issues,
            fix_path,
            "Quick Fix evidence is not sufficient for actual test closure.",
            "Record the executed command, exit code 0, positive test count, failure count 0, skipped count, matching test state, a non-empty in-project log, and the current change fingerprint.",
        )

    missing_evidence_paths = [path for path in code_changes if path not in evidence]
    if missing_evidence_paths:
        add_issue(
            issues,
            fix_path,
            "Quick Fix evidence is stale or does not bind every changed file.",
            "Regenerate evidence for the current diff. Missing: " + ", ".join(missing_evidence_paths),
        )


def changed_requirement_dirs(root: Path, req_changes: list[str]) -> list[Path]:
    return shared_changed_requirement_dirs(root, req_changes)


def file_changed(changed_paths: list[str], req_dir: Path, filename: str) -> bool:
    return f"docs/requirements/{req_dir.name}/{filename}" in changed_paths


def file_has_marker(path: Path, markers: list[str]) -> bool:
    if not path.exists():
        return False
    text = actual_verification_text(path, read_text(path))
    return any(marker in text for marker in markers)


def is_module_doc_change(path: str) -> bool:
    if not path.startswith("docs/modules/") or not path.endswith(".md"):
        return False
    name = path.rsplit("/", 1)[-1]
    return name not in {"README.md", "_module_template.md"}


def has_module_doc_no_change_record(path: Path) -> bool:
    if not path.exists():
        return False
    for line in read_text(path).splitlines():
        stripped = line.strip()
        if not stripped or "本次无需模块文档变更" not in stripped:
            continue
        if "必须写明" in stripped or stripped.startswith("|") or stripped.startswith(">"):
            continue
        cleaned = stripped.replace("`", "")
        if cleaned.startswith(("-", "*", "+")):
            cleaned = cleaned[1:].strip()
        if cleaned.startswith("本次无需模块文档变更") and "原因" in cleaned:
            return True
    return False


def check_changed_requirement_doc_sync(
    root: Path,
    changed_paths: list[str],
    code_changes: list[str],
    req_changes: list[str],
    issues: list[Issue],
) -> None:
    if not code_changes or not req_changes:
        return
    for req_dir in changed_requirement_dirs(root, req_changes):
        design = req_dir / "02_design.md"
        verification = req_dir / "04_verification.md"
        trace = req_dir / "05_trace.md"
        evidence = req_dir / "delivery_evidence.md"
        change_log_changed = file_changed(changed_paths, req_dir, "change_log.md")

        if not file_changed(changed_paths, req_dir, "02_design.md") and not file_has_marker(design, DESIGN_NO_CHANGE_MARKERS):
            add_issue(
                issues,
                design,
                "Code/test/config changed but `02_design.md` was not updated and has no explicit no-design-change reason.",
                "Update `02_design.md`, or add `本次无需设计变更，原因：...` when the change truly does not affect design.",
            )
        if not file_changed(changed_paths, req_dir, "04_verification.md") and not file_has_marker(verification, VERIFICATION_NO_CHANGE_MARKERS):
            add_issue(
                issues,
                verification,
                "Code/test/config changed but `04_verification.md` was not updated and has no explicit no-verification-change reason.",
                "Update verification status/evidence, or add `本次无需验证变更，原因：...`.",
            )
        if change_log_changed and not file_changed(changed_paths, req_dir, "05_trace.md") and not file_has_marker(trace, TRACE_NO_CHANGE_MARKERS):
            add_issue(
                issues,
                trace,
                "`change_log.md` changed but `05_trace.md` was not updated.",
                "Update `05_trace.md` so the current `UN -> DR -> DD -> TK -> VT` chain reflects the change, or record why trace is unchanged.",
            )
        if not evidence.exists() or not file_changed(changed_paths, req_dir, "delivery_evidence.md"):
            add_issue(
                issues,
                evidence,
                "Code/test/config changed but current-round `delivery_evidence.md` is missing or unchanged.",
                "Run `python scripts/collect_delivery_evidence.py --req "
                f"{req_dir.name}` after verification and before final delivery.",
            )


def check_changed_module_docs_sync(
    root: Path,
    changed_paths: list[str],
    code_changes: list[str],
    req_changes: list[str],
    issues: list[Issue],
) -> None:
    if not code_changes or not req_changes:
        return
    if any(is_module_doc_change(path) for path in changed_paths):
        return

    for req_dir in changed_requirement_dirs(root, req_changes):
        design = req_dir / "02_design.md"
        if file_changed(changed_paths, req_dir, "02_design.md") and has_module_doc_no_change_record(design):
            return

    add_issue(
        issues,
        root / "docs" / "modules",
        "Code/test/config changed but no concrete module document was updated, and no explicit no-module-doc-change reason was recorded in the changed requirement design.",
        "Create or update the affected `docs/modules/<module>.md` file. If the change truly has no module impact, add `本次无需模块文档变更，原因：...` to the changed requirement `02_design.md`.",
    )


def table_status_values(text: str) -> list[str]:
    rows = extract_table_rows(text)
    if not rows:
        return []
    header = rows[0]
    indexes = [idx for idx, cell in enumerate(header) if cell in {"状态", "当前状态"}]
    values: list[str] = []
    for row in rows[1:]:
        for idx in indexes:
            if idx < len(row):
                value = row[idx].strip()
                if value and value not in {"状态", "当前状态", "待补充"}:
                    values.append(value)
    return values


def check_changed_requirement_status(root: Path, req_changes: list[str], issues: list[Issue]) -> None:
    for req_dir in changed_requirement_dirs(root, req_changes):
        task_path = req_dir / "03_tasks.md"
        if not task_path.exists():
            continue
        status_values = table_status_values(read_text(task_path))
        if status_values and all(value == "待实现" for value in status_values):
            add_issue(
                issues,
                req_dir,
                "Requirement package changed, but all task statuses are still `待实现`.",
                "Record each task's actual implementation state from its own evidence in requirement.source.json, "
                "then run sync_requirement_status.py --apply to render the views. "
                "For legacy packages, update 03_tasks.md and 05_trace.md directly. Tests alone do not prove implementation.",
            )


def extract_table_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or not stripped.endswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        rows.append(cells)
    return rows


def markdown_tables(text: str) -> list[tuple[list[str], list[list[str]]]]:
    """Return contiguous Markdown pipe tables as (header, data rows)."""
    groups: list[list[list[str]]] = []
    current: list[list[str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|"):
            current.append([cell.strip() for cell in stripped.strip("|").split("|")])
            continue
        if current:
            groups.append(current)
            current = []
    if current:
        groups.append(current)

    tables: list[tuple[list[str], list[list[str]]]] = []
    for group in groups:
        rows = [
            row
            for row in group
            if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in row)
        ]
        if rows:
            tables.append((rows[0], rows[1:]))
    return tables


def linked_ids(cell: str, prefix: str) -> set[str]:
    pattern = rf"(?<![A-Za-z0-9]){re.escape(prefix)}-(?:[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*)(?![A-Za-z0-9._-])"
    return set(re.findall(pattern, cell))


def header_index(header: list[str], aliases: set[str]) -> int | None:
    for index, value in enumerate(header):
        if value in aliases:
            return index
    return None


def vt_dr_pairs(text: str) -> set[tuple[str, str]]:
    pairs: set[tuple[str, str]] = set()
    for header, rows in markdown_tables(text):
        vt_index = header_index(header, {"VT", "验证项", "对应 VT"})
        dr_index = header_index(header, {"DR", "覆盖 DR", "关联 DR"})
        if vt_index is None or dr_index is None:
            continue
        for row in rows:
            if max(vt_index, dr_index) >= len(row):
                continue
            for vt_id in linked_ids(row[vt_index], "VT"):
                for dr_id in linked_ids(row[dr_index], "DR"):
                    pairs.add((vt_id, dr_id))
    # Current-state summaries and some valid trace files use compact list rows
    # instead of a pipe table.  A pair is only inferred when both IDs occur on
    # the same physical line, avoiding cross-paragraph guessing.
    for line in text.splitlines():
        for vt_id in linked_ids(line, "VT"):
            for dr_id in linked_ids(line, "DR"):
                pairs.add((vt_id, dr_id))
    return pairs


def has_vt_dr_table(text: str) -> bool:
    for header, _ in markdown_tables(text):
        if header_index(header, {"VT", "验证项", "对应 VT"}) is not None and header_index(
            header, {"DR", "覆盖 DR", "关联 DR"}
        ) is not None:
            return True
    return False


def declared_vts(text: str) -> set[str]:
    return linked_ids(text, "VT")


def wildcard_link_cells(text: str) -> list[str]:
    wildcard_pattern = re.compile(r"(?<![A-Za-z0-9])(?:DR|VT)-(?:[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*)?-\*")
    return wildcard_pattern.findall(text)


def check_trace_verification_coverage(req_dir: Path, issues: list[Issue]) -> None:
    """Require trace DR→VT links to match each VT's declared DR coverage."""
    if req_dir.name == "REQ-0000-template" or req_dir.name.startswith("REQ-legacy-"):
        return
    trace_path = req_dir / "05_trace.md"
    verification_path = req_dir / "04_verification.md"
    if not trace_path.exists() or not verification_path.exists():
        return

    trace_text = current_effective_text(trace_path, read_text(trace_path))
    current_state_path = req_dir / "current_state.md"
    documents = [(trace_path, trace_text), (verification_path, read_text(verification_path))]
    if current_state_path.exists():
        documents.append((current_state_path, read_text(current_state_path)))
    for path, text in documents:
        wildcards = sorted(set(wildcard_link_cells(text)))
        if wildcards:
            add_issue(
                issues,
                path,
                f"Wildcard requirement/verification IDs are not auditable: {', '.join(f'`{item}`' for item in wildcards)}.",
                "Enumerate each current DR and VT explicitly so every trace pair can be checked semantically.",
            )

    trace_pairs = vt_dr_pairs(trace_text)
    if not trace_pairs:
        return
    verification_text = read_text(verification_path)
    verification_pairs = vt_dr_pairs(verification_text)
    for vt_id, dr_id in sorted(trace_pairs - verification_pairs):
        add_issue(
            issues,
            verification_path,
            f"Trace maps `{dr_id}` to `{vt_id}`, but that VT does not declare the DR in its verification coverage.",
            f"Add `{dr_id}` to the `{vt_id}` DR column and make the verification item cover its acceptance criteria, or map the DR to a dedicated VT; then keep `05_trace.md` consistent.",
        )

    if not current_state_path.exists():
        return
    current_text = read_text(current_state_path)
    current_vts = declared_vts(current_text)
    if current_vts:
        current_pairs = vt_dr_pairs(current_text)
        for vt_id, dr_id in sorted(trace_pairs):
            if vt_id not in current_vts or (vt_id, dr_id) in current_pairs:
                continue
            add_issue(
                issues,
                current_state_path,
                f"Current-state VT `{vt_id}` omits traced DR `{dr_id}` from its declared coverage.",
                "Synchronize the current verification summary with `04_verification.md` and the current `05_trace.md` mapping.",
            )


def check_trace(req_dir: Path, issues: list[Issue]) -> None:
    path = req_dir / "05_trace.md"
    if not path.exists():
        return
    text = read_text(path)
    missing = [token for token in TRACE_TOKENS if token not in text]
    if missing:
        add_issue(
            issues,
            path,
            f"Trace file does not contain all required tokens: {', '.join(missing)}.",
            "Ensure the trace records `UN -> DR -> DD -> TK -> VT`.",
        )


def check_verification_states(req_dir: Path, issues: list[Issue]) -> None:
    path = req_dir / "04_verification.md"
    if not path.exists():
        return
    text = actual_verification_text(path, read_text(path))
    rows = extract_table_rows(text)
    if not rows:
        return
    header = rows[0]
    state_indexes = [idx for idx, cell in enumerate(header) if cell in {"状态", "验证状态", "执行状态"}]
    for row in rows[1:]:
        for idx in state_indexes:
            if idx >= len(row):
                continue
            state = row[idx].strip()
            if not state or state in {"待补充", "状态", "验证状态", "执行状态"}:
                continue
            if state not in ALLOWED_VERIFICATION_STATES:
                add_issue(
                    issues,
                    path,
                    f"Verification state `{state}` is not allowed.",
                    "Use one of: " + "、".join(sorted(ALLOWED_VERIFICATION_STATES)),
                )
        if len(row) >= 2 and row[0].strip() in {"状态", "验证状态"}:
            state = row[1].strip()
            if state and state not in {"待补充", "状态", "验证状态"} and state not in ALLOWED_VERIFICATION_STATES:
                add_issue(
                    issues,
                    path,
                    f"Verification state `{state}` is not allowed.",
                    "Use one of: " + "、".join(sorted(ALLOWED_VERIFICATION_STATES)),
                )


def row_has_unit_test_evidence(header: list[str], row: list[str]) -> bool:
    required_columns = ["命令", "退出码", "测试数量", "失败数量", "跳过数量"]
    header_index = {cell: idx for idx, cell in enumerate(header)}
    for column in required_columns:
        idx = header_index.get(column)
        if idx is None or idx >= len(row):
            return False
        value = row[idx].strip()
        if not value or value in {"待补充", "无", "-"}:
            return False
        if column != "命令" and not re.search(r"\d+", value):
            return False
    return True


def check_unit_test_pass_evidence(req_dir: Path, issues: list[Issue]) -> None:
    path = req_dir / "04_verification.md"
    if not path.exists():
        return
    rows = extract_table_rows(actual_verification_text(path, read_text(path)))
    if not rows:
        return
    header = rows[0]
    state_indexes = [idx for idx, cell in enumerate(header) if cell in {"状态", "验证状态", "执行状态"}]
    for row in rows[1:]:
        if any(idx < len(row) and row[idx].strip() == "单元测试通过" for idx in state_indexes):
            if not row_has_unit_test_evidence(header, row):
                add_issue(
                    issues,
                    path,
                    "`单元测试通过` is recorded without complete evidence.",
                    "Record command, exit code, test count, failure count, and skipped count.",
                )
        if len(row) >= 2 and row[0].strip() in {"状态", "验证状态"} and row[1].strip() == "单元测试通过":
            add_issue(
                issues,
                path,
                "`单元测试通过` is recorded in a key-value verification table where complete evidence columns are unavailable.",
                "Use a verification table with command, exit code, test count, failure count, and skipped count, or mark the item as not run.",
            )


def has_exit_zero_evidence(text: str) -> bool:
    return bool(
        re.search(r"(退出码|exit code|Exit code)\s*[:：]?\s*`?0`?", text)
        or re.search(r"\|\s*0\s*\|", text)
    )


def has_test_count_evidence(text: str) -> bool:
    return bool(
        re.search(r"(测试数量|Tests run|collected|passed|failed|skipped|失败数量|跳过数量)", text, flags=re.IGNORECASE)
    )


def has_asserted_pass_claim(text: str) -> bool:
    """Return True only for an asserted pass claim, not a prohibition/example."""

    for line in text.splitlines():
        for term in PASS_CLAIM_TERMS:
            start = 0
            while True:
                index = line.find(term, start)
                if index < 0:
                    break
                prefix = line[:index]
                clause_prefix = re.split(r"[。；;！？!?]", prefix)[-1]
                if not PASS_CLAIM_NEGATION.search(clause_prefix):
                    return True
                start = index + len(term)
    return False


def has_asserted_completion_claim(text: str) -> bool:
    """Ignore explicit blocked/negative states while preserving any positive claim."""

    without_negated_states = NEGATED_COMPLETION_CLAIM.sub("", text)
    return any(term in without_negated_states for term in COMPLETION_CLAIM_TERMS)


def check_pass_claim_text(path: Path, text: str, issues: list[Issue]) -> None:
    if not has_asserted_pass_claim(text):
        return
    has_failure = any(term in text for term in BUILD_FAILURE_TERMS)
    if has_failure:
        add_issue(
            issues,
            path,
            "Document claims tests/build passed while failure, skipped-test, timeout, or non-zero evidence is present.",
            "Downgrade verification to `无法运行` / `未运行` / `仅静态检查` / failure, and keep the original command output.",
        )
        return
    if not has_exit_zero_evidence(text) or not has_test_count_evidence(text):
        add_issue(
            issues,
            path,
            "Document claims tests passed without exit-code-zero and test-count evidence.",
            "Record exact command, working directory, exit code 0, test count/failure count/skipped count, and log path before writing `测试通过`.",
        )


def actual_verification_text(path: Path, text: str) -> str:
    if path.name != "04_verification.md":
        return text

    lines = text.splitlines()
    actual_chunks: list[str] = []
    in_actual_section = False

    for line in lines:
        heading = re.match(r"^\s{0,3}#{2,6}\s+(.+?)\s*$", line)
        if heading:
            title = heading.group(1).strip().strip("#").strip()
            in_actual_section = any(marker in title for marker in VERIFICATION_ACTUAL_SECTION_HEADINGS)
            continue
        if in_actual_section:
            actual_chunks.append(line)

    if actual_chunks:
        return "\n".join(actual_chunks)

    # Fallback for compact verification files without headings: ignore rows/lines that
    # explicitly describe planned or expected results, and scan the remaining evidence text.
    filtered_lines = [
        line
        for line in lines
        if not in_expected_or_plan_line(line)
    ]
    return "\n".join(filtered_lines)


def in_expected_or_plan_line(line: str) -> bool:
    lowered = line.lower()
    return (
        "预期结果" in line
        or "期望结果" in line
        or "预期：" in line
        or "预期:" in line
        or "expected result" in lowered
        or "expected:" in lowered
        or "plan" in lowered and "result" in lowered
    )


def check_verification_claim_evidence(req_dir: Path, issues: list[Issue]) -> None:
    for filename in ["03_tasks.md", "04_verification.md", "05_trace.md", "delivery_evidence.md", "current_state.md"]:
        path = req_dir / filename
        if path.exists():
            text = read_text(path)
            check_pass_claim_text(path, actual_verification_text(path, text), issues)


def check_check_failure_completion_claim(req_dir: Path, issues: list[Issue]) -> None:
    path = req_dir / "delivery_evidence.md"
    if not path.exists():
        return
    text = read_text(path)
    if "FAIL ai-engineering-context checks" not in text and not re.search(r"Check AI Context[\s\S]*Exit code:\s*`?[1-9]", text):
        return
    if has_asserted_completion_claim(text):
        add_issue(
            issues,
            path,
            "`check_ai_context.py` failure is recorded while completion-style wording is still present.",
            "When the check fails, final status must be `未完成` / `阻塞` / `检查失败`, not complete or deliverable.",
        )


def check_untracked_delivery_evidence(root: Path, issues: list[Issue]) -> None:
    changes = git_changes(root)
    if changes is None:
        return
    untracked = [change.path for change in changes if change.status == "??"]
    untracked = [
        path
        for path in untracked
        if path and not should_ignore_untracked_path(path) and not path.endswith("/delivery_evidence.md")
    ]
    if not untracked:
        return
    if is_bootstrap_scaffold_only(root, untracked):
        return
    current_paths = [change.path for change in changes]
    evidence_parts: list[str] = []
    for req_dir in shared_changed_requirement_dirs(root, current_paths):
        evidence = req_dir / "delivery_evidence.md"
        if evidence.exists():
            evidence_parts.append(read_text(evidence))
    for fix_path in shared_changed_fix_records(root, current_paths):
        try:
            evidence_parts.append(parse_fix_document(fix_path).evidence_text)
        except (OSError, ValueError):
            continue
    evidence_text = "\n".join(evidence_parts)
    missing = [path for path in untracked if path not in evidence_text]
    if missing:
        preview = ", ".join(missing[:8])
        if len(missing) > 8:
            preview += f" 等 {len(missing)} 个文件"
        add_issue(
            issues,
            root / "docs",
            "Untracked files exist but are not recorded in delivery evidence.",
            "Regenerate evidence for the one changed FIX/REQ record and include all untracked files before delivery. "
            f"Missing: {preview}",
        )


def should_ignore_untracked_path(path: str) -> bool:
    normalized = path.replace("\\", "/")
    ignored_parts = {
        ".git",
        ".pytest_cache",
        "__pycache__",
        ".mypy_cache",
        ".ruff_cache",
        ".coverage",
        ".nox",
        ".tox",
        ".venv",
        "build",
        "dist",
        "htmlcov",
        "node_modules",
        "site-packages",
        "target",
        "venv",
    }
    if normalized.endswith(".pyc") or normalized.endswith(".pyo"):
        return True
    return any(part in ignored_parts for part in normalized.split("/"))


def is_bootstrap_scaffold_only(root: Path, untracked: list[str]) -> bool:
    """Do not require delivery evidence for the initial context scaffold itself."""

    # Running this checker imports the sibling helper and can create
    # scripts/__pycache__ before Git status is evaluated.  Ignore only the
    # same deterministic runtime/cache paths used by the general untracked
    # evidence check; otherwise a pristine first bootstrap falsely appears to
    # contain ungoverned code changes.
    untracked = [
        path for path in untracked if path and not should_ignore_untracked_path(path)
    ]

    requirements_dir = root / "docs" / "requirements"
    real_req_dirs = []
    if requirements_dir.exists():
        real_req_dirs = [
            path
            for path in requirements_dir.iterdir()
            if path.is_dir() and path.name.startswith("REQ-") and path.name not in {"REQ-0000-template"} and not path.name.startswith("REQ-legacy-")
        ]
    if real_req_dirs:
        return False
    if fix_record_files(root / "docs" / "changes"):
        return False

    bootstrap_prefixes = (
        "docs/ai_engineering/",
        "docs/modules/",
        "docs/reusable/",
        "docs/test_engineering/",
        "docs/changes/",
        "docs/requirements/REQ-0000-template/",
        "scripts/check_ai_context.py",
        "scripts/sync_requirement_status.py",
        "scripts/collect_delivery_evidence.py",
        "scripts/ai_context_change_records.py",
        "scripts/create_requirement.py",
        "scripts/requirement_source.py",
    )
    bootstrap_exact = {
        "AGENTS.md",
        "CLAUDE.md",
        ".gitignore",
        ".test-engineering.yaml",
        ".test-engineering-binding.yaml",
        "docs/requirements/README.md",
        "docs/requirements/inbox.md",
        "docs/requirements/_requirement_template.md",
        "docs/requirements/_change_template.md",
    }
    for path in untracked:
        normalized = path.replace("\\", "/")
        if normalized in bootstrap_exact:
            continue
        if any(normalized.startswith(prefix) for prefix in bootstrap_prefixes):
            continue
        return False
    return True


def check_task_completion_evidence(req_dir: Path, issues: list[Issue]) -> None:
    path = req_dir / "03_tasks.md"
    if not path.exists():
        return
    text = read_text(path)
    weak_evidence_pattern = r"环境不可用|不可用|无法运行|未运行|仅静态检查|静态审查"
    for line in text.splitlines():
        stripped = line.strip()
        if not re.search(r"\[[xX]\]", stripped):
            continue
        if "编译通过" in stripped and re.search(weak_evidence_pattern, stripped):
            add_issue(
                issues,
                path,
                "Task completion checklist claims compile success while the same line says compile evidence is unavailable or static-only.",
                "Replace the checked compile-success item with an evidence-aware statement such as `编译未运行` or record the real command and exit code.",
            )
        if "测试通过" in stripped and re.search(weak_evidence_pattern, stripped):
            add_issue(
                issues,
                path,
                "Task completion checklist claims test success while the same line says tests are unavailable, not run, or static-only.",
                "Replace the checked test-success item with `测试未运行` / `无法运行`, or record real test command, exit code, and test statistics.",
            )


def check_dangerous_test_design(req_dir: Path, issues: list[Issue]) -> None:
    for filename in ["02_design.md", "03_tasks.md", "04_verification.md", "05_trace.md", "current_state.md"]:
        path = req_dir / filename
        if not path.exists():
            continue
        text = read_text(path)
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            lowered = stripped.casefold()
            if not any(term.casefold() in lowered for term in DANGEROUS_TEST_TERMS):
                continue
            claims_pass = any(term in stripped for term in DANGEROUS_TEST_PASS_TERMS)
            records_guardrail = any(term in stripped for term in DANGEROUS_TEST_SAFE_TERMS)
            if claims_pass and not records_guardrail:
                add_issue(
                    issues,
                    path,
                    "Potentially unstable or undefined-behavior test is recorded as implemented/passing without a guardrail.",
                    "Do not use released resources, closed handles, dangling pointers, races, or platform-dependent side effects as stable unit tests; mark it `人工待确认` / `仅静态检查`, or redesign with a controlled mock/fake.",
                )


def normalize_marker_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    stripped = re.sub(r"^\s*[-*+]\s*", "", stripped)
    stripped = stripped.replace("**", "").replace("`", "").strip()
    match = re.match(r"^([^:：]+?)\s*[:：]\s*(.+?)\s*$", stripped)
    if not match:
        return None
    return match.group(1).strip(), re.sub(r"\s+", " ", match.group(2).strip())


def legacy_marker_values(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in text.splitlines():
        parsed = normalize_marker_line(line)
        if not parsed:
            continue
        key, value = parsed
        values[key] = value
    return values


def check_legacy_current_state(req_dir: Path, issues: list[Issue]) -> None:
    if not req_dir.name.startswith("REQ-legacy-"):
        return
    path = req_dir / "current_state.md"
    if not path.exists():
        return
    text = read_text(path)
    values = legacy_marker_values(text)
    for key, expected in LEGACY_REQUIRED_MARKERS.items():
        if values.get(key) != expected:
            add_issue(
                issues,
                path,
                f"Legacy current_state is missing marker `{key}：{expected}`.",
                "Regenerate or manually add the legacy import trust markers.",
            )
    for claim in LEGACY_CONFIRMATION_CLAIMS:
        if claim in text:
            add_issue(
                issues,
                path,
                f"Legacy package appears to be promoted to current work: `{claim}`.",
                "Keep `REQ-legacy-*` as historical input with `待人工确认`; create a real `REQ-*` only after recording explicit user confirmation in the current conversation.",
            )


def check_legacy_used_as_implementation_source(req_dir: Path, issues: list[Issue]) -> None:
    if req_dir.name.startswith("REQ-legacy-"):
        return
    combined_parts = []
    for filename in REQUIRED_REQ_FILES:
        path = req_dir / filename
        if path.exists():
            combined_parts.append(read_text(path))
    if not combined_parts:
        return
    text = "\n".join(combined_parts)
    mentions_legacy = any(term in text for term in LEGACY_IMPLEMENTATION_TERMS)
    if not mentions_legacy:
        return
    uses_for_work = any(term in text for term in LEGACY_IMPLEMENTATION_ACTION_TERMS)
    has_user_confirmation = any(term in text for term in EXPLICIT_USER_CONFIRMATION_TERMS)
    if uses_for_work and not has_user_confirmation:
        add_issue(
            issues,
            req_dir,
            "Real requirement appears to use legacy content as implementation source without explicit current user confirmation.",
            "Record the user's explicit confirmation that the legacy content is still valid, or downgrade the requirement to `人工待确认` and do not implement code from legacy-only evidence.",
        )


def check_current_state_withdrawn_keywords(req_dir: Path, issues: list[Issue]) -> None:
    path = req_dir / "current_state.md"
    if not path.exists():
        return
    text = read_text(path)
    for keyword in WITHDRAWN_KEYWORDS:
        if keyword in text:
            add_issue(
                issues,
                path,
                f"Current effective state contains withdrawn keyword `{keyword}`.",
                "Move historical withdrawal notes to `change_log.md` and keep `current_state.md` current-only.",
            )


def clean_withdrawn_term(term: str) -> str:
    term = term.strip()
    term = re.sub(r"^\s*[-*+]\s*", "", term)
    term = term.strip(" `\"'“”‘’[]【】()（）<>：:")
    term = re.sub(r"^(字段|功能|需求|内容|接口|返回值|验收项)\s*", "", term)
    term = re.sub(r"\s+", " ", term)
    return term.strip()


def extract_withdrawn_terms(change_log_text: str) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    prefix_pattern = "|".join(re.escape(prefix) for prefix in WITHDRAWN_CHANGE_PREFIXES)
    for line in change_log_text.splitlines():
        stripped = line.strip()
        stripped = re.sub(r"^\s*[>|]\s*", "", stripped)
        stripped = re.sub(r"^\s*[-*+]\s*", "", stripped)
        stripped = stripped.replace("**", "").replace("`", "")
        match = re.search(rf"(?:{prefix_pattern})\s*[:：]\s*(.+)$", stripped)
        if not match:
            continue
        tail = match.group(1)
        candidates = re.split(r"[，,、；;。|/\\\[\]【】（）()]+|\s{2,}", tail)
        for candidate in candidates:
            term = clean_withdrawn_term(candidate)
            if len(term) < 2 or term in WITHDRAWN_TERM_STOPWORDS:
                continue
            key = term.casefold()
            if key in seen:
                continue
            seen.add(key)
            terms.append(term)
    return terms


def current_effective_text(path: Path, text: str) -> str:
    if path.name != "05_trace.md":
        return text
    match = re.search(r"^##\s+当前(?:有效)?链路\s*$([\s\S]*?)(?=^##\s+|\Z)", text, flags=re.MULTILINE)
    return match.group(1) if match else text


def check_withdrawn_residuals(req_dir: Path, issues: list[Issue]) -> None:
    change_log = req_dir / "change_log.md"
    if not change_log.exists():
        return
    terms = extract_withdrawn_terms(read_text(change_log))
    if not terms:
        return
    for filename in WITHDRAWN_SCAN_FILES:
        path = req_dir / filename
        if not path.exists():
            continue
        text = current_effective_text(path, read_text(path))
        for term in terms:
            if term in text:
                add_issue(
                    issues,
                    path,
                    f"Withdrawn requirement term `{term}` still appears in current effective content.",
                    "Remove withdrawn scope from current_state, design, tasks, verification, and current trace; keep history in `change_log.md`.",
                )


def check_forbidden_phrases(root: Path, issues: list[Issue]) -> None:
    search_roots = [root / "docs" / "requirements", root / "docs" / "changes", root / "docs" / "ai_engineering"]
    for search_root in search_roots:
        if not search_root.exists():
            continue
        for path in search_root.rglob("*.md"):
            text = read_text(path)
            for phrase in FORBIDDEN_PHRASES:
                if phrase in text:
                    add_issue(
                        issues,
                        path,
                        f"Forbidden verification phrase found: `{phrase}`.",
                        "Replace it with an evidence-aware state and supporting command output.",
                    )
            if "测试已完成" in text and not re.search(r"退出码\s*[:：|]\s*\d+", text):
                add_issue(
                    issues,
                    path,
                    "`测试已完成` appears without exit-code evidence.",
                    "Record exact command, exit code, and test statistics, or mark the item as not run.",
                )


def check_old_files(root: Path, issues: list[Issue]) -> None:
    report_exists = has_legacy_upgrade_report(root)
    for rel in OLD_AI_ENGINEERING_FILES:
        path = root / rel
        if not path.exists():
            continue
        text = read_text(path)
        if "# Deprecated" in text[:300]:
            continue
        if report_exists:
            continue
        add_issue(
            issues,
            path,
            "Old structure file still exists without deprecated redirect or legacy upgrade report.",
            "Run migrate_context.py; preserve the file until `_legacy_upgrade_report_<DATE>.md` records why it remains.",
        )


def run(root: Path, require_code_change_linked_req: bool = True) -> int:
    issues: list[Issue] = []
    check_root_structure(root, issues)
    check_requirement_structure(root, issues)

    for req_dir in requirement_dirs(root / "docs" / "requirements"):
        check_trace(req_dir, issues)
        check_trace_verification_coverage(req_dir, issues)
        check_verification_states(req_dir, issues)
        if req_dir.name == "REQ-0000-template":
            continue
        check_unit_test_pass_evidence(req_dir, issues)
        check_verification_claim_evidence(req_dir, issues)
        check_check_failure_completion_claim(req_dir, issues)
        check_task_completion_evidence(req_dir, issues)
        check_dangerous_test_design(req_dir, issues)
        check_current_state_withdrawn_keywords(req_dir, issues)
        check_withdrawn_residuals(req_dir, issues)
        check_legacy_current_state(req_dir, issues)
        check_legacy_used_as_implementation_source(req_dir, issues)

    for fix_path in fix_record_files(root / "docs" / "changes"):
        text = read_text(fix_path)
        try:
            evidence_text = parse_fix_document(fix_path).evidence_text
        except (OSError, ValueError):
            evidence_text = ""
        check_pass_claim_text(fix_path, evidence_text, issues)
        lowered = text.casefold()
        if any(term.casefold() in lowered for term in DANGEROUS_TEST_TERMS):
            claims_pass = any(term in text for term in DANGEROUS_TEST_PASS_TERMS)
            records_guardrail = any(term in text for term in DANGEROUS_TEST_SAFE_TERMS)
            if claims_pass and not records_guardrail:
                add_issue(
                    issues,
                    fix_path,
                    "Potentially unstable or undefined-behavior test is recorded as passing in a Quick Fix.",
                    "Use a controlled mock/fake or upgrade to a full REQ with an evidence-aware verification state.",
                )

    check_forbidden_phrases(root, issues)
    check_old_files(root, issues)
    check_untracked_delivery_evidence(root, issues)
    check_changed_code_has_requirement_update(root, issues, require_code_change_linked_req)

    if issues:
        print("FAIL ai-engineering-context checks")
        print("")
        for idx, issue in enumerate(issues, start=1):
            try:
                display_path = issue.path.relative_to(root)
            except ValueError:
                display_path = issue.path
            print(f"{idx}. {display_path}")
            print(f"   Problem: {issue.message}")
            print(f"   Fix: {issue.suggestion}")
        return 1

    print("PASS ai-engineering-context checks")
    return 0


def check_installation(root: Path) -> int:
    """Check installed entrypoints only; never emit a delivery PASS or inspect Git."""
    problems: list[str] = []
    start = "<!-- ai-engineering-context:start -->"
    end = "<!-- ai-engineering-context:end -->"
    paths = []
    for filename in ("AGENTS.md", "CLAUDE.md"):
        matches = [p for p in root.iterdir() if p.name.casefold() == filename.casefold()]
        if len(matches) != 1:
            problems.append(f"{filename}: expected exactly one case-insensitive file")
        else:
            paths.append(matches[0])
    paths.extend(root / rel for rel in (
        "docs/ai_engineering/README.md",
        "docs/ai_engineering/08_ai_workflow.md",
        "docs/changes/README.md",
    ))
    for path in paths:
        try:
            text = read_text(path)
            rule_markers = list(re.finditer(r"<!--\s*ai-engineering-context:(start|end)(?:\s+version=([A-Za-z0-9_.-]+))?\s*-->", text))
            if path.parent == root:
                signals = re.findall(r"<!--\s*ai-engineering-context:(?:start|end)\b", text)
                if len(rule_markers) != 2 or len(signals) != 2 or [m.group(1) for m in rule_markers] != ["start", "end"] or not rule_markers[0].group(2) or rule_markers[0].group(2) != rule_markers[1].group(2):
                    problems.append(f"{path.name}: invalid or unversioned rule block")
            elif text.count(start) != 1 or text.count(end) != 1 or text.index(start) > text.index(end):
                problems.append(f"{path.relative_to(root)}: invalid managed block")
        except (OSError, UnicodeError) as exc:
            problems.append(f"{path.relative_to(root)}: {exc}")
    for name in ("check_ai_context.py", "sync_requirement_status.py",
                 "collect_delivery_evidence.py", "ai_context_change_records.py",
                 "create_requirement.py", "requirement_source.py"):
        path = root / "scripts" / name
        try:
            compile(read_text(path), str(path), "exec")
        except (OSError, UnicodeError, SyntaxError) as exc:
            problems.append(f"scripts/{name}: {exc}")
    if problems:
        print("INSTALLATION_FAILED: entrypoint/script structure only; not a delivery verdict")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print("INSTALLATION_OK: entrypoint/script structure only; business tests and delivery evidence were NOT checked")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check AI engineering context docs.")
    parser.add_argument("--root", default=".", help="Project root. Defaults to the current working directory.")
    parser.add_argument("--installation-only", action="store_true",
                        help="Check installed entrypoints/scripts only. Never a business-test or delivery verdict; do not use instead of the formal checker.")
    parser.add_argument(
        "--no-git-diff-gate",
        action="store_true",
        help="Compatibility escape hatch: disable the default gate linking changed code/tests/config to one eligible FIX or real REQ. Do not use for delivery.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        print(f"Project root does not exist or is not a directory: {root}", file=sys.stderr)
        return 2
    if args.installation_only:
        return check_installation(root)
    return run(root, require_code_change_linked_req=not args.no_git_diff_gate)


if __name__ == "__main__":
    raise SystemExit(main())
