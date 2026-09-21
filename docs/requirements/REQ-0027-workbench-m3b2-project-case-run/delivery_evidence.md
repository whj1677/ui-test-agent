# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T20:22:07+08:00`
- Record: `REQ-0027-workbench-m3b2-project-case-run`
- Change fingerprint: `c392bb14d2652e786cc7ba45797a4437249ba930debe67e6099fdeb0a9c7d6bc`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `60`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/workbench-tests.log`
- Log SHA-256: `ba1675f501a00cb4160ddd95e3ef6da4ffe9aefcc629041a8a833095f6d3682a`

### Git Status

```text
M  .gitattributes
 M docs/modules/test-workbench.md
 M docs/modules/workbench-case-library.md
 M docs/requirements/README.md
 M workbench/README.md
 M workbench/package.json
 M workbench/server/app.mjs
 M workbench/server/build/files.mjs
 M workbench/server/build/manager.mjs
 M workbench/server/build/project-case.mjs
 M workbench/server/build/report.mjs
 M workbench/server/build/store.mjs
 M workbench/server/index.mjs
 M workbench/tests/build-api.test.mjs
 M workbench/web/app.js
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/00_user_requirement.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/01_development_requirement.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/02_design.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/03_tasks.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/04_verification.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/05_trace.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/change_log.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/current_state.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/delivery_evidence.md
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/workbench-tests.log
?? docs/requirements/REQ-0027-workbench-m3b2-project-case-run/requirement.source.json
?? workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md
?? workbench/docs/evidence/M3B2_PROJECT_CASE_REAL_WEB.png
?? workbench/docs/evidence/M3B2_PROJECT_CASE_RUN_WEB.png
?? workbench/scripts/run-m3b2-real.ps1
?? workbench/tests/project-case-build-real-readback.integration.mjs
?? workbench/tests/project-case-build-real.integration.mjs
?? workbench/tests/project-case-build-run-browser.integration.mjs
?? workbench/tests/project-case-build-run.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/test-workbench.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/modules/workbench-case-library.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/app.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/files.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/project-case.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/report.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/index.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/build-api.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web/app.js', LF will be replaced by CRLF the next time Git touches it
 .gitattributes                          |  2 +
 docs/modules/test-workbench.md          |  2 +
 docs/modules/workbench-case-library.md  | 11 +++-
 docs/requirements/README.md             |  2 +
 workbench/README.md                     | 12 +++--
 workbench/package.json                  |  3 ++
 workbench/server/app.mjs                | 18 +++++++
 workbench/server/build/files.mjs        |  6 ++-
 workbench/server/build/manager.mjs      | 90 +++++++++++++++++++++++++++++----
 workbench/server/build/project-case.mjs | 19 ++++++-
 workbench/server/build/report.mjs       | 11 ++++
 workbench/server/build/store.mjs        | 46 ++++++++++++++---
 workbench/server/index.mjs              |  5 +-
 workbench/tests/build-api.test.mjs      | 44 ++++++++++++++++
 workbench/web/app.js                    | 62 +++++++++++++++++++----
 15 files changed, 301 insertions(+), 32 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/00_user_requirement.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/01_development_requirement.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/02_design.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/03_tasks.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/04_verification.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/05_trace.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/change_log.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/current_state.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/delivery_evidence.md
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/workbench-tests.log
docs/requirements/REQ-0027-workbench-m3b2-project-case-run/requirement.source.json
workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md
workbench/docs/evidence/M3B2_PROJECT_CASE_REAL_WEB.png
workbench/docs/evidence/M3B2_PROJECT_CASE_RUN_WEB.png
workbench/scripts/run-m3b2-real.ps1
workbench/tests/project-case-build-real-readback.integration.mjs
workbench/tests/project-case-build-real.integration.mjs
workbench/tests/project-case-build-run-browser.integration.mjs
workbench/tests/project-case-build-run.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T20:21:49+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 60
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 99.2113
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 12.5036
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 188.6982
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 26.1619
  type: 'test'
  ...
# Subtest: only registered verification media are served with integrity and range checks
ok 5 - only registered verification media are served with integrity and range checks
  ---
  duration_ms: 76.6229
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 6 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 254.9118
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-21T12:21:51.457Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 7 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 58.017
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-21T12:21:51.551Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 8 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 85.9157
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 9 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 73.4786
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 10 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 133.3272
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 11 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 44.6006
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 12 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 31.1858
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 13 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 9.2198
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 14 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 244.5911
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 15 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 250.1263
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 16 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 346.0124
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 17 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 57.5958
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 18 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 107.4821
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 19 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 139.8932
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 20 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 682.13
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 21 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 905.1678
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 22 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 164.1942
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 23 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 427.6599
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 24 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 134.402
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 25 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 107.8098
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 26 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 34.6739
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 27 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 127.9243
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 28 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 137.9192
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 29 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 288.3019
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 30 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 107.9778
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 31 - only indexed media for the selected run can be read
  ---
  duration_ms: 222.7865
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 32 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 13.5556
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 33 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 283.0371
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 34 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 225.0113
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 35 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 123.5609
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 36 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 140.2166
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 37 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 138.259
  type: 'test'
  ...
# Subtest: M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
ok 38 - M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
  ---
  duration_ms: 643.9483
  type: 'test'
  ...
# Subtest: M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
ok 39 - M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
  ---
  duration_ms: 159.1654
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 40 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 22.7458
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 41 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 13.0976
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 42 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 52.4566
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 43 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 15.6426
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 44 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 78.5147
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 45 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 48.2462
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 46 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 70.6584
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 47 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 34.6064
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 48 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 27.3635
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 49 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 7.5674
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 50 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 167.3152
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 51 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 2.1896
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 52 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 1109.2828
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 53 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 835.8112
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 54 - health endpoint reports the independent workbench
  ---
  duration_ms: 62.9394
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 55 - unknown routes fail closed
  ---
  duration_ms: 11.152
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 56 - asset registration is persistent and idempotent
  ---
  duration_ms: 55.2012
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 57 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 33.8021
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 58 - run ids cannot escape the data root
  ---
  duration_ms: 10.3836
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 59 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 12177.9177
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 60 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 3185.9394
  type: 'test'
  ...
1..60
# tests 60
# suites 0
# pass 60
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16300.6879
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

M3-B2一次真实Harness任务另见workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md；授权1/1，最终WAITING_HUMAN_REVIEW。
