# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T09:19:22+08:00`
- Record: `REQ-0013-discovery-observability`
- Change fingerprint: `8c4ea4dd47fd3a1faaf7026716be23ffe03173671c4d07febe408dbdf8cb94bd`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/discovery-observability.test.mjs tests/discovery.test.mjs tests/discovery-controller.test.mjs tests/discovery-controls.test.mjs`
- Exit code: `0`
- Test count: `69`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0013-diagnostics-final.log`
- Log SHA-256: `958765a8fa7e2c4cc8c5d4c3653abd7f3ce76b45b6dd5a8e81a6d3fd1af3661f`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0013-discovery-observability/02_design.md
 M docs/requirements/REQ-0013-discovery-observability/03_tasks.md
 M docs/requirements/REQ-0013-discovery-observability/04_verification.md
 M docs/requirements/REQ-0013-discovery-observability/05_trace.md
 M docs/requirements/REQ-0013-discovery-observability/current_state.md
 M docs/requirements/REQ-0013-discovery-observability/delivery_evidence.md
 M docs/requirements/REQ-0013-discovery-observability/requirement.source.json
 M public/app.js
 M src/browser.mjs
 M src/controller.mjs
 M src/discovery-browser.mjs
 M tests/agent-output.integration.mjs
 M tests/discovery-observability.test.mjs
?? src/observation-diagnostics.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0013-discovery-observability/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0013-discovery-observability/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0013-discovery-observability/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0013-discovery-observability/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0013-discovery-observability/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0013-discovery-observability/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0013-discovery-observability/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery-browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/agent-output.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-observability.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 .../REQ-0013-discovery-observability/02_design.md  |   2 +-
 .../REQ-0013-discovery-observability/03_tasks.md   |   2 +-
 .../04_verification.md                             |   4 +-
 .../REQ-0013-discovery-observability/05_trace.md   |   2 +-
 .../current_state.md                               |   6 +-
 .../delivery_evidence.md                           | 361 +++++++++++++--------
 .../requirement.source.json                        |  19 +-
 public/app.js                                      |  56 +++-
 src/browser.mjs                                    |  13 +-
 src/controller.mjs                                 |  16 +
 src/discovery-browser.mjs                          | 133 +++++---
 tests/agent-output.integration.mjs                 |  47 +++
 tests/discovery-observability.test.mjs             |  74 +++++
 14 files changed, 542 insertions(+), 195 deletions(-)
```

### Untracked Files

```text
src/observation-diagnostics.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T09:18:49+08:00
Command: node --test tests/discovery-observability.test.mjs tests/discovery.test.mjs tests/discovery-controller.test.mjs tests/discovery-controls.test.mjs
Exit code: 0
Parsed test count: 69
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: one authentication starts autonomous discovery then prepares an unapproved plan without changing the baseline
ok 1 - one authentication starts autonomous discovery then prepares an unapproved plan without changing the baseline
  ---
  duration_ms: 305.8912
  type: 'test'
  ...
# Subtest: unreviewed cases receive discovery observations but no generated or approved plan
ok 2 - unreviewed cases receive discovery observations but no generated or approved plan
  ---
  duration_ms: 163.3609
  type: 'test'
  ...
# Subtest: unknown discovery candidate is never dispatched or converted into a plan
ok 3 - unknown discovery candidate is never dispatched or converted into a plan
  ---
  duration_ms: 108.7953
  type: 'test'
  ...
# Subtest: cancelled late action response cannot dispatch UI or generate a plan
ok 4 - cancelled late action response cannot dispatch UI or generate a plan
  ---
  duration_ms: 71.8626
  type: 'test'
  ...
# Subtest: cancelled late done response cannot dispatch UI or generate a plan
ok 5 - cancelled late done response cannot dispatch UI or generate a plan
  ---
  duration_ms: 71.4406
  type: 'test'
  ...
# Subtest: the same observed state and action is removed so the model can finish instead of looping
ok 6 - the same observed state and action is removed so the model can finish instead of looping
  ---
  duration_ms: 170.3224
  type: 'test'
  ...
# Subtest: discovery budget scales by selected Case count instead of stopping at a shared 24 calls
ok 7 - discovery budget scales by selected Case count instead of stopping at a shared 24 calls
  ---
  duration_ms: 1534.6315
  type: 'test'
  ...
