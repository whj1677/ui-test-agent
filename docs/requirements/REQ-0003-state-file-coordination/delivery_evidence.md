# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-17T22:26:28+08:00`
- Record: `REQ-0003-state-file-coordination`
- Change fingerprint: `babd983c6dbf801439dbe9725db82469572b224898af2847f1a73556b774a3ed`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node tests/runtime-regression.mjs`
- Exit code: `0`
- Test count: `390`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0003-delivery.log`
- Log SHA-256: `f410f57c02c5a730fad640c5816f4979369e03706eb245245ab4c9fa2dac33f8`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M src/store.mjs
?? docs/requirements/REQ-0003-state-file-coordination/00_user_requirement.md
?? docs/requirements/REQ-0003-state-file-coordination/01_development_requirement.md
?? docs/requirements/REQ-0003-state-file-coordination/02_design.md
?? docs/requirements/REQ-0003-state-file-coordination/03_tasks.md
?? docs/requirements/REQ-0003-state-file-coordination/04_verification.md
?? docs/requirements/REQ-0003-state-file-coordination/05_trace.md
?? docs/requirements/REQ-0003-state-file-coordination/change_log.md
?? docs/requirements/REQ-0003-state-file-coordination/current_state.md
?? docs/requirements/REQ-0003-state-file-coordination/delivery_evidence.md
?? docs/requirements/REQ-0003-state-file-coordination/requirement.source.json
?? tests/store-coordination.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/store.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md |  2 ++
 docs/requirements/README.md     |  2 ++
 src/store.mjs                   | 38 +++++++++++++++++++++++++++++---------
 3 files changed, 33 insertions(+), 9 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0003-state-file-coordination/00_user_requirement.md
docs/requirements/REQ-0003-state-file-coordination/01_development_requirement.md
docs/requirements/REQ-0003-state-file-coordination/02_design.md
docs/requirements/REQ-0003-state-file-coordination/03_tasks.md
docs/requirements/REQ-0003-state-file-coordination/04_verification.md
docs/requirements/REQ-0003-state-file-coordination/05_trace.md
docs/requirements/REQ-0003-state-file-coordination/change_log.md
docs/requirements/REQ-0003-state-file-coordination/current_state.md
docs/requirements/REQ-0003-state-file-coordination/delivery_evidence.md
docs/requirements/REQ-0003-state-file-coordination/requirement.source.json
tests/store-coordination.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-17T22:25:49+08:00
Command: node tests/runtime-regression.mjs
Exit code: 0
Parsed test count: 390
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: adapter source maps real metadata and a missing text branch is reproducible and repairable
ok 1 - adapter source maps real metadata and a missing text branch is reproducible and repairable
  ---
  duration_ms: 331.3679
  type: 'test'
  ...
# Subtest: generated source cannot import, call code, loop, access prototypes, assign, or change the oracle
ok 2 - generated source cannot import, call code, loop, access prototypes, assign, or change the oracle
  ---
  duration_ms: 18.2482
  type: 'test'
  ...
# Subtest: regression gate rejects a syntactically valid adapter that silently rebinds every target
ok 3 - regression gate rejects a syntactically valid adapter that silently rebinds every target
  ---
  duration_ms: 1.443
  type: 'test'
  ...
# Subtest: worker reports rejected source and supports cancellation without invoking generated code
ok 4 - worker reports rejected source and supports cancellation without invoking generated code
  ---
  duration_ms: 355.2295
  type: 'test'
  ...
# Subtest: incomplete initial page evidence cannot authorize a plan even if a model accepts it
ok 5 - incomplete initial page evidence cannot authorize a plan even if a model accepts it
  ---
  duration_ms: 3.2761
  type: 'test'
  ...
# Subtest: block review catalogs structured controls/routes with provenance, excluding expected text and model interpretation
ok 6 - block review catalogs structured controls/routes with provenance, excluding expected text and model interpretation
  ---
  duration_ms: 7.8571
  type: 'test'
  ...
# Subtest: details evidence cannot be rebound to a delete name or a different locator
ok 7 - details evidence cannot be rebound to a delete name or a different locator
  ---
  duration_ms: 2.163
  type: 'test'
  ...
# Subtest: arbitrary quotes, invented IDs, duplicate references and empty repair evidence are rejected
ok 8 - arbitrary quotes, invented IDs, duplicate references and empty repair evidence are rejected
  ---
  duration_ms: 0.6565
  type: 'test'
  ...
# Subtest: safe absolute, relative and SPA URLs preserve route, query and fragment
ok 9 - safe absolute, relative and SPA URLs preserve route, query and fragment
  ---
  duration_ms: 9.1029
  type: 'test'
  ...
