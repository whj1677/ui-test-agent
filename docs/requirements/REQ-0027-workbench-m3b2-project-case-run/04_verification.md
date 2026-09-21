<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0027 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0027-01 | DR-0027-01 / DR-0027-02 | 已确认 | 集成测试通过 | 零模型生产调用路径取得精确cwd、prompt、两个冻结输入、渲染指令、30/600限制及一次授权；两输入不回退固定模板。 | 实际BuildTaskManager、临时持久化和捕获适配器 | project-case-build-run.test.mjs 2/2通过；真实任务根与attempt的snapshot/task.md哈希分别一致，实际渲染指令已登记。 | - | - | - | - | - | - |
| VT-0027-02 | DR-0027-03 | 已确认 | 集成测试通过 | 真实Playwright CLI临时工程正常通过、反例指定差异、候选哈希一致和步骤映射完整。 | 实际CLI、结构化报告与媒体文件 | 零模型Web流与真实Harness候选均为正常1 PASSED、反例1 FAILED且PROBE-42/PROBE-41；候选哈希一致，CASE_STEP_1/2均观察到。 | - | - | - | - | - | - |
| VT-0027-03 | DR-0027-04 / DR-0027-05 | 已确认 | 集成测试通过 | 真实Chromium项目导入、创建、启动、结果和媒体读回；截图加载、视频播放/暂停/定位、Trace哈希及重启读回。 | 真实Web、后台task、原始报告和受控媒体接口一致 | 真实任务build-20260921120911-48d7c545；同任务零模型读回验证两图、两录像、两Trace与重启，Harness仍1次。 | - | - | - | - | - | - |
| VT-0027-04 | DR-0027-01 / DR-0027-02 / DR-0027-03 / DR-0027-04 / DR-0027-05 | 已确认 | 集成测试通过 | 受影响workbench/harness-probe回归、正式门禁、批准资产及历史边界不变。 | 命令、退出码、统计、哈希和差异检查 | 仓库根执行npm --prefix workbench test，退出码0，测试60、失败0、跳过0，日志docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/workbench-tests.log；harness-probe 24/24、M3-B1和M3-B2 Chromium流通过；批准脚本SHA-256保持280A7875...79A。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：workbench、harness-probe与仓库根需求工具
- 命令：npm --prefix workbench test
- 命令：npm --prefix harness-probe test
- 命令：npm --prefix workbench run test:m3b2-browser
- 命令：npm --prefix workbench run test:m3b2-real
- 命令：npm --prefix workbench run test:m3b2-real-readback
- 环境：Windows；Node 22；127.0.0.1单用户；专用.gitignore数据目录；锁定dsh 0.1.6-alpha.2、deepseek-v4-pro与Playwright 1.62.1。

## 结论

- 唯一真实Harness启动已消费1/1，候选技术验证通过并停在等待人工核对；Web选择器外层缺陷用同一任务零模型读回修复，无第二次模型启动。
