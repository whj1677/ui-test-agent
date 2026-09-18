# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T16:18:41+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `0ebcc31e0eb9303b37ccab9944906c600aaa0145ce753d70f839013c793ba19c`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node tests/runtime-regression.mjs`
- Exit code: `0`
- Test count: `1165`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/final-governance-v4-r2.log`
- Log SHA-256: `36154f6a34405ba78b8513d0fc040087b59a17795c7a1d9d0eff378617186802`

### Git Status

```text
M  README.md
M  docs/modules/release_runtime.md
M  docs/requirements/README.md
A  docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
A  docs/requirements/REQ-0017-controlled-react/01_development_requirement.md
AM docs/requirements/REQ-0017-controlled-react/02_design.md
A  docs/requirements/REQ-0017-controlled-react/03_tasks.md
AM docs/requirements/REQ-0017-controlled-react/04_verification.md
A  docs/requirements/REQ-0017-controlled-react/05_trace.md
A  docs/requirements/REQ-0017-controlled-react/change_log.md
AM docs/requirements/REQ-0017-controlled-react/current_state.md
AM docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
AM docs/requirements/REQ-0017-controlled-react/requirement.source.json
M  public/app.js
A  src/adaptive-execution.mjs
A  src/adaptive-plan.mjs
A  src/adaptive-preparation.mjs
A  src/adaptive-protocol.mjs
A  src/adaptive-recovery.mjs
AM src/adaptive-review.mjs
M  src/browser.mjs
M  src/case-entry-url.mjs
A  src/controlled-react.mjs
M  src/controller.mjs
A  src/expectation-coverage.mjs
M  src/plan-quality.mjs
M  src/plan-repair.mjs
M  src/plan-semantics.mjs
M  src/plan-staged.mjs
M  src/plans.mjs
M  src/preparation.mjs
M  src/recovery-gap.mjs
M  src/report-view.mjs
M  src/row-locator.mjs
M  src/server.mjs
A  src/table-assertion.mjs
A  src/table-invariant.mjs
A  tests/adaptive-console.test.mjs
A  tests/adaptive-dispatch.test.mjs
A  tests/adaptive-execution.test.mjs
A  tests/adaptive-plan.test.mjs
A  tests/adaptive-preparation.test.mjs
A  tests/adaptive-protocol.test.mjs
A  tests/adaptive-report.test.mjs
A  tests/adaptive-review.test.mjs
M  tests/checkpoints.test.mjs
A  tests/controlled-react.test.mjs
M  tests/controller-lifecycle.test.mjs
A  tests/expectation-coverage.test.mjs
A  tests/manual-lab-readonly.test.mjs
M  tests/model-flow.integration.mjs
M  tests/plan-quality.test.mjs
M  tests/plan-staged.test.mjs
A  tests/preparation-react.test.mjs
M  tests/runtime-regression.mjs
A  tests/scoped-wait.test.mjs
M  tests/self-repair.test.mjs
A  tests/table-assertion.test.mjs
A  tests/table-invariant.test.mjs
A  tests/table-observation.test.mjs
M  试用说明.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
 README.md                                          |  10 +-
 docs/modules/release_runtime.md                    |  36 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |  35 +
 .../01_development_requirement.md                  |  18 +
 .../REQ-0017-controlled-react/02_design.md         |  31 +
 .../REQ-0017-controlled-react/03_tasks.md          |  12 +
 .../REQ-0017-controlled-react/04_verification.md   |  30 +
 .../REQ-0017-controlled-react/05_trace.md          |  18 +
 .../REQ-0017-controlled-react/change_log.md        |  12 +
 .../REQ-0017-controlled-react/current_state.md     |  67 ++
 .../REQ-0017-controlled-react/delivery_evidence.md | 789 ++++++++++++++++++
 .../requirement.source.json                        | 413 ++++++++++
 public/app.js                                      | 292 ++++++-
 src/adaptive-execution.mjs                         | 364 +++++++++
 src/adaptive-plan.mjs                              | 412 ++++++++++
 src/adaptive-preparation.mjs                       | 215 +++++
 src/adaptive-protocol.mjs                          | 304 +++++++
 src/adaptive-recovery.mjs                          |  53 ++
 src/adaptive-review.mjs                            |  90 +++
 src/browser.mjs                                    | 315 +++++++-
 src/case-entry-url.mjs                             |   3 +
 src/controlled-react.mjs                           |  43 +
 src/controller.mjs                                 | 198 ++++-
 src/expectation-coverage.mjs                       | 199 +++++
 src/plan-quality.mjs                               |  67 +-
 src/plan-repair.mjs                                |  72 +-
 src/plan-semantics.mjs                             |  27 +-
 src/plan-staged.mjs                                |  10 +-
 src/plans.mjs                                      |  33 +-
 src/preparation.mjs                                |  11 +
 src/recovery-gap.mjs                               |  83 +-
 src/report-view.mjs                                |  57 +-
 src/row-locator.mjs                                |  33 +-
 src/server.mjs                                     |   5 +-
 src/table-assertion.mjs                            | 306 +++++++
 src/table-invariant.mjs                            | 267 ++++++
 tests/adaptive-console.test.mjs                    | 477 +++++++++++
 tests/adaptive-dispatch.test.mjs                   |  83 ++
 tests/adaptive-execution.test.mjs                  | 364 +++++++++
 tests/adaptive-plan.test.mjs                       | 895 +++++++++++++++++++++
 tests/adaptive-preparation.test.mjs                | 612 ++++++++++++++
 tests/adaptive-protocol.test.mjs                   | 607 ++++++++++++++
 tests/adaptive-report.test.mjs                     | 217 +++++
 tests/adaptive-review.test.mjs                     | 232 ++++++
 tests/checkpoints.test.mjs                         |   4 +-
 tests/controlled-react.test.mjs                    | 445 ++++++++++
 tests/controller-lifecycle.test.mjs                |   8 +-
 tests/expectation-coverage.test.mjs                | 378 +++++++++
 tests/manual-lab-readonly.test.mjs                 | 439 ++++++++++
 tests/model-flow.integration.mjs                   |  13 +-
 tests/plan-quality.test.mjs                        | 164 +++-
 tests/plan-staged.test.mjs                         |   9 +-
 tests/preparation-react.test.mjs                   | 576 +++++++++++++
 tests/runtime-regression.mjs                       |   4 +-
 tests/scoped-wait.test.mjs                         |  38 +
 tests/self-repair.test.mjs                         |  11 +-
 tests/table-assertion.test.mjs                     | 690 ++++++++++++++++
 tests/table-invariant.test.mjs                     | 535 ++++++++++++
 tests/table-observation.test.mjs                   | 483 +++++++++++
 ...257\225\347\224\250\350\257\264\346\230\216.md" |  10 +
 61 files changed, 12073 insertions(+), 153 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T16:12:24+08:00
