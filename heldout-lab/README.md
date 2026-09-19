# Independent held-out inspection ledger — v1

Kimi authored the new single-page UI and eight cases from a standalone synthetic specification. Its isolated authoring session had no repository, product source, earlier cases, runtime logs, credentials, tools or subagents. Codex reviewed the complete result before any product run. This is a held-out synthetic family, not proof of arbitrary business-site support.

## Normative specification

Fixed origin: `http://localhost:4198`. Home heading: 调度总览; no login or accounts. Eight neutral workspace links lead to `/probe/q1,q2,f1,f2,m1,m2,s1,s2`. Native GET query controls: 关键词、所属站点、任务类型、排序; input alone does not apply filters, query combines them by AND and returns page1; reset restores defaults. Three rows per page, default identifier ascending, twelve records:

|ID|Station|Type|Power kW|
|---|---|---|---:|
|H101|东站|巡检|80|
|H102|西站|检修|120|
|H103|东站|检修|60|
|H104|西站|巡检|95|
|H105|东站|巡检|140|
|H106|西站|检修|220|
|H107|东站|检修|300|
|H108|西站|巡检|40|
|H109|东站|巡检|180|
|H110|西站|检修|110|
|H111|东站|检修|260|
|H112|西站|巡检|200|

H102/H106 share the name 循环泵. H106 details load after500ms; dialog 巡检详情 has its own H106 heading. Basic definition fields are 循环泵/西站/220 kW; independent historical note also contains220 kW as a distractor. 作业参数 has9天/65℃. Nested 采样说明 says 每90秒采样. Closing dialogs preserves query/page state. No persistence, write APIs, credentials or external dependencies.

Four normal/defect pairs share the same human oracle. Q: 西站 AND 检修 gives H102/H106/H110; q2 intentionally ignores type. F: H106 actual power220 kW; f2 shows320 kW only in that field, history stays220. M: close child then verify parent close button visible/enabled/unobstructed before clicking; m2 creates a near-transparent pointer interceptor. S: power-desc page1 H107300/H111260/H106220, page2 H112200/H109180/H105140; s2 swaps only the second and third descending positions.

## Pre-freeze author corrections (not responses to Agent failures)

- Route options were initially calculated once, making SPA menu entry lose defects; recompute on every render and clear saved dialog view before route changes.
- Correct overview sum1935→1805 using the normative values above.
- Remove invented final DOM assertions about absence of writes/storage/network traces; retain those as environment/permission constraints and verify independently. Remove an instruction about what not to assert from M expected text. No query, identity, field, modal, obstruction or ordering obligation removed.
- Keep500ms fixture loading, but human tests wait for completion instead of an invented approximate latency deadline.
- Clarify input-only unchanged first-page rows H101/H102/H103 from the seed; no values derived from product behavior.
- Mechanically repaired six invalid JSON apostrophe escapes in author output before extracting HTML; same intended JavaScript strings.

Draft reference18 checks passed before freeze; final tracked reference rerun recorded in REQ-0017. Checks include direct/menu entries, all seed values, AND contrast, repeated names, field/history distinction, nested five-point obstruction, sort/page contrast and route-back state. Reference tests and screenshots are not Agent acceptance. Offline `oracle.json` and reference locators are never included in model input. Server exposes only frozen HTML routes and health, not cases/oracle/source.

After manifest freeze, do not alter page/cases/oracle to make an Agent failure disappear. Preserve the original32-case suite independently. Run product tests through `node scripts/autonomous-lab.mjs --real-model --suite=heldout`; recorded status needs separate source/timing/defect-target review.