# Subtest: credentials, nested encodings, sensitive parameters, external and dangerous protocols reject without raw values
ok 10 - credentials, nested encodings, sensitive parameters, external and dangerous protocols reject without raw values
  ---
  duration_ms: 3.5831
  type: 'test'
  ...
# Subtest: JSON field and optional Chinese CSV column import without changing actions/expectations
ok 11 - JSON field and optional Chinese CSV column import without changing actions/expectations
  ---
  duration_ms: 1453.2349
  type: 'test'
  ...
# Subtest: Excel optional Chinese column is projected from real workbook rows
ok 12 - Excel optional Chinese column is projected from real workbook rows
  ---
  duration_ms: 3975.745
  type: 'test'
  ...
# Subtest: hint observations are case scoped, followed by homepage discovery; no auto approval
ok 13 - hint observations are case scoped, followed by homepage discovery; no auto approval
  ---
  duration_ms: 392.1072
  type: 'test'
  ...
# Subtest: 404 is not accepted as observed and restores home
ok 14 - 404 is not accepted as observed and restores home
  ---
  duration_ms: 353.1001
  type: 'test'
  ...
# Subtest: wrong is not accepted as observed and restores home
ok 15 - wrong is not accepted as observed and restores home
  ---
  duration_ms: 570.7553
  type: 'test'
  ...
# Subtest: login is not accepted as observed and restores home
ok 16 - login is not accepted as observed and restores home
  ---
  duration_ms: 389.4426
  type: 'test'
  ...
# Subtest: irrelevant is not accepted as observed and restores home
ok 17 - irrelevant is not accepted as observed and restores home
  ---
  duration_ms: 262.3551
  type: 'test'
  ...
# Subtest: unsafe persisted hint is never navigated or sent to model; missing hint retains exploration
ok 18 - unsafe persisted hint is never navigated or sent to model; missing hint retains exploration
  ---
  duration_ms: 703.0401
  type: 'test'
  ...
# Subtest: direct entry and fallback exhaust only the Case step budget
ok 19 - direct entry and fallback exhaust only the Case step budget
  ---
  duration_ms: 1310.2067
  type: 'test'
  ...
# Subtest: changing or clearing hint changes effective hash and invalidates old plan/evidence while retaining baseline
ok 20 - changing or clearing hint changes effective hash and invalidates old plan/evidence while retaining baseline
  ---
  duration_ms: 89.3782
  type: 'test'
  ...
# Subtest: execution entry and navigation clicks cannot be replaced by direct hint navigation
ok 21 - execution entry and navigation clicks cannot be replaced by direct hint navigation
  ---
  duration_ms: 0.795
  type: 'test'
  ...
# Subtest: hint-only edits retain exhausted candidate budget and old hint cannot enter immediate planning
ok 22 - hint-only edits retain exhausted candidate budget and old hint cannot enter immediate planning
  ---
  duration_ms: 496.0337
  type: 'test'
  ...
# Subtest: v3 preserves original steps and covers obligations across distinct checkpoints
ok 23 - v3 preserves original steps and covers obligations across distinct checkpoints
  ---
  duration_ms: 12.2102
  type: 'test'
  ...
# Subtest: checkpoint plan rejects missing obligation
ok 24 - checkpoint plan rejects missing obligation
  ---
  duration_ms: 2.0657
  type: 'test'
  ...
# Subtest: checkpoint plan rejects duplicate checkpoint
ok 25 - checkpoint plan rejects duplicate checkpoint
  ---
  duration_ms: 2.7658
  type: 'test'
  ...
# Subtest: checkpoint plan rejects unbounded step clock
ok 26 - checkpoint plan rejects unbounded step clock
  ---
  duration_ms: 1.0153
  type: 'test'
  ...
# Subtest: checkpoint plan rejects empty checkpoint
ok 27 - checkpoint plan rejects empty checkpoint
  ---
  duration_ms: 5.1742
  type: 'test'
  ...
# Subtest: checkpoint plan rejects false simultaneous declaration
ok 28 - checkpoint plan rejects false simultaneous declaration
  ---
  duration_ms: 0.9598
  type: 'test'
  ...
# Subtest: checkpoint plan rejects extra executable code
ok 29 - checkpoint plan rejects extra executable code
  ---
  duration_ms: 1.2258
  type: 'test'
  ...
# Subtest: checkpoint plan rejects v2 silent migration
ok 30 - checkpoint plan rejects v2 silent migration
  ---
  duration_ms: 1.1378
  type: 'test'
  ...