Command: node tests/runtime-regression.mjs
Exit code: 0
Parsed test count: 1165
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: controlled artifact manifest detects any byte drift
ok 1 - controlled artifact manifest detects any byte drift
  ---
  duration_ms: 15.5642
  type: 'test'
  ...
# Subtest: frozen baseline imports 24 unique cases without changing source semantics
ok 2 - frozen baseline imports 24 unique cases without changing source semantics
  ---
  duration_ms: 4.2115
  type: 'test'
  ...
# Subtest: classification freezes 19 normal, 3 defects and 2 boundaries; only two write cases
ok 3 - classification freezes 19 normal, 3 defects and 2 boundaries; only two write cases
  ---
  duration_ms: 4.1285
  type: 'test'
  ...
# Subtest: original eight cases and target HTML remain byte-identical to frozen historical inputs
ok 4 - original eight cases and target HTML remain byte-identical to frozen historical inputs
  ---
  duration_ms: 1.9744
  type: 'test'
  ...
# Subtest: HTTP whitelist never serves cases, oracle, source harness, traversal, or unknown SPA fallback
ok 5 - HTTP whitelist never serves cases, oracle, source harness, traversal, or unknown SPA fallback
  ---
  duration_ms: 128.3656
  type: 'test'
  ...
# Subtest: synthetic CRUD validates auth, field bounds, media type, size and exact duplicate ownership
ok 6 - synthetic CRUD validates auth, field bounds, media type, size and exact duplicate ownership
  ---
  duration_ms: 45.9602
  type: 'test'
  ...
