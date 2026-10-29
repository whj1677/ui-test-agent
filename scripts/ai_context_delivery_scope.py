"""Validate an explicit delivery against a frozen, preserved working-tree baseline."""

from __future__ import annotations

import base64
import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from ai_context_change_records import git_changes, is_code_or_test_change, safe_project_path


DEFAULT_SCOPE = "docs/ai_engineering/delivery_scope.json"
SCHEMA = "ai-engineering-context/delivery-scope-v1"
BASELINE_SCHEMA = "ai-engineering-context/delivery-baseline-v1"
GENERATED_NAMES = {
    "current_state.md", "00_user_requirement.md", "01_development_requirement.md",
    "02_design.md", "03_tasks.md", "04_verification.md", "05_trace.md",
    "change_log.md", "delivery_evidence.md",
}


@dataclass(frozen=True)
class DeliveryScope:
    path: str
    requirement: str
    selected_paths: tuple[str, ...]
    preserved_count: int
    baseline_sha256: str


def file_sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _relative(value: object) -> str:
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Scope paths must be explicit project-relative POSIX paths.")
    parsed = PurePosixPath(value)
    if parsed.is_absolute() or ":" in value or any(p in {"..", ".git"} for p in parsed.parts) or str(parsed) != value:
        raise ValueError(f"Unsafe or non-canonical delivery path: {value}")
    return value


def _digest(value: object, *, nullable: bool = False) -> str | None:
    if nullable and value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("A delivery digest must be a SHA-256 value.")
    return value


def _project_file(root: Path, rel: str, *, missing: bool = False) -> Path:
    result = safe_project_path(root, _relative(rel), require_file=not missing, allow_missing=missing)
    if result is None or (result.exists() and not result.is_file()):
        raise ValueError(f"Delivery path is missing, linked, or outside the project: {rel}")
    return result


def _git_head(root: Path) -> str:
    result = subprocess.run(["git", "rev-parse", "--verify", "HEAD"], cwd=root,
                            capture_output=True, text=True, timeout=30, check=True)
    return result.stdout.strip()


def load_delivery_scope(root: Path) -> DeliveryScope | None:
    """No declaration keeps the original whole-worktree gate; invalid declarations fail closed."""
    root = root.resolve()
    if not (root / DEFAULT_SCOPE).exists() and not (root / DEFAULT_SCOPE).is_symlink():
        return None
    try:
        declaration = json.loads(_project_file(root, DEFAULT_SCOPE).read_text(encoding="utf-8-sig"))
        if declaration.get("schema") != SCHEMA:
            raise ValueError("Unsupported delivery scope schema.")
        requirement = declaration.get("requirement", "")
        if not re.fullmatch(r"REQ-\d{4}-[A-Za-z0-9][A-Za-z0-9._-]*", requirement) or requirement.startswith("REQ-0000-"):
            raise ValueError("A scope must select one concrete real REQ.")
        req_prefix = f"docs/requirements/{requirement}/"
        _project_file(root, req_prefix + "requirement.source.json")
        baseline_rel = _relative(declaration["baseline"])
        baseline_file = _project_file(root, baseline_rel)
        baseline_sha = _digest(declaration["baseline_sha256"])
        if file_sha256(baseline_file) != baseline_sha:
            raise ValueError("Frozen delivery baseline digest does not match.")
        baseline = json.loads(baseline_file.read_text(encoding="utf-8-sig"))
        if baseline.get("schema") != BASELINE_SCHEMA or baseline.get("git_head") != _git_head(root):
            raise ValueError("Delivery baseline schema or Git HEAD changed.")

        frozen: dict[str, str | None] = {}
        for entry in baseline["files"]:
            rel = _relative(entry["path"])
            if rel in frozen:
                raise ValueError(f"Duplicate baseline path: {rel}")
            frozen[rel] = _digest(entry["sha256"], nullable=True)
        before = baseline.get("owned_before", {})
        selected: list[str] = []
        for entry in declaration["files"]:
            rel = _relative(entry["path"])
            if rel in selected or rel == DEFAULT_SCOPE:
                raise ValueError(f"Duplicate or self-referential scope path: {rel}")
            if rel.startswith("docs/requirements/REQ-") and not rel.startswith(req_prefix):
                raise ValueError(f"A second requirement cannot be owned by this delivery: {rel}")
            previous = frozen.get(rel)
            if rel in before:
                previous_bytes = base64.b64decode(before[rel], validate=True) if before[rel] is not None else None
                previous = hashlib.sha256(previous_bytes).hexdigest() if previous_bytes is not None else None
                if rel in frozen and previous != frozen[rel]:
                    raise ValueError(f"Baseline before-copy differs: {rel}")
            if _digest(entry["before_sha256"], nullable=True) != previous:
                raise ValueError(f"Incorrect before digest: {rel}")
            after_sha = _digest(entry["after_sha256"])
            if previous == after_sha:
                raise ValueError(f"Declared delivery file has no change: {rel}")
            if file_sha256(_project_file(root, rel)) != after_sha:
                raise ValueError(f"Declared delivery file drifted: {rel}")
            selected.append(rel)
        if not any(is_code_or_test_change(p) for p in selected) or req_prefix + "requirement.source.json" not in selected:
            raise ValueError("A scope needs real changed code and its selected requirement source.")

        generated = declaration.get("generated", [])
        for rel in generated:
            rel = _relative(rel)
            if not rel.startswith(req_prefix) or rel[len(req_prefix):] not in GENERATED_NAMES or rel in selected:
                raise ValueError(f"Uncontrolled generated delivery file: {rel}")
            selected.append(rel)
        evidence = declaration.get("evidence_files", [])
        evidence_set: set[str] = set()
        evidence_root = _relative(declaration["evidence_directory"]) + "/"
        if not re.fullmatch(r"workbench/qa/[A-Za-z0-9._-]+/", evidence_root):
            raise ValueError("Evidence must belong to one explicit workbench QA directory.")
        for rel in evidence:
            rel = _relative(rel)
            if not rel.startswith(evidence_root) or Path(rel).suffix not in {".json", ".log", ".txt", ".md", ".png", ".jpg", ".patch"}:
                raise ValueError(f"Evidence cannot hide executable or unrelated files: {rel}")
            if rel in evidence_set or rel in selected or rel in frozen:
                raise ValueError(f"Duplicate or pre-existing evidence exception: {rel}")
            _project_file(root, rel, missing=True)
            evidence_set.add(rel)
        if baseline_rel not in evidence_set:
            raise ValueError("The frozen baseline must be an explicit evidence file.")

        owned = set(selected)
        for rel, expected in frozen.items():
            if rel in owned:
                continue
            current = _project_file(root, rel, missing=expected is None)
            actual = file_sha256(current) if current.is_file() else None
            if actual != expected:
                raise ValueError(f"Preserved working-tree file changed: {rel}")
        changes = git_changes(root)
        if changes is None:
            raise ValueError("Git status is unavailable for delivery scope verification.")
        current_paths = {p for change in changes for p in (change.path, change.original_path) if p}
        unexplained = current_paths - set(frozen) - owned - evidence_set - {DEFAULT_SCOPE}
        if unexplained:
            raise ValueError("New changes outside the declared delivery: " + ", ".join(sorted(unexplained)[:8]))
        return DeliveryScope(DEFAULT_SCOPE, requirement, tuple(selected), len(set(frozen) - owned), baseline_sha)
    except (OSError, KeyError, TypeError, AttributeError, json.JSONDecodeError, subprocess.SubprocessError) as exc:
        raise ValueError(f"Invalid delivery scope: {exc}") from exc
