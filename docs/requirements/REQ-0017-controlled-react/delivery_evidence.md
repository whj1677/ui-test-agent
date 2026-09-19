# Delivery Evidence

## 2026-09-19 真实复测补充（非下方工程重跑）

- 新增脱敏结论文件：`docs/requirements/REQ-0017-controlled-react/real-model-v7-result.md`。
- 原三例真实模型实际2/3完整通过，66调用、420.143秒；V03完成态与片段态语义校验不一致，详情未执行，不是产品验收。
- 只读命令：`node validation/req0017/verify-live-round.mjs`，退出码0；核对3例原步骤与33份媒体SHA，收据`validation/req0017/v7-real-result.json`。该命令不调用模型或修改任务。
- 本次只更新验证事实和文档；下方373项工程collector记录保留原日期、命令、日志及结论，未将其伪称本次重跑。
- 首次文档检查因新结论文件未登记到交付证据而失败；本节补齐登记后复检，原业务失败不改。

## Delivery Evidence (managed)

- Generated at: `2026-09-18T17:44:16+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `25529f950b7fcb62b429285a9e0621435af42d7236b7bfa474c5738ee47630c9`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs`
- Exit code: `0`
- Test count: `373`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v7-targeted.log`
- Log SHA-256: `6dcb9964aa8397635bde5467d9baf1d15464054fec317fff37aef54612d761f6`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M tests/adaptive-execution.test.mjs
 M tests/adaptive-progress.test.mjs
?? tests/adaptive-source-recovery.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-execution.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-progress.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |  10 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   4 +-
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   6 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |  10 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 437 ++++++++++-----------
 .../requirement.source.json                        |  39 +-
 src/adaptive-execution.mjs                         |  24 +-
 src/adaptive-plan.mjs                              |   1 +
 src/adaptive-recovery.mjs                          |  39 +-
 tests/adaptive-execution.test.mjs                  |  39 ++
 tests/adaptive-progress.test.mjs                   | 107 ++++-
 15 files changed, 465 insertions(+), 258 deletions(-)
```

### Untracked Files

