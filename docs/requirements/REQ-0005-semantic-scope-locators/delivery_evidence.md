# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-17T23:35:22+08:00`
- Record: `REQ-0005-semantic-scope-locators`
- Change fingerprint: `008655c1b9134a2a6b798a332cdd72e2f842c23e13a5a4c7c430ded580cab2cb`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/semantic-scope.test.mjs`
- Exit code: `0`
- Test count: `17`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0005-delivery.log`
- Log SHA-256: `4d2702597a78a4908fe8c8300db7a26ae1311ff1997bdc7bc98be4ecf316b829`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M src/block-audit.mjs
 M src/browser.mjs
 M src/discovery-browser.mjs
 M src/plan-feedback.mjs
 M src/plan-quality.mjs
 M src/plan-semantics.mjs
 M src/plan-staged.mjs
 M src/plans.mjs
 M src/recovery-gap.mjs
 M src/report-view.mjs
 M src/row-locator.mjs
?? docs/requirements/REQ-0005-semantic-scope-locators/00_user_requirement.md
?? docs/requirements/REQ-0005-semantic-scope-locators/01_development_requirement.md
?? docs/requirements/REQ-0005-semantic-scope-locators/02_design.md
?? docs/requirements/REQ-0005-semantic-scope-locators/03_tasks.md
?? docs/requirements/REQ-0005-semantic-scope-locators/04_verification.md
?? docs/requirements/REQ-0005-semantic-scope-locators/05_trace.md
?? docs/requirements/REQ-0005-semantic-scope-locators/change_log.md
?? docs/requirements/REQ-0005-semantic-scope-locators/current_state.md
?? docs/requirements/REQ-0005-semantic-scope-locators/delivery_evidence.md
?? docs/requirements/REQ-0005-semantic-scope-locators/requirement.source.json
?? src/scope-guidance.mjs
?? src/within-locator.mjs
?? tests/semantic-scope.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/block-audit.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery-browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-feedback.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-quality.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-staged.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plans.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/recovery-gap.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/report-view.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/row-locator.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md |   6 ++
 docs/requirements/README.md     |   2 +
 src/block-audit.mjs             |   2 +
 src/browser.mjs                 | 179 +++++++++++++++++++++++++++-------------
 src/discovery-browser.mjs       | 152 +++++++++++++++++++---------------
 src/plan-feedback.mjs           |  10 ++-
 src/plan-quality.mjs            |   6 +-
 src/plan-semantics.mjs          |  53 +++++++++++-
 src/plan-staged.mjs             |   3 +-
 src/plans.mjs                   |  35 +++++++-
 src/recovery-gap.mjs            |   4 +-
 src/report-view.mjs             |   4 +-
 src/row-locator.mjs             |  15 ++--
 13 files changed, 333 insertions(+), 138 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0005-semantic-scope-locators/00_user_requirement.md
docs/requirements/REQ-0005-semantic-scope-locators/01_development_requirement.md
docs/requirements/REQ-0005-semantic-scope-locators/02_design.md
docs/requirements/REQ-0005-semantic-scope-locators/03_tasks.md
docs/requirements/REQ-0005-semantic-scope-locators/04_verification.md
docs/requirements/REQ-0005-semantic-scope-locators/05_trace.md
docs/requirements/REQ-0005-semantic-scope-locators/change_log.md
docs/requirements/REQ-0005-semantic-scope-locators/current_state.md
docs/requirements/REQ-0005-semantic-scope-locators/delivery_evidence.md
docs/requirements/REQ-0005-semantic-scope-locators/requirement.source.json
src/scope-guidance.mjs
src/within-locator.mjs
tests/semantic-scope.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-17T23:35:04+08:00
Command: node --test tests/semantic-scope.test.mjs
Exit code: 0
Parsed test count: 17
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: frozen card site exposes all repeated detail actions with exact container identities
ok 1 - frozen card site exposes all repeated detail actions with exact container identities
  ---
  duration_ms: 2797.7144
  type: 'test'
  ...
