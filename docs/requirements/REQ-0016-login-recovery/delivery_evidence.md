# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-19T23:38:07+08:00`
- Record: `REQ-0016-login-recovery`
- Change fingerprint: `12ceafd20313d84b9571c64db9799b73dba5e161e3c2b79289a28efd857883e8`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/credential-store.test.mjs tests/credential-settings.integration.mjs tests/synthetic-login.test.mjs tests/autonomous-lab.test.mjs tests/autonomous-lab.integration.mjs tests/login-recovery.integration.mjs`
- Exit code: `0`
- Test count: `21`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0016-v2/collector-split-final.log`
- Log SHA-256: `cdfc65d7909e15871b638ed50d9d8a100315fab60cf07dccf596240d2f405781`

### Git Status

```text
 M .gitignore
 M README.md
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0016-login-recovery/00_user_requirement.md
 M docs/requirements/REQ-0016-login-recovery/01_development_requirement.md
 M docs/requirements/REQ-0016-login-recovery/02_design.md
 M docs/requirements/REQ-0016-login-recovery/03_tasks.md
 M docs/requirements/REQ-0016-login-recovery/04_verification.md
 M docs/requirements/REQ-0016-login-recovery/05_trace.md
 M docs/requirements/REQ-0016-login-recovery/change_log.md
 M docs/requirements/REQ-0016-login-recovery/current_state.md
 M docs/requirements/REQ-0016-login-recovery/delivery_evidence.md
 M docs/requirements/REQ-0016-login-recovery/requirement.source.json
 M public/app.js
 M src/deepseek.mjs
 M src/server.mjs
?? scripts/autonomous-lab.mjs
?? scripts/synthetic-login.mjs
?? src/credential-store.mjs
?? tests/autonomous-lab.integration.mjs
?? tests/autonomous-lab.test.mjs
?? tests/credential-settings.integration.mjs
?? tests/credential-store.test.mjs
?? tests/synthetic-login.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0016-login-recovery/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/deepseek.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/server.mjs', LF will be replaced by CRLF the next time Git touches it
 .gitignore                                         |   2 +
 README.md                                          |  10 +-
 docs/modules/release_runtime.md                    |   4 +
 docs/requirements/README.md                        |   2 +-
 .../REQ-0016-login-recovery/00_user_requirement.md |   7 +-
 .../01_development_requirement.md                  |   1 +
 .../REQ-0016-login-recovery/02_design.md           |   2 +
 .../REQ-0016-login-recovery/03_tasks.md            |   1 +
 .../REQ-0016-login-recovery/04_verification.md     |   1 +
 .../REQ-0016-login-recovery/05_trace.md            |   1 +
 .../REQ-0016-login-recovery/change_log.md          |   1 +
 .../REQ-0016-login-recovery/current_state.md       |  17 +-
 .../REQ-0016-login-recovery/delivery_evidence.md   | 407 +++++++--------------
 .../requirement.source.json                        |  54 ++-
 public/app.js                                      |  62 +++-
 src/deepseek.mjs                                   |  18 +
 src/server.mjs                                     |  33 +-
 17 files changed, 308 insertions(+), 315 deletions(-)
```

### Untracked Files

