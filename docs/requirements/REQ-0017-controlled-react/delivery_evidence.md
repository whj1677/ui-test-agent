# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T16:41:50+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `f73f5abe142bfe63b63c98a758851c2a4f8dceb830e971dac4bc02e3d7188a3b`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs`
- Exit code: `0`
- Test count: `262`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v5-targeted.log`
- Log SHA-256: `f4a51fd4c553c17d44f105df765d30b804c01e11ae6a5f4cfdff38236808b087`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-review.mjs
 M src/expectation-coverage.mjs
 M tests/adaptive-execution.test.mjs
 M tests/adaptive-plan.test.mjs
 M tests/adaptive-review.test.mjs
 M tests/expectation-coverage.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/expectation-coverage.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-execution.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-plan.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-review.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/expectation-coverage.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   4 +
 .../00_user_requirement.md                         |   7 +-
 .../REQ-0017-controlled-react/04_verification.md   |   4 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   6 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 783 +++++++++------------
 .../requirement.source.json                        |  23 +-
 src/adaptive-execution.mjs                         |   8 +-
 src/adaptive-plan.mjs                              |   3 +-
 src/adaptive-review.mjs                            |  45 +-
 src/expectation-coverage.mjs                       |  33 +
 tests/adaptive-execution.test.mjs                  |  32 +
 tests/adaptive-plan.test.mjs                       |  24 +
 tests/adaptive-review.test.mjs                     |  23 +
 tests/expectation-coverage.test.mjs                |  37 +-
 15 files changed, 571 insertions(+), 462 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T16:34:26+08:00
Command: node --test --test-concurrency=4 tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/expectation-coverage.test.mjs tests/plan-quality.test.mjs tests/adaptive-report.test.mjs tests/adaptive-dispatch.test.mjs
Exit code: 0
Parsed test count: 262
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: final adaptive dispatch validates actual node: write
ok 1 - final adaptive dispatch validates actual node: write
  ---
  duration_ms: 885.802
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: replacement
ok 2 - final adaptive dispatch validates actual node: replacement
  ---
  duration_ms: 875.0109
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: late-name
ok 3 - final adaptive dispatch validates actual node: late-name
  ---
  duration_ms: 787.4819
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: password
ok 4 - final adaptive dispatch validates actual node: password
  ---
  duration_ms: 775.1756
  type: 'test'
  ...
# Subtest: final adaptive dispatch validates actual node: valid
ok 5 - final adaptive dispatch validates actual node: valid
  ---
  duration_ms: 818.8171
  type: 'test'
  ...
# Subtest: measured assertion repeated with complete=true may finalize
ok 6 - measured assertion repeated with complete=true may finalize
  ---
  duration_ms: 43280.0047
  type: 'test'
  ...
# Subtest: measured assertion repeated with complete=false still stops as no progress
ok 7 - measured assertion repeated with complete=false still stops as no progress
  ---
  duration_ms: 28282.996
  type: 'test'
  ...
# Subtest: real-response format error then mistaken blocked recovers without replaying menu clicks
ok 8 - real-response format error then mistaken blocked recovers without replaying menu clicks
  ---
  duration_ms: 39215.1678
  type: 'test'
  ...
# Subtest: malformed audit response repairs only the audit while preserving executed actions
ok 9 - malformed audit response repairs only the audit while preserving executed actions
  ---
  duration_ms: 39167.6024
  type: 'test'
  ...
# Subtest: repeated blocked is terminal after one evidence-based reconsideration
ok 10 - repeated blocked is terminal after one evidence-based reconsideration
  ---
  duration_ms: 6394.3217
  type: 'test'
  ...
# Subtest: current target/source refs execute through the real controller and browser kernel
ok 11 - current target/source refs execute through the real controller and browser kernel
  ---
  duration_ms: 37772.5727
  type: 'test'
  ...
# Subtest: exhausted audit format repair is terminal without spending a fresh planning round
ok 12 - exhausted audit format repair is terminal without spending a fresh planning round
  ---
  duration_ms: 6219.0249
  type: 'test'
  ...
# Subtest: direct test dynamically handles button navigation without upfront technical plan
ok 13 - direct test dynamically handles button navigation without upfront technical plan
  ---
  duration_ms: 37653.7562
  type: 'test'
  ...
# Subtest: direct test dynamically handles link navigation without upfront technical plan
ok 14 - direct test dynamically handles link navigation without upfront technical plan
  ---
  duration_ms: 37747.7575
  type: 'test'
  ...
# Subtest: actual business mismatch stops without changing oracle or replaying actions
ok 15 - actual business mismatch stops without changing oracle or replaying actions
  ---
  duration_ms: 38808.6011
  type: 'test'
  ...
# Subtest: a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
ok 16 - a pre-dispatch locator failure is locally replanned and the rejected attempt is retained
  ---
  duration_ms: 40072.4786
  type: 'test'
  ...
# Subtest: model completion cannot skip original expected obligations
ok 17 - model completion cannot skip original expected obligations
  ---
  duration_ms: 24622.636
  type: 'test'
  ...
# Subtest: direct entry refuses write authorization and unreviewed input
ok 18 - direct entry refuses write authorization and unreviewed input
  ---
  duration_ms: 866.7597
  type: 'test'
  ...
# Subtest: ambiguous assertion can repair its scope without replaying completed actions
ok 19 - ambiguous assertion can repair its scope without replaying completed actions
  ---
  duration_ms: 38291.9654
  type: 'test'
  ...
# Subtest: assertion scope repair cannot change the predicate or expected result
ok 20 - assertion scope repair cannot change the predicate or expected result
  ---
  duration_ms: 24293.0233
  type: 'test'
  ...
# Subtest: real pagination-button misbinding is rejected before partial or complete execution
ok 21 - real pagination-button misbinding is rejected before partial or complete execution
  ---
  duration_ms: 11.542
  type: 'test'
  ...
# Subtest: contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
ok 22 - contract copies exact original strings, hashes full Case and contains no precompiled checkpoints
  ---
  duration_ms: 2.4878
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects extra top field
ok 23 - strict adaptive contract rejects extra top field
  ---
  duration_ms: 0.4339
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing notes
ok 24 - strict adaptive contract rejects missing notes
  ---
  duration_ms: 0.3251
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong version
ok 25 - strict adaptive contract rejects wrong version
  ---
  duration_ms: 0.3559
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong case id
ok 26 - strict adaptive contract rejects wrong case id
  ---
  duration_ms: 0.2605
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects wrong hash
ok 27 - strict adaptive contract rejects wrong hash
  ---
  duration_ms: 0.3673
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects external entry
ok 28 - strict adaptive contract rejects external entry
  ---
  duration_ms: 0.3568
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects mutation
ok 29 - strict adaptive contract rejects mutation
  ---
  duration_ms: 0.6559
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects cleanup
ok 30 - strict adaptive contract rejects cleanup
  ---
  duration_ms: 0.6516
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precondition
ok 31 - strict adaptive contract rejects precondition
  ---
  duration_ms: 0.4244
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy extra
ok 32 - strict adaptive contract rejects policy extra
  ---
  duration_ms: 0.4829
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects policy mode
ok 33 - strict adaptive contract rejects policy mode
  ---
  duration_ms: 0.3254
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects segment budget
ok 34 - strict adaptive contract rejects segment budget
  ---
  duration_ms: 0.5232
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects replan budget
ok 35 - strict adaptive contract rejects replan budget
  ---
  duration_ms: 0.7891
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects missing step
ok 36 - strict adaptive contract rejects missing step
  ---
  duration_ms: 1.6725
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects reordered steps
ok 37 - strict adaptive contract rejects reordered steps
  ---
  duration_ms: 0.4615
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects changed source
ok 38 - strict adaptive contract rejects changed source
  ---
  duration_ms: 0.2781
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects step extra
ok 39 - strict adaptive contract rejects step extra
  ---
  duration_ms: 0.2657
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects precompiled step
ok 40 - strict adaptive contract rejects precompiled step
  ---
  duration_ms: 0.2571
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects illegal timeout
ok 41 - strict adaptive contract rejects illegal timeout
  ---
  duration_ms: 0.2458
  type: 'test'
  ...
# Subtest: strict adaptive contract rejects string timeout
ok 42 - strict adaptive contract rejects string timeout
  ---
  duration_ms: 0.3793
  type: 'test'
  ...
# Subtest: Case hash includes data and changes are never silently rebased
ok 43 - Case hash includes data and changes are never silently rebased
  ---
  duration_ms: 0.8358
  type: 'test'
  ...
# Subtest: action-only, assertion-only and copied fragment return; no inputs are mutated
ok 44 - action-only, assertion-only and copied fragment return; no inputs are mutated
  ---
  duration_ms: 3.0694
  type: 'test'
  ...
# Subtest: fragment rejects extra field
ok 45 - fragment rejects extra field
  ---
  duration_ms: 0.5627
  type: 'test'
  ...
# Subtest: fragment rejects missing reason
ok 46 - fragment rejects missing reason
  ---
  duration_ms: 0.3981
  type: 'test'
  ...
# Subtest: fragment rejects blank reason
ok 47 - fragment rejects blank reason
  ---
  duration_ms: 0.3271
  type: 'test'
  ...
# Subtest: fragment rejects nonboolean complete
ok 48 - fragment rejects nonboolean complete
  ---
  duration_ms: 0.731
  type: 'test'
  ...
# Subtest: fragment rejects two actions
ok 49 - fragment rejects two actions
  ---
  duration_ms: 0.467
  type: 'test'
  ...
# Subtest: fragment rejects 21 assertions
ok 50 - fragment rejects 21 assertions
  ---
  duration_ms: 0.8001
  type: 'test'
  ...
# Subtest: fragment rejects below time bound
ok 51 - fragment rejects below time bound
  ---
  duration_ms: 0.8213
  type: 'test'
  ...
# Subtest: fragment rejects above time bound
ok 52 - fragment rejects above time bound
  ---
  duration_ms: 0.7685
  type: 'test'
  ...
# Subtest: fragment rejects fractional time
ok 53 - fragment rejects fractional time
  ---
  duration_ms: 0.5011
  type: 'test'
  ...
# Subtest: fragment rejects arbitrary operation
ok 54 - fragment rejects arbitrary operation
  ---
  duration_ms: 0.4211
  type: 'test'
  ...
# Subtest: fragment rejects repair_anchor
ok 55 - fragment rejects repair_anchor
  ---
  duration_ms: 0.7615
  type: 'test'
  ...
# Subtest: fragment rejects future case_named
ok 56 - fragment rejects future case_named
  ---
  duration_ms: 0.5718
  type: 'test'
  ...
# Subtest: fragment rejects future runtime_intent
ok 57 - fragment rejects future runtime_intent
  ---
  duration_ms: 0.4518
  type: 'test'
  ...
# Subtest: empty completion requires earlier assertions and complete coverage, never just prior action
ok 58 - empty completion requires earlier assertions and complete coverage, never just prior action
  ---
  duration_ms: 5.5179
  type: 'test'
  ...
# Subtest: current original step is authoritative; previous fragments and IDs are revalidated
ok 59 - current original step is authoritative; previous fragments and IDs are revalidated
  ---
  duration_ms: 5.0345
  type: 'test'
  ...
# Subtest: only current action substrings and data scalar VALUES authorize input; expected and other steps do not
ok 60 - only current action substrings and data scalar VALUES authorize input; expected and other steps do not
  ---
  duration_ms: 10.1615
  type: 'test'
  ...
# Subtest: navigation needs same origin and whole explicit action path, not data or a path prefix
ok 61 - navigation needs same origin and whole explicit action path, not data or a path prefix
  ---
  duration_ms: 5.5895
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 保存 even if literal in source
ok 62 - read-only known-write guard rejects 保存 even if literal in source
  ---
  duration_ms: 0.6655
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 提交 even if literal in source
ok 63 - read-only known-write guard rejects 提交 even if literal in source
  ---
  duration_ms: 0.4256
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 删除 even if literal in source
ok 64 - read-only known-write guard rejects 删除 even if literal in source
  ---
  duration_ms: 0.6439
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 新建 even if literal in source
ok 65 - read-only known-write guard rejects 新建 even if literal in source
  ---
  duration_ms: 1.1949
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 创建 even if literal in source
ok 66 - read-only known-write guard rejects 创建 even if literal in source
  ---
  duration_ms: 0.4727
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 重置数据 even if literal in source
ok 67 - read-only known-write guard rejects 重置数据 even if literal in source
  ---
  duration_ms: 0.3918
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 清空数据 even if literal in source
ok 68 - read-only known-write guard rejects 清空数据 even if literal in source
  ---
  duration_ms: 0.2856
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 上传 even if literal in source
ok 69 - read-only known-write guard rejects 上传 even if literal in source
  ---
  duration_ms: 0.2892
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects 退出登录 even if literal in source
ok 70 - read-only known-write guard rejects 退出登录 even if literal in source
  ---
  duration_ms: 0.2789
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects Delete even if literal in source
ok 71 - read-only known-write guard rejects Delete even if literal in source
  ---
  duration_ms: 0.5607
  type: 'test'
  ...
# Subtest: read-only known-write guard rejects Save even if literal in source
ok 72 - read-only known-write guard rejects Save even if literal in source
  ---
  duration_ms: 0.3403
  type: 'test'
  ...
# Subtest: query reset is source-bound and sensitive controls are forbidden for both actions and assertions
ok 73 - query reset is source-bound and sensitive controls are forbidden for both actions and assertions
  ---
  duration_ms: 8.2287
  type: 'test'
  ...
# Subtest: read-only technical tools remain in fixed protocol and retain optional-dialog source conditions
ok 74 - read-only technical tools remain in fixed protocol and retain optional-dialog source conditions
  ---
  duration_ms: 5.9186
  type: 'test'
  ...
# Subtest: row/cell identity must come from Case scalars/actions/expected, never current DOM or metadata keys
ok 75 - row/cell identity must come from Case scalars/actions/expected, never current DOM or metadata keys
  ---
  duration_ms: 7.5899
  type: 'test'
  ...
# Subtest: business within scope is source-bound; dialog names are left to current-DOM independent audit
ok 76 - business within scope is source-bound; dialog names are left to current-DOM independent audit
  ---
  duration_ms: 2.5039
  type: 'test'
  ...
# Subtest: every assertion requires current-step quote and obligation IDs, including in prior fragments
ok 77 - every assertion requires current-step quote and obligation IDs, including in prior fragments
  ---
  duration_ms: 3.162
  type: 'test'
  ...
# Subtest: matrix assertions are grounded in original data and count as one assertion, not cell count
ok 78 - matrix assertions are grounded in original data and count as one assertion, not cell count
  ---
  duration_ms: 9.3651
  type: 'test'
  ...
# Subtest: cumulative 20-assertion and 8-segment budgets cannot be reset by a new reply
ok 79 - cumulative 20-assertion and 8-segment budgets cannot be reset by a new reply
  ---
  duration_ms: 4.2657
  type: 'test'
  ...
# Subtest: projection groups consecutive actions only into the NEXT assertion checkpoint, preserves order and source
ok 80 - projection groups consecutive actions only into the NEXT assertion checkpoint, preserves order and source
  ---
  duration_ms: 2.4266
  type: 'test'
  ...
# Subtest: pending tail actions remain available for partial audit but can never disappear at complete
ok 81 - pending tail actions remain available for partial audit but can never disappear at complete
  ---
  duration_ms: 2.1106
  type: 'test'
  ...
# Subtest: only-final-complete adds no checkpoint and v3 completion still enforces required click
ok 82 - only-final-complete adds no checkpoint and v3 completion still enforces required click
  ---
  duration_ms: 2.0306
  type: 'test'
  ...
# Subtest: partial audit injection retains missing obligations; other audit issues still reject and complete needs coverage
ok 83 - partial audit injection retains missing obligations; other audit issues still reject and complete needs coverage
  ---
  duration_ms: 2.0146
  type: 'test'
  ...
# Subtest: partial validator does not require future URL evidence; complete caller semantics still rejects false coverage
ok 84 - partial validator does not require future URL evidence; complete caller semantics still rejects false coverage
  ---
  duration_ms: 1.6992
  type: 'test'
  ...
# Subtest: prompts define current-only segments and an appended audit override, not a technical approval or replay
ok 85 - prompts define current-only segments and an appended audit override, not a technical approval or replay
  ---
  duration_ms: 0.3152
  type: 'test'
  ...
# Subtest: all complete JSON prompt examples parse and satisfy the existing action/assertion schema
ok 86 - all complete JSON prompt examples parse and satisfy the existing action/assertion schema
  ---
  duration_ms: 0.5052
  type: 'test'
  ...
# Subtest: directory binds refs to current observed facts, exposes only current original sources and preserves input
ok 87 - directory binds refs to current observed facts, exposes only current original sources and preserves input
  ---
  duration_ms: 5.206
  type: 'test'
  ...
# Subtest: V01 kind:button response is invalid, whereas a ref compiles the exact observed role locator
ok 88 - V01 kind:button response is invalid, whereas a ref compiles the exact observed role locator
  ---
  duration_ms: 6.0309
  type: 'test'
  ...
# Subtest: V02 action quote is never silently fixed in legacy mode; source refs generate expectation-only quote
ok 89 - V02 action quote is never silently fixed in legacy mode; source refs generate expectation-only quote
  ---
  duration_ms: 3.8452
  type: 'test'
  ...
# Subtest: action IDs depend on step and successful segment count, not rejected proposals or observed DOM
ok 90 - action IDs depend on step and successful segment count, not rejected proposals or observed DOM
  ---
  duration_ms: 1.1372
  type: 'test'
  ...
# Subtest: generated IDs remain legal and distinct for long common-prefix step IDs
ok 91 - generated IDs remain legal and distinct for long common-prefix step IDs
  ---
  duration_ms: 2.1262
  type: 'test'
  ...
# Subtest: unknown ref and stale refs after URL/text/control changes fail without guessing
ok 92 - unknown ref and stale refs after URL/text/control changes fail without guessing
  ---
  duration_ms: 1.7572
  type: 'test'
  ...
# Subtest: compiler ignores forged exposed directories and observation hash
ok 93 - compiler ignores forged exposed directories and observation hash
  ---
  duration_ms: 0.7029
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: action ref and fixed target
ok 94 - new/old conflict is rejected: action ref and fixed target
  ---
  duration_ms: 0.5842
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: action ref and model ID
ok 95 - new/old conflict is rejected: action ref and model ID
  ---
  duration_ms: 0.7136
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: assertion ref and fixed target
ok 96 - new/old conflict is rejected: assertion ref and fixed target
  ---
  duration_ms: 0.8328
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: source refs and oracle quote
ok 97 - new/old conflict is rejected: source refs and oracle quote
  ---
  duration_ms: 1.2748
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: source refs and old obligation IDs
ok 98 - new/old confli
... truncated ...
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `1`

```text
FAIL ai-engineering-context checks

