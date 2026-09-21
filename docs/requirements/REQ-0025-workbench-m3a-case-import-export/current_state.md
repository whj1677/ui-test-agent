<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0025 当前状态

- 需求标题：M3-A 项目用例库与Excel及原生用例包导入导出

## 元数据

- 需求状态：已完成
- 治理分级：G2
- 当前版本：3
- 最后更新：2026-09-21

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0025-01 | 已确认 | 本地单用户在工作台完成创建项目、多次导入、预览确认、查看维护、选择导出和导入另一个项目的数据闭环。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0025-01 | 已确认 | 提供项目创建、列表、进入和名称/说明修改，以及项目内用例查询、详情和形成新版本的修改。 |
| DR-0025-02 | 已确认 | 真实xlsx上传后选择工作表、配置字段映射、预览问题并显式确认导入。 |
| DR-0025-03 | 已确认 | 使用带schema版本的JSON用例包导出全部或选中用例，并支持向新/已有项目多次导入。 |
| DR-0025-04 | 已确认 | 导入必须先预览新增、重复、冲突、待澄清和不可导入，确认时重新检查项目修订并保证幂等、原子落盘。 |
| DR-0025-05 | 已确认 | 中文Web完成真实Excel、JSON下载/上传、跨项目独立修改、冲突和重启闭环，并回归现有工作台页面与媒体读取。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0025-01 | DR-0025-01 / DR-0025-04 | 已确认 | 在workbench/.local下新增独立case-library JSON存储，项目单文件持有用例版本和导入记录，串行原子替换并使用project_revision做预览乐观检查。 |
| DD-0025-02 | DR-0025-02 | 已确认 | xlsx二进制先落入私有上传目录，再用锁定ExcelJS按真实物理行列读取；步骤与预期按单元格内原始行位置配对，不剥离行首或独立压缩空行。 |
| DD-0025-03 | DR-0025-03 / DR-0025-04 | 已确认 | 原生包采用workbench/case-package-v1，导出只含业务字段、版本、根来源与逐项目lineage；导入生成新内部ID。 |
| DD-0025-04 | DR-0025-04 | 已确认 | 预览记录冻结源文件哈希、映射、目标项目revision和每项分类；确认只接受已登记preview_id及显式冲突决策，成功后记录confirmed结果供幂等读回。 |
| DD-0025-05 | DR-0025-05 | 已确认 | 在现有单页工作台增加紧凑项目/用例表格、按需详情和导入面板；文件上传使用受控二进制端点，下载使用受控JSON响应。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0025-01 | DR-0025-01 / DR-0025-04 / DD-0025-01 | 已完成 | 实现项目/用例模型、版本、查询和原子持久化。 |
| TK-0025-02 | DR-0025-02 / DR-0025-04 / DD-0025-02 / DD-0025-04 | 已完成 | 实现xlsx上传、工作表/映射、预览问题和确认导入。 |
| TK-0025-03 | DR-0025-03 / DR-0025-04 / DD-0025-03 / DD-0025-04 | 已完成 | 实现原生包部分/全部导出、多次导入、重复和冲突处理。 |
| TK-0025-04 | DR-0025-05 / DD-0025-05 | 已完成 | 实现中文项目用例与导入导出页面。 |
| TK-0025-05 | DR-0025-01 / DR-0025-02 / DR-0025-03 / DR-0025-04 / DR-0025-05 / DD-0025-01 / DD-0025-02 / DD-0025-03 / DD-0025-04 / DD-0025-05 | 已完成 | 完成真实xlsx/浏览器10步验收、旧能力回归、报告和GitHub同步。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0025-01 | DR-0025-01 / DR-0025-04 | 集成测试通过 | 项目/用例CRUD、版本、原子写入、重启和失败处理。 | 命令：npm test --prefix workbench；退出码：0；测试数量：52；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/npm-test-fidelity.log |
| VT-0025-02 | DR-0025-02 / DR-0025-04 | 集成测试通过 | 真实xlsx选表、真实物理行列、前导零/中文/数字样文本、多行位置配对、公式与结构错误。 | 命令：npm test --prefix workbench；退出码：0；测试数量：52；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/npm-test-fidelity.log |
| VT-0025-03 | DR-0025-03 / DR-0025-04 | 集成测试通过 | 全部/部分JSON包、跨项目独立ID、lineage、重复、冲突和往返一致。 | 命令：npm run test:m3a-browser --prefix workbench；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-browser.log |
| VT-0025-04 | DR-0025-05 | 集成测试通过 | 中文Web项目列表、紧凑用例表格、详情编辑、原值与问题位置预览确认交互。 | 命令：npm run test:m3a-fidelity-browser --prefix workbench；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-fidelity-browser.log |
| VT-0025-05 | DR-0025-05 | 集成测试通过 | 用户指定10步真实Web闭环、Excel保真边界Web复验和重启持久化。 | 命令：npm run test:m3a-fidelity-browser --prefix workbench；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-fidelity-browser.log |

## 人工待确认项

- [ ] 用户尚未提供实际Excel模板；本批只验收公开合成首版模板，不推断其他排版兼容。

## 本轮禁止实现内容

- 不得启动Harness、调用模型、生成或执行业务脚本。
- 不得修改M1/M2历史、批准脚本、预算、候选和媒体原件。
- 不得开放任意路径、任意文件执行、宏/公式计算、绝对路径导出或.local静态目录。
- 不得自动审批、测试套件执行、多人权限、复杂数据库或跨项目自动同步。
