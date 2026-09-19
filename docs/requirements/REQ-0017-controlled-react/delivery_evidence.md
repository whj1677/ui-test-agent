# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T00:43:28+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `006c8b24662d2efd3e2e9008cac2dcc0f581181f6aa78f57a1d4ce7aa53ceafb`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/contrast-fixture.test.mjs tests/synthetic-login.test.mjs tests/autonomous-lab.test.mjs tests/autonomous-lab.integration.mjs`
- Exit code: `0`
- Test count: `9`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v11-fixture-origin-confirmed.log`
- Log SHA-256: `f3400c02bb131d2a9e408fedcb708a218ac16764bd577eb6d4ab667dc3abecf6`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v11-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M scripts/autonomous-lab.mjs
?? scripts/contrast-fixture.mjs
?? tests/contrast-fixture.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v11-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/autonomous-lab.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   6 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 205 ++++++---------------
 .../real-model-v11-result.md                       |   7 +-
 .../requirement.source.json                        |  13 +-
 scripts/autonomous-lab.mjs                         |  13 +-
 10 files changed, 87 insertions(+), 168 deletions(-)
```

### Untracked Files

```text
scripts/contrast-fixture.mjs
tests/contrast-fixture.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T00:43:22+08:00
Command: node --test --test-concurrency=2 tests/contrast-fixture.test.mjs tests/synthetic-login.test.mjs tests/autonomous-lab.test.mjs tests/autonomous-lab.integration.mjs
Exit code: 0
Parsed test count: 9
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# {"group":"smoke","calls":1,"results":[{"case_id":"LAB-V01","status":"NEEDS_MAPPING","reason":null,"attempts":0},{"case_id":"LAB-V02","status":"NEEDS_MAPPING","attempts":0},{"case_id":"LAB-V03","status":"NEEDS_MAPPING","attempts":0}]}
# Subtest: autonomous runner owns login and records a bounded model-boundary failure with no external calls
ok 1 - autonomous runner owns login and records a bounded model-boundary failure with no external calls
  ---
  duration_ms: 1533.2118
  type: 'test'
  ...
# Subtest: shared round call/time budget never resets between jobs and counts failed requests
ok 2 - shared round call/time budget never resets between jobs and counts failed requests
  ---
  duration_ms: 1.2894
  type: 'test'
  ...
# Subtest: autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
ok 3 - autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
  ---
  duration_ms: 11.5453
  type: 'test'
  ...
# Subtest: owned contrast fixture verifies all frozen routes/assets
ok 4 - owned contrast fixture verifies all frozen routes/assets
  ---
  duration_ms: 55.0025
  type: 'test'
  ...
# Subtest: existing byte-identical contrast fixture is reused without stopping server
ok 5 - existing byte-identical contrast fixture is reused without stopping server
  ---
  duration_ms: 37.637
  type: 'test'
  ...
# Subtest: correct health and HTML never authorize a mismatched script asset
ok 6 - correct health and HTML never authorize a mismatched script asset
  ---
  duration_ms: 18.8353
  type: 'test'
  ...
# Subtest: owned synthetic fixture enters and re-verifies a fresh browser without user actions
ok 7 - owned synthetic fixture enters and re-verifies a fresh browser without user actions
  ---
  duration_ms: 2338.2764
  type: 'test'
  ...
# Subtest: reuse only byte-verified synthetic server and leave it running after fixture close
ok 8 - reuse only byte-verified synthetic server and leave it running after fixture close
  ---
  duration_ms: 1234.6147
  type: 'test'
  ...
# Subtest: occupied port with matching health but wrong page is never adopted or clicked
ok 9 - occupied port with matching health but wrong page is never adopted or clicked
  ---
  duration_ms: 8.9476
  type: 'test'
  ...
1..9
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4897.9878
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

首次9项工程成功但文档检查发现设计和验证视图未同步；现更新事实源设计与证据再复检。产品构建不变。
