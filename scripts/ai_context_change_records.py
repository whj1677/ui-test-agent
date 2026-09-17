#!/usr/bin/env python3
"""Shared REQ/Quick Fix discovery, parsing, and path-safety helpers."""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


SCHEMA_API_VERSION = 1
FIX_SCHEMA = "ai-engineering-context/fix-record-v1"
REAL_REQ_PREFIX = "docs/requirements/REQ-"
REQ_TEMPLATE_PREFIX = "docs/requirements/REQ-0000-template/"
LEGACY_REQ_PREFIX = "docs/requirements/REQ-legacy-"
FIX_RECORD_PREFIX = "docs/changes/FIX-"
FIX_TEMPLATE_PATH = "docs/changes/_quick_fix_template.md"
FIX_META_START = "<!-- ai-engineering-context:fix-record:start -->"
FIX_META_END = "<!-- ai-engineering-context:fix-record:end -->"
EVIDENCE_START = "<!-- ai-engineering-context:evidence:start -->"
EVIDENCE_END = "<!-- ai-engineering-context:evidence:end -->"

FIX_ID_PATTERN = re.compile(r"FIX-\d{8}-\d{3}(?:-[A-Za-z0-9][A-Za-z0-9-]*)?")
REQ_ID_PATTERN = re.compile(r"REQ-[A-Za-z0-9][A-Za-z0-9._-]*")

CODE_CHANGE_DIRS = {
    "app", "apps", "cache", "cmd", "commands", "common", "config",
    "executors", "functions", "helpers", "internal", "lib", "network",
    "packages", "pkg", "referees", "router", "scripts", "services",
    "session", "shells", "src", "steps", "test", "tests",
}
CODE_CHANGE_SUFFIXES = {
    ".avsc", ".c", ".cc", ".cfg", ".cmake", ".conf", ".cpp", ".cs", ".css",
    ".go", ".graphql", ".graphqls", ".h", ".hpp", ".html", ".java", ".js", ".json", ".jsx",
    ".ini", ".kt", ".lua", ".mjs", ".php", ".ps1", ".py", ".rs", ".sh",
    ".properties", ".proto", ".sql", ".swift", ".toml", ".ts", ".tsx", ".vue", ".yaml", ".yml",
}
CODE_CHANGE_FILENAMES = {
    "Cargo.lock", "Cargo.toml", "CMakeLists.txt", "Dockerfile", "Gemfile",
    "Gemfile.lock", "Makefile", "Pipfile", "Pipfile.lock", "application.properties",
    "application.yaml", "application.yml", "build.gradle", "build.gradle.kts",
    "composer.json", "composer.lock", "docker-compose.yml", "go.mod", "go.sum",
    "gradlew", "gradlew.bat", "mvnw", "mvnw.cmd", "package-lock.json",
    "package.json", "pnpm-lock.yaml", "pom.xml", "pyproject.toml", "openapi.json",
    "openapi.yaml", "openapi.yml", "requirements-dev.txt", "requirements.txt",
    "setup.cfg", "setup.py", "settings.gradle", "settings.gradle.kts", "tox.ini",
    "uv.lock", "vite.config.js", "vite.config.mjs", "vite.config.ts", "yarn.lock",
}
CODE_CHANGE_FILENAMES_CASEFOLD = {name.casefold() for name in CODE_CHANGE_FILENAMES}
AI_CONTEXT_SCRIPT_PATHS = {
    "scripts/ai_context_change_records.py",
    "scripts/check_ai_context.py",
    "scripts/collect_delivery_evidence.py",
    "scripts/create_requirement.py",
    "scripts/requirement_source.py",
    "scripts/sync_requirement_status.py",
}
IGNORED_CHANGE_PARTS = {
    ".git", ".mypy_cache", ".nox", ".pytest_cache", ".ruff_cache", ".tox",
    ".venv", "__pycache__", "build", "dist", "htmlcov", "node_modules",
    "site-packages", "target", "venv",
}

