# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-17T21:50:15+08:00`
- Record: `REQ-20260916-internal-beta`
- Change fingerprint: `9c8b8aa59d1c15e8c7be99e82fa084ec6e0d0b53deeff8dbbc5292cd0e8a7f02`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/autonomous-preparation.integration.mjs tests/discovery-browser.integration.mjs tests/preparation.integration.mjs tests/model-flow.integration.mjs`
- Exit code: `0`
- Test count: `9`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/query-planning-browser-final-20260917.log`
- Log SHA-256: `a9345895a2dac661b0cd23d71e3fbb4aa83010ff2d313c858c7b594ed843b318`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-20260916-internal-beta/00_user_requirement.md
 M docs/requirements/REQ-20260916-internal-beta/01_development_requirement.md
 M docs/requirements/REQ-20260916-internal-beta/02_design.md
 M docs/requirements/REQ-20260916-internal-beta/03_tasks.md
 M docs/requirements/REQ-20260916-internal-beta/04_verification.md
 M docs/requirements/REQ-20260916-internal-beta/05_trace.md
 M docs/requirements/REQ-20260916-internal-beta/change_log.md
 M docs/requirements/REQ-20260916-internal-beta/current_state.md
 M docs/requirements/REQ-20260916-internal-beta/delivery_evidence.md
 M public/app.js
 M public/styles.css
 M src/autonomous-recovery.mjs
 M src/block-audit.mjs
 M src/browser.mjs
 M src/controller.mjs
 M src/discovery-browser.mjs
 M src/discovery.mjs
 M src/plan-quality.mjs
 M src/plan-repair.mjs
 M src/plan-semantics.mjs
 M src/planning-input.mjs
 M src/plans.mjs
 M src/report.mjs
 M src/server.mjs
 M tests/agent-output.integration.mjs
 M tests/case-entry-url.test.mjs
 M tests/discovery-controller.test.mjs
 M tests/repair-contracts.test.mjs
?? src/case-advice.mjs
?? src/dynamic-row-evidence.mjs
?? src/job-budget.mjs
?? src/preparation.mjs
?? src/query-capability.mjs
?? tests/job-budget.test.mjs
?? tests/preparation-ui.integration.mjs
?? tests/preparation.integration.mjs
?? tests/preparation.test.mjs
?? tests/query-capability.test.mjs
?? tests/workflow.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-20260916-internal-beta/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/styles.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/autonomous-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/block-audit.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery-browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-quality.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-repair.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/planning-input.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plans.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/report.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/server.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/agent-output.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/case-entry-url.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-controller.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/repair-contracts.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |  14 +
 .../00_user_requirement.md                         |  16 +
 .../01_development_requirement.md                  |  20 +
 .../REQ-20260916-internal-beta/02_design.md        |  29 +
 .../REQ-20260916-internal-beta/03_tasks.md         |  24 +
 .../REQ-20260916-internal-beta/04_verification.md  |  34 +
 .../REQ-20260916-internal-beta/05_trace.md         |  14 +
 .../REQ-20260916-internal-beta/change_log.md       |   4 +
 .../REQ-20260916-internal-beta/current_state.md    |  46 +-
 .../delivery_evidence.md                           | 843 ++++-----------------
 public/app.js                                      | 579 ++++++++++++--
 public/styles.css                                  | 183 +++++
 src/autonomous-recovery.mjs                        | 103 ++-
 src/block-audit.mjs                                |   4 +
 src/browser.mjs                                    |  18 +-
 src/controller.mjs                                 | 503 ++++++++++--
 src/discovery-browser.mjs                          |  54 +-
 src/discovery.mjs                                  |   2 +-
 src/plan-quality.mjs                               |   3 +-
 src/plan-repair.mjs                                |  14 +-
 src/plan-semantics.mjs                             |  13 +
 src/planning-input.mjs                             |   5 +-
 src/plans.mjs                                      |   8 +
 src/report.mjs                                     |   1 +
 src/server.mjs                                     |  23 +-
 tests/agent-output.integration.mjs                 |  86 ++-
 tests/case-entry-url.test.mjs                      |   6 +-
 tests/discovery-controller.test.mjs                | 123 ++-
 tests/repair-contracts.test.mjs                    |  26 +
 29 files changed, 1929 insertions(+), 869 deletions(-)