# Subtest: checkpoint plan rejects unknown version
ok 31 - checkpoint plan rejects unknown version
  ---
  duration_ms: 1.4464
  type: 'test'
  ...
# Subtest: original-step capacity cannot be multiplied by splitting checkpoints
ok 32 - original-step capacity cannot be multiplied by splitting checkpoints
  ---
  duration_ms: 2.9149
  type: 'test'
  ...
# Subtest: audit indices span checkpoints and reject an index from the wrong obligation
ok 33 - audit indices span checkpoints and reject an index from the wrong obligation
  ---
  duration_ms: 4.1746
  type: 'test'
  ...
# Subtest: approved read-only locator recovery still finds actions inside checkpoints
ok 34 - approved read-only locator recovery still finds actions inside checkpoints
  ---
  duration_ms: 1.3793
  type: 'test'
  ...
# Subtest: cleanup observation routes are versioned, same-origin and part of approval
ok 35 - cleanup observation routes are versioned, same-origin and part of approval
  ---
  duration_ms: 1.4603
  type: 'test'
  ...
# Subtest: step budget cannot be reset by later checkpoints and v2 keeps its observation window
ok 36 - step budget cannot be reset by later checkpoints and v2 keeps its observation window
  ---
  duration_ms: 0.3799
  type: 'test'
  ...
# Subtest: console shows original expectation, each checkpoint, time meaning and cleanup path
ok 37 - console shows original expectation, each checkpoint, time meaning and cleanup path
  ---
  duration_ms: 21.8848
  type: 'test'
  ...
# Subtest: report retains matching earlier observations without claiming the unfinished step passed
ok 38 - report retains matching earlier observations without claiming the unfinished step passed
  ---
  duration_ms: 5.3697
  type: 'test'
  ...
# Subtest: revalidate a retained bare-plan response without a model call, approval, or rewriting the source
ok 39 - revalidate a retained bare-plan response without a model call, approval, or rewriting the source
  ---
  duration_ms: 222.3997
  type: 'test'
  ...
# Subtest: plan revision is bounded, revokes approval and preserves original case and prior candidate
ok 40 - plan revision is bounded, revokes approval and preserves original case and prior candidate
  ---
  duration_ms: 111.7944
  type: 'test'
  ...
# Subtest: legacy tasks expose truthful basic diagnostics without fabricated model history
ok 41 - legacy tasks expose truthful basic diagnostics without fabricated model history
  ---
  duration_ms: 40.0859
  type: 'test'
  ...
# Subtest: accepted plan links request, transport and decision, with no implicit plan approval
ok 42 - accepted plan links request, transport and decision, with no implicit plan approval
  ---
  duration_ms: 1504.0916
  type: 'test'
  ...
# Subtest: invalid plan is rejected with the validator code and unrelated planning continues
ok 43 - invalid plan is rejected with the validator code and unrelated planning continues
  ---
  duration_ms: 870.2454
  type: 'test'
  ...
# Subtest: model blocked reason and every persisted request/response/decision mask configured key echoes
ok 44 - model blocked reason and every persisted request/response/decision mask configured key echoes
  ---
  duration_ms: 640.3212
  type: 'test'
  ...
# Subtest: cancelled late model output is diagnostic only and cannot publish a plan
ok 45 - cancelled late model output is diagnostic only and cannot publish a plan
  ---
  duration_ms: 262.4655
  type: 'test'
  ...
# Subtest: provider failure logs rejection and halts the remaining batch
ok 46 - provider failure logs rejection and halts the remaining batch
  ---
  duration_ms: 296.5034
  type: 'test'
  ...
# Subtest: diagnostic write failure before dispatch performs no model call and stops batch
ok 47 - diagnostic write failure before dispatch performs no model call and stops batch
  ---
  duration_ms: 80.8695
  type: 'test'
  ...
# Subtest: diagnostic read polling and a concurrent launch do not duplicate model requests or lose records
ok 48 - diagnostic read polling and a concurrent launch do not duplicate model requests or lose records
  ---
  duration_ms: 255.9494
  type: 'test'
  ...
# Subtest: a repair logging failure swallowed by the browser still seals facts and stops before the next case
ok 49 - a repair logging failure swallowed by the browser still seals facts and stops before the next case
  ---
  duration_ms: 124.5884
  type: 'test'
  ...
# Subtest: page capture holds the preparation reservation until its commit
ok 50 - page capture holds the preparation reservation until its commit
  ---
  duration_ms: 77.8181
  type: 'test'
  ...
# Subtest: server close retains instance lock until launch validation has stopped
ok 51 - server close retains instance lock until launch validation has stopped
  ---
  duration_ms: 539.102
  type: 'test'
  ...
