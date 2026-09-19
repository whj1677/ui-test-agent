# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-19T20:44:30+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `e2a3251aadc6f6b36bfec05719229b310aa55c1365e03f8f8f7c864610e478bd`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs`
- Exit code: `0`
- Test count: `305`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v8-targeted.log`
- Log SHA-256: `60deafa307c8de709ef31473ad1d1dcb7b4225c65290951e47ffba72f81dab1e`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-recovery.mjs
 M src/controller.mjs
 M src/plan-semantics.mjs
?? tests/adaptive-semantic-boundary.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |  10 +
 .../00_user_requirement.md                         |   1 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 274 ++++++++++-----------
 .../requirement.source.json                        |  19 +-
 src/adaptive-recovery.mjs                          |   2 +
 src/controller.mjs                                 |   4 +-
 src/plan-semantics.mjs                             | 142 ++++++-----
 11 files changed, 238 insertions(+), 227 deletions(-)
```

### Untracked Files

```text
tests/adaptive-semantic-boundary.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-19T20:34:32+08:00
Command: node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs
Exit code: 0
Parsed test count: 305
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: final adaptive dispatch validates actual node: write
ok 1 - final adaptive dispatch validates actual node: write
  ---
  duration_ms: 1016.8801
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: replacement
ok 2 - final adaptive dispatch validates actual node: replacement
  ---
  duration_ms: 1019.5621
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: late-name
ok 3 - final adaptive dispatch validates actual node: late-name
  ---
  duration_ms: 891.0282
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: password
ok 4 - final adaptive dispatch validates actual node: password
  ---
  duration_ms: 940.5847
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: valid
ok 5 - final adaptive dispatch validates actual node: valid
  ---
  duration_ms: 783.5144
  type: 'test'
  ...
# Subtest: measured assertion repeated with complete=true may finalize
ok 6 - measured assertion repeated with complete=true may finalize
  ---
  duration_ms: 43710.9544
  type: 'test'
  ...
# Subtest: measured assertion repeated with complete=false still stops as no progress
ok 7 - measured assertion repeated with complete=false still stops as no progress
  ---
  duration_ms: 29933.4683
  type: 'test'
  ...
# Subtest: partial audit gaps survive success and a repeated measurement recovers without replaying actions
ok 8 - partial audit gaps survive success and a repeated measurement recovers without replaying actions
  ---
  duration_ms: 42709.3214
  type: 'test'
  ...
# Subtest: contradictory audit returns candidate feedback without executing or erasing its negative finding
ok 9 - contradictory audit returns candidate feedback without executing or erasing its negative finding
  ---
  duration_ms: 38312.9069
  type: 'test'
  ...
# Subtest: focused gap repair refuses an extra navigation action before dispatch
ok 10 - focused gap repair refuses an extra navigation action before dispatch
  ---
  duration_ms: 28538.9406
  type: 'test'
  ...
# Subtest: no remaining obligations feedback permits a no-action completion but never replays navigation
ok 11 - no remaining obligations feedback permits a no-action completion but never replays navigation
  ---
  duration_ms: 42354.5442
  type: 'test'
  ...
# Subtest: real-response format error then mistaken blocked recovers without replaying menu clicks
ok 12 - real-response format error then mistaken blocked recovers without replaying menu clicks
  ---
  duration_ms: 38101.2976
  type: 'test'
  ...
# Subtest: malformed audit response repairs only the audit while preserving executed actions
ok 13 - malformed audit response repairs only the audit while preserving executed actions
  ---
  duration_ms: 37981.0433
  type: 'test'
  ...
# Subtest: repeated blocked is terminal after one evidence-based reconsideration
ok 14 - repeated blocked is terminal after one evidence-based reconsideration
  ---
  duration_ms: 6387.3614
  type: 'test'
  ...
# Subtest: current target/source refs execute through the real controller and browser kernel
ok 15 - current target/source refs execute through the real controller and browser kernel
  ---
  duration_ms: 37938.5663
  type: 'test'
  ...
# Subtest: exhausted audit format repair is terminal without spending a fresh planning round
ok 16 - exhausted audit format repair is terminal without spending a fresh planning round
  ---
  duration_ms: 6502.7908
  type: 'test'
  ...
# Subtest: direct test dynamically handles button navigation without upfront technical plan
ok 17 - direct test dynamically handles button navigation without upfront technical plan
  ---
  duration_ms: 38417.0881
  type: 'test'
  ...
# Subtest: direct test dynamically handles link navigation without upfront technical plan
ok 18 - direct test dynamically handles link navigation without upfront technical plan
  ---
  duration_ms: 38114.4954
  type: 'test'
  ...
# Subtest: actual business mismatch stops without changing oracle or replaying actions
ok 19 - actual business mismatch stops without changing oracle or replaying actions
  ---
  duration_ms: 38544.5174
  type: 'test'
  ...
# Subtest: a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
ok 20 - a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
  ---
  duration_ms: 40110.4129
  type: 'test'
  ...
# Subtest: model completion cannot skip original expected obligations
ok 21 - model completion cannot skip original expected obligations
  ---
  duration_ms: 24481.7244
  type: 'test'
  ...
# Subtest: direct entry refuses write authorization and unreviewed input
ok 22 - direct entry refuses write authorization and unreviewed input
  ---
  duration_ms: 1013.167
  type: 'test'
  ...
# Subtest: ambiguous assertion can repair its scope without replaying completed actions
ok 23 - ambiguous assertion can repair its scope without replaying completed actions
  ---
  duration_ms: 38081.1607
  type: 'test'
  ...
# Subtest: assertion scope repair cannot change the predicate or expected result
ok 24 - assertion scope repair cannot change the predicate or expected result
  ---
  duration_ms: 24081.1937
  type: 'test'
  ...
# Subtest: real pagination-button misbinding is rejected before partial or complete execution
ok 25 - real pagination-button misbinding is rejected before partial or complete execution
  ---
  duration_ms: 14.4824
  type: 'test'
  ...
# Subtest: contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
ok 26 - contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
  ---
  duration_ms: 4.4575
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects extra top field
ok 27 - strict adaptive contract rejects extra top field
  ---
  duration_ms: 0.4554
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing notes
ok 28 - strict adaptive contract rejects missing notes
  ---
  duration_ms: 0.4509
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong version
ok 29 - strict adaptive contract rejects wrong version
  ---
  duration_ms: 0.7661
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong case id
ok 30 - strict adaptive contract rejects wrong case id
  ---
  duration_ms: 0.6672
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong hash
ok 31 - strict adaptive contract rejects wrong hash
  ---
  duration_ms: 0.5916
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects external entry
ok 32 - strict adaptive contract rejects external entry
  ---
  duration_ms: 0.5293
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects mutation
ok 33 - strict adaptive contract rejects mutation
  ---
  duration_ms: 0.783
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects cleanup
ok 34 - strict adaptive contract rejects cleanup
  ---
  duration_ms: 0.7223
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precondition
ok 35 - strict adaptive contract rejects precondition
  ---
  duration_ms: 0.5544
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy extra
ok 36 - strict adaptive contract rejects policy extra
  ---
  duration_ms: 0.3556
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy mode
ok 37 - strict adaptive contract rejects policy mode
  ---
  duration_ms: 0.3144
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects segment budget
ok 38 - strict adaptive contract rejects segment budget
  ---
  duration_ms: 0.2991
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects replan budget
ok 39 - strict adaptive contract rejects replan budget
  ---
  duration_ms: 0.2698
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing step
ok 40 - strict adaptive contract rejects missing step
  ---
  duration_ms: 0.3189
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects reordered steps
ok 41 - strict adaptive contract rejects reordered steps
  ---
  duration_ms: 1.5201
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects changed source
ok 42 - strict adaptive contract rejects changed source
  ---
  duration_ms: 0.8286
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects step extra
ok 43 - strict adaptive contract rejects step extra
  ---
  duration_ms: 0.5338
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precompiled step
ok 44 - strict adaptive contract rejects precompiled step
  ---
  duration_ms: 0.4658
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects illegal timeout
ok 45 - strict adaptive contract rejects illegal timeout
  ---
  duration_ms: 0.2794
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects string timeout
ok 46 - strict adaptive contract rejects string timeout
  ---
  duration_ms: 0.6342
  type: 'test'
  ...
# Subtest: Case hash includes data and changes are never silently rebased
ok 47 - Case hash includes data and changes are never silently rebased
  ---
  duration_ms: 0.8759
  type: 'test'
  ...
# Subtest: action-only, assertion-only and copied fragment return; no inputs are mutated
ok 48 - action-only, assertion-only and copied fragment return; no inputs are mutated
  ---
  duration_ms: 2.2195
  type: 'test'
  ...
# Subtest: fragment rejects extra field
ok 49 - fragment rejects extra field
  ---
  duration_ms: 0.6397
  type: 'test'
  ...
# Subtest: fragment rejects missing reason
ok 50 - fragment rejects missing reason
  ---
  duration_ms: 0.3748
  type: 'test'
  ...
# Subtest: fragment rejects blank reason
ok 51 - fragment rejects blank reason
  ---
  duration_ms: 0.4292
  type: 'test'
  ...
# Subtest: fragment rejects nonboolean complete
ok 52 - fragment rejects nonboolean complete
  ---
  duration_ms: 0.8231
  type: 'test'
  ...
# Subtest: fragment rejects two actions
ok 53 - fragment rejects two actions
  ---
  duration_ms: 0.4326
  type: 'test'
  ...
# Subtest: fragment rejects 21 assertions
ok 54 - fragment rejects 21 assertions
  ---
  duration_ms: 0.4345
  type: 'test'
  ...
# Subtest: fragment rejects below time bound
ok 55 - fragment rejects below time bound
  ---
  duration_ms: 0.2881
  type: 'test'
  ...
# Subtest: fragment rejects above time bound
ok 56 - fragment rejects above time bound
  ---
  duration_ms: 0.288
  type: 'test'
  ...
# Subtest: fragment rejects fractional time
ok 57 - fragment rejects fractional time
  ---
  duration_ms: 0.3425
  type: 'test'
  ...
# Subtest: fragment rejects arbitrary operation
ok 58 - fragment rejects arbitrary operation
  ---
  duration_ms: 0.343
  type: 'test'
  ...
# Subtest: fragment rejects repair_anchor
ok 59 - fragment rejects repair_anchor
  ---
  duration_ms: 0.353
  type: 'test'
  ...
# Subtest: fragment rejects future case_named
ok 60 - fragment rejects future case_named
  ---
  duration_ms: 0.3114
  type: 'test'
  ...
# Subtest: fragment rejects future runtime_intent
ok 61 - fragment rejects future runtime_intent
  ---
  duration_ms: 0.3015
  type: 'test'
  ...
# Subtest: empty completion requires earlier assertions and complete coverage, never just prior action
ok 62 - empty completion requires earlier assertions and complete coverage, never just prior action
  ---
  duration_ms: 4.5508
  type: 'test'
  ...
# Subtest: current original step is authoritative; previous fragments and IDs are revalidated
ok 63 - current original step is authoritative; previous fragments and IDs are revalidated
  ---
  duration_ms: 2.2314
  type: 'test'
  ...
# Subtest: only current action substrings and data scalar VALUES authorize input; expected and other steps do not
ok 64 - only current action substrings and data scalar VALUES authorize input; expected and other steps do not
  ---
  duration_ms: 6.5787
  type: 'test'
  ...
# Subtest: navigation needs same origin and whole explicit action path, not data or a path prefix
ok 65 - navigation needs same origin and whole explicit action path, not data or a path prefix
  ---
  duration_ms: 5.7144
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 保存 even if literal in source
ok 66 - read-only known-write guard rejects 保存 even if literal in source
  ---
  duration_ms: 0.4673
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 提交 even if literal in source
ok 67 - read-only known-write guard rejects 提交 even if literal in source
  ---
  duration_ms: 0.3263
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 删除 even if literal in source
ok 68 - read-only known-write guard rejects 删除 even if literal in source
  ---
  duration_ms: 0.3248
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 新建 even if literal in source
ok 69 - read-only known-write guard rejects 新建 even if literal in source
  ---
  duration_ms: 0.5787
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 创建 even if literal in source
ok 70 - read-only known-write guard rejects 创建 even if literal in source
  ---
  duration_ms: 1.4028
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 重置数据 even if literal in source
ok 71 - read-only known-write guard rejects 重置数据 even if literal in source
  ---
  duration_ms: 1.0665
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 清空数据 even if literal in source
ok 72 - read-only known-write guard rejects 清空数据 even if literal in source
  ---
  duration_ms: 0.6421
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 上传 even if literal in source
ok 73 - read-only known-write guard rejects 上传 even if literal in source
  ---
  duration_ms: 1.0314
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 退出登录 even if literal in source
ok 74 - read-only known-write guard rejects 退出登录 even if literal in source
  ---
  duration_ms: 0.7033
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects Delete even if literal in source
ok 75 - read-only known-write guard rejects Delete even if literal in source
  ---
  duration_ms: 1.0915
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects Save even if literal in source
ok 76 - read-only known-write guard rejects Save even if literal in source
  ---
  duration_ms: 0.7242
  type: 'test'
  ...
# Subtest: query reset is source-bound and sensitive controls are forbidden for both actions and assertions
ok 77 - query reset is source-bound and sensitive controls are forbidden for both actions and assertions
  ---
  duration_ms: 8.1883
  type: 'test'
  ...
# Subtest: read-only technical tools remain in fixed protocol and retain optional-dialog source conditions
ok 78 - read-only technical tools remain in fixed protocol and retain optional-dialog source conditions
  ---
  duration_ms: 6.4218
  type: 'test'
  ...
# Subtest: row/cell identity must come from Case scalars/actions/expected, never current DOM or metadata keys
ok 79 - row/cell identity must come from Case scalars/actions/expected, never current DOM or metadata keys
  ---
  duration_ms: 7.7601
  type: 'test'
  ...
# Subtest: business within scope is source-bound; dialog names are left to current-DOM independent audit
ok 80 - business within scope is source-bound; dialog names are left to current-DOM independent audit
  ---
  duration_ms: 2.8213
  type: 'test'
  ...
# Subtest: every assertion requires current-step quote and obligation IDs, including in prior fragments
ok 81 - every assertion requires current-step quote and obligation IDs, including in prior fragments
  ---
  duration_ms: 2.0592
  type: 'test'
  ...
# Subtest: matrix assertions are grounded in original data and count as one assertion, not cell count
ok 82 - matrix assertions are grounded in original data and count as one assertion, not cell count
  ---
  duration_ms: 7.0293
  type: 'test'
  ...
# Subtest: cumulative 20-assertion and 8-segment budgets cannot be reset by a new reply
ok 83 - cumulative 20-assertion and 8-segment budgets cannot be reset by a new reply
  ---
  duration_ms: 3.8301
  type: 'test'
  ...
# Subtest: projection groups consecutive actions only into the NEXT assertion checkpoint, preserves order and source
ok 84 - projection groups consecutive actions only into the NEXT assertion checkpoint, preserves order and source
  ---
  duration_ms: 1.507
  type: 'test'
  ...
# Subtest: pending tail actions remain available for partial audit but can never disappear at complete
ok 85 - pending tail actions remain available for partial audit but can never disappear at complete
  ---
  duration_ms: 2.4334
  type: 'test'
  ...
# Subtest: only-final-complete adds no checkpoint and v3 completion still enforces required click
ok 86 - only-final-complete adds no checkpoint and v3 completion still enforces required click
  ---
  duration_ms: 3.3469
  type: 'test'
  ...
# Subtest: partial audit injection retains missing obligations; other audit issues still reject and complete needs coverage
ok 87 - partial audit injection retains missing obligations; other audit issues still reject and complete needs coverage
  ---
  duration_ms: 2.8019
  type: 'test'
  ...
# Subtest: partial validator does not require future URL evidence; complete caller semantics still rejects false coverage
ok 88 - partial validator does not require future URL evidence; complete caller semantics still rejects false coverage
  ---
  duration_ms: 2.2169
  type: 'test'
  ...
# Subtest: prompts define current-only segments and an appended audit override, not a technical approval or replay
ok 89 - prompts define current-only segments and an appended audit override, not a technical approval or replay
  ---
  duration_ms: 0.3317
  type: 'test'
  ...
# Subtest: all complete JSON prompt examples parse and satisfy the existing action/assertion schema
ok 90 - all complete JSON prompt examples parse and satisfy the existing action/assertion schema
  ---
  duration_ms: 0.5248
  type: 'test'
  ...
# Subtest: initial progress contains every original obligation without guessed coverage
ok 91 - initial progress contains every original obligation without guessed coverage
  ---
  duration_ms: 1.4561
  type: 'test'
  ...
# Subtest: same-obligation partial row count remains pending with measured reference and missing-clause reason
ok 92 - same-obligation partial row count remains pending with measured reference and missing-clause reason
  ---
  duration_ms: 1.8267
  type: 'test'
  ...
# Subtest: covered requires a successfully executed same-obligation assertion, never a proposed or cross-step reference
ok 93 - covered requires a successfully executed same-obligation assertion, never a proposed or cross-step reference
  ---
  duration_ms: 0.4407
  type: 'test'
  ...
# Subtest: focused repair keeps original gaps, forbids repeating/relabeling measurements and new actions
ok 94 - focused repair keeps original gaps, forbids repeating/relabeling measurements and new actions
  ---
  duration_ms: 2.9292
  type: 'test'
  ...
# Subtest: focused no-gap completion contains no new assertions or actions and does not mutate historical evidence
ok 95 - focused no-gap completion contains no new assertions or actions and does not mutate historical evidence
  ---
  duration_ms: 0.5935
  type:
... truncated ...
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- 更新事实源视图后的独立复检：`python scripts/check_ai_context.py`，退出码`0`，输出`PASS ai-engineering-context checks`；仅文档一致性检查，不代表产品验收。
- 首次检查未通过：04_verification.md和05_trace.md未同步本轮事实。已更新requirement.source.json并重新生成视图；首次原始记录完整保留于`validation/req0017/v8-first-delivery-evidence.md`。
- 工程命令及305项统计来自上方原collector实跑，没有重跑或改写该执行日志。

### Notes

版本8仅修片段与完成态语义规则不一致；隔离浏览器和注入回复，不调用真实模型，不重启4179。版本7真实2/3失败事实保留，不作为版本8验收。
