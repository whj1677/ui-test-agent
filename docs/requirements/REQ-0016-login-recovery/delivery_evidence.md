# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T11:35:21+08:00`
- Record: `REQ-0016-login-recovery`
- Change fingerprint: `0a3e9a137b1e1fe9d5b1de5fdfec5de0ff8267485bc5cf6964916dde0f2f4b8e`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs`
- Exit code: `0`
- Test count: `47`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0016-delivery.log`
- Log SHA-256: `c46e99f92d971b219164b487453be165156535e893d4f32dcb1affa94e0c1958`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M manual-lab/README.md
 M public/app.js
 M src/browser.mjs
 M src/controller.mjs
 M src/server.mjs
 M tests/console.integration.mjs
 M tests/discovery-controls.test.mjs
 M tests/discovery-memory.test.mjs
 M tests/workflow.integration.mjs
?? docs/requirements/REQ-0016-login-recovery/00_user_requirement.md
?? docs/requirements/REQ-0016-login-recovery/01_development_requirement.md
?? docs/requirements/REQ-0016-login-recovery/02_design.md
?? docs/requirements/REQ-0016-login-recovery/03_tasks.md
?? docs/requirements/REQ-0016-login-recovery/04_verification.md
?? docs/requirements/REQ-0016-login-recovery/05_trace.md
?? docs/requirements/REQ-0016-login-recovery/change_log.md
?? docs/requirements/REQ-0016-login-recovery/current_state.md
?? docs/requirements/REQ-0016-login-recovery/delivery_evidence.md
?? docs/requirements/REQ-0016-login-recovery/requirement.source.json
?? tests/login-recovery.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'manual-lab/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/server.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/console.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-controls.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-memory.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/workflow.integration.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md   |   8 ++
 docs/requirements/README.md       |   2 +
 manual-lab/README.md              |   8 ++
 public/app.js                     | 100 ++++++++++++++++++++-
 src/browser.mjs                   | 185 ++++++++++++++++++++++++++++++++------
 src/controller.mjs                |  67 +++++++++++++-
 src/server.mjs                    |  14 ++-
 tests/console.integration.mjs     |   6 +-
 tests/discovery-controls.test.mjs |   6 +-
 tests/discovery-memory.test.mjs   |   8 +-
 tests/workflow.integration.mjs    |  15 +++-
 11 files changed, 378 insertions(+), 41 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0016-login-recovery/00_user_requirement.md
docs/requirements/REQ-0016-login-recovery/01_development_requirement.md
docs/requirements/REQ-0016-login-recovery/02_design.md
docs/requirements/REQ-0016-login-recovery/03_tasks.md
docs/requirements/REQ-0016-login-recovery/04_verification.md
docs/requirements/REQ-0016-login-recovery/05_trace.md
docs/requirements/REQ-0016-login-recovery/change_log.md
docs/requirements/REQ-0016-login-recovery/current_state.md
docs/requirements/REQ-0016-login-recovery/delivery_evidence.md
docs/requirements/REQ-0016-login-recovery/requirement.source.json
tests/login-recovery.integration.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T11:34:51+08:00
Command: node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs
Exit code: 0
Parsed test count: 47
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: 24 native-import cases have isolated identities, fixed groups and accurate original oracle
ok 1 - 24 native-import cases have isolated identities, fixed groups and accurate original oracle
  ---
  duration_ms: 327.3964
  type: 'test'
  ...
# Subtest: server exposes only local synthetic routes, never answer files, source or write APIs
ok 2 - server exposes only local synthetic routes, never answer files, source or write APIs
  ---
  duration_ms: 37.9091
  type: 'test'
  ...
# Subtest: V01 homepage navigation exposes 12 assets and 5 first-page rows
ok 3 - V01 homepage navigation exposes 12 assets and 5 first-page rows
  ---
  duration_ms: 665.6677
  type: 'test'
  ...
# Subtest: V02 compound AND filter distinguishes the same-name south device
ok 4 - V02 compound AND filter distinguishes the same-name south device
  ---
  duration_ms: 296.8145
  type: 'test'
  ...
# Subtest: V03 paginated same-name record binds D009, never D001
ok 5 - V03 paginated same-name record binds D009, never D001
  ---
  duration_ms: 1134.7206
  type: 'test'
  ...
# Subtest: V04 tabs preserve D009 identity and specified parameter values
ok 6 - V04 tabs preserve D009 identity and specified parameter values
  ---
  duration_ms: 1159.8266
  type: 'test'
  ...
# Subtest: V05 nested modal blocks background and closes only the top layer
ok 7 - V05 nested modal blocks background and closes only the top layer
  ---
  duration_ms: 1531.1565
  type: 'test'
  ...
