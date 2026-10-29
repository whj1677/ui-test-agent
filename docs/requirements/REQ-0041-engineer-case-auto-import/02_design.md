<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0041 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0041-01 | DR-0041-01 | 已确认 | 识别UTF8/GB18030 CSV和常见列名，支持显式映射纠正，保留xlsx/json原生包兼容。 | 导入只形成草稿，未填写确认状态不得自动确认。 |
| DD-0041-02 | DR-0041-02 | 已确认 | 保留原表字段与历史实际结果供人工追溯，避免进入模型预期和当前执行结论。 | 不按分号自动拆业务步骤，不改原文和日期。 |
| DD-0041-03 | DR-0041-03 | 已确认 | 提供可下载填写模板和简化自动识别界面。 | 模板只含通用虚构示例，不补业务规则。 |
| DD-0041-04 | DR-0041-04 | 已确认 | 原正式4322完成导入验收并保全用户项目。 | 不另起工作台，不执行模型、脚本或生产请求。 |

## 接口与数据流

- upload csv返回source_type=csv和workbook.sheets（suggested_mapping/mapping_issues）；preview沿用sheet_name/mapping，缺省才使用自动建议。
- root_source.source_fields保存原表文本；business content沿用既有结构和hash；模型快照排除source_fields。
- 模板固定白名单下载 /workspace/test-case-template.xlsx。

## 模块文档影响

- docs/modules/workbench-case-library.md：新增CSV、表头识别与原表历史隔离。

## 风险与回滚

- 兼容风险以旧XLSX物理换行、原生包测试和正式导入验证；回退仅新CSV入口/模板展示，不删除已存用例与源文件。
