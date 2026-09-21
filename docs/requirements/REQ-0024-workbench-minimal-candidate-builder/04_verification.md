<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0024 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0024-01 | DR-0024-01 / DR-0024-02 | 已确认 | 未运行 | 存储、跨任务阶段预算、重复启动、取消和重启恢复。 | workbench工程测试与持久化读回 | 无 | - | - | - | - | - | - |
| VT-0024-02 | DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 未运行 | Harness终态、候选/工具/报告登记、通用报告解析和显式修订。 | 模拟工程测试与真实事件分开记录 | 无 | - | - | - | - | - | - |
| VT-0024-03 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 未运行 | 真实浏览器中的固定任务提交、状态、候选、错误、文件和按钮行为。 | Chromium工程流、截图和后端记录 | 无 | - | - | - | - | - | - |
| VT-0024-04 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 已确认 | 未运行 | 真实Web-Harness-候选-正常/反例集成、资产不变和远端SHA。 | 真实任务ID、尝试、工具计数、候选哈希、两份报告、Git查询 | 无 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：workbench与harness-probe子工程
- 命令：npm test --prefix harness-probe
- 命令：npm test --prefix workbench
- 命令：npm run test:build-browser --prefix workbench
- 命令：npm run test:build-real --prefix workbench
- 环境：127.0.0.1单用户；独立Git忽略任务目录；Edge；无OS级强制隔离；公司批准DeepSeek连接仅传Harness进程。

## 结论

- 实现与验证中。
