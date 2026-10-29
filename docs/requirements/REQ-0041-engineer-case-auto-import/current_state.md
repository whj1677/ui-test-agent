<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0041 当前状态

- 需求标题：工程师用例模板与CSV自动识别导入

## 元数据

- 需求状态：限定导入功能已实现；工程29项及正式4322交互7组，0失败；完整发布未验
- 治理分级：G2
- 当前版本：1
- 最后更新：2026-10-09

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0041-01 | 已确认 | 提供工程师填写模板，并自动识别现有CSV及常见用例表头，减少手动映射。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0041-01 | 已确认 | 识别UTF8/GB18030 CSV和常见列名，支持显式映射纠正，保留xlsx/json原生包兼容。 |
| DR-0041-02 | 已确认 | 保留原表字段与历史实际结果供人工追溯，避免进入模型预期和当前执行结论。 |
| DR-0041-03 | 已确认 | 提供可下载填写模板和简化自动识别界面。 |
| DR-0041-04 | 已确认 | 原正式4322完成导入验收并保全用户项目。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0041-01 | DR-0041-01 | 已确认 | 识别UTF8/GB18030 CSV和常见列名，支持显式映射纠正，保留xlsx/json原生包兼容。 |
| DD-0041-02 | DR-0041-02 | 已确认 | 保留原表字段与历史实际结果供人工追溯，避免进入模型预期和当前执行结论。 |
| DD-0041-03 | DR-0041-03 | 已确认 | 提供可下载填写模板和简化自动识别界面。 |
| DD-0041-04 | DR-0041-04 | 已确认 | 原正式4322完成导入验收并保全用户项目。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0041-01 | DR-0041-01 / DD-0041-01 | 已实现 | 识别UTF8/GB18030 CSV和常见列名，支持显式映射纠正，保留xlsx/json原生包兼容。 |
| TK-0041-02 | DR-0041-02 / DD-0041-02 | 已实现 | 保留原表字段与历史实际结果供人工追溯，避免进入模型预期和当前执行结论。 |
| TK-0041-03 | DR-0041-03 / DD-0041-03 | 已实现 | 提供可下载填写模板和简化自动识别界面。 |
| TK-0041-04 | DR-0041-04 / DD-0041-04 | 已实现 | 原正式4322完成导入验收并保全用户项目。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0041-01 | DR-0041-01 | 集成测试通过 | 真实文件77条，重复列/映射歧义不静默选择；缺预期保持待澄清。 | 命令：node --test workbench/tests/case-csv-import.test.mjs workbench/tests/excel-fidelity.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/case-import-source-isolation.test.mjs workbench/tests/requirements-export.test.mjs；退出码：0；测试数量：29；失败数量：0；跳过数量：0；证据：workbench/qa/20261009-case-auto-import/engineering.log |
| VT-0041-02 | DR-0041-02 | 集成测试通过 | 74/3历史完整保留；脚本输入快照排除source_fields；既有content和历史不变。 | 命令：node --test workbench/tests/case-csv-import.test.mjs workbench/tests/excel-fidelity.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/case-import-source-isolation.test.mjs workbench/tests/requirements-export.test.mjs；退出码：0；测试数量：29；失败数量：0；跳过数量：0；证据：workbench/qa/20261009-case-auto-import/engineering.log |
| VT-0041-03 | DR-0041-03 | 集成测试通过 | 模板首表无示例污染；自动匹配时默认摘要，未匹配可展开调整；原预览确认保留。 | 命令：node --test workbench/tests/case-csv-import.test.mjs workbench/tests/excel-fidelity.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-import-view.test.mjs workbench/tests/case-import-source-isolation.test.mjs workbench/tests/requirements-export.test.mjs；退出码：0；测试数量：29；失败数量：0；跳过数量：0；证据：workbench/qa/20261009-case-auto-import/engineering.log |
| VT-0041-04 | DR-0041-04 | 集成测试通过 | CSV预览/QA项目导入/模板下载解析/歧义提示真实操作；既有项目内容摘要一致。 | 命令：node workbench/qa/20261009-case-auto-import/live-check.mjs；退出码：0；测试数量：7；失败数量：0；跳过数量：0；证据：workbench/qa/20261009-case-auto-import/live.log |

## 人工待确认项

- [ ] 本轮实现范围无阻塞待确认；电价业务预期中的未知规则仍由用户后续核对。

## 本轮禁止实现内容

- 禁止以原表实际结果判断本次执行通过。
- 禁止自动填补电价业务规则或批准全部用例。