# Subtest: seed records reject mutation and independent server instances reset all CRUD state
ok 7 - seed records reject mutation and independent server instances reset all CRUD state
  ---
  duration_ms: 15.222
  type: 'test'
  ...
# Subtest: adapter source maps real metadata and a missing text branch is reproducible and repairable
ok 8 - adapter source maps real metadata and a missing text branch is reproducible and repairable
  ---
  duration_ms: 159.216
  type: 'test'
  ...
# Subtest: generated source cannot import, call code, loop, access prototypes, assign, or change the oracle
ok 9 - generated source cannot import, call code, loop, access prototypes, assign, or change the oracle
  ---
  duration_ms: 4.9755
  type: 'test'
  ...
# Subtest: regression gate rejects a syntactically valid adapter that silently rebinds every target
ok 10 - regression gate rejects a syntactically valid adapter that silently rebinds every target
  ---
  duration_ms: 0.7314
  type: 'test'
  ...
# Subtest: worker reports rejected source and supports cancellation without invoking generated code
ok 11 - worker reports rejected source and supports cancellation without invoking generated code
  ---
  duration_ms: 130.7512
  type: 'test'
  ...
# Subtest: direct testing has three stages, one primary action and no pre-emptive login gate
ok 12 - direct testing has three stages, one primary action and no pre-emptive login gate
  ---
  duration_ms: 747.5451
  type: 'test'
  ...
# Subtest: keyboard start sends test with original prepare options; duplicate submission is locked
ok 13 - keyboard start sends test with original prepare options; duplicate submission is locked
  ---
  duration_ms: 269.5779
  type: 'test'
  ...
# Subtest: confirming the original case directly starts test, even without autonomous preparation support
ok 14 - confirming the original case directly starts test, even without autonomous preparation support
  ---
  duration_ms: 353.4468
  type: 'test'
  ...
# Subtest: pending adaptive contracts can re-enter test, with business goals shown and no approval
ok 15 - pending adaptive contracts can re-enter test, with business goals shown and no approval
  ---
  duration_ms: 310.6055
  type: 'test'
  ...
# Subtest: direct flag absent retains the five-stage workflow and never offers direct test
ok 16 - direct flag absent retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 226.9506
  type: 'test'
  ...
# Subtest: fixed planning mode retains the five-stage workflow and never offers direct test
ok 17 - fixed planning mode retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 231.9957
  type: 'test'
  ...
# Subtest: write authorization retains the five-stage workflow and never offers direct test
ok 18 - write authorization retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 219.5708
  type: 'test'
  ...
# Subtest: old fixed plan retains the five-stage workflow and never offers direct test
ok 19 - old fixed plan retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 200.4683
  type: 'test'
  ...
# Subtest: mixed pending selection retains the five-stage workflow and never offers direct test
ok 20 - mixed pending selection retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 220.2404
  type: 'test'
  ...
# Subtest: fixed and adaptive contracts cannot be approved together through the legacy helper
ok 21 - fixed and adaptive contracts cannot be approved together through the legacy helper
  ---
  duration_ms: 267.2853
  type: 'test'
  ...
# Subtest: legacy prepare and approved fixed run still submit their original job kinds
ok 22 - legacy prepare and approved fixed run still submit their original job kinds
  ---
  duration_ms: 502.5204
  type: 'test'
  ...
# Subtest: authorization or fixed-plan changes in fresh state block a stale direct start
ok 23 - authorization or fixed-plan changes in fresh state block a stale direct start
  ---
  duration_ms: 263.5623
  type: 'test'
  ...
# Subtest: active test login waits reuse the existing confirmation controls without restarting the job
ok 24 - active test login waits reuse the existing confirmation controls without restarting the job
  ---
  duration_ms: 389.2188
  type: 'test'
  ...
# Subtest: changing selection to a fixed plan does not hide the active test login recovery control
ok 25 - changing selection to a fixed plan does not hide the active test login recovery control
  ---
  duration_ms: 240.3578
  type: 'test'
  ...
