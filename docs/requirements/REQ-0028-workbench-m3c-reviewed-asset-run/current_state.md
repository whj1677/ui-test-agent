<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0028 当前状态

- 需求标题：M3-C 已人工首审候选限定资产登记与项目直接回归

## 元数据

- 需求状态：已完成
- 治理分级：G3
- 当前版本：2
- 最后更新：2026-09-21

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0028-01 | 已确认 | 项目用例能够关联已人工首审的限定资产并直接由Playwright产生独立可追溯的新运行。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0028-01 | 已确认 | 从首审记录、源任务和候选原件共同校验身份，建立限定范围资产和私有耐久副本。 |
| DR-0028-02 | 已确认 | 现有运行器按资产决定脚本位置、文件名、入口变量、步骤和锁定配置。 |
| DR-0028-03 | 已确认 | 项目用例页面显示绑定版本、范围、首审依据及直接正常运行入口。 |
| DR-0028-04 | 已确认 | 正常产品运行与受控错误输出验收分离。 |
| DR-0028-05 | 已确认 | 零模型工程验证和一次正常/一次反例真实验收后持久化收口。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0028-01 | DR-0028-01 | 已确认 | 在现有WorkBenchStore catalog中登记HUMAN_FIRST_REVIEW_PASSED_SCOPED资产，并把候选及首审记录按原字节复制到data/assets。 |
| DD-0028-02 | DR-0028-02 | 已确认 | 运行器读取资产的storage、file_name、entry_env_var和configuration生成每run独立配置。 |
| DD-0028-03 | DR-0028-03 | 已确认 | 前端按project_case精确关联资产与运行，在用例详情渲染限定范围和正常运行按钮。 |
| DD-0028-04 | DR-0028-04 | 已确认 | asset.allowed_environments仅含正常fixture；counterexample放在acceptance_environments并只由本地验收程序调用。 |
| DD-0028-05 | DR-0028-05 | 已确认 | 真实验收复用既有私有数据根，Web正常运行与程序受控反例各生成独立run目录，随后重启读回。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0028-01 | DR-0028-01 / DD-0028-01 | 已完成 | 实现首审资产登记、耐久复制与拒绝/幂等测试。 |
| TK-0028-02 | DR-0028-02 / DR-0028-04 / DD-0028-02 / DD-0028-04 | 已完成 | 通用化现有Playwright运行器并增加受控反例验收入口。 |
| TK-0028-03 | DR-0028-03 / DD-0028-03 | 已完成 | 在项目用例页展示资产、版本关系、范围和直接运行入口。 |
| TK-0028-04 | DR-0028-05 / DD-0028-05 | 已完成 | 完成工程测试、真实Web正常和受控反例运行、媒体及重启验收。 |
| TK-0028-05 | DR-0028-01 / DR-0028-02 / DR-0028-03 / DR-0028-04 / DR-0028-05 / DD-0028-01 / DD-0028-02 / DD-0028-03 / DD-0028-04 / DD-0028-05 | 已完成 | 脱敏报告、正式门禁、提交与GitHub同步。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0028-01 | DR-0028-01 | 单元测试通过 | 正确登记、重复幂等及无首审/哈希/关联错配拒绝；私有复制哈希一致。 | 命令：npm --prefix workbench test；退出码：0；测试数量：65；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log |
| VT-0028-02 | DR-0028-02 / DR-0028-04 | 集成测试通过 | 临时真实Playwright CLI覆盖正常、断言不符、零测试、缺证据、进程异常和受控反例不可从Web启动。 | 命令：npm --prefix workbench test；退出码：0；测试数量：65；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log |
| VT-0028-03 | DR-0028-03 | 集成测试通过 | 真实Chromium项目用例资产展示、v1/v2关系、正常启动及结果媒体查看。 | 命令：npm --prefix workbench run test:m3c-real；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md |
| VT-0028-04 | DR-0028-05 | 集成测试通过 | 原字节资产正常/反例各一次、哈希与三类媒体、重启读回、Harness和模型0次及Git同步。 | 命令：npm --prefix workbench run test:m3c-real；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md |

## 人工待确认项

- [ ] 无。

## 本轮禁止实现内容

- 不得启动Harness、调用建例模型、生成或修改候选。
- 不得建设通用审批、批量套件、复杂业务、自愈或新Agent。
- 不得把反例环境开放为项目日常运行选项或把FAILED改写为业务通过。
- 不得提交.local、首审私有原件、原始媒体、凭据或模型会话。