```text
scripts/autonomous-lab.mjs
scripts/synthetic-login.mjs
src/credential-store.mjs
tests/autonomous-lab.integration.mjs
tests/autonomous-lab.test.mjs
tests/credential-settings.integration.mjs
tests/credential-store.test.mjs
tests/synthetic-login.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-19T23:37:36+08:00
Command: node --test --test-concurrency=2 tests/credential-store.test.mjs tests/credential-settings.integration.mjs tests/synthetic-login.test.mjs tests/autonomous-lab.test.mjs tests/autonomous-lab.integration.mjs tests/login-recovery.integration.mjs
Exit code: 0
Parsed test count: 21
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# {"group":"smoke","calls":1,"results":[{"case_id":"LAB-V01","status":"NEEDS_MAPPING","reason":null,"attempts":0},{"case_id":"LAB-V02","status":"NEEDS_MAPPING","attempts":0},{"case_id":"LAB-V03","status":"NEEDS_MAPPING","attempts":0}]}
# Subtest: autonomous runner owns login and records a bounded model-boundary failure with no external calls
ok 1 - autonomous runner owns login and records a bounded model-boundary failure with no external calls
  ---
  duration_ms: 1367.7533
  type: 'test'
  ...
# Subtest: shared round call/time budget never resets between jobs and counts failed requests
ok 2 - shared round call/time budget never resets between jobs and counts failed requests
  ---
  duration_ms: 1.1961
  type: 'test'
  ...
# Subtest: autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
ok 3 - autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
  ---
  duration_ms: 13.7998
  type: 'test'
  ...
# Subtest: settings has opt-in retention, busy guard, inline recovery and usable narrow layout
ok 4 - settings has opt-in retention, busy guard, inline recovery and usable narrow layout
  ---
  duration_ms: 2210.6037
  type: 'test'
  ...
# Subtest: unsupported storage fails explicitly without mutating in-memory configuration
ok 5 - unsupported storage fails explicitly without mutating in-memory configuration
  ---
  duration_ms: 4.8912
  type: 'test'
  ...
# Subtest: oversized invalid regular file can be explicitly forgotten, never silently overwritten
ok 6 - oversized invalid regular file can be explicitly forgotten, never silently overwritten
  ---
  duration_ms: 4.1838
  type: 'test'
  ...
# Subtest: corrupt encrypted configuration stays visible and unchanged until explicitly forgotten
ok 7 - corrupt encrypted configuration stays visible and unchanged until explicitly forgotten
  ---
  duration_ms: 3.4712
  type: 'test'
  ...
# Subtest: Windows DPAPI roundtrip across server restart never exposes a key through config API
ok 8 - Windows DPAPI roundtrip across server restart never exposes a key through config API
  ---
  duration_ms: 1057.3604
  type: 'test'
  ...
# Subtest: invalid model/remember never partially changes the private key
ok 9 - invalid model/remember never partially changes the private key
  ---
  duration_ms: 1.7184
  type: 'test'
  ...
# Subtest: authentication refuses a late route change while memory state is captured
ok 10 - authentication refuses a late route change while memory state is captured
  ---
  duration_ms: 1196.1379
  type: 'test'
  ...
# Subtest: authentication refuses a late challenge change while memory state is captured
ok 11 - authentication refuses a late challenge change while memory state is captured
  ---
  duration_ms: 1133.493
  type: 'test'
  ...
# Subtest: actual complex lab: no automatic positive signal; explicit marker resumes the same waiting loop
ok 12 - actual complex lab: no automatic positive signal; explicit marker resumes the same waiting loop
  ---
  duration_ms: 1907.8227
  type: 'test'
  ...
# Subtest: closed owner page is not active; explicit open recovers only that task in the original context
ok 13 - closed owner page is not active; explicit open recovers only that task in the original context
  ---
  duration_ms: 1561.9762
  type: 'test'
  ...
# Subtest: waiting preparation repairs one closed page, then refuses an unbounded reopen loop
ok 14 - waiting preparation repairs one closed page, then refuses an unbounded reopen loop
  ---
  duration_ms: 2577.6705
  type: 'test'
  ...
# Subtest: closed context/browser can be reopened without inheriting verified authentication
ok 15 - closed context/browser can be reopened without inheriting verified authentication
  ---
  duration_ms: 1941.9012
  type: 'test'
  ...
# Subtest: recovery never adopts an unrelated tab or another task session
ok 16 - recovery never adopts an unrelated tab or another task session
  ---
  duration_ms: 1951.3936
  type: 'test'
  ...
# Subtest: confirmation ticket rejects route changes, wrong tasks, expiry, invalid index and replay
ok 17 - confirmation ticket rejects route changes, wrong tasks, expiry, invalid index and replay
  ---
  duration_ms: 8560.8775
  type: 'test'
  ...
# Subtest: password, OTP, cross-origin and broad markers cannot be operator-confirmed
ok 18 - password, OTP, cross-origin and broad markers cannot be operator-confirmed
  ---
  duration_ms: 1003.5828
  type: 'test'
  ...
# Subtest: stopping waiting login does not recover another task or reopen a page
ok 19 - stopping waiting login does not recover another task or reopen a page
  ---
  duration_ms: 876.4039
  type: 'test'
  ...
# Subtest: real console and Controller: confirm from waiting preparation, preserve scope, no second job
ok 20 - real console and Controller: confirm from waiting preparation, preserve scope, no second job
  ---
  duration_ms: 2874.0969
  type: 'test'
  ...
# screenshots: D:\\01_AI工程\\01_工程项目\\ui-test-agent\\validation\\login-recovery-1789832283174; provider intentionally stops at the first model boundary
# Subtest: owned synthetic fixture enters and re-verifies a fresh browser without user actions
ok 21 - owned synthetic fixture enters and re-verifies a fresh browser without user actions
  ---
  duration_ms: 2321.9388
  type: 'test'
  ...
1..21
# tests 21
# suites 0
# pass 21
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 29570.5516
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0016-login-recovery; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

本次单REQ交付21项工程验证；1212项全量含重叠不相加。真实原三例单独记账，不是发布验收。
