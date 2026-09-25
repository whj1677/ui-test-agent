# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-25T16:34:50+08:00`
- Record: `REQ-0036-ui-ux-01-workbench-usability-review`
- Change fingerprint: `713cc4da01777e865975bef5208a4c95ff3fece9175a5b9233fadb0615a32172`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs`
- Exit code: `0`
- Test count: `18`
- Failure count: `0`
- Skipped count: `0`
- Log path: `workbench/qa/20260925-v21/engineering-tests.log`
- Log SHA-256: `a7d0a9253ae57b077d76415c0f0ad39144dabaad07c95125fb0e2a7691747fae`

### Git Status

```text
M  docs/modules/test-workbench.md
M  docs/modules/workbench-case-library.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/00_user_requirement.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/01_development_requirement.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/02_design.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/03_tasks.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/04_verification.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/05_trace.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/change_log.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/current_state.md
MM docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/delivery_evidence.md
M  docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/requirement.source.json
M  workbench/config/fresh-b-trial.json
A  workbench/qa/20260925-v21/IMPLEMENTATION.md
A  workbench/qa/20260925-v21/REPORT.md
AM workbench/qa/20260925-v21/engineering-tests.log
A  workbench/qa/20260925-v21/final-browser.json
A  workbench/qa/20260925-v21/full-active-batch.json
A  workbench/qa/20260925-v21/live-verification.json
A  workbench/qa/20260925-v21/media-downloads.json
A  workbench/qa/20260925-v21/native-conflict.json
A  workbench/qa/20260925-v21/offline-report-download.json
A  workbench/qa/20260925-v21/report-final-verification.json
A  workbench/qa/20260925-v21/single-batch.json
A  workbench/qa/20260925-v21/single-report-final.json
A  workbench/qa/20260925-v21/single-run.json
A  workbench/qa/20260925-v21/trace-download.json
A  workbench/qa/20260925-v21/ux01-import-preview.txt
A  workbench/qa/20260925-v21/ux01-import-result.txt
A  workbench/qa/20260925-v21/ux02-conflict-preview.txt
A  workbench/qa/20260925-v21/ux02-conflict-result.txt
A  workbench/qa/20260925-v21/ux02-duplicate-preview.txt
A  workbench/qa/20260925-v21/ux02-duplicate-result.txt
A  workbench/qa/20260925-v21/ux02-native-preview.txt
A  workbench/qa/20260925-v21/ux02-native-result.txt
A  workbench/qa/20260925-v21/ux04-green-rejected.png
A  workbench/qa/20260925-v21/ux04-green-rejected.txt
A  workbench/qa/20260925-v21/ux05-history-readonly.txt
A  workbench/qa/20260925-v21/ux06-media-switch.json
A  workbench/qa/20260925-v21/ux07-single-preflight.txt
A  workbench/qa/20260925-v21/ux07-single-result.txt
A  workbench/qa/20260925-v21/ux08-cross-batch.txt
A  workbench/qa/20260925-v21/ux08-cross-page-filter.txt
A  workbench/qa/20260925-v21/ux08-cross-page-preflight.txt
A  workbench/qa/20260925-v21/ux09-full-preflight.txt
A  workbench/qa/20260925-v21/ux09-full-result.txt
A  workbench/qa/20260925-v21/ux11-edit-during-batch.txt
A  workbench/qa/20260925-v21/ux13-cancel-request.txt
A  workbench/qa/20260925-v21/ux16-drag.json
A  workbench/qa/20260925-v21/ux16-final-replay.png
A  workbench/qa/20260925-v21/ux16-media.png
A  workbench/qa/20260925-v21/ux16-step-speed.json
A  workbench/qa/20260925-v21/ux17-polling-playback.json
A  workbench/qa/20260925-v21/ux20-batch-preview.png
A  workbench/qa/20260925-v21/ux20-report-preview-1440.png
A  workbench/qa/20260925-v21/ux20-report-preview.png
A  workbench/qa/20260925-v21/ux21-report-unchanged.json
A  workbench/qa/20260925-v21/ux22-auth-boundary.txt
A  workbench/qa/20260925-v21/ux24-cross-project.txt
A  workbench/qa/20260925-v21/ux25-cases-1280.png
A  workbench/qa/20260925-v21/ux25-cases-1440.png
A  workbench/qa/20260925-v21/ux25-cases-1920.png
A  workbench/qa/20260925-v21/ux25-layout.json
A  workbench/qa/20260925-v21/ux26-history-migration.txt
A  workbench/qa/20260925-v21/ux26-root-migration.json
A  workbench/qa/20260925-v21/ux27-four-tabs.json
A  workbench/qa/20260925-v21/ux28-batch-regenerate.txt
A  workbench/qa/20260925-v21/ux29-revision-blocked.txt
A  workbench/qa/20260925-v21/verify-live.mjs
A  workbench/qa/20260925-v21/verify-reports.mjs
M  workbench/server/app.mjs
M  workbench/server/report-snapshots.mjs
M  workbench/tests/product-v21.test.mjs
M  workbench/tests/ui-d2a.test.mjs
M  workbench/web-v2/app.js
M  workbench/web-v2/script-actions.js
D  workbench/web/app.js
D  workbench/web/index.html
D  workbench/web/styles.css
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
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0036-ui-ux-01-workbench-usability-review/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/qa/20260925-v21/engineering-tests.log', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/qa/20260925-v21/engineering-tests.log', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/qa/20260925-v21/engineering-tests.log', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md                     |   14 +-
 docs/modules/workbench-case-library.md             |    4 +-
 .../00_user_requirement.md                         |   21 +-
 .../01_development_requirement.md                  |    5 +-
 .../02_design.md                                   |   11 +-
 .../03_tasks.md                                    |    1 +
 .../04_verification.md                             |   13 +-
 .../05_trace.md                                    |    1 +
 .../change_log.md                                  |    1 +
 .../current_state.md                               |   15 +-
 .../delivery_evidence.md                           |  417 +++++---
 .../requirement.source.json                        |  121 ++-
 workbench/config/fresh-b-trial.json                |   99 ++
 workbench/qa/20260925-v21/IMPLEMENTATION.md        |   31 +
 workbench/qa/20260925-v21/REPORT.md                |   91 ++
 workbench/qa/20260925-v21/engineering-tests.log    |  127 +++
 workbench/qa/20260925-v21/final-browser.json       |    5 +
 workbench/qa/20260925-v21/full-active-batch.json   |  275 +++++
 workbench/qa/20260925-v21/live-verification.json   | 1131 ++++++++++++++++++++
 workbench/qa/20260925-v21/media-downloads.json     |   18 +
 workbench/qa/20260925-v21/native-conflict.json     |   64 ++
 .../qa/20260925-v21/offline-report-download.json   |   45 +
 .../qa/20260925-v21/report-final-verification.json |  201 ++++
 workbench/qa/20260925-v21/single-batch.json        |   69 ++
 workbench/qa/20260925-v21/single-report-final.json |   33 +
 workbench/qa/20260925-v21/single-run.json          |  577 ++++++++++
 workbench/qa/20260925-v21/trace-download.json      |    7 +
 workbench/qa/20260925-v21/ux01-import-preview.txt  |  192 ++++
 workbench/qa/20260925-v21/ux01-import-result.txt   |   52 +
 .../qa/20260925-v21/ux02-conflict-preview.txt      |   75 ++
 workbench/qa/20260925-v21/ux02-conflict-result.txt |   52 +
 .../qa/20260925-v21/ux02-duplicate-preview.txt     |  192 ++++
 .../qa/20260925-v21/ux02-duplicate-result.txt      |   52 +
 workbench/qa/20260925-v21/ux02-native-preview.txt  |  192 ++++
 workbench/qa/20260925-v21/ux02-native-result.txt   |   52 +
 workbench/qa/20260925-v21/ux04-green-rejected.png  |  Bin 0 -> 99937 bytes
 workbench/qa/20260925-v21/ux04-green-rejected.txt  |  120 +++
 .../qa/20260925-v21/ux05-history-readonly.txt      |   85 ++
 workbench/qa/20260925-v21/ux06-media-switch.json   |   86 ++
 .../qa/20260925-v21/ux07-single-preflight.txt      |  151 +++
 workbench/qa/20260925-v21/ux07-single-result.txt   |  136 +++
 workbench/qa/20260925-v21/ux08-cross-batch.txt     |   73 ++
 .../qa/20260925-v21/ux08-cross-page-filter.txt     |   99 ++
 .../qa/20260925-v21/ux08-cross-page-preflight.txt  |  130 +++
 workbench/qa/20260925-v21/ux09-full-preflight.txt  |  263 +++++
 workbench/qa/20260925-v21/ux09-full-result.txt     |  143 +++
 .../qa/20260925-v21/ux11-edit-during-batch.txt     |   76 ++
 workbench/qa/20260925-v21/ux13-cancel-request.txt  |  144 +++
 workbench/qa/20260925-v21/ux16-drag.json           |   14 +
 workbench/qa/20260925-v21/ux16-final-replay.png    |  Bin 0 -> 120224 bytes
 workbench/qa/20260925-v21/ux16-media.png           |  Bin 0 -> 130271 bytes
 workbench/qa/20260925-v21/ux16-step-speed.json     |   18 +
 .../qa/20260925-v21/ux17-polling-playback.json     |   16 +
 workbench/qa/20260925-v21/ux20-batch-preview.png   |  Bin 0 -> 100057 bytes
 .../qa/20260925-v21/ux20-report-preview-1440.png   |  Bin 0 -> 133826 bytes
 workbench/qa/20260925-v21/ux20-report-preview.png  |  Bin 0 -> 50544 bytes
 .../qa/20260925-v21/ux21-report-unchanged.json     |    1 +
 workbench/qa/20260925-v21/ux22-auth-boundary.txt   |   49 +
 workbench/qa/20260925-v21/ux24-cross-project.txt   |   25 +
 workbench/qa/20260925-v21/ux25-cases-1280.png      |  Bin 0 -> 78919 bytes
 workbench/qa/20260925-v21/ux25-cases-1440.png      |  Bin 0 -> 99082 bytes
 workbench/qa/20260925-v21/ux25-cases-1920.png      |  Bin 0 -> 110086 bytes
 workbench/qa/20260925-v21/ux25-layout.json         |  104 ++
 .../qa/20260925-v21/ux26-history-migration.txt     |  145 +++
 workbench/qa/20260925-v21/ux26-root-migration.json |    7 +
 workbench/qa/20260925-v21/ux27-four-tabs.json      |   26 +
 .../qa/20260925-v21/ux28-batch-regenerate.txt      |  143 +++
 .../qa/20260925-v21/ux29-revision-blocked.txt      |  187 ++++
 workbench/qa/20260925-v21/verify-live.mjs          |   25 +
 workbench/qa/20260925-v21/verify-reports.mjs       |   34 +
 workbench/server/app.mjs                           |   13 +-
 workbench/server/report-snapshots.mjs              |   14 +-
 workbench/tests/product-v21.test.mjs               |   12 +
 workbench/tests/ui-d2a.test.mjs                    |   10 +-
 workbench/web-v2/app.js                            |    5 +-
 workbench/web-v2/script-actions.js                 |    2 +-
 workbench/web/app.js                               |  788 --------------
 workbench/web/index.html                           |  198 ----
 workbench/web/styles.css                           |  111 --
 79 files changed, 6392 insertions(+), 1317 deletions(-)
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
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-25T16:34:41+08:00
Command: node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs
Exit code: 0
Parsed test count: 18
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: batch concurrent replay, frozen versions, software label and no model
ok 1 - batch concurrent replay, frozen versions, software label and no model
  ---
  duration_ms: 100.8779
  type: 'test'
  ...
