# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-25T17:13:28+08:00`
- Record: `REQ-0036-ui-ux-01-workbench-usability-review`
- Change fingerprint: `2ef2540fef146d582c830e5e6152dc8af05cc2de3d6dcf70032b6656e7b95c96`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs`
- Exit code: `0`
- Test count: `20`
- Failure count: `0`
- Skipped count: `0`
- Log path: `workbench/qa/20260925-v21/repair-engineering-tests.log`
- Log SHA-256: `464e25e18ab492f036a30f3947679d645fa23c7585dc414592aa538aca029237`

### Git Status

```text
 M docs/modules/test-workbench.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/00_user_requirement.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/02_design.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/03_tasks.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/04_verification.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/05_trace.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/change_log.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/current_state.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/delivery_evidence.md
 M docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/requirement.source.json
 M workbench/qa/20260925-v21/REPORT.md
?? docs/需求/02-case-library.png
?? docs/需求/04-case-evidence.png
?? docs/需求/ALL_SCREENS.png
?? docs/需求/CODEX_IMPLEMENTATION.md
?? docs/需求/DESIGN_OVERVIEW.png
?? docs/需求/UI_DESIGN_SPEC_V2.md
?? docs/需求/index.html
?? workbench/docs/ui-workflow-proposal/01-case-library.png
?? workbench/docs/ui-workflow-proposal/02-case-detail.png
?? workbench/docs/ui-workflow-proposal/03-rerun-confirm.png
?? workbench/docs/ui-workflow-proposal/04-batch-results.png
?? workbench/docs/ui-workflow-proposal/05-script-panel.png
?? workbench/docs/ui-workflow-proposal/README.md
?? workbench/docs/ui-workflow-proposal/index.html
?? workbench/qa/20260925-v21/repair-auto-check.txt
?? workbench/qa/20260925-v21/repair-baseline.json
?? workbench/qa/20260925-v21/repair-card-before.txt
?? workbench/qa/20260925-v21/repair-card-final.json
?? workbench/qa/20260925-v21/repair-card-started.txt
?? workbench/qa/20260925-v21/repair-crosspage-preview.txt
?? workbench/qa/20260925-v21/repair-engineering-tests.log
?? workbench/qa/20260925-v21/repair-failed-result.png
?? workbench/qa/20260925-v21/repair-failed-result.txt
?? workbench/qa/20260925-v21/repair-media-single.json
?? workbench/qa/20260925-v21/repair-media-switched.json
?? workbench/qa/20260925-v21/repair-preflight-failure.txt
?? workbench/qa/20260925-v21/repair-preflight.png
?? workbench/qa/20260925-v21/repair-project-before.txt
?? workbench/qa/20260925-v21/repair-project-preflight.txt
?? workbench/qa/20260925-v21/repair-return-page2.txt
?? workbench/qa/20260925-v21/repair-selected-before.txt
?? workbench/qa/20260925-v21/repair-single-result.txt
?? workbench/qa/20260925-v21/repair-start-busy.txt
?? workbench/qa/20260925-v21/repair-top-before.txt
?? workbench/qa/20260925-v21/repair-verification.json
?? workbench/qa/20260925-v21/verify-repair.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md                     |   7 +
 docs/requirements/README.md                        |   4 +-
 .../00_user_requirement.md                         |   2 +
 .../02_design.md                                   |   3 +-
 .../03_tasks.md                                    |   2 +-
 .../04_verification.md                             |   5 +-
 .../05_trace.md                                    |   1 +
 .../change_log.md                                  |   1 +
 .../current_state.md                               |  10 +-
 .../delivery_evidence.md                           | 351 ++++++++-------------
 .../requirement.source.json                        |  37 ++-
 workbench/qa/20260925-v21/REPORT.md                |  60 +++-
 12 files changed, 245 insertions(+), 238 deletions(-)
```

### Untracked Files

```text
docs/需求/02-case-library.png
docs/需求/04-case-evidence.png
docs/需求/ALL_SCREENS.png
docs/需求/CODEX_IMPLEMENTATION.md
docs/需求/DESIGN_OVERVIEW.png
docs/需求/UI_DESIGN_SPEC_V2.md
docs/需求/index.html
workbench/docs/ui-workflow-proposal/01-case-library.png
workbench/docs/ui-workflow-proposal/02-case-detail.png
workbench/docs/ui-workflow-proposal/03-rerun-confirm.png
workbench/docs/ui-workflow-proposal/04-batch-results.png
workbench/docs/ui-workflow-proposal/05-script-panel.png
workbench/docs/ui-workflow-proposal/README.md
workbench/docs/ui-workflow-proposal/index.html
workbench/qa/20260925-v21/repair-auto-check.txt
workbench/qa/20260925-v21/repair-baseline.json
workbench/qa/20260925-v21/repair-card-before.txt
workbench/qa/20260925-v21/repair-card-final.json
workbench/qa/20260925-v21/repair-card-started.txt
workbench/qa/20260925-v21/repair-crosspage-preview.txt
workbench/qa/20260925-v21/repair-engineering-tests.log
workbench/qa/20260925-v21/repair-failed-result.png
workbench/qa/20260925-v21/repair-failed-result.txt
workbench/qa/20260925-v21/repair-media-single.json
workbench/qa/20260925-v21/repair-media-switched.json
workbench/qa/20260925-v21/repair-preflight-failure.txt
workbench/qa/20260925-v21/repair-preflight.png
workbench/qa/20260925-v21/repair-project-before.txt
workbench/qa/20260925-v21/repair-project-preflight.txt
workbench/qa/20260925-v21/repair-return-page2.txt
workbench/qa/20260925-v21/repair-selected-before.txt
workbench/qa/20260925-v21/repair-single-result.txt
workbench/qa/20260925-v21/repair-start-busy.txt
workbench/qa/20260925-v21/repair-top-before.txt
workbench/qa/20260925-v21/repair-verification.json
workbench/qa/20260925-v21/verify-repair.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-25T17:13:20+08:00
Command: node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs
Exit code: 0
Parsed test count: 20
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: batch concurrent replay, frozen versions, software label and no model
ok 1 - batch concurrent replay, frozen versions, software label and no model
  ---
  duration_ms: 108.561
  type: 'test'
  ...