# Subtest: V06 querying from later page and resetting restore pagination
ok 8 - V06 querying from later page and resetting restore pagination
  ---
  duration_ms: 370.439
  type: 'test'
  ...
# Subtest: V07 descending numeric power sort and reset
ok 9 - V07 descending numeric power sort and reset
  ---
  duration_ms: 334.0744
  type: 'test'
  ...
# Subtest: V08 deterministic async read error recovers once with the correct device value
ok 10 - V08 deterministic async read error recovers once with the correct device value
  ---
  duration_ms: 2858.2406
  type: 'test'
  ...
# Subtest: V09 inclusive date range returns exactly two matching maintenance rows
ok 11 - V09 inclusive date range returns exactly two matching maintenance rows
  ---
  duration_ms: 1210.9456
  type: 'test'
  ...
# Subtest: closing a loading detail prevents its delayed contents reopening on a new route
ok 12 - closing a loading detail prevents its delayed contents reopening on a new route
  ---
  duration_ms: 1245.0074
  type: 'test'
  ...
# Subtest: V10 standard tariff correct non-defect values
ok 13 - V10 standard tariff correct non-defect values
  ---
  duration_ms: 333.9299
  type: 'test'
  ...
# Subtest: V11 conditional tariff help remains nested and keeps the right template
ok 14 - V11 conditional tariff help remains nested and keeps the right template
  ---
  duration_ms: 399.8234
  type: 'test'
  ...
# Subtest: V12 audit pages and result filter reset page position
ok 15 - V12 audit pages and result filter reset page position
  ---
  duration_ms: 417.8644
  type: 'test'
  ...
# Subtest: V13 wizard only creates on submit, uses dynamic id, persists all entered fields
ok 16 - V13 wizard only creates on submit, uses dynamic id, persists all entered fields
  ---
  duration_ms: 589.1574
  type: 'test'
  ...
# Subtest: V14 missing name prevents advancing and leaves seed data alone
ok 17 - V14 missing name prevents advancing and leaves seed data alone
  ---
  duration_ms: 297.941
  type: 'test'
  ...
# Subtest: V15 step-back preserves all configured values without committing
ok 18 - V15 step-back preserves all configured values without committing
  ---
  duration_ms: 522.5722
  type: 'test'
  ...
# Subtest: V16 dirty confirmation keeps data or discards only the draft
ok 19 - V16 dirty confirmation keeps data or discards only the draft
  ---
  duration_ms: 385.3502
  type: 'test'
  ...
# Subtest: V17 duplicate name is rejected at submit with no new persisted record
ok 20 - V17 duplicate name is rejected at submit with no new persisted record
  ---
  duration_ms: 451.0556
  type: 'test'
  ...
# Subtest: wizard keyboard priority, invalid period and escaped business text do not silently submit
ok 21 - wizard keyboard priority, invalid period and escaped business text do not silently submit
  ---
  duration_ms: 419.87
  type: 'test'
  ...
# Subtest: V18 update and cleanup bind only the newly created record
ok 22 - V18 update and cleanup bind only the newly created record
  ---
  duration_ms: 628.7975
  type: 'test'
  ...
# Subtest: B01 seeded tariff defect is visible; correct 0.38 oracle is never derived from UI
ok 23 - B01 seeded tariff defect is visible; correct 0.38 oracle is never derived from UI
  ---
  duration_ms: 252.5426
  type: 'test'
  ...
# Subtest: B02 seeded frequency defect exists only on D004, not the valid D009
ok 24 - B02 seeded frequency defect exists only on D004, not the valid D009
  ---
  duration_ms: 2095.6766
  type: 'test'
  ...
# Subtest: reload, history navigation and reset preserve isolation from unrelated storage
ok 25 - reload, history navigation and reset preserve isolation from unrelated storage
  ---
  duration_ms: 663.8781
  type: 'test'
  ...
# Subtest: desktop and 375px viewports have bounded layout, keyboard operation and screenshot evidence
ok 26 - desktop and 375px viewports have bounded layout, keyboard operation and screenshot evidence
  ---
  duration_ms: 831.5801
  type: 'test'
  ...
# Subtest: duplicate home labels and decorative menu arrows allow automatic protected-page recognition and two-level discovery
ok 27 - duplicate home labels and decorative menu arrows allow automatic protected-page recognition and two-level discovery
  ---
  duration_ms: 4358.9333
  type: 'test'
  ...
# Subtest: observable names honor labelledby, hidden decoration, nested text, and native role uniqueness
ok 28 - observable names honor labelledby, hidden decoration, nested text, and native role uniqueness
  ---
  duration_ms: 993.9623
  type: 'test'
  ...
# Subtest: unmapped buttons and incorrect unique destinations are visible repair gaps, never rebound controls
ok 29 - unmapped buttons and incorrect unique destinations are visible repair gaps, never rebound controls
  ---
  duration_ms: 998.6727
  type: 'test'
  ...