# Subtest: missing nonproduction authorization routes to environment settings, not a test job
ok 26 - missing nonproduction authorization routes to environment settings, not a test job
  ---
  duration_ms: 217.0117
  type: 'test'
  ...
# Subtest: each adaptive runtime event has a Chinese user-facing label
ok 27 - each adaptive runtime event has a Chinese user-facing label
  ---
  duration_ms: 192.1591
  type: 'test'
  ...
# Subtest: adaptive errors explain blocked execution in Chinese without relaxing write scope
ok 28 - adaptive errors explain blocked execution in Chinese without relaxing write scope
  ---
  duration_ms: 205.0908
  type: 'test'
  ...
# Subtest: completed attempts show results without implying all expectations passed
ok 29 - completed attempts show results without implying all expectations passed
  ---
  duration_ms: 243.5226
  type: 'test'
  ...
# Subtest: null plans and adaptive source text render safely without fixed locator fields
ok 30 - null plans and adaptive source text render safely without fixed locator fields
  ---
  duration_ms: 199.2503
  type: 'test'
  ...
# Subtest: 375px layout preserves disclosure focus and scroll across progress refreshes
ok 31 - 375px layout preserves disclosure focus and scroll across progress refreshes
  ---
  duration_ms: 253.5679
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: write
ok 32 - final adaptive dispatch validates actual node: write
  ---
  duration_ms: 882.5657
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: replacement
ok 33 - final adaptive dispatch validates actual node: replacement
  ---
  duration_ms: 778.756
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: late-name
ok 34 - final adaptive dispatch validates actual node: late-name
  ---
  duration_ms: 866.1088
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: password
ok 35 - final adaptive dispatch validates actual node: password
  ---
  duration_ms: 763.6201
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: valid
ok 36 - final adaptive dispatch validates actual node: valid
  ---
  duration_ms: 834.6378
  type: 'test'
  ...
# Subtest: real-response format error then mistaken blocked recovers without replaying menu clicks
ok 37 - real-response format error then mistaken blocked recovers without replaying menu clicks
  ---
  duration_ms: 39036.4409
  type: 'test'
  ...
# Subtest: malformed audit response repairs only the audit while preserving executed actions
ok 38 - malformed audit response repairs only the audit while preserving executed actions
  ---
  duration_ms: 38523.6015
  type: 'test'
  ...
# Subtest: repeated blocked is terminal after one evidence-based reconsideration
ok 39 - repeated blocked is terminal after one evidence-based reconsideration
  ---
  duration_ms: 6634.974
  type: 'test'
  ...
# Subtest: current target/source refs execute through the real controller and browser kernel
ok 40 - current target/source refs execute through the real controller and browser kernel
  ---
  duration_ms: 38372.873
  type: 'test'
  ...
# Subtest: exhausted audit format repair is terminal without spending a fresh planning round
ok 41 - exhausted audit format repair is terminal without spending a fresh planning round
  ---
  duration_ms: 6852.9514
  type: 'test'
  ...
# Subtest: direct test dynamically handles button navigation without upfront technical plan
ok 42 - direct test dynamically handles button navigation without upfront technical plan
  ---
  duration_ms: 38998.1584
  type: 'test'
  ...
# Subtest: direct test dynamically handles link navigation without upfront technical plan
ok 43 - direct test dynamically handles link navigation without upfront technical plan
  ---
  duration_ms: 39942.6671
  type: 'test'
  ...
# Subtest: actual business mismatch stops without changing oracle or replaying actions
ok 44 - actual business mismatch stops without changing oracle or replaying actions
  ---
  duration_ms: 39420.5266
  type: 'test'
  ...
# Subtest: a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
ok 45 - a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
  ---
  duration_ms: 40179.8456
  type: 'test'
  ...
# Subtest: model completion cannot skip original expected obligations
ok 46 - model completion cannot skip original expected obligations
  ---
  duration_ms: 24237.507
  type: 'test'
  ...
