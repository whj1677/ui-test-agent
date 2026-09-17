#!/usr/bin/env python3
"""Create one requirement package from the installed project template."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
import uuid
from pathlib import Path
from typing import Any

from requirement_source import GENERATED_FILES, SOURCE_FILE, render_package, validate_source


REQUIRED_FILES = GENERATED_FILES
REQ_NAME = re.compile(r"^REQ-(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def next_identifier(requirements_dir: Path) -> str:
    numbers = []
    for path in requirements_dir.iterdir():
        match = REQ_NAME.fullmatch(path.name) if path.is_dir() else None
        if match and path.name != "REQ-0000-template":
            numbers.append(int(match.group(1)))
    return f"REQ-{max(numbers, default=0) + 1:04d}"


def _replace_template_values(value: Any, req_id: str, title: str) -> Any:
    if isinstance(value, str):
        number = req_id.removeprefix("REQ-")
        return (
            value.replace("REQ-0000", req_id)
            .replace("-0000-", f"-{number}-")
            .replace("<DATE>", dt.date.today().isoformat())
            .replace("<TITLE>", title)
        )
    if isinstance(value, list):
        return [_replace_template_values(item, req_id, title) for item in value]
    if isinstance(value, dict):
        return {key: _replace_template_values(item, req_id, title) for key, item in value.items()}
    return value


def render_template(template_dir: Path, destination: Path, req_id: str, title: str) -> None:
    source_template = template_dir / SOURCE_FILE
    if source_template.is_symlink() or not source_template.is_file():
        raise ValueError(f"invalid requirement source template: {source_template}")
    try:
        source = json.loads(source_template.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid requirement source template JSON: {exc}") from exc
    source = _replace_template_values(source, req_id, title)
    validate_source(source, destination.name)
    destination.mkdir(parents=False, exist_ok=False)
    try:
        (destination / SOURCE_FILE).write_text(
            json.dumps(source, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        render_package(destination)
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise


def add_index_row(index_path: Path, package_name: str, title: str) -> None:
    original = index_path.read_text(encoding="utf-8")
    if f"`{package_name}`" in original:
        raise ValueError(f"requirement index already contains {package_name}")
    lines = original.splitlines(keepends=True)
    section_start = next(
        (index for index, line in enumerate(lines) if line.strip() == "## 需求列表"), None
    )
    if section_start is None:
        raise ValueError("requirements index has no `## 需求列表` section")
    section_end = next(
        (index for index in range(section_start + 1, len(lines)) if lines[index].startswith("## ")),
        len(lines),
    )
    table_rows = [
        index
        for index in range(section_start + 1, section_end)
        if lines[index].lstrip().startswith("|")
    ]
    if len(table_rows) < 2:
        raise ValueError("requirements index has no compatible requirement table")
    newline = "\r\n" if "\r\n" in original else "\n"
    row = (
        f"| `{package_name}` | 人工待确认 | `{package_name}/current_state.md` | {title} |{newline}"
    )
    lines.insert(table_rows[-1] + 1, row)
    temporary = index_path.with_name(f".{index_path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text("".join(lines), encoding="utf-8", newline="")
        temporary.replace(index_path)
    finally:
        temporary.unlink(missing_ok=True)


def create(target: Path, title: str, slug: str, update_index: bool) -> tuple[str, Path]:
    if not title.strip():
        raise ValueError("title must not be empty")
    if not SLUG.fullmatch(slug):
        raise ValueError("slug must use lowercase ASCII letters, digits, and single hyphens")
    requirements_dir = target / "docs" / "requirements"
    template_dir = requirements_dir / "REQ-0000-template"
    if not requirements_dir.is_dir() or template_dir.is_symlink() or not template_dir.is_dir():
        raise ValueError("installed requirement template is missing or unsafe")
    if not (template_dir / SOURCE_FILE).is_file():
        raise ValueError(f"requirement source template is missing: {SOURCE_FILE}")
    req_id = next_identifier(requirements_dir)
    package_name = f"{req_id}-{slug}"
    destination = requirements_dir / package_name
    if destination.exists():
        raise FileExistsError(destination)
    index_path = requirements_dir / "README.md"
    if update_index:
        # Validate before creating the package so incompatible custom indexes fail closed.
        index_text = index_path.read_text(encoding="utf-8")
        if "## 需求列表" not in index_text or f"`{package_name}`" in index_text:
            raise ValueError("requirements index cannot be updated safely")
    render_template(template_dir, destination, req_id, title.strip())
    try:
        if update_index:
            add_index_row(index_path, package_name, title.strip())
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise
    return package_name, destination


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", default=".", help="project root")
    parser.add_argument("--title", required=True, help="human-readable requirement title")
    parser.add_argument("--slug", required=True, help="lowercase ASCII directory slug")
    parser.add_argument("--update-index", action="store_true", help="append one row to docs/requirements/README.md")
    parser.add_argument("--mode", choices=("preview", "create"), default="preview")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    target = Path(args.target).expanduser().resolve()
    try:
        requirements_dir = target / "docs" / "requirements"
        req_id = next_identifier(requirements_dir)
        package_name = f"{req_id}-{args.slug}"
        if not SLUG.fullmatch(args.slug):
            raise ValueError("slug must use lowercase ASCII letters, digits, and single hyphens")
        if args.mode == "preview":
            print(f"REQ_PACKAGE_READY: {package_name}; no files written")
            return 0
        created_name, destination = create(target, args.title, args.slug, args.update_index)
        print(f"REQ_PACKAGE_CREATED: {created_name}; source=1; generated_views={len(REQUIRED_FILES)}; path={destination}")
        return 0
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"REQ_PACKAGE_BLOCKED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