QUICK_FIX_BLOCKED_PARTS = {
    ".github", "auth", "authentication", "authorization", "billing", "ci",
    "concurrency", "contracts", "crypto",
    "deploy", "deployment", "finance", "infra", "infrastructure", "locking",
    "migrations", "openapi", "payment", "payments", "permission", "permissions",
    "privacy", "proto", "protocol", "protocols", "release", "safety", "schema",
    "schemas", "security", "threading", "workflows",
}
QUICK_FIX_BLOCKED_SUFFIXES = {
    ".avsc", ".graphql", ".graphqls", ".ini", ".properties", ".proto", ".sql",
}
QUICK_FIX_BLOCKED_FILENAMES = {
    "auth.py",
    "authentication.py",
    "authorization.py",
    "config.py",
    "protocol.py",
    "security.py",
}
QUICK_FIX_BLOCKED_FILE_STEMS = {
    "auth", "authentication", "authorization", "billing", "concurrency",
    "config", "crypto", "migration", "openapi", "payment", "payments",
    "permission", "permissions", "privacy", "protocol", "safety", "schema",
    "security", "threading",
}

FIX_REQUIRED_METADATA = {
    "Schema",
    "ID",
    "分级",
    "实现状态",
    "验证状态",
    "影响模块",
    "预期行为依据",
    "变更性质",
    "公共接口/协议/数据结构/配置语义变更",
    "依赖/构建变更",
    "安全/权限/隐私/计费/迁移/关键并发",
    "跨模块行为变更",
    "人工待确认项",
    "模块文档处理",
}
FIX_ELIGIBILITY_LABELS = (
    "有当前有效需求、测试、接口文档或缺陷证据证明已有期望行为",
    "只恢复已有行为，不新增或调整产品语义",
    "根因已经确认，不依赖猜测或偶现副作用",
    "影响仅限单一模块，调用影响明确",
    "实施前已列出精确变更文件，且没有无关修改",
    "存在确定、可重复的自动化回归验证方式",
    "不涉及 API、协议、schema、配置语义、依赖或构建、安全或权限、迁移、关键并发、跨模块行为",
    "无人工待确认项，且回滚方式明确",
)
PLACEHOLDER_TERMS = (
    "待补充",
    "人工待确认",
    "TBD",
    "TODO",
    "必须填写",
    "必须写明",
    "根因必须",
    "当前有效需求、现有测试、接口文档或可复核缺陷证据",
)


@dataclass(frozen=True)
class GitChange:
    status: str
    path: str
    original_path: str | None = None


@dataclass(frozen=True)
class ChangeRecord:
    kind: str
    identifier: str
    path: Path


@dataclass(frozen=True)
class FixDocument:
    path: Path
    text: str
    metadata: dict[str, str]
    declared_paths: tuple[str, ...]
    eligibility: dict[str, str]
    eligibility_evidence: dict[str, str]
    evidence_text: str


def _decode_git_path(raw: bytes) -> str:
    return raw.decode("utf-8", errors="replace").replace("\\", "/")