# Subtest: direct entry refuses write authorization and unreviewed input
ok 47 - direct entry refuses write authorization and unreviewed input
  ---
  duration_ms: 855.9049
  type: 'test'
  ...
# Subtest: ambiguous assertion can repair its scope without replaying completed actions
ok 48 - ambiguous assertion can repair its scope without replaying completed actions
  ---
  duration_ms: 38324.1439
  type: 'test'
  ...
# Subtest: assertion scope repair cannot change the predicate or expected result
ok 49 - assertion scope repair cannot change the predicate or expected result
  ---
  duration_ms: 24032.2085
  type: 'test'
  ...
# Subtest: contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
ok 50 - contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
  ---
  duration_ms: 6.0411
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects extra top field
ok 51 - strict adaptive contract rejects extra top field
  ---
  duration_ms: 0.951
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing notes
ok 52 - strict adaptive contract rejects missing notes
  ---
  duration_ms: 0.3293
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong version
ok 53 - strict adaptive contract rejects wrong version
  ---
  duration_ms: 0.303
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong case id
ok 54 - strict adaptive contract rejects wrong case id
  ---
  duration_ms: 0.3861
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong hash
ok 55 - strict adaptive contract rejects wrong hash
  ---
  duration_ms: 0.3457
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects external entry
ok 56 - strict adaptive contract rejects external entry
  ---
  duration_ms: 0.4189
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects mutation
ok 57 - strict adaptive contract rejects mutation
  ---
  duration_ms: 1.0979
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects cleanup
ok 58 - strict adaptive contract rejects cleanup
  ---
  duration_ms: 0.7389
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precondition
ok 59 - strict adaptive contract rejects precondition
  ---
  duration_ms: 0.663
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy extra
ok 60 - strict adaptive contract rejects policy extra
  ---
  duration_ms: 0.3564
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy mode
ok 61 - strict adaptive contract rejects policy mode
  ---
  duration_ms: 0.2551
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects segment budget
ok 62 - strict adaptive contract rejects segment budget
  ---
  duration_ms: 0.3095
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects replan budget
ok 63 - strict adaptive contract rejects replan budget
  ---
  duration_ms: 0.2487
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing step
ok 64 - strict adaptive contract rejects missing step
  ---
  duration_ms: 0.2377
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects reordered steps
ok 65 - strict adaptive contract rejects reordered steps
  ---
  duration_ms: 0.2299
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects changed source
ok 66 - strict adaptive contract rejects changed source
  ---
  duration_ms: 0.226
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects step extra
ok 67 - strict adaptive contract rejects step extra
  ---
  duration_ms: 0.2323
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precompiled step
ok 68 - strict adaptive contract rejects precompiled step
  ---
  duration_ms: 0.2286
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects illegal timeout
ok 69 - strict adaptive contract rejects illegal timeout
  ---
  duration_ms: 0.2069
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects string timeout
ok 70 - strict adaptive contract rejects string timeout
  ---
  duration_ms: 0.6531
  type: 'test'
  ...
# Subtest: Case hash includes data and changes are never silently rebased
ok 71 - Case hash includes data and changes are never silently rebased
  ---
  duration_ms: 1.0267
  type: 'test'
  ...
# Subtest: action-only, assertion-only and copied fragment return; no inputs are mutated
ok 72 - action-only, assertion-only and copied fragment return; no inputs are mutated
  ---
  duration_ms: 5.0743
  type: 'test'
  ...
# Subtest: fragment rejects extra field
ok 73 - fragment rejects extra field
  ---
  duration_ms: 0.6801
  type: 'test'
  ...
# Subtest: fragment rejects missing reason
ok 74 - fragment rejects missing reason
  ---
  duration_ms: 0.4678
  type: 'test'
  ...
# Subtest: fragment rejects blank reason
ok 75 - fragment rejects blank reason
  ---
  duration_ms: 0.4615
  type: 'test'
  ...
# Subtest: fragment rejects nonboolean complete
ok 76 - fragment rejects nonboolean complete
  ---
  duration_ms: 0.4111
  type: 'test'
  ...
# Subtest: fragment rejects two actions
ok 77 - fragment rejects two actions
  ---
  duration_ms: 0.4121
  type: 'test'
  ...
