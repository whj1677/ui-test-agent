# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T03:14:30+08:00`
- Record: `REQ-0012-ui-experience-memory`
- Change fingerprint: `3ed4a1e65cac0bd791a22fdd5643b65a060d64b498ab7b7d681e8d29f262be9c`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs tests/preparation.test.mjs`
- Exit code: `0`
- Test count: `52`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0012-delivery-scoped.log`
- Log SHA-256: `77cd1dcd3824f453ac7d53e2f6fa8b3be70ba25596c16957910bb201693accbc`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0012-ui-experience-memory/00_user_requirement.md
 M docs/requirements/REQ-0012-ui-experience-memory/02_design.md
 M docs/requirements/REQ-0012-ui-experience-memory/03_tasks.md
 M docs/requirements/REQ-0012-ui-experience-memory/04_verification.md
 M docs/requirements/REQ-0012-ui-experience-memory/05_trace.md
 M docs/requirements/REQ-0012-ui-experience-memory/change_log.md
 M docs/requirements/REQ-0012-ui-experience-memory/current_state.md
 M docs/requirements/REQ-0012-ui-experience-memory/requirement.source.json
 M src/controller.mjs
 M src/discovery-browser.mjs
 M src/server.mjs
 M src/within-locator.mjs
 M tests/discovery.integration.mjs
 M tests/preparation.test.mjs
 M 试用说明.md
?? docs/requirements/REQ-0012-ui-experience-memory/delivery_evidence.md
?? src/ui-experience-evidence.mjs
?? src/ui-experience.mjs
?? src/ui-patterns.mjs
?? tests/ui-experience-flow.test.mjs
?? tests/ui-experience.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0012-ui-experience-memory/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery-browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/server.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/within-locator.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/preparation.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '试用说明.md', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   8 +
 .../00_user_requirement.md                         |   9 +-
 .../REQ-0012-ui-experience-memory/02_design.md     |   6 +-
 .../REQ-0012-ui-experience-memory/03_tasks.md      |  10 +-
 .../04_verification.md                             |  23 ++-
 .../REQ-0012-ui-experience-memory/05_trace.md      |  10 +-
 .../REQ-0012-ui-experience-memory/change_log.md    |   1 +
 .../REQ-0012-ui-experience-memory/current_state.md |  20 +-
 .../requirement.source.json                        | 216 ++++++++++-----------
 src/controller.mjs                                 |  50 +++++
 src/discovery-browser.mjs                          |  18 +-
 src/server.mjs                                     |   4 +
 src/within-locator.mjs                             |   8 +-
 tests/discovery.integration.mjs                    |  20 ++
 tests/preparation.test.mjs                         |  13 +-
 ...257\225\347\224\250\350\257\264\346\230\216.md" |  10 +
 16 files changed, 280 insertions(+), 146 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0012-ui-experience-memory/delivery_evidence.md
src/ui-experience-evidence.mjs
src/ui-experience.mjs
src/ui-patterns.mjs
tests/ui-experience-flow.test.mjs
tests/ui-experience.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T03:14:00+08:00
Command: node --test tests/ui-experience.test.mjs tests/ui-experience-flow.test.mjs tests/semantic-scope.test.mjs tests/preparation.test.mjs
Exit code: 0
Parsed test count: 52
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: targeted recovery distinguishes fixed values/states and retains the last permitted action evidence
ok 1 - targeted recovery distinguishes fixed values/states and retains the last permitted action evidence
  ---
  duration_ms: 380.3151
  type: 'test'
  ...
# Subtest: case budgets grow with steps/obligations and preserve a bounded wall protection
ok 2 - case budgets grow with steps/obligations and preserve a bounded wall protection
  ---
  duration_ms: 0.8965
  type: 'test'
  ...
# Subtest: first Case timeout preserves partial evidence and does not prevent the remaining 7+1 batch selection
ok 3 - first Case timeout preserves partial evidence and does not prevent the remaining 7+1 batch selection
  ---
  duration_ms: 4260.9959
  type: 'test'
  ...