# Subtest: a Case step budget blocks only that Case and continues to later Cases
ok 8 - a Case step budget blocks only that Case and continues to later Cases
  ---
  duration_ms: 811.9825
  type: 'test'
  ...
# Subtest: selected Cases beyond one bounded batch continue automatically in later batches
ok 9 - selected Cases beyond one bounded batch continue automatically in later batches
  ---
  duration_ms: 777.1401
  type: 'test'
  ...
# Subtest: automatic discovery resumes budget-blocked Cases before recapturing completed Cases
ok 10 - automatic discovery resumes budget-blocked Cases before recapturing completed Cases
  ---
  duration_ms: 104.6716
  type: 'test'
  ...
# Subtest: diagnostic I/O failure before an approved discovery dispatch stops the job and closes the explorer
ok 11 - diagnostic I/O failure before an approved discovery dispatch stops the job and closes the explorer
  ---
  duration_ms: 74.6179
  type: 'test'
  ...
# Subtest: a blocked Case does not prevent later Cases from being discovered and prepared
ok 12 - a blocked Case does not prevent later Cases from being discovered and prepared
  ---
  duration_ms: 269.3959
  type: 'test'
  ...
# Subtest: one action timeout is isolated to its Case and every Case starts a fresh loop allowance
ok 13 - one action timeout is isolated to its Case and every Case starts a fresh loop allowance
  ---
  duration_ms: 302.4478
  type: 'test'
  ...
# Subtest: automatic discovery reports FIXTURE_PRESET instead of opening an explorer
ok 14 - automatic discovery reports FIXTURE_PRESET instead of opening an explorer
  ---
  duration_ms: 13.6074
  type: 'test'
  ...
# Subtest: automatic discovery reports DEEPSEEK_KEY_REQUIRED instead of opening an explorer
ok 15 - automatic discovery reports DEEPSEEK_KEY_REQUIRED instead of opening an explorer
  ---
  duration_ms: 12.0322
  type: 'test'
  ...
# Subtest: automatic discovery reports NO_UNEXECUTED_CASES instead of opening an explorer
ok 16 - automatic discovery reports NO_UNEXECUTED_CASES instead of opening an explorer
  ---
  duration_ms: 17.92
  type: 'test'
  ...
# Subtest: automatic discovery reports CLEANUP_REQUIRED instead of opening an explorer
ok 17 - automatic discovery reports CLEANUP_REQUIRED instead of opening an explorer
  ---
  duration_ms: 12.3088
  type: 'test'
  ...
# Subtest: explicit discovery refuses selected executed Cases and any unresolved cleanup
ok 18 - explicit discovery refuses selected executed Cases and any unresolved cleanup
  ---
  duration_ms: 23.6001
  type: 'test'
  ...
# Subtest: a replaced target refreshes observation and asks again without replaying a dispatched action
ok 19 - a replaced target refreshes observation and asks again without replaying a dispatched action
  ---
  duration_ms: 282.506
  type: 'test'
  ...
# Subtest: a late plan pauses planning while preserving completed discovery
ok 20 - a late plan pauses planning while preserving completed discovery
  ---
  duration_ms: 153.5653
  type: 'test'
  ...
# Subtest: dynamic discovery contracts require explicit reviewed non-write evidence and bounded values
ok 21 - dynamic discovery contracts require explicit reviewed non-write evidence and bounded values
  ---
  duration_ms: 4.264
  type: 'test'
  ...
# Subtest: real Chromium exposes dynamic fields only through fixed case-bound input and DOM option candidates
ok 22 - real Chromium exposes dynamic fields only through fixed case-bound input and DOM option candidates
  ---
  duration_ms: 4397.2083
  type: 'test'
  ...
# Subtest: without an operator contract inputs remain unavailable, and the next case cannot reuse a capability
ok 23 - without an operator contract inputs remain unavailable, and the next case cannot reuse a capability
  ---
  duration_ms: 4783.0219
  type: 'test'
  ...
# Subtest: a dynamic capability is confined to its normalized path, query and hash even when testids are reused
ok 24 - a dynamic capability is confined to its normalized path, query and hash even when testids are reused
  ---
  duration_ms: 5522.8441
  type: 'test'
  ...