# Subtest: fragment rejects 21 assertions
ok 78 - fragment rejects 21 assertions
  ---
  duration_ms: 0.6208
  type: 'test'
  ...
# Subtest: fragment rejects below time bound
ok 79 - fragment rejects below time bound
  ---
  duration_ms: 0.6206
  type: 'test'
  ...
# Subtest: fragment rejects above time bound
ok 80 - fragment rejects above time bound
  ---
  duration_ms: 0.5709
  type: 'test'
  ...
# Subtest: fragment rejects fractional time
ok 81 - fragment rejects fractional time
  ---
  duration_ms: 0.9542
  type: 'test'
  ...
# Subtest: fragment rejects arbitrary operation
ok 82 - fragment rejects arbitrary operation
  ---
  duration_ms: 0.4814
  type: 'test'
  ...
# Subtest: fragment rejects repair_anchor
ok 83 - fragment rejects repair_anchor
  ---
  duration_ms: 0.3651
  type: 'test'
  ...
# Subtest: fragment rejects future case_named
ok 84 - fragment rejects future case_named
  ---
  duration_ms: 0.3417
  type: 'test'
  ...
# Subtest: fragment rejects future runtime_intent
ok 85 - fragment rejects future runtime_intent
  ---
  duration_ms: 0.3266
  type: 'test'
  ...
# Subtest: empty completion requires earlier assertions and complete coverage, never just prior action
ok 86 - empty completion requires earlier assertions and complete coverage, never just prior action
  ---
  duration_ms: 5.4647
  type: 'test'
  ...
# Subtest: current original step is authoritative; previous fragments and IDs are revalidated
ok 87 - current original step is authoritative; previous fragments and IDs are revalidated
  ---
  duration_ms: 2.4854
  type: 'test'
  ...
# Subtest: only current action substrings and data scalar VALUES authorize input; expected and other steps do not
ok 88 - only current action substrings and data scalar VALUES authorize input; expected and other steps do not
  ---
  duration_ms: 4.0177
  type: 'test'
  ...
# Subtest: navigation needs same origin and whole explicit action path, not data or a path prefix
ok 89 - navigation needs same origin and whole explicit action path, not data or a path prefix
  ---
  duration_ms: 3.2468
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 保存 even if literal in source
ok 90 - read-only known-write guard rejects 保存 even if literal in source
  ---
  duration_ms: 0.3979
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 提交 even if literal in source
ok 91 - read-only known-write guard rejects 提交 even if literal in source
  ---
  duration_ms: 0.3673
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 删除 even if literal in source
ok 92 - read-only known-write guard rejects 删除 even if literal in source
  ---
  duration_ms: 0.3251
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 新建 even if literal in source
ok 93 - read-only known-write guard rejects 新建 even if literal in source
  ---
  duration_ms: 0.3472
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 创建 even if literal in source
ok 94 - read-only known-write guard rejects 创建 even if literal in source
  ---
  duration_ms: 0.313
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 重置数据 even if literal in source
ok 95 - read-only known-write guard rejects 重置数据 even if literal in source
  ---
  duration_ms: 0.3744
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 清空数据 even if literal in source
ok 96 - read-only known-write guard rejects 清空数据 even if literal in source
  ---
  duration_ms: 0.2861
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 上传 even if literal in source
ok 97 - read-only known-write guard rejects 上传 even if literal in source
  ---
  duration_ms: 0.6097
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 退出登录 even if literal in source
ok 98 - read-only known-write guard rejects 退出登录 even if literal in source
  ---
  duration_ms: 0.3963
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects Delete even if literal in source
ok 99 - read-only known-write guard rejects Delete even if literal in source
  ---
  duration_ms: 0.5272
  type: 'test'
  ...
# Subtest: read-o
... truncated ...
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

版本4完整冻结回归：当前目标/原预期引用编译、分层格式恢复、有界阻塞复核、唯一原生表操作前后检查。四文件并发，未放宽业务断言。首次全量在补全审查器关系能力说明前主动取消不计通过；版本3实际三例失败保留，版本4真实模型另验。