# Subtest: discovery and planning each receive their own time window, not a shared cumulative deadline
ok 4 - discovery and planning each receive their own time window, not a shared cumulative deadline
  ---
  duration_ms: 4698.9199
  type: 'test'
  ...
# Subtest: plan timeout retains captured pages and next invocation reuses them without resetting usage
ok 5 - plan timeout retains captured pages and next invocation reuses them without resetting usage
  ---
  duration_ms: 878.4381
  type: 'test'
  ...
# Subtest: two workers overlap but have isolated contexts, request attribution and unapproved plans
ok 6 - two workers overlap but have isolated contexts, request attribution and unapproved plans
  ---
  duration_ms: 952.2211
  type: 'test'
  ...
# Subtest: serial is default and parallel requires an explicit independent-read-only declaration
ok 7 - serial is default and parallel requires an explicit independent-read-only declaration
  ---
  duration_ms: 300.6654
  type: 'test'
  ...
# Subtest: global timeout retains queued Cases and user cancellation is not a technical failure
ok 8 - global timeout retains queued Cases and user cancellation is not a technical failure
  ---
  duration_ms: 381.4169
  type: 'test'
  ...
# Subtest: context change invalidates the discovery checkpoint instead of recycling another session
ok 9 - context change invalidates the discovery checkpoint instead of recycling another session
  ---
  duration_ms: 274.3236
  type: 'test'
  ...
# Subtest: input advice is a draft: reject keeps Case; accept requires matching version and keeps original history
ok 10 - input advice is a draft: reject keeps Case; accept requires matching version and keeps original history
  ---
  duration_ms: 235.1433
  type: 'test'
  ...
# Subtest: only original input issues can yield revision suggestions; capability/time failure cannot manufacture an oracle change
ok 11 - only original input issues can yield revision suggestions; capability/time failure cannot manufacture an oracle change
  ---
  duration_ms: 0.5139
  type: 'test'
  ...
# Subtest: model permit queue is bounded and cancellation does not strand the next waiter
ok 12 - model permit queue is bounded and cancellation does not strand the next waiter
  ---
  duration_ms: 0.3566
  type: 'test'
  ...
# Subtest: frozen card site exposes all repeated detail actions with exact container identities
ok 13 - frozen card site exposes all repeated detail actions with exact container identities
  ---
  duration_ms: 2885.5557
  type: 'test'
  ...
# Subtest: frozen request list scopes near-name edit/delete actions by own heading, not substring
ok 14 - frozen request list scopes near-name edit/delete actions by own heading, not substring
  ---
  duration_ms: 1588.9749
  type: 'test'
  ...
# Subtest: within schema is one-level, exact, bounded and has a single identity mode
ok 15 - within schema is one-level, exact, bounded and has a single identity mode
  ---
  duration_ms: 0.7661
  type: 'test'
  ...
# Subtest: current unnamed listitems can be resolved with exact heading ownership
ok 16 - current unnamed listitems can be resolved with exact heading ownership
  ---
  duration_ms: 717.8631
  type: 'test'
  ...
# Subtest: ambiguous containers, hidden collisions, borrowed headings and foreign targets are refused
ok 17 - ambiguous containers, hidden collisions, borrowed headings and foreign targets are refused
  ---
  duration_ms: 771.6404
  type: 'test'
  ...
# Subtest: dialog fields retain exact native labels and custom adapters cannot change their identity
ok 18 - dialog fields retain exact native labels and custom adapters cannot change their identity
  ---
  duration_ms: 924.3258
  type: 'test'
  ...
# Subtest: event-time guard refuses recycled, moved or newly duplicated business identities before click
ok 19 - event-time guard refuses recycled, moved or newly duplicated business identities before click
  ---
  duration_ms: 868.8374
  type: 'test'
  ...
