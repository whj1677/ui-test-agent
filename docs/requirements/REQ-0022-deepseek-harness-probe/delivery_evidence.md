# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T09:39:10+08:00`
- Record: `REQ-0022-deepseek-harness-probe`
- Change fingerprint: `a0480aaeac3894c7364b547f109eaceb9b985e3515520fa613a86f70d14ec813`
- Verification source: `collector-executed-v1`
- Verification state: `人工待确认`
- Command: `npm test --prefix harness-probe`
- Exit code: `0`
- Test count: `12`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0022-deepseek-harness-probe/evidence/m2-probe-tests.log`
- Log SHA-256: `d2c5a972a25ff49f180524e0e8d18e16611a064cb508c0be787178c95f70580c`

### Git Status

```text
 M .gitignore
 M README.md
 M docs/requirements/README.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/00_user_requirement.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/01_development_requirement.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/02_design.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/03_tasks.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/04_verification.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/05_trace.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/change_log.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/current_state.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/delivery_evidence.md
?? docs/requirements/REQ-0022-deepseek-harness-probe/evidence/m2-probe-tests.log
?? docs/requirements/REQ-0022-deepseek-harness-probe/requirement.source.json
?? harness-probe/PROBE_REPORT.md
?? harness-probe/README.md
?? harness-probe/config/browser.cordis.yml
?? harness-probe/config/playwright.config.mjs
?? harness-probe/evidence/attempt-1-candidate.spec.mjs
?? harness-probe/evidence/attempt-2-candidate.spec.mjs
?? harness-probe/evidence/attempt-summary.json
?? harness-probe/fixture/index.html
?? harness-probe/package-lock.json
?? harness-probe/package.json
?? harness-probe/src/candidate-verifier.mjs
?? harness-probe/src/fixture-server.mjs
?? harness-probe/src/harness-runner.mjs
?? harness-probe/src/process-control.mjs
?? harness-probe/src/redact.mjs
?? harness-probe/src/run-probe.mjs
?? harness-probe/src/setup-harness.mjs
?? harness-probe/src/verify-candidate.mjs
?? harness-probe/tests/candidate-verifier.test.mjs
?? harness-probe/tests/fixtures/fake-process.mjs
?? harness-probe/tests/harness-result.test.mjs
?? harness-probe/tests/process-control.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
 .gitignore                  | 5 +++++
 README.md                   | 2 ++
 docs/requirements/README.md | 2 ++
 3 files changed, 9 insertions(+)
```

### Untracked Files

```text
docs/requirements/REQ-0022-deepseek-harness-probe/00_user_requirement.md
docs/requirements/REQ-0022-deepseek-harness-probe/01_development_requirement.md
docs/requirements/REQ-0022-deepseek-harness-probe/02_design.md
docs/requirements/REQ-0022-deepseek-harness-probe/03_tasks.md
docs/requirements/REQ-0022-deepseek-harness-probe/04_verification.md
docs/requirements/REQ-0022-deepseek-harness-probe/05_trace.md
docs/requirements/REQ-0022-deepseek-harness-probe/change_log.md
docs/requirements/REQ-0022-deepseek-harness-probe/current_state.md
docs/requirements/REQ-0022-deepseek-harness-probe/delivery_evidence.md
docs/requirements/REQ-0022-deepseek-harness-probe/evidence/m2-probe-tests.log
docs/requirements/REQ-0022-deepseek-harness-probe/requirement.source.json
harness-probe/PROBE_REPORT.md
harness-probe/README.md
harness-probe/config/browser.cordis.yml
harness-probe/config/playwright.config.mjs
harness-probe/evidence/attempt-1-candidate.spec.mjs
harness-probe/evidence/attempt-2-candidate.spec.mjs
harness-probe/evidence/attempt-summary.json
harness-probe/fixture/index.html
harness-probe/package-lock.json
harness-probe/package.json
harness-probe/src/candidate-verifier.mjs
harness-probe/src/fixture-server.mjs
harness-probe/src/harness-runner.mjs
harness-probe/src/process-control.mjs
harness-probe/src/redact.mjs
harness-probe/src/run-probe.mjs
harness-probe/src/setup-harness.mjs
harness-probe/src/verify-candidate.mjs
harness-probe/tests/candidate-verifier.test.mjs
harness-probe/tests/fixtures/fake-process.mjs
harness-probe/tests/harness-result.test.mjs
harness-probe/tests/process-control.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T09:39:07+08:00
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
  duration_ms: 1.2619
  type: 'test'
  ...
# Subtest: 缺失或损坏报告不能成功
ok 2 - 缺失或损坏报告不能成功
  ---
  duration_ms: 0.1366
  type: 'test'
  ...
# Subtest: 零测试、跳过和失败不能成功
ok 3 - 零测试、跳过和失败不能成功
  ---
  duration_ms: 0.1138
  type: 'test'
  ...
# Subtest: 完整终态、浏览器工具和文件同时存在才成功
ok 4 - 完整终态、浏览器工具和文件同时存在才成功
  ---
  duration_ms: 0.6381
  type: 'test'
  ...
# Subtest: 缺文件不能标记成功
ok 5 - 缺文件不能标记成功
  ---
  duration_ms: 0.1231
  type: 'test'
  ...
# Subtest: 缺浏览器工具事实不能标记成功
ok 6 - 缺浏览器工具事实不能标记成功
  ---
  duration_ms: 0.1579
  type: 'test'
  ...
# Subtest: 模型中断或不完整报告不能标记成功
ok 7 - 模型中断或不完整报告不能标记成功
  ---
  duration_ms: 0.1164
  type: 'test'
  ...
# Subtest: 取消和超时不能标记成功
ok 8 - 取消和超时不能标记成功
  ---
  duration_ms: 0.1071
  type: 'test'
  ...
# Subtest: 日志会遮蔽密钥、Bearer和敏感字段
ok 9 - 日志会遮蔽密钥、Bearer和敏感字段
  ---
  duration_ms: 0.5511
  type: 'test'
  ...
# Subtest: 启动失败会返回错误且不等待到期
ok 10 - 启动失败会返回错误且不等待到期
  ---
  duration_ms: 6.024
  type: 'test'
  ...
# Subtest: 超时会终止本任务拥有的进程
ok 11 - 超时会终止本任务拥有的进程
  ---
  duration_ms: 929.6438
  type: 'test'
  ...
# Subtest: 用户取消会终止本任务拥有的进程且不重启
ok 12 - 用户取消会终止本任务拥有的进程且不重启
  ---
  duration_ms: 686.4436
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
# duration_ms 1758.3095
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

工程控制测试实际12项、退出码0；真实Harness闭环结论B，复验候选1项失败，整体保持人工待确认。