```

### Untracked Files

```text
src/case-advice.mjs
src/dynamic-row-evidence.mjs
src/job-budget.mjs
src/preparation.mjs
src/query-capability.mjs
tests/job-budget.test.mjs
tests/preparation-ui.integration.mjs
tests/preparation.integration.mjs
tests/preparation.test.mjs
tests/query-capability.test.mjs
tests/workflow.integration.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-17T21:49:30+08:00
Command: node --test --test-concurrency=2 tests/autonomous-preparation.integration.mjs tests/discovery-browser.integration.mjs tests/preparation.integration.mjs tests/model-flow.integration.mjs
Exit code: 0
Parsed test count: 9
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: one preparation: manual login -> internal source repair -> missing-evidence probe/navigation -> audited candidate, no automatic approval
ok 1 - one preparation: manual login -> internal source repair -> missing-evidence probe/navigation -> audited candidate, no automatic approval
  ---
  duration_ms: 7090.7325
  type: 'test'
  ...
# Subtest: unknown initialization request does not kill navigation; action-induced write remains blocked
ok 2 - unknown initialization request does not kill navigation; action-induced write remains blocked
  ---
  duration_ms: 2737.2003
  type: 'test'
  ...
# Subtest: public or ambiguous page cannot silently count as login; waiting is cancellable
ok 3 - public or ambiguous page cannot silently count as login; waiting is cancellable
  ---
  duration_ms: 1435.2179
  type: 'test'
  ...
# Subtest: adapter cannot silently rebind an observed node or expose duplicate tables
ok 4 - adapter cannot silently rebind an observed node or expose duplicate tables
  ---
  duration_ms: 1165.0015
  type: 'test'
  ...
# Subtest: dismissing a login modal over a public shell and a visible OTP challenge are not login evidence
ok 5 - dismissing a login modal over a public shell and a visible OTP challenge are not login evidence
  ---
  duration_ms: 4949.2572
  type: 'test'
  ...
# Subtest: rejected live adapter keeps the login owner; leaf labels cannot bypass dangerous menu ancestors
ok 6 - rejected live adapter keeps the login owner; leaf labels cannot bypass dangerous menu ancestors
  ---
  duration_ms: 2494.4767
  type: 'test'
  ...
# {"scope":"Real headless Chromium against isolated authenticated local fixtures; zero model or product requests","scenarios":18,"results":["authenticated menu to page to add modal; save/delete/submit omitted","fixed handle rejects DOM replacement during model wait","read-only cross-origin CDN assets load; frame navigation and write remain blocked","unrelated clock and hover tooltip DOM changes preserve current candidate","dangerous target metadata change remains blocked","page URL change during model wait rejects stale choice","intent callback replacement is rechecked before dispatch","intent persistence failure prevents click","read-only POST requires explicit configuration","unexpected write blocked with method/path only","dangerous GET blocked","cross-origin navigation blocked without external request","native dialogs dismissed and popup closed","programmatic attachment click blocked before download","abort while waiting for intent blocks dispatch and preserves login","timeout bounds an unresponsive intent callback","max steps and repeated route loop are bounded","dangerous and cross-origin source routes rejected before navigation"],"login_count":1,"external_readonly_asset_requests":4,"external_navigation_or_write_requests":0,"write_requests":0}
# Subtest: tests\\discovery-browser.integration.mjs
ok 2 - tests\\discovery-browser.integration.mjs
  ---
  duration_ms: 34867.0686
  type: 'test'
  ...
# {"validated":true,"directory":"D:\\\\01_AI工程\\\\01_工程项目\\\\ui-test-agent\\\\validation\\\\model-flow-1789652992271","model_calls":6}
# Subtest: tests\\model-flow.integration.mjs
ok 3 - tests\\model-flow.integration.mjs
  ---
  duration_ms: 18924.5822
  type: 'test'
  ...
# {"validated":true,"contexts_at_overlap":3,"unexpected_business_writes":0,"url_checks":[true,true,true,false],"cancellation":"two workers closed, login preserved","real_model_calls":0,"directory":"D:\\\\01_AI工程\\\\01_工程项目\\\\ui-test-agent\\\\validation\\\\preparation-browser-1789653006769"}
# Subtest: tests\\preparation.integration.mjs
ok 4 - tests\\preparation.integration.mjs
  ---
  duration_ms: 7954.6288
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
# duration_ms 42848.8193
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-20260916-internal-beta; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

查询候选和计划补证的工程验证；真实模型复测尚未执行，不替代原用例/发布验收。