def git_changes(root: Path) -> list[GitChange] | None:
    """Read porcelain-v1 -z output so spaces, quotes, Unicode and renames are safe."""

    try:
        result = subprocess.run(
            ["git", "-c", "core.quotepath=false", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
            cwd=str(root),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None

    fields = result.stdout.split(b"\0")
    changes: list[GitChange] = []
    index = 0
    while index < len(fields):
        field = fields[index]
        index += 1
        if not field:
            continue
        if len(field) < 4:
            continue
        status = field[:2].decode("ascii", errors="replace")
        path = _decode_git_path(field[3:])
        original: str | None = None
        if "R" in status or "C" in status:
            if index < len(fields) and fields[index]:
                original = _decode_git_path(fields[index])
                index += 1
        changes.append(GitChange(status=status, path=path, original_path=original))
    return changes


def run_git_status(root: Path) -> list[str] | None:
    """Compatibility rendering for callers that only need status and current path."""

    changes = git_changes(root)
    if changes is None:
        return None
    return [f"{change.status} {change.path}" for change in changes]


def changed_path_from_status_line(line: str) -> str:
    path = line[3:].strip()
    if " -> " in path:
        path = path.split(" -> ", 1)[1].strip()
    return path.replace("\\", "/").strip('"')


def changed_paths(root: Path) -> list[str] | None:
    changes = git_changes(root)
    if changes is None:
        return None
    # Porcelain rename/copy entries carry both the new path and original path.
    # Include both so a risky source name cannot be hidden by renaming it and so
    # exact-file declarations/fingerprints describe the whole behavior change.
    paths: list[str] = []
    for change in changes:
        if change.original_path:
            paths.append(change.original_path)
        if change.path:
            paths.append(change.path)
    return list(dict.fromkeys(paths))


def code_change_fingerprint(root: Path, paths: list[str] | None = None) -> str:
    """Hash current behavior-file paths and bytes, excluding governance/evidence files."""

    selected = paths if paths is not None else (changed_paths(root) or [])
    digest = hashlib.sha256()
    for rel in sorted({path for path in selected if is_code_or_test_change(path)}):
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        path = root / rel
        if path.is_symlink():
            digest.update(b"<symlink>")
            try:
                digest.update(os.readlink(path).encode("utf-8", errors="replace"))
            except OSError:
                digest.update(b"<unreadable-link>")
        elif path.is_file():
            try:
                digest.update(path.read_bytes())
            except OSError:
                digest.update(b"<unreadable>")
        else:
            digest.update(b"<deleted-or-non-file>")
        digest.update(b"\0")
    return digest.hexdigest()


def is_real_requirement_change(path: str) -> bool:
    return (
        path.startswith(REAL_REQ_PREFIX)
        and not path.startswith(REQ_TEMPLATE_PREFIX)
        and not path.startswith(LEGACY_REQ_PREFIX)
    )


def is_fix_record_change(path: str) -> bool:
    if not path.startswith(FIX_RECORD_PREFIX) or not path.endswith(".md"):
        return False
    tail = path[len("docs/changes/"):]
    return "/" not in tail and bool(FIX_ID_PATTERN.fullmatch(Path(tail).stem))


def is_code_or_test_change(path: str) -> bool:
    if not path or path.startswith(".git/"):
        return False
    if path.startswith(("docs/", "docs-locale/", "assets/")):
        return False
    if path in {"AGENTS.md", "CLAUDE.md", "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "LICENSE", "NOTICE"}:
        return False
    parts = path.split("/")
    if any(part in IGNORED_CHANGE_PARTS for part in parts):
        return False
    first = parts[0] if parts else ""
    name = parts[-1] if parts else path
    folded_name = name.casefold()
    if folded_name in CODE_CHANGE_FILENAMES_CASEFOLD:
        return True
    if re.fullmatch(r"requirements(?:[-_.][^/]+)?\.txt", folded_name):
        return True
    suffix = Path(name).suffix.lower()
    return suffix in CODE_CHANGE_SUFFIXES or (first in CODE_CHANGE_DIRS and not suffix)


def project_code_files(root: Path, limit: int = 20) -> list[str]:
    """Find project code/test/config files when Git cannot provide a diff.

    This is a fail-closed probe, not a synthetic change set. Documentation,
    generated output, and dependency caches are excluded. Governance scripts
    remain code here; only the checker can grant a narrowly proven fresh-
    bootstrap exception from actual Git status.
    """

    found: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        directory = Path(dirpath)
        try:
            rel_dir = directory.relative_to(root).as_posix()
        except ValueError:
            continue
        dirnames[:] = [
            name
            for name in dirnames
            if name not in IGNORED_CHANGE_PARTS
            and (f"{rel_dir}/{name}" if rel_dir != "." else name)
            not in {"docs", "docs-locale", "assets"}
        ]
        for filename in filenames:
            path = directory / filename
            try:
                rel = path.relative_to(root).as_posix()
            except ValueError:
                continue
            if is_code_or_test_change(rel):
                found.append(rel)
                if len(found) >= limit:
                    return found
    return found


def requirement_dirs(requirements_dir: Path, include_legacy: bool = False) -> list[Path]:
    if not requirements_dir.exists():
        return []
    result = []
    for path in requirements_dir.iterdir():
        if path.is_symlink() or not path.is_dir() or not path.name.startswith("REQ-") or path.name == "REQ-0000-template":
            continue
        if path.name.startswith("REQ-legacy-") and not include_legacy:
            continue
        result.append(path)
    return sorted(result)


def fix_record_files(changes_dir: Path) -> list[Path]:
    if not changes_dir.exists():
        return []
    return sorted(
        path
        for path in changes_dir.glob("FIX-*.md")
        if not path.is_symlink() and path.is_file() and FIX_ID_PATTERN.fullmatch(path.stem)
    )


def changed_requirement_dirs(root: Path, paths: list[str]) -> list[Path]:
    dirs: dict[str, Path] = {}
    for rel in paths:
        if not is_real_requirement_change(rel):
            continue
        parts = rel.split("/")
        if len(parts) >= 3:
            path = resolve_req(root, parts[2])
            if path is not None:
                dirs[parts[2]] = path
    return sorted(dirs.values())


def changed_fix_records(root: Path, paths: list[str]) -> list[Path]:
    files: dict[str, Path] = {}
    for rel in paths:
        if not is_fix_record_change(rel):
            continue
        path = resolve_fix(root, Path(rel).stem)
        if path is not None:
            files[path.stem] = path
    return sorted(files.values())


def resolve_req(root: Path, identifier: str) -> Path | None:
    if not REQ_ID_PATTERN.fullmatch(identifier):
        return None
    if identifier == "REQ-0000-template" or identifier.startswith("REQ-legacy-"):
        return None
    req_root_candidate = root / "docs" / "requirements"
    if path_has_symlink_component(root, req_root_candidate):
        return None
    req_root = req_root_candidate.resolve()
    candidate = req_root / identifier
    if path_has_symlink_component(root, candidate):
        return None
    path = candidate.resolve()
    if path.parent != req_root or not path.is_dir():
        return None
    return path


def resolve_fix(root: Path, identifier: str) -> Path | None:
    stem = identifier[:-3] if identifier.endswith(".md") else identifier
    if not FIX_ID_PATTERN.fullmatch(stem):
        return None
    changes_root_candidate = root / "docs" / "changes"
    if path_has_symlink_component(root, changes_root_candidate):
        return None
    changes_root = changes_root_candidate.resolve()
    candidate = changes_root / f"{stem}.md"
    if path_has_symlink_component(root, candidate):
        return None
    path = candidate.resolve()
    if path.parent != changes_root or not path.is_file():
        return None
    return path


def quick_fix_block_reason(path: str) -> str | None:
    normalized = path.replace("\\", "/")
    parts = {part.lower() for part in normalized.split("/")}
    name = Path(normalized).name
    folded_name = name.casefold()
    folded_stem = Path(name).stem.casefold()
    suffix = Path(name).suffix.lower()
    if folded_name in QUICK_FIX_BLOCKED_FILENAMES or folded_stem in QUICK_FIX_BLOCKED_FILE_STEMS:
        return f"high-risk filename detected: {name}"
    if (
        folded_name.startswith(("config.", "openapi.", "application."))
        or ".config." in folded_name
    ):
        return f"configuration or API-contract filename detected: {name}"
    if folded_name in CODE_CHANGE_FILENAMES_CASEFOLD or re.fullmatch(
        r"requirements(?:[-_.][^/]+)?\.txt", folded_name
    ):
        return "build, dependency, or release configuration changed"
    blocked = sorted(parts & QUICK_FIX_BLOCKED_PARTS)
    if blocked:
        return f"high-risk path segment detected: {blocked[0]}"
    if suffix in QUICK_FIX_BLOCKED_SUFFIXES:
        return f"high-risk file type detected: {suffix}"
    return None


def _single_block(text: str, start: str, end: str) -> str:
    if text.count(start) != 1 or text.count(end) != 1:
        return ""
    start_index = text.index(start) + len(start)
    end_index = text.index(end, start_index)
    return text[start_index:end_index].strip()


def _parse_metadata(block: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in block.splitlines():
        cleaned = re.sub(r"^\s*[-*+]\s*", "", line.strip()).replace("**", "").replace("`", "")
        match = re.match(r"^([^:：]+?)\s*[:：]\s*(.*?)\s*$", cleaned)
        if match:
            values[match.group(1).strip()] = match.group(2).strip()
    return values


def _section(text: str, title: str) -> str:
    pattern = rf"^##\s+{re.escape(title)}\s*$([\s\S]*?)(?=^##\s+|\Z)"
    match = re.search(pattern, text, flags=re.MULTILINE)
    return match.group(1) if match else ""


def parse_fix_document(path: Path) -> FixDocument:
    # Governance records are rewritten by sync/collector. Invalid bytes must
    # fail closed so a write cannot silently replace user content with U+FFFD.
    text = path.read_text(encoding="utf-8-sig")
    metadata = _parse_metadata(_single_block(text, FIX_META_START, FIX_META_END))
    declared: list[str] = []
    for line in _section(text, "精确变更文件").splitlines():
        match = re.match(r"^\s*[-*+]\s+`?([^`]+?)`?\s*$", line)
        if match:
            declared.append(match.group(1).strip().replace("\\", "/"))

    eligibility: dict[str, str] = {}
    eligibility_evidence: dict[str, str] = {}
    eligibility_section = _section(text, "G1 资格检查") or _section(text, "Quick Fix 资格检查")
    header_indexes: tuple[int, int, int | None] | None = None
    for line in eligibility_section.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [cell.strip().replace("`", "") for cell in line.strip().strip("|").split("|")]
        if "结论" in cells and ("资格项" in cells or "条件" in cells):
            label_name = "资格项" if "资格项" in cells else "条件"
            evidence_index = cells.index("证据") if "证据" in cells else None
            header_indexes = (cells.index(label_name), cells.index("结论"), evidence_index)
            continue
        if not header_indexes or all(not cell or set(cell) <= {"-", ":"} for cell in cells):
            continue
        label_index, conclusion_index, evidence_index = header_indexes
        if label_index < len(cells) and conclusion_index < len(cells):
            label = cells[label_index]
            eligibility[label] = cells[conclusion_index]
            eligibility_evidence[label] = (
                cells[evidence_index] if evidence_index is not None and evidence_index < len(cells) else ""
            )

    return FixDocument(
        path=path,
        text=text,
        metadata=metadata,
        declared_paths=tuple(dict.fromkeys(declared)),
        eligibility=eligibility,
        eligibility_evidence=eligibility_evidence,
        evidence_text=_single_block(text, EVIDENCE_START, EVIDENCE_END),
    )


def replace_managed_block(text: str, start: str, end: str, body: str) -> str:
    block = f"{start}\n{body.strip()}\n{end}"
    if start in text or end in text:
        if text.count(start) != 1 or text.count(end) != 1:
            raise ValueError("managed block markers are missing or duplicated")
        start_index = text.index(start)
        end_index = text.index(end, start_index) + len(end)
        return text[:start_index] + block + text[end_index:]
    suffix = "" if text.endswith("\n") else "\n"
    return text + suffix + "\n" + block + "\n"


def has_placeholder(value: str) -> bool:
    cleaned = value.strip().strip("`").strip()
    if not cleaned:
        return True
    if re.search(r"<[^>\r\n]+>", cleaned):
        return True
    return any(term.casefold() in cleaned.casefold() for term in PLACEHOLDER_TERMS)


def path_has_symlink_component(root: Path, candidate: Path) -> bool:
    """Return True when candidate escapes root lexically or traverses any symlink."""

    root_resolved = root.resolve()
    candidate_absolute = Path(os.path.abspath(os.fspath(candidate)))
    try:
        relative = candidate_absolute.relative_to(root_resolved)
    except ValueError:
        return True
    current = root_resolved
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            return True
    return False


def safe_project_path(
    root: Path,
    value: str | Path,
    *,
    require_file: bool = False,
    allow_missing: bool = False,
) -> Path | None:
    """Resolve a project-local path without following symlink components."""

    candidate_value = Path(value)
    if candidate_value.is_absolute():
        candidate = candidate_value
    else:
        candidate = root / candidate_value
    if path_has_symlink_component(root, candidate):
        return None
    resolved = candidate.resolve(strict=False)
    try:
        resolved.relative_to(root.resolve())
    except ValueError:
        return None
    if require_file and (not resolved.is_file() or resolved.is_symlink()):
        return None
    if not allow_missing and not require_file and not resolved.exists():
        return None
    return resolved
