<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0025 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0025-01 | DR-0025-01 / DR-0025-04 | 已确认 | 集成测试通过 | 项目/用例CRUD、版本、原子写入、重启和失败处理。 | Node工程测试与临时目录故障注入 | 命令：npm test --prefix workbench；退出码：0；测试数量：52；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/npm-test-fidelity.log | npm test --prefix workbench | 0 | 52 | 0 | 0 | docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/npm-test-fidelity.log |
| VT-0025-02 | DR-0025-02 / DR-0025-04 | 已确认 | 集成测试通过 | 真实xlsx选表、真实物理行列、前导零/中文/数字样文本、多行位置配对、公式与结构错误。 | 独立真实xlsx保真夹具、解析结果、原始行位置和具体单元格行错误 | 命令：npm test --prefix workbench；退出码：0；测试数量：52；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/npm-test-fidelity.log | npm test --prefix workbench | 0 | 52 | 0 | 0 | docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/npm-test-fidelity.log |
| VT-0025-03 | DR-0025-03 / DR-0025-04 | 已确认 | 集成测试通过 | 全部/部分JSON包、跨项目独立ID、lineage、重复、冲突和往返一致。 | 工程测试与实际下载包哈希 | 命令：npm run test:m3a-browser --prefix workbench；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-browser.log | npm run test:m3a-browser --prefix workbench | 0 | 1 | 0 | 0 | docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-browser.log |
| VT-0025-04 | DR-0025-05 | 已确认 | 集成测试通过 | 中文Web项目列表、紧凑用例表格、详情编辑、原值与问题位置预览确认交互。 | 真实Chromium上传边界xlsx、预览、确认、重启与脱敏截图 | 命令：npm run test:m3a-fidelity-browser --prefix workbench；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-fidelity-browser.log | npm run test:m3a-fidelity-browser --prefix workbench | 0 | 1 | 0 | 0 | docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-fidelity-browser.log |
| VT-0025-05 | DR-0025-05 | 已确认 | 集成测试通过 | 用户指定10步真实Web闭环、Excel保真边界Web复验和重启持久化。 | 真实文件选择/下载、后端记录、边界原值/物理位置和重启读回 | 命令：npm run test:m3a-fidelity-browser --prefix workbench；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-fidelity-browser.log | npm run test:m3a-fidelity-browser --prefix workbench | 0 | 1 | 0 | 0 | docs/requirements/REQ-0025-workbench-m3a-case-import-export/evidence/m3a-fidelity-browser.log |
| VT-0025-06 | DR-0025-06 | 已确认 | 单元测试通过 | 可恢复删除/恢复、持久化、冻结身份、原子拒绝、同源及运行期/并发准入、确认前无写入。 | 不另开工作台的真实服务处理器及磁盘存储验证，旧能力回归。 | 命令：node --test workbench/tests/case-lifecycle.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-content-review.test.mjs workbench/tests/navigation-loading.test.mjs；退出码：0；测试数量：20；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-case-delete/tests.log | node --test workbench/tests/case-lifecycle.test.mjs workbench/tests/case-library.test.mjs workbench/tests/case-content-review.test.mjs workbench/tests/navigation-loading.test.mjs | 0 | 20 | 0 | 0 | workbench/qa/20261030-case-delete/tests.log |
| VT-0025-07 | DR-0025-06 | 已确认 | 集成测试通过 | 正式4322用例单条/批量删除、取消、已删除列表与恢复，原用例版本/脚本/运行记录保留。 | 实际页面交互、截图、操作前后机读比较；使用合成项目，模型与业务执行0。 | 命令：Formal 4322 CUA UI: cancel, single delete/restore, bulk delete/restore, reload; read-only API comparison；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-case-delete/official-result.json | Formal 4322 CUA UI: cancel, single delete/restore, bulk delete/restore, reload; read-only API comparison | 0 | 1 | 0 | 0 | workbench/qa/20261030-case-delete/official-result.json |

## 本轮命令与环境

- 工作目录：workbench与仓库根需求工具
- 命令：npm test
- 命令：npm run test:m3a-browser
- 命令：npm run test:m2c-runtime-media-readback
- 环境：Windows；Node 22；127.0.0.1单用户；Git忽略私有数据目录；Harness/模型凭据不需要。

## 结论

- M3-A数据闭环工程与真实Web验收通过；Harness启动0次、模型调用0次、业务脚本执行0次。