# Subtest: server close waits for preparation before releasing instance lock
ok 52 - server close waits for preparation before releasing instance lock
  ---
  duration_ms: 805.9352
  type: 'test'
  ...
# Subtest: server close during plan rejects late output and retains its instance lock until settled
ok 53 - server close during plan rejects late output and retains its instance lock until settled
  ---
  duration_ms: 618.2874
  type: 'test'
  ...
# Subtest: server close during plan_audit rejects late output and retains its instance lock until settled
ok 54 - server close during plan_audit rejects late output and retains its instance lock until settled
  ---
  duration_ms: 685.9973
  type: 'test'
  ...
# Subtest: both domain plans validate against exact case baseline
ok 55 - both domain plans validate against exact case baseline
  ---
  duration_ms: 9.1354
  type: 'test'
  ...
# Subtest: rejects foreign origin
ok 56 - rejects foreign origin
  ---
  duration_ms: 1.8364
  type: 'test'
  ...
# Subtest: rejects arbitrary script
ok 57 - rejects arbitrary script
  ---
  duration_ms: 1.6325
  type: 'test'
  ...
# Subtest: rejects missing original step
ok 58 - rejects missing original step
  ---
  duration_ms: 2.4594
  type: 'test'
  ...
# Subtest: rejects rewritten expected text
ok 59 - rejects rewritten expected text
  ---
  duration_ms: 1.3582
  type: 'test'
  ...
# Subtest: rejects missing assertion
ok 60 - rejects missing assertion
  ---
  duration_ms: 1.1716
  type: 'test'
  ...
# Subtest: rejects invented oracle
ok 61 - rejects invented oracle
  ---
  duration_ms: 1.2808
  type: 'test'
  ...
# Subtest: rejects arbitrary CSS
ok 62 - rejects arbitrary CSS
  ---
  duration_ms: 5.3609
  type: 'test'
  ...
# Subtest: rejects wrong case hash
ok 63 - rejects wrong case hash
  ---
  duration_ms: 1.7483
  type: 'test'
  ...
# Subtest: mutation cannot omit cleanup
ok 64 - mutation cannot omit cleanup
  ---
  duration_ms: 1.9992
  type: 'test'
  ...
# Subtest: visible assertion cannot silently ignore an expected false value
ok 65 - visible assertion cannot silently ignore an expected false value
  ---
  duration_ms: 1.5341
  type: 'test'
  ...
# Subtest: repair may patch only the failed action locator, never its input or assertion target
ok 66 - repair may patch only the failed action locator, never its input or assertion target
  ---
  duration_ms: 4.7355
  type: 'test'
  ...
# Subtest: URLs retain SPA routes and reject credentials in query or fragment
ok 67 - URLs retain SPA routes and reject credentials in query or fragment
  ---
  duration_ms: 1.2423
  type: 'test'
  ...
# Subtest: original baseline and confirmations remain distinct; per-task updates serialize
ok 68 - original baseline and confirmations remain distinct; per-task updates serialize
  ---
  duration_ms: 182.1498
  type: 'test'
  ...
# Subtest: changed baseline and facts are rejected; facts cannot be overwritten
ok 69 - changed baseline and facts are rejected; facts cannot be overwritten
  ---
  duration_ms: 63.4297
  type: 'test'
  ...
# Subtest: restart marks a running mutation as interrupted and needing recovery
ok 70 - restart marks a running mutation as interrupted and needing recovery
  ---
  duration_ms: 62.0109
  type: 'test'
  ...
# Subtest: concurrent progress reads do not replay or drop committed events
ok 71 - concurrent progress reads do not replay or drop committed events
  ---
  duration_ms: 1354.8111
  type: 'test'
  ...
# Subtest: mechanical review finds missing oracle without altering case
ok 72 - mechanical review finds missing oracle without altering case
  ---
  duration_ms: 3.117
  type: 'test'
  ...
# Subtest: JSON, CSV, and actual Excel import preserve identifiers and steps
ok 73 - JSON, CSV, and actual Excel import preserve identifiers and steps
  ---
  duration_ms: 4014.2282
  type: 'test'
  ...
# Subtest: DeepSeek adapter sends JSON mode and keeps key out of returned metadata
ok 74 - DeepSeek adapter sends JSON mode and keeps key out of returned metadata
  ---
  duration_ms: 8.2853
  type: 'test'
  ...
# Subtest: DeepSeek handles 401
ok 75 - DeepSeek handles 401
  ---
  duration_ms: 0.9849
  type: 'test'
  ...
