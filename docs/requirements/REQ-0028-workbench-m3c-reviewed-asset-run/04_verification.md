<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0028 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0028-01 | DR-0028-01 | 已确认 | 单元测试通过 | 正确登记、重复幂等及无首审/哈希/关联错配拒绝；私有复制哈希一致。 | 临时数据根、实际文件、catalog和原子存储 | 命令：npm --prefix workbench test；退出码：0；测试数量：65；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log | npm --prefix workbench test | 0 | 65 | 0 | 0 | docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log |
| VT-0028-02 | DR-0028-02 / DR-0028-04 | 已确认 | 集成测试通过 | 临时真实Playwright CLI覆盖正常、断言不符、零测试、缺证据、进程异常和受控反例不可从Web启动。 | 实际子进程、结构化报告和媒体 | 命令：npm --prefix workbench test；退出码：0；测试数量：65；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log | npm --prefix workbench test | 0 | 65 | 0 | 0 | docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log |
| VT-0028-03 | DR-0028-03 | 已确认 | 集成测试通过 | 真实Chromium项目用例资产展示、v1/v2关系、正常启动及结果媒体查看。 | 真实Web、API、catalog、run和媒体一致 | 命令：npm --prefix workbench run test:m3c-real；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md | npm --prefix workbench run test:m3c-real | 0 | 2 | 0 | 0 | workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md |
| VT-0028-04 | DR-0028-05 | 已确认 | 集成测试通过 | 原字节资产正常/反例各一次、哈希与三类媒体、重启读回、Harness和模型0次及Git同步。 | 真实run ID、报告、媒体哈希、命令退出码和远端SHA | 命令：npm --prefix workbench run test:m3c-real；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md | npm --prefix workbench run test:m3c-real | 0 | 2 | 0 | 0 | workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md |

## 本轮命令与环境

- 工作目录：workbench及REQ-0028正式门禁
- 命令：npm --prefix workbench test（65/65，exit 0）
- 命令：npm --prefix harness-probe test（24/24，exit 0）
- 命令：npm --prefix workbench run test:m3c-real（exit 0）
- 环境：Windows；Node 22；127.0.0.1；既有M3-B2私有数据根；Playwright Test 1.62.1；Microsoft Edge。

## 结论

- 限定首审资产已从真实项目Web完成正常回归；同一资产受控反例保留FAILED与精确值差异；媒体和重启读回完成；Harness/模型0次。
