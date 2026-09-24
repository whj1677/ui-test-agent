# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-24T23:46:27+08:00`
- Record: `REQ-0033-e2e-01-six-case-workbench`
- Change fingerprint: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test workbench/tests/qa-parser-regression.test.mjs workbench/tests/qa-lifecycle.test.mjs workbench/tests/qa-browser-semantics.test.mjs`
- Exit code: `0`
- Test count: `15`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/evidence/baseline-20260924/collector-qa.log`
- Log SHA-256: `16c5369fd87ecc52e0bb953d72ea934cc2b9443bf0776cbea7e571f39734cc71`

### Git Status

```text
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/delivery_evidence.md
?? docs/evidence/baseline-20260924/browser-local-retest/01-real-import-preview-1440x900.png
?? docs/evidence/baseline-20260924/browser-local-retest/02-cross-project-library-1440x900.png
?? docs/evidence/baseline-20260924/browser-local-retest/03-version-detail-1920x1080.png
?? docs/evidence/baseline-20260924/browser-local-retest/04-projects-1280x800.png
?? docs/evidence/baseline-20260924/browser-local-retest/05-restart-readback-1920x1080.png
?? docs/evidence/baseline-20260924/collector-qa.log
?? docs/evidence/baseline-20260924/dependency-scope.json
?? docs/evidence/baseline-20260924/gate-before.log
?? docs/evidence/baseline-20260924/run-01/install-browser.log
?? docs/evidence/baseline-20260924/run-01/install-harness.log
?? docs/evidence/baseline-20260924/run-01/install-root.log
?? docs/evidence/baseline-20260924/run-01/install-workbench.log
?? docs/evidence/baseline-20260924/run-01/result.json
?? docs/evidence/baseline-20260924/run-02/browser-history.log
?? docs/evidence/baseline-20260924/run-02/harness.log
?? docs/evidence/baseline-20260924/run-02/install-harness.log
?? docs/evidence/baseline-20260924/run-02/install-root.log
?? docs/evidence/baseline-20260924/run-02/install-workbench.log
?? docs/evidence/baseline-20260924/run-02/result.json
?? docs/evidence/baseline-20260924/run-02/workbench.log
?? docs/evidence/baseline-20260924/run-03/browser-auth.log
?? docs/evidence/baseline-20260924/run-03/browser-history.log
?? docs/evidence/baseline-20260924/run-03/browser-ui-d2a.log
?? docs/evidence/baseline-20260924/run-03/harness.log
?? docs/evidence/baseline-20260924/run-03/install-harness.log
?? docs/evidence/baseline-20260924/run-03/install-root.log
?? docs/evidence/baseline-20260924/run-03/install-workbench.log
?? docs/evidence/baseline-20260924/run-03/result.json
?? docs/evidence/baseline-20260924/run-03/workbench.log
?? docs/evidence/baseline-20260924/run-04/install-harness.log
?? docs/evidence/baseline-20260924/run-04/install-root.log
?? docs/evidence/baseline-20260924/run-04/install-workbench.log
?? docs/evidence/baseline-20260924/run-04/result.json
?? docs/evidence/baseline-20260924/run-04/workbench.log
?? docs/evidence/baseline-20260924/source-acceptance.json
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
 .../delivery_evidence.md                           | 706 ++++-----------------
 1 file changed, 134 insertions(+), 572 deletions(-)
```

### Untracked Files