1. docs\requirements\REQ-0017-controlled-react\02_design.md
   Problem: Code/test/config changed but `02_design.md` was not updated and has no explicit no-design-change reason.
   Fix: Update `02_design.md`, or add `本次无需设计变更，原因：...` when the change truly does not affect design.
2. docs\requirements\REQ-0017-controlled-react\05_trace.md
   Problem: `change_log.md` changed but `05_trace.md` was not updated.
   Fix: Update `05_trace.md` so the current `UN -> DR -> DD -> TK -> VT` chain reflects the change, or record why trace is unchanged.
```

### Notes

版本5仅本轮真实失败涉及的短段终结、审查引用、分页目标绑定及原协议/报告/授权回归。真实模型两轮已用完，版本4实际0/3整例通过保留；版本5未跑真实模型，不引用版本4全量1165为新版全量。

### 文档修复后的独立复检

上述测试运行实际为262项、0失败/取消/跳过、退出码0；原始日志保留于`validation/req0017/v5-targeted.log`。首次collector仅在附带文档检查时返回1，未篡改该失败记录。补充事实源中的版本5设计及追踪历史并重新render/sync后，单独执行`python scripts/check_ai_context.py`，实际退出码0。没有因为仅修正文档而伪称重跑262项；真实模型另行验证。
