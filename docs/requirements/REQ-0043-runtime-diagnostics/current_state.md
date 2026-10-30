<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0043 当前状态

- 需求标题：跨电脑运行诊断日志与脱敏导出

## 元数据

- 需求状态：实现及本机工程/正式4322导出验证完成；用户电脑需新版本复现，日志不补录历史事件；合并打包仍按此前要求等待并行修改。
- 治理分级：G2
- 当前版本：1
- 最后更新：2026-10-30

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0043-01 | 已确认 | 跨电脑故障可通过用户导出的运行日志定位，不仅保存报错，还保存相关正常过程与版本环境。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0043-01 | 已实现 | 集中式有界日志、隐私过滤及写入隔离 |
| DR-0043-02 | 已实现 | 启动、请求与任务全链路正常/异常记录 |
| DR-0043-03 | 已实现 | DSH、浏览器、Office和网页异常诊断 |
| DR-0043-04 | 已实现 | 网页和离线可导出诊断包 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0043-01 | DR-0043-01 | 已确认 | 集中式有界日志、隐私过滤及写入隔离 |
| DD-0043-02 | DR-0043-02 | 已确认 | 启动、请求与任务全链路正常/异常记录 |
| DD-0043-03 | DR-0043-03 | 已确认 | DSH、浏览器、Office和网页异常诊断 |
| DD-0043-04 | DR-0043-04 | 已确认 | 网页和离线可导出诊断包 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0043-01 | DR-0043-01 / DD-0043-01 | 已完成 | 集中式有界日志、隐私过滤及写入隔离 |
| TK-0043-02 | DR-0043-02 / DD-0043-02 | 已完成 | 启动、请求与任务全链路正常/异常记录 |
| TK-0043-03 | DR-0043-03 / DD-0043-03 | 已完成 | DSH、浏览器、Office和网页异常诊断 |
| TK-0043-04 | DR-0043-04 / DD-0043-04 | 已完成 | 网页和离线可导出诊断包 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0043-01 | DR-0043-01 | 单元测试通过 | 集中式有界日志、隐私过滤及写入隔离 | 命令：node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：92；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/regression-final.log |
| VT-0043-02 | DR-0043-02 | 单元测试通过 | 启动、请求与任务全链路正常/异常记录 | 命令：node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：92；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/regression-final.log |
| VT-0043-03 | DR-0043-03 | 单元测试通过 | DSH、浏览器、Office和网页异常诊断 | 命令：node --test --test-concurrency=1 workbench/tests/diagnostics.test.mjs workbench/tests/native-dsh-client.test.mjs workbench/tests/native-dsh-executor.test.mjs workbench/tests/office-reader.test.mjs workbench/tests/startup-budget.test.mjs workbench/tests/portable-package.test.mjs workbench/tests/model-credentials.test.mjs workbench/tests/native-runtime.test.mjs workbench/tests/model-settings.test.mjs workbench/tests/model-activation.test.mjs workbench/tests/demonstration-integration.test.mjs；退出码：0；测试数量：92；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/regression-final.log |
| VT-0043-04 | DR-0043-04 | 集成测试通过 | 网页和离线可导出诊断包 | 命令：node workbench/qa/20261030-diagnostics-system/verify-official.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-diagnostics-system/official-verified.log |

## 人工待确认项

- [ ] 用户电脑需安装合并后的新版本并复现，才能取得新日志；该现场结果未运行。

## 本轮禁止实现内容

- 不记录API Key、Authorization/Cookie、完整模型提示或文档正文；不静默上传诊断包；不更改沙箱或连接未授权浏览器。