```text
docs/evidence/baseline-20260924/browser-local-retest/01-real-import-preview-1440x900.png
docs/evidence/baseline-20260924/browser-local-retest/02-cross-project-library-1440x900.png
docs/evidence/baseline-20260924/browser-local-retest/03-version-detail-1920x1080.png
docs/evidence/baseline-20260924/browser-local-retest/04-projects-1280x800.png
docs/evidence/baseline-20260924/browser-local-retest/05-restart-readback-1920x1080.png
docs/evidence/baseline-20260924/collector-qa.log
docs/evidence/baseline-20260924/dependency-scope.json
docs/evidence/baseline-20260924/gate-before.log
docs/evidence/baseline-20260924/run-01/install-browser.log
docs/evidence/baseline-20260924/run-01/install-harness.log
docs/evidence/baseline-20260924/run-01/install-root.log
docs/evidence/baseline-20260924/run-01/install-workbench.log
docs/evidence/baseline-20260924/run-01/result.json
docs/evidence/baseline-20260924/run-02/browser-history.log
docs/evidence/baseline-20260924/run-02/harness.log
docs/evidence/baseline-20260924/run-02/install-harness.log
docs/evidence/baseline-20260924/run-02/install-root.log
docs/evidence/baseline-20260924/run-02/install-workbench.log
docs/evidence/baseline-20260924/run-02/result.json
docs/evidence/baseline-20260924/run-02/workbench.log
docs/evidence/baseline-20260924/run-03/browser-auth.log
docs/evidence/baseline-20260924/run-03/browser-history.log
docs/evidence/baseline-20260924/run-03/browser-ui-d2a.log
docs/evidence/baseline-20260924/run-03/harness.log
docs/evidence/baseline-20260924/run-03/install-harness.log
docs/evidence/baseline-20260924/run-03/install-root.log
docs/evidence/baseline-20260924/run-03/install-workbench.log
docs/evidence/baseline-20260924/run-03/result.json
docs/evidence/baseline-20260924/run-03/workbench.log
docs/evidence/baseline-20260924/run-04/install-harness.log
docs/evidence/baseline-20260924/run-04/install-root.log
docs/evidence/baseline-20260924/run-04/install-workbench.log
docs/evidence/baseline-20260924/run-04/result.json
docs/evidence/baseline-20260924/run-04/workbench.log
docs/evidence/baseline-20260924/source-acceptance.json
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-24T23:46:19+08:00
Command: node --test workbench/tests/qa-parser-regression.test.mjs workbench/tests/qa-lifecycle.test.mjs workbench/tests/qa-browser-semantics.test.mjs
Exit code: 0
Parsed test count: 15
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: engineering counterexamples: labels, live selection, visibility and scope (zero model)
ok 1 - engineering counterexamples: labels, live selection, visibility and scope (zero model)
  ---
  duration_ms: 3236.1791
  type: 'test'
  ...
# {"mode":"normal","integrity_state":"FINALIZED","registered_bytes":2367,"actual_bytes":2367,"registered_sha256":"69EEBEE184EEC8E6623DC42EB523A77BA9C1850D0F41AB86D14EC97A68797579","actual_sha256":"69EEBEE184EEC8E6623DC42EB523A77BA9C1850D0F41AB86D14EC97A68797579","last_event":"attempt_settled","events":["attempt_started","phase","phase","process_spawn","output_complete","process_close","phase","attempt_settled"]}
# Subtest: production lifecycle final indexing: normal, delayed append and close
ok 2 - production lifecycle final indexing: normal, delayed append and close
  ---
  duration_ms: 675.1368
  type: 'test'
  ...
# {"mode":"cancel","integrity_state":"FINALIZED","registered_bytes":2364,"actual_bytes":2364,"registered_sha256":"D18984FD02152A4B434BDC56AEF3E67C0E92757FF9BBC6422956F4EDFE85492C","actual_sha256":"D18984FD02152A4B434BDC56AEF3E67C0E92757FF9BBC6422956F4EDFE85492C","last_event":"attempt_error","events":["attempt_started","phase","phase","process_spawn","cancel_requested","output_complete","process_close","attempt_error"]}
# Subtest: production lifecycle final indexing: cancel, delayed append and close
ok 3 - production lifecycle final indexing: cancel, delayed append and close
  ---
  duration_ms: 316.1752
  type: 'test'
  ...
# {"mode":"exception","integrity_state":"FINALIZED","registered_bytes":2053,"actual_bytes":2053,"registered_sha256":"3BF8CE266DF7B50A5CE78E5900AA62D74A6C49734E0C96FED868C5FF7D80C986","actual_sha256":"3BF8CE266DF7B50A5CE78E5900AA62D74A6C49734E0C96FED868C5FF7D80C986","last_event":"attempt_error","events":["attempt_started","phase","phase","process_spawn","output_complete","process_close","attempt_error"]}
# Subtest: production lifecycle final indexing: exception, delayed append and close
ok 4 - production lifecycle final indexing: exception, delayed append and close
  ---
  duration_ms: 281.6757
  type: 'test'
  ...
# Subtest: original TC-005 raw report maps multiline values and the same failed step offline
ok 5 - original TC-005 raw report maps multiline values and the same failed step offline
  ---
  duration_ms: 15.2467
  type: 'test'
  ...
# Subtest: string
ok 6 - string
  ---
  duration_ms: 1.0104
  type: 'test'
  ...
# Subtest: ansi
ok 7 - ansi
  ---
  duration_ms: 0.2269
  type: 'test'
  ...
# Subtest: missing
ok 8 - missing
  ---
  duration_ms: 0.39
  type: 'test'
  ...
# Subtest: strict
ok 9 - strict
  ---
  duration_ms: 0.516
  type: 'test'
  ...
# Subtest: single side
ok 10 - single side
  ---
  duration_ms: 0.1578
  type: 'test'
  ...
# Subtest: timeout
ok 11 - timeout
  ---
  duration_ms: 0.4744
  type: 'test'
  ...
# Subtest: truncated array
ok 12 - truncated array
  ---
  duration_ms: 0.5957
  type: 'test'
  ...
# Subtest: truncated diff
ok 13 - truncated diff
  ---
  duration_ms: 0.5754
  type: 'test'
  ...
# Subtest: array
ok 14 - array
  ---
  duration_ms: 0.7439
  type: 'test'
  ...
# Subtest: structured matcher data precedes text without inventing single-sided actual
ok 15 - structured matcher data precedes text without inventing single-sided actual
  ---
  duration_ms: 0.4871
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4166.9075
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0033-e2e-01-six-case-workbench; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

QA归属：802e687解析、日志最终化和通用语义修复；本次受测完整源码35adcff1ade90a64eaae2a466530bd137e0910d8。源码已提交，当前行为差异为空；完整文件绑定见docs/evidence/baseline-20260924/source-acceptance.json。AUTH归REQ-0035，不合并产品成绩。