# Subtest: guard allows reorder of the same objects and releases listeners after refusal
ok 20 - guard allows reorder of the same objects and releases listeners after refusal
  ---
  duration_ms: 768.5347
  type: 'test'
  ...
# Subtest: identity cannot change in the guard capture handshake and become its new baseline
ok 21 - identity cannot change in the guard capture handshake and become its new baseline
  ---
  duration_ms: 1220.2048
  type: 'test'
  ...
# Subtest: keyboard submission is refused when the owned record identity changes on keydown
ok 22 - keyboard submission is refused when the owned record identity changes on keydown
  ---
  duration_ms: 745.7218
  type: 'test'
  ...
# Subtest: scope semantics need original identity and observed structure, never page-derived expected values
ok 23 - scope semantics need original identity and observed structure, never page-derived expected values
  ---
  duration_ms: 3.7056
  type: 'test'
  ...
# Subtest: discovery exposes separate scoped opaque candidates and does not authorize destructive controls
ok 24 - discovery exposes separate scoped opaque candidates and does not authorize destructive controls
  ---
  duration_ms: 2480.066
  type: 'test'
  ...
# Subtest: discovery refuses identity changes during evidence callbacks without any business click
ok 25 - discovery refuses identity changes during evidence callbacks without any business click
  ---
  duration_ms: 1684.6787
  type: 'test'
  ...
# Subtest: scoped discovery actions remain behind the existing network write guard
ok 26 - scoped discovery actions remain behind the existing network write guard
  ---
  duration_ms: 1655.3939
  type: 'test'
  ...
# Subtest: locator repair can change the inner technical binding but never the business scope
ok 27 - locator repair can change the inner technical binding but never the business scope
  ---
  duration_ms: 3.1542
  type: 'test'
  ...
# Subtest: scope diagnostics distinguish candidate repair from missing targeted evidence
ok 28 - scope diagnostics distinguish candidate repair from missing targeted evidence
  ---
  duration_ms: 0.9549
  type: 'test'
  ...
# Subtest: atomic assertions bind the exact scoped object and distinguish missing from duplicate identities
ok 29 - atomic assertions bind the exact scoped object and distinguish missing from duplicate identities
  ---
  duration_ms: 699.2921
  type: 'test'
  ...
# Subtest: product discovery collects across jobs; restart retrieves advice without expanding candidates
    # Subtest: three real discovery jobs quarantine then qualify one technical rule
    ok 1 - three real discovery jobs quarantine then qualify one technical rule
      ---
      duration_ms: 9613.6574
      type: 'test'
      ...
    # Subtest: new controller loads disk history; assist is advice, not candidate permission
    ok 2 - new controller loads disk history; assist is advice, not candidate permission
      ---
      duration_ms: 3487.9387
      type: 'test'
      ...
    # Subtest: off does not update the existing store and keeps original model envelope
    ok 3 - off does not update the existing store and keeps original model envelope
      ---
      duration_ms: 3858.1539
      type: 'test'
      ...
    # Subtest: product counterexample revokes history and preserves the original action failure
    ok 4 - product counterexample revokes history and preserves the original action failure
      ---
      duration_ms: 6593.5459
      type: 'test'
      ...
    # Subtest: actual corrupt store falls back while original discovery remains usable
    ok 5 - actual corrupt store falls back while original discovery remains usable
      ---
      duration_ms: 3404.3423
      type: 'test'
      ...
# {"artifact":"D:\\\\01_AI工程\\\\01_工程项目\\\\ui-test-agent\\\\validation\\\\experience-flow-2f53PD","model":"injected provider only","real_model_calls":0,"business_writes":0}
    1..5
ok 30 - product discovery collects across jobs; restart retrieves advice without expanding candidates
  ---
  duration_ms: 27812.7047
  type: 'test'
  ...
# Subtest: invalid experience config rejects before creating a data lock
ok 31 - invalid experience config rejects before creating a data lock
  ---
  duration_ms: 1.3319
  type: 'test'
  ...
