"""Read traditional case sheets or the five-sheet excel-testcase-workflow layout.

Keep source rows/cells verbatim. Auxiliary/pending sheets are data, never Oracles
for formal cases. This reader does not infer UI actions or execute workbook code.
"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
try:
    import openpyxl
except ImportError as exc:
    raise SystemExit("XLSX_DEPENDENCY_MISSING: install openpyxl (pip install openpyxl)") from exc

if len(sys.argv) not in (2, 3):
    raise SystemExit("Usage: portable_xlsx_rows.py INPUT.xlsx [SHEET]")
book = openpyxl.load_workbook(sys.argv[1], data_only=False)


def populated(sheet):
    return any(value not in (None, "") for row in sheet.iter_rows(values_only=True) for value in row)


def read_sheet(sheet, allow_empty=False):
    rows = list(sheet.iter_rows(values_only=True))
    if not populated(sheet):
        if allow_empty:
            return {"sheet": sheet.title, "headers": [], "rows": [], "row_sources": [], "header_row": None}
        raise SystemExit("XLSX_SHEET_EMPTY")
    # Only the known producer layout (or an actual named table) may move headers.
    header_row = 1
    named_table = None
    tables = list(sheet.tables.values())
    known = sheet.title in {"测试用例", "待确认用例", "测试数据", "覆盖与追溯", "审查记录"}
    if known and len(rows) >= 5 and rows[4][0] in {"用例编号", "数据编号", "记录类型"}:
        header_row = 5
    elif tables:
        candidates = [t for t in tables if t.headerRowCount != 0]
        if len(candidates) != 1:
            raise SystemExit("XLSX_TABLE_SELECTION_REQUIRED")
        table = candidates[0]
        min_col, min_row, max_col, max_row = openpyxl.utils.range_boundaries(table.ref)
        if min_col != 1:
            raise SystemExit("XLSX_TABLE_ORIGIN_UNSUPPORTED")
        header_row = min_row
        named_table = table.name
    headers = [str(value).strip() if value is not None else "" for value in rows[header_row - 1]]
    if not any(headers):
        raise SystemExit("XLSX_HEADER_MISSING")
    named_headers = [h.casefold() for h in headers if h]
    if len(named_headers) != len(set(named_headers)):
        raise SystemExit("XLSX_DUPLICATE_HEADER")
    if any(not h and any(values[i] not in (None, "") for values in rows[header_row:] if i < len(values)) for i, h in enumerate(headers)):
        raise SystemExit("XLSX_UNNAMED_DATA_COLUMN")
    result, sources = [], []
    for number, values in enumerate(rows[header_row:], header_row + 1):
        row = {headers[i]: value for i, value in enumerate(values) if headers[i]}
        if any(value not in (None, "") for value in row.values()):
            result.append(row)
            sources.append({"sheet": sheet.title, "row": number, "cells": {h: f"{openpyxl.utils.get_column_letter(i + 1)}{number}" for i, h in enumerate(headers) if h}})
    if not result and not allow_empty:
        raise SystemExit("XLSX_ROWS_MISSING")
    return {"sheet": sheet.title, "header_row": header_row, "named_table": named_table, "headers": [h for h in headers if h], "rows": result, "row_sources": sources}


try:
    selected = sys.argv[2] if len(sys.argv) == 3 else None
    if selected and selected not in book.sheetnames:
        raise SystemExit("XLSX_SHEET_UNKNOWN")
    producer = all(name in book.sheetnames for name in ["测试用例", "测试数据", "待确认用例"])
    if producer and selected not in (None, "测试用例", "待确认用例"):
        raise SystemExit("XLSX_CASE_SHEET_REQUIRED")
    sheet = book[selected] if selected else book["测试用例"] if producer else next((s for s in book.worksheets if populated(s)), None)
    if sheet is None:
        raise SystemExit("XLSX_SHEET_EMPTY")
    if producer:
        case_sheets = [read_sheet(book[name], True) for name in ["测试用例", "待确认用例"]]
        if not any(s["rows"] for s in case_sheets):
            raise SystemExit("XLSX_ROWS_MISSING")
        result = {**case_sheets[0], "source_layout": "excel-testcase-workflow/v1", "case_sheets": case_sheets,
                  "auxiliary_sheets": [read_sheet(s, True) for s in book.worksheets if s.title not in {"测试用例", "待确认用例"}],
                  "workbook_side": "api" if " API " in str(book["测试用例"]["A1"].value) else "ui",
                  "selection_note": "Both formal and pending case sheets retained; pending cases are not executable."}
    else:
        result = {**read_sheet(sheet), "source_layout": "traditional", "unselected_sheets": [s.title for s in book.worksheets if s.title != sheet.title]}
    print(json.dumps(result, ensure_ascii=False, default=str))
finally:
    book.close()
