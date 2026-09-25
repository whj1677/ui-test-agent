# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T10:46:58+08:00`
- Record: `REQ-0015-manual-complex-lab`
- Change fingerprint: `9062b510716aa21d2aeee4bb91ff967359ebdc3f6ee96a1dc273441ed2b594f0`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-reporter=tap manual-lab/verify.test.mjs`
- Exit code: `0`
- Test count: `26`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0015-lab-delivery.log`
- Log SHA-256: `6fb08475229912663201baebe5c2377af1bb001555e663fa61965e73e05fe27a`

### Git Status

```text
 M docs/requirements/README.md
?? docs/requirements/REQ-0015-manual-complex-lab/00_user_requirement.md
?? docs/requirements/REQ-0015-manual-complex-lab/01_development_requirement.md
?? docs/requirements/REQ-0015-manual-complex-lab/02_design.md
?? docs/requirements/REQ-0015-manual-complex-lab/03_tasks.md
?? docs/requirements/REQ-0015-manual-complex-lab/04_verification.md
?? docs/requirements/REQ-0015-manual-complex-lab/05_trace.md
?? docs/requirements/REQ-0015-manual-complex-lab/change_log.md
?? docs/requirements/REQ-0015-manual-complex-lab/current_state.md
?? docs/requirements/REQ-0015-manual-complex-lab/delivery_evidence.md
?? docs/requirements/REQ-0015-manual-complex-lab/requirement.source.json
?? manual-lab/CASES.md
?? manual-lab/GRADING.md
?? manual-lab/README.md
?? manual-lab/SPEC.md
?? manual-lab/VERIFICATION.md
?? manual-lab/cases/01-valid.json
?? manual-lab/cases/02-needs-review.json
?? manual-lab/cases/03-known-defects.json
?? manual-lab/public/index.html
?? manual-lab/serve.mjs
?? manual-lab/start.ps1
?? manual-lab/verify.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
 docs/requirements/README.md | 2 ++
 1 file changed, 2 insertions(+)
```

### Untracked Files

