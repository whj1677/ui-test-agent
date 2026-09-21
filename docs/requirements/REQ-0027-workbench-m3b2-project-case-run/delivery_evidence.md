# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T21:13:48+08:00`
- Record: `REQ-0027-workbench-m3b2-project-case-run`
- Change fingerprint: `f179aee6a64e94a7ef6b22c2fa9902b96e961567d03ed1de798b586ca51e9b47`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test workbench/tests/project-case-build-input.test.mjs workbench/tests/project-case-build-run.test.mjs workbench/tests/build-api.test.mjs workbench/tests/build-store.test.mjs`
- Exit code: `0`
- Test count: `16`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/input-boundary-targeted.log`
- Log SHA-256: `81208e82d3bc64ac18232c5d9997843ce0d94b436079c065fc182ab763326b29`

### Git Status

```text
 M docs/modules/test-workbench.md
 M docs/modules/workbench-case-library.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/00_user_requirement.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/01_development_requirement.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/02_design.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/03_tasks.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/04_verification.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/05_trace.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/change_log.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/current_state.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/delivery_evidence.md
 M docs/requirements/REQ-0027-workbench-m3b2-project-case-run/requirement.source.json
 M workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md
 M workbench/server/build/project-case.mjs
 M workbench/tests/project-case-build-run.test.mjs
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/input-boundary-targeted.log
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/input-boundary-workbench-tests.log
?? workbench/docs/M3B2_INPUT_BOUNDARY_AND_CANDIDATE_REVIEW.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/test-workbench.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/modules/workbench-case-library.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0027-workbench-m3b2-project-case-run/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/project-case.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/project-case-build-run.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md                     |   2 +
 docs/modules/workbench-case-library.md             |   5 +-
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   2 +
 .../01_development_requirement.md                  |   1 +
 .../02_design.md                                   |   2 +
 .../03_tasks.md                                    |   1 +
 .../04_verification.md                             |   1 +
 .../05_trace.md                                    |   2 +
 .../change_log.md                                  |   1 +
 .../current_state.md                               |   7 +-
 .../delivery_evidence.md                           | 490 ++++-----------------
 .../requirement.source.json                        |  31 +-
 workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md    |   6 +
 workbench/server/build/project-case.mjs            |  21 +-
 workbench/tests/project-case-build-run.test.mjs    |  57 +++
 16 files changed, 219 insertions(+), 412 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/input-boundary-targeted.log
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/input-boundary-workbench-tests.log
workbench/docs/M3B2_INPUT_BOUNDARY_AND_CANDIDATE_REVIEW.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T21:13:45+08:00
Command: node --test workbench/tests/project-case-build-input.test.mjs workbench/tests/project-case-build-run.test.mjs workbench/tests/build-api.test.mjs workbench/tests/build-store.test.mjs
Exit code: 0
Parsed test count: 16
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: build mutations require local origin and exact fixed schemas
ok 1 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 99.9427
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 2 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 20.8098
  type: 'test'
  ...
# Subtest: only registered verification media are served with integrity and range checks
ok 3 - only registered verification media are served with integrity and range checks
  ---
  duration_ms: 23.0676
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 4 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 30.793
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 5 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 33.1613
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 6 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 88.9887
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 7 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 623.8928
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 8 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 744.228
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 9 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 178.0257
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 10 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 130.6785
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 11 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 93.7815
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 12 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 91.1786
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 13 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 83.5759
  type: 'test'
  ...
# Subtest: M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
ok 14 - M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
  ---
  duration_ms: 410.3268
  type: 'test'
  ...
# Subtest: 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
ok 15 - 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
  ---
  duration_ms: 1.0234
  type: 'test'
  ...
# Subtest: M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
ok 16 - M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
  ---
  duration_ms: 105.0803
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1700.0153
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0027-workbench-m3b2-project-case-run; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

零模型；无Harness启动；完整workbench回归另见input-boundary-workbench-tests.log（61/61）