# Subtest: whole project retains missing scripts and requires partial consent
ok 2 - whole project retains missing scripts and requires partial consent
  ---
  duration_ms: 73.7924
  type: 'test'
  ...
# Subtest: requirements rejection is separate from PASSED, explicit diagnostic only
ok 3 - requirements rejection is separate from PASSED, explicit diagnostic only
  ---
  duration_ms: 61.4953
  type: 'test'
  ...
# Subtest: cancel stops owned run and remaining queue; restart never replays
ok 4 - cancel stops owned run and remaining queue; restart never replays
  ---
  duration_ms: 74.0854
  type: 'test'
  ...
# Subtest: changed helper blocks before executor even after preview
ok 5 - changed helper blocks before executor even after preview
  ---
  duration_ms: 41.3903
  type: 'test'
  ...
# Subtest: normal-only requires explicit registration and never invents a fault lane
ok 6 - normal-only requires explicit registration and never invents a fault lane
  ---
  duration_ms: 1.6721
  type: 'test'
  ...
# Subtest: paired default still requires fault, and semantic remains explicit
ok 7 - paired default still requires fault, and semantic remains explicit
  ---
  duration_ms: 0.2934
  type: 'test'
  ...
# Subtest: exploratory budget is explicit, bounded and does not inflate standard receipts
ok 8 - exploratory budget is explicit, bounded and does not inflate standard receipts
  ---
  duration_ms: 0.3334
  type: 'test'
  ...
