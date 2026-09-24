<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0035 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0035-01 | DR-0035-01 | 已确认 | 集成测试通过 | 服务端会话保护、角色隔离/过期/清除/重启，独立候选上下文复用及工作台浏览器操作；真实Harness在登录后专用浏览器观察合成保护页并生成不含登录步骤的候选。 | 真实命令、退出码、测试统计和产物路径 | 命令：node --test workbench/tests/auth-session.test.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0035-auth01-target-session/auth-session-integration.log | node --test workbench/tests/auth-session.test.mjs | 0 | 1 | 0 | 0 | docs/requirements/REQ-0035-auth01-target-session/auth-session-integration.log |
| VT-0035-02 | DR-0035-01 | 已确认 | 集成测试通过 | 已提交源码的干净导出工程回归；AUTH及QA分别归属，不能替代产品或人工验收。 | 确定源码SHA、导出完整性、锁文件安装、当前命令退出码及测试数；零模型。 | 命令：node --test workbench/tests/auth-session.test.mjs workbench/tests/start-config.test.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：docs/evidence/baseline-20260924/collector-auth-final.log；干净源码AUTH浏览器9检查见run-04/browser-auth.log | node --test workbench/tests/auth-session.test.mjs workbench/tests/start-config.test.mjs | 0 | 2 | 0 | 0 | docs/evidence/baseline-20260924/collector-auth-final.log；干净源码AUTH浏览器9检查见run-04/browser-auth.log |

## 本轮命令与环境

- 工作目录：workbench/ 与 harness-probe/
- 命令：node --test tests/auth-session.test.mjs
- 命令：node tests/auth-session-browser.integration.mjs
- 命令：npm test (workbench)
- 命令：npm test (harness-probe)
- 命令：AUTH01_ALLOW_REAL_HARNESS=1 node tests/auth-harness-real.integration.mjs (separately authorized)
- 环境：本机锁定Node及Playwright依赖；独立合成站只监听127.0.0.1，数据与凭据不落盘。

## 结论

- 合成站工程、工作台浏览器及真实 Harness/独立执行上下文验证已运行；现有项目建例任务绑定和执行中失效处理仍未完成。
- 2026-09-24提交基线35adcff1ade90a64eaae2a466530bd137e0910d8完成独立安装与零模型工程复验；旧核心108失败不在通过范围。详见workbench/docs/BASELINE_CLOSE_20260924.md。
