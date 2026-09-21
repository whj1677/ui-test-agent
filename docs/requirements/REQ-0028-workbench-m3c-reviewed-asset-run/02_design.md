<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0028 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0028-01 | DR-0028-01 | 已确认 | 在现有WorkBenchStore catalog中登记HUMAN_FIRST_REVIEW_PASSED_SCOPED资产，并把候选及首审记录按原字节复制到data/assets。 | 复用资产模型同时避免临时attempt成为唯一副本。 |
| DD-0028-02 | DR-0028-02 | 已确认 | 运行器读取资产的storage、file_name、entry_env_var和configuration生成每run独立配置。 | 移除排序脚本文件名、PILOT_ENTRY_URL及固定配置的隐式依赖。 |
| DD-0028-03 | DR-0028-03 | 已确认 | 前端按project_case精确关联资产与运行，在用例详情渲染限定范围和正常运行按钮。 | 不建立第二套任务或运行历史。 |
| DD-0028-04 | DR-0028-04 | 已确认 | asset.allowed_environments仅含正常fixture；counterexample放在acceptance_environments并只由本地验收程序调用。 | 产品入口不会把故障页面变成日常回归必经路径。 |
| DD-0028-05 | DR-0028-05 | 已确认 | 真实验收复用既有私有数据根，Web正常运行与程序受控反例各生成独立run目录，随后重启读回。 | 保留原项目关联并不迁移、删除或重写历史任务。 |

## 接口与数据流

- 首审记录+task.json+候选原件+项目版本 -> 受控登记命令 -> catalog与data/assets耐久副本。
- 项目用例详情 -> 已首审资产 -> POST /api/runs正常环境 -> Playwright子进程 -> run/report/media -> 现有结果详情。
- 受控验收程序 -> acceptance环境 -> 同一资产执行 -> 独立反例run；Web无该启动选项。

## 模块文档影响

- 更新test-workbench与workbench-case-library模块，说明限定首审资产、通用运行参数和项目直接回归。

## 风险与回滚

- 首审记录为本机追加式文件且非签名；登记以哈希和多源身份一致性校验，不宣传防管理员篡改。
- 删除新增登记器、通用资产字段和项目页面区域可回滚；已生成的私有资产/run目录保留供审计，不自动删除。