```text
tests/adaptive-source-recovery.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T17:34:29+08:00
Command: node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs tests/table-assertion.test.mjs
Exit code: 0
Parsed test count: 373
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: final adaptive dispatch validates actual node: write
ok 1 - final adaptive dispatch validates actual node: write
  ---
  duration_ms: 845.3674
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: replacement
ok 2 - final adaptive dispatch validates actual node: replacement
  ---
  duration_ms: 733.2045
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: late-name
ok 3 - final adaptive dispatch validates actual node: late-name
  ---
  duration_ms: 786.8977
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: password
ok 4 - final adaptive dispatch validates actual node: password
  ---
  duration_ms: 703.0026
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: valid
ok 5 - final adaptive dispatch validates actual node: valid
  ---
  duration_ms: 764.3335
  type: 'test'
  ...
# Subtest: measured assertion repeated with complete=true may finalize
ok 6 - measured assertion repeated with complete=true may finalize
  ---
  duration_ms: 42316.9804
  type: 'test'
  ...
# Subtest: measured assertion repeated with complete=false still stops as no progress
ok 7 - measured assertion repeated with complete=false still stops as no progress
  ---
  duration_ms: 28116.0027
  type: 'test'
  ...
# Subtest: partial audit gaps survive success and a repeated measurement recovers without replaying actions
ok 8 - partial audit gaps survive success and a repeated measurement recovers without replaying actions
  ---
  duration_ms: 41735.2309
  type: 'test'
  ...
# Subtest: contradictory audit returns candidate feedback without executing or erasing its negative finding
ok 9 - contradictory audit returns candidate feedback without executing or erasing its negative finding
  ---
  duration_ms: 38495.0111
  type: 'test'
  ...
# Subtest: focused gap repair refuses an extra navigation action before dispatch
ok 10 - focused gap repair refuses an extra navigation action before dispatch
  ---
  duration_ms: 27934.7419
  type: 'test'
  ...
# Subtest: no remaining obligations feedback permits a no-action completion but never replays navigation
ok 11 - no remaining obligations feedback permits a no-action completion but never replays navigation
  ---
  duration_ms: 41471.3792
  type: 'test'
  ...
# Subtest: real-response format error then mistaken blocked recovers without replaying menu clicks
ok 12 - real-response format error then mistaken blocked recovers without replaying menu clicks
  ---
  duration_ms: 38736.8807
  type: 'test'
  ...
# Subtest: malformed audit response repairs only the audit while preserving executed actions
ok 13 - malformed audit response repairs only the audit while preserving executed actions
  ---
  duration_ms: 37430.9805
  type: 'test'
  ...
# Subtest: repeated blocked is terminal after one evidence-based reconsideration
ok 14 - repeated blocked is terminal after one evidence-based reconsideration
  ---
  duration_ms: 6109.1139
  type: 'test'
  ...
# Subtest: current target/source refs execute through the real controller and browser kernel
ok 15 - current target/source refs execute through the real controller and browser kernel
  ---
  duration_ms: 37474.1127
  type: 'test'
  ...
# Subtest: exhausted audit format repair is terminal without spending a fresh planning round
ok 16 - exhausted audit format repair is terminal without spending a fresh planning round
  ---
  duration_ms: 6124.8661
  type: 'test'
  ...
# Subtest: direct test dynamically handles button navigation without upfront technical plan
ok 17 - direct test dynamically handles button navigation without upfront technical plan
  ---
  duration_ms: 37712.33
  type: 'test'
  ...
# Subtest: direct test dynamically handles link navigation without upfront technical plan
ok 18 - direct test dynamically handles link navigation without upfront technical plan
  ---
  duration_ms: 37521.4382
  type: 'test'
  ...
# Subtest: actual business mismatch stops without changing oracle or replaying actions
ok 19 - actual business mismatch stops without changing oracle or replaying actions
  ---
  duration_ms: 38024.7191
  type: 'test'
  ...
# Subtest: a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
ok 20 - a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
  ---
  duration_ms: 39670.4222
  type: 'test'
  ...
# Subtest: model completion cannot skip original expected obligations
ok 21 - model completion cannot skip original expected obligations
  ---
  duration_ms: 23896.7101
  type: 'test'
  ...
# Subtest: direct entry refuses write authorization and unreviewed input
ok 22 - direct entry refuses write authorization and unreviewed input
  ---
  duration_ms: 902.4571
  type: 'test'
  ...
# Subtest: ambiguous assertion can repair its scope without replaying completed actions
ok 23 - ambiguous assertion can repair its scope without replaying completed actions
  ---
  duration_ms: 37849.4817
  type: 'test'
  ...
# Subtest: assertion scope repair cannot change the predicate or expected result
ok 24 - assertion scope repair cannot change the predicate or expected result
  ---
  duration_ms: 23747.4569
  type: 'test'
  ...
# Subtest: real pagination-button misbinding is rejected before partial or complete execution
ok 25 - real pagination-button misbinding is rejected before partial or complete execution
  ---
  duration_ms: 7.2205
  type: 'test'
  ...
# Subtest: contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
ok 26 - contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
  ---
  duration_ms: 2.5612
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects extra top field
ok 27 - strict adaptive contract rejects extra top field
  ---
  duration_ms: 0.5095
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing notes
ok 28 - strict adaptive contract rejects missing notes
  ---
  duration_ms: 0.2789
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong version
ok 29 - strict adaptive contract rejects wrong version
  ---
  duration_ms: 0.4357
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong case id
ok 30 - strict adaptive contract rejects wrong case id
  ---
  duration_ms: 0.323
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong hash
ok 31 - strict adaptive contract rejects wrong hash
  ---
  duration_ms: 0.2871
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects external entry
ok 32 - strict adaptive contract rejects external entry
  ---
  duration_ms: 0.2648
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects mutation
ok 33 - strict adaptive contract rejects mutation
  ---
  duration_ms: 0.5518
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects cleanup
ok 34 - strict adaptive contract rejects cleanup
  ---
  duration_ms: 0.5255
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precondition
ok 35 - strict adaptive contract rejects precondition
  ---
  duration_ms: 0.3167
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy extra
ok 36 - strict adaptive contract rejects policy extra
  ---
  duration_ms: 0.2283
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy mode
ok 37 - strict adaptive contract rejects policy mode
  ---
  duration_ms: 0.2202
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects segment budget
ok 38 - strict adaptive contract rejects segment budget
  ---
  duration_ms: 0.2245
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects replan budget
ok 39 - strict adaptive contract rejects replan budget
  ---
  duration_ms: 0.2059
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing step
ok 40 - strict adaptive contract rejects missing step
  ---
  duration_ms: 0.1887
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects reordered steps
ok 41 - strict adaptive contract rejects reordered steps
  ---
  duration_ms: 0.9422
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects changed source
ok 42 - strict adaptive contract rejects changed source
  ---
  duration_ms: 0.3684
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects step extra
ok 43 - strict adaptive contract rejects step extra
  ---
  duration_ms: 0.2365
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precompiled step
ok 44 - strict adaptive contract rejects precompiled step
  ---
  duration_ms: 0.229
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects illegal timeout
ok 45 - strict adaptive contract rejects illegal timeout
  ---
  duration_ms: 0.2179
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects string timeout
ok 46 - strict adaptive contract rejects string timeout
  ---
  duration_ms: 0.242
  type: 'test'
  ...
# Subtest: Case hash includes data and changes are never silently rebased
ok 47 - Case hash includes data and changes are never silently rebased
  ---
  duration_ms: 0.5143
  type: 'test'
  ...
# Subtest: action-only, assertion-only and copied fragment return; no inputs are mutated
ok 48 - action-only, assertion-only and copied fragment return; no inputs are mutated
  ---
  duration_ms: 2.2009
  type: 'test'
  ...
# Subtest: fragment rejects extra field
ok 49 - fragment rejects extra field
  ---
  duration_ms: 0.4037
  type: 'test'
  ...
# Subtest: fragment rejects missing reason
ok 50 - fragment rejects missing reason
  ---
  duration_ms: 0.3232
  type: 'test'
  ...
# Subtest: fragment rejects blank reason
ok 51 - fragment rejects blank reason
  ---
  duration_ms: 0.3218
  type: 'test'
  ...
# Subtest: fragment rejects nonboolean complete
ok 52 - fragment rejects nonboolean complete
  ---
  duration_ms: 0.7631
  type: 'test'
  ...
# Subtest: fragment rejects two actions
ok 53 - fragment rejects two actions
  ---
  duration_ms: 0.3971
  type: 'test'
  ...
# Subtest: fragment rejects 21 assertions
ok 54 - fragment rejects 21 assertions
  ---
  duration_ms: 0.4266
  type: 'test'
  ...
# Subtest: fragment rejects below time bound
ok 55 - fragment rejects below time bound
  ---
  duration_ms: 0.2818
  type: 'test'
  ...
# Subtest: fragment rejects above time bound
ok 56 - fragment rejects above time bound
  ---
  duration_ms: 0.2813
  type: 'test'
  ...
# Subtest: fragment rejects fractional time
ok 57 - fragment rejects fractional time
  ---
  duration_ms: 0.3292
  type: 'test'
  ...
# Subtest: fragment rejects arbitrary operation
ok 58 - fragment rejects arbitrary operation
  ---
  duration_ms: 0.3353
  type: 'test'
  ...
# Subtest: fragment rejects repair_anchor
ok 59 - fragment rejects repair_anchor
  ---
  duration_ms: 0.3859
  type: 'test'
  ...
# Subtest: fragment rejects future case_named
ok 60 - fragment rejects future case_named
  ---
  duration_ms: 0.3795
  type: 'test'
  ...
# Subtest: fragment rejects future runtime_intent
ok 61 - fragment rejects future runtime_intent
  ---
  duration_ms: 0.6047
  type: 'test'
  ...
# Subtest: empty completion requires earlier assertions and complete coverage, never just prior action
ok 62 - empty completion requires earlier assertions and complete coverage, never just prior action
  ---
  duration_ms: 4.3017
  type: 'test'
  ...
# Subtest: current original step is authoritative; previous fragments and IDs are revalidated
ok 63 - current original step is authoritative; previous fragments and IDs are revalidated
  ---
  duration_ms: 2.777
  type: 'test'
  ...
# Subtest: only current action substrings and data scalar VALUES authorize input; expected and other steps do not
ok 64 - only current action substrings and data scalar VALUES authorize input; expected and other steps do not
  ---
  duration_ms: 5.2847
  type: 'test'
  ...
# Subtest: navigation needs same origin and whole explicit action path, not data or a path prefix
ok 65 - navigation needs same origin and whole explicit action path, not data or a path prefix
  ---
  duration_ms: 4.5331
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 保存 even if literal in source
ok 66 - read-only known-write guard rejects 保存 even if literal in source
  ---
  duration_ms: 0.4597
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 提交 even if literal in source
ok 67 - read-only known-write guard rejects 提交 even if literal in source
  ---
  duration_ms: 0.2841
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 删除 even if literal in source
ok 68 - read-only known-write guard rejects 删除 even if literal in source
  ---
  duration_ms: 0.2372
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 新建 even if literal in source
ok 69 - read-only known-write guard rejects 新建 even if literal in source
  ---
  duration_ms: 0.7128
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 创建 even if literal in source
ok 70 - read-only known-write guard rejects 创建 even if literal in source
  ---
  duration_ms: 0.3068
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 重置数据 even if literal in source
ok 71 - read-only known-write guard rejects 重置数据 even if literal in source
  ---
  duration_ms: 0.248
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 清空数据 even if literal in source
ok 72 - read-only known-write guard rejects 清空数据 even if literal in source
  ---
  duration_ms: 0.2377
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 上传 even if literal in source
ok 73 - read-only known-write guard rejects 上传 even if literal in source
  ---
  duration_ms: 1.2623
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 退出登录 even if literal in source
ok 74 - read-only known-write guard rejects 退出登录 even if literal in source
  ---
  duration_ms: 0.4607
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects Delete even if literal in source
ok 75 - read-only known-write guard rejects Delete even if literal in source
  ---
  duration_ms: 0.5826
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects Save even if literal in source
ok 76 - read-only known-write guard rejects Save even if literal in source
  ---
  duration_ms: 0.4335
  type: 'test'
  ...
# Subtest: query reset is source-bound and sensitive controls are forbidden for both actions and assertions
ok 77 - query reset is source-bound and sensitive controls are forbidden for both actions and assertions
  ---
  duration_ms: 6.542
  type: 'test'
  ...
# Subtest: read-only technical tools remain in fixed protocol and retain optional-dialog source conditions
ok 78 - read-only technical tools remain in fixed protocol and retain optional-dialog source conditions
  ---
  duration_ms: 3.5574
  type: 'test'
  ...
# Subtest: row/cell identity must come from Case scalars/actions/expected, never current DOM or metadata keys
ok 79 - row/cell identity must come from Case scalars/actions/expected, never current DOM or metadata keys
  ---
  duration_ms: 5.3312
  type: 'test'
  ...
# Subtest: business within scope is source-bound; dialog names are left to current-DOM independent audit
ok 80 - business within scope is source-bound; dialog names are left to current-DOM independent audit
  ---
  duration_ms: 2.5984
  type: 'test'
  ...
# Subtest: every assertion requires current-step quote and obligation IDs, including in prior fragments
ok 81 - every assertion requires current-step quote and obligation IDs, including in prior fragments
  ---
  duration_ms: 2.1917
  type: 'test'
  ...
# Subtest: matrix assertions are grounded in original data and count as one assertion, not cell count
ok 82 - matrix assertions are grounded in original data and count as one assertion, not cell count
  ---
  duration_ms: 4.8366
  type: 'test'
  ...
# Subtest: cumulative 20-assertion and 8-segment budgets cannot be reset by a new reply
ok 83 - cumulative 20-assertion and 8-segment budgets cannot be reset by a new reply
  ---
  duration_ms: 2.876
  type: 'test'
  ...
# Subtest: projection groups consecutive actions only into the NEXT assertion checkpoint, preserves order and source
ok 84 - projection groups consecutive actions only into the NEXT assertion checkpoint, preserves order and source
  ---
  duration_ms: 2.0669
  type: 'test'
  ...
# Subtest: pending tail actions remain available for partial audit but can never disappear at complete
ok 85 - pending tail actions remain available for partial audit but can never disappear at complete
  ---
  duration_ms: 1.7137
  type: 'test'
  ...
# Subtest: only-final-complete adds no checkpoint and v3 completion still enforces required click
ok 86 - only-final-complete adds no checkpoint and v3 completion still enforces required click
  ---
  duration_ms: 1.3787
  type: 'test'
  ...
# Subtest: partial audit injection retains missing obligations; other audit issues still reject and complete needs coverage
ok 87 - partial audit injection retains missing obligations; other audit issues still reject and complete needs coverage
  ---
  duration_ms: 1.4669
  type: 'test'
  ...
# Subtest: partial validator does not require future URL evidence; complete caller semantics still rejects false coverage
ok 88 - partial validator does not require future URL evidence; complete caller semantics still rejects false coverage
  ---
  duration_ms: 1.2137
  type: 'test'
  ...
# Subtest: prompts define current-only segments and an appended audit override, not a technical approval or replay
ok 89 - prompts define current-only segments and an appended audit override, not a technical approval or replay
  ---
  duration_ms: 0.205
  type: 'test'
  ...
# Subtest: all complete JSON prompt examples parse and satisfy the existing action/assertion schema
ok 90 - all complete JSON prompt examples parse and satisfy the existing action/assertion schema
  ---
  duration_ms: 0.3699
  type: 'test'
  ...
# Subtest: initial progress contains every original obligation without guessed coverage
ok 91 - initial progress contains every original obligation without guessed coverage
  ---
  duration_ms: 0.8508
  type: 'test'
  ...
# Subtest: same-obligation partial row count remains pending with measured reference and missing-clause reason
ok 92 - same-obligation partial row count remains pending with measured reference and missing-clause reason
  ---
  duration_ms: 0.9331
  type: 'test'
  ...
# Subtest: covered requires a successfully executed same-obligation assertion, never a proposed or cross-step reference
ok 93 - covered requires a successfully executed same-obligation assertion, never a proposed or cross-step reference
  ---
  duration_ms: 0.2121
  type: 'test'
  ...
# Subtest: focused repair keeps original gaps, forbids repeating/relabeling measurements and new actions
ok 94 - focused repair keeps original gaps, forbids repeating/relabeling measurements and new actions
  ---
  duration_ms: 1.5967
  type: 'test'
  ...
# Subtest: focused no-gap completion contains no new assertions or actions and does not mutate historical evidence
ok 95 - focused no-gap completion contains no new assertions or actions and does not mutate historical evidence
  ---
  duration_ms: 0.2547
  type: 'test'
  ...
# Subtest: source correction exposes exact failed field but never automatically normalizes observed units
ok 96 - source
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

版本7原数值来源纠错与缺口定向恢复；本机Chromium/注入回复工程验证，无新增外部API调用、不重启4179；不替代真实模型自主验收。