# Subtest: whole project retains missing scripts and requires partial consent
ok 2 - whole project retains missing scripts and requires partial consent
  ---
  duration_ms: 75.0446
  type: 'test'
  ...
# Subtest: requirements rejection is separate from PASSED, explicit diagnostic only
ok 3 - requirements rejection is separate from PASSED, explicit diagnostic only
  ---
  duration_ms: 69.2001
  type: 'test'
  ...
# Subtest: cancel stops owned run and remaining queue; restart never replays
ok 4 - cancel stops owned run and remaining queue; restart never replays
  ---
  duration_ms: 79.5308
  type: 'test'
  ...
# Subtest: changed helper rejects admission; restored bytes can retry same request
ok 5 - changed helper rejects admission; restored bytes can retry same request
  ---
  duration_ms: 55.0763
  type: 'test'
  ...
# Subtest: automatic preflight is read-only, invalid input and zero runnable cannot start
ok 6 - automatic preflight is read-only, invalid input and zero runnable cannot start
  ---
  duration_ms: 28.0693
  type: 'test'
  ...
# Subtest: changed authorization and environment are checked again before admission
ok 7 - changed authorization and environment are checked again before admission
  ---
  duration_ms: 58.561
  type: 'test'
  ...
# Subtest: normal-only requires explicit registration and never invents a fault lane
ok 8 - normal-only requires explicit registration and never invents a fault lane
  ---
  duration_ms: 2.256
  type: 'test'
  ...
# Subtest: paired default still requires fault, and semantic remains explicit
ok 9 - paired default still requires fault, and semantic remains explicit
  ---
  duration_ms: 0.446
  type: 'test'
  ...
# Subtest: exploratory budget is explicit, bounded and does not inflate standard receipts
ok 10 - exploratory budget is explicit, bounded and does not inflate standard receipts
  ---
  duration_ms: 0.5166
  type: 'test'
  ...
# Subtest: report snapshots freeze exact run, escape content, redact fields and embed verified media
ok 11 - report snapshots freeze exact run, escape content, redact fields and embed verified media
  ---
  duration_ms: 22.3545
  type: 'test'
  ...
# Subtest: report missing/tampered media remains missing and blocked batch items stay in denominator
ok 12 - report missing/tampered media remains missing and blocked batch items stay in denominator
  ---
  duration_ms: 11.8258
  type: 'test'
  ...
# Subtest: report cancellation prevents snapshot commit and pending conflicting request is rejected
ok 13 - report cancellation prevents snapshot commit and pending conflicting request is rejected
  ---
  duration_ms: 19.4067
  type: 'test'
  ...
# Subtest: generation preflight has real authorization boundary, separates revision input, no task on rejection
ok 14 - generation preflight has real authorization boundary, separates revision input, no task on rejection
  ---
  duration_ms: 7.2227
  type: 'test'
  ...
# Subtest: invalid revision seed cannot consume an existing authorization
ok 15 - invalid revision seed cannot consume an existing authorization
  ---
  duration_ms: 7.168
  type: 'test'
  ...
# Subtest: generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
ok 16 - generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
  ---
  duration_ms: 20.8833
  type: 'test'
  ...
# Subtest: revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
ok 17 - revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
  ---
  duration_ms: 64.1025
  type: 'test'
  ...
# Subtest: formal 4322 workspace is the only UI and old entry redirects
ok 18 - formal 4322 workspace is the only UI and old entry redirects
  ---
  duration_ms: 62.9233
  type: 'test'
  ...
# Subtest: UI-D2A xlsx samples preserve exact source text and classifications through real parser
ok 19 - UI-D2A xlsx samples preserve exact source text and classifications through real parser
  ---
  duration_ms: 123.2751
  type: 'test'
  ...
# Subtest: committed native sample came from supported export schema and survives official import parser
ok 20 - committed native sample came from supported export schema and survives official import parser
  ---
  duration_ms: 25.8727
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6538.6955
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0036-ui-ux-01-workbench-usability-review; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `1`

```text
FAIL ai-engineering-context checks

1. docs\requirements\REQ-0015-manual-complex-lab\04_verification.md
   Problem: Document claims tests/build passed while failure, skipped-test, timeout, or non-zero evidence is present.
   Fix: Downgrade verification to `无法运行` / `未运行` / `仅静态检查` / failure, and keep the original command output.
2. docs\requirements\REQ-0015-manual-complex-lab\current_state.md
   Problem: Document claims tests/build passed while failure, skipped-test, timeout, or non-zero evidence is present.
   Fix: Downgrade verification to `无法运行` / `未运行` / `仅静态检查` / failure, and keep the original command output.
```

### Notes

V2.1返修源码e25f55f；正式4322真实4次旧包执行，3通过1保留原业务失败；3新批次，40媒体哈希一致，原历史及候选不变，模型与Harness0。设计追踪视图已补齐；原未验收边界保留。
