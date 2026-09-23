# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-23T09:17:46+08:00`
- Record: `REQ-0032-test-site-six-cases`
- Change fingerprint: `618569e1605c8209f17ee58ded1f832dbdf66d65de3a85e3c83ec3b2006c8ee8`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test workbench/tests/ui-six-cases.test.mjs`
- Exit code: `0`
- Test count: `2`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0032-test-site-six-cases/logs/ui-six-cases-tests.log`
- Log SHA-256: `75cd35f1cc3ba8576bf6d80a6fa2bca5a257bc2fc4e3b8b73839635dedcc0ada`

### Git Status

```text
 M docs/requirements/README.md
 M workbench/package.json
?? docs/requirements/REQ-0032-test-site-six-cases/00_user_requirement.md
?? docs/requirements/REQ-0032-test-site-six-cases/01_development_requirement.md
?? docs/requirements/REQ-0032-test-site-six-cases/02_design.md
?? docs/requirements/REQ-0032-test-site-six-cases/03_tasks.md
?? docs/requirements/REQ-0032-test-site-six-cases/04_verification.md
?? docs/requirements/REQ-0032-test-site-six-cases/05_trace.md
?? docs/requirements/REQ-0032-test-site-six-cases/change_log.md
?? docs/requirements/REQ-0032-test-site-six-cases/current_state.md
?? docs/requirements/REQ-0032-test-site-six-cases/delivery_evidence.md
?? docs/requirements/REQ-0032-test-site-six-cases/logs/ui-six-cases-tests.log
?? docs/requirements/REQ-0032-test-site-six-cases/logs/workbench-tests-rerun.log
?? docs/requirements/REQ-0032-test-site-six-cases/logs/workbench-tests.log
?? docs/requirements/REQ-0032-test-site-six-cases/requirement.source.json
?? workbench/examples/ui-six-cases/UI_TRIAL_6_CASES.workbench.json
?? workbench/examples/ui-six-cases/UI_TRIAL_6_CASES.xlsx
?? workbench/tests/ui-six-cases.test.mjs
?? workbench/trial-site/EXPECTED_OUTCOMES.md
?? workbench/trial-site/FROZEN_SPEC.md
?? workbench/trial-site/REFERENCE_SELF_CHECK.md
?? workbench/trial-site/USER_GUIDE.md
?? workbench/trial-site/app.js
?? workbench/trial-site/index.html
?? workbench/trial-site/reference/playwright.config.mjs
?? workbench/trial-site/reference/six-cases.spec.mjs
?? workbench/trial-site/server.mjs
?? workbench/trial-site/styles.css
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
 docs/requirements/README.md | 2 ++
 workbench/package.json      | 2 ++
 2 files changed, 4 insertions(+)
```

### Untracked Files

```text
docs/requirements/REQ-0032-test-site-six-cases/00_user_requirement.md
docs/requirements/REQ-0032-test-site-six-cases/01_development_requirement.md
docs/requirements/REQ-0032-test-site-six-cases/02_design.md
docs/requirements/REQ-0032-test-site-six-cases/03_tasks.md
docs/requirements/REQ-0032-test-site-six-cases/04_verification.md
docs/requirements/REQ-0032-test-site-six-cases/05_trace.md
docs/requirements/REQ-0032-test-site-six-cases/change_log.md
docs/requirements/REQ-0032-test-site-six-cases/current_state.md
docs/requirements/REQ-0032-test-site-six-cases/delivery_evidence.md
docs/requirements/REQ-0032-test-site-six-cases/logs/ui-six-cases-tests.log
docs/requirements/REQ-0032-test-site-six-cases/logs/workbench-tests-rerun.log
docs/requirements/REQ-0032-test-site-six-cases/logs/workbench-tests.log
docs/requirements/REQ-0032-test-site-six-cases/requirement.source.json
workbench/examples/ui-six-cases/UI_TRIAL_6_CASES.workbench.json
workbench/examples/ui-six-cases/UI_TRIAL_6_CASES.xlsx
workbench/tests/ui-six-cases.test.mjs
workbench/trial-site/EXPECTED_OUTCOMES.md
workbench/trial-site/FROZEN_SPEC.md
workbench/trial-site/REFERENCE_SELF_CHECK.md
workbench/trial-site/USER_GUIDE.md
workbench/trial-site/app.js
workbench/trial-site/index.html
workbench/trial-site/reference/playwright.config.mjs
workbench/trial-site/reference/six-cases.spec.mjs
workbench/trial-site/server.mjs
workbench/trial-site/styles.css
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-23T09:17:44+08:00
Command: node --test workbench/tests/ui-six-cases.test.mjs
Exit code: 0
Parsed test count: 2
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: six-case xlsx uses the supported mapping and preserves paired business expectations
ok 1 - six-case xlsx uses the supported mapping and preserves paired business expectations
  ---
  duration_ms: 78.1393
  type: 'test'
  ...
# Subtest: committed six-case json is a formal backend package and reimports all six cases
ok 2 - committed six-case json is a formal backend package and reimports all six cases
  ---
  duration_ms: 24.5199
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 521.1801
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0032-test-site-six-cases; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

TEST-SITE-01文件解析与正式JSON复导专项；参考3通过/3指定业务失败见workbench/trial-site/REFERENCE_SELF_CHECK.md