# Subtest: explicit clear capabilities work without empty case text and repeat budgets distinguish semantic input state
ok 25 - explicit clear capabilities work without empty case text and repeat budgets distinguish semantic input state
  ---
  duration_ms: 6665.398
  type: 'test'
  ...
# Subtest: field values and DOM option changes invalidate previously observed dynamic candidates
ok 26 - field values and DOM option changes invalidate previously observed dynamic candidates
  ---
  duration_ms: 2904.3134
  type: 'test'
  ...
# Subtest: an autosave POST triggered by an approved local input is blocked before reaching the server
ok 27 - an autosave POST triggered by an approved local input is blocked before reaching the server
  ---
  duration_ms: 2195.0311
  type: 'test'
  ...
# Subtest: a select change cannot bypass the form-submit guard even with a reviewed interaction
ok 28 - a select change cannot bypass the form-submit guard even with a reviewed interaction
  ---
  duration_ms: 2120.919
  type: 'test'
  ...
# Subtest: POST queries work only with an existing exact read-only endpoint authorization
ok 29 - POST queries work only with an existing exact read-only endpoint authorization
  ---
  duration_ms: 2716.6971
  type: 'test'
  ...
# Subtest: discovery knows the same bounded future-binding protocol as planning
ok 30 - discovery knows the same bounded future-binding protocol as planning
  ---
  duration_ms: 0.7855
  type: 'test'
  ...
# Subtest: real discovery feeds future binding to planning; wizard context=true
ok 31 - real discovery feeds future binding to planning; wizard context=true
  ---
  duration_ms: 3094.5464
  type: 'test'
  ...
# Subtest: real discovery feeds future binding to planning; wizard context=false
ok 32 - real discovery feeds future binding to planning; wizard context=false
  ---
  duration_ms: 2361.4252
  type: 'test'
  ...
# Subtest: rejection accounting is bounded and never exposes sensitive control names
ok 33 - rejection accounting is bounded and never exposes sensitive control names
  ---
  duration_ms: 0.6202
  type: 'test'
  ...
# Subtest: real candidate exclusions explain mapping, ambiguity, disabled, safety and unsupported controls
ok 34 - real candidate exclusions explain mapping, ambiguity, disabled, safety and unsupported controls
  ---
  duration_ms: 1555.4885
  type: 'test'
  ...
# Subtest: discovery selects an exact current candidate and returns the original object
ok 35 - discovery selects an exact current candidate and returns the original object
  ---
  duration_ms: 3.6879
  type: 'test'
  ...
# Subtest: discovery terminal response remains a technical result with empty candidates
ok 36 - discovery terminal response remains a technical result with empty candidates
  ---
  duration_ms: 0.2698
  type: 'test'
  ...
# Subtest: discovery terminal response remains a technical result with empty candidates
ok 37 - discovery terminal response remains a technical result with empty candidates
  ---
  duration_ms: 0.1546
  type: 'test'
  ...
# Subtest: discovery rejects unknown candidate
ok 38 - discovery rejects unknown candidate
  ---
  duration_ms: 0.7982
  type: 'test'
  ...
# Subtest: discovery rejects stale observation
ok 39 - discovery rejects stale observation
  ---
  duration_ms: 0.1902
  type: 'test'
  ...
# Subtest: discovery rejects locator injection
ok 40 - discovery rejects locator injection
  ---
  duration_ms: 0.151
  type: 'test'
  ...
# Subtest: discovery rejects route injection
ok 41 - discovery rejects route injection
  ---
  duration_ms: 0.2402
  type: 'test'
  ...
# Subtest: discovery rejects code injection
ok 42 - discovery rejects code injection
  ---
  duration_ms: 0.1445
  type: 'test'
  ...
# Subtest: discovery rejects fill injection
ok 43 - discovery rejects fill injection
  ---
  duration_ms: 0.3949
  type: 'test'
  ...
# Subtest: discovery rejects new oracle
ok 44 - discovery rejects new oracle
  ---
  duration_ms: 0.5308
  type: 'test'
  ...
# Subtest: discovery rejects mixed result
ok 45 - discovery rejects mixed result
  ---
  duration_ms: 0.2379
  type: 'test'
  ...
# Subtest: discovery rejects false done
ok 46 - discovery rejects false done
  ---
  duration_ms: 0.233
  type: 'test'
  ...