# Subtest: DeepSeek handles truncated
ok 76 - DeepSeek handles truncated
  ---
  duration_ms: 1.3216
  type: 'test'
  ...
# Subtest: DeepSeek handles empty
ok 77 - DeepSeek handles empty
  ---
  duration_ms: 1.5194
  type: 'test'
  ...
# Subtest: DeepSeek handles non-JSON
ok 78 - DeepSeek handles non-JSON
  ---
  duration_ms: 1.4661
  type: 'test'
  ...
# Subtest: DeepSeek HTTP retry is bounded to two attempts
ok 79 - DeepSeek HTTP retry is bounded to two attempts
  ---
  duration_ms: 812.7217
  type: 'test'
  ...
# Subtest: bad model plan blocks only that case; unrelated plan continues
ok 80 - bad model plan blocks only that case; unrelated plan continues
  ---
  duration_ms: 515.3149
  type: 'test'
  ...
# Subtest: a returned evidence I/O failure is sealed once without model repair or full-case replay
ok 81 - a returned evidence I/O failure is sealed once without model repair or full-case replay
  ---
  duration_ms: 262.9479
  type: 'test'
  ...
# Subtest: a valid model response arriving after cancellation cannot publish a plan
ok 82 - a valid model response arriving after cancellation cannot publish a plan
  ---
  duration_ms: 222.2332
  type: 'test'
  ...
# Subtest: concurrent launch is rejected while the first launch is still reading its task
ok 83 - concurrent launch is rejected while the first launch is still reading its task
  ---
  duration_ms: 103.9589
  type: 'test'
  ...
# Subtest: one authentication starts autonomous discovery then prepares an unapproved plan without changing the baseline
ok 84 - one authentication starts autonomous discovery then prepares an unapproved plan without changing the baseline
  ---
  duration_ms: 1958.9524
  type: 'test'
  ...
# Subtest: unreviewed cases receive discovery observations but no generated or approved plan
ok 85 - unreviewed cases receive discovery observations but no generated or approved plan
  ---
  duration_ms: 459.6238
  type: 'test'
  ...
# Subtest: unknown discovery candidate is never dispatched or converted into a plan
ok 86 - unknown discovery candidate is never dispatched or converted into a plan
  ---
  duration_ms: 443.4411
  type: 'test'
  ...
# Subtest: cancelled late action response cannot dispatch UI or generate a plan
ok 87 - cancelled late action response cannot dispatch UI or generate a plan
  ---
  duration_ms: 360.6435
  type: 'test'
  ...
# Subtest: cancelled late done response cannot dispatch UI or generate a plan
ok 88 - cancelled late done response cannot dispatch UI or generate a plan
  ---
  duration_ms: 284.5661
  type: 'test'
  ...
# Subtest: the same observed state and action is removed so the model can finish instead of looping
ok 89 - the same observed state and action is removed so the model can finish instead of looping
  ---
  duration_ms: 471.2297
  type: 'test'
  ...
# Subtest: discovery budget scales by selected Case count instead of stopping at a shared 24 calls
ok 90 - discovery budget scales by selected Case count instead of stopping at a shared 24 calls
  ---
  duration_ms: 3426.307
  type: 'test'
  ...
# Subtest: a Case step budget blocks only that Case and continues to later Cases
ok 91 - a Case step budget blocks only that Case and continues to later Cases
  ---
  duration_ms: 1802.9837
  type: 'test'
  ...
# Subtest: selected Cases beyond one bounded batch continue automatically in later batches
ok 92 - selected Cases beyond one bounded batch continue automatically in later batches
  ---
  duration_ms: 1465.514
  type: 'test'
  ...
# Subtest: automatic discovery resumes budget-blocked Cases before recapturing completed Cases
ok 93 - automatic discovery resumes budget-blocked Cases before recapturing completed Cases
  ---
  duration_ms: 186.3928
  type: 'test'
  ...
# Subtest: diagnostic I/O failure before an approved discovery dispatch stops the job and closes the explorer
ok 94 - diagnostic I/O failure before an approved discovery dispatch stops the job and closes the explorer
  ---
  duration_ms: 136.0972
  type: 'test'
  ...
# Subtest: a blocked Case does not prevent later Cases from being discovered and prepared
ok 95 - a blocked Case does not prevent later Cases from being discovered and prepared
  ---
  duration_ms: 500.5285
  type: 'test'
  ...
# Subtest: one action timeout is isolated to its Case and every Case starts a fresh loop allowance
ok 96 - one ac
... truncated ...
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0003-state-file-coordination; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

第二轮同版非暂停运行时回归；专项故障注入与真实文件压力见REQ-0003-focused.log。不代表真实模型或发布验收。