# Subtest: bounded authored catalog never echoes text, answers or invented layers
ok 32 - bounded authored catalog never echoes text, answers or invented layers
  ---
  duration_ms: 1.7626
  type: 'test'
  ...
# Subtest: real browser receipts, isolated learning, withdrawal and fault fallback
    # Subtest: a valid idle guard without a dispatched operation is not positive evidence
    ok 1 - a valid idle guard without a dispatched operation is not positive evidence
      ---
      duration_ms: 166.988
      type: 'test'
      ...
    # Subtest: synthetic page-dispatched events do not earn positive evidence
    ok 2 - synthetic page-dispatched events do not earn positive evidence
      ---
      duration_ms: 153.8082
      type: 'test'
      ...
    # Subtest: no model/self-report JSON can create a learning receipt
    ok 3 - no model/self-report JSON can create a learning receipt
      ---
      duration_ms: 0.7284
      type: 'test'
      ...
    # Subtest: observe records once per job without changing advice/model input
    ok 4 - observe records once per job without changing advice/model input
      ---
      duration_ms: 163.0547
      type: 'test'
      ...
    # Subtest: promotion needs three distinct jobs, is frozen until next job and survives restart
    ok 5 - promotion needs three distinct jobs, is frozen until next job and survives restart
      ---
      duration_ms: 334.3916
      type: 'test'
      ...
    # Subtest: origin and current structure are required for historical relevance
    ok 6 - origin and current structure are required for historical relevance
      ---
      duration_ms: 0.4402
      type: 'test'
      ...
    # Subtest: growth and successful clicks do not prove a changed target stayed grounded
    ok 7 - growth and successful clicks do not prove a changed target stayed grounded
      ---
      duration_ms: 151.5024
      type: 'test'
      ...
    # Subtest: real guard detects moved identity; one counterexample withdraws frozen advice
    ok 8 - real guard detects moved identity; one counterexample withdraws frozen advice
      ---
      duration_ms: 148.8038
      type: 'test'
      ...
    # Subtest: expired evidence cannot promote an entry after restart
    ok 9 - expired evidence cannot promote an entry after restart
      ---
      duration_ms: 527.8861
      type: 'test'
      ...
    # Subtest: off neither reads nor writes the corrupt store
    ok 10 - off neither reads nor writes the corrupt store
      ---
      duration_ms: 202.3648
      type: 'test'
      ...
    # Subtest: corrupt, oversized, version-mismatched and linked stores visibly degrade without overwrite
    ok 11 - corrupt, oversized, version-mismatched and linked stores visibly degrade without overwrite
      ---
      duration_ms: 1135.4953
      type: 'test'
      ...
    # Subtest: external replacement is not overwritten by the next valid receipt
    ok 12 - external replacement is not overwritten by the next valid receipt
      ---
      duration_ms: 288.1675
      type: 'test'
      ...
    # Subtest: concurrent job updates serialize and retain three independent samples
    ok 13 - concurrent job updates serialize and retain three independent samples
      ---
      duration_ms: 790.785
      type: 'test'
      ...
    # Subtest: failed atomic replacement preserves the previous bytes and disables learning
    ok 14 - failed atomic replacement preserves the previous bytes and disables learning
      ---
      duration_ms: 511.1273
      type: 'test'
      ...
    1..14
ok 33 - real browser receipts, isolated learning, withdrawal and fault fallback
  ---
  duration_ms: 5440.5585
  type: 'test'
  ...
1..33
# tests 52
# suites 0
# pass 52
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 28477.4756
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0012-ui-experience-memory; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

本机范围：52项经验/产品/范围定位/调度组合，真实Chromium+注入模型。完整同产品构建593项另见delivery-final.log（TTL测试补强前），两集合重叠不相加。实际模型0调用；初始产品反例、测试初稿、593项1失败及两份文档检查失败历史均保留。原24例/4179不变。