# Subtest: discovery rejects nonboolean blocked
ok 47 - discovery rejects nonboolean blocked
  ---
  duration_ms: 0.1379
  type: 'test'
  ...
# Subtest: discovery rejects empty reason
ok 48 - discovery rejects empty reason
  ---
  duration_ms: 0.1761
  type: 'test'
  ...
# Subtest: discovery rejects oversize reason
ok 49 - discovery rejects oversize reason
  ---
  duration_ms: 0.0961
  type: 'test'
  ...
# Subtest: discovery rejects control characters
ok 50 - discovery rejects control characters
  ---
  duration_ms: 0.0717
  type: 'test'
  ...
# Subtest: discovery rejects arbitrary operation
ok 51 - discovery rejects arbitrary operation
  ---
  duration_ms: 0.0616
  type: 'test'
  ...
# Subtest: discovery rejects invalid current Case or duplicate candidate identities
ok 52 - discovery rejects invalid current Case or duplicate candidate identities
  ---
  duration_ms: 0.2325
  type: 'test'
  ...
# Subtest: handoff routes are restricted to current Case mapped source-confirmed actions and deduplicated
ok 53 - handoff routes are restricted to current Case mapped source-confirmed actions and deduplicated
  ---
  duration_ms: 1.5783
  type: 'test'
  ...
# Subtest: handoff preserves valid SPA route, query and fragment while ignoring arbitrary source links
ok 54 - handoff preserves valid SPA route, query and fragment while ignoring arbitrary source links
  ---
  duration_ms: 1.2073
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "https://evil.example/path"
ok 55 - handoff rejects unsafe bound entry path "https://evil.example/path"
  ---
  duration_ms: 0.2661
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "//evil.example/path"
ok 56 - handoff rejects unsafe bound entry path "//evil.example/path"
  ---
  duration_ms: 0.0856
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/\\\\evil.example/path"
ok 57 - handoff rejects unsafe bound entry path "/\\\\evil.example/path"
  ---
  duration_ms: 0.0641
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/%2F%2Fevil.example/path"
ok 58 - handoff rejects unsafe bound entry path "/%2F%2Fevil.example/path"
  ---
  duration_ms: 0.1048
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/tasks/../admin"
ok 59 - handoff rejects unsafe bound entry path "/tasks/../admin"
  ---
  duration_ms: 0.0829
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/%252e%252e/admin"
ok 60 - handoff rejects unsafe bound entry path "/%252e%252e/admin"
  ---
  duration_ms: 0.994
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/\#//evil.example"
ok 61 - handoff rejects unsafe bound entry path "/\#//evil.example"
  ---
  duration_ms: 0.3273
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/tasks?token=abc"
ok 62 - handoff rejects unsafe bound entry path "/tasks?token=abc"
  ---
  duration_ms: 0.2135
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/\#/tasks?session_id=abc"
ok 63 - handoff rejects unsafe bound entry path "/\#/tasks?session_id=abc"
  ---
  duration_ms: 0.2103
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/tasks?%2574oken=abc"
ok 64 - handoff rejects unsafe bound entry path "/tasks?%2574oken=abc"
  ---
  duration_ms: 0.1906
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/tasks%0Adelete"
ok 65 - handoff rejects unsafe bound entry path "/tasks%0Adelete"
  ---
  duration_ms: 0.1527
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/tasks%250Ddelete"
ok 66 - handoff rejects unsafe bound entry path "/tasks%250Ddelete"
  ---
  duration_ms: 0.146
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "/bad%zz"
ok 67 - handoff rejects unsafe bound entry path "/bad%zz"
  ---
  duration_ms: 0.1516
  type: 'test'
  ...
# Subtest: handoff rejects unsafe bound entry path "relative/tasks"
ok 68 - handoff rejects unsafe bound entry path "relative/tasks"
  ---
  duration_ms: 0.1014
  type: 'test'
  ...
# Subtest: unresolved steps do not contribute routes and broken current bindings are rejected
ok 69 - unresolved steps do not contribute routes and broken current bindings are rejected
  ---
  duration_ms: 0.4119
  type: 'test'
  ...
1..69
# tests 69
# suites 0
# pass 69
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 31806.3246
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0013-discovery-observability; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

Bounded rejection diagnostics, zero-match distinct from ambiguity. Console evidence validation/REQ-0013-diagnostics-ui.log. No external model calls.
