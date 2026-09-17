# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-17T23:03:29+08:00`
- Record: `REQ-0004-multi-ui-fixtures`
- Change fingerprint: `0f2dc32acd64ef1ea4265bc890decbce455e06042968a911a5c282bd498211c1`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/acceptance-fixtures.test.mjs`
- Exit code: `0`
- Test count: `7`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0004-freeze-delivery.log`
- Log SHA-256: `6705c88484cb525947dcdfa083562cb392b33cd9f77cec73cdd779c1e31dee41`

### Git Status

```text
 M .gitattributes
 M docs/requirements/README.md
?? acceptance/README.md
?? acceptance/cases/devices.json
?? acceptance/cases/requests.json
?? acceptance/cases/work-orders.json
?? acceptance/check.mjs
?? acceptance/design-system/MASTER.md
?? acceptance/fixtures/devices/index.html
?? acceptance/fixtures/requests/app.js
?? acceptance/fixtures/requests/index.html
?? acceptance/fixtures/requests/style.css
?? acceptance/fixtures/work-orders/app.js
?? acceptance/fixtures/work-orders/index.html
?? acceptance/fixtures/work-orders/style.css
?? acceptance/manifest.json
?? acceptance/oracle.json
?? acceptance/serve.mjs
?? docs/requirements/REQ-0004-multi-ui-fixtures/00_user_requirement.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/01_development_requirement.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/02_design.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/03_tasks.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/04_verification.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/05_trace.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/change_log.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/current_state.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/delivery_evidence.md
?? docs/requirements/REQ-0004-multi-ui-fixtures/requirement.source.json
?? tests/acceptance-fixtures.integration.mjs
?? tests/acceptance-fixtures.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
 .gitattributes              | 4 ++++
 docs/requirements/README.md | 2 ++
 2 files changed, 6 insertions(+)
```

### Untracked Files

```text
acceptance/README.md
acceptance/cases/devices.json
acceptance/cases/requests.json
acceptance/cases/work-orders.json
acceptance/check.mjs
acceptance/design-system/MASTER.md
acceptance/fixtures/devices/index.html
acceptance/fixtures/requests/app.js
acceptance/fixtures/requests/index.html
acceptance/fixtures/requests/style.css
acceptance/fixtures/work-orders/app.js
acceptance/fixtures/work-orders/index.html
acceptance/fixtures/work-orders/style.css
acceptance/manifest.json
acceptance/oracle.json
acceptance/serve.mjs
docs/requirements/REQ-0004-multi-ui-fixtures/00_user_requirement.md
docs/requirements/REQ-0004-multi-ui-fixtures/01_development_requirement.md
docs/requirements/REQ-0004-multi-ui-fixtures/02_design.md
docs/requirements/REQ-0004-multi-ui-fixtures/03_tasks.md
docs/requirements/REQ-0004-multi-ui-fixtures/04_verification.md
docs/requirements/REQ-0004-multi-ui-fixtures/05_trace.md
docs/requirements/REQ-0004-multi-ui-fixtures/change_log.md
docs/requirements/REQ-0004-multi-ui-fixtures/current_state.md
docs/requirements/REQ-0004-multi-ui-fixtures/delivery_evidence.md
docs/requirements/REQ-0004-multi-ui-fixtures/requirement.source.json
tests/acceptance-fixtures.integration.mjs
tests/acceptance-fixtures.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-17T23:03:28+08:00
Command: node --test tests/acceptance-fixtures.test.mjs
Exit code: 0
Parsed test count: 7
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: controlled artifact manifest detects any byte drift
ok 1 - controlled artifact manifest detects any byte drift
  ---
  duration_ms: 7.8025
  type: 'test'
  ...
# Subtest: frozen baseline imports 24 unique cases without changing source semantics
ok 2 - frozen baseline imports 24 unique cases without changing source semantics
  ---
  duration_ms: 4.4072
  type: 'test'
  ...
# Subtest: classification freezes 19 normal, 3 defects and 2 boundaries; only two write cases
ok 3 - classification freezes 19 normal, 3 defects and 2 boundaries; only two write cases
  ---
  duration_ms: 2.9838
  type: 'test'
  ...
# Subtest: original eight cases and target HTML remain byte-identical to frozen historical inputs
ok 4 - original eight cases and target HTML remain byte-identical to frozen historical inputs
  ---
  duration_ms: 1.2124
  type: 'test'
  ...
# Subtest: HTTP whitelist never serves cases, oracle, source harness, traversal, or unknown SPA fallback
ok 5 - HTTP whitelist never serves cases, oracle, source harness, traversal, or unknown SPA fallback
  ---
  duration_ms: 96.0027
  type: 'test'
  ...
# Subtest: synthetic CRUD validates auth, field bounds, media type, size and exact duplicate ownership
ok 6 - synthetic CRUD validates auth, field bounds, media type, size and exact duplicate ownership
  ---
  duration_ms: 39.9361
  type: 'test'
  ...
# Subtest: seed records reject mutation and independent server instances reset all CRUD state
ok 7 - seed records reject mutation and independent server instances reset all CRUD state
  ---
  duration_ms: 11.7626
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 284.359
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0004-multi-ui-fixtures; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

本次7项冻结/导入/HTTP/API检查；同版32项真实浏览器参考检查见REQ-0004-reference.log与REQ-0004-delivery.log，397项工程回归见REQ-0004-runtime.log。初次门禁仅缺模块无影响理由，旧收集文件已保存在validation/REQ-0004-first-collection.md；不代表Agent真实执行或发布就绪。