# Subtest: public menu and hidden logout decoration cannot satisfy positive login evidence
ok 30 - public menu and hidden logout decoration cannot satisfy positive login evidence
  ---
  duration_ms: 2433.0207
  type: 'test'
  ...
# Subtest: one preparation: manual login -> internal source repair -> missing-evidence probe/navigation -> audited candidate, no automatic approval
ok 31 - one preparation: manual login -> internal source repair -> missing-evidence probe/navigation -> audited candidate, no automatic approval
  ---
  duration_ms: 6975.5791
  type: 'test'
  ...
# Subtest: unknown initialization request does not kill navigation; action-induced write remains blocked
ok 32 - unknown initialization request does not kill navigation; action-induced write remains blocked
  ---
  duration_ms: 2545.9629
  type: 'test'
  ...
# Subtest: public or ambiguous page cannot silently count as login; waiting is cancellable
ok 33 - public or ambiguous page cannot silently count as login; waiting is cancellable
  ---
  duration_ms: 1377.5188
  type: 'test'
  ...
# Subtest: adapter cannot silently rebind an observed node or expose duplicate tables
ok 34 - adapter cannot silently rebind an observed node or expose duplicate tables
  ---
  duration_ms: 1212.4537
  type: 'test'
  ...
# Subtest: dismissing a login modal over a public shell and a visible OTP challenge are not login evidence
ok 35 - dismissing a login modal over a public shell and a visible OTP challenge are not login evidence
  ---
  duration_ms: 5095.3555
  type: 'test'
  ...
# Subtest: rejected live adapter keeps the login owner; leaf labels cannot bypass dangerous menu ancestors
ok 36 - rejected live adapter keeps the login owner; leaf labels cannot bypass dangerous menu ancestors
  ---
  duration_ms: 2438.6411
  type: 'test'
  ...
# Subtest: authentication refuses a late route change while memory state is captured
ok 37 - authentication refuses a late route change while memory state is captured
  ---
  duration_ms: 1349.2568
  type: 'test'
  ...
# Subtest: authentication refuses a late challenge change while memory state is captured
ok 38 - authentication refuses a late challenge change while memory state is captured
  ---
  duration_ms: 1124.3886
  type: 'test'
  ...
# Subtest: actual complex lab: no automatic positive signal; explicit marker resumes the same waiting loop
ok 39 - actual complex lab: no automatic positive signal; explicit marker resumes the same waiting loop
  ---
  duration_ms: 1908.0323
  type: 'test'
  ...
# Subtest: closed owner page is not active; explicit open recovers only that task in the original context
ok 40 - closed owner page is not active; explicit open recovers only that task in the original context
  ---
  duration_ms: 1586.3993
  type: 'test'
  ...
# Subtest: waiting preparation repairs one closed page, then refuses an unbounded reopen loop
ok 41 - waiting preparation repairs one closed page, then refuses an unbounded reopen loop
  ---
  duration_ms: 2616.407
  type: 'test'
  ...
# Subtest: closed context/browser can be reopened without inheriting verified authentication
ok 42 - closed context/browser can be reopened without inheriting verified authentication
  ---
  duration_ms: 2250.6826
  type: 'test'
  ...
# Subtest: recovery never adopts an unrelated tab or another task session
ok 43 - recovery never adopts an unrelated tab or another task session
  ---
  duration_ms: 2199.6557
  type: 'test'
  ...
# Subtest: confirmation ticket rejects route changes, wrong tasks, expiry, invalid index and replay
ok 44 - confirmation ticket rejects route changes, wrong tasks, expiry, invalid index and replay
  ---
  duration_ms: 8339.9444
  type: 'test'
  ...
# Subtest: password, OTP, cross-origin and broad markers cannot be operator-confirmed
ok 45 - password, OTP, cross-origin and broad markers cannot be operator-confirmed
  ---
  duration_ms: 963.6283
  type: 'test'
  ...
# Subtest: stopping waiting login does not recover another task or reopen a page
ok 46 - stopping waiting login does not recover another task or reopen a page
  ---
  duration_ms: 870.0599
  type: 'test'
  ...
# Subtest: real console and Controller: confirm from waiting preparation, preserve scope, no second job
ok 47 - real console and Controller: confirm from waiting preparation, preserve scope, no second job
  ---
  duration_ms: 5178.1044
  type: 'test'
  ...
# screenshots: D:\\01_AI工程\\01_工程项目\\ui-test-agent\\validation\\login-recovery-1789702515206; provider intentionally stops at the first model boundary
1..47
# tests 47
# suites 0
# pass 47
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 29100.3537
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

本机隔离合成登录/页面生命周期/控制台交接，真实模型未调用；4179旧实例和旧任务未修改。