```text
docs/requirements/REQ-0015-manual-complex-lab/00_user_requirement.md
docs/requirements/REQ-0015-manual-complex-lab/01_development_requirement.md
docs/requirements/REQ-0015-manual-complex-lab/02_design.md
docs/requirements/REQ-0015-manual-complex-lab/03_tasks.md
docs/requirements/REQ-0015-manual-complex-lab/04_verification.md
docs/requirements/REQ-0015-manual-complex-lab/05_trace.md
docs/requirements/REQ-0015-manual-complex-lab/change_log.md
docs/requirements/REQ-0015-manual-complex-lab/current_state.md
docs/requirements/REQ-0015-manual-complex-lab/delivery_evidence.md
docs/requirements/REQ-0015-manual-complex-lab/requirement.source.json
manual-lab/CASES.md
manual-lab/GRADING.md
manual-lab/README.md
manual-lab/SPEC.md
manual-lab/VERIFICATION.md
manual-lab/cases/01-valid.json
manual-lab/cases/02-needs-review.json
manual-lab/cases/03-known-defects.json
manual-lab/public/index.html
manual-lab/serve.mjs
manual-lab/start.ps1
manual-lab/verify.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T10:46:38+08:00
Command: node --test --test-reporter=tap manual-lab/verify.test.mjs
Exit code: 0
Parsed test count: 26
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: 24 native-import cases have isolated identities, fixed groups and accurate original oracle
ok 1 - 24 native-import cases have isolated identities, fixed groups and accurate original oracle
  ---
  duration_ms: 306.0253
  type: 'test'
  ...
# Subtest: server exposes only local synthetic routes, never answer files, source or write APIs
ok 2 - server exposes only local synthetic routes, never answer files, source or write APIs
  ---
  duration_ms: 33.3031
  type: 'test'
  ...
# Subtest: V01 homepage navigation exposes 12 assets and 5 first-page rows
ok 3 - V01 homepage navigation exposes 12 assets and 5 first-page rows
  ---
  duration_ms: 695.1606
  type: 'test'
  ...
# Subtest: V02 compound AND filter distinguishes the same-name south device
ok 4 - V02 compound AND filter distinguishes the same-name south device
  ---
  duration_ms: 290.1882
  type: 'test'
  ...
# Subtest: V03 paginated same-name record binds D009, never D001
ok 5 - V03 paginated same-name record binds D009, never D001
  ---
  duration_ms: 1087.5095
  type: 'test'
  ...
# Subtest: V04 tabs preserve D009 identity and specified parameter values
ok 6 - V04 tabs preserve D009 identity and specified parameter values
  ---
  duration_ms: 1161.0018
  type: 'test'
  ...
# Subtest: V05 nested modal blocks background and closes only the top layer
ok 7 - V05 nested modal blocks background and closes only the top layer
  ---
  duration_ms: 1511.3253
  type: 'test'
  ...
# Subtest: V06 querying from later page and resetting restore pagination
ok 8 - V06 querying from later page and resetting restore pagination
  ---
  duration_ms: 320.1102
  type: 'test'
  ...
# Subtest: V07 descending numeric power sort and reset
ok 9 - V07 descending numeric power sort and reset
  ---
  duration_ms: 314.2644
  type: 'test'
  ...
# Subtest: V08 deterministic async read error recovers once with the correct device value
ok 10 - V08 deterministic async read error recovers once with the correct device value
  ---
  duration_ms: 2833.69
  type: 'test'
  ...
# Subtest: V09 inclusive date range returns exactly two matching maintenance rows
ok 11 - V09 inclusive date range returns exactly two matching maintenance rows
  ---
  duration_ms: 1218.0398
  type: 'test'
  ...
# Subtest: closing a loading detail prevents its delayed contents reopening on a new route
ok 12 - closing a loading detail prevents its delayed contents reopening on a new route
  ---
  duration_ms: 1168.406
  type: 'test'
  ...
# Subtest: V10 standard tariff correct non-defect values
ok 13 - V10 standard tariff correct non-defect values
  ---
  duration_ms: 255.9561
  type: 'test'
  ...
# Subtest: V11 conditional tariff help remains nested and keeps the right template
ok 14 - V11 conditional tariff help remains nested and keeps the right template
  ---
  duration_ms: 370.6799
  type: 'test'
  ...
# Subtest: V12 audit pages and result filter reset page position
ok 15 - V12 audit pages and result filter reset page position
  ---
  duration_ms: 303.7788
  type: 'test'
  ...
# Subtest: V13 wizard only creates on submit, uses dynamic id, persists all entered fields
ok 16 - V13 wizard only creates on submit, uses dynamic id, persists all entered fields
  ---
  duration_ms: 488.6101
  type: 'test'
  ...
# Subtest: V14 missing name prevents advancing and leaves seed data alone
ok 17 - V14 missing name prevents advancing and leaves seed data alone
  ---
  duration_ms: 278.9475
  type: 'test'
  ...
# Subtest: V15 step-back preserves all configured values without committing
ok 18 - V15 step-back preserves all configured values without committing
  ---
  duration_ms: 498.768
  type: 'test'
  ...
# Subtest: V16 dirty confirmation keeps data or discards only the draft
ok 19 - V16 dirty confirmation keeps data or discards only the draft
  ---
  duration_ms: 396.8011
  type: 'test'
  ...
# Subtest: V17 duplicate name is rejected at submit with no new persisted record
ok 20 - V17 duplicate name is rejected at submit with no new persisted record
  ---
  duration_ms: 419.9275
  type: 'test'
  ...
# Subtest: wizard keyboard priority, invalid period and escaped business text do not silently submit
ok 21 - wizard keyboard priority, invalid period and escaped business text do not silently submit
  ---
  duration_ms: 433.6998
  type: 'test'
  ...
# Subtest: V18 update and cleanup bind only the newly created record
ok 22 - V18 update and cleanup bind only the newly created record
  ---
  duration_ms: 566.1971
  type: 'test'
  ...
# Subtest: B01 seeded tariff defect is visible; correct 0.38 oracle is never derived from UI
ok 23 - B01 seeded tariff defect is visible; correct 0.38 oracle is never derived from UI
  ---
  duration_ms: 254.4343
  type: 'test'
  ...
# Subtest: B02 seeded frequency defect exists only on D004, not the valid D009
ok 24 - B02 seeded frequency defect exists only on D004, not the valid D009
  ---
  duration_ms: 2140.8076
  type: 'test'
  ...
# Subtest: reload, history navigation and reset preserve isolation from unrelated storage
ok 25 - reload, history navigation and reset preserve isolation from unrelated storage
  ---
  duration_ms: 624.5481
  type: 'test'
  ...
# Subtest: desktop and 375px viewports have bounded layout, keyboard operation and screenshot evidence
ok 26 - desktop and 375px viewports have bounded layout, keyboard operation and screenshot evidence
  ---
  duration_ms: 786.5496
  type: 'test'
  ...
1..26
# tests 26
# suites 0
# pass 26
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 19229.0828
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0015-manual-complex-lab; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

新网站/导入包工程检查26项，不是Agent实测。手册和独立目录说明齐备；后台常驻被策略拒绝且未绕过，用户前台启动。
