# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T09:40:41+08:00`
- Record: `REQ-0022-deepseek-harness-probe`
- Change fingerprint: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Verification source: `collector-executed-v1`
- Verification state: `人工待确认`
- Command: `npm test --prefix harness-probe`
- Exit code: `0`
- Test count: `12`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0022-deepseek-harness-probe/evidence/m2-probe-tests.log`
- Log SHA-256: `bdb050acbc4c8e9dcbf3ae2d9ab188e7b80b16e390f969cec45e6642b0da4ae0`

### Git Status

```text
 M docs/requirements/REQ-0022-deepseek-harness-probe/03_tasks.md
 M docs/requirements/REQ-0022-deepseek-harness-probe/04_verification.md
 M docs/requirements/REQ-0022-deepseek-harness-probe/05_trace.md
 M docs/requirements/REQ-0022-deepseek-harness-probe/change_log.md
 M docs/requirements/REQ-0022-deepseek-harness-probe/current_state.md
 M docs/requirements/REQ-0022-deepseek-harness-probe/delivery_evidence.md
 M docs/requirements/REQ-0022-deepseek-harness-probe/evidence/m2-probe-tests.log
 M docs/requirements/REQ-0022-deepseek-harness-probe/requirement.source.json
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/evidence/m2-probe-tests.log', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0022-deepseek-harness-probe/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
 .../REQ-0022-deepseek-harness-probe/03_tasks.md    |   2 +-
 .../04_verification.md                             |   2 +-
 .../REQ-0022-deepseek-harness-probe/05_trace.md    |   3 +-
 .../REQ-0022-deepseek-harness-probe/change_log.md  |   1 +
 .../current_state.md                               |   8 +-
 .../delivery_evidence.md                           | 137 +++++++--------------
 .../evidence/m2-probe-tests.log                    |  28 ++---
 .../requirement.source.json                        |  12 +-
 8 files changed, 71 insertions(+), 122 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T09:40:37+08:00
Command: npm test --prefix harness-probe
Exit code: 0
Parsed test count: 12
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-agent-deepseek-harness-probe@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: 真实通过且至少一个测试才完整
ok 1 - 真实通过且至少一个测试才完整
  ---
  duration_ms: 1.2326
  type: 'test'
  ...
# Subtest: 缺失或损坏报告不能成功
ok 2 - 缺失或损坏报告不能成功
  ---
  duration_ms: 0.1283
  type: 'test'
  ...
# Subtest: 零测试、跳过和失败不能成功
ok 3 - 零测试、跳过和失败不能成功
  ---
  duration_ms: 0.111
  type: 'test'
  ...
# Subtest: 完整终态、浏览器工具和文件同时存在才成功
ok 4 - 完整终态、浏览器工具和文件同时存在才成功
  ---
  duration_ms: 0.9739
  type: 'test'
  ...
# Subtest: 缺文件不能标记成功
ok 5 - 缺文件不能标记成功
  ---
  duration_ms: 0.2272
  type: 'test'
  ...
# Subtest: 缺浏览器工具事实不能标记成功
ok 6 - 缺浏览器工具事实不能标记成功
  ---
  duration_ms: 0.1976
  type: 'test'
  ...
# Subtest: 模型中断或不完整报告不能标记成功
ok 7 - 模型中断或不完整报告不能标记成功
  ---
  duration_ms: 0.1641
  type: 'test'
  ...
# Subtest: 取消和超时不能标记成功
ok 8 - 取消和超时不能标记成功
  ---
  duration_ms: 0.1202
  type: 'test'
  ...
# Subtest: 日志会遮蔽密钥、Bearer和敏感字段
ok 9 - 日志会遮蔽密钥、Bearer和敏感字段
  ---
  duration_ms: 0.7044
  type: 'test'
  ...
# Subtest: 启动失败会返回错误且不等待到期
ok 10 - 启动失败会返回错误且不等待到期
  ---
  duration_ms: 6.6592
  type: 'test'
  ...
# Subtest: 超时会终止本任务拥有的进程
ok 11 - 超时会终止本任务拥有的进程
  ---
  duration_ms: 861.8583
  type: 'test'
  ...
# Subtest: 用户取消会终止本任务拥有的进程且不重启
ok 12 - 用户取消会终止本任务拥有的进程且不重启
  ---
  duration_ms: 661.5306
  type: 'test'
  ...
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1670.2948
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0022-deepseek-harness-probe; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

工程控制测试实际12项、退出码0；真实Harness闭环结论B，复验候选1项失败；首批提交a77e57d已推送且远端一致。