# Subtest: report snapshots freeze exact run, escape content, redact fields and embed verified media
ok 9 - report snapshots freeze exact run, escape content, redact fields and embed verified media
  ---
  duration_ms: 21.6882
  type: 'test'
  ...
# Subtest: report missing/tampered media remains missing and blocked batch items stay in denominator
ok 10 - report missing/tampered media remains missing and blocked batch items stay in denominator
  ---
  duration_ms: 10.0743
  type: 'test'
  ...
# Subtest: report cancellation prevents snapshot commit and pending conflicting request is rejected
ok 11 - report cancellation prevents snapshot commit and pending conflicting request is rejected
  ---
  duration_ms: 9.4386
  type: 'test'
  ...
# Subtest: generation preflight has real authorization boundary, separates revision input, no task on rejection
ok 12 - generation preflight has real authorization boundary, separates revision input, no task on rejection
  ---
  duration_ms: 6.2505
  type: 'test'
  ...
# Subtest: invalid revision seed cannot consume an existing authorization
ok 13 - invalid revision seed cannot consume an existing authorization
  ---
  duration_ms: 4.0968
  type: 'test'
  ...
# Subtest: generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
ok 14 - generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
  ---
  duration_ms: 21.2666
  type: 'test'
  ...
# Subtest: revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
ok 15 - revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
  ---
  duration_ms: 59.6536
  type: 'test'
  ...
# Subtest: formal 4322 workspace is the only UI and old entry redirects
ok 16 - formal 4322 workspace is the only UI and old entry redirects
  ---
  duration_ms: 68.2825
  type: 'test'
  ...
# Subtest: UI-D2A xlsx samples preserve exact source text and classifications through real parser
ok 17 - UI-D2A xlsx samples preserve exact source text and classifications through real parser
  ---
  duration_ms: 153.1626
  type: 'test'
  ...
# Subtest: committed native sample came from supported export schema and survives official import parser
ok 18 - committed native sample came from supported export schema and survives official import parser
  ---
  duration_ms: 27.7455
  type: 'test'
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6603.0975
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

18项工程检查含17单元及1正式4322迁移集成；产品UX范围见workbench/qa/20260925-v21/REPORT.md。11次旧包执行，模型和Harness0。真实生成、完整登录及HTML本地打开未验证。
