<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0022 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0022-01 | DR-0022-01 | 已确认 | 人工待确认 | 固定版本安装、版本输出、配置解析和隔离边界检查。 | 真实命令、退出码、版本、配置摘要和路径 | 命令：npm run setup:harness；dsh --version；dsh --profile headless --patch config/browser.cordis.yml --help；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：harness-probe/PROBE_REPORT.md | npm run setup:harness；dsh --version；dsh --profile headless --patch config/browser.cordis.yml --help | 0 | 3 | 0 | 0 | harness-probe/PROBE_REPORT.md |
| VT-0022-02 | DR-0022-01 / DR-0022-03 | 已确认 | 人工待确认 | 启动失败、取消、超时、模型中断、缺文件、不完整报告、无自动重启和日志脱敏工程测试。 | 真实测试命令、退出码、用例数和脱敏日志 | 命令：cd harness-probe && npm test；退出码：0；测试数量：12；失败数量：0；跳过数量：0；证据：harness-probe/PROBE_REPORT.md | cd harness-probe && npm test | 0 | 12 | 0 | 0 | harness-probe/PROBE_REPORT.md |
| VT-0022-03 | DR-0022-02 | 已确认 | 人工待确认 | 真实Harness浏览器交互、候选产出及候选Playwright执行。 | Harness事件/终态、文件哈希、Playwright结构化报告和退出码 | 命令：cd harness-probe && npm run probe（初验一次、集中修复后复验一次）；退出码：1；测试数量：1；失败数量：1；跳过数量：0；证据：harness-probe/evidence/attempt-summary.json（初验为0测试，复验为1测试1失败） | cd harness-probe && npm run probe（初验一次、集中修复后复验一次） | 1 | 1 | 1 | 0 | harness-probe/evidence/attempt-summary.json（初验为0测试，复验为1测试1失败） |
| VT-0022-04 | DR-0022-01 / DR-0022-02 / DR-0022-03 | 已确认 | 未运行 | 敏感信息/本地产物检查，Git提交、推送和远端SHA核对。 | 提交清单、扫描命令、local HEAD与remote SHA | 待提交与远端核对 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent-workbench-m2-probe/harness-probe
- 命令：npm test
- 命令：npm run probe
- 命令：npm run verify:candidate
- 环境：Windows PowerShell，Node.js v22.19.0，npm 10.9.3。
- 环境：DeepSeek Harness @deepseek-ai/dsh 0.1.6-alpha.2及同版Browser Use插件，独立DSH_HOME。

## 结论

- 结论B：程序化Harness、浏览器工具和文件产出已真实验证；集中修复后候选独立执行1项失败，未满足进入最小工作台集成的完整门槛。