# Subtest: frozen request list scopes near-name edit/delete actions by own heading, not substring
ok 2 - frozen request list scopes near-name edit/delete actions by own heading, not substring
  ---
  duration_ms: 1352.439
  type: 'test'
  ...
# Subtest: within schema is one-level, exact, bounded and has a single identity mode
ok 3 - within schema is one-level, exact, bounded and has a single identity mode
  ---
  duration_ms: 0.5444
  type: 'test'
  ...
# Subtest: current unnamed listitems can be resolved with exact heading ownership
ok 4 - current unnamed listitems can be resolved with exact heading ownership
  ---
  duration_ms: 707.2357
  type: 'test'
  ...
# Subtest: ambiguous containers, hidden collisions, borrowed headings and foreign targets are refused
ok 5 - ambiguous containers, hidden collisions, borrowed headings and foreign targets are refused
  ---
  duration_ms: 750.3932
  type: 'test'
  ...
# Subtest: dialog fields retain exact native labels and custom adapters cannot change their identity
ok 6 - dialog fields retain exact native labels and custom adapters cannot change their identity
  ---
  duration_ms: 789.835
  type: 'test'
  ...
# Subtest: event-time guard refuses recycled, moved or newly duplicated business identities before click
ok 7 - event-time guard refuses recycled, moved or newly duplicated business identities before click
  ---
  duration_ms: 780.5094
  type: 'test'
  ...
# Subtest: guard allows reorder of the same objects and releases listeners after refusal
ok 8 - guard allows reorder of the same objects and releases listeners after refusal
  ---
  duration_ms: 750.5107
  type: 'test'
  ...
# Subtest: identity cannot change in the guard capture handshake and become its new baseline
ok 9 - identity cannot change in the guard capture handshake and become its new baseline
  ---
  duration_ms: 743.2802
  type: 'test'
  ...
# Subtest: keyboard submission is refused when the owned record identity changes on keydown
ok 10 - keyboard submission is refused when the owned record identity changes on keydown
  ---
  duration_ms: 814.3981
  type: 'test'
  ...
# Subtest: scope semantics need original identity and observed structure, never page-derived expected values
ok 11 - scope semantics need original identity and observed structure, never page-derived expected values
  ---
  duration_ms: 2.407
  type: 'test'
  ...
# Subtest: discovery exposes separate scoped opaque candidates and does not authorize destructive controls
ok 12 - discovery exposes separate scoped opaque candidates and does not authorize destructive controls
  ---
  duration_ms: 2286.7722
  type: 'test'
  ...
# Subtest: discovery refuses identity changes during evidence callbacks without any business click
ok 13 - discovery refuses identity changes during evidence callbacks without any business click
  ---
  duration_ms: 1589.7899
  type: 'test'
  ...
# Subtest: scoped discovery actions remain behind the existing network write guard
ok 14 - scoped discovery actions remain behind the existing network write guard
  ---
  duration_ms: 1546.5797
  type: 'test'
  ...
# Subtest: locator repair can change the inner technical binding but never the business scope
ok 15 - locator repair can change the inner technical binding but never the business scope
  ---
  duration_ms: 5.8938
  type: 'test'
  ...
# Subtest: scope diagnostics distinguish candidate repair from missing targeted evidence
ok 16 - scope diagnostics distinguish candidate repair from missing targeted evidence
  ---
  duration_ms: 1.0367
  type: 'test'
  ...
# Subtest: atomic assertions bind the exact scoped object and distinguish missing from duplicate identities
ok 17 - atomic assertions bind the exact scoped object and distinguish missing from duplicate identities
  ---
  duration_ms: 779.621
  type: 'test'
  ...
1..17
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16118.5016
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0005-semantic-scope-locators; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

限定范围定位17项专项与414项非暂停工程；未调用模型，不代表发布验收。
